// 計算機組織 第5章：記憶體層次與 Cache（locality、direct-mapped / set-associative / fully-associative、
// tag/index/offset、LRU、write-through / write-back、AMAT、multi-level cache、3C）。
// 前段場景依 Patterson & Hennessy（MIPS 版）第 5 章的例題重現；黃婷婷 22A–24B 講與 AMAT 影片各有一組逐句同步的場景（mh-*，在檔案後段）。
import kit from './_kit.js';

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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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

  // ───────────────────────── 場景（依 P&H 第 5 章例題） ─────────────────────────
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
    // the block climbs along the right ends of the levels (its name just above it), never over a level's name
    const bx = (i) => LV[i][3] / 2 + 0.6;
    const blk = cube('block', '#e55a9b', [0.9, 0.5, 0.7], bx(3), 1.6, 1.0); blk.userData.lbl.position.y = 0.5;
    for (let i = 2; i >= 0; i--) { move(blk, bx(i), 6.1 - i * 1.5 + 0.1, 1.0); say('資料只在相鄰兩層之間搬，單位是 block', i ? '往上一層複製' : '到了 cache：之後 CPU 直接在這裡 hit'); await beat(tok, 1100); }
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
    say('實際要 18.4 KiB，約是 16 KiB 資料的 1.15 倍', 'tag 與 valid bit 是額外的成本');
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
    // the buffer is a FIFO: the memory always finishes the OLDEST store first, the rest move up one slot
    const q = [];
    const drawQ = () => buf.forEach((b, j) => { tint(b, j < q.length ? '#e55a9b' : '#efe6d6'); relabel(b, q[j] || ''); });
    for (let k = 0; k < 6; k++) {
      if (q.length < 4) { q.push('w' + (k + 1)); drawQ(); }
      say('store w' + (k + 1) + '：放進 buffer，CPU 不等', 'buffer：' + q.length + ' / 4');
      if (k % 2 === 1 && q.length) { await beat(tok, 500); const done = q.shift(); drawQ(); glow(m, GOLD); say('記憶體寫完最早的 ' + done + '，buffer 空出一格', 'FIFO：先進先出'); await beat(tok, 500); glow(m, null); }
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ mh.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 5 章（清大 黃婷婷 第 22A–24B 講 + AMAT 英文影片）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那句話（notes 的 cues，標在 // @秒數 ~關鍵字）才做一個短動作，不循環、不重播。
// 老師的例子照用（22,26,22,26,16,3,16,18；1200 → block 75 → 11；0,8,0,6,8；CPI 5.44；AMAT 2 ns；CPI 9 → 3.4；65/17/20 cycles…），
// 每個 hit/miss、位址切割、bit 數、AMAT/CPI 都由程式算（csim / 算式），畫面顯示 ✓；老師沒給數字、我們舉的例子標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ok = (b, t, x, y) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const mono = (l) => { Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' }); return l; };
const mt = (t, x, y, cls = '') => mono(tag(t, cls, x, y));
const bx = (t, c, x, y, z = 0, w = 2.2, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const NC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7', rose: '#f2c4c4', metal: '#8a94a6', off: '#efe6d6' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.cubes && typeof o.kill === 'function') return o.kill(); if (o.cells) return gone(o.cells.flat(), o.lbls); if (o.g) return kill(o.g); if (o.element) remove(o); else kill(o); });
const lk = (x1, y1, x2, y2, c = 0x6e5f49, z = 0.1) => arrow(V3(x1, y1, z), V3(x2, y2, z), c);
const seg = (x1, y1, x2, y2, c = '#8a7a5c', z = 0) => line(x1, y1, x2, y2, z, c);
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a growing column of lines: add() puts the next line under the last one
function list(x, yTop, dy = 0.55, cls = 'idx') {
  const ls = [];
  return { ls, add(t, c) { const l = tag(t, c || cls, x, yTop - ls.length * dy); ls.push(l); return l; }, kill() { ls.forEach(remove); ls.length = 0; } };
}
function vbar(c, x, h, w = 0.7, y0 = 0, d = 0.7) { const m = lab.box(c, [w, 1, d]); m.scale.y = Math.max(0.001, h); m.position.set(x, y0 + Math.max(0.001, h) / 2, 0); lab.world.add(m); return m; }
function setH(m, h, y0 = 0) { m.scale.y = Math.max(0.001, h); m.position.y = y0 + Math.max(0.001, h) / 2; }
async function growH(tok, m, h, y0 = 0, ms = 600) { const h0 = m.scale.y; await anim(tok, ms, (u) => setH(m, h0 + (h - h0) * u, y0)); }
const fx = (v, d = 2) => String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const near = (a, b) => Math.abs(a - b) < 1e-9;
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || [[0, 4.2, 14], [0, 3.0, 0]]; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// ── cache helpers ──
// pure LRU cache simulation on block addresses: sets × ways
function csim(seq, sets, ways) {
  const st = Array.from({ length: sets }, () => []);
  return seq.map((b, t) => {
    const s = b % sets, L = st[s], i = L.findIndex((e) => e.blk === b), tg = Math.floor(b / sets);
    if (i >= 0) { L[i].last = t; return { b, s, tg, hit: true, way: L[i].way, victim: null }; }
    let way, victim = null;
    if (L.length < ways) { way = L.length; L.push({ blk: b, last: t, way }); }
    else { let v = 0; L.forEach((e, k) => { if (e.last < L[v].last) v = k; }); victim = L[v].blk; way = L[v].way; L[v] = { blk: b, last: t, way }; }
    return { b, s, tg, hit: false, way, victim };
  });
}
// a cache table: rows × cols of flat cells; T.put(r, c, text, color), T.fl(r, c, glowColor)
function ctab(o) {
  const { rows, cols, x, y } = o; const cw = o.cw || 1.6, ch = o.ch || 0.5, gx = o.gx || 0.1, gy = o.gy || 0.12;
  const T = { cells: [], lbls: [], x, y, cw, ch };
  T.px = (c) => x + c * (cw + gx); T.py = (r) => y - r * (ch + gy);
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(bx(o.empty === undefined ? '—' : o.empty, NC.off, T.px(c), T.py(r), 0, cw, ch, 0.7));
    T.cells.push(row);
    if (o.rl) T.lbls.push(sm(o.rl(r), x - cw / 2 - (o.rlw || 0.75), T.py(r)));
  }
  if (o.hdr) o.hdr.forEach((h, c) => T.lbls.push(sm(h, T.px(c), y + ch / 2 + 0.3)));
  T.put = (r, c, t, col) => { relabel(T.cells[r][c], t); if (col) tint(T.cells[r][c], col); };
  T.fl = (r, c, g) => glow(T.cells[r][c], g || null);
  T.calm = () => T.cells.flat().forEach((m) => glow(m, null));
  return T;
}
// bitStrip with the label of a short last field (offset) lifted so it does not collide with its neighbour
const BS = (v, f, y) => { const st = bitStrip(v, f, y); const l = st.labels[st.labels.length - 1]; if (f[f.length - 1].b <= 4) l.position.y += 0.45; return st; };
const b2 = (v, n) => (n <= 0 ? '' : v.toString(2).padStart(n, '0'));

// ════════ p16QNdRJqMk（第 22A 講：Memory hierarchy、technology、locality、direct-mapped 入門） ════════
scene('mh-22a-outline', 'Memory 單元大綱：cache 與 virtual memory', [
  async (tok, S) => { // @17.3 ~那Memory這個部分
    hot('Memory 這個單元要介紹什麼？', 0, 6.6);
    cap('Memory 這部分要介紹什麼？', '先講一些簡單的概念');
  },
  async (tok, S) => { // @18.8 ~我們希望怎麼樣的Memory
    S.w = ['又快', '容量又大', '又便宜'].map((t, i) => note(t, -3 + i * 3, 5.8));
    cap('我們希望的 memory 系統', '又快、容量又大、又便宜');
  },
  async (tok, S) => { // @22.0 ~那在這個整個系統
    S.cpu = bx('Processor', NC.teal, -4.6, 3.8, 0, 2.0, 0.8); S.mem = bx('Memory', NC.tan, 0.6, 3.8, 0, 2.0, 0.8);
    S.c = bx('cache', NC.green, -2.0, 3.8, 0.2, 1.4, 0.7);
    sm('第一部分：memory 和 processor 之間加 cache', -1.6, 2.9);
    cap('第一部分：memory 和 processor 之間', '加一個叫 cache 的東西');
  },
  async (tok, S) => { // @51.6 ~那之後如果我要再更
    sm('再介紹怎麼 improve cache 的 performance', -1.6, 2.4);
    cap('先介紹簡單的 cache 怎麼運作', '再加入一些技巧 improve performance');
  },
  async (tok, S) => { // @58.8 ~那再過來呢另外一個
    S.d = bx('Disk（secondary）', NC.metal, 5.0, 3.8, 0, 2.4, 0.8);
    S.vm = hot('virtual memory', 2.9, 4.8); lk(1.7, 4.4, 3.8, 4.4);
    cap('另一個階層：memory 和 secondary memory 之間', '加 virtual memory，讓 memory 看起來更大');
  },
  async (tok, S) => { // @75.3 ~就是兩大塊
    good('兩大塊：① cache　② virtual memory', 0, 1.2);
    cap('基本上就是兩大塊', 'cache 和 virtual memory');
  },
]);

scene('mh-22a-ram', 'Random access、SRAM 與 DRAM 用在哪裡', [
  async (tok, S) => { // @83.0 ~那先來看一看
    hot('Memory technology：先看 access 的方式', 0, 6.6);
    cap('先看 memory 的 technology', '依 access 的狀況來分');
  },
  async (tok, S) => { // @90.8 ~random access
    S.cells = Array.from({ length: 8 }, (_, i) => bx('#' + i, NC.sky, -5.6 + i * 0.95, 5.5, 0, 0.85, 0.5, 0.7));
    S.t = S.cells.map((m, i) => sm('t', -5.6 + i * 0.95, 4.95));
    hd('random access：任何位置，時間都一樣', -2.3, 4.4);
    cap('random access', '不管 access 哪一個位置，時間都一樣');
  },
  async (tok, S) => { // @102.5 ~那對應另外一個
    S.disk = prop('disk', 4.0, 4.6, 0, 1.6);
    S.head = hot('read/write head', 4.0, 5.95);
    cap('另一種：location 不同，access 時間就不同', '');
  },
  async (tok, S) => { // @109.4 ~譬如說disk
    await slide(tok, S.head, 5.2, 5.95, 0, 700); await slide(tok, S.head, 3.0, 5.95, 0, 700);
    sm('head 要先移到位置，才開始讀 data', 4.0, 3.9);
    cap('譬如 magnetic disk', 'read/write head 要先移動，才開始 transfer data');
  },
  async (tok, S) => { // @133.4 ~disk 那這個當然這個是主要
    note('disk：主要當 secondary memory', 4.0, 3.3);
    cap('magnetic disk 主要用在', 'secondary memory');
  },
  async (tok, S) => { // @137.5 ~random access 又分為
    S.sr = bx('SRAM（static RAM）', NC.green, -4.4, 2.6, 0, 3.0, 0.6); S.dr = bx('DRAM（dynamic RAM）', NC.blue, -0.6, 2.6, 0, 3.0, 0.6);
    cap('random access 又分兩種', 'SRAM（static）和 DRAM（dynamic）');
  },
  async (tok, S) => { // @147.6 ~它主要是用在哪裡
    lk(-4.4, 2.2, -4.4, 1.5); S.cache = bx('cache', NC.green, -4.4, 1.1, 0, 2.0, 0.55);
    cap('SRAM 主要用在 cache', '在 processor 和 main memory 之間');
  },
  async (tok, S) => { // @167.7 ~知道memory是要花很多時間
    bad('memory：要幾十～幾百個 cycle', 0.4, -0.3);
    cap('memory 要花很多時間', '可能要幾十、幾百個 clock cycle');
  },
  async (tok, S) => { // @180.8 ~所以中間就有一個cache
    good('cache：跟 CPU 同步，1 個 cycle', -4.4, 0.4);
    cap('所以中間有一個 cache', '它的讀寫時間跟 CPU 的 cycle 一樣快');
  },
  async (tok, S) => { // @197.5 ~那我們在講的平常講的memory
    lk(-0.6, 2.2, -0.6, 1.5); bx('main memory', NC.blue, -0.6, 1.1, 0, 2.2, 0.55);
    cap('平常講的 memory（main memory）', '主要是用 DRAM 做的');
  },
  async (tok, S) => { // @210.3 ~其實就是用dram做成
    S.cpu = bx('CPU', NC.teal, 3.0, 1.1, 0, 1.2, 0.55);
    lk(2.3, 1.1, -3.3, 1.1, 0x2fc092, 0.6);
    sm('先找 cache；在 cache 裡就不用去 memory 拿', 1.6, -0.9);
    cap('真正 access 時先經過 cache', '東西在 cache 裡，就不用去 memory 拿');
  },
]);

scene('mh-22a-sramdram', 'SRAM 與 DRAM 的 technology', [
  async (tok, S) => { // @231.6 ~S-RAN 是 low density
    hd('SRAM', -3.6, 6.6); hd('DRAM', 3.4, 6.6);
    S.sl = ['low density', 'high power', 'expensive', 'fast'].map((t, i) => sm(t, -3.6, 6.0 - i * 0.45));
    cap('SRAM：low density、high power', 'expensive，但是 fast');
  },
  async (tok, S) => { // @236.9 ~cross-couple
    S.i1 = bx('NOT', NC.lilac, -4.4, 3.4, 0, 1.0, 0.6); S.i2 = bx('NOT', NC.lilac, -2.8, 3.4, 0, 1.0, 0.6);
    lk(-3.9, 3.7, -3.3, 3.7); lk(-3.3, 3.1, -3.9, 3.1);
    sm('cross-coupled（像 latch）：output 拉回 input', -3.6, 2.5);
    cap('SRAM 用 cross-coupled 的 gate 做', '很像 logic design 的 latch：output 拉回 input');
  },
  async (tok, S) => { // @261.9 ~transistor 把它做出來但它比較快
    S.f = good('快：跟 logic 一樣隨製程 scale down', -3.6, 1.9);
    cap('用比較多 transistor 做', '但它跟 logic 一樣的製程，所以很快');
  },
  async (tok, S) => { // @283.8 ~high power
    sm('一直有電在 transistor 間開關 → high power', -3.6, 1.4);
    cap('high power consumption', '');
  },
  async (tok, S) => { // @290.6 ~所以它的density就比較low
    bad('一個 bit 要多個 transistor → 容量小、貴', -3.6, 0.9);
    cap('一個 bit 要比較多 transistor', 'density 低：容量小又貴，不能整個 memory 都用它');
  },
  async (tok, S) => { // @310.3 ~那為什麼叫Static
    sm('static：有 power 就一直保持 1 或 0', -3.0, 0.4);
    cap('為什麼叫 static？', '只要有 power，值就一直維持');
  },
  async (tok, S) => { // @348.2 ~那這個DRAM呢它是用一個
    S.tr = bx('1 transistor', NC.metal, 2.4, 3.9, 0, 1.6, 0.5); S.cp = vbar(NC.blue, 4.4, 1.0, 0.7, 3.4);
    S.cpL = sm('capacitor（電容）', 4.4, 3.1); seg(3.2, 3.9, 4.05, 3.9);
    cap('DRAM 用一個 capacitor（電容）', '一個 transistor 就能存一個 bit');
  },
  async (tok, S) => { // @362.2 ~那電容呢你把它charge
    await growH(tok, S.cp, 0.25, 3.4, 1500);
    bad('電荷慢慢 decay（流掉）', 3.4, 2.6);
    cap('電容 charge 之後', '隨時間慢慢 decay，所以要 refresh');
  },
  async (tok, S) => { // @400.6 ~就一個幾個minisecond
    await growH(tok, S.cp, 1.0, 3.4, 500);
    good('refresh：每幾個 ms 讀出再寫回', 3.4, 2.1);
    sm('cycle 是 ns，要很多 cycle 才 refresh 一次', 3.4, 1.6);
    cap('每幾個 millisecond refresh 一次', 'sense 出值，再寫回去');
  },
  async (tok, S) => { // @419.2 ~Dynamic RAM 這是相對應
    S.dl = ['high density', 'low power', 'cheap'].map((t, i) => sm(t, 3.4, 6.0 - i * 0.45));
    cap('一個 transistor 一個 bit', 'DRAM：high density、low power、比較便宜');
  },
  async (tok, S) => { // @438.3 ~它比較便宜但它當然就是
    S.dl.push(bad('slow', 3.4, 4.65));
    sm('讀：微弱訊號 → sense amplifier 放大 → 慢', 3.4, 1.1);
    cap('但是 DRAM 慢', '要先讀出很小的訊號，再用 sense amplifier 放大');
  },
]);

scene('mh-22a-dramarray', 'DRAM 像 2-D 矩陣：row address、column address', [
  async (tok, S) => { // @454.1 ~那SRAM就跟我們一般
    S.sa = bx('SRAM', NC.green, -5.0, 6.2, 0, 1.6, 0.5); lk(-4.1, 6.2, -3.2, 6.2); sm('給 address → 拿到 content', -1.6, 6.2);
    cap('SRAM 很直覺', '給一個 address，就找到它的 content');
  },
  async (tok, S) => { // @471.1 ~DRAM呢它是這樣子
    S.g = []; for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 8; c++) row.push(bx('', NC.sky, -3.2 + c * 0.62, 4.9 - r * 0.55, 0, 0.55, 0.45, 0.5)); S.g.push(row); }
    sm('DRAM：bit 排成 2-dimension 的 array（示意 6 × 8）', -1.0, 1.4);
    cap('DRAM 像一個 2-dimension 的 matrix', '每個 entry 存一個 bit');
  },
  async (tok, S) => { // @500.1 ~地址的那也就是說你有一個Role
    S.rl = hot('row address', -5.4, 3.8); S.cl = hot('column address', 0, 5.7);
    cap('所以有一個 row address', '和一個 column address，才 access 到那個 data');
  },
  async (tok, S) => { // @527.0 ~要去把Address分成兩個部分
    S.ad = bx('row 一半 | column 一半', NC.gold, 3.9, 3.6, 0, 3.0, 0.55); sm('address 拆成兩半', 3.9, 3.0);
    cap('把 address 分成兩個部分', '一半 row address、一半 column address');
  },
  async (tok, S) => { // @535.8 ~先用roll address
    S.g[2].forEach((m) => glow(m, HL)); S.buf = bx('row buffer', NC.mint, -1.0, 0.7, 0, 5.0, 0.45);
    for (const m of S.g[2]) tint(m, NC.orange);
    sm('整個 row activate，全部讀到 buffer', 3.9, 0.7);
    cap('先用 row address', '把整個 row activate，資料全部讀到 buffer');
  },
  async (tok, S) => { // @543.1 ~然後再用column address去
    S.g[2].forEach((m) => glow(m, null)); glow(S.g[2][5], OKG); tint(S.g[2][5], NC.green);
    S.pick = hot('column 選出這一個 bit', -0.1, 2.6);
    cap('再用 column address', 'select 你要的那個 data');
  },
  async (tok, S) => { // @574.8 ~所以這主要是用在Main Memory
    note('DRAM → main memory', 3.9, 5.6);
    cap('這種結構主要用在 main memory', '');
  },
]);

scene('mh-22a-cost', '2008 年：存取時間與價錢，以及我們想要的 memory', [
  async (tok, S) => { // @574.8 ~然後再看一下他們的這個價錢
    hot('2008 年的 technology（P&H 表）', 0, 6.7);
    ['technology', 'access time', '$ per GB'].forEach((h, i) => hd(h, -4.2 + i * 4.0, 6.0));
    S.row = (i, a) => { const y = 5.3 - i * 0.7; return a.map((t, k) => sm(t, -4.2 + k * 4.0, y)); };
    cap('看一下 access 時間和價錢', '2008 年的資料，給大家一個概念');
  },
  async (tok, S) => { // @582.7 ~SRAN你是在narrow
    S.r0 = S.row(0, ['SRAM', '0.5–2.5 ns', '']);
    cap('SRAM：幾個 ns 之內就能 access', '大約一個 clock cycle 完成');
  },
  async (tok, S) => { // @600.0 ~如果你放在DRAN
    S.r1 = S.row(1, ['DRAM', '50–70 ns', '']);
    ok(50 / 0.5 === 100, 'DRAM 約慢 100 倍 → 約 100 個 cycle ✓', 0, 3.0);
    cap('放在 DRAM 要慢好幾十倍', '可能要 100 個 cycle 才能 access');
  },
  async (tok, S) => { // @613.5 ~那如果你是放在這個 magnetic
    S.r2 = S.row(2, ['magnetic disk', '5–20 ms', '']);
    sm('5 ms = 5,000,000 ns：百萬倍等級（secondary）', 0, 2.5);
    cap('magnetic disk 更遠', '要幾百萬倍的時間，是 secondary memory');
  },
  async (tok, S) => { // @629.6 ~SRAM的話它的一個Gigabit
    S.p0 = sm('$2000–5000', 3.8, 5.3);
    cap('價錢：SRAM 每 GB', '要 2000 到 5000 美金');
  },
  async (tok, S) => { // @629.6 ~這個是20到
    S.p1 = sm('$20–75', 3.8, 4.6);
    cap('DRAM 每 GB', '20 到 75 美金，差非常多');
  },
  async (tok, S) => { // @639.4 ~magnetic disk 更便宜
    S.p2 = sm('$0.20–2', 3.8, 3.9);
    cap('magnetic disk 更便宜', '每 GB 約 0.2 到 2 美金');
  },
  async (tok, S) => { // @657.0 ~那我們到底用哪一種
    hot('要用哪一種 technology 做 memory 系統？', 0, 1.8);
    cap('這麼多不同的 technology', '到底用哪一種來 implement memory 系統？');
  },
  async (tok, S) => { // @696.0 ~但是我又有很大的容量
    S.want = ['access 很快', '容量很大', '很便宜'].map((t, i) => note(t, -3.5 + i * 3.5, 1.1));
    cap('貪心一點：希望 access 很快', '容量又大、又便宜');
  },
  async (tok, S) => { // @703.8 ~那哪一個可以達到
    bad('單獨一種都做不到', 0, 0.4);
    cap('這三種 technology', '單獨一個都達不到目的');
  },
  async (tok, S) => { // @711.2 ~這三個全部合在一起
    good('三種合在一起，規劃成階層 → 做得到', 0, -0.2);
    cap('把三種結合起來，規劃成階層', '就能又快、又便宜、容量又大');
  },
  async (tok, S) => { // @730.5 ~我希望X的碳像SRAM
    S.want.forEach((l) => remove(l));
    note('access time 像 SRAM', -2.6, 1.1); note('capacity、cost 像 disk', 2.6, 1.1);
    cap('目標：access time 像 SRAM', 'capacity 和 cost 像 disk');
  },
]);

scene('mh-22a-gap', 'Processor–DRAM gap 與 memory hierarchy', [
  async (tok, S) => { // @738.1 ~那再看一下這個 processor 跟
    S.ch = [seg(-6.6, 0.3, -0.6, 0.3), sm('年份 →（示意）', -3.6, -0.2)];
    const pv = [0.3, 0.6, 1.1, 1.9, 3.0, 4.3];
    S.pb = pv.map((h, i) => vbar(NC.teal, -6.1 + i * 1.0, h, 0.38, 0.3));
    S.ch.push(hd('processor', -4.8, 5.4));
    cap('processor 跟 DRAM 的差距', 'Moore\'s law：logic 越來越快');
  },
  async (tok, S) => { // @759.2 ~越來越快可是 DRAM
    const dv = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55];
    S.db = dv.map((h, i) => vbar(NC.blue, -5.7 + i * 1.0, h, 0.38, 0.3));
    S.ch.push(sm('DRAM：capacitor 製程，不像 logic 一樣快', -3.6, 6.1));
    cap('DRAM 是另一種製程', '用 capacitor 存資料，速度沒有跟著一直變快');
  },
  async (tok, S) => { // @782.3 ~所以它在過去
    S.ch.push(lk(-0.9, 1.0, -0.9, 4.5, 0xd64545), bad('memory gap 越來越大', -1.2, 5.0));
    cap('所以 memory 跟 processor 的 gap', '越來越大');
  },
  async (tok, S) => { // @796.3 ~如果是在memory 你要去做store
    S.cpu = buddy('CPU', '等…', NC.teal, 3.4, 4.6, 0, 0.9); S.cpu.mood('sad');
    sm('load/store 要等 memory → processor 停下來', 3.4, 4.1);
    cap('一做 load/store 就要等 memory', 'processor 再快也沒用');
  },
  async (tok, S) => { // @816.5 ~gap的越來越嚴重所以cache
    good('所以 cache 很重要', 3.4, 3.5);
    cap('gap 越嚴重', 'cache 就越重要');
  },
  async (tok, S) => { // @824.1 ~建立一個memory hierarchy
    gone(S.pb, S.db, S.ch); S.cpu.g.position.set(5.6, 5.4, 0);
    S.lv = [['cache（SRAM）', NC.green, 2.0], ['main memory（DRAM）', NC.blue, 4.0], ['disk', NC.metal, 6.0]].map(([t, c, w], i) => bx(t, c, -2.0, 4.6 - i * 1.0, 0, w, 0.8));
    hot('Memory hierarchy', -2.0, 6.0);
    cap('solution：建立 memory hierarchy', '不同 technology 一層一層排');
  },
  async (tok, S) => { // @829.7 ~越靠近我們的Processor
    lk(-6.4, 2.4, -6.4, 4.8); sm('越快、越貴', -6.0, 5.2);
    cap('越靠近 processor', 'technology 越貴、速度越快、容量越小');
  },
  async (tok, S) => { // @847.2 ~我說我的Cash 我可以用這個
    S.big = bx('超大 cache？', NC.green, -2.0, 1.2, 0, 5.0, 0.6);
    cap('如果我願意花很多錢', '把 cache 做得很大很大，可以嗎？');
  },
  async (tok, S) => { // @867.7 ~我們不是講嗎什麼
    tint(S.big, NC.rose); S.sf = bad('small is fast：做大就變慢', -2.0, 0.4);
    cap('不行：small is fast', '就算願意花錢，做大它就變慢');
  },
  async (tok, S) => { // @898.6 ~地方它是比較小
    gone(S.big, S.sf); lk(2.6, 4.8, 2.6, 2.4); sm('越大、越慢、越便宜', 4.0, 2.0);
    cap('越靠近 processor：小、快、貴', '越往下：容量大、慢、便宜');
  },
  async (tok, S) => { // @907.7 ~那他們之間就有一些機制
    lk(-1.0, 3.2, -1.0, 4.2, 0xe55a9b, 0.6); lk(-3.0, 4.2, -3.0, 3.2, 0xe55a9b, 0.6);
    note('上下層之間要有搬資料的機制', -2.0, 0.6);
    cap('data 沒辦法全部放在上層', '上下兩層之間要有一些機制');
  },
]);

scene('mh-22a-levels', 'Upper level、lower level 與 block', [
  async (tok, S) => { // @977.0 ~我們介紹我們在這邊
    S.c = bx('cache', NC.green, -4.5, 5.4, 0, 2.0, 0.7); S.m = bx('memory', NC.blue, -1.0, 5.4, 0, 2.0, 0.7); S.d = bx('disk', NC.metal, 2.5, 5.4, 0, 2.0, 0.7);
    sm('① cache ↔ memory', -2.8, 6.25); sm('② memory ↔ disk（virtual memory）', 2.2, 6.75);
    cap('這裡要介紹兩對', 'cache 跟 memory；memory 跟 secondary（virtual memory）');
  },
  async (tok, S) => { // @999.9 ~如果就這樣講的話
    hot('upper level：靠近 processor', -4.0, 4.3); hot('lower level：遠離 processor', 2.0, 4.3);
    cap('每一對都有 upper level、lower level', '靠近 processor 叫 upper，遠離叫 lower');
  },
  async (tok, S) => { // @1027.0 ~所以我們把upper level
    sm('cache 那一對：memory 是 lower', -2.8, 3.6); sm('virtual memory 那一對：memory 是 upper', 1.0, 3.2);
    cap('同一個 memory 角色會變', '在 cache 那層是 lower；在 virtual memory 是 upper');
  },
  async (tok, S) => { // @1045.2 ~好那因為它中間都要
    sm('upper 小、lower 大 → 不可能全放 upper', 0, 2.5);
    cap('upper level 比較小、lower level 比較大', '不可能把東西全部擺在 upper level');
  },
  async (tok, S) => { // @1067.6 ~所以我們要define
    S.bk = bx('block', NC.pink, -1.0, 1.5, 0.3, 1.2, 0.5); await slide(tok, S.bk, -4.5, 1.5, 0.3, 800);
    cap('上下搬資料要定一個固定大小', '不能一下搬一個、一下搬兩個，太亂');
  },
  async (tok, S) => { // @1079.1 ~你希望一個fixed data size
    hot('最小的搬動單位：block', -2.8, 0.7);
    cap('這個 minimum unit of information', '在 cache 和 memory 之間叫 block');
  },
  async (tok, S) => { // @1090.9 ~在virtual memory裡面
    hot('virtual memory：page', 1.8, 0.7);
    cap('在 virtual memory 裡', '叫做 page');
  },
  async (tok, S) => { // @1111.2 ~或者部分要就全部
    note('要搬就整個 block 一起搬', 0, -0.1);
    cap('要就全部搬進來，要就全部搬出去', '不能一次搬一兩個 byte');
  },
]);

scene('mh-22a-locality', 'Principle of locality：90/10 rule', [
  async (tok, S) => { // @1135.8 ~然後lower level的是比較大
    hot('上層小快、下層大慢：這樣會 work 嗎？', 0, 6.6);
    cap('上面小又快、下面大又慢', '這樣的 memory 會有效嗎？');
  },
  async (tok, S) => { // @1154.3 ~principle of locality
    hd('principle of locality', 0, 5.9);
    sm('任何時刻，program 只 access address space 的一小部分', 0, 5.35);
    cap('會！因為 principle of locality', '任何時間只 access 一小部分的 address');
  },
  async (tok, S) => { // @1169.5 ~為什麼會work
    S.code = Array.from({ length: 10 }, (_, i) => bx('', i === 6 ? NC.orange : NC.off, -5.0 + i * 1.1, 4.4, 0, 1.0, 0.5));
    good('90% 的時間在跑那 10% 的 code', 0, 3.6);
    cap('90/10 rule', '90% 的時間都在 run 那 10% 的 code');
  },
  async (tok, S) => { // @1216.2 ~我在上課也一直
    sm('例：寫了 100 行，一直在做的只有一小段', 0, 3.0);
    cap('程式寫了 100 行', '真正一直在做的只有一點點');
  },
  async (tok, S) => { // @1223.6 ~還是會一直什麼有一些
    S.f = bx('function / subroutine', NC.lilac, -3.6, 2.2, 0, 3.2, 0.55);
    cap('哪裡會一直做？', 'function、subroutine 會一直被呼叫');
  },
  async (tok, S) => { // @1265.4 ~什麼一讀來就Statement
    S.st = bx('statement：做一次就走', NC.off, 0.6, 2.2, 0, 3.0, 0.55);
    cap('一般 statement', '執行一次就走了');
  },
  async (tok, S) => { // @1274.0 ~還有一個什麼 If then Else
    S.ife = bx('if-then-else：只走一邊', NC.off, 0.6, 1.5, 0, 3.0, 0.55);
    cap('if-then-else', '只執行其中一邊');
  },
  async (tok, S) => { // @1287.2 ~怎麼寫就If then Else 然後再來
    S.lp = bx('loop：一直重複', NC.orange, -3.6, 1.5, 0, 3.2, 0.55);
    lk(-1.9, 1.2, -1.9, 1.8, 0xdd8238, 0.6);
    cap('loop！', '很小一段 program，卻執行 90% 的時間');
  },
  async (tok, S) => { // @1339.3 ~好這principle locality
    S.cache = bx('cache', NC.green, 4.6, 4.4, 0, 1.6, 0.6);
    const g = bx('10%', NC.orange, -5.0 + 6 * 1.1, 4.4, 0.5, 1.0, 0.5); await slide(tok, g, 4.6, 3.7, 0.6, 800); // lands just under the cache box (its name stays readable)
    cap('只要把那 10% 搬進最靠近的地方', '放在 cache，大部分時間都找得到');
  },
  async (tok, S) => { // @1361.7 ~它用到時候再搬進來
    note('用到才搬進來；不用就搬出去', 0, 0.6);
    cap('其他 90% 用到時再搬進來', '不需要就趕快搬出去');
  },
]);

scene('mh-22a-temporal', 'Temporal 與 spatial locality 的定義', [
  async (tok, S) => { // @1369.5 ~主要就是這個概念它說
    hd('temporal locality（時間）', -3.4, 6.6); hd('spatial locality（空間）', 3.4, 6.6);
    cap('locality 又分兩種', 'temporal（時間上）和 spatial（空間上）');
  },
  async (tok, S) => { // @1386.5 ~那什麼叫temporal locality
    S.tA = [0, 1, 2, 3, 4].map((k) => bx(k % 2 ? 'x' : 'x', k % 2 ? NC.orange : NC.orange, -5.4 + k * 1.0, 5.6, 0, 0.8, 0.5));
    sm('同一個 item 很快又被用（示意）', -3.4, 5.0);
    cap('temporal：一個 item 被 reference', '很快又會被 reference 一次');
  },
  async (tok, S) => { // @1396.7 ~那spatial locality
    S.sA = [0, 1, 2, 3, 4].map((k) => bx('a+' + k, NC.blue, 1.6 + k * 1.0, 5.6, 0, 0.9, 0.5));
    sm('用了這個，隔壁很快也會用（示意）', 3.4, 5.0);
    cap('spatial：一個位置被 reference', '它隔壁、後面的很快也會被 reference');
  },
]);

scene('mh-22a-examples', 'Locality 的例子：loop、array、sequential instruction', [
  async (tok, S) => { // @1569.3 ~Loop啊對不對
    hd('temporal locality', -3.4, 6.6); hd('spatial locality', 3.4, 6.6);
    S.lp = code(['loop:', '  instr 1', '  instr 2', '  beq … loop'], -5.6, 4.1);
    S.lp.hl(1); sm('loop 的 instruction fetch 完又要 fetch', -3.4, 1.6);
    cap('temporal 的例子：loop', 'loop 裡的 instruction 剛 fetch 完，馬上又要 fetch');
  },
  async (tok, S) => { // @1584.5 ~放在Memory 還是你要
    S.lp.hl(3); good('→ 放在 cache 留著，不要動', -3.4, 1.0);
    cap('所以它要放在 cache', '馬上又要 reference，就留在那邊');
  },
  async (tok, S) => { // @1596.4 ~再來看 spatial的locality
    hot('spatial 的例子？', 3.4, 4.1);
    cap('再看 spatial locality', 'access 這個之後，隔壁馬上被 access');
  },
  async (tok, S) => { // @1619.4 ~access它什麼 array
    S.arr = [0, 1, 2, 3].map((k) => bx('A[' + k + ']', NC.sky, 1.8 + k * 1.15, 3.3, 0, 1.05, 0.5));
    for (let k = 0; k < 4; k++) { glow(S.arr[k], HL); await wt(tok, 300); glow(S.arr[k], null); }
    cap('array！', '第一個 element、第二個、第三個…依序 access');
  },
  async (tok, S) => { // @1659.2 ~link list
    S.ll = [[1.9, 2.4], [5.2, 2.0], [3.0, 1.6]].map(([x, y], k) => bx('node', NC.rose, x, y, 0, 0.9, 0.4));
    lk(2.4, 2.4, 4.7, 2.1); lk(4.7, 1.9, 3.5, 1.6);
    bad('linked list：位址跳來跳去，不算', 3.6, 1.0);
    cap('linked list 呢？', 'pointer 跳來跳去，在 memory 裡位置不連續，很麻煩');
  },
  async (tok, S) => { // @1688.5 ~這個隱藏群完就這個
    good('program：PC = PC + 4，指令依序 fetch', 3.4, 0.3);
    cap('program 本身也是', 'instruction 是 sequential 的：PC = PC + 4');
  },
  async (tok, S) => { // @1712.3 ~群fetch 它也是一種
    note('有 locality，memory hierarchy 才會 work', 0, -0.4);
    cap('memory hierarchy 會 work', '就是因為有 principle of locality');
  },
]);

scene('mh-22a-who', '各層：register、cache、memory、disk，誰來管', [
  async (tok, S) => { // @1772.0 ~我們的Level Memory Hierarchy
    S.L = [['registers', NC.purple, 1.6], ['cache（on-chip）', NC.green, 2.6], ['main memory（DRAM）', NC.blue, 3.6], ['disk', NC.metal, 4.6]].map(([t, c, w], i) => bx(t, c, -3.4, 6.0 - i * 1.25, 0, w, 0.7));
    S.L.forEach((m, i) => { if (i) m.visible = false; });
    cap('memory hierarchy 的層級', '最上面其實 register 也是存東西的');
  },
  async (tok, S) => { // @1786.6 ~它就像我們例子就32個register
    sm('32 個 register，很快', -0.6, 6.0);
    cap('最靠近 processor', '例如 32 個 register，很快');
  },
  async (tok, S) => { // @1793.8 ~其實就是memory了
    S.L[2].visible = true; sm('single-cycle 時好像直接存 memory', -0.6, 3.5);
    cap('下一層其實就是 memory', 'single-cycle implementation 好像只有一個 memory');
  },
  async (tok, S) => { // @1808.8 ~可是那個太慢了
    bad('直接用 memory 太慢：可能要 100 個 cycle', 3.2, 3.0);
    cap('可是那太慢了', '每次 load/store 可能要 100 個 cycle');
  },
  async (tok, S) => { // @1814.1 ~你每次要去露嗦
    S.L[1].visible = true; S.chip = hot('cache 和 processor 在同一顆 chip（on-chip）', 1.6, 4.75);
    cap('所以中間加 cache', 'cache 跟 processor 在一起');
  },
  async (tok, S) => { // @1859.0 ~所以memory有沒有跟CPU在一起
    bad('memory 是 off-chip：要出 chip，更慢', 2.0, 2.4);
    cap('memory 跟 CPU 不在同一顆 chip', '是 off-chip，access 要出去所以更慢');
  },
  async (tok, S) => { // @1888.1 ~cache坐在CPU
    sm('打開 processor：很大一塊都是 cache', 1.6, 4.25);
    cap('cache 坐在 CPU 裡面', 'processor 的照片裡好大一塊都是 cache');
  },
  async (tok, S) => { // @1916.5 ~結構那再來那Disk
    S.L[3].visible = true;
    cap('再下來是 disk', '又是另一個 module');
  },
  async (tok, S) => { // @1926.7 ~是這個 instruction的operant
    hot('register ↔ memory：compiler（或寫 assembly 的人）', 2.6, 5.4);
    cap('register 和 memory 之間誰決定？', 'compiler 把 variable assign 到 register；寫 assembly 就自己決定');
  },
  async (tok, S) => { // @1956.1 ~那Cache跟Memory之間呢還有
    hot('cache ↔ memory：cache controller（hardware）', 2.6, 1.6);
    cap('cache 和 memory 之間', 'cache controller，hardware 在做');
  },
  async (tok, S) => { // @1969.8 ~再來Memory跟Disk之間有這個Page
    hot('memory ↔ disk：page，OS（software + 少量 hardware）', 1.6, 0.9);
    cap('memory 和 disk 之間搬 page', '主要是 OS（software），加一些 hardware 協助');
  },
  async (tok, S) => { // @2007.2 ~當然user在那邊決定
    sm('file：user 決定要讀哪個檔', 1.6, 0.3);
    cap('file system', 'user 決定要讀寫哪個檔');
  },
]);

scene('mh-22a-terms', 'Hit、hit rate、hit time、miss rate、miss penalty', [
  async (tok, S) => { // @2054.8 ~有一些Terminology
    S.up = bx('upper level', NC.green, -3.4, 4.8, 0, 2.6, 1.6); S.lo = bx('lower level', NC.blue, 2.6, 4.8, 0, 3.4, 2.2);
    S.cpu = bx('CPU', NC.teal, -6.2, 4.8, 0, 1.0, 0.7);
    S.up.userData.lbl.position.y = 0.55; S.lo.userData.lbl.position.y = 0.8; // level names at the top: blocks sit below them
    cap('一些 terminology 要記', 'hit、hit time、miss rate、miss penalty');
  },
  async (tok, S) => { // @2080.7 ~因為東西不一定
    S.x = bx('X', NC.pink, 2.6, 4.45, 1.2, 0.6, 0.5);
    cap('東西不一定全部都在 upper level', '');
  },
  async (tok, S) => { // @2083.5 ~當你要去找它可能
    bad('不在 upper → miss', 2.6, 3.2);
    cap('要找的不在 upper level', '就叫 miss');
  },
  async (tok, S) => { // @2089.3 ~那如果在那邊就是Hit
    S.y = bx('Y', NC.green, -4.0, 4.45, 1.0, 0.6, 0.5); good('在 upper → hit', -3.4, 3.2);
    cap('在那邊就是 hit', '');
  },
  async (tok, S) => { // @2091.4 ~我們說有一個hit rate
    hd('hit rate = 在 upper level 找到的比例', -1.0, 2.4);
    cap('hit rate', 'access upper level 時，有多少百分比找得到');
  },
  async (tok, S) => { // @2104.4 ~那hit time呢就是說
    hd('hit time = access upper 的時間 + 判斷 hit/miss 的時間', -1.0, 1.8);
    cap('hit time 包括兩個時間', 'access upper level 的時間 + 判斷是 hit 還是 miss 的時間');
  },
  async (tok, S) => { // @2140.5 ~我就是個miss 那miss rate
    hd('miss rate = 1 − hit rate', -1.0, 1.2);
    cap('miss rate', '= 1 − hit rate');
  },
  async (tok, S) => { // @2146.7 ~包括它整個是叫包括replace
    hd('miss penalty = 換掉 upper 的 block + 把 block 送給 processor', -1.0, 0.6);
    await slide(tok, S.x, -2.75, 4.45, 1.2, 900);
    cap('miss penalty 包括', 'replace upper level 的 block，再把 block 送到 processor 的時間');
  },
  async (tok, S) => { // @2179.3 ~Lentency
    sm('lower level 的 latency + transfer（off-chip → on-chip）', -1.0, 0.0);
    cap('要從 lower level 拿：有 latency', '還有 off-chip 搬到 on-chip 的 transfer 時間');
  },
  async (tok, S) => { // @2199.2 ~所以這個這個基本名詞知道嗎
    note('hit time ≪ miss penalty', 3.6, 6.4);
    cap('hit time 遠遠小於 miss penalty', '這些名詞後面一直會用到');
  },
]);

scene('mh-22a-4q', 'Memory hierarchy 的四個問題', [
  async (tok, S) => { // @2224.2 ~好那在後面我們要介紹
    hot('cache 與 virtual memory 都要回答的四個問題', 0, 6.6);
    cap('在不同 level（cache、virtual memory）', '都會問同樣的問題');
  },
  async (tok, S) => { // @2241.4 ~我們的固定單位是一個block
    S.q1 = hd('① block placement：放在哪？', -3.4, 5.6);
    cap('固定單位是一個 block', '上面比較小，搬上來要放在哪裡？');
  },
  async (tok, S) => { // @2265.3 ~不是一個人一個位置
    S.seats = Array.from({ length: 10 }, (_, i) => bx('', NC.green, -4.8 + i * 1.05, 4.4, 0, 0.9, 0.45));
    sm('上面 10 個位置、下面 100 個人（示意）', 1.6, 3.8);
    cap('下面可能 100 個人', '上面只有 10 個位置');
  },
  async (tok, S) => { // @2287.1 ~那可能一個位置要10個人
    S.q2 = hd('② block identification：怎麼找？', -3.4, 3.0);
    cap('一個位置可能 10 個人要搶', '那要怎麼找到你的 block？');
  },
  async (tok, S) => { // @2293.7 ~再來因為上面的位置少
    S.q3 = hd('③ block replacement：滿了換誰？', -3.4, 2.3);
    cap('只有 10 個位置，第 11 個人要上來', '總有一個人要出去');
  },
  async (tok, S) => { // @2310.0 ~placement 還有right
    S.q4 = hd('④ write strategy：兩份 copy 要不要一致？', -3.4, 1.6);
    cap('write strategy 也很重要', 'upper、lower 各有一份 copy，要不要隨時一致？');
  },
  async (tok, S) => { // @2337.1 ~read沒問題
    good('read：不改內容，沒問題', 2.4, 1.0); bad('write：改了 state，才有問題', 2.4, 0.4);
    cap('read 沒問題', 'write 會改變 state，才有一致性的問題');
  },
  async (tok, S) => { // @2357.6 ~介紹的 Cache的這個
    note('把四個問題回答完，就全懂了', -1.0, -0.3);
    cap('cache、virtual memory 都有這四個問題', '回答完就全懂了');
  },
]);

scene('mh-22a-summary', '整理：locality 與兩種 technology', [
  async (tok, S) => { // @2365.0 ~我們把這個Memory Hierarchy
    hot('Memory hierarchy 小結', 0, 6.6);
    cap('summarize 一下', '兩種 locality 是哪兩種？');
  },
  async (tok, S) => { // @2392.6 ~那temporal的locality
    hd('temporal：loop', -3.4, 5.7);
    cap('temporal locality 的例子', 'loop');
  },
  async (tok, S) => { // @2397.6 ~array data access
    hd('spatial：array、sequential 的 program', 3.0, 5.7);
    cap('spatial locality 的例子', 'array 的 data access，還有 sequential 執行的 program');
  },
  async (tok, S) => { // @2412.8 ~所以principal locality
    note('90% 的時間 access 10% 的 program', 0, 4.8);
    cap('principle of locality', '90% 的時間都在 access 10% 的 program');
  },
  async (tok, S) => { // @2423.6 ~using the principal
    bx('常用：放最近（小、快、貴）', NC.green, -3.0, 3.6, 0, 4.4, 0.6); bx('不常用：放遠（大、慢、便宜）', NC.blue, -3.0, 2.7, 0, 5.4, 0.6);
    cap('常常用的放最靠近的地方', '不常用的放遠一點，整體最快');
  },
  async (tok, S) => { // @2452.2 ~那兩種type的
    sm('DRAM：慢、便宜、dense → big memory', 3.4, 2.7); sm('SRAM：fast、expensive、不 dense → 快', 3.4, 3.6);
    cap('兩種 technology', 'DRAM 慢但便宜 dense；SRAM 快但貴');
  },
]);

// 8 個 cache block、32 個 memory block：memory 排成 4 列 × 8 欄，第 c 欄的 block 都對到 cache 的第 c 格
function dmGrid(S, y0 = 5.6) {
  S.cx = (i) => -5.25 + i * 1.5;
  S.cache = Array.from({ length: 8 }, (_, i) => bx(String(i), NC.green, S.cx(i), y0, 0, 1.35, 0.5, 0.7));
  S.cacheL = sm('upper level（cache）：8 個 block', 0, y0 + 0.6);
  S.mem = []; for (let b = 0; b < 32; b++) S.mem.push(bx(String(b), NC.off, S.cx(b % 8), y0 - 1.9 - Math.floor(b / 8) * 0.62, 0, 1.35, 0.48, 0.7));
  S.memL = sm('lower level（memory）：32 個 block', 0, y0 - 4.65);
}
scene('mh-22a-direct', 'Direct-mapped：block address mod 8', [
  async (tok, S) => { // @2491.9 ~看Cache了
    S.top = [bx('Processor', NC.teal, -4.0, 6.3, 0, 1.8, 0.55), bx('cache', NC.green, -1.4, 6.3, 0, 1.4, 0.55), bx('memory', NC.blue, 1.6, 6.3, 0, 1.8, 0.55)];
    cap('來看 cache', 'memory 和 processor 之間加一個 cache');
  },
  async (tok, S) => { // @2516.9 ~register直接到memory
    S.t1 = bad('memory 很慢：約 100 個 cycle', 2.5, 5.6); S.t2 = good('cache on-chip，跟 CPU 在一起', -2.6, 5.6);
    cap('register 直接到 memory 要 100 個 cycle', '所以中間加 cache，建在 CPU 裡');
  },
  async (tok, S) => { // @2546.1 ~把哪些重要的東西放上來
    S.t3 = hot('怎麼 place？怎麼 identify？', 4.8, 6.3);
    cap('重要的東西怎麼放上來？', '怎麼 place、怎麼 identify（找到它）');
  },
  async (tok, S) => { // @2561.9 ~一個它的概念就是告訴我
    S.t4 = sm('memory 依序編號，但 access 是東一個西一個', 0, 4.9);
    cap('memory 的位址是 0、1、2、3… 依序', '可是 access 不一定照順序');
  },
  async (tok, S) => { // @2601.0 ~最簡單的第一種cache
    S.t5 = hot('最簡單：direct-mapped cache', 0, 4.3);
    cap('最簡單的第一種擺法', '叫 direct-mapped cache');
  },
  async (tok, S) => { // @2618.6 ~比如以這個例子來講
    gone(S.top, S.t1, S.t2, S.t3, S.t4, S.t5); dmGrid(S);
    cap('例子：upper level 8 個 block', 'lower level 32 個');
  },
  async (tok, S) => { // @2636.3 ~那我任何一個block
    note('這裡假設 1 個 block = 1 個 byte', 4.6, 6.6);
    cap('進出都以 block 為單位', '最簡單：假設一個 block 就是一個 byte');
  },
  async (tok, S) => { // @2650.1 ~DirectMap告訴我最簡單
    S.cache.forEach((m, i) => glow(m, HL));
    cap('cache 的 8 個位置', '編號 0、1、2…7');
  },
  async (tok, S) => { // @2678.4 ~在lower level的時候
    S.cache.forEach((m) => glow(m, null));
    for (let r = 0; r < 4; r++) { S.mem.slice(r * 8, r * 8 + 8).forEach((m) => glow(m, HL)); await wt(tok, 350); S.mem.slice(r * 8, r * 8 + 8).forEach((m) => glow(m, null)); }
    cap('lower level 照次序分配位置', '0 到 7，再從 0 到 7，一輪一輪');
  },
  async (tok, S) => { // @2702.5 ~再來零一二三四就這樣
    for (const b of [1, 9, 17, 25]) tint(S.mem[b], NC.orange); for (const b of [5, 13, 21, 29]) tint(S.mem[b], NC.gray);
    tint(S.cache[1], NC.orange); tint(S.cache[5], NC.dark);
    cap('同一欄的 block 都搶同一個位置', '橘紅色的都到橘紅色那格，灰色的到灰色那格');
  },
  async (tok, S) => { // @2742.6 ~位置其實就是把我的地址
    S.f = hot('cache 位置 = (block address) mod 8', 0, 0.4);
    cap('給一個地址，怎麼知道到哪格？', 'lower level 的地址除以 8，取餘數');
  },
  async (tok, S) => { // @2753.5 ~然後取它的餘數就可以了
    ok(101 % 100 === 1, 'modulo 就是取餘數：101 mod 100 = 1 ✓', 0, -0.15);
    cap('modulo 就是取餘數', '101 mod 100 = 1');
  },
  async (tok, S) => { // @2784.0 ~這個八個block
    S.cache.forEach((m, i) => relabel(m, b2(i, 3))); S.mem.forEach((m, b) => relabel(m, b2(b, 5)));
    cap('用 binary 看', 'cache 的地址是 000、001、010…；memory 是 5 bits');
  },
  async (tok, S) => { // @2794.1 ~譬如你這橘紅色來講
    [1, 9, 17, 25].forEach((b) => glow(S.mem[b], HL)); glow(S.cache[1], HL);
    ok([1, 9, 17, 25].every((b) => (b & 7) === 1 && b % 8 === 1), '00001、01001、10001、11001：後 3 bits 都是 001 = 餘數 ✓', 0, -0.7);
    cap('橘紅色：除以 8 的餘數', '就是最後 3 個 bit：001');
  },
  async (tok, S) => { // @2824.9 ~了就是它的餘數所以你看這邊
    [1, 9, 17, 25].forEach((b) => glow(S.mem[b], null)); glow(S.cache[1], null);
    [5, 13, 21, 29].forEach((b) => glow(S.mem[b], HL)); glow(S.cache[5], HL);
    ok([5, 13, 21, 29].every((b) => b % 8 === 5 && b2(b, 5).endsWith('101')), '灰色：後 3 bits 都是 101 ✓', 0, -1.25);
    cap('灰色也一樣', '後面都是 101');
  },
  async (tok, S) => { // @2842.4 ~餘數modular 就會得到upper
    note('8 個 block → index = 位址最低 3 bits', 0, -1.8);
    cap('lower level 地址除以 upper 的 block 數取餘數', '用 binary 看，就是最後 3 bits：index');
  },
]);

// ════════ 4q1UMEuDvpM（第 22B 講：block 20、tag/valid、22,26,…,18、位址切割、block size、read/write） ════════
scene('mh-22b-block20', 'Block 20 對到 cache 的哪一格？', [
  async (tok, S) => { // @20.54 ~high的low level的假有32個
    dmGrid(S);
    cap('lower level 32 個 block（0–31）', 'upper level 8 個 block（0–7）');
  },
  async (tok, S) => { // @22.95 ~7有8個block那第20個block
    glow(S.mem[20], HL); tint(S.mem[20], NC.pink); S.q = hot('第 20 個 block 會 map 到哪裡？', 0, -0.2);
    cap('問題：第 20 個 block', '會 map 到 cache 的哪裡？');
  },
  async (tok, S) => { // @68.48 ~先告訴我20要除以多少
    S.d = sm('除以 upper level 的 block 數：8', -3.6, -0.8);
    cap('20 要除以多少？', '除以 8（upper level 有 8 個 block）');
  },
  async (tok, S) => { // @70.61 ~餘數是多少
    ok(20 % 8 === 4, '20 mod 8 = 4 ✓', 2.6, -0.8);
    lk(S.cx(4), 2.9, S.cx(4), 5.2, 0xe55a9b, 0.6); glow(S.cache[4], HL); tint(S.cache[4], NC.pink);
    cap('20 ÷ 8 餘數是 4', '所以放到第 4 格');
  },
  async (tok, S) => { // @80.38 ~第0個bar
    S.z = sm('從 0 開始數：0、1、2、3、4 → 第 4 格是第 5 個位置', 0, 6.85);
    cap('因為從 0 開始編號', '第 4 格就是第 5 個 block 位置');
  },
  async (tok, S) => { // @92.74 ~20的那個binary是什麼
    S.mem.forEach((m, b) => relabel(m, b2(b, 5))); S.cache.forEach((m, i) => relabel(m, b2(i, 3)));
    ok(b2(20, 5) === '10100', '20 = 16 + 4 = 10100 ✓', 2.6, -1.35);
    cap('20 的 binary 是什麼？', '16 + 4 → 10100');
  },
  async (tok, S) => { // @140.14 ~好那4的binary是什麼
    ok(b2(4, 3) === '100', '4 = 100 ✓', -3.6, -1.35);
    cap('4 的 binary', '是 100');
  },
  async (tok, S) => { // @151.66 ~我就知道說因為這個只有8個block
    ok(b2(20, 5).slice(-3) === b2(20 % 8, 3), '10100 的最後 3 bits = 100 = 餘數 ✓', 0, -1.9);
    cap('只有 8 個 block，只要 3 個 bit', '取 10100 最後 3 bits：100，就是餘數');
  },
  async (tok, S) => { // @169.72 ~就是說Direct Map的話呢
    gone(S.q); hot('direct-mapped：位置 = block number mod（upper level 的 block 數）', 0, -0.2);
    cap('direct-mapped：upper level 有幾個 block 就當除數', 'lower level 的 block number 去除，餘數就是位置');
  },
  async (tok, S) => { // @198.66 ~其實你不用真的去除
    gone(S.z); note('binary：直接取最後 3 bits 當 index', 0, 6.85);
    cap('binary 來看，不用真的除', '直接取最後 3 bits 當 index，去 index upper level');
  },
]);

scene('mh-22b-tag', 'Tag 與 valid bit：怎麼知道格子裡是誰', [
  async (tok, S) => { // @213.94 ~這就是direct map 那direct map
    dmGrid(S); for (const b of [1, 9, 17, 25]) tint(S.mem[b], NC.orange); tint(S.cache[1], NC.orange);
    S.mem.forEach((m, b) => relabel(m, b2(b, 5))); S.cache.forEach((m, i) => relabel(m, b2(i, 3)));
    cap('橘紅色有 4 個 block', '都要 map 到 cache 同一個位置');
  },
  async (tok, S) => { // @231.0 ~去那我怎麼去假如你要去找它
    glow(S.cache[1], HL); S.q = hot('用 index 001 找到這格…', 0, -0.2);
    cap('要找某個 block 時', '用 index 很快找到那一格');
  },
  async (tok, S) => { // @279.6 ~那我怎麼知道一個particular
    S.q2 = hot('但裡面放的是不是我？', 0, -0.8);
    cap('可是那格裡放的', '到底是不是我要的 block？');
  },
  async (tok, S) => { // @303.9 ~那我如果擺到其中的一個
    for (const b of [1, 9, 17, 25]) glow(S.mem[b], HL);
    cap('4 個橘紅色都可能在那格', '要怎麼分辨是哪一個？');
  },
  async (tok, S) => { // @324.4 ~也就是說我要把它的地址也要
    S.a = bad('除了 data，還要把 address 也存進去', 0, -1.4);
    cap('所以除了 data', '也要把它的地址擺進去');
  },
  async (tok, S) => { // @365.8 ~可是我需不需要把全部的地址
    S.q3 = hot('整個地址都要存嗎？', 4.6, 6.6);
    cap('需要把整個地址都存嗎？', '');
  },
  async (tok, S) => { // @386.0 ~它不一樣就在前面的部分
    gone(S.q, S.q2, S.a, S.q3); for (const b of [1, 9, 17, 25]) glow(S.mem[b], null);
    ok([1, 9, 17, 25].every((b) => b % 8 === 1), '後 3 bits 都是 001：位置本身就代表了（implied）✓', 0, -0.2);
    cap('不用！後 3 bits 都一樣', '它落在這格，就表示後面是 001');
  },
  async (tok, S) => { // @423.3 ~就叫我們的tag
    [1, 9, 17, 25].forEach((b) => { relabel(S.mem[b], b2(b, 5).slice(0, 2) + '|' + b2(b, 5).slice(2)); });
    ok([1, 9, 17, 25].map((b) => b2(Math.floor(b / 8), 2)).join(',') === '00,01,10,11', '不同在前 2 bits：00、01、10、11 → 這叫 tag ✓', 0, -0.8);
    cap('不一樣的是前面的 high-order bits', '把它存起來，就叫 tag');
  },
  async (tok, S) => { // @499.8 ~cash有你的data 還有什麼
    note('cache 每格存：tag + data', 0, -1.4);
    cap('cache 裡要存兩樣東西', 'data 和 tag');
  },
  async (tok, S) => { // @551.5 ~memory在裡面我怎麼知道它是真的
    S.cache.forEach((m) => { relabel(m, '?? 亂碼'); glow(m, null); tint(m, NC.gray); });
    cap('一開始 cache 裡也有亂七八糟的 0101', '怎麼知道是真的 data 還是垃圾？');
  },
  async (tok, S) => { // @565.8 ~多一個bit 叫做validbit
    S.cache.forEach((m) => relabel(m, 'V=0'));
    hot('valid bit：一開始全部設 0（invalid）', 0, 6.85);
    cap('多一個 bit：valid bit', '一開始全部設成 0，表示都不是 valid 的');
  },
  async (tok, S) => { // @585.1 ~慢慢讀進來之後
    relabel(S.cache[1], 'V=1 tag 10'); tint(S.cache[1], NC.orange);
    cap('真的把資料讀進來後', '才把 valid 設成 1');
  },
]);

// cache 表：index / V / tag / data，n 列
function vtTable(S, n = 8, y0 = 6.0, dy = 0.62) {
  S.ry = (r) => y0 - r * dy;
  hd('index', -6.2, y0 + 0.65); hd('V', -5.0, y0 + 0.65); hd('tag', -3.95, y0 + 0.65); hd('data', -1.9, y0 + 0.65);
  S.V = []; S.T = []; S.D = [];
  for (let r = 0; r < n; r++) {
    sm(b2(r, Math.round(Math.log2(n))), -6.2, S.ry(r));
    S.V.push(bx('N', NC.off, -5.0, S.ry(r), 0, 0.7, 0.48, 0.7)); S.T.push(bx('', NC.off, -3.95, S.ry(r), 0, 1.0, 0.48, 0.7)); S.D.push(bx('', NC.off, -1.9, S.ry(r), 0, 2.7, 0.48, 0.7));
  }
}
const SEQ22 = [22, 26, 22, 26, 16, 3, 16, 18];
scene('mh-22b-seq', 'P&H 例：22, 26, 22, 26, 16, 3, 16, 18 的 hit / miss', [
  async (tok, S) => { // @607.28 ~這邊做一個例子
    vtTable(S); S.R = csim(SEQ22, 8, 1); S.k = 0; S.h = 0; S.m = 0;
    S.seq = SEQ22.map((a, k) => sm(String(a), 1.4 + k * 0.72, 6.6));
    S.cur = hot(' ', 3.9, 5.7); S.st = hd('hit 0 · miss 0', 3.9, 0.3);
    S.acc = async (tok2) => {
      const r = S.R[S.k], a = SEQ22[S.k], row = a % 8;
      S.seq.forEach((l, j) => { l.element.className = 'lab-label ' + (j === S.k ? 'ptr alt' : 'idx'); });
      txt(S.cur, a + ' = ' + b2(a >> 3, 2) + ' ' + b2(row, 3) + '（tag | index）');
      [S.V, S.T, S.D].forEach((c) => c.forEach((m) => glow(m, null)));
      glow(S.V[row], HL); glow(S.T[row], HL); await wt(tok2, 400);
      if (r.hit) { S.h++; glow(S.D[row], OKG); }
      else { S.m++; relabel(S.V[row], 'Y'); tint(S.V[row], NC.green); relabel(S.T[row], b2(r.tg, 2)); tint(S.T[row], NC.lilac); relabel(S.D[row], 'Mem[' + b2(a, 5) + ']'); tint(S.D[row], NC.sky); glow(S.D[row], NG); }
      (r.hit ? good : bad)(a + ' → ' + b2(row, 3) + '：' + (r.hit ? 'hit' : 'miss') + (r.victim !== null ? '（換掉 ' + r.victim + '）' : ''), 3.9, 5.0 - S.k * 0.55);
      txt(S.st, 'hit ' + S.h + ' · miss ' + S.m); S.k++; return r;
    };
    cap('例子：8 個 block 的 direct-mapped cache', '一開始全部 invalid（V = N）');
  },
  async (tok, S) => { // @631.6 ~tag 八個block 所以它的index是
    note('index 3 bits、tag 2 bits（5-bit word address）', -3.0, 0.9);
    cap('8 個 block，index 是 3 bits', 'address 是 word address：5 bits');
  },
  async (tok, S) => { // @645.6 ~那用這個22
    S.seq.forEach((l, j) => { l.element.className = 'lab-label ' + (j === 0 ? 'ptr alt' : 'idx'); });
    txt(S.cur, '22 = 10 110（tag | index）'); glow(S.V[6], HL); glow(S.T[6], HL);
    cap('第一個：22 = 10110', '後 3 bits 110 當 index');
  },
  async (tok, S) => { // @655.02 ~沒有剛才沒有人在裡面
    const r = await S.acc(tok); ok(!r.hit && r.tg === 2, 'V = N → miss；存 V=Y、tag 10、data ✓', -3.4, 0.35);
    cap('110 裡沒有人（V = N）→ miss', '設 valid、存 tag 10，把 memory 資料存進來');
  },
  async (tok, S) => { // @684.74 ~我又再來讀個26
    await S.acc(tok);
    cap('再讀 26 = 11010', '010 也沒人用 → miss，tag 11 存進去');
  },
  async (tok, S) => { // @708.56 ~但是這個兩個都是miss
    sm('一開始空的：前兩個一定 miss', 3.9, -0.3);
    cap('這兩個都是 miss', '資料本來都不在 cache 裡');
  },
  async (tok, S) => { // @720.78 ~要讀22
    await S.acc(tok);
    cap('再讀 22：110 已經有 data', 'tag 也一樣（10）→ hit');
  },
  async (tok, S) => { // @737.88 ~這是hit catch it 再來看010
    await S.acc(tok);
    cap('再看 26：010', 'tag 11 一樣 → hit');
  },
  async (tok, S) => { // @750.32 ~好再來三筆資料
    S.seq.slice(4, 7).forEach((l) => { l.element.className = 'lab-label ptr'; });
    cap('再讀三筆', '16、3、16');
  },
  async (tok, S) => { // @755.46 ~第一筆資料他說16
    await S.acc(tok);
    cap('16 = 10000 → index 000', '000 原本沒資料 → miss，放進去');
  },
  async (tok, S) => { // @775.76 ~因為在access 3
    await S.acc(tok);
    cap('3 = 00011 → index 011', '沒資料 → miss，讀進去');
  },
  async (tok, S) => { // @794.86 ~裡面沒有data 再過來在10
    await S.acc(tok);
    cap('再讀 16 → 000', '有 data 且 tag 10 一樣 → hit');
  },
  async (tok, S) => { // @805.5 ~寫進去的意思再來再來
    const a = 18, row = a % 8;
    S.seq.forEach((l, j) => { l.element.className = 'lab-label ' + (j === 7 ? 'ptr alt' : 'idx'); });
    txt(S.cur, '18 = 10 010（tag | index）'); [S.V, S.T, S.D].forEach((c) => c.forEach((m) => glow(m, null))); glow(S.T[row], HL);
    ok(Math.floor(26 / 8) === 3 && Math.floor(18 / 8) === 2, '010 裡是 tag 11（26），我是 tag 10 → 不一樣 ✓', 3.9, -0.9);
    cap('最後 18 = 10010 → 010', '裡面有 data，但 tag 是 11，我是 10');
  },
  async (tok, S) => { // @838.68 ~那就表示什麼
    const r = await S.acc(tok); ok(!r.hit && r.victim === 26, '→ miss，26 被 replace，18 進來 ✓', 3.9, -1.45);
    cap('tag 不一樣 → cache miss', '原來的 26 被 replace，把 18 寫進來');
  },
  async (tok, S) => { // @854.8 ~好這是一個非常簡單的例子
    const hs = S.R.map((r) => (r.hit ? 'H' : 'M')).join('');
    ok(hs === 'MMHHMMHM' && S.h === 3 && S.m === 5, '8 次存取：hit 3、miss 5 ✓', -3.4, -0.25);
    cap('用 index（low-order bits）找到那格', '不是有 data 就是你的：要 check tag');
  },
  async (tok, S) => { // @881.6 ~Replace 所以Replacement的機制
    note('replacement：直接蓋過去（dirty 要先寫回）', -3.0, -0.85);
    cap('replacement 很簡單：直接蓋過去', '如果被寫過（dirty），要先寫回 memory');
  },
]);

// 32-bit byte address 的切割條：fields 由左到右（tag、index、offset…）
function strip(S, val, fields, y = 4.6) { if (S.bs) S.bs.kill(); S.bs = BS(val, fields, y); return S.bs; }
scene('mh-22b-split', '32-bit 位址：tag | index | byte offset', [
  async (tok, S) => { // @909.94 ~這個有一點看看要算一算囉
    hot('真的 cache：一個 block 不只一個 byte', 0, 6.7);
    cap('實際上一個 block 不只一個 byte', '可能好多個 byte');
  },
  async (tok, S) => { // @922.7 ~我們不同的例子來看
    strip(S, null, [{ n: 'block address', b: 30, c: FC.index }, { n: 'byte offset', b: 2, c: FC.offset }]);
    cap('例子：一個 block = 一個 word = 4 個 byte', '最後 2 bits 是 byte offset');
  },
  async (tok, S) => { // @944.96 ~是byte裡面的地址好這後面兩個
    S.bs.cubes.slice(30).forEach((m) => glow(m, HL));
    sm('00、01、10、11：word 裡的第幾個 byte', 3.4, 3.4);
    cap('後面兩個 bit', '決定 access 這個 word 的第幾個 byte');
  },
  async (tok, S) => { // @958.3 ~他說我講到這個cache裡面呢是有
    ok(1024 === Math.pow(2, 10), '1K = 1024 = 2¹⁰ 個 word → 10 bits ✓', -3.0, 2.6);
    cap('cache 有 1K 個 word', '1K = 2¹⁰，所以要 10 個 bit');
  },
  async (tok, S) => { // @988 ~所以10個bit 如果你給我一個地址
    strip(S, null, [{ n: 'tag', b: 20, c: FC.tag }, { n: 'index', b: 10, c: FC.index }, { n: 'off', b: 2, c: FC.offset }]);
    S.bs.cubes.slice(20, 30).forEach((m) => glow(m, HL));
    cap('這 10 個 bit 決定 index', '是 low-order 的部分，但要先扣掉 byte offset');
  },
  async (tok, S) => { // @1012.3 ~假如我告訴你說一個block
    S.q = hot('如果一個 block 是 2 個 word，後面要留幾個 bit？', 0, 1.9);
    cap('如果一個 block 是 2 個 word', '後面要留幾個 bit？');
  },
  async (tok, S) => { // @1101.7 ~我們這現在要討論的問題
    gone(S.q); S.q = hot('給一個 address：tag、index、offset 各多大？', 0, 1.9);
    cap('要回答的問題', '給一個 address，tag、index、byte offset 各多大？');
  },
  async (tok, S) => { // @1117.76 ~先講這個例子是很簡單的例子
    strip(S, null, [{ n: 'tag', b: 20, c: FC.tag }, { n: 'index', b: 10, c: FC.index }, { n: 'off', b: 2, c: FC.offset }]);
    S.bs.cubes.slice(30).forEach((m) => glow(m, HL));
    ok(Math.log2(4) === 2, '32-bit address、block = 4 bytes → offset log₂4 = 2 ✓', 0, 1.3);
    cap('32-bit address，一個 block 4 個 byte', 'offset 只要留 2 個 bit');
  },
  async (tok, S) => { // @1135.14 ~index的block要怎麼看呢
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(20, 30).forEach((m) => glow(m, HL));
    ok(Math.log2(1024) === 10, '1024 個 block → index log₂1024 = 10 ✓', 0, 0.7);
    cap('cache 有 1024 個 block = 2¹⁰', 'index 要 10 個 bit');
  },
  async (tok, S) => { // @1157.74 ~好那現在你32個bit
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 20).forEach((m) => glow(m, HL));
    ok(32 - 10 - 2 === 20, 'tag = 32 − 10 − 2 = 20 bits ✓', 0, 0.1);
    cap('32 個 bit 用掉 2 + 10', '剩下 20 bits 當 tag');
  },
  async (tok, S) => { // @1300.3 ~所以我先問你問題假如同樣的
    gone(S.q); S.q = hot('同樣 1024 個 block，block 改成 8 個 byte？', 0, 1.9);
    strip(S, null, [{ n: 'tag', b: 19, c: FC.tag }, { n: 'index', b: 10, c: FC.index }, { n: 'off', b: 3, c: FC.offset }]);
    S.bs.cubes.slice(29).forEach((m) => glow(m, HL));
    cap('如果一個 block 是 8 個 byte', 'offset 要留 log₂8 = 3 個 bit');
  },
  async (tok, S) => { // @1330.66 ~如果這樣狀況之下呢那請問你tag
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 19).forEach((m) => glow(m, HL));
    ok(32 - 10 - 3 === 19, 'block 8 bytes：tag = 32 − 10 − 3 = 19 bits ✓', 0, -0.5);
    cap('還是 1024 個 block（index 10）', 'tag 就剩 19 bits');
  },
  async (tok, S) => { // @1416.64 ~這個cache呢會根據你的不同的
    note('index 跟 cache 有幾個 block 有關；剩下的才是 tag', 0, -1.1);
    cap('cache 的結構不同', 'tag 的 bit 數就不同');
  },
  async (tok, S) => { // @1436.02 ~如果這個你就
    strip(S, null, [{ n: 'tag', b: 20, c: FC.tag }, { n: 'index', b: 10, c: FC.index }, { n: 'off', b: 2, c: FC.offset }]);
    ok(1 + 20 + 32 === 53, '每格 = valid 1 + tag 20 + data 32 = 53 bits ✓', 0, -1.7);
    cap('回到 1024 個 word：index 10、tag 20', '再加一個 valid bit，就是每格要的大小');
  },
]);

scene('mh-22b-1200', 'P&H 例：64 blocks × 16 bytes，address 1200 → block 75 → 11', [
  async (tok, S) => { // @1448.74 ~這麼大好我們再看
    hot('64 個 block，每個 block 16 bytes', 0, 6.7);
    S.bs = BS(null, [{ n: 'tag', b: 22, c: FC.tag }, { n: 'index', b: 6, c: FC.index }, { n: 'offset', b: 4, c: FC.offset }], 4.6);
    cap('再變化：64 個 block', '每個 block 16 個 byte，cache 怎麼分配？');
  },
  async (tok, S) => { // @1480.5 ~瞭解嗎你看我們來看看
    S.bs.cubes.slice(28).forEach((m) => glow(m, HL));
    ok(Math.log2(16) === 4, '16 bytes = 2⁴ → offset 4 bits ✓', -3.4, 3.4);
    cap('16 個 byte = 2⁴', 'offset 用掉 4 個 bit');
  },
  async (tok, S) => { // @1497.4 ~那它有幾個block
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(22, 28).forEach((m) => glow(m, HL));
    ok(Math.log2(64) === 6, '64 = 2⁶ → index 6 bits ✓', 2.8, 3.4);
    cap('cache 有 64 個 block = 2⁶', 'index 6 個 bit');
  },
  async (tok, S) => { // @1516.8 ~剩下的就是它的tag
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 22).forEach((m) => glow(m, HL));
    ok(32 - 6 - 4 === 22, 'tag = 32 − 10 = 22 bits ✓', -3.4, 2.8);
    cap('32 減掉 10', '剩下 22 bits 是 tag');
  },
  async (tok, S) => { // @1539.0 ~會不會好會了再問你說好
    S.bs.cubes.forEach((m) => glow(m, null));
    S.q = hot('memory address = 1200，map 到哪個 cache block？', 0, 1.9);
    cap('再問：address 1200', 'map 到 cache 的哪一個 block？');
  },
  async (tok, S) => { // @1570.2 ~我的地址假如是1200的話
    ok(Math.floor(1200 / 16) === 75, '1200 是 byte address：⌊1200 / 16⌋ = 75 → block 75 ✓', 0, 1.3);
    cap('1200 是第幾個 block？', '每個 block 16 byte → 除以 16 = 75');
  },
  async (tok, S) => { // @1604.3 ~對不對 我要先把它看它是到底
    sm('memory address 是 byte address → 先換成 block address', 0, 0.75);
    cap('memory address 是 byte address', '要先換成 block address');
  },
  async (tok, S) => { // @1635.6 ~得到了這個block address
    ok(75 % 64 === 11, '75 mod 64 = 11 → cache 第 11 個 block ✓', 0, 0.15);
    cap('cache 有 64 個 block', '75 mod 64 = 11，放第 11 個位置');
  },
  async (tok, S) => { // @1656.0 ~好 那如果我們用binary來看這個同樣
    gone(S.bs, S.q); S.bs = BS(1200, [{ n: 'tag', b: 22, c: FC.tag }, { n: 'index', b: 6, c: FC.index }, { n: 'offset', b: 4, c: FC.offset }], 4.6);
    ok(b2(1200, 12) === '010010110000', '1200 = 0100 1011 0000 ✓', 0, 1.9);
    cap('用 binary 來看', '1200 寫成 32 個 bit');
  },
  async (tok, S) => { // @1662.3 ~寫成這樣 那因為是16個byte
    S.bs.cubes.slice(28).forEach((m) => glow(m, HL));
    cap('16 byte 一個 block', '最後 4 個 bit 是 block offset，不看它');
  },
  async (tok, S) => { // @1681.3 ~就是它的就是它的block address
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 28).forEach((m) => glow(m, HL));
    ok((1200 >> 4) === 75 && b2(75, 7) === '1001011', '前面 28 bits = 1001011 = 75 = block address ✓', 0, -0.45);
    cap('前面的就是 block address', '也就是 75');
  },
  async (tok, S) => { // @1692.8 ~只要取6個bit
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(22, 28).forEach((m) => glow(m, HL));
    ok(b2((1200 >> 4) & 63, 6) === '001011' && ((1200 >> 4) & 63) === 11, '取 block address 的後 6 bits：001011 = 11 = 餘數 ✓', 0, -1.05);
    cap('再除以 64：只取後面 6 bits', '001011 = 11，就是 index');
  },
]);

const BSZ = [16, 32, 64, 128, 256];
const BCURVE = { '4K': [8.6, 7.2, 6.7, 7.7, 10.0], '16K': [4.0, 2.9, 2.4, 2.5, 3.0], '64K': [2.4, 1.6, 1.2, 1.1, 1.1], '256K': [1.5, 1.0, 0.7, 0.6, 0.55] };
// miss rate vs block size（示意，趨勢同 P&H）
function bsGraph(S, x0 = -1.0, y0 = 0.4) {
  seg(x0 - 0.3, y0, x0 + 5.6, y0); seg(x0 - 0.3, y0, x0 - 0.3, y0 + 5.2);
  BSZ.forEach((b, i) => sm(String(b), x0 + i * 1.3, y0 - 0.35)); sm('block size（bytes）', x0 + 2.6, y0 - 0.8);
  sm('miss rate（示意）', x0 - 0.2, y0 + 5.5);
  S.cur = {};
  Object.keys(BCURVE).forEach((k, j) => {
    const col = [NC.red, NC.orange, NC.blue, NC.green][j];
    S.cur[k] = BCURVE[k].map((v, i) => { const m = bx('', col, x0 + i * 1.3, y0 + v * 0.48, 0.1 * j, 0.22, 0.22, 0.22); m.visible = false; return m; });
    S.cur[k].lbl = sm(k, x0 + 5.9, y0 + BCURVE[k][4] * 0.48 + (j === 3 ? -0.15 : 0.15)); S.cur[k].lbl.visible = false;
  });
  S.show = (k) => { S.cur[k].forEach((m) => { m.visible = true; }); S.cur[k].lbl.visible = true; };
}
scene('mh-22b-blocksize', 'Block size 的取捨', [
  async (tok, S) => { // @1828.2 ~有這個問題好那剛剛不是講到
    S.bA = bx('1 byte', NC.pink, -5.4, 6.2, 0, 0.6, 0.45); S.bB = bx('16 bytes', NC.pink, -3.0, 6.2, 0, 2.8, 0.45);
    sm('block size 是自己定義的', -4.2, 6.8);
    cap('block size 是可以定義的', '剛剛假設 1 byte，後來又假設 16 byte');
  },
  async (tok, S) => { // @1842.4 ~那block size跟我們的cash的表現
    hot('block size 跟 cache 表現有關係嗎？', -3.6, 5.5);
    cap('block size 跟 cache 的表現', '有沒有關係？');
  },
  async (tok, S) => { // @1852.5 ~其實你沒有辦法看到它的locality
    bad('太小：用不到 spatial locality', -3.6, 4.9);
    cap('block 太小', '沒辦法利用 spatial locality');
  },
  async (tok, S) => { // @1868.7 ~所以block size要相當的
    S.arr = [0, 1, 2, 3].map((k) => bx('w' + k, NC.blue, -5.6 + k * 0.8, 4.2, 0, 0.7, 0.45));
    sm('一次搬進來，下一個、再下一個已經在裡面', -3.6, 3.65);
    cap('block 大一點：一次搬進來', '下一個、再下一個 access 已經在 cache 裡');
  },
  async (tok, S) => { // @1881.9 ~可以reduce miss ray
    good('large block → 減少 miss rate', -3.6, 3.1);
    cap('因為 spatial locality', 'large block size 可以 reduce miss rate');
  },
  async (tok, S) => { // @1897.7 ~我們通常cash的size是固定的
    S.c16 = Array.from({ length: 16 }, (_, i) => bx('', NC.green, -6.0 + (i % 8) * 0.62, 2.3 - Math.floor(i / 8) * 0.5, 0, 0.55, 0.4, 0.5));
    S.c16L = sm('cache size 固定（示意 16 格）', -3.8, 1.3);
    cap('可是 cache size 通常是固定的', '越大會越慢，而且很貴');
  },
  async (tok, S) => { // @1922.6 ~那你現在把block變大的話
    gone(S.c16, S.c16L); S.c8 = Array.from({ length: 8 }, (_, i) => bx('', NC.green, -5.7 + (i % 4) * 1.24, 2.3 - Math.floor(i / 4) * 0.5, 0, 1.17, 0.4, 0.5));
    bad('block 變 2 倍 → block 數 16 → 8', -3.8, 1.3);
    cap('block size 變大', 'number of blocks 就變少');
  },
  async (tok, S) => { // @1952.1 ~block size 那也就是說每個人要
    sm('更多人搶同一個位置 → 更多 miss', -3.8, 0.75);
    cap('位置變少，更多人要搶同一個位置', 'cache miss 就可能發生');
  },
  async (tok, S) => { // @1977.1 ~搶它你數字越少越多人要
    bad('large block → miss penalty 也變大（要搬很久）', -3.8, 0.2);
    cap('另外還會導致', '比較大的 miss penalty');
  },
  async (tok, S) => { // @1991.5 ~penalty 為什麼miss penalty
    sm('pollution：大 block 容易被寫過（dirty）→ 要寫回', -2.8, -0.35);
    cap('large block 比較容易被寫過（pollution）', '被 replace 時就要寫回 memory');
  },
  async (tok, S) => { // @2047.3 ~怎麼樣的機制如果說你真的large
    S.wd = Array.from({ length: 8 }, (_, i) => bx(String(i + 1), NC.off, -5.6 + i * 0.8, -1.0, 0, 0.7, 0.45));
    hot('early restart：要的 word 一到，CPU 就開始', 2.6, 6.7);
    cap('真的要 large block', '可以用 early restart 或 critical word first');
  },
  async (tok, S) => { // @2097.0 ~或者是說你把critical的word first
    tint(S.wd[4], NC.orange); glow(S.wd[4], HL);
    for (const k of [4, 5, 6, 7, 0, 1, 2, 3]) { tint(S.wd[k], NC.blue); await wt(tok, 200); }
    sm('critical word first：從第 5 個先搬（示意）', -2.8, -1.6);
    cap('critical word first', '你要第 5 個，就從第 5 個先搬，CPU 馬上開始');
  },
  async (tok, S) => { // @2146.1 ~可以看這個圖這個是cache的size
    gone(S.arr, S.c8, S.wd); bsGraph(S, 1.2, 0.3); ['4K', '16K', '64K', '256K'].forEach((k) => S.show(k));
    cap('看這個圖：每條線一種 cache size', '4K、16K、64K、256K');
  },
  async (tok, S) => { // @2152.7 ~當你這個block size增加的時候
    S.cur['4K'].forEach((m) => glow(m, HL));
    cap('block size 增加', 'miss rate 先降、再升');
  },
  async (tok, S) => { // @2223.0 ~呢你這個你把block size增加的時候
    const c = BCURVE['4K'];
    ok(c[1] < c[0] && c[2] < c[1] && c[4] > c[2], '4K：先降（spatial locality）、後升（block 數太少）✓', 1.0, 6.2);
    cap('前半：spatial locality 更好，miss 降', '再加大：block 數變少，miss 反而增加');
  },
]);

scene('mh-22b-read', 'Read hit 與 read miss', [
  async (tok, S) => { // @2258.2 ~那接下來我們去看這個cache
    hd('hit', -1.0, 6.3); hd('miss', 3.0, 6.3); hd('read', -4.4, 5.5); hd('write', -4.4, 4.6);
    S.cell = [[bx('', NC.off, -1.0, 5.5, 0, 3.4, 0.6), bx('', NC.off, 3.0, 5.5, 0, 3.4, 0.6)], [bx('', NC.off, -1.0, 4.6, 0, 3.4, 0.6), bx('', NC.off, 3.0, 4.6, 0, 3.4, 0.6)]];
    cap('cache 不是 read 就是 write', '各自又分 hit 和 miss：四種情況');
  },
  async (tok, S) => { // @2290.1 ~catch miss 如果讀的時候呢
    relabel(S.cell[0][0], 'CPU 照常做'); tint(S.cell[0][0], NC.mint);
    cap('read hit：沒問題', 'CPU proceed normally');
  },
  async (tok, S) => { // @2298.7 ~好 那miss的時候怎麼辦呢
    relabel(S.cell[0][1], 'stall CPU pipeline'); tint(S.cell[0][1], NC.rose);
    S.cpu = buddy('CPU', '等…', NC.teal, -3.6, 1.6, 0, 0.9); S.cpu.mood('sad');
    cap('read miss：要 stall', '把 CPU pipeline 停下來');
  },
  async (tok, S) => { // @2322.4 ~我們前面不是在講嗎
    sm('compile 時不知道會 hit 還是 miss → 要靠 hardware', 1.8, 2.9);
    cap('compile 時不知道會不會 cache miss', '所以要用 hardware 來處理');
  },
  async (tok, S) => { // @2339.7 ~cycle浪費在上面然後你就要從
    S.m = bx('next level（L2 / memory）', NC.blue, 3.0, 1.8, 0, 3.2, 0.7); const g = bx('block', NC.pink, 3.0, 1.8, 0.6, 1.0, 0.45); await slide(tok, g, -1.0, 2.4, 0.6, 900);
    cap('浪費很多 cycle', '從 next level（L2 cache 或 memory）把 block 拿進來');
  },
  async (tok, S) => { // @2357.1 ~data拿進來好拿進來之後
    S.cpu.mood('happy'); sm('instruction miss → 重新 fetch 一次', 1.8, 0.7);
    cap('拿進來之後', 'instruction cache miss：重新做 instruction fetch');
  },
  async (tok, S) => { // @2363.6 ~再一次insertage
    sm('data miss → 把 data access 完成', 1.8, 0.2);
    cap('data cache miss', '資料到了，把 data access 完成');
  },
]);

scene('mh-22b-write', 'Write hit：write-through、write-back 與 write buffer', [
  async (tok, S) => { // @2379.9 ~這都是read的時候
    S.cpu = bx('CPU', NC.teal, -5.6, 5.4, 0, 1.2, 0.8); S.c = bx('cache：X = 5', NC.green, -2.6, 5.4, 0, 2.4, 0.8); S.mm = bx('memory：X = 5', NC.blue, 4.0, 5.4, 0, 2.6, 0.8);
    sm('（數值為示意）', 4.0, 6.2);
    cap('write 比較麻煩', 'write hit、write miss 都麻煩');
  },
  async (tok, S) => { // @2397.9 ~麻煩呢因為就是consistency
    const g = bx('sw X=7', NC.pink, -5.6, 5.4, 0.6, 1.1, 0.45); await slide(tok, g, -4.4, 5.4, 0.6, 600); kill(g); // stops at the cache's edge, not on its name
    relabel(S.c, 'cache：X = 7'); bad('兩份 copy 不一樣了（consistency）', 0.8, 4.5);
    cap('為什麼麻煩？consistency', 'cache 一份 copy、lower level 一份 copy');
  },
  async (tok, S) => { // @2412.8 ~你要把它維持一致性呢
    const g = bx('7', NC.pink, -1.0, 5.4, 0.6, 0.6, 0.45); await slide(tok, g, 1.7, 5.4, 0.6, 700); kill(g); relabel(S.mm, 'memory：X = 7');
    hd('write-through：每次寫 cache 也寫 memory', 0, 3.8);
    cap('維持一致：每次 write cache', '都寫到 memory 去：write-through');
  },
  async (tok, S) => { // @2427.5 ~through 好 另外一個叫write back
    hd('write-back：等 block 被 replace（dirty）才寫回', 0, 3.2);
    cap('另一個叫 write-back', '每寫一次就改 memory 太花時間、增加 traffic；等被 replace 再寫回');
  },
  async (tok, S) => { // @2470.1 ~Through 可是呢 就Rise Through會
    S.f = sm('例：CPI = 1、10% 是 store、寫 memory 要 100 cycles', 0, 2.5);
    cap('write-through 很花時間', '假設 CPI 1、10% 是 store、寫 memory 要 100 個 cycle');
  },
  async (tok, S) => { // @2482.5 ~裡面有 但是因為你Cache要Update
    ok(near(1 + 0.1 * 100, 11), 'effective CPI = 1 + 10% × 100 = 11 ✓', 0, 1.9);
    cap('就算是 hit，也要同時 update memory', 'effective CPI 提高到 11');
  },
  async (tok, S) => { // @2496.9 ~write buffer 就是我不是直接
    S.buf = Array.from({ length: 4 }, (_, i) => bx('', NC.off, 0.2 + i * 0.75, 6.6, 0.8, 0.65, 0.45));
    S.bl = hd('write buffer', -1.4, 6.6);
    cap('solution：write buffer', '不直接寫 main memory，先寫到 processor 裡的 buffer');
  },
  async (tok, S) => { // @2504.04 ~我就寫到buffer裡面然後
    for (let k = 0; k < 2; k++) { relabel(S.buf[k], 'w' + (k + 1)); tint(S.buf[k], NC.pink); await wt(tok, 300); }
    good('CPU 繼續 run；memory controller 慢慢寫回', 0.6, 1.3);
    cap('寫到 buffer，CPU 繼續 run', 'buffer 再由 memory controller 慢慢寫回去');
  },
  async (tok, S) => { // @2520.1 ~CPU繼續做 只有在buffer滿的時候
    for (let k = 2; k < 4; k++) { relabel(S.buf[k], 'w' + (k + 1)); tint(S.buf[k], NC.pink); }
    bad('buffer 滿了才 stall', 0.6, 0.7);
    cap('只有 buffer 滿的時候', 'processor 才停下來');
  },
  async (tok, S) => { // @2557.3 ~嗎這樣有沒有問題 來什麼樣的Hazard
    sm('同學問：要讀的資料還在 buffer？→ 用 hardware 從 buffer forward', 0.6, 0.1);
    cap('同學問：下一個要 read 的還在 buffer 裡？', '可以從 buffer forward，要 hardware 控制');
  },
  async (tok, S) => { // @2637.5 ~我這CPU可以繼續做好
    relabel(S.buf[0], ''); tint(S.buf[0], NC.off); note('write buffer 就是一個 FIFO，通常 4 個 entry', 0.6, -0.5);
    cap('write buffer 就是一個 FIFO', '通常 4 個 entry');
  },
  async (tok, S) => { // @2650.0 ~但是問題發生是說
    sm('store 太頻繁（比 memory 寫的速度快）→ 很快就滿', 0.6, -1.1);
    cap('寫太常的話', 'memory 寫得慢，buffer 很容易就滿了');
  },
]);

// ════════ -83W2w16UYI（第 23A 講：複習、block size 圖、read/write hit/miss、Intrinsity FastMATH） ════════
scene('mh-23a-review', '複習：memory hierarchy 與 locality', [
  async (tok, S) => { // @17.6 ~那上一次我們介紹說
    S.sr = bx('SRAM：快、容量小、貴', NC.green, -3.4, 6.2, 0, 3.6, 0.6); S.dr = bx('DRAM：慢、容量大、便宜', NC.blue, 2.0, 6.2, 0, 3.8, 0.6);
    cap('上次介紹：不同 technology', 'SRAM 快但小又貴；DRAM 大、慢、便宜');
  },
  async (tok, S) => { // @21.0 ~我們希望看到的Memory的差距
    ['又快', '又大', '又便宜'].forEach((t, i) => note(t, -3 + i * 3, 5.3));
    cap('我們希望看到的 memory', '又快、又大、又便宜');
  },
  async (tok, S) => { // @51.3 ~但是我們還發覺說
    hot('program 有 locality → 把 memory 組織成 hierarchy', 0, 4.5);
    cap('因為 program 執行有 locality', '可以把 memory 組織成層級的 hierarchy');
  },
  async (tok, S) => { // @63.9 ~memory的地方 越開始process的地方
    S.lv = [['小、快', NC.green, 2.0], ['中', NC.blue, 4.0], ['大、慢、便宜', NC.metal, 6.0]].map(([t, c, w], i) => bx(t, c, 0, 3.6 - i * 0.75, 0, w, 0.6));
    cap('越靠近 processor：用小但快的 technology', '越遠：慢但 capacity 大、便宜');
  },
  async (tok, S) => { // @144.3 ~有一個90時的入
    good('90% 的時間只 access 10% 的 program', 0, 1.2);
    cap('principle of locality', '90% 的時間只 access 10% 的部分');
  },
  async (tok, S) => { // @169.7 ~好就是你喜歡看
    S.book = Array.from({ length: 8 }, (_, i) => bx('', i < 2 ? NC.orange : NC.tan, 3.6 + (i % 4) * 0.7, 1.6 - Math.floor(i / 4) * 0.7, 0, 0.5, 0.6, 0.3));
    sm('圖書館：常看的幾本放身邊（比喻）', 4.6, 0.3);
    cap('像去圖書館看書', '常看的那幾本放在附近，大部分時間都拿得到');
  },
  async (tok, S) => { // @194.3 ~其實有兩種locality
    hd('temporal', -4.6, 0.4); hd('spatial', 0, 0.4);
    cap('有兩種 locality', 'temporal 和 spatial');
  },
  async (tok, S) => { // @216.4 ~然後呢我馬上又會
    sm('現在 access，很快又 access', -4.6, -0.15);
    cap('temporal：時間上', '現在 access 的，馬上又會 access 到');
  },
  async (tok, S) => { // @241.3 ~待會還會access它怎麼樣的
    good('例：loop', -4.6, -0.7);
    cap('符合 temporal locality 的 program construct', 'loop');
  },
  async (tok, S) => { // @270.1 ~spatial locality 就是你現在access
    sm('address 附近的很快被 access', 0, -0.15);
    cap('spatial：空間上', 'address 附近的很快就會被 access');
  },
  async (tok, S) => { // @285.6 ~array data的部分
    good('例：array', 0, -0.7);
    cap('例子：array', 'access 這個 element，很快 access 下一個');
  },
  async (tok, S) => { // @313.9 ~就是我在執行program的時候
    good('例：sequential 的 instruction（PC）', 4.4, -0.7);
    cap('還有 instruction', '依序執行，PC 指的下一個很快就被執行');
  },
  async (tok, S) => { // @326.0 ~好 這個也馬上就知道
    note('有 locality → memory hierarchy 行得通', 1.6, -1.3);
    cap('memory hierarchy 行得通', '就是因為有 temporal 和 spatial locality');
  },
]);

scene('mh-23a-dmreview', '複習：block、direct-mapped、tag', [
  async (tok, S) => { // @361.2 ~然後我們就來做這件事情
    S.up = bx('upper level（比較靠近 processor）', NC.green, -2.6, 6.3, 0, 4.4, 0.6); S.lo = bx('lower level', NC.blue, 3.0, 6.3, 0, 2.6, 0.6);
    cap('兩層的 memory structure', '靠近 processor 叫 high（upper），遠一點叫 lower');
  },
  async (tok, S) => { // @382.1 ~那一個High Level跟Low Level
    const g = bx('block', NC.pink, 3.0, 6.95, 0.3, 1.0, 0.45); await slide(tok, g, -0.6, 6.95, 0.3, 700); // rides on top of the bars, clear of their names
    sm('一塊一塊整個移：cache 叫 block，virtual memory 叫 page', 0, 5.6);
    cap('移動的基本單位叫 block', '在 virtual memory 叫 page');
  },
  async (tok, S) => { // @395.3 ~Level 是一塊一塊整個移的就
    sm('就像讀 memory 一次讀一個 word（4 bytes 一起）', 0, 5.1);
    cap('有點像讀 memory', '一次一定讀 4 個 byte，不會拆開');
  },
  async (tok, S) => { // @432.9 ~block size 可以大
    sm('block size：1 word、4 words、16 words…', 0, 4.6);
    cap('block size 可以大可以小', '舉例時常說一個 block 等於一個 word');
  },
  async (tok, S) => { // @438.6 ~但是呢 實際上 block 如果等於
    bad('1 word：用不到 spatial locality → 希望 block 大一點', 0, 4.1);
    cap('block 只有一個 word', '沒辦法利用 spatial locality');
  },
  async (tok, S) => { // @501.8 ~那你從Low Level搬到這個
    hot('下面 100 個、上面 10 個：要怎麼擺？（placement）', 0, 3.4);
    cap('上面容量小：下面假設 100 個', '上面可能只有 10 個，要怎麼擺？');
  },
  async (tok, S) => { // @531.4 ~那我們上次介紹一個最簡單的方法
    S.seats = Array.from({ length: 10 }, (_, i) => bx(String(i + 1), NC.green, -5.4 + i * 1.2, 2.5, 0, 1.0, 0.45));
    S.ppl = Array.from({ length: 20 }, (_, i) => bx(String(i + 1), NC.off, -5.4 + (i % 10) * 1.2, 1.6 - Math.floor(i / 10) * 0.55, 0, 1.0, 0.42));
    cap('最簡單：direct-mapped', '照次序輪流：第 11 個人又回到第 1 個位置');
  },
  async (tok, S) => { // @551.0 ~每個人都有固定的位置
    glow(S.ppl[0], HL); glow(S.ppl[10], HL); glow(S.seats[0], HL);
    sm('位置 = lower level 地址 mod upper level 的格數', 0, 0.3);
    cap('每個人都有固定的位置', 'lower level 的地址 mod upper level 的數目，餘數就是位置');
  },
  async (tok, S) => { // @599.8 ~餘數好那但是如果我們是Binary
    note('都是 2 的冪次 → 直接看 low-order bits 的 pattern', 0, -0.3);
    cap('如果大小都是 2 的幾次方', '看 low-order 那幾個 bit 就知道在哪一格');
  },
  async (tok, S) => { // @678.7 ~知道說 那現在相同的low order
    gone(S.seats, S.ppl); S.ex = [1, 9, 17].map((b, k) => mt(b2(Math.floor(b / 8), 2) + ' | ' + b2(b % 8, 3), -2.6 + k * 2.6, 2.3, 'ptr'));
    sm('（示意：3 個 5-bit 地址，low-order 都是 001）', 0, 1.7);
    cap('很多人的 low-order bits 一樣', '都 map 到同一個位置；不同在 high-order bits');
  },
  async (tok, S) => { // @710.3 ~對不對就是說我現在因為在low
    hot('把 high-order bits 記下來：tag', -3.0, 1.0);
    cap('要區分是誰', '把 high-order bits 記下來，叫 tag');
  },
  async (tok, S) => { // @744.5 ~只要存High Older Beat
    good('low-order bits 已隱含在位置裡，不用存', 3.0, 1.0);
    cap('low-order bits 不用存', '已經 imply 在 location 裡');
  },
  async (tok, S) => { // @749.7 ~你要去做這個存取的動作的時候
    note('存取：low-order bits 找位置 → 比對 tag', 0, -0.9);
    cap('存取時：先看 low-order bits 找到位置', '再 check tag，確認是不是我的資料');
  },
]);

scene('mh-23a-bsize', '複習：block size 的好處與代價', [
  async (tok, S) => { // @793.2 ~size的問題就是說
    S.cs = Array.from({ length: 10 }, (_, i) => bx('', NC.green, -5.4 + i * 1.2, 6.2, 0, 1.05, 0.45));
    hd('cache：10 個 block（示意）', 0, 6.85);
    cap('block size 的問題', '一個 word、四個、十六個…要設多大？');
  },
  async (tok, S) => { // @819.2 ~因為你為了要locality
    S.w = Array.from({ length: 4 }, (_, i) => bx('w' + i, NC.off, -5.4 + i * 0.8, 4.8, 0, 0.7, 0.45));
    cap('為了 spatial locality', '要搬就一起搬進來');
  },
  async (tok, S) => { // @847.4 ~你們一起搬進來了那access到
    tint(S.w[0], NC.rose); bad('w0 miss', -5.4, 4.2);
    for (let i = 1; i < 4; i++) { tint(S.w[i], NC.mint); await wt(tok, 250); }
    good('w1–w3 已經進來 → hit', -2.6, 4.2);
    cap('access 到它是 miss', '但整塊搬進來了，下次 access 隔壁就 hit');
  },
  async (tok, S) => { // @866.5 ~所以我們就說希望搬large
    good('large block → reduce miss rate', 2.6, 4.8);
    cap('所以搬大一點的 block', '可以 reduce miss rate');
  },
  async (tok, S) => { // @873.4 ~已經在cash裡面了是因為
    gone(S.cs); S.cs = Array.from({ length: 5 }, (_, i) => bx('', NC.green, -4.8 + i * 2.4, 6.2, 0, 2.3, 0.45));
    bad('cache size 固定：block 大 2 倍 → 只剩 5 個 block', 0, 3.6);
    cap('但 cache size 固定', '一個 block 變兩個單位，就只剩 5 個 cache block');
  },
  async (tok, S) => { // @919.1 ~heat的那個這第二個理由
    sm('原本 10 個位置，現在 5 個 → 更多人 map 到同一位置', 0, 3.05);
    cap('格數變少，競爭更激烈', '更多人 map 到同一個位置');
  },
  async (tok, S) => { // @950.7 ~說Miss Penalty也很重要
    bad('miss penalty 變大：每次搬更多', 0, 2.5);
    cap('miss penalty 也很重要', 'block 變大，每次從 lower level 搬要更多時間');
  },
  async (tok, S) => { // @964.6 ~來從這個lower level搬到up
    sm('可能白搬：只用到前兩個，後面根本沒用到', 0, 1.95);
    cap('而且可能白搬了', '搬一大塊進來，可能只用到兩個');
  },
  async (tok, S) => { // @978.2 ~可是又沒全部用到
    sm('pollution：只要寫過一個 data，整個 block 就 dirty → 換掉時要寫回', 0, 1.4);
    cap('block 大，被寫過的機率也大', '被 replace 時要寫回 memory（pollution）');
  },
  async (tok, S) => { // @1056.4 ~過的機率大的話你可能要寫回去就
    S.ws = Array.from({ length: 16 }, (_, i) => bx(String(i + 1), NC.off, -6.0 + i * 0.8, 0.7, 0, 0.7, 0.45));
    sm('16 個 word：要等全部搬完才重新 access → 很久', 0, 0.05);
    cap('block 很大，搬進來很久', '本來 4 個 word，變 16 個 word 要更長時間');
  },
  async (tok, S) => { // @1086.5 ~有一些機制叫early restart
    for (let i = 0; i < 4; i++) tint(S.ws[i], NC.blue); glow(S.ws[3], HL); hot('early restart：第 4 個一到就開始做', -2.2, -0.65);
    cap('early restart', '我要第 4 個 word：1、2、3、4 一進來就開始做');
  },
  async (tok, S) => { // @1101.1 ~然後5 6 7 8 9
    S.ws.forEach((m) => tint(m, NC.off));
    const ord = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2];
    for (const i of ord) { tint(S.ws[i], NC.blue); await wt(tok, 110); }
    hot('critical word first：第 4 個先搬，最後再搬 1、2、3', 2.6, -1.25);
    cap('critical word first', '先搬第 4 個…一直到 16，再回來搬 1、2、3（要更多 hardware）');
  },
]);

scene('mh-23a-graph', '看圖：miss rate 對 block size', [
  async (tok, S) => { // @1122.14 ~那最重要是下面這張圖
    bsGraph(S, -2.4, 0.4); ['4K', '16K', '64K', '256K'].forEach((k) => S.show(k));
    cap('最重要的是這張圖', '看圖要會分析設計');
  },
  async (tok, S) => { // @1166.17 ~X軸就表示
    hot('X 軸：block size；每條曲線：一種 cache size', 0, 6.7);
    cap('X 軸是 block size', '每條曲線是一種 cache size：最上面 4K，再來 16K…');
  },
  async (tok, S) => { // @1177.87 ~那Y軸就表示
    hot('Y 軸：miss rate', -5.6, 5.0);
    cap('Y 軸是 cache miss rate', '');
  },
  async (tok, S) => { // @1179.04 ~那譬如說講4K
    S.cur['4K'].forEach((m) => glow(m, HL));
    cap('4K 這條線', '先往下彎，然後又往上去');
  },
  async (tok, S) => { // @1213.4 ~前半段為什麼他catch miss會變好
    S.cur['4K'].slice(0, 3).forEach((m) => tint(m, NC.green));
    good('前半段下降：spatial locality（預先搬進來）', 0.4, -1.3);
    cap('前半段 miss 變少', 'spatial locality：預先把會 access 的搬進來');
  },
  async (tok, S) => { // @1240.1 ~那你剛講的後半為什麼又往上了咧
    S.cur['4K'].slice(3).forEach((m) => tint(m, NC.red));
    bad('後半段上升：block 數變少，更多人搶同一位置', 0.4, -1.85);
    cap('後半段為什麼往上？', 'block 數變少，更多人 map 到同一個 location');
  },
  async (tok, S) => { // @1260.2 ~那為什麼那下面這個圖就比較平
    S.cur['4K'].forEach((m) => glow(m, null)); S.cur['256K'].forEach((m) => glow(m, HL));
    note('64K、256K 比較平：cache 夠大，block 數仍足夠', 3.6, 6.0);
    cap('下面 64K、256K 比較平', 'cache size 夠大，就算 block 大，block 數還是夠');
  },
]);

scene('mh-23a-read', 'Read hit / miss：stall，不是 interrupt', [
  async (tok, S) => { // @1341.8 ~那整個這個Structure就是這樣子
    hd('hit', -1.0, 6.3); hd('miss', 3.0, 6.3); hd('read', -4.4, 5.5); hd('write', -4.4, 4.6);
    S.cell = [[bx('', NC.off, -1.0, 5.5, 0, 3.4, 0.6), bx('', NC.off, 3.0, 5.5, 0, 3.4, 0.6)], [bx('', NC.off, -1.0, 4.6, 0, 3.4, 0.6), bx('', NC.off, 3.0, 4.6, 0, 3.4, 0.6)]];
    cap('cache hit / miss', '再分 read、write：四個 case');
  },
  async (tok, S) => { // @1355.7 ~發生什麼事情看這就一一的來
    relabel(S.cell[0][0], 'CPU proceed normally'); tint(S.cell[0][0], NC.mint);
    cap('read hit：最好的狀況', 'CPU 照常做，完全不受影響');
  },
  async (tok, S) => { // @1394.6 ~沒有data不在裡面
    relabel(S.cell[0][1], 'stall'); tint(S.cell[0][1], NC.rose);
    S.cpu = buddy('CPU', '停', NC.teal, -3.8, 1.6, 0, 0.9); S.cpu.mood('sad');
    cap('read miss：data 不在裡面', 'CPU 要 stall，停一下');
  },
  async (tok, S) => { // @1402.0 ~data不在裡面啊
    S.mm = bx('main memory', NC.blue, 3.4, 1.9, 0, 2.6, 0.7); const g = bx('block', NC.pink, 3.4, 1.9, 0.6, 1.0, 0.45); await slide(tok, g, -1.0, 2.6, 0.6, 900);
    cap('去 main memory', '把 block 搬到 cache 裡');
  },
  async (tok, S) => { // @1409.7 ~那如果是隱刷均miss呢
    S.cpu.mood('happy'); sm('instruction miss：重新 fetch；data miss：等 data 來再做', 0, 0.6);
    cap('instruction miss：重新 fetch', 'data miss：data 來了再開始做運算');
  },
  async (tok, S) => { // @1438.8 ~memory 會有一個差別
    hot('virtual memory 的 miss（page fault）：OS interrupt', 0, 0.0);
    cap('跟 virtual memory 不一樣', '那裡 miss 時不是 stall，是由 OS 的 interrupt 處理');
  },
  async (tok, S) => { // @1456.3 ~這邊為什麼用藍色
    note('cache miss：stall，CPU 不讓給別人，只是等', 0, -0.6);
    cap('cache miss 是 stall', 'CPU 不讓給別人，只是停下來等 data 搬進來');
  },
]);

// CPU、cache 一格（含 dirty bit）、memory，用來比較 write-through / write-back 的寫入次數
scene('mh-23a-writehit', 'Write hit：write-through 與 write-back（dirty bit）', [
  async (tok, S) => { // @1478.0 ~write也是一樣分成hit跟miss
    S.cpu = bx('CPU', NC.teal, -5.8, 5.6, 0, 1.0, 0.8); S.c = bx('cache：X = 5', NC.green, -2.8, 5.6, 0, 2.6, 0.8); S.mm = bx('memory：X = 5', NC.blue, 3.6, 5.6, 0, 2.6, 0.8);
    sm('（數值為示意）', 3.6, 6.4);
    cap('write 也分 hit 和 miss', 'write hit：data 在 cache 裡');
  },
  async (tok, S) => { // @1495.6 ~因為你要寫嘛不是把你的data改變
    const g = bx('7', NC.pink, -5.8, 5.6, 0.6, 0.6, 0.45); await slide(tok, g, -4.5, 5.6, 0.6, 600); kill(g); relabel(S.c, 'cache：X = 7');   // the 7 stops at the box's edge, clear of its name
    bad('cache 與 memory 不一樣了', 0.4, 4.8);
    cap('write 會改 cache 的 data', 'read 做 100 次都沒事，write 一次 memory 和 cache 就不一樣');
  },
  async (tok, S) => { // @1520.1 ~他說有兩種policy
    const g = bx('7', NC.pink, -0.9, 5.6, 0.6, 0.6, 0.45); await slide(tok, g, 1.1, 5.6, 0.6, 700);   // stops before memory's name kill(g); relabel(S.mm, 'memory：X = 7');
    hd('write-through：每次 update cache 都寫回 memory', 0, 4.2);
    cap('兩種 policy：write-through', '永遠維持 cache 跟 memory 一致');
  },
  async (tok, S) => { // @1555.8 ~ride through的優點是什麼
    good('優點：兩份 copy 永遠一樣', 0, 3.65);
    cap('write-through 的優點', '永遠一致，突然發生 interrupt 也沒關係');
  },
  async (tok, S) => { // @1577.8 ~一致性那缺點是什麼
    bad('缺點：每次都寫 memory → 浪費 bandwidth、製造 traffic', 0, 3.1);
    cap('缺點', '每次 update 都要寫 memory，浪費 memory bandwidth');
  },
  async (tok, S) => { // @1595.7 ~approach 就叫ride
    hd('write-back：只寫 cache', 0, 2.4);
    cap('另一個 approach：write-back', '新的 update 只留在 cache');
  },
  async (tok, S) => { // @1611.5 ~只在cache裡面我不寫回去我一直
    sm('等這個 block 被 replace 時才寫回 memory', 0, 1.85);
    cap('一直到這個 block 被 replace', '才把最新的資料寫回 memory');
  },
  async (tok, S) => { // @1641.0 ~因為寫回去才把最新的資料寫回去那好
    S.db = bx('dirty', NC.off, -2.8, 6.45, 0, 1.0, 0.35);
    cap('write-back 要多記一個 information', '有沒有被寫過');
  },
  async (tok, S) => { // @1663.8 ~如果被寫過你要把它set成1
    relabel(S.db, 'dirty = 1'); tint(S.db, NC.orange);
    sm('dirty = 1 → replace 時寫回；dirty = 0 → 直接蓋過去', 0, 1.3);
    cap('被寫過就把 dirty bit 設 1', 'replace 時 dirty = 1 才寫回；0 就直接蓋過去');
  },
  async (tok, S) => { // @1688.1 ~好 那ride back的優點跟缺點
    const wt3 = 3, wb3 = 1;
    ok(wt3 === 3 && wb3 === 1, '示意：同一格寫 3 次 → write-through 寫 memory 3 次、write-back 只在 replace 寫 1 次 ✓', 0, 0.75);
    cap('write-back 的優點', '不會製造很多 traffic，最後一刻才寫回');
  },
  async (tok, S) => { // @1695.7 ~它只要最後一刻的時候才把它
    bad('缺點：中途 memory 的 copy 是舊的（不一致）', 0, 0.2);
    cap('缺點', '中間 memory 沒被 update，兩份 copy 不一樣');
  },
  async (tok, S) => { // @1719.0 ~back的時候我們都有一個機制會
    S.buf = Array.from({ length: 4 }, (_, i) => bx('', NC.off, 0.2 + i * 0.75, 6.6, 0, 0.65, 0.4));
    hd('buffer', -0.9, 6.6);
    note('兩種都可以加 buffer：寫回 memory 時先丟 buffer', 0, -0.4);
    cap('不管 write-through 或 write-back', '寫回 memory 時都可以用 buffer 加快');
  },
]);

scene('mh-23a-writemiss', 'Write miss：write allocate 或 write around', [
  async (tok, S) => { // @1767.1 ~好 那剛剛講過三種狀況
    hd('hit', -1.0, 6.3); hd('miss', 3.0, 6.3); hd('read', -4.4, 5.5); hd('write', -4.4, 4.6);
    S.cell = [[bx('照常', NC.mint, -1.0, 5.5, 0, 3.4, 0.6), bx('stall、搬 block', NC.rose, 3.0, 5.5, 0, 3.4, 0.6)], [bx('write-through / back', NC.mint, -1.0, 4.6, 0, 3.4, 0.6), bx('？', NC.off, 3.0, 4.6, 0, 3.4, 0.6)]];
    glow(S.cell[1][1], HL);
    cap('三種狀況講過了', '第四種：write miss');
  },
  async (tok, S) => { // @1788.5 ~如果去write它它不在
    sm('直覺：先把 block 搬進來，再把新資料寫上去', 0, 3.6);
    cap('要寫的不在 cache 裡', '直覺是先搬進來，再寫上去');
  },
  async (tok, S) => { // @1808.3 ~write back write through the policy
    cap('但搭配不同的 policy', '會有不同的做法');
  },
  async (tok, S) => { // @1812.7 ~你有兩種狀況如果你是write back
    S.wb = bx('write-back → fetch block（write allocate）', NC.green, -3.0, 2.7, 0, 5.4, 0.6);
    cap('write-back', 'write miss 時把 block fetch 到 cache，再寫到 cache');
  },
  async (tok, S) => { // @1849.1 ~那另外一個policy
    S.wt = bx('write-through → 不一定 allocate', NC.blue, 3.0, 2.7, 0, 4.4, 0.6);
    cap('write-through', '不一定要 allocate');
  },
  async (tok, S) => { // @1854.9 ~initialization的時候你其實只是
    sm('例：initialization 只寫、之後不再用', 3.0, 2.0);
    cap('很多時候（像 initialization）只是寫', '後來根本不再用，搬進來只增加 traffic');
  },
  async (tok, S) => { // @1877.1 ~write miss的時候就直接去寫main memory
    hot('no-write allocate（write around）：直接寫 main memory', 3.0, 1.3);
    cap('所以 write miss 時', '直接寫 main memory，不 fetch 進來');
  },
  async (tok, S) => { // @1888.1 ~你看下面這張圖片就清楚了
    relabel(S.cell[1][1], 'allocate 或 write around'); tint(S.cell[1][1], NC.sky);
    cap('整理成表', 'write-back 通常 fetch；write-through 可 allocate 或不 allocate');
  },
  async (tok, S) => { // @1945.9 ~catch hit跟mix的時候
    note('hit / miss × read / write：四個 case 分清楚就不會亂', 0, 0.3);
    cap('cache hit、miss 再分 read、write', '每個 case 要做什麼，一一想清楚');
  },
]);

scene('mh-23a-fastmath', '實例：Intrinsity FastMATH 的 cache', [
  async (tok, S) => { // @1953.0 ~一一想想看
    S.chip = bx('Intrinsity FastMATH（embedded processor）', NC.metal, 0, 6.3, 0, 6.0, 0.7);
    cap('來看一個商用例子', 'Intrinsity FastMATH 這顆 embedded processor');
  },
  async (tok, S) => { // @1971.8 ~12個Stage的Pipeline
    sm('12-stage pipeline；每個 cycle 都要 instruction 和 data access', 0, 5.6);
    cap('12 個 stage 的 pipeline', '每個 cycle 都可能要 instruction 和 data access');
  },
  async (tok, S) => { // @1984.8 ~然後這個Split Cache
    S.ic = bx('I-cache', NC.green, -2.6, 4.4, 0, 2.6, 0.8); S.dc = bx('D-cache', NC.blue, 2.6, 4.4, 0, 2.6, 0.8);
    cap('split cache', 'instruction cache 和 data cache 分開');
  },
  async (tok, S) => { // @1984.8 ~那每一個iCache跟D
    sm('各 256 個 block × 16 words', -2.6, 3.7); sm('各 256 個 block × 16 words', 2.6, 3.7);
    cap('每一個', '256 個 block，每個 block 16 個 word');
  },
  async (tok, S) => { // @1998.9 ~size多少是16個word
    ok(16 * 4 === 64 && 256 * 64 === 16384, 'block = 16 words = 64 bytes；256 × 64 B = 16 KiB ✓', 0, 3.0);
    cap('block 是 16 個 word = 64 byte', '之前用一個 word 的 block，是很 extreme 的例子');
  },
  async (tok, S) => { // @2016.4 ~一個block 那總共有多少個block
    sm('D-cache 可設 write-through 或 write-back', 2.6, 2.4);
    cap('D-cache', '可以 write-through，也可以 write-back');
  },
  async (tok, S) => { // @2024.1 ~或write back 都可以那這個miss
    S.bI = vbar(NC.green, -2.6, 0.4 * 0.25, 1.0, 0.4); S.bD = vbar(NC.blue, 2.6, 11.4 * 0.13, 1.0, 0.4);
    sm('I miss 0.4%', -2.6, 0.0); sm('D miss 11.4%', 2.6, 0.0);
    cap('miss rate：I-cache 只有 0.4%', 'D-cache 大約 11.4%（P&H 的 SPEC 數據）');
  },
  async (tok, S) => { // @2040.8 ~用到的這個這個process的狀況它
    good('I 低：instruction 大多 sequential、loop', -2.6, -0.55);
    cap('為什麼 I-cache 比較低？', 'instruction 多半 sequential，loop 也容易抓到 locality');
  },
  async (tok, S) => { // @2056.0 ~Special Locality很容易抓到
    bad('D 高：data 比較亂，pointer 更麻煩', 3.3, -0.55);
    cap('data 比較亂', '除了 array 比較整齊，pointer 指到哪都不知道');
  },
  async (tok, S) => { // @2069.4 ~miss會比較高就是11
    note('合起來的 miss rate 約 3.2%（P&H）', 0, -1.2);
    cap('平均起來', '整體 miss rate 大約 3.2%，其實相當低');
  },
]);

// FastMATH：32-bit = tag 18 | index 8 | block offset 4 | byte offset 2
scene('mh-23a-fmaddr', 'FastMATH 的位址切割與 16-word block', [
  async (tok, S) => { // @2086.1 ~的看一下這個
    S.bs = BS(null, [{ n: 'tag', b: 18, c: FC.tag }, { n: 'index', b: 8, c: FC.index }, { n: 'blk', b: 4, c: '#e8b04a' }, { n: 'byte', b: 2, c: FC.offset }], 6.0);
    S.bs.labels.forEach((l) => { l.visible = false; });
    cap('FastMATH 的 address 怎麼分配？', '32-bit byte address');
  },
  async (tok, S) => { // @2106.2 ~假如我給一個address 32幣
    S.bs.labels[3].visible = true; S.bs.cubes.slice(30).forEach((m) => glow(m, HL));
    cap('最後兩個 bit 是 byte offset', '一個 word 有 4 個 byte');
  },
  async (tok, S) => { // @2122.9 ~因為它是說一個block有幾個word
    S.bs.labels[2].visible = true; S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(26, 30).forEach((m) => glow(m, HL));
    S.k3 = ok(Math.log2(16) === 4, '16 words = 2⁴ → block offset 4 bits ✓', 3.4, 4.6);
    cap('一個 block 有 16 個 word', '要 4 個 bit 描述是第幾個 word');
  },
  async (tok, S) => { // @2143.0 ~的那我要看他是第幾個block
    S.bs.labels[1].visible = true; S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(18, 26).forEach((m) => glow(m, HL));
    cap('要看是第幾個 block', '從前面這段看，就是 index');
  },
  async (tok, S) => { // @2178.3 ~剛前面講幾個block
    S.k5 = ok(Math.log2(256) === 8, '256 個 block = 2⁸ → index 8 bits ✓', -2.6, 4.6);
    cap('有 256 個 block', '所以 index 要 8 個 bit');
  },
  async (tok, S) => { // @2194.8 ~可以access到 到底是哪一個
    S.q = hot('剩下的 18 個 bit 是什麼？', -3.6, 4.0);
    cap('那剩下這 18 個 bit', '是什麼？');
  },
  async (tok, S) => { // @2222.7 ~就是說這個呢就是tag
    S.bs.labels[0].visible = true; S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 18).forEach((m) => glow(m, HL));
    S.k7 = ok(32 - 8 - 4 - 2 === 18, 'tag = 32 − 8 − 4 − 2 = 18 bits ✓', -3.6, 3.4);
    cap('就是 tag', 'index 相同、map 到同一位置的人，靠 tag 區分');
  },
  async (tok, S) => { // @2256.4 ~structure 你需要一個valuebit
    gone(S.q); S.bs.cubes.forEach((m) => glow(m, null));
    hd('V', -6.3, 2.75); hd('tag 18', -5.0, 2.75); hd('data：16 words', 0.8, 2.75);
    S.rows = [0, 1, 2].map((r) => { const y = 2.15 - r * 0.55; return { v: bx('1', NC.mint, -6.3, y, 0, 0.5, 0.42, 0.6), t: bx('', NC.lilac, -5.0, y, 0, 1.6, 0.42, 0.6), w: Array.from({ length: 16 }, (_, k) => bx('', NC.sky, -3.7 + k * 0.6, y, 0, 0.52, 0.42, 0.6)) }; });
    sm('…共 256 列（index 0–255）', 0.8, 0.45);
    cap('cache 的 structure', '每列：valid bit、18-bit tag、16 個 word 的 data');
  },
  async (tok, S) => { // @2280.7 ~之後你就有一個tag比對
    glow(S.rows[1].t, HL); S.rows[1].w.forEach((m) => tint(m, NC.blue));
    S.hit = good('index 選到這列 → tag 比對一樣 → hit', 3.6, 1.95 + 1.75);
    cap('用 8-bit index 選到一列', '再做 tag 比對，一樣就是 hit');
  },
  async (tok, S) => { // @2372.4 ~這樣一個灰色的地方
    S.q3 = hot('這一列（一個 block）有幾個 word？', 3.6, 3.15);
    cap('一條 line（一個 block）', '裡面有多少個 word？');
  },
  async (tok, S) => { // @2396.4 ~就從這邊來看 16個
    ok(S.rows[1].w.length === 16, '一個 block = 16 個 word ✓', 3.6, -0.15);
    cap('16 個 word', '一個 block 就有 16 個 word');
  },
  async (tok, S) => { // @2459.9 ~第三第四對不對這個是tag
    S.q2 = hot('要第幾個 word，用哪幾個 bit 選？', -3.4, 4.0);
    cap('那要拿第幾個 word', '用 address 的哪個部分？');
  },
  async (tok, S) => { // @2486.0 ~第一個fuel 還是第二個fuel
    gone(S.q2); S.bs.cubes.slice(26, 30).forEach((m) => glow(m, HL));
    S.k13 = ok(Math.pow(2, 4) === 16, 'block offset 4 bits → 0000–1111 選 16 個 word 之一 ✓', -3.4, 4.0);
    cap('第二個欄位：block offset（4 bits）', '0000 是第 0 個 word、0001 是第 1 個…');
  },
  async (tok, S) => { // @2568.1 ~就在這個4個Beat在這邊Access
    const k = 1; S.rows[1].w.forEach((m) => glow(m, null)); glow(S.rows[1].w[k], OKG); tint(S.rows[1].w[k], NC.green);
    S.mux = bx('MUX（16 選 1）', NC.gold, -3.1, -0.9, 0, 2.2, 0.5); lk(-3.1, 1.4, -3.1, -0.6, 0x0f5a3a, 0.4);
    sm('示意：block offset = 0001 → 第 1 個 word', 0.6, -0.9);
    cap('hit 之後，用這 4 個 bit 做 MUX 選擇', '選出 block 裡你要的那個 word');
  },
  async (tok, S) => { // @2651.2 ~我們假如是一群人
    sm('同一個 block 的 16 個 word：tag、index 都一樣，只差這 4 bits', 0, -1.6);
    cap('16 個 word 一群一起搬進 cache', 'tag、index 都一樣，不同在這 4 個 bit');
  },
  async (tok, S) => { // @2705.7 ~這樣瞭解嗎好 這樣瞭解 好 所以其實那這個01
    gone(S.hit, S.q3, S.k3, S.k5, S.k7, S.k13); S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(30).forEach((m) => glow(m, HL));
    sm('word 出來後：byte offset 00、01、10、11 選第幾個 byte', 0, 5.2);
    cap('一個 word 出來之後', '最後兩個 bit 選 4 個 byte 中的哪一個');
  },
  async (tok, S) => { // @2784.8 ~就來決定說這邊有擺幾個
    ok(Math.log2(4) === 2, '如果一個 block 只有 4 個 word → block offset 2 bits ✓', 0, 4.0);
    cap('如果一個 block 只放 4 個 word', 'block offset 就只要 2 個 bit');
  },
  async (tok, S) => { // @2829.2 ~兩個beat來選這樣這樣瞭解這關係
    note('valid + tag 比對 → hit；block offset 選 word；byte offset 選 byte', 0, -2.2);
    cap('整個流程：valid、tag 比對決定 hit', '再用 block 內的 offset 選出要的 word');
  },
]);

// ════════ QWGIvh-k7go（第 23B 講：block 內的 word、memory 組織與 miss penalty、DRAM、CPI/AMAT、associativity） ════════
scene('mh-23b-words', '同一個 block 的 word：tag、index 相同，offset 不同', [
  async (tok, S) => { // @17.8 ~現在大家再看一下這個如果給你
    hot('給一個 address：用 index 決定第幾個 block', 0, 6.6);
    cap('給一個 address，要 access 某個 word', '用 index 的部分決定是第幾個 block');
  },
  async (tok, S) => { // @35.1 ~它的是不是index都一樣
    S.q = sm('同學問：同一個 block 裡的 word，index、tag 都一樣嗎？', 0, 6.0);
    cap('同學問：同一個 block 裡', 'index 和 tag 是不是都一樣？');
  },
  async (tok, S) => { // @41.6 ~它的tag都一樣為什麼
    S.ad = Array.from({ length: 8 }, (_, a) => mt(b2(a, 4), -4.6 + (a % 2) * 1.6, 5.0 - Math.floor(a / 2) * 0.62, 'ptr'));
    S.grp = [0, 1, 2, 3].map((g) => bx('block ' + g, NC.sky, -0.6, 5.0 - g * 0.62, 0, 1.8, 0.45));
    sm('（示意：4-bit 地址，2 個 word 綁成一個 block）', -2.4, 2.2);
    cap('是的：地址是連續的', '把連續的地址圈起來，就是一個 block');
  },
  async (tok, S) => { // @93.0 ~它不同在是low order幣的地方
    good('同一個 block：high-order bits 一樣（index、tag 相同）', 2.6, 1.6);
    bad('不同的只有 low-order bits', 2.6, 1.0);
    cap('high-order 的部分一樣', '不同的是 low-order bits');
  },
  async (tok, S) => { // @110.2 ~找到這個tag都一樣那現在你要
    S.ad.forEach((l, a) => { if (a % 2 === 1) l.element.className = 'lab-label ptr alt'; });
    cap('找到 block、tag 也對了', '要分哪一個 word，就用最後的 low-order bits');
  },
  async (tok, S) => { // @126.3 ~那你就用它的這個比如說用這個
    note('index → 哪個 block；tag → 是不是我；block offset → 哪個 word', 0, 0.2);
    cap('流程：index 找 block、比對 tag', 'block offset 找 word；byte offset 不理');
  },
]);

scene('mh-23b-memorg', 'Memory 組織與 miss penalty：65、17、20 cycles', [
  async (tok, S) => { // @183.6 ~可是我們現在cache呢是跟memory
    S.cols = [-4.6, 0, 4.6];
    S.c = S.cols.map((x) => bx('cache', NC.green, x, 6.2, 0, 2.2, 0.5));
    cap('cache hit 不用碰 memory', 'cache miss 就要從 memory 把 block 搬到 cache');
  },
  async (tok, S) => { // @204.4 ~你就要從memory把東西搬進來那
    sm('miss penalty：看傳輸時間與 memory 怎麼設計', 0, 6.85);
    cap('miss penalty 怎麼算？', '要看搬一個 block 的傳輸時間，和 memory 的設計');
  },
  async (tok, S) => { // @219.4 ~這有三種不同的structure
    seg(-4.6, 5.9, -4.6, 4.6, '#8a7a5c'); S.m1 = bx('memory', NC.blue, -4.6, 4.2, 0, 2.2, 0.6); hd('① one-word-wide', -4.6, 3.5);
    cap('第一種：一次 access 一個 word', 'bus 也一次傳一個 word');
  },
  async (tok, S) => { // @227.8 ~cpu 那第二種叫wide
    [-0.75, -0.25, 0.25, 0.75].forEach((dx) => seg(dx, 5.9, dx, 4.6, '#8a7a5c')); S.m2 = [0, 1, 2, 3].map((k) => bx('', NC.blue, -0.84 + k * 0.56, 4.2, 0, 0.5, 0.6)); hd('② wide memory', 0, 3.5);
    cap('第二種：wide memory', '一次 access 四個 word，bus 也這麼寬，同時傳');
  },
  async (tok, S) => { // @247.6 ~然後同時傳到放到我的cash裡面 那第三種
    seg(4.6, 5.9, 4.6, 4.9, '#8a7a5c'); seg(3.75, 4.9, 5.45, 4.9, '#8a7a5c'); S.m3 = [0, 1, 2, 3].map((k) => bx(String(k), NC.blue, 3.75 + k * 0.57, 4.2, 0, 0.52, 0.6)); hd('③ interleaved（4 banks）', 4.6, 3.5); // narrow banks: just the bank number (the title says banks)
    cap('第三種：interleaved', '分四塊 bank 可以同時 access，但 bus 還是一個 word 寬');
  },
  async (tok, S) => { // @273.1 ~這個之前我要先講一下
    S.h1 = hot('access time：給 address 到拿到 data　/　cycle time：到下一次可以 access', 0, 2.8);
    cap('先講 DRAM 的兩個時間', 'access time 和 cycle time');
  },
  async (tok, S) => { // @302.7 ~Time 一個叫做Cycle Time 為什麼要有
    S.h2 = sm('DRAM 是電容：讀完要 sense amplify、再寫回 → 要等 cycle time', 0, 2.25);
    cap('為什麼有 cycle time？', 'DRAM 讀完要 sense、把 data 寫回，才能做下一筆');
  },
  async (tok, S) => { // @350.2 ~access 沒有interleaf的話你就是不管你
    S.tl1 = [0, 1, 2, 3].map((k) => bx('', NC.orange, -6.2 + k * 1.05, 1.5, 0, 1.0, 0.35));
    S.h3 = sm('沒有 interleave：一筆做完（等 cycle time）才做下一筆', -2.2, 1.0);
    cap('沒有 interleave（① 和 ②）', '一筆做完，才可以做另一筆');
  },
  async (tok, S) => { // @380.1 ~那InterLeave是怎麼樣呢
    S.tl3 = [0, 1, 2, 3].map((k) => bx('', NC.green, 3.0, 1.6 - k * 0.3, 0, 1.0, 0.25));
    S.h4 = sm('interleave：4 個 bank 同時 access，一次拿 4 筆', 4.0, 0.2);
    cap('interleave：切成 4 個獨立的 bank', '也要等 cycle time，但 4 筆同時出來');
  },
  async (tok, S) => { // @493.6 ~他假如說一個memory bus的clock
    gone(S.tl1, S.tl3, S.h1, S.h2, S.h3, S.h4); S.as = list(-4.0, 1.7);
    S.as.add('假設：送 address 1 個 bus cycle');
    cap('來算 miss penalty', '假設 send address 要 1 個 memory bus clock');
  },
  async (tok, S) => { // @499.9 ~假如一個memory bus的clock 15
    S.as.add('每次 DRAM access 15 cycles');
    cap('每次 access DRAM', '要 15 個 cycle 才能開始下一筆');
  },
  async (tok, S) => { // @518.6 ~box 去send the word
    S.as.add('傳一個 word 1 cycle');
    cap('把一個 word 傳回 cache', '要 1 個 cycle');
  },
  async (tok, S) => { // @524.5 ~clock cycle 那假如我的cache block
    S.as.add('cache block = 4 words');
    cap('cache block 是 4 個 word', '三種 organization 各要多少時間？');
  },
  async (tok, S) => { // @529.0 ~時間第一種organization是一個
    const p = 1 + 4 * 15 + 4 * 1; ok(p === 65, '1 + 4×15 + 4×1 = 65 cycles ✓', -4.6, 2.6);
    cap('① one-word-wide：讀 4 次', '1 + 4 × 15 + 4 × 1 = 65 個 cycle');
  },
  async (tok, S) => { // @568.1 ~word一起讀出來的話
    const p = 1 + 15 + 1; ok(p === 17, '1 + 15 + 1 = 17 cycles ✓', 0, 2.6);
    cap('② wide：4 個 word 一起讀、一起傳', '1 + 15 + 1 = 17 個 cycle');
  },
  async (tok, S) => { // @590.3 ~所以17 好那如果是4個bank的話
    const p = 1 + 1 * 15 + 4 * 1; ok(p === 20, '1 + 15 + 4×1 = 20 cycles ✓', 4.6, 2.6);
    cap('③ interleaved：4 個 bank 同時 access 一次', 'bus 只有一個 word 寬，傳 4 次：1 + 15 + 4 = 20');
  },
  async (tok, S) => { // @640.7 ~那可是這個他要花多少的overhead
    bad('wide：bus 與 memory 都要變寬，hardware overhead 大', 0, -0.6 + 0.0);
    good('interleaved：只切 bank，overhead 小，效果接近', 2.6, 0.0 - 1.1);
    cap('wide 要很多 hardware：pin、bus 都變寬', 'interleave 只切 bank，overhead 小，performance 卻接近');
  },
  async (tok, S) => { // @667.6 ~因為為什麼要這樣主要是因為
    note('interleave 把 cycle time 藏起來', 2.6, -1.7);
    cap('為什麼這樣有用？', 'memory 有 cycle time，同時 access 4 個 bank 就把它藏起來');
  },
]);

scene('mh-23b-dram', 'DRAM：row / column、burst mode、DDR SDRAM', [
  async (tok, S) => { // @695.8 ~再看看這個DRAM
    sm('cache：給 address 就知道是哪個 block', 0, 6.7);
    cap('cache 給 address', '就能從 address 知道在哪個 block');
  },
  async (tok, S) => { // @725.6 ~這不一樣這兩個access不一樣第一
    S.ad = bx('22-bit address', NC.gold, -4.4, 5.9, 0, 3.0, 0.5);
    S.r = bx('row 11', NC.orange, -5.2, 5.1, 0, 1.4, 0.45); S.c = bx('column 11', NC.purple, -3.6, 5.1, 0, 1.6, 0.45);
    cap('DRAM 不一樣', 'address 拆成兩部分：row access 和 column access');
  },
  async (tok, S) => { // @739.9 ~0到20 22個bit
    ok(Math.pow(2, 11) === 2048, '11 bits → 2¹¹ = 2048 個 row ✓', -4.4, 4.4);
    cap('22 個 bit 拆一半', '11 個 bit 的 row decoder 產生 2048 條 row');
  },
  async (tok, S) => { // @796.4 ~這個總共有幾個row
    S.g = []; for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 8; c++) row.push(bx('', NC.sky, 0.6 + c * 0.62, 5.6 - r * 0.5, 0, 0.55, 0.4, 0.5)); S.g.push(row); }
    sm('2048 × 2048 的 bit array（只畫一角，示意）', 2.8, 2.6);
    cap('11 × 11', '整個像一個 2048 × 2048 的矩陣');
  },
  async (tok, S) => { // @817.7 ~第二個第三第四第五
    S.g[2].forEach((m) => tint(m, NC.orange)); S.latch = bx('column latch（整個 row）', NC.mint, 2.8, 1.9, 0, 5.0, 0.4);
    cap('先決定 row', '把那整個 row 讀下來放到 latch');
  },
  async (tok, S) => { // @828.7 ~把那個roll的資料全部讀下來放到
    glow(S.g[2][3], OKG); tint(S.g[2][3], NC.green);
    cap('再用另一半 address（column）', '選出你要的那個');
  },
  async (tok, S) => { // @890.7 ~有什麼好處
    good('row 已在 latch：連續的 column 很快', 2.8, 1.3);
    cap('好處：row 讀下來之後', '連續 access 同一個 row 的 column 就很快');
  },
  async (tok, S) => { // @910.6 ~那如果你是連續的
    for (let c = 3; c < 8; c++) { glow(S.g[2][c], OKG); await wt(tok, 150); }
    hot('burst mode：連續地址一口氣讀出', 2.8, 0.7);
    cap('連續的地址可以用 burst mode', 'cache block 正好是連續的，很適合');
  },
  async (tok, S) => { // @936.2 ~Raw X跟Color X 這兩個部分我們叫所謂DDR
    hd('DDR SDRAM = Double Data Rate Synchronous DRAM', -1.6, 0.0);
    cap('現在用的叫 DDR SDRAM', 'Double Data Rate Synchronous DRAM');
  },
  async (tok, S) => { // @967.6 ~因為一般的DRAM
    sm('原始 DRAM：asynchronous，用 control signal（low active）控制讀寫', -1.6, -0.5);
    cap('原始的 DRAM 是 asynchronous', '用一些 control signal 控制 read/write');
  },
  async (tok, S) => { // @990.6 ~rewrite 但 synchronous 的意思是說
    S.clk = Array.from({ length: 8 }, (_, i) => bx('', i % 2 ? NC.off : NC.teal, -5.6 + i * 0.5, -1.2, 0, 0.48, i % 2 ? 0.1 : 0.4, 0.3));
    sm('synchronous：用 clock 控制', -0.6, -1.2);
    cap('synchronous', '直接用 clock 來控制讀寫');
  },
  async (tok, S) => { // @1001.4 ~clock synchronization 的 然後它是 double data rate
    good('double data rate：rising edge、falling edge 都傳 data', 1.0, -1.75);
    cap('double data rate', 'clock 的 rising edge 和 falling edge 都傳資料');
  },
  async (tok, S) => { // @1010.8 ~burst mode 的時候就可以做這個
    sm('burst：給 starting address 和長度，用 clock 一直讀出來', 0, -2.3);
    cap('burst mode：連續的 location 都在 latch', '只要給 starting address 和長度');
  },
  async (tok, S) => { // @1058.6 ~PC上面都用DDR的sDRAM
    note('PC 都用 DDR SDRAM；每 GB 價錢一路下降', -3.4, 3.9);
    cap('現在 PC 都用 DDR SDRAM', '每 GB 價錢一路變便宜');
  },
  async (tok, S) => { // @1084.0 ~紅色就代表RAWX的時間
    sm('column access 比 row access 快很多', -3.4, 3.3);
    cap('row access 和 column access 時間都在下降', 'column access 一直比 row access 快很多');
  },
]);

scene('mh-23b-cpi', 'Cache performance：CPI 2 → 5.44', [
  async (tok, S) => { // @1379.8 ~好所以我們說現在你先看memory的
    S.done = ['memory hierarchy（locality）', 'basic cache：direct-mapped', 'memory 怎麼配合 cache'].map((t, i) => sm('✓ ' + t, -4.2, 6.6 - i * 0.45));
    cap('目前學了：memory hierarchy、basic cache', '以及 memory 怎麼配合 cache');
  },
  async (tok, S) => { // @1399.1 ~這個Catch 我們來算一算量量看它
    hot('怎麼量 cache 的 performance？', 2.6, 6.6);
    cap('這個最簡單的 cache', '來量量看它的 performance');
  },
  async (tok, S) => { // @1423.9 ~就是呢 分兩個部分
    hd('CPU time = (execution cycles + memory-stall cycles) × cycle time', 0, 5.0);
    cap('分兩部分', 'program 的 execution cycles，加上 memory-stall cycles');
  },
  async (tok, S) => { // @1433.0 ~因為miss的話也是要經過
    sm('hit 的時間已含在 execution cycles 裡（miss 也要先查 cache）', 0, 4.45);
    cap('不管 hit 或 miss 都先經過 cache', '這段算在 execution cycles 裡');
  },
  async (tok, S) => { // @1452.8 ~store的cycle 加extra
    sm('miss 才要加 memory-stall cycles（extra）', 0, 4.0);
    cap('如果 miss', '還要加上 memory-stall 的 extra cycle');
  },
  async (tok, S) => { // @1459.6 ~那我要算這個store的cycle
    hd('memory-stall cycles = (memory accesses / program) × miss rate × miss penalty', 0, 3.4);
    cap('memory-stall cycles 怎麼算？', 'memory access 的比例 × miss rate × miss penalty');
  },
  async (tok, S) => { // @1487.6 ~cpi clock per instruction
    sm('base CPI：假設沒有 cache miss 時的 CPI', 0, 2.85);
    cap('base CPI', '假設沒有 cache miss 時，每個 instruction 要幾個 cycle');
  },
  async (tok, S) => { // @1521.4 ~例子好 假如我現在 i cache
    gone(S.done); S.ex = list(-3.0, 2.2);
    S.ex.add('I-cache miss rate 2%、D-cache miss rate 4%');
    cap('例子：I-cache miss rate 2%', 'D-cache miss rate 4%');
  },
  async (tok, S) => { // @1529.8 ~Penalty是100個cycle Base CPI
    S.ex.add('miss penalty 100 cycles、base CPI 2');
    cap('miss penalty 100 個 cycle', 'base CPI（每次都 hit）= 2');
  },
  async (tok, S) => { // @1536.3 ~CPI是2 那Low Store這些指令佔
    S.ex.add('load/store 佔 36% 的 instruction');
    cap('load/store 這些指令', '佔 36%');
  },
  async (tok, S) => { // @1554.3 ~因為分了兩個地方一個是I Cache
    S.ic = bx('I-cache', NC.green, 3.0, 2.0, 0, 1.8, 0.5); S.dc = bx('D-cache', NC.blue, 5.4, 2.0, 0, 1.8, 0.5);
    cap('分兩個 cache', '每個 instruction 要 access I-cache；有些還要 access D-cache');
  },
  async (tok, S) => { // @1572.6 ~它是告訴你說 low store佔36%
    sm('36% → D-cache', 5.4, 2.6);
    cap('36% 的 load/store', 'access 的是 D-cache');
  },
  async (tok, S) => { // @1637.3 ~怎麼會64
    sm('100% → I-cache（不是 64%！）', 3.0, 1.4);
    cap('I-cache 呢？不是 64%', '每一個 instruction 都要 fetch：100%');
  },
  async (tok, S) => { // @1672.2 ~好剛才講說所以為什麼這邊因為
    S.b0 = vbar(NC.teal, -5.6, 2 * 0.4, 1.0, -1.9); sm('base 2', -6.6, -1.5);
    const i = 1 * 0.02 * 100; ok(near(i, 2), 'I：1 × 2% × 100 = 2 ✓', -1.2, -0.6);
    S.b1 = vbar(NC.green, -5.6, i * 0.4, 1.0, -1.1);
    cap('I-cache：100% × 2% × 100', '每個 instruction 平均多 2 個 cycle');
  },
  async (tok, S) => { // @1687.8 ~平均是兩個到icash的話
    const d = 0.36 * 0.04 * 100; ok(near(d, 1.44), 'D：36% × 4% × 100 = 1.44 ✓', -1.2, -1.2);
    S.b2 = vbar(NC.blue, -5.6, d * 0.4, 1.0, -0.3);
    cap('D-cache：36% × 4% × 100', '= 1.44');
  },
  async (tok, S) => { // @1711.5 ~所以你要把基本的CPI
    const cpi = 2 + 1 * 0.02 * 100 + 0.36 * 0.04 * 100; ok(near(cpi, 5.44), 'actual CPI = 2 + 2 + 1.44 = 5.44 ✓', -1.2, -1.8);
    hot('CPI 5.44', -5.6, 0.65);
    cap('actual CPI = base 2 + 2 + 1.44', '= 5.44');
  },
]);

scene('mh-23b-amat', 'AMAT = hit time + miss rate × miss penalty', [
  async (tok, S) => { // @1757.5 ~就是這個跟以前的演算法是一樣
    hd('AMAT（average memory access time）', 0, 6.6);
    cap('average access time', '也是同樣的概念');
  },
  async (tok, S) => { // @1769.2 ~不管你hit miss 其實都有這個時間
    S.f1 = hot('hit time', -3.6, 5.8);
    cap('不管 hit 或 miss', '前段的 hit time 都已經用掉了');
  },
  async (tok, S) => { // @1777.7 ~要再加上後段的
    S.f2 = hot('+ miss rate × miss penalty', 0.2, 5.8);
    cap('萬一是 miss', '再加上額外的 miss penalty');
  },
  async (tok, S) => { // @1808.0 ~然後之後才加上 miss rate
    S.ex = list(-3.4, 4.8);
    S.ex.add('例：clock 1 ns、hit time 1 cycle'); S.ex.add('miss penalty 20 cycles、I-cache miss rate 5%');
    S.sq = Array.from({ length: 20 }, (_, k) => bx('', k === 7 ? NC.red : NC.green, 1.0 + (k % 10) * 0.55, 4.6 - Math.floor(k / 10) * 0.55, 0, 0.45, 0.45, 0.45));
    cap('例子：1 ns 的 clock、hit time 1 cycle', 'miss penalty 20 cycles、miss rate 5%（20 次裡 1 次）');
  },
  async (tok, S) => { // @1823.2 ~那平均的average exit time是多少
    const a = 1 + 0.05 * 20; ok(near(a, 2), 'AMAT = 1 + 0.05 × 20 = 2 cycles = 2 ns ✓', 0, 3.0);
    S.b1 = vbar(NC.green, -3.0, 1.0, 1.4, 0.2); S.b2 = vbar(NC.red, -3.0, 1.0, 1.4, 1.2); sm('hit 1', -4.3, 0.7); sm('0.05 × 20 = 1', -4.6, 1.7);
    cap('1 一定要加在前面', '1 + 5% × 20 = 2 個 cycle，也就是 2 ns');
  },
  async (tok, S) => { // @1840.1 ~這樣瞭解嗎知道嗎就是說這個地方
    const wrong = 0.95 * 1 + 0.05 * 20;
    bad('✘ 不是 0.95 × 1 + 0.05 × 20 = ' + fx(wrong), 2.4, 1.6);
    cap('不是 1 × 0.95', '不是一半 hit 一半 miss 那樣拆');
  },
  async (tok, S) => { // @1862.9 ~這個地方乘以100%
    ok(near(1 * 1.0 + 0.05 * 20, 2) && near(0.95 * 1 + 0.05 * (1 + 20), 2), 'hit time × 100%；只有 miss 的 5% 多付 20 ✓（等同 0.95×1 + 0.05×21）', 1.6, 0.9);
    cap('hit time 乘的是 100%', 'miss 的 0.05 只是額外（extra）的部分');
  },
]);

scene('mh-23b-why', 'CPU 越快，cache 越重要', [
  async (tok, S) => { // @1878.7 ~它都告訴我們 就是說Cache很重要
    hot('Cache 很重要，設計 processor 不能忘了它', 0, 6.6);
    cap('performance summary', 'cache 很重要，常常被忽略');
  },
  async (tok, S) => { // @1887.7 ~你在設計Processor的時候
    sm('CPU performance 提高 → miss penalty 佔的比例更 significant', 0, 6.0);
    cap('把 CPU 做得更快', 'miss penalty 反而變得更 significant');
  },
  async (tok, S) => { // @1904.1 ~把base的CPI
    const s1 = 3.44 / 5.44, s2 = 3.44 / 4.44;
    S.a = [vbar(NC.teal, -3.0, 2 * 0.6, 1.2, 0.3), vbar(NC.red, -3.0, 3.44 * 0.6, 1.2, 0.3 + 1.2)]; sm('base 2', -3.0, -0.1);
    S.b = [vbar(NC.teal, 0.2, 1 * 0.6, 1.2, 0.3), vbar(NC.red, 0.2, 3.44 * 0.6, 1.2, 0.3 + 0.6)]; sm('base 1', 0.2, -0.1);
    ok(near(Math.round(s1 * 100), 63) && near(Math.round(s2 * 100), 77), '示意（P&H）：stall 佔 63% → 77% ✓', 3.2, 4.8);
    cap('把 base CPI 降低', 'stall 不變，佔的比例反而更大');
  },
  async (tok, S) => { // @1922.8 ~他其實佔的比例會更大或是說你把
    sm('clock rate 變快：memory 時間不變 → stall 的 cycle 數變多', 3.2, 4.2);
    cap('把 clock rate 提高', 'memory 的時間不變，換算成 cycle 就更多');
  },
  async (tok, S) => { // @1943.0 ~後面還要給大家看一個圖這
    note('寫 program 也一樣：只看 big O、不看 memory access pattern 會失準', 0, -0.7);
    cap('寫 program 也是', '只算 instruction 數，不管 memory access pattern，結果差很多');
  },
]);

scene('mh-23b-improve', '要 improve cache：hit time、miss rate、miss penalty', [
  async (tok, S) => { // @1974.6 ~的話你要improve它
    hot('不滿意 performance：要怎麼 improve cache？', 0, 6.4);
    cap('basic 的部分講完了', '如果 performance 不滿意，要怎麼 improve？');
  },
  async (tok, S) => { // @2005.6 ~hit time hit的時間
    S.t1 = bx('hit time', NC.green, -4.0, 4.6, 0, 2.4, 0.7);
    cap('第一個：hit time', '檢查 data 在不在 cache 的時間，要減少');
  },
  async (tok, S) => { // @2062.3 ~怎麼樣去算出來了嗎要hit time
    hd('AMAT = hit time + miss rate × miss penalty', 0, 5.6);
    cap('公式裡有三個變數', 'hit time、miss rate、miss penalty');
  },
  async (tok, S) => { // @2131.6 ~最後的結果是由這三個變數所決定
    S.t2 = bx('miss rate', NC.orange, 0, 4.6, 0, 2.4, 0.7); S.t3 = bx('miss penalty', NC.red, 4.0, 4.6, 0, 2.4, 0.7);
    cap('結果由三個變數決定', '可以從任何一個下手，讓它變小');
  },
  async (tok, S) => { // @2150.2 ~improve 它 performance 所以我們可以
    [S.t1, S.t2, S.t3].forEach((m) => glow(m, HL));
    note('三個方向：reduce hit time、decrease miss rate、decrease miss penalty', 0, 3.4);
    cap('接下來要介紹', '降低 hit time、miss rate、miss penalty 的方法');
  },
]);

const ALT4 = [1, 9, 17, 25, 1, 9, 17, 25];
scene('mh-23b-dmbad', 'Direct-mapped 的缺點：一個號碼只有一張椅子', [
  async (tok, S) => { // @2164.2 ~先看我們原來是怎麼設計的
    dmGrid(S); S.mem.forEach((m, b) => relabel(m, b2(b, 5))); S.cache.forEach((m, i) => relabel(m, b2(i, 3)));
    cap('原來怎麼設計的？', 'direct-mapped');
  },
  async (tok, S) => { // @2207.7 ~好 上面假有8個對不對
    cap('上面 8 個', '下面 32 個');
  },
  async (tok, S) => { // @2230.6 ~它的地址餘數
    for (const b of [1, 9, 17, 25]) tint(S.mem[b], NC.orange); tint(S.cache[1], NC.orange);
    for (const b of [5, 13, 21, 29]) tint(S.mem[b], NC.gray); tint(S.cache[5], NC.dark);
    cap('下面地址除以上面的數目', '餘數就是位置：橘紅色都到橘紅色那格');
  },
  async (tok, S) => { // @2263.8 ~人到那邊 1 2 3 4
    sm('同一格好幾個人 → 用 high-order bits（tag）比對', 0, -0.25);
    cap('好幾個人到同一格', '用 high-order bits（tag）去比對');
  },
  async (tok, S) => { // @2270.0 ~structure 那你覺得它缺點是什麼
    hot('缺點是什麼？', 4.6, 6.6);
    cap('direct-mapped 的缺點', '是什麼？');
  },
  async (tok, S) => { // @2278.1 ~我現在access就是這樣我的memory
    S.R = csim(ALT4, 8, 1); S.st = hd('', 0, -0.85);
    S.seq = ALT4.map((a, k) => sm(String(a), -2.6 + k * 0.75, 6.65));
    cap('如果 access pattern 剛好是', '1、9、17、25 這四個橘紅色輪流（示意）');
  },
  async (tok, S) => { // @2294.6 ~就是第一個橘紅色第二個橘紅色
    let n = 0;
    for (let k = 0; k < ALT4.length; k++) {
      const r = S.R[k]; S.seq[k].element.className = 'lab-label ptr alt'; relabel(S.cache[1], b2(ALT4[k], 5)); glow(S.cache[1], r.hit ? OKG : NG); glow(S.mem[ALT4[k]], HL);
      await wt(tok, 260); glow(S.mem[ALT4[k]], null); if (!r.hit) n++;
    }
    txt(S.st, 'miss ' + n + ' / ' + ALT4.length);
    ok(S.R.every((r) => !r.hit), '全部 map 到 001 → 一直互相踢出去：8 次全 miss ✓', 0, -1.45);
    cap('四個都 map 到同一個位置', '第二個來，第一個就出去……一直 miss');
  },
  async (tok, S) => { // @2313.7 ~也就是說一個人一個位一個號碼
    note('一個號碼只有一張椅子', -3.6, -2.05);
    cap('一個號碼裡只有一張椅子', '一次只能坐一個人');
  },
  async (tok, S) => { // @2322.9 ~如果你剛好呢是同時這四個人他
    [0, 2, 3, 4, 5, 6, 7].forEach((i) => glow(S.cache[i], HL));
    bad('其他 7 格都空著！', 3.6, -2.05);
    cap('其實 cache 其他位置都沒人坐', '這四個人卻都擠同一個位置');
  },
  async (tok, S) => { // @2367.6 ~就要出去這樣好
    [0, 2, 3, 4, 5, 6, 7].forEach((i) => glow(S.cache[i], null));
    hot('限制太大 → 要改善它', 4.6, 6.0);
    cap('限制太大了', '要 improve 它');
  },
]);

scene('mh-23b-fully', 'Fully associative：坐哪裡都可以', [
  async (tok, S) => { // @2375.3 ~應該怎麼樣最直接的方法improve
    dmGrid(S); S.mem.forEach((m, b) => relabel(m, b2(b, 5))); S.cache.forEach((m) => relabel(m, '空'));
    for (const b of [1, 9, 17, 25]) tint(S.mem[b], NC.orange);
    cap('最直接的改善', '不要給固定位置：上面任何一個空位都可以坐');
  },
  async (tok, S) => { // @2399.2 ~極端對不對這是一個極端一個呢是
    S.R = csim(ALT4, 1, 8); S.seq = ALT4.map((a, k) => sm(String(a), -2.6 + k * 0.75, 6.65));
    for (let k = 0; k < ALT4.length; k++) {
      const r = S.R[k]; S.seq[k].element.className = 'lab-label ' + (r.hit ? 'good' : 'bad');
      if (!r.hit) { relabel(S.cache[r.way], b2(ALT4[k], 5)); tint(S.cache[r.way], NC.orange); }
      glow(S.cache[r.way], r.hit ? OKG : NG); await wt(tok, 220);
    }
    ok(S.R.filter((r) => r.hit).length === 4, '同樣 1, 9, 17, 25 輪流：只有前 4 次 miss，之後全 hit ✓', 0, -0.2);
    cap('有空位就擺：第一個放第一格、第二個放第二格', '同樣的 pattern，後面全部 hit');
  },
  async (tok, S) => { // @2420.0 ~Fully Associated 那另外一個極端
    hd('fully associative：另一個極端', 0, 7.15);
    cap('這叫 fully associative', '另一個極端');
  },
  async (tok, S) => { // @2461.4 ~不知道在哪裡那你要記錄什麼
    note('沒有 index：要把整個 block address 存成 tag', 0, -0.8);
    cap('那要找的時候，不知道在哪一格', '要把前面的地址全部記錄下來（tag）');
  },
  async (tok, S) => { // @2517.7 ~知道哪個位置我從頭開始check
    S.cache.forEach((m) => glow(m, HL));
    cap('access 時不知道在哪', '每一個位置都有可能，都要 check');
  },
  async (tok, S) => { // @2539.7 ~那你是sequent去check它嗎
    S.bd = bad('一格一格 sequential check：8 格要 8 次，太慢', 0, -1.35);
    cap('一個一個 sequential check？', '8 個 entry 就要 8 次，太慢了');
  },
  async (tok, S) => { // @2573.8 ~這樣顯然不是sequential的check
    S.cmp = S.cache.map((m, i) => bx('=?', NC.gold, S.cx(i), 4.85, 0.6, 0.6, 0.35, 0.4));
    gone(S.bd); good('同時 check：每個 entry 一個 comparator（8 個）', 0, -1.35);
    cap('所以要同時 check', '8 個 element 就要 8 個 comparator');
  },
  async (tok, S) => { // @2603.3 ~第二個就是說你在任何位置都可以
    note('優點：很彈性、不浪費位置　缺點：comparator 很多，hardware 貴', 0, -2.0);
    cap('優點：很彈性，絕不浪費', '缺點：要很多 hardware 做比對');
  },
]);

const ALT2 = [1, 9, 1, 9, 1, 9];
scene('mh-23b-setassoc', 'Set associative：一個號碼幾張椅子', [
  async (tok, S) => { // @2625.7 ~也就是太自由了
    hot('fully 太自由：一個號碼裡兩個或四個位置就好', 0, 6.65);
    cap('fully associative 太自由了', '一個號碼裡兩個或四個位置就好');
  },
  async (tok, S) => { // @2634.1 ~兩個位置兩個位置或四個位置就好了
    hd('set associative：direct-mapped 與 fully 的折衷', 0, 6.05);
    cap('這叫 set associative', 'direct-mapped 和 fully associative 的折衷');
  },
  async (tok, S) => { // @2642.6 ~所以在中間的也就是說
    S.dm = ctab({ rows: 8, cols: 1, x: -4.4, y: 5.0, cw: 1.5, ch: 0.42, rl: (r) => b2(r, 3), rlw: 0.55 });
    S.sa = ctab({ rows: 4, cols: 2, x: 1.4, y: 5.0, cw: 1.5, ch: 0.42, rl: (r) => 'set ' + r, rlw: 0.75 });
    sm('direct-mapped（8 格）', -4.4, 5.5); sm('2-way（4 個 set × 2）', 2.2, 5.5);
    cap('一樣先 map 到一個號碼', '但這個號碼裡有兩個位置');
  },
  async (tok, S) => { // @2659.8 ~axe這個再axe這個
    S.seq = ALT2.map((a, k) => sm(String(a), -2.0 + k * 0.8, 0.0));
    S.sx = sm('（示意：兩個橘紅色 1、9 交替）', 4.6, 0.0);
    cap('假如兩個橘紅色交替 access', '1、9、1、9……');
  },
  async (tok, S) => { // @2665.0 ~假如原來derive map的話只能擺
    S.R1 = csim(ALT2, 8, 1);
    for (let k = 0; k < ALT2.length; k++) { const r = S.R1[k]; S.dm.put(1, 0, String(ALT2[k]), NC.orange); S.dm.fl(1, 0, r.hit ? OKG : NG); await wt(tok, 250); }
    ok(S.R1.every((r) => !r.hit), 'direct-mapped：6 次全 miss ✓', -4.4, 0.6);
    cap('direct-mapped 只能擺一個人', '這個進來那個就出去：miss、miss、miss');
  },
  async (tok, S) => { // @2689.1 ~那可是如果我這裡面一個號碼裡面
    S.R2 = csim(ALT2, 4, 2);
    for (let k = 0; k < ALT2.length; k++) { const r = S.R2[k]; if (!r.hit) S.sa.put(r.s, r.way, String(ALT2[k]), NC.orange); S.sa.fl(r.s, r.way, r.hit ? OKG : NG); await wt(tok, 250); }
    ok(S.R2.filter((r) => r.hit).length === 4 && S.R2[0].s === 1 && S.R2[1].s === 1, '2-way：1 mod 4 = 9 mod 4 = 1，同一個 set 兩張椅子 → 只有 2 次 miss ✓', 2.0, -0.6);
    cap('一個號碼有兩個位置', '兩個都在裡面，交替 access 就不會 miss 了');
  },
  async (tok, S) => { // @2729.5 ~兩個那當然你可以做
    sm('4 張椅子更彈性；全部同一個 set → fully associative', 0, -1.15);
    cap('做到 4 個就更彈性', '全部都在同一個 set，就是 fully associative');
  },
  async (tok, S) => { // @2744.6 ~所以direct map
    hd('fully associative：沒有 index，每個 entry 一個 comparator', 0, -1.7);
    cap('fully associative：block 到任何 entry', '沒有 index；每個 entry 都要 comparator，很貴');
  },
  async (tok, S) => { // @2794.8 ~很貴那另外一個呢
    hd('n-way set associative：每個 set 有 n 個 entry', 0, -2.25);
    cap('n-way set associative', '一個 set 就像 direct-mapped 的一格，但裡面有 n 張椅子');
  },
  async (tok, S) => { // @2840.7 ~所以它要算就算成什麼東西呢
    ok(9 % 4 === 1, 'set = (block number) mod (set 數)：9 mod 4 = 1 ✓', 2.2, 2.6);
    cap('怎麼算位置？跟 direct-mapped 很像', '先算 set：block number mod 有幾個 set');
  },
  async (tok, S) => { // @2882.3 ~set在cache裡面
    S.sa.fl(1, 0, HL); S.sa.fl(1, 1, HL);
    good('只在 set 裡找：2-way 只比 2 個', 2.2, 2.05);
    cap('search 時只在那個 set 裡找', '2-way 只要 check 兩個 element');
  },
  async (tok, S) => { // @2920.3 ~你可以說如果我們就以set associated來看
    gone(S.seq, S.sx); sm('direct-mapped = 1-way；fully = n-way（n = cache block 數）', 1.6, 0.0);
    cap('都用 set associative 的角度看', 'direct-mapped 是 1-way，fully associative 是 n-way');
  },
  async (tok, S) => { // @2956.1 ~只要在set裡面去search它就可以
    note('2-way 2 個、4-way 4 個 comparator；比 fully 便宜，但彈性小一點', 1.4, 1.2);
    cap('2-way 只要 2 個 comparator，4-way 要 4 個', '不用整個 cache 都有 comparator，但彈性沒那麼大');
  },
]);

// ════════ 1fhK7KF8hgE（第 24A 講：associativity、block 12、0,8,0,6,8、4-way 實作、replacement、multilevel） ════════
scene('mh-24a-review', '複習：hierarchy 與四個問題', [
  async (tok, S) => { // @17.0 ~好 我們今天繼續開始
    S.lv = [['SRAM', NC.green, 2.0], ['DRAM', NC.blue, 4.0], ['disk', NC.metal, 6.0]].map(([t, c, w], i) => bx(t, c, -1.6, 6.0 - i * 0.8, 0, w, 0.6));
    cap('memory 不同 technology', '容量、速度、價錢都不一樣');
  },
  async (tok, S) => { // @20.6 ~什麼叫locality呢
    sm('locality：90% 的時間只用 10% 的 program', 3.8, 6.6);
    cap('locality', '90% 的時間只用 10% 的 program');
  },
  async (tok, S) => { // @22.0 ~那因為program的locality的關係
    sm('近：快、小、貴　遠：便宜、大、慢 → 看起來又快又大', 3.8, 6.1);
    cap('所以把 memory 變成 hierarchy', 'process 看到的是又快又大的 memory');
  },
  async (tok, S) => { // @74.9 ~我們上次介紹說然後第一層就是在
    S.cpu = bx('CPU', NC.teal, -5.8, 3.4, 0, 1.0, 0.6); S.c = bx('cache（SRAM）', NC.green, -3.4, 3.4, 0, 2.4, 0.6); S.m = bx('main memory', NC.blue, 0.2, 3.4, 0, 2.4, 0.6);
    cap('第一層：memory 和 processor 之間', '加一層 cache，用 SRAM 做');
  },
  async (tok, S) => { // @93.1 ~我們說比較靠近Process之間叫做
    sm('upper level', -3.4, 2.75); sm('lower level', 0.2, 2.75);
    cap('靠近 processor 的叫 upper level', 'main memory 是 lower level');
  },
  async (tok, S) => { // @117.8 ~所以我們有一個placement的問題
    S.q = list(3.6, 4.0); S.q.add('① placement：怎麼放？', 'ptr');
    cap('只有少部分能放上去', '第一個問題：placement');
  },
  async (tok, S) => { // @129.9 ~如果有placement的問題當然就
    S.q.add('② finding：怎麼找？', 'ptr');
    cap('怎麼擺，就有怎麼找的問題', 'finding the block');
  },
  async (tok, S) => { // @138.8 ~那還有一個什麼問題就是
    S.q.add('③ replacement：誰出去？', 'ptr');
    cap('不能全部擺在上面', '競爭時誰要被放回 lower level：replacement');
  },
  async (tok, S) => { // @149.8 ~一個write的問題
    S.q.add('④ write：upper / lower 不一致', 'ptr');
    cap('還有 write 的問題', '寫了會造成 upper 和 lower level 不一致');
  },
  async (tok, S) => { // @175.6 ~可以這個系統整個就瞭解了
    note('四個問題搞清楚，系統就懂了；memory ↔ disk 也一樣', 0, 0.6);
    cap('四個問題都搞清楚', 'cache 就懂了；今天還會看到 main memory 和 secondary 之間也一樣');
  },
]);

const ALT08 = [0, 8, 0, 8, 0, 8];
scene('mh-24a-three', 'Direct-mapped 的問題 → fully associative → set associative', [
  async (tok, S) => { // @189.9 ~了把它解決那這個系統就全部瞭解
    hot('placement 第一種：direct-mapped', 0, 6.7);
    cap('placement 最簡單的', '叫 direct-mapped，但它有一些缺點');
  },
  async (tok, S) => { // @203.2 ~performance 我們就可以從三個角度
    ['hit time ↓', 'miss rate ↓', 'miss penalty ↓'].forEach((t, i) => note(t, -3.4 + i * 3.4, 6.1));
    cap('improve cache performance', '從三個角度：hit time、miss rate、miss penalty');
  },
  async (tok, S) => { // @216.6 ~改進這個derive map DirectMate是第一個
    S.ct = ctab({ rows: 1, cols: 8, x: -4.9, y: 5.0, cw: 1.25, ch: 0.5, empty: '' }); S.ct.cells[0].forEach((m, i) => relabel(m, String(i)));
    S.mem = Array.from({ length: 16 }, (_, b) => bx(String(b), NC.off, -4.9 + (b % 8) * 1.35, 3.8 - Math.floor(b / 8) * 0.6, 0, 1.2, 0.45));
    cap('direct-mapped：每個人都有固定位置', 'upper level 8 個 block，照次序排');
  },
  async (tok, S) => { // @239.8 ~那怎麼去找這固定位置
    tint(S.mem[0], NC.orange); tint(S.mem[8], NC.orange); tint(S.ct.cells[0][0], NC.orange);
    cap('找位置：lower level 地址除以 upper 的數目', '餘數就是位置：0 和 8 都到第 0 格（示意）');
  },
  async (tok, S) => { // @260.2 ~跟finding the block的方法那好
    S.R = csim(ALT08, 8, 1); S.seq = ALT08.map((a, k) => sm(String(a), -2.0 + k * 0.8, 2.4));
    for (let k = 0; k < ALT08.length; k++) { const r = S.R[k]; S.ct.put(0, 0, String(ALT08[k])); S.ct.fl(0, 0, r.hit ? OKG : NG); S.seq[k].element.className = 'lab-label ' + (r.hit ? 'good' : 'bad'); await wt(tok, 300); }
    ok(S.R.every((r) => !r.hit), '0、8 交替：每次都把對方踢出去 → 全 miss ✓', 0, 1.8);
    cap('如果交替 access 這兩個橘紅色', '同一個位置只能放一個，一直 replace、一直 miss');
  },
  async (tok, S) => { // @314.0 ~catch miss catch miss 所以大家同樣去
    S.ct.cells[0].slice(1).forEach((m) => glow(m, HL));
    bad('其他位置都空著', 4.4, 4.45 - 0.0 + 0.0);
    cap('大家都擠這個位置', '其他位置搞不好都是空的：不是好的 structure');
  },
  async (tok, S) => { // @333.1 ~每個人都要在同一個位置呢你cash
    S.ct.cells[0].slice(1).forEach((m) => glow(m, null));
    hd('fully associative：只要有空就可以進去', 0, 1.2);
    cap('另一個極端', '沒有固定位置，有空位就進去：fully associative');
  },
  async (tok, S) => { // @362.1 ~Fully Associated 這差別在哪裡
    sm('direct-mapped：只比對那一格的 tag（1 個 comparator）', 0, 0.65);
    cap('差別：direct-mapped', '只要比對那個位置的 tag');
  },
  async (tok, S) => { // @416.9 ~upper level的tag就可以了
    sm('fully：每格都要存 address、都要比對', 0, 0.15);
    cap('fully associative 可能擺任何一格', '每一格都要存 address，access 時通通都要比對');
  },
  async (tok, S) => { // @451.2 ~那好但是這個雖然很好
    S.cmp = S.ct.cells[0].map((m, i) => bx('=?', NC.gold, S.ct.px(i), 5.65, 0.4, 0.55, 0.32, 0.4));
    bad('8 個 comparator 同時比（sequential 太慢）', 0, -0.4);
    cap('雖然很好，但 hardware 很多', 'access 一個 element 要 8 個 comparator 同時比對');
  },
  async (tok, S) => { // @484.2 ~那你說一個極端叫做只有一個位置
    note('取中間：set associative', 0, -1.0);
    cap('一個極端只有一個位置、一個全部都可以', '取個中間：set associative');
  },
]);

scene('mh-24a-sets', 'Set associative：先找 set，再在 set 裡比對', [
  async (tok, S) => { // @493.1 ~也就是說跟Daramap很像
    S.h8 = ctab({ rows: 1, cols: 8, x: -4.9, y: 6.0, cw: 1.25, ch: 0.5, empty: '' });
    sm('原本：8 家，每家 1 個房間（direct-mapped）', 0, 6.6);
    cap('跟 direct-mapped 很像', '但一個號碼（一戶）裡可以有兩個或四個房間');
  },
  async (tok, S) => { // @522.48 ~的那個概念找到這個地址
    S.h4 = ctab({ rows: 4, cols: 2, x: -4.6, y: 5.0, cw: 1.25, ch: 0.45, rl: (r) => 'set ' + r, rlw: 0.75 });
    sm('2-way：4 家，每家 2 個房間', 1.6, 5.0);
    cap('一樣用 modulo 的概念', '找到地址、找到這個 set');
  },
  async (tok, S) => { // @531.08 ~不對你看以前是說
    ok(8 / 2 === 4, '8 個 entry、每 set 2 個 → 4 個 set：以前除以 8，現在除以 4 ✓', 1.8, 4.45);
    cap('以前 8 個 entry，除以 8', '現在拆成 4 家，每家 2 間，所以除以 4');
  },
  async (tok, S) => { // @587 ~在這種狀況之下你要去找set找到之後
    S.h4.fl(1, 0, HL); S.h4.fl(1, 1, HL); S.cm = [0, 1].map((c) => bx('=?', NC.gold, -1.9 + c * 0.6, S.h4.py(1), 0.3, 0.5, 0.36, 0.4));
    cap('找到 set 之後', '兩個房間都可能：要同時比對 2 個 tag，2 個 comparator');
  },
  async (tok, S) => { // @614.64 ~比比剛才八個是少了對不對
    good('2 個 comparator：比 fully 的 8 個少，比 direct 的 1 個多', 1.8, 3.9);
    cap('比剛才 8 個少', '比 direct-mapped 只有 1 個多一點：取中間');
  },
  async (tok, S) => { // @632.08 ~三種mapping的方法
    S.l = list(2.0, 3.3); S.l.add('direct-mapped：一個位置'); S.l.add('fully associative：任何位置');
    cap('三種 mapping', 'direct-mapped 只到一個位置；fully associative 任何位置都可以');
  },
  async (tok, S) => { // @654.36 ~只不過在同一個位置它的law order
    S.l.add('fully：沒有共同 low-order → 整個 address 當 tag');
    cap('其實要存的是 address 和 data', 'fully associative 沒有共同的 low-order，tag 更長');
  },
  async (tok, S) => { // @669.76 ~DirectMap跟Fullier Associate
    S.l.add('set associative：mod set 數找家，家裡 fully 比對');
    cap('set associative：取中間', '除以 set number 找到家，家裡面再做 fully associative 的 check');
  },
  async (tok, S) => { // @716.54 ~就是剛剛講到我允許一個block
    sm('fully：comparator per entry（8 格要 8 個、16 格要 16 個）', 0, 1.05);
    cap('fully associative：每個 entry 都要 search', '8 個位置 8 個 comparator，16 個就 16 個');
  },
  async (tok, S) => { // @775.78 ~所以n代表就是說你這set裡面有
    hd('n-way：每個 set 有 n 個 block（2-way、4-way）', 0, 0.5);
    cap('n 代表一個 set 裡有幾個 block', '2 個叫 two-way，4 個叫 four-way');
  },
  async (tok, S) => { // @790.56 ~如果two-way的話表示一個set裡面
    sm('2-way → 2 個 comparator；4-way → 4 個', 0, -0.05);
    cap('two-way 要 2 個 comparator', 'four-way 要 4 個');
  },
  async (tok, S) => { // @815.34 ~的話它的加它的地址
    ok([8, 4, 2].map((s) => Math.log2(s)).join() === '3,2,1', 'index：8 個 set 3 bits → 4 個 set 2 bits → 2 個 set 1 bit ✓', 0, -0.6);
    cap('index 的 bit 數', '8 家用 3 bits；4 家 2 bits；2 家只要 1 bit');
  },
  async (tok, S) => { // @871.14 ~這件事情就沒有了
    bad('fully：沒有 index', 0, -1.15);
    cap('fully associative 有沒有 index？', '沒有了，任何位置都可以');
  },
  async (tok, S) => { // @887.8 ~每一個set就contain n個entries
    note('set = (block number) mod (set 數)，不是除以 block 數', 0, -1.7);
    cap('n-way：每個 set 有 n 個 entry', 'block number mod set number 決定在哪個 set');
  },
  async (tok, S) => { // @978.14 ~fully associated 去check這四個entry
    S.h4.fl(1, 0, OKG); S.h4.fl(1, 1, OKG);
    cap('set 裡面再 fully associative 地 check', '有幾個 block 就要幾個 comparator，同時比');
  },
]);

scene('mh-24a-block12', 'P&H 例：block 12 放在哪？', [
  async (tok, S) => { // @1002.54 ~我們再用這不同的圖來表示一下
    S.rows = [['direct-mapped', 1, 5.6], ['2-way set associative', 2, 3.4], ['fully associative', 8, 1.2]].map(([n, w, y]) => {
      const cells = Array.from({ length: 8 }, (_, k) => { const s = Math.floor(k / w); return bx(w === 1 ? String(k) : w === 8 ? '' : 's' + s, NC.off, -4.6 + k * 1.15 + (w === 2 ? s * 0.25 : 0), y, 0, 1.0, 0.45); });
      hd(n, -4.0, y + 0.75); return { w, y, cells };
    });
    cap('用不同的圖再表示一次', '同樣 8 個 entry，三種組織');
  },
  async (tok, S) => { // @1017.64 ~它地址是12 我要擺進來擺到這個
    const i = 12 % 8; tint(S.rows[0].cells[i], NC.pink); glow(S.rows[0].cells[i], HL);
    ok(i === 4, 'direct-mapped：12 mod 8 = 4 → 只能放第 4 格（比 1 個 tag）✓', 2.4, 6.35);
    cap('block address 12', 'direct-mapped：12 除以 8，餘 4，就在這個位置');
  },
  async (tok, S) => { // @1027.58 ~那如果是2-way的set
    sm('8 個 entry、每 set 2 個 → 4 個 set（0–3）', 2.4, 4.15);
    cap('2-way set associative', '先看有幾個 set：8 ÷ 2 = 4 個');
  },
  async (tok, S) => { // @1043.8 ~所以地址就變成0123了
    const s = 12 % 4; S.rows[1].cells.slice(s * 2, s * 2 + 2).forEach((m) => { tint(m, NC.pink); glow(m, HL); });
    ok(s === 0, '12 mod 4 = 0 → set 0 的任一格 ✓', 2.4, 2.75);
    cap('12 除以 4', '會 map 到 set 0');
  },
  async (tok, S) => { // @1050.6 ~所以會map到0這個set
    sm('set 0 有 2 個 entry → 2 個 comparator 同時 search', 1.4, 2.3);
    cap('set 0 有兩個 entry', '要兩個 comparator 同時 search');
  },
  async (tok, S) => { // @1069.9 ~這setassociate 如果fully associated
    S.rows[2].cells.forEach((m) => { tint(m, NC.pink); glow(m, HL); });
    sm('任何位置都可以 → 8 個 comparator', 2.4, 0.5);
    cap('fully associative', '任何空位都可以；不知道在哪，要 8 個 comparator 同時比');
  },
  async (tok, S) => { // @1085.4 ~通知在比對那有沒有什麼index的
    note('index：direct 3 bits、2-way 2 bits、fully 沒有 index', 0, -0.3);
    cap('index 呢？', 'direct-mapped 用 3 bits；2-way 用 2 bits；fully 不需要 index');
  },
]);

scene('mh-24a-tagsize', '8 個 block 的四種組織：index 少 1 bit、tag 多 1 bit', [
  async (tok, S) => { // @1109.5 ~沒有問題好 再下來好
    S.org = [[1, 'one-way（direct-mapped）'], [2, 'two-way'], [4, 'four-way'], [8, 'eight-way（fully associative）']];
    S.show = (k) => {
      gone(S.cur); const [w, n] = S.org[k], sets = 8 / w; S.cur = [];
      S.cur.push(hd(n + '：' + sets + ' 個 set', -2.0, 6.7));
      for (let s = 0; s < sets; s++) for (let c = 0; c < w; c++) {
        const x = -6.0 + c * 1.7, y = 6.0 - s * 0.55; // tag and data a bit apart so their names don't touch
        S.cur.push(bx('tag', NC.lilac, x, y, 0, 0.6, 0.42, 0.6), bx('data', NC.sky, x + 0.85, y, 0, 0.85, 0.42, 0.6));
      }
      for (let s = 0; s < sets; s++) S.cur.push(sm(sets > 1 ? 'set ' + s : '', -6.95, 6.0 - s * 0.55));
    };
    S.show(0);
    cap('同樣 8 個 block 的 cache', 'direct-mapped：每一格存 tag 和 data');
  },
  async (tok, S) => { // @1117.3 ~我們說要把Data跟Tag都擺進去
    hot('tag size = address 去掉 index（與 offset）剩下的', 2.6, 1.6);
    cap('tag 的長度會隨組織不同', '其實要存整個 address，只是 index 那段是 redundant 的不用存');
  },
  async (tok, S) => { // @1156.0 ~你有 tag 跟 data data 跟 size 一樣好 2-way
    S.show(1);
    cap('2-way：一個 set 兩個 entry', '變成 4 個 set');
  },
  async (tok, S) => { // @1186.8 ~你要把你的address block
    sm('block address mod 4 → 那個 set 的兩個 tag 同時比', 2.6, 1.05);
    cap('mapping 時 block address 除以 4', '找到 set，兩個 tag 拿出來同時比對');
  },
  async (tok, S) => { // @1205.6 ~是這個還是這個是hit還是miss
    S.show(2);
    cap('4-way', '一個 set 4 個 entry，只剩 2 個 set，4 個 tag');
  },
  async (tok, S) => { // @1230.1 ~有四個tag 好 四個tag 好
    S.show(3);
    cap('8-way 就是 fully associative', '只有一個 set，8 個 tag 都要比對');
  },
  async (tok, S) => { // @1246.5 ~要八個tag在這邊比對好
    S.q = hot('tag 越來越長還是越短？', 2.6, 0.45);
    cap('從上到下', 'tag 的 bit 數怎麼變？');
  },
  async (tok, S) => { // @1295.4 ~比這上面多一個bit 這樣
    gone(S.q); const AB = 5;
    S.tb = S.org.map(([w], k) => { const idx = Math.log2(8 / w), tg = AB - idx; return mt('index ' + idx + ' bits | tag ' + tg + ' bits', 2.6, 0.45 - k * 0.5, 'ptr'); });
    ok([1, 2, 4, 8].map((w) => AB - Math.log2(8 / w)).join() === '2,3,4,5', '示意 5-bit block address：tag 2 → 3 → 4 → 5，每次多 1 bit ✓', 2.6, -1.6);
    cap('每往下一種', 'tag 就比上一個多一個 bit');
  },
  async (tok, S) => { // @1322.16 ~index變0個幣
    sm('index 3 → 2 → 1 → 0；fully：全部都是 tag', 2.6, -2.15);
    cap('index 從 3 個 bit 變 0 個', '剩下全部都是 tag');
  },
  async (tok, S) => { // @1341.6 ~我們變來變去變去其實講的概念
    note('只有一個概念：set number 當 index；1 個 entry/set = direct，全部一個 set = fully', 0, -2.75);
    cap('變來變去其實只有一個概念', 'tag + set number（index）；兩個極端就是 direct-mapped 和 fully');
  },
]);

const SEQ058 = [0, 8, 0, 6, 8];
// 3 個小 cache 表：direct-mapped 4×1、2-way 2×2、fully 1×4
scene('mh-24a-058', 'P&H 例：0, 8, 0, 6, 8 → 5、4、3 次 miss', [
  async (tok, S) => { // @1364.7 ~Fully associated mapping 就是
    S.seq = SEQ058.map((a, k) => sm(String(a), -1.6 + k * 0.8, 6.7)); sm('block address：', -3.4, 6.7);
    cap('再看一個例子：access 0、8、0、6、8', 'direct-mapped、2-way、fully associative 各會怎樣？');
  },
  async (tok, S) => { // @1389.5 ~block呢我有四個block
    S.T = [
      ctab({ rows: 4, cols: 1, x: -5.0, y: 5.6, cw: 1.2, ch: 0.45, rl: (r) => String(r), rlw: 0.45 }),
      ctab({ rows: 2, cols: 2, x: -1.6, y: 5.6, cw: 1.2, ch: 0.45, rl: (r) => 'set ' + r, rlw: 0.7 }),
      ctab({ rows: 1, cols: 4, x: 2.0, y: 5.6, cw: 1.1, ch: 0.45 }),
    ];
    hd('direct-mapped（4 set）', -5.0, 6.2); hd('2-way（2 set）', -1.0, 6.2); hd('fully（1 set）', 3.6, 6.2);
    S.R = [csim(SEQ058, 4, 1), csim(SEQ058, 2, 2), csim(SEQ058, 1, 4)];
    S.L = [list(-5.6, 3.5, 0.4), list(-0.6, 3.5, 0.4), list(4.4, 3.5, 0.4)];
    // each column ends with its own summary line; one shared info line under the columns changes text
    S.go = (o, k) => { const r = S.R[o][k]; S.T[o].calm(); if (!r.hit) S.T[o].put(r.s, r.way, 'M[' + r.b + ']', colOf(r.b)); S.T[o].fl(r.s, r.way, r.hit ? OKG : NG); S.seq.forEach((l, j) => { l.element.className = 'lab-label ' + (j === k ? 'ptr alt' : 'idx'); }); S.L[o].add(r.b + '：' + (r.hit ? 'hit' : 'miss') + (r.victim !== null ? '（踢掉 ' + r.victim + '）' : ''), r.hit ? 'good' : 'bad'); return r; };
    cap('cache 只有 4 個 block', 'direct-mapped 4 個位置；2-way 2 個 set；fully 只有 1 個 set、沒有 index');
  },
  async (tok, S) => { // @1407.7 ~就幾個地址兩個set而已就只有
    S.T[0].cells.flat().forEach((m) => glow(m, HL)); await wt(tok, 400); S.T[0].calm();
    cap('先看 direct-mapped', 'access sequence 從上到下');
  },
  async (tok, S) => { // @1417.3 ~是從上到下因為Exit 0的時候
    S.go(0, 0); cap('0 mod 4 = 0 → index 0', '裡面沒東西：miss，放進去');
  },
  async (tok, S) => { // @1435.0 ~擺進去了把東西擺進去了 memory 0
    S.go(0, 1); cap('8 mod 4 = 0 → 又是同一個位置', '只有一個位置：0 被踢出去，8 進來（miss）');
  },
  async (tok, S) => { // @1461.3 ~沒別的選擇就把它擺進來了好
    S.go(0, 2); cap('再 access 0：又 map 到同一格', '把 8 踢出去，0 回來（miss）');
  },
  async (tok, S) => { // @1470.5 ~知道把你踢出去就把8又踢出去
    S.go(0, 3); cap('6 mod 4 = 2', '第二個位置第一次用：miss，放進去');
  },
  async (tok, S) => { // @1485.7 ~我在access第8
    S.go(0, 4); cap('再 access 8：同一個位置', '又把 0 踢出去：miss');
  },
  async (tok, S) => { // @1496.3 ~exit都是catch miss
    { const g = S.R[0].filter((r) => !r.hit).length === 5; if (!g) log('CHECK FAILED: direct', true); S.L[0].add(g ? 'direct：5 miss ✓' : 'direct ✘', g ? 'good' : 'bad'); }
    cap('每一次都是 cache miss', '0、8 交替，同一個位置只能放一個：限制太大');
  },
  async (tok, S) => { // @1523.0 ~好 那我如果two-way set associative
    S.T[1].cells.flat().forEach((m) => glow(m, HL)); await wt(tok, 400); S.T[1].calm();
    cap('2-way set associative', '4 個 block、一個 set 2 個 → 2 個 set，除以 2');
  },
  async (tok, S) => { // @1555.2 ~所以要除以2 除以2
    S.go(1, 0); cap('0 mod 2 = 0', '跟剛才一樣 miss，但這個 set 可以放兩個');
  },
  async (tok, S) => { // @1562.2 ~裡面可以擺兩個element
    S.go(1, 1); cap('8 mod 2 = 0：同一個 set', '還有一個空位，就擺進去（miss）');
  },
  async (tok, S) => { // @1577.5 ~裡面但是呢因為
    S.go(1, 2); cap('再 access 0', '還在裡面：hit！');
  },
  async (tok, S) => { // @1589.94 ~再來6 又map到為什麼
    const r = S.go(1, 3); S.L[1].add(r.victim === 8 ? '↳ LRU 換掉 8 ✓' : '↳ LRU ✘', r.victim === 8 ? 'good' : 'bad');
    cap('6 mod 2 = 0：set 變少，6 也擠到 set 0', '只有兩個 entry，把最不常用的 8 換出去');
  },
  async (tok, S) => { // @1630.1 ~有一個replacement的機制
    S.go(1, 4); cap('8 又來了：剛剛被搬出去', 'miss，位置不夠，把 0 換出去');
  },
  async (tok, S) => { // @1658.5 ~雖然它裡面增加兩個entry
    S.info = note('set 內 entry 變多，但 set 數變少 → 更多人搶同一個 set', 0, 0.6);
    cap('雖然一個 set 有兩個 entry', '但 set 變少，更多人 map 到這裡搶位置');
  },
  async (tok, S) => { // @1669.8 ~我們就幾個就有一個Hit
    { const g = S.R[1].filter((r) => r.hit).length === 1; S.L[1].add(g ? '2-way：4 miss ✓' : '2-way ✘', g ? 'good' : 'bad'); }
    cap('2-way 的結果', '1 個 hit、4 個 miss');
  },
  async (tok, S) => { // @1675.2 ~空位我就進來
    for (let k = 0; k < 5; k++) { S.go(2, k); await wt(tok, 350); }
    { const g = S.R[2].filter((r) => !r.hit).length === 3; S.L[2].add(g ? 'fully：3 miss ✓' : 'fully ✘', g ? 'good' : 'bad'); }
    cap('fully associative：有空位就進來', '0、8 放進來；0 hit；6 再放進來；8 hit');
  },
  async (tok, S) => { // @1694.8 ~8又再 hit 所以它有兩個 hit
    txt(S.info, 'miss：5 → 4 → 3（associativity ↑，miss rate ↓）');
    cap('fully 有兩個 hit', 'miss rate 最小，但成本最貴');
  },
  async (tok, S) => { // @1705.5 ~因為它每一次比對要幾個
    txt(S.info, '每次比對：direct 1 個、2-way 2 個、fully 4 個 comparator');
    cap('每次找要比對幾個？', 'fully 要 4 個；2-way 2 個；direct-mapped 只要 1 個');
  },
]);

scene('mh-24a-assoc', 'Associativity 的效果越來越小', [
  async (tok, S) => { // @1739.1 ~它會decrease misread
    hot('associativity ↑ → miss rate ↓', 0, 6.6);
    cap('associativity 增加', 'direct-mapped → 2-way → 4-way，miss rate 會降低');
  },
  async (tok, S) => { // @1752.76 ~它降低的比率會越來越小意思
    S.v = [10.3, 8.6, 8.3, 8.1]; S.b = S.v.map((v, i) => vbar([NC.red, NC.orange, NC.blue, NC.green][i], -4.2 + i * 2.6, v * 0.45, 1.4, 0.3));
    ['1-way', '2-way', '4-way', '8-way'].forEach((t, i) => { sm(t, -4.2 + i * 2.6, -0.1); sm(S.v[i] + '%', -4.2 + i * 2.6, S.v[i] * 0.45 + 0.6); });
    sm('P&H：64 KiB data cache、16-word block', 0, -0.6);
    cap('但降低的幅度越來越小', '1-way → 2-way 降了約 2%（10.3% → 8.6%）');
  },
  async (tok, S) => { // @1764.3 ~然後到8位的時候只增加
    const d = [S.v[0] - S.v[1], S.v[1] - S.v[2], S.v[2] - S.v[3]].map((x) => Math.round(x * 10) / 10);
    ok(d[0] === 1.7 && d[1] === 0.3 && d[2] === 0.2, '改善：1.7% → 0.3% → 0.2%，越來越小 ✓', 0, 6.0);
    cap('到 4-way 只再降 0.3%', '到 8-way 只降 0.2%：效果越來越低');
  },
  async (tok, S) => { // @1771.54 ~效果會越低而且不但你增加
    bad('而且 comparator 要一直增加', 0, 5.4);
    cap('效果越來越低', '而且 comparator 還要增加');
  },
]);

// 4-way set associative（P&H 圖）：256 sets、1-word block、32-bit：tag 22 | index 8 | byte 2
scene('mh-24a-4way', '4-way set-associative cache 的實作', [
  async (tok, S) => { // @1775.9 ~你的comparator要增加 那用這個來看看
    S.bs = BS(null, [{ n: 'tag', b: 22, c: FC.tag }, { n: 'index', b: 8, c: FC.index }, { n: 'byte', b: 2, c: FC.offset }], 6.2);
    S.bs.labels.forEach((l) => { l.visible = false; });
    cap('用這張圖看 address 怎麼分配', 'index、tag 怎麼切');
  },
  async (tok, S) => { // @1797.6 ~structure 它是一個 4-way
    S.way = [0, 1, 2, 3].map((w) => { const x = -4.8 + w * 3.2; hd('way ' + w, x, 5.05); return [0, 1, 2].map((r) => ({ v: bx('V', NC.mint, x - 1.1, 4.4 - r * 0.5, 0, 0.4, 0.4, 0.5), t: bx('tag', NC.lilac, x - 0.3, 4.4 - r * 0.5, 0, 1.1, 0.4, 0.5), d: bx('data', NC.sky, x + 0.85, 4.4 - r * 0.5, 0, 1.1, 0.4, 0.5) })); });
    sm('…共 256 個 set（每列是一個 set）', 0, 2.75);
    cap('一個 set 有 4 個 entry', '所以是 4-way set associative');
  },
  async (tok, S) => { // @1811.14 ~的mapping 的cache
    S.q = hot('每個 block 多大？', -3.6, 2.2);
    cap('每個 block 多大？', 'block 是搬進搬出的單位');
  },
  async (tok, S) => { // @1836.6 ~就是一個block啊搬了所以它的
    gone(S.q); S.q = good('data 32 bits = 1 word = 4 bytes', -3.6, 2.2);
    cap('data 是 32 bit', '一個 block 就是一個 word，4 個 byte');
  },
  async (tok, S) => { // @1841.4 ~bit就幾個幾個 byte 四個 byte
    S.bs.labels[2].visible = true; S.bs.cubes.slice(30).forEach((m) => glow(m, HL));
    cap('最後 0、1 兩個 bit 不用（byte offset）', '從 bit 2 開始是 block address');
  },
  async (tok, S) => { // @1873.8 ~前半部就是block address 那你看那這個cash有多少個entry
    S.q2 = hot('cache 有幾個 set？多大？', 2.8, 2.2);
    cap('這個 cache 有多少個 entry？', '幾個 set？size 多大？');
  },
  async (tok, S) => { // @1899.9 ~wall的話它有幾個block
    ok(256 * 4 === 1024, '256 個 set × 4 = 1024 個 block ✓', 2.8, 1.6);
    cap('256 個 set', '每個 set 4 個 block：256 × 4 = 1024 個 block');
  },
  async (tok, S) => { // @1931.9 ~但是呢這麼大cache
    sm('set 數 = block 數 ÷ 4', 2.8, 1.05);
    cap('從 cache size 看', '要除以 4 才是 set 的數目');
  },
  async (tok, S) => { // @1948.4 ~number 那現在有256個set
    S.bs.labels[1].visible = true; S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(22, 30).forEach((m) => glow(m, HL));
    ok(Math.log2(256) === 8, '256 個 set → index 8 bits ✓', -3.6, 1.6);
    cap('256 個 set', 'index 要 8 個 bit 去找第幾個 set');
  },
  async (tok, S) => { // @1979.4 ~所以呢 這個剛剛說這個block address
    sm('block address 的後 8 bits = mod 256 = set index', -3.6, 1.05);
    cap('用 block address 的後半 8 個 bit', '當 index 去找 cache set');
  },
  async (tok, S) => { // @1988.8 ~到底哪一個set 好 找到了對不對好
    gone(S.q, S.q2); S.q = hot('tag 多大？', -3.6, 2.2);
    cap('找到 set 了', '那 tag 多大？');
  },
  async (tok, S) => { // @2032.1 ~但是因為這個已經是index了這是
    S.bs.labels[0].visible = true; S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(0, 22).forEach((m) => glow(m, HL));
    ok(32 - 8 - 2 === 22, 'tag = 32 − 8 − 2 = 22 bits ✓', -3.6, 0.5);
    cap('index 那段已經 implied，不用再存', 'tag = 22 個 bit');
  },
  async (tok, S) => { // @2041.3 ~size多大對 22個bit 但是對一個set來講
    S.way.forEach((w) => w.forEach((e) => glow(e.t, HL)));
    cap('一個 set 有 4 個 block', '4 個 tag 都要放；算 cache size 時要算進去');
  },
  async (tok, S) => { // @2109.1 ~8個bit 就去直接去可以access
    S.way.forEach((w) => w.forEach((e) => glow(e.t, null))); S.way.forEach((w) => { glow(w[1].v, HL); glow(w[1].t, HL); glow(w[1].d, HL); });
    sm('index 8 bits 直接選到這個 set（示意第 1 列）', 2.8, 0.5);
    cap('8 個 bit 直接 access', '選到哪一個 set');
  },
  async (tok, S) => { // @2118.6 ~我們要跟每一個tag都比對這個也
    S.cmp = [0, 1, 2, 3].map((w) => bx('=', NC.gold, -4.8 + w * 3.2 - 0.3, 3.15 - 0.0, 0.5, 0.45, 0.35, 0.4)).map((m) => { m.position.y = -0.2; return m; });
    sm('4 個 tag 同時讀出 → 4 個 comparator', 0, -0.75);
    cap('4 個都有可能', '4 個 tag 讀出來，4 個 comparator 同時比對');
  },
  async (tok, S) => { // @2140.7 ~做比對比對的話如果如果一樣的話
    glow(S.cmp[2], OKG); S.or = bx('OR → hit', NC.green, -6.0, -1.35, 0, 1.6, 0.42);
    cap('比對一樣就輸出 1', '任何一個是 1，經過 OR gate 就是 hit');
  },
  async (tok, S) => { // @2151.2 ~所以是一個all gate又在這個地方
    S.mux = bx('4-to-1 MUX → data', NC.gold, 1.6, -1.35, 0, 2.6, 0.42); glow(S.way[2][1].d, OKG);
    cap('hit 的話是哪一個？', '用比對結果控制 4-to-1 MUX，選出那個 data');
  },
]);

scene('mh-24a-repl', 'Replacement：random、LRU、pseudo-LRU', [
  async (tok, S) => { // @2192.9 ~我們再看看placement的問題剛剛
    S.l = list(-3.2, 6.4, 0.6, 'ptr'); S.l.add('direct-mapped：只有 1 個位置可放');
    cap('複習 placement', 'direct-mapped：只有一個位置，直接擺進去');
  },
  async (tok, S) => { // @2220.0 ~了就直接蓋過去就是了在原來的
    S.l.add('n-way：set 裡 n 個選擇');
    cap('原來在那個位置的人就出去', 'n-way：map 到 set 後有 n 個選擇（2-way 兩個）');
  },
  async (tok, S) => { // @2237.0 ~forward就四個選擇好
    S.l.add('fully：cache 有幾個 block 就幾個選擇');
    cap('4-way 四個選擇', 'fully associative：cache 有 n 個 block 就 n 個選擇');
  },
  async (tok, S) => { // @2261.7 ~有多少的block 好那這三種狀況就搭配
    hot('有選擇 → 要決定誰出去（replacement）', -3.2, 4.4);
    cap('direct-mapped 沒得選', '有 n 個位置時，放這格就要把這格原來的人踢出去');
  },
  async (tok, S) => { // @2290.9 ~說我要這個位置
    bad('選錯：等一下又用到它 → 又搬來搬去', -3.2, 3.8);
    cap('萬一踢掉的人等一下又要用', '又搬來搬去，跟 direct-mapped 的問題一樣');
  },
  async (tok, S) => { // @2325.7 ~所以我們希望搬誰希望是搬那些待
    good('最好踢掉「待會不會再用到」的', -3.2, 3.2);
    cap('希望被 replace 的人', '是待會不會再用到的');
  },
  async (tok, S) => { // @2341.4 ~block replacement 怎麼做catch
    sm('direct-mapped：no choice', 3.4, 6.4);
    cap('cache block replacement', 'direct-mapped 沒有選擇');
  },
  async (tok, S) => { // @2347 ~的沒選擇 好 那set,
    sm('random：隨便挑一個（不想多花 hardware）', 3.4, 5.8);
    cap('set associative 和 fully', '可以 random：不想要額外 hardware，就隨便取一個');
  },
  async (tok, S) => { // @2364.0 ~那另外可能就least recently used
    hd('LRU：換掉最久沒被用的', 3.4, 5.2);
    cap('least recently used（LRU）', '因為 locality：很久沒用的，可能就不會再用了');
  },
  async (tok, S) => { // @2407.36 ~但是如果你要maintain一個真正的
    bad('真正的 LRU：要記錄誰先誰後，hardware 多', 3.4, 4.6);
    cap('維持真正的 LRU 很麻煩', '要記錄每個 block 誰早誰晚，需要比較多 hardware');
  },
  async (tok, S) => { // @2420.44 ~大家嘗試用sudo 用近視就好了
    hd('pseudo-LRU（近似）', 3.4, 4.0);
    cap('所以用近似的就好', 'pseudo-LRU');
  },
  async (tok, S) => { // @2428.7 ~sudo least recently used的機制
    S.e = [bx('A', NC.blue, 1.6, 2.4, 0, 1.4, 0.55), bx('B', NC.green, 3.4, 2.4, 0, 1.4, 0.55)];
    S.p = hot('▲ 下次換這個', 3.4, 1.6);
    for (const [k, x] of [[1, 1.6], [0, 3.4]]) { glow(S.e[k], OKG); await slide(tok, S.p, x, 1.6, 0, 450); glow(S.e[k], null); }
    sm('示意：access 誰，pointer 就移到另一個', 2.5, 1.0);
    cap('兩個 entry 時設一個 pointer', '被指到的就是下次要換掉的；一用到它，pointer 就推到別人');
  },
]);

scene('mh-24a-dmvssa', 'Direct-mapped vs set associative：comparator 與 MUX delay', [
  async (tok, S) => { // @2496.8 ~好 我們把這兩個這個 direct map
    hd('direct-mapped', -3.4, 6.5); hd('n-way set associative', 3.0, 6.5);
    cap('把 direct-mapped 和 n-way set associative', '比較一下');
  },
  async (tok, S) => { // @2501.0 ~cache 比較一下比較一下
    S.c1 = bx('1 comparator', NC.gold, -3.4, 5.6, 0, 2.2, 0.5); S.cn = [0, 1, 2, 3].map((k) => bx('=', NC.gold, 1.5 + k * 1.0, 5.6, 0, 0.8, 0.5));
    cap('n-way 要 n 個 comparator，同時比對', 'direct-mapped 只要一個');
  },
  async (tok, S) => { // @2516.4 ~那再來呢這個N位的
    S.mx = bx('4-to-1 MUX', NC.orange, 3.0, 4.5, 0, 3.2, 0.5);
    cap('4-way 還要一個 MUX', '就算 hit，也不知道是第一、二、三還是第四個');
  },
  async (tok, S) => { // @2543.5 ~所以要Marks去做它那問題出在
    S.t1 = [bx('tag 比對', NC.lilac, 1.2, 3.3, 0, 1.6, 0.45), bx('hit 決定', NC.lilac, 2.9, 3.3, 0, 1.6, 0.45), bx('MUX 選 data', NC.orange, 4.6, 3.3, 0, 1.6, 0.45)];
    sm('要等 hit 決定後，才用 MUX 選 data', 3.0, 2.7);
    cap('問題在哪？', '要等 hit 決定之後，才在 4 筆 data 裡選');
  },
  async (tok, S) => { // @2572.9 ~hit 決定之後才可以做事情 好 如果 direct map
    S.t0 = [bx('tag 比對', NC.lilac, -4.2, 3.3, 0, 1.6, 0.45), bx('data 直接用', NC.green, -4.2, 2.7, 0, 1.6, 0.45)];
    good('只有一筆 data：先拿來用（假設 hit）', -3.4, 2.0);
    cap('direct-mapped 只有一個 entry', '可以先把 data 拿來用，同時比對 tag');
  },
  async (tok, S) => { // @2589.1 ~data 就不要用它就好了嘛
    sm('真的 miss 就丟掉那筆 data（反正 miss 要做很多事）', -3.4, 1.4);
    cap('如果是 miss', '把那筆 data discard 就好');
  },
  async (tok, S) => { // @2614.2 ~說到底是哪一個第一第二所以多一個
    bad('set associative 多一個 MUX delay', 3.0, 1.0);
    cap('set associative 多一個 MUX 的 delay', 'cache access 可能在 pipeline 的 critical path，timing 影響很大');
  },
  async (tok, S) => { // @2662.2 ~hit的話它可以縮短它的時間好 剛才呢
    note('不同 structure：在 hit time、miss rate、miss penalty 之間取捨', 0, 0.4);
    cap('direct-mapped、fully、set associative', '都是在 hit time、miss rate、miss penalty 之間取捨');
  },
]);

scene('mh-24a-multi', 'Multilevel cache：L1 求快、L2 求少 miss', [
  async (tok, S) => { // @2715.2 ~三個他就不一樣 他三個就不一樣的策略那接下來
    hot('另一種加速方法：multilevel cache', 0, 6.6);
    cap('另一種加速的方法', 'multilevel cache');
  },
  async (tok, S) => { // @2730.7 ~第一層cache 第二層cache
    S.cpu = bx('CPU', NC.teal, -5.8, 4.6, 0, 1.0, 0.7);
    S.L = [['L1', NC.green, -4.0, 1.0], ['L2', NC.mint, -2.0, 1.8], ['L3', NC.sky, 0.6, 2.4], ['main memory', NC.blue, 3.9, 3.0]].map(([t, c, x, w]) => bx(t, c, x, 4.6, 0, w, 0.7));
    cap('第一層、第二層', '甚至第三層 cache');
  },
  async (tok, S) => { // @2737.3 ~但是我越靠近我的process的地方
    sm('越靠近 CPU：越小、越快', -3.0, 3.9);
    cap('都用 cache 的 technology', '越靠近 processor 越小、越快');
  },
  async (tok, S) => { // @2746.8 ~primary cache 最靠近我的CPU
    good('L1（primary）：小 → 降低 hit time', -4.0, 5.5);
    cap('primary cache 最靠近 CPU', '主要目的：reduce hit time（small is fast）');
  },
  async (tok, S) => { // @2771.5 ~exit的時間會降低那我另外一層的
    good('L2：大一點 → 降低 miss rate', -2.0, 6.0);
    cap('另一層 cache 做大一點', '目的是降低 miss rate');
  },
  async (tok, S) => { // @2795.9 ~attached到cpu 更小更快 那Level 2
    const g = bx('L1 miss', NC.pink, -4.0, 4.6, 0.6, 1.0, 0.4); await slide(tok, g, -2.0, 4.6, 0.6, 600); kill(g); glow(S.L[1], HL); // the request reaches L2 and L2 lights up (no token left on its name)
    sm('L1 miss 先找 L2，不直接去 memory', -1.0, 3.3);
    cap('L1 miss 時', 'L2 來 serve，不直接去花更久的 memory');
  },
  async (tok, S) => { // @2820.2 ~size又更大但它慢一點它至少還比
    sm('L2 比 L1 慢，但比 memory 快很多；真的放不下才去 memory', 0.6, 2.75);
    cap('L2 大一點、慢一點', '但至少比 memory 快；只剩很少很少要去 main memory');
  },
  async (tok, S) => { // @2844.2 ~雖然它花最長的時間還是可以把
    note('miss 到 memory 的比例很低 → 整體時間下降；high-end 還有 L3', 0, 1.9);
    cap('memory 雖然最慢，但很少去', '整體時間降低；更 high-end 的還有三層');
  },
]);

// ════════ nPiZueMU4fQ（第 24B 講：byte → block address、多層 cache CPI 9 → 3.4、radix vs quick sort、virtual memory 入門） ════════
scene('mh-24b-blockaddr', 'Byte address → block address：先去掉 block 內的 bits', [
  async (tok, S) => { // @18.5 ~這個有一些就是大家搞不清楚的
    hot('給的是 byte address', 0, 6.6);
    cap('大家搞不清楚的地方', '我們給的 address 是 byte address');
  },
  async (tok, S) => { // @19.8 ~好,現在我如果要算
    S.by = Array.from({ length: 16 }, (_, a) => bx(String(a), NC.off, -6.0 + a * 0.8, 5.4, 0, 0.7, 0.45));
    S.wl = [0, 1, 2, 3].map((w) => sm('word ' + w, -4.8 + w * 3.2, 4.8));
    ok(4 === Math.pow(2, 2), '一個 word 4 bytes → 第幾個 word：後 2 bits 不看 ✓', 0, 4.2);
    cap('要算第幾個 word', '一個 word 4 個 byte，後面 2 個 bit 不用看');
  },
  async (tok, S) => { // @50.3 ~的block block是兩個word的話那
    S.q = hot('block = 2 words：後面幾個 bit 不看？', 0, 3.6);
    cap('如果 block 是兩個 word', '後面幾個 bit 不用看？');
  },
  async (tok, S) => { // @58.3 ~所以我要先找block address
    sm('lower level、upper level 都以 block 為單位', 0, 3.05);
    cap('先找 block address', 'lower level 和 upper level 都是以 block 為單位');
  },
  async (tok, S) => { // @83.7 ~剛剛我們所謂module的餘數找這些
    sm('做 mod 時，兩邊的單位要一樣（都是 block）', 0, 2.55);
    cap('用 modulo 找位置', '兩個 address 的單位一定要一樣');
  },
  async (tok, S) => { // @96.8 ~假如我的block是兩個word的話
    gone(S.q); ok(2 * 4 === 8 && Math.log2(8) === 3, '2 words × 4 bytes = 8 bytes → 後 3 bits 不看 ✓', 0, 3.6);
    cap('block 2 個 word、word 4 個 byte', '一個 block 8 個 byte，後面 3 個 bit 可以 ignore');
  },
  async (tok, S) => { // @130.0 ~八個byte嘛所以八個byte的話
    S.by.forEach((m, a) => { tint(m, a < 8 ? NC.sky : NC.mint); relabel(m, b2(a, 4)); if (m.userData.lbl) m.userData.lbl.element.style.fontSize = '9px'; }); // 4-digit names on narrow cells: all the same small size
    S.bl = [hd('block 0（0xxx）', -3.2, 6.05), hd('block 1（1xxx）', 3.2, 6.05)];
    cap('8 個 byte 綁成一體', '這是第 0 個 block、第 1 個 block……後 3 個 bit 不理它');
  },
  async (tok, S) => { // @146.3 ~所以當你在做這個mapping的時候
    S.st = list(-3.6, 1.8, 0.5, 'ptr'); S.st.add('① 先看 block size：去掉 block 內的 bits');
    cap('做 mapping 時第一件事', '先想 block size 多大，lower、upper level 要一致');
  },
  async (tok, S) => { // @163.2 ~block 的number 就low level也是用block
    S.st.add('② 得到 block number，再 mod set 數'); S.st.add('③ set 數決定 index 幾 bits，剩下都是 tag');
    cap('得到 block number，再做 mod', '看有幾個 set 決定 index，剩下的就是 tag');
  },
  async (tok, S) => { // @186.8 ~spaceline block 這樣瞭解嗎好
    ok(Math.log2(16) === 4, 'block 16 bytes → 去掉 4 bits ✓', 3.4, 0.2);
    cap('如果 16 個 byte 一個 block', '2⁴ = 16，後 4 個 bit 不理它，才得到 block address');
  },
  async (tok, S) => { // @204.8 ~那如果一個block是32個byte的話
    ok(Math.log2(32) === 5, 'block 32 bytes → 去掉 5 bits ✓', 3.4, -0.4);
    cap('如果一個 block 32 個 byte', '後面 5 個 bit 是 block 裡的 byte，不算 block address');
  },
  async (tok, S) => { // @225.6 ~的block address 我們要看前面的去掉
    note('去掉 offset 才是 block address → 找 index、找 tag 就很容易', -1.0, -1.0);
    cap('去掉 5 個 bit 才是 block address', '再找 index、tag 就很容易');
  },
]);

scene('mh-24b-multi', 'P&H 例：加一層 L2，CPI 9 → 3.4', [
  async (tok, S) => { // @247.8 ~那我們剛剛又介紹到multi-level
    S.cpu = bx('CPU', NC.teal, -5.8, 6.2, 0, 1.0, 0.6); S.l1 = bx('L1', NC.green, -4.2, 6.2, 0, 1.2, 0.6); S.mm = bx('main memory', NC.blue, 2.6, 6.2, 0, 2.6, 0.6);
    cap('multi-level cache', '越靠近 CPU 越快越小；遠的大一點，主要 reduce miss');
  },
  async (tok, S) => { // @275.9 ~Base CPI是1 Clock rate是4Ghz
    S.g = list(-3.2, 5.3); S.g.add('base CPI 1、clock 4 GHz'); S.g.add('L1：每個 instruction miss rate 2%');
    cap('例子：base CPI 1、clock rate 4 GHz', '每個 instruction 有 2% 的 miss rate');
  },
  async (tok, S) => { // @289.4 ~那Main Memory的XX是100個
    S.g.add('main memory access 100 ns');
    cap('main memory 的 access', '要 100 個 nanosecond');
  },
  async (tok, S) => { // @304.7 ~Clock Cycle 用Clock Cycle為基準
    sm('要先換成 clock cycle 數', 3.8, 5.3);
    cap('100 ns 相當於多少個 clock cycle？', '以 clock cycle 為基準');
  },
  async (tok, S) => { // @311.8 ~所以先把miss penalty算出來
    const cyc = 1 / 4, pen = 100 / cyc; ok(near(cyc, 0.25) && near(pen, 400), '0.25 ns / cycle → 100 ÷ 0.25 = 400 ✓', 3.8, 4.7);
    cap('4 GHz：一個 cycle 0.25 ns', 'miss penalty = 100 ÷ 0.25 = 400 個 cycle');
  },
  async (tok, S) => { // @328.1 ~它的miss rate是2%
    const cpi = 1 + 0.02 * 400; ok(near(cpi, 9), 'CPI = 1 + 2% × 400 = 9 ✓', 3.8, 4.1);
    S.a = [vbar(NC.teal, -5.0, 1 * 0.35, 1.0, -1.6), vbar(NC.red, -5.0, 8 * 0.35, 1.0, -1.25)]; sm('只有 L1：9', -5.0, 1.95);
    cap('2% × 400 = 8，加上 base 1', 'CPI = 9：沒有 miss 時只要 1');
  },
  async (tok, S) => { // @352.8 ~這是一個level的好
    S.l2 = bx('L2', NC.mint, -1.6, 6.2, 0, 1.8, 0.6);
    cap('如果是兩個 level', '加一個 L2 cache');
  },
  async (tok, S) => { // @362.0 ~因為L1很快是一個cycle就可以到
    S.g.add('L2 access 5 ns（比 memory 100 ns 快很多）');
    cap('L2 比較大、比較慢', '5 ns，但比去 memory 的 100 ns 快很多');
  },
  async (tok, S) => { // @383.6 ~access它的時候 它的cache miss是多少
    const g = bx('2%', NC.pink, -4.2, 6.95, 0.6, 0.8, 0.4); await slide(tok, g, -1.6, 6.95, 0.6, 700); // rides above the boxes: their names stay readable
    cap('L1 miss 的那 2%', '不直接去 main memory，先去 access L2');
  },
  async (tok, S) => { // @418.0 ~你要去access 第二個L2的cache
    const g = bx('0.5%', NC.red, -0.5, 6.95, 0.6, 0.9, 0.4); await slide(tok, g, 2.6, 6.95, 0.6, 700);
    S.g.add('L2 也 miss、要去 memory：0.5%（global）');
    cap('L2 也 miss 的', '才去 main memory：只剩 0.5%');
  },
  async (tok, S) => { // @452.6 ~所以我們說好 Penalty剛剛看看
    ok(near(5 / 0.25, 20), 'L2 penalty = 5 ns ÷ 0.25 = 20 cycles ✓', 3.8, 3.5);
    cap('L1 miss 去 L2', '5 ns = 20 個 cycle');
  },
  async (tok, S) => { // @458.6 ~是400個cycle 400個cycle
    sm('main memory 仍是 400 cycles', 3.8, 2.9);
    cap('main memory 的 access', '還是 400 個 cycle');
  },
  async (tok, S) => { // @464.8 ~那我們到底平均的CPI是多少正常
    const cpi = 1 + 0.02 * 20 + 0.005 * 400; ok(near(cpi, 3.4), 'CPI = 1 + 0.4 + 2 = 3.4 ✓', 3.8, 2.3);
    S.b = [vbar(NC.teal, -1.6, 1 * 0.35, 1.0, -1.6), vbar(NC.orange, -1.6, 0.4 * 0.35, 1.0, -1.25), vbar(NC.red, -1.6, 2 * 0.35, 1.0, -1.11)]; sm('L1 + L2：3.4', -1.6, -0.0);
    cap('平均 CPI = 1 + 0.02 × 20 + 0.005 × 400', '= 3.4');
  },
  async (tok, S) => { // @493.9 ~4這樣就跟剛才9
    ok(near(Math.round(9 / 3.4 * 10) / 10, 2.6), '9 → 3.4：快了約 2.6 倍 ✓', 3.8, 1.7);
    cap('從 9 個 cycle 降到 3.4 個', '只是多加一層 L2');
  },
]);

scene('mh-24b-l1l2', 'L1 與 L2 的設計重點', [
  async (tok, S) => { // @503.5 ~L1跟L2 這樣瞭解嗎好
    S.l1 = bx('L1（primary）', NC.green, -3.4, 5.4, 0, 2.2, 0.8); S.l2 = bx('L2', NC.mint, 1.6, 5.4, 0, 4.0, 1.2);
    hot('L1：minimal hit time', -3.4, 6.6);
    cap('primary cache 要做什麼？', '希望 hit time 變小');
  },
  async (tok, S) => { // @514.7 ~的Hit Time會變小
    sm('更小 → 更快', -3.4, 4.5);
    cap('更小，才會更快', '');
  },
  async (tok, S) => { // @522.0 ~大一點 所以它可以Reduce Cache Miss
    hot('L2：low miss rate（容量大）', 1.6, 6.6);
    cap('L2 慢一點，但 capacity 大', '可以 reduce cache miss，少去 main memory');
  },
  async (tok, S) => { // @531.5 ~的時間 那雖然比L1多一點時間
    sm('L2 hit time 比 L1 長，但比 memory 短很多', 1.6, 4.3);
    cap('L2 雖然比 L1 多一點時間', '至少比 main memory 快得多');
  },
  async (tok, S) => { // @554.8 ~主要還是都在primary cache 所以L1的cache通常會更小
    note('L1 通常比單層設計時更小，block size 也比 L2 小', 0, 2.8);
    cap('主要還是在 primary cache', 'L1 通常比 single-level cache 還小，block size 也比 L2 小');
  },
]);

scene('mh-24b-ooo', 'Cache miss 與 out-of-order superscalar', [
  async (tok, S) => { // @569.0 ~好 再來看看這cache其實很重要
    hot('Instruction-level parallelism：superscalar、VLIW', 0, 6.6);
    cap('cache 很重要', '前面講 instruction-level parallelism 有兩種方法');
  },
  async (tok, S) => { // @585.6 ~一個superscalar 然後一個叫什麼
    S.v = bx('VLIW：compiler 找出可平行的', NC.lilac, -3.0, 5.6, 0, 4.4, 0.6);
    cap('VLIW', '用 compiler 看哪些沒有 dependency，可以同時一起做');
  },
  async (tok, S) => { // @601.3 ~那既然這樣通通都用compiler就好
    S.s = bx('superscalar：hardware 動態排程', NC.sky, 3.0, 5.6, 0, 4.0, 0.6);
    cap('那全部都用 compiler 就好', '為什麼還要 hardware 很多的 superscalar？');
  },
  async (tok, S) => { // @607.0 ~為什麼 就是cache cache你在compiler的
    bad('compile 時不知道誰會 cache miss', -3.0, 4.75);
    cap('因為 cache', 'compile 的時候，不知道會不會發生 cache miss');
  },
  async (tok, S) => { // @615.0 ~所以你沒辦法做scheduling
    good('→ out-of-order CPU 在 run time 處理', 3.2, 4.75);
    cap('所以沒辦法在 compile 時 scheduling', '要用 out-of-order 的 CPU');
  },
  async (tok, S) => { // @621.0 ~就是有這個super scale
    S.rs = [0, 1, 2].map((k) => bx(k === 1 ? 'lw（等 data）' : 'add', k === 1 ? NC.rose : NC.mint, -3.6 + k * 2.4, 3.2, 0, 2.2, 0.55)); hd('reservation station', -1.2, 3.85);
    cap('data 沒來的就放在 reservation station 等', 'data ready 的 function unit 先做');
  },
  async (tok, S) => { // @650.1 ~你是不知道有catch miss
    sm('cache miss 造成的 dependency 只有 run time 才知道', 0, 2.4);
    cap('cache miss 只有 run time 才知道', '不知道誰 independent，所以要 hardware 動態處理');
  },
  async (tok, S) => { // @699.6 ~simulator 它可以模擬它的
    note('分析 program：用 simulator 模擬 cache 行為', 0, 1.5);
    cap('要分析更麻煩', '常用 simulator 模擬 cache structure，看 cache miss');
  },
]);

scene('mh-24b-sort', 'Radix sort vs quicksort：instruction 少不一定快', [
  async (tok, S) => { // @741.5 ~interaction with software
    hot('cache 與 software 的互動：兩種 sorting', 0, 6.6);
    cap('interaction with software', '兩種 sorting algorithm：radix sort 和 quicksort');
  },
  async (tok, S) => { // @752.6 ~那個因為complexity來講的話
    S.c = [bx('radix sort：O(n)', NC.orange, -3.0, 5.8, 0, 3.0, 0.55), bx('quicksort：O(n log n)', NC.blue, 3.0, 5.8, 0, 3.4, 0.55)];
    cap('complexity：radix sort O(n)', 'quicksort O(n log n)');
  },
  async (tok, S) => { // @784.4 ~number of elements to be sorted
    S.ax = [0, 1, 2].map((k) => { const x0 = -6.0 + k * 4.3; seg(x0, 0.2, x0 + 3.4, 0.2); seg(x0, 0.2, x0, 4.4); sm('元素數 →', x0 + 1.7, -0.2); return x0; });
    sm('（曲線為示意，趨勢同 P&H）', 0, -0.7);
    cap('X 軸：要 sort 的 element 數目', '');
  },
  async (tok, S) => { // @789.5 ~一個item需要花多少的instrategy
    const curve = (x0, f, col) => Array.from({ length: 6 }, (_, i) => bx('', col, x0 + 0.3 + i * 0.6, 0.2 + f(i), 0, 0.2, 0.2, 0.2));
    hd('instructions / item', S.ax[0] + 1.7, 4.8);
    S.i1 = curve(S.ax[0], (i) => 3.0 - i * 0.35, NC.orange); S.i2 = curve(S.ax[0], (i) => 1.2 + i * 0.3, NC.blue);
    cap('每個 item 要幾個 instruction', 'radix sort 比較少：看起來比較快');
  },
  async (tok, S) => { // @796.0 ~radic source是比較快的一個
    const curve = (x0, f, col) => Array.from({ length: 6 }, (_, i) => bx('', col, x0 + 0.3 + i * 0.6, 0.2 + f(i), 0, 0.2, 0.2, 0.2));
    hd('clock cycles / item', S.ax[1] + 1.7, 4.8);
    S.k1 = curve(S.ax[1], (i) => 1.4 + i * 0.5, NC.orange); S.k2 = curve(S.ax[1], (i) => 1.0 + i * 0.3, NC.blue);
    cap('可是真的跑：要多少個 clock cycle', 'quicksort 反而比較快');
  },
  async (tok, S) => { // @815.9 ~這要怎麼解釋它這怎麼去解釋它來
    S.q = hot('為什麼？', 0, 5.35);
    cap('要怎麼解釋？', '');
  },
  async (tok, S) => { // @838.3 ~任何一個element
    S.arr = Array.from({ length: 12 }, (_, i) => bx('', NC.off, -3.3 + i * 0.6, 3.6 + 0.0, 1.2, 0.5, 0.35, 0.3)).map((m) => { m.position.y = -1.3; return m; });
    for (const i of [1, 9, 4, 11, 0, 7]) { tint(S.arr[i], NC.orange); await wt(tok, 180); }
    sm('radix：element 丟到各個 bucket，散在 array 各處 → 沒有 locality', 0, -1.85);
    cap('radix sort 把 element 放到 bucket', 'range 大時散在各地方，沒有 locality → 很多 cache miss');
  },
  async (tok, S) => { // @857.1 ~所以它的就有很多的catch miss 那quixel相對
    for (const i of [3, 4, 5, 6]) { tint(S.arr[i], NC.blue); }
    sm('quicksort：相鄰的一直比對 → cache miss 少', 0, -2.35);
    cap('quicksort 相對來說', '相鄰的一直比對，cache miss 比較少');
  },
  async (tok, S) => { // @865.5 ~所以這下面這張圖就告訴但我們
    const curve = (x0, f, col) => Array.from({ length: 6 }, (_, i) => bx('', col, x0 + 0.3 + i * 0.6, 0.2 + f(i), 0, 0.2, 0.2, 0.2));
    hd('cache misses / item', S.ax[2] + 1.7, 4.8);
    S.m1 = curve(S.ax[2], (i) => 0.4 + i * 0.6, NC.orange); S.m2 = curve(S.ax[2], (i) => 0.3 + i * 0.08, NC.blue);
    cap('把 cache miss 拿出來看', 'radix sort 的 cache miss 高很多，所以整體反而慢');
  },
  async (tok, S) => { // @888.0 ~告訴我所以以後你在設計
    gone(S.q); note('設計 algorithm 也要看 data access pattern', 0, 5.35);
    cap('設計 algorithm 時', '不只看 big O，要把 data access 和 cache 一起考慮');
  },
]);

scene('mh-24b-vmintro', 'Virtual memory：memory 當 disk 的 cache', [
  async (tok, S) => { // @932.9 ~所以以上cash的部分還有沒有不懂
    S.sum = ['placement', 'finding', 'replacement', 'write'].map((t, i) => sm('✓ ' + t, -5.6, 6.6 - i * 0.42));
    cap('cache 部分結束', '怎麼放、怎麼找、怎麼 replacement、怎麼 write');
  },
  async (tok, S) => { // @966.3 ~這以上catch的部分那接下來我們
    hot('下一個 level：virtual memory', 0.6, 6.6);
    cap('接下來看另一個 level', 'virtual memory（OS 還會再教，這裡著重需要哪些 hardware）');
  },
  async (tok, S) => { // @1019.2 ~main memory 之間 cache 跟 main memory 之間
    S.c = bx('cache', NC.green, -3.6, 5.2, 0, 1.6, 0.6); S.m = bx('main memory', NC.blue, 0, 5.2, 0, 2.6, 0.6); S.d = bx('disk', NC.metal, 4.0, 5.2, 0, 2.0, 0.6);
    sm('cache controller（hardware）；miss → stall', -1.8, 4.5);
    cap('cache 跟 main memory 之間', '是 cache controller（hardware）在控制；miss 時 stall');
  },
  async (tok, S) => { // @1036.5 ~的東西拿進來再說這基本概念差很大
    sm('memory ↔ disk：下一個 level', 2.0, 4.0);
    cap('memory 跟 disk 是下一個 level', '');
  },
  async (tok, S) => { // @1043.7 ~我們在寫Program不是就有一個就
    S.p1 = bx('program', NC.sky, -4.6, 3.0, 0, 1.8, 0.6);
    cap('如果 program 的 address 就是 physical address', '一個 memory 一次只能 run 一個 program');
  },
  async (tok, S) => { // @1057.5 ~一個memory只能run一個program
    S.ps = [bx('program 2', NC.mint, -4.6, 2.3, 0, 1.8, 0.55), bx('program 3', NC.lilac, -4.6, 1.6, 0, 1.8, 0.55)];
    cap('可是我們希望', '同一個 physical memory 同時 run 好多個 program');
  },
  async (tok, S) => { // @1068.0 ~如果每個program都是有自己的
    lk(-3.6, 2.3, -1.2, 4.8, 0x2fc092);
    sm('每個 program 自己的 address space → 透過 translation map 到 physical', 0.8, 3.0);
    cap('每個 program 有自己的 address space', '經過 translation，map 到真正的 physical address');
  },
  async (tok, S) => { // @1116.2 ~我只要搬一部分過來
    sm('locality：只搬需要的一部分進 memory，其他放 disk', 0.8, 2.45);
    cap('不用整個 program 都搬進來', '90% 時間只用 10%：搬一部分，其他放 disk');
  },
  async (tok, S) => { // @1155.2 ~Level跟Lower Level 只是現在的Upper Level是什麼
    hd('upper：memory　lower：disk', 0.8, 1.8);
    cap('一樣是 upper / lower level', '現在 upper 是 memory，lower 是 disk');
  },
  async (tok, S) => { // @1169.3 ~可能差幾十個幾百個cycle
    bad('memory ↔ cache：幾十～幾百 cycle；disk ↔ memory：幾百萬 cycle（I/O）', 0.8, 1.25);
    cap('memory 和 cache 差幾十、幾百個 cycle', 'disk 和 memory 差幾百萬個 cycle，已經是 I/O');
  },
  async (tok, S) => { // @1186.0 ~所以在這邊我們handle它的時候我
    good('由 OS（software）處理；cache 由 hardware', 0.8, 0.7);
    cap('所以這層不用 hardware 搶時間', '由 OS（system software）來處理');
  },
  async (tok, S) => { // @1247.8 ~memory跟disc之間的關係另外一個
    hd('搬動單位：block → page（很大）', 0.8, 0.1);
    cap('另一個差別：單位叫 page', 'page size 很大：從 disk 搬一次要好大力');
  },
  async (tok, S) => { // @1278.7 ~placement也有好多
    sm('placement：用 fully associative（任何位置都可以）', 0.8, -0.45);
    cap('placement 也不一樣', '一次一大塊，就讓它放任何位置：fully associative');
  },
  async (tok, S) => { // @1311.3 ~怎麼的一個Organization
    note('virtual memory：把 memory 當 disk 的 cache', 0.8, -1.05);
    cap('virtual memory 是什麼？', '把 memory 當作 cache，disk 當 lower level 的 storage');
  },
  async (tok, S) => { // @1354.2 ~要把一個東西Page搬上來的
    sm('page fault 本來就超慢 → OS 用複雜一點的 policy 也划得來', 0.8, -1.6);
    cap('software 可以做比較複雜的 policy', '比起搬一個 page 的 overhead，多花點時間沒關係');
  },
]);

scene('mh-24b-vmshare', '每個 program 有自己的 virtual address space', [
  async (tok, S) => { // @1389.3 ~Hardway來做好 他說這個叫Virtual Memories
    S.va = [0, 1].map((p) => { const x = -5.0 + p * 2.6; hd('program ' + (p + 1), x, 6.6); return Array.from({ length: 6 }, (_, i) => bx('VP' + i, p ? NC.lilac : NC.sky, x, 6.0 - i * 0.5, 0, 1.8, 0.42)); });
    S.pm = Array.from({ length: 6 }, (_, i) => bx('frame ' + i, NC.off, 2.6, 6.0 - i * 0.5, 0, 1.8, 0.42)); hd('physical memory', 2.6, 6.6);
    S.dk = bx('disk', NC.metal, 5.6, 4.8, 0, 1.4, 1.6);
    cap('很多不同的 program', '要 share 同一個 main memory');
  },
  async (tok, S) => { // @1402.8 ~就結束啦就沒事了
    sm('program 去做 I/O 時，processor 給別的 program 用', 0, 2.6);
    cap('為什麼要同時 run 很多 program？', '一個 program 去做 I/O，processor 不能白白空等');
  },
  async (tok, S) => { // @1430.4 ~好幾個program同時一起做好幾個
    sm('只有一個 physical memory；每個 program 有自己的 memory space（不 share）', 0, 2.1);
    cap('只有一個 physical memory', '但每個 program 都有自己的 memory space');
  },
  async (tok, S) => { // @1461.8 ~同一個memory address space
    hd('private virtual address space', -3.7, 3.0);
    cap('每個 program 有自己的 virtual address space', 'private 的；physical 只有一個（例如 2³² 個 byte）');
  },
  async (tok, S) => { // @1486.9 ~你有你自己的address space
    for (const [p, i, f] of [[0, 0, 1], [0, 2, 4], [1, 1, 0], [1, 4, 3]]) { const g = bx('VP' + i, p ? NC.lilac : NC.sky, -5.0 + p * 2.6, 6.0 - i * 0.5, 0.5, 1.6, 0.36); await slide(tok, g, 2.6, 6.0 - f * 0.5, 0.5, 450); kill(g); relabel(S.pm[f], 'P' + (p + 1) + ' VP' + i); tint(S.pm[f], p ? NC.lilac : NC.sky); }
    cap('全部可以放在 disk', '用到的時候，只把需要的幾塊搬到 memory（示意）');
  },
  async (tok, S) => { // @1509.0 ~private virtual address space 但他常常用到的地方呢
    good('搬到 physical 任何空位都可以，只要 translation 對', 0, 1.5);
    cap('搬上來可以擺在 physical 任何地方', '只要有一個 translation 知道擺在哪裡就好');
  },
  async (tok, S) => { // @1570.1 ~需要的那幾塊就好了那 lower level 就叫 virtual
    sm('lower：virtual address　→ translation →　upper：physical address', 0, 0.95);
    cap('lower level 叫 virtual address', 'upper level 叫 physical address，中間一個 translation');
  },
  async (tok, S) => { // @1585.1 ~那跟 cache那個比對就相當於什麼
    sm('像 cache 用 index + tag 找位置；這裡 fully associative → 用一個 table 查', 0, 0.4);
    cap('跟 cache 比：cache 用 index + tag 找', '這裡是 fully associative，查一個 table 就知道在哪');
  },
  async (tok, S) => { // @1622.3 ~Program 它有自己的Virtual Address
    good('protection：每個 program 只能 access 自己的', 0, -0.15);
    cap('每個 program 有自己的 virtual address', '可以互相 protect，沒有權利就 access 不到');
  },
  async (tok, S) => { // @1638.0 ~還有一個好處是甚麼呢這個memory
    good('virtual address space 可以大於 physical memory', 0, -0.7);
    cap('另一個好處', 'virtual address 可以比 physical address 還大，因為只搬一小部分上來');
  },
]);

scene('mh-24b-terms', 'Page、page fault、frame 與 demand load', [
  async (tok, S) => { // @1656.5 ~這樣基本概念就是這樣
    S.v = Array.from({ length: 8 }, (_, i) => bx('page ' + i, NC.sky, -4.4, 6.0 - i * 0.5, 0, 2.0, 0.42)); hd('virtual address space（lower）', -4.4, 6.6);
    S.f = Array.from({ length: 4 }, (_, i) => bx('frame ' + i, NC.off, 2.6, 6.0 - i * 0.5, 0, 2.0, 0.42)); hd('physical memory（upper）', 2.6, 6.6);
    cap('概念跟 cache 一樣', 'lower level 是每個 program 的 virtual address space，upper 是 physical');
  },
  async (tok, S) => { // @1693.7 ~level 也是一樣有一個什麼block
    hot('搬動的 block 在這裡叫 page', -0.9, 1.6);
    cap('從 lower 搬到 upper 也有一個 block', '在這裡叫 page');
  },
  async (tok, S) => { // @1713.9 ~virtual 那再run這個program
    sm('示意：program 可能有一千個 page，memory 裡只放幾個', -0.9, 1.05);
    cap('一個 program 可能有一千個 page', '擺上去可能只有五個：用到才放上去');
  },
  async (tok, S) => { // @1732.8 ~所以有block placement的問題
    S.q = list(3.6, 3.6, 0.45); ['placement', 'finding', 'replacement', 'write'].forEach((t) => S.q.add('• ' + t));
    cap('一樣有四個問題', 'placement、找、replacement、write');
  },
  async (tok, S) => { // @1753.2 ~virtual memory呢它的跟我們這個
    bad('不在 memory → page fault（對應 cache miss）', -0.9, 0.5);
    cap('block 在這裡叫 page', 'page 不在 main memory 就叫 page fault');
  },
  async (tok, S) => { // @1801.4 ~放到physical這個地方我們又給它
    hot('physical memory 切成和 page 一樣大的一塊塊：frame', -0.9, -0.05);
    cap('physical 的那一塊', '叫 frame');
  },
  async (tok, S) => { // @1841.6 ~就是我physical的切成一塊一塊跟
    const g = bx('page 5', NC.sky, -4.4, 6.0 - 5 * 0.5, 0.5, 2.0, 0.42); await slide(tok, g, 0.4, 6.0 - 2 * 0.5, 0.5, 600); kill(g); relabel(S.f[2], 'frame 2 ← page 5'); tint(S.f[2], NC.sky); // the copy stops at the frame's edge and the frame takes the name
    cap('一個 page 要 map 到一個 frame', 'frame 和 page 一樣大，一起搬進搬出');
  },
  async (tok, S) => { // @1866.1 ~第一個size的問題這個block size
    sm('先回答：page 多大？怎麼放（決定怎麼找）？怎麼 replace？', -0.9, -0.6);
    cap('先回答這幾個問題', 'page size、怎麼放（就決定怎麼找）、replacement');
  },
  async (tok, S) => { // @1916.0 ~那我們說這個什麼時候才要
    note('demand load：page fault 時才搬（page 太大，不 prefetch）', -0.9, -1.2);
    cap('什麼時候 fetch？', 'cache 常 prefetch；page 太大，只有 page fault 時才搬（demand load）');
  },
]);

scene('mh-24b-pagetable', 'Page size、fully associative 與 page table', [
  async (tok, S) => { // @1953.7 ~Block Size的問題
    bad('page fault：要幾百萬個 cycle（disk 是 I/O）', 0, 6.6);
    cap('page size 的問題', 'page fault 的 penalty 非常大：幾百萬個 cycle');
  },
  async (tok, S) => { // @1994.1 ~那你趕快搬多一點上來了已經要OS
    good('所以 page 要大（例：4 KB）', 0, 6.0);
    cap('OS 處理了半天，只搬一點點划不來', '所以 page size 都很大，例如 4K byte');
  },
  async (tok, S) => { // @2015.0 ~所以這個page size都很大好 再來
    sm('reduce page fault：有空位就不能不給（不要 direct-mapped 那種限制）', 0, 5.4);
    cap('reducing page fault 很重要', '明明有位置卻不給（像 direct-mapped），代價太大');
  },
  async (tok, S) => { // @2048.0 ~然後 page 4 要花很大時間我們不希望
    hd('→ fully associative placement', 0, 4.85);
    cap('所以 virtual memory', '用 fully associative：memory 有位置就擺進去');
  },
  async (tok, S) => { // @2066.43 ~的問題 那既然是
    hot('沒有 index → 用 page table 記錄', 0, 4.25);
    cap('fully associative 就有找的問題', '不能一個一個去找，所以建一個 table：page table');
  },
  async (tok, S) => { // @2093.5 ~translation table就很簡單
    S.pt = Array.from({ length: 8 }, (_, i) => ({ i: sm(String(i), -1.6, 3.3 - i * 0.45), e: bx('', NC.off, -0.4, 3.3 - i * 0.45, 0, 1.8, 0.38) }));
    hd('page table', -0.4, 3.75);
    cap('table 很簡單', '你是第幾個 page，map 到第幾個 frame');
  },
  async (tok, S) => { // @2099.2 ~就這樣一個概念而已那這個table
    const map = { 0: 3, 2: 0, 3: 1, 5: 2 };
    S.pt.forEach((r, i) => { if (map[i] !== undefined) { relabel(r.e, 'V=1 frame ' + map[i]); tint(r.e, NC.mint); } else { relabel(r.e, 'V=0（disk）'); tint(r.e, NC.rose); } });
    sm('像 array：page number 當 index（示意 8 個 page）', -0.4, -0.4);
    cap('像 array 的 index', '16 個 page 就 16 個 entry；查第 i 個 entry 就知道 frame');
  },
  async (tok, S) => { // @2175.6 ~樣子假如這是 virtual address
    S.vp = Array.from({ length: 8 }, (_, i) => bx('page ' + i, NC.sky, -5.0, 3.3 - i * 0.45, 0, 1.4, 0.38)); S.fr = Array.from({ length: 4 }, (_, i) => bx('frame ' + i, NC.blue, 3.6, 3.3 - i * 0.45, 0, 1.4, 0.38));
    cap('virtual address 切成一塊塊 page', 'physical 切成一樣大的 frame，靠 page table mapping');
  },
  async (tok, S) => { // @2234.1 ~擺在Disk裡面所以我每次Access的
    glow(S.vp[3], HL); glow(S.pt[3].e, OKG); glow(S.fr[1], OKG); lk(1.0, 3.3 - 3 * 0.45, 2.8, 3.3 - 1 * 0.45, 0x0f5a3a, 0.4);
    good('page 3：valid → 在 memory（frame 1）', 3.4, 1.3);
    cap('每次 access 先查 page table', '在 memory 裡，就告訴我是哪個 frame');
  },
  async (tok, S) => { // @2243.5 ~還是在不在 不在的話就表示在disk
    glow(S.vp[4], HL); glow(S.pt[4].e, NG);
    bad('page 4：不在 → page fault', 3.4, 0.7);
    cap('不在的話', '表示在 disk 裡：產生 page fault');
  },
  async (tok, S) => { // @2270.0 ~如果不在的話就產生page 4
    note('page fault 由 OS 處理（不是 hardware）', 0, -1.0);
    cap('一產生 page fault', '要做一大堆動作，是 OS 在做');
  },
]);

scene('mh-24b-translate', 'Address translation：virtual page number → physical frame number', [
  async (tok, S) => { // @2285.3 ~那page table 要怎麼translation
    hot('page table 怎麼做 translation？', 0, 6.6);
    cap('page table 要怎麼 translation？', '');
  },
  async (tok, S) => { // @2301.6 ~我要把block number找出來把
    sm('跟 cache 一樣：先找 block（page）number，page 裡面的不用理', 0, 6.05);
    cap('跟 cache 一樣', '要把 block（page）number 找出來，以下的單位綁在一起不用理');
  },
  async (tok, S) => { // @2315.7 ~2的12次方 就4k 4k
    S.bs = BS(null, [{ n: 'virtual page number', b: 20, c: FC.tag }, { n: 'page offset', b: 12, c: FC.offset }], 4.9);
    ok(4096 === Math.pow(2, 12), '4 KB = 2¹² bytes → page offset 12 bits ✓', 0, 3.75);
    cap('page size 4K = 2¹² 個 byte', '後面 12 個 bit 去掉，才是 page number');
  },
  async (tok, S) => { // @2333.0 ~要找它的block number
    S.bs.cubes.slice(0, 20).forEach((m) => glow(m, HL));
    sm('32-bit virtual address（示意）：前 20 bits = virtual page number', 0, 3.2);
    cap('先找第幾個 page', '看 page size，前面這部分就是 page number');
  },
  async (tok, S) => { // @2374.8 ~那你知道page virtual address的
    S.ptb = bx('page table', NC.gold, -3.0, 2.2, 0, 2.4, 0.6); lk(-3.0, 4.4, -3.0, 2.6);
    cap('拿 virtual page number', '去 page table 做 translation');
  },
  async (tok, S) => { // @2402.4 ~有多少個frame 就從這邊來描述它
    S.ps = BS(null, [{ n: 'physical frame number', b: 18, c: FC.index }, { n: 'page offset', b: 12, c: FC.offset }], 0.6);
    sm('frame number 的 bit 數看 physical 有多少 frame（示意 18 bits）', 0, -0.55);
    cap('table 告訴你：前半部的 physical frame number', 'physical 有多少個 frame，就用幾個 bit 描述');
  },
  async (tok, S) => { // @2413.5 ~單位一個page為一個單位
    S.bs.cubes.forEach((m) => glow(m, null)); S.bs.cubes.slice(20).forEach((m) => glow(m, HL));
    cap('一個 page 整塊搬到一個 frame', '裡面的位址分佈一模一樣');
  },
  async (tok, S) => { // @2443.3 ~也是第三個啊那我怎麼知道第三個
    S.ps.cubes.slice(18).forEach((m) => glow(m, HL));
    const va = 0x3abc, vpn = va >>> 12, off = va & 0xfff, pfn = 7, pa = (pfn << 12) | off;
    ok(vpn === 3 && off === 0xabc && pa === 0x7abc, '示意：VA 0x3ABC → VPN 3、offset 0xABC → frame 7 → PA 0x7ABC ✓', 0, -1.15);
    cap('page 裡第三個，到 frame 裡也是第三個', 'low-order 的 page offset 直接照搬');
  },
  async (tok, S) => { // @2451.1 ~這樣有沒有問題所以到physical address
    note('physical address = frame number + 同樣的 page offset', 0, -1.75);
    cap('physical address', '只要知道第幾個 frame，再把 page offset 接上去');
  },
]);

// ════════ Y1esjWBTf7Q（AMAT：5 個 request 的平均、h·t + (1−h)·m、simultaneous vs hierarchical、三層） ════════
const AREQ = [['A', 0], ['B', 0], ['C', 0], ['D', 1], ['E', 1]];
scene('mh-amat-avg', '5 個 request：平均存取時間 8 秒', [
  async (tok, S) => { // @15.28 ~Inthislecture
    hot('Average memory access time（AMAT）', 0, 6.6); sm('simultaneous 與 hierarchical 兩種情況', 0, 6.05);
    cap('推導 average memory access time', 'simultaneous 和 hierarchical 兩種情況');
  },
  async (tok, S) => { // @22.32 ~Forthis
    S.r = AREQ.map(([n], i) => bx(n, NC.off, -4.0 + i * 2.0, 4.9, 0, 1.2, 0.7));
    cap('舉例：5 個 request', 'A、B、C、D、E');
  },
  async (tok, S) => { // @27.4 ~Aisamiss
    AREQ.forEach(([, h], i) => { tint(S.r[i], h ? NC.green : NC.rose); tag(h ? 'hit' : 'miss', h ? 'good' : 'bad', -4.0 + i * 2.0, 4.1); });
    cap('A、B、C 是 miss', 'D、E 是 hit');
  },
  async (tok, S) => { // @35.14 ~letthehittime
    hd('hit time t = 5 s', -2.6, 3.3); hd('miss time（miss penalty）m = 10 s', 2.6, 3.3);
    cap('hit time t = 5 秒', 'miss 的時間（這裡叫 miss penalty）m = 10 秒');
  },
  async (tok, S) => { // @41.36 ~ifihave
    mt('AMAT = (#hits × t + #misses × m) / (#hits + #misses)', 0, 2.4, 'ptr alt');
    cap('AMAT = (hit 數 × t + miss 數 × m)', '除以全部的 hit + miss');
  },
  async (tok, S) => { // @68.53 ~thenumberofhitsare
    S.b = AREQ.map(([, h], i) => vbar(h ? NC.green : NC.red, -4.0 + i * 2.0, (h ? 5 : 10) * 0.1, 1.0, 0.2));
    mt('= (2 × 5 + 3 × 10) / 5 = (10 + 30) / 5', 0, 1.7);
    cap('hit 有 2 個：2 × 5', 'miss 有 3 個：3 × 10，除以總共 5 次');
  },
  async (tok, S) => { // @86.24 ~that's40by5
    const n = AREQ.length, a = (2 * 5 + 3 * 10) / n; ok(a === 8, '= 40 / 5 = 8 秒 ✓', 0, 1.0);
    seg(-5.0, 0.2 + 0.8, 5.0, 0.2 + 0.8, '#a8730f', 0.4); sm('平均 8', 5.6, 1.0);
    cap('40 ÷ 5', '= 8 秒');
  },
]);

scene('mh-amat-ratio', 'AMAT = h × t + (1 − h) × m', [
  async (tok, S) => { // @89.42 ~thismeanisforhit
    S.bars = [vbar(NC.green, -4.6, 5 * 0.3, 1.0, 0.2), vbar(NC.red, -3.2, 10 * 0.3, 1.0, 0.2)]; sm('hit 5', -4.6, -0.2); sm('miss 10', -3.2, -0.2);
    seg(-5.4, 0.2 + 8 * 0.3, -2.4, 0.2 + 8 * 0.3, '#a8730f', 0.6); sm('平均 8', -1.7, 0.2 + 8 * 0.3);
    cap('hit 的 request 要 5 秒，miss 的要 10 秒', '全部平均下來是 8 秒');
  },
  async (tok, S) => { // @103.64 ~generallyinthequestions
    hot('題目通常給 hit ratio h，而不是 hit / miss 次數', 1.6, 6.6);
    cap('題目通常不會給幾次 hit、幾次 miss', '而是給 hit ratio');
  },
  async (tok, S) => { // @112.47 ~knowitis
    mt('h = #hits / #attempts　　1 − h = #misses / #attempts', 1.6, 5.9);
    cap('hit ratio h = hit 次數 / 總次數', 'miss ratio = 1 − h = miss 次數 / 總次數');
  },
  async (tok, S) => { // @123.92 ~nowthisformulacanbe
    mt('AMAT = (#hits × t) / #attempts + (#misses × m) / #attempts', 1.6, 5.1);
    cap('把公式拆成兩半', 'hit 那半、miss 那半，各自除以總次數');
  },
  async (tok, S) => { // @146.12 ~thisisthehitratioand
    sm('#hits / #attempts = h　　#misses / #attempts = 1 − h', 1.6, 4.5);
    cap('hits / attempts 就是 hit ratio', 'misses / attempts 就是 miss ratio');
  },
  async (tok, S) => { // @153.72 ~memoryaccesstimeishitratio
    mt('AMAT = h × t + (1 − h) × m', 1.6, 3.7, 'ptr alt');
    cap('AMAT = h × t + (1 − h) × m', 'hit ratio × hit time + miss ratio × miss penalty');
  },
  async (tok, S) => { // @164.69 ~thisisthestandardformula
    const h = 2 / 5, a = h * 5 + (1 - h) * 10, pnh = 5 + (1 - h) * (10 - 5);
    ok(near(a, 8), '代回：0.4 × 5 + 0.6 × 10 = 8 ✓', 1.6, 2.9);
    ok(near(pnh, 8), 'P&H 寫法：t + (1−h)(m − t) = 5 + 0.6 × 5 = 8 ✓', 2.6, 2.3);
    cap('這是大部分書上的標準公式', '這裡的 m 指 miss 的總時間，和 P&H 的寫法算出來一樣');
  },
]);

// 兩層：CPU、L1、L2
function lv2(S, serial) {
  S.cpu = bx('CPU', NC.teal, -5.6, 4.6, 0, 1.2, 0.8);
  S.L1 = bx('L1（t1，hit ratio h）', NC.green, -1.0, 5.6, 0, 3.4, 0.7); S.L2 = bx('L2（t2，hit ratio 1）', NC.blue, serial ? 3.6 : -1.0, serial ? 5.6 : 3.6, 0, 3.4, 0.7);
}
scene('mh-amat-sim2', '兩層 simultaneous：h·t1 + (1−h)·t2', [
  async (tok, S) => { // @168.06 ~nowfromthisunderstanding
    hd('simultaneous', -3.0, 6.6); hd('hierarchical', 3.0, 6.6);
    cap('用這個標準公式', '推導 simultaneous 和 hierarchical 兩種情況');
  },
  async (tok, S) => { // @173.54 ~insimultaneouscasecpucan
    lv2(S, false); lk(-5.0, 4.8, -2.7, 5.5, 0x31aab0); lk(-5.0, 4.4, -2.7, 3.7, 0x31aab0);
    sm('CPU 同時 access 兩層', -3.0, 2.7);
    cap('simultaneous', 'CPU 可以同時 access 兩層 memory');
  },
  async (tok, S) => { // @179.08 ~thetimetakentoaccessl1
    sm('L1 要 t1、L2 要 t2', -3.0, 2.2);
    cap('access L1 的時間 t1', 'L2 的時間 t2');
  },
  async (tok, S) => { // @182.24 ~comingtotheheatratio
    sm('L1 的 hit ratio = h', -3.0, 1.7);
    cap('L1 的 hit ratio', '設為 h');
  },
  async (tok, S) => { // @187.56 ~wegotol2
    good('L2 是最後一層：一定找得到（hit ratio = 1）', -1.0, 1.15);
    cap('L2 是最後一層', '假設資料一定在，hit ratio = 1');
  },
  async (tok, S) => { // @205.18 ~icanwriteitforsimultaneous
    mt('AMAT(sim) = h × t1 + (1 − h) × t2', 0, 0.4, 'ptr alt');
    const h = 0.8, t1 = 2, t2 = 10; ok(near(h * t1 + (1 - h) * t2, 3.6), '示意 h = 0.8、t1 = 2、t2 = 10：1.6 + 2 = 3.6 ✓', 0, -0.25);
    cap('套標準公式：hit time 是 t1', 'miss 時同時已在找 L2，miss penalty 就是 t2');
  },
]);

scene('mh-amat-hier2', '兩層 hierarchical：t1 + (1−h)·t2', [
  async (tok, S) => { // @220.14 ~nowifmemoryaccess
    lv2(S, true); lk(-5.0, 4.8, -2.7, 5.5, 0x31aab0);
    hd('hierarchical：先找 L1', -1.0, 6.6);
    cap('hierarchical', '資料先在 L1 找，花 t1');
  },
  async (tok, S) => { // @225.38 ~ifitisnot
    lk(0.7, 5.6, 1.9, 5.6, 0xd64545); sm('L1 找不到 → 再去 L2 找（t2）', 1.2, 4.9);
    cap('L1 找不到', '再去 L2 找，花 t2');
  },
  async (tok, S) => { // @233 ~isnotfoundthenitgoestol2
    good('L1 hit ratio h；L2 一定找得到（1）', 1.2, 4.35);
    cap('L1 hit ratio 是 h', '不在就去 L2，L2 一定找得到');
  },
  async (tok, S) => { // @238.8 ~themissedpenalty
    S.tl = [bx('t1', NC.green, -3.0, 3.2, 0, 2.0, 0.5), bx('t2', NC.blue, 0.0, 3.2, 0, 4.0, 0.5)];
    bad('miss 時共花 t1 + t2（先查過 L1 才去 L2）', -1.0, 2.55);
    cap('miss 的時候', '已經花了 t1 找 L1，再加 t2：miss penalty = t1 + t2');
  },
  async (tok, S) => { // @242.42 ~standardformulaicanwrite
    mt('AMAT(hier) = h × t1 + (1 − h) × (t1 + t2)', 0, 1.7, 'ptr alt');
    cap('套標準公式', 'h × t1 + (1 − h) × (t1 + t2)');
  },
  async (tok, S) => { // @260.24 ~icansimplify
    mt('= t1 + (1 − h) × t2', 0, 1.05, 'ptr alt');
    const h = 0.8, t1 = 2, t2 = 10; ok(near(h * t1 + (1 - h) * (t1 + t2), t1 + (1 - h) * t2), '示意 h = 0.8、t1 = 2、t2 = 10：1.6 + 2.4 = 2 + 2 = 4 ✓', 0, 0.4);
    cap('化簡：h·t1 和 (1−h)·t1 合起來是 t1', '剩下 t1 + (1 − h) × t2');
  },
]);

function lv3(S) {
  S.cpu = bx('CPU', NC.teal, -5.8, 5.2, 0, 1.0, 0.7);
  S.L = [['L1：t1、h1', NC.green], ['L2：t2、h2', NC.blue], ['L3：t3、1', NC.purple]].map(([t, c], i) => bx(t, c, -3.4 + i * 2.9, 5.2, 0, 2.6, 0.7));
}
scene('mh-amat-sim3', '三層 simultaneous', [
  async (tok, S) => { // @273.26 ~letmedothesameforthree
    lv3(S); hd('三層：simultaneous', 0, 6.4);
    cap('同樣推三層', 'L1、L2、L3 的時間 t1、t2、t3；hit ratio h1、h2');
  },
  async (tok, S) => { // @287.52 ~andinthelastlevel
    good('最後一層 L3：一定有資料（hit ratio 1）', 2.4, 4.4);
    cap('最後一層 L3', '資料一定在，hit ratio 是 1');
  },
  async (tok, S) => { // @292.26 ~timeforthreelevels
    S.f = list(-1.0, 3.5, 0.6, 'ptr'); S.f.add('L1 hit：h1 × t1');
    cap('三層的 AMAT：第一項', 'L1 hit 的機率 h1 × L1 的時間 t1');
  },
  async (tok, S) => { // @295.31 ~ifthedataisnot
    sm('L1 找不到 → miss', 3.6, 3.5);
    cap('如果 L1 找不到', '那就是 L1 miss');
  },
  async (tok, S) => { // @308.24 ~asmissin1hitin2
    S.f.add('L1 miss、L2 hit：(1 − h1) × h2 × t2');
    cap('L1 miss、L2 hit', '機率 (1 − h1) × h2，時間 t2');
  },
  async (tok, S) => { // @311.05 ~evenifthisbecomesamiss
    S.f.add('L1、L2 都 miss、L3 hit：(1 − h1)(1 − h2) × 1 × t3');
    cap('L2 也 miss', '就在 L3 hit：(1 − h1)(1 − h2) × t3');
  },
  async (tok, S) => { // @328.74 ~thevaluesthiswillbe
    mt('AMAT(sim) = h1·t1 + (1 − h1)·h2·t2 + (1 − h1)(1 − h2)·t3', 0, 1.4, 'ptr alt');
    const h1 = 0.8, h2 = 0.5, t1 = 1, t2 = 5, t3 = 20, a = h1 * t1 + (1 - h1) * h2 * t2 + (1 - h1) * (1 - h2) * t3;
    ok(near(a, 0.8 + 0.5 + 2) && near(h1 + (1 - h1) * h2 + (1 - h1) * (1 - h2), 1), '示意 h1 0.8、h2 0.5、t 1/5/20：0.8 + 0.5 + 2 = 3.3；三種情況機率合為 1 ✓', 0, 0.75);
    cap('代入', 'h1·t1 + (1 − h1)·h2·t2 + (1 − h1)(1 − h2)·t3');
  },
  async (tok, S) => { // @359.5 ~istheformulaforsimultaneous
    note('simultaneous：每種情況只花「那一層」的時間', 0, 0.1);
    cap('這是 simultaneous 的公式', '同時找，所以每種情況只算找到那一層的時間');
  },
]);

scene('mh-amat-hier3', '三層 hierarchical', [
  async (tok, S) => { // @361.18 ~ifmemoryaccessishierarchical
    lv3(S); hd('三層：hierarchical（一層一層找）', 0, 6.4); lk(-2.1, 5.2, -1.8, 5.2, 0xd64545); lk(0.8, 5.2, 1.1, 5.2, 0xd64545);
    cap('如果是 hierarchical', 'L1 時間 t1、L2 t2、L3 t3；hit ratio h1、h2');
  },
  async (tok, S) => { // @370.33 ~InL3
    good('L3 一定成功（1）', 2.4, 4.4);
    cap('L3', '假設一定成功，hit ratio 是 1');
  },
  async (tok, S) => { // @375.5 ~Now,Icanwrite
    S.t = [[1, 't1'], [2, 't1 + t2'], [3, 't1 + t2 + t3']].map(([k, t]) => sm('到第 ' + k + ' 層才找到：' + t, -2.4, 3.6 - (k - 1) * 0.5));
    cap('公式一樣，只差在時間', '第一層 t1；到第二層要 t1 + t2；到第三層要 t1 + t2 + t3');
  },
  async (tok, S) => { // @383.78 ~onewillbet1timeforlevel2
    mt('h1·t1 + (1−h1)·h2·(t1+t2) + (1−h1)(1−h2)·(t1+t2+t3)', 0, 1.9, 'ptr alt');
    cap('代進去', '每種情況的時間都要把前面找過的層加上去');
  },
  async (tok, S) => { // @396.38 ~nowwhenwesimplify
    const h1 = 0.8, h2 = 0.5, t1 = 1, t2 = 5, t3 = 20;
    const full = h1 * t1 + (1 - h1) * h2 * (t1 + t2) + (1 - h1) * (1 - h2) * (t1 + t2 + t3), simp = t1 + (1 - h1) * t2 + (1 - h1) * (1 - h2) * t3;
    mt('= t1 + (1 − h1)·t2 + (1 − h1)(1 − h2)·t3', 0, 1.25, 'ptr alt');
    ok(near(full, simp) && near(simp, 4), '示意 h1 0.8、h2 0.5、t 1/5/20：兩式都 = 4 ✓（化簡留給你自己試）', 0, 0.6);
    cap('化簡後（影片留給你自己試）', 't1 + (1 − h1)·t2 + (1 − h1)(1 − h2)·t3');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'write-through', 'write-back', 'cpi-stall', 'amat', 'assoc-spectrum', 'block-12', 'assoc-058', 'lru', 'tag-bits', 'multilevel', 'three-c'].concat(FRAG.map((f) => f[0])),
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
