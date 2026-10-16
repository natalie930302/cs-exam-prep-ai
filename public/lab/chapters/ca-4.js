// 計算機組織 第4章：Pipeline（五級管線、structural / data / control hazard、forwarding、load-use stall、
// branch prediction、delayed branch、CPI with stalls）。
// 本章影片（黃婷婷 17B–21B、Pipeline Hazards）目前都沒有逐字稿，場景依 Patterson & Hennessy 第 4 章的圖與例題。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';

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
    // the instruction walks just under the units, so it never hides their names
    const tk = cube('lw', '#c08a1f', [0.9, 0.5, 0.5], xs[0] - 1.6, 1.45, 0.7);
    for (let i = 0; i < 5; i++) {
      move(tk, xs[i], 1.45, 0.7);
      say(caps[i][0], caps[i][1]);
      await beat(tok, 2000);
    }
    say('右到左的資料流：WB 寫回、分支改 PC', '這兩條就是 hazard 的來源');
    await beat(tok, 3000);
  }
  async function scSpeedup(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    say('例：IF 200、ID 100、EX 200、MEM 200、WB 100 ps', '三個 lw');
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
  const scData = pipeScene('dep', { fwd: false, br: 'pnt', mem1: false }, ['例：sub $2 之後一串都用 $2', '沒有 forwarding'],
    [['$2 要到 cycle 5 的 WB 才寫回', 'and 得等，後面的指令也跟著停'], ['register file：前半寫、後半讀', 'and 停到 cycle 5 的 ID 就讀得到新的 $2'], ['沒有 forwarding：多了 2 個 stall', '']]);
  const scFwd = pipeScene('dep', { fwd: true, br: 'pnt', mem1: false }, ['同一段程式，加上 forwarding', 'ALU 結果在 EX 結束就有了'],
    [['and 從 EX/MEM 拿 $2；or 從 MEM/WB 拿', '金色箭頭：往右（時間往後）才合法'], ['完全不用 stall', 'CPI 回到 1']]);
  const scLoadUse = pipeScene('load', { fwd: true, br: 'pnt', mem1: false }, ['例：lw $2 之後馬上用 $2', 'load-use data hazard'],
    [['lw 的資料要 MEM 結束才有', 'and 的 EX 已經開始了 → 來不及'], ['hazard detection unit：stall 1 cycle（bubble）', '條件：ID/EX.MemRead 且 ID/EX.Rt = IF/ID.Rs 或 Rt'], ['stall 之後再從 MEM/WB forward', 'forwarding 救不了 load-use，只能少 stall']]);
  async function scReorder(tok) {
    fresh([0.6, 3.6, 13.2], [0.6, 3.6, 0]);
    const opt = { fwd: true, br: 'pnt', mem1: false };
    say('例：a = b + e; c = b + f;', '有 forwarding，照 C 的順序編譯');
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
    say('Control hazard：beq 要到 ID 才知道跳不跳', '例：40 beq $1, $3, 7（成立）');
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
    say('例：25% lw、10% sw、11% branch、2% jump、52% ALU', 'CPI = 1 + 平均 stall');
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
      ['把 lw 往前挪、避開 load-use，屬於哪種技巧？', 'compiler 指令重排（scheduling）', ['forwarding', 'branch prediction', 'delayed branch'], '例：a = b + e; c = b + f 從 13 cycles 變 11 cycles。'],
      ['delay slot 裡的指令？', '不論分支成不成立都會執行', ['只有成立才執行', '只有不成立才執行', '永遠被 flush'], 'compiler 要找不影響分支結果的指令填進去，找不到就 nop。'],
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ ppA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { ghostBox, tint, relabel } = P;
// labels never wrap by default (nowrap): long notes get explicit line breaks at punctuation (~34 字寬)
const WD = (ch) => (ch.charCodeAt(0) < 256 ? 0.55 : 1);
function brk(t, max = 36) {
  t = String(t); let tot = 0; for (const c of t) tot += WD(c); if (tot <= max + 4) return t;
  const out = []; let line = '', len = 0;
  for (const c of t) { line += c; len += WD(c); if ((len >= max && /[，；：、。）)→]/.test(c)) || (len >= max + 6 && c === ' ') || len >= max + 10) { out.push(line.trim()); line = ''; len = 0; } }
  if (line.trim()) out.push(line.trim()); return out.join('\n');
}
const wrapL = (l) => { if (l.element.textContent.includes('\n')) Object.assign(l.element.style, { whiteSpace: 'pre-line', textAlign: 'center', fontSize: '11.5px', lineHeight: '1.3' }); return l; };
const txt = (l, t) => { l.element.textContent = brk(t); wrapL(l); };
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 4 章（清大 黃婷婷 第17B、18A、19A、19B講 Pipelining）— cued scenes ───
// 每個 scene = 一串 step 函式；影片講到那一句（notes 的 cue）才執行下一個。
// 時序圖的每一格、總 cycle 數、forwarding 的 ForwardA/B、hazard detection 的條件、flush 的 penalty、
// branch predictor 猜錯的次數，全部由程式計算（重用本章的 schedule()、fwdLogic()、predictRun()），
// 再和老師口述的結果比對，畫面上顯示 ✓／✘。老師沒有講出的運算元（例如 lw $10, 20($1)）取自
// Patterson & Hennessy 課本同一張圖，畫面標「課本」；自己加的說明圖標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => wrapL(tag(brk(t), 'ptr', x, y, z));
const hot = (t, x, y, z = 0) => wrapL(tag(brk(t), 'ptr alt', x, y, z));
const sm = (t, x, y, z = 0) => wrapL(tag(brk(t), 'idx', x, y, z));
const note = (t, x, y, z = 0) => wrapL(tag(brk(t), 'note', x, y, z));
const good = (t, x, y, z = 0) => wrapL(tag(brk(t), 'good', x, y, z));
const bad = (t, x, y, z = 0) => wrapL(tag(brk(t), 'bad', x, y, z));
const bub = (t, x, y, z = 0) => wrapL(tag(brk(t), 'say', x, y, z));
const pl = (t, x, y, z = 0) => wrapL(tag(brk(t), '', x, y, z));
const ok = (b, x, y, t) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const CAM_G = [[0.6, 3.6, 13.2], [0.6, 3.6, 0]];
const CAM_D = [[0, 3.2, 13.5], [0, 2.8, 0]];
const FIVE = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const COL = { IF: '#4b9ee2', ID: '#9b7ef4', EX: '#dd8238', MEM: '#2fc092', WB: '#e55a9b', idle: '#ece5d6', bub: '#cfc6b6', bad: '#e8b4b4', gold: '#c08a1f', reg: '#6e5f49' };
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM_G; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}

// ── 時序圖：列 = 指令，欄 = clock cycle；先登記（add / ins），upto(c) 才把 ≤ c 的格子掉下來 ──
function mkGrid(S, T, o = {}) {
  const w = o.w || Math.min(0.85, 9.0 / T), x0 = o.x0 ?? -2.9, y0 = o.y0 ?? 5.7, dy = o.dy || 0.62, lx = o.lx ?? -5.0;
  const g = { T, w, x0, y0, dy, cells: {}, plan: [], labs: {}, ex: [], bands: [] };
  g.cx = (c) => x0 + (c - 0.5) * w; g.cy = (k) => y0 - k * dy;
  if (o.head !== false) { for (let c = 1; c <= T; c++) g.ex.push(small(tag(String(c), 'idx', g.cx(c), y0 + 0.62), 9)); g.ex.push(small(tag('clock cycle →', 'idx', lx, y0 + 0.62), 9)); }
  g.label = (k, text, cls = '') => { if (g.labs[k]) remove(g.labs[k]); g.labs[k] = mono(tag(text, cls, lx, g.cy(k)), 10); return g.labs[k]; };
  g.cell = (k, c, s, drop = true, shown) => {
    const key = k + ':' + c; if (g.cells[key]) kill(g.cells[key]);
    const col = COL[s] || (s === 'nop' || s === 'bubble' ? COL.bub : s === 'flush' ? COL.bad : COL.idle);
    const m = cube(shown ?? s, col, [w * 0.92, Math.min(0.46, dy * 0.74), 0.5], g.cx(c), g.cy(k), 0, drop ? 0.9 : 0);
    if (m.userData.lbl) small(m.userData.lbl, w < 0.7 ? 8 : 9);
    g.cells[key] = m; return m;
  };
  // list = [[cycle, stage, shownText?], …]
  g.add = (k, text, list) => { g.plan = g.plan.filter((p) => p.k !== k || p.done); g.plan.push(...list.map(([c, s, sh]) => ({ k, c, s, sh, done: false }))); if (text != null) g.label(k, text); };
  g.ins = (k, text, c0, stages = FIVE) => g.add(k, text, stages.map((s, i) => [c0 + i, s]));
  g.upto = (c, rows) => { for (const p of g.plan) if (!p.done && p.c <= c && (!rows || rows.includes(p.k))) { p.done = true; g.cell(p.k, p.c, p.s, true, p.sh); } };
  g.row = (k) => g.upto(99, [k]);
  g.at = (k, c) => g.cells[k + ':' + c];
  g.band = (c, k0, k1, color = '#c08a1f') => { const h = (k1 - k0 + 1) * dy; const b = ghostBox(color, w, h, 0.7); b.position.set(g.cx(c), g.cy(k0) + dy / 2 - h / 2, 0); g.bands.push(b); return b; };
  g.unband = () => { g.bands.forEach(kill); g.bands = []; };
  g.hot = (k, c, color = '#c08a1f') => { const m = g.at(k, c); if (m) glow(m, color); return m; };
  g.cool = () => Object.values(g.cells).forEach((m) => glow(m, null));
  g.dropRow = (k) => { for (const key of Object.keys(g.cells)) if (key.startsWith(k + ':')) { kill(g.cells[key]); delete g.cells[key]; } if (g.labs[k]) { remove(g.labs[k]); delete g.labs[k]; } g.plan = g.plan.filter((p) => p.k !== k); };
  g.rowsArr = () => { const m = {}; g.plan.forEach((p) => (m[p.k] = m[p.k] || []).push([p.c, p.s])); return Object.values(m); };
  g.all = () => [...Object.values(g.cells), ...Object.values(g.labs), ...g.ex, ...g.bands];
  return g;
}
// rows from the chapter's schedule(): stall cycles shown as the stage the instruction is stuck in
function schedRows(S0) { return S0.rows.map((r) => (r.ghost ? { text: r.text, ghost: true, cells: [[r.IF, 'IF']] } : { text: r.text, cells: [[r.IF, 'IF'], ...Array.from({ length: r.ID - r.IF - 1 }, (_, j) => [r.IF + 1 + j, 'stall']), [r.ID, 'ID'], [r.EX, 'EX'], [r.MEM, 'MEM'], [r.WB, 'WB']], r })); }
// structural check: in each cycle, does any stage (resource) appear twice?
function clashes(rows) { const seen = {}, out = []; for (const r of rows) for (const [c, s] of r) { if (!FIVE.includes(s)) continue; const k = c + s; if (seen[k]) out.push([c, s]); seen[k] = 1; } return out; }

// ── 五級 datapath 的方塊圖：IM → Reg → ALU → DM → Reg（寫回），中間四個 pipeline register ──
function mkDP(S, o = {}) {
  const y = o.y ?? 2.0, xs = [-5.6, -2.8, 0, 2.8, 5.6];
  const units = o.units || ['Instr Mem', 'Reg 讀', 'ALU', 'Data Mem', 'Reg 寫回'];
  const d = { y, xs, blocks: [], regs: [], chips: [], ex: [], ctlB: {}, rx: (i) => (xs[i] + xs[i + 1]) / 2 };
  FIVE.forEach((s, i) => { const b = cube(units[i], COL[s], [1.7, 0.85, 0.7], xs[i], y); small(b.userData.lbl, 9); d.blocks.push(b); d.ex.push(hd(s, xs[i], y - 0.85)); });
  if (o.regs !== false) ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'].forEach((n, i) => { const r = cube('', COL.reg, [0.24, 1.9, 0.6], d.rx(i), y + 0.1); d.regs.push(r); d.ex.push(small(tag(n, 'idx', d.rx(i), y - 1.2), 9)); });
  // an instruction chip riding above stage i
  d.chip = (t, i, col = COL.gold) => { const m = cube(t, col, [1.55, 0.42, 0.5], xs[i], y + 1.35, 0.3); small(m.userData.lbl, 10); d.chips.push(m); return m; };
  d.go = async (tok, moves, ms = 700) => { const mv = moves.map(([m, i]) => [m, m.position.clone(), V3(i < 0 ? xs[0] - 2.2 : i > 4 ? xs[4] + 2.0 : xs[i], m.position.y, m.position.z)]); await anim(tok, ms, (u) => mv.forEach(([m, a, b]) => m.position.lerpVectors(a, b, u))); };
  d.drop = (m) => { kill(m); d.chips = d.chips.filter((x) => x !== m); };
  // control groups (WB / M / EX) carried in pipeline register i (0 = IF/ID … 3 = MEM/WB)
  d.ctl = (i, groups, vals = {}) => { (d.ctlB[i] || []).forEach(kill); d.ctlB[i] = groups.map((gname, j) => { const m = cube(gname + (vals[gname] ? ' ' + vals[gname] : ''), { WB: '#f2b8d2', M: '#b8ead6', EX: '#f6cfa6' }[gname], [vals[gname] ? 1.1 : 0.6, 0.34, 0.4], d.rx(i), y + 0.65 - j * 0.42, 0.45); small(m.userData.lbl, 9); return m; }); };
  d.noCtl = () => { Object.values(d.ctlB).forEach((a) => a.forEach(kill)); d.ctlB = {}; };
  d.hot = (i, on = true) => glow(d.blocks[i], on ? COL.gold : null);
  d.cool = () => d.blocks.forEach((b) => glow(b, null));
  d.all = () => [...d.blocks, ...d.regs, ...d.chips, ...d.ex, ...Object.values(d.ctlB).flat()];
  return d;
}
const FW = (a, b, c) => fwdLogic(decodeFU(a), decodeFU(b), decodeFU(c));

// ════════ _GDfZbzFVs0（第17B講：五級對齊、pipelined datapath、lw/sub 逐 cycle、pipelined control、hazard 預告） ════════
const R4 = (c0) => [[c0, 'IF'], [c0 + 1, 'ID'], [c0 + 2, 'EX'], [c0 + 3, 'WB']];          // R-type 只走 4 段（會出事的版本）
const R5 = (c0) => [[c0, 'IF'], [c0 + 1, 'ID'], [c0 + 2, 'EX'], [c0 + 3, 'MEM', '空'], [c0 + 4, 'WB']];
const L5 = (c0) => FIVE.map((s, i) => [c0 + i, s]);
const CL_BAD = clashes([L5(1), R4(2)]), CL_FIX = clashes([L5(1), R5(2)]);
scene('ppA-17b-wb', '17B：R-type 提早寫回會和 lw 搶 register file', [
  async (tok, S) => { // @18.2
    S.g = mkGrid(S, 9);
    S.g.add(0, 'lw', L5(1)); S.g.add(1, 'R-type', R4(2)); S.g.row(0); S.g.row(1);
    S.t1 = hd('R-type 不用讀記憶體：EX 完就寫回（只走 4 段）', 0.9, 2.2);
    cap('lw 走 5 個 stage，R-type 只走 4 個', 'R-type 晚 lw 一個 cycle 進來');
  },
  async (tok, S) => { // @21.3
    S.g.band(5, 0, 1, '#d64545'); S.g.hot(0, 5, '#7a1010'); S.g.hot(1, 5, '#7a1010');
    S.t2 = ok(CL_BAD.length === 1 && CL_BAD[0][0] === 5, 0.9, 1.5, 'cycle 5：兩個都要寫 register file → 衝突 ✓');
    cap('lw 第 5 段寫回、R-type 第 4 段寫回', '兩個剛好在 cycle 5 撞在一起');
  },
  async (tok, S) => { // @58.7
    gone(S.t1, S.t2); S.g.unband(); S.g.cool();
    S.r1 = hot('規則一：同一時間，每個 functional unit 只給一個 instruction 用', 0.9, 2.2);
    cap('規則一：一個 functional unit 一次只給一個人用', '不然就「打架」');
  },
  async (tok, S) => { // @76.6
    S.r2 = hot('規則二：每個 resource 都在「同一個 stage」使用', 0.9, 1.5);
    cap('規則二：同一個 resource 一定在同一個 stage 用', '');
  },
  async (tok, S) => { // @83.7
    S.g.band(5, 0, 1, '#d64545');
    S.t3 = note('lw 在第 5 段用、R-type 在第 4 段用 → 晚一個 cycle 剛好撞上', 0.9, 0.8);
    cap('你第 4 段用、我第 5 段用', '又剛好差一個 cycle → 打架');
  },
  async (tok, S) => { // @96.1
    gone(S.t3); S.g.unband(); S.g.hot(0, 5, COL.gold);
    S.t3 = note('write back = 用 register file 的 write port；lw 在第 5 段用它', 0.9, 0.8);
    cap('write back 要用 register file 的 write port', 'lw 是在第 5 個 stage 用');
  },
  async (tok, S) => { // @104.6
    gone(S.t3); S.g.cool();
    S.g.add(1, 'R-type', R5(2)); S.g.dropRow(1); S.g.add(1, 'R-type', R5(2)); S.g.row(1);
    S.g.hot(1, 6, COL.gold);
    S.t3 = note('R-type 也改成第 5 段才寫：第 4 段（MEM）空著', 0.9, 0.8);
    cap('R-type 也在第 5 個 stage 寫', '第 4 段空著不做事');
  },
  async (tok, S) => { // @110.6
    gone(S.r1, S.r2); S.g.cool();
    S.t4 = ok(CL_FIX.length === 0, 0.9, 2.2, '檢查每個 cycle：同一種資源最多一個人用 ✓');
    cap('錯開一個 cycle，就永遠不會打架', 'lw 在 cycle 5 寫、R-type 在 cycle 6 寫');
  },
  async (tok, S) => { // @153.5
    S.a1 = arrow(V3(S.g.cx(1), S.g.cy(0) - 0.3, 0.4), V3(S.g.cx(2), S.g.cy(1) + 0.3, 0.4), 0xc08a1f);
    S.t5 = note('後一個 instruction 一定晚一個 cycle：你用完、下一個 cycle 才輪到我', 0.9, 1.5);
    cap('每個 instruction 都晚一個 cycle 進來', '你用完再給我用');
  },
  async (tok, S) => { // @197.9
    gone(S.t3, S.t4, S.t5);
    S.t6 = bub('比喻：我晚到一步，卻跳過「洗」直接去搶烘衣機 → 跟你搶同一台', 0.9, 0.8);
    cap('就像不洗衣服就直接要烘乾', '跳過一段 = 搶先一步 = conflict');
  },
  async (tok, S) => { // @211.2
    gone(S.t6, S.a1);
    const rows = [L5(1), R5(2), L5(3), L5(4), L5(5)];
    S.g.add(2, '下一個（示意）', L5(3)); S.g.add(3, '再下一個（示意）', L5(4)); S.g.add(4, '再下一個（示意）', L5(5)); S.g.upto(99);
    S.t7 = ok(clashes(rows).length === 0, 0.9, 2.2, '5 個 instruction、每段都用固定的資源：沒有任何衝突 ✓');
    cap('一律晚一個 cycle 進去、同一段用同一個資源', '你永遠在我前面 → 永遠不會打架');
  },
  async (tok, S) => { // @258.4
    gone(S.t7); S.g.hot(1, 5, COL.gold);
    S.t8 = note('R-type 往後一段：MEM 那格空著（不做 memory access），第 5 個 cycle 才寫回', 0.9, 1.0);
    cap('把 R-type 往後挪一個 stage 就好', '本來要做 memory access 的那段空著');
  },
]);

scene('ppA-17b-five', '17B：sw、beq 也排成五段；pipeline 的圖形表示法', [
  async (tok, S) => { // @322.5
    S.g = mkGrid(S, 8);
    S.g.add(0, 'sw', [[1, 'IF'], [2, 'ID'], [3, 'EX'], [4, 'MEM'], [5, 'WB', '（空）']]); S.g.row(0);
    S.t = note('store 只有 4 段：最後補一個「假的」write back', 0.9, 2.0);
    cap('store 只要 4 個 stage', '最後一段放一個假的 write back');
  },
  async (tok, S) => { // @330.2
    S.g.add(1, 'beq', [[2, 'IF'], [3, 'ID'], [4, 'EX'], [5, 'MEM', '（空）'], [6, 'WB', '（空）']]); S.g.row(1);
    txt(S.t, 'beq 只有 3 段（IF、ID、EX）：MEM、WB 都假裝有');
    cap('branch equal 只有 3 個 stage', '沒有 memory access、沒有 write back');
  },
  async (tok, S) => { // @351.6
    S.g.add(2, 'R-type', R5(3)); S.g.add(3, 'lw', L5(4)); S.g.upto(99);
    txt(S.t, '每個 instruction 都走完 IF → ID → EX → MEM → WB 五段');
    S.t2 = ok(clashes(S.g.rowsArr()).length === 0, 0.9, 1.3, '每個 cycle 每段只有一個 instruction ✓');
    cap('pipeline datapath 完成', '每個 instruction 都經過這五個 stage');
  },
  async (tok, S) => { // @369.9
    gone(S.t2); S.g.hot(2, 5, COL.gold); S.g.hot(2, 7, COL.gold);
    txt(S.t, 'R-type：EX 之後其實就能寫，但要跳過 MEM、等到第 5 段才寫');
    cap('R-type 雖然算完就能寫', '還是要等到第 5 個 stage 才寫 register file');
  },
  async (tok, S) => { // @387.1
    gone(S.g, S.t);
    S.g = mkGrid(S, 7);
    const U = ['IM', 'Reg', 'ALU', 'DM', 'Reg'];
    [0, 1, 2].forEach((k) => S.g.add(k, 'instruction ' + (k + 1), FIVE.map((s, i) => [k + 1 + i, s, U[i]])));
    S.g.upto(99);
    S.t = note('圖形表示法：每一列一個 instruction，往右是時間；格子寫的是用到的硬體', 0.9, 2.6);
    cap('把 pipeline 畫出來：第一個在這裡、第二個在這裡', '往右是 clock cycle');
  },
  async (tok, S) => { // @397.9
    S.g.band(3, 0, 2);
    S.t2 = hot('cycle 3：第 1 個在用 ALU、第 2 個在讀 register、第 3 個在抓指令', 0.9, 1.9);
    cap('例如第 3 個 clock cycle', '第一個做 ALU、第二個做 register access');
  },
  async (tok, S) => { // @407.0
    S.t3 = sm('一眼看出：每個 cycle、每個 instruction 在做什麼', 0.9, 1.3);
    cap('這是一種 graphic representation', '可以看出每一個 cycle 做什麼事');
  },
]);

// lw / sub 在 datapath 上一個 cycle 一個 cycle 走（課本的兩個指令）
const LS = schedule(['lw $10, 20($1)', 'sub $11, $2, $3'].map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
scene('ppA-17b-lwsub', '17B：lw 與 sub 一個 cycle 一個 cycle 走過 datapath', [
  async (tok, S) => { // @414.1
    S.d = mkDP(S);
    S.c = code(['lw  $10, 20($1)', 'sub $11, $2, $3'], -1.2, 6.5, 0.5);
    S.k = sm('（運算元是課本的例子）', 3.2, 6.5);
    S.cy = hot('', 4.6, 5.6);
    cap('用兩個 instruction 看它怎麼跑', 'lw 後面接 sub');
  },
  async (tok, S) => { // @423.1
    txt(S.cy, 'cycle 1'); S.c.hl(0);
    S.lw = S.d.chip('lw', 0); S.d.hot(0);
    cap('cycle 1：lw 做 instruction fetch', '用 PC 到 instruction memory 抓指令');
  },
  async (tok, S) => { // @428.2
    txt(S.cy, 'cycle 2'); S.d.cool();
    await S.d.go(tok, [[S.lw, 1]]);
    S.sub = S.d.chip('sub', 0, '#4b9ee2'); S.d.hot(0); S.d.hot(1);
    cap('cycle 2：lw 讀 register（decode）', 'IF 空出來了 → sub 進來做 fetch');
  },
  async (tok, S) => { // @445.5
    S.n1 = note('同一個 cycle：lw 在用 Reg、sub 在用 IM，各用各的硬體', 0, 4.9);
    cap('注意：這兩個是分開的', '各自用不同的資源');
  },
  async (tok, S) => { // @485.0
    gone(S.n1); glow(S.d.regs[0], COL.gold);
    S.n1 = note('lw 的指令放在 IF/ID 這個 pipeline register 裡', S.d.rx(0), 4.9);
    cap('cycle 2 時，lw 的指令在哪裡？', '在 pipeline register（IF/ID）裡面');
  },
  async (tok, S) => { // @491.0
    txt(S.n1, 'clock cycle 結束的那一下：新內容「啪」寫進去，舊的被蓋掉');
    S.d.regs.forEach((r) => glow(r, COL.gold));
    cap('什麼時候寫進去？end of clock cycle', '新的寫進去，舊的已經用完就蓋掉');
  },
  async (tok, S) => { // @509.7
    gone(S.n1); S.d.regs.forEach((r) => glow(r, null)); S.d.cool(); txt(S.cy, 'cycle 3');
    await S.d.go(tok, [[S.lw, 2], [S.sub, 1]]); S.d.hot(2); S.d.hot(1);
    S.n1 = note('lw：ALU 算位址 $1 + 20（sign-extend 的 20）', 0, 4.9);
    S.n2 = note('sub：讀出 rs、rt（$2、$3）', -2.8, 0.2);
    cap('cycle 3：lw 在 ALU 算 memory 位址', 'sub 去做 register access');
  },
  async (tok, S) => { // @543.4
    gone(S.n1, S.n2); S.d.cool(); txt(S.cy, 'cycle 4');
    await S.d.go(tok, [[S.lw, 3], [S.sub, 2]]); S.d.hot(3); S.d.hot(2);
    S.n1 = note('lw：讀 data memory', 2.8, 4.9); S.n2 = note('sub：ALU 做 $2 − $3', 0, 0.2);
    cap('cycle 4：lw 讀 memory', 'sub 在 ALU 做減法');
  },
  async (tok, S) => { // @563.5
    gone(S.n1, S.n2); S.d.cool(); txt(S.cy, 'cycle 5');
    await S.d.go(tok, [[S.lw, 4], [S.sub, 3]]); S.d.hot(4);
    S.n1 = note('lw：寫回 $10（第 5 段）', 5.0, 4.9);
    cap('cycle 5：lw 做 write back', '把讀到的資料寫回 $10');
  },
  async (tok, S) => { // @576.1
    S.n2 = bub('sub 的結果其實 cycle 4（它的 EX）就算好了，可不可以現在就寫？', 1.4, 0.2);
    cap('sub 的 data 早就算完了', '理論上下一個 cycle 就能寫回……');
  },
  async (tok, S) => { // @598.2
    txt(S.n2, '不行：要在同一個 stage（第 5 段）才寫 → sub 在 MEM 這段什麼都不做');
    glow(S.d.blocks[3], '#555555');
    cap('不可以：要在第 5 個 stage 才寫', '所以 sub 在第 4 段不做任何事');
  },
  async (tok, S) => { // @610.2
    gone(S.n1, S.n2); S.d.cool(); txt(S.cy, 'cycle 6');
    S.d.drop(S.lw); await S.d.go(tok, [[S.sub, 4]]); S.d.hot(4);
    S.n1 = note('sub：第 5 段才寫回 $11，用 register file 的 write port', 5.0, 4.9);
    S.n2 = ok(LS.total === 6 && LS.stalls === 0, 0.6, 0.2, '兩個 instruction：2 + 4 = 6 個 cycle 跑完 ✓');
    cap('cycle 6：sub 才寫回', '這時候才輪到它用 register 的 write port');
  },
], { cam: CAM_D });

scene('ppA-17b-quiz', '17B：小問答：R-type 什麼時候寫回？', [
  async (tok, S) => { // @639.5
    S.g = mkGrid(S, 8);
    S.g.add(0, 'lw', L5(1)); S.g.add(1, 'R-type', R5(2)); S.g.upto(99); S.g.hot(1, 6, COL.gold);
    S.t = hot('問：R-type 的 write back 在第幾段？答：第 5 段，要和 lw 一致', 0.9, 2.2);
    cap('R-type 的 write back 什麼時候寫？', '第五個 stage，跟 lw 一致');
  },
  async (tok, S) => { // @651.1
    S.t2 = note('所有的 instruction：同一個 stage 做同一種事', 0.9, 1.5);
    cap('所有的 instruction', '都要在同一個 stage 做相同的事情');
  },
  async (tok, S) => { // @663.4
    gone(S.t2); S.g.cool(); S.g.dropRow(1); S.g.add(1, 'R-type（第 4 段寫）', R4(2)); S.g.row(1);
    S.g.band(5, 0, 1, '#d64545');
    S.t2 = note('如果 R-type 在第 4 段寫，又緊接在 lw 後面……', 0.9, 1.5);
    cap('如果 R-type 在第 4 個 stage 寫', '又剛好緊接在 lw 後面？');
  },
  async (tok, S) => { // @674.7
    S.t3 = ok(clashes(S.g.rowsArr()).length === 1, 0.9, 0.8, '兩個人搶同一個 write port → structural hazard ✓');
    cap('兩個要競爭同一個 write port', '就產生 structural hazard');
  },
  async (tok, S) => { // @713.7
    gone(S.t, S.t2, S.t3);
    S.t = hot('structural hazard：兩個 instruction 同時搶同一個硬體', 0.9, 2.2);
    cap('什麼叫 structural hazard？', '就是兩個同時搶一個資源');
  },
  async (tok, S) => { // @720.5
    S.g.unband(); S.g.dropRow(1); S.g.add(1, 'R-type', R5(2)); S.g.row(1);
    S.t2 = ok(clashes(S.g.rowsArr()).length === 0, 0.9, 1.5, '往後挪一段、不要搶先 → 沒有衝突 ✓');
    cap('怎麼避免？往後挪一個', '不要那麼快、不要搶先');
  },
  async (tok, S) => { // @735.5
    gone(S.t2);
    S.t2 = note('一般原則：① 每個 resource 一次只給一個 instruction 用', 0.9, 1.5);
    S.t3 = note('② 要用那個 resource，一定在相同的 stage 用', 0.9, 0.9);
    cap('一般的原則', '每個 resource 一次給一個人；而且在相同 stage 用');
  },
  async (tok, S) => { // @763.7
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 6, COL.gold);
    S.t4 = good('register file 的 write port：一律在第 5 段用', 0.9, 0.3);
    cap('要用 write port', '就一定在第五個 stage 用');
  },
]);

// ── 17B 下半：pipelined control、destination register、五個指令跑一遍、總結、hazard 預告 ──
// 課本的 control 值：lw → EX 0001（RegDst 0、ALUOp 00、ALUSrc 1）、M 010（MemRead）、WB 11（RegWrite、MemtoReg）
//                  R-type → EX 1100、M 000、WB 10（老師口述的「11」「10」「010」對得上）
const CV = { lw: { EX: '0001', M: '010', WB: '11' }, R: { EX: '1100', M: '000', WB: '10' } };
function ctrlBox(S, x = -2.8, y = 5.0) {
  S.cb = cube('Control', '#8a7a5c', [1.6, 0.6, 0.6], x, y, 0); small(S.cb.userData.lbl, 10);
  S.cbl = sm('opcode →', x - 1.7, y);
  return S.cb;
}
scene('ppA-17b-ctl', '17B：pipelined control：signal 一樣，只是用的時間不一樣', [
  async (tok, S) => { // @777.7
    S.d = mkDP(S); ctrlBox(S);
    cap('datapath 講完了，再來看 control', '');
  },
  async (tok, S) => { // @785.6
    S.t = note('single cycle：controller 看 opcode，一次發出所有 control signal', 0.8, 6.3);
    S.sig = code(['RegDst  ALUSrc  ALUOp', 'MemRead MemWrite Branch', 'RegWrite MemtoReg'], 3.8, 5.3, 0.42);
    glow(S.cb, COL.gold);
    cap('single cycle 時：opcode decode 完', '就知道所有的 control signal');
  },
  async (tok, S) => { // @804.6
    S.t2 = sm('例如：要不要寫 register？ALU 做什麼？寫回的資料來自 memory 還是 ALU？', 0, -0.2);
    cap('control signal 管什麼？', '要不要 write、ALU 做什麼、寫回的資料從哪來');
  },
  async (tok, S) => { // @835.7
    gone(S.t2); glow(S.cb, null);
    S.t2 = hot('pipeline 時：哪裡一樣？哪裡不一樣？', 0, -0.2);
    cap('那 pipeline 要怎麼做？', '跟 single cycle 比，哪裡一樣、哪裡不一樣');
  },
  async (tok, S) => { // @888.9
    txt(S.t2, 'R-type 在 EX：ALUSrc = 0（第二個運算元來自 rt）—— 和 single cycle 一樣');
    S.d.hot(2);
    cap('R-type 在 EX 要做 ALU 運算', '第二個 operand 從 rt 來：和 single cycle 一樣');
  },
  async (tok, S) => { // @920.8
    S.d.cool(); S.d.hot(4);
    txt(S.t2, 'R-type 在 WB：MemtoReg = 0（寫回 ALU 的結果）—— 也一樣');
    cap('寫回的資料從哪來？', '選 0：ALU 算出來的 —— 也一樣');
  },
  async (tok, S) => { // @935.1
    S.d.cool();
    txt(S.t2, '不一樣的只有「什麼時候用」：EX 的在 cycle 3、M 的在 cycle 4、WB 的在 cycle 5');
    [2, 3, 4].forEach((i) => S.d.hot(i));
    cap('control signal 其實一樣', '只是用的時間不一樣');
  },
  async (tok, S) => { // @962.3
    S.d.cool();
    txt(S.t2, '辦法：把 control signal 依照「在哪一段用」分組（grouping）');
    cap('那怎麼辦？', '把 control signal 做 grouping');
  },
  async (tok, S) => { // @975.9
    txt(S.t, '怎麼產生？和 single cycle 一樣：opcode 查同一張 truth table');
    glow(S.cb, COL.gold);
    cap('decode 的方法跟以前一樣', 'opcode 查 truth table，0 或 1 照設');
  },
  async (tok, S) => { // @1020.3
    glow(S.cb, null); S.d.hot(0);
    txt(S.t2, '問：control signal 什麼時候產生？在第 1 段（IF）知道嗎？不知道');
    cap('control signal 什麼時候產生？', '第一個 stage 知道嗎？不知道');
  },
  async (tok, S) => { // @1058.0
    S.d.cool(); S.d.hot(1); glow(S.cb, COL.gold);
    txt(S.t2, '第 2 段（ID）decode 完就全部知道了 —— 但要到後面幾段才用');
    cap('第二個 stage 結束時就知道了', '可是要到後面的 stage 才用');
  },
  async (tok, S) => { // @1110.4
    S.d.cool(); gone(S.sig);
    S.d.ctl(1, ['WB', 'M', 'EX']);
    S.g1 = sm('EX 組 → EX 段用', 1.6, 5.2); S.g2 = sm('M 組 → MEM 段用', 1.6, 4.7); S.g3 = sm('WB 組 → WB 段用', 1.6, 4.2);
    txt(S.t2, '切成三塊：EX 組、M 組、WB 組');
    cap('grouping：切成三塊', '一塊負責 EX、一塊 MEM、一塊 WB');
  },
  async (tok, S) => { // @1142.5
    txt(S.t2, '還沒用到的組：放在 pipeline register 裡，跟著往下傳');
    cap('還沒用到的怎麼辦？', '擺著不要動，繼續往下傳');
  },
  async (tok, S) => { // @1199.1
    gone(S.g1, S.g2, S.g3);
    S.ins = S.d.chip('instr', 1);
    await S.d.go(tok, [[S.ins, 2]], 500); S.d.ctl(1, ['WB', 'M', 'EX']); glow(S.d.ctlB[1][2], COL.gold);
    await wt(tok, 500);
    await S.d.go(tok, [[S.ins, 3]], 500); S.d.noCtl(); S.d.ctl(2, ['WB', 'M']); glow(S.d.ctlB[2][1], COL.gold);
    await wt(tok, 500);
    await S.d.go(tok, [[S.ins, 4]], 500); S.d.noCtl(); S.d.ctl(3, ['WB']); glow(S.d.ctlB[3][0], COL.gold);
    txt(S.t2, '第 2 段 decode 完 → 存進 ID/EX；EX 用掉 EX 組、MEM 用掉 M 組、WB 用掉最後一組');
    cap('第 2 段 decode 完，存在 pipeline register', '下一段用 EX 組，再用 M 組，最後用 WB 組');
  },
], { cam: CAM_D });

scene('ppA-17b-dst', '17B：要寫哪個 register？destination 也要跟著傳', [
  async (tok, S) => { // @1271.9
    S.d = mkDP(S); ctrlBox(S);
    S.d.ctl(1, ['WB', 'M', 'EX']); S.d.ctl(2, ['WB', 'M']); S.d.ctl(3, ['WB']);
    S.t = note('pipelined control：用掉的組就不再往下傳', 0.8, 6.3);
    cap('control 的樣子：main control 分組', '用掉就不再傳，沒用到繼續往下傳');
  },
  async (tok, S) => { // @1293.6
    S.d.hot(4);
    S.t2 = hot('write back 的時候：要寫到哪一個 register？', 0, -0.2);
    cap('write back 時要寫到哪一個 register？', '');
  },
  async (tok, S) => { // @1306.6
    txt(S.t2, 'R-type 寫到 rd；lw 寫到 rt');
    cap('R-type 寫回 rd', 'lw 寫回 rt');
  },
  async (tok, S) => { // @1327.4
    S.d.cool();
    S.old = S.d.chip('add $5, …', 4); S.nw = S.d.chip('or … ', 1, '#4b9ee2');
    txt(S.t2, '不只 control signal，destination（要寫哪裡）也要往下傳');
    cap('不只 control signal', 'destination 也要往下傳');
  },
  async (tok, S) => { // @1335.3
    glow(S.d.regs[0], '#7a1010');
    S.t3 = bad('IF/ID 裡的 rs、rt、rd 是「新進來的」instruction 的！', -2.8, 4.9);
    cap('IF/ID 裡的 register 號碼', '是新的 instruction 的，不是要寫回的那個');
  },
  async (tok, S) => { // @1378.1
    S.d.hot(4);
    txt(S.t2, 'R-type、lw 都在第 5 段才寫回：寫的時候要告訴 register file「寫到哪」');
    cap('R-type、lw 都在第五個 stage 寫回', '寫的時候要告訴它寫去哪裡');
  },
  async (tok, S) => { // @1420.3
    txt(S.t3, '要用的是「正在寫回的這個」instruction 的 rd（示意：$5），不是 IF/ID 那個');
    cap('要用正在寫回的這個 instruction 的 rd', '因為是它要寫回去');
  },
  async (tok, S) => { // @1441.4
    glow(S.d.regs[0], null); S.d.cool(); gone(S.t3, S.old, S.nw);
    S.ins = S.d.chip('add $5, …', 1); S.rd = cube('rd = $5', '#f3d36b', [0.9, 0.3, 0.4], S.d.rx(0), S.d.y - 0.68, 0.45); small(S.rd.userData.lbl, 9);
    for (let i = 2; i <= 4; i++) {
      await S.d.go(tok, [[S.ins, i]], 450);
      await anim(tok, 300, (u) => { S.rd.position.x = S.d.rx(i - 2) + (S.d.rx(i - 1) - S.d.rx(i - 2)) * u; });
    }
    txt(S.t2, 'rd 雖然現在用不到，也跟著 instruction 一路在 pipeline register 裡傳到第 5 段');
    cap('現在用不到，也要帶著跑', '在 pipeline register 一路跟過來');
  },
  async (tok, S) => { // @1462.7
    S.d.hot(4); glow(S.rd, COL.gold);
    txt(S.t2, 'WB 段：拿跟著跑過來的 rd 當 write register 位址');
    cap('到了 write back stage', '用跟過來的 destination 寫回');
  },
], { cam: CAM_D });

scene('ppA-17b-regdst', '17B：RegDst 的 mux：只帶一個 destination 往下傳', [
  async (tok, S) => { // @1465.1
    S.d = mkDP(S);
    S.t = note('lw 寫回的 register：仍然來自它自己原本的 instruction', 0.8, 6.3);
    cap('lw 寫回哪裡？', '還是來自它原來的 instruction');
  },
  async (tok, S) => { // @1488.6
    S.mx = cube('mux', '#8a7a5c', [0.6, 0.9, 0.5], S.d.rx(1) + 0.55, 4.3, 0); small(S.mx.userData.lbl, 9);
    S.i1 = sm('rt →', S.d.rx(1) - 0.5, 4.55); S.i2 = sm('rd →', S.d.rx(1) - 0.5, 4.05);
    S.t2 = hot('mux：R-type 選 rd；lw 選 rt', 0, -0.2);
    cap('做一個選擇', 'R-type 的 destination 是 rd，lw 的是 rt');
  },
  async (tok, S) => { // @1537.7
    S.ins = S.d.chip('R-type', 1); S.d.hot(1);
    txt(S.t2, '例：R-type 在 register access 這段：rs、rt、rd 全都出來了');
    cap('假如一個 R-type 在做 register access', 'rs、rt、rd 都出來了');
  },
  async (tok, S) => { // @1574.2
    txt(S.t2, 'rd 現在用得到嗎？用不到 —— 第 5 段才寫回');
    cap('rd 現在用得到嗎？', '用不到，第五個 stage 才用');
  },
  async (tok, S) => { // @1586.6
    S.d.cool(); glow(S.d.regs[1], COL.gold);
    txt(S.t2, '丟掉的話，等一下就不知道寫去哪 → 留在 pipeline register 裡');
    cap('丟掉的話待會就不知道寫去哪裡', '所以放在 pipeline register 裡');
  },
  async (tok, S) => { // @1611.3
    glow(S.mx, COL.gold);
    txt(S.t2, '為什麼有 mux？這時已經知道是 R-type 還是 lw → 只帶一個就好，不必 rt、rd 兩個都帶');
    cap('為什麼這裡有一個 mux？', '已經知道是哪種指令，帶一個必要的就好');
  },
  async (tok, S) => { // @1666.0
    glow(S.mx, null); glow(S.d.regs[1], null);
    S.nw = S.d.chip('新 instruction', 1, '#4b9ee2'); await S.d.go(tok, [[S.ins, 4]], 600);
    S.t3 = note('ID 段讀 register 用的 rs、rt：是現在這個新 instruction 的', -2.8, 4.9);
    S.t4 = note('WB 段寫回用的 rt / rd：是跟著跑過來的那個', 4.4, 4.9);
    txt(S.t2, '兩個 rt 不是同一個：一個屬於現在讀的，一個屬於要寫回的');
    cap('這兩個 rt 是不一樣的東西', '一個是現在讀的，一個是要寫回的');
  },
  async (tok, S) => { // @1784.0
    gone(S.t3, S.t4); relabel(S.ins, 'sw / beq');
    S.t3 = note('不寫 register 的 instruction：位址照樣傳，但 RegWrite = 0 → 不會寫', 4.0, 4.9);
    txt(S.t2, '和 single cycle 一樣：沒有 write enable 就不會寫');
    cap('不是 lw、R-type 的也照樣一路傳', '但沒有 write enable，就不會寫');
  },
  async (tok, S) => { // @1828.6
    gone(S.t3);
    txt(S.t2, 'datapath with control：destination 位址和 control 一樣 —— 還沒用到就一路傳下去');
    cap('Datapath with control', 'destination 位址也是：還沒用到就往下傳');
  },
], { cam: CAM_D });

// 五個指令（課本）：lw $10、sub $11、and $12、or $13、add $14 —— 每個 cycle 誰在哪一段、control 在哪個 pipeline register
const P5 = ['lw  $10, 20($1)', 'sub $11, $2, $3', 'and $12, $4, $5', 'or  $13, $6, $7', 'add $14, $8, $9'];
const P5S = schedule(P5.map((t) => parseIns(t.replace(/\s+/, ' '))), { fwd: true, br: 'pnt', mem1: false });
const P5N = ['lw', 'sub', 'and', 'or', 'add'], P5C = ['#c08a1f', '#4b9ee2', '#9b7ef4', '#2fc092', '#e55a9b'];
async function run5(tok, S, c, note1) {
  txt(S.cy, 'cycle ' + c);
  const mv = [];
  for (let k = 0; k < 5; k++) {
    const st = c - 1 - k;
    if (st === 0 && !S.ch[k]) S.ch[k] = S.d.chip(P5N[k], 0, P5C[k]);
    if (st > 4 && S.ch[k]) { S.d.drop(S.ch[k]); S.ch[k] = null; }
    if (S.ch[k] && st >= 1 && st <= 4) mv.push([S.ch[k], st]);
    S.c.ls[k].element.textContent = (P5[k] + '   ' + (st < 0 ? '' : st > 4 ? '完成' : FIVE[st])).padEnd(26, ' ');
  }
  await S.d.go(tok, mv, 600);
  S.d.noCtl();
  for (let k = 0; k < 5; k++) { const st = c - 1 - k, v = k ? CV.R : CV.lw; if (st === 2) S.d.ctl(1, ['WB', 'M', 'EX'], v); if (st === 3) S.d.ctl(2, ['WB', 'M'], v); if (st === 4) S.d.ctl(3, ['WB'], v); }
}
scene('ppA-17b-run5', '17B：五個指令跑一遍：control 跟著指令走', [
  async (tok, S) => { // @1851.2
    S.d = mkDP(S, { y: 1.6 }); S.ch = [];
    S.c = code(P5.map((t) => t.padEnd(26, ' ')), -3.0, 6.6, 0.42);
    S.k = sm('（課本的五個指令）', 2.6, 6.6); S.cy = hot('', 4.8, 5.6);
    cap('看 lw、sub、and、or、add', '用 pipeline 時 control 怎麼跑');
  },
  async (tok, S) => { // @1866.0
    await run5(tok, S, 1);
    S.t = note('cycle 1：lw 只做 instruction fetch，還沒有任何 control signal', 0.6, -0.4);
    cap('cycle 1：lw 在 instruction fetch', '第一段還沒有 control signal');
  },
  async (tok, S) => { // @1881.3
    await run5(tok, S, 2);
    glow(S.d.blocks[1], COL.gold);
    txt(S.t, 'cycle 2：lw decode → control 出來了（EX 0001、M 010、WB 11），放進 ID/EX；sub 做 fetch');
    cap('cycle 2：lw 做 decoding', 'control 放進 pipeline register；sub 做 fetch');
  },
  async (tok, S) => { // @1904.0
    glow(S.d.blocks[1], null);
    await run5(tok, S, 3);
    glow(S.d.ctlB[1][2], COL.gold);
    txt(S.t, 'cycle 3：lw 用 EX 組 —— ALUSrc = 1，第二個運算元選 sign-extend 的 20');
    cap('cycle 3：lw 用 EX 這組 control', 'ALUSrc 選 1：用 sign-extension 的值');
  },
  async (tok, S) => { // @1949.0
    S.n2 = note('上個 cycle 讀出的 rs、rt、sign-extend 值也都放在 ID/EX', S.d.rx(1), 4.0);
    cap('上個 cycle 讀出的 data', '也放在這個 pipeline register，下個 stage 才用');
  },
  async (tok, S) => { // @1990.8
    gone(S.n2); glow(S.d.blocks[1], COL.gold);
    txt(S.t, '同時 sub 在 decode，產生新的 control（11 → 10、010 → 000）—— 會跟 lw 的打架嗎？');
    cap('sub 同時在 decoding', '新的 control 會不會跟 lw 的打架？');
  },
  async (tok, S) => { // @2015.0
    txt(S.t, '不會：要等 clock edge 一來才寫進 pipeline register，那時 lw 的早就用完了');
    S.d.regs.forEach((r) => glow(r, COL.gold));
    cap('不會：clock edge 還沒來', '等 cycle 結束才寫進去，舊的已用完');
  },
  async (tok, S) => { // @2103.7
    S.d.regs.forEach((r) => glow(r, null)); glow(S.d.blocks[1], null);
    await run5(tok, S, 4);
    glow(S.d.ctlB[2][1], COL.gold); glow(S.d.ctlB[1][2], COL.gold);
    txt(S.t, 'cycle 4：lw 用 M 組讀 memory；sub 用 EX 組做減法；and decode；or fetch —— 各做各的');
    cap('cycle 4：sub 在第三段、lw 在下一段', '新的指令進來 decode，各做各的');
  },
  async (tok, S) => { // @2152.7
    txt(S.t, 'EX 做完之後：lw 只剩 M、WB 兩組往下帶');
    cap('EX 做完了', '只把 M 跟 WB 的 control 帶過去');
  },
  async (tok, S) => { // @2199.1
    await run5(tok, S, 5);
    glow(S.d.ctlB[3][0], COL.gold);
    S.n2 = note('lw 寫回 $10：用跟過來的 destination（rt = 10）', 5.0, 4.0);
    txt(S.t, 'cycle 5：lw 用 WB 組寫回；sub 在 MEM、and 在 EX、or 在 ID、add 在 IF');
    cap('cycle 5：lw 寫回 register file', '用剛才選好的 destination（$10）');
  },
  async (tok, S) => { // @2235.4
    gone(S.n2); await run5(tok, S, 6);
    txt(S.t, 'cycle 6：sub 寫回 $11 …… 每個 instruction 都帶著自己的 control 往前走');
    cap('cycle 6：繼續往下走', 'sub 寫回 $11');
  },
  async (tok, S) => { // @2243.3
    for (let c = 7; c <= 9; c++) { await run5(tok, S, c); if (c < 9) await wt(tok, 300); }
    S.d.noCtl();
    txt(S.t, '');
    S.n2 = ok(P5S.total === 9 && P5S.stalls === 0, 0.6, -0.4, 'cycle 7、8、9：最後一個 add 在 cycle 9 寫回 → 5 + 4 = 9 個 cycle ✓');
    cap('第七、八、九個 clock cycle', '五個指令全部做完');
  },
], { cam: CAM_D });

// 理想 speedup 與「被最慢的 stage 限制」：示意的段長（單位時間），程式算給你看
const SPD = (seg, n) => { const one = seg.reduce((a, b) => a + b, 0), clk = Math.max(...seg); return (one * n) / ((n + seg.length - 1) * clk); };
const BAL = [1, 1, 1, 1, 1], UNB = [2, 1, 2, 2, 1];
scene('ppA-17b-sum', '17B：總結：pipeline 的基本概念、5 倍加速與最慢的 stage', [
  async (tok, S) => { // @2257.5
    S.d = mkDP(S, { y: 3.4 });
    S.t = note('datapath：就是 single cycle 的 datapath，切好 stage、加上 pipeline register', 0, 5.6);
    S.d.regs.forEach((r) => glow(r, COL.gold));
    cap('datapath：基本上就是 single cycle 的', '切好 stage 之後加上 pipeline register');
  },
  async (tok, S) => { // @2273.3
    S.d.regs.forEach((r) => glow(r, null)); S.d.ctl(1, ['WB', 'M', 'EX']); S.d.ctl(2, ['WB', 'M']); S.d.ctl(3, ['WB']);
    txt(S.t, 'control：第 2 段 decode 完，不馬上用，照「哪一段用」分組往下傳');
    cap('control：第二段 decode 完', '分好組，一直往下傳到用到的 stage');
  },
  async (tok, S) => { // @2294.9
    S.rd = cube('rd', '#f3d36b', [0.5, 0.34, 0.4], S.d.rx(3), S.d.y - 0.5, 0.45);
    txt(S.t, '除了 control，destination register 這些「等一下才用」的東西也都往下傳');
    cap('除了 control signal', 'destination register 這些也都要往下傳');
  },
  async (tok, S) => { // @2311.3
    gone(S.d, S.rd); S.d = null;
    S.g = mkGrid(S, 9, { y0: 6.2, dy: 0.5 });
    [0, 1, 2, 3, 4].forEach((k) => S.g.add(k, 'instruction ' + (k + 1), L5(k + 1))); S.g.upto(99);
    txt(S.t, '基本概念：很多個 step、各用不同的 resource，同時被不同的 instruction 執行');
    S.t.position.set(0.6, 3.2, 0);
    cap('pipeline 的基本概念', '多個 step 用不同的 resource，同時執行');
  },
  async (tok, S) => { // @2334.8
    S.t2 = ok(clashes(S.g.rowsArr()).length === 0, 0.6, 2.6, '每個 clock cycle 開始一個新的 instruction、相隔一個 cycle、同段同資源 → 不打架 ✓');
    cap('每個 clock cycle 開始下一個 instruction', '相隔一個 cycle，所以不會衝突');
  },
  async (tok, S) => { // @2355.4
    gone(S.t2);
    const n = 1000, sp = SPD(BAL, n);
    S.t2 = ok(Math.abs(sp - 5) < 0.03, 0.6, 2.6, '示意：5 段一樣長、1000 個指令 → 加速 = 5000 / 1004 ≈ ' + sp.toFixed(2) + ' ≈ 5 倍 ✓');
    cap('理論上切成五個 stage', '就有五倍的 speedup');
  },
  async (tok, S) => { // @2362.0
    const n = 1000, sp = SPD(UNB, n);
    S.bars = UNB.map((v, i) => { const b = cube(FIVE[i] + ' ' + v, COL[FIVE[i]], [v * 0.9 - 0.06, 0.4, 0.4], -3.9 + UNB.slice(0, i).reduce((a, x) => a + x, 0) * 0.9 + v * 0.45, 1.7, 0); small(b.userData.lbl, 9); return b; });
    S.t3 = ok(Math.abs(sp - 4) < 0.03, 0.6, 0.9, '示意：段長 2、1、2、2、1 → clock 要用最長的 2 → 只剩 8 / 2 ≈ ' + sp.toFixed(2) + ' 倍 ✓');
    cap('但會被最慢的那個 stage 限制', '所以切的時候要盡量 balance');
  },
  async (tok, S) => { // @2382.7
    gone(S.t2, S.t3, S.bars);
    S.t2 = hot('最麻煩的是 hazard：到目前都假設 instruction 之間沒有依賴', 0.6, 2.2);
    cap('最麻煩的是 hazard', '到目前都假設沒有 hazard、彼此不依賴');
  },
  async (tok, S) => { // @2397.4
    S.t3 = note('MIPS 好 pipeline：每個指令一樣長（32 bits）、格式簡單、規則', 0.6, 1.4);
    cap('MIPS 為什麼好做 pipeline？', '指令長度相同、format 簡單');
  },
]);

// hazard 預告：beq 的下一個要抓誰？寫 $5 的指令後面馬上讀 $5？
scene('ppA-17b-hz', '17B：hazard 預告：data hazard 與 branch hazard', [
  async (tok, S) => { // @2423.1
    S.t = hot('hazard 兩大類：data hazard、branch（control）hazard', 0.6, 6.6);
    cap('hazard 要來了', '一種 data hazard，一種 branch hazard');
  },
  async (tok, S) => { // @2433.3
    S.t2 = note('data hazard：資料的 dependency（我要用你算的結果）造成的', 0.6, 5.9);
    cap('data hazard', '因為 data 的 dependency 造成');
  },
  async (tok, S) => { // @2440.7
    S.t3 = note('control hazard：下一個要執行哪個 instruction？sequential 就是下一個，branch 不一定', 0.6, 5.3);
    cap('control hazard', '下一個要去哪一個 instruction');
  },
  async (tok, S) => { // @2456.0
    gone(S.t2, S.t3);
    S.g = mkGrid(S, 7, { y0: 5.0 });
    S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID'], [3, 'EX', 'EX 比對']]); S.g.add(1, '下一個？', [[2, 'IF', 'IF ?']]); S.g.add(2, '再下一個？', [[3, 'IF', 'IF ?']]);
    S.g.upto(99); S.g.hot(0, 3, COL.gold);
    S.t2 = note('beq 到第 3 段才比對完，但每個 cycle 都得 fetch 一個新的', 0.6, 2.6);
    cap('branch 什麼時候才決定跳去哪？', 'cycle 3 才比對完，下一個早就要進來了');
  },
  async (tok, S) => { // @2491.1
    txt(S.t2, '只好先猜一個：猜 sequential（PC + 4）—— 可能猜錯 → 這就是 hazard');
    cap('還沒決定就得抓指令', '只好猜 sequential，可能會猜錯');
  },
  async (tok, S) => { // @2507.8
    gone(S.g, S.t2); S.g = mkGrid(S, 7, { y0: 5.0 });
    S.g.add(0, '寫 $5 的指令', L5(1)); S.g.upto(99); S.g.hot(0, 5, COL.gold);
    S.t2 = note('第 1 個：算完要寫回 register 5，第 5 個 cycle 才寫', 0.6, 2.6);
    cap('data hazard：第一個要寫 register 5', '第五個 cycle 才寫回去');
  },
  async (tok, S) => { // @2548.7
    S.g.add(1, '讀 $5 的指令', L5(2)); S.g.row(1); S.g.hot(1, 3, '#7a1010');
    S.t3 = ok(3 < 5, 0.6, 1.9, '第 2 個在 cycle 3（第 2 段）就要讀 $5，但 $5 cycle 5 才寫 → 讀到舊的 ✓ hazard');
    cap('下一個在第二個 stage 就要讀了', '還沒寫回去 → hazard 產生');
  },
  async (tok, S) => { // @2566.7
    S.g.add(2, '很後面才讀 $5（示意）', L5(5)); S.g.row(2); S.g.hot(2, 6, COL.gold);
    S.t4 = ok(6 > 5, 0.6, 1.3, '在 cycle 6 才讀：$5 已經寫好 → 沒有 hazard ✓');
    cap('如果很後面才讀，就沒有 hazard', '有 dependency 不一定有 hazard，看距離');
  },
  async (tok, S) => { // @2595.3
    gone(S.t2, S.t3, S.t4); S.g.cool();
    S.g.dropRow(2); S.g.label(0, 'R-type 寫 $5'); S.g.label(1, 'R-type 讀 $5');
    S.g.hot(0, 3, COL.gold); S.g.hot(1, 4, COL.gold);
    S.a = arrow(V3(S.g.cx(3) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.3, S.g.cy(1) + 0.12, 0.4), 0xc08a1f);
    S.t2 = note('R-type → R-type：結果在 EX（cycle 3）就算好了，只是還沒寫 → 直接送過去：forwarding', 0.6, 2.2);
    cap('R-type 接 R-type：data 早就算好了', '直接送給你，叫 forwarding');
  },
  async (tok, S) => { // @2660.0
    gone(S.a); S.g.cool(); S.g.label(0, 'lw 載入 $5');
    S.g.hot(0, 4, '#7a1010'); S.g.hot(1, 4, '#7a1010');
    txt(S.t2, 'lw → R-type：資料要 MEM（cycle 4）讀完才有，下一個 cycle 4 就要用 → 真的還沒出來 → 只好 stall（停下來等）');
    cap('load 接 R-type：data 真的還沒出來', '只好 stall，停下來等');
  },
  async (tok, S) => { // @2757.1
    gone(S.g, S.t2);
    S.g = mkGrid(S, 7, { y0: 5.0 }); S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID'], [3, 'EX']]); S.g.add(1, '等（stall）', [[2, 'nop', '等'], [3, 'nop', '等']]); S.g.add(2, '下一個', [[4, 'IF']]); S.g.upto(99);
    S.t2 = note('branch hazard 最笨的方法：停下來等決定 —— 但每個 branch 都浪費 cycle（示意）', 0.6, 2.4);
    cap('branch hazard 最笨的方法：停', '可是停就影響 performance');
  },
  async (tok, S) => { // @2799.1
    S.g.dropRow(1); S.g.dropRow(2); S.g.add(1, 'PC + 4（猜）', [[2, 'IF'], [3, 'ID']]); S.g.add(2, 'PC + 8（猜）', [[3, 'IF']]); S.g.upto(99);
    txt(S.t2, '所以先猜 sequential（PC + 4）照樣抓；猜錯再 flush 補救 —— 大部分都猜對');
    cap('所以先猜 sequential，照樣抓下去', '發現錯了再 flush；大部分猜對');
  },
]);

// ════════ IO5zhg0flDI（第18A講：複習五段、pipeline register、control；hazard 總覽；兩類 data hazard；RAW / WAR / WAW） ════════
scene('ppA-18a-intro', '18A：開場：pipeline 會因為 dependency 產生 hazard', [
  async (tok, S) => { // @17.3
    S.d = mkDP(S);
    S.t = note('上次：pipeline overview —— datapath、control 長什麼樣', 0, 5.6);
    cap('上次介紹了 pipeline overview', 'datapath、control 長什麼樣');
  },
  async (tok, S) => { // @19.6
    S.ch = [0, 1, 2, 3, 4].map((i) => S.d.chip('指令 ' + (5 - i), i, ['#4b9ee2', '#9b7ef4', '#dd8238', '#2fc092', '#e55a9b'][i]));
    txt(S.t, '理想狀況：程式丟進 pipeline，一步一步順順走過去');
    cap('理想上把程式丟進 pipeline', '一步一步走過去就好');
  },
  async (tok, S) => { // @22.2
    txt(S.t, '但指令之間有 dependency → 產生 hazard（data hazard、control hazard）');
    glow(S.ch[1], '#7a1010'); glow(S.ch[2], '#7a1010');
    cap('但是有 dependency 的關係', '會產生 hazard：data / control hazard');
  },
  async (tok, S) => { // @50.1
    S.ch.forEach((m) => glow(m, null));
    txt(S.t, '在講 hazard 之前，先把 pipeline 複習一遍');
    cap('先把前面的 pipeline 再 review 一下', 'high performance 一定用 pipeline');
  },
], { cam: CAM_D });

scene('ppA-18a-review', '18A：複習：五個 stage、錯開進場、latency 與 throughput', [
  async (tok, S) => { // @94.6
    S.t = note('pipeline：resource 給大家共用 —— 同一時間很多 instruction 一起做', 0.6, 6.7);
    cap('pipeline：把 resource 給大家共用', '同一個時間很多 instruction 一起做');
  },
  async (tok, S) => { // @105.0
    S.g = mkGrid(S, 9, { y0: 5.7 });
    S.g.add(0, '第 1 個 instruction', []);
    txt(S.t, '把 datapath 要做的事切成 5 個 stage');
    cap('把 datapath 分成很多個 stage', '我們分成 5 個 stage');
  },
  async (tok, S) => { // @115.5
    S.g.add(0, '第 1 個 instruction', [[1, 'IF']]); S.g.row(0);
    S.s = sm('IF：instruction fetch（抓指令）', 0.6, 2.6);
    cap('第一個：instruction fetch', '一定要記得');
  },
  async (tok, S) => { // @121.2
    S.g.add(0, null, [[2, 'ID']]); S.g.row(0); txt(S.s, 'ID：register access，同時做 decoding');
    cap('再來：register access', '同時做 decoding');
  },
  async (tok, S) => { // @127.6
    S.g.add(0, null, [[3, 'EX']]); S.g.row(0); txt(S.s, 'EX：ALU execution —— R-type 加減；load / store 算位址');
    cap('ALU 的 execution', 'R-type 做加減，load/store 算地址');
  },
  async (tok, S) => { // @137.7
    S.g.add(0, null, [[4, 'MEM']]); S.g.row(0); txt(S.s, 'MEM：memory access —— R-type 不用，但也要「空著」經過');
    cap('第四個：memory access', 'R-type 沒做也要空在那邊');
  },
  async (tok, S) => { // @148.2
    S.g.add(0, null, [[5, 'WB']]); S.g.row(0); txt(S.s, 'WB：write back —— 寫回 register file');
    cap('第五個 stage：write back', '寫回 register file');
  },
  async (tok, S) => { // @172.4
    S.g.add(1, '第 2 個', L5(2)); S.g.upto(2); S.g.band(2, 0, 1);
    txt(S.s, '第 1 個做第 2 段時，第 1 段的 resource 已經 release → 第 2 個進來');
    cap('第一個做第二個 stage 時', '第一個 stage 的資源空出來，第二個就進來');
  },
  async (tok, S) => { // @188.5
    S.g.unband(); S.g.add(2, '第 3 個', L5(3)); S.g.upto(3); S.g.band(3, 0, 2);
    txt(S.s, '第 1 個到第 3 段：第 1、2 段都空出來 → 第 3 個進來');
    cap('第一個到第三個 stage', '第三個 instruction 就可以進來');
  },
  async (tok, S) => { // @197.0
    S.g.unband(); S.g.add(3, '第 4 個', L5(4)); S.g.add(4, '第 5 個', L5(5)); S.g.upto(5); S.g.band(5, 0, 4);
    const busy = [0, 1, 2, 3, 4].filter((k) => S.g.at(k, 5)).length;
    gone(S.s); S.s = ok(busy === 5, 0.6, 2.4, 'cycle 5：5 個 instruction 同時在跑，各用不同的 resource ✓');
    cap('同一個時間最多 5 個 instruction 在跑', '用不同的 resource → performance 增加');
  },
  async (tok, S) => { // @207.4
    S.g.unband(); S.g.upto(99);
    gone(S.s); S.s = note('每個 instruction 自己還是要走 5 段（latency 一樣是 5 個 cycle）', 0.6, 2.4);
    S.a = arrow(V3(S.g.cx(1) - 0.35, S.g.cy(0) - 0.35, 0.4), V3(S.g.cx(5) + 0.35, S.g.cy(0) - 0.35, 0.4), 0x7a1010);
    cap('pipeline 會縮短 response time（latency）嗎？', '不會：丟進去還是要走五個 stage');
  },
  async (tok, S) => { // @254.8
    S.s2 = ok(true, 0.6, 1.7, '但從 cycle 5 開始每個 cycle 都完成一個 → throughput（單位時間完成的工作）增加 ✓');
    [5, 6, 7, 8, 9].forEach((c, k) => S.g.hot(k, c, COL.gold));
    cap('pipeline 增加的是 throughput', '單位時間完成的工作變多；latency 不變');
  },
]);

scene('ppA-18a-dp', '18A：datapath：加 pipeline register，切得越平衡越好', [
  async (tok, S) => { // @268.4
    S.d = mkDP(S, { regs: false });
    S.t = note('pipeline 的 datapath：直接拿 single cycle 的 datapath 來用', 0, 5.6);
    cap('再看 datapath', 'single cycle 的 datapath 直接拿來用');
  },
  async (tok, S) => { // @283.2
    txt(S.t, '切成五個 stage 之後，還要加什麼？');
    cap('切成五個 stage 之後', '要加什麼東西才能完成？');
  },
  async (tok, S) => { // @299.6
    S.regs = ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'].map((n, i) => { const r = cube('', COL.reg, [0.24, 1.9, 0.6], S.d.rx(i), S.d.y + 0.1, 0, 1.5); S.d.ex.push(small(tag(n, 'idx', S.d.rx(i), S.d.y - 1.2), 9)); return r; });
    txt(S.t, '每兩個 stage 之間加一個 pipeline register（不能只在心裡切一切）');
    cap('在每個 stage 之間', '要加一個 pipeline register');
  },
  async (tok, S) => { // @313.7
    S.regs.forEach((r) => glow(r, COL.gold));
    txt(S.t, '一個 stage 做完，結果先存進 pipeline register（latch）—— 這樣才算一個 cycle 完成');
    cap('一個 stage 做完先存進 register', '這樣才叫一個 cycle 完成');
  },
  async (tok, S) => { // @321.2
    S.regs.forEach((r) => glow(r, null));
    txt(S.t, 'cycle 切得比較細：一個 cycle 只做一段');
    cap('所以 cycle 切得比較細', '');
  },
  async (tok, S) => { // @333.6
    txt(S.t, '要隨便亂切，還是切得 balance 一點？為什麼？');
    cap('要隨便切，還是盡量 balance？', '為什麼要 balance？');
  },
  async (tok, S) => { // @345.9
    S.len = [1.2, 0.6, 1.0, 1.4, 0.6];
    S.bars = S.len.map((v, i) => { const b = cube('', COL[FIVE[i]], [0.5, v, 0.4], S.d.xs[i] + 0.6, 4.2 + v / 2, 0); return b; });
    S.n = sm('（示意：每段需要的時間）', 0, 6.4);
    txt(S.t, 'clock 被哪一段 dominate？最長的那一段');
    cap('pipeline 的 clock 被誰決定？', '最長的那個 stage');
  },
  async (tok, S) => { // @371.9
    S.bars.forEach((b, i) => { if (S.len[i] < 1.4) glow(b, '#555555'); });
    S.w = bub('短的段做完也不能先走：要等最慢的那段做完，大家才一起往下一段', 0, 0.0);
    cap('短的 stage 做完也不能叫人家先走', '要等最慢的那個做完');
  },
  async (tok, S) => { // @389.6
    S.bars.forEach((b, i) => glow(b, S.len[i] === 1.4 ? COL.gold : null));
    txt(S.t, 'clock period = 最長那段的時間 → 切的時候盡量 balance');
    gone(S.w); S.w = ok(Math.max(...S.len) === S.len[3], 0, 0.0, '示意：最長是第 4 段 → 每個 cycle 都得等它 ✓');
    cap('clock period 被最長的 stage 決定', '所以切的時候盡量 balance');
  },
], { cam: CAM_D });

scene('ppA-18a-ctl', '18A：control：在 decode 產生，分組跟著往下傳', [
  async (tok, S) => { // @406.3
    S.d = mkDP(S); ctrlBox(S);
    S.t = note('control：single cycle 時已經介紹過', 0.8, 6.3);
    cap('control 的部分', '在 single cycle 已經介紹過');
  },
  async (tok, S) => { // @418.7
    S.alu = cube('ALU control', '#a99470', [1.6, 0.5, 0.6], 0, 5.0, 0); small(S.alu.userData.lbl, 9);
    S.f = sm('funct →', -1.6, 5.0);
    txt(S.t, '兩個 controller：main controller（看 opcode）＋ ALU controller（看 function code）');
    cap('兩個 controller', 'main controller 和 ALU controller');
  },
  async (tok, S) => { // @430.9
    glow(S.cb, COL.gold);
    txt(S.t, '大部分 control signal：知道 opcode（是哪種 instruction）就知道了');
    cap('知道 opcode 就知道做什麼 instruction', 'source 從哪來、destination 在哪都知道');
  },
  async (tok, S) => { // @442.1
    S.d.hot(1);
    txt(S.t, 'opcode 在第 2 段（ID）decode 完就知道 → control signal 全部出來');
    cap('opcode 在第二個 stage 就知道', 'decode 之後 control signal 就知道了');
  },
  async (tok, S) => { // @456.8
    S.d.cool(); [2, 3, 4].forEach((i) => S.d.hot(i));
    txt(S.t, '可是要在後面幾段才執行 —— 怎麼辦？');
    cap('可是要在後面才執行', '這些 control signal 要怎麼辦？');
  },
  async (tok, S) => { // @468.5
    S.d.cool(); S.d.ctl(1, ['WB', 'M', 'EX']);
    txt(S.t, '一起傳下去：decode 時就產生，EX、MEM、WB 各用各的');
    cap('就一起傳下去', 'decode 產生，後面各段用不同的 signal');
  },
  async (tok, S) => { // @485.8
    S.d.ctl(2, ['WB', 'M']); S.d.ctl(3, ['WB']);
    txt(S.t, '分成 group，放在 pipeline register 裡一步一步往下傳');
    cap('分成 group', '在 pipeline register 裡一步一步往下傳');
  },
  async (tok, S) => { // @503.1
    txt(S.t, '懂 single cycle 的 control，pipeline 的 control 就很簡單：decode 產生後往下傳');
    cap('single cycle 懂了，pipeline 也很簡單', '只是 decode 產生之後往下傳');
  },
], { cam: CAM_D });

// hazard 總覽：寫 R5 的指令 vs 下一個讀 R5；beq 在第 4 段才決定
scene('ppA-18a-why', '18A：hazard 從哪來：往回走的 feedback path', [
  async (tok, S) => { // @511.2
    S.t = hot('兩大 hazard：data hazard、control hazard', 0.6, 6.7);
    cap('接下來講 hazard', '兩大類：data hazard、control hazard');
  },
  async (tok, S) => { // @518.4
    S.d = mkDP(S, { y: 3.6 });
    S.fb1 = arrow(V3(5.6, 5.0, 0.4), V3(-2.4, 5.0, 0.4), 0xd64545); S.fb1l = sm('WB 寫回 register（往回走）', 1.6, 5.3);
    S.fb2 = arrow(V3(2.8, 2.4, 0.4), V3(-5.6, 2.4, 0.4), 0xd64545); S.fb2l = sm('branch 決定新的 PC（往回走）', -1.4, 2.1);
    cap('問題出在 feedback 的路線', '往回頭走的線');
  },
  async (tok, S) => { // @527.5
    gone(S.d, S.fb1, S.fb2, S.fb1l, S.fb2l); S.d = null;
    S.t2 = note('sequential（single cycle）：一個做完全部寫回，下一個才開始 → 不會有問題', 0.6, 6.1);
    cap('sequential 執行時', '一個全部做完、寫回了，下一個才開始');
  },
  async (tok, S) => { // @542.8
    S.g = mkGrid(S, 9, { y0: 5.2 });
    S.g.add(0, '寫 R5', L5(1)); S.g.row(0); S.g.hot(0, 5, COL.gold);
    txt(S.t2, 'pipeline：寫 register 要到第 5 個 stage');
    cap('pipeline 時，寫 register', '要第五個 stage 才寫');
  },
  async (tok, S) => { // @554.6
    S.g.add(1, '馬上讀 R5', L5(2)); S.g.row(1); S.g.hot(1, 3, '#7a1010');
    S.t3 = note('下一個在第 2 段（cycle 3）就要讀 R5；那時寫 R5 的才在 EX', 0.6, 1.6);
    cap('下一個 instruction 馬上要用 R5', '它讀的時候，前一個還在 execution');
  },
  async (tok, S) => { // @586.4
    S.t4 = ok(3 < 5, 0.6, 1.0, 'R5 還沒寫進去（cycle 5 才寫）→ 讀到舊資料：data hazard ✓');
    cap('資料不在裡面', '這就是 data hazard 的原因');
  },
  async (tok, S) => { // @591.3
    gone(S.g, S.t3, S.t4); S.g = mkGrid(S, 9, { y0: 5.2 });
    S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID'], [3, 'EX'], [4, 'MEM', 'MEM 決定']]); S.g.row(0);
    txt(S.t2, 'control hazard：beq 可能照順序執行，也可能跳去 target');
    cap('control hazard 也一樣', 'branch equal 可能 sequential，也可能跳');
  },
  async (tok, S) => { // @602.6
    S.g.hot(0, 4, COL.gold);
    S.t3 = note('這個 datapath 要到第 4 段才決定跳不跳', 0.6, 1.6);
    cap('什麼時候才能決定？', '可能要到第四個 stage');
  },
  async (tok, S) => { // @615.7
    S.g.add(1, 'PC + 4（猜）', L5(2)); S.g.add(2, 'PC + 8（猜）', L5(3)); S.g.add(3, 'PC + 12（猜）', L5(4)); S.g.upto(4);
    txt(S.t3, '下一個馬上要進來 → 只好猜：假裝 sequential，PC = PC + 4');
    cap('下一個馬上要進來', '只好猜：假裝 sequential，PC + 4');
  },
  async (tok, S) => { // @627.3
    [1, 2, 3].forEach((k) => { for (let c = 2; c <= 4; c++) { const m = S.g.at(k, c); if (m) { tint(m, COL.bad); relabel(m, 'flush'); } } });
    const nGuess = [1, 2, 3].filter((k) => S.g.at(k, k + 1)).length;
    S.t4 = ok(nGuess === 3, 0.6, 1.0, '真正知道時其實要跳 → 已進來的 3 個全錯，要 flush（沖掉）✓');
    cap('真正知道時其實要跳', '下面已經執行的都錯了 → flush 沖掉');
  },
]);

scene('ppA-18a-2types', '18A：兩大類 data hazard：R-type → 讀、lw → 讀', [
  async (tok, S) => { // @643.4
    S.t = hot('data hazard 有兩個 type：R-type 接 R-type、load 接 R-type', 0.6, 6.7);
    cap('先看 data hazard', '有兩個 type：R 接 R、load 接 R');
  },
  async (tok, S) => { // @667.3
    S.t2 = note('先問：誰會「寫」register？', 0.6, 6.1);
    cap('先問：誰會寫 register？', '');
  },
  async (tok, S) => { // @698.2
    txt(S.t2, '只有兩類會寫 register file：R-type（加減…）與 load（從 memory 拿東西）');
    S.g = mkGrid(S, 8, { y0: 5.0 });
    S.g.add(0, 'R-type（寫）', R5(1)); S.g.add(1, 'lw（寫）', L5(1).map(([c, s]) => [c, s])); S.g.upto(99);
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 5, COL.gold);
    cap('會寫 register 的', '只有 R-type 和 load 兩大類');
  },
  async (tok, S) => { // @709.5
    S.g.cool(); S.g.add(2, '讀的人（隨便什麼指令）', L5(2)); S.g.row(2); S.g.hot(2, 3, '#4b9ee2');
    S.t3 = note('要「讀」的人：所有 register access 都在第 2 段', 0.6, 2.4);
    cap('要用的人：access register', '全部都在第二個 stage');
  },
  async (tok, S) => { // @741.3
    S.g.hot(0, 3, COL.gold);
    txt(S.t3, 'R-type 雖然第 5 段才寫，data 其實在第 3 段（EX）就算好了 —— 是我們故意讓它慢慢來');
    cap('R-type 的 data 什麼時候 ready？', 'execution（第三段）就已經算完了');
  },
  async (tok, S) => { // @759.4
    S.g.cool(); S.g.hot(1, 3, '#7a1010'); S.g.hot(1, 4, COL.gold);
    txt(S.t3, 'load：在 EX 只算出位址，資料要等 MEM 讀完才真的有');
    cap('load 在 execution 時知道資料嗎？', '不知道，要等真的 load 完');
  },
  async (tok, S) => { // @790.2
    S.g.cool(); S.g.hot(0, 3, COL.gold);
    S.t4 = good('第一種：data 已經在那邊，只是沒寫回 → 用 forwarding', 0.6, 1.7);
    cap('第一種：data 已經在那裡', '只是沒寫回去 → forwarding');
  },
  async (tok, S) => { // @798.1
    S.t5 = bad('第二種：data 真的不在那邊 → 沒有別的方法，只能 stall（停）', 0.6, 1.1);
    cap('第二種：data 真的不在', '沒有別的方法，只有 stall');
  },
  async (tok, S) => { // @824.9
    txt(S.t, '聽到 data hazard，就要知道是兩大類：一種 forwarding 就能解決、一種只好 stall');
    cap('data hazard 是兩大類', '一種 forwarding 解決，一種只好 stall');
  },
  async (tok, S) => { // @856.1
    S.t6 = note('還有別的指令會寫 register file 嗎？到目前沒有了', 0.6, 0.4);
    cap('還有別的 type 會寫 register 嗎？', '到目前好像沒有了');
  },
  async (tok, S) => { // @869.8
    txt(S.t6, '後面接什麼都可以（各式各樣的組合），但「前面寫的人」只有這兩類 → 只要分這兩類');
    cap('實際上什麼組合都有', '但寫回去的只有兩類，歸類完就這兩種');
  },
]);

scene('ppA-18a-three', '18A：三種 hazard 與「等待」這個萬用解', [
  async (tok, S) => { // @910.6
    S.t = hot('hazard 有哪些？', 0.6, 6.7);
    cap('先看一下 hazard 到底有哪些', '');
  },
  async (tok, S) => { // @918.8
    S.h1 = note('① structural hazard：同一個 resource，兩個人搶著用', 0.6, 6.0);
    cap('還有一個 structural hazard', '同一個 resource 兩個人搶著用');
  },
  async (tok, S) => { // @929.6
    S.h1b = sm('（和 data dependency 沒有關係；data / control hazard 才和指令間的 dependency 有關）', 0.6, 5.5);
    cap('structural hazard 跟 dependency 無關', '只是不同 instruction 競爭同一個 resource');
  },
  async (tok, S) => { // @953.4
    S.g = mkGrid(S, 8, { y0: 4.6 }); S.g.add(0, '前一個', L5(1)); S.g.add(1, '後一個', L5(2)); S.g.upto(99);
    S.t2 = ok(clashes(S.g.rowsArr()).length === 0, 0.6, 2.2, '解法：每個 resource 都在同一個 stage 用，又相差一個 cycle → 永遠不衝突 ✓');
    cap('怎麼解決？大家在同一個 stage 用', '又差一個 cycle → 永遠不會衝突');
  },
  async (tok, S) => { // @1007.0
    S.g.dropRow(1); S.g.add(1, 'R-type 第 4 段寫', R4(2)); S.g.row(1); S.g.band(5, 0, 1, '#d64545');
    gone(S.t2); S.t2 = ok(clashes(S.g.rowsArr()).length === 1, 0.6, 2.2, '例：lw 後緊接 R-type，R-type 若提前到第 4 段寫 → 撞在 cycle 5 ✓');
    cap('例如 R-type 第四個 stage 就寫', '剛好接在 lw 後面 → 衝突');
  },
  async (tok, S) => { // @1044.9
    gone(S.g, S.t2);
    S.h2 = note('② data hazard：要用的 data 還沒 ready，就讀到舊的 —— 不能違反程式的意思', 0.6, 4.6);
    cap('data hazard：要用時 data 還沒準備好', '不能違反寫程式的意思');
  },
  async (tok, S) => { // @1079.9
    S.h3 = note('③ control hazard：跳去哪都還不知道就得 fetch 下一個 → 只好猜，猜錯就是 hazard', 0.6, 4.0);
    cap('control hazard', '還不知道跳去哪就要 fetch → 猜，猜錯就麻煩');
  },
  async (tok, S) => { // @1096.1
    S.t3 = hot('解法永遠有一個：wait（等）', 0.6, 3.2);
    cap('要解決 hazard，永遠可以 wait', '有 dependency 就等你寫回去再做');
  },
  async (tok, S) => { // @1109.4
    S.g = mkGrid(S, 10, { y0: 2.5, dy: 0.55 });
    // 沒有 internal forwarding 時：讀的人 ID 要在寫的人 WB 之後（cycle 6），IF 只好從 cycle 2 延到 cycle 5
    const wbCycle = 5, idNeed = wbCycle + 1, ifAt = idNeed - 1, delay = ifAt - 2;
    S.g.add(0, '寫 R5', L5(1)); S.g.add(1, '讀 R5（等）', [[2, 'nop', '等'], [3, 'nop', '等'], [4, 'nop', '等'], ...L5(ifAt)]); S.g.upto(99);
    S.t4 = ok(delay === 3, 0.6, -0.4, '等第 5 段寫回後才讀：IF 從 cycle 2 延到 cycle ' + ifAt + ' → 多等 3 個 cycle ✓');
    cap('等到第五個 stage 寫回去', '可能要等三個 cycle 才去 fetch');
  },
  async (tok, S) => { // @1117.7
    [2, 3, 4].forEach((c) => S.g.hot(1, c, '#7a1010'));
    txt(S.t3, 'wait 一定能解決，但浪費 cycle —— pipeline 就是要每個 cycle 都有東西出來');
    cap('wait 永遠可以，但浪費 cycle', 'pipeline 要的是每個 cycle 都有東西出來');
  },
]);

// 單一記憶體：lw 在 cycle 4 讀資料、第 4 個指令同時要抓指令
const MEMR = (s) => (s === 'IF' || s === 'MEM' ? 'memory' : s);
scene('ppA-18a-mem1', '18A：structural hazard 的例子：只有一個 memory', [
  async (tok, S) => { // @1131.6
    S.t = hot('structural hazard 的例子', 0.6, 6.7);
    cap('structural hazard 也可以用這個例子', '');
  },
  async (tok, S) => { // @1138.2
    S.im = cube('Instruction memory', COL.IF, [2.4, 0.6, 0.6], -2.0, 6.0, 0); S.dm = cube('Data memory', COL.MEM, [2.4, 0.6, 0.6], 2.6, 6.0, 0);
    small(S.im.userData.lbl, 9); small(S.dm.userData.lbl, 9);
    txt(S.t, '');
    S.t2 = note('現在 memory 分成兩塊：instruction memory、data memory', 0.6, 5.2);
    cap('現在 memory 分成兩塊', 'instruction memory 和 data memory');
  },
  async (tok, S) => { // @1147.8
    gone(S.im, S.dm); S.one = cube('Memory（只有一塊）', '#8a7a5c', [3.6, 0.6, 0.6], 0.3, 6.0, 0); small(S.one.userData.lbl, 9);
    txt(S.t2, '假如把兩塊變成同一塊……');
    cap('假如把兩個變成同一塊', '');
  },
  async (tok, S) => { // @1154.6
    S.g = mkGrid(S, 8, { y0: 4.4 });
    S.g.add(0, 'lw', L5(1)); ['instr 2', 'instr 3', 'instr 4'].forEach((n, k) => S.g.add(k + 1, n, L5(k + 2)));
    S.g.upto(99);
    txt(S.t2, '一個在做 data memory access，同時另一個要 instruction fetch，也要用這塊 memory');
    cap('一個在做 data memory access', '另一個已經要 fetch 指令 → 打架');
  },
  async (tok, S) => { // @1185.0
    const rows = S.g.rowsArr().map((r) => r.map(([c, s]) => [c, MEMR(s)]));
    const seen = {}; let hit = null; for (const r of rows) for (const [c, s] of r) { if (s !== 'memory') continue; if (seen[c]) hit = c; seen[c] = 1; }
    S.g.band(hit || 4, 0, 3, '#d64545'); S.g.hot(0, 4, '#7a1010'); S.g.hot(3, 4, '#7a1010');
    S.t3 = ok(hit === 4, 0.6, 1.4, 'cycle 4：lw 讀資料、instr 4 抓指令，都要用同一塊 memory → structural hazard ✓');
    cap('往右是時間：第四個 cycle', 'lw 要 data access、第四個要 fetch');
  },
  async (tok, S) => { // @1207.3
    S.g.unband(); S.g.cool(); kill(S.one);
    S.im = cube('Instruction memory', COL.IF, [2.4, 0.6, 0.6], -2.0, 6.0, 0); S.dm = cube('Data memory', COL.MEM, [2.4, 0.6, 0.6], 2.6, 6.0, 0);
    small(S.im.userData.lbl, 9); small(S.dm.userData.lbl, 9);
    gone(S.t3); S.t3 = ok(clashes(S.g.rowsArr()).length === 0, 0.6, 1.4, '拆成兩個 memory：IF 用 IM、MEM 用 DM → cycle 4 不再衝突 ✓');
    cap('解決方法：拆成兩個 memory', '一個 instruction memory、一個 data memory');
  },
  async (tok, S) => { // @1216.7
    txt(S.t2, '條件：每一個 stage 用的 resource 要不一樣');
    cap('這就是剛才講的條件', '每一個 stage 用的 resource 要不一樣');
  },
]);

// 在 datapath 上看：寫 R5 的指令往前走，後面三個依序讀 R5
scene('ppA-18a-path', '18A：在 datapath 上看 hazard：誰會讀到錯的 R5？', [
  async (tok, S) => { // @1236.2
    S.d = mkDP(S);
    S.t = note('五段之間，有往回走的 feedback path —— hazard 就從這裡來', 0, 5.6);
    cap('開始講 data hazard', '先在 datapath 上看');
  },
  async (tok, S) => { // @1245.2
    S.fb1 = arrow(V3(5.6, 4.4, 0.4), V3(-2.4, 4.4, 0.4), 0xd64545); S.fb2 = arrow(V3(2.8, -0.2, 0.4), V3(-5.6, -0.2, 0.4), 0xd64545);
    cap('分五個 stage', '最主要是這些 feedback path 造成 hazard');
  },
  async (tok, S) => { // @1256.5
    S.br = S.d.chip('beq', 3, '#7a6a52'); glow(S.d.blocks[3], COL.gold);
    txt(S.t, 'control hazard：這個 beq 要到第 4 段才決定跳不跳');
    cap('control hazard：到第四個 stage', '才可以決定到底要不要跳');
  },
  async (tok, S) => { // @1279.7
    S.gs = [0, 1, 2].map((i) => S.d.chip('猜的 ' + (3 - i), i, '#bcd8f3'));
    txt(S.t, '為了 high performance，前面三段早就各有一個 instruction —— 都是猜的');
    cap('前面這三段裡都已經有 instruction', '都是亂猜進來的');
  },
  async (tok, S) => { // @1298.4
    S.gs.forEach((m) => { tint(m, COL.bad); relabel(m, 'flush'); });
    txt(S.t, '猜對：繼續；猜錯：這以下全部沖掉（flush），從頭開始');
    cap('猜對就正常繼續', '猜錯：這以下全部要沖掉、重新開始');
  },
  async (tok, S) => { // @1315.8
    gone(S.br, S.gs); glow(S.d.blocks[3], null); S.d.chips = [];
    S.p = S.d.chip('寫 R5', 2, COL.gold);
    txt(S.t, 'data hazard：這個 instruction 執行完（EX），要到第 5 段才寫回 R5');
    cap('data hazard：我已經 execution 完了', '但要到第五個 stage 才寫回 R5');
  },
  async (tok, S) => { // @1344.3
    S.r1 = S.d.chip('讀 R5（下一個）', 1, '#4b9ee2'); glow(S.d.blocks[1], '#7a1010');
    S.x1 = bad('下一個在 register access 讀 R5 → 讀不到正確資料', -2.8, 0.2);
    cap('下一個 instruction 也要讀 R5', '會讀到正確資料嗎？不會');
  },
  async (tok, S) => { // @1351.5
    await S.d.go(tok, [[S.p, 3], [S.r1, 2]]);
    S.r2 = S.d.chip('讀 R5（下兩個）', 1, '#9b7ef4');
    txt(S.x1, '寫的人走到 MEM，下兩個在讀 R5 → 也是錯的');
    cap('我走到下一段，下兩個在讀 R5', '也不會 access 到對的資料');
  },
  async (tok, S) => { // @1404.3
    await S.d.go(tok, [[S.p, 4], [S.r1, 3], [S.r2, 2]]);
    S.r3 = S.d.chip('讀 R5（下三個）', 1, '#2fc092');
    glow(S.d.blocks[4], COL.gold);
    txt(S.x1, '寫的人在 WB「正在寫」，下三個同時在讀 —— 理論上還沒寫進去，也拿不到');
    cap('我在寫的同時，下三個在讀', '理論上也拿不到正確資料');
  },
  async (tok, S) => { // @1430.2
    S.half = cube('前半 cycle：寫 ｜ 後半 cycle：讀', '#f3d36b', [3.6, 0.42, 0.4], -1.2, -0.6, 0.4); small(S.half.userData.lbl, 9);
    txt(S.x1, 'internal forwarding：register file 在 clock 前半段（rising edge）寫、後半段才讀 → 下三個讀到新值');
    tint(S.r3, '#2fc092'); glow(S.r3, '#0f5a3a');
    cap('internal forwarding：前半段寫、後半段讀', '下三個就讀到正確資料');
  },
  async (tok, S) => { // @1479.5
    glow(S.r1, '#7a1010'); glow(S.r2, '#7a1010');
    txt(S.t, '結論：下三個 OK；但下一個、下兩個一定讀到錯的（如果它們讀的 source = R5）');
    cap('所以下三個 OK', '下一個、下兩個一定 access 到錯誤的資料');
  },
], { cam: CAM_D });

// 課本：sub $2 之後 and / or / add / sw 都讀 $2 —— 讀的 cycle 由 schedule 算
const DEP = ['sub $2, $1, $3', 'and $12, $2, $5', 'or $13, $6, $2', 'add $14, $2, $2', 'sw $15, 100($2)'];
const DEP0 = schedule(DEP.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
const RD_CYC = DEP0.rows.slice(1, 5).map((r) => r.ID), WB2 = DEP0.rows[0].WB;
scene('ppA-18a-time', '18A：時序圖：sub $2 寫回之前，誰讀到舊的 $2？', [
  async (tok, S) => { // @1515.1
    S.g = mkGrid(S, 9);
    DEP.forEach((t, k) => S.g.add(k, t, L5(k + 1)));
    S.k = sm('（課本的例子）', 4.6, 6.9);
    cap('另外一種表示方法', '意思一樣');
  },
  async (tok, S) => { // @1528.3
    S.g.upto(99);
    S.t = note('往右是 clock cycle；每列晚一格開始', 0.6, 2.2);
    cap('這是時間：clock cycle', '每個 instruction 晚一個 cycle');
  },
  async (tok, S) => { // @1571.0
    S.g.hot(0, WB2, COL.gold);
    txt(S.t, 'sub 要到 cycle ' + WB2 + ' 才寫回 $2');
    cap('sub 要到第五個 clock cycle', '才把 R2 寫回去');
  },
  async (tok, S) => { // @1585.4
    RD_CYC.forEach((c, k) => S.g.hot(k + 1, c, '#4b9ee2'));
    S.t2 = ok(RD_CYC.join() === '3,4,5,6', 0.6, 1.6, '後面四個讀 $2 的 cycle：' + RD_CYC.join('、') + ' ✓');
    cap('後面的 instruction 都要 access R2', '分別在 clock 3、4、5、6');
  },
  async (tok, S) => { // @1606.6
    RD_CYC.forEach((c, k) => { if (c < WB2) S.g.hot(k + 1, c, '#7a1010'); });
    txt(S.t, '在 cycle ' + WB2 + ' 之前讀的，都是還沒寫回的舊資料');
    cap('在寫回之前去 access', '拿到的都是錯誤（舊）的資料');
  },
  async (tok, S) => { // @1641.2
    S.g.hot(4, 6, '#0f5a3a');
    gone(S.t2); S.t2 = ok(RD_CYC[3] > WB2, 0.6, 1.6, 'cycle 6 讀（sw）：$2 已經寫好 → 正確 ✓');
    cap('到這個 register 是正確資料了', '第五個 cycle 已經寫下去');
  },
  async (tok, S) => { // @1656.6
    S.g.hot(3, 5, '#0f5a3a');
    S.t3 = ok(RD_CYC[2] === WB2, 0.6, 1.0, 'cycle 5 讀（add）：同一個 cycle 寫與讀 → internal forwarding（前半寫、後半讀）也 OK ✓');
    cap('cycle 5 有沒有問題？', '有 internal forwarding 的話就沒問題');
  },
  async (tok, S) => { // @1668.5
    const bad2 = RD_CYC.filter((c) => c < WB2).length;
    gone(S.t2, S.t3); S.t2 = ok(bad2 === 2, 0.6, 1.6, '剩下 and、or 這 ' + bad2 + ' 個會讀錯 → 這就是 data hazard ✓');
    cap('這就是 data hazard', '');
  },
]);

scene('ppA-18a-raw', '18A：read after write（RAW）hazard', [
  async (tok, S) => { // @1670.1
    S.t = hot('MIPS 會發生的：read 在 write 之後', 0.6, 6.7);
    S.g = mkGrid(S, 8, { y0: 5.4 }); S.g.add(0, 'I1：write R2', L5(1)); S.g.add(1, 'I2：read R2', L5(2)); S.g.upto(99);
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 3, '#4b9ee2');
    cap('MIPS 裡發生的 data hazard', 'read 在 write 之後');
  },
  async (tok, S) => { // @1694.3
    S.t2 = note('名字：read after write（RAW）hazard', 0.6, 3.6);
    cap('我們叫做 read after write hazard', '');
  },
  async (tok, S) => { // @1721.7
    S.t3 = sm('data hazard 其實有三種：RAW、WAR、WAW', 0.6, 3.0);
    cap('總共有三種 data hazard', '');
  },
  async (tok, S) => { // @1736.6
    S.n1 = note('第一個 instruction 叫 I1、第二個叫 I2', 0.6, 2.4);
    cap('第一個叫 I1、第二個叫 I2', '這裡容易 confuse，看清楚');
  },
  async (tok, S) => { // @1744.9
    txt(S.n1, 'RAW：I1 先 write、I2 後 read —— I2 depend on I1 寫的資料');
    S.g.hot(1, 3, '#7a1010');
    txt(S.t3, 'hazard：I1 還沒寫進去，I2 就先 read 了（cycle 3 < cycle 5）');
    cap('read after write：I2 讀 I1 寫的', '還沒寫進去就先讀 → RAW hazard');
  },
  async (tok, S) => { // @1810.9
    S.ok1 = ok(3 < 5, 0.6, 1.6, 'MIPS 會發生 RAW：讀在第 2 段、寫在第 5 段 ✓');
    cap('這是 MIPS 會發生的狀況', 'try to read before I1 writes it');
  },
  async (tok, S) => { // @1825.7
    gone(S.g, S.t2, S.t3, S.n1, S.ok1);
    S.t2 = note('第二種：write after read（WAR）—— I1 是 read、I2 是 write', 0.6, 5.6);
    cap('第二種：write after read', '前面是 read、後面是 write');
  },
  async (tok, S) => { // @1843.7
    S.t3 = hot('為什麼會發生 hazard？', 0.6, 4.8);
    cap('那為什麼會發生 hazard？', '');
  },
]);

scene('ppA-18a-warwaw', '18A：WAR、WAW 在 MIPS 為什麼不會發生', [
  async (tok, S) => { // @1920.6
    S.t = hot('write after read（WAR）', 0.6, 6.7);
    S.g = mkGrid(S, 8, { y0: 5.6 }); S.g.add(0, 'I1：read R3', L5(1)); S.g.add(1, 'I2：write R3', L5(2)); S.g.upto(99);
    cap('什麼叫 write after read？', '');
  },
  async (tok, S) => { // @1933.3
    S.t2 = note('I1 應該讀到「舊」的 R3；hazard = I2 搶先寫下去，I1 讀到新的', 0.6, 3.8);
    cap('本來應該讀到舊的 data', 'write 搶先寫下去 → 讀到新的，錯了');
  },
  async (tok, S) => { // @1967.1
    S.t3 = sm('通常發生在 auto increment（位址自動加）的指令；MIPS 沒有這種指令', 0.6, 3.2);
    cap('通常發生在 auto increment', '我們這邊沒有這種指令');
  },
  async (tok, S) => { // @1987.7
    S.g.hot(0, 2, '#4b9ee2'); S.g.hot(1, 6, COL.gold);
    txt(S.t2, 'MIPS：write 永遠在第 5 段、read 在第 2 段');
    cap('我們的 write 永遠在第五個 stage', '');
  },
  async (tok, S) => { // @2016.5
    const rd1 = 2, wr2 = 2 + 4;
    S.ok1 = ok(wr2 > rd1, 0.6, 2.4, 'I1 cycle ' + rd1 + ' 讀、I2 晚一個 cycle 又在最後一段才寫（cycle ' + wr2 + '）→ 不可能搶先 ✓');
    cap('後一個 instruction 晚一個 cycle', '又在最後一個 stage 才寫');
  },
  async (tok, S) => { // @2082.9
    txt(S.t3, '所以 WAR 在 MIPS 不可能發生');
    cap('所以 write after read', '在 MIPS 不可能發生');
  },
  async (tok, S) => { // @2094.0
    gone(S.ok1); S.g.cool(); S.g.label(0, 'I1：write R3'); S.g.label(1, 'I2：write R3');
    txt(S.t, 'write after write（WAW）');
    txt(S.t2, 'I1、I2 都寫同一個 register：最後應該是 I2 寫的（比較新）');
    txt(S.t3, '');
    cap('再來：write after write', '兩個都寫同一個 register');
  },
  async (tok, S) => { // @2137.0
    S.v1 = cube('5', '#bcd8f3', [0.5, 0.4, 0.4], S.g.cx(5), S.g.cy(0) + 0.42, 0.3); S.v2 = cube('6', '#f3d36b', [0.5, 0.4, 0.4], S.g.cx(6), S.g.cy(1) + 0.42, 0.3);
    txt(S.t3, 'I1 寫 5、I2 寫 6 → 答案應該是 6；若 6 搶先寫、5 後寫 → 最後變 5，錯了');
    cap('第一個寫 5、第二個寫 6', '應該是 6；6 搶先寫的話就錯了');
  },
  async (tok, S) => { // @2151.7
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 6, COL.gold);
    S.ok1 = ok(5 < 6, 0.6, 2.4, '都在第 5 段寫：I1 在 cycle 5、I2 在 cycle 6 → 順序不會顛倒 ✓ MIPS 沒有 WAW');
    cap('這也不會在 MIPS 發生', '大家都第五個 stage 寫，I1 永遠先寫');
  },
]);

// ════════ XtcJtp7n4o8（第19A講：複習、structural hazard、sub $2 的 data hazard、RAW/WAR/WAW、internal forwarding、nop、forwarding datapath 與條件） ════════
// forwarding 的 datapath 小圖：ID/EX → 兩個 3-to-1 mux → ALU → EX/MEM → DM → MEM/WB，下面一個 forwarding unit
function mkFwd(S, o = {}) {
  const F = { ex: [], ln: {}, tg: {} };
  const bar = (x, n) => { const m = cube('', COL.reg, [0.3, 3.8, 0.6], x, 3.2, 0); F.ex.push(m, small(tag(n, 'idx', x, 0.95 + (o.low ? -0.1 : 0)), 9)); return m; };
  F.idex = bar(-4.6, 'ID/EX'); F.exmem = bar(1.8, 'EX/MEM'); F.memwb = bar(4.9, 'MEM/WB');
  F.muxA = cube('A', '#8a7a5c', [0.45, 1.0, 0.5], -2.7, 4.3, 0); F.muxB = cube('B', '#8a7a5c', [0.45, 1.0, 0.5], -2.7, 2.2, 0);
  F.alu = cube('ALU', COL.EX, [1.0, 2.6, 0.6], -0.8, 3.25, 0); F.dm = cube('DM', COL.MEM, [0.9, 1.0, 0.6], 3.35, 3.2, 0);
  F.ex.push(F.muxA, F.muxB, F.alu, F.dm);
  const L = (pts, c = '#8a7a5c') => { const l = line(pts.map((p) => [p[0], p[1], 0.1]), c); F.ex.push(l); return l; };
  L([[-4.45, 4.5], [-2.95, 4.5]]); L([[-4.45, 2.4], [-2.95, 2.4]]); L([[-2.45, 4.3], [-1.3, 4.0]]); L([[-2.45, 2.2], [-1.3, 2.5]]);
  L([[-0.3, 3.25], [1.65, 3.25]]); L([[1.95, 3.25], [2.9, 3.25]]); L([[3.8, 3.25], [4.75, 3.25]]); L([[1.95, 4.6], [4.75, 4.6]]);
  const G = '#d8cfc0';
  F.ln.EA = L([[2.05, 2.6], [2.25, 2.6], [2.25, 0.6], [-3.3, 0.6], [-3.3, 4.3], [-2.95, 4.3]], G);
  F.ln.EB = L([[-3.3, 2.2], [-2.95, 2.2]], G);
  F.ln.WA = L([[5.15, 2.6], [5.35, 2.6], [5.35, 0.25], [-3.6, 0.25], [-3.6, 4.1], [-2.95, 4.1]], G);
  F.ln.WB = L([[-3.6, 2.0], [-2.95, 2.0]], G);
  [['00', 4.5], ['10', 4.3], ['01', 4.1], ['00', 2.4], ['10', 2.2], ['01', 2.0]].forEach(([t, y]) => F.ex.push(small(tag(t, 'idx', -3.95, y), 8)));
  if (o.unit !== false) { F.unit = cube('Forwarding unit', '#a99470', [2.6, 0.5, 0.6], -0.8, -0.45, 0); small(F.unit.userData.lbl, 9); F.ex.push(F.unit); }
  F.lab = {};
  F.put = (which, text) => { const x = { idex: -4.6, exmem: 1.8, memwb: 4.9 }[which]; if (F.lab[which]) remove(F.lab[which]); F.lab[which] = mono(tag(text, '', x, 5.55 + (which === 'exmem' ? 0.45 : 0)), 10); return F.lab[which]; };
  F.sel = (ab, code) => {
    const em = ab === 'A' ? F.ln.EA : F.ln.EB, wb = ab === 'A' ? F.ln.WA : F.ln.WB, mux = ab === 'A' ? F.muxA : F.muxB;
    // shared trunks: EB/WB branch from the A trunk, so colour the trunk too when B uses it
    em.material.color.set(code === '10' ? '#d68a00' : G); wb.material.color.set(code === '01' ? '#d68a00' : G);
    if (ab === 'B' && code === '10') F.ln.EA.material.color.set('#d68a00');
    if (ab === 'B' && code === '01') F.ln.WA.material.color.set('#d68a00');
    glow(mux, code !== '00' ? COL.gold : null);
    if (F.tg[ab]) remove(F.tg[ab]);
    F.tg[ab] = small(tag('Forward' + ab + ' = ' + code, code !== '00' ? 'ptr alt' : 'ptr', -2.7, ab === 'A' ? 5.15 : 1.4), 10);
  };
  F.reset = () => { Object.values(F.ln).forEach((l) => l.material.color.set(G)); glow(F.muxA, null); glow(F.muxB, null); Object.values(F.tg).forEach(remove); F.tg = {}; };
  F.all = () => [...F.ex, ...Object.values(F.lab), ...Object.values(F.tg)];
  return F;
}
const CAM_F = [[0.2, 3.0, 13.2], [0.2, 2.8, 0]];

scene('ppA-19a-review', '19A：複習：single cycle → pipeline，latency 與 throughput', [
  async (tok, S) => { // @18.1
    S.t = note('pipeline：high performance —— 同一時間很多 instruction 一起做', 0.6, 6.7);
    cap('pipeline：為了 high performance', '同一時間很多 instruction 同時做');
  },
  async (tok, S) => { // @22.3
    S.sc = cube('一個 instruction：一個 cycle 全部做完', '#bcd8f3', [7.6, 0.55, 0.5], -0.6, 5.6, 0); small(S.sc.userData.lbl, 9);
    S.l1 = sm('single cycle', -5.6, 5.6);
    cap('single cycle：一個 instruction 一個 cycle', '執行完畢，下一個再來');
  },
  async (tok, S) => { // @56.4
    S.parts = FIVE.map((s, i) => { const m = cube(s, COL[s], [1.45, 0.42, 0.5], -3.7 + i * 1.55, 4.8, 0); small(m.userData.lbl, 9); return m; });
    S.parts.forEach((m, i) => { if (i !== 2) glow(m, '#555555'); });
    txt(S.t, '一個 cycle 裡，前後各段的硬體其實大部分時間都閒著（示意：只有 EX 在忙）');
    cap('其實執行前、執行後', '很多 resource 根本不需要一直佔著');
  },
  async (tok, S) => { // @61.2
    S.parts.forEach((m) => glow(m, null));
    S.g = mkGrid(S, 8, { y0: 3.6, dy: 0.5 });
    [0, 1, 2].forEach((k) => S.g.add(k, 'instruction ' + (k + 1), L5(k + 1))); S.g.upto(99);
    txt(S.t, '改成 pipeline implementation：把要做的事切成很多個 stage，錯開做');
    cap('所以改用 pipeline implementation', '分成很多個 stage');
  },
  async (tok, S) => { // @82.0
    gone(S.sc, S.l1, S.parts);
    S.regs = [0, 1, 2, 3].map((i) => { const m = cube('', COL.reg, [0.14, 0.7, 0.5], -3.7 + i * 1.55 + 0.775, 5.6, 0); return m; });
    S.parts = FIVE.map((s, i) => { const m = cube(s, COL[s], [1.3, 0.42, 0.5], -3.7 + i * 1.55, 5.6, 0); small(m.userData.lbl, 9); return m; });
    txt(S.t, 'pipeline 的 datapath 最重要：加 pipeline register');
    cap('pipeline 的 datapath 最重要的是', '加 pipeline register');
  },
  async (tok, S) => { // @91.8
    S.regs.forEach((r) => glow(r, COL.gold));
    S.c4 = ok(S.regs.length === FIVE.length - 1, 0.6, 6.2, '切成 5 個 stage → 中間加 4 個 pipeline register ✓');
    cap('切成五個 stage', '中間加四個 pipeline register');
  },
  async (tok, S) => { // @98.3
    gone(S.c4);
    txt(S.t, '每個 clock cycle 比較短：每段做完存起來，下一個 clock 再做下一段');
    cap('每個 clock cycle 都比較短', '每個 cycle 把東西存起來，下個 clock 再做');
  },
  async (tok, S) => { // @115.3
    S.a = arrow(V3(S.g.cx(1) - 0.35, S.g.cy(0) + 0.35, 0.4), V3(S.g.cx(5) + 0.35, S.g.cy(0) + 0.35, 0.4), 0x7a1010);
    txt(S.t, '能改善 response time（latency）嗎？不行 —— 還是要經過 5 個 stage');
    cap('pipeline 能改善 latency 嗎？', '不行，還是要經過五個 stage');
  },
  async (tok, S) => { // @128.9
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 6, COL.gold); S.g.hot(2, 7, COL.gold);
    txt(S.t, '加快的是 throughput：單位時間完成的工作變多（每個 cycle 完成一個）');
    cap('它加快的是 throughput', '單位時間可以完成的工作');
  },
  async (tok, S) => { // @135.6
    gone(S.a); S.g.cool();
    txt(S.t, 'control：跟 single cycle 一樣 decode 出 control signal，但不是一次用完');
    cap('control 的部分呢？', '一樣 decode，但不是一次用完');
  },
  async (tok, S) => { // @178.4
    const x0 = -3.7 + 1.55, tx = [2, 3, 4].map((i) => -3.7 + i * 1.55);
    S.cg = ['EX', 'M', 'WB'].map((n, i) => { const m = cube(n, { WB: '#f2b8d2', M: '#b8ead6', EX: '#f6cfa6' }[n], [0.55, 0.32, 0.4], x0, 6.25 - i * 0.0, 0.3); small(m.userData.lbl, 9); return m; });
    await anim(tok, 1200, (u) => S.cg.forEach((m, i) => { m.position.x = x0 + (tx[i] - x0) * u; }));
    txt(S.t, 'decode 那段就產生 control signal，隨著 pipeline 一段一段往下傳');
    cap('把 control signal 往下傳', 'decode 時產生，隨 pipeline 一直往下 flow');
  },
]);

scene('ppA-19a-five', '19A：五個 stage 與三種 hazard', [
  async (tok, S) => { // @212.5
    S.g = mkGrid(S, 9, { y0: 5.9, dy: 0.56 });
    S.t = note('MIPS 的 pipeline：5 個 stage（一定要記得，不然後面沒辦法算）', 0.6, 1.4);
    cap('MIPS 的 pipeline 分幾個 stage？', '五個 stage，一定要記得');
  },
  async (tok, S) => { // @245.7
    S.g.add(0, 'instruction 1', [[1, 'IF']]); S.g.row(0); txt(S.t, '① instruction fetch');
    cap('第一個：instruction fetch', '');
  },
  async (tok, S) => { // @257.7
    S.g.add(0, null, [[2, 'ID']]); S.g.row(0); txt(S.t, '② instruction decode，同時做 register access（rs、rt、rd 都知道了）');
    cap('再來：instruction decode', '同時做 register access');
  },
  async (tok, S) => { // @273.4
    S.g.add(0, null, [[3, 'EX']]); S.g.row(0); txt(S.t, '③ execution：ALU 運算（R-type 加減；load / store 算位址）');
    cap('第三個 stage：execution', 'ALU 運算，或算 memory address');
  },
  async (tok, S) => { // @289.2
    S.g.add(0, null, [[4, 'MEM']]); S.g.row(0); txt(S.t, '④ memory access');
    cap('第四個 stage：memory access', '');
  },
  async (tok, S) => { // @291.7
    S.g.add(0, null, [[5, 'WB']]); S.g.row(0); txt(S.t, '⑤ write back：資料寫回 register file');
    cap('第五個 stage：write back', '寫回 register file');
  },
  async (tok, S) => { // @297.4
    S.g.add(1, 'instruction 2', L5(2)); S.g.add(2, 'instruction 3', L5(3)); S.g.upto(3);
    txt(S.t, '第 1 個到第 2 段時，第 1 段空出來 → 第 2 個進來；每個都晚前一個一步');
    cap('第一個到第二個 stage', 'resource 空出來，第二個就進來');
  },
  async (tok, S) => { // @320.3
    S.g.add(3, 'instruction 4', L5(4)); S.g.add(4, 'instruction 5', L5(5)); S.g.upto(99); S.g.band(5, 0, 4);
    txt(S.t, '同一個時間可以執行 5 個 instruction → throughput 加快');
    cap('同一時間可以執行五個 instruction', '就可以加快 throughput');
  },
  async (tok, S) => { // @324.8
    S.g.unband();
    txt(S.t, '但要注意 hazard：structural、data、control 三種');
    cap('但要注意有些 hazard 會產生', 'structural、data、control hazard');
  },
  async (tok, S) => { // @334.3
    txt(S.t, 'structural hazard：用我們的方法（同一資源同一段用）已經解決了');
    cap('structural hazard', '用我們的方法可以解決');
  },
  async (tok, S) => { // @337.2
    txt(S.t, 'data hazard、control hazard：instruction 跟 instruction 之間有 dependency');
    cap('data hazard、control hazard', '主要是 instruction 之間有 dependency');
  },
  async (tok, S) => { // @388.1
    S.g.label(0, 'I1：write R2'); S.g.label(1, 'I2：read R2'); S.g.hot(0, 5, COL.gold); S.g.hot(1, 3, '#4b9ee2');
    txt(S.t, 'dependency 一定牽涉 write：兩個都只讀沒關係；有寫，就會改變 state');
    cap('dependency 一定牽涉到 write', '都只讀不會有問題；寫會改變 state');
  },
  async (tok, S) => { // @412.6
    S.g.cool(); S.g.label(0, 'beq'); S.g.label(1, '下一個 = ？');
    txt(S.t, 'control hazard：beq 才到第 2 段就要 fetch 下一個，還不知道是誰 → 只好猜');
    cap('control hazard：才到第二個 stage', '就要 fetch 下一個 → 只好猜');
  },
]);

scene('ppA-19a-struct', '19A：structural hazard 複習：同一塊 memory', [
  async (tok, S) => { // @443.3
    S.t = hot('structural hazard（已經解決的那一種）', 0.6, 6.7);
    cap('再看一下 structural hazard', '');
  },
  async (tok, S) => { // @480.6
    S.t2 = note('兩個 instruction 同時要搶同一個 resource', 0.6, 6.0);
    cap('什麼叫 structural hazard？', '兩個 instruction 搶同一個 resource');
  },
  async (tok, S) => { // @492.8
    S.g = mkGrid(S, 8, { y0: 4.9 });
    S.g.add(0, 'instruction 1', L5(1)); ['instruction 2', 'instruction 3', 'instruction 4'].forEach((n, k) => S.g.add(k + 1, n, L5(k + 2))); S.g.upto(99);
    S.g.hot(0, 4, COL.MEM); S.g.hot(3, 4, COL.IF);
    S.t3 = note('例：第 4 段要 access data memory、第 1 段要 instruction fetch', 0.6, 1.8);
    cap('例如第四個 stage 要 access data memory', '第一個 stage 要做 instruction fetch');
  },
  async (tok, S) => { // @518.1
    const rows = S.g.rowsArr().map((r) => r.map(([c, s]) => [c, MEMR(s)]));
    let hit = 0; const seen = {}; for (const r of rows) for (const [c, s] of r) if (s === 'memory') { if (seen[c]) hit = c; seen[c] = 1; }
    S.g.band(hit, 0, 3, '#d64545');
    S.t4 = ok(hit === 4, 0.6, 1.2, '若 IM、DM 是同一塊 memory：cycle 4 兩個搶它 → structural hazard ✓');
    cap('如果是同一個 memory', '同一個時間就打架了');
  },
  async (tok, S) => { // @532.2
    S.g.unband(); gone(S.t4);
    S.t4 = ok(clashes(S.g.rowsArr()).length === 0, 0.6, 1.2, '解法：每個 stage 都用不同的 resource（IM、DM 分開）→ 沒有衝突 ✓');
    cap('解決方法很簡單', '每一個 stage 都用不同的 resource');
  },
  async (tok, S) => { // @544.4
    txt(S.t3, '後一個永遠晚一個 cycle：你用完就給我用 → 大家不會打架');
    cap('我永遠晚你一個 clock cycle', '你用完就給我，就不會打架');
  },
]);

// 課本 sub $2 的例子（DEP / DEP0 / RD_CYC / WB2 在 18A 已算好）
scene('ppA-19a-dep', '19A：data hazard：sub 寫 $2，後面三個讀錯', [
  async (tok, S) => { // @577.8
    S.g = mkGrid(S, 9);
    S.t = note('data hazard：以這個例子來看（課本）', 0.6, 2.4);
    cap('什麼叫 data hazard？', '以這個例子來看');
  },
  async (tok, S) => { // @586.9
    S.g.add(0, DEP[0], L5(1)); S.g.row(0);
    txt(S.t, '第一個 instruction（sub）要把結果寫到 register 2');
    cap('第一個 instruction', '要把東西寫到 register 2');
  },
  async (tok, S) => { // @592.2
    DEP.slice(1).forEach((t, k) => S.g.add(k + 1, t, L5(k + 2))); S.g.upto(99);
    txt(S.t, '後面緊接的好多個 instruction 都要讀 register 2 —— 誰會讀到正確的？');
    cap('後面緊接的好多個都要讀它', '到底誰會得到正確的資料？');
  },
  async (tok, S) => { // @615.6
    txt(S.t, '看時間：第一個從 cycle 1 開始，後面每個晚一個 cycle');
    cap('看一下時間', '第一個從第一個 clock 開始');
  },
  async (tok, S) => { // @628.5
    S.g.hot(0, WB2, COL.gold);
    txt(S.t, 'sub 要到 cycle ' + WB2 + '（第 5 段）才寫回 register 2');
    cap('它要到第五個 clock', '才會寫回 register');
  },
  async (tok, S) => { // @653.3
    S.g.hot(1, RD_CYC[0], '#7a1010');
    txt(S.t, 'and：cycle ' + RD_CYC[0] + ' 做 register access 時還沒寫進去 → 拿到舊的、錯的');
    cap('第二個 instruction 做 register access 時', '還沒寫進去 → 拿到不對的資料');
  },
  async (tok, S) => { // @685.3
    S.g.hot(2, RD_CYC[1], '#7a1010');
    txt(S.t, 'or：cycle ' + RD_CYC[1] + ' 讀，也還沒寫進去');
    cap('再看晚兩個的 instruction', '第四個 cycle 讀，也還沒寫進去');
  },
  async (tok, S) => { // @695.1
    S.g.hot(3, RD_CYC[2], '#c08a1f'); S.g.hot(0, WB2, '#c08a1f');
    txt(S.t, 'add：cycle ' + RD_CYC[2] + ' 讀的時候，sub「正在寫」—— 寫進去了沒？');
    cap('第五個 cycle：讀的時候它正在寫', '寫進去了沒？');
  },
  async (tok, S) => { // @713.8
    S.g.hot(3, RD_CYC[2], '#7a1010'); S.g.hot(4, RD_CYC[3], '#0f5a3a');
    const nBad = RD_CYC.filter((c) => c <= WB2).length;
    S.t2 = ok(nBad === 3, 0.6, 1.7, '不靠任何技巧時：cycle 3、4、5 讀的這 ' + nBad + ' 個都拿不到新的 $2；cycle 6 的 sw 才對 ✓');
    cap('這三個是不對的', '因為 data dependence 拿到錯誤資料');
  },
  async (tok, S) => { // @730.5
    gone(S.t2);
    txt(S.t, '這只是其中一種 hazard，其實有很多種');
    cap('剛才只看到其中一種 hazard', '其實有很多種');
  },
]);

scene('ppA-19a-raw', '19A：read after write：MIPS 會發生', [
  async (tok, S) => { // @736.7
    S.g = mkGrid(S, 8, { y0: 5.4 }); S.t = hot('第一種：read after write（RAW）', 0.6, 6.7);
    cap('第一種叫 read after write', '不要死背');
  },
  async (tok, S) => { // @759.3
    S.g.add(0, 'I1：write', L5(1)); S.g.add(1, 'I2：read', L5(2)); S.g.upto(99); S.g.hot(0, 5, COL.gold); S.g.hot(1, 3, '#4b9ee2');
    S.t2 = note('前面的 instruction 是 write、後面的是 read', 0.6, 3.6);
    cap('上面的 instruction 是 write', '下面的 instruction 是 read');
  },
  async (tok, S) => { // @783.1
    S.g.hot(1, 3, '#7a1010');
    txt(S.t2, '應該 write 完才 read；hazard：write 還沒寫進去，read 就先讀了');
    cap('應該 write 完我才去 read', 'write 還沒寫進去就先讀 → RAW hazard');
  },
  async (tok, S) => { // @817.0
    S.t3 = hot('MIPS 會不會產生 RAW hazard？', 0.6, 2.8);
    cap('MIPS 會不會產生這樣的 hazard？', '');
  },
  async (tok, S) => { // @841.1
    txt(S.t3, '');
    S.t4 = ok(RD_CYC.filter((c) => c <= WB2).length === 3, 0.6, 2.8, '會：剛才 sub 寫 $2，後面三個都拿到錯的 ✓');
    cap('會！剛才就已經 demonstrate 了', 'write 之後馬上 read → 拿到錯誤資料');
  },
]);

scene('ppA-19a-warwaw', '19A：WAR、WAW 不會發生在 MIPS', [
  async (tok, S) => { // @854.4
    S.g = mkGrid(S, 8, { y0: 5.4 }); S.t = hot('write after read（WAR）', 0.6, 6.7);
    S.g.add(0, 'I1：read R', L5(1)); S.g.add(1, 'I2：write R', L5(2)); S.g.upto(99); S.g.hot(0, 2, '#4b9ee2'); S.g.hot(1, 6, COL.gold);
    cap('再來：write after read', 'read 在前面、write 在後面');
  },
  async (tok, S) => { // @878.1
    S.t2 = note('應該 I1 讀完、I2 再寫；hazard：I2 搶先寫，把舊資料蓋掉 → I1 讀錯', 0.6, 3.6);
    cap('人家還沒 read', '後面的就搶先 write 下去 → hazard');
  },
  async (tok, S) => { // @904.2
    S.t3 = sm('會發生在 auto increment index 這類指令；MIPS 沒有', 0.6, 3.0);
    cap('像 auto increment 的指令才會發生', 'MIPS 沒有');
  },
  async (tok, S) => { // @916.4
    S.t4 = hot('MIPS 會不會？write 能搶到 read 前面嗎？', 0.6, 2.3);
    cap('在 MIPS 會不會發生？', '');
  },
  async (tok, S) => { // @939.5
    gone(S.t4); S.t4 = ok(2 + 4 > 2, 0.6, 2.3, '不會：I2 一定在第 5 段寫（cycle 6），I1 早在第 2 段（cycle 2）讀完 ✓');
    cap('不會：後面的一定在第五個 stage write', '前面的在第二個 stage 就 read 了');
  },
  async (tok, S) => { // @976.2
    gone(S.t2, S.t3, S.t4); S.g.cool(); S.g.label(0, 'I1：write R'); S.g.label(1, 'I2：write R');
    txt(S.t, 'write after write（WAW）');
    cap('再來：write after write', '就是兩個 write');
  },
  async (tok, S) => { // @981.3
    S.v1 = cube('3', '#bcd8f3', [0.5, 0.4, 0.4], S.g.cx(5), S.g.cy(0) + 0.42, 0.3); S.v2 = cube('5', '#f3d36b', [0.5, 0.4, 0.4], S.g.cx(6), S.g.cy(1) + 0.42, 0.3);
    S.t2 = note('I1 寫 3、I2 寫 5 → 最後應該是 5', 0.6, 3.6);
    cap('第一個寫 3、第二個寫 5', '最後的資料應該是 5');
  },
  async (tok, S) => { // @987.5
    txt(S.t2, 'hazard：後面的先寫進去（先 5 再 3）→ 最後變成 3，錯了');
    cap('hazard：後面的先寫進去', '先寫 5 再寫 3，資料就不一樣');
  },
  async (tok, S) => { // @995.0
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 6, COL.gold);
    S.t3 = ok(5 < 6, 0.6, 3.0, 'MIPS 不會：大家都在第 5 段寫，I1 永遠早一個 cycle（5 < 6）✓');
    cap('MIPS 會不會發生？不會', '大家都在第五個 stage 寫，你永遠快一步');
  },
  async (tok, S) => { // @1025.3
    gone(S.v1, S.v2, S.t2, S.t3);
    S.t2 = good('三種 data hazard 裡，只有 read after write 會發生在 MIPS', 0.6, 3.4);
    cap('三種 data hazard', '只有 read after write 會發生在 MIPS');
  },
  async (tok, S) => { // @1034.6
    S.g.dropRow(0); S.g.dropRow(1);
    S.g.add(0, 'RAW：I1 寫', L5(1)); S.g.add(1, '　　 I2 讀', L5(2)); S.g.upto(99);
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 3, '#7a1010');
    S.a = arrow(V3(S.g.cx(5), S.g.cy(0) - 0.2, 0.4), V3(S.g.cx(3) + 0.2, S.g.cy(1) + 0.2, 0.4), 0xd64545);
    txt(S.t2, '用時間軸看：箭頭往左（時間倒流）的依賴就是 hazard —— 只有 RAW 長這樣');
    cap('用這個圖看：往右是時間', '前面應該先寫，下一個已經要拿了');
  },
  async (tok, S) => { // @1116.2
    gone(S.a);
    txt(S.t2, '防 WAR：operand 在 ID（第 2 段）就讀；防 WAW：寫都排在最後一段 → MIPS 的設計讓它們不會發生');
    cap('operand 在 decode 階段就讀、write 在最後', 'WAR、WAW 就絕對不會發生');
  },
]);

scene('ppA-19a-intfwd', '19A：internal forwarding：前半寫、後半讀', [
  async (tok, S) => { // @1144.2
    S.g = mkGrid(S, 9);
    DEP.forEach((t, k) => S.g.add(k, t, L5(k + 1))); S.g.upto(99);
    S.t = hot('什麼叫 internal forwarding？', 0.6, 2.2);
    cap('什麼叫 internal forwarding？', '');
  },
  async (tok, S) => { // @1146.9
    RD_CYC.forEach((c, k) => { if (c <= WB2) S.g.hot(k + 1, c, '#7a1010'); });
    S.t2 = note('剛才有三個 instruction 拿不到 data', 0.6, 1.5);
    cap('剛才看到有三個 instruction', '拿不到 data');
  },
  async (tok, S) => { // @1151.4
    S.g.band(WB2, 0, 3); S.g.hot(0, WB2, COL.gold);
    txt(S.t2, '第三個（add）：sub 在寫的同一個 cycle，它同時要讀');
    cap('第三個：它在寫的時候', '同時要去讀');
  },
  async (tok, S) => { // @1176.2
    S.g.unband();
    S.ck = [0, 1].map((i) => cube(i ? '後半：讀' : '前半：寫', i ? '#bcd8f3' : '#f3d36b', [1.5, 0.45, 0.4], 1.0 + i * 1.55, 0.6, 0.3)); S.ck.forEach((m) => small(m.userData.lbl, 9));
    S.edge = sm('clock rising edge ↑ 一來就寫進去（edge trigger）', 1.8, 0.0);
    txt(S.t2, '設計成：clock 一開始（edge trigger）就寫進去');
    cap('把它設計成 clock 一開始就寫進去', 'edge trigger');
  },
  async (tok, S) => { // @1188.8
    txt(S.t2, '讀的那一邊：clock 一來就開始 read，剛開始可能是舊 data');
    cap('read 一開始可能讀到舊的 data', '');
  },
  async (tok, S) => { // @1197.2
    glow(S.ck[1], '#0f5a3a');
    txt(S.t2, '等到下半個 clock，前面已經寫進去了 → 讀到正確資料');
    cap('到下半個 clock', '前面已經寫進去 → 讀到正確的資料');
  },
  async (tok, S) => { // @1228.0
    S.g.hot(3, RD_CYC[2], '#0f5a3a');
    S.t3 = ok(RD_CYC[2] === WB2, 0.6, -0.6, '有 internal forwarding：同一個 cycle 寫與讀的 add 解決了 ✓');
    cap('有 internal forwarding', '這個 hazard 就解決了');
  },
  async (tok, S) => { // @1234.2
    const left = RD_CYC.filter((c) => c < WB2).length;
    gone(S.t3); S.t3 = ok(left === 2, 0.6, -0.6, '還剩 and、or 這 ' + left + ' 個怎麼辦？ ✓');
    cap('現在剩下這兩個 instruction', '怎麼辦？');
  },
]);

// 軟體解法：compiler 在 sub 後面插兩個 nop；和 forwarding 比總 cycle
const NOPP = ['sub $2, $1, $3', 'nop', 'nop', 'and $12, $2, $5', 'or $13, $6, $2', 'add $14, $2, $2', 'sw $15, 100($2)'];
const NOP0 = schedule(NOPP.map((t) => parseIns(t)), { fwd: false, br: 'pnt', mem1: false });
const FWD0 = schedule(DEP.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
scene('ppA-19a-nop', '19A：compiler 插 no-op（軟體解法）', [
  async (tok, S) => { // @1252.4
    S.t = hot('有哪些方法？第一個：compiler insert no-op', 0.6, 6.7);
    cap('有哪些方法可以解決？', 'compiler insert no-op');
  },
  async (tok, S) => { // @1257.4
    S.t2 = note('受影響的是後面兩個：差兩個 clock cycle 來不及', 0.6, 6.1);
    cap('後面兩個 instruction 來不及拿到資料', '差兩個 clock cycle');
  },
  async (tok, S) => { // @1265.5
    S.t3 = note('看到 dependency，就在那個 instruction 後面插 no-op（什麼都不做）', 0.6, 5.5);
    cap('看到 dependency 的關係', '就在後面 insert no-op');
  },
  async (tok, S) => { // @1297.5
    S.t4 = bad('很簡單，用 software 就做得出來 —— 但浪費時間', 0.6, 4.9);
    cap('很簡單，用 software 就能做', '但是浪費時間');
  },
  async (tok, S) => { // @1315.3
    S.t5 = good('所以要做 forwarding', 0.6, 4.3);
    cap('所以我們要做 forwarding', '');
  },
  async (tok, S) => { // @1316.6
    S.t6 = note('另一種狀況要 stall（停）：data dependency 時有兩種處理 —— forwarding 與 stall', 0.6, 3.7);
    cap('另外一種狀況叫 stall', '有兩種情形：forwarding、stall');
  },
  async (tok, S) => { // @1335.2
    gone(S.t2, S.t3, S.t4, S.t5, S.t6);
    S.g = mkGrid(S, 11, { y0: 5.9, dy: 0.5 });
    txt(S.t, 'software solution：sub 之後要用 $2，至少等兩個 clock cycle');
    DEP.forEach((t, k) => S.g.add(k, t, L5(k + 1))); S.g.upto(99);
    S.g.hot(0, 5, COL.gold); S.g.hot(1, 3, '#7a1010'); S.g.hot(2, 4, '#7a1010');
    cap('先看 software solution', '要用 $2，至少要等兩個 cycle');
  },
  async (tok, S) => { // @1343.5
    S.t2 = note('and 要在 cycle 5（sub 寫回的那個 cycle，前寫後讀）才讀得到 → 要往後挪 2 個 cycle', 0.6, 2.1);
    cap('至少要等兩個 clock cycle', '才拿得到');
  },
  async (tok, S) => { // @1356.4
    S.g.all().filter((o) => !S.g.ex.includes(o)).forEach((o) => (o.element ? remove(o) : kill(o)));
    S.g.cells = {}; S.g.labs = {}; S.g.plan = [];
    schedRows(NOP0).forEach((r, k) => S.g.add(k, r.text, r.cells.map(([c, s]) => [c, r.text === 'nop' ? 'nop' : s, r.text === 'nop' ? '—' : s])));
    S.g.upto(99);
    const andRow = NOP0.rows[3];
    gone(S.t2); S.t2 = ok(andRow.ID === NOP0.rows[0].WB && NOP0.stalls === 0 && NOP0.total === 11, 0.6, 1.6, '插兩個 nop：and 的 ID 在 cycle ' + andRow.ID + ' = sub 寫回的 cycle → 讀對；共 ' + NOP0.total + ' 個 cycle ✓');
    cap('compiler 就在這邊加兩個 no-op', 'no operation，什麼都不做');
  },
  async (tok, S) => { // @1367.6
    S.t3 = ok(FWD0.total === 9 && NOP0.total - FWD0.total === 2, 0.6, 1.0, '對照：用 hardware forwarding 不必插 nop → 9 個 cycle，省下 ' + (NOP0.total - FWD0.total) + ' 個 ✓');
    cap('但是浪費 cycle', '希望透過 hardware 來解決');
  },
]);

// forwarding 的概念：sub 的結果 cycle 3 算好，cycle 4 在 EX/MEM、cycle 5 在 MEM/WB
scene('ppA-19a-fwd', '19A：forwarding：結果早就算好，放在 pipeline register 裡', [
  async (tok, S) => { // @1373.0
    S.g = mkGrid(S, 9);
    DEP.slice(0, 4).forEach((t, k) => S.g.add(k, t, L5(k + 1))); S.g.upto(99);
    S.t = hot('什麼叫 forwarding？', 0.6, 2.6);
    cap('什麼叫 forwarding？', '再仔細看一下');
  },
  async (tok, S) => { // @1379.5
    S.g.hot(1, 4, '#7a1010'); S.g.hot(2, 5, '#7a1010');
    S.t2 = note('有問題的是 and 和 or：它們在 EX 要用到 $2', 0.6, 1.9);
    cap('有問題的是這兩個 instruction', 'access 完，ALU 這邊要用到它');
  },
  async (tok, S) => { // @1404.1
    S.g.hot(0, 3, COL.gold);
    txt(S.t2, 'sub 的結果什麼時候算好？cycle 3（EX）就算好了');
    cap('這個 instruction 什麼時候算好？', '第三個 clock 就算好了');
  },
  async (tok, S) => { // @1413.8
    S.g.hot(0, 5, '#555555');
    txt(S.t2, '只是規定第 5 段才能 write，所以 cycle 4、5 它一直「在那邊」，只是沒寫回');
    cap('只是規定第五個 stage 才能寫', '它其實一直都在那邊');
  },
  async (tok, S) => { // @1440.8
    S.a1 = arrow(V3(S.g.cx(3) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.3, S.g.cy(1) + 0.12, 0.4), 0xc08a1f);
    S.a2 = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(5) - 0.3, S.g.cy(2) + 0.12, 0.4), 0xc08a1f);
    txt(S.t2, 'forwarding：data 已經在那邊，直接拿來用（金色箭頭）');
    cap('這就叫 forwarding', 'data 已經在那邊，直接拿來用');
  },
  async (tok, S) => { // @1449.7
    S.t3 = note('要學 forwarding 要知道兩件事：① datapath 怎麼改 ② 什麼時候要 forward（control）', 0.6, 1.3);
    cap('分兩個部分', 'datapath 怎麼設計、什麼時候要 forward');
  },
  async (tok, S) => { // @1489.3
    gone(S.t3); txt(S.t2, '問：sub 算完、還沒寫回 register，它的資料放在哪裡？');
    cap('算完以後，它的資料放在哪裡？', '沒寫回 register，丟掉了嗎？');
  },
  async (tok, S) => { // @1504.4
    txt(S.t2, '放在 pipeline register 裡');
    cap('放在 pipeline register 裡面', '');
  },
  async (tok, S) => { // @1519.6
    S.nm = ['IF/ID', 'ID/EX', 'EX/MEM', 'MEM/WB'].map((n, i) => small(tag(n, 'idx', S.g.cx(i + 1) + S.g.w / 2, S.g.cy(4) + 0.1), 9));
    txt(S.t2, '給 pipeline register 名字：兩段之間畫一條斜線 —— ID/EX、EX/MEM、MEM/WB');
    cap('給 pipeline register 一個名字', 'execution 跟 memory 之間叫 EX/MEM');
  },
  async (tok, S) => { // @1551.0
    S.p4 = hot('cycle 4：sub 的結果在 EX/MEM', S.g.cx(4), 0.6);
    cap('第四個 clock cycle', 'sub 的 data 在 EX/MEM 這個 pipeline register');
  },
  async (tok, S) => { // @1562.2
    S.p5 = hot('cycle 5：？', S.g.cx(5) + 1.4, 0.0);
    cap('到第五個 cycle', '還沒寫進去，data 又跑去哪裡了？');
  },
  async (tok, S) => { // @1640.2
    txt(S.p5, 'cycle 5：在 MEM/WB');
    cap('在 memory 跟 write back 之間的', 'pipeline register 裡面，並沒有丟掉');
  },
  async (tok, S) => { // @1653.1
    txt(S.t2, 'and 在 cycle 4 要用 → 從 EX/MEM 拿；or 在 cycle 5 要用 → 從 MEM/WB 拿');
    glow(S.g.at(1, 4), COL.gold); glow(S.g.at(2, 5), COL.gold);
    cap('第四個 clock 要用、第五個 clock 要用', '都可以給你用，只是放的地方不同');
  },
]);

scene('ppA-19a-fwdmux', '19A：forwarding 的 datapath：ALU 前面的 3-to-1 mux', [
  async (tok, S) => { // @1707.6
    S.F = mkFwd(S, { unit: false });
    S.t = hot('forwarding 的 datapath 要長什麼樣子？', 0.2, 6.9);
    cap('forwarding 的 datapath', '要長什麼樣子？');
  },
  async (tok, S) => { // @1720.1
    glow(S.F.idex, COL.gold);
    S.t2 = note('正常狀況：ALU 的資料從前面 register file 讀出來（經 ID/EX）', 0.2, -0.5);
    cap('正常的狀況', '從前面 register file 讀出來');
  },
  async (tok, S) => { // @1728.0
    glow(S.F.idex, null); glow(S.F.exmem, COL.gold); S.F.ln.EA.material.color.set('#d68a00');
    txt(S.t2, '如果依賴的是前一個 instruction：資料在 EX/MEM');
    cap('依賴前一個 instruction', '資料在這個 pipeline register');
  },
  async (tok, S) => { // @1734.6
    glow(S.F.exmem, null); S.F.ln.EA.material.color.set('#d8cfc0'); glow(S.F.memwb, COL.gold); S.F.ln.WA.material.color.set('#d68a00');
    txt(S.t2, '如果依賴的是前兩個 instruction：資料在 MEM/WB');
    cap('依賴前兩個 instruction', '資料在這個 stage 的 register');
  },
  async (tok, S) => { // @1741.8
    glow(S.F.memwb, null); [S.F.ln.EA, S.F.ln.EB, S.F.ln.WA, S.F.ln.WB].forEach((l) => l.material.color.set('#d68a00'));
    txt(S.t2, '把這兩個地方的資料拉回來，接到 ALU 輸入前面的 mux');
    cap('把 data 拉過來', '當作 mux 的 input');
  },
  async (tok, S) => { // @1798.3
    glow(S.F.muxA, COL.gold); glow(S.F.muxB, COL.gold);
    txt(S.t2, 'ALU 每個輸入有三種來源：register file、EX/MEM、MEM/WB（write back stage）');
    cap('input 有三種狀況', 'register file、EX/MEM、write back stage');
  },
  async (tok, S) => { // @1814.3
    S.c = ok(3 === ['00', '10', '01'].length, 0.2, -1.1, '所以 ALU 前面各有一個 3-to-1 mux ✓');
    cap('所以這邊有一個 3-to-1 的 mux', '');
  },
], { cam: CAM_F });

scene('ppA-19a-fwdunit', '19A：forwarding unit：發出 00 / 10 / 01', [
  async (tok, S) => { // @1821.5
    S.F = mkFwd(S); glow(S.F.unit, COL.gold);
    S.t = hot('forwarding unit：負責 control —— 什麼時候選哪個 input', 0.2, 6.9);
    cap('forwarding unit 做 control', '怎麼知道什麼時候用哪個？');
  },
  async (tok, S) => { // @1836.6
    glow(S.F.unit, null); S.F.sel('A', '00');
    S.t2 = note('00：正常狀況，用 register file 讀出來的', 0.2, -1.1);
    cap('正常的狀況就是 00', '');
  },
  async (tok, S) => { // @1840.3
    S.F.sel('A', '10'); txt(S.t2, '10：從 EX/MEM forward（前一個 instruction）');
    cap('從這邊 forward 就設 10', 'EX/MEM');
  },
  async (tok, S) => { // @1842.5
    S.F.sel('A', '01'); txt(S.t2, '01：從 MEM/WB forward（write back 那邊，前兩個）');
    cap('從這邊 forward 就設 01', 'MEM/WB（write back 那邊）');
  },
  async (tok, S) => { // @1874.7
    S.F.reset(); glow(S.F.unit, COL.gold);
    txt(S.t2, '什麼時候發哪一個？要把 condition 找出來');
    cap('什麼時候發出 00、01？', '要把 condition 找出來');
  },
  async (tok, S) => { // @1882.9
    S.F.put('idex', 'rs, rt'); S.F.put('exmem', 'rd'); S.F.put('memwb', 'rd');
    txt(S.t2, '讀的時候用 rs、rt；前一個的 destination 若和 rs / rt 一樣 → 有 dependency');
    cap('要讀的是 rs、rt', '前一個的 destination 一樣 → 可能有 dependency');
  },
  async (tok, S) => { // @1910.3
    glow(S.F.idex, COL.gold);
    txt(S.t2, '所以 rs、rt 的「號碼」也要跟著傳到 ID/EX，交給 forwarding unit 比對');
    cap('一定要把 rs 跟 rt 也傳過來', '跟要寫回的 rd 比對，一樣就 forward');
  },
  async (tok, S) => { // @1934.1
    glow(S.F.idex, null); glow(S.F.exmem, COL.gold); glow(S.F.memwb, COL.gold);
    txt(S.t2, 'EX/MEM 的 destination、MEM/WB 的 destination 都拿來和 rs、rt 比');
    cap('這個 stage 也有一個 destination', '都要拿進來比對');
  },
  async (tok, S) => { // @1955.1
    glow(S.F.exmem, null); glow(S.F.memwb, null);
    txt(S.t2, '正常狀況也許不必 forward，但讀了「哪幾個 register」的 index 一定要記下來');
    cap('不需要 forward 時也照樣讀出來', '但 register 的 index 要記下來傳下去');
  },
], { cam: CAM_F });

scene('ppA-19a-enough', '19A：只比 register 號碼夠嗎？還要看 RegWrite', [
  async (tok, S) => { // @1975.6
    S.F = mkFwd(S); S.F.put('idex', 'rs, rt'); S.F.put('exmem', 'rd'); S.F.put('memwb', 'rd');
    S.t = hot('只比對 rs、rt 與 rd，這樣夠不夠？', 0.2, 6.9);
    cap('這樣夠不夠？', '');
  },
  async (tok, S) => { // @1991.1
    S.t2 = note('想法：讀的 rs / rt 和要寫回的 rd 一樣 → data dependency → forward', 0.2, -1.1);
    cap('只要 check rs、rt 跟 rd', '一樣就 forward —— 這樣夠嗎？');
  },
  async (tok, S) => { // @2036.0
    S.t.element.className = 'lab-label bad'; txt(S.t, '不夠！');
    txt(S.t2, '因為不管哪種指令，rs、rt、rd 欄位永遠都有值，一路傳下來');
    cap('應該是不夠的', 'rs、rt 不管怎樣都會拿出來，永遠有值');
  },
  async (tok, S) => { // @2053.7
    S.F.put('exmem', 'sw / beq（不寫）');
    txt(S.t2, '如果前一個根本不是「寫 register」的 instruction，比對剛好一樣也不該 forward');
    cap('假如它根本不是 write 的 instruction', '幹嘛 check dependency？');
  },
  async (tok, S) => { // @2082.6
    S.rw1 = small(tag('RegWrite', 'ptr alt', 1.8, 0.5), 9); S.rw2 = small(tag('RegWrite', 'ptr alt', 4.9, 0.1), 9);
    txt(S.t2, '所以還要把 RegWrite 拉給 forwarding unit：RegWrite = 1 才比對');
    cap('上面有一條告訴我它是不是 write', '是 1 的時候才要比對');
  },
  async (tok, S) => { // @2133.9
    S.F.put('exmem', 'rd'); glow(S.F.unit, COL.gold);
    txt(S.t2, 'forwarding unit 的 input：ID/EX 的 rs、rt；EX/MEM 的 rd、RegWrite；MEM/WB 的 rd、RegWrite');
    cap('forwarding unit 需要什麼資料？', '這個 stage 的 rs、rt，前一個、前兩個的 rd 與 write');
  },
  async (tok, S) => { // @2196.1
    glow(S.F.unit, null);
    S.mx = sm('rd = RegDst mux 選出的 rt（lw）或 rd（R-type）', 3.35, 6.6);
    txt(S.t2, '寫回的 destination 經過 rt / rd 的 mux：最後只剩一個 destination');
    cap('這邊有一個 rt、rd 的 mux', 'load 取 rt、R-type 取 rd');
  },
  async (tok, S) => { // @2253.8
    glow(S.F.unit, COL.gold); S.F.sel('A', '10');
    txt(S.t2, '得到這些 input，forwarding unit 就發出 control，選 mux 的 input');
    cap('得到 input 之後', '就發出 control 控制 mux 的 input');
  },
  async (tok, S) => { // @2281.8
    S.F.sel('B', '01');
    txt(S.t2, '有 rs、rt 兩個運算元 → 發兩個 signal：ForwardA（rs）、ForwardB（rt），兩個不一定一樣');
    cap('有 rs 跟 rt', '所以發出兩個 signal，不一定一樣');
  },
  async (tok, S) => { // @2296.3
    S.F.sel('B', '00');
    txt(S.t2, '都不依賴 → 00；依賴前兩個 → 01；依賴前一個 → 10');
    cap('不依賴誰就選 00', '這個選 01、這個選 10');
  },
], { cam: CAM_F });

// 條件（課本 EX hazard / MEM hazard），用本章的 fwdLogic 驗證
const C_EX = FW('add $4, $5, $6', 'sub $2, $1, $3', 'and $12, $2, $5');
const C_MEM = FW('sub $2, $1, $3', 'add $4, $5, $6', 'or $13, $6, $2');
const C_NOW = FW('add $4, $5, $6', 'sw $2, 0($3)', 'and $12, $2, $5');
const C_ZERO = FW('add $4, $5, $6', 'or $0, $1, $2', 'and $12, $0, $5');
scene('ppA-19a-cond', '19A：forwarding 的 condition：RegWrite、rd ≠ 0、rd = rs / rt', [
  async (tok, S) => { // @2377.1
    S.F = mkFwd(S); S.F.put('idex', 'rs, rt'); S.F.put('exmem', 'rd, RegWrite'); S.F.put('memwb', 'rd, RegWrite');
    S.t = hot('forwarding unit 還要注意哪些東西？', 0.2, 6.9);
    cap('forwarding unit 還要注意什麼？', '把 condition 仔細寫出來');
  },
  async (tok, S) => { // @2399.8
    S.F.put('exmem', 'sub $2,…  rd=2'); S.F.put('idex', 'and …,$2,…  rs=2');
    txt(S.t, 'EX/MEM.rd（前一個的 destination）= ID/EX.rs → 可能要 forward');
    cap('EX/MEM 的 destination', '跟我現在的 rs 一樣 → 可能要 forward');
  },
  async (tok, S) => { // @2424.2
    S.F.put('memwb', 'rd'); txt(S.t, 'MEM/WB.rd（前兩個的 destination）= rs 或 rt → 也可能要 forward');
    cap('第五個 stage 的 MEM/WB', 'rd 跟我的 rs、rt 一樣也要 forward');
  },
  async (tok, S) => { // @2439.6
    S.F.put('exmem', 'sw $2,…（RegWrite=0）');
    S.c1 = ok(C_NOW.FA === '00', 0.2, -1.1, '前一個不是寫 register 的指令 → 不 forward（fwdLogic 算出 ForwardA = ' + C_NOW.FA + '）✓');
    cap('不要 forward', '如果那個 instruction 根本不是寫 register');
  },
  async (tok, S) => { // @2464.7
    gone(S.c1); S.F.put('exmem', 'or $0,…  rd=0'); S.F.put('idex', 'and …,$0,…  rs=0');
    S.c1 = ok(C_ZERO.FA === '00', 0.2, -1.1, 'destination 是 $0 → 不 forward（$0 永遠是 0）：ForwardA = ' + C_ZERO.FA + ' ✓');
    cap('destination 是 0 的話', '也不用 forward，0 永遠是 0');
  },
  async (tok, S) => { // @2486.2
    gone(S.c1); S.F.put('exmem', 'sub $2,…  rd=2'); S.F.put('idex', 'and …,$2,…  rs=2'); S.F.sel('A', C_EX.FA);
    S.cd = mono(tag('EX hazard：if EX/MEM.RegWrite and EX/MEM.rd ≠ 0\n           and EX/MEM.rd = ID/EX.rs → ForwardA = 10', '', 0.2, -1.0), 9);
    S.c1 = ok(C_EX.FA === '10', 2.2, 6.3, 'fwdLogic：' + C_EX.FA + ' ✓');
    cap('前一個要 write、destination 不是 0', '而且等於我的 rs → forward');
  },
  async (tok, S) => { // @2511.0
    S.F.reset(); gone(S.cd, S.c1); S.F.put('exmem', 'add $4,…  rd=4'); S.F.put('memwb', 'sub $2,…  rd=2'); S.F.put('idex', 'or …,$6,$2  rt=2'); S.F.sel('B', C_MEM.FB);
    S.cd = mono(tag('MEM hazard：if MEM/WB.RegWrite and MEM/WB.rd ≠ 0\n            and MEM/WB.rd = ID/EX.rt → ForwardB = 01', '', 0.2, -1.0), 9);
    S.c1 = ok(C_MEM.FB === '01', 2.2, 6.3, 'fwdLogic：ForwardB = ' + C_MEM.FB + ' ✓');
    cap('再後面一個 stage：前兩個 instruction', '也要 write、不是 0、等於我 → forward');
  },
  async (tok, S) => { // @2534.4
    txt(S.t, 'rs 有一組條件（ForwardA），rt 一模一樣再一組（ForwardB）');
    cap('rs 是這樣', 'rt 一樣，把 rs 改成 rt 就好');
  },
  async (tok, S) => { // @2539.3
    gone(S.F, S.cd, S.c1); S.F = null;
    S.g = mkGrid(S, 9); DEP.slice(0, 4).forEach((t, k) => S.g.add(k, t, L5(k + 1))); S.g.upto(99);
    S.a1 = arrow(V3(S.g.cx(3) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.3, S.g.cy(1) + 0.12, 0.4), 0xc08a1f);
    S.a2 = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(5) - 0.3, S.g.cy(2) + 0.12, 0.4), 0xc08a1f);
    txt(S.t, '做完 forwarding：and 從 EX/MEM 拿、or 從 MEM/WB 拿');
    cap('做完 forward 會變成什麼樣子？', '前一個放這裡、再過一個 cycle 放那裡');
  },
  async (tok, S) => { // @2580.1
    S.g.hot(0, 5, COL.gold); S.g.hot(3, 5, COL.gold);
    const sch = schedule(DEP.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
    S.c1 = ok(sch.stalls === 0, 0.6, 1.9, '時間軸上：add 在 cycle 5 靠 internal forwarding；全部不用 stall ✓');
    cap('畫成時間來看', '我 execution 時，前一個、前兩個 cycle 給我');
  },
]);

const C_DBL = FW('add $1, $1, $2', 'add $1, $1, $3', 'add $1, $1, $4');
scene('ppA-19a-double', '19A：兩個都要寫同一個 register：forward 最新的', [
  async (tok, S) => { // @2610.7
    S.F = mkFwd(S);
    S.t = hot('還有一個小小的問題', 0.2, 6.9);
    cap('還有一些小小的問題', '');
  },
  async (tok, S) => { // @2635.5
    S.F.put('exmem', 'write R3（前一個）'); S.F.put('memwb', 'write R3（前兩個）');
    txt(S.t, '前一個、前兩個都要寫 R3');
    cap('這個要寫到第三個 register', '這個也要寫到第三個 register');
  },
  async (tok, S) => { // @2646.3
    S.F.put('idex', 'read R3（rs）'); glow(S.F.exmem, COL.gold); glow(S.F.memwb, COL.gold);
    txt(S.t, '我的 rs 要讀 R3 —— 要 forward 誰？');
    cap('我的 rs 要讀第三個 register', '到底要 forward 誰？');
  },
  async (tok, S) => { // @2716.6
    glow(S.F.memwb, null);
    txt(S.t, '左邊這個（EX/MEM，前一個）');
    cap('左邊的', '因為時間的順序');
  },
  async (tok, S) => { // @2725.0
    S.t2 = note('照程式順序，最後寫 R3 的是「前一個」→ 它的值最新', 0.2, -1.1);
    cap('我要最新的資料', '');
  },
  async (tok, S) => { // @2738.6
    S.F.sel('A', C_DBL.FA);
    S.c = ok(C_DBL.FA === '10', 2.2, 6.3, '課本 add $1 三連：fwdLogic 選 ForwardA = ' + C_DBL.FA + ' ✓');
    txt(S.t2, '兩個都符合時，EX/MEM 優先；EX/MEM 沒有時，才輪到 MEM/WB');
    cap('兩個都要時，這個優先 forward', '這個沒有的時候，那個才 forward');
  },
  async (tok, S) => { // @2754.9
    S.F.reset(); gone(S.c);
    txt(S.t, 'forwarding logic：mux 有三個 input');
    txt(S.t2, '正常的（register file 讀出來的 rs、rt）＋ 兩個還沒寫回的（EX/MEM、MEM/WB）');
    cap('forwarding logic', 'mux 有三個 input');
  },
  async (tok, S) => { // @2797.6
    S.F.sel('A', '00'); S.F.sel('B', '01');
    txt(S.t2, '00 選正常的、01 選 write back stage 的、10 選最新的（memory stage 那個，EX/MEM）');
    cap('control signal 00、01、10 這樣選', '01 是 write back 那邊，10 是最新的');
  },
  async (tok, S) => { // @2825.4
    S.F.reset(); S.F.put('exmem', 'write R3'); S.F.put('memwb', 'write R3'); S.F.put('idex', 'read R3');
    txt(S.t2, '兩個都能 forward 時：取 EX/MEM 那個（最新），不要取到 write back 的');
    cap('兩個都 forward 的話', '要取前面最新的，不要取 write back 的');
  },
  async (tok, S) => { // @2849.0
    S.F.sel('A', '10');
    S.cd = mono(tag('EX hazard：EX/MEM.RegWrite and EX/MEM.rd ≠ 0\n           and EX/MEM.rd = ID/EX.rs  → ForwardA = 10', '', 0.2, -1.0), 9);
    txt(S.t2, '');
    cap('前一個：是不是 write、不是 0', '跟我的 rs 一樣 → 寫 10');
  },
  async (tok, S) => { // @2887.0
    gone(S.cd);
    S.cd = mono(tag('MEM hazard：MEM/WB.RegWrite and MEM/WB.rd ≠ 0\n  and not (EX hazard 的條件成立)\n  and MEM/WB.rd = ID/EX.rs  → ForwardA = 01', '', 0.2, -1.1), 9);
    cap('前兩個 instruction 的條件都一樣', '要再加一個條件');
  },
  async (tok, S) => { // @2896.4
    const C2 = FW('add $1, $1, $2', 'add $5, $6, $7', 'add $1, $1, $4');
    S.c = ok(C_DBL.FA === '10' && C2.FA === '01', 2.2, 6.3, '例：前一個不寫 $1 時才選 MEM/WB：01 ✓（兩個都寫 $1 時仍是 10）');
    cap('前一個的 rd 跟 rs 不一樣', '才去 check 前兩個 → forward 01');
  },
  async (tok, S) => { // @2950.0
    S.F.sel('A', '01');
    txt(S.t, 'forwarding unit：在這些 condition 下發出 00 / 01 / 10，決定 ALU 的 input 從哪裡來');
    cap('在這些 condition 之下', '發出 00、01、10 控制 input 從哪裡來');
  },
], { cam: CAM_F });

// ════════ p_GUphUjmvI（第19B講：forwarding 例子、load-use stall 與 hazard detection、branch hazard、flush、dynamic prediction） ════════
scene('ppA-19b-where', '19B：forwarding unit 在 EX 檢查：爸爸、祖父在哪裡', [
  async (tok, S) => { // @17.3
    S.F = mkFwd(S);
    S.t = hot('先看一個 forwarding 的例子 —— 先注意兩件事', 0.2, 6.9);
    cap('看一個 forwarding 的例子', '複習之前先注意兩件事');
  },
  async (tok, S) => { // @22.8
    glow(S.F.unit, COL.gold); glow(S.F.alu, COL.gold);
    txt(S.t, '① forwarding unit 是在 EX 這個 stage 做 check，不是在讀 register 的時候');
    cap('forwarding unit 在 execution 這個 stage', '做 check，不是在前面');
  },
  async (tok, S) => { // @36.2
    glow(S.F.idex, COL.gold);
    S.t2 = note('不是每次都要 forward：正常時 rs、rt 照樣從 register file 讀出來', 0.2, -1.1);
    cap('不是什麼情況都要 forward', 'rs、rt 還是照樣讀出來');
  },
  async (tok, S) => { // @58.5
    glow(S.F.idex, null);
    txt(S.t2, '真正要用（在 ALU 算）的時候，才 check 需不需要 forward');
    cap('真正用到它的時候', '才 check 需不需要 forward');
  },
  async (tok, S) => { // @63.7
    glow(S.F.unit, null); glow(S.F.alu, null);
    txt(S.t, '② 我正在 EX 時，前一個 instruction 在哪裡？');
    cap('第二個要注意的', '我在 execution，前一個 instruction 在哪裡？');
  },
  async (tok, S) => { // @76.1
    S.F.put('idex', '我（EX）'); S.F.put('exmem', '爸爸＝前一個'); S.F.put('memwb', '祖父＝前兩個');
    glow(S.F.exmem, COL.gold); glow(S.F.memwb, COL.gold);
    txt(S.t2, '前一個（爸爸）在 EX/MEM；前兩個（祖父）在 MEM/WB');
    cap('我爸爸在哪裡？在這裡', '祖父在這裡');
  },
  async (tok, S) => { // @87.0
    gone(S.F, S.t2); S.F = null;
    S.g = mkGrid(S, 9); ['祖父', '爸爸', '我', '下一個'].forEach((n, k) => S.g.add(k, n, L5(k + 2))); S.g.upto(99);
    txt(S.t, '剛才的立體圖容易搞混 —— 換這種只有時間的圖');
    cap('立體的圖容易搞混', '看這種只有時間的圖');
  },
  async (tok, S) => { // @98.4
    S.g.band(5, 0, 3);
    S.t2 = note('在第 5 個 clock cycle：只有這幾格在運作', 0.6, 2.6);
    cap('在第五個 clock cycle', '任何一個時間只有這幾個在運作');
  },
  async (tok, S) => { // @113.2
    S.g.hot(2, 5, COL.gold); S.g.hot(1, 5, '#4b9ee2'); S.g.hot(0, 5, '#4b9ee2');
    txt(S.t2, '我在 EX（cycle 5）時：前一個在 MEM（它的結果在 EX/MEM）、前兩個在 WB（結果在 MEM/WB）');
    cap('我在 execution 時', '前一個在這裡，前兩個在這裡');
  },
]);

// 課本例子：sub $2,$1,$3 / and $4,$2,$5 / or $4,$4,$2 / add $9,$4,$2 —— 每個 cycle 的 ForwardA/B 由 fwdLogic 算
const E1 = ['sub $2, $1, $3', 'and $4, $2, $5', 'or $4, $4, $2', 'add $9, $4, $2'];
const F4 = FW('nop', E1[0], E1[1]), F5 = FW(E1[0], E1[1], E1[2]), F6 = FW(E1[1], E1[2], E1[3]);
const E1S = schedule(E1.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
scene('ppA-19b-ex1', '19B：例子：sub、and、or、add 每個 cycle 該 forward 什麼', [
  async (tok, S) => { // @120.8
    S.c = code(E1, -3.6, 6.7, 0.45); S.k = sm('（課本的例子）', 0.4, 6.7);
    S.t = note('看這個例子', 0.6, 4.5);
    cap('我們看這個例子', '');
  },
  async (tok, S) => { // @125.1
    S.c.hl(0); txt(S.t, 'sub：destination 是 register 2');
    cap('sub：destination 是 register 2', '');
  },
  async (tok, S) => { // @135.3
    S.c.hl(1); txt(S.t, 'and：rs 要 read $2（還有 $5）');
    cap('後面接的 and：rs 要 read 2', '');
  },
  async (tok, S) => { // @140.4
    txt(S.t, 'and 寫回的 destination 是 $4');
    cap('and 寫回去的 destination 是 4', '');
  },
  async (tok, S) => { // @145.5
    S.c.hl(2); txt(S.t, 'or、add 也都用到 $4、$2 —— 好多 dependency');
    cap('後面也有用到 4', '好多 dependency 在這邊');
  },
  async (tok, S) => { // @151.3
    gone(S.c, S.k, S.t);
    S.F = mkFwd(S); S.cy = hot('cycle 4', 5.2, 6.9);
    S.F.put('exmem', 'sub  rd=2'); S.F.put('memwb', '（更早的）');
    S.t = note('下一個 clock：sub 算完了，$2 放在 EX/MEM，還要記下「destination = 2」', 0.2, -1.1);
    cap('下一個 clock，2 會在哪裡？', '擺在這邊，同時記下 destination 是 2');
  },
  async (tok, S) => { // @187.0
    S.F.put('idex', 'and  rs=2, rt=5');
    txt(S.t, 'and 要運算，source 是 2 和 5 —— rs、rt 的號碼存在 ID/EX，沒有丟掉');
    cap('現在要運算，source 是 2 跟 5', 'rs、rt 存起來，不能 access 完就丟');
  },
  async (tok, S) => { // @208.3
    glow(S.F.idex, COL.gold); glow(S.F.exmem, COL.gold);
    txt(S.t, '2 和 2 一比對：一樣');
    cap('2 跟 5 一比對', '這兩個 2 是一樣的');
  },
  async (tok, S) => { // @212.6
    txt(S.t, '還要 check：sub 是 write 的 instruction 嗎？是（RegWrite = 1）；寫的是 $0 嗎？不是');
    cap('它是不是 write 的 instruction？是', '是不是 register 0？也不是');
  },
  async (tok, S) => { // @229.2
    txt(S.t, '→ 要 forward：把 EX/MEM 的東西送到 ALU 的 rs 那一邊');
    cap('表示要 forward', '把這邊的東西 forward 到 rs');
  },
  async (tok, S) => { // @241.2
    S.q = hot('ForwardA = ？', -2.7, 5.15);
    cap('rs 這個 mux 應該得到什麼值？', '');
  },
  async (tok, S) => { // @253.8
    gone(S.q); S.F.sel('A', F4.FA); S.F.sel('B', F4.FB);
    S.ck = ok(F4.FA === '10' && F4.FB === '00', 2.6, 6.3, 'fwdLogic：A = ' + F4.FA + '、B = ' + F4.FB + ' ✓');
    cap('10：從 EX/MEM 過來', 'control signal 發出 10');
  },
  async (tok, S) => { // @283.0
    S.F.reset(); gone(S.ck); glow(S.F.idex, null); glow(S.F.exmem, null); txt(S.cy, 'cycle 5');
    S.F.put('exmem', 'and  rd=4'); S.F.put('memwb', 'sub  rd=2'); S.F.put('idex', 'or');
    txt(S.t, '下一個 clock（第 5 個）：又要執行下一個 instruction（or）');
    cap('下個 clock cycle，第五個', '又開始執行下一個');
  },
  async (tok, S) => { // @287.4
    glow(S.F.exmem, COL.gold);
    txt(S.t, '前一個（and）的 destination 是 4 → 拉過來');
    cap('前一個的 destination 是 4', '拉過來是 4');
  },
  async (tok, S) => { // @300.6
    glow(S.F.memwb, COL.gold);
    txt(S.t, '前兩個（sub，祖父）的 destination 是 2 → 也拉過來');
    cap('前兩個（祖父）也要顧到', 'destination 是 2');
  },
  async (tok, S) => { // @304.6
    S.F.put('idex', 'or  rs=4, rt=2');
    txt(S.t, 'or 要讀的是 rs = 4、rt = 2');
    cap('我要讀的 rs、rt', '是 4 跟 2');
  },
  async (tok, S) => { // @312.0
    txt(S.t, '4 要 forward 到 rs；2 要 forward 到 rt');
    cap('4 要 forward 到 rs', '2 要 forward 到 rt');
  },
  async (tok, S) => { // @323.4
    txt(S.t, 'check：and、sub 都是 R-type，會 write register → 都要 forward');
    cap('是不是 write？是，R-type', '所以這個也會 forward');
  },
  async (tok, S) => { // @356.5
    S.F.sel('A', F5.FA);
    cap('rs 的 4 從 EX/MEM 過來', '所以是 10');
  },
  async (tok, S) => { // @363.3
    S.F.sel('B', F5.FB);
    S.ck = ok(F5.FA === '10' && F5.FB === '01', 2.6, 6.3, 'fwdLogic：A = ' + F5.FA + '、B = ' + F5.FB + ' ✓');
    cap('rt 的部分：01', '從 MEM/WB 這個 stage forward');
  },
  async (tok, S) => { // @386.2
    S.F.reset(); gone(S.ck); glow(S.F.exmem, null); glow(S.F.memwb, null); txt(S.cy, 'cycle 6');
    S.F.put('exmem', 'or  rd=4'); S.F.put('memwb', 'and  rd=4'); S.F.put('idex', 'add  rs=4, rt=2');
    txt(S.t, '第 6 個 cycle：add 要讀 4 跟 2（剛才記下來的號碼）');
    cap('現在執行 add', '要讀 4 跟 2');
  },
  async (tok, S) => { // @398.3
    glow(S.F.exmem, COL.gold); glow(S.F.memwb, COL.gold);
    txt(S.t, '前一個（or）、前兩個（and）都要寫 $4');
    cap('前兩個 stage 要寫去哪裡？', '這兩個都要寫 4');
  },
  async (tok, S) => { // @400.5
    S.q = hot('rs 要選誰？', -2.7, 5.15);
    cap('這時候應該選誰？', '');
  },
  async (tok, S) => { // @431.4
    gone(S.q); glow(S.F.memwb, null); S.F.sel('A', F6.FA); S.F.sel('B', F6.FB);
    S.ck = ok(F6.FA === '10' && F6.FB === '00', 2.6, 6.3, 'fwdLogic：A = ' + F6.FA + '（取最新的）、B = ' + F6.FB + '（$2 在 cycle 5 已寫回）✓');
    cap('選 10：從 EX/MEM forward', '要 forward 最新的');
  },
  async (tok, S) => { // @452.6
    S.ck2 = ok(E1S.stalls === 0 && E1S.total === 8, 0.2, 0.0, '有 forwarding：4 個指令完全不用 stall，共 4 + 4 = ' + E1S.total + ' 個 cycle ✓');
    txt(S.t, '');
    cap('這就是 forwarding', '懂了每條線，control 其實不難');
  },
], { cam: CAM_F });

// load-use：lw $2 之後馬上讀 $2
scene('ppA-19b-loaduse', '19B：load-use：forwarding 救不了，一定要 stall', [
  async (tok, S) => { // @472.0
    S.t = hot('另外一種 hazard：先把所有 instruction 再分析一下', 0.6, 6.7);
    cap('接下來是另外一種 hazard', 'R 接 R、load 接 R');
  },
  async (tok, S) => { // @483.0
    S.t2 = note('誰會「寫」register file？', 0.6, 6.1);
    cap('有誰會寫 register file？', '');
  },
  async (tok, S) => { // @491.0
    S.g = mkGrid(S, 8, { y0: 5.0 });
    S.g.add(2, '讀的人', L5(2)); S.g.row(2); S.g.hot(2, 3, '#4b9ee2');
    txt(S.t2, '誰會「讀」？很多指令都會讀，讀一定在第 2 段（register access）');
    cap('誰會讀 register file？', '讀一定在第二個 stage');
  },
  async (tok, S) => { // @502.4
    txt(S.t2, '寫回去的到目前只有兩種：R-type、load（從 memory 拿出來）');
    cap('寫回去的只有兩種 type', 'R-type 和 load');
  },
  async (tok, S) => { // @511.6
    S.g.add(0, 'R-type（寫）', R5(1)); S.g.row(0); S.g.hot(0, 3, COL.gold);
    S.a = arrow(V3(S.g.cx(3) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.3, S.g.cy(2) + 0.12, 0.4), 0xc08a1f);
    S.t3 = good('前一個是 R-type：EX 就把東西算好 → 下一個來時可以 forward，沒問題', 0.6, 1.5);
    cap('前面是 R-type，後面接 R-type', 'EX 就算好了，可以 forwarding');
  },
  async (tok, S) => { // @534.9
    gone(S.a, S.t3); S.g.dropRow(0); S.g.add(0, 'lw（寫）', L5(1)); S.g.row(0);
    txt(S.t2, '前一個是 load：什麼時候才拿到資料？');
    cap('如果前一個是 load', '什麼時候才拿到資料？');
  },
  async (tok, S) => { // @543.7
    S.g.hot(0, 3, '#555555'); S.g.hot(0, 4, COL.gold);
    S.t3 = note('EX 時只算出 memory 位址；要 MEM 讀完（cycle 4 結束）才有資料', 0.6, 1.5);
    cap('execution 時才算地址而已', '要 memory access 完才拿到');
  },
  async (tok, S) => { // @555.0
    S.g.hot(2, 4, '#7a1010');
    S.a = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.1, S.g.cy(2) + 0.12, 0.4), 0xd64545);
    txt(S.t3, '下一個在 cycle 4 開始 EX 就要用，可是資料 cycle 4 結束才出來 → 箭頭往回走，真的拿不到');
    cap('下一個 instruction 真的拿不到 data', 'forward 也沒辦法');
  },
  async (tok, S) => { // @577.1
    S.t4 = bad('cannot always forward：load 後面馬上讀 → forwarding 也來不及', 0.6, 0.8);
    cap('不是永遠都能 forward', 'load 之後馬上讀，一定要 stall');
  },
  async (tok, S) => { // @602.5
    gone(S.a, S.t4); S.g.dropRow(2); S.g.add(1, 'bubble（nop）', [[4, 'bubble', 'nop'], [5, 'bubble', 'nop'], [6, 'bubble', 'nop']]); S.g.add(2, '讀的人', [[2, 'IF'], [3, 'ID'], [4, 'ID'], [5, 'EX'], [6, 'MEM'], [7, 'WB']]); S.g.upto(99);
    S.g.hot(0, 4, COL.gold); S.g.hot(2, 5, '#0f5a3a');
    S.a = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(5) - 0.3, S.g.cy(2) + 0.12, 0.4), 0xc08a1f);
    const L1 = schedule(['lw $2, 20($1)', 'and $4, $2, $5'].map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
    txt(S.t3, '停一個 cycle（加一個 nop）：讀的人 EX 延到 cycle 5，再從 MEM/WB forward');
    S.t4 = ok(L1.rows[1].stall === 1 && L1.rows[1].EX === 5, 0.6, 0.8, 'schedule：and stall ' + L1.rows[1].stall + ' 個 cycle，EX 在 cycle ' + L1.rows[1].EX + ' ✓');
    cap('一定要停一個 cycle', '加一個 no-op 在裡面');
  },
  async (tok, S) => { // @641.2
    txt(S.t2, 'software 可以插 nop；hardware 則在執行時用 hazard detection 自己偵測');
    cap('software 也許插一個 no-op', '不然 run time 要做 hazard detection');
  },
  async (tok, S) => { // @652.6
    S.g.hot(2, 3, COL.gold); S.g.hot(2, 4, COL.gold);
    txt(S.t3, 'insert 一個 no-op = 這個 instruction「再執行一遍」：同一個再 decode 一次（ID 做兩次），後面那個也再 fetch 一次');
    cap('insert no-op 的意思', '就是這個 instruction 再執行一遍');
  },
  async (tok, S) => { // @687.2
    S.g.cool(); [4, 5, 6].forEach((c) => S.g.hot(1, c, COL.gold));
    txt(S.t3, '第一次 decode 出來的那份不要用：把它的 control 全部給 0 → 變成一個 nop（bubble）往下走');
    cap('不要用的那份', 'control 全部給 0 就是 no-op');
  },
  async (tok, S) => { // @698.5
    S.g.cool();
    txt(S.t2, '要做兩件事：① 用 controller 偵測（detect）這種情況 ② datapath 要能停（stall）');
    cap('要做兩件事', '一個 detection 的 controller，一個 datapath');
  },
]);

// hazard detection unit 在 ID 段：看 ID/EX.MemRead、ID/EX.rt、IF/ID.rs、IF/ID.rt
function mkHDU(S, o = {}) {
  const d = S.d = mkDP(S, { y: 1.4 });
  const H = { ex: [] };
  H.unit = cube('Hazard detection unit', '#a99470', [2.6, 0.55, 0.6], -1.4, 5.6, 0); small(H.unit.userData.lbl, 9);
  H.ctl = cube('Control', '#8a7a5c', [1.2, 0.5, 0.6], -4.3, 4.3, 0); small(H.ctl.userData.lbl, 9);
  H.mux = cube('mux', '#8a7a5c', [0.5, 0.75, 0.5], -1.4, 4.3, 0); small(H.mux.userData.lbl, 9);
  H.zero = sm('0', -1.4, 3.65);
  const L = (pts, c = '#8a7a5c') => { const l = line(pts.map((p) => [p[0], p[1], 0.1]), c); H.ex.push(l); return l; };
  H.l = {
    ctl: L([[-3.7, 4.3], [-1.65, 4.3]]), out: L([[-1.15, 4.3], [d.rx(1), 4.3], [d.rx(1), 2.5]]),
    mr: L([[d.rx(1) + 0.15, 2.5], [d.rx(1) + 0.15, 5.6], [-0.1, 5.6]]),
    rs: L([[d.rx(0) - 0.15, 2.5], [d.rx(0) - 0.15, 5.6], [-2.7, 5.6]]),
    pc: L([[-2.7, 5.85], [-6.6, 5.85], [-6.6, 2.0]]), ifid: L([[-2.7, 5.75], [d.rx(0) + 0.15, 5.75], [d.rx(0) + 0.15, 2.5]]),
    sel: L([[-1.4, 5.3], [-1.4, 4.7]]),
  };
  H.tag = {};
  H.in = (k, t, x, y) => { if (H.tag[k]) remove(H.tag[k]); H.tag[k] = small(tag(t, 'idx', x, y), 9); return H.tag[k]; };
  H.hot = (k, c = '#d68a00') => H.l[k].material.color.set(c);
  H.cool = () => Object.values(H.l).forEach((l) => l.material.color.set('#8a7a5c'));
  H.all = () => [H.unit, H.ctl, H.mux, H.zero, ...H.ex, ...Object.values(H.tag)];
  S.H = H; return H;
}
// 課本條件：if (ID/EX.MemRead and (ID/EX.rt = IF/ID.rs or ID/EX.rt = IF/ID.rt)) stall
const hzd = (ex, id) => { const a = decodeFU(ex), b = decodeFU(id); return !!(a.op === 'lw' && a.rd && (a.rd === b.rs || a.rd === b.rt)); };
scene('ppA-19b-detect', '19B：在 ID 偵測 load-use，怎麼讓 pipeline 停一個 cycle', [
  async (tok, S) => { // @765.9
    mkHDU(S);
    S.t = hot('兩件事：怎麼偵測？datapath 怎麼 stall？', 0, 6.9);
    cap('datapath 怎麼做 stall 這件事？', '');
  },
  async (tok, S) => { // @780.0
    S.lw = S.d.chip('lw $2', 2, COL.gold); S.an = S.d.chip('and …$2…', 1, '#4b9ee2');
    S.t2 = note('假如前一個是 lw，我這個（在 ID）又要 access 它寫的 register', 0, -0.5);
    cap('假如前一個 instruction 是 load', '我這個 instruction 又要 access register');
  },
  async (tok, S) => { // @793.3
    S.d.hot(1); glow(S.H.unit, COL.gold);
    txt(S.t2, '在 decode 這段就知道了：decode 時就知道自己的 rs、rt');
    cap('在 instruction decode 時就知道', 'decode 時就知道 rs、rt 是誰');
  },
  async (tok, S) => { // @814.2
    S.d.cool(); glow(S.d.regs[1], COL.gold);
    txt(S.t2, '前一個 instruction 在哪？在 ID/EX —— 它已經 decode 完，資訊全在這裡');
    cap('前一個 instruction 在哪裡？', '在這裡，它的資料全部都在這邊');
  },
  async (tok, S) => { // @829.9
    S.H.hot('mr'); S.H.in('mr', 'ID/EX.MemRead', 1.2, 5.85);
    txt(S.t2, '怎麼知道它是 load？看它的 MemRead control signal 是不是 enable');
    cap('怎麼知道它是不是 load？', '看 memory read 那個 signal 有沒有 enable');
  },
  async (tok, S) => { // @853.4
    S.H.hot('rs'); S.H.in('rs', 'IF/ID.rs、IF/ID.rt', -4.0, 5.85);
    txt(S.t2, '再把我這個 instruction 讀的 rs、rt 拉進來比對');
    cap('還要看我的 rs 跟 rt', '拉過來做比對');
  },
  async (tok, S) => { // @869.0
    S.H.in('rt', 'ID/EX.rt（lw 的 destination）', 1.6, 5.35);
    S.c = ok(hzd('lw $2, 20($1)', 'and $4, $2, $5'), 0, -1.1, '前一個是 load、而且它的 destination = 我的 rs 或 rt → 一定要 stall ✓');
    cap('前一個是 load，destination 又跟我一樣', '就一定要 stall');
  },
  async (tok, S) => { // @884.2
    gone(S.c);
    txt(S.t2, '怎麼 stall？我（and）在 decode，會產生 control signal ……');
    cap('那怎麼樣 stall？', '我現在在 decoding，一定有 control signal');
  },
  async (tok, S) => { // @912.6
    txt(S.t2, '……什麼都不做的話，這些 control 下一個 cycle 就送去執行了 —— 但這次 decode 出來的不能用');
    cap('現在 decode 出來的不能用', '要當作一個 no-op');
  },
  async (tok, S) => { // @936.5
    S.H.hot('sel'); S.H.hot('out'); glow(S.H.mux, COL.gold); txt(S.H.zero, '選 0');
    txt(S.t2, '只要把 control 全部 set 成 0，它就是 no-op');
    cap('把 control 全部 set 成 0', '它就是 no-op');
  },
  async (tok, S) => { // @941.1
    S.H.hot('ifid'); glow(S.d.regs[0], '#7a1010');
    txt(S.t2, 'IF/ID 裡的 and 要保留：下次要再執行一遍 → IF/ID 不准寫入新的');
    cap('IF/ID 這邊要保留', '不能讓新的寫進去，下次要再執行一遍');
  },
  async (tok, S) => { // @959.6
    S.H.hot('pc'); S.H.in('pc', 'PCWrite = 0、IF/IDWrite = 0', -4.4, 6.3);
    txt(S.t2, 'PC 也不更新（本來 PC + 4 不要寫進去）');
    cap('PC 等於 PC + 4 也不要寫進去', '這兩個都不要動，這邊給 0');
  },
  async (tok, S) => { // @974.8
    txt(S.t2, '整理：在 ID 偵測 → control 給 0（插 bubble）＋ PC、IF/ID 不動（重做一次）＝ stall');
    cap('這就是 stall 的動作', '再講一遍');
  },
]);

scene('ppA-19b-hdu', '19B：hazard detection unit 的 input、output 與 bubble', [
  async (tok, S) => { // @1001.1
    mkHDU(S); S.lw = S.d.chip('lw $2', 2, COL.gold); S.an = S.d.chip('and', 1, '#4b9ee2'); S.or = S.d.chip('or', 0, '#9b7ef4');
    S.H.hot('mr'); S.H.in('mr', 'ID/EX.MemRead', 1.2, 5.85);
    S.t = note('怎麼知道前一個是 load？看它的 control：MemRead', 0, -0.5);
    cap('怎麼知道前一個是 load？', '看它的 control signal：memory read');
  },
  async (tok, S) => { // @1019.6
    S.H.in('rt', 'ID/EX.rt', 1.6, 5.35);
    txt(S.t, '再拉過來：load 要寫的那個 register 號碼');
    cap('還要拉過來', '它到底要寫哪一個 register');
  },
  async (tok, S) => { // @1040.0
    S.H.hot('rs'); S.H.in('rs', 'IF/ID.rs、IF/ID.rt', -4.0, 5.85);
    txt(S.t, '這兩條：我現在這個 instruction 的 rs、rt —— input 全部知道了');
    cap('這條線是我現在 instruction 的 rs、rt', 'input 全部都知道了');
  },
  async (tok, S) => { // @1050.1
    S.H.hot('pc'); S.H.hot('ifid'); S.H.hot('sel'); S.H.in('pc', 'PCWrite、IF/IDWrite、mux 選 0', -4.4, 6.3);
    txt(S.t, 'output：三個 control signal —— PC 不要 write、IF/ID 不要 write、control 的 mux 選 0');
    cap('output：PC、IF/ID 不要 write enable', 'mux 選 0：發出三個 control signal');
  },
  async (tok, S) => { // @1076.0
    S.bub = S.d.chip('bubble（全 0）', 2, '#cfc6b6');
    await S.d.go(tok, [[S.lw, 3]], 600);
    txt(S.t, '下一個 cycle：送進 ID/EX 的 control 全是 0 → 什麼都不做');
    cap('下一個 clock cycle', '過去的東西全部都是 0');
  },
  async (tok, S) => { // @1085.2
    glow(S.an, COL.gold); glow(S.or, COL.gold);
    txt(S.t, 'and、or 原地踏步：IF/ID 沒寫新的 → and 再 decode 一次；PC 沒變 → 再抓一次 or');
    cap('原地踏步', '再 decode 一次，PC 也沒改變');
  },
  async (tok, S) => { // @1104.8
    txt(S.t, '這就是 insert 一個 bubble');
    cap('這就是 insert 一個 bubble', '');
  },
  async (tok, S) => { // @1112.8
    glow(S.an, null); glow(S.or, null);
    txt(S.t, '分兩部分：datapath 加一個 hazard detection（在 register access 那段）；control 的條件寫成 Boolean equation');
    cap('datapath、control 各有什麼改變', 'register access 那裡多一個 hazard detection');
  },
  async (tok, S) => { // @1162.3
    glow(S.H.unit, COL.gold); S.H.hot('mr', '#d64545');
    txt(S.t, '別忘了把 rt 放進去');
    cap('不要忘記把 rt 放進去', '');
  },
  async (tok, S) => { // @1196.6
    S.H.in('rt', 'ID/EX.rt ← load 的 destination 是 rt', 1.9, 5.35);
    txt(S.t, 'load 的 destination 是 rt（不是 rd）→ 拿 ID/EX.rt 和我的 rs、rt 比（考試也考過）');
    cap('load 的 destination 是 rt', '所以要把 rt 拿過來比');
  },
  async (tok, S) => { // @1218.3
    S.cd = mono(tag('if ( ID/EX.MemRead and\n     ( ID/EX.rt = IF/ID.rs or ID/EX.rt = IF/ID.rt ) )\n   stall the pipeline for one cycle', '', 0.2, -1.5), 9);
    txt(S.t, '');
    cap('control 的條件', '前一個在 ID/EX 是 MemRead，且 destination 跟我一樣');
  },
  async (tok, S) => { // @1244.6
    const tests = [['lw $2, 20($1)', 'and $4, $2, $5', true], ['lw $2, 20($1)', 'and $4, $5, $2', true], ['lw $2, 20($1)', 'and $4, $5, $6', false], ['add $2, $1, $3', 'and $4, $2, $5', false]];
    const pass = tests.every(([a, b, want]) => hzd(a, b) === want);
    S.c = ok(pass, 0.2, 6.9, '測 4 組：lw→用 rs ✓ stall、lw→用 rt ✓ stall、lw→不相關 不 stall、add→用 不 stall（交給 forwarding）✓');
    cap('條件成立就 stall pipeline 一個 cycle', '');
  },
  async (tok, S) => { // @1254.4
    gone(S.c);
    S.t2 = note('stall：不要改 PC、不要改 IF/ID pipeline register → 重複再執行一遍', 0, 7.0);
    cap('stall：不要 change PC', '也不要 change IF/ID');
  },
  async (tok, S) => { // @1266.3
    txt(S.t2, '現在 decode 的那份全部給 0 往下傳 → 等於傳下去一個 no-op');
    cap('現在 decode 的東西全部給 0', '相當於傳一個 no-op 往下走');
  },
]);

// 課本 stall 例子：lw $2,20($1) / and $4,$2,$5 / or $4,$4,$2 / add $9,$4,$2
const E2 = ['lw $2, 20($1)', 'and $4, $2, $5', 'or $4, $4, $2', 'add $9, $4, $2'];
const E2S = schedule(E2.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
const G5 = FW(E2[0], 'nop', E2[1]), G6 = FW('nop', E2[1], E2[2]), G7 = FW(E2[1], E2[2], E2[3]);
scene('ppA-19b-ex2', '19B：例子：lw 之後的 stall、bubble 與 forwarding', [
  async (tok, S) => { // @1289.3
    mkHDU(S);
    S.c = code(E2, 3.2, 6.9, 0.42); S.k = sm('（課本）', 5.8, 5.2);
    S.t = note('例子：load instruction', 0, -0.5);
    cap('來看一個例子', '假如現在是 load instruction');
  },
  async (tok, S) => { // @1295.3
    S.c.hl(0); S.lw = S.d.chip('lw  rt=2', 2, COL.gold);
    txt(S.t, 'lw 要寫的是 rt，destination = 2（要在這個 stage 檢查）');
    cap('它要寫的是 rt，destination 是 2', '');
  },
  async (tok, S) => { // @1302.8
    S.c.hl(1); S.an = S.d.chip('and  rs=2, rt=5', 1, '#4b9ee2');
    txt(S.t, '下一個 and 要讀第 2 個 register');
    cap('下一個 instruction 是 and', '要讀第二個 register');
  },
  async (tok, S) => { // @1319.9
    S.H.hot('rs'); S.H.in('rs', 'IF/ID：rs = 2、rt = 5', -4.0, 5.85); S.H.in('rt', 'ID/EX.rt = 2', 1.6, 5.35);
    txt(S.t, 'lw 把 2 傳過來；and 把 rs、rt（2 和 5）傳過來');
    cap('load 把 2 傳過來', '這邊要傳 2 跟 5');
  },
  async (tok, S) => { // @1339.1
    S.H.hot('mr'); S.H.in('mr', 'ID/EX.MemRead = 1', 1.2, 5.85);
    txt(S.t, '是不是 load？看 MemRead 有沒有 enable —— 有');
    cap('怎麼知道它是不是 load？', '看 memory read 是不是 enable');
  },
  async (tok, S) => { // @1345.1
    glow(S.H.unit, COL.gold);
    S.ck = ok(hzd(E2[0], E2[1]), 0, -1.1, '條件全部符合：load 後面接 access 同一個 register → stall ✓');
    cap('這幾個條件都符合', 'load 後面加一個 access 同一個 destination');
  },
  async (tok, S) => { // @1356.4
    gone(S.ck); S.H.hot('sel'); S.H.hot('out'); glow(S.H.mux, COL.gold); txt(S.H.zero, '選 0');
    txt(S.t, '第一件事：control 選 0，讓 0 往下 propagate');
    cap('第一個：發出 control signal', '讓 0 往下 propagate');
  },
  async (tok, S) => { // @1363.6
    S.H.hot('pc'); S.H.hot('ifid'); S.H.in('pc', 'PCWrite = 0、IF/IDWrite = 0', -4.4, 6.3);
    txt(S.t, '再來：PC、IF/ID 不要動 → and 要再執行一遍');
    cap('這邊不要動', 'and 要再執行一遍');
  },
  async (tok, S) => { // @1371.4
    S.or = S.d.chip('or', 0, '#9b7ef4');
    S.bub = S.d.chip('bubble', 2, '#cfc6b6');
    await S.d.go(tok, [[S.lw, 3]], 600);
    txt(S.t, '下一個 cycle：0 傳下去變成 bubble；and 還在 ID、or 還在 IF，都沒動');
    cap('把 0 傳下去了，變成 bubble', 'and 還在這邊，or 還在這邊');
  },
  async (tok, S) => { // @1409.0
    gone(S.d, S.H, S.c, S.k, S.t); S.d = null;
    S.F = mkFwd(S); S.cy = hot('cycle 5', 5.2, 6.9);
    S.F.put('idex', 'and  rs=2, rt=5'); S.F.put('exmem', 'bubble'); S.F.put('memwb', 'lw  rt=2');
    S.t = note('bubble 繼續往下；and 現在要運算了，讀的是 2 跟 5', 0.2, -1.1);
    cap('bubble 繼續往下', 'and 要運算了，讀的是 2 跟 5');
  },
  async (tok, S) => { // @1421.5
    glow(S.F.idex, COL.gold);
    txt(S.t, 'rs、rt 的號碼 2、5 送到 forwarding unit');
    cap('我的讀是 2 跟 5', '');
  },
  async (tok, S) => { // @1429.1
    glow(S.F.memwb, COL.gold);
    txt(S.t, 'EX/MEM 是 bubble，沒東西；MEM/WB 是 lw，destination = 2');
    cap('前面那個 stage 是 bubble', '這個 stage 的 destination 是 2');
  },
  async (tok, S) => { // @1441.2
    txt(S.t, '已經 delay 了一個 cycle，lw 的資料已經在 MEM/WB → 可以 forward 了');
    cap('lw 之後要做 forwarding', '因為已經 delay 一個 cycle，資料在那邊了');
  },
  async (tok, S) => { // @1465.6
    S.F.sel('A', G5.FA);
    cap('rs 的 control signal：01', '從 MEM/WB forward 過來');
  },
  async (tok, S) => { // @1469.8
    S.F.sel('B', G5.FB);
    S.ck = ok(G5.FA === '01' && G5.FB === '00', 2.6, 6.3, 'fwdLogic：A = ' + G5.FA + '、B = ' + G5.FB + ' ✓');
    cap('rt 正常就是 00', '');
  },
  async (tok, S) => { // @1491.5
    S.F.reset(); gone(S.ck); glow(S.F.idex, null); glow(S.F.memwb, null); txt(S.cy, 'cycle 6');
    S.F.put('idex', 'or'); S.F.put('exmem', 'and  rd=4'); S.F.put('memwb', 'bubble');
    txt(S.t, '再下一個：hazard 沒有 load 了，只看要不要 forward');
    cap('再下面：這邊沒問題', '看有沒有要 forward');
  },
  async (tok, S) => { // @1500.6
    S.F.put('idex', 'or  rs=4, rt=2'); glow(S.F.idex, COL.gold);
    txt(S.t, 'or 要讀 4 跟 2；前一個（and）寫 4；再前一個是 bubble，沒影響');
    cap('這個要讀的是 4 跟 2', 'bubble 沒有影響');
  },
  async (tok, S) => { // @1512.4
    glow(S.F.exmem, COL.gold);
    txt(S.t, 'and 又是 write 的 instruction，4 跟 rs 一樣 → 又要 forward');
    cap('它又是一個 write instruction', '4 跟 rs 一樣，又要 forward');
  },
  async (tok, S) => { // @1529.3
    S.F.sel('A', G6.FA);
    cap('rs 這個 stage 發出 10', '');
  },
  async (tok, S) => { // @1532.7
    S.F.sel('B', G6.FB);
    S.ck = ok(G6.FA === '10' && G6.FB === '00', 2.6, 6.3, 'fwdLogic：A = ' + G6.FA + '、B = ' + G6.FB + '（$2 在 cycle 5 已寫回）✓');
    cap('rt 有沒有 forward？沒有', '正常就是 00');
  },
  async (tok, S) => { // @1538.2
    S.F.reset(); gone(S.ck); glow(S.F.idex, null); glow(S.F.exmem, null); txt(S.cy, 'cycle 7');
    S.F.put('idex', 'add  rs=4, rt=2'); S.F.put('exmem', 'or  rd=4'); S.F.put('memwb', 'and  rd=4');
    txt(S.t, '再執行到 add：要讀 4 跟 2');
    cap('再執行到這個 instruction', '要讀 4 跟 2');
  },
  async (tok, S) => { // @1550.1
    glow(S.F.exmem, COL.gold); glow(S.F.memwb, COL.gold);
    txt(S.t, '前一個寫 4、再前一個也寫 4 → rs 要 forward，從哪裡？');
    cap('前一個是 4，再前一個也是 4', '第一個 operand 要 forward');
  },
  async (tok, S) => { // @1563.7
    glow(S.F.memwb, null); S.F.sel('A', G7.FA); S.F.sel('B', G7.FB);
    S.ck = ok(G7.FA === '10' && G7.FB === '00', 2.6, 6.3, 'fwdLogic：A = ' + G7.FA + '（最新的 or）、B = ' + G7.FB + ' ✓');
    cap('從前面這個 forward', '所以設成 10');
  },
  async (tok, S) => { // @1582.3
    gone(S.F, S.cy, S.ck, S.t); S.F = null;
    S.g = mkGrid(S, 10, { y0: 6.2, dy: 0.56 });
    S.g.add(0, E2[0], L5(1)); S.g.add(1, 'bubble', [[4, 'bubble', 'nop'], [5, 'bubble', 'nop'], [6, 'bubble', 'nop']]);
    S.g.add(2, E2[1], [[2, 'IF'], [3, 'ID'], [4, 'ID'], [5, 'EX'], [6, 'MEM'], [7, 'WB']]);
    S.g.add(3, E2[2], [[3, 'IF'], [4, 'IF'], [5, 'ID'], [6, 'EX'], [7, 'MEM'], [8, 'WB']]);
    S.g.add(4, E2[3], L5(5)); S.g.upto(99);
    const r = E2S.rows;
    S.ck = ok(E2S.total === 9 && E2S.stalls === 1 && r[1].EX === 5 && r[2].EX === 6 && r[3].EX === 7, 0.6, 2.8, '整段：stall 1 個 cycle，4 + 4 + 1 = ' + E2S.total + ' 個 cycle（schedule 驗算）✓');
    S.t = note('老師：考試很喜歡考 control signal 怎麼設 —— 懂了每條線，答案很簡單', 0.6, 2.1);
    cap('老師很喜歡考 control signal 怎麼設', '懂了就會，不用背');
  },
]);

scene('ppA-19b-recap', '19B：複習：兩類 data hazard', [
  async (tok, S) => { // @1611.7
    S.t = hot('data hazard 就兩種狀況，不要搞亂', 0.6, 6.7);
    S.g = mkGrid(S, 8, { y0: 5.4 });
    cap('剛才介紹的 data hazard', '就兩種狀況');
  },
  async (tok, S) => { // @1652.6
    S.t2 = note('第一種：永遠可以 forward', 0.6, 2.0);
    cap('有一種永遠可以 forward', '');
  },
  async (tok, S) => { // @1660.9
    S.g.add(0, 'R-type', R5(1)); S.g.add(1, '讀（任何指令）', L5(2)); S.g.upto(99);
    S.a = arrow(V3(S.g.cx(3) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.3, S.g.cy(1) + 0.12, 0.4), 0xc08a1f);
    txt(S.t2, '前面是 R-type：結果還來不及寫回，但其實已經算出來了 → always forward');
    cap('前面是 R-type，後面去 access register', '來不及寫，但已經算出來 → forward');
  },
  async (tok, S) => { // @1681.8
    gone(S.a); S.g.dropRow(0); S.g.dropRow(1);
    txt(S.t2, '第二種呢？');
    cap('那第二種 type 呢？', '');
  },
  async (tok, S) => { // @1694.0
    S.g.add(0, 'lw', L5(1)); S.g.add(1, '讀（任何指令）', L5(2)); S.g.upto(99);
    S.a = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(4) - 0.1, S.g.cy(1) + 0.12, 0.4), 0xd64545);
    txt(S.t2, '前一個是 load，下面馬上 access register：可以 forward 嗎？不行（箭頭往回）');
    cap('前一個是 load，下面要 access register', '這時候可以 forward 嗎？');
  },
  async (tok, S) => { // @1704.5
    gone(S.a); S.g.dropRow(1); S.g.add(1, '讀（任何指令）', [[2, 'IF'], [3, 'ID'], [4, 'ID'], [5, 'EX'], [6, 'MEM'], [7, 'WB']]); S.g.upto(99);
    S.a = arrow(V3(S.g.cx(4) + 0.3, S.g.cy(0) - 0.15, 0.4), V3(S.g.cx(5) - 0.3, S.g.cy(1) + 0.12, 0.4), 0xc08a1f);
    txt(S.t2, '一定要先 stall 一個 clock cycle，資料出來後如果還需要，再 forward');
    cap('一定要先 stall 一個 clock cycle', '然後才 forward');
  },
  async (tok, S) => { // @1711.9
    S.t3 = good('兩個 type 要分清楚：R-type 之後 → forward；load 之後 → 先 stall 1 再 forward', 0.6, 1.3);
    cap('這兩個 type 一定要分出來', '一種可以 forward，一種先 stall');
  },
]);

// branch hazard：決定點在 MEM（第 4 段）→ 3 個被 flush；搬到 ID → 只 flush 1 個
const BR_AT = (stage) => ({ decide: 1 + stage, fetchedWrong: stage, target: 2 + stage });   // beq IF 在 cycle 1；stage = 決定的段號（IF = 0）
const BRM = BR_AT(3), BRI = BR_AT(1);
scene('ppA-19b-branch', '19B：branch hazard：決定得越晚，flush 越多', [
  async (tok, S) => { // @1732.5
    S.t = hot('branch hazard', 0.6, 6.7);
    cap('再看 branch hazard', '');
  },
  async (tok, S) => { // @1745.7
    S.t2 = note('sequential：做完才決定下一個。一般 PC = PC + 4；branch taken 就跳到 target（例如 1000）', 0.6, 6.1);
    cap('一般的 instruction：PC = PC + 4', 'branch taken 就跳到 target 去');
  },
  async (tok, S) => { // @1763.3
    S.g = mkGrid(S, 9, { y0: 5.2 });
    S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID'], [3, 'EX'], [4, 'MEM', 'MEM 決定']]); S.g.row(0);
    txt(S.t2, '什麼時候才知道要不要跳？看 datapath 怎麼切 —— 可能在 EX，也可能到 MEM');
    cap('什麼時候才知道要不要跳？', '看你怎麼切 datapath，可能很後面');
  },
  async (tok, S) => { // @1786.3
    S.g.add(1, '下一個（猜）', L5(2)); S.g.upto(2);
    txt(S.t2, 'pipeline 要裝滿：beq 才到 decode，下一個就要 fetch 進來了');
    cap('pipeline 要裝滿', 'beq 才到 decode，下一個就要進來');
  },
  async (tok, S) => { // @1807.7
    txt(S.t2, '要執行的和抓進來的不一樣 → control hazard（branch hazard）；起因也是 feedback（PC 要到後面才寫）');
    cap('要執行的跟 fetch 來的不一樣', '就產生 control hazard');
  },
  async (tok, S) => { // @1833.9
    S.g.hot(0, BRM.decide, COL.gold);
    S.t3 = note('這個 pipeline 的分法：到第 4 個 stage（MEM）才決定跳去哪', 0.6, 2.0);
    cap('這個 pipeline 的分法', '要到第四個 stage 才決定');
  },
  async (tok, S) => { // @1846.1
    S.g.add(2, '再下一個（猜）', L5(3)); S.g.add(3, '再下一個（猜）', L5(4)); S.g.upto(BRM.decide);
    txt(S.t3, '如果要跳：已經進來的這幾個都要犧牲');
    cap('如果要跳，下面已經在裡面的', '都要犧牲掉');
  },
  async (tok, S) => { // @1860.4
    [1, 2, 3].forEach((k) => { for (let c = 1; c <= BRM.decide; c++) { const m = S.g.at(k, c); if (m) { tint(m, COL.bad); relabel(m, '0'); } } });
    txt(S.t3, '洗掉（flush）：control signal 全部設成 0 → 變成 no-op');
    cap('怎麼洗掉？全部設 0', '就是 no-op');
  },
  async (tok, S) => { // @1889.1
    S.t4 = good('還來得及：它們都還沒到 WB / MEM，沒改變任何 state', 0.6, 1.4);
    cap('只有 write 時才會改變 state', '在這之前都還沒改，所以來得及');
  },
  async (tok, S) => { // @1905.9
    S.g.add(4, 'target', L5(BRM.target)); S.g.row(4);
    const pen = BRM.target - 2;
    gone(S.t4); S.t4 = ok(pen === 3 && BRM.fetchedWrong === 3, 0.6, 1.4, '決定在 MEM：被 flush 3 個，target 在 cycle ' + BRM.target + ' 才 fetch → 犧牲 ' + pen + ' 個 cycle ✓');
    cap('在這個 stage 才比對', '要犧牲三個 cycle，太浪費了');
  },
  async (tok, S) => { // @1922.5
    txt(S.t3, '可不可以把決定往前移？只是多加一點 hardware');
    cap('可不可以把決定往前移一點？', '只是增加 hardware');
  },
  async (tok, S) => { // @1939.3
    S.g.hot(0, 1, '#7a1010');
    txt(S.t3, '移到 IF 可以嗎？沒辦法 —— 那時指令才剛抓進來，還不知道它是 branch');
    cap('可以移到最前面嗎？', '沒辦法，那時還不知道是什麼指令');
  },
  async (tok, S) => { // @1948.3
    S.g.cool(); S.g.hot(0, 2, COL.gold);
    txt(S.t3, '最快移到 ID：decode 完就知道是 branch，rs、rt 也讀出來了 → 比對一下就好');
    cap('已經 instruction decode', '知道是 branch、rs rt 也出來了 → 比對');
  },
  async (tok, S) => { // @1967.7
    for (let k = 1; k <= 4; k++) S.g.dropRow(k);
    S.g.dropRow(0); S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID', 'ID 決定']]); S.g.row(0); S.g.hot(0, 2, COL.gold);
    S.g.add(1, '下一個（猜）', [[2, 'IF']]); S.g.row(1);
    txt(S.t3, '猜得跟決定一樣：OK 繼續往下；猜錯：要 flush');
    cap('發現跟我猜的一樣，就繼續', '猜得不對就要 flush');
  },
  async (tok, S) => { // @1980.5
    const m = S.g.at(1, 2); tint(m, COL.bad); relabel(m, '0');
    S.g.add(2, 'target', L5(BRI.target)); S.g.row(2);
    gone(S.t4); S.t4 = ok(BRI.target - 2 === 1, 0.6, 1.4, '決定在 ID：只 flush 1 個（IF/ID 清成 0），PC 改成 target → 只犧牲 1 個 cycle ✓');
    cap('flush：把 IF/ID 變成 0', 'PC 選到你要跳去的地方');
  },
]);

// predict not taken + 在 ID 決定（課本：36 sub、40 beq $1,$3,7、44 and、72 lw）
const BRP = [parseIns('sub $10, $4, $8'), parseIns('beq $1, $3, 7', { taken: true, flushText: 'and $12, $2, $5' }), parseIns('lw $4, 50($7)')];
const BRS = schedule(BRP, { fwd: true, br: 'pnt', mem1: false });
scene('ppA-19b-pnt', '19B：predict not taken、把 branch 移到 ID、flush 一個 bubble', [
  async (tok, S) => { // @2042.6
    S.g = mkGrid(S, 9, { y0: 5.6 });
    S.t = hot('branch hazard 的例子', 0.6, 6.7);
    S.g.add(0, 'beq', [[1, 'IF'], [2, 'ID'], [3, 'EX'], [4, 'MEM', 'MEM 決定']]); S.g.row(0);
    cap('branch hazard 的例子', 'equal 的話要跳到 target');
  },
  async (tok, S) => { // @2065.0
    S.g.add(1, 'PC + 4', L5(2)); S.g.add(2, 'PC + 8', L5(3)); S.g.add(3, 'PC + 12', L5(4)); S.g.upto(4);
    S.t2 = note('不知道什麼時候要跳 → 繼續 sequential fetch：假設 not taken', 0.6, 2.4);
    cap('不知道要不要跳，還是照順序 fetch', '假設 not taken');
  },
  async (tok, S) => { // @2072.8
    [1, 2, 3].forEach((k) => { for (let c = 2; c <= 4; c++) { const m = S.g.at(k, c); if (m) tint(m, COL.bad); } });
    txt(S.t2, '真的決定時發現要跳（taken）→ 這三個全是錯的');
    cap('真的決定時發現要跳', '這三個全部都是錯的');
  },
  async (tok, S) => { // @2093.0
    txt(S.t2, 'predict always not taken：需要 hardware 把決定之後抓錯的 instruction flush 掉');
    cap('predict always not taken', '要加 hardware 把錯的 flush 掉');
  },
  async (tok, S) => { // @2115.4
    txt(S.t2, '決定放在 MEM 要 flush 好多個 → 移到前面：早點決定、錯也早點錯');
    cap('在 memory stage 要 flush 好多個', '移到前面，早點決定');
  },
  async (tok, S) => { // @2136.0
    gone(S.g); S.d = mkDP(S, { y: 1.6 });
    S.add = cube('+', '#a99470', [0.5, 0.5, 0.5], -2.8, 4.0, 0); S.eq = cube('=', '#a99470', [0.5, 0.5, 0.5], -1.9, 4.0, 0);
    S.l1 = sm('branch 位址：PC + 4 + offset × 4', -3.6, 4.7); S.l2 = sm('rs = rt ?', -1.4, 4.7);
    S.t.position.set(0, 6.7, 0); txt(S.t2, '把 branch 的 address calculation 移到 ID');
    S.t2.position.set(0, 6.0, 0);
    cap('把 branch 的 address calculation', '移到 instruction decode 這個階段');
  },
  async (tok, S) => { // @2143.9
    glow(S.eq, COL.gold);
    txt(S.t2, 'beq 的 rs、rt 在 ID 已經讀出來 → 加一個比較器（相等嗎？）→ branch decision 在 ID 就做出來');
    cap('rs、rt 已經讀出來', '做一個比較，ID 就能決定');
  },
  async (tok, S) => { // @2157.6
    S.b = S.d.chip('beq', 1, '#7a6a52'); S.w = S.d.chip('PC + 4（猜）', 0, '#bcd8f3');
    txt(S.t2, '這樣只有 IF 那裡多抓了一個 instruction 是錯的 → 只要 flush 那一個');
    cap('只有 instruction fetch 那裡', '多一個 instruction，只要 flush 它');
  },
  async (tok, S) => { // @2168.7
    glow(S.d.regs[0], '#7a1010');
    txt(S.t2, '怎麼 flush？讓 IF/ID 這次寫進去的是 0，而不是剛讀出來的指令');
    cap('怎麼 flush？', '讀進 IF/ID 的給它讀 0 就對了');
  },
  async (tok, S) => { // @2222.9
    S.m2 = cube('2→1', '#8a7a5c', [0.45, 0.7, 0.45], S.d.rx(0) - 0.55, 3.4, 0); small(S.m2.userData.lbl, 8);
    txt(S.t2, '等於 IF/ID 前面加一個 2-to-1 mux：正常寫指令；要 flush 時寫 0（IF.Flush）');
    cap('相當於一個 2-to-1 的 mux', '要 flush 時寫 0 進去');
  },
  async (tok, S) => { // @2238.5
    glow(S.eq, '#d64545');
    txt(S.t2, '在 ID 偵測：讀出來是 branch，比對結果 taken → 發出 control，讓 mux 選 0');
    cap('在這裡做 detect', '是 branch、比對成立 → 寫 0 進來');
  },
  async (tok, S) => { // @2281.9
    S.tg = S.d.chip('target', 0, '#2fc092'); S.w.position.y += 0.5; relabel(S.w, '0（bubble）'); tint(S.w, COL.bad);
    await S.d.go(tok, [[S.w, 1], [S.b, 2]], 600);
    txt(S.t2, 'target 位址已經在 ID 算好 → 下一個 cycle 直接 fetch target');
    cap('address 已經算出來了', '下一個 cycle 就讀進 target');
  },
  async (tok, S) => { // @2296.7
    S.c = ok(BRS.rows.filter((r) => r.ghost).length === 1, 0, -0.6, '犧牲的就只有一個 bubble：flush 一個 instruction ✓');
    cap('犧牲一個 bubble', '相當於把後面那個 instruction flush 掉');
  },
  async (tok, S) => { // @2332.0
    gone(S.d, S.add, S.eq, S.l1, S.l2, S.c, S.m2); S.d = null;
    S.g = mkGrid(S, 8, { y0: 5.4 });
    txt(S.t, '例子（課本）：36 sub、40 beq $1, $3, 7、44 and …、72 lw'); S.t.position.set(0.6, 6.7, 0);
    schedRows(BRS).forEach((r, k) => S.g.add(k, (['36 ', '40 ', '44 ', '72 '][k]) + r.text, r.cells.map(([c, s]) => [c, s]))); S.g.upto(2);
    txt(S.t2, ''); S.t2.position.set(0.6, 2.4, 0);
    cap('來看一個例子', 'branch equal');
  },
  async (tok, S) => { // @2338.1
    S.g.upto(3); S.g.hot(1, 3, COL.gold);
    txt(S.t2, 'cycle 3：beq 在 ID 比對 $1、$3 —— 相等（taken）');
    cap('在 ID 這邊就比對了', '比對出來相等');
  },
  async (tok, S) => { // @2356.9
    const tgt = 40 + 4 + 7 * 4;
    S.c = ok(tgt === 72, 0.6, 1.7, '要跳的 target = 40 + 4 + 7 × 4 = ' + tgt + ' ✓（在 ID 算好）');
    const m = S.g.at(2, 3); if (m) { tint(m, COL.bad); relabel(m, '0'); }
    txt(S.t2, 'taken → 下一個 clock，IF/ID 全部寫 0；PC 跳到算出來的 target');
    cap('branch taken：下一個 clock 這邊是 0', '跳到新算出來的 target address');
  },
  async (tok, S) => { // @2367.8
    S.g.upto(99);
    txt(S.t2, 'cycle 4：44 那條變成 bubble（no-op）；72 的 lw 被 fetch 進來 —— 正確的指令');
    cap('下一個 clock cycle：這邊全是 0', 'bubble；fetch 到正確的指令');
  },
  async (tok, S) => { // @2381.0
    const lw = BRS.rows[BRS.rows.length - 1];
    gone(S.c); S.c = ok(lw.IF === 4 && BRS.total === 8, 0.6, 1.7, '只犧牲 1 個 bubble：lw 在 cycle ' + lw.IF + ' fetch，3 個有效指令共 ' + BRS.total + ' 個 cycle（= 3 + 4 + 1）✓');
    cap('要犧牲的就是這一個 bubble', 'flush 一個 instruction 就可以了');
  },
]);

// dynamic branch prediction：用本章 predictRun 跑老師說的內層迴圈（taken 100 次、第 101 次 not taken）
const LOOP = ('T'.repeat(100) + 'N').split('');
const P1 = predictRun('1bit', LOOP, 0), P2 = predictRun('2bit', LOOP, 2);
const P1w = P1.filter((r) => !r.ok).length, P2w = P2.filter((r) => !r.ok).length;
const PNTw = LOOP.filter((o) => o === 'T').length;
const P2S = ['00 強 N', '01 弱 N', '10 弱 T', '11 強 T'];
scene('ppA-19b-predict', '19B：dynamic branch prediction：1-bit 錯兩次、2-bit 錯一次', [
  async (tok, S) => { // @2392.8
    S.t = hot('怎麼 predict？', 0.6, 6.7);
    cap('後面還有：怎麼樣去 predict', '');
  },
  async (tok, S) => { // @2399.4
    S.t2 = note('剛才一律預測 sequential：PC = PC + 4（not taken）—— 這樣對不對？', 0.6, 6.1);
    cap('always predict PC = PC + 4', '這樣對不對？');
  },
  async (tok, S) => { // @2411.7
    txt(S.t2, '什麼時候對、什麼時候錯？taken 要跳到 target；not taken 就是 PC + 4');
    cap('什麼時候對、什麼時候不對？', 'taken：跳到 target；not taken：PC + 4');
  },
  async (tok, S) => { // @2448.3
    S.c = code(['for (i = 0; i < 100; i++) {', '    …                     ', '}  ← 迴圈底的 branch：跳回頭', 'if (…) … else …  ← 只執行一次'], -0.6, 5.3, 0.48);
    S.c.hl(3);
    txt(S.t2, '什麼時候會跳？if-then-else');
    cap('什麼時候會跳？', 'if then else 會跳');
  },
  async (tok, S) => { // @2452.3
    S.c.hl(0);
    txt(S.t2, '還有 for loop');
    cap('還有什麼時候會跳？', 'for loop');
  },
  async (tok, S) => { // @2460.6
    S.c.hl(2);
    txt(S.t2, 'loop 最後一個 instruction 是 branch：跳回開頭 → taken，而且執行很多很多次');
    cap('loop 跳回去是 taken', '而且它執行很多很多次');
  },
  async (tok, S) => { // @2470.1
    S.c.hl(3);
    txt(S.t2, 'if-then-else 只執行一次：錯一次無所謂');
    cap('if then else 錯一次', '因為執行一次而已');
  },
  async (tok, S) => { // @2487.1
    S.c.hl(2);
    S.k = ok(PNTw === 100, 0.6, 2.4, '迴圈的 branch 一直猜 PC + 4（not taken）：101 次裡猜錯 ' + PNTw + ' 次 ✓');
    cap('一直假設 PC + 4', '迴圈就一直錯');
  },
  async (tok, S) => { // @2512.8
    gone(S.k);
    txt(S.t2, '所以做 dynamic branch prediction：每個 branch 要 taken 還是 not taken，會變化');
    cap('dynamic branch prediction', '每個 branch 的預測會變');
  },
  async (tok, S) => { // @2521.8
    txt(S.t2, '最簡單：上一次跳，這次就猜跳；上一次不跳，這次就猜不跳');
    cap('上一次跳，這次就猜跳', '上一次不跳，這次就不跳');
  },
  async (tok, S) => { // @2537.2
    gone(S.c);
    S.tb = code(['address │ 上次', '  0x40  │  T  ', '  0x88  │  N  ', '  0xA0  │  T  '], -1.4, 5.3, 0.48);
    S.tn = sm('（示意）', 1.6, 5.3);
    txt(S.t2, '怎麼記錄？每個 instruction 都有地址 → 用地址當 index，查一張表');
    cap('怎麼記錄？', '用 instruction 的地址做 index 查 table');
  },
  async (tok, S) => { // @2568.7
    S.tb.hl(1);
    txt(S.t2, '在 instruction fetch 時就查：如果是 branch 而且上次 taken，下一個就直接抓 target');
    cap('什麼時候做？在 instruction fetch', '查到 taken，下一個就抓 target');
  },
  async (tok, S) => { // @2608.9
    txt(S.t2, 'pipeline 越深、branch 越晚決定 → 猜錯要 flush 越多 → 猜準很重要');
    cap('pipeline 很長、很後面才決定', '猜錯就 flush 很多個');
  },
  async (tok, S) => { // @2662.4
    txt(S.t2, '這張表叫 branch prediction buffer，也叫 branch history table');
    cap('branch prediction buffer', '也叫 branch history table');
  },
  async (tok, S) => { // @2706.7
    txt(S.t2, '只記最近做過跳躍決定的 branch（表不可能很大）：address → taken / not taken；錯了才 flush');
    cap('用最近 branch 的位址當 index', '只記最近的 branch，錯了才 flush');
  },
  async (tok, S) => { // @2772.9
    gone(S.tb, S.tn);
    S.st = [cube('猜 N', '#dd8238', [1.4, 0.55, 0.5], -1.6, 5.1, 0), cube('猜 T', '#2fc092', [1.4, 0.55, 0.5], 1.6, 5.1, 0)];
    S.st.forEach((m) => small(m.userData.lbl, 10));
    txt(S.t2, '1-bit predictor：只看前一次 —— 永遠跟前一次一樣；錯了就趕快改');
    cap('one bit predict', '只看前一個，錯了就趕快改過來');
  },
  async (tok, S) => { // @2797.1
    S.strip = [];
    const show = [0, 1, 2, 98, 99, 100];
    show.forEach((i, j) => { const r = P1[i]; S.strip.push(cube(r.o, r.ok ? '#bcd8f3' : '#d64545', [0.42, 0.36, 0.4], -3.4 + j * 0.62 + (j >= 3 ? 0.8 : 0), 3.6, 0)); });
    S.dots = sm('…', -1.3, 3.6); S.lab1 = sm('第 1、2、3 次 … 第 99、100、101 次（實際結果；紅 = 1-bit 猜錯）', 0.6, 2.9);
    txt(S.t2, '例：inner loop 跳 100 次，第 101 次不跳；外面還有 outer loop 一再回來');
    cap('常有 inner loop、outer loop', 'inner loop 跳 100 次，第 101 次不跳');
  },
  async (tok, S) => { // @2813.7
    glow(S.strip[5], COL.gold);
    txt(S.t2, '第 101 次：預測 taken、實際 not taken → 錯一次');
    cap('第 101 次不要跳了', 'predict 錯誤一次');
  },
  async (tok, S) => { // @2826.3
    glow(S.st[0], COL.gold);
    txt(S.t2, '同時 history 改成 not taken（1-bit 只記最後一次）');
    cap('同時把 branch history 改成 not taken', '');
  },
  async (tok, S) => { // @2851.6
    glow(S.strip[0], COL.gold);
    txt(S.t2, 'outer loop 做完又回到 inner loop：第一個 iteration 實際要跳，卻猜 not taken → 又錯');
    cap('又回到 inner loop 的第一個 iteration', '猜 not taken，實際 taken → 又錯');
  },
  async (tok, S) => { // @2880.5
    S.k = ok(P1w === 2 && !P1[0].ok && !P1[100].ok, 0.6, 2.2, 'predictRun（1-bit，上次離開時是 N）：每跑一趟 inner loop 錯 ' + P1w + ' 次 —— 最後一次與下一趟的第一次 ✓');
    cap('連錯兩次', '最後一次跟下一趟第一次剛好都錯');
  },
  async (tok, S) => { // @2893.4
    gone(S.st); glow(S.st[0], null);
    S.st = P2S.map((n, i) => { const m = cube(n, i >= 2 ? '#2fc092' : '#dd8238', [1.5, 0.5, 0.5], -4.2 + i * 1.75, 5.1, 0); small(m.userData.lbl, 9); return m; });
    txt(S.t2, '改進：不要只看一次，看兩次 —— 2-bit predictor');
    cap('把它更強化一點', '不只看一次，看兩次');
  },
  async (tok, S) => { // @2903.1
    glow(S.st[2], COL.gold);
    gone(S.k); S.k = ok(P2w === 1 && P2[0].ok, 0.6, 2.2, 'predictRun（2-bit）：要連錯兩次才改預測 → 出口錯 1 次後只降到「弱 T」，下一趟第一次仍猜對：每趟只錯 ' + P2w + ' 次 ✓');
    cap('連錯兩次才改變預測', '只錯一次仍維持原來的預測');
  },
  async (tok, S) => { // @2925.2
    txt(S.t2, 'prediction 很重要，所以才有這些比較複雜的 predictor —— 下次繼續');
    cap('prediction 很重要', '下次再繼續介紹');
  },
]);
  }

  // ═══ ppB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, showL } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 4 章 Pipeline（清大 黃婷婷 第 20A、21A、21B 講 + Pipeline Hazards 英文短片）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那一句才動一下，不重播、不循環。
// 時序圖、flush 個數、predictor 的對錯次數、dual-issue 排程的 IPC、structural hazard 的 cycle 數，
// 都在這裡用小模擬算出來（也拿本章的 schedule()/predictRun() 交叉驗算），畫面顯示 ✓ / ✘。
// 老師沒給的指令、位址、數值一律在畫面上標「示意」。
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
const pk = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const ok = (b, t, x, y) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const mn = (l, n = 10) => { Object.assign(l.element.style, MONO, { fontSize: n + 'px' }); return l; };
const fs = (l, n) => { if (l && l.element) l.element.style.fontSize = n + 'px'; return l; };
const shh = (n) => note('示意', n[0], n[1]);
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#c2ecdc', lilac: '#d9cdfb', sky: '#c6def5', peach: '#f4d3b5', rose: '#efb4b4', dark: '#8d8170' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const SC = { IF: '#4b9ee2', ID: '#9b7ef4', EX: '#dd8238', MEM: '#2fc092', WB: '#e55a9b', FI: '#4b9ee2', DI: '#9b7ef4', EI: '#dd8238', WR: '#e55a9b', bubble: '#d8cfc0', nop: '#e4dccd' };
const FIVE = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.cells && o.lbls) return gone(o.lbls, o.extra || [], o.cells.flatMap((r) => Object.values(r))); if (o.bx) return gone(o.bx, o.extra || []); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const CAM = [[0, 3.4, 14], [0, 3.0, 0]];
// a scene = list of steps; each step runs when the video reaches its cue
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
async function slide(tok, o, x, y, z, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z === undefined ? a.z : z), ms); }
const fade = (m, op = 0.25) => { if (m && m.material) { m.material.transparent = true; m.material.opacity = op; } if (m && m.userData && m.userData.lbl) m.userData.lbl.element.style.opacity = op < 1 ? '0.4' : ''; };
// a flat card (a labelled block)
const card = (t, c, x, y, w = 2.6, h = 0.6, d = 0.7, n = 10) => { const m = cube(t, c, [w, h, d], x, y, 0); fs(m.userData.lbl, n); return m; };
// a little instruction token travelling through the stages
const token = (t, c, x, y, z = 0.6) => { const m = cube(t, c, [1.75, 0.4, 0.4], x, y, z); fs(m.userData.lbl, 9); return m; };
// five stage boxes in a row
function pipe5(y = 4.0, x0 = -4.4, dx = 2.2, names = FIVE) {
  const bx = names.map((s, i) => card(s, SC[s] || FC.sand, x0 + i * dx, y, 1.7, 0.8, 0.8, 11));
  return { bx, x: (i) => x0 + i * dx, y };
}
// a pipeline timing diagram (rows = instructions, columns = clock cycles), filled in step by step
function grid(labels, T, o = {}) {
  const x0 = o.x0 === undefined ? -2.2 : o.x0, w = o.w || Math.min(0.9, (6.7 - x0) / T), yTop = o.y === undefined ? 5.4 : o.y, dy = o.dy || 0.62;
  const cx = (c) => x0 + (c - 0.5) * w, cy = (k) => yTop - k * dy;
  const G = { cx, cy, w, dy, cells: labels.map(() => ({})), lbls: [], extra: [] };
  if (o.head !== false) for (let c = 1; c <= T; c++) G.lbls.push(fs(sm((o.hp || '') + c, cx(c), yTop + dy * 0.85), 9));
  G.rl = labels.map((t, k) => { const l = mn(pl(t, x0 - 0.15, cy(k)), o.fs || 10); l.center.set(1, 0.5); G.lbls.push(l); return l; });
  G.put = (k, c, s, col) => { const m = cube(s, col || SC[s] || FC.gray, [w * 0.9, dy * 0.72, 0.45], cx(c), cy(k), 0); if (m.userData.lbl) fs(m.userData.lbl, w < 0.62 ? 8 : 9); G.cells[k][c] = m; return m; };
  G.row = (k, c0, st) => st.map((s, i) => (s ? G.put(k, c0 + i, s) : null));
  G.flush = (k) => { for (const c of Object.keys(G.cells[k])) tint(G.cells[k][c], FC.rose); G.rl[k].element.style.textDecoration = 'line-through'; };
  G.hl = (k, c, col) => { if (G.cells[k][c]) glow(G.cells[k][c], col || HL); };
  G.col = (c, col) => { G.cells.forEach((r) => { if (r[c]) glow(r[c], col || HL); }); };
  G.say = (t, k, c, cls = 'idx') => { const l = fs(tag(t, cls, cx(c), cy(k) + dy * 0.02, 0.5), 9); G.extra.push(l); return l; };
  return G;
}
// branch resolved at the end of stage d (IF = 1): the d − 1 instructions fetched after it are wrong-path → flushed
function brSim(d) {
  const rows = [{ IF: 1, kind: 'br' }];
  for (let c = 2; c <= d; c++) rows.push({ IF: c, kind: 'flush' });
  rows.push({ IF: d + 1, kind: 'target' });
  return { rows, pen: d - 1 };
}
// cross-check with the chapter's own schedule(): beq resolved in ID, taken
const SB = schedule([parseIns('beq $1, $3, 7', { taken: true, flushText: 'x' }), parseIns('lw $4, 50($7)')], { fwd: true, br: 'pnt', mem1: false });
const PEN_ID_OK = SB.rows[2].IF - SB.rows[0].IF - 1 === brSim(2).pen && brSim(2).pen === 1 && brSim(4).pen === 3;
// draw a branch-flush diagram from brSim
function brGrid(d, o = {}) {
  const R = brSim(d), T = o.T || d + 5;
  const names = R.rows.map((r, i) => (r.kind === 'br' ? (o.br || 'beq（成立）') : r.kind === 'target' ? (o.tg || 'target 的指令') : (o.wr || '錯路指令 ') + i));
  const G = grid(names, T, o);
  G.R = R;
  G.fill = (upto) => R.rows.forEach((r, k) => FIVE.forEach((s, i) => { const c = r.IF + i; if (c <= upto && c <= T && !G.cells[k][c] && !(r.kind === 'flush' && c > d)) G.put(k, c, s); }));
  return G;
}
// MIPS machine code (for the "all-zero instruction = nop" step)
const encI = (op, rs, rt, imm) => (((op << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff)) >>> 0);
const hex8 = (n) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
// a strip of T/N outcome cubes
function strip(items, x0, y, w = 0.42, colf) {
  return items.map((s, i) => { const m = cube(s, colf ? colf(s, i) : (s === 'T' ? FC.green : s === 'N' ? FC.orange : FC.paper), [w * 0.9, 0.36, 0.4], x0 + i * w, y, 0); fs(m.userData.lbl, 9); return m; });
}
// a small table: rows of cells
function table(x, yTop, cols, rows, o = {}) {
  const ws = o.ws || cols.map(() => 1.4), dy = o.dy || 0.56;
  const xs = []; let acc = x; ws.forEach((w) => { xs.push(acc + w / 2); acc += w + 0.06; });
  const lbls = cols.map((c, j) => fs(sm(c, xs[j], yTop + 0.5), 10));
  const cells = rows.map((r, i) => r.map((v, j) => { const m = cube(v === '' ? ' ' : v, o.c || FC.paper, [ws[j], dy - 0.08, 0.5], xs[j], yTop - i * dy, 0); fs(m.userData.lbl, 10); return m; }));
  return { cells, lbls, xs, y: (i) => yTop - i * dy, set(i, j, v) { relabel(cells[i][j], v); }, add(r) { const i = cells.length; cells.push(r.map((v, j) => { const m = cube(v === '' ? ' ' : v, o.c || FC.paper, [ws[j], dy - 0.08, 0.5], xs[j], yTop - i * dy, 0); fs(m.userData.lbl, 10); return m; })); return i; } };
}
const killT = (t) => gone(t.lbls, t.cells.flat());

// ════════ II7Eh-Q8hdI（第 20A 講：control hazard、flush、branch prediction、delayed branch、exception） ════════
scene('ppB-20a-recap', '20A：回顧兩種 hazard', [
  async (tok, S) => { // 20.6
    hd('Pipeline 的 hazard（上次講到）', 0, 6.4);
    S.d = card('data hazard', FC.sky, -3.3, 5.3, 3.2, 0.7); S.c = card('control hazard', FC.peach, 3.3, 5.3, 3.2, 0.7);
    cap('hazard 有兩種', 'data hazard、control hazard');
  },
  async (tok, S) => { // 22.0
    glow(S.d, HL);
    S.code = code(['add $1, $2, $3   # 寫 $1', 'sub $4, $1, $5   # 讀 $1'], -3.3, 4.1, 0.55);
    S.a = arrow(V3(-5.6, 3.95, 0.3), V3(-4.4, 3.5, 0.3), 0xc08a1f); shh([-0.6, 4.1]);
    cap('data hazard：data dependence', '後面的指令要用前面指令的結果');
  },
  async (tok, S) => { // 46.4
    S.r = card('$1 = 舊值', FC.rose, -3.3, 2.5, 2.4, 0.6);
    sm('add 還在後面的 stage，還沒寫回', -3.3, 1.8);
    bad('sub 讀到舊的資料 ✘', -3.3, 1.2);
    cap('前面的指令還沒 update', 'access 到舊的資料');
  },
  async (tok, S) => { // 58.4
    good('解法：forwarding（算出來就直接送過去）', -2.6, 0.4); sm('或 stall：先等一下', -2.6, -0.2);
    cap('用 forwarding 處理', '或是 stall（停下來等）');
  },
  async (tok, S) => { // 65.8
    glow(S.d, null); glow(S.c, HL);
    bub('另一種：control hazard', 3.3, 4.2); sm('跟 branch 指令有關', 3.3, 3.5);
    cap('另一種叫 control hazard', '什麼叫 control hazard？');
  },
]);

scene('ppB-20a-ctrl', '20A：branch 還沒決定，下一個就要 fetch', [
  async (tok, S) => { // 94.1
    hd('Control hazard：branch 指令造成的', 0, 6.4);
    S.p = pipe5(4.4); S.b = token('beq', FC.gold, S.p.x(0), 3.6);
    cap('control hazard 是 branch 造成的', '');
  },
  async (tok, S) => { // 107.5
    sm('pipeline：每個 clock cycle 都要 fetch 一個指令', 0, 5.5);
    cap('pipeline 每個 cycle 都要 fetch', '一個 cycle 抓一個指令進來');
  },
  async (tok, S) => { // 119.0
    await slide(tok, S.b, S.p.x(1), 3.6);
    S.q = token('?', FC.rose, S.p.x(0), 3.6);
    cap('beq 進到 decode', '下一個指令已經要 fetch 了');
  },
  async (tok, S) => { // 129.7
    hot('要 fetch 哪一個？不知道！', S.p.x(0), 2.7);
    cap('知道要 fetch 哪裡嗎？', '不知道：branch 還沒決定');
  },
  async (tok, S) => { // 134.1
    S.a1 = arrow(V3(S.p.x(0), 2.3, 0.3), V3(-6.0, 1.4, 0.3), 0x4b9ee2); S.a2 = arrow(V3(S.p.x(0), 2.3, 0.3), V3(-2.4, 1.4, 0.3), 0xdd8238);
    pl('PC + 4（not taken）', -5.6, 1.0); pl('target（taken）', -2.0, 1.0);
    cap('可能 sequential：PC = PC + 4', '條件成立（taken）就跳到 target');
  },
  async (tok, S) => { // 152.6
    sm('unconditional（j）：不管怎樣都要跳', 3.0, 2.4);
    cap('unconditional branch', '不管怎樣都跳到別的地方');
  },
  async (tok, S) => { // 160.7
    note('可是下一個 cycle 一定要 fetch 一個', 3.0, 1.7);
    cap('下一個一定要 fetch', '抓的也許對、也許錯');
  },
  async (tok, S) => { // 172.7
    tint(S.q, FC.red); bad('fetch 錯了 → control hazard', 3.0, 0.9);
    cap('fetch 錯了', '這就叫 control hazard 產生');
  },
]);

scene('ppB-20a-flush', '20A：猜錯就 flush', [
  async (tok, S) => { // 174.6
    hd('發生 control hazard 要做什麼？', 0, 6.4);
    S.p = pipe5(4.4); S.b = token('beq（要跳）', FC.gold, S.p.x(1), 3.6); S.w = token('lw（錯的路）', FC.rose, S.p.x(0), 3.6);
    cap('萬一發生 control hazard', '要做什麼動作？');
  },
  async (tok, S) => { // 188.0
    hot('發現要跳的地方不一樣 → flush！', S.p.x(0) + 1.4, 2.6);
    cap('發現 fetch 的地方不對', '就把它 flush 掉');
  },
  async (tok, S) => { // 199.2
    await slide(tok, S.w, S.p.x(0), 1.2, 0.6, 700); fade(S.w);
    pl('像馬桶一樣沖掉', S.p.x(0), 0.5);
    cap('flush：像沖馬桶一樣沖掉', '');
  },
  async (tok, S) => { // 202.3
    good('還沒 write 之前，state 都沒改變 → 沖掉不會壞事', 0.6, -0.3);
    cap('只要還沒 write', 'state 沒改變，沖掉都 OK');
  },
]);

scene('ppB-20a-bubble', '20A：flush = 變成 bubble（no-op）', [
  async (tok, S) => { // 267.0
    hd('flush 一個指令 = 把它變成 bubble', 0, 6.4);
    S.i = card('and $12, $2, $5', FC.blue, -3.4, 4.6, 3.0, 0.7); shh([-3.4, 5.4]);
    await wt(tok, 500); relabel(S.i, 'bubble'); tint(S.i, SC.bubble);
    cap('flush 就是把它變成 bubble', '');
  },
  async (tok, S) => { // 278.7
    S.reg = prop('cpu', 2.0, 3.6, 0, 1.0, 'registers'); S.mem = prop('disk', 4.6, 3.6, 0, 0.9, 'memory');
    S.lk = prop('lock', 3.3, 5.0, 0, 1.0);
    cap('怎樣才算變成 bubble？', '不改變任何 state（暫存器、記憶體）');
  },
  async (tok, S) => { // 281.2
    relabel(S.i, 'no-op：什麼都不做');
    cap('就是一個 no-op', '它待會不會去 write 任何東西');
  },
  async (tok, S) => { // 286.1
    good('read：沒關係 ✓', -3.4, 3.4); bad('write：會改變 state ✘', -3.4, 2.7);
    cap('read 還無所謂', 'write 才會改變 state');
  },
]);

const LW_CODE = encI(35, 7, 4, 50);                 // lw $4, 50($7)
const NOP_OK = hex8(0) === '0x00000000' && LW_CODE === 0x8CE40032;   // 全 0 = sll $0,$0,0 = nop
scene('ppB-20a-zero', '20A：flush = control signal 全部設 0', [
  async (tok, S) => { // 325.7
    hd('怎麼 flush：control signal 全部設成 0', 0, 6.4);
    const nm = ['RegWrite', 'MemRead', 'MemWrite', 'Branch', 'MemtoReg', 'ALUSrc'], v0 = ['1', '1', '0', '0', '1', '1'];
    S.sig = nm.map((n, i) => { fs(sm(n, -5.0 + i * 2.0, 5.5), 9); return card(v0[i], FC.green, -5.0 + i * 2.0, 4.9, 1.2, 0.55); });
    sm('（lw 在 ID decode 出來的 control signal，示意）', 0, 4.25);
    await wt(tok, 600); S.sig.forEach((m) => { relabel(m, '0'); tint(m, FC.gray); });
    cap('把 control signal 全部設 0', '');
  },
  async (tok, S) => { // 333.5
    good('全部是 0 → 不寫暫存器、不讀寫記憶體 → 不做任何動作', 0, 3.6);
    cap('設成 0 就不會做任何動作', '');
  },
  async (tok, S) => { // 340.3
    S.ins = card('lw $4, 50($7) = ' + hex8(LW_CODE), FC.blue, -2.4, 2.4, 5.0, 0.6); fs(sm('IF/ID', -5.6, 2.4), 10);
    await wt(tok, 600); relabel(S.ins, hex8(0) + ' = sll $0, $0, 0 = nop'); tint(S.ins, FC.gray);
    ok(NOP_OK, '機器碼驗算 ✓', 3.6, 2.4);
    cap('還在 IF：把整個指令設成 0', 'opcode 全 0 的指令什麼都不做');
  },
  async (tok, S) => { // 351.7
    pl('已在 pipeline 裡 → decode 出來的 control signal 設 0', 0, 1.3); pl('還在 IF → 整個指令設 0', 0, 0.7);
    cap('整理：flush 就是 disable', '在跑的設 control、在 IF 的設指令');
  },
  async (tok, S) => { // 378.7
    hot('= 塞一個 bubble：no-op（no operation）', 0, 0.0);
    cap('等於塞了一個 bubble', 'no-op：no operation');
  },
  async (tok, S) => { // 384.0
    bub('control hazard 猜錯 → 做 flush', 0, -0.7);
    cap('control hazard 猜錯的時候', '要做的就是 flush');
  },
]);

scene('ppB-20a-early', '20A：決定越早越好：從第 4 stage 移到第 2 stage', [
  async (tok, S) => { // 392.2
    hd('flush 會傷害 performance', 0, 6.6);
    cap('flush 會傷害 performance', 'pipeline 本來是為了提高效能');
  },
  async (tok, S) => { // 405.0
    S.A = brGrid(4, { y: 5.5, T: 9, dy: 0.5, x0: -1.8 }); S.A.fill(4);
    sm('branch 在第 4 個 stage（MEM）才決定', 3.0, 3.0);
    cap('做到一半才發現下面全錯了', 'flush 掉 → 剛才都白做了');
  },
  async (tok, S) => { // 414.1
    hot('發現得越早越好', -5.0, 6.0);
    cap('這種情況要越早發現越好', '常常發生的話很浪費效能');
  },
  async (tok, S) => { // 426.0
    S.A.hl(0, 2, '#3a2a6a');
    S.A.say('我們的設計：ID 就決定', 0, 7.2, 'note');
    cap('我們的 5 個 stage 設計', '在第 2 個 stage（decode）就決定');
  },
  async (tok, S) => { // 443.7
    S.A.hl(0, 4);
    cap('flush 幾個？', '本來是在第 4 個 stage 才決定');
  },
  async (tok, S) => { // 473.9
    for (let k = 1; k <= 3; k++) S.A.flush(k);
    S.A.fill(9); S.A.say('flush ' + S.A.R.pen + ' 個', 2, 6.0, 'bad');
    ok(S.A.R.pen === 3, 'MEM 決定：penalty = 4 − 1 = 3 ✓', 3.6, 2.4);
    cap('第 4 個 stage 決定', '後面 3 個全部 flush：犧牲 3 個 cycle');
  },
  async (tok, S) => { // 504.6
    S.B = brGrid(2, { y: 1.5, T: 9, dy: 0.5, x0: -1.8, head: false }); S.B.fill(2);
    cap('移到第 2 個 stage', '那要 flush 幾個指令？');
  },
  async (tok, S) => { // 518.7
    S.B.flush(1); S.B.fill(9); S.B.say('flush ' + S.B.R.pen + ' 個', 1, 4.0, 'good');
    ok(PEN_ID_OK, 'ID 決定：penalty = 1 ✓（和本章 schedule() 一致）', 2.2, -0.3);
    cap('一個', '決定提早到 ID：只 flush 1 個');
  },
  async (tok, S) => { // 521.0
    bub('決定越前面 flush 越少；越後面，後面的全部要 flush', 0, -0.9);
    cap('decision 的 stage 在哪很重要', '越後面，猜錯要 flush 的越多');
  },
]);

// deeper pipeline: penalty = (decision stage) − 1
const DEEP = [['5 stage，ID 決定', 5, 2], ['5 stage，MEM 決定', 5, 4], ['8 stage，第 6 stage 決定（示意）', 8, 6]];
scene('ppB-20a-deep', '20A：深的 pipeline，猜錯的 penalty 更大', [
  async (tok, S) => { // 544.2
    hd('deeper / superscalar pipeline', 0, 6.4);
    S.r = DEEP.map(([n, st], k) => { mn(pl(n, -3.2, 5.0 - k * 1.1), 10).center.set(1, 0.5); return Array.from({ length: st }, (_, i) => card('S' + (i + 1), FC.sky, -2.6 + i * 0.95, 5.0 - k * 1.1, 0.85, 0.5, 0.5, 9)); });
    S.r[0].concat(S.r[1]).forEach(fade);
    cap('pipeline 切得很長', '7 個、8 個 stage');
  },
  async (tok, S) => { // 558.1
    const [, , d] = DEEP[2]; for (let i = 0; i < d; i++) tint(S.r[2][i], i === d - 1 ? FC.gold : FC.rose);
    S.p2 = bad('猜錯：前面 ' + (d - 1) + ' 個要 flush', -3.0, 1.9);
    cap('決定又在很後面', '每次猜錯都要犧牲很多 cycle');
  },
  async (tok, S) => { // 569.3
    hot('branch penalty 更 significant', 3.2, 1.9);
    cap('branch penalty 就很大', '');
  },
  async (tok, S) => { // 572.1
    S.r[0].concat(S.r[1]).forEach((m) => fade(m, 1));
    DEEP.slice(0, 2).forEach(([, , d], k) => { for (let i = 0; i < d; i++) tint(S.r[k][i], i === d - 1 ? FC.gold : FC.rose); sm('penalty ' + (d - 1), 3.0, 5.0 - k * 1.1); });
    ok(DEEP.every(([, , d]) => brSim(d).pen === d - 1), 'penalty = 決定的 stage − 1 ✓', 0, 1.2);
    cap('我們的 design 猜錯', '只犧牲一個 clock cycle，還 OK');
  },
  async (tok, S) => { // 579.3
    sm('切越多 stage → 每個 cycle 越短 → performance 越高', 0, 0.5); sm('可是 flush 一次，後面的 cycle 全部犧牲', 0, -0.1);
    cap('越深 performance 越高', '但越後面才決定，penalty 越大');
  },
  async (tok, S) => { // 599.8
    good('所以：猜對很重要', 0, -0.8);
    cap('所以猜對這件事很重要', '');
  },
]);

scene('ppB-20a-pnt', '20A：最簡單的猜法：predict not taken', [
  async (tok, S) => { // 609.7
    hd('最簡單的猜法是什麼？', 0, 6.4);
    S.p = pipe5(4.4); S.b = token('beq', FC.gold, S.p.x(1), 3.6); S.q = token('?', FC.rose, S.p.x(0), 3.6);
    cap('最簡單的猜法是什麼？', '');
  },
  async (tok, S) => { // 625.1
    sm('beq 要到第 2 個 stage（decode）才決定', S.p.x(2) + 1.0, 2.8);
    cap('beq 要到 decode 才能決定', '可是第 1 個 stage 已經要 fetch');
  },
  async (tok, S) => { // 641.3
    hot('fetch 哪一個 = 在猜', S.p.x(0), 2.8);
    cap('要 fetch 哪個指令', '其實就是在猜');
  },
  async (tok, S) => { // 682.7
    note('可以猜「跟上一次一樣」：要記錄下來 → 比較複雜', 0, 1.9);
    cap('可以猜跟上一次一樣', '要記錄上次的結果，比較複雜');
  },
  async (tok, S) => { // 697.3
    relabel(S.q, 'PC + 4'); tint(S.q, FC.blue);
    good('最直覺：PC = PC + 4（predict not taken）', 0, 1.2);
    cap('直覺的猜法：PC = PC + 4', '假設它是 sequential 執行');
  },
  async (tok, S) => { // 714.1
    bad('萬一真的跳到 target → 猜錯 → flush、重新來過', 0, 0.5);
    cap('萬一真的跳了', '表示猜錯，重新來過');
  },
]);

// predict-not-taken on a loop back-branch: the loop runs N times → N − 1 taken, all mispredicted
const LOOPN = 1000;
const LOOP_OUT = 'T'.repeat(LOOPN - 1) + 'N';
const PNT_WRONG = LOOP_OUT.split('').filter((o) => o !== 'N').length;
scene('ppB-20a-loop', '20A：loop：猜 PC + 4 每次都錯', [
  async (tok, S) => { // 719.0
    hd('猜 PC + 4 常常會錯：看 loop', 0, 6.4);
    cap('猜 PC + 4 常常會錯', '為什麼？看 loop');
  },
  async (tok, S) => { // 735.0
    S.c = code(['Loop: lw   $t0, 0($s1)', '      ...', '      addi $s1, $s1, -4', '      bne  $s1, $zero, Loop', '      （跳出 loop）'], -3.0, 5.4, 0.55);
    shh([0.4, 5.4]); S.c.hl(3);
    S.a = arrow(V3(-0.2, 3.75, 0.3), V3(-0.2, 5.3, 0.3), 0x2fc092); sm('繼續 → 跳回 loop 頭', 1.9, 4.6);
    cap('loop 最後是一個 branch', '繼續就跳回 loop 頭，結束就跳出');
  },
  async (tok, S) => { // 760.6
    bad('正常要跳回頭（taken），猜 PC + 4 就錯', 0, 2.3);
    cap('正常狀況它應該跳回頭', '猜 PC + 4 一定猜錯');
  },
  async (tok, S) => { // 775.7
    sm('錯一兩次沒關係？可是 loop 可能執行 1000 次、1 萬次', 0, 1.6);
    cap('錯一兩次沒關係嗎？', 'loop 會執行很多次');
  },
  async (tok, S) => { // 785.5
    S.s = strip(['T', 'T', 'T', '…', 'T', 'N'], -2.2, 0.8, 0.6);
    ok(PNT_WRONG === LOOPN - 1, 'loop ' + LOOPN + ' 次：taken ' + (LOOPN - 1) + ' 次，猜 PC+4 錯 ' + PNT_WRONG + ' 次 ✓', 0.6, 0.0);
    cap('每次要跳回頭都猜錯', '');
  },
  async (tok, S) => { // 797.6
    hot('不能只用 PC + 4 → 要更複雜一點的 prediction', 0, -0.7);
    cap('不能只用 PC + 4 當預測', '要比較複雜的方法');
  },
]);

scene('ppB-20a-bht', '20A：branch prediction buffer 與 associative memory', [
  async (tok, S) => { // 801.2
    hd('branch prediction buffer（像一個 table）', 0, 6.5);
    S.t = table(-6.2, 5.3, ['branch 位址', '上次 T / N'], [[' ', ' ']], { ws: [1.8, 1.6] });
    cap('比較複雜的 branch prediction buffer', '就像一個 table');
  },
  async (tok, S) => { // 807.7
    sm('記錄上一次是跳（taken）還是不跳', -4.5, 4.4);
    cap('記錄上一次跳去哪裡', '');
  },
  async (tok, S) => { // 815.7
    S.t.set(0, 0, '48（示意）'); S.t.set(0, 1, '0 = not taken');
    cap('一開始用 default', '假設一開始都猜 not taken');
  },
  async (tok, S) => { // 849.3
    bad('實際要跳到 target → 猜錯', 1.6, 5.3);
    await wt(tok, 500); S.t.set(0, 1, '1 = taken'); glow(S.t.cells[0][1], HL);
    cap('結果它要跳 → 猜錯了', '趕快把這個 bit update');
  },
  async (tok, S) => { // 862.4
    good('下次再到這個指令 → 猜 taken', 1.6, 4.6);
    sm('記錄上一次的狀況：branch history table', 1.6, 4.0);
    cap('下次就猜 taken', '這叫 branch history table');
  },
  async (tok, S) => { // 873.0
    S.pc = card('PC = 48', FC.gold, -5.3, 3.0, 1.8, 0.6); shh([-5.3, 2.3]);
    cap('怎麼 implement？', 'branch 的位址（PC）是知道的');
  },
  async (tok, S) => { // 905.0
    hot('用 associative memory', 1.6, 3.0);
    cap('用一種 associative memory', '');
  },
  async (tok, S) => { // 912.1
    S.arr = Array.from({ length: 10 }, (_, i) => card(String(i * 100), FC.sky, -5.4 + i * 0.95, 1.6, 0.85, 0.45, 0.5, 9));
    sm('一般 array：知道 index 100，就直接去第 100 格', -1.2, 0.9);
    cap('array 的 index 是固定的', '知道 100 就去 100 的地方看');
  },
  async (tok, S) => { // 925.1
    bad('全部位址都留一格 → 要很大一塊 memory', -1.2, 0.3);
    cap('把整個 memory space 都記一份', '要很大一塊 memory');
  },
  async (tok, S) => { // 935.6
    gone(S.arr);
    S.as = [0, 1, 2, 3, 4].map((i) => card('entry ' + i, FC.mint, -5.0 + i * 2.5, 1.6, 2.1, 0.5, 0.5, 9));
    sm('associative：只有 5 個 entry；拿位址去跟「每個 entry 存的位址」比對，match 就讀出內容', 0, 0.9);
    cap('associative memory：只有 5 個 entry', '比對 content，match 才讀出來');
  },
  async (tok, S) => { // 974.4
    S.as.forEach((m, i) => relabel(m, ['48 → T', '96 → N', '120 → T', '200 → T', '64 → N'][i])); shh([5.6, 2.3]);
    cap('記錄最近 5 個 branch 的位址', '和它是 taken 還是 not taken');
  },
  async (tok, S) => { // 986.7
    S.as.forEach((m) => glow(m, '#3a2a6a')); await wt(tok, 500); S.as.forEach((m) => glow(m, null)); glow(S.as[0], HL);
    sm('5 個 entry「同時」比對；都沒 match → 照 default 做', 0, 0.3);
    cap('用位址同時去跟 5 個 entry 比', '沒 match 就照 default');
  },
]);

// associative lookup example the lecturer gives: index 3 → A, 5 → B, 7 → C
const AS_E = [[3, 'A'], [5, 'B'], [7, 'C']];
const look = (k) => { const h = AS_E.filter(([i]) => i === k); return h.length ? h[0][1] : null; };
scene('ppB-20a-assoc', '20A：cache 與 associative 查表', [
  async (tok, S) => { // 1009.4
    hd('這種 memory 在下一章：cache', 0, 6.5);
    cap('這種 memory 下一章會介紹', 'cache');
  },
  async (tok, S) => { // 1019.5
    S.cpu = prop('cpu', -4.6, 4.0, 0, 1.1, 'CPU'); S.mem = prop('disk', 4.2, 3.8, 0, 1.0, 'memory（off chip）');
    cap('memory 分很多層次', 'memory 在 chip 外面，access 很久');
  },
  async (tok, S) => { // 1042.0
    sm('clock cycle = 最長那個 stage；MEM 真的去 memory → 每個 stage 都很長', 0, 2.8);
    cap('clock cycle 要配合最長的 stage', '真的去 memory，每個 stage 都變很長');
  },
  async (tok, S) => { // 1055.1
    S.ca = card('cache（小、快）', FC.mint, -0.4, 4.3, 2.4, 0.7);
    good('最常用的放 cache → 一個 cycle 就夠', -0.4, 3.5);
    cap('有一個小小的 cache', '最常用的放裡面，一個 cycle 就拿到');
  },
  async (tok, S) => { // 1072.0
    gone(S.cpu, S.mem, S.ca);
    S.t = table(-2.6, 1.9, ['index（要寫出來）', 'value'], AS_E.map(([i, v]) => [String(i), v]), { ws: [2.2, 1.4] });
    cap('branch history table 也一樣', 'index 要寫出來存在表裡');
  },
  async (tok, S) => { // 1091.6
    note('老師的例子：只有 3 個 entry', 3.4, 1.9);
    cap('例：只有 3 個 entry', 'index 3、5、7');
  },
  async (tok, S) => { // 1106.0
    S.q = card('要讀 5', FC.gold, -5.4, 1.4, 1.6, 0.6);
    S.t.cells.forEach((r) => glow(r[0], '#3a2a6a')); await wt(tok, 500); S.t.cells.forEach((r) => glow(r[0], null));
    const k = AS_E.findIndex(([i]) => i === 5); glow(S.t.cells[k][0], HL); glow(S.t.cells[k][1], HL);
    ok(look(5) === 'B', '同時跟 3、5、7 比 → match 5 → 讀出 ' + look(5) + ' ✓', 3.4, 1.2);
    cap('access 5：同時跟 3、5、7 比對', 'match 5 → B 讀出來');
  },
  async (tok, S) => { // 1114.0
    S.t.cells.forEach((r) => r.forEach((m) => glow(m, null))); relabel(S.q, '要讀 4');
    ok(look(4) === null, '4：沒有 match → 什麼都不讀出 ✓', 3.4, 0.5);
    cap('access 4：沒有 match', '就不讀任何東西出來');
  },
  async (tok, S) => { // 1131.0
    sm('不用每個位址都記：只記最近有跳的那幾個（位址和內容都要記）', 0, -0.3);
    cap('不用每個位址都記下來', '只記最近有跳的那幾個');
  },
  async (tok, S) => { // 1150.5
    good('用 associative memory 實作，結果存在 table 裡', 0, -0.9);
    cap('用 associative memory 實作', '結果也 store 在 table 裡');
  },
]);

scene('ppB-20a-flip', '20A：fetch 先查表；猜錯要 flush 並 flip', [
  async (tok, S) => { // 1162.0
    hd('fetch 之前先 check table', 0, 6.5);
    S.pc = card('PC', FC.gold, -5.4, 4.8, 1.2, 0.6); S.t = table(-3.6, 5.0, ['branch 位址', 'T / N'], [['48', '1 = taken'], ['96', '0 = not taken']], { ws: [1.7, 1.8] }); shh([0.4, 5.6]);
    cap('instruction fetch 的時候', '先去查這個 table 有沒有 match');
  },
  async (tok, S) => { // 1173.1
    glow(S.t.cells[0][0], HL); glow(S.t.cells[0][1], HL);
    pl('match → 讀出預測，開始 fetch：', 3.2, 5.0); sm('fall through：PC + 4（not taken）', 3.2, 4.4); sm('或 target address（taken）', 3.2, 3.9);
    cap('match 就讀出預測', 'fetch fall through 或 target');
  },
  async (tok, S) => { // 1186.1
    note('target address 也要記下來（等一下講）', 3.2, 3.2);
    cap('target address 也要記下來', '不然怎麼知道 target 在哪');
  },
  async (tok, S) => { // 1190.2
    bad('不對的話：flush pipeline，flip prediction', 0, 2.3);
    cap('猜錯的話', 'flush pipeline、flip 預測');
  },
  async (tok, S) => { // 1207.2
    sm('只用一個 bit 記錄 → 錯了馬上 flip', 0, 1.6);
    cap('用一個 bit 記錄', '錯了就馬上把它 flip 過來');
  },
  async (tok, S) => { // 1213.2
    pl('原來記 taken，這次實際 not taken：', -1.0, 0.9);
    await wt(tok, 500); S.t.set(0, 1, '0 = not taken'); tint(S.t.cells[0][1], FC.peach);
    cap('原來記錄是 taken', '實際 not taken → bit flip 成 0');
  },
  async (tok, S) => { // 1223.6
    good('除了 flush pipeline，還要 flip prediction', 0, 0.2);
    cap('除了 flush pipeline', '還要 flip prediction');
  },
  async (tok, S) => { // 1240.4
    hot('prediction 錯 → penalty 大 → 要做得好一點', 0, -0.5);
    cap('prediction 錯誤的 penalty 很大', '希望把 prediction 做好一點');
  },
]);

scene('ppB-20a-1bit', '20A：1-bit predictor 不夠：loop 的問題', [
  async (tok, S) => { // 1248.2
    hd('1-bit predictor', 0, 6.5);
    S.b = card('bit = 1', FC.gold, -4.6, 5.0, 1.6, 0.7); sm('上次跳 = 1，不跳 = 0', -4.6, 4.3);
    cap('一個 bit：記錄上一次跳還是不跳', '跳記 1、不跳記 0，照上次的做');
  },
  async (tok, S) => { // 1264.4
    bad('這種狀況一個 bit 不夠', 1.6, 5.0);
    cap('可是一個 bit 不夠', '為什麼？');
  },
  async (tok, S) => { // 1281.2
    S.c = code(['for (i = 0; i < 100; i++)     // outer loop', '  for (j = 0; j < 50; j++)    // inner loop', '    ...'], 0.6, 3.6, 0.55);
    cap('outer loop 常常發生', 'inner 50 次、outer 100 次');
  },
  async (tok, S) => { // 1295.2
    sm('inner loop 每跑完一輪就錯 → outer 100 次就錯 100 次以上', 0.6, 1.8);
    cap('只要牽涉到 loop', 'penalty 都非常大');
  },
  async (tok, S) => { // 1311.4
    hot('make the common case fast：特別注意 loop', 0.6, 1.0);
    cap('optimization 要特別注意 loop', 'make the common case fast');
  },
]);

// 1-bit predictor on the inner loop: 100 taken + 1 not taken per run; three runs of the inner loop
const RUN = 'T'.repeat(100) + 'N';
const R1 = predictRun('1bit', (RUN + RUN + RUN).split(''), 1);       // bit = 1 (上次是 taken)
const miss1 = [0, 1, 2].map((r) => R1.slice(r * 101, r * 101 + 101).filter((x) => !x.ok).length);
const exit1 = R1[100], enter2 = R1[101];
const ONEBIT_OK = miss1[0] === 1 && miss1[1] === 2 && miss1[2] === 2 && !exit1.ok && exit1.after === 0 && !enter2.ok && enter2.pred === false;
scene('ppB-20a-1bitrun', '20A：1-bit 跑巢狀 loop：出口錯、再進來又錯', [
  async (tok, S) => { // 1356.1
    hd('inner loop：執行 100 次，每次都跳', 0, 6.5);
    pl('實際', -6.0, 4.4); S.o = strip(['T', 'T', 'T', '…', 'T'], -4.8, 4.4, 0.6); sm('第 1 ～ 100 次', -3.6, 3.8);
    cap('inner loop 執行 100 次', '每次都 taken：跳、跳、跳');
  },
  async (tok, S) => { // 1369.6
    S.o.push(...strip(['N'], -1.8, 4.4, 0.6)); sm('第 101 次：結束，不跳', -0.4, 3.8);
    cap('第 101 次', 'loop 結束了，不要跳了');
  },
  async (tok, S) => { // 1380.5
    S.bit = card('bit = 1', FC.gold, 3.6, 4.4, 1.6, 0.7); sm('只有一個 bit，記的是 taken', 3.6, 3.7);
    cap('可是只有一個 bit', '記錄是 taken taken taken：bit = 1');
  },
  async (tok, S) => { // 1388.6
    pl('預測', -6.0, 5.2); strip(['T', 'T', 'T', '…', 'T', 'T'], -4.8, 5.2, 0.6, (s, i) => (i === 5 ? FC.red : FC.sky));
    bad('第 101 次預測 taken → 錯 ✘', -1.0, 2.9);
    cap('前 100 次都對', '第 101 次還是預測 taken → 錯');
  },
  async (tok, S) => { // 1405.5
    sm('錯了 → flush pipeline', -1.0, 2.3);
    cap('錯了就 flush', '');
  },
  async (tok, S) => { // 1414.1
    relabel(S.bit, 'bit = 0'); tint(S.bit, FC.peach);
    cap('predict 錯誤', '把 prediction bit flip 成 0（not taken）');
  },
  async (tok, S) => { // 1428.1
    note('跳出 inner loop，回到 outer loop 繼續做', 3.0, 2.3);
    cap('已經跳出 inner loop', '回到 outer loop');
  },
  async (tok, S) => { // 1440.2
    gone(S.o); pl('再次進入 inner loop：', -3.6, 1.4);
    S.p2 = card('預測 N', FC.peach, -0.6, 1.4, 1.4, 0.5);
    cap('outer loop 做完一圈，再進 inner loop', 'bit 是 0 → 預測 not taken');
  },
  async (tok, S) => { // 1459.0
    S.a2 = card('實際 T', FC.green, 1.2, 1.4, 1.4, 0.5); tint(S.p2, FC.red);
    bad('進 loop 的第一次應該 taken → 又錯 ✘', 0.4, 0.6);
    cap('可是進 loop 第一次應該 taken', '又錯了');
  },
  async (tok, S) => { // 1467.2
    sm('taken → not taken 只是一次性的；只錯一次就 flip，太早了', 0.4, 0.0);
    cap('taken 到 not taken 只是一次性', '錯一次就設成 0，太早了');
  },
  async (tok, S) => { // 1495.2
    ok(ONEBIT_OK, '模擬 3 輪 inner loop：錯 ' + miss1.join('、') + ' 次 → 之後每輪錯 2 次 ✓', 0.4, -0.7);
    cap('loop 要跑 100 次，第一次就要 taken', '只錯一次就 flip 不是很正確');
  },
]);

// 2-bit vs 1-bit over the whole nested loop: outer loop 1000 runs (老師的「out loop 可能 1000 次」)
const OUTER = 1000;
const ALL = RUN.repeat(OUTER).split('');
const m1 = predictRun('1bit', ALL, 1).filter((x) => !x.ok).length, m2 = predictRun('2bit', ALL, 3).filter((x) => !x.ok).length;
const TWO_OK = m1 === 2 * OUTER - 1 && m2 === OUTER;
scene('ppB-20a-2bit', '20A：錯兩次才 flip：2-bit predictor', [
  async (tok, S) => { // 1507.2
    hd('錯一次就 flip 太急了 → 錯兩次才 flip', 0, 6.5);
    cap('才錯一次就 flip', '能不能錯兩次以上才 flip？');
  },
  async (tok, S) => { // 1515.6
    pl('出口：實際 N，預測 T → 錯，但還是叫 taken', -0.4, 5.2);
    cap('錯兩次才 flip', '第一次錯，預測還是 taken');
  },
  async (tok, S) => { // 1522.6
    good('再進 loop：預測 T、實際 T → 對了 ✓', -0.4, 4.5);
    cap('下次再進來', '預測 taken，真的 taken → 對了');
  },
  async (tok, S) => { // 1528.4
    S.b1 = card('1-bit：錯 ' + m1 + ' 次', FC.peach, -3.0, 3.0, 3.4, 0.7); S.b2 = card('2-bit：錯 ' + m2 + ' 次', FC.mint, 3.0, 3.0, 3.4, 0.7);
    sm('outer loop ' + OUTER + ' 次 × inner 101 次 branch', 0, 2.2);
    ok(TWO_OK, '每輪少錯 1 次 → 全部少錯 ' + (m1 - m2) + ' 次 ✓', 0, 1.5);
    cap('才省一次？', 'outer loop 可能執行 1000 次');
  },
  async (tok, S) => { // 1544.6
    sm('錯誤率：1-bit ' + (m1 / ALL.length * 100).toFixed(2) + '%、2-bit ' + (m2 / ALL.length * 100).toFixed(2) + '%', 0, 0.8);
    cap('prediction 要錯得很少很少', '零點幾、一點多 percent');
  },
  async (tok, S) => { // 1552.5
    hot('多用一個 bit：兩個 bit', 0, 0.0);
    cap('所以多用一個 bit', '兩個 bit 就能 predict 正確');
  },
]);

// 2-bit FSM; module predictRun state s: 3 強T, 2 弱T, 1 弱NT, 0 強NT. 老師的 state assignment：00 起點（predict taken）
const CODE2 = { 3: '00', 2: '01', 1: '10', 0: '11' };
const NM2 = { 3: '強 taken', 2: '弱 taken', 1: '弱 not taken', 0: '強 not taken' };
const SX = (s) => -4.8 + (3 - s) * 3.2;
const FS = predictRun('2bit', ['T', 'N', 'N'], 3);
const FSM_OK = FS[0].after === 3 && FS[1].pred && FS[1].after === 2 && FS[2].pred && FS[2].after === 1 && predictRun('2bit', ['T'], 1)[0].pred === false;
scene('ppB-20a-fsm', '20A：2-bit predictor = 4 個 state 的 FSM', [
  async (tok, S) => { // 1559.5
    hd('兩個 bit 是什麼意思？', 0, 6.5);
    S.bits = [card('b1', FC.gold, -0.5, 5.6, 0.8, 0.6), card('b0', FC.gold, 0.5, 5.6, 0.8, 0.6)];
    cap('兩個 bit 是什麼意思？', '');
  },
  async (tok, S) => { // 1567.0
    S.st = [3, 2, 1, 0].map((s) => { const m = card(CODE2[s] + '：' + NM2[s], s >= 2 ? FC.mint : FC.peach, SX(s), 3.8, 2.6, 0.9, 0.8, 10); return m; });
    sm('預測 taken', -3.2, 2.9); sm('預測 not taken', 3.2, 2.9); note('state assignment 隨便（照老師：00 起點）', 0, 2.3);
    cap('相當於一個 finite state machine', '四個 state：00、01、10、11');
  },
  async (tok, S) => { // 1584.2
    sm('兩個 flip-flop 存 state；下一個 state = f（現在 state, 這次結果）', 0, 1.6);
    cap('兩個 flip-flop 存 state', '根據現在 state 和 input 決定下一步');
  },
  async (tok, S) => { // 1600.0
    S.mk = cube('', FC.gold, [0.5, 0.3, 0.5], SX(3), 4.6, 0);
    pl('T ↺', SX(3) - 1.0, 4.6);
    cap('在 taken state 看到 taken', '還是留在 taken');
  },
  async (tok, S) => { // 1617.7
    S.ar1 = arrow(V3(SX(3) + 0.9, 4.45, 0.4), V3(SX(2) - 0.9, 4.45, 0.4), 0xdd8238); pl('N', (SX(3) + SX(2)) / 2, 4.85);
    cap('not taken 一次', '換 state，但還是 predict taken');
  },
  async (tok, S) => { // 1624.3
    S.ar2 = arrow(V3(SX(2) + 0.9, 4.45, 0.4), V3(SX(1) - 0.9, 4.45, 0.4), 0xdd8238); pl('N', (SX(2) + SX(1)) / 2, 4.85);
    cap('錯兩次以後', '下次才 predict not taken');
  },
  async (tok, S) => { // 1633.2
    arrow(V3(SX(1) - 0.9, 3.15, 0.4), V3(SX(2) + 0.9, 3.15, 0.4), 0x2fc092); arrow(V3(SX(0) - 0.9, 3.15, 0.4), V3(SX(1) + 0.9, 3.15, 0.4), 0x2fc092);
    pl('T', (SX(1) + SX(2)) / 2, 3.15); pl('T', (SX(0) + SX(1)) / 2, 3.15);
    arrow(V3(SX(1) + 0.9, 4.25, 0.4), V3(SX(0) - 0.9, 4.25, 0.4), 0xdd8238); arrow(V3(SX(2) - 0.9, 3.35, 0.4), V3(SX(3) + 0.9, 3.35, 0.4), 0x2fc092);
    cap('在 not taken 這邊也一樣', '要兩次才回到 taken');
  },
  async (tok, S) => { // 1646.5
    good('稍微複雜一點的 FSM，很簡單的 control 就做得出來', 0, 1.0);
    cap('稍微複雜一點的 FSM', '簡單的 control 就能 implement');
  },
  async (tok, S) => { // 1663.6
    S.st.forEach((m) => glow(m, null)); glow(S.st[0], HL); await slide(tok, S.mk, SX(3), 4.6);
    S.l1 = pl('例：現在在 00 → 預測 ' + (FS[1].pred ? 'taken' : 'not taken'), 0, 0.3);
    cap('例：現在在 00', '下一個進來，預測 taken');
  },
  async (tok, S) => { // 1689.0
    await slide(tok, S.mk, SX(FS[1].after), 4.6); glow(S.st[0], null); glow(S.st[3 - FS[1].after], HL);
    txt(S.l1, '實際不是 taken → 猜錯 → 跑到 ' + CODE2[FS[1].after]);
    cap('下一個不是 taken', '猜錯了 → 跑到 01');
  },
  async (tok, S) => { // 1702.0
    txt(S.l1, '在 ' + CODE2[FS[2].before] + '：還是預測 ' + (FS[2].pred ? 'taken' : 'not taken'));
    cap('在 01 這個 state', '還是預測 taken');
  },
  async (tok, S) => { // 1710.5
    await slide(tok, S.mk, SX(FS[2].after), 4.6); S.st.forEach((m) => glow(m, null)); glow(S.st[3 - FS[2].after], HL);
    txt(S.l1, '又不是 taken → 到 ' + CODE2[FS[2].after] + ' → 下次預測 not taken');
    ok(FSM_OK, '狀態轉換用 2-bit counter 模擬 ✓', 0, -0.4);
    cap('萬一又不是 taken', '才跑到 predict not taken 的 state');
  },
  async (tok, S) => { // 1720.7
    bub('用 state 和 signal 來 control → 2-bit prediction', 0, -1.0);
    cap('用 state 和 signal 來 control', '就 implement 出 2-bit prediction');
  },
]);

scene('ppB-20a-btb', '20A：預測 taken，target 在哪？', [
  async (tok, S) => { // 1733.5
    hd('預測要跳：跳去的位址在哪裡？', 0, 6.5);
    S.p = pipe5(4.4); S.b = token('beq', FC.gold, S.p.x(1), 3.6); S.q = token('預測 taken → ?', FC.rose, S.p.x(0), 3.6);
    cap('就算預測要跳', '跳去的位址在哪裡？');
  },
  async (tok, S) => { // 1746.1
    glow(S.p.bx[1], HL); sm('target 在第 2 個 cycle（ID）才算出來', S.p.x(1), 2.6);
    cap('我們的 implementation', 'target 也是在第 2 個 cycle 算出來');
  },
  async (tok, S) => { // 1757.7
    S.a = arrow(V3(S.p.x(2), 5.1, 0.3), V3(S.p.x(1) + 0.3, 5.1, 0.3), 0xc08a1f); sm('本來在 EX 算，整個搬到 decode', S.p.x(2) + 1.2, 5.6);
    cap('本來在 execution stage', '搬到 decode 去算 target');
  },
  async (tok, S) => { // 1777.7
    bad('IF 的時候 target 還沒出來 → 預測 taken 也還是有 1 cycle penalty', 0, 1.8);
    cap('真的預測 taken', '位址不知道，還是一個 cycle penalty');
  },
  async (tok, S) => { // 1788.6
    good('要把「跳去的位址」記下來', 0, 1.0);
    cap('所以要怎樣？', '把跳去的位址記下來');
  },
]);

scene('ppB-20a-btb2', '20A：table 裡連 target 一起記（dynamic prediction）', [
  async (tok, S) => { // 1823.8
    hd('prediction table 只記 taken / not taken，夠不夠？', 0, 6.5);
    S.t = table(-4.6, 5.2, ['branch PC', 'T/N', 'target'], [['48', '1', ' ']], { ws: [1.6, 1.0, 1.8] }); shh([1.6, 5.2]);
    cap('table 只用一個 bit 記 taken', '這樣夠不夠？');
  },
  async (tok, S) => { // 1837.6
    S.p = pipe5(3.0, -4.4, 2.2); fs(sm('decode 在算 target 的同時，IF 就要 fetch next', 0, 2.1), 10);
    cap('target 還沒算出來', 'decode 的同時就要 fetch next');
  },
  async (tok, S) => { // 1864.2
    hot('要把 target address 記下來：記哪一個？', 0, 1.4);
    cap('要把 target address 記下來', '可是要記哪一個？');
  },
  async (tok, S) => { // 1888.7
    sm('上次是 taken → 上次就已經知道跳去哪裡了', 0, 0.8);
    cap('你為什麼記錄 taken？', '因為上次 taken，那時就知道跳去哪');
  },
  async (tok, S) => { // 1901.1
    S.t.set(0, 2, '96'); glow(S.t.cells[0][2], HL);
    cap('就把它一起記錄下來', 'taken 和 target 一起記');
  },
  async (tok, S) => { // 1926.1
    S.pc = card('PC = 48', FC.gold, 3.8, 5.2, 1.6, 0.6); S.t.cells[0].forEach((m) => glow(m, HL));
    good('用現在的 PC 查表 → 預測 taken，同時讀出 target 96 → 直接 fetch', 1.2, 4.2);
    cap('用現在的 PC 去查表', 'taken 就同時讀出 target');
  },
  async (tok, S) => { // 1947.1
    bub('target 也存在 table 裡 → dynamic prediction（branch target buffer）', 0, 0.1);
    cap('target 存在 table 裡就 OK', '這就是 dynamic prediction');
  },
  async (tok, S) => { // 1958.8
    sm('看起來只差一個 cycle，但 loop 會一直 repeat', 0, -0.5);
    cap('為什麼重要？', 'loop 會一直重複');
  },
  async (tok, S) => { // 1973.4
    hot('錯誤率要壓到很少個位數 %', 0, -1.1);
    cap('錯的話損失很嚴重', '要盡量設計成都預測對');
  },
]);

// delayed branch: the add before beq is independent of beq → can fill the delay slot
const DB_ADD = parseIns('add $s1, $s2, $s3'), DB_BR = parseIns('beq $s2, $zero, L');
const DB_OK = !DB_BR.sID.includes(DB_ADD.dst) && DB_BR.sID.length === 1;
scene('ppB-20a-delay1', '20A：delayed branch：只差一個 cycle', [
  async (tok, S) => { // 1987.3
    hd('另一個方法：delayed branch', 0, 6.5);
    cap('剛才是 predict', '另一個方法叫 delayed branch');
  },
  async (tok, S) => { // 2010.6
    S.G = grid(['beq', '下一個 slot', '再下一個'], 7, { y: 5.0, x0: -1.4 }); S.G.row(0, 1, FIVE); S.G.hl(0, 2);
    note('ID 結束就知道跳不跳', 2.4, 3.3);
    cap('branch 在第 2 個 stage 決定', '再過一個 clock 就知道跳去哪');
  },
  async (tok, S) => { // 2038.0
    S.G.put(1, 2, 'IF', FC.rose); S.G.say('?', 1, 2, 'ptr alt');
    cap('決定的時候', '第 1 個 stage 已經 fetch 一個指令');
  },
  async (tok, S) => { // 2069.5
    sm('抓 PC + 4，結果要跳 → 錯；抓 target，結果不跳 → 也錯', 0, 2.6);
    cap('兩種狀況', '抓哪一個都可能錯');
  },
  async (tok, S) => { // 2082.6
    hot('其實只差一個 cycle', -4.6, 3.4);
    cap('其實只需要再一個 cycle', '');
  },
  async (tok, S) => { // 2137.3
    bub('這個 slot 能不能放一個「跳或不跳都要執行」的指令？', 0, 1.9);
    cap('能不能 fetch 一個', '不管跳不跳都要執行的指令？');
  },
  async (tok, S) => { // 2206.2
    S.c = code(['add  $s1, $s2, $s3', 'beq  $s2, $zero, L', '（delay slot）'], -3.4, 1.0, 0.55); shh([-3.4, 1.65]);
    cap('只差一個指令', '找跳或不跳都要執行的指令');
  },
  async (tok, S) => { // 2216.0
    sm('大約 50% 找得到', 2.8, 0.5);
    cap('有可能，大約 50% 找得到', '');
  },
  async (tok, S) => { // 2225.1
    S.c.kill(); S.c = code(['beq  $s2, $zero, L', 'add  $s1, $s2, $s3   ← delay slot', ''], -3.4, 1.0, 0.55); S.c.hl(1);
    relabel(S.G.cells[1][2], 'IF'); tint(S.G.cells[1][2], SC.IF); S.G.row(1, 3, ['ID', 'EX', 'MEM', 'WB']); txt(S.G.rl[1], 'add（slot）');
    cap('找到就把它拉到 branch 下面', '不管跳不跳都執行');
  },
]);

scene('ppB-20a-delay2', '20A：delayed branch 的條件與限制', [
  async (tok, S) => { // 2251.0
    hd('delayed branch：branch 後面那一個一定執行', 0, 6.5);
    S.c = code(['beq  $s2, $zero, L', 'add  $s1, $s2, $s3   ← delay slot'], -3.0, 5.2, 0.6); S.c.hl(1); shh([1.6, 5.8]);
    cap('這就叫 delayed branch', 'branch 後面的指令 always executed');
  },
  async (tok, S) => { // 2304.1
    sm('add 寫 $s1；beq 只讀 $s2、$zero', -1.6, 3.8);
    ok(DB_OK, '沒有 dependency → 可以搬 ✓', 3.0, 3.8);
    cap('用 reorder 把指令搬上去', '條件：沒有 dependency');
  },
  async (tok, S) => { // 2331.1
    good('跳到 target 也要執行它 → 不用 flush', 0, 3.0);
    cap('跳過去也要執行這個指令', '就不用再 flush 了');
  },
  async (tok, S) => { // 2353.0
    sm('永遠 fetch 下一個（像 not taken），但沒有 penalty；用 compiler 的技巧 rearrange', 0, 2.3);
    cap('永遠猜 not taken', '但沒有 penalty：compiler rearrange');
  },
  async (tok, S) => { // 2378.0
    bad('有 dependency 就不能亂搬；大約 50% 找得到（找不到就放 nop）', 0, 1.5);
    cap('有 dependency 就不能亂搬', '大約 50% 找得到');
  },
  async (tok, S) => { // 2398.7
    pl('pipeline 不深：在第 2 stage 就決定，只要塞 1 個 → 容易', 0, 0.7);
    pl('pipeline 很深：要塞 3 個 → 不容易', 0, 0.1);
    cap('pipeline 不深很容易找到一個', '很深的要塞三個，就難了');
  },
]);

scene('ppB-20a-exc', '20A：exception：意料之外的事件', [
  async (tok, S) => { // 2423.4
    hd('Exceptions', 0, 6.5);
    S.c = code(['1000  add ...', '1004  lw  ...', '1008  sub ...'], -4.4, 5.2, 0.55); S.c.hl(0); shh([-4.4, 3.4]);
    cap('什麼叫 exception？', '');
  },
  async (tok, S) => { // 2434.7
    S.os = card('OS', FC.lilac, 3.8, 4.6, 2.0, 0.9);
    S.a = arrow(V3(-2.4, 5.1, 0.3), V3(2.6, 4.7, 0.3), 0xd64545);
    sm('unexpected event：停下程式，跳到 OS', 0.4, 5.6);
    cap('unexpected event', '程式沒預期到，要停下來跳到 OS');
  },
  async (tok, S) => { // 2449.2
    S.d = prop('disk', -5.0, 1.0, 0, 0.9, 'I/O'); pk('I/O 做完 → 通知：interrupt', -2.4, 1.8);
    cap('可能是 I/O', 'I/O 做完要通知 process：interrupt');
  },
  async (tok, S) => { // 2459.4
    pk('opcode 不認得（undefined）', 1.6, 2.6); pk('overflow', 1.6, 1.9);
    cap('或 process 本身出問題', 'opcode decode 不出來、overflow');
  },
  async (tok, S) => { // 2483.7
    hot('exception 也是一種 control hazard', 1.6, 1.0);
    cap('exception 也是一種 control hazard', 'control flow 突然改變');
  },
  async (tok, S) => { // 2509.6
    sm('OS 也是一組 program（system program，不是 user 寫的）', 3.6, 3.7);
    cap('跳到 OS', 'OS 也是 program：system program');
  },
  async (tok, S) => { // 2535.0
    S.e = card('exception：internal（CPU 內部）', FC.peach, -3.0, -0.2, 4.6, 0.6);
    cap('MIPS 的定義', 'exception：內部發生的');
  },
  async (tok, S) => { // 2555.0
    S.i = card('interrupt：external（I/O controller）', FC.sky, 3.0, -0.2, 4.6, 0.6);
    cap('從 I/O 來的', '叫 interrupt（external）');
  },
  async (tok, S) => { // 2584.0
    S.sg = pk('signal → CPU：我做完了', -4.4, 0.4);
    cap('I/O 做完', '送一個 signal 給 CPU');
  },
  async (tok, S) => { // 2605.2
    bad('沒辦法預期 → 像 control hazard 一樣要 flush → 犧牲效能', 0, -0.9);
    cap('一定會犧牲效能', '要設計得好、犧牲最少，不簡單');
  },
]);

scene('ppB-20a-handle', '20A：處理 exception：EPC、Cause、entry point', [
  async (tok, S) => { // 2650.6
    hd('沒預期的 signal 進來了', 0, 6.5);
    S.pc = card('PC = 1000', FC.gold, -4.8, 5.2, 2.2, 0.6);
    cap('CPU 在跑的時候', '突然一個 signal 進來');
  },
  async (tok, S) => { // 2663.4
    sm('不同種類 → 不同處理；normal flow 停止', -1.4, 5.2);
    cap('不同的事情要做不同處理', '正常的 flow 要停止');
  },
  async (tok, S) => { // 2677.5
    await wt(tok, 300); relabel(S.pc, 'PC = 34686'); tint(S.pc, FC.lilac);
    sm('跳到 OS = 把 PC 改成 OS routine 的位址（老師的數字）', -1.4, 4.5);
    cap('跳到 OS 也不過是改 PC', '1000 → 34686');
  },
  async (tok, S) => { // 2708.4
    hot('所以也是一種 control hazard', 3.6, 5.2);
    cap('所以也是一種 control hazard', '沒跳到預期的地方');
  },
  async (tok, S) => { // 2726.1
    S.epc = card('EPC = ?', FC.paper, -4.8, 3.4, 2.2, 0.6);
    cap('要把現在的 PC 記下來', '在 1000 發生 exception');
  },
  async (tok, S) => { // 2742.5
    sm('處理完還可以回來（例如 I/O：處理一下而已）', -0.6, 3.4);
    cap('處理完畢還可以回來', '回到正常的 program flow');
  },
  async (tok, S) => { // 2805.3
    S.r1 = pk('I/O interrupt：把這個指令做完 → 回來執行下一個', 0.8, 2.6);
    cap('兩種狀況：I/O interrupt', '這個指令執行完，回來做下一個');
  },
  async (tok, S) => { // 2813.2
    S.r2 = pk('exception：這個指令本身出問題 → 回來要 repeat 它', 0.8, 1.9);
    cap('exception：這個指令本身有問題', '回來要 repeat 這個指令');
  },
  async (tok, S) => { // 2856.1
    relabel(S.epc, 'EPC = 1000'); glow(S.epc, HL); sm('Exception Program Counter', -4.8, 2.7);
    cap('記在哪裡？EPC', 'Exception Program Counter');
  },
  async (tok, S) => { // 2861.6
    S.ab = arrow(V3(-3.6, 3.6, 0.3), V3(-3.6, 4.9, 0.3), 0x2fc092); sm('處理完：EPC → PC', -2.4, 4.3);
    cap('處理完畢', '把 EPC load 回 PC，正常執行');
  },
  async (tok, S) => { // 2873.2
    S.cz = card('Cause = ?', FC.paper, -4.8, 1.2, 2.2, 0.6);
    cap('原因也要記下來', 'handler 要知道是哪種狀況');
  },
  async (tok, S) => { // 2893.1
    relabel(S.cz, 'Cause = 0 / 1'); sm('0：undefined opcode　1：overflow', -4.8, 0.5);
    cap('這個簡化的例子只有兩種 exception', 'undefined opcode 記 0、overflow 記 1');
  },
  async (tok, S) => { // 2927.2
    sm('exception（不是 interrupt）：不會把這個指令執行完', 1.8, 1.0);
    cap('這是 exception', '不把這個指令執行完');
  },
  async (tok, S) => { // 2938.8
    S.ent = card('handler 入口 8000 0180', FC.lilac, 2.6, 0.1, 3.6, 0.6);
    cap('馬上跳去 handler', 'MIPS 只有一個 entry point：8000 0180');
  },
  async (tok, S) => { // 2967.0
    sm('到入口之後，再判斷是哪一種 exception', 2.6, -0.6);
    cap('好像一個入口', '進去之後再判斷是哪一種');
  },
]);

scene('ppB-20a-vec', '20A：single entry vs vectored interrupt', [
  async (tok, S) => { // 2981.4
    hd('處理 exception 的兩種方法', 0, 6.5);
    S.e = card('8000 0180（唯一入口）', FC.lilac, -3.6, 4.8, 3.6, 0.7);
    cap('方法一：single entry', '大家都跳到 8000 0180');
  },
  async (tok, S) => { // 2995.0
    S.cz = card('Cause', FC.paper, -6.0, 3.4, 1.2, 0.6);
    S.h0 = card('handler：undefined opcode', FC.peach, -3.6, 3.0, 3.4, 0.5); S.h1 = card('handler：overflow', FC.peach, -3.6, 2.3, 3.4, 0.5);
    sm('入口程式看 Cause = 0 / 1 再跳', -3.6, 1.6);
    cap('OS 入口根據 Cause', '跳到對應的 handler');
  },
  async (tok, S) => { // 3007.5
    hd('方法二：vectored interrupt', 3.4, 5.6);
    cap('另一種方法', '叫 vectored interrupt');
  },
  async (tok, S) => { // 3017.1
    S.tb = table(1.8, 4.6, ['cause', '跳到'], [['0', 'handler 0'], ['1', 'handler 1'], ['…', '…']], { ws: [1.0, 2.2] });
    sm('像 array index：直接用原因查表，跳到對應 handler', 3.4, 2.4);
    cap('直接根據 cause 跳', '像 array index、一張 table');
  },
  async (tok, S) => { // 3048.0
    good('MIPS：single entry point　其他：vectored interrupt', 0, 0.6);
    cap('MIPS 用 single entry', 'vectored：根據原因直接跳到 subroutine');
  },
]);

// ════════ WpJZIFEtgg4（第 21A 講：control hazard 三種方法複習、exception 與 pipeline、ILP、multiple issue、speculation） ════════
const M3 = ['① 猜 PC + 4，錯了 flush', '② delayed branch（compiler 塞指令）', '③ branch history table（dynamic）'];
const methods = (S, y = -0.4) => { S.m = M3.map((t, i) => card(t, FC.paper, -4.4 + i * 4.4, y, 4.2, 0.6, 0.6, 10)); S.m.forEach((m) => fade(m, 0.45)); };
const lit = (S, i) => S.m.forEach((m, k) => { fade(m, k === i ? 1 : 0.45); glow(m, k === i ? HL : null); });
scene('ppB-21a-review', '21A：複習 control hazard（方法一：猜 PC + 4、flush）', [
  async (tok, S) => { // 17.0
    hd('先整理：branch prediction 與 delayed branch', 0, 6.5); methods(S);
    cap('講 exception 之前', '先把 control hazard 再整理一次');
  },
  async (tok, S) => { // 35.1
    S.p = pipe5(4.6); S.b = token('beq', FC.gold, S.p.x(0), 3.8);
    cap('指令一定要一直 fetch 進 pipeline', '');
  },
  async (tok, S) => { // 45.0
    await slide(tok, S.b, S.p.x(1), 3.8); S.q = token('?', FC.rose, S.p.x(0), 3.8);
    cap('碰到 beq、bne', '不知道要跳去哪，還是要繼續 fetch');
  },
  async (tok, S) => { // 61.0
    relabel(S.q, 'PC + 4'); tint(S.q, FC.blue);
    cap('最簡單：fetch not taken 的指令', 'PC = PC + 4');
  },
  async (tok, S) => { // 70.3
    tint(S.q, FC.red); bad('結果 taken → fetch 進來的是錯的 → control hazard', 0, 2.8);
    cap('如果它其實要跳（taken）', '抓進來的就是錯的');
  },
  async (tok, S) => { // 82.0
    sm('第 3 stage 決定 → 前面 ' + brSim(3).pen + ' 個 flush；第 4 stage 決定 → ' + brSim(4).pen + ' 個 flush', 0, 2.1);
    cap('在第 3 或第 4 個 stage 才決定', '前面抓進來的全部要 flush');
  },
  async (tok, S) => { // 108.7
    glow(S.p.bx[1], HL); ok(PEN_ID_OK, '移到第 2 stage（ID）→ penalty 1 cycle ✓', 0, 1.3);
    cap('我們的設計：移到第 2 個 stage', '猜錯只要 flush 一個');
  },
  async (tok, S) => { // 131.3
    lit(S, 0);
    cap('第一種機制', '猜 PC + 4，錯了就 flush');
  },
]);

scene('ppB-21a-delay', '21A：方法二：delayed branch', [
  async (tok, S) => { // 144.5
    hd('第二種：delayed branch', 0, 6.5); methods(S); lit(S, 1);
    S.G = grid(['beq', 'delay slot'], 7, { y: 5.0, x0: -1.0 }); S.G.row(0, 1, FIVE);
    cap('pipeline 其實很短', '只差一個指令');
  },
  async (tok, S) => { // 156.0
    S.G.put(1, 2, 'IF', FC.gray); S.G.say('有用的指令', 1, 4.2, 'note');
    cap('永遠 fetch 一個有用的指令', '等於 branch decision 晚一個 cycle');
  },
  async (tok, S) => { // 169.4
    S.c = code(['add  $s1, $s2, $s3', 'beq  $s2, $zero, L', '（delay slot）'], -2.6, 3.2, 0.55); shh([1.4, 3.2]);
    await wt(tok, 700); S.c.kill(); S.c = code(['beq  $s2, $zero, L', 'add  $s1, $s2, $s3   ← delay slot', ''], -2.6, 3.2, 0.55); S.c.hl(1);
    relabel(S.G.cells[1][2], 'IF'); tint(S.G.cells[1][2], SC.IF); S.G.row(1, 3, ['ID', 'EX', 'MEM', 'WB']);
    cap('compiler 找一個不管 taken 或 not taken 都會執行的', '塞在 branch 的下一個');
  },
  async (tok, S) => { // 182.6
    good('就算「猜錯」也沒關係：它本來就要執行', 0, 1.6);
    cap('就沒有猜錯的問題', '');
  },
  async (tok, S) => { // 198.5
    sm('找不到 → insert 一個 no-op', -2.4, 1.0);
    cap('找不到這樣的指令', '就 insert 一個 no-op');
  },
  async (tok, S) => { // 207.0
    sm('大約 50% 找得到', 2.4, 1.0);
    cap('大約 50% 會找到', '找不到就放 no-op，不做任何動作');
  },
  async (tok, S) => { // 231.0
    hot('不需要 flush：下一個要嘛有用、要嘛是 nop', 0, 0.4);
    cap('需不需要再 flush？', '不需要了');
  },
]);

scene('ppB-21a-dyn', '21A：方法三：branch history table（為什麼需要）', [
  async (tok, S) => { // 251.1
    hd('第三種技巧', 0, 6.5); methods(S); lit(S, 2);
    cap('第三種技巧', '');
  },
  async (tok, S) => { // 256.4
    pl('第一種：always not taken（PC + 4），taken 就 flush', 0, 5.4);
    cap('第一種是 always not taken', '如果 taken，就要 flush');
  },
  async (tok, S) => { // 268.5
    S.a = Array.from({ length: 5 }, (_, i) => card('S' + (i + 1), FC.sky, -5.4 + i * 0.85, 4.3, 0.78, 0.5, 0.5, 9)); sm('5 stage：flush 1 個還 OK', 2.4, 4.3);
    S.b = Array.from({ length: 10 }, (_, i) => card('S' + (i + 1), FC.sky, -5.4 + i * 0.85, 3.3, 0.78, 0.5, 0.5, 9));
    cap('5 個 stage flush 一個還 OK', 'high performance 可能 10 個 stage 以上');
  },
  async (tok, S) => { // 282.5
    const d = 6; for (let i = 0; i < d; i++) tint(S.b[i], i === d - 1 ? FC.gold : FC.rose);
    ok(brSim(d).pen === 5, '第 6 stage 才決定 → flush ' + brSim(d).pen + ' 個 ✓（示意）', 2.4, 2.5);
    cap('決定在很後面的 stage', 'flush 就要犧牲很多 cycle');
  },
  async (tok, S) => { // 294.0
    sm('loop 的 branch 大部分是 taken → 不能亂猜', -2.4, 2.5);
    cap('所以 prediction 很重要', 'loop 大部分是 taken，不能亂猜');
  },
  async (tok, S) => { // 314.2
    S.t = table(-5.6, 1.5, ['branch 位址', 'T / N'], [['…', '…']], { ws: [1.6, 1.2] });
    sm('用 table 記錄歷史 → 要更多 hardware', 0.6, 1.5);
    cap('用 branch history table 記下來', '當然需要更多 hardware');
  },
  async (tok, S) => { // 325.1
    sm('電晶體越來越便宜、clock cycle 越來越短 → 決定沒辦法隨便往前移', 0.6, 0.8);
    cap('越 high performance、clock 越短', 'branch decision 沒辦法隨便往前移');
  },
  async (tok, S) => { // 359.0
    S.m.forEach((m) => fade(m, 1)); glow(S.m[2], null);
    bub('三個機制有關，但不是混在一起；delayed branch 是另一個想法', 0, 0.3);
    cap('這三個機制不是混在一起的', 'delayed branch 是另一個想法');
  },
]);

scene('ppB-21a-exc', '21A：exception 與 interrupt（MIPS 的定義）', [
  async (tok, S) => { // 388.0
    hd('複習：exception', 0, 6.5);
    cap('再複習 exception', '');
  },
  async (tok, S) => { // 400.0
    S.cpu = prop('cpu', 0, 3.6, 0, 1.2, 'CPU'); S.d = prop('disk', 4.6, 3.4, 0, 0.9, 'I/O');
    cap('沒辦法預期的狀況', '例如 I/O 做完了，要通知 process');
  },
  async (tok, S) => { // 409.6
    S.pA = buddy('process A', '等 I/O', FC.peach, -4.6, 3.0, 0, 0.8); S.pB = buddy('process B', '用 CPU', FC.mint, -2.3, 3.0, 0, 0.8); S.pA.mood('calm');
    pk('I/O 做完 → 通知（不然 A 永遠沒辦法恢復）', 2.2, 2.2);
    cap('process 要做 I/O 就把 processor 讓出來', 'I/O 做完要通知它');
  },
  async (tok, S) => { // 427.4
    S.e = card('exception：internal（undefined opcode、overflow）', FC.peach, -2.6, 0.8, 6.0, 0.6);
    cap('MIPS：CPU 本身發生的', 'undefined opcode、overflow → exception');
  },
  async (tok, S) => { // 440.0
    S.i = card('interrupt：external（從 I/O 來）', FC.sky, 3.4, 0.0, 4.4, 0.6);
    cap('從外部 I/O 過來的', '叫 interrupt');
  },
]);

scene('ppB-21a-handler', '21A：handler 要做的事（先不管 pipeline）', [
  async (tok, S) => { // 445.2
    hd('發生 exception 時要做什麼（先當 single cycle、照順序執行）', 0, 6.5);
    S.pg = card('program：執行到 offending 指令', FC.sky, -4.2, 5.2, 4.2, 0.6);
    cap('先不管是不是 pipeline', '當成 single cycle、sequential 執行');
  },
  async (tok, S) => { // 461.3
    S.os = card('exception handler（OS）', FC.lilac, 3.6, 5.2, 4.0, 0.6); arrow(V3(-2.0, 5.2, 0.4), V3(1.5, 5.2, 0.4), 0xd64545);
    cap('要跳到 exception handler', '也就是跳到 OS');
  },
  async (tok, S) => { // 476.2
    S.epc = card('EPC ← offending 指令的位址', FC.paper, -4.2, 4.0, 4.2, 0.6);
    cap('可恢復的（例如 I/O interrupt）', '要把被 interrupt 的指令記下來');
  },
  async (tok, S) => { // 503.3
    S.cz = card('Cause ← 原因', FC.paper, -4.2, 3.2, 4.2, 0.6);
    cap('跳去之前把原因記下來', 'OS 有好多種 subroutine 要處理');
  },
  async (tok, S) => { // 520.2
    relabel(S.cz, 'Cause：0 = undefined opcode，1 = overflow');
    cap('只有 undefined opcode 跟 overflow', '一個 bit 就夠：0 和 1');
  },
  async (tok, S) => { // 528.7
    S.ent = card('single entry：8000 0180', FC.lilac, 3.6, 4.2, 4.0, 0.6);
    cap('兩種跳法：single entry', 'MIPS 就是一個點：8000 0180');
  },
  async (tok, S) => { // 542.6
    sm('進去後再看 Cause，叫對應的 handler', 3.6, 3.6);
    cap('跳到 OS routine', '再根據 Cause 判斷叫哪個 handler');
  },
  async (tok, S) => { // 554.0
    S.vt = table(1.8, 2.6, ['cause', '下一個 PC'], [['undefined opcode', 'handler A'], ['overflow', 'handler B']], { ws: [2.3, 1.7] });
    cap('另一種：vectored interrupt', '很多個 entry point');
  },
  async (tok, S) => { // 568.6
    glow(S.vt.cells[0][1], HL); glow(S.vt.cells[1][1], HL);
    cap('undefined opcode：PC 設成這個', 'overflow：PC 設成那個');
  },
  async (tok, S) => { // 601.3
    good('restartable（例如 I/O）：處理完用 EPC 回到原來的 program', -2.4, 1.6);
    cap('可以 restart 的', '處理完用 EPC 回原來的 program');
  },
  async (tok, S) => { // 622.0
    bad('不能 recover：terminate program、report error', -2.4, 0.9);
    cap('不能 recover 的', '就 terminate 程式，report error');
  },
]);

// the P&H example: 40 sub, 44 and, 48 or, 4C add (overflow in EX at cycle 6), 50 slt, 54 lw
const EXP = ['sub $11, $2, $4', 'and $12, $2, $5', 'or $13, $2, $6', 'add $1, $2, $1', 'slt $15, $6, $7', 'lw $16, 50($7)'];
const EXA = [0x40, 0x44, 0x48, 0x4C, 0x50, 0x54];
const EXS = schedule(EXP.map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
const EXC = EXS.rows[3].EX;                                  // overflow detected in add's EX
const EXF = EXS.rows.map((r, k) => (r.IF >= EXS.rows[3].IF ? k : -1)).filter((k) => k >= 0);   // add 和之後的 → flush
const EXOK = EXC === 6 && EXF.join() === '3,4,5' && EXS.stalls === 0;
const EPC = EXA[3] + 4;
const hx = (n) => n.toString(16).toUpperCase();
scene('ppB-21a-pipe', '21A：pipeline 裡的 exception = 另一種 control hazard', [
  async (tok, S) => { // 636.0
    hd('不管是不是 pipeline，exception 都要這樣處理', 0, 6.5);
    cap('不管是不是 pipeline', 'exception 都要這樣處理');
  },
  async (tok, S) => { // 651.1
    S.G = grid(EXP.slice(1, 6), 8, { y: 5.2, x0: -1.2 });
    EXS.rows.slice(1, 6).forEach((r, k) => FIVE.forEach((s, i) => { if (r.IF + i <= EXC) S.G.put(k, r.IF + i, s); }));
    S.G.col(EXC, '#3a2a6a'); S.G.say('cycle ' + EXC, -0.9, EXC, 'note');
    cap('pipeline 同時執行好多指令', '有些在它前面、有些在它後面');
  },
  async (tok, S) => { // 679.3
    sm('就像 control hazard：program flow 要改變，跳到 OS', 0, 1.9);
    cap('其實就很像 control hazard', 'flow 要改變，跳到 OS 的 PC');
  },
  async (tok, S) => { // 703.2
    pl('之前的指令：完成　之後的指令：flush', 0, 1.3);
    cap('發生 exception 之前的指令要完成', '之後的要 flush');
  },
  async (tok, S) => { // 722.0
    const k = 2; S.G.hl(k, EXC, '#7a1010'); S.G.say('overflow!', k, EXC + 1.3, 'bad');
    cap('例：add 在 EX 發生 overflow', '');
  },
  async (tok, S) => { // 731.6
    bad('不能讓 $1 寫下去：會改變 program state', 0, 0.6);
    cap('不能讓 $1 寫下去', '寫下去就改變 program state 了');
  },
  async (tok, S) => { // 737.5
    [0, 1].forEach((k) => Object.values(S.G.cells[k]).forEach((m) => glow(m, OKG)));
    [2, 3, 4].forEach((k) => S.G.flush(k));
    good('and、or 完成 ✓', -4.6, 2.7); bad('add 和之後 flush', 4.2, 2.7);
    cap('之前的完成，add 和之後的 flush', '再把 Cause 記下來');
  },
  async (tok, S) => { // 758.1
    hot('transfer 到 handler：就像一個沒 predict 到的 branch', 0, -0.1);
    cap('然後 transfer 到 handler', '就像一個猜錯的 branch');
  },
]);

scene('ppB-21a-hw', '21A：exception 的硬體：flush 訊號、handler 位址、Cause、EPC', [
  async (tok, S) => { // 768.0
    hd('pipeline exception 的 hardware 要加什麼？', 0, 6.5);
    S.p = pipe5(4.2, -4.4, 2.2); S.pr = [0, 1, 2, 3].map((i) => card('', '#6e5f49', S.p.x(i) + 1.1, 4.2, 0.18, 1.3, 0.6));
    cap('hardware 也差不多', '要加些什麼東西？');
  },
  async (tok, S) => { // 777.0
    glow(S.p.bx[2], '#7a1010'); sm('overflow 發生在 EX', S.p.x(2), 5.1);
    cap('假如發生在 EX stage', '就像剛才的 overflow');
  },
  async (tok, S) => { // 789.3
    S.fl = ['IF.Flush', 'ID.Flush', 'EX.Flush'].map((t, i) => pk(t, S.p.x(i) + 1.1, 3.1));
    cap('這裡的 control signal 要能設成 0', '以下的 stage 也都要能 flush');
  },
  async (tok, S) => { // 809.6
    S.fl.forEach((l) => txt(l, l.element.textContent + ' = 1'));
    cap('exception 發生', 'flush 訊號就變成 1');
  },
  async (tok, S) => { // 818.1
    S.mux = card('PC mux', FC.gold, -5.6, 1.9, 1.6, 0.6); S.h = card('8000 0180', FC.lilac, -5.6, 1.1, 1.6, 0.5);
    arrow(V3(-5.6, 1.4, 0.3), V3(-5.6, 1.65, 0.3), 0x9b7ef4);
    cap('PC 那邊：MIPS 只有 single entry point', '把 handler 位址接進來');
  },
  async (tok, S) => { // 830.4
    arrow(V3(-5.6, 2.25, 0.3), V3(-4.6, 3.7, 0.3), 0xc08a1f);
    cap('發現 exception', '就把這個 address load 進 PC');
  },
  async (tok, S) => { // 849.6
    good('跟 control hazard 很像：那個 stage 以下 flush，之前的完成', 1.2, 1.9);
    cap('跟 control hazard 很像', '以下 flush、之前完成');
  },
  async (tok, S) => { // 860.5
    hot('flush = control signal 設成 0', 1.2, 1.2);
    cap('flush 的意思', '就是把 control signal 設成 0');
  },
  async (tok, S) => { // 870.0
    S.cz = card('Cause', FC.paper, -1.4, 0.2, 1.6, 0.5); S.epc = card('EPC', FC.paper, 0.6, 0.2, 1.6, 0.5);
    cap('PC 多一個 select', '還要 Cause register 和 EPC');
  },
  async (tok, S) => { // 894.0
    sm('restartable：flush → handler → 回到那個指令，從頭再做', 2.6, -0.5);
    cap('restartable exception', 'handler 執行完回到指令，從頭再做');
  },
  async (tok, S) => { // 911.1
    sm('I/O interrupt：通常做完那個指令才處理　overflow：從那個指令重新開始', 0, -1.1);
    cap('要區別：I/O interrupt 做完才處理', 'overflow 要從那個指令重來');
  },
  async (tok, S) => { // 934.0
    note('PC 存起來後，由 handler（software）判斷要從哪個指令繼續', 0, -1.7);
    cap('要 identify cause instruction', 'handler 判斷從哪個指令開始');
  },
]);

scene('ppB-21a-ex', '21A：例子：4C 的 add 發生 overflow', [
  async (tok, S) => { // 960.1
    hd('例：執行到 4C 的指令發生 overflow', 0, 6.6);
    S.c = code(EXP.map((t, i) => hx(EXA[i]) + '  ' + t), -4.6, 5.6, 0.48); S.c.hl(3);
    cap('舉個例子', '執行到 4C 這個指令，發生 overflow');
  },
  async (tok, S) => { // 971.7
    S.h = card('handler 8000 0180：sw …（store）', FC.lilac, -4.6, 2.2, 4.4, 0.55);
    cap('handler 在 8000 0180', 'single entry point，第一個指令是 store');
  },
  async (tok, S) => { // 985.8
    S.c.kill(); gone(S.h);
    S.G = grid(EXP.map((t, i) => hx(EXA[i]) + ' ' + t).concat(['80000180 sw …']), 11, { y: 5.6, x0: -1.0, dy: 0.58, fs: 9 });
    EXS.rows.forEach((r, k) => FIVE.forEach((s, i) => { if (r.IF + i < EXC) S.G.put(k, r.IF + i, s); }));
    cap('看 pipeline 長什麼樣子', 'add 前後都有指令');
  },
  async (tok, S) => { // 991.4
    EXS.rows.forEach((r, k) => FIVE.forEach((s, i) => { if (r.IF + i === EXC) S.G.put(k, EXC, s); }));
    S.G.hl(3, EXC, '#7a1010'); S.G.say('overflow', 3, EXC + 1.4, 'bad');
    ok(EXOK, 'add 在 cycle ' + EXC + ' 的 EX 偵測到 ✓', 3.4, 1.0);
    cap('add 在 EX 發生 exception', '');
  },
  async (tok, S) => { // 995.6
    EXF.forEach((k) => S.G.flush(k));
    cap('從 add 以下全部 flush', 'control signal 設成 0');
  },
  async (tok, S) => { // 1003.3
    [1, 2].forEach((k) => { const r = EXS.rows[k]; FIVE.forEach((s, i) => { const c = r.IF + i; if (c > EXC) S.G.put(k, c, s); }); Object.values(S.G.cells[k]).forEach((m) => glow(m, OKG)); });
    cap('前面的 and、or', '要繼續往前做、把它完成');
  },
  async (tok, S) => { // 1033.6
    EXF.forEach((k) => S.G.put(k, EXC + 1, 'bubble'));
    cap('下一個 cycle', 'add 跟下面的已經變成 bubble');
  },
  async (tok, S) => { // 1062.2
    S.G.say(EXF.length + ' 個 bubble = flush 的結果', 4, EXC + 3.2, 'note');
    S.e = card('EPC = ' + hx(EXA[3]) + ' + 4 = ' + hx(EPC), FC.paper, -4.2, 1.0, 3.4, 0.55); S.z = card('Cause = 1（overflow）', FC.paper, -4.2, 0.3, 3.4, 0.55);
    cap('add 以下全部是 bubble', '這三個 bubble 就是 flush 的結果');
  },
  async (tok, S) => { // 1075.1
    S.G.row(6, EXC + 1, FIVE); S.G.hl(6, EXC + 1, '#3a2a6a');
    cap('下一個 cycle 已經跳進 OS', 'single entry point 的 sw 已經 fetch 進來');
  },
  async (tok, S) => { // 1090.1
    sm('同一個 processor：OS 也是 software，只是 PC 換成 OS 的 program', 1.6, -0.5);
    sm('（硬體存的是 PC + 4；handler 會再減 4 找到 add）', 1.6, -1.1);
    cap('OS 也是 software', '只是把 PC 換成 OS 的 program');
  },
]);

// precise exception: several instructions raise exceptions in the same cycle → handle the earliest (deepest stage)
const MX = [['i1', 'WB', false], ['i2', 'MEM', true], ['i3', 'EX', false], ['i4', 'ID', true], ['i5', 'IF', true]];
const MX_PICK = MX.findIndex((m) => m[2]);
scene('ppB-21a-multi', '21A：multiple exceptions：precise 與 imprecise', [
  async (tok, S) => { // 1126.2
    hd('pipeline 可能同時發生很多個 exception', 0, 6.5);
    S.p = pipe5(4.6); S.tk = MX.map(([n, st], k) => token(n, FC.sky, S.p.x(4 - k), 3.8));
    cap('因為是 pipeline', '可能同時發生 multiple exception');
  },
  async (tok, S) => { // 1132.4
    MX.forEach(([, , e], k) => { if (e) tint(S.tk[k], FC.red); }); sm('（紅色 = 這個 cycle 發生 exception，示意）', 0, 2.9);
    cap('發生在不同 stage', '應該處理誰的？');
  },
  async (tok, S) => { // 1162.0
    sm('越右邊的 stage 越早進來（最早執行）→', 2.2, 5.6);
    cap('處理「最前面」的那一個', '也就是在 pipeline 最後面 stage 的');
  },
  async (tok, S) => { // 1189.7
    glow(S.tk[MX_PICK], HL); for (let k = MX_PICK + 1; k < MX.length; k++) fade(S.tk[k]);
    ok(MX_PICK === 1, '選 ' + MX[MX_PICK][0] + '（在 ' + MX[MX_PICK][1] + '，最早），後面全部 flush ✓', 0, 2.2);
    cap('選最早執行的那個', '然後把它以下的指令 flush 掉');
  },
  async (tok, S) => { // 1213.0
    good('找到 offending 指令、把以下 flush → precise exception', 0, 1.5);
    cap('這樣叫做 precise exception', '');
  },
  async (tok, S) => { // 1225.7
    sm('五個 stage：誰最前面一看就知道 → 很簡單', 0, 0.9);
    cap('五個 stage 的 pipeline', '很簡單就做得到');
  },
  async (tok, S) => { // 1240.2
    S.tk.forEach((m) => fade(m, 1)); relabel(S.tk[0], 'i3'); relabel(S.tk[2], 'i1');
    pk('out-of-order：最後面 stage 的不一定是最早的指令', 0, 0.2);
    cap('superscalar、很深、out of order', '最後面的不見得是最早的指令');
  },
  async (tok, S) => { // 1268.1
    bad('不知道誰最早 → precise 很難', -3.0, -0.5);
    cap('不知道誰是 earliest instruction', 'maintain precise exception 就很困難');
  },
  async (tok, S) => { // 1294.2
    hot('imprecise exception：停下 pipeline、save state，丟給 OS 判斷', 0, -1.1);
    cap('imprecise exception', '把 state 存起來，交給 OS 判斷');
  },
  async (tok, S) => { // 1335.3
    sm('用 hardware 找 precise 要很多 hardware → 丟給 software', 3.0, -0.5);
    cap('用 hardware 找要很多 hardware', '所以一般丟給 software');
  },
  async (tok, S) => { // 1359.4
    good('只要能 recover 就好；out-of-order 常用 imprecise', 0, -1.7);
    cap('只要能 recover 就好', 'out of order 常用 imprecise exception');
  },
]);

// ILP: 5-stage pipeline, cycle 5 has five instructions in flight
const inFlight = (n, st, c) => Array.from({ length: n }, (_, i) => i + 1).filter((IF) => c >= IF && c < IF + st).length;
scene('ppB-21a-ilp', '21A：pipeline 就是一種 instruction-level parallelism', [
  async (tok, S) => { // 1416.2
    hd('superscalar / dynamic pipelining：更 advanced 的 processor', 0, 6.5);
    cap('接著看 superscalar', '更 advanced 的 processor（簡單介紹）');
  },
  async (tok, S) => { // 1440.5
    hot('instruction-level parallelism（ILP）', 0, 5.8);
    cap('什麼叫 instruction level parallelism？', '');
  },
  async (tok, S) => { // 1445.5
    S.G = grid(['i1', 'i2', 'i3', 'i4', 'i5'], 9, { y: 4.8, x0: -2.0 });
    for (let k = 0; k < 5; k++) S.G.row(k, k + 1, FIVE);
    cap('pipeline 就是一種 ILP', '切成 5 個 stage');
  },
  async (tok, S) => { // 1470.0
    S.G.col(5);
    cap('切很多 stage', '其實就是同時在執行很多個指令');
  },
  async (tok, S) => { // 1475.4
    ok(inFlight(5, 5, 5) === 5, 'cycle 5：同時有 ' + inFlight(5, 5, 5) + ' 個指令在執行 ✓', 0, 1.3);
    cap('切 5 個 stage', '相當於 5 個指令同時在執行');
  },
  async (tok, S) => { // 1513.5
    sm('沒有 dependency：每個 cycle 完成 1 個 → throughput 約 5 倍', 0, 0.6);
    cap('沒有 dependency 的話', 'throughput 是 5 倍');
  },
  async (tok, S) => { // 1531.0
    hot('要更高的 parallelism → 有哪些方法？', 0, -0.2);
    cap('要增加 parallelism', '單位時間完成更多指令：有哪些方法？');
  },
]);

scene('ppB-21a-deep', '21A：方法一：deeper pipeline（切更細）', [
  async (tok, S) => { // 1560.5
    hd('方法一：切更細（7、8 個 stage）', 0, 6.5);
    cap('切更細', '切成 7 個、8 個 stage');
  },
  async (tok, S) => { // 1565.0
    S.w = card('洗衣機：洗 + 脫水', FC.sky, -3.0, 5.2, 3.4, 0.7);
    await wt(tok, 700); gone(S.w); S.w1 = card('洗衣', FC.sky, -4.0, 5.2, 1.6, 0.7); S.w2 = card('脫水', FC.sky, -2.2, 5.2, 1.6, 0.7);
    cap('洗衣服的例子', '擺兩台：一台洗、一台脫水 → 多一個 stage');
  },
  async (tok, S) => { // 1586.2
    card('烘乾 1', FC.peach, -0.4, 5.2, 1.6, 0.7); card('烘乾 2', FC.peach, 1.4, 5.2, 1.6, 0.7); card('摺', FC.mint, 3.2, 5.2, 1.6, 0.7);
    cap('烘乾、摺衣服也分兩段', 'stage 變多，平行化程度提高');
  },
  async (tok, S) => { // 1595.4
    ok(inFlight(20, 10, 10) === 10, '10 個 stage → 同時 ' + inFlight(20, 10, 10) + ' 個指令 ✓', 0, 4.2);
    cap('增加到 10 個 stage', '同時 10 個指令 → speedup 10 倍');
  },
  async (tok, S) => { // 1606.6
    hot('deeper pipeline', 0, 3.5);
    cap('第一個方法', '更 deep 的 pipeline');
  },
  async (tok, S) => { // 1611.4
    S.a = card('一件事 1000 ps（示意）', FC.paper, 0, 2.5, 6.0, 0.5);
    cap('切得更小', 'clock cycle 也變小了');
  },
  async (tok, S) => { // 1644.6
    S.f = [0, 1, 2, 3, 4].map((i) => card('200', FC.sky, -2.4 + i * 1.2, 1.7, 1.1, 0.45, 0.5, 9)); sm('5 stage：clock = 最慢那段 = 200 ps', 4.4, 1.7);
    cap('clock cycle 要設成', '最慢那個 stage 需要的時間');
  },
  async (tok, S) => { // 1649.7
    S.g = Array.from({ length: 10 }, (_, i) => card('100', FC.mint, -2.7 + i * 0.6, 1.0, 0.55, 0.45, 0.5, 8)); sm('10 stage：clock = 100 ps', 4.4, 1.0);
    cap('切更多 stage', '每個 stage 做得更少，clock 更快');
  },
  async (tok, S) => { // 1662.2
    bad('可是 cycle 很短，工作不一定塞得進一個 stage', 0, 0.2);
    cap('clock cycle 很短', '每個 stage 的工作不見得塞得進去');
  },
  async (tok, S) => { // 1689.0
    bad('而且 branch 在很後面才決定 → penalty 很大', 0, -0.5);
    cap('很深的 pipeline', 'branch 在很後面決定，penalty 也很大');
  },
]);

scene('ppB-21a-wide', '21A：方法二：multiple issue（兩條 pipeline）', [
  async (tok, S) => { // 1704.4
    hd('方法二：還是 5 個 stage，一條 pipeline 不夠？', 0, 6.5);
    S.A = grid(['i1', 'i2', 'i3', 'i4', 'i5'], 9, { y: 5.2, x0: -2.0, dy: 0.5 }); for (let k = 0; k < 5; k++) S.A.row(k, k + 1, FIVE);
    cap('另一個方向', '還是五個 stage');
  },
  async (tok, S) => { // 1711.6
    hot('怎樣讓更多指令同時做？', -4.6, 2.4);
    cap('怎樣讓更多指令同時做？', '');
  },
  async (tok, S) => { // 1740.1
    pl('不能兩條 pipeline 嗎？', 3.0, 2.4);
    cap('只有一條 pipeline', '不能兩條嗎？');
  },
  async (tok, S) => { // 1753.1
    S.B = grid(['j1', 'j2', 'j3', 'j4', 'j5'], 9, { y: 1.6, x0: -2.0, dy: 0.5, head: false });     for (let k = 0; k < 5; k++) S.B.row(k, k + 1, FIVE);
    cap('double 一下，再加一條 pipeline', '兩條就 10 個指令在跑');
  },
  async (tok, S) => { // 1758.6
    sm('深度（stage 數）之外，也可以從寬度', 3.6, -0.6);
    cap('可以從深度', '也可以從寬度');
  },
  async (tok, S) => { // 1770.6
    S.A.col(5); S.B.col(5);
    cap('double 它的 resource', '同一個時間要 issue 幾個指令？');
  },
]);

scene('ppB-21a-wide2', '21A：兩條 pipeline：同時 10 個指令（multiple issue）', [
  async (tok, S) => { // 1855.5
    hd('兩條 pipeline：一次 fetch 2 個', 0, 6.5);
    S.A = grid(['i1', 'i2', 'i3', 'i4', 'i5'], 9, { y: 5.2, x0: -2.0, dy: 0.5 }); S.B = grid(['j1', 'j2', 'j3', 'j4', 'j5'], 9, { y: 1.6, x0: -2.0, dy: 0.5, head: false });
    for (let k = 0; k < 5; k++) { S.A.row(k, k + 1, FIVE); S.B.row(k, k + 1, FIVE); } S.A.col(5); S.B.col(5);
    sm('一次 fetch 2 個、一次執行 2 個', -4.0, -0.6);
    cap('一次 fetch 兩個指令', '一次可以執行兩個');
  },
  async (tok, S) => { // 1884.4
    pl('深度：5、6、7…　寬度：一次 fetch 2、3、4 個', 0, -1.2);
    cap('深度加深是一種', '橫向一次 fetch 2、3、4 個也是一種');
  },
  async (tok, S) => { // 1909.0
    ok(inFlight(5, 5, 5) * 2 === 10, '2 條 × 5 stage → cycle 5 同時 ' + inFlight(5, 5, 5) * 2 + ' 個 ✓', 4.2, 2.4);
    cap('兩條 pipeline、五個 stage', '同一個時間有 10 個指令');
  },
  async (tok, S) => { // 1956.1
    hot('multiple issue：每個 stage 不只一個指令', 0, -1.8);
    cap('這叫 multiple issue', '每個 stage 同時處理兩個以上的指令');
  },
]);

// 4 GHz, 4-way multiple issue: peak 16 BIPS, CPI 0.25, IPC 4
const GHZ = 4, WAY = 4, PEAK = GHZ * WAY, CPI4 = 1 / WAY, IPC4 = WAY;
scene('ppB-21a-ipc', '21A：CPI 與 IPC', [
  async (tok, S) => { // 1976.7
    hd('一個 cycle 能完成幾個指令？', 0, 6.5);
    cap('每個 cycle', '有好多個指令同時在做');
  },
  async (tok, S) => { // 1998.3
    S.a = card('single issue：每個 cycle 最多完成 1 個', FC.sky, -2.6, 5.3, 5.6, 0.6);
    cap('single issue 的 pipeline', '每個 cycle 一個指令完成（最好的狀況）');
  },
  async (tok, S) => { // 2023.0
    sm('有 dependency → 還不到 1 個', -2.6, 4.6);
    cap('比它壞的狀況', 'dependency → 每個 cycle 還不到一個');
  },
  async (tok, S) => { // 2030.5
    S.c = card('CPI = cycles / instruction ≥ 1', FC.paper, 3.4, 5.3, 4.0, 0.6);
    cap('CPI：一個指令要幾個 cycle', '1 或 1 以上');
  },
  async (tok, S) => { // 2060.6
    S.b = card('2-issue：一個 cycle 2 個指令', FC.mint, -2.6, 3.6, 5.6, 0.6);
    cap('multiple issue', '2-issue 一個 cycle 可以完成 2 個');
  },
  async (tok, S) => { // 2078.0
    S.i = card('IPC = instructions / cycle（越大越好）', FC.gold, 3.4, 3.6, 4.4, 0.6);
    cap('新的定義：IPC', 'instructions per cycle');
  },
  async (tok, S) => { // 2111.5
    good('IPC = 1 / CPI：是倒數，不一樣的東西', 0, 2.8);
    cap('CPI 跟 IPC 不一樣', 'multiple issue 時 CPI < 1，改用 IPC');
  },
  async (tok, S) => { // 2193.4
    S.ex = card('例：' + GHZ + ' GHz、' + WAY + '-way multiple issue', FC.peach, 0, 2.0, 5.0, 0.6);
    cap('例：4 GHz、4-way', '');
  },
  async (tok, S) => { // 2201.7
    pl(GHZ + ' × 10⁹ cycles/s × ' + WAY + ' = ' + PEAK + ' billion instructions/s', 0, 1.3);
    cap('每秒最多執行', '16 billion 個指令');
  },
  async (tok, S) => { // 2215.6
    ok(CPI4 === 0.25, '每 cycle 完成 ' + WAY + ' 個 → CPI = 1 / ' + WAY + ' = ' + CPI4 + ' ✓', -2.6, 0.6);
    cap('沒有 dependency 時', 'CPI = 1/4 = 0.25');
  },
  async (tok, S) => { // 2238.1
    ok(IPC4 * CPI4 === 1, 'IPC = ' + IPC4 + ' ✓', 2.8, 0.6);
    cap('算 IPC', '一個 cycle 完成 4 個：IPC = 4');
  },
  async (tok, S) => { // 2291.0
    bad('這都是最好的狀況：dependency → 不一定每次都拿得到 2 個', 0, -0.2);
    cap('這都是最好的狀況', '有 dependency 就達不到');
  },
]);

scene('ppB-21a-static', '21A：static vs dynamic multiple issue', [
  async (tok, S) => { // 2333.0
    hd('multiple issue 分兩大類', 0, 6.5);
    S.s = card('static', FC.sky, -3.4, 5.4, 3.4, 0.7); S.d = card('dynamic', FC.mint, 3.4, 5.4, 3.4, 0.7);
    cap('multiple issue 分兩大類', 'static 和 dynamic');
  },
  async (tok, S) => { // 2343.0
    glow(S.s, HL); sm('compile 時就決定：哪些可以同時 issue', -3.4, 4.6);
    cap('static：compile 的時候', '就把能同時 issue 的指令決定好');
  },
  async (tok, S) => { // 2365.7
    S.pk = [0, 1, 2, 3].map((i) => card('指令', FC.blue, -5.0 + i * 1.1, 3.6, 1.0, 0.5, 0.5, 9)); sm('pack 成一個 issue packet（4-way）', -3.4, 2.9);
    cap('group 起來成一個 issue packet', '4-way 就 4 個、2-way 就 2 個');
  },
  async (tok, S) => { // 2379.9
    sm('compiler 要 detect and avoid hazard；猜錯要有 fix 的 routine', -3.4, 2.2);
    cap('compiler 要 detect and avoid hazard', 'hardware 不管');
  },
  async (tok, S) => { // 2418.0
    glow(S.s, null); glow(S.d, HL); sm('run time 才決定', 3.4, 4.6);
    cap('dynamic multiple issue', 'run time 的時候才決定');
  },
  async (tok, S) => { // 2427.5
    sm('像 forwarding：detect 出 condition 就把資料給它', 3.4, 3.9);
    cap('有點像 forwarding 的概念', '偵測到就把資料給它、讓它平行做');
  },
  async (tok, S) => { // 2438.0
    sm('hazard 全部用 hardware 處理', 3.4, 3.2);
    cap('發生 hazard', '全部用 hardware 處理');
  },
  async (tok, S) => { // 2447.1
    sm('compiler 沒責任，但幫忙把沒 dependency 的放附近會更好', 3.4, 2.5);
    cap('compiler 雖然沒責任', '幫忙排好，hardware 效果更好');
  },
  async (tok, S) => { // 2488.2
    pl('static = software（compiler）approach　dynamic = hardware approach', 0, 1.2);
    cap('一種 software approach', '一種 hardware approach');
  },
]);

scene('ppB-21a-spec', '21A：speculation：猜 branch、猜 load', [
  async (tok, S) => { // 2500.2
    hd('不管哪一種：speculation（猜）很重要', 0, 6.5);
    cap('不管哪兩種方法', '猜（speculation）都很重要');
  },
  async (tok, S) => { // 2505.3
    S.b = buddy('不敢猜', '等…', FC.peach, -4.4, 3.6, 0, 0.9); S.b.mood('sad');
    sm('碰到 branch、load 就呆呆等 → 沒辦法平行', -4.4, 3.0);
    cap('通通不猜的話', '碰到 branch、load 只能呆在那邊等');
  },
  async (tok, S) => { // 2520.6
    S.g = buddy('猜', '先做！', FC.mint, 0, 3.6, 0, 0.9); S.g.mood('happy');
    sm('start operation as soon as possible；錯了再 roll back', 0, 3.0);
    cap('盡快開始做', '猜錯了再 roll back 就好');
  },
  async (tok, S) => { // 2547.0
    pk('猜 branch：taken / not taken', 4.0, 4.6);
    cap('branch 是很好的例子', '猜它 taken 還是 not taken');
  },
  async (tok, S) => { // 2580.4
    S.c = code(['sw  $t1, 0($s1)   # store', 'lw  $t2, 0($s2)   # 緊接一個 load'], 0, 1.8, 0.55); shh([3.6, 1.8]);
    cap('另一個：猜 load', 'store 後面緊接一個 load');
  },
  async (tok, S) => { // 2595.2
    sm('兩個通常不是同一個 address', 0, 0.6);
    cap('它們通常不會是同一個 address', '');
  },
  async (tok, S) => { // 2618.0
    hot('猜不同位址 → 先 load（load 要花時間，cache miss 更久）', 0, -0.1);
    cap('猜它們不同位址', '就先 load 再說');
  },
]);

// store → load speculation: run in order vs load-first, compare the loaded value
function stLd(stA, ldA) {
  const mem0 = { 100: 5, 200: 7, 1300: 3 };
  const inOrder = { ...mem0 }; inOrder[stA] = 9; const v1 = inOrder[ldA];
  const early = { ...mem0 }; const v2 = early[ldA]; early[stA] = 9;
  return { v1, v2, same: v1 === v2 };
}
const SL_SAME = stLd(1300, 1300), SL_DIFF = stLd(100, 200), SL_100 = stLd(100, 100);
scene('ppB-21a-load', '21A：speculate on load：什麼時候會錯', [
  async (tok, S) => { // 2652.1
    hd('store 緊接一個 load', 0, 6.5);
    S.m = [100, 200, 1300].map((a, i) => card(a + '：' + { 100: 5, 200: 7, 1300: 3 }[a], FC.paper, 3.4 + (i - 1) * 2.0, 5.4, 1.8, 0.6)); sm('memory（值是示意）', 3.4, 4.7);
    S.c = code(['sw  （寫 9 到某位址）', 'lw  （從某位址讀）'], -3.4, 5.6, 0.55);
    cap('store 到某個 memory address', '之後馬上緊接一個 load');
  },
  async (tok, S) => { // 2703.1
    sm('正常：store 先做完，再 load', -3.4, 4.2);
    cap('正常的話', 'store 要先做完，才 load');
  },
  async (tok, S) => { // 2715.6
    pl('load 先做，什麼時候會錯？store 和 load 都是 1300：', -1.0, 3.3);
    bad('照順序應讀到 ' + SL_SAME.v1 + '，load 先做卻讀到 ' + SL_SAME.v2 + ' → 錯', -1.0, 2.7);
    cap('同一個地址才會錯', 'store 1300、load 也 1300');
  },
  async (tok, S) => { // 2737.7
    sm('可是正常寫程式不會這樣：馬上要用，放在 register 就好', -1.0, 2.1);
    cap('正常寫 program 會這樣嗎？', '馬上要用的話，用 register 就好了');
  },
  async (tok, S) => { // 2758.3
    ok(SL_DIFF.same, 'store 100、load 200：兩種順序都讀到 ' + SL_DIFF.v1 + ' ✓', -1.0, 1.4);
    cap('假設是不同的地址', 'store 100、load 200，先 load 不會錯');
  },
  async (tok, S) => { // 2781.4
    hot('這就叫 speculate on load', -1.0, 0.8);
    cap('這就叫做 speculate on load', '');
  },
  async (tok, S) => { // 2807.1
    bad('再一次：store 100、load 100 → load 先做讀到 ' + SL_100.v2 + '（應該是 ' + SL_100.v1 + '）', -1.0, 0.1);
    cap('再講一次', 'store 到 100、load 也從 100：先 load 就錯');
  },
  async (tok, S) => { // 2845.4
    good('store 100、load 200 → 沒錯', 3.6, 0.8);
    cap('store 寫 100、load 讀 200', '先 load 沒有錯');
  },
  async (tok, S) => { // 2862.0
    sm('compiler 通常猜「不是同一個地址」，做完再 check', 3.6, 0.1);
    cap('所以通常猜不是同一個地址', '先 load，做完再 check');
  },
  async (tok, S) => { // 2897.0
    sm('store：computation 都做完了，最後一個 stage 慢慢寫沒關係', 0, -0.6);
    cap('store 晚點做有什麼關係？', 'computation 已經做完了');
  },
  async (tok, S) => { // 2926.5
    sm('load：資料下一個指令馬上就要拿來加、減', 0, -1.2);
    cap('load 不行', '下一個指令馬上就要用它的資料');
  },
  async (tok, S) => { // 2965.6
    sm('cache miss 要等半天；store 放 buffer 慢慢寫', 0, -1.8);
    cap('cache miss 要等很久', 'store 放在 buffer 慢慢寫就好');
  },
  async (tok, S) => { // 2983.4
    good('猜錯就 rollback', 4.4, -1.2);
    cap('如果錯了', 'rollback 就好');
  },
]);

scene('ppB-21a-fix', '21A：猜錯怎麼辦：fix-up routine 或 hardware flush', [
  async (tok, S) => { // 2992.3
    hd('compiler 可以 reorder：把 load 移到 store 前面', 0, 6.5);
    S.c = code(['lw  $t2, 0($s2)   ← 搬到前面', 'sw  $t1, 0($s1)'], -3.0, 5.4, 0.55); shh([1.0, 5.4]);
    cap('compiler 可以 reorder 指令', '例如把 load 放到 store 之前');
  },
  async (tok, S) => { // 3010.5
    S.k = code(['if（猜錯）', '    goto fix_up'], -3.0, 3.8, 0.55);
    cap('compiler approach', '在程式裡插一段 if-then-else 檢查');
  },
  async (tok, S) => { // 3023.0
    good('猜對：什麼都不用做', 2.6, 4.0); bad('猜錯：跳到 fix-up routine 去 recover', 2.6, 3.3);
    cap('猜對就不用做任何動作', '猜錯就跳到 fix-up routine 修正');
  },
  async (tok, S) => { // 3036.4
    hot('hardware approach：更多 hardware 檢查 condition，錯了就 flush 指令', 0, 1.8);
    cap('hardware 的話', '靠更多 hardware 檢查，錯了就 flush');
  },
]);

// ════════ Bu-L3BvML5E（第 21B 講：speculation、static dual issue（VLIW）、scheduling、loop unrolling、superscalar、power） ════════
// ── a tiny MIPS for the lecturer's loop: run sequentially, and run the dual-issue packets; compare memory ──
function dI(t) {
  const m = t.trim().match(/^(\w+)\s*(.*)$/); const op = m[1]; const a = m[2].split(',').map((x) => x.trim()).filter(Boolean);
  const mem = (s) => { const k = s.match(/^(-?\d+)\((\$\w+)\)$/); return [Number(k[1]), k[2]]; };
  if (op === 'nop') return { op, src: [], dst: null, cls: 'nop' };
  if (op === 'lw') { const [o, b] = mem(a[1]); return { op, dst: a[0], src: [b], off: o, base: b, cls: 'ls' }; }
  if (op === 'sw') { const [o, b] = mem(a[1]); return { op, dst: null, src: [a[0], b], val: a[0], off: o, base: b, cls: 'ls' }; }
  if (op === 'addu') return { op, dst: a[0], src: [a[1], a[2]], cls: 'alu' };
  if (op === 'addi') return { op, dst: a[0], src: [a[1]], imm: Number(a[2]), cls: 'alu' };
  if (op === 'bne') return { op, dst: null, src: [a[0], a[1]], cls: 'alu' };
  throw new Error('op ' + op);
}
const rv = (R, r) => (r === '$zero' ? 0 : R[r] || 0);
function runSeq(body, R, M) {   // body ends with bne …, Loop
  const I = body.map(dI); let guard = 0;
  for (;;) { let taken = false; for (const x of I) { if (x.op === 'lw') R[x.dst] = M[rv(R, x.base) + x.off]; else if (x.op === 'sw') M[rv(R, x.base) + x.off] = rv(R, x.val); else if (x.op === 'addu') R[x.dst] = rv(R, x.src[0]) + rv(R, x.src[1]); else if (x.op === 'addi') R[x.dst] = rv(R, x.src[0]) + x.imm; else if (x.op === 'bne') taken = rv(R, x.src[0]) !== rv(R, x.src[1]); } if (!taken || ++guard > 99) break; }
  return M;
}
function runPk(pk, R, M) {      // packets [[ALU/branch, load/store], …]: both slots read registers before either writes
  const P = pk.map((p) => p.map(dI)); let guard = 0;
  for (;;) {
    let taken = false;
    for (const p of P) {
      const w = [];
      for (const x of p) { if (x.op === 'lw') w.push([x.dst, M[rv(R, x.base) + x.off]]); else if (x.op === 'sw') w.push(['M', rv(R, x.base) + x.off, rv(R, x.val)]); else if (x.op === 'addu') w.push([x.dst, rv(R, x.src[0]) + rv(R, x.src[1])]); else if (x.op === 'addi') w.push([x.dst, rv(R, x.src[0]) + x.imm]); else if (x.op === 'bne') taken = rv(R, x.src[0]) !== rv(R, x.src[1]); }
      for (const v of w) { if (v[0] === 'M') M[v[1]] = v[2]; else R[v[0]] = v[1]; }
    }
    if (!taken || ++guard > 99) break;
  }
  return M;
}
// hazard rules of the static dual-issue MIPS: slot 0 = ALU/branch, slot 1 = load/store; no dependence inside a packet;
// a loaded value can't be used in the very next packet (load-use = 1 cycle)
function pkRules(pk) {
  const P = pk.map((p) => p.map(dI));
  const slots = P.every(([a, b]) => (a.cls === 'alu' || a.cls === 'nop') && (b.cls === 'ls' || b.cls === 'nop'));
  const lu = P.every((p, i) => i === 0 || !P[i - 1].some((x) => x.op === 'lw' && p.some((y) => y.src.includes(x.dst))));
  return slots && lu;   // 同一包內「先讀後寫」的語意由下面的模擬（和照順序執行比對）檢查
}
const LOOP = ['lw $t0, 0($s1)', 'addu $t0, $t0, $s2', 'sw $t0, 0($s1)', 'addi $s1, $s1, -4', 'bne $s1, $zero, Loop'];
const PK1 = [['nop', 'lw $t0, 0($s1)'], ['addi $s1, $s1, -4', 'nop'], ['addu $t0, $t0, $s2', 'nop'], ['bne $s1, $zero, Loop', 'sw $t0, 4($s1)']];
const PK4 = [['addi $s1, $s1, -16', 'lw $t0, 0($s1)'], ['nop', 'lw $t1, 12($s1)'], ['addu $t0, $t0, $s2', 'lw $t2, 8($s1)'], ['addu $t1, $t1, $s2', 'lw $t3, 4($s1)'],
  ['addu $t2, $t2, $s2', 'sw $t0, 16($s1)'], ['addu $t3, $t3, $s2', 'sw $t1, 12($s1)'], ['nop', 'sw $t2, 8($s1)'], ['bne $s1, $zero, Loop', 'sw $t3, 4($s1)']];
const MEM0 = () => { const M = {}; for (let a = 4; a <= 32; a += 4) M[a] = a * 3; return M; };   // 8 個 element（示意）
const REG0 = () => ({ $s1: 32, $s2: 10 });
const same = (A, B) => Object.keys(A).every((k) => A[k] === B[k]) && Object.keys(A).length === Object.keys(B).length;
const REF = runSeq(LOOP, REG0(), MEM0());
const nIns = (pk) => pk.flat().filter((t) => t !== 'nop').length;
const IPC_P1 = nIns(PK1) / PK1.length, IPC_P4 = nIns(PK4) / PK4.length;
const PK1_OK = pkRules(PK1) && same(runPk(PK1, REG0(), MEM0()), REF) && nIns(PK1) === 5 && PK1.length === 4 && IPC_P1 === 1.25;
const PK4_OK = pkRules(PK4) && same(runPk(PK4, REG0(), MEM0()), REF) && nIns(PK4) === 14 && PK4.length === 8 && IPC_P4 === 1.75;
// a packet table: cycle | ALU or branch | load/store
function pkTable(pk, x, yTop, dy = 0.5) {
  return table(x, yTop, ['cycle', 'ALU / branch', 'load / store'], pk.map((p, i) => [String(i + 1), p[0], p[1]]), { ws: [0.9, 2.9, 2.6], dy });
}
const pkPaint = (T) => T.cells.forEach((r) => r.slice(1).forEach((m) => { if (m.userData.lbl && m.userData.lbl.element.textContent === 'nop') tint(m, FC.gray); else tint(m, FC.mint); }));

scene('ppB-21b-why', '21B：為什麼 multiple issue 一定要猜', [
  async (tok, S) => { // 17.0
    hd('同學問：猜（speculation）跟 multiple issue 有什麼關係？', 0, 6.5);
    cap('猜跟 multiple issue 有什麼關係？', '');
  },
  async (tok, S) => { // 27.2
    S.G = grid(['beq', '（等決定）', '下一個'], 7, { y: 5.0, x0: -1.0 }); S.G.row(0, 1, FIVE); S.G.put(1, 2, 'bubble'); S.G.row(2, 3, FIVE);
    cap('不猜的話', '要等決定了才 fetch next');
  },
  async (tok, S) => { // 37.5
    bad('pipeline 常常是空的；一次能 fetch 兩個，不敢猜還是只能 fetch 一個', 0, 2.6);
    cap('pipeline 可能都是空的', '就算能 fetch 兩個，不猜還是只能 fetch 一個');
  },
  async (tok, S) => { // 45.7
    good('要讓 pipeline 大部分時間都滿 → 一定要猜（speculation）', 0, 1.9);
    cap('要讓平行度更高', 'pipeline 大部分時間都是滿的 → 要猜');
  },
  async (tok, S) => { // 55.4
    pk('software：程式裡 check，猜錯跳 fix-up routine', -2.8, 1.1);
    cap('猜可能會猜錯', 'software：check，錯了 fix up 回來');
  },
  async (tok, S) => { // 73.0
    pk('hardware：superscalar', 3.2, 1.1);
    cap('hardware 的話', '就是 superscalar 架構');
  },
]);

scene('ppB-21b-commit', '21B：superscalar：in-order fetch、out-of-order 執行、in-order commit', [
  async (tok, S) => { // 78.3
    hd('superscalar 的整個概念', 0, 6.5);
    S.f = card('fetch / issue：in order（找出 dependency）', FC.sky, 0, 5.4, 6.4, 0.6);
    cap('fetch 的時候 in order', '把 dependency 找出來');
  },
  async (tok, S) => { // 84.0
    S.u = ['ALU', 'ALU', 'load/store'].map((t, i) => card(t, FC.peach, -3.0 + i * 3.0, 4.2, 2.4, 0.6));
    sm('execution：out of order（有先有後）', 0, 3.5);
    cap('execution 時 out of order', '不照次序，有先有後沒關係');
  },
  async (tok, S) => { // 90.4
    S.b = card('commit buffer', FC.mint, 0, 2.6, 4.4, 0.6);
    cap('結果先存在 buffer', '不馬上寫回 register、也不馬上寫 memory');
  },
  async (tok, S) => { // 97.7
    S.st = prop('cpu', 4.8, 1.0, 0, 0.9, 'state（register / memory）');
    sm('改變 state 才算數；中間算的放 temporary 沒關係', -1.6, 1.9);
    cap('改變 state 才會影響結果', '中間怎麼算都放在 temporary');
  },
  async (tok, S) => { // 106.5
    arrow(V3(2.3, 2.6, 0.3), V3(4.2, 1.6, 0.3), 0x2fc092); pl('commit：照 in order 寫回', 1.0, 1.2);
    cap('最後 commit 的時候', '才按照 in order 寫回');
  },
  async (tok, S) => { // 111.1
    good('不確定是正確的 → 留在 buffer；確定正確才寫回', -1.6, 0.5);
    cap('不正確的時候', '留在 buffer，直到正確才寫回');
  },
  async (tok, S) => { // 121.0
    bad('branch 猜錯 → 把 buffer 裡的 flush 掉就好', -1.6, -0.2);
    cap('像 branch 猜錯', '就 flush');
  },
]);

scene('ppB-21b-specexc', '21B：speculation 與 exception', [
  async (tok, S) => { // 130.2
    hd('猜了，結果發生 exception 怎麼辦？', 0, 6.5);
    cap('exception 也一樣', '猜了之後錯了怎麼辦？');
  },
  async (tok, S) => { // 141.1
    S.c = code(['beq  ...          # 還沒決定', 'lw   $t1, 0($t0)  # 猜它會執行，先做'], -1.4, 5.2, 0.6); shh([3.6, 5.6]);
    cap('例：猜 load 先做', '');
  },
  async (tok, S) => { // 149.4
    bad('$t0 是 invalid address → 產生 exception', -1.4, 3.6);
    cap('結果它是一個 invalid address', '產生 exception');
  },
  async (tok, S) => { // 158.0
    hot('這個 exception 不能要：正常執行根本不會發生', -1.4, 2.9);
    cap('這個 exception 不能要', '它不是真正的 exception');
  },
  async (tok, S) => { // 160.0
    S.s = card('static：defer exception', FC.sky, -3.2, 1.8, 3.8, 0.6);
    cap('不論 static 或 dynamic', '都要考慮 exception：先 defer');
  },
  async (tok, S) => { // 173.3
    S.d = card('dynamic：buffer exception 到 commit', FC.mint, 2.4, 1.8, 4.6, 0.6);
    sm('真的 commit 時才處理（它可能是 out of order 先猜的）', 0, 1.0);
    cap('dynamic 也一樣', 'buffer exception，直到真的 commit');
  },
  async (tok, S) => { // 188.6
    note('要更多 hardware、更多 effort：speculation 與 exception 互相交錯', 0, 0.2);
    cap('要更多 hardware 和 effort', 'speculation 跟 exception 互相交錯');
  },
]);

scene('ppB-21b-vliw', '21B：static multiple issue = VLIW', [
  async (tok, S) => { // 198.7
    hd('兩種 multiple issue', 0, 6.5);
    S.s = card('static multiple issue', FC.sky, -3.2, 5.4, 4.2, 0.6); S.d = card('dynamic multiple issue', FC.mint, 3.2, 5.4, 4.2, 0.6);
    cap('再仔細看兩種方法', 'static、dynamic multiple issue');
  },
  async (tok, S) => { // 208.5
    sm('compiler approach', -3.2, 4.8); sm('hardware approach', 3.2, 4.8); glow(S.s, HL);
    cap('static 主要是 compiler 的 approach', 'dynamic 主要是 hardware');
  },
  async (tok, S) => { // 220.6
    S.p = [card('add …', FC.blue, -4.0, 3.6, 1.8, 0.55, 0.6), card('lw …', FC.green, -2.1, 3.6, 1.8, 0.55, 0.6)]; shh([-3.0, 3.0]);
    await wt(tok, 500); S.box = card('', FC.gold, -3.05, 3.6, 4.1, 0.75, 0.3); fade(S.box, 0.3);
    cap('能平行做的 pack 在一起', '當成一個 single instruction');
  },
  async (tok, S) => { // 239.7
    sm('同一包不能有 dependency；發生 exception 也當一個指令看', 1.8, 3.6);
    cap('兩個之間當然不能有 dependency', 'exception 也當成一個指令');
  },
  async (tok, S) => { // 250.1
    pl('① 要能 group：parallelism 要足夠', 0, 2.4);
    cap('首先要能 group 指令', 'parallelism 要足夠');
  },
  async (tok, S) => { // 257.3
    pl('② pipeline 的 resource 要增加', 0, 1.8);
    cap('再來 pipeline resource 要增加', '');
  },
  async (tok, S) => { // 268.5
    hot('一包 = 一個很長的指令：VLIW（very long instruction word）', 0, 1.0);
    cap('一包當成一個很長的指令', 'VLIW：very long instruction word');
  },
  async (tok, S) => { // 288.1
    sm('用 compiler 把很多指令 pack 在一起，同一時間執行很多個', 0, 0.3);
    cap('說 processor 是 VLIW', '就是用 compiler approach');
  },
]);

scene('ppB-21b-sched', '21B：scheduling：同一包不能有 dependency，找不到就 nop', [
  async (tok, S) => { // 295.6
    hd('compiler 要 schedule、remove hazard', 0, 6.5);
    cap('要 schedule 會發生什麼事？', 'compiler 要 remove 這些 hazard');
  },
  async (tok, S) => { // 308.6
    S.T = table(-3.6, 5.0, ['ALU / branch', 'load / store'], [['add $t0, …', 'lw $t1, 0($t0)']], { ws: [2.6, 2.6] }); shh([2.6, 5.0]);
    bad('同一包有 dependency（$t0）→ 不行', 0, 4.0);
    cap('issue packet 裡的指令', '不能有 dependency（2-issue 的兩個）');
  },
  async (tok, S) => { // 320.0
    sm('packet 和 packet 之間有 dependency → 看 processor 怎麼處理（stall 或 compiler 避開）', 0, 3.2);
    cap('packet 之間有 dependency 怎麼辦？', '看 processor 怎麼做，compiler 要知道');
  },
  async (tok, S) => { // 333.0
    S.T.set(0, 1, 'nop'); tint(S.T.cells[0][1], FC.gray); S.T.add(['nop', 'lw $t1, 0($t0)']); tint(S.T.cells[1][0], FC.gray);
    good('找不到能 pack 的 → insert nop（這就是 scheduling）', 0, 1.6);
    cap('找不到怎麼辦？', 'insert no-op；這就是 scheduling 的問題');
  },
]);

scene('ppB-21b-dual', '21B：MIPS dual issue：ALU/branch + load/store', [
  async (tok, S) => { // 342.0
    hd('例子：dual issue（一次發兩個）', 0, 6.5);
    cap('看一個例子', 'dual issue：一次發兩個指令');
  },
  async (tok, S) => { // 351.0
    sm('VLIW 不是任何組合都可以', 0, 5.9);
    cap('VLIW 不是任何兩個指令', '都可以 pack 在一起');
  },
  async (tok, S) => { // 362.0
    S.a = card('ALU 或 branch', FC.blue, -2.0, 5.1, 3.4, 0.6); S.b = card('load 或 store', FC.green, 1.6, 5.1, 3.4, 0.6);
    bad('兩個 load、兩個 ALU：不行', 4.6, 4.4);
    cap('一個 ALU、一個 load/store', '不能兩個都 load、兩個都 ALU');
  },
  async (tok, S) => { // 372.4
    pl('一個 packet：slot 0 = ALU / branch，slot 1 = load / store', -0.2, 4.4);
    cap('一個 packet 兩個指令', '一個 ALU 或 branch，一個 load/store');
  },
  async (tok, S) => { // 385.4
    S.t1 = sm('每個指令 32 bit → 一包 64 bit（64-bit aligned），一次 fetch 64 bit', -0.2, 3.8);
    cap('每個 32 bit', '一包 64 bit，一次 fetch 64 bit');
  },
  async (tok, S) => { // 396.6
    S.t2 = sm('實在沒辦法 pack → 放 nop（簡化 hardware）', -0.2, 3.2);
    cap('沒辦法 pack 就 pack 一個 no-op', '這是為了簡化 hardware');
  },
  async (tok, S) => { // 445.2
    gone(S.a, S.b, S.t1, S.t2); // the pipeline chart takes this space (the same points come back below it)
    S.G = grid(['ALU / branch', 'load / store', 'ALU / branch', 'load / store', 'ALU / branch', 'load / store'], 8, { y: 2.6, x0: -1.4, dy: 0.42, fs: 9 });
    [0, 1].forEach((k) => S.G.row(k, 1, FIVE));
    cap('pipeline 圖', '同一個時間，兩個指令一起進來');
  },
  async (tok, S) => { // 459.5
    [2, 3].forEach((k) => S.G.row(k, 2, FIVE)); [4, 5].forEach((k) => S.G.row(k, 3, FIVE));
    ok([0, 2, 4].every((k) => Object.keys(S.G.cells[k]).length === 5), '每個 cycle 進 2 個：1 個 ALU + 1 個 load/store ✓', 3.6, 0.0);
    cap('第二、第三個時間也是兩個', '只能 ALU 配 load/store');
  },
  async (tok, S) => { // 485.7
    note('不是兩條 pipeline 就隨便要什麼：有 resource sharing 的限制', -1.0, -0.5);
    cap('不是兩條 pipeline 就隨便配', '有 resource 要 share，設計好的規定');
  },
  async (tok, S) => { // 513.0
    hot('scheduling 要照 hardware 的規定來 pack', 3.6, -0.5);
    cap('scheduling 很重要', '要根據 hardware 的規定 pack');
  },
  async (tok, S) => { // 555.4
    sm('不是隨便找兩個 independent 的：一個從 ALU/branch 組、一個從 load/store 組', -1.0, -1.1);
    cap('隨便找兩個 independent 的？', '不是：一個從這組、一個從那組');
  },
  async (tok, S) => { // 579.7
    good('選不出來 → nop', 3.6, -1.1);
    cap('選不出來怎麼辦？', 'no-op');
  },
  async (tok, S) => { // 609.0
    sm('每次 fetch 64 bit：一個 ALU、一個 load/store，pack 不起來就塞 nop', 0, -1.7);
    cap('每次 fetch 還是 64 bit', '一個 ALU、一個 load/store');
  },
]);

scene('ppB-21b-hw', '21B：dual issue 需要的 hardware', [
  async (tok, S) => { // 634.8
    hd('dual issue 要加哪些 hardware？（不必整個 double）', 0, 6.5);
    cap('hardware 需要什麼？', '不用 double 全部，只增加某些 resource');
  },
  async (tok, S) => { // 649.0
    S.c = code(['add  $t0, $s0, $s1   # ALU', 'sw   $t2, 4($t3)    # load/store'], -2.6, 5.5, 0.55); shh([1.8, 5.5]);
    cap('同時執行兩個指令', '一個 ALU、一個 load/store');
  },
  async (tok, S) => { // 662.0
    S.rf = card('register file', FC.lilac, -2.6, 3.6, 3.0, 1.0);
    cap('同一個時間去讀 register file', '要讀出幾個 operand？');
  },
  async (tok, S) => { // 685.1
    S.rp = ['$s0', '$s1', '$t3', '$t2'].map((r, i) => card(r, FC.paper, 0.2 + i * 1.0, 4.0, 0.9, 0.45, 0.5, 9));
    pl('R-type 的 rs、rt ＋ store 的 rs、rt = 4 個', 1.7, 3.3);
    cap('R-type 加 load/store', '同時要讀四個 operand（rs、rt、rs、rt）');
  },
  async (tok, S) => { // 702.2
    relabel(S.rf, 'register file：4 read port'); sm('以前 2 個 read port → 現在 4 個；port 要成本', -2.6, 2.7);
    cap('read port 從 2 個變 4 個', '增加 port 不是不用錢的');
  },
  async (tok, S) => { // 734.0
    relabel(S.rf, '4 read port、2 write port');
    sm('同時可能有 2 個指令在 WB 寫回 → 2 個 write port', -2.6, 2.1);
    cap('同一時間還可能寫回兩個', '4 個 read port、2 個 write port');
  },
  async (tok, S) => { // 762.4
    S.alu = card('ALU（算數）', FC.peach, 3.4, 2.4, 2.4, 0.6); S.alu2 = card('＋ ALU（算地址）', FC.gold, 3.4, 1.6, 2.4, 0.6);
    cap('EX：以前 ALU 共用', '現在要多一個 ALU 算 load/store 的地址');
  },
  async (tok, S) => { // 787.3
    sm('memory、write back 一樣', 3.4, 0.9);
    cap('memory 還是一樣', 'write back 還是一樣');
  },
  async (tok, S) => { // 808.5
    note('類比：要做 shift 就得加一個 shifter：加功能就要加 hardware', 0, 0.2);
    cap('增加功能', '就要增加 hardware');
  },
]);

scene('ppB-21b-dhz', '21B：dual issue 的 hazard：同一包不能 forward', [
  async (tok, S) => { // 859.4
    hd('同時執行兩個 → hazard 的代價也比較大', 0, 6.5);
    cap('同一個時間執行兩個', '產生 hazard 時代價也比較大');
  },
  async (tok, S) => { // 882.5
    sm('先看 EX stage 的 data hazard', 0, 5.8);
    cap('假如在 execution stage', '發生 hazard');
  },
  async (tok, S) => { // 895.2
    const R = schedule(['add $t0, $s0, $s1', 'sub $t2, $t0, $s3'].map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
    S.G = grid(['add $t0, $s0, $s1', 'sub $t2, $t0, $s3'], 7, { y: 5.0, x0: -0.6 }); R.rows.forEach((r, k) => FIVE.forEach((s, i) => S.G.put(k, r.IF + i, s)));
    arrow(V3(S.G.cx(3) + 0.3, S.G.cy(0) - 0.15, 0.4), V3(S.G.cx(4) - 0.3, S.G.cy(1) + 0.15, 0.4), 0xc08a1f);
    ok(R.stalls === 0, 'single issue：EX/MEM → EX forward，0 stall ✓', 0, 3.4); shh([5.4, 5.6]);
    cap('single issue', '前一個算完已在 pipeline register，forward 就好');
  },
  async (tok, S) => { // 937.0
    S.H = grid(['add $t0, $s0, $s1', 'lw  $s2, 0($t0)'], 7, { y: 2.2, x0: -0.6, head: false }); S.H.row(0, 1, FIVE); S.H.row(1, 1, FIVE);
    S.H.hl(0, 3, '#7a1010'); S.H.hl(1, 3, '#7a1010'); shh([5.4, 2.6]);
    bad('同一包、同時在 EX：一個在算、一個要用 → 沒辦法 forward', 0, 0.9);
    cap('dual issue：兩個同時在 ALU', '一個算、一個要用 → 沒辦法 forward');
  },
  async (tok, S) => { // 964.3
    gone(S.H); S.H = grid(['add $t0, $s0, $s1', 'lw  $s2, 0($t0)'], 7, { y: 2.2, x0: -0.6, head: false }); S.H.row(0, 1, FIVE); S.H.row(1, 2, FIVE);
    good('只好拆成兩個 packet（像 stall 一樣）', 0, 0.3);
    cap('只好拆成兩個 packet', '相當於 stall 的概念');
  },
  async (tok, S) => { // 985.8
    hot('另一個 penalty：load-use', 0, -0.4);
    cap('還有哪些 penalty？', 'load-use');
  },
]);

const LU = schedule(['lw $2, 20($1)', 'and $4, $2, $5'].map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
const FW = schedule(['sub $2, $1, $3', 'and $12, $2, $5'].map((t) => parseIns(t)), { fwd: true, br: 'pnt', mem1: false });
const LU_OK = LU.stalls === 1 && LU.rows[1].stall === 1 && FW.stalls === 0;
function drawSched(R, names, y, head = true) {
  const G = grid(names, 7, { y, x0: -0.6, head });
  R.rows.forEach((r, k) => { G.put(k, r.IF, 'IF'); for (let c = r.IF + 1; c < r.ID; c++) G.put(k, c, 'bubble'); ['ID', 'EX', 'MEM', 'WB'].forEach((s) => G.put(k, r[s], s)); });
  return G;
}
scene('ppB-21b-lu', '21B：load-use hazard：dual issue 損失 2 個指令', [
  async (tok, S) => { // 1014.2
    hd('data dependency 有兩種', 0, 6.5);
    S.A = drawSched(FW, ['sub $2, $1, $3', 'and $12, $2, $5'], 5.0); shh([5.6, 5.5]);
    cap('R-type 接 R-type', 'ALU 用完下一個馬上用：forward 就好');
  },
  async (tok, S) => { // 1021.2
    S.B = drawSched(LU, ['lw  $2, 20($1)', 'and $4, $2, $5'], 2.6, false);
    cap('另一種：load 的資料', '馬上就要用');
  },
  async (tok, S) => { // 1041.3
    arrow(V3(S.A.cx(3) + 0.3, S.A.cy(0) - 0.15, 0.4), V3(S.A.cx(4) - 0.3, S.A.cy(1) + 0.15, 0.4), 0xc08a1f);
    sm('ALU 算完，結果已在 pipeline register → forward', 3.0, 3.9);
    cap('forward：ALU 算完下一個要用', '已經在 pipeline register 裡了');
  },
  async (tok, S) => { // 1053.0
    S.B.hl(0, 4, HL); sm('load 要到第 4 個 stage（MEM）結束才拿到資料', 3.0, 1.5);
    cap('load 在第 4 個 stage 才 access', '第 4 個 stage 結束才拿到');
  },
  async (tok, S) => { // 1059.6
    bad('下一個在第 3 個 stage（EX）同時就要用 → 給不了', 3.0, 0.9);
    cap('下一個指令在第 3 個 stage', '同一個時間就要用，沒辦法給');
  },
  async (tok, S) => { // 1067.2
    ok(LU_OK, 'load-use：一定 stall ' + LU.stalls + ' 個 cycle ✓', 3.0, 0.3);
    cap('一定有一個 cycle 的 penalty', '');
  },
  async (tok, S) => { // 1080.3
    pl('single issue：損失 1 個指令的位置　dual issue：1 個 cycle = 2 個指令的位置', 0, -0.4);
    cap('single issue 一個 cycle penalty', 'dual issue：一個 cycle 就是兩個指令');
  },
  async (tok, S) => { // 1093.3
    hot('所以 scheduling 很重要', 0, -1.0);
    cap('所以 scheduling 很重要', '要把 dual issue 排得很好');
  },
]);

scene('ppB-21b-lu2', '21B：再講一次：forwarding 與 load-use', [
  async (tok, S) => { // 1160.0
    hd('data hazard：要用前一個指令的資料，但還沒出來', 0, 6.5);
    cap('data hazard', '下一個指令馬上要用前一個的資料');
  },
  async (tok, S) => { // 1171.7
    S.A = drawSched(FW, ['sub $2, $1, $3', 'and $12, $2, $5'], 5.0); shh([5.6, 5.5]);
    S.A.hl(0, 5, '#3a2a6a'); sm('sub 到第 5 個 stage 才寫回，但 EX 早就算出來了', 2.6, 3.9);
    cap('ALU type：第 5 個 stage 才寫回', '可是其實早就算出來了');
  },
  async (tok, S) => { // 1186.0
    arrow(V3(S.A.cx(3) + 0.3, S.A.cy(0) - 0.15, 0.4), V3(S.A.cx(4) - 0.3, S.A.cy(1) + 0.15, 0.4), 0xc08a1f);
    ok(FW.stalls === 0, 'forwarding：直接從 pipeline register 拿過來，0 stall ✓', 2.6, 3.3);
    cap('雖然沒寫回，直接拿過來', 'hardware 偵測 condition，從 pipeline register forward');
  },
  async (tok, S) => { // 1201.9
    S.B = drawSched(LU, ['lw  $2, 20($1)', 'and $4, $2, $5'], 2.2, false); S.B.hl(0, 4, HL);
    cap('前一個是 load', '第 4 個 stage 才去讀資料');
  },
  async (tok, S) => { // 1214.7
    bad('and 在第 3 個 stage 就要用 → 根本還沒讀出來', 2.6, 1.0);
    cap('下一個在第 3 個 stage 要用', '它根本還沒讀出來');
  },
  async (tok, S) => { // 1236.2
    S.B.hl(1, 3, '#3a2a6a'); ok(LU.rows[1].stall === 1, 'insert 一個 bubble（stall 1 cycle）✓', 2.6, 0.4);
    cap('一定要 penalty 一個 cycle', 'insert 一個 bubble');
  },
  async (tok, S) => { // 1243.5
    hot('這就叫 load-use hazard', 2.6, -0.2);
    cap('這叫 load-use hazard', 'load 之後一用就要 stall 一個');
  },
  async (tok, S) => { // 1253.7
    sm('single issue 犧牲 1 個指令；dual issue 下面兩個在等 → 犧牲 2 個', 0, -0.9);
    cap('single issue 犧牲一個', 'dual issue 犧牲兩個（要 bubble 兩個）');
  },
]);

scene('ppB-21b-sched-ex', '21B：scheduling 例子：4 個 cycle 做 5 個指令', [
  async (tok, S) => { // 1271.0
    hd('排一個 program：array 每個元素加一個值', 0, 6.6);
    S.c = code(['Loop: lw   $t0, 0($s1)', '      addu $t0, $t0, $s2', '      sw   $t0, 0($s1)', '      addi $s1, $s1, -4', '      bne  $s1, $zero, Loop'], -3.8, 5.8, 0.52);
    cap('scheduling 的例子', '其實很簡單');
  },
  async (tok, S) => { // 1283.4
    sm('一個 array：讀進來、加一個值、寫回去', 1.8, 5.8);
    cap('一個 array', '每次讀進來加一個值，再寫回去');
  },
  async (tok, S) => { // 1296.1
    S.c.hl(0); sm('$s1 指到某個 element，讀進 $t0', 1.8, 5.2);
    cap('lw：從 $s1 指的 element', '讀進 $t0');
  },
  async (tok, S) => { // 1304.0
    S.c.hl(1); sm('$t0 加上 scalar $s2', 1.8, 4.6);
    cap('addu：加一個 scalar（$s2）', '結果放回 $t0');
  },
  async (tok, S) => { // 1313.2
    S.c.hl(3); sm('寫回去；$s1 減 4 → 下一個 element', 1.8, 4.0);
    cap('sw 寫回，addi 把 $s1 減 4', '例如位址 100 變 96（往前一個 word）');
  },
  async (tok, S) => { // 1331.7
    S.c.hl(4); sm('$s1 = 0 時結束', 1.8, 3.4);
    cap('一直 loop', '到 $s1 是 0 就結束');
  },
  async (tok, S) => { // 1349.3
    S.c.hl(-1); pk('$t0：lw → addu → sw 相依', 1.8, 2.7); pk('$s1：addi → bne 相依', 1.8, 2.1);
    cap('顏色代表 dependency', '$t0 一串、$s1 一串');
  },
  async (tok, S) => { // 1360.4
    S.c.kill(); S.T = pkTable([['', ''], ['', ''], ['', ''], ['', '']], -3.6, 5.4);
    cap('要 pack：一次兩個', '一個 ALU、一個 load/store');
  },
  async (tok, S) => { // 1370.7
    S.T.set(0, 2, PK1[0][1]); S.T.set(2, 1, PK1[2][0]); S.T.set(3, 2, PK1[3][1]);
    bad('lw、addu、sw 三個 dependent → 不能放同一包', 2.8, 1.8);
    cap('lw、addu、sw 三個', '有 dependency，不可能 pack 在一起');
  },
  async (tok, S) => { // 1378.1
    S.T.set(1, 1, PK1[1][0]);
    cap('addi 可以跟上面 pack', '');
  },
  async (tok, S) => { // 1401.2
    sm('ALU（綠）可以跟 load/store（紅）pack；branch 也可以跟 store pack', 0.4, 1.1);
    cap('綠的可以跟紅的 pack', 'branch 也可以選一個 store 來 pack');
  },
  async (tok, S) => { // 1461.2
    S.T.set(3, 1, PK1[3][0]); glow(S.T.cells[3][1], HL); glow(S.T.cells[3][2], HL);
    sm('sw 在 addi 之後執行 → offset 改成 4($s1)', 0.4, 0.5);
    cap('這裡把 bne 跟 sw pack', '');
  },
  async (tok, S) => { // 1473.0
    PK1.forEach((p, i) => p.forEach((t, j) => { if (t === 'nop') S.T.set(i, j + 1, 'nop'); })); pkPaint(S.T);
    cap('只有最後一包真的 pack 起來', '其他都配 nop');
  },
  async (tok, S) => { // 1486.4
    ok(PK1_OK, nIns(PK1) + ' 個指令 / ' + PK1.length + ' 個 cycle → IPC = ' + IPC_P1 + ' ✓（跑 8 個 element，結果和照順序執行一樣）', 0, -0.2);
    cap('4 個 cycle 執行 5 個指令', 'IPC = 1.25');
  },
  async (tok, S) => { // 1496.5
    bad('兩條 pipeline，IPC 照理應該是 2 → 只多一點點', 0, -0.9);
    cap('照理 IPC 應該是 2', 'performance 只增加一點點');
  },
]);

scene('ppB-21b-unroll', '21B：loop unrolling：一次做 4 份', [
  async (tok, S) => { // 1510.1
    hd('compiler 很重要的方法：loop unrolling', 0, 6.5);
    cap('loop 會一直執行', 'compiler 很重要的方法：loop unrolling');
  },
  async (tok, S) => { // 1525.4
    S.one = card('1 個 iteration × 1000 次', FC.sky, -3.4, 5.2, 4.0, 0.7);
    cap('這只有一個 iteration', '可是要執行 1000 次');
  },
  async (tok, S) => { // 1531.0
    S.four = [0, 1, 2, 3].map((i) => card('copy ' + (i + 1), FC.mint, 1.0 + i * 1.5, 5.2, 1.4, 0.7));
    ok(1000 / 4 === 250, '4 個 copy → 1000 / 4 = ' + 1000 / 4 + ' 個 iteration ✓', 3.2, 4.3);
    cap('copy 四份', '1000 / 4 = 250 個 iteration');
  },
  async (tok, S) => { // 1550.6
    sm('unroll 之後可以同時執行好多個指令', 0, 3.4);
    cap('為什麼要 loop unrolling？', '可以同時執行好多個指令');
  },
  async (tok, S) => { // 1572.3
    good('四個 copy → window 裡有更多指令 → 可以好好 pack', 0, 2.6);
    cap('有更多指令在 window 裡', '就可以好好 schedule、pack');
  },
  async (tok, S) => { // 1612.2
    S.c = code(['lw   $t0, 0($s1)   addu $t0, …   sw $t0, 0($s1)', 'lw   $t0, -4($s1)  addu $t0, …   sw $t0, -4($s1)', 'lw   $t0, -8($s1)  addu $t0, …   sw $t0, -8($s1)', 'lw   $t0, -12($s1) addu $t0, …   sw $t0, -12($s1)'], 0, 1.8, 0.5);
    cap('每一份：讀 element、加 scalar、寫回', '四份處理四個 element');
  },
]);

scene('ppB-21b-rename', '21B：register renaming 與 unrolled schedule（8 cycle 14 個指令）', [
  async (tok, S) => { // 1669.0
    hd('單純 copy：全部都用 $t0', 0, 6.6);
    S.c = code(['lw $t0,0($s1)    addu $t0,$t0,$s2  sw $t0,0($s1)', 'lw $t0,-4($s1)   addu $t0,$t0,$s2  sw $t0,-4($s1)', 'lw $t0,-8($s1)   addu $t0,$t0,$s2  sw $t0,-8($s1)', 'lw $t0,-12($s1)  addu $t0,$t0,$s2  sw $t0,-12($s1)'], 0, 5.8, 0.5);
    S.t1 = bad('看起來每份都 depend on 前一份的 $t0 → 沒辦法平行', 0, 3.5);
    cap('都用同一個 $t0', '看起來有 dependency');
  },
  async (tok, S) => { // 1691.0
    S.t2 = hot('這個 $t0 跟那個 $t0 有關係嗎？', 0, 2.8);
    cap('仔細想想', '這個 $t0 跟那個 $t0 有關係嗎？');
  },
  async (tok, S) => { // 1704.5
    S.t3 = sm('前一份已經 sw 回去了；下一份 lw 進來的是新資料 → 沒關係', 0, 2.2);
    cap('已經 store 回去了', '再 load 進來的是新的 $t0');
  },
  async (tok, S) => { // 1750.3
    S.c.kill(); S.c = code(['lw $t0,0($s1)    addu $t0,$t0,$s2  sw $t0,0($s1)', 'lw $t1,-4($s1)   addu $t1,$t1,$s2  sw $t1,-4($s1)', 'lw $t2,-8($s1)   addu $t2,$t2,$s2  sw $t2,-8($s1)', 'lw $t3,-12($s1)  addu $t3,$t3,$s2  sw $t3,-12($s1)'], 0, 5.8, 0.5);
    S.t4 = good('改名：$t0、$t1、$t2、$t3（多用幾個 register）', 0, 1.5);
    cap('unroll 之後換名字', '$t0、$t1、$t2、$t3');
  },
  async (tok, S) => { // 1769.2
    S.t5 = pk('這就是 rename：name dependency，不是真的 data dependency', 0, 0.8);
    cap('這就是 rename', '只是名字 dependency，data 根本沒有');
  },
  async (tok, S) => { // 1805.3
    S.c.kill(); gone(S.t1, S.t2, S.t3, S.t4, S.t5);
    S.T = pkTable(PK4.map(() => ['', '']), -3.6, 5.6, 0.48); shh([3.6, 6.1]);
    cap('相當於一次考慮四個 element', '');
  },
  async (tok, S) => { // 1825.3
    [0, 1].forEach((i) => { S.T.set(i, 1, PK4[i][0]); S.T.set(i, 2, PK4[i][1]); });
    cap('先 load 兩個', '再開始運算');
  },
  async (tok, S) => { // 1858.5
    for (let i = 2; i < PK4.length; i++) { S.T.set(i, 1, PK4[i][0]); S.T.set(i, 2, PK4[i][1]); }
    pkPaint(S.T);
    sm('第 2 份的 load 和第 1 份的 addu 重疊在同一個 cycle', 3.4, 1.4);
    cap('load 跟運算搭配', '下一份的 load 和上一份的加法重疊');
  },
  async (tok, S) => { // 1962.3
    ok(PK4_OK, nIns(PK4) + ' 個指令 / ' + PK4.length + ' 個 cycle → IPC = ' + IPC_P4 + ' ✓（結果和照順序執行一樣）', 0, 0.8);
    cap('8 個 cycle 做 14 個指令', 'IPC 1.75，比 1.25 好很多');
  },
  async (tok, S) => { // 1981.0
    bad('代價：多用 register（$t0～$t3）、code size 變大', 0, 0.1);
    cap('代價是什麼？', '要更多 register，code size 也變大');
  },
]);

const ITER = 1003, UN = 4;
scene('ppB-21b-overhead', '21B：unrolling 的好處與 anti-dependence', [
  async (tok, S) => { // 2017.5
    hd('回頭看 loop unrolling 這一頁', 0, 6.5);
    cap('回到前面那一頁', '有一個名詞：anti-dependency');
  },
  async (tok, S) => { // 2034.0
    S.a = card('reduce loop control overhead', FC.gold, 0, 5.5, 5.0, 0.6);
    cap('unroll 可以省什麼？', 'reduce loop control overhead');
  },
  async (tok, S) => { // 2047.1
    S.s1 = strip(Array.from({ length: 8 }, () => 'bne'), -4.2, 4.4, 0.9, () => FC.peach); sm('原本：每個 iteration 都要 check 一次', 4.7, 4.4);
    cap('本來每個 iteration', '都要做一次 check（bne）');
  },
  async (tok, S) => { // 2056.7
    S.s2 = strip(['bne', '', '', '', 'bne', '', '', ''], -4.2, 3.6, 0.9, (t) => (t ? FC.mint : FC.paper)); sm('unroll 4 次：4 次才 check 一次', 4.7, 3.6);
    ok(1000 / UN === 250, 'check 從 1000 次 → ' + 1000 / UN + ' 次 ✓', 0, 2.9);
    cap('四次才 check 一次', '1000 次變 250 次');
  },
  async (tok, S) => { // 2095.7
    pl('register renaming：不同 iteration 用不同 register（$t0～$t3）', 0, 2.2);
    cap('用不同的 register', '其實是 register renaming');
  },
  async (tok, S) => { // 2121.1
    sm('不是真的 dependency：lw 之前，舊的 $t0 已經被 sw 存回去了', 0, 1.6);
    cap('它不是真的 dependency', 'load 之前已經 store 了');
  },
  async (tok, S) => { // 2148.0
    good('值不一樣 → 只是名字相同（name dependency）→ rename 就好', 0, 1.0);
    cap('value 是不同的', '只是名字 dependency，rename 就好');
  },
  async (tok, S) => { // 2160.3
    bad('只 unroll 不 rename：compiler 還是以為有 dependency', 0, 0.4);
    cap('只 unroll 不行', '還是 $t0 的話，就以為有 dependency');
  },
  async (tok, S) => { // 2182.0
    hot('這種 name dependence 叫 anti-dependence', 0, -0.2);
    cap('這種 name dependence', '叫 anti-dependency');
  },
  async (tok, S) => { // 2193.0
    sm('同學問：iteration 不是 4 的倍數怎麼辦？', 0, -0.8);
    cap('不是 4 的倍數怎麼辦？', '');
  },
  async (tok, S) => { // 2202.0
    const q = Math.floor(ITER / UN) * UN, r = ITER - q;
    ok(q + r === ITER && q % UN === 0, ITER + ' 次 = ' + q + ' 次 unroll（' + q / UN + ' 圈）+ 剩 ' + r + ' 次單獨跑 ✓', 0, -1.4);
    cap('例如 1003 次', '1000 次 unroll，剩下 3 次自己跑');
  },
  async (tok, S) => { // 2245.0
    note('software approach 最重要的是 scheduling，尤其是 loop', 0, -2.0);
    cap('software 最重要的是 scheduling', 'loop 執行很多次，要特別好好處理');
  },
]);

// the superscalar example: lw $t0 / addu uses $t0 / sub is independent / slti uses $s4
const SSI = [['lw', '$t0', ['$s2']], ['addu', '$t1', ['$t0', '$t2']], ['sub', '$s4', ['$s4', '$t3']], ['slti', '$t5', ['$s4']]];
const dep = (i, j) => SSI[j][2].includes(SSI[i][1]);
const SS_OK = dep(0, 1) && !dep(0, 2) && !dep(1, 2) && dep(2, 3);
scene('ppB-21b-dyn', '21B：dynamic multiple issue：superscalar', [
  async (tok, S) => { // 2267.0
    hd('dynamic multiple issue：hardware approach', 0, 6.5);
    cap('另一種：dynamic multiple issue', '主要是 hardware 的 approach');
  },
  async (tok, S) => { // 2272.6
    S.s = card('superscalar（最簡單的版本）', FC.mint, 0, 5.5, 4.6, 0.6);
    cap('最簡單的版本', '叫 superscalar processor');
  },
  async (tok, S) => { // 2282.3
    sm('issue 時檢查 dependency：這個 cycle 發 0、1、2…個，避免 structural / data hazard', 0, 4.8);
    cap('issue 時檢查 dependency', '一次發 0、1、2、3、4 個');
  },
  async (tok, S) => { // 2304.8
    sm('compiler 把沒 dependency 的集中，hardware 比較容易 issue', 0, 4.2);
    cap('compiler 幫忙的話', '把沒 dependency 的集中在一起會更好用');
  },
  async (tok, S) => { // 2320.7
    pl('最後由 hardware 負責決定發幾個', 0, 3.6);
    cap('但最後由 hardware 負責', '');
  },
  async (tok, S) => { // 2341.8
    S.c = code(['lw   $t0, 20($s2)', 'addu $t1, $t0, $t2', 'sub  $s4, $s4, $t3', 'slti $t5, $s4, 20'], -2.6, 2.8, 0.5); shh([1.2, 2.8]); S.c.hl(1);
    cap('例：這兩個指令有 dependency', 'addu 要用 lw 的 $t0');
  },
  async (tok, S) => { // 2352.3
    sm('2-issue 也只能先發 lw，再發 addu', 3.0, 2.3);
    cap('就算是 2-issue', '也只能發 lw，再發 addu');
  },
  async (tok, S) => { // 2355.3
    S.c.hl(2); ok(SS_OK, 'sub 跟 lw、addu 都沒關係 ✓', 3.0, 1.6);
    cap('可是 sub 跟它根本沒關係', 'load 要很久，能不能先執行？');
  },
  async (tok, S) => { // 2367.6
    hot('先執行 sub：out-of-order execution', 3.0, 0.9);
    cap('load 還沒做完就先執行', '這就是 out of order 執行');
  },
  async (tok, S) => { // 2382.0
    good('中間能做就先做，寫回時按照次序（commit）', 0, 0.0);
    cap('最後 commit 的時候注意就好', '寫回去時按照次序');
  },
]);

scene('ppB-21b-ss', '21B：superscalar 的結構：reservation station 與 commit unit', [
  async (tok, S) => { // 2399.5
    hd('dynamic superscalar 長這樣', 0, 6.6);
    cap('dynamic superscalar', '基本上長這個樣子');
  },
  async (tok, S) => { // 2405.7
    S.i = card('① instruction fetch & decode（in-order issue）', FC.sky, 0, 5.6, 6.6, 0.6);
    cap('分三段：第一段', 'in-order issue');
  },
  async (tok, S) => { // 2414.1
    S.rs = [0, 1, 2, 3].map((i) => card('reservation station', FC.paper, -4.5 + i * 3.0, 4.1, 2.6, 0.5, 0.6, 9));
    S.fu = ['integer', 'integer', 'FP', 'load/store'].map((t, i) => card(t, FC.peach, -4.5 + i * 3.0, 3.3, 2.6, 0.5, 0.6, 9));
    sm('② out-of-order execution', 5.4, 2.7);
    S.cm = card('③ commit unit（in-order commit）', FC.mint, 0, 1.6, 6.6, 0.6);
    cap('out of order execution', 'in order commit');
  },
  async (tok, S) => { // 2422.2
    glow(S.i, HL); sm('讀進來要 in order，才能找出 dependency', 0, 6.1);
    cap('instruction 讀進來時', '還是要 in order，才找得出 dependency');
  },
  async (tok, S) => { // 2428.8
    glow(S.i, null); S.fu.forEach((m) => glow(m, HL));
    cap('中間的 function unit', 'out of order：誰的 operand 來了就做');
  },
  async (tok, S) => { // 2441.0
    S.fu.forEach((m) => glow(m, null)); S.rs.forEach((m) => glow(m, HL));
    cap('前面有 reservation station', '放 operand 的地方');
  },
  async (tok, S) => { // 2448.2
    S.rs.forEach((m) => glow(m, null));
    arrow(V3(5.4, 3.1, 0.4), V3(5.4, 3.9, 0.4), 0xc08a1f); arrow(V3(-3.4, 1.9, 0.4), V3(-4.5, 3.9, 0.4), 0xc08a1f);
    sm('operand 從 register file、剛算完的 unit 或 commit buffer 來（很像 forwarding）', 0, 0.8);
    cap('operand 可以從 register file', '也可以從剛做完的 unit（像 forwarding）');
  },
  async (tok, S) => { // 2455.6
    glow(S.cm, HL);
    cap('另外一個叫 commit unit', '它也是一個 buffer，不馬上寫回');
  },
  async (tok, S) => { // 2467.7
    sm('in-order commit：跟 program 的次序一樣', 0, 1.0);
    cap('要 in order commit', '跟 program 的次序一樣');
  },
  async (tok, S) => { // 2507.4
    glow(S.cm, null); S.fu.forEach((m) => glow(m, OKG));
    cap('data ready 就做 computation', '結果放在 commit unit');
  },
  async (tok, S) => { // 2520.0
    good('中間 out-of-order：ready 了就算 → 加快速度', 0, 0.2);
    cap('這邊 out of order 執行', '只要 ready 就算，可以加快速度');
  },
  async (tok, S) => { // 2533.5
    pl('in-order issue 記 dependency → reservation station hold operand → 兩個 operand 都到就算', 0, -0.4);
    cap('superscalar 簡單的概念', 'reservation station 等 operand 到齊');
  },
  async (tok, S) => { // 2577.5
    pl('算完先放 commit unit（buffer）→ 改變 state 一定 in order commit', 0, -1.0);
    cap('算完先放 commit unit', '會改變 state，一定 in order commit');
  },
]);

scene('ppB-21b-hwspec', '21B：hardware 也在做 renaming 和 speculation', [
  async (tok, S) => { // 2599.4
    hd('為什麼也能加速？它其實也在做 renaming', 0, 6.5);
    cap('為什麼它也能加速？', '其實也在做 renaming');
  },
  async (tok, S) => { // 2612.7
    sm('只要知道 data dependency、data ready 就開始做；register 叫什麼名字不重要', 0, 5.6);
    cap('知道 data dependency', 'ready 就做，名字根本不重要');
  },
  async (tok, S) => { // 2632.2
    good('相當於前面 unrolling 時做的 renaming（由 hardware 做）', 0, 4.9);
    cap('相當於前面的 unrolling、renaming', '');
  },
  async (tok, S) => { // 2652.8
    S.a = card('branch speculation', FC.sky, -3.0, 3.8, 3.6, 0.6); S.b = card('load speculation', FC.mint, 3.0, 3.8, 3.6, 0.6);
    cap('hardware 常用兩種 speculation', 'branch prediction、load speculation');
  },
  async (tok, S) => { // 2678.4
    glow(S.b, HL); sm('早點把 value load 進來；錯了就不要 commit', 3.0, 3.1);
    cap('load 馬上要用', '早點猜、早點 load，錯了不 commit 就好');
  },
  async (tok, S) => { // 2696.4
    sm('predict effective address；store 還沒做完（outstanding）就先 load；store 的值可以 bypass 給 load', 0, 2.2);
    cap('store 還沒做完之前先 load', 'store 的值也可以 bypass 到 load unit');
  },
  async (tok, S) => { // 2719.9
    S.cm = card('commit buffer：load 不確定 → 先不 commit；錯了 redo', FC.paper, 0, 1.2, 6.0, 0.6);
    cap('load 不確定就先不要 commit', '最後一個 stage 有 buffer，錯了 redo');
  },
]);

scene('ppB-21b-whyss', '21B：為什麼不只靠 compiler（VLIW）？', [
  async (tok, S) => { // 2740.4
    hd('compiler 很簡單，為什麼還要 superscalar？', 0, 6.5);
    S.v = card('VLIW：compiler offline 做，hardware 不太用改', FC.sky, -3.0, 5.5, 5.2, 0.6); S.s = card('superscalar：要很多 hardware 檢查', FC.mint, 3.2, 5.5, 4.6, 0.6);
    cap('software compile 很簡單', 'offline 做，hardware 不太用改');
  },
  async (tok, S) => { // 2794.4
    hot('三個原因', 0, 4.7);
    cap('為什麼還需要 superscalar？', '有三個原因');
  },
  async (tok, S) => { // 2797.1
    pl('① 不是所有 stall 都能 predict', -3.0, 4.0);
    cap('第一：不是全部都可以 predict', '');
  },
  async (tok, S) => { // 2808.3
    S.cpu = prop('cpu', -5.2, 2.4, 0, 0.8, 'CPU'); S.ca = card('cache（小）', FC.mint, -3.0, 2.8, 1.8, 0.5); S.mm = prop('disk', -0.8, 2.3, 0, 0.7, 'memory');
    sm('hit：1 cycle　miss：要很多 cycle', -3.0, 2.1);
    cap('cache 很小', 'hit 一個 cycle；miss 要去 memory 很多 cycle');
  },
  async (tok, S) => { // 2849.4
    bad('誰會在 cache 裡？compile 時不知道', -3.0, 1.4);
    cap('誰在 cache 裡', 'compile 的時候絕對不知道');
  },
  async (tok, S) => { // 2861.8
    pl('② delayed branch：不見得找得到夠多指令填 slot', 3.0, 4.0);
    cap('第二：delay slot', '不見得找得到那麼多指令');
  },
  async (tok, S) => { // 2883.6
    pl('③ 同一個 ISA，不同 implementation', 3.0, 3.0); sm('4 stage、5 stage、2-issue… latency 都不同', 3.0, 2.4);
    cap('第三：同一個 instruction set', '可以有很多不同的 implementation');
  },
  async (tok, S) => { // 2913.3
    bad('換機器 → compiler 的 optimization 要重來', 3.0, 1.7);
    cap('換一台機器', 'compiler 可能就不 work，要重來');
  },
  async (tok, S) => { // 2934.5
    good('所以 VLIW 不夠，還是要 superscalar', 0, 0.6);
    cap('所以 VLIW 不夠', '還是要 superscalar');
  },
]);

scene('ppB-21b-fallacy', '21B：multiple issue 沒有想像中那麼好', [
  async (tok, S) => { // 2945.1
    hd('multiple issue 大部分會 work，但…', 0, 6.5);
    cap('multiple issue', '大部分會 work');
  },
  async (tok, S) => { // 2959.3
    pl('① dependency：尤其 pointer（兩個 pointer 指同一個地方）很難消除', 0, 5.4);
    cap('但因為 dependency', '尤其 pointer，很難 eliminate');
  },
  async (tok, S) => { // 2972.2
    pl('② window 太小：看到的指令太少，找不到足夠沒 dependency 的', 0, 4.6);
    cap('window size 太小', '找不到足夠沒 dependency 的指令');
  },
  async (tok, S) => { // 2989.2
    pl('③ memory 的 delay 和 bandwidth 有限', 0, 3.8);
    cap('memory 有 delay', 'bandwidth 也有限，pipeline 很難滿');
  },
  async (tok, S) => { // 3004.4
    pl('④ speculation 有幫助，但猜錯要 flush、付代價', 0, 3.0);
    cap('speculation 會 help', '但要猜得對，猜錯要付代價');
  },
  async (tok, S) => { // 3013.8
    hot('另一個 issue：power', 0, 2.0);
    cap('另一個 issue', 'power');
  },
]);

// P&H Fig. 4.73 (老師的投影片)：Pentium 4 31 stages 103 W；Intel Core 14 stages 2 cores 75 W；UltraSPARC III 14 stages 90 W；T1 6 stages 8 cores 70 W
const CHIPS = [['Pentium 4', 31, 1, 103], ['Intel Core', 14, 2, 75], ['UltraSPARC III', 14, 1, 90], ['UltraSPARC T1', 6, 8, 70]];
scene('ppB-21b-power', '21B：power wall → multi-core', [
  async (tok, S) => { // 3020.4
    hd('電晶體便宜 → 放很多機制', 0, 6.5);
    sm('branch prediction、branch history、superscalar、很深的 pipeline…', 0, 5.8);
    cap('transistor 越來越便宜', '就放很多 branch prediction、superscalar…');
  },
  async (tok, S) => { // 3050.9
    bad('hardware 越多越耗 power → power 變成 limiting factor', 0, 5.1);
    cap('hardware 要消耗 power', 'power 變成 limiting factor');
  },
  async (tok, S) => { // 3076.4
    hot('所以現在有 multi-core', 0, 4.4);
    cap('所以現在有 multi-core', '');
  },
  async (tok, S) => { // 3082.4
    S.t = table(-5.2, 3.4, ['processor', 'pipeline stage', 'core', 'power'], CHIPS.slice(0, 2).map(([n, st, c, w]) => [n, String(st), String(c), w + ' W']), { ws: [2.6, 2.2, 1.2, 1.4] });
    cap('31 個 stage、103 W', '14 個 stage、兩個 core 只要 75 W');
  },
  async (tok, S) => { // 3092.9
    CHIPS.slice(2).forEach(([n, st, c, w]) => S.t.add([n, String(st), String(c), w + ' W']));
    cap('SPARC 也一樣', '14 stage 單 core 90 W；6 stage、8 core 只要 70 W');
  },
  async (tok, S) => { // 3107.5
    glow(S.t.cells[1][2], OKG); glow(S.t.cells[3][2], OKG);
    good('pipeline 簡單一點、多放幾個 core，也能達到效果', 0, 0.6);
    cap('不需要那麼複雜', '增加很多 core 也可以達到效果');
  },
]);

scene('ppB-21b-concl', '21B：本章總結', [
  async (tok, S) => { // 3126.5
    hd('Concluding remarks', 0, 6.5);
    pl('pipeline 簡單；麻煩在 dependency：data hazard、control hazard', 0, 5.6);
    cap('pipeline 很簡單', '麻煩在 dependency');
  },
  async (tok, S) => { // 3137.4
    pl('跟 technology 有關：電晶體越來越多 → 越來越複雜、越深', 0, 4.9);
    cap('跟 technology 有關', 'transistor 太多，才越來越複雜');
  },
  async (tok, S) => { // 3150.6
    pl('跟 ISA 有關：簡單的 instruction set 比較好做 pipeline', 0, 4.2);
    cap('跟 instruction set 也有關', '簡單的 ISA 比較好做 pipeline');
  },
  async (tok, S) => { // 3171.7
    pl('ISA 影響 datapath 和 control 的設計', 0, 3.5);
    cap('instruction set', '會影響 datapath 和 control 的設計');
  },
  async (tok, S) => { // 3183.9
    good('pipeline 增加 throughput，不會減少 latency', 0, 2.8);
    cap('pipeline 增加 throughput', '但不會減少 latency');
  },
  async (tok, S) => { // 3191.1
    pl('三種 hazard：structural、data、control → 要知道怎麼解決', 0, 2.1);
    cap('三種 hazard', 'structural、data、control');
  },
  async (tok, S) => { // 3196.0
    pl('加速：instruction-level parallelism（static、dynamic）；dependency 讓它沒那麼容易', 0, 1.4);
    cap('用 ILP 加速', 'static、dynamic；dependency 讓它不容易');
  },
]);

// ════════ t27kbXWP5GY（Pipeline Hazards：structural、data（RAW / WAR / WAW）、control） ════════
// 4-phase pipeline of the video: FI（fetch，讀 memory）、DI（decode）、EI（execute）、WR（result writing，寫 memory）
const PH4 = ['FI', 'DI', 'EI', 'WR'];
function sh4(n, avoid) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    let f = i === 0 ? 1 : rows[i - 1].FI + 1;
    if (avoid) while (rows.some((r) => r.FI + 3 === f)) f++;     // memory busy: an earlier instruction writes its result in this cycle
    rows.push({ FI: f });
  }
  const clash = []; rows.forEach((a, i) => rows.forEach((b, j) => { if (i < j && a.FI + 3 === b.FI) clash.push([i, j, b.FI]); }));
  return { rows, total: rows[n - 1].FI + 3, clash };
}
const H0 = sh4(4, false), H1 = sh4(4, true);
const HZ_OK = H0.total === 7 && H0.clash.length === 1 && H0.clash[0].join() === '0,3,4' && H1.total === 10 && H1.clash.length === 0 && H1.rows[3].FI === 7;
// RAW / WAR / WAW by comparing the registers two instructions read and write
const rI = (t) => { const m = t.match(/^(\w+)\s+(R\d+),\s*(R\d+),\s*(R\d+)$/); return { dst: m[2], src: [m[3], m[4]] }; };
const kind = (a, b) => { const A = rI(a), B = rI(b); return [B.src.includes(A.dst) ? 'RAW' : null, A.src.includes(B.dst) ? 'WAR' : null, A.dst === B.dst ? 'WAW' : null].filter(Boolean); };
const DH = { RAW: ['ADD R0, R1, R2', 'SUB R4, R0, R3'], WAR: ['ADD R4, R0, R1', 'SUB R0, R2, R3'], WAW: ['ADD R0, R1, R2', 'SUB R0, R3, R4'] };
const DH_OK = Object.keys(DH).every((k) => kind(...DH[k]).join() === k);

scene('ppB-hz-intro', 'Hazards：pipelining 回顧與三種 hazard', [
  async (tok, S) => { // 7.5
    hd('Pipeline hazards', 0, 6.5);
    cap('今天的主題：pipeline hazards', '');
  },
  async (tok, S) => { // 14.6
    sm('什麼是 hazard？有幾種？', 0, 5.8);
    cap('hazard 是什麼', '總共有幾種');
  },
  async (tok, S) => { // 30.2
    S.w = [['洗', FC.sky], ['烘', FC.peach], ['摺', FC.mint]].map(([t, c], i) => card(t, c, -4.6 + i * 1.3, 4.6, 1.2, 0.6));
    sm('先懂 pipelining：之前用洗衣服的例子', -3.3, 3.9);
    cap('先要懂 pipelining', '前一支影片用洗衣服當例子');
  },
  async (tok, S) => { // 51.1
    S.G = grid(['I1', 'I2', 'I3'], 6, { y: 5.0, x0: 1.4, hp: 'T' }); for (let k = 0; k < 3; k++) S.G.row(k, k + 1, PH4);
    cap('pipelining', '多個指令在執行時 overlap');
  },
  async (tok, S) => { // 63.0
    hot('pipeline 裡發生的問題 = hazard', 0, 2.6);
    cap('會有一些問題', 'pipeline 裡的問題叫 hazard');
  },
  async (tok, S) => { // 82.7
    sm('下一個要執行的指令遇到困難', 0, 2.0);
    cap('會造成下一個指令', '執行上的困難');
  },
  async (tok, S) => { // 96.9
    S.c = [['structural hazard', FC.sky], ['data hazard', FC.mint], ['control hazard', FC.peach]].map(([t, c], i) => card(t, c, -4.4 + i * 4.4, 1.0, 3.8, 0.6));
    S.c.forEach((m, i) => fade(m, i ? 0.35 : 1));
    sm('兩個指令要同一種 resource', -4.4, 0.3);
    cap('三種：第一是 structural', '兩個指令需要同一個 resource');
  },
  async (tok, S) => { // 115.1
    fade(S.c[1], 1); sm('要用前一個指令的資料，前一個還沒做完', 0, 0.3);
    cap('data hazard', '資料依賴前一個還沒做完的指令');
  },
  async (tok, S) => { // 143.9
    fade(S.c[2], 1); sm('branch、jump：fetch 之間的延遲', 4.4, 0.3);
    cap('control hazard', 'branch、jump 造成 fetch 的延遲');
  },
]);

scene('ppB-hz-struct', 'Structural hazard：I1 寫 memory、I4 讀 memory', [
  async (tok, S) => { // 167.8
    hd('Structural hazard', 0, 6.5);
    cap('一個一個來', '第一個：structural hazard');
  },
  async (tok, S) => { // 173.3
    S.r = [['memory', 'disk'], ['registers', 'cpu']].map(([t, k], i) => prop(k, -5.2 + i * 2.6, 4.6, 0, 0.8, t)); S.alu = card('ALU', FC.peach, 0.2, 5.0, 1.4, 0.6);
    cap('resource 的衝突', 'memory、general purpose registers、ALU');
  },
  async (tok, S) => { // 197.9
    bad('同一個 clock cycle，兩個指令要同一個 resource → conflict', 1.4, 3.8);
    cap('同一個 clock cycle', '兩個以上指令要同一個 resource');
  },
  async (tok, S) => { // 217.6
    gone(S.r, S.alu);
    S.G = grid(['I1', 'I2', 'I3', 'I4'], 7, { y: 4.4, x0: -1.6, hp: 'T' });
    sm('FI 取指令　DI 解碼　EI 執行　WR 寫結果', 1.6, 5.6);
    cap('四個 phase', 'fetch、decode、execute、result writing');
  },
  async (tok, S) => { // 249.2
    S.G.row(0, 1, PH4);
    cap('第一個指令 I1', '四個 phase');
  },
  async (tok, S) => { // 266.0
    S.G.hl(0, 1, '#3a2a6a'); S.G.hl(0, 4, '#3a2a6a');
    sm('FI：從 memory 讀指令　WR：結果存進 memory', 1.6, 1.4);
    cap('指令從 memory fetch', '結果也要存進 memory');
  },
  async (tok, S) => { // 275.1
    S.G.row(1, H0.rows[1].FI, PH4);
    cap('I1 decode 時', 'I2 被 fetch：這就是 pipeline');
  },
  async (tok, S) => { // 289.5
    S.G.row(2, H0.rows[2].FI, PH4); S.G.row(3, H0.rows[3].FI, PH4);
    cap('I2 decode 時 fetch I3', 'I3 decode 時 fetch I4');
  },
  async (tok, S) => { // 307.5
    const [i, j, c] = H0.clash[0]; S.G.col(c, '#7a1010'); S.G.hl(i, c, '#7a1010'); S.G.hl(j, c, '#7a1010');
    ok(HZ_OK, 'T' + c + '：I' + (i + 1) + ' 的 WR 和 I' + (j + 1) + ' 的 FI 都要用 memory ✓', 1.6, 0.8);
    cap('看 T4 這個 cycle', 'I1 要寫 memory，I4 要從 memory 讀');
  },
  async (tok, S) => { // 337.0
    hot('同一個 memory → resource clash → structural hazard', 1.6, 0.1);
    cap('同一個 memory', 'resource clash：structural hazard');
  },
]);

scene('ppB-hz-struct2', 'Structural hazard 的解法：I4 晚點 fetch（7 → 10 cycles）', [
  async (tok, S) => { // 351.6
    hd('怎麼避免？', 0, 6.5);
    S.G = grid(['I1', 'I2', 'I3', 'I4'], 10, { y: 4.6, x0: -1.4, hp: 'T' }); for (let k = 0; k < 3; k++) S.G.row(k, H1.rows[k].FI, PH4);
    cap('怎麼避免這個狀況？', '');
  },
  async (tok, S) => { // 375.1
    sm('I1、I2、I3 都沒問題；問題在 I4 的 fetch', 1.6, 1.9);
    cap('I1、I2、I3 都沒問題', '問題在這一點');
  },
  async (tok, S) => { // 384.3
    [0, 1, 2].forEach((k) => S.G.hl(k, H1.rows[k].FI + 3, '#3a2a6a'));
    S.G.put(3, H1.rows[3].FI, 'FI'); S.G.hl(3, H1.rows[3].FI, HL);
    sm('T4、T5、T6 memory 都在寫結果 → I4 到 T' + H1.rows[3].FI + ' 才 fetch', 1.6, 1.3);
    cap('I3 的結果寫完之後', '下一個 cycle 才 fetch I4');
  },
  async (tok, S) => { // 398.4
    S.G.row(3, H1.rows[3].FI + 1, PH4.slice(1));
    cap('再 decode、execute', '寫回結果');
  },
  async (tok, S) => { // 406.8
    good('沒有兩個 phase 同時用 memory → structural hazard 避免了', 1.6, 0.6);
    cap('structural hazard', '就這樣避免了');
  },
  async (tok, S) => { // 418.1
    ok(HZ_OK, '不管衝突：' + H0.total + ' 個 cycle；避開衝突：' + H1.total + ' 個 cycle ✓', 1.6, -0.1);
    cap('原本 7 個 clock cycle', '避開後要 10 個 cycle');
  },
]);

scene('ppB-hz-data', 'Data hazard：依 read / write 順序分三種', [
  async (tok, S) => { // 446.7
    hd('Data hazard', 0, 6.5);
    cap('下一個：data hazard', '');
  },
  async (tok, S) => { // 451.5
    S.c = code(['I1：ADD R0, R1, R2', 'I2：SUB R4, R0, R3'], -2.6, 5.4, 0.6); shh([1.0, 5.4]);
    cap('一個指令在執行', '卻依賴另一個還在處理中的指令');
  },
  async (tok, S) => { // 472.0
    sm('依照暫存器 read / write 的順序分類', 0, 3.9);
    cap('register 的 read、write 順序', '用來分類 data hazard');
  },
  async (tok, S) => { // 487.5
    S.k = [card('RAW：read after write（flow / true dependency）', FC.mint, 0, 3.0, 6.6, 0.6)];
    cap('三種：read after write', '也叫 flow（true）dependency');
  },
  async (tok, S) => { // 497.7
    S.k.push(card('WAR：write after read（anti dependency）', FC.peach, 0, 2.2, 6.6, 0.6), card('WAW：write after write（output dependency）', FC.sky, 0, 1.4, 6.6, 0.6));
    cap('write after read：anti', 'write after write：output dependency');
  },
]);

scene('ppB-hz-raw', 'RAW、WAR、WAW 的例子', [
  async (tok, S) => { // 509.0
    hd('① RAW：read after write', 0, 6.5);
    cap('第一種：read after write', '');
  },
  async (tok, S) => { // 521.3
    S.c = code(DH.RAW.map((t, i) => 'I' + (i + 1) + '：' + t), -3.2, 5.6, 0.6); shh([0.6, 5.6]);
    S.a = arrow(V3(-3.6, 5.45, 0.3), V3(-2.6, 5.1, 0.3), 0x2fc092);
    ok(DH_OK, 'I2 讀 R0，R0 是 I1 寫的 → ' + kind(...DH.RAW).join() + ' ✓', 3.2, 5.0);
    cap('I2 要用 R0 的資料', 'R0 是 I1 產生的');
  },
  async (tok, S) => { // 543.1
    sm('I1 還沒做完、結果還沒出來 → I2 不能用', 3.2, 4.4);
    cap('I1 還沒完全執行完', 'I2 就不能用它的結果');
  },
  async (tok, S) => { // 560.9
    hd('② WAR：write after read（比較少見）', 0, 3.6);
    cap('第二種：write after read', '比較少見');
  },
  async (tok, S) => { // 578.7
    S.d = code(DH.WAR.map((t, i) => 'I' + (i + 1) + '：' + t), -3.2, 2.8, 0.6);
    cap('I2 寫一個暫存器', '在 I1 讀它之前就寫了');
  },
  async (tok, S) => { // 587.3
    ok(DH_OK, 'I1 要讀 R0、I2 要寫 R0 → ' + kind(...DH.WAR).join() + ' ✓', 3.2, 2.5);
    cap('I2 的 SUB 結果寫進 R0', 'I1 要讀 R0 做加法');
  },
  async (tok, S) => { // 615.6
    bad('如果 I2 先寫，I1 就讀到被改過的 R0 → 錯；必須 I1 先讀、I2 再寫', 0, 1.6);
    cap('順序錯了', '會影響程式的執行');
  },
  async (tok, S) => { // 639.6
    S.c.kill(); S.d.kill(); gone(S.a); hd('③ WAW：write after write', 0, 0.9);
    cap('第三種：write after write', '');
  },
  async (tok, S) => { // 650.4
    sm('兩個指令寫同一個暫存器 → 要照 issue 的順序寫', 0, 0.3);
    cap('平行的兩個指令寫同一個暫存器', '要照 issue 的順序寫');
  },
  async (tok, S) => { // 672.7
    S.e = code(DH.WAW.map((t, i) => 'I' + (i + 1) + '：' + t), -3.2, -0.4, 0.55);
    ok(DH_OK, '結果都寫 R0 → ' + kind(...DH.WAW).join() + ' ✓（最後 R0 要是 I2 的）', 3.2, -0.6);
    cap('add、sub 的結果', '都存在 R0');
  },
  async (tok, S) => { // 697.3
    gone(S.e); note('三種：RAW、WAR、WAW', -2.6, -0.5);
    cap('這三種情況', '都會出現 data hazard');
  },
  async (tok, S) => { // 706.5
    hot('WAR、WAW：只在平行執行或 out-of-order 時出現', 0, -1.1);
    cap('WAR 和 WAW', '平行或 out of order 執行時才會出現');
  },
  async (tok, S) => { // 733.7
    good('原因：compiler 配了同一個暫存器 → 換暫存器（renaming）就能避免', 0, -1.7);
    cap('原因是用了同一個暫存器', '換別的暫存器就能避免');
  },
]);

scene('ppB-hz-ctrl', 'Control hazard：branch 改變 PC', [
  async (tok, S) => { // 757.4
    hd('Control hazard（最複雜）', 0, 6.5);
    cap('第三種：control hazard', '最複雜的一種');
  },
  async (tok, S) => { // 770.8
    S.pc = card('PC', FC.gold, -5.0, 5.4, 1.2, 0.6); sm('branch、conditional：會改變 PC 的值', -1.2, 5.4);
    cap('branch、條件判斷', '會改變 program counter 的值');
  },
  async (tok, S) => { // 802.4
    sm('程式的流程由 branch 決定', -1.2, 4.8);
    cap('程式執行的流程', '由 branch 指令控制');
  },
  async (tok, S) => { // 812.4
    S.G = grid(['branch', '下一個？'], 6, { y: 3.6, x0: -0.4, hp: 'T' }); S.G.row(0, 1, PH4); shh([5.6, 4.2]);
    cap('例：branch 在 pipeline 的開頭', '');
  },
  async (tok, S) => { // 838.6
    S.G.hl(0, 2, '#3a2a6a'); S.G.put(1, 2, 'FI', FC.rose);
    sm('branch 在 decode 時，下一個已經被 fetch：還不知道該執行哪個', 0, 1.9);
    cap('第一個在 decode 時', '第二個已經在 fetch，不知道該執行哪個');
  },
  async (tok, S) => { // 857.9
    bad('pipeline 先隨便拿一個；拿錯 → branch misprediction', 0, 1.2);
    cap('pipeline 隨便拿一個', '拿錯了就是 branch misprediction');
  },
  async (tok, S) => { // 892.0
    sm('if-else 這種條件敘述也一樣', 0, 0.5);
    cap('if-else 也一樣', '要看第一個的結果才知道下一個');
  },
  async (tok, S) => { // 922.5
    S.c = [['structural', FC.sky], ['data', FC.mint], ['control', FC.peach]].map(([t, c], i) => card(t + ' hazard', c, -4.4 + i * 4.4, -0.4, 3.6, 0.6));
    cap('總結', '三種 hazard：structural、data、control');
  },
]);
// ════════ WpJZIFEtgg4 §12（第 21A 講：問同學——兩條 pipeline 每個 cycle 要 fetch 幾個指令） ════════
// issue width w: instruction k is fetched in cycle floor(k / w) + 1 → finishes (WB) 4 cycles later
const issueSim = (n, w) => { const IF = []; for (let k = 0; k < n; k++) IF.push(Math.floor(k / w) + 1); const done = {}; IF.forEach((c) => { done[c + 4] = (done[c + 4] || 0) + 1; }); return { IF, done }; };
const IS1 = issueSim(3, 1), IS2 = issueSim(6, 2);
const IS_OK = IS1.IF.join() === '1,2,3' && IS2.IF.join() === '1,1,2,2,3,3' && IS2.done[5] === 2 && IS2.done[6] === 2;
scene('ppB-21a-fetch2', '21A：兩條 pipeline → 每個 cycle fetch 2 個指令', [
  async (tok, S) => { // 1785
    hd('兩條 pipeline：每個 cycle 要 fetch 幾個指令？', 0, 6.6);
    cap('如果有兩條 pipeline', '每個 clock 要發出幾個 instruction？');
  },
  async (tok, S) => { // 1803
    S.A = grid(['i1', 'i2', 'i3'], 7, { y: 5.4, x0: -4.4, w: 0.78, dy: 0.62 }); IS1.IF.forEach((c, k) => S.A.row(k, c, FIVE));
    sm('一條 pipeline：每個 cycle 丟 1 個進去', -2.2, 3.4);
    cap('一條 pipeline', '每個 cycle 丟一個、丟一個');
  },
  async (tok, S) => { // 1812
    S.r = [['IF ×2：一次抓兩個指令', FC.sky], ['register file：一次讀更多 operand', FC.lilac], ['ALU ×2', FC.peach]].map(([t, c], i) => card(t, c, 4.2, 5.4 - i * 0.75, 4.6, 0.55, 0.6, 10));
    sm('兩條 pipeline = resource 加倍', 4.2, 3.0);
    cap('兩條 pipeline 就是把 resource double', '兩個 fetch、register file 讀更多、兩個 ALU');
  },
  async (tok, S) => { // 1836
    S.B = grid(['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], 7, { y: 2.3, x0: -4.4, w: 0.78, dy: 0.5, head: false }); IS2.IF.forEach((c, k) => S.B.row(k, c, FIVE));
    ok(IS_OK, '每個 cycle fetch 2 個 ✓', 3.6, 1.6);
    sm('cycle 5 起每 cycle 完成 ' + IS2.done[5] + ' 個', 3.6, 0.9);
    sm('理想 IPC = 2（CPI = 0.5）', 3.6, 0.2);
    cap('兩條 pipeline：同一個時間各跑一個', '每個 cycle 要 fetch 2 個指令');
  },
]);

// ════════ GAUppsLpjvg（Udacity：pipeline 的 CPI——初始填充、stall 讓 CPI > 1） ════════
// 5-stage pipeline, no stalls: N instructions take N + 4 cycles → CPI = (N + 4) / N → 1 as N grows
const cpiFill = (N) => (N + 4) / N;
const CF_OK = cpiFill(6) === 10 / 6 && cpiFill(100) === 1.04 && cpiFill(1e9) - 1 < 1e-8;
// car line: one stall every k cars → k cars take k + 1 cycles (steady state)
const stallCPI = (k) => (k + 1) / k;
const SC_OK = Math.abs(stallCPI(5) - 1.2) < 1e-12 && Math.abs(stallCPI(5) - (1 + 1 / 5)) < 1e-12;
scene('ppB-cpi-fill', 'Pipeline 的 CPI：填滿之後每個 cycle 完成一道', [
  async (tok, S) => { // 0.0
    S.G = grid(['I1', 'I2', 'I3', 'I4', 'I5', 'I6'], 10, { y: 5.6, x0: -1.6 }); for (let k = 0; k < 6; k++) S.G.row(k, k + 1, FIVE);
    for (let k = 0; k < 6; k++) S.G.hl(k, k + 5, OKG);
    hd('CPI', -4.6, 6.3); sm('cycle 5 起，每個 cycle 都有一道 WB', 2.6, 1.7);
    cap('pipeline 填滿之後', '每個 cycle 完成一道指令：CPI = 1');
  },
  async (tok, S) => { // 7.4
    for (let k = 0; k < 4; k++) for (let c = 1; c <= 4; c++) if (S.G.cells[k][c]) fade(S.G.cells[k][c], 0.45);
    sm('前 4 個 cycle 在填 pipeline，還沒有指令完成', 2.6, 1.0);
    bub('一個程式：數十億道指令', -4.6, 1.0);
    cap('一個程式通常有數十億道指令', '一開始填 pipeline 的幾個 cycle 可以忽略');
  },
  async (tok, S) => { // 21.0
    hot('N 道指令要 N + 4 個 cycle → CPI = (N + 4) / N', 0.6, 0.2);
    cap('CPI 不一定是 1 的原因之一', '一開始要先把 pipeline 填滿');
  },
  async (tok, S) => { // 29.6
    S.t = [[6, cpiFill(6).toFixed(2)], [100, cpiFill(100).toFixed(2)], ['10⁹', '1.000000004']].map(([n, v], i) => card('N = ' + n + '：CPI ' + v, FC.paper, -4.0 + i * 4.2, -0.6, 3.8, 0.55, 0.6, 10));
    ok(CF_OK, 'N 越大，CPI 越接近 1 ✓', -4.6, 3.6);
    cap('指令數越多', 'CPI 就越來越接近 1');
  },
  async (tok, S) => { // 40.3
    good('填充只是開頭幾個 cycle → 可以說 CPI ≈ 1', 0.6, -1.4);
    cap('指令非常多，填充不是大問題', '還是可以說 CPI 是 1');
  },
]);

const CAR = { black: '#4a4a4a', purple: '#9b7ef4', green: '#2fc092', blue: '#4b9ee2' };
const STX = [-4.5, -1.5, 1.5, 4.5];
const carAt = (t, c, i) => card(t, c, STX[i], 2.6, 1.6, 0.7, 0.8, 11);
scene('ppB-cpi-car', '汽車生產線：一台車 stall，前後的站都閒置', [
  async (tok, S) => { // 46.2
    hd('穩定狀態的 CPI 也不是 1？', 0, 6.4);
    sm('原因：pipeline stall', 0, 5.7);
    cap('穩定狀態的 CPI 不是 1', '還有一個原因：pipeline stall');
  },
  async (tok, S) => { // 53.7
    S.st = ['裝車門', '裝前輪', '裝後輪', '下一站…'].map((t, i) => card(t, FC.sand, STX[i], 1.6, 2.4, 0.5, 0.8, 11));
    S.ar = arrow(V3(-5.8, 4.2, 0), V3(5.8, 4.2, 0), 0x6e5f49); sm('每個 cycle，每台車往前一站', 0, 4.7);
    S.m = sm('', 0, 0.5);
    cap('一條汽車生產線', '裝車門 → 裝前輪 → 裝後輪 → …');
  },
  async (tok, S) => { // 66.1
    S.g = carAt('綠車', CAR.green, 0); S.p = carAt('紫車', CAR.purple, 1); S.b = carAt('黑車', CAR.black, 2);
    txt(S.m, '黑車已有前輪；紫車在等裝前輪；綠車正在裝車門');
    cap('某個時刻：黑車、紫車、綠車', '各在一站');
  },
  async (tok, S) => { // 79.1
    glow(S.p, '#7a1010'); S.x = bad('✘ 輪子壞了', STX[1], 3.5);
    txt(S.m, '裝前輪時，機器把紫車的輪子弄壞了');
    cap('裝前輪的時候', '機器把輪子弄壞了');
  },
  async (tok, S) => { // 87.3
    await slide(tok, S.b, STX[3], 2.6, 0, 700);
    txt(S.m, '黑車往前；紫車沒有前輪，不能走 → 多待一個 cycle 重裝');
    cap('生產線往前：黑車移到下一站', '紫車留在原地重裝輪子');
  },
  async (tok, S) => { // 115.5
    fade(S.st[2], 0.4); S.i2 = sm('閒置', STX[2], 2.6);
    txt(S.m, '紫車沒過來 → 裝後輪的工人這個 cycle 沒車可做');
    cap('紫車沒有往前', '裝後輪這一站就閒著');
  },
  async (tok, S) => { // 123.0
    S.w = hot('等', STX[0], 3.5);
    txt(S.m, '綠車車門裝好了，但前面被紫車擋住 → 也不能前進');
    cap('綠車也被擋住', '這裡也出現閒置');
  },
  async (tok, S) => { // 131.7
    gone(S.x, S.w, S.i2); glow(S.p, null); fade(S.st[2], 1);
    await anim(tok, 300, (u) => { S.b.position.x = STX[3] + u * 2.5; }); kill(S.b);
    await Promise.all([slide(tok, S.p, STX[2], 2.6, 0, 700), slide(tok, S.g, STX[1], 2.6, 0, 700)]);
    S.n = carAt('新車', CAR.blue, 0); fade(S.st[3], 0.4); S.i3 = sm('閒置', STX[3], 2.6);
    txt(S.m, '輪子裝好 → 紫車、綠車往前，新車進來；但下一站這次沒車');
    cap('這次輪子裝好了，大家往前', '空檔（bubble）跟著往下一站走');
  },
]);

scene('ppB-cpi-stall', '每 5 台 stall 一次：6 個 cycle 完成 5 台，CPI = 1.2', [
  async (tok, S) => { // 148.4
    hd('生產線出口：每個 cycle 完成幾台？', 0, 6.6);
    S.r1 = [['黑車', CAR.black], ['（沒有）', FC.gray], ['紫車', CAR.purple]].map(([t, c], i) => card(t, c, -3.0 + i * 3.0, 5.4, 2.4, 0.6, 0.7, 11));
    [1, 2, 3].forEach((c, i) => sm('cycle ' + c, -3.0 + i * 3.0, 4.75));
    cap('黑車離開之後', '有一台車的時間沒有完成任何車');
  },
  async (tok, S) => { // 159.3
    glow(S.r1[1], '#7a1010'); bad('stall：本來該完成一台，卻沒有完成', 0, 4.1);
    cap('每一次 stall', '都讓某個 cycle 少完成一台');
  },
  async (tok, S) => { // 176.7
    const k = 5, row = []; for (let c = 0; c < k + 1; c++) row.push(c === k ? null : c + 1);
    S.r2 = row.map((v, i) => card(v ? '車 ' + v : '（stall）', v ? FC.mint : FC.rose, -5.0 + i * 2.0, 2.8, 1.8, 0.6, 0.7, 10));
    sm('例：每 5 台車發生一次 stall → ' + (k + 1) + ' 個 cycle 才完成 ' + k + ' 台', 0, 2.1);
    cap('如果每 5 台車 stall 一次', '要 6 個 cycle 才完成 5 台');
  },
  async (tok, S) => { // 184.5
    ok(SC_OK, 'CPI = 6 / 5 = ' + stallCPI(5).toFixed(1) + ' = 1 + 1/5 ✓', 0, 1.3);
    cap('CPI = 6 個 cycle ÷ 5 台', '= 1.2，不是 1');
  },
  async (tok, S) => { // 192.0
    hot('穩定狀態有 stall → CPI > 1', 0, 0.5);
    note('影片口誤說 lower；其實 CPI 是變大', 0, -0.3);
    cap('即使在穩定狀態', '有 stall 的 pipeline，CPI 還是大於 1');
  },
]);

  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'control-hazard', 'branch-predict', 'delayed-branch', 'cpi-stalls'].concat(FRAG.map((f) => f[0])),
    stop() { run++; },
  };
}
