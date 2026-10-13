// 計算機組織 第3章：CPU 設計（單週期 MIPS datapath、控制訊號、ALU control、單週期 vs 多週期）。
// 本章影片（黃婷婷 14A–17A）目前都沒有逐字稿，場景依 Patterson & Hennessy 第 4 章（單週期）與
// 第 3 版第 5 章（多週期）的圖與例題，名稱標「課本」。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a';
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
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const small = (l, px = 10) => { Object.assign(l.element.style, { fontSize: px + 'px', padding: '0 3px' }); return l; };
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); await W(tok, ms / steps); } }
  function line(pts, color = '#b9ab90') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V3(p[0], p[1], p[2] || 0))), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function bar(color, w, d, x, y, z = 0) { const m = lab.box(color, [w, d, 0.6]); m.position.set(x, y, z); lab.world.add(m); return m; }

  // ───────────────────────── 單週期 datapath（P&H 圖 4.17 的簡化版） ─────────────────────────
  const COMP = {
    PC: ['PC', -6.3, 3.2, 0.6, 1.2, '#c08a1f'],
    IM: ['Instr Mem', -4.7, 3.2, 1.4, 2.2, '#4b9ee2'],
    ADD4: ['Add', -4.7, 6.4, 0.9, 0.8, '#dd8238'],
    CTRL: ['Control', -2.4, 5.8, 1.2, 0.8, '#6e5f49'],
    MUXD: ['M', -2.4, 2.8, 0.35, 0.9, '#8a7a5c'],
    RF: ['Registers', -0.9, 3.4, 1.8, 2.4, '#9b7ef4'],
    SE: ['Sign ext', -0.9, 1.0, 1.0, 0.6, '#31aab0'],
    MUXA: ['M', 0.9, 2.85, 0.35, 0.9, '#8a7a5c'],
    ALU: ['ALU', 2.2, 3.6, 1.0, 1.8, '#dd8238'],
    ALUC: ['ALU ctrl', 2.2, 0.6, 1.0, 0.5, '#6e5f49'],
    DM: ['Data Mem', 4.2, 3.2, 1.6, 2.2, '#2fc092'],
    MUXM: ['M', 5.7, 3.2, 0.35, 0.9, '#8a7a5c'],
    SL2: ['<<2', 1.2, 5.4, 0.8, 0.45, '#31aab0'],
    BADD: ['Add', 2.4, 6.2, 0.9, 0.8, '#dd8238'],
    AND: ['&', 3.7, 5.3, 0.4, 0.4, '#6e5f49'],
    MUXP: ['M', 4.6, 6.7, 0.35, 0.9, '#8a7a5c'],
  };
  const WIRES = {
    pc_im: [[-6.0, 3.2], [-5.4, 3.2]],
    pc_add: [[-6.3, 3.8], [-6.3, 6.6], [-5.15, 6.6]],
    four: [[-5.8, 6.2], [-5.15, 6.2]],
    pc4_b: [[-4.25, 6.4], [1.95, 6.4]],
    pc4_m: [[-3.8, 6.4], [-3.8, 6.95], [4.42, 6.95]],
    ins: [[-4.0, 3.2], [-3.3, 3.2]],
    op: [[-3.3, 3.2], [-3.3, 5.8], [-3.0, 5.8]],
    rs: [[-3.3, 4.2], [-1.8, 4.2]],
    rt: [[-3.3, 3.6], [-1.8, 3.6]],
    rt_m: [[-2.9, 3.6], [-2.9, 3.05], [-2.58, 3.05]],
    rd: [[-3.3, 2.55], [-2.58, 2.55]],
    wr: [[-2.22, 2.8], [-1.8, 2.8]],
    imm: [[-3.3, 3.2], [-3.3, 1.0], [-1.4, 1.0]],
    fn: [[-3.3, 1.0], [-3.3, 0.6], [1.7, 0.6]],
    rd1: [[0.0, 4.1], [1.7, 4.1]],
    rd2: [[0.0, 3.0], [0.4, 3.0], [0.4, 3.1], [0.72, 3.1]],
    rd2_dm: [[0.4, 3.0], [0.4, 2.0], [3.1, 2.0], [3.1, 2.5], [3.4, 2.5]],
    se_m: [[-0.4, 1.0], [0.55, 1.0], [0.55, 2.6], [0.72, 2.6]],
    se_sl: [[0.25, 1.0], [0.25, 5.4], [0.8, 5.4]],
    ma_alu: [[1.08, 2.85], [1.4, 2.85], [1.4, 3.1], [1.7, 3.1]],
    alc: [[2.2, 0.85], [2.2, 2.7]],
    alu_dm: [[2.7, 3.6], [3.0, 3.6], [3.0, 3.8], [3.4, 3.8]],
    alu_m: [[3.0, 3.6], [3.0, 1.5], [5.3, 1.5], [5.3, 2.95], [5.52, 2.95]],
    dm_m: [[5.0, 3.45], [5.52, 3.45]],
    wb: [[5.88, 3.2], [6.4, 3.2], [6.4, 0.2], [-2.0, 0.2], [-2.0, 2.4], [-1.8, 2.4]],
    zero: [[2.7, 4.2], [3.3, 4.2], [3.3, 5.2], [3.5, 5.2]],
    sl_b: [[1.6, 5.4], [1.8, 5.4], [1.8, 6.0], [1.95, 6.0]],
    b_m: [[2.85, 6.2], [3.6, 6.2], [3.6, 6.45], [4.42, 6.45]],
    and_m: [[3.9, 5.3], [4.6, 5.3], [4.6, 6.25]],
    pc_next: [[4.78, 6.7], [5.2, 6.7], [5.2, 7.3], [-6.9, 7.3], [-6.9, 3.2], [-6.6, 3.2]],
  };
  const WCOL = '#b9ab90', WON = '#d68a00';
  // which components / wires each part of the build needs (in build order)
  const BUILD = [
    ['PC', [], 'PC：存下一個要執行的指令位址', 'state element，每個 clock edge 更新'],
    ['IM', ['pc_im'], 'Instruction memory：用 PC 讀出指令', '只讀，不用控制訊號'],
    ['ADD4', ['pc_add', 'four'], 'Adder：PC + 4', '一個指令 4 bytes'],
    ['RF', ['ins', 'rs', 'rt'], 'Register file：讀兩個、寫一個', 'rs、rt 讀；寫入要 RegWrite'],
    ['ALU', ['rd1', 'rd2'], 'ALU：做運算、比較（Zero）', 'R-type 的核心'],
    ['SE', ['imm'], 'Sign-extend：16 bits → 32 bits', 'lw / sw / beq 的立即值'],
    ['DM', ['alu_dm', 'rd2_dm'], 'Data memory：lw 讀、sw 寫', 'MemRead / MemWrite'],
    ['SL2', ['se_sl'], 'Shift left 2：offset × 4', 'beq 目標 = PC + 4 + offset × 4'],
    ['BADD', ['pc4_b', 'sl_b'], 'Branch adder：算分支目標', '和 PC + 4 的 adder 分開'],
    ['MUXD', ['rt_m', 'rd', 'wr'], 'RegDst mux：寫 rt 還是 rd', 'lw 寫 rt、R-type 寫 rd'],
    ['MUXA', ['se_m', 'ma_alu'], 'ALUSrc mux：第二運算元', '暫存器還是 sign-extended 立即值'],
    ['MUXM', ['alu_m', 'dm_m', 'wb'], 'MemtoReg mux：寫回什麼', 'ALU 結果還是記憶體資料'],
    ['AND', ['zero'], 'Branch AND Zero', '兩個都成立才分支'],
    ['MUXP', ['pc4_m', 'b_m', 'and_m', 'pc_next'], 'PCSrc mux：下一個 PC', 'PC + 4 或分支目標'],
    ['ALUC', ['fn', 'alc'], 'ALU control：ALUOp + funct', '決定 ALU 做哪種運算'],
    ['CTRL', ['op'], 'Control：看 opcode 產生訊號', '整組控制訊號一次給'],
  ];
  const SIG = ['RegDst', 'ALUSrc', 'MemtoReg', 'RegWrite', 'MemRead', 'MemWrite', 'Branch', 'ALUOp1', 'ALUOp0'];
  const CT = {
    R: [1, 0, 0, 1, 0, 0, 0, 1, 0],
    lw: [0, 1, 1, 1, 1, 0, 0, 0, 0],
    sw: ['X', 1, 'X', 0, 0, 1, 0, 0, 0],
    beq: ['X', 0, 'X', 0, 0, 0, 1, 0, 1],
  };
  const SIGPOS = { RegDst: [-2.4, 2.05], ALUSrc: [0.9, 2.1], MemtoReg: [5.7, 4.0], RegWrite: [-0.9, 4.95], MemRead: [4.9, 1.85], MemWrite: [4.2, 4.6], Branch: [3.7, 4.75], ALUOp: [3.6, 0.6] };
  function buildDP(upto = 99, showSig = true) {
    const D = { c: {}, w: {}, sig: {} };
    const keys = BUILD.slice(0, upto).map((b) => b[0]);
    const wires = new Set(BUILD.slice(0, upto).flatMap((b) => b[1]));
    for (const [k, [name, x, y, w, h, col]] of Object.entries(COMP)) {
      if (!keys.includes(k)) continue;
      const m = cube(name, col, [w, h, 0.5], x, y, 0);
      if (w < 0.5) small(m.userData.lbl, 9); else if (w < 1.1) small(m.userData.lbl, 10);
      D.c[k] = m;
    }
    for (const [k, pts] of Object.entries(WIRES)) if (wires.has(k)) D.w[k] = line(pts, WCOL);
    if (wires.has('four')) small(tag('4', 'idx', -6.0, 6.2), 10);
    if (showSig && upto >= BUILD.length) for (const [s, [x, y]] of Object.entries(SIGPOS)) D.sig[s] = small(tag(s + ' = ?', 'idx', x, y), 9);
    D.fields = {};
    return D;
  }
  function wiresOff(D) { for (const l of Object.values(D.w)) l.material.color.set(WCOL); for (const m of Object.values(D.c)) glow(m, null); }
  function setSignals(D, kind) {
    const v = CT[kind];
    SIG.slice(0, 7).forEach((s, i) => { const l = D.sig[s]; if (!l) return; txt(l, s + ' = ' + v[i]); l.element.className = 'lab-label ' + (v[i] === 1 ? 'ptr alt' : 'idx'); small(l, 9); });
    if (D.sig.ALUOp) { txt(D.sig.ALUOp, 'ALUOp = ' + v[7] + v[8]); D.sig.ALUOp.element.className = 'lab-label ptr'; small(D.sig.ALUOp, 9); }
  }
  function polyAt(pts, f) {
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
    let t = f * L;
    for (let i = 0; i < segs.length; i++) { if (t <= segs[i] || i === segs.length - 1) { const r = segs[i] ? Math.min(1, t / segs[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; } t -= segs[i]; }
    return pts[pts.length - 1];
  }
  // a value token travelling along one or more wires (lighting them up)
  async function along(D, tok, names, text, color, ms) {
    const pts = names.flatMap((n) => WIRES[n]);
    names.forEach((n) => { if (D.w[n]) D.w[n].material.color.set(WON); });
    const m = cube(text, color || '#c08a1f', [0.32, 0.22, 0.32], pts[0][0], pts[0][1], 0.35);
    if (m.userData.lbl) small(m.userData.lbl, 9);
    await anim(tok, ms, (f) => { const [x, y] = polyAt(pts, f); m.position.set(x, y, 0.35); });
    return m;
  }
  const lit = (D, ks) => ks.forEach((k) => D.c[k] && glow(D.c[k], GOLD));

  // one instruction through the single-cycle datapath, stage by stage
  const IN = {
    add: { asm: 'add $t1, $t2, $t3', kind: 'R', f: 32, op: '+' },
    sub: { asm: 'sub $t1, $t2, $t3', kind: 'R', f: 34, op: '−' },
    and: { asm: 'and $t1, $t2, $t3', kind: 'R', f: 36, op: '&' },
    or: { asm: 'or $t1, $t2, $t3', kind: 'R', f: 37, op: '|' },
    slt: { asm: 'slt $t1, $t2, $t3', kind: 'R', f: 42, op: '<' },
    lw: { asm: 'lw $t1, 8($t2)', kind: 'lw' },
    sw: { asm: 'sw $t1, 8($t2)', kind: 'sw' },
    beq: { asm: 'beq $t2, $t3, 3', kind: 'beq' },
  };
  const ALUOUT = { add: '0010', sub: '0110', and: '0000', or: '0001', slt: '0111' };
  async function runInstr(D, tok, key, V, pace, talk) {
    const I = IN[key], K = I.kind;
    const pc = 80000;
    const tell = (a, b) => { if (talk) say(a, b); log(a + (b ? '：' + b : '')); };
    const toks = [];
    const keep = (p) => p.then((m) => { toks.push(m); return m; });
    wiresOff(D);
    Object.values(D.sig).forEach((l) => { txt(l, l.element.textContent.split(' =')[0] + ' = ?'); l.element.className = 'lab-label idx'; small(l, 9); });
    // 1. IF
    lit(D, ['PC', 'IM', 'ADD4']);
    tell('1. Instruction fetch：PC = ' + pc, '讀出 ' + I.asm + '，同時算 PC + 4');
    await Promise.all([keep(along(D, tok, ['pc_im'], String(pc), '#c08a1f', pace * 0.5)), keep(along(D, tok, ['pc_add'], String(pc), '#c08a1f', pace * 0.5)), keep(along(D, tok, ['four'], '4', '#c08a1f', pace * 0.5))]);
    await Promise.all([keep(along(D, tok, ['ins'], I.asm.split(' ')[0], '#4b9ee2', pace * 0.3)), keep(along(D, tok, ['pc4_b'], String(pc + 4), '#dd8238', pace * 0.6)), keep(along(D, tok, ['pc4_m'], String(pc + 4), '#dd8238', pace * 0.6))]);
    await W(tok, pace * 0.3);
    // 2. ID
    wiresOff(D); lit(D, ['CTRL', 'RF']);
    setSignals(D, K === 'R' ? 'R' : K);
    const rsV = V.rs, rtV = V.rt;
    tell('2. Decode：Control 看 opcode', K === 'R' ? 'R-type：rs = $t2、rt = $t3、rd = $t1' : K === 'beq' ? 'rs = $t2、rt = $t3' : 'rs = $t2（base）、rt = $t1');
    const p2 = [keep(along(D, tok, ['op'], K === 'R' ? 'op 0' : K === 'lw' ? 'op 35' : K === 'sw' ? 'op 43' : 'op 4', '#6e5f49', pace * 0.6)), keep(along(D, tok, ['rs'], 'rs', '#9b7ef4', pace * 0.6)), keep(along(D, tok, ['rt'], 'rt', '#9b7ef4', pace * 0.6))];
    if (K === 'R') { p2.push(keep(along(D, tok, ['rd', 'wr'], 'rd', '#9b7ef4', pace * 0.6)), keep(along(D, tok, ['fn'], 'funct ' + I.f, '#6e5f49', pace * 0.6))); }
    if (K === 'lw') p2.push(keep(along(D, tok, ['rt_m', 'wr'], 'rt', '#9b7ef4', pace * 0.6)));
    if (K !== 'R') p2.push(keep(along(D, tok, ['imm'], K === 'beq' ? '3' : '8', '#31aab0', pace * 0.6)));
    await Promise.all(p2);
    await W(tok, pace * 0.4);
    // 3. EX
    wiresOff(D); lit(D, ['ALU', 'ALUC']);
    let res = 0;
    const ex = [keep(along(D, tok, ['rd1'], String(rsV), '#9b7ef4', pace * 0.6))];
    if (K === 'R' || K === 'beq') ex.push(keep(along(D, tok, ['rd2', 'ma_alu'], String(rtV), '#9b7ef4', pace * 0.6)));
    else { lit(D, ['SE', 'MUXA']); ex.push(keep(along(D, tok, ['se_m', 'ma_alu'], '8', '#31aab0', pace * 0.6))); }
    ex.push(keep(along(D, tok, ['alc'], K === 'R' ? ALUOUT[key] : K === 'beq' ? '0110' : '0010', '#6e5f49', pace * 0.5)));
    if (K === 'beq') { lit(D, ['SE', 'SL2', 'BADD']); ex.push(keep(along(D, tok, ['se_sl', 'sl_b'], '3×4', '#31aab0', pace * 0.7))); }
    if (K === 'R') res = key === 'add' ? rsV + rtV : key === 'sub' ? rsV - rtV : key === 'and' ? rsV & rtV : key === 'or' ? rsV | rtV : (rsV < rtV ? 1 : 0);
    else if (K === 'beq') res = rsV - rtV;
    else res = rsV + 8;
    tell('3. Execute：' + (K === 'R' ? 'ALU 算 ' + rsV + ' ' + I.op + ' ' + rtV + ' = ' + res : K === 'beq' ? 'ALU 算 ' + rsV + ' − ' + rtV + ' = ' + res + '（Zero = ' + (res === 0 ? 1 : 0) + '）' : 'ALU 算位址 ' + rsV + ' + 8 = ' + res),
      K === 'R' ? 'ALUSrc = 0：第二運算元來自暫存器' : K === 'beq' ? '同時 branch adder 算 ' + (pc + 4) + ' + 12 = ' + (pc + 16) : 'ALUSrc = 1：第二運算元是 sign-extended 8');
    await Promise.all(ex);
    let taken = false;
    if (K === 'beq') { taken = res === 0; await Promise.all([keep(along(D, tok, ['b_m'], String(pc + 16), '#dd8238', pace * 0.4)), keep(along(D, tok, ['zero'], 'Z=' + (taken ? 1 : 0), taken ? '#2fc092' : '#d64545', pace * 0.4))]); }
    await W(tok, pace * 0.3);
    // 4. MEM
    wiresOff(D);
    let wbV = res;
    if (K === 'lw') {
      lit(D, ['DM']);
      wbV = V.mem;
      tell('4. Memory：MemRead = 1，讀 Mem[' + res + ']', '= ' + wbV);
      await keep(along(D, tok, ['alu_dm'], String(res), '#dd8238', pace * 0.5));
      await keep(along(D, tok, ['dm_m'], String(wbV), '#2fc092', pace * 0.4));
    } else if (K === 'sw') {
      lit(D, ['DM']);
      tell('4. Memory：MemWrite = 1，Mem[' + res + '] ← ' + rtV, 'rt 的值從 Read data 2 直接送到 data memory');
      await Promise.all([keep(along(D, tok, ['alu_dm'], String(res), '#dd8238', pace * 0.5)), keep(along(D, tok, ['rd2_dm'], String(rtV), '#9b7ef4', pace * 0.6))]);
    } else if (K === 'R') {
      tell('4. 不用 data memory', 'MemtoReg = 0：ALU 結果繞過記憶體');
      await keep(along(D, tok, ['alu_m'], String(res), '#dd8238', pace * 0.6));
    } else {
      lit(D, ['AND', 'MUXP']);
      tell('Branch = 1 且 Zero = ' + (taken ? 1 : 0), taken ? 'PCSrc = 1：下一個 PC = ' + (pc + 16) : 'PCSrc = 0：下一個 PC = ' + (pc + 4));
      await keep(along(D, tok, ['and_m'], taken ? '1' : '0', taken ? '#2fc092' : '#d64545', pace * 0.4));
    }
    await W(tok, pace * 0.3);
    // 5. WB + next PC
    wiresOff(D);
    const nextPC = K === 'beq' && taken ? pc + 16 : pc + 4;
    if (K === 'R' || K === 'lw') {
      lit(D, ['MUXM', 'RF']);
      tell('5. Write back：RegWrite = 1，$t1 = ' + wbV, K === 'R' ? 'RegDst = 1：寫入 rd' : 'RegDst = 0：寫入 rt；MemtoReg = 1');
      await keep(along(D, tok, ['wb'], String(wbV), '#2fc092', pace * 0.8));
    } else tell(K === 'sw' ? 'sw 不寫暫存器：RegWrite = 0' : 'beq 不寫暫存器：RegWrite = 0', 'RegDst、MemtoReg 是 don\'t care（X）');
    lit(D, ['MUXP', 'PC']);
    await keep(along(D, tok, ['pc_next'], String(nextPC), '#c08a1f', pace * 0.7));
    tell('clock edge：PC ← ' + nextPC, '一個指令在一個（很長的）clock cycle 內做完');
    await W(tok, pace * 0.6);
    toks.forEach((m) => kill(m));
    wiresOff(D);
    return { res, wbV, nextPC, taken };
  }

  // ───────────────────────── 模式 1：單週期資料路徑 ─────────────────────────
  const dp = { key: 'add', rs: 7, rt: 5, mem: 99 };
  function enterDatapath() {
    fresh([0, 3.8, 14], [0, 3.8, 0]);
    controls('<select id="dI">' + Object.keys(IN).map((k) => '<option value="' + k + '">' + IN[k].asm + '</option>').join('') + '</select>'
      + '<label>$t2 = <input id="dS" type="number" value="' + dp.rs + '" style="width:60px"></label><label>$t3 / $t1 = <input id="dT" type="number" value="' + dp.rt + '" style="width:60px"></label>'
      + '<button class="primary" id="dGo">跑一個 clock cycle</button>');
    $('dI').value = dp.key;
    $('dI').onchange = (e) => { dp.key = e.target.value; if (dp.key === 'lw' || dp.key === 'sw') { dp.rs = 100; dp.rt = 42; } else if (dp.key === 'beq') { dp.rs = 7; dp.rt = 7; } else { dp.rs = 7; dp.rt = 5; } enterDatapath(); };
    dp.D = buildDP();
    on('dGo', () => {
      const a = Math.round(Number($('dS').value)), b = Math.round(Number($('dT').value));
      if (!isFinite(a) || !isFinite(b) || Math.abs(a) > 9999 || Math.abs(b) > 9999) { log('請輸入 −9999 ～ 9999 的整數', true); return; }
      if ((dp.key === 'lw' || dp.key === 'sw') && (a + 8) % 4 !== 0) { log('位址 $t2 + 8 要是 4 的倍數（word aligned），否則會產生 exception', true); return; }
      dp.rs = a; dp.rt = b;
      go((async (t) => { const r = await runInstr(dp.D, t, dp.key, { rs: a, rt: b, mem: dp.mem }, 1300, false); updDP(r); })(newRun()));
    });
    updDP();
    log('選一個指令，看資料在單週期 datapath 裡怎麼流；亮起來的線才是這個指令用到的。');
  }
  function updDP(r) {
    const I = IN[dp.key], K = I.kind === 'R' ? 'R' : I.kind;
    setState(I.asm, SIG.map((s, i) => [s, String(CT[K][i])]),
      r ? (r.taken ? '<span class="ok">分支成立</span>：PC = ' + r.nextPC : 'PC = ' + r.nextPC) + (K === 'R' || K === 'lw' ? '；$t1 = ' + r.wbV : '') : '用到的單元：' + (K === 'R' ? 'IM、RF、ALU（不用 DM）' : K === 'lw' ? 'IM、RF、ALU、DM、RF（最長）' : K === 'sw' ? 'IM、RF、ALU、DM' : 'IM、RF、ALU、branch adder'));
  }

  // ───────────────────────── 模式 2：控制訊號表 ─────────────────────────
  const cq = { q: null, score: 0, total: 0 };
  function enterControl() {
    fresh([0, 4.6, 13.5], [0, 2.4, 0]);
    const rows = Object.keys(CT);
    cq.cells = {};
    SIG.forEach((s, j) => small(tag(s, 'ptr', -4.6 + j * 1.25, 5.0), 10));
    rows.forEach((r, i) => {
      tag(r === 'R' ? 'R-format' : r, 'ptr alt', -6.4, 4.0 - i * 1.1);
      cq.cells[r] = CT[r].map((v, j) => cube(v, v === 1 ? '#2fc092' : v === 0 ? '#e9dcc4' : '#d8cfc0', [1.05, 0.5, 0.7], -4.6 + j * 1.25, 4.0 - i * 1.1, 0));
    });
    controls(rows.map((r) => '<button id="cR' + r + '">' + (r === 'R' ? 'R-format' : r) + '</button>').join('') + '<button class="primary" id="cQ">考我一格</button><button id="c0">0</button><button id="c1">1</button><button id="cX">X</button>');
    rows.forEach((r) => on('cR' + r, () => showRow(r)));
    on('cQ', () => {
      const r = rows[Math.floor(Math.random() * rows.length)], j = Math.floor(Math.random() * SIG.length);
      cq.q = { r, j };
      Object.values(cq.cells).flat().forEach((m) => { relabel(m, '?'); tint(m, '#e9dcc4'); glow(m, null); });
      glow(cq.cells[r][j], GOLD);
      log('考題：' + (r === 'R' ? 'R-format' : r) + ' 的 ' + SIG[j] + ' 是多少？按 0 / 1 / X。');
      updCtl();
    });
    for (const [id, v] of [['c0', 0], ['c1', 1], ['cX', 'X']]) on(id, () => {
      if (!cq.q) { log('先按「考我一格」出題', true); return; }
      const ans = CT[cq.q.r][cq.q.j];
      cq.total++; if (ans === v) cq.score++;
      log((ans === v ? '答對：' : '答錯：') + (cq.q.r === 'R' ? 'R-format' : cq.q.r) + ' 的 ' + SIG[cq.q.j] + ' = ' + ans + '。' + whySig(cq.q.r, SIG[cq.q.j]), ans !== v);
      showRow(cq.q.r); cq.q = null;
    });
    showRow('lw');
    log('P&H 圖 4.18 的真值表：X 代表 don\'t care（那個 mux 的輸出不會被用到）。');
  }
  function whySig(r, s) {
    const W_ = {
      RegDst: { R: 'R-type 寫 rd（bits 15–11）', lw: 'lw 寫 rt（bits 20–16）', sw: '不寫暫存器，選哪個都沒差', beq: '不寫暫存器，選哪個都沒差' },
      ALUSrc: { R: '第二運算元是暫存器 rt', lw: '第二運算元是 offset（立即值）', sw: '第二運算元是 offset', beq: '要比較兩個暫存器' },
      MemtoReg: { R: '寫回 ALU 結果', lw: '寫回記憶體讀出的資料', sw: '不寫回', beq: '不寫回' },
      RegWrite: { R: '要寫 rd', lw: '要寫 rt', sw: '不寫暫存器', beq: '不寫暫存器' },
      MemRead: { R: '不碰記憶體', lw: '要讀記憶體', sw: '是寫不是讀', beq: '不碰記憶體' },
      MemWrite: { R: '不寫記憶體', lw: '是讀不是寫', sw: '要寫記憶體', beq: '不寫記憶體' },
      Branch: { R: '不是分支', lw: '不是分支', sw: '不是分支', beq: '是分支，搭配 Zero 決定 PCSrc' },
      ALUOp1: { R: 'ALUOp = 10：看 funct', lw: 'ALUOp = 00：做加法算位址', sw: 'ALUOp = 00：加法', beq: 'ALUOp = 01：減法比較' },
      ALUOp0: { R: 'ALUOp = 10', lw: 'ALUOp = 00', sw: 'ALUOp = 00', beq: 'ALUOp = 01：減法' },
    };
    return W_[s][r];
  }
  function showRow(r) {
    Object.entries(cq.cells).forEach(([k, ms]) => ms.forEach((m, j) => { const v = CT[k][j]; relabel(m, v); tint(m, v === 1 ? '#2fc092' : v === 0 ? '#e9dcc4' : '#d8cfc0'); glow(m, k === r ? GOLD : null); m.position.z = k === r ? 0.6 : 0; }));
    cq.row = r; updCtl();
  }
  function updCtl() {
    const r = cq.row;
    setState('控制訊號：' + (r === 'R' ? 'R-format' : r), SIG.map((s, i) => [s, String(CT[r][i])]), '考我：答對 ' + cq.score + ' / ' + cq.total + '<br>sw / beq 的 RegDst、MemtoReg 是 X：RegWrite = 0，選什麼都不會寫入');
  }

  // ───────────────────────── 模式 3：ALU control ─────────────────────────
  const ac = { op: '10', fn: 'add' };
  const FUNCT = { add: '100000', sub: '100010', and: '100100', or: '100101', slt: '101010' };
  function aluCtl(op, fn) { return op === '00' ? '0010' : op === '01' ? '0110' : ALUOUT[fn]; }
  const ALUNAME = { '0010': 'add', '0110': 'subtract', '0000': 'AND', '0001': 'OR', '0111': 'set on less than' };
  function enterALU() {
    fresh([0, 3.8, 13], [0, 2.6, 0]);
    controls('<label>ALUOp <select id="aOp"><option value="00">00（lw / sw）</option><option value="01">01（beq）</option><option value="10">10（R-type）</option></select></label>'
      + '<label>funct <select id="aFn">' + Object.keys(FUNCT).map((k) => '<option value="' + k + '">' + FUNCT[k] + '（' + k + '）</option>').join('') + '</select></label><button class="primary" id="aGo">送進 ALU control</button>');
    $('aOp').value = ac.op; $('aFn').value = ac.fn;
    $('aOp').onchange = (e) => { ac.op = e.target.value; drawALU(); };
    $('aFn').onchange = (e) => { ac.fn = e.target.value; drawALU(); };
    on('aGo', () => go(pulseALU(newRun())));
    drawALU();
  }
  function drawALU() {
    lab.clear();
    ac.box = cube('ALU control', '#6e5f49', [2.6, 1.2, 0.8], 0, 2.6, 0);
    ac.opB = ac.op.split('').map((b, i) => cube(b, b === '1' ? '#4b9ee2' : '#c6def5', [0.6, 0.4, 0.6], -4.6 + i * 0.7, 4.6, 0));
    tag('ALUOp（from Control）', 'ptr', -4.25, 5.3);
    const f = FUNCT[ac.fn];
    ac.fnB = f.split('').map((b, i) => cube(b, b === '1' ? '#dd8238' : '#f4d3b5', [0.5, 0.4, 0.6], 1.6 + i * 0.6, 4.6, 0));
    tag('funct（instr[5:0]）', 'ptr', 3.1, 5.3);
    line([[-4.25, 4.4], [-1.0, 3.2]], '#8a7a5c'); line([[3.1, 4.4], [1.0, 3.2]], '#8a7a5c');
    const o = aluCtl(ac.op, ac.fn);
    ac.outB = o.split('').map((b, i) => cube(b, b === '1' ? '#2fc092' : '#c2ecdc', [0.6, 0.4, 0.6], -1.05 + i * 0.7, 0.6, 0));
    line([[0, 2.0], [0, 0.85]], '#8a7a5c');
    ac.res = tag('→ ALU 做 ' + ALUNAME[o], 'ptr alt', 3.6, 0.6);
    if (ac.op !== '10') ac.fnB.forEach((m) => { tint(m, '#d8cfc0'); relabel(m, 'x'); });
    setState('ALU control', [['ALUOp', ac.op], ['funct', ac.op === '10' ? f + '（' + ac.fn + '）' : 'XXXXXX（不看）'], ['ALU control 輸出', o + ' = ' + ALUNAME[o]]],
      '00 → add（算位址）；01 → subtract（beq 比較）；10 → 看 funct<br>add 0010、sub 0110、AND 0000、OR 0001、slt 0111');
  }
  async function pulseALU(t) {
    [...ac.opB, ...(ac.op === '10' ? ac.fnB : [])].forEach((m) => glow(m, GOLD));
    await W(t, 500); glow(ac.box, GOLD); await W(t, 500);
    ac.outB.forEach((m) => { glow(m, GREEN); const p = m.position.clone(); m.position.y += 1.2; move(m, p.x, p.y, p.z); });
    log('ALUOp ' + ac.op + (ac.op === '10' ? ' + funct ' + FUNCT[ac.fn] : '') + ' → ' + aluCtl(ac.op, ac.fn) + '（' + ALUNAME[aluCtl(ac.op, ac.fn)] + '）');
    await W(t, 700);
    [...ac.opB, ...ac.fnB, ac.box].forEach((m) => glow(m, null));
  }

  // ───────────────────────── 模式 4：單週期 vs 多週期時間 ─────────────────────────
  const tm = { lat: [200, 100, 200, 200, 100], mix: [25, 10, 45, 15, 5] };
  const UNITS = ['Instr fetch', 'Reg read', 'ALU', 'Data mem', 'Reg write'];
  const UCOL = ['#4b9ee2', '#9b7ef4', '#dd8238', '#2fc092', '#e55a9b'];
  const CLASSES = [['lw', [1, 1, 1, 1, 1], 5], ['sw', [1, 1, 1, 1, 0], 4], ['R-type', [1, 1, 1, 0, 1], 4], ['beq', [1, 1, 1, 0, 0], 3], ['j', [1, 0, 0, 0, 0], 3]];
  function enterTiming() {
    fresh([0, 3.8, 14], [0, 3.0, 0]);
    const inp = (id, v) => '<input id="' + id + '" type="number" value="' + v + '" style="width:52px">';
    controls('延遲（ps）IF ' + inp('t0', tm.lat[0]) + ' Reg ' + inp('t1', tm.lat[1]) + ' ALU ' + inp('t2', tm.lat[2]) + ' Mem ' + inp('t3', tm.lat[3]) + ' WB ' + inp('t4', tm.lat[4])
      + '　比例 % lw ' + inp('m0', tm.mix[0]) + ' sw ' + inp('m1', tm.mix[1]) + ' R ' + inp('m2', tm.mix[2]) + ' beq ' + inp('m3', tm.mix[3]) + ' j ' + inp('m4', tm.mix[4]) + '<button class="primary" id="tGo">重算</button>');
    on('tGo', () => {
      const lat = [0, 1, 2, 3, 4].map((i) => Number($('t' + i).value)), mix = [0, 1, 2, 3, 4].map((i) => Number($('m' + i).value));
      if (lat.some((v) => !(v > 0 && v <= 1000))) { log('延遲要是 1 ～ 1000 ps', true); return; }
      if (mix.some((v) => !(v >= 0)) || Math.abs(mix.reduce((a, b) => a + b, 0) - 100) > 0.01) { log('指令比例加起來要剛好 100%', true); return; }
      tm.lat = lat; tm.mix = mix; go(drawTiming(newRun(), 120));
    });
    go(drawTiming(newRun(), 0));
  }
  async function drawTiming(t, pace) {
    lab.clear();
    const tot = CLASSES.map(([, u]) => u.reduce((s, on_, i) => s + (on_ ? tm.lat[i] : 0), 0));
    const clk = Math.max(...tot);
    const sc = 11 / clk;
    CLASSES.forEach(([nm, u], r) => {
      const y = 5.6 - r * 1.1;
      tag(nm, 'ptr', -6.6, y);
    });
    for (let r = 0; r < CLASSES.length; r++) {
      const [, u] = CLASSES[r]; const y = 5.6 - r * 1.1;
      let x = -5.8;
      for (let i = 0; i < 5; i++) {
        if (!u[i]) continue;
        const w = tm.lat[i] * sc;
        const m = bar(UCOL[i], Math.max(0.05, w - 0.04), 0.6, x + w / 2, y);
        if (w > 0.9) { m.userData.lbl = small(lab.label(String(tm.lat[i]), 'val'), 9); m.add(m.userData.lbl); }
        x += w;
        if (pace) await W(t, pace);
      }
      small(tag(tot[r] + ' ps', 'idx', x + 0.6, y), 10);
    }
    line([[-5.8 + clk * sc, 6.3], [-5.8 + clk * sc, 0.6]], '#d64545');
    small(tag('單週期 clock = ' + clk + ' ps', 'ptr alt', -5.8 + clk * sc - 1.2, 0.2), 10);
    UNITS.forEach((u, i) => small(tag(u, 'idx', -5 + i * 2.4, 6.6), 9));
    const mix = tm.mix.map((v) => v / 100);
    const varAvg = tot.reduce((s, v, i) => s + v * mix[i], 0);
    const step = Math.max(...tm.lat);
    const cpiM = CLASSES.reduce((s, c, i) => s + c[2] * mix[i], 0);
    setState('單週期 vs 多週期', [['單週期 clock', clk + ' ps（最慢的指令）'], ['理想可變 clock 平均', +varAvg.toFixed(1) + ' ps'], ['多週期 clock', step + ' ps（最慢的一步）'], ['多週期 CPI', +cpiM.toFixed(2)], ['多週期平均每指令', +(cpiM * step).toFixed(1) + ' ps']],
      '單週期：每個指令都要等 lw 那麼久 → 浪費<br>多週期：lw 5、sw 4、R 4、beq 3、j 3 個 cycle（P&H 第 3 版）');
  }

  // ───────────────────────── 場景（課本） ─────────────────────────
  async function scClocking(tok) {
    fresh([0, 3.4, 13], [0, 2.4, 0]);
    const s1 = cube('State element 1', '#c08a1f', [2.4, 1.2, 0.8], -4.4, 2.4, 0);
    const cl = cube('Combinational logic', '#4b9ee2', [3.6, 1.4, 0.8], 0, 2.4, 0);
    const s2 = cube('State element 2', '#c08a1f', [2.4, 1.2, 0.8], 4.4, 2.4, 0);
    line([[-3.2, 2.4], [-1.8, 2.4]], '#8a7a5c'); line([[1.8, 2.4], [3.2, 2.4]], '#8a7a5c');
    say('兩種元件：combinational 與 state element', 'state element 存值（PC、暫存器、記憶體）');
    await beat(tok, 2800);
    const clk = []; for (let i = 0; i < 8; i++) clk.push(cube('', '#6e5f49', [0.7, i % 2 ? 0.15 : 0.6, 0.3], -2.8 + i * 0.8, i % 2 ? 0.3 : 0.55, 0));
    tag('clock', 'idx', -3.8, 0.4);
    say('Edge-triggered：只在 clock edge 更新', '');
    await beat(tok, 2000);
    for (let k = 0; k < 2; k++) {
      glow(s1, GOLD);
      const v = cube('值', '#2fc092', [0.5, 0.4, 0.4], -4.4, 2.4, 0.6);
      move(v, 0, 2.4, 0.6); glow(cl, GOLD);
      say('edge：state 1 送出新值，經過 combinational logic', '要在下一個 edge 之前算完');
      await beat(tok, 1600);
      move(v, 4.4, 2.4, 0.6); glow(s2, GOLD);
      await beat(tok, 1200);
      say('下一個 edge：結果寫進 state 2', 'clock period ≥ 最長的 combinational delay');
      await beat(tok, 1600);
      kill(v); [s1, cl, s2].forEach((m) => glow(m, null));
    }
    say('同一個 cycle 可以「讀舊值、寫新值」', '例：add $t0, $t0, 1 讀的是舊的 $t0');
    await beat(tok, 3000);
  }
  async function scBuild(tok) {
    fresh([0, 3.8, 14], [0, 3.8, 0]);
    say('課本：一個元件一個元件把 datapath 組起來', 'P&H 第 4 章');
    await beat(tok, 2000);
    let D = null;
    for (let k = 1; k <= BUILD.length; k++) {
      lab.clear();
      D = buildDP(k, false);
      const key = BUILD[k - 1][0];
      if (D.c[key]) { glow(D.c[key], GOLD); const p = D.c[key].position.clone(); D.c[key].position.y += 2.5; move(D.c[key], p.x, p.y, p.z); }
      BUILD[k - 1][1].forEach((w) => D.w[w] && D.w[w].material.color.set(WON));
      say(BUILD[k - 1][2], BUILD[k - 1][3]);
      await beat(tok, 1700);
    }
    say('完整的單週期 datapath + control', '每個指令一個 clock cycle 跑完');
    await beat(tok, 3000);
    return D;
  }
  async function scFetch(tok) {
    fresh([0, 3.8, 14], [0, 3.8, 0]);
    const D = buildDP();
    say('Fetch：每個指令都一樣', 'PC → Instruction memory；同時 PC + 4');
    for (let k = 0; k < 3; k++) {
      const pc = 80000 + 4 * k;
      lit(D, ['PC', 'IM', 'ADD4']);
      const a = await Promise.all([along(D, tok, ['pc_im'], String(pc), '#c08a1f', 700), along(D, tok, ['pc_add'], String(pc), '#c08a1f', 700)]);
      const b = await along(D, tok, ['pc4_m', 'pc_next'], String(pc + 4), '#dd8238', 1500);
      say('PC = ' + pc + ' → 下一個 ' + (pc + 4), '沒有分支時 PCSrc = 0，選 PC + 4');
      [...a, b].forEach(kill); wiresOff(D);
      await beat(tok, 500);
    }
    say('Instruction memory 只讀；PC 每個 cycle 都寫', '所以 PC 不需要 write control');
    await beat(tok, 2800);
  }
  const flowScene = (key, V, intro) => async (tok) => {
    fresh([0, 3.8, 14], [0, 3.8, 0]);
    const D = buildDP();
    say(intro[0], intro[1]);
    await beat(tok, 2400);
    const r = await runInstr(D, tok, key, V, 1700, true);
    return r;
  };
  const scR = flowScene('add', { rs: 7, rt: 5 }, ['R-type：add $t1, $t2, $t3', '$t2 = 7、$t3 = 5']);
  const scLw = flowScene('lw', { rs: 100, rt: 42, mem: 99 }, ['lw $t1, 8($t2)', '$t2 = 100，Mem[108] = 99']);
  const scSw = flowScene('sw', { rs: 100, rt: 42 }, ['sw $t1, 8($t2)', '$t2 = 100，$t1 = 42']);
  const scBeq = flowScene('beq', { rs: 7, rt: 7 }, ['beq $t2, $t3, 3', '$t2 = $t3 = 7 → 會跳']);
  async function scCtlTable(tok) {
    fresh([0, 4.6, 13.5], [0, 2.4, 0]);
    const rows = Object.keys(CT);
    SIG.forEach((s, j) => small(tag(s, 'ptr', -4.6 + j * 1.25, 5.0), 10));
    const cells = {};
    say('課本圖 4.18：Control 的真值表', '9 個控制訊號 × 4 類指令');
    await beat(tok, 2200);
    const why = { R: ['R-format：寫 rd、ALU 看 funct', 'RegDst 1、RegWrite 1、ALUOp 10'], lw: ['lw：用立即值、讀記憶體、寫回', 'ALUSrc 1、MemtoReg 1、MemRead 1'], sw: ['sw：寫記憶體、不寫暫存器', 'RegDst、MemtoReg = X（don\'t care）'], beq: ['beq：ALU 做減法、Branch = 1', 'ALUOp 01；Zero 決定要不要跳'] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      tag(r === 'R' ? 'R-format' : r, 'ptr alt', -6.4, 4.0 - i * 1.1);
      cells[r] = [];
      for (let j = 0; j < 9; j++) {
        const v = CT[r][j];
        cells[r].push(cube(v, v === 1 ? '#2fc092' : v === 0 ? '#e9dcc4' : '#d8cfc0', [1.05, 0.5, 0.7], -4.6 + j * 1.25, 4.0 - i * 1.1, 0, 2));
        await beat(tok, 120);
      }
      say(why[r][0], why[r][1]);
      await beat(tok, 2600);
    }
    say('X：那個 mux 的結果不會被寫進任何地方', 'RegWrite = 0 時 RegDst 選什麼都沒差');
    await beat(tok, 3000);
  }
  async function scAluCtl(tok) {
    fresh([0, 3.8, 13], [0, 2.6, 0]);
    const seq = [['00', 'add', 'lw / sw：ALUOp = 00 → add', '算位址 base + offset'], ['01', 'add', 'beq：ALUOp = 01 → subtract', '相減看 Zero'], ['10', 'add', 'R-type：ALUOp = 10，看 funct', 'funct 100000 → 0010 add'], ['10', 'sub', 'funct 100010 → 0110 subtract', ''], ['10', 'and', 'funct 100100 → 0000 AND', ''], ['10', 'or', 'funct 100101 → 0001 OR', ''], ['10', 'slt', 'funct 101010 → 0111 slt', 'set on less than']];
    say('兩層解碼：Control 給 ALUOp，ALU control 再看 funct', '');
    await beat(tok, 2400);
    for (const [op, fn, a, b] of seq) {
      ac.op = op; ac.fn = fn; drawALU();
      say(a, b);
      await pulseALU(tok);
      await beat(tok, 1300);
    }
    say('多層解碼：主 Control 比較小、比較快', 'ALU control 4 bits：0000 AND、0001 OR、0010 add、0110 sub、0111 slt');
    await beat(tok, 3000);
  }
  async function scJump(tok) {
    fresh([0, 3.4, 13], [0, 2.4, 0]);
    say('加上 j：再多一個 mux 選 jump 位址', 'Control 多一個訊號 Jump');
    const parts = [['PC+4 [31:28]', '#c08a1f', 2.0], ['instr [25:0]', '#2fc092', 5.2], ['00', '#bdb3a2', 0.9]];
    let x = -4.2;
    const ms = [];
    for (const [t, c, w] of parts) { ms.push(cube(t, c, [w - 0.1, 0.7, 0.8], x + w / 2, 3.6, 0, 2)); x += w; await beat(tok, 900); }
    say('jump address = PC+4 高 4 bits ‖ 26 bits ‖ 00', '26 bits 左移 2 → 28 bits');
    await beat(tok, 3000);
    const mux = cube('Jump mux', '#8a7a5c', [1.4, 1.2, 0.6], 0, 1.2, 0);
    tag('0：PC+4 或 branch', 'idx', -3.4, 1.2); tag('1：jump address', 'idx', 3.6, 1.2);
    glow(mux, GOLD);
    say('Jump = 1 時選 jump address', 'j 的其他訊號：RegWrite = 0、MemWrite = 0');
    await beat(tok, 3000);
    return ms;
  }
  async function scSingleTime(tok) {
    fresh([0, 3.8, 14], [0, 3.0, 0]);
    tm.lat = [200, 100, 200, 200, 100]; tm.mix = [25, 10, 45, 15, 5];
    say('例：IF 200、Reg 100、ALU 200、Mem 200、WB 100 ps', '各指令要經過哪些單元？');
    await beat(tok, 2600);
    await drawTiming(tok, 260);
    say('lw 最長：200 + 100 + 200 + 200 + 100 = 800 ps', '單週期的 clock 必須 = 800 ps');
    await beat(tok, 3000);
    say('R-type 只要 600、beq 500、j 200', '卻都要等 800 ps：浪費');
    await beat(tok, 3000);
    say('單週期 CPI = 1，但 clock period 很長', '而且不同指令沒辦法共用硬體（要兩個 adder、兩個 memory）');
    await beat(tok, 3200);
  }
  async function scMulti(tok) {
    fresh([0, 3.8, 14], [0, 3.0, 0]);
    say('多週期：把指令切成幾步，一步一個 cycle', 'IF、ID、EX、MEM、WB');
    const steps = ['IF', 'ID', 'EX', 'MEM', 'WB'];
    const cls = [['lw', 5], ['sw', 4], ['R-type', 4], ['beq', 3], ['j', 3]];
    cls.forEach(([n], r) => tag(n, 'ptr', -6.4, 5.6 - r * 1.1));
    for (let r = 0; r < cls.length; r++) {
      const [n, c] = cls[r];
      for (let k = 0; k < c; k++) { cube(steps[k], ['#4b9ee2', '#9b7ef4', '#dd8238', '#2fc092', '#e55a9b'][k], [1.1, 0.6, 0.7], -5.2 + k * 1.2, 5.6 - r * 1.1, 0, 1.6); await beat(tok, 140); }
      tag(c + ' cycles', 'ptr alt', 1.4, 5.6 - r * 1.1);
      say(n + '：' + c + ' 個 cycle', n === 'beq' ? 'EX 就決定分支，結束' : n === 'j' ? '第 3 步就改 PC' : n === 'R-type' ? '第 4 步寫回暫存器' : n === 'sw' ? '第 4 步寫記憶體' : '要多一步 WB');
      await beat(tok, 1100);
    }
    say('課本例（gcc）：22% lw、11% sw、49% R、16% beq、2% j', 'CPI = 0.22×5 + 0.11×4 + 0.49×4 + 0.16×3 + 0.02×3');
    await beat(tok, 3200);
    say('平均 CPI = 4.04', 'clock period 由最慢的「一步」決定（例如 200 ps）');
    await beat(tok, 3000);
    say('優點：clock 短、硬體可重複用（一個 ALU、一個 memory）', '缺點：CPI > 1、要用 FSM 控制；pipeline 再更進一步');
    await beat(tok, 3200);
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const R_ = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function uniq(ans, wrong) { const o = [ans]; for (const w of wrong) if (!o.includes(w) && o.length < 4) o.push(w); let k = 1; while (o.length < 4) o.push(ans + '（' + k++ + '）'); return o; }
  function genQ() {
    const t = R_(0, 7);
    if (t <= 1) {
      const r = pickOne(Object.keys(CT)), j = R_(0, 6);
      const ans = String(CT[r][j]);
      return { q: (r === 'R' ? 'R-format' : r) + ' 指令的 ' + SIG[j] + ' 控制訊號是？', opts: uniq(ans, ['0', '1', 'X', '視 funct 而定']), ans, why: whySig(r, SIG[j]) + '。' };
    }
    if (t === 2) {
      const op = pickOne(['00', '01', '10', '10', '10']), fn = pickOne(Object.keys(FUNCT));
      const ans = aluCtl(op, fn);
      return { q: 'ALUOp = ' + op + '、funct = ' + FUNCT[fn] + '，ALU control 輸出是？', opts: uniq(ans, ['0010', '0110', '0000', '0001', '0111'].filter((x) => x !== ans)), ans, why: op === '10' ? 'ALUOp 10 看 funct：' + FUNCT[fn] + ' 是 ' + fn + ' → ' + ans + '。' : 'ALUOp ' + op + ' 不看 funct：' + (op === '00' ? '00 → add（0010）' : '01 → subtract（0110）') + '。' };
    }
    if (t === 3) {
      const lat = [R_(2, 4) * 50, R_(1, 3) * 50, R_(2, 4) * 50, R_(2, 5) * 50, R_(1, 3) * 50];
      const ans = lat.reduce((a, b) => a + b, 0) + ' ps';
      return { q: 'IF ' + lat[0] + '、Reg read ' + lat[1] + '、ALU ' + lat[2] + '、Mem ' + lat[3] + '、Reg write ' + lat[4] + ' ps，單週期 CPU 的 clock period 至少？', opts: uniq(ans, [Math.max(...lat) + ' ps', (lat[0] + lat[1] + lat[2] + lat[4]) + ' ps', (lat[0] + lat[1] + lat[2] + lat[3]) + ' ps']), ans, why: 'lw 用到全部五個單元，是最長的路徑；單週期 clock 由最慢的指令決定。' };
    }
    if (t === 4) {
      const mix = [R_(15, 30), R_(5, 15), 0, R_(10, 20), R_(1, 5)]; mix[2] = 100 - mix[0] - mix[1] - mix[3] - mix[4];
      const cpi = (mix[0] * 5 + mix[1] * 4 + mix[2] * 4 + mix[3] * 3 + mix[4] * 3) / 100;
      const ans = String(+cpi.toFixed(2));
      return { q: '多週期 CPU（lw 5、sw 4、R 4、beq 3、j 3 cycles），指令比例 lw ' + mix[0] + '%、sw ' + mix[1] + '%、R ' + mix[2] + '%、beq ' + mix[3] + '%、j ' + mix[4] + '%，CPI = ?', opts: uniq(ans, ['5', '1', String(+((5 + 4 + 4 + 3 + 3) / 5).toFixed(2))]), ans, why: '加權平均：Σ 比例 × cycles = ' + ans + '。' };
    }
    if (t === 5) {
      const q = pickOne([
        ['beq 在單週期 datapath 中用不到哪個單元？', 'Data memory', ['ALU', 'Register file', 'Sign-extend']],
        ['sw 用不到哪個動作？', '寫回 register file', ['ALU 算位址', '讀 register file', 'Sign-extend']],
        ['R-type 用不到哪個單元？', 'Data memory', ['ALU', 'Register file', 'Instruction memory']],
      ]);
      return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: 'beq 只比較兩個暫存器、算分支目標；sw 不寫暫存器；R-type 不碰 data memory。' };
    }
    if (t === 6) {
      const q = pickOne([
        ['RegDst = 1 時，寫入的暫存器編號來自？', 'rd（instr[15:11]）', ['rt（instr[20:16]）', 'rs（instr[25:21]）', 'funct'], 'R-type 寫 rd；lw 寫 rt（RegDst = 0）。'],
        ['ALUSrc = 1 時 ALU 的第二運算元是？', 'sign-extended 立即值', ['Read data 2', 'PC + 4', 'Read data 1'], 'lw / sw 用 offset 算位址。'],
        ['MemtoReg = 1 時寫回暫存器的是？', 'data memory 讀出的資料', ['ALU 結果', 'PC + 4', '立即值'], 'lw 要把記憶體資料寫回。'],
        ['PCSrc 是怎麼產生的？', 'Branch AND Zero', ['Branch OR Zero', 'ALUOp', 'MemRead'], '是分支指令且兩數相等（Zero = 1）才選分支目標。'],
        ['beq 的分支目標如何計算？', 'PC + 4 + (sign-extend(offset) << 2)', ['PC + offset', 'PC + (offset << 2)', '{PC[31:28], offset, 00}'], 'offset 以指令為單位，要 ×4，基準是 PC + 4。'],
      ]);
      return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: q[3] };
    }
    const q = pickOne([
      ['單週期 CPU 最大的缺點是？', 'clock period 被最慢的指令拉長', ['CPI 大於 1', '需要 forwarding', '不能執行 lw'], '每個指令都要等 lw 那麼久。'],
      ['為什麼單週期 datapath 要兩個 memory（指令、資料）？', '同一個 cycle 內要同時讀指令和存取資料', ['因為指令比資料大', '為了省電', '因為 MIPS 規定'], '單週期每個單元一個 cycle 只能用一次。'],
      ['多週期 CPU 的優點是？', '硬體可重複使用、clock period 較短', ['CPI = 1', '不需要控制單元', '不用暫存器'], '每一步一個 cycle，ALU、memory 可在不同步驟共用。'],
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
    'clocking': { title: '課本：state element、combinational 與 edge-triggered clock', play: scClocking },
    'build-datapath': { title: '課本：一步一步組出單週期 datapath', play: scBuild },
    'fetch': { title: '課本：Instruction fetch 與 PC + 4', play: scFetch },
    'r-type-flow': { title: '課本：R-type（add）走過 datapath', play: scR },
    'lw-flow': { title: '課本：lw 走過 datapath（最長路徑）', play: scLw },
    'sw-flow': { title: '課本：sw 走過 datapath', play: scSw },
    'beq-flow': { title: '課本：beq 與 Branch AND Zero', play: scBeq },
    'control-table': { title: '課本：控制訊號真值表', play: scCtlTable },
    'alu-control': { title: '課本：ALUOp + funct → ALU control', play: scAluCtl },
    'jump-add': { title: '課本：加上 jump 指令', play: scJump },
    'single-cycle-time': { title: '課本：單週期的 clock 由 lw 決定（800 ps）', play: scSingleTime },
    'multi-cycle': { title: '課本：多週期 CPU 與 CPI 4.04', play: scMulti },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ cpu.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, move } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 3 章（清大 黃婷婷 第 14A／14B／15A／16A／17A 講：floating point 乘法、單週期 CPU、pipeline 入門）— cued scenes ───
// 每個 scene 是一串 step：每一步等老師講到那句話（notes 的 cues）才動一下，不重播、不循環。
// datapath 用本章的 COMP／WIRES／buildDP／along（P&H 單週期圖），一個元件一個元件加上去。
// 老師的數字照用（exponent 7 與 −3、bias 8；1.000×2⁻¹ × −1.110×2⁻²；PC 1000→2000、1000→10000；
// 洗衣 30／40／20 分鐘、4 個人；800 ps vs 200 ps；ALU control 0000／0001／0010／0110…）。
// 所有 bits、bias、乘積、控制訊號真值表、ALU control、邏輯式、delay 加總、jump 位址都用程式算，畫面顯示 ✓。
// 老師沒給的數字（例如各單元的 ps）標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const TG = (cls) => (t, x, y, z = 0) => tag(t, cls, x, y, z);
const hd = TG('ptr'), hot = TG('ptr alt'), sm = TG('idx'), note = TG('note'), good = TG('good'), bad = TG('bad'), bub = TG('say'), pl = TG('');
const ok = (b, t, x, y) => { if (!b) log('✘ ' + t, true); return b ? good('✓ ' + t, x, y) : bad('✘ ' + t, x, y); };
const MONOF = 'ui-monospace, SFMono-Regular, Consolas, monospace';
const mono = (l, px = 12) => { Object.assign(l.element.style, { fontFamily: MONOF, whiteSpace: 'pre', fontSize: px + 'px', fontWeight: '600' }); return l; };
const mt = (t, x, y, px = 12, cls = '') => mono(tag(t, cls, x, y), px);
const fsz = (l, px) => { Object.assign(l.element.style, { fontSize: px + 'px' }); return l; };
const setc = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.g && o.set) return kill(o.g); if (o.element) remove(o); else kill(o); });
const CC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', gold: '#c08a1f', teal: '#31aab0', gray: '#d8cfc0', brown: '#6e5f49', pink: '#e55a9b', red: '#d64545', sand: '#e9dcc4', mux: '#8a7a5c', sky: '#c6def5', peach: '#f4d3b5', mint: '#c2ecdc', lilac: '#d9cdfb', paper: '#f6efe2', yel: '#e9c53a' };
const HL = '#6a4a00', OKG = '#0f5a3a', BADG = '#7a1010';
const CAM = [[0, 3.6, 14.5], [0, 3.4, 0]];
const DPC = [[0, 3.8, 14], [0, 3.8, 0]];
const bx = (t, c, x, y, w = 1.6, h = 0.6, d = 0.6, z = 0) => cube(t, c, [w, h, d], x, y, z);
// a scene = a list of step functions; each runs when the video reaches its cue
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// lines of text going down from (x, y)
function lister(x, y, dy = 0.62) { let k = 0; const ls = []; const f = (t, cls = '', px) => { const l = tag(t, cls, x, y - k++ * dy); l.center && l.center.set(0, 0.5); if (px) fsz(l, px); ls.push(l); return l; }; f.ls = ls; f.skip = (n = 1) => { k += n; }; f.at = () => y - k * dy; return f; }
// a row of bit cells
function bitRow(bits, x, y, w = 0.42, c1 = CC.blue, c0 = CC.sky, px = 10) {
  return [...bits].map((b, i) => { const m = cube(b, b === '1' ? c1 : b === '0' ? c0 : CC.gray, [w - 0.05, 0.42, 0.4], x + i * w, y, 0); if (m.userData.lbl) fsz(m.userData.lbl, px); return m; });
}
// an instruction-format bar: fields [[name, bits, color], …], total width W, starting at x
function fmtBar(fields, x, y, W = 10, h = 0.6) {
  const tot = fields.reduce((s, f) => s + f[1], 0); let cx = x; const out = [];
  for (const [n, b, c] of fields) { const w = W * b / tot; const m = cube(n, c, [w - 0.05, h, 0.5], cx + w / 2, y, 0); if (m.userData.lbl) fsz(m.userData.lbl, w < 0.8 ? 9 : 11); out.push(m); out.push(fsz(sm(String(b), cx + w / 2, y - h / 2 - 0.28), 9)); cx += w; }
  out.tot = tot; return out;
}
// a token travelling along a polyline [[x, y], …]
async function flow(tok, pts, text, color = CC.gold, ms = 900, z = 0.35) {
  const m = cube(text, color, [0.42, 0.26, 0.3], pts[0][0], pts[0][1], z);
  if (m.userData.lbl) fsz(m.userData.lbl, 9);
  await anim(tok, ms, (f) => { const [x, y] = polyAt(pts, f); m.position.set(x, y, z); });
  return m;
}
// a flat board behind things (a block / region) with a name on top
function board(name, x, y, w, h, color = CC.paper) { const m = cube(null, color, [w, h, 0.06], x, y, -0.45); const l = name ? hd(name, x, y + h / 2 + 0.25) : null; return [m, l]; }
// integer ↔ bit strings
const toB = (n, w) => (((n % 2 ** w) + 2 ** w) % 2 ** w).toString(2).padStart(w, '0');
const fromS = (b) => { const v = parseInt(b, 2); return b[0] === '1' ? v - 2 ** b.length : v; };
const fromU = (b) => parseInt(b, 2);
const f32 = Math.fround;
function u2f(u) { const dv = new DataView(new ArrayBuffer(4)); dv.setUint32(0, u >>> 0); return dv.getFloat32(0); }
// datapath built piece by piece (same parts and wires as this chapter's buildDP)
function dpNew() { return { c: {}, w: {}, sig: {}, fields: {}, ex: [] }; }
function dpAdd(D, keys = [], wires = []) {
  for (const k of keys) {
    if (D.c[k]) continue;
    const [name, x, y, w, h, col] = COMP[k];
    const m = cube(name, col, [w, h, 0.5], x, y, 0);
    if (w < 0.5) small(m.userData.lbl, 9); else if (w < 1.1) small(m.userData.lbl, 10);
    D.c[k] = m;
  }
  for (const n of wires) { if (D.w[n]) continue; D.w[n] = line(WIRES[n], WCOL); if (n === 'four') D.ex.push(small(tag('4', 'idx', -6.0, 6.2), 10)); }
  if (!D.w.spine && wires.some((n) => ['rs', 'rt', 'rd', 'imm'].includes(n))) D.w.spine = line([[-3.3, 2.55], [-3.3, 4.2]], WCOL);
  return D;
}
const dpLit = (D, ks, c = HL) => ks.forEach((k) => D.c[k] && glow(D.c[k], c));
const wOn = (D, ns, c = WON) => ns.forEach((n) => D.w[n] && D.w[n].material.color.set(c));
function dpOff(D) { wiresOff(D); }
// a small control-signal flag next to a mux: name = value
function flag(D, s, v, x, y) { if (D.sig[s]) remove(D.sig[s]); const l = small(tag(s + ' = ' + v, v === 1 || v === '1' ? 'ptr alt' : 'idx', x, y), 10); D.sig[s] = l; return l; }

// ════════ Ml6xpYl_tns（第 14A 講：floating point 乘法、highlights、single-cycle 開場） ════════
scene('cpu-fpmul', '14A：Floating point 乘法的步驟與 bias', [
  async (tok, S) => {   // 1 floating point 乘法：表示法不同
    cap('Floating point 乘法', '表示法和 integer 不同，做法也不同');
    hd('IEEE 754 single precision', -3.4, 7.1);
    S.bar = fmtBar([['S', 1, CC.pink], ['exponent', 8, CC.orange], ['fraction（mantissa）', 23, CC.blue]], -6.2, 6.2, 12.4);
    S.n = sm('1 + 8 + 23 = ' + (1 + 8 + 23) + ' bits', 4.4, 7.1);
  },
  async (tok, S) => {   // 2 sign / exponent / mantissa
    cap('三個欄位：sign、exponent、mantissa', '同樣 32 bits，解釋方法和 two\'s complement 完全不同');
    S.bar.filter((m) => m.isMesh).forEach((m) => glow(m, HL));
    S.f = mt('value = (−1)^S × 1.fraction × 2^(exponent − bias)', 0, 5.0, 13, 'ptr alt');
  },
  async (tok, S) => {   // 3 先用科學記號想
    S.bar.filter((m) => m.isMesh).forEach((m) => glow(m, null));
    cap('先不管電腦：用科學記號想', '兩個數相乘要怎麼做？');
    S.a = mt('(a × 10^x) × (b × 10^y)', -2.6, 3.8, 15);
  },
  async (tok, S) => {   // 4 mantissa 相乘、exponent 相加
    cap('mantissa 相乘，exponent（次方）相加', '國中就學過的規則');
    S.b = mt('= (a × b) × 10^(x + y)', 2.9, 3.8, 15, 'ptr alt');
    const v = 2.0e3 * 3.0e2;
    S.c = ok(v === 6.0e5, '示意：(2.0×10³) × (3.0×10²) = 6.0×10⁵', -2.6, 2.9);
  },
  async (tok, S) => {   // 5 乘完不是 normalized → normalize
    cap('乘出來不是 normalized form → 要 normalize', '小數點前只能有一位非零數字');
    const v = 5.0e3 * 4.0e2;
    S.d = ok(v === 2.0e6, '示意：(5.0×10³)×(4.0×10²) = 20.0×10⁵ → 2.0×10⁶', -1.6, 2.2);
  },
  async (tok, S) => {   // 6 biased representation
    gone(S.a, S.b, S.c, S.d, S.f);
    cap('電腦裡的 exponent 用 biased representation', '存的是「真正的 exponent + bias」');
    S.e = mt('stored exponent = E + bias        （single precision：bias = 127）', 0, 5.0, 12, 'note');
  },
  async (tok, S) => {   // 7 老師的例子：7 與 −3，bias 8
    cap('老師的例子：exponent 7 和 −3', 'bias = 8（4 bits 的 exponent）');
    S.t = hd('exponent 用 4 bits、bias 8（老師的小例子）', -2.0, 4.1);
    S.r1 = pl('7  → 7 + 8 = ' + (7 + 8) + ' →', -4.6, 3.2); S.b1 = bitRow(toB(7 + 8, 4), -1.9, 3.2, 0.5, CC.orange, CC.peach);
    S.r2 = pl('−3 → −3 + 8 = ' + (-3 + 8) + ' →', -4.6, 2.4); S.b2 = bitRow(toB(-3 + 8, 4), -1.9, 2.4, 0.5, CC.orange, CC.peach);
  },
  async (tok, S) => {   // 8 直接相加：bias 加了兩次
    const sum = (7 + 8) + (-3 + 8);
    cap('直接把兩個 stored exponent 相加 = ' + sum, '真正的 7 + (−3) = 4，應該存 4 + 8 = 12');
    S.s1 = mt('15 + 5 = ' + sum + '  → ' + toB(sum, 5), 2.9, 3.2, 13);
    S.s2 = bad('bias 加了兩次（8 + 8）', 2.9, 2.4);
  },
  async (tok, S) => {   // 9 減掉一個 bias
    const r = (7 + 8) + (-3 + 8) - 8;
    cap('相加之後要減掉一次 bias', r + ' = 4 + 8，回到正確的 biased exponent');
    S.s3 = ok(r === (7 + (-3)) + 8, '20 − 8 = ' + r + ' = 4 + 8 → ' + toB(r, 4), 1.0, 1.5);
  },
  async (tok, S) => {   // 10 mantissa 相乘、normalize、round（可能重複）
    gone(S.e, S.t, S.r1, S.r2, S.b1, S.b2, S.s1, S.s2, S.s3);
    cap('接著 mantissa 相乘 → normalize → round', 'round 完可能又不是 normalized，要再做一次');
    const L = lister(-5.6, 4.8, 0.7);
    S.L = L;
    L('① exponent 相加，再減一次 bias', 'idx');
    L('② mantissa（significand）相乘', 'ptr alt');
    L('③ normalize（必要時調整 exponent）', 'ptr alt');
    L('④ round（round 完可能又要回到 ③）', 'ptr alt');
    S.loop = arrow(V3(3.6, 2.7, 0), V3(3.6, 3.4, 0), 0xc0392b);
    S.lt = fsz(bad('可能重複', 4.6, 3.05), 11);
  },
  async (tok, S) => {   // 11 最後設 sign：sign-magnitude
    cap('最後設定 sign', 'sign 和 magnitude 分開表示：magnitude 相乘，sign 另外補上');
    S.L('⑤ sign = S₁ XOR S₂', 'ptr alt');
    const rows = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => (a ^ b));
    S.x = mt('+×+ = +   +×− = −   −×+ = −   −×− = +', 0.6, 1.1, 12);
    S.xc = ok(rows.join('') === '0110', 'XOR：00→0、01→1、10→1、11→0', 0.6, 0.4);
  },
]);

scene('cpu-fpmulex', '14A：例題 1.000×2⁻¹ × −1.110×2⁻²', [
  async (tok, S) => {   // 1 題目
    cap('例題：4 位的 binary 數相乘', '1.000₂ × 2⁻¹  ×  −1.110₂ × 2⁻²');
    S.a = 1 * 2 ** -1; S.b = -(1 + 0.5 + 0.25) * 2 ** -2;
    mt('A =  1.000₂ × 2⁻¹ = ' + S.a, -2.4, 6.4, 14);
    mt('B = −1.110₂ × 2⁻² = ' + S.b, -2.4, 5.6, 14);
  },
  async (tok, S) => {   // 2 exponent
    const e = -1 + -2, st = (-1 + 127) + (-2 + 127), fix = st - 127;
    cap('exponent：−1 + (−2) = ' + e, '存的時候各加了 127，相加後要減一次 127');
    mt('biased：' + (-1 + 127) + ' + ' + (-2 + 127) + ' = ' + st + '，再 − 127 = ' + fix, -1.6, 4.5, 13);
    ok(fix === e + 127, fix + ' = −3 + 127', 4.6, 4.5);
  },
  async (tok, S) => {   // 3 mantissa 相乘、normalize、round
    const p = (0b1000 * 0b1110).toString(2).padStart(7, '0');   // 3 + 3 fraction bits → 6
    const s = p[0] + '.' + p.slice(1);
    cap('mantissa：1.000 × 1.110 = ' + s, '已經是 1.xxx（normalized），round 到 4 位：1.110');
    mt('1.000 × 1.110 = ' + s, -2.4, 3.4, 14);
    ok(p[0] === '1' && s.slice(0, 5) === '1.110', 'normalized，不用調整；round → 1.110', 3.3, 3.4);
  },
  async (tok, S) => {   // 4 sign → 結果
    const r = -(1 + 0.5 + 0.25) * 2 ** -3;
    cap('sign：+ × − = −', '結果：−1.110₂ × 2⁻³ = ' + r);
    mt('A × B = −1.110₂ × 2⁻³ = ' + r, -1.4, 2.2, 15, 'ptr alt');
    ok(r === S.a * S.b, '直接算 ' + S.a + ' × (' + S.b + ') = ' + S.a * S.b, -1.4, 1.3);
  },
]);

scene('cpu-cop1', '14A：Floating point 在 Coprocessor 1', [
  async (tok, S) => {   // 1 主 CPU
    cap('先看主 CPU：integer 的部分', 'ALU、乘法、除法都是給整數用的');
    board('CPU（integer）', -3.4, 3.8, 5.4, 5.0);
    S.reg = bx('Registers $0–$31', CC.purple, -3.4, 5.2, 3.6, 0.7);
    S.alu = bx('ALU', CC.orange, -4.4, 3.8, 1.6, 0.7);
    S.md = bx('Mult / Div', CC.orange, -2.3, 3.8, 1.8, 0.7);
    S.mem = bx('Memory', CC.green, 0, -0.1, 6.0, 0.6);
  },
  async (tok, S) => {   // 2 Coprocessor 1
    cap('floating point 很複雜：交給另一個 processor', '叫做 Coprocessor 1');
    board('Coprocessor 1（floating point）', 3.4, 3.8, 5.4, 5.0, CC.mint);
    S.p = prop('cpu', 3.4, 1.7, 0.4, 0.8);
  },
  async (tok, S) => {   // 3 早期沒有 FP 硬體
    cap('最早的 x86 沒有 floating point 硬體', '用 software 拿整數運算慢慢模擬；後來才加上 coprocessor 加速');
    S.n = fsz(note('早期：software 用 integer 指令模擬', -3.4, 1.7), 11);
  },
  async (tok, S) => {   // 4 自己的 register file 與運算單元
    gone(S.n);
    cap('Coprocessor 1 有自己的 register file 和運算單元', '');
    S.fr = []; for (let i = 0; i < 8; i++) S.fr.push(bx('$f' + i, CC.teal, 1.25 + (i % 4) * 1.42, 5.5 - Math.floor(i / 4) * 0.7, 1.3, 0.55));
    S.fe = sm('… $f31', 5.9, 4.4);
    S.fa = bx('FP add / mul / div', CC.orange, 3.4, 3.5, 3.6, 0.7);
  },
  async (tok, S) => {   // 5 不同的指令 add.s / add.d
    cap('所以要不同的指令', '.s = single precision、.d = double precision');
    S.c = code(['add.s $f2, $f4, $f6   # single', 'add.d $f2, $f4, $f6   # double', 'add   $t0, $t1, $t2   # integer'], -2.0, 2.4, 0.5);
    S.c.hl(0);
  },
  async (tok, S) => {   // 6 register 名字 $f0、$f1
    cap('寫 $f0、$f1… 就是 Coprocessor 1 的 register', '$t0 這種名字是主 CPU 的 register');
    S.fr.forEach((m) => glow(m, HL)); S.c.hl(2);
  },
  async (tok, S) => {   // 7 double：一對 register
    S.fr.forEach((m) => glow(m, null));
    cap('double precision 用一對 register', '$f0 + $f1 當一個 64 bits、$f2 + $f3 當一個…');
    [0, 1].forEach((i) => glow(S.fr[i], HL)); [2, 3].forEach((i) => glow(S.fr[i], OKG));
    S.c.hl(1);
    S.pr = fsz(hot('64 bits = 2 × 32', 3.4, 6.35), 11);
  },
  async (tok, S) => {   // 8 lwc1 / swc1
    S.c.kill(); gone(S.pr);
    cap('load / store 也要分：lwc1、swc1', '不寫 c1 就是主 CPU 的 lw / sw');
    S.c2 = code(['lwc1 $f0, 0($sp)   # Memory → $f0', 'swc1 $f0, 4($sp)   # $f0 → Memory'], -2.0, 2.4, 0.5);
    S.c2.hl(0);
    const m = await flow(tok, [[1.0, 0.3], [1.25, 4.8]], 'data', CC.green, 900);
    kill(m);
  },
  async (tok, S) => {   // 9 mfc1 / mtc1：主 CPU ↔ coprocessor
    S.c2.kill();
    cap('想把資料搬回主 CPU 運算：move 指令', 'mfc1 從 Coprocessor 1 搬出、mtc1 搬進去');
    S.c3 = code(['mfc1 $t0, $f0   # $f0 → $t0', 'mtc1 $t0, $f0   # $t0 → $f0'], -2.0, 2.4, 0.5);
    S.c3.hl(0);
    const m = await flow(tok, [[1.25, 5.5], [0, 6.4], [-3.4, 5.6]], 'bits', CC.teal, 1000);
    kill(m);
  },
]);

scene('cpu-fpfall', '14A：同一串 bits 的不同解釋、範圍有限、associativity', [
  async (tok, S) => {   // 1 當 integer
    S.u = 0x8C080004;
    S.bits = (S.u >>> 0).toString(2).padStart(32, '0');
    cap('同樣 32 bits：當作 two\'s complement integer', '= ' + (S.u | 0));
    S.row = bitRow(S.bits, -5.5, 6.4, 0.355, CC.blue, CC.sky, 9);
    S.l1 = mt('integer：' + (S.u | 0), -5.6, 5.5, 13); S.l1.center && S.l1.center.set(0, 0.5);
  },
  async (tok, S) => {   // 2 當 instruction
    const op = S.u >>> 26, rs = (S.u >>> 21) & 31, rt = (S.u >>> 16) & 31, imm = S.u & 0xffff;
    cap('當 instruction：前 6 bits 是 opcode', 'op ' + op + '、rs ' + rs + '、rt ' + rt + '、imm ' + imm);
    S.l2 = mt('instruction：lw $t0, ' + imm + '($zero)', -5.6, 4.8, 13); S.l2.center && S.l2.center.set(0, 0.5);
    S.k2 = ok(op === 35 && rs === 0 && rt === 8, 'op = ' + op + '（lw）、rt = ' + rt + '（$t0）', 2.6, 4.8);
  },
  async (tok, S) => {   // 3 當 floating point
    const f = u2f(S.u), e = (S.u >>> 23) & 255;
    cap('同樣 32 bits 當 floating point', 'sign 1、exponent ' + e + ' → 2^(' + e + '−127)');
    S.l3 = mt('floating point：' + f.toExponential(4), -5.6, 4.1, 13); S.l3.center && S.l3.center.set(0, 0.5);
    S.k3 = ok(f < 0 && Math.abs(f) < 1e-30, 'sign = 1、exponent = ' + e + ' → 很小的負數', 2.6, 4.1);
    S.row.forEach((m, i) => tint(m, i === 0 ? CC.pink : i < 9 ? CC.orange : (S.bits[i] === '1' ? CC.blue : CC.sky)));
  },
  async (tok, S) => {   // 4 解釋不同 → hardware 不同
    cap('解釋不同，做「加法」的 hardware 就不同', 'integer：carry-lookahead adder；floating point：一大串步驟');
    S.h1 = bx('integer add：carry-lookahead adder', CC.orange, -3.2, 2.7, 5.0, 0.7);
    S.h2 = bx('FP add：對齊 exponent → 加 → normalize → round', CC.orange, 2.6, 2.4, 5.4, 1.3);
  },
  async (tok, S) => {   // 5 information 的意義看你怎麼解釋
    cap('資訊的意義看你怎麼解釋', '依照解釋來設計 hardware');
    S.h5 = hot('bits 本身沒有意義：解釋 → 決定 hardware', 0, 1.3);
  },
  async (tok, S) => {   // 6 finite range 與 precision
    gone(S.row, S.l1, S.l2, S.l3, S.k2, S.k3, S.h1, S.h2, S.h5);
    cap('不管怎麼表示，range 和 precision 都有限', 'bits 數有限：32 不夠換 64，64 還是有極限');
    S.b32 = bx('32 bits', CC.sky, -3.0, 6.3, 3.2, 0.5); S.b64 = bx('64 bits', CC.blue, 1.6, 6.3, 6.4, 0.5);
    S.fin = bad('都有限：finite range、finite precision', 0, 5.5);
  },
  async (tok, S) => {   // 7 associativity：x y z
    cap('associativity 要小心', 'x = −1.5×10³⁸、y = 1.5×10³⁸、z = 1.0');
    S.x = f32(-1.5e38); S.y = f32(1.5e38); S.z = f32(1.0);
    S.vx = bx('x = −1.5×10³⁸', CC.pink, -4.2, 4.3, 2.8, 0.6); S.vy = bx('y = 1.5×10³⁸', CC.blue, -0.6, 4.3, 2.8, 0.6); S.vz = bx('z = 1.0', CC.green, 2.8, 4.3, 1.6, 0.6);
  },
  async (tok, S) => {   // 8 (x + y) + z
    const xy = f32(S.x + S.y); S.r1 = f32(xy + S.z);
    cap('先算 x + y：一正一負抵消 = ' + xy, '再加 z → ' + S.r1);
    S.e1 = mt('(x + y) + z = ' + xy.toFixed(1) + ' + 1.0 = ' + S.r1.toFixed(1), -1.0, 3.2, 14);
    S.k1 = ok(S.r1 === 1, '= 1.0', 4.4, 3.2);
  },
  async (tok, S) => {   // 9 y + z：1.0 被吃掉
    const yz = f32(S.y + S.z);
    cap('換個順序：先算 y + z', 'y 已經非常大，加 1.0 根本表示不出來');
    S.e2 = mt('y + z = 1.5×10³⁸（1.0 消失）', -1.0, 2.3, 14);
    S.k2 = ok(yz === S.y, 'f32(y + 1) === y', 4.4, 2.3);
  },
  async (tok, S) => {   // 10 x + (y + z) = 0
    S.r2 = f32(S.x + f32(S.y + S.z));
    cap('再跟 x 相加 → ' + S.r2.toFixed(1), '同樣三個數，答案變成 0');
    S.e3 = mt('x + (y + z) = ' + S.r2.toFixed(1), -1.0, 1.4, 14);
  },
  async (tok, S) => {   // 11 兩個答案不一樣：precision 有限
    cap('兩個答案不一樣：1.0 vs 0.0', '因為能表示的 range、precision 有限');
    S.k3 = ok(S.r1 !== S.r2, '(x+y)+z = ' + S.r1.toFixed(1) + ' ≠ x+(y+z) = ' + S.r2.toFixed(1), 0, 0.5);
  },
  async (tok, S) => {   // 12 parallel programming
    gone(S.vx, S.vy, S.vz, S.e1, S.e2, S.e3, S.k1, S.k2);
    cap('parallel programming 也會遇到', '誰先加、誰後加看 process 怎麼分配 → 結果可能不同');
    S.ps = [-3.6, -1.2, 1.2, 3.6].map((x, i) => buddy('P' + (i + 1), '+', [CC.blue, CC.green, CC.orange, CC.purple][i], x, 2.6, 0, 0.8));
    S.ps.forEach((b) => b.mood('wow'));
  },
]);

scene('cpu-shift', '14A：乘除 2 的次方用 shift、sign extension', [
  async (tok, S) => {   // 1 乘 2^i → shift
    const a = 5, r = a << 2;
    cap('乘除 2 的次方：不要真的做乘除，用 shift', '示意：5 × 4 = 5 << 2');
    S.a = bitRow(toB(a, 8), -4.4, 6.0, 0.5); pl('5', -5.2, 6.0);
    S.b = bitRow(toB(r, 8), -4.4, 5.0, 0.5, CC.green, CC.mint); pl('<< 2', -5.4, 5.0);
    ok(r === a * 4, '示意：' + toB(a, 8) + ' << 2 = ' + toB(r, 8) + ' = ' + r, 2.9, 5.5);
  },
  async (tok, S) => {   // 2 乘除很慢，barrel shifter 一個 cycle
    cap('乘、除要很多 iteration，很花 hardware 和時間', 'barrel shifter 一個 clock cycle 就做完');
    bx('multiplier：一個 bit 一個 iteration…', CC.orange, -3.0, 3.6, 5.0, 0.7);
    bx('barrel shifter：1 cycle', CC.green, 3.3, 3.6, 3.4, 0.7);
  },
  async (tok, S) => {   // 3 有 sign 的 shift
    const v = -8, ar = v >> 1, lg = (fromU(toB(v, 8)) >>> 1);
    cap('shift 也分 signed 和 unsigned', '示意：−8 往右 shift 1（÷2），要補 sign bit');
    pl('−8', -5.3, 2.4); bitRow(toB(v, 8), -4.4, 2.4, 0.5);
    pl('補 1', -5.3, 1.5); bitRow(toB(ar, 8), -4.4, 1.5, 0.5, CC.green, CC.mint);
    ok(ar === -4, '= ' + ar + '（−8 ÷ 2）', 1.6, 1.5);
    pl('補 0', -5.3, 0.6); bitRow(toB(lg, 8), -4.4, 0.6, 0.5, CC.red, CC.peach);
    bad('= ' + lg + '（錯）', 1.6, 0.6);
  },
  async (tok, S) => {   // 4 sign extension
    const four = '1010', eight = toB(fromS(four), 8);
    cap('sign extension：4 bits 變 8 bits，表示同一個數', '負數前面補 1、正數補 0');
    pl('4 bits', 3.3, 2.4); bitRow(four, 4.2, 2.4, 0.42, CC.purple, CC.lilac);
    pl('8 bits', 3.3, 1.5);
    bitRow(eight, 3.7, 0.9, 0.36, CC.purple, CC.lilac);
    ok(fromS(four) === fromS(eight), fromS(four) + ' = ' + fromS(eight), 5.0, 0.2);
  },
]);

scene('cpu-common', '14A：結語：解釋決定 hardware、make the common case fast', [
  async (tok, S) => {   // 1 結語
    cap('本章結語：bits 的意義看你怎麼解釋', '解釋好之後，再設計加、減、乘、除的 hardware');
    const L = lister(-5.8, 6.6, 0.7); S.L = L;
    L('• 同一串 bits：integer、floating point、instruction…', 'ptr');
  },
  async (tok, S) => {   // 2 range precision 有限
    cap('不管用哪種表示：range、precision 都有限', '');
    S.L('• range 與 precision 都是有限的', 'ptr');
  },
  async (tok, S) => {   // 3 常用的只有少數指令
    cap('設計了很多 instructions，常用的只有一小部分', '老師引述投影片：常用的約 54 個');
    S.L.skip(0.4);
    S.big = bx('常用 instructions ≈ 54 個（投影片）', CC.gold, -1.5, 3.4, 6.0, 0.8);
  },
  async (tok, S) => {   // 4 SPEC 的覆蓋率
    cap('用 SPEC benchmark 測：這些常用指令就幾乎全部涵蓋', '老師說：SPEC int 100%、SPEC fp 97%');
    S.b1 = bx('SPEC integer：100%', CC.blue, -3.2, 2.2, 3.6, 0.55); S.b2 = bx('SPEC floating point：97%', CC.teal, 1.4, 2.2, 4.4, 0.55);
  },
  async (tok, S) => {   // 5 trade-off：便宜的設計用 software 模擬
    cap('trade-off：做便宜的 processor', '不常用的指令乾脆不做，用 software emulate');
    S.c1 = note('便宜的設計：rare 指令 → software emulate', -2.0, 1.2);
  },
  async (tok, S) => {   // 6 make the common case fast
    cap('Make the common case fast', '同樣的代價，加速最常用的指令，整體跑得最快');
    glow(S.big, HL);
    S.c2 = hot('Make the common case fast', 2.6, 0.4);
  },
  async (tok, S) => {   // 7 研究例子：小 decoder
    cap('研究例子：常用的部分給一個小而快的 decoder', '不常用的給大的、省電的 decoder');
    S.d1 = bx('小 decoder（常用）', CC.green, -3.2, -0.6, 3.2, 0.55); S.d2 = bx('大 decoder（少用、省電）', CC.gray, 1.6, -0.6, 4.0, 0.55);
  },
]);

scene('cpu-intro', '14A：設計 processor：single cycle 先、pipeline 後', [
  async (tok, S) => {   // 1 這章的位置
    cap('這一章：怎麼設計一個 processor 的 hardware', '前面學了 ISA 的 trade-off、arithmetic components');
    S.a = bx('Instruction set design', CC.blue, -4.4, 5.6, 3.2, 0.7); S.b = bx('Arithmetic components', CC.orange, -0.6, 5.6, 3.4, 0.7); S.c = bx('設計 Processor', CC.green, 3.4, 5.6, 3.0, 0.7);
    glow(S.c, HL);
  },
  async (tok, S) => {   // 2 只做幾個指令，可以類推
    cap('只設計幾個 instruction', '基本技巧學會了，可以依此類推設計整個 processor');
    S.n = note('幾個代表指令 → 依此類推', 3.4, 4.6);
  },
  async (tok, S) => {   // 3 single cycle：一個指令一個 cycle
    cap('Single cycle：每個 instruction 一個 cycle 做完', '');
    S.cy = [0, 1, 2, 3].map((i) => bx('cycle ' + (i + 1), CC.sky, -4.5 + i * 3.0, 3.2, 2.9, 0.6));
    S.in = ['lw', 'add', 'beq', 'sw'].map((t, i) => sm(t, -4.5 + i * 3.0, 2.5));
  },
  async (tok, S) => {   // 4 lw / sw 很長 → cycle 要拉長
    cap('lw / sw 要去 memory 拿東西，時間很長', 'cycle 要等最慢的指令 → 不切實際');
    const need = [1.0, 0.75, 0.6, 0.9];
    S.use = need.map((f, i) => { const w = 2.9 * f; return bx('', i === 0 ? CC.orange : CC.green, -4.5 + i * 3.0 - 1.45 + w / 2, 3.2, w, 0.3, 0.7, 0.2); });
    S.w = bad('短的指令也要等滿整個 cycle：浪費', 0, 1.7);
  },
  async (tok, S) => {   // 5 下一章 pipeline
    cap('下一章：pipeline', '把指令切成一階一階的 stage');
    S.pp = [0, 1, 2, 3, 4].map((i) => bx(['IF', 'ID', 'EX', 'MEM', 'WB'][i], [CC.blue, CC.purple, CC.orange, CC.green, CC.pink][i], -3.0 + i * 1.5, 0.6, 1.4, 0.55));
  },
  async (tok, S) => {   // 6 讀圖方法：每條線
    cap('讀這一章的方法：每一條線從哪裡來、代表什麼', '搞懂每條線的原因，就不用背');
    S.k = hot('每個 component、每一條線：從哪來？代表什麼？', 0, -0.5);
  },
]);

scene('cpu-perf', '14A：CPU time = IC × CPI × cycle time', [
  async (tok, S) => {   // 1 fetch → decode → execute 迴圈
    cap('general-purpose processor：一直重複同一件事', 'fetch 一個 instruction → decode → execute → 再 fetch');
    const pos = [[-3.0, 5.6], [3.0, 5.6], [0, 3.6]];
    S.st = ['Fetch', 'Decode', 'Execute'].map((t, i) => bx(t, [CC.blue, CC.purple, CC.orange][i], pos[i][0], pos[i][1], 2.2, 0.7));
    const m = await flow(tok, [[-3.0, 5.6], [3.0, 5.6], [0, 3.6], [-3.0, 5.6]], 'instr', CC.gold, 1800);
    kill(m);
  },
  async (tok, S) => {   // 2 performance 公式
    cap('performance：三個東西相乘', 'instruction count × CPI × clock cycle time');
    S.f = mt('CPU time = Instruction count × CPI × Cycle time', 0, 2.2, 15, 'ptr alt');
  },
  async (tok, S) => {   // 3 IC ← ISA、compiler
    cap('instruction count 由誰決定？', 'instruction set 有哪些指令、compiler 聰不聰明');
    S.a = note('IC ← instruction set、compiler', -3.6, 1.2);
  },
  async (tok, S) => {   // 4 CPI、cycle time ← hardware
    cap('CPI 和 cycle time：由 hardware 決定', '例如加法器設計得快或簡單，要的 cycle 不一樣');
    S.b = note('CPI、cycle time ← hardware（datapath 怎麼設計）', 2.6, 0.4);
  },
  async (tok, S) => {   // 5 single cycle：CPI = 1
    const n = 100, cyc = n * 1;
    cap('single cycle：一個指令一個 cycle，CPI = 1', '示意：100 個 instructions → ' + cyc + ' 個 cycles');
    S.c = ok(cyc === 100, '示意：100 instructions × CPI 1 = ' + cyc + ' cycles', -2.4, -0.5);
  },
  async (tok, S) => {   // 6 但 clock period 要等最長的
    cap('但 clock period 很長', '一定要等最長的那個 instruction 做完，clock 才能變');
    S.d = bad('clock period = 最長的 instruction → 不 efficient', 2.4, -1.2);
  },
  async (tok, S) => {   // 7 兩個版本
    cap('會講兩個版本', 'simplified version（single cycle）和 pipeline version');
    S.v = [bx('① single cycle（簡化版）', CC.sky, -3.0, 7.0, 3.8, 0.55), bx('② pipeline（真正在用的）', CC.green, 2.0, 7.0, 3.8, 0.55)];
  },
]);

scene('cpu-subset', '14A：要實作的 MIPS 指令與三種 format', [
  async (tok, S) => {   // 1 要做的指令很少
    cap('我們要實作的指令其實很少', '但幾乎包含所有大類');
    S.h = hd('MIPS 子集', -5.0, 7.0);
  },
  async (tok, S) => {   // 2 memory reference
    cap('memory reference：lw、sw', '和 memory 溝通');
    S.m = bx('lw   sw', CC.green, -4.0, 6.0, 2.6, 0.6); sm('memory', -4.0, 5.4);
  },
  async (tok, S) => {   // 3 arithmetic-logical
    cap('arithmetic-logical：add、sub、and、or、slt', '都是 R-type');
    S.r = bx('add sub and or slt', CC.orange, 0, 6.0, 4.0, 0.6); sm('運算（R-type）', 0, 5.4);
  },
  async (tok, S) => {   // 4 control
    cap('control：beq（或 bne）、j', '改變執行的順序');
    S.c = bx('beq  (bne)  j', CC.purple, 4.2, 6.0, 2.8, 0.6); sm('control flow', 4.2, 5.4);
  },
  async (tok, S) => {   // 5 包含所有大類
    cap('雖然只有這幾個，已經包含各大類別', 'memory、運算、改變 control sequence');
    [S.m, S.r, S.c].forEach((m) => glow(m, HL));
  },
  async (tok, S) => {   // 6 三種 format
    [S.m, S.r, S.c].forEach((m) => glow(m, null));
    cap('MIPS 只有三種 instruction format', 'R-type、I-type、J-type');
    const R = [['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]];
    const I = [['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['immediate', 16, CC.teal]];
    const J = [['op', 6, CC.gray], ['target address', 26, CC.gold]];
    [[R, 'R', 4.2], [I, 'I', 2.9], [J, 'J', 1.6]].forEach(([f, n, y]) => { pl(n, -5.8, y); const b = fmtBar(f, -5.3, y, 10.6, 0.5); sm('= ' + b.tot, 5.8, y); });
    S.k = ok([R, I, J].every((f) => f.reduce((s, x) => s + x[1], 0) === 32), '三種都是 32 bits', 3.6, 0.6);
  },
  async (tok, S) => {   // 7 format 越少越好
    cap('一種 format 最簡單，不得已才 compromise 成三種', 'format 越少、越一致，hardware 越簡單');
    S.n = note('format 越少、越一致 → 設計越簡單', -2.4, 0.0);
  },
]);

scene('cpu-exec', '14A：一個 instruction 怎麼執行：PC → fetch → decode → …', [
  async (tok, S) => {   // 1 instruction fetch：去哪裡拿？
    cap('執行第一步：instruction fetch', '要去哪裡拿 instruction？');
    S.im = bx('Instruction Memory', CC.blue, -1.6, 5.2, 2.6, 1.6);
  },
  async (tok, S) => {   // 2 Program Counter
    cap('Program Counter（PC）告訴你去第幾個位置拿', '');
    S.pc = bx('PC', CC.gold, -5.0, 5.2, 1.0, 0.9); S.pv = mt('1000', -5.0, 6.0, 13, 'ptr');
    S.l = line([[-4.5, 5.2], [-2.9, 5.2]], WCOL);
  },
  async (tok, S) => {   // 3 sequential +4、跳的話換成目標
    cap('sequential：下一個就 PC + 4', '要跳：例如從 1000 跳到 2000，PC 就要變成 2000');
    S.n1 = mt('sequential：1000 + 4 = ' + (1000 + 4), -5.6, 3.9, 12); S.n1.center && S.n1.center.set(0, 0.5);
    S.n2 = mt('jump：PC ← 2000', -5.6, 3.3, 12, 'ptr alt'); S.n2.center && S.n2.center.set(0, 0.5);
  },
  async (tok, S) => {   // 4 PC 是 32-bit register → fetch
    cap('PC 是一個 32 bits 的 register', '用它的值去 instruction memory 拿 instruction：這就是 fetch');
    const m = await flow(tok, [[-4.5, 5.2], [-2.9, 5.2]], '1000', CC.gold, 700); kill(m);
    glow(S.im, HL);
  },
  async (tok, S) => {   // 5 decode：同時當 R / I / J 解釋
    glow(S.im, null);
    cap('fetch 來的 32 bits：decode', '不知道是哪一種 type，就同時用 R、I、J 去解釋');
    S.f = [['R', CC.orange], ['I', CC.teal], ['J', CC.gold]].map(([t, c], i) => bx(t + '-type?', c, 1.6, 6.0 - i * 0.7, 1.6, 0.5));
  },
  async (tok, S) => {   // 6 讀 register file
    cap('decode 後去 register file 拿東西', '有的要讀 rs、rt 兩個，有的只要 rs（rt 是 destination）');
    S.rf = bx('Registers', CC.purple, 4.4, 5.2, 1.8, 1.8);
    const m = await flow(tok, [[2.4, 5.2], [3.5, 5.2]], 'rs rt', CC.purple, 700); kill(m);
  },
  async (tok, S) => {   // 7 ALU 運算；lw/sw 去 memory
    cap('依指令做運算：要用 ALU', 'lw / sw 還要 access memory');
    S.alu = bx('ALU', CC.orange, 4.4, 2.6, 1.4, 1.2); S.dm = bx('Data Memory', CC.green, 1.2, 2.6, 2.4, 1.2);
  },
  async (tok, S) => {   // 8 PC 更新
    cap('做完之後更新 PC：PC + 4', 'branch / jump 的 target address 要在過程中就算好');
    S.u = mt('PC ← PC + 4  或  target address', -3.6, 1.6, 13, 'ptr alt');
  },
  async (tok, S) => {   // 9 下一輪
    cap('PC 更新後，下一個 iteration 再 fetch', 'fetch → decode → execute → fetch…');
    S.loop = line([[4.4, 1.8], [4.4, 0.6], [-6.2, 0.6], [-6.2, 5.2], [-5.5, 5.2]], WON);
    const m = await flow(tok, [[4.4, 1.8], [4.4, 0.6], [-6.2, 0.6], [-6.2, 5.2], [-5.5, 5.2]], '1004', CC.gold, 1400); kill(m);
    txt(S.pv, '1004');
  },
]);

scene('cpu-overview', '14A：datapath 概觀：共用的路要靠 mux', [
  async (tok, S) => {   // 1 PC 放位址
    S.D = dpAdd(dpNew(), ['PC', 'IM'], ['pc_im']);
    cap('概觀：Program Counter 放 32 bits 的位址', '例如 1000：就到 instruction memory 的 1000 拿');
    const m = await flow(tok, WIRES.pc_im, '1000', CC.gold, 700); kill(m);
  },
  async (tok, S) => {   // 2 跳到 10000
    cap('如果要跳到 10000', 'PC 就放 10000，下一個就去 10000 拿');
    S.j = small(hot('PC = 10000（跳）', -6.3, 4.3), 10);
  },
  async (tok, S) => {   // 3 拿出來 32 bits
    gone(S.j);
    dpAdd(S.D, [], ['ins']);
    cap('拿出來是 32 bits（圖上只畫一條線）', '前 6 bits 一定是 opcode，後面 rs、rt、rd…');
    const m = await flow(tok, WIRES.ins, '32', CC.blue, 600); kill(m);
  },
  async (tok, S) => {   // 4 rs rt 位置固定 → 直接讀 register
    dpAdd(S.D, ['RF'], ['rs', 'rt']);
    cap('MIPS 的 rs、rt 位置固定', '5 bits 的 register 地址馬上拿出來去讀 register file');
    await Promise.all([along(S.D, tok, ['rs'], 'rs', CC.purple, 700), along(S.D, tok, ['rt'], 'rt', CC.purple, 700)]).then((ms) => ms.forEach(kill));
  },
  async (tok, S) => {   // 5 ALU 運算、R-type 寫回
    dpAdd(S.D, ['ALU'], ['rd1']); cw(S.D, 'rd2A');
    cap('讀出來做 ALU 運算', 'R-type 算完就寫回 register file');
    S.D.w.back = line([[2.7, 3.6], [3.0, 3.6], [3.0, 0.2], [-2.0, 0.2], [-2.0, 2.4], [-1.8, 2.4]], WON);
    const m = await flow(tok, [[2.7, 3.6], [3.0, 3.6], [3.0, 0.2], [-2.0, 0.2], [-2.0, 2.4], [-1.8, 2.4]], 'result', CC.orange, 1300); kill(m);
  },
  async (tok, S) => {   // 6 lw / sw：ALU 算地址 → data memory
    S.D.w.back.material.color.set(WCOL);
    dpAdd(S.D, ['DM'], ['alu_dm']);
    cap('lw / sw：ALU 算的是 memory 地址', '再去 data memory；讀到的東西放回 register');
    const m = await flow(tok, WIRES.alu_dm, 'addr', CC.orange, 600); kill(m);
  },
  async (tok, S) => {   // 7 load-store machine
    cap('MIPS 是 load-store machine', '運算前先 load 到 register，算完再 store 回去：lw / sw 只搬資料');
    S.ls = small(note('load / store 只搬資料，不跟運算混在一起', 3.6, 0.8), 11);
  },
  async (tok, S) => {   // 8 一條路兩個人搶
    gone(S.ls); kill(S.D.w.back); delete S.D.w.back;
    dpAdd(S.D, [], ['alu_m', 'dm_m', 'wb']);
    cap('寫回 register 只有一條路', 'R-type 的 ALU 結果、lw 的 memory 資料都要搶 → 會打架');
    const [a, b] = await Promise.all([flow(tok, WIRES.alu_m, 'ALU', CC.orange, 900), flow(tok, WIRES.dm_m, 'Mem', CC.green, 900)]);
    S.fight = [a, b, bad('撞在一起！', 5.6, 4.3)];
  },
  async (tok, S) => {   // 9 用 multiplexer
    gone(S.fight);
    dpAdd(S.D, ['MUXM']); glow(S.D.c.MUXM, HL);
    cap('在打架的地方放 multiplexer（mux）', '2-to-1、4-to-1 的 mux 決定誰能上這條高速公路');
  },
  async (tok, S) => {   // 10 mux 的 control signal 從 opcode 來
    dpAdd(S.D, ['CTRL'], ['op']);
    cap('mux 一定有 control signal', '從 opcode decode 出來：現在是哪個指令，誰就有優先權');
    S.cs = line([[-1.8, 5.8], [5.7, 5.8], [5.7, 3.65]], CC.blue);
    S.cl = small(hot('control signal', 4.4, 6.1), 10);
  },
  async (tok, S) => {   // 11 完成的圖：很多 mux
    lab.clear(); S.D = buildDP(99, false);
    cap('最後完成的 datapath', '多了很多 mux，每個 mux 都有 control signal 控制');
    ['MUXD', 'MUXA', 'MUXM', 'MUXP'].forEach((k) => glow(S.D.c[k], HL));
  },
], DPC);

scene('cpu-elems', '14A：基本元件：wire、bus、combinational element', [
  async (tok, S) => {   // 1 wire：0 / 1
    cap('最基本的：wire 上的 signal', 'low 是 0，high 是 1');
    S.w = line([[-5.5, 6.0], [-1.5, 6.0]], CC.brown); pl('wire：0 = low、1 = high', -3.5, 6.5);
  },
  async (tok, S) => {   // 2 bus：一條線 + 斜線 = 多個 bits
    cap('data 常常是 32 bits，不會畫 32 條線', '畫一條線加一個斜線：multi-wire bus');
    S.b = line([[1.0, 6.0], [5.5, 6.0]], CC.brown); S.sl = line([[3.1, 5.7], [3.4, 6.3]], CC.brown); pl('32', 3.6, 6.5); pl('bus（32 條 wire）', 3.2, 5.4);
  },
  async (tok, S) => {   // 3 information = 0101 的表示
    cap('這些 0101 是 information', '可能是 two\'s complement number，也可能是 floating point');
    S.i = bitRow('01011010', -2.0, 4.4, 0.5);
  },
  async (tok, S) => {   // 4 combinational element：input 變 output 就變
    cap('Combinational element：例如加法器、ALU', 'input 一改變，output 就跟著變');
    S.add = bx('Adder', CC.orange, 0, 2.6, 1.6, 1.0);
    S.ia = bx('3', CC.sky, -2.4, 3.0, 0.6, 0.45); S.ib = bx('4', CC.sky, -2.4, 2.2, 0.6, 0.45); S.o = bx(String(3 + 4), CC.mint, 2.4, 2.6, 0.7, 0.5);
    await wt(tok, 600);
    relabel(S.ia, 5); relabel(S.o, 5 + 4);
    S.k = ok(5 + 4 === 9, '3 改成 5 → output 馬上變 9', 0, 1.5);
  },
  async (tok, S) => {   // 5 sequential element：存起來
    cap('Sequential element：把東西存起來', '時間切成一個一個 cycle，一次做一件事，做完要存');
    S.r = bx('Register', CC.gold, 4.6, 2.6, 1.6, 1.0);
    const m = await flow(tok, [[2.8, 2.6], [3.8, 2.6]], '9', CC.mint, 600); kill(m); relabel(S.r, 'Register：9');
  },
  async (tok, S) => {   // 6 combinational 有哪些
    cap('combinational：AND、adder、ALU、mux', '這些前面都講過');
    ['AND', 'Adder', 'ALU', 'MUX'].forEach((t, i) => bx(t, [CC.brown, CC.orange, CC.orange, CC.mux][i], -4.5 + i * 3.0, 0.4, 1.6, 0.7));
  },
]);

// clock / data / Q waveforms on a strip
function wave(vals, x0, y, dx, h, color) { const pts = []; vals.forEach((v, i) => { pts.push([x0 + i * dx, y + v * h], [x0 + (i + 1) * dx, y + v * h]); }); return line(pts, color); }
scene('cpu-edge', '14A：edge-triggered 與 write enable', [
  async (tok, S) => {   // 1 clock：一個 period 做一件事
    S.N = 16; S.dx = 0.7; S.x0 = -5.6;
    S.clk = Array.from({ length: S.N }, (_, i) => (i % 2 === 0 ? 0 : 1));
    cap('用 clock 約束：每個 clock period 只做一件事', '做完的東西要存起來，給下一個 period 用');
    S.wc = wave(S.clk, S.x0, 6.0, S.dx, 0.6, CC.brown); pl('clock', -6.4, 6.3);
  },
  async (tok, S) => {   // 2 register：rising edge triggered
    cap('Register 可以存 data', '圖上的 register 是 rising edge trigger');
    S.reg = bx('Register（D → Q）', CC.gold, 0, 1.0, 2.6, 0.8);
  },
  async (tok, S) => {   // 3 level sensitive
    cap('Level sensitive：clock 是 1 的整段時間都可以寫', '不是只有一個瞬間');
    S.lv = S.clk.map((c, i) => (c ? cube('', CC.yel, [S.dx - 0.04, 0.6, 0.05], S.x0 + i * S.dx + S.dx / 2, 6.3, -0.2) : null)).filter(Boolean);
  },
  async (tok, S) => {   // 4 edge triggered：只在 0→1
    gone(S.lv);
    S.edges = []; for (let i = 1; i < S.N; i++) if (S.clk[i - 1] === 0 && S.clk[i] === 1) S.edges.push(i);
    cap('Edge triggered：只有 clock 從 0 變 1 的瞬間才寫', '共 ' + S.edges.length + ' 個 rising edge');
    S.ea = S.edges.map((i) => arrow(V3(S.x0 + i * S.dx, 5.3, 0), V3(S.x0 + i * S.dx, 6.0, 0), 0x0f5a3a));
  },
  async (tok, S) => {   // 5 data 中間亂變沒有用
    S.data = [1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0];
    S.q = []; let cur = 0; for (let i = 0; i < S.N; i++) { if (S.edges.includes(i)) cur = S.data[i]; S.q.push(cur); }
    cap('input（D）一直在變也沒用', 'Q 只在 rising edge 那一刻抓 D 的值');
    S.wd = wave(S.data, S.x0, 4.6, S.dx, 0.6, CC.blue); pl('D', -6.4, 4.9);
    S.wq = wave(S.q, S.x0, 3.2, S.dx, 0.6, CC.green); pl('Q', -6.4, 3.5);
    const chk = S.edges.every((i) => S.q[i] === S.data[i]) && S.q.every((v, i) => i === 0 || S.edges.includes(i) || v === S.q[i - 1]);
    S.k = ok(chk, 'Q 只在 edge 改變', 4.2, 2.6);
  },
  async (tok, S) => {   // 6 為什麼用 edge trigger
    cap('為什麼用 edge trigger？', '避免 racing 之類的 timing 問題');
    S.n = note('edge trigger：避免 racing', -3.6, 2.4);
  },
  async (tok, S) => {   // 7 write enable
    gone(S.n, S.k, S.wq);
    cap('再加一個 write enable：Write', 'clock 在 transition、而且 Write = 1 才寫進去');
    S.wr = [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0];
    S.ww = wave(S.wr, S.x0, 3.2, S.dx, 0.6, CC.pink); pl('Write', -6.4, 3.5);
  },
  async (tok, S) => {   // 8 edge 且 Write = 1 → 寫
    const yes = S.edges.filter((i) => S.wr[i] === 1);
    cap('rising edge 而且 Write = 1：寫進去', '這 ' + yes.length + ' 個 edge 會更新');
    S.y = yes.map((i) => cube('✓', CC.green, [0.4, 0.35, 0.3], S.x0 + i * S.dx, 2.4, 0));
  },
  async (tok, S) => {   // 9 edge 但 Write = 0 → 不寫
    const no = S.edges.filter((i) => S.wr[i] === 0);
    cap('雖然有 rising edge，但 Write = 0', '不寫進去，storage element 不改變');
    S.n2 = no.map((i) => cube('✘', CC.red, [0.4, 0.35, 0.3], S.x0 + i * S.dx, 2.4, 0));
  },
  async (tok, S) => {   // 10 register file 的 input 接到很多人
    cap('後面的 register file、data memory 都需要它', 'input 接到很多人、一直在變，不能每個 clock 都寫');
    relabel(S.reg, 'Register file / Memory');
    S.wl = small(hot('Write（WrEn）', 0, 0.1), 11);
  },
  async (tok, S) => {   // 11 Write 是 control signal
    cap('Write 是 controller 發出的 control signal', '要寫才設 1，不寫就設 0');
    glow(S.reg, HL);
  },
]);

scene('cpu-clockm', '14A：clocking methodology 與 critical path', [
  async (tok, S) => {   // 1 state → combinational → state
    cap('clocking methodology（邏輯設計學過）', 'state element → combinational logic → state element');
    S.s1 = bx('State element 1', CC.gold, -4.4, 4.6, 2.4, 1.0); S.cl = bx('Combinational logic', CC.blue, 0, 4.6, 3.6, 1.2); S.s2 = bx('State element 2', CC.gold, 4.4, 4.6, 2.4, 1.0);
    line([[-3.2, 4.6], [-1.8, 4.6]], WCOL); line([[1.8, 4.6], [3.2, 4.6]], WCOL);
  },
  async (tok, S) => {   // 2 edge：新 data 進來，開始算
    cap('clock transition：新 data 進 state element', 'combinational logic 只要 input 變就開始算');
    glow(S.s1, HL); S.v = await flow(tok, [[-4.4, 4.6], [0, 4.6]], 'data', CC.green, 900); glow(S.cl, HL);
  },
  async (tok, S) => {   // 3 path delay
    cap('經過 AND gate、OR gate… 要時間：path delay', '算完才會到 output');
    S.g = [['AND', 2], ['OR', 1.5], ['AND', 2.5]].map(([t, d], i) => bx(t + ' ' + d, CC.brown, -1.2 + i * 1.2, 3.4, 1.1, 0.45));
    S.gs = sm('示意 delay', 0, 2.8);
  },
  async (tok, S) => {   // 4 delay < clock period
    cap('這段 delay 一定要小於 clock period', '太長的話 clock 已經 transition 了，latch 到錯的 data');
    kill(S.v); S.v = await flow(tok, [[0, 4.6], [4.4, 4.6]], 'data', CC.green, 800); glow(S.s2, HL);
    S.r = mt('combinational delay < clock period', 0, 1.9, 13, 'ptr alt');
  },
  async (tok, S) => {   // 5 critical path
    const paths = [3, 5.5, 2], crit = Math.max(...paths);
    cap('input 走的路不一樣，有快有慢', '要用最長的那條：critical path，決定 clock period');
    S.p = paths.map((d, i) => { const b = bx('path ' + (i + 1) + '：' + d + ' ns', d === crit ? CC.red : CC.sky, -5.6 + d * 0.9 / 2 + 0.6, 1.0 - i * 0.6, d * 0.9, 0.42); return b; });
    S.k = ok(crit === 5.5, '示意：critical path = max(3, 5.5, 2) = ' + crit + ' ns → clock period ≥ ' + crit + ' ns', 2.6, 0.4);
  },
  async (tok, S) => {   // 6 同一個 state element 也可以
    cap('起點和終點也可以是同一個 state element', '每個 clock 來，state element 就換成新的值');
    S.loop = line([[4.4, 5.1], [4.4, 6.2], [-4.4, 6.2], [-4.4, 5.1]], CC.orange);
  },
]);

scene('cpu-steps', '14A：設計 processor 的五個步驟', [
  async (tok, S) => {   // 1 分析 instruction set
    cap('步驟 1：分析 instruction set', '像炒菜：要先知道要炒什麼菜');
    S.L = lister(-5.8, 6.4, 0.85);
    S.L('① Analyze instruction set', 'ptr alt', 14);
    S.ch = buddy('你', '🍳', CC.peach, 5.0, 3.6, 0, 0.9); S.ch.mood('wow');
  },
  async (tok, S) => {   // 2 format、要做什麼
    cap('除了知道有哪些指令，還要知道 format', 'decode 的時候才知道 32 bits 怎麼解釋、要做什麼運算');
    S.L('   → format（R / I / J）、每個指令要做什麼', 'idx');
  },
  async (tok, S) => {   // 3 選元件、組 datapath
    cap('步驟 2、3：選 datapath components，組起來', '一個 instruction 一個 instruction 接');
    S.L('② Select datapath components', 'ptr alt', 14); S.L('③ Assemble datapath', 'ptr alt', 14);
  },
  async (tok, S) => {   // 4 共同的部分合併
    cap('很多共同的地方：合併成一個 datapath', '同一個 datapath 能做不同的指令 → 靠 control');
    S.ch.mood('happy');
  },
  async (tok, S) => {   // 5 control
    cap('步驟 4、5：control', '下一節繼續');
    S.L('④ 決定每個指令的 control signals', 'ptr alt', 14); S.L('⑤ Assemble control logic', 'ptr alt', 14);
  },
]);

// ════════ YvSSt6kQbuk（第 14B 講：分析指令、RTL、datapath 元件、fetch／R-type／load-store datapath） ════════
// wires drawn before the muxes exist (the lecture adds the muxes in 15A)
const CW = {
  rdW: [[-3.3, 2.55], [-1.8, 2.55]],
  rtW: [[-2.9, 3.6], [-2.9, 2.55], [-1.8, 2.55]],
  rd2A: [[0.0, 3.0], [1.4, 3.0], [1.4, 3.1], [1.7, 3.1]],
  seA: [[-0.4, 1.0], [1.4, 1.0], [1.4, 3.1], [1.7, 3.1]],
  wbA: [[2.7, 3.6], [3.0, 3.6], [3.0, 0.2], [-2.0, 0.2], [-2.0, 2.3], [-1.8, 2.3]],
  wbM: [[5.0, 3.45], [5.5, 3.45], [5.5, 0.2], [-2.0, 0.2], [-2.0, 2.3], [-1.8, 2.3]],
};
const cw = (D, n, c = WCOL) => { if (!D.w[n]) D.w[n] = line(CW[n], c); return D.w[n]; };
async function go1(D, tok, pts, text, color, ms, lightKey) { if (lightKey && D.w[lightKey]) D.w[lightKey].material.color.set(WON); const m = await flow(tok, pts, text, color, ms); return m; }
// port names around the register file
function rfPorts(D) { D.ex.push(small(tag('RA', 'idx', -1.55, 4.42), 9), small(tag('RB', 'idx', -1.55, 3.82), 9), small(tag('RW', 'idx', -1.55, 2.77), 9), small(tag('busW', 'idx', -1.4, 2.08), 9), small(tag('busA', 'idx', 0.35, 4.35), 9), small(tag('busB', 'idx', 0.35, 3.25), 9)); }

scene('cpu-steps2', '14B：今天做前三步：分析指令、選元件、組 datapath', [
  async (tok, S) => {   // 1 五個步驟
    cap('設計 processor：先分析 instruction', '再選 datapath component、把它們 assemble 起來');
    S.L = lister(-5.6, 6.2, 0.8);
    S.a = [S.L('① Analyze instruction set', 'ptr alt', 14), S.L('② Select datapath components', 'ptr alt', 14), S.L('③ Assemble datapath', 'ptr alt', 14)];
  },
  async (tok, S) => {   // 2 四、五是 control
    cap('④⑤ 是 control 的部分', '每個指令決定 control signal，再合成 control logic');
    S.b = [S.L('④ 決定每個指令的 control signals', 'idx', 14), S.L('⑤ Assemble control logic', 'idx', 14)];
  },
  async (tok, S) => {   // 3 今天著重前三個
    cap('今天著重前三個', '分析 instruction、把 datapath 找出來');
    S.a.forEach((l) => setc(l, 'ptr alt')); S.b.forEach((l) => setc(l, 'idx'));
    S.k = hot('今天：① ② ③', 3.8, 3.6);
  },
]);

scene('cpu-formats', '14B：複習 R／I／J format：每個欄位做什麼', [
  async (tok, S) => {   // 1 三種 type
    cap('Step 1：分析 instruction', '複習三種 type：R-type、I-type、J-type');
    pl('R', -6.2, 6.4); S.R = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]], -5.8, 6.4, 11.4, 0.55);
    pl('I', -6.2, 4.6); S.I = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['immediate', 16, CC.teal]], -5.8, 4.6, 11.4, 0.55);
    pl('J', -6.2, 2.8); S.J = fmtBar([['op', 6, CC.gray], ['target address', 26, CC.gold]], -5.8, 2.8, 11.4, 0.55);
  },
  async (tok, S) => {   // 2 R-type 的欄位
    cap('R-type：op 6、rs／rt／rd／shamt 各 5、funct 6', '6 + 5 + 5 + 5 + 5 + 6 = ' + (6 + 5 + 5 + 5 + 5 + 6));
    S.R.filter((m) => m.isMesh).forEach((m) => glow(m, HL));
  },
  async (tok, S) => {   // 3 為什麼 5 bits：32 個 register
    S.R.filter((m) => m.isMesh).forEach((m) => glow(m, null));
    [1, 2, 3].forEach((i) => glow(S.R.filter((m) => m.isMesh)[i], HL));
    cap('rs、rt、rd 為什麼 5 bits？', 'register file 有 32 個 register，地址要 5 bits');
    S.k1 = ok(2 ** 5 === 32, '2⁵ = ' + 2 ** 5 + ' 個 register', -2.4, 7.25);
  },
  async (tok, S) => {   // 4 shamt 5 bits
    S.R.filter((m) => m.isMesh).forEach((m) => glow(m, null)); glow(S.R.filter((m) => m.isMesh)[4], HL);
    cap('shamt = shift amount', '32 bits 最多 shift 0 ～ 31 位：32 種，5 bits 剛好');
    S.k2 = ok(2 ** 5 === 32, 'shift 0～31：32 種 = 2⁵', 2.6, 7.25);
  },
  async (tok, S) => {   // 5 funct
    S.R.filter((m) => m.isMesh).forEach((m) => glow(m, null)); glow(S.R.filter((m) => m.isMesh)[5], HL);
    cap('funct：R-type 的 op 全都是 000000', '加、減…靠後面 6 bits 的 funct 再區分');
    S.k3 = mt('op 000000 + funct ' + FUNCT.add + ' = add    op 000000 + funct ' + FUNCT.sub + ' = sub', 0, 5.55, 11);
  },
  async (tok, S) => {   // 6 I-type
    gone(S.k1, S.k2);
    S.R.filter((m) => m.isMesh).forEach((m) => glow(m, null)); S.I.filter((m) => m.isMesh).forEach((m) => glow(m, HL));
    cap('I-type：op、rs、rt + 16-bit immediate', 'immediate 有好幾種用途');
  },
  async (tok, S) => {   // 7 immediate 當 offset
    S.I.filter((m) => m.isMesh).forEach((m) => glow(m, null)); glow(S.I.filter((m) => m.isMesh)[3], HL);
    cap('用途 1：load / store 的 offset', 'address = base register（rs）的內容 + offset');
    S.u1 = mt('lw / sw ：address = R[rs] + offset', -5.8, 3.85, 11); S.u1.center && S.u1.center.set(0, 0.5);
  },
  async (tok, S) => {   // 8 當 constant
    cap('用途 2：當 constant（例如 addi）', '16 bits 的 two\'s complement 小數字，可正可負');
    S.u2 = mt('addi：R[rs] + constant', -0.4, 3.85, 11); S.u2.center && S.u2.center.set(0, 0.5);
  },
  async (tok, S) => {   // 9 branch：加到 PC
    cap('用途 3：beq 的 offset', '加到 Program Counter 上，決定跳去哪裡');
    S.u3 = mt('beq：PC + 4 + offset × 4', 3.4, 3.85, 11); S.u3.center && S.u3.center.set(0, 0.5);
  },
  async (tok, S) => {   // 10 J：26 bits + 00 + PC 前 4 bits
    S.I.filter((m) => m.isMesh).forEach((m) => glow(m, null)); S.J.filter((m) => m.isMesh).forEach((m) => glow(m, HL));
    cap('J-type：target address 只有 26 bits', '後面補 00（以 4 bytes 為單位），前面接 PC 的前 4 bits');
    S.j = fmtBar([['PC+4 前 4', 4, CC.gold], ['target 26 bits', 26, CC.yel], ['00', 2, CC.gray]], -5.8, 1.3, 11.4, 0.55);
    S.k4 = ok(4 + 26 + 2 === 32, '4 + 26 + 2 = ' + (4 + 26 + 2) + ' bits 的 jump address', 0, 0.3);
  },
]);

scene('cpu-groups', '14B：哪些指令用哪個 format', [
  async (tok, S) => {   // 1 三個 type 都知道了
    cap('三個 type 的每個欄位都知道了', '接著看每個 type 做哪些 instruction');
    S.R = bx('R-type', CC.orange, -4.4, 6.2, 2.4, 0.7); S.I = bx('I-type', CC.teal, 0, 6.2, 2.4, 0.7); S.J = bx('J-type', CC.gold, 4.4, 6.2, 2.4, 0.7);
  },
  async (tok, S) => {   // 2 R-type
    glow(S.R, HL);
    cap('R-type：add、sub、and、or、slt…', 'rs、rt 是 source，rd 是 destination；funct 決定做什麼');
    S.r = lister(-6.0, 5.2, 0.55); S.r('add sub and or slt', 'idx'); S.r('rs, rt → 運算 → rd', 'idx');
  },
  async (tok, S) => {   // 3 I-type 三類
    glow(S.R, null); glow(S.I, HL);
    cap('I-type 三類：lw / sw、immediate、branch', '一定要記：最容易搞混');
    S.i = lister(-1.6, 5.2, 0.55); S.i('① lw / sw：base + offset', 'idx'); S.i('② addi…：constant', 'idx'); S.i('③ beq：PC 相對位址', 'idx');
    S.n = note('都用 rs、rt、immediate，但意思不一樣', 0, 3.2);
  },
  async (tok, S) => {   // 4 J-type
    glow(S.I, null); glow(S.J, HL);
    cap('J-type：jump，直接跳過去', '只有一個指令');
    S.j = lister(3.4, 5.2, 0.55); S.j('j target', 'idx');
  },
]);

scene('cpu-rtladd', '14B：Logical register transfer：add', [
  async (tok, S) => {   // 1 RTL
    cap('Logical Register Transfer（RTL）', '把每個指令「要做什麼」寫成 register 之間的搬移');
    S.f = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]], -5.6, 6.3, 11.2, 0.55);
  },
  async (tok, S) => {   // 2 每個欄位的 size
    cap('每個欄位有固定的 size', '32 = 6 + 5 + 5 + 5 + 5 + 6');
    S.k = ok(S.f.tot === 32, 'op 6、rs 5、rt 5、rd 5、shamt 5、funct 6 = ' + S.f.tot, 0, 7.2);
  },
  async (tok, S) => {   // 3 R[rd] ← R[rs] + R[rt]
    cap('add：用 rs、rt 當 index，從 register file 拿東西', '相加放到 rd');
    S.r = mt('add rd, rs, rt :   R[rd] ← R[rs] + R[rt]', -1.0, 4.9, 14, 'ptr alt');
  },
  async (tok, S) => {   // 4 PC ← PC + 4
    cap('同時要做 PC ← PC + 4', '準備做下一個 instruction');
    S.p = mt('                   PC ← PC + 4', -1.0, 4.2, 14, 'ptr alt');
  },
  async (tok, S) => {   // 5 照描述設計 hardware
    cap('每個指令都寫出它的動作', '照著這些描述，就能設計 hardware');
    S.n = note('RTL 描述 → hardware 設計', 3.6, 3.2);
  },
  async (tok, S) => {   // 6 實際例子：從 register file 讀、寫
    const rs = 7, rt = 5, rd = rs + rt;
    cap('rs、rt 從 register file 讀出來，相加，寫到 rd', '示意：R[rs] = ' + rs + '、R[rt] = ' + rt + ' → R[rd] = ' + rd);
    S.a = bx('R[rs] = ' + rs, CC.purple, -4.2, 1.8, 2.0, 0.6); S.b = bx('R[rt] = ' + rt, CC.purple, -4.2, 0.9, 2.0, 0.6);
    S.alu = bx('+', CC.orange, -1.0, 1.35, 0.8, 0.9);
    S.c = bx('R[rd] = ?', CC.lilac, 2.4, 1.35, 2.2, 0.6);
    const m = await flow(tok, [[-3.2, 1.35], [-1.4, 1.35]], 'rs rt', CC.purple, 600); kill(m);
    relabel(S.c, 'R[rd] = ' + rd); S.k2 = ok(rd === 12, '示意：7 + 5 = 12', 2.4, 0.5);
  },
]);

scene('cpu-rtllw', '14B：Load 的 RTL 與 sign extension', [
  async (tok, S) => {   // 1 load / store 比較麻煩
    cap('再看 load 和 store：比較麻煩一點', 'format：op、rs、rt、後面 16 bits');
    S.f = fmtBar([['op', 6, CC.gray], ['rs（base）', 5, CC.purple], ['rt', 5, CC.purple], ['immediate（offset）', 16, CC.teal]], -5.6, 6.3, 11.2, 0.55);
  },
  async (tok, S) => {   // 2 16 bits 解釋成 offset
    cap('load / store：後面 16 bits 解釋成 offset', '');
    glow(S.f.filter((m) => m.isMesh)[3], HL);
  },
  async (tok, S) => {   // 3 要 sign extension
    cap('ALU 做的是 32 bits 的加法，offset 只有 16 bits', '而且可正可負（two\'s complement）→ 要 sign extension');
    S.se = bx('Sign ext 16 → 32', CC.teal, 3.3, 5.0, 2.6, 0.55);
  },
  async (tok, S) => {   // 4 base 在 rs
    glow(S.f.filter((m) => m.isMesh)[3], null); glow(S.f.filter((m) => m.isMesh)[1], HL);
    cap('base 在哪裡？在 rs 描述的 register', '');
  },
  async (tok, S) => {   // 5 相加 = memory 地址
    cap('R[rs] + SignExt(imm16) = memory 的地址', '然後去 memory access');
    S.r1 = mt('addr ← R[rs] + SignExt(imm16)', -1.6, 4.3, 14, 'ptr alt');
  },
  async (tok, S) => {   // 6 放到 rt；PC + 4
    glow(S.f.filter((m) => m.isMesh)[1], null); glow(S.f.filter((m) => m.isMesh)[2], HL);
    cap('lw：讀出來放到 rt；同時 PC ← PC + 4', '');
    S.r2 = mt('R[rt] ← MEM[addr] ;  PC ← PC + 4', -1.6, 3.6, 14, 'ptr alt');
  },
  async (tok, S) => {   // 7 再講一遍：32 bits 怎麼看
    glow(S.f.filter((m) => m.isMesh)[2], null);
    cap('再講一遍：拿到 32 bits 這樣看', '前 6 bits 是 op code，接著 rs、rt，後 16 bits 是 immediate');
    S.f.filter((m) => m.isMesh).forEach((m) => glow(m, HL));
  },
  async (tok, S) => {   // 8 同時解釋
    S.f.filter((m) => m.isMesh).forEach((m) => glow(m, null));
    cap('一開始不知道是 R、I 還是 J', '就同時去解釋，每個欄位都拿出來；op code 再告訴你是哪個');
    S.g = ['R?', 'I?', 'J?'].map((t, i) => bx(t, [CC.orange, CC.teal, CC.gold][i], -4.6 + i * 1.3, 2.6, 1.1, 0.5));
  },
  async (tok, S) => {   // 9 32 bits + 16 bits 不能直接加
    gone(S.g);
    cap('rs 讀出 32 bits，offset 只有 16 bits', '不能直接相加 → 要先 sign extension 成 32 bits');
    S.x = mt('32 bits + 16 bits ?', -4.0, 2.6, 13, 'bad');
  },
  async (tok, S) => {   // 10 不能前面補 0（例：4 bits → 8 bits）
    gone(S.x);
    const neg = '1011';
    cap('可不可以前面直接補 0？不行', '例：4 bits 變 8 bits，負數補 0 就變成正數了');
    pl('1011 = ' + fromS(neg), -5.0, 2.6); bitRow('0000' + neg, -2.9, 2.6, 0.42, CC.red, CC.peach);
    bad('補 0 → ' + fromU('0000' + neg) + '（錯）', 1.6, 2.6);
  },
  async (tok, S) => {   // 11 正數補 0、負數補 1
    const pos = '0101', neg = '1011';
    cap('sign extension：正數前面補 0，負數補 1', '表示的還是同一個數');
    pl('0101 = ' + fromS(pos), -5.0, 1.7); bitRow(toB(fromS(pos), 8), -2.9, 1.7, 0.42, CC.green, CC.mint);
    pl('1011 = ' + fromS(neg), -5.0, 0.8); bitRow(toB(fromS(neg), 8), -2.9, 0.8, 0.42, CC.green, CC.mint);
    ok(fromS(toB(fromS(pos), 8)) === 5 && fromS(toB(fromS(neg), 8)) === -5, '5 → 5、−5 → −5', 2.6, 1.25);
  },
  async (tok, S) => {   // 12 extend 完和 rs 相加 → 地址 → rt
    const base = 1000, off = -4, ext = toB(off, 32);
    cap('extend 成 32 bits，跟 rs 讀出來的一起算', '示意：R[rs] = 1000、offset = −4 → 地址 ' + (base + off));
    S.e = mt('SignExt(0x' + (off & 0xffff).toString(16).toUpperCase() + ') = 0x' + (fromU(ext) >>> 0).toString(16).toUpperCase(), 3.6, 0.1, 11);
    ok(fromS(ext) === off, '示意：1000 + (−4) = ' + (base + off), 3.6, -0.5);
  },
]);

scene('cpu-rtlsw', '14B：Store、addi、beq 的 RTL', [
  async (tok, S) => {   // 1 store
    cap('store：同樣的 format', '把 register 的東西放到 memory');
    S.L = lister(-6.0, 6.4, 0.8);
    S.L('sw ：MEM[ R[rs] + SignExt(imm16) ] ← R[rt]', 'ptr alt', 13);
    mono(S.L.ls[0], 13);
  },
  async (tok, S) => {   // 2 一樣 PC + 4
    cap('一樣要 PC ← PC + 4', '');
    mono(S.L('      PC ← PC + 4', 'ptr alt'), 13);
  },
  async (tok, S) => {   // 3 addi
    cap('add immediate：rs 的內容加上 constant', '結果放到 rt');
    mono(S.L('addi：R[rt] ← R[rs] + SignExt(imm16)', 'ptr alt'), 13);
  },
  async (tok, S) => {   // 4 16 bits 是 signed
    cap('這 16 bits 是 signed 還是 unsigned？', '加的 constant 有正有負 → signed number');
    S.c = mt('constant：−32768 ～ ' + (2 ** 15 - 1), 3.6, 4.0, 12, 'note');
  },
  async (tok, S) => {   // 5 一樣要 sign extension
    const v = -50;
    cap('所以 immediate 也一定要 sign extension', '示意：−50 補 1 才對；補 0 就變成 ' + fromU(toB(v, 16)));
    S.k = ok(fromS(toB(v, 16).padStart(32, '1')) === v, '示意：SignExt(−50) = −50', 3.6, 3.3);
  },
  async (tok, S) => {   // 6 beq：比較
    cap('beq：把 rs、rt 拿出來比較', '相等才跳');
    mono(S.L('beq ：if (R[rs] == R[rt])', 'ptr alt'), 13);
  },
  async (tok, S) => {   // 7 PC + 4 已經先加了
    cap('不管是不是 branch，hardware 一開始就先做 PC + 4', '所以跳的基準是 PC + 4');
    S.n = note('PC + 4 一定先算好', 3.6, 1.5);
  },
  async (tok, S) => {   // 8 target = PC + 4 + SignExt(imm)‖00
    cap('target = PC + 4 + SignExt(imm16) ‖ 00', '後面補兩個 0（× 4）');
    mono(S.L('        PC ← PC + 4 + ( SignExt(imm16) ‖ 00 )', 'ptr alt'), 13);
    mono(S.L('      else  PC ← PC + 4', 'idx'), 13);
  },
  async (tok, S) => {   // 9 先算好，比較結果決定跳不跳
    cap('target 可以先算好', '要不要跳，由比較的結果決定');
    S.d = hot('先算好 target，比較結果決定選哪個', 0, 0.3);
  },
]);

scene('cpu-concat', '14B：‖ 是 concatenate：後面接兩個 0', [
  async (tok, S) => {   // 1 concatenate
    const off = 3, bin = toB(off, 16);
    cap('‖ 是 concatenate（並在一起），不是 OR', '把 offset 後面接上兩個 0');
    S.a = bitRow(bin.slice(8), -4.0, 4.6, 0.5); pl('offset 3（後 8 bits）', -5.4, 5.3);
    S.b = bitRow((bin + '00').slice(10), -4.0, 3.5, 0.5, CC.green, CC.mint); pl('‖ 00', -5.2, 3.5);
  },
  async (tok, S) => {   // 2 word address
    const off = 3, v = fromU(toB(off, 16) + '00');
    cap('指令 4 bytes：word address 最後兩 bits 是 00', '不用浪費 bits 存它，用的時候再補上');
    ok(v === off * 4, '示意：3 ‖ 00 = ' + v + ' = 3 × 4', 2.6, 3.5);
  },
]);

scene('cpu-parts', '14B：需要哪些 component', [
  async (tok, S) => {   // 1 register file
    cap('要做這些動作，需要哪些 component？', '第一個：register file');
    S.rf = bx('Register file', CC.purple, -4.6, 5.8, 2.6, 1.2);
  },
  async (tok, S) => {   // 2 PC
    cap('Program Counter：記錄下一個 instruction 在哪裡', '32 bits');
    S.pc = bx('PC（32 bits）', CC.gold, -0.8, 5.8, 2.2, 0.8);
  },
  async (tok, S) => {   // 3 加 4 的 adder
    cap('每次都要 + 4：一個專門的簡單加法器', '');
    S.a4 = bx('Adder（+4）', CC.orange, 2.8, 5.8, 2.0, 0.8);
  },
  async (tok, S) => {   // 4 ALU、sign extension
    cap('ALU 做運算；sign ext 把 16 bits 變 32', '');
    S.alu = bx('ALU', CC.orange, -4.6, 3.8, 1.4, 1.0); S.se = bx('Sign ext', CC.teal, -2.2, 3.8, 1.6, 0.7);
  },
  async (tok, S) => {   // 5 always 做出來，control 再選
    cap('有的指令用不到 sign extension，但還是 always 做出來', '用不用由 control 決定：像 ALU 加、and、or 全做，最後 mux 選');
    S.al = ['+', '&', '|'].map((t, i) => bx(t, CC.orange, 0.6 + i * 0.9, 3.8, 0.7, 0.6));
    S.mx = bx('MUX', CC.mux, 3.8, 3.8, 0.8, 1.0); glow(S.mx, HL);
  },
  async (tok, S) => {   // 6 instruction memory、data memory
    cap('還要 instruction memory 和 data memory', 'register file：32 個 register、每個 32 bits');
    S.im = bx('Instruction memory', CC.blue, -3.6, 1.8, 3.0, 0.9); S.dm = bx('Data memory', CC.green, 0.4, 1.8, 2.6, 0.9);
    S.n = sm('32 × 32 bits', -4.6, 6.7);
  },
  async (tok, S) => {   // 7 PC 為什麼 32 bits
    cap('PC 為什麼 32 bits？', 'memory space 是 2³² 個 byte，地址要 32 bits');
    S.k = ok(2 ** 32 === 4294967296, '2³² = ' + 2 ** 32 + ' bytes', -0.8, 6.65);
  },
  async (tok, S) => {   // 8 branch target 的 adder
    cap('還要一個加法器：PC 加上 branch 的 offset', '算出 target address');
    S.ba = bx('Adder（branch target）', CC.orange, 4.2, 1.8, 3.0, 0.9);
  },
]);

scene('cpu-comb', '14B：combinational components：都是 32 bits', [
  async (tok, S) => {   // 1 adder、mux、ALU
    cap('datapath 的 combinational components', 'adder、MUX、ALU');
    S.a = bx('Adder', CC.orange, -4.0, 4.0, 1.6, 1.2); S.m = bx('MUX', CC.mux, 0, 4.0, 1.0, 1.4); S.u = bx('ALU', CC.orange, 4.0, 4.0, 1.6, 1.4);
  },
  async (tok, S) => {   // 2 斜線：32 bits
    cap('注意：進出的不是 1 bit，是 32 bits', '線上畫一條斜線，表示 32 條');
    [[-6.0, -4.8], [-1.6, -0.5], [2.2, 3.2]].forEach(([a, b]) => { line([[a, 4.0], [b, 4.0]], CC.brown); line([[(a + b) / 2 - 0.12, 3.75], [(a + b) / 2 + 0.12, 4.25]], CC.brown); small(tag('32', 'idx', (a + b) / 2, 4.45), 9); });
    S.k = ok(true, 'A、B 都是 32 bits', 0, 2.6);
  },
]);

scene('cpu-regfile', '14B：Register file：RA、RB、RW、busA、busB、busW、WrEn', [
  async (tok, S) => {   // 1 sequential：PC 與 register
    cap('sequential components：PC 和 register', 'register 就是一排 32 個 D flip-flop');
    S.reg = bx('Register（32 bits）', CC.gold, -4.4, 6.2, 3.0, 0.7);
  },
  async (tok, S) => {   // 2 一定要 write enable
    cap('注意：一定要有 write enable', '不是每個 cycle 都要寫進去');
    S.we = small(hot('Write Enable', -4.4, 7.0), 10);
  },
  async (tok, S) => {   // 3 register file：32 個
    cap('register file 裡有 32 個這樣的 register', '每個 32 bits');
    S.rf = bx('Register file：32 × 32-bit', CC.purple, 0, 3.4, 3.4, 3.2);
  },
  async (tok, S) => {   // 4 RA、RB：讀兩個 operand
    cap('每次要讀兩個 operand：rs 和 rt', '給它兩個地址：RA、RB → 兩個 read port');
    S.ra = line([[-4.4, 4.4], [-1.7, 4.4]], CC.brown); S.rb = line([[-4.4, 3.8], [-1.7, 3.8]], CC.brown);
    S.la = small(pl('RA（5）', -3.6, 4.65), 10); S.lb = small(pl('RB（5）', -3.6, 4.05), 10);
  },
  async (tok, S) => {   // 5 只讀一個就只要一個 port
    cap('如果一個 cycle 只讀一個 operand', '只要一個 port 就好；port 越多，hardware 越貴');
    S.n = note('port 越多 → hardware cost 越高', 4.4, 6.6);
  },
  async (tok, S) => {   // 6 讀兩個、寫一個
    gone(S.n);
    cap('這個 register file：一個 cycle 讀兩個、寫一個', 'cycle 一開始給地址就讀出來；cycle 結束時寫進去');
    S.n2 = note('read 2、write 1（每個 cycle）', 4.4, 6.6);
  },
  async (tok, S) => {   // 7 三個地址
    cap('所以要三個地址：兩個 read、一個 write', 'RA、RB、RW 各 5 bits');
    S.rw = line([[-4.4, 2.6], [-1.7, 2.6]], CC.brown); S.lw = small(pl('RW（5）', -3.6, 2.85), 10);
  },
  async (tok, S) => {   // 8 write enable
    cap('很重要：write enable', '有時候只讀不寫，要靠 WrEn 控制這個 cycle 准不准寫');
    S.wen = line([[0, 6.2], [0, 5.0]], CC.pink); S.lwe = small(hot('WrEn', 0.6, 6.0), 10);
  },
  async (tok, S) => {   // 9 busA、busB 輸出
    cap('RA 說讀第 3 個、RB 說讀第 8 個', '讀出來的 data 放在 busA、busB（各 32 bits）');
    S.oa = line([[1.7, 4.4], [4.6, 4.4]], CC.brown); S.ob = line([[1.7, 3.6], [4.6, 3.6]], CC.brown);
    small(pl('busA（32）', 3.5, 4.65), 10); small(pl('busB（32）', 3.5, 3.85), 10);
    const [a, b] = await Promise.all([flow(tok, [[-4.4, 4.4], [-1.7, 4.4]], '3', CC.purple, 600), flow(tok, [[-4.4, 3.8], [-1.7, 3.8]], '8', CC.purple, 600)]); kill(a); kill(b);
    const [c, d] = await Promise.all([flow(tok, [[1.7, 4.4], [4.6, 4.4]], 'R[3]', CC.lilac, 600), flow(tok, [[1.7, 3.6], [4.6, 3.6]], 'R[8]', CC.lilac, 600)]); kill(c); kill(d);
  },
  async (tok, S) => {   // 10 busW 寫入
    cap('要寫回去：data 放在 busW（32 bits）', '在 cycle 結束時寫進去');
    S.bw = line([[-4.4, 2.1], [-1.7, 2.1]], CC.brown); small(pl('busW（32）', -3.6, 1.85), 10);
  },
  async (tok, S) => {   // 11 地址為什麼 5 bits
    cap('RA、RB 是地址：要第幾個 register？', '32 個 register → 2⁵ = 32 → 5 bits');
    S.k = ok(Math.log2(32) === 5, 'log₂32 = ' + Math.log2(32) + ' bits', -3.0, 0.9);
  },
  async (tok, S) => {   // 12 RW 告訴寫在哪
    cap('寫的時候：RW 告訴它寫在第幾個', '例如寫第 5 個 register，data 從 busW 送進去');
    const [a, b] = await Promise.all([flow(tok, [[-4.4, 2.6], [-1.7, 2.6]], '5', CC.purple, 700), flow(tok, [[-4.4, 2.1], [-1.7, 2.1]], 'data', CC.green, 700)]); kill(a); kill(b);
    relabel(S.rf, 'R[5] ← data');
  },
  async (tok, S) => {   // 13 clock：edge + WrEn
    cap('clock 怎麼控制？clock edge（這張是 negative edge）', '而且 WrEn = 1 才寫；一個 cycle：讀兩筆、寫一筆');
    S.clk = line([[1.0, 6.2], [1.0, 5.0]], CC.brown); S.lclk = small(pl('Clk', 1.4, 6.0), 10);
    glow(S.rf, HL);
  },
]);

scene('cpu-memel', '14B：Memory element：一個 address、WrEn', [
  async (tok, S) => {   // 1 memory element
    cap('再看 memory element', '跟 register file 不一樣');
    S.m = bx('Memory', CC.green, 0, 3.6, 3.0, 2.6);
  },
  async (tok, S) => {   // 2 只有一個 address
    cap('只有一個 address', '一次不是 read 就是 write，address 共用就好');
    S.ad = line([[-4.4, 4.2], [-1.5, 4.2]], CC.brown); small(pl('Address', -3.4, 4.45), 10);
  },
  async (tok, S) => {   // 3 write enable
    cap('這個 cycle 要不要寫？', '一樣由 write enable 決定');
    S.we = line([[0, 6.0], [0, 4.9]], CC.pink); small(hot('WrEn', 0.6, 5.8), 10);
  },
  async (tok, S) => {   // 4 always 讀
    cap('給它 address，它 always 把 data 讀出來', '只有 write 的時候才會改變裡面的 data');
    S.out = line([[1.5, 3.6], [4.6, 3.6]], CC.brown); small(pl('Data Out', 3.4, 3.85), 10);
    const m = await flow(tok, [[1.5, 3.6], [4.6, 3.6]], 'data', CC.green, 700); kill(m);
  },
  async (tok, S) => {   // 5 一個 input bus、一個 output bus
    cap('一個 Data In bus、一個 Data Out bus', 'WrEn = 1 才把 Data In 寫到 address 的位置');
    S.in = line([[-4.4, 2.8], [-1.5, 2.8]], CC.brown); small(pl('Data In', -3.4, 3.05), 10);
    glow(S.m, HL);
  },
]);

scene('cpu-fetchdp', '14B：每個指令都做的事：fetch 與 PC + 4', [
  async (tok, S) => {   // 1 always PC + 4
    S.D = dpAdd(dpNew(), ['PC']);
    cap('開始組 datapath：每個指令一定做的事', 'fetch instruction，然後 PC = PC + 4');
  },
  async (tok, S) => {   // 2 PC → instruction memory 的 read address
    dpAdd(S.D, ['IM'], ['pc_im']);
    cap('PC 接到 instruction memory 的 read address', '');
    const m = await along(S.D, tok, ['pc_im'], 'PC', CC.gold, 700); kill(m);
  },
  async (tok, S) => {   // 3 讀出 32 bits
    dpAdd(S.D, [], ['ins']);
    cap('讀出來是 32 bits 的 instruction', '後面就開始 decode');
    const m = await along(S.D, tok, ['ins'], '32', CC.blue, 600); kill(m);
  },
  async (tok, S) => {   // 4 adder：PC + 4
    dpAdd(S.D, ['ADD4'], ['pc_add', 'four']);
    cap('always 要做 PC = PC + 4', '所以這裡需要一個加法器');
    const m = await along(S.D, tok, ['pc_add'], 'PC', CC.gold, 700); kill(m);
    S.t = await flow(tok, [[-4.25, 6.4], [-3.6, 6.4]], 'PC+4', CC.orange, 400);
  },
  async (tok, S) => {   // 5 現在會寫進 PC 嗎？
    cap('算好的 PC + 4 會不會立刻寫進 PC？', '不會：只是算好，在那邊等');
    S.q = small(hot('等著…', -3.6, 7.0), 10);
  },
  async (tok, S) => {   // 6 clock edge 才寫
    gone(S.q);
    S.D.w.back = line([[-3.6, 6.4], [-3.6, 7.3], [-6.9, 7.3], [-6.9, 3.2], [-6.6, 3.2]], WON);
    cap('等到這個 clock period 結束（edge trigger）', '才寫進 PC');
    await travel(tok, S.t, S.t.position.clone(), V3(-6.9, 7.3, 0.35), 600);
    await travel(tok, S.t, S.t.position.clone(), V3(-6.6, 3.2, 0.35), 500);
    kill(S.t); glow(S.D.c.PC, HL);
  },
  async (tok, S) => {   // 7 中途寫入的後果
    glow(S.D.c.PC, null);
    cap('如果中途就寫進去：會去拿另一個 instruction', '前一個都還沒做完 → 很壞的後果');
    S.b = bad('中途改 PC → 拿到另一個 instruction！', 0, 1.2);
  },
], DPC);

scene('cpu-rdp', '14B：R-type 的 datapath（add、sub）', [
  async (tok, S) => {   // 1 R-type
    S.D = dpAdd(dpNew(), ['PC', 'IM'], ['pc_im', 'ins']);
    cap('先看 R-type 的 add、subtract', 'instruction fetch 已經拿到 32 bits');
  },
  async (tok, S) => {   // 2 取出 rs、rt、rd
    cap('把 op、rs、rt、rd 的位置拿出來', '每個欄位在哪都知道');
    S.fl = ['rs', 'rt', 'rd'].map((t, i) => small(tag(t, 'ptr', -3.0, [4.45, 3.85, 2.8][i]), 10));
  },
  async (tok, S) => {   // 3 rs → RA
    dpAdd(S.D, ['RF'], ['rs']); rfPorts(S.D);
    cap('rs 接到第一個 read address（RA）', 'register file 有兩個 read port、一個 write port');
    const m = await along(S.D, tok, ['rs'], 'rs', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 4 rt → RB、rd → RW
    dpAdd(S.D, [], ['rt']); cw(S.D, 'rdW');
    cap('rt 接到 RB；rd 接到 write address（RW）', 'rs、rt 是讀的地址，rd 是寫的地址');
    const [a, b] = await Promise.all([along(S.D, tok, ['rt'], 'rt', CC.purple, 600), flow(tok, CW.rdW, 'rd', CC.purple, 600)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 5 兩個 operand → ALU
    dpAdd(S.D, ['ALU'], ['rd1']); cw(S.D, 'rd2A');
    cap('讀出兩個 operand（busA、busB）', '接到 ALU 去運算');
    const [a, b] = await Promise.all([along(S.D, tok, ['rd1'], 'busA', CC.lilac, 600), flow(tok, CW.rd2A, 'busB', CC.lilac, 600)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 6 ALU 做什麼由 control 決定
    cap('ALU 要做加還是減？', '由 control（ALUctr）決定，後面再講');
    S.ac = small(hot('ALUctr', 2.2, 1.8), 10); S.acl = line([[2.2, 2.0], [2.2, 2.7]], CC.blue);
  },
  async (tok, S) => {   // 7 結果 → busW
    cw(S.D, 'wbA', WON);
    cap('算完的 output 接回 register file 的 busW', '寫進 rd 指定的 register');
    const m = await flow(tok, CW.wbA, 'result', CC.orange, 1200); kill(m);
  },
  async (tok, S) => {   // 8 要不要寫：RegWr
    cap('到底要不要寫？R-type 要寫：RegWr = 1', '別的指令就不一定 → 也是 control signal');
    S.rw = small(hot('RegWr = 1', -0.9, 5.1), 10);
  },
], DPC);

scene('cpu-lsdp', '14B：Load／store 的 datapath：rt 的兩種角色', [
  async (tok, S) => {   // 1 load / store
    S.D = dpAdd(dpNew(), ['PC', 'IM', 'RF'], ['pc_im', 'ins']); rfPorts(S.D);
    cap('load / store 怎麼辦？', 'format：op、rs、rt、immediate，沒有 rd');
  },
  async (tok, S) => {   // 2 rs、rt 還是去讀
    dpAdd(S.D, [], ['rs', 'rt']);
    cap('rs、rt 還是一樣接到 RA、RB 去讀', '');
    const [a, b] = await Promise.all([along(S.D, tok, ['rs'], 'rs', CC.purple, 600), along(S.D, tok, ['rt'], 'rt', CC.purple, 600)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 3 immediate → sign extension → ALU
    dpAdd(S.D, ['SE', 'ALU'], ['imm', 'rd1']); cw(S.D, 'seA');
    cap('後面的 16 bits immediate 做 sign extension', '再和 rs 讀出來的東西一起進 ALU 相加');
    const a = await along(S.D, tok, ['imm'], 'imm16', CC.teal, 600); kill(a);
    const [b, c] = await Promise.all([flow(tok, CW.seA, '32', CC.teal, 700), along(S.D, tok, ['rd1'], 'base', CC.lilac, 700)]); kill(b); kill(c);
  },
  async (tok, S) => {   // 4 ALU → memory address
    dpAdd(S.D, ['DM'], ['alu_dm']);
    cap('ALU 算出 target address', '接到 data memory 的 address，data 就讀出來');
    const m = await along(S.D, tok, ['alu_dm'], 'addr', CC.orange, 600); kill(m);
  },
  async (tok, S) => {   // 5 lw：data → busW
    cw(S.D, 'wbM', WON);
    cap('lw：memory 讀出的 data 要寫回 register file', '接到 busW（write data）');
    const m = await flow(tok, CW.wbM, 'data', CC.green, 1200); kill(m);
  },
  async (tok, S) => {   // 6 寫到 rt
    cw(S.D, 'rtW', WON);
    cap('寫到哪？lw 是寫到 rt', '所以 rt 也要接到 RW（R-type 那裡接的是 rd）');
    const m = await flow(tok, CW.rtW, 'rt', CC.purple, 700); kill(m);
  },
  async (tok, S) => {   // 7 store：讀 rt → memory
    wiresOff(S.D); Object.values(S.D.w).forEach((l) => l.material.color.set(WCOL));
    dpAdd(S.D, [], ['rd2_dm']);
    cap('store：把 register 的東西寫到 memory', '讀 rt，從 busB 接到 data memory 的 write data');
    const m = await along(S.D, tok, ['rd2_dm'], 'R[rt]', CC.lilac, 1000); kill(m);
  },
  async (tok, S) => {   // 8 地址都是 rs 算
    cap('不管 load 還是 store', 'memory 地址都是 rs + sign-extended offset');
    S.n = small(hot('address = R[rs] + SignExt(imm16)', 2.4, 0.6), 10);
  },
  async (tok, S) => {   // 9 rt 角色不同
    cap('rt 的角色不一樣', 'lw：rt 是 destination（寫入）；sw：rt 是 source（讀出）');
    S.t1 = small(hot('lw：rt = destination', -4.6, 1.6), 10); S.t2 = small(note('sw：rt = source', -4.6, 1.0), 10);
  },
], DPC);

// ════════ iblxfbOsp_g（第 15A 講：合併 datapath、mux、beq、完整單週期、timing、control 概念） ════════
// all parts + wires of the finished single-cycle datapath, without signal labels
const fullDP = () => buildDP(99, false);
const SIGXY = { RegDst: [-2.4, 2.05], ALUSrc: [0.9, 2.1], MemtoReg: [5.7, 4.0], RegWrite: [-0.9, 4.95], MemRead: [4.9, 1.85], MemWrite: [4.2, 4.6], Branch: [3.7, 4.75], PCSrc: [4.6, 7.55], ALUOp: [3.6, 0.6], Jump: [4.6, 7.55] };
const sflag = (D, s, v) => flag(D, s, v, SIGXY[s][0], SIGXY[s][1]);
// timing bars: segs = [[name, start, len, color, row]], ps → x
function tbars(segs, x0, y0, sc, dy = 0.75) {
  return segs.map(([n, a, l, c, r = 0]) => { const w = l * sc; const m = cube(n + ' ' + l, c, [Math.max(0.06, w - 0.03), 0.5, 0.4], x0 + a * sc + w / 2, y0 - r * dy, 0); if (m.userData.lbl) small(m.userData.lbl, w < 1.2 ? 8 : 9); return m; });
}
// 示意 delays（ps）：老師沒有給數字
const TD = { clkq: 30, im: 200, ctrl: 50, reg: 100, alu: 200, dm: 200, setup: 20, skew: 10 };

scene('cpu-fetch3', '15A：Fetch：所有指令都有的部分', [
  async (tok, S) => {   // 1 fetch 部分
    S.D = dpAdd(dpNew(), ['PC', 'IM'], ['pc_im', 'ins']);
    cap('datapath 第一部分：instruction fetch', '每個 instruction 都一定要做');
  },
  async (tok, S) => {   // 2 PC 的地址 → instruction memory
    cap('PC 的地址：去 instruction memory 哪裡拿', '讀出來的 data 就放在這裡');
    const m = await along(S.D, tok, ['pc_im'], 'PC', CC.gold, 600); kill(m);
    const n = await along(S.D, tok, ['ins'], 'instr', CC.blue, 500); kill(n);
  },
  async (tok, S) => {   // 3 PC + 4
    dpAdd(S.D, ['ADD4'], ['pc_add', 'four']);
    cap('PC 的值要加 4：需要一個 Add', '加完要存回 PC');
    const m = await along(S.D, tok, ['pc_add'], 'PC', CC.gold, 700); kill(m);
  },
  async (tok, S) => {   // 4 等到 edge 才存回
    S.D.w.back = line([[-4.25, 6.4], [-3.6, 6.4], [-3.6, 7.3], [-6.9, 7.3], [-6.9, 3.2], [-6.6, 3.2]], WON);
    cap('不是馬上存回去', '等到 clock edge trigger（0 → 1）才寫進 PC');
    const m = await flow(tok, [[-4.25, 6.4], [-3.6, 6.4], [-3.6, 7.3], [-6.9, 7.3], [-6.9, 3.2], [-6.6, 3.2]], 'PC+4', CC.orange, 1300); kill(m);
    glow(S.D.c.PC, HL);
  },
], DPC);

scene('cpu-rdp3', '15A：複習 R-type 的 datapath', [
  async (tok, S) => {   // 1 R-type
    S.D = dpAdd(dpNew(), ['PC', 'IM', 'RF'], ['pc_im', 'ins']); rfPorts(S.D);
    cap('上次介紹的 add、subtract：R-type', 'op、rs、rt、rd、shamt、funct');
  },
  async (tok, S) => {   // 2 RTL
    cap('它的動作（RTL）：R[rd] ← R[rs] op R[rt]', 'rs、rt、rd 都是 register file 裡的地址');
    S.r = mt('R[rd] ← R[rs] op R[rt]', 2.2, 6.6, 13, 'ptr alt');
  },
  async (tok, S) => {   // 3 拿出來做 operation
    cap('rs、rt 把東西拿出來做 operation', '做完放到 rd');
  },
  async (tok, S) => {   // 4 rs → RA、rt → RB
    dpAdd(S.D, [], ['rs', 'rt']);
    cap('rs 接到第一個 read address，rt 接第二個', '給地址，data 就從 busA、busB 出來');
    const [a, b] = await Promise.all([along(S.D, tok, ['rs'], 'rs', CC.purple, 600), along(S.D, tok, ['rt'], 'rt', CC.purple, 600)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 5 rd → write address
    cw(S.D, 'rdW');
    cap('寫回去的地址在 rd：rd 接到 write address', '地址 5 bits，data 32 bits');
    const m = await flow(tok, CW.rdW, 'rd', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 6 結果接回 write data
    dpAdd(S.D, ['ALU'], ['rd1']); cw(S.D, 'rd2A'); cw(S.D, 'wbA', WON);
    cap('rs、rt 的內容經過 ALU，結果接回 write data', '這就是 add / subtract 的 datapath');
    const m = await flow(tok, CW.wbA, 'result', CC.orange, 1100); kill(m);
  },
], DPC);

scene('cpu-lsdp3', '15A：Load／store 的 datapath', [
  async (tok, S) => {   // 1 load / store
    S.D = dpAdd(dpNew(), ['PC', 'IM', 'RF'], ['pc_im', 'ins']); rfPorts(S.D);
    cap('再看 store、load', 'format：op、rs、rt、16-bit immediate');
  },
  async (tok, S) => {   // 2 rs 是 base register
    cap('rs 代表 base register', '它的內容 + offset = memory 地址');
  },
  async (tok, S) => {   // 3 access rs
    dpAdd(S.D, ['ALU'], ['rs', 'rd1']);
    cap('所以要去 register file 讀 rs', '');
    const m = await along(S.D, tok, ['rs', 'rd1'], 'base', CC.purple, 900); kill(m);
  },
  async (tok, S) => {   // 4 sign extension
    dpAdd(S.D, ['SE'], ['imm']); cw(S.D, 'seA');
    cap('immediate 在最後 16 bits：做 sign extension', '變成 32 bits 才能和 base 相加');
    const m = await along(S.D, tok, ['imm'], 'imm16', CC.teal, 600); kill(m);
    const n = await flow(tok, CW.seA, '32', CC.teal, 600); kill(n);
  },
  async (tok, S) => {   // 5 ALU 算 data memory 的地址
    dpAdd(S.D, ['DM'], ['alu_dm']);
    cap('ALU 算出 data memory 的地址', 'load、store 這部分都一樣');
    const m = await along(S.D, tok, ['alu_dm'], 'addr', CC.orange, 600); kill(m);
  },
  async (tok, S) => {   // 6 rt 角色不同
    cap('可是 rt 的角色不一樣', 'load：memory 的東西搬到 register file');
    S.q = small(hot('rt = ?', -2.9, 4.0), 10);
  },
  async (tok, S) => {   // 7 lw：rt 接 write address
    gone(S.q); cw(S.D, 'rtW', WON);
    cap('load：rt 告訴我們要寫去哪裡', '所以 rt 接到 write address');
    const m = await flow(tok, CW.rtW, 'rt', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 8 data → write data
    cw(S.D, 'wbM', WON);
    cap('memory 讀出的 data 接到 write data', '');
    const m = await flow(tok, CW.wbM, 'data', CC.green, 1100); kill(m);
  },
  async (tok, S) => {   // 9 store
    Object.values(S.D.w).forEach((l) => l.material.color.set(WCOL));
    cap('store：把 register file 的東西放到 memory', 'rs 已經拿去算地址了，data 從哪裡來？');
  },
  async (tok, S) => {   // 10 rt 是第二個 read address
    dpAdd(S.D, [], ['rt']);
    cap('data 由 rt 描述：這時 rt 是 read 第二個 operand', 'rt 接到第二個 read address');
    const m = await along(S.D, tok, ['rt'], 'rt', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 11 busB → data memory write data
    dpAdd(S.D, [], ['rd2_dm']);
    cap('讀出來接到 data memory 的 write data', '因為 store 要 write memory');
    const m = await along(S.D, tok, ['rd2_dm'], 'R[rt]', CC.lilac, 1000); kill(m);
  },
], DPC);

scene('cpu-fanout', '15A：fan-out 可以，fan-in 要用 mux', [
  async (tok, S) => {   // 1 不知道是哪個指令
    cap('一開始不知道是 R-type 還是 lw / sw', '所有可能都要接好');
    S.f = ['R?', 'lw?', 'sw?'].map((t, i) => bx(t, [CC.orange, CC.green, CC.green][i], -4.4 + i * 1.5, 6.4, 1.3, 0.55));
  },
  async (tok, S) => {   // 2 rs 不變
    cap('format 盡量一致：rs 的位置在所有 type 都一樣', 'rt 也一樣 → 不用選擇');
    S.a = small(good('rs、rt：位置固定', 1.6, 6.4), 11);
  },
  async (tok, S) => {   // 3 寫入地址不一樣
    cap('但寫入的地址不一樣', 'R-type 給 rd，load 給 rt');
    S.b = small(bad('寫入地址：rd 或 rt', 4.6, 6.4), 11);
  },
  async (tok, S) => {   // 4 fan-out
    cap('一個 output 可以給很多人：fan out', '邏輯設計：一個 gate 的 output 接到好幾個 gate 的 input');
    S.g = bx('AND', CC.brown, -4.0, 3.6, 1.2, 0.8);
    S.o = [4.4, 3.6, 2.8].map((y, i) => { line([[-3.4, 3.6], [-2.4, 3.6], [-2.4, y], [-1.2, y]], CC.brown); return bx('OR', CC.brown, -0.7, y, 1.0, 0.55); });
    S.ok = small(good('fan out：OK', -2.4, 4.9), 11);
  },
  async (tok, S) => {   // 5 一個 input 兩個人接
    cap('但一個 input 可以同時接兩個人嗎？不行', '兩個 output 會打架，不知道要選誰');
    S.i = bx('gate', CC.brown, 4.6, 3.6, 1.0, 0.8);
    line([[1.6, 4.3], [3.2, 4.3], [3.2, 3.6], [4.1, 3.6]], CC.red); line([[1.6, 2.9], [3.2, 2.9], [3.2, 3.6]], CC.red);
    S.x = small(bad('fan in：打架', 2.4, 4.7), 11);
  },
  async (tok, S) => {   // 6 加 mux select
    cap('所以前面放一個 select 的東西：mux', '由它選要哪一個 input');
    S.m = bx('MUX', CC.mux, 3.2, 3.6, 0.5, 1.2); glow(S.m, HL);
    S.ms = small(hot('select', 3.2, 2.6), 10);
  },
  async (tok, S) => {   // 7 write address：一會 rt、一會 rd
    gone(S.g, S.o, S.ok, S.i, S.x, S.m, S.ms);
    S.D = dpAdd(dpNew(), ['RF'], ['rt']); rfPorts(S.D);
    cap('回到 datapath：write address 這個地方', '一會兒是 rt、一會兒是 rd → 不能同時接');
    S.w1 = line(CW.rtW, CC.red); S.w2 = line(CW.rdW, CC.red);
    S.x2 = small(bad('rt、rd 同時接到 RW？', -3.4, 1.9), 10);
  },
  async (tok, S) => {   // 8 2-to-1 mux
    gone(S.w1, S.w2, S.x2);
    dpAdd(S.D, ['MUXD'], ['rt_m', 'rd', 'wr']); glow(S.D.c.MUXD, HL);
    cap('前面放一個 2-to-1 的 mux 去選', 'rt 或 rd，選出來才接到 write address');
  },
], DPC);

scene('cpu-merge', '15A：合併 R-type 與 load／store：ALUSrc、MemtoReg', [
  async (tok, S) => {   // 1 合併兩種指令
    S.D = dpAdd(dpNew(), ['PC', 'IM', 'RF', 'ALU', 'SE', 'DM'], ['pc_im', 'ins', 'rs', 'rt', 'imm', 'rd1', 'alu_dm', 'rd2_dm']); rfPorts(S.D);
    cap('把 add / subtract 跟 load / store 合併', '同一個 datapath 要能執行兩種指令');
  },
  async (tok, S) => {   // 2 第一個 operand 永遠 rs
    cap('ALU 的第一個 operand：永遠是 rs', '只有一種可能，不用選');
    const m = await along(S.D, tok, ['rs', 'rd1'], 'rs', CC.purple, 800); kill(m);
  },
  async (tok, S) => {   // 3 第二個 operand 有兩種來源
    S.w1 = line(CW.rd2A, CC.red); S.w2 = line(CW.seA, CC.red);
    cap('第二個 operand：可能來自 register file（R-type）', '也可能來自 sign extension（load / store）');
    S.x = small(bad('兩個來源接同一個 input', 1.4, 1.6), 10);
  },
  async (tok, S) => {   // 4 ALUSrc mux
    gone(S.w1, S.w2, S.x);
    dpAdd(S.D, ['MUXA'], ['rd2', 'se_m', 'ma_alu']); glow(S.D.c.MUXA, HL);
    cap('加一個 2-to-1 mux，control 叫 ALUSrc', '');
  },
  async (tok, S) => {   // 5 ALUSrc = 0 / 1
    cap('ALUSrc = 0：從 register（rt）', 'ALUSrc = 1：從 sign extension');
    S.s0 = small(pl('0：busB', 0.2, 3.55), 9); S.s1 = small(pl('1：imm', 0.2, 2.35), 9);
    sflag(S.D, 'ALUSrc', '0 / 1');
  },
  async (tok, S) => {   // 6 寫回有兩種來源
    glow(S.D.c.MUXA, null);
    S.w3 = line(CW.wbA, CC.red); S.w4 = line(CW.wbM, CC.red);
    cap('寫回 register file 的 data 也有兩種來源', 'ALU 算完的結果，或 memory 讀出來的（load）');
  },
  async (tok, S) => {   // 7 MemtoReg mux
    gone(S.w3, S.w4);
    dpAdd(S.D, ['MUXM'], ['alu_m', 'dm_m', 'wb']); glow(S.D.c.MUXM, HL);
    cap('所以這裡又要一個 2-to-1 mux', 'control signal 叫 MemtoReg');
  },
  async (tok, S) => {   // 8 1 = load、0 = R-type
    cap('MemtoReg = 1：load（memory 的資料）', 'MemtoReg = 0：R-type（ALU 的結果）');
    sflag(S.D, 'MemtoReg', '0 / 1');
    S.m0 = small(pl('0：ALU', 6.3, 2.75), 9); S.m1 = small(pl('1：Mem', 6.3, 3.65), 9);
  },
], DPC);

scene('cpu-quiz3', '15A：問答：R-type 與 load 的 ALUSrc、MemtoReg', [
  async (tok, S) => {   // 1 R-type 的 ALUSrc
    S.D = fullDP(); ['MUXD', 'MUXP', 'AND', 'BADD', 'SL2'].forEach((k) => { kill(S.D.c[k]); delete S.D.c[k]; });
    cap('R-type：ALUSrc 要設多少？', '第二個 operand 來自 register file → 0');
    sflag(S.D, 'ALUSrc', CT.R[1]); glow(S.D.c.MUXA, HL);
  },
  async (tok, S) => {   // 2 R-type 的 MemtoReg
    glow(S.D.c.MUXA, null);
    cap('R-type：MemtoReg 設 1 還是 0？', '寫回 ALU 的結果 → 0');
    sflag(S.D, 'MemtoReg', CT.R[2]); glow(S.D.c.MUXM, HL);
    S.k1 = ok(CT.R[1] === 0 && CT.R[2] === 0, 'R-type：ALUSrc 0、MemtoReg 0', 3.6, 7.4);
  },
  async (tok, S) => {   // 3 load 的 ALUSrc
    glow(S.D.c.MUXM, null); gone(S.k1);
    cap('load：ALUSrc 要設多少？', '第二個 operand 是 offset → 1');
    sflag(S.D, 'ALUSrc', CT.lw[1]); glow(S.D.c.MUXA, HL);
  },
  async (tok, S) => {   // 4 load 的 MemtoReg
    glow(S.D.c.MUXA, null);
    cap('load：MemtoReg 要設多少？', '寫回 memory 讀出的資料 → 1');
    sflag(S.D, 'MemtoReg', CT.lw[2]); glow(S.D.c.MUXM, HL);
    S.k2 = ok(CT.lw[1] === 1 && CT.lw[2] === 1, 'lw：ALUSrc 1、MemtoReg 1', 3.6, 7.4);
  },
  async (tok, S) => {   // 5 write register 前面要不要 mux？
    glow(S.D.c.MUXM, null);
    cap('這張圖還不完整：write register 前面要不要 mux？', '');
    S.q = small(hot('？', -2.4, 2.8), 12);
  },
  async (tok, S) => {   // 6 要：rt 或 rd
    gone(S.q);
    dpAdd(S.D, ['MUXD']); glow(S.D.c.MUXD, HL);
    cap('要：load 寫 rt，R-type 寫 rd', '用 2-to-1 mux 決定 destination 地址（RegDst）');
    sflag(S.D, 'RegDst', 'rt / rd');
  },
], DPC);

scene('cpu-beqdp', '15A：加入 beq：ALU 減法、branch target adder', [
  async (tok, S) => {   // 1 第三類：branch
    S.D = dpAdd(dpNew(), ['PC', 'IM', 'ADD4', 'RF'], ['pc_im', 'ins', 'pc_add', 'four']); rfPorts(S.D);
    cap('加第三類指令：branch（也是 I-type）', '');
  },
  async (tok, S) => {   // 2 比較 rs、rt
    cap('beq：比較 rs 和 rt 有沒有 equal', '相等就跳到新的 address，不是 PC + 4');
  },
  async (tok, S) => {   // 3 用 ALU 做減法
    dpAdd(S.D, ['ALU'], ['rs', 'rt', 'rd1']); cw(S.D, 'rd2A');
    cap('怎麼比較？用 ALU 做減法就好', '');
  },
  async (tok, S) => {   // 4 新地址怎麼算
    cap('還要算新的 target address', 'PC + 4 不管怎樣都已經先算好了');
    S.t = small(hot('target = PC + 4 + offset × 4', 0.0, 7.3), 10);
  },
  async (tok, S) => {   // 5 要先算好
    cap('要先把地址算好', '不能等到確定要跳才算，那樣來不及');
  },
  async (tok, S) => {   // 6 rs、rt 讀出 → 減 → Zero
    const a = 7, b = 7, d = a - b;
    cap('rs、rt 讀出來，ALU 做減', '減出來不等於 0 → not equal；= 0 → equal');
    const [x, y] = await Promise.all([along(S.D, tok, ['rs', 'rd1'], String(a), CC.purple, 700), flow(tok, CW.rd2A, String(b), CC.purple, 700)]); kill(x); kill(y);
    dpAdd(S.D, [], ['zero']);
    const z = await along(S.D, tok, ['zero'], 'Z=' + (d === 0 ? 1 : 0), CC.green, 500);
    S.z = z; S.k = ok(d === 0, '示意：7 − 7 = ' + d + ' → Zero = 1', 3.0, 1.6);
  },
  async (tok, S) => {   // 7 另一個加法器
    dpAdd(S.D, ['BADD', 'SE'], ['pc4_b', 'imm']);
    cap('需要另一個加法器', '專門算 branch 的 target address');
    const m = await along(S.D, tok, ['pc4_b'], 'PC+4', CC.orange, 800); kill(m);
  },
  async (tok, S) => {   // 8 offset shift left 2，加上 PC + 4
    dpAdd(S.D, ['SL2'], ['se_sl', 'sl_b']);
    const pc4 = 1004, off = 3, tgt = pc4 + (off << 2);
    cap('後 16 bits：sign extend、left shift 2 位', '再加上 PC + 4 = branch target');
    const m = await along(S.D, tok, ['imm'], String(off), CC.teal, 400); kill(m);
    const n = await along(S.D, tok, ['se_sl', 'sl_b'], '3×4', CC.teal, 700); kill(n);
    S.k2 = ok(tgt === 1016, '示意：PC + 4 = 1004、offset 3 → 1004 + 12 = ' + tgt, 0.0, 7.3); gone(S.t);
  },
  async (tok, S) => {   // 9 mux 選 PC + 4 或 target
    dpAdd(S.D, ['MUXP', 'AND'], ['pc4_m', 'b_m', 'and_m', 'pc_next']);
    cap('要不要跳：用 2-to-1 mux 選', 'PC + 4 或剛算好的 target');
    glow(S.D.c.MUXP, HL);
  },
  async (tok, S) => {   // 10 equal 才跳
    cap('答案 equal（Zero = 1）就跳', '不是的話就不跳，選 PC + 4');
    const m = await along(S.D, tok, ['and_m'], '1', CC.green, 400); kill(m);
    const n = await along(S.D, tok, ['b_m', 'pc_next'], '1016', CC.orange, 1300); kill(n);
  },
], DPC);

scene('cpu-full', '15A：完整的單週期 datapath：每個 mux 為什麼在那裡', [
  async (tok, S) => {   // 1 完整圖
    S.D = fullDP();
    cap('完整的 single cycle implementation', '只做三大類指令，但已經包含最主要的類別');
  },
  async (tok, S) => {   // 2 PC 與 PC + 4
    dpLit(S.D, ['PC', 'ADD4']); wOn(S.D, ['pc_add', 'four', 'pc4_m', 'pc4_b']);
    cap('PC 讀出來，跟 + 4 產生下一個 sequential address', '');
  },
  async (tok, S) => {   // 3 branch target
    wiresOff(S.D); dpLit(S.D, ['SL2', 'BADD']); wOn(S.D, ['se_sl', 'sl_b', 'pc4_b']);
    cap('beq：sign extension 的值 shift 兩位，加上 PC + 4', '算出 branch target');
  },
  async (tok, S) => {   // 4 決定要不要跳
    wiresOff(S.D); dpLit(S.D, ['MUXP', 'AND']); wOn(S.D, ['b_m', 'pc4_m', 'and_m', 'pc_next']);
    cap('這個 mux 決定要不要跳', '選出來的就是 next instruction 的地址，寫回 PC');
  },
  async (tok, S) => {   // 5 rs、rt 接 register file；rt 也 fan out
    wiresOff(S.D); dpLit(S.D, ['RF']); wOn(S.D, ['rs', 'rt', 'rt_m']);
    cap('rs、rt 接到 register file 的兩個讀地址', 'rt 也可能是 destination → 多一個 fan out');
  },
  async (tok, S) => {   // 6 RegDst mux
    wiresOff(S.D); dpLit(S.D, ['MUXD']); wOn(S.D, ['rt_m', 'rd', 'wr']);
    cap('寫回的地址可能是 rt 也可能是 rd', '所以要 2-to-1 mux：control signal = RegDst');
    sflag(S.D, 'RegDst', '0 / 1');
  },
  async (tok, S) => {   // 7 ALUSrc mux
    wiresOff(S.D); dpLit(S.D, ['MUXA']); wOn(S.D, ['rd2', 'se_m', 'ma_alu', 'rd1']);
    cap('ALU 第一個 operand 直接接 rs', '第二個：register 或 sign extension → ALUSrc mux');
    sflag(S.D, 'ALUSrc', '0 / 1');
  },
  async (tok, S) => {   // 8 MemtoReg mux
    wiresOff(S.D); dpLit(S.D, ['MUXM']); wOn(S.D, ['alu_m', 'dm_m', 'wb']);
    cap('寫回 register file：R-type 直接寫 ALU 結果', 'load 寫 memory 讀出的資料 → MemtoReg mux');
    sflag(S.D, 'MemtoReg', '0 / 1');
  },
  async (tok, S) => {   // 9 最重要的一張圖
    wiresOff(S.D); ['MUXD', 'MUXA', 'MUXM', 'MUXP'].forEach((k) => glow(S.D.c[k], HL));
    cap('這張圖最重要：學會了就會 pipeline', '把每一條線的原因都找出來');
  },
], DPC);

scene('cpu-addflow', '15A：add 在完整 datapath 上怎麼走', [
  async (tok, S) => {   // 1 add 的 data flow
    S.D = fullDP();
    cap('看 add 的 data flow：資料怎麼跑', 'add $t1, $t2, $t3（示意：$t2 = 7、$t3 = 5）');
  },
  async (tok, S) => {   // 2 PC 告訴要去哪拿
    lit(S.D, ['PC']);
    cap('一開始 PC 告訴我們去哪裡拿 instruction', '');
    const m = await along(S.D, tok, ['pc_im'], 'PC', CC.gold, 600); kill(m);
  },
  async (tok, S) => {   // 3 拿出 rs、rt、rd，讀 register file
    lit(S.D, ['IM', 'RF']);
    cap('從 instruction memory 拿出來', 'rs、rt、rd 出來，access register file');
    const a = await along(S.D, tok, ['ins'], 'add', CC.blue, 400); kill(a);
    const [b, c, d] = await Promise.all([along(S.D, tok, ['rs'], 'rs', CC.purple, 600), along(S.D, tok, ['rt'], 'rt', CC.purple, 600), along(S.D, tok, ['rd', 'wr'], 'rd', CC.purple, 600)]); [b, c, d].forEach(kill);
  },
  async (tok, S) => {   // 4 PC + 4
    lit(S.D, ['ADD4']);
    cap('同時 PC increment by 4', '');
    const m = await along(S.D, tok, ['pc_add'], 'PC', CC.gold, 500); kill(m);
    S.p4 = await along(S.D, tok, ['pc4_m'], 'PC+4', CC.orange, 600);
  },
  async (tok, S) => {   // 5 ALUSrc = 0
    lit(S.D, ['MUXA', 'ALU']);
    cap('第一、第二個 operand 讀出來', '注意：ALUSrc = 0，第二個 operand 從 register file 來');
    sflag(S.D, 'ALUSrc', CT.R[1]);
    const [a, b] = await Promise.all([along(S.D, tok, ['rd1'], '7', CC.lilac, 600), along(S.D, tok, ['rd2', 'ma_alu'], '5', CC.lilac, 700)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 6 也會去讀 memory，但不取
    lit(S.D, ['DM']);
    cap('ALU 的結果也接到 data memory（fan out），它也會去讀', '讀就讀，我們不會取它的值');
    const m = await along(S.D, tok, ['alu_dm'], String(7 + 5), CC.orange, 500); S.dmT = m;
  },
  async (tok, S) => {   // 7 MemtoReg mux 選 ALU
    kill(S.dmT); lit(S.D, ['MUXM']);
    cap('因為有 mux 控制：MemtoReg = 0', '選 ALU 這條路寫回去');
    sflag(S.D, 'MemtoReg', CT.R[2]);
    const m = await along(S.D, tok, ['alu_m'], String(7 + 5), CC.orange, 700); S.wbT = m;
  },
  async (tok, S) => {   // 8 clock edge 才寫
    kill(S.wbT);
    cap('結果早就算好、在那裡等著', 'clock edge 來了才寫進 register file（$t1 = 12），PC 也同時更新');
    const [a, b] = await Promise.all([along(S.D, tok, ['wb'], '12', CC.green, 1100), along(S.D, tok, ['pc_next'], 'PC+4', CC.orange, 1100)]); kill(a); kill(b); kill(S.p4);
    S.k = ok(7 + 5 === 12, '示意：$t1 = 7 + 5 = 12', -4.0, -0.4);
  },
], DPC);

scene('cpu-clock3', '15A：clock period 要設成最長的 delay', [
  async (tok, S) => {   // 1 clocking methodology
    cap('clocking methodology', 'transition：data available，開始運算');
    S.c = wave([0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1], -5.2, 5.6, 0.8, 0.6, CC.brown); pl('clock', -6.0, 5.9);
    S.a = arrow(V3(-4.4, 4.9, 0), V3(-4.4, 5.6, 0), 0x0f5a3a);
  },
  async (tok, S) => {   // 2 全部算完才下一個 edge
    cap('全部計算完畢，下一個 0 → 1 transition 才能來', '新的局面開始');
    S.calc = cube('計算中…', CC.sky, [5.6, 0.5, 0.3], -1.6, 4.4, 0);
    S.b = arrow(V3(2.8, 4.9, 0), V3(2.8, 5.6, 0), 0x0f5a3a);
  },
  async (tok, S) => {   // 3 clock period = 最長 delay
    cap('clock period 設成最長的那條 path 的 delay', '否則有的 path 還沒算完就 latch，資料錯誤');
    S.r = mt('clock period ≥ longest path delay', 0, 3.2, 14, 'ptr alt');
  },
]);

scene('cpu-rtime', '15A：R-type 的 register-to-register timing', [
  async (tok, S) => {   // 1 register to register timing
    S.sc = 0.012; S.x0 = -5.8;
    cap('R-type 的 timing：register to register', '從一個 edge 開始，到寫回 register 為止');
    hd('R-type（示意 ps）', -4.6, 6.8);
    S.ax = line([[S.x0, 6.2], [S.x0 + 800 * S.sc, 6.2]], CC.brown);
  },
  async (tok, S) => {   // 2 clock edge
    cap('新的 clock edge trigger', '（這張投影片是 negative edge）');
    S.e = arrow(V3(S.x0, 5.2, 0), V3(S.x0, 6.2, 0), 0x0f5a3a);
  },
  async (tok, S) => {   // 3 clock-to-Q
    cap('data 進到 PC，要一點點時間 output 才看得到', '叫 clock-to-Q delay');
    S.b = tbars([['clk→Q', 0, TD.clkq, CC.gold]], S.x0, 5.4, S.sc);
  },
  async (tok, S) => {   // 4 instruction memory access
    cap('用 PC 去讀 instruction memory', 'instruction memory access time');
    S.b2 = tbars([['IM', TD.clkq, TD.im, CC.blue]], S.x0, 5.4, S.sc);
  },
  async (tok, S) => {   // 5 control decode
    const t = TD.clkq + TD.im;
    cap('instruction 出來：controller 要 decode', '才知道 mux 要設 0 還是 1 → control delay');
    S.b3 = tbars([['Ctrl', t, TD.ctrl, CC.brown, 1]], S.x0, 5.4, S.sc);
  },
  async (tok, S) => {   // 6 register file access
    const t = TD.clkq + TD.im;
    cap('同時用 rs、rt 去讀 register file', 'register file access 也有 delay');
    S.b4 = tbars([['Reg', t, TD.reg, CC.purple]], S.x0, 5.4, S.sc);
  },
  async (tok, S) => {   // 7 ALU delay
    const t = TD.clkq + TD.im + Math.max(TD.ctrl, TD.reg);
    S.R = t + TD.alu;
    cap('讀出來之後 ALU 計算：ALU delay', 'ALU 算完 data ready，clock 才能 transition');
    S.b5 = tbars([['ALU', t, TD.alu, CC.orange]], S.x0, 5.4, S.sc);
    S.t = small(pl(S.R + ' ps', S.x0 + S.R * S.sc + 0.6, 5.4), 10);
  },
  async (tok, S) => {   // 8 decode 和 register access 可以同時
    cap('control decode 和 register access 可以同時做', '取比較長的那個就好');
    S.k = ok(Math.max(TD.ctrl, TD.reg) === TD.reg, 'max(Ctrl ' + TD.ctrl + ', Reg ' + TD.reg + ') = ' + Math.max(TD.ctrl, TD.reg), -1.4, 3.8);
  },
  async (tok, S) => {   // 9 有的並行、有的要接續
    const sum = TD.clkq + TD.im + Math.max(TD.ctrl, TD.reg) + TD.alu;
    cap('ALU 一定要等 register 讀出來才能算：接續', '找最長的 path：R-type = ' + sum + ' ps（示意）');
    S.k2 = ok(sum === S.R, TD.clkq + ' + ' + TD.im + ' + ' + Math.max(TD.ctrl, TD.reg) + ' + ' + TD.alu + ' = ' + sum + ' ps（示意）', -1.4, 3.1);
  },
]);

scene('cpu-lwtime', '15A：critical path：load', [
  async (tok, S) => {   // 1 最長的是 load
    S.sc = 0.0095; S.x0 = -5.8;
    cap('哪個指令最長？load', '算完地址還要去 memory 拿東西');
    hd('lw 的 critical path（示意 ps）', -3.6, 6.8);
  },
  async (tok, S) => {   // 2 critical path
    const t1 = TD.clkq + TD.im + Math.max(TD.ctrl, TD.reg);
    cap('critical path：最長的 path', '一樣：clock-to-Q、instruction memory、decode / register access、ALU');
    S.b = tbars([['clk→Q', 0, TD.clkq, CC.gold], ['IM', TD.clkq, TD.im, CC.blue], ['Reg', TD.clkq + TD.im, TD.reg, CC.purple], ['ALU', t1, TD.alu, CC.orange]], S.x0, 5.6, S.sc);
  },
  async (tok, S) => {   // 3 data memory access
    S.t2 = TD.clkq + TD.im + Math.max(TD.ctrl, TD.reg) + TD.alu;
    cap('ALU 算出的只是地址', '還要 access data memory，讀完才寫回 → 更長');
    S.b2 = tbars([['DM', S.t2, TD.dm, CC.green]], S.x0, 5.6, S.sc);
  },
  async (tok, S) => {   // 4 全部列出來
    cap('clock-to-Q、IM、Reg、ALU、data memory', '還有寫 register file 的 setup time');
    S.L = lister(-5.8, 4.4, 0.5);
    S.L('clk→Q ' + TD.clkq + ' + IM ' + TD.im + ' + Reg ' + TD.reg + ' + ALU ' + TD.alu + ' + DM ' + TD.dm, 'idx');
  },
  async (tok, S) => {   // 5 setup time
    S.t3 = S.t2 + TD.dm;
    cap('setup time：clock 來之前 data 要先準備好', '不能 clock 來的時候才急急忙忙在變');
    S.b3 = tbars([['setup', S.t3, TD.setup, CC.pink]], S.x0, 5.6, S.sc);
  },
  async (tok, S) => {   // 6 clock skew
    S.t4 = S.t3 + TD.setup;
    cap('clock skew：clock 有的先到有的後到', '用最壞的狀況，再把 clock 拉長一點');
    S.b4 = tbars([['skew', S.t4, TD.skew, CC.red]], S.x0, 5.6, S.sc);
  },
  async (tok, S) => {   // 7 總和 = clock period
    const tot = TD.clkq + TD.im + TD.reg + TD.alu + TD.dm + TD.setup + TD.skew;
    cap('真正最長的 path 到這裡：clock period 要這麼長', 'lw = ' + tot + ' ps（示意）');
    S.k = ok(tot === S.t4 + TD.skew, TD.clkq + '+' + TD.im + '+' + TD.reg + '+' + TD.alu + '+' + TD.dm + '+' + TD.setup + '+' + TD.skew + ' = ' + tot + ' ps', 0, 3.4);
    S.ln = line([[S.x0 + tot * S.sc, 6.4], [S.x0 + tot * S.sc, 4.9]], CC.red);
  },
]);

scene('cpu-ctrl3', '15A：Control：datapath 走哪條路', [
  async (tok, S) => {   // 1 control
    S.D = fullDP();
    cap('datapath 算簡單的，再來是 control', '');
  },
  async (tok, S) => {   // 2 PC source、跳不跳
    glow(S.D.c.MUXP, HL);
    cap('PC 的 source 從哪裡來？跳還是不跳？', 'register 要不要 write？destination 是 rt 還是 rd？');
    sflag(S.D, 'PCSrc', '?'); sflag(S.D, 'RegWrite', '?'); sflag(S.D, 'RegDst', '?');
  },
  async (tok, S) => {   // 3 就是 mux 的 control signal
    ['MUXD', 'MUXA', 'MUXM'].forEach((k) => glow(S.D.c[k], HL));
    cap('這些都是 control signal', '就是那些 2-to-1 mux 的 select');
    sflag(S.D, 'ALUSrc', '?'); sflag(S.D, 'MemtoReg', '?');
  },
  async (tok, S) => {   // 4 datapath 也回傳訊號：Zero
    wOn(S.D, ['zero']); glow(S.D.c.AND, HL);
    cap('controller 用 control signal 控制 datapath', 'datapath 也回傳訊號給它：例如 beq 減出來 = 0（Zero）');
  },
  async (tok, S) => {   // 5 controller 從 opcode 發出所有 control
    lit(S.D, ['CTRL']); wOn(S.D, ['op']);
    cap('control 決定每個指令走哪條路徑', 'Controller 從 opcode 發出這些 control signals');
  },
  async (tok, S) => {   // 6 random logic
    cap('control logic 是 random logic：沒有規則', '不像加法器每個 bit 都一樣（regular logic）');
    S.n = small(note('control = random logic；adder = regular logic', 0, -0.4), 11);
  },
], DPC);

scene('cpu-regular', '15A：MIPS format 一致，control 才簡單', [
  async (tok, S) => {   // 1 MIPS 的設計好在哪
    cap('MIPS 的 instruction set 設計得好', '看完 datapath 就知道為什麼');
    pl('R', -6.2, 6.0); S.R = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]], -5.8, 6.0, 11.4, 0.5);
    pl('I', -6.2, 4.6); S.I = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['immediate', 16, CC.teal]], -5.8, 4.6, 11.4, 0.5);
  },
  async (tok, S) => {   // 2 op code 永遠在前 6 bits
    [S.R, S.I].forEach((b) => glow(b[0], HL));
    cap('op code 永遠在前 6 bits（31–26）', '拿出來就知道是什麼 instruction');
  },
  async (tok, S) => {   // 3 format 越一致越簡單
    cap('format 越一致，設計越簡單', '位置不固定的話，每個可能都要接、都要用 mux 選');
  },
  async (tok, S) => {   // 4 rs 永遠固定
    [S.R, S.I].forEach((b) => { glow(b[0], null); glow(b[2], HL); glow(b[4], HL); });
    cap('要讀的 register：rs 永遠在同一個位置，第二個是 rt', 'R-type、beq、store 都讀 rt');
  },
  async (tok, S) => {   // 5 base 在 rs、offset 在後 16 bits
    glow(S.I[6], HL);
    cap('base register 永遠在 rs', 'offset 一定在後 16 bits（beq、load、store）');
  },
  async (tok, S) => {   // 6 destination：rt 或 rd
    [S.R, S.I].forEach((b) => b.filter((m) => m.isMesh).forEach((m) => glow(m, null))); glow(S.R[6], HL); glow(S.I[4], HL);
    cap('destination register：rt 或 rd', '只有這裡不一致');
    S.q = small(bad('R：rd　lw：rt', 3.6, 3.6), 11);
  },
  async (tok, S) => {   // 7 所以要 mux
    cap('沒關係，用一個 mux 選 destination 的 address', 'format 越不一致，就要越多 mux');
    S.m = bx('MUX（RegDst）', CC.mux, 0, 2.6, 2.2, 0.8); glow(S.m, HL);
  },
]);

scene('cpu-ctrlunit', '15A：Controller：輸入 opcode，輸出 control signals', [
  async (tok, S) => {   // 1 control signal 是什麼
    S.D = fullDP();
    cap('control signal 是什麼？', '就是圖上這些控制點：要設出正確的值');
    Object.keys(SIGPOS).forEach((s) => small(tag(s, 'idx', SIGPOS[s][0], SIGPOS[s][1]), 9));
  },
  async (tok, S) => {   // 2 register 要不要 write
    glow(S.D.c.RF, HL);
    cap('例如 register file：給了 address 不代表要 write', '還要 RegWrite = 1 才寫');
  },
  async (tok, S) => {   // 3 memory 也一樣
    glow(S.D.c.RF, null); glow(S.D.c.DM, HL);
    cap('memory 也一樣：MemWrite = 1 才寫', '否則它就一直在讀');
  },
  async (tok, S) => {   // 4 Controller 發出所有 signal
    glow(S.D.c.DM, null); lit(S.D, ['CTRL']);
    cap('Controller 把所有 control signal 發出來', '去控制不同的地方');
    for (const s of ['RegDst', 'ALUSrc', 'MemtoReg', 'RegWrite']) { const [x, y] = SIGPOS[s]; S[s] = line([[-2.4, 5.4], [x, y + 0.2]], CC.blue); }
  },
  async (tok, S) => {   // 5 input 是 opcode
    wOn(S.D, ['op']);
    cap('Controller 的 input 是什麼？最主要是 opcode', '知道 opcode 就知道是什麼 instruction');
    const m = await along(S.D, tok, ['op'], 'op', CC.brown, 700); kill(m);
  },
  async (tok, S) => {   // 6 接到各個 mux
    ['MUXD', 'MUXA', 'MUXM'].forEach((k) => glow(S.D.c[k], HL));
    cap('control signals 分別接到 mux 的 select', '去控制這些 mux');
  },
], DPC);

scene('cpu-twonot', '15A：兩個不是直接由 opcode 決定的：PCSrc 與 ALU control', [
  async (tok, S) => {   // 1 有兩個不是立刻出來
    S.D = fullDP();
    cap('注意：有幾個不是 Controller 立刻就能決定的', '');
  },
  async (tok, S) => {   // 2 RegDst 立刻知道
    glow(S.D.c.MUXD, OKG);
    cap('像 destination 是什麼：Controller 一分析就知道', '立刻接過去');
    sflag(S.D, 'RegDst', 'opcode 決定');
  },
  async (tok, S) => {   // 3 下一個 instruction 在哪
    glow(S.D.c.MUXP, HL);
    cap('第一個例外：下一個 instruction 在哪裡（PCSrc）', 'Controller 只知道它是 branch');
  },
  async (tok, S) => {   // 4 要看 equal
    wOn(S.D, ['zero']);
    cap('是 branch 也不一定跳', '要看 ALU 減出來是不是 0（equal）');
  },
  async (tok, S) => {   // 5 AND gate
    glow(S.D.c.AND, HL); wOn(S.D, ['and_m']);
    const t = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([b, z]) => b & z);
    cap('所以用一個 AND gate：Branch AND Zero', '兩個紅色的都成立，才有綠色的 decision（PCSrc）');
    S.k = ok(t.join('') === '0001', 'PCSrc = Branch · Zero（只有 1·1 = 1）', 3.6, 7.6);
  },
  async (tok, S) => {   // 6 ALU 的 operation
    wiresOff(S.D); glow(S.D.c.ALUC, HL); wOn(S.D, ['alc']);
    cap('第二個例外：ALU 要做什麼 operation', '');
  },
  async (tok, S) => {   // 7 ALU control 的 code
    cap('ALU 設計時：0010 做加', '0000 AND、0001 OR、0110 減、0111 slt');
    S.c = mt('0000 AND  0001 OR  0010 add  0110 sub  0111 slt', 0.6, -0.3, 11);
  },
  async (tok, S) => {   // 8 R-type 看 opcode 不知道
    cap('R-type 只看 opcode 能知道嗎？不行', 'R-type 的 opcode 都一樣（000000），要看 funct');
    wOn(S.D, ['fn']);
  },
  async (tok, S) => {   // 9 第二層 decoder
    cap('所以有第二個 stage 的 decoder：ALU control', 'opcode + funct 才知道要做什麼');
  },
  async (tok, S) => {   // 10 lw/sw、beq 看 opcode 就知道
    cap('但 load / store 看 opcode 就知道要做加（算地址）', 'branch 就知道要做減：opcode 給了部分資訊');
    S.g = small(note('opcode → 哪一個 group：加、減、或要看 funct', 3.6, 1.5), 10);
  },
  async (tok, S) => {   // 11 ALU control = 部分解碼 + funct
    cap('opcode 做部分的解碼，再加上 funct', '兩個合起來，才決定 ALU control（綠色）');
    const m = await along(S.D, tok, ['fn', 'alc'], 'funct', CC.brown, 900); kill(m);
  },
], DPC);

// ════════ 3Ig6EcOGV3s（第 16A 講：每個指令的 control signals、ALU control 真值表與邏輯式、main control、PLA） ════════
const OPC = { R: 0, lw: 35, sw: 43, beq: 4 };
const ROWN = { R: 'R-format', lw: 'lw', sw: 'sw', beq: 'beq' };
const SIG7 = SIG.slice(0, 7);
// ALU control: inputs ALUOp1 ALUOp0 F5..F0 (8 bits) → 4-bit operation
const AC_ROWS = [['00', 'XXXXXX', '0010', 'lw / sw'], ['01', 'XXXXXX', '0110', 'beq'], ['10', FUNCT.add, aluCtl('10', 'add'), 'add'], ['10', FUNCT.sub, aluCtl('10', 'sub'), 'sub'], ['10', FUNCT.and, aluCtl('10', 'and'), 'and'], ['10', FUNCT.or, aluCtl('10', 'or'), 'or'], ['10', FUNCT.slt, aluCtl('10', 'slt'), 'slt']];
const acOp = (op, f) => (op === '00' ? '0010' : op === '01' ? '0110' : ALUOUT[Object.keys(FUNCT).find((k) => FUNCT[k] === f)]);
// simplified equations (P&H): F = funct bits, a1 a0 = ALUOp
const acEq = (a1, a0, F) => [0, (a0 | (a1 & F[1])) & 1, ((1 - a1) | (1 - F[2])) & 1, (a1 & (F[3] | F[0])) & 1].join('');
const fbits = (s) => [...s].reverse().map(Number);   // F[0] = rightmost bit
// main control truth table (from this chapter's CT); RegWrite etc. as OR of decoded opcodes
const decode = (op) => Object.keys(OPC).find((k) => OPC[k] === op);
function ctlTable(x0, y0, cw = 1.25, rh = 0.62, keys = ['R', 'lw', 'sw', 'beq']) {
  const T = { cells: {}, heads: [] };
  keys.forEach((k, j) => { T.heads.push(small(tag(ROWN[k], 'ptr alt', x0 + (j + 1) * cw, y0), 11)); T.heads.push(small(mt(toB(OPC[k], 6), x0 + (j + 1) * cw, y0 - 0.45, 10), 10)); });
  SIG.forEach((s, i) => { T.heads.push(small(tag(s, 'ptr', x0 - 0.2, y0 - 1.05 - i * rh), 10)); });
  T.show = (k) => { const j = keys.indexOf(k); T.cells[k] = CT[k].map((v, i) => cube(v, v === 1 ? CC.green : v === 0 ? CC.sand : CC.gray, [cw - 0.12, rh - 0.1, 0.4], x0 + (j + 1) * cw, y0 - 1.05 - i * rh, 0)); T.cells[k].forEach((m) => small(m.userData.lbl, 10)); return T.cells[k]; };
  return T;
}

scene('cpu-recap4', '16A：回顧：datapath 靠 mux 共用，controller 決定 control signal', [
  async (tok, S) => {   // 1 single cycle：datapath + control
    S.D = fullDP();
    cap('Single cycle：datapath 與 control', 'datapath 一個指令一個指令找出來，再 merge');
  },
  async (tok, S) => {   // 2 一個 input 只能一個來源 → mux
    ['MUXD', 'MUXA', 'MUXM', 'MUXP'].forEach((k) => glow(S.D.c[k], HL));
    cap('一個 output 可以 fan out，一個 input 只能有一個來源', '靠這些 mux 決定從哪個 source 過來');
  },
  async (tok, S) => {   // 3 instruction → controller → control signals
    ['MUXD', 'MUXA', 'MUXM', 'MUXP'].forEach((k) => glow(S.D.c[k], null)); lit(S.D, ['CTRL']);
    cap('instruction → controller → control signals', '大部分只看 instruction 就能決定');
    const m = await along(S.D, tok, ['op'], 'op', CC.brown, 700); kill(m);
  },
  async (tok, S) => {   // 4 有時要看 datapath 的結果：equal
    wOn(S.D, ['zero']); glow(S.D.c.AND, HL);
    cap('有時還要 datapath 的結果', '例如 branch：比較兩個 register 一不一樣（equal）');
  },
  async (tok, S) => {   // 5 datapath 回傳給 controller
    cap('比對在 datapath 做', 'datapath 把結果交給 controller 決定 control signal');
    const m = await along(S.D, tok, ['zero', 'and_m'], 'Zero', CC.green, 900); kill(m);
  },
], DPC);

scene('cpu-obs4', '16A：main control 的觀察：欄位位置固定', [
  async (tok, S) => {   // 1 main controller
    cap('main controller：很重要的 observation', '因為 instruction 的設計方式');
    pl('R', -6.2, 6.4); S.R = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]], -5.8, 6.4, 11.4, 0.5);
    pl('lw/sw', -6.4, 5.2); S.L = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['address', 16, CC.teal]], -5.8, 5.2, 11.4, 0.5);
    pl('beq', -6.3, 4.0); S.B = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['address', 16, CC.teal]], -5.8, 4.0, 11.4, 0.5);
    S.all = [S.R, S.L, S.B];
  },
  async (tok, S) => {   // 2 op code 在 bits 31–26
    S.all.forEach((b) => glow(b[0], HL));
    cap('op code 一定在同一個地方：bits 31–26', '');
  },
  async (tok, S) => {   // 3 兩個讀的 register：rs、rt
    S.all.forEach((b) => { glow(b[0], null); glow(b[2], HL); glow(b[4], HL); });
    cap('要讀的兩個 register：rs、rt', 'bits 25–21、20–16');
  },
  async (tok, S) => {   // 4 rt 有時是 destination
    S.all.forEach((b) => glow(b[2], null)); glow(S.R[4], null); glow(S.B[4], null); glow(S.R[6], HL);
    cap('destination：load 是 rt，R-type 是 rd', '所以這裡有 mux');
    S.d = small(bad('寫入：rt（lw）或 rd（R）', 3.0, 7.1), 10);
  },
  async (tok, S) => {   // 5 base 永遠在 rs
    S.all.forEach((b) => b.filter((m) => m.isMesh).forEach((m) => glow(m, null))); glow(S.L[2], HL);
    cap('load / store 的 base register 永遠在 rs', '考試考過：rs 當 base，加 offset 就是 memory 地址');
  },
  async (tok, S) => {   // 6 immediate
    glow(S.L[2], null); glow(S.L[6], HL); glow(S.B[6], HL);
    cap('後面 16 bits：offset，也可能是 immediate value', '盡量讓各種 type 共用同一個 format：control 就越簡單');
  },
  async (tok, S) => {   // 7 datapath
    S.all.forEach((b) => gone(b)); gone(S.d);
    S.D = buildDP(99, false); S.D.c && S.D.c.CTRL && glow(S.D.c.CTRL, HL);
    S.D.ex = [];
    cap('上次合成的 datapath', '從前到後有很多控制點');
  },
  async (tok, S) => {   // 8 control points
    cap('RegDst、ALUOp…這些都是 control signal', '待會就是要決定怎麼設這些值');
    Object.keys(SIGPOS).forEach((s) => S.D.ex.push(small(tag(s + ' = ?', 'idx', SIGPOS[s][0], SIGPOS[s][1]), 9)));
  },
], DPC);

scene('cpu-ctrlunit4', '16A：datapath with control unit：main control + ALU control', [
  async (tok, S) => {   // 1 datapath with control unit
    S.D = buildDP(99, false);
    cap('datapath with control unit', '跟剛才不一樣的地方：加上 controller');
  },
  async (tok, S) => {   // 2 controller 的位置
    lit(S.D, ['CTRL', 'ALUC']);
    cap('controller 在這兩個地方', 'opcode 進來 decode，發出 control signals');
  },
  async (tok, S) => {   // 3 還需要 ALU control
    cap('因為 instruction 設計的關係，還需要一個 ALU control', '一個 main controller、一個 ALU control');
    S.n = small(hot('main control + ALU control', 0.6, -0.4), 10);
  },
  async (tok, S) => {   // 4 branch：不能馬上決定
    lit(S.D, ['MUXP', 'AND']); wOn(S.D, ['zero', 'and_m']);
    cap('不能馬上決定的 case 1：branch', '是 branch 而且減出來是 0，才選跳去的地址');
  },
  async (tok, S) => {   // 5 ALU 要做什麼
    wiresOff(S.D); lit(S.D, ['ALU', 'ALUC']);
    cap('case 2：ALU 要做什麼運算？', '看到 opcode 有時知道、有時不知道');
  },
  async (tok, S) => {   // 6 lw / sw：加
    S.g1 = small(good('lw / sw：算地址 → 加', 4.6, 0.6), 10);
    cap('lw / sw：rs 加上 sign-extended immediate', '算 memory 地址 → 知道要做加');
  },
  async (tok, S) => {   // 7 beq：減
    S.g2 = small(good('beq：比較 rs、rt → 減', 4.6, 0.0), 10);
    cap('beq：比較 rs 和 rt', '要做減 → 也知道');
  },
  async (tok, S) => {   // 8 R-type：不知道
    S.g3 = small(bad('R-type：opcode 都是 000000 → ？', 4.6, -0.6), 10);
    cap('R-type：看 opcode（000000）不知道', '要看哪個 field？function');
  },
  async (tok, S) => {   // 9 要多看 function code
    wOn(S.D, ['fn', 'alc']);
    cap('要多一個 function code 才知道', '所以需要一個小的 controller：ALU control');
    const m = await along(S.D, tok, ['fn'], 'funct', CC.brown, 700); kill(m);
  },
  async (tok, S) => {   // 10 兩層 controller
    cap('main control 只告訴你是哪一種 category', '再加 funct，ALU control 決定真正的 control signal');
    const m = await along(S.D, tok, ['alc'], 'ALU ctl', CC.brown, 600); kill(m);
  },
], DPC);

scene('cpu-addctl', '16A：add 的 control signals 一個一個設', [
  async (tok, S) => {   // 1 知道路徑就不難
    S.D = fullDP();
    cap('control logic 看起來沒規則，其實不難', '只要知道 datapath 的路怎麼走，truth table 就出來');
  },
  async (tok, S) => {   // 2 add
    cap('假如要執行 add', '它要設定哪些 control signal？');
    S.t = small(hot('add $rd, $rs, $rt', -4.6, 7.6), 11);
  },
  async (tok, S) => {   // 3 instruction fetch
    lit(S.D, ['PC', 'IM']);
    cap('先 instruction fetch', 'rs、rt、rd 都是地址，接到該接的地方');
    const m = await along(S.D, tok, ['pc_im', 'ins'], 'add', CC.blue, 800); kill(m);
  },
  async (tok, S) => {   // 4 opcode → controller、rs rt → register、funct → ALU control
    lit(S.D, ['CTRL', 'RF', 'ALUC']);
    cap('前 6 bits 進 controller decode', 'rs、rt 接 register file；後面的 funct 接 ALU control');
    const ms = await Promise.all([along(S.D, tok, ['op'], 'op', CC.brown, 700), along(S.D, tok, ['rs'], 'rs', CC.purple, 700), along(S.D, tok, ['rt'], 'rt', CC.purple, 700), along(S.D, tok, ['fn'], 'funct', CC.brown, 700)]); ms.forEach(kill);
  },
  async (tok, S) => {   // 5 ALUSrc？
    wiresOff(S.D); glow(S.D.c.MUXA, HL);
    cap('第二個 operand 的 mux：ALUSrc', 'add 的第二個 operand 從哪裡來？');
    sflag(S.D, 'ALUSrc', '?');
  },
  async (tok, S) => {   // 6 ALUSrc = 0
    sflag(S.D, 'ALUSrc', CT.R[1]);
    cap('從 rt 讀出來 → ALUSrc = 0', '');
    const m = await along(S.D, tok, ['rd2', 'ma_alu'], 'R[rt]', CC.lilac, 700); kill(m);
  },
  async (tok, S) => {   // 7 寫回的 mux
    glow(S.D.c.MUXA, null); glow(S.D.c.MUXM, HL);
    cap('算完要寫回去：又一個 2-to-1 mux（MemtoReg）', '可能從 memory 來，也可能從 ALU 來');
    sflag(S.D, 'MemtoReg', '?');
  },
  async (tok, S) => {   // 8 MemtoReg = 0
    sflag(S.D, 'MemtoReg', CT.R[2]);
    cap('add 從 ALU 過來 → MemtoReg = 0', '');
    const m = await along(S.D, tok, ['alu_m'], 'sum', CC.orange, 700); kill(m);
  },
  async (tok, S) => {   // 9 destination 是 rd
    glow(S.D.c.MUXM, null); glow(S.D.c.MUXD, HL);
    cap('add 的 destination 由 rd 指定', '寫回時要告訴 register file 寫去哪裡');
    sflag(S.D, 'RegDst', '?');
  },
  async (tok, S) => {   // 10 RegDst = 1
    sflag(S.D, 'RegDst', CT.R[0]);
    cap('選 rd → RegDst = 1', '');
    const m = await along(S.D, tok, ['rd', 'wr'], 'rd', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 11 register file 每次都寫嗎？
    glow(S.D.c.MUXD, null); glow(S.D.c.RF, HL);
    cap('register file 每個 cycle 都寫嗎？', 'data、clock 一直都在，要靠一個 control signal 決定寫不寫');
    sflag(S.D, 'RegWrite', '?');
  },
  async (tok, S) => {   // 12 RegWrite = 1
    sflag(S.D, 'RegWrite', CT.R[3]);
    cap('只有 R-type、load 才寫', 'add 的 RegWrite = 1');
  },
  async (tok, S) => {   // 13 beq：RegWrite = 0
    S.b = small(note('beq：RegWrite = ' + CT.beq[3] + '（不寫）', -0.9, 6.3), 10);
    cap('對比：beq 要寫回 register file 嗎？不用', 'RegWrite = 0');
  },
  async (tok, S) => {   // 14 PC 選誰？
    glow(S.D.c.RF, null); glow(S.D.c.MUXP, HL);
    cap('add 的 Program Counter 要選誰？', 'PC + 4，還是 branch target？');
    sflag(S.D, 'PCSrc', '?');
  },
  async (tok, S) => {   // 15 PCSrc = 0
    sflag(S.D, 'PCSrc', 0);
    cap('選 PC + 4 → 這個 mux 設 0', '');
    const m = await along(S.D, tok, ['pc4_m', 'pc_next'], 'PC+4', CC.orange, 1000); kill(m);
  },
  async (tok, S) => {   // 16 每個指令走一遍
    glow(S.D.c.MUXP, null);
    const ok7 = [CT.R[0] === 1, CT.R[1] === 0, CT.R[2] === 0, CT.R[3] === 1].every(Boolean);
    cap('每個指令走一遍，就知道每個 control signal 怎麼設', '這是合成 control logic 的第一步');
    S.k = ok(ok7, 'add：RegDst 1、ALUSrc 0、MemtoReg 0、RegWrite 1、PCSrc 0', -1.2, -0.4);
  },
], DPC);

scene('cpu-lwctl', '16A：lw 的 control signals', [
  async (tok, S) => {   // 1 load
    S.D = fullDP();
    cap('再來 load：每個 signal 設什麼？', 'lw $rt, offset($rs)');
  },
  async (tok, S) => {   // 2 從 fetch 開始
    lit(S.D, ['PC', 'IM']);
    cap('從 instruction fetch 開始', '接著做 ALU computation');
    const m = await along(S.D, tok, ['pc_im', 'ins'], 'lw', CC.blue, 800); kill(m);
  },
  async (tok, S) => {   // 3 第一個 source 是 rs
    lit(S.D, ['RF', 'ALU']);
    cap('第一個 source 是 rs：大家都是 rs', '不用 control signal');
    const m = await along(S.D, tok, ['rs', 'rd1'], 'base', CC.purple, 800); kill(m);
  },
  async (tok, S) => {   // 4 ALUSrc = 1
    glow(S.D.c.MUXA, HL); sflag(S.D, 'ALUSrc', CT.lw[1]);
    cap('第二個 source：16 bits 做 sign extension', 'load 的 ALUSrc = 1');
    const m = await along(S.D, tok, ['imm', 'se_m', 'ma_alu'], 'offset', CC.teal, 900); kill(m);
  },
  async (tok, S) => {   // 5 算出 memory 地址 → 讀 memory
    glow(S.D.c.MUXA, null); lit(S.D, ['DM']);
    cap('算出來是 memory 的 address', '去讀 memory（MemRead = 1）');
    sflag(S.D, 'MemRead', CT.lw[4]);
    const m = await along(S.D, tok, ['alu_dm'], 'addr', CC.orange, 600); kill(m);
  },
  async (tok, S) => {   // 6 MemtoReg = 1
    glow(S.D.c.MUXM, HL); sflag(S.D, 'MemtoReg', CT.lw[2]);
    cap('寫回 register file 的 source：從 memory 來', 'MemtoReg = 1');
    const m = await along(S.D, tok, ['dm_m'], 'data', CC.green, 600); kill(m);
  },
  async (tok, S) => {   // 7 destination 是誰
    glow(S.D.c.MUXM, null); glow(S.D.c.MUXD, HL);
    cap('load 的 destination 由誰指定？', 'rt');
    sflag(S.D, 'RegDst', '?');
  },
  async (tok, S) => {   // 8 RegDst = 0
    sflag(S.D, 'RegDst', CT.lw[0]);
    cap('選 rt → RegDst = 0', '');
    const m = await along(S.D, tok, ['rt_m', 'wr'], 'rt', CC.purple, 600); kill(m);
  },
  async (tok, S) => {   // 9 RegWrite = 1
    glow(S.D.c.MUXD, null); glow(S.D.c.RF, HL); sflag(S.D, 'RegWrite', CT.lw[3]);
    cap('load 要寫回去：RegWrite = 1', '很重要的 control signal');
    const m = await along(S.D, tok, ['wb'], 'data', CC.green, 900); kill(m);
  },
  async (tok, S) => {   // 10 PCSrc = 0
    glow(S.D.c.RF, null); sflag(S.D, 'PCSrc', 0);
    cap('一樣 PC = PC + 4 → PCSrc = 0', '');
    S.k = ok(CT.lw.slice(0, 5).join('') === '01111', 'lw：RegDst 0、ALUSrc 1、MemtoReg 1、RegWrite 1、MemRead 1', -1.2, -0.4);
  },
], DPC);

scene('cpu-beqctl', '16A：beq 的 control signals', [
  async (tok, S) => {   // 1 beq
    S.D = fullDP();
    cap('再來 branch equal', 'beq $rs, $rt, offset');
    lit(S.D, ['RF', 'ALU']);
  },
  async (tok, S) => {   // 2 ALUSrc = 0
    glow(S.D.c.MUXA, HL); sflag(S.D, 'ALUSrc', CT.beq[1]);
    cap('比較 rs 和 rt：第二個 source 是 rt', 'ALUSrc = 0');
    const [a, b] = await Promise.all([along(S.D, tok, ['rd1'], 'rs', CC.lilac, 700), along(S.D, tok, ['rd2', 'ma_alu'], 'rt', CC.lilac, 700)]); kill(a); kill(b);
  },
  async (tok, S) => {   // 3 該不該寫？
    glow(S.D.c.MUXA, null); glow(S.D.c.RF, HL);
    cap('ALU 的值還是會跑到寫回的地方', '這時候該寫嗎？不該');
    const m = await along(S.D, tok, ['alu_m', 'wb'], '?', CC.red, 900); kill(m);
  },
  async (tok, S) => {   // 4 RegWrite = 0
    sflag(S.D, 'RegWrite', CT.beq[3]); sflag(S.D, 'RegDst', 'X'); sflag(S.D, 'MemtoReg', 'X');
    cap('RegWrite = 0：data 雖然都有值，但不會寫進去', '所以 RegDst、MemtoReg 是 don\'t care（X）');
  },
  async (tok, S) => {   // 5 決定要不要跳
    glow(S.D.c.RF, null); lit(S.D, ['AND', 'MUXP']); sflag(S.D, 'Branch', CT.beq[6]);
    cap('比對完：control 決定要不要跳', 'Branch = 1');
    const m = await along(S.D, tok, ['zero', 'and_m'], 'Z', CC.green, 700); kill(m);
  },
  async (tok, S) => {   // 6 equal → PCSrc 選 target
    sflag(S.D, 'PCSrc', 'Branch·Zero');
    cap('equal（Zero = 1）就跳', 'PCSrc 選 branch target');
    const m = await along(S.D, tok, ['b_m', 'pc_next'], 'target', CC.orange, 1000); kill(m);
    S.k = ok(CT.beq[1] === 0 && CT.beq[3] === 0 && CT.beq[6] === 1, 'beq：ALUSrc 0、RegWrite 0、Branch 1', -1.2, -0.4);
  },
], DPC);

scene('cpu-tt', '16A：control 就是一張 truth table', [
  async (tok, S) => {   // 1 truth table
    cap('知道每個 mux 怎麼設之後，合成很簡單', '就是一個 truth table');
    S.T = ctlTable(-3.0, 6.6, 1.5, 0.55);
  },
  async (tok, S) => {   // 2 input → output
    cap('input 跟 output 的關係而已', 'input：opcode；output：每個 control signal');
    S.a1 = small(hot('input（opcode）', 3.8, 7.0), 10); S.a2 = small(hot('output', -5.6, 5.0), 10);
  },
  async (tok, S) => {   // 3 opcode 告訴你 → 設那個值
    cap('opcode 告訴你是哪個指令', '把 output 設成剛才走一遍得到的值');
    for (const k of ['R', 'lw', 'sw', 'beq']) { S.T.show(k); await wt(tok, 250); }
  },
]);

scene('cpu-aluop', '16A：ALUOp：opcode 先分成三組', [
  async (tok, S) => {   // 1 先看 ALU controller
    cap('先看 ALU 的 controller 怎麼設計', '');
    S.b = bx('ALU control', CC.brown, 0, 3.4, 2.4, 1.0);
  },
  async (tok, S) => {   // 2 大部分從 opcode 就知道
    cap('大部分 control signal：opcode 決定後就能發出', 'RegWrite、MemWrite…');
    S.m = bx('Main control', CC.brown, -4.0, 5.8, 2.4, 0.8);
  },
  async (tok, S) => {   // 3 ALU 比較複雜
    cap('ALU 比較複雜', '從 opcode 一半知道、一半不知道');
  },
  async (tok, S) => {   // 4 lw / sw 做加
    S.g1 = bx('lw / sw → 加', CC.green, -4.6, 1.2, 2.2, 0.55);
    cap('lw / sw：知道要做加', '');
  },
  async (tok, S) => {   // 5 beq 做減、R-type 不知道
    S.g2 = bx('beq → 減', CC.green, -1.6, 1.2, 2.0, 0.55); S.g3 = bx('R-type → ?', CC.red, 1.3, 1.2, 2.0, 0.55);
    cap('beq：知道要做減；R-type：不知道', '');
  },
  async (tok, S) => {   // 6 三個類別
    cap('光從 opcode 可以分成三個類別', '加、減、看 funct');
  },
  async (tok, S) => {   // 7 三種要幾個 bit
    cap('三種狀態要幾個 bit？', '2 bits（2² = 4 ≥ 3）');
    S.k = ok(Math.ceil(Math.log2(3)) === 2, 'ceil(log₂3) = 2 bits', 4.4, 1.2);
  },
  async (tok, S) => {   // 8 00 加、01 減、10 看 funct
    relabel(S.g1, 'ALUOp 00：加（lw / sw）'); relabel(S.g2, 'ALUOp 01：減（beq）'); relabel(S.g3, 'ALUOp 10：看 funct');
    cap('00 = 加、01 = 減、10 = 不知道', '要靠 function code 決定：這 2 bits 叫 ALUOp');
    S.l = line([[-4.0, 5.4], [-0.6, 3.9]], CC.brown); S.ll = small(pl('ALUOp（2）', -2.6, 4.9), 10);
  },
  async (tok, S) => {   // 9 再搭配 funct
    cap('ALUOp 兩個 bits 再搭配 funct（6 bits）', '共同決定給 ALU 的 control');
    S.f = line([[4.0, 5.4], [0.6, 3.9]], CC.brown); S.fl = small(pl('funct（6）', 2.8, 4.9), 10);
  },
  async (tok, S) => {   // 10 ALU 的 control signal
    gone(S.g1, S.g2, S.g3, S.k);
    cap('output 是 ALU 的 control signal', '設計 ALU 時已經定好了');
    S.o = line([[0, 2.9], [0, 1.9]], CC.brown);
  },
  async (tok, S) => {   // 11 0000 AND、0001 OR、0010 add
    cap('0000 = AND、0001 = OR、0010 = add', '');
    S.L = lister(-5.6, 1.4, 0.5);
    ['0000', '0001', '0010'].forEach((c) => mono(S.L(c + '  ' + ALUNAME[c], 'idx'), 11));
  },
  async (tok, S) => {   // 12 要做加 → 產生 0010
    cap('要做加：ALU control 的 output 要產生 0010', '');
    S.out = bx(aluCtl('00', 'add'), CC.mint, 0, 1.4, 1.2, 0.5);
  },
  async (tok, S) => {   // 13 減 0110
    cap('減是 0110', '');
    mono(S.L('0110  ' + ALUNAME['0110'], 'idx'), 11);
    relabel(S.out, aluCtl('01', 'add'));
  },
  async (tok, S) => {   // 14 beq 或 R-type sub 都發 0110
    mono(S.L('0111  ' + ALUNAME['0111'], 'idx'), 11);
    cap('opcode 就知道要減（beq），或 R-type 的 funct 是 sub', '都發出 0110');
    S.k2 = ok(aluCtl('01', 'add') === '0110' && aluCtl('10', 'sub') === '0110', 'ALUOp 01 → 0110；10 + sub → 0110', 3.0, 0.4);
  },
]);

scene('cpu-alutt', '16A：ALU control 的 truth table', [
  async (tok, S) => {   // 1 opcode 6 bits 進 main control
    cap('main control：opcode 6 bits 進來', '');
    S.mc = bx('Main control', CC.brown, -4.4, 6.0, 2.6, 0.9);
    small(pl('op（6）', -4.4, 7.0), 10);
  },
  async (tok, S) => {   // 2 七個 mux 的 signal + 2-bit ALUOp
    cap('發出 7 個 control signal + 2 bits 的 ALUOp', '');
    S.L = lister(-2.6, 6.6, 0.42); SIG7.forEach((s) => small(S.L(s, 'idx'), 9)); small(S.L('ALUOp（2 bits）', 'ptr alt'), 10);
  },
  async (tok, S) => {   // 3 ALUOp：加、減、不知道
    cap('ALUOp 的意思：add、減、或不知道', '從 opcode 不能知道全部的資訊');
  },
  async (tok, S) => {   // 4 三種 group → 2 bits
    cap('只有三種 group，所以 2 bits', '把知道的部分 encode 起來');
  },
  async (tok, S) => {   // 5 lw / sw → 00
    S.th = mt('ALUOp   funct    → ALU control', 1.6, 7.0, 12, 'ptr');
    S.rows = [];
    const put = (i) => { const [op, f, o, n] = AC_ROWS[i]; S.rows.push(mt(op + '      ' + f + '  →  ' + o + '   ' + n, 1.6, 6.4 - i * 0.55, 12)); };
    S.put = put; put(0);
    cap('lw / sw：ALUOp = 00', '表示要做加');
  },
  async (tok, S) => {   // 6 01 減、10 不知道
    S.put(1);
    cap('做減給 01，不知道給 10', '分成三個 group');
  },
  async (tok, S) => {   // 7 truth table 出來了
    for (let i = 2; i < AC_ROWS.length; i++) S.put(i);
    cap('這就是 ALU control 的 truth table', '');
  },
  async (tok, S) => {   // 8 00、01 不用看 funct：X
    [0, 1].forEach((i) => setc(S.rows[i], 'ptr alt'));
    cap('00、01 時需要看 function field 嗎？不需要', '它也會讀出來，但是 don\'t care：打 X');
  },
  async (tok, S) => {   // 9 00 XXXXXX → 0010
    cap('碰到 00 XXXXXX：發出 0010（加）', '碰到 01：不管 funct，發出 0110（減）');
    S.k1 = ok(acOp('00', '000000') === '0010' && acOp('01', '111111') === '0110', '00 → 0010、01 → 0110', 1.6, 2.2);
  },
  async (tok, S) => {   // 10 10：搭配 funct
    [0, 1].forEach((i) => setc(S.rows[i], '')); for (let i = 2; i < 7; i++) setc(S.rows[i], 'ptr alt');
    cap('10 表示 unknown', '要搭配 funct 才發出 control signal');
    S.k2 = ok(AC_ROWS.slice(2).every(([op, f, o]) => acOp(op, f) === o), 'add 0010、sub 0110、and 0000、or 0001、slt 0111', 1.6, 1.6);
  },
  async (tok, S) => {   // 11 左邊 input、右邊 output
    for (let i = 0; i < 7; i++) setc(S.rows[i], '');
    cap('左邊是 input，右邊是 output', 'truth table 的 input 和 output');
    S.ia = small(hot('input', -0.2, 7.5), 10); S.oa = small(hot('output', 4.6, 7.5), 10);
  },
]);

scene('cpu-alueq', '16A：ALU control 的邏輯式（8 個 input、4 個 output）', [
  async (tok, S) => {   // 1 input 8 bits
    cap('這個 truth table 的 input 幾個 bits？', 'ALUOp 2 + funct 6 = ' + (2 + 6));
    S.rows = AC_ROWS.map(([op, f, o, n], i) => mt(op + ' ' + f + ' → ' + o + '  ' + n, -3.6, 6.4 - i * 0.52, 12));
  },
  async (tok, S) => {   // 2 output 4 bits
    cap('output 幾個 bits？4 個', '一個 8-input、4-output 的 truth table');
    S.k = ok(AC_ROWS.every((r) => (r[0] + r[1]).length === 8 && r[2].length === 4), '8 inputs → 4 outputs', 3.0, 6.4);
  },
  async (tok, S) => {   // 3 Karnaugh map 合成
    cap('邏輯設計教過：Karnaugh map 合成', 'truth table 出來就會合成');
  },
  async (tok, S) => {   // 4 左 8 input、右 output
    cap('左邊 8 個 input，右邊是 output', '');
    S.in = small(hot('ALUOp1 ALUOp0 F5…F0', -3.6, 7.0), 10);
  },
  async (tok, S) => {   // 5 一個 output 一個 output 看
    cap('合成時一次看一個 output', 'Operation3、Operation2、Operation1、Operation0');
  },
  async (tok, S) => {   // 6 bit 3 全是 0
    const all0 = AC_ROWS.every((r) => r[2][0] === '0');
    cap('第一個 output（bit 3）：全部都是 0', '');
    S.e3 = ok(all0, 'Operation3 = 0（7 列都是 0）', 3.0, 5.6);
  },
  async (tok, S) => {   // 7 constant 0
    cap('它是 constant 0', '不管 input 怎麼變，永遠是 0：不需要邏輯');
  },
  async (tok, S) => {   // 8 bit 2
    const ones = AC_ROWS.filter((r) => r[2][1] === '1').map((r) => r[3]);
    cap('bit 2：把 1 的地方找出來', '是 1 的列：' + ones.join('、'));
    AC_ROWS.forEach((r, i) => setc(S.rows[i], r[2][1] === '1' ? 'ptr alt' : ''));
  },
  async (tok, S) => {   // 9 sum of products → 化簡
    cap('ALUOp0 = 1，或 ALUOp1 = 1 且 sub / slt', 'sum of products；用 don\'t care 化簡');
    S.e2 = mt('Operation2 = ALUOp0 + ALUOp1·F1', 3.0, 4.9, 12, 'ptr alt');
  },
  async (tok, S) => {   // 10 bit 1、bit 0
    AC_ROWS.forEach((r, i) => setc(S.rows[i], ''));
    cap('同樣的方法做 bit 1、bit 0', '把 1 的部分做邏輯合成');
    S.e1 = mt('Operation1 = ¬ALUOp1 + ¬F2', 3.0, 4.3, 12, 'ptr alt');
    S.e0 = mt('Operation0 = ALUOp1·(F3 + F0)', 3.0, 3.7, 12, 'ptr alt');
    const good7 = AC_ROWS.every(([op, f, o]) => acEq(+op[0], +op[1], fbits(f === 'XXXXXX' ? '000000' : f)) === o) && ['XXXXXX'].every(() => ['111111', '101010', '000101'].every((ff) => acEq(0, 0, fbits(ff)) === '0010' && acEq(0, 1, fbits(ff)) === '0110'));
    S.kk = ok(good7, '4 個式子算出 7 列的 output 全對（00／01 任何 funct 都對）', 0.4, 2.4);
  },
  async (tok, S) => {   // 11 gate 圖
    cap('畫成 gate：input 可以共用', '');
    S.g = [['OR', 4.9], ['OR', 4.3], ['AND', 3.7]].map(([t, y]) => bx(t, CC.brown, 6.3, y, 0.7, 0.4));
  },
  async (tok, S) => {   // 12 bit 3 接 ground
    cap('bit 3 是 constant 0：直接接到 ground', '四個 output 的 ALU control 就完成了');
    S.gnd = bx('GND → Op3', CC.gray, 6.0, 5.6, 1.4, 0.4);
  },
]);

scene('cpu-mainctl', '16A：main control 的 truth table', [
  async (tok, S) => {   // 1 ALU controller 完成
    cap('ALU controller 完成了', '順序：main controller decode → ALUOp + funct → ALU control');
    S.a = bx('ALU control ✓', CC.green, 4.6, 7.0, 2.4, 0.5);
  },
  async (tok, S) => {   // 2 main controller
    cap('現在看 main controller', '只看 opcode（第一個 field）就決定大部分 control');
  },
  async (tok, S) => {   // 3 truth table
    cap('這張圖就是 main controller 的 truth table', 'input 在上面（opcode），output 在下面');
    S.T = ctlTable(-3.6, 6.6, 1.5, 0.55);
  },
  async (tok, S) => {   // 4 000000 = R-type
    S.T.show('R');
    cap('opcode 000000：R-type', '這些值剛剛都 trace 過了');
  },
  async (tok, S) => {   // 5 100011 = lw
    S.T.show('lw');
    cap('opcode 100011（35）：load', '把它的 mux 設定寫出來');
    S.k = ok(toB(35, 6) === '100011' && toB(43, 6) === '101011' && toB(4, 6) === '000100', 'lw 35 = 100011、sw 43 = 101011、beq 4 = 000100', 2.6, -0.2);
  },
  async (tok, S) => {   // 6 RegDst
    S.T.cells.R.forEach((m, i) => glow(m, i === 0 ? HL : null));
    cap('例：R-type 的 RegDst', 'destination 是 rd → 1');
  },
  async (tok, S) => {   // 7 ALUSrc
    S.T.cells.R.forEach((m, i) => glow(m, i === 1 ? HL : null));
    cap('ALUSrc：第二個 operand 從 rt 來 → 0', '設 0 選一條 path、設 1 選另一條');
  },
  async (tok, S) => {   // 8 ALUOp = 10
    S.T.cells.R.forEach((m, i) => glow(m, i >= 7 ? HL : null));
    cap('R-type 的 ALUOp：unknown → 10', '');
  },
  async (tok, S) => {   // 9 lw / sw
    S.T.cells.R.forEach((m) => glow(m, null));
    S.T.show('sw'); S.T.show('beq');
    cap('load、store 也一樣：每個 mux 設好', '它們做加 → ALUOp 00；beq 做減 → 01');
  },
  async (tok, S) => {   // 10 input 在上、output 在下
    cap('上面是 input（opcode），下面是 output', '就是一張 truth table，只是寫成矩陣的樣子');
    S.k2 = ok(Object.keys(CT).every((k) => CT[k].length === 9), '4 種 opcode × 9 個 control signals', 2.6, -0.8);
  },
]);

scene('cpu-pla', '16A：每個 output 一條式子：PLA', [
  async (tok, S) => {   // 1 每個 control signal 是一個 output
    cap('每個 control signal 都是一個 output', '看它什麼時候要設 1、什麼時候設 0');
    S.ops = ['R', 'lw', 'sw', 'beq'].map((k, i) => { const y = 6.4 - i * 1.0; const g = bx('AND：' + ROWN[k], CC.brown, -2.6, y, 2.6, 0.6); small(mt(toB(OPC[k], 6), -5.2, y, 11), 11); return g; });
    S.ph = small(hot('opcode', -5.2, 7.2), 10);
  },
  async (tok, S) => {   // 2 RegWrite 什麼時候 = 1？
    cap('例如 RegWrite：什麼時候設 1？', '什麼時候會 write register？');
    S.rw = bx('OR：RegWrite', CC.purple, 3.2, 5.4, 2.6, 0.6);
  },
  async (tok, S) => {   // 3 R-type 和 load
    const on = Object.keys(CT).filter((k) => CT[k][3] === 1);
    cap('R-type 會寫，load 也會寫', 'RegWrite = 1 的：' + on.map((k) => ROWN[k]).join('、'));
    glow(S.ops[0], HL); glow(S.ops[1], HL);
  },
  async (tok, S) => {   // 4 op = 000000 或 100011
    cap('opcode = 000000 或 100011 時設 1', 'AND gate 認出 opcode，再 OR 起來');
    S.l1 = line([[-1.3, 6.4], [1.9, 5.4]], CC.purple); S.l2 = line([[-1.3, 5.4], [1.9, 5.4]], CC.purple);
    const f = (op) => { const k = decode(op); return k === 'R' || k === 'lw' ? 1 : 0; };
    S.k = ok(Object.keys(OPC).every((k) => f(OPC[k]) === CT[k][3]), 'RegWrite = Rformat + lw（對照真值表）', 3.2, 4.6);
  },
  async (tok, S) => {   // 5 PLA
    S.ops.forEach((m) => glow(m, null));
    cap('用 PLA 實作：AND plane + OR plane', 'AND 把各種 opcode 狀況做出來，OR 把條件 OR 起來');
    S.pa = board('AND plane', -2.6, 4.9, 3.2, 4.4, CC.peach); S.po = board('OR plane', 3.2, 4.0, 3.0, 4.8, CC.lilac);
  },
  async (tok, S) => {   // 6 ALUSrc：lw、sw
    const on = Object.keys(CT).filter((k) => CT[k][1] === 1);
    cap('ALUSrc 什麼時候是 1？', on.map((k) => ROWN[k]).join('、') + ' 的時候');
    S.as = bx('OR：ALUSrc', CC.orange, 3.2, 4.4, 2.6, 0.6);
    S.l3 = line([[-1.3, 5.4], [1.9, 4.4]], CC.orange); S.l4 = line([[-1.3, 4.4], [1.9, 4.4]], CC.orange);
    S.k2 = ok(on.join() === 'lw,sw', 'ALUSrc = lw + sw', 3.2, 3.6);
  },
  async (tok, S) => {   // 7 其他 output 一樣
    cap('每個 output 都這樣接一條線過來', 'AND、OR 就做出 PLA');
    const outs = [['MemRead', 4], ['MemWrite', 5], ['Branch', 6], ['RegDst', 0], ['MemtoReg', 2]];
    S.more = outs.map(([s, i], j) => { const on = Object.keys(CT).filter((k) => CT[k][i] === 1).map((k) => ROWN[k]); return small(tag(s + ' = ' + on.join(' + '), 'idx', 3.2, 2.9 - j * 0.42), 9); });
  },
]);

// ════════ 4vRk10j9MC8（第 17A 講：jump、worst-case delay、pipeline 入門：洗衣、五個 stage、pipeline register、structural hazard） ════════
const hex8 = (v) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
const ghost = P.ghostBox;
// laundry: per load [wash, dry, fold] minutes; each resource is used by one load at a time
function laundry(n, d, pipe) {
  const out = []; const free = [0, 0, 0]; let tEnd = 0;
  for (let k = 0; k < n; k++) {
    let t = pipe ? 0 : tEnd; const seg = [];
    for (let s = 0; s < 3; s++) { const st = Math.max(t, free[s]); seg.push([st, d[s]]); t = st + d[s]; free[s] = t; }
    tEnd = t; out.push(seg);
  }
  return { loads: out, end: tEnd };
}
const LD = [30, 40, 20], LCOL = [CC.blue, CC.orange, CC.green], LNAME = ['洗', '烘', '摺'];
function drawLaundry(res, x0, y0, sc, dy = 0.8, names = ['A', 'B', 'C', 'D']) {
  const ms = [];
  res.loads.forEach((seg, k) => { ms.push(pl(names[k], x0 - 0.45, y0 - k * dy)); seg.forEach(([st, l], s) => { const w = l * sc; ms.push(cube(LNAME[s] + ' ' + l, LCOL[s], [w - 0.04, 0.5, 0.4], x0 + st * sc + w / 2, y0 - k * dy, 0)); }); });
  ms.forEach((m) => m.userData && m.userData.lbl && small(m.userData.lbl, 9));
  return ms;
}
// pipeline diagram: rows of [name, stages[], startCycle]
const STC = { IF: CC.blue, ID: CC.purple, EX: CC.orange, MEM: CC.green, WB: CC.pink };
function pipeRow(name, stages, start, y, x0 = -4.6, cw = 1.6) {
  const ms = [pl(name, x0 - 1.2, y)];
  stages.forEach((s, i) => { if (!s) return; const m = cube(s, STC[s], [cw - 0.1, 0.55, 0.4], x0 + (start + i) * cw + cw / 2, y, 0); small(m.userData.lbl, 10); ms.push(m); });
  return ms;
}

scene('cpu-jump', '17A：加入 jump：shift 2、接 PC 的前 4 bits、多一個 mux', [
  async (tok, S) => {   // 1 jump 指令
    cap('還沒加進去的：jump 指令', 'format：op 6 bits + address 26 bits');
    S.f = fmtBar([['op（2）', 6, CC.gray], ['address', 26, CC.gold]], -5.6, 6.6, 11.2, 0.55);
  },
  async (tok, S) => {   // 2 26 bits 全是地址
    cap('後面 26 bits 全部用來描述地址', '');
    glow(S.f[2], HL);
  },
  async (tok, S) => {   // 3 shift 2 bits
    glow(S.f[2], null);
    cap('先 shift 兩個 bits（word address）', '26 bits → 28 bits');
    S.sh = fmtBar([['address 26', 26, CC.gold], ['00', 2, CC.gray]], -4.0, 5.2, 9.6, 0.5);
  },
  async (tok, S) => {   // 4 接上 PC 的前 4 bits
    const pc = 0x0040001C, pc4 = pc + 4, field = 0x0100010, jaddr = ((pc4 & 0xF0000000) | (field << 2)) >>> 0;
    cap('再接上 PC（+4）的前 4 個 bits', '就是要跳去的地址');
    S.cc = fmtBar([['PC+4 [31:28]', 4, CC.blue], ['address 26', 26, CC.gold], ['00', 2, CC.gray]], -5.6, 4.0, 11.2, 0.5);
    S.ex = mt('示意：PC+4 = ' + hex8(pc4) + '、address = 0x' + field.toString(16).toUpperCase() + ' → ' + hex8(jaddr), 0, 3.1, 11);
    S.k = ok(((jaddr >>> 2) & 0x3FFFFFF) === field && (jaddr >>> 28) === (pc4 >>> 28), '{PC+4[31:28], address, 00} = ' + hex8(jaddr), 0, 2.5);
  },
  async (tok, S) => {   // 5 加到 datapath：opcode decode 是 jump
    gone(S.f, S.sh, S.cc, S.ex, S.k);
    cap('怎麼加到 datapath？', 'opcode decode 出來，如果是 jump…');
    S.pc = bx('PC', CC.gold, -6.0, 3.8, 0.7, 1.0);
    S.ctl = bx('Control', CC.brown, -3.6, 6.8, 1.6, 0.6);
    small(hot('Jump', -2.4, 7.2), 10);
  },
  async (tok, S) => {   // 6 先前：PC + 4
    cap('先前：PC = PC + 4 在這裡做', '');
    S.a4 = bx('Add +4', CC.orange, -3.6, 5.4, 1.2, 0.7);
    S.w1 = line([[-6.0, 4.3], [-6.0, 5.4], [-4.2, 5.4]], WCOL); S.w2 = line([[-3.0, 5.4], [1.4, 5.4]], WCOL);
  },
  async (tok, S) => {   // 7 第一個 mux：branch
    cap('第一個 mux：beq 且 equal → 選 1（target）', '否則選 0（PC + 4）');
    S.ba = bx('branch target', CC.orange, -1.2, 4.4, 1.8, 0.6); S.w3 = line([[-0.3, 4.4], [1.4, 4.4]], WCOL);
    S.m1 = bx('MUX', CC.mux, 1.7, 4.9, 0.4, 1.3); small(pl('PCSrc', 1.7, 3.95), 9);
  },
  async (tok, S) => {   // 8 第二個 mux：Jump
    cap('再一個 mux：如果是 jump', 'control 發出 Jump = 1，選 1');
    S.m2 = bx('MUX', CC.mux, 4.0, 4.2, 0.4, 1.3); glow(S.m2, HL);
    S.w4 = line([[1.9, 4.9], [3.8, 4.6]], WCOL);
    S.jl = line([[-2.8, 6.8], [4.0, 6.8], [4.0, 4.85]], CC.blue);
  },
  async (tok, S) => {   // 9 1 = 這條 path
    cap('選 1 的這條 path：instr[25:0] shift 兩個 bits', '再和 PC + 4 的前 4 bits concatenate');
    S.i26 = bx('instr[25:0]', CC.gold, -3.6, 1.8, 1.8, 0.6); S.s2 = bx('<<2', CC.teal, -1.4, 1.8, 0.8, 0.5); S.cat = bx('{PC+4[31:28], ·}', CC.blue, 1.2, 1.8, 2.2, 0.6);
    line([[-2.7, 1.8], [-1.8, 1.8]], WCOL); line([[-1.0, 1.8], [0.1, 1.8]], WCOL); S.w5 = line([[2.3, 1.8], [3.0, 1.8], [3.0, 3.8], [3.8, 3.8]], WON);
    const m = await flow(tok, [[-2.7, 1.8], [-1.0, 1.8], [2.3, 1.8], [3.0, 1.8], [3.0, 3.8], [3.8, 3.8]], 'jaddr', CC.gold, 1300); kill(m);
  },
  async (tok, S) => {   // 10 第一個 mux / 第二個 mux
    cap('第一個 mux：PC + 4（sequential）或 branch', '第二個 mux：前面的結果或 jump target');
    S.w6 = line([[4.2, 4.2], [5.2, 4.2], [5.2, 0.6], [-6.6, 0.6], [-6.6, 3.8], [-6.35, 3.8]], WON);
    const m = await flow(tok, [[4.2, 4.2], [5.2, 4.2], [5.2, 0.6], [-6.6, 0.6], [-6.6, 3.8], [-6.35, 3.8]], 'next PC', CC.gold, 1400); kill(m);
  },
  async (tok, S) => {   // 11 新的 datapath
    cap('新 datapath：多 jump target、多 Jump 訊號', 'R、I、J 三種 type 都介紹完了');
    S.k = ok(true, 'jump：RegWrite = 0、MemWrite = 0、Jump = 1', 0, -0.4);
  },
]);

scene('cpu-worst', '17A：worst case：lw 決定 single cycle 的 clock', [
  async (tok, S) => {   // 1 worst case delay：lw
    tm.lat = [200, 100, 200, 200, 100];
    S.tot = CLASSES.map(([, u]) => u.reduce((s, on_, i) => s + (on_ ? tm.lat[i] : 0), 0));
    S.sc = 11 / Math.max(...S.tot); S.x0 = -5.8;
    cap('看 worst case 的 delay', 'load 要最多的時間（示意：IF 200、Reg 100、ALU 200、Mem 200、WB 100 ps）');
    hd('lw（示意 ps）', -4.8, 7.0);
  },
  async (tok, S) => {   // 2 lw 的各段
    cap('lw 經過全部五個單元', 'IM、register、ALU、data memory、寫回（投影片另含 clock-to-Q、skew）');
    let x = S.x0; S.lw = [];
    CLASSES[0][1].forEach((on_, i) => { if (!on_) return; const w = tm.lat[i] * S.sc; S.lw.push(bar(UCOL[i], w - 0.04, 0.6, x + w / 2, 6.2)); x += w; });
    S.lt = small(tag(S.tot[0] + ' ps', 'idx', x + 0.6, 6.2), 10);
  },
  async (tok, S) => {   // 3 clock period = lw
    const clk = Math.max(...S.tot);
    cap('single cycle：cycle 長度固定', '要用最長的指令當 clock period');
    S.cl = line([[S.x0 + clk * S.sc, 6.7], [S.x0 + clk * S.sc, 1.2]], CC.red);
    S.k = ok(clk === S.tot[0] && clk === 800, '示意：clock period = max = ' + clk + ' ps（lw）', 0.6, 0.6);
  },
  async (tok, S) => {   // 4 其他指令也要等
    cap('其他指令不需要那麼長，但大家都要一樣', 'clock 不能變來變去');
    CLASSES.slice(1).forEach(([nm, u], r) => { const y = 5.3 - r * 0.95; tag(nm, 'ptr', -6.5, y); let x = S.x0; u.forEach((on_, i) => { if (!on_) return; const w = tm.lat[i] * S.sc; bar(UCOL[i], w - 0.04, 0.5, x + w / 2, y); x += w; }); small(tag(S.tot[r + 1] + ' ps', 'idx', x + 0.6, y), 10); });
  },
  async (tok, S) => {   // 5 CPI = 1
    cap('CPI 是多少？每個指令都 1 個 cycle', 'CPI = 1，但 clock period 很長');
    S.c = hot('CPI = 1', -4.6, 0.6);
  },
  async (tok, S) => {   // 6 沒效率
    const waste = S.tot.map((t) => 800 - t);
    cap('這樣的 implementation 不 efficient', '例如 R-type 每次白等 ' + waste[2] + ' ps（示意）');
    S.w = bad('短的指令白白等待', -1.6, 0.0);
  },
  async (tok, S) => {   // 7 pipeline 會用到同樣的 datapath、control
    cap('但這個 datapath 和 control 都會用到', '現在的 processor 都是 pipeline，從 single cycle 改過去');
    S.p = small(note('single cycle 的 datapath + control → pipeline', 2.8, -0.6), 11);
  },
]);

scene('cpu-mipsgood', '17A：MIPS 的設計讓 controller 簡單', [
  async (tok, S) => {   // 1 MIPS 的設計
    cap('從 controller 的設計可以看到 MIPS 的設計', '');
    pl('R', -6.2, 5.6); S.R = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['rd', 5, CC.purple], ['shamt', 5, CC.sky], ['funct', 6, CC.orange]], -5.8, 5.6, 11.4, 0.5);
    pl('I', -6.2, 4.2); S.I = fmtBar([['op', 6, CC.gray], ['rs', 5, CC.purple], ['rt', 5, CC.purple], ['immediate', 16, CC.teal]], -5.8, 4.2, 11.4, 0.5);
  },
  async (tok, S) => {   // 2 opcode 固定位置
    glow(S.R[0], HL); glow(S.I[0], HL);
    cap('opcode 在固定的位置：每次拿前 6 bits decode', '不固定的話（前 6？前 8？）controller 就變複雜');
  },
  async (tok, S) => {   // 3 source register 同一個地方
    glow(S.R[0], null); glow(S.I[0], null); glow(S.R[2], HL); glow(S.I[2], HL);
    cap('source register 盡量在同一個地方', 'rs 永遠是第一個 source；第二個可能是 rt 或 sign extension → mux');
  },
  async (tok, S) => {   // 4 immediate 同一個位置
    glow(S.R[2], null); glow(S.I[2], null); glow(S.I[6], HL);
    cap('immediate 永遠在同一個位置', '做 sign extension、PC-relative 地址、或 immediate 運算');
  },
  async (tok, S) => {   // 5 format 越簡單越容易合成
    glow(S.I[6], null);
    cap('instruction format 越簡單，越容易合成', 'datapath、controller 都簡單');
    S.k = hot('format 簡單 → hardware 簡單', 0, 2.6);
  },
]);

scene('cpu-pipeplan', '17A：Pipeline 這一章要講什麼', [
  async (tok, S) => {   // 1 pipeline 很重要
    cap('Pipeline：high performance 一定用的技巧', '從 single cycle 的 datapath、control 設計出來');
    S.L = lister(-5.4, 6.4, 0.75);
  },
  async (tok, S) => {   // 2 overview、datapath、control
    cap('先 overview，再看 datapath、control', 'single cycle 學會了，這兩個很簡單');
    S.L('① Overview：什麼是 pipeline', 'ptr', 13); S.L('② Pipelined datapath', 'ptr', 13); S.L('③ Pipelined control', 'ptr', 13);
  },
  async (tok, S) => {   // 3 難的：hazard
    cap('難的是 data hazard 和 control hazard', '前一個指令還沒做完，後面的已經進去 → dependency');
    S.L('④ Data hazard、control hazard（難）', 'ptr alt', 13);
  },
  async (tok, S) => {   // 4 exception
    cap('再來 exception', '發生 interrupt、不正常的事，要跳出正常的執行：也像一種 hazard');
    S.L('⑤ Exception', 'ptr', 13);
  },
  async (tok, S) => {   // 5 superscalar
    cap('最後：其他 high performance 的架構', 'superscalar、dynamic pipelining');
    S.L('⑥ Superscalar、dynamic pipelining', 'ptr', 13);
  },
]);

scene('cpu-laundry', '17A：洗衣服的比喻：sequential 6 小時 vs pipeline 3.5 小時', [
  async (tok, S) => {   // 1 四個人要洗衣服
    cap('用洗衣服來比喻：A、B、C、D 四個人', '');
    S.p = ['A', 'B', 'C', 'D'].map((n, i) => buddy(n, '', [CC.pink, CC.blue, CC.green, CC.orange][i], -5.6 + i * 1.3, 5.4, 0, 0.7));
  },
  async (tok, S) => {   // 2 洗、烘、摺
    cap('要經過：洗衣機 → 烘乾機 → 摺衣服', '宿舍一台洗衣機、一台烘乾機、一張桌子');
    S.r = [['洗衣機', CC.blue], ['烘乾機', CC.orange], ['摺衣桌', CC.green]].map(([t, c], i) => bx(t, c, 0.8 + i * 2.1, 5.6, 1.8, 0.7));
  },
  async (tok, S) => {   // 3 30、40、20 分鐘
    cap('洗 30 分鐘、烘 40 分鐘、摺 20 分鐘', '一個人 ' + (30 + 40 + 20) + ' 分鐘');
    S.r.forEach((m, i) => relabel(m, ['洗衣機', '烘乾機', '摺衣桌'][i] + ' ' + LD[i]));
  },
  async (tok, S) => {   // 4 sequential：關起門做完才換人
    gone(S.p.map((b) => b.g));
    S.sc = 12 / 360; S.x0 = -5.8;
    cap('第一種：A 進去就把門關起來', '洗、烘、摺全部做完，才讓 B 進去');
    S.seq = laundry(4, LD, false);
    S.d1 = drawLaundry(S.seq, S.x0, 4.2, S.sc, 0.62);
  },
  async (tok, S) => {   // 5 6 小時
    cap('要花多久？' + S.seq.end + ' 分鐘 = ' + S.seq.end / 60 + ' 小時', '每個人 90 分鐘 × 4');
    S.k1 = ok(S.seq.end === 4 * 90 && S.seq.end / 60 === 6, 'sequential：4 × 90 = ' + S.seq.end + ' 分 = 6 小時', 2.6, 1.2);
  },
  async (tok, S) => {   // 6 太自私：資源空著
    cap('很自私：A 在烘乾時，洗衣機明明沒人用', '就讓下一個人進來用啊 → pipeline');
    S.e = bad('洗衣機閒著！', S.x0 + 50 * S.sc, 4.75);
  },
  async (tok, S) => {   // 7 pipeline：用完就交給下一個
    gone(S.d1, S.e, S.k1);
    cap('A 洗完、去烘乾，洗衣機空出來，B 就進去', 'A 摺衣服時，B 烘、C 洗');
    S.pip = laundry(4, LD, true);
    S.d2 = drawLaundry(S.pip, S.x0, 4.2, S.sc, 0.62);
  },
  async (tok, S) => {   // 8 3.5 小時
    cap('只要 ' + S.pip.end + ' 分鐘 = ' + S.pip.end / 60 + ' 小時', '就把全部衣服洗完');
    S.k2 = ok(S.pip.end === 30 + 4 * 40 + 20 && S.pip.end / 60 === 3.5, 'pipeline：30 + 4 × 40 + 20 = ' + S.pip.end + ' 分 = 3.5 小時', 2.6, 1.2);
  },
]);

scene('cpu-lessons', '17A：pipeline 的觀念：latency 不變、throughput 增加', [
  async (tok, S) => {   // 1 latency 有沒有改變？
    S.sc = 12 / 360; S.x0 = -5.8;
    S.pip = laundry(4, LD, true);
    S.d = drawLaundry(S.pip, S.x0, 6.0, S.sc, 0.62);
    cap('學到什麼？latency 有沒有改變？', 'latency = response time：丟進去到拿到衣服的時間');
  },
  async (tok, S) => {   // 2 不會變短
    const own = LD.reduce((a, b) => a + b, 0);
    cap('不會：每一批還是要洗、烘、摺', '每個人自己的工作 = ' + own + ' 分鐘，pipeline 不會讓它變短');
    S.k1 = ok(own === 90, '一批的工作時間 30 + 40 + 20 = 90 分', 1.6, 3.3);
  },
  async (tok, S) => {   // 3 throughput 增加
    const ends = S.pip.loads.map((s) => s[2][0] + s[2][1]), gaps = ends.slice(1).map((e, i) => e - ends[i]);
    cap('變快的是：單位時間完成的工作 → throughput', '完成時間 ' + ends.join('、') + ' 分：每 ' + gaps[0] + ' 分鐘完成一批');
    S.k2 = ok(gaps.every((g) => g === 40), '穩定後每 40 分鐘完成一批', 1.6, 2.7);
  },
  async (tok, S) => {   // 4 被最慢的 stage 限制
    cap('pipeline 的速率被最慢的 stage 限制', '洗完只要 30 分，但烘乾要 40 分：還是要等');
    S.k3 = ok(Math.max(...LD) === 40, 'pipeline rate = 最慢的 stage = 40 分', 1.6, 2.1);
    S.d.filter((m) => m.isMesh && m.userData.lbl && m.userData.lbl.element.textContent.startsWith('烘')).forEach((m) => glow(m, HL));
  },
  async (tok, S) => {   // 5 同時用多個 resource
    S.d.forEach((m) => m.isMesh && glow(m, null));
    cap('同一個時間用到不同的 resource', '洗衣機、烘乾機、桌子同時有人用；但一個 resource 一次只給一個人');
  },
  async (tok, S) => {   // 6 potential speedup = stage 數
    cap('potential speedup = pipeline stage 的數目', '三個 stage 同時在做 → 最多快 3 倍');
    S.k4 = ok(LD.length === 3, 'potential speedup = 3', 1.6, 1.5);
  },
  async (tok, S) => {   // 7 達不到：不平均
    const sp = 360 / S.pip.end;
    cap('為什麼達不到？stage 長度不平均（30、40、20）', '實際 360 ÷ ' + S.pip.end + ' ≈ ' + sp.toFixed(2) + ' 倍');
    S.k5 = ok(sp < 3, '實際 speedup = 360 / 210 ≈ ' + sp.toFixed(2) + ' < 3', 1.6, 0.9);
  },
  async (tok, S) => {   // 8 fill / drain
    cap('剛開始（fill）和結束（drain）時', '只有部分 resource 在用，也會降低 speedup');
    S.f1 = ghost(CC.red, 70 * S.sc, 2.6, 0.2); S.f1.position.set(S.x0 + 35 * S.sc, 5.1, 0.3);
    S.f2 = ghost(CC.red, 60 * S.sc, 2.6, 0.2); S.f2.position.set(S.x0 + 180 * S.sc, 5.1, 0.3);
  },
  async (tok, S) => {   // 9 dependency
    cap('更麻煩的是 dependency：會讓 pipeline 停住', '這個例子沒有 dependency，後面再解決');
    S.n = bad('dependency → stall（後面再講）', -2.4, 0.3);
  },
]);

scene('cpu-pipeproc', '17A：processor 的 pipeline：800 ps vs 200 ps', [
  async (tok, S) => {   // 1 processor
    cap('換成 processor：原本 single cycle', '一個 cycle 把所有事情做完');
    S.sc = 12 / 2400; S.x0 = -5.8;
    S.s = [0, 1, 2].map((k) => bar(CC.sky, 800 * S.sc - 0.06, 0.55, S.x0 + (k * 800 + 400) * S.sc, 6.2));
    S.sl = [0, 1, 2].map((k) => small(tag('lw ' + (k + 1), 'idx', S.x0 + (k * 800 + 400) * S.sc, 6.2), 10));
    hd('single cycle', -5.2, 6.9);
  },
  async (tok, S) => {   // 2 lw 可以分成好多個動作
    cap('lw 其實可以分成好多個動作', 'fetch、decode、register access、ALU、memory access…');
  },
  async (tok, S) => {   // 3 五個 stage
    cap('切成五個 stage，一個 cycle 做一件事', 'IF、ID（reg）、EX、MEM、WB');
    S.st = ['IF', 'ID', 'EX', 'MEM', 'WB'].map((t, i) => { const m = cube(t, STC[t], [200 * S.sc - 0.05, 0.45, 0.3], S.x0 + (i * 200 + 100) * S.sc, 5.4, 0); small(m.userData.lbl, 9); return m; });
  },
  async (tok, S) => {   // 4 做完就交給下一個
    cap('一個 stage 做完，resource 就給下一個 instruction', '讀 register 的時候，instruction memory 已經可以給下一個用');
    S.rows = [1, 2].map((k) => ['IF', 'ID', 'EX', 'MEM', 'WB'].map((t, i) => { const m = cube(t, STC[t], [200 * S.sc - 0.05, 0.45, 0.3], S.x0 + ((i + k) * 200 + 100) * S.sc, 5.4 - k * 0.6, 0); small(m.userData.lbl, 9); return m; }));
    hd('pipeline', -5.2, 4.6);
  },
  async (tok, S) => {   // 5 single cycle：800 ps
    cap('single cycle：一個指令要 800 ps', '做完才能做下一個');
  },
  async (tok, S) => {   // 6 pipeline：最慢 stage 200 ps
    cap('pipeline：最慢的 stage 是 200 ps', '就把每個 stage 設成 200 ps');
  },
  async (tok, S) => {   // 7 每 800 ps 一個結果
    const done = [1, 2, 3].map((k) => k * 800);
    cap('在出口等：single cycle 每 800 ps 才一個結果', '完成時間 ' + done.join('、') + ' ps');
    S.k1 = ok(done[1] - done[0] === 800, 'single cycle：每 800 ps 完成一個', 1.6, 2.6);
  },
  async (tok, S) => {   // 8 每 200 ps 一個結果
    const done = [0, 1, 2].map((k) => 1000 + k * 200);
    cap('pipeline：clock 200 ps，重疊著做', '完成時間 ' + done.join('、') + ' ps：每 200 ps 一個');
    S.k2 = ok(done[1] - done[0] === 200 && done[0] === 5 * 200, 'pipeline：第一個 5 × 200 = 1000 ps，之後每 200 ps 一個', 1.6, 2.0);
  },
  async (tok, S) => {   // 9 resource 都在，不同時間共享
    cap('為什麼可以 pipeline？resource 都在那裡', 'register、ALU、memory：同一時間給不同的 instruction 用');
  },
  async (tok, S) => {   // 10 improve throughput
    cap('pipeline 改善的是 throughput', '單一指令的 latency 不會變好');
    S.k3 = hot('latency 不變、throughput ↑', -2.4, 0.9);
  },
]);

// stage bands over the full datapath
const BANDS = [['IF', -7.0, -3.5], ['ID', -3.5, 0.55], ['EX', 0.55, 3.2], ['MEM', 3.2, 5.35], ['WB', 5.35, 6.9]];
function bands(on) { return BANDS.slice(0, on).map(([n, a, b]) => { const g = ghost(STC[n], b - a - 0.05, 7.4, 0.1); g.position.set((a + b) / 2, 3.9, -0.6); const l = small(tag(n, 'ptr', (a + b) / 2, 0.0), 11); return [g, l]; }); }

scene('cpu-stages', '17A：五個 stage：IF、ID、EX、MEM、WB', [
  async (tok, S) => {   // 1 pipeline 的 datapath
    S.D = fullDP();
    cap('pipeline 的 datapath 要怎麼做？', '先看基本概念');
  },
  async (tok, S) => {   // 2 可不可以用 single cycle 的 datapath
    cap('可不可以用 single cycle 的 datapath、control？', '要做什麼改變？');
  },
  async (tok, S) => {   // 3 分成一階一階
    cap('把 datapath 分成一階一階：五個小工作', '每個 stage 做什麼、做完沒，要分得很清楚');
  },
  async (tok, S) => {   // 4 IF
    S.b = [bands(1)];
    cap('Stage 1：instruction fetch（IF）', '');
  },
  async (tok, S) => {   // 5 ID 含 register access
    gone(S.b); S.b = [bands(2)];
    cap('Stage 2：instruction decode（ID）', 'decode 包含 register file 的 access');
  },
  async (tok, S) => {   // 6 EX
    gone(S.b); S.b = [bands(3)];
    cap('Stage 3：execution（EX）：ALU', 'R-type 相加相減；beq 比較相不相等');
  },
  async (tok, S) => {   // 7 lw / sw：address calculation
    cap('lw / sw 時 ALU 在做什麼？', '算 memory 的 address：address calculation');
    glow(S.D.c.ALU, HL);
  },
  async (tok, S) => {   // 8 MEM、WB
    glow(S.D.c.ALU, null); gone(S.b); S.b = [bands(5)];
    cap('Stage 4：memory access（MEM）', 'Stage 5：write back（WB）');
  },
  async (tok, S) => {   // 9 五個 stage 要記
    cap('五個 stage 一定要記起來', 'IF、ID、EX、MEM、WB');
  },
  async (tok, S) => {   // 10 resource 與 stage
    cap('把每個 resource 和 stage 連在一起', '任何時間每個 resource 只能被一個 instruction 用，不能搶');
  },
  async (tok, S) => {   // 11 IF：讀到 instruction register、PC + 4
    dpLit(S.D, ['PC', 'IM', 'ADD4']);
    cap('IF：用 PC 讀 instruction memory、PC + 4', '讀出來要放在 instruction register，因為後面幾個 cycle 都要用');
  },
  async (tok, S) => {   // 12 ID：decode、讀 register、算 branch target
    wiresOff(S.D); dpLit(S.D, ['CTRL', 'RF', 'SE']);
    cap('ID：controller decode、讀 register file', '（投影片）branch 的 target 也在這裡算');
  },
  async (tok, S) => {   // 13 EX
    wiresOff(S.D); dpLit(S.D, ['ALU', 'ALUC', 'MUXA']);
    cap('EX：R-type 做運算、lw / sw 算地址', 'beq 比較兩個一不一樣；jump 算 target address');
  },
  async (tok, S) => {   // 14 MEM、WB
    wiresOff(S.D); dpLit(S.D, ['DM']);
    cap('MEM：lw / sw 去 access memory', 'WB：lw 把 data 寫回 register file');
  },
  async (tok, S) => {   // 15 store 4 個 stage、R-type 4 個
    wiresOff(S.D);
    cap('store 第 4 個 stage 就結束', 'lw 要 5 個 stage；R-type 在第 4 個 stage 寫回（投影片的 4-stage R-type）');
    S.n = small(note('sw：4 stages；lw：5 stages；R-type：4 stages', 0, -0.5), 11);
  },
], DPC);

scene('cpu-preg', '17A：pipeline register：把每個 stage 切乾淨', [
  async (tok, S) => {   // 1 用 single cycle 分成 5 個 stage
    S.D = fullDP(); S.b = bands(5);
    cap('用 single cycle 的 datapath，分成 5 個 stage', 'IF、ID（含 decoder、register access）、EX、MEM、WB');
  },
  async (tok, S) => {   // 2 這樣就 OK 了嗎？
    cap('切好就可以開始 pipeline 了嗎？', '不行');
  },
  async (tok, S) => {   // 3 signal 有快有慢
    cap('只是「心裡想好」切在這裡', 'signal 有的跑得快、有的跑得慢，不會照你想的停在 stage 邊界');
    const [a, b] = await Promise.all([along(S.D, tok, ['pc_im', 'ins', 'rs', 'rd1'], 'fast', CC.green, 1200), along(S.D, tok, ['pc_im'], 'slow', CC.red, 1200)]); S.tk = [a, b];
  },
  async (tok, S) => {   // 4 每個 stage 要切乾淨
    gone(S.tk); wiresOff(S.D);
    cap('要把每個 stage 切得很乾淨', '一個 clock cycle 做完一個 stage，存起來，下一個 stage 再開始');
  },
  async (tok, S) => {   // 5 pipeline register
    cap('在每個切開的地方加一個 pipeline register', 'IF/ID、ID/EX、EX/MEM、MEM/WB');
    S.pr = [['IF/ID', -3.5], ['ID/EX', 0.55], ['EX/MEM', 3.2], ['MEM/WB', 5.35]].map(([n, x]) => { const m = cube('', CC.gold, [0.22, 6.8, 0.5], x, 3.9, 0.1); const l = small(tag(n, 'ptr alt', x, 7.6), 10); return [m, l]; });
  },
  async (tok, S) => {   // 6 clock 控制
    cap('pipeline register 由 clock 控制', 'clock 一來：這個 stage 的結果寫進 pipeline register');
    S.pr.forEach(([m]) => glow(m, HL));
  },
  async (tok, S) => {   // 7 resource 釋放給下一個
    S.pr.forEach(([m]) => glow(m, null));
    cap('資料存好了，resource 就可以給下一個 instruction 用', '下一個 cycle，下一個 stage 從 pipeline register 拿 input');
    const m = await flow(tok, [[-4.0, 3.2], [-3.5, 3.2], [-3.3, 3.2]], 'instr', CC.blue, 600); kill(m);
  },
  async (tok, S) => {   // 8 clock period 比原來長還短？
    cap('clock period 比原來長還短？', '');
  },
  async (tok, S) => {   // 9 變短：只剩一個 stage
    cap('變短了：只要一個 stage 的時間', 'clock 變快');
    S.k = ok(200 < 800, '示意：clock 800 ps → 200 ps（一個 stage）', 0, -0.5);
  },
], DPC);

scene('cpu-lwpipe', '17A：lw 在 pipeline 裡：先讀、後選，寫回時的問題', [
  async (tok, S) => {   // 1 lw 做什麼
    cap('lw 在 pipeline 裡做什麼？', 'IF：instruction memory；ID：decode，同時讀 register');
    S.r = pipeRow('lw', ['IF', 'ID', 'EX', 'MEM', 'WB'], 0, 5.6);
    S.cy = [0, 1, 2, 3, 4, 5].map((c) => small(tag('cycle ' + (c + 1), 'idx', -4.6 + c * 1.6 + 0.8, 6.5), 9));
  },
  async (tok, S) => {   // 2 用 rs rt rd 讀 register file
    cap('opcode 在 decode 的同時', '直接用 rs、rt、rd 去 access register file');
    glow(S.r[2], HL);
  },
  async (tok, S) => {   // 3 一定會用到嗎？
    cap('讀出來的東西一定會用到嗎？', '那時候還不知道是什麼指令');
  },
  async (tok, S) => {   // 4 不一定，但先讀省時間
    cap('不一定會用到，但為了節省時間先讀', 'opcode decode 完知道是什麼指令，不用的就不理它');
    S.n = small(note('先讀出來，再選要用的', 0, 4.6), 11);
  },
  async (tok, S) => {   // 5 sign extension 也照做
    cap('sign extension 也照樣做', '最後 controller 決定 control signal，選要的 data');
  },
  async (tok, S) => {   // 6 用到哪些 resource
    glow(S.r[2], null);
    cap('pipeline 的 lw 用到哪些 resource？', 'IF：instruction memory；ID：register file 的 read port、decoder；EX：ALU；MEM：data memory；WB：register file 的 write port');
    S.u = ['IM', 'Reg（read）', 'ALU', 'DM', 'Reg（write）'].map((t, i) => small(tag(t, 'idx', -4.6 + i * 1.6 + 0.8, 5.0), 9));
  },
  async (tok, S) => {   // 7 動畫：IF → pipeline register
    S.D = null;
    cap('一步一步跑：IF 讀出 instruction', '放在 pipeline register，因為下一個 cycle 下一個 instruction 會進來');
    S.tk = bx('lw', CC.gold, -4.6 + 0.8, 4.1, 0.6, 0.4);
    await travel(tok, S.tk, S.tk.position.clone(), V3(-4.6 + 1.6, 4.1, 0), 600);
  },
  async (tok, S) => {   // 8 左邊有顏色 = write、右邊 = read
    cap('（投影片）元件左半邊上色 = write、右半邊上色 = read', 'ID：讀 rs、rt、rd，sign extension 也做，一起存進 pipeline register');
    await travel(tok, S.tk, S.tk.position.clone(), V3(-4.6 + 3.2, 4.1, 0), 600);
  },
  async (tok, S) => {   // 9 EX、MEM、WB
    cap('EX 算地址、MEM 讀 memory、WB 寫回', '');
    await travel(tok, S.tk, S.tk.position.clone(), V3(-4.6 + 4.8, 4.1, 0), 500);
    await travel(tok, S.tk, S.tk.position.clone(), V3(-4.6 + 6.4, 4.1, 0), 500);
  },
  async (tok, S) => {   // 10 有一個問題
    cap('現在有一個問題', 'lw 走到第五個 stage，要寫回 register file');
    S.r2 = pipeRow('下一個', ['IF', 'ID', 'EX', 'MEM', 'WB'], 1, 3.2);
    S.r3 = pipeRow('第 4 個指令', ['IF', 'ID'], 3, 2.4);
  },
  async (tok, S) => {   // 11 寫回時用哪個 rt？
    glow(S.r[5], HL); glow(S.r3[2], HL);
    cap('寫回用哪個 field？rt', '可是這時新的 instruction 也出來了，它也有 rt：到底用誰的？');
    S.k = ok(0 + 4 === 3 + 1, 'cycle 5：lw 在 WB、第 4 個指令在 ID（也拿出它的 rt）', 1.6, 1.4);
  },
  async (tok, S) => {   // 12 dependency
    cap('要用的是 lw 自己（第五 stage）的 rt', '要想辦法選對：這就是後面 dependency、hazard 的麻煩');
  },
]);

scene('cpu-struct', '17A：R-type 4 個 stage + lw 5 個 stage → structural hazard', [
  async (tok, S) => {   // 1 R-type
    S.cy = [0, 1, 2, 3, 4, 5].map((c) => small(tag('cycle ' + (c + 1), 'idx', -4.6 + c * 1.6 + 0.8, 6.5), 9));
    cap('再來 R-type', 'IF、ID（register access、decode）、EX、WB');
    S.r = pipeRow('R-type', ['IF', 'ID', 'EX', 'WB'], 0, 5.6);
  },
  async (tok, S) => {   // 2 全部都是 lw 沒問題
    gone(S.r);
    cap('如果全部都是 lw，沒什麼問題', '');
    S.l = [0, 1, 2].map((k) => pipeRow('lw', ['IF', 'ID', 'EX', 'MEM', 'WB'], k, 5.6 - k * 0.7));
  },
  async (tok, S) => {   // 3 不能規定誰跟誰
    gone(S.l);
    cap('但你不能規定誰跟誰 pipeline', 'lw、R、lw…各式各樣的混合都可能');
  },
  async (tok, S) => {   // 4 R-type 跟 lw 混在一起
    cap('假如 R-type 跟 lw 混在一起', '前面一個 lw，後面跟一個 R-type');
    S.a = pipeRow('lw', ['IF', 'ID', 'EX', 'MEM', 'WB'], 0, 5.6);
    S.b = pipeRow('R-type', ['IF', 'ID', 'EX', 'WB'], 1, 4.8);
  },
  async (tok, S) => {   // 5 R-type 第 4 stage 寫、lw 第 5 stage 寫
    const lwWB = 0 + 4, rWB = 1 + 3;
    cap('lw 在第 5 個 stage 寫 register file', 'R-type 在第 4 個 stage 就寫：都在 cycle ' + (lwWB + 1));
    glow(S.a[5], HL); glow(S.b[4], HL);
    S.k = ok(lwWB === rWB, 'lw WB 在 cycle ' + (lwWB + 1) + '、R-type WB 也在 cycle ' + (rWB + 1), 0, 3.6);
  },
  async (tok, S) => {   // 6 兩個人打架
    cap('兩個人同時要寫 register file', '只有一個 write port → 打架');
    S.x = bad('同一個 cycle 搶 register file 的 write port', 0, 2.9);
  },
  async (tok, S) => {   // 7 洗衣比喻：跳過洗衣直接烘
    cap('洗衣比喻：你的衣服已經手洗好了', '晚一個小時來卻跳過洗衣、直接去烘 → 跟前一個人撞在烘乾機');
    S.p1 = buddy('前一個人', '烘', CC.blue, -2.0, 0.6, 0, 0.7); S.p2 = buddy('你', '烘', CC.orange, 2.0, 0.6, 0, 0.7);
    S.p1.mood('sad'); S.p2.mood('wow');
  },
  async (tok, S) => {   // 8 resource conflict
    cap('這就是 resource conflict', '時間分配不對，在同一個時間搶同一個 resource');
  },
  async (tok, S) => {   // 9 structural hazard
    cap('稱為 structural hazard', '不同的 instruction 在同一時間要用同一個 resource');
    S.h = hot('Structural hazard', 0, 2.2);
  },
  async (tok, S) => {   // 10 怎麼解決？下一節
    cap('怎麼解決這個 structural hazard？', '下一節再解答');
    S.q = small(note('解法：下一節', 3.6, 2.2), 11);
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '計算機組織・第 3 章',
    title: 'CPU 設計：單週期 Datapath 與 Control',
    color: 'var(--ca)',
    modes: [
      { id: 'datapath', name: '單週期資料路徑', enter: enterDatapath },
      { id: 'control', name: '控制訊號表', enter: enterControl },
      { id: 'aluctl', name: 'ALU control', enter: enterALU },
      { id: 'timing', name: '單週期 vs 多週期', enter: enterTiming },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['clocking', 'build-datapath', 'fetch', 'r-type-flow', 'lw-flow', 'sw-flow', 'beq-flow', 'control-table', 'alu-control', 'jump-add', 'single-cycle-time', 'multi-cycle'].concat(FRAG.map((f) => f[0])),
    stop() { run++; },
  };
}
