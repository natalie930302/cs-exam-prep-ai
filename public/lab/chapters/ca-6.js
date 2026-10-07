// 計算機組織 第6章：記憶體系統（virtual memory 的硬體面：page table、TLB、位址轉換、page fault；
// cache + TLB + page table 的互動；DRAM 組織 RAS/CAS；memory interleaving 與頻寬）。
// 本章的黃婷婷 25A–26B 講與 Memory Interleaving 影片目前都沒有逐字稿，場景依 Patterson & Hennessy（MIPS 版）第 5 章重現。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const PAL = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
  const colOf = (v) => PAL[Math.abs(v) % PAL.length];
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
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function seg(color, x0, x1, y, h = 0.5, d = 0.8, text = '') {
    const w = Math.max(0.05, x1 - x0);
    return cube(text, color, [w, h, d], x0 + w / 2, y, 0);
  }
  async function growSeg(tok, color, x0, x1, y, text, ms = 500) {
    const m = seg(color, x0, x0 + 0.05, y, 0.5, 0.8);
    const w = Math.max(0.05, x1 - x0);
    await anim(tok, ms, (t) => { m.scale.x = Math.max(0.05, w * t) / 0.05; m.position.x = x0 + Math.max(0.05, w * t) / 2; });
    if (text) { const l = tag(text, 'idx', x0 + w / 2, y + 0.45); m.userData.t = l; }
    return m;
  }
  function bitStrip(value, fields, y = 1, z = 0, sp = 0.39) {
    const total = fields.reduce((s, f) => s + f.b, 0);
    const x0 = -(total - 1) / 2 * sp;
    const cubes = [], labels = [];
    let i = 0;
    for (const f of fields) {
      if (f.b <= 0) continue;
      const xs = x0 + i * sp, xe = x0 + (i + f.b - 1) * sp;
      labels.push(tag(f.n, 'ptr', (xs + xe) / 2, y + 0.7, z));
      for (let k = 0; k < f.b; k++, i++) {
        const m = lab.box(f.c, [sp * 0.88, sp * 0.88, sp * 0.88]);
        m.position.set(x0 + i * sp, y, z); lab.world.add(m);
        if (value !== null) m.add(lab.label(String(Math.floor(value / Math.pow(2, total - 1 - i)) % 2), 'idx'));
        cubes.push(m);
      }
    }
    return { cubes, labels, kill() { cubes.forEach(kill); labels.forEach(kill); } };
  }
  const hex = (v, n = 4) => '0x' + v.toString(16).toUpperCase().padStart(n, '0');
  const r2 = (x) => Math.round(x * 100) / 100;

  // ───────────────────────── 位址轉換模擬器（模式＋場景共用） ─────────────────────────
  // 16-bit virtual address、4 KiB page → VPN 4 bits（16 個 virtual page）+ offset 12 bits；
  // 實體記憶體 16 個 frame（PPN 4 bits）；TLB 4 entries、fully associative、LRU。
  const INIT_PT = { 0: 5, 3: 6, 4: 9, 5: 11, 7: 4, 10: 3, 11: 12 };
  const INIT_TLB = [[1, 11, 12], [1, 7, 4], [1, 3, 6], [0, 4, 9]];
  function makeVM(o = {}) {
    const M = { t: 10, tlbHit: 0, tlbMiss: 0, faults: 0, pt: [], tlb: [], frames: [], freeOrder: [13, 14, 15, 0, 1, 2, 7, 8, 10], nFrames: o.nFrames || 16 };
    tag('TLB（4 entries）', 'ptr', -5.0, 7.0);
    tag('V  VPN  PPN', 'idx', -5.0, 6.45);
    INIT_TLB.forEach(([v, vpn, ppn], k) => {
      const mesh = cube('', GRAY, [2.3, 0.5, 0.8], -5.0, 5.85 - k * 0.65, 0);
      M.tlb.push({ v: !!v, vpn, ppn, last: k + 1, mesh });
    });
    tag('Page table', 'ptr', -1.4, 7.0);
    for (let p = 0; p < 16; p++) {
      const has = p in INIT_PT;
      const y = 6.45 - p * 0.36;
      const mesh = cube('', GRAY, [1.9, 0.3, 0.7], -1.2, y, 0);
      tag(String(p), 'idx', -2.55, y);
      M.pt.push({ v: has, ppn: has ? INIT_PT[p] : -1, dirty: false, ref: 0, mesh, y });
    }
    tag('實體記憶體 frames', 'ptr', 2.4, 7.0);
    for (let f = 0; f < M.nFrames; f++) {
      const y = 6.45 - f * 0.36;
      M.frames.push({ vpn: -1, mesh: cube('', '#efe6d6', [1.7, 0.3, 0.7], 2.4, y, 0), y });
      tag(String(f), 'idx', 1.2, y);
    }
    for (let p = 0; p < 16; p++) if (M.pt[p].v) M.frames[M.pt[p].ppn].vpn = p;
    if (M.nFrames < 16) M.freeOrder = M.freeOrder.filter((f) => f < M.nFrames && M.frames[f].vpn < 0);
    M.disk = cube('Disk', '#c9b48e', [1.4, 3.2, 1.4], 5.7, 3.6, -0.3);
    M.vaL = tag('', 'ptr alt', 0, 0.2, 1.4);
    M.statL = tag('', 'ptr', 4.6, 7.0);
    M.draw = () => {
      M.tlb.forEach((e) => { relabel(e.mesh, e.v ? '1   ' + e.vpn + '   ' + e.ppn : '0   ' + e.vpn + '   ' + e.ppn); tint(e.mesh, e.v ? colOf(e.vpn) : GRAY); });
      M.pt.forEach((e, p) => { relabel(e.mesh, e.v ? 'V PPN ' + e.ppn + (e.dirty ? ' D' : '') : '0 disk'); tint(e.mesh, e.v ? colOf(p) : GRAY); });
      M.frames.forEach((f, k) => { relabel(f.mesh, f.vpn >= 0 ? 'VP ' + f.vpn : '空'); tint(f.mesh, f.vpn >= 0 ? colOf(f.vpn) : '#efe6d6'); });
      txt(M.statL, 'TLB hit ' + M.tlbHit + ' · miss ' + M.tlbMiss + ' · fault ' + M.faults);
    };
    M.unglow = () => { [...M.tlb.map((e) => e.mesh), ...M.pt.map((e) => e.mesh), ...M.frames.map((f) => f.mesh)].forEach((m) => glow(m, null)); };
    M.access = async (va, write, tok, pace = 1) => {
      const vpn = va >> 12, off = va & 0xfff;
      M.t++;
      txt(M.vaL, 'VA ' + va + ' = ' + hex(va) + ' → VPN ' + vpn + '、offset ' + hex(off, 3));
      M.tlb.forEach((e) => glow(e.mesh, GOLD));
      await wait(tok, 450 * pace);
      M.tlb.forEach((e) => glow(e.mesh, null));
      const r = { va, vpn, off, tlbHit: false, fault: false };
      const te = M.tlb.find((e) => e.v && e.vpn === vpn);
      let ppn;
      if (te) {
        M.tlbHit++; te.last = M.t; glow(te.mesh, GREEN); ppn = te.ppn; r.tlbHit = true;
      } else {
        M.tlbMiss++;
        const pe = M.pt[vpn];
        glow(pe.mesh, GOLD);
        await wait(tok, 500 * pace);
        if (!pe.v) {
          // page fault：作業系統把 page 從 disk 讀進一個 frame
          M.faults++; r.fault = true;
          glow(pe.mesh, RED);
          let f = M.freeOrder.length ? M.freeOrder.shift() : -1;
          if (f < 0) {
            // 沒有空 frame：換掉最久沒被用的 page（LRU）
            let best = -1; M.pt.forEach((e, p) => { if (e.v && (best < 0 || e.ref < M.pt[best].ref)) best = p; });
            const old = M.pt[best]; f = old.ppn;
            r.evicted = best; r.wroteBack = old.dirty;
            if (old.dirty) { const g = cube('VP ' + best, colOf(best), [1.3, 0.3, 0.7], 2.4, M.frames[f].y, 0.5); move(g, 5.7, 3.6, 0.6); await wait(tok, 550 * pace); kill(g); }
            old.v = false; old.dirty = false; old.ppn = -1;
            M.tlb.forEach((e) => { if (e.v && e.vpn === best) e.v = false; });
          }
          const g = cube('VP ' + vpn, colOf(vpn), [1.3, 0.3, 0.7], 5.7, 3.6, 0.6); move(g, 2.4, M.frames[f].y, 0.5);
          await wait(tok, 650 * pace); kill(g);
          M.frames[f].vpn = vpn; pe.v = true; pe.ppn = f; pe.dirty = false;
          r.newFrame = f;
        }
        ppn = pe.ppn;
        // 把這筆 translation 放進 TLB：先找 invalid，否則換 LRU
        let k = M.tlb.findIndex((e) => !e.v);
        if (k < 0) { k = 0; M.tlb.forEach((e, j) => { if (e.last < M.tlb[k].last) k = j; }); r.tlbVictim = M.tlb[k].vpn; }
        Object.assign(M.tlb[k], { v: true, vpn, ppn, last: M.t });
        r.tlbSlot = k;
        glow(M.tlb[k].mesh, RED);
      }
      const pe = M.pt[vpn]; pe.ref = M.t; if (write) pe.dirty = true;
      glow(M.frames[ppn].mesh, GREEN);
      r.ppn = ppn; r.pa = ppn * 4096 + off;
      txt(M.vaL, 'VA ' + hex(va) + ' → PA ' + hex(r.pa) + '（PPN ' + ppn + ' 接上 offset ' + hex(off, 3) + '）');
      M.draw();
      return r;
    };
    M.draw();
    return M;
  }

  // ───────────────────────── 模式 1：位址轉換 ─────────────────────────
  let vm = null, vmBusy = false;
  const VM_SEQ = [4669, 2227, 13916, 34587, 48870, 12608, 49225];
  function enterTranslate() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4.2, 15], [0, 3.6, 0]);
    vm = makeVM();
    controls('<label>virtual address（十進位或 0x）<input id="tVa" value="4669" style="width:90px"></label>'
      + '<label><input id="tW" type="checkbox"> 寫入（設 dirty）</label>'
      + '<button class="primary" id="tGo">轉換</button><button id="tRun">跑整串 4669, 2227, 13916, 34587, 48870, 12608, 49225</button><button id="tReset">重設</button>');
    on('tGo', () => { const s = String($('tVa').value).trim(); const va = /^0x/i.test(s) ? parseInt(s, 16) : Number(s); vmOne(va, $('tW').checked); });
    on('tReset', () => enterTranslate());
    on('tRun', async () => { if (vmBusy) return; enterTranslate(); for (const a of VM_SEQ) { await vmOne(a, false); await sleep(300); } });
    log('16-bit virtual address、4 KiB page：VPN = 高 4 bits、page offset = 低 12 bits。');
    log('TLB 4 entries、fully associative、LRU；page fault 時放到下一個空的 frame（13、14、15…），沒有空 frame 就換 LRU 的 page。');
    vmState(null);
  }
  function vmState(r) {
    const rows = [['VA → VPN | offset', r ? r.va + ' → ' + r.vpn + ' | ' + hex(r.off, 3) : '—'], ['TLB', r ? (r.tlbHit ? 'hit' : 'miss' + (r.tlbVictim !== undefined ? '（換掉 VPN ' + r.tlbVictim + '）' : '')) : '—'], ['Page table', r ? (r.tlbHit ? '不用查' : r.fault ? 'valid = 0 → page fault' : 'valid → PPN ' + r.ppn) : '—'], ['PA', r ? hex(r.pa) + ' = ' + r.pa : '—'], ['累計', 'TLB hit ' + vm.tlbHit + ' / miss ' + vm.tlbMiss + '、page fault ' + vm.faults]];
    setState('位址轉換', rows, 'PA = PPN × 4096 + offset；offset 不用翻譯');
  }
  async function vmOne(va, write) {
    if (vmBusy) return;
    if (!(va >= 0 && va <= 65535) || !Number.isInteger(va)) { log('virtual address 要是 0–65535（16 bits）。', true); return; }
    vmBusy = true;
    try {
      vm.unglow();
      const r = await vm.access(va, write);
      log(va + '（VPN ' + r.vpn + '）：' + (r.tlbHit ? 'TLB hit' : 'TLB miss → ' + (r.fault ? 'page fault，從 disk 讀進 frame ' + r.newFrame + (r.evicted !== undefined ? '（換掉 VP ' + r.evicted + (r.wroteBack ? '，dirty 先寫回 disk' : '') + '）' : '') : '查 page table 得 PPN ' + r.ppn)) + ' → PA ' + r.pa);
      vmState(r);
    } finally { vmBusy = false; }
  }

  // ───────────────────────── 模式 2：TLB／Page table／Cache 組合 ─────────────────────────
  const COMBO = {
    'hit,hit,hit': [true, '可能，但 TLB hit 時根本不會去查 page table'],
    'hit,hit,miss': [true, '可能，但 TLB hit 時根本不會去查 page table'],
    'miss,hit,hit': [true, 'TLB miss，page table 找到；資料剛好在 cache'],
    'miss,hit,miss': [true, 'TLB miss，page table 找到；cache 也 miss'],
    'miss,miss,miss': [true, 'TLB miss 接著 page fault；page 不在記憶體，資料不可能在 cache'],
    'hit,miss,miss': [false, '不可能：page 不在記憶體，TLB 不會有它的 translation'],
    'hit,miss,hit': [false, '不可能：page 不在記憶體，TLB 不會有它的 translation'],
    'miss,miss,hit': [false, '不可能：page 不在記憶體，資料不可能在 cache'],
  };
  const cb = { tlb: 'miss', pt: 'hit', ca: 'hit' };
  function enterCombo() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 13.5], [0, 3, 0]);
    cb.m = { tlb: cube('TLB', '#4b9ee2', [2.2, 1, 1.2], -4.4, 4.5, 0), pt: cube('Page table', '#9b7ef4', [2.2, 1, 1.2], 0, 4.5, 0), ca: cube('Cache', '#2fc092', [2.2, 1, 1.2], 4.4, 4.5, 0) };
    cb.l = { tlb: tag('', 'ptr', -4.4, 3.4), pt: tag('', 'ptr', 0, 3.4), ca: tag('', 'ptr', 4.4, 3.4) };
    cb.res = tag('', 'ptr alt', 0, 1.6);
    controls('<select id="xT"><option value="hit">TLB hit</option><option value="miss">TLB miss</option></select>'
      + '<select id="xP"><option value="hit">Page table hit</option><option value="miss">Page table miss（page fault）</option></select>'
      + '<select id="xC"><option value="hit">Cache hit</option><option value="miss">Cache miss</option></select><button class="primary" id="xGo">可能發生嗎？</button><button id="xAll">8 種全部走一遍</button>');
    $('xT').value = cb.tlb; $('xP').value = cb.pt; $('xC').value = cb.ca;
    const rd = () => { cb.tlb = $('xT').value; cb.pt = $('xP').value; cb.ca = $('xC').value; updCombo(); };
    ['xT', 'xP', 'xC'].forEach((id) => { $(id).onchange = rd; });
    on('xGo', rd);
    on('xAll', async () => { for (const k of Object.keys(COMBO)) { if (!$('xT')) return; /* left this mode mid-run */ [cb.tlb, cb.pt, cb.ca] = k.split(','); $('xT').value = cb.tlb; $('xP').value = cb.pt; $('xC').value = cb.ca; updCombo(); await sleep(1100); } });
    log('P&H 圖 5.31：TLB、page table、cache 三者 hit/miss 的 8 種組合，哪些可能發生？（physically addressed cache）');
    updCombo();
  }
  function updCombo() {
    const [ok, why] = COMBO[[cb.tlb, cb.pt, cb.ca].join(',')];
    for (const k of ['tlb', 'pt', 'ca']) { glow(cb.m[k], cb[k] === 'hit' ? GREEN : RED); txt(cb.l[k], cb[k]); }
    txt(cb.res, (ok ? '可能' : '不可能') + '：' + why);
    log(cb.tlb + ' / ' + cb.pt + ' / ' + cb.ca + ' → ' + (ok ? '可能' : '不可能'), !ok);
    setState('TLB／Page table／Cache', [['TLB', cb.tlb], ['Page table', cb.pt], ['Cache', cb.ca]], (ok ? '<span class="ok">可能</span>' : '<span class="no">不可能</span>') + '：' + why);
  }

  // ───────────────────────── 模式 3：DRAM 的 RAS／CAS ─────────────────────────
  // 示意時序：precharge tRP、activate（RAS→CAS）tRCD、CAS latency CL，單位 ns（示意值）
  const DR = { rows: 8, cols: 8, open: -1, t: 0, hit: 0, miss: 0, tRP: 15, tRCD: 15, CL: 15 };
  function enterDram() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7, 12], [0, 1.6, 0]);
    DR.cells = [];
    for (let r = 0; r < DR.rows; r++) { const row = []; for (let c = 0; c < DR.cols; c++) row.push(cube('', '#efe6d6', [0.7, 0.3, 0.55], -3.2 + c * 0.85, 0.15, -3.0 + r * 0.7)); DR.cells.push(row); tag('row ' + r, 'idx', -4.4, 0.15, -3.0 + r * 0.7); }
    DR.buf = []; for (let c = 0; c < DR.cols; c++) DR.buf.push(cube('', '#c9b48e', [0.7, 0.4, 0.55], -3.2 + c * 0.85, 0.2, 3.2));
    tag('row buffer（sense amps）', 'ptr', 4.4, 0.2, 3.2);
    DR.timeL = tag('', 'ptr alt', 0, 2.6, 0);
    Object.assign(DR, { open: -1, t: 0, hit: 0, miss: 0 });
    controls('<label>row <input id="dR" type="number" min="0" max="7" value="2" style="width:50px"></label><label>column <input id="dC" type="number" min="0" max="7" value="5" style="width:50px"></label>'
      + '<button class="primary" id="dGo">讀取</button><button id="dSeq">同一 row 連讀 4 個</button><button id="dRef">Refresh 一個 row</button>');
    on('dGo', () => { const r = Number($('dR').value), c = Number($('dC').value); if (!(r >= 0 && r < 8 && c >= 0 && c < 8)) { log('row、column 都要是 0–7。', true); return; } dramRead(r, c); });
    on('dSeq', async () => { const r = Number($('dR').value) || 0; for (let c = 0; c < 4; c++) { await dramRead(r, c); await sleep(400); } });
    on('dRef', async () => { const r = Number($('dR').value) || 0; DR.cells[r].forEach((m) => glow(m, GOLD)); log('Refresh：DRAM 用電容存電荷，會漏電；要定期把整個 row 讀出再寫回。refresh 期間這個 bank 不能被存取。'); await sleep(600); DR.cells[r].forEach((m) => glow(m, null)); DR.open = -1; drawBuf(); });
    log('DRAM 位址分兩次送：先送 row address（RAS），整列讀進 row buffer；再送 column address（CAS）選出要的資料。');
    log('數值是示意：tRP = tRCD = CL = 15 ns。row 已開著（row buffer hit）只需要 CAS。');
    dramState(null);
  }
  function drawBuf() { DR.buf.forEach((m, c) => { tint(m, DR.open >= 0 ? colOf(DR.open) : '#c9b48e'); relabel(m, DR.open >= 0 ? DR.open + ',' + c : ''); }); }
  async function dramRead(r, c, tok) {
    DR.cells.flat().forEach((m) => glow(m, null)); DR.buf.forEach((m) => glow(m, null));
    let t = 0, steps = [];
    if (DR.open === r) { DR.hit++; steps.push('row buffer hit：只要 CAS ' + DR.CL + ' ns'); t = DR.CL; }
    else {
      DR.miss++;
      if (DR.open >= 0) { steps.push('precharge（關掉 row ' + DR.open + '）' + DR.tRP + ' ns'); t += DR.tRP; DR.buf.forEach((m) => glow(m, RED)); await wait(tok, 400); }
      DR.cells[r].forEach((m) => glow(m, GOLD));
      steps.push('RAS：activate row ' + r + ' → row buffer ' + DR.tRCD + ' ns'); t += DR.tRCD;
      await wait(tok, 500);
      DR.open = r; drawBuf();
      steps.push('CAS：選 column ' + c + ' ' + DR.CL + ' ns'); t += DR.CL;
    }
    glow(DR.buf[c], GREEN); glow(DR.cells[r][c], GREEN);
    txt(DR.timeL, '(' + r + ',' + c + ')：' + t + ' ns');
    log('讀 (' + r + ',' + c + ')：' + steps.join(' → ') + ' = ' + t + ' ns');
    dramState(t);
    return t;
  }
  function dramState(t) {
    setState('DRAM：RAS / CAS', [['開著的 row', DR.open >= 0 ? String(DR.open) : '無'], ['這次', t === null ? '—' : t + ' ns'], ['row buffer hit / miss', DR.hit + ' / ' + DR.miss]],
      '同一 row 連續讀：只付一次 RAS → <span class="ok">burst／page mode</span> 提高頻寬');
  }

  // ───────────────────────── 模式 4：記憶體組織與頻寬 ─────────────────────────
  const BW = { addr: 1, acc: 15, xfer: 1, words: 4, banks: 4 };
  function bwCalc(o) {
    const one = o.addr + o.words * o.acc + o.words * o.xfer;
    const wide = o.addr + o.acc + o.xfer;
    const inter = o.addr + Math.ceil(o.words / o.banks) * o.acc + o.words * o.xfer;
    return { one, wide, inter, bytes: o.words * 4 };
  }
  function enterBW() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4, 14], [0, 2.8, 0]);
    controls('<label>送位址 <input id="bA" type="number" min="1" max="4" value="' + BW.addr + '" style="width:45px"></label>'
      + '<label>DRAM 存取 <input id="bD" type="number" min="2" max="40" value="' + BW.acc + '" style="width:50px"></label>'
      + '<label>傳一個 word <input id="bX" type="number" min="1" max="4" value="' + BW.xfer + '" style="width:45px"></label>'
      + '<label>block <select id="bW"><option>2</option><option selected>4</option><option>8</option></select> words</label>'
      + '<label>banks <select id="bB"><option>2</option><option selected>4</option><option>8</option></select></label>'
      + '<button class="primary" id="bGo">畫時間軸</button>');
    const rd = () => { const n = (id, lo, hi) => Math.max(lo, Math.min(hi, Number($(id).value) || lo)); BW.addr = n('bA', 1, 4); BW.acc = n('bD', 2, 40); BW.xfer = n('bX', 1, 4); BW.words = Number($('bW').value); BW.banks = Number($('bB').value); drawBW(); };
    on('bGo', rd); ['bW', 'bB'].forEach((id) => { $(id).onchange = rd; });
    log('P&H 例：送位址 1 cycle、每次 DRAM 存取 15 cycles、每傳一個 word 1 cycle，block 4 words。');
    drawBW();
  }
  function drawBW() {
    lab.clear();
    const r = bwCalc(BW), maxT = Math.max(r.one, r.wide, r.inter), k = 11 / maxT, x0 = -5.6;
    const lanes = [['一個 word 寬', 5.4, () => { let t = 0; const s = [[t, t += BW.addr, '#31aab0']]; for (let i = 0; i < BW.words; i++) { s.push([t, t += BW.acc, '#4b9ee2']); s.push([t, t += BW.xfer, '#dd8238']); } return s; }, r.one],
      ['寬記憶體（' + BW.words + ' words 寬）', 3.4, () => { let t = 0; return [[t, t += BW.addr, '#31aab0'], [t, t += BW.acc, '#4b9ee2'], [t, t += BW.xfer, '#dd8238']]; }, r.wide],
      ['Interleaved（' + BW.banks + ' banks）', 1.4, () => { let t = 0; const s = [[t, t += BW.addr, '#31aab0']]; const rounds = Math.ceil(BW.words / BW.banks); for (let q = 0; q < rounds; q++) s.push([t, t += BW.acc, '#9b7ef4']); for (let i = 0; i < BW.words; i++) s.push([t, t += BW.xfer, '#dd8238']); return s; }, r.inter]];
    for (const [n, y, segs, tot] of lanes) {
      tag(n, 'ptr', -3.8, y + 0.75);
      for (const [a, b, c] of segs()) seg(c, x0 + a * k, x0 + b * k, y, 0.5, 0.8);
      tag(tot + ' cycles · ' + r2(r.bytes / tot) + ' B/cycle', 'ptr alt', x0 + tot * k + 0.2 > 4 ? 4.2 : x0 + tot * k + 1.6, y + 0.75);
    }
    tag('青：送位址　藍/紫：DRAM 存取　橘：傳 word', 'idx', 0, 0.3, 1.2);
    setState('Miss penalty 與頻寬', [['一個 word 寬', BW.addr + ' + ' + BW.words + '×' + BW.acc + ' + ' + BW.words + '×' + BW.xfer + ' = ' + r.one], ['寬記憶體', BW.addr + ' + ' + BW.acc + ' + ' + BW.xfer + ' = ' + r.wide], ['Interleaved', BW.addr + ' + ' + Math.ceil(BW.words / BW.banks) + '×' + BW.acc + ' + ' + BW.words + '×' + BW.xfer + ' = ' + r.inter]],
      '頻寬 = ' + r.bytes + ' bytes / cycles：' + r2(r.bytes / r.one) + '、' + r2(r.bytes / r.wide) + '、<span class="ok">' + r2(r.bytes / r.inter) + '</span> B/cycle');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function opts4(ans, cands, unit = '') {
    const s = new Set([ans]);
    for (const c of cands) { if (s.size >= 4) break; if (c !== undefined && c !== null && String(c) !== '' && !String(c).startsWith('-') && !String(c).startsWith('NaN')) s.add(String(c)); }
    let k = 1; while (s.size < 4) { s.add(String(Number.parseFloat(ans) + k * 7) + unit); k++; }
    return [...s];
  }
  const CONCEPT = [
    { q: '為什麼 virtual memory 用 write-back 而不是 write-through？', opts: ['寫 disk 要數百萬個 cycle，每次寫都寫 disk 太慢', '因為 page table 沒有 valid bit', '因為 TLB 是 fully associative', 'write-through 會造成 compulsory miss'], ans: '寫 disk 要數百萬個 cycle，每次寫都寫 disk 太慢', why: 'page fault／寫 disk 的代價極大，所以 VM 一律 write-back，配 dirty bit 只寫回被改過的 page。' },
    { q: '為什麼 page 的擺放採 fully associative？', opts: ['page fault 代價極高，要盡量降低 miss rate', '因為 page 很小', '為了讓 TLB 不需要 tag', '為了讓 page table 不需要 valid bit'], ans: 'page fault 代價極高，要盡量降低 miss rate', why: 'miss penalty 是數百萬 cycles，值得用軟體（OS）+ 完全自由的擺放來降低 miss；page table 就是「完全關聯」的查表方式。' },
    { q: 'TLB 是什麼的 cache？', opts: ['Page table（位址轉換）', '資料', '指令', 'Disk'], ans: 'Page table（位址轉換）', why: 'TLB 存最近用過的 VPN → PPN translation，省掉每次都去記憶體查 page table。' },
    { q: '以下哪一種組合不可能發生？（physically addressed cache）', opts: ['TLB hit、page table miss', 'TLB miss、page table hit、cache hit', 'TLB miss、page table hit、cache miss', 'TLB miss、page table miss、cache miss'], ans: 'TLB hit、page table miss', why: 'page 不在記憶體時，TLB 不會留著它的 translation（換出 page 時會把 TLB 對應項作廢）。' },
    { q: 'DRAM 位址為什麼分 RAS 與 CAS 兩次送？', opts: ['row 與 column 共用位址腳位，先選 row 再選 column', '因為 DRAM 需要 refresh', '因為 SRAM 比 DRAM 快', '為了支援 write-back'], ans: 'row 與 column 共用位址腳位，先選 row 再選 column', why: 'DRAM 是二維陣列：RAS 把整個 row 讀進 row buffer，CAS 再挑 column；同一 row 連續存取只要 CAS。' },
    { q: 'Low-order interleaving 的特點？', opts: ['連續的 word 分散到不同 bank，可重疊存取', '連續的 word 都在同一個 bank', '每個 bank 存一個 process', '不需要送位址'], ans: '連續的 word 分散到不同 bank，可重疊存取', why: 'bank = address mod banks：一個 block 的相鄰 word 落在不同 bank，同時啟動 DRAM 存取，再依序傳回。high-order 則是連續位址在同一個 module。' },
  ];
  function genQ() {
    const p = Math.random();
    if (p < 0.2) {
      const vb = pickOne([32, 36, 40, 48]), pk = pickOne([4, 8, 16, 64]), pte = pickOne([4, 8]);
      const off = Math.log2(pk * 1024), vpn = vb - off, size = Math.pow(2, vpn) * pte;
      const fmt = (b) => b >= 2 ** 30 ? b / 2 ** 30 + ' GiB' : b >= 2 ** 20 ? b / 2 ** 20 + ' MiB' : b / 1024 + ' KiB';
      return { q: vb + '-bit virtual address、page ' + pk + ' KiB、每個 PTE ' + pte + ' bytes，單層 page table 多大？', opts: opts4(fmt(size), [fmt(size * 2), fmt(size / 2), fmt(Math.pow(2, vpn) * 4 === size ? size * 2 : Math.pow(2, vpn) * 4), fmt(Math.pow(2, vb - 10) * pte), fmt(size * 4)]), ans: fmt(size), why: 'offset = log₂(' + pk + ' KiB) = ' + off + ' bits → VPN ' + vpn + ' bits → 2^' + vpn + ' 個 PTE × ' + pte + ' B = ' + fmt(size) + '。' };
    }
    if (p < 0.38) {
      const va = rnd(1, 65535), pk = pickOne([1, 2, 4]), offB = Math.log2(pk * 1024);
      const vpn = Math.floor(va / (pk * 1024)), off = va % (pk * 1024), ppn = rnd(0, 31);
      const pa = ppn * pk * 1024 + off;
      return { q: 'page ' + pk + ' KiB，virtual address ' + va + ' 的 VPN 對到 PPN ' + ppn + '，physical address = ？', opts: opts4(String(pa), [String(ppn * pk * 1024 + vpn), String(ppn + off), String(vpn * pk * 1024 + off === pa ? pa + pk * 1024 : vpn * pk * 1024 + off), String(ppn * pk * 1000 + off)]), ans: String(pa), why: 'VPN = ⌊' + va + ' / ' + pk * 1024 + '⌋ = ' + vpn + '、offset = ' + off + '；PA = ' + ppn + ' × ' + pk * 1024 + ' + ' + off + ' = ' + pa + '。offset 不變，只換 page number。' };
    }
    if (p < 0.56) {
      const a = pickOne([1, 2]), acc = pickOne([10, 15, 20]), x = pickOne([1, 2]), w = pickOne([4, 8]), banks = w;
      const one = a + w * acc + w * x, inter = a + acc + w * x, wide = a + acc + x;
      const which = pickOne(['one', 'inter', 'wide']);
      const ans = which === 'one' ? one : which === 'inter' ? inter : wide;
      const nm = which === 'one' ? '一個 word 寬的記憶體' : which === 'inter' ? banks + ' 個 bank 的 interleaved 記憶體' : w + ' words 寬的記憶體（bus 也一樣寬）';
      return { q: '送位址 ' + a + ' cycle、DRAM 存取 ' + acc + ' cycles、傳一個 word（bus 寬）' + x + ' cycle，block ' + w + ' words。' + nm + '的 miss penalty？', opts: opts4(String(ans), [one, inter, wide, a + w * acc + x, w * (a + acc + x)].map(String)), ans: String(ans), why: '一個 word 寬：' + a + ' + ' + w + '×' + acc + ' + ' + w + '×' + x + ' = ' + one + '；interleaved：' + a + ' + ' + acc + ' + ' + w + '×' + x + ' = ' + inter + '（各 bank 同時存取）；寬記憶體：' + a + ' + ' + acc + ' + ' + x + ' = ' + wide + '。' };
    }
    if (p < 0.72) {
      const hit = pickOne([0.5, 1]), missP = pickOne([10, 20, 30, 50]), mr = pickOne([0.5, 1, 2]);
      const ans = r2(hit + mr / 100 * missP);
      return { q: 'TLB hit time ' + hit + ' cycle、TLB miss rate ' + mr + '%、TLB miss penalty ' + missP + ' cycles，平均每次位址轉換花幾個 cycle？', opts: opts4(String(ans), [r2(mr / 100 * missP), r2(hit + missP), r2(hit + mr * missP), r2((1 - mr / 100) * missP)].map(String)), ans: String(ans), why: '和 AMAT 一樣：hit time + miss rate × miss penalty = ' + hit + ' + ' + mr / 100 + ' × ' + missP + ' = ' + ans + '。' };
    }
    if (p < 0.82) {
      const banks = pickOne([4, 8]), addr = rnd(0, 63);
      return { q: banks + ' 個 bank 的 low-order interleaving，word address ' + addr + ' 在哪個 bank？', opts: opts4(String(addr % banks), [String(Math.floor(addr / banks) % banks), String((addr + 1) % banks), String(Math.floor(addr / (64 / banks)))]), ans: String(addr % banks), why: 'low-order：bank = address mod ' + banks + ' = ' + addr % banks + '（bank 內位置 = ⌊address / ' + banks + '⌋）。' };
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

  // ───────────────────────── 場景（依 P&H 第 5 章；本章影片尚無逐字稿） ─────────────────────────
  async function scVmIdea(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const A = [], B = [];
    tag('Program A 的 virtual pages', 'ptr', -4.8, 6.6); tag('Program B', 'ptr', -1.6, 6.6);
    for (let k = 0; k < 4; k++) { A.push(cube('A' + k, '#4b9ee2', [1.3, 0.5, 0.8], -4.8, 5.6 - k * 0.8, 0)); B.push(cube('B' + k, '#9b7ef4', [1.3, 0.5, 0.8], -1.6, 5.6 - k * 0.8, 0)); }
    tag('Main memory', 'ptr', 2.2, 6.6);
    const fr = []; for (let k = 0; k < 6; k++) fr.push(cube('', '#efe6d6', [1.5, 0.45, 0.8], 2.2, 5.8 - k * 0.7, 0));
    const disk = cube('Disk', '#c9b48e', [1.4, 3.4, 1.4], 5.6, 3.8, 0);
    say('Virtual memory：主記憶體當 disk 的 cache', '每個程式以為自己有一整片位址空間');
    await beat(tok, 2800);
    const map = [['A0', 3, '#4b9ee2', -4.8, 5.6], ['B1', 0, '#9b7ef4', -1.6, 4.8], ['A2', 5, '#4b9ee2', -4.8, 4.0], ['B3', 2, '#9b7ef4', -1.6, 3.2]];
    for (const [n, f, c, x, y] of map) {
      const g = cube(n, c, [1.3, 0.45, 0.8], x, y, 0.6); move(g, 2.2, 5.8 - f * 0.7, 0.6);
      say(n + ' → 實體 frame ' + f, '位址轉換：virtual address → physical address');
      await beat(tok, 1000); kill(g); tint(fr[f], c); relabel(fr[f], n);
    }
    say('沒放進記憶體的 page 留在 disk', '存取到它 → page fault');
    glow(disk, GOLD); await beat(tok, 2400); glow(disk, null);
    say('好處：多程式共享記憶體、互相保護', '程式可大於實體記憶體；relocation 很容易');
    await beat(tok, 3000);
    say('名詞對照：block → page；miss → page fault', '');
    await beat(tok, 2400);
  }
  async function scVaSplit(tok) {
    fresh([0, 3.2, 13], [0, 2.6, 0]);
    say('P&H 例：32-bit virtual address、page 4 KiB', 'offset = log₂ 4096 = 12 bits');
    await beat(tok, 2600);
    const va = bitStrip(null, [{ n: 'virtual page number 20 bits', b: 20, c: '#9b7ef4' }, { n: 'page offset 12', b: 12, c: '#dd8238' }], 4.6);
    await beat(tok, 2200);
    say('VPN 20 bits → 2²⁰ 個 virtual page', '要翻譯的只有 VPN');
    await beat(tok, 2600);
    const pa = bitStrip(null, [{ n: 'physical page number 18', b: 18, c: '#2fc092' }, { n: 'page offset 12', b: 12, c: '#dd8238' }], 1.6);
    tag('translation', 'ptr alt', -1.5, 3.1);
    say('實體記憶體 1 GiB = 2³⁰：physical address 30 bits', 'PPN 18 bits → 2¹⁸ 個 frame');
    await beat(tok, 3000);
    pa.cubes.slice(18).forEach((m) => glow(m, GOLD)); va.cubes.slice(20).forEach((m) => glow(m, GOLD));
    say('page offset 原封不動抄過去', 'virtual page 比 physical page 多 → 不可能全部放得下');
    await beat(tok, 3000);
  }
  async function scPageTable(tok) {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const ptr = cube('Page table register', '#31aab0', [3.2, 0.6, 0.9], -4.6, 6.6, 0);
    const rows = [];
    for (let k = 0; k < 8; k++) rows.push(cube(k === 5 ? 'V=1  PPN 0x2A' : k % 3 === 1 ? 'V=0  （disk）' : 'V=1  PPN …', k === 5 ? '#2fc092' : k % 3 === 1 ? GRAY : '#4b9ee2', [3.0, 0.45, 0.8], -0.5, 6.2 - k * 0.6, 0));
    tag('Page table（在記憶體裡）', 'ptr', -0.5, 6.95);
    say('每個 process 有自己的 page table，放在記憶體', 'page table register 指向它的起點');
    glow(ptr, GOLD); await beat(tok, 2800); glow(ptr, null);
    const vpn = cube('VPN = 5', '#9b7ef4', [1.6, 0.5, 0.8], -4.6, 3.4, 0), off = cube('offset', '#dd8238', [1.3, 0.5, 0.8], -3.0, 3.4, 0);
    say('用 VPN 當 index，找到第 5 個 entry', '不需要 tag：page table 是用 VPN 直接 index');
    await beat(tok, 1200);
    for (let k = 0; k <= 5; k++) { glow(rows[k], GOLD); await beat(tok, 220); if (k < 5) glow(rows[k], null); }
    await beat(tok, 900);
    say('valid = 1：取出 physical page number', 'valid = 0：page 不在記憶體 → page fault');
    await beat(tok, 2600);
    const ppn = cube('PPN 0x2A', '#2fc092', [1.6, 0.5, 0.8], -0.5, 6.2 - 5 * 0.6, 0.6); move(ppn, 3.6, 1.4, 0);
    move(off, 5.2, 1.4, 0);
    tag('physical address', 'ptr alt', 4.4, 2.3);
    say('PPN 接上 page offset = physical address', '');
    await beat(tok, 3000);
  }
  async function scPageFault(tok) {
    fresh([0, 4, 14], [0, 3, 0]);
    const steps = ['① page table：valid = 0 → exception', '② OS 在 disk（swap space）找到這個 page', '③ 選一個 frame 換掉（LRU 近似：reference bit）', '④ 被換的若 dirty → 先寫回 disk', '⑤ 讀進新 page、更新 page table', '⑥ 重新執行造成 fault 的指令'];
    const ls = steps.map((s, k) => tag(s, 'idx', -2.6, 6.6 - k * 0.55));
    const mem = []; for (let k = 0; k < 4; k++) mem.push(cube(['P1', 'P4 D', 'P6', 'P2'][k], k === 1 ? '#dd8238' : '#4b9ee2', [1.5, 0.5, 0.8], 2.8, 2.6 - k * 0.65, 0));
    tag('Memory', 'ptr', 2.8, 3.3);
    const disk = cube('Disk', '#c9b48e', [1.4, 2.6, 1.4], 5.8, 1.6, 0);
    say('Page fault：要的 page 不在記憶體', '由作業系統處理（軟體），要數百萬個 cycle');
    await beat(tok, 2800);
    for (let k = 0; k < 6; k++) {
      ls.forEach((l, j) => { l.element.className = 'lab-label ' + (j === k ? 'ptr alt' : 'idx'); });
      say(steps[k].slice(2), k === 2 ? 'P4 最久沒被參考（reference bit = 0）' : k === 3 ? 'P4 被寫過（dirty bit = 1）' : '');
      if (k === 2) glow(mem[1], GOLD);
      if (k === 3) { const g = cube('P4', '#dd8238', [1.2, 0.45, 0.7], 2.8, 2.6 - 0.65, 0.6); move(g, 5.8, 1.6, 0.6); await beat(tok, 800); kill(g); }
      if (k === 4) { const g = cube('P9', '#9b7ef4', [1.2, 0.45, 0.7], 5.8, 1.6, 0.6); move(g, 2.8, 2.6 - 0.65, 0.6); await beat(tok, 800); kill(g); glow(mem[1], null); relabel(mem[1], 'P9'); tint(mem[1], '#9b7ef4'); }
      await beat(tok, 1700);
    }
    say('miss 太貴 → fully associative 擺放、write-back', '寫入一律 write-back：寫 disk 太慢');
    await beat(tok, 3000);
  }
  async function scPtSize(tok) {
    fresh([0, 4.5, 14], [0, 3.2, 0]);
    say('32-bit 位址、4 KiB page、每個 PTE 4 bytes', 'page table 有多大？');
    await beat(tok, 2600);
    const big = cube('', '#9b7ef4', [1.4, 0.1, 1.4], -4, 0.05, 0);
    await anim(tok, 900, (t) => { big.scale.y = 1 + t * 55; big.position.y = big.scale.y * 0.05; });
    tag('2²⁰ × 4 B = 4 MiB', 'ptr alt', -4, 6.4);
    say('2²⁰ 個 entry × 4 bytes = 4 MiB', '每個 process 一份；100 個 process 就 400 MiB');
    await beat(tok, 3000);
    say('解法之一：多層 page table', '只為真的有用到的區域配置第二層');
    const st = bitStrip(null, [{ n: '第一層 10', b: 10, c: '#4b9ee2' }, { n: '第二層 10', b: 10, c: '#9b7ef4' }, { n: 'offset 12', b: 12, c: '#dd8238' }], 6.6, 0, 0.26);
    st.cubes.forEach((m) => { m.position.x += 2.2; }); st.labels.forEach((l) => { l.position.x += 2.2; });
    const l1 = cube('L1 table', '#4b9ee2', [1.6, 1.8, 0.9], 0.6, 1.4, 0);
    const l2a = cube('L2', '#9b7ef4', [1.2, 1.0, 0.9], 3.2, 3.2, 0), l2b = cube('L2', '#9b7ef4', [1.2, 1.0, 0.9], 3.2, 1.0, 0);
    const ghost = cube('（沒用到，不配置）', GRAY, [2.4, 0.5, 0.9], 4.8, 4.6, 0);
    await beat(tok, 3000);
    say('程式只用到兩小區 → 只要 3 個小表', '其他還有：inverted page table、hashing');
    await beat(tok, 3000);
  }
  async function scTLB(tok) {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    say('每次存取都查 page table = 多一次記憶體存取', '太慢 → 用 TLB 快取 translation');
    await beat(tok, 2800);
    const tl = []; [['3', '6'], ['7', '4'], ['11', '12'], ['1', '13']].forEach(([v, p], k) => tl.push(cube('VPN ' + v + ' → PPN ' + p, colOf(Number(v)), [2.6, 0.5, 0.8], -3.6, 5.6 - k * 0.7, 0)));
    tag('TLB（小、fully/set associative）', 'ptr', -3.6, 6.5);
    const pt = cube('Page table（記憶體）', '#9b7ef4', [2.6, 2.6, 0.9], 3.6, 4.2, 0);
    const req = tag('', 'ptr alt', 0, 1.4);
    txt(req, 'VPN 7？');
    say('VPN 7：TLB 裡有 → TLB hit', '直接得到 PPN 4，不碰 page table');
    glow(tl[1], GREEN); await beat(tok, 2600); glow(tl[1], null);
    txt(req, 'VPN 0？');
    say('VPN 0：TLB 沒有 → TLB miss', '去記憶體查 page table');
    tl.forEach((m) => glow(m, RED)); await beat(tok, 1200); tl.forEach((m) => glow(m, null));
    glow(pt, GOLD); await beat(tok, 1200);
    const g = cube('VPN 0 → PPN 5', '#2fc092', [2.6, 0.5, 0.8], 3.6, 4.2, 0.6); move(g, -3.6, 5.6 - 2 * 0.7, 0.6);
    fly(tl[2], V3(-3, 7, 3));
    say('把 translation 放進 TLB（換掉一個）', '被換掉的若 dirty/reference 位元有變，要寫回 page table');
    await beat(tok, 2800); glow(pt, null);
    say('P&H：TLB 16–512 entries、hit 0.5–1 cycle', 'miss penalty 10–100 cycles、miss rate 0.01%–1%');
    await beat(tok, 3200);
  }
  async function scTlbSeq(tok) {
    fresh([0, 4.2, 15], [0, 3.6, 0]);
    const M = makeVM();
    say('TLB 4 entries（LRU）、4 KiB page', '依序存取 4669, 2227, 13916, 34587, 48870, 12608, 49225');
    await beat(tok, 3200);
    for (const a of VM_SEQ) {
      M.unglow();
      const r = await M.access(a, false, tok, 1.3);
      say(a + '：VPN ' + r.vpn + ' → ' + (r.tlbHit ? 'TLB hit' : r.fault ? 'TLB miss + page fault' : 'TLB miss，page table hit'), r.fault ? '從 disk 讀進 frame ' + r.newFrame + '，更新 page table 與 TLB' : 'PA = ' + r.ppn + ' × 4096 + ' + r.off + ' = ' + r.pa);
      await beat(tok, 2300);
    }
    say('結果：TLB hit ' + M.tlbHit + '、miss ' + M.tlbMiss + '；page fault ' + M.faults, 'VPN = ⌊address / 4096⌋');
    await beat(tok, 3200);
  }
  async function scTlbCache(tok) {
    fresh([0, 4.2, 14], [0, 3.2, 0]);
    const steps = [['Virtual address', '#9b7ef4', -5.2], ['TLB', '#4b9ee2', -2.6], ['Physical address', '#2fc092', 0], ['Cache（physically tagged）', '#dd8238', 2.8], ['Data → CPU', '#31aab0', 5.4]];
    const ms = steps.map(([n, c, x]) => cube('', c, [1.6, 1.0, 1.0], x, 4.4, 0));
    steps.forEach(([n, c, x], k) => tag(n, k % 2 ? 'ptr' : 'ptr alt', x, k % 2 ? 5.5 : 3.4));
    say('P&H FastMATH：先翻譯，再查 cache', 'cache 用 physical address 的 tag 與 index');
    await beat(tok, 2600);
    const tok1 = cube('VA', '#e55a9b', [0.7, 0.5, 0.6], -5.2, 4.4, 0.8);
    const cap = ['VPN 送進 TLB 比對', 'TLB hit：PPN + page offset = PA', 'PA 切成 cache 的 tag | index | offset', 'tag 相同且 valid → cache hit', ''];
    for (let k = 1; k < 5; k++) {
      move(tok1, steps[k][2], 4.4, 0.8); glow(ms[k], GOLD);
      say(cap[k - 1], k === 1 ? 'TLB miss → 例外，由軟體或硬體查 page table' : k === 3 ? 'store 還要檢查 TLB 的 write access bit' : '');
      await beat(tok, 2000); glow(ms[k], null);
    }
    say('TLB 在 cache 存取的關鍵路徑上', '最好讓 TLB 很小、很快');
    await beat(tok, 2600);
    say('變形：用 page offset 當 cache index', 'VIPT：TLB 與 cache 可以同時查');
    await beat(tok, 3000);
  }
  async function scCombos(tok) {
    fresh([0, 4, 13.5], [0, 3, 0]);
    const ms = { tlb: cube('TLB', '#4b9ee2', [2.2, 1, 1.2], -4.4, 4.6, 0), pt: cube('Page table', '#9b7ef4', [2.2, 1, 1.2], 0, 4.6, 0), ca: cube('Cache', '#2fc092', [2.2, 1, 1.2], 4.4, 4.6, 0) };
    const res = tag('', 'ptr alt', 0, 2.2);
    say('P&H 圖 5.31：三者 hit/miss 的 7 種組合', '哪些真的可能發生？');
    await beat(tok, 2600);
    const order = ['hit,hit,miss', 'miss,hit,hit', 'miss,hit,miss', 'miss,miss,miss', 'hit,miss,miss', 'hit,miss,hit', 'miss,miss,hit'];
    for (const k of order) {
      const [a, b, c] = k.split(','); const [ok, why] = COMBO[k];
      glow(ms.tlb, a === 'hit' ? GREEN : RED); glow(ms.pt, b === 'hit' ? GREEN : RED); glow(ms.ca, c === 'hit' ? GREEN : RED);
      txt(res, (ok ? '可能' : '不可能') + '：TLB ' + a + '、PT ' + b + '、cache ' + c);
      say(why.split('：')[0] === '不可能' ? '不可能' : '可能', why.replace(/^不可能：/, ''));
      await beat(tok, 2600);
    }
    say('page 不在記憶體 → 它不可能在 TLB 或 cache', '');
    await beat(tok, 2600);
  }
  async function scDramOrg(tok) {
    fresh([0, 7, 11.5], [0, 1.4, 0]);
    const cells = []; for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 8; c++) row.push(cube('', '#efe6d6', [0.7, 0.3, 0.55], -3.2 + c * 0.85, 0.15, -2.6 + r * 0.7)); cells.push(row); }
    const buf = []; for (let c = 0; c < 8; c++) buf.push(cube('', '#c9b48e', [0.7, 0.4, 0.55], -3.2 + c * 0.85, 0.2, 2.6));
    tag('row buffer', 'ptr', 4.6, 0.2, 2.6);
    say('DRAM：一個電晶體 + 電容存 1 bit', '排成 rows × columns 的二維陣列');
    await beat(tok, 2600);
    say('RAS：送 row address，整列讀進 row buffer', 'activate');
    cells[3].forEach((m) => glow(m, GOLD)); await beat(tok, 1400);
    buf.forEach((m) => tint(m, '#4b9ee2')); await beat(tok, 1200);
    say('CAS：送 column address，從 buffer 挑出資料', '位址腳位共用 → 分兩次送');
    glow(buf[5], GREEN); await beat(tok, 2200);
    for (const c of [6, 7]) { glow(buf[c], GREEN); say('同一 row 的下一個 column：只要 CAS', 'burst / page mode：連續傳很快'); await beat(tok, 1100); }
    say('DDR：時脈上升、下降緣都傳資料', 'SDRAM 有 clock，搭配 burst 傳一整個 block');
    await beat(tok, 2800);
    say('電容會漏電 → 要定期 refresh', '一次把整列讀出再寫回');
    cells.flat().forEach((m) => glow(m, null));
    for (let r = 0; r < 6; r++) { cells[r].forEach((m) => glow(m, GOLD)); await beat(tok, 260); cells[r].forEach((m) => glow(m, null)); }
    await beat(tok, 1600);
  }
  async function scMemOrg3(tok) {
    fresh([0, 4, 14], [0, 2.8, 0]);
    say('P&H 例：送位址 1、DRAM 存取 15、傳一個 word 1', 'cache block 4 words：miss penalty？');
    await beat(tok, 3000);
    const k = 11 / 65, x0 = -5.6;
    const lanes = [['一個 word 寬', 5.4], ['寬記憶體（4 words 寬）', 3.4], ['Interleaved（4 banks）', 1.4]];
    lanes.forEach(([n, y]) => tag(n, 'ptr', -3.8, y + 0.75));
    // 1-word-wide
    let t = 0;
    await growSeg(tok, '#31aab0', x0, x0 + k, 5.4, '', 200); t = 1;
    for (let i = 0; i < 4; i++) { await growSeg(tok, '#4b9ee2', x0 + t * k, x0 + (t + 15) * k, 5.4, '', 350); t += 15; await growSeg(tok, '#dd8238', x0 + t * k, x0 + (t + 1) * k, 5.4, '', 120); t += 1; }
    tag('65 cycles', 'ptr alt', x0 + 65 * k - 0.2, 6.1);
    say('一個 word 寬：1 + 4×15 + 4×1 = 65 cycles', '頻寬 16 / 65 ≈ 0.25 bytes/cycle');
    await beat(tok, 2800);
    await growSeg(tok, '#31aab0', x0, x0 + k, 3.4, '', 200);
    await growSeg(tok, '#4b9ee2', x0 + k, x0 + 16 * k, 3.4, '', 350);
    await growSeg(tok, '#dd8238', x0 + 16 * k, x0 + 17 * k, 3.4, '', 150);
    tag('17 cycles', 'ptr alt', x0 + 17 * k + 0.9, 4.1);
    say('寬記憶體：1 + 15 + 1 = 17 cycles', '0.94 bytes/cycle，但 bus 與記憶體都要變寬');
    await beat(tok, 2800);
    await growSeg(tok, '#31aab0', x0, x0 + k, 1.4, '', 200);
    await growSeg(tok, '#9b7ef4', x0 + k, x0 + 16 * k, 1.4, '4 banks 同時', 350);
    for (let i = 0; i < 4; i++) await growSeg(tok, '#dd8238', x0 + (16 + i) * k, x0 + (17 + i) * k, 1.4, '', 150);
    tag('20 cycles', 'ptr alt', x0 + 20 * k + 0.9, 2.1);
    say('Interleaved：1 + 15 + 4×1 = 20 cycles', '0.8 bytes/cycle，bus 仍是一個 word 寬');
    await beat(tok, 3200);
  }
  async function scInterleaveMap(tok) {
    fresh([0, 4.5, 14], [0, 3, 0]);
    const banks = 4;
    say('補充：位址怎麼分到各個 bank？', 'low-order vs high-order interleaving');
    await beat(tok, 2400);
    for (const mode of ['low', 'high']) {
      const objs = [];
      for (let b = 0; b < banks; b++) { objs.push(tag('bank ' + b, 'ptr', -4.5 + b * 3, 6.6)); }
      say(mode === 'low' ? 'Low-order：bank = address mod 4' : 'High-order：bank = 位址最高 2 bits', mode === 'low' ? '連續位址輪流放進不同 bank' : '連續位址都在同一個 module');
      for (let a = 0; a < 16; a++) {
        const b = mode === 'low' ? a % banks : Math.floor(a / 4), slot = mode === 'low' ? Math.floor(a / banks) : a % 4;
        objs.push(cube(String(a), a < 4 ? '#e55a9b' : '#4b9ee2', [1.2, 0.5, 0.8], -4.5 + b * 3, 5.6 - slot * 0.75, 0, 3));
        await beat(tok, 160);
      }
      say(mode === 'low' ? '一個 block（0–3）分在 4 個 bank → 可同時存取' : 'block 0–3 全在 bank 0 → 只能一個一個來', mode === 'low' ? '適合 cache 的 block 傳輸' : '好處：模組可獨立擴充、不同程式用不同 module');
      await beat(tok, 3400);
      objs.forEach(kill);
    }
    say('考題多半問 low-order：bank = address mod banks', '');
    await beat(tok, 2400);
  }
  async function scInterleavePipe(tok) {
    fresh([0, 4, 14], [0, 2.8, 0]);
    say('Interleaving：各 bank 錯開啟動，資料一個接一個出來', '連續讀很多 word 時，頻寬接近每 cycle 一個 word');
    await beat(tok, 2800);
    const k = 0.42, x0 = -5.8;
    for (let b = 0; b < 4; b++) tag('bank ' + b, 'ptr', -6.4, 5.6 - b * 1.2);
    for (let w = 0; w < 8; w++) {
      const b = w % 4, y = 5.6 - b * 1.2, start = w * 2;
      await growSeg(tok, '#9b7ef4', x0 + start * k, x0 + (start + 7) * k, y, 'w' + w, 260);
      await growSeg(tok, '#dd8238', x0 + (start + 7) * k, x0 + (start + 8) * k, y, '', 100);
      say('word ' + w + ' → bank ' + b, '每個 bank 存取 7 + 傳 1 = 8 單位，每 2 單位出一個 word');
    }
    await beat(tok, 1800);
    say('單一 bank：8 個 word 要 8 × 8 = 64', '4 banks 錯開：2 × 7 + 8 = 22（示意數值）');
    await beat(tok, 3200);
  }

  const scenes = {
    'vm-idea': { title: 'Virtual memory：主記憶體當 disk 的 cache', play: scVmIdea },
    'va-split': { title: 'P&H 例：32-bit VA → 20-bit VPN + 12-bit offset', play: scVaSplit },
    'page-table': { title: 'Page table：用 VPN 當 index 找 PPN', play: scPageTable },
    'page-fault': { title: 'Page fault 的處理步驟、dirty 與 reference bit', play: scPageFault },
    'pt-size': { title: 'Page table 有多大：4 MiB 與多層 page table', play: scPtSize },
    tlb: { title: 'TLB：translation 的 cache', play: scTLB },
    'tlb-seq': { title: '經典題：TLB 4 entries、7 個位址的轉換', play: scTlbSeq },
    'tlb-cache': { title: 'TLB + cache 的存取流程（FastMATH）', play: scTlbCache },
    combos: { title: 'TLB／page table／cache 的可能組合', play: scCombos },
    'dram-org': { title: 'DRAM 組織：RAS、CAS、row buffer、refresh', play: scDramOrg },
    'mem-org-3': { title: 'P&H 例：65、17、20 cycles 的三種記憶體組織', play: scMemOrg3 },
    'interleave-map': { title: '補充：low-order vs high-order interleaving', play: scInterleaveMap },
    'interleave-pipe': { title: 'Interleaving：各 bank 錯開，提高頻寬', play: scInterleavePipe },
  };

  return {
    kicker: '計算機組織・第 6 章',
    title: '記憶體系統：Virtual Memory、TLB、DRAM、Interleaving',
    color: 'var(--ca)',
    modes: [
      { id: 'translate', name: '位址轉換', enter: enterTranslate },
      { id: 'combo', name: 'TLB／PT／Cache 組合', enter: enterCombo },
      { id: 'dram', name: 'DRAM RAS／CAS', enter: enterDram },
      { id: 'bw', name: '記憶體頻寬', enter: enterBW },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['vm-idea', 'va-split', 'page-table', 'page-fault', 'pt-size', 'tlb', 'tlb-seq', 'tlb-cache', 'combos', 'dram-org', 'mem-org-3', 'interleave-map', 'interleave-pipe'],
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
