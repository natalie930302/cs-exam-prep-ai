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

  // ═══ isB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, line: kline } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 2 章 ISA（清大 黃婷婷 第 6B、7A、7B、8A 講）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那一句才動一下，不重播、不循環。
// 編碼、分支目標、暫存器與 stack 的值都在這裡用 assemble() / exec() 或小函式算出來，再和老師說的數字比對，畫面顯示 ✓ / ✘。
// 老師沒給的數字（暫存器初值、陣列內容…）一律在畫面上標「示意」。
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
const ok = (b, t, x, y) => { if (!b && typeof console !== 'undefined') console.warn('isB check failed: ' + t); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const mono = (l, px = 11) => { Object.assign(l.element.style, MONO, { fontSize: px + 'px' }); return l; };
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#c2ecdc', lilac: '#d9cdfb', sky: '#c6def5', peach: '#f4d3b5', dark: '#8d8170' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.cells) return gone(o.cells, o.lbl || [], o.extra || []); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.4, 14], [0, 3.0, 0]];
const u32 = (n) => n >>> 0;
const hex = (n) => '0x' + u32(n).toString(16).toUpperCase().padStart(8, '0');
const b32 = (n) => u32(n).toString(2).padStart(32, '0');
const g4 = (s) => s.match(/.{1,4}/g).join(' ');
const enc = (s) => parseInt(bitsOf(assemble(s)), 2);
const fv = (s) => assemble(s).fields.map((f) => f[2]);     // field values (decimal)
// a format row: spec [[name, bits, value, color]] — widths ∝ bits
function fmtRow(x, y, spec, o = {}) {
  const sc = o.sc || 0.34, total = spec.reduce((s, f) => s + f[1], 0) * sc;
  let cx = x - total / 2; const cells = [], lbl = [];
  spec.forEach(([nm, b, v, c], i) => {
    const w = b * sc;
    const m = cube(v == null || v === '' ? ' ' : String(v), c || FCOL0[i % 6], [w - 0.06, o.h || 0.55, 0.6], cx + w / 2, y, 0);
    cells.push(m); if (nm) lbl.push(small(sm(nm + (o.nobits ? '' : '（' + b + '）'), cx + w / 2, y + 0.55), 10));
    cx += w;
  });
  return { cells, lbl, x: (i) => cells[i].position.x, set(i, v) { relabel(cells[i], v); }, hi(i, c = HL) { cells.forEach((m, k) => glow(m, k === i ? c : null)); } };
}
// a row of bit cubes (groups of 4)
function bitRow(x0, y, str, o = {}) {
  const w = o.w || 0.34, gap = o.gap == null ? 0.07 : o.gap, on = o.on || FC.blue, off = o.off || FC.sky;
  const xs = str.split('').map((b, i) => x0 + i * w + Math.floor(i / 4) * gap);
  const cells = str.split('').map((b, i) => { const m = cube(b, b === '1' ? on : off, [w * 0.86, 0.3, 0.36], xs[i], y, 0); small(m.userData.lbl, 9); return m; });
  return { cells, xs, set(s, c1 = on, c0 = off) { s.split('').forEach((b, i) => { relabel(cells[i], b); tint(cells[i], b === '1' ? c1 : c0); }); }, glowAll(c) { cells.forEach((m) => glow(m, c)); } };
}
// named register boxes in a row
function regs(list, x0, y, dx = 1.5, o = {}) {
  const R = {};
  list.forEach(([nm, v, c], i) => {
    const m = cube(v == null || v === '' ? ' ' : String(v), c || RCOL(rIdx(nm) < 0 ? 8 : rIdx(nm)), [o.w || 1.2, 0.5, 0.6], x0 + i * dx, y, 0);
    if (m.userData.lbl) small(m.userData.lbl, 11); const l = small(sm(nm, x0 + i * dx, y + 0.5), 10);
    R[nm] = { m, l, set(v2) { relabel(m, v2); }, glow(c) { glow(m, c); } };
  });
  return R;
}
// a vertical column of memory words: rows top → bottom = high → low address
function memCol(x, yTop, addrs, vals, o = {}) {
  const dy = o.dy || 0.62, w = o.w || 1.9;
  const cells = addrs.map((a, i) => { const m = cube(vals[i] == null || vals[i] === '' ? ' ' : String(vals[i]), o.c || FC.paper, [w, dy - 0.08, 0.6], x, yTop - i * dy, 0); if (m.userData.lbl) small(m.userData.lbl, 11); return m; });
  const lbl = addrs.map((a, i) => small(sm(String(a), x - w / 2 - 0.55, yTop - i * dy), 10));
  return { cells, lbl, y: (i) => yTop - i * dy, set(i, v) { relabel(cells[i], v); } };
}
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// run a small MIPS program with the chapter simulator (exec), return the state
function runProg(src, regsInit = {}, mem = {}, max = 300) {
  const { prog, labels } = parseProg(src);
  const St = { prog, labels, reg: Array(32).fill(0), mem: { ...mem }, pc: 0, steps: 0 };
  St.reg[29] = 1000;
  for (const [k, v] of Object.entries(regsInit)) St.reg[rIdx(k)] = v;
  const trace = [];
  while (St.prog[St.pc] && St.steps < max) { const pc = St.pc; const o = exec(St); trace.push({ pc, ins: prog[pc].text, out: o, sp: St.reg[29] }); }
  return { St, trace, R: (n) => St.reg[rIdx(n)] };
}

// ════════ PlbXyb-UymI（黃婷婷 第 6B 講：stored program、funct 欄位、shift／and／or／nor、beq／bne／j、if-else、loop、slt） ════════
const ADD_W = enc('add $t0, $s1, $s2');            // 0x02324020（課本 add 的機器碼）
scene('isB-6b-stored', 'Stored-program：指令和資料都是 0101', CAM, [
  async (tok, S) => { // 我們來看一下這個 stored program 的 computer
    S.mem = memCol(3.6, 5.6, ['…', 'A + 4', 'A', '…', 'B + 4', 'B'], ['', '', '', '', '', ''], { w: 3.4 });
    hd('Memory', 3.6, 6.4); cap('Stored-program computer', '先看一個很重要的觀念');
  },
  async (tok, S) => { // instruction、data 都是 32 bit
    S.w1 = pl(g4(b32(ADD_W)), -2.6, 4.6); mono(S.w1, 10); S.w2 = pl(g4(b32(ADD_W)), -2.6, 2.6); mono(S.w2, 10);
    sm('一個 word = 32 bits', -2.6, 5.3);
    cap('instruction、data 都是 32 bits', '兩串一模一樣的 0101（示意）');
  },
  async (tok, S) => { // 你怎麼知道它是 instruction？
    S.q = bub('哪一個是指令？看不出來！', -2.6, 3.6);
    cap('光看 0101，分不出是指令還是資料', '');
  },
  async (tok, S) => { // 不管 instruction 或 data 通通擺在 memory 裡
    remove(S.q);
    S.mem.set(2, hex(ADD_W)); S.mem.set(5, hex(ADD_W)); glow(S.mem.cells[2], HL); glow(S.mem.cells[5], HL);
    await Promise.all([slide(tok, S.w1, 0.6, 4.4, 0, 700), slide(tok, S.w2, 0.6, 2.5, 0, 700)]);
    gone(S.w1, S.w2);
    cap('不管是 instruction 還是 data', '通通都是 0101，放在 memory 裡');
  },
  async (tok, S) => { // 例：你寫了一個 C code
    glow(S.mem.cells[2], null); glow(S.mem.cells[5], null);
    S.f = prop('file', -5.2, 0.6, 0, 1.1, 'C program');
    cap('例：你寫了一個 C program', '它是一個程式……');
  },
  async (tok, S) => { // 對 compiler 來講它是 data
    S.cp = buddy('compiler', 'C → asm', FC.orange, -2.4, 0.3, 0, 0.95); S.cp.mood('happy');
    S.a1 = arrow(V3(-4.5, 1.1, 0), V3(-3.1, 0.9, 0), 0xc08a1f);
    S.out = prop('file', 0.2, 0.6, 0, 1.0, 'assembly');
    cap('對 compiler 來說，你的程式是 data', 'input 是你的 program，output 是 assembly');
  },
  async (tok, S) => { // 通通放在 memory，一塊一塊區分
    S.mem.set(0, 'program 區'); S.mem.set(3, 'data 區');
    cap('program、data 通通放 memory', '只是放在不同區塊');
  },
  async (tok, S) => { // 要當 data 讀就當 data；要當 instruction 就拿去執行
    S.r1 = arrow(V3(1.8, 5.6 - 2 * 0.62, 0), V3(-1.2, 6.2, 0), 0x2fc092); S.t1 = sm('當指令：拿去執行', -2.4, 6.5);
    S.r2 = arrow(V3(1.8, 5.6 - 5 * 0.62, 0), V3(-1.2, 2.6, 0), 0x4b9ee2); S.t2 = sm('當資料：' + u32(ADD_W).toLocaleString('en-US'), -2.4, 2.9);
    cap('讀出來：要當 data 就當 data', '要當 instruction 就拿去執行');
  },
  async (tok, S) => { // instruction 也表示成 binary；program 可以 operate program
    good('Stored program：指令像資料一樣存在 memory', -1.2, 7.0);
    cap('指令也用 binary 表示，跟 data 一樣', 'program 可以處理 program（compiler 就是）');
  },
]);

// R-format 和 I-format 的欄位
const R_SPEC = [['op', 6, 0], ['rs', 5], ['rt', 5], ['rd', 5], ['shamt', 5], ['funct', 6]];
const I_SPEC = [['op', 6], ['rs', 5], ['rt', 5], ['immediate', 16]];
function twoFormats(S) {
  hd('R-format', -6.2, 5.4); S.R = fmtRow(0.4, 5.0, R_SPEC.map((f, i) => [f[0], f[1], i === 0 ? 'op' : f[0] === 'funct' ? 'funct' : '', FCOL0[i]]));
  hd('I-format', -6.2, 2.8); S.I = fmtRow(0.4, 2.4, I_SPEC.map((f, i) => [f[0], f[1], i === 0 ? 'op' : '', FCOL0[i === 3 ? 4 : i]]));
}
scene('isB-6b-funct', 'R-type 為什麼後面還有 funct', CAM, [
  async (tok, S) => { // 為什麼 R-type 後面要加一個 function code
    twoFormats(S);
    cap('問題：R-type 為什麼後面多一個 funct？', 'I-type 只看前面的 op');
  },
  async (tok, S) => { // I-type：op code 直接決定
    S.I.hi(0); S.k1 = sm('I-type：看 op 就知道做什麼', 0.4, 1.4);
    cap('I-type：op code 一看就決定', '');
  },
  async (tok, S) => { // R-type：op 之後還要看後面六個 bit
    S.I.hi(-1); glow(S.R.cells[0], HL); glow(S.R.cells[5], HL);
    S.k2 = sm('R-type：op = 0，再看 funct（6 bits）', 0.4, 4.0);
    cap('R-type：看完 op，還要看最後 6 bits', '大家猜猜看為什麼？');
  },
]);
scene('isB-6b-funct2', '如果全部塞進 op：opcode 不夠、immediate 變小', CAM, [
  async (tok, S) => { // 如果全部都放在 op code
    twoFormats(S);
    S.ops = ['add', 'sub', 'and', 'or', 'nor', 'slt', 'sll', 'srl', 'jr', 'lw', 'sw', 'beq', 'bne', 'addi', '…'].map((t, i) => small(bub(t, -5.6 + i * 0.82, 6.6), 10));
    glow(S.R.cells[0], HL); glow(S.I.cells[0], HL);
    cap('如果每個運算都要自己的 op code', '6 bits 最多 2⁶ = 64 種，不夠用');
  },
  async (tok, S) => { // 6 個 bit 要變 7 個 bit
    gone(S.R, S.I);
    S.R = fmtRow(0.4, 5.0, [['op', 7, 'op 7', FCOL0[0]], ['rs', 5, '', FCOL0[1]], ['rt', 5, '', FCOL0[2]], ['rd', 5, '', FCOL0[3]], ['shamt', 5, '', FCOL0[4]], ['剩', 5, '', FC.gray]]);
    S.I = fmtRow(0.4, 2.4, [['op', 7, 'op 7', FCOL0[0]], ['rs', 5, '', FCOL0[1]], ['rt', 5, '', FCOL0[2]], ['immediate', 15, '15 bits', FC.peach]]);
    glow(S.R.cells[0], HL); glow(S.I.cells[0], HL);
    cap('op code 只好從 6 bits 加長成 7 bits（示意）', '所有 type 的 op 都要一樣長');
  },
  async (tok, S) => { // 總共只有 32 bit，後面就少了
    glow(S.I.cells[3], NG);
    cap('可是指令總共只有 32 bits', 'op 變長，後面就要少一個 bit');
  },
  async (tok, S) => { // 對 R-type 簡單：rs rt rd 不受影響
    glow(S.R.cells[1], OKG); glow(S.R.cells[2], OKG); glow(S.R.cells[3], OKG);
    cap('對 R-type 沒影響', 'rs、rt、rd、shamt 照樣放得下');
  },
  async (tok, S) => { // 對 I-type：immediate 少一個 bit，range 變小
    S.rg = bad('immediate 範圍：±2¹⁵ → ±2¹⁴（少一半）', 0.4, 1.4);
    cap('I-type 的 immediate 少一個 bit', '能表示的常數範圍就變小一半');
  },
  async (tok, S) => { // R-type 用完 rs rt rd 之後還剩 bit 沒用
    gone(S.R, S.I, S.rg);
    twoFormats(S); glow(S.R.cells[5], OKG);
    cap('R-type 在 rs、rt、rd、shamt 後面還有空位', '就拿最後 6 bits 當 funct 來分辨運算');
  },
  async (tok, S) => { // OP code 維持 6 bits 就夠
    S.R.set(0, '0'); S.R.set(5, 'add 32 / sub 34');
    gone(S.ops);
    const e1 = fv('add $t0, $s1, $s2'), e2 = fv('sub $t0, $s1, $s2');
    ok(e1[0] === 0 && e2[0] === 0 && e1[5] === 32 && e2[5] === 34, '✓ add、sub 的 op 都是 0，靠 funct 32 / 34 區分', 0.4, 6.4);
    good('op 維持 6 bits，I-type 保住 16-bit immediate', 0.4, 1.4);
    cap('所有 R-type 共用 op = 0', 'op 只要 6 bits，immediate 不受影響');
  },
]);

scene('isB-6b-bitwise', 'Logical operations：把 word 看成 32 個 bit', CAM, [
  async (tok, S) => { // logical operation 和 decision making
    S.c1 = bx2('① Logical operations', FC.blue, -3, 6.2); S.c2 = bx2('② Decision making（branch）', FC.orange, 3, 6.2);
    cap('接下來兩件事', 'logical operation，和 decision making');
  },
  async (tok, S) => { // decision making：有時執行、有時不執行、會重複執行
    glow(S.c2, HL);
    cap('decision making 很重要', '程式可以有時執行、有時不執行、重複執行');
  },
  async (tok, S) => { // 前面都把 32 bit 當一整塊
    glow(S.c2, null); glow(S.c1, HL);
    S.w = cube('一個 word（32 bits）當一整個數字', FC.sky, [11.6, 0.6, 0.6], 0, 3.6, 0);
    cap('之前：instruction、data 都是 32 bits', '把它當成一整塊（一個數字）來運算');
  },
  async (tok, S) => { // 也可以一個 bit 一個 bit 看
    kill(S.w);
    S.b = bitRow(-6.0, 3.6, b32(0x00000DC0));
    sm('一個 word 裡面其實是 32 個 0／1（示意）', 0, 2.9);
    cap('換個角度：一個 bit 一個 bit 看', '這就是 bitwise operation');
  },
  async (tok, S) => { // shift、and、or 都是一個 bit 一個 bit 做
    ['shift', 'and', 'or'].forEach((t, i) => hot(t, -2 + i * 2, 1.6));
    cap('shift、and、or', '都是對每一個 bit 分別去做');
  },
]);
function bx2(t, c, x, y, w = 5.2) { const m = cube(t, c, [w, 0.6, 0.6], x, y, 0); return m; }

const SH = 0x12345678, SHN = 0x92345678;   // 示意的 32-bit 值（老師投影片「0001 0010 …」的樣子）
scene('isB-6b-shift', 'shift：sll、srl、sra', CAM, [
  async (tok, S) => { // C、Java 寫法 vs MIPS
    S.t = [['', 'C', 'Java', 'MIPS'], ['Shift left', '<<', '<<', 'sll'], ['Shift right', '>>', '>>>', 'srl'], ['Bitwise AND', '&', '&', 'and, andi'], ['Bitwise OR', '|', '|', 'or, ori'], ['Bitwise NOT', '~', '~', '？']]
      .map((r, i) => r.map((c, j) => (i === 0 ? hd : sm)(c, -4.6 + j * 2.6, 6.4 - i * 0.6)));
    cap('logical operations：C、Java、MIPS 的寫法', '');
  },
  async (tok, S) => { // MIPS 沒有 NOT，用 NOR 代替
    txt(S.t[5][3], 'nor'); setCls(S.t[5][3], 'ptr alt');
    cap('MIPS 沒有 NOT 指令，用 nor 代替', 'R-type 要兩個 source、一個 destination（一致性）');
  },
  async (tok, S) => { // 格式：op、destination、source、shift amount
    gone(S.t);
    S.ins = mono(hot('sll  $t2, $s0, 4', -3.2, 6.2), 13);
    sm('op　destination　source　shift amount', -3.2, 5.5);
    cap('寫法：sll 目的, 來源, 移幾位', '第四個欄位就是 shift amount（例：課本）');
  },
  async (tok, S) => { // shift left logical：空出來的位置補 0
    S.r = bitRow(-2.0, 3.8, '10110110', { w: 0.5 }); sm('8-bit 示意', -2.6, 4.4);
    await wt(tok, 300);
    S.r.set('01101100', FC.green); glow(S.r.cells[7], HL);
    S.lab = sm('sll 1：往左移，右邊補 0', 3.4, 3.8);
    cap('shift left logical', '往左移，右邊空出的位置補 0');
  },
  async (tok, S) => { // shift right logical：也是補 0
    glow(S.r.cells[7], null); S.r.set('10110110'); await wt(tok, 300);
    S.r.set('01011011', FC.green); glow(S.r.cells[0], HL); txt(S.lab, 'srl 1：往右移，左邊補 0');
    cap('shift right logical', '往右移，左邊空出的位置也全補 0');
  },
  async (tok, S) => { // shift right arithmetic：當 signed number 看，要 sign extension
    glow(S.r.cells[0], null); S.r.set('10110110'); await wt(tok, 300);
    S.r.set('11011011', FC.orange); glow(S.r.cells[0], HL); txt(S.lab, 'sra 1：左邊補 sign bit（這裡是 1）');
    cap('shift right arithmetic（sra）', '當成 signed number：左邊補 sign bit');
  },
  async (tok, S) => { // 正數補 0、負數補 1
    gone(S.r, S.lab);
    sm('正數（sign bit = 0）：sra 補 0', -1, 3.9); sm('負數（sign bit = 1）：sra 補 1', -1, 3.3);
    cap('正數補 0，負數補 1', 'srl 不管正負，一律補 0');
  },
  async (tok, S) => { // 例子：shift right 8 個 bit，前面補 0
    S.a = bitRow(-6.0, 2.2, b32(SH)); S.al = sm('原本（示意）', -6.6, 2.75);
    S.b = bitRow(-6.0, 1.4, b32(SH >>> 8), { on: FC.green, off: FC.mint }); sm('srl 8', -6.6, 1.95);
    S.b.cells.slice(0, 8).forEach((m) => glow(m, HL));
    ok(g4(b32(SH >>> 8)).startsWith('0000 0000 0001 0010'), '✓ srl 8：前面 8 個 bit 補 0', 3.2, 2.75);
    cap('例：往右 shift 8 個 bit', '前面 8 個 bit 補 0');
  },
  async (tok, S) => { // 往左 shift 8：前面 8 個 bit 出去了，後面補 0
    S.c = bitRow(-6.0, 0.6, b32(SH << 8), { on: FC.green, off: FC.mint }); sm('sll 8', -6.6, 1.15);
    S.c.cells.slice(24).forEach((m) => glow(m, HL));
    cap('往左 shift 8 個 bit', '最前面 8 個 bit 被擠出去，後面 8 個補 0');
  },
  async (tok, S) => { // sra：sign bit 是 0 → 前面補 0
    gone(S.b, S.c);
    S.b = bitRow(-6.0, 1.4, b32(SH >> 8), { on: FC.orange, off: FC.peach }); sm('sra 8', -6.6, 1.95);
    S.b.cells.slice(0, 8).forEach((m) => glow(m, HL));
    cap('sra 8：sign bit 是 0', 'sign extension → 前面補 0（和 srl 一樣）');
  },
  async (tok, S) => { // 負數：前面是 1 → 補 1
    gone(S.a, S.b, S.al);
    S.a = bitRow(-6.0, 2.2, b32(SHN)); sm('負數（示意）', -6.6, 2.75);
    S.b = bitRow(-6.0, 1.4, b32(SHN >> 8), { on: FC.orange, off: FC.peach }); sm('sra 8', -6.6, 1.95);
    S.b.cells.slice(0, 8).forEach((m) => glow(m, HL));
    ok((SHN >> 8) === ((SHN | 0) >> 8) && b32(SHN >> 8).startsWith('11111111'), '✓ sra 8：前面補 8 個 1，還是負數', 3.2, 0.7);
    cap('最前面是 1 → 負數', 'sra 前面要補 1（sign extension）');
  },
]);

scene('isB-6b-shiftfmt', 'shift 的 R-format，與「左移 = 乘 2ⁱ」', CAM, [
  async (tok, S) => { // shift 是 R-type
    const v = fv('sll $t2, $s0, 4');
    S.F = fmtRow(0, 5.0, R_SPEC.map((f, i) => [f[0], f[1], v[i], FCOL0[i]]));
    hot('sll $t2, $s0, 4', 0, 6.3);
    ok(v.join(' ') === '0 0 16 10 4 0', '✓ 欄位 = 0 0 16 10 4 0（課本）', 0, 3.9);
    cap('shift 是 R-type 指令', 'op rs rt rd shamt funct');
  },
  async (tok, S) => { // op + funct 決定是哪一種 shift
    S.F.hi(0); glow(S.F.cells[5], HL);
    S.k = sm('op = 0、funct：sll 0 / srl 2 / sra 3', 0, 3.3);
    cap('op 加 funct 一起決定', '是 left / right，logical / arithmetic');
  },
  async (tok, S) => { // shift amount 放這裡
    S.F.hi(4);
    cap('shift amount 放在 shamt 欄位', '5 bits：0 ～ 31');
  },
  async (tok, S) => { // 只用到兩個 register：rs 不用
    S.F.hi(1); tint(S.F.cells[1], FC.gray); txt(S.k, 'rs 沒用到（填 0）；rt = $s0 來源、rd = $t2 目的');
    cap('只用到兩個 register', 'rs 這格沒用到');
  },
  async (tok, S) => { // 左移一位 = ×2，兩位 = ×2²
    S.F.hi(-1); gone(S.F, S.k);
    S.x = regs([['3', '0000 0011'], ['<< 1', '0000 0110'], ['<< 2', '0000 1100']], -3, 1.8, 3, { w: 2.4 });
    sm('3 → 6 → 12', 0, 1.0);
    ok((3 << 1) === 6 && (3 << 2) === 12, '✓ 左移 i 位 = 乘以 2ⁱ', 0, 0.4);
    cap('sll 1 位 = 乘以 2；2 位 = 乘以 2²', '');
  },
  async (tok, S) => { // 右移 = 除
    sm('12 >> 2 = 3：右移 i 位 = 除以 2ⁱ（unsigned）', 0, -0.2);
    cap('往右 shift = 除以 2ⁱ', '');
  },
  async (tok, S) => { // shift 很便宜，乘法很麻煩
    S.b1 = cube('sll：1 個指令，很快', FC.green, [3, 0.5, 0.6], -3.4, 3.4, 0); S.b2 = cube('乘法：每個 bit 都要處理，慢', FC.red, [5.6, 0.5, 0.6], 2.2, 3.4, 0);
    cap('shift 很便宜：R-type，一下就做完', '乘法比較麻煩、比較慢');
  },
  async (tok, S) => { // compiler 聰明的話：a × 8 變成 sll 3
    S.c = mono(hot('a = a * 8;   →   sll $t0, $t0, 3', 0, 5.0), 12);
    ok((5 << 3) === 5 * 8, '✓ 例：5 << 3 = 40 = 5 × 8', 0, 4.4);
    cap('聰明的 compiler：乘 2 的次方就改用 shift', 'a × 8 = a × 2³ → sll 3');
  },
]);

const T2 = 0x00000DC0, T1M = 0x00003C00;   // 課本例子的 $t2、$t1
scene('isB-6b-andor', 'AND 取出某些 bit、OR 把某些 bit 設成 1', CAM, [
  async (tok, S) => { // AND：bit 對 bit
    S.tt = [['a', 'b', 'a AND b', 'a OR b'], ['0', '0', '0', '0'], ['0', '1', '0', '1'], ['1', '0', '0', '1'], ['1', '1', '1', '1']].map((r, i) => r.map((c, j) => (i ? sm : hd)(c, 3.0 + j * 1.1, 6.4 - i * 0.5)));
    cap('and：bit 跟 bit 一一做 AND', '兩個都是 1 才是 1');
  },
  async (tok, S) => { // given $t2，只要某一塊，其他設成 0
    S.a = bitRow(-6.4, 3.4, b32(T2).slice(16), { w: 0.42 }); hd('$t2 低 16 bits', -6.6, 4.0).center.set(0, 0.5);
    sm('（高 16 bits 都是 0；課本例子）', -1.0, 4.0);
    cap('給定 $t2：只想留下某幾個 bit', '其他 bit 全部清成 0');
  },
  async (tok, S) => { // mask：要的位置設 1，其他設 0
    S.m = bitRow(-6.4, 2.6, b32(T1M).slice(16), { w: 0.42, on: FC.purple, off: FC.lilac }); hd('$t1（mask）', -6.6, 3.15).center.set(0, 0.5);
    cap('做一個 mask：要的位置放 1', '其他位置放 0');
  },
  async (tok, S) => { // and 之後就 select 出來了
    S.r = bitRow(-6.4, 1.6, b32(T2 & T1M).slice(16), { w: 0.42, on: FC.green, off: FC.mint }); hot('and $t0, $t1, $t2', -6.6, 2.15).center.set(0, 0.5);
    ok((T2 & T1M) === 0x00000C00, '✓ $t0 = ' + hex(T2 & T1M), 3.6, 1.0);
    cap('and 之後：要的 bit 被選出來', '其他地方都變成 0（clear）');
  },
  async (tok, S) => { // OR：把某些 bit 設成 1，其他不動
    gone(S.m, S.r);
    cap('or：把某些 bit 設成 1', '其他 bit 不要動');
  },
  async (tok, S) => { // 那幾個 bit 寫 1，其他寫 0
    S.m = bitRow(-6.4, 2.6, b32(T1M).slice(16), { w: 0.42, on: FC.purple, off: FC.lilac }); hd('$t1', -6.6, 3.15).center.set(0, 0.5);
    cap('要設成 1 的位置寫 1', '其他位置寫 0');
  },
  async (tok, S) => { // 跟 1 OR 一定是 1；跟 0 OR 不變
    S.r = bitRow(-6.4, 1.6, b32(T2 | T1M).slice(16), { w: 0.42, on: FC.green, off: FC.mint }); hot('or $t0, $t1, $t2', -6.6, 2.15).center.set(0, 0.5);
    ok((T2 | T1M) === 0x00003DC0, '✓ $t0 = ' + hex(T2 | T1M), 3.6, 1.0);
    cap('任何 bit OR 1 = 1；OR 0 = 不變', '指定的 bit 變 1，其他保持原樣');
  },
]);

scene('isB-6b-nor', 'NOT 用 NOR 加上 $zero 做出來', CAM, [
  async (tok, S) => { // MIPS 沒有 NOT
    S.x = bad('MIPS 沒有 not 指令 ✘', -3, 6.2);
    cap('MIPS 沒有 NOT operation', '它用 nor 來做');
  },
  async (tok, S) => { // a NOR b = NOT (a OR b)
    S.f = mono(hot('a NOR b = NOT ( a OR b )', 2.2, 6.2), 13);
    cap('nor 的意思：先 OR，外面再加 NOT', '');
  },
  async (tok, S) => { // 要讓 a OR b 不變，b 要設 0
    S.f2 = mono(pl('a OR 0 = a', 2.2, 5.4), 12);
    cap('b 要放什麼，a OR b 才不變？', 'b = 0：a OR 0 還是 a');
  },
  async (tok, S) => { // 外面加 NOT → NOT a
    S.f3 = mono(good('a NOR 0 = NOT ( a OR 0 ) = NOT a', 2.2, 4.6), 12);
    cap('外面再加 NOT', 'a NOR 0 就是 NOT a');
  },
  async (tok, S) => { // 0 從哪裡來？
    S.q = bub('R-type 不能放常數，0 從哪裡來？', -3, 3.4);
    cap('R-type 只吃 register，0 從哪裡來？', '這個常常要用到');
  },
  async (tok, S) => { // register 0 永遠是 0：nor $t0, $t1, $zero
    remove(S.q);
    S.R = regs([['$t1', hex(T1M)], ['$zero', '0'], ['$t0', '?']], -4.4, 2.6, 3.6, { w: 2.6 });
    S.c = mono(hot('nor $t0, $t1, $zero', 0, 3.6), 12);
    const v = ~(T1M | 0);
    await wt(tok, 500); S.R['$t0'].set(hex(v)); S.R['$t0'].glow(OKG);
    ok(u32(v) === 0xFFFFC3FF, '✓ $t0 = NOT $t1 = ' + hex(v), 0, 1.6);
    cap('$zero 裡永遠是常數 0', 'nor $t0, $t1, $zero → $t0 = NOT $t1（$t1 示意）');
  },
  async (tok, S) => { // NOT 用 NOR 實作
    good('NOT = NOR 其中一個運算元設成 0', 0, 0.8);
    cap('結論：NOT 用 nor 來實作', '把其中一個運算元設成 $zero');
  },
]);

scene('isB-6b-branch', 'beq、bne、j：做決定', CAM, [
  async (tok, S) => { // 到目前為止都在運算
    S.c = ['add', 'sub', 'and', 'or', 'sll', 'nor'].map((t, i) => cube(t, FC.sky, [1.1, 0.5, 0.6], -5.4 + i * 1.25, 6.4, 0));
    cap('到目前為止：只會運算', 'arithmetic、logical operation');
  },
  async (tok, S) => { // if … 做 A，else 做 B
    S.ifn = cube('if (條件)', FC.gold, [2, 0.6, 0.6], 2.4, 5.0, 0); S.ta = cube('做 A', FC.green, [1.4, 0.5, 0.6], 1.2, 3.8, 0); S.tb = cube('else 做 B', FC.orange, [1.6, 0.5, 0.6], 3.8, 3.8, 0);
    arrow(V3(2.0, 4.7, 0), V3(1.3, 4.1, 0)); arrow(V3(2.8, 4.7, 0), V3(3.6, 4.1, 0));
    cap('寫程式最厲害的地方：做決定', 'if 怎樣就做 A，else 做 B');
  },
  async (tok, S) => { // 一段 code 重複做，直到條件滿足
    S.lp = cube('loop：重複做', FC.purple, [2.4, 0.5, 0.6], -3.4, 4.4, 0); sm('↻ 直到條件不成立', -3.4, 3.8);
    cap('或是一段 code 重複做', '直到 condition 滿足為止');
  },
  async (tok, S) => { // branch equal：beq register1, register2, L1
    gone(S.c, S.ifn, S.ta, S.tb, S.lp); S.lp = null;
    S.l1 = mono(hot('beq  register1, register2, L1', -1.6, 6.2), 13);
    sm('if (register1 == register2) go to L1', -1.6, 5.6);
    cap('第一個：branch equal（beq）', '兩個 register 一樣 → 跳到 L1');
  },
  async (tok, S) => { // demo：相等就跳
    S.R = regs([['$s3', '4'], ['$s4', '4']], -4.6, 4.0, 1.6); S.e = good('4 == 4 → 跳到 L1', -0.8, 4.0);
    sm('（數值示意）', -3.8, 3.4);
    cap('例：兩個值一樣', '就跳去 L1');
  },
  async (tok, S) => { // branch not equal
    gone(S.R['$s3'].m, S.R['$s3'].l, S.R['$s4'].m, S.R['$s4'].l, S.e);
    S.l2 = mono(hot('bne  register1, register2, L1', -1.6, 4.6), 13);
    sm('if (register1 != register2) go to L1', -1.6, 4.0);
    cap('branch not equal（bne）', '兩個不一樣才跳');
  },
  async (tok, S) => { // conditional branch
    note('條件滿足才跳：conditional branch', 3.8, 3.2);
    cap('這兩個叫 conditional branch', '有條件的跳');
  },
  async (tok, S) => { // unconditional jump
    S.l3 = mono(hot('j    L1', -1.6, 2.4), 13); sm('執行到就跳（go to）', -1.6, 1.8);
    cap('unconditional jump：j', '不管什麼，執行到就跳');
  },
  async (tok, S) => { // 也可以用 beq 兩個 0 來做
    S.l4 = mono(pl('beq  $zero, $zero, L1   # 0 == 0，一定跳', 1.4, 1.0), 11);
    cap('用 beq 比兩個 0 也一定會跳', '意義上和 j 一樣');
  },
  async (tok, S) => { // 但兩個的 format 不一樣
    note('意義一樣，但 instruction format 不一樣', 1.4, 0.3);
    cap('但兩者的 instruction format 不一樣', '跳的範圍也不一樣（後面再講）');
  },
  async (tok, S) => { // beq 是 I-type
    gone(S.l1, S.l2, S.l3, S.l4); fresh(CAM[0], CAM[1]);
    hd('beq / bne：I-format', -4.2, 5.6).center.set(0, 0.5);
    S.I = fmtRow(0.6, 5.0, [['op', 6, 'op', FCOL0[0]], ['rs', 5, 'reg1', FCOL0[1]], ['rt', 5, 'reg2', FCOL0[2]], ['跳去哪裡？', 16, '16 bits', FCOL0[4]]]);
    cap('beq：op、兩個 register、後面 16 bits', '很像 I-type → 它就是 I-type');
  },
  async (tok, S) => { // j 是 J-type
    hd('j：J-format', -4.2, 3.0).center.set(0, 0.5);
    S.J = fmtRow(0.6, 2.4, [['op', 6, 'op', FCOL0[0]], ['address', 26, '26 bits', FCOL0[5]]]);
    cap('j 是第三種 format：J-type', 'op 一樣 6 bits，後面 26 bits 都用來描述位置');
  },
  async (tok, S) => { // 16 bits vs 26 bits：j 跳得比較遠
    glow(S.I.cells[3], HL); glow(S.J.cells[1], OKG);
    sm('16 bits：只能在附近跳', 3.6, 4.2); sm('26 bits：可以跳比較遠', 3.6, 1.6);
    cap('beq/bne 剩 16 bits，j 有 26 bits', 'j 可以跳比較遠');
  },
]);

const IFE = 'bne $s3, $s4, Else\nadd $s0, $s1, $s2\nj Exit\nElse: sub $s0, $s1, $s2\nExit:';
scene('isB-6b-ifelse', 'if-then-else 編成 bne + j', CAM, [
  async (tok, S) => { // C：if (i == j) f = g + h; else f = g − h;
    S.c = mono(hot('if (i == j) f = g + h; else f = g − h;', 0, 6.6), 12);
    cap('high-level code：if-then-else', '怎麼產生 assembly？');
  },
  async (tok, S) => { // f g h i j → $s0 … $s4
    S.R = regs([['f', '$s0'], ['g', '$s1'], ['h', '$s2'], ['i', '$s3'], ['j', '$s4']], -2.4, 5.6, 1.2, { w: 1.0 });
    cap('變數放在 register', 'f、g、h、i、j → $s0 ～ $s4');
  },
  async (tok, S) => { // flow：i == j → true path；否則 false path
    S.q = cube('i == j ?', FC.gold, [1.8, 0.5, 0.6], -4.4, 4.2, 0);
    S.tp = cube('f = g + h', FC.green, [1.8, 0.5, 0.6], -5.6, 3.0, 0); S.fp = cube('f = g − h', FC.orange, [1.8, 0.5, 0.6], -3.2, 3.0, 0);
    sm('yes', -5.4, 3.65); sm('no', -3.4, 3.65);
    cap('i == j 走 true path', '否則走 false path');
  },
  async (tok, S) => { // 兩條路最後都到 Exit
    S.ex = cube('Exit', FC.gray, [1.6, 0.5, 0.6], -4.4, 1.8, 0);
    arrow(V3(-5.6, 2.7, 0), V3(-4.7, 2.1, 0)); arrow(V3(-3.2, 2.7, 0), V3(-4.1, 2.1, 0));
    cap('不管走哪條，最後都到 Exit', '執行下一個 statement');
  },
  async (tok, S) => { // bne $s3, $s4, Else
    S.cd = code(['      bne $s3, $s4, Else', '      add $s0, $s1, $s2', '      j   Exit', 'Else: sub $s0, $s1, $s2', 'Exit:'], 2.6, 4.4, 0.6);
    S.cd.hl(0); glow(S.q, HL);
    cap('用 bne：i ≠ j 就跳到 Else', '條件反過來寫');
  },
  async (tok, S) => { // Else：做 g − h
    S.cd.hl(3); glow(S.q, null); glow(S.fp, HL);
    cap('Else：f = g − h', 'sub $s0, $s1, $s2，做完就到 Exit');
  },
  async (tok, S) => { // 不跳：執行下一個指令 add
    S.cd.hl(1); glow(S.fp, null); glow(S.tp, HL);
    cap('bne 不成立就不跳', '執行下一個指令：add（f = g + h）');
  },
  async (tok, S) => { // 不要忘記 j Exit
    S.cd.hl(2);
    cap('true path 做完一定要加 j Exit', '不然會繼續往下');
  },
  async (tok, S) => { // 沒寫 j 的話會跑去做 sub
    S.w = bad('少了 j Exit：add 完會接著做 sub ✘', 2.6, 1.0);
    cap('如果沒寫 j Exit', 'add 做完會接著執行 sub，結果就錯了');
  },
  async (tok, S) => { // 模擬兩種情況驗算
    remove(S.w); S.cd.hl(-1); glow(S.tp, null);
    const a = runProg(IFE, { $s1: 7, $s2: 3, $s3: 4, $s4: 4 }), b = runProg(IFE, { $s1: 7, $s2: 3, $s3: 4, $s4: 5 });
    ok(a.R('$s0') === 10 && b.R('$s0') === 4, '✓ g = 7、h = 3（示意）：i = j → f = 10；i ≠ j → f = 4', 1.6, 1.0);
    cap('指令一個一個照順序執行', '不想執行下一個，就要明確叫它 jump');
  },
]);

const LOOP = 'Loop: sll $t1, $s3, 2\nadd $t1, $t1, $s6\nlw $t0, 0($t1)\nbne $t0, $s5, Exit\naddi $s3, $s3, 1\nj Loop\nExit:';
scene('isB-6b-loop', 'while (save[i] == k) i += 1;', CAM, [
  async (tok, S) => { // loop 的例子
    S.c = mono(hot('while (save[i] == k)  i += 1;', 0, 6.6), 13);
    cap('第二種：loop', 'save[i] 等於 k 就一直把 i 加 1');
  },
  async (tok, S) => { // i 是 save array 的 index
    S.arr = [0, 1, 2, 3, 4, 5].map((k) => cube('save[' + k + ']', FC.paper, [1.5, 0.5, 0.6], -4.4 + k * 1.6, 1.0, 0));
    S.ad = [0, 1, 2, 3, 4, 5].map((k) => small(sm('+' + 4 * k, -4.4 + k * 1.6, 0.4), 10));
    cap('save 是一個 array', 'i 是 index，offset 會跟著 i 變');
  },
  async (tok, S) => { // save 的起點在 $s6
    S.b = hd('$s6 = save 的起始位址（base）', -3.0, 1.9); arrow(V3(-4.4, 1.7, 0), V3(-4.4, 1.3, 0));
    cap('save 的起始位址放在 $s6', 'base register');
  },
  async (tok, S) => { // i 放在 $s3
    S.R = regs([['$s3 = i', '?'], ['$s5 = k', '?']], -4.4, 5.4, 2.4, { w: 1.6 });
    cap('i 放在 $s3', 'k 放在 $s5');
  },
  async (tok, S) => { // i = 3 → 加 12
    S.R['$s3 = i'].set('3'); glow(S.arr[3], HL);
    S.o = good('i = 3 → offset = 3 × 4 = 12', 2.6, 5.4);
    cap('i = 3：要加多少？', '3 × 4 = 12（一個 word 4 bytes）');
  },
  async (tok, S) => { // i = 5 → 20
    glow(S.arr[3], null); glow(S.arr[5], HL); S.R['$s3 = i'].set('5'); txt(S.o, 'i = 5 → offset = 5 × 4 = 20');
    cap('i = 5 → 20', '永遠要乘以 4，offset 先算出來');
  },
  async (tok, S) => { // sll $t1, $s3, 2
    glow(S.arr[5], null); gone(S.o, S.c);
    S.cd = code(['Loop: sll  $t1, $s3, 2', '      add  $t1, $t1, $s6', '      lw   $t0, 0($t1)', '      bne  $t0, $s5, Exit', '      addi $s3, $s3, 1', '      j    Loop', 'Exit:'], 2.8, 6.4, 0.55);
    S.cd.hl(0);
    cap('乘法浪費時間 → 用 shift', 'sll 2 位就是 × 4，放進 $t1');
  },
  async (tok, S) => { // add $t1, $t1, $s6
    S.cd.hl(1);
    cap('base $s6 加上 offset', '$t1 就是 save[i] 的位址');
  },
  async (tok, S) => { // lw $t0, 0($t1)
    S.cd.hl(2);
    cap('lw：把 save[i] 讀進 $t0', '位址已經算好，offset 寫 0');
  },
  async (tok, S) => { // bne $t0, $s5, Exit
    S.cd.hl(3);
    cap('k 在 $s5：$t0 跟 $s5 比', '不相等（條件不滿足）就跳到 Exit');
  },
  async (tok, S) => { // addi $s3, $s3, 1
    S.cd.hl(4);
    cap('相等就往下：i = i + 1', 'addi $s3, $s3, 1');
  },
  async (tok, S) => { // j Loop
    S.cd.hl(5); S.back = arrow(V3(5.6, 6.4 - 5 * 0.55, 0), V3(5.6, 6.4, 0), 0xd64545);
    cap('回到 loop 的開頭', 'j Loop，再執行一遍');
  },
  async (tok, S) => { // 模擬驗算（示意值）
    S.cd.hl(-1);
    const mem = { 200: 5, 204: 5, 208: 5, 212: 7 };
    [5, 5, 5, 7, 0, 0].forEach((v, k) => relabel(S.arr[k], 'save[' + k + ']=' + v));
    const r = runProg(LOOP, { $s3: 0, $s5: 5, $s6: 200 }, mem);
    S.R['$s3 = i'].set(r.R('$s3')); S.R['$s5 = k'].set(5);
    ok(r.R('$s3') === 3 && r.St.steps === 3 * 6 + 4, '✓ 示意：save = 5,5,5,7、k = 5 → 跑完 i = 3（共 ' + r.St.steps + ' 個指令）', 0, -0.4);
    cap('這就是 loop 的寫法', '示意值跑一次：save[3] = 7 ≠ 5 就離開');
  },
]);

scene('isB-6b-block', 'loop 的結構與 basic block', CAM, [
  async (tok, S) => { // 上面幾行在算 save[i] 的位址並讀出來
    S.cd = code(['Loop: sll  $t1, $s3, 2', '      add  $t1, $t1, $s6', '      lw   $t0, 0($t1)', '      bne  $t0, $s5, Exit', '      addi $s3, $s3, 1', '      j    Loop', 'Exit:'], -1.2, 6.2, 0.6);
    S.cd.ls.slice(0, 3).forEach((l) => setCls(l, 'ptr'));
    S.k1 = sm('← 算出 save[i] 的位址，讀進 $t0', 3.6, 5.6);
    cap('前三行：做 index', '算出 save[i] 在哪裡，把資料讀出來');
  },
  async (tok, S) => { // conditional branch 是測試的地方
    S.cd.ls.slice(0, 3).forEach((l) => setCls(l, '')); setCls(S.cd.ls[3], 'ptr alt');
    S.k2 = sm('← 測試：save[i] ≠ k 就跳出去', 3.6, 4.4);
    cap('bne：跟 loop 的 condition 有關', '不滿足就跳出去');
  },
  async (tok, S) => { // body 可能很長
    setCls(S.cd.ls[3], ''); setCls(S.cd.ls[4], 'ptr alt');
    S.k3 = sm('← body：可以是很多個 statement', 3.6, 3.8);
    cap('藍色部分是 loop 的 body', '這裡只有 i = i + 1，也可能很長');
  },
  async (tok, S) => { // 最後 j Loop 跳回開頭
    setCls(S.cd.ls[4], ''); setCls(S.cd.ls[5], 'ptr alt');
    S.a = arrow(V3(-5.6, 6.2 - 5 * 0.6, 0), V3(-5.6, 6.2, 0), 0xd64545);
    cap('body 做完，j Loop', '跳回 loop 的開頭');
  },
  async (tok, S) => { // basic block
    setCls(S.cd.ls[5], '');
    S.bb = P.ghostBox('#c08a1f', 7.6, 0.6 * 4 + 0.2, 0.4); S.bb.position.set(-1.2, 6.2 - 1.5 * 0.6, 0);
    note('basic block', -6.0, 7.0);
    cap('loop 會執行很多次', 'compiler 最佳化通常針對 basic block');
  },
  async (tok, S) => { // entry point 進來、跳出去之前
    sm('從頭進來（entry）', 3.6, 6.8); sm('到 branch 為止（exit）', 3.6, 3.2);
    good('basic block：中間沒有 branch 進出、只有一個入口', 0, 1.2);
    cap('basic block：從 entry point 進來', '到跳出去之前的那一段 code');
  },
]);

scene('isB-6b-slt', 'slt：小於要怎麼判斷', CAM, [
  async (tok, S) => { // 還有哪些比較
    S.ops = ['==', '!=', '<', '>', '<=', '>='].map((t, i) => cube(t, FC.sky, [0.9, 0.5, 0.6], -4.6 + i * 1.1, 6.2, 0));
    cap('寫程式還有哪些比較？', '大於、小於、大於等於、小於等於……');
  },
  async (tok, S) => { // 只有 beq、bne 不夠
    tint(S.ops[0], FC.green); tint(S.ops[1], FC.green); [2, 3, 4, 5].forEach((i) => tint(S.ops[i], FC.peach));
    sm('beq / bne 只能做 == 和 !=', -1.9, 5.5);
    cap('只有 beq、bne 不夠用', '');
  },
  async (tok, S) => { // set on less than
    S.l = mono(hot('slt  rd, rs, rt', 2.6, 4.4), 13);
    cap('只多加一個指令：set on less than', 'slt，R-type');
  },
  async (tok, S) => { // rs < rt 就把 rd set 成 1
    sm('if (rs < rt) rd = 1; else rd = 0;', 2.6, 3.8);
    cap('rs 小於 rt → rd 設成 1（set）', '否則 rd = 0');
  },
  async (tok, S) => { // 再用 conditional branch 跟 0 比
    sm('再用 bne / beq 拿 rd 跟 $zero 比', 2.6, 3.2);
    cap('接著再用 conditional branch', '拿它跟 0 比');
  },
  async (tok, S) => { // g < h 要兩個指令
    gone(S.ops);
    S.cd = code(['slt $t0, $s0, $s1   # $t0 = 1 if g < h', 'bne $t0, $zero, Less'], -2.6, 1.8, 0.6);
    S.R = regs([['$s0 = g', '3'], ['$s1 = h', '7'], ['$t0', '?']], -4.4, 6.2, 2.0, { w: 1.4 }); sm('（g、h 數值示意）', 2.0, 6.2);
    S.cd.hl(0);
    cap('if (g < h) goto Less', '用 slt + bne 兩個指令');
  },
  async (tok, S) => { // g < h → $t0 = 1
    const r = runProg('slt $t0, $s0, $s1', { $s0: 3, $s1: 7 });
    S.R['$t0'].set(r.R('$t0')); S.R['$t0'].glow(OKG);
    ok(r.R('$t0') === 1, '✓ 3 < 7 → $t0 = 1（set）', 3.4, 1.8);
    cap('g 真的小於 h', '$t0 就被 set 成 1');
  },
  async (tok, S) => { // $t0 跟 0 比：不是 0 就跳 Less
    S.cd.hl(1);
    good('$t0 ≠ 0 → 跳到 Less', 3.4, 1.2);
    cap('$t0 跟 0 比：不是 0', '表示 g < h，跳到 Less');
  },
]);

// 4 種比較：slt + beq/bne 的組合（以窮舉驗算）
const CMP4 = [['a < b', 'slt $t0, a, b', 'bne $t0, $zero, L', (a, b) => a < b, (a, b) => (a < b ? 1 : 0) !== 0],
  ['a >= b', 'slt $t0, a, b', 'beq $t0, $zero, L', (a, b) => a >= b, (a, b) => (a < b ? 1 : 0) === 0],
  ['a > b', 'slt $t0, b, a', 'bne $t0, $zero, L', (a, b) => a > b, (a, b) => (b < a ? 1 : 0) !== 0],
  ['a <= b', 'slt $t0, b, a', 'beq $t0, $zero, L', (a, b) => a <= b, (a, b) => (b < a ? 1 : 0) === 0]];
const CMP4_OK = CMP4.every((c) => { for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (c[3](a, b) !== c[4](a, b)) return false; return true; });
scene('isB-6b-noblt', '為什麼沒有 blt：省 opcode、不拖慢 clock', CAM, [
  async (tok, S) => { // 為什麼不設計 blt、ble……
    S.w = ['blt', 'ble', 'bgt', 'bge'].map((t, i) => cube(t, FC.peach, [1.2, 0.5, 0.6], -4.6 + i * 1.4, 6.2, 0));
    cap('為什麼不直接設計「小於就跳」？', 'blt、ble、bgt、bge 四個指令');
  },
  async (tok, S) => { // 四個 opcode
    S.x = bad('要多用 4 個 op code ✘', -2.5, 5.4);
    cap('第一：要多浪費 4 個 op code', '');
  },
  async (tok, S) => { // slt 換位置 + beq/bne 組合就能做出四種
    S.y = good('slt 換一下 a、b 的位置 + beq / bne 搭配 → 四種都做得到', 0, 4.6);
    cap('只用 slt，換 register 擺法', '再搭配 beq / bne，就能做出四種');
  },
  async (tok, S) => { // 第二個理由
    gone(S.w, S.x, S.y);
    cap('第二個理由：clock cycle', '');
  },
  async (tok, S) => { // 一個指令要在一個 clock cycle 完成
    S.bars = ['add', 'sub', 'lw', 'beq'].map((t, i) => cube(t, FC.blue, [2.0, 0.45, 0.6], -4.2, 5.8 - i * 0.6, 0));
    S.clk = sm('每個指令都在 1 個 clock cycle 做完（週期一樣長）', 1.6, 6.4);
    cap('每個指令都在一個 clock cycle 完成', '所有指令的 clock period 都一樣');
  },
  async (tok, S) => { // 合併成一個指令 → clock 變長，大家都被拖累
    S.bl = cube('blt：比較 + 跳（太多事）', FC.red, [4.0, 0.45, 0.6], -3.2, 5.8 - 4 * 0.6, 0);
    await anim(tok, 700, (u) => S.bars.forEach((m) => { m.scale.x = 1 + u; m.position.x = -4.2 + u * 1.0; }));
    S.bad = bad('clock period 變長 → 每個指令都變慢 ✘', 2.4, 2.6);
    cap('如果比較 + 跳一次做完', 'clock 要變長，妨害到所有其他指令');
  },
  async (tok, S) => { // 拆成兩個指令，clock 保持短
    kill(S.bl); remove(S.bad);
    await anim(tok, 600, (u) => S.bars.forEach((m) => { m.scale.x = 2 - u; m.position.x = -3.2 - u * 1.0; }));
    cube('slt', FC.green, [2.0, 0.45, 0.6], -4.2, 5.8 - 4 * 0.6, 0); cube('bne', FC.green, [2.0, 0.45, 0.6], -2.1, 5.8 - 4 * 0.6, 0);
    good('拆成 slt + bne：兩個短 cycle，別人不受影響 ✓', 2.4, 2.6);
    cap('拆成兩個指令', '每個 clock cycle 都還是短的');
  },
  async (tok, S) => { // beq/bne 是 common case
    note('beq、bne 是 common case：讓它快', 2.4, 1.8);
    cap('beq、bne 是 common case', 'make the common case fast');
  },
  async (tok, S) => { // 回家練習：四種都用 slt 做出來
    gone(S.bars); remove(S.clk);
    fresh(CAM[0], CAM[1]);
    CMP4.forEach((c, i) => { hd(c[0], -5.2, 6.0 - i * 0.9); mono(pl(c[1], -1.6, 6.0 - i * 0.9), 11); mono(pl(c[2], 3.4, 6.0 - i * 0.9), 11); });
    ok(CMP4_OK, '✓ 用 −5 ～ 5 全部組合驗算，四種都正確', 0, 2.2);
    cap('回家練習：<、>=、>、<= 四種', '都只用 slt + beq / bne');
  },
]);

scene('isB-6b-signed', 'signed 還是 unsigned 比較：slt 與 sltu', CAM, [
  async (tok, S) => { // 比較時要注意
    S.a = bitRow(-6.0, 5.2, b32(-1)); hd('$s0', -6.6, 5.75).center.set(0, 0.5);
    S.b = bitRow(-6.0, 4.2, b32(1)); hd('$s1', -6.6, 4.75).center.set(0, 0.5);
    sm('（課本例子）', 4.6, 5.75);
    cap('比較兩個 number 時要注意', '同一串 bit 可以有兩種解讀');
  },
  async (tok, S) => { // unsigned：上面比較大
    S.u = sm('unsigned：$s0 = 4,294,967,295 > $s1 = 1', -1.0, 3.2);
    cap('當 unsigned number', '上面這個比較大');
  },
  async (tok, S) => { // signed：第一個 bit 是 1 → 負數
    S.s = sm('signed：$s0 = −1 < $s1 = 1', -1.0, 2.6);
    glow(S.a.cells[0], HL);
    cap('當 signed number', '最前面的 1 代表負數：−1');
  },
  async (tok, S) => { // slt vs sltu：同一個 bit pattern 結果不同
    const sl = (-1 | 0) < 1 ? 1 : 0, su = u32(-1) < 1 ? 1 : 0;
    mono(hot('slt  $t0, $s0, $s1   →  $t0 = ' + sl, -1.0, 1.6), 12); mono(hot('sltu $t1, $s0, $s1   →  $t1 = ' + su, -1.0, 1.0), 12);
    ok(sl === 1 && su === 0, '✓ signed 比較得 1，unsigned 比較得 0', -1.0, 0.2);
    cap('slt 做 signed 比較，sltu 做 unsigned', '同一個 bit pattern，結果不一樣');
  },
]);

// ════════ H6wkyzXzX6g（黃婷婷 第 7A 講：load-store 複習、R/I-format、procedure call、$ra/jal/jr、leaf procedure 與 stack、$t vs $s、non-leaf、fact） ════════
function fmtCards(S, y = 5.6) {
  S.cR = cube('R-format：op rs rt rd shamt funct', FC.sky, [5.2, 0.55, 0.6], -3.0, y, 0);
  S.cI = cube('I-format：op rs rt immediate', FC.mint, [5.2, 0.55, 0.6], 3.0, y, 0);
}
scene('isB-7a-review', '今天：procedure；先複習 instruction format', CAM, [
  async (tok, S) => { // 今天介紹 supporting procedure in hardware
    S.t = hot('Supporting procedures in computer hardware', 0, 6.6);
    cap('今天：硬體怎麼支援 procedure', '先複習前面的 instruction set');
  },
  async (tok, S) => { // 先複習：要依 instruction set 建 organization
    fmtCards(S);
    sm('依照 instruction set 來設計 computer organization', 0, 4.8);
    cap('先複習 instruction format', '後面要根據它來設計硬體');
  },
  async (tok, S) => { // RISC：又稱 load-store machine
    note('MIPS 是 RISC，又叫 load-store machine', 0, 3.8);
    cap('MIPS 是 RISC', '又稱為 load-store machine');
  },
]);
scene('isB-7a-ls', 'Load-store machine 與 immediate operand', CAM, [
  async (tok, S) => { // operand 可以從很多地方來
    S.alu = cube('ALU（加減乘除）', FC.orange, [2.4, 0.8, 0.8], 0, 4.0, 0);
    S.mem = cube('Memory', FC.paper, [2.4, 1.4, 0.8], 4.6, 1.6, 0); S.rf = cube('Registers', FC.lilac, [2.4, 1.4, 0.8], -4.6, 1.6, 0);
    S.q = arrow(V3(3.6, 2.4, 0), V3(1.0, 3.6, 0), 0xd64545);
    cap('要做運算時，operand 從哪裡來？', '一般來說可以從 memory 等很多地方來');
  },
  async (tok, S) => { // load-store：operand 一定要在 register
    kill(S.q); S.x = bad('✘ ALU 不直接拿 memory 的資料', 3.6, 3.4);
    S.ok1 = arrow(V3(-3.6, 2.4, 0), V3(-1.0, 3.6, 0), 0x2fc092);
    cap('load-store machine 規定', 'operand 一定要在 register 裡');
  },
  async (tok, S) => { // 一定要在 register 裡面
    good('✓ 加減之前，資料一定已經在 register', -3.6, 3.4);
    cap('要加、要減之前', '資料一定要先在 register 裡');
  },
  async (tok, S) => { // data 很多，不可能全部在 register
    remove(S.x); sm('資料很多，大部分放在 memory', 4.6, 0.5);
    cap('資料那麼多，不可能全放 register', '大部分在 memory');
  },
  async (tok, S) => { // 用 load、store 搬進搬出
    S.ld = arrow(V3(3.4, 1.9, 0.3), V3(-3.4, 1.9, 0.3), 0x4b9ee2); S.st = arrow(V3(-3.4, 1.3, 0.3), V3(3.4, 1.3, 0.3), 0x2fc092);
    hd('lw：memory → register', 0, 2.3); hd('sw：register → memory', 0, 0.9);
    cap('搬進搬出用另一種指令', 'load（lw）和 store（sw）');
  },
  async (tok, S) => { // 常常出現的 operand：constant
    S.k = mono(hot('a + 5　a + 6　b + 7', 0, 6.4), 13);
    cap('還有一種常見的 operand：constant', 'a + 5、b + 7……');
  },
  async (tok, S) => { // 直接把 operand 放在 instruction 裡
    S.ins = fmtRow(0, 5.6, [['op', 6, 'addi', FCOL0[0]], ['rs', 5, '', FCOL0[1]], ['rt', 5, '', FCOL0[2]], ['immediate', 16, '5', FC.peach]], { sc: 0.22 });
    glow(S.ins.cells[3], HL);
    cap('把常數直接放進指令裡', '叫 immediate operand');
  },
  async (tok, S) => { // 不這樣做就要放 memory、再搬進來，花時間
    sm('不然：常數放 memory → 要先 lw 進來，花時間', 0, 4.9);
    cap('不這樣做的話', '常數要放 memory，用之前先搬進 register，浪費時間');
  },
  async (tok, S) => { // 稱為 I-type
    good('這種格式叫 I-type（immediate）', 3.6, 6.4);
    cap('這種特別的指令：I-type', '');
  },
]);
scene('isB-7a-rfmt', 'R-format：每個欄位幾個 bit、為什麼', CAM, [
  async (tok, S) => { // 第一種：R-type
    hd('R-type instruction', 0, 6.4);
    cap('第一種：R-type instruction', '');
  },
  async (tok, S) => { // op、rs rt rd、shamt、funct
    S.F = fmtRow(0, 5.0, R_SPEC.map((f, i) => [f[0], f[1], f[0], FCOL0[i]]), { nobits: true });
    cap('欄位：op、rs、rt、rd、shamt、funct', '三個 operand：rs、rt、rd');
  },
  async (tok, S) => { // 做加減運算用
    S.e = mono(pl('add $t0, $s1, $s2　sub …　and …', 0, 3.9), 12);
    cap('主要用來做加減等運算', '');
  },
  async (tok, S) => { // 6 / 5 / 5 / 5 / 5 / 6
    R_SPEC.forEach((f, i) => S.F.set(i, f[1] + ' bits'));
    ok(R_SPEC.reduce((s, f) => s + f[1], 0) === 32, '✓ 6 + 5 + 5 + 5 + 5 + 6 = 32', 0, 3.2);
    cap('op 6 bits，rs、rt、rd 各 5 bits', '');
  },
  async (tok, S) => { // 32 個 register → 5 bits
    [1, 2, 3].forEach((i) => glow(S.F.cells[i], HL));
    good('32 個 register = 2⁵ → 5 bits 就能指定一個', 0, 2.4);
    cap('為什麼 5 bits？', 'register file 有 32 個 register，2⁵ = 32');
  },
  async (tok, S) => { // shamt：0 到 31
    [1, 2, 3].forEach((i) => glow(S.F.cells[i], null)); glow(S.F.cells[4], HL);
    sm('shamt：移 0 ～ 31 位，5 bits 剛好', 0, 1.7);
    cap('shift amount 也是 5 bits', '一個 word 32 bits，最多移 0 ～ 31');
  },
  async (tok, S) => { // op + funct 決定動作
    glow(S.F.cells[4], null); glow(S.F.cells[0], HL); glow(S.F.cells[5], HL);
    cap('funct 和 op 合起來', '決定要做什麼動作');
  },
]);
scene('isB-7a-ifmt', 'I-format：immediate 運算', CAM, [
  async (tok, S) => { // 第二種：I-type
    hd('I-type instruction', 0, 6.4);
    S.F = fmtRow(0, 5.0, I_SPEC.map((f, i) => [f[0], f[1], f[0], FCOL0[i === 3 ? 4 : i]]), { nobits: true });
    cap('第二種：I-type', '哪些指令屬於 I-type？');
  },
  async (tok, S) => { // I 是 immediate
    hot('I = immediate：operand 直接放在指令裡', 0, 3.9);
    cap('I 代表 immediate', '把 operand 直接放在 instruction 裡');
  },
  async (tok, S) => { // op rs rt + 16 bits immediate
    I_SPEC.forEach((f, i) => S.F.set(i, f[1] + ' bits')); glow(S.F.cells[3], HL);
    mono(pl('addi $s3, $s3, 4', 0, 3.2), 12);
    cap('op、rs、rt，剩下 16 bits', '全部放 immediate operand（例：課本 addi）');
  },
]);
scene('isB-7a-ifmt2', 'I-format 第二種用途：load / store', CAM, [
  async (tok, S) => { // 還有哪些屬於 I-type
    S.F = fmtRow(0, 5.0, I_SPEC.map((f, i) => [f[0], f[1], f[1] + ' bits', FCOL0[i === 3 ? 4 : i]]));
    hd('I-format', 0, 6.4);
    cap('還有哪些指令屬於 I-type？', '這很重要，好幾種都是');
  },
  async (tok, S) => { // load / store
    const v = fv('lw $t0, 32($s3)');
    S.F.set(0, 'lw = ' + v[0]); S.F.set(1, '$s3 = ' + v[1]); S.F.set(2, '$t0 = ' + v[2]); S.F.set(3, 'offset ' + v[3]);
    mono(hot('lw $t0, 32($s3)', 0, 3.9), 12);
    cap('load、store 也是 I-type', '兩個 register，加一個 offset');
  },
  async (tok, S) => { // offset 去描述
    glow(S.F.cells[3], HL);
    sm('位址 = $s3（base）+ 32（offset）', 0, 3.2);
    ok(fv('lw $t0, 32($s3)').join(' ') === '35 19 8 32', '✓ 欄位 = 35 19 8 32', 0, 2.5);
    cap('用 offset 來描述位址', 'base register + offset');
  },
]);
scene('isB-7a-ifmt3', 'I-format 第三種用途：beq / bne', CAM, [
  async (tok, S) => { // 其實這些 type 就能建一台 computer
    S.F = fmtRow(0, 5.0, I_SPEC.map((f, i) => [f[0], f[1], f[1] + ' bits', FCOL0[i === 3 ? 4 : i]]));
    hd('I-format', 0, 6.4);
    cap('後面設計 organization', '只要做這幾種 type，就幾乎能建一台 computer');
  },
  async (tok, S) => { // 寫程式最重要：做決定（if then else）
    mono(hot('if (…) … else …', 0, 3.9), 12);
    cap('寫程式最重要：一行一行執行，還要做決定', '要 implement if-then-else 需要哪些指令？');
  },
  async (tok, S) => { // conditional branch：beq / bne 也是 I-type
    S.F.set(0, 'beq / bne'); S.F.set(1, 'reg1'); S.F.set(2, 'reg2'); S.F.set(3, '跳去哪');
    cap('conditional branch：beq、bne', '也是 I-type');
  },
  async (tok, S) => { // I-type 有三種用途
    ['① immediate 運算（addi…）', '② load / store（lw、sw）', '③ beq / bne（做決定）'].forEach((t, i) => good(t, -3.4 + i * 3.4, 2.8));
    sm('R-type 只有一種樣子，很好記', 0, 2.0);
    cap('I-type 雖叫 immediate，卻有三種用途', 'immediate 運算、load/store、branch');
  },
]);

scene('isB-7a-proc', 'Procedure call 的六個步驟', CAM, [
  async (tok, S) => { // procedure call：reuse、modular
    hot('Procedure call', 0, 6.6);
    cap('寫程式很重要的一件事：procedure call', '程式才能 reuse、寫得 modular');
  },
  async (tok, S) => { // caller 和 callee
    S.dad = buddy('caller（爸爸）', 'main', FC.blue, -4.6, 0.3, 0, 1.0); S.son = buddy('callee（兒子）', 'proc', FC.green, 4.6, 0.3, 0, 1.0);
    S.dad.mood('happy');
    cap('caller：去叫的人（爸爸）', 'callee：被叫的 procedure（兒子）');
  },
  async (tok, S) => { // ① 設定 parameter
    S.s1 = sm('① 把 parameter（引數）放好', -4.6, 4.2);
    S.par = cube('參數', FC.purple, [1.0, 0.45, 0.5], -3.6, 1.5, 0.6);
    cap('① caller 先把參數 set up 好', '參數不同，結果就不同');
  },
  async (tok, S) => { // ② 把 control 交給 procedure
    await slide(tok, S.par, 3.6, 1.5, 0.6, 800);
    S.s2 = sm('② 把 control 交給 callee（call）', 0, 3.6); S.son.mood('wow');
    cap('② 把 control 轉給 callee', '跳到 procedure 去執行');
  },
  async (tok, S) => { // ③ 取得 storage
    S.s3 = sm('③ callee 取得需要的 storage', 4.6, 4.2);
    cap('③ callee 取得自己要用的 storage', '例如 local variable、register');
  },
  async (tok, S) => { // ④ 執行
    S.s4 = sm('④ 執行 procedure 的工作', 4.6, 3.6); await S.son.hop(tok);
    cap('④ 執行 procedure 的工作', '');
  },
  async (tok, S) => { // ⑤ 把結果放好
    S.res = cube('結果', FC.gold, [1.0, 0.45, 0.5], 3.6, 1.5, 0.6); kill(S.par);
    S.s5 = sm('⑤ 把 result 放在 caller 拿得到的地方', 0, 3.0);
    cap('⑤ 把 result 放好', '交給 caller');
  },
  async (tok, S) => { // ⑥ 把 control 交回 caller
    await slide(tok, S.res, -3.6, 1.5, 0.6, 800); S.dad.mood('happy'); S.son.mood('calm');
    S.s6 = sm('⑥ 把 control 交回 caller（return）', 0, 2.4);
    cap('⑥ 把 control 轉回 caller', '');
  },
  async (tok, S) => { // assembly：parameter 放在 register
    note('在 assembly：參數、結果都放在固定的 register', 0, 6.0);
    cap('組合語言裡：參數放在 register', '要有規則，不然 callee 不知道去哪裡拿');
  },
  async (tok, S) => { // 爸爸 call 兒子、兒子 call 孫子，但只有一個 register file
    S.kid = buddy('孫子', '', FC.pink, 4.6, -1.6, 2.2, 0.7);
    S.rf = cube('只有一個 register file', FC.lilac, [3.4, 0.5, 0.6], 0, 0.4, 0); glow(S.rf, NG);
    cap('爸爸叫兒子、兒子叫孫子……', '可是 register file 只有一個，資料放哪？');
  },
  async (tok, S) => { // 結果放在固定的地方
    glow(S.rf, null);
    good('結果放固定的 register → 回來就知道去哪拿', 0, -0.5);
    cap('做完把結果放在固定的 register', '回到 caller 就知道去哪裡拿');
  },
]);

scene('isB-7a-leafc', 'leaf_example：需要哪些特別的 register', CAM, [
  async (tok, S) => { // C 的 function call
    S.c1 = code(['main:', '  …', '  sum = leaf_example(a, b, c, d);', '  …'], -3.4, 6.4, 0.5);
    S.c2 = code(['int leaf_example(int g, int h, int i, int j) {', '  int f;', '  f = (g + h) - (i + j);', '  return f;', '}'], 2.2, 3.8, 0.5);
    cap('一個簡單的 C function call', 'main 叫 leaf_example，參數 a、b、c、d');
  },
  async (tok, S) => { // 前兩個加、後兩個加，再相減
    S.c2.hl(2);
    cap('leaf_example：f = (g + h) − (i + j)', '再 return f 給 caller');
  },
  async (tok, S) => { // 呼叫的地方和 procedure 在不同位置
    S.c1.hl(2); S.c2.hl(-1);
    S.a = arrow(V3(-1.2, 5.4, 0), V3(-0.4, 3.9, 0), 0xc08a1f); sm('跳過去執行，做完再回來往下', -4.4, 4.2);
    cap('呼叫的 statement 和 procedure 在不同地方', '跳過去執行，算完再回來');
  },
  async (tok, S) => { // 要把 return address 存起來
    S.ra = sm('要記住：回來時回到哪一行（return address）', -2.0, 1.2);
    cap('第一：要記住回到哪裡', 'return address 一定要存起來');
  },
  async (tok, S) => { // 特別的 register：$ra
    S.R = regs([['$ra', '返回位址']], -5.0, 0.3, 1.4, { w: 1.8 });
    cap('有一個特別的 register：$ra', '32 個 register 裡，規定一個當 return address');
  },
  async (tok, S) => { // procedure 的位址：label
    sm('procedure address：用 label（leaf_example）表示', 2.2, 1.2);
    cap('要跳去哪裡：procedure 的 address', '像 jump 一樣給一個 label');
  },
  async (tok, S) => { // argument：$a0–$a3
    Object.assign(S.R, regs([['$a0', 'g'], ['$a1', 'h'], ['$a2', 'i'], ['$a3', 'j']], -2.6, 0.3, 1.3, { w: 1.1 }));
    cap('參數放在特別的地方：$a0 ～ $a3', '這次 3、5、7、8，下次可能不一樣');
  },
  async (tok, S) => { // return value：$v0、$v1
    Object.assign(S.R, regs([['$v0', 'f'], ['$v1', '']], 3.0, 0.3, 1.3, { w: 1.1 }));
    cap('回傳值放在 $v0、$v1', '');
  },
  async (tok, S) => { // 運算用 $s0–$s7
    Object.assign(S.R, regs([['$s0–$s7', '運算']], 5.8, 0.3, 1.3, { w: 1.6 }));
    cap('運算用的 register：$s0 ～ $s7', '每一種都有固定的位置');
  },
]);

const RGRID = (S) => { S.g = RN.map((n, i) => { const x = RX(i % 8) - 3.0, y = RY(Math.floor(i / 8)) - 0.6; const m = cube(i, '#e6dfd2', [0.86, 0.48, 0.6], x, y, 0); small(m.userData.lbl, 10); const l = small(sm(n, x, y + 0.44), 9); return { m, l }; }); };
const lightRegs = (S, ids, c) => ids.forEach((i) => { tint(S.g[i].m, c); glow(S.g[i].m, HL); });
const dimRegs = (S) => S.g.forEach((r) => glow(r.m, null));
scene('isB-7a-regmap', '32 個 register 的分工（register convention）', [[0, 3.6, 13.5], [0, 3.6, 0]], [
  async (tok, S) => { // $t0–$t7 = 8–15
    RGRID(S); lightRegs(S, [8, 9, 10, 11, 12, 13, 14, 15], FC.orange);
    cap('第 8 ～ 15 號：$t0 ～ $t7', '（$t8、$t9 是 24、25）');
  },
  async (tok, S) => { // $s0–$s7 = 16–23
    dimRegs(S); lightRegs(S, [16, 17, 18, 19, 20, 21, 22, 23], FC.green);
    cap('第 16 ～ 23 號：$s0 ～ $s7', '在 procedure call 裡，$t 和 $s 用法不同');
  },
  async (tok, S) => { // $a0–$a3 = 4–7
    dimRegs(S); lightRegs(S, [4, 5, 6, 7], FC.purple);
    cap('參數 $a0 ～ $a3：第 4 ～ 7 號', '要呼叫 procedure，參數就放這裡');
  },
  async (tok, S) => { // $v0、$v1 = 2、3
    dimRegs(S); lightRegs(S, [2, 3], FC.blue);
    cap('回傳值 $v0、$v1：第 2、3 號', '');
  },
  async (tok, S) => { // $zero
    dimRegs(S); lightRegs(S, [0], FC.gray);
    cap('第 0 號：$zero', '硬體上永遠是 0');
  },
  async (tok, S) => { // $ra = 31
    dimRegs(S); lightRegs(S, [31], FC.gold);
    cap('第 31 號：$ra（return address）', '保留給 procedure 回來用，不能亂用');
  },
  async (tok, S) => { // $gp、$sp、$fp、$k0/$k1
    dimRegs(S); lightRegs(S, [28, 29, 30], FC.gold); lightRegs(S, [26, 27], FC.dark);
    sm('$gp 28、$sp 29、$fp 30；$k0、$k1 給 OS；$at 給 assembler', 0, -0.6);
    cap('$gp、$sp、$fp 有特殊用途', '$k0、$k1 是 OS 用的');
  },
  async (tok, S) => { // stack 等一下會用到
    dimRegs(S); glow(S.g[29].m, HL);
    cap('$sp（stack pointer）', '呼叫 procedure 時會用到，等一下介紹');
  },
]);

scene('isB-7a-jumpq', '跳去 procedure，還要能跳回來', CAM, [
  async (tok, S) => { // 需要特別的指令
    S.c = code(['main:', '  …', '  jump → leaf_example', '  (回來後的下一行)', '  …'], -3.6, 6.2, 0.55);
    S.p = code(['leaf_example:', '  …', '  return'], 3.4, 6.2, 0.55);
    cap('要叫 procedure，需要特別的指令', '先想：要跳到 subroutine 去');
  },
  async (tok, S) => { // beq/bne 短距離，j 跳遠
    S.k = sm('beq / bne：跳近；j：跳遠', 0, 2.6);
    cap('已經學過能「跳」的指令', 'beq / bne 跳短距離，j 跳比較遠');
  },
  async (tok, S) => { // 用 jump 跳過去
    S.c.hl(2); S.a = arrow(V3(-1.2, 5.1, 0), V3(1.6, 6.1, 0), 0xc08a1f);
    cap('跳去 subroutine：用一個 jump', '');
  },
  async (tok, S) => { // 還要跳回來
    S.p.hl(2); S.b = arrow(V3(1.6, 5.0, 0), V3(-1.2, 4.5, 0), 0x2fc092);
    cap('跳過去就算了嗎？', '還要跳回來');
  },
  async (tok, S) => { // 回到下一個 instruction
    S.c.hl(3);
    cap('回到哪裡？', '回到 call 的下一個 instruction');
  },
  async (tok, S) => { // 誰記錄「下一個要執行哪裡」？
    S.q = bub('下一個要執行的指令位址，記在哪裡？', 0, 1.6);
    cap('執行時，誰告訴我們下一個要執行哪一個？', '老師請同學回答');
  },
]);

const JAL_AT = 1000, PROC_AT = 3468;   // jal 所在位址（示意）、procedure 位址（老師說「第 3468」）
scene('isB-7a-jal', 'PC、jal 與 jr $ra', CAM, [
  async (tok, S) => { // Program Counter
    S.pc = cube('PC = ' + JAL_AT, FC.gold, [2.6, 0.6, 0.6], -4.6, 6.0, 0); hd('Program Counter', -4.6, 6.7);
    S.c = code([JAL_AT + '  jal leaf_example', (JAL_AT + 4) + '  （下一個指令）'], -2.6, 4.6, 0.6);
    S.p = code([PROC_AT + '  leaf_example: …', '      …', '      jr $ra'], 3.2, 4.6, 0.6);
    S.c.hl(0); sm('（jal 的位址 ' + JAL_AT + ' 是示意）', -4.6, 3.0);
    cap('答案：Program Counter（PC）', 'PC 存的是下一個要執行的指令位址');
  },
  async (tok, S) => { // next instruction 要存起來
    S.c.ls[1].element.className = 'lab-label ptr';
    cap('等一下要回到 next instruction', '所以要把它的位址存在某個地方');
  },
  async (tok, S) => { // PC 設成 procedure 的位址
    relabel(S.pc, 'PC = ' + PROC_AT); glow(S.pc, HL); S.p.hl(0);
    cap('要跳過去：把 procedure 的位址放進 PC', '下一個就從 ' + PROC_AT + ' 開始執行');
  },
  async (tok, S) => { // next instruction 記在 $ra
    glow(S.pc, null);
    S.R = regs([['$ra', JAL_AT + 4]], -4.6, 1.6, 1.5, { w: 1.6 }); S.R['$ra'].glow(OKG);
    cap('next instruction 的位址記在 $ra', 'return address register');
  },
  async (tok, S) => { // 做完再把 $ra 放回 PC
    S.p.hl(2); S.ar = arrow(V3(-4.6, 2.0, 0), V3(-4.6, 5.6, 0), 0x2fc092);
    cap('procedure 做完', '把 $ra 放回 PC，就回到 next instruction');
  },
  async (tok, S) => { // 本來可以兩個指令做
    kill(S.ar); S.p.hl(-1); S.c.hl(0);
    S.two = mono(pl('① $ra = 下一個位址　② j leaf_example', 0.8, 1.6), 11);
    cap('照理說可以用兩個指令做', '存 return address + jump');
  },
  async (tok, S) => { // jal：一個指令做兩件事
    remove(S.two);
    S.R['$ra'].set('?'); relabel(S.pc, 'PC = ' + JAL_AT);
    const r = runProg('jal leaf\nj Done\nleaf: addi $t0, $zero, 1\njr $ra\nDone:');
    await wt(tok, 400); S.R['$ra'].set(JAL_AT + 4); S.R['$ra'].glow(OKG);
    await wt(tok, 400); relabel(S.pc, 'PC = ' + PROC_AT); glow(S.pc, HL);
    ok(r.trace[0].out.writes.includes(31) && r.trace[1].ins.startsWith('addi'), '✓ jal：先 $ra = PC + 4，再跳到 label', 0.8, 1.6);
    cap('jal（jump and link）一個指令做兩件事', '① $ra = PC + 4　② PC = procedure 位址');
  },
  async (tok, S) => { // make the common case fast
    note('太常用 → make the common case fast', 0.8, 0.9);
    cap('為什麼特別設計 jal？', '太常用了：make the common case fast');
  },
  async (tok, S) => { // jr $ra
    S.p.hl(2); relabel(S.pc, 'PC = ' + (JAL_AT + 4)); S.c.hl(1);
    S.ar = arrow(V3(-4.6, 2.0, 0), V3(-4.6, 5.6, 0), 0x2fc092);
    cap('回來：jr $ra（jump register）', '把 $ra 的 32-bit 值 copy 到 PC');
  },
  async (tok, S) => { // jr 也能做 switch
    sm('jr 也能做 switch：把 case 的位址放進 register 再 jr（示意）', 0.8, 0.2);
    cap('jr 不只用在 procedure', '也可以拿來實作 switch');
  },
  async (tok, S) => { // 新增的兩個指令
    good('procedure call 一定要的兩個指令：jal、jr', 0.8, -0.5);
    cap('記住兩個指令', 'jal（jump and link）、jr（jump register）');
  },
]);

const MAIN_SRC = 'add $a0, $s0, $zero\nadd $a1, $s1, $zero\nadd $a2, $s2, $zero\nadd $a3, $s3, $zero\njal leaf\nadd $s4, $v0, $zero\nj Done\nleaf: add $t0, $a0, $a1\nadd $t1, $a2, $a3\nsub $v0, $t0, $t1\njr $ra\nDone:';
scene('isB-7a-caller', 'caller 要寫什麼：搬參數、jal、拿 $v0', CAM, [
  async (tok, S) => { // caller 要怎麼寫
    S.cd = code(['add $a0, $s0, $zero   # a', 'add $a1, $s1, $zero   # b', 'add $a2, $s2, $zero   # c', 'add $a3, $s3, $zero   # d', 'jal leaf_example', 'add $s4, $v0, $zero   # sum'], -2.6, 6.4, 0.55);
    S.cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
    mono(hot('sum = leaf_example(a, b, c, d);', 3.2, 6.6), 11);
    cap('caller 這一行要寫成哪些指令？', '');
  },
  async (tok, S) => { // a b c d 在 $s0–$s3
    S.R = regs([['$s0', 5], ['$s1', 3], ['$s2', 4], ['$s3', 2]], -4.6, 2.0, 1.25, { w: 1.0 });
    Object.assign(S.R, regs([['$a0', '?'], ['$a1', '?'], ['$a2', '?'], ['$a3', '?']], 1.6, 2.0, 1.25, { w: 1.0 }));
    sm('a、b、c、d 正在運算，放在 $s0 ～ $s3（值示意）', -2.6, 1.1);
    cap('a、b、c、d 在 $s0 ～ $s3', '要搬到參數 register $a0 ～ $a3');
  },
  async (tok, S) => { // 搬到 $a0–$a3
    for (let k = 0; k < 4; k++) S.cd.ls[k].element.style.visibility = '';
    S.cd.hl(0);
    cap('add $a0, $s0, $zero…', '把 $s0 ～ $s3 搬到 $a0 ～ $a3');
  },
  async (tok, S) => { // $zero 永遠是 0 → 相當於 move
    const v = [5, 3, 4, 2];
    for (let k = 0; k < 4; k++) { S.cd.hl(k); S.R['$a' + k].set(v[k]); S.R['$a' + k].glow(OKG); await wt(tok, 450); }
    cap('$zero 永遠是 0', 's + 0 = s，等於 move（搬過去）');
  },
  async (tok, S) => { // jal leaf_example
    S.cd.ls[4].element.style.visibility = ''; S.cd.hl(4);
    cap('jal leaf_example', '跳過去；callee 做完會回到下一行');
  },
  async (tok, S) => { // 結果在 $v0
    const r = runProg(MAIN_SRC, { $s0: 5, $s1: 3, $s2: 4, $s3: 2 });
    Object.assign(S.R, regs([['$v0', r.R('$v0')]], 6.4, 2.0, 1.25, { w: 1.0 })); S.R['$v0'].glow(OKG);
    cap('回來時，結果已經放在 $v0', '(5 + 3) − (4 + 2) = 2');
  },
  async (tok, S) => { // add $s4, $v0, $zero
    S.cd.ls[5].element.style.visibility = ''; S.cd.hl(5);
    const r = runProg(MAIN_SRC, { $s0: 5, $s1: 3, $s2: 4, $s3: 2 });
    Object.assign(S.R, regs([['$s4 = sum', r.R('$s4')]], 6.4, 0.6, 1.25, { w: 1.0 }));
    ok(r.R('$s4') === 2, '✓ 模擬：sum = $s4 = 2', 0, 0.0);
    cap('sum 放在 $s4', '把 $v0 搬到 $s4，caller 完成');
  },
]);

scene('isB-7a-callee', 'callee 也要用 $s0、$t0、$t1：衝突了', CAM, [
  async (tok, S) => { // callee 怎麼寫
    S.c2 = code(['int leaf_example(int g, int h, int i, int j) {', '  int f;', '  f = (g + h) - (i + j);', '  return f;', '}'], -2.6, 6.6, 0.5);
    cap('callee 怎麼寫？', '進來拿參數，還要一個 local 變數 f');
  },
  async (tok, S) => { // g h i j 在 $a0–$a3
    S.R = regs([['$a0 = g', 5], ['$a1 = h', 3], ['$a2 = i', 4], ['$a3 = j', 2]], -4.8, 3.4, 1.6, { w: 1.2 });
    cap('caller 已經把 g、h、i、j', '放在 $a0 ～ $a3');
  },
  async (tok, S) => { // f 用 $s0
    Object.assign(S.R, regs([['$s0 = f', '']], 2.4, 3.4, 1.6, { w: 1.2 }));
    cap('f 用 $s0', '');
  },
  async (tok, S) => { // 先算 g+h、i+j 放 temporary
    Object.assign(S.R, regs([['$t0', ''], ['$t1', '']], 4.0, 3.4, 1.4, { w: 1.0 }));
    sm('（老師口頭說 t1、t2；課本用 $t0、$t1）', 4.6, 2.6);
    cap('一次只能加兩個', 'g + h、i + j 先放在 temporary $t0、$t1');
  },
  async (tok, S) => { // 回傳用 $v0
    Object.assign(S.R, regs([['$v0', '']], 4.0, 1.6, 1.4, { w: 1.0 }));
    cap('結果放 $v0 回傳', '');
  },
  async (tok, S) => { // caller 也在用 $s、$t
    S.dad = buddy('caller', '$s0 $t0 $t1', FC.blue, -4.0, -0.6, 1.2, 0.9); S.son = buddy('callee', '$s0 $t0 $t1', FC.green, 0, -0.6, 1.2, 0.9);
    S.dad.mood('wow');
    cap('問題：caller 自己也在用 $s、$t', 'callee 也要用 $s0、$t0、$t1，搶同一批 register');
  },
  async (tok, S) => { // 只有一個 register file
    S.rf = cube('register file 只有一份（32 個）', FC.lilac, [5.6, 0.5, 0.6], -2.0, 1.0, 1.2); glow(S.rf, NG);
    S.dad.mood('sad');
    cap('因為 register file 只有一個', 'callee 一用，caller 的資料就被蓋掉');
  },
  async (tok, S) => { // 開 party：要恢復原狀
    glow(S.rf, null); S.son.mood('happy');
    S.b = bub('在家開 party 可以，爸爸回來前要恢復原狀！', 0.6, 0.8, 1.2);
    cap('像爸爸出門，你在家開 party', '爸爸回來前要全部恢復原狀');
  },
  async (tok, S) => { // 用之前先存，用完再還原
    remove(S.b);
    good('用之前先存起來 $s0、$t0、$t1 → 用完再還原', 0, 0.8, 1.2);
    cap('callee 要用 $s0、$t0、$t1', '使用前先存起來，做完再恢復');
  },
]);

const STK = [1000, 996, 992, 988, 984];
scene('isB-7a-stack', '存到哪裡？memory 裡的 stack 與 $sp', CAM, [
  async (tok, S) => { // 存到 stack，在 memory
    S.m = memCol(2.6, 6.2, STK, ['caller 的資料', '', '', '', ''], { w: 2.6, c: FC.sky });
    hd('Memory（stack 區）', 2.6, 6.9); sm('高位址 ↑', -0.6, 6.2); sm('低位址 ↓', -0.6, 3.7);
    cap('存在哪裡？stack', 'stack 在 memory 裡，memory 很大');
  },
  async (tok, S) => { // 組織成一個 stack
    cap('而且要組織成一個 stack', '呼叫 procedure 時把資料放上去');
  },
  async (tok, S) => { // LIFO：push、pop
    S.it = cube('push', FC.green, [1.4, 0.45, 0.5], -2.0, 6.0, 0.6);
    await slide(tok, S.it, 2.6, S.m.y(1), 0.6, 700); kill(S.it);
    S.m.set(1, 'push 進來'); await wt(tok, 300);
    sm('last in, first out：最後放的最先拿走', -2.6, 5.0);
    cap('stack：last in first out', '要放就 push 到 top，用完就 pop');
  },
  async (tok, S) => { // stack pointer
    S.m.set(1, '');
    S.sp = hot('← $sp', 4.7, S.m.y(0));
    cap('stack pointer：記住現在用到哪裡', '指著 top of stack');
  },
  async (tok, S) => { // $sp 是第 29 號 register
    S.R = regs([['$sp（$29）', 1000]], -4.4, 4.4, 1.6, { w: 1.6 });
    sm('（位址 1000 是示意）', -4.4, 3.6);
    cap('$sp 就是第 29 號 register', '');
  },
  async (tok, S) => { // 把 $s0、$t0、$t1 存進去
    ['存 $t1', '存 $t0', '存 $s0'].forEach((t, k) => { S.m.set(k + 1, t); tint(S.m.cells[k + 1], FC.mint); });
    S.sp.position.y = S.m.y(3); S.R['$sp（$29）'].set(988);
    cap('procedure 執行時：把要用的 $s0、$t0、$t1 存進去', 'stack 往下長 3 格');
  },
  async (tok, S) => { // 結束後恢復原狀
    await wt(tok, 300);
    [1, 2, 3].forEach((k) => { S.m.set(k, ''); tint(S.m.cells[k], FC.sky); });
    S.sp.position.y = S.m.y(0); S.R['$sp（$29）'].set(1000);
    good('procedure 結束：stack 恢復原狀，$sp 回到 1000', -1.0, 2.2);
    cap('procedure 一結束就恢復原狀', '回到爸爸那邊，像什麼都沒發生');
  },
]);

const LEAF_CAM = [[0.6, 3.7, 13.2], [0.6, 3.7, 0]];
scene('isB-7a-leafrun', 'leaf_example 一行一行跑：sp − 12、存三個、算、還原、jr', LEAF_CAM, [
  async (tok, S) => { // leaf procedure 要做什麼
    S.V = buildSim('leaf'); exec(S.V.S); S.V.refresh();   // 先默默執行 jal：$ra = PC + 4，PC 到 leaf
    small(sm('暫存器初值示意；jal 已經執行：$ra = ' + (BASE + 4), 2.6, 7.3), 10);
    cap('leaf_example 被叫進來了', '它要先處理會被破壞的 register');
  },
  async (tok, S) => { // $sp 指著 top of stack
    glow(S.V.regs[29], HL);
    cap('stack 在 memory，$sp 告訴我們位址', '現在 $sp = 1000');
  },
  async (tok, S) => { // 要 3 個 word：往下移 12
    cap('要存 3 個 data，每個 4 bytes', 'stack 從高位址往下長：$sp 減 12');
  },
  async (tok, S) => { // addi $sp, $sp, -12
    glow(S.V.regs[29], null); await simStep(S.V, tok, 1600, true);
  },
  async (tok, S) => { // sw $t1, 8($sp)
    await simStep(S.V, tok, 1600, true);
  },
  async (tok, S) => { // sw $t0, 4($sp)；sw $s0, 0($sp)
    await simStep(S.V, tok, 1200, true); await simStep(S.V, tok, 1200, true);
  },
  async (tok, S) => { // add $t0, $a0, $a1
    await simStep(S.V, tok, 1600, true);
  },
  async (tok, S) => { // add $t1；sub $s0
    await simStep(S.V, tok, 1200, true); await simStep(S.V, tok, 1200, true);
  },
  async (tok, S) => { // add $v0, $s0, $zero
    await simStep(S.V, tok, 1600, true);
  },
  async (tok, S) => { // 走之前要恢復原狀
    S.V.mem.slice(5, 8).forEach((m) => glow(m, HL));
    cap('procedure 做完了，可以走了嗎？', '不行！要先恢復原狀');
  },
  async (tok, S) => { // lw $s0；lw $t0；lw $t1
    S.V.mem.forEach((m) => glow(m, null));
    for (let k = 0; k < 3; k++) await simStep(S.V, tok, 600, true);
  },
  async (tok, S) => { // addi $sp, $sp, 12
    await simStep(S.V, tok, 1600, true);
  },
  async (tok, S) => { // jr $ra
    await simStep(S.V, tok, 1600, true);
    const R = S.V.S.reg;
    ok(R[2] === 2 && R[16] === 11 && R[8] === 22 && R[9] === 33 && R[29] === 1000, '✓ $v0 = 2；$s0、$t0、$t1 還原成 11、22、33；$sp = 1000', 2.6, 0.0);
  },
]);

scene('isB-7a-ts', '$t 與 $s：冰箱和桌上的東西', CAM, [
  async (tok, S) => { // S 和 T 好像沒分別
    S.t = cube('$t0 ～ $t9', FC.orange, [2.4, 0.6, 0.6], -3.4, 5.6, 0); S.s = cube('$s0 ～ $s7', FC.green, [2.4, 0.6, 0.6], 3.4, 5.6, 0);
    cap('一開始 $s、$t 好像沒什麼分別', '寫 procedure call 時就有差了');
  },
  async (tok, S) => { // 冰箱吃光沒關係，玻璃不能打破
    S.dad = buddy('爸爸（caller）', '', FC.blue, -0.2, 0.2, 0, 1.0);
    S.fr = cube('冰箱：吃光也沒關係', FC.peach, [3.0, 0.5, 0.6], -3.4, 4.6, 0); S.tb = cube('桌上的玻璃：不能打破', FC.mint, [3.0, 0.5, 0.6], 3.4, 4.6, 0);
    cap('有些東西爸爸不在乎（冰箱吃光沒關係）', '有些很在乎（玻璃不能打破）');
  },
  async (tok, S) => { // 不在乎的放 $t
    glow(S.t, HL); glow(S.fr, HL);
    cap('不在乎的東西放 $t（temporary）', '被弄亂就算了');
  },
  async (tok, S) => { // 在乎的放 $s
    glow(S.t, null); glow(S.fr, null); glow(S.s, HL); glow(S.tb, HL);
    cap('在乎的東西放 $s', '不能破壞');
  },
  async (tok, S) => { // 只要存 $s，$t 不用存
    glow(S.s, null); glow(S.tb, null);
    S.m = memCol(4.6, 2.8, [1000, 996], ['', ''], { w: 2.0 }); S.sp = hot('← $sp', 6.3, S.m.y(0));
    cap('這樣 callee 只要存 $s 就好', '$t 不需要存');
  },
  async (tok, S) => { // 只存 $s0：stack 只長一格
    const r = runProg('jal leaf\nj Done\nleaf: addi $sp, $sp, -4\nsw $s0, 0($sp)\nadd $t0, $a0, $a1\nadd $t1, $a2, $a3\nsub $s0, $t0, $t1\nadd $v0, $s0, $zero\nlw $s0, 0($sp)\naddi $sp, $sp, 4\njr $ra\nDone:', { $a0: 5, $a1: 3, $a2: 4, $a3: 2, $s0: 11 });
    S.m.set(1, '存 $s0'); tint(S.m.cells[1], FC.mint); S.sp.position.y = S.m.y(1);
    mono(pl('addi $sp, $sp, -4　sw $s0, 0($sp)', -2.4, 2.8), 11);
    ok(r.R('$v0') === 2 && r.R('$s0') === 11 && r.R('$sp') === 1000, '✓ 只存 $s0：$v0 = 2，$s0 還原（示意值）', -2.4, 2.1);
    cap('leaf_example 只要存 $s0', 'stack 只長一個單位，最後一樣還原');
  },
  async (tok, S) => { // caller 不能期待 $t 還在
    S.dad.mood('wow');
    cap('相對的，caller 不能期待 $t 維持原狀', '房子交給兒子，冰箱就可能空了');
  },
  async (tok, S) => { // caller 的責任：在乎就放 $s
    S.dad.mood('happy');
    good('caller 的責任：在乎的資料不要放 $t（或自己先存）', 0, 1.2);
    cap('caller 的責任', '在乎的資料就搬到 $s，不在乎才放 $t');
  },
  async (tok, S) => { // callee 的責任：$s 保證恢復
    good('callee 的責任：用到 $s 一定要存、用完還原', 0, 0.5);
    cap('callee 的責任', '$t 可以亂用，$s 保證恢復原狀');
  },
  async (tok, S) => { // 所以 local data 變成這樣
    note('stack 上只放 $s0；結束後恢復', 4.6, 0.6);
    cap('兩邊分工，程式更有效率', 'load / store 搬來搬去也很花時間');
  },
]);

scene('isB-7a-nonleaf', 'Non-leaf procedure：一代叫一代，$ra 要存', CAM, [
  async (tok, S) => { // 祖父叫爸爸，爸爸叫你
    S.b = [['祖父', FC.purple], ['爸爸', FC.blue], ['你', FC.green]].map(([n, c], i) => buddy(n, '', c, -4.8 + i * 2.6, 0.2, 0, 0.85));
    cap('procedure 沒這麼簡單', '祖父叫爸爸、爸爸叫你，可能一代一代往下');
  },
  async (tok, S) => { // non-leaf
    note('leaf：不再叫別人　non-leaf：自己還會叫別人', 0, 6.6);
    cap('non-leaf procedure', '自己還會去叫別的 procedure');
  },
  async (tok, S) => { // 還是只有一個 register file
    S.rf = cube('register file 只有一份', FC.lilac, [3.4, 0.5, 0.6], -2.2, 2.4, 0);
    cap('還是只有一個 register file', '每一代用之前，要把相關資料存起來');
  },
  async (tok, S) => { // top of stack 一層層往下
    S.fr = ['祖父的 frame', '爸爸的 frame', '你的 frame'].map((t, i) => cube(t, [FC.lilac, FC.sky, FC.mint][i], [2.6, 0.55, 0.6], 4.6, 5.6 - i * 0.65, 0));
    S.sp = hot('top', 6.3, 5.6 - 2 * 0.65);
    cap('每叫一代，就在 top of stack 放一塊', '');
  },
  async (tok, S) => { // return 之後 pop
    kill(S.fr[2]); S.sp.position.y = 5.6 - 0.65;
    cap('return 之後，top of stack 就 pop 掉', '回到上一層');
  },
  async (tok, S) => { // nested、recursive 都沒問題
    cap('nested call、recursive call 都可以', '只要好好安排 memory 裡的 stack');
  },
  async (tok, S) => { // 最重要：return address 要回得去
    S.R = regs([['$ra', '回祖父']], -2.2, 4.4, 1.6, { w: 1.8 });
    cap('最重要：return address', '一定要回得去');
  },
  async (tok, S) => { // 爸爸 jal 叫你 → $ra 被蓋掉
    S.R['$ra'].set('回爸爸'); S.R['$ra'].glow(NG); S.b[1].mood('sad');
    S.x = bad('爸爸 jal 叫你時，$ra 被蓋掉 → 爸爸回不了祖父 ✘', -1.6, 3.6);
    cap('爸爸用 jal 叫你，$ra 被新值蓋掉', '爸爸做完就回不了祖父那邊');
  },
  async (tok, S) => { // 先把 $ra 存起來
    remove(S.x); S.R['$ra'].glow(OKG); S.b[1].mood('happy');
    good('叫兒子之前，先把自己的 $ra 存到 stack ✓', -1.6, 3.6);
    cap('所以要叫下一代之前', '先把 return address 存起來');
  },
  async (tok, S) => { // argument、temporary 也一樣
    sm('還有 argument、temporary：該存就要存', -1.6, 3.0);
    cap('argument、temporary 也一樣', '叫完之後再把 stack 恢復原狀');
  },
]);

scene('isB-7a-factc', '遞迴 fact(n)：n 和 $ra 要存起來', CAM, [
  async (tok, S) => { // factorial
    S.c = code(['int fact(int n) {', '  if (n < 1) return 1;', '  else return n * fact(n - 1);', '}'], -2.6, 6.2, 0.6);
    cap('比較難的例子：factorial', '它是一個 recursive call');
  },
  async (tok, S) => { // n < 1 return 1
    S.c.hl(1);
    cap('n < 1 就 return 1', '');
  },
  async (tok, S) => { // 否則 n − 1 再叫自己
    S.c.hl(2);
    cap('否則把 n − 1 當參數', '再叫自己（recursive call）');
  },
  async (tok, S) => { // 回來還要乘 n
    S.k = sm('回來之後，還要乘以 n 才 return', 3.2, 3.6);
    cap('subroutine 回來之後還沒結束', '還要把結果乘以 n');
  },
  async (tok, S) => { // n 放 $a0
    S.R = regs([['$a0 = n', 3]], -4.4, 2.2, 1.6, { w: 1.6 }); sm('（n = 3 示意）', -4.4, 1.4);
    cap('參數 n 放在 $a0', '');
  },
  async (tok, S) => { // 減 1 之後 n 不見了
    await wt(tok, 300); S.R['$a0 = n'].set(2); S.R['$a0 = n'].glow(NG);
    bad('叫 fact(n − 1) 前 $a0 變成 n − 1 → 原本的 n 不見了 ✘', 1.2, 2.2);
    cap('要叫之前，$a0 要先減 1', '回來時要乘的 n 就不見了');
  },
  async (tok, S) => { // 一定要存起來
    good('所以 $a0（n）要先存起來；$ra 也是', 1.2, 1.4);
    cap('所以一定要存起來', '哪些要存、哪些不用存，下一節繼續');
  },
]);

// ════════ CqVPl7fIlAo（黃婷婷 第 7B 講：PC、fact 的 MIPS 程式、activation record、memory layout、convention、byte 指令、strcpy、lui/ori、branch 位址問題） ════════
scene('isB-7b-pc', '補充：PC 與跳躍', CAM, [
  async (tok, S) => { // 補充剛剛的問題
    S.pc = cube('PC', FC.gold, [2.8, 0.6, 0.6], -4.2, 5.8, 0); hd('Program Counter', -4.2, 6.5);
    cap('補充：program counter 是做什麼的？', '怎麼「跳過去」？');
  },
  async (tok, S) => { // jal 要跳去 procedure label
    S.c = mono(hot('jal ProcedureLabel', 1.6, 5.8), 13);
    cap('例如 jal 要跳去 procedure', 'label 代表 subroutine 的位址');
  },
  async (tok, S) => { // 譬如 37685
    S.ad = sm('假設 subroutine 的位址 = 37685（老師隨口舉的數字）', 1.6, 5.1);
    cap('假如 subroutine 的位址是 37685', '要怎麼跳過去？');
  },
  async (tok, S) => { // 把 PC 設成 37685
    relabel(S.pc, 'PC = 37685'); glow(S.pc, HL);
    cap('把 PC 設成 37685 就好', 'PC = 下一個要執行的指令位址');
  },
  async (tok, S) => { // sequential：+4、+4
    glow(S.pc, null);
    S.seq = [0, 1, 2, 3].map((k) => cube(String(1000 + 4 * k), FC.sky, [1.3, 0.5, 0.6], -4.6 + k * 1.6, 3.0, 0));
    sm('依序執行：PC 每次 + 4（位址示意）', -2.2, 2.3);
    for (let k = 0; k < 4; k++) { S.seq.forEach((m, j) => glow(m, j === k ? HL : null)); await wt(tok, 350); }
    cap('不跳的時候：PC 每次加 4', '一個指令 4 bytes，循序執行');
  },
  async (tok, S) => { // 跳：把 target address 放進 PC
    S.seq.forEach((m) => glow(m, null));
    S.a = arrow(V3(-3.0, 3.4, 0), V3(1.6, 4.9, 0), 0xc08a1f);
    good('要跳：把 target address 放進 PC，就從那裡開始執行', 1.0, 1.4);
    cap('要跳：把 target address 放進 PC', 'PC 就會從那邊開始執行');
  },
]);

// ── fact 的 MIPS 程式（課本） ──
const FACT_LINES = ['fact: addi $sp, $sp, -8', '      sw   $ra, 4($sp)', '      sw   $a0, 0($sp)', '      slti $t0, $a0, 1', '      beq  $t0, $zero, L1', '      addi $v0, $zero, 1', '      addi $sp, $sp, 8', '      jr   $ra', 'L1:   addi $a0, $a0, -1', '      jal  fact', '      lw   $a0, 0($sp)', '      lw   $ra, 4($sp)', '      addi $sp, $sp, 8', '      mul  $v0, $a0, $v0', '      jr   $ra'];
const FACT_RUN = runProg(PRESETS.fact.src);
const FACT_OK = FACT_RUN.R('$v0') === 6 && FACT_RUN.R('$sp') === 1000;
const FACT_MINSP = Math.min(...FACT_RUN.trace.map((t) => t.sp));
function factPanel(S) {
  S.cd = code(FACT_LINES, -3.4, 6.7, 0.44);
  S.m = memCol(4.4, 5.8, [1000, 996, 992, 988], ['caller 的資料', '', '', ''], { w: 2.4 });
  hd('stack', 4.4, 6.5); S.sp = hot('← $sp', 6.3, S.m.y(0));
}
const lines = (S, a, b) => S.cd.ls.forEach((l, k) => setCls(l, k >= a && k <= b ? 'ptr alt' : ''));
scene('isB-7b-factsave', 'fact：呼叫前要存 $ra 和 $a0', CAM, [
  async (tok, S) => { // non-leaf 的例子
    factPanel(S); S.cd.ls.forEach((l) => { l.element.style.opacity = '0.35'; });
    sm('int fact(int n) { if (n < 1) return 1; else return n * fact(n − 1); }', 0, 7.35);
    cap('non-leaf procedure 的例子：fact', '一直往下叫自己（recursive）');
  },
  async (tok, S) => { // argument 一直在改變，待會又要用
    S.R = regs([['$a0 = n', 'n'], ['$ra', '回去']], 3.6, 1.4, 1.8, { w: 1.4 });
    cap('argument 一直在改變', '可是待會又要用到 → 要存起來');
  },
  async (tok, S) => { // $v0 需不需要存？不用
    Object.assign(S.R, regs([['$v0', '']], 3.6, 0.0, 1.8, { w: 1.4 }));
    S.v = bad('$v0：現在用不到 → 不用存', 4.6, -0.7);
    cap('$v0 需不需要存？', '兒子等一下會用它回傳，但你現在不用 → 不必存');
  },
  async (tok, S) => { // 爸爸要存 n
    remove(S.v); S.R['$a0 = n'].glow(HL);
    cap('你是爸爸：要存的是 argument n', '交出 control 前先存，回來還要用');
  },
  async (tok, S) => { // 還要存 return address
    S.R['$ra'].glow(HL);
    cap('還要回到祖父那邊', '所以 return address 也要存');
  },
  async (tok, S) => { // addi $sp, $sp, -8
    S.R['$a0 = n'].glow(null); S.R['$ra'].glow(null);
    S.cd.ls.forEach((l) => { l.element.style.opacity = ''; }); lines(S, 0, 0);
    S.sp.position.y = S.m.y(2);
    cap('存兩個：一個 4 bytes', 'addi $sp, $sp, -8');
  },
  async (tok, S) => { // sw $ra, 4($sp)；sw $a0, 0($sp)
    lines(S, 1, 2); S.m.set(1, '$ra'); S.m.set(2, '$a0（n）'); tint(S.m.cells[1], FC.mint); tint(S.m.cells[2], FC.mint);
    cap('sw $ra, 4($sp)；sw $a0, 0($sp)', '叫 procedure 之前要做的事');
  },
]);
scene('isB-7b-factbase', 'fact：測 n < 1，base case 回傳 1', CAM, [
  async (tok, S) => { // test n < 1
    factPanel(S); S.m.set(1, '$ra'); S.m.set(2, '$a0（n）'); S.sp.position.y = S.m.y(2); lines(S, 3, 4);
    cap('開始做事：測試 n < 1', '');
  },
  async (tok, S) => { // slti + beq
    lines(S, 3, 3);
    cap('小於要用 set on less than', 'slti $t0, $a0, 1（n 在 $a0）');
  },
  async (tok, S) => { // n < 1 → $t0 = 1
    S.k = sm('n < 1 → $t0 = 1（set）；否則 $t0 = 0', 0.6, 0.0);
    cap('n 真的小於 1', '$t0 就是 1（set）');
  },
  async (tok, S) => { // beq $t0, $zero, L1：不滿足就去 L1
    lines(S, 4, 4); S.a = arrow(V3(-0.2, 6.7 - 4 * 0.44, 0), V3(-0.2, 6.7 - 8 * 0.44, 0), 0xd64545);
    cap('beq $t0, $zero, L1', '$t0 = 0（n ≥ 1，不滿足）→ 跳 L1 做遞迴');
  },
  async (tok, S) => { // base case：$v0 = 1
    kill(S.a); lines(S, 5, 5);
    cap('n < 1：要 return 1', '回傳值放 $v0：addi $v0, $zero, 1');
  },
  async (tok, S) => { // 恢復 stack pointer
    lines(S, 6, 6); S.sp.position.y = S.m.y(0);
    cap('回去前把 stack 恢復', 'addi $sp, $sp, 8');
  },
  async (tok, S) => { // jr $ra
    lines(S, 7, 7);
    cap('jr $ra 跳回去', '這是 termination condition（終止條件）');
  },
]);
scene('isB-7b-factrec', 'fact：L1 遞迴、還原、相乘', CAM, [
  async (tok, S) => { // else：叫 recursive call
    factPanel(S); S.m.set(1, '$ra'); S.m.set(2, '$a0（n）'); S.sp.position.y = S.m.y(2); lines(S, 8, 14);
    cap('否則（n ≥ 1）：跳到 L1', '做 recursive call');
  },
  async (tok, S) => { // 叫完還沒結束：還要乘 n、再 return
    S.k = ['① n − 1', '② 叫 fact', '③ × n', '④ return'].map((t, i) => small(note(t, 1.8 + i * 1.5, 0.2), 11));
    cap('else 不只是叫 subroutine', '回來還要乘以 n，再 return');
  },
  async (tok, S) => { // 先把 argument 減 1
    S.k.forEach((l, i) => setCls(l, i === 0 ? 'ptr alt' : 'note'));
    cap('先把 argument 減 1', '');
  },
  async (tok, S) => { // addi $a0, $a0, -1
    lines(S, 8, 8);
    cap('addi $a0, $a0, -1', '$a0 變成新的參數 n − 1');
  },
  async (tok, S) => { // jal fact
    lines(S, 9, 9); S.k.forEach((l, i) => setCls(l, i === 1 ? 'ptr alt' : 'note'));
    cap('jal fact：叫自己', '');
  },
  async (tok, S) => { // 回來：做下一個指令
    lines(S, 10, 10);
    cap('回來之後執行 next instruction', '回傳值已經在 $v0');
  },
  async (tok, S) => { // a0 被改變了 → 拿回來
    S.m.cells[2].material.emissive.set(HL);
    cap('$a0 已經被改變了', 'lw $a0, 0($sp)：從 stack 拿回 n');
  },
  async (tok, S) => { // lw $ra
    glow(S.m.cells[2], null); lines(S, 11, 11); glow(S.m.cells[1], HL);
    cap('lw $ra, 4($sp)', '$ra 也被 jal 改掉了，拿回來');
  },
  async (tok, S) => { // addi $sp, $sp, 8
    glow(S.m.cells[1], null); lines(S, 12, 12); S.sp.position.y = S.m.y(0);
    cap('stack pointer 也恢復原狀', 'addi $sp, $sp, 8');
  },
  async (tok, S) => { // mul $v0, $a0, $v0
    lines(S, 13, 13); S.k.forEach((l, i) => setCls(l, i === 2 ? 'ptr alt' : 'note'));
    cap('n × fact(n − 1)', 'mul $v0, $a0, $v0，結果放 $v0');
  },
  async (tok, S) => { // jr $ra
    lines(S, 14, 14); S.k.forEach((l, i) => setCls(l, i === 3 ? 'ptr alt' : 'note'));
    cap('jr $ra：回去', '');
  },
  async (tok, S) => { // if 與 else 的差別
    lines(S, 5, 7);
    S.d = sm('if（base case）：只恢復 $sp　｜　else：還要恢復 $a0、$ra', 0, -0.6);
    cap('if 那邊沒動到 $a0、$ra，只恢復 $sp', 'else 叫過 procedure，$a0、$ra 都要拿回來');
  },
  async (tok, S) => { // 驗算 fact(3)
    lines(S, -1, -1);
    ok(FACT_OK, '✓ 用模擬器跑 fact(3)：$v0 = ' + FACT_RUN.R('$v0') + '，$sp 回到 1000', 0, -1.2);
    sm('最深時 $sp = ' + FACT_MINSP + '（4 層 × 8 bytes）', 4.4, 2.8);
    cap('multiply 之後 jump register', '用 n = 3 驗算（示意）：3 × 2 × 1 = 6');
  },
]);

scene('isB-7b-frame', 'procedure frame：stack 上要放什麼', CAM, [
  async (tok, S) => { // 叫 procedure 之前
    S.m = memCol(1.6, 6.0, ['高位址', '', '', '', '', '', '低位址'], ['caller 的 frame', '', '', '', '', '', ''], { w: 3.4 });
    S.fp = hot('← $fp', 4.3, S.m.y(1) + 0.18); S.sp = hot('← $sp', 4.3, S.m.y(1) - 0.18);
    cap('叫 procedure 之前：stack 長這樣', '');
  },
  async (tok, S) => { // 存 argument、return address、saved register
    [['saved argument registers', 1], ['saved return address', 2], ['saved saved registers（$s）', 3]].forEach(([t, k]) => { S.m.set(k, t); tint(S.m.cells[k], FC.mint); });
    S.sp.position.y = S.m.y(3) - 0.18;
    cap('要存：要用的 argument、return address', '還有會用到的 $s register');
  },
  async (tok, S) => { // local array、structure
    [4, 5].forEach((k) => { S.m.set(k, 'local arrays & structures'); tint(S.m.cells[k], FC.peach); }); S.sp.position.y = S.m.y(5) - 0.18;
    cap('還有 local 的 array、structure', '由 callee 在這裡配置');
  },
  async (tok, S) => { // 用完就 pop 掉
    await wt(tok, 300); [1, 2, 3, 4, 5].forEach((k) => { tint(S.m.cells[k], FC.paper); S.m.set(k, ' '); }); S.sp.position.y = S.m.y(1) - 0.18;
    await wt(tok, 300);
    [['saved argument registers', 1], ['saved return address', 2], ['saved saved registers（$s）', 3]].forEach(([t, k]) => { S.m.set(k, t); tint(S.m.cells[k], FC.mint); });
    [4, 5].forEach((k) => { S.m.set(k, 'local arrays & structures'); tint(S.m.cells[k], FC.peach); }); S.sp.position.y = S.m.y(5) - 0.18;
    sm('回到爸爸那邊時，這一整塊 pop 掉', 4.8, 2.0);
    cap('用完回到 caller', '這一整塊就 pop 掉');
  },
  async (tok, S) => { // activation record
    S.br = note('activation record（procedure frame）', 1.6, 7.0);
    cap('這一整塊叫什麼？', 'activation record（也叫 procedure frame）');
  },
]);
scene('isB-7b-frame2', 'activation record：create 與 pop', CAM, [
  async (tok, S) => { // 每次 create procedure 就在 top 建一個
    S.m = memCol(1.6, 6.0, ['', '', '', '', ''], ['caller 的 activation record', '', '', '', ''], { w: 3.6 });
    S.sp = hot('← $sp', 4.6, S.m.y(0));
    await wt(tok, 200);
    [1, 2, 3].forEach((k) => { S.m.set(k, ['arguments', 'return address', 'local variables'][k - 1]); tint(S.m.cells[k], FC.mint); });
    S.sp.position.y = S.m.y(3); S.n = note('新的 activation record', 5.2, S.m.y(2));
    cap('每次呼叫 procedure', '在 top of stack 建一個 activation record');
  },
  async (tok, S) => { // 做完就 pop
    [1, 2, 3].forEach((k) => { S.m.set(k, ' '); tint(S.m.cells[k], FC.paper); }); S.sp.position.y = S.m.y(0); remove(S.n);
    good('做完：pop，從 stack 上刪掉', 5.0, S.m.y(2));
    cap('做完就 pop', '把它從 stack 上刪掉');
  },
]);

const LAYOUT = [['Reserved', FC.gray, 0.5, '0'], ['Text（程式碼）', FC.sky, 0.8, '0040 0000hex'], ['Static data', FC.lilac, 0.8, '1000 0000hex'], ['Dynamic data（heap）↑', FC.peach, 1.1, ''], ['（空）', '#f3efe7', 1.0, ''], ['Stack ↓', FC.mint, 1.1, '7fff fffchex']];
scene('isB-7b-layout', 'Memory layout：text、static、heap、stack', [[0, 3.4, 13.5], [0, 3.2, 0]], [
  async (tok, S) => { // 整個 memory：一維，從 0 往上
    let y = 0.3; S.z = LAYOUT.map(([t, c, h, a]) => { const m = cube(' ', c, [4.4, h - 0.06, 0.8], -1.0, y + h / 2, 0); m.visible = false; const r = { m, y: y + h / 2, t, a }; y += h; return r; });
    hd('Memory（位址 0 → 往上變大）', -1.0, 6.2); sm('0', -3.6, 0.3);
    cap('整個 memory 是一維的', '從位址 0 一直往上');
  },
  async (tok, S) => { // reserved
    const z = S.z[0]; z.m.visible = true; relabel(z.m, z.t);
    cap('最底下一塊保留給特別用途', 'reserved');
  },
  async (tok, S) => { // text
    const z = S.z[1]; z.m.visible = true; relabel(z.m, z.t); small(sm('PC → 0040 0000hex（課本）', 3.4, z.y), 10);
    cap('text：放你的程式（指令）', '');
  },
  async (tok, S) => { // static data
    const z = S.z[2]; z.m.visible = true; relabel(z.m, z.t); small(sm('$gp → 1000 8000hex（課本）', 3.4, z.y), 10);
    cap('static data：一直都在的資料', '例如 global 變數');
  },
  async (tok, S) => { // stack 從高往低長
    const z = S.z[5]; z.m.visible = true; relabel(z.m, z.t); small(sm('$sp → 7fff fffchex（課本）', 3.4, z.y + 0.4), 10);
    S.a = arrow(V3(1.6, z.y + 0.3, 0.5), V3(1.6, z.y - 0.9, 0.5), 0x2fc092);
    cap('stack 從最上面（高位址）往下長', '所以 push 時 $sp 要「減」');
  },
  async (tok, S) => { // 另一邊放 dynamic data
    const z = S.z[3]; z.m.visible = true; relabel(z.m, z.t); S.z[4].m.visible = true;
    S.b = arrow(V3(1.6, z.y - 0.3, 0.5), V3(1.6, z.y + 0.9, 0.5), 0xdd8238);
    cap('另一邊放 dynamic data（heap）', '從下往上長，兩邊往中間靠');
  },
  async (tok, S) => { // new / malloc
    small(sm('Java 的 new、C 的 malloc：一邊執行一邊配置', 3.4, S.z[3].y), 10);
    cap('dynamic data：執行時才決定要不要', '像 new、malloc、pointer 指的資料');
  },
  async (tok, S) => { // load/store 一樣用 base + offset
    good('不管在哪一區：lw / sw 都是 base + offset', -1.0, 7.0);
    cap('load / store 的方法不變', '給 base address 和 offset 就拿得到');
  },
]);

scene('isB-7b-conv', 'Procedure convention：caller 與 callee 的約定', CAM, [
  async (tok, S) => { // 再整理一次 convention
    hot('Register convention（約定）', 0, 6.6);
    cap('把剛才的規則整理一下', 'procedure convention');
  },
  async (tok, S) => { // 其實可以不遵守
    S.x = sm('硬體不管：$s、$t 亂用也能跑……', 0, 6.0);
    cap('其實不遵守也可以', '只要自己記得；但很容易寫錯');
  },
  async (tok, S) => { // 不同人寫 caller、callee
    S.dad = buddy('caller', 'A 寫的', FC.blue, -4.4, 0.2, 0, 0.9); S.son = buddy('callee', 'B 寫的', FC.green, 4.4, 0.2, 0, 0.9);
    S.dad.mood('wow'); S.son.mood('wow');
    cap('caller 和 callee 可能是不同人寫的', '各用各的就會搞亂');
  },
  async (tok, S) => { // caller：jal；callee：被叫
    S.dad.mood('calm'); S.son.mood('calm');
    sm('making the call（jal）', -4.4, 2.0); sm('被 call 的 function', 4.4, 2.0);
    cap('caller：發出 call（jal）的人', 'callee：被 call 的 function');
  },
  async (tok, S) => { // 兩者有 contract
    S.ct = note('contract：哪些可以動、哪些不能動', 0, 2.6);
    cap('兩者之間有一個 contract', '就像你和爸爸事先講好');
  },
  async (tok, S) => { // callee 可以自由用 V、A、T
    S.c1 = ['$v', '$a', '$t'].map((t, i) => cube(t, FC.orange, [0.9, 0.5, 0.6], 2.6 + i * 1.0, 5.0, 0)); hd('callee 可自由使用', 3.6, 5.6);
    cap('callee 的權利', '$v、$a、$t（和 $ra）可以隨便用');
  },
  async (tok, S) => { // caller 要把 return address 弄好
    S.c2 = [cube('$ra', FC.gold, [0.9, 0.5, 0.6], -4.4, 5.0, 0)]; hd('caller 自己要存', -3.4, 5.6);
    cap('所以 caller 要自己顧好 return address', '');
  },
  async (tok, S) => { // A0–A3 要用就自己存
    S.c2.push(cube('$a', FC.purple, [0.9, 0.5, 0.6], -3.4, 5.0, 0), cube('$v', FC.blue, [0.9, 0.5, 0.6], -2.4, 5.0, 0));
    cap('$a、$v 之後還要用：caller 自己存', 'callee 不會幫你恢復');
  },
  async (tok, S) => { // T 也是
    S.c2.push(cube('$t', FC.orange, [0.9, 0.5, 0.6], -1.4, 5.0, 0));
    sm('存到 stack', -2.9, 4.4);
    cap('$t 也一樣', '要保持原狀，caller 自己存到 stack');
  },
  async (tok, S) => { // caller 的權利：$s 不能被亂動
    S.c3 = cube('$s', FC.green, [0.9, 0.5, 0.6], 0, 3.6, 0); hd('callee 必須保持原狀', 0, 4.2);
    cap('caller 的權利：$s 不能亂動', '回來時要恢復原狀');
  },
  async (tok, S) => { // callee 只要負責 $s
    S.son.mood('happy');
    good('callee 用到 $s：先存、用完還原', 0, 1.2);
    cap('callee 只要負責 $s', '用到就存起來，回去前還原');
  },
]);

scene('isB-7b-steps', '整理：caller 和 callee 各做哪些事', CAM, [
  async (tok, S) => { // caller 要做什麼
    hd('Caller', -3.4, 6.6); hd('Callee', 3.4, 6.6);
    cap('再整理一次', 'caller 呼叫前要做什麼？');
  },
  async (tok, S) => { // sp decrement、存 v a t ra
    S.a1 = sm('① $sp 往下，存 $v、$a、$t、$ra（要用的話）', -3.4, 5.8);
    cap('先把 $sp 往下挪', '把要保留的 $v、$a、$t、$ra 存進 stack（$s 不用）');
  },
  async (tok, S) => { // 放參數、jal
    sm('② 參數放 $a0–$a3，jal 跳過去', -3.4, 5.2);
    cap('把參數放好，jal 跳過去', '');
  },
  async (tok, S) => { // 回來：結果在 $v0、$v1
    sm('③ 回來：從 $v0、$v1 拿結果', -3.4, 4.6);
    cap('回來後從 $v0、$v1 拿結果', '');
  },
  async (tok, S) => { // 恢復 stack pointer
    sm('④ 拿回存的值，$sp 恢復', -3.4, 4.0);
    cap('恢復存的值和 $sp', 'caller 要存的是 $v、$a、$t、$ra');
  },
  async (tok, S) => { // callee：先存 $s
    sm('① 要用 $s：先存到 stack', 3.4, 5.8);
    cap('callee：$s 不能亂弄', '要用就先存起來；然後用參數做運算');
  },
  async (tok, S) => { // 結果放 $v0、$v1
    sm('② 運算，結果放 $v0、$v1', 3.4, 5.2);
    cap('做完把結果放 $v0、$v1', '');
  },
  async (tok, S) => { // 恢復 $sp、jr
    sm('③ 還原 $s、$sp，jr $ra', 3.4, 4.6);
    good('分工清楚 → 不同人寫的程式也能合作', 0, 2.6);
    cap('回去前恢復 stack pointer', '然後 jr $ra 跳回去');
  },
]);

const chA = 'A'.charCodeAt(0);
scene('isB-7b-ascii', '字元資料：ASCII、Latin-1、Unicode', CAM, [
  async (tok, S) => { // 跟人溝通
    cap('電腦怎麼跟人溝通？', '我們常用 A、B、C 這些 symbol');
  },
  async (tok, S) => { // character data
    S.c = ['A', 'B', 'C', '?', '中'].map((t, i) => cube(t, FC.paper, [0.8, 0.8, 0.6], -3.2 + i * 1.6, 5.4, 0));
    cap('character data', '各種 symbol');
  },
  async (tok, S) => { // 還是 0101
    S.b = bitRow(-1.6, 3.8, chA.toString(2).padStart(8, '0'), { w: 0.42 });
    sm("'A' 也只是一串 0101", -2.2, 3.2);
    cap('它們在電腦裡還是 0101', '看你怎麼解釋');
  },
  async (tok, S) => { // ASCII：byte encoded
    ok(chA === 65 && chA.toString(2).padStart(8, '0') === '01000001', "✓ ASCII：'A' = 65 = 0100 0001（一個 byte）", 0, 2.4);
    cap('ASCII：一個 byte（8 bits）表示一個字元', '');
  },
  async (tok, S) => { // 128 / 256
    sm('ASCII：128 個字元；Latin-1：256 個字元（都是 1 byte）', 0, 1.7);
    cap('ASCII 有 128 個字元', 'Latin-1 有 256 個');
  },
  async (tok, S) => { // Unicode
    sm("Unicode：32-bit character set，全世界的文字（例：'中' = U+" + '中'.codePointAt(0).toString(16).toUpperCase() + '）', 0, 1.0);
    cap('Unicode：32-bit 的 character set', '幾乎全世界的文字（包括中文）都在裡面');
  },
  async (tok, S) => { // 規定好
    note('規定好哪個 pattern 叫 A、哪個叫 B，大家照著用', 0, 0.2);
    cap('就是一個規定（encoding）', '大家照規定解讀就好');
  },
]);

const BYTE = 0xF7;
const LB = (BYTE << 24) >> 24, LBU = BYTE;
scene('isB-7b-lb', 'Byte / halfword：lb、lbu、sb', CAM, [
  async (tok, S) => { // 讀到的 data 可能是 byte
    cap('MIPS 裡：讀到的 data 可能只是一個 byte', '數字是 32 bits，ASCII 字元只要 1 byte');
  },
  async (tok, S) => { // byte、halfword 指令
    S.t = [['lb', 'load byte（signed）'], ['lbu', 'load byte unsigned'], ['lh', 'load halfword'], ['lhu', 'load halfword unsigned'], ['sb', 'store byte'], ['sh', 'store halfword']]
      .map(([a, b], i) => [mono(hot(a, -5.4, 6.4 - i * 0.5), 12), sm(b, -3.2, 6.4 - i * 0.5)]);
    cap('byte、halfword 的指令', 'halfword = 2 bytes');
  },
  async (tok, S) => { // 當 number 還是 character
    sm('signed number？unsigned（或字元）？', 2.6, 6.4);
    cap('又分兩種：當 signed number', '或當 unsigned number／character');
  },
  async (tok, S) => { // register 還是 32 bits
    S.rg = bitRow(-6.0, 2.8, '?'.repeat(32), { off: FC.gray }); hd('$t1（32 bits）', -6.4, 3.35).center.set(0, 0.5);
    cap('register 永遠是 32 bits', 'memory 用 byte address：可拿 1、2、4 個 byte');
  },
  async (tok, S) => { // 搬一個 byte 只有 8 bits
    S.by = cube('1 byte = 8 bits', FC.orange, [2.6, 0.4, 0.5], 3.0, 4.2, 0);
    cap('從 memory 搬一個 byte：只有 8 bits', '放 register 哪裡？');
  },
  async (tok, S) => { // 放最右邊，左邊 24 bits 怎麼辦？
    await slide(tok, S.by, 3.4, 2.8, 0.5, 600); kill(S.by);
    S.rg.set('????????????????????????' + BYTE.toString(2).padStart(8, '0'), FC.orange, FC.gray);
    S.q = bub('左邊 24 bits 怎麼辦？', -2.0, 3.8);
    cap('規定放最右邊', '那左邊剩下的 24 bits 要填什麼？');
  },
  async (tok, S) => { // lb：sign extension
    remove(S.q); S.rg.set(b32(LB), FC.orange, FC.sky); S.rg.cells.slice(0, 24).forEach((m) => glow(m, HL));
    S.k = sm('lb：當 signed number → 左邊填 sign bit（sign extension）', 0, 2.0);
    cap('lb：當 signed number', '左邊 24 bits 做 sign extension');
  },
  async (tok, S) => { // lbu：補 0
    S.rg.set(b32(LBU), FC.orange, FC.sky); txt(S.k, 'lbu：當 unsigned → 左邊 24 bits 全部填 0（zero extension）');
    cap('lbu：當 unsigned number', '左邊 24 bits 全部設成 0');
  },
  async (tok, S) => { // sb：搬最右邊的 byte
    S.rg.cells.forEach((m) => glow(m, null)); S.rg.cells.slice(24).forEach((m) => glow(m, OKG));
    sm('sb：把最右邊那個 byte 存到 memory', 0, 1.4);
    cap('store byte：搬最右邊的那個 byte', '');
  },
  async (tok, S) => { // 例：$t0 指到 F7
    gone(S.t); S.rg.cells.forEach((m) => glow(m, null));
    S.mb = cube('F7', FC.orange, [0.9, 0.5, 0.6], 4.6, 5.4, 0); sm('memory 裡的一個 byte（hex F7 = 1111 0111）', 1.4, 6.1); hot('$t0 →', 3.4, 5.4);
    mono(hot('lb $t1, 0($t0)', -3.4, 5.4), 12);
    cap('例：$t0 是 base register', '指到一個 byte：F7（hex）');
  },
  async (tok, S) => { // lb：前面補 F
    S.rg.set(b32(LB), FC.orange, FC.sky); S.rg.cells.slice(0, 24).forEach((m) => glow(m, HL));
    txt(S.k, 'lb  $t1, 0($t0)  →  $t1 = ' + hex(LB));
    ok(u32(LB) === 0xFFFFFFF7, '✓ F 是 1111，前面全部 sign-extend 成 1', 0, 1.4);
    cap('lb：最前面是 1 → sign extension', '$t1 = 0xFFFFFFF7');
  },
  async (tok, S) => { // lbu：前面補 0
    S.rg.set(b32(LBU), FC.orange, FC.sky);
    txt(S.k, 'lbu $t1, 0($t0)  →  $t1 = ' + hex(LBU));
    ok(LBU === 0xF7, '✓ lbu：前面補 0，$t1 = 0x000000F7', 0, 0.8);
    cap('lbu：一樣讀 F7，前面補 0', '$t1 = 0x000000F7，結果不同');
  },
]);

scene('isB-7b-strcpy1', 'strcpy：call by value 與 call by reference', CAM, [
  async (tok, S) => { // string copy
    S.c = code(['void strcpy(char x[], char y[]) {', '  int i = 0;', "  while ((x[i] = y[i]) != '\\0')", '    i += 1;', '}'], -2.4, 6.4, 0.5);
    cap('例子：string copy', '把字串 y 複製到 x');
  },
  async (tok, S) => { // call by value / reference
    cap('C 有 call by value、call by reference', '兩者不一樣');
  },
  async (tok, S) => { // by value：傳值
    S.v = cube('call by value：傳「值」過去', FC.sky, [4.2, 0.5, 0.6], -3.0, 3.0, 0);
    cap('call by value：傳一個 value 過去', '運算完就結束');
  },
  async (tok, S) => { // by reference：傳地址
    S.r = cube('call by reference：傳「地址」過去', FC.mint, [4.2, 0.5, 0.6], 2.6, 3.0, 0);
    cap('call by reference：傳一個地址過去', '變化都發生在那個地址裡');
  },
  async (tok, S) => { // array 傳的是地址
    S.c.hl(0); glow(S.r, HL);
    cap('C 傳 array：傳的其實是地址', 'x[]、y[] 都是位址');
  },
  async (tok, S) => { // 地址也是 32 bits，一樣放 register
    S.R = regs([['$a0 = x 的位址', '3000'], ['$a1 = y 的位址', '2000']], -2.0, 1.6, 4.0, { w: 2.0 }); sm('（位址示意）', 4.8, 1.6);
    cap('地址也是 32 bits', '一樣放在 register（$a0、$a1）');
  },
  async (tok, S) => { // 用 base register + offset 去拿
    mono(hot('lbu $t2, 0($a1)   # 拿 y[0]', 0, 0.6), 12);
    cap('拿到地址，怎麼取資料？', '當 base register，用 load：base + offset');
  },
  async (tok, S) => { // 不管哪種都放 register
    good('by value：直接用；by reference：當 base register 用', 0, -0.1);
    cap('不管 call by value 或 reference', '參數都放在 register');
  },
]);

// 小模擬器（byte memory）：跑 strcpy 的 MIPS 程式
const STRCPY = ['strcpy: addi $sp, $sp, -4', '        sw   $s0, 0($sp)', '        add  $s0, $zero, $zero', 'L1:     add  $t1, $s0, $a1', '        lbu  $t2, 0($t1)', '        add  $t3, $s0, $a0', '        sb   $t2, 0($t3)', '        beq  $t2, $zero, L2', '        addi $s0, $s0, 1', '        j    L1', 'L2:     lw   $s0, 0($sp)', '        addi $sp, $sp, 4', '        jr   $ra'];
function mx(src, R0, mem) {
  const prog = [], lab = {};
  for (const raw of src) { let s = raw.trim(); const m = s.match(/^(\w+):\s*(.*)$/); if (m) { lab[m[1]] = prog.length; s = m[2]; } const sp = s.indexOf(' '); prog.push({ op: s.slice(0, sp), a: s.slice(sp + 1).split(',').map((x) => x.trim()) }); }
  const R = Array(32).fill(0); for (const [k, v] of Object.entries(R0)) R[rIdx(k)] = v;
  const M = { ...mem }, W = {}; let pc = 0, n = 0;
  const g = (s) => R[rIdx(s)], st = (s, v) => { if (rIdx(s)) R[rIdx(s)] = v | 0; };
  const ad = (s) => { const q = s.match(/^(-?\d+)\((\$\w+)\)$/); return +q[1] + g(q[2]); };
  while (pc < prog.length && n < 500) {
    const { op, a } = prog[pc]; let nx = pc + 1; n++;
    if (op === 'add') st(a[0], g(a[1]) + g(a[2]));
    else if (op === 'addi') st(a[0], g(a[1]) + +a[2]);
    else if (op === 'lbu') st(a[0], M[ad(a[1])] & 255);
    else if (op === 'sb') M[ad(a[1])] = g(a[0]) & 255;
    else if (op === 'sw') W[ad(a[1])] = g(a[0]);
    else if (op === 'lw') st(a[0], W[ad(a[1])] || 0);
    else if (op === 'beq') { if (g(a[0]) === g(a[1])) nx = lab[a[2]]; }
    else if (op === 'j') nx = lab[a[0]];
    else if (op === 'jr') break;
    pc = nx;
  }
  return { R, M, n };
}
const SY = 2000, SX = 3000, YSTR = 'Hi';
const YMEM = {}; [...YSTR, '\0'].forEach((c, i) => { YMEM[SY + i] = c.charCodeAt(0); });
const SC_RUN = mx(STRCPY, { $a0: SX, $a1: SY, $s0: 77, $sp: 1000 }, YMEM);
const SC_OK = [...YSTR, '\0'].every((c, i) => SC_RUN.M[SX + i] === c.charCodeAt(0)) && SC_RUN.R[16] === 77 && SC_RUN.R[29] === 1000;
const shw = (v) => (v === 0 ? "'\\0'" : v == null ? '?' : "'" + String.fromCharCode(v) + "'");
scene('isB-7b-strcpy2', 'strcpy 的 MIPS 程式：一個 byte 一個 byte 搬', CAM, [
  async (tok, S) => { // x、y 的地址在 $a0、$a1
    S.cd = code(STRCPY, -3.8, 6.8, 0.46);
    S.R = regs([['$a0 (x)', SX], ['$a1 (y)', SY], ['$s0 (i)', 77], ['$t1', ''], ['$t2', ''], ['$t3', '']], 0.8, 6.6, 1.15, { w: 1.0 });
    S.y = [0, 1, 2].map((k) => cube(shw(YMEM[SY + k]), FC.mint, [0.9, 0.45, 0.5], 1.2 + k * 1.0, 4.4, 0)); sm('y @' + SY, 0.0, 4.4);
    S.x = [0, 1, 2].map((k) => cube('?', FC.paper, [0.9, 0.45, 0.5], 1.2 + k * 1.0, 3.4, 0)); sm('x @' + SX, 0.0, 3.4);
    small(sm('（"Hi"、位址、$s0 = 77 都是示意）', 5.6, 3.9), 10);
    cap('caller 已經把 x、y 的地址', '放在 $a0、$a1（是地址，不是值）');
  },
  async (tok, S) => { // i 用 $s0
    S.R['$s0 (i)'].glow(HL);
    cap('i 放在 $s0', '$s 是爸爸要保持原狀的');
  },
  async (tok, S) => { // callee 的責任：存 $s0
    S.R['$s0 (i)'].glow(null); S.cd.hl(0); await wt(tok, 500); S.cd.hl(1);
    S.sv = sm('stack：存 $s0 = 77', 4.6, 2.4);
    cap('callee 的責任：先存 $s0', 'addi $sp, $sp, -4；sw $s0, 0($sp)');
  },
  async (tok, S) => { // i = 0
    S.cd.hl(2); S.R['$s0 (i)'].set(0);
    cap('i = 0', 'add $s0, $zero, $zero');
  },
  async (tok, S) => { // y[i] 的地址
    S.cd.hl(3); S.R['$t1'].set(SY);
    cap('算 y[i] 的地址：$a1 + $s0', '放在 $t1（char 一個 byte，不用 ×4）');
  },
  async (tok, S) => { // lbu 到 $t2
    S.cd.hl(4); S.R['$t2'].set(shw(YMEM[SY])); glow(S.y[0], HL);
    cap('lbu $t2, 0($t1)', '把 y[i] 這個 byte 搬進 $t2');
  },
  async (tok, S) => { // x[i] 的地址
    glow(S.y[0], null); S.cd.hl(5); S.R['$t3'].set(SX);
    cap('算 x[i] 的地址：$a0 + $s0', '放在 $t3');
  },
  async (tok, S) => { // sb 回 x[i]
    S.cd.hl(6); relabel(S.x[0], shw(YMEM[SY])); tint(S.x[0], FC.mint); glow(S.x[0], OKG);
    cap('sb $t2, 0($t3)', '把 $t2 存到 x[i]：完成 x[i] = y[i]');
  },
  async (tok, S) => { // 不能 memory 直接搬到 memory
    glow(S.x[0], null);
    S.n = bad('✘ 不能直接 memory → memory；一定經過 register', 2.8, 2.4);
    cap('load-store machine', '不能把 y 直接搬到 x，要先搬進 register');
  },
  async (tok, S) => { // 測是不是 0
    remove(S.n); S.cd.hl(7);
    cap('搬完要測試：是不是 \\0？', 'beq $t2, $zero, L2：是 0 就結束');
  },
  async (tok, S) => { // 繼續 loop：整個跑完
    S.cd.hl(8); await wt(tok, 400); S.cd.hl(9);
    [0, 1, 2].forEach((k) => { relabel(S.x[k], shw(SC_RUN.M[SX + k])); tint(S.x[k], FC.mint); });
    S.R['$t2'].set("'\\0'"); S.R['$s0 (i)'].set(2);
    cap('不是 0：i + 1，j L1 繼續', '一直 copy 到 \\0 為止');
  },
  async (tok, S) => { // 恢復 stack，jr
    S.cd.hl(10); await wt(tok, 300); S.cd.hl(12); S.R['$s0 (i)'].set(SC_RUN.R[16]);
    ok(SC_OK, '✓ 模擬：x = "Hi\\0"，$s0 還原成 77，$sp 回到 1000', 2.4, 1.6);
    cap('跳出去之前：恢復 $s0 和 stack', '再 jr $ra 回 caller');
  },
]);
scene('isB-7b-strcpy3', 'strcpy 的兩個重點', CAM, [
  async (tok, S) => { // argument 可以是 address
    S.R = regs([['$a0', 'value 或 address'], ['$a1', 'value 或 address']], -2.0, 5.0, 4.0, { w: 2.8 });
    cap('重點一：argument 可以是 address', '反正都是 32 bits，放在 $a0 ～ $a3');
  },
  async (tok, S) => { // 當 base register 用
    mono(hot('lbu $t2, 0($t1)　← $t1 由地址算出，當 base register', 0, 3.8), 11);
    cap('如果是地址', '就當 base register 去 reference memory');
  },
  async (tok, S) => { // 沒有 memory → memory
    S.ma = cube('memory A', FC.paper, [1.8, 0.8, 0.6], -4.0, 1.6, 0); S.mb = cube('memory B', FC.paper, [1.8, 0.8, 0.6], 4.0, 1.6, 0);
    S.x = arrow(V3(-3.0, 1.9, 0), V3(3.0, 1.9, 0), 0xd64545); S.xl = bad('✘ 沒有這種指令', 0, 2.4);
    cap('重點二：MIPS 有沒有 memory A → memory B 的指令？', '沒有！');
  },
  async (tok, S) => { // 一定經過 register file
    kill(S.x); remove(S.xl);
    S.rf = cube('register file', FC.lilac, [1.8, 0.8, 0.6], 0, 0.4, 0);
    arrow(V3(-3.0, 1.3, 0), V3(-1.0, 0.6, 0), 0x4b9ee2); arrow(V3(1.0, 0.6, 0), V3(3.0, 1.3, 0), 0x2fc092);
    good('先 load 進 register，再 store 到 B ✓', 0, -0.5);
    cap('一定要先 load 到 register file', '再 store 到 B');
  },
]);

scene('isB-7b-const', '接下來兩件事：大常數、branch 位址', CAM, [
  async (tok, S) => { // 剛才介紹了 procedure、branch
    S.c = ['procedure call', 'beq / bne', 'j'].map((t, i) => cube(t, FC.sky, [2.2, 0.5, 0.6], -3 + i * 3, 6.2, 0));
    cap('剛才介紹了 procedure call、branch', '我們都說 branch 是 I-type');
  },
  async (tok, S) => { // 但 format 到底長怎樣
    S.F = fmtRow(0, 4.8, [['op', 6, 'beq', FCOL0[0]], ['rs', 5, '', FCOL0[1]], ['rt', 5, '', FCOL0[2]], ['immediate', 16, '跳去哪？', FCOL0[4]]]);
    cap('可是我們只寫一個 label', 'instruction format 裡到底放什麼？');
  },
  async (tok, S) => { // immediate 只有 16 bits，大的數怎麼辦
    S.big = sm('immediate 只有 16 bits：放不下很大的數怎麼辦？', 0, 3.2);
    cap('另外：immediate 只有 16 bits', '比這個還大的常數怎麼辦？');
  },
  async (tok, S) => { // 兩件事
    note('① 32-bit constant　② branch / jump 的位址', 0, 2.2);
    cap('接下來介紹兩件事', '大於 16 bits 的常數、跳來跳去的位址');
  },
]);

const LUI_HI = 61, ORI_LO = 2304, BIG = (LUI_HI << 16) | ORI_LO;
scene('isB-7b-lui', '32-bit 常數：lui + ori', CAM, [
  async (tok, S) => { // 32-bit constant
    S.goal = bitRow(-6.0, 5.6, b32(BIG), { on: FC.purple, off: FC.lilac }); hd('想要的常數', -6.4, 6.15).center.set(0, 0.5);
    cap('32-bit constant', '其實 data 不管多大，都是 32 bits');
  },
  async (tok, S) => { // 16 bits 內：直接放指令
    sm('16 bits 放得下 → 直接放在 instruction 裡（addi 等）', 0, 4.9);
    cap('16 bits 放得下', '就直接放在 instruction 裡');
  },
  async (tok, S) => { // load upper immediate
    S.lui = mono(hot('lui：load upper immediate', 0, 4.3), 12);
    cap('很大的話：用 load upper immediate', 'lui');
  },
  async (tok, S) => { // 想把這個大 number 放到 $s0
    S.s0 = bitRow(-6.0, 2.6, '0'.repeat(32), { off: FC.gray }); hd('$s0', -6.4, 3.15).center.set(0, 0.5);
    small(sm('= ' + BIG.toLocaleString('en-US') + ' = ' + hex(BIG), 2.6, 6.15), 10);
    cap('想把這個大常數放進 $s0', '前面 16 bits 也有 1');
  },
  async (tok, S) => { // 拆成兩半
    S.goal.cells.slice(0, 16).forEach((m) => glow(m, HL));
    sm('前半 = ' + LUI_HI, -3.0, 5.0); sm('後半 = ' + ORI_LO, 3.2, 5.0);
    ok(((LUI_HI << 16) | ORI_LO) === BIG, '✓ ' + LUI_HI + ' × 65536 + ' + ORI_LO + ' = ' + BIG.toLocaleString('en-US'), 0, 1.4);
    cap('把它拆成兩半', '前 16 bits = 61，後 16 bits = 2304');
  },
  async (tok, S) => { // lui 還是 I-type
    S.goal.cells.forEach((m) => glow(m, null));
    const v = fv('lui $s0, 61');
    S.F = fmtRow(0, 0.2, [['op', 6, v[0], FCOL0[0]], ['rs', 5, v[1], FCOL0[1]], ['rt', 5, v[2] + '（$s0）', FCOL0[2]], ['immediate', 16, v[3], FCOL0[4]]], { sc: 0.3 });
    S.Fk = ok(v.join(' ') === '15 0 16 61', '✓ lui $s0, 61 欄位 = 15 0 16 61', 0, -0.4);
    cap('lui 還是 I-type', '有 16-bit 常數；只用到一個 register（destination）');
  },
  async (tok, S) => { // lui $s0, 61
    remove(S.lui); S.lui = mono(hot('lui $s0, 61', 0, 4.3), 13);
    cap('lui $s0, 61', 'destination 是 $s0，immediate 是 61');
  },
  async (tok, S) => { // 把 61 搬到 $s0 的上半部
    S.s0.set(b32(LUI_HI << 16), FC.blue, FC.sky); S.s0.cells.slice(0, 16).forEach((m) => glow(m, HL));
    cap('lui 把 61 放到 $s0 的「上半部」', '');
  },
  async (tok, S) => { // 再講一次：拆兩半
    S.s0.cells.forEach((m) => glow(m, null));
    cap('再講一次：一半寫在 lui 裡', '另一半寫在 ori 的 immediate 裡');
  },
  async (tok, S) => { // 後面全部設 0
    S.s0.cells.slice(16).forEach((m) => glow(m, HL));
    cap('lui 把後面 16 bits 全部設成 0', '$s0 = 61 × 65536');
  },
  async (tok, S) => { // ori $s0, $s0, 2304
    S.s0.cells.forEach((m) => glow(m, null)); gone(S.F, S.Fk);
    S.ori = mono(hot('ori $s0, $s0, 2304', 0, 3.7), 13);
    cap('再去 OR 一個 immediate', 'ori $s0, $s0, 2304');
  },
  async (tok, S) => { // 2304 的 bit
    S.im = bitRow(-6.0, 1.8, b32(ORI_LO), { on: FC.green, off: FC.mint }); hd('2304', -6.4, 2.35).center.set(0, 0.5);
    S.im.cells.slice(16).forEach((m) => glow(m, HL));
    cap('2304 只有 16 bits', '前面補 0（ori 是 zero extension）');
  },
  async (tok, S) => { // 結果
    S.s0.set(b32(BIG), FC.purple, FC.lilac);
    ok(enc('lui $s0, 61') >>> 26 === 15 && b32(BIG) === b32((LUI_HI << 16) | ORI_LO), '✓ $s0 = ' + hex(BIG) + ' = 4,000,000', 0, 1.0);
    cap('OR 之後得到最後的結果', '$s0 = 0x003D0900');
  },
  async (tok, S) => { // 32-bit 常數要用 lui
    good('要做 32-bit 常數：lui + ori，不用放 memory', 0, 0.2);
    cap('程式裡一定會用到 lui', '不必先在 memory 準備這個常數');
  },
]);

scene('isB-7b-brq', 'branch 的 16-bit immediate 要怎麼表示 32-bit 位址？', CAM, [
  async (tok, S) => { // branch instruction
    S.c = mono(hot('beq $s1, $s2, L1', 0, 6.4), 13);
    cap('再來：branch instruction', 'beq、bne、j 我們只說過它的 format');
  },
  async (tok, S) => { // op rs rt immediate
    S.F = fmtRow(0, 5.0, [['op', 6, 'op', FCOL0[0]], ['rs', 5, 'rs', FCOL0[1]], ['rt', 5, 'rt', FCOL0[2]], ['immediate', 16, '?', FCOL0[4]]]);
    cap('I-type：op、rs、rt、16-bit immediate', 'rs、rt 拿來比較');
  },
  async (tok, S) => { // 跳去哪裡就放在 immediate
    glow(S.F.cells[3], HL);
    cap('跳去的位址', '就要放在 immediate 這裡');
  },
  async (tok, S) => { // 電腦不懂 L1
    S.q = bub('電腦不懂「L1」，它只看得懂 0101', 0, 3.6);
    cap('電腦怎麼知道 L1 是什麼？', '它要的是一個 0101 的 pattern');
  },
  async (tok, S) => { // 16 bits vs 32 bits
    remove(S.q);
    S.a = cube('memory address：32 bits', FC.red, [7.0, 0.5, 0.6], 0, 2.6, 0); S.b = cube('immediate：16 bits', FC.peach, [3.5, 0.5, 0.6], 0, 1.8, 0);
    cap('immediate 只有 16 bits', '位址卻有 32 bits，怎麼寫得下？下次揭曉');
  },
]);

// ════════ 4FhTREqO4xE（黃婷婷 第 8A 講：R/I-format 複習、PC-relative branch、word offset、J-format 與 pseudodirect、例題、定址模式、translation） ════════
scene('isB-8a-why', '為什麼一直複習 instruction format', CAM, [
  async (tok, S) => { // 上課前再問 format
    S.c = [['R-format', FC.sky], ['I-format', FC.mint], ['J-format', FC.gray]].map(([t, c], i) => cube(t, c, [2.6, 0.6, 0.6], -3.4 + i * 3.4, 5.6, 0));
    cap('每次上課都問 instruction format', '因為後面要設計 computer organization');
  },
  async (tok, S) => { // 煮菜要先知道煮什麼菜
    S.b = bub('不知道要煮什麼菜，怎麼煮？', 0, 4.2); S.k = sm('ISA = 菜單；hardware = 照著菜單做菜', 0, 3.5);
    cap('就像煮菜：要先知道煮什麼菜', 'hardware 要對應這些指令來設計');
  },
  async (tok, S) => { // 教過 R、I；J 還沒教
    good('✓ 教過', -3.4, 6.3); good('✓ 教過', 0, 6.3); sm('還沒教（很簡單）', 3.4, 6.3);
    cap('教過 R-type、I-type', 'J-type 還沒教，它很簡單');
  },
]);
scene('isB-8a-rrev', '複習 R-format', CAM, [
  async (tok, S) => { // op rs rt rd shamt funct
    S.F = fmtRow(0, 5.0, R_SPEC.map((f, i) => [f[0], f[1], f[0], FCOL0[i]]), { nobits: true });
    cap('R-type：op、rs、rt、rd、shamt、funct', '');
  },
  async (tok, S) => { // 6 5 5 5 5 6
    R_SPEC.forEach((f, i) => S.F.set(i, f[1] + ' bits'));
    cap('op 6 bits；rs、rt、rd、shamt 各 5 bits', '剩下 funct 6 bits');
  },
  async (tok, S) => { // 用在加減、logical
    mono(pl('add　sub　and　or　slt　sll …', 0, 3.8), 12);
    cap('主要用在加減、logical operation', '');
  },
  async (tok, S) => { // 三個 register：兩個 source、一個 destination
    [1, 2].forEach((i) => glow(S.F.cells[i], HL)); glow(S.F.cells[3], OKG);
    sm('rs、rt：兩個 source　rd：destination', 0, 3.1);
    cap('load-store：operand 已經在 register', '所以要三個 register：兩個 source、一個 destination');
  },
]);
scene('isB-8a-irev', '複習 I-format：load / store 與 offset', CAM, [
  async (tok, S) => { // I-type 用在哪
    S.R = fmtRow(0, 5.6, R_SPEC.map((f, i) => [f[0], f[1], f[0], FCOL0[i]]), { nobits: true });
    S.I = fmtRow(0, 4.0, I_SPEC.map((f, i) => [f[0], f[1], f[0], FCOL0[i === 3 ? 4 : i]]), { nobits: true });
    cap('I-type 的 format 用在哪種指令？', '');
  },
  async (tok, S) => { // load / store
    S.l = mono(hot('lw $t0, 32($s3)', -3.0, 2.8), 12);
    cap('load / store', '');
  },
  async (tok, S) => { // 跟 R-type 越像越好
    [0, 1, 2].forEach((i) => { glow(S.R.cells[i], HL); glow(S.I.cells[i], HL); });
    cap('format 越一樣越好', 'op、rs、rt 的位置和 R-type 一樣；後面合成 16 bits');
  },
  async (tok, S) => { // offset：base register + offset
    [0, 1, 2].forEach((i) => { glow(S.R.cells[i], null); glow(S.I.cells[i], null); }); glow(S.I.cells[3], HL);
    S.k = sm('位址 = base register（$s3）+ offset（32）', 1.6, 2.8);
    S.R2 = regs([['$s3', 1000]], -3.0, 1.4, 1.5, { w: 1.4 }); sm('（$s3 = 1000 示意）', -3.0, 0.7);
    ok(1000 + 32 === 1032, '✓ 1000 + 32 = 1032：去這個位址存取', 2.0, 1.4);
    cap('16 bits 是 offset', 'base register 加上 offset，才是真正的 memory 位址');
  },
]);
scene('isB-8a-irev2', 'I-format 也用在 beq / bne', CAM, [
  async (tok, S) => { // conditional branch
    S.I = fmtRow(0, 4.6, [['op', 6, 'beq/bne', FCOL0[0]], ['rs', 5, 'rs', FCOL0[1]], ['rt', 5, 'rt', FCOL0[2]], ['immediate', 16, '?', FCOL0[4]]]);
    cap('I-format 還用在 conditional branch', 'beq、bne：等一下講它怎麼描述位置');
  },
]);
const SX16 = -4, PX16 = 5;
scene('isB-8a-irev3', 'immediate operand 與 sign extension', CAM, [
  async (tok, S) => { // immediate：constant 在 instruction 裡
    S.I = fmtRow(0, 5.6, [['op', 6, 'addi', FCOL0[0]], ['rs', 5, 'rs', FCOL0[1]], ['rt', 5, 'rt', FCOL0[2]], ['immediate', 16, 'constant', FCOL0[4]]]);
    cap('I = immediate：operand 就是 constant', '放在 instruction 裡');
  },
  async (tok, S) => { // 16 bits 是 two's complement
    S.a = bitRow(-6.0, 3.6, '0'.repeat(16) + b32(SX16).slice(16), { off: FC.gray }); S.a.cells.slice(0, 16).forEach((m) => { m.visible = false; });
    hd('16-bit immediate = ' + SX16 + '（示意）', -1.8, 4.2);
    cap('16 bits 代表一個 two\'s complement 的數', '可以是正的，也可以是負的');
  },
  async (tok, S) => { // sign extension
    S.a.cells.slice(0, 16).forEach((m) => { m.visible = true; }); S.a.set(b32(SX16), FC.orange, FC.peach); S.a.cells.slice(0, 16).forEach((m) => glow(m, HL));
    ok(u32((SX16 << 16) >> 16) === u32(SX16) && hex(SX16) === '0xFFFFFFFC', '✓ sign extension：' + SX16 + ' → ' + hex(SX16), 0, 2.8);
    cap('可是運算是 32 bits', '16 → 32 bits 要做 sign extension');
  },
  async (tok, S) => { // 正數補 0
    S.b = bitRow(-6.0, 2.0, b32(PX16), { on: FC.green, off: FC.mint }); S.b.cells.slice(0, 16).forEach((m) => glow(m, HL));
    sm('+' + PX16 + '：sign bit 是 0 → 前面補 0', 0, 1.4);
    cap('正數：前面補 0', '負數：前面補 1');
  },
  async (tok, S) => { // 三種都用 I-format
    S.a.cells.forEach((m) => glow(m, null)); S.b.cells.forEach((m) => glow(m, null));
    ['immediate 運算', 'conditional branch', 'load / store'].forEach((t, i) => good(t, -3.4 + i * 3.4, 0.4));
    cap('I-format 用在三種指令', 'immediate、branch（beq/bne）、load/store');
  },
]);

const IM = [992, 996, 1000, 1004, 1008, 1012];
scene('isB-8a-pcrel', 'branch 的目標：PC-relative addressing', CAM, [
  async (tok, S) => { // beq 的 format
    S.F = fmtRow(0, 6.0, [['op', 6, 'beq', FCOL0[0]], ['rs', 5, 'rs', FCOL0[1]], ['rt', 5, 'rt', FCOL0[2]], ['immediate', 16, '?', FCOL0[4]]]);
    cap('branch 也是 op、rs、rt、16-bit immediate', '');
  },
  async (tok, S) => { // rs == rt 就跳
    sm('beq：rs == rt 就跳；bne：rs ≠ rt 就跳', 0, 5.1);
    cap('beq：rs 和 rt 一樣就跳', 'bne：不一樣才跳；看 op code 決定');
  },
  async (tok, S) => { // 之前只寫 label
    S.l = mono(hot('beq $s1, $s2, L1', -3.4, 4.2), 12);
    cap('跳去哪裡？之前只寫一個 label', '那只是 symbolic 的描述');
  },
  async (tok, S) => { // 要給 number / address
    S.q = bub('電腦看不懂 L1，要給它一個 address', 2.4, 4.2);
    cap('電腦看不懂 L1、L2', '要給它一個 number：一個 address');
  },
  async (tok, S) => { // 指令也放在 memory
    remove(S.q);
    S.m = memCol(3.4, 3.6, IM.slice().reverse(), ['', '', '', '', '', ''], { w: 2.4 });
    hd('instruction memory', 3.4, 4.2); sm('（位址示意）', 5.6, 4.2);
    cap('instruction 也放在 memory 裡', '跳去哪裡，就是跳去一個 memory address');
  },
  async (tok, S) => { // 位址 32 bits，immediate 只有 16 bits
    S.k = bad('位址 32 bits，immediate 只有 16 bits', -3.4, 3.2);
    cap('一個位址 32 bits', 'immediate 再怎麼樣也只有 16 bits');
  },
  async (tok, S) => { // PC-relative addressing
    remove(S.k); S.p = good('PC-relative addressing', -3.4, 3.2);
    cap('用 PC-relative addressing', '要跳去的不是絕對位置，而是相對位置');
  },
  async (tok, S) => { // 相對於 PC
    S.pc = cube('PC', FC.gold, [1.2, 0.5, 0.6], -3.4, 2.0, 0);
    cap('相對於誰？相對於 PC', 'PC 是 Program Counter');
  },
  async (tok, S) => { // PC 放現在執行的指令位址
    relabel(S.pc, 'PC = 1000'); S.m.set(3, 'beq …'); glow(S.m.cells[3], HL);
    S.a = arrow(V3(-2.7, 2.0, 0), V3(2.1, S.m.y(3), 0), 0xc08a1f);
    cap('PC 記錄 instruction 執行到哪裡', '就是 memory 的位址');
  },
]);

scene('isB-8a-near', '分支通常很近：16-bit 帶號 word offset', CAM, [
  async (tok, S) => { // immediate 16 bits，PC 32 bits
    S.pc = fmtRow(0, 6.2, [['PC', 32, '32 bits', FC.peach]], { sc: 0.34 }); S.im = fmtRow(0, 5.3, [['immediate', 16, '16 bits', FCOL0[4]]], { sc: 0.34 });
    cap('PC 是 32 bits，immediate 只有 16 bits', '怎麼用 PC 加 immediate 描述目標？');
  },
  async (tok, S) => { // PC 指著 branch 自己
    S.m = memCol(3.8, 4.2, ['1012', '1008', '1004', '1000', '996', '992'], ['', '', '', 'beq …（PC）', '', ''], { w: 2.6 }); glow(S.m.cells[3], HL);
    gone(S.pc, S.im);
    cap('執行 beq 時 PC 指著誰？', '指著 beq 這個指令自己的位置');
  },
  async (tok, S) => { // 只是往上或往下跳幾個
    S.u = arrow(V3(5.4, S.m.y(3), 0), V3(5.4, S.m.y(0), 0), 0x2fc092); S.d = arrow(V3(5.4, S.m.y(3), 0), V3(5.4, S.m.y(5), 0), 0xdd8238);
    cap('寫程式時，branch 通常只是', '往上或往下跳幾個 statement');
  },
  async (tok, S) => { // 1000 → 1000 + 50 或 1000 − 50
    S.k = mono(hot('PC = 1000 → 目標 ≈ 1000 + 50 或 1000 − 50', -2.6, 5.6), 11);
    cap('beq 在 1000，目標可能是 1000 + 50', '或 1000 − 50：一定在附近');
  },
  async (tok, S) => { // immediate 像 offset
    S.f = mono(pl('目標 = PC + offset（immediate）', -2.6, 4.8), 12);
    cap('immediate 就像一個 offset', '加到現在的 PC 上');
  },
  async (tok, S) => { // 帶號 two's complement
    sm('immediate 是 signed（two\'s complement）：可正可負', -2.6, 4.2);
    cap('loop 通常很小', 'immediate 當成帶號整數，往上往下都能跳');
  },
  async (tok, S) => { // 很像 base addressing
    note('很像 lw/sw 的 base + offset：這裡的 base 是 PC', -2.6, 3.4);
    cap('跟 load / store 的 base address 很像', '只不過 base 換成 PC');
  },
  async (tok, S) => { // lw/sw 的 offset 是 byte address
    S.q = sm('lw / sw 的 offset 以 byte 為單位', -2.6, 2.6);
    cap('lw / sw 的 offset 代表 byte address', 'branch 也要用 byte 嗎？');
  },
  async (tok, S) => { // ±2^15
    S.r1 = sm('用 byte：只能 ±2¹⁵ bytes', -2.6, 2.0);
    cap('16 bits 用 byte 算', '只能往上、往下各 2¹⁵ 個 byte');
  },
  async (tok, S) => { // 指令永遠 4 bytes
    cap('指令有沒有 1、2、3 bytes 的？', '沒有，MIPS 指令永遠 4 bytes');
  },
  async (tok, S) => { // 最後兩個 bit 一定是 00
    S.m.cells.forEach((m, i) => relabel(m, (+['1012', '1008', '1004', '1000', '996', '992'][i]).toString(2).slice(-6).replace(/(..)$/, ' $1')));
    ok([992, 996, 1000, 1004, 1008, 1012].every((a) => a % 4 === 0), '✓ 指令位址都是 4 的倍數 → 二進位最後兩個 bit 一定是 00', -2.6, 1.3);
    cap('指令位址都是 0、4、8、12……', '二進位最後兩個 bit 一定是 00');
  },
  async (tok, S) => { // 自動補 00 = ×4
    S.ww = good('immediate 不存那兩個 00：用的時候補 00 = ×4', -2.6, 0.6);
    cap('何必浪費空間存 00？', '用的時候自動補兩個 0，就是乘以 4');
  },
  async (tok, S) => { // word address
    S.m.cells.forEach((m, i) => relabel(m, ['1012', '1008', '1004', '1000', '996', '992'][i]));
    note('branch 的 immediate = word address（以指令為單位）', -2.6, -0.1);
    cap('所以 branch 的 immediate 是 word address', 'lw/sw 是 byte address（可能要存取其中一個 byte）');
  },
  async (tok, S) => { // ±2^17 bytes
    ok(2 ** 15 * 4 === 2 ** 17, '✓ ±2¹⁵ 個 word = ±2¹⁷ bytes：範圍變 4 倍', -2.6, -0.8);
    cap('範圍增加 4 倍', '往上下各 2¹⁷ 個 byte');
  },
]);

scene('isB-8a-pc4', 'PC 已經先加 4：目標 = PC + 4 + offset × 4', CAM, [
  async (tok, S) => { // 正常狀況 PC + 4
    S.m = memCol(3.8, 5.2, ['1012', '1008', '1004', '1000'], ['', '', '下一個', 'beq …'], { w: 2.4 });
    S.pc = cube('PC = 1000', FC.gold, [2.2, 0.5, 0.6], -3.6, 5.2, 0); sm('（位址示意）', -3.6, 4.6);
    cap('正常狀況，PC 每次加 4', '因為每個指令 4 bytes');
  },
  async (tok, S) => { // 加 4 = 下一個指令
    relabel(S.pc, 'PC + 4 = 1004'); glow(S.m.cells[2], HL);
    cap('PC + 4 就是下一個指令', '不跳時就執行下一個');
  },
  async (tok, S) => { // 硬體先把 PC + 4 做了
    glow(S.pc, HL);
    cap('硬體設計：先假設要執行下一個指令', '先做 PC = PC + 4');
  },
  async (tok, S) => { // 同時去比較 rs、rt
    S.cmp = cube('同時：比較 rs、rt', FC.orange, [3.0, 0.5, 0.6], -3.6, 3.8, 0);
    cap('同時去比較 rs、rt', '兩件事一起做，硬體比較快');
  },
  async (tok, S) => { // 再減回來浪費時間
    S.x = bad('發現要跳時再把 PC 減 4 回來？浪費時間 ✘', -1.6, 2.8);
    cap('比較完發現要跳', '再去把 PC 減回來就浪費時間');
  },
  async (tok, S) => { // 從 PC + 4 開始算
    remove(S.x); glow(S.pc, null);
    S.f = good('目標要從 PC + 4（下一個指令）開始算', -1.6, 2.8);
    cap('所以 offset 是從 PC + 4 起算', '');
  },
  async (tok, S) => { // 公式
    S.fm = mono(hot('branch target = (PC + 4) + immediate × 4', -1.0, 1.8), 13);
    sm('immediate 補兩個 0（× 4）再加上去', -1.0, 1.1);
    cap('branch 目標 = (PC + 4) + immediate × 4', '這才是真正要跳去的 byte address');
  },
]);

const BEQ_SRC = ['Loop: beq  $9, $0, End', '      add  $8, $8, $10', '      addi $9, $9, -1', '      j    Loop', 'End:'];
const BEQ_OFF = 4 - (0 + 1);   // End 在第 4 個指令位置，beq 在第 0 個
scene('isB-8a-beqex', '例題：beq $9, $0, End 要填多少？', CAM, [
  async (tok, S) => { // loop 例子
    S.cd = code(BEQ_SRC, -3.2, 6.2, 0.6); S.cd.hl(0);
    cap('例：一個 loop', 'beq 比較 $9 和 $0，一樣就跳到 End');
  },
  async (tok, S) => { // add、addi、j
    S.cd.hl(-1); [1, 2, 3].forEach((k) => setCls(S.cd.ls[k], 'ptr'));
    cap('不一樣就做 add、addi', 'j Loop 一直回去跑');
  },
  async (tok, S) => { // 電腦看不懂 End
    [1, 2, 3].forEach((k) => setCls(S.cd.ls[k], '')); S.cd.hl(0);
    S.q = bub('End 是什麼？電腦看不懂', 2.6, 6.2);
    cap('assembly 寫到這樣就完成了', '但電腦看不懂 symbol「End」，要給 number');
  },
  async (tok, S) => { // beq 是 I-type
    remove(S.q);
    S.F = fmtRow(1.0, 3.0, [['op', 6, '', FCOL0[0]], ['rs', 5, '', FCOL0[1]], ['rt', 5, '', FCOL0[2]], ['immediate', 16, '', FCOL0[4]]], { sc: 0.3 });
    cap('beq 是 I-type', 'op、rs、rt、immediate');
  },
  async (tok, S) => { // op 4、rs 9、rt 0
    S.F.set(0, 4); S.F.set(1, 9); S.F.set(2, 0);
    cap('查表：beq 的 op = 4', 'rs = 9、rt = 0（第 9、第 0 號 register）');
  },
  async (tok, S) => { // immediate 放多少？
    S.F.set(3, '?'); glow(S.F.cells[3], HL);
    cap('immediate 要放多少？', '猜一下');
  },
]);
scene('isB-8a-beqex2', 'immediate = 3：從下一個指令數起', CAM, [
  async (tok, S) => { // PC 在 beq
    S.cd = code(BEQ_SRC, -3.2, 6.2, 0.6); S.cd.hl(0);
    S.F = fmtRow(1.0, 2.6, [['op', 6, 4, FCOL0[0]], ['rs', 5, 9, FCOL0[1]], ['rt', 5, 0, FCOL0[2]], ['immediate', 16, '?', FCOL0[4]]], { sc: 0.3 });
    S.pc = hot('PC →', -6.4, 6.2);
    cap('現在執行的是 beq', 'PC 指在這裡');
  },
  async (tok, S) => { // 從 PC + 4 開始
    S.pc.position.y = 6.2 - 0.6; txt(S.pc, 'PC+4 →');
    cap('可是 PC 已經加 4', '要從下一個指令開始數');
  },
  async (tok, S) => { // 1、2、3
    for (let k = 1; k <= 3; k++) { S.n = sm(String(k), 0.6, 6.2 - k * 0.6); await wt(tok, 350); }
    S.F.set(3, BEQ_OFF); glow(S.F.cells[3], OKG);
    ok(BEQ_OFF === 3, '✓ 從下一個指令數到 End：3 個指令 → immediate = 3', 1.0, 1.4);
    cap('數 1、2、3 到 End', 'immediate 就放 3');
  },
  async (tok, S) => { // 以 word 為單位
    sm('以「指令（word）」為單位，不是 byte：後面的 00 自動補', 1.0, 0.8);
    cap('剛剛說的 × 4 是換算成 byte', '這裡用 word address，所以就是 3');
  },
  async (tok, S) => { // 4 9 0 3
    const v = fv('beq $9, $0, 3');
    ok(v.join(' ') === '4 9 0 ' + BEQ_OFF, '✓ 機器碼欄位：4 9 0 3 = ' + hex(enc('beq $9, $0, 3')), 1.0, 0.2);
    cap('變成 binary：4、9、0、3', '電腦就看得懂了');
  },
  async (tok, S) => { // 換成 byte address
    cap('如果要算真正的 byte address 呢？', 'PC 的值 + 4，再加上 immediate × 4');
  },
  async (tok, S) => { // X + 4 + 3 × 4
    const X = 1000;
    S.f = mono(hot('目標 = X + 4 + 3 × 4 = X + 16', 1.0, 4.4), 13);
    ok(X + 4 + BEQ_OFF * 4 === X + 4 * 4, '✓ 例：X = 1000 → 1016，正好是 End（第 4 個指令）', 1.0, 3.7);
    cap('PC = X 時：目標 = X + 4 + 3 × 4', '× 4 就是補兩個 0，word 變 byte');
  },
  async (tok, S) => { // 直接看程式：從下一個開始數
    note('看程式時：從下一個指令開始數到目標就好', 1.0, -0.6);
    cap('直接看 assembly 就很快', '從下一個指令開始數到要去的位置');
  },
]);

scene('isB-8a-jfmt', 'J-format：只有 j 一種', CAM, [
  async (tok, S) => { // 最後一種 J-format
    hd('J-format', 0, 6.6);
    cap('最後一種 format：J-format', 'J 就是 jump');
  },
  async (tok, S) => { // 只有一種指令
    sm('J-format 只有一種指令（j；另外 jal 也用它）', 0, 6.0);
    cap('它只有一種指令', '不像 I-format 那麼多種');
  },
  async (tok, S) => { // branch 範圍有限
    S.b = cube('beq/bne：只能在 PC 附近跳', FC.peach, [4.4, 0.5, 0.6], -2.6, 4.8, 0);
    cap('beq、bne 跳的範圍很有限', '只在現在 PC 加減一個 offset 之內');
  },
  async (tok, S) => { // 理想：放完整 32-bit 位址
    S.F = fmtRow(0, 3.6, [['address', 32, '完整的 32-bit 位址？', FC.red]], { sc: 0.34 });
    cap('想跳遠：最好直接給 32-bit 位址', '跳到任何一個地方');
  },
  async (tok, S) => { // op 放哪裡？
    S.q = bad('那 op code 放哪裡？沒地方放 ✘', 0, 2.6);
    cap('但指令也只有 32 bits', 'op code 沒地方放；加長所有指令也不行');
  },
  async (tok, S) => { // compromise：op 6 + address 26
    remove(S.q); gone(S.F);
    S.F = fmtRow(0, 3.6, [['op', 6, 'op = 2', FCOL0[0]], ['address', 26, '26 bits', FCOL0[5]]]);
    cap('compromise：op code 還是留著', '後面全部欄位都給你當位址');
  },
  async (tok, S) => { // 26 bits 一定不夠
    ok(32 - 6 === 26, '✓ 32 − 6 = 26 bits', 0, 2.6);
    cap('只剩 26 bits 描述位置', '一定有地方跳不到');
  },
]);
scene('isB-8a-j28', '26 bits 怎麼擴大？', CAM, [
  async (tok, S) => { // 想辦法跳更遠
    S.F = fmtRow(0, 4.6, [['op', 6, 'op', FCOL0[0]], ['address', 26, '26 bits', FCOL0[5]]]);
    cap('有沒有辦法讓 26 bits 跳更遠？', '剛才已經學到一個技巧');
  },
]);
scene('isB-8a-j28b', '補兩個 0：26 → 28 bits', CAM, [
  async (tok, S) => { // 補 00
    S.F = fmtRow(-0.4, 4.6, [['address（26）', 26, '26 bits', FCOL0[5]], ['', 2, '00', FC.green]]);
    cap('補兩個 0！', '指令位址永遠是 0、4、8……最後兩個 bit 是 00');
  },
  async (tok, S) => { // 還差 4 bits
    S.G = fmtRow(0, 3.0, [['?', 4, '?', FC.red], ['26-bit address', 26, '', FCOL0[5]], ['', 2, '00', FC.green]]);
    ok(26 + 2 === 28, '✓ 26 + 2 = 28 bits，還差 4 bits 才 32', 0, 2.0);
    cap('26 bits 當 word address → 變 28 bits', '只差 4 個 bit 就是完整位址');
  },
]);
scene('isB-8a-pcup', '缺的 4 bits 從 PC 來', CAM, [
  async (tok, S) => { // 從 PC 來
    S.G = fmtRow(0, 3.0, [['?', 4, '?', FC.red], ['26-bit address', 26, '', FCOL0[5]], ['', 2, '00', FC.green]]);
    S.pc = fmtRow(0, 5.2, [['PC', 32, 'PC（32 bits）', FC.peach]]);
    cap('缺的 4 bits 從哪裡來？', '從 Program Counter 來');
  },
  async (tok, S) => { // 前面還是後面？
    sm('拿 PC 的哪 4 個 bit？前面？後面？中間？', 0, 4.3);
    cap('從 PC 的哪個位置拿？', '後半部、前半部，還是中間？');
  },
]);
const BLK = (y0, n, h, cols) => Array.from({ length: n }, (_, k) => cube('', cols[k % cols.length], [2.2, h - 0.05, 0.6], -3.6, y0 + k * h + h / 2, 0));
scene('isB-8a-blocks', '拿 PC 最前面的 bit：等於把 memory 切成幾塊', CAM, [
  async (tok, S) => { // 前面補上 = 切塊
    S.mem = cube('memory', FC.paper, [2.2, 5.6, 0.6], -3.6, 3.2, 0); sm('位址 0', -5.2, 0.5); sm('最大位址', -5.2, 5.9);
    cap('從 PC 的「前面」拿', '相當於把整個 memory 切成好幾塊');
  },
  async (tok, S) => { // 2 個 bit → 4 塊
    S.mem.visible = false; S.b4 = BLK(0.4, 4, 1.4, [FC.sky, FC.mint, FC.lilac, FC.peach]);
    cap('前面 2 個 bit', '就把 memory 切成 4 塊');
  },
  async (tok, S) => { // 1 個 bit → 2 塊
    S.b4.forEach((m) => { m.visible = false; }); S.b2 = BLK(0.4, 2, 2.8, [FC.sky, FC.lilac]);
    S.l2 = [small(sm('最前面 bit = 0', -1.4, 1.8), 10), small(sm('最前面 bit = 1', -1.4, 4.6), 10)];
    cap('只看最前面 1 個 bit', '0 一塊、1 一塊：切成 2 塊');
  },
  async (tok, S) => { // 00、01、10、11
    gone(S.b2, S.l2); S.b4.forEach((m) => { m.visible = true; });
    S.l4 = ['00', '01', '10', '11'].map((t, k) => small(sm('前兩個 bit = ' + t, -1.2, 0.4 + k * 1.4 + 0.7), 10));
    cap('前兩個 bit：00 在最下面', '再來 01、10、11，共 4 塊');
  },
  async (tok, S) => { // program 都在同一塊 → OK
    glow(S.b4[1], HL); S.pg = small(note('整個 program 在 01 這塊', 3.0, 2.5), 11);
    cap('整個 program 都落在同一塊', '把 PC 前面的 bit 接上去，就不會錯');
  },
  async (tok, S) => { // 再講一次：位址從後面開始變
    S.ad = mono(pl('0000…0000\n0000…0001\n0000…0010\n   ⋮', 3.0, 5.6), 10);
    cap('再講一次：位址從 000…0 開始往上數', '最後面的 bit 先變，最前面的 bit 很久才變一次');
  },
  async (tok, S) => { // 同一塊裡跳來跳去 OK
    S.j1 = arrow(V3(-2.4, 2.0, 0.4), V3(-2.4, 3.0, 0.4), 0x2fc092);
    S.o1 = good('在 01 這塊裡跳來跳去：前兩個 bit 都是 01 ✓', 3.0, 1.4);
    cap('在同一塊裡跳來跳去', '前面的 bit 都一樣，接上去沒問題');
  },
  async (tok, S) => { // 跨塊就錯
    kill(S.j1); remove(S.o1);
    S.j2 = arrow(V3(-2.4, 1.2, 0.4), V3(-2.4, 4.6, 0.4), 0xd64545);
    S.o2 = bad('從 00 那塊跳到 10 那塊：接上的 bit 錯了 ✘', 3.0, 1.4);
    cap('如果要跨到別塊去', '接上的是現在 PC 的 bit，就錯了');
  },
  async (tok, S) => { // 4 bits → 16 塊 × 256 MB
    kill(S.j2); remove(S.o2); gone(S.l4); glow(S.b4[1], null);
    S.b4.forEach((m) => { m.visible = false; }); S.b16 = BLK(0.4, 16, 0.35, [FC.sky, FC.mint]);
    ok(2 ** 4 === 16 && 2 ** 28 === 256 * 2 ** 20, '✓ 前 4 bits → 16 塊，每塊 2²⁸ bytes = 256 MB', 3.0, 1.4);
    cap('MIPS 拿 PC 最前面 4 個 bit', '切成 16 塊，每塊 256 MB');
  },
  async (tok, S) => { // linker/loader 要小心擺
    note('linker / loader 擺放程式時不要跨過 256 MB 的邊界', 3.0, 0.6);
    cap('程式很少超過 256 MB', 'linker、loader 擺的時候小心不要跨邊界，99% 都對');
  },
]);

scene('isB-8a-jaddr', 'j 的新 PC：PC[31:28] ‖ address ‖ 00', CAM, [
  async (tok, S) => { // New PC 怎麼來
    S.n = fmtRow(0, 3.0, [['PC 前 4 bits', 4, '', FC.peach], ['26-bit address', 26, '', FCOL0[5]], ['00', 2, '', FC.green]]);
    hd('jump 的新 PC（32 bits）', 0, 4.0);
    cap('jump 的新 PC 怎麼來？', '');
  },
  async (tok, S) => { // PC 前四個 bit
    S.n.set(0, 'PC[31:28]'); glow(S.n.cells[0], HL);
    cap('① 拿 PC 最前面 4 個 bit', '');
  },
  async (tok, S) => { // 26 bits
    glow(S.n.cells[0], null); S.n.set(1, '指令裡的 26 bits'); glow(S.n.cells[1], HL);
    cap('② 接上指令後面的 26 bits', '');
  },
  async (tok, S) => { // 補 00
    glow(S.n.cells[1], null); S.n.set(2, '00'); glow(S.n.cells[2], HL);
    cap('③ 最後補兩個 0', '這就是要跳去的地方');
  },
  async (tok, S) => { // concatenation，不是加法
    glow(S.n.cells[2], null);
    S.k = note('‖ 是 concatenation（接起來），不是加法', 0, 1.8);
    cap('注意：不是加法', '是 concatenation：直接把 bit 排在一起');
  },
  async (tok, S) => { // 完整 32-bit：jr
    S.jr = mono(hot('jr $rs：PC = register 裡的完整 32-bit 位址', 0, 6.2), 12);
    cap('真的要跳到任意 32-bit 位址？', '把位址放進 register，再用 jr 跳');
  },
  async (tok, S) => { // 三種跳法
    ['beq/bne：PC-relative（附近）', 'j：pseudodirect（同一個 256 MB 區塊）', 'jr：register（任何地方）'].forEach((t, i) => good(t, -3.6 + i * 3.6, 0.6));
    cap('jump 的幾種方式', 'PC-relative、pseudodirect、register');
  },
]);

const LP_ADDR = [80000, 80004, 80008, 80012, 80016, 80020, 80024];
const LP_TXT = ['Loop: sll  $t1, $s3, 2', '      add  $t1, $t1, $s6', '      lw   $t0, 0($t1)', '      bne  $t0, $s5, Exit', '      addi $s3, $s3, 1', '      j    Loop', 'Exit:'];
const BNE_OFF = (LP_ADDR[6] - (LP_ADDR[3] + 4)) / 4, J_FIELD = LP_ADDR[0] / 4;
const LP_F = ['sll $t1, $s3, 2', 'add $t1, $t1, $s6', 'lw $t0, 0($t1)', 'bne $t0, $s5, ' + BNE_OFF, 'addi $s3, $s3, 1', 'j ' + LP_ADDR[0]].map((s) => fv(s).join('  '));
function loopTable(S, show) {
  S.rows = LP_TXT.map((t, k) => { const y = 6.2 - k * 0.8; small(sm(String(LP_ADDR[k]), -6.2, y), 10); const l = mono(pl(t.padEnd(24), -3.4, y), 11); const f = k < 6 ? mono(sm(show(k) ? LP_F[k] : '', 2.8, y), 11) : null; return { y, l, f }; });
}
scene('isB-8a-loopex', '例題：迴圈在 80000，bne 和 j 的欄位', CAM, [
  async (tok, S) => { // 例子
    loopTable(S, (k) => k !== 3 && k !== 5);
    cap('例：迴圈從位址 80000 開始', '右邊是各欄位的十進位值（課本）');
  },
  async (tok, S) => { // bne 要跳 Exit
    setCls(S.rows[3].l, 'ptr alt'); txt(S.rows[3].f, '5  8  21  ?');
    cap('bne：op 5、rs 8（$t0）、rt 21（$s5）', 'immediate 要放多少？');
  },
  async (tok, S) => { // 要跳三個？
    S.g = bad('從 bne 自己數到 Exit 是 3 個？', 2.8, -0.2);
    cap('直覺：要跳 3 個？', '再想一下 PC 在哪裡');
  },
  async (tok, S) => { // PC 已經 + 4 → 2
    remove(S.g); S.pc = hot('PC + 4', -5.0, S.rows[4].y);
    for (let k = 4; k <= 6; k++) { small(sm(String(k - 4), 1.0, S.rows[k].y), 10); await wt(tok, 250); }
    txt(S.rows[3].f, LP_F[3]);
    ok(BNE_OFF === 2, '✓ immediate = 2（從 PC + 4 = 80016 數到 Exit）', 2.8, -0.2);
    cap('PC 已經加 4，在 80016', '從這裡數：1、2 → Exit，所以是 2');
  },
  async (tok, S) => { // j Loop
    setCls(S.rows[3].l, ''); setCls(S.rows[5].l, 'ptr alt'); txt(S.rows[5].f, '2  ?');
    cap('j Loop：要跳到 Loop', '');
  },
  async (tok, S) => { // Loop 的絕對位址 80000
    setCls(S.rows[0].l, 'ptr');
    cap('Loop 的絕對位址是 80000', '十進位的位址（不要換成 binary 搞亂）');
  },
]);
scene('isB-8a-loopex2', 'j 欄位 = 20000；bne 目標 = 80024', CAM, [
  async (tok, S) => { // 20000
    loopTable(S, () => true); setCls(S.rows[5].l, 'ptr alt');
    ok(J_FIELD === 20000 && fv('j 80000').join(' ') === '2 20000', '✓ j 的 26-bit 欄位 = 20000', 2.8, -0.2);
    cap('j 的欄位放 20000', '');
  },
  async (tok, S) => { // byte address ÷ 4
    S.k = mono(hot('80000 ÷ 4 = 20000（byte → word address）', 0, 7.0), 12);
    cap('80000 是 byte address', '÷ 4 變成 word address 才放進指令');
  },
  async (tok, S) => { // bne 的目標
    setCls(S.rows[5].l, ''); setCls(S.rows[3].l, 'ptr alt');
    txt(S.k, 'bne 目標 = 80012 + 4 + 2 × 4 = ' + (LP_ADDR[3] + 4 + BNE_OFF * 4));
    ok(LP_ADDR[3] + 4 + BNE_OFF * 4 === LP_ADDR[6], '✓ = 80024 = Exit', 2.8, -0.8);
    cap('bne 跳去哪？PC + 4 再加 2 × 4', '80016 + 8 = 80024，正好是 Exit');
  },
  async (tok, S) => { // 前面 4 bits 都是 0
    setCls(S.rows[3].l, '');
    ok((LP_ADDR[0] >>> 28) === (LP_ADDR[5] >>> 28) && (((LP_ADDR[5] + 4) & 0xF0000000) | (J_FIELD << 2)) === LP_ADDR[0], '✓ j：PC 前 4 bits（0000）‖ 20000 ‖ 00 = 80000', 2.8, -1.4);
    cap('j 假設在同一個 segment', '前面 4 bits 都是 0，所以 20000 × 4 = 80000');
  },
]);

scene('isB-8a-far', '要跳很遠：beq 反過來 + j', CAM, [
  async (tok, S) => { // beq L1
    S.a = code(['beq $s0, $s1, L1', '…', 'L1:（很遠很遠）'], -3.6, 6.0, 0.6);
    cap('寫 loop 時用 beq / bne', '假設 L1 在 16 bits 描述得到的範圍內');
  },
  async (tok, S) => { // 很遠怎麼辦
    S.x = bad('L1 超過 ±2¹⁵ 個指令：immediate 放不下 ✘', -3.6, 3.8);
    cap('萬一 L1 很遠怎麼辦？', 'PC-relative 只能跳到附近');
  },
  async (tok, S) => { // 利用 j
    remove(S.x);
    S.b = code(['bne $s0, $s1, L2   # 條件反過來', 'j   L1             # j 可以跳很遠', 'L2: …'], 2.4, 6.0, 0.6);
    S.arw = arrow(V3(-1.6, 5.4, 0), V3(-0.4, 5.4, 0), 0xc08a1f);
    cap('利用 j：它可以跳很遠', 'assembler 把它改寫成 bne + j');
  },
  async (tok, S) => { // 先跳到附近的 j，再跳遠
    S.b.hl(1);
    good('先用 branch 跳到附近，再用 j 跳到很遠的 L1', 0, 3.4);
    cap('先在附近做一個 jump', '再由 jump 跳到很遠的 L1');
  },
]);

scene('isB-8a-modes', 'MIPS 的五種 addressing mode', [[0, 3.4, 13], [0, 3.0, 0]], [
  async (tok, S) => { // addressing mode
    hot('MIPS addressing modes', 0, 6.6);
    cap('複習 addressing mode', 'instruction set design 很重要的特性');
  },
  async (tok, S) => { am.base = 100; am.off = 32; am.pc = 80012; await amPlay('imm', tok, 700, true); },
  async (tok, S) => { await amPlay('reg', tok, 700, true); },
  async (tok, S) => { await amPlay('base', tok, 650, true); },
  async (tok, S) => { await amPlay('pc', tok, 700, true); },
  async (tok, S) => { await amPlay('pseudo', tok, 700, true); },
  async (tok, S) => { // 五種
    lab.clear();
    ['① Immediate：operand 在指令裡', '② Register：operand 在 register', '③ Base：register + offset（lw/sw）', '④ PC-relative：PC + 4 + offset × 4（beq/bne）', '⑤ Pseudodirect：PC 高 4 bits ‖ 26 bits ‖ 00（j）']
      .forEach((t, i) => (i % 2 ? hd : hot)(t, 0, 6.0 - i * 0.9));
    cap('MIPS 就這五種 addressing mode', '');
  },
]);

scene('isB-8a-trans', 'C program 怎麼變成 memory 裡的 0101', CAM, [
  async (tok, S) => { // translate
    S.c = cube('C program', FC.sky, [2.0, 0.6, 0.6], -5.0, 6.0, 0);
    S.m = cube('memory 裡的 0101', FC.paper, [2.4, 0.6, 0.6], 4.6, 0.6, 0);
    cap('C program 怎麼變成 memory 裡的 0101？', '開始執行之前');
  },
  async (tok, S) => { // 很多 system program
    S.q = bub('中間有很多 system program 在幫忙', 0, 3.4);
    cap('其實有很多 system program 在幫忙', '');
  },
  async (tok, S) => { // high-level language → compiler
    remove(S.q);
    S.cp = cube('compiler', FC.orange, [1.8, 0.5, 0.6], -5.0, 4.8, 0); arrow(V3(-5.0, 5.7, 0), V3(-5.0, 5.1, 0));
    S.as = cube('assembly', FC.lilac, [1.8, 0.5, 0.6], -5.0, 3.6, 0); arrow(V3(-5.0, 4.5, 0), V3(-5.0, 3.9, 0));
    cap('寫 high-level language 才有生產力', 'compiler 把它轉成 assembly');
  },
  async (tok, S) => { // assembler → object
    S.asm = cube('assembler', FC.orange, [1.8, 0.5, 0.6], -2.4, 3.6, 0); arrow(V3(-4.0, 3.6, 0), V3(-3.3, 3.6, 0));
    S.ob = cube('object（machine language）', FC.mint, [2.6, 0.5, 0.6], -2.4, 2.4, 0); arrow(V3(-2.4, 3.3, 0), V3(-2.4, 2.7, 0));
    cap('assembler', '把 assembly 變成 object（machine language）');
  },
  async (tok, S) => { // 一對一
    sm('add → op 0、funct 32 …：大致一對一翻譯', -2.4, 1.8);
    cap('assembler 大致是一對一', 'symbol（add、$t0）→ op、register 編號');
  },
  async (tok, S) => { // library routine
    S.lib = cube('library routines', FC.lilac, [2.2, 0.5, 0.6], 1.2, 3.6, 0);
    cap('再加上 library 裡的 routine', '常用的 routine 不用重寫');
  },
  async (tok, S) => { // linker
    S.ln = cube('linker', FC.orange, [1.6, 0.5, 0.6], 1.2, 2.4, 0); arrow(V3(-1.0, 2.4, 0), V3(0.4, 2.4, 0)); arrow(V3(1.2, 3.3, 0), V3(1.2, 2.7, 0));
    S.ex = cube('executable', FC.mint, [1.8, 0.5, 0.6], 1.2, 1.2, 0); arrow(V3(1.2, 2.1, 0), V3(1.2, 1.5, 0));
    cap('linker 把很多 module 連起來', '補上還沒決定的跳躍位址（label）');
  },
  async (tok, S) => { // loader
    S.ld = cube('loader', FC.orange, [1.6, 0.5, 0.6], 3.2, 0.6, 0); arrow(V3(2.1, 1.0, 0), V3(2.5, 0.7, 0)); arrow(V3(4.0, 0.6, 0), V3(3.4, 0.6, 0.3));
    cap('loader 把程式放進 memory', '放好後絕對位址就確定了');
  },
  async (tok, S) => { // virtual memory
    note('有 virtual memory：放哪都能執行；沒有的話要告訴它 base', 0, -0.4);
    cap('有 virtual memory 的系統', '放在哪一塊都能執行（後面再介紹）');
  },
]);
// ════════ H6wkyzXzX6g §17（第 7A 講問答：jal 做哪兩件事） ════════
const JQ_PC = 1000, JQ_T = 2000, JQ_RA = JQ_PC + 4;       // 位址示意（十進位）
scene('isB-7a-jalqa', 'jal 做兩件事：PC + 4 存進 $ra，再跳到 label', CAM, [
  async (tok, S) => { // 1835 jal 做什麼？
    S.cd = code([JQ_PC + '  jal  leaf', JQ_RA + '  add  $s4, $v0, $zero', ' …', JQ_T + '  leaf: add $t0, $a0, $a1'], -1.0, 6.3, 0.55); S.cd.hl(0);
    S.R = regs([['PC', JQ_PC, FC.gold], ['$ra', '?']], -1.6, 3.4, 3.2, { w: 1.6 });
    small(note('位址示意', 5.2, 6.3), 10);
    cap('jump and link 做什麼？', '剛剛講過的');
  },
  async (tok, S) => { // 1855 $ra = PC + 4
    S.R.$ra.set(JQ_RA); S.R.$ra.glow(OKG); S.cd.hl(1);
    sm('① link：下一道指令的位址（PC + 4 = ' + JQ_RA + '）存進 $ra', 0, 2.3);
    cap('把下一個 instruction 的位址', '存到 $ra');
  },
  async (tok, S) => { // 1861 跳到 label
    S.R.PC.set(JQ_T); S.R.PC.glow(HL); S.cd.hl(3);
    sm('② jump：PC 換成 leaf 的位址 ' + JQ_T, 0, 1.6);
    cap('然後跳', '跳到你的 label 去');
  },
  async (tok, S) => { // 1865 一道指令兩件事
    ok(JQ_RA === JQ_PC + 4, '✓ 一道 jal 做兩件事：存回程位址 + 跳過去', 0, 0.8);
    sm('callee 做完用 jr $ra 就回到 ' + JQ_RA, 0, 0.1);
    cap('jal 一道指令做兩件事', '這樣 caller 就完成了');
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
