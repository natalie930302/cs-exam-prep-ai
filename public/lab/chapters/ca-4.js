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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
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
    cap('MIPS 只有兩種 exception', 'undefined opcode 記 0、overflow 記 1');
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
    sm('← 越右邊的 stage 越早進來（最早執行）', 2.2, 5.6);
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
    cap('group 起來成一個 issue slot', '4-way 就 4 個、2-way 就 2 個');
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
    sm('每個指令 32 bit → 一包 64 bit（64-bit aligned），一次 fetch 64 bit', -0.2, 3.8);
    cap('每個 32 bit', '一包 64 bit，一次 fetch 64 bit');
  },
  async (tok, S) => { // 396.6
    sm('實在沒辦法 pack → 放 nop（簡化 hardware）', -0.2, 3.2);
    cap('沒辦法 pack 就 pack 一個 no-op', '這是為了簡化 hardware');
  },
  async (tok, S) => { // 445.2
    gone(S.a, S.b);
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
    cap('sw 寫回，addi 把 $s1 減 4', '例如第 100 個 element 變第 96 個');
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
