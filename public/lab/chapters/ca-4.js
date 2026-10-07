// 計算機組織 第4章：Pipeline（五級管線、structural / data / control hazard、forwarding、load-use stall、
// branch prediction、delayed branch、CPI with stalls）。
// 本章影片（黃婷婷 17B–21B、Pipeline Hazards）目前都沒有逐字稿，場景依 Patterson & Hennessy 第 4 章的圖與例題。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '10px', fontWeight: '600' };
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
  const mono = (l, px = 10) => { Object.assign(l.element.style, MONO, { fontSize: px + 'px' }); return l; };
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await W(tok, ms / steps); } }
  function line(pts, color = '#8a7a5c') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => V3(p[0], p[1], p[2] || 0))), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function arrow(x1, y1, x2, y2, color, z = 0.45) {
    const l = line([[x1, y1, z], [x2, y2, z]], color);
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 10), new THREE.MeshBasicMaterial({ color }));
    h.position.set(x2, y2, z); h.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    lab.world.add(h);
    return l;
  }
  function bar(color, w, d, x, y, z = 0) { const m = lab.box(color, [w, d, 0.6]); m.position.set(x, y, z); lab.world.add(m); return m; }

  // ───────────────────────── 管線排程引擎 ─────────────────────────
  const STG = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const SCOL = { IF: '#4b9ee2', ID: '#9b7ef4', EX: '#dd8238', MEM: '#2fc092', WB: '#e55a9b', stall: '#cfc6b6' };
  const reg = (s) => { s = String(s).trim(); return s === '$zero' || s === '$0' ? null : s; };
  function parseIns(text, extra = {}) {
    const m = text.trim().match(/^(\w+)\s*(.*)$/);
    const op = m[1], a = m[2].split(',').map((x) => x.trim()).filter(Boolean);
    const I = { text, op, dst: null, sEX: [], sMEM: [], sID: [], ...extra };
    const mem = (s) => s.replace(/\s/g, '').match(/\((\$\w+)\)/)[1];
    if (['add', 'sub', 'and', 'or', 'slt', 'nor'].includes(op)) { I.dst = reg(a[0]); I.sEX = [a[1], a[2]].map(reg).filter(Boolean); }
    else if (['addi', 'andi', 'ori', 'slti', 'sll', 'srl'].includes(op)) { I.dst = reg(a[0]); I.sEX = [reg(a[1])].filter(Boolean); }
    else if (op === 'lw') { I.dst = reg(a[0]); I.sEX = [reg(mem(a[1]))].filter(Boolean); I.load = true; }
    else if (op === 'sw') { I.sEX = [reg(mem(a[1]))].filter(Boolean); I.sMEM = [reg(a[0])].filter(Boolean); I.store = true; }
    else if (op === 'beq' || op === 'bne') { I.sID = [a[0], a[1]].map(reg).filter(Boolean); I.branch = true; }
    else if (op === 'j') { I.jump = true; }
    return I;
  }
  // opt: { fwd: bool, br: 'stall' | 'pnt', mem1: bool }
  function schedule(prog, opt) {
    const rows = [];
    const real = () => rows.filter((r) => !r.ghost);
    for (let i = 0; i < prog.length; i++) {
      const I = prog[i];
      const prevs = real();
      const prev = prevs[prevs.length - 1];
      let IF = prev ? prev.IF + 1 : 1;
      if (prev && (prev.jump || prev.branch)) {
        const resolve = prev.ID;
        if (prev.jump || opt.br === 'stall' || prev.taken) {
          if (prev.jump || prev.taken) { if (opt.br !== 'stall' || prev.jump) rows.push({ ghost: true, text: prev.flushText || '（被 flush 的指令）', IF: resolve, why: 'flush' }); }
          IF = Math.max(IF, resolve + 1);
        }
      }
      if (opt.mem1) while (rows.some((r) => !r.ghost && (r.load || r.store) && r.MEM === IF)) IF++;
      const ID0 = Math.max(IF + 1, prev ? prev.ID + 1 : 0);
      let ID = ID0;
      const R = { ...I, IF, fwds: [], deps: [], hz: [] };
      const prod = (r) => { for (let k = prevs.length - 1; k >= 0; k--) if (prevs[k].dst === r) return prevs[k]; return null; };
      const need = [...I.sEX.map((r) => [r, 'EX']), ...I.sMEM.map((r) => [r, 'MEM']), ...I.sID.map((r) => [r, 'ID'])];
      for (const [r, at] of need) {
        const p = prod(r);
        if (!p) continue;
        if (!opt.fwd) ID = Math.max(ID, p.WB);
        else if (at === 'EX') { if (p.load) ID = Math.max(ID, p.MEM); }
        else if (at === 'ID') ID = Math.max(ID, p.load ? p.MEM + 1 : p.EX + 1);
      }
      R.ID = ID; R.EX = ID + 1; R.MEM = ID + 2; R.WB = ID + 3; R.stall = ID - ID0;
      for (const [r, at] of need) {
        const p = prod(r);
        if (!p) continue;
        if (p.WB > ID0 && !R.hz.includes(r)) R.hz.push(r);
        if (opt.fwd) { if (p.WB > R.ID) R.fwds.push({ p, r, from: p.load ? 'MEM' : 'EX', to: at }); }
        else if (p.WB >= ID0) R.deps.push({ p, r, half: p.WB === ID0 });
      }
      rows.push(R);
    }
    const reals = real();
    const total = reals.length ? reals[reals.length - 1].WB : 0;
    return { rows, total, n: reals.length, stalls: total - (reals.length + 4) };
  }
  function stageAt(r, c) {
    if (r.ghost) return c === r.IF ? 'IF' : null;
    if (c === r.IF) return 'IF';
    if (c > r.IF && c < r.ID) return 'stall';
    for (const s of STG.slice(1)) if (r[s] === c) return s;
    return null;
  }
  // draw a pipeline diagram (rows = instructions, columns = clock cycles), dropping in cycle by cycle
  async function drawPipe(prog, opt, tok, pace, talk) {
    const S = schedule(prog, opt);
    const T = Math.max(S.total, 5);
    const w = Math.min(0.78, 10.0 / T), x0 = -3.3;
    const cx = (c) => x0 + (c - 0.5) * w;
    const dy = Math.min(0.72, 6.0 / Math.max(S.rows.length, 1));
    const cy = (k) => 6.3 - k * dy;
    const G = { S, cells: [], cx, cy, w, dy };
    for (let c = 1; c <= T; c++) small(tag(String(c), 'idx', cx(c), 6.95), 9);
    S.rows.forEach((r, k) => {
      const l = mono(tag(r.text, r.ghost ? 'idx' : '', -5.0, cy(k)), dy < 0.6 ? 9 : 10);
      if (r.ghost) l.element.style.textDecoration = 'line-through';
      G.cells.push({});
    });
    for (let c = 1; c <= T; c++) {
      S.rows.forEach((r, k) => {
        const s = stageAt(r, c);
        if (!s) return;
        const m = cube(s === 'stall' ? '·' : s, r.ghost ? '#e8b4b4' : SCOL[s], [w * 0.92, Math.min(0.5, dy * 0.75), 0.5], cx(c), cy(k), 0, pace ? 1.2 : 0);
        small(m.userData.lbl, w < 0.6 ? 8 : 9);
        G.cells[k][s === 'stall' ? 'stall' + c : s] = m;
      });
      if (pace) await W(tok, pace);
    }
    S.rows.forEach((r, k) => { if (r.ghost) small(tag('flush', 'ptr', cx(r.IF) + w * 0.9, cy(k)), 9); });
    // forwarding / dependency arrows
    S.rows.forEach((r, k) => {
      if (r.ghost) return;
      for (const f of r.fwds) {
        const pk = S.rows.indexOf(f.p);
        arrow(cx(f.p[f.from]) + w * 0.4, cy(pk) - 0.15, cx(r[f.to]) - w * 0.35, cy(k) + 0.12, '#c08a1f');
      }
      for (const d of r.deps) {
        const pk = S.rows.indexOf(d.p);
        arrow(cx(d.p.WB), cy(pk) - 0.15, cx(r.ID), cy(k) + 0.12, '#d64545');
      }
    });
    const cpi = S.n ? (S.total - 4) / S.n : 0;
    setState('Pipeline diagram', [['指令數', String(S.n)], ['總 cycles', String(S.total)], ['stall cycles', String(S.stalls)], ['CPI（扣掉填滿的 4 cycles）', (+cpi.toFixed(2)).toString()]],
      (opt.fwd ? 'forwarding 開' : '<span class="no">沒有 forwarding</span>') + '；分支：' + (opt.br === 'stall' ? '一律 stall' : 'predict not taken + flush') + (opt.mem1 ? '；<span class="no">單一記憶體</span>' : '')
      + '<br>金色箭頭 = forwarding；紅色箭頭 = 要等 WB 寫回（同 cycle 前半寫、後半讀）');
    return G;
  }

  // ───────────────────────── 模式 1：Pipeline diagram ─────────────────────────
  const PROGS = {
    lw3: { name: '三個 lw（沒有 hazard）', src: ['lw $1, 100($0)', 'lw $2, 200($0)', 'lw $3, 300($0)'] },
    dep: { name: 'sub $2 後面一串都用 $2', src: ['sub $2, $1, $3', 'and $12, $2, $5', 'or $13, $6, $2', 'add $14, $2, $2', 'sw $15, 100($2)'] },
    load: { name: 'load-use：lw $2 後馬上用', src: ['lw $2, 20($1)', 'and $4, $2, $5', 'or $8, $2, $6', 'add $9, $4, $2', 'slt $1, $6, $7'] },
    abc: { name: 'a = b + e; c = b + f（原順序）', src: ['lw $t1, 0($t0)', 'lw $t2, 4($t0)', 'add $t3, $t1, $t2', 'sw $t3, 12($t0)', 'lw $t4, 8($t0)', 'add $t5, $t1, $t4', 'sw $t5, 16($t0)'] },
    abc2: { name: 'a = b + e; c = b + f（重排後）', src: ['lw $t1, 0($t0)', 'lw $t2, 4($t0)', 'lw $t4, 8($t0)', 'add $t3, $t1, $t2', 'sw $t3, 12($t0)', 'add $t5, $t1, $t4', 'sw $t5, 16($t0)'] },
    lwsw: { name: 'lw 後接 sw 存同一個值', src: ['lw $t0, 0($s1)', 'sw $t0, 4($s2)', 'add $t1, $t0, $s3'] },
    br: { name: 'beq 成立（課本 36/40/72）', src: ['sub $10, $4, $8', 'beq $1, $3, 7', 'lw $4, 50($7)'], extra: { 1: { taken: true, flushText: 'and $12, $2, $5' } } },
    brdep: { name: 'beq 用到前一個 add 的結果', src: ['add $1, $2, $3', 'beq $1, $4, L', 'or $5, $6, $7'], extra: { 1: { taken: false } } },
    struct: { name: '單一記憶體：lw 之後連續 4 個指令', src: ['lw $1, 100($0)', 'add $2, $3, $4', 'add $5, $6, $7', 'add $8, $9, $10', 'add $11, $12, $13'] },
  };
  const mkProg = (key) => PROGS[key].src.map((t, i) => parseIns(t, (PROGS[key].extra || {})[i] || {}));
  const pp = { key: 'dep', fwd: false, br: 'pnt', mem1: false };
  function enterPipe() {
    fresh([0.6, 3.6, 13.2], [0.6, 3.6, 0]);
    controls('<select id="pP">' + Object.keys(PROGS).map((k) => '<option value="' + k + '">' + PROGS[k].name + '</option>').join('') + '</select>'
      + '<label><input type="checkbox" id="pF"' + (pp.fwd ? ' checked' : '') + '> forwarding</label>'
      + '<select id="pB"><option value="pnt">predict not taken</option><option value="stall">分支一律 stall</option></select>'
      + '<label><input type="checkbox" id="pM"' + (pp.mem1 ? ' checked' : '') + '> 單一記憶體</label><button class="primary" id="pGo">一個 cycle 一個 cycle 跑</button>');
    $('pP').value = pp.key; $('pB').value = pp.br;
    $('pP').onchange = (e) => { pp.key = e.target.value; pp.mem1 = pp.key === 'struct'; enterPipe(); };
    $('pB').onchange = (e) => { pp.br = e.target.value; redraw(0); };
    $('pF').onchange = (e) => { pp.fwd = !!e.target.checked; redraw(0); };
    $('pM').onchange = (e) => { pp.mem1 = !!e.target.checked; redraw(0); };
    on('pGo', () => redraw(260));
    redraw(0);
  }
  function redraw(pace) {
    go((async (t) => {
      lab.clear();
      const G = await drawPipe(mkProg(pp.key), pp, t, pace);
      const S = G.S;
      S.rows.forEach((r) => { if (!r.ghost && r.hz.length) log(r.text + '：用到 ' + r.hz.join('、') + (pp.fwd ? '（forwarding' + (r.stall ? '，但還要 stall ' + r.stall + ' cycle' : '') + '）' : '（要等 WB' + (r.stall ? '，stall ' + r.stall + ' cycle' : '') + '）')); });
      if (pp.key === 'lwsw' && pp.fwd) log('lw → sw 的 store data：這裡假設 MEM/WB → MEM 的 forwarding，所以不用 stall；P&H 基本版的 hazard detection 只比對 rs/rt，會保守地 stall。', true);
      log('共 ' + S.total + ' cycles，stall ' + S.stalls + ' 個。');
    })(newRun()));
  }

  // ───────────────────────── 模式 2：Forwarding unit ─────────────────────────
  const FWI = ['add $1, $1, $2', 'add $1, $1, $3', 'add $1, $1, $4', 'sub $2, $1, $3', 'and $12, $2, $5', 'or $13, $6, $2', 'lw $2, 20($1)', 'add $9, $4, $2', 'sw $2, 0($3)', 'or $0, $1, $2', 'add $4, $5, $6'];
  const fu = { a: 'sub $2, $1, $3', b: 'add $4, $5, $6', c: 'and $12, $2, $5' };
  function decodeFU(text) {
    const I = parseIns(text);
    const m = text.match(/^(\w+)\s*(.*)$/); const a = m[2].split(',').map((x) => x.trim());
    let rs = null, rt = null, rd = null, regWrite = false;
    if (['add', 'sub', 'and', 'or', 'slt'].includes(I.op)) { rd = a[0]; rs = a[1]; rt = a[2]; regWrite = true; }
    else if (I.op === 'lw') { rd = a[0]; rs = a[1].match(/\((\$\w+)\)/)[1]; regWrite = true; }
    else if (I.op === 'sw') { rt = a[0]; rs = a[1].match(/\((\$\w+)\)/)[1]; }
    return { ...I, rs, rt, rd, regWrite };
  }
  function fwdLogic(a, b, c) {
    // a = 在 MEM/WB 的指令（較早），b = 在 EX/MEM 的指令，c = 在 ID/EX（要用運算元）的指令
    const nz = (r) => r && r !== '$0' && r !== '$zero';
    const exA = b.regWrite && nz(b.rd) && b.rd === c.rs, exB = b.regWrite && nz(b.rd) && c.rt && b.rd === c.rt;
    const memA = a.regWrite && nz(a.rd) && !exA && a.rd === c.rs, memB = a.regWrite && nz(a.rd) && c.rt && !exB && a.rd === c.rt;
    const FA = exA ? '10' : memA ? '01' : '00', FB = exB ? '10' : memB ? '01' : '00';
    const loadUse = b.op === 'lw' && (b.rd === c.rs || (c.rt && b.rd === c.rt)) && nz(b.rd);
    return { FA, FB, exA, exB, memA, memB, loadUse };
  }
  function enterFwd() {
    fresh([0, 3.6, 13.5], [0, 3.0, 0]);
    const sel = (id, v) => '<select id="' + id + '">' + FWI.map((t) => '<option' + (t === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
    controls('較早 ' + sel('fA', fu.a) + ' 前一個 ' + sel('fB', fu.b) + ' 現在 ' + sel('fC', fu.c) + '<button class="primary" id="fGo">現在這個進 EX</button>'
      + '<button id="fEx1">課本：sub/and/or</button><button id="fEx2">double data hazard</button>');
    const read = () => { fu.a = $('fA').value; fu.b = $('fB').value; fu.c = $('fC').value; };
    on('fGo', () => { read(); go(drawFwd(newRun(), 700, false)); });
    on('fEx1', () => { fu.a = 'sub $2, $1, $3'; fu.b = 'and $12, $2, $5'; fu.c = 'or $13, $6, $2'; enterFwd(); go(drawFwd(newRun(), 700, false)); });
    on('fEx2', () => { fu.a = 'add $1, $1, $2'; fu.b = 'add $1, $1, $3'; fu.c = 'add $1, $1, $4'; enterFwd(); go(drawFwd(newRun(), 700, false)); });
    go(drawFwd(newRun(), 0, false));
  }
  async function drawFwd(t, pace, talk) {
    lab.clear();
    const a = decodeFU(fu.a), b = decodeFU(fu.b), c = decodeFU(fu.c);
    const regBox = (name, x, ins, lines) => { cube('', '#6e5f49', [0.5, 4.2, 0.5], x, 3.2, 0); small(tag(name, 'ptr', x, 5.6), 10); mono(tag(ins, 'idx', x, 6.2), 9); lines.forEach(([k, v], i) => small(tag(k + ' = ' + v, 'idx', x + 0.95, 4.6 - i * 0.55), 9)); };
    regBox('ID/EX', -4.8, c.text, [['Rs', c.rs || '-'], ['Rt', c.rt || '-']]);
    regBox('EX/MEM', 1.6, b.text, [['Rd', b.rd || '-'], ['RegWrite', b.regWrite ? 1 : 0]]);
    regBox('MEM/WB', 5.4, a.text, [['Rd', a.rd || '-'], ['RegWrite', a.regWrite ? 1 : 0]]);
    const muxA = cube('A', '#8a7a5c', [0.4, 0.9, 0.5], -2.6, 4.0, 0), muxB = cube('B', '#8a7a5c', [0.4, 0.9, 0.5], -2.6, 2.2, 0);
    const alu = cube('ALU', '#dd8238', [1.0, 2.4, 0.6], -0.8, 3.1, 0);
    line([[-4.55, 4.0], [-2.8, 4.0]]); line([[-4.55, 2.2], [-2.8, 2.2]]); line([[-2.4, 4.0], [-1.3, 3.8]]); line([[-2.4, 2.2], [-1.3, 2.4]]);
    const r = fwdLogic(a, b, c);
    const fl = [];
    const fwLine = (fromX, y0, toY, on_) => { const l = line([[fromX, y0, 0.3], [fromX, 0.6, 0.3], [-3.2, 0.6, 0.3], [-3.2, toY, 0.3], [-2.8, toY, 0.3]], on_ ? '#d68a00' : '#d8cfc0'); fl.push(l); return l; };
    fwLine(1.6, 1.1, r.exA ? 4.15 : 2.35, r.exA || r.exB);
    if (r.exA && r.exB) fwLine(1.65, 1.1, 2.35, true);
    fwLine(5.4, 1.1, r.memA ? 3.85 : 2.05, r.memA || r.memB);
    if (r.memA && r.memB) fwLine(5.45, 1.1, 2.05, true);
    small(tag('EX/MEM → ALU', 'idx', 1.6, 0.25), 9); small(tag('MEM/WB → ALU', 'idx', 5.4, 0.25), 9);
    const ta = small(tag('ForwardA = ' + r.FA, r.FA !== '00' ? 'ptr alt' : 'ptr', -2.6, 5.0), 10), tb = small(tag('ForwardB = ' + r.FB, r.FB !== '00' ? 'ptr alt' : 'ptr', -2.6, 1.3), 10);
    if (r.FA !== '00') glow(muxA, GOLD);
    if (r.FB !== '00') glow(muxB, GOLD);
    if (pace) await W(t, pace);
    const why = [];
    if (r.exA) why.push('EX hazard：EX/MEM.Rd = ID/EX.Rs = ' + c.rs + ' → ForwardA = 10');
    if (r.exB) why.push('EX hazard：EX/MEM.Rd = ID/EX.Rt = ' + c.rt + ' → ForwardB = 10');
    if (r.memA) why.push('MEM hazard：MEM/WB.Rd = Rs = ' + c.rs + '（EX/MEM 沒有命中）→ ForwardA = 01');
    if (r.memB) why.push('MEM hazard：MEM/WB.Rd = Rt = ' + c.rt + ' → ForwardB = 01');
    if (a.regWrite && b.regWrite && a.rd === b.rd && b.rd === c.rs && a.rd) why.push('兩邊都命中時選比較新的 EX/MEM（double data hazard）');
    if (b.rd === '$0' || a.rd === '$0') why.push('Rd = $0 不 forward（$0 永遠是 0）');
    if (r.loadUse) why.push('前一個是 lw 而且被用到：值要到 MEM 結束才有，hazard detection unit 必須先 stall 1 cycle（load-use）');
    if (!why.length) why.push('沒有 hazard：運算元直接用從 register file 讀到的值');
    why.forEach((w_, i) => log(w_, r.loadUse && i === why.length - 1));
    if (talk) say(why[0], 'ForwardA = ' + r.FA + '，ForwardB = ' + r.FB);
    setState('Forwarding unit', [['ID/EX（現在）', c.text], ['EX/MEM（前一個）', b.text], ['MEM/WB（更早）', a.text], ['ForwardA', r.FA], ['ForwardB', r.FB]],
      '10：從 EX/MEM 拿；01：從 MEM/WB 拿；00：用 register file<br>條件要檢查 RegWrite、Rd ≠ 0、Rd = Rs/Rt' + (r.loadUse ? '<br><span class="no">load-use：forwarding 不夠，要 stall</span>' : ''));
    return { r, ta, tb, fl, alu };
  }

  // ───────────────────────── 模式 3：Branch prediction ─────────────────────────
  const bp = { kind: '2bit', pat: 'TTTTTTTTTN', reps: 2 };
  const P2 = ['00 強 NT', '01 弱 NT', '10 弱 T', '11 強 T'];
  function predictRun(kind, outs, s0) {
    let s = s0 === undefined ? (kind === '1bit' ? 1 : 3) : s0;
    const R = [];
    for (const o of outs) {
      const t = o === 'T';
      const pred = kind === '1bit' ? s === 1 : s >= 2;
      const before = s;
      if (kind === '1bit') s = t ? 1 : 0; else s = t ? Math.min(3, s + 1) : Math.max(0, s - 1);
      R.push({ o, pred, ok: pred === t, before, after: s });
    }
    return R;
  }
  function enterPredict() {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    controls('<select id="bK"><option value="1bit">1-bit predictor</option><option value="2bit">2-bit predictor</option></select>'
      + '<label>結果序列 <input id="bPat" value="' + bp.pat + '" style="width:120px"></label><label>× <input id="bR" type="number" min="1" max="3" value="' + bp.reps + '" style="width:40px"></label>'
      + '<button class="primary" id="bGo">逐次預測</button>');
    $('bK').value = bp.kind;
    $('bK').onchange = (e) => { bp.kind = e.target.value; enterPredict(); };
    on('bGo', () => {
      const p = String($('bPat').value).toUpperCase().replace(/\s/g, ''), r = Math.round(Number($('bR').value));
      if (!/^[TN]{1,12}$/.test(p)) { log('序列只能用 T（taken）和 N（not taken），最多 12 個', true); return; }
      if (!(r >= 1 && r <= 3)) { log('重複次數 1 ～ 3', true); return; }
      bp.pat = p; bp.reps = r;
      go(playPredict(newRun(), 420, false));
    });
    log('初始狀態設成「上一次離開迴圈後」：1-bit 是 NT、2-bit 是弱 T，對應課本說的穩定狀態（80% / 90%）。');
    go(playPredict(newRun(), 0, false));
  }
  async function playPredict(t, pace, talk) {
    lab.clear();
    const outs = bp.pat.repeat(bp.reps).split('');
    const R = predictRun(bp.kind, outs, bp.kind === '1bit' ? 0 : 2); // 從「上一次離開迴圈後」的狀態開始
    const ns = bp.kind === '1bit' ? 2 : 4;
    const names = bp.kind === '1bit' ? ['0：預測 NT', '1：預測 T'] : P2;
    const st = names.map((n, i) => cube(n, i >= ns / 2 ? '#2fc092' : '#dd8238', [2.4, 0.7, 0.9], -4.5 + i * (9 / (ns - 1 || 1)), 5.2, 0));
    st.forEach((m) => small(m.userData.lbl, 10));
    const marker = cube('', '#c08a1f', [0.5, 0.3, 0.5], st[R.length ? R[0].before : 0].position.x, 5.9, 0);
    const w = Math.min(0.55, 12.4 / outs.length);
    let ok = 0;
    for (let k = 0; k < R.length; k++) {
      const x = -6.2 + (k + 0.5) * w;
      const r = R[k];
      st.forEach((m, i) => glow(m, i === r.before ? GOLD : null));
      marker.position.x = st[r.before].position.x;
      cube(r.pred ? 'T' : 'N', '#bcd8f3', [w * 0.9, 0.35, 0.5], x, 2.6, 0, pace ? 1 : 0);
      cube(r.o, r.ok ? '#2fc092' : '#d64545', [w * 0.9, 0.35, 0.5], x, 1.6, 0, pace ? 1 : 0);
      if (r.ok) ok++;
      if (talk) say('第 ' + (k + 1) + ' 次：預測 ' + (r.pred ? 'T' : 'N') + '、實際 ' + r.o, r.ok ? '猜對' : '猜錯 → flush');
      if (pace) await W(t, pace);
    }
    st.forEach((m, i) => glow(m, i === (R.length ? R[R.length - 1].after : 0) ? GOLD : null));
    tag('預測', 'ptr', -6.6, 2.6); tag('實際', 'ptr', -6.6, 1.6);
    small(tag('猜對 ' + ok + ' / ' + R.length, 'ptr alt', 0, 0.6), 11);
    setState(bp.kind === '1bit' ? '1-bit predictor' : '2-bit predictor', [['序列', bp.pat + ' × ' + bp.reps], ['猜對', ok + ' / ' + R.length], ['正確率', R.length ? (+(ok / R.length * 100).toFixed(1)) + '%' : '-']],
      bp.kind === '1bit' ? '1-bit：上次怎樣這次就猜怎樣 → 迴圈出口與再進入各錯一次' : '2-bit：要連錯兩次才改變預測 → 迴圈每次只錯出口那一次');
    return { ok, n: R.length };
  }

  // ───────────────────────── 模式 4：CPI 與 stall ─────────────────────────
  const cpiS = { ld: 25, use: 50, st: 10, br: 11, mis: 25, bpen: 1, jp: 2, jpen: 1 };
  function enterCPI() {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    const inp = (id, v) => '<input id="' + id + '" type="number" value="' + v + '" style="width:46px">';
    controls('load % ' + inp('k0', cpiS.ld) + ' 其中接著用 % ' + inp('k1', cpiS.use) + ' store % ' + inp('k2', cpiS.st) + ' branch % ' + inp('k3', cpiS.br) + ' 猜錯 % ' + inp('k4', cpiS.mis)
      + ' 分支 penalty ' + inp('k5', cpiS.bpen) + ' jump % ' + inp('k6', cpiS.jp) + ' jump penalty ' + inp('k7', cpiS.jpen) + '<button class="primary" id="kGo">計算 CPI</button>');
    on('kGo', () => {
      const v = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => Number($('k' + i).value));
      if (v.some((x) => !(x >= 0)) || v[0] + v[2] + v[3] + v[6] > 100 || v[1] > 100 || v[4] > 100 || v[5] > 10 || v[7] > 10) { log('比例要 0 ～ 100、load + store + branch + jump ≤ 100%，penalty 0 ～ 10', true); return; }
      [cpiS.ld, cpiS.use, cpiS.st, cpiS.br, cpiS.mis, cpiS.bpen, cpiS.jp, cpiS.jpen] = v;
      go(drawCPI(newRun(), 300, false));
    });
    go(drawCPI(newRun(), 0, false));
  }
  async function drawCPI(t, pace, talk) {
    lab.clear();
    const s = cpiS;
    const alu = 100 - s.ld - s.st - s.br - s.jp;
    const parts = [
      ['ALU', alu / 100, 1, '#4b9ee2'],
      ['load', s.ld / 100, 1 + s.use / 100, '#2fc092'],
      ['store', s.st / 100, 1, '#9b7ef4'],
      ['branch', s.br / 100, 1 + s.mis / 100 * s.bpen, '#dd8238'],
      ['jump', s.jp / 100, 1 + s.jpen, '#e55a9b'],
    ];
    let cpi = 0, yb = 0, ys = 0;
    const H = 4.4;
    small(tag('CPI = 1', 'idx', -2.6, H), 10);
    for (const [n, f, c, col] of parts) {
      const base = f * H, extra = f * (c - 1) * H;
      if (base > 0.001) { const m = bar(col, 2.4, Math.max(0.01, base - 0.02), 0, yb + base / 2, 0); yb += base; if (base > 0.3) { m.userData.lbl = small(lab.label(n + ' ' + (+(f * 100).toFixed(1)) + '%', 'val'), 9); m.add(m.userData.lbl); } }
      if (extra > 0.001) { const m = bar('#d64545', 2.4, Math.max(0.01, extra - 0.02), 0, H + ys + extra / 2, 0); ys += extra; small(tag(n + ' stall +' + (+(f * (c - 1)).toFixed(4)), 'idx', 2.6, H + ys - extra / 2), 9); m.userData.k = n; }
      cpi += f * c;
      if (pace) await W(t, pace);
    }
    line([[-1.6, H, 0.4], [1.6, H, 0.4]], '#6e5f49');
    small(tag('CPI = ' + (+cpi.toFixed(3)), 'ptr alt', 0, H + ys + 0.5), 11);
    setState('CPI = 1 + 平均每個指令的 stall', parts.map(([n, f, c]) => [n + '（' + (+(f * 100).toFixed(1)) + '%）', 'CPI ' + (+c.toFixed(3))]),
      'CPI = Σ 比例 × 該類 CPI = <span class="ok">' + (+cpi.toFixed(4)) + '</span><br>load-use 1 個 stall；分支猜錯 penalty ' + s.bpen + '；jump ' + s.jpen);
    return cpi;
  }

  // ───────────────────────── 場景（課本） ─────────────────────────
  async function scLaundry(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    const ST = [['洗', '#4b9ee2'], ['烘', '#dd8238'], ['摺', '#2fc092'], ['收', '#9b7ef4']];
    const L = ['A', 'B', 'C', 'D'];
    const w = 0.42; // 30 分鐘
    say('課本：洗衣服的 pipeline', '4 籃衣服，每步 30 分鐘');
    await beat(tok, 2200);
    tag('依序做', 'ptr', -6.4, 5.8);
    for (let k = 0; k < 4; k++) for (let s = 0; s < 4; s++) { cube(ST[s][0], ST[s][1], [w * 0.95, 0.42, 0.5], -6.2 + (k * 4 + s + 0.5) * w * 1.0 + 0.6, 5.8 - k * 0.5, 0, 1); await beat(tok, 90); }
    tag('8 小時', 'ptr alt', 5.6, 4.4);
    say('一籃做完才開始下一籃', '4 × 2 小時 = 8 小時');
    await beat(tok, 2400);
    tag('pipeline', 'ptr', -6.4, 2.6);
    for (let k = 0; k < 4; k++) for (let s = 0; s < 4; s++) { cube(ST[s][0], ST[s][1], [w * 0.95, 0.42, 0.5], -6.2 + (k + s + 0.5) * w + 0.6, 2.6 - k * 0.5, 0, 1); await beat(tok, 90); }
    tag('3.5 小時', 'ptr alt', -6.2 + 7 * w + 1.6, 1.4);
    say('洗衣機空出來就洗下一籃', '(4 + 3) × 30 分 = 3.5 小時');
    await beat(tok, 2800);
    say('speedup = 8 / 3.5 ≈ 2.3', '籃數很多時趨近 4 = 階段數');
    await beat(tok, 2800);
    say('pipeline 不會讓「一籃」變快', '提高的是 throughput');
    await beat(tok, 2600);
  }
  async function scFive(tok) {
    fresh([0, 3.4, 13.5], [0, 2.6, 0]);
    const st = [['IF', 'Instr Mem', '#4b9ee2'], ['ID', 'Reg Read', '#9b7ef4'], ['EX', 'ALU', '#dd8238'], ['MEM', 'Data Mem', '#2fc092'], ['WB', 'Reg Write', '#e55a9b']];
    const xs = st.map((_, i) => -5.4 + i * 2.7);
    st.forEach(([s, u, c], i) => { cube(u, c, [1.8, 1.0, 0.8], xs[i], 2.4, 0); tag(s, 'ptr', xs[i], 3.4); });
    const pr = ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'].map((n, i) => { const m = cube('', '#6e5f49', [0.25, 1.8, 0.6], xs[i] + 1.35, 2.4, 0); small(tag(n, 'idx', xs[i] + 1.35, 1.2), 9); return m; });
    say('MIPS 五個階段', 'IF → ID → EX → MEM → WB');
    await beat(tok, 2600);
    say('階段之間放 pipeline register', '把上一段的結果留給下一個 cycle 用');
    pr.forEach((m) => glow(m, GOLD));
    await beat(tok, 2400);
    pr.forEach((m) => glow(m, null));
    const caps = [['IF：用 PC 讀指令，PC + 4', 'lw $1, 100($0)'], ['ID：讀暫存器、sign-extend', '讀 $0、立即值 100'], ['EX：ALU 算位址', '0 + 100 = 100'], ['MEM：讀 Mem[100]', ''], ['WB：寫回 $1', '寫在 cycle 前半，ID 讀在後半']];
    const tk = cube('lw', '#c08a1f', [0.9, 0.5, 0.5], xs[0] - 1.6, 2.4, 0.7);
    for (let i = 0; i < 5; i++) {
      move(tk, xs[i], 2.4, 0.7);
      say(caps[i][0], caps[i][1]);
      await beat(tok, 2000);
    }
    say('右到左的資料流：WB 寫回、分支改 PC', '這兩條就是 hazard 的來源');
    await beat(tok, 3000);
  }
  async function scSpeedup(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    say('課本例：IF 200、ID 100、EX 200、MEM 200、WB 100 ps', '三個 lw');
    const sc = 0.0042;
    tag('單週期', 'ptr', -6.3, 5.6);
    for (let k = 0; k < 3; k++) { cube('lw', '#4b9ee2', [800 * sc - 0.08, 0.5, 0.6], -5.6 + 800 * sc * (k + 0.5), 5.6, 0, 1.5); await beat(tok, 500); }
    tag('2400 ps', 'ptr alt', -5.6 + 2400 * sc + 0.8, 5.6);
    say('單週期：clock 800 ps，三個 lw = 2400 ps', '');
    await beat(tok, 2400);
    tag('pipeline', 'ptr', -6.3, 3.6);
    for (let k = 0; k < 3; k++) for (let s = 0; s < 5; s++) { cube(['IF', 'ID', 'EX', 'MEM', 'WB'][s], ['#4b9ee2', '#9b7ef4', '#dd8238', '#2fc092', '#e55a9b'][s], [200 * sc - 0.06, 0.42, 0.5], -5.6 + 200 * sc * (k + s + 0.5), 3.6 - k * 0.55, 0, 1); await beat(tok, 70); }
    tag('1400 ps', 'ptr alt', -5.6 + 1400 * sc + 0.8, 2.5);
    say('pipeline：每段都要 200 ps（最慢那段）', '7 個 cycle × 200 = 1400 ps');
    await beat(tok, 3000);
    say('指令間隔 800 → 200 ps：理想加速 4 倍', '不是 5 倍：各段不平衡（ID、WB 只要 100）');
    await beat(tok, 3200);
    say('指令很多時：時間 ≈ 單週期 / 階段數', '單一指令的 latency 反而變長（1000 ps）');
    await beat(tok, 3000);
  }
  const pipeScene = (key, opt, intro, outro) => async (tok) => {
    fresh([0.6, 3.6, 13.2], [0.6, 3.6, 0]);
    say(intro[0], intro[1]);
    await beat(tok, 2200);
    const G = await drawPipe(mkProg(key), opt, tok, 380, true);
    for (const [a, b] of outro) { say(a, b); await beat(tok, 2800); }
    return G;
  };
  const scStruct = pipeScene('struct', { fwd: true, br: 'pnt', mem1: true }, ['Structural hazard：只有一個記憶體', 'lw 的 MEM 和第 4 個指令的 IF 搶記憶體'],
    [['第 4 個指令的 IF 只好晚一個 cycle', '同一個 cycle 不能「讀指令」又「讀資料」'], ['解法：指令、資料分開（split cache）', 'MIPS 的 pipeline 就是這樣設計，所以沒有這個 hazard']]);
  const scData = pipeScene('dep', { fwd: false, br: 'pnt', mem1: false }, ['課本例：sub $2 之後一串都用 $2', '沒有 forwarding'],
    [['$2 要到 cycle 5 的 WB 才寫回', 'and 得等，後面的指令也跟著停'], ['register file：前半寫、後半讀', 'and 停到 cycle 5 的 ID 就讀得到新的 $2'], ['沒有 forwarding：多了 2 個 stall', '']]);
  const scFwd = pipeScene('dep', { fwd: true, br: 'pnt', mem1: false }, ['同一段程式，加上 forwarding', 'ALU 結果在 EX 結束就有了'],
    [['and 從 EX/MEM 拿 $2；or 從 MEM/WB 拿', '金色箭頭：往右（時間往後）才合法'], ['完全不用 stall', 'CPI 回到 1']]);
  const scLoadUse = pipeScene('load', { fwd: true, br: 'pnt', mem1: false }, ['課本例：lw $2 之後馬上用 $2', 'load-use data hazard'],
    [['lw 的資料要 MEM 結束才有', 'and 的 EX 已經開始了 → 來不及'], ['hazard detection unit：stall 1 cycle（bubble）', '條件：ID/EX.MemRead 且 ID/EX.Rt = IF/ID.Rs 或 Rt'], ['stall 之後再從 MEM/WB forward', 'forwarding 救不了 load-use，只能少 stall']]);
  async function scReorder(tok) {
    fresh([0.6, 3.6, 13.2], [0.6, 3.6, 0]);
    const opt = { fwd: true, br: 'pnt', mem1: false };
    say('課本例：a = b + e; c = b + f;', '有 forwarding，照 C 的順序編譯');
    await beat(tok, 2400);
    let G = await drawPipe(mkProg('abc'), opt, tok, 160, true);
    say('兩個 load-use：' + G.S.total + ' cycles', 'add $t3 等 $t2、add $t5 等 $t4');
    await beat(tok, 3000);
    lab.clear();
    say('把 lw $t4 往前挪', 'compiler 重排指令（instruction scheduling）');
    await beat(tok, 1600);
    G = await drawPipe(mkProg('abc2'), opt, tok, 160, true);
    say('不用 stall：' + G.S.total + ' cycles', '13 → 11 cycles');
    await beat(tok, 3200);
  }
  const scLwSw = pipeScene('lwsw', { fwd: true, br: 'pnt', mem1: false }, ['常見混淆：lw 後面接 sw 存同一個值', 'sw 的資料到 MEM 階段才需要'],
    [['MEM/WB → MEM forwarding：不用 stall', '真正一定 stall 的是 load-use（EX 就要用）'], ['補充：P&H 基本版的 hazard unit 只比對暫存器號碼', '會保守地 stall；題目沒說就以 load-use 判斷']]);
  async function scControl(tok) {
    fresh([0.6, 3.6, 13.2], [0.6, 3.6, 0]);
    say('Control hazard：beq 要到 ID 才知道跳不跳', '課本例：40 beq $1, $3, 7（成立）');
    await beat(tok, 2600);
    let G = await drawPipe(mkProg('br'), { fwd: true, br: 'stall', mem1: false }, tok, 300, true);
    say('做法一：分支一律 stall 1 cycle', '安全但每個分支都慢');
    await beat(tok, 2800);
    lab.clear();
    G = await drawPipe(mkProg('br'), { fwd: true, br: 'pnt', mem1: false }, tok, 300, true);
    say('做法二：predict not taken', '先抓 44 的 and；成立就 flush（IF.Flush）');
    await beat(tok, 3000);
    say('跳到 72：40 + 4 + 7 × 4 = 72', '猜對 0 penalty，猜錯 1 cycle');
    await beat(tok, 2800);
    lab.clear();
    G = await drawPipe(mkProg('brdep'), { fwd: true, br: 'pnt', mem1: false }, tok, 300, true);
    say('分支在 ID 比較：前一個 add 的結果要 forward 到 ID', '來不及 → 多 stall 1 cycle（lw 則 2 cycles）');
    await beat(tok, 3200);
    return G;
  }
  async function scPredict(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    bp.pat = 'TTTTTTTTTN'; bp.reps = 2;
    say('Dynamic branch prediction：用歷史猜', '迴圈分支：taken 9 次、最後 1 次 not taken');
    await beat(tok, 2600);
    bp.kind = '1bit';
    let r = await playPredict(tok, 260, false);
    say('1-bit：每趟迴圈錯 2 次', '正確率 ' + Math.round(r.ok / r.n * 100) + '%（課本：80%）');
    await beat(tok, 3200);
    bp.kind = '2bit';
    r = await playPredict(tok, 260, false);
    say('2-bit：連錯兩次才改預測', '每趟只錯出口那次：' + Math.round(r.ok / r.n * 100) + '%（課本：90%）');
    await beat(tok, 3200);
    say('預測錯：flush 已抓進來的指令', 'branch target buffer 還能先算好目標位址');
    await beat(tok, 2600);
  }
  async function scDelayed(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    say('Delayed branch：分支後一個 slot 一定執行', 'MIPS 早期設計，compiler 負責填');
    const before = ['add $s1, $s2, $s3', 'beq $s2, $zero, L', '（delay slot）'];
    const after = ['beq $s2, $zero, L', 'add $s1, $s2, $s3', ''];
    const ls = before.map((t, i) => mono(tag(t.padEnd(20), '', -3, 4.8 - i * 0.8), 11));
    await beat(tok, 2400);
    const slot = cube('slot', '#d8cfc0', [3.2, 0.5, 0.6], 2.6, 4.8 - 2 * 0.8, 0);
    say('從分支前面找一個不相關的指令', 'add 不影響 beq 的 $s2');
    glow(slot, GOLD);
    await beat(tok, 2400);
    ls.forEach((l, i) => txt(l, after[i].padEnd(20)));
    relabel(slot, 'add 填進來');
    tint(slot, '#2fc092');
    say('add 搬到 delay slot：不管跳不跳都有用', '沒有適合的就填 nop');
    await beat(tok, 3000);
    say('現代深 pipeline、多發射：delay slot 不夠用', '改用 dynamic prediction');
    await beat(tok, 2800);
  }
  async function scForwardUnit(tok) {
    fresh([0, 3.6, 13.5], [0, 3.0, 0]);
    fu.a = 'sub $2, $1, $3'; fu.b = 'and $12, $2, $5'; fu.c = 'or $13, $6, $2';
    say('Forwarding unit 看 pipeline register', '比對 Rd 和現在的 Rs、Rt');
    await beat(tok, 2200);
    await drawFwd(tok, 0, true);
    await beat(tok, 3000);
    fu.a = 'add $4, $5, $6'; fu.b = 'sub $2, $1, $3'; fu.c = 'and $12, $2, $5';
    await drawFwd(tok, 0, true);
    await beat(tok, 3000);
    fu.a = 'add $1, $1, $2'; fu.b = 'add $1, $1, $3'; fu.c = 'add $1, $1, $4';
    await drawFwd(tok, 0, false);
    say('課本：double data hazard', 'EX/MEM、MEM/WB 都有 $1 → 選最新的 EX/MEM');
    await beat(tok, 3200);
    fu.a = 'add $4, $5, $6'; fu.b = 'lw $2, 20($1)'; fu.c = 'and $12, $2, $5';
    await drawFwd(tok, 0, false);
    say('lw 在 EX/MEM：資料還沒讀出來', 'hazard detection unit 先 stall 一個 cycle');
    await beat(tok, 3200);
  }
  async function scCpi(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    Object.assign(cpiS, { ld: 25, use: 50, st: 10, br: 11, mis: 25, bpen: 1, jp: 2, jpen: 1 });
    say('課本例：25% lw、10% sw、11% branch、2% jump、52% ALU', 'CPI = 1 + 平均 stall');
    await beat(tok, 2800);
    const c = await drawCPI(tok, 700, true);
    say('lw：一半有 load-use → CPI 1.5', 'branch：1/4 猜錯、penalty 1 → 1.25；jump → 2');
    await beat(tok, 3200);
    say('CPI = 0.25×1.5 + 0.10×1 + 0.52×1 + 0.11×1.25 + 0.02×2', '= ' + (+c.toFixed(2)));
    await beat(tok, 3400);
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const R_ = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function uniq(ans, wrong) { const o = [ans]; for (const w of wrong) if (!o.includes(w) && o.length < 4) o.push(w); let k = 1; while (o.length < 4) o.push(ans + '（' + k++ + '）'); return o; }
  function genQ() {
    const t = R_(0, 8);
    if (t <= 2) {
      // random 3–5 instruction snippet, count total cycles
      const regs = ['$1', '$2', '$3', '$4', '$5'];
      const n = R_(3, 5); const src = [];
      for (let i = 0; i < n; i++) {
        const d = pickOne(regs), a = pickOne(regs), b = pickOne(regs);
        src.push(Math.random() < 0.35 ? 'lw ' + d + ', ' + 4 * R_(0, 9) + '(' + a + ')' : pickOne(['add', 'sub', 'and', 'or']) + ' ' + d + ', ' + a + ', ' + b);
      }
      const fwd = t !== 2;
      const S = schedule(src.map((x) => parseIns(x)), { fwd, br: 'pnt', mem1: false });
      const ans = S.total + ' cycles';
      const S2 = schedule(src.map((x) => parseIns(x)), { fwd: !fwd, br: 'pnt', mem1: false });
      return { q: '五級 pipeline，' + (fwd ? '有' : '沒有') + ' forwarding（register file 前半寫後半讀），執行下面程式共要幾個 cycles？\n' + src.join('\n'), opts: uniq(ans, [(n + 4) + ' cycles', S2.total + ' cycles', (S.total + 1) + ' cycles', (5 * n) + ' cycles']), ans, why: '理想 ' + n + ' + 4 = ' + (n + 4) + '，再加 ' + S.stalls + ' 個 stall。' + (fwd ? 'forwarding 下只有 load-use 要 stall 1 cycle。' : '沒有 forwarding：要等 producer 的 WB（同一 cycle 前半寫後半讀）。') };
    }
    if (t === 3) {
      const ld = R_(15, 30), use = pickOne([20, 40, 50]), br = R_(10, 20), mis = pickOne([10, 20, 25, 40]), pen = pickOne([1, 2, 3]);
      const cpi = 1 + ld / 100 * use / 100 + br / 100 * mis / 100 * pen;
      const ans = String(+cpi.toFixed(3));
      return { q: 'load 占 ' + ld + '%（其中 ' + use + '% 有 load-use，stall 1），branch 占 ' + br + '%（猜錯率 ' + mis + '%，penalty ' + pen + '），其他無 stall。CPI = ?', opts: uniq(ans, [String(+(1 + ld / 100 + br / 100 * pen).toFixed(3)), String(+(1 + ld / 100 * use / 100).toFixed(3)), String(+(1 + br / 100 * mis / 100 * pen).toFixed(3))]), ans, why: 'CPI = 1 + ' + ld / 100 + '×' + use / 100 + ' + ' + br / 100 + '×' + mis / 100 + '×' + pen + ' = ' + ans + '。' };
    }
    if (t === 4) {
      const k = R_(3, 12), n = R_(2, 4);
      const outs = ('T'.repeat(k - 1) + 'N').repeat(n).split('');
      const which = pickOne(['1bit', '2bit']);
      const R = predictRun(which, outs);
      const wrong = R.filter((r) => !r.ok).length;
      const ans = wrong + ' 次';
      return { q: '迴圈分支結果是「' + 'T'.repeat(k - 1) + 'N」重複 ' + n + ' 次，' + (which === '1bit' ? '1-bit predictor（初值 taken）' : '2-bit predictor（初值強 taken）') + '共猜錯幾次？', opts: uniq(ans, [n + ' 次', 2 * n + ' 次', (2 * n - 1) + ' 次', '0 次']), ans, why: which === '1bit' ? '1-bit：每趟出口錯一次，下一趟第一次又錯（第一趟開頭初值是 T 所以不錯）→ 2n − 1 = ' + (2 * n - 1) + '。' : '2-bit：只有出口那次錯，錯一次只降到弱 taken，下次仍猜 T → ' + n + ' 次。' };
    }
    if (t === 5) {
      const q = pickOne([
        ['哪一種 hazard 用 forwarding 也無法完全消除？', 'load-use data hazard', ['R-type 接 R-type 的 data hazard', 'structural hazard（分開 I/D memory 後）', 'sw 接 lw'], 'lw 的資料 MEM 結束才有，下一個指令 EX 已開始，必須 stall 1 cycle。'],
        ['Forwarding unit 判斷 EX hazard 的條件不包括？', 'ID/EX.MemRead = 1', ['EX/MEM.RegWrite = 1', 'EX/MEM.Rd ≠ 0', 'EX/MEM.Rd = ID/EX.Rs'], 'MemRead 是 hazard detection unit（load-use）在看的。'],
        ['EX/MEM 與 MEM/WB 都要寫同一個暫存器且都被用到，forward 誰？', 'EX/MEM（比較新）', ['MEM/WB', '兩個都不行，要 stall', '看哪個是 lw'], 'double data hazard：要用最新的值。'],
        ['MIPS pipeline 為什麼沒有 structural hazard？', '指令與資料記憶體分開、每段資源只用一次', ['因為有 forwarding', '因為分支在 ID 決定', '因為用 delayed branch'], '設計 ISA 時就讓每個指令在固定階段用固定資源。'],
        ['predict not taken 而分支其實成立，要做什麼？', 'flush 已經抓進來的指令', ['stall 到 WB', '把分支改成 nop', '什麼都不用做'], 'IF.Flush 把 IF/ID 清成 nop，再從目標位址抓。'],
        ['五級 pipeline 理想 speedup 為何通常小於 5？', '各階段延遲不平衡、還有 hazard 與 pipeline register 負擔', ['因為 CPI 變大很多', '因為指令變多', '因為 clock 變慢'], 'clock 要配合最慢的那段。'],
      ]);
      return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: q[3] };
    }
    if (t === 6) {
      const lat = [R_(2, 4) * 50, R_(1, 3) * 50, R_(2, 4) * 50, R_(2, 5) * 50, R_(1, 3) * 50];
      const n = pickOne([3, 5, 10, 100]);
      const sum = lat.reduce((a, b) => a + b, 0), mx = Math.max(...lat);
      const ans = (n + 4) * mx + ' ps';
      return { q: '五段延遲 ' + lat.join('、') + ' ps，' + n + ' 個指令在 pipeline（無 hazard）上要多久？', opts: uniq(ans, [n * sum + ' ps', (n + 4) * sum / 5 + ' ps', n * mx + ' ps']), ans, why: 'clock = 最慢的段 ' + mx + ' ps；共 n + 4 = ' + (n + 4) + ' 個 cycles。單週期則要 ' + n + ' × ' + sum + ' = ' + n * sum + ' ps。' };
    }
    if (t === 7) {
      const q = pickOne([
        ['lw $2, 20($1) 後面緊接 and $4, $2, $5（有 forwarding），要 stall 幾個 cycle？', '1', ['0', '2', '3'], 'load-use：stall 1，再從 MEM/WB forward。'],
        ['sub $2, $1, $3 後面緊接 and $12, $2, $5，沒有 forwarding 要 stall 幾個 cycle？', '2', ['0', '1', '3'], 'sub 在 cycle 5 WB，and 的 ID 要等到 cycle 5（前半寫後半讀），原本在 cycle 3 → stall 2。'],
        ['sub $2, $1, $3 後面緊接 and $12, $2, $5，有 forwarding 要 stall 幾個 cycle？', '0', ['1', '2', '3'], 'EX/MEM → ALU 直接 forward。'],
        ['分支在 ID 決定、predict not taken，分支成立的 penalty 是幾個 cycle？', '1', ['0', '2', '3'], '只多抓了一個指令，要 flush 一個。'],
        ['分支在 MEM 才決定（未優化），猜錯的 penalty 是幾個 cycle？', '3', ['1', '2', '4'], 'IF、ID、EX 三個已抓進的指令都要 flush。'],
      ]);
      return { q: q[0], opts: uniq(q[1], q[2]), ans: q[1], why: q[3] };
    }
    const q = pickOne([
      ['把 lw 往前挪、避開 load-use，屬於哪種技巧？', 'compiler 指令重排（scheduling）', ['forwarding', 'branch prediction', 'delayed branch'], '課本例：a = b + e; c = b + f 從 13 cycles 變 11 cycles。'],
      ['delay slot 裡的指令？', '不論分支成不成立都會執行', ['只有成立才執行', '只有不成立才執行', '永遠被 flush'], 'compiler 要找不影響分支結果的指令填進去，找不到就 nop。'],
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
    'laundry': { title: '課本：洗衣服的 pipeline（8 → 3.5 小時）', play: scLaundry },
    'five-stages': { title: '課本：五個階段與 pipeline register', play: scFive },
    'pipe-speedup': { title: '課本：單週期 800 ps vs pipeline 200 ps', play: scSpeedup },
    'structural-hazard': { title: 'Structural hazard：單一記憶體', play: scStruct },
    'data-hazard': { title: '課本：sub $2 的 data hazard（無 forwarding）', play: scData },
    'forwarding': { title: '課本：forwarding 消除 stall', play: scFwd },
    'forward-unit': { title: '課本：forwarding unit 與 double data hazard', play: scForwardUnit },
    'load-use': { title: '課本：load-use 必須 stall 1 cycle', play: scLoadUse },
    'reorder-code': { title: '課本：重排指令 13 → 11 cycles', play: scReorder },
    'lw-sw': { title: 'lw 後接 sw：不必 stall', play: scLwSw },
    'control-hazard': { title: '課本：beq 的 stall 與 predict not taken / flush', play: scControl },
    'branch-predict': { title: '課本：1-bit vs 2-bit branch predictor', play: scPredict },
    'delayed-branch': { title: '課本：delayed branch 與 delay slot', play: scDelayed },
    'cpi-stalls': { title: '課本：CPI = 1 + stalls（1.17）', play: scCpi },
  };

  return {
    kicker: '計算機組織・第 4 章',
    title: 'Pipeline 與 Hazard',
    color: 'var(--ca)',
    modes: [
      { id: 'pipe', name: 'Pipeline 時序圖', enter: enterPipe },
      { id: 'fwd', name: 'Forwarding unit', enter: enterFwd },
      { id: 'predict', name: 'Branch prediction', enter: enterPredict },
      { id: 'cpi', name: 'CPI 與 stall', enter: enterCPI },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['laundry', 'five-stages', 'pipe-speedup', 'structural-hazard', 'data-hazard', 'forwarding', 'forward-unit', 'load-use', 'reorder-code', 'lw-sw',
      'control-hazard', 'branch-predict', 'delayed-branch', 'cpi-stalls'],
    stop() { run++; },
  };
}
