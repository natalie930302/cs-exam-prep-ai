// 計算機組織 第2章：指令集架構 ISA（MIPS）。
// 前半跟著黃婷婷第 4A 講（效能：CPU time、CPI、影響因素、power wall、multi-core、SPEC）；
// 後半依 Patterson & Hennessy 第 2 章例題（暫存器、lw/sw、R/I/J 格式、分支、迴圈、procedure call、定址模式）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  let run = 0;
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
  function code(lines, x, yTop, dy = 0.5, z = 0, px = 11) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO, { fontSize: px + 'px' }); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await W(tok, ms / steps); } }
  function line(pts, color = '#8a7a5c') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V3(...p))), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function setBar(m, h, base = 0) { m.scale.y = Math.max(0.001, h); m.position.y = base + h / 2; }
  function growBar(tok, m, h, ms, base = 0) { const h0 = m.scale.y; return anim(tok, ms, (t) => setBar(m, h0 + (h - h0) * t, base)); }
  const bin = (v, n) => { const M = 2 ** n; return (((v % M) + M) % M).toString(2).padStart(n, '0'); };
  const hex8 = (b) => '0x' + b.match(/.{4}/g).map((q) => parseInt(q, 2).toString(16).toUpperCase()).join('');
  const grp = (b) => b.match(/.{1,4}/g).join(' ');

  // ───────────────────────── MIPS：暫存器、組譯、模擬 ─────────────────────────
  const RN = ['$zero', '$at', '$v0', '$v1', '$a0', '$a1', '$a2', '$a3', '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
    '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7', '$t8', '$t9', '$k0', '$k1', '$gp', '$sp', '$fp', '$ra'];
  function rIdx(s) { s = String(s).trim(); if (/^\$\d+$/.test(s)) { const n = +s.slice(1); return n < 32 ? n : -1; } return RN.indexOf(s); }
  const RCOL = (i) => (i === 0 ? '#bdb3a2' : i <= 3 ? (i === 1 ? '#bdb3a2' : '#4b9ee2') : i <= 7 ? '#9b7ef4' : i <= 15 || i === 24 || i === 25 ? '#dd8238' : i <= 23 ? '#2fc092' : i <= 27 ? '#bdb3a2' : '#c08a1f');
  const RFUN = { add: 32, sub: 34, and: 36, or: 37, nor: 39, slt: 42, sll: 0, srl: 2, jr: 8 };
  const IOP = { addi: 8, slti: 10, andi: 12, ori: 13, lui: 15, lw: 35, sw: 43, beq: 4, bne: 5 };
  const JOP = { j: 2, jal: 3 };
  function assemble(text) {
    const m = String(text).trim().match(/^(\w+)\s*(.*)$/);
    if (!m) throw new Error('請輸入一行 MIPS 指令，例如 add $t0, $s1, $s2');
    const op = m[1].toLowerCase();
    const a = m[2].split(',').map((s) => s.trim()).filter(Boolean);
    const need = (k) => { if (a.length !== k) throw new Error(op + ' 需要 ' + k + ' 個運算元'); };
    const R = (s) => { const i = rIdx(s); if (i < 0) throw new Error('不認得暫存器「' + s + '」（用 $t0、$s1 或 $8 這種寫法）'); return i; };
    const N = (s) => { const v = Number(s); if (!Number.isInteger(v)) throw new Error('「' + s + '」要是整數'); return v; };
    if (op in RFUN) {
      let rs = 0, rt = 0, rd = 0, sh = 0;
      if (op === 'jr') { need(1); rs = R(a[0]); }
      else if (op === 'sll' || op === 'srl') { need(3); rd = R(a[0]); rt = R(a[1]); sh = N(a[2]); if (sh < 0 || sh > 31) throw new Error('shamt 只有 5 bits：0 ～ 31'); }
      else { need(3); rd = R(a[0]); rs = R(a[1]); rt = R(a[2]); }
      return { op, type: 'R', fields: [['op', 6, 0], ['rs', 5, rs], ['rt', 5, rt], ['rd', 5, rd], ['shamt', 5, sh], ['funct', 6, RFUN[op]]] };
    }
    if (op in IOP) {
      let rs = 0, rt = 0, im = 0;
      if (op === 'lw' || op === 'sw') { need(2); rt = R(a[0]); const mm = a[1].replace(/\s/g, '').match(/^(-?\d+)\((\$\w+)\)$/); if (!mm) throw new Error(op + ' 的位址要寫成 offset($暫存器)，例如 32($s3)'); im = +mm[1]; rs = R(mm[2]); }
      else if (op === 'beq' || op === 'bne') { need(3); rs = R(a[0]); rt = R(a[1]); im = N(a[2]); }
      else if (op === 'lui') { need(2); rt = R(a[0]); im = N(a[1]); }
      else { need(3); rt = R(a[0]); rs = R(a[1]); im = N(a[2]); }
      if (im < -32768 || im > 65535) throw new Error('立即值只有 16 bits（−32768 ～ 65535）');
      return { op, type: 'I', fields: [['op', 6, IOP[op]], ['rs', 5, rs], ['rt', 5, rt], [op === 'beq' || op === 'bne' ? 'offset' : op === 'lw' || op === 'sw' ? 'address' : 'immediate', 16, im]] };
    }
    if (op in JOP) {
      need(1); const t = N(a[0]);
      if (t % 4 || t < 0 || t >= 2 ** 28) throw new Error('跳躍目標要是 4 的倍數、而且在 0 ～ 2²⁸ 內（pseudodirect）');
      return { op, type: 'J', fields: [['op', 6, JOP[op]], ['address', 26, t / 4]], target: t };
    }
    throw new Error('這裡支援：add sub and or nor slt sll srl jr addi slti andi ori lui lw sw beq bne j jal');
  }
  const bitsOf = (enc) => enc.fields.map(([, w, v]) => bin(v, w)).join('');
  function disassemble(u) {
    const b = bin(u, 32);
    const op = parseInt(b.slice(0, 6), 2), rs = parseInt(b.slice(6, 11), 2), rt = parseInt(b.slice(11, 16), 2);
    const rd = parseInt(b.slice(16, 21), 2), sh = parseInt(b.slice(21, 26), 2), fn = parseInt(b.slice(26), 2);
    let im = parseInt(b.slice(16), 2); const sim = im >= 32768 ? im - 65536 : im;
    if (op === 0) {
      const name = Object.keys(RFUN).find((k) => RFUN[k] === fn);
      if (!name) return null;
      if (name === 'jr') return 'jr ' + RN[rs];
      if (name === 'sll' || name === 'srl') return name + ' ' + RN[rd] + ', ' + RN[rt] + ', ' + sh;
      return name + ' ' + RN[rd] + ', ' + RN[rs] + ', ' + RN[rt];
    }
    const jn = Object.keys(JOP).find((k) => JOP[k] === op);
    if (jn) return jn + ' ' + parseInt(b.slice(6), 2) * 4;
    const n = Object.keys(IOP).find((k) => IOP[k] === op);
    if (!n) return null;
    if (n === 'lw' || n === 'sw') return n + ' ' + RN[rt] + ', ' + sim + '(' + RN[rs] + ')';
    if (n === 'beq' || n === 'bne') return n + ' ' + RN[rs] + ', ' + RN[rt] + ', ' + sim;
    if (n === 'lui') return 'lui ' + RN[rt] + ', ' + im;
    return n + ' ' + RN[rt] + ', ' + RN[rs] + ', ' + (n === 'andi' || n === 'ori' ? im : sim);
  }
  const FCOL = ['#9b7ef4', '#4b9ee2', '#2fc092', '#dd8238', '#c08a1f', '#e55a9b'];
  const FCOL0 = ['#d9cdfb', '#c6def5', '#c2ecdc', '#f4d3b5', '#ead6a6', '#f6c4dc'];
  function fieldRow(enc, y = 0.4, w = 0.38) {
    const widths = enc.fields.map((f) => f[1]);
    const starts = []; let s = 0; for (const wd of widths) { starts.push(s); s += wd; }
    const fOf = (i) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= i) k++; return k; };
    const n = 32, gaps = starts.slice(1), gapW = w * 0.45, total = (n - 1) * w + gaps.length * gapW;
    const xs = []; for (let i = 0; i < n; i++) xs.push(-total / 2 + i * w + gaps.filter((g) => g <= i).length * gapW);
    const ms = xs.map((x, i) => { const m = lab.box(FCOL0[fOf(i)], [w * 0.86, 0.3, w * 0.86]); m.userData.lbl = small(lab.label('0', 'val'), 10); m.add(m.userData.lbl); m.position.set(x, y, 0); lab.world.add(m); return m; });
    const mid = (k) => (xs[starts[k]] + xs[starts[k] + widths[k] - 1]) / 2;
    return { ms, xs, starts, widths, mid, fOf, set(bits, upto = 99) {
      bits.split('').forEach((b, i) => { const k = fOf(i); const on = k < upto; relabel(ms[i], on ? b : '·'); tint(ms[i], on && b === '1' ? FCOL[k] : FCOL0[k]); });
    } };
  }

  // ── 小模擬器 ──
  const BASE = 80000;
  function parseProg(src) {
    const prog = [], labels = {}, disp = [];
    for (const raw of src.split('\n')) {
      const cut = raw.indexOf('#');
      let body = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
      const cap = cut >= 0 ? raw.slice(cut + 1).trim() : '';
      const m = body.match(/^(\w+):\s*(.*)$/);
      if (m) { labels[m[1]] = prog.length; body = m[2].trim(); disp.push(m[1] + ':'); if (!body) continue; }
      if (!body) continue;
      const sp = body.indexOf(' ');
      const op = sp < 0 ? body : body.slice(0, sp);
      const args = sp < 0 ? [] : body.slice(sp + 1).split(',').map((x) => x.trim());
      if (m) disp.pop();
      prog.push({ op, args, text: body, cap, disp: disp.length, label: m ? m[1] : null });
      disp.push((m ? (m[1] + ':').padEnd(6) : '      ') + op.padEnd(5) + args.join(', '));
    }
    return { prog, labels, disp };
  }
  function exec(S) {
    const ins = S.prog[S.pc]; const a = ins.args; const R = S.reg;
    const out = { reads: [], writes: [], mem: null, desc: '' };
    const rd = (s) => { const i = rIdx(s); out.reads.push(i); return R[i]; };
    const wr = (s, v) => { const i = rIdx(s); if (i !== 0) R[i] = v | 0; out.writes.push(i); };
    const memop = (s) => { const m = s.replace(/\s/g, '').match(/^(-?\d+)\((\$\w+)\)$/); return { off: +m[1], reg: m[2] }; };
    let next = S.pc + 1;
    const bin3 = (f, sym) => { const x = rd(a[1]), y = rd(a[2]); const v = f(x, y); wr(a[0], v); out.desc = a[0] + ' = ' + x + ' ' + sym + ' ' + y + ' = ' + (v | 0); };
    const imm3 = (f, sym) => { const x = rd(a[1]), k = Number(a[2]); const v = f(x, k); wr(a[0], v); out.desc = a[0] + ' = ' + x + ' ' + sym + ' ' + k + ' = ' + (v | 0); };
    switch (ins.op) {
      case 'add': bin3((x, y) => x + y, '+'); break;
      case 'sub': bin3((x, y) => x - y, '−'); break;
      case 'and': bin3((x, y) => x & y, '&'); break;
      case 'or': bin3((x, y) => x | y, '|'); break;
      case 'mul': bin3((x, y) => x * y, '×'); break;
      case 'slt': { const x = rd(a[1]), y = rd(a[2]); wr(a[0], x < y ? 1 : 0); out.desc = a[0] + ' = (' + x + ' < ' + y + ') ? 1 : 0 = ' + (x < y ? 1 : 0); break; }
      case 'addi': imm3((x, k) => x + k, '+'); break;
      case 'andi': imm3((x, k) => x & k, '&'); break;
      case 'ori': imm3((x, k) => x | k, '|'); break;
      case 'slti': { const x = rd(a[1]), k = Number(a[2]); wr(a[0], x < k ? 1 : 0); out.desc = a[0] + ' = (' + x + ' < ' + k + ') ? 1 : 0 = ' + (x < k ? 1 : 0); break; }
      case 'sll': imm3((x, k) => x << k, '<<'); break;
      case 'lui': { const k = Number(a[1]); wr(a[0], k << 16); out.desc = a[0] + ' = ' + k + ' << 16 = ' + (k << 16); break; }
      case 'lw': case 'sw': {
        const { off, reg } = memop(a[1]); const base = rd(reg); const addr = base + off;
        if (ins.op === 'lw') { const v = S.mem[addr] || 0; wr(a[0], v); out.mem = { addr, read: true }; out.desc = a[0] + ' = Mem[' + base + ' + ' + off + '] = Mem[' + addr + '] = ' + v; }
        else { const v = rd(a[0]); S.mem[addr] = v; out.mem = { addr, write: true }; out.desc = 'Mem[' + base + ' + ' + off + '] = Mem[' + addr + '] ← ' + v; }
        break;
      }
      case 'beq': case 'bne': {
        const x = rd(a[0]), y = rd(a[1]); const take = ins.op === 'beq' ? x === y : x !== y;
        if (take) next = S.labels[a[2]];
        out.branch = take; out.desc = x + (x === y ? ' = ' : ' ≠ ') + y + ' → ' + (take ? '跳到 ' + a[2] : '不跳，往下');
        break;
      }
      case 'j': next = S.labels[a[0]]; out.desc = 'PC = ' + a[0] + '（' + (BASE + 4 * next) + '）'; out.branch = true; break;
      case 'jal': R[31] = BASE + 4 * (S.pc + 1); out.writes.push(31); next = S.labels[a[0]]; out.desc = '$ra = PC + 4 = ' + R[31] + '，跳到 ' + a[0]; out.branch = true; break;
      case 'jr': { const t = rd(a[0]); next = (t - BASE) / 4; out.desc = 'PC = ' + a[0] + ' = ' + t; out.branch = true; break; }
      default: out.desc = '（不支援 ' + ins.op + '）';
    }
    S.pc = next; S.steps++;
    return out;
  }
  const PRESETS = {
    expr: { name: 'f = (g + h) − (i + j)', regs: { $s1: 5, $s2: 3, $s3: 4, $s4: 2 }, win: 120,
      src: 'add $t0, $s1, $s2   # 暫存器 $t0 = g + h\nadd $t1, $s3, $s4   # 暫存器 $t1 = i + j\nsub $s0, $t0, $t1   # f = $t0 − $t1' },
    array: { name: 'A[12] = h + A[8]', regs: { $s2: 5, $s3: 100 }, mem: { 132: 30 }, win: 120, names: (ad) => 'A[' + (ad - 100) / 4 + ']',
      src: 'lw  $t0, 32($s3)    # 載入 A[8]：offset = 8 × 4 = 32\nadd $t0, $s2, $t0   # h + A[8]\nsw  $t0, 48($s3)    # 存回 A[12]：offset = 12 × 4 = 48' },
    ifelse: { name: 'if (i == j) f = g + h; else f = g − h;', regs: { $s1: 7, $s2: 3, $s3: 4, $s4: 4 }, win: 120,
      src: '  bne $s3, $s4, Else   # 條件反過來寫：i ≠ j 就跳 Else\n  add $s0, $s1, $s2    # then：f = g + h\n  j   Exit             # 跳過 else\nElse:\n  sub $s0, $s1, $s2    # else：f = g − h\nExit:' },
    loop: { name: 'while (save[i] == k) i += 1;', regs: { $s3: 0, $s5: 5, $s6: 200 }, mem: { 200: 5, 204: 5, 208: 5, 212: 7, 216: 5, 220: 5 }, win: 200, names: (ad) => 'save[' + (ad - 200) / 4 + ']',
      src: 'Loop:\n  sll  $t1, $s3, 2      # $t1 = i × 4（byte offset）\n  add  $t1, $t1, $s6    # $t1 = save[i] 的位址\n  lw   $t0, 0($t1)      # $t0 = save[i]\n  bne  $t0, $s5, Exit   # save[i] ≠ k 就離開\n  addi $s3, $s3, 1      # i = i + 1\n  j    Loop             # 回到開頭\nExit:' },
    leaf: { name: 'leaf_example(g, h, i, j)', regs: { $a0: 5, $a1: 3, $a2: 4, $a3: 2, $s0: 11, $t0: 22, $t1: 33, $sp: 1000 }, win: 968,
      src: '  jal  leaf           # 呼叫：$ra = PC + 4\n  j    Done\nleaf:\n  addi $sp, $sp, -12   # 堆疊往下挪 3 個 word\n  sw   $t1, 8($sp)     # 存舊的 $t1\n  sw   $t0, 4($sp)     # 存舊的 $t0\n  sw   $s0, 0($sp)     # 存舊的 $s0\n  add  $t0, $a0, $a1   # $t0 = g + h\n  add  $t1, $a2, $a3   # $t1 = i + j\n  sub  $s0, $t0, $t1   # f = $t0 − $t1\n  add  $v0, $s0, $zero # 回傳值放 $v0\n  lw   $s0, 0($sp)     # 還原 $s0\n  lw   $t0, 4($sp)     # 還原 $t0\n  lw   $t1, 8($sp)     # 還原 $t1\n  addi $sp, $sp, 12    # 堆疊縮回\n  jr   $ra             # 回到呼叫者\nDone:' },
    fact: { name: 'fact(3)：遞迴 procedure', regs: { $sp: 1000 }, win: 968,
      src: '  addi $a0, $zero, 3  # n = 3\n  jal  fact           # 呼叫 fact(3)\n  j    Done\nfact:\n  addi $sp, $sp, -8   # 挪 2 個 word\n  sw   $ra, 4($sp)    # 存返回位址\n  sw   $a0, 0($sp)    # 存 n\n  slti $t0, $a0, 1    # n < 1 ?\n  beq  $t0, $zero, L1 # n ≥ 1 → 去 L1\n  addi $v0, $zero, 1  # 回傳 1\n  addi $sp, $sp, 8    # 彈出\n  jr   $ra            # 返回\nL1:\n  addi $a0, $a0, -1   # n − 1\n  jal  fact           # 呼叫 fact(n − 1)\n  lw   $a0, 0($sp)    # 還原 n\n  lw   $ra, 4($sp)    # 還原返回位址\n  addi $sp, $sp, 8    # 彈出\n  mul  $v0, $a0, $v0  # n × fact(n − 1)\n  jr   $ra            # 返回' + '\nDone:' },
  };
  const RX = (c) => -0.4 + c * 0.98, RY = (r) => 6.3 - r * 0.95;
  function buildSim(key, over) {
    const P = PRESETS[key];
    const { prog, labels, disp } = parseProg(P.src);
    const S = { prog, labels, reg: Array(32).fill(0), mem: { ...(P.mem || {}) }, pc: 0, steps: 0, key };
    S.reg[29] = 1000;
    for (const [k, v] of Object.entries({ ...P.regs, ...(over || {}) })) S.reg[rIdx(k)] = v;
    const V = { S, regs: [], mem: [], win: [] };
    for (let i = 0; i < 32; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      const m = cube(S.reg[i], RCOL(i), [0.8, 0.45, 0.6], RX(c), RY(r), 0);
      small(m.userData.lbl, 10);
      small(tag(RN[i], 'idx', RX(c), RY(r) + 0.42), 9);
      V.regs.push(m);
    }
    for (let k = 0; k < 8; k++) {
      const ad = P.win + 4 * k;
      V.win.push(ad);
      const m = cube(S.mem[ad] || 0, '#e9dcc4', [0.8, 0.45, 0.6], RX(k), 1.35, 0);
      small(m.userData.lbl, 10);
      small(tag(String(ad), 'idx', RX(k), 0.85), 9);
      if (P.names) small(tag(P.names(ad), 'idx', RX(k), 0.5), 9);
      V.mem.push(m);
    }
    small(tag('Memory（byte address）', 'ptr', RX(3.5), 2.0), 10);
    V.sp = tag('$sp', 'ptr alt', 0, 0.15);
    const px = disp.length > 12 ? 10 : 11, dy = disp.length > 12 ? 0.36 : 0.46;
    V.code = code(disp, -4.6, 6.6, dy, 0, px);
    V.pcTag = tag('', 'ptr', -4.6, 7.25);
    V.refresh = () => {
      V.regs.forEach((m, i) => relabel(m, S.reg[i]));
      V.mem.forEach((m, k) => relabel(m, S.mem[V.win[k]] || 0));
      const si = V.win.indexOf(S.reg[29]);
      V.sp.element.style.visibility = si >= 0 && (key === 'leaf' || key === 'fact') ? '' : 'hidden';
      if (si >= 0) V.sp.position.set(RX(si), 0.15, 0.6);
      const ins = S.prog[S.pc];
      V.code.hl(ins ? ins.disp : -1);
      txt(V.pcTag, ins ? 'PC = ' + (BASE + 4 * S.pc) : 'PC = ' + (BASE + 4 * S.pc) + '（結束）');
    };
    V.refresh();
    return V;
  }
  const regPos = (i) => V3(RX(i % 8), RY(Math.floor(i / 8)), 0.5);
  async function simStep(V, tok, pace, talk) {
    const S = V.S;
    const ins = S.prog[S.pc];
    if (!ins) return false;
    V.code.hl(ins.disp);
    const out = exec(S);
    out.reads.forEach((i) => glow(V.regs[i], GOLD));
    let mc = null;
    if (out.mem) {
      const k = V.win.indexOf(out.mem.addr);
      if (k >= 0) {
        glow(V.mem[k], out.mem.read ? GOLD : GREEN);
        const v = out.mem.read ? S.mem[out.mem.addr] || 0 : S.mem[out.mem.addr];
        if (out.mem.read) { const to = regPos(out.writes[0]); mc = cube(v, '#c08a1f', [0.5, 0.35, 0.4], RX(k), 1.35, 0.6); move(mc, to.x, to.y, 0.6); }
        else { const from = regPos(rIdx(ins.args[0])); mc = cube(v, '#2fc092', [0.5, 0.35, 0.4], from.x, from.y, 0.6); move(mc, RX(k), 1.35, 0.6); }
      }
    }
    if (talk) say(ins.cap || ins.text, out.desc);
    log(ins.text + '　→　' + out.desc);
    await W(tok, pace * 0.45);
    V.refresh();
    out.writes.forEach((i) => { glow(V.regs[i], GREEN); const m = V.regs[i]; const p = m.position.clone(); m.position.y += 0.5; move(m, p.x, p.y, p.z); });
    if (mc) kill(mc);
    await W(tok, pace * 0.55);
    V.regs.forEach((m) => glow(m, null)); V.mem.forEach((m) => glow(m, null));
    return true;
  }

  // ───────────────────────── 模式 1：MIPS 單步執行 ─────────────────────────
  const sim = { key: 'expr' };
  function enterSim() {
    fresh([0.6, 3.7, 13.2], [0.6, 3.7, 0]);
    controls('<select id="sPre">' + Object.keys(PRESETS).map((k) => '<option value="' + k + '">' + PRESETS[k].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="sStep">執行一行</button><button id="sRun">全部跑完</button><button id="sReset">重來</button>');
    $('sPre').value = sim.key;
    $('sPre').onchange = (e) => { sim.key = e.target.value; enterSim(); };
    sim.V = buildSim(sim.key);
    on('sReset', () => enterSim());
    let busy = false;
    const step = async (t) => {
      if (!sim.V.S.prog[sim.V.S.pc]) { log('程式已經結束（PC 走到最後）。按「重來」再跑一次。', true); return false; }
      if (sim.V.S.steps > 200) { log('超過 200 步，停下來（可能是無窮迴圈）', true); return false; }
      await simStep(sim.V, t, 700, false); upd(); return true;
    };
    on('sStep', () => { if (busy) return; busy = true; go(step(newRun()).finally(() => { busy = false; })); });
    on('sRun', () => { if (busy) return; busy = true; go((async (t) => { while (await step(t)); })(newRun()).finally(() => { busy = false; })); });
    const upd = () => {
      const S = sim.V.S;
      setState(PRESETS[sim.key].name, [['PC', String(BASE + 4 * S.pc)], ['已執行', S.steps + ' 個指令'], ['$v0', String(S.reg[2])], ['$sp', String(S.reg[29])], ['$ra', String(S.reg[31])]],
        sim.key === 'fact' || sim.key === 'leaf' ? 'jal：$ra = PC + 4 再跳；jr $ra 回去<br>$sp 往下長：先 addi $sp, $sp, −k 再 sw' : 'MIPS 是 load-store：算術只能用暫存器，記憶體只能用 lw / sw');
    };
    upd();
    log('顏色：$a 參數（紫）、$v 回傳（藍）、$t 臨時（橘）、$s 保存（綠）、$sp/$ra 等（金）。');
  }

  // ───────────────────────── 模式 2：指令編碼 ─────────────────────────
  const enc = { text: 'add $t0, $s1, $s2' };
  function enterEncode() {
    fresh([0, 3.4, 12.5], [0, 1.6, 0]);
    controls('<input id="eT" value="' + enc.text + '" style="width:190px"><button class="primary" id="eGo">組譯（assembly → 機器碼）</button>'
      + '<input id="eH" value="" placeholder="0x02324020" style="width:100px"><button id="eDec">反組譯</button>'
      + '<select id="ePre"><option value="">課本例子…</option><option>add $t0, $s1, $s2</option><option>sub $t0, $s1, $s2</option><option>lw $t0, 32($s3)</option><option>sw $t0, 1200($t1)</option><option>addi $s3, $s3, 1</option><option>sll $t2, $s0, 4</option><option>beq $s1, $s2, 25</option><option>bne $t0, $s5, 2</option><option>j 80000</option><option>jr $ra</option><option>lui $s0, 61</option></select>');
    on('eGo', () => doEncode($('eT').value));
    on('eDec', () => {
      const h = String($('eH').value).trim().replace(/^0x/i, '');
      if (!/^[0-9a-f]{1,8}$/i.test(h)) { log('請輸入 1–8 位 hex，例如 0x02324020', true); return; }
      const s = disassemble(parseInt(h, 16));
      if (!s) { log('這個 opcode / funct 不在支援的指令裡', true); return; }
      $('eT').value = s; doEncode(s); log('0x' + h.toUpperCase() + ' 反組譯 → ' + s);
    });
    $('ePre').onchange = (e) => { if (e.target.value) { $('eT').value = e.target.value; doEncode(e.target.value); } };
    doEncode(enc.text);
  }
  function doEncode(text) {
    let e;
    try { e = assemble(text); } catch (err) { log(err.message, true); return; }
    enc.text = text;
    lab.clear();
    const row = fieldRow(e);
    const bits = bitsOf(e);
    row.set(bits);
    e.fields.forEach(([n, w, v], k) => {
      tag(n + '（' + w + '）', 'ptr', row.mid(k), 1.3);
      const nm = (n === 'rs' || n === 'rt' || n === 'rd') ? RN[v] + ' = ' + v : String(v);
      tag(nm, 'idx', row.mid(k), 0, 1.0);
    });
    const hx = hex8(bits);
    tag(text + '  →  ' + hx, 'ptr alt', 0, 2.6);
    if ($('eH')) $('eH').value = hx;
    setState(e.type + '-format：' + e.op, e.fields.map(([n, w, v]) => [n + '（' + w + ' bits）', v + ' = ' + bin(v, w)]),
      hx + '<br>' + (e.type === 'R' ? 'R：op = 0，看 funct 分辨運算；rd 是目的暫存器' : e.type === 'I' ? (e.op === 'beq' || e.op === 'bne' ? 'I：offset 以「指令數」計，目標 = PC + 4 + offset × 4' : 'I：rt 是目的（lw）或來源（sw）；16-bit 立即值 sign-extend') : 'J：26-bit 位址 × 4，接上 PC 最高 4 bits（pseudodirect）'));
    log(text + ' → ' + e.fields.map(([n, , v]) => n + '=' + v).join(' ') + ' → ' + grp(bits) + ' = ' + hx);
  }

  // ───────────────────────── 模式 3：定址模式 ─────────────────────────
  const AM = {
    imm: { name: 'Immediate', ins: 'addi $t0, $s0, 5', note: '運算元就在指令裡（16-bit 立即值）' },
    reg: { name: 'Register', ins: 'add $t0, $s1, $s2', note: '運算元在暫存器裡' },
    base: { name: 'Base（displacement）', ins: 'lw $t0, 32($s3)', note: '位址 = 暫存器 + 常數 offset' },
    pc: { name: 'PC-relative', ins: 'beq $s1, $s2, 2', note: '目標 = (PC + 4) + offset × 4' },
    pseudo: { name: 'Pseudodirect', ins: 'j 80000', note: '目標 = PC 高 4 bits ‖ 26-bit 位址 ‖ 00' },
    direct: { name: 'Direct（非 MIPS）', ins: 'LOAD R1, [136]', note: '指令直接放記憶體位址' },
    indirect: { name: 'Indirect（非 MIPS）', ins: 'LOAD R1, @[136]', note: '記憶體裡放的是「位址的位址」，要讀兩次' },
  };
  const am = { kind: 'base', base: 100, off: 32, pc: 80012 };
  function amLayout() {
    lab.clear();
    const insBox = cube('', '#6e5f49', [6.6, 0.6, 0.6], -2.4, 5.6, 0);
    const insTag = tag('', 'ptr', -2.4, 6.35);
    const regBox = cube('Registers', '#9b7ef4', [2.4, 1.2, 0.8], -4.4, 2.6, 0);
    const pcBox = cube('PC', '#c08a1f', [1.6, 0.8, 0.8], -1.0, 2.6, 0);
    const alu = cube('+', '#dd8238', [1.0, 0.8, 0.8], 1.2, 2.6, 0);
    const memCells = [];
    for (let k = 0; k < 6; k++) { const ad = 124 + 4 * k; memCells.push(cube(ad === 136 ? 140 : ad === 140 ? 77 : ad === 132 ? 30 : 0, '#e9dcc4', [1.4, 0.55, 0.6], 4.8, 0.4 + k * 0.7, 0)); small(tag(String(ad), 'idx', 6.1, 0.4 + k * 0.7), 9); }
    tag('Memory', 'ptr', 4.8, 4.8);
    const res = tag('', 'ptr alt', 1.2, 0.6);
    return { insBox, insTag, regBox, pcBox, alu, memCells, res, cellOf: (ad) => memCells[(ad - 124) / 4] };
  }
  async function amPlay(kind, tok, pace, talk) {
    const L = amLayout();
    const A = AM[kind];
    txt(L.insTag, A.ins);
    if (talk) say(A.name + ' addressing', A.note);
    log(A.name + '：' + A.ins + ' — ' + A.note);
    await W(tok, pace);
    const token = (t, c, x, y) => cube(t, c, [0.7, 0.45, 0.45], x, y, 0.6);
    if (kind === 'imm') {
      glow(L.insBox, GOLD);
      const k = token('5', '#2fc092', 0.2, 5.6); move(k, 1.2, 3.4, 0.6);
      const r = token('$s0', '#9b7ef4', -4.4, 2.6); move(r, 1.2, 3.0, 0.6);
      await W(tok, pace); txt(L.res, '$t0 = $s0 + 5');
      if (talk) say('常數 5 直接從指令拿', '不用另外讀記憶體');
    } else if (kind === 'reg') {
      glow(L.regBox, GOLD);
      const a = token('$s1', '#9b7ef4', -4.4, 2.6), b = token('$s2', '#9b7ef4', -4.4, 2.6);
      move(a, 1.2, 3.4, 0.6); move(b, 1.2, 1.8, 0.6);
      await W(tok, pace); txt(L.res, '$t0 = $s1 + $s2');
      if (talk) say('兩個運算元都從暫存器拿', 'R-format 的 rs、rt');
    } else if (kind === 'base') {
      const a = token('$s3=' + am.base, '#9b7ef4', -4.4, 2.6), b = token(String(am.off), '#2fc092', 0.2, 5.6);
      glow(L.regBox, GOLD); move(a, 0.6, 2.6, 0.6); move(b, 1.8, 2.6, 0.6);
      const ad = am.base + am.off;
      await W(tok, pace); txt(L.res, am.base + ' + ' + am.off + ' = ' + ad);
      if (talk) say('位址 = $s3 + 32 = ' + ad, '');
      const cell = ad >= 124 && ad <= 144 && ad % 4 === 0 ? L.cellOf(ad) : null;
      if (cell) { glow(cell, GOLD); await W(tok, pace * 0.7); const v = token(cell.userData.lbl.element.textContent, '#c08a1f', 4.8, cell.position.y); move(v, -4.4, 3.6, 0.6); if (talk) say('讀 Mem[' + ad + '] 放進 $t0', ''); }
      else log('位址 ' + ad + ' 不在畫面上的記憶體範圍（124 ～ 144）', true);
    } else if (kind === 'pc') {
      glow(L.pcBox, GOLD);
      const a = token('PC+4=' + (am.pc + 4), '#c08a1f', -1.0, 2.6), b = token('2×4', '#2fc092', 0.2, 5.6);
      move(a, 0.4, 2.6, 0.6); move(b, 2.0, 2.6, 0.6);
      await W(tok, pace); txt(L.res, (am.pc + 4) + ' + 8 = ' + (am.pc + 12));
      if (talk) say('分支目標 = PC + 4 + offset × 4', '16-bit offset 以「指令」為單位：±2¹⁵ 個指令');
    } else if (kind === 'pseudo') {
      glow(L.insBox, GOLD);
      const a = token('PC[31:28]', '#c08a1f', -1.0, 2.6), b = token('20000', '#2fc092', 0.2, 5.6), c = token('00', '#bdb3a2', 2.6, 3.6);
      move(a, -0.4, 2.6, 0.6); move(b, 0.6, 2.6, 0.6); move(c, 1.6, 2.6, 0.6);
      await W(tok, pace); txt(L.res, '0000 ‖ 20000 ‖ 00 = 80000');
      if (talk) say('j 的目標：26-bit 欄位 × 4，接上 PC 高 4 bits', '20000 × 4 = 80000');
    } else if (kind === 'direct') {
      glow(L.insBox, GOLD);
      const cell = L.cellOf(136); glow(cell, GOLD);
      const v = token('140', '#c08a1f', 4.8, cell.position.y); move(v, -4.4, 3.6, 0.6);
      await W(tok, pace); txt(L.res, 'R1 = Mem[136] = 140');
      if (talk) say('位址 136 直接寫在指令裡', '讀一次記憶體（MIPS 沒有這種）');
    } else {
      glow(L.insBox, GOLD);
      const c1 = L.cellOf(136); glow(c1, GOLD);
      if (talk) say('先讀 Mem[136] = 140：那是一個位址', '');
      await W(tok, pace);
      const c2 = L.cellOf(140); glow(c2, GREEN);
      const v = token('77', '#c08a1f', 4.8, c2.position.y); move(v, -4.4, 3.6, 0.6);
      await W(tok, pace * 0.6); txt(L.res, 'R1 = Mem[Mem[136]] = Mem[140] = 77');
      if (talk) say('再讀 Mem[140] = 77 才是運算元', '讀兩次記憶體');
    }
    await W(tok, pace);
  }
  function enterAddr() {
    fresh([0, 3.4, 13], [0, 3.0, 0]);
    controls('<select id="amK">' + Object.keys(AM).map((k) => '<option value="' + k + '">' + AM[k].name + '</option>').join('') + '</select>'
      + '<label>$s3 = <input id="amB" type="number" value="' + am.base + '" style="width:60px"></label><label>offset <input id="amO" type="number" value="' + am.off + '" style="width:60px"></label>'
      + '<button class="primary" id="amGo">看它怎麼找運算元</button>');
    $('amK').value = am.kind;
    $('amK').onchange = (e) => { am.kind = e.target.value; go(amPlay(am.kind, newRun(), 900, false)); updAm(); };
    on('amGo', () => {
      const b = Math.round(Number($('amB').value)), o = Math.round(Number($('amO').value));
      if (!isFinite(b) || !isFinite(o) || o < -32768 || o > 32767) { log('offset 是 16-bit signed：−32768 ～ 32767', true); return; }
      am.base = b; am.off = o;
      if (am.kind === 'base' && ((b + o) % 4 !== 0)) log('lw 的位址要是 4 的倍數（word aligned），不然會產生 exception', true);
      go(amPlay(am.kind, newRun(), 900, false)); updAm();
    });
    amLayout(); updAm();
  }
  function updAm() {
    const A = AM[am.kind];
    setState('定址模式：' + A.name, [['範例', A.ins], ['說明', A.note]], 'MIPS 五種：Immediate、Register、Base、PC-relative、Pseudodirect<br>一般 ISA 還有 Direct、Indirect 等');
  }

  // ───────────────────────── 模式 4：CPI 計算（課堂例題） ─────────────────────────
  const cp = { kind: 'class', cpi: [1, 2, 3], s1: [2, 1, 2], s2: [4, 1, 1], ta: 250, ca: 2.0, tb: 500, cb: 1.2 };
  function enterCPI() {
    fresh([0, 3.6, 13.5], [0, 2.4, 0]);
    const inp = (id, v) => '<input id="' + id + '" type="number" step="0.1" value="' + v + '" style="width:48px">';
    controls('<select id="cK"><option value="class">指令類別加權 CPI</option><option value="mach">兩台電腦比快慢</option></select>'
      + (cp.kind === 'class'
        ? 'CPI A/B/C ' + inp('c0', cp.cpi[0]) + inp('c1', cp.cpi[1]) + inp('c2', cp.cpi[2]) + ' 序列1 ' + inp('a0', cp.s1[0]) + inp('a1', cp.s1[1]) + inp('a2', cp.s1[2]) + ' 序列2 ' + inp('b0', cp.s2[0]) + inp('b1', cp.s2[1]) + inp('b2', cp.s2[2])
        : 'A：cycle ' + inp('ta', cp.ta) + 'ps CPI ' + inp('ca', cp.ca) + '　B：cycle ' + inp('tb', cp.tb) + 'ps CPI ' + inp('cb', cp.cb))
      + '<button class="primary" id="cGo">計算</button>');
    $('cK').value = cp.kind;
    $('cK').onchange = (e) => { cp.kind = e.target.value; enterCPI(); };
    on('cGo', () => {
      const g = (id) => Number($(id).value);
      if (cp.kind === 'class') {
        const v = ['c0', 'c1', 'c2', 'a0', 'a1', 'a2', 'b0', 'b1', 'b2'].map(g);
        if (v.some((x) => !isFinite(x) || x < 0) || v.slice(3).some((x) => !Number.isInteger(x) || x > 8)) { log('CPI 要 ≥ 0；指令個數要是 0 ～ 8 的整數（畫面放得下）', true); return; }
        cp.cpi = v.slice(0, 3); cp.s1 = v.slice(3, 6); cp.s2 = v.slice(6, 9);
      } else {
        const v = ['ta', 'ca', 'tb', 'cb'].map(g);
        if (v.some((x) => !(x > 0))) { log('cycle time 與 CPI 都要 > 0', true); return; }
        [cp.ta, cp.ca, cp.tb, cp.cb] = v;
      }
      go(drawCPI(newRun(), 250, false));
    });
    go(drawCPI(newRun(), 0, false));
  }
  async function drawCPI(t, pace, talk) {
    lab.clear();
    const CC = ['#4b9ee2', '#9b7ef4', '#dd8238'];
    if (cp.kind === 'class') {
      const rows = [cp.s1, cp.s2];
      const res = [];
      for (let r = 0; r < 2; r++) {
        const y = 4.2 - r * 2.4;
        tag('序列 ' + (r + 1), 'ptr', -6.2, y);
        let x = -5.2, cyc = 0, ic = 0;
        const total = rows[r].reduce((s, n, k) => s + n * cp.cpi[k], 0);
        const sc = Math.min(0.8, 10.5 / Math.max(total, 1));
        for (let k = 0; k < 3; k++) for (let i = 0; i < rows[r][k]; i++) {
          const w = cp.cpi[k] * sc;
          if (w > 0) cube('ABC'[k], CC[k], [Math.max(0.05, w - 0.05), 0.6, 0.8], x + w / 2, y, 0, pace ? 1.5 : 0);
          x += w; cyc += cp.cpi[k]; ic++;
          if (pace) await W(t, pace);
        }
        tag(cyc + ' cycles ÷ ' + ic + ' = CPI ' + (ic ? +(cyc / ic).toFixed(3) : 0), 'ptr alt', 2.4, y - 0.75);
        res.push([cyc, ic]);
      }
      setState('加權平均 CPI', [['CPI（A, B, C）', cp.cpi.join(', ')], ['序列 1', res[0][0] + ' cycles / ' + res[0][1] + ' 指令'], ['序列 2', res[1][0] + ' cycles / ' + res[1][1] + ' 指令']],
        'Clock cycles = Σ CPI_i × IC_i；平均 CPI = cycles ÷ IC<br>' + (res[0][0] === res[1][0] ? '兩個序列一樣快' : '序列 ' + (res[0][0] < res[1][0] ? 1 : 2) + ' 比較快（cycles 少），即使指令數不一定少'));
    } else {
      const N = 5;
      const A = cp.ta * cp.ca, B = cp.tb * cp.cb;
      const sc = 11 / (Math.max(A, B) * N);
      [['A', cp.ta, cp.ca, A, 3.6, '#4b9ee2'], ['B', cp.tb, cp.cb, B, 1.4, '#dd8238']].forEach(([n, tc, c, per, y, col]) => {
        tag(n + '：' + tc + 'ps × CPI ' + c, 'ptr', -1, y + 0.8);
        for (let i = 0; i < N; i++) cube('', col, [Math.max(0.05, per * sc - 0.06), 0.6, 0.8], -5.5 + per * sc * (i + 0.5), y, 0);
        tag(per + '·I ps', 'ptr alt', -5.5 + per * sc * N + 0.9, y);
      });
      const fast = A < B ? 'A' : A > B ? 'B' : '一樣';
      setState('同樣 ISA、同樣 IC = I', [['A：每指令', A + ' ps'], ['B：每指令', B + ' ps']],
        fast === '一樣' ? '一樣快' : '<span class="ok">' + fast + ' 比較快</span>：' + Math.max(A, B) + ' / ' + Math.min(A, B) + ' = ' + +(Math.max(A, B) / Math.min(A, B)).toFixed(3) + ' 倍<br>快幾倍 = 慢的時間 ÷ 快的時間');
    }
  }

  // ───────────────────────── 場景：黃婷婷 第 4A 講（效能） ─────────────────────────
  async function scCpuTimeEq(tok) {
    fresh([0, 3.6, 13.5], [0, 2.4, 0]);
    say('response time vs throughput', '多久拿到結果 vs 單位時間做幾件事');
    const jobs = [];
    for (let k = 0; k < 3; k++) { jobs.push(cube('job', '#9b7ef4', [1.2, 0.6, 0.8], -5 + k * 1.5, 4.6, 0, 2)); await beat(tok, 300); }
    await beat(tok, 1800);
    jobs.forEach((j) => fly(j));
    const ticks = [];
    for (let i = 0; i < 12; i++) { ticks.push(cube('', i % 2 ? '#c9b48e' : '#6e5f49', [0.86, 0.2, 0.6], -5.2 + i * 0.95, 1.0, 0)); }
    tag('clock cycles', 'idx', -6.2, 1.0);
    say('CPU time = cycles × clock period', '= cycles ÷ clock rate（rate = 1 / period）');
    await beat(tok, 2800);
    const CPI = [2, 1, 3, 2, 2, 2];
    let x = -5.2 - 0.475, c = 0;
    const cols = ['#4b9ee2', '#2fc092', '#dd8238', '#4b9ee2', '#e55a9b', '#9b7ef4'];
    for (let k = 0; k < CPI.length && c + CPI[k] <= 12; k++) {
      const w = CPI[k] * 0.95;
      cube('I' + (k + 1), cols[k], [w - 0.08, 0.6, 0.7], x + w / 2, 2.0, 0, 2);
      tag(CPI[k] + ' cyc', 'idx', x + w / 2, 2.7);
      x += w; c += CPI[k];
      say('第 ' + (k + 1) + ' 個指令：' + CPI[k] + ' 個 cycle', '每個指令 cycle 數不一樣');
      await beat(tok, 800);
    }
    say('CPI = 平均每個指令幾個 cycle', '12 cycles ÷ 6 個指令 = 2');
    await beat(tok, 2600);
    say('CPU time = IC × CPI × clock cycle time', 'IC：program、ISA、compiler；CPI：organization');
    await beat(tok, 3200);
  }
  async function scCpiAB(tok) {
    fresh([0, 3.6, 13.5], [0, 2.4, 0]);
    say('黃婷婷例題：相同 ISA 的 A、B', '相同 program、compiler → IC 一樣（I）');
    await beat(tok, 2400);
    const sc = 0.0034;
    tag('A：250 ps、CPI 2.0', 'ptr', -1.5, 5.0);
    for (let i = 0; i < 10; i++) cube('', i % 2 ? '#c6def5' : '#4b9ee2', [250 * sc - 0.04, 0.18, 0.6], -5.6 + 250 * sc * (i + 0.5), 3.7, 0);
    tag('B：500 ps、CPI 1.2', 'ptr', -1.5, 2.6);
    for (let i = 0; i < 6; i++) cube('', i % 2 ? '#f4d3b5' : '#dd8238', [500 * sc - 0.04, 0.18, 0.6], -5.6 + 500 * sc * (i + 0.5), 1.3, 0);
    say('A 的 clock 快一倍，但每個指令要 2 個 cycle', 'B 的 clock 慢，但平均 1.2 個 cycle');
    await beat(tok, 3000);
    for (let k = 0; k < 5; k++) {
      cube('I' + (k + 1), '#4b9ee2', [500 * sc - 0.08, 0.5, 0.6], -5.6 + 500 * sc * (k + 0.5), 4.2, 0, 1.5);
      cube('I' + (k + 1), '#dd8238', [600 * sc - 0.08, 0.5, 0.6], -5.6 + 600 * sc * (k + 0.5), 1.8, 0, 1.5);
      await beat(tok, 600);
    }
    tag('500·I ps', 'ptr alt', -5.6 + 2500 * sc + 0.9, 4.2);
    tag('600·I ps', 'ptr alt', -5.6 + 3000 * sc + 0.9, 1.8);
    say('A：I × 2.0 × 250 = 500·I ps', 'B：I × 1.2 × 500 = 600·I ps');
    await beat(tok, 3000);
    say('A 比 B 快：B 的時間放分子', '600·I / 500·I = 1.2 倍');
    await beat(tok, 3200);
  }
  async function scCpiClasses(tok) {
    fresh([0, 3.6, 13.5], [0, 2.4, 0]);
    cp.cpi = [1, 2, 3]; cp.s1 = [2, 1, 2]; cp.s2 = [4, 1, 1]; cp.kind = 'class';
    say('指令分 A、B、C 三類', 'CPI 分別是 1、2、3（寬度 = cycle 數）');
    await beat(tok, 2600);
    await drawCPI(tok, 450, true);
    say('序列 1：2×1 + 1×2 + 2×3 = 10 cycles', 'CPI = 10 / 5 = 2.0');
    await beat(tok, 3000);
    say('序列 2：4×1 + 1×2 + 1×3 = 9 cycles', 'CPI = 9 / 6 = 1.5');
    await beat(tok, 3000);
    say('序列 2 指令比較多，卻比較快', '平均 CPI = Σ CPI_i × 該類比例');
    await beat(tok, 3000);
  }
  async function scFactors(tok) {
    fresh([0, 4.2, 13], [0, 2.8, 0]);
    const rows = ['Program', 'Compiler', 'ISA', 'Organization', 'Technology'];
    const cols = ['Instr. count', 'CPI', 'Clock rate'];
    const yes = [[1, 1, 0], [1, 1, 0], [1, 1, 0], [0, 1, 1], [0, 0, 1]];
    const why = ['寫法、algorithm 不同 → 指令數、指令種類不同', '有沒有 optimization → 產生的指令不同',
      '只有加和 shift？乘法要拆成很多指令', 'carry ripple vs carry lookahead → CPI、clock 都變', '製程進步 → clock period 變小'];
    cols.forEach((c, j) => tag(c, 'ptr', -0.6 + j * 2.6, 6.2));
    const cells = rows.map((r, i) => { tag(r, 'ptr alt', -4.6, 5.2 - i * 1.0); return cols.map((c, j) => cube('', '#e9dcc4', [1.8, 0.5, 0.6], -0.6 + j * 2.6, 5.2 - i * 1.0, 0)); });
    const div = line([[-6, 2.7, 0.4], [4.6, 2.7, 0.4]], '#d64545');
    div.visible = false;
    say('誰會影響 CPU time 的哪一項？', '老師逐一點名問');
    await beat(tok, 2400);
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < 3; j++) { tint(cells[i][j], yes[i][j] ? '#2fc092' : '#d8cfc0'); relabel(cells[i][j], ''); if (yes[i][j]) { cells[i][j].userData.lbl = small(lab.label('✓', 'val'), 12); cells[i][j].add(cells[i][j].userData.lbl); } }
      say(rows[i] + '：' + cols.filter((c, j) => yes[i][j]).join('、'), why[i]);
      await beat(tok, 2600);
      if (i === 2) { div.visible = true; say('ISA 以上是 software', '以下是 hardware：才影響 clock rate'); await beat(tok, 2400); }
    }
    say('補充：P&H 課本表格把 ISA 也列入 clock rate', '這裡照課堂投影片');
    await beat(tok, 3000);
  }
  async function scPower(tok) {
    fresh([0, 3.8, 13.5], [0, 2.8, 0]);
    say('Dynamic power ∝ C × V² × f', 'CMOS 0↔1 切換時充放電');
    const bC = bar('#9b7ef4', 1.4, 1.2, -4, 0), bV = bar('#dd8238', 1.4, 1.2, -1.3, 0), bF = bar('#4b9ee2', 1.4, 1.2, 1.4, 0), bP = bar('#d64545', 1.8, 1.4, 4.6, 0);
    tag('C 負載電容', 'ptr', -4, 0, 1.2); tag('V²', 'ptr', -1.3, 0, 1.2); tag('f 頻率', 'ptr', 1.4, 0, 1.2); tag('Power', 'ptr alt', 4.6, 0, 1.4);
    await Promise.all([growBar(tok, bC, 2, 600), growBar(tok, bV, 2, 600), growBar(tok, bF, 2, 600), growBar(tok, bP, 4, 600)]);
    await beat(tok, 1800);
    say('25 年來：frequency ×1000，power 只 ×30', '因為 voltage 從 5V 降到 1V');
    await Promise.all([growBar(tok, bF, 6, 900), growBar(tok, bV, 2 / 25 * 2, 900), growBar(tok, bP, 5.4, 900)]);
    tag('×1000', 'idx', 1.4, 6.4); tag('5V→1V：平方 ÷25', 'idx', -1.3, 0.9); tag('×30', 'idx', 4.6, 5.8);
    await beat(tok, 3000);
    say('課本例：C、V、f 都變成 85%', 'P_new / P_old = 0.85 × 0.85² × 0.85');
    lab.clear();
    const cb = cube('P', '#d64545', [2.4, 2.4, 2.4], 0, 1.2, 0);
    const lt = tag('1.00', 'ptr alt', 0, 3.4);
    await beat(tok, 1200);
    let s = 1;
    for (const nm of ['C', 'V', 'V', 'f']) {
      s *= 0.85;
      const k = Math.cbrt(s);
      cb.scale.set(k, k, k); cb.position.y = 1.2 * k;
      txt(lt, '× 0.85（' + nm + '）→ ' + s.toFixed(2));
      await beat(tok, 900);
    }
    say('Power ≈ 0.52：降一半', 'V 是平方項，降電壓效果最大');
    await beat(tok, 2800);
    say('但 V 降到約 1V 就停了：leakage 太大', 'static power 漏電、散熱成為瓶頸（power wall）');
    await beat(tok, 3200);
  }
  async function scMulticore(tok) {
    fresh([0, 3.8, 13.5], [0, 2.8, 0]);
    say('Uniprocessor 效能成長', '2002 前每年 ≈ 1.5 倍，之後 ≈ 1.2 倍');
    let v = 1;
    for (let k = 0; k < 10; k++) {
      v *= k < 6 ? 1.5 : 1.2;
      const b = bar(k < 6 ? '#4b9ee2' : '#dd8238', 0.8, 0.8, -5.4 + k * 1.1, 0);
      await growBar(tok, b, Math.log(v) * 1.4 + 0.2, 200);
    }
    tag('×1.5/年', 'ptr', -3.5, 5.2); tag('×1.2/年', 'ptr alt', 3.5, 5.2);
    await beat(tok, 2600);
    lab.clear();
    say('2004 後：一顆晶片放好幾個 core', 'multi-core microprocessor');
    const cores = [];
    for (let k = 0; k < 4; k++) { cores.push(cube('core ' + k, '#6e5f49', [2.2, 0.5, 1.6], -4.2 + k * 2.8, 0.25, 0, 2)); await beat(tok, 300); }
    await beat(tok, 1400);
    say('程式不改：4 個 job 同時跑', 'throughput ↑，每個 job 的 response time 不變');
    for (let k = 0; k < 4; k++) cube('job', '#9b7ef4', [1.6, 0.6, 1.0], -4.2 + k * 2.8, 0.8, 0, 3);
    await beat(tok, 3000);
    lab.clear();
    for (let k = 0; k < 2; k++) cube('core ' + k, '#6e5f49', [2.6, 0.5, 1.6], -2.4 + k * 4.8, 0.25, 0);
    say('要縮短 response time：parallel programming', '把一個工作拆開，分給不同 core');
    const A = cube('A', '#2fc092', [2, 0.6, 1], -2.4, 0.8, 0, 3), B = cube('B', '#4b9ee2', [1.2, 0.6, 1], 2.4, 0.8, 0, 3);
    await beat(tok, 2200);
    say('load balancing：工作要分得平均', 'A 比 B 大 → core 1 會閒著');
    await beat(tok, 2400);
    say('synchronization：A、B 都做完才能做 C', 'communication 與同步是額外負擔');
    fly(B, V3(-2, 3, 2));
    await beat(tok, 1200);
    fly(A, V3(2, 3, 2));
    cube('C', '#e55a9b', [2.4, 0.6, 1], 0, 2.0, 0, 3);
    await beat(tok, 3000);
  }
  async function scSpec(tok) {
    fresh([0, 3.8, 13.5], [0, 2.8, 0]);
    say('Benchmark：大家都跑同一組程式', 'SPEC（1989～）：CPU2006 有 integer、FP');
    const progs = ['perl', 'bzip2', 'gcc', 'mcf', 'go'];
    for (let k = 0; k < progs.length; k++) { cube(progs[k], '#9b7ef4', [1.6, 0.5, 0.8], -4.8 + k * 2.4, 0.25, 2, 2.5); await beat(tok, 250); }
    await beat(tok, 1800);
    say('不比絕對時間：跟 reference machine 比', 'SPECratio = reference time ÷ execution time');
    const bR = bar('#c9b48e', 1.2, 1, -4, -1), bE = bar('#2fc092', 1.2, 1, -2.4, -1);
    tag('reference', 'idx', -4, 0, 0); tag('X4 執行', 'idx', -2.4, 0, 0);
    await growBar(tok, bR, 6.1, 700); await growBar(tok, bE, 0.4, 400);
    tag('ratio = 15.3', 'ptr alt', -3.2, 6.8, -1);
    say('例：某個程式 SPECratio = 15.3', '越大越好');
    await beat(tok, 2800);
    const ratios = [15.3, 11.8, 11.1, 6.8, 14.6];
    const bars = ratios.map((r, k) => { const b = bar('#4b9ee2', 0.8, 0.8, 0.8 + k * 1.2, -1); return [b, r]; });
    for (const [b, r] of bars) await growBar(tok, b, r * 0.35, 300);
    tag('各程式的 ratio（示意）', 'idx', 3.2, 0, 0);
    const am = ratios.reduce((s, x) => s + x, 0) / ratios.length, gm = Math.exp(ratios.reduce((s, x) => s + Math.log(x), 0) / ratios.length);
    const lg = line([[0.2, gm * 0.35, -0.4], [6.2, gm * 0.35, -0.4]], '#d64545');
    say('彙總用 geometric mean', 'ⁿ√(r₁ × r₂ × … × rₙ) = ' + gm.toFixed(1) + '（算術平均 ' + am.toFixed(1) + '）');
    await beat(tok, 3200);
    say('比 summary：你 10、我 11 → 我比較好', 'geometric mean：換 reference machine 排名不變');
    await beat(tok, 3000);
    return lg;
  }
  async function scSpecPower(tok) {
    fresh([0, 3.8, 13.5], [0, 2.6, 0]);
    say('SPEC power：每個 load 量 ops 與 watts', '100%、90%、…、0%（數字示意）');
    const loads = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];
    for (let k = 0; k < loads.length; k++) {
      const x = -5.6 + k * 1.1;
      const ops = bar('#4b9ee2', 0.42, 0.6, x - 0.22, 0), pw = bar('#dd8238', 0.42, 0.6, x + 0.22, 0);
      small(tag(loads[k] + '%', 'idx', x, 0, 0.8), 9);
      await Promise.all([growBar(tok, ops, loads[k] / 100 * 5, 200), growBar(tok, pw, (0.5 + 0.5 * loads[k] / 100) * 3.6, 200)]);
    }
    tag('藍 = ssj_ops、橘 = watts', 'ptr', 0, 6.2);
    await beat(tok, 1600);
    say('總分 = Σ ssj_ops ÷ Σ power', '每瓦可以做多少事');
    await beat(tok, 2800);
    say('0% load：沒做事也在耗電', 'static power（leakage）占很大比例');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景：P&H 第 2 章例題 ─────────────────────────
  async function runPreset(tok, key, pace, over, intro) {
    fresh([0.6, 3.7, 13.2], [0.6, 3.7, 0]);
    const V = buildSim(key, over);
    if (intro) { say(intro[0], intro[1]); await beat(tok, 2600); }
    while (V.S.prog[V.S.pc] && V.S.steps < 80) await simStep(V, tok, pace, true);
    return V;
  }
  async function scRegisters(tok) {
    fresh([0.6, 3.7, 13.2], [0.6, 3.7, 0]);
    const V = buildSim('expr');
    say('MIPS 有 32 個 32-bit 暫存器', '暫存器比記憶體快很多（smaller is faster）');
    await beat(tok, 2600);
    const groups = [[[2, 3], '$v0–$v1：回傳值'], [[4, 5, 6, 7], '$a0–$a3：參數'], [[8, 9, 10, 11, 12, 13, 14, 15, 24, 25], '$t0–$t9：臨時，呼叫後不保證'], [[16, 17, 18, 19, 20, 21, 22, 23], '$s0–$s7：saved，被呼叫者要保存'], [[29, 31], '$sp 堆疊指標、$ra 返回位址'], [[0], '$zero：永遠是 0']];
    for (const [ids, cap] of groups) {
      V.regs.forEach((m, i) => glow(m, ids.includes(i) ? GOLD : null));
      say(cap, '');
      await beat(tok, 1700);
    }
    V.regs.forEach((m) => glow(m, null));
    say('課本例：f = (g + h) − (i + j)', 'g、h、i、j 在 $s1–$s4，f 在 $s0');
    await beat(tok, 2600);
    while (V.S.prog[V.S.pc]) await simStep(V, tok, 1800, true);
    say('f = 8 − 6 = 2', '算術指令：三個運算元都是暫存器');
    await beat(tok, 2800);
  }
  async function scArray(tok) {
    await runPreset(tok, 'array', 2200, null, ['課本例：A[12] = h + A[8]', 'A 的起始位址在 $s3 = 100，h 在 $s2']);
    say('byte addressing：A[i] 在 base + 4i', 'offset 32 = 8 × 4，48 = 12 × 4');
    await beat(tok, 3200);
  }
  async function scRFormat(tok) {
    fresh([0, 3.4, 12.5], [0, 1.6, 0]);
    const e = assemble('add $t0, $s1, $s2');
    const row = fieldRow(e); const bits = bitsOf(e);
    row.set(bits, 0);
    tag('add $t0, $s1, $s2', 'ptr alt', 0, 2.8);
    say('課本例：add $t0, $s1, $s2 編成機器碼', 'R-format：op rs rt rd shamt funct');
    await beat(tok, 2600);
    const caps = [['op = 0', 'R-format 的 op 都是 0'], ['rs = $s1 = 17', '第一個來源'], ['rt = $s2 = 18', '第二個來源'], ['rd = $t0 = 8', '目的暫存器'], ['shamt = 0', '只有 shift 指令用'], ['funct = 32', 'funct 決定是 add']];
    for (let k = 0; k < 6; k++) {
      row.set(bits, k + 1);
      tag(e.fields[k][0], 'ptr', row.mid(k), 1.3); tag(String(e.fields[k][2]), 'idx', row.mid(k), 0, 1.0);
      row.ms.forEach((m, i) => glow(m, row.fOf(i) === k ? GOLD : null));
      say(caps[k][0], caps[k][1]);
      await beat(tok, 1700);
    }
    row.ms.forEach((m) => glow(m, null));
    say('= 0000 0010 0011 0010 0100 0000 0010 0000', '= ' + hex8(bits));
    await beat(tok, 3000);
    say('sub 只差 funct：34', '欄位固定 → 硬體解碼簡單（simplicity favors regularity）');
    await beat(tok, 3000);
  }
  async function scIFormat(tok) {
    fresh([0, 3.4, 12.5], [0, 1.6, 0]);
    let e = assemble('lw $t0, 32($s3)');
    let row = fieldRow(e); let bits = bitsOf(e);
    row.set(bits);
    e.fields.forEach(([n, , v], k) => { tag(n, 'ptr', row.mid(k), 1.3); tag(String(v), 'idx', row.mid(k), 0, 1.0); });
    tag('lw $t0, 32($s3)  →  ' + hex8(bits), 'ptr alt', 0, 2.8);
    say('I-format：op rs rt 16-bit 常數', 'lw $t0, 32($s3)：35 19 8 32');
    await beat(tok, 3000);
    say('rt 在 lw 是「目的」', '16 bits 常數：±2¹⁵ bytes 的 offset');
    await beat(tok, 2600);
    lab.clear();
    say('課本例：A[300] = h + A[300]', '$t1 = A 的位址，h 在 $s2');
    const cd = code(['lw  $t0, 1200($t1)', 'add $t0, $s2, $t0', 'sw  $t0, 1200($t1)'], -4.2, 5.4, 0.7);
    const dec = [['35', '9', '8', '1200'], ['0', '18', '8', '8', '0', '32'], ['43', '9', '8', '1200']];
    for (let k = 0; k < 3; k++) {
      cd.hl(k);
      const enc = assemble(['lw $t0, 1200($t1)', 'add $t0, $s2, $t0', 'sw $t0, 1200($t1)'][k]);
      dec[k].forEach((d, j) => cube(d, FCOL[j], [d.length > 2 ? 1.0 : 0.8, 0.5, 0.6], -0.4 + j * 1.05, 5.4 - k * 0.7, 0, 2));
      say(['lw：op 35', 'add：op 0、funct 32', 'sw：op 43'][k], grp(bitsOf(enc)));
      await beat(tok, 2200);
    }
    cd.hl(-1);
    say('lw 和 sw 只差 op（35 vs 43）', '指令也是數字，存在記憶體：stored-program');
    await beat(tok, 3200);
    return row;
  }
  async function scLuiOri(tok) {
    fresh([0, 3.4, 13], [0, 1.8, 0]);
    say('32-bit 常數放不進 16-bit 欄位', '課本例：4,000,000 = 0x003D0900');
    const w = 0.38;
    const r = []; for (let i = 0; i < 32; i++) { const m = cube('0', i < 16 ? '#c6def5' : '#c2ecdc', [w * 0.86, 0.3, w * 0.86], -6.1 + i * w + (i >= 16 ? 0.2 : 0), 0.6, 0); small(m.userData.lbl, 10); r.push(m); }
    tag('$s0 高 16 bits', 'ptr', -3.1, 1.4); tag('低 16 bits', 'ptr', 3.3, 1.4);
    await beat(tok, 2400);
    const hi = bin(61, 16), lo = bin(2304, 16);
    say('lui $s0, 61：61 放到高 16 bits', '低 16 bits 清成 0');
    for (let i = 0; i < 16; i++) { relabel(r[i], hi[i]); tint(r[i], hi[i] === '1' ? '#4b9ee2' : '#c6def5'); glow(r[i], GOLD); }
    await beat(tok, 2600);
    r.forEach((m) => glow(m, null));
    say('ori $s0, $s0, 2304：OR 進低 16 bits', '2304 = 0000 1001 0000 0000');
    for (let i = 0; i < 16; i++) { relabel(r[16 + i], lo[i]); tint(r[16 + i], lo[i] === '1' ? '#2fc092' : '#c2ecdc'); glow(r[16 + i], GOLD); }
    await beat(tok, 2600);
    r.forEach((m) => glow(m, null));
    tag('0000 0000 0011 1101 0000 1001 0000 0000 = 4,000,000', 'ptr alt', 0, 2.6);
    say('$s0 = 61 × 65536 + 2304 = 4,000,000', 'ori 用 zero-extend，所以高半部不受影響');
    await beat(tok, 3400);
  }
  async function scIfElse(tok) {
    await runPreset(tok, 'ifelse', 1900, null, ['課本例：if (i == j) f = g + h; else f = g − h;', '這次 i = j = 4']);
    say('i = j：執行 then，f = 10', 'j Exit 跳過 else');
    await beat(tok, 2600);
    await runPreset(tok, 'ifelse', 1900, { $s4: 5 }, ['再跑一次：i = 4、j = 5', '']);
    say('i ≠ j：bne 直接跳到 Else，f = 4', '組語把條件反過來寫（bne）比較省');
    await beat(tok, 3000);
  }
  async function scWhile(tok) {
    await runPreset(tok, 'loop', 1000, null, ['課本例：while (save[i] == k) i += 1;', 'i 在 $s3、k = 5 在 $s5、save 起點 $s6 = 200']);
    say('save[3] = 7 ≠ 5 → 離開，i = 3', '每圈 6 個指令；sll 2 就是 ×4');
    await beat(tok, 3200);
  }
  async function scBranchAddr(tok) {
    fresh([0, 3.6, 13.5], [0, 3.2, 0]);
    const L = [['80000', 'Loop: sll  $t1, $s3, 2', '0 0 19 9 2 0'], ['80004', '      add  $t1, $t1, $s6', '0 9 22 9 0 32'], ['80008', '      lw   $t0, 0($t1)', '35 9 8 0'],
      ['80012', '      bne  $t0, $s5, Exit', '5 8 21 2'], ['80016', '      addi $s3, $s3, 1', '8 19 19 1'], ['80020', '      j    Loop', '2 20000'], ['80024', 'Exit:', '']];
    const blocks = L.map(([ad, s, f], k) => {
      const y = 6.2 - k * 0.85;
      small(tag(ad, 'idx', -6.3, y), 10);
      const l = tag(s.padEnd(26), '', -3.4, y); Object.assign(l.element.style, MONO);
      if (f) tag(f, 'idx', 2.6, y);
      return { y, l };
    });
    say('課本例：迴圈從位址 80000 開始', '右邊是各欄位的十進位值');
    await beat(tok, 3000);
    const pcm = tag('PC', 'ptr alt', -5.2, blocks[3].y);
    blocks[3].l.element.className = 'lab-label ptr alt';
    say('bne 的 offset = 2（以指令為單位）', '');
    await beat(tok, 2200);
    move(cube('PC+4 = 80016', '#c08a1f', [2.4, 0.5, 0.6], 5.2, blocks[4].y, 0), 5.2, blocks[4].y);
    say('PC-relative：從 PC + 4 = 80016 起算', '80016 + 2 × 4 = 80024 = Exit');
    await beat(tok, 2600);
    pcm.position.y = blocks[6].y;
    await beat(tok, 1600);
    blocks[3].l.element.className = 'lab-label'; blocks[5].l.element.className = 'lab-label ptr alt';
    pcm.position.y = blocks[5].y;
    say('j Loop 的欄位是 20000', 'pseudodirect：20000 × 4 = 80000');
    await beat(tok, 2600);
    pcm.position.y = blocks[0].y;
    say('跳回 80000 = Loop', '再接上 PC 最高 4 bits（這裡都是 0）');
    await beat(tok, 2600);
    say('beq/bne 範圍 ±2¹⁵ 個指令；更遠就反向分支 + j', 'j 的範圍：同一個 256 MB 區塊');
    await beat(tok, 3200);
  }
  async function scLeaf(tok) {
    const V = await runPreset(tok, 'leaf', 1500, null, ['課本例：leaf_example(g, h, i, j)', '參數在 $a0–$a3：5、3、4、2']);
    say('回傳 $v0 = 2；$s0、$t0、$t1 都還原了', '$sp 回到 1000');
    await beat(tok, 3200);
    say('課本：$t 其實不必存（caller-saved）', '只有 $s 要由被呼叫者（callee）保存');
    await beat(tok, 3000);
    return V;
  }
  async function scFact(tok) {
    await runPreset(tok, 'fact', 650, null, ['課本例：遞迴 fact(n)，算 fact(3)', '每層把 $ra、$a0 存進堆疊']);
    say('fact(3) = 6：$v0 = 6', '每呼叫一層就多 8 bytes 的 stack frame');
    await beat(tok, 3400);
  }
  async function scAddrModes(tok) {
    fresh([0, 3.4, 13], [0, 3.0, 0]);
    am.base = 100; am.off = 32; am.pc = 80012;
    for (const k of ['imm', 'reg', 'base', 'pc', 'pseudo']) await amPlay(k, tok, 1600, true);
    say('一般 ISA 還有 Direct 與 Indirect', 'MIPS 沒有（load-store、精簡）');
    await beat(tok, 2200);
    await amPlay('direct', tok, 1500, true);
    await amPlay('indirect', tok, 1500, true);
  }
  async function scRiscCisc(tok) {
    fresh([0, 3.6, 13.5], [0, 2.6, 0]);
    say('RISC（MIPS）：每個指令固定 32 bits', 'CISC（x86）：1 ～ 15 bytes 不等長');
    for (let k = 0; k < 5; k++) cube('32b', '#2fc092', [1.6, 0.5, 0.8], -5.2 + k * 1.7, 4.6, 0, 2);
    const L = [1, 3, 6, 2, 4, 1.5];
    let x = -6;
    for (const w of L) { cube('', '#dd8238', [w * 0.5 - 0.05, 0.5, 0.8], x + w * 0.25, 3.2, 0, 2); x += w * 0.5; }
    tag('RISC', 'ptr', -6.4, 5.3); tag('CISC', 'ptr alt', -6.4, 3.9);
    await beat(tok, 3000);
    say('CISC：一個指令就能「記憶體 + 暫存器」', 'add [mem], eax');
    cube('add [mem], eax', '#dd8238', [3.2, 0.6, 0.8], -3, 1.4, 0, 2);
    await beat(tok, 2200);
    say('RISC：load-store，要拆成三個', 'lw → add → sw');
    ['lw', 'add', 'sw'].forEach((s, k) => cube(s, '#2fc092', [1.2, 0.6, 0.8], 1.4 + k * 1.4, 1.4, 0, 2));
    await beat(tok, 2600);
    say('RISC：指令簡單、格式整齊、暫存器多', '好 pipeline、硬體簡單，但 IC 較多');
    await beat(tok, 3000);
    say('CISC：指令多又複雜、IC 少但 CPI 高', '現代 x86 內部把指令拆成 RISC-like 的 micro-ops');
    await beat(tok, 3200);
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function uniq(ans, wrong) { const o = [ans]; for (const w of wrong) if (!o.includes(w) && o.length < 4) o.push(w); let k = 1; while (o.length < 4) o.push(ans + '（' + k++ + '）'); return o; }
  function genQ() {
    const t = R(0, 9);
    if (t === 0) {
      const op = pickOne(['add', 'sub', 'and', 'or', 'slt']);
      const rd = R(8, 15), rs = R(16, 23), rt = R(16, 23);
      const s = op + ' ' + RN[rd] + ', ' + RN[rs] + ', ' + RN[rt];
      const ans = hex8(bitsOf(assemble(s)));
      const swapped = hex8(bitsOf(assemble(op + ' ' + RN[rs] + ', ' + RN[rd] + ', ' + RN[rt])));
      const otherF = hex8(bitsOf(assemble((op === 'add' ? 'sub' : 'add') + ' ' + RN[rd] + ', ' + RN[rs] + ', ' + RN[rt])));
      const swap2 = hex8(bitsOf(assemble(op + ' ' + RN[rd] + ', ' + RN[rt] + ', ' + RN[rs])));
      return { q: s + ' 的機器碼（hex）是？', opts: uniq(ans, [swapped, otherF, swap2, '0x' + (parseInt(ans.slice(2), 16) ^ 0x800).toString(16).toUpperCase().padStart(8, '0')]), ans, why: 'R-format：op 0、rs ' + rs + '、rt ' + rt + '、rd ' + rd + '、shamt 0、funct ' + RFUN[op] + '。注意 rd 寫在最前面，但欄位排在 rs、rt 後面。' };
    }
    if (t === 1) {
      const k = R(1, 40);
      const ans = String(4 * k);
      return { q: 'int 陣列 A 的起始位址在 $s3，載入 A[' + k + '] 的 lw 指令 offset 要寫多少？', opts: uniq(ans, [String(k), String(8 * k), String(4 * k + 4)]), ans, why: 'MIPS 是 byte addressing，一個 word 4 bytes：offset = ' + k + ' × 4 = ' + ans + '。' };
    }
    if (t === 2) {
      const pc = 4 * R(1000, 20000), off = R(-20, 20) || 3;
      const ans = String(pc + 4 + 4 * off);
      return { q: '位址 ' + pc + ' 的 beq 指令，offset 欄位 = ' + off + '，成立時跳到哪裡？', opts: uniq(ans, [String(pc + 4 * off), String(pc + 4 + off), String(pc + off)]), ans, why: 'PC-relative：(PC + 4) + offset × 4 = ' + (pc + 4) + ' + ' + 4 * off + ' = ' + ans + '。' };
    }
    if (t === 3) {
      const f = R(1000, 60000);
      const ans = String(4 * f);
      return { q: 'j 指令的 26-bit 位址欄位是 ' + f + '（PC 最高 4 bits 為 0），跳到的位址是？', opts: uniq(ans, [String(f), String(f + 4), String(2 * f)]), ans, why: 'pseudodirect：PC[31:28] ‖ 位址 ‖ 00 = ' + f + ' × 4 = ' + ans + '。' };
    }
    if (t === 4) {
      const c = [R(1, 2), R(2, 3), R(3, 5)], n = [R(1, 6), R(1, 4), R(1, 4)];
      const cyc = c[0] * n[0] + c[1] * n[1] + c[2] * n[2], ic = n[0] + n[1] + n[2];
      const ans = String(+(cyc / ic).toFixed(2));
      return { q: '指令類別 A、B、C 的 CPI 為 ' + c.join('、') + '；某程式各有 ' + n.join('、') + ' 個指令，平均 CPI = ?', opts: uniq(ans, [String(+((c[0] + c[1] + c[2]) / 3).toFixed(2)), String(cyc), String(+(ic / cyc).toFixed(2))]), ans, why: 'cycles = ' + cyc + '，IC = ' + ic + '，CPI = ' + cyc + ' / ' + ic + ' = ' + ans + '（不是三個 CPI 直接平均）。' };
    }
    if (t === 5) {
      const ta = pickOne([200, 250, 300]), ca = pickOne([1.5, 2, 2.5]), tb = pickOne([400, 500]), cb = pickOne([1, 1.2, 1.4]);
      const A = ta * ca, B = tb * cb;
      if (A === B) return genQ();
      const ans = (A < B ? 'A' : 'B') + ' 快 ' + +(Math.max(A, B) / Math.min(A, B)).toFixed(3) + ' 倍';
      return { q: '同 ISA 的 A（' + ta + ' ps、CPI ' + ca + '）與 B（' + tb + ' ps、CPI ' + cb + '），誰快、快幾倍？', opts: uniq(ans, [(A < B ? 'B' : 'A') + ' 快 ' + +(Math.max(A, B) / Math.min(A, B)).toFixed(3) + ' 倍', (A < B ? 'A' : 'B') + ' 快 ' + +(tb / ta).toFixed(3) + ' 倍', '一樣快']), ans, why: 'A 每指令 ' + A + ' ps、B 每指令 ' + B + ' ps；慢的 ÷ 快的。' };
    }
    if (t === 6) {
      const q = pickOne([
        ['procedure 被呼叫者（callee）必須保存、用完還原的暫存器是？', '$s0–$s7', ['$t0–$t9', '$a0–$a3', '$v0–$v1'], '$s 是 saved registers；$t 由 caller 自己決定要不要存。'],
        ['jal 指令會把返回位址存在哪裡？', '$ra', ['$sp', '$v0', '$fp'], 'jal：$ra = PC + 4，然後跳到目標；返回用 jr $ra。'],
        ['procedure 要把資料推進 stack 時，$sp 應該？', '先減（往低位址長）', ['先加（往高位址長）', '不用動', '設成 0'], 'MIPS stack 往低位址長：addi $sp, $sp, −k 再 sw。'],
        ['MIPS 算術指令的運算元可以是？', '只能是暫存器（或立即值）', ['可以直接是記憶體', '只能是記憶體', '只能是立即值'], 'MIPS 是 load-store 架構：記憶體只能用 lw / sw 存取。'],
        ['哪個不是 MIPS 的定址模式？', 'Indirect', ['PC-relative', 'Pseudodirect', 'Base（displacement）'], 'MIPS 五種：Immediate、Register、Base、PC-relative、Pseudodirect。'],
        ['RISC 相較 CISC 的特點是？', '固定長度指令、load-store、暫存器多', ['可變長度指令、記憶體運算元', 'CPI 較高、IC 較少', '定址模式較多'], 'RISC 追求簡單規律、方便 pipeline；CISC 指令數少但複雜。'],
      ]);
      return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: q[3] };
    }
    if (t === 7) {
      const op = pickOne(['lw', 'sw', 'addi', 'beq']);
      const rt = R(8, 15), rs = R(16, 23), im = op === 'beq' ? R(-10, 10) : 4 * R(0, 50);
      const s = op === 'lw' || op === 'sw' ? op + ' ' + RN[rt] + ', ' + im + '(' + RN[rs] + ')' : op === 'beq' ? 'beq ' + RN[rs] + ', ' + RN[rt] + ', ' + im : 'addi ' + RN[rt] + ', ' + RN[rs] + ', ' + im;
      const ans = IOP[op] + ' ' + rs + ' ' + rt + ' ' + im;
      return { q: s + ' 的 I-format 欄位（op rs rt immediate，十進位）是？', opts: uniq(ans, [IOP[op] + ' ' + rt + ' ' + rs + ' ' + im, '0 ' + rs + ' ' + rt + ' ' + im, IOP[op] + ' ' + rs + ' ' + rt + ' ' + (op === 'beq' ? im * 4 : im / 4)]), ans, why: op + ' 的 op = ' + IOP[op] + (op === 'beq' ? '；beq 第一個暫存器放 rs、offset 以指令為單位' : '；rt 是 ' + (op === 'sw' ? '要存的來源' : '目的') + '暫存器，rs 是 base') + '。' };
    }
    if (t === 8) {
      const k = pickOne([0.8, 0.85, 0.9]);
      const ans = (+(k ** 4).toFixed(2)).toString();
      return { q: 'C、V、f 都變成原來的 ' + k + ' 倍，dynamic power 約變成原來的？', opts: uniq(ans, [String(k), (+(k ** 2).toFixed(2)).toString(), (+(k ** 3).toFixed(2)).toString()]), ans, why: 'P ∝ C × V² × f = ' + k + ' × ' + k + '² × ' + k + ' = ' + k + '⁴ ≈ ' + ans + '。' };
    }
    const q = pickOne([
      ['SPECratio 怎麼算？多個程式怎麼彙總？', 'reference time ÷ 執行時間；geometric mean', ['執行時間 ÷ reference time；arithmetic mean', 'reference time ÷ 執行時間；arithmetic mean', 'IC × CPI；harmonic mean'], '越大越快；用 geometric mean，排名不受 reference machine 影響。'],
      ['程式不改，多核心主要提升？', 'throughput', ['response time', 'clock rate', 'CPI'], '多個 job 同時跑；單一程式要變快得寫 parallel program。'],
      ['依課堂總表，compiler 會影響？', 'Instruction count 與 CPI', ['只有 clock rate', 'CPI 與 clock rate', '三項都不影響'], 'compiler 決定產生哪些、多少指令；不影響硬體 clock。'],
    ]);
    return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: q[3] };
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
    'cpu-time-eq': { title: '黃婷婷 4A：CPU time = IC × CPI × cycle time', play: scCpuTimeEq },
    'cpi-ab': { title: '黃婷婷 4A：A（250ps, CPI 2）vs B（500ps, CPI 1.2）', play: scCpiAB },
    'cpi-classes': { title: '黃婷婷 4A：A/B/C 類指令加權 CPI', play: scCpiClasses },
    'perf-factors': { title: '黃婷婷 4A：誰影響 IC、CPI、clock rate', play: scFactors },
    'power-wall': { title: '黃婷婷 4A：Power ∝ C·V²·f 與 power wall', play: scPower },
    'multicore': { title: '黃婷婷 4A：uniprocessor → multi-core', play: scMulticore },
    'spec-ratio': { title: '黃婷婷 4A：SPECratio 與 geometric mean', play: scSpec },
    'spec-power': { title: '黃婷婷 4A：SPEC power（ssj_ops / watt）', play: scSpecPower },
    'mips-registers': { title: '課本：32 個暫存器與 f = (g+h) − (i+j)', play: scRegisters },
    'lw-sw-array': { title: '課本：A[12] = h + A[8]（lw / sw）', play: scArray },
    'r-format': { title: '課本：R-format 編碼 add $t0, $s1, $s2', play: scRFormat },
    'i-format': { title: '課本：I-format 與 A[300] = h + A[300]', play: scIFormat },
    'lui-ori': { title: '課本：32-bit 常數 lui + ori', play: scLuiOri },
    'if-else': { title: '課本：if-else 編成 bne + j', play: scIfElse },
    'while-loop': { title: '課本：while (save[i] == k) 迴圈', play: scWhile },
    'branch-addr': { title: '課本：PC-relative 與 pseudodirect 位址', play: scBranchAddr },
    'procedure-leaf': { title: '課本：leaf procedure 與 stack', play: scLeaf },
    'procedure-fact': { title: '課本：遞迴 fact(3) 的 stack frame', play: scFact },
    'addressing-modes': { title: '定址模式：MIPS 五種 + Direct / Indirect', play: scAddrModes },
    'risc-cisc': { title: 'RISC vs CISC', play: scRiscCisc },
  };

  return {
    kicker: '計算機組織・第 2 章',
    title: '指令集架構 ISA（MIPS）',
    color: 'var(--ca)',
    modes: [
      { id: 'sim', name: 'MIPS 單步執行', enter: enterSim },
      { id: 'encode', name: '指令編碼 R/I/J', enter: enterEncode },
      { id: 'addr', name: '定址模式', enter: enterAddr },
      { id: 'cpi', name: 'CPI 與效能', enter: enterCPI },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['cpu-time-eq', 'cpi-ab', 'cpi-classes', 'perf-factors', 'power-wall', 'multicore', 'spec-ratio', 'spec-power',
      'mips-registers', 'lw-sw-array', 'r-format', 'i-format', 'lui-ori', 'if-else', 'while-loop', 'branch-addr',
      'procedure-leaf', 'procedure-fact', 'addressing-modes', 'risc-cisc'],
    stop() { run++; },
  };
}
