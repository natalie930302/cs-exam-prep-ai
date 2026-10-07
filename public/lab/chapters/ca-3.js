// 計算機組織 第3章：CPU 設計（單週期 MIPS datapath、控制訊號、ALU control、單週期 vs 多週期）。
// 本章影片（黃婷婷 14A–17A）目前都沒有逐字稿，場景依 Patterson & Hennessy 第 4 章（單週期）與
// 第 3 版第 5 章（多週期）的圖與例題，名稱標「課本」。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
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
    say('課本例：IF 200、Reg 100、ALU 200、Mem 200、WB 100 ps', '各指令要經過哪些單元？');
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
    sceneOrder: ['clocking', 'build-datapath', 'fetch', 'r-type-flow', 'lw-flow', 'sw-flow', 'beq-flow', 'control-table', 'alu-control', 'jump-add', 'single-cycle-time', 'multi-cycle'],
    stop() { run++; },
  };
}
