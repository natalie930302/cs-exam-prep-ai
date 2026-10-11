// 計算機組織 第2章：指令集架構 ISA（MIPS）。
// 前半跟著黃婷婷第 4A 講（效能：CPU time、CPI、影響因素、power wall、multi-core、SPEC）；
// 後半依 Patterson & Hennessy 第 2 章例題（暫存器、lw/sw、R/I/J 格式、分支、迴圈、procedure call、定址模式）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

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
      + '<select id="ePre"><option value="">例子…</option><option>add $t0, $s1, $s2</option><option>sub $t0, $s1, $s2</option><option>lw $t0, 32($s3)</option><option>sw $t0, 1200($t1)</option><option>addi $s3, $s3, 1</option><option>sll $t2, $s0, 4</option><option>beq $s1, $s2, 25</option><option>bne $t0, $s5, 2</option><option>j 80000</option><option>jr $ra</option><option>lui $s0, 61</option></select>');
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
    say('例：C、V、f 都變成 85%', 'P_new / P_old = 0.85 × 0.85² × 0.85');
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
    say('例：f = (g + h) − (i + j)', 'g、h、i、j 在 $s1–$s4，f 在 $s0');
    await beat(tok, 2600);
    while (V.S.prog[V.S.pc]) await simStep(V, tok, 1800, true);
    say('f = 8 − 6 = 2', '算術指令：三個運算元都是暫存器');
    await beat(tok, 2800);
  }
  async function scArray(tok) {
    await runPreset(tok, 'array', 2200, null, ['例：A[12] = h + A[8]', 'A 的起始位址在 $s3 = 100，h 在 $s2']);
    say('byte addressing：A[i] 在 base + 4i', 'offset 32 = 8 × 4，48 = 12 × 4');
    await beat(tok, 3200);
  }
  async function scRFormat(tok) {
    fresh([0, 3.4, 12.5], [0, 1.6, 0]);
    const e = assemble('add $t0, $s1, $s2');
    const row = fieldRow(e); const bits = bitsOf(e);
    row.set(bits, 0);
    tag('add $t0, $s1, $s2', 'ptr alt', 0, 2.8);
    say('例：add $t0, $s1, $s2 編成機器碼', 'R-format：op rs rt rd shamt funct');
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
    say('例：A[300] = h + A[300]', '$t1 = A 的位址，h 在 $s2');
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
    say('32-bit 常數放不進 16-bit 欄位', '例：4,000,000 = 0x003D0900');
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
    await runPreset(tok, 'ifelse', 1900, null, ['例：if (i == j) f = g + h; else f = g − h;', '這次 i = j = 4']);
    say('i = j：執行 then，f = 10', 'j Exit 跳過 else');
    await beat(tok, 2600);
    await runPreset(tok, 'ifelse', 1900, { $s4: 5 }, ['再跑一次：i = 4、j = 5', '']);
    say('i ≠ j：bne 直接跳到 Else，f = 4', '組語把條件反過來寫（bne）比較省');
    await beat(tok, 3000);
  }
  async function scWhile(tok) {
    await runPreset(tok, 'loop', 1000, null, ['例：while (save[i] == k) i += 1;', 'i 在 $s3、k = 5 在 $s5、save 起點 $s6 = 200']);
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
    say('例：迴圈從位址 80000 開始', '右邊是各欄位的十進位值');
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
    const V = await runPreset(tok, 'leaf', 1500, null, ['例：leaf_example(g, h, i, j)', '參數在 $a0–$a3：5、3、4、2']);
    say('回傳 $v0 = 2；$s0、$t0、$t1 都還原了', '$sp 回到 1000');
    await beat(tok, 3200);
    say('課本：$t 其實不必存（caller-saved）', '只有 $s 要由被呼叫者（callee）保存');
    await beat(tok, 3000);
    return V;
  }
  async function scFact(tok) {
    await runPreset(tok, 'fact', 650, null, ['例：遞迴 fact(n)，算 fact(3)', '每層把 $ra、$a0 存進堆疊']);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ isA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 2 章（清大 黃婷婷 第 4A／4B／5A／6A 講 + 1.5 Addressing Modes | MIPS）— cued scenes ───
// 每個 scene 是一串 step：每一步等老師講到那句話（notes 的 cues）才動一下，不重播、不循環。
// 老師的數字照用（250 ps／CPI 2.0、CPI 1·2·3 的兩個 sequence、0.85⁴、台北→高雄 5 h→2 h、100 s 中乘法 80 s、
// $s0 = 1000 + 12、999、25、A[8] offset 32、A[12] offset 48、addi −50、lw 1200、bne 100、j 2500…）。
// 所有 cycles、時間、比值、位址、欄位 bits 與 hex 都用程式算（assemble／bitsOf／hex8／exec 是本章的組譯器與模擬器），
// 畫面顯示 ✓。老師沒給的數字標「示意」。
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
const mono = (l, px = 12) => { Object.assign(l.element.style, MONO, { fontSize: px + 'px' }); return l; };
const mt = (t, x, y, px = 12, cls = '') => mono(tag(t, cls, x, y), px);
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#c2ecdc', lilac: '#d9cdfb', sky: '#c6def5', peach: '#f4d3b5' };
const HL = '#6a4a00', OKG = '#0f5a3a';
const bx = (t, c, x, y, z = 0, w = 1.6, h = 0.55, d = 0.7) => cube(t, c, [w, h, d], x, y, z);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.row && o.extra) return gone(o.ms, o.extra); if (o.ms && o.xs) return gone(o.ms); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.g && o.set) return kill(o.g); if (o.element) remove(o); else kill(o); });
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const CAM = [[0, 3.4, 14.5], [0, 3.0, 0]];
// a scene = a list of step functions; each runs when the video reaches its cue
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a row of 32 bit cubes split into the instruction's fields (reuses this chapter's fieldRow);
// show(k) reveals fields 0..k-1, names/values go above/below
function fields(text, y = 0.6, w = 0.36) {
  const e = assemble(text), bits = bitsOf(e), row = fieldRow(e, y, w);
  row.set(bits, 0);
  const extra = [];
  const show = (k) => { row.set(bits, k); };
  const label = (k, val) => {
    const [n, wd, v] = e.fields[k];
    extra.push(small(tag(n + '（' + wd + '）', 'ptr', row.mid(k), y + 0.7), 11));
    extra.push(small(tag(val == null ? String(v) : val, 'idx', row.mid(k), y - 0.55), 11));
  };
  const hl = (k) => row.ms.forEach((m, i) => glow(m, k >= 0 && row.fOf(i) === k ? HL : null));
  return { e, bits, row, show, label, hl, extra, hex: hex8(bits), ms: row.ms, xs: row.xs };
}
// a tiny machine: named registers (left) and memory words (right); run(line) executes one MIPS line with this chapter's exec()
function mach(o) {
  const M = { reg: Array(32).fill(0), mem: {}, R: {}, C: {}, extra: [] };
  M.reg[29] = 1000;
  (o.regs || []).forEach(([n, v], i) => {
    const r = rIdx(n); M.reg[r] = v;
    const x = o.rx != null ? o.rx : -5.2, y = (o.ry != null ? o.ry : 5) - i * 0.78;
    M.R[n] = bx(String(v), RCOL(r), x, y, 0, 1.3, 0.55, 0.7);
    M.extra.push(mono(tag(n + (o.rnames && o.rnames[i] ? '（' + o.rnames[i] + '）' : ''), 'idx', x - 1.45, y), 11));
  });
  (o.mem || []).forEach(([a, v, nm], i) => {
    M.mem[a] = v;
    const x = o.mx != null ? o.mx : 4.6, y = (o.my != null ? o.my : 5) - i * 0.62;
    M.C[a] = bx(String(v), FC.sand, x, y, 0, 1.4, 0.5, 0.7);
    M.extra.push(mono(tag(String(a), 'idx', x - 1.25, y), 10));
    if (nm) M.extra.push(small(tag(nm, 'idx', x + 1.25, y), 10));
  });
  if (o.mem && o.mem.length) M.extra.push(hd('Memory（byte address）', o.mx != null ? o.mx : 4.6, (o.my != null ? o.my : 5) + 0.65));
  M.refresh = () => {
    for (const n of Object.keys(M.R)) relabel(M.R[n], M.reg[rIdx(n)]);
    for (const a of Object.keys(M.C)) relabel(M.C[a], M.mem[a] || 0);
  };
  M.calm = () => { Object.values(M.R).forEach((m) => glow(m, null)); Object.values(M.C).forEach((m) => glow(m, null)); };
  // run one instruction; a small token carries the value from where it is read to where it goes
  M.run = async (tok, line) => {
    M.calm();
    const S = { prog: parseProg(line).prog, labels: {}, reg: M.reg, mem: M.mem, pc: 0, steps: 0 };
    const out = exec(S);
    const posR = (i) => { const n = Object.keys(M.R).find((k) => rIdx(k) === i); return n ? M.R[n].position : null; };
    out.reads.forEach((i) => { const n = Object.keys(M.R).find((k) => rIdx(k) === i); if (n) glow(M.R[n], HL); });
    let from = null, to = null, v = null;
    if (out.mem && out.mem.read) { from = M.C[out.mem.addr] && M.C[out.mem.addr].position; to = posR(out.writes[0]); v = M.mem[out.mem.addr]; }
    else if (out.mem && out.mem.write) { from = posR(rIdx(S.prog[0].args[0])); to = M.C[out.mem.addr] && M.C[out.mem.addr].position; v = M.mem[out.mem.addr]; }
    else if (out.writes.length) { from = V3(0, 2.2, 0.6); to = posR(out.writes[0]); v = M.reg[out.writes[0]]; }
    if (from && to) {
      const t = cube(String(v), FC.gold, [0.8, 0.4, 0.4], from.x, from.y, 0.7);
      await travel(tok, t, V3(from.x, from.y, 0.7), V3(to.x, to.y, 0.7), 700); kill(t);
    }
    M.refresh();
    out.writes.forEach((i) => { const n = Object.keys(M.R).find((k) => rIdx(k) === i); if (n) glow(M.R[n], OKG); });
    if (out.mem && out.mem.write && M.C[out.mem.addr]) glow(M.C[out.mem.addr], OKG);
    if (out.mem && out.mem.read && M.C[out.mem.addr]) glow(M.C[out.mem.addr], HL);
    return out;
  };
  return M;
}

// ════════ A6sbcPRLkmg（第 4A 講：CPU time、CPI、影響因素、power、multi-core、benchmark、SPEC）— built-in scenes 的 cued 版 ════════
// 4A 的例子數字：12 cycles × 0.5 ns、CPI 2,1,3,2,2,2 是示意（老師沒給）；A/B（250 ps、2.0 vs 500 ps、1.2）、
// A/B/C 類 CPI 1、2、3 與兩個 sequence、0.85⁴、SPEC 表（課本 AMD Opteron X4 2356 的 12 個 integer 程式）照老師與課本。
scene('isA-4a-perf', '4A：response time、throughput、CPU time', [
  async (tok, S) => { // 18.2 效能要有衡量標準
    S.h = hd('怎麼衡量一台電腦的效能？', 0, 6.4);
    S.pc = prop('cpu', 0, 3.6, 0, 1.2, 'computer');
    cap('效能：先定義衡量的標準', '常用的有兩種');
  },
  async (tok, S) => { // 22.5 response time
    S.r = hot('① Response time', -4.2, 5.5);
    S.job = bx('job', FC.purple, -6.4, 3.8, 0, 1.0);
    await slide(tok, S.job, -1.4, 3.8, 0, 700);
    S.r2 = sm('丟進去 → 多久拿到結果', -4.2, 2.8);
    cap('Response time', '東西丟進去，要多久才拿到結果');
  },
  async (tok, S) => { // 24.3 throughput
    S.t = hot('② Throughput', 4.2, 5.5);
    cap('第二種：throughput', '');
  },
  async (tok, S) => { // 75.9 單位時間做多少事
    S.jobs = [];
    for (let k = 0; k < 4; k++) { S.jobs.push(bx('job', FC.blue, 2.6 + k * 1.1, 1.6, 0, 0.9, 0.45, 0.6)); await wt(tok, 150); }
    S.t2 = sm('單位時間完成幾件事（work done）', 4.2, 2.6);
    cap('Throughput：單位時間做多少事', '例如每秒完成幾個 job');
  },
  async (tok, S) => { // 86.7 本課偏重 response time
    S.r3 = note('本課偏重 response time', -4.2, 1.6);
    glow(S.job, HL);
    cap('這門課主要看 response time', '');
  },
  async (tok, S) => { // 98.4 牆上的鐘：CPU、I/O、idle
    gone(S.h, S.pc, S.r, S.job, S.r2, S.t, S.jobs, S.t2, S.r3);
    S.h = hd('牆上時鐘量到的時間（elapsed time）', 0, 6.4);
    S.cpu = bx('CPU', FC.blue, -3.0, 4.0, 0, 4.0, 0.7, 0.8);
    S.io = bx('I/O', FC.orange, 0.95, 4.0, 0, 3.0, 0.7, 0.8);
    S.idle = bx('idle', FC.gray, 3.75, 4.0, 0, 2.2, 0.7, 0.8);
    cap('牆上的鐘：丟進去到結果出來', '裡面有 CPU、I/O、idle 的時間');
  },
  async (tok, S) => { // 107.4 只看 CPU
    await Promise.all([slide(tok, S.io, 0.95, 2.6, 0, 500), slide(tok, S.idle, 3.75, 2.6, 0, 500)]);
    tint(S.io, FC.gray); tint(S.idle, FC.gray); glow(S.cpu, HL);
    S.n1 = hot('CPU time：只算 CPU 真正在做事的時間', -1.0, 5.0);
    cap('要看 CPU 的效能', '把 I/O、idle 去掉 → CPU time');
  },
  async (tok, S) => { // 117 用 clock 來數
    S.ticks = [];
    for (let i = 0; i < 12; i++) { S.ticks.push(bx('', i % 2 ? FC.tan : '#6e5f49', -4.8 + i * 0.33 + 0.165, 3.3, 0, 0.3, 0.18, 0.6)); }
    S.n2 = sm('用 clock 來數：12 個 clock cycle（示意）', -3.0, 2.8);
    cap('用 clock 來衡量', '跑完要幾個 clock、每個 clock 多久');
  },
  async (tok, S) => { // 137.2 CPU time = cycles × period
    S.f1 = hot('CPU time = clock cycles × clock period', 0, 1.4);
    S.f1b = sm('示意：12 × 0.5 ns = ' + +(12 * 0.5).toFixed(3) + ' ns', 0, 0.8);
    cap('CPU time = cycles × clock period', '');
  },
  async (tok, S) => { // 144.2 clock frequency = 1 / period
    const f = 1 / 0.5e-9;
    S.f2 = note('clock rate（frequency）= 1 ÷ clock period', 0, 0.1);
    S.f2b = sm('1 ÷ 0.5 ns = ' + f / 1e9 + ' GHz', 0, -0.5);
    cap('clock frequency 是 period 的倒數', '');
  },
  async (tok, S) => { // 171.1 CPU time = cycles ÷ rate
    const t = 12 / 2e9;
    S.f3 = hot('CPU time = clock cycles ÷ clock rate', 0, -1.1);
    S.f3b = ok(near(t, 6e-9), 0, -1.7, '12 ÷ 2 GHz = ' + +(t * 1e9).toFixed(6) + ' ns，和上面一樣 ✓');
    cap('也可以寫成 cycles ÷ clock rate', '兩種寫法算出同一個 CPU time');
  },
]);

scene('isA-4a-cpi', '4A：Instruction count 與 CPI', [
  async (tok, S) => { // 190.4 clock 太低階
    S.h = hd('clock 太低階：programmer 想在 instruction level 算', 0, 6.4);
    S.ticks = [];
    for (let i = 0; i < 12; i++) S.ticks.push(bx('', i % 2 ? FC.tan : '#6e5f49', -5.4 + i * 0.75 + 0.375, 1.2, 0, 0.7, 0.2, 0.6));
    S.tl = sm('12 個 clock cycle（示意）', -3.2, 0.6);
    cap('只數 clock 太低階', '想從「指令」的角度算 CPU time');
  },
  async (tok, S) => { // 202.6 IC 與 CPI
    S.k = hot('Instruction count（IC）、CPI', -2.0, 5.6);
    cap('兩個量：instruction count 和 CPI', '');
  },
  async (tok, S) => { // 225.4 CPI 定義
    const w = 2 * 0.75;
    S.b = [bx('I1', FC.blue, -5.4 + w / 2, 2.0, 0, w - 0.08, 0.6, 0.7)];
    S.bt = [sm('2 cyc', -5.4 + w / 2, 2.7)];
    S.d = note('CPI = Clocks Per Instruction：一個指令要幾個 clock', -2.0, 4.9);
    cap('CPI：一個 instruction 要幾個 clock', '才能把它跑完');
  },
  async (tok, S) => { // 238.6 ISA 是介面
    S.sw = bx('software', FC.mint, 4.8, 4.9, 0, 2.6, 0.55, 0.7);
    S.isa = bx('ISA', FC.gold, 4.8, 4.2, 0, 2.6, 0.55, 0.7);
    S.hw = bx('hardware', FC.sky, 4.8, 3.5, 0, 2.6, 0.55, 0.7);
    glow(S.isa, HL);
    cap('ISA：software 與 hardware 的 interface', '軟硬體都照 ISA 來做');
  },
  async (tok, S) => { // 263.2 每個指令 cycle 數不同
    const C = [2, 1, 3, 2, 2, 2], cols = [FC.blue, FC.green, FC.orange, FC.blue, FC.pink, FC.purple];
    let x = -5.4 + 2 * 0.75;
    for (let k = 1; k < C.length; k++) {
      const w = C[k] * 0.75;
      S.b.push(cube('I' + (k + 1), cols[k], [w - 0.08, 0.6, 0.7], x + w / 2, 2.0, 0, 1.5));
      S.bt.push(sm(C[k] + ' cyc', x + w / 2, 2.7));
      x += w; await wt(tok, 200);
    }
    S.C = C;
    cap('每個指令的 cycle 數不一樣', '看它多複雜、硬體 organization 怎麼做');
  },
  async (tok, S) => { // 273.8 平均就是 CPI
    const cyc = S.C.reduce((a, b) => a + b, 0), ic = S.C.length;
    S.avg = ok(cyc / ic === 2, 1.2, 0.0, 'CPI = ' + cyc + ' cycles ÷ ' + ic + ' 個指令 = ' + cyc / ic + ' ✓');
    cap('平均起來一個指令幾個 cycle', '這就是 CPI');
  },
  async (tok, S) => { // 313.2 IC × CPI = total cycles
    S.f1 = hot('IC × CPI = total number of cycles', -2.0, -0.7);
    S.f1b = sm('6 × 2 = ' + 6 * 2 + ' cycles ✓', 3.6, -0.7);
    cap('instruction count × CPI', '= 總共的 clock cycles');
  },
  async (tok, S) => { // 324.9 × cycle time = CPU time
    S.f2 = hot('CPU time = IC × CPI × clock cycle time', -1.4, -1.4);
    S.f2b = sm('示意：12 × 0.5 ns = ' + 12 * 0.5 + ' ns', 4.0, -1.4);
    cap('再乘 clock cycle time', '= CPU time');
  },
  async (tok, S) => { // 332.7 IC 受 program、ISA、compiler 影響
    S.i1 = note('IC ← program、instruction set、compiler', -2.0, 4.2);
    cap('IC 受誰影響？', 'program 寫法、ISA 設計、compiler 好不好');
  },
  async (tok, S) => { // 358.2 CPI 看 hardware
    glow(S.hw, HL); glow(S.isa, null);
    S.i2 = note('CPI ← hardware 怎麼設計（organization）', -2.0, 3.5);
    cap('CPI 主要看 hardware 怎麼 design', '也就是 organization');
  },
  async (tok, S) => { // 365.9 instruction mix
    S.i3 = sm('不同指令 CPI 不同 → 依 instruction mix 算平均', -2.0, 2.9);
    cap('不同 instruction 有不同 CPI', '要依 instruction mix 算平均');
  },
]);

scene('isA-4a-ab', '4A：同 ISA 的 A（250 ps, CPI 2.0）vs B（500 ps, CPI 1.2）', [
  async (tok, S) => { // 376 兩台 A、B
    S.h = hd('例：兩台電腦 A 與 B，ISA 一樣', 0, 6.6);
    S.A = buddy('A', '', FC.blue, -6.2, 3.3, 0, 0.8);
    S.B = buddy('B', '', FC.orange, -6.2, 0.6, 0, 0.8);
    cap('兩台 computer：A 和 B', 'same instruction set architecture');
  },
  async (tok, S) => { // 409.5 同 IC
    S.n1 = note('同 ISA + 同 program + 同 compiler → 指令數一樣，記作 I', 0.6, 5.8);
    cap('同 ISA、同 program、同 compiler', '產生的指令一樣多：I');
  },
  async (tok, S) => { // 433 不同 organization
    S.n2 = sm('例：都用 Intel（或 ARM）的指令集，但硬體做法不同', 0.6, 5.2);
    cap('為什麼會有 A、B 兩台？', '用不同的 organization 實作同一套指令');
  },
  async (tok, S) => { // 450.1 cycle time 250 vs 500
    const sc = 0.0034; S.sc = sc;
    S.ta = []; S.tb = [];
    for (let i = 0; i < 10; i++) S.ta.push(bx('', i % 2 ? FC.sky : FC.blue, -4.6 + 250 * sc * (i + 0.5), 3.0, 0, 250 * sc - 0.04, 0.18, 0.6));
    for (let i = 0; i < 5; i++) S.tb.push(bx('', i % 2 ? FC.peach : FC.orange, -4.6 + 500 * sc * (i + 0.5), 0.3, 0, 500 * sc - 0.04, 0.18, 0.6));
    S.la = sm('A：cycle time 250 ps（clock 快）', -1.4, 4.4); S.lb = sm('B：cycle time 500 ps（clock 慢）', -1.4, 1.7);
    cap('A：250 ps，B：500 ps', 'A 的 clock 跑得比較快');
  },
  async (tok, S) => { // 462.9 A 的 CPI 2.0
    txt(S.la, 'A：cycle time 250 ps，CPI 2.0'); S.A.set('2.0');
    cap('A 跑得快，一件事要比較多 cycle', '平均每個指令 2 個 cycle');
  },
  async (tok, S) => { // 479.6 B 的 CPI 1.2
    txt(S.lb, 'B：cycle time 500 ps，CPI 1.2'); S.B.set('1.2');
    cap('B 的 cycle 比較長', '一個 cycle 做比較多事：CPI 1.2');
  },
  async (tok, S) => { // 496.5 要算 CPU time
    S.f = hot('哪台快？算 CPU time = IC × CPI × cycle time', 0.6, -0.9);
    cap('哪一台比較快？', '把 CPU time 算出來');
  },
  async (tok, S) => { // 541.6 A = 500·I ps
    const per = 2.0 * 250; S.pa = per;
    for (let k = 0; k < 5; k++) { cube('I' + (k + 1), FC.blue, [per * S.sc - 0.08, 0.5, 0.6], -4.6 + per * S.sc * (k + 0.5), 3.55, 0, 1.2); await wt(tok, 120); }
    S.ra = ok(per === 500, 4.8, 3.55, 'I × 2.0 × 250 = 500·I ps ✓');
    cap('A：I × 2.0 × 250 ps', '= 500·I ps');
  },
  async (tok, S) => { // 551.6 B = 600·I ps
    const per = 1.2 * 500; S.pb = per;
    for (let k = 0; k < 5; k++) { cube('I' + (k + 1), FC.orange, [per * S.sc - 0.08, 0.5, 0.6], -4.6 + per * S.sc * (k + 0.5), 0.85, 0, 1.2); await wt(tok, 120); }
    S.rb = ok(near(per, 600), 4.8, -0.2, 'I × 1.2 × 500 = 600·I ps ✓');
    cap('B：I × 1.2 × 500 ps', '= 600·I ps');
  },
  async (tok, S) => { // 569.3 A 比較快
    S.A.mood('happy'); await S.A.hop(tok);
    S.g = good('A 比較快（500·I < 600·I）', -3.0, -1.6);
    cap('A 比較快', '即使它每個指令要比較多 cycle');
  },
  async (tok, S) => { // 595.2 B 的時間放分子
    const r = S.pb / S.pa;
    S.r = ok(near(r, 1.2), 2.6, -1.6, 'A 比 B 快 = 600·I ÷ 500·I = ' + +r.toFixed(6) + ' 倍 ✓');
    cap('A 比 B 快幾倍：B 的時間放分子', '600 ÷ 500 = 1.2 倍');
  },
]);

scene('isA-4a-class', '4A：依指令類別加權的 CPI（A/B/C 類）', [
  async (tok, S) => { // 624.7 剛剛是平均 CPI
    S.h = hd('剛剛用的是「平均」CPI', 0, 6.6);
    cap('剛剛只給一個平均 CPI', '再更仔細一點來看');
  },
  async (tok, S) => { // 639.5 乘法 vs 加法、load/store
    S.e = [bx('add', FC.green, -4.6, 5.6, 0, 0.9), bx('mul', FC.orange, -2.6, 5.6, 0, 2.2), bx('lw / sw → memory', FC.purple, 1.4, 5.6, 0, 3.0)];
    S.e2 = sm('寬度 = 需要的 cycle（示意）', 4.8, 5.6);
    cap('乘法和加法怎麼會一樣快？', 'load/store 還要到 memory 拿資料');
  },
  async (tok, S) => { // 662.8 分類
    S.c1 = note('把指令分類：每一類有自己的 CPI', -1.6, 4.9);
    cap('把 instruction 分類', '同一類的 CPI 一樣');
  },
  async (tok, S) => { // 686.7 Σ CPI_i × IC_i
    S.f1 = hot('Clock cycles = Σ（CPI_i × IC_i）', -1.6, 4.3);
    cap('每一類的 CPI × 它的指令數', '全部加起來 = 總 cycles');
  },
  async (tok, S) => { // 726.4 平均 CPI
    S.f2 = hot('平均 CPI = 總 cycles ÷ IC = Σ CPI_i × 該類比例', -0.6, 3.7);
    cap('平均 CPI = 總 cycles ÷ 總指令數', '= 每類 CPI × 出現比例，再加總');
  },
  async (tok, S) => { // 755 A B C 的 CPI 1 2 3
    gone(S.e, S.e2);
    S.cpi = [1, 2, 3]; const cc = [FC.blue, FC.purple, FC.orange]; S.cc = cc;
    S.tab = ['A', 'B', 'C'].map((n, k) => bx(n + '：CPI ' + S.cpi[k], cc[k], -4.4 + k * 2.6, 5.6, 0, 2.3));
    cap('例：A、B、C 三類', 'CPI 分別是 1、2、3');
  },
  async (tok, S) => { // 777.2 兩個 sequence 的 IC
    S.n = [[2, 1, 2], [4, 1, 1]];
    S.s1 = hd('Sequence 1：A 2 個、B 1 個、C 2 個', -1.6, 2.6);
    S.s2 = hd('Sequence 2：A 4 個、B 1 個、C 1 個', -1.6, 0.4);
    cap('兩個 sequence（不同 compiler 產生）', '各類指令數不同');
  },
  async (tok, S) => { // 799.7 seq1 = 10 cycles
    let x = -6.0; const sc = 0.62; S.blk = [];
    for (let k = 0; k < 3; k++) for (let i = 0; i < S.n[0][k]; i++) { const w = S.cpi[k] * sc; S.blk.push(cube('ABC'[k], S.cc[k], [w - 0.05, 0.55, 0.7], x + w / 2, 1.8, 0, 1.2)); x += w; await wt(tok, 120); }
    const cyc = S.n[0].reduce((s, n, k) => s + n * S.cpi[k], 0); S.cyc1 = cyc;
    S.r1 = ok(cyc === 10, 4.0, 1.8, '2×1 + 1×2 + 2×3 = ' + cyc + ' cycles ✓');
    cap('Sequence 1：2×1 + 1×2 + 2×3', '= 10 個 cycles');
  },
  async (tok, S) => { // 813 CPI 2.0
    const ic = S.n[0].reduce((a, b) => a + b, 0);
    S.q1 = ok(S.cyc1 / ic === 2, 4.0, 1.2, 'CPI = ' + S.cyc1 + ' ÷ ' + ic + ' = ' + (S.cyc1 / ic).toFixed(1) + ' ✓');
    cap('5 個指令：10 ÷ 5', '平均 CPI = 2.0');
  },
  async (tok, S) => { // 822.5 seq2 = 9 cycles
    let x = -6.0; const sc = 0.62;
    for (let k = 0; k < 3; k++) for (let i = 0; i < S.n[1][k]; i++) { const w = S.cpi[k] * sc; S.blk.push(cube('ABC'[k], S.cc[k], [w - 0.05, 0.55, 0.7], x + w / 2, -0.4, 0, 1.2)); x += w; await wt(tok, 120); }
    const cyc = S.n[1].reduce((s, n, k) => s + n * S.cpi[k], 0); S.cyc2 = cyc;
    S.r2 = ok(cyc === 9, 4.0, -0.4, '4×1 + 1×2 + 1×3 = ' + cyc + ' cycles ✓');
    cap('Sequence 2：4×1 + 1×2 + 1×3', '= 9 個 cycles');
  },
  async (tok, S) => { // 838.6 CPI 1.5
    const ic = S.n[1].reduce((a, b) => a + b, 0);
    S.q2 = ok(S.cyc2 / ic === 1.5, 4.0, -1.0, 'CPI = ' + S.cyc2 + ' ÷ ' + ic + ' = ' + S.cyc2 / ic + ' ✓');
    S.g = good('Sequence 2 指令比較多（6 > 5），cycles 卻比較少（9 < 10）', -0.6, -1.8);
    cap('6 個指令：9 ÷ 6 = 1.5', '指令多不代表比較慢');
  },
  async (tok, S) => { // 845.3 套公式
    S.k = note('給每一類的 IC 和 CPI → 用這個公式算', -1.6, 3.2);
    cap('只要知道每類的指令數和 CPI', '就用這個公式算');
  },
]);

const F_ROWS = ['Program', 'Compiler', 'ISA', 'Organization', 'Technology'];
const F_COLS = ['Instruction count', 'CPI', 'Clock rate'];
scene('isA-4a-factor', '4A：誰影響 IC、CPI、clock rate', [
  async (tok, S) => { // 862.3 總表
    S.h = hot('CPU time = IC × CPI × clock period', 0, 6.7);
    F_COLS.forEach((c, j) => hd(c, -0.4 + j * 2.7, 6.0));
    S.cells = F_ROWS.map((r, i) => { hd(r, -4.7, 5.1 - i * 0.95); return F_COLS.map((c, j) => bx('', FC.sand, -0.4 + j * 2.7, 5.1 - i * 0.95, 0, 2.0, 0.5, 0.6)); });
    S.mark = (i, j, yes, why) => {
      const m = S.cells[i][j]; tint(m, yes ? FC.green : FC.gray);
      m.userData.lbl = small(lab.label(yes ? '✓' : '✗', 'val'), 13); m.add(m.userData.lbl);
      glow(m, HL); if (S.last) glow(S.last, null); S.last = m;
      if (S.why) gone(S.why); S.why = sm(why, 0, 0.0);
    };
    cap('這幾個東西各影響哪一項？', 'program、compiler、ISA、organization、technology');
  },
  async (tok, S) => { S.mark(0, 0, true, 'Program 寫法、algorithm 不同 → 指令數不同'); cap('Program 會影響 instruction count', '你寫 100 行、別人寫 50 行'); }, // 891.6
  async (tok, S) => { S.mark(0, 1, true, '一個用一堆加、一個用乘 → 指令種類不同，CPI 不同'); cap('Program 也會影響 CPI', '用到的指令種類不一樣'); }, // 953.2
  async (tok, S) => { S.mark(0, 2, false, 'clock rate 看硬體怎麼 implement'); cap('Program 不影響 clock rate', 'clock rate 跟 organization 有關'); }, // 991.9
  async (tok, S) => { S.mark(1, 0, true, '不同 compiler、有沒有 optimization → 產生的指令不同'); cap('Compiler 產生 instruction', '所以影響 instruction count'); }, // 1032.5
  async (tok, S) => { S.mark(1, 1, true, '產生的指令種類、數量不同 → CPI 也不同'); cap('Compiler 也影響 CPI', ''); }, // 1051.7
  async (tok, S) => { S.mark(1, 2, false, 'clock rate 跟 implementation 有關'); cap('Compiler 不影響 clock rate', ''); }, // 1060.2
  async (tok, S) => { // 1067.2 ISA 是分界
    S.div = line([[-6, 2.65, 0.4], [7, 2.65, 0.4]], '#d64545');
    S.d1 = note('ISA 以上：software（影響 IC、CPI）', 3.6, 3.0); S.d2 = note('以下：hardware（才影響 clock rate）', 3.6, 2.3);
    cap('ISA 是 software／hardware 的分界', '往下的 organization 才跟 clock rate 有關');
  },
  async (tok, S) => { gone(S.d1, S.d2); S.mark(2, 0, true, '只有「加、shift」的 ISA：乘法要用很多個加和 shift'); cap('ISA 會影響 instruction count', '有沒有乘法指令，差很多'); }, // 1087.3
  async (tok, S) => { S.mark(2, 1, true, '指令不同 → 每個指令的 cycle 數不同'); S.isaNote = sm('ISA × clock rate：課堂表沒勾（P&H 課本有勾）', 4.4, 2.95); cap('ISA 也影響 CPI', ''); }, // 1148.9
  async (tok, S) => { // 1156.1 organization 是什麼
    gone(S.why); S.why = sm('Organization：依 ISA 把硬體實際做出來', 0, 0.0);
    glow(S.cells[3][0], HL); glow(S.cells[3][1], HL); glow(S.cells[3][2], HL);
    cap('Organization：照 ISA 做出硬體', '要做加、減、乘，就實作出來');
  },
  async (tok, S) => { S.cells[3].forEach((m) => glow(m, null)); S.mark(3, 0, false, '指令數在 software 那一層就決定了'); cap('Organization 不影響 instruction count', ''); }, // 1222.3
  async (tok, S) => { S.mark(3, 1, true, '同一個 32-bit 加法：carry ripple（硬體少、慢）vs carry lookahead（像樹、快）'); cap('Organization 影響 CPI', 'carry ripple vs carry lookahead adder'); }, // 1243.6
  async (tok, S) => { S.mark(3, 2, true, '硬體設計決定一個 clock 要多長'); cap('Organization 也影響 clock rate', ''); }, // 1297.2
  async (tok, S) => { S.mark(4, 2, true, 'Technology：送去製程（例如台積電）'); cap('Technology 影響 clock rate', ''); }, // 1312.9
  async (tok, S) => { gone(S.why); S.why = sm('feature size 越小 → 電路跑越快 → clock period 變小', 0, 0.0); cap('製程進步、feature size 變小', 'cycle 數一樣，但 clock period 變小'); }, // 1368
  async (tok, S) => { if (S.last) glow(S.last, null); S.sum = hot('這張表 = IC、CPI、clock rate 與軟硬體介面的總整理', 0, -0.7); cap('總結這張表', '搞懂它就搞懂三者的關係'); }, // 1387.9
]);

scene('isA-4a-power', '4A：Power ∝ C·V²·f 與 power wall', [
  async (tok, S) => { // 1416 power 也重要
    S.h = hd('除了 CPU time，還有 power', 0, 6.6);
    cap('另一個很重要的 issue：power', '早期不重要，近年變成關鍵');
  },
  async (tok, S) => { // 1440.9 Intel 25 年
    S.bars = [];
    const clk = [0.4, 0.7, 1.1, 1.7, 2.6, 3.6, 4.6, 4.7], pw = [0.3, 0.5, 0.9, 1.4, 2.2, 3.4, 3.5, 3.5];
    for (let k = 0; k < 8; k++) { const a = bar(FC.blue, 0.38, 0.6, -5.6 + k * 0.9, 0), b = bar(FC.red, 0.38, 0.6, -5.2 + k * 0.9, 0); S.bars.push(a, b); await Promise.all([growBar(tok, a, clk[k], 150), growBar(tok, b, pw[k], 150)]); }
    S.l = sm('藍 = clock rate、紅 = power（各代 Intel，示意）', -2.4, 5.6);
    cap('Intel 各代：clock rate 和 power 一起上升', '最近兩代才變平');
  },
  async (tok, S) => { // 1472.1 dynamic vs static
    S.dy = bx('Dynamic power', FC.orange, 3.4, 4.6, 0, 2.6); S.st = bx('Static power', FC.gray, 3.4, 3.7, 0, 2.6);
    S.st2 = sm('不動也在漏電：leakage', 5.0, 3.15);
    cap('Power 分兩大部分', 'dynamic 與 static（漏電流 leakage）');
  },
  async (tok, S) => { // 1491.7 CMOS 0↔1 充放電
    S.bit = bx('0', FC.sky, 3.4, 2.4, 0, 0.8, 0.6, 0.6);
    for (const v of ['1', '0', '1']) { await wt(tok, 300); relabel(S.bit, v); tint(S.bit, v === '1' ? FC.orange : FC.sky); }
    S.bt = sm('0→1、1→0：對 output capacitance 充電、放電', 3.4, 1.7);
    cap('Dynamic：CMOS 從 0 變 1、1 變 0', '充放電時消耗 power');
  },
  async (tok, S) => { // 1508.1 公式
    gone(S.bars, S.l, S.dy, S.st, S.st2, S.bit, S.bt);
    S.f = hot('Dynamic power ∝ C × V² × f', 0, 6.0);
    S.bC = bar('#9b7ef4', 1.3, 1.0, -4.2, 0); S.bV = bar(FC.orange, 1.3, 1.0, -1.6, 0); S.bF = bar(FC.blue, 1.3, 1.0, 1.0, 0); S.bP = bar(FC.red, 1.6, 1.2, 4.2, 0);
    S.lc = sm('C capacitive load', -4.2, -0.5); S.lv = sm('V²', -1.6, -0.5); S.lf = sm('f frequency', 1.0, -0.5); S.lp = sm('Power', 4.2, -0.5);
    await Promise.all([growBar(tok, S.bC, 1.5, 500), growBar(tok, S.bV, 1.5, 500), growBar(tok, S.bF, 1.5, 500), growBar(tok, S.bP, 2.2, 500)]);
    cap('跟三樣東西有關', 'capacitive loading × voltage² × frequency');
  },
  async (tok, S) => { // 1515.7 capacitive loading：fan-out、面積
    S.n1 = note('C：一個 gate 的 output 接越多個（fan-out）、面積越大 → C 越大', -1.2, 5.3);
    glow(S.bC, HL);
    cap('Capacitive loading', '跟 fan-out、面積有很大的關係');
  },
  async (tok, S) => { // 1538.5 voltage
    glow(S.bC, null); glow(S.bV, HL);
    S.n2 = note('V：high voltage 代表 1、low 代表 0', -1.2, 4.7);
    cap('Voltage：多高叫 1、多低叫 0', '');
  },
  async (tok, S) => { // 1553.8 f ×1000、power ×30
    glow(S.bV, null);
    await Promise.all([growBar(tok, S.bF, 5.0, 800), growBar(tok, S.bP, 3.6, 800)]);
    S.x1 = sm('×1000', 1.0, 5.3 - 0.0); S.x2 = sm('×30', 4.2, 3.9);
    cap('25 年來：frequency 快了 1000 倍', 'dynamic power 卻只多了約 30 倍');
  },
  async (tok, S) => { // 1570.7 voltage 5V → 1V
    await growBar(tok, S.bV, 1.5 / 25, 700);
    const r = (1 / 5) ** 2;
    S.x3 = ok(near(r, 1 / 25), -1.6, 0.6, 'V²：(1V ÷ 5V)² = 1/' + Math.round(1 / r) + ' ✓');
    S.x4 = sm('1000 × 1/25 = ' + 1000 / 25 + '，和「約 30 倍」同一個量級', 0.4, 2.6);
    cap('秘訣：voltage 從 5V 降到 1V', '每代降約 15%，又是平方關係');
  },
  async (tok, S) => { // 1599.9 不能再降：leakage
    S.w = bad('V 降到約 1V 就降不下去：再降 leakage 變很大，關不緊', 0, -1.2);
    cap('最近沒辦法再降 voltage', '再降，leakage power 變很大');
  },
  async (tok, S) => { // 1632.8 power density、散熱
    S.w2 = bad('單位面積做更多運算 → power density 高 → 散熱變大問題', 0, -1.8);
    cap('power 降不下來，運算又更密', 'power density 變高，散熱成問題');
  },
  async (tok, S) => { // 1666.3 例：都變 85%
    gone(S.f, S.bC, S.bV, S.bF, S.bP, S.lc, S.lv, S.lf, S.lp, S.n1, S.n2, S.x1, S.x2, S.x3, S.x4, S.w, S.w2);
    S.f = hot('例：新 CPU 的 C、V、f 都是舊的 85%', 0, 6.0);
    S.cb = cube('P', FC.red, [2.4, 2.4, 2.4], 0, 1.4, 0);
    S.lt = hd('P = 1.00', 0, 3.8);
    let s = 1;
    for (const nm of ['C', 'V', 'V', 'f']) { s *= 0.85; const k = Math.cbrt(s); S.cb.scale.set(k, k, k); S.cb.position.y = 1.4 * k; txt(S.lt, '× 0.85（' + nm + '）→ ' + s.toFixed(3)); await wt(tok, 450); }
    S.s = s;
    cap('C × 0.85、V² × 0.85²、f × 0.85', '一個一個乘上去');
  },
  async (tok, S) => { // 1683.7 0.52
    S.r = ok(near(S.s, 0.85 ** 4), 0, -0.6, 'P_new ÷ P_old = 0.85 × 0.85² × 0.85 = 0.85⁴ ≈ ' + S.s.toFixed(2) + ' ✓');
    cap('Power 降到約 0.52', '電壓是平方項，降壓效果最大');
  },
  async (tok, S) => { // 1696.9 power wall
    S.w = bad('但 leakage 讓 V 降不下去 → 熱 → cooling 很貴（power wall）', 0, -1.3);
    cap('voltage 降不下去，power 就降不下去', '散熱太貴，變成發展的阻礙');
  },
]);

scene('isA-4a-multi', '4A：uniprocessor → multi-core', [
  async (tok, S) => { // 1740.5 改走 multi-core
    S.h = hd('為了 power：近年改走 multi-core', 0, 6.6);
    cap('近幾年的方向變了', '不再拚縮小 feature size，改走 multi-core');
  },
  async (tok, S) => { // 1752.3 每年 1.5 倍
    S.b = []; let v = 1;
    for (let k = 0; k < 6; k++) { v *= 1.5; const m = bar(FC.blue, 0.7, 0.7, -5.6 + k * 0.9, 0); S.b.push(m); await growBar(tok, m, Math.log(v) * 1.3 + 0.2, 150); }
    S.v = v; S.l1 = sm('uniprocessor：2002 前每年約 ×1.5', -3.4, 5.2);
    cap('Uniprocessor：一顆晶片一個 core', '2002 年前每年效能約 1.5 倍');
  },
  async (tok, S) => { // 1770.3 只剩 1.2
    let v = S.v;
    for (let k = 0; k < 4; k++) { v *= 1.2; const m = bar(FC.orange, 0.7, 0.7, -0.2 + k * 0.9, 0); S.b.push(m); await growBar(tok, m, Math.log(v) * 1.3 + 0.2, 150); }
    S.l2 = sm('之後只剩每年約 ×1.2', 1.2, 5.2);
    S.l3 = note('原因：power、instruction-level parallelism、memory latency', 0.6, 4.4);
    cap('2002 之後只剩約 1.2 倍', 'power、ILP、memory latency 卡住');
  },
  async (tok, S) => { // 1798.5 multi-core
    gone(S.b, S.l1, S.l2, S.l3);
    S.cores = [];
    for (let k = 0; k < 4; k++) { S.cores.push(cube('core ' + k, '#6e5f49', [2.2, 0.5, 1.4], -4.2 + k * 2.8, 0.3, 0, 2)); await wt(tok, 150); }
    S.chip = sm('一顆 microprocessor 裡有好幾個 core（2 個、4 個…）', 0, 1.4);
    cap('2004 之後：multi-core microprocessor', '一顆晶片好幾個 core，平行做事');
  },
  async (tok, S) => { // 1845.8 以前程式不用改
    S.p = note('以前（uniprocessor）：程式一行都不用改，換新 CPU 就變快', 0, 5.4);
    cap('以前只要 processor 變快', '舊程式一行 code 不改就變快');
  },
  async (tok, S) => { // 1897.8 責任到 programmer
    S.p2 = bad('multi-core：要變快的責任跑到 programmer 身上', 0, 4.8);
    cap('現在變成 multiprocessor', '責任都跑到 programmer');
  },
  async (tok, S) => { // 1919.2 一行不改 → response time 沒變
    S.j1 = cube('job 1', FC.purple, [1.6, 0.5, 1.0], -4.2, 0.85, 0, 2.5);
    S.q = sm('一行都不改：同一個 job 丟進去，時間一樣 → response time 沒變', 0, 3.4);
    cap('程式不改，多加兩、四個 core', '單一 job 的 response time 沒變');
  },
  async (tok, S) => { // 1961.3 throughput
    S.j2 = cube('job 2', FC.purple, [1.6, 0.5, 1.0], -1.4, 0.85, 0, 2.5);
    S.g = good('同時跑兩個 job → throughput ↑', 0, 2.7);
    cap('增加的是 throughput', '單位時間可以做更多事');
  },
  async (tok, S) => { // 1978.8 降 clock、省 power
    S.g2 = sm('同時做兩件事 → 也可以把 clock 調慢一點 → power 降低', 0, 2.1);
    cap('一次能做兩個 job', '可以把 clock frequency 降低，省 power');
  },
  async (tok, S) => { // 1998.5 parallel programming
    gone(S.cores, S.chip, S.j1, S.j2, S.q, S.g, S.g2);
    S.c0 = cube('core 1', '#6e5f49', [2.6, 0.5, 1.4], -2.4, 0.3, 0); S.c1 = cube('core 2', '#6e5f49', [2.6, 0.5, 1.4], 2.4, 0.3, 0);
    S.pp = hot('要改進 response time → parallel programming', 0, 3.6);
    cap('要改進 response time', '得寫 parallel program');
  },
  async (tok, S) => { // 2016 拆開
    S.A = cube('A', FC.green, [2.0, 0.6, 1.0], -2.4, 0.9, 0, 3); S.B = cube('B', FC.blue, [1.2, 0.6, 1.0], 2.4, 0.9, 0, 3);
    S.s1 = sm('找出可以平行的部分，拆開分給不同 core', 0, 3.0);
    cap('看哪裡可以平行化', '把工作拆開，寫成不同的 code');
  },
  async (tok, S) => { // 2030.5 load balancing
    S.lb = bad('load balancing：A 大、B 小 → core 2 會閒著，要平均分配', 0, 2.4);
    cap('要注意 load balancing', '工作要分得平均');
  },
  async (tok, S) => { // 2046.3 synchronization
    await wt(tok, 300);
    S.C = cube('C', FC.pink, [2.4, 0.6, 1.0], 0, 1.9, 0, 3);
    S.sy = note('synchronization：A、B 都做完，才能做 C', 0, 4.4);
    cap('還有 communication 與 synchronization', 'A、B 都做完才能做 C');
  },
]);

scene('isA-4a-bench', '4A：benchmark 與 SPEC', [
  async (tok, S) => { // 2104.2 怎麼量
    S.h = hd('CPU time、power 都定義好了 → 到底怎麼量？', 0, 6.6);
    cap('怎麼衡量機器是好還是壞？', '');
  },
  async (tok, S) => { // 2164.7 run 程式
    S.f = prop('file', -2.2, 3.2, 0, 1.2, 'program'); S.c = prop('cpu', 1.8, 3.4, 0, 1.4, 'A、B、C 機器');
    cap('拿一個 program 去 run', '看它跑得快還是慢');
  },
  async (tok, S) => { // 2242.2 矩陣相乘好不好
    S.mx = note('例：拿「矩陣相乘」程式去測，好不好？', 0, 5.6);
    cap('用這個 program 測好不好？', '好，也不好');
  },
  async (tok, S) => { // 2268.4 看 workload
    S.b1 = buddy('科學家', '', FC.green, -4.6, 0.4, 0, 0.7); S.b2 = buddy('作家', '', FC.orange, 4.6, 0.4, 0, 0.7);
    S.b1.mood('happy'); S.b2.mood('sad');
    S.w1 = good('常算矩陣 → 有意義', -4.6, 2.4); S.w2 = bad('很少算 → 沒意義', 4.6, 2.4);
    cap('要看你平常做什麼', '科學家常做矩陣相乘，作家很少');
  },
  async (tok, S) => { // 2292.6 workload
    S.wl = hot('依自己的 workload 來測：engineer → compiler、spreadsheet；author → word processing', 0, -0.9);
    cap('根據你的 workload 測', '不同的人需求不同');
  },
  async (tok, S) => { // 2316.7 benchmark
    gone(S.mx, S.b1, S.b2, S.w1, S.w2, S.wl);
    S.set = []; for (let k = 0; k < 4; k++) { S.set.push(prop('file', -3.0 + k * 1.1, 0.0, 0, 0.8)); await wt(tok, 120); }
    S.bk = hot('Benchmark：已經寫好的一組程式', -1.4, 1.6);
    cap('自己建 workload 太辛苦', '所以有寫好的 benchmarks');
  },
  async (tok, S) => { // 2359.3 各公司自己做沒公信力
    S.no = bad('A 公司、B 公司各自做 benchmark → 挑對自己有利的，沒有公信力', 0, 5.6);
    cap('每家公司都自己做 benchmark？', '只挑對自己有利的，沒公信力');
  },
  async (tok, S) => { // 2391.7 industry standard → SPEC
    S.sp = good('Industry standard：大家集資開一個公司 → SPEC', 0, 5.0);
    cap('需要 industry standard', '共同出錢成立 SPEC，大家用同一組測');
  },
  async (tok, S) => { // 2455 1989、SPEC2006
    S.d = note('1989 年開始；最新 SPEC2006：CPU（integer、floating point）、HPC、client-server、mail…', 0, 4.4);
    cap('SPEC：1989 年開始做 benchmark', 'SPEC2006 測 CPU 的 integer 與 FP 等');
  },
  async (tok, S) => { // 2493.6 trick：針對 benchmark 優化
    S.t1 = bad('問題 1：benchmark 是公開的 → compiler、library 專門對它做 optimization', 0, -0.7);
    cap('benchmarking 也有 trick', '專門針對那些 code 做最佳化，就不準');
  },
  async (tok, S) => { // 2531.5 system configuration
    S.t2 = bad('問題 2：結果也受 system configuration 影響；規格可能對某台機器有利', 0, -1.3);
    cap('還跟 system configuration 有關', '測試規格也可能偏袒某台機器');
  },
  async (tok, S) => { // 2553 small set、要換
    S.t3 = bad('問題 3：只是一小組程式，cover 不了全部 → 要定期更換', 0, -1.9);
    cap('benchmark 只是很小的 set', '一陣子就要換，不然大家只優化它');
  },
  async (tok, S) => { // 2572 研究所也做 benchmarking
    S.r = note('做研究、做實驗也一樣：影像處理有標準圖，大家用同一組比', 0, 3.6);
    cap('將來做研究也要 benchmarking', '不同領域有自己的 benchmark set');
  },
]);

// 課本（P&H）SPEC CPU2006 integer on AMD Opteron X4 2356：reference time、execution time（秒）
const SPEC_X4 = [['perl', 9770, 637], ['bzip2', 9650, 817], ['gcc', 8050, 724], ['mcf', 9120, 1345], ['go', 10490, 721], ['hmmer', 9330, 890],
  ['sjeng', 12100, 837], ['libquantum', 20720, 1047], ['h264avc', 22130, 993], ['omnetpp', 6250, 690], ['astar', 7020, 773], ['xalancbmk', 6900, 1143]];
scene('isA-4a-ratio', '4A：SPECratio 與 geometric mean', [
  async (tok, S) => { // 2614.7 SPEC CPU2006 integer
    S.h = hd('例：SPEC CPU2006 的 integer 部分', 0, 6.6);
    cap('做 CPU 的 benchmarking', '用 SPEC2006 的 integer 程式');
  },
  async (tok, S) => { // 2629.7 AMD X4
    S.c = prop('cpu', -5.4, 4.6, 0, 1.0, 'AMD X4');
    cap('要測的是 AMD 的 X4', '把這組 benchmark 拿到機器上 run');
  },
  async (tok, S) => { // 2648.5 收集的資料
    S.cols = mt('program     IC×CPI×cycle → exec time   ref time   ratio', -0.6, 5.6, 11, 'ptr');
    S.row = mt('perl        …                → 637 s       ', -0.6, 5.0, 11);
    cap('收集 IC、CPI、clock cycle time', '算出 execution time（perl：637 s）');
  },
  async (tok, S) => { // 2664.8 reference time
    txt(S.row, 'perl        …                → 637 s       9770 s');
    S.rf = note('reference machine：A、B 都跟同一台比，不比絕對值', -0.6, 4.3);
    cap('reference time：一台參考機器跑的時間', 'A 對它比、B 對它比，就能比 A 和 B');
  },
  async (tok, S) => { // 2692.2 SPECratio
    const r = 9770 / 637;
    txt(S.row, 'perl        …                → 637 s       9770 s    ' + r.toFixed(1));
    S.f = ok(near(+r.toFixed(1), 15.3), -0.6, 3.6, 'SPECratio = reference time ÷ execution time = 9770 ÷ 637 = ' + r.toFixed(1) + ' ✓（越大越好）');
    cap('SPECratio = 參考時間 ÷ 執行時間', 'perl 是 15.3，越大越好');
  },
  async (tok, S) => { // 2715 geometric mean
    gone(S.cols, S.row, S.rf);
    S.rs = SPEC_X4.map(([, ref, ex]) => ref / ex);
    S.bars = [];
    for (let k = 0; k < S.rs.length; k++) {
      const m = bar(FC.blue, 0.6, 0.6, -6.0 + k * 1.0, -0.5); S.bars.push(m);
      S.bars.push(small(tag(SPEC_X4[k][0], 'idx', -6.0 + k * 1.0, -0.3, 0.6), 9));
      await growBar(tok, m, S.rs[k] * 0.2, 90);
    }
    S.gm = Math.exp(S.rs.reduce((s, x) => s + Math.log(x), 0) / S.rs.length);
    S.lg = line([[-6.4, S.gm * 0.2, -0.1], [5.4, S.gm * 0.2, -0.1]], '#d64545');
    S.g = ok(near(+S.gm.toFixed(1), 11.7), 1.6, 5.6, 'geometric mean = ¹²√(15.3 × 11.8 × … × 6.0) = ' + S.gm.toFixed(1) + ' ✓');
    cap('加總：geometric mean', '全部 ratio 乘起來，再開 n 次方根');
  },
  async (tok, S) => { // 2734.1 arithmetic mean 對照
    const am = S.rs.reduce((a, b) => a + b, 0) / S.rs.length;
    S.am = sm('對照：arithmetic mean（加起來 ÷ 12）= ' + am.toFixed(1), 1.6, 5.0);
    cap('加總有很多方法', 'arithmetic mean 是加起來除以 n');
  },
  async (tok, S) => { // 2765.1 你也做同樣的 process
    S.t = note('課本表格：AMD X4 的 12 個程式（數字來自 P&H）', 1.6, 4.4);
    cap('這是 X4 的結果表', '你設計 processor 也做同樣的流程');
  },
  async (tok, S) => { // 2780.5 只看 summary
    S.s = good('只看 summary：你 10、我 11 → 這組 benchmark 我比較好', 0, 6.6 - 0.0);
    gone(S.h);
    cap('最後只要比 summary 那個數字', '你 10、我 11：我比較好');
  },
]);

scene('isA-4a-spow', '4A：SPEC power（ssj_ops ÷ watts）', [
  async (tok, S) => { // 2795.2 power benchmark
    S.h = hd('SPEC power：不能只看 power，也要看 performance', 0, 6.6);
    cap('Power 的 benchmark', '要同時看 performance 和 power');
  },
  async (tok, S) => { // 2808.7 記錄 throughput、power
    S.l = sm('藍 = ssj_ops（每秒完成的 operation，throughput）；橘 = watts', 0, 5.9);
    cap('記錄兩樣：throughput', '和每秒消耗多少 power');
  },
  async (tok, S) => { // 2819.7 每 10% 一個 load
    S.loads = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0]; S.ops = []; S.pw = [];
    for (let k = 0; k < S.loads.length; k++) {
      const x = -5.6 + k * 1.1;
      S.ops.push(bar(FC.blue, 0.42, 0.6, x - 0.22, 0)); S.pw.push(bar(FC.orange, 0.42, 0.6, x + 0.22, 0));
      small(tag(S.loads[k] + '%', 'idx', x, -0.4, 0.8), 9);
    }
    cap('不同的工作 loading', '從 100%、90%…到 0%，每 10% run 一次');
  },
  async (tok, S) => { // 2851.3 X4 結果
    for (let k = 0; k < S.loads.length; k++) await Promise.all([growBar(tok, S.ops[k], S.loads[k] / 100 * 4.6, 120), growBar(tok, S.pw[k], (0.48 + 0.52 * S.loads[k] / 100) * 4.0, 120)]);
    S.x = sm('X4：load 降低，ops 一路降，power 降得慢（高度示意）', 0, 5.3);
    cap('同一顆 X4 的結果', 'loading 往下，performance、power 都往下');
  },
  async (tok, S) => { // 2874.8 Σ ops ÷ Σ power
    S.f = hot('overall = Σ ssj_ops ÷ Σ power：每一瓦能做多少事', 0, 4.6);
    cap('加總：全部 load 的 operation 加起來', '除以全部的 power：每瓦做多少事');
  },
  async (tok, S) => { // 2916.8 0% 也耗電
    glow(S.pw[10], HL);
    S.z = bad('0% load：沒做任何事，卻還在耗電', 3.4, 3.4);
    cap('看 0 的時候', 'performance 是 0，power 卻不是 0');
  },
  async (tok, S) => { // 2931.3 static leakage
    S.z2 = note('原因：static power（leakage 漏電）', 3.4, 2.8);
    cap('為什麼？static power', '電晶體關不緊，一直在漏電');
  },
  async (tok, S) => { // 2957.3 漏電比例大
    S.z3 = sm('voltage 已降到約 1V，漏電占 power 很大的比例 → 研究要解決', 0, -1.2);
    cap('漏電占很大比例', '怎麼解決是現在研究的題目');
  },
]);

// ════════ SbLPeJMK_d8（第 4B 講：IC 成本與 yield、Amdahl's law、兩個 fallacy、ISA 入門、MIPS 算術指令與暫存器） ════════
// 老師的數字：wafer 100 元、100 個 die、yield 90%；面積 1000 的 wafer 切 100 → 10 顆、切 50 → 20 顆（ASR 聽成 100，依「10 顆、20 顆」推回 1000）；
// 5 顆灰塵；台北→高雄 0.5 + 4 + 0.5 = 5 h、飛機 1 h；100 s 中乘法 80 s 想快 5 倍；load 50% → 83%、10% → 61%、0% → 141 W；
// MIPS 比較的指令數、秒數是示意。暫存器編號依課本（ASR 的「16 到 22」「28 到 34」更正為 16–23、28–31）。
function ingot(x, y) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 24), new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.35 }));
  m.rotation.z = Math.PI / 2; m.position.set(x, y, 0); lab.world.add(m); return m;
}
function wafer(x, y, r, color = '#b9c2d0') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, 0); lab.world.add(m); return m;
}
// dies on a wafer: a grid of small squares inside the circle
function dies(cx, cy, r, side) {
  const out = [];
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const x = cx + (i + 0.5) * side, y = cy + (j + 0.5) * side;
    const far = Math.max(...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => Math.hypot(x + a * side / 2 - cx, y + b * side / 2 - cy)));
    if (far <= r) out.push(cube('', FC.blue, [side * 0.86, side * 0.86, 0.06], x, y, 0.08));
  }
  return out;
}
scene('isA-4b-mfg', '4B：晶片怎麼做出來與 yield', [
  async (tok, S) => { // 18.1 效能好 → 也看 cost
    S.h = hd('效能好，還要看價錢：cost 怎麼算？', 0, 6.6);
    cap('除了 performance', '也要考慮 cost');
  },
  async (tok, S) => { // 21.8 silicon ingot
    S.ing = ingot(-5.0, 4.2); S.l1 = sm('silicon ingot（像香腸），直徑 8～12 inch', -5.0, 3.2);
    cap('IC 製造：先有一根 silicon ingot', '長長的，像香腸');
  },
  async (tok, S) => { // 47.1 切片 → blank wafer
    S.w0 = []; for (let k = 0; k < 3; k++) { S.w0.push(wafer(-2.4 + k * 0.35, 4.2, 0.55, '#c9d3dc')); await wt(tok, 150); }
    S.l2 = sm('slicer 切成一片片 blank wafer', -1.9, 3.2);
    cap('切成一片一片', '叫 blank wafer');
  },
  async (tok, S) => { // 62.8 20～40 道製程
    S.l3 = note('送進晶圓廠：20～40 道 processing steps，每層一個光罩（mask）', 2.4, 5.6);
    S.masks = []; for (let k = 0; k < 4; k++) { S.masks.push(bx('mask ' + (k + 1), FC.lilac, 1.4 + k * 1.1, 4.6, 0, 0.95, 0.45, 0.2)); await wt(tok, 150); }
    cap('每一道步驟都要一個 mask', '照設計的形狀做出 transistor 和 wire');
  },
  async (tok, S) => { // 94.5 化學製程 → patterned wafer
    S.w = wafer(-3.6, 1.0, 1.5); S.d = dies(-3.6, 1.0, 1.5, 0.42);
    S.l4 = sm('patterned wafer：上面重複做很多個 die', -3.6, -0.8);
    cap('光照加化學處理，一層層做完', '一片 wafer 上重複做很多顆 chip（die）');
  },
  async (tok, S) => { // 107.4 測試：好的、壞的
    S.bad = [3, 11, 17, 26, 31].filter((i) => i < S.d.length);
    S.bad.forEach((i) => tint(S.d[i], FC.red));
    S.l5 = sm('wafer tester：找出不能動的 die（紅）', 0.6, 1.9);
    cap('做出來先測試', '有的 die 好、有的壞');
  },
  async (tok, S) => { // 121.6 切割、丟掉壞的
    for (const i of S.bad) { kill(S.d[i]); await wt(tok, 100); }
    S.l6 = sm('dicer 切開，壞的丟掉', 0.6, 1.3);
    cap('切割（dicing）', '壞的丟掉');
  },
  async (tok, S) => { // 128.9 packaging
    S.pk = prop('cpu', 3.4, -0.4, 0, 1.1, 'packaged');
    S.l7 = sm('feature size 太小摸不到 → 包裝、拉出接腳', 3.4, 1.9 - 1.6);
    cap('再做 packaging', 'die 太小，沒辦法直接跟外面連線');
  },
  async (tok, S) => { // 141.2 再測一次
    S.l8 = sm('包好再測一次 → 出貨', 3.4, -0.9);
    cap('包裝好再測一次', '這就是整個 manufacturing process');
  },
  async (tok, S) => { // 151.2 yield
    S.y = hot('yield = 好的 die ÷ 全部的 die', 2.6, 6.0 - 0.6);
    S.y2 = ok(90 / 100 === 0.9, 2.6, 4.8 - 0.6, '例：做 100 顆、90 顆好 → yield = 90% ✓');
    gone(S.masks, S.l3);
    cap('不是每一顆都好', '好的比例叫 yield');
  },
  async (tok, S) => { // 171 yield 越高技術越好
    S.y3 = sm('yield 90% 以上 vs 只有 50%：一半要丟掉', 2.6, 4.2 - 0.6);
    cap('yield 越高，製程技術越好', '只有 50% 的話，100 顆要丟 50 顆');
  },
]);

scene('isA-4b-cost', '4B：cost per die、dies per wafer、defect 與面積', [
  async (tok, S) => { // 194.1 同一設計重複；X2 wafer
    S.w = wafer(-4.0, 3.0, 1.9); S.d = dies(-4.0, 3.0, 1.9, 0.36);
    S.l = sm('例：AMD X2 的 wafer：117 個 die（90 nm；圖為示意）', -4.0, 0.7);
    cap('一片 wafer 上是同一個設計', '重複做很多次，做完再切開');
  },
  async (tok, S) => { // 231.4 公式
    S.f = hot('Cost per die = Cost per wafer ÷（Dies per wafer × Yield）', 1.6, 6.4);
    cap('一顆 die 多少錢？', 'wafer 的錢 ÷ 好的 die 數');
  },
  async (tok, S) => { // 263.1 100 元、100 顆、90%
    const c = 100 / (100 * 0.9);
    S.e = note('例：一片 wafer 100 元，切出 100 個 die，yield 90%', 1.6, 5.6);
    S.e2 = ok(near(c, 100 / 90), 1.6, 5.0, '100 ÷ (100 × 0.9) = 100 ÷ 90 ≈ ' + c.toFixed(2) + ' 元 ✓');
    cap('100 塊錢的 wafer、100 顆、90% 好', '100 ÷ 90 ≈ 1.11 元一顆');
  },
  async (tok, S) => { // 281.9 dies per wafer ≈ wafer area ÷ die area
    S.f2 = hot('Dies per wafer ≈ Wafer area ÷ Die area', 1.6, 4.2);
    cap('一片 wafer 可以切幾顆？', '跟 die 的面積有關');
  },
  async (tok, S) => { // 325.8 面積 1000：100 → 10 顆、50 → 20 顆
    const a = 1000 / 100, b = 1000 / 50;
    S.g1 = []; for (let k = 0; k < a; k++) S.g1.push(bx('', FC.orange, -0.4 + (k % 5) * 0.8, 3.1 - Math.floor(k / 5) * 0.8, 0, 0.72, 0.72, 0.1));
    S.g2 = []; for (let k = 0; k < b; k++) S.g2.push(bx('', FC.green, 4.0 + (k % 5) * 0.56, 3.3 - Math.floor(k / 5) * 0.56, 0, 0.5, 0.5, 0.1));
    S.t1 = ok(a === 10, 1.2, 1.2, '面積 1000 ÷ 100 = ' + a + ' 顆 ✓'); S.t2 = ok(b === 20, 5.1, 0.8, '1000 ÷ 50 = ' + b + ' 顆 ✓');
    cap('die 越大，切得越少', '每顆 100 → 10 顆；每顆 50 → 20 顆');
  },
  async (tok, S) => { // 344.8 yield 跟 defect per area、die area
    S.f3 = hot('Yield 跟 defects per area、die area 有關', 1.6, 0.2);
    S.f4 = sm('課本：Yield = 1 ÷ (1 + defects per area × die area ÷ 2)²', 1.6, -0.4);
    cap('Yield 又跟什麼有關？', 'defect per area 和 die area');
  },
  async (tok, S) => { // 378.3 defect：clean room 裡的 particle
    S.p = []; const pts = [[-4.6, 3.8], [-3.2, 2.2], [-4.9, 2.0], [-3.4, 3.9], [-4.1, 2.9]];
    for (const [x, y] of pts) { S.p.push(cube('', '#3d3329', [0.14, 0.14, 0.14], x, y, 0.3, 2.5)); await wt(tok, 120); }
    S.pl = sm('clean room 裡還是有很小的 particle：掉到 chip 上就壞了', -4.0, -0.2);
    cap('feature size 只有 22 奈米', '一顆小灰塵掉上去，chip 就壞了');
  },
  async (tok, S) => { // 423.8 製程越好，defect rate 越低
    S.pr = note('製程控制越好 → defect rate 越低 → yield 越高（每家工廠有自己的值）', 1.6, -1.1);
    cap('製程越好，defect rate 越低', 'defect 越多，yield 越低');
  },
  async (tok, S) => { // 443.7 5 顆灰塵：5 顆大 die vs 100 顆小 die
    gone(S.w, S.d, S.l, S.p, S.pl, S.g1, S.g2, S.t1, S.t2, S.f3, S.f4, S.pr, S.e, S.e2, S.f2);
    S.big = []; for (let k = 0; k < 5; k++) S.big.push(bx('', FC.orange, -5.6 + k * 1.15, 2.6, 0, 1.05, 2.4, 0.1));
    S.sm = []; for (let k = 0; k < 100; k++) S.sm.push(bx('', FC.green, 0.4 + (k % 10) * 0.6, 4.4 - Math.floor(k / 10) * 0.6, 0, 0.54, 0.54, 0.1));
    const hitBig = [0, 1, 2, 3, 4], hitSm = [7, 23, 48, 66, 91];
    for (let k = 0; k < 5; k++) { tint(S.big[hitBig[k]], FC.red); tint(S.sm[hitSm[k]], FC.red); cube('', '#3d3329', [0.14, 0.14, 0.14], S.big[hitBig[k]].position.x, 2.6, 0.2); cube('', '#3d3329', [0.14, 0.14, 0.14], S.sm[hitSm[k]].position.x, S.sm[hitSm[k]].position.y, 0.2); await wt(tok, 150); }
    S.r1 = bad('5 顆大 die：最壞 5 顆全壞', -3.3, 0.8); S.r2 = ok(100 - 5 === 95, 3.1, -1.6, '100 顆小 die：至少 ' + (100 - 5) + ' 顆好 ✓');
    cap('同樣掉 5 顆灰塵（示意）', '大 die 很容易中；切成 100 顆，95 顆還是好的');
  },
  async (tok, S) => { // 488.8 面積是設計者控制
    S.a = note('面積是設計者決定的：area 越大 → yield 越低 → 每顆越貴', 0, 6.2);
    cap('Area 是我們設計者控制的', '面積越大，yield 越低，cost 越高');
  },
  async (tok, S) => { // 521.1 testing cost
    S.c1 = sm('＋ testing cost：做好還要測好壞', -3.3, -0.2);
    cap('另外還有 testing 的 cost', '');
  },
  async (tok, S) => { // 529.4 packaging cost
    S.c2 = sm('＋ packaging cost：bare die 摸不到，包裝後才有接腳', -3.3, -0.8);
    cap('還有 packaging 的 cost', '包裝過才有接腳，能插到電腦上');
  },
  async (tok, S) => { // 595.2 總結
    S.s = hot('chip cost ← die cost（area、yield）＋ testing ＋ packaging', 0, -2.4);
    cap('cost 主要跟 area 有關', '再和 performance 做 trade-off');
  },
]);

scene('isA-4b-amdahl', "4B：Amdahl's law（台北→高雄、乘法 80 s）", [
  async (tok, S) => { // 610.4 另一個公式
    S.h = hd("另一個效能公式：Amdahl's law", 0, 6.6);
    cap('課本後面補充的另一個公式', '先看一個例子');
  },
  async (tok, S) => { // 620.8 市區 0.5 h
    S.tp = bub('台北', -6.2, 4.4); S.kh = bub('高雄', 6.2, 4.4);
    S.a = bx('0.5h', FC.gray, -5.65, 3.6, 0, 0.66); S.al = sm('市區', -5.65, 4.2);
    cap('從台北到高雄', '先在市區走 0.5 小時才上高速公路');
  },
  async (tok, S) => { // 636.6 高速公路 4 h
    S.b = bx('高速公路 4 h', FC.blue, -2.5, 3.6, 0, 5.56);
    cap('高速公路要 4 小時', '');
  },
  async (tok, S) => { // 642.4 再 0.5 h，共 5 h
    S.c = bx('0.5h', FC.gray, 0.65, 3.6, 0, 0.66); S.cl = sm('市區', 0.65, 4.2);
    const tot = 0.5 + 4 + 0.5; S.tot = tot;
    S.t1 = ok(tot === 5, 4.0, 3.6, '0.5 + 4 + 0.5 = ' + tot + ' 小時 ✓');
    cap('下高速公路再 0.5 小時', '總共 5 小時');
  },
  async (tok, S) => { // 651.3 坐飛機：市區不能改進
    S.a2 = bx('0.5h', FC.gray, -5.65, 1.6, 0, 0.66);
    S.c2 = bx('0.5h', FC.gray, -2.85, 1.6, 0, 0.66); glow(S.a2, HL); glow(S.c2, HL);
    S.n = sm('不管開車還是坐飛機，市區這兩段都改進不了', -1.0, 0.8);
    cap('改坐飛機呢？', '兩頭市區的 0.5 小時改進不了');
  },
  async (tok, S) => { // 694.3 4 h → 1 h
    S.p = bx('飛機 1h', FC.orange, -4.6, 1.6, 0, 1.36); await slide(tok, S.c2, -3.55, 1.6, 0, 500);
    cap('能改進的只有中間那段', '高速公路 4 小時 → 飛機 1 小時');
  },
  async (tok, S) => { // 706 2 h → 2.5 倍
    const t2 = 0.5 + 1 + 0.5, sp = S.tot / t2;
    S.t2 = ok(t2 === 2 && sp === 2.5, 1.6, 1.6, '0.5 + 1 + 0.5 = ' + t2 + ' h → speedup = 5 ÷ 2 = ' + sp + ' ✓');
    cap('總共 2 小時', 'speedup = 5 ÷ 2 = 2.5 倍（不是 4 倍）');
  },
  async (tok, S) => { // 717.9 Amdahl's law
    S.law = note("Amdahl's law：只有「被改進的那部分」會變快，其餘時間不變", 0, -0.4);
    cap("這就是 Amdahl's law", '整體的改進受「沒被影響的部分」限制');
  },
  async (tok, S) => { // 768.9 公式
    gone(S.tp, S.kh, S.a, S.al, S.cl, S.b, S.c, S.t1, S.a2, S.c2, S.n, S.p, S.t2, S.law);
    S.f = hot('T_improved = T_affected ÷ improvement factor + T_unaffected', 0, 5.8);
    cap('寫成公式', '改進後時間 = 受影響的 ÷ 倍數 + 不受影響的');
  },
  async (tok, S) => { // 774.1 100 s 中乘法 80 s
    S.m = bx('乘法 80 s', FC.orange, -1.6, 3.8, 0, 8.0 * 0.8 - 0.05);
    S.m.position.x = -5.0 + 3.2; S.o = bx('其他 20 s', FC.gray, -5.0 + 6.4 + 0.8, 3.8, 0, 1.55);
    S.l = sm('程式共 100 s，其中乘法占 80 s', 0, 4.7);
    cap('例：程式跑 100 秒', '乘法佔了 80 秒');
  },
  async (tok, S) => { // 783.6 想快 5 倍 → 20 s
    S.g = note('希望整體快 5 倍：100 ÷ 5 = ' + 100 / 5 + ' s', 0, 2.8);
    cap('想要整體快 5 倍', '也就是只剩 20 秒，辦得到嗎？');
  },
  async (tok, S) => { // 803.9 80/n + 20 = 20 → 不可能
    S.e = hot('80 ÷ n + 20 = 20  →  80 ÷ n = 0', 0, 1.9);
    for (const n of [2, 4, 10, 100]) { S.m.scale.x = 1 / n; S.m.position.x = -5.0 + 3.2 / n; await wt(tok, 300); }
    const best = 80 / 1e9 + 20;
    S.x = bad('乘法再快，總時間也 > 20 s（n = 10⁹ 時還是 ' + best.toFixed(6) + ' s）→ 做不到', 0, 1.2);
    cap('那 20 秒不是乘法，改不了', '乘法再怎麼快，都達不到 5 倍');
  },
  async (tok, S) => { // 833 make the common case fast
    S.c = good('Make the common case fast', 0, 0.3);
    cap('Amdahl 告訴我們', 'make the common case fast');
  },
  async (tok, S) => { // 849.9 常用的才加速
    S.c2 = sm('加法、load/store 常用 → 值得加速；乘法只占 1% → 花大功夫只得到很小改進', 0, -0.4);
    cap('常用的動作才值得加速', '只佔 1% 的乘法，加速它不划算');
  },
  async (tok, S) => { // 872.8 profiling
    S.c3 = note('profiling：先量出哪裡最常跑，再把硬體（要花錢）放在那裡', 0, -1.1);
    cap('先做 profiling', '把要花錢的硬體放在常跑的地方');
  },
]);

scene('isA-4b-idle', '4B：Fallacy：閒著的時候很省電？', [
  async (tok, S) => { // 902.1 第二個：low power at idle
    S.h = hd('Fallacy：電腦閒著（low utilization）的時候很省電？', 0, 6.6);
    cap('第二個要注意的', '閒著的時候就是 low power，對嗎？');
  },
  async (tok, S) => { // 915.4 100%、50% → 83%、10% → 61%
    S.L = [[100, 100], [50, 83], [10, 61]]; S.b = [];
    for (let k = 0; k < S.L.length; k++) { const [ld, pw] = S.L[k]; const m = bar(FC.orange, 1.2, 0.8, -4.6 + k * 2.4, 0); S.b.push(m); small(tag('load ' + ld + '%', 'idx', -4.6 + k * 2.4, -0.4, 0.6), 10); await growBar(tok, m, pw / 100 * 4.5, 300); S.b.push(sm(pw + '% power', -4.6 + k * 2.4, pw / 100 * 4.5 + 0.4)); }
    cap('power 的 profiling', '50% load 還耗 83%、10% load 還耗 61%');
  },
  async (tok, S) => { // 931.6 0% 還要 141 W
    const m = bar(FC.orange, 1.2, 0.8, 2.6, 0); S.b.push(m); small(tag('load 0%', 'idx', 2.6, -0.4, 0.6), 10);
    await growBar(tok, m, 2.2, 300);
    S.z = sm('還要 141 W（高度示意）', 2.6, 2.6);
    cap('什麼都不做（0%）', '還要消耗 141 W');
  },
  async (tok, S) => { // 936 閒著省電是錯的
    S.n = bad('「閒著就 low power」是錯的', 4.6, 5.2);
    cap('所以「idle 時消耗很少」是不對的', '什麼都不做，並不表示 low power');
  },
  async (tok, S) => { // 949.4 power 要跟 loading 成比例
        S.pp = note('理想：power 跟 loading 成正比（load 低 → power 也低）', 0, 5.8);
    cap('能不能讓 power 跟 loading 成比例？', '現在的 processor 因為 leakage 做不到');
  },
  async (tok, S) => { // 976.3 Google data center 10～50%
    S.g = hot('Google data center：大部分時間 load 在 10%～50%，100% 只占約 1%', 0, -1.2);
    cap('Google 的 data center', '大多在 10～50% 的 load，滿載只有 1% 的時間');
  },
  async (tok, S) => { // 993.2 做到就很棒
    S.c = good('若 50% load 只要 50% power → 很棒的 processor（現在還做不到，是你們的 challenge）', 0, -1.9);
    cap('如果 power 跟 loading 成正比', '那就是很棒的 processor：你們的 challenge');
  },
]);

scene('isA-4b-mips', '4B：Fallacy：用 MIPS 當效能指標', [
  async (tok, S) => { // 1011.8 MIPS as performance metric
    S.h = hd('Fallacy：用 MIPS 當 performance 指標', 0, 6.6);
    cap('另一個不對的說法', '用 MIPS 當效能指標');
  },
  async (tok, S) => { // 1018.7 定義
    S.f = hot('MIPS = Million Instructions Per Second = IC ÷（執行時間 × 10⁶）', 0, 5.8);
    cap('MIPS：每秒幾百萬個指令', '這台 3 MIPS、那台 5 MIPS');
  },
  async (tok, S) => { // 1047.3 直覺：越高越快？
    S.A = buddy('A：2 MIPS', '', FC.blue, -3.6, 1.6, 0, 0.9); S.B = buddy('B：1 MIPS', '', FC.orange, 3.6, 1.6, 0, 0.9);
    S.q = sm('直覺：2 MIPS 一定比 1 MIPS 快？', 0, 4.8);
    cap('直覺上 MIPS 越高越快', '真的是這樣嗎？');
  },
  async (tok, S) => { // 1056.3 只算指令數
    S.w = note('MIPS 只數指令個數，不管指令複雜還是簡單', 0, 4.2);
    S.ia = sm('A：簡單指令，同一個程式要 10×10⁶ 個（示意）', -3.6, 0.9); S.ib = sm('B：複雜指令，只要 3×10⁶ 個（示意）', 3.6, 0.9);
    cap('MIPS 只算 instruction count', '指令有複雜有簡單');
  },
  async (tok, S) => { // 1067.7 要比執行時間
    const ta = 10e6 / (2 * 1e6), tb = 3e6 / (1 * 1e6);
    S.ta = sm('時間 = 10×10⁶ ÷ 2×10⁶ = ' + ta + ' s', -3.6, 0.3); S.tb = sm('時間 = 3×10⁶ ÷ 1×10⁶ = ' + tb + ' s', 3.6, 0.3);
    S.r = ok(tb < ta, 0, -0.6, 'B 的 MIPS 比較低，卻比較快（' + tb + ' s < ' + ta + ' s）✓');
    S.B.mood('happy'); S.A.mood('sad');
    cap('要比 execution time', '真正算出來的時間');
  },
  async (tok, S) => { // 1084.7 MIPS 不能反映效能
    S.c = bad('MIPS 簡單好用，但不能反映真正的 performance', 0, -1.3);
    cap('MIPS 不能反映真正效能', '還是要看執行時間');
  },
]);

scene('isA-4b-sum', '4B：本單元結論', [
  async (tok, S) => { // 1101.6 結論：cost/performance 進步
    S.h = hd('結論', 0, 6.6);
    S.c1 = sm('① technology 進步 → cost / performance 一直在改善', 0, 5.6);
    cap('這一章的結論', 'cost／performance 不斷改善');
  },
  async (tok, S) => { // 1116.3 Moore's law
    S.b = []; let n = 1;
    for (let k = 0; k < 7; k++) { const m = bar(FC.green, 0.7, 0.7, -3.0 + k * 1.0, 0); S.b.push(m); await growBar(tok, m, Math.log2(n) * 0.5 + 0.2, 120); n *= 2; }
    S.ml = note("Moore's law：transistor 數約每 1.5～2 年 ×2（老師說 1.5 年）", 0, 4.9);
    cap("哪一個 law？Moore's law", 'transistor 數量大約 1.5 年翻倍');
  },
  async (tok, S) => { // 1148.7 abstraction
    S.c2 = sm('② abstraction：把低層的複雜藏起來', -3.4, -1.0);
    cap('Abstraction', '把下面的複雜度藏起來，方便理解');
  },
  async (tok, S) => { // 1158.2 ISA
    S.c3 = sm('③ ISA：hardware / software 的 interface → 可以分開發展', 3.4, -1.0);
    cap('ISA 是軟硬體的介面', '定好之後，軟體、硬體可以各自開發');
  },
  async (tok, S) => { // 1170.8 execution time
    S.c4 = good('④ execution time 才是最好的效能衡量（MIPS 等都不是）', 0, -1.7);
    cap('執行時間是最好的效能指標', 'MIPS 那些都不是');
  },
  async (tok, S) => { // 1181.8 power
    S.c5 = bad('⑤ power 是限制：voltage 降不下去、散熱', -3.4, -2.4);
    cap('Power 是 limiting factor', '電壓降不下去，散熱要解決');
  },
  async (tok, S) => { // 1192.5 parallelism
    S.c6 = good('⑥ 用 parallelism（multi-core）提升效能', 3.4, -2.4);
    cap('現在用 parallelism', '來提升 performance');
  },
]);

scene('isA-4b-isa', '4B：Instruction set 入門：a = b + 5 變成 4 行', [
  async (tok, S) => { // 1219.8 這章：ISA → organization
    S.h = hd('這一章：把 instruction set 介紹完（以 MIPS 為例）', 0, 6.6);
    S.s1 = bx('Instruction set', FC.gold, -2.0, 5.4, 0, 3.0); S.s2 = bx('Organization（hardware）', FC.sky, 2.6, 5.4, 0, 3.6);
    S.ar = arrow(V3(-0.4, 5.4, 0.4), V3(0.7, 5.4, 0.4));
    cap('先介紹 instruction set', '後面才根據它設計 hardware');
  },
  async (tok, S) => { // 1253.8 computer architecture = ISA + organization
    S.ca = hot('Computer architecture = ISA + machine organization', 0, 4.6);
    cap('Computer architecture 有兩部分', 'ISA 和 machine organization');
  },
  async (tok, S) => { // 1278.8 programmer 看到的 assembly
    S.c = mt('C program  ──compiler──▶  assembly code', -1.6, 3.8, 12, 'note');
    cap('對 programmer 來說，ISA 就是 assembly', 'C 寫的程式經 compiler 變成 assembly');
  },
  async (tok, S) => { // 1300.9 operators
    S.cc = code(['a = b + 5;', 'x = (y * 3) % 7;'], -4.4, 2.6);
    S.op = sm('operator：+ − × ÷ %', -0.6, 2.6);
    cap('C 程式裡有 operator', '加、減、乘、除、modular');
  },
  async (tok, S) => { // 1314.4 operands
    S.od = sm('operand：variable（值會變）、constant', -0.6, 2.0);
    cap('operator 作用在 operand 上', 'operand 可以是 variable 或 constant');
  },
  async (tok, S) => { // 1339.1 expression、assignment
    S.ex = sm('expression = operator 作用在 operand；做完 assign 給 variable', -0.6, 1.4);
    cap('合起來是 expression', '結果再 assign 到另一個 variable');
  },
  async (tok, S) => { // 1361.2 a = b + 5 → 4 行
    S.cc.hl(0);
    S.as = code(['load  $r1, M[b]', 'load  $r2, 5', 'add   $r3, $r1, $r2', 'store $r3, M[a]'], 2.6, 2.6);
    S.as2 = sm('（一般的 assembly 寫法，示意）', 4.0, 0.2);
    cap('a = b + 5 寫成 assembly', '一行變成四行：load、load、add、store');
  },
  async (tok, S) => { // 1409.9 operands：memory、register、constant
    S.o1 = note('operand 從哪來：memory（M[b]）、register（$r1）、constant（5）', 0, -0.6);
    cap('這裡面都是 operand', 'memory 的資料、register、constant');
  },
  async (tok, S) => { // 1441.6 opcode
    S.as.hl(2);
    S.o2 = note('每行最前面：op code（要做什麼動作：load、add、store）', 0, -1.2);
    cap('還要描述做什麼動作', '這就是 op code（operator）');
  },
  async (tok, S) => { // 1462.8 每行對應硬體動作
    S.as.hl(-1);
    S.o3 = sm('為什麼切這麼細？每一行都對應一個 hardware 動作', 0, -1.8);
    cap('一行 C 要四行才做完', '因為每一行對應一個硬體動作');
  },
  async (tok, S) => { // 1477.4 ISA 包括：storage
    gone(S.cc, S.as, S.as2, S.op, S.od, S.ex, S.o1, S.o2, S.o3, S.c);
    S.k1 = bx('storage：幾個 register？memory 多大？怎麼 access？', FC.mint, 0, 3.6, 0, 9.0);
    cap('ISA 包括什麼？storage', 'register 要 32 個還是 16 個、memory 怎麼存取');
  },
  async (tok, S) => { // 1543.4 data type
    S.k2 = bx('data type：同一串 0101，當 integer 或 floating point 意思不同', FC.lilac, 0, 2.9, 0, 9.0);
    cap('Data type 怎麼定義', '同樣的 01 pattern，整數和浮點數意義不同');
  },
  async (tok, S) => { // 1594.9 instruction format
    S.k3 = bx('instruction format：多長？32 bits、16 bits，還是有長有短？', FC.sky, 0, 2.2, 0, 9.0);
    cap('Instruction format', '每個指令多長、怎麼排');
  },
  async (tok, S) => { // 1616.1 operations
    S.k4 = bx('operations：load、store、add、sub、mul、div…允許哪些？', FC.peach, 0, 1.5, 0, 9.0);
    cap('Operation', '這個 processor 允許做哪些動作');
  },
  async (tok, S) => { // 1640.2 MIPS：三種 format，都是 32 bits
    S.m = []; for (let k = 0; k < 3; k++) S.m.push(bx(['R', 'I', 'J'][k] + '：32 bits', FC.green, -4.0, 0.4 - k * 0.65, 0, 2.6, 0.5, 0.6));
    S.ml = good('MIPS：只有三種 format，全部一樣長 32 bits', -4.0, -1.6);
    cap('這門課用 MIPS 當例子', '只有三種 format，都是 32 bits');
  },
  async (tok, S) => { // 1674.3 Intel 有長有短
    let x = -1.0; S.x = [];
    for (const w of [1, 3, 6, 2, 4, 1.5]) { S.x.push(bx('', FC.orange, x + w * 0.21, 0.4, 0, w * 0.42 - 0.05, 0.5, 0.6)); x += w * 0.42; }
    S.xl = bad('Intel x86：有長有短 → 硬體要花 overhead 判斷', 3.6, -0.5);
    cap('Intel 的指令有長有短', '越複雜，hardware 要花越多力氣辨認');
  },
]);

scene('isA-4b-arith', '4B：MIPS 算術指令：add / sub 與 f = (g + h) − (i + j)', [
  async (tok, S) => { // 1732 operand 從哪來
    S.h = hd('MIPS 的 operand：register、memory、constant（immediate）', 0, 6.6);
    cap('先看 operand', '從 register、memory 或 constant 來');
  },
  async (tok, S) => { // 1755.8 語法：4 個 field
    S.ins = ['add', 'a', 'b', 'c'].map((t, k) => bx(t, [FC.gold, FC.green, FC.blue, FC.blue][k], -3.3 + k * 2.2, 4.6, 0, 1.9, 0.7, 0.7));
    cap('算術指令的文法', '四個 field');
  },
  async (tok, S) => { // 1794.6 op 在前、destination
    S.l1 = sm('operation（op）', -3.3, 3.8); S.l2 = sm('destination：結果放哪', -1.1, 3.8);
    glow(S.ins[0], HL); glow(S.ins[1], HL);
    cap('第一個寫動作：add', '第二個是 destination：結果放哪裡');
  },
  async (tok, S) => { // 1807.1 兩個 source
    S.l3 = sm('source 1', 1.1, 3.8); S.l4 = sm('source 2', 3.3, 3.8);
    glow(S.ins[0], null); glow(S.ins[1], null); glow(S.ins[2], HL); glow(S.ins[3], HL);
    cap('第三、四個是兩個 source', '');
  },
  async (tok, S) => { // 1815.8 意思：a = b + c
    S.ins.forEach((m) => glow(m, null));
    S.mean = hot('add a, b, c  的意思是  a = b + c', 0, 2.9);
    cap('把兩個 source 加起來', '放到 destination');
  },
  async (tok, S) => { // 1824.9 32 bits、一定 1 op + 3 operand
    S.r = note('每個 instruction 都是 32 bits；格式很嚴格：1 個 operator ＋ 3 個 operand', 0, 2.2);
    cap('格式很嚴格', '一個 operator、三個 operand，都是 32 bits');
  },
  async (tok, S) => { // 1857.6 C 加很多個 → 要拆
    S.no = bad('add a, b, c, d, e ✗  不能一直加下去 → 要拆成好幾條', 0, 1.5);
    cap('C 裡一次加四、五個呢？', '不行，只能拆開寫');
  },
  async (tok, S) => { // 1928.1 regularity → 硬體簡單
    S.rg = sm('格式都一樣 → 硬體讀出前面固定的 bits 就知道是什麼 op code', 0, 0.8);
    cap('為什麼這麼嚴格？', '格式 regular，硬體一看就認得');
  },
  async (tok, S) => { // 1957.8 design principle 1
    S.p1 = good('Design Principle 1：Simplicity favors regularity', 0, 0.1);
    cap('第一個 design principle', 'simplicity favors regularity');
  },
  async (tok, S) => { // 1986.6 簡單 → 快又便宜
    S.p2 = sm('簡單 → 判斷少、area 小 → high performance、low cost', 0, -0.5);
    cap('簡單讓硬體小又快', 'high performance、low cost');
  },
  async (tok, S) => { // 2010.4 f = (g + h) − (i + j)
    gone(S.ins, S.l1, S.l2, S.l3, S.l4, S.mean, S.r, S.no, S.rg, S.p1, S.p2);
    S.c = mt('f = (g + h) − (i + j);', 0, 5.4, 14, 'note');
    S.c2 = sm('四個 operand，但一條指令只能有兩個 source', 0, 4.8);
    cap('例：f = (g + h) − (i + j)', '一條指令只能有兩個 source，要拆開');
  },
  async (tok, S) => { // 2032.6 add t0, g, h
    S.l = [mt('add  t0, g, h      # t0 = g + h', -0.2, 3.6, 13)];
    cap('先算 g + h', '放到 temporary：t0');
  },
  async (tok, S) => { // 2040.1 add t1, i, j
    S.l.push(mt('add  t1, i, j      # t1 = i + j', -0.2, 2.9, 13));
    cap('再算 i + j', '放到 t1');
  },
  async (tok, S) => { // 2049.2 sub f, t0, t1
    S.l.push(mt('sub  f, t0, t1     # f = t0 − t1', -0.2, 2.2, 13));
    S.d = good('一個 C statement → 三個 MIPS 指令', 0, 1.2);
    cap('最後 t0 − t1 放到 f', '一行 C 變成三個指令');
  },
]);

scene('isA-4b-regs', '4B：Register operand：為什麼要用 register', [
  async (tok, S) => { // 2072 assembly 沒有 variable
    S.h = hd('assembly 沒有 variable：operand 要放在固定的地方', 0, 6.6);
    cap('剛剛的 t0、g、h、f 只是名字', 'assembly 沒有 variable，要放在固定位置');
  },
  async (tok, S) => { // 2103.6 只能在 register
    S.n = hot('add 這類指令：operand 只能放在 register 裡', 0, 5.8);
    cap('算術指令的 operand', '只能從 register 拿');
  },
  async (tok, S) => { // 2137.6 register file 靠近 ALU
    S.cpu = zone('CPU（processor chip）', -2.6, -0.3, 0, 6.6, 3.6, '#efe4d0');
    S.alu = bx('ALU（加法器）', FC.orange, -4.2, 0.4, 0, 2.2, 0.8, 0.9);
    S.rf = []; for (let k = 0; k < 8; k++) S.rf.push(bx('', RCOL(8 + k), -1.7 + (k % 4) * 0.62, 0.8 - Math.floor(k / 4) * 0.62, 0, 0.55, 0.5, 0.6));
    S.rfl = sm('register file：就在 ALU 旁邊', -0.8, 1.6);
    cap('Register file', '就建在運算單元旁邊的特別位置');
  },
  async (tok, S) => { // 2164 memory 是另一顆 chip
    S.mem = prop('warehouse', 4.6, -0.6, 0, 1.3, 'memory chip');
    S.ar = arrow(V3(0.7, 0.4, 0.5), V3(3.4, 0.4, 0.5), 0xd64545);
    S.ml = bad('off-chip：跑出 processor 去拿，很花時間', 3.2, 2.6);
    cap('Memory 是另一顆 chip', '要 off-chip 去拿資料，很慢');
  },
  async (tok, S) => { // 2212.6 好處 1：faster
    S.b1 = good('① register 比 memory 快', -4.0, 5.0);
    cap('用 register 的好處一', '比 memory 快很多');
  },
  async (tok, S) => { // 2229.8 好處 2：compiler 好用
    S.b2 = good('② compiler 好用：t0、t1 這種暫存就放 register', 0.6, 5.0);
    cap('好處二：compiler 容易用', '算到一半的暫存值就放 register');
  },
  async (tok, S) => { // 2261.1 好處 3：減少 memory traffic
    S.b3 = good('③ variable 放 register → 少跑 memory（reduce memory traffic）', -1.2, 4.4);
    cap('好處三：減少 memory traffic', '不用一直去 memory 搬資料');
  },
  async (tok, S) => { // 2288.9 好處 4：code density
    S.b4 = good('④ code density：指定位置要的 bits 比較少', -1.2, 3.8);
    cap('好處四：improve code density', '描述 operand 位置用的 bits 少');
  },
  async (tok, S) => { // 2346.7 150 個人 → 8 bits
    const b = Math.ceil(Math.log2(150));
    S.id = ok(2 ** b >= 150 && 2 ** (b - 1) < 150, 3.0, 3.0, '班上 150 人編號：2^' + b + ' = ' + 2 ** b + ' ≥ 150 → 要 ' + b + ' bits ✓');
    S.mm = sm('memory 很大：32-bit address 要 32 bits', 3.0, 2.4);
    cap('編號越多，要越多 bits', '150 個人要 8 bits；記憶體位址要 32 bits');
  },
  async (tok, S) => { // 2382.9 32 個 register → 5 bits
    const b = Math.log2(32);
    S.r5 = ok(b === 5, 3.0, 1.8, '只有 32 個 register：2⁵ = 32 → 5 bits ✓');
    cap('只有 32 個 register', '5 個 bits 就能指定是哪一個');
  },
]);

scene('isA-4b-mregs', '4B：MIPS 的 32 個 register 與用途', [
  async (tok, S) => { // 2435.5 32 個 → 5 bits
    S.h = hd('MIPS：32 個 register → 編號要 5 bits', 0, 6.6);
    S.g = []; S.gl = [];
    for (let i = 0; i < 32; i++) { const x = -5.2 + (i % 8) * 1.4, y = 4.8 - Math.floor(i / 8) * 1.0; S.g.push(bx(String(i), FC.gray, x, y, 0, 1.2, 0.5, 0.6)); S.gl.push(small(tag(RN[i], 'idx', x, y + 0.42), 9)); }
    cap('MIPS 有 32 個 register', '要 5 個 bits 指定');
  },
  async (tok, S) => { // 2458.6 64 → 6 bits、128 → 7 bits
    S.t = sm('64 個 → ' + Math.log2(64) + ' bits；128 個 → ' + Math.log2(128) + ' bits', 0, 0.4);
    cap('想要 64、128 個？', '比較 flexible，但要 6、7 個 bits');
  },
  async (tok, S) => { // 2506.8 三個 register = 15 bits
    S.t2 = ok(3 * 5 === 15, 0, -0.2, 'add 要指定 3 個 register：3 × 5 = ' + 3 * 5 + ' bits（32 個時）✓');
    cap('一個指令要描述三個 register', '5 bits × 3 = 15 bits，越多越佔位置');
  },
  async (tok, S) => { // 2542.4 32 個、每個 32 bits
    S.t3 = note('MIPS：32 個 register，每個 32 bits（data、instruction 也都是 32 bits）', 0, -0.8);
    cap('MIPS 選 32 個 register', '每個 register 是 32 bits');
  },
  async (tok, S) => { // 2560.2 smaller is faster
    S.t4 = good('Design Principle 2：Smaller is faster', 0, -1.4);
    cap('為什麼不要 64 個？', '越大越慢：smaller is faster');
  },
  async (tok, S) => { // 2611.2 word
    S.t5 = sm('32 bits 叫一個 word：存取 register、memory 都以 word 為單位', 0, -2.0);
    cap('32 bits 叫做一個 word', '讀進讀出都是一個 word');
  },
  async (tok, S) => { // 2631 編號 0～31 或名字
    gone(S.t, S.t2, S.t3, S.t4, S.t5);
    S.n = note('可以用編號 $0～$31，也可以用名字（$s0 就是第 16 個）', 0, 0.4);
    cap('用 0 到 31 號稱呼', '也可以給名字');
  },
  async (tok, S) => { // 2656.9 $s0～$s7 = 16～23
    for (let i = 16; i <= 23; i++) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    S.s = sm('$s0～$s7 = 16～23：放一般的 variable', 0, -0.2);
    cap('$s0～$s7（16～23 號）', '對應程式裡的 variable');
  },
  async (tok, S) => { // 2671.7 $t0～$t7 = 8～15
    for (let i = 16; i <= 23; i++) glow(S.g[i], null);
    for (let i = 8; i <= 15; i++) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    S.t = sm('$t0～$t7 = 8～15：temporary（算到一半的暫存）', 0, -0.8);
    cap('$t0～$t7（8～15 號）', '放 temporary 的值');
  },
  async (tok, S) => { // 2700.5 $zero
    for (let i = 8; i <= 15; i++) glow(S.g[i], null);
    tint(S.g[0], '#bdb3a2'); glow(S.g[0], HL); relabel(S.g[0], '0');
    S.z = sm('$zero：永遠是 0（0 太常用，直接放一個）', 0, -1.4);
    cap('第 0 個 register', '永遠是 constant 0');
  },
  async (tok, S) => { // 2721.3 $v、$a：procedure
    glow(S.g[0], null);
    for (const i of [2, 3, 4, 5, 6, 7]) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    S.a = sm('$v0–$v1（2–3）回傳值、$a0–$a3（4–7）參數：寫 procedure 時用', 0, -2.0);
    cap('2～7 號：procedure call 用', '放參數與回傳值');
  },
  async (tok, S) => { // 2756.6 OS、pointer、$ra
    for (const i of [2, 3, 4, 5, 6, 7]) glow(S.g[i], null);
    for (const i of [1, 26, 27, 28, 29, 30, 31]) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    S.o = sm('$at、$k0–$k1 給 assembler／OS；$gp、$sp、$fp 指標；$ra 返回位址（28–31）', 0, -2.6);
    cap('其他是特殊用途', 'OS 用的、指標、return address');
  },
  async (tok, S) => { // 2781.7 整體 organization
    gone(S.g, S.gl, S.n, S.s, S.t, S.z, S.a, S.o);
    S.mem = prop('warehouse', -5.0, 1.0, 0, 1.4, 'Memory');
    S.cpu = zone('CPU', 0.4, 0.2, 0, 5.4, 4.4, '#efe4d0');
    S.rr = bx('Registers $0～$31', FC.green, -0.6, 2.6, 0, 2.6); S.al = bx('Arithmetic unit', FC.orange, -0.6, 1.6, 0, 2.6);
    S.hl = bx('Hi / Lo（乘除結果）', FC.purple, 2.0, 1.6, 0, 2.2, 0.55, 0.7);
    S.cp = bx('Coprocessor 1：floating point', FC.sky, 5.6, 2.2, 0, 2.6, 1.0, 0.8);
    S.hn = sm('乘法結果變長、除法有商和餘數 → 放 Hi、Lo', 0.4, -1.0);
    cap('MIPS 的整體 organization', 'memory、CPU 的 register、Hi/Lo，FP 在 coprocessor');
  },
]);

// ════════ Ri-K2287x2U（第 5A 講：R-type 回顧、f = (g+h)−(i+j)、四種 register architecture、memory operand、base + offset、lw/sw） ════════
// 老師的數字：$s0 = 1000、offset 12 → 1012、Mem[1012] = 999、$t0 = 25 存到 1012、A[8] offset 32、A[12] offset 48。
// g、h、i、j 的值與 A 的起始位址 1000、A[8] 的內容 30 是示意；C = A + B 的 A = 2、B = 5 也是示意。指令都用本章的 exec() 真的執行。
scene('isA-5a-review', '5A：回顧：算術指令與 32 個 register', [
  async (tok, S) => { // 20 第一種指令：ALU 運算
    S.h = hd('回顧：MIPS 第一種指令：加減、邏輯（ALU operation）', 0, 6.6);
    S.ins = ['op', 'dest', 'src1', 'src2'].map((t, k) => bx(t, [FC.gold, FC.green, FC.blue, FC.blue][k], -3.3 + k * 2.2, 5.0, 0, 1.9, 0.7, 0.7));
    cap('上次介紹的第一種指令', '在 ALU 做加減、邏輯運算');
  },
  async (tok, S) => { // 37.6 四個 field
    S.e = mt('add  $t0,  $s1,  $s2', 0, 4.0, 14, 'note');
    cap('四個 field', 'op code、destination、source 1、source 2');
  },
  async (tok, S) => { // 58.8 都要是 register
    [1, 2, 3].forEach((k) => glow(S.ins[k], HL));
    S.r = hot('後面三個一定要是 register', 0, 3.3);
    cap('destination 和兩個 source', '一定都要是 register');
  },
  async (tok, S) => { // 84.4 32 個 → 5 bits
    S.g = [];
    for (let i = 0; i < 32; i++) { const x = -5.2 + (i % 8) * 1.4, y = 2.2 - Math.floor(i / 8) * 0.75; S.g.push(bx(RN[i], FC.gray, x, y, 0, 1.25, 0.45, 0.5)); }
    S.b = ok(2 ** 5 === 32, 0, -1.2, '0～31 共 32 個：2⁵ = 32 → 位址要 5 bits ✓');
    cap('32 個 register，地址幾個 bits？', '5 個 bits：這個很重要');
  },
  async (tok, S) => { // 114 越大越慢
    S.s = sm('register file 越大越靈活，但越慢 → 怎麼選是重要的設計決定', 0, -1.8);
    cap('register file 希望大一點', '但太大會慢：要取捨');
  },
  async (tok, S) => { // 127.5 用途：$t 8–15、$s 16–23
    for (let i = 8; i <= 15; i++) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    for (let i = 16; i <= 23; i++) { tint(S.g[i], RCOL(i)); glow(S.g[i], HL); }
    S.u = note('寫程式可用：8～15 = $t0～$t7（temporary）、16～23 = $s0～$s7', 0, 3.3 - 0.0);
    gone(S.r);
    cap('有些 register 有特別用途', '我們能用的是 $t（8–15）和 $s（16–23）');
  },
  async (tok, S) => { // 159.5 CPU 結構
    gone(S.g, S.b, S.s, S.u, S.e, S.ins);
    S.mem = prop('warehouse', 4.8, 1.0, 0, 1.4, 'Memory');
    S.cpu = zone('CPU', -2.2, 1.0, 0, 6.2, 3.6, '#efe4d0');
    S.rf = bx('register file（32 個）', FC.green, -3.4, 3.0, 0, 3.0); S.alu = bx('ALU', FC.orange, -0.6, 2.0, 0, 1.6);
    S.a1 = arrow(V3(-2.6, 2.7, 0.5), V3(-1.3, 2.2, 0.5)); S.a2 = arrow(V3(-0.6, 1.6, 0.5), V3(-2.8, 2.6, 0.6), 0x0f5a3a);
    S.cp = bx('coprocessor：floating point', FC.sky, -2.2, 0.4, 0, 3.4);
    S.l = sm('資料從 register 來，算完寫回 register；memory 在外面，放更多 data', 0, -1.6);
    cap('CPU 裡有 register file', '運算完寫回 register；外面有大的 memory');
  },
]);

scene('isA-5a-fghij', '5A：f = (g + h) − (i + j) 編成三個指令', [
  async (tok, S) => { // 191.4 例子
    S.h = hd('上次的例子：f = (g + h) − (i + j)', 0, 6.6);
    S.c = mt('f = (g + h) − (i + j);', -0.6, 5.8, 14, 'note');
    cap('上次的例子', 'f = (g + h) − (i + j)，有四個 operand');
  },
  async (tok, S) => { // 202 只能兩個 source
    S.r = bad('MIPS：一個指令只能 2 個 source、1 個 destination', -0.6, 5.1);
    cap('MIPS 一次只能兩個 source', '一個 destination');
  },
  async (tok, S) => { // 235.9 放在 $s0～$s4
    S.M = mach({ regs: [['$s0', 0], ['$s1', 5], ['$s2', 3], ['$s3', 4], ['$s4', 2], ['$t0', 0], ['$t1', 0]], rnames: ['f', 'g', 'h', 'i', 'j', '', ''], rx: -4.2, ry: 4.0 });
    S.v = sm('g、h、i、j 的值是示意', -4.2, -1.5);
    cap('變數要先在 register 裡', 'f～j 放在 $s0～$s4');
  },
  async (tok, S) => { // 259 add $t0, $s1, $s2
    S.code = code(['add $t0, $s1, $s2', 'add $t1, $s3, $s4', 'sub $s0, $t0, $t1'], 1.6, 3.6); S.code.hl(0);
    const o = await S.M.run(tok, 'add $t0, $s1, $s2'); S.o1 = sm(o.desc, 1.6, 1.4);
    cap('g + h：$s1 + $s2 → $t0', o.desc);
  },
  async (tok, S) => { // 272.1 add $t1, $s3, $s4
    S.code.hl(1); gone(S.o1);
    const o = await S.M.run(tok, 'add $t1, $s3, $s4'); S.o2 = sm(o.desc, 1.6, 1.4);
    cap('i + j：$s3 + $s4 → $t1', o.desc);
  },
  async (tok, S) => { // 283.2 sub $s0, $t0, $t1
    S.code.hl(2); gone(S.o2);
    const o = await S.M.run(tok, 'sub $s0, $t0, $t1');
    S.o3 = ok(S.M.reg[16] === (5 + 3) - (4 + 2), 1.6, 1.4, o.desc + '　＝ (5 + 3) − (4 + 2) ✓');
    cap('$t0 − $t1 → $s0（f）', o.desc);
  },
  async (tok, S) => { // 295.3 一個 statement → 三個
    S.code.hl(-1);
    S.g = good('一個 C statement → 三個 assembly statement，每個都遵守規定', 1.6, 0.6);
    cap('一個 C statement 寫成三個', '每次只有三個 operand');
  },
  async (tok, S) => { // 319.2 不在 register 要搬進來
    S.n = note('operand 一定要在 register；不在的話，要先從別的地方搬進來', 1.6, -0.2);
    cap('加、減、and、or 只能在 register 上做', '不在 register 的，後面教怎麼搬');
  },
]);

// C = A + B 的四種 register architecture（A = 2、B = 5 為示意）
scene('isA-5a-arch', '5A：Register architecture 的演變：accumulator、stack、GPR、load-store', [
  async (tok, S) => { // 339.9 register file 是重要特性
    S.h = hd('register file 的設計是 ISA 很重要的特性', 0, 6.6);
    S.t = ['Accumulator', 'Stack', 'General purpose register', 'Load-store'].map((n, k) => bx(n, FC.sand, -4.6 + k * 3.1, 5.6, 0, 2.9, 0.55, 0.6));
    cap('Register 的架構', '歷史上有好幾種');
  },
  async (tok, S) => { // 369.1 歷史上的幾種
    glow(S.t[3], OKG);
    S.m = sm('MIPS 屬於最後這一種', 4.7, 4.9);
    cap('accumulator、stack、GPR、load-store', '我們（MIPS）是 load-store');
  },
  async (tok, S) => { // 388.2 accumulator：只有一個 register
    S.t.forEach((m) => glow(m, null)); glow(S.t[0], HL); gone(S.m);
    S.acc = bx('ACC', FC.orange, -4.6, 3.6, 0, 1.6, 0.8, 0.8);
    S.al = sm('早期 hardware 很貴：CPU 裡只有一個 register', -4.6, 2.8);
    cap('最早：只有一個 register', '叫 accumulator（累加器）');
  },
  async (tok, S) => { // 409.2 A = B + C：load、add
    S.memA = ['A', 'B', 'C'].map((n, k) => bx(n + '：' + ['?', '2', '5'][k], FC.sand, -4.6 + (k - 1) * 1.3, 1.6, 0, 1.2, 0.5, 0.6));
    S.ml = sm('memory', -4.6, 0.9);
    S.c1 = code(['load B   # ACC ← B', 'add  C   # ACC ← ACC + C'], -4.6, 0.3);
    relabel(S.acc, 'ACC=2'); await wt(tok, 300); relabel(S.acc, 'ACC=' + (2 + 5));
    cap('A = B + C：先 load B', '再 add C：一定加到 accumulator');
  },
  async (tok, S) => { // 479.9 只要描述一個 address
    S.c1.hl(1);
    S.a1 = note('只要寫一個 address：另一個運算元與結果都默認是 ACC', -4.6, -1.2);
    cap('只要描述一個地址', '加到哪裡、結果放哪裡都不用講');
  },
  async (tok, S) => { // 529.8 stack：LIFO
    glow(S.t[0], null); glow(S.t[1], HL);
    S.st = []; for (let k = 0; k < 3; k++) S.st.push(bx('', FC.lilac, 0.0, 2.0 + k * 0.6, 0, 1.6, 0.5, 0.6));
    S.tos = hot('top of stack', 0.0, 4.0);
    S.sl = sm('last in, first out：只能 push 到頂端、從頂端拿', 0.0, 1.2);
    cap('再來：stack', '只能操作 top of stack');
  },
  async (tok, S) => { // 569.9 push A、push B、add、pop C
    S.c2 = code(['push A', 'push B', 'add', 'pop C'], -1.0, 0.6);
    relabel(S.st[0], 'A=2'); relabel(S.st[1], 'B=5'); await wt(tok, 300);
    relabel(S.st[1], ''); relabel(S.st[0], '2+5=' + (2 + 5));
    cap('push A、push B、add、pop C', 'add 不用寫 operand：一定是頂端兩個');
  },
  async (tok, S) => { // 602.8 GPR：很多 register
    glow(S.t[1], null); glow(S.t[2], HL);
    S.gp = []; for (let k = 0; k < 4; k++) S.gp.push(bx('R' + (k + 1), FC.green, 3.6 + (k % 2) * 1.2, 3.6 - Math.floor(k / 2) * 0.65, 0, 1.0, 0.5, 0.6));
    S.gl = sm('hardware 變便宜：多個 register，任意存取', 4.2, 2.3);
    cap('General purpose register', '有很多 register，可以任意 access');
  },
  async (tok, S) => { // 622.4 2-address vs 3-address
    S.g2 = sm('2-address：add A, B（A ← A + B）；3-address：add A, B, C → 指令比較長', 4.2, 1.7);
    cap('又分 2-address 和 3-address', '描述的地址越多，指令越長');
  },
  async (tok, S) => { // 666.4 operand 可在 memory
    S.g3 = note('GPR：operand 可以在 register，也可以在 memory', 4.2, 1.1);
    cap('GPR 的特點', 'operand 可以在 register 或 memory');
  },
  async (tok, S) => { // 690.4 RISC：load-store
    glow(S.t[2], null); glow(S.t[3], HL);
    S.ls = good('RISC（load-store）：加減時 3 個 operand 全部要在 register', 0, -1.6);
    cap('RISC：load-store machine', '做運算時，operand 一定在 register');
  },
  async (tok, S) => { // 756.6 為什麼快
    S.f1 = sm('register 很快；若有 operand 在 memory，要先去拿，時間不確定', 0, -2.2);
    cap('為什麼比較快？', 'operand 在 memory 的話，要等記憶體');
  },
  async (tok, S) => { // 787.3 拆成 load / store → 好最佳化
    S.f2 = sm('把「去 memory 拿」拆成獨立的 load / store 指令 → 比較好做 optimization', 0, -2.8);
    cap('把存取 memory 拆成 load、store', '指令切小，比較好做 optimization');
  },
]);

scene('isA-5a-cab', '5A：C = A + B 的四種寫法與比較', [
  async (tok, S) => { // 876.1 四種架構寫同一件事
    S.h = hd('同一件事 C = A + B，四種架構怎麼寫？（A = 2、B = 5 示意）', 0, 6.7);
    S.col = ['Stack', 'Accumulator', 'Register-memory', 'Load-store'].map((n, k) => hd(n, -5.0 + k * 3.35, 6.0));
    cap('C = A + B', '四種 register architecture 各寫一次');
  },
  async (tok, S) => { // 892.5 stack
    S.c0 = code(['push A', 'push B', 'add', 'pop C'], -5.0, 5.3);
    S.r0 = ok(2 + 5 === 7, -5.0, 2.8, 'C = 7 ✓');
    cap('Stack：push A、push B', 'add 把頂端兩個相加，pop C 存回');
  },
  async (tok, S) => { // 955.7 accumulator
    S.c1 = code(['load A', 'add B', 'store C'], -1.65, 5.3);
    S.r1 = ok(2 + 5 === 7, -1.65, 2.8, 'C = 7 ✓');
    cap('Accumulator：load A、add B、store C', '不用說放哪：只有一個 ACC');
  },
  async (tok, S) => { // 1013.7 register-memory（GPR）
    S.c2 = code(['load R1, A', 'add R1, B', 'store C, R1'], 1.7, 5.3);
    S.r2 = ok(2 + 5 === 7, 1.7, 2.8, 'C = 7 ✓');
    cap('Register-memory：add R1, B', 'B 直接從 memory 拿來加');
  },
  async (tok, S) => { // 1045.3 load-store
    S.c3 = code(['load R1, A', 'load R2, B', 'add R3, R1, R2', 'store C, R3'], 5.0, 5.3);
    S.r3 = ok(2 + 5 === 7, 5.0, 2.8, 'C = 7 ✓');
    cap('Load-store：先把 A、B 都 load 進來', '在 register 相加，再 store 回 C');
  },
  async (tok, S) => { // 1081.5 1975 後只剩兩種
    S.c0.ls.forEach((l) => { l.element.style.opacity = '0.4'; }); S.c1.ls.forEach((l) => { l.element.style.opacity = '0.4'; });
    S.n = note('1975 年後已沒有 stack、accumulator 的機器；x86 屬 register-memory，RISC（MIPS）屬 load-store', 0, 1.9);
    cap('現在只剩後兩種', 'Intel x86 是 register-memory，RISC 是 load-store');
  },
  async (tok, S) => { // 1099.9 比較三項
    S.tb = mt('                  bytes/instr   # of instr   CPI', 0, 1.1, 12, 'ptr');
    cap('比較：每個指令幾 bytes', '幾個指令、CPI 有什麼差別');
  },
  async (tok, S) => { // 1169.6 指令長度、指令數
    S.t1 = mt('register-memory   比較長        3 個          ?', 0, 0.5, 12);
    S.t2 = mt('load-store        比較短        4 個          ?', 0, -0.1, 12);
    cap('register-memory 指令較長', '要放 memory address；但只要 3 個指令');
  },
  async (tok, S) => { // 1229.6 CPI：指令少不一定快
    txt(S.t1, 'register-memory   比較長        3 個          add 要等 memory，長');
    txt(S.t2, 'load-store        比較短        4 個          每個都短、單純');
    S.w = bad('指令數比較少，不一定比較快：add R1, B 要先去 memory 拿 B', 0, -0.9);
    cap('3 個指令一定比 4 個快嗎？', '不一定：要去 memory 的 add 很久');
  },
  async (tok, S) => { // 1285.3 拆小 → optimization
    S.g = good('指令拆小：總數多，cycle 不一定多；而且好做 optimization', 0, -1.5);
    cap('把指令拆成小的', '指令數多，但比較好最佳化');
  },
  async (tok, S) => { // 1312.9 MIPS = load-store
    S.m = hot('MIPS 是 load-store machine：做加減時，operand 一定在 register file', 0, -2.2);
    cap('MIPS 是 load-store machine', '算術邏輯運算的 operand 一定在 register');
  },
]);

scene('isA-5a-memop', '5A：Memory operand：byte address 與 base + offset', [
  async (tok, S) => { // 1340.3 memory operand、data transfer
    S.h = hd('Memory operand 與 data transfer', 0, 6.6);
    cap('第二部分', 'memory operand 和 data transfer');
  },
  async (tok, S) => { // 1347.5 array 放 memory
    S.rf = bx('register file：只有 32 個', FC.green, -4.4, 4.8, 0, 3.2);
    S.mem = prop('warehouse', 4.4, 3.8, 0, 1.4, 'Memory');
    S.n = sm('簡單變數 → register；array、matrix 大量資料 → memory', 0, 5.8);
    cap('簡單的 variable 放 register', 'array、matrix 太大，放 memory');
  },
  async (tok, S) => { // 1389.8 load / store
    S.ld = arrow(V3(2.8, 4.0, 0.4), V3(-2.6, 4.0, 0.4), 0x0f5a3a); S.ldl = good('load：memory → register', 0, 4.4);
    S.stA = arrow(V3(-2.6, 3.4, 0.4), V3(2.8, 3.4, 0.4), 0x6a4a00); S.stl = note('store：register → memory', 0, 3.0);
    cap('Memory → register 叫 load', 'register → memory 叫 store');
  },
  async (tok, S) => { // 1438.6 要描述哪個 register
    S.q1 = sm('指令要說：① 哪一個 register（32 個 → 5 bits）', -2.6, 2.2);
    cap('搬資料要說從哪搬到哪', '第一：哪一個 register，5 bits 就夠');
  },
  async (tok, S) => { // 1491.3 byte address
    gone(S.rf, S.mem, S.n, S.ld, S.ldl, S.stA, S.stl, S.q1);
    S.cells = []; for (let k = 0; k < 12; k++) { S.cells.push(bx('', FC.sand, -5.8 + k * 0.95, 4.6, 0, 0.88, 0.5, 0.6)); S.cells.push(small(tag(String(k), 'idx', -5.8 + k * 0.95, 4.1), 10)); }
    S.bl = sm('memory 像一維的 array：每個 byte（8 bits）一個 address：0、1、2、3…', 0, 5.4);
    cap('第二：memory 的哪一個位置', 'memory 用 byte address：一維排開');
  },
  async (tok, S) => { // 1542.7 2^32 bytes → 32 bits
    S.a32 = ok(Math.log2(2 ** 32) === 32, 0, 3.4, 'MIPS：2³² 個 byte → address 要 32 bits ✓');
    cap('MIPS 有 2³² 個 byte', '地址要 32 個 bits');
  },
  async (tok, S) => { // 1599.3 1024 → 10 bits
    S.a10 = ok(Math.log2(1024) === 10, 0, 2.8, '對照：1024 個 byte → 2¹⁰ → 10 bits ✓');
    cap('1024 個 byte 要幾個 bits？', '10 個；2³² 個就要 32 個');
  },
  async (tok, S) => { // 1624.6 直接放 → 太長
    S.too = [bx('op', FC.gold, -5.2, 1.6, 0, 1.4), bx('reg 5', FC.green, -3.6, 1.6, 0, 1.4), bx('memory address：32 bits', FC.red, 0.3, 1.6, 0, 6.0)];
    S.tl = bad('直接把 32-bit address 放進指令 → 指令太長', 0, 0.8);
    cap('如果直接把地址寫進指令', 'op + 5 + 32 bits：太長了');
  },
  async (tok, S) => { // 1707.9 pointer + offset
    gone(S.too, S.tl);
    S.ptr = hot('改用：一個 pointer（放在 register）＋ offset', 0, 1.6);
    S.pa = arrow(V3(-5.8, 3.2, 0.4), V3(-5.8, 4.2, 0.4), 0x6a4a00);
    S.pl = sm('pointer 指到起點，再往上加 offset', -3.6, 3.0 - 0.1);
    cap('先找一個 pointer 指到某個地方', '要的位置 = pointer + offset');
  },
  async (tok, S) => { // 1879 為什麼：5 bits vs 32 bits
    S.why = good('pointer 放在 register：指令裡只要 5 bits 指定 register，不用 32 bits', 0, 0.9);
    cap('為什麼這麼麻煩？', '指定 register 只要 5 bits，地址要 32 bits');
  },
  async (tok, S) => { // 1930 例：要 1012
    gone(S.cells, S.bl, S.a32, S.a10, S.ptr, S.pa, S.pl, S.why);
    S.addr = [1000, 1004, 1008, 1012, 1016, 1020];
    S.mc = S.addr.map((a, k) => bx(a === 1012 ? '999' : '', FC.sand, 3.6, 0.6 + k * 0.7, 0, 1.4, 0.55, 0.6));
    S.ml = S.addr.map((a, k) => mono(tag(String(a), 'idx', 2.2, 0.6 + k * 0.7), 11));
    S.d = bad('直接寫 1012：前面一大串 0，也要 32 bits', -2.6, 5.4);
    cap('例：要存取位址 1012', '直接寫要 32 bits，指令放不下');
  },
  async (tok, S) => { // 1980 $s0 = 1000，+12
    S.s0 = bx('$s0 = 1000', RCOL(16), -3.6, 2.6, 0, 2.2);
    S.pa = arrow(V3(-2.4, 2.6, 0.4), V3(2.8, 0.6, 0.4), 0x6a4a00);
    const a = 1000 + 12;
    S.sum = ok(a === 1012, -2.6, 1.6, '1000 + 12 = ' + a + ' ✓');
    glow(S.mc[3], HL);
    cap('$s0 放 1000，像 pointer', '1000 + 12 = 1012，就是要的地址');
  },
  async (tok, S) => { // 2036.5 只要 5 bits + 小 offset
    S.bits = good('指令裡：register（5 bits）＋ 很小的 offset 就夠', -2.6, 0.9);
    cap('要花幾個 bits？', 'register 5 bits，offset 通常很小');
  },
  async (tok, S) => { // 2070.1 換到 10000 附近
    S.far = note('要存取 10000 附近？把 base 改成 10000，再加 offset', -2.6, 0.2);
    cap('要存取 1 萬附近的資料？', '把 base 改設成 10000');
  },
  async (tok, S) => { // 2138.7 為什麼是 1000：array
    gone(S.d);
    S.arr = S.addr.slice(0, 4).map((a, k) => small(tag('A[' + k + ']', 'idx', 5.0, 0.6 + k * 0.7), 10));
    S.al = sm('array 的元素連續放：1000、1004、1008… base 設在第一筆', -2.6, 5.4);
    cap('為什麼 base 放 1000？', 'array 一連串資料就在 1000 附近');
  },
  async (tok, S) => { // 2202.7 $s0 怎麼來
    S.set = note('$s0 = 1000 不是天生的：要先用一個指令把它設好', -2.6, 4.7);
    cap('$s0 怎麼會是 1000？', '要先寫一個指令把它設成 1000');
  },
  async (tok, S) => { // 2232.6 byte address、word = 4 bytes
    S.w4 = hot('byte address，但 MIPS 的 word = 4 bytes → 一筆資料加 4', -2.6, 4.0);
    cap('為什麼每筆加 4？', 'address 以 byte 算，一個 word 是 4 bytes');
  },
  async (tok, S) => { // 2280.7 總結：pointer + offset
    S.f = good('memory address = base register 的內容 ＋ offset', -2.6, 3.3);
    cap('整理一下', '地址 = base register 裡的值 + offset');
  },
]);

scene('isA-5a-lwsw', '5A：lw $t0, 12($s0) 與 sw $t0, 12($s0)', [
  async (tok, S) => { // 2346.3 格式
    S.h = hd('Load 指令的長相', 0, 6.6);
    S.f = ['lw', '$t0', '12', '($s0)'].map((t, k) => bx(t, [FC.gold, FC.green, FC.blue, FC.purple][k], -3.3 + k * 2.2, 5.6, 0, 1.9, 0.7, 0.7));
    S.l1 = sm('op code', -3.3, 4.9); S.l2 = sm('destination', -1.1, 4.9);
    cap('第一個 field：op code（lw）', '第二個：要搬進哪個 register');
  },
  async (tok, S) => { // 2378 第三、四個 field 算地址
    S.l3 = sm('offset', 1.1, 4.9); S.l4 = sm('base register', 3.3, 4.9);
    glow(S.f[2], HL); glow(S.f[3], HL);
    cap('第三、四個 field 算 memory 地址', '32 bits 太長，用 base register 加 offset');
  },
  async (tok, S) => { // 2410.7 lw $t0, 12($s0)
    S.f.forEach((m) => glow(m, null));
    S.M = mach({ regs: [['$s0', 1000], ['$t0', 0]], mem: [[1016, 0], [1012, 999], [1008, 0], [1004, 0], [1000, 0]], rx: -4.0, ry: 2.8, mx: 4.4, my: 3.4 });
    cap('寫成 lw $t0, 12($s0)', '$s0 的內容加 12 就是地址');
  },
  async (tok, S) => { // 2417.8 load word = 32 bits
    S.w = sm('lw = load word：一次搬一個 word = 32 bits', 0, 4.3);
    cap('lw 是 load word', '每次搬 32 個 bits 進來');
  },
  async (tok, S) => { // 2439.2 base register、offset
    S.b = note('$s0 叫 base register；12 叫 offset', 0, 3.7);
    cap('$s0：base register', '12：offset');
  },
  async (tok, S) => { // 2451.7 對應 array
    S.a = sm('就像 array：第一個元素的位置當 base，其他元素 = base + 多少', 0, 3.1);
    cap('對應到 array', '第一個元素當 base，往上加 offset');
  },
  async (tok, S) => { // 2477.5 例：Mem[1012] = 999、$s0 = 1000
    glow(S.M.C[1012], HL); glow(S.M.R.$s0, HL);
    cap('例：1012 裡放 999', '$s0 已經放了 1000');
  },
  async (tok, S) => { // 2491.5 1000 + 12 = 1012
    const a = S.M.reg[16] + 12;
    S.ad = ok(a === 1012, -0.4, 1.9, '$s0 + 12 = 1000 + 12 = ' + a + ' ✓');
    cap('$s0 的內容加 12', '1000 + 12 = 1012');
  },
  async (tok, S) => { // 2530.2 拿 1012 裡面的東西 → 999
    const o = await S.M.run(tok, 'lw $t0, 12($s0)');
    S.r = ok(S.M.reg[8] === 999, -0.4, 1.2, o.desc + ' ✓');
    S.n2 = bad('$t0 不是 1012（那只是地址），而是 1012 裡面的 999', -0.4, 0.5);
    cap('$t0 是 1012 還是 999？', '999：拿的是地址裡面的東西');
  },
  async (tok, S) => { // 2581.1 為什麼間接
    S.why = note('為什麼不直接寫地址？32-bit address 太大，指令放不下', -0.4, -0.2);
    cap('為什麼不直接寫 32-bit 地址？', '太大了，所以用間接的方法');
  },
  async (tok, S) => { // 2609.9 store
    gone(S.w, S.b, S.a, S.ad, S.r, S.n2, S.why, S.f, S.l1, S.l2, S.l3, S.l4);
    S.h2 = hot('Store：register → memory（sw = store word）', 0, 5.6);
    S.M.calm();
    cap('反過來：運算完要搬回 memory', '叫 store：sw（store word）');
  },
  async (tok, S) => { // 2647.5 一樣用 base + offset
    S.e = mt('sw  $t0, 12($s0)', 0, 4.8, 14, 'note');
    cap('一樣要說哪個 register、搬到哪', '地址也是 base register + offset，只是 op code 不同');
  },
  async (tok, S) => { // 2669.2 $s0 = 1000、$t0 = 25
    S.M.reg[8] = 25; S.M.refresh(); glow(S.M.R.$t0, HL);
    cap('例：$s0 = 1000，$t0 = 25', 'sw $t0, 12($s0)：25 存到哪裡？');
  },
  async (tok, S) => { // 2705.4 存到 1012
    const o = await S.M.run(tok, 'sw $t0, 12($s0)');
    S.r = ok(S.M.mem[1012] === 25, -0.4, 1.6, o.desc + ' ✓');
    cap('1000 + 12 = 1012', '執行完，1012 裡變成 25');
  },
  async (tok, S) => { // 2737.6 offset 正負都可以
    S.pm = sm('offset 是一個 integer：正的、負的都可以（往上或往下）', -0.4, 0.9);
    cap('offset 可以正，也可以負', '詳細的指令格式下次講');
  },
]);

scene('isA-5a-array', '5A：g = h + A[8] 與 A[12] = h + A[8]', [
  async (tok, S) => { // 2758.4 g = h + A[8]
    S.h = hd('Compilation with memory：g = h + A[8]', 0, 6.6);
    cap('例：g = h + A[8]', '要先知道 g、h、A[8] 在哪裡');
  },
  async (tok, S) => { // 2771 base 在 $s3
    S.M = mach({ regs: [['$s1', 0], ['$s2', 5], ['$s3', 1000], ['$t0', 0]], rnames: ['g', 'h', 'A 的 base', ''], mem: [[1048, 0, 'A[12]'], [1044, 0, 'A[11]'], [1036, 0, 'A[9]'], [1032, 30, 'A[8]'], [1004, 0, 'A[1]'], [1000, 0, 'A[0]']], rx: -3.8, ry: 4.8, mx: 3.6, my: 5.0 });
    S.v = sm('h = 5、A 從 1000 開始、A[8] = 30 是示意', -3.8, 1.4);
    cap('g 在 $s1、h 在 $s2', 'A 的第 0 個元素（base）在 $s3');
  },
  async (tok, S) => { // 2792.3 offset 32
    const off = 8 * 4;
    S.o = ok(off === 32 && 1000 + off === 1032, -3.8, 0.7, 'A[8]：8 × 4 bytes = offset ' + off + ' ✓');
    cap('A[8] 的 offset 要寫多少？', '一個 word 4 bytes：8 × 4 = 32');
  },
  async (tok, S) => { // 2809.2 lw $t0, 32($s3)
    S.code = code(['lw  $t0, 32($s3)', 'add $s1, $s2, $t0'], -1.0, 0.0); S.code.hl(0);
    const o = await S.M.run(tok, 'lw $t0, 32($s3)'); S.d1 = sm(o.desc, 1.4, -1.4);
    cap('先 load A[8] 到 $t0', o.desc);
  },
  async (tok, S) => { // 2821.2 add $s1, $s2, $t0
    S.code.hl(1); gone(S.d1);
    const o = await S.M.run(tok, 'add $s1, $s2, $t0');
    S.d2 = ok(S.M.reg[17] === 5 + 30, 1.4, -1.4, 'g = ' + o.desc.replace('$s1 = ', '') + ' ✓');
    cap('再把 h 和 $t0 加起來放 g（$s1）', o.desc);
  },
  async (tok, S) => { // 2836.3 A[12] = h + A[8]
    S.code.kill(); gone(S.d2, S.o); S.M.calm();
    txt(S.h, '再一個例子：A[12] = h + A[8]');
    cap('第二個例子', 'A[12] = h + A[8]');
  },
  async (tok, S) => { // 2855.9 lw、add $t0
    S.code = code(['lw  $t0, 32($s3)', 'add $t0, $s2, $t0', 'sw  $t0, 48($s3)'], -1.0, 0.4); S.code.hl(0);
    await S.M.run(tok, 'lw $t0, 32($s3)'); S.code.hl(1);
    const o = await S.M.run(tok, 'add $t0, $s2, $t0'); S.d = sm(o.desc, 1.4, -1.6);
    cap('先 load A[8]，加上 h', '結果先放在 $t0');
  },
  async (tok, S) => { // 2867.1 sw $t0, 48($s3)
    S.code.hl(2); gone(S.d);
    const off = 12 * 4;
    const o = await S.M.run(tok, 'sw $t0, ' + off + '($s3)');
    S.d = ok(off === 48 && S.M.mem[1048] === 35, 1.4, -1.6, '12 × 4 = 48；' + o.desc + ' ✓');
    cap('存回 A[12]：base 還是 $s3', 'offset = 12 × 4 = 48');
  },
  async (tok, S) => { // 2890.8 base 不變只改 offset
    S.code.hl(-1);
    S.g = good('存取 array：base 不用變，只改 offset（32、48）就能拿到任何一個元素', 0, -2.3);
    cap('access array 時', 'base 不變，改 offset 就能存取任何元素');
  },
]);

// ════════ jhMWFZV6hy8（第 6A 講：base + offset 回顧、byte address／alignment／endian、spilling、immediate、R／I format） ════════
// 老師的例子：g = h + A[8]、A[12] = h + A[8]、addi 加 4（第 29 個 register）、f = g + 10、加 −1、move 用 add $zero、
// add $t0, $s1, $s2 → 0 17 18 8 0 32、hex 例 eca8 6420、addi $21, $22, −50、lw $t0, 1200($t1)。
// register 的值、0x12345678 的 endian 例子是示意。所有 bits／hex 由 assemble()／bitsOf()／hex8() 算出。
// reveal some fields of a fieldRow (k in on → show the field's bits)
function reveal(F, on) { F.bits.split('').forEach((b, i) => { const k = F.row.fOf(i); const o = on.includes(k); relabel(F.ms[i], o ? b : '·'); tint(F.ms[i], o && b === '1' ? FCOL[k] : FCOL0[k]); }); }
scene('isA-6a-review', '6A：回顧：load-store、base + offset、A[8] 與 A[12]', [
  async (tok, S) => { // 18.6 operand 在 register
    S.h = hd('回顧：load-store machine，運算的 operand 一定在 register', 0, 6.6);
    cap('上次講到 operand', '做加減時，operand 一定在 register');
  },
  async (tok, S) => { // 40.7 只有 32 個
    S.r = sm('register 要快（smaller is faster）→ 只有 32 個；其他 operand 放 memory', 0, 6.0);
    cap('register 只有 32 個', '放不下的 operand 放 memory');
  },
  async (tok, S) => { // 60.3 load / store
    S.l = note('用 load／store 把資料在 memory 和 register 之間搬', 0, 5.4);
    cap('用 load、store 搬進搬出', '搬進 register 才開始運算');
  },
  async (tok, S) => { // 76.9 要描述 memory address
    S.q = sm('指令要寫：op（load/store）、register（5 bits）、memory address', 0, 4.8);
    cap('要描述哪個 register：5 bits', '還要描述 memory address');
  },
  async (tok, S) => { // 103.4 32 bits 太長
    S.t = bad('memory address 32 bits，整個放進指令太長', 0, 4.2);
    cap('memory address 有 32 bits', '直接放進指令太長');
  },
  async (tok, S) => { // 124.3 base register + offset
    S.b = good('用 base register（放 32-bit 起點）＋ offset 描述位址', 0, 3.6);
    cap('用 indirect 的方法', 'base register 加 offset');
  },
  async (tok, S) => { // 180.8 lw $t0, 32($s3)
    S.e = mt('lw  $t0, 32($s3)    # 地址 = $s3 + 32，搬到 $t0', 0, 2.8, 13, 'note');
    cap('Load 指令的樣子', '從 $s3 + 32 的地址搬到 $t0');
  },
  async (tok, S) => { // 212.4 g = h + A[8]
    gone(S.r, S.l, S.q, S.t, S.b, S.e);
    txt(S.h, '例：g = h + A[8]（g 在 $s1、h 在 $s2、A 的 base 在 $s3）');
    S.M = mach({ regs: [['$s1', 0], ['$s2', 5], ['$s3', 1000], ['$t0', 0]], rnames: ['g', 'h', 'A', ''], mem: [[1048, 0, 'A[12]'], [1044, 0, 'A[11]'], [1036, 0, 'A[9]'], [1032, 30, 'A[8]'], [1004, 0, 'A[1]'], [1000, 0, 'A[0]']], rx: -3.8, ry: 4.8, mx: 3.6, my: 5.0 });
    S.v = sm('h = 5、A 從 1000 開始、A[8] = 30 是示意', -3.8, 1.4);
    cap('Array 資料量大，放在 memory', '先把 A[8] 搬進來');
  },
  async (tok, S) => { // 253 offset = 8 × 4 = 32
    S.o = ok(8 * 4 === 32, -3.8, 0.7, 'byte address、一個 data 4 bytes：8 × 4 = 32 ✓');
    cap('8 的 offset 要多少？', 'address 以 byte 算：8 × 4 = 32');
  },
  async (tok, S) => { // 271.5 lw $t0, 32($s3)
    S.code = code(['lw  $t0, 32($s3)', 'add $s1, $s2, $t0'], -1.0, 0.0); S.code.hl(0);
    const o = await S.M.run(tok, 'lw $t0, 32($s3)'); S.d = sm(o.desc, 1.4, -1.4);
    cap('lw $t0, 32($s3)', o.desc);
  },
  async (tok, S) => { // 295.2 add $s1, $s2, $t0
    S.code.hl(1); gone(S.d);
    const o = await S.M.run(tok, 'add $s1, $s2, $t0');
    S.d = ok(S.M.reg[17] === 35, 1.4, -1.4, o.desc + ' ✓');
    cap('再跟 h 相加，放到 g', o.desc);
  },
  async (tok, S) => { // 317.5 A[12] = h + A[8]
    S.code.kill(); gone(S.d, S.o); S.M.calm();
    txt(S.h, '再複雜一點：A[12] = h + A[8]');
    S.code = code(['lw  $t0, 32($s3)', 'add $t0, $s2, $t0', 'sw  $t0, 48($s3)'], -1.0, 0.4); S.code.hl(0);
    await S.M.run(tok, 'lw $t0, 32($s3)'); S.code.hl(1);
    const o = await S.M.run(tok, 'add $t0, $s2, $t0'); S.d = sm(o.desc, 1.4, -1.6);
    cap('A[8] load 進來，跟 h 相加', '先放在 $t0');
  },
  async (tok, S) => { // 364.9 sw $t0, 48($s3)
    S.code.hl(2); gone(S.d);
    const o = await S.M.run(tok, 'sw $t0, 48($s3)');
    S.d = ok(12 * 4 === 48 && S.M.mem[1048] === 35, 1.4, -1.6, '12 × 4 = 48；' + o.desc + ' ✓');
    cap('用 store word 存回 A[12]', 'base 還是 $s3，offset = 12 × 4 = 48');
  },
]);

scene('isA-6a-endian', '6A：byte address、alignment、big／little endian', [
  async (tok, S) => { // 404.4 memory 有地址
    S.h = hd('Memory：每個單位一個地址', 0, 6.6);
    S.c = []; for (let k = 0; k < 12; k++) { S.c.push(bx('', FC.sand, -5.8 + k * 1.05, 4.6, 0, 0.95, 0.55, 0.6)); S.c.push(small(tag(String(k), 'idx', -5.8 + k * 1.05, 4.05), 10)); }
    cap('早期 memory 很貴', '一個單位一個地址：Memory[0]、[1]、[2]…');
  },
  async (tok, S) => { // 430.1 memory 的基本單位
    S.n = sm('這裡的「單位」是 memory 一次存取的基本單位；最早可能就是一個 byte', 0, 5.4);
    cap('這是 memory 的基本單位', '早期可能真的只有一個 byte');
  },
  async (tok, S) => { // 457.7 為什麼用 byte address
    S.q = note('為什麼不用 word address（bits 比較少）？因為常常還是要存取單一個 byte', 0, 3.3);
    cap('為什麼地址用 byte 算？', '因為還是常要存取 byte');
  },
  async (tok, S) => { // 499.2 word = 32 bits → 4 的倍數
    S.w = []; for (let k = 0; k < 3; k++) S.w.push(bx('word ' + k + '（地址 ' + 4 * k + '）', FC.blue, -5.8 + 1.575 + k * 4.2, 2.4, 0, 4.1, 0.55, 0.6));
    S.wl = ok([0, 4, 8].every((a) => a % 4 === 0), 0, 1.7, 'MIPS 一個 word = 32 bits = 4 bytes → word 地址 0、4、8… ✓');
    cap('MIPS 一個 word 是 32 bits', 'word 地址就是 4 的倍數');
  },
  async (tok, S) => { // 529.7 alignment
    S.al = hot('Alignment：一個 word 一定要從 4 的倍數開始放', 0, 1.0);
    cap('重要概念：alignment', 'word 不能亂擺');
  },
  async (tok, S) => { // 555.1 不能從 1、2、3 開始
    S.bad = bx('word？', FC.red, -5.8 + 1.05 + 1.575, 3.4, 0, 4.1, 0.45, 0.6);
    S.bl = ok(1 % 4 !== 0, 0, 0.3, '從地址 1 開始：1 不是 4 的倍數 → 不對齊，不可以 ✓');
    cap('不可以從 1、2、3 開始', '一定要對齊 0、4、8');
  },
  async (tok, S) => { // 611.5 big / little endian
    gone(S.c, S.n, S.q, S.w, S.wl, S.al, S.bad, S.bl);
    S.v = 0x12345678; S.bytes = [24, 16, 8, 0].map((s) => ((S.v >>> s) & 255).toString(16).padStart(2, '0'));
    S.wd = mt('一個 word：0x12 34 56 78（示意）  12 是 most significant byte', 0, 5.6, 13, 'note');
    S.e = hd('word 裡 4 個 byte 怎麼編號？兩種習慣：big endian、little endian', 0, 6.6 - 0.0);
    gone(S.h);
    cap('word 裡有 4 個 byte', '編號有兩種習慣');
  },
  async (tok, S) => { // 619.1 little endian
    S.lt = hd('Little endian', -4.6, 4.2);
    S.lc = [0, 1, 2, 3].map((a) => bx(S.bytes[3 - a], FC.orange, -2.6 + a * 1.2, 4.2, 0, 1.1, 0.55, 0.6));
    S.la = [0, 1, 2, 3].map((a) => small(tag('地址 ' + a, 'idx', -2.6 + a * 1.2, 3.6), 10));
    S.lok = ok(S.bytes[3] === '78', 3.6, 4.2, '地址 0 放 least significant byte（78）✓');
    cap('Little endian', '位址 0 放最「小」的那個 byte');
  },
  async (tok, S) => { // 650.8 big endian
    S.bt = hd('Big endian', -4.6, 2.2);
    S.bc = [0, 1, 2, 3].map((a) => bx(S.bytes[a], FC.blue, -2.6 + a * 1.2, 2.2, 0, 1.1, 0.55, 0.6));
    S.ba = [0, 1, 2, 3].map((a) => small(tag('地址 ' + a, 'idx', -2.6 + a * 1.2, 1.6), 10));
    S.bok = ok(S.bytes[0] === '12', 3.6, 2.2, '地址 0 放 most significant byte（12）✓');
    S.mi = sm('MIPS 是 big endian（課本）', 0, 0.7);
    cap('Big endian', '位址 0 放最「大」的那個 byte');
  },
]);

scene('isA-6a-spill', '6A：register 不夠：spilling；register vs memory', [
  async (tok, S) => { // 685.9 兩個地方放 operand
    S.h = hd('operand 可以放 register，也可以放 memory', 0, 6.6);
    S.rf = bx('Registers（32 個）', FC.green, -3.8, 4.4, 0, 3.0, 0.8, 0.8); S.mem = prop('warehouse', 3.8, 3.6, 0, 1.4, 'Memory');
    S.n = sm('要運算時，一定先搬到 register', 0, 5.8);
    cap('register 和 memory 都能放 operand', '但運算前一定要搬到 register');
  },
  async (tok, S) => { // 704.4 compiler 分配
    S.vs = ['a', 'b', 'i', 'sum'].map((v, k) => bx(v, FC.purple, -5.0 + k * 0.8, 3.0, 0, 0.7, 0.45, 0.5));
    S.c = note('compiler 幫你分配：常用的 variable 放 register', -3.8, 2.3);
    cap('平常寫高階語言，compiler 幫你轉', '常用到的 variable 放在 register');
  },
  async (tok, S) => { // 736.3 spilling
    S.sp = ['x', 'y', 'z'].map((v, k) => bx(v, FC.purple, -1.2 + k * 0.8, 3.0, 0, 0.7, 0.45, 0.5));
    for (let k = 0; k < 3; k++) await slide(tok, S.sp[k], 2.8 + k * 0.8, 2.4, 0, 400);
    S.sl = bad('放不下 → 溢到 memory：spilling（要多用 load / store）', 2.4, 1.6);
    cap('register 放不下的 variable', '就「溢」到 memory：spilling');
  },
  async (tok, S) => { // 762.3 register 變大一點？smaller is faster
    S.q = bad('把 register file 變很大？ ✗ 會變慢：smaller is faster', 0, 0.8);
    cap('那把 register 做大一點？', '不行：越大越慢，smaller is faster');
  },
  async (tok, S) => { // 808 register 好用：5 bits
    S.g = good('register 編號只要 5 bits：一個 add 可以描述 3 個 register', 0, 0.1);
    cap('register 還有一個好處', '5 bits 就能指定，一個指令放得下三個');
  },
  async (tok, S) => { // 838.7 memory：地址太長、一次一個
    S.m = sm('memory 地址太長：data transfer 一個指令只能搬一個 operand', 0, -0.6);
    cap('memory 的地址太長', '一個指令一次只能處理一個 memory operand');
  },
  async (tok, S) => { // 868.3 兩者角色
    S.r = hot('常用、最近要用的 → register；不常用或放不下 → 寫回 memory', 0, -1.3);
    cap('register 和 memory 的角色', '常用的放 register，其他的放 memory');
  },
]);

scene('isA-6a-imm', '6A：Immediate operand：addi、$zero、move', [
  async (tok, S) => { // 884.3 第三種 operand：immediate
    S.h = hd('第三種 operand：immediate（constant）', 0, 6.6);
    S.M = mach({ regs: [['$s0', 0], ['$s1', 7], ['$s2', 0], ['$t2', 0], ['$sp', 1000], ['$zero', 0]], rnames: ['f', 'g', '', '', '', ''], rx: -4.6, ry: 5.2 });
    S.v = sm('register 的值是示意', -4.6, 0.6);
    cap('除了 register、memory', '還有 immediate operand：常數');
  },
  async (tok, S) => { // 899.4 a = a + 5 很常見
    S.c = mt('a = a + 5;   b = b + 1;   c = c − 18;', 1.4, 5.6, 13, 'note');
    S.c2 = sm('分析程式：大約 50% 的 operand 是這種常數', 1.4, 5.0);
    cap('程式裡常常加減一個常數', '大約 50% 的 operand 是這種');
  },
  async (tok, S) => { // 916.9 5 的 bit pattern 從哪來
    S.p = mt('5 = ' + grp(bin(5, 32)), 1.4, 4.3, 12);
    cap('機器只認得 0 和 1', '5 這個 bit pattern 從哪裡來？');
  },
  async (tok, S) => { // 1013.6 放 memory 再 load：浪費時間
    S.ld = bad('直覺：常數先放 memory，要用時 load 進來 → 每次都多一個 load，很浪費時間', 1.4, 3.6);
    cap('最直覺：常數放在 memory', '每次用都要 load，很花時間');
  },
  async (tok, S) => { // 1053.3 make the common case fast
    S.mc = good('Make the common case fast：把常數直接放進指令裡', 1.4, 2.9);
    cap('50% 都是這種，要讓它快', 'make the common case fast：常數建進指令');
  },
  async (tok, S) => { // 1095.4 addi $sp, $sp, 4
    S.e1 = mt('addi $sp, $sp, 4    # 第 29 個 register 加 4', 1.4, 2.1, 12);
    const o = await S.M.run(tok, 'addi $sp, $sp, 4');
    S.o1 = ok(S.M.reg[29] === 1004, 1.4, 1.5, o.desc + ' ✓');
    cap('add 後面加一個 i：addi', '讀出指令時，常數 4 就在裡面');
  },
  async (tok, S) => { // 1159 f = g + 10
    gone(S.c, S.c2, S.p, S.ld, S.mc, S.e1, S.o1);
    S.e2 = mt('f = g + 10   →   addi $s0, $s1, 10', 1.4, 5.6, 12, 'note');
    const o = await S.M.run(tok, 'addi $s0, $s1, 10');
    S.o2 = ok(S.M.reg[16] === 17, 1.4, 5.0, o.desc + ' ✓');
    cap('f = g + 10', 'addi $s0, $s1, 10');
  },
  async (tok, S) => { // 1189.1 沒有 subi：加負數
    S.e3 = mt('addi $s2, $s1, -1   # 減 1 = 加 −1', 1.4, 4.2, 12);
    const o = await S.M.run(tok, 'addi $s2, $s1, -1');
    S.o3 = ok(S.M.reg[18] === 6, 1.4, 3.6, o.desc + ' ✓');
    cap('常數可以是負數', '所以 MIPS 沒有 subtract immediate');
  },
  async (tok, S) => { // 1216.9 $zero
    S.M.calm(); glow(S.M.R.$zero, HL);
    S.z = note('0 太常用：第 0 個 register 用硬體接死成 0（hard-wired）', 1.4, 2.8);
    cap('Constant zero', '$zero 永遠是 0，要 0 就去讀它');
  },
  async (tok, S) => { // 1266.5 寫入沒用
    const o = await S.M.run(tok, 'addi $zero, $zero, 5');
    S.z2 = ok(S.M.reg[0] === 0, 1.4, 2.2, 'addi $zero, $zero, 5 之後 $zero 還是 ' + S.M.reg[0] + ' ✓');
    cap('想把 5 寫進 $zero？', '沒用，它還是 0');
  },
  async (tok, S) => { // 1276.1 move = add $zero
    S.e4 = mt('move $t2, $s1  ＝  add $t2, $s1, $zero', 1.4, 1.4, 12, 'note');
    const o = await S.M.run(tok, 'add $t2, $s1, $zero');
    S.o4 = ok(S.M.reg[10] === S.M.reg[17], 1.4, 0.8, o.desc + ' ✓');
    cap('MIPS 沒有 move 指令', '用「加 0」把 $s1 搬到 $t2');
  },
]);

scene('isA-6a-repr', '6A：指令怎麼表示：32 bits、regular 的格式', [
  async (tok, S) => { // 1339.9 signed / unsigned
    S.h = hd('先提一下：signed / unsigned 數字怎麼表示（logic design 學過，回去自己唸）', 0, 6.6);
    cap('signed、unsigned 怎麼表示', 'logic design 學過，自己複習');
  },
  async (tok, S) => { // 1377.9 機器只懂 0 和 1
    S.a = mt('add $t0, $s1, $s2', -3.2, 5.4, 14, 'note');
    S.q = mt('→  0101…？', 1.4, 5.4, 14);
    cap('add $t0, … 機器看得懂嗎？', '看不懂：電腦只認得 0 和 1');
  },
  async (tok, S) => { // 1417.7 多長：32 bits
    S.l = good('register 32 bits、memory 一個 word 32 bits → 指令也 32 bits（要 regular）', 0, 4.6);
    cap('instruction 要多長？', '32 bits：要 regular');
  },
  async (tok, S) => { // 1488.4 切成 fields
    S.F = fields('add $t0, $s1, $s2', 2.4); reveal(S.F, []);
    S.F.e.fields.forEach(([n, w], k) => S.F.extra.push(small(tag(String(w), 'idx', S.F.row.mid(k), 3.0), 10)));
    cap('把 32 個 bits 切成好幾格', '每一格代表一種 information');
  },
  async (tok, S) => { // 1522.6 前 6 bits = opcode
    S.F.row.ms.forEach((m, i) => glow(m, i < 6 ? HL : null));
    S.d = sm('拿到一個指令：前 6 bits 是 op code，再 5 bits 是第幾個 register…', 0, 1.6);
    cap('電腦先拿前 6 個 bits', '那是 op code；再拿 5 bits 是 register');
  },
  async (tok, S) => { // 1554.7 op code 長度不一 → 不知道拿幾個
    S.F.row.ms.forEach((m) => glow(m, null));
    S.x = bad('如果 R 的 op 6 bits、I 的 7 bits、J 的 8 bits → 拿到指令時不知道要先拿幾個 ✗', 0, 1.0);
    cap('假如每種格式 op code 長度不同', '要拿 6 個、7 個、還是 8 個？');
  },
  async (tok, S) => { // 1679.2 不 regular 就複雜
    S.y = good('格式盡量一樣：第一格永遠是 6-bit op code → 硬體簡單；MIPS 只有三種 format', 0, 0.4);
    cap('不 regular 就會複雜', 'MIPS 只有三種 format');
  },
  async (tok, S) => { // 1717 x86 很多
    S.z = sm('x86：一大堆 format → hardware 很複雜', 0, -0.2);
    cap('x86 有一大堆格式', '硬體很複雜');
  },
  async (tok, S) => { // 1743.1 R、I、J
    S.t = ['R-type', 'I-type', 'J-type'].map((n, k) => bx(n, [FC.blue, FC.green, FC.orange][k], -3.0 + k * 3.0, -1.0, 0, 2.6, 0.55, 0.7));
    cap('三種 instruction format', 'R-type、I-type、J-type');
  },
]);

scene('isA-6a-rfmt', '6A：R-format：add $t0, $s1, $s2 → 0x02324020', [
  async (tok, S) => { // 1769.2 R-type
    S.h = hd('R-type：加、減、邏輯運算', 0, 6.6);
    S.F = fields('add $t0, $s1, $s2', 2.8); reveal(S.F, []);
    cap('第一種：R-type instruction', 'add、sub、and、or 這類');
  },
  async (tok, S) => { // 1786.8 六個 field
    const W = S.F.e.fields.map((f) => f[1]);
    S.F.e.fields.forEach(([n, w], k) => S.F.extra.push(small(tag(n + '（' + w + '）', 'ptr', S.F.row.mid(k), 3.5), 11)));
    S.sum = ok(W.reduce((a, b) => a + b, 0) === 32, 0, 5.6, W.join(' + ') + ' = 32 bits ✓');
    cap('六個 field', 'op 6、rs 5、rt 5、rd 5、shamt 5、funct 6');
  },
  async (tok, S) => { // 1814.3 op = 0
    S.F.hl(0); reveal(S.F, [0]);
    S.n1 = sm('op：R-type 全部同一個 pattern：000000', S.F.row.mid(0) + 1.8, 1.6);
    cap('op code 告訴我們是什麼指令', 'R-type 全部給同一個：0');
  },
  async (tok, S) => { // 1845.6 funct 區分
    S.F.hl(5); reveal(S.F, [0, 5]);
    S.n2 = sm('funct 再區分：add 32、sub 34、and 36、or 37', S.F.row.mid(5) - 2.4, 1.6);
    cap('到底是加、and 還是 or？', '用最後 6 bits 的 function code 區分');
  },
  async (tok, S) => { // 1888.2 rs rt rd 各 5 bits
    S.F.row.ms.forEach((m, i) => glow(m, [1, 2, 3].includes(S.F.row.fOf(i)) ? HL : null));
    S.n3 = sm('rs、rt、rd：32 個 register → 各 5 bits', 0, 1.0);
    cap('rs、rt、rd', '每個都描述一個 register：5 bits');
  },
  async (tok, S) => { // 1911.3 rs、rt 是 source，rd 是 destination
    txt(S.n3, 'rs = 第一個 source、rt = 第二個 source（target）、rd = destination');
    cap('rs 第一個 source、rt 第二個', 'rd 是 destination');
  },
  async (tok, S) => { // 1921.2 shamt 5 bits
    S.F.hl(4);
    S.n4 = ok(2 ** 5 - 1 === 31, 0, 0.4, 'shamt（shift amount）：32-bit 資料最多 shift 31 → 0～31 → 5 bits ✓');
    cap('剩下 5 bits：shift amount', '最多 shift 31 個 bit，5 bits 夠了');
  },
  async (tok, S) => { // 2049.5 不用就填 0
    S.n5 = sm('沒有 shift 的指令（例如 add）：shamt 填 0', 0, -0.2);
    cap('沒用到 shift 的指令', '這個 field 就填 0');
  },
  async (tok, S) => { // 2063.1 例：add $t0, $s1, $s2
    gone(S.n1, S.n2, S.n3, S.n4, S.n5, S.sum); S.F.hl(-1);
    S.ex = mt('例：add $t0, $s1, $s2   （$t0 = $s1 + $s2）', 0, 5.6, 13, 'note');
    cap('看一個例子', 'add $t0, $s1, $s2');
  },
  async (tok, S) => { // 2076.2 op 0、funct 32
    reveal(S.F, [0, 5]); S.F.label(0); S.F.label(5);
    cap('R-type：op = 0', 'add 的 funct = 32');
  },
  async (tok, S) => { // 2092.1 rs = 17、rt = 18
    reveal(S.F, [0, 1, 2, 5]); S.F.label(1, '$s1 = 17'); S.F.label(2, '$s2 = 18');
    cap('rs = $s1 = 第 17 個', 'rt = $s2 = 第 18 個');
  },
  async (tok, S) => { // 2100.9 rd = 8、shamt 0
    reveal(S.F, [0, 1, 2, 3, 4, 5]); S.F.label(3, '$t0 = 8'); S.F.label(4);
    const d = S.F.e.fields.map((f) => f[2]).join(' ');
    S.dec = ok(d === '0 17 18 8 0 32', 0, 0.6, '十進位：' + d + ' ✓');
    cap('rd = $t0 = 第 8 個；shamt = 0', '欄位：0 17 18 8 0 32');
  },
  async (tok, S) => { // 2111.1 binary
    S.bn = mt(S.F.e.fields.map(([, w, v]) => bin(v, w)).join(' '), 0, 0.0, 13);
    cap('每個欄位換成 binary', '6 bits、5 bits… 接起來');
  },
  async (tok, S) => { // 2125.2 跟 data 長得一樣
    const u = parseInt(S.F.bits, 2);
    S.u = sm('同一串 bits 當成 unsigned integer = ' + u.toLocaleString('en-US') + '：長得跟 data 一樣，看你怎麼解釋', 0, -0.6);
    cap('機器看到的就是這串 0101', '跟 data 沒有不同，看怎麼解釋');
  },
  async (tok, S) => { // 2150.4 硬體照格式切開
    S.F.row.ms.forEach((m, i) => glow(m, S.F.row.fOf(i) % 2 ? HL : null)); await wt(tok, 500); S.F.row.ms.forEach((m) => glow(m, null));
    S.cut = sm('知道是指令：前 6 個是 op，再 5、5、5、5、6 一段段拿出來', 0, -1.2);
    cap('告訴你這是指令', '就照格式 6、5、5、5、5、6 切開來解釋');
  },
  async (tok, S) => { // 2215.7 要記得 R-type
    S.rm = note('R-type 長什麼樣子要記得：後面設計 hardware 就照這個', 0, -1.8);
    cap('R-type 的格式一定要記得', '不然後面不會設計 hardware');
  },
  async (tok, S) => { // 2256.4 hexadecimal
    S.hx = ok(S.F.hex === '0x02324020', 0, 4.8, '每 4 bits 一個 hex digit：' + grp(S.F.bits) + ' = ' + S.F.hex + ' ✓');
    cap('0101 太難讀：用 hexadecimal', '4 個 bits 切一塊 = 一個 16 進位數字');
  },
  async (tok, S) => { // 2287.4 eca8 6420
    const h = 'eca86420', b = parseInt(h, 16).toString(2).padStart(32, '0');
    S.ex2 = ok(parseInt(b, 2).toString(16) === h, 0, -2.4, '例：eca8 6420(hex) = ' + grp(b) + '(two) ✓');
    cap('課本的例子：eca8 6420', '每個 hex digit 換成 4 個 bits');
  },
]);

scene('isA-6a-ifmt', '6A：I-format：addi $21, $22, −50 與 lw $t0, 1200($t1)', [
  async (tok, S) => { // 2299.3 I-type 用途
    S.h = hd('I-type：load、store、immediate', 0, 6.6);
    cap('第二種：I-type', 'load、store 和 immediate 用的');
  },
  async (tok, S) => { // 2334.1 op rs rt immediate
    S.F = fields('addi $21, $22, -50', 2.8); reveal(S.F, []);
    S.F.e.fields.forEach(([n, w], k) => S.F.extra.push(small(tag(n + '（' + w + '）', 'ptr', S.F.row.mid(k), 3.5), 11)));
    S.s = ok(5 + 5 + 6 === 16, 0, 5.6, '原本 rd 5 + shamt 5 + funct 6 = 16 bits → 合成一個 immediate ✓');
    cap('op 一樣 6 bits，rs、rt 一樣', '後面 16 bits 合成 immediate');
  },
  async (tok, S) => { // 2387 lw、sw、addi
    S.k = sm('屬於 I-type：lw、sw、addi（add immediate）…', 0, 1.6);
    cap('I-type 包括', 'load、store、add immediate');
  },
  async (tok, S) => { // 2397.8 rs source、rt target
    S.F.row.ms.forEach((m, i) => glow(m, [1, 2].includes(S.F.row.fOf(i)) ? HL : null));
    S.k2 = sm('只剩兩個 register：rs = source；rt = target（addi、lw 的目的地）', 0, 1.0);
    cap('只有兩個 register', 'rs 是 source，rt 有點像 destination');
  },
  async (tok, S) => { // 2428.5 immediate 是 signed、要 sign extend
    S.F.hl(3);
    S.k3 = note('immediate 是 signed number；運算要 32 bits → sign extension', 0, 0.3);
    cap('16 bits 怎麼跟 32 bits 相加？', '先做 sign extension 變成 32 bits');
  },
  async (tok, S) => { // 2479.7 正數補 0、負數補 1
    const v16 = bin(-50, 16), v32 = (v16[0] === '1' ? '1'.repeat(16) : '0'.repeat(16)) + v16;
    const back = parseInt(v32, 2) | 0;
    S.se = ok(back === -50, 0, -0.4, '−50：' + grp(v16) + ' → ' + grp(v32) + ' = ' + back + ' ✓');
    S.se2 = sm('sign bit 是 0 → 前面補 0；是 1 → 前面補 1', 0, -1.0);
    cap('sign bit 往前複製', '正數補 0，負數補 1');
  },
  async (tok, S) => { // 2528.9 範圍
    S.rg = ok(-(2 ** 15) === -32768 && 2 ** 15 - 1 === 32767, 0, -1.6, '16-bit signed：−2¹⁵ ～ 2¹⁵ − 1 = −32768 ～ 32767 ✓');
    cap('常數不能任意大', '一定在 ±2¹⁵ 的範圍裡');
  },
  async (tok, S) => { // 2577.1 good design demands good compromise
    gone(S.k, S.k2, S.k3, S.se, S.se2, S.rg); S.F.hl(-1);
    S.p3 = good('Design Principle 3：Good design demands good compromise', 0, 1.4);
    cap('第三個 design principle', 'good design demands good compromise');
  },
  async (tok, S) => { // 2594.4 shamt / funct 太小 → 合併
    S.c1 = bad('只拿 shamt（5 bits）或 funct（6 bits）放常數？太小了', 0, 0.7);
    S.c2 = good('所以把 rd、shamt、funct 合成一個 16-bit field', 0, 0.1);
    cap('不硬套 R-type 的格式', '把後面合成 16 bits，讓常數大一點');
  },
  async (tok, S) => { // 2632.1 前面一樣 → decode 相似
    S.F.row.ms.forEach((m, i) => glow(m, S.F.row.fOf(i) < 3 ? HL : null));
    S.c3 = sm('格式不同，但 op、rs、rt 的位置和 R-type 一樣 → decode 很像', 0, -0.5);
    cap('格式不一樣，但盡量相似', '前 6 bits 是 op、接著 rs、rt');
  },
  async (tok, S) => { // 2676.5 addi $21, $22, −50：op 8
    gone(S.p3, S.c1, S.c2, S.c3); S.F.row.ms.forEach((m) => glow(m, null));
    S.ex = mt('例：addi $21, $22, -50   （$21 = $22 + (−50)）', 0, 5.6, 13, 'note');
    reveal(S.F, [0]); S.F.label(0);
    cap('例：addi $21, $22, −50', 'addi 的 op code 是 8');
  },
  async (tok, S) => { // 2712.5 rs = 22、rt = 21
    reveal(S.F, [0, 1, 2]); S.F.label(1, '22'); S.F.label(2, '21');
    S.o = note('注意：assembly 先寫 destination（21），格式裡 rs（22）在前、rt（21）在後', 0, 1.2);
    cap('rs = 22（source）、rt = 21（destination）', '順序跟 assembly 寫的不一樣');
  },
  async (tok, S) => { // 2738.3 −50 → 16 bits
    reveal(S.F, [0, 1, 2, 3]); S.F.label(3, '−50');
    const d = S.F.e.fields.map(([, w, v]) => bin(v, w)).join(' ');
    S.b = ok(S.F.hex === '0x22D5FFCE', 0, 0.5, '8 22 21 −50 → ' + d + ' = ' + S.F.hex + ' ✓');
    cap('immediate = −50（16 bits）', '整個指令變成 binary');
  },
  async (tok, S) => { // 2785.5 lw $t0, 1200($t1)：op 35
    gone(S.F, S.ex, S.o, S.b);
    S.G = fields('lw $t0, 1200($t1)', 2.8); reveal(S.G, [0]); S.G.label(0);
    S.G.e.fields.forEach(([n, w], k) => S.G.extra.push(small(tag(n + '（' + w + '）', 'ptr', S.G.row.mid(k), 3.5), 11)));
    S.ex = mt('例：lw $t0, 1200($t1)   （$t0 ← Mem[$t1 + 1200]）', 0, 5.6, 13, 'note');
    cap('load / store 也是 I-type', 'lw 的 op code 是 35');
  },
  async (tok, S) => { // 2838 rs = 9、rt = 8、1200
    reveal(S.G, [0, 1, 2, 3]); S.G.label(1, '$t1 = 9（base）'); S.G.label(2, '$t0 = 8'); S.G.label(3, '1200（offset）');
    const d = S.G.e.fields.map((f) => f[2]).join(' ');
    S.b = ok(d === '35 9 8 1200' && S.G.hex === '0x8D2804B0', 0, 0.6, d + ' → ' + S.G.hex + ' ✓');
    cap('rs = $t1（base）、rt = $t0', '16 bits 放 offset 1200');
  },
  async (tok, S) => { // 2903 offset 也是 signed、範圍有限
    S.r = sm('offset 也是 16-bit signed、要 sign extend：base ± 2¹⁵ bytes 內；超過就要改 base', 0, -0.2);
    cap('offset 不能任意大', '在 ±2¹⁵ 範圍內；超過就改 base 的位置');
  },
]);

// ════════ fy7H3jWfBnY（1.5 Addressing Modes | MIPS：immediate、register、base、PC-relative、pseudo-direct） ════════
// 老師的例子：add $s1, $s2, $s3、lw $s1, 32($s3)、bne $s0, $s1, 100、j 2500。immediate 的例子 addi $s1, $s2, 5、
// $s3 = 1000、PC = 1000 是示意（老師說「if PC is thousand」）。欄位與 hex 用 assemble() 算；
// j 的目標依課本是 PC 最高 4 bits 接上 2500 × 4（不是「加」到 PC 上）。
scene('isA-am-intro', 'Addressing modes：什麼是定址模式', [
  async (tok, S) => { // 0 MIPS 的 addressing modes
    S.h = hd('MIPS 的 addressing modes（定址模式）', 0, 6.4);
    S.c = prop('cpu', 0, 3.4, 0, 1.4, 'MIPS');
    cap('MIPS 的各種 addressing mode', '');
  },
  async (tok, S) => { // 8.2 定義
    S.d = note('指令裡「指定 operand 在哪裡」的各種方法 = addressing mode', 0, 5.6);
    cap('Addressing mode', '指令指定 operand 的各種方式');
  },
  async (tok, S) => { // 16.2 五種
    S.m = ['Immediate', 'Register', 'Base', 'PC-relative', 'Pseudo-direct'].map((n, k) => bx((k + 1) + '. ' + n, [FC.green, FC.blue, FC.purple, FC.orange, FC.pink][k], -5.2 + k * 2.6, 1.0, 0, 2.4, 0.55, 0.7));
    cap('MIPS 有五種 addressing mode', 'immediate、register、base、PC-relative、pseudo-direct');
  },
]);

scene('isA-am-imm', 'Immediate addressing', [
  async (tok, S) => { // 21.2 immediate addressing
    S.h = hd('① Immediate addressing', 0, 6.6);
    cap('第一種：immediate addressing', '');
  },
  async (tok, S) => { // 23.7 格式
    S.F = fields('addi $s1, $s2, 5', 3.2); reveal(S.F, [0, 1, 2, 3]);
    S.F.label(0, 'op（6 bits）'); S.F.label(1, 'rs = $s2 = 18'); S.F.label(2, 'rt = $s1 = 17（結果）'); S.F.label(3, 'immediate = 5');
    S.ex = mt('例（示意）：addi $s1, $s2, 5', 0, 5.6, 13, 'note');
    cap('格式：op、rs（source）', 'rt（結果也放這）、immediate');
  },
  async (tok, S) => { // 41.6 資料就在指令裡
    S.F.hl(3);
    S.g = good('operand 的資料就跟著指令一起給：不另外存在 memory', 0, 1.4);
    S.hx = sm('addi $s1, $s2, 5 → ' + S.F.e.fields.map((f) => f[2]).join(' ') + ' → ' + S.F.hex, 0, 0.8);
    cap('Immediate：資料跟指令一起提供', '不用另外去 memory 拿');
  },
  async (tok, S) => { // 55.9 op code 都是 6 bits → 2⁶ = 64
    S.F.hl(0);
    S.n = ok(2 ** 6 === 64, 0, 0.1, '所有模式的 op code 都是 6 bits：2⁶ = 64 種 op ✓', 0);
    cap('每種模式的 op code 都是 6 bits', '2⁶ = 64 種');
  },
  async (tok, S) => { // 74.9 換 register 不算新指令
    S.n2 = sm('add、multiply 是不同指令；add 換用哪個 register，仍是同一個指令', 0, -0.6);
    S.n3 = note('補充（課本）：R-type 的 op 都是 0，再用 funct 區分，所以實際指令不只 64 個', 0, -1.3);
    cap('用不同 register 不是不同指令', 'R-type 另外靠 funct 區分');
  },
]);

scene('isA-am-reg', 'Register addressing：add $s1, $s2, $s3', [
  async (tok, S) => { // 95.2 三個 register
    S.h = hd('② Register addressing：三個 operand 都是 register', 0, 6.6);
    S.F = fields('add $s1, $s2, $s3', 3.2); reveal(S.F, []);
    S.F.e.fields.forEach(([n, w], k) => S.F.extra.push(small(tag(n + '（' + w + '）', 'ptr', S.F.row.mid(k), 3.9), 11)));
    cap('Register addressing', '有三個 register field');
  },
  async (tok, S) => { // 98.9 32 個 → 5 bits
    S.F.row.ms.forEach((m, i) => glow(m, [1, 2, 3].includes(S.F.row.fOf(i)) ? HL : null));
    S.b = ok(2 ** 5 === 32, 0, 5.6, '32 個 register：2⁵ = 32 → 每個 register field 5 bits ✓');
    cap('MIPS 有 32 個 register', '2⁵ = 32，所以每格 5 bits');
  },
  async (tok, S) => { // 127.7 shamt
    S.F.hl(4);
    S.s = sm('shamt：只有 shift left / right 用；其他指令填 0（五個 bits 都是 0）', 0, 1.6);
    cap('Shift amount', '只有 shift 指令用，其他填 0');
  },
  async (tok, S) => { // 146 funct：add 32、sub 34
    S.F.hl(5);
    S.f = sm('funct 6 bits：add = 32 = ' + bin(32, 6) + '；sub = 34 = ' + bin(34, 6), 0, 1.0);
    cap('Function field 6 bits', 'add 放 32、subtract 放 34（換成 binary）');
  },
  async (tok, S) => { // 171.8 op = 000000
    S.F.hl(0);
    S.o = sm('add、sub 的 op code：000000', 0, 0.4);
    cap('add、sub 的 op code', '六個 bits 全是 0');
  },
  async (tok, S) => { // 179.6 這些值是設計者定的
    S.F.hl(-1);
    S.d = note('0、32、34 是 MIPS 設計者定的；自己設計 processor 可以定別的值', 0, -0.3);
    cap('這些數字從哪來？', 'MIPS 設計者定的，照著用');
  },
  async (tok, S) => { // 204.9 例：add $s1, $s2, $s3
    gone(S.s, S.f, S.o, S.d, S.b);
    S.ex = mt('add $s1, $s2, $s3    # $s1 = $s2 + $s3', 0, 5.6, 13, 'note');
    cap('例：add $s1, $s2, $s3', '$s2 + $s3 的結果放 $s1');
  },
  async (tok, S) => { // 223.9 rs、rt、rd
    reveal(S.F, [1, 2, 3]); S.F.label(1, '$s2 = 18'); S.F.label(2, '$s3 = 19'); S.F.label(3, '$s1 = 17');
    cap('source $s2 → rs、$s3 → rt', 'destination $s1 → rd（各 5 bits 編號）');
  },
  async (tok, S) => { // 248.3 funct 32、op 0、shamt 0
    reveal(S.F, [0, 1, 2, 3, 4, 5]); S.F.label(0); S.F.label(4); S.F.label(5);
    const d = S.F.e.fields.map((f) => f[2]).join(' ');
    S.r = ok(d === '0 18 19 17 0 32', 0, 1.6, d + ' → ' + S.F.hex + ' ✓');
    cap('funct = 32，op、shamt 都是 0', '整個指令 = ' + S.F.hex);
  },
  async (tok, S) => { // 287.5 順序不同
    S.n = note('assembly 裡 $s3 在最後、$s2 在中間；格式裡 rs（$s2）在前、rt（$s3）在中間、rd（$s1）在後', 0, 1.0);
    cap('注意順序', '寫法和格式裡的位置不一樣');
  },
  async (tok, S) => { // 313.9 rt 可用 $t 或 $s
    S.n2 = sm('rt 可以是 $t 也可以是 $s（換成 $t0 → 編號跟著變）；rd 一定放結果', 0, 0.4);
    cap('rt 可以用 $t 或 $s register', 'rd 一定是放結果的');
  },
  async (tok, S) => { // 352.3 為什麼叫 register addressing
    S.g = good('所有 operand 都是 register → register addressing mode', 0, -0.3);
    cap('為什麼叫 register addressing？', '所有 operand 都是 register');
  },
]);

scene('isA-am-base', 'Base（displacement）addressing：lw $s1, 32($s3)', [
  async (tok, S) => { // 371.9 三個名字
    S.h = hd('③ Base addressing（又叫 displacement；老師也叫 indirect）', 0, 6.6);
    cap('第三種：base addressing', '也叫 displacement addressing');
  },
  async (tok, S) => { // 385.8 記住一個例子
    S.k = sm('記住一個例子，就能畫圖說明', 0, 6.0);
    cap('說明 addressing mode', '一定要先給例子');
  },
  async (tok, S) => { // 411.2 lw $s1, 32($s3)
    S.ex = mt('lw $s1, 32($s3)', 0, 5.4, 14, 'note');
    S.M = mach({ regs: [['$s3', 1000], ['$s1', 0]], mem: [[1036, 0], [1032, 77], [1028, 0], [1000, 0]], rx: -4.6, ry: 3.4, mx: 4.6, my: 3.6 });
    S.v = sm('$s3 = 1000、Mem[1032] = 77 是示意', -4.6, 1.6);
    cap('例：load word $s1, 32($s3)', '');
  },
  async (tok, S) => { // 420.7 32 + $s3 = address
    const a = S.M.reg[19] + 32;
    S.a = ok(a === 1032, 0, 4.5, '32 + $s3 的內容 = 32 + 1000 = ' + a + '：這是一個 address ✓');
    glow(S.M.R.$s3, HL); glow(S.M.C[1032], HL);
    cap('32 加上 $s3 的內容', '得到一個 address，指向 memory 的一格');
  },
  async (tok, S) => { // 441.9 word / half / byte
    S.w = sm('word = 4 bytes、half word = 2 bytes、byte = 1 byte（8 bits）', 0, 3.9);
    cap('從那裡拿一個 word', 'word 4 bytes、half word 2、byte 1');
  },
  async (tok, S) => { // 451.6 load 4 bytes into $s1
    const o = await S.M.run(tok, 'lw $s1, 32($s3)');
    S.r = ok(S.M.reg[17] === 77, 0, 0.9, o.desc + ' ✓');
    cap('load word：從 memory 拿 4 bytes', '放進 $s1（register 都是 32 bits）');
  },
  async (tok, S) => { // 468.3 32 不是 data
    S.nd = bad('這裡的 32 不是 data，是 address 的一部分', 0, 0.3);
    cap('32 直接寫在指令裡', '但它不是資料，是 address 的一部分');
  },
  async (tok, S) => { // 483.1 格式：兩個 register + address
    gone(S.M.extra, Object.values(S.M.R), Object.values(S.M.C), S.v, S.a, S.w, S.r, S.nd, S.k);
    S.F = fields('lw $s1, 32($s3)', 2.6); reveal(S.F, []);
    S.F.e.fields.forEach(([n, w], k) => S.F.extra.push(small(tag((k === 3 ? 'address / offset' : n) + '（' + w + '）', 'ptr', S.F.row.mid(k), 3.3), 11)));
    cap('格式不一樣了', '沒有第三個 register，只有兩個 register 和一個 address field');
  },
  async (tok, S) => { // 497.1 直接給的值：data 或 address
    S.F.hl(3);
    S.d = note('指令裡直接給的 16-bit 值：immediate mode → 是 data；base mode → 是 address', 0, 4.4);
    cap('指令裡直接給的值', 'immediate 時是 data，base 時是 address');
  },
  async (tok, S) => { // 515.4 op 35、rs = $s3、rt = $s1
    reveal(S.F, [0, 1, 2, 3]); S.F.label(0); S.F.label(1, '$s3 = 19（base）'); S.F.label(2, '$s1 = 17（結果）'); S.F.label(3, '32');
    S.F.hl(-1);
    const d = S.F.e.fields.map((f) => f[2]).join(' ');
    S.e = ok(d === '35 19 17 32', 0, 1.2, d + ' → ' + S.F.hex + ' ✓');
    cap('op 6 bits，rs = $s3', 'rt = $s1 放結果（填的是 register 編號）');
  },
  async (tok, S) => { // 557.9 instruction code vs op code
    S.ic = sm('整個 32 bits 叫 instruction code；op code 只是前 6 bits', 0, 0.6);
    S.F.row.ms.forEach((m, i) => glow(m, i < 6 ? HL : null));
    cap('分清楚 op code 和 instruction code', 'op code 6 bits，instruction code 32 bits');
  },
  async (tok, S) => { // 589.5 32 + $s3 → address → memory
    S.F.row.ms.forEach((m) => glow(m, null));
    S.p = [bx('32', FC.blue, -3.0, -0.6, 0, 1.0), bx('$s3 = 1000', FC.purple, -0.8, -0.6, 0, 2.0), bx('+', FC.orange, 0.9, -0.6, 0, 0.6)];
    S.p2 = bx('address 1032 → Memory', FC.sand, 3.6, -0.6, 0, 3.2);
    S.ar = arrow(V3(1.3, -0.6, 0.4), V3(1.9, -0.6, 0.4));
    cap('32 和 $s3 的值相加', '得到 address，再去 access memory');
  },
  async (tok, S) => { // 619.8 lw 4 bytes、lh、lb
    S.lb = sm('lw 讀 4 bytes；lh 讀 2 bytes；lb 只讀 1 byte → 都放進 $s1', 0, -1.4);
    cap('load word 讀 4 個 byte', 'load half word 2 個、load byte 1 個');
  },
  async (tok, S) => { // 663.7 base register、offset
    S.nm = good('$s3 提供位址 → base register；32 是 offset（displacement）', 0, -2.0);
    cap('為什麼叫 base addressing？', '$s3 是 base register，32 是位移');
  },
  async (tok, S) => { // 720.6 間接由 register 給
    S.ind = note('address 一部分由 register 間接提供 → 老師也稱 indirect（課本的名字是 base / displacement）', 0, -2.6);
    cap('address 有一部分由 register 間接給', '所以也有人叫 indirect');
  },
]);

scene('isA-am-pc', 'PC-relative addressing：bne $s0, $s1, 100', [
  async (tok, S) => { // 747.7 PC-relative；PC 是什麼
    S.h = hd('④ PC-relative addressing', 0, 6.6);
    S.pc = bx('PC = 1000', FC.gold, -4.6, 4.6, 0, 2.4, 0.7, 0.8);
    S.pl = sm('PC（program counter）：目前正在執行的指令的地址', -1.6, 5.5);
    cap('PC-relative', 'PC 存著目前這個指令的地址');
  },
  async (tok, S) => { // 763.4 指令在 memory、靠 PC 拿
    S.ins = []; for (let k = 0; k < 4; k++) { S.ins.push(bx('instr', FC.sky, 2.6, 2.0 + k * 0.6, 0, 1.6, 0.5, 0.6)); S.ins.push(small(tag(String(992 + k * 4), 'idx', 1.2, 2.0 + k * 0.6), 10)); }
    S.ar = arrow(V3(-3.3, 4.6, 0.4), V3(1.7, 4.0, 0.4), 0x6a4a00);
    cap('指令也放在 memory', '靠 PC 的地址把指令拿進 processor 執行');
  },
  async (tok, S) => { // 782.5 要跳到別處 → 改 PC
    S.j = note('想跳到程式別的地方 → 改 PC 的值', -1.6, 1.0);
    cap('要跳到程式的別處', '就要改變 PC 的值');
  },
  async (tok, S) => { // 801.2 bne $s0, $s1, 100
    gone(S.ins, S.ar, S.j);
    S.ex = mt('bne $s0, $s1, 100    # branch on not equal', 0, 3.8, 13, 'note');
    cap('例：bne $s0, $s1, 100', 'branch on not equal');
  },
  async (tok, S) => { // 814.4 比較，不相等就跳
    S.c = sm('比較 $s0 和 $s1：不相等就跳過去，從那裡開始執行', 0, 3.2);
    cap('$s0、$s1 不相等', '就跳到「100」那裡去執行');
  },
  async (tok, S) => { // 831.3 100 是指令數 → × 4
    S.x = good('100 不是地址，是「第幾個指令」：每個指令 4 bytes → 100 × 4 = ' + 100 * 4 + ' bytes', 0, 2.6);
    cap('100 不是 memory 第 100 格', '是 100 個指令，要乘 4');
  },
  async (tok, S) => { // 861 再加 4
    const t = 1000 + 4 + 100 * 4;
    S.t = ok(t === 1404, 0, 2.0, '目標 = PC + 4 + 100 × 4 = 1000 + 4 + 400 = ' + t + ' ✓（PC = 1000 示意）');
    S.f = hot('target = (PC + 4) + offset × 4', 0, 1.4);
    cap('再加 4：從下一個指令算起', 'PC + 4 + 100 × 4');
  },
  async (tok, S) => { // 893.2 beq 一樣
    S.b = sm('beq（branch on equal）一樣：相等時跳到 PC + 4 + 100 × 4', 0, 0.8);
    cap('也可以用 beq', '相等才跳；觀念一樣');
  },
  async (tok, S) => { // 916 mnemonic
    S.mn = sm('bne、beq 這種簡寫叫 mnemonic（指令的符號表示）', 0, 0.2);
    cap('bne、beq 叫 mnemonic', '指令的簡短符號表示');
  },
  async (tok, S) => { // 944.6 格式
    gone(S.pl, S.c, S.x, S.b, S.mn, S.f, S.t);
    S.F = fields('bne $s0, $s1, 100', 2.4); reveal(S.F, [0, 1, 2, 3]);
    S.F.label(0); S.F.label(1, '$s0 = 16'); S.F.label(2, '$s1 = 17'); S.F.label(3, '100');
    const d = S.F.e.fields.map((f) => f[2]).join(' ');
    S.e = ok(d === '5 16 17 100', 0, 1.2, d + ' → ' + S.F.hex + ' ✓');
    cap('沒有結果要存，只有兩個 register 比較', '$s0 → rs、$s1 → rt、100 → 16 bits');
  },
  async (tok, S) => { // 985.2 16 bits 的範圍
    S.F.hl(3);
    S.r = ok(6 + 5 + 5 + 16 === 32, 0, 0.6, '6 + 5 + 5 = 16，剩 16 bits 放 offset ✓');
    S.r2 = note('課本：16-bit signed → 可跳 −2¹⁵ ～ 2¹⁵ − 1 個指令（老師說 2¹⁶）', 0, 0.0);
    cap('剩下 16 bits 給這個值', '不能給太大的數（20 萬、100 萬放不下）');
  },
  async (tok, S) => { // 1032.3 相對於 PC
    S.F.hl(-1);
    const a = 1000 + 4 + 400, b = 10000 + 4 + 400;
    S.rel = good('相對於 PC：PC = 1000 → 跳到 ' + a + '；PC = 10000 → 跳到 ' + b, 0, -0.7);
    cap('為什麼叫 PC-relative？', '跳到哪裡，看目前的 PC 是多少');
  },
]);

scene('isA-am-pseudo', 'Pseudo-direct addressing：j 2500', [
  async (tok, S) => { // 1079.6 j 2500
    S.h = hd('⑤ Pseudo-direct addressing：j 2500', 0, 6.6);
    S.F = fields('j 10000', 3.6); reveal(S.F, [0, 1]); S.F.label(0); S.F.label(1, '2500');
    cap('最後一種：pseudo-direct', '例：j 2500（jump）');
  },
  async (tok, S) => { // 1091.3 無條件、直接給
    S.n = sm('不像 bne 要比較：無條件跳，目標直接寫在指令裡（26 bits）', 0, 5.6);
    cap('剛才是 conditional jump', '這裡無條件，目標直接給');
  },
  async (tok, S) => { // 1105.2 2500 × 4 = 10000
    const t = 2500 * 4;
    S.t = ok(t === 10000, 0, 2.0, '跳到 2500 × 4 = ' + t + ' ✓', 0);
    cap('processor 跳到 2500 × 4', '= 10000 這個地址');
  },
  async (tok, S) => { // 1114.1 值是指令數
    S.w = sm('2500 是「第幾個指令」，每個指令 4 bytes，所以 × 4', 0, 1.4);
    cap('給的不是地址', '是指令數，所以乘 4');
  },
  async (tok, S) => { // 1142 和 PC 組合（課本：接上 PC 高 4 bits）
    const pc = 1000, hi = (pc >>> 28) & 15, tgt = ((hi << 28) | (2500 << 2)) >>> 0;
    S.c = [bx('PC[31:28] = ' + bin(hi, 4), FC.gold, -3.6, 0.4, 0, 2.6), bx('2500（26 bits）', FC.green, -0.2, 0.4, 0, 3.0), bx('00', FC.gray, 2.2, 0.4, 0, 1.0)];
    S.cc = ok(tgt === 10000, 0, -0.4, '課本：PC 最高 4 bits ‖ 2500 ‖ 00 = ' + tgt + '（「接起來」不是「加上」）✓');
    cap('老師說跟目前的 PC 組合', '課本：接上 PC 最高 4 bits，不是相加');
  },
  async (tok, S) => { // 1159.9 pseudo direct
    S.g = good('值幾乎直接給、又要靠 PC 補最高 4 bits → pseudo-direct（不是完全的 direct）', 0, -1.2);
    cap('所以叫 pseudo-direct', '不完全是 direct addressing');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'procedure-leaf', 'procedure-fact', 'addressing-modes', 'risc-cisc'].concat(FRAG.map((f) => f[0])),
    stop() { run++; },
  };
}
