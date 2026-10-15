// 計算機組織 第6章：記憶體系統（virtual memory 的硬體面：page table、TLB、位址轉換、page fault；
// cache + TLB + page table 的互動；DRAM 組織 RAS/CAS；memory interleaving 與頻寬）。
// 本章的黃婷婷 25A–26B 講與 Memory Interleaving 影片目前都沒有逐字稿，場景依 Patterson & Hennessy（MIPS 版）第 5 章重現。
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
      // 16 rows 0.36 apart: the row labels use a compact font so neighbours don't print over each other
      [...M.pt.map((e) => e.mesh), ...M.frames.map((f) => f.mesh)].forEach((m) => Object.assign(m.userData.lbl.element.style, { fontSize: '9px', lineHeight: '1.15', padding: '0 4px' }));
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dram.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 6 章（英文影片：Computer Science Lessons「DRAM Part 6 Burst Mode and Bank Interleaving」、
//     「Memory Interleaving concept」）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等講者講到那句話（notes 的 cues，標在 // @秒數 ~關鍵字）才做一個短動作，不循環、不重播。
// 講者的數字照用（17 address／6 command／64 data 線、72-bit ECC、2,133 MT/s、8 chips × 8 bits、8 banks、
// 1024 × 16384 array、burst length 4/8/16、18 cycles、64-byte cache line；1 + 5 + 1 = 7、28 vs 10 cycles、4 banks 2 bits…），
// 每個頻寬、位址切割、bit 數、cycle 數都由程式算出再顯示 ✓；講者沒給數字、我們補的例子標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const ok = (b, t, x, y) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const bx = (t, c, x, y, z = 0, w = 2.2, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const NC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7', rose: '#f2c4c4', metal: '#8a94a6', off: '#efe6d6', pcb: '#2e7d4f', chip: '#34363b' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.cubes && typeof o.kill === 'function') return o.kill(); if (o.cells) return gone(o.cells.flat(), o.lbls); if (o.g) return kill(o.g); if (o.element) remove(o); else kill(o); });
const lk = (x1, y1, x2, y2, c = 0x6e5f49, z = 0.1) => arrow(V3(x1, y1, z), V3(x2, y2, z), c);
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const fx = (v, d = 3) => String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const lg2 = (n) => Math.round(Math.log2(n));
const b2 = (v, n) => v.toString(2).padStart(n, '0');
const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || [[0, 4.0, 14], [0, 3.1, 0]]; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a growing column of lines: add() puts the next line under the last one
function list(x, yTop, dy = 0.5, cls = 'idx') {
  const ls = [];
  return { ls, add(t, c) { const l = tag(t, c || cls, x, yTop - ls.length * dy); ls.push(l); return l; }, push(l) { ls.push(l); return l; }, kill() { ls.forEach(remove); ls.length = 0; } };
}
// a DIMM: green board, gold contacts, 8 chips on the front (rank 0) and optionally 8 on the back (rank 1)
function dimm(x, y, o = {}) {
  const s = o.s || 1, g = new THREE.Group(); g.position.set(x, y, o.z || 0);
  const add = (m, px, py, pz) => { m.position.set(px, py, pz); g.add(m); return m; };
  add(lab.box(NC.pcb, [6 * s, 1.3 * s, 0.1]), 0, 0, 0);
  add(lab.box('#d9b45a', [5.6 * s, 0.16 * s, 0.12]), 0, -0.56 * s, 0);
  const chips = [], back = [];
  for (let i = 0; i < 8; i++) {
    chips.push(add(lab.box(NC.chip, [0.56 * s, 0.72 * s, 0.1]), (-2.45 + i * 0.7) * s, 0.12 * s, 0.1));
    if (o.back) back.push(add(lab.box('#4a3f6b', [0.56 * s, 0.72 * s, 0.1]), (-2.45 + i * 0.7) * s, 0.12 * s, -0.1));
  }
  lab.world.add(g);
  return { g, chips, back, cx: (i) => x + (-2.45 + i * 0.7) * s };
}
// a bar on a timeline: from x0 to x1 at height y
const tbar = (x0, x1, y, color, text = '', h = 0.34) => { const w = Math.max(0.05, x1 - x0); return cube(text, color, [w, h, 0.45], x0 + w / 2, y, 0); };
// a DRAM bank seen from the front: an 8 × 8 array (7 more arrays behind it), sense amplifiers, output buffer
function bankView(S) {
  const cs = 0.36, st = 0.42, x0 = -3.1, yTop = 4.85;
  S.gx = (c) => x0 + c * st; S.gy = (r) => yTop - r * st;
  S.grid = { cells: [], lbls: [] };
  for (let r = 0; r < 8; r++) { const row = []; for (let c = 0; c < 8; c++) row.push(bx('', NC.off, S.gx(c), S.gy(r), 0, cs, cs, 0.3)); S.grid.cells.push(row); }
  S.behind = [];
  for (let k = 1; k < 8; k++) { const m = bx('', NC.sand, S.gx(3.5) + k * 0.07, S.gy(3.5) + k * 0.07, -k * 0.32, 8 * st, 8 * st, 0.06); S.behind.push(m); }
  S.grid.lbls.push(sm('row 0…7', S.gx(0) - 0.95, S.gy(0)), sm('column 0…7', S.gx(3.5), yTop + 0.5));
  S.sa = []; for (let c = 0; c < 8; c++) S.sa.push(bx('', NC.mint, S.gx(c), 1.15, 0, cs, cs, 0.3));
  S.saL = sm('sense amplifiers（row buffer）', S.gx(3.5), 0.6);
  S.ob = []; for (let i = 0; i < 8; i++) S.ob.push(bx('', NC.off, 1.7 + i * 0.5, 4.3, 0, 0.42, 0.42, 0.3));
  S.obL = sm('output buffer（8 個 array 各 1 bit）', 3.45, 4.95);
}
const BW = 2133e6 * 8;   // 2,133 MT/s × 8 bytes per transfer

// ════════ 9BjVUmaXaCQ（DRAM Part 6：DIMM 階層、memory channel、DDR、RAS/CAS、burst、bank interleaving） ════════
scene('dram-hier', 'DIMM 的階層：rank → chip → bank → array → row／column', [
  async (tok, S) => { // @4 ~organisation of a DRAM dual inline memory module
    S.d = dimm(0, 5.0, { back: true });
    S.h = hd('DIMM（dual inline memory module）', 0, 6.3);
    cap('DRAM 記憶體模組：DIMM', '一條插在主機板上的記憶體條');
  },
  async (tok, S) => { // @12 ~four DIM slots
    S.slots = [0, 1, 2, 3].map((i) => bx('', NC.dark, 0.4, 3.5 - i * 0.42, 0, 5.6, 0.14, 0.3));
    S.sl = [0, 1, 2, 3].map((i) => sm('slot ' + i, -3.1, 3.5 - i * 0.42));
    S.t1 = note('主機板通常 4 個 DIMM 插槽 → 最多裝 4 條', 0, 1.35);
    cap('主機板通常有 4 個 DIMM 插槽', '最多同時裝 4 條');
  },
  async (tok, S) => { // @18 ~one rank of eight chips on one face
    S.d.chips.forEach((c) => glow(c, HL));
    S.r0 = hot('rank 0：正面 8 顆 DRAM 晶片', 0, 4.05);
    cap('一個 rank = 一起工作的一組晶片', '典型 DIMM：正面 8 顆 = 1 個 rank');
  },
  async (tok, S) => { // @24 ~Some DIMs have more than one rank
    txt(S.t1, '有些 DIMM 不只 1 個 rank');
    cap('有些 DIMM 不只一個 rank');
  },
  async (tok, S) => { // @27 ~second rank ... opposite face
    S.d.chips.forEach((c) => glow(c, null)); S.d.back.forEach((c) => glow(c, HL));
    txt(S.r0, 'rank 1：背面另外 8 顆');
    await anim(tok, 1400, (u) => { S.d.g.rotation.y = u * Math.PI; });
    cap('第二個 rank 通常在電路板背面', '翻過來看：背面又是 8 顆');
  },
  async (tok, S) => { // @31 ~Each chip contains multiple banks
    gone(S.slots, S.sl, S.t1, S.r0);
    await anim(tok, 700, (u) => { S.d.g.rotation.y = Math.PI * (1 + u); });
    S.d.back.forEach((c) => glow(c, null)); glow(S.d.chips[0], HL);
    S.banks = []; for (let i = 0; i < 8; i++) S.banks.push(bx('bank ' + i, NC.sky, -3.5 + i * 1.0, 3.0, 0, 0.9, 0.55, 0.5));
    S.a1 = lk(S.d.cx(0), 4.3, -3.5, 3.35);
    S.t2 = sm('chip 0 裡面：8 個 bank', 3.6, 3.75);
    cap('每顆晶片裡有好幾個 bank');
  },
  async (tok, S) => { // @34 ~each bank contains multiple arrays
    glow(S.banks[0], HL);
    S.arr = []; for (let i = 0; i < 8; i++) S.arr.push(bx('', NC.sand, -5.3 + i * 0.22, 1.5 + i * 0.06, -i * 0.25, 1.1, 0.9, 0.05));
    S.a2 = lk(-3.5, 2.7, -4.4, 2.15);
    S.t3 = sm('bank 0 裡面：8 個 array', -4.3, 0.75);
    cap('每個 bank 又由好幾個 array 組成');
  },
  async (tok, S) => { // @38 ~multiple rows and columns
    S.grid = { cells: [], lbls: [] };
    for (let r = 0; r < 8; r++) { const row = []; for (let c = 0; c < 8; c++) row.push(bx('', NC.off, 1.6 + c * 0.24, 2.15 - r * 0.24, 0, 0.2, 0.2, 0.15)); S.grid.cells.push(row); }
    S.a3 = lk(-3.6, 1.6, 1.3, 1.4);
    S.grid.lbls.push(sm('row（列）', 0.9, 2.15), sm('column（行）', 2.45, 2.55), sm('一個 cell = 1 bit', 4.6, 1.3));
    S.grid.cells[2].forEach((m) => glow(m, HL));
    cap('每個 array 排成很多 row 和 column', '交叉點就是一個 cell（1 bit）');
  },
  async (tok, S) => { // @48 ~capacity, speed, energy efficiency and cost
    txt(S.h, '設計取捨：容量 · 速度 · 耗電 · 成本');
    cap('記憶體設計要在四件事之間取捨', '容量、速度、能源效率、成本');
  },
]);

scene('dram-channel', 'Memory channel：address／command／data 三組線', [
  async (tok, S) => { // @59 ~how a DIM interacts with the processor
    S.cpu = prop('cpu', -5.0, 3.9, 0, 1.2, 'CPU');
    S.d = dimm(3.6, 6.1, { s: 0.45 });
    cap('先看 DIMM 怎麼和處理器溝通');
  },
  async (tok, S) => { // @64 ~plugged into a slot ... memory controller via a memory channel
    S.slot = bx('slot', NC.dark, 3.6, 5.55, 0, 2.9, 0.22, 0.3);
    S.mc = bx('memory controller', NC.sky, -1.8, 4.6, 0, 2.3, 0.5, 0.5);
    S.ch = bx('memory channel', NC.tan, 1.6, 4.6, 0, 3.6, 0.3, 0.3);
    S.up = lk(3.4, 4.8, 3.4, 5.4);
    cap('DIMM 插在主機板插槽上', '透過 memory channel 接到 memory controller');
  },
  async (tok, S) => { // @74 ~integrated into the same chip as the CPU
    relabel(S.mc, 'MC');
    await slide(tok, S.mc, -5.0, 4.75, 0, 800);
    S.mc.scale.set(0.45, 1, 1);
    gone(S.ch); S.ch = bx('memory channel', NC.tan, -0.3, 4.6, 0, 7.4, 0.3, 0.3);
    S.t0 = sm('現代 PC：memory controller 就在 CPU 晶片裡', -3.0, 5.6);
    cap('現代 PC 的 memory controller', '和 CPU 做在同一顆晶片上');
  },
  async (tok, S) => { // @80 ~address bus, a command and control bus, and a data bus
    gone(S.ch, S.t0);
    S.ab = bx('address bus', NC.blue, -0.3, 4.6, 0, 7.4, 0.3, 0.3);
    S.cb = bx('command / control bus', NC.orange, -0.3, 4.15, 0, 7.4, 0.3, 0.3);
    S.db = bx('data bus', NC.green, -0.3, 3.7, 0, 7.4, 0.3, 0.3);
    cap('memory channel 有三組線：', 'address bus、command/control bus、data bus');
  },
  async (tok, S) => { // @90 ~17 lines carry the memory address
    relabel(S.ab, 'address bus：17 條');
    cap('通常 17 條線送記憶體位址');
  },
  async (tok, S) => { // @93 ~row address and a column address separately
    S.pk = hot('row', -3.8, 5.05);
    await slide(tok, S.pk, 3.2, 5.05, 0, 900); txt(S.pk, 'column');
    await slide(tok, S.pk, -3.8, 5.05, 0, 10); await slide(tok, S.pk, 3.2, 5.05, 0, 900);
    S.L = list(0, 2.9, 0.5);
    const rowB = 17, colB = 10;
    S.L.push(ok(rowB + colB > 17, '同一組 17 條線分兩次送：row 17 + column 10（示意）= 27 bits > 17 ✓', 0, 2.9));
    cap('位址分兩次送：先 row 再 column', '所以位址可以比 17 bits 更長');
  },
  async (tok, S) => { // @103 ~Six lines ... command and control
    gone(S.pk); relabel(S.cb, 'command / control：6 條');
    cap('6 條線送命令和控制訊號');
  },
  async (tok, S) => { // @107 ~64 lines carry the data
    relabel(S.db, 'data bus：64 條');
    S.L.push(ok(17 + 6 + 64 === 87, '17 + 6 + 64 = 87 條線 ✓', 0, 2.4));
    cap('64 條線送資料本身');
  },
  async (tok, S) => { // @111 ~error correction ... 72 bits
    S.L.push(ok(64 + 8 === 72, '有 ECC（錯誤更正）：64 data + 8 檢查 = 72 bits ✓', 0, 1.9));
    cap('支援錯誤更正（ECC）時', 'data bus 是 72 bits，不是 64');
  },
  async (tok, S) => { // @118 ~early PC had only 32 lines
    S.L.kill(); relabel(S.db, 'data bus：32 條（早期 PC）'); S.db.scale.y = 0.55;
    S.L = list(0, 2.9, 0.5); S.L.push(note('早期 PC：data bus 只有 32 條 → 模組只有 32-bit 連接', 0, 2.9));
    cap('早期 PC 的 data bus 只有 32 條線', '記憶體模組也只有 32-bit 連接');
  },
  async (tok, S) => { // @129 ~single inline memory modules, or SIMs
    S.L.push(sm('這種模組叫 SIMM（single inline memory module）', 0, 2.4));
    cap('這種模組叫 SIMM', 'single inline memory module');
  },
  async (tok, S) => { // @134 ~32 bits at a time ... known as a word
    S.L.push(ok(32 / 8 === 4, '一次搬 32 bits = 4 bytes = 1 word（早期）✓', 0, 1.9));
    cap('早期資料一次搬 32 bits', '32 bits = 4 bytes，叫一個 word');
  },
  async (tok, S) => { // @144 ~modern PC has a 64-bit data bus
    relabel(S.db, 'data bus：64 條（現代）'); S.db.scale.y = 1;
    S.L.push(ok(64 / 32 === 2, '現代：64-bit 資料連接 = SIMM 的 2 倍 ✓', 0, 1.4));
    cap('現代 PC 的 data bus 是 64 bits', '是 SIMM 的兩倍');
  },
  async (tok, S) => { // @155 ~referred to as a dual inline memory module
    glow(S.d.g.children[0], HL);
    S.L.push(note('影片說法：2 倍寬 → dual；課本／業界：dual 指兩面金手指是各自獨立的訊號', 0, 0.9));
    cap('所以現代模組叫 DIMM', '（dual 的真正意思見下方提醒）');
  },
  async (tok, S) => { // @163 ~word size of a modern PC is 64 bits
    S.L.kill(); S.L = list(0, 2.9, 0.5);
    S.L.push(ok(64 / 8 === 8, '現代 PC：1 word = 64 bits = 8 bytes ✓', 0, 2.9));
    cap('現代 PC 的 word 是 64 bits');
  },
]);

scene('dram-rate', '2,133 MT/s：每個 word 不到半奈秒', [
  async (tok, S) => { // @168 ~effective frequency ... 2,133 MHz
    S.cpu = prop('cpu', -5.0, 3.9, 0, 1.2, 'CPU + MC');
    S.d = dimm(3.6, 5.6, { s: 0.45 });
    S.db = bx('data bus（64 bits）', NC.green, -0.3, 4.2, 0, 7.4, 0.3, 0.3);
    S.db.userData.lbl.position.y = -0.42; // the bus's name under it: the words run along the top
    S.h = hot('有效頻率 2,133 MHz（每秒 2,133 百萬次傳輸，MT/s）', 0, 6.6);
    cap('memory channel 的有效頻率', '通常是 2,133 MHz');
  },
  async (tok, S) => { // @174 ~2,132,000,000 new 64-bit words ... every second
    const words = 2133e6;
    S.L = list(0, 2.9, 0.5);
    S.L.push(ok(words === 2133 * 1e6, '每次傳 1 個 64-bit word → 每秒 ' + grp(words) + ' 個 word ✓', 0, 2.9));
    S.L.push(ok(fx(BW / 1e9) === '17.064', '× 8 bytes = ' + fx(BW / 1e9) + ' GB/s（我們算的頻寬）✓', 0, 2.4));
    cap('每秒可以傳約 21 億個 64-bit word');
  },
  async (tok, S) => { // @183 ~less than half a nanosecond per word
    const ns = 1e9 / 2133e6;
    S.L.push(ok(ns < 0.5, '1 ÷ 2,133,000,000 秒 ≈ ' + fx(ns) + ' ns < 0.5 ns ✓', 0, 1.9));
    S.w = [0, 1, 2, 3].map((i) => bx('w' + i, NC.gold, -3.6 - i * 0.8, 4.2, 0.35, 0.6, 0.36, 0.2));
    await anim(tok, 1600, (u) => S.w.forEach((m, i) => { m.position.x = -3.6 - i * 0.8 + u * 6.2; }));
    cap('每個 word 只花不到半奈秒');
  },
  async (tok, S) => { // @185 ~how the DIM can keep up with this
    S.L.push(note('單一 cell 很慢，DIMM 怎麼跟上？→ DDR、burst、bank interleaving', 0, 1.4));
    cap('DIMM 怎麼跟得上這麼快的 bus？', '等一下揭曉');
  },
]);

scene('dram-chmode', 'Single／dual／quad channel 與 rank', [
  async (tok, S) => { // @190 ~two DIMMs ... share the same memory channel
    S.mc = bx('memory controller', NC.sky, -4.6, 4.3, 0, 2.4, 0.6, 0.5);
    S.D = [0, 1].map((i) => bx('DIMM ' + i, NC.pcb, 3.8, 5.8 - i * 1.0, 0, 2.2, 0.5, 0.2));
    S.ar = [lk(-3.4, 4.4, 2.6, 5.8, 0x4b9ee2), lk(-3.4, 4.3, 2.6, 4.8, 0x4b9ee2)];
    S.ct = sm('channel A（兩條共用）', -0.4, 5.6);
    cap('兩條 DIMM 共用同一個 memory channel');
  },
  async (tok, S) => { // @196 ~single-channel mode
    S.h = hot('single-channel mode', 0, 6.7);
    S.L = list(0, 2.6, 0.5);
    S.L.push(ok(fx(BW / 1e9) === '17.064', '一次只走 1 條通道：' + fx(BW / 1e9) + ' GB/s（2,133 MT/s × 8 B）✓', 0, 2.6));
    cap('這叫 single-channel mode');
  },
  async (tok, S) => { // @200 ~each of two DIMMs has its own memory channel
    gone(S.ar, S.ct);
    S.ar = [lk(-3.4, 4.4, 2.6, 5.8, 0x4b9ee2), lk(-3.4, 4.2, 2.6, 4.8, 0xdd8238)];
    S.ct = [sm('channel A', -0.6, 5.6), sm('channel B', 0.2, 4.0)];
    glow(S.D[0], OKG); glow(S.D[1], OKG);
    cap('如果每條 DIMM 有自己的通道', 'memory controller 可以同時存取兩條');
  },
  async (tok, S) => { // @208 ~dual-channel mode
    txt(S.h, 'dual-channel mode');
    cap('這叫 dual-channel mode');
  },
  async (tok, S) => { // @210 ~twice as fast
    S.L.push(ok(fx(2 * BW / 1e9) === '34.128', '理論頻寬 × 2 = ' + fx(2 * BW / 1e9) + ' GB/s ✓', 0, 2.1));
    cap('理論上存取速度變兩倍');
  },
  async (tok, S) => { // @217 ~four DIMMs ... quad-channel mode
    S.D.push(...[2, 3].map((i) => bx('DIMM ' + i, NC.pcb, 3.8, 5.8 - i * 1.0, 0, 2.2, 0.5, 0.2)));
    S.ar.push(lk(-3.4, 4.0, 2.6, 3.8, 0x2fc092), lk(-3.4, 3.9, 2.6, 2.8, 0x9b7ef4));
    S.ct.push(sm('channel C', 0.2, 3.25), sm('channel D', -0.6, 2.95));
    txt(S.h, 'quad-channel mode（高階電競 PC）');
    S.L.push(ok(fx(4 * BW / 1e9) === '68.256', '4 條通道：理論頻寬 × 4 = ' + fx(4 * BW / 1e9) + ' GB/s ✓', 0, 1.6));
    cap('4 條 DIMM 各有通道：quad-channel', '有些高階電競 PC 才有');
  },
  async (tok, S) => { // @228 ~depends on the design of the motherboard and ... CPU
    S.L.push(note('能不能多通道：看主機板設計 + CPU 能力；多數 PC 有 dual', 0, 1.1));
    cap('能不能用多通道', '要看主機板設計和 CPU；多數 PC 有 dual');
  },
  async (tok, S) => { // @241 ~power constraints on how many DIMMs can share one memory channel
    S.L.kill(); S.L = list(0, 2.1, 0.5);
    gone(S.ar.slice(1), S.ct, S.D.slice(2)); S.D.length = 2; S.ar.length = 1;
    S.ar.push(lk(-3.4, 4.3, 2.6, 4.8, 0x4b9ee2)); S.ct = sm('channel A', -0.4, 5.6);
    glow(S.D[0], null); glow(S.D[1], null);
    S.L.push(note('一條通道能掛幾條 DIMM，有電氣（power）限制', 0, 2.1));
    cap('一條通道能掛幾條 DIMM', '受到電氣限制');
  },
  async (tok, S) => { // @247 ~signals are weakened when split
    S.L.push(bad('訊號分給好幾條 DIMM → 變弱', 0, 1.6));
    cap('訊號分岔給好幾條 DIMM 會變弱');
  },
  async (tok, S) => { // @251 ~maximum of two DIMMs can share one channel
    S.L.push(good('通常一條通道最多 2 條 DIMM', 0, 1.1));
    cap('通常一條通道最多掛 2 條 DIMM');
  },
  async (tok, S) => { // @254 ~two ranks ... share the same memory channel ... same slot
    gone(S.D[1], S.ar[1]); txt(S.h, 'DIMM 0：rank 0（正面）+ rank 1（背面）');
    S.rk = [sm('rank 0', 5.4, 6.0), sm('rank 1', 5.4, 5.6)];
    S.L.push(note('同一條 DIMM 的 2 個 rank 在同一個插槽 → 一定共用同一條通道', 0, 0.6));
    cap('一條 DIMM 的兩個 rank', '插在同一插槽，必定共用通道');
  },
  async (tok, S) => { // @263 ~Dual and quad-rank ... higher capacity ... more power ... little extra speed
    S.L.kill(); S.L = list(0, 2.1, 0.5);
    S.L.push(good('dual／quad-rank：容量 ↑', 0, 2.1)); S.L.push(bad('耗電 ↑', 0, 1.6)); S.L.push(sm('速度：幾乎沒變（還是同一條通道）', 0, 1.1));
    cap('多 rank：容量大、比較耗電', '速度卻幾乎沒變');
  },
]);

scene('dram-ddr', 'DDR：一個 clock 傳兩次；8 顆晶片各管 8 條線', [
  async (tok, S) => { // @274 ~Accessing an individual memory cell is ... slow
    S.cell = bx('cell', NC.off, -4.8, 3.6, 0, 0.8, 0.8, 0.5);
    S.t1 = bad('存取一個 cell：相對很慢', -4.8, 2.8);
    cap('存取單一個 cell 很慢');
  },
  async (tok, S) => { // @278 ~several clock cycles
    S.t2 = sm('讀寫 1 bit 就要好幾個 clock cycle', -4.8, 2.3);
    cap('讀寫 1 bit 要好幾個 clock cycle');
  },
  async (tok, S) => { // @284 ~two new 64-bit words in every clock cycle ... rising ... falling
    const x0 = -2.0, per = 2.0, lo = 5.4, hi = 6.0;
    S.wave = [];
    for (let k = 0; k < 4; k++) {
      const a = x0 + k * per;
      S.wave.push(line(a, lo, a, hi), line(a, hi, a + per / 2, hi), line(a + per / 2, hi, a + per / 2, lo), line(a + per / 2, lo, a + per, lo));
    }
    S.wl = sm('clock', x0 - 0.6, 5.7);
    S.tx = [];
    for (let k = 0; k < 8; k++) { S.tx.push(bx('w' + k, k % 2 ? NC.orange : NC.blue, x0 + k * per / 2, 4.8, 0, 0.5, 0.34, 0.2)); await wt(tok, 120); }
    S.t3 = sm('上升緣（藍）+ 下降緣（橘）：每個 clock 傳 2 個 64-bit word', 2.0, 4.25);
    cap('data bus 每個 clock 傳兩個 word', '上升緣一次、下降緣一次');
  },
  async (tok, S) => { // @294 ~double data rate DDR
    S.h = hot('DDR = Double Data Rate', 2.0, 6.6);
    S.k = ok(2133 / 2 === 1066.5, '2,133 MT/s ÷ 2 = 1,066.5 MHz 實際 clock ✓', 2.0, 3.75);
    cap('這就是 DDR（Double Data Rate）', '的名字由來');
  },
  async (tok, S) => { // @300 ~keep the data bus fully occupied
    S.t4 = note('目標：讓 data bus 一直有資料在跑', -4.6, 1.8);
    cap('記憶體模組的設計目標：', '讓 data bus 盡量一直忙');
  },
  async (tok, S) => { // @308 ~Each chip ... wired to eight lines of the data bus
    gone(S.cell, S.t1, S.t2, S.t4, S.t3, S.k);
    S.chips = []; S.cl = [];
    for (let i = 0; i < 8; i++) { S.chips.push(bx('chip ' + i, NC.chip, -4.9 + i * 1.4, 3.2, 0, 1.15, 0.8, 0.4)); S.cl.push(sm('8 條', -4.9 + i * 1.4, 2.6)); }
    cap('DIMM 上每顆晶片接 data bus 的 8 條線');
  },
  async (tok, S) => { // @314 ~eight bits of a 64-bit word ... each of eight chips simultaneously
    S.word = []; for (let i = 0; i < 8; i++) S.word.push(bx('bit ' + (i * 8) + '–' + (i * 8 + 7), [NC.blue, NC.orange, NC.green, NC.purple, NC.pink, NC.teal, NC.gold, NC.red][i], -4.9 + i * 1.4, 1.85, 0, 1.3, 0.4, 0.3));
    S.k = ok(8 * 8 === 64, '8 顆 × 8 bits = 64 bits，同時讀寫 ✓', 0, 1.2);
    cap('一個 64-bit word 拆成 8 份', '8 顆晶片同時各讀寫 8 bits');
  },
  async (tok, S) => { // @323 ~Eight chips is typical
    S.L = list(0, 0.65, 0.5); S.L.push(sm('8 顆最常見，也有更多或更少的 DIMM', 0, 0.65));
    cap('8 顆最常見', '有的 DIMM 多一些、有的少一些');
  },
  async (tok, S) => { // @328 ~fixed capacity, then more chips means more storage
    S.L.kill(); const gb = 8 * 8 / 8;
    S.L.push(ok(gb === 8, '示意：每顆 8 Gbit × 8 顆 = 64 Gbit = 8 GB ✓（晶片越多，容量越大）', 0, 0.65));
    cap('如果每顆容量固定', '晶片越多 → 容量越大');
  },
  async (tok, S) => { // @334 ~more chips would use more power
    S.chips.forEach((m) => glow(m, NG));
    S.L.push(bad('但每次讀寫 8 顆一起動 → 晶片越多越耗電', 0, 0.15));
    cap('但晶片要一起處理每個請求', '晶片越多越耗電');
  },
  async (tok, S) => { // @342 ~Fewer chips ... bigger share of 64 data lines
    S.chips.forEach((m, i) => { glow(m, null); if (i >= 4) tint(m, NC.gray); });
    S.cl.forEach((l, i) => txt(l, i < 4 ? '16 條' : ''));
    S.L.kill(); S.L.push(ok(64 / 16 === 4, '示意：用 x16 晶片 → 64 ÷ 16 = 4 顆，每顆管 16 條線 ✓', 0, 0.65));
    cap('晶片少比較省電', '但每顆要負責更多條資料線');
  },
  async (tok, S) => { // @349 ~more data pins per chip, and pins are expensive
    S.L.push(bad('每顆晶片接腳變多 → 接腳很貴', 0, 0.15));
    cap('每顆晶片的資料接腳變多', '而接腳很貴');
  },
  async (tok, S) => { // @356 ~8 banks, each of which can store 8 bits
    S.chips.forEach((m) => tint(m, NC.chip)); S.cl.forEach((l) => txt(l, '8 條'));
    S.L.kill(); gone(S.k);
    S.bk = []; for (let i = 0; i < 8; i++) { const col = []; for (let b = 0; b < 8; b++) col.push(bx('', NC.sky, -4.9 + i * 1.4, 2.88 + b * 0.09, 0.32, 1.0, 0.06, 0.05)); S.bk.push(col); }
    S.L.push(sm('每顆晶片 8 個 bank；x8 晶片每次存取進出 8 bits', 0, 0.65));
    cap('每顆晶片裡通常有 8 個 bank', '每次進出 8 bits');
  },
  async (tok, S) => { // @362 ~Banks at equivalent positions ... share the same address lines
    S.bk.forEach((col) => glow(col[0], HL));
    S.bl = line(-5.6, 2.88, 5.6, 2.88, 0.4, '#6a4a00');
    S.L.push(hot('各晶片的 bank 0 共用同一組位址線、控制訊號', 0, 0.15));
    cap('各晶片中位置相同的 bank', '共用位址線和控制訊號');
  },
  async (tok, S) => { // @369 ~8 bits are written to each chip ... banks in equivalent positions
    S.L.kill();
    await anim(tok, 900, (u) => S.word.forEach((m) => { m.position.y = 1.85 + u * 1.0; }));
    S.L.push(ok(8 * 8 === 64, '64 bits 拆 8 份 → 同時寫進 8 顆晶片的 bank 0 ✓', 0, 0.65));
    cap('8 bits 同時寫進每顆晶片', '寫進的都是位置相同的 bank');
  },
  async (tok, S) => { // @377 ~isn't any faster than reading or writing just one bit
    S.L.push(bad('一次 64 bits 很寬，但每次存取的等待時間和 1 bit 一樣，沒有比較快', 0, 0.15));
    cap('一次存 64 bits 並沒有更快', '每次存取一樣要等那麼久');
  },
]);

scene('dram-rascas', 'Bank 內部：RAS 開 row → CAS 選 column → output buffer', [
  async (tok, S) => { // @385 ~look inside a single bank
    bankView(S);
    S.h = hd('一個 bank（示意模型：8 個 8 × 8 array）', -1.4, 6.3);
    cap('要加速，先看一個 bank 的內部');
  },
  async (tok, S) => { // @395 ~eight arrays, each with 64 memory cells ... eight rows and eight columns
    S.R = list(3.4, 3.4, 0.5);
    S.R.push(ok(8 * 8 === 64 && 8 * 64 === 512, '每個 array 8 × 8 = 64 cells；8 個 array 共 512 ✓', 3.4, 3.4));
    cap('這個 bank 有 8 個 array', '每個 array 8 row × 8 column = 64 cells');
  },
  async (tok, S) => { // @402 ~typical array ... 1024 columns and 16384 rows
    const cells = 1024 * 16384;
    S.R.push(ok(cells === 16777216, '真實：1024 × 16384 = ' + grp(cells) + ' cells ✓', 3.4, 2.9));
    S.R.push(ok(lg2(16384) === 14 && lg2(1024) === 10, 'row 位址 14 bits、column 位址 10 bits ✓', 3.4, 2.4));
    cap('這只是模型；真實 array 是長方形', '1024 columns × 16384 rows');
  },
  async (tok, S) => { // @410 ~first the row address is strobed
    S.ras = hot('RAS：row 5（示意）', -6.0, S.gy(5));
    await slide(tok, S.ras, -4.6, S.gy(5), 0, 700);
    S.grid.cells[5].forEach((m) => tint(m, NC.sky));
    cap('讀資料：先送 row address（RAS）', '這會啟動讀取週期');
  },
  async (tok, S) => { // @418 ~followed by the column address
    S.cas = hot('CAS：column 3', S.gx(3), 6.05);
    S.cp = lk(S.gx(3), 5.75, S.gx(3), 5.1);
    cap('接著送 column address（CAS）');
  },
  async (tok, S) => { // @420 ~identify a particular cell in each array ... same position
    glow(S.grid.cells[5][3], HL); S.behind.forEach((m) => glow(m, '#3a2a00'));
    S.R.push(sm('row 5 + column 3 → 8 個 array 同一位置各 1 個 cell', 3.4, 1.9));
    cap('row + column 指定每個 array 的一個 cell', '8 個 array 位置都一樣');
  },
  async (tok, S) => { // @431 ~row is activated and latched into the sense amplifiers
    S.behind.forEach((m) => glow(m, null));
    S.mv = S.grid.cells[5].map((m, c) => bx('', NC.sky, S.gx(c), S.gy(5), 0.25, 0.32, 0.32, 0.2));
    await anim(tok, 1000, (u) => S.mv.forEach((m) => { m.position.y = S.gy(5) + (1.15 - S.gy(5)) * u; }));
    gone(S.mv); S.sa.forEach((m) => tint(m, NC.sky));
    cap('整個 row 被啟動', '存進 sense amplifiers（row buffer）');
  },
  async (tok, S) => { // @436 ~relatively slow part of the read cycle
    S.slow = bad('開 row（activate）：讀取週期裡較慢的一段', S.gx(3.5), 0.1);
    cap('開 row 是讀取週期中比較慢的部分');
  },
  async (tok, S) => { // @439 ~the row is said to be open
    S.open = good('row 5 is open', -4.9, S.gy(5) - 0.45);
    cap('這時候 row 5 是「open」狀態');
  },
  async (tok, S) => { // @443 ~one bit from each array ... output buffer
    glow(S.sa[3], HL);
    const p = bx('', NC.gold, S.gx(3), 1.15, 0.3, 0.3, 0.3, 0.2);
    await slide(tok, p, 1.7, 4.3, 0.3, 700); gone(p);
    S.ob.forEach((m, i) => { tint(m, NC.gold); relabel(m, 'a' + i); });
    cap('每個 array 各送 1 bit', '同時進 output buffer');
  },
  async (tok, S) => { // @449 ~bank in each chip doing exactly the same thing
    S.R.push(sm('8 顆晶片裡同位置的 bank 同時做一樣的事', 3.4, 1.4));
    cap('記住這只是模型：8 顆晶片的 bank', '同時做完全一樣的事');
  },
  async (tok, S) => { // @459 ~deliver a 64-bit word
    S.R.push(ok(8 * 8 === 64, '每顆 8 bits × 8 顆 = 1 個 64-bit word ✓', 3.4, 0.9));
    cap('合起來送出一個 64-bit word');
  },
  async (tok, S) => { // @464 ~early types of DRAM would now close the row
    S.sa.forEach((m) => { tint(m, NC.mint); glow(m, null); }); S.grid.cells[5].forEach((m) => { tint(m, NC.off); glow(m, null); });
    txt(S.open, 'close row（早期 DRAM：讀完就關）'); S.open.element.className = 'lab-label bad';
    cap('一次只能開一個 row', '早期 DRAM 讀完就關掉，要用再開');
  },
  async (tok, S) => { // @476 ~opening a whole row ... just to read one bit, is a waste
    S.R.kill(); S.R = list(3.4, 3.4, 0.5);
    S.R.push(ok(fx(100 / 1024) === '0.098', '開 1024 columns 只用 1 個：1/1024 ≈ 0.098% ✓', 3.4, 3.4));
    S.R.push(bad('→ 浪費時間', 3.4, 2.9));
    cap('開了一整個 row 只讀 1 bit', '很浪費時間');
  },
]);

scene('dram-burst', 'Burst mode：row 開著就連讀好幾個 column', [
  async (tok, S) => { // @487 ~while the row is already open, another byte
    bankView(S); S.h = hd('row 5 還開著（示意）', -1.4, 6.3);
    S.grid.cells[5].forEach((m) => tint(m, NC.sky)); S.sa.forEach((m) => tint(m, NC.sky));
    S.cols = [3, 4]; S.cp = lk(S.gx(3), 5.75, S.gx(3), 5.1);
    S.R = list(3.4, 3.4, 0.5); S.R.push(sm('第 1 次：column 3 → output buffer', 3.4, 3.4));
    gone(S.cp); S.cp = lk(S.gx(4), 5.75, S.gx(4), 5.1); glow(S.sa[4], HL);
    S.R.push(good('row 不關，直接再讀 column 4', 3.4, 2.9));
    cap('row 還開著，就直接再讀下一個 column');
  },
  async (tok, S) => { // @493 ~another, and another
    for (const c of [5, 6]) { gone(S.cp); S.cp = lk(S.gx(c), 5.75, S.gx(c), 5.1); glow(S.sa[c], HL); S.cols.push(c); await wt(tok, 500); }
    S.R.push(good('再 column 5、column 6……', 3.4, 2.4));
    cap('再一個、再一個');
  },
  async (tok, S) => { // @496 ~burst ... just one row address and one column address
    S.R.push(hot('只給 1 個 row + 1 個起始 column → 一串（burst）資料', 3.4, 1.9));
    cap('只給一個 row、一個 column address', '就能很快讀出一串資料：burst');
  },
  async (tok, S) => { // @504 ~number of columns read ... burst length
    S.R.push(ok(S.cols.length === 4, '讀了 column ' + S.cols.join('、') + ' → burst length = ' + S.cols.length + '（示意）✓', 3.4, 1.4));
    cap('row 開著時讀幾個 column', '叫做 burst length');
  },
  async (tok, S) => { // @511 ~Different generations ... different burst lengths
    S.R.kill(); S.R = list(3.4, 3.4, 0.5);
    S.R.push(sm('不同世代 DRAM 的 burst length 不同', 3.4, 3.4));
    cap('不同世代的 DRAM', 'burst length 不一樣');
  },
  async (tok, S) => { // @515 ~DDR2 4, DDR3 8, DDR4 16
    S.R.push(sm('影片：DDR2 = 4、DDR3 = 8、DDR4 = 16', 3.4, 2.9));
    S.R.push(bad('更正：DDR4 標準仍是 BL8，BL16 是 DDR5', 3.4, 2.4));
    cap('影片說 DDR2 4、DDR3 8、DDR4 16', '（DDR4 其實是 8，DDR5 才是 16）');
  },
  async (tok, S) => { // @525 ~what you can see here is just one bank
    S.R.push(note('畫面只是 1 個 bank', 3.4, 1.9));
    cap('別忘了：畫面上只是一個 bank');
  },
  async (tok, S) => { // @528 ~DDR3 ... eight 64-bit words in very close succession
    const bytes = 8 * 8;
    S.R.push(ok(bytes === 64, 'DDR3：8 顆晶片 × BL8 → 8 個 64-bit word = ' + bytes + ' bytes ✓', 3.4, 1.4));
    cap('DDR3：8 顆晶片的 bank 一起動', '連續送出 8 個 64-bit word');
  },
  async (tok, S) => { // @541 ~This technique is called pre-fetching
    S.R.push(hot('prefetch：一次從 array 抓 8 份，再一份份快速送出', 3.4, 0.9));
    cap('這叫 prefetching（預取）');
  },
]);

// bank-interleaving timeline (示意)：開 row + CAS 10 clocks、burst 4 clocks（BL8 ÷ 2）、關 row 18 clocks；8 個 bank 錯開 4 clocks
const OPEN = 10, BURST = 8 / 2, CLOSE = 18, NB = 8;
const cx = (c) => -5.4 + c * 0.2;
const by = (b) => 6.1 - b * 0.48;
scene('dram-bankint', '關 row 要 18 cycles；bank interleaving 讓 bus 不停', [
  async (tok, S) => { // @545 ~there's still a problem
    S.ax = [line(cx(0), 1.75, cx(56), 1.75), sm('clock →', cx(56) + 0.5, 1.75)];
    S.bl = [sm('bank 0', cx(0) - 0.6, by(0))];
    S.o0 = tbar(cx(0), cx(OPEN), by(0), NC.sky, 'open');
    S.u0 = tbar(cx(OPEN), cx(OPEN + BURST), by(0), NC.green);
    S.bus = sm('data bus', cx(0) - 0.6, 2.2); S.bb = [tbar(cx(OPEN), cx(OPEN + BURST), 2.2, NC.green)];
    S.k = sm('示意時間軸：開 row + CAS 10 clocks、burst 4 clocks', 0, 6.8);
    cap('但還有一個問題');
  },
  async (tok, S) => { // @547 ~Only one row per bank can be open
    S.L = list(0, 1.15, 0.45); S.L.push(bad('每個 bank 同時只能開 1 個 row', 0, 1.15));
    cap('每個 bank 同一時間只能開一個 row');
  },
  async (tok, S) => { // @552 ~the row has to be closed before another can be opened
    S.c0 = tbar(cx(OPEN + BURST), cx(OPEN + BURST + CLOSE), by(0), NC.gray, 'close');
    cap('burst 結束後，要先關這個 row', '才能開別的 row');
  },
  async (tok, S) => { // @556 ~refreshing the cells ... pre-charging the bitlines
    S.L.push(sm('關 row = 把剛讀的 cell 寫回刷新 + bit line 重新 precharge', 0, 0.7));
    cap('關 row：把讀過的 cell 寫回刷新', '再把 bit line 重新 precharge');
  },
  async (tok, S) => { // @562 ~as many as 18 clock cycles
    relabel(S.c0, 'close 18');
    S.L.push(ok(CLOSE === 18, '關 row 最多要 18 clocks ✓', 0, 0.25));
    cap('這可能要多達 18 個 clock cycle');
  },
  async (tok, S) => { // @566 ~blocks known as cache lines
    S.L.kill(); S.L = list(0, 1.15, 0.45);
    S.L.push(sm('CPU ↔ DRAM 以 cache line 為單位搬資料', 0, 1.15));
    cap('CPU 和 DRAM 之間', '以 cache line 為單位搬資料');
  },
  async (tok, S) => { // @573 ~64 bytes ... eight 64-bit words
    S.L.push(ok(64 / 8 === 8, 'cache line 64 bytes = 8 個 64-bit word ✓', 0, 0.7));
    cap('一條 cache line 通常 64 bytes', '= 8 個 64-bit word');
  },
  async (tok, S) => { // @580 ~One burst ... fill a single cache line
    relabel(S.u0, 'BL8');
    S.L.push(ok(8 * 8 === 64 && BURST === 4, '1 次 burst：8 次傳輸 × 8 B = 64 B；DDR 每 clock 2 次 → 4 clocks ✓', 0, 0.25));
    cap('一次 burst 剛好填滿一條 cache line', '以 bus 最快的速度');
  },
  async (tok, S) => { // @586 ~multiple cache lines ... in close succession
    S.L.kill(); S.L = list(0, 1.15, 0.45);
    const gap = OPEN + BURST + CLOSE, util = BURST / gap;
    S.w0 = tbar(cx(OPEN + BURST + CLOSE), cx(gap + OPEN), by(0), NC.sky, 'open');
    S.L.push(ok(gap === 32 && util === 0.125, '只有 bank 0：下一次 burst 要等 4 + 18 + 10 = 32 clocks，bus 只忙 4/32 = 12.5% ✓', 0, 1.15));
    cap('如果要接連讀好幾條 cache line 呢？');
  },
  async (tok, S) => { // @591 ~each bank ... operate independently
    gone(S.w0);
    for (let b = 1; b < NB; b++) S.bl.push(sm('bank ' + b, cx(0) - 0.6, by(b)));
    S.L.push(sm('同一顆晶片裡每個 bank 都能各自獨立運作', 0, 0.7));
    cap('每個 bank 設計成可以獨立運作');
  },
  async (tok, S) => { // @601 ~different stages of their read or write cycles
    S.L.push(sm('→ 不同 bank 可以在讀寫週期的不同階段', 0, 0.25));
    cap('不同 bank 可以在不同階段');
  },
  async (tok, S) => { // @606 ~bank interleaving
    S.h = hot('bank interleaving', 3.5, 6.8); gone(S.k);
    cap('這叫 bank interleaving（bank 交錯）');
  },
  async (tok, S) => { // @614 ~another burst can begin immediately from the next bank
    S.rows = [];
    const b = 1, t = b * BURST;
    S.rows.push(tbar(cx(t), cx(t + OPEN), by(b), NC.sky), tbar(cx(t + OPEN), cx(t + OPEN + BURST), by(b), NC.green), tbar(cx(t + OPEN + BURST), cx(t + OPEN + BURST + CLOSE), by(b), NC.gray));
    S.bb.push(tbar(cx(t + OPEN), cx(t + OPEN + BURST), 2.2, NC.teal));
    cap('bank 0 一送完', 'bank 1 的 burst 立刻接上');
  },
  async (tok, S) => { // @621 ~and then the next, and then the next
    for (let b = 2; b < NB; b++) {
      const t = b * BURST;
      S.rows.push(tbar(cx(t), cx(t + OPEN), by(b), NC.sky), tbar(cx(t + OPEN), cx(t + OPEN + BURST), by(b), NC.green), tbar(cx(t + OPEN + BURST), cx(Math.min(56, t + OPEN + BURST + CLOSE)), by(b), NC.gray));
      S.bb.push(tbar(cx(t + OPEN), cx(t + OPEN + BURST), 2.2, b % 2 ? NC.teal : NC.green));
      await wt(tok, 250);
    }
    cap('接著 bank 2、bank 3……輪流接力');
  },
  async (tok, S) => { // @623 ~While one bank is pumping out data, the others ... getting ready
    S.L.kill(); S.L = list(0, 1.15, 0.45);
    S.vl = line(cx(OPEN + 3 * BURST + 2), 1.9, cx(OPEN + 3 * BURST + 2), 6.3, 0.3, '#6a4a00');
    S.L.push(sm('這一刻：bank 3 在送資料，其他 bank 在開 row 或關 row', 0, 1.15));
    cap('一個 bank 在送資料時', '其他 bank 在準備下一次');
  },
  async (tok, S) => { // @629 ~By the time the last bank ... the first bank has had plenty of time to recover
    const lastEnd = (NB - 1) * BURST + OPEN + BURST, t = NB * BURST;
    S.again = [tbar(cx(t), cx(t + OPEN), by(0) + 0.0, NC.sky, 'open'), tbar(cx(t + OPEN), cx(t + OPEN + BURST), by(0), NC.green)];
    S.bb.push(tbar(cx(t + OPEN), cx(t + OPEN + BURST), 2.2, NC.green));
    glow(S.again[1], HL);
    S.L.push(ok(BURST + CLOSE + OPEN === NB * BURST && t + OPEN === lastEnd, 'bank 0 需要 4 + 18 + 10 = 32 clocks 才能再送；8 bank × 4 = 32 → 剛好接在 bank 7 後面 ✓', 0, 0.7));
    cap('最後一個 bank 送完時', 'bank 0 早就恢復好了');
  },
  async (tok, S) => { // @638 ~data bus ... remain saturated
    const busy = S.bb.length * BURST, span = (NB + 1) * BURST;
    S.L.push(ok(busy === span, 'data bus 從 clock ' + OPEN + ' 到 ' + (OPEN + span) + ' 一直有資料：忙碌率 100% ✓', 0, 0.25));
    cap('bank interleaving 讓 data bus', '長時間讀寫時一直保持滿載');
  },
]);

scene('dram-banks', '要放幾個 bank：速度 vs 容量', [
  async (tok, S) => { // @652 ~This chip has 8 banks
    S.chip = zone('chip（8 banks）', -3.2, 2.0, 0, 5.0, 3.6, '#e2d6c0');
    S.chip.userData.name.position.set(-5.6, 6.15, 0); // chip name above the banks, clear of the long notes on the right
    S.b8 = []; for (let i = 0; i < 8; i++) S.b8.push(bx('bank ' + i, NC.sky, -4.95 + (i % 4) * 1.17, 4.7 - Math.floor(i / 4) * 1.4, 0, 1.05, 1.2, 0.3));
    S.L = list(3.4, 5.6, 0.5); S.L.push(sm('這顆晶片 8 個 bank（也有更多或更少）', 3.4, 5.6));
    cap('這顆晶片有 8 個 bank', '也有的多、有的少');
  },
  async (tok, S) => { // @656 ~important decision that DRAM designers have to make
    S.L.push(hot('放幾個 bank：DRAM 設計者的重要決定', 3.4, 5.1));
    cap('放幾個 bank', '是 DRAM 設計者的重要決定');
  },
  async (tok, S) => { // @664 ~More banks offer more parallelism and lower latency
    S.L.push(good('bank 多 → 平行度高、延遲低', 3.4, 4.6));
    cap('bank 越多，平行度越高', '延遲越低');
  },
  async (tok, S) => { // @669 ~keeping the data bus busy ... faster memory
    S.L.push(good('→ data bus 更常保持忙碌 → 記憶體更快', 3.4, 4.1));
    cap('越能讓 data bus 保持忙碌', 'bank 越多，記憶體越快');
  },
  async (tok, S) => { // @676 ~for a given area of silicon more banks means smaller banks
    gone(S.b8);
    S.b16 = []; for (let i = 0; i < 16; i++) S.b16.push(bx('', NC.sky, -5.05 + (i % 4) * 1.17, 5.05 - Math.floor(i / 4) * 0.7, 0, 1.05, 0.58, 0.3));
    S.chip.userData.name.element.textContent = 'chip（同樣面積，16 banks，示意）';
    S.L.push(note('但面積固定：bank 越多，每個 bank 越小', 3.4, 3.6));
    cap('但矽晶片面積固定', 'bank 越多，每個 bank 就越小');
  },
  async (tok, S) => { // @684 ~smaller arrays and more of them
    S.b16.forEach((m) => tint(m, NC.mint));
    S.L.push(sm('→ array 更小、數量更多', 3.4, 3.1));
    cap('array 變小、數量變多');
  },
  async (tok, S) => { // @687 ~each array has its own peripheral components ... decoders sense amplifiers and multiplexers
    S.per = S.b16.map((m) => bx('', NC.orange, m.position.x, m.position.y - 0.33, 0.1, 1.05, 0.1, 0.32));
    S.L.push(bad('每個 array 都有自己的周邊電路：decoder、sense amp、mux（橘色）', 3.4, 2.6));
    cap('每個 array 都要自己的周邊元件', 'decoder、sense amplifier、multiplexer');
  },
  async (tok, S) => { // @693 ~highest possible storage capacity ... minimize the number of supporting components
    S.L.push(sm('要容量最大 → 周邊元件越少越好，空間留給 cell', 3.4, 2.1));
    cap('想要容量最大', '就要減少周邊元件、空間留給 cell');
  },
  async (tok, S) => { // @705 ~more banks means lower capacity
    const area = 100, per = 1.5, cap8 = area - 8 * per, cap16 = area - 16 * per;
    S.L.push(ok(cap8 === 88 && cap16 === 76, '示意：面積 100、每個 bank 周邊 1.5 → 8 banks 剩 88、16 banks 剩 76 ✓', 3.4, 1.6));
    cap('所以 bank 越多，容量越低');
  },
  async (tok, S) => { // @711 ~fewer banks ... larger arrays ... higher capacity
    gone(S.b16, S.per);
    S.b4 = []; for (let i = 0; i < 4; i++) S.b4.push(bx('bank ' + i, NC.sky, -4.4 + (i % 2) * 2.4, 4.4 - Math.floor(i / 2) * 1.8, 0, 2.2, 1.6, 0.3));
    S.chip.userData.name.element.textContent = 'chip（同樣面積，4 banks，示意）';
    S.L.push(good('bank 少 → bank、array 都大 → 容量可能更高', 3.4, 1.1));
    cap('bank 少：bank 大、array 大', '容量可能更高');
  },
  async (tok, S) => { // @718 ~larger arrays have longer bit lines ... slower ... more power
    S.bitl = S.b4.map((m) => line(m.position.x, m.position.y - 0.75, m.position.x, m.position.y + 0.75, 0.2, '#7a1010'));
    S.L.push(bad('但大 array 的 bit line 長 → 較慢、較耗電（紅線）', 3.4, 0.6));
    cap('但大 array 的 bit line 比較長', '比較慢，也比較耗電');
  },
]);

// ════════ 0dTWcYk1rts（Memory Interleaving concept：定義、層級、7 / 28 / 10 cycles、n-way、low/high-order、優缺點） ════════
scene('dram-ilv-gap', '為什麼要 interleaving：CPU 太快、記憶體跟不上', [
  async (tok, S) => { // @10 ~smarter architecture, higher clock frequencies and deeper pipelining
    S.cpu = prop('cpu', -4.0, 3.2, 0, 1.3, 'CPU');
    S.cb = bx('', NC.green, 0.5, 5.2, 0, 0.1, 0.5, 0.4);
    await anim(tok, 1200, (u) => { S.cb.scale.x = 1 + u * 50; S.cb.position.x = -1.5 + u * 2.5; });
    S.ct = sm('處理速度：越來越快（時脈、管線）', 1.0, 5.8);
    cap('架構更聰明、時脈更高、管線更深', 'CPU 越來越快');
  },
  async (tok, S) => { // @16 ~challenge to match the speed of the memory
    S.mem = bx('Main memory', NC.tan, -4.0, 1.4, 0, 2.2, 0.7, 0.6);
    S.mb = bx('', NC.metal, -0.5, 3.6, 0, 1.6, 0.5, 0.4);
    S.mt = sm('記憶體供應資料的速度：跟不上', 1.0, 3.0);
    cap('記憶體很難及時把資料', '餵給這麼快的 CPU');
  },
  async (tok, S) => { // @24 ~mismatch ... (von Neumann) bottleneck
    S.gap = bad('速度落差 = von Neumann bottleneck（瓶頸）', 1.0, 2.2);
    S.a = lk(-4.0, 2.0, -4.0, 2.9, 0xd64545);
    cap('這個速度落差叫 von Neumann 瓶頸', '高階處理器的效能被拖住');
  },
  async (tok, S) => { // @36 ~memory has undergone several transitions ... memory interleaving
    S.h = hot('早期的解法之一：memory interleaving（記憶體交錯）', 0, 6.6);
    cap('記憶體有好幾次演進', '早期的一種就是 memory interleaving');
  },
  async (tok, S) => { // @45 ~how memory interleaving works, types, advantages and disadvantages
    S.L = list(3.0, 1.5, 0.45); ['① 怎麼運作', '② 有哪些類型', '③ 優點與缺點'].forEach((t) => S.L.add(t, 'note'));
    cap('這支影片：怎麼運作、有哪些類型', '以及優缺點');
  },
]);

scene('dram-ilv-what', 'Interleaving：連續位址輪流放到不同 bank', [
  async (tok, S) => { // @56 ~what memory interleaving means
    S.cpu = prop('cpu', 0, 5.2, 0, 1.0, 'CPU');
    S.B = [0, 1, 2, 3].map((b) => bx('bank ' + b, NC.sky, -4.5 + b * 3, 1.0, 0, 2.2, 0.5, 0.6));
    cap('Memory interleaving 是什麼？');
  },
  async (tok, S) => { // @58 ~assign successive memory addresses across multiple memory units
    S.a = [];
    for (let a = 0; a < 8; a++) { S.a.push(cube('位址 ' + a, [NC.blue, NC.orange, NC.green, NC.purple][a % 4], [1.6, 0.42, 0.5], -4.5 + (a % 4) * 3, 1.6 + Math.floor(a / 4) * 0.5, 0, 2.5)); await wt(tok, 180); }
    S.k = ok([0, 1, 2, 3, 4, 5, 6, 7].every((a) => a % 4 === (a & 3)), '連續位址 0,1,2,3,… 輪流放：bank = 位址 mod 4 ✓（示意 4 banks）', 0, 3.3);
    cap('把連續的位址輪流分到不同 bank', '位址 0、1、2、3 各在不同 bank');
  },
  async (tok, S) => { // @72 ~After a memory chip is accessed ... a delay before ... accessed again
    gone(S.k); glow(S.B[0], NG); S.rec = bad('bank 0 剛被存取 → 要恢復一段時間', -4.5, 0.35);
    cap('一個記憶體晶片存取完', '要等一段時間才能再存取');
  },
  async (tok, S) => { // @78 ~long enough to put a wait state in a fast CPU
    S.w = bad('沒有 interleaving：CPU 只能等（wait state）', 0, 6.6);
    cap('長到快速的 CPU 只能停下來等', '（wait state）');
  },
  async (tok, S) => { // @82 ~each unit takes turns ... while the other is recovering
    gone(S.w); glow(S.B[1], OKG);
    S.t = good('interleaving：bank 0 恢復時，bank 1 接手', 0, 6.6);
    cap('有了 interleaving，各 bank 輪流服務', '一個在恢復，另一個接手');
  },
  async (tok, S) => { // @96 ~first memory unit is sending data ... second unit will receive the address
    glow(S.B[0], OKG); glow(S.B[1], HL);
    const d = hot('data（bank 0）', -4.5, 1.9), ad = hot('address → bank 1', 0, 4.4);
    await anim(tok, 1000, (u) => { d.position.set(-4.5 + 3.9 * u, 1.9 + 2.5 * u, 0); ad.position.set(-1.5 * u, 4.4 - 2.5 * u, 0); });
    S.p = [d, ad];
    cap('bank 0 把資料送給 CPU 的同時', 'bank 1 接收 CPU 送來的位址');
  },
  async (tok, S) => { // @103 ~when the second unit will send data, the first unit can be accessed again
    gone(S.p, S.rec); glow(S.B[1], OKG); glow(S.B[0], HL);
    const d = hot('data（bank 1）', -1.5, 1.9), ad = hot('address → bank 0', 0, 4.4);
    await anim(tok, 1000, (u) => { d.position.set(-1.5 + 2.1 * u, 1.9 + 2.5 * u, 0); ad.position.set(-4.5 * u, 4.4 - 2.5 * u, 0); });
    S.p = [d, ad];
    cap('bank 1 送資料時', 'bank 0 又可以被存取了');
  },
  async (tok, S) => { // @108 ~delay between accessing subsequent word is reduced
    gone(S.p); S.B.forEach((m) => glow(m, null));
    S.k = good('連續 word 之間的等待大幅縮短', 0, 3.3);
    cap('連續 word 之間的延遲', '大幅縮短');
  },
]);

scene('dram-ilv-hier', '記憶體的層級：DIMM → rank → chip → bank → cell', [
  async (tok, S) => { // @113 ~quick look at the memory units
    S.h = hd('先看記憶體的組成', 0, 6.6);
    cap('深入之前，先看記憶體的組成');
  },
  async (tok, S) => { // @119 ~main memory comprises of these kind of sticks
    S.d = dimm(0, 5.2, { back: true });
    cap('主記憶體就是一條條記憶體條');
  },
  async (tok, S) => { // @122 ~DIMM-based SDRAM, the front view and back view forms the DIMM
    S.t1 = sm('正面 + 背面 = 一條 DIMM（dual inline memory module）', 0, 4.2);
    await anim(tok, 1800, (u) => { S.d.g.rotation.y = u * 2 * Math.PI; });
    cap('DIMM 型 SDRAM：正面和背面', '合起來就是一條 DIMM');
  },
  async (tok, S) => { // @130 ~Collection of chips on each side ... RANK ... DRAM chips
    S.d.chips.forEach((c) => glow(c, HL));
    txt(S.t1, '每一面的一組晶片 = 1 個 rank；rank 由 DRAM chip 組成');
    cap('每一面的一組晶片叫 rank', 'rank 由 DRAM 晶片組成');
  },
  async (tok, S) => { // @137 ~each DRAM chip ... memory banks ... two dimensional array ... rows and column
    S.d.chips.forEach((c, i) => glow(c, i ? null : HL));
    S.banks = []; for (let i = 0; i < 4; i++) S.banks.push(bx('bank ' + i, NC.sky, -4.8 + i * 1.3, 2.8, 0, 1.15, 0.55, 0.4));
    S.a1 = lk(S.d.cx(0), 4.5, -4.8, 3.15);
    S.grid = { cells: [], lbls: [] };
    for (let r = 0; r < 6; r++) { const row = []; for (let c = 0; c < 6; c++) row.push(bx('', NC.off, 1.6 + c * 0.32, 3.3 - r * 0.32, 0, 0.27, 0.27, 0.2)); S.grid.cells.push(row); }
    S.grid.lbls.push(sm('bank = 二維陣列（rows × columns，示意 6 × 6）', 2.4, 3.75));
    S.a2 = lk(-4.8, 2.5, 1.4, 2.6);
    cap('每顆晶片分成好幾個 bank', 'bank 是由 row、column 組成的二維陣列');
  },
  async (tok, S) => { // @147 ~intersection of row and column is called cell
    glow(S.grid.cells[2][3], HL); S.c = good('row 2 × column 3 交叉 = 一個 cell', 2.4, 1.2);
    cap('row 和 column 的交叉點叫 cell', '資料就存在這裡');
  },
  async (tok, S) => { // @153 ~implemented at various levels ... rank based, chip based ... channel based
    S.L = list(-3.6, 1.6, 0.45);
    S.L.add('interleaving 可以做在：channel、rank、chip、bank', 'note');
    cap('interleaving 可以做在不同層級', 'channel、rank、chip……');
  },
  async (tok, S) => { // @170 ~most basic unit ... were banks
    S.banks.forEach((m) => glow(m, HL));
    S.L.add('最基本的單位：bank → 這支影片講 bank interleaving', 'ptr alt');
    cap('最基本的是 bank', '接下來都講以 bank 為單位的 interleaving');
  },
  async (tok, S) => { // @177 ~main memory is divided into memory banks ... addresses are interleaved across these banks
    gone(S.d, S.t1, S.a1, S.a2, S.grid, S.c, S.L, S.banks);
    S.cpu = prop('cpu', 0, 5.0, 0, 1.0, 'CPU');
    S.B = [0, 1, 2, 3].map((b) => bx('bank ' + b + '：' + [b, b + 4, b + 8].join(', ') + ' …', NC.sky, -4.5 + b * 3, 2.0, 0, 2.6, 0.6, 0.5));
    S.ar = S.B.map((m) => lk(0, 4.8, m.position.x, 2.4));
    S.k = ok([0, 1, 2, 3].every((b) => (b + 4) % 4 === b && (b + 8) % 4 === b), '抽象架構：主記憶體分成 bank，位址輪流交錯放（示意 4 banks）✓', 0, 0.9);
    cap('主記憶體分成好幾個 bank', '位址交錯分配到這些 bank');
  },
]);

// 講者的數字：送位址 1、存取 5、回傳 1 cycle；4 個 word
const T_A = 1, T_M = 5, T_D = 1, NW = 4;
const ilvTimes = () => [0, 1, 2, 3].map((k) => ({ a: k, m: k + T_A, d: k + T_A + T_M, end: k + T_A + T_M + T_D }));
const qx = (c) => -5.6 + c * 0.4;
scene('dram-ilv-cycles', '非交錯 vs 交錯：7 cycles、28 vs 10', [
  async (tok, S) => { // @191 ~example ... non-interleaved ... interleaved memory access
    S.ax = [line(qx(0), 0.55, qx(28), 0.55), sm('cycle →', qx(28) + 0.3, 0.2)];
    S.tk = [0, 7, 10, 14, 21, 28].map((c) => sm(String(c), qx(c), 0.2));
    S.l1 = sm('非交錯', qx(0) - 0.15, 5.9); S.l1.center && S.l1.center.set(1, 0.5);
    S.l2 = sm('交錯', qx(0) - 0.15, 3.5); S.l2.center && S.l2.center.set(1, 0.5);
    cap('用例子比較：非交錯 vs 交錯存取');
  },
  async (tok, S) => { // @201 ~non-interleaved ... only when the previous memory access is completed
    S.n = [];
    for (let w = 0; w < NW; w++) { const t = w * 7; S.n.push(tbar(qx(t), qx(t + 7), 5.4, [NC.blue, NC.orange, NC.green, NC.purple][w], 'w' + w)); await wt(tok, 200); }
    cap('非交錯：前一次存取完成', '才能存取下一個位址');
  },
  async (tok, S) => { // @209 ~interleaved ... can be overlapped
    S.iv = ilvTimes().map((r, k) => tbar(qx(r.a), qx(r.end), 3.4 - k * 0.5, [NC.blue, NC.orange, NC.green, NC.purple][k], 'bank ' + k));
    cap('交錯：位址分散在各 bank', '存取可以重疊，總時間大幅減少');
  },
  async (tok, S) => { // @224 ~considering cycle times
    gone(S.n, S.iv); S.n = []; S.iv = [];
    S.L = list(3.2, 6.6, 0.45);
    cap('用 cycle 數來算算看');
  },
  async (tok, S) => { // @232 ~one cycle to send the address ... five cycles to access ... one cycle to return
    S.one = [tbar(qx(0), qx(T_A), 5.4, NC.sky, 'A'), tbar(qx(T_A), qx(T_A + T_M), 5.4, NC.tan, '存取 5'), tbar(qx(T_A + T_M), qx(T_A + T_M + T_D), 5.4, NC.green, 'D')];
    S.L.add('送位址 1 + 存取 5 + 回傳 1（cycles）');
    cap('送位址 1 cycle、存取一個 word 5 cycles', '回傳資料 1 cycle');
  },
  async (tok, S) => { // @244 ~seven clock cycles
    S.L.push(ok(T_A + T_M + T_D === 7, '取 1 個 word：1 + 5 + 1 = 7 cycles ✓', 3.2, 6.15));
    cap('取一個 word 要 7 個 cycle');
  },
  async (tok, S) => { // @252 ~non-interleaved ... four words ... 28 clock cycles
    gone(S.one);
    for (let w = 0; w < NW; w++) { const t = w * 7; S.n.push(tbar(qx(t), qx(t + T_A), 5.4, NC.sky), tbar(qx(t + T_A), qx(t + T_A + T_M), 5.4, NC.tan, 'w' + w), tbar(qx(t + T_A + T_M), qx(t + 7), 5.4, NC.green)); await wt(tok, 150); }
    S.L.push(ok(NW * (T_A + T_M + T_D) === 28, '非交錯 4 個 word：4 × 7 = 28 cycles ✓', 3.2, 5.7));
    cap('非交錯取 4 個 word：28 cycles');
  },
  async (tok, S) => { // @262 ~interleaved ... only 10 clock cycles
    const R = ilvTimes();
    R.forEach((r, k) => { const y = 3.4 - k * 0.5; S.iv.push(tbar(qx(r.a), qx(r.m), y, NC.sky), tbar(qx(r.m), qx(r.d), y, NC.tan, 'bank ' + k), tbar(qx(r.d), qx(r.end), y, NC.green)); });
    const end = Math.max(...R.map((r) => r.end));
    S.L.push(ok(end === 10 && end === T_A + T_M + NW * T_D, '交錯 4 個 bank：位址每 cycle 送一個 → 最後在 cycle ' + end + ' 結束 = 1 + 5 + 4 × 1 ✓', 3.2, 5.25));
    cap('交錯：同樣 4 個 word', '只要 10 cycles');
  },
  async (tok, S) => { // @270 ~access time is reduced considerably
    S.L.push(ok(fx(28 / 10, 1) === '2.8', '28 ÷ 10 = 快 2.8 倍 ✓', 3.2, 4.8));
    cap('交錯存取大幅縮短存取時間');
  },
]);

scene('dram-ilv-nway', 'n-way interleaving：分成幾個 bank', [
  async (tok, S) => { // @276 ~n-way interleaving
    S.h = hot('n-way interleaving', 0, 6.6);
    cap('接下來：n-way interleaving');
  },
  async (tok, S) => { // @280 ~determined by the number of memory units or banks
    S.t = sm('幾 way = 主記憶體分成幾個 bank', 0, 6.0);
    cap('「幾 way」由主記憶體', '分成幾個 bank 決定');
  },
  async (tok, S) => { // @288 ~two-way ... two banks
    S.w2 = [0, 1].map((b) => bx('bank ' + b, NC.sky, -4.4 + b * 2.0, 4.4, 0, 1.8, 0.6, 0.5));
    S.k2 = ok(lg2(2) === 1, '2-way：2 個 bank → 選 bank 要 1 bit ✓', -3.4, 3.6);
    cap('2-way：記憶體分成 2 個 bank');
  },
  async (tok, S) => { // @296 ~four-way ... four banks
    S.w4 = [0, 1, 2, 3].map((b) => bx('bank ' + b, NC.mint, 0.6 + b * 1.6, 4.4, 0, 1.45, 0.6, 0.5));
    S.k4 = ok(lg2(4) === 2, '4-way：4 個 bank → 2 bits ✓', 3.0, 3.6);
    cap('4-way：記憶體分成 4 個 bank');
  },
  async (tok, S) => { // @302 ~n-way ... divided into n banks
    S.kn = ok([2, 4, 8, 16].every((n) => 2 ** lg2(n) === n), 'n-way：n 個 bank → 選 bank 要 log₂ n bits（8-way 3 bits、16-way 4 bits）✓', 0, 2.2);
    cap('n-way：分成 n 個 bank');
  },
]);

// 4-bit 位址（示意）：low-order → bank = 低 2 bits；high-order → bank = 高 2 bits
const lowMap = (a) => ({ bank: a & 3, word: a >> 2 });
const highMap = (a) => ({ bank: a >> 2, word: a & 3 });
function addrField(S, x, y, hiC, loC, hiN, loN) {
  S.f = [bx(hiN, hiC, x - 0.95, y, 0, 1.8, 0.55, 0.5), bx(loN, loC, x + 0.95, y, 0, 1.8, 0.55, 0.5)];
  S.fl = [sm('高位 bits（MSB）', x - 0.95, y + 0.5), sm('低位 bits（LSB）', x + 0.95, y + 0.5)];
}
scene('dram-ilv-types', 'Low-order vs high-order：哪幾個 bit 選 bank', [
  async (tok, S) => { // @307 ~two types ... low-order ... high-order
    S.h = hot('兩種：low-order interleaving、high-order interleaving', 0, 6.6);
    cap('interleaving 有兩種', 'low-order 和 high-order');
  },
  async (tok, S) => { // @315 ~least significant bits ... select the bank ... high-order bits ... word
    S.t1 = hd('low-order', -3.2, 5.8);
    addrField(S, -3.2, 4.9, NC.lilac, NC.orange, 'word', 'bank');
    S.lo = { f: S.f, fl: S.fl };
    cap('low-order：位址最低幾個 bit 選 bank', '高位 bits 選 bank 裡的 word');
  },
  async (tok, S) => { // @326 ~subsequent memory addresses are spread across the banks
    S.lb = [0, 1, 2, 3].map((b) => bx('bank ' + b + '：' + [0, 1, 2, 3].map((w) => b + 4 * w).join(','), NC.sky, -3.2, 3.6 - b * 0.55, 0, 3.4, 0.45, 0.4));
    S.k1 = ok([...Array(16).keys()].every((a) => lowMap(a).bank === a % 4), '連續位址輪流分散到各 bank ✓', -3.2, 1.0);
    cap('連續位址會分散到各個 bank');
  },
  async (tok, S) => { // @333 ~most significant bits ... select the bank
    S.t2 = hd('high-order', 3.2, 5.8);
    addrField(S, 3.2, 4.9, NC.orange, NC.lilac, 'bank', 'word');
    cap('high-order：位址最高幾個 bit 選 bank', '低位 bits 選 bank 裡的 word');
  },
  async (tok, S) => { // @343 ~block of successive memory addresses
    S.hb = [0, 1, 2, 3].map((b) => bx('bank ' + b + '：' + [0, 1, 2, 3].map((w) => 4 * b + w).join(','), NC.mint, 3.2, 3.6 - b * 0.55, 0, 3.4, 0.45, 0.4));
    S.k2 = ok([...Array(16).keys()].every((a) => highMap(a).bank === Math.floor(a / 4)), '一整塊連續位址放在同一個 bank ✓', 3.2, 1.0);
    cap('一整塊連續位址', '放在同一個 bank');
  },
]);

scene('dram-ilv-low', '例子：4 個 bank 的 low-order interleaving', [
  async (tok, S) => { // @353 ~memory is divided into four banks
    S.B = [0, 1, 2, 3].map((b) => bx('bank ' + b, NC.sky, -4.5 + b * 3, 3.4, 0, 2.4, 0.5, 0.5));
    S.h = hd('4 個 bank；4-bit 位址（示意 16 個 word）', 0, 6.6);
    cap('假設記憶體分成 4 個 bank');
  },
  async (tok, S) => { // @356 ~lower order interleaved, subsequent memory addresses ... across the banks
    S.cells = [];
    for (let a = 0; a < 16; a++) { const m = lowMap(a); S.cells.push(bx(b2(a, 4), NC.off, -4.5 + m.bank * 3, 2.75 - m.word * 0.48, 0, 1.4, 0.4, 0.3)); }
    cap('low-order：連續位址輪流放在各 bank');
  },
  async (tok, S) => { // @365 ~lower bits ... select the bank and the remaining higher bits ... word
    S.cpu = prop('cpu', -5.2, 5.1, 0, 0.8, 'CPU');
    // wide fields: they later read 'word（2 bits）' / 'bank（2 bits）'
    S.F = [bx('word', NC.lilac, -0.75, 5.4, 0, 2.5, 0.5, 0.4), bx('bank', NC.orange, 1.8, 5.4, 0, 2.5, 0.5, 0.4)];
    S.Fl = [sm('高位', -0.75, 5.85), sm('低位', 1.8, 5.85)];
    cap('CPU 送出位址：低位 bits 選 bank', '其餘高位 bits 選要拿的 word');
  },
  async (tok, S) => { // @374 ~four banks, so two bits will be required to select the bank
    S.k = ok(lg2(4) === 2, '4 個 bank → log₂ 4 = 2 bits 選 bank；4 − 2 = 2 bits 選 word ✓', 2.6, 4.5);
    relabel(S.F[1], 'bank（2 bits）'); relabel(S.F[0], 'word（2 bits）');
    cap('4 個 bank，所以要 2 個 bit 選 bank');
  },
  async (tok, S) => { // @381 ~lower order bits, zero, zero ... select bank zero ... word within bank zero
    const a = 0, m = lowMap(a);
    relabel(S.F[0], b2(a >> 2, 2)); relabel(S.F[1], b2(a & 3, 2));
    glow(S.B[m.bank], HL); glow(S.cells[a], HL);
    gone(S.k);
    S.k = ok(m.bank === 0 && m.word === 0, '位址 0000：低位 00 → bank 0；高位 00 → bank 0 的 word 0 ✓', 2.6, 4.5);
    const e = lowMap(6);
    S.k2 = ok(e.bank === 2 && e.word === 1, '再一例（示意）：0110 → 低位 10 = bank 2、高位 01 = word 1 ✓', 0, 0.35);
    cap('第一個例子：低位 00 → bank 0', '其餘 bits 選 bank 0 裡的 word');
  },
  async (tok, S) => { // @392 ~after the first cycle, the state of the system
    S.st = sm('第 1 個 cycle 後：bank 0 開始存取位址 0000', 0, 4.0);
    cap('第一個 cycle 之後', '系統狀態像這樣');
  },
  async (tok, S) => { // @398 ~subsequent cycles ... overlap
    gone(S.k2);
    for (let a = 1; a < 4; a++) { const m = lowMap(a); glow(S.B[m.bank], HL); glow(S.cells[a], HL); relabel(S.F[0], b2(a >> 2, 2)); relabel(S.F[1], b2(a & 3, 2)); await wt(tok, 450); }
    txt(S.st, '位址 0000、0001、0010、0011 → bank 0、1、2、3：存取彼此重疊');
    S.k2 = ok([0, 1, 2, 3].map((a) => lowMap(a).bank).join() === '0,1,2,3', '連續 4 個位址落在 4 個不同 bank → 可以重疊 ✓', 0, 0.35);
    cap('接下來的 cycle', '取資料和選 bank、word 會重疊進行');
  },
]);

scene('dram-ilv-high', '例子：4 個 bank 的 high-order interleaving', [
  async (tok, S) => { // @405 ~same four banked memory ... block of successive memory addresses
    S.B = [0, 1, 2, 3].map((b) => bx('bank ' + b, NC.mint, -4.5 + b * 3, 3.4, 0, 2.4, 0.5, 0.5));
    S.cells = [];
    for (let a = 0; a < 16; a++) { const m = highMap(a); S.cells.push(bx(b2(a, 4), NC.off, -4.5 + m.bank * 3, 2.75 - m.word * 0.48, 0, 1.4, 0.4, 0.3)); }
    S.h = hd('同樣 4 個 bank；一整塊連續位址放同一個 bank', 0, 6.6);
    cap('high-order：同樣 4 個 bank', '但一整塊連續位址放在同一個 bank');
  },
  async (tok, S) => { // @416 ~most significant two bits will select the bank
    S.cpu = prop('cpu', -5.2, 5.1, 0, 0.8, 'CPU');
    S.F = [bx('bank（2 bits）', NC.orange, 0.0, 5.4, 0, 1.4, 0.5, 0.4), bx('word（2 bits）', NC.lilac, 1.45, 5.4, 0, 1.4, 0.5, 0.4)];
    S.Fl = [sm('高位（MSB）', 0.0, 5.85), sm('低位', 1.45, 5.85)];
    cap('CPU 送出位址', '最高的 2 個 bit 選 bank');
  },
  async (tok, S) => { // @423 ~MSB ... 00 will select bank 0 ... lower order bits ... word
    const a = 0, m = highMap(a);
    relabel(S.F[0], b2(a >> 2, 2)); relabel(S.F[1], b2(a & 3, 2));
    glow(S.B[m.bank], HL); glow(S.cells[a], HL);
    S.k = ok(m.bank === 0 && m.word === 0, '位址 0000：高位 00 → bank 0；低位 00 → word 0 ✓', 2.6, 4.5);
    const e = highMap(6);
    S.k2 = ok(e.bank === 1 && e.word === 2, '再一例（示意）：0110 → 高位 01 = bank 1、低位 10 = word 2 ✓', 0, 0.35);
    cap('高位 00 選 bank 0', '其餘低位 bits 選 bank 0 裡的 word');
  },
  async (tok, S) => { // @436 ~best suited for shared memory systems when the first processor is accessing a bank
    gone(S.cpu, S.F, S.Fl, S.k);
    S.p1 = bx('CPU 1', NC.teal, -4.5, 5.4, 0, 1.4, 0.5, 0.4); S.l1 = lk(-4.5, 5.1, -4.5, 3.7, 0x31aab0);
    glow(S.B[0], HL);
    S.t = sm('shared memory：CPU 1 正在用 bank 0', 0, 6.1);
    cap('high-order 最適合共享記憶體系統', 'CPU 1 正在存取一個 bank');
  },
  async (tok, S) => { // @448 ~another processor can access another bank
    S.p2 = bx('CPU 2', NC.purple, 1.5, 5.4, 0, 1.4, 0.5, 0.4); S.l2 = lk(1.5, 5.1, 1.5, 3.7, 0x9b7ef4);
    glow(S.B[2], OKG);
    txt(S.t, 'CPU 1 用 bank 0，同時 CPU 2 用 bank 2（不同 bank → 不衝突）');
    cap('同一時間，另一個處理器', '可以存取另一個 bank');
  },
]);

scene('dram-ilv-pros', '優缺點、兩種一起用、bank conflict', [
  async (tok, S) => { // @451 ~advantages and disadvantages
    S.hl = hd('low-order', -3.4, 6.6); S.hh = hd('high-order', 3.4, 6.6);
    S.L = list(-3.4, 6.0, 0.48); S.H = list(3.4, 6.0, 0.48);
    cap('來看兩種方式的優缺點');
  },
  async (tok, S) => { // @455 ~burst mode, reads from sequential location can overlap latencies
    S.L.add('＋ burst：連續位址的延遲可以重疊（剛剛 28 → 10）', 'good');
    cap('low-order：burst 模式讀連續位址', '各 word 的延遲可以重疊');
  },
  async (tok, S) => { // @467 ~better load sharing between banks
    S.L.add('＋ 連續位址分散 → 各 bank 負載平均', 'good');
    cap('連續位址分散開來', 'bank 之間負載比較平均');
  },
  async (tok, S) => { // @475 ~non-sequential reads may lead to bank conflicts
    const hits = [0, 4, 8, 12].map((a) => lowMap(a).bank);
    S.L.push(ok(hits.every((b) => b === 0), '－ 不連續讀（示意：0, 4, 8, 12）→ 全在 bank 0 → bank conflict ✓', -3.4, 6.0 - S.L.ls.length * 0.48));
    cap('缺點：不連續的讀取', '可能撞在同一個 bank（bank conflict）');
  },
  async (tok, S) => { // @481 ~failure of single bank may lead to failure of entire DRAM
    S.L.add('－ 每塊資料都分散在所有 bank：壞 1 個 bank 就全部受影響', 'bad');
    cap('單一 bank 故障', '可能讓整個 DRAM 都不能用');
  },
  async (tok, S) => { // @487 ~high-order ... better parallelism ... CPUs in shared memory
    S.H.add('＋ 共享記憶體：多個 CPU 同時用不同 bank → 平行度好', 'good');
    cap('high-order：多個 CPU', '可以同時存取不同 bank');
  },
  async (tok, S) => { // @501 ~better resilience to entire system failure
    S.H.add('＋ 壞 1 個 bank 只影響那一塊位址 → 容錯較好', 'good');
    cap('對整個系統故障的容錯也比較好');
  },
  async (tok, S) => { // @507 ~does not support pipeline block access of contiguous memory locations
    const hits = [0, 1, 2, 3].map((a) => highMap(a).bank);
    S.H.push(ok(hits.every((b) => b === 0), '－ 連續位址 0, 1, 2, 3 全在 bank 0 → 不能管線化重疊 ✓', 3.4, 6.0 - S.H.ls.length * 0.48));
    cap('缺點：連續位址的區塊存取', '沒辦法管線化');
  },
  async (tok, S) => { // @515 ~combine both the types
    S.c = hot('兩種可以一起用嗎？可以！', 0, 3.6);
    cap('兩種可以結合起來嗎？', '答案是可以');
  },
  async (tok, S) => { // @522 ~High order ... chip level ... low order ... bank level
    S.c2 = [bx('chip（high-order 選）', NC.orange, -2.2, 2.7, 0, 3.6, 0.5, 0.4), bx('bank（low-order 選）', NC.sky, 2.2, 2.7, 0, 3.6, 0.5, 0.4)];
    S.c3 = sm('外層 chip 用 high-order（平行），內層 bank 用 low-order（重疊連續讀）', 0, 2.1);
    cap('chip 層用 high-order：平行度', 'bank 層用 low-order：重疊延遲');
  },
  async (tok, S) => { // @532 ~to conclude ... main memory ... low order ... same bank ... Bank Conflict
    gone(S.c, S.c2, S.c3);
    S.K = list(0, 3.6, 0.48); S.K.add('總結：interleaving 用在主記憶體', 'ptr alt');
    S.K.add('low-order：CPU 接連存取的位址落在同一個 bank → bank conflict', 'bad');
    cap('總結：low-order 時，接連存取', '落在同一個 bank 就是 bank conflict');
  },
  async (tok, S) => { // @549 ~shared memory with high order ... multiple processors ... same bank
    S.K.add('high-order 共享記憶體：多個 CPU 搶同一個 bank → 衝突', 'bad');
    cap('high-order 共享記憶體：', '多個處理器搶同一個 bank 也會衝突');
  },
  async (tok, S) => { // @558 ~DDR ... optional technique specially for burst mode
    S.K.add('DDR 等現代記憶體：interleaving 是可選功能，常配合 burst', 'note');
    cap('現代 DDR 裡，interleaving 是可選的', '特別是配合 burst 模式');
  },
  async (tok, S) => { // @566 ~wider memory and wider cache ... alternative
    S.K.push(ok(T_A + T_M + T_D === 7, '另一條路：更寬的記憶體（示意 4 word 寬：1 + 5 + 1 = 7 cycles 拿 4 個）✓', 0, 3.6 - S.K.ls.length * 0.48));
    cap('更寬的記憶體、更寬的 cache', '曾被當作 interleaving 的替代方案');
  },
]);
  }

  // ═══ vm.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 計算機組織 第 6 章（清大 黃婷婷 第 25A、25B、26A、26B 講 Memory：virtual memory、page table、TLB、
//     TLB + cache、virtually indexed cache、protection、memory hierarchy 共同架構、3C、cache controller FSM、coherence）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師講到那句話（notes 的 cues）才做一個短動作，不循環、不重播。
// 老師的例子照用（38 號同學坐 10 號位、page 5 → frame 3、page table 從 100 開始 → 138、4 KiB page 4 MiB table、
// 黑板 01|10 → 00|10、28-bit VA 64K vs 16K entry、16 KiB cache 18|10|4、32 B block 27 bits、4 KiB page 20 bits…），
// 每個位址切割、bit 數、table 大小、組合是否可能，都由程式算出再顯示 ✓；老師沒給數字、我們補的例子標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const ok = (b, t, x, y) => { if (!b) log('CHECK FAILED: ' + t, true); return b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y); };
const mono = (l) => { Object.assign(l.element.style, { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' }); return l; };
const mt = (t, x, y, cls = '') => mono(tag(t, cls, x, y));
const bx = (t, c, x, y, z = 0, w = 2.2, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const NC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7', rose: '#f2c4c4', metal: '#8a94a6', off: '#efe6d6' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.cubes && typeof o.kill === 'function') return o.kill(); if (o.cells) return gone(o.cells.flat(), o.lbls); if (o.g) return kill(o.g); if (o.element) remove(o); else kill(o); });
const lk = (x1, y1, x2, y2, c = 0x6e5f49, z = 0.1) => arrow(V3(x1, y1, z), V3(x2, y2, z), c);
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const fx = (v, d = 2) => String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const lg2 = (n) => Math.round(Math.log2(n));
const b2 = (v, n) => (n <= 0 ? '' : v.toString(2).padStart(n, '0'));
const KB = (n) => (n >= 2 ** 30 ? n / 2 ** 30 + ' GiB' : n >= 2 ** 20 ? n / 2 ** 20 + ' MiB' : n >= 1024 ? n / 1024 + ' KiB' : n + ' B');
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || [[0, 4.0, 14], [0, 3.1, 0]]; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a column of slots (memory, frames, a page table…): T.put(i, text, color), T.fl(i, glowColor)
function slots(n, x, yTop, o = {}) {
  const w = o.w || 1.8, h = o.h || 0.42, gap = o.gap ?? 0.08;
  const T = { cells: [], lbls: [], x, y: (i) => yTop - i * (h + gap) };
  for (let i = 0; i < n; i++) {
    T.cells.push([bx(o.fill ? o.fill(i) : '', o.color ? o.color(i) : NC.off, x, T.y(i), 0, w, h, 0.6)]);
    if (o.rl) T.lbls.push(sm(o.rl(i), x - w / 2 - (o.rlw || 0.55), T.y(i)));
  }
  if (o.title) T.lbls.push(hd(o.title, x, yTop + 0.65));
  T.m = (i) => T.cells[i][0];
  T.put = (i, t, col) => { relabel(T.m(i), t); if (col) tint(T.m(i), col); };
  T.fl = (i, g) => glow(T.m(i), g === undefined ? HL : g);
  T.calm = () => T.cells.flat().forEach((m) => glow(m, null));
  return T;
}
// an address drawn as fields: [{n:'VPN', b:20, c:color, v:'…'}]; widths ∝ bits (min width), centred at cx
function fields(fs, cx, y, o = {}) {
  const unit = o.unit || 0.2, minW = o.minW || 0.9, h = o.h || 0.62;
  const ws = fs.map((f) => Math.max(minW, f.b * unit));
  const tot = ws.reduce((s, w) => s + w, 0) + (fs.length - 1) * 0.06;
  let x = cx - tot / 2; const F = { ms: [], ls: [], xs: [] };
  fs.forEach((f, i) => {
    const xc = x + ws[i] / 2; F.xs.push(xc);
    F.ms.push(bx(f.v !== undefined ? f.v : '', f.c, xc, y, 0, ws[i], h, 0.7));
    F.ls.push(sm(f.n + (o.noBits ? '' : '（' + f.b + ' bits）'), xc, y + h / 2 + 0.3));
    x += ws[i] + 0.06;
  });
  F.kill = () => { F.ms.forEach(kill); F.ls.forEach(remove); };
  F.cubes = F.ms;
  F.set = (i, v) => relabel(F.ms[i], v);
  F.fl = (i, g) => glow(F.ms[i], g === undefined ? HL : g);
  return F;
}
// split an address into (high, low) with low = k bits
const splitA = (a, k) => ({ hi: Math.floor(a / 2 ** k), lo: a % 2 ** k });
// TLB / page table / cache: is this combination possible? (reuses the chapter's COMBO table)
const combo = (t, p, c) => COMBO[[t, p, c].join(',')][0];
// a tiny write-back, write-allocate, direct-mapped cache controller FSM (P&H 5.9): returns the state path of one request
function fsmRun(line, req) {
  // line = {valid, dirty, tag}; req = {write, tag}
  const path = ['Idle', 'Compare Tag'];
  let hit = line.valid && line.tag === req.tag;
  if (!hit) {
    if (line.valid && line.dirty) { path.push('Write-Back'); line.dirty = false; }
    path.push('Allocate'); Object.assign(line, { valid: true, tag: req.tag, dirty: false });
    path.push('Compare Tag'); hit = true;
  }
  if (req.write) line.dirty = true;
  path.push('Idle');
  return path;
}
// a growing column of lines: add() puts the next line under the last one
function list(x, yTop, dy = 0.55, cls = 'idx') {
  const ls = [];
  return { ls, add(t, c) { const l = tag(t, c || cls, x, yTop - ls.length * dy); ls.push(l); return l; }, kill() { ls.forEach(remove); ls.length = 0; } };
}
function vbar(c, x, h, w = 0.7, y0 = 0, d = 0.7) { const m = lab.box(c, [w, 1, d]); m.scale.y = Math.max(0.001, h); m.position.set(x, y0 + Math.max(0.001, h) / 2, 0); lab.world.add(m); return m; }
function setH(m, h, y0 = 0) { m.scale.y = Math.max(0.001, h); m.position.y = y0 + Math.max(0.001, h) / 2; }
async function growH(tok, m, h, y0 = 0, ms = 600) { const h0 = m.scale.y; await anim(tok, ms, (u) => setH(m, h0 + (h - h0) * u, y0)); }

// ════════ JqxIZlm23R8（第 25A 講：為什麼要 virtual memory、page/frame、page table、page fault、replacement、page table 太大） ════════
scene('cvm-25a-why', '為什麼需要 virtual memory：multiprogramming', [
  async (tok, S) => { // @47 ~其實我們看到的Memory
    S.cpu = bx('CPU', NC.teal, -5.4, 6.0, 0, 1.4, 0.6); S.c = bx('Cache', NC.green, -3.0, 6.0, 0, 1.6, 0.6);
    S.m = bx('Main memory', NC.tan, 0, 6.0, 0, 2.2, 0.6); S.d = bx('Disk', NC.metal, 3.6, 6.0, 0, 1.6, 0.6);
    S.vm = hot('virtual memory？', 1.8, 6.75); glow(S.d, HL);
    cap('cache 放常用的；那 memory 和 disk 之間', '為什麼又多一個 virtual memory？');
  },
  async (tok, S) => { // @70 ~User寫的Program它不是有Address嗎
    glow(S.d, null);
    S.sp = slots(4, -4.6, 4.6, { w: 2.2, h: 0.48, fill: (i) => ['stack ↓', '（空）', 'static data', 'program'][i], color: (i) => [NC.pink, NC.off, NC.orange, NC.blue][i], title: 'User memory space' });
    cap('每個 program 有自己的 address：', 'program、static data、stack 都放在某個位址');
  },
  async (tok, S) => { // @138 ~你說第100個memory address
    S.mm = slots(4, 0.6, 4.6, { w: 2.2, h: 0.48, fill: (i) => ['stack', '', 'static data', 'program'][i], color: (i) => [NC.pink, NC.off, NC.orange, NC.blue][i], title: 'Physical memory' });
    S.a1 = lk(-3.3, 3.2, -0.6, 3.2); S.t1 = sm('address 100 → memory 第 100 個（不用 translation）', -1.5, 1.9);
    cap('一個 program 獨佔 CPU 和 memory', '第 100 個 address 就是 memory 第 100 個');
  },
  async (tok, S) => { // @181 ~常常在做什麼東西做IO
    glow(S.cpu, NG); S.t2 = bad('CPU 在等 IO（million cycles）→ idle', -4.4, 6.75);
    cap('可是 program 常常在做 IO', 'IO 要上百萬個 cycle，CPU 就閒在那裡');
  },
  async (tok, S) => { // @218 ~所以在OS面有什麼job scheduling
    gone(S.t2, S.vm); glow(S.cpu, OKG);
    S.jobs = ['P1', 'P2', 'P3', 'P4', 'P5'].map((p, i) => bx(p, [NC.blue, NC.purple, NC.pink, NC.orange, NC.green][i], 3.6 + (i % 3) * 1.0, 4.4 - Math.floor(i / 3) * 0.75, 0, 0.85, 0.5));
    S.t3 = sm('multiprogramming：P1 做 IO 時，ready 的人來用 CPU', 3.9, 2.8);
    cap('Multiprogramming：好幾個 program 一起 run', '有人做 IO，就讓 ready list 上的人用 CPU');
  },
  async (tok, S) => { // @266 ~所以每一個人都有自己的Address Space
    gone(S.a1, S.t1);
    S.t4 = note('你的 program 從 0 開始、我的也從 0 開始 → 到底放誰的？', 0, 1.9);
    S.t5 = hot('每個人都有自己的 address space，共用一塊 physical memory（2³² bytes）', 0, 1.2);
    cap('每個人有自己的 user address space', '大家 share 同一塊 physical memory');
  },
  async (tok, S) => { // @285 ~跟physical是一樣大其實可以不一樣大
    gone(S.t4); S.big = sm('user 的 space 可以比 physical 更大', -4.6, 1.9);
    cap('User 的 address space 可以比 physical 大', '反正不會一次全部搬進來');
  },
  async (tok, S) => { // @302 ~執行的locality
    S.mm.put(1, 'P2 的一塊', NC.purple); S.mm.fl(1);
    cap('靠 program 執行的 locality', '執行到哪一塊，就把那一塊搬到 main memory');
  },
  async (tok, S) => { // @327 ~我們有一個disk跟main memory
    S.mm.calm(); glow(S.d, HL); S.sw = hd('Disk 上的 swap space：所有 program 需要的 space 都在這', 3.4, 0.5);
    cap('Disk 有一個 swap space', '所有 program 需要的 space 通通放在這');
  },
  async (tok, S) => { // @349 ~只要搬小部分的page
    glow(S.d, null); S.pg = hot('只搬小部分：一塊叫 page（cache 那邊叫 block）', 0, 0.5); gone(S.sw);
    cap('只搬需要的一小部分', '這一塊在這裡叫 page');
  },
]);

scene('cvm-25a-level', 'Virtual memory 這一層：page 很大、由 OS 管', [
  async (tok, S) => { // @359 ~需要這邊有一個virtual memory的系統
    S.m = bx('Main memory（upper level）', NC.tan, -2.4, 5.4, 0, 3.4, 0.7); S.d = bx('Disk（lower level）', NC.metal, 2.4, 5.4, 0, 3.0, 0.7);
    lk(0.9, 5.4, -0.6, 5.4); S.l = sm('所有 program 在 disk；只有少部分放進 main memory', 0, 4.5);
    cap('Hierarchy 多一層：disk 是 lower level', 'main memory 是 upper level');
  },
  async (tok, S) => { // @375 ~這種disk又更慢了
    glow(S.d, NG); S.t1 = bad('disk 更慢：搬一次要 million cycles', 2.4, 6.3);
    cap('Disk 更慢', '東西不在 main memory，搬進來要很久很久');
  },
  async (tok, S) => { // @393 ~搬進來那個block可能比較大塊一點
    glow(S.d, null); S.pg = bx('page ≥ 1 KiB', NC.purple, 2.4, 3.4, 0, 2.6, 0.7);
    cap('所以一次搬大塊一點', 'block size 比較大，叫 page（1 KiB 以上）');
  },
  async (tok, S) => { // @400 ~當你要做這個搬的時候我就把CPU放棄了
    S.cpu = bx('CPU → 給別人用', NC.teal, -2.4, 3.4, 0, 2.6, 0.7);
    cap('要搬的時候就把 CPU 放棄', '給別的 program，讓 disk 慢慢搬');
  },
  async (tok, S) => { // @417 ~用OS
    S.os = hot('用 OS（software）管理：disk 幾百萬 cycle，OS 跑幾萬個也還好', 0, 2.2);
    cap('用 software（OS）來 management', '幾百萬 cycle 的代價，OS 多跑幾萬個還划得來');
  },
  async (tok, S) => { // @469 ~就是translation
    gone(S.os, S.l, S.t1);
    S.t = sm('搬上來要做 translation；概念和 memory ↔ cache 很像', 0, 4.5);
    cap('Memory 和 disk 之間也要 translation', '和 cache ↔ memory 的概念很像');
  },
  async (tok, S) => { // @491 ~在這個階段叫block在這邊叫做page
    relabel(S.pg, 'page'); S.fr = bx('frame', NC.lilac, -2.4, 2.2, 0, 2.0, 0.7);
    await slide(tok, S.pg, -2.4, 2.9, 0, 700);
    S.t2 = sm('固定大小搬進搬出：disk 上叫 page，放進 memory 的位置叫 frame', 0, 1.2);
    cap('以固定大小搬進搬出', '一個 page 放到 memory 的一個 frame');
  },
  async (tok, S) => { // @505 ~man memory就好像一個cache一樣
    S.t3 = good('main memory 就像 disk 的 cache', 0, 0.5);
    cap('Main memory 就好像一個 cache', 'secondary storage（disk）的 cache');
  },
]);

scene('cvm-25a-share', '每人一個 virtual address space：教室座位的比喻', [
  async (tok, S) => { // @534 ~每一個人都有他自己的virtual address space
    S.A = slots(6, -4.8, 6.0, { w: 1.5, h: 0.42, fill: (i) => 'A 的 page ' + i, color: () => NC.sky, title: 'A 的 virtual space' });
    S.B = slots(6, -2.4, 6.0, { w: 1.5, h: 0.42, fill: (i) => 'B 的 page ' + i, color: () => NC.lilac, title: 'B 的 virtual space' });
    S.Mm = slots(4, 1.4, 6.0, { w: 1.7, h: 0.42, rl: (i) => String(i), title: 'Physical' });
    S.D = bx('Disk', NC.metal, 4.8, 5.0, 0, 1.4, 1.6);
    cap('每個人有自己的 virtual address space', '常用的放 main memory，不常用的放 disk');
  },
  async (tok, S) => { // @556 ~這個virtual address space跟physical就可以不一樣
    S.Mm.put(2, 'A 的 page 1', NC.sky); S.Mm.put(0, 'B 的 page 4', NC.lilac);
    cap('Virtual 和 physical 可以不一樣', '一塊可以放到 physical 的任何地方');
  },
  async (tok, S) => { // @576 ~切成一塊一塊一塊
    S.t1 = sm('virtual 切成 1K 一塊，physical 也切成 1K 一塊（切法一樣）', 0, 2.4);
    cap('Program 切成一塊一塊', 'physical 也切成一樣大小的一塊一塊');
  },
  async (tok, S) => { // @603 ~那我做教室裡面只有十個位置好了
    gone(S.A, S.B, S.Mm, S.D, S.t1);
    S.seat = slots(10, 1.6, 6.3, { w: 1.6, h: 0.38, gap: 0.08, rl: (i) => (i + 1) + ' 號位', title: '教室：10 個位置（frame）' });
    S.kid = buddy('38 號同學', '38', NC.orange, -3.6, 2.6, 0, 0.9);
    cap('比喻：教室只有 10 個位置', '每個位置一樣大（1K）');
  },
  async (tok, S) => { // @619 ~38號現在坐哪裡坐到十號
    S.seat.put(9, '38 號', NC.orange); S.seat.fl(9);
    S.tb = mt('table：38 號 → 10 號位', -3.6, 5.6, 'ptr alt');
    cap('38 號坐到 10 號位', '有一個 table 寫「38 → 10」就找得到');
  },
  async (tok, S) => { // @654 ~其實這就是一個mapping嘛
    S.seat.calm(); S.t2 = hot('mapping：virtual page → physical frame', -3.6, 4.6);
    cap('這就是一個 mapping', '把 virtual page map 到 physical frame');
  },
  async (tok, S) => { // @664 ~每個program也可以更大的space
    S.t3 = sm('virtual 可以很大，但一次只用到幾塊', -3.6, 1.2);
    cap('Program 可以有很大的 virtual space', '同時只用幾塊，用到再搬進來');
  },
  async (tok, S) => { // @713 ~如果我不在MainMemory的話就叫做Page Fault
    S.t4 = bad('要的 page 不在 main memory → page fault', -3.6, 0.5);
    cap('如果要的 page 不在 main memory', '就叫 page fault');
  },
]);

scene('cvm-25a-four', 'Page 與 frame、四個問題、為什麼 fully associative', [
  async (tok, S) => { // @724 ~在Memory就叫Frame在Disk叫做Page
    S.pg = bx('page（在 disk）', NC.purple, -3.0, 5.6, 0, 2.4, 0.9); S.fr = bx('frame（在 memory）', NC.lilac, 3.0, 5.6, 0, 2.4, 0.9);
    S.eq = good('一樣大小 → 搬進來剛好放得下', 0, 6.6);
    cap('Memory 裡叫 frame，disk 上叫 page', '兩個一樣大小，搬進來剛好放得下');
  },
  async (tok, S) => { // @766 ~我們有block size的問題
    S.q = list(-3.6, 4.3, 0.5);
    ['① block（page）size', '② placement：放哪、怎麼找', '③ replacement：誰出去', '④ write：怎麼寫'].forEach((t) => S.q.add(t));
    cap('跟 cache 一樣有四個問題', 'block size、placement、replacement、write');
  },
  async (tok, S) => { // @784 ~millions of cycles
    S.q.ls[0].element.className = 'lab-label ptr alt';
    S.t1 = sm('penalty：millions of cycles → 放棄 CPU（interrupt），一次搬大塊', 2.2, 4.0);
    cap('Penalty 很高，上百萬個 cycle', '所以 page 通常很大，平衡很長的 access time');
  },
  async (tok, S) => { // @823 ~direct map, set associate, 跟fully associate
    S.q.ls[0].element.className = 'lab-label idx'; S.q.ls[1].element.className = 'lab-label ptr alt';
    S.w = ['direct map', 'set associative', 'fully associative'].map((t, i) => bx(t, NC.sky, 0.6 + i * 2.2, 2.6, 0, 2.0, 0.5));
    cap('Cache 的放法：direct map、set associative、', 'fully associative');
  },
  async (tok, S) => { // @851 ~如果它有位置而你不讓他擺
    glow(S.w[0], NG); S.t2 = bad('有空位卻不准放 → 多一次 page fault，penalty 更大', 2.8, 1.7);
    cap('Memory 有空位卻不讓它擺', '多一次 miss，penalty 更大');
  },
  async (tok, S) => { // @856 ~所以就是用fully associate
    glow(S.w[0], null); glow(S.w[2], OKG); gone(S.t2);
    S.t3 = good('所以用 fully associative：任何 page 可放任何 frame', 2.8, 1.7);
    cap('所以用 fully associative', '任何一個 page 可以擺在任何一個 frame');
  },
  async (tok, S) => { // @878 ~然後這個大小一定要符合
    S.t4 = sm('位置的大小要剛好符合：一個洞對一個 page', 2.8, 1.0);
    cap('大小一定要符合', '一個洞對一個 page，剛好塞進來');
  },
  async (tok, S) => { // @898 ~這個要一個page table來做translation
    S.t5 = hot('需要一個 page table 做 translation', 2.8, 0.3);
    cap('任何位置都可以 → 要一個 table 記錄', '這個就是 page table');
  },
]);

// 老師：page = 2¹² bytes；page 5 → 請到 3 號 frame（offset 是示意值）
const T25 = (() => { const off = 0x2A4, vpn = 5, pfn = 3; const va = vpn * 4096 + off, pa = pfn * 4096 + off; const s = splitA(va, 12); return { off, vpn, pfn, va, pa, ok: s.hi === vpn && s.lo === off && splitA(pa, 12).lo === off }; })();
scene('cvm-25a-split', 'Address translation：virtual page number + page offset', [
  async (tok, S) => { // @906 ~假如給你一個virtual address
    S.va = fields([{ n: 'virtual page number', b: 20, c: NC.purple }, { n: 'page offset', b: 12, c: NC.orange }], 0, 5.6, { unit: 0.22 });
    S.t0 = hd('Virtual address（32 bits）', 0, 6.7);
    cap('Page 是 2¹² 個 byte', '最低 12 個 bit 就是 page offset');
  },
  async (tok, S) => { // @924 ~如果四個byte的話所以後面幾個bit就不用理它
    S.w = fields([{ n: 'word number', b: 30, c: NC.sky }, { n: 'byte', b: 2, c: NC.rose }], 0, 3.9, { unit: 0.2 });
    cap('和 word 的概念一樣', '一個 word 4 bytes → 最後 2 bits 不用理它');
  },
  async (tok, S) => { // @934 ~這就是page number virtual page number
    S.va.fl(0); S.w.kill();
    cap('前面剩下的就是 page number', 'virtual page number');
  },
  async (tok, S) => { // @950 ~它的地址會不會變呢
    S.va.fl(0, null);
    S.pg = slots(4, -3.6, 3.6, { w: 1.6, h: 0.42, rl: (i) => 'byte ' + i, title: 'page' });
    S.fr = slots(4, 2.4, 3.6, { w: 1.6, h: 0.42, rl: (i) => 'byte ' + i, title: 'frame' });
    S.pg.fl(3); S.ar = lk(-2.6, 2.3, 1.4, 2.3);
    cap('一個 page 搬到 frame 裡', '裡面第 0、1、2、3 個 byte 的位置會不會變？');
  },
  async (tok, S) => { // @999 ~就是這個的page offset
    S.fr.fl(3); S.va.fl(1);
    S.t1 = good('不會變：第 3 個 byte 搬過去還是第 3 個 → page offset 不用翻譯', 0, 1.0);
    cap('不會變！', '在 page 裡的相對位置就是 page offset');
  },
  async (tok, S) => { // @1034 ~譬如說第一個page
    gone(S.pg, S.fr, S.ar, S.t1); S.va.fl(1, null); S.va.fl(0);
    S.t2 = sm('high-order bits 告訴你是第幾個 page（像第幾個 word）', 0, 3.8);
    cap('High-order bits 就是 page number', '第一個 page、第二個 page、第三個 page…');
  },
  async (tok, S) => { // @1067 ~這個擺去哪裡我是不管的
    gone(S.t2); S.va.fl(0, null);
    S.tb = bx('translation table', NC.lilac, 0, 3.4, 0, 2.8, 0.8);
    cap('擺去哪裡都可以', '用一個 translation table 對應就好');
  },
  async (tok, S) => { // @1085 ~如果這邊是5號的話
    S.va.set(0, 'page ' + T25.vpn); S.va.set(1, '0x' + T25.off.toString(16).toUpperCase()); S.va.fl(0);
    S.n = sm('（offset 0x2A4 是示意值）', 4.6, 6.7);
    S.pf = bx('frame ' + T25.pfn, NC.green, -1.0, 1.6, 0, 2.2, 0.62); glow(S.tb, HL);
    cap('你的 ID 是 5 號', '查 table：請到 3 號位置 → physical frame number 3');
  },
  async (tok, S) => { // @1103 ~那第三個frame因為很大
    glow(S.tb, null);
    S.of = bx('0x' + T25.off.toString(16).toUpperCase(), NC.orange, 2.0, 1.6, 0, 1.6, 0.62); S.va.fl(1);
    S.ok = ok(T25.ok, 'PA = 3 × 4096 + 0x2A4 = 0x' + T25.pa.toString(16).toUpperCase() + '（VA 0x' + T25.va.toString(16).toUpperCase() + '）✓', 0.5, 0.6);
    cap('Frame number 接上不變的 page offset', '就是 physical address');
  },
]);

scene('cvm-25a-size', 'Virtual address space 可以比 physical 大', [
  async (tok, S) => { // @1126 ~因為Virtual Address可以比較大
    S.v = bx('virtual', NC.purple, -3.0, 3.6, 0, 2.0, 5.0); S.p = bx('physical', NC.green, 2.6, 2.4, 0, 2.0, 2.6);
    cap('Virtual address 可以比較大', 'physical 可以比較小');
  },
  async (tok, S) => { // @1133 ~譬如說你Virtual Address是有多少
    const v = 2 ** 36, p = 2 ** 34;
    S.t1 = sm('2³⁶ bytes = ' + KB(v), -3.0, 6.6); S.t2 = sm('2³⁴ bytes = ' + KB(p), 2.6, 4.2);
    S.ok = ok(v / p === 4, 'virtual 是 physical 的 2³⁶⁻³⁴ = 4 倍 ✓', 0, 0.4);
    cap('Virtual 有 2³⁶ 個 address', 'physical 可以只有 2³⁴');
  },
  async (tok, S) => { // @1151 ~virtual可能有1024個page
    S.t3 = hot('virtual 1024 個 page，physical 只有 32 個 frame 也沒關係', 0, 1.2);
    cap('Virtual 可能有 1024 個 page', 'physical 只有 32 個 frame 也沒關係');
  },
  async (tok, S) => { // @1175 ~跟fiscal不需要一樣大也可以一樣大
    gone(S.ok); S.t4 = sm('physical 的大小看 hardware；virtual 不見得要一樣大', 0, 0.4);
    cap('兩個可以一樣大，也可以不一樣大', 'physical 是固定的，看你的 hardware');
  },
]);

scene('cvm-25a-valid', 'Page table 的 valid bit：一開始是空的', [
  async (tok, S) => { // @1194 ~table怎麼產生好table怎麼產生就是跟我們的cache那個很像
    S.pt = slots(6, -2.6, 6.0, { w: 2.4, h: 0.48, rl: (i) => 'VPN ' + i, title: 'Page table', fill: () => 'V=0', color: () => NC.gray });
    S.mm = slots(4, 2.0, 6.0, { w: 1.8, h: 0.48, rl: (i) => 'frame ' + i, title: 'Main memory', rlw: 0.75 });
    S.D = bx('Disk', NC.metal, 5.4, 4.6, 0, 1.4, 1.8);
    cap('Table 怎麼產生？跟 cache 很像', '每次搬進來都要更新它');
  },
  async (tok, S) => { // @1213 ~它也是要有一個valid bit
    S.t1 = sm('一開始是空的：每個 entry 有 valid bit，全是 0', -2.6, 2.6);
    cap('一開始 page table 是空的', '每個 entry 有一個 valid bit');
  },
  async (tok, S) => { // @1225 ~它一看到說這是invalid
    S.va = bx('VA：VPN 2', NC.purple, -2.6, 1.7, 0, 2.0, 0.5); S.pt.fl(2, NG);
    S.t2 = bad('invalid → page fault', -2.6, 0.9);
    cap('拿 virtual address 去查：invalid', '還沒搬進來 → 產生 page fault');
  },
  async (tok, S) => { // @1231 ~OS就會到這個disk
    glow(S.D, HL); S.g = bx('page 2', NC.purple, 5.4, 4.6, 0.6, 1.4, 0.45);
    await slide(tok, S.g, 2.0, S.mm.y(1), 0.6, 900); kill(S.g); S.mm.put(1, 'VP 2', NC.purple); glow(S.D, null);
    cap('OS 到 disk 把你要的 page', '搬到 main memory');
  },
  async (tok, S) => { // @1239 ~然後呢才把這個set說你搬到哪裡
    S.t3 = sm('OS 像班長：知道哪裡有空位、誰坐哪個 frame', 2.0, 2.6);
    cap('OS 要知道哪邊是空的', '把你放到哪個 frame（像班長）');
  },
  async (tok, S) => { // @1261 ~搬進來就把這些data就set現在是valid
    S.pt.put(2, 'V=1 frame 1', NC.green); S.pt.fl(2, OKG); gone(S.t2);
    cap('搬進來之後，把這個 entry set 成 valid', '這個 entry 有效了');
  },
  async (tok, S) => { // @1282 ~那你下次再去Access
    S.pt.calm(); S.t4 = good('下次再 access VPN 2 → valid → 直接 translation 到 frame 1', -1.0, 0.9);
    cap('下次再 access', '已經在那邊，就可以做 translation');
  },
  async (tok, S) => { // @1323 ~而且在physical的man memory不止一個program
    S.t5 = hot('很多 program share main memory；每個人有自己的 translation table（OS 管）', 0, 0.2);
    cap('很多 program 同時 share main memory', '每個人都有自己的 page table，放在 OS');
  },
]);

scene('cvm-25a-paging', 'Paging：page fault 時 OS 做什麼', [
  async (tok, S) => { // @1366 ~所以我們說Paging是什麼東西呢
    S.v = slots(5, -4.4, 6.0, { w: 1.6, h: 0.45, rl: (i) => 'page ' + i, title: 'virtual pages', color: () => NC.sky, rlw: 0.7 });
    S.f = slots(6, 2.0, 6.0, { w: 1.6, h: 0.45, rl: (i) => 'frame ' + i, title: 'page frames', rlw: 0.75 });
    S.t1 = sm('partition 成 equal size', -1.2, 6.65);
    cap('Paging：virtual page 與 page frame', '一定要切成一樣大小');
  },
  async (tok, S) => { // @1394 ~這mapping是透過table去page table來做這個mapping
    S.pt = bx('page table', NC.lilac, -1.2, 4.6, 0, 1.8, 0.7);
    cap('Mapping 是透過 page table 來做', '');
  },
  async (tok, S) => { // @1418 ~第三個page可map到第五個frame
    S.v.fl(3); S.f.put(5, 'page 3', NC.sky); S.f.fl(5, OKG); S.a = lk(-3.5, S.v.y(3), 1.1, S.f.y(5));
    cap('有在 memory：例如第 3 個 page', 'map 到第 5 個 frame，拿到 A′');
  },
  async (tok, S) => { // @1427 ~如果沒有的話他會告訴你說他不在裡面的話
    S.v.calm(); S.f.calm(); S.v.fl(1, NG); S.t2 = bad('page 1：在 disk，還沒搬進來 → page fault', -1.2, 2.6);
    cap('不在裡面：table 告訴你它還在 disk', '就產生 page fault');
  },
  async (tok, S) => { // @1457 ~OS要開始處理了interrupt
    S.cpu = bx('CPU：給別的 process', NC.teal, -3.0, 1.5, 0, 2.6, 0.55);
    cap('OS 開始處理（interrupt）', 'CPU 就放棄了，給別人用');
  },
  async (tok, S) => { // @1464 ~那開始就IO了
    S.D = bx('Disk', NC.metal, 4.8, 3.2, 0, 1.2, 1.4); S.g = bx('page 1', NC.sky, 4.8, 3.2, 0.6, 1.2, 0.45);
    await slide(tok, S.g, 2.0, S.f.y(2), 0.6, 1000); kill(S.g); S.f.put(2, 'page 1', NC.sky);
    cap('IO：disk 慢慢把東西搬到 memory', '');
  },
  async (tok, S) => { // @1475 ~interrupt他一下
    S.rq = sm('搬完 → interrupt → process 放到 ready queue 等 CPU', 1.0, 0.8);
    cap('搬完了 interrupt 一下', 'process 又 ready 了，放到 list 上等');
  },
  async (tok, S) => { // @1497 ~我在這個waiting的例子再把它拉出來做
    glow(S.v.m(1), OKG); S.t3 = good('從剛剛停的地方 resume：對 program 來說像一直 sequential 執行', 0, 0.1);
    cap('再拉出來，從剛才結束的地方開始', '對你來說就像一直 sequential 在執行');
  },
]);

// 老師：page table 從 100 開始放 → 第 5 個 entry 在 105；VPN 38 → 138
scene('cvm-25a-ptarray', 'Page table 是 memory 裡的 array；page table register', [
  async (tok, S) => { // @1566 ~那現在看到PageTable
    S.pt = slots(7, -1.6, 6.2, { w: 2.6, h: 0.45, rl: (i) => 'entry ' + i, title: 'Page table（在 main memory）', rlw: 0.8 });
    cap('Page table 長什麼樣子？', '好像一個 array，放在 main memory');
  },
  async (tok, S) => { // @1592 ~這個第一個entry
    [9, 4, 12, 7, 2, 30, 18].forEach((f, i) => S.pt.put(i, 'frame ' + f, NC.mint));
    S.t1 = sm('用 virtual page number 當 index，裡面放 physical frame number', -1.6, 2.4);
    cap('Array of page table entries', 'index by virtual page number，裡面放 frame number');
  },
  async (tok, S) => { // @1627 ~不一定從0開始其實你可以擺在任何一個地方
    S.base = bx('從 memory 100 開始放', NC.teal, 3.6, 6.0, 0, 2.6, 0.55);
    S.pt.lbls.slice(0, 7).forEach((l, i) => txt(l, 'mem ' + (100 + i)));
    cap('Page table 一定要從 0 開始放嗎？', '不一定，可以擺在任何地方，例如 100');
  },
  async (tok, S) => { // @1655 ~假如你是從100開始擺起
    S.pt.fl(5); S.c = ok(100 + 5 === 105, '第 5 個 entry → 100 + 5 = 105 ✓', 3.6, 4.9);
    cap('從 100 開始放', '第 5 個 entry 就去 access 100 + 5');
  },
  async (tok, S) => { // @1704 ~page table register
    relabel(S.base, 'page table register = 100'); tint(S.base, NC.gold);
    cap('Page table register', '告訴你 page table 從哪邊開始');
  },
  async (tok, S) => { // @1717 ~如果一個page在memory的話就是hit
    S.pt.calm(); S.pt.put(5, 'V 1 · R · D · frame 30', NC.green); S.pt.fl(5, OKG);
    S.t2 = sm('在 memory（hit）：frame number + status bits（valid、reference、dirty）', 1.0, 1.7);
    cap('Page 在 memory 就是 hit', '告訴你 frame number，還有 valid、reference、dirty bit');
  },
  async (tok, S) => { // @1739 ~那如果不在的話呢那個entry就告訴你就不在
    S.pt.put(1, 'V 0 → disk（swap area）', NC.gray); S.pt.fl(1, NG);
    S.t3 = bad('不在：entry 指到 disk 的 swap area → page fault', 1.0, 1.0);
    cap('不在的話，entry 指到 swap area', '告訴你在 disk 哪裡 → page fault');
  },
  async (tok, S) => { // @1777 ~那現在page table的translation就是這樣子
    gone(S.pt, S.t1, S.t2, S.t3, S.c, S.base);
    S.va = fields([{ n: 'virtual page number', b: 20, c: NC.purple, v: '38' }, { n: 'page offset', b: 12, c: NC.orange }], -1.0, 6.0, { unit: 0.2 });
    S.tb = bx('page table', NC.lilac, -2.0, 4.0, 0, 2.2, 0.9); lk(-2.0, 5.6, -2.0, 4.5);
    cap('Page number 經過 table 翻譯', 'page offset 直接下來不變');
  },
  async (tok, S) => { // @1798 ~譬如說這邊是38
    S.reg = bx('page table register = 100', NC.gold, 3.4, 4.0, 0, 3.0, 0.6);
    S.c2 = ok(0 + 38 === 38 && 100 + 38 === 138, '從 0 放 → entry 在 38；從 100 放 → 100 + 38 = 138 ✓', 0.6, 3.1);
    cap('Page number 38 → 找第 38 個 entry', '從 100 開始放的話，在 138 那個位置');
  },
  async (tok, S) => { // @1836 ~你的friend number friend number直接下來
    S.pa = fields([{ n: 'physical frame number', b: 18, c: NC.green, v: 'frame #' }, { n: 'page offset', b: 12, c: NC.orange }], -1.0, 1.7, { unit: 0.2 });
    lk(-2.0, 3.5, -2.0, 2.1); S.pa.fl(1); S.va.fl(1);
    S.t4 = sm('frame number = physical address 的 high-order bits；offset = low-order bits', 0, 0.6);
    cap('Frame number 是 high-order bits', '加上不變的 page offset → physical address');
  },
]);

scene('cvm-25a-twice', 'Page table 在 memory：每次要兩次 memory reference', [
  async (tok, S) => { // @1905 ~page table剛剛講說是放在哪裡
    S.cpu = bx('CPU', NC.teal, -4.6, 4.4, 0, 1.4, 0.8); S.mem = bx('Main memory', NC.tan, 2.6, 4.4, 0, 3.0, 2.4);
    S.ptm = bx('page table', NC.lilac, 2.6, 5.1, 0.5, 2.2, 0.55); S.dat = bx('data', NC.sky, 2.6, 3.7, 0.5, 2.2, 0.55);
    cap('Page table 放在哪裡？', '放在 memory');
  },
  async (tok, S) => { // @1915 ~那也就是說我每一次要去access一個地方
    S.dot = bx('VA', NC.purple, -4.6, 5.3, 0.6, 0.8, 0.4); glow(S.ptm, HL);
    await slide(tok, S.dot, 1.0, 5.1, 0.8, 800); relabel(S.dot, 'PA');
    cap('每次 access，先去 page table', '找到 physical address');
  },
  async (tok, S) => { // @1945 ~所以他每一次要做兩幾個reference
    glow(S.ptm, null); glow(S.dat, HL); await slide(tok, S.dot, 1.0, 3.7, 0.8, 600);
    S.n = bad('每個 virtual address：2 次 memory reference', -1.0, 2.0);
    cap('再拿 physical address 去 memory', '每次要 2 個 memory reference');
  },
  async (tok, S) => { // @1969 ~我們已經為了一次光access一次我們都夠慢就弄了個cache
    S.c = bx('cache', NC.green, -2.0, 4.4, 0, 1.4, 0.8);
    cap('Memory 已經夠慢了，access 一次就慢', '所以才弄了個 cache；現在還要兩次？');
  },
  async (tok, S) => { // @1997 ~那你可以想到一個page是不是很大
    S.t1 = sm('page 很大：同一個 page 裡的每個 address，用的都是同一個 entry', 0, 1.2);
    cap('一個 page 很大', '裡面每個 address 做 translation 都用同一個 entry');
  },
  async (tok, S) => { // @2015 ~那常常用到那個translation那個entry是不是可以把它放到
    S.near = bx('常用 entry', NC.lilac, -3.3, 3.2, 0, 1.6, 0.5); glow(S.near, OKG);
    S.t2 = good('常用的 entry 放到 CPU 旁邊 → 馬上 translation（下次介紹）', 0, 0.5);
    cap('常用的 entry 不要放 memory', '放到靠近 processor 的地方');
  },
]);

scene('cvm-25a-ptbig', '另一個問題：page table 可能很大', [
  async (tok, S) => { // @2077 ~你是一個program你有一個translation table
    S.ts = ['P1', 'P2', 'P3'].map((p, i) => bx(p + ' 的 page table', [NC.sky, NC.lilac, NC.rose][i], -4.0 + i * 3.4, 5.4, 0, 2.6, 0.7));
    cap('每個 program 有自己的 page translation table', '同時好幾個在 run');
  },
  async (tok, S) => { // @2097 ~fully associated的關係所以你每一個entry
    const pages = 1024; S.t1 = ok(pages === 1024, '1024 個 page → 1024 個 entry ✓（每個 page 一個）', 0, 4.2);
    cap('Fully associative：每個 page 都要一個 entry', '1024 個 page → 1024 個 entry');
  },
  async (tok, S) => { // @2112 ~那如果你這個Virtual在很大的話
    S.big = bx('', NC.purple, 0, 2.2, 0, 1.4, 0.1); await anim(tok, 800, (u) => { S.big.scale.y = 1 + u * 18; });
    cap('Virtual 很大的話', 'page table 有可能很大');
  },
  async (tok, S) => { // @2128 ~可是它有兩個問題啊
    S.p = bad('兩個問題：① page table 太大　② 每次 access 要 2 倍', 0, 0.5);
    cap('雖然用了 translation，有兩個問題', 'page table 太大、access 要兩倍');
  },
]);

scene('cvm-25a-fault', 'Page fault：硬體偵測、OS 處理', [
  async (tok, S) => { // @2142 ~一個page table我們去reference它如果page fault
    S.pt = slots(5, -3.6, 6.2, { w: 2.2, h: 0.42, rl: (i) => 'VPN ' + i, title: 'page table', fill: (i) => (i === 2 ? 'V=0' : 'V=1'), color: (i) => (i === 2 ? NC.gray : NC.mint) });
    S.pt.fl(2, NG); S.t1 = bad('不在 main memory → page fault', -3.6, 3.3);
    cap('查 page table：這個 page 不在 main memory', '就是 page fault');
  },
  async (tok, S) => { // @2189 ~所以我可以用Hardware去Detect這件事情
    S.hw = bx('hardware：偵測到 V=0', NC.blue, 2.4, 5.8, 0, 3.4, 0.6);
    cap('Penalty 很大', 'hardware 可以 detect，卻沒辦法修正它');
  },
  async (tok, S) => { // @2195 ~像Cache的時候可以
    S.c = sm('cache miss：時間短，hardware 自己修正（stall 幾個 cycle）', 2.4, 4.9);
    cap('Cache miss 時間很快', '用 hardware 修正就好');
  },
  async (tok, S) => { // @2207 ~你必須用Software
    S.sw = bx('software（OS）處理', NC.gold, 2.4, 4.0, 0, 3.4, 0.6);
    S.k = ok(5e4 < 1e6, 'OS 跑幾千～幾萬 cycle ≪ disk 幾百萬 cycle ✓', 2.4, 3.1);
    cap('Page fault 用 software 處理', 'OS 跑幾萬個 cycle，比起幾百萬還好');
  },
  async (tok, S) => { // @2244 ~就是移出去的意思
    S.cs = sm('faulting process 被 context switch：CPU 換人', 2.4, 2.4);
    cap('Faulting process 被 context switch', 'CPU 就換人用');
  },
  async (tok, S) => { // @2295 ~他當然就要把東西搬過來就pick a page
    gone(S.hw, S.c, S.sw, S.k, S.cs);
    S.f = slots(4, 2.6, 6.2, { w: 2.0, h: 0.42, rl: (i) => 'frame ' + i, title: 'main memory', rlw: 0.75, fill: (i) => (i < 3 ? 'VP ' + [0, 1, 3][i] : '空'), color: (i) => (i < 3 ? NC.mint : NC.off) });
    S.f.fl(3, OKG); cap('OS 處理 page fault：有空的 frame', '就直接把 page 搬進來');
  },
  async (tok, S) => { // @2320 ~如果這時候physical是滿的的話
    S.f.calm(); S.f.put(3, 'VP 4', NC.mint); S.f.fl(0, NG);
    S.t2 = bad('滿了 → replace 一個 page（被改過要先寫回去）', 2.6, 3.6);
    cap('如果 physical 滿了', '就要 replace 一個，寫回去把位置空出來');
  },
  async (tok, S) => { // @2329 ~把你的page從disk漏了進來
    S.f.calm(); S.f.put(0, 'VP 2', NC.purple); S.f.fl(0, OKG); S.pt.put(2, 'V=1 frame 0', NC.green); S.pt.calm();
    S.t3 = good('讀進 page → update page table → restart', 2.6, 2.9);
    cap('從 disk 讀進來、update page table', '再重新開始這個 program');
  },
  async (tok, S) => { // @2360 ~OS要記錄什麼東西呢
    gone(S.t1, S.t2);
    S.sw = bx('swap space：整個 virtual space 都先在 disk 留位置', NC.metal, -1.4, 1.8, 0, 6.4, 0.6);
    cap('OS 要 create swap space', '你所有的 virtual page 在 disk 都要先有位置');
  },
  async (tok, S) => { // @2391 ~那OS要做才知道說要swap到哪裡去
    S.ds = sm('data structure：哪個 page 在 disk 哪裡、在哪個 frame、何時被用過', -1.4, 0.9);
    cap('還要有 data structure 記錄', '哪個 page 在哪裡、什麼時候被用到');
  },
  async (tok, S) => { // @2436 ~其實最後他真正做Io
    S.io = sm('OS 只把狀況設定好；真正的 IO 自己搬，搬完再 interrupt CPU', -1.4, 0.2);
    cap('OS 決定好、設定好之後', 'IO 自己從 disk 搬，搬完再 interrupt');
  },
]);

// reference bit 近似 LRU（老師的例子：一段時間內 10 個被用到、6 個沒有）
const REF = (() => { const used = new Set([0, 1, 3, 4, 6, 8, 9, 11, 12, 14]); const bits = Array.from({ length: 16 }, (_, i) => (used.has(i) ? 1 : 0)); return { bits, ones: bits.filter((b) => b).length, zeros: bits.filter((b) => !b).length }; })();
scene('cvm-25a-replace', 'Page replacement：reference bit 近似 LRU；write back + dirty bit', [
  async (tok, S) => { // @2493 ~再過來就是Replacement的問題
    S.t0 = hot('Replacement：fully associative → 滿了誰要出去？', 0, 6.7);
    cap('再來是 replacement', '不像 direct map 一定在那個位置');
  },
  async (tok, S) => { // @2509 ~Set Associated是你可能在這個裡面有兩個位置
    S.t1 = sm('set associative：兩個位置都滿，要一個 policy；fully：1024 個 frame 滿了，誰出去？', 0, 6.0);
    cap('Set associative 兩個位置也要 policy', 'fully associative 更需要');
  },
  async (tok, S) => { // @2539 ~這個temporal locality嗎
    S.t2 = good('temporal locality：最近用過的待會還會用 → 換掉最久沒用的（LRU）', 0, 5.3);
    cap('Temporal locality', '最近用的留著，很久沒用的搬出去：LRU');
  },
  async (tok, S) => { // @2557 ~如果你要純粹用這個least recently used
    S.f = slots(16, 0, 0, { w: 0.6, h: 0.6 }); S.f.cells.forEach(([m], i) => { m.position.set(-5.25 + i * 0.7, 3.6, 0); });
    S.bt = S.f.cells.map(([m], i) => sm('0', -5.25 + i * 0.7, 2.9));
    cap('純 LRU 要一直 keep track，太複雜', '用簡單的 reference bit（use bit）');
  },
  async (tok, S) => { // @2575 ~如果你現在用到的話用到的話我就把它set成1
    S.f.put(3, 'P3', NC.mint); txt(S.bt[3], '1'); S.f.fl(3, OKG);
    cap('每個 page 一個 reference bit', '用到的話就 set 成 1');
  },
  async (tok, S) => { // @2585 ~它是check那個0的哪一個是0
    S.f.calm(); S.f.fl(7, NG); S.t3 = sm('OS 要換：找 reference bit = 0 的', 0, 2.2);
    cap('OS 要 replace 時', '檢查哪一個是 0，就把它拿去 replace');
  },
  async (tok, S) => { // @2597 ~那我現在先把全部全部set成0
    S.f.calm(); REF.bits.forEach((b, i) => { txt(S.bt[i], String(b)); S.f.put(i, '', b ? NC.mint : NC.rose); });
    S.k = ok(REF.ones === 10 && REF.zeros === 6, '這段期間 10 個 set 成 1、6 個是 0 → 從 6 個裡挑一個 ✓', 0, 1.5);
    cap('先全部 set 0；這段期間 10 個被 set 成 1', '在沒被 set 的 6 個裡隨便找一個');
  },
  async (tok, S) => { // @2628 ~他過了一段他就再把這全部的bit就是set成0
    REF.bits.forEach((b, i) => { txt(S.bt[i], '0'); S.f.put(i, '', NC.off); }); gone(S.k);
    S.t4 = sm('過一段時間全部 clear 成 0，重新觀察 → 模擬 LRU', 0, 1.5);
    cap('過一段時間把全部 clear 成 0', '之後用到才 set → 模擬 LRU');
  },
  async (tok, S) => { // @2645 ~write呢那你猜看看
    gone(S.f, S.bt, S.t1, S.t2, S.t3, S.t4);
    S.wt = bx('write through', NC.rose, -2.6, 4.2, 0, 2.6, 0.7); S.wb = bx('write back', NC.mint, 2.6, 4.2, 0, 2.6, 0.7);
    cap('Write 呢？猜猜看', 'write through 還是 write back？');
  },
  async (tok, S) => { // @2655 ~不可能write through
    glow(S.wt, NG); glow(S.wb, OKG); S.x = bad('每次 update 都寫 disk？不可能', -2.6, 3.3);
    cap('不可能 write through', '每次 update 都寫回 disk 太慢 → 一定 write back');
  },
  async (tok, S) => { // @2667 ~我們就要設一個dirty bit
    S.d = sm('dirty bit：這個 page 有沒有被 update；沒改過 → 和 disk 一致，不用寫回', 0, 2.2);
    cap('Write back 要設一個 dirty bit', '沒被改過，和 disk 一樣，就不用寫回去');
  },
  async (tok, S) => { // @2688 ~dirty bit去告訴他說這一個放在page table的entry
    S.e = bx('page table entry：V · R · D=1 · frame', NC.lilac, 0, 1.2, 0, 4.4, 0.6);
    cap('Dirty bit 放在 page table 的 entry', '寫過的 page 被 replace 時，要多一個 write back');
  },
]);

const PT32 = (() => { const off = lg2(4 * 1024), vpn = 32 - off, n = 2 ** vpn, size = n * 4; return { off, vpn, n, size }; })();
scene('cvm-25a-huge', 'Page table 太大：4 KiB page → 4 MiB；bound register', [
  async (tok, S) => { // @2705 ~就相當於我們那四個問題
    S.q = ['placement', 'find', 'replacement', 'write'].map((t, i) => good(t + ' ✓', -4.5 + i * 3, 6.6));
    cap('四個問題都回答了，跟 cache 一樣', 'placement、找、replacement、write');
  },
  async (tok, S) => { // @2721 ~可是這個又特別的問題因為page table的關係
    S.p1 = bad('① page table 太大', -2.4, 5.7); S.p2 = bad('② access page table 太慢（2 次）', 2.4, 5.7);
    cap('Page table 帶來兩個特別的問題', '一個太大、一個太慢');
  },
  async (tok, S) => { // @2765 ~Page Table為什麼會太大
    S.t1 = sm('每個 virtual page 都要一個 entry（fully associative 的代價；direct map 只比 tag）', 0, 4.9);
    cap('為什麼太大？', '每個 virtual page 都要一個 entry');
  },
  async (tok, S) => { // @2809 ~假如我page table現在是32B的virtual address space
    S.va = fields([{ n: 'VPN', b: PT32.vpn, c: NC.purple }, { n: 'page offset', b: PT32.off, c: NC.orange }], 0, 3.6, { unit: 0.22 });
    cap('32-bit virtual address、4 KiB 一個 page', '2¹² → 用掉 12 個 bit');
  },
  async (tok, S) => { // @2825 ~所以就剩下2的20個page table entry
    S.va.fl(0); S.t2 = sm('2^' + PT32.vpn + ' = ' + PT32.n.toLocaleString('en-US') + ' 個 entry', 0, 2.6);
    cap('剩下 20 bits', '2²⁰ 個 page table entry');
  },
  async (tok, S) => { // @2828 ~那假如每個entry你需要佔據4個byte的話
    S.k = ok(PT32.size === 4 * 2 ** 20, '2²⁰ × 4 bytes = ' + KB(PT32.size) + ' ✓', 0, 1.9);
    cap('每個 entry 4 bytes', '就要 4 MB 的 table');
  },
  async (tok, S) => { // @2840 ~那你同一個時間在不只一個program在run
    S.t3 = bad('每個 program 都要一份 4 MiB → memory 被佔掉很多', 0, 1.2);
    cap('不只一個 program 在 run', '每個人都要這麼大的 table');
  },
  async (tok, S) => { // @2859 ~那pagetable是不是也應該有一個locality的概念
    S.t4 = good('page table 也有 locality：同一時間只 access 某一塊 → 只放部分', 0, 0.5);
    cap('Page table 也有 locality', '只要有用到那一塊的 translation 就好');
  },
  async (tok, S) => { // @2889 ~就是用Bound Regist to Limit Table Size
    gone(S.q, S.p1, S.p2, S.t1, S.va, S.t2, S.k, S.t3, S.t4);
    S.tb = slots(8, -2.0, 6.2, { w: 2.4, h: 0.5, rl: (i) => 'entry ' + i * 25, title: 'page table', rlw: 0.8, color: () => NC.off });
    S.t5 = sm('dynamic data、stack 執行時一直長', 3.0, 5.4);
    cap('第一個方法：bound register 限制 table size', 'dynamic data、stack 會一直長');
  },
  async (tok, S) => { // @2927 ~limit在那個地方比如你現在用了100個entry
    for (let i = 0; i < 5; i++) S.tb.put(i, '已配置', NC.mint);
    S.lim = bx('limit register = 100', NC.gold, 3.0, 4.2, 0, 2.8, 0.6);
    cap('用了 100 個 entry，就只配 0 到 100', '用更多再放更多 entry');
  },
]);

// ════════ CDpUW5B9EbA（第 25B 講：黑板例子、bound register、hashing / inverted、two-level、TLB、TLB + cache、組合） ════════
// 老師的黑板：virtual space 4 個 page × 4 bytes（位址 4 bits = page 2 bits | offset 2 bits），physical 只有 2 個 frame（黑板上寫 00、01）。
// page 01 放進 frame 00；access virtual 01|10 → physical 00|10。
const BB = (() => { const pt = { 1: 0 }; const va = 0b0110; const s = splitA(va, 2); const pa = pt[s.hi] * 4 + s.lo; return { va, vpn: s.hi, off: s.lo, pfn: pt[s.hi], pa, ok: s.hi === 1 && s.lo === 2 && pa === 0b0010 }; })();
scene('cvm-25b-board', '黑板例子：4 個 page、2 個 frame 的 translation', [
  async (tok, S) => { // @21 ~我們現在做translation是說給一個地址
    S.t0 = hot('Memory reference：給一個地址，就去那裡拿東西', 0, 6.7);
    cap('再舉個例子看 translation', '平常 memory reference：給一個地址就拿東西');
  },
  async (tok, S) => { // @74 ~我說給0011你要去哪裡拿東西
    S.t1 = sm('virtual = physical 的話：0011 就去 0011 拿、1011 就去 1011 拿', 0, 6.0);
    cap('如果 virtual address = physical address', '給 0011 就到 0011 拿，沒事');
  },
  async (tok, S) => { // @93 ~可是如果說我的virtual address這樣
    S.t2 = bad('但 virtual address 是「假的」編號，真正擺在 memory 的另一個地址 → 要 translation', 0, 5.3);
    cap('可是 virtual address 是我自己編的號碼', '真的擺在哪裡要另外找 → translation');
  },
  async (tok, S) => { // @127 ~假設是virtual address space我分成四個page
    gone(S.t0, S.t1, S.t2);
    S.v = slots(16, -4.0, 6.5, { w: 1.2, h: 0.3, gap: 0.06, rl: (i) => b2(i, 4), rlw: 0.5, color: (i) => [NC.sky, NC.rose, NC.mint, NC.lilac][i >> 2] });
    S.vt = hd('virtual：4 個 page，每個 4 bytes', -4.0, 7.1);
    cap('Virtual space 分成 4 個 page', '一個 page 裡只有 4 個 byte：0000、0001、0010…');
  },
  async (tok, S) => { // @170 ~怎麼知道是第幾個page
    S.pn = [0, 1, 2, 3].map((p) => hot('page ' + b2(p, 2), -1.9, S.v.y(p * 4 + 1.5)));
    cap('怎麼知道是第幾個 page？', '看前面這兩個 bit 就可以');
  },
  async (tok, S) => { // @181 ~那這個是什麼東西呢是page offset
    S.t3 = sm('後面兩個 bit = page offset：第 0、1、2、3 個 entry', 1.6, 0.2);
    cap('後面兩個 bit 是 page offset', '00、01、10、11：page 裡的第幾個');
  },
  async (tok, S) => { // @213 ~那在physical裡面只有兩個frame而已
    S.p = slots(8, 3.2, 6.5, { w: 1.4, h: 0.3, gap: 0.06, rl: (i) => b2(i >> 2, 2) + b2(i & 3, 2), rlw: 0.55, color: () => NC.off });
    S.pt0 = hd('physical：2 個 frame', 3.2, 7.1);
    S.fn = [0, 1].map((f) => hot('frame ' + b2(f, 2), 5.2, S.p.y(f * 4 + 1.5)));
    cap('Physical 只有兩個 frame', '地址前面就是 frame number：00、01');
  },
  async (tok, S) => { // @259 ~所以我把這一塊搬到man memory來
    [4, 5, 6, 7].forEach((i) => S.v.fl(i));
    for (let k = 0; k < 4; k++) S.p.put(k, '', NC.rose);
    S.ar = lk(-3.3, S.v.y(5.5), 2.4, S.p.y(1.5));
    cap('紅色的 page 01 常被用到', '整塊搬進來，放在 frame 00');
  },
  async (tok, S) => { // @282 ~所以我的page table
    S.v.calm();
    S.pt = slots(4, 0.3, 6.3, { w: 1.5, h: 0.42, rl: (i) => b2(i, 2), rlw: 0.4, fill: (i) => (i === 1 ? '→ 00' : '—'), color: (i) => (i === 1 ? NC.rose : NC.gray), title: 'page table' });
    S.pt.fl(1, OKG);
    cap('Page table 有 4 個 entry', '第 01 個 entry 記：page 01 → frame 00');
  },
  async (tok, S) => { // @295 ~那假如我現在access某一個element就是第3個element
    S.v.fl(6); S.p.fl(2);
    cap('Access page 01 裡第 3 個 element', '搬到 frame 裡，它是第幾個？也是第 3 個');
  },
  async (tok, S) => { // @331 ~page offset的地方就整個搬進去
    S.t4 = good('整塊搬進去：offset 10 不會變', 1.6, -0.4);
    cap('Page offset 不會變', '會變的只有前面的 page number');
  },
  async (tok, S) => { // @347 ~我現在給你一個virtual address被叫01 01 10
    gone(S.t3, S.t4);
    S.va = fields([{ n: 'page', b: 2, c: NC.rose, v: b2(BB.vpn, 2) }, { n: 'offset', b: 2, c: NC.orange, v: b2(BB.off, 2) }], 0.3, 2.6, { minW: 0.9 });
    S.pt.fl(1, HL);
    cap('給你 virtual address 0110', '先拿 page number 01 去 table 查 → 00');
  },
  async (tok, S) => { // @365 ~好然後這個page offset有沒有改變沒變
    S.pa = fields([{ n: 'frame', b: 2, c: NC.green, v: b2(BB.pfn, 2) }, { n: 'offset', b: 2, c: NC.orange, v: b2(BB.off, 2) }], 0.3, 1.0, { minW: 0.9 });
    S.k = ok(BB.ok, 'virtual 0110 → physical ' + b2(BB.pa, 4) + ' ✓', 0.3, -0.1);
    cap('Offset 10 不變', 'physical address 就是 0010');
  },
  async (tok, S) => { // @420 ~一個Page是整個搬進去所以在裡面的那個位置相對位置是不變的
    S.pt.calm(); S.t5 = sm('low-order bits = offset（不變）；high-order bits = page number（查 translation table）', 0, -0.9);
    cap('整個 page 搬進去，相對位置不變', 'low-order 是 offset，high-order 是 page number');
  },
], [[0, 3.4, 14.5], [0, 3.0, 0]]);

scene('cvm-25b-limit', 'Page table 太大：bound register 與兩個 limit', [
  async (tok, S) => { // @470 ~那page table size是什麼是跟你virtual address的多少個page是有關係的
    S.t1 = sm('page table size ∝ virtual page 數：1024 個 page → 1024 個 entry；每個 program 一張', 0, 6.6);
    cap('Page table 多大跟 virtual page 數有關', '1024 個 page 就要 1024 個 entry');
  },
  async (tok, S) => { // @486 ~page會擺哪裡也是擺在memory裡面
    S.t2 = sm('page table 擺在 memory；不像 cache 用 hardware 同時比對（fully associative → 查表）', 0, 6.0);
    cap('Page table 擺在 memory', '跟 cache 用 hardware 同時比對不一樣');
  },
  async (tok, S) => { // @514 ~我要先去Pagetable做一個translation
    S.t3 = sm('先到 page table 做 translation → 再用 physical address access memory', 0, 5.4);
    cap('先去 page table 做 translation', '再用 physical address 去 access memory');
  },
  async (tok, S) => { // @539 ~PageTable 說這個如果是32K的Virtual Address 4K by
    gone(S.t1, S.t2, S.t3);
    S.va = fields([{ n: 'VPN', b: PT32.vpn, c: NC.purple }, { n: 'offset', b: PT32.off, c: NC.orange }], 0, 5.6, { unit: 0.22 });
    S.k1 = ok(PT32.off === 12 && PT32.n === 2 ** 20, '4K = 2¹² → offset 12 bits → 2²⁰ 個 entry ✓', 0, 4.4);
    cap('32-bit virtual address、4K page', '用掉 12 bits，剩下 2²⁰ 個 entry');
  },
  async (tok, S) => { // @563 ~那每一個entry如果是4個byte的話所以它有4MB的table
    S.k2 = ok(PT32.size === 4 * 2 ** 20, '2²⁰ × 4 bytes = ' + KB(PT32.size) + ' ✓', 0, 3.7);
    cap('每個 entry 4 bytes', '4 MB 的 table，很大');
  },
  async (tok, S) => { // @569 ~我們不需要全部存它
    S.t4 = good('locality：可能只用到幾個 entry，何必全部存', 0, 3.0);
    cap('不需要全部存', 'translation 也有 locality');
  },
  async (tok, S) => { // @580 ~就把說我現在只用到第10個page entry
    gone(S.va, S.k1, S.k2, S.t4);
    S.tb = slots(8, -3.0, 6.4, { w: 2.0, h: 0.5, rl: (i) => (i === 0 ? 'low' : i === 7 ? 'high' : ''), title: 'page table', color: () => NC.off });
    S.tb.put(0, 'heap 的 entry', NC.mint); S.tb.put(1, 'heap 的 entry', NC.mint);
    S.l1 = bx('bound register', NC.gold, 1.4, S.tb.y(1), 0, 2.2, 0.45);
    cap('Bound register：用多少給多少', '用到第 10、15、18 個 entry，limit 慢慢漲');
  },
  async (tok, S) => { // @602 ~因為我們的memory是怎麼access
    S.tb.put(7, 'stack 的 entry', NC.rose); S.tb.put(6, 'stack 的 entry', NC.rose);
    S.t5 = sm('stack 從高 address 往下長；dynamic data 從低 address 往上長', 2.4, 3.5);
    cap('Memory 是從兩端長過來的', 'stack 一端、dynamic data 另一端');
  },
  async (tok, S) => { // @619 ~一個從高位高address往下長
    S.l2 = bx('第二個 limit register', NC.gold, 1.4, S.tb.y(6), 0, 2.6, 0.45);
    cap('所以兩個 limit register 比較合理', '一個往下長、一個往上長');
  },
  async (tok, S) => { // @639 ~我再把page呢再做page table
    S.m = list(2.4, 2.4, 0.5); ['其他方法：page table 自己也分頁（multi-level）', 'hashing（inverted page table）'].forEach((t) => S.m.add(t));
    cap('其他方法：再做一層 page table', '或 hashing、multi-level page table');
  },
  async (tok, S) => { // @654 ~這個就是不用把PageTable全部搬過來
    gone(S.m, S.t5, S.l2); txt(S.l1.userData.lbl, 'limit = 30');
    const lim = 30, chk = [15, 30, 31].map((e) => e <= lim);
    S.k = ok(chk[0] && chk[1] && !chk[2], 'limit 30：entry 0–30 OK，31 以上不 OK ✓', 2.4, 2.4);
    cap('用到第 15 個，limit 設 15；用到 30 就設 30', '30 以下 OK，30 以上不 OK，一直長');
  },
]);

// inverted page table（老師：28-bit VA、4K page → 64K 個 page；physical 16K 個 frame）
const INV = (() => { const pages = 2 ** (28 - 12), frames = 16 * 1024; return { pages, frames, ratio: pages / frames }; })();
scene('cvm-25b-hash', 'Hashing：inverted page table 只跟 frame 數一樣大', [
  async (tok, S) => { // @698 ~另外一個呢就hashing用hashing
    S.t0 = hot('Hashing（資料結構學過）', 0, 6.7);
    cap('另一個方法：hashing', '還記得資料結構的 hash table 嗎？');
  },
  async (tok, S) => { // @726 ~有100到1000好了可真正會出現可能只有100個而已
    S.t1 = sm('值可能是 1～1000，但真正出現的只有 100 個', 0, 6.0);
    cap('值的範圍到 1000', '真正會出現的可能只有 100 個');
  },
  async (tok, S) => { // @765 ~還是一個direct map的概念是用像array那個概念一樣
    S.big = bx('array：1000 格（大多空著）', NC.gray, -3.4, 4.4, 0, 3.0, 2.2);
    cap('用 array 直接 index', '要 create 1000 個 element，就像 page table');
  },
  async (tok, S) => { // @789 ~並不會真的有這麼多可能只有100個element
    S.sm = slots(5, 2.4, 5.4, { w: 2.0, h: 0.42, rl: (i) => String(i), title: 'hash table：100 格', rlw: 0.45 });
    const h = 101 % 100; S.sm.put(h, '101', NC.mint); S.sm.fl(h, OKG);
    S.k = ok(h === 1, 'hash(101) = 101 mod 100 = 1 ✓', 2.4, 2.4);
    cap('只挖 100 個洞，hashing function 取 mod 100', '101 除以 100 餘 1 → 放到 1');
  },
  async (tok, S) => { // @829 ~為什麼因為我的physical真的用到的多還少
    gone(S.t1, S.big, S.sm, S.k);
    S.v = bx('virtual：1024 個 page', NC.purple, -3.6, 4.6, 0, 2.8, 2.4); S.f = bx('physical：100 個 frame', NC.green, 3.0, 4.6, 0, 2.8, 1.0);
    cap('Page table 也一樣', 'virtual 有 1024 個 page，frame 只有 100 個');
  },
  async (tok, S) => { // @866 ~我只create 100個而已然後我的page table用一個hashing function
    S.ht = bx('table 只有 100 個 entry', NC.lilac, 0, 2.6, 0, 3.0, 0.6); S.hf = sm('VPN → hash function → 第幾個 entry', 0, 3.3);
    cap('根據 frame 數只 create 100 個 entry', '用 hashing function map 到 table');
  },
  async (tok, S) => { // @883 ~因為很多人就會collision嘛
    S.e = mt('entry：VPN 517 | frame 42', 0, 1.7, 'ptr alt');
    S.t2 = sm('1024 個 map 到 100 個 → 會 collision，所以 entry 要記 page number 和 frame（數值示意）', 0, 1.0);
    cap('多對一會 collision', '所以 entry 要記 page number 和 frame number');
  },
  async (tok, S) => { // @898 ~那這個table多大隻要跟frame的number一樣大就可以了
    S.k2 = good('table 大小 = frame 數（100），不是 page 數（1024）', 0, 0.3);
    cap('Table 只要跟 frame 數一樣大', '1024 個 page、100 個 frame → 100 個 entry');
  },
  async (tok, S) => { // @936 ~就是說衝突的話呢就根據你的hashing要怎麼做
    gone(S.k2); S.t3 = sm('collision：chaining（link list）或 linear probing（找下一個）；比對 VPN 對不上就往下找', 0, 0.3);
    cap('衝突了就用 hashing 的方法解決', 'chaining 或 linear probing');
  },
  async (tok, S) => { // @1019 ~如果28個Bit Virtual Address的話如果4K bytePage的話
    gone(S.v, S.f, S.ht, S.hf, S.e, S.t2, S.t3);
    S.va = fields([{ n: 'VPN', b: 16, c: NC.purple }, { n: 'offset', b: 12, c: NC.orange }], 0, 5.6, { unit: 0.25 });
    S.k3 = ok(INV.pages === 65536 && INV.ratio === 4, '28 − 12 = 16 bits → 2¹⁶ = 64K 個 page；frame 16K → page 是 frame 的 4 倍 ✓', 0, 4.4);
    cap('28-bit virtual address、4K page', '64K 個 page；physical 16K 個 frame');
  },
  async (tok, S) => { // @1068 ~所以他就說如果用Pagetable Size的話你就要64K
    S.a = vbar(NC.purple, -2.0, 3.2, 1.4, 0.2); S.b = vbar(NC.green, 2.0, 0.8, 1.4, 0.2);
    S.l1 = sm('page table：64K entries', -2.0, 3.8); S.l2 = sm('inverted：16K entries', 2.0, 1.4);
    cap('一般 page table 要 64K 個 entry', 'inverted page table 只要 16K 個');
  },
  async (tok, S) => { // @1085 ~就透過hashing function找到
    S.t4 = good('沒有 index 了：透過 hashing function 找到對應的 entry', 0, 0.0);
    cap('對應的位置在哪裡？', '透過 hashing function 找到');
  },
]);

// two-level：老師先講 20-bit page number 拆成兩段（各 2¹⁰），再用 4-bit page number（2 | 2）的小例子
const TWO = (() => { const used = [0, 1]; const flat = 16, two = 4 + used.length * 4; const big = 2 ** 20, bigTwo = 2 ** 10 + used.length * 2 ** 10; return { used, flat, two, big, bigTwo }; })();
scene('cvm-25b-twolevel', 'Two-level page table：用到才展開', [
  async (tok, S) => { // @1127 ~2-level page table
    S.va = fields([{ n: 'page number', b: 20, c: NC.purple }, { n: 'page offset', b: 12, c: NC.orange }], 0, 6.0, { unit: 0.22 });
    S.t1 = sm('全部展開：2²⁰ 個 entry', 0, 5.1);
    cap('Two-level page table', 'page number 有 2²⁰ 個，全部展開就 2²⁰ 個 entry');
  },
  async (tok, S) => { // @1153 ~那22這塊我們可以這樣分
    S.va.kill(); S.va = fields([{ n: '第一層', b: 10, c: NC.blue }, { n: '第二層', b: 10, c: NC.purple }, { n: 'page offset', b: 12, c: NC.orange }], 0, 6.0, { unit: 0.22 });
    cap('把 page number 再切成兩份', '前面那份指到一大塊');
  },
  async (tok, S) => { // @1179 ~它裡面又分為2的十次方
    S.t2 = sm('每一大塊裡面再分 2¹⁰ 個 entry', 0, 5.1); gone(S.t1);
    cap('每一大塊裡面又分 2¹⁰ 個 entry', '');
  },
  async (tok, S) => { // @1193 ~這是two level的
    S.l1 = bx('第一層 table', NC.blue, -4.0, 3.0, 0, 2.0, 1.6); S.l2 = bx('第二層', NC.purple, 0, 3.6, 0, 1.6, 1.0); lk(-3.0, 3.2, -0.8, 3.6);
    cap('更高 level 選哪一大塊', '低一層再 index 到真正的 entry');
  },
  async (tok, S) => { // @1233 ~只要這邊有用的時候我才把它展開
    S.g = bx('（沒用到：不配置）', NC.gray, 0, 2.0, 0, 2.6, 0.6); S.k = ok(TWO.bigTwo < TWO.big, '只用 2 塊：2¹⁰ + 2 × 2¹⁰ = ' + TWO.bigTwo + ' ≪ 2²⁰ = ' + TWO.big + '（示意）✓', 0, 0.8);
    cap('這一塊有用才把它展開', '不要一次全部展開');
  },
  async (tok, S) => { // @1269 ~你看你這個address的關係
    gone(S.va, S.t2, S.l1, S.l2, S.g, S.k);
    S.full = slots(16, -4.2, 6.6, { w: 1.3, h: 0.3, gap: 0.05, rl: (i) => b2(i, 4), rlw: 0.5, color: (i) => [NC.sky, NC.rose, NC.mint, NC.lilac][i >> 2] });
    cap('再講一次：小例子 page number 4 bits', '00 開頭一塊、01 一塊、10、11 各一塊');
  },
  async (tok, S) => { // @1305 ~這是第一塊第0第1所以我這個entry只要幾個entry
    S.top = slots(4, 0, 5.6, { w: 1.6, h: 0.5, rl: (i) => b2(i, 2), rlw: 0.4, title: '第一層：4 個 entry', fill: () => '?' });
    S.k1 = ok(TWO.flat === 16, '全部展開 = 16 個 entry ✓', 0, 2.8);
    cap('第一層只要存 4 個 entry', '全部展開是 16 個');
  },
  async (tok, S) => { // @1329 ~假如這個00有用到這個才展開
    S.top.put(0, '1', NC.mint); S.top.put(1, '1', NC.mint);
    S.s0 = slots(4, 3.6, 6.4, { w: 1.4, h: 0.3, gap: 0.05, rl: (i) => '00' + b2(i, 2), rlw: 0.55, color: () => NC.sky });
    S.s1 = slots(4, 3.6, 4.6, { w: 1.4, h: 0.3, gap: 0.05, rl: (i) => '01' + b2(i, 2), rlw: 0.55, color: () => NC.rose });
    cap('00 有用到才展開', '01 有用到也展開');
  },
  async (tok, S) => { // @1339 ~可是假如這個沒有用到的話
    S.top.put(2, '0', NC.gray); S.top.put(3, '0', NC.gray); S.x = bad('10、11 沒用到 → 不 allocate', 0, 2.1);
    cap('沒用到的這塊', '不需要 allocate');
  },
  async (tok, S) => { // @1348 ~我叫做00011011
    S.t3 = sm('第一層的 bit：1 = 用到（展開）、0 = 沒用到', 0, 1.4);
    cap('第一層記 00、01、10、11 有沒有用到', '1 就是用到，0 就是沒用到');
  },
  async (tok, S) => { // @1373 ~two level的table所以我只要存這個就好了
    S.k2 = ok(TWO.two === 12 && TWO.two < TWO.flat, '4 + 2 × 4 = ' + TWO.two + ' 個 entry < 16 ✓', 0, 0.6);
    cap('只要存第一層這張小表', '有用到再把第二層 table 展開');
  },
], [[0, 3.6, 14.5], [0, 3.2, 0]]);

scene('cvm-25b-tlb', 'Page table 太慢：translation look-aside buffer（TLB）', [
  async (tok, S) => { // @1398 ~所以剛剛講過page table太大
    S.t0 = hot('太大 → 上面的方法；太慢 → TLB', 0, 6.7);
    cap('Page table 太大有方法 handle', '太慢呢？用 translation look-aside buffer');
  },
  async (tok, S) => { // @1416 ~很直覺的你可以想到說page table你是存在man memory裡面
    S.cpu = bx('CPU', NC.teal, -4.6, 4.4, 0, 1.6, 0.9); S.mem = bx('Main memory', NC.tan, 3.0, 4.4, 0, 2.6, 2.2);
    S.pt = bx('page table', NC.lilac, 3.0, 5.0, 0.5, 2.0, 0.5);
    cap('Page table 存在 main memory', '每次 translation 都要去那邊拿 entry');
  },
  async (tok, S) => { // @1431 ~但page就這麼大對不對
    S.t1 = sm('page 有 1024、2048 個 byte → 連續的 address 都用同一個 translation', 0, 2.4);
    cap('Page 很大（1024、2048 bytes）', '用到這個 address，下一個多半同一個 entry');
  },
  async (tok, S) => { // @1446 ~那為什麼不把這個entry
    S.e = bx('entry', NC.lilac, 3.0, 5.0, 0.9, 1.0, 0.4); await slide(tok, S.e, -2.4, 4.4, 0.6, 800);
    cap('為什麼不把這個 entry', '放到 CPU 旁邊，緊緊靠著我');
  },
  async (tok, S) => { // @1455 ~所以buffer一開始的時候真的是只有一個buffer而已
    S.t2 = good('最早只有一個 entry 的 buffer，就已經省掉很多事', -2.4, 5.4);
    cap('一開始真的只有一個 buffer', '一個 entry 就已經打敗很多事情');
  },
  async (tok, S) => { // @1474 ~當我access0100的時候我要做translation
    S.t3 = sm('access 0100、0101、0110… 都要 translation，查的都是同一個 entry', 0, 1.6);
    cap('連續 access 同一個 page 的地址', '每次都要 translation，用的都是同一個 entry');
  },
  async (tok, S) => { // @1497 ~那也就是一個cache的觀念
    relabel(S.e, 'TLB'); tint(S.e, NC.blue);
    cap('其實就是 cache 的觀念', 'Translation look-aside buffer（TLB）');
  },
  async (tok, S) => { // @1511 ~我要每一個memory operation你都要兩次的memory operation
    gone(S.t1, S.t2, S.t3); S.t4 = bad('沒有 TLB：① 讀 page table entry　② 真正的 memory access', 0, 1.6);
    cap('沒有 TLB：每次 memory operation 要兩次', '一次讀 page table entry，一次真正 access');
  },
  async (tok, S) => { // @1557 ~Hardware做的事情
    S.t5 = sm('TLB 是 hardware：OS（software）沒辦法做這麼快的事', 0, 0.9);
    cap('這是 hardware 做的', 'OS 沒辦法，hardware 要幫忙');
  },
  async (tok, S) => { // @1571 ~只是演變到後來因為Hardware很便宜啦
    S.tl = slots(4, -2.4, 3.5, { w: 1.6, h: 0.3, gap: 0.05, color: () => NC.blue }); kill(S.e);
    cap('Hardware 很便宜了', '多放幾個 entry，organize 成像 cache 一樣');
  },
  async (tok, S) => { // @1632 ~我每次要去translation的時候我先到這邊看看說這在不在這邊
    S.tl.fl(1, OKG); S.t6 = good('先查 TLB：在 → 已經翻好，直接 access main memory', 0, 0.2);
    cap('每次 translation 先看 TLB', '在的話就直接去 main memory access');
  },
  async (tok, S) => { // @1649 ~如果TLB Miss
    S.tl.calm(); gone(S.t6); glow(S.pt, HL); S.t7 = bad('TLB miss → 才去 main memory 查 page table，再去拿東西', 0, 0.2);
    cap('TLB miss 不在裡面', '才去 main memory 查 page table，再去拿東西');
  },
]);

scene('cvm-25b-tlbmore', 'TLB 細節：MMU、hit rate、dirty bit、兩種 TLB miss', [
  async (tok, S) => { // @1665 ~就是一些常常用的PageTable的Entry
    S.cpu = bx('CPU', NC.teal, -5.0, 5.4, 0, 1.4, 0.8); S.tlb = bx('TLB', NC.blue, -2.8, 5.4, 0, 1.6, 0.8);
    S.mem = bx('Main memory', NC.tan, 3.0, 4.6, 0, 3.0, 2.6); S.pt = bx('page table', NC.lilac, 3.0, 5.4, 0.6, 2.4, 0.5);
    S.mem.userData.lbl.center.set(0, 0.5); S.mem.userData.lbl.position.set(1.6, -1.0, 0); // name beside the box's lower right: its contents fill the box
    cap('TLB：常用的 page table entry', '放在 CPU 旁邊');
  },
  async (tok, S) => { // @1683 ~所以這樣的話去Memory Reference就reduce了一個
    glow(S.tlb, OKG); S.t1 = good('TLB hit：只剩 1 次 memory reference', -2.8, 6.3);
    cap('TLB hit：不用 reference page table', '只剩一次 memory reference');
  },
  async (tok, S) => { // @1693 ~Miss就沒在裡面
    glow(S.tlb, NG); glow(S.pt, HL); gone(S.t1);
    cap('Miss：還是要去 memory 裡的 page table', '找到 translation 再去 physical address');
  },
  async (tok, S) => { // @1709 ~main memory 簽了好多塊
    glow(S.tlb, null); glow(S.pt, null);
    S.pf = ['P1 的 frames', 'P2 的 frames'].map((t, i) => bx(t, [NC.sky, NC.rose][i], 3.0, 4.4 - i * 0.65, 0.6, 2.4, 0.5));
    cap('Main memory 分好多塊', '一塊給 page table，一塊給各個 process 的 frame');
  },
  async (tok, S) => { // @1732 ~Memory Management Unit
    S.mmu = ghostBoxAt(-3.9, 5.4, 3.6, 1.5); S.l = hd('MMU（在 CPU 這一端）', -3.9, 6.5);
    cap('TLB 在 memory management unit（MMU）', '在 CPU 這端，不在 DRAM 那端');
  },
  async (tok, S) => { // @1752 ~可以organize成一個fully associated或set associated都可以的
    S.t2 = sm('organize 成 fully associative 或 set associative', -3.0, 3.6);
    cap('TLB 有很多 entry', '可以 organize 成 fully 或 set associative');
  },
  async (tok, S) => { // @1759 ~它的hit rate你看很高
    S.t3 = good('miss rate 只有 0.01%～1%：每個 page 的 locality 很高', -3.0, 3.0);
    cap('Hit rate 很高', 'miss rate 只有 0.01% 到 1%');
  },
  async (tok, S) => { // @1775 ~tlb的miss的話可以用hardware也可以用software來處理
    S.t4 = sm('TLB miss：hardware 處理，或跳到 OS（interrupt）讓 software 處理', -3.0, 2.4);
    cap('TLB miss 可以用 hardware', '也可以 interrupt 跳到 OS 用 software');
  },
  async (tok, S) => { // @1790 ~hit如果read就OK了那如果是write呢
    gone(S.t2, S.t3, S.t4); S.t5 = hot('TLB hit：read 就 OK；write 呢？', -3.0, 3.6);
    cap('TLB hit：read 就 OK', 'write 不要忘記 dirty bit');
  },
  async (tok, S) => { // @1798 ~因為TLB的entry只是PageTable的一個copy
    S.d = bx('dirty = 1（記在 TLB）', NC.rose, -2.8, 4.5, 0.6, 2.4, 0.45);
    S.t6 = sm('TLB entry 是 page table 的 copy；每次寫都去改 memory 裡的 page table 太慢', -3.0, 2.9);
    cap('TLB entry 只是 page table 的一個 copy', 'dirty bit 先 set 在 TLB，不每次寫回 memory');
  },
  async (tok, S) => { // @1830 ~這個在TLB這邊只有當這個page寫回去的時候
    await slide(tok, S.d, 3.0, 6.1, 0.6, 800);
    S.t7 = sm('TLB entry 被 replace（或 page 被換掉）時，才把 dirty 寫回 page table', -3.0, 2.2);
    cap('TLB entry 被 replace 時', '才把 dirty 的資訊寫回 page table');
  },
  async (tok, S) => { // @1861 ~TLB的entry不在這裡面是一個是它只是translation不在
    gone(S.t5, S.t6, S.t7); S.c1 = hot('TLB miss 情況一：page 在 memory，只是 translation 沒搬上來', -1.0, 1.5);
    cap('TLB miss 第一種：只是 translation 不在 TLB', '從 page table 搬上來就好');
  },
  async (tok, S) => { // @1875 ~那另外一種狀況是甚麼這個Page根本就不在
    S.c2 = bad('情況二：page 根本不在 memory → page table 也沒有 → page fault', -1.0, 0.8);
    cap('第二種：page 根本不在 memory', '那就是 page fault');
  },
  async (tok, S) => { // @1923 ~所以它說在tlb miss有兩種層
    S.c3 = sm('兩個層次：TLB ⊂ page table；不在 page table 的，更不可能在 TLB', -1.0, 0.1);
    cap('TLB miss 有兩種層次', '一種補 translation，一種照 page fault 處理');
  },
  async (tok, S) => { // @1958 ~所以我們handle page table太大有一些機子
    gone(S.c1, S.c2, S.c3); S.s = good('太大 → limit、hashing、multi-level；太慢 → TLB', 0, 1.0);
    cap('整理：page table 太大有一些機制', 'access 太慢用 TLB');
  },
  async (tok, S) => { // @1986 ~就把常常用的Translation放在CPU的附近
    S.s2 = sm('TLB：常用的 translation 放 CPU 附近，省掉每次多一次的 memory access', 0, 0.3);
    cap('TLB 是什麼？', '常用的 translation 放 CPU 附近');
  },
]);

scene('cvm-25b-tlbcache', 'TLB 與 cache：最好一次 memory access 都不用', [
  async (tok, S) => { // @2016 ~我們轉成的physical address並不是真的去memory拿
    S.cpu = bx('CPU', NC.teal, -5.4, 4.6, 0, 1.2, 0.8); S.tlb = bx('TLB', NC.blue, -3.0, 4.6, 0, 1.4, 0.8);
    S.c = bx('Cache', NC.green, 0.0, 4.6, 0, 1.6, 0.8); S.m = bx('Main memory', NC.tan, 3.6, 4.6, 0, 2.6, 1.6);
    S.pt = bx('page table', NC.lilac, 3.6, 5.0, 0.5, 2.0, 0.45);
    cap('轉成 physical address 後真的去 memory 拿嗎？', '上面還有一層 cache');
  },
  async (tok, S) => { // @2033 ~其實TLB跟cash都是加速的
    S.t1 = good('TLB 和 cache 都是為了加速 access', 0, 6.4);
    cap('TLB 和 cache 都是加速用的', '');
  },
  async (tok, S) => { // @2038 ~到page table去拿一個entry
    S.r = list(0, 2.6, 0.55); S.r.add('沒有 TLB、沒有 cache：page table（memory）→ PA → memory：2 次');
    glow(S.pt, HL); glow(S.m, HL);
    cap('正常（沒 TLB 也沒 cache）', 'page table 拿 entry → PA → memory access');
  },
  async (tok, S) => { // @2050 ~那有tlb怎麼樣你要去translation趕快去tlb看一看
    glow(S.pt, null); glow(S.tlb, OKG); S.r.add('有 TLB：translation 在 TLB 做完');
    cap('有 TLB：translation 先去 TLB 看', '有在那邊就得到 physical address');
  },
  async (tok, S) => { // @2061 ~如果沒有cash當然就要去memory拿東西
    glow(S.c, OKG); glow(S.m, null); S.r.add('有 cache：拿 PA 去 cache 檢查，有就不用去 memory');
    cap('有 cache：拿 physical address', '先去 cache 檢查');
  },
  async (tok, S) => { // @2072 ~所以如果你加了tlb又加了catch
    S.k = ok(true, 'TLB hit + cache hit → 0 次 memory access ✓', 0, 0.9);
    cap('TLB 又加 cache', '最後可能一個 memory access 都不要');
  },
  async (tok, S) => { // @2116 ~我們看這個圖所以CPU發出一個virtual address
    gone(S.r, S.k, S.t1); glow(S.tlb, null); glow(S.c, null);
    S.dot = bx('VA', NC.purple, -5.4, 5.5, 0.5, 0.8, 0.4);
    await slide(tok, S.dot, -3.0, 5.5, 0.5, 500); glow(S.tlb, OKG); relabel(S.dot, 'PA');
    await slide(tok, S.dot, 0, 5.5, 0.5, 500); glow(S.c, OKG);
    S.p1 = good('最好的路徑：TLB hit → cache hit → data 傳給 CPU', 0, 2.6);
    cap('CPU 發 VA → TLB hit 得到 PA', '先到 cache 看：hit 就直接傳給 CPU');
  },
  async (tok, S) => { // @2144 ~TLB Lookup不在這個entry不在
    glow(S.tlb, NG); glow(S.pt, HL);
    S.p2 = sm('TLB miss：去 memory 做 translation，再去 cache 看（只是 translation 不在）', 0, 1.9);
    cap('TLB miss：去 memory 找 translation', '找到 PA 再去 cache 看');
  },
  async (tok, S) => { // @2171 ~不管這邊Translation過來經過TLB Hit或TLB Miss
    glow(S.c, NG); glow(S.m, HL); S.p3 = sm('cache miss：到 memory 把 block 搬進來', 0, 1.3);
    cap('不管 TLB hit 或 miss，拿到 PA 去 cache', 'cache miss 就到 memory 把東西搬進來');
  },
  async (tok, S) => { // @2185 ~那這個都是還沒有page fault的狀況
    S.p4 = sm('以上都還沒 page fault（東西都在 main memory）；而且是 sequential：先翻譯、再查 cache', 0, 0.7);
    cap('這些都還沒 page fault', '先只看 translation 和 cache，sequential 地走');
  },
  async (tok, S) => { // @2221 ~Virtual Address Page Offset你先用這個Virtual Page Number
    gone(S.cpu, S.tlb, S.c, S.m, S.pt, S.dot, S.p1, S.p2, S.p3, S.p4);
    S.va = fields([{ n: 'virtual page number', b: 20, c: NC.purple }, { n: 'page offset', b: 12, c: NC.orange }], 0, 6.2, { unit: 0.2 });
    S.t = bx('TLB（少少的 entry）', NC.blue, -1.0, 4.8, 0, 2.6, 0.6); lk(-1.0, 5.8, -1.0, 5.15);
    cap('VPN 經過 TLB（少少的 entry）', '很快告訴你 physical page number');
  },
  async (tok, S) => { // @2244 ~所以這兩個加起來就是一個physical address了
    S.pa = fields([{ n: 'physical page number', b: 18, c: NC.green }, { n: 'page offset', b: 12, c: NC.orange }], 0, 3.4, { unit: 0.2 });
    cap('Physical page number + page offset', '加起來就是 physical address');
  },
  async (tok, S) => { // @2252 ~對應就是access cache前半部後半部就是就index啊
    S.ca = fields([{ n: 'cache tag', b: 16, c: NC.pink }, { n: 'cache index', b: 10, c: NC.sky }, { n: 'block offset', b: 4, c: NC.rose }], 0, 1.6, { unit: 0.2 });
    S.n = sm('（cache 的 bit 數為示意）', 4.6, 0.8);
    cap('PA 去 access cache：後半段當 index', '前半段當 tag 比對（direct map 或 set associative）');
  },
  async (tok, S) => { // @2274 ~就是把少量的entry放在TLB裡面
    S.s = good('最快：TLB 翻好 PA → 用 PA 的 index 查 cache、tag 比對', 0, 0.3);
    cap('最快的狀況就是這樣', 'TLB 轉成 PA，再用 PA 去 access cache');
  },
], [[0, 3.6, 14.5], [0, 3.2, 0]]);

scene('cvm-25b-flow', 'TLB + cache 流程圖：read、write、protection', [
  async (tok, S) => { // @2307 ~TLB access TLB hit
    S.f = {};
    S.f.tlb = bx('TLB access', NC.blue, -4.6, 6.0, 0, 2.0, 0.55); S.f.hit = bx('TLB hit?', NC.sky, -4.6, 4.9, 0, 1.8, 0.5);
    cap('流程圖：先 TLB access', 'hit 還是 miss？');
  },
  async (tok, S) => { // @2318 ~是write如果不是write就是read就access cache
    S.f.w = bx('write?', NC.sky, -1.6, 4.9, 0, 1.4, 0.5); lk(-3.6, 4.9, -2.4, 4.9);
    S.f.rd = bx('read：access cache', NC.green, -1.6, 3.7, 0, 2.6, 0.5);
    cap('Hit 的話，看是不是 write', '不是 write 就是 read → access cache');
  },
  async (tok, S) => { // @2321 ~如果cache hit yes就data從cache拿過來
    S.f.ch = good('cache hit → data 給 CPU', -1.6, 2.8); S.f.cm = bad('cache miss → stall', -1.6, 2.2);
    cap('Cache hit：data 從 cache 拿過來', '不是的話 cache miss，stall');
  },
  async (tok, S) => { // @2338 ~硬體是用硬體CPU是停下來並沒有把它放棄
    S.t1 = sm('cache miss 用 hardware 處理：CPU stall 幾個 cycle，不放棄 CPU（交給 OS 反而更慢）', 0, 1.2);
    cap('Cache miss 用 hardware 處理', 'CPU 停下來等，不放棄（幾個 cycle 可以忍）');
  },
  async (tok, S) => { // @2364 ~那如果是write是yes的話你先看有沒有write access的權利
    S.f.wa = bx('write access bit on?', NC.gold, 2.6, 4.9, 0, 2.6, 0.5); lk(-0.8, 4.9, 1.3, 4.9);
    cap('Write：先看有沒有 write access 的權利', '');
  },
  async (tok, S) => { // @2368 ~如果沒有的話就當著protection
    S.f.pe = bad('沒有 → write protection exception（OS 介入）', 2.6, 6.0);
    cap('沒有權利：protection exception', 'OS interrupt，你不可以寫這個地方');
  },
  async (tok, S) => { // @2377 ~去access data cache hit的話yes就去write它
    S.f.wc = bx('有 → 寫 cache：hit 就寫入、設 dirty 等 bit；miss → cache miss 處理', NC.mint, 2.6, 3.7, 0, 4.6, 0.5);
    cap('有權利：access cache', 'hit 就寫進去、set bits；miss 就照 cache miss 處理');
  },
  async (tok, S) => { // @2389 ~所以TLB跟cache的整個概念其實就是我完全不要main memory的話
    gone(S.t1, S.f.ch, S.f.cm); S.t2 = good('希望大部分都走：TLB hit → cache hit（完全不碰 main memory）', -1.6, 2.6);
    cap('希望大部分都走這條', 'TLB hit、cache hit，一次 memory access 都不要');
  },
  async (tok, S) => { // @2429 ~我們可以看到如果到memory再有更多的時間
    S.c = [['TLB + cache', 1, NC.green], ['到 memory', 3, NC.orange], ['page fault', 6, NC.red]].map(([t, h, c], i) => { const x = 1.4 + i * 1.9; const b = vbar(c, x, h * 0.3, 1.0, 0); sm(t, x, h * 0.3 + 0.3); return b; });
    S.n = sm('（長條高度只是示意）', 3.3, -0.4);
    cap('只在這裡 loop：一兩個 cycle', '到 memory 要更多的 cycle');
  },
  async (tok, S) => { // @2440 ~那如果超過這memory連東西都不在memory
    S.t3 = bad('連 memory 都沒有 → page fault：million cycles → 用 OS', -2.6, 1.4);
    cap('連 memory 都沒有：page fault', '要 million cycle，所以交給 OS（software）');
  },
  async (tok, S) => { // @2477 ~Cash是用Hardware然後Cash Miss是用Hardware
    S.t4 = hot('cache、cache miss：hardware　｜　page fault：software', 0, 6.9);
    cap('Cache miss 用 hardware', 'page fault 用 software：penalty 很大');
  },
], [[0, 3.6, 14.5], [0, 3.0, 0]]);

// 老師點名問的組合（照順序），可能 / 不可能 由 COMBO 表判斷
const CB25 = [['hit', 'hit', 'miss'], ['miss', 'hit', 'hit'], ['miss', 'hit', 'miss'], ['miss', 'miss', 'miss'], ['hit', 'miss', 'miss'], ['hit', 'miss', 'hit'], ['miss', 'miss', 'hit']];
const CB25_ANS = [true, true, true, true, false, false, false];
scene('cvm-25b-combos', 'TLB／page table／cache：哪些組合可能發生', [
  async (tok, S) => { // @2492 ~那我們來看看說這個所有的Combination
    S.b = { t: bx('TLB', NC.blue, -4.0, 5.2, 0, 2.2, 0.9), p: bx('Page table', NC.purple, 0, 5.2, 0, 2.2, 0.9), c: bx('Cache', NC.green, 4.0, 5.2, 0, 2.2, 0.9) };
    S.l = { t: tag('', 'ptr', -4.0, 4.2), p: tag('', 'ptr', 0, 4.2), c: tag('', 'ptr', 4.0, 4.2) };
    S.res = list(0, 3.2, 0.48);
    cap('所有的 combination', '有沒有可能發生？');
  },
  ...CB25.map((k, i) => async (tok, S) => { // @2524, 2566, 2615, 2637, 2701, 2754, 2818
    const [t, p, c] = k; const yes = combo(t, p, c);
    glow(S.b.t, t === 'hit' ? OKG : NG); glow(S.b.p, p === 'hit' ? OKG : NG); glow(S.b.c, c === 'hit' ? OKG : NG);
    txt(S.l.t, t); txt(S.l.p, p === 'hit' ? 'hit' : 'miss（page fault）'); txt(S.l.c, c);
    S.res.add('TLB ' + t + '、PT ' + p + '、cache ' + c + ' → ' + (yes ? '可能' : '不可能') + (yes === CB25_ANS[i] ? ' ✓' : ' ✘'), yes ? 'good' : 'bad');
    if (yes !== CB25_ANS[i]) log('CHECK FAILED combo ' + k.join(','), true);
    cap('TLB ' + t + '、page table ' + p + '、cache ' + c, [
      '可能：data 不在 cache（TLB hit 時 page table 根本不查）',
      '可能：translation 第一次用，cache 裡剛好已有資料',
      '可能：translation 和 data 都還沒搬上來',
      '可能：entry 不在 page table → page fault',
      '不可能：TLB 只是 page table 的一小部分',
      '不可能：TLB hit，page table 就一定 hit',
      '不可能：page 不在 memory，怎麼會在 cache',
    ][i]);
  }),
], [[0, 3.6, 14.5], [0, 3.0, 0]]);
// a translucent box marking a region (MMU)
function ghostBoxAt(x, y, w, h) { const g = P.ghostBox('#4b9ee2', w, h, 1.2); g.position.set(x, y, 0); return g; }

// ════════ Jtulk55Q1Ls（第 26A 講：複習、virtually addressed cache、virtually indexed physically tagged、protection、共同架構、3C、cache FSM 入門） ════════
scene('cvm-26a-recap', '複習：page table、TLB、cache 用 physical address', [
  async (tok, S) => { // @19 ~那我們知道Virtual Memory的這個系統在Hierarchy是最後面一層
    S.ps = ['P1', 'P2', 'P3'].map((p, i) => bx(p + ' 的 virtual space', [NC.sky, NC.lilac, NC.rose][i], -4.6, 6.0 - i * 0.75, 0, 2.6, 0.55));
    S.m = bx('Physical memory', NC.tan, 0.6, 5.2, 0, 2.6, 2.0);
    cap('Virtual memory 是 hierarchy 最後一層', '每個 program 有自己的 VA space，share 一塊 physical');
  },
  async (tok, S) => { // @46 ~每一個program因為也是有locality
    S.d = bx('Disk：swap space', NC.metal, 4.8, 5.2, 0, 2.2, 2.0);
    cap('因為 locality，只搬需要的進 main memory', '整個 virtual space 放在 disk 的 swap space');
  },
  async (tok, S) => { // @76 ~那這時候呢因為Secondary跟MainMemory的Penalty很大
    S.t1 = sm('penalty 很大 → 搬進搬出的單位是 page（1K、4K bytes）', 0, 3.6);
    cap('Penalty 很大', '所以搬進搬出的 page 很大：1K、4K');
  },
  async (tok, S) => { // @101 ~所以我們用Fully Associated
    S.t2 = sm('fully associative：只要有位置就可以放', 0, 3.0);
    cap('用 fully associative', '只要有位置就可以擺進去');
  },
  async (tok, S) => { // @111 ~我們要Access一個一個就是一個Virtual Address給你的話
    gone(S.ps, S.d, S.t1, S.t2); relabel(S.m, ''); S.m.position.set(3.0, 4.6, 0);
    S.pt = bx('page table（在 memory）', NC.lilac, 3.0, 5.2, 0.6, 2.4, 0.5); S.dt = bx('data', NC.sky, 3.0, 4.0, 0.6, 2.4, 0.5);
    S.va = bx('VA', NC.purple, -4.6, 5.2, 0, 1.0, 0.5); lk(-4.0, 5.2, 1.7, 5.2);
    cap('給一個 virtual address', '先去 memory 裡的 page table 找 entry');
  },
  async (tok, S) => { // @153 ~還記不記得我們說page number會對於一個frame number
    S.f = fields([{ n: 'frame number', b: 18, c: NC.green }, { n: 'page offset', b: 12, c: NC.orange }], -1.6, 2.6, { unit: 0.15, noBits: true });
    cap('Page number → frame number（high-order）', '加上 page offset（low-order）= physical address');
  },
  async (tok, S) => { // @168 ~然後找到這個Physical哪裡還要再去Access這個Memory一次
    glow(S.dt, HL); S.t3 = bad('正常要 2 次 memory access：page table + data', -1.6, 1.6);
    cap('拿到 physical address 還要再 access 一次', '正常要兩次 memory access');
  },
  async (tok, S) => { // @184 ~那我們說未來加速啊
    gone(S.t3, S.f); glow(S.dt, null);
    S.c = bx('cache', NC.green, -1.4, 4.0, 0, 1.6, 0.6); S.t4 = sm('常被 access 的 data → 放 cache', -1.4, 3.2);
    cap('加速：常被 access 的 data', '放在 cache 上');
  },
  async (tok, S) => { // @220 ~那同樣的道理我們剛剛說因為要兩個access
    S.tlb = bx('TLB', NC.blue, -1.4, 6.0, 0, 1.6, 0.6); S.t5 = sm('常用的 translation → 放 TLB（CPU 旁邊）', -1.4, 6.7);
    cap('Translation 也常常用到', '就放在 CPU 旁邊：TLB');
  },
  async (tok, S) => { // @243 ~其實雖然是正常狀況是要兩個access
    glow(S.tlb, OKG); glow(S.c, OKG); S.t6 = good('TLB + cache → 一個 memory access 都不需要', -1.4, 1.8);
    cap('靠 TLB 和 cache', '兩個 memory access 最後一個都不需要');
  },
  async (tok, S) => { // @276 ~Cache的address是什麼address
    gone(S.t6); S.t7 = hot('cache 用 physical address：很多 process，但 physical 只有一個 → unique', 0, 1.2);
    cap('Cache 的 address 是什麼 address？', 'physical address：只有一個，所以 unique');
  },
  async (tok, S) => { // @310 ~那所以它需要經過translation
    glow(S.tlb, HL); glow(S.c, null); S.t8 = sm('所以要先 translation（TLB，miss 再查 page table）→ 才能查 cache：sequential', 0, 0.5);
    cap('所以要先經過 translation', 'TLB hit 拿到 PA 才 access cache；miss 要去 memory');
  },
]);

scene('cvm-26a-vcache', 'Virtually addressed cache：快，但有兩個問題', [
  async (tok, S) => { // @348 ~那有沒有可能說我把這兩個同時做
    S.seq = [bx('translation', NC.blue, -3.4, 6.0, 0, 2.4, 0.55), bx('cache access', NC.green, -0.8, 6.0, 0, 2.4, 0.55)];
    S.t1 = sm('sequential：時間拉長', -2.1, 6.75);
    cap('先 translation 再查 cache，時間拉長', '有沒有可能同時做？');
  },
  async (tok, S) => { // @374 ~我就要cache要用virtual address去access
    S.vc = bx('virtually addressed cache', NC.green, 3.4, 4.6, 0, 3.4, 0.7);
    cap('Cache 用 virtual address 去 access', 'cache 裡擺的就是 virtual address');
  },
  async (tok, S) => { // @389 ~我就就直接去access cache
    glow(S.vc, OKG); S.t2 = good('hit → 直接拿，完全不用 translation', 3.4, 5.5);
    cap('直接拿 VA 去 cache', 'hit 就結束了，不用 translation');
  },
  async (tok, S) => { // @399 ~如果沒有的話我才要透過translation到fiscal
    glow(S.vc, NG); gone(S.t2); S.t3 = sm('miss 才 translation → 去 memory 拿 → 搬進 cache', 3.4, 5.5);
    cap('Miss 才要做 translation', '到 main memory 把東西搬進 cache');
  },
  async (tok, S) => { // @440 ~但是天下有這麼容易的事情嗎
    glow(S.vc, null); S.t4 = bad('天下有這麼容易的事嗎？', 3.4, 3.7);
    cap('可以同時做', '但天下有這麼容易的事情嗎？');
  },
  async (tok, S) => { // @471 ~第一個問題就是說這cache是shared
    gone(S.seq, S.t1, S.t3, S.t4);
    S.p = [bx('Process 0', NC.sky, -4.6, 5.6, 0, 1.8, 0.55), bx('Process 1', NC.rose, -4.6, 4.2, 0, 1.8, 0.55)];
    cap('問題一：cache 是 shared', 'multiprogramming 下好幾個 process 輪流用');
  },
  async (tok, S) => { // @497 ~你現在說第八那你也是第八這兩個是一樣的東西嗎
    S.a = [sm('VA 8 → 自己的資料 A', -1.8, 5.6), sm('VA 8 → 自己的資料 B', -1.8, 4.2)];
    S.x = bad('同一個 VA 8，不同 data → 不 unique（數值示意）', 0, 3.2);
    cap('你說第 8 個，他也說第 8 個', '同一個 address 不是同一個 data');
  },
  async (tok, S) => { // @532 ~因為我們Process都有一個ID
    gone(S.x); S.tg = [mt('tag = (PID 0, VA 8)', 2.4, 5.6, 'ptr alt'), mt('tag = (PID 1, VA 8)', 2.4, 4.2, 'ptr alt')];
    S.k = good('tag 加上 process ID → 變 unique', 0, 3.2);
    cap('解法：每個 process 有 ID', '把 ID 加進 tag，就知道是誰的');
  },
  async (tok, S) => { // @569 ~還有第二個問題是什麼因為physical address可能被shared
    gone(S.k, S.tg, S.a); S.vc.position.set(3.4, 6.4, 0); S.ph = bx('同一個 physical location', NC.tan, 2.6, 4.9, 0, 3.2, 0.6); // the cache moves up to make room
    lk(-3.6, 5.6, 1.0, 5.0); lk(-3.6, 4.2, 1.0, 4.8);
    cap('問題二：physical address 可能被 shared', '兩個 virtual address map 到同一個 physical');
  },
  async (tok, S) => { // @603 ~那你就要確保呢當你做update的時候
    S.t5 = bad('cache 裡兩份 copy：update 一份，另一份也要 update → 需要很多 hardware（consistency）', 0, 3.4);
    cap('Cache 裡同一個 physical 有兩份 copy', 'update 時全部 copy 都要更新，需要很多 hardware');
  },
  async (tok, S) => { // @629 ~它有好處它可以同時做但是呢
    S.t6 = sm('好處：可同時做；缺點：要處理 process 區分與 aliasing，很多 hardware', 0, 2.6);
    cap('Virtually addressed cache 的好處：同時做', '但要很多 hardware 處理這些問題');
  },
]);

// VIPT：老師的 cache block 4 bytes（2 bits）；page 4 KiB、index 10 bits 是示意 → 2 + 10 ≤ 12 才能和 TLB 同時做
const VI = (() => { const pageOff = 12, blkOff = 2, idx = 10; return { pageOff, blkOff, idx, tag: 32 - blkOff - idx, fits: blkOff + idx <= pageOff, cache: 2 ** idx * 2 ** blkOff }; })();
scene('cvm-26a-vipt', 'Virtually indexed, physically tagged：index 落在 page offset 裡', [
  async (tok, S) => { // @649 ~他說好那我就可以把我們可以把它做一個稍微一些變化
    S.t0 = hot('變形：virtually indexed, physically tagged', 0, 6.9);
    cap('另一個方法：稍微變化一下', 'virtually indexed, physically tagged');
  },
  async (tok, S) => { // @667 ~其實基本上cache的還是physical address去access它
    S.t1 = sm('cache 還是用 physical address 標示 → unique，沒有 aliasing 問題', 0, 6.3);
    cap('Cache 基本上還是用 physical address', '只要是 physical 就 unique');
  },
  async (tok, S) => { // @696 ~我們看到這個address translation假如這是一個TLB
    S.va = fields([{ n: 'virtual page number', b: 20, c: NC.purple }, { n: 'page offset', b: VI.pageOff, c: NC.orange }], 0, 5.0, { unit: 0.2 });
    S.pa = fields([{ n: 'frame number（會變）', b: 20, c: NC.green }, { n: 'page offset（不變）', b: VI.pageOff, c: NC.orange }], 0, 3.6, { unit: 0.2 });
    cap('TLB：page number → frame number', 'page offset 不會變');
  },
  async (tok, S) => { // @734 ~這個cache的地址我們通常是用一部分
    S.ca = fields([{ n: 'tag', b: VI.tag, c: NC.pink }, { n: 'index', b: VI.idx, c: NC.sky }, { n: 'block offset', b: VI.blkOff, c: NC.rose }], 0, 1.8, { unit: 0.2 });
    S.n = sm('（index 10 bits 為示意）', 4.8, 0.9);
    cap('Cache 的地址：block 4 bytes', '最後 2 bits 是 block offset，不理它');
  },
  async (tok, S) => { // @760 ~那我把這個block number的這個low order的bit當作一個index
    S.ca.fl(1); cap('Block number 的 low-order bits 當 index', '剩下的是 tag');
  },
  async (tok, S) => { // @785 ~如果說我要做這個這個跟這個是同時做的
    S.pa.fl(0, NG); S.t2 = bad('index 若用到會變的 frame number → 不正確，要等 translation 完', 0, 0.6);
    cap('如果 index 用到會變的部分', '就要等 translation 做完才能 access cache');
  },
  async (tok, S) => { // @862 ~32個幣的地址的話這個地方是我的index
    gone(S.t2); S.pa.fl(0, null);
    S.t3 = sm('換個角度：translation 只會改 frame number 那一段', 0, 0.6);
    cap('換個角度看 32-bit 的地址', 'translation 會變的只有前面那一段');
  },
  async (tok, S) => { // @966 ~所以我才說我要sequential
    S.t4 = bad('沒 translation 就不知道 PA → sequential → 很慢', 0, -0.1);
    cap('沒 translation 就不知道 physical address', '所以 sequential，很慢');
  },
  async (tok, S) => { // @1001 ~translation的時候變的是哪裡啊
    gone(S.t3, S.t4); S.pa.fl(0); S.pa.fl(1, OKG);
    cap('Translation 變的是哪裡？', '只有 frame number 那一小塊，page offset 不變');
  },
  async (tok, S) => { // @1018 ~那所以我如果能夠把page size變大的話
    S.ca.fl(1, OKG); S.ca.fl(2, OKG);
    S.k = ok(VI.fits, 'block offset ' + VI.blkOff + ' + index ' + VI.idx + ' = ' + (VI.blkOff + VI.idx) + ' ≤ page offset ' + VI.pageOff + ' ✓', 0, 0.6);
    cap('把 page size 變大', 'index 就落在不變的 page offset 裡');
  },
  async (tok, S) => { // @1050 ~那我就用這個virtual address去access這個cache
    S.t5 = good('index 在 VA、PA 都一樣 → 直接用 VA 的 index 去 access cache', 0, -0.1);
    cap('Index 部分 virtual 和 physical 一樣', '直接用 virtual address 去 access cache');
  },
  async (tok, S) => { // @1060 ~他access出來他就得到一個tag
    gone(S.t5); S.rd = bx('讀出 tag（physical）', NC.pink, -3.6, -0.1, 0, 2.6, 0.5); S.tl = bx('TLB 同時翻譯', NC.blue, 0.6, -0.1, 0, 2.6, 0.5);
    cap('Cache 讀出 tag 要時間', '同時 TLB 也在做 translation');
  },
  async (tok, S) => { // @1080 ~我這就可以比對啦我就沒浪費時間啊
    S.cmp = bx('比對', NC.gold, 4.4, -0.1, 0, 1.4, 0.5); glow(S.cmp, OKG);
    cap('Tag 讀出來，translation 也做完', '馬上比對，沒浪費時間');
  },
  async (tok, S) => { // @1138 ~也就是說這樣子就virtually index
    S.n2 = hot('virtually indexed（index 和 VA 相同）, physically tagged（tag 是 PA）', 0, -0.8);
    cap('Index 部分跟 virtual 一樣：virtually indexed', '其實 cache 還是 physical address');
  },
  async (tok, S) => { // @1180 ~所以假如一個地址一個給你一個virtual just給你
    gone(S.n2); S.va.fl(1); S.va.fl(0, HL);
    cap('給你一個 virtual address', 'page offset 部分拿去 index；page number 去 TLB');
  },
  async (tok, S) => { // @1203 ~那這個得到的是什麼東西呢比對
    S.va.fl(0, null); S.va.fl(1, null); S.t6 = good('PA 的 tag == cache 讀出的 tag 且 valid → hit，資料給 CPU', 0, -0.8);
    cap('Translation 好了就比對', 'tag 一樣又 valid → hit');
  },
  async (tok, S) => { // @1255 ~那如果cache不是valid
    gone(S.t6); S.t7 = sm('cache miss、TLB hit → 1 次 memory access（拿 block）', 0, -0.8);
    cap('Cache miss 但 TLB hit', '只要一次 memory access 把 data 拿進來');
  },
  async (tok, S) => { // @1275 ~如果這邊也是miss這邊也是miss那就什麼
    S.t8 = bad('兩個都 miss → 2 次（page table entry + block）', 0, -1.4);
    cap('兩邊都 miss', '正常要兩個 memory access');
  },
  async (tok, S) => { // @1296 ~但是這個問題是什麼你一定要讓你的page的size夠大
    gone(S.t7, S.t8); S.t9 = hot('條件：page size 夠大，index + block offset 落在 page offset 裡', 0, -0.8);
    cap('條件：page size 一定要夠大', '這樣 index 部分才不會變');
  },
], [[0, 3.2, 15], [0, 2.6, 0]]);

scene('cvm-26a-protect', 'Memory protection：OS、supervisor mode、system call', [
  async (tok, S) => { // @1323 ~Memory Protection
    S.ps = [bx('Process A', NC.sky, -4.4, 5.6, 0, 1.8, 0.6), bx('Process B', NC.rose, -4.4, 4.4, 0, 1.8, 0.6)];
    S.m = bx('physical memory', NC.tan, 1.0, 5.0, 0, 3.0, 1.8);
    cap('Memory protection', '很多 process share 同一個 memory，data 會被別人改掉嗎？');
  },
  async (tok, S) => { // @1340 ~就是說很多的task呢是相同的Virtual
    S.t1 = sm('各有自己的 virtual address，但 share 同一個 physical memory', 0, 3.4);
    cap('每個 task 有自己的 virtual address', '但用相同的 physical memory');
  },
  async (tok, S) => { // @1351 ~其實我們就靠OS來做這個Protection
    S.pt = [bx('A 的 page table', NC.lilac, 4.6, 5.6, 0, 2.2, 0.5), bx('B 的 page table', NC.lilac, 4.6, 4.6, 0, 2.2, 0.5)];
    S.t2 = bad('user program 不能去看、去改 page table', 1.0, 2.7);
    cap('靠 OS 做 protection', '看 page table、做 translation 只有 OS 可以');
  },
  async (tok, S) => { // @1373 ~那OS就是一個super mode就是kernel
    S.k = bx('supervisor / kernel mode', NC.gold, 1.0, 1.6, 0, 3.2, 0.6);
    cap('OS 在 supervisor mode（kernel）', '只有這個 mode 才能做這些動作');
  },
  async (tok, S) => { // @1387 ~重點就是雖然我們的physical address是shared
    S.t3 = good('physical 是 shared，但 user 不能 access 別人的東西', 1.0, 0.8);
    cap('Physical 是 shared', '但不是每個 user 都能 access 別人的東西');
  },
  async (tok, S) => { // @1409 ~Mode要靠System Call
    S.u = bx('user mode', NC.sky, -4.4, 1.6, 0, 1.8, 0.6); S.ar = lk(-3.4, 1.6, -0.7, 1.6);
    S.t4 = sm('system call', -2.0, 2.1);
    cap('要跳到 kernel mode 靠 system call', 'user 之間就不會互相 access 到 data');
  },
]);

scene('cvm-26a-sum', '小結：page table、TLB、cache 與 index', [
  async (tok, S) => { // @1434 ~今天主要介紹就是把virtual memory
    S.a = bx('page table：translation', NC.lilac, -3.6, 5.6, 0, 3.0, 0.6);
    cap('今天的重點：page table', '做 translation');
  },
  async (tok, S) => { // @1443 ~但是我們TLB就做speed up
    S.b = bx('TLB：speed up', NC.blue, 0.4, 5.6, 0, 2.4, 0.6);
    cap('TLB 用來 speed up', '');
  },
  async (tok, S) => { // @1458 ~TLB HIT Cache HIT那就最快了
    S.c = bx('cache', NC.green, 4.0, 5.6, 0, 1.6, 0.6); S.t = good('最快：TLB hit + cache hit', 0, 4.4);
    cap('TLB 和 cache 都在 memory 系統裡', '最好的狀況：TLB hit、cache hit');
  },
  async (tok, S) => { // @1465 ~Cache呢是因為是用Physical Address的Index
    S.t2 = sm('cache 用 physical address 的 index → 要等 TLB 做完 translation', 0, 3.6);
    cap('Cache 用 physical address 的 index', '要經過 TLB 做 translation');
  },
  async (tok, S) => { // @1474 ~是不是把Cache用Virtual Address去去描address它
    S.t3 = good('加速：用 virtual address 的 cache，或 page size 夠大 → 不變的部分當 index，只翻譯 tag', 0, 2.8);
    cap('加速：cache 用 virtual address', '或 page 夠大，用不變的部分當 index');
  },
]);

scene('cvm-26a-place', 'Memory hierarchy 共同架構：放在哪裡、怎麼找', [
  async (tok, S) => { // @1501 ~整個全部的這個memory的hierarchy做一個複習
    S.lv = ['cache', 'TLB', 'virtual memory'].map((t, i) => bx(t, [NC.green, NC.blue, NC.purple][i], -4.0 + i * 4.0, 6.2, 0, 2.6, 0.55));
    cap('複習整個 memory hierarchy', '每一層都利用 principle of locality，像 cache 一樣');
  },
  async (tok, S) => { // @1516 ~你要解決這四個問題
    S.q = list(-4.8, 5.3, 0.45); ['① block placement', '② finding a block', '③ replacement', '④ write policy'].forEach((t) => S.q.add(t));
    cap('每一層都要解決四個問題', '');
  },
  async (tok, S) => { // @1520 ~第一個就是block placement
    S.q.ls[0].element.className = 'lab-label ptr alt';
    cap('第一個：block placement', 'direct map、set associative、fully associative');
  },
  async (tok, S) => { // @1573 ~Block Placement有Direct Map
    S.dm = slots(4, 0, 4.8, { w: 1.2, h: 0.4, rl: (i) => 'set ' + i, title: 'direct map（1-way）', rlw: 0.6 }); S.dm.fl(2, OKG);
    cap('Direct map = one-way set associative', 'index 算出來只有一個位置');
  },
  async (tok, S) => { // @1605 ~那n-way set associate是什麼意思
    S.sa = [0, 1].map((w) => slots(2, 2.4 + w * 1.25, 4.8, { w: 1.1, h: 0.82, gap: 0.08 })); S.sat = hd('2-way：一個 set 兩個位置', 3.0, 5.45);
    S.sa.forEach((T) => T.fl(1, OKG));
    cap('n-way set associative：index 選 set', 'set 裡有 2 或 4 個 entry，選任何一個都可以');
  },
  async (tok, S) => { // @1654 ~那fully associated是什麼就是就等於這一個set裡面有N個element
    S.fa = slots(1, 5.6, 4.8, { w: 1.1, h: 1.72, title: 'fully' }); S.fa.fl(0, OKG);
    cap('Fully associative：一個 set 有 N 個 element', '任何位置都可以');
  },
  async (tok, S) => { // @1666 ~那越高的associative當然會reduce miss rate
    S.t1 = sm('associativity ↑ → miss rate ↓（好處越來越小），但 complexity、cost、access time ↑', 1.6, 2.2);
    cap('Associativity 越高，miss rate 越低', '但好處遞減，complexity、cost、access time 增加');
  },
  async (tok, S) => { // @1689 ~我們就怎麼去找一個block呢
    S.q.ls[0].element.className = 'lab-label idx'; S.q.ls[1].element.className = 'lab-label ptr alt';
    gone(S.t1); S.c1 = sm('direct map：1 個 tag comparison', 0, 2.2);
    cap('第二個：怎麼找 block？', 'direct map：做一個 tag comparison');
  },
  async (tok, S) => { // @1705 ~那N-Way的setassociation
    S.c2 = sm('n-way：n 個 tag 同時比較 → n 個 comparator', 3.0, 1.6);
    cap('N-way：n 個 tag 同時比較', 'n 越大，hardware 越多');
  },
  async (tok, S) => { // @1737 ~那Fully Associated有兩種一種是cash裡面的
    S.c3 = sm('fully associative cache：1024 個 entry → 1024 個 tag 同時比對', 3.0, 1.0);
    cap('Fully associative 的 cache', '1024 個 entry 就要 1024 個 tag 同時比對');
  },
  async (tok, S) => { // @1761 ~另外一個就是virtual memory裡面它也是fully associate
    S.c4 = good('virtual memory：建完整的 lookup table（page table），用 page number index → 不用比 tag', 1.0, 0.4);
    cap('Virtual memory 也是 fully associative', '但建一張完整的 page table，用 page number 直接 index');
  },
  async (tok, S) => { // @1855 ~那這個Hardware的Cache主要是用這個Cache
    S.c5 = sm('代價：查 page table 多一次 memory access；好處：miss rate 低', 1.0, -0.2);
    cap('Cache 靠 hardware 比對', 'page table 要多一次 access，但 fully associative 讓 miss rate 降低');
  },
], [[0, 3.4, 14.5], [0, 3.0, 0]]);

scene('cvm-26a-repwrite', '共同架構：replacement 與 write policy', [
  async (tok, S) => { // @1890 ~在replacement的問題
    S.t0 = hot('③ Replacement', 0, 6.7);
    S.dm = bx('direct map：沒得選，來了就換', NC.gray, -3.2, 5.8, 0, 3.6, 0.55);
    cap('Replacement：direct map 沒得選', 'set associative、fully associative 才有');
  },
  async (tok, S) => { // @1902 ~什麼叫replacement問題很多的位置
    S.w = [0, 1, 2, 3].map((i) => bx('way ' + i, NC.mint, 0.6 + i * 1.5, 5.8, 0, 1.3, 0.55));
    cap('4-way 都坐滿了', '新的進來，誰要出去？');
  },
  async (tok, S) => { // @1914 ~如果按照這個temporal locality的話
    glow(S.w[2], NG); S.t1 = sm('temporal locality：最久沒用的最可能不再用 → LRU', 2.8, 4.9);
    cap('按照 temporal locality', '把 least recently used 搬出去');
  },
  async (tok, S) => { // @1932 ~所以我們要記錄這個可是你如果要記錄這件事情
    S.t2 = sm('真正的 LRU 要很多 hardware → 用 approximation；VM 用 reference bit', 2.8, 4.3);
    cap('Way 很多時，記錄誰最久沒用很貴', '通常用 approximation（VM 用 reference bit）');
  },
  async (tok, S) => { // @1983 ~random
    S.t3 = sm('另一種：random（不需要那麼多 hardware）', 2.8, 3.7);
    cap('另一種方法：random', '');
  },
  async (tok, S) => { // @1993 ~在write的部分writethrough呢
    gone(S.t0, S.dm, S.w, S.t1, S.t2, S.t3); S.t4 = hot('④ Write policy', 0, 6.7);
    S.up = bx('upper level', NC.green, -3.6, 5.4, 0, 2.2, 0.6); S.lo = bx('lower level', NC.tan, -3.6, 3.4, 0, 2.2, 0.6);
    S.wt = sm('write through：每次 update 都寫下層 → traffic 多', 1.4, 5.4); S.ar = lk(-3.6, 5.0, -3.6, 3.8);
    cap('Write through：兩層兩份 copy 保持一致', '每次 update 都寫下去，traffic 很多');
  },
  async (tok, S) => { // @2016 ~那如果你有ride buffer的話呢就會減少這個overhead
    S.wb0 = bx('write buffer', NC.gold, -1.0, 4.4, 0, 1.8, 0.45); S.wbt = sm('先寫進 buffer，再慢慢寫到 lower level', 1.4, 4.6);
    cap('有 write buffer 就能減少 overhead', '先寫到 buffer，再慢慢寫下去');
  },
  async (tok, S) => { // @2026 ~那ride back呢是當你的upper level要被replace之後你才把它寫回去
    S.wb = sm('write back：只設 dirty；被 replace 時才寫回 lower level', 1.4, 3.6);
    cap('Write back：先設 dirty', 'upper level 被 replace 時才寫回去');
  },
  async (tok, S) => { // @2046 ~memory是不用講的一定是ride back
    S.vm = good('virtual memory 一定 write back：overhead 太大，page 被換出時才整個寫回', 0, 2.4);
    cap('Virtual memory 一定是 write back', '不可能每改一個 data 就寫回 disk');
  },
]);

// 3C：老師的容量例子（要的 100、只放得下 80）；conflict 用一個 4-block 的示意序列，direct map vs fully associative 模擬
function sim3c(seq, nb, fully) { const st = []; const lines = Array(nb).fill(-1), seen = new Set(); return seq.map((b) => { let hit; if (fully) { const i = st.indexOf(b); hit = i >= 0; if (hit) st.splice(i, 1); else if (st.length === nb) st.shift(); st.push(b); } else { hit = lines[b % nb] === b; lines[b % nb] = b; } const first = !seen.has(b); seen.add(b); return { b, hit, first }; }); }
const C3 = (() => { const seq = [0, 4, 0, 4]; const dm = sim3c(seq, 4, false), fa = sim3c(seq, 4, true); return { seq, dm, fa, ok: dm.every((r) => !r.hit) && fa.filter((r) => r.hit).length === 2 && dm.filter((r) => r.first).length === 2 }; })();
scene('cvm-26a-3c', 'Miss 的三個來源：compulsory、capacity、conflict', [
  async (tok, S) => { // @2065 ~sources of misses
    S.t0 = hot('Sources of misses（cache miss、page fault 都一樣）', 0, 6.7);
    cap('哪些原因會產生 miss？', 'cache miss 或 page fault 都適用');
  },
  async (tok, S) => { // @2071 ~complacery的myths就是一定要的
    S.c1 = bx('Compulsory（cold start）', NC.sky, -4.2, 5.6, 0, 3.2, 0.6);
    S.t1 = sm('第一次 access 一定 miss：一開始大家都不在裡面', -4.2, 4.8);
    cap('Compulsory miss（cold start）', '第一次 access 到這個 block，一定會 miss');
  },
  async (tok, S) => { // @2094 ~capacity的mix是因為你的容量真的不夠
    S.c2 = bx('Capacity', NC.orange, 0, 5.6, 0, 2.6, 0.6);
    const need = 100, size = 80; S.k = ok(need - size === 20, '要用 100、只放得下 80 → 至少 20 擺不下 ✓', 0, 4.8);
    cap('Capacity miss：容量真的不夠', '要用的有 100，size 只有 80，一定擺不下');
  },
  async (tok, S) => { // @2119 ~其實virtual memory是一樣
    S.t2 = sm('virtual memory 也是：physical 有限，很多 process 的 virtual space 擺不下', 0, 4.2);
    cap('Virtual memory 一樣', 'physical 有限，很多 process 的 space 放不下');
  },
  async (tok, S) => { // @2140 ~那另外是conflict
    S.c3 = bx('Conflict（collision）', NC.pink, 4.2, 5.6, 0, 2.8, 0.6);
    cap('Conflict miss（collision）', 'fully associative 沒有這個問題');
  },
  async (tok, S) => { // @2152 ~或direct map的話因為你為了要快速
    gone(S.t1, S.k, S.t2);
    S.dm = slots(4, -2.4, 3.6, { w: 1.4, h: 0.4, rl: (i) => 'line ' + i, title: 'direct map 4 blocks（示意）', rlw: 0.7 });
    S.r = list(2.4, 3.8, 0.42);
    for (const [i, r] of C3.dm.entries()) { S.dm.put(r.b % 4, 'block ' + r.b, NC.rose); S.r.add('block ' + r.b + '：' + (r.hit ? 'hit' : r.first ? 'miss（compulsory）' : 'miss（conflict）'), r.hit ? 'good' : 'bad'); if (i < 3) await wt(tok, 350); }
    S.k2 = ok(C3.ok, 'line 1–3 都空著，0 和 4 卻一直搶 line 0；fully associative 只 miss 2 次 ✓', 0, 0.4);
    cap('Direct map 只准坐自己的位置', '別的位置空著也不能過去 → conflict miss');
  },
  async (tok, S) => { // @2196 ~那是在不是fully associated的地方
    S.t3 = hot('三種 miss：compulsory、capacity、conflict', 0, -0.3);
    cap('這三種不同的 miss 都會發生', 'conflict 只在不是 fully associative 時出現');
  },
], [[0, 3.4, 14.5], [0, 2.8, 0]]);

// fixed-size cache：block 變大 → block 數變少（16 KiB 為示意）
const BLK = (() => { const cache = 16 * 1024; return [16, 64, 1024].map((b) => ({ b, n: cache / b })); })();
scene('cvm-26a-tradeoff', '改 design 一定變快嗎？size、associativity、block size', [
  async (tok, S) => { // @2213 ~那些原因會造成我CacheMiss
    S.t0 = hot('改善 miss rate ≠ 一定改善 overall performance', 0, 6.7);
    cap('改 design 降低 miss rate', '一定會增加 performance 嗎？不一定');
  },
  async (tok, S) => { // @2244 ~比如說你要把cash size變大
    S.r1 = list(-5.6, 5.8, 0.5); S.r1.add('cache size ↑：capacity miss ↓，但 access time ↑', 'idx');
    S.cs = vbar(NC.green, 4.0, 0.8, 1.0, 4.4); await growH(tok, S.cs, 1.6, 4.4, 700);
    cap('Cache size 變大', 'capacity miss 降低，但變慢，access time 增高');
  },
  async (tok, S) => { // @2269 ~再來好像把associativity把它增加
    S.r1.add('associativity ↑（2-way → 4-way）：conflict miss ↓，但 access time ↑', 'idx');
    cap('Associativity 增加：2-way 變 4-way', '不打架，miss rate 降低，但 access time 也增加');
  },
  async (tok, S) => { // @2290 ~再來你把block size變大
    S.r1.add('block size ↑：spatial locality → miss rate ↓', 'idx');
    cap('Block size 變大', '附近的都搬進來，spatial locality，miss rate 下降');
  },
  async (tok, S) => { // @2319 ~block size變大了會怎樣你搬進搬出的時候你要搬很多東西
    S.r1.add('但 miss penalty ↑：一次要搬很多東西', 'bad');
    cap('但搬進搬出要搬很多東西', 'miss penalty 增加');
  },
  async (tok, S) => { // @2331 ~當你的block size往上如果fix size的話
    S.cv = [0.9, 0.6, 0.45, 0.5, 0.8].map((h, i) => vbar(NC.orange, -3.8 + i * 1.0, h * 2.0, 0.7, 0));
    S.cl = sm('fixed cache size：block size →　miss rate 先降後升（示意）', -1.8, 2.6);
    cap('Cache size 固定，block size 一直變大', 'miss rate 先降，後來又上升，為什麼？');
  },
  async (tok, S) => { // @2399 ~number of block變小了對不對
    S.k = ok(BLK[0].n === 1024 && BLK[2].n === 16, '16 KiB：16 B block → ' + BLK[0].n + ' 個；1 KiB block → 只剩 ' + BLK[2].n + ' 個（示意）✓', 3.0, 2.0);
    S.c2 = sm('block 數變少 → 更多人 map 到同一個位置 → conflict ↑', 3.0, 1.3);
    cap('Number of blocks 變少', '更多人 map 到同一個位置，conflict 增加');
  },
  async (tok, S) => { // @2429 ~它有一些Synchronous的S-RAM它可以Provide Burst of Data
    gone(S.cv, S.cl, S.k, S.c2, S.cs);
    S.tr = list(-3.0, 3.0, 0.55, 'idx'); S.tr.add('Trends：synchronous SRAM／DRAM 提供 burst、更高 bandwidth');
    cap('一些 trend：synchronous SRAM 提供 burst', 'redesign DRAM 提供更高的 bandwidth');
  },
  async (tok, S) => { // @2440 ~或者是restructure code to increase locality
    S.tr.add('restructure code 增加 locality：不只看 time complexity，也要看 cache');
    cap('Restructure code 增加 locality', '設計 algorithm 也要把 data 的 access 考慮進去');
  },
  async (tok, S) => { // @2471 ~prefetching的方法
    S.tr.add('prefetching：先抓進來，降低 cache miss');
    cap('還有 prefetching', '也可以降低 cache miss');
  },
]);

// P&H 5.9 的簡單 cache：direct mapped、write-back、write allocate、block 4 words、16 KiB、32-bit address
const SC = (() => { const blk = 4 * 4, size = 16 * 1024, blocks = size / blk, off = lg2(blk), idx = lg2(blocks); return { blk, blocks, off, idx, tag: 32 - idx - off }; })();
scene('cvm-26a-fsmintro', 'Cache 的 control：finite state machine 與一個簡單 cache', [
  async (tok, S) => { // @2487 ~finance machine去control一個simple cache
    S.t0 = hot('用 finite state machine control 一個 simple cache', 0, 6.7);
    cap('用 finite state machine', '去 control 一個 simple cache');
  },
  async (tok, S) => { // @2498 ~你的control signal怎麼來一個instruction給你
    S.op = bx('opcode（＋funct）→ control signals', NC.blue, -3.2, 5.6, 0, 4.0, 0.6);
    cap('Single cycle：control signal 怎麼來？', '看 opcode（有些在 funct field）就知道');
  },
  async (tok, S) => { // @2550 ~它其實跟single cycle是一樣只不過它在不同class cycle
    S.pp = sm('pipeline：decode 時就產生，跟著指令一段段往下傳', -3.2, 4.8);
    cap('Pipeline 也一樣：decode 時就產生', '之後各個 stage 要用，就傳下去');
  },
  async (tok, S) => { // @2586 ~可是另外一個我們就用這個cache來做例子
    S.ca = bx('cache controller：沒有 instruction', NC.green, 3.0, 5.6, 0, 3.6, 0.6);
    S.t1 = sm('要看「現在在哪個 state」＋「input 是什麼」', 3.0, 4.8);
    cap('Cache 沒有 instruction', '要看現在在哪個 state、得到哪些 input');
  },
  async (tok, S) => { // @2625 ~就是說我現在在哪一個狀況我哪些input過進來
    S.f = [bx('state A', NC.lilac, -1.6, 3.4, 0, 1.6, 0.6), bx('state B', NC.lilac, 1.6, 3.4, 0, 1.6, 0.6)]; lk(-0.7, 3.4, 0.7, 3.4);
    S.t2 = sm('input → 發出 control signal、transition 到 next state', 0, 2.6);
    cap('Finite state machine：現在的 state + input', '決定發出哪些 signal、下一個 state');
  },
  async (tok, S) => { // @2653 ~說一個很簡單的cache它是the right map right back right allocate
    gone(S.op, S.pp, S.ca, S.t1, S.f, S.t2);
    S.cf = list(-4.6, 5.8, 0.48); ['direct mapped', 'write-back', 'write allocate（write miss 也搬進來）'].forEach((t) => S.cf.add(t));
    cap('簡單的 cache：direct mapped、write-back', 'write allocate：write miss 也要 allocate');
  },
  async (tok, S) => { // @2670 ~Block size是四個word然後cache size 16K byte
    S.cf.add('block 4 words = 16 bytes；cache 16 KiB');
    S.k1 = ok(SC.blocks === 1024, '16 KiB / 16 B = ' + SC.blocks + ' 個 block ✓', 2.4, 5.6);
    cap('Block 4 個 word、cache 16K bytes', '所以有 1024 個 block');
  },
  async (tok, S) => { // @2683 ~32bit by address有一個valid bit
    S.cf.add('32-bit byte address；valid bit、dirty bit；blocking cache（CPU 等它）');
    cap('32-bit address、valid bit、dirty bit', 'blocking cache：CPU stall 在那邊等');
  },
  async (tok, S) => { // @2705 ~這個tag有幾個bit我們看一下
    S.a = fields([{ n: 'tag', b: SC.tag, c: NC.pink }, { n: 'index', b: SC.idx, c: NC.sky }, { n: 'offset', b: SC.off, c: NC.rose }], 0, 2.4, { unit: 0.22 });
    S.a.fl(2); S.k2 = ok(SC.off === 4, 'block 16 bytes = 2⁴ → offset 4 bits ✓', -2.4, 1.3);
    cap('Tag 有幾個 bit？', 'block 16 bytes → offset 4 bits');
  },
  async (tok, S) => { // @2729 ~這往下這個地方都是什麼往下都是叫做block number
    S.a.fl(2, null); S.a.fl(1); S.k3 = ok(SC.idx === 10, '1024 個 block → index 10 bits ✓', 2.4, 1.3);
    cap('往上是 block number，low-order 當 index', '1024 個 block → 10 bits');
  },
  async (tok, S) => { // @2751 ~所以這邊就有十個bit剩下是什麼就是它的tag
    S.a.fl(1, null); S.a.fl(0); S.k4 = ok(SC.tag === 18, 'tag = 32 − 10 − 4 = ' + SC.tag + ' bits ✓', 0, 0.6);
    cap('Direct map：10 個 bit 的 index', '剩下的就是 tag：18 bits');
  },
]);

// ════════ m6HNCwqazNE（第 26B 講：VM 概念答疑、cache controller FSM、cache coherence、snooping、Intel 多核、pitfalls、結論） ════════
scene('cvm-26b-recap', '再談 virtual memory：每個 process 一整個 virtual space', [
  async (tok, S) => { // @22 ~就是這個virtual memory呢virtual memory是一個系統的一個操作的概念
    S.t0 = hot('Virtual memory：系統（OS）操作的概念', 0, 6.7);
    cap('Virtual memory 是系統操作的概念', '牽涉到 OS，不會是理所當然的');
  },
  async (tok, S) => { // @48 ~每一個Program每一個Program它都有自己的Virtual Address
    S.ps = ['Process 1', 'Process 2', 'Process 3'].map((p, i) => bx(p + '：2³² bytes', [NC.sky, NC.lilac, NC.rose][i], -4.4, 5.8 - i * 0.8, 0, 3.0, 0.6));
    cap('每個 program（process）', '都有自己完整、獨立的 virtual address space');
  },
  async (tok, S) => { // @75 ~但是三個Program同時在這邊在run
    S.cpu = bx('一個 CPU', NC.teal, 1.0, 6.0, 0, 1.8, 0.6); S.m = slots(6, 1.0, 5.0, { w: 2.0, h: 0.36, gap: 0.06, title: '' });
    S.ml = hd('一個 physical memory', 1.0, 2.6);
    cap('三個 program 同時在 run', '共用一個 CPU、一個 physical address space');
  },
  async (tok, S) => { // @91 ~當這個process在run runrunrun它需要的東西
    [0, 2, 4].forEach((k) => S.m.put(k, 'P1 page', NC.sky)); glow(S.ps[0], OKG);
    cap('P1 在 run：雖然有 2³² 這麼大', '只要把要的三、四個 page 拿進 main memory');
  },
  async (tok, S) => { // @128 ~它是需要它要去IO了它怎麼辦它就把它CPU就放棄了
    glow(S.ps[0], null); glow(S.ps[1], OKG); [1, 3].forEach((k) => S.m.put(k, 'P2 page', NC.lilac));
    cap('P1 要做 IO：放棄 CPU', '給另一個 process 用');
  },
  async (tok, S) => { // @143 ~那該他run的時候他的需要那幾個page呢也是在man memory
    glow(S.ps[1], null); glow(S.ps[0], OKG);
    cap('輪回 P1：它的 page 也還在 main memory', '從剛才被 interrupt 的地方 resume');
  },
  async (tok, S) => { // @158 ~那他需要的page呢也是跟他所需要的page大家其實通通都是放在
    S.m.put(5, 'P3 page', NC.rose); S.t1 = sm('大家的 page 都放在同一個 main memory；各自只拿幾塊', 1.0, 2.0);
    cap('大家的 page 都放在同一個 main memory', '你看到的可用空間叫 virtual address space');
  },
  async (tok, S) => { // @178 ~那你說那我的全部的地方你有2的32這麼多個
    S.d = bx('Disk：每個人全部的 space', NC.metal, 5.0, 4.4, 0, 2.6, 2.2);
    cap('全部的 2³² space 都在 disk 上', '沒用到的 swap 出去；不需要連續擺放');
  },
  async (tok, S) => { // @241 ~所以這個virtual memory的概念又不是single
    gone(S.t1); S.t2 = sm('沒有 VM：一個 program 獨佔 memory 與 CPU，跑完才換下一個（sequential），不用 translation', 0, 1.3);
    cap('如果不要 virtual memory', '一人獨佔，sequential，address 就是 physical');
  },
  async (tok, S) => { // @285 ~因為你share的關係很多個program同時在share這個CPU
    S.t3 = good('因為 share（multiprogramming）＋ locality → 只搬自己要用的 → 需要 translation', 0, 0.6);
    cap('因為很多 program share CPU 和 memory', '加上 locality，只搬要用的：multiprogramming');
  },
]);

scene('cvm-26b-sig', 'Cache controller 的 input / output signals', [
  async (tok, S) => { // @331 ~另外一種Controller的設計就是說
    S.t0 = hot('Controller：看現在的 state 與 input → 發 control signal、跳到下一個 state', 0, 6.8);
    cap('另一種 controller 設計', '依現在的狀況和 input 發出 signal：finite state machine');
  },
  async (tok, S) => { // @350 ~簡單的例子就是說好這個有這樣的cache它有這些dread map, right back
    S.cpu = bx('CPU', NC.teal, -5.0, 3.6, 0, 1.4, 3.2); S.cc = bx('Cache + controller', NC.green, 0, 3.6, 0, 2.4, 3.2); S.mem = bx('Memory', NC.tan, 5.0, 3.6, 0, 1.4, 3.2);
    S.cf = sm('direct mapped · write-back · write allocate', 0, 5.6);
    cap('例子：direct mapped、write back', '還有 write allocate');
  },
  async (tok, S) => { // @365 ~那我們看我們要怎麼去model它
    cap('Cache controller 會得到哪些 input？', '要發出哪些 output？跟 CPU、memory 的關係');
  },
  async (tok, S) => { // @380 ~它會得到如果CPU要告訴它說這是一個read write signal
    S.c = list(-2.6, 5.0, 0.48, 'idx'); S.c.add('Read/Write（1 bit）');
    cap('CPU 告訴 cache：read 還是 write', '');
  },
  async (tok, S) => { // @385 ~它要知道它告訴它這是一個valid request
    S.c.add('Valid = 1：要開始了');
    cap('Valid request', 'signal 隨時在變，valid = 1 才表示要開始 access');
  },
  async (tok, S) => { // @408 ~你要給它address因為剛剛是32個bit
    S.c.add('Address：32 bits');
    cap('給它 address', '2³² 個 byte → 32 bits');
  },
  async (tok, S) => { // @415 ~Data也是32bit
    S.c.add('Write data → 32 bits'); S.c.add('Read data ← 32 bits');
    cap('Data 也是 32 bits（一個 word）', 'write data 寫進去、read data 拿出來');
  },
  async (tok, S) => { // @432 ~那cache如果東西準備好要跟他說ready
    S.c.add('Ready ←：cache 準備好了');
    cap('Cache 準備好要跟 CPU 說 ready', '');
  },
  async (tok, S) => { // @439 ~那cache呢又會跟誰跟memory也會有關係的
    S.m = list(2.6, 5.0, 0.48, 'idx'); S.why = sm('cache miss 要拿 block；write back 要寫回 memory', 2.6, 0.6);
    cap('Cache 也跟 memory 有關係', 'miss 要去拿東西，write back 要寫回去');
  },
  async (tok, S) => { // @468 ~時候你要寫回去一個memory
    S.m.add('Read/Write、Valid'); S.m.add('Address：32 bits');
    cap('對 memory 也有 read/write、valid', 'address 32 bits');
  },
  async (tok, S) => { // @486 ~然後這個為什麼128
    const bits = 4 * 32; S.m.add('Write / Read data：' + bits + ' bits');
    S.k = ok(bits === 128, '一個 block 4 words × 32 bits = 128 bits ✓', 2.6, 2.6);
    cap('Data 為什麼是 128 bits？', '一次搬一整個 block（4 words）');
  },
  async (tok, S) => { // @507 ~再來如果memory讀完它就通知它說已經讀完了或寫完了
    S.m.add('Ready ←：可能要 multiple cycles');
    cap('Memory 讀完或寫完就送 ready', 'memory 比較慢，可能要好幾個 cycle');
  },
]);

// FSM（P&H 5.9）：Idle → Compare Tag →（hit）Idle；miss + dirty → Write-Back → Allocate → Compare Tag；miss + clean → Allocate
const FSMR = (() => { const l1 = { valid: true, dirty: true, tag: 5 }; const p1 = fsmRun(l1, { write: true, tag: 9 }); const l2 = { valid: true, dirty: false, tag: 9 }; const p2 = fsmRun(l2, { write: false, tag: 3 }); return { p1, p2, d1: l1.dirty, ok: p1.join('>') === 'Idle>Compare Tag>Write-Back>Allocate>Compare Tag>Idle' && p2.join('>') === 'Idle>Compare Tag>Allocate>Compare Tag>Idle' && l1.dirty === true && l2.dirty === false }; })();
scene('cvm-26b-fsm', 'Cache controller 的 finite state machine', [
  async (tok, S) => { // @525 ~它說一開始呢我如果沒有做CacheAccess但是在Idle的狀況
    S.st = { idle: bx('Idle', NC.gray, -4.2, 5.4, 0, 2.0, 0.8), cmp: bx('Compare Tag', NC.sky, 0.8, 5.4, 0, 2.4, 0.8), wb: bx('Write-Back', NC.rose, 0.8, 2.0, 0, 2.4, 0.8), al: bx('Allocate', NC.mint, 4.8, 2.0, 0, 2.2, 0.8) };
    glow(S.st.idle, HL);
    cap('一開始沒有 cache access：Idle state', '');
  },
  async (tok, S) => { // @538 ~我就要Transition到這個State來
    glow(S.st.idle, null); glow(S.st.cmp, HL); lk(-3.1, 5.6, -0.5, 5.6); sm('Valid CPU request', -1.8, 6.0);
    cap('CPU 送來 valid = 1', '就 transition 到 Compare Tag state');
  },
  async (tok, S) => { // @544 ~然後做Tag的Comparison之後如果是Valid Hit的話
    S.t1 = good('valid 且 tag 一樣 → cache hit', 0.8, 6.3);
    cap('Compare Tag：valid 又 tag 一樣', '就是 cache hit，data 可以用');
  },
  async (tok, S) => { // @562 ~然後繼續這邊如果都沒有在Excel我就在這邊一直轉
    S.t2 = sm('沒有 request：每個 clock 都留在 Idle', -4.2, 4.6);
    cap('沒有 access 時', '每個 clock 都在 Idle 這邊轉');
  },
  async (tok, S) => { // @573 ~如果是write的話write它也是一個write的話
    S.t3 = sm('if write：set dirty、set valid、set tag（一起寫）', 0.8, 4.6);
    cap('如果是 write', '要 set dirty bit，連 valid、tag 一起寫');
  },
  async (tok, S) => { // @611 ~這hit的話出來是hit的話呢當然你就就回到idle
    glow(S.st.cmp, null); glow(S.st.idle, OKG); lk(-0.5, 5.2, -3.1, 5.2); sm('hit → Idle', -1.8, 4.9);
    cap('Hit 的話', '回到 Idle');
  },
  async (tok, S) => { // @617 ~那如果是miss的話catch miss的話那你就要去看它這是dirty的
    glow(S.st.idle, null); glow(S.st.cmp, NG); S.d = sm('miss：舊的 block 是 dirty 嗎？', 3.6, 4.0);
    cap('Cache miss：看舊的 block 是不是 dirty', 'dirty 就要先 write back');
  },
  async (tok, S) => { // @637 ~那這要花很多時間去寫因為你就要通知memory說我要開始寫
    lk(0.8, 4.9, 0.8, 2.5); glow(S.st.wb, HL); S.w = sm('Write-Back：等 memory ready 前一直留在這', 0.8, 1.1);
    cap('Miss 且 dirty → Write-Back state', '通知 memory 寫，沒 ready 就一直在這裡轉');
  },
  async (tok, S) => { // @653 ~那就tell這邊allocate這個stay來
    glow(S.st.wb, null); glow(S.st.al, HL); lk(2.1, 2.0, 3.6, 2.0);
    cap('Memory ready（寫好了）', '就到 Allocate state');
  },
  async (tok, S) => { // @671 ~那如果說不是dirty的話你就直接跳到這個stay來
    lk(2.1, 5.0, 4.6, 2.5, 0x0f5a3a); S.cl = sm('miss + clean → 直接 Allocate', 4.2, 3.6);
    cap('不是 dirty', '直接跳到 Allocate，不用寫回');
  },
  async (tok, S) => { // @696 ~其實到allocate這個state其實有兩種狀況
    S.a = sm('Allocate：read、write 都要；從 memory 讀新 block 寫進 cache', 4.4, 1.1);
    cap('Allocate：read 或 write 都要做', '把 block 從 memory 寫到 cache');
  },
  async (tok, S) => { // @710 ~寫完之後你會再回到這邊來再回到這個compare tag
    glow(S.st.al, null); glow(S.st.cmp, OKG); lk(4.8, 2.5, 2.0, 5.0, 0x0f5a3a);
    S.k = ok(FSMR.ok, 'write miss（dirty）：' + FSMR.p1.join(' → ') + ' ✓', 0, 0.2);
    cap('回到 Compare Tag：tag 一樣了 → hit', '再回 Idle；write 的話設 dirty');
  },
  async (tok, S) => { // @728 ~為什麼write也要allocate呢
    S.blk = [0, 1, 2, 3].map((i) => bx(i === 2 ? '寫這個 word' : 'word ' + i, i === 2 ? NC.orange : NC.sky, -5.4 + i * 1.3, 0.2, 0, 1.2, 0.5));
    cap('為什麼 write 也要 allocate？', 'block 是一個整體：寫其中一個，整塊都要搬上來');
  },
  async (tok, S) => { // @773 ~但是你把整個搬上來之後呢譬如你是搬舊的data進來啊
    S.e = sm('搬進來的是舊 data → 回 Compare Tag 再寫一次、set dirty（另一種 policy：write no-allocate）', 0, -0.6);
    cap('搬進來的是舊的 data', '回到 Compare Tag 再寫一次，設成 dirty');
  },
], [[0, 3.2, 15], [0, 2.7, 0]]);

scene('cvm-26b-impl', 'FSM 怎麼變成硬體：state register 與 combinational logic', [
  async (tok, S) => { // @796 ~所以這個finance statement是呢它就把catch controller分在這些state
    S.ss = ['Idle', 'Compare Tag', 'Write-Back', 'Allocate'].map((t, i) => bx(t, [NC.gray, NC.sky, NC.rose, NC.mint][i], -4.5 + i * 3.0, 6.0, 0, 2.4, 0.6));
    cap('FSM 把 cache controller 分成這些 state', '');
  },
  async (tok, S) => { // @810 ~一個state就是一個clock cycle
    S.cc = [0, 1, 2, 3].map((i) => vbar(NC.teal, -4.5 + i * 3.0, 0.8, 1.2, 4.2));
    cap('一個 state 就是一個 clock cycle', '要做完這個 state 的事');
  },
  async (tok, S) => { // @818 ~那如果你這個state要做很多事情
    await growH(tok, S.cc[1], 1.4, 4.2, 500); S.cc.forEach((m, i) => { if (i !== 1) setH(m, 1.4, 4.2); });
    S.t1 = bad('一個 state 事情太多 → 所有 state 的 clock cycle 都得跟著變長', 0, 3.6);
    cap('某個 state 要做很多事', 'clock cycle 要讓每個 state 都做完 → 全部變長');
  },
  async (tok, S) => { // @837 ~就可以把它拆成兩個state
    S.cc.forEach((m) => setH(m, 0.8, 4.2)); gone(S.t1);
    S.t2 = good('把它拆成兩個 state → clock cycle 變短', 0, 3.6);
    cap('把它拆成兩個 state', 'clock cycle 就可以變短');
  },
  async (tok, S) => { // @851 ~你就可以把用這個finite state machine這個合成
    const n = 4, bits = Math.ceil(Math.log2(n));
    S.reg = bx('state register', NC.gold, -3.6, 2.2, 0, 2.6, 0.8);
    S.k = ok(bits === 2, n + ' 個 state → ⌈log₂ ' + n + '⌉ = ' + bits + ' bits（2 個 flip-flop：00、01、10、11）✓', 0, 3.0);
    cap('合成：4 個 state 用幾個 bit 記？', '2 個 bit，兩個 latch 或 flip-flop');
  },
  async (tok, S) => { // @879 ~present state跟next state
    S.ps = sm('present state', -3.6, 1.4); S.lg = bx('combinational logic', NC.lilac, 1.4, 2.2, 0, 3.2, 0.8);
    lk(-2.3, 2.2, -0.2, 2.2); lk(1.4, 1.75, -3.6, 1.75);
    S.ns = sm('next state', -1.0, 1.4);
    cap('State register 記 present state', '算出 next state 再存回去');
  },
  async (tok, S) => { // @890 ~不同的input進來我就有這個經過這個combination
    S.in = sm('inputs →', 1.4, 3.0); S.out = bx('control signals', NC.green, 5.2, 2.2, 0, 2.2, 0.6); lk(3.0, 2.2, 4.1, 2.2);
    cap('Input + present state 進入組合邏輯', '發出 control signal，transition 到 next state');
  },
  async (tok, S) => { // @918 ~所以這個control的implementation跟我們前面的instruction很不一樣
    S.t3 = sm('不像 instruction：看 opcode 就知道；這裡要看 state + input 的各種 combination', 0, 0.6);
    cap('和 instruction 的 control 很不一樣', '要把所有 state 與 input 的組合 model 進 FSM');
  },
]);

// coherence 例子（P&H 圖 5.37，假設 write-through cache）：X 一開始是 0
const COH = (() => { let mem = 0, A = null, B = null; const t = []; A = mem; t.push([A, B, mem]); B = mem; t.push([A, B, mem]); A = 1; mem = 1; t.push([A, B, mem]); return { t, stale: t[2][1] !== t[2][0] }; })();
scene('cvm-26b-coh', 'Cache coherence：多個 CPU 各有一份 copy', [
  async (tok, S) => { // @977 ~那最後一個問題就是parallism跟memory hierarchy cache coherence
    S.t0 = hot('Parallelism 與 memory hierarchy：cache coherence', 0, 6.8);
    cap('最後一個問題：cache coherence', '平行化（multi-core）時才會碰到');
  },
  async (tok, S) => { // @991 ~就是說如果你現在一個這個有好多個CPU的話是multi-core
    S.A = bx('CPU A', NC.sky, -3.6, 5.6, 0, 1.6, 0.6); S.B = bx('CPU B', NC.rose, 3.6, 5.6, 0, 1.6, 0.6);
    S.cA = bx('cache A：—', NC.off, -3.6, 4.4, 0, 2.2, 0.55); S.cB = bx('cache B：—', NC.off, 3.6, 4.4, 0, 2.2, 0.55);
    cap('一個 processor 裡好幾個 core', '同一份 data 可能在不同 cache 各有 copy');
  },
  async (tok, S) => { // @1028 ~cache coherence就是說當你很多個CPU的時候呢它share同一個physical address的話
    S.mem = bx('memory：X = 0', NC.tan, 0, 2.6, 0, 3.0, 0.6);
    cap('很多 CPU share 同一個 physical address', '就會發生這個問題');
  },
  async (tok, S) => { // @1037 ~去舉個例子來講說我們就在第一個時間點的時候
    S.tl = list(0, 1.6, 0.45, 'idx'); S.tl.add('時間 0：memory 的 X = 0（課本例子，假設 write-through）');
    cap('舉例：一開始 memory 裡 X = 0', '');
  },
  async (tok, S) => { // @1043 ~A去讀X當然讀到0
    relabel(S.cA, 'cache A：X = ' + COH.t[0][0]); glow(S.cA, HL); S.tl.add('時間 1：CPU A 讀 X → 0');
    cap('CPU A 讀 X：讀到 0', '放進 A 的 cache');
  },
  async (tok, S) => { // @1049 ~那CPU B呢它也把東西拿過來也是0
    glow(S.cA, null); relabel(S.cB, 'cache B：X = ' + COH.t[1][1]); glow(S.cB, HL); S.tl.add('時間 2：CPU B 讀 X → 0');
    cap('CPU B 也讀 X：也是 0', '目前 OK，沒問題');
  },
  async (tok, S) => { // @1055 ~可是如果現在CPU A所以他去Write1到X的話
    glow(S.cB, null); relabel(S.cA, 'cache A：X = ' + COH.t[2][0]); relabel(S.mem, 'memory：X = ' + COH.t[2][2]); glow(S.cA, OKG); S.tl.add('時間 3：CPU A 寫 X = 1');
    cap('CPU A 把 1 寫到 X', '');
  },
  async (tok, S) => { // @1059 ~那這時候如果CPUB他也拿這個一個copy
    glow(S.cB, NG); S.k = ok(COH.stale, 'B 的 cache 還是 0，A 是 1 → 同一個 location 兩個值 ✓', 0, -0.4);
    cap('B 沒有同步 update', '同一個 location 有不同的值 → coherence 問題');
  },
  async (tok, S) => { // @1085 ~那他說嚴格的定義來講呢怎麼叫做cache coherence
    gone(S.tl, S.k); glow(S.cB, null);
    S.def = good('定義：讀一個 location，一定讀到最近寫進去的值', 0, 1.6);
    cap('嚴格定義：讀到的一定是', '最近被寫進去的那個 data');
  },
  async (tok, S) => { // @1117 ~那你要維持這個coherence他說有formal的定義是什麼
    S.r = list(0, 0.9, 0.45, 'idx'); S.r.add('① 同一個 processor 寫了再讀（中間沒人寫）→ 讀到自己寫的');
    cap('Formal 定義一：同一個 process', 'write 完馬上 read，要讀到剛寫的值');
  },
  async (tok, S) => { // @1143 ~或者是說呢別的process要去別的CPU去write the location
    S.r.add('② 別的 CPU 寫，過了足夠的時間 → 讀到新值');
    cap('二：別的 CPU 去 write', '經過足夠的時間再 read，要讀到正確的值');
  },
  async (tok, S) => { // @1170 ~那或者是有不同的process去write它的時候
    S.r.add('③ 對同一 location 的 write 要 serialized：所有 processor 看到同一個順序');
    cap('三：P1、P2 都去 write', '每個 processor 看到的順序一定要相同');
  },
], [[0, 3.2, 15], [0, 2.8, 0]]);

// snooping 的 invalidation 例子（P&H 圖 5.40，write-back cache）
const SNP = (() => { const s = [{ a: 0, b: null, m: 0 }]; s.push({ a: 0, b: 0, m: 0 }); s.push({ a: 1, b: 'invalid', m: 0 }); s.push({ a: 1, b: 1, m: 1 }); return { s, ok: s[2].b === 'invalid' && s[3].b === 1 && s[3].m === 1 }; })();
scene('cvm-26b-snoop', 'Coherence protocol：directory 與 snooping（write invalidate）', [
  async (tok, S) => { // @1213 ~那我們要怎麼樣去維持這個這個cache coherence的protocol
    S.t0 = hot('怎麼維持 coherence？同一個 data 經 migration、replication 出現很多 copy', 0, 6.8);
    cap('怎麼維持 cache coherence？', '同一個 data 在不同 processor 有好幾個 copy');
  },
  async (tok, S) => { // @1234 ~那有兩個方法這次要snooping
    S.dir = bx('Directory-based', NC.lilac, -3.4, 5.8, 0, 3.0, 0.6); S.snp = bx('Snooping', NC.mint, 3.4, 5.8, 0, 2.6, 0.6);
    cap('兩種 protocol', 'snooping，或 directory-based');
  },
  async (tok, S) => { // @1241 ~這個的話比較像centralize我有一個directory
    S.d1 = sm('centralized：directory 記錄誰有這個 data、有沒有被 update、誰可以寫', -3.4, 5.0);
    cap('Directory-based 像 centralized', '一個 directory 記錄所有 share 的狀況');
  },
  async (tok, S) => { // @1257 ~那另外一個叫Snooping的protocol
    S.bus = bx('bus（interconnect）', NC.tan, 0, 2.2, 0, 10.0, 0.4);
    S.cs = ['cache A', 'cache B', 'cache C'].map((t, i) => bx(t, [NC.sky, NC.rose, NC.mint][i], -4 + i * 4, 3.6, 0, 2.0, 0.6));
    cap('Snooping：沒有 centralized 的東西', '每個 processor 自己去監看 interconnect（bus）');
  },
  async (tok, S) => { // @1320 ~Snoop就是這個意思
    S.s1 = sm('snoop = 管閒事、到處探聽：每個 cache 盯著 bus 上的傳輸', 3.4, 5.0);
    cap('Snoop 就是愛管閒事、探聽別人', '每個 processor 都去看別人在做什麼');
  },
  async (tok, S) => { // @1342 ~也就是你要去watch這個傳輸的地方只要有人把它改過之後呢
    S.s2 = good('有人改了 → 自己有 copy 的就 invalidate', 3.4, 4.4);
    cap('有人把 data 改了', '你如果有這個 copy，就把它 invalidate');
  },
  async (tok, S) => { // @1360 ~他要去write的時候他一定是exclusive access to the block
    gone(S.d1, S.s1, S.s2); S.w = sm('write 要 exclusive access：同時不能兩個人寫', 0, 6.0);
    cap('Invalidating snooping protocol', '要 write 的 cache 一定要拿到 exclusive access');
  },
  async (tok, S) => { // @1378 ~然後同時你要invalidate這個message在bus上面
    S.msg = bx('invalidate X', NC.red, -4, 2.2, 0.5, 1.8, 0.4); await slide(tok, S.msg, 4, 2.2, 0.5, 900);
    cap('同時在 bus 上 broadcast invalidate', '其他 cache 看到就把自己的 copy 變 invalid');
  },
  async (tok, S) => { // @1410 ~那這個這邊有一個例子就是說假如catch A去讀X
    kill(S.msg); gone(S.w); kill(S.cs[2]);
    S.mem = bx('memory X = 0', NC.tan, 4.4, 0.8, 0, 2.6, 0.55);
    relabel(S.cs[0], 'A：X = ' + SNP.s[1].a); relabel(S.cs[1], 'B：X = ' + SNP.s[1].b);
    cap('例子：A 讀 X 得 0，B 也讀 X 得 0', '目前沒問題');
  },
  async (tok, S) => { // @1416 ~那A又去write1到1那他這時候write1的時候那這個他就要發出invalidate的這個Message
    relabel(S.cs[0], 'A：X = ' + SNP.s[2].a); relabel(S.cs[1], 'B：' + SNP.s[2].b); glow(S.cs[1], NG); glow(S.cs[0], OKG);
    S.n = sm('write-back：memory 還是舊的 0', 4.4, 0.2);
    cap('A 寫 1：發出 invalidate message', 'B 看到了，就把自己的 data invalidate');
  },
  async (tok, S) => { // @1441 ~可當他在Access當B要去讀他的時候
    glow(S.cs[1], null); relabel(S.cs[1], 'B：X = ' + SNP.s[3].b); relabel(S.mem, 'memory X = ' + SNP.s[3].m); gone(S.n);
    S.k = ok(SNP.ok, 'B 讀 X → miss → 找 owner A 拿 1，同時 update memory ✓', 0, -0.4);
    cap('B 再讀 X：已 invalid → cache miss', '跟 owner A 要資料，同時把 memory update');
  },
  async (tok, S) => { // @1469 ~這是基本上snooping的概念就是說大家管大家的
    S.s = good('snooping：各管各的；寫時發 invalidate，別人 miss 時跟 owner 要', 0, 6.0);
    cap('Snooping 的基本概念', '寫就發 signal，大家把自己的 invalidate；miss 時跟 owner 要');
  },
]);

scene('cvm-26b-intel', '例子：Intel 四核心的三層 cache', [
  async (tok, S) => { // @1493 ~這個是這個Intel的一個4Core的Process的一個大概圖
    S.cores = [0, 1, 2, 3].map((i) => bx('core ' + i, NC.teal, -4.5 + i * 3.0, 6.0, 0, 2.2, 0.6));
    cap('Intel 的 4-core processor', '看現在 advanced 的 processor 長什麼樣子');
  },
  async (tok, S) => { // @1505 ~它這個裡面Level 1的它有3個Level的Cache
    S.t1 = sm('三層 cache：L1、L2、L3（以前只講一層）', 0, 6.75);
    cap('有 3 個 level 的 cache', '以前我們只講到一層');
  },
  async (tok, S) => { // @1519 ~而且這Cache是有Share的還有不Share的
    S.l1 = [0, 1, 2, 3].map((i) => bx('L1 I$ | D$', NC.sky, -4.5 + i * 3.0, 5.0, 0, 2.2, 0.55));
    cap('Level 1：I-cache 和 D-cache', '每個 core 自己的：private cache');
  },
  async (tok, S) => { // @1529 ~就Level1跟Level2都是PrivateCache
    S.l2 = [0, 1, 2, 3].map((i) => bx('L2（private）', NC.lilac, -4.5 + i * 3.0, 4.1, 0, 2.2, 0.55));
    cap('Level 2 也是 private', '每個 core 自己有自己的 copy');
  },
  async (tok, S) => { // @1538 ~但Level3這邊它有8個MB是Share的
    S.l3 = bx('L3：8 MB，四個 core 共用（shared）', NC.mint, 0, 3.0, 0, 11.0, 0.7);
    cap('Level 3：8 MB 是 shared', '大家都可以來這裡拿 data');
  },
  async (tok, S) => { // @1587 ~那tlb它是用成2-level的tlb
    S.tlb = sm('TLB 也做成 2-level', 0, 2.1);
    cap('TLB 也有兩層', '');
  },
  async (tok, S) => { // @1596 ~回去看一下這些數字有一個概念
    S.t2 = sm('投影片比較 Intel 與 AMD 的 TLB、cache 大小與 replacement（回去自己看）', 0, 1.4);
    cap('投影片比較 Intel 和 AMD', 'TLB、cache 的 size、replacement，回去看看');
  },
]);

// pitfalls：byte address vs word / block / page address（老師的數字：word 4 B、block 32 B、page 4 KiB）
const PF = (() => { const a = 32; const w = a - lg2(4), blk = a - lg2(32), pg = a - lg2(4096); return { w, blk, pg, offB: lg2(32), offP: lg2(4096) }; })();
scene('cvm-26b-pitfall', 'Pitfall：byte address 與 word／block／page address', [
  async (tok, S) => { // @1616 ~那最後呢好還有一些注意事項
    S.t0 = hot('Pitfalls：不要犯的錯', 0, 6.8);
    cap('最後一些注意事項', '不要犯的錯');
  },
  async (tok, S) => { // @1625 ~buy address跟award address不要搞錯
    S.t1 = sm('byte address ≠ word address：先搞清楚 word、block、page 的 size', 0, 6.2);
    cap('Byte address 和 word address 不要搞錯', '算 index、page number 前先搞清楚 size');
  },
  async (tok, S) => { // @1641 ~也就是32個bit是byte address
    S.a = fields([{ n: 'byte address', b: 32, c: NC.tan }], 0, 5.0, { unit: 0.3 });
    cap('2³² 個 byte：32 bits 是 byte address', '不是 word address');
  },
  async (tok, S) => { // @1650 ~假如我告訴你說一個word是4個byte的話
    S.w = fields([{ n: 'word address', b: PF.w, c: NC.sky }, { n: 'byte', b: 2, c: NC.rose }], 0, 3.8, { unit: 0.3 });
    S.k1 = ok(PF.w === 30, 'word 4 bytes → 後 2 bits 是 offset → word address = 前 ' + PF.w + ' bits ✓', 0, 3.1);
    cap('一個 word 4 個 byte', 'word address 看前 30 個 bit');
  },
  async (tok, S) => { // @1714 ~那我現在變化一下block catch your block也是32筆
    S.b = fields([{ n: 'block address', b: PF.blk, c: NC.green }, { n: 'offset', b: PF.offB, c: NC.rose }], 0, 2.2, { unit: 0.3 });
    cap('Cache block 32 個 byte', 'block address 有幾個 bit？');
  },
  async (tok, S) => { // @1767 ~如果是32個byte的話2的4的8 16 32 32要用掉5個bit
    S.k2 = ok(PF.offB === 5 && PF.blk === 27, '32 = 2⁵ → offset 5 bits → block address ' + PF.blk + ' bits ✓', 0, 1.5);
    cap('32 = 2⁵ 用掉 5 個 bit', 'block address 是 27 bits');
  },
  async (tok, S) => { // @1801 ~那現在配舉也是2的32字方那一個page是4K byte
    S.p = fields([{ n: 'page number', b: PF.pg, c: NC.purple }, { n: 'page offset', b: PF.offP, c: NC.orange }], 0, 0.6, { unit: 0.3 });
    S.k3 = ok(PF.offP === 12, '4K = 4 × 1024 = 2¹² → 12 bits ✓', -3.0, -0.1);
    cap('Page 4K bytes 用掉幾個 bit？', '4 × 1024 = 2¹² → 12 bits');
  },
  async (tok, S) => { // @1833 ~好所以他的page number是幾個bit
    S.k4 = ok(PF.pg === 20, 'page number = 32 − 12 = ' + PF.pg + ' bits ✓', 3.0, -0.1);
    cap('Page number 幾個 bit？', '32 − 12 = 前面 20 個 bit');
  },
  async (tok, S) => { // @1874 ~所以它概念其實是一樣
    S.t2 = good('同一個概念：word／block／page number = 去掉 size 那幾個 low-order bits', 0, -0.8);
    cap('Page、block、word number 概念一樣', '看 size 多大，剩下的部分就是它的 address');
  },
], [[0, 3.0, 15], [0, 2.6, 0]]);

// 2-D array（示意）：4 × 4 row-major，每個 block 放 4 個 element，cache 只放得下 2 個 block（LRU）
const ARR = (() => { const N = 4, run = (order) => { const c = []; let miss = 0; for (const [r, k] of order) { const blk = r; const i = c.indexOf(blk); if (i >= 0) c.splice(i, 1); else { miss++; if (c.length === 2) c.shift(); } c.push(blk); } return miss; }; const row = [], col = []; for (let r = 0; r < N; r++) for (let k = 0; k < N; k++) row.push([r, k]); for (let k = 0; k < N; k++) for (let r = 0; r < N; r++) col.push([r, k]); return { row: run(row), col: run(col) }; })();
scene('cvm-26b-array', '寫程式也要想到 locality：row-major 陣列', [
  async (tok, S) => { // @1907 ~就是說你在做design的寫著code的時候
    S.t0 = hot('寫 code 時別忘了 memory system 與 locality', 0, 6.8);
    cap('寫 code 的時候', '千萬不要忘了 memory system 和 locality');
  },
  async (tok, S) => { // @1918 ~譬如你array你突然是你的index是第一個完了就第二個第三第四
    S.one = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => bx(String(i), NC.sky, -4.2 + i * 1.2, 6.0, 0, 1.1, 0.5));
    cap('一維 array：index 一個接一個', '好像有 locality，很棒');
  },
  async (tok, S) => { // @1930 ~如果你是你現在要你這樣譬如說2-dimension好了
    gone(S.one);
    S.g = []; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) S.g.push(bx('a' + r + k, [NC.sky, NC.rose, NC.mint, NC.lilac][r], -5.4 + k * 1.1, 5.6 - r * 0.6, 0, 1.0, 0.5));
    S.mem = []; for (let i = 0; i < 16; i++) { const r = i >> 2, k = i & 3; S.mem.push(bx('a' + r + k, [NC.sky, NC.rose, NC.mint, NC.lilac][r], -5.6 + i * 0.75, 2.6, 0, 0.7, 0.45)); }
    S.ml = sm('memory 是一維的：row major（一個 row 擺完再擺下一個 row）', 0, 1.9);
    cap('二維 array 怎麼擺進一維的 memory？', 'row major 或 column major，要自己決定');
  },
  async (tok, S) => { // @1987 ~那現在呢假如你擺了字role major是一個row擺完一個row
    for (let i = 0; i < 4; i++) glow(S.mem[i], OKG);
    S.k1 = ok(ARR.row === 4, 'row by row 走 16 個 element：只 miss ' + ARR.row + ' 次（每個 block 一次，示意）✓', 0, 1.2);
    cap('Row major，你也一個 row 一個 row 存取', '連續擺在一起，locality 很棒');
  },
  async (tok, S) => { // @2001 ~假如你知道你寫的時候你知道這個機器它擺了字role major但是你的access是column
    S.mem.forEach((m) => glow(m, null)); [0, 4, 8, 12].forEach((i) => glow(S.mem[i], NG));
    S.k2 = ok(ARR.col === 16, 'column by column：每次跳一整個 row → ' + ARR.col + ' 次都 miss（示意）✓', 0, 0.5);
    cap('可是你一個 column 一個 column 存取', '每次都跳一大段 → 沒有 locality');
  },
  async (tok, S) => { // @2015 ~所以它的意思就是要注意這件事情
    S.t2 = bad('跟擺法不 match → 很多 cache miss，變慢', 0, -0.2);
    cap('要知道 memory 系統長什麼樣子、怎麼擺', '不 match 就會有很多 cache miss');
  },
], [[0, 3.2, 15], [0, 2.8, 0]]);

scene('cvm-26b-ooo', 'Multiprocessor 與 out-of-order 的效能評估', [
  async (tok, S) => { // @2050 ~再來他說如果你multiprocessor的話呢你的associate比較注意到
    S.t1 = sm('multiprocessor：很多人同時 map 到同一個位置 → associativity 要大一點', 0, 6.0);
    cap('Multiprocessor', '很多人同時 map 到同一位置，associativity 要增加');
  },
  async (tok, S) => { // @2067 ~在all of all的process的時候像我們superscaler雖然有cache miss這件事情
    S.fu = ['FU 1', 'FU 2', 'FU 3'].map((t, i) => bx(t, NC.teal, -3 + i * 3, 4.4, 0, 2.0, 0.6)); glow(S.fu[0], NG); glow(S.fu[1], OKG); glow(S.fu[2], OKG);
    S.t2 = sm('out-of-order superscalar：一個 cache miss，其他 ready 的指令照樣 run → miss 被 hide', 0, 3.4);
    cap('Out-of-order superscalar：有 cache miss', '但別的 ready 的指令照樣 run');
  },
  async (tok, S) => { // @2093 ~所以要用simulation
    S.t3 = hot('不能只用 miss 數算 performance → 要用 simulation', 0, 2.4);
    cap('不能只用 cache miss 算 performance', '要用 simulation 看整體');
  },
]);

scene('cvm-26b-end', '結論：fast 又 large 的 memory 錯覺', [
  async (tok, S) => { // @2129 ~他說這個fast memory呢一定是small large memory slow
    S.f = bx('fast → small', NC.green, -3.0, 5.6, 0, 2.6, 0.7); S.l = bx('large → slow', NC.metal, 3.0, 5.6, 0, 2.6, 0.7);
    cap('Fast memory 一定 small', 'large memory 一定 slow');
  },
  async (tok, S) => { // @2134 ~但是呢我們透過hierarchy的
    S.t1 = good('hierarchy + caching：看起來又快、又大', 0, 4.6);
    cap('透過 hierarchy 和 caching 的 idea', '看起來像又快又大的 memory');
  },
  async (tok, S) => { // @2152 ~locality如果你沒有這個也達不到
    S.t2 = sm('靠 locality：任何時刻只需要一小部分（working window）', 0, 3.9);
    cap('關鍵是 locality', '任何時間只需要一小部分，搬進來就好');
  },
  async (tok, S) => { // @2166 ~Memory hierarchy可以很多很多層
    S.lv = ['L1', 'L2', 'L3', 'Memory', 'Disk'].map((t, i) => bx(t, [NC.green, NC.mint, NC.sky, NC.tan, NC.metal][i], -4.8 + i * 2.4, 2.6, 0, 2.0, 0.6));
    cap('Hierarchy 可以很多層', '光 cache 就 L1、L2、L3，再往下是 memory');
  },
  async (tok, S) => { // @2176 ~Memory系統的design很重要尤其在multiprocessor也是很重要
    S.t3 = hot('memory 系統的 design 很重要：single、multiprocessor 都是', 0, 1.4);
    cap('Memory 系統的 design 很重要', 'single processor、multiprocessor 都一樣');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['vm-idea', 'va-split', 'page-table', 'page-fault', 'pt-size', 'tlb', 'tlb-seq', 'tlb-cache', 'combos', 'dram-org', 'mem-org-3', 'interleave-map', 'interleave-pipe'].concat(FRAG.map((f) => f[0])),
    _genQ: genQ,
    stop() { stopTimer(); },
  };
}
