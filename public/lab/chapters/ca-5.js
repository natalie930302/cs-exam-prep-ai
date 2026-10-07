// 計算機組織 第5章：記憶體層次與 Cache（locality、direct-mapped / set-associative / fully-associative、
// tag/index/offset、LRU、write-through / write-back、AMAT、multi-level cache、3C）。
// 本章的黃婷婷 22A–24B 講與 AMAT 影片目前都沒有逐字稿，場景全部依 Patterson & Hennessy（MIPS 版）第 5 章的例題重現。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const PAL = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
  const colOf = (v) => PAL[Math.abs(v) % PAL.length];
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
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
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); else { m.userData.lbl = lab.label(String(t), 'val'); m.add(m.userData.lbl); } };
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  function bar(color, w, d, x, z = 0) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms, base = 0) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = base + v / 2; }); }
  function setBar(m, h, base = 0) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = base + v / 2; }
  const bin = (v, n) => (n <= 0 ? '' : v.toString(2).padStart(n, '0'));
  const lg = (n) => Math.round(Math.log2(n));
  const r2 = (x) => Math.round(x * 100) / 100;

  // a row of bits (MSB left) coloured by field: fields = [{ n, b, c }]
  function bitStrip(value, fields, y = 1, z = 0, sp = 0.39) {
    const total = fields.reduce((s, f) => s + f.b, 0);
    const x0 = -(total - 1) / 2 * sp;
    const cubes = [], labels = [];
    let i = 0;
    for (const f of fields) {
      if (f.b <= 0) continue;
      const xs = x0 + i * sp, xe = x0 + (i + f.b - 1) * sp;
      labels.push(tag(f.n + ' ' + f.b + ' bits', 'ptr', (xs + xe) / 2, y + 0.75, z));
      for (let k = 0; k < f.b; k++, i++) {
        const bit = value === null ? '' : Math.floor(value / Math.pow(2, total - 1 - i)) % 2;
        const m = lab.box(f.c, [sp * 0.88, sp * 0.88, sp * 0.88]);
        m.position.set(x0 + i * sp, y, z); lab.world.add(m);
        if (bit !== '') { const l = lab.label(String(bit), 'idx'); m.add(l); }
        cubes.push(m);
      }
    }
    return { cubes, labels, kill() { cubes.forEach(kill); labels.forEach(kill); } };
  }
  const FC = { tag: '#9b7ef4', index: '#4b9ee2', offset: '#dd8238', byte: '#c9b48e' };

  // ───────────────────────── 快取模擬器（模式與場景共用） ─────────────────────────
  // word address；block = bw words；sets = blocks / ways；index = block mod sets；tag = block / sets
  function makeSim(o) {
    const S = { blocks: o.blocks, ways: o.ways, bw: o.bw || 1, repl: o.repl || 'LRU', bits: o.bits || 6, xc: o.xc === undefined ? -0.8 : o.xc, ytop: o.ytop || 6.0,
      t: 0, hits: 0, misses: 0, kinds: { comp: 0, cap: 0, conf: 0 }, seen: new Set(), shadow: [], lines: [] };
    S.sets = S.blocks / S.ways;
    S.offBits = lg(S.bw); S.idxBits = lg(S.sets); S.tagBits = S.bits - S.offBits - S.idxBits;
    S.cols = Math.min(S.ways, 4);
    const rps = Math.ceil(S.ways / 4), rows = S.sets * rps;
    const gap = S.sets > 1 && S.ways > 1 ? 0.25 : 0;
    const lh = Math.min(0.72, (5.4 - gap * (S.sets - 1)) / rows);
    const lw = 2.25;
    for (let s = 0; s < S.sets; s++) {
      const row = [];
      for (let w = 0; w < S.ways; w++) {
        const x = S.xc + ((w % 4) - (S.cols - 1) / 2) * lw;
        const y = S.ytop - (s * rps + Math.floor(w / 4)) * lh - s * gap;
        const mesh = cube('—', GRAY, [2.05, Math.min(0.5, lh * 0.8), 0.8], x, y, 0);
        row.push({ v: false, tag: 0, blk: -1, last: 0, ins: 0, mesh, x, y });
      }
      const ly = S.ytop - s * rps * lh - s * gap - (rps - 1) * lh / 2;
      tag(S.ways === 1 ? 'index ' + bin(s, S.idxBits) : S.sets === 1 ? '唯一的 set' : 'set ' + s, 'idx', S.xc - S.cols * lw / 2 - 0.85, ly);
      S.lines.push(row);
    }
    S.mem = lab.box('#c9b48e', [1.1, 5.2, 1.1]); S.mem.position.set(5.9, 3.3, -0.4); lab.world.add(S.mem);
    tag('Memory', 'ptr', 5.9, 6.4, -0.4);
    S.addrL = tag('', 'ptr alt', S.xc, S.ytop + 0.95);
    S.statL = tag('hit 0 · miss 0', 'ptr', S.xc, 0.05, 1.2);
    S.name = (blk) => (S.bw === 1 ? 'M[' + blk + ']' : 'M[' + blk * S.bw + '–' + (blk * S.bw + S.bw - 1) + ']');
    S.split = (a) => { const blk = Math.floor(a / S.bw); return { blk, off: a % S.bw, set: blk % S.sets, tg: Math.floor(blk / S.sets) }; };
    S.fmt = (a) => { const f = S.split(a); return [bin(f.tg, S.tagBits), bin(f.set, S.idxBits), bin(f.off, S.offBits)].filter((x) => x).join(' | '); };
    S.access = async (a, tok, pace = 1) => {
      const f = S.split(a);
      S.t++;
      txt(S.addrL, a + ' = ' + bin(a, S.bits) + ' → ' + S.fmt(a));
      const set = S.lines[f.set];
      set.forEach((L) => glow(L.mesh, GOLD));
      await wait(tok, 450 * pace);
      const way = set.findIndex((L) => L.v && L.tag === f.tg);
      // 3C 分類：從沒見過 → compulsory；同大小 fully-associative LRU 也會 miss → capacity；否則 conflict
      const inShadow = S.shadow.includes(f.blk);
      S.shadow = S.shadow.filter((b) => b !== f.blk); S.shadow.push(f.blk);
      if (S.shadow.length > S.blocks) S.shadow.shift();
      set.forEach((L) => glow(L.mesh, null));
      let res;
      if (way >= 0) {
        const L = set[way];
        L.last = S.t; S.hits++;
        glow(L.mesh, GREEN);
        res = { hit: true, set: f.set, way, f };
      } else {
        S.misses++;
        const kind = !S.seen.has(f.blk) ? 'comp' : inShadow ? 'conf' : 'cap';
        S.kinds[kind]++;
        let v = set.findIndex((L) => !L.v);
        if (v < 0) { v = 0; for (let k = 1; k < set.length; k++) if ((S.repl === 'LRU' ? set[k].last : set[k].ins) < (S.repl === 'LRU' ? set[v].last : set[v].ins)) v = k; }
        const L = set[v];
        const victim = L.v ? L.blk : null;
        if (victim !== null) { const g = cube(S.name(victim), colOf(victim), [2.05, 0.45, 0.8], L.x, L.y, 0.2); fly(g, V3(-2, 7, 4)); }
        const nb = cube(S.name(f.blk), colOf(f.blk), [2.05, 0.45, 0.8], 5.9, 3.3, 0.6);
        move(nb, L.x, L.y, 0.3);
        await wait(tok, 600 * pace);
        kill(nb);
        Object.assign(L, { v: true, tag: f.tg, blk: f.blk, last: S.t, ins: S.t });
        tint(L.mesh, colOf(f.blk)); relabel(L.mesh, (S.tagBits > 0 ? bin(f.tg, S.tagBits) + ' ' : '') + S.name(f.blk));
        glow(L.mesh, RED);
        res = { hit: false, set: f.set, way: v, victim, kind, f };
      }
      S.seen.add(f.blk);
      txt(S.statL, 'hit ' + S.hits + ' · miss ' + S.misses);
      return res;
    };
    S.unglow = () => S.lines.flat().forEach((L) => glow(L.mesh, null));
    return S;
  }
  const KIND = { comp: 'compulsory（第一次碰到）', cap: 'capacity（容量不夠）', conf: 'conflict（撞同一個 set）' };

  // ───────────────────────── 模式 1：快取模擬器 ─────────────────────────
  const PRESETS = {
    ph59: { name: 'P&H 例：22,26,22,26,16,3,16,18', seq: [22, 26, 22, 26, 16, 3, 16, 18], blocks: 8, ways: 1, bw: 1 },
    ph058: { name: '0,8,0,6,8（4 個 block）', seq: [0, 8, 0, 6, 8], blocks: 4, ways: 1, bw: 1 },
    c3: { name: '3C：0,4,0,4,1,2,3,5,0（4 個 block）', seq: [0, 4, 0, 4, 1, 2, 3, 5, 0], blocks: 4, ways: 1, bw: 1 },
    loop: { name: '迴圈掃陣列 0–15（block 4 words）', seq: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], blocks: 8, ways: 1, bw: 4 },
  };
  const simCfg = { blocks: 8, ways: 1, bw: 1, repl: 'LRU' };
  let sim = null, simBusy = false;
  function enterSim() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4.2, 15], [0, 3.4, 0]);
    sim = makeSim({ ...simCfg, bits: 6 });
    controls(
      '<select id="cBlk"><option value="8">8 個 block</option><option value="4">4 個 block</option></select>'
      + '<select id="cOrg"><option value="1">Direct-mapped</option><option value="2">2-way</option><option value="4">4-way</option><option value="8">Fully associative</option></select>'
      + '<select id="cBw"><option value="1">block = 1 word</option><option value="2">2 words</option><option value="4">4 words</option></select>'
      + '<select id="cRep"><option value="LRU">LRU</option><option value="FIFO">FIFO</option></select>'
      + '<label>word address <input id="cAddr" type="number" min="0" max="63" value="22" style="width:60px"></label>'
      + '<button class="primary" id="cGo">存取</button>'
      + '<select id="cSeq">' + Object.keys(PRESETS).map((k) => '<option value="' + k + '">' + PRESETS[k].name + '</option>').join('') + '</select>'
      + '<button id="cRun">跑整串</button><button id="cReset">清空</button>'
    );
    $('cBlk').value = String(simCfg.blocks);
    $('cOrg').value = simCfg.ways === simCfg.blocks ? '8' : String(simCfg.ways);
    $('cBw').value = String(simCfg.bw); $('cRep').value = simCfg.repl;
    const reconf = () => {
      const blocks = Number($('cBlk').value), org = Number($('cOrg').value);
      simCfg.blocks = blocks; simCfg.ways = org === 8 ? blocks : Math.min(org, blocks); simCfg.bw = Number($('cBw').value); simCfg.repl = $('cRep').value;
      enterSim();
    };
    ['cBlk', 'cOrg', 'cBw', 'cRep'].forEach((id) => { $(id).onchange = reconf; });
    on('cGo', () => simOne(Number($('cAddr').value)));
    on('cReset', () => enterSim());
    on('cRun', async () => {
      if (simBusy) return;
      const P = PRESETS[$('cSeq').value];
      Object.assign(simCfg, { blocks: P.blocks, ways: P.ways, bw: P.bw });
      enterSim();
      $('cSeq').value = Object.keys(PRESETS).find((k) => PRESETS[k] === P);
      for (const a of P.seq) { await simOne(a); await sleep(250); }
    });
    log('一個 cache 有 ' + sim.blocks + ' 個 block，分成 ' + sim.sets + ' 個 set（每 set ' + sim.ways + ' 個 way）。位址是 word address，6 bits。');
    log('位址拆法：tag ' + sim.tagBits + ' bits | ' + (sim.idxBits ? 'index ' + sim.idxBits + ' bits | ' : '') + 'block offset ' + sim.offBits + ' bits');
    simState(null);
  }
  function simState(r, a) {
    const S = sim;
    const rows = [['組織', S.ways === 1 ? 'Direct-mapped' : S.sets === 1 ? 'Fully associative' : S.ways + '-way set associative'], ['tag | index | offset', S.tagBits + ' | ' + S.idxBits + ' | ' + S.offBits + ' bits']];
    if (r) rows.push(['位址 ' + a, bin(a, S.bits) + ' → block ' + r.f.blk + '、set ' + r.f.set + '、tag ' + bin(r.f.tg, S.tagBits)], ['結果', r.hit ? 'hit' : 'miss：' + KIND[r.kind]]);
    rows.push(['hit / miss', S.hits + ' / ' + S.misses], ['3C', 'comp ' + S.kinds.comp + '、cap ' + S.kinds.cap + '、conf ' + S.kinds.conf]);
    const tot = S.hits + S.misses;
    setState('快取模擬器', rows, tot ? 'miss rate = ' + S.misses + ' / ' + tot + ' = <span class="' + (S.misses / tot < 0.5 ? 'ok' : 'no') + '">' + (100 * S.misses / tot).toFixed(1) + '%</span>' : 'block address = ⌊address / block 大小⌋；set = block mod 組數');
  }
  async function simOne(a) {
    if (simBusy) return;
    if (!(a >= 0 && a <= 63) || !Number.isInteger(a)) { log('word address 要是 0–63 的整數（6-bit 位址）。', true); return; }
    simBusy = true;
    try {
      sim.unglow();
      const r = await sim.access(a);
      log(a + '：' + (r.hit ? 'hit（set ' + r.set + '）' : 'miss → 放進 set ' + r.set + ' way ' + r.way + (r.victim !== null ? '，踢掉 ' + sim.name(r.victim) + '（' + sim.repl + '）' : '') + '｜' + KIND[r.kind]));
      simState(r, a);
    } finally { simBusy = false; }
  }

  // ───────────────────────── 模式 2：位址切割 ─────────────────────────
  const sp = { kib: 16, blockB: 16, ways: 1, addr: 1200 };
  let spStrip = null;
  function splitCalc(kib, blockB, ways, abits = 32) {
    const blocks = kib * 1024 / blockB;
    const w = ways === 0 ? blocks : ways;
    const sets = blocks / w;
    const off = lg(blockB), idx = lg(sets), tg = abits - off - idx;
    const perLine = 1 + tg + blockB * 8;
    return { blocks, w, sets, off, idx, tg, perLine, totalBits: perLine * blocks, tagTotal: tg * blocks };
  }
  function enterSplit() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.2, 13], [0, 2.2, 0]);
    controls(
      '<label>資料容量 <select id="sKib"><option>4</option><option>8</option><option selected>16</option><option>32</option><option>64</option></select> KiB</label>'
      + '<label>block <select id="sBlk"><option>4</option><option selected>16</option><option>32</option><option>64</option></select> bytes</label>'
      + '<select id="sWay"><option value="1">Direct-mapped</option><option value="2">2-way</option><option value="4">4-way</option><option value="8">8-way</option><option value="0">Fully associative</option></select>'
      + '<label>byte address <input id="sAddr" type="number" min="0" value="1200" style="width:100px"></label><button class="primary" id="sGo">切割</button>'
    );
    $('sKib').value = String(sp.kib); $('sBlk').value = String(sp.blockB); $('sWay').value = String(sp.ways); $('sAddr').value = String(sp.addr);
    const rd = () => { sp.kib = Number($('sKib').value); sp.blockB = Number($('sBlk').value); sp.ways = Number($('sWay').value); };
    ['sKib', 'sBlk', 'sWay'].forEach((id) => { $(id).onchange = () => { rd(); drawSplit(); }; });
    on('sGo', () => { rd(); const a = Number($('sAddr').value); if (!(a >= 0 && a < 4294967296) || !Number.isInteger(a)) { log('byte address 要是 0 到 2³²−1 的整數。', true); return; } sp.addr = a; drawSplit(); });
    log('32-bit byte address：最右邊 log₂(block bytes) 位是 offset，再來 log₂(set 數) 位是 index，剩下都是 tag。');
    drawSplit();
  }
  function drawSplit() {
    lab.clear();
    const c = splitCalc(sp.kib, sp.blockB, sp.ways);
    spStrip = bitStrip(sp.addr, [{ n: 'tag', b: c.tg, c: FC.tag }, { n: 'index', b: c.idx, c: FC.index }, { n: 'offset', b: c.off, c: FC.offset }], 3.2);
    const blk = Math.floor(sp.addr / sp.blockB), set = blk % c.sets, tg = Math.floor(blk / c.sets);
    tag('byte address ' + sp.addr + ' → block ' + blk + ' → set ' + set + '，tag = ' + tg, 'ptr alt', 0, 1.6);
    // one line of the cache: valid + tag + data
    const tot = c.perLine, k = 12 / tot;
    const segs = [['V', 1, '#2fc092'], ['tag', c.tg, FC.tag], ['data ' + sp.blockB * 8 + ' bits', sp.blockB * 8, '#c9b48e']];
    let x = -6;
    for (const [n, b, col] of segs) { const w = Math.max(0.12, b * k); const m = lab.box(col, [w, 0.5, 0.7]); m.position.set(x + w / 2, 0.3, 0); lab.world.add(m); tag(n, 'idx', x + w / 2, 0.3, 0.7); x += w; }
    tag('每一行（line）= 1 + ' + c.tg + ' + ' + sp.blockB * 8 + ' = ' + tot + ' bits', 'ptr', 0, 0.9, -0.6);
    setState('位址切割（32-bit byte address）', [['block 數', c.blocks + ' = 2^' + lg(c.blocks)], ['set 數', c.sets + '（每 set ' + c.w + ' 個 way）'], ['offset', c.off + ' bits（log₂ ' + sp.blockB + '）'], ['index', c.idx + ' bits（log₂ ' + c.sets + '）'], ['tag', '32 − ' + c.idx + ' − ' + c.off + ' = ' + c.tg + ' bits'], ['tag 總量', c.tagTotal.toLocaleString() + ' bits']],
      '總 bits = ' + c.blocks + ' × (1 + ' + c.tg + ' + ' + sp.blockB * 8 + ') = <span class="ok">' + c.totalBits.toLocaleString() + ' bits = ' + r2(c.totalBits / 1024) + ' Kibit</span>');
  }

  // ───────────────────────── 模式 3：寫入策略 ─────────────────────────
  const W = { pol: 'wt', alloc: 'alloc' };
  function enterWrite() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 14.5], [0, 3, 0]);
    Object.assign(W, { lines: [], mem: [], memM: [], buf: [], bufM: [], memW: 0, memR: 0, stalls: 0, ver: 0, ops: 0, busy: false });
    const cpu = cube('CPU', '#31aab0', [1.3, 1.3, 1.3], -5.8, 5.6, 0);
    W.cpu = cpu;
    tag('cache（direct-mapped，4 個 1-word block）', 'idx', -2.4, 6.6);
    for (let i = 0; i < 4; i++) {
      const y = 5.3 - i * 1.05;
      W.lines.push({ v: false, tag: 0, val: '', dirty: false, mesh: cube('—', GRAY, [2.3, 0.6, 0.8], -2.4, y, 0), y });
      tag('index ' + bin(i, 2), 'idx', -4.2, y);
    }
    tag('write buffer', 'idx', 1.75, 2.1);
    for (let k = 0; k < 4; k++) W.bufM.push(cube('', '#efe6d6', [0.85, 0.5, 0.8], 0.4 + k * 0.9, 1.4, 0));
    tag('Memory', 'ptr', 5.2, 6.6);
    for (let a = 0; a < 8; a++) { W.mem.push('0'); W.memM.push(cube('M[' + a + ']=0', '#c9b48e', [2.0, 0.45, 0.7], 5.2, 5.9 - a * 0.62, 0)); }
    W.cnt = tag('', 'ptr alt', 0, 0.15, 1.6);
    controls(
      '<select id="wPol"><option value="wt">Write-through（+ write buffer）</option><option value="wb">Write-back</option></select>'
      + '<select id="wAl"><option value="alloc">write miss：write allocate</option><option value="noalloc">write miss：no-write allocate</option></select>'
      + '<label>address <input id="wA" type="number" min="0" max="7" value="1" style="width:50px"></label>'
      + '<button class="primary" id="wSw">sw（寫）</button><button id="wLw">lw（讀）</button><button id="wTick">記憶體完成一筆</button><button id="wRun">跑：sw1 sw1 sw1 lw5 lw1</button>'
    );
    $('wPol').value = W.pol; $('wAl').value = W.alloc;
    $('wPol').onchange = (e) => { W.pol = e.target.value; enterWrite(); };
    $('wAl').onchange = (e) => { W.alloc = e.target.value; enterWrite(); };
    const addr = () => { const a = Number($('wA').value); if (!(a >= 0 && a <= 7) || !Number.isInteger(a)) { log('address 要是 0–7（index = address mod 4、tag = address / 4）。', true); return null; } return a; };
    on('wSw', () => { const a = addr(); if (a !== null) wOp('sw', a); });
    on('wLw', () => { const a = addr(); if (a !== null) wOp('lw', a); });
    on('wTick', () => { if (W.pol !== 'wt') { log('write-back 沒有 write buffer 要清；dirty block 被換掉時才寫回。', true); return; } if (!W.buf.length) { log('write buffer 是空的。', true); return; } drain(); wState(); });
    on('wRun', async () => { if (W.busy) return; for (const [op, a] of [['sw', 1], ['sw', 1], ['sw', 1], ['lw', 5], ['lw', 1]]) { await wOp(op, a); await sleep(300); } });
    log(W.pol === 'wt' ? 'Write-through：每次寫都要寫到記憶體；先丟進 write buffer，CPU 就能繼續。' : 'Write-back：只寫 cache、設 dirty bit；這個 block 被換掉時才寫回記憶體。');
    log('簡化：記憶體比 CPU 慢，每執行 2 個指令才能從 write buffer 寫完一筆；也可以按「記憶體完成一筆」。');
    wState();
  }
  function drawBuf() { W.bufM.forEach((m, k) => { const e = W.buf[k]; tint(m, e ? '#e55a9b' : '#efe6d6'); relabel(m, e ? 'M' + e.a + '=' + e.v : ''); }); }
  function drain() {
    const e = W.buf.shift(); if (!e) return;
    W.mem[e.a] = e.v; W.memW++; relabel(W.memM[e.a], 'M[' + e.a + ']=' + e.v); glow(W.memM[e.a], GOLD);
    const g = cube(e.v, '#e55a9b', [0.5, 0.4, 0.5], 0.4, 1.4, 0.5); move(g, 5.2, 5.9 - e.a * 0.62, 0.5); setTimeout(() => kill(g), 500);
    drawBuf();
  }
  async function flyVal(text, color, x1, y1, x2, y2) { const g = cube(text, color, [0.6, 0.4, 0.5], x1, y1, 0.6); move(g, x2, y2, 0.6); await sleep(450); kill(g); }
  async function wOp(op, a) {
    if (W.busy) return; W.busy = true;
    try {
      W.memM.forEach((m) => glow(m, null)); W.lines.forEach((L) => glow(L.mesh, null));
      const i = a % 4, t = a >> 2, L = W.lines[i], hit = L.v && L.tag === t;
      const memY = (x) => 5.9 - x * 0.62;
      const fetch = async () => {
        if (L.v && L.dirty) { const old = L.tag * 4 + i; W.mem[old] = L.val; W.memW++; await flyVal(L.val, '#dd8238', -2.4, L.y, 5.2, memY(old)); relabel(W.memM[old], 'M[' + old + ']=' + L.val); glow(W.memM[old], GOLD); log('換掉 dirty 的 M[' + old + ']：先寫回記憶體（write back）'); }
        if (W.pol === 'wt' && W.buf.some((e) => e.a === a)) { log('要讀的 M[' + a + '] 還在 write buffer 裡：先把 buffer 寫完再讀，否則會讀到舊值。'); while (W.buf.length) drain(); }
        W.memR++; await flyVal(W.mem[a], '#c9b48e', 5.2, memY(a), -2.4, L.y);
        Object.assign(L, { v: true, tag: t, val: W.mem[a], dirty: false });
      };
      if (op === 'lw') {
        if (hit) { glow(L.mesh, GREEN); log('lw ' + a + '：hit，直接從 cache 讀到 ' + L.val); }
        else { log('lw ' + a + '：miss，從記憶體搬進 index ' + bin(i, 2)); await fetch(); glow(L.mesh, RED); }
      } else {
        const v = 'v' + (++W.ver);
        const toCache = hit || W.alloc === 'alloc';
        if (!hit && toCache) { log('sw ' + a + '：write miss → write allocate：先把 block 搬進 cache'); await fetch(); }
        if (toCache) { await flyVal(v, '#e55a9b', -5.8, 5.6, -2.4, L.y); L.val = v; glow(L.mesh, GREEN); }
        if (W.pol === 'wt') {
          if (W.buf.length >= 4) { W.stalls++; log('write buffer 滿了：CPU 停下來等記憶體寫完一筆（stall）', true); drain(); }
          W.buf.push({ a, v }); drawBuf();
          log('sw ' + a + ' = ' + v + '：' + (toCache ? '寫進 cache，' : 'no-write allocate：不進 cache，') + '同時放進 write buffer');
        } else if (toCache) { L.dirty = true; log('sw ' + a + ' = ' + v + '：只寫 cache，dirty = 1（記憶體暫時是舊值）'); }
        else { W.mem[a] = v; W.memW++; await flyVal(v, '#e55a9b', -5.8, 5.6, 5.2, memY(a)); relabel(W.memM[a], 'M[' + a + ']=' + v); log('write-back + no-write allocate：直接寫記憶體（少見的組合，通常配 write allocate）', true); }
      }
      relabel(L.mesh, L.v ? 'M[' + (L.tag * 4 + i) + ']=' + L.val + (L.dirty ? '  D' : '') : '—');
      tint(L.mesh, L.v ? (L.dirty ? '#dd8238' : '#4b9ee2') : GRAY);
      W.ops++;
      if (W.pol === 'wt' && W.ops % 2 === 0 && W.buf.length) drain();
      wState();
    } finally { W.busy = false; }
  }
  function wState() {
    txt(W.cnt, '記憶體寫入 ' + W.memW + ' 次 · 讀取 ' + W.memR + ' 次' + (W.pol === 'wt' ? ' · stall ' + W.stalls : ''));
    setState(W.pol === 'wt' ? 'Write-through + write buffer' : 'Write-back（dirty bit）', [['write miss', W.alloc === 'alloc' ? 'write allocate' : 'no-write allocate'], ['記憶體寫入次數', String(W.memW)], ['記憶體讀取次數', String(W.memR)], ['write buffer', W.pol === 'wt' ? W.buf.length + ' / 4' : '（不需要）'], ['stall', String(W.stalls)]],
      W.pol === 'wt' ? '每個 store 都會寫記憶體 → cache 與記憶體永遠一致' : '連續寫同一個 block 只在被換掉時寫回 <span class="ok">一次</span>');
  }

  // ───────────────────────── 模式 4：AMAT 與 CPI ─────────────────────────
  const am = { ht: 1, mr: 5, pen: 20, lv: 1, h2: 20, mr2: 25, pen2: 400, base: 1, refs: 1 };
  function enterAmat() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 14], [0, 3.3, 0]);
    am.bars = { a1: bar('#2fc092', 1.6, 1.4, -3), a2: bar('#dd8238', 1.6, 1.4, -3), a3: bar('#d64545', 1.6, 1.4, -3), c1: bar('#4b9ee2', 1.6, 1.4, 3), c2: bar('#dd8238', 1.6, 1.4, 3), c3: bar('#d64545', 1.6, 1.4, 3) };
    tag('AMAT（cycles）', 'ptr', -3, 0, 1.5); tag('CPI', 'ptr', 3, 0, 1.5);
    am.la = tag('', 'ptr alt', -3, 1); am.lc = tag('', 'ptr alt', 3, 1);
    controls(
      '<label>hit time <input id="aHt" type="range" min="1" max="5" value="' + am.ht + '" style="width:70px"></label> <b id="aHtv"></b>'
      + '<label>L1 miss rate % <input id="aMr" type="range" min="0" max="20" step="0.5" value="' + am.mr + '" style="width:90px"></label> <b id="aMrv"></b>'
      + '<select id="aLv"><option value="1">只有 L1</option><option value="2">L1 + L2</option></select>'
      + '<label>L2 hit time <input id="aH2" type="range" min="5" max="40" value="' + am.h2 + '" style="width:70px"></label> <b id="aH2v"></b>'
      + '<label>L2 local miss % <input id="aMr2" type="range" min="0" max="100" value="' + am.mr2 + '" style="width:70px"></label> <b id="aMr2v"></b>'
      + '<label>記憶體 penalty <input id="aPen" type="range" min="10" max="400" step="10" value="' + am.pen + '" style="width:90px"></label> <b id="aPenv"></b>'
      + '<button id="aEx1">P&H：1 + 5%×20</button><button id="aEx2">P&H：CPI 9 → 3.4</button>'
    );
    $('aLv').value = String(am.lv);
    const rd = () => { am.ht = Number($('aHt').value); am.mr = Number($('aMr').value); am.lv = Number($('aLv').value); am.h2 = Number($('aH2').value); am.mr2 = Number($('aMr2').value); am.pen = Number($('aPen').value); updAmat(); };
    ['aHt', 'aMr', 'aH2', 'aMr2', 'aPen'].forEach((id) => { $(id).oninput = rd; });
    $('aLv').onchange = rd;
    const setv = (o) => { Object.assign(am, o); ['aHt', 'aMr', 'aH2', 'aMr2', 'aPen'].forEach((id, k) => { $(id).value = String([am.ht, am.mr, am.h2, am.mr2, am.pen][k]); }); $('aLv').value = String(am.lv); updAmat(); };
    on('aEx1', () => { setv({ ht: 1, mr: 5, pen: 20, lv: 1 }); log('P&H：1 ns clock、hit 1 cycle、miss rate 5%、penalty 20 cycles → AMAT = 2 cycles = 2 ns'); });
    on('aEx2', () => { setv({ ht: 1, mr: 2, pen: 400, lv: 2, h2: 20, mr2: 25 }); log('P&H：4 GHz、L1 每指令 miss 2%、記憶體 100 ns = 400 cycles；加 5 ns（20 cycles）L2，到記憶體的 global miss 0.5%（local 25%）'); });
    log('AMAT = hit time + miss rate × miss penalty；兩層時 L1 的 miss penalty = L2 hit time + L2 local miss rate × 記憶體 penalty。');
    log('CPI 這邊以「每指令 1 次存取、base CPI = 1、hit time 已含在 base CPI」計算，和 P&H 多層例題一樣。');
    updAmat();
  }
  function amatCalc(o) {
    const m1 = o.mr / 100, m2 = o.mr2 / 100;
    if (o.lv === 1) return { amat: o.ht + m1 * o.pen, parts: [o.ht, m1 * o.pen, 0], cpi: [1, m1 * o.pen, 0] };
    return { amat: o.ht + m1 * (o.h2 + m2 * o.pen), parts: [o.ht, m1 * o.h2, m1 * m2 * o.pen], cpi: [1, m1 * o.h2, m1 * m2 * o.pen] };
  }
  function updAmat() {
    if ($('aHtv')) { $('aHtv').textContent = am.ht; $('aMrv').textContent = am.mr + '%'; $('aH2v').textContent = am.h2; $('aMr2v').textContent = am.mr2 + '%'; $('aPenv').textContent = am.pen; }
    const r = amatCalc(am);
    const tot = Math.max(r.amat, r.cpi[0] + r.cpi[1] + r.cpi[2]);
    const k = 6 / Math.max(tot, 3);
    let y = 0; [am.bars.a1, am.bars.a2, am.bars.a3].forEach((m, i) => { setBar(m, r.parts[i] * k, y); y += r.parts[i] * k; });
    am.la.position.set(-3, y + 0.5, 0); txt(am.la, 'AMAT = ' + r2(r.amat));
    let yc = 0; [am.bars.c1, am.bars.c2, am.bars.c3].forEach((m, i) => { setBar(m, r.cpi[i] * k, yc); yc += r.cpi[i] * k; });
    const cpi = r.cpi[0] + r.cpi[1] + r.cpi[2];
    am.lc.position.set(3, yc + 0.5, 0); txt(am.lc, 'CPI = ' + r2(cpi));
    const f = am.lv === 1 ? 'AMAT = ' + am.ht + ' + ' + am.mr + '% × ' + am.pen + ' = <span class="ok">' + r2(r.amat) + '</span> cycles'
      : 'AMAT = ' + am.ht + ' + ' + am.mr + '% × (' + am.h2 + ' + ' + am.mr2 + '% × ' + am.pen + ') = <span class="ok">' + r2(r.amat) + '</span>';
    setState('AMAT 與 CPI', [['綠：hit time', String(am.ht)], ['橘：L1 miss → ' + (am.lv === 1 ? '記憶體' : 'L2'), r2(r.parts[1]) + ' cycles'], ['紅：L2 miss → 記憶體', am.lv === 2 ? r2(r.parts[2]) + ' cycles' : '—'], ['global miss rate', am.lv === 2 ? r2(am.mr * am.mr2 / 100) + '%' : am.mr + '%']],
      f + '<br>CPI = 1 + ' + r2(r.cpi[1]) + (am.lv === 2 ? ' + ' + r2(r.cpi[2]) : '') + ' = <span class="ok">' + r2(cpi) + '</span>');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function opts4(ans, cands, unit = '') {
    const s = new Set([ans]);
    for (const c of cands) { if (s.size >= 4) break; if (c !== undefined && c !== null && String(c) !== '' && !String(c).startsWith('-')) s.add(String(c)); }
    let k = 1; while (s.size < 4) { s.add(String(Number.parseFloat(ans) + k * 3) + unit); k++; }
    return [...s];
  }
  function dmHits(seq, blocks) { const c = new Array(blocks).fill(-1); let h = 0; for (const b of seq) { if (c[b % blocks] === b) h++; else c[b % blocks] = b; } return h; }
  const CONCEPT = [
    { q: '提高 associativity（例如 direct-mapped → 4-way）主要減少哪一種 miss？', opts: ['Conflict miss', 'Compulsory miss', 'Capacity miss', '三種都同樣減少'], ans: 'Conflict miss', why: '多個 block 搶同一個 set 才會 conflict；way 變多就比較不會互踢。代價是比較器變多、hit time 可能變長。' },
    { q: '加大 block size 最直接減少哪一種 miss？', opts: ['Compulsory miss', 'Conflict miss', 'Capacity miss', 'Coherence miss'], ans: 'Compulsory miss', why: '一次搬進更多相鄰的 word（spatial locality），第一次碰到的 miss 變少；但 block 太大會讓 block 數變少、miss penalty 變大。' },
    { q: 'Write-back cache 的 dirty bit 用途是？', opts: ['標記 block 被寫過，換掉時要寫回記憶體', '標記 block 是否有效', '標記 block 最近被用過，給 LRU 用', '標記這個 block 正在 write buffer 裡'], ans: '標記 block 被寫過，換掉時要寫回記憶體', why: '沒被改過的 block 換掉時直接丟掉即可；dirty 的才需要寫回。valid bit 才是「有效」。' },
    { q: 'Write-through cache 搭配 write buffer 的目的？', opts: ['CPU 把資料放進 buffer 就能繼續，不必等記憶體寫完', '讓 cache 不需要 valid bit', '減少 read miss 的次數', '讓記憶體永遠比 cache 新'], ans: 'CPU 把資料放進 buffer 就能繼續，不必等記憶體寫完', why: '若沒有 buffer，每個 store 都要等約 100 cycles；buffer 滿了才 stall。' },
    { q: '下列哪一種是「spatial locality」的例子？', opts: ['依序走訪陣列 a[0], a[1], a[2] …', '迴圈裡反覆使用變數 sum', '反覆執行同一個迴圈的指令', '呼叫同一個函式很多次'], ans: '依序走訪陣列 a[0], a[1], a[2] …', why: 'spatial：用了某位址，附近的位址很快也會被用；temporal：同一個位址很快會再被用。' },
    { q: '同大小的 cache 改成 fully associative，哪種 miss 會變成 0？', opts: ['Conflict miss', 'Capacity miss', 'Compulsory miss', '沒有任何一種'], ans: 'Conflict miss', why: 'conflict miss 的定義就是「同大小 fully associative 會 hit、這個 cache 卻 miss」。compulsory 與 capacity 仍在。' },
  ];
  function genQ() {
    const p = Math.random();
    if (p < 0.22) {
      const kib = pickOne([4, 8, 16, 32, 64]), blockB = pickOne([16, 32, 64]), ways = pickOne([1, 2, 4, 0]);
      const c = splitCalc(kib, blockB, ways);
      const org = ways === 0 ? 'fully associative' : ways === 1 ? 'direct-mapped' : ways + '-way set associative';
      return { q: '32-bit byte address、' + kib + ' KiB 資料、block ' + blockB + ' bytes 的 ' + org + ' cache，tag 有幾 bits？', opts: opts4(String(c.tg), [c.tg + 1, c.tg - 1, 32 - c.off, c.tg + lg(c.w || 1) + 1, 32 - lg(kib * 1024)].map(String)), ans: String(c.tg), why: 'offset = log₂' + blockB + ' = ' + c.off + '；set 數 = ' + c.blocks + ' / ' + c.w + ' = ' + c.sets + ' → index ' + c.idx + ' bits；tag = 32 − ' + c.idx + ' − ' + c.off + ' = ' + c.tg + '。' };
    }
    if (p < 0.38) {
      const seq = Array.from({ length: 7 }, () => pickOne([0, 1, 2, 3, 8, 9, 10, 16, 17, 24, 26]));
      const h = dmHits(seq, 8);
      return { q: '8 個 1-word block 的 direct-mapped cache（一開始是空的），依序存取 word address：' + seq.join(', ') + '，共幾次 hit？', opts: opts4(String(h), [h + 1, h - 1, h + 2, h - 2].map(String)), ans: String(h), why: 'index = address mod 8；同一個 index 的不同 tag 會互相踢掉。逐一模擬：' + seq.map((a) => a + '→' + (a % 8)).join('、') + '。' };
    }
    if (p < 0.52) {
      const ht = rnd(1, 2), mr = pickOne([2, 3, 4, 5, 8, 10]), pen = pickOne([20, 40, 50, 100, 200]);
      const a = r2(ht + mr / 100 * pen);
      return { q: 'hit time ' + ht + ' cycle、miss rate ' + mr + '%、miss penalty ' + pen + ' cycles，AMAT = ？', opts: opts4(a + ' cycles', [r2(mr / 100 * pen) + ' cycles', r2(ht + mr / 100 * (pen + ht)) + ' cycles', r2((1 - mr / 100) * ht + pen) + ' cycles', r2(ht * (1 - mr / 100) + mr / 100 * pen + 1) + ' cycles'], ' cycles'), ans: a + ' cycles', why: 'AMAT = hit time + miss rate × miss penalty = ' + ht + ' + ' + mr / 100 + ' × ' + pen + ' = ' + a + '。' };
    }
    if (p < 0.66) {
      const mr1 = pickOne([2, 3, 4]), memns = pickOne([60, 80, 100]), ghz = pickOne([2, 4, 5]), l2ns = pickOne([4, 5, 10]), glob = pickOne([0.5, 1]);
      const pen = memns * ghz, p2 = l2ns * ghz;
      const one = r2(1 + mr1 / 100 * pen), two = r2(1 + mr1 / 100 * p2 + glob / 100 * pen);
      return { q: ghz + ' GHz、base CPI 1；L1 每指令 miss ' + mr1 + '%，記憶體 ' + memns + ' ns。加一層 ' + l2ns + ' ns 的 L2 後，到記憶體的 global miss rate 為 ' + glob + '%。新的 CPI？', opts: opts4(String(two), [one, r2(1 + mr1 / 100 * (p2 + pen)), r2(1 + glob / 100 * pen), r2(1 + mr1 / 100 * p2 + mr1 / 100 * glob / 100 * pen)].map(String)), ans: String(two), why: '記憶體 penalty = ' + memns + ' ns × ' + ghz + ' GHz = ' + pen + ' cycles；L2 = ' + p2 + ' cycles。CPI = 1 + ' + mr1 + '% × ' + p2 + ' + ' + glob + '% × ' + pen + ' = ' + two + '（只有 L1 時是 ' + one + '）。' };
    }
    if (p < 0.78) {
      const im = pickOne([1, 2, 3]), dm = pickOne([4, 5, 6]), ls = pickOne([25, 36, 40]), pen = pickOne([50, 100]), base = pickOne([1, 1.5, 2]);
      const cpi = r2(base + im / 100 * pen + ls / 100 * dm / 100 * pen);
      return { q: 'I-cache miss rate ' + im + '%、D-cache ' + dm + '%、load/store 占 ' + ls + '%、miss penalty ' + pen + ' cycles、沒有 stall 時 CPI = ' + base + '。實際 CPI？', opts: opts4(String(cpi), [r2(base + im / 100 * pen + dm / 100 * pen), r2(base + ls / 100 * dm / 100 * pen), r2(base + (im + dm) / 100 * pen * ls / 100), r2(im / 100 * pen + ls / 100 * dm / 100 * pen)].map(String)), ans: String(cpi), why: '每指令都要取指令：' + im + '% × ' + pen + ' = ' + r2(im / 100 * pen) + '；只有 load/store 會碰 D-cache：' + ls + '% × ' + dm + '% × ' + pen + ' = ' + r2(ls / 100 * dm / 100 * pen) + '。CPI = ' + base + ' + 兩者 = ' + cpi + '。' };
    }
    if (p < 0.86) {
      const kib = pickOne([4, 8, 16, 32]), words = pickOne([1, 2, 4, 8]);
      const c = splitCalc(kib, words * 4, 1);
      const kb = r2(c.totalBits / 1024);
      return { q: '32-bit 位址、' + kib + ' KiB 資料、block = ' + words + ' word(s) 的 direct-mapped cache，含 valid bit 共需多少 bits？', opts: opts4(kb + ' Kibit', [r2(kib * 8) + ' Kibit', r2(c.blocks * (c.tg + words * 32) / 1024) + ' Kibit', r2(c.blocks * (c.tg + 1 + words * 32 + 1) / 1024) + ' Kibit', r2(c.blocks * (32 + 1 + words * 32) / 1024) + ' Kibit'], ' Kibit'), ans: kb + ' Kibit', why: 'block 數 2^' + lg(c.blocks) + '，tag = 32 − ' + c.idx + ' − ' + c.off + ' = ' + c.tg + '；每行 1 + ' + c.tg + ' + ' + words * 32 + ' = ' + c.perLine + ' bits，× ' + c.blocks + ' = ' + c.totalBits + ' bits。' };
    }
    return { ...pickOne(CONCEPT) };
  }
  let qs = { score: 0, total: 0 };
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
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => { const o = decodeURIComponent(b.dataset.o); if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ───────────────────────── 場景（依 P&H 第 5 章例題；本章影片尚無逐字稿） ─────────────────────────
  async function scHierarchy(tok) {
    fresh([0, 4.5, 15], [0, 3.2, 0]);
    const LV = [['SRAM（cache）', '0.5–2.5 ns', '$500–1000/GiB', 2.2, '#2fc092'], ['DRAM（主記憶體）', '50–70 ns', '$10–20/GiB', 4.2, '#4b9ee2'], ['Flash', '5,000–50,000 ns', '$0.75–1/GiB', 6.2, '#9b7ef4'], ['Magnetic disk', '5–20 ms', '$0.05–0.1/GiB', 8.2, '#dd8238']];
    cube('CPU', '#31aab0', [1.4, 0.8, 1.2], 0, 7.2, 0);
    const ms = [];
    say('記憶體階層：離 CPU 越近越快、越小、越貴', 'P&H 圖 5.1／5.3（2012 年價格）');
    for (let i = 0; i < LV.length; i++) {
      const [n, t, c, w, col] = LV[i], y = 6.1 - i * 1.5;
      ms.push(cube(n, col, [w, 0.9, 1.4], 0, y, 0, 3));
      tag(t, 'ptr', -5.6, y); tag(c, 'ptr alt', 5.6, y);
      say(n + '：存取 ' + t, '每 GiB ' + c);
      await beat(tok, 1500);
    }
    say('目標：容量像最底層、速度像最上層', '靠 locality：常用的資料放在上層');
    await beat(tok, 2400);
    const blk = cube('block', '#e55a9b', [0.9, 0.5, 0.7], 0, 1.6, 1.0);
    for (let i = 2; i >= 0; i--) { move(blk, 0, 6.1 - i * 1.5 + 0.1, 1.0); say('資料只在相鄰兩層之間搬，單位是 block', i ? '往上一層複製' : '到了 cache：之後 CPU 直接在這裡 hit'); await beat(tok, 1100); }
    say('階層越上層，存的是下層的子集', 'hit：上層找到；miss：去下層拿 block');
    await beat(tok, 2600);
  }
  async function scLocality(tok) {
    fresh([0, 5.5, 13.5], [0, 2.4, 0]);
    const cd = code(['sum = 0;', 'for (i = 0; i < n; i++)', '    sum += a[i];'], -3.6, 6.6);
    const cells = []; for (let k = 0; k < 12; k++) { cells.push(cube('a[' + k + ']', '#efe6d6', [0.9, 0.4, 0.8], -5.4 + k * 0.98, 0.2, 1.2)); }
    const blkL = tag('', 'ptr alt', 0, 1.3, 1.2);
    const sumC = cube('sum', '#9b7ef4', [1.1, 0.7, 0.9], 3.2, 4.6, 0), iC = cube('i', '#31aab0', [1.1, 0.7, 0.9], 4.7, 4.6, 0);
    const uses = tag('', 'ptr', 4, 5.6);
    say('一個迴圈同時有兩種 locality', 'temporal：剛用過的很快再用；spatial：附近的很快會用');
    await beat(tok, 2600);
    for (let k = 0; k < 12; k++) {
      cd.hl(k % 2 ? 1 : 2);
      if (k % 4 === 0) { for (let j = k; j < k + 4; j++) tint(cells[j], '#4b9ee2'); txt(blkL, 'miss：一次搬進 a[' + k + ']–a[' + (k + 3) + ']（一個 block）'); blkL.position.set(-5.4 + (k + 1.5) * 0.98, 1.3, 1.2); }
      glow(cells[k], GOLD); glow(sumC, GOLD); glow(iC, GOLD);
      txt(uses, 'sum、i 第 ' + (k + 1) + ' 次被用');
      say(k % 4 === 0 ? 'a[' + k + ']：miss，整個 block 進 cache' : 'a[' + k + ']：hit，因為同一個 block 已經進來', k % 4 === 0 ? 'spatial locality：附近的 a[' + (k + 1) + '..' + (k + 3) + '] 一起進來' : 'spatial locality 帶來的 hit');
      await beat(tok, k < 4 ? 1200 : 450);
      glow(cells[k], null); glow(sumC, null); glow(iC, null);
    }
    cd.hl(1);
    say('sum、i 與迴圈指令一直重複使用', 'temporal locality：留在 cache（甚至暫存器）');
    await beat(tok, 2600);
    say('陣列循序走訪 → spatial；重複使用 → temporal', '4 次存取只 miss 1 次：miss rate 25%');
    await beat(tok, 2800);
  }
  async function scHitMiss(tok) {
    fresh([0, 4, 13], [0, 2.6, 0]);
    tag('上層（cache）', 'ptr', -3.5, 5.6); tag('下層（memory）', 'ptr', 3.5, 5.6);
    const up = [], low = [];
    for (let k = 0; k < 4; k++) up.push(cube(k < 2 ? 'X' + k : '—', k < 2 ? '#4b9ee2' : GRAY, [1.4, 0.6, 0.9], -3.5, 4.6 - k * 0.8, 0));
    for (let k = 0; k < 8; k++) low.push(cube('X' + k, '#c9b48e', [1.4, 0.45, 0.9], 3.5, 4.8 - k * 0.6, 0));
    const cpu = cube('CPU', '#31aab0', [1.2, 0.9, 1], -6, 2.4, 0);
    say('CPU 要 X1：上層有 → hit', 'hit time：存取上層 + 判斷 hit/miss 的時間');
    glow(up[1], GREEN); await beat(tok, 2400); glow(up[1], null);
    say('CPU 要 X5：上層沒有 → miss', '');
    glow(low[5], GOLD); await beat(tok, 1300);
    const g = cube('X5', '#4b9ee2', [1.4, 0.6, 0.9], 3.5, 4.8 - 5 * 0.6, 0.6); move(g, -3.5, 4.6 - 2 * 0.8, 0.6);
    say('從下層搬整個 block 上來，再交給 CPU', 'miss penalty：換掉上層 block + 搬上來 + 送給 CPU 的時間');
    await beat(tok, 1000); kill(g); tint(up[2], '#4b9ee2'); relabel(up[2], 'X5'); glow(up[2], RED); glow(low[5], null);
    await beat(tok, 1800);
    say('hit rate = hit 次數 / 存取次數', 'miss rate = 1 − hit rate');
    await beat(tok, 2400);
    say('miss penalty 遠大於 hit time', '所以 miss rate 小小變化，效能就差很多');
    await beat(tok, 2600);
  }
  async function scDMMapping(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const slots = []; for (let i = 0; i < 8; i++) { slots.push(cube(bin(i, 3), i === 1 || i === 5 ? '#9b7ef4' : '#efe6d6', [1.25, 0.5, 0.9], -5.0 + i * 1.43, 5.6, 0)); }
    tag('Cache（8 個 block）', 'ptr', 0, 6.6);
    const addrs = [1, 5, 9, 13, 17, 21, 25, 29];
    const mem = addrs.map((a, k) => cube(bin(a, 5), '#c9b48e', [1.25, 0.45, 0.9], -5.0 + k * 1.43, 1.0, 0));
    tag('Memory 位址', 'ptr', 0, 0.05, 1);
    say('Direct-mapped：每個 block 只有一個位置', '位置 = (block address) mod (cache 的 block 數)');
    await beat(tok, 2800);
    say('8 個 block → 取位址最低 3 bits 當 index', 'mod 8 = 低 3 bits');
    await beat(tok, 2200);
    for (let k = 0; k < addrs.length; k++) {
      const a = addrs[k], idx = a % 8;
      glow(mem[k], GOLD);
      const g = cube(bin(a, 5), '#e55a9b', [1.0, 0.4, 0.7], -5.0 + k * 1.43, 1.0, 0.6); move(g, -5.0 + idx * 1.43, 5.6, 0.7);
      say(bin(a, 5) + '（' + a + '）→ index ' + bin(idx, 3), a + ' mod 8 = ' + idx);
      await beat(tok, 900);
      kill(g); glow(mem[k], null); glow(slots[idx], GOLD);
    }
    say('8 個位址搶 001 與 101 兩格', '同一格裡是誰？靠剩下的高位 bits：tag');
    await beat(tok, 2800);
    say('另加 valid bit：開機時格子裡是垃圾', 'valid = 0 的格子一律算 miss');
    await beat(tok, 2600);
  }
  async function scDMSequence(tok) {
    fresh([0, 4.2, 14.5], [0, 3.4, 0]);
    const S = makeSim({ blocks: 8, ways: 1, bw: 1, bits: 5 });
    const seq = [22, 26, 22, 26, 16, 3, 16, 18];
    const seqL = seq.map((a, k) => tag(String(a), 'idx', -5.6 + k * 0.6, 7.6));
    say('P&H 例：8-block direct-mapped，一開始全空', '存取 word address 22, 26, 22, 26, 16, 3, 16, 18');
    await beat(tok, 3000);
    for (let k = 0; k < seq.length; k++) {
      S.unglow();
      seqL.forEach((l, j) => { l.element.className = 'lab-label ' + (j === k ? 'ptr alt' : 'idx'); });
      const r = await S.access(seq[k], tok, 1.4);
      say(seq[k] + ' = ' + bin(seq[k], 5) + '：index ' + bin(r.set, 3) + (r.hit ? ' → hit' : ' → miss'),
        r.hit ? 'valid 且 tag ' + bin(r.f.tg, 2) + ' 相同' : r.victim !== null ? '把 ' + r.victim + '（tag ' + bin(Math.floor(r.victim / 8), 2) + '）換掉' : 'valid = 0，放進去');
      await beat(tok, 1700);
    }
    say('8 次存取：hit 3、miss 5', '18 與 26 都對到 010 → 互相踢掉');
    await beat(tok, 3000);
  }
  async function scAddr1200(tok) {
    fresh([0, 3, 13], [0, 2.3, 0]);
    say('P&H 例：64 個 block、每 block 16 bytes', 'byte address 1200 對到哪一個 block？');
    await beat(tok, 2600);
    const st = bitStrip(1200, [{ n: 'tag', b: 22, c: FC.tag }, { n: 'index', b: 6, c: FC.index }, { n: 'offset', b: 4, c: FC.offset }], 3.4);
    say('1200 = 0x4B0：32-bit 位址', 'offset = log₂16 = 4 bits；index = log₂64 = 6 bits');
    await beat(tok, 2600);
    st.cubes.slice(28).forEach((m) => glow(m, GOLD));
    say('去掉低 4 bits：block address = ⌊1200/16⌋ = 75', '同一個 block 的 16 個 byte 只差 offset');
    await beat(tok, 2600);
    st.cubes.forEach((m) => glow(m, null)); st.cubes.slice(22, 28).forEach((m) => glow(m, GOLD));
    say('index = 75 mod 64 = 11 = 001011', '這個 block 只能放 cache 第 11 格');
    tag('block 75 → cache block 11', 'ptr alt', 0, 1.6);
    await beat(tok, 2800);
    st.cubes.forEach((m) => glow(m, null)); st.cubes.slice(0, 22).forEach((m) => glow(m, GOLD));
    say('tag = ⌊75/64⌋ = 1：剩下 22 bits', '存在 cache 裡，用來比對是誰');
    await beat(tok, 2800);
    say('對應位址 1200–1215 都落在同一個 block', '');
    await beat(tok, 2400);
  }
  async function scCacheBits(tok) {
    fresh([0, 3, 13], [0, 2.2, 0]);
    say('P&H 例：16 KiB 資料、block 4 words、32-bit 位址', 'direct-mapped 總共需要幾 bits？');
    await beat(tok, 2800);
    const st = bitStrip(null, [{ n: 'tag', b: 18, c: FC.tag }, { n: 'index', b: 10, c: FC.index }, { n: 'offset', b: 4, c: FC.offset }], 3.6);
    say('16 KiB = 4096 words = 1024 blocks = 2¹⁰', 'index 10 bits；4 words = 16 bytes → offset 4 bits');
    await beat(tok, 2800);
    say('tag = 32 − 10 − 4 = 18 bits', '（offset 4 = word 2 bits + byte 2 bits）');
    await beat(tok, 2600);
    const segs = [['V 1', 1, '#2fc092'], ['tag 18', 18, FC.tag], ['data 4×32 = 128', 128, '#c9b48e']];
    let x = -6; const k = 12 / 147;
    for (const [n, b, c] of segs) { const w = Math.max(0.2, b * k); cube('', c, [w, 0.5, 0.7], x + w / 2, 1.3, 0, 2); tag(n, 'idx', x + w / 2, 1.3, 0.7); x += w; await beat(tok, 700); }
    say('每一格 = 1 + 18 + 128 = 147 bits', '× 1024 格 = 147 Kibit ≈ 18.4 KiB');
    await beat(tok, 3000);
    say('實際要 18.4 KiB，比 16 KiB 資料多約 1.15 倍', 'tag 與 valid bit 是額外的成本');
    await beat(tok, 2800);
    st.kill();
  }
  async function scBlockSize(tok) {
    fresh([0, 4, 13], [0, 2.8, 0]);
    const BS = [16, 32, 64, 128, 256];
    const MR = [3.6, 2.6, 2.2, 2.6, 4.2];
    tag('miss rate（示意）', 'ptr', -5.5, 6.2);
    const bs = BS.map((b, k) => { tag(b + 'B', 'idx', -4 + k * 2, 0, 1.2); return bar('#4b9ee2', 1.2, 1.2, -4 + k * 2); });
    say('block 變大：先利用 spatial locality，miss rate 下降', '趨勢同 P&H 圖 5.11（小 cache）');
    for (let k = 0; k < 3; k++) { await growBar(tok, bs[k], MR[k] * 1.2, 600); await beat(tok, 500); }
    await beat(tok, 1400);
    say('太大：cache 裡 block 數變少，互相搶位置', 'miss rate 反而上升');
    for (let k = 3; k < 5; k++) { tint(bs[k], '#d64545'); await growBar(tok, bs[k], MR[k] * 1.2, 600); await beat(tok, 500); }
    await beat(tok, 1600);
    say('另外：block 越大，miss penalty 越大', '搬一個 block 的時間變長');
    await beat(tok, 2600);
    say('對策：early restart、critical word first', '要的那個 word 一到就先讓 CPU 繼續');
    await beat(tok, 2800);
  }
  async function scMissSteps(tok) {
    fresh([0, 4, 13], [0, 3, 0]);
    const steps = ['① 把 PC − 4 送到記憶體', '② 記憶體讀取，CPU 等待（stall）', '③ 寫入 cache：data、tag、valid = 1', '④ 重新執行取指令，這次 hit'];
    const pc = cube('PC', '#31aab0', [1.2, 0.8, 1], -5, 4.5, 0);
    const c = cube('I-cache', '#9b7ef4', [2.2, 1, 1.2], -1, 4.5, 0);
    const m = cube('Memory', '#c9b48e', [2.2, 1.6, 1.2], 4.5, 4.5, 0);
    const ls = steps.map((s, k) => tag(s, 'idx', 0, 2.6 - k * 0.7));
    say('instruction cache miss 時要做什麼？', 'P&H：控制單元 stall 整個處理器');
    await beat(tok, 2600);
    for (let k = 0; k < 4; k++) {
      ls.forEach((l, j) => { l.element.className = 'lab-label ' + (j === k ? 'ptr alt' : 'idx'); });
      say(steps[k], k === 0 ? 'PC 已經 +4，所以要減回來' : k === 1 ? '要等很多個 cycle' : k === 2 ? '位址高位寫進 tag' : '');
      if (k === 0) { const g = cube('PC−4', '#31aab0', [0.9, 0.5, 0.6], -5, 4.5, 0.7); move(g, 4.5, 4.5, 0.7); await beat(tok, 900); kill(g); }
      if (k === 1) { for (let r = 0; r < 4; r++) { glow(m, r % 2 ? null : GOLD); await beat(tok, 350); } glow(m, null); }
      if (k === 2) { const g = cube('instr', '#e55a9b', [0.9, 0.5, 0.6], 4.5, 4.5, 0.7); move(g, -1, 4.5, 0.7); await beat(tok, 900); kill(g); glow(c, RED); }
      if (k === 3) { glow(c, GREEN); }
      await beat(tok, 1700);
    }
    say('data cache 的 miss 也一樣：stall 到資料回來', '');
    await beat(tok, 2400);
  }
  async function scWriteThrough(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const cpu = cube('CPU', '#31aab0', [1.3, 1.1, 1], -5.6, 4.4, 0);
    const c = cube('cache', '#4b9ee2', [1.8, 1.1, 1], -2.2, 4.4, 0);
    const m = cube('Memory', '#c9b48e', [2, 1.6, 1], 4.8, 4.4, 0);
    say('Write-through：寫 cache 的同時也寫記憶體', 'cache 和記憶體永遠一致');
    await beat(tok, 2600);
    for (let k = 0; k < 2; k++) { const g = cube('sw', '#e55a9b', [0.7, 0.45, 0.6], -5.6, 4.4, 0.7); move(g, -2.2, 4.4, 0.7); await beat(tok, 500); move(g, 4.8, 4.4, 0.7); await beat(tok, 700); kill(g); }
    say('P&H 例：寫記憶體要 100 cycles、10% 是 store', 'CPI = 1 + 10% × 100 = 11');
    tag('CPI 1 → 11：慢 10 倍以上', 'ptr alt', 0, 6.3);
    await beat(tok, 3200);
    say('解法：write buffer', 'store 放進 buffer，CPU 就繼續');
    const buf = []; for (let k = 0; k < 4; k++) buf.push(cube('', '#efe6d6', [0.8, 0.5, 0.8], 0.2 + k * 0.9, 2.2, 0));
    tag('write buffer', 'ptr', 1.55, 1.3);
    await beat(tok, 2000);
    let used = 0;
    for (let k = 0; k < 6; k++) {
      if (used < 4) { tint(buf[used], '#e55a9b'); relabel(buf[used], 'w' + (k + 1)); used++; }
      say('store w' + (k + 1) + '：放進 buffer，CPU 不等', 'buffer：' + used + ' / 4');
      if (k % 2 === 1 && used) { await beat(tok, 500); used--; for (let j = 0; j < 4; j++) { tint(buf[j], j < used ? '#e55a9b' : '#efe6d6'); } glow(m, GOLD); say('記憶體寫完一筆，buffer 空出一格', ''); await beat(tok, 500); glow(m, null); }
      await beat(tok, 700);
    }
    say('store 太密集、buffer 滿了 → 才需要 stall', 'buffer 只能平滑短時間的高峰');
    await beat(tok, 3000);
  }
  async function scWriteBack(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const cpu = cube('CPU', '#31aab0', [1.3, 1.1, 1], -5.6, 4.4, 0);
    const L = cube('M[1]=0', '#4b9ee2', [2.2, 0.8, 1], -2.0, 4.4, 0);
    const mem1 = cube('M[1]=0', '#c9b48e', [2, 0.6, 1], 4.6, 4.9, 0), mem5 = cube('M[5]=7', '#c9b48e', [2, 0.6, 1], 4.6, 3.9, 0);
    const cnt = tag('寫記憶體 0 次', 'ptr alt', 0, 6.3);
    say('Write-back：只寫 cache，被換掉時才寫回', '需要 dirty bit 記錄「被改過」');
    await beat(tok, 2600);
    for (let k = 1; k <= 3; k++) {
      const g = cube('v' + k, '#e55a9b', [0.6, 0.45, 0.6], -5.6, 4.4, 0.7); move(g, -2.0, 4.4, 0.7); await beat(tok, 600); kill(g);
      relabel(L, 'M[1]=v' + k + '  D'); tint(L, '#dd8238');
      say('sw 第 ' + k + ' 次：只改 cache，dirty = 1', '記憶體裡的 M[1] 還是舊值 0');
      await beat(tok, 1300);
    }
    say('讀 M[5]：跟 M[1] 撞同一格（index 相同）', 'M[1] 是 dirty → 先寫回');
    await beat(tok, 2200);
    const g = cube('v3', '#dd8238', [0.6, 0.45, 0.6], -2.0, 4.4, 0.7); move(g, 4.6, 4.9, 0.7); await beat(tok, 800); kill(g);
    relabel(mem1, 'M[1]=v3'); glow(mem1, GOLD); txt(cnt, '寫記憶體 1 次');
    const g2 = cube('7', '#c9b48e', [0.6, 0.45, 0.6], 4.6, 3.9, 0.7); move(g2, -2.0, 4.4, 0.7); await beat(tok, 800); kill(g2);
    relabel(L, 'M[5]=7'); tint(L, '#4b9ee2');
    say('三次寫入，只寫回記憶體一次', 'write-through 要寫 3 次');
    await beat(tok, 2800);
    say('write miss：write allocate 先把 block 搬進來', 'no-write allocate：直接寫記憶體，不進 cache');
    await beat(tok, 3000);
  }
  async function scCpiStall(tok) {
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    say('P&H 例：I-cache miss 2%、D-cache miss 4%', 'CPI（無 stall）= 2、miss penalty 100、load/store 36%');
    await beat(tok, 3200);
    const k = 1.1;
    const b0 = bar('#4b9ee2', 1.8, 1.4, -3), b1 = bar('#dd8238', 1.8, 1.4, -3), b2 = bar('#d64545', 1.8, 1.4, -3);
    tag('實際 CPI', 'ptr', -3, 0, 1.5);
    await growBar(tok, b0, 2 * k, 600); tag('base 2', 'idx', -4.6, 1.1);
    say('取指令 miss：每個指令都要取', 'I × 2% × 100 = 2.00 I');
    await growBar(tok, b1, 2 * k, 700, 2 * k); tag('I-miss 2.00', 'idx', -4.9, 3.3);
    await beat(tok, 1800);
    say('資料 miss：只有 36% 的 load/store', 'I × 36% × 4% × 100 = 1.44 I');
    await growBar(tok, b2, 1.44 * k, 700, 4 * k); tag('D-miss 1.44', 'idx', -4.9, 5.2);
    await beat(tok, 1800);
    tag('CPI = 2 + 3.44 = 5.44', 'ptr alt', -3, 6.6);
    const p = bar('#2fc092', 1.8, 1.4, 3); tag('perfect cache', 'ptr', 3, 0, 1.5);
    await growBar(tok, p, 2 * k, 600);
    say('完美 cache 快 5.44 / 2 = 2.72 倍', '');
    await beat(tok, 2600);
    say('CPU 變快（CPI 2 → 1），stall 不變', 'CPI 4.44，stall 占 3.44 / 4.44 ≈ 77%');
    await beat(tok, 3200);
  }
  async function scAmat(tok) {
    fresh([0, 4, 13], [0, 2.8, 0]);
    say('Average Memory Access Time', 'AMAT = hit time + miss rate × miss penalty');
    await beat(tok, 2800);
    say('P&H 例：1 ns clock、hit time 1 cycle', 'miss penalty 20 cycles、miss rate 5%');
    await beat(tok, 2600);
    const hits = [];
    for (let k = 0; k < 20; k++) {
      const miss = k === 7;
      hits.push(cube('', miss ? '#d64545' : '#2fc092', [0.5, 0.5, 0.5], -5.2 + (k % 10) * 1.1, 4.6 - Math.floor(k / 10) * 0.8, 0, 2));
      await beat(tok, 90);
    }
    say('20 次存取裡平均 1 次 miss（5%）', '每次都要 hit time；miss 的還要多付 20');
    await beat(tok, 2600);
    const b1 = bar('#2fc092', 2, 1.4, 0), b2 = bar('#d64545', 2, 1.4, 0);
    await growBar(tok, b1, 1.4, 600);
    tag('hit time 1', 'idx', 1.9, 0.7);
    await growBar(tok, b2, 1.4, 600, 1.4);
    tag('0.05 × 20 = 1', 'idx', 2.1, 2.1);
    say('AMAT = 1 + 0.05 × 20 = 2 cycles', '= 2 ns');
    tag('AMAT = 2 cycles', 'ptr alt', 0, 3.3);
    await beat(tok, 3200);
  }
  async function scAssocSpectrum(tok) {
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    const ms = []; for (let k = 0; k < 8; k++) ms.push(cube('', PAL[k], [1.2, 0.5, 0.8], 0, 6 - k * 0.7, 0));
    const lbl = tag('', 'ptr alt', 0, 7.2);
    const setLs = [];
    const lay = async (ways, name, cap, f) => {
      setLs.splice(0).forEach(kill);
      const sets = 8 / ways;
      txt(lbl, name);
      for (let k = 0; k < 8; k++) { const s = Math.floor(k / ways), w = k % ways; move(ms[k], (w - (ways - 1) / 2) * 1.45, 6 - s * (5.6 / Math.max(sets - 1, 1)) * (sets > 1 ? 1 : 0) - (sets === 1 ? 2.5 : 0), 0); }
      for (let s = 0; s < sets; s++) setLs.push(tag('set ' + s, 'idx', -(ways / 2) * 1.45 - 0.9, 6 - s * (5.6 / Math.max(sets - 1, 1)) * (sets > 1 ? 1 : 0) - (sets === 1 ? 2.5 : 0)));
      say(cap, f);
      await beat(tok, 3200);
    };
    await lay(1, '1-way = direct-mapped：8 sets', '同樣 8 個 block，不同的擺法', 'set = block address mod 8');
    await lay(2, '2-way：4 sets × 2', '每個 set 有 2 個位置可放', 'set = block address mod 4');
    await lay(4, '4-way：2 sets × 4', '位置更多，conflict 更少', 'set = block address mod 2');
    await lay(8, '8-way = fully associative：1 set', '放哪都可以，要比對全部 8 個 tag', '');
    say('associativity ↑：miss rate ↓', '代價：比較器 ↑、hit time ↑、tag ↑');
    await beat(tok, 3000);
  }
  async function scBlock12(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    say('P&H 例：memory block 12 放在 8-block cache 的哪？', '三種組織比一比');
    await beat(tok, 2600);
    const rows = [['Direct-mapped', 1, 6.0], ['2-way set associative', 2, 3.8], ['Fully associative', 8, 1.6]];
    for (const [name, ways, y] of rows) {
      tag(name, 'ptr', -4.8, y + 0.8);
      const sets = 8 / ways, set = 12 % sets;
      const ms = [];
      for (let k = 0; k < 8; k++) {
        const s = Math.floor(k / ways);
        const x = -4.6 + k * 1.15 + s * (ways > 1 && ways < 8 ? 0.25 : 0);
        ms.push(cube(ways === 1 ? String(k) : ways === 8 ? '' : 's' + s, '#efe6d6', [1.0, 0.45, 0.8], x, y, 0));
      }
      const hit = ms.filter((_, k) => Math.floor(k / ways) === set);
      hit.forEach((m) => { tint(m, '#e55a9b'); glow(m, GOLD); });
      say(name + '：' + (ways === 1 ? '12 mod 8 = 4，只能放第 4 格' : ways === 2 ? '12 mod 4 = 0：set 0 的任一格' : '任何一格都行'), '要比較的 tag 數：' + hit.length);
      await beat(tok, 3200);
      hit.forEach((m) => glow(m, null));
    }
    say('越 associative：位置越多，搜尋越貴', '比較器數 1 → 2 → 8');
    await beat(tok, 2800);
  }
  async function scAssoc058(tok) {
    const runs = [['Direct-mapped', 1], ['2-way set associative（LRU）', 2], ['Fully associative（LRU）', 4]];
    const res = [];
    for (const [name, ways] of runs) {
      fresh([0, 4.2, 14.5], [0, 3.4, 0]);
      const S = makeSim({ blocks: 4, ways, bw: 1, bits: 4, ytop: 5.4 });
      tag(name, 'ptr', -0.8, 7.3);
      tag(res.map((r) => r).join(' · '), 'idx', -0.8, -0.6, 1.2);
      say('P&H 例：4 個 block，存取 0, 8, 0, 6, 8', name);
      await beat(tok, 2200);
      for (const a of [0, 8, 0, 6, 8]) {
        S.unglow();
        const r = await S.access(a, tok, 1.1);
        say('block ' + a + '：' + (r.hit ? 'hit' : 'miss') + (r.victim !== null ? '，換掉 ' + r.victim : ''), ways === 1 ? a + ' mod 4 = ' + (a % 4) : ways === 2 ? a + ' mod 2 = ' + (a % 2) + ' → set ' + (a % 2) : '放任何空位；滿了換 LRU');
        await beat(tok, 1300);
      }
      res.push(name.split('（')[0] + ' ' + S.misses + ' misses');
      say(name.split('（')[0] + '：' + S.misses + ' 次 miss', '');
      await beat(tok, 2000);
    }
    say('miss 次數：5 → 4 → 3', 'associativity 越高，conflict miss 越少');
    await beat(tok, 2800);
  }
  async function scLRU(tok) {
    const res = [];
    for (const repl of ['LRU', 'FIFO']) {
      fresh([0, 4.2, 14.5], [0, 3.4, 0]);
      const S = makeSim({ blocks: 4, ways: 2, bw: 1, bits: 4, repl, ytop: 5.4 });
      tag('2-way，替換策略：' + repl, 'ptr', -0.8, 7.3);
      if (res.length) tag(res[0], 'idx', -0.8, -0.6, 1.2);
      say(repl === 'LRU' ? 'LRU：換掉最久沒被用的' : 'FIFO：換掉最早放進來的', '存取 0, 8, 0, 6, 0（都對到 set 0）');
      await beat(tok, 2400);
      for (const a of [0, 8, 0, 6, 0]) {
        S.unglow();
        const r = await S.access(a, tok, 1.1);
        let f = '';
        if (a === 6) f = repl === 'LRU' ? '0 剛被用過，8 最久沒用 → 換 8' : '0 最早進來 → 換 0（即使剛用過）';
        say('block ' + a + '：' + (r.hit ? 'hit' : 'miss') + (r.victim !== null ? '，換掉 ' + r.victim : ''), f);
        await beat(tok, 1500);
      }
      res.push(repl + '：' + S.misses + ' misses');
      say(repl + '：' + S.misses + ' 次 miss', '');
      await beat(tok, 1800);
    }
    say('LRU 3 次 miss、FIFO 4 次', '2-way 的 LRU 每個 set 只要 1 個 bit');
    await beat(tok, 2600);
    say('way 多時 LRU 太貴，常用近似 LRU 或隨機', 'random 在高 associativity 時和 LRU 差不多');
    await beat(tok, 2800);
  }
  async function scTagBits(tok) {
    fresh([0, 3.5, 13.5], [0, 2.6, 0]);
    say('P&H 例：4096 個 block、4-word block、32-bit 位址', 'associativity 變大，tag 總 bits？');
    await beat(tok, 2800);
    const C = [['Direct-mapped', 12, 16, 1], ['2-way', 11, 17, 2], ['4-way', 10, 18, 4], ['Fully', 0, 28, 4096]];
    const bars = [];
    for (let k = 0; k < C.length; k++) {
      const [n, idx, tg] = C[k];
      const st = bitStrip(null, [{ n: 'tag', b: tg, c: FC.tag }, { n: 'index', b: idx, c: FC.index }, { n: 'offset', b: 4, c: FC.offset }], 5.6);
      const total = tg * 4096;
      const b = bar(FC.tag, 1.6, 1.2, -4.5 + k * 3); tag(n, 'idx', -4.5 + k * 3, 0, 1.2);
      await growBar(tok, b, total / 30000, 600);
      tag(total.toLocaleString(), 'ptr alt', -4.5 + k * 3, total / 30000 + 0.4);
      say(n + '：index ' + idx + '、tag ' + tg + ' bits', 'tag 總量 = ' + tg + ' × 4096 = ' + total.toLocaleString() + ' bits');
      await beat(tok, 2800);
      st.kill();
    }
    say('set 數每減半，index 少 1 bit、tag 多 1 bit', 'fully associative 沒有 index：28-bit tag');
    await beat(tok, 3000);
  }
  async function scMultilevel(tok) {
    fresh([0, 4.5, 14], [0, 3.4, 0]);
    say('P&H 例：4 GHz、base CPI 1.0、記憶體 100 ns', 'L1 每指令 miss rate 2%');
    await beat(tok, 2800);
    say('miss penalty = 100 ns ÷ 0.25 ns = 400 cycles', 'CPI = 1 + 2% × 400 = 9');
    const k = 0.62;
    const a0 = bar('#4b9ee2', 1.8, 1.4, -3), a1 = bar('#d64545', 1.8, 1.4, -3);
    tag('只有 L1', 'ptr', -3, 0, 1.5);
    await growBar(tok, a0, 1 * k, 400); await growBar(tok, a1, 8 * k, 900, 1 * k);
    tag('CPI 9', 'ptr alt', -3, 9 * k + 0.4);
    await beat(tok, 2200);
    say('加 L2：存取 5 ns = 20 cycles', '到記憶體的 global miss rate 降到 0.5%');
    await beat(tok, 2600);
    const b0 = bar('#4b9ee2', 1.8, 1.4, 3), b1 = bar('#dd8238', 1.8, 1.4, 3), b2 = bar('#d64545', 1.8, 1.4, 3);
    tag('L1 + L2', 'ptr', 3, 0, 1.5);
    await growBar(tok, b0, 1 * k, 400);
    say('L1 miss、L2 hit：2% × 20 = 0.4', '');
    await growBar(tok, b1, 0.4 * k, 600, 1 * k); await beat(tok, 1300);
    say('L2 也 miss：0.5% × 400 = 2.0', '');
    await growBar(tok, b2, 2 * k, 700, 1.4 * k); await beat(tok, 1300);
    tag('CPI 3.4', 'ptr alt', 3, 3.4 * k + 0.4);
    say('CPI = 1 + 0.4 + 2.0 = 3.4', '加 L2 快了 9.0 / 3.4 = 2.6 倍');
    await beat(tok, 3200);
    say('L1 求 hit time 小；L2 求 miss rate 低', 'L2 通常更大、block 更大、associativity 更高');
    await beat(tok, 3000);
  }
  async function sc3C(tok) {
    fresh([0, 4.2, 14.5], [0, 3.4, 0]);
    const S = makeSim({ blocks: 4, ways: 1, bw: 1, bits: 4, ytop: 5.4 });
    const shadowL = tag('同大小 fully-assoc（LRU）：—', 'idx', -0.8, -0.6, 1.2);
    const cnt = tag('', 'ptr alt', -0.8, 7.3);
    say('Miss 的三種來源：3C', '用 4-block direct-mapped 走一遍');
    await beat(tok, 2400);
    const seq = [0, 4, 0, 4, 1, 2, 3, 5, 0];
    for (const a of seq) {
      S.unglow();
      const r = await S.access(a, tok, 1.0);
      txt(shadowL, '同大小 fully-assoc（LRU）：' + S.shadow.join(', '));
      txt(cnt, 'compulsory ' + S.kinds.comp + ' · capacity ' + S.kinds.cap + ' · conflict ' + S.kinds.conf);
      const why = r.hit ? '' : r.kind === 'comp' ? '第一次碰到，一定 miss' : r.kind === 'conf' ? 'fully associative 會 hit，是撞位置' : '連 fully associative 也放不下';
      say('block ' + a + '：' + (r.hit ? 'hit' : KIND[r.kind]), why);
      await beat(tok, 1500);
    }
    say('cache 變大 → capacity ↓；associativity ↑ → conflict ↓', 'block 變大 → compulsory ↓');
    await beat(tok, 3200);
  }

  const scenes = {
    hierarchy: { title: '記憶體階層：越近越快、越小、越貴', play: scHierarchy },
    locality: { title: 'Temporal 與 Spatial locality：迴圈走訪陣列', play: scLocality },
    'hit-miss': { title: 'Hit、miss、hit rate、miss penalty', play: scHitMiss },
    'dm-mapping': { title: 'Direct-mapped：block address mod 8', play: scDMMapping },
    'dm-sequence': { title: 'P&H 例：22,26,22,26,16,3,16,18 的 hit/miss', play: scDMSequence },
    'addr-1200': { title: 'P&H 例：byte address 1200 → block 75 → index 11', play: scAddr1200 },
    'cache-bits': { title: 'P&H 例：16 KiB、4-word block 共 147 Kibit', play: scCacheBits },
    'block-size': { title: 'Block size 與 miss rate、miss penalty', play: scBlockSize },
    'miss-steps': { title: 'Instruction cache miss 的處理步驟', play: scMissSteps },
    'write-through': { title: 'Write-through 與 write buffer', play: scWriteThrough },
    'write-back': { title: 'Write-back、dirty bit、write allocate', play: scWriteBack },
    'cpi-stall': { title: 'P&H 例：CPI 2 → 5.44（I/D cache miss）', play: scCpiStall },
    amat: { title: 'AMAT = 1 + 0.05 × 20 = 2 cycles', play: scAmat },
    'assoc-spectrum': { title: '8 個 block：1-way、2-way、4-way、8-way', play: scAssocSpectrum },
    'block-12': { title: 'P&H 例：block 12 放在哪裡（三種組織）', play: scBlock12 },
    'assoc-058': { title: 'P&H 例：0,8,0,6,8 → 5、4、3 次 miss', play: scAssoc058 },
    lru: { title: 'LRU vs FIFO：0,8,0,6,0', play: scLRU },
    'tag-bits': { title: 'P&H 例：associativity 與 tag 總 bits', play: scTagBits },
    multilevel: { title: 'P&H 例：多層 cache，CPI 9 → 3.4', play: scMultilevel },
    'three-c': { title: '3C：compulsory、capacity、conflict', play: sc3C },
  };

  return {
    kicker: '計算機組織・第 5 章',
    title: '記憶體層次與 Cache',
    color: 'var(--ca)',
    modes: [
      { id: 'sim', name: '快取模擬器', enter: enterSim },
      { id: 'split', name: '位址切割', enter: enterSplit },
      { id: 'write', name: '寫入策略', enter: enterWrite },
      { id: 'amat', name: 'AMAT／CPI', enter: enterAmat },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['hierarchy', 'locality', 'hit-miss', 'dm-mapping', 'dm-sequence', 'addr-1200', 'cache-bits', 'block-size', 'miss-steps',
      'write-through', 'write-back', 'cpi-stall', 'amat', 'assoc-spectrum', 'block-12', 'assoc-058', 'lru', 'tag-bits', 'multilevel', 'three-c'],
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
