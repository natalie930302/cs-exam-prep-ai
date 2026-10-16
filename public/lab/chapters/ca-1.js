// 計算機組織 第1章：數字系統與運算（二進位／十六進位、2's complement、加減法與 overflow、
// ALU、乘法器、除法器、IEEE 754、浮點加法與捨入、CPU time、Amdahl's law）。
// 課本：Patterson & Hennessy, Computer Organization and Design (MIPS)，第 1、3 章與附錄 B/C。
// 本章影片目前都還沒有逐字稿，場景全部依例題（數字照課本），名稱標「課本」。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

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

  // ───────────────────────── 場景（例題） ─────────────────────────
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
    say('例：eca8₁₆ 轉二進位', '一個 hex 位數直接展開成 4 bits');
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
    say('例：把 2 變成 −2', '2 = 0000 0010');
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
    say('例：7 + 6（這裡用 8 bits）', '0000 0111 + 0000 0110');
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
    say('例：7 − 6 = 7 + (−6)', '減法 = 加上 2\'s complement');
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
    say('1-bit ALU：AND、OR、加法器 + MUX', '課本附錄 B（第 4 版為附錄 C）的設計');
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
    say('例：−0.75 用 single precision 表示', '');
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
    say('例：這 32 bits 是多少？', '1 10000001 0100…0');
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
    say('例：0.5 + (−0.4375)，有效位數 4 bits', '');
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
    say('例：2.56 × 10⁰ + 2.34 × 10²', '十進位、只能存 3 位有效數字');
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
    say('例：A 是 2 GHz，程式跑 10 秒', 'cycles = 10 s × 2×10⁹ = 20×10⁹');
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
    say('例：程式 100 秒，乘法占 80 秒', '想讓整個程式快 5 倍（20 秒）？');
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
      return { q: '十進位 ' + v + ' 的 8-bit 二進位與 hex 是？', opts: uniq(grp(bin(v, 8)) + ' = ' + h, [grp(bin(v ^ 1, 8)) + ' = 0x' + (v ^ 1).toString(16).toUpperCase().padStart(2, '0'), grp(bin(v, 8).split('').reverse().join('')) + ' = 0x' + uval(bin(v, 8).split('').reverse().join('')).toString(16).toUpperCase().padStart(2, '0'), grp(bin(v + 16, 8)) + ' = 0x' + ((v + 16) & 255).toString(16).toUpperCase().padStart(2, '0'), grp(bin(v ^ 0x80, 8)) + ' = 0x' + (v ^ 0x80).toString(16).toUpperCase().padStart(2, '0')]), ans: grp(bin(v, 8)) + ' = ' + h, why: '用權重 128、64、…、1 拆，再 4 bits 一組換成 hex。' };
    }
    if (t === 1) {
      const v = -R(1, 127);
      const ans = grp(bin(v, 8));
      return { q: v + ' 的 8-bit 2\'s complement 是？', opts: uniq(ans, [grp(inv(bin(-v, 8))), grp('1' + bin(-v, 7)), grp(bin(-v, 8)), grp(bin(v + 1, 8))]), ans, why: '|' + v + '| = ' + grp(bin(-v, 8)) + '，反相得 ' + grp(inv(bin(-v, 8))) + '（1\'s complement），再 +1。' };
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
      return { q: '程式有 ' + IC + '×10⁹ 個指令，CPI = ' + CPI + '，clock rate ' + G + ' GHz，CPU time 是？', opts: uniq(T + ' s', [+(IC * CPI * G).toFixed(3) + ' s', +(IC / (CPI * G)).toFixed(3) + ' s', +(IC * G / CPI).toFixed(3) + ' s', +(IC / G).toFixed(3) + ' s', +(IC * CPI).toFixed(3) + ' s', +(T * 2).toFixed(3) + ' s']), ans: T + ' s', why: 'CPU time = IC × CPI ÷ clock rate = ' + IC + '×10⁹ × ' + CPI + ' ÷ ' + G + '×10⁹ = ' + T + ' s。' };
    }
    if (t === 6) {
      const f = pickOne([0.5, 0.6, 0.75, 0.8, 0.9]), s = pickOne([2, 4, 5, 10]);
      const sp = +(1 / (1 - f + f / s)).toFixed(2);
      return { q: '程式有 ' + f * 100 + '% 的時間可以加速 ' + s + ' 倍，整體 speedup 約多少？', opts: uniq(sp + '×', [s + '×', +(f * s).toFixed(2) + '×', +(1 / (1 - f)).toFixed(2) + '×', +(1 + f * (s - 1)).toFixed(2) + '×', +((1 - f) + f / s).toFixed(2) + '×']), ans: sp + '×', why: 'Amdahl：1 / ((1 − ' + f + ') + ' + f + '/' + s + ') = ' + sp + '；上限是 1/(1 − f) = ' + +(1 / (1 - f)).toFixed(2) + '。' };
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ nuA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 1 章（清大 黃婷婷 第 1A、2A、3A、9A 講 + IEEE 754 英文影片）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那句話（notes 的 cues）才做一個短動作，不循環、不重播。
// 老師的數字照用（ENIAC 25 m／2.5 m／每秒 1900 個加法、28 nm、Concorde 132 人 1350 mph、A 10 s／B 15 s、
// 2 GHz 10 s → 6 s 要 4 GHz、116 → 0x42E80000…）；所有算出來的數字都由程式算，畫面顯示 ✓。
// 老師沒給數字、我們自己舉的例子標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (b, t, x, y) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const mono = (l) => { Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' }); return l; };
const mt = (t, x, y, cls = '') => mono(tag(t, cls, x, y));
const bx = (t, c, x, y, z = 0, w = 2.2, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const NC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7', rose: '#f2c4c4', metal: '#8a94a6', off: '#efe6d6' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.ms) return gone(o.ms); if (o.g) return kill(o.g); if (o.element) remove(o); else kill(o); });
const lk = (x1, y1, x2, y2, c = 0x6e5f49, z = 0.1) => arrow(V3(x1, y1, z), V3(x2, y2, z), c);
const seg = (x1, y1, x2, y2, c = '#8a7a5c', z = 0) => line(x1, y1, x2, y2, z, c);
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a dot (label) that runs along a list of points
async function runDot(tok, t, pts, ms = 450, cls = 'ptr alt') { const d = tag(t, cls, pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) await travel(tok, d, V3(pts[i - 1][0], pts[i - 1][1], 0.2), V3(pts[i][0], pts[i][1], 0.2), ms); return d; }
// a growing column of lines: add() puts the next line under the last one
function list(x, yTop, dy = 0.55, cls = 'idx') {
  const ls = [];
  return { ls, add(t, c) { const l = tag(t, c || cls, x, yTop - ls.length * dy); ls.push(l); return l; }, kill() { ls.forEach(remove); ls.length = 0; } };
}
// a horizontal bar sitting on y0 (height h), x-centered
function vbar(c, x, h, w = 0.7, y0 = 0, d = 0.7) { const m = lab.box(c, [w, 1, d]); m.scale.y = Math.max(0.001, h); m.position.set(x, y0 + Math.max(0.001, h) / 2, 0); lab.world.add(m); return m; }
function setH(m, h, y0 = 0) { m.scale.y = Math.max(0.001, h); m.position.y = y0 + Math.max(0.001, h) / 2; }
const dbits = (x) => { const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x); return dv.getUint32(0).toString(2).padStart(32, '0') + dv.getUint32(4).toString(2).padStart(32, '0'); };
const fmtN = (n) => n.toLocaleString('en-US');
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || [[0, 4.2, 14], [0, 3.0, 0]]; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a MOS transistor cross-section (shared by 1A and 2A): p-type body, two n regions, oxide, gate
function mos(S, cx = 0, y = 0.2, parts = 'all') {
  S.body = bx('', NC.rose, cx, y + 0.6, 0, 7.0, 1.2, 1.6); S.bodyL = sm('p-type silicon（電洞多，帶 +）', cx, y - 0.25);
  if (parts === 'body') return;
  S.ns = [-2.4, 2.4].map((dx) => bx('n', '#9fc6ee', cx + dx, y + 1.05, 0.2, 1.7, 0.5, 1.3));
  if (parts === 'n') return;
  S.ox = bx('', '#f5f1e8', cx, y + 1.36, 0.2, 3.1, 0.12, 1.2);
  S.gate = bx('gate（金屬）', NC.metal, cx, y + 1.65, 0.2, 3.1, 0.45, 1.2);
}

// ════════ YY1wOUdIwWU（第 1A 講：Course Outline） ════════
scene('nuA-1a-binary', '為什麼電腦用二進位：電壓只分 high / low', [
  async (tok, S) => { // 34.8 為什麼不用十進位
    hot('為什麼電腦用二進位，不用十進位？', 0, 6.4);
    cap('電腦跟我們最大的差異', '它用二進位，不用十進位');
  },
  async (tok, S) => { // 46.0 用 signal 表示 information
    S.sig = bx('signal（訊號）', NC.sky, -4.3, 4.9, 0, 2.6, 0.6, 0.8);
    S.inf = sm('表示 information：instruction、number…', -1.0, 4.9);
    cap('用一個 signal 表示一個 information', '可能是 instruction，也可能是數字');
  },
  async (tok, S) => { // 58.8 電壓分 high、low
    const hs = [2.6, 0.5, 2.3, 0.6, 0.4, 2.7, 2.4, 0.5];
    S.hs = hs; S.bars = hs.map((h, i) => vbar(NC.tan, -3.5 + i * 1.0, h, 0.6, 0.3));
    sm('signal 的電壓（示意）', -0.0, -0.2);
    cap('訊號的電壓分成 high 和 low', '');
  },
  async (tok, S) => { // 66.8 threshold
    S.th = seg(-4.4, 1.8, 4.4, 1.8, '#d64545', 0.4); bad('threshold', 5.4, 1.8);
    S.bars.forEach((m, i) => tint(m, S.hs[i] > 1.5 ? NC.blue : NC.off));
    cap('定一個 threshold（門檻）', '高於它叫 high，低於它叫 low');
  },
  async (tok, S) => { // 79.0 只有兩種 state
    S.hs.forEach((h, i) => tag(h > 1.5 ? 'high' : 'low', 'idx', -3.5 + i * 1.0, h + 0.75));
    note('只有兩種 state：high/low ＝ true/false ＝ 1/0', 0, 5.9);
    cap('所以只有兩種狀態', '叫 high/low、true/false、1/0 都可以');
  },
  async (tok, S) => { // 91.0 bit
    S.bits = S.hs.map((h, i) => hot(h > 1.5 ? '1' : '0', -3.5 + i * 1.0, -0.8));
    good('一個 signal ＝ 一個 bit：只有 0 和 1', 0, 3.6);
    cap('這個 signal 就是一個 bit', '一個 bit 只有 0 跟 1');
  },
]);

scene('nuA-1a-nmos', 'Transistor：NMOS 怎麼當開關', [
  async (tok, S) => { // 104.5 需要電子開關
    S.sw = bx('電子開關 switch', NC.gold, -4.2, 5.9, 0, 3.0, 0.6, 0.8);
    S.t = hot('→ 用 transistor（電晶體）做', 0.6, 5.9);
    cap('要讓訊號運作，需要一個電子開關', 'switch 用 transistor 做');
  },
  async (tok, S) => { // 119.8 NMOS 結構：底座 p-type
    mos(S, 0, 0.2, 'body');
    hd('NMOS transistor 剖面', 0, 4.8);
    cap('NMOS 的底座是 p-type silicon', 'silicon 是半導體，p-type 電洞比較多');
  },
  async (tok, S) => { // 143.0 n-type
    S.ns = [-2.4, 2.4].map((dx) => bx('n', '#9fc6ee', dx, 1.25, 0.2, 1.7, 0.5, 1.3));
    sm('n-type：電子比較多（帶 −）', 0, 3.9);
    cap('兩邊是 n-type silicon', '電子比較多，帶負電');
  },
  async (tok, S) => { // 168.0 oxide insulator
    S.ox = bx('', '#f5f1e8', 0, 1.56, 0.2, 3.1, 0.12, 1.2); sm('oxide insulator（氧化物絕緣層）', 4.4, 2.4);
    cap('中間一層 oxide insulator', '氧化的絕緣物質');
  },
  async (tok, S) => { // 177.0 gate
    S.gate = bx('gate（金屬）', NC.metal, 0, 1.85, 0.2, 3.1, 0.45, 1.2);
    cap('最上面是金屬層，叫 gate', '這就是一個基本的 switch');
  },
  async (tok, S) => { // 197.4 PMOS
    note('PMOS：n 和 p 對調（底座 n-type，兩邊 p-type）', 0, 6.4);
    cap('相對的還有 PMOS', 'NMOS + PMOS 就能組成 gate，建出電腦');
  },
  async (tok, S) => { // 240.0 三個 terminal
    hd('source', -2.4, 2.4); hd('drain', 2.4, 2.4); hd('gate', 0, 2.7);
    cap('三個 terminal：source、drain、gate', '加不同電壓就能讓它開或關');
  },
  async (tok, S) => { // 279.0 gate 加 high voltage
    hot('gate 加 high voltage', 0, 3.4); glow(S.gate.material ? S.gate : S.gate, HL);
    S.e = [];
    for (let k = 0; k < 6; k++) { const m = cube('−', NC.blue, [0.28, 0.22, 0.28], -1.2 + k * 0.48, 0.5, 0.75); S.e.push(m); }
    for (let k = 0; k < 6; k++) await slide(tok, S.e[k], -1.2 + k * 0.48, 1.2, 0.75, 120);
    cap('gate 加高電壓', '把很多 electron 吸到 gate 下面');
  },
  async (tok, S) => { // 305.2 形成 channel
    S.ch = bx('channel', '#6fb3f0', 0, 1.2, 0.85, 3.2, 0.14, 0.2);
    S.ch.userData.lbl.position.set(0, -0.42, 0.1); // name under the strip: the electrons sit on it
    cap('electron 在 drain 和 source 之間', '形成一條 channel');
  },
  async (tok, S) => { // 321.0 加電位差 → 電流 → 開
    S.a = lk(-2.4, 0.75, 2.4, 0.75, 0x2fc092, 0.9); good('有電流 → 開（ON）', 0, -0.9);
    await runDot(tok, '電流', [[-2.4, 0.4], [2.4, 0.4]], 900, 'good');
    cap('source、drain 間加電位差', '電流流過去，開關是「開」');
  },
  async (tok, S) => { // 331.2 拿掉 gate voltage → 關
    gone(S.ch, S.e, S.a); glow(S.gate, null); bad('gate 電壓拿掉：channel 消失 → 關（OFF）', 0, 3.4);
    cap('把 gate 的電壓拿走', 'channel 不見了，開關是「關」');
  },
]);

scene('nuA-1a-nand', '用 NMOS、PMOS 組出 NAND gate', [
  async (tok, S) => { // 372.0 開關的符號：NMOS
    S.n = bx('NMOS', NC.blue, -5.0, 5.6, 0, 1.4, 0.55, 0.7); sm('gate = 1 → 通（開）', -5.0, 4.9);
    cap('開關的符號：NMOS', 'gate 給 1 就導通');
  },
  async (tok, S) => { // 394.0 PMOS 有圈圈
    S.p = bx('PMOS ○', NC.pink, -5.0, 3.9, 0, 1.4, 0.55, 0.7); sm('gate = 0 → 通（相反）', -5.0, 3.2);
    cap('有圈圈的是 PMOS', '給 0 才導通，給 1 不通');
  },
  async (tok, S) => { // 420.0 串並聯接起來
    bx('VDD（high）', NC.gold, 0.5, 6.4, 0, 4.4, 0.3, 0.6); bx('Ground（low）', NC.dark, 0.5, -0.2, 0, 4.4, 0.3, 0.6);
    S.pA = bx('PMOS A', NC.pink, -0.7, 5.2, 0, 1.3, 0.5, 0.6); S.pB = bx('PMOS B', NC.pink, 1.7, 5.2, 0, 1.3, 0.5, 0.6);
    S.nA = bx('NMOS A', NC.blue, 0.5, 2.6, 0, 1.3, 0.5, 0.6); S.nB = bx('NMOS B', NC.blue, 0.5, 1.2, 0, 1.3, 0.5, 0.6);
    [-0.7, 1.7].forEach((x) => { seg(x, 6.25, x, 5.45); seg(x, 4.95, x, 4.0); }); seg(-0.7, 4.0, 1.7, 4.0);
    seg(0.5, 4.0, 0.5, 2.85); seg(0.5, 2.35, 0.5, 1.45); seg(0.5, 0.95, 0.5, -0.05);
    sm('PMOS 並聯接 VDD', 4.0, 5.2); sm('NMOS 串聯接 Ground', 3.2, 1.9);
    cap('PMOS 並聯接 VDD，NMOS 串聯接 Ground', '');
  },
  async (tok, S) => { // 454.4 input A、B，output C
    S.C = hot('C = ?', -1.0, 4.0);
    S.tb = list(5.6, 6.0, 0.5, 'idx'); S.tb.add('A B │ C', 'ptr');
    cap('input A、B 接到 gate', 'output 接在中間的 C');
  },
  async (tok, S) => { // 461.0 00
    S.eval = (a, b) => {
      const pa = a === 0, pb = b === 0, na = a === 1, nb = b === 1;
      [[S.pA, pa], [S.pB, pb], [S.nA, na], [S.nB, nb]].forEach(([m, on]) => glow(m, on ? OKG : NG));
      const up = pa || pb, down = na && nb; const c = up && !down ? 1 : !up && down ? 0 : -1;
      txt(S.C, 'C = ' + c); return c;
    };
    const c = S.eval(0, 0); S.tb.add('0 0 │ ' + c);
    cap('A = 0、B = 0：下面 NMOS 不通、上面通', 'VDD 充到 C，C = 1');
  },
  async (tok, S) => { // 490.0 01、10
    const c1 = S.eval(0, 1); S.tb.add('0 1 │ ' + c1); const c2 = S.eval(1, 0); S.tb.add('1 0 │ ' + c2);
    cap('只有一個是 1：串聯的 NMOS 不通', '上面有一條通 → C = 1');
  },
  async (tok, S) => { // 506.0 11
    const c = S.eval(1, 1); S.tb.add('1 1 │ ' + c);
    cap('A = B = 1：上面都不通、下面都通', 'C 接到 Ground，C = 0');
  },
  async (tok, S) => { // 528.0 NAND
    const all = [[0, 0], [0, 1], [1, 0], [1, 1]].every(([a, b]) => S.eval(a, b) === (a && b ? 0 : 1));
    ok(all, '四列都等於 NOT(A AND B) → NAND gate ✓', 2.6, -0.9);
    cap('這剛好是一個 NAND gate', '');
  },
  async (tok, S) => { // 545.0 functionally complete
    const nand = (a, b) => (a && b ? 0 : 1);
    const notOk = [0, 1].every((a) => nand(a, a) === 1 - a), andOk = [[0, 0], [0, 1], [1, 0], [1, 1]].every(([a, b]) => nand(nand(a, b), nand(a, b)) === (a & b));
    ok(notOk && andOk, 'NOT A = A NAND A，AND = NOT(NAND) ✓', -3.8, 0.4);
    note('NAND 是 functionally complete', -3.8, 1.2);
    cap('NAND 是 functionally complete', '任何 Boolean function 都能用它兜出來');
  },
]);

scene('nuA-1a-units', '從 gate 到加法器、乘法、latch、register', [
  async (tok, S) => { // 567.6 有 NAND 就能做 function unit
    hot('有了 NAND gate → 做 function unit', 0, 6.4);
    cap('有了邏輯閘', '就能做 function unit');
  },
  async (tok, S) => { // 572.0 full adder
    S.fa = bx('full adder', NC.purple, -3.8, 4.4, 0, 2.2, 0.8, 1.0);
    const a = 1, b = 1, ci = 0, s = a ^ b ^ ci, co = (a & b) | (a & ci) | (b & ci);
    sm('3 個 input：a、b、carry-in', -3.8, 5.3); sm('2 個 output：sum、carry-out', -3.8, 3.6);
    ok(s + 2 * co === a + b + ci, '示意：1 + 1 + 0 → sum ' + s + '、carry ' + co + '（= 2）✓', -3.8, 2.9);
    cap('一個 bit 的 full adder', '三個 bit 相加 → sum 和 carry');
  },
  async (tok, S) => { // 600.0 重複 → 16、32 bits
    S.row = []; for (let i = 0; i < 16; i++) S.row.push(cube('FA', NC.lilac, [0.36, 0.4, 0.5], 0.3 + i * 0.4, 4.4, 0));
    sm('16 個串起來 → 16-bit 加法器；再加倍 → 32-bit', 3.3, 3.6);
    cap('會做 1 bit，就會做 16、32 bits', '每個 bit 做的事都一樣，重複就好');
  },
  async (tok, S) => { // 618.0 乘法 = shift and add
    const a = 3, b = 5; const pp = [0, 1, 2, 3].map((k) => ((b >> k) & 1 ? a << k : 0));
    const sum = pp.reduce((x, y) => x + y, 0);
    S.m = list(-3.8, 2.2, 0.45, 'idx'); S.m.add('示意：0011 × 0101', 'ptr');
    pp.forEach((v, k) => S.m.add('  ' + v.toString(2).padStart(7, '0') + (k ? '  （左移 ' + k + '）' : '')));
    ok(sum === a * b, '加起來 ' + sum.toString(2) + ' = ' + sum + ' = 3 × 5 ✓', 2.6, 0.4);
    cap('乘法就是 shift and add', '把 partial product 移位再加起來');
  },
  async (tok, S) => { // 642.0 要儲存
    gone(S.row, S.m, S.fa); hot('電腦也一定要能「儲存」', 0, 5.6);
    cap('會運算還不夠', '電腦一定要能儲存');
  },
  async (tok, S) => { // 653.0 cross-coupled → latch
    S.g1 = bx('NAND', NC.purple, -2.2, 4.4, 0, 1.3, 0.6, 0.8); S.g2 = bx('NAND', NC.purple, -2.2, 2.8, 0, 1.3, 0.6, 0.8);
    lk(-1.5, 4.4, -2.0, 3.15, 0xc08a1f); lk(-1.5, 2.8, -2.0, 4.05, 0xc08a1f);
    S.q = hot('Q = 1', 0.4, 4.4); good('cross-coupled → SR latch：存 1 個 bit', -2.2, 1.8);
    cap('兩個 gate 交叉接起來 → latch', '存了 1 就一直是 1，存 0 就是 0');
  },
  async (tok, S) => { // 674.0 擴充 → register
    S.reg = []; for (let i = 0; i < 16; i++) S.reg.push(cube(i % 3 ? '0' : '1', i % 3 ? NC.off : NC.blue, [0.36, 0.4, 0.5], 1.2 + i * 0.36, 3.0, 0));
    hd('16（或 32）個 latch → register', 4.0, 3.8);
    cap('一個 bit 擴充成 16、32 bits', '就是一個 register（暫存器）');
  },
  async (tok, S) => { // 687.0 元件都做得出來
    good('會運算 ＋ 會記憶 → 電腦的元件都能做出來', 0, 0.4); sm('（這些在「數位邏輯設計」學過）', 0, -0.3);
    cap('運算和記憶都有了', '電腦的元件大體上都能做出來');
  },
]);

scene('nuA-1a-org', '基本架構：processor（datapath + control）、memory、I/O', [
  async (tok, S) => { // 704.6 component 都建出來
    S.mem = prop('warehouse', -5.4, 1.4, 0, 0.9, 'memory'); S.rf = bx('register file', NC.sky, -0.4, 2.6, 0, 2.0, 0.8, 0.9);
    cap('component 都建好了', '基本架構：暫存器、記憶體');
  },
  async (tok, S) => { // 718.0 從記憶體拿 instruction
    S.ins = await runDot(tok, 'instruction', [[-5.0, 3.0], [-3.0, 5.2]], 900, 'ptr alt');
    cap('先從記憶體拿一個 instruction', '程式就是一個一個 instruction');
  },
  async (tok, S) => { // 738.0 放 instruction register
    gone(S.ins); S.ir = bx('instruction register', NC.lilac, -3.0, 5.2, 0, 2.6, 0.6, 0.8);
    cap('放進 instruction register', '');
  },
  async (tok, S) => { // 740.4 decode
    S.ctl = bx('control（decode）', NC.orange, 1.6, 5.2, 0, 2.6, 0.6, 0.8); lk(-1.7, 5.2, 0.3, 5.2);
    cap('decode：看它到底要做什麼', '每個 instruction 意思不一樣');
  },
  async (tok, S) => { // 748.0 控制訊號 → 暫存器 → 運算 → 存回
    S.alu = bx('ALU', NC.purple, 3.2, 2.6, 0, 1.6, 0.9, 0.9); lk(1.6, 4.85, 3.0, 3.1, 0xdd8238); lk(1.6, 4.85, 0.0, 3.05, 0xdd8238);
    gone(await runDot(tok, 'data', [[0.6, 2.6], [2.4, 2.6]], 600, 'val')); gone(await runDot(tok, '結果', [[3.2, 2.0], [-0.4, 2.0]], 700, 'good')); // the dots are delivered, then gone (they sat on ALU / register file)
    cap('控制訊號：從暫存器拿 data、運算', '再存回暫存器');
  },
  async (tok, S) => { // 761.9 processor = datapath + control
    S.z = zone('processor', 0.9, -0.3, -1.2, 7.8, 1.0, '#efe3cc'); hot('processor ＝ datapath ＋ control', 0.9, 6.3);
    cap('任何電腦都是這個架構', 'processor 包含 datapath 和 control');
  },
  async (tok, S) => { // 774.0 datapath
    hd('datapath：register file → ALU → register file', 0.9, 1.1); glow(S.rf, HL); glow(S.alu, HL);
    cap('datapath：data 走的路', '從 register file 經過運算再寫回');
  },
  async (tok, S) => { // 796.0 controller
    glow(S.rf, null); glow(S.alu, null); glow(S.ctl, HL); bub('現在做加？減？shift？', 1.6, 6.0);
    cap('每個 clock 要做不同的事', 'controller 告訴它現在做什麼');
  },
  async (tok, S) => { // 821.0 memory
    glow(S.ctl, null); sm('大量 data ＋ program 都放 memory', -5.4, 0.5);
    cap('register 只能存少量資料', '大量的 data 和 program 存在 memory');
  },
  async (tok, S) => { // 841.0 I/O input
    S.kb = prop('keyboard', 5.6, 4.6, 0, 0.7, 'input'); sm('keyboard、mouse', 5.6, 4.1);
    cap('電腦要跟人溝通：I/O', 'input：keyboard、mouse');
  },
  async (tok, S) => { // 858.0 output
    S.mon = prop('monitor', 5.6, 1.6, 0, 0.7, 'output'); sm('display、printer', 5.6, 1.3);
    cap('output：display、printer', '');
  },
  async (tok, S) => { // 862.0 disk 也是 I/O
    S.dk = prop('disk', -5.4, -1.2, 1.5, 0.6); sm('disk：資料太大放這裡，也算 I/O', -3.2, -1.0);
    cap('disk 也算一種 I/O', '資料太大 memory 放不下就放 disk');
  },
  async (tok, S) => { // 884.0 organization：function unit、performance
    note('organization：每個 function unit 做什麼、快或慢', 0.9, 7.0);
    sm('例：carry ripple adder vs carry lookahead adder', 0.9, -1.8);
    cap('organization 介紹每個 function unit', '例如不同加法器：硬體、速度不同');
  },
  async (tok, S) => { // 913.0 interconnect、control、RTL
    lk(-4.4, 2.0, -1.4, 2.4, 0x6e5f49); lk(4.0, 2.6, 4.9, 4.4, 0x6e5f49);
    good('連起來 → data flow；用 RTL 描述', 0.9, -2.5);
    cap('元件連起來，data 在裡面流', '用 Register Transfer Level 描述');
  },
]);

scene('nuA-1a-arch', 'Organization 和 Architecture 不一樣', [
  async (tok, S) => { // 943.0 課叫 architecture
    hot('Computer Organization ≠ Computer Architecture', 0, 6.4);
    cap('這門課叫 Architecture', '跟 Organization 不太一樣');
  },
  async (tok, S) => { // 963.0 建築師 vs 營造商
    S.a = buddy('建築師', '設計', NC.blue, -4.2, 2.6, 0, 1.0); S.b = buddy('營造商', '施工', NC.orange, 4.2, 2.6, 0, 1.0);
    sm('幾層？幾間教室？幾個演講廳？', -4.2, 1.9); sm('照設計把房子蓋好', 4.2, 1.9);
    cap('比喻：建築師和營造商', '一個設計，一個照設計蓋出來');
  },
  async (tok, S) => { // 998.0 不同應用要不同 processor
    S.l = list(0, 5.3, 0.5); S.l.add('科學運算 → floating point 要很強'); S.l.add('影像／多媒體 → 整數運算就夠');
    cap('不同的應用要不同的 processor', '就要設計不同的 instruction');
  },
  async (tok, S) => { // 1024.0 ISA + organization
    good('Computer Architecture ＝ Instruction Set Architecture ＋ Machine Organization', 0, 0.3);
    S.a.set('ISA'); S.b.set('organization');
    cap('Architecture 介於 software 和 hardware', '＝ ISA ＋ Machine Organization');
  },
  async (tok, S) => { // 1074.0 trade-off
    note('要這樣還是那樣？成本多少？效益多少？→ trade-off', 0, -0.5); S.a.mood('wow');
    cap('Architecture 要做 trade-off', '先設計 ISA，再設計 organization');
  },
  async (tok, S) => { // 1092.0 ISA = interface
    gone(S.l); S.sw = bx('software', NC.mint, 0, 5.0, 0, 3.4, 0.6, 0.9); S.isa = bx('ISA（介面）', NC.gold, 0, 4.2, 0, 3.4, 0.5, 0.9); S.hw = bx('hardware', NC.sky, 0, 3.4, 0, 3.4, 0.6, 0.9);
    cap('ISA 是 software 和 hardware 之間的 interface', '開發 processor 時先把它設計出來');
  },
  async (tok, S) => { // 1112.0 software 照 instruction 開發
    glow(S.sw, HL); bub('我只知道有哪些 instruction', -4.2, 4.6); S.a.mood('happy');
    cap('software 的人不知道 hardware 怎麼做', '只照著 instruction 往上發展');
  },
  async (tok, S) => { // 1128.0 hardware 照 instruction 實作
    glow(S.sw, null); glow(S.hw, HL); bub('我只要把這些 instruction 做出來', 4.2, 4.6); S.b.mood('happy');
    cap('hardware 也不管 software 跑什麼', '只要能執行這些 instruction');
  },
  async (tok, S) => { // 1153.0 emulator
    glow(S.hw, null); sm('hardware 也可以用 software 的 emulator 模擬', 0, 2.5);
    cap('「hardware」不一定是真的硬體', '也可以用 emulator 模擬');
  },
]);

scene('nuA-1a-flow', '從 high-level language 到 machine language', [
  async (tok, S) => { // 1169.0 high level language
    S.c = bx('high-level language：C、Java', NC.mint, -3.0, 6.0, 0, 4.6, 0.6, 0.8); mt('a = b + c;   （示意）', 2.6, 6.0);
    cap('從 instruction set 的角度看', '先寫 high-level language，例如 C、Java');
  },
  async (tok, S) => { // 1182.0 compiler → assembly
    lk(-3.0, 5.6, -3.0, 4.75); sm('compiler', -1.9, 5.15);
    S.as = bx('assembly language', NC.lilac, -3.0, 4.4, 0, 4.6, 0.6, 0.8); mt('add $s0, $s1, $s2', 2.6, 4.4);
    cap('compiler translate 之後', '拆成一個個小 instruction：load、store、add…');
  },
  async (tok, S) => { // 1197.0 assembler → machine language
    lk(-3.0, 4.0, -3.0, 3.15); sm('assembler', -1.9, 3.55);
    S.ml = bx('machine language', NC.sky, -3.0, 2.8, 0, 4.6, 0.6, 0.8);
    const f = [[0, 6], [17, 5], [18, 5], [16, 5], [0, 5], [32, 6]]; const b = f.map(([v, n]) => v.toString(2).padStart(n, '0'));
    mt(b.join(' '), 2.2, 2.8); const hx = parseInt(b.join(''), 2).toString(16).toUpperCase().padStart(8, '0');
    ok(b.join('').length === 32 && hx === '02328020', '= 0x' + hx + '（32 bits）✓', 2.6, 2.2);
    cap('assembler 再翻成 machine language', '這一步只是直接的轉換');
  },
  async (tok, S) => { // 1210.0 ISA 決定 assembly
    note('有怎樣的 instruction set，就產生怎樣的 assembly', 0, 1.2);
    sm('不同 processor → 最後的 code 不一樣', 0, 0.6);
    cap('instruction set 決定 assembly', '不同 processor 產生的 code 不一樣');
  },
  async (tok, S) => { // 1228.0 0101 → control signals
    lk(-3.0, 2.4, -3.0, -0.1, 0xdd8238); hot('0101 → control signals → 控制 data 運作', -3.0, -0.5);
    cap('這些 0101 就變成 control signals', '控制 data 的運作');
  },
  async (tok, S) => { // 1242.0 ISA = assembly 的集合
    good('從這個角度看：instruction set ＝ assembly instruction 的集合', 2.0, -1.3);
    cap('instruction set 就是 assembly 的集合', '');
  },
]);

scene('nuA-1a-isa', 'Instruction set 規定了哪些事', [
  async (tok, S) => { // 1252.0 software 角度
    S.sw = buddy('software 的人', '', NC.mint, -5.2, 3.6, 0, 0.9); bub('看到的是 conceptual structure ＋ functional behavior', -1.0, 6.4);
    cap('從 software 的角度看', '只看概念結構和功能行為，不管怎麼實作');
  },
  async (tok, S) => { // 1266.0 三個 operand
    const b = 2, c = 3; S.c3 = list(-1.8, 5.4, 0.5); S.c3.add('三個 operand（示意 b = 2、c = 3）：', 'ptr');
    mono(S.c3.add('add a, b, c      # a = b + c = ' + (b + c)));
    sm('1 個 instruction', 3.6, 4.9);
    cap('如果 instruction 有三個 operand', '兩個加起來放到第三個，一個指令就好');
  },
  async (tok, S) => { // 1277.0 只有兩個 operand
    const b = 2, c = 3; let a = 0; a = b; a = a + c;
    S.c2 = list(-1.8, 3.9, 0.5); S.c2.add('只有兩個 operand（destination ＝ source）：', 'ptr');
    mono(S.c2.add('move a, b         # a = ' + b)); mono(S.c2.add('add  a, c         # a = a + c = ' + a));
    ok(a === b + c, '2 個 instruction，結果一樣 ' + a + ' ✓', 3.6, 3.0);
    cap('只准兩個 operand', '就要兩個 instruction，也要不同 hardware');
  },
  async (tok, S) => { // 1335.0 16 還是 32 個 register
    gone(S.c3, S.c2); S.regs = []; for (let i = 0; i < 32; i++) S.regs.push(cube('', i < 16 ? NC.sky : NC.lilac, [0.3, 0.35, 0.4], -4.6 + (i % 16) * 0.38, i < 16 ? 5.2 : 4.7, 0));
    sm('16 個 → 數量少、可能比較快；32 個 → 結構不同', 2.6, 5.9);
    cap('storage 怎麼組織：16 還是 32 個 register', '影響很大');
  },
  async (tok, S) => { // 1358.0 data encoding
    const v = 5, two = bin(-v, 8), one = inv(bin(v, 8));
    S.e = list(-1.8, 4.0, 0.5); S.e.add('data encoding：負數怎麼表示？（示意 −5，8 bits）', 'ptr');
    mono(S.e.add("2's complement：" + grp(two))); mono(S.e.add("1's complement：" + grp(one)));
    ok(sval(two) === -v && uval(two) + v === 256, "2's：反相再 +1；兩種表示 adder 設計不同 ✓", 1.0, 2.4);
    cap("負數用 2's complement 還是 1's complement？", '表示法不同，加減的硬體就不同');
  },
  async (tok, S) => { // 1380.0 有沒有乘法 instruction
    gone(S.e); const a = 6, n = 4; let s = 0; for (let k = 0; k < n; k++) s += a;
    S.m = list(-1.8, 4.0, 0.5); S.m.add('有沒有乘法 instruction？', 'ptr');
    S.m.add('有 → 要一個很大的乘法器（hardware、resource）'); S.m.add('沒有 → 用加減模擬，示意 6×4 = 6+6+6+6');
    ok(s === a * n, n + ' 次加法 = ' + s + ' ✓（但要很多 cycle）', 1.0, 2.4);
    cap('不常用乘法，可能不設乘法 instruction', '代價是要很多 cycle、很多時間');
  },
  async (tok, S) => { // 1422.0 format、addressing
    gone(S.m); S.l = list(-1.8, 4.0, 0.5); S.l.add('instruction format：bits 怎麼排', 'ptr'); S.l.add('怎麼拿 data（addressing）', 'ptr');
    cap('還要規定 instruction format', '以及怎麼拿到 data');
  },
  async (tok, S) => { // 1432.0 MIPS R3000
    hot('本課範例：MIPS R3000 instruction set', 1.0, 2.6); sm('先學 instruction set，再看 hardware 怎麼建', 1.0, 2.0);
    cap('這門課用 MIPS R3000 當範例', '先介紹 ISA，再看 hardware 怎麼做');
  },
  async (tok, S) => { // 1458.0 只有三種 format
    const F = [['R', [['op', 6], ['rs', 5], ['rt', 5], ['rd', 5], ['shamt', 5], ['funct', 6]]], ['I', [['op', 6], ['rs', 5], ['rt', 5], ['immediate', 16]]], ['J', [['op', 6], ['address', 26]]]];
    F.forEach(([n, fs], r) => { let x = -5.0; hd(n, -5.8, 0.9 - r * 0.75); fs.forEach(([nm, w]) => { const W = w * 0.34; bx(nm + ' ' + w, r === 0 ? NC.sky : r === 1 ? NC.mint : NC.lilac, x + W / 2, 0.9 - r * 0.75, 0, W - 0.04, 0.5, 0.6); x += W; }); });
    ok(F.every(([, fs]) => fs.reduce((s, [, w]) => s + w, 0) === 32), '三種 format 都剛好 32 bits ✓', 4.6, 1.6);
    cap('MIPS 只有三種 format', '就把所有 instruction 描述完');
  },
], [[0, 3.8, 14], [0, 3.0, 0]]);

scene('nuA-1a-isas', 'Intel（CISC）和 ARM（RISC）', [
  async (tok, S) => { // 1473.0 很多 ISA；Intel、ARM
    hot('現在最 popular 的兩個 ISA：Intel 和 ARM', 0, 6.4);
    cap('instruction set architecture 很多種', '現在最 popular 的是 Intel 和 ARM');
  },
  async (tok, S) => { // 1489.0 Intel 版本
    S.x = ['286', '386', '486', '…', 'IA-64'].map((t, i) => bx(t, NC.sky, -5.2 + i * 1.2, 4.6, 0, 1.0, 0.5, 0.7));
    sm('Intel：每一版加更多 instruction（也就要加 hardware）', -2.8, 3.9);
    cap('Intel：PC 常用，286、386 到 IA-64', '每一版加更多 instruction');
  },
  async (tok, S) => { // 1509.0 ARM
    S.arm = bx('ARM（已到第 8 版）', NC.mint, 3.6, 4.6, 0, 3.0, 0.5, 0.7); sm('手機裡大概 90% 都是 ARM', 3.6, 3.9);
    cap('ARM 用在哪裡？手機', '手機用 ARM，不是 Intel 的 x86');
  },
  async (tok, S) => { // 1535.0 CISC / RISC
    S.cs = bx('CISC：Complex Instruction Set Computer', NC.sky, -2.8, 2.4, 0, 5.4, 0.6, 0.8);
    S.rs = bx('RISC：Reduced Instruction Set Computer', NC.mint, 2.8, 1.4, 0, 5.4, 0.6, 0.8);
    sm('Intel', -2.8, 3.0); sm('ARM、MIPS（同屬 RISC，細節不同）', 2.8, 0.7);
    cap('兩大陣營：Intel 是 CISC，ARM 是 RISC', '我們的 MIPS 也是 RISC 這一類');
  },
  async (tok, S) => { // 1567.0 為什麼要學
    good('變化很快、而且到處都有 processor → 學會就能設計 processor', 0, -0.5);
    cap('為什麼要學 Computer Architecture？', '變化快、無所不在，學完就會設計 processor');
  },
]);

scene('nuA-1a-prereq', '上課範圍與先修：邏輯設計', [
  async (tok, S) => { // 1880.0 照課本章節
    S.l = list(-3.2, 5.6, 0.55); hd('大致照課本次序', -3.2, 6.3);
    ['1 Computer Abstractions and Technology', '2 Instructions', '3 Arithmetic', '4 The Processor', '5 Memory Hierarchy'].forEach((t) => S.l.add(t));
    sm('（過去進度大約到 memory）', -3.2, 2.6);
    cap('上課大致照課本章節次序', '過去的進度大概到 memory');
  },
  async (tok, S) => { // 1906.0 先修：邏輯設計
    hot('先修：Logic Design（邏輯設計）', 3.0, 5.6);
    cap('這門課需要邏輯設計的基礎', '沒修過要自己努力補起來');
  },
  async (tok, S) => { // 1931.0 加法器、latch、control、mux
    S.k = ['adder', 'latch', 'control', 'mux'].map((t, i) => bx(t, NC.lilac, 1.4 + (i % 2) * 2.2, 4.4 - Math.floor(i / 2) * 0.8, 0, 1.9, 0.55, 0.7));
    cap('剛才用到的 adder、latch、control、mux', '都是邏輯設計的東西');
  },
  async (tok, S) => { // 1946.0 number representation
    const v = 6; mt("例：−" + v + " = " + grp(inv(bin(v, 8))) + "（1's）", 2.6, 2.3); mt("     = " + grp(bin(-v, 8)) + "（2's）", 2.6, 1.8);
    ok(sval(bin(-v, 8)) === -v, "number representation：1's、2's complement 要補起來 ✓", 2.2, 1.0);
    cap("還有 number representation", "1's complement、2's complement 都要會");
  },
]);

// ════════ y76BZn5u-b4（第 2A 講：Computer's History） ════════
// a year axis: x = X(year)
function yearAxis(y0, y1, yy = 0.2, xa = -6.0, xb = 6.0) {
  const X = (yr) => xa + (xb - xa) * (yr - y0) / (y1 - y0);
  seg(xa, yy, xb, yy, '#8a7a5c'); return X;
}
function yearMark(X, yr, text, row = 0, cls = 'idx', yy = 0.2) { cube('', NC.gold, [0.12, 0.3, 0.12], X(yr), yy + 0.15, 0); sm(String(yr), X(yr), yy - 0.45); return tag(text, cls, X(yr), yy + 0.9 + row * 0.6); }

scene('nuA-2a-outline', '本單元三個主題：歷史、abstraction、technology 與 performance', [
  async (tok, S) => { // 5.6 三個部分
    S.c = [['① 歷史', NC.sky], ['② Abstraction', NC.mint], ['③ Technology', NC.lilac]].map(([t, c], i) => bx(t, c, -4.2 + i * 4.2, 5.8, 0, 3.4, 0.6, 0.8));
    cap('Computer Abstractions and Technology', '這個單元有三個部分');
  },
  async (tok, S) => { // 6.5 歷史
    sm('computer 怎麼從最開始演進到現在', -4.2, 5.0); glow(S.c[0], HL);
    cap('第一部分：computer 發展的歷史', '');
  },
  async (tok, S) => { // 48.6 abstraction
    glow(S.c[0], null); glow(S.c[1], HL); sm('每一層把下面的 detail 藏起來', 0, 5.0);
    cap('第二：abstraction', '每一層把下面的複雜細節 hide 住');
  },
  async (tok, S) => { // 65.2 technology
    glow(S.c[1], null); glow(S.c[2], HL); S.l = list(4.2, 5.0, 0.5); S.l.add('隨 technology 發展');
    cap('第三：technology', '');
  },
  async (tok, S) => { // 74.9 performance 指標
    S.l.add('定 performance 指標：好還是壞？', 'ptr');
    cap('要衡量電腦好壞', '就要定一些 performance 指標');
  },
  async (tok, S) => { // 83.2 CPU time
    S.l.add('CPU time（很重要）');
    cap('CPU time 是很重要的指標', '');
  },
  async (tok, S) => { // 87.9 power
    S.l.add('power（也很重要）');
    cap('power 也是重要指標', '');
  },
  async (tok, S) => { // 94.6 benchmarking
    S.l.add('profiling、benchmarking');
    cap('有了指標，怎麼衡量好壞？', 'profiling、benchmarking');
  },
  async (tok, S) => { // 102.1 cost
    S.l.add('cost vs performance：trade-off');
    cap('最後看 cost', 'cost 越高 performance 可能越好，是個 trade-off');
  },
  async (tok, S) => { // 115.5 今天先講歷史
    glow(S.c[2], null); glow(S.c[0], HL); good('今天先專注在第一個主題：歷史', -4.2, 3.6);
    cap('今天先專注第一個主題', 'computer 怎麼來的');
  },
]);

scene('nuA-2a-whatis', '什麼是 computer？Harvard Mark I', [
  async (tok, S) => { // 124.4 算盤
    S.ab = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) S.ab.push(cube('', NC.dark, [0.32, 0.32, 0.32], -5.6 + c * 0.45, 4.2 + r * 0.55, 0));
    bx('', NC.tan, -4.5, 5.6, 0, 3.0, 0.12, 0.5); bx('', NC.tan, -4.5, 3.8, 0, 3.0, 0.12, 0.5); sm('算盤（中國，很早就有）', -4.5, 3.2);
    cap('電腦什麼時候出現的？', '中國很早就有算盤，可以幫忙計算');
  },
  async (tok, S) => { // 141.6 不是 computer
    bad('算盤 ≠ computer（插電也不算）', -4.5, 2.5);
    cap('算盤是 computer 嗎？不是', '也不是插了電就叫 computer');
  },
  async (tok, S) => { // 155.3 programmable
    S.d = list(2.0, 6.2, 0.55); S.d.add('dictionary：computer 是', 'ptr'); S.d.add('① programmable（可以改程式做不同事）', 'ptr alt');
    cap('字典說：computer 是 programmable 的', '可以隨需求改變它的動作');
  },
  async (tok, S) => { // 170.1 electronic machine
    S.d.add('② electronic machine'); S.d.add('③ 高速的數學、邏輯運算'); S.d.add('④ 收集、儲存、分析資料');
    cap('是一台 electronic machine', '高速運算，也能儲存、分析資料');
  },
  async (tok, S) => { // 184.6 之前已有很多計算裝置
    S.k = list(2.0, 3.2, 0.45); S.k.add('在那之前已有各種計算裝置：', 'ptr'); S.k.add('general / special purpose、programmable 或不行'); S.k.add('科學計算或 data processing；機械、機電、電子');
    cap('在第一台 computer 之前', '歷史上已有各式各樣的計算裝置');
  },
  async (tok, S) => { // 205.1 例子
    gone(S.ab); S.m1 = bx('做 difference 的機器', NC.sand, -4.5, 1.4, 0, 2.8, 0.5, 0.7); S.m2 = bx('記帳的機器', NC.sand, -4.5, 0.6, 0, 2.8, 0.5, 0.7);
    cap('例如做 difference 的機器', '還有做記帳的機器');
  },
  async (tok, S) => { // 211.4 Harvard Mark I
    gone(S.m1, S.m2, S.d, S.k); S.hv = bx('Harvard Mark I（1944）', NC.gold, 0, 5.8, 0, 4.0, 0.6, 0.8); sm('general purpose，機械 ＋ 電子', 0, 5.1);
    cap('很重要的一台：Harvard Mark I', 'general purpose、機械和電子的裝置');
  },
  async (tok, S) => { // 229.3 instruction、data 分開
    S.im = bx('instruction memory', NC.lilac, -3.2, 3.0, 0, 3.0, 0.7, 0.8); S.dm = bx('data memory', NC.mint, 3.2, 3.0, 0, 3.0, 0.7, 0.8);
    S.cpu = prop('cpu', 0, 1.0, 0, 0.9); lk(-1.7, 2.8, -0.6, 1.5); lk(1.7, 2.8, 0.6, 1.5);
    cap('它的 instruction 和 data 分開儲存', '');
  },
  async (tok, S) => { // 244.0 Harvard architecture
    good('instruction 和 data 放在不同 memory → Harvard architecture', 0, -0.4);
    cap('這種設計叫 Harvard architecture', '現在的設計還在用這個名字');
  },
]);

scene('nuA-2a-eniac', 'ENIAC：第一部全電子、可程式的通用電腦', [
  async (tok, S) => { // 260.5 第一部全電子
    hot('第一部「全電子、可程式、general purpose」的電腦？', 0, 6.4);
    cap('第一部全電子、可程式的一般用途電腦', '什麼時候發展出來的？');
  },
  async (tok, S) => { // 274.8 ENIAC 1943–1946
    S.X = yearAxis(1938, 1950, 0.2); S.e1 = yearMark(S.X, 1943, 'ENIAC 開始'); S.e2 = yearMark(S.X, 1946, '完成', 0, 'good');
    sm('University of Pennsylvania 的 project', 0, 5.6);
    cap('ENIAC：1943 年在 U Penn 開始', '一直到 1946 年才完成');
  },
  async (tok, S) => { // 290.2 二次大戰
    S.w = bx('第二次世界大戰 1939–1945', NC.rose, (S.X(1939) + S.X(1945)) / 2, 2.4, 0, S.X(1945) - S.X(1939), 0.4, 0.5);
    sm('老師：破解密碼要大量運算（ENIAC 實際是算火砲射表）', S.X(1942), 3.1);
    cap('那時候正在打二次世界大戰', '戰爭需要大量運算（ENIAC 原本是算彈道射表）');
  },
  async (tok, S) => { // 322.4 25 公尺
    gone(S.w, S.e1, S.e2); S.track = vbar(NC.tan, 0, 0.15, 12.0, 4.6, 0.4); sm('100 m 跑道', -5.2, 5.1);
    S.en = bx('ENIAC 25 m', NC.gold, -6 + 12 * 25 / 100 / 2, 4.1, 0, 12 * 25 / 100, 0.5, 0.6);
    ok(25 / 100 === 0.25, '25 m ÷ 100 m = 1/4 個跑道 ✓', 2.4, 4.1);
    cap('第一台電腦長 25 公尺', '是 100 公尺跑道的四分之一');
  },
  async (tok, S) => { // 334.9 2.5 公尺高
    S.tall = vbar(NC.gold, -4.0, 2.5, 0.9, 0.3); S.man = vbar(NC.sky, -2.8, 1.7, 0.6, 0.3);
    sm('ENIAC 2.5 m', -4.0, 3.2); sm('人 170 cm', -2.8, 2.4); ok(2.5 > 1.7, '2.5 m 比 170 cm 的人還高 ' + Math.round((2.5 - 1.7) * 100) + ' cm ✓', 1.0, 2.4);
    cap('高 2.5 公尺', '比 170 公分的同學還高');
  },
  async (tok, S) => { // 343.5 真空管
    S.tube = []; for (let i = 0; i < 6; i++) S.tube.push(cube('', '#f3e3b0', [0.3, 0.6, 0.3], 3.2 + i * 0.5, 0.6, 0));
    sm('vacuum tube（真空管）當 switch', 4.4, 1.4);
    cap('用真空管當 switch', 'switch 是組成電腦最重要的元件');
  },
  async (tok, S) => { // 357.9 1900 個加法
    hot('每秒 1,900 個加法', 4.4, 2.2);
    cap('速度：每秒可以執行 1900 個加法', '');
  },
  async (tok, S) => { // 363.1 programming 靠 cable 與 switch
    S.cb = buddy('programmer', '', NC.pink, -0.6, 0.3, 1.2, 0.6); bub('把 cable、switch 搬來搬去 ＝ programming', 0.4, 5.6);
    cap('programming 不是寫程式', '是靠人去調整 cable 和 switch');
  },
  async (tok, S) => { // 396.1 電晶體
    gone(S.tube); S.tr = bx('transistor（電晶體）', NC.blue, 4.4, 0.6, 0, 2.8, 0.5, 0.7); sm('比真空管 reliable', 4.4, 1.3);
    cap('差不多同時發明了電晶體', '跟真空管比，比較 reliable');
  },
  async (tok, S) => { // 415.5 switch → IC
    sm('下一個時期：transistor 當 switch → 後來變成 IC', 2.0, -0.6);
    cap('之後用 transistor 當 switch', '再和其他元件做成 IC');
  },
]);

scene('nuA-2a-ic', '50 年代商品化、IBM、Integrated Circuit', [
  async (tok, S) => { // 428.1 50 年代商品化
    S.X = yearAxis(1945, 1965, 0.2); S.y50 = yearMark(S.X, 1950, '電腦開始商品化');
    S.room = zone('專門的房間（冷氣、溫度很重要）', -3.0, 2.6, 0, 5.0, 1.6, '#e6dcc8'); S.big = bx('很貴、很大台', NC.sand, -3.0, 3.0, 0, 2.6, 0.7, 0.9);
    cap('50 年代電腦開始商品化', '很貴、很大台，要專門的房間');
  },
  async (tok, S) => { // 442.9 用途
    sm('用途：商務辦公室自動化、科學計算', -3.0, 4.0);
    cap('主要用在商務、辦公室自動化', '或是科學計算');
  },
  async (tok, S) => { // 459.3 IBM 1401
    yearMark(S.X, 1959, 'IBM 1401（電晶體電腦）', 1, 'ptr alt');
    cap('50 年代也出現用電晶體的電腦', '例如 IBM 1401');
  },
  async (tok, S) => { // 472.9 IBM 原本做 punch card
    S.card = bx('', '#f6efd2', 3.4, 4.8, 0, 3.2, 1.4, 0.06);
    S.holes = []; const pat = '10110010'; [...pat].forEach((b, i) => S.holes.push(cube(b === '1' ? '●' : '', b === '1' ? NC.dark : '#f6efd2', [0.28, 0.28, 0.08], 2.1 + i * 0.37, 4.8, 0.06)));
    sm('punch card（打孔卡）', 3.4, 5.8);
    cap('IBM 一開始只做 punch card', '以前寫程式、輸入 data 都要打卡片');
  },
  async (tok, S) => { // 489.5 打洞 → 光透過去或不透
    mt('有洞 1、沒洞 0（示意）：10110010', 3.4, 3.7);
    cap('每個位置打洞或不打', '光透過去或不透過去 → 1 或 0');
  },
  async (tok, S) => { // 510.8 Big Blue
    sm('IBM 50 年代才開始做電腦，人稱 Big Blue', 3.4, 3.1);
    cap('IBM 常被稱為 Big Blue', '');
  },
  async (tok, S) => { // 522.3 Integrated Circuit
    gone(S.room, S.big, S.card, S.holes); hot('Integrated Circuit（IC）的出現', 0, 6.4);
    cap('這個時期另一件大事', 'Integrated Circuit（IC）出現');
  },
  async (tok, S) => { // 527.0 discrete components
    S.dc = [['T', NC.blue], ['R', NC.orange], ['C', NC.green], ['T', NC.blue], ['R', NC.orange]].map(([t, c], i) => bx(t, c, -5.4 + i * 1.3, 4.0, 0, 0.7, 0.6, 0.7));
    for (let i = 0; i < 4; i++) seg(-5.05 + i * 1.3, 4.0, -4.75 + i * 1.3, 4.0, '#6e5f49', 0.2);
    sm('discrete：transistor、電阻 R、電容 C 一個一個接 → 很佔空間', -2.8, 3.2);
    cap('有了 transistor，還要電阻、電容', '一個一個 discrete component 接起來很佔空間');
  },
  async (tok, S) => { // 550.0 single semiconductor
    S.chip = bx('IC chip：全部做在一塊半導體上', NC.metal, 3.6, 4.0, 0, 3.4, 0.4, 1.6);
    for (const m of S.dc) { const x0 = m.position.x; await slide(tok, m, 3.0 + (x0 + 5.4) * 0.3, 4.4, 0, 160); m.scale.set(0.35, 0.35, 0.35); }
    cap('IC：transistor、電阻、電容', '全部做在一個 single semiconductor 上');
  },
  async (tok, S) => { // 571.5 shrink
    good('不用外接 → size 可以一直 shrink', 3.6, 2.6);
    cap('不用再外接', 'size 可以一直縮小，小到手碰不到');
  },
  async (tok, S) => { // 605.7 更多 device → 更大 computation power；1958
    yearMark(S.X, 1958, 'IC 發明（1958）', 0, 'ptr alt');
    cap('一個 chip 放更多 device', '就有更大的 computation power');
  },
]);

scene('nuA-2a-pc', 'Microprocessor、PC 與 open system', [
  async (tok, S) => { // 618.3 Intel 4004
    S.X = yearAxis(1968, 1984, 0.2); yearMark(S.X, 1971, 'Intel 4004 microprocessor', 0, 'ptr alt');
    cap('70 年代：很多 transistor 放進一顆 IC', '最重要的是 Intel 4004 微處理器');
  },
  async (tok, S) => { // 634.5 用在計算機，12 → 1
    S.ch = []; for (let i = 0; i < 12; i++) S.ch.push(cube('', NC.metal, [0.4, 0.15, 0.4], -5.6 + (i % 6) * 0.55, 4.6 + Math.floor(i / 6) * 0.55, 0));
    sm('原本要 12 顆 chip', -4.2, 3.9);
    for (const m of S.ch) await slide(tok, m, -0.6, 4.9, 0, 70);
    gone(S.ch); S.one = bx('1 顆 microprocessor', NC.metal, -0.6, 4.9, 0, 2.6, 0.3, 0.9); good('整合成一顆 → 便宜', -0.6, 4.2);
    cap('第一顆微處理器用在計算機上', '原本 12 顆 chip 整合成 1 顆，便宜');
  },
  async (tok, S) => { // 651.3 Apple II 1977
    yearMark(S.X, 1977, 'Apple II', 0, 'ptr'); S.ap = prop('monitor', 3.4, 4.0, 0, 0.7, 'Apple II');
    cap('有了 microprocessor 就有 PC', '1977 年 Apple II');
  },
  async (tok, S) => { // 668.7 IBM PC 1981
    yearMark(S.X, 1981, 'IBM PC', 1, 'ptr'); ok(1981 - 1977 === 4, 'IBM PC 晚了 1981 − 1977 = 4 年 ✓', 2.6, 2.6);
    cap('IBM PC 晚了四年', '1981 年才出來');
  },
  async (tok, S) => { // 705.0 Microsoft
    sm('PC 也造就了 Microsoft（OS）；1980 年代～2000 年 dominate PC 市場', 0, -0.6);
    cap('PC 也造就了微軟', '兩者在 1980～2000 年 dominate PC 市場');
  },
  async (tok, S) => { // 720.2 為什麼 IBM PC 贏？
    S.q = hot('Apple II 早 4 年，為什麼後來大多是 IBM PC？', 0, 6.4); bub('便宜！', -4.0, 5.6);
    cap('為什麼後來大部分 PC 是 IBM 架構？', '同學說：相對便宜');
  },
  async (tok, S) => { // 764.6 open system
    good('IBM PC 是 open system：spec 全部公開', -2.4, 2.8); sm('誰都能做相容的零件（例如臺灣周邊產業）', -2.4, 2.2);
    cap('它是一個 open system', 'spec 全公開，大家都能參加、都能賺錢');
  },
  async (tok, S) => { // 818.9 手機：Android vs Apple
    sm('現在手機：Android（open）vs Apple（closed）', -2.4, 1.4);
    cap('現在手機也有兩種', 'Android 開放、Apple 封閉，誰成功還不知道');
  },
  async (tok, S) => { // 840.6 Xerox Alto
    gone(S.q); S.alto = list(-5.0, 6.2, 0.48); S.alto.add('Xerox 實驗性 PC：Alto（1973）', 'ptr alt'); S.alto.add('mouse、Ethernet'); S.alto.add('graphics、icon、menu'); S.alto.add('What you see is what you get 編輯');
    cap('70 年代 Xerox 的實驗 PC：Alto', 'mouse、Ethernet、icon、menu 都已出現');
  },
  async (tok, S) => { // 873.5 LAN、laser printer
    S.alto.add('local area network、laser printer'); S.alto.add('→ 今天用的很多東西 1973 年就有原型');
    cap('還有 LAN、laser printer', '很多現在用的東西當時就有 prototype');
  },
]);

scene('nuA-2a-risc', '應用軟體讓 PC 好用；VLSI 與 RISC', [
  async (tok, S) => { // 886.0 軟體才讓它好用
    S.hw = bx('hardware（很 powerful）', NC.sky, -3.6, 5.6, 0, 3.6, 0.6, 0.8); S.app = bx('application software', NC.mint, -3.6, 6.4, 0, 3.6, 0.6, 0.8);
    cap('真的讓 PC 好用的不是硬體', '是軟體，一定要有應用程式');
  },
  async (tok, S) => { // 903.0 1979 記帳軟體
    S.X = yearAxis(1975, 1990, 0.2); yearMark(S.X, 1979, '第一個電腦記帳（試算表）軟體', 0, 'ptr alt');
    cap('1979 年：第一個用電腦記帳的軟體', '記帳變容易，PC 才真正 popular');
  },
  async (tok, S) => { // 919.4 dBase
    yearMark(S.X, 1981, 'dBase（database）', 1); good('hardware ＋ application 才會越來越發展', -3.6, 4.8);
    cap('之後有 dBase 做 database', '硬體加上應用，兩個一起才會發展');
  },
  async (tok, S) => { // 935.9 80 年代 RISC
    yearMark(S.X, 1985, 'RISC 進入 computer 領域', 0, 'ptr');
    cap('80 年代：新的 architecture', 'RISC 進入 computer 領域');
  },
  async (tok, S) => { // 949.1 VLSI
    S.v = bx('VLSI：一顆 chip 好幾十萬個 transistor', NC.lilac, 2.8, 5.6, 0, 5.4, 0.6, 0.8);
    cap('因為進入 VLSI 時代', 'very large scale integration：一顆晶片幾十萬個 transistor');
  },
  async (tok, S) => { // 970.1 三個人
    S.p = [['Cocke', 'IBM'], ['Patterson', 'UC Berkeley'], ['Hennessy', 'Stanford']].map(([n, w], i) => { const b = buddy(n, w, [NC.sky, NC.mint, NC.pink][i], 1.0 + i * 1.9, 2.0, 0, 0.7); return b; });
    sm('Patterson、Hennessy ＝ 我們課本的作者', 2.9, 1.4);
    cap('Cocke、Patterson、Hennessy 三人', '提出 RISC：Reduced Instruction Set Computer');
  },
  async (tok, S) => { // 992.7 commercial workstation
    sm('商用：workstation（MIPS、Sun、IBM…）', -3.6, 3.6);
    cap('不只是學術', '很多 commercial processor 用 RISC，主要在 workstation');
  },
  async (tok, S) => { // 1010.6 CISC
    sm('對手：CISC（Complex Instruction Set Computer）→ PC 的 Intel x86', -1.0, -0.6);
    cap('RISC 是跟誰比？CISC', 'CISC 用在 PC：Intel x86 系列');
  },
]);

scene('nuA-2a-moore', '後 PC 時代與 Moore\'s Law', [
  async (tok, S) => { // 1033.5 PC 越來越快
    S.pc = prop('monitor', -4.6, 3.6, 0, 0.8, 'PC'); sm('PC 越來越 high-end；workstation 越來越少人用', -2.0, 6.3);
    cap('80 年代之後 PC 越來越快', '大家只要一台 PC 就好');
  },
  async (tok, S) => { // 1052.3 後 PC 時代 embedded
    S.em = ['冰箱', '相機', '攝影機', '手機', '手錶'].map((t, i) => bx(t, NC.mint, -1.4 + i * 1.5, 4.2, 0, 1.3, 0.5, 0.7));
    sm('post-PC era：embedded computer 無所不在', 1.6, 3.5);
    cap('後 PC 時代：embedded computer', '冰箱、相機、手機、手錶裡都有 computer');
  },
  async (tok, S) => { // 1087.9 不到 60 年
    sm('從 40 年代到現在不到 60 年，發展非常快', 0, 2.6);
    cap('從 40 年代到現在不到 60 年', 'computer 發展非常快速');
  },
  async (tok, S) => { // 1101.1 Moore's law
    hot("背後支撐的定律：Moore's Law", 0, 1.8);
    cap('支撐這個發展的定律', "Moore's Law");
  },
  async (tok, S) => { // 1115.1 每 1.5 年 double
    gone(S.em, S.pc); S.bars = []; const H = 0.16; let v = 1;
    for (let k = 0; k < 6; k++) { S.bars.push(vbar(NC.blue, -4.5 + k * 1.3, v * H, 0.8, -0.6 + 1.6)); sm(k * 1.5 + ' 年', -4.5 + k * 1.3, 0.4); v *= 2; }
    ok(v / 2 === 2 ** 5, '每 1.5 年 ×2：7.5 年後 2⁵ = 32 倍（示意）✓', 1.5, 7.0);
    cap('每一年半，一顆 chip 上的 transistor', '就可以 double');
  },
  async (tok, S) => { // 1123.9 同樣面積、同樣成本
    sm('同樣面積、同樣成本 → 更強的 computation power、更便宜', 1.0, 6.3);
    cap('同樣的面積、同樣的成本', '就有更強大的 computation power');
  },
  async (tok, S) => { // 1145.6 到處都用
    sm('車子、手機、基因研究、web search 都要用', 1.0, -0.5);
    cap('越來越便宜，什麼地方都用得到', '車子、手機、基因研究、search engine');
  },
]);

scene('nuA-2a-feature', 'Feature size：transistor 越縮越小', [
  async (tok, S) => { // 1175.9 為什麼可以 double？
    mos(S, 0, 0.2); S.t1 = hot('為什麼 transistor 數量可以 double？', 0, 6.4);
    cap('為什麼可以 double？', '回到一開始的 transistor');
  },
  async (tok, S) => { // 1192.2 gate 電壓 → channel
    S.ch = bx('channel', '#6fb3f0', 0, 1.15, 0.85, 3.2, 0.14, 0.2); S.L = [hd('source', -2.4, 2.2), hd('drain', 2.4, 2.2)];
    cap('gate 有電壓，下面形成 channel', 'source、drain 之間就有電流：開');
  },
  async (tok, S) => { // 1217.0 距離越短越快
    S.ar = lk(-1.55, 0.45, 1.55, 0.45, 0xd64545, 0.9); S.ar2 = lk(1.55, 0.45, -1.55, 0.45, 0xd64545, 0.9); S.L.push(hot('這段距離越短 → 開關越快', 0, -0.5));
    cap('開和關要從這邊到那邊', '距離越短，開關就越快');
  },
  async (tok, S) => { // 1241.3 跟 technology 有關
    S.L.push(sm('能做多短？看 technology', 0, 3.4));
    cap('當然希望越短越好', '可是能做多短，跟 technology 有關');
  },
  async (tok, S) => { // 1258.4 feature size
    S.L.push(good('這個最短長度 ＝ feature size（line width）', 0, 4.0));
    cap('這個距離叫 feature size', '也叫 line width');
  },
  async (tok, S) => { // 1305.8 一直減小
    gone(S.body, S.bodyL, S.ns, S.ox, S.gate, S.ch, S.ar, S.ar2, S.L); S.L = [];
    S.fs = [100, 50, 10, 1, 0.25, 0.028].map((um, i) => { const h = Math.max(0.15, Math.log10(um * 100) * 0.9); const b = vbar(NC.orange, -4.8 + i * 1.6, h, 0.9, 0.0); S.L.push(sm(um + ' µm', -4.8 + i * 1.6, h + 0.4)); return b; });
    S.L.push(sm('（log 刻度，中間幾代為示意）', 0, -0.5));
    cap('隨 technology 進步，feature size 一直減小', '從最早的 100 micron 一路往下');
  },
  async (tok, S) => { // 1314.6 台積電 28 nm
    glow(S.fs[5], HL); S.L.push(hot('台積電量產：28 nm', 3.2, 4.4));
    cap('台積電已宣佈可以量產', '28 奈米（nm）');
  },
  async (tok, S) => { // 1355.4 0.028 micron
    S.L.push(ok(Math.abs(28 / 1000 - 0.028) < 1e-12, '28 nm = 28 ÷ 1000 µm = 0.028 µm ✓', 3.2, 3.8));
    cap('28 nm 是多少 micron？', '0.028 micron');
  },
  async (tok, S) => { // 1365.8 頭髮 100 micron
    const r = Math.round(100 / 0.028); S.L.push(ok(r === 3571, '頭髮約 100 µm：100 ÷ 0.028 ≈ ' + fmtN(r) + ' 倍 ✓', 3.2, 3.2));
    cap('一根頭髮大約 100 micron', '0.028 micron 細了三千多倍');
  },
  async (tok, S) => { // 1404.1 放很多 transistor
    gone(S.t1); S.L.push(sm('這麼小 → 一個 chip 放很多很多 transistor', 0, 6.4));
    cap('transistor 這麼小', '一顆 chip 可以放非常多個');
  },
  async (tok, S) => { // 1431.9 transistor 數量圖
    gone(S.fs, S.L); S.tc = []; let v = 1; for (let k = 0; k < 6; k++) { S.tc.push(vbar(NC.blue, -5 + k * 2, 0.15 * v, 0.8, 0.3)); v *= 2; }
    S.tc.push(sm('時間 → 一顆 microprocessor 的 transistor 越來越多（示意）', 0, -0.3));
    cap('這張圖：橫軸時間、縱軸 transistor 數', '越來越多 transistor 放進一顆 chip');
  },
  async (tok, S) => { // 1444.9 1965 Moore
    gone(S.tc); hd('1965 年：Gordon Moore（Intel co-founder）的 prediction', 0, 5.4);
    cap('Moore 是 Intel 的 co-founder', '1965 年觀察前十多年的發展做出預測');
  },
  async (tok, S) => { // 1476.5 每 18 個月
    const m = 18; ok(m / 12 === 1.5, "Moore's Law：每 18 個月（1.5 年）transistor double ✓", 0, 4.6);
    sm('（Moore 1965 年原本說每年加倍，1975 年改成每兩年；課本寫每 18～24 個月）', 0, 3.9);
    cap('每 18 個月 transistor 就 double', '老師的說法；課本：每 18～24 個月');
  },
]);

scene('nuA-2a-classes', '電腦分三類：desktop、server、embedded', [
  async (tok, S) => { // 1511.1 分類
    hot('把 computer 分類', 0, 6.4);
    cap('看完歷史，把電腦分類', '');
  },
  async (tok, S) => { // 1519.9 desktop
    S.d = prop('monitor', -4.6, 3.4, 0, 0.8, 'desktop / notebook');
    cap('第一類：desktop computer', '你的 PC、notebook，個人用');
  },
  async (tok, S) => { // 1528.3 server
    S.s = []; for (let i = 0; i < 4; i++) S.s.push(bx('▤▤', NC.metal, 0, 3.6 + i * 0.5, 0, 1.8, 0.42, 1.0)); sm('server', 0, 6.0);
    cap('第二類：server', '更大、更 high-end，例如系上或科學計算用');
  },
  async (tok, S) => { // 1539.1 embedded
    S.e = prop('cpu', 4.6, 3.8, 0, 0.8); sm('embedded（藏在裝置裡）', 4.6, 5.0);
    cap('第三類：embedded computer', '嵌在各種裝置裡，隨處可見');
  },
  async (tok, S) => { // 1556.6 desktop 特性
    S.l1 = list(-4.6, 2.6, 0.45); S.l1.add('general purpose', 'ptr'); S.l1.add('看 cost / performance');
    cap('desktop：general purpose', '買的時候看 cost 和 performance');
  },
  async (tok, S) => { // 1592.4 server 特性
    S.l2 = list(0, 2.6, 0.45); S.l2.add('capacity 大', 'ptr'); S.l2.add('performance 重要'); S.l2.add('reliability 更重要（不能當機）');
    cap('server：大家共用', 'capacity、performance，更重要的是 reliability');
  },
  async (tok, S) => { // 1627.1 小 server 到 building size
    S.l2.add('小 server ～ building-size');
    cap('從小 server 到整棟 building 大小的都有', '');
  },
  async (tok, S) => { // 1632.5 embedded 特性
    S.l3 = list(4.6, 2.6, 0.45); S.l3.add('系統裡的一個小 component', 'ptr'); S.l3.add('power、performance、cost'); S.l3.add('cost、power 特別重要');
    cap('embedded：只是系統裡的一個小 component', 'power、performance、cost 都重要，尤其 cost');
  },
  async (tok, S) => { // 1666.6 電池有限
    S.l3.add('手持裝置電池有限 → low power');
    cap('power 也很重要', '戴在手上的裝置電池有限');
  },
]);

scene('nuA-2a-drive', '推動電腦發展的力量', [
  async (tok, S) => { // 1685.9 進展的要點
    hot('computer 的 progress：幾個重要的推力', 0, 6.4);
    cap('電腦是怎麼一路發展過來的？', '有幾個重要的點');
  },
  async (tok, S) => { // 1700.6 application drives balance
    hd('① application 推動 machine 平衡發展', -3.0, 5.6);
    cap('application 決定 computer 怎麼發展', '不同應用有不同需求');
  },
  async (tok, S) => { // 1718.9 numerical simulation
    S.a = [bx('科學計算', NC.sky, -4.6, 4.4, 0, 2.4, 0.5, 0.7)]; sm('floating point、memory bandwidth', -4.6, 3.8);
    cap('numerical simulation、科學計算', '要 floating point，還要很大的 memory bandwidth');
  },
  async (tok, S) => { // 1752.3 transaction
    S.a.push(bx('transaction', NC.mint, -0.8, 4.4, 0, 2.4, 0.5, 0.7)); sm('I/O、integer 運算', -0.8, 3.8);
    cap('transaction processing：銀行、提款、上網', 'I/O 和 integer 運算很重要');
  },
  async (tok, S) => { // 1772.4 media 8-bit pixel
    S.a.push(bx('media', NC.lilac, 3.0, 4.4, 0, 2.4, 0.5, 0.7)); ok(2 ** 8 === 256, 'pixel 8 bits → 0～255，共 256 級 ✓', 3.0, 3.8); sm('→ low precision', 3.0, 3.2);
    cap('media processing：一個 pixel 只有 8 bits', '所以是 low precision 的運算');
  },
  async (tok, S) => { // 1813.8 application drives performance
    hd('② application 推動 performance', -3.0, 2.4); bub('跑太慢 → 想買新機器', -3.0, 1.7);
    cap('軟體跑很慢，才會想買更快的機器', '沒有 application 就沒人要買');
  },
  async (tok, S) => { // 1860.1 HLL
    sm('high-level language → 更容易寫 → 更多 application（例如 game）', 1.6, 1.0);
    cap('high-level language 出現', '應用更容易寫，需要更大的 power 和 memory');
  },
  async (tok, S) => { // 1890.7 compatibility
    hd('③ compatibility：舊程式還能跑', -3.0, 0.2);
    cap('compatibility', '換新電腦，希望舊的 application 還能跑');
  },
  async (tok, S) => { // 1921.7 Intel x86
    sm('Intel CISC 沒有 RISC elegant，但累積太多軟體 → 大家繼續用', 1.6, -0.5);
    cap('Intel 的 CISC 不如 RISC elegant', '但 software 實在太多，所以一直存在');
  },
  async (tok, S) => { // 1954.7 ease of use
    sm('④ ease of use：好用才會用', -3.0, -1.2);
    cap('ease of use', '新系統太複雜，大家就不想用');
  },
  async (tok, S) => { // 1969.1 market
    sm('⑤ market demand、market share：投資要能回收', 2.6, -1.2);
    cap('market demand 和 market share', '只有很少人要的功能，研發投資回收不了');
  },
]);

scene('nuA-2a-gp', 'General purpose computer 的特性', [
  async (tok, S) => { // 2001.3 分兩大類
    S.g = bx('general purpose（desktop ＋ server）', NC.sky, -3.2, 6.0, 0, 5.4, 0.6, 0.8); S.e = bx('embedded', NC.mint, 3.6, 6.0, 0, 3.0, 0.6, 0.8);
    cap('把 desktop、server 歸成 general purpose', '另一大類是 embedded');
  },
  async (tok, S) => { // 2045.3 software compatibility
    S.l = list(-3.2, 5.1, 0.5); S.l.add('software compatibility 最重要', 'ptr alt');
    cap('general purpose：軟體相容性最重要', '一直有很多軟體在上面用');
  },
  async (tok, S) => { // 2069.5 short product life
    S.l.add('product life 短、價格高、profit margin 大');
    cap('product life 很短、很貴', 'profit margin 比較大');
  },
  async (tok, S) => { // 2114.8 舊電腦淘汰
    S.old = prop('monitor', 3.6, 2.6, 0, 0.6, '舊電腦'); bad('太慢 → 淘汰', 3.6, 1.9);
    cap('以前的電腦你還會用嗎？淘汰了', '這就是 short product cycle');
  },
  async (tok, S) => { // 2148.0 OS issues
    S.l.add('OS issues：習慣的作業系統（Windows…）');
    cap('OS 也很重要', '習慣用哪種作業系統，就會繼續買');
  },
  async (tok, S) => { // 2176.7 未來
    S.l.add('未來：更多 transistor、performance、human interface、bandwidth', 'good');
    cap('未來 transistor 繼續變多', '著重 performance、human interface、bandwidth');
  },
]);

scene('nuA-2a-emb', 'Embedded computer 的特性', [
  async (tok, S) => { // 2194.5 embedded：在另一個 device 裡
    S.fr = bx('冰箱（device）', NC.sky, -4.4, 3.6, 0, 2.6, 2.4, 1.2); S.ch = prop('cpu', -4.4, 3.4, 0.7, 0.4);
    hot('embedded：在另一個 device 裡的小 component', 1.2, 6.4);
    cap('embedded computer', '在另一個 device 裡，只是一個小 component');
  },
  async (tok, S) => { // 2219.0 predetermined application
    S.l = list(1.2, 5.6, 0.48); S.l.add('跑固定的 predetermined application', 'ptr'); S.l.add('冰箱就那幾個功能；車子控制油量、煞車');
    cap('通常跑一個固定的 application', '功能事先定好，不會隨時加');
  },
  async (tok, S) => { // 2251.3 control、consumer electronics
    S.l.add('control、consumer electronics、game、cellphone');
    cap('用在 control、消費電子、遊戲、手機', '');
  },
  async (tok, S) => { // 2264.5 Lego 機器人
    S.rb = buddy('Lego 機器人', 'µP', NC.orange, -1.4, 0.4, 1.0, 0.8); sm('刷馬桶、換燈泡、玩魔術方塊', -1.4, -0.5);
    cap('Lego 拼的機器人裡也裝了 microprocessor', '能做很多事');
  },
  async (tok, S) => { // 2316.0 沒有 floating point
    S.d = list(4.0, 3.2, 0.45); S.d.add('跟 general purpose 不同：', 'ptr'); S.d.add('通常沒有 floating point');
    cap('跟 general purpose 不同：通常沒有 floating point', '功能固定，不需要那麼複雜');
  },
  async (tok, S) => { // 2330.6 沒有 MMU
    S.d.add('不需要 memory management unit');
    cap('也不需要 memory management unit', '沒有很大的 memory 要管');
  },
  async (tok, S) => { // 2343.9 peripherals
    S.d.add('和各種 peripheral（I/O）整合');
    cap('會和各種 peripheral function 結合', '');
  },
  async (tok, S) => { // 2356.3 各式各樣 ISA；compatibility 不是問題
    S.d.add('ISA 各式各樣；compatibility 不是問題', 'good');
    cap('可以有各式各樣的 ISA', '自己寫軟體就好，容易進入');
  },
  async (tok, S) => { // 2449.6 low power
    S.d.add('low power 很重要');
    cap('要注意 low power', '它是大系統裡的一小部分');
  },
  async (tok, S) => { // 2464.2 4-bit、8-bit 一直用
    S.d.add('壽命長：4-bit、8-bit 到現在還在用（豆漿機）');
    cap('可以存在很久', '4-bit、8-bit 處理器到現在還在用');
  },
  async (tok, S) => { // 2500.8 量大 cost 低
    S.d.add('量很大、cost 很低（相機幾千元 vs PC 幾萬元）');
    cap('量很大，而且一定要很便宜', '整台相機幾千元，裡面的 processor 能多貴？');
  },
  async (tok, S) => { // 2532.7 ARM vs x86
    gone(S.rb); S.X = yearAxis(1993, 2005, -1.4, -6, -0.6); yearMark(S.X, 1995, 'x86 數量 #1', 0, 'idx', -1.4); yearMark(S.X, 2002, 'ARM #1', 0, 'ptr alt', -1.4);
    cap('1995 年 x86 數量第一', '2002 年 ARM 已經變第一（手機、controller）');
  },
  async (tok, S) => { // 2590.6 市場圖
    good('embedded 是更重要的未來趨勢', 1.2, -1.6);
    cap('processor 市場圖：手機用的成長最快', 'embedded computer 是未來的趨勢');
  },
]);

// ════════ 2ICqPUCycWQ（第 3A 講：Computer Abstractions） ════════
scene('nuA-3a-abs', 'Abstraction：分層看電腦', [
  async (tok, S) => { // 18.0 今天：abstraction、performance
    S.t = [bx('abstraction', NC.mint, -2.4, 6.0, 0, 3.4, 0.6, 0.8), bx('performance', NC.lilac, 2.4, 6.0, 0, 3.4, 0.6, 0.8)];
    cap('上次：電腦怎麼演進', '今天：abstraction 和 performance');
  },
  async (tok, S) => { // 21.4 抽象
    glow(S.t[0], HL); sm('abstraction ＝ 抽象', -2.4, 5.3);
    cap('abstraction 是什麼意思？', '就是「抽象」');
  },
  async (tok, S) => { // 23.4 不同層級
    S.lv = ['high level', '中間 level', 'low level'].map((t, i) => bx(t, [NC.sky, NC.sand, NC.tan][i], 0, 3.8 - i * 1.0, 0, 5.0, 0.8, 1.2));
    cap('看電腦可以從不同層級', '高的、中間的、低的');
  },
  async (tok, S) => { // 47.6 把下面隱藏
    S.lv[1].material.transparent = true; S.lv[2].material.transparent = true; S.lv[1].material.opacity = 0.25; S.lv[2].material.opacity = 0.25;
    hot('看 high level 時，把下面的細節藏起來', 0, 5.0);
    cap('看高層時把下面藏起來', '懂了之後再往下一層了解');
  },
  async (tok, S) => { // 57.6 看 component
    S.lv[1].material.opacity = 1; good('再一層一層往下看各個 component', 0, 0.6);
    cap('來看電腦在不同層級上', '由哪些 component 組成');
  },
]);

scene('nuA-3a-layers', 'Hardware、system software、application software', [
  async (tok, S) => { // 65.0 hardware vs software
    S.hw = bx('hardware', NC.sky, -3.8, 5.4, 0, 2.6, 0.6, 0.8); S.sw = bx('software', NC.mint, 3.8, 5.4, 0, 2.6, 0.6, 0.8);
    sm('單獨的硬體不會動作', -3.8, 4.7); sm('軟體去驅動硬體做事', 3.8, 4.7);
    cap('電腦分成硬體和軟體', '硬體自己不會動，軟體驅動它做事');
  },
  async (tok, S) => { // 85.7 軟體兩種
    sm('軟體又分兩種：application、system', 3.8, 4.1);
    cap('軟體分兩種', 'application program 和 system program');
  },
  async (tok, S) => { // 93.7 最裡面 hardware
    gone(S.hw, S.sw); S.r3 = bx('hardware', NC.sky, 0, 0.4, 0, 2.4, 0.7, 2.4);
    cap('層級是這樣：最裡面是 hardware', '');
  },
  async (tok, S) => { // 106.7 system software
    S.r2 = bx('', NC.sand, 0, 0.2, 0, 5.0, 0.3, 5.0); sm('system software', 0, 1.4, 2.3);
    cap('再外面一層是 system software', '');
  },
  async (tok, S) => { // 110.0 application software
    S.r1 = bx('', NC.mint, 0, 0.0, 0, 7.6, 0.1, 7.6); sm('application software', 0, 1.4, 3.6);
    S.apps = ['銀行系統', '機場系統', 'game'].map((t, i) => bub(t, -4.2 + i * 4.2, 4.8));
    cap('最外面是 application software', '銀行、機場的系統，甚至你玩的 game');
  },
  async (tok, S) => { // 128.1 system software：compiler、OS
    gone(S.apps); S.c = bx('compiler', NC.orange, -3.2, 4.8, 0, 2.4, 0.6, 0.8); S.o = bx('OS', NC.purple, 3.2, 4.8, 0, 2.4, 0.6, 0.8);
    cap('application 要透過 system software 才能跑', 'system software 分兩種：compiler、OS');
  },
  async (tok, S) => { // 135.6 compiler 翻譯
    sm('high-level language → machine 懂的 0、1', -3.2, 4.1);
    cap('compiler 把 high-level language', 'translate 成 machine 懂的 code');
  },
  async (tok, S) => { // 172.2 OS：共用的 I/O、memory
    sm('大家共用的 I/O、memory、storage', 3.2, 4.1);
    cap('OS：大家共用的東西寫一份就好', '處理 I/O、memory、storage');
  },
  async (tok, S) => { // 197.4 scheduling
    sm('scheduling：誰先用、誰後用 resource', 3.2, 3.5);
    cap('很多 process 同時要用 resource', 'OS 決定誰先誰後：scheduling、sharing');
  },
  async (tok, S) => { // 219.2 三大部分
    good('電腦 ＝ hardware ＋ system software ＋ application software', 0, 6.4);
    cap('所以電腦是三大部分', '硬體、系統軟體、應用軟體');
  },
  async (tok, S) => { // 232.4 研究領域
    sm('研究所各領域也落在這三塊：application？system？hardware？', 0, 5.8);
    cap('將來你走的領域也一定在這裡面', '做 application、system 還是 hardware');
  },
], [[0, 5.5, 12.5], [0, 2.4, 0]]);

scene('nuA-3a-code', 'Program 的層級：high-level → assembly → machine code', [
  async (tok, S) => { // 244.0 program code 的層級
    hot('從 program code 看：也分很多 level', 0, 6.5);
    cap('從 program 的 code 來看', '也可以分很多 level');
  },
  async (tok, S) => { // 256.1 machine 只懂 0、1
    S.mc = bx('machine code：只有 0 和 1', NC.sky, -3.6, 0.6, 0, 4.2, 0.6, 0.8);
    cap('machine 看不懂 high-level language', '它只懂 0 跟 1');
  },
  async (tok, S) => { // 265.7 HLL：swap
    S.hl = bx('high-level language（C）', NC.mint, -3.6, 5.4, 0, 4.2, 0.6, 0.8);
    S.cc = code(['swap(int v[], int k)', '{ int temp;', '  temp = v[k];', '  v[k] = v[k+1];', '  v[k+1] = temp;', '}'], 2.4, 6.0, 0.42);
    cap('最高的是 high-level language', '例如這個 C 的 swap');
  },
  async (tok, S) => { // 277.0 productivity
    sm('接近問題本身（數學符號＋英文）→ productivity', -3.6, 4.7);
    cap('寫法接近問題本身', '寫得快、寫得多：提供 productivity');
  },
  async (tok, S) => { // 300.5 portability
    sm('不同機器 ISA 不同，C 都一樣 → portability', -3.6, 4.2);
    cap('還提供 portability', '同一份 C，各機器的 compiler 各自翻譯');
  },
  async (tok, S) => { // 326.4 compiler → assembly
    S.cc.kill(); lk(-3.6, 5.0, -3.6, 3.4); sm('compiler', -2.4, 3.8);
    S.as = bx('assembly language', NC.lilac, -3.6, 3.0, 0, 4.2, 0.6, 0.8);
    S.ac = code(['swap: sll $t1, $a1, 2', '      add $t1, $a0, $t1', '      lw  $t0, 0($t1)', '      lw  $t2, 4($t1)', '      sw  $t2, 0($t1)', '      sw  $t0, 4($t1)', '      jr  $ra'], 2.6, 6.2, 0.42);
    cap('經過 compiler 就變成這樣', '已經很像 machine instruction');
  },
  async (tok, S) => { // 337.7 lw = load
    S.ac.hl(2); hot('lw ＝ load：用 symbol 表示，人看得懂', 2.6, 2.9);
    cap('例如 lw 就是 load', '實際是幾個 bit，但用 symbol 好讀');
  },
  async (tok, S) => { // 356.9 assembly ≈ instruction set
    sm('assembly ≈ instruction set 的表示法', -3.6, 2.3);
    cap('這就是 assembly language', '跟 instruction set 很像的表示法');
  },
  async (tok, S) => { // 362.9 assembler 一對一
    lk(-3.6, 2.6, -3.6, 1.0); sm('assembler（一對一）', -2.2, 1.7);
    const f = [[35, 6], [9, 5], [8, 5], [0, 16]].map(([v, n]) => v.toString(2).padStart(n, '0'));
    const hx = parseInt(f.join(''), 2).toString(16).toUpperCase().padStart(8, '0');
    mt('lw $t0,0($t1) → ' + f.join(' '), 2.4, 0.6); ok(hx === '8D280000', '= 0x' + hx + '（op 35、rs 9、rt 8、offset 0）✓', 2.4, 0.0);
    cap('assembler 一對一翻成 0101', 'opcode、欄位直接換成 bits');
  },
]);

scene('nuA-3a-io', '電腦的組成：processor、memory、I/O；mouse 怎麼運作', [
  async (tok, S) => { // 389.2 processor
    S.p = prop('cpu', -4.6, 4.6, 0, 0.9, 'processor');
    cap('hardware：不管 desktop、server、embedded', '一定有 processor 處理運算');
  },
  async (tok, S) => { // 412.3 memory
    S.m = bx('memory', NC.sky, -1.6, 5.0, 0, 1.8, 0.7, 0.9);
    cap('還有 memory', '儲存的地方');
  },
  async (tok, S) => { // 415.8 I/O
    S.io = bx('I/O', NC.orange, 1.4, 5.0, 0, 1.4, 0.7, 0.9);
    cap('還有 I/O', '和外面溝通的 input / output device');
  },
  async (tok, S) => { // 421.8 user interface device
    S.l = list(4.4, 5.6, 0.48); S.l.add('user-interface：display、keyboard、mouse');
    cap('I/O 分幾種：user-interface device', 'display、keyboard、mouse');
  },
  async (tok, S) => { // 432.6 storage
    S.l.add('storage device：存、取資料');
    cap('storage device', '處理完要存起來、再取出來');
  },
  async (tok, S) => { // 441.5 network adapter
    S.l.add('network adapter：機器之間溝通');
    cap('network adapter', '機器跟機器之間可以溝通');
  },
  async (tok, S) => { // 455.9 最外表
    gone(S.p, S.m, S.io); S.mon = prop('monitor', -3.8, 0.4, 0, 0.9, 'display（output）'); S.kb = prop('keyboard', -0.8, 0.4, 1.0, 0.8);
    sm('keyboard（input）', -0.8, -0.3); S.ms = bx('mouse', NC.gray, 1.6, 0.4, 1.0, 0.6, 0.3, 0.9); sm('mouse（input）', 1.9, -0.3);
    cap('從最外表看一台電腦', 'display 是 output；keyboard、mouse 是 input');
  },
  async (tok, S) => { // 474.5 再深入：optical mouse
    S.big = bx('optical mouse', NC.gray, 4.6, 2.0, 0, 2.0, 0.9, 2.4);
    cap('再往下一層看：mouse 長什麼樣？', '現在是 optical（光學）mouse');
  },
  async (tok, S) => { // 499.7 LED
    S.led = cube('', '#ff6b6b', [0.3, 0.3, 0.3], 4.6, 1.3, 0.8); sm('LED 照亮桌面', 4.6, 0.6);
    cap('裡面有一個 LED', '光照在你的桌面上');
  },
  async (tok, S) => { // 509.0 小 camera
    hot('小 camera：每秒拍 1,500 張', 4.6, 3.3);
    cap('裡面其實是一個小小的 camera', '每秒可以拍一千五百張');
  },
  async (tok, S) => { // 518.3 image processing
    S.f1 = bx('', NC.tan, 2.4, 5.6, 0, 1.0, 1.0, 0.1); S.f2 = bx('', NC.tan, 4.2, 5.6, 0, 1.0, 1.0, 0.1); cube('', NC.dark, [0.2, 0.2, 0.1], 2.3, 5.7, 0.1); cube('', NC.dark, [0.2, 0.2, 0.1], 4.4, 5.5, 0.1);
    sm('比對前後兩張的差異 → x、y 移動', 3.3, 4.7); lk(2.95, 5.6, 3.65, 5.6);
    cap('小 processor 做 image processing', '比對兩張照片的差異，算出 x、y 移動');
  },
  async (tok, S) => { // 543.9 傳統滾球
    sm('以前：滾球 ＋ counter，x、y 加加減減', 4.6, -0.3);
    cap('以前的 mouse 裡是一顆滾球', 'counter 依移動 increment、decrement');
  },
]);

scene('nuA-3a-display', 'Display：bitmap、pixel、frame buffer', [
  async (tok, S) => { // 568.4 display
    hot('再往下看：display 怎麼運作？', 0, 6.4);
    cap('螢幕怎麼運作？', '再往下一層看，這也是 abstraction');
  },
  async (tok, S) => { // 583.3 bitmap
    S.px = []; const N = 8; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) S.px.push(cube('', NC.off, [0.5, 0.5, 0.1], -5.6 + c * 0.55, 5.2 - r * 0.55, 0));
    sm('一點一點：pixel', -3.7, 0.5);
    cap('螢幕用 bitmap 表示影像', '一點一點，每一點叫 pixel');
  },
  async (tok, S) => { // 594.1 黑白 8 bits
    S.px.forEach((m, i) => { const r = Math.floor(i / 8), c = i % 8; const g = Math.round(((r + c) / 14) * 255); m.material.color.setRGB(g / 255, g / 255, g / 255); });
    ok(2 ** 8 === 256, '黑白：每個 pixel 8 bits → 2⁸ = 256 種灰階 ✓', 2.6, 5.4);
    cap('黑白的話，每個 pixel 8 個 bit', '表示不同的灰階');
  },
  async (tok, S) => { // 605.7 深淺
    mt('00000000 黑 … 11111111 白', 2.6, 4.8);
    cap('不同的 bit 值', '就是不同的深淺');
  },
  async (tok, S) => { // 609.0 彩色 RGB
    S.rgb = [['R', '#e05050'], ['G', '#40b060'], ['B', '#4b7ee2']].map(([t, c], i) => bx(t, c, 1.4 + i * 1.1, 3.8, 0, 0.9, 0.6, 0.6));
    cap('彩色要三個基本原色', '紅、綠、藍：RGB');
  },
  async (tok, S) => { // 622.6 各 8 bits
    const n = 2 ** 24; ok(n === 16777216, '3 × 8 = 24 bits → 2²⁴ = ' + fmtN(n) + ' 種顏色 ✓', 2.6, 3.1);
    cap('RGB 各 8 bits 組成一個 pixel', '決定這個 pixel 是什麼顏色');
  },
  async (tok, S) => { // 631.7 resolution
    const a = 640 * 480; ok(a === 307200, 'resolution 640 × 480 = ' + fmtN(a) + ' 個 pixel ✓', 2.6, 2.3);
    cap('resolution（解析度）：螢幕上有幾個點', '點越多，畫質越精細');
  },
  async (tok, S) => { // 649.6 2560 × 1600
    const a = 2560 * 1600; ok(a === 4096000, '2560 × 1600 = ' + fmtN(a) + ' 個 pixel ✓', 2.6, 1.7);
    cap('到 2560 × 1600', 'pixel 越多，解析度越好');
  },
  async (tok, S) => { // 660.7 frame buffer
    S.fb = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) S.fb.push(cube('', NC.sky, [0.45, 0.45, 0.3], 1.8 + c * 0.5, 0.2 + r * 0.5, 0));
    hd('frame buffer', 2.55, -0.4); lk(-3.4, 2.8, 1.5, 1.1, 0xc08a1f); glow(S.px[27], HL); glow(S.fb[9], HL);
    cap('另外有一個 frame buffer', '螢幕上每一點對應 frame buffer 的一格');
  },
  async (tok, S) => { // 677.8 存數值 → 顏色
    relabel(S.fb[9], ''); bub('存這一點的 8 bits 值 → 顯示對應的顏色', 2.6, -1.1);
    cap('frame buffer 存每點的數值', '這個數字決定顯示什麼顏色');
  },
]);

scene('nuA-3a-inside', '打開 notebook：CPU、DRAM、cache', [
  async (tok, S) => { // 691.7 打開 notebook：風扇
    S.board = bx('', '#6f8f6f', 0, 0.2, 0, 11, 0.2, 5.5); S.fan = bx('風扇', NC.gray, -4.2, 0.6, -1.2, 1.6, 0.4, 1.6);
    cap('把 notebook 打開', '裡面有風扇');
  },
  async (tok, S) => { // 703.7 DVD、hard drive、battery
    bx('DVD drive', NC.metal, -1.6, 0.5, -1.6, 2.0, 0.3, 1.4); bx('hard drive', NC.metal, 1.2, 0.5, -1.6, 1.8, 0.3, 1.4); bx('battery', NC.tan, 4.0, 0.5, -1.4, 2.0, 0.3, 1.8);
    cap('還有 DVD drive、hard drive', '這裡放電池');
  },
  async (tok, S) => { // 708.3 DRAM memory
    S.dram = [0, 1].map((i) => bx('DRAM', NC.sky, -1.2 + i * 1.0, 0.6, 1.2, 0.6, 0.35, 1.8)); sm('memory 插在板子的插槽上', -0.7, 2.0, 1.2);
    cap('DRAM memory 放在這裡', '插在板子的插槽上');
  },
  async (tok, S) => { // 718.5 CPU 小但最貴
    S.cpu = prop('cpu', 3.2, 0.3, 1.2, 0.7); hot('CPU：很小一塊，但最貴', 3.2, 1.9, 1.2);
    cap('這邊是 processor（CPU）', '相對很小一塊，但它最貴');
  },
  async (tok, S) => { // 729.0 off-chip
    S.a = lk(2.4, 0.9, -0.5, 0.9, 0xd64545, 1.4); bad('CPU 和 memory 不在同一個 chip → off-chip，比較慢', 0.6, 3.0);
    cap('CPU 和 memory 不在同一個 chip 上', '去 memory 拿東西是 off-chip，花比較久');
  },
  async (tok, S) => { // 747.4 processor 裡：datapath、control
    gone(S.a); S.die = zone('processor 內部', 0, 4.0, 0, 9.0, 0.6, '#efe3cc');
    S.dp = bx('datapath（運算）', NC.purple, -2.8, 4.5, 0, 2.6, 0.6, 0.6); S.ct = bx('control（何時做什麼）', NC.orange, 0.6, 4.5, 0, 3.0, 0.6, 0.6);
    cap('processor 裡面：datapath 幫我們運算', 'control 告訴它哪個時間做什麼');
  },
  async (tok, S) => { // 768.2 cache memory
    S.ca = bx('cache memory', NC.mint, 3.6, 4.5, 0, 2.2, 0.6, 0.6);
    cap('還有一個叫 cache memory', '不是已經有 DRAM 了嗎？');
  },
  async (tok, S) => { // 787.2 小但快、跟 processor 在一起
    good('cache：在 processor 同一個 chip 上（on-chip），小但很快', 0.6, 5.5);
    cap('cache 和 processing unit 在一起', '比較小，但很快');
  },
  async (tok, S) => { // 802.0 off-chip 浪費時間
    await runDot(tok, '資料', [[-1.0, 1.4], [3.6, 4.0]], 900, 'bad');
    cap('如果每次都寫回 off-chip 的 memory 再讀出來', '很浪費時間');
  },
  async (tok, S) => { // 822.2 不能太大
    sm('太大會拖慢 CPU、也比較貴 → 做小一點', 3.6, 3.6);
    cap('cache 不能做太大', '太大會讓 CPU 變慢，也比較貴');
  },
  async (tok, S) => { // 852.0 4 核心
    gone(S.die, S.dp, S.ct, S.ca); S.cores = []; for (let i = 0; i < 4; i++) { const x = -4.5 + i * 3.0; S.cores.push(bx('core ' + (i + 1), NC.lilac, x, 5.6, 0, 1.5, 0.5, 0.6)); bx('L1 I$', NC.mint, x - 0.45, 4.9, 0, 0.8, 0.4, 0.6); bx('L1 D$', NC.mint, x + 0.45, 4.9, 0, 0.8, 0.4, 0.6); }
    bx('L2 shared cache', NC.teal, 0, 4.2, 0, 9.5, 0.45, 0.6); bx('L3 shared cache', '#7fc8b0', 0, 3.6, 0, 9.5, 0.45, 0.6);
    cap('一顆 4 core 的 processor', '每個 core 有 L1 data/instruction cache，還有 L2、L3 shared cache');
  },
  async (tok, S) => { // 875.1 cache 佔很大面積
    S.cores.forEach((m) => glow(m, HL)); sm('真正執行（integer、floating point、load/store）的只有一小塊；cache 佔很大面積', 0, 6.4);
    cap('cache 佔了相當大的面積', '真正做運算的只有一小塊');
  },
], [[0, 6.2, 12.5], [0, 2.0, 0]]);

scene('nuA-3a-mem', 'Volatile／non-volatile memory、network', [
  async (tok, S) => { // 914.9 main memory、cache
    S.mm = bx('main memory（DRAM）', NC.sky, -3.6, 5.2, 0, 3.4, 0.7, 0.9); S.ca = bx('cache', NC.mint, -3.6, 6.1, 0, 2.0, 0.5, 0.8);
    cap('main memory 和 cache', '都可以存資料');
  },
  async (tok, S) => { // 925.0 volatile
    bad('volatile：一斷電，資料全部不見', -3.6, 4.4);
    S.bits = []; for (let i = 0; i < 6; i++) S.bits.push(cube(i % 2 ? '1' : '0', NC.blue, [0.32, 0.32, 0.32], -4.6 + i * 0.4, 3.6, 0));
    for (const m of S.bits) await slide(tok, m, m.position.x, 2.6, 2.0, 120);
    gone(S.bits);
    cap('main memory 是 volatile', 'power off 時資料就全部不見');
  },
  async (tok, S) => { // 934.8 non-volatile
    S.sec = ['disk', 'flash', 'CD-ROM、DVD'].map((t, i) => bx(t, NC.tan, 2.0 + i * 1.7, 5.2, 0, 1.5, 0.7, 0.9));
    good('non-volatile secondary memory：斷電也還在', 3.7, 6.1); sm('容量更大，但速度更慢', 3.7, 4.4);
    cap('non-volatile secondary memory', 'disk、flash、CD、DVD：容量大、速度慢、斷電還在');
  },
  async (tok, S) => { // 963.9 network
    S.n1 = prop('monitor', -3.0, 0.6, 0, 0.6); S.n2 = prop('monitor', 3.0, 0.6, 0, 0.6); seg(-2.2, 1.2, 2.2, 1.2, '#4b9ee2', 0);
    sm('LAN、WAN、wireless（Wi-Fi、Bluetooth）', 0, 2.2);
    cap('network：share 很多 resource', 'LAN、WAN、wireless：機器連在一起');
  },
  async (tok, S) => { // 983.4 不同角度的 abstraction
    sm('從 program、整台電腦、小 component 不同角度看', 0, 3.0);
    cap('剛才從不同角度看 abstraction', 'program、整台電腦、小 component');
  },
  async (tok, S) => { // 996.0 deal with complexity
    good('abstraction 幫我們 deal with complexity', 0, 3.6);
    cap('abstraction 幫我們處理 complexity', '先看最抽象的，再一層層往下');
  },
]);

scene('nuA-3a-abi', 'ISA 是軟硬體介面；ABI', [
  async (tok, S) => { // 1017.2 ISA
    S.isa = bx('ISA：processor 要能執行哪些 instruction', NC.gold, 0, 3.4, 0, 6.4, 0.6, 0.9);
    cap('instruction set architecture', '像 assembly 的語言，定義 processor 要執行哪些 instruction');
  },
  async (tok, S) => { // 1033.6 介面
    S.sw = bx('software', NC.mint, 0, 4.4, 0, 6.4, 0.7, 0.9); S.hw = bx('hardware', NC.sky, 0, 2.4, 0, 6.4, 0.7, 0.9);
    cap('它是 hardware 和 software 之間', '很重要的 interface');
  },
  async (tok, S) => { // 1040.4 雞跟蛋
    S.a = buddy('SW', '', NC.mint, -5.4, 4.2, 0, 0.7); S.b = buddy('HW', '', NC.sky, 5.4, 1.8, 0, 0.7);
    bub('hardware 沒做出來，我怎麼寫？', -4.4, 6.0); bub('software 沒寫出來，我怎麼做？', 4.4, 3.4); S.a.mood('sad'); S.b.mood('sad');
    cap('沒有介面就變成雞生蛋、蛋生雞', '大家都沒辦法開始做事');
  },
  async (tok, S) => { // 1056.7 中間定一層
    glow(S.isa, HL); S.a.mood('happy'); S.b.mood('happy');
    cap('所以在中間定一層 ISA', '定好以後兩邊就能分開做');
  },
  async (tok, S) => { // 1069.2 software 不需要知道實作
    sm('software：不用知道 hardware 怎麼 implement', -2.6, 5.2);
    cap('software 的人不需要知道 hardware 怎麼做', '只要它能執行這些 instruction');
  },
  async (tok, S) => { // 1081.0 加上 OS
    S.os = bx('OS 的 system call interface', NC.purple, 3.2, 5.6, 0, 3.4, 0.5, 0.8);
    cap('除了 instruction set', '還有 OS 這些 system software 幫忙處理');
  },
  async (tok, S) => { // 1101.0 ABI
    good('ISA ＋ system software interface ＝ Application Binary Interface（ABI）', 0, 0.9);
    cap('ISA 加上 system software 的 interface', '叫 Application Binary Interface（ABI）');
  },
  async (tok, S) => { // 1130.8 hardware 照 ISA 實作
    glow(S.hw, HL); sm('hardware：照 ISA 把 instruction implement 出來', 2.6, 1.6);
    cap('hardware 的人只要知道 instruction set', '就把它 implement 出來');
  },
]);

scene('nuA-3a-trend', 'Technology trend：Moore\'s Law 與 cost-performance', [
  async (tok, S) => { // 1165.0 performance
    hot('接下來：performance（效能）', 0, 6.4);
    cap('接下來看 performance', '怎麼衡量電腦的效能？');
  },
  async (tok, S) => { // 1179.4 Moore's law 回顧
    S.bars = []; let v = 1; for (let k = 0; k < 6; k++) { S.bars.push(vbar(NC.blue, -5 + k * 1.0, v * 0.15, 0.6, 0.3)); v *= 2; }
    sm("Moore's Law（回顧）", -2.5, -0.3);
    cap("還記得 Moore's Law 嗎？", '');
  },
  async (tok, S) => { // 1232.6 18 個月 double
    good('每 18 個月 transistor double；feature size 縮小', -2.5, 5.9);
    cap('每一年半 transistor double', 'feature size 縮小，技術越來越進步');
  },
  async (tok, S) => { // 1250.6 DRAM capacity
    S.dr = []; let v = 1; for (let k = 0; k < 5; k++) { S.dr.push(vbar(NC.mint, 1.6 + k * 1.0, Math.log2(v) * 0.3 + 0.2, 0.6, 0.3)); v *= 4; }
    sm('DRAM capacity（示意）', 3.6, -0.3);
    cap('這張是 DRAM 的 capacity', '同樣面積，容量一直變大');
  },
  async (tok, S) => { // 1260.9 更快更便宜
    sm('越小 → 越快；chip 照面積算錢 → 越便宜', 3.6, 3.8);
    cap('越小速度越快', '晶片是照面積算錢，所以 cost 越低');
  },
  async (tok, S) => { // 1273.1 cost performance
    gone(S.bars, S.dr); S.cp = vbar(NC.gold, -3, 0.3, 1.2, 0.3); sm('真空管：1', -3, 1.0);
    S.big = vbar(NC.gold, 3, 5.0, 1.2, 0.3); hot('約 60 億倍（老師口述；課本表 2005 ULSI：6,200,000,000）', 1.0, 6.2);
    cap('cost-performance：真空管當 1', '五十多年後已經是幾十億倍');
  },
  async (tok, S) => { // 1287.8 到處都有
    good('所以到處都負擔得起放一顆 processor', 0, -0.6);
    cap('效能增加這麼多', '到處都負擔得起放一個 processor');
  },
]);

scene('nuA-3a-plane', '用飛機比喻 performance', [
  async (tok, S) => { // 1308.0 飛機比喻
    hot('電腦設計出來，怎麼衡量好或壞？用飛機比喻', 0, 6.5);
    cap('怎麼衡量一台電腦好不好？', '用飛機來做比喻');
  },
  async (tok, S) => { // 1324.9 Concorde
    S.t = list(-5.6, 5.6, 0.55, 'idx'); mono(S.t.add('飛機        人數   航程(mi)  速度(mph)', 'ptr'));
    S.rc = mono(S.t.add('Concorde     132     4000      1350'));
    cap('Concorde：132 人、航程 4000 mile', '速度每小時 1350 mile');
  },
  async (tok, S) => { // 1349.2 747
    S.r7 = mono(S.t.add('Boeing 747   470     4150       610'));
    cap('747：470 人、航程 4150 mile', '速度 610 mph，比較慢');
  },
  async (tok, S) => { // 1367.7 哪個好
    bub('這兩架哪一架比較好？', 3.6, 4.4);
    cap('這兩架飛機到底哪個比較好？', '');
  },
  async (tok, S) => { // 1395.2 依標準分析
    sm('要看「用什麼標準」', 3.6, 3.8);
    cap('同學很會分析', '不同的點來看，結論不同');
  },
  async (tok, S) => { // 1417.7 capacity
    good('看人數 → 747 最好', 3.6, 3.0);
    cap('看 passenger capacity', '747 可以載最多人');
  },
  async (tok, S) => { // 1424.6 range → DC-8
    mono(S.t.add('DC-8-50     146     8720       544  （課本表）'));
    good('看航程 → Douglas DC-8 最好', 3.6, 2.4);
    cap('看 cruising range', 'Douglas DC-8 可以飛很久不用加油');
  },
  async (tok, S) => { // 1437.3 speed → Concorde
    good('看速度 → Concorde 最快', 3.6, 1.8);
    cap('看速度', 'Concorde 最快');
  },
  async (tok, S) => { // 1449.3 人數 × 速度
    hot('另一種標準：passengers × mph', -2.2, 2.6);
    cap('人數和速度都重要', '把人數乘以速度');
  },
  async (tok, S) => { // 1478.1 單位時間做多少事
    const c = 132 * 1350, b = 470 * 610;
    mt('Concorde：132 × 1350 = ' + fmtN(c), -2.2, 1.9); mt('747     ：470 × 610  = ' + fmtN(b), -2.2, 1.4);
    S.bc = vbar(NC.orange, -4.2, c / 60000, 0.8, -2.8); S.bb = vbar(NC.blue, -3.0, b / 60000, 0.8, -2.8);
    ok(c === 178200 && b === 286700 && b > c, '單位時間載人 × 距離：747 比較高 ✓', -2.2, 0.8);
    cap('單位時間能做多少事', '這樣比，747 反而比較好');
  },
  async (tok, S) => { // 1493.1 不同 factor
    sm('不同的衡量標準，答案不同；電腦也一樣', 3.6, 0.4);
    cap('不同 factor 看快慢', '電腦也一樣');
  },
]);

scene('nuA-3a-rt', 'Response time 與 throughput', [
  async (tok, S) => { // 1505.3 response time
    hot('① Response time', -3.4, 6.3);
    cap('第一個：response time', '有點像飛機的速度');
  },
  async (tok, S) => { // 1528.6 完成一個工作要多久
    sm('丟一個工作進去，多久算出來（越短越好）', -3.4, 5.6);
    cap('把一個工作丟進去', '多久可以完成：越快越好');
  },
  async (tok, S) => { // 1532.3 throughput
    hot('② Throughput', 3.4, 6.3); sm('單位時間完成多少工作（越多越好）', 3.4, 5.6);
    cap('throughput：total work done per unit time', '單位時間能完成的工作量');
  },
  async (tok, S) => { // 1559.7 兩者的關係？
    bub('一個變好，另一個一定變好嗎？', 0, 4.6);
    cap('兩個的關係？', '改善一個，另一個一定變好嗎？');
  },
  async (tok, S) => { // 1593.7 換成更快的 processor
    S.l = list(-5.4, 3.6, 0.5); S.l.add('換成更快的 processor：', 'ptr'); S.l.add('response time ↓ ✓　throughput ↑ ✓', 'good');
    cap('把 processor 換成更快的', 'response time 變快，throughput 也變高');
  },
  async (tok, S) => { // 1617.7 加 processor
    S.l.add('多加一個 processor：', 'ptr'); S.l.add('response time 一定變快？不一定');
    cap('多加一個 processor 呢？', 'response time 一定變快嗎？不一定');
  },
  async (tok, S) => { // 1661.2 兩個 processor 各做一件
    const T = 10; S.p1 = bx('P1：job A（' + T + ' time unit）', NC.sky, 2.4, 2.8, 0, 4.0, 0.5, 0.7); S.p2 = bx('P2：job B（' + T + ' time unit）', NC.mint, 2.4, 2.1, 0, 4.0, 0.5, 0.7);
    const thr1 = 1 / T, thr2 = 2 / T;
    ok(thr2 === 2 * thr1, '每個 job 還是 ' + T + ' 個 time unit，但同時做 2 個 → throughput ×2 ✓', 2.4, 1.3);
    cap('一個工作還是要 10 個 time unit', '但同時做兩個：throughput 增加');
  },
  async (tok, S) => { // 1687.0 不見得有絕對關係
    sm('throughput 變好，response time 不見得變好', -2.6, 0.5);
    cap('兩者不見得有絕對關係', '');
  },
  async (tok, S) => { // 1700.0 focus response time
    good('之後主要 focus 在 response time', 0, -0.3);
    cap('後面主要專注在 response time', '丟一個 job 進去要多久出來');
  },
]);

scene('nuA-3a-elapsed', 'Elapsed time 與 CPU time', [
  async (tok, S) => { // 1712.5 response time 細分
    hot('response time 再細分', 0, 6.4);
    cap('就算是 response time', '也要再細分');
  },
  async (tok, S) => { // 1723.8 elapsed time
    hd('elapsed time：時鐘上過了多久（例：10:40 → 過 1 分鐘）', 0, 5.4);
    cap('elapsed time：時鐘時間', '從丟進去到出來，牆上的時鐘過了多久');
  },
  async (tok, S) => { // 1741.9 包括什麼
    const parts = [['CPU', 4, NC.purple], ['I/O', 2, NC.orange], ['OS', 1.5, NC.teal], ['idle', 1.5, NC.gray]]; let x = -4.5;
    S.parts = parts.map(([n, w, c]) => { const m = bx(n, c, x + w / 2, 4.2, 0, w - 0.05, 0.7, 0.8); x += w; return m; });
    sm('（各段長短為示意）', 0, 3.7);
    cap('它包括 CPU 在算的時間', '還有 I/O、OS、idle 的時間');
  },
  async (tok, S) => { // 1784.0 system performance
    sm('elapsed time → 決定 system performance（CPU ＋ OS ＋ I/O）', 0, 3.1);
    cap('elapsed time 決定 system performance', '整個系統不只 CPU，還有 OS、I/O');
  },
  async (tok, S) => { // 1796.3 CPU time
    S.parts.slice(1).forEach((m) => { m.material.transparent = true; m.material.opacity = 0.2; }); glow(S.parts[0], HL);
    hot('設計 processor：只看 CPU time', -2.5, 2.6);
    cap('如果只看 CPU', '就把其他時間拿掉，只看 CPU time');
  },
  async (tok, S) => { // 1822.5 user + system CPU time
    S.u = bx('user CPU', NC.purple, -3.6, 1.6, 0, 1.9, 0.5, 0.7); S.s = bx('system CPU', '#b9a3f5', -1.6, 1.6, 0, 1.9, 0.5, 0.7);
    sm('CPU time ＝ user CPU time ＋ system CPU time', -2.5, 0.9);
    cap('CPU time 又分兩部分', '跑 application 的 user 時間 + 跑 OS 的 system 時間');
  },
  async (tok, S) => { // 1839.7 不是絕對關係
    sm('CPU 很快，系統不一定好；系統好，CPU 不一定快', 2.6, 1.6);
    cap('system performance 和 CPU 不是絕對關係', 'CPU 快，其他地方處理不好也沒用');
  },
  async (tok, S) => { // 1867.3 benchmark
    sm('不同 program 表現不同 → 要選對的 benchmark', 0, -0.2);
    cap('不同 program 表現也不同', '所以 benchmark 要看你要量什麼');
  },
  async (tok, S) => { // 1885.4 科學家 vs 銀行
    bub('科學家：CPU 計算很重 → 測 CPU', -3.0, -1.0); bub('銀行：transaction、I/O → 測整個系統', 3.0, -1.0);
    cap('科學家一天到晚跑 CPU 很重的程式', '銀行重視 I/O，要看整個系統');
  },
]);

scene('nuA-3a-rel', 'Relative performance：A 比 B 快幾倍', [
  async (tok, S) => { // 1931.1 relative performance
    S.A = buddy('computer A', '', NC.sky, -3.6, 3.0, 0, 0.9); S.B = buddy('computer B', '', NC.orange, 3.6, 3.0, 0, 0.9);
    cap('relative performance', '兩台機器 A、B，誰比較好？');
  },
  async (tok, S) => { // 1952.2 用 execution time
    sm('用 execution time（response time）來比', 0, 5.6);
    cap('我們著重 response time', '用 execution time 來比');
  },
  async (tok, S) => { // 1960.5 performance = 1 / time
    hot('時間越長 → performance 越差：performance ＝ 1 ／ execution time', 0, 6.4);
    cap('時間越長，performance 越壞', 'performance 和時間是倒數關係');
  },
  async (tok, S) => { // 1976.9 公式
    mt('X 比 Y 快 n 倍：n = Performance_X / Performance_Y = Time_Y / Time_X', 0, 1.6);
    cap('X 比 Y 快幾倍', '把 Y 的時間放分子、X 的時間放分母');
  },
  async (tok, S) => { // 1995.8 A 10 s、B 15 s
    S.A.set('10 s'); S.B.set('15 s'); S.ba = vbar(NC.sky, -1.0, 1.0, 0.7, -0.6); S.bb = vbar(NC.orange, 1.0, 1.5, 0.7, -0.6);
    cap('例：A 跑 10 秒，B 跑 15 秒', 'A 比 B 好多少？');
  },
  async (tok, S) => { // 2005.7 15/10 = 1.5
    const n = 15 / 10; ok(n === 1.5, 'Time_B / Time_A = 15 / 10 = ' + n + ' → A 比 B 快 1.5 倍 ✓', 0, 0.9); S.A.mood('happy');
    cap('B 的時間放分子、A 的放分母', '15 ÷ 10 = 1.5：A 比 B 快 1.5 倍');
  },
  async (tok, S) => { // 2032.1 很簡單
    sm('很簡單，但越簡單越容易搞混：分子是「比較慢的那台」的時間', 0, 0.2);
    cap('這公式很簡單', '但越簡單越容易搞混，小心分子分母');
  },
]);

scene('nuA-3a-clock', 'Clock：period 與 rate', [
  async (tok, S) => { // 2043.3 用 clock
    hot('看 CPU 跑多快：用 clock', 0, 6.4);
    cap('再進一步看 CPU 跑多快', '要用一個叫 clock 的東西');
  },
  async (tok, S) => { // 2060.4 high low high low
    S.w = []; for (let k = 0; k < 6; k++) { const x = -5 + k * 1.8; seg(x, 2.0, x, 4.0, '#4b9ee2', 0); seg(x, 4.0, x + 0.9, 4.0, '#4b9ee2', 0); seg(x + 0.9, 4.0, x + 0.9, 2.0, '#4b9ee2', 0); seg(x + 0.9, 2.0, x + 1.8, 2.0, '#4b9ee2', 0); }
    sm('high', -6.2, 4.0); sm('low', -6.2, 2.0);
    cap('clock 是一個 signal', '很規律地 high、low、high、low');
  },
  async (tok, S) => { // 2074.2 constant rate
    sm('固定速度，不會變（constant rate）', 0, 4.6);
    cap('跑得很穩定', '快慢是固定的 constant rate');
  },
  async (tok, S) => { // 2080.5 控制 state
    S.ed = cube('', NC.gold, [0.15, 2.4, 0.15], -3.2, 3.0, 0.1); sm('每個 clock 到 → computation 要做完、存下一個 state', 0, 1.3);
    cap('clock 控制 computer 的 state', 'clock 到的時候，這次 computation 要做完');
  },
  async (tok, S) => { // 2111.3 控制 data transfer
    sm('clock 控制 data transfer 和 computation；用了幾個 clock 就是花了多少', 0, 0.7);
    cap('clock 控制 data transfer 和 computation', '算花多少時間，就是算用了幾個 clock');
  },
  async (tok, S) => { // 2132.7 clock period
    S.pa = lk(-5, 4.5, -3.2, 4.5, 0xd64545); hot('clock period（一個 cycle）', -4.1, 5.1);
    cap('一個 high + low 叫一個 clock period', '');
  },
  async (tok, S) => { // 2143.1 period 長
    sm('period 長：一個 cycle 能做很多事，但跳得慢', 3.0, 5.6);
    cap('clock period 拉很長', '一個 cycle 能做很多事，但跳得很慢');
  },
  async (tok, S) => { // 2170.0 clock rate
    sm('clock rate（frequency）：每秒跳幾下', 3.0, 5.1);
    cap('單位時間跳幾下', '叫 clock rate、clock frequency');
  },
  async (tok, S) => { // 2187.0 250 ps
    const ps = 250, ns = ps / 1000; ok(ns === 0.25, 'clock period 250 ps = ' + ns + ' ns = 250 × 10⁻¹² s ✓', 0, -0.3);
    cap('例：clock period 250 picosecond', '= 0.25 ns = 250 × 10⁻¹² 秒');
  },
  async (tok, S) => { // 2202.7 frequency = 1 / period
    mt('clock rate = 1 ／ clock period', 0, -0.9);
    cap('clock frequency 是每秒跑幾個 cycle', '和 period 是倒數關係');
  },
  async (tok, S) => { // 2216.2 4 GHz
    const r = 1 / 250e-12; ok(Math.abs(r - 4e9) < 1, '4 GHz = 4 × 10⁹ 次／秒；1 ／ 250 ps = ' + r / 1e9 + ' GHz ✓', 0, -1.5);
    cap('4 GHz：每秒跑 4 × 10⁹ 個 cycle', 'GHz → MHz 加 3 個 0，再加 6 個 0 是 Hz');
  },
]);

scene('nuA-3a-cputime', 'CPU time = clock cycles × clock cycle time', [
  async (tok, S) => { // 2246.3 用 clock 衡量
    hot('用 clock 衡量 CPU 效能', 0, 6.4);
    cap('常用 clock 來衡量 CPU 的效能', '');
  },
  async (tok, S) => { // 2251.7 公式 1
    mt('CPU time = CPU clock cycles × clock cycle time', 0, 5.4, 'ptr');
    cap('CPU time = 用了幾個 clock cycle', '× 每個 cycle 多少時間');
  },
  async (tok, S) => { // 2283.5 ÷ clock rate
    mt('         = CPU clock cycles ÷ clock rate', 0, 4.8, 'ptr');
    cap('cycle time 和 clock rate 是倒數', '所以也可以除以 clock rate');
  },
  async (tok, S) => { // 2297.8 100 clock/s、1000 clocks
    const t = 1000 / 100; ok(t === 10, '示意（老師）：每秒 100 個 clock，跑了 1000 個 → 1000 ÷ 100 = ' + t + ' s ✓', 0, 4.0);
    cap('每秒跑 100 個 clock，總共跑 1000 個', '除一下：10 秒');
  },
  async (tok, S) => { // 2320.1 減少 cycle 數
    S.a = good('改善方法 ①：減少 clock cycle 數', -2.6, 3.0);
    cap('要 improve performance', '可以減少 number of clock cycles');
  },
  async (tok, S) => { // 2340.4 提高 clock rate
    S.b = good('改善方法 ②：提高 clock rate（period 變短）', 2.6, 3.0);
    cap('也可以把 clock rate 變快', '就是把 clock period 變小');
  },
  async (tok, S) => { // 2363.8 一定變好嗎？
    bub('clock period 變小，效能一定變好？', 0, 2.2);
    cap('把 clock period 變小', '效能一定會變好嗎？');
  },
  async (tok, S) => { // 2434.5 cycle 數不變才一定
    sm('如果 cycle 數不變：當然變快', 0, 1.5);
    cap('如果 clock cycle 數不變', '那當然變快');
  },
  async (tok, S) => { // 2462.9 原本 1 cycle 做完的可能要 2 cycle
    const job = 1.0; const T1 = 1.0, T2 = 0.6; const c1 = Math.ceil(job / T1), c2 = Math.ceil(job / T2);
    S.c1 = bx('1 cycle（period 1.0）', NC.sky, -2.6, 0.4, 0, 2.6, 0.5, 0.7);
    S.c2 = [0, 1].map((i) => bx('', NC.orange, 1.0 + i * 1.6, 0.4, 0, 1.5, 0.5, 0.7));
    ok(c2 === 2 && c2 * T2 > c1 * T1, '示意：period 1.0 → 0.6，工作做不完要 ' + c2 + ' 個 cycle：' + c2 * T2 + ' > 1.0 ✓', 0, -0.4);
    cap('period 變短，原本一個 cycle 做得完的', '可能做不完，要變兩個 cycle');
  },
  async (tok, S) => { // 2483.5 trade-off
    good('hardware designer 要 trade off clock rate 和 clock cycle count', 0, -1.2);
    cap('hardware designer 要做 trade-off', 'clock rate 對上 clock cycle count');
  },
]);

scene('nuA-3a-ex', '例題：A 是 2 GHz、10 秒；B 要 6 秒', [
  async (tok, S) => { // 2508.4 A：2 GHz、10 s
    S.A = buddy('computer A', '2 GHz', NC.sky, -4.6, 3.6, 0, 0.9); sm('CPU time 10 s', -4.6, 3.0);
    cap('例題：computer A 是 2 GHz', '跑這個程式 CPU time 10 秒');
  },
  async (tok, S) => { // 2522.0 B 要 6 s
    S.B = buddy('computer B', '? GHz', NC.orange, 4.6, 3.6, 0, 0.9); sm('目標 CPU time 6 s', 4.6, 3.0);
    cap('新設計 B：希望降到 6 秒', '');
  },
  async (tok, S) => { // 2531.0 cycle 數 ×1.2
    sm('但 B 的 clock cycles 會變成 A 的 1.2 倍', 4.6, 2.4);
    cap('但 clock rate 變快，cycle 數不會維持', 'B 的 total cycle count 是 A 的 1.2 倍');
  },
  async (tok, S) => { // 2549.0 B 的 clock rate？
    hot('B 的 clock rate 要多少？', 0, 6.4);
    cap('B 的 clock rate 要多快', '才能降到 6 秒？');
  },
  async (tok, S) => { // 2591.7 clock rate_B = cycles_B / 6 s
    S.l = list(-1.8, 5.6, 0.55, ''); mono(S.l.add('Clock Rate_B = Clock Cycles_B ÷ CPU Time_B'));
    mono(S.l.add('             = Clock Cycles_B ÷ 6 s'));
    cap('clock rate = 總 cycle 數 ÷ CPU time', 'CPU time 是 6 秒，已知');
  },
  async (tok, S) => { // 2636.9 cycles_B = 1.2 × cycles_A
    mono(S.l.add('Clock Cycles_B = 1.2 × Clock Cycles_A'));
    cap('B 的 cycle 數不知道', '只知道是 A 的 1.2 倍');
  },
  async (tok, S) => { // 2650.4 cycles_A
    const cA = 10 * 2e9; mono(S.l.add('Clock Cycles_A = 10 s × 2 GHz = ' + cA / 1e9 + ' × 10⁹'));
    S.stA = []; for (let k = 0; k < 10; k++) S.stA.push(cube(k === 9 ? '20×10⁹' : '', NC.sky, [1.2, 0.3, 0.8], -4.6, -0.6 + k * 0.33, 1.2));
    ok(cA === 20e9, 'A 的 cycles：CPU time × clock rate = 20 × 10⁹ ✓', -4.6, -1.3);
    cap('A 的 cycle 數：一秒跑 2G 次、跑 10 秒', '相乘 = 20 × 10⁹');
  },
  async (tok, S) => { // 2691.9 代回 → 4 GHz
    const cB = 1.2 * 20e9, r = cB / 6; mono(S.l.add('Clock Rate_B = 1.2 × 20×10⁹ ÷ 6 s = ' + r / 1e9 + ' GHz'));
    S.stB = []; for (let k = 0; k < 12; k++) S.stB.push(cube(k === 11 ? '24×10⁹' : '', NC.orange, [1.2, 0.3, 0.8], 4.6, -0.6 + k * 0.33, 1.2));
    S.B.set(r / 1e9 + ' GHz'); S.B.mood('happy'); ok(Math.abs(r - 4e9) < 1, 'B 要 4 GHz 才能從 10 s 降到 6 s ✓', 0.0, 2.0);
    cap('代進去：24 × 10⁹ ÷ 6 s', '= 4 GHz');
  },
  async (tok, S) => { // 2707.4 公式很簡單
    sm('公式看起來複雜，其實比高中數學還簡單', 0, 1.3);
    cap('這些公式其實都很簡單', '不要自己把自己搞複雜');
  },
]);

scene('nuA-3a-cpi', 'Instruction count 與 CPI', [
  async (tok, S) => { // 2725.4 剛才 low level
    sm('剛才：clock、cycle → 很 low level（hardware）', 0, 6.5);
    cap('剛才是比較 low level 的', 'CPU 和 clock 的關係');
  },
  async (tok, S) => { // 2732.8 programmer 看 instruction
    S.cc = code(['C program', '   ↓ compiler', 'instruction 1', 'instruction 2', '…'], -4.0, 5.6, 0.48);
    cap('programmer 看的是 instruction level', '程式 compile 後有多少個 instruction');
  },
  async (tok, S) => { // 2752.4 instruction count
    hot('Instruction Count（IC）：程式翻成多少個 instruction', 1.6, 5.6);
    cap('instruction count', '程式轉成 ISA 的 instruction 後，一共有多少個');
  },
  async (tok, S) => { // 2781.5 CPI
    hot('CPI：Clock cycles Per Instruction', 1.6, 4.9);
    cap('另一個叫 CPI', 'clock per instruction：一個 instruction 要幾個 clock');
  },
  async (tok, S) => { // 2792.1 ripple vs lookahead
    S.r = [0, 1, 2, 3, 4].map((i) => bx('', NC.orange, -1.4 + i * 0.7, 3.6, 0, 0.6, 0.4, 0.6)); sm('carry ripple adder：假設 5 cycles', 3.6, 3.6);
    S.l = [0, 1].map((i) => bx('', NC.green, -1.4 + i * 0.7, 2.9, 0, 0.6, 0.4, 0.6)); sm('carry lookahead：hardware 大，假設 2 cycles', 3.6, 2.9);
    cap('同樣是加法：carry ripple 要一直傳', '假設 5 個 cycle；carry lookahead 可能 2 個');
  },
  async (tok, S) => { // 2835.4 乘法 shift and add
    sm('乘法 shift-and-add：8 bit × 8 bit 至少加 8 次 → CPI 比加法大', 1.6, 2.1);
    cap('乘法是 shift and add', '8 bit 乘 8 bit 至少加 8 次，時間不一樣');
  },
  async (tok, S) => { // 2860.0 IC × CPI = total cycles
    mt('Clock Cycles = Instruction Count × CPI', 0, 1.0, 'ptr');
    cap('instruction count × CPI', '就是 total clock cycles');
  },
  async (tok, S) => { // 2880.5 × cycle time
    mt('CPU Time = IC × CPI × Clock Cycle Time = IC × CPI ÷ Clock Rate', 0, 0.3, 'ptr alt');
    cap('再乘以 clock cycle time（或除以 clock rate）', '就是 CPU time');
  },
]);

scene('nuA-3a-ic', 'Instruction count 和 CPI 受什麼影響', [
  async (tok, S) => { // 2905.1 IC 怎麼來
    hot('一個 program 的 instruction count 跟什麼有關？', 0, 6.4);
    cap('一個 program 的 instruction count', '是怎麼決定的？');
  },
  async (tok, S) => { // 2918.5 program
    S.l = list(-5.6, 5.6, 0.55, 'ptr'); S.l.add('① program：同樣寫 sorting，你寫 100 行、他寫 80 行');
    cap('同樣叫你寫 sorting', '每個人寫得不一樣，instruction 就不一樣');
  },
  async (tok, S) => { // 2937.9 algorithm
    S.l.add('② algorithm：quick sort vs bubble sort');
    cap('用不同的 sorting algorithm', 'quick sort、bubble sort 出來也不一樣');
  },
  async (tok, S) => { // 2949.3 algorithm 重要
    sm('所以要學 algorithm、data structure：不只是 machine 的問題', 0, 4.4);
    cap('所以 algorithm、data structure 很重要', '寫好程式，用很少 instruction 做完');
  },
  async (tok, S) => { // 2967.8 ISA：a + b + c
    const a = 1, b = 2, c = 3; let x1 = a + b + c; let t = a + b; const x2 = t + c;
    S.l.add('③ ISA：x = a + b + c');
    mt('三個 operand 一次加：add3 x, a, b, c   → 1 個', -1.4, 3.6); mt('只准兩個：add t, a, b ; add x, t, c   → 2 個', -1.4, 3.1);
    ok(x1 === x2, '示意 a=1、b=2、c=3：兩種都得 ' + x2 + '，instruction 數 1 vs 2 ✓', -1.4, 2.5);
    cap('ISA 也有關：x = a + b + c', '有三 operand 的 instruction 一個就好，否則要兩個');
  },
  async (tok, S) => { // 3018.8 compiler：loop invariant
    const n = 140; const before = n, after = 1;
    S.l2 = list(-5.6, 1.9, 0.5, 'ptr'); S.l2.add('④ compiler：迴圈裡放了不會變的 a = 5（示意）');
    ok(before - after === 139, '跑 ' + n + ' 次就做 ' + n + ' 次；搬到 loop 外只做 1 次，省 ' + (before - after) + ' 個 ✓', -1.4, 1.3);
    cap('compiler 也會影響', '發現 loop 裡的 constant，把它搬到外面');
  },
  async (tok, S) => { // 3070.3 CPI 跟 hardware
    hot('CPI 跟 hardware 有關（ripple vs lookahead）', 2.8, 0.5);
    cap('一個 instruction 要幾個 cycle', '跟 hardware 怎麼 implement 有關');
  },
  async (tok, S) => { // 3095.2 平均 CPI
    sm('不同 instruction 不同 CPI → 平均 CPI 看各類 instruction 的比例', 0, -0.2);
    cap('乘和加的 CPI 當然不同', '平均 CPI 要看各類 instruction 佔多少');
  },
  async (tok, S) => { // 3120.9 × 2⁵ → shift
    const A = 3, r = A * 2 ** 5, s = A << 5; ok(r === s, 'A × 2⁵ = A 左移 5 位（示意 A = 3：' + r + ' = ' + s + '）✓', 0, -0.8);
    cap('例：A 乘以 2 的 5 次方', '其實只要 shift 5 個 bit，一個簡單 instruction');
  },
  async (tok, S) => { // 3147.6 平均 CPI 變小
    good('簡單 instruction 多、難的少 → 平均 CPI 變小', 0, -1.4);
    cap('簡單的 instruction 變多', 'overall 平均 CPI 就變小');
  },
]);

// ════════ -iVii4A6cQg（第 9A 講：Instruction Set Architecture 收尾） ════════
const FMT = [['R', [['op', 6], ['rs', 5], ['rt', 5], ['rd', 5], ['shamt', 5], ['funct', 6]]], ['I', [['op', 6], ['rs', 5], ['rt', 5], ['immediate', 16]]], ['J', [['op', 6], ['address', 26]]]];
function fmtRow(S, r, y) {
  const [n, fs] = FMT[r]; let x = -5.2; const ms = [hd(n + '-type', -6.0, y)];
  fs.forEach(([nm, w]) => { const W = w * 0.35; ms.push(bx(nm + ' ' + w, r === 0 ? NC.sky : r === 1 ? NC.mint : NC.lilac, x + W / 2, y, 0, W - 0.05, 0.55, 0.6)); x += W; });
  return ms;
}

scene('nuA-9a-recap', '回顧：R、I、J 三種 format', [
  async (tok, S) => { // 17.0 三種 format
    S.f = [0, 1, 2].map((r) => fmtRow(S, r, 5.0 - r * 0.9));
    ok(FMT.every(([, fs]) => fs.reduce((s, [, w]) => s + w, 0) === 32), '三種都 32 bits ✓', 4.0, 6.0);
    cap('上次介紹三種 instruction format', 'R-type、I-type、J-type');
  },
  async (tok, S) => { // 24.6 要記起來
    bub('哪一類 instruction 長什麼樣，要趕快記起來', 0, 1.8);
    cap('每一類長什麼樣子要記起來', '不知道菜名，怎麼炒菜？');
  },
  async (tok, S) => { // 29.6 之後 hardware
    sm('這章之後：hardware 怎麼 implement 這些 instruction', 0, 1.0);
    cap('這章結束後', '就要介紹 hardware 怎麼 implement 它們');
  },
  async (tok, S) => { // 44.4 software 怎麼 run
    good('這章最後：software 怎麼把 program 跑起來', 0, 0.2);
    cap('這章最後', '再看 software 怎麼 run 這些 program');
  },
]);

scene('nuA-9a-chain', '從 C program 到記憶體：compiler、assembler、linker、loader', [
  async (tok, S) => { // 54.1 C program
    S.c = bx('C program', NC.mint, -4.6, 6.0, 0, 2.6, 0.55, 0.8);
    cap('一個 C program', '');
  },
  async (tok, S) => { // 60.6 compiler / assembler → object
    lk(-4.6, 5.7, -4.6, 4.9); sm('compiler', -3.4, 5.3); S.as = bx('assembly', NC.lilac, -4.6, 4.6, 0, 2.6, 0.55, 0.8);
    lk(-4.6, 4.3, -4.6, 3.5); sm('assembler', -3.4, 3.9); S.ob = bx('object module（machine language）', NC.sky, -3.6, 3.2, 0, 4.6, 0.55, 0.8);
    cap('經過 compiler、assembler', '產生 object 的 machine language module');
  },
  async (tok, S) => { // 66.5 library
    S.lib = bx('library routine（machine language）', NC.tan, 2.6, 3.2, 0, 4.4, 0.55, 0.8);
    cap('很多 library 不是你寫的', '或是以前寫好的 subroutine');
  },
  async (tok, S) => { // 71.6 linker → executable
    lk(-3.6, 2.9, -0.4, 1.9); lk(2.6, 2.9, 0.4, 1.9); sm('linker', 1.6, 2.4); S.ex = bx('executable（machine language program）', NC.gold, 0, 1.6, 0, 5.0, 0.55, 0.8);
    cap('linker 把它們連起來', '變成 executable 的 machine language program');
  },
  async (tok, S) => { // 78.5 loader → memory
    lk(0, 1.3, 0, 0.5); sm('loader', 1.0, 0.9); S.mem = bx('memory', NC.sky, 0, 0.2, 0, 3.0, 0.55, 0.8);
    cap('再用 loader 把它 load 到 memory', '程式就可以開始執行');
  },
  async (tok, S) => { // 89.8 我們寫 C
    bub('我們只想寫 C；assembly 寫起來好長', -4.6, 6.8);
    cap('我們寫的是 C program', 'assembly 一點點東西就寫好長，希望 compiler 代勞');
  },
  async (tok, S) => { // 104.8 assembler 一對一
    glow(S.as, HL); glow(S.ob, HL); sm('assembler ≈ 一對一的轉換', 2.4, 4.6);
    cap('assembler 基本上是一對一轉換', 'symbolic 的 load、store 翻成 0101');
  },
]);

scene('nuA-9a-pseudo', 'Pseudo-instruction 與 $at', [
  async (tok, S) => { // 136.8 assembler 的作用
    hot('assembler 還做什麼？', 0, 6.5);
    cap('assembler、linker、loader', '各要做些什麼事？');
  },
  async (tok, S) => { // 144.6 pseudo-instruction
    hd('pseudo-instruction（假指令）', 0, 5.9);
    cap('assembler 有一種叫 pseudo-instruction', '');
  },
  async (tok, S) => { // 151.9 真指令 = 有硬體
    sm('真的 instruction：一定有 hardware 去執行它', 0, 5.3);
    cap('instruction set design：設計一個 instruction', '就要有對應的 hardware 執行它');
  },
  async (tok, S) => { // 172.1 move
    S.mv = mt('move $t0, $t1      # 寫起來方便', -2.2, 4.4, 'ptr');
    cap('有些 instruction 只是寫起來方便', '例如 move $t0, $t1');
  },
  async (tok, S) => { // 188.4 沒有 register→register 的路
    bad('沒有一條 register → register 直接 move 的 hardware', -2.2, 3.8);
    cap('並沒有真正的硬體做 move', '沒有 register 直接到 register 的 path');
  },
  async (tok, S) => { // 202.5 add $t0,$zero,$t1
    const t1 = 7, zero = 0, t0 = zero + t1;
    mt('→ add  $t0, $zero, $t1   # 0 + $t1 經過 ALU', -2.2, 3.2, 'good');
    ok(t0 === t1, '示意 $t1 = 7：0 + 7 = ' + t0 + '，等於把 $t1 搬到 $t0 ✓', 3.2, 2.6);
    cap('把 0 加上 $t1 再放到 $t0', '經過 ALU，效果就是 move');
  },
  async (tok, S) => { // 213.8 blt
    S.bl = mt('blt $t0, $t1, L    # branch if less than', -2.2, 1.8, 'ptr');
    cap('又例如 blt：branch less than', '');
  },
  async (tok, S) => { // 221.4 沒有硬體
    bad('也沒有「比小再跳」的 hardware', -2.2, 1.2);
    cap('也沒有這個 hardware', '沒有一個硬體去比大小再跳');
  },
  async (tok, S) => { // 229.0 slt + bne
    mt('→ slt  $at, $t0, $t1     # $at = ($t0 < $t1)', -2.2, 0.6, 'good'); mt('  bne  $at, $zero, L     # $at ≠ 0 就跳', -2.2, 0.1, 'good');
    cap('最後用 set on less than', '加上 branch not equal 來 implement');
  },
  async (tok, S) => { // 257.6 需要第三個 register
    S.q = bub('原本只用 $t0、$t1，現在要第 3 個 register！', 3.6, 4.4);
    cap('問題來了：你只用了兩個 register', '轉成兩個 instruction 卻要三個');
  },
  async (tok, S) => { // 285.0 哪個沒用到？
    sm('programmer 用了 32 個裡的哪幾個？assembler 不知道', 3.6, 3.8);
    cap('要找一個沒用到的 register', '但 assembler 不知道 programmer 用了哪些');
  },
  async (tok, S) => { // 300.8 $at = register 1
    // 32 tiny cells: only 0, 1 and 31 are numbered (0 below, 1 above), so the numbers never sit on each other
    S.regs = []; for (let i = 0; i < 32; i++) S.regs.push(cube(i <= 1 || i === 31 ? String(i) : '', i === 1 ? NC.gold : i === 0 ? NC.gray : NC.off, [0.33, 0.33, 0.33], -5.6 + (i % 16) * 0.38, -1.1 - Math.floor(i / 16) * 0.42, 0.6));
    S.regs[0].userData.lbl.position.y = -0.62; S.regs[1].userData.lbl.position.y = 0.42;
    hot('register 1 ＝ $at：保留給 assembler，user 不准用', 3.6, -1.2);
    cap('所以 register 1 叫 $at', '保留給 assembler，user 的程式不能用');
  },
  async (tok, S) => { // 320.6 register 0 = 0
    sm('register 0 ＝ $zero：hardware 固定是 0', 3.6, -1.8);
    cap('register 0 一定是 hardware 的 0', '');
  },
  async (tok, S) => { // 358.0 slt 用 $at
    const t0 = 3, t1 = 5, at = t0 < t1 ? 1 : 0; relabel(S.regs[1], String(at));
    ok(at === 1, '示意 $t0 = 3、$t1 = 5：$at = 1 ≠ 0 → 跳到 L（3 < 5）✓', 3.6, -2.4);
    cap('slt 需要的第三個 register 就用 $at', '保證不會蓋到使用者的資料');
  },
], [[0, 2.6, 15], [0, 2.2, 0]]);

scene('nuA-9a-obj', 'Object module 裡有什麼', [
  async (tok, S) => { // 381.8 object module
    S.o = []; hot('object module（例如一個 subroutine 一個）', 0, 6.5);
    cap('經過 compiler、assembler', '產生 object module，待會 linker 再連');
  },
  async (tok, S) => { // 397.0 header
    S.o.push(bx('header：描述裡面有什麼', NC.gold, -2.0, 5.5, 0, 5.4, 0.55, 0.9));
    cap('要提供 header', '描述這個 module 裡面有什麼');
  },
  async (tok, S) => { // 412.4 text segment
    S.o.push(bx('text segment：翻好的 instruction（0101）', NC.sky, -2.0, 4.85, 0, 5.4, 0.55, 0.9));
    cap('text segment', '已經 translate 成 machine instruction 的部分');
  },
  async (tok, S) => { // 422.3 static data
    S.o.push(bx('static data segment：一開始就配置的 storage', NC.mint, -2.0, 4.2, 0, 5.4, 0.55, 0.9));
    cap('static data segment', '程式一開始就要 allocate 的 storage');
  },
  async (tok, S) => { // 442.9 relocation info
    S.o.push(bx('relocation info：哪些 address 待會要補', NC.orange, -2.0, 3.55, 0, 5.4, 0.55, 0.9));
    cap('relocation information', '還不知道 absolute address，記下待會要補的地方');
  },
  async (tok, S) => { // 469.4 symbol table
    S.o.push(bx('symbol table：global 定義、external reference', NC.lilac, -2.0, 2.9, 0, 5.4, 0.55, 0.9));
    bub('呼叫 library 的 function（你沒寫）→ link 時補上', 3.6, 2.9);
    cap('symbol table', 'global definition、external reference，link 時補起來');
  },
  async (tok, S) => { // 491.3 debugging info
    S.o.push(bx('debugging info', NC.gray, -2.0, 2.25, 0, 5.4, 0.55, 0.9));
    cap('還有 debugging 的 information', '');
  },
]);

scene('nuA-9a-link', 'Linker 與 loader', [
  async (tok, S) => { // 495.3 linker
    S.m1 = bx('module A', NC.sky, -4.6, 5.4, 0, 2.2, 1.0, 0.9); S.m2 = bx('module B', NC.mint, -4.6, 4.1, 0, 2.2, 1.0, 0.9); S.m3 = bx('library', NC.tan, -4.6, 2.8, 0, 2.2, 1.0, 0.9);
    hot('linker', -1.6, 4.1);
    cap('linker 把這些 object module', 'link 起來');
  },
  async (tok, S) => { // 506.3 merge segments
    for (const [m, y] of [[S.m1, 5.2], [S.m2, 4.2], [S.m3, 3.2]]) await slide(tok, m, 1.4, y, 0, 300);
    sm('merge segments', 1.4, 6.1);
    cap('把各個 segment merge 起來', '');
  },
  async (tok, S) => { // 508.1 resolve labels
    sm('決定 label 的 address', 4.6, 5.2);
    cap('每個 subroutine 各自做好', '包起來後要把 label 的 address 決定');
  },
  async (tok, S) => { // 519.1 patch
    S.p = good('補上 location-dependent、external reference', 4.2, 4.4);
    cap('location dependent 和 external reference', '都把它補起來');
  },
  async (tok, S) => { // 528.1 loader：absolute
    S.mem = bx('memory', NC.sky, 1.4, 0.6, 0, 3.6, 0.8, 0.9); sm('loader：放到絕對位置（上半部？下半部？）', 1.4, -0.2);
    cap('linker 只排好相對位置', '真正放進 memory 的絕對位置是 loader 的事');
  },
  async (tok, S) => { // 546.4 virtual memory
    S.disk = prop('disk', -4.6, -0.4, 0, 0.8); sm('virtual memory：放 disk，需要時才搬', -4.6, 1.0);
    S.tb = bx('translation table（page table）', NC.lilac, -2.0, 2.0, 0, 3.2, 0.5, 0.8);
    cap('如果用 virtual memory', '不用一次全搬：放 disk，需要時才搬，有 table 記在哪');
  },
  async (tok, S) => { // 586.7 loading：header
    gone(S.p); S.st = list(4.4, 4.4, 0.5); S.st.add('Loading 步驟：', 'ptr'); S.st.add('① 讀 header：segment size');
    cap('load 一個 program：從 image 到 memory', '先知道各 segment 多大');
  },
  async (tok, S) => { // 596.3 create address space
    S.st.add('② create virtual address space');
    cap('create virtual address space', '有 virtual memory 的話設好就好，不用全搬');
  },
  async (tok, S) => { // 613.6 copy text、data；page table
    S.st.add('③ text、data 初始化（建 page table）');
    cap('把 text 和 initialized data 準備好', 'virtual memory 就建 page table，page fault 時一頁頁搬');
  },
  async (tok, S) => { // 636.6 arguments on stack
    S.st.add('④ arguments 放到 stack');
    cap('main 也是一個 procedure', '把 argument 設好放在 stack');
  },
  async (tok, S) => { // 650.6 registers
    S.st.add('⑤ initialize registers');
    cap('把 register initialize', '');
  },
  async (tok, S) => { // 653.0 跳到 startup → main
    S.st.add('⑥ 跳到 startup → 開始 run main', 'good');
    cap('然後就開始 run', '就像你跑 C program，從 main 開始');
  },
]);

scene('nuA-9a-opt', 'Compiler optimization：只看 IC 或 CPI 會誤判', [
  async (tok, S) => { // 725.0 圖分析
    hot('compiler optimization 的效果（課本圖，bubble sort）', 0, 6.6);
    S.lv = ['none', 'O1', 'O2', 'O3']; S.D = { perf: [1.00, 2.37, 2.38, 2.41], cyc: [158615, 66990, 66521, 65747], ic: [114938, 37470, 39993, 44993], cpi: [1.38, 1.79, 1.66, 1.46] };
    S.lv.forEach((n, i) => sm(n, -5.2 + i * 0.9, -0.3));
    cap('看幾張圖：compiler optimization', '到底扮演什麼角色？');
  },
  async (tok, S) => { // 738.1 relative performance
    S.bp = S.D.perf.map((v, i) => vbar(NC.green, -5.2 + i * 0.9, v * 1.6, 0.6, 0.2)); sm('relative performance', -3.9, 4.6);
    cap('relative performance：不做 optimization 當 1', '做了 O1、O2、O3 各是多少？');
  },
  async (tok, S) => { // 755.7 誰最好？
    bub('誰的 performance 最好？高好還是低好？', -3.9, 5.4);
    cap('這裡面誰的 performance 最好？', '一定要會看圖');
  },
  async (tok, S) => { // 804.1 O3
    glow(S.bp[3], HL); good('performance 越高越好 → O3 最高', -3.9, 5.9);
    cap('應該是 O3', '雖然差不太多，但 O3 最高');
  },
  async (tok, S) => { // 814.0 clock cycles
    S.bc = S.D.cyc.map((v, i) => vbar(NC.orange, 0.6 + i * 0.9, v / 40000, 0.6, 0.2)); sm('clock cycles（M）', 1.95, 4.6);
    cap('下面這張是 clock cycle count', 'clock period 一樣，cycle 越少越好');
  },
  async (tok, S) => { // 830.1 execution time 比
    const r = S.D.cyc[0] / S.D.cyc[3]; ok(Math.abs(r - 2.41) < 0.01, '158,615 ÷ 65,747 = ' + r.toFixed(2) + ' ＝ O3 的 relative performance ✓', 0.6, 5.4);
    cap('execution time 當比較基準', '沒優化的時間放分子、O3 的放分母');
  },
  async (tok, S) => { // 864.0 instruction count
    S.bi = S.D.ic.map((v, i) => vbar(NC.blue, 4.4 + i * 0.6, v / 40000, 0.45, 0.2)); sm('instruction count（M）', 5.3, 3.6);
    cap('再看 instruction count', '看起來好像越少越好');
  },
  async (tok, S) => { // 874.7 O1 最少？
    glow(S.bi[1], HL); bub('O1 的 IC 最少 → O1 最好？', 5.0, 4.4);
    cap('O1 的 instruction count 最少', '可以說 O1 的 performance 最好嗎？');
  },
  async (tok, S) => { // 903.8 IC、CPI
    S.cp = S.D.cpi.map((v, i) => mt(S.lv[i] + ' CPI ' + v.toFixed(2), 5.0, -0.5 - i * 0.4));
    cap('這邊又告訴我們 CPI', '一個 instruction 平均要幾個 clock cycle');
  },
  async (tok, S) => { // 927.1 不能單獨看
    bad('只看 IC 或只看 CPI 都不行', 0.6, -0.9);
    cap('單獨看 IC 或 CPI', '能判斷 execution time 嗎？不行');
  },
  async (tok, S) => { // 949.2 IC × CPI
    const c1 = S.D.ic[1] * S.D.cpi[1], c3 = S.D.ic[3] * S.D.cpi[3];
    ok(c3 < c1, 'O1：37,470 × 1.79 ≈ ' + fmtN(Math.round(c1)) + '；O3：44,993 × 1.46 ≈ ' + fmtN(Math.round(c3)) + ' → O3 cycles 較少 ✓', 0.6, -1.5);
    cap('要把 IC × CPI 乘起來', '才是真正的 clock cycles');
  },
  async (tok, S) => { // 980.6 結論
    good('評估 compiler：絕對不能單用 IC，也不能單用 CPI', 0.6, -2.1);
    cap('記住：絕對不能單獨用 IC 或 CPI', '判斷 compiler 效果好壞');
  },
], [[0, 3.0, 15], [0, 2.2, 0]]);

scene('nuA-9a-algo', 'Algorithm 比 compiler optimization 重要', [
  async (tok, S) => { // 994.1 bubble sort 圖
    hot('Bubble Sort 的 relative performance（課本圖）', -2.4, 6.5);
    cap('下一張圖', 'bubble sort 的 relative performance');
  },
  async (tok, S) => { // 1003.4 C：none、O1、O2、O3
    S.cb = [1.00, 2.37, 2.38, 2.41].map((v, i) => vbar(NC.green, -5.4 + i * 0.8, v * 1.4, 0.55, 0.2)); ['C none', 'O1', 'O2', 'O3'].forEach((n, i) => sm(n, -5.4 + i * 0.8, -0.3));
    cap('C：不做 optimization、O1、O2、O3', '');
  },
  async (tok, S) => { // 1009.2 Java interpreter、JIT
    S.jb = [0.12, 2.13].map((v, i) => vbar(NC.orange, -2.0 + i * 0.8, v * 1.4, 0.55, 0.2)); ['Java int.', 'JIT'].forEach((n, i) => sm(n, -2.0 + i * 0.8, -0.3));
    cap('Java：interpreter', '還有 just-in-time compiler');
  },
  async (tok, S) => { // 1017.1 C 和 Java 差很多
    sm('C 和 Java 的表現差很多', -3.0, 4.4);
    cap('C 和 Java 做出來', '有很大的差別');
  },
  async (tok, S) => { // 1032.2 quicksort
    hot('Quicksort（不同 algorithm）', 3.4, 6.5);
    S.qb = [1.00, 1.50, 1.50, 1.91].map((v, i) => vbar(NC.blue, 1.4 + i * 0.8, v * 1.4, 0.55, 0.2)); ['C none', 'O1', 'O2', 'O3'].forEach((n, i) => sm(n, 1.4 + i * 0.8, -0.3));
    cap('換 quicksort', '兩個是不同的 algorithm');
  },
  async (tok, S) => { // 1040.2 O1：2.37 vs 1.5
    glow(S.cb[1], HL); glow(S.qb[1], HL); mt('O1：bubble 2.37 倍（約 2.5）vs quick 1.5 倍', 0, 4.9);
    cap('bubble sort 的 O1 快了約 2.5 倍', 'quicksort 只有 1.5 倍');
  },
  async (tok, S) => { // 1049.9 Java 改善少
    S.qj = [0.05, 0.29].map((v, i) => vbar(NC.orange, 4.6 + i * 0.8, Math.max(0.08, v * 1.4), 0.55, 0.2)); ['Java int.', 'JIT'].forEach((n, i) => sm(n, 4.6 + i * 0.8, -0.3));
    cap('Java 的改善也比較少', '甚至比 C 不優化還差');
  },
  async (tok, S) => { // 1060.6 不同 program 不同結果
    sm('同樣的 compiler optimization，不同 program、不同 language → 結果不同', 0, 4.3);
    cap('不同的 program', '同樣的 optimization，結果不同');
  },
  async (tok, S) => { // 1074.7 quicksort vs bubble sort
    gone(S.cb, S.jb, S.qb, S.qj); S.big = vbar(NC.blue, 2.4, 5.0, 1.2, 0.2); S.small = vbar(NC.green, -2.4, 2.41 / 2468 * 5.0, 1.2, 0.2);
    hot('quicksort 比 bubble sort 快幾倍？', 0, 6.2);
    cap('最有意思的是這張', '拿 quicksort 跟 bubble sort 比');
  },
  async (tok, S) => { // 1130.8 2468 倍
    const sp = 2468; ok(sp > 1000, 'C 不優化：quicksort 比 bubble sort 快 ' + fmtN(sp) + ' 倍（老師說約 2500）✓', 2.4, 5.6);
    cap('進步是 2,000 多倍', '老師說大約 2500 倍');
  },
  async (tok, S) => { // 1138.9 compiler 只有 1.5～2.4
    ok(2.41 < 2468, 'compiler 再厲害：最多 ×2.41；換 algorithm：×2,468 ✓', -2.4, 1.0);
    cap('compiler 寫得再好', '改善也只有 1.5、2 倍多');
  },
  async (tok, S) => { // 1157.9 algorithm 重要
    good('寫好 algorithm 最重要；越上層的 optimization 改善越大', 0, -0.6);
    cap('寫好 algorithm 非常重要', '越上層的 optimization 得到越大的 improvement');
  },
  async (tok, S) => { // 1186.4 lessons learnt
    sm('Lessons：IC、CPI 不能單獨當 performance indicator；compiler optimization 對 algorithm 敏感；爛 program 差很遠', 0, -1.3);
    cap('Lessons learned', 'IC、CPI 不能單獨用；優化效果看 algorithm；程式要寫好');
  },
]);

scene('nuA-9a-ptr', 'Arrays vs pointers：strength reduction、induction variable elimination', [
  async (tok, S) => { // 1227.7 arrays vs pointers
    hot('Arrays vs Pointers：一個跟 compiler 有關的 optimization', 0, 6.6);
    cap('最後看 array 跟 pointer', '也是跟 compiler 有關的 optimization');
  },
  async (tok, S) => { // 1248.6 清 array
    S.mem = []; for (let i = 0; i < 8; i++) S.mem.push(cube('?', NC.sand, [0.6, 0.5, 0.6], -5.2 + i * 0.7, 5.6, 0)); sm('array[0..size−1]，每個 4 bytes', -2.8, 5.0);
    cap('把 array 全部清成 0', 'for i 從 0 到 size（例如 100）');
  },
  async (tok, S) => { // 1265.0 兩種寫法
    S.c1 = code(['clear1(int array[], int size) {', '  int i;', '  for (i = 0; i < size; i += 1)', '    array[i] = 0;', '}'], -3.4, 4.2, 0.4);
    S.c2 = code(['clear2(int *array, int size) {', '  int *p;', '  for (p = &array[0]; p < &array[size]; p = p + 1)', '    *p = 0;', '}'], 3.0, 4.2, 0.4);
    cap('有兩種寫法', 'array index 的寫法、memory pointer 的寫法');
  },
  async (tok, S) => { // 1273.3 pointer：每次 +4
    S.pp = hot('p', -5.2, 6.3); for (let i = 0; i < 3; i++) { await slide(tok, S.pp, -5.2 + (i + 1) * 0.7, 6.3, 0, 250); relabel(S.mem[i], '0'); }
    cap('pointer：直接指到 memory', '下一個就加一個 element 的大小（4 bytes）');
  },
  async (tok, S) => { // 1285.0 index：每次算地址
    sm('index：i = 0、1、2…，每次還要再算 address = base + i × 4', -2.8, 4.65);
    cap('array 寫法：i 一直 increment', '每次還要再算一次地址');
  },
  async (tok, S) => { // 1319.8 功能一樣
    sm('兩個功能完全一樣：都把 array 清成 0', 0, 2.0);
    cap('這兩個程式功能一樣', '一個用 index，一個用起始地址一路加');
  },
  async (tok, S) => { // 1395.8 array 版 assembly：×4 → sll
    gone(S.c1, S.c2); S.a1 = code(['       move $t0,$zero      # i = 0', 'loop1: sll  $t1,$t0,2      # $t1 = i × 4', '       add  $t2,$a0,$t1    # &array[i]', '       sw   $zero,0($t2)   # array[i] = 0', '       addi $t0,$t0,1      # i = i + 1', '       slt  $t3,$t0,$a1    # i < size ?', '       bne  $t3,$zero,loop1'], -3.0, 4.4, 0.42);
    S.a1.hl(1); const i = 5; ok((i << 2) === i * 4, 'i × 4 用 shift left 2 位（示意 i = 5：5 << 2 = 20）✓', -3.0, 1.2);
    cap('array 版轉成 assembly', 'i 要乘以 4，用 shift left 兩位來做');
  },
  async (tok, S) => { // 1440.4 迴圈 6 個 instruction
    S.a1.hl(3); S.n1 = hot('loop 裡 6 個 instruction', -3.0, 0.5);
    cap('算出地址、存 0、i 加 1', '檢查條件再跳回去：loop 裡 6 個');
  },
  async (tok, S) => { // 1462.3 pointer 版
    S.a2 = code(['       move $t0,$a0        # p = &array[0]', '       sll  $t1,$a1,2      # size × 4', '       add  $t2,$a0,$t1    # &array[size]', 'loop2: sw   $zero,0($t0)   # *p = 0', '       addi $t0,$t0,4      # p = p + 4', '       slt  $t3,$t0,$t2    # p < &array[size] ?', '       bne  $t3,$zero,loop2'], 3.4, 4.4, 0.42);
    S.a2.hl(4);
    cap('pointer 版：直接給 memory 起始地址', '每次 p = p + 4');
  },
  async (tok, S) => { // 1506.5 loop 只剩 4 個
    S.n2 = hot('loop 裡只剩 4 個', 3.4, 0.5);
    cap('loop 裡沒有 i 的 increment', '也沒有乘以 4：搬到 loop 外面了');
  },
  async (tok, S) => { // 1521.7 跑 100 次省 200
    const N = 100, saved = (6 - 4) * N; ok(saved === 200, '每圈省 6 − 4 = 2 個；跑 ' + N + ' 次省 ' + saved + ' 個 instruction ✓', 0, -0.2);
    cap('loop 跑 100 次', '每次省兩個，就省了 200 個 instruction');
  },
  async (tok, S) => { // 1553.5 strength reduction
    good('strength reduction：multiply → shift', -3.0, -0.9);
    cap('compiler 術語：strength reduction', '把乘法換成 shift');
  },
  async (tok, S) => { // 1584.5 induction variable elimination
    good('induction variable elimination：6 → 4 個', 3.4, -0.9);
    cap('另一個：induction variable elimination', '把 index 計算移出 loop，6 個變 4 個');
  },
  async (tok, S) => { // 1618.4 好 compiler 會做
    sm('好的 compiler 會自動做；你應該寫看得懂的 array 版本', 0, -1.6);
    cap('好的 compiler 應該幫你做這些', '寫程式時還是寫 readable 的版本');
  },
], [[0, 3.2, 15], [0, 2.6, 0]]);

scene('nuA-9a-arm', 'ARM 和 MIPS 的比較；condition code', [
  async (tok, S) => { // 1669.3 其他 ISA
    hot('MIPS 介紹完，看看其他 ISA：ARM、x86（只給概念）', 0, 6.6);
    cap('MIPS 大致介紹完', '看看其他 instruction set：ARM、x86');
  },
  async (tok, S) => { // 1711.2 MIPS、ARM 最像
    S.t = list(-5.6, 5.8, 0.5); mono(S.t.add('               MIPS        ARM', 'ptr'));
    cap('MIPS 和 ARM 最相近', '都是 RISC 的 instruction set architecture');
  },
  async (tok, S) => { // 1720.0 ARM 最 popular embedded
    sm('ARM：最 popular 的 embedded core（手機），數量超過 x86', 2.6, 4.6);
    cap('ARM 是最 popular 的 embedded core', '手機都用 ARM，用量已超過 x86');
  },
  async (tok, S) => { // 1746.5 1985、32-bit
    mono(S.t.add('公布年份        1985        1985')); mono(S.t.add('instruction    32 bits     32 bits')); mono(S.t.add('address space  32 bits     32 bits'));
    cap('都是 85 年出來的', 'instruction、address space 都是 32 bits');
  },
  async (tok, S) => { // 1756.9 aligned、addressing mode
    mono(S.t.add('data aligned   要          要')); mono(S.t.add('addressing     較少        較多'));
    cap('data 要 align', 'addressing mode：MIPS 少、ARM 多');
  },
  async (tok, S) => { // 1764.7 registers
    mono(S.t.add('registers      32 個       16 個'));
    cap('register：MIPS 32 個、ARM 16 個', '');
  },
  async (tok, S) => { // 1775.6 memory-mapped I/O
    mono(S.t.add('I/O            memory mapped（一樣）'));
    cap('I/O 都是 memory mapped', '只有一點點差別');
  },
  async (tok, S) => { // 1784.1 condition 4 bits
    hd('ARM 最大差別：每個 instruction 前面 4 bits 的 condition', 2.8, 3.6);
    cap('ARM 每個 instruction 前面有 4 bits', '叫 condition，決定要不要執行它');
  },
  async (tok, S) => { // 1803.4 MIPS：slt + beq
    mt('MIPS：slt $t0,$s1,$s2 ; bne $t0,$zero,L', 2.8, 2.9);
    cap('MIPS 要跳時', 'set on less than 結果放一個 register，再 branch 去測');
  },
  async (tok, S) => { // 1831.0 status register NZCV
    S.cc = ['N', 'Z', 'C', 'V'].map((t, i) => bx(t, NC.off, 1.6 + i * 0.75, 2.0, 0, 0.6, 0.5, 0.6)); sm('condition code：negative、zero、carry、overflow', 2.8, 1.3);
    cap('ARM 有一個專門的 status register', '放 negative、zero、carry、overflow');
  },
  async (tok, S) => { // 1912.3 CMP
    const r1 = 3, r2 = 5, d = r1 - r2; const N = d < 0 ? 1 : 0, Z = d === 0 ? 1 : 0;
    relabel(S.cc[0], 'N=' + N); relabel(S.cc[1], 'Z=' + Z); glow(S.cc[0], N ? HL : null);
    mt('CMP r1, r2   （示意 r1 = 3、r2 = 5）', 2.8, 0.7); ok(N === 1 && Z === 0, '3 − 5 < 0 → N = 1、Z = 0；不動任何 register ✓', 2.8, 0.1);
    cap('compare 只比較、不改 register', '只影響 condition code');
  },
  async (tok, S) => { // 1938.4 每個 instruction 看 condition
    mt('ADDLT r0, r0, #1   # N≠V（less than）才執行', 2.8, -0.5, 'good');
    cap('之後每個 instruction', '看 condition code 滿足才執行');
  },
  async (tok, S) => { // 1971.9 single instruction if
    sm('一個 if 只要一個 instruction，不用跳來跳去 → instruction count 少', 0, -1.2);
    cap('好處：if 只要一個 instruction', '滿足就執行，不用跳來跳去');
  },
  async (tok, S) => { // 2010.8 format 比較多
    sm('ARM 也是 32 bits，但 format 比 MIPS 的 3 種多，要多幾個 bit 決定是哪種', 0, -1.8);
    cap('ARM 也是 32 bits', 'format 比 MIPS 的三種多');
  },
], [[0, 2.8, 15], [0, 2.4, 0]]);

scene('nuA-9a-x86hist', 'x86：一路向後相容的演進', [
  async (tok, S) => { // 2048.3 x86 = CISC
    hot('x86：CISC（Complex Instruction Set Computer）', 0, 6.6);
    cap('x86 就差很多了', '它是 CISC');
  },
  async (tok, S) => { // 2059.6 backward compatibility
    hd('關鍵字：evolution with backward compatibility', 0, 6.0);
    cap('最重要的一句話', 'evolution with backward compatibility');
  },
  async (tok, S) => { // 2073.3 舊程式還要用
    sm('很複雜、不 elegant，為什麼還在？舊程式還要能跑', 0, 5.4);
    cap('這麼複雜為什麼還留到現在？', '因為相容性：舊 program 還是要用');
  },
  async (tok, S) => { // 2126.2 1974 8-bit accumulator
    S.X = yearAxis(1972, 2001, 0.2); yearMark(S.X, 1974, '8-bit（8080），accumulator', 0);
    cap('最早是 8-bit processor', '沒有 general purpose register file，只有 accumulator');
  },
  async (tok, S) => { // 2144.1 1978 16-bit
    yearMark(S.X, 1978, '8086：16-bit', 1);
    cap('1978 年擴充到 16 bits', '8086');
  },
  async (tok, S) => { // 2154.0 1980 FP coprocessor
    yearMark(S.X, 1980, '8087：floating point coprocessor', 2);
    cap('1980 年有 floating point coprocessor', '原來只有 integer');
  },
  async (tok, S) => { // 2164.7 1982 MMU、24-bit address
    yearMark(S.X, 1982, '80286：MMU、24-bit address', 3); ok(2 ** 24 === 16777216, '24-bit address → 2²⁴ = 16 MB ✓', S.X(1982), 3.5);
    cap('1982 年有 memory management unit', 'address 變成 24 bits');
  },
  async (tok, S) => { // 2175.6 1985 386 32-bit
    yearMark(S.X, 1985, '80386：32-bit（IA-32）、paging、segment', 0, 'ptr');
    cap('1985 年 386：extend 成 32 bits', '就是 IA-32，跟 ARM 差不多同時');
  },
  async (tok, S) => { // 2200.2 1989 486
    yearMark(S.X, 1989, '486（AMD 等競爭者也出現）', 1);
    cap('1989 年 486', '競爭者 AMD 也出來了');
  },
  async (tok, S) => { // 2212.2 1993 Pentium superscalar
    yearMark(S.X, 1993, 'Pentium：superscalar', 2, 'ptr');
    cap('1993 年 Pentium', 'superscalar：同一時間 run 更多 instruction');
  },
  async (tok, S) => { // 2227.7 FDIV bug
    bad('floating point divide bug → formal verification 變很重要', S.X(1993) - 1.2, 4.2);
    cap('Pentium 有 floating point divide bug', '之後 hardware 的 verification 變很重要');
  },
  async (tok, S) => { // 2253.5 Pentium Pro、II
    yearMark(S.X, 1995, 'Pentium Pro、之後 Pentium II', 3);
    cap('後面有 Pentium Pro、II', '新的 architecture 一直出來');
  },
  async (tok, S) => { // 2258.9 1999 SSE
    yearMark(S.X, 1999, 'SSE：SIMD（圖形）', 0, 'ptr');
    cap('1999 年之後：SSE', 'single instruction multiple data，主要做圖形');
  },
  async (tok, S) => { // 2294.9 compatibility 的負擔
    good('extension 一定保留舊的 → 最大的 burden；technical elegance ≠ market success', 0, -0.7);
    cap('Intel 的 extension 一定要 compatible', 'technical elegance 不等於 market success');
  },
]);

scene('nuA-9a-x86isa', 'x86 的 register、addressing、encoding', [
  async (tok, S) => { // 2333.1 只有 8 個 GPR
    S.r = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'].map((t, i) => bx(t, NC.sky, -5.4 + (i % 4) * 1.2, 5.6 - Math.floor(i / 4) * 0.6, 0, 1.1, 0.5, 0.6));
    sm('general purpose 只有 8 個（32-bit），還跟特定用途共用', -3.6, 4.4);
    cap('x86 的 register file', 'general purpose 只有 8 個');
  },
  async (tok, S) => { // 2354.7 兩個 operand
    mt('add  eax, ebx      # eax = eax + ebx', 2.6, 5.6, 'ptr'); sm('只有兩個 operand：一個同時是 source 和 destination', 2.6, 5.0);
    cap('addressing 也很複雜', '只有兩個 operand，一個兼做 source 和 destination');
  },
  async (tok, S) => { // 2366.1 operand 可在 memory
    mt('add  eax, [ebx+8]  # 一個 operand 在 memory', 2.6, 4.3, 'ptr');
    sm('MIPS 是 load-store：運算只用 register 或 immediate', 2.6, 3.7);
    cap('其中一個 operand 可以在 memory', '不像我們的 load-store machine');
  },
  async (tok, S) => { // 2383.9 base + displacement、scaled index
    mt('[base + index × scale + displacement]', 2.6, 3.1);
    cap('memory addressing 很複雜', 'base + displacement，還有 scaled index');
  },
  async (tok, S) => { // 2401.5 MIPS 固定 32 bits
    S.m = []; for (let i = 0; i < 4; i++) S.m.push(bx('32 bits', NC.mint, -4.6 + i * 2.3, 1.8, 0, 2.2, 0.5, 0.6)); sm('MIPS／ARM：每個都 32 bits，一次拿 32 bits 就 decode', 0, 2.5);
    cap('MIPS、ARM 都是固定 32 bits', '每次拿 32 bits 去 decode 就好');
  },
  async (tok, S) => { // 2415.7 x86 長度不一
    const L = [1, 3, 6, 2, 15, 4]; let x = -5.8; S.x = L.map((n) => { const W = n * 0.36; const m = bx(n + 'B', NC.orange, x + W / 2, 0.8, 0, W - 0.05, 0.5, 0.6); x += W; return m; });
    sm('x86：1～15 bytes，長度各不相同（示意）', 0, 0.1);
    cap('x86 不是', '各式各樣長度不一樣的 instruction');
  },
  async (tok, S) => { // 2424.4 下一個多長？
    bub('下一個 instruction 多長？要先看前面的 bits 才知道', 0, -0.6);
    cap('簡單的問題：下一個 instruction 多長？', '要很多 extra bits 去 encode，fetch 的 size 都不一樣');
  },
  async (tok, S) => { // 2459.7 簡單的一對一
    gone(S.m); S.simple = bx('simple instruction → 直接 implement', NC.green, -3.4, 3.2, 0, 4.4, 0.5, 0.6);
    cap('真正的 implementation', '簡單的 instruction 就 one-to-one 直接做');
  },
  async (tok, S) => { // 2484.8 complex → micro-op
    S.cx = bx('complex instruction', NC.orange, 2.4, 3.2, 0, 3.0, 0.5, 0.6); S.uop = [0, 1, 2].map((i) => bx('µop', NC.lilac, 1.4 + i * 1.0, 2.4, 0, 0.9, 0.4, 0.6));
    cap('complex 的 instruction', '拆成很多小的 micro-operation 去執行');
  },
  async (tok, S) => { // 2529.4 像 RISC
    good('hardware 只要處理小而簡單的 micro-op → 像 RISC，容易 speed up；效能和 RISC 差不多', 0, 4.4);
    cap('其實已經類似 RISC 的概念', '小的比較容易 optimize、speed up');
  },
]);

scene('nuA-9a-fall', 'Fallacies 與 pitfalls', [
  async (tok, S) => { // 2553.3 fallacy
    hot('Fallacy：錯誤的觀念（不要犯）', -3.0, 6.5); hot('Pitfall：容易犯錯的地方', 3.4, 6.5);
    cap('最後是 fallacy 和 pitfall', 'fallacy 是錯誤的觀念');
  },
  async (tok, S) => { // 2560.8 powerful instruction
    S.f1 = bad('✘ 很 powerful 的 instruction → 很 high performance', -3.0, 5.6);
    cap('fallacy 1：powerful instruction', '就有 higher performance？');
  },
  async (tok, S) => { // 2585.6 為什麼錯
    S.c = [0, 1, 2, 3].map((i) => bx('', i === 2 ? NC.orange : NC.sky, -5.2 + i * 1.6, 4.6, 0, 1.4, 0.4, 0.6)); sm('複雜 instruction 難 implement，還把 clock cycle 拉長、拖累所有人', -3.0, 3.9);
    for (const m of S.c) await anim(tok, 80, (u) => { m.scale.x = 1 + 0.4 * u; });
    cap('instruction 少了，但 complex instruction 很難做', 'clock cycle 為它變長，把其他人都拖累');
  },
  async (tok, S) => { // 2621.3 寫 assembly
    S.f2 = bad('✘ 為了 high performance 要寫 assembly', -3.0, 3.1);
    cap('fallacy 2：為了 efficient', '我要寫 assembly code？');
  },
  async (tok, S) => { // 2659.9 compiler 很厲害
    sm('compiler 已經能產生很 efficient 的 assembly；HLL 行數少、錯少、生產力高', -3.0, 2.5);
    cap('錯：現在 compiler 很厲害', '要生產力、少 error，就寫 high-level language');
  },
  async (tok, S) => { // 2712.2 compatibility → 不能加
    S.f3 = bad('✘ 為了 backward compatibility，instruction set 不能變', -3.0, 1.7);
    cap('fallacy 3：為了 backward compatibility', 'instruction set 就不能增加？');
  },
  async (tok, S) => { // 2750.3 x86 一直增加
    S.gr = []; for (let k = 0; k < 6; k++) S.gr.push(vbar(NC.orange, -5.2 + k * 0.6, 0.3 + k * 0.35, 0.45, -1.4)); sm('x86 的 instruction 數一直增加（示意）', -3.0, -1.8);
    cap('錯：x86 還是一直增加', '舊的要維持，新的 application 要新 instruction');
  },
  async (tok, S) => { // 2769.8 address +4
    const addr = [0, 1, 2, 3].map((i) => i * 4); S.w = addr.map((a, i) => bx(String(a), NC.mint, 2.4 + i * 1.0, 5.4, 0, 0.9, 0.5, 0.6));
    ok(addr.join(',') === '0,4,8,12', 'pitfall：連續的 word，address 每次 +4（不是 +1）✓', 3.9, 4.7);
    cap('pitfall：sequential address', 'increment by 4，不是 by 1：一個 word 4 bytes');
  },
  async (tok, S) => { // 2788.5 pointer 失效
    S.stk = bx('stack frame（已 pop）', NC.gray, 3.9, 3.2, 0, 3.0, 0.8, 0.8); S.stk.material.transparent = true; S.stk.material.opacity = 0.35;
    lk(3.9, 4.2, 3.9, 3.7, 0xd64545); bad('procedure return 後，指向它區域變數的 pointer 已經無效', 3.9, 2.4);
    cap('pass pointer 時要注意', 'procedure 結束，stack 被 pop 掉，那些 pointer 就無效');
  },
]);

scene('nuA-9a-prin', '四個設計原則', [
  async (tok, S) => { // 2806.9 四個原則
    hot('Concluding remarks：四個 design principle', 0, 6.6);
    S.p = ['① Simplicity favors regularity', '② Smaller is faster', '③ Make the common case fast', '④ Good design demands good compromises'].map((t, i) => tag(t, 'ptr', -3.2, 5.8 - i * 1.3));
    cap('四個設計原則', 'ISA 長這樣是有原因的');
  },
  async (tok, S) => { // 2878.5 simplicity → 3 formats
    mt('R: op(6) rs(5) rt(5) rd(5) shamt(5) funct(6)', 3.2, 5.6);
    sm('例：只有三種 format，op 固定 6 bits、rs rt rd 位置固定', 3.2, 5.0);
    cap('simplicity favors regularity', '例：instruction format 只有三種，欄位固定');
  },
  async (tok, S) => { // 2895.0 smaller is faster
    sm('例：register file 只取 32 個，不用 64 個', 3.2, 4.5);
    cap('smaller is faster', '例：register 為什麼不用 64 個？只取 32 個');
  },
  async (tok, S) => { // 2922.7 common case fast
    mt('addi $s3, $s3, 4   # constant 直接放在 instruction', 3.0, 3.2); sm('例：constant 常用 → 設 immediate（I-type）', 3.2, 2.7);
    cap('make the common case fast', 'constant 常用到，所以有 immediate type');
  },
  async (tok, S) => { // 2945.9 good compromise
    sm('例：希望只有一種 format，但 R、I、J 還是稍有不同', 3.2, 1.4);
    cap('good design demands good compromises', '希望只一種 format，但 R、I、J 還是不一樣');
  },
  async (tok, S) => { // 2977.3 layers；RISC vs CISC
    sm('software／hardware 分層；MIPS 是典型 RISC，x86 是 CISC', 0, 0.3);
    cap('還有 software、hardware 的層次', 'MIPS 是典型的 RISC，x86 是 CISC');
  },
  async (tok, S) => { // 2990.4 profiling、Amdahl
    good('設計前先 profiling：找出最常用的 instruction 再 optimize（Amdahl\'s law）', 0, -0.4);
    cap('將來設計一定要先做 profiling', '佔的比例高才去 optimize：Amdahl\'s law');
  },
]);

// ════════ sKxdXfH5qko（IEEE 754 Floating Point Representation：single & double） ════════
const SCOL = (i, b) => (i === 0 ? (b === '1' ? '#d64545' : '#f2c4c4') : (b === '1' ? '#4b9ee2' : '#c6def5'));
const hcol = (i, b) => (i === 0 ? (b === '1' ? '#d64545' : '#f2c4c4') : i <= 5 ? (b === '1' ? '#4b9ee2' : '#c6def5') : (b === '1' ? '#2fc092' : '#c2ecdc'));
const dcolHi = (i, b) => (i === 0 ? (b === '1' ? '#d64545' : '#f2c4c4') : i <= 11 ? (b === '1' ? '#4b9ee2' : '#c6def5') : (b === '1' ? '#2fc092' : '#c2ecdc'));
const dcolLo = (i, b) => (b === '1' ? '#2fc092' : '#c2ecdc');
// a 32-bit single-precision row at height y, with its field names under it
function frow(y) { const r = bitRow(32, 0, y, 0, 0.38, fcol, [1, 9]); sm('S', r.xs[0], y - 0.7); sm('exponent（8）', (r.xs[1] + r.xs[8]) / 2, y - 0.7); sm('fraction（23）', (r.xs[9] + r.xs[31]) / 2, y - 0.7); return r; }

scene('nuA-ieee-why', '為什麼需要 IEEE 754 標準', [
  async (tok, S) => { // 0.6 mantissa × exponent
    hot('上次：floating point 用科學記號 mantissa × 2^exponent', 0, 6.4);
    cap('上次用科學記號表示浮點數', 'mantissa（有效數字）× exponent（指數）');
  },
  async (tok, S) => { // 4.9 10 bits
    S.r10 = bitRow(10, -2.4, 5.0, 0, 0.55); S.r10.set('0101100011'); sm('上次的例子用 10 bits（示意）', -2.4, 4.3);
    cap('上次的例子用 10 個 bit', '');
  },
  async (tok, S) => { // 23.0 12、14 bits？
    S.r12 = bitRow(12, -1.85, 3.3, 0, 0.55); S.r14 = bitRow(14, -1.3, 2.3, 0, 0.55);
    bub('mantissa 幾個 bit？exponent 幾個 bit？', 4.0, 3.0);
    cap('有人用 12 bits、有人用 14 bits', '電腦怎麼知道哪幾個是 mantissa、哪幾個是 exponent？');
  },
  async (tok, S) => { // 40.6 標準
    good('所以需要一個 standard', 0, 1.3);
    cap('所以要定一個標準', '');
  },
  async (tok, S) => { // 44.9 ASCII
    const A = 'A'.charCodeAt(0), a = 'a'.charCodeAt(0);
    ok(A === 65 && a === 97, '就像 ASCII：A = ' + A + '、a = ' + a + ' ✓', 0, 0.6);
    cap('就像字母有 ASCII 標準', '大寫 A 是 65，小寫 a 是 97');
  },
  async (tok, S) => { // 55.0 IEEE 754
    hot('浮點數的標準：IEEE 754', 0, -0.2);
    cap('浮點數的標準', '由 IEEE 754 制定');
  },
  async (tok, S) => { // 74.1 binary16 half
    sm('IEEE 754 有好幾種：第一種 binary16 ＝ half precision', 0, -0.8);
    cap('IEEE 754 有不同變化', '第一種 binary16，叫 half precision');
  },
]);

scene('nuA-ieee-half', 'Biased exponent 與 half precision（binary16）', [
  async (tok, S) => { // 98.1 參數
    S.t = list(-5.6, 6.3, 0.5); mono(S.t.add('格式       總長  sign+mantissa  exponent  bias', 'ptr'));
    cap('每種格式要知道', 'sign + mantissa 幾個 bit、exponent 幾個 bit');
  },
  async (tok, S) => { // 103.4 biased exponent
    hot('最重要：biased exponent', 3.6, 5.2);
    cap('最重要的是 biased exponent', '');
  },
  async (tok, S) => { // 117.3 負的 exponent
    sm('exponent 可能是負的 → 不好直接存；加一個 bias 變成非負', 0, 4.6);
    cap('exponent 是負的就不好表示', '所以要做 biasing：加一個偏移量');
  },
  async (tok, S) => { // 145.1 binary16
    const tot = 16, sm_ = 11, ex = tot - sm_; mono(S.t.add('binary16   16    ' + sm_ + '             ' + ex + '         ?'));
    ok(ex === 5, '16 − 11 = 5 bits 給 exponent ✓', 3.6, 4.0);
    cap('binary16：總共 16 bits', '11 bits 給 sign 和 mantissa，16 − 11 = 5 給 exponent');
  },
  async (tok, S) => { // 175.1 公式
    mt('bias = 2^(n−1) − 1，n = exponent 的 bit 數', 0, 3.2, 'ptr alt');
    cap('exponent 有 5 bits，bias 是多少？', '公式：2^(n−1) − 1');
  },
  async (tok, S) => { // 186.5 n = 5 → 15
    const n = 5, b = 2 ** (n - 1) - 1; S.t.ls[1].element.textContent = 'binary16   16    11             5         ' + b;
    ok(b === 15, 'n = 5：2⁴ − 1 = 16 − 1 = ' + b + ' ✓', 0, 2.6);
    cap('n = 5：2 的 4 次方是 16', '16 − 1 = 15，bias 是 15');
  },
  async (tok, S) => { // 205.9 加 15
    sm('真正的 exponent ＋ 15 才存進去（5 是 bit 數，不是 exponent）', 0, 2.0);
    cap('把原本的 exponent 加上 15', '注意 5 是 exponent 的 bit 數，不是 exponent');
  },
  async (tok, S) => { // 214.4 e = 8
    const e = 8, be = e + 15; mt('e = 8  → 8 + 15 = ' + be + ' = ' + bin(be, 5), -2.6, 1.3); ok(be === 23, '✓', 0.6, 1.3);
    cap('例：exponent 是 8', 'biased exponent = 8 + 15 = 23');
  },
  async (tok, S) => { // 223.1 e = −3
    const e = -3, be = e + 15; mt('e = −3 → −3 + 15 = ' + be + ' = ' + bin(be, 5), -2.6, 0.8); ok(be === 12, '✓ 負數也變成正的', 1.2, 0.8);
    cap('exponent 是 −3', 'biased exponent = −3 + 15 = 12');
  },
  async (tok, S) => { // 243.3 1 + 5 + 10
    S.h = bitRow(16, 0, -0.4, 0, 0.62, hcol, [1, 6]); S.h.set('0' + bin(23, 5) + '0'.repeat(10));
    sm('sign 1', S.h.xs[0], -1.2); sm('exponent 5（示意存 23）', (S.h.xs[1] + S.h.xs[5]) / 2, -1.2); sm('mantissa 10', (S.h.xs[6] + S.h.xs[15]) / 2, -1.2);
    ok(1 + 5 + 10 === 16, '1 + 5 + 10 = 16 ✓', 4.8, 0.2);
    cap('排法：1 bit sign、5 bits exponent', '剩下 10 bits 是 mantissa');
  },
  async (tok, S) => { // 256.4 不常用
    sm('half precision 不太常用', -4.6, 0.2);
    cap('half precision 不是主要使用的', '接下來看最重要的 32、64 bits');
  },
]);

scene('nuA-ieee-sd', 'Single（32）與 double（64）precision', [
  async (tok, S) => { // 258.6 最重要
    hot('最重要的兩種：32 bits 和 64 bits', 0, 6.5);
    cap('最重要的是 32 和 64', '');
  },
  async (tok, S) => { // 262.4 single、double
    S.t = list(-5.6, 5.8, 0.5); mono(S.t.add('名稱        總長  sign+mantissa  exponent  bias', 'ptr'));
    cap('32 bits 叫 single precision', '64 bits 叫 double precision');
  },
  async (tok, S) => { // 278.6 single：24 = 1 + 23
    S.s = mono(S.t.add('single      32    24 = 1 + 23    ?         ?'));
    cap('single：24 bits 給 sign 和 mantissa', '1 bit sign、23 bits mantissa');
  },
  async (tok, S) => { // 295.6 8 bits
    const ex = 32 - 24; txt(S.s, 'single      32    24 = 1 + 23    ' + ex + '         ?'); ok(ex === 8, '32 − 24 = 8 bits 給 exponent ✓', 3.2, 4.4);
    cap('32 − 24 剩 8 bits', '給 exponent');
  },
  async (tok, S) => { // 304.9 127
    const b = 2 ** (8 - 1) - 1; txt(S.s, 'single      32    24 = 1 + 23    8         ' + b); ok(b === 127, '2⁷ − 1 = 128 − 1 = ' + b + ' ✓', 3.2, 3.8);
    S.row = bitRow(32, 0, 1.6, 0, 0.36, (i, bb) => (i === 0 ? '#f2c4c4' : i <= 8 ? '#c6def5' : '#c2ecdc'), [1, 9]);
    sm('S', S.row.xs[0], 0.9); sm('exponent 8（bias 127）', (S.row.xs[1] + S.row.xs[8]) / 2, 0.9); sm('fraction（mantissa）23', (S.row.xs[9] + S.row.xs[31]) / 2, 0.9);
    cap('bias = 2^(8−1) − 1 = 127', '真正的 exponent 加 127 才存');
  },
  async (tok, S) => { // 325.3 double
    const sm_ = 53, ex = 64 - sm_; S.d = mono(S.t.add('double      64    53 = 1 + 52    ' + ex + '        ?')); ok(ex === 11, '64 − 53 = 11 bits ✓', 3.2, 3.2);
    cap('double：53 bits 給 sign 和 mantissa', '1 + 52，剩下 11 bits 是 exponent');
  },
  async (tok, S) => { // 334.7 1023
    const b = 2 ** (11 - 1) - 1; txt(S.d, 'double      64    53 = 1 + 52    11        ' + b); ok(b === 1023, '2¹⁰ − 1 = 1024 − 1 = ' + b + ' ✓', 3.2, 2.6);
    cap('bias = 2^10 − 1', '= 1024 − 1 = 1023');
  },
  async (tok, S) => { // 348.0 binary128、256
    sm('還有 binary128（quadruple，mantissa 113 bits 含 sign）、binary256（octuple）', 0, -0.2);
    cap('還有 binary128、binary256', 'quadruple、octuple precision');
  },
  async (tok, S) => { // 360.5 最重要
    good('single、double 最重要 → 接下來用例子示範', 0, -0.8);
    cap('single 和 double 最重要', '接下來用例子示範怎麼表示');
  },
]);

scene('nuA-ieee-116', '例：116 用 single precision 表示', [
  async (tok, S) => { // 371.0 例子 116
    hot('例：116₁₀ 用 single precision 表示', 0, 6.6);
    cap('例子：十進位 116', '');
  },
  async (tok, S) => { // 382.1 步驟 1：轉二進位
    S.dv = list(-5.4, 5.8, 0.42); let n = 116; const rs = [];
    while (n > 0) { rs.push(n % 2); mono(S.dv.add(String(n).padStart(3) + ' ÷ 2 = ' + String(Math.floor(n / 2)).padStart(2) + ' 餘 ' + (n % 2))); n = Math.floor(n / 2); }
    S.rs = rs;
    cap('第一步：轉成二進位', '一直除以 2，記下餘數');
  },
  async (tok, S) => { // 419.7 1110100
    const b = S.rs.slice().reverse().join(''); S.b = b; ok(b === (116).toString(2) && parseInt(b, 2) === 116, '餘數由下往上讀：116 = ' + b + '₂ ✓', 1.6, 5.8);
    cap('116 的二進位', '1110100');
  },
  async (tok, S) => { // 434.0 normalization
    const e = S.b.length - 1; S.e = e; mt('1110100. = 1.110100 × 2^' + e, 1.6, 5.1, 'ptr alt');
    ok(parseInt(S.b, 2) === parseInt('1110100', 2) && e === 6, '小數點往左移 ' + e + ' 位 → × 2⁶ ✓', 1.6, 4.5);
    cap('第二步：normalization', '小數點前只留一個 1：1.110100 × 2⁶');
  },
  async (tok, S) => { // 473.8 sign
    S.row = frow(1.3); S.bits = '0' + '0'.repeat(31); S.row.set(S.bits, true);
    cap('第三步：放進格式', '正數 → sign bit = 0');
  },
  async (tok, S) => { // 493.0 8 bits exponent
    S.row.clearGlow(); S.row.ms.slice(1, 9).forEach((m) => glow(m, HL));
    cap('接著 8 bits 放 exponent', '放的是 biased exponent');
  },
  async (tok, S) => { // 514.6 6 + 127
    const be = S.e + 127; S.be = be; ok(be === 133, 'biased exponent = 6 + 127 = ' + be + ' ✓', -3.0, 3.0);
    cap('single precision：原 exponent + 127', '6 + 127 = 133');
  },
  async (tok, S) => { // 534.4 133 = 10000101
    const eb = bin(S.be, 8); S.bits = '0' + eb + '0'.repeat(23); S.row.set(S.bits, true);
    ok(eb === '10000101' && 128 + 4 + 1 === 133, '133 = 128 + 4 + 1 = ' + eb + ' ✓', -3.0, 2.4);
    cap('133 的二進位', '128 + 4 + 1 → 10000101');
  },
  async (tok, S) => { // 564.9 mantissa：去掉 1.
    S.row.clearGlow(); const fr = '110100'; S.bits = '0' + bin(S.be, 8) + fr + '0'.repeat(17); S.row.set(S.bits, true);
    sm('1.110100 的「1.」不存（一定是 1）', 2.6, 3.0);
    cap('再來 23 bits mantissa', '小數點前的 1 不用存：110100');
  },
  async (tok, S) => { // 590.8 補 0
    S.row.clearGlow(); const hx = hexOf(S.bits);
    ok(S.bits === fbits(116) && hx === '42E80000', '剩下補 0 → ' + grp(S.bits) + ' = 0x' + hx + ' ✓', 0, -1.0);
    cap('23 bits 還沒滿也沒關係', '剩下補 0：這就是 116 的 single precision');
  },
], [[0, 3.6, 14], [0, 3.0, 0]]);

scene('nuA-ieee-back', '驗算 116，再換成 double precision', [
  async (tok, S) => { // 599.2 公式
    S.row = frow(5.2); S.row.set(fbits(116)); mt('value = (−1)^S × 1.M × 2^(E − 127)', 0, 3.9, 'ptr alt');
    cap('要算回原本的值', '(−1)^S × 1.M × 2^(E − 127)');
  },
  async (tok, S) => { // 616.0 S = 0、1.110100
    mt('S = 0 → (−1)⁰ = 1；1.M = 1.110100', 0, 3.3);
    cap('S = 0，(−1)⁰ = 1', 'M 是 110100，所以 1.110100');
  },
  async (tok, S) => { // 633.0 2^(133−127)
    const v = (1 + parseInt('110100', 2) / 64) * 2 ** (133 - 127); ok(v === 116, '2^(133 − 127) = 2⁶：1.110100 × 2⁶ = 1110100₂ = ' + v + ' ✓', 0, 2.7);
    cap('2 的 (133 − 127) = 6 次方', '小數點往右移 6 位，就回到 116');
  },
  async (tok, S) => { // 661.6 double：binary 一樣
    hot('double precision：二進位一樣是 1.110100 × 2⁶', 0, 1.9);
    cap('如果要 double precision', '二進位和 normalization 都一樣');
  },
  async (tok, S) => { // 668.9 1029
    const be = 6 + 1023; S.be = be; ok(be === 1029, 'biased exponent = 6 + 1023 = ' + be + ' ✓', 0, 1.3);
    cap('bias 換成 1023', '6 + 1023 = 1029');
  },
  async (tok, S) => { // 679.2 1 + 11 + 52
    S.hi = bitRow(32, 0, 0.2, 0, 0.36, dcolHi, [1, 12]); S.lo = bitRow(32, 0, -0.8, 0, 0.36, dcolLo);
    sm('S', S.hi.xs[0], 0.9); sm('exponent 11', (S.hi.xs[1] + S.hi.xs[11]) / 2, 0.9); sm('fraction 52（第一列 20 + 第二列 32）', (S.hi.xs[12] + S.hi.xs[31]) / 2, 0.9);
    cap('double：1 bit sign、11 bits exponent', '52 bits mantissa（分兩列畫）');
  },
  async (tok, S) => { // 698.2 mantissa 110100 + 0
    S.d = '0' + '0'.repeat(11) + '110100' + '0'.repeat(46); S.hi.set(S.d.slice(0, 32), true); S.lo.set(S.d.slice(32), true);
    cap('52 bits mantissa：110100', '剩下全部補 0');
  },
  async (tok, S) => { // 708.1 1029 = 10000000101
    const eb = bin(S.be, 11); S.d = '0' + eb + S.d.slice(12); S.hi.clearGlow(); S.lo.clearGlow(); S.hi.set(S.d.slice(0, 32), true);
    ok(eb === '10000000101' && 1024 + 4 + 1 === 1029, '1029 = 1024 + 4 + 1 = ' + eb + ' ✓', 0, -1.6);
    cap('exponent 放 1029', '1024 + 4 + 1 → 10000000101');
  },
  async (tok, S) => { // 735.4 double 結果
    S.hi.clearGlow(); const hx = hexOf(S.d.slice(0, 32)) + hexOf(S.d.slice(32));
    ok(S.d === dbits(116) && hx === '405D000000000000', '116 的 double ＝ 0x' + hx + ' ✓', 0, -2.2);
    cap('這就是 double precision 的表示', '');
  },
  async (tok, S) => { // 747.6 下次：有小數
    sm('下次：有小數部分的例子', 0, -2.8);
    cap('下次再舉一個例子', '包含小數部分的數字');
  },
], [[0, 3.0, 14], [0, 1.8, 0]]);
  }

  // ═══ nuB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 1 章（清大 黃婷婷 計算機結構 第 9B–13A 講：ALU、加法器、乘法器、除法器、IEEE 754、浮點加法）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的數字照用（7+3、−4+(−5)、2×3、−7×−7、2×7、2×(−3)、7÷2、−7÷2、0.75、1/3、0.5+(−0.4375)…）；
// 老師沒有給數字的地方用自己的小例子，畫面標「示意」。所有 bit pattern、carry、部分積、商與餘數都由程式算，
// 再跟理論值（JS 的整數運算／Float32）比對，畫面顯示 ✓（不符會顯示 ✘）。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7', wire: '#8a7a5c' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.8) => cube(t, c, [w, h, d], x, y, z);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ms && o.xs) return gone(o.ms, o.extra || []); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
const setL = (l, t) => { l.element.textContent = t; };
const relbl = (m, t) => { if (m.userData.lbl) m.userData.lbl.element.textContent = String(t); };
function scene(id, title, cam, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of o.pre || []) await f(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.6, 14], [0, 3.0, 0]];
const WIDE = [[0, 4.0, 15.5], [0, 3.0, 0]];
// a register: labelled row of bit cubes (bitRow from this module), value tag on the right
function reg(name, n, x, y, o = {}) {
  const w = o.w || 0.56;
  const r = bitRow(n, x, y, 0, w, o.col, o.gaps || []);
  r.extra = [];
  if (name) { const l = hd(name, r.xs[0] - w / 2 - 0.25, y); l.center.set(1, 0.5); r.extra.push(l); r.nm = l; }
  const v = sm('', r.xs[n - 1] + w / 2 + 0.25, y); v.center.set(0, 0.5); r.extra.push(v); r.vt = v;
  if (o.bits) r.set(o.bits);
  r.val = (t) => setL(v, t);
  r.hi = (from, to, c = HL) => { r.ms.forEach((m, i) => glow(m, i >= from && i < to ? c : null)); };
  return r;
}
const wire = (pts, c = FC.wire) => line(pts.map((p) => [p[0], p[1], p[2] || 0]), c);
// add two bit strings (MSB first) with carry-in: sum bits, carry INTO each position (MSB first), carry out
function addB(a, b, cin = 0) {
  const n = a.length; let c = cin; const s = Array(n), cinAt = Array(n);
  for (let i = n - 1; i >= 0; i--) { cinAt[i] = c; const x = +a[i], y = +b[i]; s[i] = x ^ y ^ c; c = (x & y) | (x & c) | (y & c); }
  return { s: s.join(''), cin: cinAt, cout: c, ovf: (cinAt[0] ^ c) === 1 };
}
// animate a sum row filling in from the right; carries pop up above row A (≤ ~2.4 s total)
async function rippleIn(tok, rowS, rowA, r, ms = 260, carryY) {
  const n = rowS.n, cs = [];
  for (let i = n - 1; i >= 0; i--) {
    glow(rowA.ms[i], HL);
    const bits = rowS.bits.split(''); bits[i] = String(r.s[i]); rowS.set(bits.join(''), true);
    const co = i > 0 ? r.cin[i - 1] : r.cout;
    if (co && carryY != null) cs.push(cube('1', i > 0 ? FC.gold : FC.red, [0.36, 0.3, 0.36], i > 0 ? rowA.xs[i - 1] : rowA.xs[0] - 0.62, carryY, 0, 0.8));
    await wt(tok, ms);
    glow(rowA.ms[i], null);
  }
  return cs;
}
// a labelled block (gate / unit) and a 2-to-1 / n-to-1 mux drawn as a tall narrow block
const unit = (t, c, x, y, w = 1.3, h = 0.7) => cube(t, c, [w, h, 0.6], x, y, 0);
const muxB = (t, x, y, h = 2.2, w = 0.75) => cube(t, '#6e5f49', [w, h, 0.6], x, y, 0);
// significand digits as cubes in a row (for decimal / binary scientific notation)
function digits(ds, x0, y, c = FC.blue, w = 0.62) { return ds.split('').map((d, k) => (d === ' ' ? null : cube(d, d === '.' ? FC.paper : c, [w * (d === '.' ? 0.4 : 0.86), 0.5, 0.6], x0 + k * w, y, 0))).filter(Boolean); }
const f32 = (x) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x); return dv.getUint32(0).toString(2).padStart(32, '0'); };
const bitsToF = (b) => { const dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, parseInt(b, 2) >>> 0); return dv.getFloat32(0); };
// ── a 1-bit ALU slice (P&H 附錄 B 的畫法)：a、b → (Ainvert／Binvert mux) → AND、OR、+ → 4-to-1 MUX → Result ──
// o.ainv / o.binv: draw the invert muxes; o.less: draw the Less input (MUX 輸入 3); o.set: draw the Set output (MSB slice)
function alu1(o = {}) {
  const g = { all: [] }; const A = (m) => (g.all.push(m), m);
  const yA = 4.7, yB = 2.5, xU = -1.5, xM = 1.7, yIn = [5.6, 4.4, 2.9, 1.5];
  g.a = A(hd('a', -6.3, yA)); g.b = A(hd('b', -6.3, yB));
  let xa = -5.8, xb = -5.8;
  if (o.ainv) { g.ainv = A(muxB('', -4.6, yA, 1.0, 0.5)); g.ainvL = A(sm('Ainvert', -4.6, yA + 0.85)); A(wire([[-5.8, yA], [-4.85, yA]])); xa = -4.35; }
  if (o.binv) { g.binv = A(muxB('', -4.6, yB, 1.0, 0.5)); g.binvL = A(sm('Binvert', -4.6, yB - 0.85)); A(wire([[-5.8, yB], [-4.85, yB]])); xb = -4.35; }
  A(wire([[xa, yA], [-3.0, yA]])); A(wire([[-3.0, yIn[2] + 0.2], [-3.0, yIn[0] + 0.15]]));
  A(wire([[xb, yB], [-3.4, yB]])); A(wire([[-3.4, yB], [-3.4, yIn[0] - 0.15]]));
  for (const y of yIn.slice(0, 3)) { A(wire([[-3.0, y + 0.15], [xU - 0.65, y + 0.15]])); A(wire([[-3.4, y - 0.15], [xU - 0.65, y - 0.15]])); }
  g.AND = A(unit('AND', FC.blue, xU, yIn[0])); g.OR = A(unit('OR', FC.purple, xU, yIn[1])); g.ADD = A(unit('+', FC.orange, xU, yIn[2], 1.3, 1.0));
  g.cinL = A(sm('CarryIn', xU - 0.9, yIn[2] - 0.85)); g.coutL = A(sm('CarryOut', xU + 0.9, yIn[2] - 0.85));
  g.mux = A(muxB('MUX', xM, 3.55, 5.2));
  g.ins = yIn.map((y, k) => A(wire([[k === 3 ? -0.2 : xU + 0.65, y], [xM - 0.38, y]])));
  g.inL = yIn.map((y, k) => A(sm(String(k), xM - 0.6, y + 0.25)));
  if (!o.less) { g.ins[3].visible = false; } else g.lessL = A(hot('Less', -0.9, yIn[3]));
  g.opL = A(sm('Operation', xM, 0.65));
  A(wire([[xM + 0.38, 3.55], [3.3, 3.55]]));
  g.res = A(hot('Result', 4.2, 3.55));
  if (o.set) { g.setW = A(wire([[xU + 0.65, yIn[2] - 0.25], [0.6, yIn[2] - 0.25], [0.6, 0.6], [3.4, 0.6]], FC.red)); g.setL = A(hot('Set', 4.0, 0.6)); }
  g.units = [g.AND, g.OR, g.ADD];
  g.sel = (k, opText) => {
    g.units.forEach((u, i) => glow(u, i === k ? HL : null));
    g.ins.forEach((w, i) => w.material.color.set(i === k ? '#c08a1f' : FC.wire));
    if (opText != null) setL(g.opL, 'Operation = ' + opText);
  };
  return g;
}
// four 1-bit ALUs in a row, bit 0 on the right; carries flow right → left
function chain4(y = 2.6) {
  const sx = (i) => 4.6 - i * 3.05;
  const sl = [0, 1, 2, 3].map((i) => unit('ALU' + i, '#6e5f49', sx(i), y, 1.9, 1.4));
  const top = [0, 1, 2, 3].map((i) => sm('', sx(i), y + 1.25));
  const out = [0, 1, 2, 3].map((i) => hot('', sx(i), y - 1.25));
  const cw = [0, 1, 2].map((i) => wire([[sx(i) - 0.95, y - 0.3], [sx(i + 1) + 0.95, y - 0.3]]));
  return { sl, top, out, cw, sx, all: [sl, top, out, cw] };
}
// carries: index 0 = c0 (carry into bit 0), c[i] = carry into bit i; bit strings are MSB first
const lsb = (s) => s.split('').reverse().map(Number);
function rippleC(a, b, c0 = 0) { const A = lsb(a), B = lsb(b), c = [c0]; for (let i = 0; i < A.length; i++) { const x = A[i], y = B[i], ci = c[i]; c.push((x & y) | (x & ci) | (y & ci)); } return c; }
// carry lookahead, written out flat: c(i+1) = g_i + p_i g_(i−1) + … + p_i…p_0 c0  (no c_i used on the right)
function claC(a, b, c0 = 0, useXor = false) {
  const A = lsb(a), B = lsb(b), n = A.length;
  const g = A.map((x, i) => x & B[i]), p = A.map((x, i) => (useXor ? x ^ B[i] : x | B[i])), c = [c0];
  for (let i = 0; i < n; i++) { let v = 0; for (let j = 0; j <= i; j++) { let t = g[j]; for (let k = j + 1; k <= i; k++) t &= p[k]; v |= t; } let t = c0; for (let k = 0; k <= i; k++) t &= p[k]; c.push(v | t); }
  return { g, p, c };
}
const V1 = 'v1';
// Booth view: Multiplicand (4) over the left half of Product (A:Q, 8 bits) + the extra bit Q₋₁; snapshots from booth() above
function bview(m, q, y = 3.6) {
  const V = { S: booth(m, q) };
  V.P = reg('Product', 9, 0.4, y, { w: 0.66, gaps: [4, 8] });
  const cx = (V.P.xs[0] + V.P.xs[3]) / 2;
  V.M = reg('Multiplicand', 4, cx, y + 1.6, { w: 0.66, bits: bin(m, 4) }); V.M.val('= ' + m + '（不動）');
  V.lb = [sm('左半（partial product）', cx, y - 0.75), sm('右半：乘數', (V.P.xs[4] + V.P.xs[7]) / 2, y - 0.75), sm('右邊那一位', V.P.xs[8], y + 0.75)];
  V.show = (k, flash = true) => {
    const s = V.S[k]; V.P.set(s.r.A + s.r.Q + s.r['Q₋₁'], flash);
    V.P.val('= ' + sval(s.r.A + s.r.Q)); V.P.ms.forEach((mm, i) => glow(mm, null));
    if (s.it && !s.note.includes('右移')) { glow(V.P.ms[7], HL); glow(V.P.ms[8], HL); }
    return s;
  };
  V.show(0, false);
  return V;
}
// the improved divider（老師 12B 的版本）: Remainder (2n bits) holds dividend, shift left first, subtract from the left half,
// ≥ 0 → shift left in 1, < 0 → restore, shift left in 0; at the end shift the left half right 1. returns one snapshot list per iteration
function divSmart(dd, dv, n = 4) {
  const W = 2 * n, MASK = (1 << W) - 1, M = (1 << n) - 1; let R = dd & MASK; const it = [];
  const init = bin(R, W); R = (R << 1) & MASK; const first = bin(R, W);
  for (let i = 1; i <= n; i++) {
    const L = R >> n, d = L - dv, row = { sub: bin(((d & M) << n) | (R & M), W), neg: d < 0 };
    if (d >= 0) { R = (d << n) | (R & M); R = ((R << 1) | 1) & MASK; } else { R = (R << 1) & MASK; }
    row.after = bin(R, W); it.push(row);
  }
  const fin = bin(((R >> n) >> 1 << n) | (R & M), W);
  return { init, first, it, fin, rem: uval(fin.slice(0, n)), quo: uval(fin.slice(n)) };
}

// ════════ 2srq4qFEhu8（第9B講 Instruction Set Architecture / Computer Arithmetic） ════════
scene('nuB-9b-ops', "9B：ALU 要支援的六種運算", CAM, [
  async (tok, S) => {
          S.cpu = prop('cpu', -4.6, 0.3, 0, 1.4, 'hardware'); S.isa = bx('ISA（指令集）', FC.lilac, -4.6, 4.6, 0, 3.0, 0.7);
          S.ar = arrow(V3(-4.6, 4.1, 0), V3(-4.6, 1.9, 0)); cap('ISA 定好了，開始建 hardware', '根據 define 好的 instruction');
        },
  async (tok, S) => {
          S.parts = ['ALU', 'register', 'memory'].map((t, i) => bx(t, [FC.orange, FC.sky, FC.mint][i], 0.2 + i * 2.2, 4.6, 0, 1.9, 0.6));
          await anim(tok, 700, (u) => S.parts.forEach((m, i) => { m.position.y = 4.6 - u * (1.8 + i * 0.0); }));
          cap('一個 component 一個 component 做', '做好再 combine 在一起');
        },
  async (tok, S) => {
          glow(S.parts[0], HL); hot('Computer Arithmetic：運算最重要', 2.4, 6.0);
          cap('先介紹 computer arithmetic', '把需要的運算集中到 ALU');
        },
  async (tok, S) => {
          S.ops = ['add', 'sub'].map((t, i) => bx(t, FC.orange, -0.4 + i * 1.32, 1.6, 0, 1.2, 0.5));
          cap('介紹加、減', '再把加跟減建進 ALU');
        },
  async (tok, S) => {
          S.typ = ['R-type', 'I-type', 'J-type'].map((t, i) => bx(t, FC.paper, -1.6, 5.6 - i * 0.8, 0, 1.6, 0.55));
          cap('哪一個 type 跟運算有關？', '只有三種：R、I、J');
        },
  async (tok, S) => {
          glow(S.typ[0], HL); tint(S.typ[0], FC.orange); cap('R-type：加、減…', '兩個 register 進、一個 register 出');
        },
  async (tok, S) => {
          S.ops.push(...['and', 'or'].map((t, i) => bx(t, FC.blue, -0.4 + (i + 2) * 1.32, 1.6, 0, 1.2, 0.5)));
          cap('還有 and、or…', '所以要能 control 一個 ALU');
        },
  async (tok, S) => {
          note('數字一律用 two\'s complement 表示', 2.9, 0.6); cap('Subtract 用 two\'s complement 做', '表示法決定硬體怎麼設計');
        },
  async (tok, S) => {
          S.ops.push(...['slt', 'nor'].map((t, i) => bx(t, FC.purple, -0.4 + (i + 4) * 1.32, 1.6, 0, 1.2, 0.5)));
          hot('六種：and or add sub slt nor', 2.9, 2.4); cap('ALU 要做：and、or、add、sub', '還有 slt、nor');
        },
  async (tok, S) => {
          const okk = [0, 1].every((a) => (+!(a | 0)) === (a ? 0 : 1));
          ok(okk, -1.4, 6.6, 'NOT a = a NOR 0（a = 0→1、a = 1→0）✓'); cap('MIPS 沒有 NOT', '用 NOR 來 implement NOT');
        },
  async (tok, S) => {
          S.ops.forEach((m) => glow(m, OKG)); cap('先討論這六個 operation', '其他再照同樣方法 extend');
        }
]);
scene('nuB-9b-ctrl', "9B：ALU 的輸入輸出與 control", CAM, [
  async (tok, S) => {
          S.alu = bx('ALU', FC.orange, 0, 2.6, 0, 2.6, 2.4, 1.0); S.ctl = hot('ALU control（4 bits）', 0, 4.7); S.cw = wire([[0, 4.35], [0, 3.8]]);
          cap('ALU control：4 個 bit', '決定 ALU 這次做什麼');
        },
  async (tok, S) => {
          hd('a（32）', -4.2, 3.4); hd('b（32）', -4.2, 1.8); wire([[-3.3, 3.4], [-1.3, 3.4]]); wire([[-3.3, 1.8], [-1.3, 1.8]]);
          wire([[1.3, 2.6], [2.6, 2.6]]); hot('Result（32）', 3.6, 2.6); cap('兩個 32-bit operand 進', '32-bit 結果出');
        },
  async (tok, S) => {
          wire([[1.3, 1.9], [2.4, 1.2]]); sm('Overflow', 3.2, 1.1); wire([[1.3, 1.6], [2.0, 0.5]]); sm('Zero', 2.5, 0.3);
          cap('另外輸出 overflow、zero', '這是 ALU 的 function 描述');
        },
  async (tok, S) => {
          S.tb = ['AND', 'OR', 'add', 'sub', 'slt', 'NOR'].map((t, i) => bx('???? ' + t, FC.paper, 5.4, 6.6 - i * 0.6, 0, 2.0, 0.48));
          cap('and、or、add、sub、slt、nor', '每一種對到一組 control code');
        },
  async (tok, S) => {
          relbl(S.tb[0], '0000 AND'); relbl(S.tb[1], '0001 OR'); glow(S.tb[0], HL); glow(S.tb[1], HL); setL(S.ctl, 'ALU control = 0000 → AND');
          cap('0000 → AND', '0001 → OR');
        },
  async (tok, S) => {
          relbl(S.tb[2], '0010 add'); glow(S.tb[0], null); glow(S.tb[1], null); glow(S.tb[2], HL); setL(S.ctl, 'ALU control = 0010 → add');
          cap('0010 → add', '這些 code 之後會看到都有意義');
        },
  async (tok, S) => {
          glow(S.tb[2], null); cap('control bits 從哪來？', '指令最後面那段 bit pattern');
        },
  async (tok, S) => {
          gone(S.tb); S.f = [['op', 6], ['rs', 5], ['rt', 5], ['rd', 5], ['shamt', 5], ['funct', 6]];
          let x = -5.9; S.fc = S.f.map(([t, n]) => { const w = n * 0.32; const m = bx(t + '（' + n + '）', FC.sky, x + w / 2, 6.5, 0, w - 0.06, 0.55); x += w; return m; });
          cap('R-type：op rs rt rd shamt funct', '6 + 5 + 5 + 5 + 5 + 6 = 32');
        },
  async (tok, S) => {
          relbl(S.fc[0], '000000'); glow(S.fc[0], HL); cap('R-type 的 op 都是 000000', '加或減分不出來');
        },
  async (tok, S) => {
          glow(S.fc[0], null); glow(S.fc[5], HL); cap('由 funct 決定做什麼', 'add、sub、and…各有不同 funct');
        },
  async (tok, S) => {
          S.fa = arrow(V3(3.4, 6.1, 0), V3(0.5, 5.0, 0), 0xc08a1f); setL(S.ctl, 'funct → ALU control'); cap('funct → ALU control code', 'control 就 map 到這裡');
        }
]);
scene('nuB-9b-slice', "9B：divide and conquer 與 1-bit ALU", CAM, [
  async (tok, S) => {
          S.row = reg('32 bits', 32, 0.4, 5.2, { w: 0.36 }); cap('32 bits 一開始很難做', '一個 bit 一個 bit 慢慢來');
        },
  async (tok, S) => {
          glow(S.row.ms[31], HL); S.cut = hot('one-bit slice', S.row.xs[31] - 0.3, 6.1); cap('divide and conquer', 'break the problem into simpler problems');
        },
  async (tok, S) => {
          for (let i = 30; i >= 0; i -= 1) glow(S.row.ms[i], i % 2 ? '#3a2a00' : HL);
          await wt(tok, 400); cap('每個 bit 做同樣的動作', '解決一個 bit，再 glue 起來');
        },
  async (tok, S) => {
          S.row.clearGlow(); cap('再做 extension', '把它變成更複雜的問題');
        },
  async (tok, S) => {
          gone(S.row, S.cut); S.g = alu1({}); S.g.mux.visible = false; S.g.ins.forEach((w) => { w.visible = false; }); S.g.inL.forEach((l) => { l.element.style.visibility = 'hidden'; });
          setL(S.g.res, ''); setL(S.g.opL, ''); cap('一個 bit：AND、OR、一個 full adder', 'a、b 同時送進去');
        },
  async (tok, S) => {
          S.g.mux.visible = true; S.g.ins.slice(0, 3).forEach((w) => { w.visible = true; }); S.g.inL.slice(0, 3).forEach((l) => { l.element.style.visibility = ''; });
          setL(S.g.res, 'Result'); setL(S.g.opL, 'Operation'); cap('control 不同要不同結果', '後面加一個 MUX 來選');
        }
]);
scene('nuB-9b-mux', "9B：2-to-1、4-to-1 MUX 與 ALU 的 Operation", CAM, [
  async (tok, S) => {
          S.st = buddy('同學', '?', FC.sky, -5.4, 0, 0, 0.9); cap('什麼是 MUX？', '邏輯設計學過的 multiplexer');
        },
  async (tok, S) => {
          S.m = muxB('MUX', 0, 3.4, 2.4, 0.9); S.iA = hd('A', -2.6, 4.2); S.iB = hd('B', -2.6, 2.6);
          S.wA = wire([[-2.2, 4.2], [-0.45, 4.2]]); S.wB = wire([[-2.2, 2.6], [-0.45, 2.6]]); wire([[0.45, 3.4], [2.0, 3.4]]); S.out = hot('output', 3.0, 3.4);
          cap('2-to-1 MUX：兩個 input', '只有一個 output');
        },
  async (tok, S) => {
          S.sel = sm('select = ?', 0, 1.7); wire([[0, 2.0], [0, 2.2]]); cap('select input：幾個 bit？', '兩個 input → 1 bit 就夠');
        },
  async (tok, S) => {
          setL(S.sel, 'select = 0'); S.wA.material.color.set('#c08a1f'); setL(S.out, 'output = A'); S.st.set('0'); S.st.mood('happy');
          cap('select = 0', 'A 到 output');
        },
  async (tok, S) => {
          setL(S.sel, 'select = 1'); S.wA.material.color.set(FC.wire); S.wB.material.color.set('#c08a1f'); setL(S.out, 'output = B'); S.st.set('1');
          cap('select = 1', 'B 到 output');
        },
  async (tok, S) => {
          gone(S.m, S.iA, S.iB, S.wA, S.wB, S.sel); S.m = muxB('MUX', 0, 3.4, 3.6, 0.9);
          S.w4 = [0, 1, 2, 3].map((k) => { hd('in' + k, -2.6, 4.8 - k * 0.95); return wire([[-2.0, 4.8 - k * 0.95], [-0.45, 4.8 - k * 0.95]]); });
          setL(S.out, 'output'); S.st.set('?'); S.st.mood('wow'); cap('4-to-1 MUX', '四個 input、一個 output');
        },
  async (tok, S) => {
          S.sel = sm('select（2 bits）', 0, 1.2);
          for (let k = 0; k < 4; k++) { S.w4.forEach((w, i) => w.material.color.set(i === k ? '#c08a1f' : FC.wire)); setL(S.sel, 'select = ' + k.toString(2).padStart(2, '0') + ' → in' + k); await wt(tok, 450); }
          cap('select 2 bits：00 01 10 11', '決定誰到 output');
        },
  async (tok, S) => {
          gone(S.m, S.w4, S.sel, S.out); S.st.g.position.x = -6.4; S.st.mood('calm'); S.st.set('');
          S.g = alu1({}); cap('ALU：AND、OR、一個 bit 的加法', '接到一個 MUX');
        },
  async (tok, S) => {
          setL(S.g.opL, 'Operation（select）'); glow(S.g.mux, HL); cap('三個 input：3-to-1 MUX', 'Operation 就是 select input');
        },
  async (tok, S) => {
          glow(S.g.mux, null); setL(S.g.opL, 'Operation：2 bits'); cap('還是要兩個 bit', '多一個組合沒用到');
        },
  async (tok, S) => {
          S.g.sel(0, '00'); setL(S.g.res, 'Result = a AND b'); cap('Operation = 00', '選 AND');
        },
  async (tok, S) => {
          S.g.sel(1, '01'); setL(S.g.res, 'Result = a OR b'); await wt(tok, 900);
          S.g.sel(2, '10'); setL(S.g.res, 'Result = sum'); cap('01 → OR、10 → add', '邏輯設計的 MUX 這裡馬上用到');
        },
  async (tok, S) => {
          S.g.sel(-1, '00 / 01 / 10'); setL(S.g.res, 'Result'); good('一個 MUX → 同時能做 3 種 operation', 0.6, 6.7); cap('control 00 AND、01 OR、10 add', '透過 MUX 同時支援三種');
        }
]);
scene('nuB-9b-chain', "9B：carry out 接到下一個 bit 的 carry in", CAM, [
  async (tok, S) => {
          S.c = chain4(2.4); cap('會做一個 bit 就會做四個 bit', '同一片重複四次');
        },
  async (tok, S) => {
          const a = '0101', b = '0011', r = addB(a, b, 0); S.r = r;
          sm('示意：0101 + 0011', 0, 5.3); S.c.top.forEach((l, i) => setL(l, 'a' + i + '=' + a[3 - i] + ' b' + i + '=' + b[3 - i]));
          for (let i = 0; i < 4; i++) {
            glow(S.c.sl[i], HL); setL(S.c.out[i], 'Result' + i + ' = ' + r.s[3 - i]);
            const co = i < 3 ? r.cin[2 - i] : r.cout;
            if (i < 3) { S.c.cw[i].material.color.set(co ? '#c08a1f' : FC.wire); sm('c=' + co, S.c.sx(i) - 1.5, 2.0); }
            await wt(tok, 420); glow(S.c.sl[i], null);
          }
          cap('carry out → 下一個 bit 的 carry in', '一路往左傳');
        },
  async (tok, S) => {
          ok(S.r.s === (5 + 3).toString(2).padStart(4, '0'), 0, 0.3, '0101 + 0011 = ' + S.r.s + ' = 8 ✓'); cap('Result = 1000 = 8', 'carry 一片一片傳過去');
        },
  async (tok, S) => {
          hot('… × 8 → 32 bits', -5.6, 5.3); cap('四個 bit 會，就會 16、32 bits', '一直接下去');
        },
  async (tok, S) => {
          S.op = sm('Operation（同時給每一片）', 0, 4.4); S.c.sl.forEach((m) => glow(m, HL)); await wt(tok, 500);
          cap('Operation 同時給每一片', '已經會 add、and、or');
        }
]);
scene('nuB-9b-sub', "9B：用加法器做減法", CAM, [
  async (tok, S) => {
          S.q = hot('a − b ？', 0, 5.8); cap('會不會做減？', 'two\'s complement 的減法');
        },
  async (tok, S) => {
          S.add = bx('加法器（已經有了）', FC.orange, 0, 4.4, 0, 3.2, 0.7); cap('A − B：我還是要做加', '不要新的減法東西');
        },
  async (tok, S) => {
          setL(S.q, 'A − B = A + (−B)'); cap('把 B 變成負 B', 'A + (−B) 就是要的答案');
        },
  async (tok, S) => {
          S.B = reg('B', 4, 0.3, 2.6, { w: 0.9, bits: '0110' }); S.B.val('= 6（示意）'); cap('負 B 怎麼來？', 'two\'s complement 怎麼取負');
        },
  async (tok, S) => {
          S.B.set('1001', true); S.B.val('反相 → 1001'); cap('第一步：0 變 1、1 變 0', '0110 → 1001');
        },
  async (tok, S) => {
          const nb = bin(uval('1001') + 1, 4); S.B.set(nb, true); S.B.val('+1 → ' + nb);
          ok(sval(nb) === -6, 0.3, 1.5, nb + ' = ' + sval(nb) + ' = −6 ✓'); cap('第二步：再加 1', '1001 + 1 = 1010 = −6');
        },
  async (tok, S) => {
          gone(S.q, S.add, S.B); fresh(CAM[0], CAM[1]); S.g = alu1({ binv: true }); cap('b 前面加一個 2-to-1 MUX', '選 b 或 b 反相');
        },
  async (tok, S) => {
          setL(S.g.binvL, 'Binvert = 0 → b'); glow(S.g.binv, null); cap('Binvert = 0', 'b 正常出去');
        },
  async (tok, S) => {
          setL(S.g.binvL, 'Binvert = 1 → b̄'); glow(S.g.binv, HL); cap('Binvert = 1', '做 invert（只做到 1\'s complement）');
        },
  async (tok, S) => {
          S.q = hot('+1 加在哪裡？', -1.5, 0.3); cap('還要加 1', '1 要加在哪裡？');
        },
  async (tok, S) => {
          glow(S.g.ADD, HL); setL(S.g.cinL, 'CarryIn（第三個 input）'); cap('每一片都是 full adder', '三個 input：x、y、carry in');
        },
  async (tok, S) => {
          setL(S.g.cinL, 'CarryIn₀ = 1'); setL(S.q, '+1 = bit 0 的 CarryIn'); cap('1 就設成 carry in', 'least significant bit 給它 1');
        },
  async (tok, S) => {
          gone(S.q); const r = addB('0111', '1001', 1); S.r = r;
          ok(r.s === bin(7 - 6, 4), -1.0, 0.3, '示意 0111 + 1001 + 1 = ' + r.s + ' = 1 ✓（7 − 6）'); cap('Binvert = 1、CarryIn = 1', '就是做 a − b');
        }
]);
scene('nuB-9b-code', "9B：control code 每個 bit 在控制什麼", CAM, [
  async (tok, S) => {
          S.rows = [['0000', 'AND'], ['0001', 'OR'], ['0010', 'add'], ['0110', 'sub']].map(([c, t], i) => {
            const r = reg(t, 4, 0.0, 5.4 - i * 1.0, { w: 0.8, bits: c }); return r;
          });
          cap('code 不是沒有意義的', 'AND、OR、add、sub');
        },
  async (tok, S) => {
          S.rows.forEach((r) => r.hi(2, 4)); cap('最後兩 bit：AND 00、OR 01', 'add 10');
        },
  async (tok, S) => {
          S.rows[3].hi(1, 2, '#7a1010'); cap('subtract 其實就是加', '多一個 1 = b negate');
        },
  async (tok, S) => {
          S.rows.forEach((r) => r.hi(2, 4)); hot('後兩 bit → MUX select', 4.4, 6.4); cap('後兩 bit 就是 MUX 的 select input', '00、01、10');
        },
  async (tok, S) => {
          S.rows.forEach((r) => r.hi(1, 2, '#7a1010')); hot('第三 bit → Bnegate', 4.4, 5.8); cap('第三個 bit：B 要不要 negate', '要就 1、不要就 0');
        },
  async (tok, S) => {
          S.rows.forEach((r, i) => r.hi(i >= 2 ? 1 : 9, 4)); glow(S.rows[2].ms[1], null);
          good('add 0010 vs sub 0110：只差 Bnegate', 0, 1.3); cap('加跟減都設 10', '只是 B 要不要 negate');
        },
  async (tok, S) => {
          S.rows.forEach((r) => r.clearGlow()); sm('instruction（funct）→ 4 bits → 各個 control signal', 0, 0.4); cap('從 instruction 拿出這 4 個 bit', '控制要加、減還是什麼');
        },
  async (tok, S) => {
          bub('control = MUX select + 要不要 invert', 0, 6.7); cap('control 其實就是 MUX select', '還有 B 要不要 negate');
        }
]);
scene('nuB-9b-nor', "9B：用 AND 做 NOR，control = 1100", CAM, [
  async (tok, S) => {
          S.g = alu1({ ainv: true, binv: true }); cap('再看 NOR', 'NOR 是怎麼來的？');
        },
  async (tok, S) => {
          const all = [[0, 0], [0, 1], [1, 0], [1, 1]].every(([a, b]) => (+!(a | b)) === ((1 - a) & (1 - b)));
          ok(all, 3.6, 6.6, 'a NOR b = ā · b̄（4 種組合都對）✓'); cap('NOR = not a AND not b', 'De Morgan 的 law');
        },
  async (tok, S) => {
          setL(S.g.ainvL, 'Ainvert = 1'); setL(S.g.binvL, 'Binvert = 1'); glow(S.g.ainv, HL); glow(S.g.binv, HL); cap('a 要 invert、b 要 invert', '然後再 AND');
        },
  async (tok, S) => {
          S.g.sel(0, '00'); setL(S.g.res, 'Result = ā AND b̄'); cap('最後 select 是 00', '選 AND');
        },
  async (tok, S) => {
          S.code = reg('NOR', 4, 4.4, -0.4, { w: 0.8 }); S.code.val('= ?'); cap('NOR 的 control signal 是什麼？', '根據剛剛的規則');
        },
  async (tok, S) => {
          S.code.set('1100', true); S.code.val('= 1100'); ok(true, -2.4, -0.4, 'Ainvert 1 · Bnegate 1 · 00（AND）✓'); cap('NOR = 1100', 'A negate、B negate、選 AND');
        },
  async (tok, S) => {
          S.code.clearGlow(); cap('這些都是 control signal', '決定你要做什麼 operation');
        }
]);
scene('nuB-9b-slt', "9B：slt 的三個部分（bit 0、中間、sign bit）", WIDE, [
  async (tok, S) => {
          S.c = code(['slt  $rd, $rs, $rt', 'rd = (rs < rt) ? 1 : 0'], -2.6, 6.6); cap('set on less than 怎麼做？', '先想它的 operation 是什麼');
        },
  async (tok, S) => {
          S.va = reg('a', 4, -2.6, 4.7, { w: 0.8, bits: '0011' }); S.va.val('= 3（示意）'); S.vb = reg('b', 4, -2.6, 3.8, { w: 0.8, bits: '0101' }); S.vb.val('= 5（示意）');
          cap('兩個 register 比大小', 'a 有沒有小於 b');
        },
  async (tok, S) => {
          S.no = bad('另做比較器？很麻煩', 3.6, 4.6); cap('要做一個比較器嗎？', '很麻煩，已經有加減了');
        },
  async (tok, S) => {
          gone(S.no); const r = addB('0011', inv('0101'), 1); S.d = reg('a − b', 4, -2.6, 2.9, { w: 0.8, bits: r.s }); S.d.val('= ' + sval(r.s));
          S.d.hi(0, 1, '#7a1010'); ok(sval(r.s) === 3 - 5, 3.6, 2.9, '0011 + 1010 + 1 = ' + r.s + ' = −2 ✓'); cap('只要做 A − B', '是負數就滿足條件');
        },
  async (tok, S) => {
          S.rd = reg('rd', 32, 0.4, 1.4, { w: 0.36 }); S.rd.val(''); cap('只要 set 一個 bit', 'destination 只看一個 bit');
        },
  async (tok, S) => {
          S.rd.set('0'.repeat(31) + '1', true); S.rd.val('= 1'); cap('bit 0 設 1 表示小於', '其他 bit 都是 0');
        },
  async (tok, S) => {
          S.rd.hi(0, 1, '#7a1010'); S.rd.ms.slice(1, 31).forEach((m) => glow(m, '#3a3a3a')); glow(S.rd.ms[31], HL);
          S.p3 = [sm('sign bit', S.rd.xs[0], 0.7), sm('bit 1～30', S.rd.xs[16], 0.7), sm('bit 0', S.rd.xs[31], 0.7)]; cap('分三個部分', 'sign bit、中間、bit 0');
        },
  async (tok, S) => {
          gone(S.c, S.va, S.vb, S.d); S.rd.clearGlow(); S.ch = chain4(4.2); S.ch.top.forEach((l, i) => setL(l, i === 3 ? 'MSB' : 'bit ' + i));
          cap('bit 1 到 bit 30', '通通直接給 0');
        },
  async (tok, S) => {
          [1, 2].forEach((i) => sm('Less = 0', S.ch.sx(i), 6.0)); setL(S.ch.out[1], 'Result1 = 0'); setL(S.ch.out[2], 'Result2 = 0');
          cap('MUX 的 11 還沒用到', '接 Less = 0');
        },
  async (tok, S) => {
          glow(S.ch.sl[3], HL); cap('sign bit：減法早就做好了', '只要設成減');
        },
  async (tok, S) => {
          S.setW = wire([[S.ch.sx(3), 3.3], [S.ch.sx(3), 2.2], [S.ch.sx(0) + 1.3, 2.2], [S.ch.sx(0) + 1.3, 5.5], [S.ch.sx(0) + 0.4, 5.5]], FC.red);
          hot('Set', S.ch.sx(3) - 0.6, 2.0); cap('把 sign bit 拉出來', '這條叫 Set');
        },
  async (tok, S) => {
          const r = addB('0011', inv('0101'), 1); S.set = r.s[0]; S.ch.top.forEach((l, i) => setL(l, 'a' + i + '−b' + i));
          sm('示意：a = 0011、b = 0101', 0, 6.8); hot('Set = ' + S.set, S.ch.sx(3) + 0.9, 2.0); cap('a − b 是負數', 'sign bit 就是 1');
        },
  async (tok, S) => {
          sm('Less = Set', S.ch.sx(0), 6.0); setL(S.ch.out[0], 'Result0 = ' + S.set); glow(S.ch.sl[0], HL); cap('拉到 bit 0', '1 就是 set');
        },
  async (tok, S) => {
          sm('Less = 0', S.ch.sx(3), 6.0); setL(S.ch.out[3], 'Result3 = 0'); glow(S.ch.sl[3], null);
          const res = '000' + S.set; ok(res === '0001' && (3 < 5), 0, 0.5, 'slt 結果 = ' + res + '（3 < 5 成立）✓'); cap('sign bit 自己還是給 0', '只有 bit 0 是 0 或 1');
        },
  async (tok, S) => {
          S.rd.hi(31, 32); cap('相減之後放 000…001', '不小於就全部是 0');
        },
  async (tok, S) => {
          S.cc = reg('slt', 4, 4.6, -0.3, { w: 0.6, bits: '0111' }); S.cc.hi(1, 4); cap('control = 0111', 'B negate + 選 11');
        },
  async (tok, S) => {
          S.ch.sl.forEach((m) => glow(m, HL)); cap('你做 select 時，其他也都做了', 'AND、OR、加都同時在算');
        },
  async (tok, S) => {
          S.ch.sl.forEach((m) => glow(m, null)); glow(S.ch.sl[0], HL); cap('只是沒選中，白做了', '但 slt 可以借用減法的結果');
        },
  async (tok, S) => {
          bub('parallel data flow：都做了，MUX 只負責選', 0, 7.0); cap('parallel data flow', 'input 一來 output 就變');
        },
  async (tok, S) => {
          code(['AND 0000  OR 0001  add 0010', 'sub 0110  slt 0111  NOR 1100'], -2.2, -0.5); cap('00 AND、01 OR、10 加', 'sub、slt 都有 B negate');
        }
]);
scene('nuB-9b-range', "9B：4-bit two's complement 的範圍", CAM, [
  async (tok, S) => {
          hot('什麼是 overflow？', 0, 6.4); cap('還要考慮 overflow', '先看 representation');
        },
  async (tok, S) => {
          S.cells = [];
          for (let v = -8; v <= 7; v++) { const x = -6.0 + (v + 8) * 0.8; S.cells.push(bx(bin(v, 4), v < 0 ? FC.pink : FC.sky, x, 3.6, 0, 0.74, 0.5, 0.6)); sm(String(v), x, 2.8); }
          cap('4 bits：正數 0 到 7', '負數 −1 到 −8');
        },
  async (tok, S) => {
          glow(S.cells[0], HL); glow(S.cells[15], HL); good('範圍：−8 ～ 7（2⁴ = 16 種）✓', 0, 1.6); cap('16 個 combination', '最大 7、最小 −8');
        }
]);
scene('nuB-9b-ovf', "9B：7 + 3、−4 + (−5)，看 sign bit 的 carry in／out", CAM, [
  async (tok, S) => {
          sm('4-bit two\'s complement：−8 ～ 7', 0, 6.6); cap('根據 representation 做運算', '4 bits 最多 7 跟 −8');
        },
  async (tok, S) => {
          S.A = reg('7', 4, -3.0, 5.2, { w: 0.8, bits: '0111' }); S.B = reg('3', 4, -3.0, 4.4, { w: 0.8, bits: '0011' }); S.Sx = reg('和', 4, -3.0, 3.4, { w: 0.8 });
          S.r1 = addB('0111', '0011'); await rippleIn(tok, S.Sx, S.A, S.r1, 300, 6.0); S.Sx.val('= ' + S.r1.s);
          cap('7 + 3 = ?', '0111 + 0011');
        },
  async (tok, S) => {
          bad('真正答案 10 > 7 → overflow', -3.0, 2.5); cap('應該是 10', '超過範圍：overflow');
        },
  async (tok, S) => {
          S.C = reg('−4', 4, 3.2, 5.2, { w: 0.8, bits: '1100' }); S.D = reg('−5', 4, 3.2, 4.4, { w: 0.8, bits: '1011' }); S.Sy = reg('和', 4, 3.2, 3.4, { w: 0.8 });
          S.r2 = addB('1100', '1011'); await rippleIn(tok, S.Sy, S.C, S.r2, 300, 6.0); S.Sy.val('= ' + S.r2.s);
          cap('−4 + (−5) 應該是 −9', '最多只能到 −8');
        },
  async (tok, S) => {
          ok(sval(S.r1.s) === -6, -3.0, 1.7, '0111 + 0011 → ' + S.r1.s + ' = −6 ✓'); ok(sval(S.r2.s) === 7, 3.2, 1.7, '1100 + 1011 → ' + S.r2.s + ' = +7 ✓');
          S.Sx.hi(0, 1, '#7a1010'); S.Sy.hi(0, 1, '#7a1010'); cap('正數怎麼變成 −6？', '負數怎麼變成正數？');
        },
  async (tok, S) => {
          S.q1 = good('一正一負：永遠不會 overflow', 0, 0.9); cap('一正一負有沒有可能 overflow？', '永遠不會，會抵消');
        },
  async (tok, S) => {
          S.q2 = note('同號相加才可能 overflow', 0, 0.3); cap('sign 一樣時', '才有可能 overflow');
        },
  async (tok, S) => {
          cap('正 + 正 應該是正', '負 + 負 應該是負');
        },
  async (tok, S) => {
          gone(S.q1, S.q2); bad('正 + 正 = 負，或 負 + 負 = 正 → overflow', 0, 1.0); cap('sum 的 sign bit 不對', '就是 overflow');
        },
  async (tok, S) => {
          S.A.hi(0, 1); S.C.hi(0, 1); cap('只要看 most significant bit', 'carry in 跟 carry out 一不一樣');
        },
  async (tok, S) => {
          ok(S.r1.cin[0] === 1 && S.r1.cout === 0 && S.r1.ovf, -3.0, 0.0, 'MSB：carry in ' + S.r1.cin[0] + '、carry out ' + S.r1.cout + ' → overflow ✓');
          cap('有 carry in、沒有 carry out', '不一樣 → overflow');
        },
  async (tok, S) => {
          ok(S.r2.cin[0] === 0 && S.r2.cout === 1 && S.r2.ovf, 3.2, 0.0, 'MSB：carry in ' + S.r2.cin[0] + '、carry out ' + S.r2.cout + ' → overflow ✓');
          cap('沒有 carry in、有 carry out', '也是 overflow');
        },
  async (tok, S) => {
          cap('carry 進來沒推出去 → 變號', '或 1 被推出去 → 負變正');
        },
  async (tok, S) => {
          unit('XOR', FC.red, 0, -0.9, 1.1, 0.6); sm('Cin(MSB)', -1.6, -0.6); sm('Cout(MSB)', -1.6, -1.2); hot('= 1 → Overflow', 1.9, -0.9);
          cap('XOR(carry in, carry out)', '= 1 就是 overflow');
        }
]);
scene('nuB-9b-after', "9B：exception、unsigned 指令、Zero = NOR", CAM, [
  async (tok, S) => {
          S.ov = hot('Overflow = 1', -4.4, 5.6); cap('overflow 產生之後會怎樣？', '');
        },
  async (tok, S) => {
          sm('depends on the language definition', -1.0, 6.4); cap('depends on the language', '有的語言不在乎');
        },
  async (tok, S) => {
          S.p = prop('cpu', -1.2, 2.2, 0, 1.0); bx('add / sub', FC.orange, -4.4, 4.2, 0, 2.2, 0.6); arrow(V3(-3.2, 4.0, 0), V3(1.4, 3.6, 0), 0xd64545); bx('exception handler', FC.red, 3.4, 3.6, 0, 3.0, 0.6);
          cap('要處理：用 signed 指令', '一 overflow 就跳 exception handler');
        },
  async (tok, S) => {
          bx('addu（不檢查）', FC.mint, -4.4, 2.6, 0, 2.2, 0.6); cap('不在乎：用 unsigned instruction', '不會做任何特別動作');
        },
  async (tok, S) => {
          const z = (s) => (s.includes('1') ? 0 : 1);
          S.r1 = reg('Result', 4, 1.6, 0.6, { w: 0.7, bits: '0000' }); S.r1.val('Zero = ' + z('0000')); S.r2 = reg('Result', 4, 1.6, -0.3, { w: 0.7, bits: '0100' }); S.r2.val('Zero = ' + z('0100'));
          ok(z('0000') === 1 && z('0100') === 0, -3.6, -1.0, 'Zero = NOR(全部 bit)：0000→1、0100→0 ✓'); cap('detect 0：全部 bit 做 NOR', '1 表示每個 bit 都是 0');
        }
]);

// ════════ kWCUI2x7iSQ（第10A講 Computer Arithmetic） ════════
scene('nuB-10a-recap', "10A：上一講的 ALU 回顧", CAM, [
  async (tok, S) => {
          S.isa = bx('ISA（已 define）', FC.lilac, -4.4, 5.4, 0, 2.8, 0.6); S.org = bx('organization？', FC.paper, -4.4, 3.8, 0, 2.8, 0.6); arrow(V3(-4.4, 5.0, 0), V3(-4.4, 4.2, 0));
          cap('ISA 定好了', '從 component 開始建 organization');
        },
  async (tok, S) => {
          S.g = alu1({ ainv: true, binv: true, less: true }); S.g.all.forEach((o) => { if (o.position) o.position.x += 1.4; });
          cap('上次介紹到 ALU', '');
        },
  async (tok, S) => {
          for (let k = 0; k < 4; k++) { S.g.sel(k, k.toString(2).padStart(2, '0')); await wt(tok, 350); }
          cap('and、or、slt、nor、加', '透過一個 MUX 來控制');
        },
  async (tok, S) => {
          S.g.sel(-1, '← funct'); hot('funct → control signal → MUX select', 0.6, 6.7); cap('select input = control signal', '由 functional code 來');
        }
]);
scene('nuB-10a-ripple', "10A：full adder 與 ripple carry 的 delay", CAM, [
  async (tok, S) => {
          S.c = chain4(3.0); S.c.sl.forEach((m, i) => relbl(m, 'FA' + i)); cap('前面介紹的叫 ripple carry adder', '');
        },
  async (tok, S) => {
          S.c.sl.forEach((m) => glow(m, HL)); await wt(tok, 500); S.c.sl.forEach((m) => glow(m, null)); cap('一個 bit 設計完', 'repeat 這個 bit slice');
        },
  async (tok, S) => {
          glow(S.c.sl[0], HL); cap('ripple carry adder 有什麼問題？', '先看一個 full adder');
        },
  async (tok, S) => {
          setL(S.c.top[0], 'x、y、carry in'); cap('full adder：三個 input', 'X、Y、carry in');
        },
  async (tok, S) => {
          cap('三個 input', '產生幾個 output？兩個');
        },
  async (tok, S) => {
          setL(S.c.out[0], 'sum、carry out'); cap('一個 sum、一個 carry out', 'sum 直接就是結果');
        },
  async (tok, S) => {
          S.c.cw[0].material.color.set('#c08a1f'); glow(S.c.sl[1], HL); cap('carry out 給下一階', '下一階又要它當 carry in');
        },
  async (tok, S) => {
          let all = true; for (let v = 0; v < 8; v++) { const x = v >> 2 & 1, y = v >> 1 & 1, c = v & 1; all = all && (((x + y + c) >> 1) === ((x & y) | (x & c) | (y & c))); }
          S.f = code(['carry out = xy + x·cin + y·cin'], 0, 6.4); ok(all, 0, 5.7, '任兩個為 1 就進位（8 種組合）✓'); cap('任兩個 input 是 1 就有 carry', '三個 AND gate 加一個 OR gate');
        },
  async (tok, S) => {
          S.d = hot('每一級：2 gate delays', -4.6, 0.8); cap('一個 stage：two gate delay', '一個 AND、一個 OR');
        },
  async (tok, S) => {
          const a = '1111', b = '0001', c = rippleC(a, b, 0);
          S.c.sl.forEach((m) => glow(m, null)); S.c.top.forEach((l, i) => setL(l, 'a' + i + '=' + a[3 - i] + ' b' + i + '=' + b[3 - i])); sm('示意：1111 + 0001', 0, 5.0);
          for (let i = 0; i < 4; i++) { glow(S.c.sl[i], HL); setL(S.c.out[i], 'c' + (i + 1) + '=' + c[i + 1]); if (i < 3) S.c.cw[i].material.color.set('#c08a1f'); setL(S.d, '已經 ' + 2 * (i + 1) + ' gate delays'); await wt(tok, 450); glow(S.c.sl[i], null); }
          ok(c.slice(1).join('') === '1111', 0.4, 0.8, '4 級 × 2 = 8 gate delays；32 bits → 64 ✓');
          cap('一級等一級', '32 bits 要 32 個 stage 的 delay');
        },
  async (tok, S) => {
          glow(S.c.sl[3], '#7a1010'); cap('最慢的是最後一個 carry out', '要過很多 stage');
        },
  async (tok, S) => {
          bad('delay 太長 → clock cycle 拉長', 0.4, 6.6); cap('high performance 不能接受', 'clock cycle 會很長');
        },
  async (tok, S) => {
          good('改進：carry lookahead adder', 0.4, 7.2); cap('一定要經過這麼多 stage 嗎？', '介紹 carry lookahead adder');
        }
]);
scene('nuB-10a-subst', "10A：展開成 sum of products，用硬體換時間", CAM, [
  async (tok, S) => {
          S.b0 = unit('bit 0', FC.orange, 3.2, 3.2, 1.8, 1.2); S.b1 = unit('bit 1', FC.orange, -1.2, 3.2, 1.8, 1.2);
          sm('a0 b0', 3.2, 4.2); sm('a1 b1', -1.2, 4.2); sm('c0 →', 5.0, 3.2); cap('先看兩個 bit', 'least significant 開始');
        },
  async (tok, S) => {
          wire([[2.3, 3.2], [-0.3, 3.2]], '#c08a1f'); hot('c1', 1.0, 3.6); cap('bit 0 的 carry out', '= bit 1 的 carry in（同一個東西）');
        },
  async (tok, S) => {
          S.e1 = code(['c1 = b0·c0 + a0·c0 + a0·b0'], 0, 6.4); cap('c1 = b0c0 + a0c0 + a0b0', '任兩個 bit 是 1');
        },
  async (tok, S) => {
          S.e2 = code(['c2 = b1·c1 + a1·c1 + a1·b1'], 0, 5.8); cap('c2 = b1c1 + a1c1 + a1b1', '');
        },
  async (tok, S) => {
          S.e2.ls[0].element.style.color = '#b42318'; bad('c2 要等 c1 → 等 bit 0 算完', -1.2, 1.8); cap('這裡用到 C1', '要等那邊算完才有');
        },
  async (tok, S) => {
          sm('sum of products：先 AND（同時）再 OR → two-level', 0, 5.2); cap('sum of products', '兩個 gate delay');
        },
  async (tok, S) => {
          cap('但 c1 還是要等前面做完', '這就是 ripple carry 的問題');
        },
  async (tok, S) => {
          S.ar = arrow(V3(-1.6, 6.15, 0), V3(-0.4, 5.95, 0), 0xc08a1f); cap('空間換取時間：duplicate', '把 c1 的式子帶進去');
        },
  async (tok, S) => {
          gone(S.e2, S.ar); S.e3 = code(['c2 = a1a0b0 + a1a0c0 + a1b0c0', '   + b1a0b0 + b1a0c0 + b1b0c0 + a1b1'], 0, 5.8);
          let all = true; for (let v = 0; v < 32; v++) { const [a0, b0, a1, b1, c0] = [0, 1, 2, 3, 4].map((k) => v >> k & 1); const c1 = (b0 & c0) | (a0 & c0) | (a0 & b0); const ref = (b1 & c1) | (a1 & c1) | (a1 & b1);
            const flat = (a1 & a0 & b0) | (a1 & a0 & c0) | (a1 & b0 & c0) | (b1 & a0 & b0) | (b1 & a0 & c0) | (b1 & b0 & c0) | (a1 & b1); all = all && flat === ref; }
          ok(all, 0, 0.6, '展開式 = 原式（32 種組合）✓'); cap('帶進去再展開', '就得到這個式子');
        },
  async (tok, S) => {
          gone(S.e1); good('只用一開始就有的 a、b、c0 → 不用等 c1', 0, 4.6); cap('每一項都可以馬上拿到', '還是 two level');
        },
  async (tok, S) => {
          sm('3-input AND × 6 + 2-input AND × 1，再一個 OR', 0, 4.0); cap('gate 變多了', '用 hardware 去換取時間');
        },
  async (tok, S) => {
          bub('不等前一級：carry lookahead', 0, 7.0); cap('我不等你了，一起做', 'carry lookahead adder 的概念');
        }
]);
scene('nuB-10a-gp', "10A：gi = ai·bi，pi：一個 1 就能把 carry 傳下去", CAM, [
  async (tok, S) => {
          S.fa = unit('bit i', FC.orange, 0, 3.0, 2.2, 1.4); hd('ai', -0.6, 4.2); hd('bi', 0.6, 4.2); sm('carry in →', 2.0, 3.0); sm('← carry out', -2.3, 3.0);
          cap('看每一個 bit', '怎樣會產生 carry');
        },
  async (tok, S) => {
          S.eq = code(['gi = ai · bi', 'pi = ai ⊕ bi（課本：ai + bi）'], 0, 6.4); cap('Generate term、Propagate term', '每一個 bit 都產生');
        },
  async (tok, S) => {
          cap('G：Generate', 'P：Propagate');
        },
  async (tok, S) => {
          S.st = buddy('bit i', '', FC.orange, -5.2, 0, 0, 0.9); cap('什麼叫 generate？', '自己就可以產生 carry');
        },
  async (tok, S) => {
          S.st.set('1+1'); S.st.mood('happy'); const okk = [0, 1].every((c) => ((1 + 1 + c) >> 1) === 1);
          ok(okk, 0, 1.0, 'ai = bi = 1：cin = 0 或 1 都進位 ✓'); cap('ai = 1、bi = 1', '管你 carry in 是什麼');
        },
  async (tok, S) => {
          S.eq.hl(0); cap('gi = ai AND bi', 'generate term');
        },
  async (tok, S) => {
          S.st.mood('calm'); S.st.set('?'); cap('什麼叫 propagate？', 'in 有 1 → out 有 1；in 是 0 → out 是 0');
        },
  async (tok, S) => {
          S.st.set('1+0'); const okk = [[1, 0], [0, 1]].every(([a, b]) => [0, 1].every((c) => ((a + b + c) >> 1) === c));
          ok(okk, 0, 0.3, '只有一個 1：carry out = carry in ✓'); cap('兩個 bit 裡只有一個 1', 'carry in 就會傳到 carry out');
        },
  async (tok, S) => {
          S.eq.hl(1); cap('pi = 1：(1,0) 或 (0,1)', '這個 bit 可以 propagate');
        },
  async (tok, S) => {
          S.eq.hl(-1); good('gi、pi 只看 ai、bi → 馬上算得出來', 0, -0.4); cap('每個 bit 都產生 g、p', 'ai、bi 一進來馬上就有');
        }
]);
scene('nuB-10a-eq', "10A：c(i+1) = gi + pi·ci 全部展開", CAM, [
  async (tok, S) => {
          S.c = chain4(2.8); S.c.sl.forEach((m, i) => relbl(m, 'bit ' + i)); cap('第 0 個 bit 什麼時候有 carry out？', '自己 generate，或 propagate');
        },
  async (tok, S) => {
          S.e = code(['c1 = g0 + p0·c0'], 0, 6.6); cap('c1 = g0 + p0·c0', 'propagate 要 p0 = 1 且 c0 = 1');
        },
  async (tok, S) => {
          gone(S.e); S.e = code(['c2 = g1', '   + p1·g0', '   + p1·p0·c0'], 0, 6.6); S.e.ls.forEach((l, k) => { if (k) l.element.style.visibility = 'hidden'; }); S.e.hl(0);
          cap('C1：你自己 generate', 'G1');
        },
  async (tok, S) => {
          S.e.ls[1].element.style.visibility = ''; S.e.hl(1); cap('前一個 generate', '你要幫它 propagate：G0·P1');
        },
  async (tok, S) => {
          S.e.ls[2].element.style.visibility = ''; S.e.hl(2); cap('都不 generate', 'c0 一路被 propagate：P1·P0·c0');
        },
  async (tok, S) => {
          gone(S.e); S.e = code(['c4 = g3', '   + p3·g2', '   + p3·p2·g1', '   + p3·p2·p1·g0', '   + p3·p2·p1·p0·c0'], -3.6, 6.8, 0.45); S.e.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
          cap('請問 C4 呢？', '用 G3…G0 和 C0 表示');
        },
  async (tok, S) => {
          for (let k = 0; k < 5; k++) { S.e.ls[k].element.style.visibility = ''; S.e.hl(k); await wt(tok, 420); }
          cap('G3 + P3G2 + P3P2G1 + P3P2P1G0', '+ P3P2P1P0C0');
        },
  async (tok, S) => {
          const a = '1011', b = '0110', L = claC(a, b, 0, true), R = rippleC(a, b, 0); S.L = L;
          S.c.top.forEach((l, i) => setL(l, 'g' + i + '=' + L.g[i] + ' p' + i + '=' + (L.p[i])));
          S.c.out.forEach((l, i) => setL(l, 'c' + (i + 1) + '=' + L.c[i + 1])); sm('示意：a = 1011、b = 0110、c0 = 0', 0.6, 4.6);
          ok(L.c.join('') === R.join(''), 0.6, 0.8, '展開式算的 c1..c4 = 一級一級算的 ' + R.slice(1).join('') + ' ✓'); cap('generate，後面幫它 propagate', '依此類推全部做出來');
        },
  async (tok, S) => {
          S.e.hl(-1); hot('sum of products：2 gate delays', 3.2, 5.6); cap('都是 product 再 OR', 'two-level，不用一直 propagate');
        },
  async (tok, S) => {
          cap('一直到 C16 都可以', '理論上還是兩階');
        }
]);
scene('nuB-10a-pipe', "10A：generate＝自己出水，propagate＝閥門打開", CAM, [
  async (tok, S) => {
          S.p = [0, 1, 2].map((i) => bx('', FC.sky, 3.6 - i * 3.0, 3.0, 0, 2.6, 0.5, 0.5)); sm('c0（最原始的水）', 5.9, 3.7); S.n = [0, 1, 2].map((i) => sm('bit ' + i, 3.6 - i * 3.0, 2.3));
          cap('水管的概念', '有水 = 有 carry');
        },
  async (tok, S) => {
          S.tap = cube('g1', FC.blue, [0.5, 0.8, 0.5], 0.6, 3.8, 0, 1.2); tint(S.p[1], '#9fd3f0'); cap('自己 generate', '自己灌水出來');
        },
  async (tok, S) => {
          S.v = cube('p0 開', FC.green, [0.6, 0.6, 0.6], 3.6, 3.0, 0.4); tint(S.p[0], '#9fd3f0'); cap('自己沒水就 propagate', '閥門開著讓 C0 的水過來');
        },
  async (tok, S) => {
          cube('p1 開', FC.green, [0.6, 0.6, 0.6], 0.6, 3.0, 0.4); tint(S.p[2], '#9fd3f0'); cap('C2：自己 generate', '或幫前面的 propagate');
        },
  async (tok, S) => {
          gone(S.p, S.n, S.tap, S.v); fresh(CAM[0], CAM[1]);
          S.c = chain4(3.6); S.c.sl.forEach((m, i) => relbl(m, 'p' + i + ' g' + i)); S.c.top.forEach((l, i) => setL(l, 'a' + i + ' b' + i)); cap('AI、BI 給每一個 bit', '一進來馬上都有');
        },
  async (tok, S) => {
          S.c.sl.forEach((m) => glow(m, HL)); await wt(tok, 500); cap('PI 是 XOR、GI 是 AND', '每個 bit 同時都有 pi、gi');
        },
  async (tok, S) => {
          S.cl = bx('carry lookahead logic（two-level）', FC.lilac, 1.5, 1.4, 0, 9.4, 0.6); S.c.out.forEach((l, i) => setL(l, ''));
          [0, 1, 2, 3].forEach((i) => sm('c' + (i + 1), S.c.sx(i) - 1.4, 2.3)); cap('two-level form', '馬上把 carry 算出來');
        },
  async (tok, S) => {
          good('不需要等前一個 bit：用硬體換時間', 1.5, 0.4); cap('每個 bit 都有 PI、GI', '同時一起算出來');
        }
]);
scene('nuB-10a-fanin', "10A：c16 要 17-input AND、17 項 OR", CAM, [
  async (tok, S) => {
          S.e = code(['c4 = g3 + p3g2 + p3p2g1 + p3p2p1g0 + p3p2p1p0c0'], 0, 6.4); cap('這問題在哪裡？', '看 C4 的式子');
        },
  async (tok, S) => {
          S.e.hl(0); S.and = unit('AND（5 inputs）', FC.blue, -3.0, 4.6, 2.6, 0.6); cap('最後一個 term', 'C0 · P0 · P1 · P2 · P3');
        },
  async (tok, S) => {
          relbl(S.and, 'AND（17 inputs）'); tint(S.and, FC.red); cap('到第 16 個 bit', '那一項要 16 個 P 加 c0');
        },
  async (tok, S) => {
          S.or = unit('OR（17 項）', FC.purple, 3.0, 4.6, 2.4, 0.6); cap('雖然是 2 level', 'AND、OR 的 input 太多');
        },
  async (tok, S) => {
          const terms = (n) => n + 1; const rows = [4, 8, 16, 32].map((n) => 'c' + n + '：' + terms(n) + ' 項，最大 AND ' + (n + 1) + ' 輸入');
          S.t = code(rows, 0, 3.4); const L = claC('1111111111111111', '0000000000000000', 1); ok(L.c[16] === 1, 0, 0.9, '16 個 p 全 1 時 c16 = c0 = 1（要 17-input AND）✓');
          cap('越後面的 carry 項數越多', '16 項一起 OR');
        },
  async (tok, S) => {
          bad('fan-in 太大：做不出來或變很慢', 0, 6.9); cap('一個 gate 沒有這麼多 input', '可能還要更高的 delay');
        },
  async (tok, S) => {
          cap('理論上 OK，實際上太大', '沒辦法直接做 32 bits');
        }
]);
scene('nuB-10a-casc', "10A：8 bits 一塊，塊內 lookahead、塊間 ripple", CAM, [
  async (tok, S) => {
          hot('改進：① cascaded　② multiple-level', 0, 6.6); cap('cascaded 跟 multiple level', '第一個比較簡單');
        },
  async (tok, S) => {
          S.blk = [0, 1, 2, 3].map((i) => bx('CLA 8 bits（bit ' + (i * 8 + 7) + '～' + i * 8 + '）', FC.orange, 4.65 - i * 3.1, 3.2, 0, 2.9, 1.0));
          cap('切成一塊一塊，八個 bit', '塊內用 carry lookahead');
        },
  async (tok, S) => {
          S.cl = [0, 1, 2].map((i) => sm('C' + (i + 1) * 8, 4.65 - i * 3.1 - 1.55, 4.0)); S.cw = [0, 1, 2].map((i) => wire([[4.65 - i * 3.1 - 1.45, 3.2], [4.65 - i * 3.1 - 1.65, 3.2]], '#c08a1f'));
          cap('做完就有 C8', '再給下一個 stage');
        },
  async (tok, S) => {
          S.d = hot('', 0, 1.4); for (let i = 0; i < 4; i++) { glow(S.blk[i], HL); setL(S.d, 'stage ' + (i + 1) + ' / 4'); await wt(tok, 450); glow(S.blk[i], null); }
          cap('有點像 carry ripple add', '但只有四個 stage delay');
        },
  async (tok, S) => {
          ok(32 / 8 === 4, 0, 0.6, '32 bits ÷ 8 = 4 個 stage（ripple 要 32 個）✓'); cap('比 32 個 stage delay 好', 'within 每個 stage 用 carry lookahead');
        },
  async (tok, S) => {
          setL(S.d, ''); glow(S.blk[0], HL); cap('一個單位：有 c in', '很快產生 carry out');
        },
  async (tok, S) => {
          relbl(S.blk[0], '✓ 算完 → C8'); S.cw[0].material.color.set('#d64545'); cap('先做第一個 stage 的八個 bit', '很快算出 carry out');
        },
  async (tok, S) => {
          for (let i = 1; i < 4; i++) { glow(S.blk[i - 1], null); glow(S.blk[i], HL); relbl(S.blk[i], '✓ 算完' + (i < 3 ? ' → C' + (i + 1) * 8 : '')); if (i < 3) S.cw[i].material.color.set('#d64545'); await wt(tok, 500); }
          cap('再做第二、三、四個 stage', 'Cascaded Carry Lookahead Adder');
        }
]);
scene('nuB-10a-ml', "10A：先算 C4、C8、C12，再各塊同時算；delay ∝ log n", WIDE, [
  async (tok, S) => {
          hot('目標：delay ∝ log n', 0, 7.2); cap('還是嫌它太慢', '希望 delay 只有 log n');
        },
  async (tok, S) => {
          S.blk = [0, 1, 2, 3].map((i) => bx('block ' + i, FC.orange, 4.8 - i * 3.2, 2.6, 0, 2.8, 0.9)); cap('multiple level carry lookahead', '把一個 block 當作一個 bit');
        },
  async (tok, S) => {
          S.cl = [0, 1, 2].map((i) => bad('C' + (i + 1) * 8 + ' 太慢', 4.8 - i * 3.2 - 1.6, 3.5)); cap('問題：C8、C16、C24 太慢來', '跟 carry ripple 很像');
        },
  async (tok, S) => {
          gone(S.cl); S.cl = [0, 1, 2].map((i) => good('C' + (i + 1) * 8 + ' 先拿到', 4.8 - i * 3.2 - 1.6, 3.5)); cap('如果先拿到 C8、C16、C24', '四塊就可以同時做');
        },
  async (tok, S) => {
          gone(S.cl); S.e = code(['C8  = G0 + P0·C0', 'C16 = G1 + P1·G0 + P1·P0·C0'], 0, 6.6); S.e.ls[1].element.style.visibility = 'hidden'; S.e.hl(0);
          cap('什麼時候有 C8？', '也是 propagate 跟 generate');
        },
  async (tok, S) => {
          S.e.ls[1].element.style.visibility = ''; S.e.hl(1); cap('C16：G1，或 G0 再 P1', '或 C0 一路 propagate');
        },
  async (tok, S) => {
          S.e.hl(-1); cap('什麼叫 block 的 generate？', '什麼叫 block 的 propagate？');
        },
  async (tok, S) => {
          S.e2 = code(['P = p3·p2·p1·p0（每一位都 propagate）', 'G = g3 + p3g2 + p3p2g1 + p3p2p1g0'], 0, 5.4); S.e2.ls[1].element.style.visibility = 'hidden'; S.e2.hl(0);
          cap('大 P：每個小 bit 都 propagate', '整體就 propagate');
        },
  async (tok, S) => {
          S.e2.ls[1].element.style.visibility = ''; S.e2.hl(1); cap('大 G：其中一個 bit generate', '後面的都 propagate');
        },
  async (tok, S) => {
          S.e2.hl(-1); S.blk.forEach((m) => glow(m, HL)); cap('先產生 C8、C16、C24', '三塊就同時一起做');
        },
  async (tok, S) => {
          S.blk.forEach((m) => glow(m, null));
          const a = '1011011001011101', b = '0100100110110011', L = claC(a, b, 0, true), R = rippleC(a, b, 0);
          const PG = [0, 1, 2, 3].map((k) => { const g = L.g.slice(4 * k, 4 * k + 4), p = L.p.slice(4 * k, 4 * k + 4); return { P: p[0] & p[1] & p[2] & p[3], G: g[3] | (p[3] & g[2]) | (p[3] & p[2] & g[1]) | (p[3] & p[2] & p[1] & g[0]) }; });
          const C = [0]; for (let k = 0; k < 4; k++) C.push(PG[k].G | (PG[k].P & C[k]));
          S.blk.forEach((m, i) => relbl(m, 'P' + i + '=' + PG[i].P + ' G' + i + '=' + PG[i].G));
          S.top = bx('第二層：C4 C8 C12 C16 = ' + C.slice(1).join(' '), FC.lilac, 0, 0.9, 0, 9.0, 0.6);
          sm('示意 a = ' + grp(a) + '，b = ' + grp(b), 0, 4.0);
          ok([1, 2, 3, 4].every((k) => C[k] === R[4 * k]), 0, -0.1, '兩層算的 C4..C16 = 逐位 ripple 的結果 ✓');
          cap('四個 bit 一個 block', '先產生大 P 大 G，再算 block 的 c in');
        },
  async (tok, S) => {
          hot('64 bits → 再加一層（tree）', 0, -1.0); cap('64 個 bit：切成更多 level', '像一個 tree 的 structure');
        },
  async (tok, S) => {
          ok(Math.log2(64) / Math.log2(4) === 3, 0, -1.7, '4 個一組：16 bits 2 層、64 bits 3 層 → log n ✓'); cap('先往上算再往下算', '高度 = log n');
        },
  async (tok, S) => {
          cap('size 很大時', '最多只要 log n 的 delay');
        }
]);
scene('nuB-10a-csel', "10A：上半部 carry = 0、1 兩種都先算，再用 MUX 選", CAM, [
  async (tok, S) => {
          hot('Carry Select Adder', 0, 6.8); cap('另一個有趣的 adder', 'carry select adder');
        },
  async (tok, S) => {
          S.lo = bx('下半 n bits（ripple）', FC.orange, 3.0, 2.6, 0, 3.6, 0.8); S.hi = bx('上半 n bits（ripple）', FC.orange, -1.8, 2.6, 0, 3.6, 0.8);
          S.d = sm('delay ≈ 2n', 0.6, 1.6); cap('2n bits 的 carry ripple adder', 'delay 要 2n');
        },
  async (tok, S) => {
          S.cq = hot('carry = ?', 0.6, 3.5); cap('切一半來看', '進到這邊的 carry 有幾種狀況？');
        },
  async (tok, S) => {
          setL(S.cq, 'carry = 0 或 1'); cap('只有兩種', '要嘛 1，要嘛 0');
        },
  async (tok, S) => {
          S.hi.position.y = 4.4; relbl(S.hi, '上半（假設 c = 0）'); S.hi2 = bx('上半（假設 c = 1）', FC.purple, -1.8, 3.4, 0, 3.6, 0.8); cap('給它 0、給它 1', '兩種狀況都算一次');
        },
  async (tok, S) => {
          const a = '10110110', b = '01011100', lo = addB(a.slice(4), b.slice(4), 0), h0 = addB(a.slice(0, 4), b.slice(0, 4), 0), h1 = addB(a.slice(0, 4), b.slice(0, 4), 1);
          S.v = { lo, h0, h1, a, b }; relbl(S.lo, '下半：' + lo.s + '，carry ' + lo.cout); relbl(S.hi, 'c=0：' + h0.s); relbl(S.hi2, 'c=1：' + h1.s);
          [S.lo, S.hi, S.hi2].forEach((m) => glow(m, HL)); setL(S.d, 'delay ≈ n（同時算）'); sm('示意：a = 1011 0110、b = 0101 1100', 0.6, 0.9);
          cap('三個同時一起算', 'delay 只有 n');
        },
  async (tok, S) => {
          [S.lo, S.hi, S.hi2].forEach((m) => glow(m, null)); const pick = S.v.lo.cout ? S.v.h1 : S.v.h0; glow(S.v.lo.cout ? S.hi2 : S.hi, HL);
          S.m = muxB('MUX', -4.9, 3.9, 1.8, 0.7); sm('select = carry ' + S.v.lo.cout, -4.9, 2.7);
          const sum = pick.s + S.v.lo.s, ref = bin(uval(S.v.a) + uval(S.v.b), 8);
          ok(sum === ref, 0.6, 0.2, '選出 ' + grp(sum) + ' = ' + uval(S.v.a) + ' + ' + uval(S.v.b) + ' ✓'); cap('有 carry 就 select 這個 output', '用一個 2-to-1 MUX');
        },
  async (tok, S) => {
          cap('切越多 duplicate 越多', '速度可以越快');
        }
]);
scene('nuB-10a-simd', "10A：多媒體用的 partition 與 saturating 運算", CAM, [
  async (tok, S) => {
          S.l = ['carry lookahead', 'cascaded CLA', 'multi-level CLA（log n）', 'carry select'].map((t, i) => bx(t, FC.orange, -4.0, 6.0 - i * 0.7, 0, 3.6, 0.55)); cap('Carry Lookahead、Cascaded', 'Multi Level、Carry Select');
        },
  async (tok, S) => {
          cap('multimedia 應用很多', '加法器還有一些變形');
        },
  async (tok, S) => {
          S.px = [0, 1, 2, 3].map((i) => cube('', ['#2b2b2b', '#777', '#bbb', '#eee'][i], [0.7, 0.7, 0.2], 1.4 + i * 0.8, 6.0, 0)); sm('pixel：8 bits', 2.6, 5.3);
          cap('pixel 都是 8 bits', '不需要 32 bits 去算');
        },
  async (tok, S) => {
          const a = ['11110000', '00010010'], b = ['00100000', '00000011'];
          S.r = a.map((x, k) => addB(x, b[k], 0)); S.lane = [0, 1].map((k) => bx('lane ' + k + '：' + grp(a[k]) + ' + ' + grp(b[k]) + ' = ' + grp(S.r[k].s), FC.mint, -3.4 + k * 6.4 - 0.0, 2.8, 0, 5.6, 0.6));
          S.lane[0].position.x = 2.9; S.lane[1].position.x = 2.9; S.lane[1].position.y = 2.0;
          bad('✂ carry 不跨 lane', 2.9, 1.2);
          ok(S.r.every((r, k) => uval(r.s) === ((uval(a[k]) + uval(b[k])) & 255)), 2.9, 0.5, '各 8 bits 各加各的 ✓（lane 0 的進位丟掉）');
          cap('64-bit adder 可以 partition', '8 個 8 bits 或 4 個 16 bits');
        },
  async (tok, S) => {
          hot('SIMD：single instruction, multiple data', 2.9, 3.8); cap('同一個 single instruction', '很多 data 同時做加');
        },
  async (tok, S) => {
          gone(S.l, S.lane); cap('overflow、truncation、rounding', '還有一個 operation');
        },
  async (tok, S) => {
          S.sat = hot('saturation：overflow → 取最大值', -3.4, 4.6); cap('saturation operation', 'overflow 時只取最大值');
        },
  async (tok, S) => {
          cap('pixel 用數字大小', '代表顏色的深淺');
        },
  async (tok, S) => {
          const wrap = (200 + 100) & 255, sat = Math.min(255, 200 + 100);
          S.w = bx('一般加法：' + wrap, '#d9d9d9', -3.4, 3.4, 0, 3.4, 0.6); S.s = bx('saturation：' + sat, '#1b1b1b', -3.4, 2.5, 0, 3.4, 0.6);
          ok(wrap === 44 && sat === 255, -3.4, 1.6, '示意 200 + 100：wrap → 44，saturate → 255 ✓'); cap('再大也沒意義', '就取最黑或最淺的值');
        },
  async (tok, S) => {
          cap('主要在 audio、video', '超過就用最大的 number');
        }
]);

// ════════ cWRbSpzu3DE（第11A講 Computer Arithmetic） ════════
scene('nuB-11a-recap', "11A：ripple、lookahead、cascaded、multi-level、carry select", CAM, [
  async (tok, S) => {
          S.l = [['ripple carry', '硬體少、慢'], ['carry lookahead', '空間換時間'], ['cascaded CLA', '塊間 ripple'], ['multi-level CLA', 'depth log n'], ['carry select', '0、1 都先算']].map(([a, b], i) => {
            const m = bx(a, FC.paper, -2.0, 6.0 - i * 1.0, 0, 3.4, 0.6); m.userData.sub = sm(b, 1.6, 6.0 - i * 1.0); m.userData.sub.center.set(0, 0.5); return m;
          });
          S.l.forEach((m) => { m.visible = false; m.userData.sub.element.style.visibility = 'hidden'; }); const on = (i) => { S.l[i].visible = true; S.l[i].userData.sub.element.style.visibility = ''; glow(S.l[i], HL); };
          S.on = on; on(0); cap('ripple carry adder', 'hardware 最少，但花比較多時間');
        },
  async (tok, S) => {
          glow(S.l[0], null); S.on(1); cap('carry lookahead adder', '用空間換取時間，各算各的');
        },
  async (tok, S) => {
          bad('c31 的 OR 項太大 → 不能直接做', 3.2, 3.0); cap('到 C31 的時候', 'OR 的 term 會很大很大');
        },
  async (tok, S) => {
          glow(S.l[1], null); S.on(2); cap('一塊一塊、塊間 ripple', 'cascaded carry lookahead adder');
        },
  async (tok, S) => {
          glow(S.l[2], null); S.on(3); cap('multi-level carry lookahead', 'depth 是 log n');
        },
  async (tok, S) => {
          glow(S.l[3], null); S.on(4); await wt(tok, 400); glow(S.l[4], null); hot('今天：乘法器', 3.2, 1.6); cap('還有 carry select adder', '今天介紹乘法器');
        }
]);
scene('nuB-11a-inst', "11A：32 × 32 = 64 bits，放在 Hi、Lo", CAM, [
  async (tok, S) => {
          S.mem = bx('Memory', FC.sky, -5.0, 3.4, 0, 1.8, 3.6, 1.0); S.cpu = zone('CPU', 1.0, -0.2, 0, 8.6, 3.0); S.cop = bx('Coprocessor（FP）', FC.lilac, 1.0, 6.4, 0, 3.2, 0.6);
          cap('memory 在外面', 'CPU、還有 co-processor');
        },
  async (tok, S) => {
          S.rf = bx('Registers（32 個）', FC.paper, -1.8, 3.4, 0, 2.6, 2.4); S.alu = bx('ALU', FC.orange, 1.4, 3.4, 0, 1.6, 1.6);
          cap('之前介紹 ALU', '還有 general purpose register file');
        },
  async (tok, S) => {
          S.md = bx('Multiply / Divide', FC.orange, 4.4, 4.0, 0, 2.6, 0.9); glow(S.md, HL); cap('今天介紹 multiply 跟 divide', '');
        },
  async (tok, S) => {
          S.hi = bx('Hi（32）', FC.gold, 3.75, 2.6, 0, 1.3, 0.6); S.lo = bx('Lo（32）', FC.gold, 5.05, 2.6, 0, 1.3, 0.6); cap('兩個特別的 register：low、high', '各 32 bits');
        },
  async (tok, S) => {
          gone(S.mem, S.cpu, S.cop, S.rf, S.alu); S.c = code(['mult $t1, $t2'], -3.0, 6.6); cap('multiply T1、T2', '只給兩個 register');
        },
  async (tok, S) => {
          const a = 100000n, b = 300000n, p = a * b; S.p = p;
          S.ra = sm('$t1 = 100000（示意）', -3.0, 5.6); S.rb = sm('$t2 = 300000（示意）', -3.0, 5.0);
          ok((2n ** 32n - 1n) ** 2n < 2n ** 64n && p >= 2n ** 32n, -3.0, 4.2, '積 = ' + p + ' > 2³² → 要 64 bits 才放得下 ✓');
          cap('32 bit × 32 bit', '相乘出來是 64 bits');
        },
  async (tok, S) => {
          const hi = S.p >> 32n, lo = S.p & 0xffffffffn; relbl(S.hi, 'Hi = 0x' + hi.toString(16).toUpperCase()); relbl(S.lo, 'Lo = 0x' + lo.toString(16).toUpperCase().padStart(8, '0'));
          S.hi.scale.x = 1.6; S.lo.scale.x = 2.0; S.hi.position.x = 2.6; S.lo.position.x = 5.0;
          ok(((hi << 32n) | lo) === S.p, 3.8, 1.6, 'Hi·2³² + Lo = 30000000000 ✓'); cap('結果放在 low 跟 high', 'Hi 放高位、Lo 放低位');
        },
  async (tok, S) => {
          gone(S.c); S.c = code(['mult $t1, $t2   # Hi:Lo = t1 × t2', 'mfhi $t3        # t3 = Hi', 'mflo $t4        # t4 = Lo'], -2.4, 6.6); S.c.hl(0);
          cap('三個 step 的 process', '先把 t1 跟 t2 相乘');
        },
  async (tok, S) => {
          S.c.hl(1); await wt(tok, 600); S.c.hl(2); cap('move from high → T3', 'move from low → T4');
        },
  async (tok, S) => {
          S.c.hl(-1); glow(S.hi, NG); cap('前面的 32 bits 其實是 overflow', '看你要還是不要');
        },
  async (tok, S) => {
          S.c2 = code(['mul  $rd, $rs, $rt  # rd = 低 32 bits'], -2.4, 4.6); glow(S.lo, HL); cap('mul rd, rs, rt', '直接把低位 32 bits 放 destination');
        },
  async (tok, S) => {
          glow(S.hi, null); glow(S.lo, null); cap('MULT rs, rt：結果在 HIGH、LOW', '再用 move from low／high');
        }
]);
scene('nuB-11a-paper', "11A：1000 × 1001（課本例）", CAM, [
  async (tok, S) => {
          S.u = bx('乘法器？', FC.orange, 4.6, 5.6, 0, 2.2, 0.7); cap('一個乘法器要怎麼設計？', '要一個 hardware component');
        },
  async (tok, S) => {
          cap('先複習紙跟筆怎麼乘', '第一個 version 就直接搬過去');
        },
  async (tok, S) => {
          sm('① unsigned　② signed（two\'s complement）', 4.4, 4.8); cap('分 unsigned 跟 signed 兩部分', '先看 unsigned');
        },
  async (tok, S) => {
          S.x0 = -2.2; S.mc = digits('1000', S.x0, 6.0, FC.blue); S.mp = digits('1001', S.x0, 5.3, FC.orange); hd('× ', S.x0 - 0.9, 5.3);
          sm('multiplicand（被乘數）', S.x0 - 3.2, 6.0); sm('multiplier（乘數）', S.x0 - 3.2, 5.3); wire([[S.x0 - 4.2, 4.85], [S.x0 + 2.4, 4.85]]);
          cap('上面 multiplicand、下面 multiplier', '課本例：1000 × 1001');
        },
  async (tok, S) => {
          const mp = '1001', mc = '1000'; S.rows = [];
          for (let k = 0; k < 4; k++) { const bit = mp[3 - k]; glow(S.mp[3 - k], HL); const row = digits(bit === '1' ? mc : '0000', S.x0 - k * 0.62, 4.4 - k * 0.65, bit === '1' ? FC.green : FC.gray); S.rows.push(row); await wt(tok, 420); glow(S.mp[3 - k], null); }
          cap('乘數是 1：抄 multiplicand', '是 0：寫 0');
        },
  async (tok, S) => {
          S.sh = hot('每一列往左 shift 一位', 4.2, 3.4); cap('第二次要往左 shift 一位', '再下一次再往左一位');
        },
  async (tok, S) => {
          wire([[S.x0 - 2.4, 1.85], [S.x0 + 2.4, 1.85]]); const p = (8 * 9).toString(2); S.pr = digits(p, S.x0 + 2.48 - p.length * 0.62 - 0.0, 1.3, FC.purple);
          ok(p === '1001000', 4.2, 1.3, '1000 × 1001 = ' + p + '（8 × 9 = 72）✓'); cap('全部加起來就是乘積', '1001000');
        },
  async (tok, S) => {
          hot('partial product：每個 iteration 的暫時結果', 0, 0.3); cap('第一個 iteration 的結果', '再加下一列 → partial product');
        },
  async (tok, S) => {
          S.f = code(['for 每個 multiplier bit:', '  1 → partial product += multiplicand', '  0 → 不做', '  multiplicand 左移一位'], 4.2, 6.4, 0.42); cap('看這個 bit 是 1 還是 0', '1 就加進去，然後 shift');
        }
]);
scene('nuB-11a-v1', "11A：第一版（64-bit multiplicand、64-bit ALU）跑 0010 × 0011", CAM, [
  async (tok, S) => {
          S.R = buildRegs(V1); S.S = multV1(2, 3); showStep(S.R, V1, S.S[0], false); cap('第一個 version', 'multiplicand 擺在 64-bit 的最右邊');
        },
  async (tok, S) => {
          S.R.Multiplier.row.ms.forEach((m, i) => glow(m, i === 3 ? HL : null)); cap('看 multiplier 最右邊的 bit', '告訴我要不要加進去');
        },
  async (tok, S) => {
          S.alu = bx('64-bit ALU', FC.orange, 4.6, 6.0, 0, 2.0, 0.6); cap('1 的話把 multiplicand 加進 product', '寫回 partial product');
        },
  async (tok, S) => {
          hot('64-bit Multiplicand、64-bit ALU、64-bit Product', 0.6, 6.8); cap('需要 64-bit multiplicand register', '');
        },
  async (tok, S) => {
          cap('multiplier 每處理一個 bit', '就 right shift 出去');
        },
  async (tok, S) => {
          cap('multiplier 幾個 bit', '就做幾個 iteration（32 bits → 32 次）');
        },
  async (tok, S) => {
          S.f = code(['1. Multiplier0 = 1 ? Prod += Mcand', '2. Mcand 左移 1', '3. Mplier 右移 1', '   做 n 次'], -1.2, -0.2, 0.42); cap('0 不做事、1 就加', '然後 Mcand 左移、Mplier 右移');
        },
  async (tok, S) => {
          S.R.Multiplier.row.clearGlow(); cap('看個例子', 'multiplicand 0010、multiplier 0011');
        },
  async (tok, S) => {
          S.f.hl(-1); cap('一開始 product 全部是 0', 'multiplier 0011');
        },
  async (tok, S) => {
          S.f.hl(0); showStep(S.R, V1, S.S[1], true); cap('第 1 輪：bit = 1', 'Product = 0000 0010');
        },
  async (tok, S) => {
          S.f.hl(1); showStep(S.R, V1, S.S[2], true); await wt(tok, 600); S.f.hl(2); showStep(S.R, V1, S.S[3], true); cap('multiplier right shift', 'multiplicand left shift');
        },
  async (tok, S) => {
          S.f.hl(0); showStep(S.R, V1, S.S[4], true); cap('第 2 輪：又是 1', 'Product = 0000 0110');
        },
  async (tok, S) => {
          S.f.hl(1); showStep(S.R, V1, S.S[5], true); await wt(tok, 500); S.f.hl(2); showStep(S.R, V1, S.S[6], true); cap('再 shift', '');
        },
  async (tok, S) => {
          S.f.hl(0); showStep(S.R, V1, S.S[7], true); await wt(tok, 400); S.f.hl(1); showStep(S.R, V1, S.S[8], true); await wt(tok, 400); S.f.hl(2); showStep(S.R, V1, S.S[9], true);
          cap('第 3 輪：0 → 不加', '但還是要 shift');
        },
  async (tok, S) => {
          for (let k = 10; k < 13; k++) { S.f.hl(k - 10); showStep(S.R, V1, S.S[k], true); await wt(tok, 350); } S.f.hl(-1);
          const last = S.S[12]; ok(uval(last.r.Product) === 2 * 3, 0.6, 0.9 - 0.0, 'Product = ' + grp(last.r.Product) + ' = 6 = 2 × 3 ✓');
          cap('第 4 輪做完', 'Product = 0000 0110 = 6');
        }
]);
scene('nuB-11a-waste', "11A：64-bit 加法太多、低位不會再變", CAM, [
  async (tok, S) => {
          S.R = buildRegs(V1); S.S = multV1(2, 3); showStep(S.R, V1, S.S[0], false); cap('第一版：照紙跟筆的算法', '有很大可以改進的地方');
        },
  async (tok, S) => {
          S.alu = bx('64-bit 加法 × 每個 iteration', FC.orange, 4.2, 6.6, 0, 3.6, 0.6); cap('每一個 iteration', '都要做一個 64-bit 的加');
        },
  async (tok, S) => {
          cap('要做多少 iteration？', '0 不要做，1 就要做');
        },
  async (tok, S) => {
          S.h = hot('乘：加 ≈ 5 : 1 ～ 100 : 1', -2.4, 6.6); cap('乘為什麼很花時間？', '每個 iteration 都可能是 64-bit 加');
        },
  async (tok, S) => {
          gone(S.alu); S.win = 0; S.R.Multiplicand.row.ms.forEach((m, i) => glow(m, i >= 4 ? HL : null)); cap('multiplicand 雖然是 64 bits', '有效的只有 32 bits');
        },
  async (tok, S) => {
          for (let k = 1; k <= 3; k++) { const s = S.S[k * 3 - 1]; showStep(S.R, V1, s, false); S.R.Multiplicand.row.ms.forEach((m, i) => glow(m, i >= 4 - k && i < 8 - k ? HL : null)); await wt(tok, 450); }
          cap('一直往左移', '前面跟後面全都是 0');
        },
  async (tok, S) => {
          gone(S.h); bad('一半的 bits 永遠是 0 → 浪費', -2.4, 6.6); cap('一半的 bit 永遠沒用', '用 64 bits 是浪費');
        },
  async (tok, S) => {
          showStep(S.R, V1, S.S[0], false); S.R.Multiplicand.row.clearGlow(); cap('multiplicand 右邊都是 0', 'partial product 的右邊不會變');
        },
  async (tok, S) => {
          let fine = true, prev = S.S[0].r.Product;
          for (let k = 1; k < S.S.length; k++) { const s = S.S[k]; if (s.note.startsWith('1a')) { const it = s.it, low = 8 - (it - 1); if (s.r.Product.slice(low) !== prev.slice(low)) fine = false; showStep(S.R, V1, s, true); S.R.Product.row.ms.forEach((m, i) => glow(m, i >= low ? OKG : (s.r.Product[i] !== prev[i] ? HL : null))); await wt(tok, 600); } prev = s.r.Product; }
          ok(fine, 0.6, 0.6, '第 k 輪加法時，最低 k−1 個 bits 都沒變（綠色）✓'); cap('最右邊是不會變的', '一個 bit、兩個 bit…都不變');
        },
  async (tok, S) => {
          cap('用紙跟筆看也一樣', '只有中間那段 partial product 會變');
        }
]);
scene('nuB-11a-v2idea', "11A：multiplicand 32 bits、ALU 32 bits、multiplier 併進 Product", CAM, [
  async (tok, S) => {
          S.mc = reg('Multiplicand', 4, 2.3, 5.6, { w: 0.66, bits: '0010' }); S.pp = reg('Product', 8, 1.0, 4.2, { w: 0.66 }); cap('instead of shifting multiplicand left', 'shift product to right');
        },
  async (tok, S) => {
          S.box = bx('', '#f3dd9a', 2.3, 4.2, -0.5, 2.7, 0.8, 0.1); cap('multiplicand 不動', '加到 partial product 正確的位置');
        },
  async (tok, S) => {
          cap('multiplier 用一個 bit 就走一個', '空間可以跟 partial product share');
        },
  async (tok, S) => {
          glow(S.mc.ms[0], null); S.mc.ms.forEach((m) => glow(m, '#5a1010')); cap('multiplicand 原來往左 shift', '現在不要動');
        },
  async (tok, S) => {
          S.pp.set('00100000'); S.pp.val('第 1 次：加在固定位置'); await wt(tok, 600); S.pp.set('00010000', true); S.pp.val('右移 1 位'); cap('第二次加在這邊', '相當於 partial product 往右 shift 一位');
        },
  async (tok, S) => {
          S.pp.set('00110000', true); S.pp.val('第 2 次加'); await wt(tok, 500); S.pp.set('00011000', true); S.pp.val('再右移'); cap('第三個 iteration', 'partial product 往右 shift 兩位');
        },
  async (tok, S) => {
          S.mc.ms.forEach((m) => glow(m, OKG)); good('Multiplicand：64 → 32 bits', -4.2, 6.6); cap('multiplicand 只要 32 bits', '因為不動');
        },
  async (tok, S) => {
          S.pp.set('00000000'); S.pp.hi(0, 4); S.pp.val('一開始只用左半'); cap('partial product 一開始 32 bits', '每個 iteration 右 shift 一位');
        },
  async (tok, S) => {
          S.pp.set('00000011'); S.pp.hi(4, 8, '#3a2a00'); S.pp.val('右半放 multiplier 0011'); cap('這邊有 32 bits 是空的', '為什麼不用來放 multiplier？');
        },
  async (tok, S) => {
          S.pp.hi(7, 8); cap('multiplier 用掉一個 bit 就 shift 出去', '空出來剛好給 partial product');
        },
  async (tok, S) => {
          good('Multiplier register 省掉', -4.2, 6.0); good('ALU：64 → 32 bits', -4.2, 5.4); S.alu = bx('32-bit ALU', FC.orange, 2.3, 2.9, 0, 2.7, 0.6); cap('multiplier 跟 product 合在一起', 'ALU 也只要 32 bits');
        },
  async (tok, S) => {
          cap('右邊不會變、左邊都是 0', '32-bit 加法就夠');
        },
  async (tok, S) => {
          bub('Mcand 不動 ⇔ Product 往右移', 0, 0.9); cap('multiplicand 不動', 'partial product 往右移');
        }
]);
scene('nuB-11a-v2ex', "11A：改良版逐步（Product 右半放 multiplier）", CAM, [
  async (tok, S) => {
          S.R = buildRegs('v2'); S.S = multV2(2, 3); S.R.Product.row.set('00000000'); setL(S.R.Product.vt, ''); cap('multiplicand 不動，只要 4 bits', 'Product 一開始是 0');
        },
  async (tok, S) => {
          S.R.Product.row.ms.forEach((m, i) => glow(m, i >= 4 ? OKG : null)); cap('右半空出來不用白不用', '給誰放？');
        },
  async (tok, S) => {
          showStep(S.R, 'v2', S.S[0], true); cap('給 multiplier 擺', 'Product = 0000 0011');
        },
  async (tok, S) => {
          S.R.Product.row.clearGlow(); cap('一開始是 share 的', '用掉一個 bit 就空出位置');
        },
  async (tok, S) => {
          showStep(S.R, 'v2', S.S[1], true); cap('第 1 輪：1 → 加', 'Product = 0010 0011');
        },
  async (tok, S) => {
          showStep(S.R, 'v2', S.S[2], true); cap('right shift 一位', 'Product = 0001 0001');
        },
  async (tok, S) => {
          showStep(S.R, 'v2', S.S[3], true); cap('第 2 輪：又是 1', '加進來 → 0011 0001');
        },
  async (tok, S) => {
          showStep(S.R, 'v2', S.S[4], true); cap('再 shift 一位', 'Product = 0001 1000');
        },
  async (tok, S) => {
          for (let k = 5; k < S.S.length; k++) { showStep(S.R, 'v2', S.S[k], true); await wt(tok, 450); }
          const last = S.S[S.S.length - 1]; ok(last.r.Product === '00000110', 0.6, 0.6, 'Product = ' + grp(last.r.Product) + ' = 6 ✓（跟第一版相同）'); cap('0 → 不加，只 shift', '結果 0000 0110 = 6');
        }
]);
scene('nuB-11a-signed', "11A：signed multiplication 的兩種做法", CAM, [
  async (tok, S) => {
          S.p = reg('Product', 8, 1.0, 5.6, { w: 0.6, bits: '00000110' }); S.p.val('Hi | Lo'); cap('multiplier 跟 partial product combine', 'shift 一起做');
        },
  async (tok, S) => {
          sm('unsigned：multu', 1.0, 4.8); cap('結果放在 high 跟 low', 'unsigned 的 instruction');
        },
  async (tok, S) => {
          hot('signed multiplication？', 0, 6.7); cap('what about signed multiplication？', '');
        },
  async (tok, S) => {
          S.a = reg('−3', 4, -3.4, 3.6, { w: 0.6, bits: bin(-3, 4) }); S.b = reg('2', 4, -3.4, 2.8, { w: 0.6, bits: bin(2, 4) }); sm('示意', -3.4, 4.3);
          await wt(tok, 500); S.a.set(bin(3, 4), true); S.a.val('|−3| = 3'); S.u = reg('3 × 2', 8, 3.2, 3.2, { w: 0.5, bits: bin(6, 8) }); cap('都變正號，用 unsigned 做', '示意：3 × 2 = 6');
        },
  async (tok, S) => {
          S.a.set(bin(-3, 4)); S.a.val('sign = 1'); S.b.val('sign = 0'); S.a.hi(0, 1); S.b.hi(0, 1); cap('看最左邊的 sign bit', '0 正、1 負');
        },
  async (tok, S) => {
          ok([[0, 0, 0], [1, 1, 0], [0, 1, 1], [1, 0, 1]].every(([x, y, z]) => (x ^ y) === z), 0, 1.6, '結果 sign = s1 XOR s2：00→0、11→0、01→1 ✓'); cap('0、0 → 0；1、1 → 0', '0、1 → 1（負）');
        },
  async (tok, S) => {
          const neg = bin(-6, 8); S.u.set(neg, true); S.u.val('= ' + sval(neg));
          ok(sval(neg) === -3 * 2, 3.2, 2.2, '示意 6 → 取補數 ' + grp(neg) + ' = −6 ✓'); cap('是負數就用 two\'s complement', '把它變成負數');
        },
  async (tok, S) => {
          hot('方法二：直接用 two\'s complement 乘', 0, 0.6); cap('第二種方法', '直接用 two\'s complement 去乘');
        },
  async (tok, S) => {
          good('→ Booth\'s algorithm（加速 signed multiplication）', 0, -0.1); cap('可以設計 Booth algorithm', '加速 signed multiplication');
        }
]);
scene('nuB-11a-tc', "11A：(−7) × (−7) = 49", CAM, [
  async (tok, S) => {
          S.rule = code(['規則 1：sign extension', '規則 2：最後要 subtract'], -3.6, 6.6); S.rule.ls.forEach((l, k) => { if (k) l.element.style.visibility = 'hidden'; });
          cap('two\'s complement 的乘法', '先記規則，再看為什麼');
        },
  async (tok, S) => {
          S.rule.hl(0); cap('第一：做 sign extension', '正的補 0、負的補 1');
        },
  async (tok, S) => {
          S.rule.ls[1].element.style.visibility = ''; S.rule.hl(1); cap('第二：subtract at the end', '用例子看');
        },
  async (tok, S) => {
          S.rule.hl(-1); S.mc = reg('Mcand −7', 4, 3.0, 6.4, { w: 0.6, bits: bin(-7, 4) }); S.mp = reg('Mplier −7', 4, 3.0, 5.6, { w: 0.6, bits: bin(-7, 4) });
          cap('−7 × −7', '−7 = 1001');
        },
  async (tok, S) => {
          S.mp.hi(3, 4); cap('看到 bit 1', '把 multiplicand 加進 partial product');
        },
  async (tok, S) => {
          S.pp = []; const row = (bits, y, note) => { const r = reg(note, 8, 1.4, y, { w: 0.55, bits }); return r; };
          S.pp.push(row(bin(-7, 8), 4.4, 'bit0 = 1：+')); S.pp[0].hi(0, 4, '#3a2a00'); S.pp[0].val('= −7（前 4 位補 1）');
          cap('1001 要變成 8 bits', '前面做 sign extension → 1111 1001');
        },
  async (tok, S) => {
          S.mp.hi(1, 3); S.pp.push(reg('bit1 = 0：+', 8, 1.4, 3.7, { w: 0.55, bits: '00000000' })); S.pp.push(reg('bit2 = 0：+', 8, 1.4, 3.0, { w: 0.55, bits: '00000000' })); cap('再來是 0', '乘進去還是 0');
        },
  async (tok, S) => {
          S.mp.hi(0, 1, '#7a1010'); cap('最後這個 bit 是 sign bit', '意義不一樣');
        },
  async (tok, S) => {
          const m3 = bin(-7 * 8, 8); S.pp.push(reg('bit3 = 1：−', 8, 1.4, 2.3, { w: 0.55, bits: m3 })); S.pp[3].vt.element.textContent = '減掉 ' + grp(m3) + '（= −56）';
          cap('sign bit 是 1', '要減掉 multiplicand');
        },
  async (tok, S) => {
          wire([[-1.0, 1.85], [3.8, 1.85]]); const res = bin(-7 - (-56), 8); S.res = reg('結果', 8, 1.4, 1.3, { w: 0.55, bits: res }); S.res.val('= ' + sval(res));
          ok(sval(res) === (-7) * (-7), 1.4, 0.4, '1111 1001 − 1100 1000 = ' + grp(res) + ' = 49 ✓'); cap('做減的動作', '得到 0011 0001 = 49');
        },
  async (tok, S) => {
          S.rule.hl(0); await wt(tok, 500); S.rule.hl(1); cap('規則一：sign extension', '規則二：sign bit 為 1 → 減');
        }
]);
scene('nuB-11a-why', "11A：B = −b₃·2³ + b₂·2² + b₁·2 + b₀", CAM, [
  async (tok, S) => {
          S.e = code(['A × B'], 0, 6.6); cap('相當於 A 乘以 B', '把 multiplier 當作 B');
        },
  async (tok, S) => {
          gone(S.e); S.e = code(['A × B = b₀·A·2⁰ + b₁·A·2¹ + b₂·A·2² + b₃·A·2³'], 0, 6.6); cap('B 的每一個 bit 乘以 A', '再加起來');
        },
  async (tok, S) => {
          S.e2 = code(['unsigned：B = b₃·2³ + b₂·2² + b₁·2¹ + b₀·2⁰'], 0, 5.6); cap('一個 number 可以這樣表示', '2 的 0、1、2、3 次方');
        },
  async (tok, S) => {
          S.e3 = code(['signed：B = −b₃·2³ + b₂·2² + b₁·2¹ + b₀·2⁰'], 0, 4.8); S.e3.hl(0);
          let all = true; for (let v = 0; v < 16; v++) { const b = bin(v, 4).split('').map(Number); all = all && (-b[0] * 8 + b[1] * 4 + b[2] * 2 + b[3]) === sval(bin(v, 4)); }
          ok(all, 0, 0.6, '16 種 4-bit pattern：公式值 = two\'s complement 值 ✓'); cap('sign bit 的意思', '它代表 −2³');
        },
  async (tok, S) => {
          S.b = reg('1001', 4, 0, 3.4, { w: 0.8, bits: '1001' }); S.b.val('= −8 + 0 + 0 + 1 = ' + sval('1001')); S.b.hi(0, 1, '#7a1010'); cap('sign bit 是 1', '就要把 2³ 減掉');
        },
  async (tok, S) => {
          const A = -7, B = '1001'; const b = B.split('').map(Number); const val = A * (-b[0] * 8) + A * (b[1] * 4) + A * (b[2] * 2) + A * b[3];
          S.e3.hl(-1); ok(val === 49, 0, 2.2, '(−7)×(−8) + (−7)×1 = 56 − 7 = 49 ✓'); cap('A 乘以每一項', 'sign bit 那一項就是減');
        },
  async (tok, S) => {
          cap('complement 再加 1', '代數意義就是這一項是負的');
        }
]);
scene('nuB-11a-booth', "11A：0011 1110 = 0100 0000 − 0000 0010（示意）", CAM, [
  async (tok, S) => {
          hot('Booth multiplication', 0, 7.1); cap('Booth multiplication', '先看它的意思');
        },
  async (tok, S) => {
          S.m = reg('乘數（示意）', 8, 0.8, 5.0, { w: 0.7, bits: '00111110' }); S.m.hi(2, 7); S.cnt = hot('要加 5 次', 5.0, 4.2); cap('碰到 1 就加進去', '五個 1 → 五個 iteration 的加');
        },
  async (tok, S) => {
          S.p1 = reg('', 8, 0.8, 3.6, { w: 0.7, bits: '01000000' }); S.p1.val('= 64'); S.p2 = reg('−', 8, 0.8, 2.8, { w: 0.7, bits: '00000010' }); S.p2.val('= 2');
          ok(uval('01000000') - uval('00000010') === uval('00111110'), 0.8, 1.9, '0100 0000 − 0000 0010 = 0011 1110（64 − 2 = 62）✓'); cap('這個數字可以表示成', '兩個數相減');
        },
  async (tok, S) => {
          S.e = code(['A × 0011 1110 = A × 0100 0000 − A × 0000 0010'], 0.6, 6.35); cap('A 乘以這個數字', '可以寫成這樣');
        },
  async (tok, S) => {
          S.p1.hi(1, 2); S.p2.hi(6, 7, '#7a1010'); setL(S.cnt, '只要 2 次（1 減 1 加）'); const A = 3; ok(A * 62 === A * 64 - A * 2, 5.0, 3.0, '示意 A = 3：186 = 192 − 6 ✓'); cap('原來五個 iteration', '現在只要兩個：一個減、一個加');
        },
  async (tok, S) => {
          cap('加跟減是一樣的', 'ALU 的減就是 complement 再加');
        },
  async (tok, S) => {
          S.m.hi(2, 7, OKG); cap('有連續的 1 的時候', '用頭尾兩個動作取代');
        },
  async (tok, S) => {
          S.m.clearGlow(); S.m.hi(6, 7, '#7a1010'); S.act = hot('第一個 1 → 減', S.m.xs[6], 5.7); cap('看到第一個 1', '要做減');
        },
  async (tok, S) => {
          for (let i = 5; i >= 2; i--) { S.m.ms.forEach((m, k) => glow(m, k === i ? HL : null)); setL(S.act, '中間的 1 → 不做'); S.act.position.x = S.m.xs[i]; await wt(tok, 380); }
          cap('中間的 1', '不做任何動作');
        },
  async (tok, S) => {
          S.m.ms.forEach((m, k) => glow(m, k === 1 ? OKG : null)); setL(S.act, '1 結束 → 加'); S.act.position.x = S.m.xs[1]; cap('一串 1 結束了', '做加（加回 multiplicand）');
        },
  async (tok, S) => {
          bub('一邊掃乘數、一邊決定加／減／不做', 0.6, 0.6); cap('從這邊就可以判斷要做什麼', '這就是 Booth multiply 的精神');
        }
]);

// ════════ GZ8L2afnZFU（第12A講 Computer Arithmetic） ════════
scene('nuB-12a-rule', "12A：10 減、01 加、00／11 不動", CAM, [
  async (tok, S) => {
          hot('Booth multiply：加快 signed 乘法', 0, 7.0); cap('先 unsigned、再 signed', '加快速度的方法：Booth multiply');
        },
  async (tok, S) => {
          S.m = reg('乘數（示意）', 8, 0.8, 5.6, { w: 0.7, bits: '00111110' }); S.p1 = reg('', 8, 0.8, 4.6, { w: 0.7, bits: '01000000' }); S.p2 = reg('−', 8, 0.8, 3.8, { w: 0.7, bits: '00000010' });
          ok(64 - 2 === 62, 0.8, 3.0, '64 − 2 = 62 = 0011 1110 ✓'); cap('五個 1 可以改寫成這樣', 'a 是 multiplicand');
        },
  async (tok, S) => {
          S.m.hi(2, 7); cap('0 不用做任何動作', '1 要做 add：五次');
        },
  async (tok, S) => {
          S.m.clearGlow(); S.p1.hi(1, 2, OKG); S.p2.hi(6, 7, '#7a1010'); cap('rewrite 之後意思一樣', '只要做兩件事情');
        },
  async (tok, S) => {
          cap('這個位置加、這個位置減', '五個加變兩個');
        },
  async (tok, S) => {
          gone(S.p1, S.p2); S.m.hi(6, 7, '#7a1010'); S.a = hot('第一個 1：減', S.m.xs[6], 6.4); cap('第一次看到 1', '做一個減');
        },
  async (tok, S) => {
          S.m.clearGlow(); S.m.hi(1, 2, OKG); S.b = hot('1 看完了：加', S.m.xs[1], 6.4); cap('之後的 1 都不理', '最後一個 1 看完才做加');
        },
  async (tok, S) => {
          gone(S.a, S.b); S.m.clearGlow(); cap('怎麼知道是第一個 1', '還是最後一個 1？');
        },
  async (tok, S) => {
          S.m.hi(6, 8); S.pr = sm('（current, 右邊）', S.m.xs[7] - 0.35, 4.9); cap('要看兩個 bit', 'current bit 跟右邊的 bit');
        },
  async (tok, S) => {
          S.t = code(['current 右邊   動作', '   1     0    減（開始）', '   1     1    不動（中間）', '   0     1    加（結束）', '   0     0    不動'], 0.6, 2.8, 0.45); S.t.ls.slice(2).forEach((l) => { l.element.style.visibility = 'hidden'; }); S.t.hl(1);
          cap('現在是 1、右邊是 0', 'beginning of run → 減');
        },
  async (tok, S) => {
          S.t.ls[3].element.style.visibility = ''; S.t.hl(3); S.m.clearGlow(); S.m.hi(1, 3); cap('右邊是 1、我是 0', '1 已經結束 → 做加');
        },
  async (tok, S) => {
          S.t.ls.forEach((l) => { l.element.style.visibility = ''; }); for (let k = 1; k <= 4; k++) { S.t.hl(k); await wt(tok, 380); } S.t.hl(-1);
          cap('10 減、11 不動', '01 加、00 不動');
        },
  async (tok, S) => {
          cap('記錄 current bit', '以及 bit to the right');
        },
  async (tok, S) => {
          S.r = reg('右移前', 8, 0.8, 0.4 - 0.0, { w: 0.6, bits: '11100111' }); await wt(tok, 300); S.r2 = reg('右移後', 8, 0.8, -0.4, { w: 0.6, bits: '1' + '11100111'.slice(0, 7) }); S.r2.hi(0, 1);
          ok(sval(S.r2.bits) === Math.floor(sval('11100111') / 2), 4.6, -1.1, '補 sign bit：−25 → −13 ✓'); cap('shift 的時候', '不要忘記 sign extension');
        },
  async (tok, S) => {
          cap('只是加快速度', '其他都沒有改變');
        }
]);
scene('nuB-12a-b27', "12A：Booth 0010 × 0111 逐步", CAM, [
  async (tok, S) => {
          S.V = bview(2, 7); S.V.P.set('000000000'); S.V.P.val(''); cap('例子：2 × 7', '先回想乘法器怎麼設計');
        },
  async (tok, S) => {
          cap('multiplicand 32 bits', 'product 64 bits');
        },
  async (tok, S) => {
          S.V.M.hi(0, 4); cap('0010 是被乘數', '不要動');
        },
  async (tok, S) => {
          S.V.M.clearGlow(); S.V.P.set('000001110'); S.V.P.hi(4, 8); cap('0111 是乘數', '放在 product 最右邊');
        },
  async (tok, S) => {
          S.V.P.clearGlow(); cap('partial product 往右 shift', '用完的 bit shift 出去');
        },
  async (tok, S) => {
          S.V.show(0, true); glow(S.V.P.ms[8], HL); cap('多一個 register 放一個 bit', 'initial 時是 0');
        },
  async (tok, S) => {
          glow(S.V.P.ms[7], HL); S.act = hot('10：beginning of run', 4.8, 6.3); cap('現在的 bit 是 1，右邊是 0', 'beginning of the run');
        },
  async (tok, S) => {
          setL(S.act, '10 → 減 multiplicand'); cap('所以要做減', '');
        },
  async (tok, S) => {
          S.V.show(1); S.V.P.hi(0, 4); S.nm = sm('−0010 = 1110', -4.6, 5.2); cap('減 = 加 two\'s complement', '左半 = 1110');
        },
  async (tok, S) => {
          S.V.show(2); S.V.P.hi(0, 1); setL(S.act, 'shift（補 sign bit）'); cap('做 shift', '不要忘記 sign extension');
        },
  async (tok, S) => {
          S.V.show(3); setL(S.act, '11 → no operation'); cap('現在是 1、previous 是 1', 'no operation');
        },
  async (tok, S) => {
          S.V.show(4); setL(S.act, 'shift'); cap('不用做任何動作', '但還是要 shift');
        },
  async (tok, S) => {
          S.V.show(5); setL(S.act, '11 → no operation'); await wt(tok, 600); S.V.show(6); setL(S.act, 'shift'); cap('current 1、前一個 1', '不做事，right shift');
        },
  async (tok, S) => {
          glow(S.V.P.ms[7], HL); glow(S.V.P.ms[8], HL); setL(S.act, '01：end of string'); cap('現在 0、前一個 1', 'end of string');
        },
  async (tok, S) => {
          S.V.show(7); S.V.P.hi(0, 4); setL(S.act, '01 → 加 0010'); cap('應該做加', '加 0010 進去');
        },
  async (tok, S) => {
          const s = S.V.show(8); setL(S.act, '做完');
          ok(sval(s.r.A + s.r.Q) === 2 * 7, 0.4, 0.9, 'Product = ' + grp(s.r.A + s.r.Q) + ' = 14 = 2 × 7 ✓'); cap('再 shift 一位', '做完：0000 1110 = 14');
        }
]);
scene('nuB-12a-b23', "12A：Booth 0010 × 1101 逐步", CAM, [
  async (tok, S) => {
          S.V = bview(2, -3); S.V.P.set('000000000'); S.V.P.val(''); cap('2 × (−3)', '2 還是在前面');
        },
  async (tok, S) => {
          S.V.show(0, true); S.V.P.hi(4, 8); cap('−3 = 1101', '做法完全一模一樣');
        },
  async (tok, S) => {
          S.V.P.clearGlow(); glow(S.V.P.ms[7], HL); glow(S.V.P.ms[8], HL); S.act = hot('10 → 減', 4.8, 6.3); cap('這是 10', '要做一個減法');
        },
  async (tok, S) => {
          S.V.show(1); await wt(tok, 700); S.V.show(2); setL(S.act, 'shift'); cap('取 two\'s complement 加進去', '再做 shift');
        },
  async (tok, S) => {
          glow(S.V.P.ms[7], HL); glow(S.V.P.ms[8], HL); setL(S.act, '01'); cap('變成 01 了', '');
        },
  async (tok, S) => {
          setL(S.act, '01 → 加'); cap('現在 0、previous 1', '要做加');
        },
  async (tok, S) => {
          S.V.show(3); await wt(tok, 700); S.V.show(4); setL(S.act, 'shift'); cap('加進去再 shift', '交錯的 1 反而動作多');
        },
  async (tok, S) => {
          glow(S.V.P.ms[7], HL); glow(S.V.P.ms[8], HL); setL(S.act, '10：beginning of run'); cap('又碰到 beginning of the run', '');
        },
  async (tok, S) => {
          S.V.show(5); setL(S.act, '10 → 減'); await wt(tok, 700); S.V.show(6); setL(S.act, 'shift'); cap('減的動作：加 two\'s complement', '再 shift');
        },
  async (tok, S) => {
          S.V.show(7); setL(S.act, '11 → no operation'); await wt(tok, 600); S.V.show(8); setL(S.act, '做完'); cap('11：不用做任何動作', '再 shift 就結束');
        },
  async (tok, S) => {
          const s = S.V.S[8]; ok(sval(s.r.A + s.r.Q) === -6, 0.4, 0.9, 'Product = ' + grp(s.r.A + s.r.Q) + ' = −6 = 2 × (−3) ✓'); cap('Booth multiply 的例子', '1111 1010 = −6');
        }
]);
scene('nuB-12a-comb', "12A：用 AND 同時產生所有 partial product，再一起加", CAM, [
  async (tok, S) => {
          hot('sequential multiplier', 0, 7.0); cap('Booth 和前面的方法', '都叫 sequential multiplier');
        },
  async (tok, S) => {
          S.l = bx('sequential：存起來，下一個 cycle 再做', FC.sky, -2.8, 5.8, 0, 5.2, 0.6); S.r = bx('combinational：一個 cycle 做完', FC.mint, 3.2, 5.8, 0, 4.2, 0.6);
          cap('sequential vs combinational', '存起來 vs 一次做完');
        },
  async (tok, S) => {
          S.pp = reg('partial product', 8, 0.6, 3.8, { w: 0.6 }); for (let k = 1; k <= 3; k++) { S.pp.set(bin([0, 2, 6, 6][k], 8), true); S.pp.val('cycle ' + k); await wt(tok, 420); }
          cap('一個 bit 做完存回 partial product', '再下一個 cycle');
        },
  async (tok, S) => {
          cap('很多個 bit 就要很多個 cycle', '這叫 sequential multiplier');
        },
  async (tok, S) => {
          gone(S.pp); cap('可不可以同一時間做出來？', '用空間換取時間');
        },
  async (tok, S) => {
          S.mc = reg('Mcand', 4, 1.4, 4.6, { w: 0.6, bits: '1000' }); S.mp = reg('Mplier', 4, 1.4, 3.9, { w: 0.6, bits: '1001' }); sm('課本例：1000 × 1001', 4.8, 4.2);
          cap('1000、0000、0000、1000', '一開始可不可以知道？');
        },
  async (tok, S) => {
          const mp = '1001', mc = '1000'; S.P = [];
          for (let k = 0; k < 4; k++) { const b = mp[3 - k]; const row = mc.split('').map((c) => String(+c & +b)).join(''); S.P.push(reg('AND × b' + k, 4, 1.4 - k * 0.6, 3.0 - k * 0.6, { w: 0.6, bits: row })); }
          cap('就是做一個 AND 的動作', '四個 AND 同時產生');
        },
  async (tok, S) => {
          const sum = [0, 1, 2, 3].reduce((a, k) => a + uval(S.P[k].bits) * 2 ** k, 0);
          S.res = reg('一起加', 8, 0.2, 0.2, { w: 0.6, bits: bin(sum, 8) }); ok(sum === 8 * 9, 3.6, -0.6, '1000 + 0 + 0 + 1000000 = ' + bin(sum, 7) + ' = 72 ✓');
          cap('同時加起來就好', 'combinational multiplier');
        },
  async (tok, S) => {
          gone(S.mc, S.mp, S.P, S.res); S.add1 = bx('一個加法器（每個 cycle 重複用）', FC.orange, -2.8, 3.8, 0, 4.6, 0.7); cap('sequential：只有一個加法器', '每個 iteration 都用同一個');
        },
  async (tok, S) => {
          cap('同時加就不能只有一個加法器', 'combinational 不能 share');
        },
  async (tok, S) => {
          const A = [bx('PP0', FC.green, 1.6, 4.6, 0, 1.0, 0.5), bx('PP1', FC.green, 2.8, 4.6, 0, 1.0, 0.5), bx('PP2', FC.green, 4.0, 4.6, 0, 1.0, 0.5), bx('PP3', FC.green, 5.2, 4.6, 0, 1.0, 0.5)];
          S.ad = [bx('+', FC.orange, 2.2, 3.5, 0, 1.2, 0.6), bx('+', FC.orange, 4.6, 3.5, 0, 1.2, 0.6), bx('+', FC.orange, 3.4, 2.3, 0, 1.2, 0.6)];
          ok(4 - 1 === 3, 3.4, 1.4, '4 個 partial product → 3 個加法器 ✓'); cap('兩個兩個先加', '至少要三個加法器');
        },
  async (tok, S) => {
          S.ad.forEach((m) => glow(m, HL)); cap('一層一層加起來', '整個在一個 clock cycle 內');
        },
  async (tok, S) => {
          bad('critical path 很長 → 之後可加 pipeline', 3.4, 0.6); cap('critical path 很長', '可以在中間加 pipeline');
        }
]);
scene('nuB-12a-seqadd', "12A：只用一個 full adder，一個 cycle 一個 bit", CAM, [
  async (tok, S) => {
          hot('sequential adder vs combinational adder', 0, 7.0); cap('加也是一樣', 'sequential adder 跟 combinational adder');
        },
  async (tok, S) => {
          S.fa = [];
          for (let i = 0; i < 16; i++) S.fa.push(cube('', FC.orange, [0.6, 0.5, 0.5], 5.6 - i * 0.75, 5.6, 0));
          sm('16 個 full adder 同時做', 0, 4.9); cap('16 個 bit', '16 個 full adder 一起做');
        },
  async (tok, S) => {
          gone(S.fa); S.one = bx('1 個 full adder', FC.orange, -3.8, 2.8, 0, 2.2, 0.8); S.ff = bx('carry FF = 0', FC.lilac, -3.8, 1.6, 0, 2.2, 0.5);
          const a = '0101', b = '0011'; S.A = reg('a', 4, 2.6, 3.6, { w: 0.7, bits: a }); S.B = reg('b', 4, 2.6, 2.8, { w: 0.7, bits: b }); S.Sm = reg('sum', 4, 2.6, 1.8, { w: 0.7 });
          let c = 0; const sb = ['0', '0', '0', '0'];
          for (let k = 0; k < 4; k++) { const i = 3 - k, x = +a[i], y = +b[i]; sb[i] = String(x ^ y ^ c); c = (x & y) | (x & c) | (y & c); S.Sm.set(sb.join(''), true); relbl(S.ff, 'carry FF = ' + c); relbl(S.one, 'cycle ' + (k + 1)); S.A.hi(i, i + 1); await wt(tok, 450); }
          S.A.clearGlow(); ok(sb.join('') === bin(5 + 3, 4), 2.6, 0.8, '4 個 cycle 後 sum = ' + sb.join('') + ' = 8 ✓'); cap('只要一個 full adder', '一個 cycle 只做一個 bit');
        },
  async (tok, S) => {
          cap('做 16 個 iteration', '這叫 sequential add');
        },
  async (tok, S) => {
          bub('乘法：一位一位存回（sequential）／全部一起加（combinational）', 0, 0.2); cap('乘法也一樣', '一個 bit 做完再做下一個');
        }
]);
scene('nuB-12a-csa', "12A：三個數進、兩個數出，只有一個 full adder 的 delay", WIDE, [
  async (tok, S) => {
          S.lv = [0, 1, 2].map((k) => bx('加法器', FC.orange, 0, 5.8 - k * 1.1, 0, 3.0 - k * 0.6, 0.6)); cap('straightforward 的結構', '加的部分可以再改進');
        },
  async (tok, S) => {
          S.d = sm('每一層：ripple 32 bits', 3.8, 5.8); cap('看這個高度就是 delay', 'ripple add 要 32 個 bit 慢慢傳');
        },
  async (tok, S) => {
          setL(S.d, '用 CLA：快，但面積很大'); cap('用 carry lookahead 比較快', '但這麼多加法器，面積太大');
        },
  async (tok, S) => {
          setL(S.d, '目標：每層只有 1 個 full adder 的 delay'); cap('我要改進成', '只有一個 full adder 的 delay');
        },
  async (tok, S) => {
          gone(S.lv, S.d); hot('Carry Save Adder', 0, 7.2); cap('carry save adder', '只有一個 full adder 的 delay');
        },
  async (tok, S) => {
          cap('carry 沒有加進去', '沒有加到下一階');
        },
  async (tok, S) => {
          S.fa = unit('FA', FC.orange, -4.6, 4.2, 1.2, 1.0); sm('x y z', -4.6, 5.0); sm('sum  carry', -4.6, 3.4); cap('三個 input：XYZ', '兩個 output：sum、carry');
        },
  async (tok, S) => {
          cap('sum 在同一個位置', 'carry 往前一個位置（進位）');
        },
  async (tok, S) => {
          const X = '0111', Y = '1110', Z = '1010'; S.X = X; S.Y = Y; S.Z = Z;
          S.rx = reg('X', 4, 1.8, 5.6, { w: 0.7, bits: X }); S.ry = reg('Y', 4, 1.8, 4.9, { w: 0.7, bits: Y }); S.rz = reg('Z', 4, 1.8, 4.2, { w: 0.7, bits: Z }); sm('示意', 4.4, 6.2);
          S.rx.hi(0, 1); S.ry.hi(0, 1); S.rz.hi(0, 1); cap('0、1、1 加起來是 10', 'sum 0，carry 放前一位');
        },
  async (tok, S) => {
          const n = 4, s = [], c = [];
          for (let i = 0; i < n; i++) { const t = +S.X[i] + +S.Y[i] + +S.Z[i]; s.push(t & 1); c.push(t >> 1); }
          [S.rx, S.ry, S.rz].forEach((r) => r.clearGlow());
          S.rs = reg('S', 4, 1.8, 3.2, { w: 0.7, bits: s.join('') }); S.rc = reg('C', 5, 1.45, 2.5, { w: 0.7, bits: c.join('') + '0' });
          S.rc.hi(4, 5, '#3a3a3a'); sm('C 往左錯一位（末位補 0）', 5.2, 2.5); S.sc = { s: s.join(''), c: c.join('') + '0' };
          cap('不做 propagation', '大家各加各的：三個 input → 兩個 output');
        },
  async (tok, S) => {
          const tot = uval(S.X) + uval(S.Y) + uval(S.Z); ok(uval(S.sc.s) + uval(S.sc.c) === tot, 1.8, 1.4, 'S + C = ' + uval(S.sc.s) + ' + ' + uval(S.sc.c) + ' = ' + tot + ' = 7 + 14 + 10 ✓');
          cap('carry shift 一個位置', '還是一個 number');
        },
  async (tok, S) => {
          cap('三個 input 變兩個', '再三個變兩個');
        },
  async (tok, S) => {
          good('每層 delay = 1 個 full adder', -4.6, 1.6); cap('沒有 carry 的 propagation', 'delay 就是一個 full adder');
        },
  async (tok, S) => {
          gone(S.rx, S.ry, S.rz, S.rs, S.rc); let k = 8; const seq = [k]; while (k > 2) { k = 2 * Math.floor(k / 3) + (k % 3); seq.push(k); }
          S.tree = seq.map((v, i) => bx(v + ' 個數', i === seq.length - 1 ? FC.purple : FC.mint, 2.4, 6.0 - i * 0.9, 0, 1.0 + v * 0.45, 0.55));
          ok(seq.join('→') === '8→6→4→3→2', 5.6, 2.6, '8→6→4→3→2：4 層 CSA ✓'); cap('三個變兩個，一直 group', '整個像 tree 一樣');
        },
  async (tok, S) => {
          cap('每一層的 delay？', '一個 full adder delay');
        },
  async (tok, S) => {
          hot('Wallace tree multiplier', 2.4, 7.1); cap('Wallace tree multiply', '利用 carry save add');
        },
  async (tok, S) => {
          S.cpa = bx('最後一層：regular adder（要 propagation）', FC.orange, 2.4, 6.0 - S.tree.length * 0.9, 0, 6.0, 0.55); cap('最後一個 stage', '要一個 regular 的 adder');
        },
  async (tok, S) => {
          cap('真的乘法器就用這個加速', 'hardware 換時間');
        }
]);
scene('nuB-12a-divi', "12A：div t1, t2；MIPS 不檢查 overflow 與除以 0", CAM, [
  async (tok, S) => {
          hot('除法 division', 0, 7.0); cap('乘法介紹完畢', '接著介紹除法');
        },
  async (tok, S) => {
          bx('乘：shift and add', FC.sky, -3.0, 5.8, 0, 3.4, 0.6); bx('除：shift and subtract', FC.pink, 3.0, 5.8, 0, 3.6, 0.6); cap('乘：shift and add', '除：shift and subtract');
        },
  async (tok, S) => {
          S.u = bx('Multiply / Divide（同一個 component）', FC.orange, 0, 4.4, 0, 5.0, 0.7); cap('同一個 component', '也用 low 跟 high');
        },
  async (tok, S) => {
          S.c = code(['div  $t1, $t2   # t1 = 7、t2 = 2（示意）'], 0, 3.2); cap('divide t1、t2', '結果放在 low 跟 high');
        },
  async (tok, S) => {
          const q = Math.floor(7 / 2), r = 7 % 2; S.hi = bx('Hi = ' + r + '（remainder）', FC.gold, -2.0, 2.0, 0, 3.4, 0.6); S.lo = bx('Lo = ' + q + '（quotient）', FC.gold, 2.0, 2.0, 0, 3.4, 0.6);
          ok(q * 2 + r === 7, 0, 1.1, '3 × 2 + 1 = 7 ✓'); cap('low：quotient（商）', 'high：remainder（餘數）');
        },
  async (tok, S) => {
          gone(S.c); S.c = code(['div  $t1, $t2', 'mflo $t3   # 商', 'mfhi $t4   # 餘數'], 0, 3.6); cap('move from low / high', 'copy 到 T3、T4');
        },
  async (tok, S) => {
          sm('unsigned：divu（做法一樣）', 0, 0.3); cap('unsigned division', '指令不一樣，做法一樣');
        },
  async (tok, S) => {
          bad('硬體不檢查：overflow、divide by 0', 0, -0.5); cap('MIPS 不幫你 check', 'overflow 跟 divide by 0');
        },
  async (tok, S) => {
          note('software 自己 check（hardware vs software 的 trade-off）', 0, -1.2); cap('software 要做 check', '這是一個 trade-off');
        }
]);
scene('nuB-12a-paperdiv', "12A：0111 ÷ 10（示意）", CAM, [
  async (tok, S) => {
          S.dd = digits('0111', -0.4, 5.2, FC.blue, 0.8); hd('dividend（被除數）', -4.6, 5.2); S.dv = digits('10', -2.6, 4.4, FC.orange, 0.8); hd('divisor', -4.6, 4.4); // on its own row: shifting right slides it under the dividend, not onto it
          S.q = sm('quotient：', -4.6, 6.2); S.qd = []; cap('dividend、divisor、quotient', '示意：0111 ÷ 10');
        },
  async (tok, S) => {
          S.cur = 0; S.rem = 0; S.pos = 0; cap('divisor 放在下面', '減一下看夠不夠減');
        },
  async (tok, S) => {
          const dd = '0111'; let r = 0; S.qs = '';
          for (let i = 0; i < 3; i++) { r = r * 2 + +dd[i]; const okk = r >= 2; if (okk) r -= 2; S.qs += okk ? '1' : '0'; S.qd.push(cube(okk ? '1' : '0', okk ? FC.green : FC.gray, [0.6, 0.5, 0.6], -0.4 + i * 0.8, 6.2, 0)); S.dd.forEach((m, k) => glow(m, k <= i ? HL : null)); await wt(tok, 450); }
          S.r = r; cap('夠減就寫 1', '不夠減就寫 0');
        },
  async (tok, S) => {
          S.dv.forEach((m) => { m.position.x += 2.4; }); cap('把 0 放下來', '相當於 divisor 往右移一位');
        },
  async (tok, S) => {
          let r = S.r * 2 + 1; const okk = r >= 2; if (okk) r -= 2; S.qs += okk ? '1' : '0'; S.qd.push(cube(okk ? '1' : '0', FC.green, [0.6, 0.5, 0.6], -0.4 + 3 * 0.8, 6.2, 0)); S.dd.forEach((m) => glow(m, HL));
          ok(uval(S.qs) === 3 && r === 1, 0.6, 3.2, '商 ' + S.qs + ' = 3、餘數 ' + r + '（7 = 3 × 2 + 1）✓');
          cap('夠減就填 1', '不夠減就 restore、填 0');
        },
  async (tok, S) => {
          S.f = code(['每個 iteration：', '  remainder −= divisor', '  ≥ 0 → 商 1；< 0 → 加回去（restore），商 0', '  divisor 右移一位'], 0, 1.8, 0.42); cap('減出來正數：quotient 1', '負數：恢復原狀、quotient 0');
        }
]);
scene('nuB-12a-div1', "12A：Divisor 放左半往右移、Remainder 64 bits（7 ÷ 2 示意）", CAM, [
  async (tok, S) => {
          S.R = buildRegs('div'); S.S = divV1(7, 2); showStep(S.R, 'div', S.S[0], false); cap('跟乘法器一樣', 'divisor 一開始擺在最左邊');
        },
  async (tok, S) => {
          S.R.Divisor.row.ms.forEach((m, i) => glow(m, i < 4 ? HL : null)); cap('divisor 擺最左邊', '每輪 shift right');
        },
  async (tok, S) => {
          S.R.Divisor.row.clearGlow(); showStep(S.R, 'div', S.S[1], true); cap('跟 remainder 做減', '第 1 輪：減出來是負的');
        },
  async (tok, S) => {
          showStep(S.R, 'div', S.S[2], true); cap('負的就 restore 回去', 'quotient 填 0');
        },
  async (tok, S) => {
          showStep(S.R, 'div', S.S[3], true); cap('quotient 往左 shift', 'divisor 往右 shift');
        },
  async (tok, S) => {
          cap('第一次減這個位置', '第二次往右一位、第三次再往右');
        },
  async (tok, S) => {
          for (let k = 4; k < S.S.length; k++) { showStep(S.R, 'div', S.S[k], true); await wt(tok, 160); }
          const L = S.S[S.S.length - 1]; ok(uval(L.r.Quotient) === 3 && uval(L.r.Remainder) === 1, 0.6, -0.6, '5 輪後：Q = ' + L.r.Quotient + '、R = ' + grp(L.r.Remainder) + '（7 = 3 × 2 + 1）✓');
          cap('跑完：Q = 0011、R = 0001', '跟第一版乘法器很像');
        }
]);
scene('nuB-12a-div2', "12A：Divisor 32 bits、ALU 32 bits、Remainder／Quotient 共用", CAM, [
  async (tok, S) => {
          S.d = reg('Divisor', 8, 1.0, 5.6, { w: 0.6, bits: '00100000' }); for (let k = 1; k <= 3; k++) { S.d.set(bin(2 << (4 - k), 8), true); await wt(tok, 300); }
          cap('divisor 從最左邊往右移', '中間只有 32 bits 用到');
        },
  async (tok, S) => {
          bad('一半都是 0 → 浪費', 1.0, 6.6); cap('前跟後都是 0', '減也只減中間那塊');
        },
  async (tok, S) => {
          gone(S.d); S.dv = reg('Divisor', 4, -0.2, 5.6, { w: 0.6, bits: '0010' }); S.dv.val('不動'); S.rm = reg('Remainder', 8, 1.0, 4.4, { w: 0.6, bits: '00000111' }); S.rm.val('往左移');
          cap('divisor 不要動', 'remainder 往左動');
        },
  async (tok, S) => {
          S.alu = bx('32-bit ALU', FC.orange, -0.2, 3.2, 0, 2.4, 0.6); cap('32 bits 的 ALU', '就可以相減');
        },
  async (tok, S) => {
          S.rm.set('00001110', true); S.rm.hi(7, 8, OKG); sm('空出來 → 放 quotient bit', 4.6, 3.6); cap('remainder 往左動空出位置', 'quotient 放進去：combine');
        },
  async (tok, S) => {
          cap('笨的 version 回家看', '我們用快的 version');
        },
  async (tok, S) => {
          good('省下：Divisor 32 bits、ALU 32 bits', -3.6, 1.8); cap('half 的 bit 永遠是 0', 'Remainder 往左 shift');
        },
  async (tok, S) => {
          note('先 shift：省一輪（第一個商 bit 一定用不到）', -3.6, 1.0); cap('第一個 bit 會 overflow', '先做 shift，省一個 iteration');
        },
  async (tok, S) => {
          cap('quotient 跟 remainder', '都做 shift left → combine');
        },
  async (tok, S) => {
          S.rm.val('Remainder | Quotient（64）'); cap('divisor 32、ALU 32', 'remainder 64 bits 往左 shift');
        },
  async (tok, S) => {
          S.f = code(['減完 ≥ 0 → 放 1', '減完 < 0 → restore，再放 0'], 4.4, 6.6); cap('正數放 1', '負數：先 restore 再放 0');
        }
]);

// ════════ gBaVGirWTlU（第12B講 Computer Arithmetic） ════════
scene('nuB-12b-algo', "12B：先左移、減左半、補 1 或 restore 補 0、最後左半右移", CAM, [
  async (tok, S) => {
          S.dv = reg('Divisor', 4, -0.6, 5.6, { w: 0.66, bits: '0010' }); S.r = reg('Remainder', 8, 0.72, 4.3, { w: 0.66, bits: '00000111' }); S.r.val('= 被除數');
          S.f = code(['0. Remainder = dividend，先左移 1', '1. 左半 = 左半 − Divisor', '2a. ≥ 0：左移，右邊補 1', '2b. < 0：restore，左移，補 0', '3. 做 n 次；最後左半右移 1'], 0.4, 2.4, 0.45); S.f.hl(0);
          cap('dividend 放在 remainder', '');
        },
  async (tok, S) => {
          S.r.set('00001110', true); S.r.val('先左移'); cap('先做一個 bit shift', '');
        },
  async (tok, S) => {
          S.f.hl(1); S.r.hi(0, 4); cap('第一個 bit 會 overflow，不做', '然後開始減');
        },
  async (tok, S) => {
          cap('減完以後', '把結果放回 remainder');
        },
  async (tok, S) => {
          S.f.hl(2); S.r.clearGlow(); cap('remainder ≥ 0：夠減', 'shift left，放一個 1');
        },
  async (tok, S) => {
          S.r.hi(4, 8, OKG); S.r.val('右半：商的 bit'); cap('quotient 跟 remainder share', '商的 bit 放在最右邊');
        },
  async (tok, S) => {
          S.f.hl(3); S.r.clearGlow(); cap('小於 0：不夠減', '加回來，shift，補 0');
        },
  async (tok, S) => {
          S.f.hl(4); cap('一直做做做', '32 個 iteration');
        },
  async (tok, S) => {
          S.r.hi(0, 4, '#7a1010'); cap('最後一步把左半 right shift 一位', '才會得到正確的 remainder');
        }
]);
scene('nuB-12b-ex', "12B：0000 0111 ÷ 0010 逐步", CAM, [
  async (tok, S) => {
          S.D = divSmart(7, 2); S.dv = reg('Divisor', 4, -0.6, 5.6, { w: 0.66, bits: '0010' }); S.r = reg('Remainder', 8, 0.72, 4.3, { w: 0.66, bits: S.D.init }); S.r.val('= 7');
          S.it = hot('', -4.4, 6.6); cap('7 ÷ 2', 'remainder 放右邊');
        },
  async (tok, S) => {
          S.r.set(S.D.first, true); setL(S.it, '第 1 輪'); await wt(tok, 600); S.r.set(S.D.it[0].sub, true); S.r.hi(0, 4, '#7a1010'); S.r.val('左半變負的'); cap('第一個 iteration', '減：不夠減');
        },
  async (tok, S) => {
          S.r.set(S.D.it[0].after, true); S.r.clearGlow(); S.r.val('restore、補 0'); cap('負的 → restore', '補 0');
        },
  async (tok, S) => {
          setL(S.it, '第 2 輪'); S.r.set(S.D.it[1].sub, true); S.r.hi(0, 4, '#7a1010'); S.r.val('1 − 2 < 0'); cap('第二步再減', '1 − 2 不夠減');
        },
  async (tok, S) => {
          S.r.set(S.D.it[1].after, true); S.r.clearGlow(); S.r.val('restore、補 0'); cap('restore 回去', 'quotient 填 0');
        },
  async (tok, S) => {
          setL(S.it, '第 3 輪'); S.r.set(S.D.it[2].sub, true); S.r.hi(0, 4, OKG); await wt(tok, 600); S.r.set(S.D.it[2].after, true); S.r.clearGlow(); S.r.val('夠減、補 1'); cap('這時候已經夠減了', '填一個 1');
        },
  async (tok, S) => {
          setL(S.it, '第 4 輪'); S.r.set(S.D.it[3].sub, true); S.r.hi(0, 4, OKG); await wt(tok, 600); S.r.set(S.D.it[3].after, true); S.r.clearGlow(); S.r.val('夠減、補 1'); cap('又夠減了', '再補一個 1');
        },
  async (tok, S) => {
          S.r.set(S.D.fin, true); S.r.hi(0, 4); setL(S.it, '完成'); S.r.val('餘數 | 商');
          ok(S.D.rem === 7 % 2 && S.D.quo === Math.floor(7 / 2), 0.6, 2.6, 'Remainder = ' + S.D.fin.slice(0, 4) + ' = 1、Quotient = ' + S.D.fin.slice(4) + ' = 3 ✓');
          cap('把它 right shift 回來', '這就是 divide 的動作');
        }
]);
scene('nuB-12b-sign', "12B：−7 ÷ 2、−7 ÷ −2", CAM, [
  async (tok, S) => {
          hot('signed division', 0, 7.0); cap('signed 怎麼辦？', '有一個 rule');
        },
  async (tok, S) => {
          cap('先用 unsigned 除', '除完再給 sign');
        },
  async (tok, S) => {
          S.r = code(['規則 1：remainder 與 dividend 同號', '規則 2：dividend、divisor 同號 → 商為正；異號 → 商為負'], 0, 6.0); S.r.ls[1].element.style.visibility = 'hidden'; S.r.hl(0);
          cap('被除數跟餘數', '一定要相同的 sign');
        },
  async (tok, S) => {
          S.r.ls[1].element.style.visibility = ''; S.r.hl(1); cap('divisor 跟 dividend 同號 → 商正', '不同號 → 負');
        },
  async (tok, S) => {
          S.r.hl(-1); S.e1 = bx('−7 ÷ 2', FC.sky, -3.4, 4.2, 0, 2.2, 0.6); cap('例子：−7 除以 2', '負號怎麼擺？');
        },
  async (tok, S) => {
          S.u1 = sm('unsigned：7 ÷ 2 = 3 餘 1', -3.4, 3.4); cap('先用 unsigned', '7 除以 2 是 3 餘 1');
        },
  async (tok, S) => {
          const q = -3, r = -1; ok(q * 2 + r === -7, -3.4, 2.6, '商 −3、餘數 −1：(−3)×2 + (−1) = −7 ✓'); cap('餘數跟被除數同號：−1', '不同號：商 −3');
        },
  async (tok, S) => {
          S.e2 = bx('−7 ÷ −2', FC.sky, 3.4, 4.2, 0, 2.2, 0.6); cap('再看 −7 除以 −2', '');
        },
  async (tok, S) => {
          const q = 3, r = -1; ok(q * -2 + r === -7, 3.4, 2.6, '商 3、餘數 −1：3×(−2) + (−1) = −7 ✓'); cap('餘數跟被除數同號 → −1', '同號 → 商是正的');
        },
  async (tok, S) => {
          good('quotient × divisor + remainder = dividend', 0, 1.4); cap('一定要達成', 'quotient × divisor + remainder = dividend');
        },
  async (tok, S) => {
          const bad1 = 3 * 2 + (-1); ok(bad1 !== -7, 0, 0.6, '反例：若 −7 ÷ 2 給商 +3、餘數 −1 → 3×2 − 1 = 5 ≠ −7 ✓'); cap('照這兩個 rule', '一定回到 dividend');
        },
  async (tok, S) => {
          bad('不 check overflow、不 check divide by zero', 0, -0.2); cap('quotient 可能太大', '不 check overflow、divide by zero');
        }
]);
scene('nuB-12b-share', "12B：32-bit ALU、64-bit register 右移（乘）或左移（除）", CAM, [
  async (tok, S) => {
          S.a = bx('乘法器', FC.sky, -3.4, 5.6, 0, 2.6, 0.7); S.b = bx('除法器', FC.pink, 3.4, 5.6, 0, 2.6, 0.7); cap('乘法器、除法器', '其實可以 combine 在一起');
        },
  async (tok, S) => {
          S.hl = bx('Hi | Lo（共用）', FC.gold, 0, 4.4, 0, 3.0, 0.6); cap('divide 跟 multiply 在一起', 'low、high 也 share');
        },
  async (tok, S) => {
          S.alu = bx('32-bit ALU：乘 → 加、除 → 減', FC.orange, 0, 3.2, 0, 4.4, 0.6); cap('同樣的 ALU', '一個做加、一個做減');
        },
  async (tok, S) => {
          S.reg = reg('64-bit register', 8, 0.6, 1.9, { w: 0.6 }); cap('64-bit register', '一個往右 shift、一個往左 shift');
        },
  async (tok, S) => {
          gone(S.a, S.b); S.top = bx('Multiplicand / Divisor（32，不動）', FC.sky, 0, 5.6, 0, 4.6, 0.6); cap('multiplicand、divisor 不動', 'ALU 只要 32 bits');
        },
  async (tok, S) => {
          S.reg.set('00000011'); S.reg.hi(4, 8); for (let k = 0; k < 3; k++) { await wt(tok, 450); S.reg.set(bin(uval(S.reg.bits) >> 1 | (k === 0 ? 0x80 : 0), 8), true); } S.reg.val('乘：右移');
          cap('乘：一開始擺滿 multiplier', '消耗掉一個 bit，partial product 擺進去');
        },
  async (tok, S) => {
          S.reg.set('00000111'); S.reg.clearGlow(); for (let k = 0; k < 3; k++) { await wt(tok, 450); S.reg.set(bin((uval(S.reg.bits) << 1 | 1) & 255, 8), true); } S.reg.val('除：左移'); S.reg.hi(5, 8, OKG);
          cap('除：remainder 往左移', '空出的位置放 quotient');
        },
  async (tok, S) => {
          S.ctl = hot('control：乘 → 右移＋加；除 → 左移＋減', 0, 0.8); cap('control 告訴我做乘還是除', '決定 shift right／left、加／減');
        },
  async (tok, S) => {
          good('同一個 hardware 做乘和除', 0, 0.1); cap('同一個 hardware', '可以做乘跟除');
        }
]);
scene('nuB-12b-why', "12B：整數表示法的範圍、科學記號、小數點會「浮動」", CAM, [
  async (tok, S) => {
          hot('floating point：先表示，再設計硬體', 0, 7.0); cap('先介紹怎麼表示它', '再設計加減乘除的 hardware');
        },
  async (tok, S) => {
          S.l = [bx('unsigned：0 ～ 255', FC.sky, -2.6, 5.6, 0, 4.4, 0.6)]; sm('示意：n = 8', 3.4, 5.6); cap('n 個 bit 當 unsigned', '0 到 2ⁿ − 1');
        },
  async (tok, S) => {
          S.l.push(bx('two\'s complement：−128 ～ 127', FC.pink, -2.6, 4.8, 0, 4.4, 0.6)); ok(-(2 ** 7) === -128 && 2 ** 7 - 1 === 127, 3.4, 4.8, '−2⁷ ～ 2⁷ − 1 ✓'); cap('two\'s complement', '有正有負：−2ⁿ⁻¹ ～ 2ⁿ⁻¹ − 1');
        },
  async (tok, S) => {
          S.l.push(bx('1\'s complement：−127 ～ 127', FC.mint, -2.6, 4.0, 0, 4.4, 0.6)); S.l.push(bx('excess（bias）：看 bias', FC.lilac, -2.6, 3.2, 0, 4.4, 0.6)); cap('one\'s complement、excess', '各有一個 range');
        },
  async (tok, S) => {
          cap('同一個 bit pattern', '不同的解釋方法，都是整數');
        },
  async (tok, S) => {
          bad('很大（6.02 × 10²³）、很小（1.6 × 10⁻¹⁹）？', 2.0, 2.2); cap('很大或很小的數目', '沒辦法表示');
        },
  async (tok, S) => {
          gone(S.l); cap('新的表示方法：floating point', '先把科學符號表示出來');
        },
  async (tok, S) => {
          S.e = code(['1.0110 × 2^−3', 'significand   base^exponent'], 0, 5.6); cap('significand（mantissa）', '乘以 2 的 exponent 次方');
        },
  async (tok, S) => {
          sm('「.」= binary point', 0, 4.4); cap('可以表示很大或很小的數', '小數點叫 binary point');
        },
  async (tok, S) => {
          S.i = digits('345.', -4.6, 2.8, FC.sky); sm('整數：點固定在最右邊（fixed）', -3.6, 2.0); cap('integer 的 radix point', '永遠在最右邊');
        },
  async (tok, S) => {
          S.f1 = digits('2.3468', 1.2, 2.8, FC.orange); S.f2 = digits('27.5', 1.2, 2.1, FC.orange); sm('浮點數：點的位置會變', 2.6, 1.2); cap('floating point 的點', '跑來跑去');
        },
  async (tok, S) => {
          good('binary point 不固定 → floating point', 0, 0.3); cap('binary point 不固定位置', '所以叫 floating point');
        }
]);
scene('nuB-12b-norm', "12B：1.xxxx × 2^yyyy", CAM, [
  async (tok, S) => {
          hot('normalize：一致的表示法', 0, 7.0); cap('要一致性', '把它 normalize');
        },
  async (tok, S) => {
          cap('leading 的 0 全部去掉', '第一個位置一定要 non-zero');
        },
  async (tok, S) => {
          S.one = cube('1', FC.red, [0.7, 0.6, 0.6], -2.0, 5.0, 0); sm('二進位：非 0 = 1', -2.0, 4.2); cap('binary 只有 0 跟 1', '第一個位置一定是 1');
        },
  async (tok, S) => {
          S.a = good('1.0 × 2⁻⁹（normalized）', 2.6, 5.6); S.b = bad('0.1 × 2⁻⁸（不是）', 2.6, 4.8); ok(1.0 * 2 ** -9 === 0.5 * 2 ** -8, 2.6, 4.0, '兩種寫法值一樣（0.1₂ = 0.5）✓'); cap('normalize：1.0 × 2⁻⁹', '不要 0.1 × 2⁻⁸ 這種');
        },
  async (tok, S) => {
          gone(S.a, S.b); S.e = code(['1 . x x x x × 2 ^ y y y y'], 0, 2.6); cap('一定長這樣', '1.xxxx 乘以 2 的 yyyy 次方');
        },
  async (tok, S) => {
          cap('這個 1 不會動', '這個 2 也不會變');
        },
  async (tok, S) => {
          S.x = bx('x：significand', FC.green, -2.6, 1.2, 0, 2.8, 0.6); S.y = bx('y：exponent', FC.blue, 1.4, 1.2, 0, 2.6, 0.6); cap('只要記錄 x 跟 y', '合起來就是一個 number');
        },
  async (tok, S) => {
          bad('base 2：不用記（大家都是 2）', 0, 0.3); cap('要不要記錄 2？', '不用，大家都是 2');
        },
  async (tok, S) => {
          cap('除了 x 跟 y', '還要記錄什麼？');
        },
  async (tok, S) => {
          S.s = bx('sign', FC.red, -5.0, 1.2, 0, 1.2, 0.6); cap('要正負號', 'significand、exponent 只是量');
        },
  async (tok, S) => {
          ok(true, 0, -0.5, '三樣：sign、exponent、significand ✓'); cap('記三個東西', 'sign、x、y');
        },
  async (tok, S) => {
          S.s.position.x = -4.2; S.y.position.x = -1.6; S.x.position.x = 2.2; cap('sign、exponent、significand', '為什麼這樣擺？待會解答');
        }
]);
scene('nuB-12b-ieee', "12B：exponent 決定範圍，significand 決定精準度", CAM, [
  async (tok, S) => {
          cap('exponent、significand 各幾個 bit？', 'range 跟 accuracy 會不一樣');
        },
  async (tok, S) => {
          S.row = floatRow(3.4); S.row.set('0'.repeat(32)); ok(1 + 8 + 23 === 32, 0, 5.0, 'single：1 + 8 + 23 = 32 bits ✓'); cap('IEEE：1、8、23', 'single precision，32 bits');
        },
  async (tok, S) => {
          cap('更精確、range 更大', '用 64 bits：double precision');
        },
  async (tok, S) => {
          S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); cap('exponent 擺前面', 'significand 擺最後面');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.d = code(['double：S(1) | exponent(11) | significand(52)'], 0, 1.4); ok(1 + 11 + 52 === 64, 0, 0.6, 'double：1 + 11 + 52 = 64 bits ✓'); cap('double：exponent 11 bits', 'significand 52 bits');
        },
  async (tok, S) => {
          cap('exponent 增加不多', '主要增加 significand');
        },
  async (tok, S) => {
          S.r1 = hot('exponent bits ↑ → range ↑', -3.6, 6.4); cap('增加 exponent 的 bit', '增加 range（大小）');
        },
  async (tok, S) => {
          S.r2 = hot('significand bits ↑ → precision ↑', 3.4, 6.4); cap('增加 significand', '增加精準度');
        }
]);
scene('nuB-12b-hidden', "12B：23 bits 存的 fraction + 隱藏的 1 = 24-bit significand", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.4); S.row.set('0'.repeat(32)); cap('IEEE 754', 'single precision 講就好');
        },
  async (tok, S) => {
          S.row.set('1' + '0'.repeat(31), true); S.sg = hot('S = 1 → 負', S.row.xs[0], 5.0); cap('sign bit：1 是負', '0 是 positive');
        },
  async (tok, S) => {
          S.row.set('0'.repeat(32), true); setL(S.sg, ''); cap('significand', 'normalized：leading bit 一定是 1');
        },
  async (tok, S) => {
          S.h = cube('1.', FC.red, [0.6, 0.5, 0.5], S.row.xs[9] - 0.55, 4.3, 0); sm('hidden 1（不存）', S.row.xs[9] - 0.2, 5.0); cap('不浪費 bit 存那個 1', 'hidden one');
        },
  async (tok, S) => {
          const b = f32(1.625); S.row.set(b, true); ok(b.slice(9, 12) === '101' && bitsToF(b) === 1.625, 0, 1.4, '示意 1.101₂ = 1.625：F 只存 101…（hidden 1 不存）✓'); cap('23 個 bit + hidden 1', '= 24 bits 的 significand');
        },
  async (tok, S) => {
          cap('存的部分介於 0 到 1', '前面還有一個 hidden 1');
        },
  async (tok, S) => {
          S.row.set('0'.repeat(32), true); S.q = hot('全部 0 → 1.000… ？', 0, 6.4); cap('0 要怎麼表示？', 'always 有一個 1 在那邊');
        },
  async (tok, S) => {
          cap('significand 全擺 0', '讀出來還是 1.000…');
        },
  async (tok, S) => {
          setL(S.q, '0 要另外特別表示（之後介紹）'); cap('0 沒辦法這樣表示', '0 另外表示，後面介紹');
        },
  async (tok, S) => {
          good('讀出來：1.F（前面補 1）', 0, 1.4); cap('前面一定要加一個 1', '1 點什麼什麼');
        }
]);
scene('nuB-12b-cmp', "12B：比大小先比 sign、再比 exponent；comparator 要的是「直接比」", CAM, [
  async (tok, S) => {
          hot('exponent：怎麼表示、為什麼在中間？', 0, 7.0); cap('exponent 要怎麼表示', '為什麼擺在中間');
        },
  async (tok, S) => {
          S.a = floatRow(5.0); S.b = floatRow(2.6); S.a.set(f32(-3.5)); S.b.set(f32(12)); cap('比較兩個 floating point', '從哪邊開始比？');
        },
  async (tok, S) => {
          glow(S.a.ms[0], HL); glow(S.b.ms[0], HL); ok(12 > -3.5, 0, 0.8, 'sign 0 > sign 1：+12 > −3.5，後面不用比 ✓'); cap('先從 sign 開始比', '你 0 我 1，比到這就好');
        },
  async (tok, S) => {
          S.a.clearGlow(); S.b.clearGlow(); S.a.set(f32(3.5), true); S.a.ms.slice(1, 9).forEach((m) => glow(m, HL)); S.b.ms.slice(1, 9).forEach((m) => glow(m, HL)); cap('兩個都是 0 的話', '下一步比 exponent');
        },
  async (tok, S) => {
          cap('exponent 一樣才比 significand', '所以 exponent 放第二位');
        },
  async (tok, S) => {
          gone(S.a, S.b); cap('exponent 要怎麼表示', '比較容易比？');
        },
  async (tok, S) => {
          S.sub = bx('two\'s complement：要用減法比', FC.pink, -3.0, 5.4, 0, 4.4, 0.7); cap('用 two\'s complement', '要做一個減的動作才能比');
        },
  async (tok, S) => {
          S.cmp = bx('comparator：從最高位比，一分高下就停', FC.mint, 3.0, 5.4, 0, 4.6, 0.7); cap('comparator 很簡單', '第一個 bit 比你大就比你大');
        },
  async (tok, S) => {
          cap('減法要等 carry', 'comparator 很快');
        },
  async (tok, S) => {
          S.e1 = reg('½ 的 exponent −1', 8, 1.0, 3.2, { w: 0.6, bits: bin(-1, 8) }); S.e2 = reg('2 的 exponent +1', 8, 1.0, 2.4, { w: 0.6, bits: bin(1, 8) }); cap('二分之一：−1', '2：+1');
        },
  async (tok, S) => {
          S.e1.hi(0, 1, '#7a1010'); ok(uval(bin(-1, 8)) > uval(bin(1, 8)) && -1 < 1, 1.0, 1.4, '當 pattern 比：1111 1111 > 0000 0001，但 −1 < 1 → 比錯 ✓'); cap('直接比：這個比較大', '可是它其實是 −1');
        },
  async (tok, S) => {
          good('→ 用 biased notation', 1.0, 0.6); cap('不用 1\'s、2\'s complement', '改用 biased notation');
        },
  async (tok, S) => {
          cap('看到 number 馬上比大小', '小就是小、大就是大');
        }
]);
scene('nuB-12b-bias', "12B：bias 7 的例子、IEEE 的 bias 127／1023", CAM, [
  async (tok, S) => {
          S.cells = []; for (let v = 0; v < 16; v++) { const x = -6.0 + v * 0.8; S.cells.push(bx(bin(v, 4), FC.sky, x, 4.6, 0, 0.74, 0.5, 0.6)); }
          S.lbl = []; cap('什麼叫 bias 7？', '把 number 從 000 列下來');
        },
  async (tok, S) => {
          for (let v = 0; v < 16; v++) { S.lbl.push(sm(String(v - 7), -6.0 + v * 0.8, 3.9)); if (v % 4 === 3) await wt(tok, 120); }
          tint(S.cells[0], FC.pink); cap('000 就是最負的 −7', '−7、−6、−5…一路排下來');
        },
  async (tok, S) => {
          tint(S.cells[7], FC.green); hot('0111 = 0', -6.0 + 7 * 0.8, 5.4); cap('number 有個 shift', 'shift 七個位置');
        },
  async (tok, S) => {
          ok([...Array(15).keys()].every((v) => (v + 1 - 7) > (v - 7)), 0, 6.4, 'pattern 越大 → 值越大（可以直接比）✓'); cap('這個最小、第二小', '一比就知道誰大');
        },
  async (tok, S) => {
          S.f = code(['值 = unsigned 值 − bias'], 0, 2.6); cap('用 unsigned 算出來', '再減 7 就對了');
        },
  async (tok, S) => {
          glow(S.cells[11], HL); ok(uval('1011') - 7 === 4, 0, 1.8, '1011 = 11，11 − 7 = 4 ✓'); cap('看它 unsigned 是 11', '11 − 7 = 4');
        },
  async (tok, S) => {
          for (let v = 0; v < 7; v++) glow(S.cells[v], '#3a1a3a'); cap('前七位要給負的用', '每個人往前推 7 個位置');
        },
  async (tok, S) => {
          S.cells.forEach((m) => glow(m, null)); setL(S.f.ls[0], 'bias 8：值 = unsigned − 8'); cap('bias 8：從 −8 開始', 'unsigned 算出來要減 8');
        },
  async (tok, S) => {
          setL(S.f.ls[0], 'bias 127：值 = unsigned − 127'); cap('bias 127', '減掉 127');
        },
  async (tok, S) => {
          tint(S.cells[15], FC.green); cap('000 最 negative', '111 最 positive');
        },
  async (tok, S) => {
          S.ie = code(['single：E − 127', 'double：E − 1023'], 4.4, 2.6); cap('IEEE 754：single 用 127', 'double 用 1023');
        },
  async (tok, S) => {
          gone(S.cells, S.lbl); S.m1 = reg('−1', 8, 0, 4.8, { w: 0.6, bits: bin(-1 + 127, 8) }); S.p1 = reg('+1', 8, 0, 4.0, { w: 0.6, bits: bin(1 + 127, 8) });
          S.m1.val('= 126 − 127'); S.p1.val('= 128 − 127'); cap('−1 表示成這樣', '1 表示成這樣');
        },
  async (tok, S) => {
          S.m1.hi(0, 1); S.p1.hi(0, 1); ok(uval(S.p1.bits) > uval(S.m1.bits) && 1 > -1, 0, 3.0, '第一個 bit 就分出：1000 0000 > 0111 1110 ✓'); cap('看第一個 bit', '你比我小就不用再比');
        },
  async (tok, S) => {
          good('sign → exponent（bias，直接比）→ significand', 0, 1.6); cap('先比 sign，再比 exponent', '一分出高下就停');
        }
]);
scene('nuB-12b-f2d', "12B：(−1)^S × (1 + F) × 2^(E − 127)", CAM, [
  async (tok, S) => {
          S.e = code(['(−1)^S × (1 + F) × 2^(E − 127)'], 0, 6.6); S.e.hl(0); cap('sign bit 0 代表正', '1 代表負：(−1)^S');
        },
  async (tok, S) => {
          cap('不要忘記 hidden one', '1 + significand');
        },
  async (tok, S) => {
          cap('exponent 用 unsigned 算出來', '再減掉 127');
        },
  async (tok, S) => {
          S.e.hl(-1); cap('base 2、hidden 1', '都在這邊，不要忘記');
        },
  async (tok, S) => {
          S.b = '0' + '01101000' + '10101010100001101000010'; S.row = floatRow(3.6); S.row.set(S.b, true); cap('Floating point to decimal', '這是什麼數字？');
        },
  async (tok, S) => {
          S.row.clearGlow(); glow(S.row.ms[0], HL); S.t1 = hot('S = 0 → 正', S.row.xs[0], 5.2); cap('sign bit 是 0', '正數');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); S.t2 = hot('E = ' + uval(S.b.slice(1, 9)), (S.row.xs[1] + S.row.xs[8]) / 2, 5.2); cap('exponent 用 unsigned 算出來', '是 104');
        },
  async (tok, S) => {
          const e = uval(S.b.slice(1, 9)) - 127; setL(S.t2, 'E − 127 = ' + e); ok(e === -23, 0, 1.9, '104 − 127 = −23 ✓'); cap('減 127', '就是 −23');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.row.ms.slice(9).forEach((m, i) => glow(m, S.b[9 + i] === '1' ? HL : null));
          const F = S.b.slice(9).split('').reduce((a, c, i) => a + (+c) * 2 ** -(i + 1), 0); S.F = 1 + F; S.t3 = hot('1.F = ' + S.F.toFixed(6), (S.row.xs[9] + S.row.xs[31]) / 2, 5.2);
          cap('前面有個 hidden 1', '第一、三、五位…');
        },
  async (tok, S) => {
          const v = S.F * 2 ** -23, f = bitsToF(S.b); ok(Math.abs(v - f) < 1e-15 && Math.abs(v - 1.986e-7) < 1e-10, 0, 1.2, '1.666115 × 2⁻²³ = ' + f.toExponential(4) + ' ✓'); cap('合起來就是這個數', '≈ 1.986 × 10⁻⁷');
        }
]);
scene('nuB-12b-d2f', "12B：0.75 = 0.11₂", CAM, [
  async (tok, S) => {
          hot('decimal → floating point', 0, 7.0); cap('decimal to floating point', '先表示成科學符號');
        },
  async (tok, S) => {
          cap('如果是一個分數', '先把十進位變成二進位');
        },
  async (tok, S) => {
          let v = 13, bits = ''; S.l = [];
          while (v > 0) { S.l.push(sm(v + ' ÷ 2 = ' + Math.floor(v / 2) + ' … ' + (v % 2), -3.6, 5.6 - S.l.length * 0.55)); bits = (v % 2) + bits; v = Math.floor(v / 2); await wt(tok, 300); }
          ok(bits === (13).toString(2), -3.6, 3.0, '示意 13 = ' + bits + '₂（餘數倒著讀）✓'); cap('整數用除', '一直除就可以除出來');
        },
  async (tok, S) => {
          cap('分數要怎麼做？', '乘以 2，一直乘下去');
        },
  async (tok, S) => {
          let f = 0.75, bits = ''; S.r = [];
          for (let k = 0; k < 4 && f > 0; k++) { const t = f * 2, d = Math.floor(t); S.r.push(sm(f + ' × 2 = ' + t + ' → ' + d, 3.0, 5.6 - k * 0.55)); bits += d; f = t - d; await wt(tok, 400); }
          ok(bits === '11' && 0.5 + 0.25 === 0.75, 3.0, 4.0, '0.75 = 0.11₂ = 2⁻¹ + 2⁻² ✓'); cap('0.75 用乘的方法', '變成 0.11 × 2⁰');
        },
  async (tok, S) => {
          cap('回去試試看', '下次再繼續');
        }
]);

// ════════ gnPwCZLD04c（第13A講 Computer Arithmetic） ════════
scene('nuB-13a-rev', "13A：single precision 的三個欄位", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.6); S.row.set('0'.repeat(32)); cap('上次介紹 floating point', 'single、double precision');
        },
  async (tok, S) => {
          cap('第一個 S', 'exponent、significand');
        },
  async (tok, S) => {
          glow(S.row.ms[0], HL); S.t1 = hot('0 正、1 負', S.row.xs[0], 5.0); cap('sign：0 是正數', '1 是負數');
        },
  async (tok, S) => {
          glow(S.row.ms[0], null); S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); S.t2 = hot('bias notation', (S.row.xs[1] + S.row.xs[8]) / 2, 5.0); cap('exponent 用什麼表示？', 'bias notation，為了 comparison');
        },
  async (tok, S) => {
          setL(S.t2, '真正指數 = E − 127'); cap('single precision：bias 127', 'unsigned 算出來再減 127');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.row.ms.slice(9).forEach((m) => glow(m, HL)); cap('significand：第一位一定 non-zero', '只有 0 跟 1 → 一定是 1');
        },
  async (tok, S) => {
          S.t3 = hot('1.（hidden）+ F', (S.row.xs[9] + S.row.xs[31]) / 2, 5.0); cap('不浪費 bit', 'hidden one');
        },
  async (tok, S) => {
          S.row.clearGlow(); code(['值 = (−1)^S × 1.F × 2^(E − 127)'], 0, 6.6); cap('前面不要忘記放那個 1', '一個 number 就這樣表示');
        }
]);
scene('nuB-13a-d2f', "13A：分數用乘、整數用除，再 normalize、加 bias", CAM, [
  async (tok, S) => {
          hot('decimal → floating point', 0, 7.0); cap('上次第二個例子講了一半', '先變成二進位的科學符號');
        },
  async (tok, S) => {
          S.i = bx('整數：divide（÷2）', FC.sky, -3.4, 5.8, 0, 3.2, 0.6); cap('如果是整數', '用除');
        },
  async (tok, S) => {
          S.q = hot('分數？', 3.4, 5.8); cap('如果是一個分數', '要怎麼變成二進位？');
        },
  async (tok, S) => {
          gone(S.q); S.f = bx('分數：multiply（×2）', FC.pink, 3.4, 5.8, 0, 3.2, 0.6); cap('fraction 要用 multiply', '一直乘');
        },
  async (tok, S) => {
          cap('先轉成二進位', '再變成科學符號表示');
        },
  async (tok, S) => {
          gone(S.i, S.f); S.c = code(['0.75 × 2 = 1.5 → 1', '0.5  × 2 = 1.0 → 1', '0.75 = 0.11₂ = 1.1₂ × 2⁻¹'], -3.6, 5.8, 0.48); cap('0.75 用乘的', '0.11 → 1.1 × 2⁻¹');
        },
  async (tok, S) => {
          S.row = floatRow(2.4); S.b = f32(-0.75); S.row.set('1' + '0'.repeat(31), true); cap('因為是負', 'sign 就是 1');
        },
  async (tok, S) => {
          S.row.set('1' + bin(-1 + 127, 8) + '0'.repeat(23), true); S.t = hot('E = −1 + 127 = 126', (S.row.xs[1] + S.row.xs[8]) / 2, 3.6); cap('exponent 是 −1', '加 127 → 126');
        },
  async (tok, S) => {
          S.row.set(S.b, true); ok(S.b === '1' + '01111110' + '1' + '0'.repeat(22), 0, 1.0, '−0.75 = 1 01111110 100…0 = 0x' + hexOf(S.b) + ' ✓'); cap('hidden one 不用表示', 'fraction 是 1，後面都 0');
        },
  async (tok, S) => {
          cap('分數：先用乘變 binary', '再用 representation');
        },
  async (tok, S) => {
          gone(S.c, S.row, S.t); S.c = code(['43.57 = 43 + 0.57'], 0, 6.2); cap('43.57 怎麼辦？', '有整數也有分數');
        },
  async (tok, S) => {
          let v = 43, ib = ''; while (v) { ib = (v % 2) + ib; v = Math.floor(v / 2); }
          let f = 0.57, fb = ''; for (let k = 0; k < 6; k++) { f *= 2; const d = Math.floor(f + 1e-12); fb += d; f -= d; }
          S.r1 = sm('43 ÷2… → ' + ib, -2.6, 5.2); S.r2 = sm('0.57 ×2… → 0.' + fb + '…', 2.6, 5.2);
          ok(ib === (43).toString(2) && fb === '100100', 0, 4.4, '43.57 ≈ ' + ib + '.' + fb + '…₂ ✓'); cap('整數用除、分數用乘', '再表示成二進位');
        },
  async (tok, S) => {
          gone(S.c, S.r1, S.r2); S.c = code(['1/3 = 0.3333…'], 0, 6.2); cap('三分之一', '0.3333… 一直下去');
        },
  async (tok, S) => {
          let f = 1 / 3, fb = ''; for (let k = 0; k < 8; k++) { f *= 2; const d = Math.floor(f); fb += d; f -= d; }
          S.fb = fb; S.r = sm('1/3 = 0.' + fb + '…₂', 0, 5.4); cap('binary：0.0101010…', '用剛才乘的方法');
        },
  async (tok, S) => {
          S.n = sm('= 1.0101… × 2⁻²', 0, 4.8); cap('normalized scientific notation', '1.0101 × 2⁻²');
        },
  async (tok, S) => {
          S.row = floatRow(2.4); S.b = f32(1 / 3); S.row.set('0' + S.b.slice(1, 9) + '0'.repeat(23), true); ok(uval(S.b.slice(1, 9)) === -2 + 127, 0, 3.8, 'E = −2 + 127 = 125 = 0111 1101 ✓'); cap('正數：sign 0', 'exponent −2 + 127 = 125');
        },
  async (tok, S) => {
          S.row.set(S.b, true); ok(S.b.slice(9, 17) === '01010101', 0, 1.0, '1/3 → 0 01111101 01010101…（F 前 8 位 0101 0101）✓'); cap('hidden one 不要表示', '只要表示 0101…');
        }
]);
scene('nuB-13a-range', "13A：最小 1.0 × 2⁻¹²⁶、最大 ≈ 2.0 × 2¹²⁷；23 bits ≈ 6 位十進位", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.6); S.row.set('0'.repeat(32)); cap('看 range', '還有 precision');
        },
  async (tok, S) => {
          S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); cap('exponent 跟 range 有關係', '');
        },
  async (tok, S) => {
          S.res = bad('保留：0000 0000、1111 1111', 0, 6.4); cap('exponent 全 0 跟全 1 不用', 'reserve 下來');
        },
  async (tok, S) => {
          S.row.set('0' + '00000001' + '0'.repeat(23), true); cap('最小 exponent', '0000 0001');
        },
  async (tok, S) => {
          S.mx = sm('最大 exponent：1111 1110', 0, 5.6); cap('最大 exponent', '1111 1110');
        },
  async (tok, S) => {
          S.t = hot('E = 1 → 1 − 127 = −126', (S.row.xs[1] + S.row.xs[8]) / 2, 5.0); cap('最小：1 − 127', '= −126');
        },
  async (tok, S) => {
          const v = bitsToF(S.row.bits); ok(v === 2 ** -126, 0, 1.4, '最小 normalized = 1.0 × 2⁻¹²⁶ ≈ ' + v.toExponential(3) + ' ✓'); cap('fraction 全部 0 + hidden one', '1.0 × 2⁻¹²⁶');
        },
  async (tok, S) => {
          S.row.set('0' + '11111110' + '0'.repeat(23), true); setL(S.t, 'E = 254 → 254 − 127 = 127'); cap('exponent 254', '減 127 → +127');
        },
  async (tok, S) => {
          S.row.set('0' + '11111110' + '1'.repeat(23), true); const v = bitsToF(S.row.bits);
          ok(v === (2 - 2 ** -23) * 2 ** 127, 0, 0.7, '最大 = (2 − 2⁻²³) × 2¹²⁷ ≈ ' + v.toExponential(3) + ' ✓'); cap('significand 全擺 1', '大約 2.0 × 2¹²⁷');
        },
  async (tok, S) => {
          gone(S.res, S.mx); cap('double precision', 'exponent 更多 bit，演算法一樣');
        },
  async (tok, S) => {
          S.row.clearGlow(); cap('precision 跟什麼有關？', '');
        },
  async (tok, S) => {
          S.row.ms.slice(9).forEach((m) => glow(m, HL)); setL(S.t, ''); cap('跟 significand 有關係', 'bit 越多越精確');
        },
  async (tok, S) => {
          S.p = code(['single：23 bits', 'double：52 bits'], 0, 6.6); cap('single：23 個 bit', 'double：52 個 bit');
        },
  async (tok, S) => {
          const d1 = 23 * Math.log10(2), d2 = 52 * Math.log10(2);
          ok(d1 > 6 && d1 < 7 && d2 > 15 && d2 < 16, 0, 5.4, '23 × log₁₀2 ≈ ' + d1.toFixed(1) + '（約 6 位）、52 × log₁₀2 ≈ ' + d2.toFixed(1) + '（約 16 位）✓');
          cap('差不多 6 個 decimal digit', 'double：差不多 16 個');
        },
  async (tok, S) => {
          cap('給你 bit 數', '要會算 range 跟 precision');
        }
]);
scene('nuB-13a-zero', "13A：E 分三類；E = 0、F = 0 → ±0", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.0); S.row.set('0'.repeat(32)); cap('0 還有一些 special number', '怎麼表示？');
        },
  async (tok, S) => {
          S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); cap('reserve 什麼？', 'exponent 全 0、全 1');
        },
  async (tok, S) => {
          S.tb = [['E = 0', 'F = 0'], ['E = 0', 'F ≠ 0'], ['E = 255', 'F = 0'], ['E = 255', 'F ≠ 0']].map(([a, b], i) => bx(a + '、' + b + '：?', FC.pink, -4.2 + (i % 2) * 4.6, 6.4 - Math.floor(i / 2) * 0.8, 0, 4.0, 0.6));
          S.tb.slice(2).forEach((m) => { m.visible = false; }); cap('exponent 是 0', 'significand 可以是 0 或非 0');
        },
  async (tok, S) => {
          S.tb.forEach((m) => { m.visible = true; }); cap('exponent 是 255', '也是 0 或非 0：四種組合');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.cat = [bx('E = 0：特殊', FC.pink, -4.2, 1.0, 0, 2.6, 0.6), bx('E = 1～254：正常', FC.mint, 0, 1.0, 0, 3.0, 0.6), bx('E = 255：特殊', FC.pink, 4.2, 1.0, 0, 2.6, 0.6)];
          cap('exponent 分三大類', '000、1 到 254、255');
        },
  async (tok, S) => {
          glow(S.cat[1], OKG); cap('中間正常的部分', '就是剛剛講的一大堆');
        },
  async (tok, S) => {
          glow(S.cat[1], null); glow(S.cat[0], HL); glow(S.cat[2], HL); cap('保留的兩個 pattern', '各配 0、非 0 → 四種');
        },
  async (tok, S) => {
          cap('一一看代表什麼', '解釋完就全部結束');
        },
  async (tok, S) => {
          glow(S.cat[0], null); glow(S.cat[2], null); relbl(S.tb[0], 'E = 0、F = 0：0'); tint(S.tb[0], FC.green); S.row.set('0'.repeat(32), true); cap('exponent 0、significand 0', '就代表 0');
        },
  async (tok, S) => {
          S.no = bad('沒有 hidden 1、不要算 0 − 127', 0, 5.0); cap('exponent 是 0', '沒有 hidden one');
        },
  async (tok, S) => {
          cap('不要去算 0 − 127', '這是特別的解釋方法');
        },
  async (tok, S) => {
          gone(S.no); S.row2 = floatRow(1.9); S.row2.set(f32(-0), true); ok(f32(0) === '0'.repeat(32) && f32(-0) === '1' + '0'.repeat(31) && 0 === -0, 0, 5.0, '+0 = 0 0…0、−0 = 1 0…0，值相等 ✓');
          cap('sign 0 跟 1', '正 0 跟負 0');
        },
  async (tok, S) => {
          cap('一看到就知道是 0', '不用 bias、不用 hidden one');
        }
]);
scene('nuB-13a-denorm', "13A：E = 0、F ≠ 0 → 0.F × 2⁻¹²⁶", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.0); S.row.set('0' + '00000000' + '1' + '0'.repeat(22), true); cap('exponent 是 0、F 不是 0', '要特別解釋');
        },
  async (tok, S) => {
          cap('bit 是有限的', '超過就 overflow 或 underflow');
        },
  async (tok, S) => {
          hot('gradual underflow', 0, 6.6); cap('已經是 underflow 的 number', '嘗試表示它：gradual underflow');
        },
  async (tok, S) => {
          S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); S.t1 = hot('指數 = −126', (S.row.xs[1] + S.row.xs[8]) / 2, 4.4); cap('exponent 全 0', '指數還是 2⁻¹²⁶');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.row.ms.slice(9).forEach((m) => glow(m, HL)); S.t2 = hot('0.F（沒有 hidden 1）', (S.row.xs[9] + S.row.xs[31]) / 2, 4.4);
          const v = bitsToF(S.row.bits); ok(v === 0.5 * 2 ** -126, 0, 1.2, '0 00000000 100…0 = 0.1₂ × 2⁻¹²⁶ = 2⁻¹²⁷ ✓'); cap('significand 擺什麼就是什麼', '沒有 hidden one');
        },
  async (tok, S) => {
          S.row.set('0' + '00000000' + '0'.repeat(22) + '1', true); const v = bitsToF(S.row.bits);
          ok(v === 2 ** -149 && v < 2 ** -126, 0, 0.5, '最小 denormalized = 2⁻²³ × 2⁻¹²⁶ = 2⁻¹⁴⁹ ≈ ' + v.toExponential(2) + ' ✓'); cap('比 1.0 × 2⁻¹²⁶ 還小', '就叫 denormalized number');
        },
  async (tok, S) => {
          cap('怎麼知道有沒有 hidden one？', '看 exponent 是不是全 0');
        },
  async (tok, S) => {
          cap('exponent 是 0：沒有 hidden 1', '指數直接給 −126');
        },
  async (tok, S) => {
          S.d = good('E = 0、F ≠ 0 → denormalized number', 0, -0.4); cap('exponent 0、F 非 0', 'denormalized number');
        },
  async (tok, S) => {
          cap('其實已經 underflow', '偷吃步把它表示出來');
        },
  async (tok, S) => {
          cap('00 → 0', '非 0 → denormalized');
        }
]);
scene('nuB-13a-inf', "13A：E = 255：F = 0 → ±∞、F ≠ 0 → NaN", CAM, [
  async (tok, S) => {
          S.row = floatRow(3.0); S.row.set('0' + '11111111' + '0'.repeat(23), true); cap('exponent 全部是 1', '又分 0 跟非 0');
        },
  async (tok, S) => {
          S.t = hot('E = 255、F = 0 → +∞', 0, 4.4); cap('全部是 1、F 是 0', '正無限大、負無限大');
        },
  async (tok, S) => {
          const b = f32(1 / 0); ok(b === '0' + '1'.repeat(8) + '0'.repeat(23) && f32(-1 / 0)[0] === '1', 0, 1.2, '1 ÷ 0 = +∞ → 0 11111111 0…0；−1 ÷ 0 = −∞ ✓'); cap('除以 0', '表示成無限大');
        },
  async (tok, S) => {
          S.row.ms.slice(1, 9).forEach((m) => glow(m, HL)); cap('exponent 全部是 1', 'significand 是 0000');
        },
  async (tok, S) => {
          S.row.clearGlow(); S.row.set('0' + '11111111' + '1' + '0'.repeat(22), true); setL(S.t, 'E = 255、F ≠ 0 → NaN'); cap('exponent 全 1、F 非 0', 'not a number');
        },
  async (tok, S) => {
          const b = f32(0 / 0), b2 = f32(Math.sqrt(-4)); ok(b.slice(1, 9) === '11111111' && b.slice(9).includes('1') && Number.isNaN(Math.sqrt(-4)) && b2.slice(1, 9) === '11111111', 0, 1.2, '0 ÷ 0、√−4 → E = 255、F ≠ 0（NaN）✓');
          cap('0 除以 0、√−4', '不是一個 number');
        },
  async (tok, S) => {
          code(['E = 0    F = 0 → ±0     F ≠ 0 → denormalized', 'E = 255  F = 0 → ±∞     F ≠ 0 → NaN', 'E = 1～254 → (−1)^S × 1.F × 2^(E−127)'], 0, 6.8, 0.48); cap('全部的 case 結束', '000、255 是特別 case');
        },
  async (tok, S) => {
          cap('exponent 000、後面有數字', 'denormalized 的 number');
        }
]);
scene('nuB-13a-fpalg', "13A：不能直接用 full adder", CAM, [
  async (tok, S) => {
          hot('floating point 的加法器', 0, 7.0); cap('怎麼做 floating point 的加', '根據 representation 設計');
        },
  async (tok, S) => {
          S.a = bx('整數：full adder 串起來', FC.sky, -3.4, 5.6, 0, 3.6, 0.6); cap('two\'s complement 很簡單', 'full adder 兜一兜就好');
        },
  async (tok, S) => {
          S.b = bad('浮點：S | E | F → 不能直接用 full adder', 2.6, 4.8); cap('同一個 bit pattern', '解釋不一樣，不能直接加');
        },
  async (tok, S) => {
          cap('要設計一個加法器', '先想 algorithm');
        },
  async (tok, S) => {
          gone(S.a, S.b); S.e = code(['1.3 × 2⁵ + 1.3 × 2⁻⁵ ≠ 2.6 × 2^?'], 0, 5.8); cap('1.3 × 2⁵、1.3 × 2⁻⁵', '可以直接把 mantissa 相加嗎？不行');
        },
  async (tok, S) => {
          cap('exponent 要變成一樣', 'radix point 要在同一個位置');
        },
  async (tok, S) => {
          S.d = sm('十進位想：小的那個寫成 0.34 × 10¹ 再加', 0, 4.8); cap('小的那個要變', '例如變成 0.34 再相加');
        },
  async (tok, S) => {
          S.st = code(['1. 對齊：指數小的數 right shift'], -2.4, 3.6, 0.48); cap('把小的移到 5 次方', 'right shift');
        },
  async (tok, S) => {
          gone(S.st); S.st = code(['1. 對齊：指數小的數 right shift', '2. mantissa 相加'], -2.4, 3.6, 0.48); S.st.hl(1); cap('小數點對齊之後', 'mantissa 相加');
        },
  async (tok, S) => {
          gone(S.st); S.st = code(['1. 對齊：指數小的數 right shift', '2. mantissa 相加', '3. normalize（檢查 overflow／underflow）'], -2.4, 3.6, 0.48); S.st.hl(2); cap('還要 normalize', '出來可能不是 normalized form');
        },
  async (tok, S) => {
          gone(S.st); S.st = code(['1. 對齊：指數小的數 right shift', '2. mantissa 相加', '3. normalize（檢查 overflow／underflow）', '4. rounding（23 bits 放不下）'], -2.4, 3.6, 0.48); S.st.hl(3); cap('size 固定放不下', 'truncation 或 rounding');
        },
  async (tok, S) => {
          S.lp = arrow(V3(1.4, 2.0, 0), V3(1.4, 2.6, 0), 0xd64545); sm('rounding 後還要 normalize？→ 回第 3 步', 3.6, 1.8); cap('rounding 又進位了', '要回去再 normalization');
        },
  async (tok, S) => {
          S.st.hl(-1); cap('integer 加：一堆 full adder', '浮點：四個步驟，很複雜');
        }
]);
scene('nuB-13a-fpex', "13A：1.000 × 2⁻¹ + (−1.110 × 2⁻²) = 1.000 × 2⁻⁴", CAM, [
  async (tok, S) => {
          S.st = code(['1. align', '2. add', '3. normalize', '4. round'], 5.0, 6.6, 0.45); cap('簡單的 number 走一遍', '四個步驟');
        },
  async (tok, S) => {
          S.slot = (k) => -2.6 + k * 0.9;
          const mk = (s, y, c) => s.split('').map((d, k) => (d === '.' ? tag('.', 'val', S.slot(k) - 0.0, y) : cube(d, c, [0.75, 0.55, 0.7], S.slot(k), y, 0)));
          S.mk = mk; S.X = mk('1.000', 5.4, FC.blue); S.ex = hd('× 2⁻¹', 2.6, 5.4); sm('0.5 =', -4.0, 5.4);
          S.Y = mk('1.110', 4.4, FC.orange); S.ey = hd('× 2⁻²', 2.6, 4.4); sm('−0.4375 = −', -4.3, 4.4);
          ok(1 * 2 ** -1 === 0.5 && 1.75 * 2 ** -2 === 0.4375, -0.6, 6.4, '1.000₂×2⁻¹ = 0.5、1.110₂×2⁻² = 0.4375 ✓'); cap('1.000 × 2⁻¹', '−1.110 × 2⁻²');
        },
  async (tok, S) => {
          S.st.hl(0); gone(S.Y); S.Y = S.mk('0.111', 4.4, FC.orange); setL(S.ey, '× 2⁻¹'); cap('指數小的 right shift 一位', '−0.111 × 2⁻¹');
        },
  async (tok, S) => {
          S.st.hl(1); wire([[-3.2, 3.85], [3.4, 3.85]]); S.Z = S.mk('0.001', 3.2, FC.green); S.ez = hot('× 2⁻¹', 2.6, 3.2);
          ok(1.0 - 0.875 === 0.125, -0.6, 2.4, '1.000 − 0.111 = 0.001（1 − 0.875 = 0.125）✓'); cap('mantissa 相加', '0.001 × 2⁻¹');
        },
  async (tok, S) => {
          S.st.hl(2); cap('不是 normalized form', '做 normalization：left shift');
        },
  async (tok, S) => {
          gone(S.Z); S.Z = S.mk('1.000', 3.2, FC.green); setL(S.ez, '× 2⁻⁴');
          const r = 1.0 * 2 ** -4; ok(r === 0.5 - 0.4375 && Math.fround(0.5 + -0.4375) === r, -0.6, 2.4, '1.000 × 2⁻⁴ = 0.0625 = 0.5 − 0.4375 ✓（4 位剛好放得下，不用 round）'); cap('left shift 三個位置', 'exponent −3 → 2⁻⁴');
        },
  async (tok, S) => {
          S.st.hl(-1); note('right shift = 數往右移（小數點相對往左）', 0, 1.0); cap('right／left shift', '是 number 在移，不是小數點');
        },
  async (tok, S) => {
          cap('回家測試時', '不要搞反');
        }
]);
scene('nuB-13a-fphw', "13A：small ALU、MUX、shifter、big ALU、normalize、rounding", WIDE, [
  async (tok, S) => {
          S.A = [bx('Sign', FC.red, -6.2, 6.8, 0, 0.9, 0.5), bx('Exp A', FC.blue, -4.9, 6.8, 0, 1.4, 0.5), bx('Fraction A', FC.green, -2.9, 6.8, 0, 2.2, 0.5)];
          S.B = [bx('Sign', FC.red, 1.0, 6.8, 0, 0.9, 0.5), bx('Exp B', FC.blue, 2.3, 6.8, 0, 1.4, 0.5), bx('Fraction B', FC.green, 4.3, 6.8, 0, 2.2, 0.5)];
          cap('floating point 加法的 hardware', '很複雜');
        },
  async (tok, S) => {
          sm('早期 x86：浮點交給 coprocessor', 0, 7.5); cap('x86 一開始沒有 floating point', '另外一個 co-processor');
        },
  async (tok, S) => {
          cap('好多個 ALU', '然後 shift 來 shift 去');
        },
  async (tok, S) => {
          cap('給你一個 algorithm', '把 hardware 設計出來');
        },
  async (tok, S) => {
          S.steps = [sm('step 1', 6.5, 4.8), sm('step 2', 6.5, 2.4), sm('step 3', 6.5, 1.2), sm('step 4', 6.5, -0.2)]; cap('四個步驟', '對應到這邊的 hardware');
        },
  async (tok, S) => {
          S.big = bx('Big ALU', FC.orange, 0, 2.4, 0, 3.0, 0.7); S.nm = bx('Shift left / right（normalize）', FC.sky, 0, 1.2, 0, 4.2, 0.6); S.id = bx('Inc / Dec exponent', FC.blue, -4.6, 1.2, 0, 2.6, 0.6);
          S.rd = bx('Rounding hardware', FC.lilac, 0, -0.2, 0, 3.0, 0.6); cap('加：ALU；normalize：shift', 'exponent 加減；rounding');
        },
  async (tok, S) => {
          S.sa = bx('Small ALU（Exp A − Exp B）', FC.orange, -3.6, 5.6, 0, 3.4, 0.6); wire([[-4.9, 6.5], [-4.2, 5.9]]); wire([[2.3, 6.5], [-2.6, 5.9]]); cap('把 exponent 拿出來', '做一個比較');
        },
  async (tok, S) => {
          S.sh = bx('Shift right', FC.mint, -1.6, 3.6, 0, 2.0, 0.6); cap('這個比較小', '這個就要 right shift');
        },
  async (tok, S) => {
          S.m1 = muxB('MUX', -1.6, 4.6, 0.6, 1.4); wire([[-2.9, 6.5], [-1.9, 4.9]]); wire([[4.3, 6.5], [-1.3, 4.9]]); cap('不知道是誰要被 shift', '前面一個 2-to-1 MUX 選');
        },
  async (tok, S) => {
          S.m2 = muxB('MUX', 1.8, 4.0, 0.6, 1.4); wire([[-2.9, 6.5], [1.5, 4.3]]); wire([[4.3, 6.5], [2.1, 4.3]]); wire([[-1.6, 3.3], [-0.8, 2.75]]); wire([[1.8, 3.7], [0.8, 2.75]]);
          cap('不 shift 的也可能是 A 或 B', '也要一個 2-to-1 MUX');
        },
  async (tok, S) => {
          S.ctl = bx('Control', FC.dark, -5.2, 4.2, 0, 1.6, 0.6); wire([[-3.6, 5.3], [-5.0, 4.5]]); cap('control logic', 'exponent 相減就知道誰小');
        },
  async (tok, S) => {
          S.ea = -2; S.eb = -1; relbl(S.A[1], 'Exp A = −2'); relbl(S.B[1], 'Exp B = −1'); relbl(S.A[2], '−1.110'); relbl(S.B[2], '1.000');
          relbl(S.m1, '0'); relbl(S.m2, '1'); glow(S.m1, HL); glow(S.m2, HL); cap('左邊比較小：左 MUX 選 0', '右 MUX 選 1');
        },
  async (tok, S) => {
          const d = S.eb - S.ea; relbl(S.sa, 'Small ALU：差 = ' + d); relbl(S.sh, 'Shift right ' + d + ' → −0.111'); ok(d === 1, -3.6, 2.9, 'exponent difference = 1 → 右移 1 位 ✓'); cap('shift 多少位？', 'exponent difference 告訴它');
        },
  async (tok, S) => {
          glow(S.big, HL); relbl(S.big, 'Big ALU：0.001'); cap('big ALU 做加減', 'mantissa 比 precision 更大');
        },
  async (tok, S) => {
          glow(S.big, null); S.m3 = muxB('0', 0, 1.8, 0.45, 0.9); S.m3.rotation.z = Math.PI / 2; S.nm.position.y = 1.1; cap('這個 2-to-1 MUX', '正常狀況選 0');
        },
  async (tok, S) => {
          glow(S.nm, HL); relbl(S.nm, 'Shift left 3 → 1.000'); relbl(S.id, 'Exp −1 − 3 = −4'); glow(S.id, HL); cap('mantissa 不是 normalized form', '做 shift，exponent 跟著調');
        },
  async (tok, S) => {
          glow(S.nm, null); glow(S.id, null); glow(S.rd, HL); S.loop = wire([[1.6, -0.2], [3.0, -0.2], [3.0, 1.8], [0.5, 1.8]], FC.red); sm('rounding 又進位 → MUX 選 1', 4.2, 0.8);
          cap('rounding 之後又進位', 'MUX 選 1，再做一次');
        },
  async (tok, S) => {
          glow(S.rd, null); cap('用 MUX 控制不同 path', 'algorithm 對應到 hardware');
        },
  async (tok, S) => {
          S.m4 = muxB('MUX', -4.6, 3.0, 0.6, 1.2); wire([[-4.9, 6.5], [-4.75, 3.6]]); wire([[2.3, 6.5], [-4.45, 3.6]]); cap('這邊也有一個 2-to-1 MUX', '做什麼的？');
        },
  async (tok, S) => {
          relbl(S.m4, '大'); glow(S.m4, HL); ok(Math.max(S.ea, S.eb) === -1 && 1.0 * 2 ** -4 === 0.5 - 0.4375, -4.6, -0.6, '選 Exp = −1 → normalize 後 −4：1.000 × 2⁻⁴ = 0.0625 ✓'); cap('選比較大的 exponent', '小的已經變成跟大的一樣');
        }
]);
scene('nuB-13a-pipe', "13A：切成幾個 stage", CAM, [
  async (tok, S) => {
          S.one = bx('浮點加法：一整塊', FC.orange, 0, 4.6, 0, 9.0, 0.8); cap('floating point 很複雜', '比 integer 加法複雜很多');
        },
  async (tok, S) => {
          S.clk = bad('一個 cycle → clock period 拉很長', 0, 3.4); cap('可能沒辦法一個 cycle 做完', 'clock period 拉很長');
        },
  async (tok, S) => {
          gone(S.one, S.clk); S.st = ['align', 'add', 'normalize', 'round'].map((t, i) => bx(t, [FC.sky, FC.orange, FC.mint, FC.lilac][i], -4.5 + i * 3.0, 4.6, 0, 2.6, 0.8));
          for (let i = 0; i < 4; i++) { glow(S.st[i], HL); await wt(tok, 350); glow(S.st[i], null); } cap('pipeline', '切成幾個 stage');
        },
  async (tok, S) => {
          good('通常把浮點運算 pipeline', 0, 3.2); cap('花的時間比較長', '通常 pipeline；乘法下次講');
        }
]);
// ════════ gBaVGirWTlU §12（第 12B 講課堂問答：two's complement 要用減法比大小；exponent 為什麼減 127） ════════
const tc4 = (n) => (((n % 16) + 16) % 16).toString(2).padStart(4, '0');
const fromTc4 = (b) => parseInt(b, 2) - (b[0] === '1' ? 16 : 0);
const magGT = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { gt: a[i] === '1', at: i }; return { gt: false, at: -1 }; };   // a plain comparator: first different bit from the left decides
const brow4 = (bits, x, y, w = 0.62) => [...bits].map((b, i) => bx(b, b === '1' ? FC.blue : FC.sky, x + i * w, y, 0, w - 0.07, 0.5, 0.5));
function cmpPair(S, a, b) {
  const x = -1.0, A = tc4(a), B = tc4(b);
  S.p = [brow4(A, x, 5.3), brow4(B, x, 4.6), hd('A', x - 0.9, 5.3), hd('B', x - 0.9, 4.6), sm(A + ' = ' + fromTc4(A), x + 3.6, 5.3), sm(B + ' = ' + fromTc4(B), x + 3.6, 4.6)];
  return { A, B, ra: S.p[0], rb: S.p[1] };
}
scene('nuB-12b-cmpqa', "12B 問答：two's complement 用減法比大小；exponent 減 127", CAM, [
  async (tok, S) => {   // 2261 比大小
    S.h = hd("two's complement 的數怎麼比大小？", 0, 6.6);
    S.q = cmpPair(S, -1, 7); S.n4 = small(note('4 bits 示意', 5.4, 6.6), 10);
    cap("這是 two's complement 的表示法", '要比大小，要怎麼比？');
  },
  async (tok, S) => {   // 2281 直接用 comparator
    const r = magGT(S.q.A, S.q.B); glow(S.q.ra[r.at], HL); glow(S.q.rb[r.at], HL);
    S.w = bad('比較器從最高位比：1 > 0 → 說 A 比較大 ✘（' + fromTc4(S.q.A) + ' < ' + fromTc4(S.q.B) + '）', 0, 3.6);
    cap('直接丟進比較器', '第一個 bit 比較大，就說它大 → 不對');
  },
  async (tok, S) => {   // 2306 用減法器
    const d = fromTc4(S.q.A) - fromTc4(S.q.B), D = tc4(d);
    S.d = [brow4(D, -1.0, 2.8), hd('A − B', -2.2, 2.8)];
    S.d.push(ok(D === '1000' && d < 0, 0, 2.0, 'A − B = ' + D + ' = ' + d + '，是負的 → A 比較小 ✓'));
    cap('要用減法器', '減完看是正數還是負數');
  },
  async (tok, S) => {   // 2320 −8 與 −7
    gone(S.p, S.w, S.d);
    S.q = cmpPair(S, -8, -7);
    const d = -8 - (-7), D = tc4(d);
    S.d = [sm('sign bit 都是 1：看 sign 也分不出來', 0, 3.6), brow4(D, -1.0, 2.8), hd('A − B', -2.2, 2.8), ok(fromTc4(D) === -1, 0, 2.0, 'A − B = ' + D + ' = ' + d + ' < 0 → −8 < −7 ✓')];
    cap('−8 跟 −7 前面都是負的', '一定要減完再看正負');
  },
  async (tok, S) => {   // 2342 真正的比較器
    gone(S.p, S.d); S.q = null;
    const A = '0110', B = '0101', x = -1.0;
    S.p = [brow4(A, x, 5.3), brow4(B, x, 4.6), sm('magnitude（無號）', x + 3.8, 5.0)];
    const r = magGT(A, B);
    for (let i = 0; i <= r.at; i++) { glow(S.p[0][i], i === r.at ? OKG : HL); glow(S.p[1][i], i === r.at ? OKG : HL); await wt(tok, 450); }
    S.d = [good('比較器：從最高位往下，第 ' + (r.at + 1) + ' 個 bit 不同就決定 → 很快', 0, 3.6), sm('後面的 bit 不用再比', 0, 2.9)];
    cap('比較器從最高位開始比', '只比 magnitude，速度比較快');
  },
  async (tok, S) => {   // 2399 exponent 為什麼減 127
    gone(S.p, S.d, S.n4); txt(S.h, 'exponent 為什麼要減 127？');
    const sx = (e) => -5.5 + e * 11 / 255;
    S.n = [bx('', '#efb4b4', (sx(0) + sx(126)) / 2, 4.2, 0, sx(126) - sx(0), 0.3, 0.3), bx('', FC.mint, (sx(128) + sx(255)) / 2, 4.2, 0, sx(255) - sx(128), 0.3, 0.3), bx('', FC.gold, sx(127), 4.2, 0, 0.18, 0.5, 0.35)];
    [[0, -127], [127, 0], [255, 128]].forEach(([e, v]) => { S.n.push(sm('E = ' + e, sx(e), 4.75), small(hd(String(e - 127), sx(e), 3.6), 10)); });
    S.n.push(sm('負的 exponent', sx(63), 3.0), sm('正的 exponent', sx(191), 3.0));
    cap('8 bits 的 exponent：0 ～ 255', '前面 127 個位置要留給負的');
  },
  async (tok, S) => {   // 2418 真正的值
    const e = 104 - 127;
    ok(e === -23, 0, 2.2, '真正的值 = E − 127，例：E = 104 → ' + e + ' ✓');
    cap('所以存的 E 減掉 127', '才是真正的 exponent');
  },
]);

  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'cpu-time', 'amdahl'].concat(FRAG.map((f) => f[0])),
    stop() { run++; },
  };
}
