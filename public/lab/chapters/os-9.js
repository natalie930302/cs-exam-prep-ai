// 作業系統 第9章：檔案系統（access method、directory、mount、ACL、allocation、inode、free space）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
// 影片：清大 周志遠 第23A–25B講（23C、25A 有字幕，場景依字幕重現；其餘依恐龍書 Ch.13–14 補）。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const C = { file: '#4b9ee2', other: '#c9bba3', idx: '#c08a1f', dir: '#4b9ee2', fil: '#dd8238', free: '#2fc092', bad: '#d64545', fat: '#9b7ef4', vol: '#31aab0', mem: '#e55a9b' };
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
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m) m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); else { m.userData.lbl = lab.label(String(t), 'val'); m.add(m.userData.lbl); } };
  function seg(a, b, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok !== undefined) await beat(tok, ms / steps); else await sleep(ms / steps); } }
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  function fmtSize(b) {
    const U = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0; while (b >= 1024 && i < U.length - 1) { b /= 1024; i++; }
    return (Math.round(b * 100) / 100) + ' ' + U[i];
  }

  // 磁碟格子：32 個 block，8 欄 × 4 列（恐龍書圖 14.x 的 0–31 號）
  const COLS = 8, SP = 1.2, BS = [1.0, 0.36, 1.0];
  const gp = (i, y = 0.2, ox = 0, oz = 0) => V3(ox + (i % COLS - 3.5) * SP, y, oz + (Math.floor(i / COLS) - 1.5) * SP);
  function diskGrid(n = 32, ox = 0, oz = 0) {
    for (let i = 0; i < n; i++) { const p = gp(i, 0.04, ox, oz); ctx.tile(p, 1.06, 1.06); tag(String(i), 'idx', p.x - 0.36, 0.08, p.z + 0.4); }
  }
  const blk = (i, text, color, ox = 0, oz = 0, drop = 0) => { const p = gp(i, 0.2, ox, oz); return cube(text, color, BS, p.x, 0.2, p.z, drop); };
  function cursorAt(l, i, ox = 0, oz = 0) { const p = gp(i, 1.0, ox, oz); l.position.set(p.x, 1.0, p.z); }

  // 樹狀／圖狀目錄：節點放在 x-y 平面
  function graph(nodes, edges, drop = 0) {
    const M = {};
    for (const [id, n] of Object.entries(nodes)) {
      const w = Math.max(0.9, n.name.length * 0.16 + 0.5);
      const col = n.color || (n.kind === 'dir' ? C.dir : n.kind === 'vol' ? C.vol : C.fil);
      M[id] = cube(n.name, col, [w, 0.5, 0.5], n.x, n.y, 0, drop);
    }
    const E = edges.map(([a, b, t]) => {
      const A = nodes[a], B = nodes[b];
      const col = t === 'link' ? '#c08a1f' : t === 'cyc' ? '#d64545' : '#8a7a60';
      const l = t === 'cyc' ? seg(V3(A.x + 0.3, A.y + 0.25, 0.2), V3(B.x + 0.3, B.y - 0.25, 0.2), col) : seg(V3(A.x, A.y - 0.25), V3(B.x, B.y + 0.25), col);
      return { a, b, t, l };
    });
    return { M, E };
  }

  // ───────────────────────── 模式 1：配置方式 ─────────────────────────
  const OTHER = [2, 3, 7, 13, 14, 20, 21, 29];      // 別人的檔案（灰）
  const AL = { method: 'contig', n: 5, used: new Set(), file: null, ox: -1.6 };
  const AL_NAMES = { contig: 'Contiguous', linked: 'Linked', fat: 'FAT', indexed: 'Indexed' };
  function enterAlloc() {
    stopTimer();
    lab.frameCamera([0.6, 9.5, 8.2], [0.6, 0, 0.5]);
    controls(
      '<select id="aM"><option value="contig">Contiguous 連續</option><option value="linked">Linked 鏈結</option><option value="fat">FAT</option><option value="indexed">Indexed 索引</option></select>'
      + '<label>檔案 <input id="aN" type="number" min="1" max="20" value="' + AL.n + '"> 塊</label><button class="primary" id="aNew">配置檔案</button>'
      + '<label>讀第 <input id="aK" type="number" min="1" max="20" value="3"> 塊</label><button id="aRead">讀取</button><button id="aReset">重設磁碟</button>'
    );
    $('aM').value = AL.method;
    $('aM').onchange = (e) => { AL.method = e.target.value; resetAlloc(); };
    on('aNew', () => { if (!busy) return allocFile(Number($('aN').value) || 1); });
    on('aRead', () => { if (!busy) return readBlock(Number($('aK').value) || 1); });
    on('aReset', () => resetAlloc());
    resetAlloc();
  }
  function resetAlloc() {
    lab.clear(); clearLog();
    diskGrid(32, AL.ox);
    AL.used = new Set(OTHER); AL.file = null; AL.meshes = [];
    OTHER.forEach((i) => blk(i, '', C.other, AL.ox));
    AL.dir = tag('directory：（空）', 'ptr', AL.ox, 0.3, -3.4);
    AL.panel = null;
    log(AL_NAMES[AL.method] + '：灰色是別人的檔案。輸入塊數按「配置檔案」。');
    allocState('—');
  }
  function allocState(last) {
    const f = AL.file;
    const rows = [['方式', AL_NAMES[AL.method]], ['檔案塊', f ? f.blocks.join(', ') : '（尚未配置）'], ['剩餘空塊', String(32 - AL.used.size)], ['上次讀取', last]];
    const F = {
      contig: 'directory 存 (start, length)<br>第 k 塊 = start + k − 1 → <span class="ok">1 次 I/O</span>；缺點：外部碎裂、檔案難長大',
      linked: '每塊尾巴存下一塊的 pointer<br>讀第 k 塊要先讀前 k−1 塊 → <span class="no">k 次 I/O</span>',
      fat: 'pointer 集中在 FAT，mount 時載入 memory<br>查表在 memory 做 → 讀資料 <span class="ok">1 次 I/O</span>',
      indexed: 'pointer 集中在 index block<br>讀 index block + 資料 → <span class="ok">2 次 I/O</span>（index block 已快取則 1 次）',
    };
    setState('檔案配置：' + AL_NAMES[AL.method], rows, F[AL.method]);
  }
  function freeList() { const r = []; for (let i = 0; i < 32; i++) if (!AL.used.has(i)) r.push(i); return r; }
  function scatter(n) { const fr = freeList(); const r = []; while (r.length < n && fr.length) r.push(fr.splice(Math.floor(Math.random() * fr.length), 1)[0]); return r; }
  async function allocFile(n, tok) {
    if (AL.file) { const keep = AL.method; resetAlloc(); AL.method = keep; }
    const need = AL.method === 'indexed' ? n + 1 : n;
    if (need > freeList().length) { log('空間不夠：要 ' + need + ' 塊，只剩 ' + freeList().length + ' 塊。', true); return; }
    let blocks, ib = null;
    if (AL.method === 'contig') {
      let start = -1;
      for (let s = 0; s + n <= 32 && start < 0; s++) { let ok = true; for (let k = 0; k < n; k++) if (AL.used.has(s + k)) { ok = false; break; } if (ok) start = s; }
      if (start < 0) { log('找不到連續 ' + n + ' 個空塊（總共還有 ' + freeList().length + ' 塊空）→ external fragmentation！', true); say('有空間卻放不下：外部碎裂', ''); return; }
      blocks = Array.from({ length: n }, (_, k) => start + k);
    } else if (AL.method === 'indexed') { const s = scatter(n + 1); ib = s[0]; blocks = s.slice(1); }
    else blocks = scatter(n);
    busy = true;
    try {
      AL.file = { blocks, ib };
      blocks.forEach((b) => AL.used.add(b));
      if (ib !== null) AL.used.add(ib);
      for (let k = 0; k < blocks.length; k++) {
        AL.meshes.push(blk(blocks[k], k + 1, C.file, AL.ox, 0, 3));
        if (AL.method === 'linked' && k > 0) seg(gp(blocks[k - 1], 0.45, AL.ox), gp(blocks[k], 0.45, AL.ox), '#c08a1f');
        await wait(tok, 160);
      }
      if (AL.method === 'contig') txt(AL.dir, 'directory：f  start ' + blocks[0] + '  length ' + n);
      if (AL.method === 'linked') { txt(AL.dir, 'directory：f  start ' + blocks[0] + '  end ' + blocks[n - 1]); log('每塊最後 4 bytes 存下一塊號碼，最後一塊存 −1（nil）。'); }
      if (AL.method === 'fat') {
        txt(AL.dir, 'directory：f  start ' + blocks[0]);
        const lines = ['FAT（在 memory）'].concat(blocks.map((b, k) => 'FAT[' + String(b).padStart(2) + '] = ' + (k < n - 1 ? blocks[k + 1] : 'EOF')));
        AL.panel = code(lines.slice(0, 13), 5.6, 3.6, 0.42);
        if (lines.length > 13) log('FAT 表太長，畫面只列前 12 項。');
      }
      if (AL.method === 'indexed') {
        AL.meshes.push(blk(ib, 'IB', C.idx, AL.ox, 0, 3));
        blocks.forEach((b) => seg(gp(ib, 0.45, AL.ox), gp(b, 0.45, AL.ox), '#c08a1f'));
        txt(AL.dir, 'directory：f  index block ' + ib);
        const p = gp(ib, 1.2, AL.ox); tag('[' + blocks.join(',') + ']', 'ptr alt', p.x, 1.2, p.z);
      }
      log('配置完成：' + blocks.join(' → ') + (ib !== null ? '（index block = ' + ib + '）' : ''));
      allocState('—');
    } finally { busy = false; }
  }
  async function readBlock(k, tok) {
    const f = AL.file;
    if (!f) { log('先配置一個檔案。', true); return; }
    if (k < 1 || k > f.blocks.length) { log('檔案只有 ' + f.blocks.length + ' 塊，沒有第 ' + k + ' 塊。', true); return; }
    busy = true;
    try {
      const cur = tag('讀', 'ptr alt', 0, 1, 0);
      let io = 0;
      const visit = async (b, text, ms) => { cursorAt(cur, b, AL.ox); io++; const m = AL.meshes.find((mm) => { const p = gp(b, 0.2, AL.ox); return Math.abs(mm.position.x - p.x) < 0.01 && Math.abs(mm.position.z - p.z) < 0.01; }); if (m) glow(m, GOLD); say(text, 'I/O 次數 = ' + io); await wait(tok, ms); if (m) glow(m, null); };
      if (AL.method === 'contig') await visit(f.blocks[k - 1], 'start + ' + (k - 1) + ' = ' + f.blocks[k - 1] + '：直接算出位置', 900);
      if (AL.method === 'linked') for (let j = 0; j < k; j++) await visit(f.blocks[j], j < k - 1 ? '讀第 ' + (j + 1) + ' 塊，只為了拿 pointer' : '到了：第 ' + k + ' 塊', 600);
      if (AL.method === 'fat') { if (AL.panel) for (let j = 0; j < k && j < 12; j++) { AL.panel.hl(j + 1); await wait(tok, 260); } say('在 memory 沿 FAT 走 ' + (k - 1) + ' 步（不算 I/O）', ''); await wait(tok, 700); await visit(f.blocks[k - 1], '讀 block ' + f.blocks[k - 1], 900); }
      if (AL.method === 'indexed') { await visit(f.ib, '先讀 index block ' + f.ib + '，看第 ' + k + ' 格', 900); await visit(f.blocks[k - 1], '第 ' + k + ' 格 = ' + f.blocks[k - 1] + '：直接讀', 900); }
      kill(cur);
      log('讀第 ' + k + ' 塊：' + io + ' 次 disk I/O（' + AL_NAMES[AL.method] + '）');
      allocState('第 ' + k + ' 塊：' + io + ' 次 I/O');
    } finally { busy = false; }
  }

  // ───────────────────────── 模式 2：UNIX inode ─────────────────────────
  const IN = { bs: 4, ps: 4, nd: 12, off: 100, unit: 'KB', cached: true };
  const inodeE = () => IN.bs * 1024 / IN.ps;
  function inodeMax() { const e = inodeE(); return (IN.nd + e + e * e + e * e * e) * IN.bs * 1024; }
  function locate(k) {
    const e = inodeE(), d = IN.nd;
    if (k < d) return { lvl: 0, slot: k, idx: [] };
    k -= d; if (k < e) return { lvl: 1, slot: d, idx: [k] };
    k -= e; if (k < e * e) return { lvl: 2, slot: d + 1, idx: [Math.floor(k / e), k % e] };
    k -= e * e; if (k < e * e * e) return { lvl: 3, slot: d + 2, idx: [Math.floor(k / e / e), Math.floor(k / e) % e, k % e] };
    return null;
  }
  let INO = null;
  function buildInode(caps) {
    const shownD = Math.min(IN.nd, 12);
    const tot = shownD + 3;
    const slots = [];
    tag('inode', 'ptr', -5.3, 0.4, -3.75);
    for (let i = 0; i < tot; i++) {
      const z = -3.1 + i * (6.2 / (tot - 1));
      const ind = i >= shownD;
      const nm = ind ? ['single', 'double', 'triple'][i - shownD] : String(i);
      const m = cube('', ind ? C.idx : C.file, [1.1, 0.28, 0.32], -5.3, 0.14, z);
      tag(nm, 'idx', ind ? -6.4 : -6.1, 0.1, z);
      slots.push({ m, z });
    }
    if (IN.nd > 12) tag('（direct 共 ' + IN.nd + ' 格）', 'idx', -5.3, 0.1, 3.7);
    INO = { slots, shownD, objs: [] };
    if (caps) {
      const e = inodeE(), B = IN.bs * 1024;
      const capT = [IN.nd * B, e * B, e * e * B, e * e * e * B];
      INO.caps = [
        tag(fmtSize(capT[0]), 'idx', -3.9, 0.1, slots[Math.floor(shownD / 2)].z),
        tag('+' + fmtSize(capT[1]), 'idx', -3.9, 0.1, slots[shownD].z),
        tag('+' + fmtSize(capT[2]), 'idx', -3.9, 0.1, slots[shownD + 1].z),
        tag('+' + fmtSize(capT[3]), 'idx', -3.9, 0.1, slots[shownD + 2].z),
      ];
    }
    return INO;
  }
  function clearPath() { if (INO) { INO.objs.forEach(kill); INO.objs = []; INO.slots.forEach((s) => glow(s.m, null)); } }
  async function inodeLookup(off, tok) {
    clearPath();
    const B = IN.bs * 1024, k = Math.floor(off / B), L = locate(k);
    if (!L) { log('offset ' + fmtSize(off) + ' 超過最大檔案大小 ' + fmtSize(inodeMax()) + '。', true); say('超過 inode 能指到的範圍', ''); return null; }
    const slotI = L.lvl === 0 ? Math.min(L.slot, INO.shownD - 1) : INO.shownD + L.lvl - 1;
    const s = INO.slots[slotI];
    let acc = IN.cached ? 0 : 1;
    const cnt = tag('', 'ptr alt', 0, 2.6, -3.6); INO.objs.push(cnt);
    const show = (cap) => { txt(cnt, 'disk 存取 ' + acc + ' 次'); say(cap, '第 ' + k + ' 個 block（0 起算）＝ ⌊' + fmtSize(off) + ' ÷ ' + IN.bs + 'KB⌋'); };
    if (!IN.cached) { show('先讀 inode 本身（不在 memory）'); await wait(tok, 1100); }
    glow(s.m, GOLD);
    show(L.lvl === 0 ? 'direct[' + L.slot + ']：直接指到資料' : ['single', 'double', 'triple'][L.lvl - 1] + ' indirect：多 ' + L.lvl + ' 層 index');
    await wait(tok, 1100);
    let prev = V3(-4.75, 0.3, s.z);
    for (let j = 0; j < L.lvl; j++) {
      const x = -2.4 + j * 2.5, z = s.z * (1 - (j + 1) / (L.lvl + 1));
      const m = cube('IB', C.idx, [1.3, 0.5, 1.1], x, 0.25, z, 2.5); INO.objs.push(m);
      const l = tag('第 ' + L.idx[j] + ' 格', 'idx', x, 0.9, z + 0.8); INO.objs.push(l);
      INO.objs.push(seg(prev, V3(x - 0.65, 0.3, z), '#c08a1f'));
      prev = V3(x + 0.65, 0.3, z);
      acc++; show('讀第 ' + (j + 1) + ' 層 index block，取第 ' + L.idx[j] + ' 格');
      await wait(tok, 1100);
    }
    const dm = cube('data', C.free, [1.3, 0.5, 1.1], 5.3, 0.25, 0, 2.5); INO.objs.push(dm);
    INO.objs.push(seg(prev, V3(4.65, 0.3, 0), '#2fc092'));
    acc++; show('讀資料 block 本身');
    await wait(tok, 900);
    return { k, L, acc };
  }
  function enterInode() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 9, 9], [0, 0, 0.2]);
    controls(
      '<label>block <select id="iB"><option>1</option><option>2</option><option>4</option><option>8</option></select>KB</label>'
      + '<label>pointer <select id="iP"><option>4</option><option>8</option></select>B</label>'
      + '<label>direct <input id="iD" type="number" min="1" max="16" value="' + IN.nd + '"></label>'
      + '<label>offset <input id="iO" type="number" min="0" value="' + IN.off + '"></label><select id="iU"><option>B</option><option>KB</option><option>MB</option><option>GB</option></select>'
      + '<label><input id="iC" type="checkbox"' + (IN.cached ? ' checked' : '') + '>inode 已在 memory</label><button class="primary" id="iGo">找這個 byte</button>'
    );
    $('iB').value = String(IN.bs); $('iP').value = String(IN.ps); $('iU').value = IN.unit;
    const re = () => { IN.bs = Number($('iB').value); IN.ps = Number($('iP').value); IN.nd = Math.max(1, Math.min(16, Number($('iD').value) || 12)); enterInode(); };
    $('iB').onchange = re; $('iP').onchange = re; $('iD').onchange = re;
    $('iC').onchange = (e) => { IN.cached = e.target.checked; };
    on('iGo', async () => {
      if (busy) return; busy = true;
      try {
        IN.off = Number($('iO').value) || 0; IN.unit = $('iU').value;
        const mul = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 }[IN.unit];
        const r = await inodeLookup(IN.off * mul);
        if (r) { log('offset ' + IN.off + ' ' + IN.unit + ' → block ' + r.k + '，' + (r.L.lvl ? ['single', 'double', 'triple'][r.L.lvl - 1] + ' indirect' : 'direct') + '，共 ' + r.acc + ' 次 disk 存取'); inodeState(r); }
      } finally { busy = false; }
    });
    buildInode(true);
    log('每個 index block 可放 ' + IN.bs + 'KB ÷ ' + IN.ps + 'B = ' + inodeE() + ' 個 pointer。');
    inodeState(null);
  }
  function inodeState(r) {
    const e = inodeE(), B = IN.bs * 1024;
    setState('UNIX inode（combined scheme）', [
      ['每塊 pointer 數', e + ''], ['direct', IN.nd + ' × ' + IN.bs + 'KB = ' + fmtSize(IN.nd * B)], ['single', e + ' × ' + IN.bs + 'KB = ' + fmtSize(e * B)],
      ['double', e + '² × ' + IN.bs + 'KB = ' + fmtSize(e * e * B)], ['triple', e + '³ × ' + IN.bs + 'KB = ' + fmtSize(e * e * e * B)],
    ], '最大檔案 = <span class="ok">' + fmtSize(inodeMax()) + '</span>' + (r ? '<br>這次：block ' + r.k + ' → ' + r.acc + ' 次 disk 存取' : '<br>存取次數 =（inode 不在 memory 時 +1）+ 層數 + 1'));
  }

  // ───────────────────────── 模式 3：目錄結構 ─────────────────────────
  const DSPEC = {
    single: () => ({
      nodes: { r: { name: 'directory', x: 0, y: 5, kind: 'dir' }, a: { name: 'cat', x: -5, y: 2.6 }, b: { name: 'bo', x: -3, y: 2.6 }, c: { name: 'a', x: -1, y: 2.6 }, d: { name: 'test', x: 1, y: 2.6 }, e: { name: 'data', x: 3, y: 2.6 }, f: { name: 'mail', x: 5, y: 2.6 } },
      edges: [['r', 'a'], ['r', 'b'], ['r', 'c'], ['r', 'd'], ['r', 'e'], ['r', 'f']],
    }),
    two: () => ({
      nodes: { r: { name: 'MFD', x: 0, y: 5.6, kind: 'dir' }, u1: { name: 'user1', x: -3.5, y: 3.8, kind: 'dir' }, u2: { name: 'user2', x: 3.5, y: 3.8, kind: 'dir' },
        a: { name: 'cat', x: -5.4, y: 1.8 }, b: { name: 'test', x: -3.5, y: 1.8 }, c: { name: 'a', x: -1.6, y: 1.8 }, d: { name: 'a', x: 1.8, y: 1.8 }, e: { name: 'data', x: 3.6, y: 1.8 }, f: { name: 'x', x: 5.4, y: 1.8 } },
      edges: [['r', 'u1'], ['r', 'u2'], ['u1', 'a'], ['u1', 'b'], ['u1', 'c'], ['u2', 'd'], ['u2', 'e'], ['u2', 'f']],
    }),
    tree: () => ({
      nodes: { r: { name: '/', x: 0, y: 6, kind: 'dir' }, spell: { name: 'spell', x: -4, y: 4.4, kind: 'dir' }, bin: { name: 'bin', x: 0, y: 4.4, kind: 'dir' }, prog: { name: 'programs', x: 4, y: 4.4, kind: 'dir' },
        stat: { name: 'stat', x: -5.6, y: 2.7 }, mail: { name: 'mail', x: -4, y: 2.7, kind: 'dir' }, dist: { name: 'dist', x: -2.4, y: 2.7 }, ls: { name: 'ls', x: -0.8, y: 2.7 }, cp: { name: 'cp', x: 0.8, y: 2.7 }, p: { name: 'p', x: 3.2, y: 2.7, kind: 'dir' }, mail2: { name: 'mail', x: 5, y: 2.7 },
        prt: { name: 'prt', x: -4.8, y: 1.0 }, exp: { name: 'exp', x: -3.2, y: 1.0 }, list: { name: 'list', x: 3.2, y: 1.0 } },
      edges: [['r', 'spell'], ['r', 'bin'], ['r', 'prog'], ['spell', 'stat'], ['spell', 'mail'], ['spell', 'dist'], ['bin', 'ls'], ['bin', 'cp'], ['prog', 'p'], ['prog', 'mail2'], ['mail', 'prt'], ['mail', 'exp'], ['p', 'list']],
    }),
    acyclic: () => ({
      nodes: { r: { name: '/', x: 0, y: 6, kind: 'dir' }, dict: { name: 'dict', x: -3, y: 4.2, kind: 'dir' }, spell: { name: 'spell', x: 3, y: 4.2, kind: 'dir' },
        all: { name: 'all', x: -5, y: 2.4 }, w: { name: 'w', x: -3, y: 2.4 }, cnt: { name: 'count', x: 0, y: 1.0 }, words: { name: 'words', x: 3, y: 2.4 }, list: { name: 'list', x: 5, y: 2.4 } },
      edges: [['r', 'dict'], ['r', 'spell'], ['dict', 'all'], ['dict', 'w'], ['dict', 'cnt'], ['spell', 'cnt', 'link'], ['spell', 'words'], ['spell', 'list']],
      ref: { cnt: 2 },
    }),
    general: () => ({
      nodes: { r: { name: '/', x: 0, y: 6, kind: 'dir' }, bin: { name: 'bin', x: -3, y: 4.3, kind: 'dir' }, usr: { name: 'usr', x: 3, y: 4.3, kind: 'dir' },
        ls: { name: 'ls', x: -5, y: 2.6 }, doc: { name: 'doc', x: 3, y: 2.6 }, g2: { name: 'g2', x: -1.5, y: 2.6, kind: 'dir' }, t1: { name: 't1', x: -1.5, y: 0.8, kind: 'dir' } },
      edges: [['r', 'bin'], ['r', 'usr'], ['bin', 'ls'], ['usr', 'doc'], ['bin', 'g2', 'link'], ['g2', 't1'], ['t1', 'g2', 'cyc']],
      ref: { g2: 2, t1: 1 },
    }),
  };
  const DNAME = { single: 'Single-level', two: 'Two-level', tree: 'Tree-structured', acyclic: 'Acyclic-graph', general: 'General graph' };
  const DR = { kind: 'tree', spec: null, G: null, refL: {}, extra: 0 };
  function drawDir(drop = 0) {
    lab.clear();
    DR.G = graph(DR.spec.nodes, DR.spec.edges, drop);
    DR.refL = {};
    for (const [id, c] of Object.entries(DR.spec.ref || {})) { const n = DR.spec.nodes[id]; DR.refL[id] = tag('ref = ' + c, 'ptr alt', n.x + 1.3, n.y + 0.1); }
  }
  function enterDir() {
    stopTimer();
    lab.frameCamera([0, 4.2, 13], [0, 3.3, 0]);
    DR.spec = DSPEC[DR.kind](); DR.extra = 0;
    const acts = {
      single: '<input id="dName" value="test" size="6"><button class="primary" id="dAct">新增檔案</button>',
      two: '<select id="dUser"><option value="u1">user1</option><option value="u2">user2</option></select><input id="dName" value="test" size="6"><button class="primary" id="dAct">新增檔案</button>',
      tree: '<input id="dName" value="/spell/mail/exp" size="16"><button class="primary" id="dAct">走訪路徑</button>',
      acyclic: '<button class="primary" id="dAct">刪除 /spell/count</button><button id="dAct2">刪除 /dict/count</button>',
      general: '<button class="primary" id="dAct">刪除 bin→g2 的 link</button><button id="dAct2">跑 garbage collection</button>',
    };
    controls('<select id="dK">' + Object.keys(DNAME).map((k) => '<option value="' + k + '">' + DNAME[k] + '</option>').join('') + '</select>' + acts[DR.kind] + '<button id="dReset">重設</button>');
    $('dK').value = DR.kind;
    $('dK').onchange = (e) => { DR.kind = e.target.value; clearLog(); enterDir(); };
    on('dReset', () => { clearLog(); enterDir(); });
    on('dAct', () => { if (!busy) return dirAct(1); });
    on('dAct2', () => { if (!busy) return dirAct(2); });
    drawDir();
    const H = {
      single: '所有檔案在同一層：簡單，但不能同名、不能分使用者。',
      two: '每個 user 一個 UFD：不同 user 可以同名；同一 user 內仍不能同名。',
      tree: '任意深度的樹：用絕對／相對路徑找檔案。',
      acyclic: 'count 被 dict 和 spell 共享（hard link，reference count = 2）。',
      general: 'bin→g2 是 link；g2 ↔ t1 互指形成 cycle。',
    };
    log(H[DR.kind]);
    setState('目錄結構：' + DNAME[DR.kind], [['節點數', String(Object.keys(DR.spec.nodes).length)], ['能共享檔案', DR.kind === 'acyclic' || DR.kind === 'general' ? '能' : '不能'], ['可能有 cycle', DR.kind === 'general' ? '會' : '不會']],
      'directory 做的事：名字 → 找到檔案真正的 ID（inode）');
  }
  async function dirAct(which) {
    busy = true;
    try {
      const S = DR.spec, N = S.nodes;
      if (DR.kind === 'single' || DR.kind === 'two') {
        const name = ($('dName').value || '').trim();
        if (!name) { log('請輸入檔名。', true); return; }
        const parent = DR.kind === 'single' ? 'r' : $('dUser').value;
        const clash = S.edges.some(([a, b]) => a === parent && N[b].name === name);
        if (clash) {
          const id = S.edges.find(([a, b]) => a === parent && N[b].name === name)[1];
          glow(DR.G.M[id], RED); say('同一個目錄裡已經有 ' + name, DR.kind === 'single' ? 'single-level：全系統只有一層，所有人共用名字空間' : '同一 user 底下不能同名');
          log('命名衝突：' + (DR.kind === 'single' ? '整個系統只有一個目錄。' : N[parent].name + ' 已經有 ' + name + '。'), true);
          await sleep(1400); glow(DR.G.M[id], null); return;
        }
        if (DR.extra >= 5) { log('畫面放不下更多檔案，先按重設。', true); return; }
        const id = 'n' + Date.now();
        const px = DR.kind === 'single' ? -4 + DR.extra * 2 : N[parent].x + (DR.extra % 3 - 1) * 1.8;
        N[id] = { name, x: px, y: DR.kind === 'single' ? 0.9 : 0.4 }; S.edges.push([parent, id]); DR.extra++;
        drawDir();
        log('新增 ' + (DR.kind === 'two' ? N[parent].name + '/' : '') + name + '。');
        return;
      }
      if (DR.kind === 'tree') {
        const path = ($('dName').value || '').split('/').filter(Boolean);
        let cur = 'r'; glow(DR.G.M.r, GOLD); await sleep(600);
        for (const p of path) {
          const nx = S.edges.find(([a, b]) => a === cur && N[b].name === p);
          if (!nx) { log('在 ' + N[cur].name + ' 底下找不到 ' + p + '。', true); say('找不到 ' + p, ''); return; }
          glow(DR.G.M[cur], null); cur = nx[1]; glow(DR.G.M[cur], GOLD); say('進入 ' + p, ''); await sleep(700);
        }
        log('找到 /' + path.join('/') + '：從 root 一層一層往下找。');
        await sleep(800); glow(DR.G.M[cur], null); return;
      }
      if (DR.kind === 'acyclic') {
        const par = which === 1 ? 'spell' : 'dict';
        const e = S.edges.findIndex(([a, b]) => a === par && b === 'cnt');
        if (e < 0) { log('/' + par + '/count 已經刪過了。', true); return; }
        S.edges.splice(e, 1); S.ref.cnt--;
        if (S.ref.cnt === 0) { delete N.cnt; delete S.ref.cnt; S.edges = S.edges.filter(([a, b]) => a !== 'cnt' && b !== 'cnt'); }
        drawDir();
        log(S.ref.cnt ? '刪掉一個 link：ref 2 → 1，檔案還在（另一條路徑仍可用）。' : 'ref 降到 0：真正刪除檔案內容。');
        return;
      }
      if (DR.kind === 'general') {
        if (which === 1) {
          const e = S.edges.findIndex(([a, b]) => a === 'bin' && b === 'g2');
          if (e < 0) { log('link 已經刪過了。', true); return; }
          S.edges.splice(e, 1); S.ref.g2--; drawDir();
          log('g2 的 ref 2 → 1，t1 仍是 1：互相指著，counter 都不是 0，卻已經沒人走得到！', true);
          return;
        }
        const seen = new Set(['r']), q = ['r'];
        while (q.length) { const u = q.shift(); glow(DR.G.M[u], GREEN); await sleep(350); for (const [a, b] of S.edges) if (a === u && !seen.has(b)) { seen.add(b); q.push(b); } }
        const dead = Object.keys(N).filter((id) => !seen.has(id));
        if (!dead.length) { log('全部都 reachable，沒有東西要回收。'); return; }
        await sleep(500);
        dead.forEach((id) => { fly(DR.G.M[id]); delete N[id]; });
        S.edges = S.edges.filter(([a, b]) => N[a] && N[b]);
        log('Garbage collection：從 root 標記走得到的，沒被標記的（' + dead.map((id) => N[id].name).join('、') + '）回收。');
      }
    } finally { busy = false; }
  }

  // ───────────────────────── 模式 4：Free-space ─────────────────────────
  // 恐龍書例子：2,3,4,5,8,9,10,11,12,13,17,18,25,26,27 是空的
  const FREE0 = [2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 17, 18, 25, 26, 27];
  const FS = { conv: 'book', method: 'bitmap', free: new Set(FREE0), mine: new Set() };
  const bitOf = (i) => (FS.free.has(i) ? (FS.conv === 'book' ? 1 : 0) : (FS.conv === 'book' ? 0 : 1));
  function enterFree() {
    stopTimer();
    lab.frameCamera([0, 9.5, 8.2], [0, 0, 0.3]);
    controls(
      '<select id="fM"><option value="bitmap">Bit vector</option><option value="list">Linked list</option></select>'
      + '<select id="fC"><option value="book">恐龍書：1 = free</option><option value="chou">周志遠：0 = free</option></select>'
      + '<button class="primary" id="fA1">配置 1 塊</button><label>連續 <input id="fK" type="number" min="1" max="8" value="4"> 塊</label><button id="fAk">配置連續</button>'
      + '<label>釋放 <input id="fI" type="number" min="0" max="31" value="7"></label><button id="fRel">釋放</button><button id="fReset">重設</button>'
    );
    $('fM').value = FS.method; $('fC').value = FS.conv;
    $('fM').onchange = (e) => { FS.method = e.target.value; drawFree(); };
    $('fC').onchange = (e) => { FS.conv = e.target.value; drawFree(); };
    on('fA1', () => { if (!busy) return freeAlloc(1); });
    on('fAk', () => { if (!busy) return freeAlloc(Number($('fK').value) || 1); });
    on('fRel', () => { const i = Number($('fI').value); if (!(i >= 0 && i < 32)) { log('block 編號 0–31。', true); return; } if (FS.free.has(i)) { log('block ' + i + ' 本來就是空的。', true); return; } FS.free.add(i); FS.mine.delete(i); log('釋放 block ' + i + '。'); drawFree(); });
    on('fReset', () => { FS.free = new Set(FREE0); FS.mine = new Set(); clearLog(); drawFree(); });
    drawFree();
  }
  function drawFree() {
    lab.clear();
    diskGrid(32);
    FS.m = {};
    for (let i = 0; i < 32; i++) {
      if (!FS.free.has(i)) FS.m[i] = FS.mine.has(i) ? blk(i, 'f', C.file) : blk(i, '', C.other);
      if (FS.method === 'bitmap') { const p = gp(i, 0.6); tag(String(bitOf(i)), FS.free.has(i) ? 'ptr alt' : 'idx', p.x + 0.2, 0.6, p.z - 0.15); }
    }
    const fr = [...FS.free].sort((a, b) => a - b);
    if (FS.method === 'bitmap') {
      let s = ''; for (let i = 0; i < 32; i++) { s += bitOf(i); if (i % 8 === 7 && i < 31) s += ' '; }
      const l = tag('bit[0..31] = ' + s, '', 0, 0.3, -3.4); Object.assign(l.element.style, MONO);
    } else {
      for (let k = 1; k < fr.length; k++) seg(gp(fr[k - 1], 0.15), gp(fr[k], 0.15), '#2fc092');
      if (fr.length) { const p = gp(fr[0], 0.9); tag('free-list head', 'ptr alt', p.x, 0.9, p.z); }
    }
    setState('Free-space 管理：' + (FS.method === 'bitmap' ? 'Bit vector' : 'Linked list'), [['空塊數', String(fr.length)], ['空塊', fr.join(',') || '（無）'], ['慣例', FS.conv === 'book' ? '1 = free（恐龍書）' : '0 = free（周老師）']],
      FS.method === 'bitmap' ? '找第一個空塊：一次讀一個 word（32/64 bits）比對<br>block 號 = word 號 × 位元數 + 第一個 free bit 的位移' : '每個空塊存下一個空塊的位置<br>配置 1 塊：拿 head 就好；找連續空間要整條走');
  }
  async function freeAlloc(k) {
    busy = true;
    try {
      const fr = [...FS.free].sort((a, b) => a - b);
      if (!fr.length) { log('沒有空塊了。', true); return; }
      const cur = tag('▼', 'ptr alt', 0, 1, 0);
      let pick = null, reads = 0;
      if (k === 1) {
        if (FS.method === 'bitmap') { for (let i = 0; i < 32; i++) { cursorAt(cur, i); await sleep(70); if (FS.free.has(i)) { pick = [i]; break; } } }
        else { cursorAt(cur, fr[0]); reads = 1; pick = [fr[0]]; await sleep(400); }
      } else {
        let run = 0;
        for (let i = 0; i < 32; i++) {
          if (FS.method === 'bitmap') { cursorAt(cur, i); await sleep(70); }
          else if (FS.free.has(i)) { cursorAt(cur, i); reads++; await sleep(160); }
          run = FS.free.has(i) ? run + 1 : 0;
          if (run === k) { pick = Array.from({ length: k }, (_, j) => i - k + 1 + j); break; }
        }
      }
      kill(cur);
      if (!pick) { log('找不到連續 ' + k + ' 個空塊。', true); return; }
      pick.forEach((i) => { FS.free.delete(i); FS.mine.add(i); });
      drawFree();
      log('配置 ' + pick.join(',') + (FS.method === 'list' ? '（讀了 ' + reads + ' 個 free block 的 pointer）' : '（掃 bit 就知道）'));
      if (FS.method === 'list' && k > 1) log('linked list 只知道「下一個空塊」，要找連續空間得整條走，很慢。', true);
    } finally { busy = false; }
  }

  // ───────────────────────── 模式 5：權限 rwx ─────────────────────────
  const PM = { bits: [1, 1, 0, 1, 0, 0, 1, 0, 0], who: 'group', op: 'w', dir: false };
  function enterPerm() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6, 10], [0, 0.6, 0]);
    controls(
      'chmod <input id="pO" value="' + permOct() + '" size="3"><button id="pSet">套用</button>'
      + '<select id="pW"><option value="owner">我是 owner</option><option value="group">同 group</option><option value="others">others</option></select>'
      + '<select id="pOp"><option value="r">r 讀</option><option value="w">w 寫</option><option value="x">x 執行／進入</option></select>'
      + '<label><input id="pD" type="checkbox"' + (PM.dir ? ' checked' : '') + '>是目錄</label><button class="primary" id="pChk">檢查權限</button>'
    );
    $('pW').value = PM.who; $('pOp').value = PM.op;
    $('pW').onchange = (e) => { PM.who = e.target.value; }; $('pOp').onchange = (e) => { PM.op = e.target.value; };
    $('pD').onchange = (e) => { PM.dir = e.target.checked; drawPerm(); };
    on('pSet', () => {
      const s = ($('pO').value || '').trim();
      if (!/^[0-7]{3}$/.test(s)) { log('chmod 要三個 0–7 的數字，例如 644。', true); return; }
      PM.bits = s.split('').flatMap((d) => [4, 2, 1].map((b) => (Number(d) & b ? 1 : 0)));
      log('chmod ' + s + ' → ' + permStr()); drawPerm();
    });
    on('pChk', checkPerm);
    drawPerm();
  }
  const permOct = () => [0, 1, 2].map((g) => PM.bits[g * 3] * 4 + PM.bits[g * 3 + 1] * 2 + PM.bits[g * 3 + 2]).join('');
  const permStr = () => (PM.dir ? 'd' : '-') + PM.bits.map((b, i) => (b ? 'rwx'[i % 3] : '-')).join('');
  function drawPerm() {
    lab.clear(); PM.m = [];
    ['owner', 'group', 'others'].forEach((g, gi) => {
      const x0 = -4 + gi * 4;
      tag(g, 'ptr', x0, 0.1, 1.6);
      for (let k = 0; k < 3; k++) {
        const on1 = PM.bits[gi * 3 + k];
        const m = cube('rwx'[k], on1 ? C.free : GRAY, [1, on1 ? 0.9 : 0.3, 1], x0 - 1.1 + k * 1.1, on1 ? 0.45 : 0.15, 0);
        PM.m.push(m);
      }
      tag(String(PM.bits[gi * 3] * 4 + PM.bits[gi * 3 + 1] * 2 + PM.bits[gi * 3 + 2]), 'ptr alt', x0, 1.6, 0);
    });
    const l = tag('ls -l：' + permStr() + '  alice  staff  hw.c', '', 0, 0.2, -2.2); Object.assign(l.element.style, MONO);
    setState('Access control：owner / group / others × rwx', [['chmod', permOct()], ['ls -l', permStr()], ['檔案類型', PM.dir ? '目錄（x = 能進入／traverse）' : '一般檔案']],
      '每個 class 3 個 bit：r=4、w=2、x=1<br>只有 owner 或 root 能改權限');
  }
  async function checkPerm() {
    const g = { owner: 0, group: 1, others: 2 }[PM.who], k = 'rwx'.indexOf(PM.op);
    const ok = !!PM.bits[g * 3 + k], m = PM.m[g * 3 + k];
    glow(m, ok ? GREEN : RED);
    const what = PM.dir ? { r: '列出目錄內容', w: '在目錄內新增／刪除檔案', x: 'cd 進去／沿路徑穿過' }[PM.op] : { r: '讀檔', w: '寫檔', x: '執行' }[PM.op];
    say(PM.who + ' 要「' + what + '」：' + (ok ? '允許' : 'Permission denied'), permStr());
    log(PM.who + ' 的 ' + PM.op + ' bit = ' + (ok ? 1 : 0) + ' → ' + (ok ? '允許' : '拒絕'), !ok);
    await sleep(1500); glow(m, null);
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  function genQ() {
    const t = Math.random();
    if (t < 0.22) {
      const bsK = pickOne([1, 2, 4, 8]), ps = pickOne([4, 8]), nd = pickOne([10, 12]);
      const e = bsK * 1024 / ps, B = bsK * 1024;
      const right = fmtSize((nd + e + e * e + e * e * e) * B);
      const opts = [right, fmtSize((nd + e + e * e) * B), fmtSize((nd + 3 * e) * B), fmtSize(e * e * e * e * B)];
      return { q: 'inode 有 ' + nd + ' 個 direct、1 個 single、1 個 double、1 個 triple indirect。block = ' + bsK + 'KB、pointer = ' + ps + 'B，最大檔案約多大？', opts: [...new Set(opts)], ans: right, why: '每塊 ' + e + ' 個 pointer：(' + nd + ' + ' + e + ' + ' + e + '² + ' + e + '³) × ' + bsK + 'KB。' };
    }
    if (t < 0.42) {
      const save = { ...IN }; IN.bs = 4; IN.ps = 4; IN.nd = 12;
      const offs = [[rnd(1, 47), 'KB'], [rnd(60, 3000), 'KB'], [rnd(5, 900), 'MB'], [rnd(5, 900), 'GB']];
      const [v, u] = pickOne(offs); const mul = { KB: 1024, MB: 1048576, GB: 1073741824 }[u];
      const k = Math.floor(v * mul / 4096), L = locate(k); Object.assign(IN, save);
      const ans = (L.lvl + 1) + ' 次';
      return { q: 'block 4KB、pointer 4B、12 個 direct。inode 已在 memory，要讀 offset ' + v + ' ' + u + ' 的那個 byte，需要幾次 disk 存取？', opts: ['1 次', '2 次', '3 次', '4 次'], ans, why: '第 ' + k + ' 個 block → ' + (L.lvl ? ['single', 'double', 'triple'][L.lvl - 1] + ' indirect：' + L.lvl + ' 個 index block + 1 個資料塊' : 'direct：直接讀資料塊') + '。direct 到 48KB、single 再加 4MB、double 再加 4GB。' };
    }
    if (t < 0.6) {
      const k = rnd(3, 12), m = pickOne(['Contiguous', 'Linked', 'Indexed']);
      const ans = { Contiguous: '1 次', Linked: k + ' 次', Indexed: '2 次' }[m];
      return { q: m + ' allocation，FCB 已在 memory（index block 不在），讀檔案第 ' + k + ' 塊要幾次 disk I/O？', opts: ['1 次', '2 次', k + ' 次', (k - 1) + ' 次'], ans, why: { Contiguous: 'start + k − 1 直接算出位置。', Linked: '前 ' + (k - 1) + ' 塊都得讀出來拿 pointer，再讀第 ' + k + ' 塊。', Indexed: '先讀 index block，再讀資料塊。' }[m] };
    }
    if (t < 0.75) {
      const d = [rnd(4, 7), rnd(0, 7), rnd(0, 7)];
      const s = d.map((x) => [4, 2, 1].map((b, i) => (x & b ? 'rwx'[i] : '-')).join('')).join('');
      const wrong = d.map((x) => [1, 2, 4].map((b, i) => (x & b ? 'rwx'[i] : '-')).join('')).join('');
      const w2 = d.map((x) => (7 - x)).map((x) => [4, 2, 1].map((b, i) => (x & b ? 'rwx'[i] : '-')).join('')).join('');
      return { q: 'chmod ' + d.join('') + ' file 之後，ls -l 前面的權限字串是？', opts: [...new Set(['-' + s, '-' + wrong, '-' + w2, 'd' + s])], ans: '-' + s, why: 'r=4、w=2、x=1，依序是 owner、group、others；第一個字元 - 表示一般檔案。' };
    }
    if (t < 0.88) {
      const used = new Set(); while (used.size < 12) used.add(rnd(0, 15));
      const free = []; for (let i = 0; i < 16; i++) if (!used.has(i)) free.push(i);
      const bits = Array.from({ length: 16 }, (_, i) => (used.has(i) ? 0 : 1)).join('');
      return { q: 'bit vector（1 = free，恐龍書慣例）為 ' + bits + '（block 0 在最左）。First-fit 會配到哪一塊？', opts: [...new Set([String(free[0]), String(free[free.length - 1]), String(bits.indexOf('0')), String(free[1] ?? 15)])], ans: String(free[0]), why: '從 block 0 往右找第一個 1：block ' + free[0] + '。' };
    }
    const qset = [
      { q: '哪種 allocation 會有 external fragmentation？', opts: ['Contiguous', 'Linked', 'Indexed', 'FAT'], ans: 'Contiguous', why: '需要連續空間；空間被切碎後，總量夠也放不下。' },
      { q: 'FAT 為什麼比傳統 linked allocation 適合 random access？', opts: ['pointer 集中成表，可整張載入 memory', '每塊多存一個 pointer', '檔案必須連續存放', '用 bit 表示空塊'], ans: 'pointer 集中成表，可整張載入 memory', why: '沿鏈走的動作在 memory 做，不再一塊一塊讀 disk。' },
      { q: 'General-graph directory 刪掉 link 後，為什麼只靠 reference count 不夠？', opts: ['cycle 裡的節點互相參照，count 不會變 0', 'count 會溢位', 'count 只能記 hard link', 'link 不算 reference'], ans: 'cycle 裡的節點互相參照，count 不會變 0', why: '要用 garbage collection：從 root 標記走得到的，沒標到的才刪。' },
      { q: '對目錄而言，x 權限代表？', opts: ['可以進入／沿路徑穿過', '可以執行目錄', '可以列出檔名', '可以刪除目錄'], ans: '可以進入／沿路徑穿過', why: '路徑上任何一層父目錄缺 x，就會 Permission denied。' },
      { q: 'Multi-level index 相對 linked index scheme 的好處？', opts: ['大檔案任何位置的存取次數都差不多', '小檔案不浪費空間', '不需要 index block', '沒有 pointer'], ans: '大檔案任何位置的存取次數都差不多', why: 'linked index 越後面要 lookup 越多個 index block；multi-level 固定層數。' },
    ];
    return pickOne(qset);
  }
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

  // ───────────────────────── 場景：0vYydtG1Xi4（23C） ─────────────────────────
  async function scAccess(tok) {
    fresh([0, 8.5, 9.5], [0, 0, 0.2]);
    tag('Sequential', 'ptr', -6, 0.3, -2.6);
    const tape = []; for (let i = 0; i < 10; i++) tape.push(cube('', C.file, [0.6, 0.3, 0.7], -4.6 + i * 0.75, 0.15, -2.6));
    const cur = tag('▼', 'ptr alt', -4.6, 0.9, -2.6);
    say('Sequential：一筆接一筆讀', 'fread / fwrite：參數裡沒有位置');
    for (let i = 0; i < 10; i++) { cur.position.set(-4.6 + i * 0.75, 0.9, -2.6); glow(tape[i], GOLD); await beat(tok, 300); glow(tape[i], null); }
    await beat(tok, 600);
    tag('Direct', 'ptr', -4.4, 0.3, 3.1);
    const g = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.push(cube((r + 1) + ',' + (c + 1), C.fat, [0.85, 0.3, 0.7], -5.4 + c * 1, 0.15, 0 + r * 0.85));
    say('Direct：直接給座標', 'MATLAB load 檔案後問 A(3,3)');
    await beat(tok, 1400);
    glow(g[8], GOLD); g[8].position.y = 0.6;
    say('第 3 列第 3 行：給位置就讀', 'read(n) / write(n)：參數是 position');
    await beat(tok, 2000);
    tag('Index', 'ptr', 3, 0.3, 3.1);
    const key = cube('John', C.idx, [1.1, 0.4, 0.7], 1.4, 0.2, 0.8);
    const idx = code(['index', 'Alice → 2', 'John  → 7', 'Mary  → 4'], 3.6, 1.6, 0.42, 0.6);
    const recs = []; for (let i = 0; i < 8; i++) recs.push(cube(String(i), C.file, [0.5, 0.3, 0.5], 1.6 + i * 0.62, 0.15, 2.2));
    say('Index：用 key 查 index，再找到位置', '像 database：用名字 John 查資料');
    await beat(tok, 1500);
    idx.hl(2); glow(key, GOLD); await beat(tok, 1000);
    glow(recs[7], GOLD); recs[7].position.y = 0.5;
    say('John → 第 7 筆', '自己取名字當 key，index 對到位置');
    await beat(tok, 2000);
    say('哪個好？看 application 的存取行為', '沒位置＝sequential；給位置＝direct；給 key＝index');
    await beat(tok, 3000);
  }
  async function scGeneralGC(tok) {
    fresh([0, 4.2, 13], [0, 3.3, 0]);
    const S = DSPEC.general();
    let G = graph(S.nodes, S.edges, 2);
    const rG2 = tag('ref = 2', 'ptr alt', 0, 2.7), rT1 = tag('ref = 1', 'ptr alt', 0, 0.9);
    say('General graph：link 可以任意加', 'bin → g2 是 link；g2 ↔ t1 形成 cycle');
    await beat(tok, 2800);
    say('刪掉 bin → g2 這個 link', '');
    await beat(tok, 900);
    const ei = G.E.findIndex((e) => e.a === 'bin' && e.b === 'g2');
    kill(G.E[ei].l);
    txt(rG2, 'ref = 1');
    glow(G.M.g2, RED); glow(G.M.t1, RED);
    say('g2、t1 已經走不到，ref 卻都不是 0', '互相 reference：只看 counter 不會刪');
    await beat(tok, 3000);
    say('解法：garbage collection（兩個 pass）', '第 1 pass：從 root 標記走得到的');
    glow(G.M.g2, null); glow(G.M.t1, null);
    const order = ['r', 'bin', 'usr', 'ls', 'doc'];
    for (const id of order) { glow(G.M[id], GREEN); await beat(tok, 500); }
    say('第 2 pass：沒被標記的就刪', 'unreachable → delete，不管有沒有 cycle');
    await beat(tok, 1500);
    fly(G.M.g2); fly(G.M.t1); kill(rG2); kill(rT1);
    G.E.filter((e) => e.a === 'g2' || e.a === 't1').forEach((e) => kill(e.l));
    await beat(tok, 1500);
    say('檔案太多，週期性 GC 太貴', '很多 FS 直接拒絕會造成 cycle 的 link');
    await beat(tok, 3200);
  }
  async function scMountPoints(tok) {
    fresh([0, 4.2, 13], [0, 3.2, 0]);
    const N = { r: { name: '/', x: 0, y: 6, kind: 'dir' }, local: { name: 'local', x: -4, y: 4.3, kind: 'dir' }, usr: { name: 'usr', x: 0, y: 4.3, kind: 'dir' }, home: { name: 'home', x: 4, y: 4.3, kind: 'dir' } };
    graph(N, [['r', 'local'], ['r', 'usr'], ['r', 'home']], 2);
    say('三種時機：boot / run time / manual', '開機就要 mount 系統槽，才能載入 OS');
    await beat(tok, 2800);
    say('插上新 volume：mount 到 usr 底下', 'usr 就是 mount point');
    const V = { a: { name: 'bin', x: -1.4, y: 2.5, kind: 'vol' }, b: { name: 'lib', x: 1.4, y: 2.5, kind: 'vol' } };
    graph(V, [], 4); seg(V3(0, 4.05), V3(-1.4, 2.75), '#31aab0'); seg(V3(0, 4.05), V3(1.4, 2.75), '#31aab0');
    tag('volume 2', 'ptr alt', -2.9, 2.5);
    await beat(tok, 2600);
    const N2 = { john: { name: 'john', x: 4, y: 2.5, kind: 'dir' } };
    graph(N2, [], 2); seg(V3(4, 4.05), V3(4, 2.75));
    await beat(tok, 900);
    say('可以 recursive：再掛到 john 底下', 'Linux / Mac：任何存在的資料夾都能當 mount point');
    graph({ g: { name: 'games', x: 4, y: 0.8, kind: 'vol', color: C.fat } }, [], 4); seg(V3(4, 2.25), V3(4, 1.05), '#9b7ef4');
    tag('volume 3', 'ptr alt', 5.6, 0.8);
    await beat(tok, 2800);
    say('Windows：只能掛在最上層', 'C:、D:、E: 一槽一個 root');
    const w = ['C:', 'D:', 'E:'].map((n, i) => cube(n, C.vol, [0.9, 0.5, 0.5], -5.2 + i * 1.1, 0.8, 0, 3));
    await beat(tok, 3000);
  }
  async function scMountTable(tok) {
    fresh([0, 4.2, 13], [0, 3, 0]);
    const N = { r: { name: '/', x: -3, y: 6, kind: 'dir' }, usr: { name: 'usr  m', x: -5, y: 4.3, kind: 'dir' }, bin: { name: 'bin', x: -3, y: 4.3, kind: 'dir' }, mnt: { name: 'mnt  m', x: -1, y: 4.3, kind: 'dir' } };
    const G = graph(N, [['r', 'usr'], ['r', 'bin'], ['r', 'mnt']], 2);
    tag('P1（系統槽）', 'ptr', -3, 6.8);
    const P2 = { r2: { name: 'root (= usr)', x: 3.5, y: 4.3, kind: 'vol' }, a: { name: 'john', x: 2.2, y: 2.6, kind: 'vol' }, b: { name: 'hw.c', x: 4.8, y: 2.6, kind: 'vol', color: C.fil } };
    const G2 = graph(P2, [['r2', 'a'], ['r2', 'b']], 2);
    tag('P2', 'ptr', 3.5, 5.1);
    const mt = code(['mount table', 'usr → P2  port 1, SATA', 'mnt → P3  USB'], -3, 1.8, 0.45);
    say('mount 後，目錄裡 usr、mnt 被標成 m', 'OS 另外維護一張 mount table');
    await beat(tok, 2800);
    say('找 /usr/hw.c：從 root 開始', '');
    glow(G.M.r, GOLD); await beat(tok, 900); glow(G.M.r, null);
    glow(G.M.usr, GOLD); say('usr 有 m 標記 → 查 mount table', ''); await beat(tok, 1200);
    mt.hl(1); say('usr 對到 P2：哪個 port、什麼 protocol', ''); await beat(tok, 1600);
    glow(G.M.usr, null); glow(G2.M.r2, GOLD);
    say('換到 P2 繼續走：P2 的 root 就是 usr', ''); await beat(tok, 1600);
    glow(G2.M.r2, null); glow(G2.M.b, GOLD);
    say('找到 hw.c，再讀它的內容', 'directory 標記 + mount table → 跨 partition 繼續找');
    await beat(tok, 3000);
  }
  async function scShareUGO(tok) {
    fresh([0, 6.5, 10.5], [0, 0.6, 0]);
    const users = [['alice', 'uid 1001'], ['bob', 'uid 1002'], ['carol', 'uid 1003'], ['dave', 'uid 1004']];
    const U = users.map(([n, id], i) => { const m = cube(n, C.file, [1.3, 0.5, 0.8], -4.5 + i * 3, 0.25, -2.6, 2); tag(id, 'idx', -4.5 + i * 3, 0, -1.7); return m; });
    say('每個使用者有唯一的 user ID', 'default：自己也是一個 group');
    await beat(tok, 2400);
    const grp = tag('group: students', 'ptr alt', 0, 1.3, -2.6);
    tint(U[1], C.free); tint(U[2], C.free);
    say('管理者建 group students，把 bob、carol 放進去', '一個 user 有 user ID，也屬於某個 group ID');
    await beat(tok, 2600);
    const f = cube('hw.c', C.fil, [1.4, 0.6, 1], 0, 0.3, 0.6, 3);
    tag('owner = alice，group = students', 'ptr', 0, 0.2, 1.7);
    say('檔案：只有一個 owner、屬於一個 group', '');
    await beat(tok, 2200);
    const bins = [['owner', -4.5], ['group', 0], ['others', 4.5]];
    bins.forEach(([n, x]) => { ctx.tile(V3(x, 0.04, 3.4), 3, 1.6, '#e9dcc4'); tag(n, 'ptr', x, 0.2, 4.4); });
    say('要操作檔案時：你一定落在三類之一', '');
    await beat(tok, 1200);
    move(U[0], -4.5, 0.25, 3.4); await beat(tok, 900);
    move(U[1], -0.7, 0.25, 3.4); await beat(tok, 500); move(U[2], 0.7, 0.25, 3.4); await beat(tok, 900);
    move(U[3], 4.5, 0.25, 3.4);
    say('owner／同 group／others，各一組權限', 'group 裡每個人權限相同，不能再細分');
    await beat(tok, 3200);
  }
  async function scAclBits(tok) {
    fresh([0, 6, 11], [0, 1.2, 0]);
    say('最直覺：每個檔案一張 list，列每個 user', 'Access-Control List（one to one）');
    const rows = [];
    for (let i = 0; i < 12; i++) { rows.push(cube('user' + (i + 1) + '：' + pickOne(['rw', 'r', 'rwx', '—']), C.other, [2.6, 0.3, 0.45], -4, 0.15 + i * 0.32, -1, 2)); await beat(tok, 180); }
    say('使用者一多，list 又長又常改', '每次判斷都要 load 進 memory → 不可行');
    await beat(tok, 2400);
    rows.forEach((r) => fly(r));
    await beat(tok, 800);
    say('簡化：3 個 class × 3 個 bit', 'r = read、w = write、x = execute');
    const BITS = [[1, 1, 1], [1, 1, 0], [1, 0, 0]];
    const M = [];
    ['owner', 'group', 'others'].forEach((g, gi) => {
      tag(g, 'ptr', -4 + gi * 4, 0.1, 1.6);
      BITS[gi].forEach((b, k) => { M.push(cube('rwx'[k], b ? C.free : GRAY, [1, b ? 0.8 : 0.3, 1], -5.1 + gi * 4 + k * 1.1, b ? 0.4 : 0.15, 0, 2)); });
      tag(BITS[gi].join(''), 'ptr alt', -4 + gi * 4, 1.6, 0);
    });
    await beat(tok, 2800);
    say('owner 111、group 110、others 100', 'owner 全部可以；group 讀寫；others 只能讀');
    await beat(tok, 2800);
    const ls = tag('$ ls -l   -rw-rw-r--  alice  staff  hw.c', '', 0, 0.2, -2.6); Object.assign(ls.element.style, MONO);
    say('ls -l 前面那串就是 ACL', '第 1 字元是檔案類型；後 9 個 = 3 組 rwx');
    await beat(tok, 3000);
    txt(ls, '$ chmod 644 hw.c   →   -rw-r--r--');
    const B2 = [[1, 1, 0], [1, 0, 0], [1, 0, 0]];
    M.forEach((m, i) => { const b = B2[Math.floor(i / 3)][i % 3]; tint(m, b ? C.free : GRAY); m.scale.y = b ? 1 : 0.375; m.position.y = b ? 0.4 : 0.15; });
    say('chmod 644：每個數字對到一個 class', '6 = 110 = rw-，4 = 100 = r--');
    await beat(tok, 3000);
    say('目錄的 x = 能不能 traverse 進去', '路徑上任一層父目錄沒 x → Permission denied');
    await beat(tok, 3200);
  }
  async function scProtection(tok) {
    fresh([0, 6, 11], [0, 1, 0]);
    tag('damage：資料不能遺失', 'ptr', -3.6, 0.2, 2.4);
    tag('security：不能被偷', 'ptr', 3.6, 0.2, 2.4);
    const d1 = cube('disk 1', C.file, [1.6, 1.2, 1.2], -4.6, 0.6, 0), d2 = cube('disk 2', C.file, [1.6, 1.2, 1.2], -2.6, 0.6, 0);
    const data = cube('data', C.fil, [0.8, 0.4, 0.6], -4.6, 1.5, 0, 2);
    say('Protection 兩件事：先看 damage', 'access permission 也屬於 protection');
    await beat(tok, 2000);
    const copy = cube('data', C.fil, [0.8, 0.4, 0.6], -2.6, 1.5, 0, 2);
    say('用多顆硬碟存副本（RAID，後面章節）', '');
    await beat(tok, 1600);
    fly(d1); fly(data);
    glow(copy, GREEN);
    say('一顆壞了，還能從另一顆讀回來', 'reliability ↑');
    await beat(tok, 2400);
    const pc = cube('login', C.fat, [1.4, 0.8, 1], 1.6, 0.4, 0), sv = cube('server', C.fat, [1.4, 0.8, 1], 5.6, 0.4, 0);
    const pk = cube('pw', C.idx, [0.6, 0.4, 0.5], 1.6, 1.2, 0);
    say('最基本：password 登入，再查 ACL', '');
    await beat(tok, 1800);
    move(pk, 3.6, 1.2, 0); await beat(tok, 700);
    const thief = cube('監聽', C.bad, [1, 0.6, 0.8], 3.6, 0.3, 1.8, 2);
    say('網路上傳 password：封包可能被偷聽', '要加密等等 → privacy / security');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景：C42WzJATHg0（25A） ─────────────────────────
  const CHAIN = [9, 16, 5, 10, 25, 4, 30, 18, 27, 12];   // 10 塊的 linked 檔案（前段取自恐龍書 jeep：9→16→…→25）
  async function scContigLinked(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.4]);
    diskGrid();
    const cm = []; for (let k = 0; k < 6; k++) cm.push(blk(19 + k, k + 1, C.fil, 0, 0, 2));
    const dir = tag('mail：start 19, length 6', 'ptr', 0, 0.3, -3.3);
    say('Contiguous：檔案放在連續的 block', '恐龍書例子 mail：start 19、length 6');
    await beat(tok, 2600);
    glow(cm[4], GOLD);
    say('要第 5 塊？直接算：19 + 4 = 23', 'sequential、random 都只要 1 次 I/O');
    await beat(tok, 2600);
    glow(cm[4], null);
    say('缺點：檔案長大或空間破碎就放不下', 'external fragmentation');
    await beat(tok, 2200);
    cm.forEach((m) => fly(m)); kill(dir);
    await beat(tok, 700);
    const lm = [];
    for (let k = 0; k < CHAIN.length; k++) { lm.push(blk(CHAIN[k], k + 1, C.file, 0, 0, 2)); if (k) seg(gp(CHAIN[k - 1], 0.45), gp(CHAIN[k], 0.45), '#c08a1f'); await beat(tok, 150); }
    tag('start 9 … end 12', 'ptr', 0, 0.3, -3.3);
    say('Linked：有空間就能用，用 pointer 串起來', 'pointer 散落在每個 data block 上');
    await beat(tok, 2400);
    const cur = tag('讀', 'ptr alt', 0, 1, 0);
    const cnt = tag('', 'ptr alt', 4.2, 0.3, -3.3);
    say('從第 5 塊開始讀：前 4 塊還是得讀', '每讀一個 pointer 就是 1 次 I/O');
    for (let k = 0; k < 5; k++) { cursorAt(cur, CHAIN[k]); glow(lm[k], k < 4 ? GOLD : GREEN); txt(cnt, 'I/O ' + (k + 1)); await beat(tok, 700); }
    await beat(tok, 1200);
    lm.forEach((m) => glow(m, null));
    say('random：讀第 8 塊，再跳回第 3 塊', '又得從頭走 → 重複讀');
    for (let k = 0; k < 8; k++) { cursorAt(cur, CHAIN[k]); glow(lm[k], GOLD); txt(cnt, 'I/O ' + (k + 1)); await beat(tok, 260); }
    lm.forEach((m) => glow(m, null));
    for (let k = 0; k < 3; k++) { cursorAt(cur, CHAIN[k]); glow(lm[k], RED); txt(cnt, 'I/O ' + (9 + k)); await beat(tok, 400); }
    say('random access 是 linked 最糟的情況', '8 + 3 = 11 次 I/O');
    await beat(tok, 3000);
  }
  async function scFat(tok) {
    fresh([0.6, 9.5, 8.2], [0.6, 0, 0.5]);
    const ox = -1.6;
    diskGrid(32, ox);
    blk(0, 'FAT', C.fat, ox); blk(1, 'FAT', C.fat, ox);
    const lm = CHAIN.map((b, k) => blk(b, k + 1, C.file, ox));
    say('改良：把 pointer 全部收集起來', '存在前面幾個 block → File Allocation Table');
    const tbl = code(['FAT', ...CHAIN.map((b, k) => 'FAT[' + String(b).padStart(2) + '] = ' + (k < 9 ? CHAIN[k + 1] : 'EOF'))], 5.4, 3.8, 0.4);
    await beat(tok, 3000);
    const mem = cube('memory', C.mem, [3.6, 0.3, 1.2], 5.4, 3.0, 3.2);
    say('mount 時把 FAT 整張 load 到 memory', '');
    await beat(tok, 2200);
    say('讀第 8 塊：在 memory 沿表走', '走表不用 disk I/O');
    for (let k = 1; k <= 8; k++) { tbl.hl(k); await beat(tok, 380); }
    const cur = tag('讀', 'ptr alt', 0, 1, 0); cursorAt(cur, CHAIN[7], ox); glow(lm[7], GOLD);
    say('只剩 1 次 disk I/O：讀 block 18', 'FAT32 已不是傳統 linked，是改良版');
    await beat(tok, 3200);
  }
  async function scIndexed(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.4]);
    diskGrid();
    const J = [9, 16, 1, 10, 25];
    const ib = blk(19, 'IB', C.idx, 0, 0, 2);
    const dm = J.map((b, k) => blk(b, k + 1, C.file, 0, 0, 2));
    J.forEach((b) => seg(gp(19, 0.45), gp(b, 0.45), '#c08a1f'));
    tag('[9,16,1,10,25,−1,−1,−1]', 'ptr alt', gp(19).x, 1.3, gp(19).z);
    tag('directory：jeep → index block 19', 'ptr', 0, 0.3, -3.3);
    say('Indexed：pointer 全集中在 index block', '恐龍書 jeep：index block 19');
    await beat(tok, 3000);
    const cur = tag('讀', 'ptr alt', 0, 1, 0);
    cursorAt(cur, 19); glow(ib, GOLD);
    say('讀第 4 塊：先讀 index block', 'I/O 1：第 4 格 = 10');
    await beat(tok, 2000);
    cursorAt(cur, 10); glow(dm[3], GOLD);
    say('直接跳到 block 10', 'I/O 2：random、sequential 都快');
    await beat(tok, 2400);
    glow(ib, null); glow(dm[3], null); kill(cur);
    say('沒有 external fragmentation，建檔、長大都容易', '有 free list 就能找到空塊');
    await beat(tok, 2600);
    fresh([0, 5, 10], [0, 1, 0]);
    say('缺點：小檔案也要整個 index block', '2 個 data block 只用 8 bytes');
    const slots = [];
    for (let i = 0; i < 128; i++) slots.push(cube('', i < 2 ? C.idx : GRAY, [0.16, i < 2 ? 0.5 : 0.15, 0.4], -6.1 + (i % 64) * 0.19, i < 2 ? 0.25 : 0.08, -0.4 + Math.floor(i / 64) * 0.6));
    tag('index block 512 bytes = 128 格 × 4B', 'ptr', 0, 0.3, 1.4);
    tag('只用 2 格（8B）', 'ptr alt', -5.6, 1.2, -0.4);
    await beat(tok, 3000);
    say('浪費比 linked 更嚴重', 'linked：每塊浪費 4B；indexed：整塊給 index');
    await beat(tok, 3000);
  }
  async function scLinkedIndex(tok) {
    fresh([0, 6, 11], [0, 1, 0]);
    say('大檔案：pointer 超過一個 index block', '512B ÷ 4B = 128 → 超過 128 塊就放不下');
    const IBs = [];
    for (let j = 0; j < 3; j++) {
      const x = -4.4 + j * 4.4;
      IBs.push(cube('IB ' + (j ? '#' + (j + 1) : '19'), C.idx, [2.6, 0.5, 1.2], x, 0.25, -1, 3));
      for (let d = 0; d < 5; d++) cube('', C.file, [0.4, 0.3, 0.4], x - 1 + d * 0.5, 0.15, 1.2);
      if (j) seg(V3(x - 4.4 + 1.3, 0.3, -1), V3(x - 1.3, 0.3, -1), '#d64545');
      await beat(tok, 900);
    }
    tag('最後一格 → 下一個 index block', 'ptr alt', -2.2, 1.0, -1);
    say('Linked index scheme：index block 用 link 串起來', '名字有 linked，本質還是 indexed');
    await beat(tok, 3000);
    const cur = tag('lookup', 'ptr alt', 0, 1.2, -1);
    say('要讀檔案尾巴：一個一個 index block 找', '檔案越大，後面越慢');
    for (let j = 0; j < 3; j++) { cur.position.set(-4.4 + j * 4.4, 1.2, -1); glow(IBs[j], GOLD); await beat(tok, 800); }
    say('10 個 index block → lookup 10 次', '前面快、後面慢，速度不平均');
    await beat(tok, 3000);
  }
  async function scMultiLevel(tok) {
    fresh([0, 6, 12], [0, 1.6, 0]);
    const outer = cube('16', C.idx, [1.6, 0.5, 1], -5, 0.25, 0, 2);
    tag('outer index', 'ptr', -5, 1.0, 0);
    await beat(tok, 700);
    const inner = [];
    for (let j = 0; j < 4; j++) {
      const z = -2.4 + j * 1.6;
      inner.push(cube(j === 0 ? '19' : '…', C.idx, [1.4, 0.45, 0.9], -1.2, 0.23, z, 2));
      seg(V3(-4.2, 0.3, 0), V3(-1.9, 0.3, z), '#c08a1f');
      for (let d = 0; d < 3; d++) { const x = 2 + d * 1.5; cube('', C.file, [0.9, 0.3, 0.6], x, 0.15, z); }
      seg(V3(-0.5, 0.3, z), V3(1.55, 0.3, z), '#8a7a60');
    }
    say('Multi-level index：跟 page table 一樣分層', '16 指到 index block 19，19 才指到 data');
    await beat(tok, 3000);
    say('只有 leaf 指的是 data block', '');
    await beat(tok, 2000);
    fresh([0, 6, 12], [0, 2, 0]);
    tag('要 lookup 的 index block 數', 'ptr', 0, 0.2, 2.6);
    say('比較：讀檔案第 1…10 段', '紅＝linked index、綠＝multi-level');
    for (let i = 0; i < 10; i++) {
      const x = -5.4 + i * 1.2;
      const a = cube(String(i + 1), C.bad, [0.45, 1, 0.45], x - 0.25, 0.5, 0); a.scale.y = (i + 1) * 0.45; a.position.y = a.scale.y / 2;
      const b = cube('', C.free, [0.45, 1, 0.45], x + 0.25, 0.45, 0); b.scale.y = 0.9; b.position.y = 0.45;
      await beat(tok, 300);
    }
    say('multi-level：前面後面都一樣（2 層）', '平均穩定，系統比較喜歡');
    await beat(tok, 2800);
    say('代價：層數多時浪費空間', '只有很大的檔案才適合');
    await beat(tok, 2600);
  }
  async function scInode(tok) {
    fresh([0, 9, 9], [0, 0, 0.2]);
    const save = { ...IN }; Object.assign(IN, { bs: 4, ps: 4, nd: 12 });
    const I = buildInode(false);
    say('UNIX inode：combined scheme', '小檔案 direct，大檔案再加 level');
    await beat(tok, 2400);
    const steps = [
      [[0, 11], '12 個 direct：12 × 4KB = 48KB', '1 次 lookup 就到 data', '48KB'],
      [[12, 12], 'single indirect：4KB ÷ 4B = 1024 格', '1024 × 4KB = 4MB', '+4MB'],
      [[13, 13], 'double indirect：1024²', '1024² × 4KB = 4GB', '+4GB'],
      [[14, 14], 'triple indirect：1024³', '1024³ × 4KB = 4TB', '+4TB'],
    ];
    for (const [[a, b], cap, f, t] of steps) {
      for (let i = a; i <= b; i++) { glow(I.slots[i].m, GOLD); if (b - a > 1) await beat(tok, 120); }
      tag(t, 'ptr alt', -3.6, 0.2, I.slots[Math.round((a + b) / 2)].z);
      say(cap, f);
      if (a >= 12) {
        const lv = a - 11; let px = -4.75;
        for (let j = 0; j < lv; j++) { const x = -1.9 + j * 2.3; cube('', C.idx, [1.1, 0.4, 0.9], x, 0.2, I.slots[a].z * 0.5, 2); seg(V3(px, 0.25, j ? I.slots[a].z * 0.5 : I.slots[a].z), V3(x - 0.55, 0.25, I.slots[a].z * 0.5), '#c08a1f'); px = x + 0.55; }
      }
      await beat(tok, 2800);
    }
    say('越後面越大，但 lookup 次數也越多', 'direct 1 次、single 2、double 3、triple 4（含 data）');
    await beat(tok, 3200);
    Object.assign(IN, save);
  }
  async function scFreeKinds(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.4]);
    diskGrid();
    for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) blk(i, '', C.other);
    say('Free space：把空塊想成一個檔案', '只要 sequential：每次拿第一個空塊');
    await beat(tok, 2600);
    const L = [];
    for (let k = 1; k < FREE0.length; k++) { L.push(seg(gp(FREE0[k - 1], 0.15), gp(FREE0[k], 0.15), '#2fc092')); await beat(tok, 120); }
    const h = tag('head', 'ptr alt', gp(2).x, 0.9, gp(2).z);
    say('Linked list＝linked allocation', '每個空塊存下一個空塊');
    await beat(tok, 2600);
    L.forEach(kill); kill(h);
    const g = tag('block 2 存：3,4,5,8,9,10,11,12,13 → 下一組', 'ptr alt', 0, 0.9, -3.3);
    say('Grouping＝linked index', '第一個空塊存 n 個空塊位址');
    await beat(tok, 3000);
    txt(g, '(2,4) (8,6) (17,2) (25,3)');
    say('Counting＝contiguous', '記 (起點, 連續幾塊)');
    await beat(tok, 3000);
    say('名字不同，做法就是三種配置方式', '另外一種：bit vector');
    await beat(tok, 2600);
  }
  async function scBitVector(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.4]);
    diskGrid();
    const ms = {};
    for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) ms[i] = blk(i, '', C.other);
    say('Bit vector：一個 block 一個 bit', '周老師：0 = free、1 = occupied（恐龍書相反）');
    await beat(tok, 2600);
    const bl = [];
    for (let i = 0; i < 32; i++) { const p = gp(i, 0.6); bl.push(tag(FREE0.includes(i) ? '0' : '1', FREE0.includes(i) ? 'ptr alt' : 'idx', p.x + 0.2, 0.6, p.z - 0.15)); await beat(tok, 50); }
    let s = ''; for (let i = 0; i < 32; i++) { s += FREE0.includes(i) ? 0 : 1; if (i % 8 === 7 && i < 31) s += ' '; }
    const l = tag(s, '', 0, 0.3, -3.3); Object.assign(l.element.style, MONO);
    await beat(tok, 1600);
    say('CPU 一次讀 32/64 bits，判斷超快', '只要找到 0 就能配置');
    for (let r = 0; r < 4; r++) { for (let c = 0; c < 8; c++) { const i = r * 8 + c; if (ms[i]) glow(ms[i], GOLD); } await beat(tok, 600); for (let c = 0; c < 8; c++) { const i = r * 8 + c; if (ms[i]) glow(ms[i], null); } }
    say('缺點：partition 很大時 bit 也很多', '超過 CPU cache 就變慢');
    await beat(tok, 2600);
    say('例：1TB ÷ 4KB = 2²⁸ 塊', 'bitmap = 2²⁸ bits = 32MB');
    await beat(tok, 3200);
  }
  async function scBitmapNearest(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.4]);
    diskGrid();
    for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) blk(i, '', C.other);
    for (let i = 0; i < 32; i++) { const p = gp(i, 0.6); tag(FREE0.includes(i) ? '0' : '1', FREE0.includes(i) ? 'ptr alt' : 'idx', p.x + 0.2, 0.6, p.z - 0.15); }
    say('為什麼要一次知道所有的 0？', 'contiguous 要找「連續的 0」');
    await beat(tok, 2400);
    const cur = tag('▼', 'ptr alt', 0, 1, 0);
    let run = 0, hit = -1;
    for (let i = 0; i < 32; i++) { cursorAt(cur, i); run = FREE0.includes(i) ? run + 1 : 0; await beat(tok, 140); if (run === 6) { hit = i; break; } }
    for (let k = hit - 5; k <= hit; k++) blk(k, '', C.free, 0, 0, 1.5);
    say('連續 6 個 0：block 8–13', '掃 bit 就找得到');
    await beat(tok, 2600);
    const tgt = tag('目標位置 20', 'ptr', gp(20).x, 1.4, gp(20).z);
    say('FS 常問：離 20 最近、至少 2 塊的空位？', '讓同檔案靠近 → 磁頭少移動');
    await beat(tok, 2200);
    for (let d = 0; d <= 3; d++) { for (const i of [20 - d, 20 + d]) { cursorAt(cur, i); await beat(tok, 300); } }
    blk(17, '', C.idx, 0, 0, 1.5); blk(18, '', C.idx, 0, 0, 1.5);
    say('找到 17–18', 'bit vector 不用改就能回答；linked list 要大改');
    await beat(tok, 3200);
  }
  async function scIoCount(tok) {
    fresh([0, 5.5, 12], [0, 2, 0]);
    say('考題：10 塊的檔案，讀第 10 塊第 3 byte', '各要幾次 disk I/O？');
    await beat(tok, 2600);
    const items = [['Contiguous', 1, 'start + 9'], ['Linked', 10, '前 9 塊都要讀'], ['FAT（在 memory）', 1, '查表免 I/O'], ['Indexed', 2, 'index + data']];
    for (let i = 0; i < items.length; i++) {
      const [n, v, why] = items[i];
      const x = -4.5 + i * 3;
      const b = cube(String(v), i === 1 ? C.bad : C.free, [1.2, 1, 1.2], x, 0, 0); b.scale.y = 0.01;
      tag(n, 'ptr', x, 0.1, 1.4); tag(why, 'idx', x, 0.1, 2.0);
      await anim(tok, 600, (t) => { b.scale.y = Math.max(0.01, v * 0.5 * t); b.position.y = b.scale.y / 2; });
      say(n + '：' + v + ' 次', why);
      await beat(tok, 1400);
    }
    say('FS 做兩件 mapping', 'path → inode（FCB）；FCB → physical location');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景：課本補充（恐龍書） ─────────────────────────
  async function scDirStructures(tok) {
    fresh([0, 4.2, 13], [0, 3.3, 0]);
    for (const [k, cap, f] of [
      ['single', '課本：Single-level directory', '所有檔案同一層：不能同名'],
      ['two', '課本：Two-level directory', 'MFD → 每個 user 的 UFD；可同名'],
      ['tree', '課本：Tree-structured', '任意深度；絕對／相對路徑'],
      ['acyclic', '課本：Acyclic-graph', '可共享（link），但不能有 cycle'],
    ]) {
      lab.clear();
      const S = DSPEC[k]();
      const G = graph(S.nodes, S.edges, 2);
      for (const [id, c] of Object.entries(S.ref || {})) { const n = S.nodes[id]; tag('ref = ' + c, 'ptr alt', n.x + 1.3, n.y + 0.1); }
      say(cap, f);
      await beat(tok, 2200);
      if (k === 'single') { const a = cube('test', C.bad, [0.9, 0.5, 0.5], 1, 1.2, 0, 3); say('再建一個 test？名字衝突', ''); await beat(tok, 1800); fly(a); }
      if (k === 'tree') { for (const id of ['r', 'spell', 'mail', 'exp']) { glow(G.M[id], GOLD); await beat(tok, 450); } say('/spell/mail/exp', '從 root 一層層往下'); await beat(tok, 1400); }
      if (k === 'acyclic') { glow(G.M.cnt, GOLD); say('count 有兩條路徑：/dict/count、/spell/count', '同一個檔案，不是兩份副本'); await beat(tok, 2200); }
      await beat(tok, 900);
    }
  }
  async function scAcyclicDelete(tok) {
    fresh([0, 4.2, 13], [0, 3.3, 0]);
    const S = DSPEC.acyclic();
    let G = graph(S.nodes, S.edges, 0);
    const r = tag('hard link：ref = 2', 'ptr alt', 1.6, 1.1);
    say('課本：刪除共享檔案怎麼辦？', 'hard link 用 reference count');
    await beat(tok, 2400);
    kill(G.E.find((e) => e.a === 'spell' && e.b === 'cnt').l);
    txt(r, 'ref = 1');
    say('刪 /spell/count：ref − 1，檔案還在', '');
    await beat(tok, 2400);
    kill(G.E.find((e) => e.a === 'dict' && e.b === 'cnt').l);
    txt(r, 'ref = 0 → 刪除');
    fly(G.M.cnt);
    say('ref 變 0 才真的刪掉', '');
    await beat(tok, 2400);
    lab.clear();
    const S2 = DSPEC.acyclic();
    S2.edges = S2.edges.filter(([a, b]) => !(a === 'spell' && b === 'cnt'));
    G = graph(S2.nodes, S2.edges, 0);
    const sl = cube('count →', C.fat, [1.2, 0.5, 0.5], 1.8, 2.4, 0);
    seg(V3(3, 3.95), V3(1.8, 2.65), '#9b7ef4');
    tag('symbolic link：存路徑 /dict/count', 'ptr', 1.8, 3.1);
    say('symbolic link 只存路徑', '');
    await beat(tok, 2400);
    fly(G.M.cnt);
    glow(sl, RED);
    say('原檔被刪：soft link 變 dangling', '要用時才發現路徑無效');
    await beat(tok, 3200);
  }
  async function scInodeAccess(tok) {
    fresh([0, 9, 9], [0, 0, 0.2]);
    const save = { ...IN }; Object.assign(IN, { bs: 4, ps: 4, nd: 12, cached: true });
    buildInode(true);
    say('練習：block 4KB、pointer 4B、12 direct', 'inode 已在 memory，數 disk 存取次數');
    await beat(tok, 2600);
    for (const [off, lbl] of [[20 * 1024, '20KB'], [100 * 1024, '100KB'], [8 * 1048576, '8MB']]) {
      const r = await inodeLookup(off, tok);
      say('offset ' + lbl + ' → block ' + r.k + '：' + r.acc + ' 次', r.L.lvl === 0 ? '< 48KB：direct' : r.L.lvl === 1 ? '48KB ≤ x < 48KB + 4MB：single' : '再往後 4GB 內：double');
      await beat(tok, 2600);
    }
    Object.assign(IN, save);
  }

  const scenes = {
    'access-methods': { title: '三種 access method：sequential / direct / index', play: scAccess },
    'dir-structures': { title: '課本：single → two-level → tree → acyclic', play: scDirStructures },
    'acyclic-delete': { title: '課本：hard link 計數與 soft link dangling', play: scAcyclicDelete },
    'general-graph-gc': { title: 'General graph 的 cycle 與 garbage collection', play: scGeneralGC },
    'mount-points': { title: 'Mounting：mount point 與 recursive mount', play: scMountPoints },
    'mount-table': { title: 'Mount table：跨 partition 找檔案', play: scMountTable },
    'share-ugo': { title: 'Sharing：user ID、group ID 與三種 class', play: scShareUGO },
    'acl-bits': { title: 'ACL 簡化成 rwx × 3、ls -l、chmod 644', play: scAclBits },
    'protection-two': { title: 'Protection：damage 與 security', play: scProtection },
    'contig-linked': { title: 'Contiguous vs Linked：讀第 5 塊要先讀前 4 塊', play: scContigLinked },
    'fat': { title: 'FAT：pointer 收集成表載入 memory', play: scFat },
    'indexed-alloc': { title: 'Indexed allocation：index block 19', play: scIndexed },
    'linked-index': { title: 'Linked index scheme：index block 串起來', play: scLinkedIndex },
    'multilevel-index': { title: 'Multi-level index：16 → 19 → data', play: scMultiLevel },
    'inode-combined': { title: 'UNIX inode：48KB / 4MB / 4GB / 4TB', play: scInode },
    'inode-access': { title: '課本練習：inode 存取次數計算', play: scInodeAccess },
    'free-list-kinds': { title: 'Free space：linked list、grouping、counting', play: scFreeKinds },
    'bit-vector': { title: 'Bit vector：一塊一個 bit', play: scBitVector },
    'bitmap-nearest': { title: 'Bit vector 找連續空間與最近空位', play: scBitmapNearest },
    'io-count': { title: '讀第 10 塊要幾次 I/O？四種方式比較', play: scIoCount },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ fs.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 9 章 File System（清大 周志遠 23A–25B 講）— cued scenes ───
// Every scene is a list of steps; each step waits for the lecturer's sentence (notes "cues"), then makes one short move.
// Nothing loops or replays. 老師的數字照用（tr 14、217→618→339、512B/4B=128、16→19、12 direct×4KB…）；老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', tan: '#c9bba3', mint: '#d2f1e6', lilac: '#dfd3fb', sky: '#cfe6f7' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.cells) return gone(o.cells, o.lbls || [], o.extra || []); if (o.ls) return o.kill(); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const TOP = [[0, 9.5, 8.2], [0, 0, 0.4]];
// a vertical stack of cells (a table): rows top → bottom
function stack(x, yTop, rows, o = {}) {
  const dy = o.dy || 0.62, w = o.w || 2.6, c = o.c || FC.sand;
  const cells = rows.map((r, i) => bx(r, Array.isArray(c) ? c[i] : c, x, yTop - i * dy, o.z || 0, w, dy - 0.08, 0.7));
  const lbls = o.title ? [hd(o.title, x, yTop + 0.65, o.z || 0)] : [];
  return { cells, lbls, y: (i) => yTop - i * dy, set(i, t) { relabel(cells[i], t); } };
}
// a horizontal row of cells (bytes, blocks, bits)
function row(x0, y, vals, o = {}) {
  const w = o.w || 0.7, gap = o.gap == null ? 0.08 : o.gap, c = o.c || FC.blue;
  const cells = vals.map((v, i) => bx(v, typeof c === 'function' ? c(i) : c, x0 + i * (w + gap), y, o.z || 0, w, o.h || 0.5, o.d || 0.6));
  return { cells, x: (i) => x0 + i * (w + gap) };
}
// circles in the x-y plane (disk platter seen face-on)
function ring(cx, cy, r, color = '#8a7a60', a0 = 0, a1 = Math.PI * 2, z = 0.05, n = 48) {
  const pts = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push(V3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
const lk = (a, b, c) => arrow(a, b, c);

// ════════ xzjOe7-m6qc（第 23A 講：File Concept & Access Methods） ════════
scene('fs-23a-intro', '檔案系統這章要談什麼', CAM, [
  async (tok, S) => { // 2.0 CPU、memory 之後：storage，最主要就是檔案
    S.cpu = prop('cpu', -5.2, 0, 0, 1.0, 'CPU'); S.mem = bx('memory', FC.sky, -2.4, 0.5, 0, 2.0, 1.0, 1.0);
    S.disk = prop('disk', 1.2, 0, 0, 1.3, 'storage'); S.f = prop('file', 3.6, 0.2, 0, 1.0, 'file');
    S.cpu.userData.label.element.classList.add('lab-dim'); S.mem.material.transparent = true; S.mem.material.opacity = 0.5;
    cap('最後一塊資源：storage', '儲存最主要的目的就是「檔案」');
  },
  async (tok, S) => { // 51.3 兩個章節：interface、implementation
    note('本章：File System Interface（使用者角度）', -1.6, 6.6); sm('下一章：Implementation（怎麼實作）', -1.6, 6.0);
    cap('分兩章：先從使用者角度看', '下一章再講檔案系統怎麼實作');
  },
  async (tok, S) => { // 96.0 什麼是檔案、access method
    hot('① 檔案與 access method', -4.6, 4.8);
    cap('什麼是檔案，以及 access method', '怎麼讀一個檔案，會影響 programming 與實作');
  },
  async (tok, S) => { // 130.9 directory
    hot('② directory（資料夾）', -4.6, 4.1);
    cap('directory：資料夾的概念', '');
  },
  async (tok, S) => { // 139.0 mounting
    hot('③ mounting：把空間掛進來', 0.6, 4.8);
    cap('mounting', '動態把儲存空間加進檔案系統');
  },
  async (tok, S) => { // 153.5 sharing
    hot('④ sharing：檔案是拿來分享的', 0.6, 4.1);
    cap('sharing 很重要', '不同使用者共享，甚至跨網路');
  },
  async (tok, S) => { // 191.1 protection
    hot('⑤ protection', 4.6, 4.8);
    cap('protection', '資料屬於使用者，要保護好');
  },
]);

scene('fs-23a-logical', 'File 是 logical unit，sector 才是 physical unit', CAM, [
  async (tok, S) => { // 208.3 什麼是 file
    S.f = prop('file', -4.8, 1.4, 0, 1.3, 'a.txt');
    cap('首先：什麼是 file？', '');
  },
  async (tok, S) => { // 210.6 logical storage unit
    hot('logical storage unit', -4.8, 3.6);
    cap('file 是 logical storage unit', '一種方便人使用的「邏輯」單位');
  },
  async (tok, S) => { // 225.5 只是一堆 bytes
    S.b = row(-6.0, 0.6, ['48', '65', '6c', '6c', '6f'], { w: 0.42, h: 0.42, d: 0.4, c: FC.orange });
    sm('內容 = 一串 bytes（示意）', -5.0, 0.0);
    cap('存的就是一堆 bytes', 'storage 不管內容是什麼');
  },
  async (tok, S) => { // 257.7 physical 看 hardware
    S.cx = 2.6; S.cy = 3.0;
    S.r = [2.6, 1.9, 1.2].map((r) => ring(S.cx, S.cy, r, '#8a7a60'));
    hd('physical：看硬體怎麼存', 2.6, 6.3);
    cap('physical unit 取決於 hardware', '用什麼 device、什麼方式存');
  },
  async (tok, S) => { // 284.0 hard drive
    S.d = prop('disk', 6.0, 0, 0, 0.8, 'hard drive');
    cap('目前主要還是 hard drive', '用讀寫頭讀寫的硬碟');
  },
  async (tok, S) => { // 310.5 好幾個 plate
    sm('platter（讀寫盤，有好幾片）', 2.6, -0.1);
    cap('硬碟裡有好幾片讀寫盤（plate）', '這裡把一片正面畫出來');
  },
  async (tok, S) => { // 322.1 track：一圈一圈
    S.r.forEach((l) => { l.material.color.set('#c08a1f'); });
    sm('track：一圈一圈', 5.6, 4.9);
    cap('盤面切成一圈一圈的 track', '');
  },
  async (tok, S) => { // 324.2 sector：一段一段
    S.sec = ring(S.cx, S.cy, 1.9, '#d64545', 0.2, 0.75, 0.08);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(S.cx + 0.9 * Math.cos(a), S.cy + 0.9 * Math.sin(a), S.cx + 2.8 * Math.cos(a), S.cy + 2.8 * Math.sin(a), 0.04, '#b8a888'); }
    hot('sector', S.cx + 2.0, S.cy + 1.4);
    cap('每個 track 再切成一段段 sector', '');
  },
  async (tok, S) => { // 329.9 最小的單位
    good('sector = 真正存資料的最小單位', 2.6, 0.6);
    cap('sector 才是存資料的最小單位', '這叫 physical storage unit');
  },
  async (tok, S) => { // 341.4 file 只是 logical unit，對到 sector
    S.a = lk(V3(-3.9, 2.0, 0), V3(S.cx + 1.4, S.cy + 0.9, 0), 0xc08a1f);
    cap('file 只是 logical unit', '內容最後要 map 到 physical 的 sector 上');
  },
]);

scene('fs-23a-attr', 'File attributes：name、identifier、type、size…', CAM, [
  async (tok, S) => { // 361.1 content map 到 physical 位置
    S.f = prop('file', -5.2, 1.2, 0, 1.2, 'a.txt'); S.d = prop('disk', -5.2, -0.2, 2.2, 0.7);
    cap('除了把內容 map 到 device 上的位置', '');
  },
  async (tok, S) => { // 367.6 很多 attribute 描述檔案
    S.t = stack(0.6, 5.4, [' ', ' ', ' ', ' ', ' ', ' '], { w: 5.2, c: FC.paper, title: 'attributes' });
    cap('還有很多 attribute 描述這個檔案', '方便使用者操作');
  },
  async (tok, S) => { // 376.6 檔名
    S.t.set(0, 'name：a.txt（給人看的）'); glow(S.t.cells[0], HL);
    cap('檔名也只是一個 attribute', '使用者自己取，方便辨認');
  },
  async (tok, S) => { // 387.8 identifier
    glow(S.t.cells[0], null); S.t.set(1, 'identifier：#1027（示意）'); glow(S.t.cells[1], HL);
    cap('真正唯一的是 identifier', 'non-human readable 的 ID');
  },
  async (tok, S) => { // 400.6 type、location、size、protection
    glow(S.t.cells[1], null);
    S.t.set(2, 'type：資料型態'); S.t.set(3, 'location：存在哪'); S.t.set(4, 'size：多大'); S.t.set(5, 'protection：權限');
    cap('還有 type、location、size、protection', '');
  },
  async (tok, S) => { // 417.9 有些是給 OS / FS 自己管理用
    bub('有些給使用者看，有些給 OS 管理', 0.6, 6.7);
    cap('有些 attribute 是給 OS 自己 manage', '');
  },
  async (tok, S) => { // 423.6 都必須存起來
    S.a = lk(V3(-2.0, 2.4, 0), V3(-4.4, 0.8, 1.6), 0xc08a1f);
    good('attributes 也要存起來', 0.6, -0.2);
    cap('這些資訊都必須存起來', '合起來才構成一個 file');
  },
]);

scene('fs-23a-ops', 'File operations：create、truncate、concatenate', CAM, [
  async (tok, S) => { // 433.6 operation 大概十個
    hd('file operations（約十種）', 0, 6.6);
    cap('file 支援的 operation 不多', '大概十個左右');
  },
  async (tok, S) => { // 446.3 open、read、write
    ['open', 'read', 'write'].forEach((t, i) => bx(t, FC.blue, -4.5 + i * 1.6, 5.4, 0, 1.4, 0.5, 0.6));
    cap('最常見：open、read、write', '');
  },
  async (tok, S) => { // 451.5 create、delete
    ['create', 'delete'].forEach((t, i) => bx(t, FC.green, 0.6 + i * 1.6, 5.4, 0, 1.4, 0.5, 0.6));
    cap('還有 create、delete', '');
  },
  async (tok, S) => { // 454.5 truncate
    S.r = row(-4.0, 3.0, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], { c: FC.orange });
    sm('log.txt（示意）', -4.6, 2.3);
    cap('甚至可以 truncate', '');
  },
  async (tok, S) => { // 458.8 從某點寫下去，後面不要了
    const cut = hot('▼ 從這裡截斷', S.r.x(4), 3.9);
    await wt(tok, 500);
    for (let i = 4; i < 8; i++) { S.r.cells[i].material.transparent = true; S.r.cells[i].material.opacity = 0.2; }
    cap('truncate：從一個點之後的都不要了', '處理檔案時很常用');
  },
  async (tok, S) => { // 475.7 concatenate
    S.a = row(-4.0, 1.0, ['1', '2', '3'], { c: FC.purple }); S.b = row(2.0, 1.0, ['4', '5'], { c: FC.teal });
    sm('log1', -4.4, 0.4); sm('log2', 1.6, 0.4);
    cap('concatenate：把兩個檔案接起來', '');
  },
  async (tok, S) => { // 477.6 接在一起
    await anim(tok, 800, (u) => S.b.cells.forEach((m, i) => { m.position.x = 2.0 + i * 0.78 + (S.a.x(3) - 2.0) * u; }));
    cap('接在一起：誰在前、誰在後都可以', '');
  },
  async (tok, S) => { // 491.4 不同 process dump 的 log
    bub('不同 process 各寫一份 log，合起來才有意義', 0, -0.2);
    cap('例如不同 process dump 出的 log', 'concatenate 合在一起比較好用');
  },
]);

scene('fs-23a-tables', '兩張表：per-process 與 system-wide open-file table', CAM, [
  async (tok, S) => { // 522.0 要 manage 就需要 metadata
    S.f = prop('file', 0, 4.8, 0, 1.0, 'a.txt');
    cap('要操作檔案內容', '運作時需要 metadata：存在哪、讀到哪');
  },
  async (tok, S) => { // 544.1 兩個 data structure
    hd('兩個最主要的 data structure', 0, 6.9);
    cap('最主要兩個 data structure', '');
  },
  async (tok, S) => { // 548.8 process 這邊：open-file table
    S.p1 = buddy('P1', '', FC.blue, -5.0, 0, 0, 0.8);
    S.t1 = stack(-5.0, 3.4, [' '], { w: 2.4, c: FC.sky, title: 'open-file table' });
    cap('一個在操作檔案的 process 這邊', '叫 open-file table');
  },
  async (tok, S) => { // 559.2 為什麼一定要先 open
    S.t1.set(0, 'a.txt 的 entry'); glow(S.t1.cells[0], HL);
    cap('為什麼一定要先 open？', 'open 才會建立這些需要的資訊');
  },
  async (tok, S) => { // 584.3 OS level：system-wide table
    glow(S.t1.cells[0], null);
    S.z = zone('OS', 3.0, 0, 0.6, 5.6, 2.0, '#efe6d6');
    S.sw = stack(3.0, 2.2, ['a.txt'], { w: 2.8, c: FC.lilac, title: 'system-wide table' });
    cap('OS 這邊也存一份：system-wide table', '');
  },
  async (tok, S) => { // 606.6 share 給所有 process
    S.p2 = buddy('P2', '', FC.orange, -1.6, 0, 0, 0.8);
    S.a1 = lk(V3(-3.8, 3.4, 0), V3(1.5, 2.3, 0)); S.a2 = lk(V3(-1.0, 1.2, 0), V3(1.5, 2.1, 0));
    cap('system-wide：內容 share 給所有 process', '誰開了這個檔，資訊都在這');
  },
  async (tok, S) => { // 624.2 跟 process 有關的放 open-file table
    note('跟「哪個 process 開的」有關 → per-process', -3.0, 5.6);
    cap('跟 process 有關的資訊', '就存在它自己的 open-file table');
  },
  async (tok, S) => { // 640.4 兩個都要 maintain
    good('兩張表都要維護，系統才能運作', 0, -0.4);
    cap('兩個都必須 maintain', '');
  },
]);

scene('fs-23a-perproc', 'Per-process table：file pointer 與 access right', CAM, [
  async (tok, S) => { // 652.0 per process
    S.p1 = buddy('P1', '', FC.blue, -4.6, 0, 0, 0.8);
    S.t1 = stack(-4.6, 4.6, [' ', ' ', ' '], { w: 2.8, c: FC.sky, title: 'P1 的 open-file table' });
    cap('第一個：process 這邊的 table', '重點是 per process');
  },
  async (tok, S) => { // 660.7 每開一個檔就有一個 entry
    S.t1.set(0, 'entry：a.txt');
    cap('每開一個檔案，table 就多一個 entry', 'entry 是一個 data structure');
  },
  async (tok, S) => { // 688.1 file pointer、fopen 的 handler
    S.c = code(['fp = fopen("a.txt", "r");'], 0.8, 6.4);
    cap('fopen 之後給你一個 file handler', '大家常說的 file pointer');
  },
  async (tok, S) => { // 698.5 handler 對到 entry
    S.a = lk(V3(-1.6, 6.2, 0), V3(-3.1, 4.7, 0), 0xc08a1f);
    cap('handler 對到的就是這個 entry 的位置', '');
  },
  async (tok, S) => { // 707.9 存 position
    S.t1.set(1, 'position = 0'); glow(S.t1.cells[1], HL);
    cap('entry 裡很重要的是 position', '讀到哪裡了');
  },
  async (tok, S) => { // 709.5 每個 process 有自己的 position
    S.p2 = buddy('P2', '', FC.orange, 3.4, 0, 0, 0.8);
    S.t2 = stack(3.4, 4.6, ['entry：a.txt', 'position = 0', ' '], { w: 2.8, c: FC.mint, title: 'P2 的 open-file table' });
    cap('同一個 file 可被很多 process 開', '每個 process 有自己的 position');
  },
  async (tok, S) => { // 720.4 read 之後位置往後
    S.c2 = code(['fread(buf, 1, 4, fp);'], 0.8, 5.8);
    await wt(tok, 300); S.t1.set(1, 'position = 4'); S.p1.mood('happy');
    cap('P1 read 4 bytes：它的 position 變 4', 'P2 的還是 0，只跟自己有關');
  },
  async (tok, S) => { // 731.4 access right
    glow(S.t1.cells[1], null); S.t1.set(2, 'mode：read'); S.t2.set(2, 'mode：write');
    glow(S.t1.cells[2], HL); glow(S.t2.cells[2], HL);
    cap('還有 access right', '同一個檔，你我開的權限可能不同');
  },
  async (tok, S) => { // 748.6 開啟時的權限記在 open-file table
    good('會因 process 而不同的 → 放 open-file table', 0, -0.4);
    cap('開的時候用 read 還是 write', '都記錄在 open-file table');
  },
]);

scene('fs-23a-syswide', 'System-wide table：為什麼不複製每份', CAM, [
  async (tok, S) => { // 772.2 system-wide table
    S.sw = stack(0, 6.2, ['a.txt', ' ', ' '], { w: 3.6, c: FC.lilac, title: 'system-wide open-file table' });
    cap('另一個是 system-wide table', '跨整個 OS，任何 process 開的檔都在');
  },
  async (tok, S) => { // 788.9 兩邊的 entry 對在一起
    S.t1 = stack(-4.6, 2.6, ['a.txt  pos 4'], { w: 2.6, c: FC.sky, title: 'P1' });
    S.t2 = stack(4.6, 2.6, ['a.txt  pos 0'], { w: 2.6, c: FC.mint, title: 'P2' });
    S.a = [lk(V3(-3.3, 2.8, 0), V3(-1.8, 5.9, 0)), lk(V3(3.3, 2.8, 0), V3(1.8, 5.9, 0))];
    cap('兩邊的 entry 對在一起', '這邊有 a.txt，那邊也有 a.txt');
  },
  async (tok, S) => { // 802.2 存跟 process 無關的
    cap('system-wide 存的是 process independent 的資訊', '不管誰開，大家看到都一樣');
  },
  async (tok, S) => { // 822.5 disk location
    S.sw.set(1, 'disk location'); glow(S.sw.cells[1], HL);
    cap('例如 disk location', 'file 只有一個，內容的位置只有一個');
  },
  async (tok, S) => { // 847.5 access date、file size
    glow(S.sw.cells[1], null); S.sw.set(2, 'access date、size = 100');
    cap('還有 access date、file size', '');
  },
  async (tok, S) => { // 875.3 為什麼要這樣切
    S.q = bub('為什麼不全部存在每個 process 的表裡？', 0, 4.2);
    cap('為什麼要分兩張表？', '');
  },
  async (tok, S) => { // 890.1 duplicate 很危險
    gone(S.q);
    S.c1 = bx('size = 100', FC.sand, -4.6, 1.2, 0, 2.2, 0.5, 0.6); S.c2 = bx('size = 100', FC.sand, 4.6, 1.2, 0, 2.2, 0.5, 0.6);
    bad('同一份資料複製很多份', 0, 1.2);
    cap('同一份資料複製很多份很危險', 'design decision 的考量');
  },
  async (tok, S) => { // 911.1 有人 write，size 變了
    relabel(S.c1, 'size = 120'); glow(S.c1, NG);
    cap('P1 write 讓檔案變長', '只改到一份：100 和 120 不一致');
  },
  async (tok, S) => { // 929.9 data consistency
    bad('data consistency 問題', 0, 0.4);
    cap('這就是 data consistency 問題', '要解決通常很麻煩');
  },
  async (tok, S) => { // 951.3 用一個 system-wide table 存
    gone(S.c1, S.c2); S.sw.set(2, 'access date、size = 120'); glow(S.sw.cells[2], OKG);
    good('大家都一樣的 → 只存一份在 system-wide', 0, -0.4);
    cap('所以大家看到都一樣的就只存一份', '會變的各自存：比較 efficient');
  },
  async (tok, S) => { // 982.6 下一章再講怎麼用
    cap('兩張表先從使用者角度簡介', '下一章再看實際怎麼用它們');
  },
]);

scene('fs-23a-type', 'File type（副檔名）只是 hint', CAM, [
  async (tok, S) => { // 994.6 attribute 開啟後進到不同 table
    S.sw = bx('system-wide', FC.lilac, 4.4, 5.6, 0, 2.6, 0.6, 0.7); S.pp = bx('per-process', FC.sky, 4.4, 4.6, 0, 2.6, 0.6, 0.7);
    cap('attribute 看跟 process 有沒有關', '開啟後分別放到不同 table');
  },
  async (tok, S) => { // 1017.7 file type：副檔名
    S.f = prop('file', -4.6, 1.6, 0, 1.3, 'report.docx');
    cap('提醒一個熟悉的 attribute：file type', '就是副檔名');
  },
  async (tok, S) => { // 1024.5 沒有實質意義，只是 hint
    hot('.docx = hint', -4.6, 4.6);
    cap('副檔名對 OS 沒有實質意義', '只是一個 hint');
  },
  async (tok, S) => { // 1038.2 點兩下：用哪個程式開？
    S.q = bub('點兩下：要用哪個程式開？', -0.4, 3.4);
    cap('點兩下要執行時', 'OS 怎麼知道用哪個應用程式？');
  },
  async (tok, S) => { // 1052.1 先猜、先嘗試
    S.a = lk(V3(-3.6, 2.2, 0), V3(1.4, 2.2, 0), 0xc08a1f);
    S.w = prop('monitor', 2.6, 1.0, 0, 0.8, 'Word');
    cap('看副檔名，OS 先猜、先試對應的程式', '就只是這樣');
  },
  async (tok, S) => { // 1067.3 Linux 很多檔案沒有副檔名
    S.g = prop('file', -4.6, -0.6, 2.0, 0.9, 'run（沒有副檔名）');
    good('沒有副檔名也無所謂', 1.6, -0.4);
    cap('Linux 很多檔案沒有副檔名', '也沒關係；副檔名方便人分辨');
  },
]);

scene('fs-23a-seq', 'Sequential access：current position 自動往後', CAM, [
  async (tok, S) => { // 1096.6 怎麼 access
    S.f = prop('file', -5.6, 4.6, 0, 0.9, 'a.txt');
    cap('接著看 file 有哪些 access 方式', '平常是開 Word、寫 fopen');
  },
  async (tok, S) => { // 1122.3 大分三類
    S.k = [hot('Sequential', -1.6, 6.5), sm('Direct', 1.4, 6.5), sm('Index', 3.6, 6.5)];
    cap('大致分三大類', '其他都是 variation');
  },
  async (tok, S) => { // 1136.6 sequential
    S.t = row(-4.0, 3.2, Array.from({ length: 10 }, (_, i) => String(i)), { c: FC.blue });
    cap('第一種：sequential access', '');
  },
  async (tok, S) => { // 1139.8 檔案就是 array of bytes
    sm('檔案 = array of bytes', 0, 2.4);
    cap('檔案就是一個 array of bytes', '');
  },
  async (tok, S) => { // 1157.9 連續讀 → current position
    S.cur = hot('▼ current position', S.t.x(0), 4.1);
    cap('讀的時候必須連續', '所以 API 需要一個 current position');
  },
  async (tok, S) => { // 1169.6 read 從這個位置接下去
    for (let i = 0; i < 4; i++) glow(S.t.cells[i], HL);
    await slide(tok, S.cur, S.t.x(4), 4.1, 0, 700);
    cap('read：從目前位置接續讀下去', '');
  },
  async (tok, S) => { // 1182.0 不用給 position，只給長度
    S.c = code(['read(fp, 4)    // 只給長度'], 0, 1.2);
    cap('read / write 不用給 position', '只要告訴它長度');
  },
  async (tok, S) => { // 1194.2 position 隱含地往後移
    for (let i = 4; i < 8; i++) glow(S.t.cells[i], HL);
    await slide(tok, S.cur, S.t.x(8), 4.1, 0, 700);
    cap('讀 4 個 byte，position 自動往後 4', 'implicit：程式裡沒寫，library 幫你移');
  },
  async (tok, S) => { // 1216.3 要到其他位置：reset / rewind
    S.t.cells.forEach((m) => glow(m, null));
    await slide(tok, S.cur, S.t.x(0), 4.1, 0, 800);
    cap('要到別的位置就得 reset / rewind', '回到 0 或指定位置');
  },
  async (tok, S) => { // 1255.6 C 的 fopen、fread、fwrite
    S.c.kill(); S.c = code(['fopen / fread / fwrite', '→ sequential access'], 0, 1.4);
    cap('C library 的 fopen、fread、fwrite', '都是 sequential access');
  },
  async (tok, S) => { // 1267.2 為什麼？硬碟 sequential 快
    S.d = prop('disk', 5.6, 0, 0, 0.8, 'hard drive');
    good('disk：sequential 遠快於 random', 2.4, -0.4);
    cap('檔案多半存在硬碟', '硬碟 sequential 讀寫遠快於 random');
  },
]);

scene('fs-23a-direct', 'Direct (random) access：每次給 position', CAM, [
  async (tok, S) => { // 1334.0 另一種
    S.t = row(-4.0, 3.2, Array.from({ length: 10 }, (_, i) => String(i)), { c: FC.purple });
    cap('另一種：direct access', '');
  },
  async (tok, S) => { // 1340.7 也叫 random access
    hd('Direct = Random access', 0, 6.4);
    cap('也就是 random access', '跳著讀寫');
  },
  async (tok, S) => { // 1351.6 告訴它要讀什麼位置
    S.c = code(['read(fp, pos=7, 1)'], 0, 1.4);
    S.cur = hot('▼', S.t.x(7), 4.1); glow(S.t.cells[7], HL);
    cap('直接告訴 file system 要讀哪個位置', '');
  },
  async (tok, S) => { // 1370.1 read / write 必須塞 position 參數
    glow(S.t.cells[7], null); S.c.kill(); S.c = code(['read(fp, pos=2, 1)'], 0, 1.4);
    await slide(tok, S.cur, S.t.x(2), 4.1, 0, 600); glow(S.t.cells[2], HL);
    cap('call read / write 時要給 position 參數', '不給位置，library 不知道要讀哪');
  },
  async (tok, S) => { // 1393.5 看似比較 powerful
    good('一個 API 可以讀任何位置', 0, 5.6);
    cap('看似比較 powerful', '不受 sequential 的限制');
  },
  async (tok, S) => { // 1404.5 為什麼還要 sequential API
    S.q = bub('那為什麼還要 sequential API？', 0, 4.8);
    cap('為什麼還會有 sequential API？', '各有各的好處');
  },
  async (tok, S) => { // 1426.3 從頭掃到尾：reset 後 read read read
    gone(S.q); glow(S.t.cells[2], null); S.c.kill();
    S.c = code(['reset(fp);', 'read(fp,4); read(fp,4); …'], -3.0, 1.6);
    for (let i = 0; i < 10; i++) { glow(S.t.cells[i], OKG); await wt(tok, 90); }
    cap('從頭掃到尾：用 sequential API 很簡單', 'reset 之後 read、read、read');
  },
  async (tok, S) => { // 1449.0 direct 也做得到但要自己加 position
    S.c2 = code(['pos += 4;', 'read(fp, pos, 4);'], 3.4, 1.6);
    cap('用 direct API 也做得到', '但每次都要自己 increase position，不直覺');
  },
  async (tok, S) => { // 1480.0 看使用需求
    cap('所以看使用行為選 API', '連續讀用 sequential；跳著讀用 direct');
  },
  async (tok, S) => { // 1507.8 file system 大多是 sequential
    note('file system 多半是 sequential', 0, -0.3);
    cap('file system 大部分是 sequential', '這是檔案的特性');
  },
]);

scene('fs-23a-index', 'Index access：用 key 查 index 再找到位置', CAM, [
  async (tok, S) => { // 1524.2 direct 的變形：index
    hd('Index access（random access 的變形）', 0, 6.6);
    cap('random access 的變形：index access', '知道概念就好');
  },
  async (tok, S) => { // 1551.4 像 database
    S.db = prop('disk', -5.6, 3.6, 0, 0.8, 'database');
    cap('index access 就像 database', '');
  },
  async (tok, S) => { // 1557.3 只說要 John
    S.k = bx('John', FC.gold, -5.6, 1.6, 0, 1.4, 0.5, 0.6);
    cap('找資料時只說：我要 John', '不知道資料存在哪');
  },
  async (tok, S) => { // 1577.4 不想 sequential，要 random
    bad('從頭掃：太慢', -2.4, 4.4);
    cap('不想用 sequential 從頭找', '希望 random access 直接拉出那筆');
  },
  async (tok, S) => { // 1591.9 用 index
    S.ix = stack(-1.4, 3.4, ['Adams → 1', 'John  → 6', 'Smith → 3'], { w: 2.6, c: FC.paper, title: 'index（示意）' });
    cap('更進一步：用 index', '用名字這種 identifier 查');
  },
  async (tok, S) => { // 1632.2 檔案通常沒 structure
    S.r = row(2.0, 0.4, ['0', '1', '2', '3', '4', '5', '6', '7'], { w: 0.55, c: FC.blue });
    cap('一般檔案沒有 structure', '通常從頭讀到尾');
  },
  async (tok, S) => { // 1647.0 有 record 的概念
    sm('records（有 structure）', 4.0, -0.3);
    cap('資料內部有 record 的 structure 時', '仍是檔案，讀法就不一樣');
  },
  async (tok, S) => { // 1664.2 index table 做 mapping
    glow(S.k, HL); glow(S.ix.cells[1], HL);
    S.a = lk(V3(-4.8, 1.6, 0), V3(-2.8, 2.8, 0), 0xc08a1f);
    await wt(tok, 400);
    S.b = lk(V3(-0.1, 2.8, 0), V3(2.0 + 6 * 0.63, 0.75, 0), 0xc08a1f); glow(S.r.cells[6], HL);
    cap('在 random access 上再建一張 index table', 'John、Smith、Adams 對到哪個 position');
  },
]);

scene('fs-23a-impl', 'Access pattern 與底下 device 的配合', CAM, [
  async (tok, S) => { // 1690.0 檔案系統多 sequential；database 也是檔案
    S.fs = bx('file system：多 sequential', FC.blue, -3.6, 5.6, 0, 3.6, 0.6, 0.7);
    S.db = bx('database：random', FC.purple, 3.6, 5.6, 0, 3.6, 0.6, 0.7);
    cap('不同型別的 access', '檔案系統多是 sequential；database 也是一種檔案');
  },
  async (tok, S) => { // 1711.7 disk 不喜歡 random
    S.d = prop('disk', 0, 0, 0, 1.0, 'disk'); bad('disk 不喜歡 random', 0, 2.2);
    cap('physical device 像 disk', '不太喜歡 random access');
  },
  async (tok, S) => { // 1719.5 要 support random 需要 memory cache
    S.m = bx('memory cache', FC.pink, 3.6, 3.8, 0, 2.6, 0.6, 0.7);
    S.a = lk(V3(3.6, 3.4, 0), V3(1.0, 1.0, 0));
    cap('上層要 support random access', '通常一定要有 memory cache 才夠快');
  },
  async (tok, S) => { // 1731.1 database 與 file system 設計很不同
    cap('所以 database 跟 file system 設計很不同', '資料盡量 keep 在 memory');
  },
  async (tok, S) => { // 1763.3 看應用選 access 方式
    note('看應用情境選 access method', -3.6, 4.4);
    cap('file access 有不同方式', 'library 要選比較適合的');
  },
  async (tok, S) => { // 1777.9 對上：減少 programming effort
    good('對上：使用者好寫程式', -3.6, 3.6);
    cap('對上：適合使用者', '減少 programming 的 effort');
  },
  async (tok, S) => { // 1783.8 對下：在 device 上有效率
    good('對下：在 device 上跑得快', -3.6, 2.8);
    cap('對下：access pattern 在 physical device 上', '要能 efficient 地存取');
  },
  async (tok, S) => { // 1818.6 作業：不同實作方式
    sm('實作方式也各有擅長：sequential / random / truncate / concatenate', 0, -0.6);
    cap('作業會發現：同是 file system 也有不同實作', '各自適合不同的操作');
  },
  async (tok, S) => { // 1857.6 總結
    hot('Sequential 與 Random 兩種使用方式', 0, 6.6);
    cap('先從使用角度建立觀念', 'sequential 與 random access');
  },
]);

// ════════ NDBhHLzz4p8（第 23B 講：Directory Structure） ════════
const DCAM = [[0, 4.2, 13], [0, 3.3, 0]];
scene('fs-23b-partvol', 'Partition 與 Volume：格式化之後才有檔案系統', CAM, [
  async (tok, S) => { // 16.1 directory：檔案多了用資料夾管
    S.fs = [0, 1, 2, 3].map((i) => prop('file', -5.8 + i * 0.7, 4.6, 0, 0.6));
    S.dir = bx('資料夾', FC.blue, -4.8, 3.9, 0, 2.4, 0.4, 0.8);
    cap('檔案很多時怎麼管理？', '放進資料夾（directory），方便找');
  },
  async (tok, S) => { // 49.7 除了 directory 還有 partition、volume
    S.d = bx('', FC.dark, 1.6, 0.6, 0, 7.6, 1.0, 1.2); sm('一顆硬碟', 1.6, -0.2);
    cap('除了 directory，還有 partition 跟 volume', '要分清楚');
  },
  async (tok, S) => { // 67.7 volume 就像 C 槽、D 槽
    S.c = bub('volume ≈ C 槽、D 槽', 1.6, 5.8);
    cap('volume 就像 C 槽、D 槽', '');
  },
  async (tok, S) => { // 72.4 partition：把 device 切出來的 part
    S.p = [bx('P1', FC.sand, -0.6, 1.9, 0, 3.0, 0.8, 1.0), bx('P2', FC.sand, 3.4, 1.9, 0, 4.2, 0.8, 1.0)];
    cap('partition：對硬碟做切割，切出來的那塊', '');
  },
  async (tok, S) => { // 94.6 兩個完全不同的東西
    note('volume = partition + 檔案系統', 1.6, 4.6);
    cap('兩個指的是完全不同的東西', 'volume 是格式化、有了 file system 的 partition');
  },
  async (tok, S) => { // 104.8 買一顆硬碟：先 partition
    S.p.forEach((m) => glow(m, HL));
    cap('買了一顆硬碟，第一件事：partition', '決定要切多少空間');
  },
  async (tok, S) => { // 121.7 formatting：建立檔案系統
    S.p.forEach((m) => glow(m, null));
    S.fsl = bx('file system', FC.green, -0.6, 2.75, 0, 2.6, 0.4, 0.9);
    cap('接著 formatting（格式化）', '就是在 partition 上建立一個檔案系統');
  },
  async (tok, S) => { // 139.0 partition 變成 volume
    relabel(S.p[0], 'C:（volume）'); tint(S.p[0], FC.mint);
    cap('這塊空間就從 partition 變成 volume', '重點：有沒有 file system');
  },
  async (tok, S) => { // 169.5 partition 可以是多顆 disk
    gone(S.c);
    S.many = [0, 1, 2, 3, 4].map((i) => bx('2TB', FC.dark, -5.6 + i * 1.3, 5.6, 0, 1.1, 0.6, 0.8));
    cap('partition 也可以是 group of multiple disks', '不一定對到一顆硬碟');
  },
  async (tok, S) => { // 190.4 每顆 2T，五顆串成 10T
    S.big = bx('一個 partition：10TB', FC.sand, -3.0, 6.5, 0, 6.2, 0.5, 0.8);
    cap('每顆只有 2T，想要一個大槽？', '五顆串起來（甚至透過網路）變成 10T');
  },
  async (tok, S) => { // 220.2 不是所有 device 都能 partition
    bad('floppy、CD-ROM：不能 partition', 4.4, 5.0);
    cap('受限於 device 特性', 'floppy、CD-ROM 就是一整個，沒辦法切');
  },
  async (tok, S) => { // 251.3 總結
    good('partition = raw；format 之後 = volume', 1.6, -0.9);
    cap('partition 是 raw 的', 'format 之後變 volume：差在有沒有檔案系統');
  },
]);

scene('fs-23b-raw', 'Raw partition：database、swap space 不用 format', CAM, [
  async (tok, S) => { // 262.5 database 跟 file system 很像
    S.db = prop('disk', -4.6, 2.6, 0, 1.0, 'database');
    cap('database 跟 file system 角色很像', '只是它 support random access');
  },
  async (tok, S) => { // 277.0 database 常用沒 format 的 raw partition
    S.raw = bx('raw partition（沒 format）', FC.tan, 1.4, 1.0, 0, 5.4, 0.8, 1.0);
    S.a = lk(V3(-3.6, 2.6, 0), V3(-0.8, 1.5, 0));
    cap('database 很多直接用 raw partition', '不做 formatting，直接建 database');
  },
  async (tok, S) => { // 302.6 table 每個 row 大小固定
    S.rows = [0, 1, 2, 3, 4, 5].map((i) => bx('row', FC.purple, -1.0 + i * 0.95, 1.0, 0.6, 0.85, 0.5, 0.3));
    cap('傳統 database 用 table：每個 row 大小已知', '何必還要管 file？直接切來用');
  },
  async (tok, S) => { // 329.8 swap space 也是
    S.sw = bx('swap space', FC.pink, 1.4, 3.4, 0, 3.0, 0.7, 1.0);
    good('沒人說一定要透過 file system', 1.4, 5.0);
    cap('之前講的 swap space 也一樣', '給它一塊 raw partition 就好');
  },
]);

scene('fs-23b-layout', 'Directory 在 volume 上：先找目錄，再找內容', CAM, [
  async (tok, S) => { // 340.0 directory：分類管理
    S.dir = bx('directory', FC.blue, 0, 6.0, 0, 2.6, 0.5, 0.8);
    cap('directory：把檔案切割分類', '比較容易找到要的 file');
  },
  async (tok, S) => { // 355.1 位置只是 logical：path
    S.path = hot('/home/john/a.txt', 0, 6.8);
    cap('這裡的「位置」只是 logical 的', '就是 file 的 path');
  },
  async (tok, S) => { // 366.0 disk 1、disk 2 是 physical
    S.d1 = bx('disk 1', FC.dark, -3.0, 0.5, 0, 4.0, 1.0, 1.2); S.d2 = bx('disk 2', FC.dark, 3.0, 0.5, 0, 4.0, 1.0, 1.2);
    cap('示意圖：disk 1、disk 2 是 physical device', '');
  },
  async (tok, S) => { // 375.6 partition 可在同一顆，也可以跨
    S.pa = bx('partition A', FC.sand, -4.0, 1.9, 0, 1.8, 0.7, 1.0); S.pb = bx('partition B', FC.sand, -1.9, 1.9, 0, 1.8, 0.7, 1.0);
    S.pc = bx('partition C（跨兩顆）', FC.sand, 2.2, 1.9, 0, 5.4, 0.7, 1.0);
    cap('partition 變 volume 後', '可以在同一顆 disk，也可以跨 disk');
  },
  async (tok, S) => { // 397.0 volume 記錄 directory 與 file 的 data structure
    S.ds = [bx('directory', FC.blue, 0.4, 3.0, 0, 1.6, 0.5, 0.8), bx('files', FC.orange, 2.2, 3.0, 0, 1.6, 0.5, 0.8)];
    cap('format 成 volume 後的最大差別', '會記錄 directory 和 file 的 data structure');
  },
  async (tok, S) => { // 408.1 先存 directory，再找 content
    glow(S.ds[0], HL); await wt(tok, 500); glow(S.ds[1], HL);
    S.a = lk(V3(2.2, 2.7, 0), V3(3.6, 2.3, 0), 0xc08a1f);
    cap('先從 directory 找到檔案', '再去看 file 的 content 存在哪');
  },
]);

scene('fs-23b-purpose', 'Directory 的本意：name → 唯一 ID，而且要 persistent', DCAM, [
  async (tok, S) => { // 427.6 現在大家都知道是樹狀
    S.G = graph(DSPEC.tree().nodes, DSPEC.tree().edges, 2);
    cap('現在大家都知道 directory 是樹狀', '');
  },
  async (tok, S) => { // 435.4 早期：一步步想出來
    await wt(tok, 200); fresh(DCAM[0], DCAM[1]);
    hd('早期：使用者、檔案都不多', 0, 6.8);
    cap('早期想怎麼管理 file 時', '其實是一個演進的過程');
  },
  async (tok, S) => { // 455.7 single-level directory
    const sp = DSPEC.single(); S.G = graph(sp.nodes, sp.edges, 2);
    cap('最早很單純：single-level directory', '可以說沒有資料夾');
  },
  async (tok, S) => { // 462.5 一個名字對到一個 file
    glow(S.G.M.d, HL);
    S.id = bx('#5021', FC.gray, 1.0, 1.0, 0, 1.2, 0.5, 0.6); line(1.0, 2.35, 1.0, 1.25, 0);
    cap('一個名字對到某一個 file', '');
  },
  async (tok, S) => { // 475.7 unique ID 人看不懂
    sm('unique ID（示意）：機器用，人看不懂', 1.0, 0.3);
    cap('file 真正的是 machine 的 unique ID', '人不可能記 human unreadable 的數字');
  },
  async (tok, S) => { // 488.1 目的：name → 位置的 mapping
    good('directory 的目的：name → ID 的 mapping', 0, 6.8);
    cap('建立 directory 一開始的目的', '只是把 file name 對到 unique 的 file');
  },
  async (tok, S) => { // 506.0 persistent
    S.disk = prop('disk', 5.4, 0, 0, 0.9, 'disk');
    cap('跟之前介紹的都不同：file 必須 persistent', '斷電也不能遺失');
  },
  async (tok, S) => { // 519.0 directory 資訊也要寫到硬碟
    S.a = lk(V3(1.0, 5.0, 0), V3(4.9, 1.4, 0), 0xc08a1f);
    cap('不只 file content', 'directory 的 information 也一定要寫到硬碟');
  },
  async (tok, S) => { // 541.6 運作時才 load 到 memory
    S.m = bx('memory：open-file tables', FC.pink, -4.4, 0.4, 0, 3.6, 0.5, 0.8);
    cap('運作時才 load 到 memory', '放進 system-wide / open-file table 方便 process 操作');
  },
]);

scene('fs-23b-ops', 'Directory operations：list 是 bottleneck', CAM, [
  async (tok, S) => { // 560.5 directory 的 operation 更少
    hd('directory operations', -3.6, 6.6);
    cap('directory 的 operation 更少', '');
  },
  async (tok, S) => { // 566.2 create file 也是
    bx('create file', FC.green, -5.0, 5.6, 0, 2.2, 0.5, 0.6);
    cap('create file 也算 directory operation', '要加進 directory structure，才知道它存在');
  },
  async (tok, S) => { // 578.4 delete、rename
    bx('delete', FC.red, -2.6, 5.6, 0, 1.6, 0.5, 0.6); bx('rename', FC.blue, -0.8, 5.6, 0, 1.6, 0.5, 0.6);
    cap('delete、rename 也是', '');
  },
  async (tok, S) => { // 586.6 list directory
    S.ls = bx('list (ls)', FC.orange, 1.4, 5.6, 0, 2.0, 0.5, 0.6);
    cap('容易被忽略的：list directory', '把內容秀出來');
  },
  async (tok, S) => { // 595.0 是最耗時的 bottleneck
    glow(S.ls, NG); bad('bottleneck：最耗時間', 4.2, 5.6);
    cap('在現代 file system 通常是 bottleneck', '最耗時間的 operation');
  },
  async (tok, S) => { // 610.3 folder 有 1 萬個 file
    S.wall = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) S.wall.push(cube('', FC.tan, [0.32, 0.32, 0.2], -5.4 + c * 0.42, 1.0 + r * 0.42, 0));
    sm('一個 folder：10000 個 file', -2.6, 0.5);
    cap('一個 folder 裡有 1 萬個 file', '要吃多少 memory、花多少時間從 disk 撈出來？');
  },
  async (tok, S) => { // 633.3 大系統隨便 ls 會卡很久
    S.wall.forEach((m, i) => { if (i % 3 === 0) glow(m, HL); });
    cap('tree 很深、使用者很多', '大系統隨便 ls 全部撈出來，會卡非常久');
  },
  async (tok, S) => { // 660.0 另一個 issue：怎麼找
    S.wall.forEach((m) => glow(m, null));
    S.p = ['/', 'home', 'john', 'hw1', 'a.txt'].map((t, i) => bx(t, i === 4 ? FC.orange : FC.blue, 1.8 + i * 1.0, 3.4 - i * 0.55, 0, 0.9, 0.4, 0.5));
    cap('另一個設計 issue：怎麼找', '給 path：home 下面 john、hw1、a.txt');
  },
  async (tok, S) => { // 678.6 不一定用 tree 存，也可能 hash
    for (const m of S.p) { glow(m, HL); await wt(tok, 200); }
    note('也可以用 hash 等方式存', 4.0, 0.8);
    cap('怎麼快速 traverse directory 找到位置', '不一定用 tree 存，可能用 hash');
  },
]);

scene('fs-23b-single', 'Single-level directory：名字要唯一', DCAM, [
  async (tok, S) => { // 701.0 最早只要找 mapping
    hd('目的：name → ID（不想記 ID）', 0, 6.8);
    cap('最早的設計很單純：只要 mapping', 'name 有含義，還可以 rename');
  },
  async (tok, S) => { // 719.0 single level
    const sp = DSPEC.single(); S.G = graph(sp.nodes, sp.edges, 2);
    cap('所以叫 single-level directory', '');
  },
  async (tok, S) => { // 728.4 root 下面全部都是檔名
    glow(S.G.M.r, HL);
    cap('root 下面全部都是檔案名稱', '沒有 folder，但它也是一個 directory');
  },
  async (tok, S) => { // 744.7 file name 必須 unique
    glow(S.G.M.r, null);
    cap('這種架構下 file name 必須 unique', '同一層不能有重複名字，不然怎麼 mapping？');
  },
  async (tok, S) => { // 759.7 使用者多：都叫 a.out
    S.x = cube('a.out', FC.red, [1.1, 0.5, 0.5], 1.6, 1.0, 0, 3);
    S.y = cube('a.out', FC.orange, [1.1, 0.5, 0.5], 3.0, 1.0, 0, 3);
    cap('檔案多、使用者共用一個 directory', '每個人都產生 a.out');
  },
  async (tok, S) => { // 776.5 被 override 或 already exist
    glow(S.x, NG); glow(S.y, NG); bad('already exists！', 2.3, 0.3);
    cap('就 override 掉，或無法產生', '很難維持 unique');
  },
  async (tok, S) => { // 784.8 list 效率很差
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) { glow(S.G.M[id], HL); await wt(tok, 120); }
    cap('另外 list 的 efficiency 很差', '沒有分類，只能 scan through 全部');
  },
  async (tok, S) => { // 800.0 scale 小時 OK
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) glow(S.G.M[id], null);
    note('早期規模小：OK；使用者、檔案一多：不行', 0, 6.1);
    cap('早期 scale 小時解決 mapping 沒問題', '使用者、檔案越來越多就不行');
  },
]);

scene('fs-23b-tree', 'Two-level → Tree：path、絕對與相對路徑', DCAM, [
  async (tok, S) => { // 816.4 multiple level
    hd('single 不行 → multiple level', 0, 6.8);
    cap('很直覺：single level 不行就用 multiple level', 'multiple level 指的就是 folder');
  },
  async (tok, S) => { // 830.0 user1、user2
    const sp = DSPEC.two(); S.G = graph(sp.nodes, sp.edges, 2);
    cap('directory 裡加入資料夾', '有 user1、user2 等等');
  },
  async (tok, S) => { // 836.7 list 只列自己的
    glow(S.G.M.u1, HL); ['a', 'b', 'c'].forEach((k) => glow(S.G.M[k], HL));
    cap('list 只會列自己的 file', '不會列跟我無關的人的 information');
  },
  async (tok, S) => { // 845.5 traverse：path 的概念
    ['a', 'b', 'u1'].forEach((k) => glow(S.G.M[k], null)); glow(S.G.M.r, HL);
    hot('/user1/a', -1.6, 0.6);
    cap('找檔案可以用 traverse', 'path 的概念就出來了');
  },
  async (tok, S) => { // 856.0 最後找到 name 對到的 ID
    S.id = bx('#ID', FC.gray, -1.6, 0.0, 0, 0.9, 0.4, 0.5);
    cap('最後還是要找到 name 對到哪個 ID', '這才是 directory 真正的目的');
  },
  async (tok, S) => { // 879.7 越長越大 → tree
    fresh(DCAM[0], DCAM[1]);
    const sp = DSPEC.tree(); S.G = graph(sp.nodes, sp.edges, 2);
    cap('何必固定 two level？', '變成 tree：任何 level 都可以');
  },
  async (tok, S) => { // 892.6 使用者自己 create
    S.n = cube('new', FC.green, [0.9, 0.5, 0.5], 5.6, 1.0, 0, 3); line(5.0, 2.45, 5.6, 1.25, 0);
    cap('每個使用者自己 create 資料夾', '現在的檔案系統就是這樣');
  },
  async (tok, S) => { // 900.1 absolute 與 relative path
    ['r', 'spell', 'mail', 'exp'].forEach((k) => glow(S.G.M[k], HL));
    hot('absolute：/spell/mail/exp', -3.4, 0.2);
    cap('tree 之下有絕對路徑跟相對路徑', '絕對：從 root 一路寫下來');
  },
  async (tok, S) => { // 908.1 relative：相對於目前位置
    ['r', 'spell'].forEach((k) => glow(S.G.M[k], null));
    S.cwd = hd('目前在 mail', -4.0, 3.4);
    hot('relative：exp', -1.2, 0.9);
    cap('relative：相對於目前所在的資料夾', '可以在 tree 裡切換、traverse');
  },
  async (tok, S) => { // 943.6 系統會先換成 absolute
    good('系統處理時：relative → absolute', 2.6, 0.2);
    cap('主要是方便使用', '系統多半先把 relative path 換成 absolute');
  },
]);

scene('fs-23b-acyclic', 'Acyclic-graph directory：link 共享同一份', DCAM, [
  async (tok, S) => { // 967.8 再 generalize
    const sp = DSPEC.acyclic(); sp.edges = sp.edges.filter((e) => e[2] !== 'link'); S.G = graph(sp.nodes, sp.edges, 2);
    cap('為了需求，再 generalize 一點', '');
  },
  async (tok, S) => { // 974.0 acyclic graph
    hd('Acyclic graph', 0, 6.8);
    cap('就有 acyclic graph 的概念', '');
  },
  async (tok, S) => { // 976.6 tree：每個 node 只有一個 parent
    glow(S.G.M.cnt, HL); glow(S.G.M.dict, HL);
    cap('tree 的限制：一個 node 只能有一個 parent', '');
  },
  async (tok, S) => { // 986.2 不同的人要 share 相同的檔案
    glow(S.G.M.dict, null); glow(S.G.M.spell, HL);
    cap('實際應用：希望不同人 share 相同的檔案', '');
  },
  async (tok, S) => { // 1002.3 dict/count 與 spell/count 同一個 file
    S.e = line(3.0, 3.95, 0.0, 1.25, 0, '#c08a1f'); glow(S.G.M.spell, null);
    S.r = hot('同一個 file', 1.6, 1.0);
    cap('/dict/count 和 /spell/count', '兩個名字對到同一個 file content');
  },
  async (tok, S) => { // 1017.1 可以加 edge，但不能有 cycle
    bad('不能形成 cycle', -4.4, 0.6);
    cap('稍微放鬆：可以加 edge', '但不能讓 cycle 跑出來');
  },
  async (tok, S) => { // 1031.0 Linux：ln -s
    S.c = code(['$ ln -s /dict/count /spell/count'], -2.4, 6.0);
    cap('Linux 可以自己玩：symbolic link', 'ln -s 這樣子');
  },
  async (tok, S) => { // 1044.1 hard 與 soft
    sm('hard link / soft link：刪一個名字時，檔案要不要消失？', 0, -0.2);
    cap('分 hard 和 soft', '刪掉一個名字時，內容要不要跟著消失');
  },
  async (tok, S) => { // 1076.1 multiple absolute path
    glow(S.G.M.cnt, HL);
    cap('同一個 file 有 multiple absolute path', '很多軟體因 design 需求會這樣用');
  },
  async (tok, S) => { // 1097.7 跟 copy 比：浪費空間
    S.cp = cube('count（copy）', FC.red, [1.6, 0.5, 0.5], 4.6, 1.0, 0, 3);
    bad('copy：浪費空間', 4.6, 0.3);
    cap('跟 copy file 最大差別？', 'copy 第一個浪費儲存空間');
  },
  async (tok, S) => { // 1106.1 duplication → consistency
    glow(S.cp, NG);
    cap('第二：duplication 要維持 consistency', '非常討厭');
  },
  async (tok, S) => { // 1120.1 一份，兩邊都看得到
    gone(S.cp); glow(S.G.M.cnt, OKG);
    good('改一邊，另一邊立刻看到', 2.4, 0.3);
    cap('symbolic 的方式：兩個資料夾都看得到', '其實 exactly 是同一份');
  },
]);

scene('fs-23b-dangle', 'Dangling pointer 與 reference counter', DCAM, [
  async (tok, S) => { // 1139.3 一份資料、兩個名字
    const sp = DSPEC.acyclic(); S.G = graph(sp.nodes, sp.edges, 0);
    cap('資料只有一份，但有兩個名字', '就像 programming 的 pointer');
  },
  async (tok, S) => { // 1154.1 砍掉之後：dangling pointer
    S.G.E.filter((e) => e.a === 'dict' && e.b === 'cnt').forEach((e) => kill(e.l));
    kill(S.G.M.cnt); S.gh = cube('?', FC.red, [0.9, 0.5, 0.5], 0, 1.0, 0); glow(S.gh, NG);
    cap('從一邊把檔案真的砍掉', '另一個名字變成 dangling pointer');
  },
  async (tok, S) => { // 1165.7 access 時 file not found
    bad('/spell/count → error！', 3.2, 0.4);
    cap('名字還在，access 時卻發現內容不見', '這不只是 not found，是 fail');
  },
  async (tok, S) => { // 1189.5 為什麼先談 acyclic：好解決
    fresh(DCAM[0], DCAM[1]);
    const sp = DSPEC.acyclic(); S.G = graph(sp.nodes, sp.edges, 0);
    cap('為什麼先只談 acyclic graph？', '沒有 cycle，比較容易解決 dangling');
  },
  async (tok, S) => { // 1198.3 用 counter
    S.ref = hot('ref = 0', 1.4, 1.0);
    cap('用 counter 就可以 detect', '');
  },
  async (tok, S) => { // 1201.1 一個名字 1，兩個 2
    txt(S.ref, 'ref = 1'); await wt(tok, 500); txt(S.ref, 'ref = 2');
    cap('一個名字指到它 → counter 1', '兩個 → 2');
  },
  async (tok, S) => { // 1209.6 變 0 才 remove
    S.G.E.filter((e) => e.b === 'cnt').forEach((e) => kill(e.l)); txt(S.ref, 'ref = 0 → remove');
    await wt(tok, 300); kill(S.G.M.cnt);
    cap('直到變 0 才從 storage 上真的刪掉', '不是 0 代表還有人指到，要 keep');
  },
]);

// ════════ 0vYydtG1Xi4（第 23C 講：Directory Structure & File System）— built-in scenes 的 cued 版 ════════
scene('fs-23c-access', '三種 access method 的例子（MATLAB A(3,3)）', [[0, 8.5, 9.5], [0, 0, 0.2]], [
  async (tok, S) => { // 14.1 sequential：fread / fwrite
    tag('Sequential', 'ptr', -6, 0.3, -2.6);
    S.tape = []; for (let i = 0; i < 10; i++) S.tape.push(cube('', C.file, [0.6, 0.3, 0.7], -4.6 + i * 0.75, 0.15, -2.6));
    S.cur = tag('▼', 'ptr alt', -4.6, 0.9, -2.6);
    await anim(tok, 1500, (u) => { const i = Math.min(9, Math.floor(u * 10)); S.cur.position.x = -4.6 + i * 0.75; S.tape.forEach((m, k) => glow(m, k <= i ? HL : null)); });
    cap('剛才的例子：sequential', 'C 的 fread、fwrite');
  },
  async (tok, S) => { // 17.2 index：database
    S.tape.forEach((m) => glow(m, null));
    tag('Index', 'ptr', 3, 0.3, 3.1); S.db = sm('像 database', 4.6, 0.3, 3.1);
    cap('index 的 random access', '就像 database');
  },
  async (tok, S) => { // 20.2 direct 的例子？
    tag('Direct', 'ptr', -4.4, 0.3, 3.1);
    cap('那 direct access 的例子呢？', '比較高階的語言會提供');
  },
  async (tok, S) => { // 45.4 MATLAB load 一個 file
    S.g = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S.g.push(cube((r + 1) + ',' + (c + 1), C.fat, [0.85, 0.3, 0.7], -5.4 + c * 1, 0.15, 0 + r * 0.85));
    cap('MATLAB：load 一個 file', '行當作 row，用逗號分 column');
  },
  async (tok, S) => { // 57.1 我要 A(3,3)
    glow(S.g[8], HL); S.g[8].position.y = 0.6;
    cap('請告訴我 A(3,3) 的 data', '直接給第 3 列第 3 行');
  },
  async (tok, S) => { // 76.4 這就是 direct access
    sm('不用 index，也不用名字：就是位置', -4.4, 0.3, 3.6);
    cap('這就是 direct access 的例子', '座標就是位置');
  },
  async (tok, S) => { // 84.4 哪個好？看 application
    S.q = bub('哪個好？看 application 的行為', 0, 1.8, -1.0);
    cap('哪一個好哪個不好？', '看使用者、application 的需求');
  },
  async (tok, S) => { // 94.8 看 argument：沒給 position → sequential
    remove(S.q); S.c = code(['read(fp, n)        → sequential'], 1.6, 1.6, 0.42, -0.6);
    cap('看 API 的 argument 就分得出來', '沒有給 position：一定是 sequential');
  },
  async (tok, S) => { // 103.6 給 position → direct
    S.c.kill(); S.c = code(['read(fp, n)        → sequential', 'read(A, 3, 3)      → direct'], 1.6, 1.8, 0.42, -0.6);
    cap('給 position 資訊（像 A(3,3)）', '就是 direct access');
  },
  async (tok, S) => { // 114.1 給名字 → index
    S.c.kill(); S.c = code(['read(fp, n)        → sequential', 'read(A, 3, 3)      → direct', 'find("John")       → index'], 1.6, 2.0, 0.42, -0.6);
    S.key = cube('John', C.idx, [1.1, 0.4, 0.7], 1.4, 0.2, 2.0); glow(S.key, HL);
    cap('直接給名字（自己取的 key）', '用它 refer 到資料：index access');
  },
  async (tok, S) => { // 128.5 實作：mapping，pattern 會亂掉
    cap('實作上：database、FS、language 各自做 mapping', '而且 access pattern 到 device 上會亂掉');
  },
  async (tok, S) => { // 153.1 sequential 串在一起；index 建 data structure
    S.tape.forEach((m) => glow(m, OKG));
    sm('sequential：盡量串在一起放', -1.2, 0.3, -1.8); sm('index：建 data structure 快速搜尋位置', 3.6, 0.3, 2.6);
    cap('sequential：資料盡量放在一起', 'index：建 data structure 減少多餘 I/O');
  },
]);

scene('fs-23c-gengraph', 'General graph 的 cycle 與 garbage collection', [[0, 4.2, 13], [0, 3.3, 0]], [
  async (tok, S) => { // 180.3 single、two-level、tree
    ['single', 'two-level', 'tree'].forEach((t, i) => sm(t, -4 + i * 2.2, 6.8));
    cap('directory：single level、two level、tree', '');
  },
  async (tok, S) => { // 187.6 最 general：任意加 edge
    S.Sp = DSPEC.general(); S.G = graph(S.Sp.nodes, S.Sp.edges.filter((e) => e[2] !== 'cyc'), 2);
    hot('General graph', 3.6, 6.8);
    cap('最 general 就是 general graph', '任何位置、任何方向都可以加 edge');
  },
  async (tok, S) => { // 203.7 會有 cycle
    const n = S.Sp.nodes; S.cyc = seg(V3(n.t1.x + 0.3, n.t1.y + 0.25, 0.2), V3(n.g2.x + 0.3, n.g2.y - 0.25, 0.2), '#d64545');
    S.rG2 = tag('ref = 2', 'ptr alt', -0.2, 2.7); S.rT1 = tag('ref = 1', 'ptr alt', -0.2, 0.9);
    cap('跟 acyclic 最大差別：可能有 cycle', 'g2 ↔ t1 繞成一圈');
  },
  async (tok, S) => { // 212.0 dangling pointer 的問題
    cap('有 cycle 之後最大的 issue', '怎麼解決 dangling pointer：就像 pointer 的問題');
  },
  async (tok, S) => { // 240.7 刪掉 bin → g2
    const ei = S.G.E.findIndex((e) => e.a === 'bin' && e.b === 'g2'); kill(S.G.E[ei].l); txt(S.rG2, 'ref = 1');
    cap('例子：把 bin → g2 這個 link 拿掉', '');
  },
  async (tok, S) => { // 248.6 剩下的走不到，應該刪
    glow(S.G.M.g2, NG); glow(S.G.M.t1, NG);
    cap('剩下的 g2、t1 根本不可能被 access 到', '其實也應該 delete');
  },
  async (tok, S) => { // 259.3 只用 counter 不行
    bad('互相 reference：counter 都不是 0', -4.4, 0.6);
    cap('只用 counter 沒辦法', 'g2、t1 互相 reference，count 值還是 1');
  },
  async (tok, S) => { // 272.3 cycle detection
    cap('第一種：做 cycle detection', '看看是不是有 cycle');
  },
  async (tok, S) => { // 280.1 garbage collection：從 root label
    glow(S.G.M.g2, null); glow(S.G.M.t1, null);
    for (const id of ['r', 'bin', 'usr', 'ls', 'doc']) { glow(S.G.M[id], OKG); await wt(tok, 300); }
    cap('最常見：garbage collection', 'periodically 從 root 一路 label：reachable');
  },
  async (tok, S) => { // 293.4 沒被 label 的 → delete（兩個 pass）
    glow(S.G.M.g2, NG); glow(S.G.M.t1, NG); await wt(tok, 500);
    fly(S.G.M.g2); fly(S.G.M.t1); kill(S.cyc); remove(S.rG2); remove(S.rT1);
    S.G.E.filter((e) => e.a === 'g2').forEach((e) => kill(e.l));
    cap('沒被 label 的 = unreachable → delete', '兩個 pass：不管有沒有 cycle');
  },
  async (tok, S) => { // 312.3 overhead 大
    bad('使用者、檔案數量驚人：週期性 GC 太貴', 0, 0.2);
    cap('這些 overhead 都比較大', 'file system 的使用者、檔案數量非常驚人');
  },
  async (tok, S) => { // 328.0 很多 FS 不 support：會造成 cycle 的 link 擋掉
    note('加 link 會 create cycle → invalid', 0, 6.0);
    cap('所以很多 file system 不支援 general graph', '加會造成 cycle 的 link 就擋掉');
  },
  async (tok, S) => { // 360.0 directory 就是在處理 mapping
    good('directory = name → file ID 的 mapping', 0, -0.4);
    cap('這就是 directory', '處理 mapping，找到 file 真正的 ID');
  },
]);

scene('fs-23c-mount', 'Mounting：mount point、時機與 recursive mount', [[0, 4.2, 13], [0, 3.2, 0]], [
  async (tok, S) => { // 373.3 mounting 與 sharing
    hd('Mounting', -2.4, 7.0); sm('Sharing（下一段）', 0.8, 7.0);
    cap('接著：mounting 與 sharing', '使用檔案時常做的動作');
  },
  async (tok, S) => { // 389.4 要用一個儲存空間，先 mount
    S.dev = prop('disk', 5.4, 0, 0, 0.9, 'device');
    cap('要使用一個儲存空間，第一件事是 mount', '讓系統可以 access 那個 device 上的資料');
  },
  async (tok, S) => { // 412.6 透過 file system 的 directory structure
    S.N = { r: { name: '/', x: 0, y: 6, kind: 'dir' }, local: { name: 'local', x: -4, y: 4.3, kind: 'dir' }, usr: { name: 'usr', x: 0, y: 4.3, kind: 'dir' }, home: { name: 'home', x: 4, y: 4.3, kind: 'dir' } };
    S.G = graph(S.N, [['r', 'local'], ['r', 'usr'], ['r', 'home']], 2);
    cap('使用者、程式要 access file', '都要透過 file system 的 directory structure');
  },
  async (tok, S) => { // 432.4 決定 mount point
    S.q = hot('掛在哪？', 0, 5.0);
    cap('mount 時第一件事', '決定 mount point：掛在 tree 的哪裡');
  },
  async (tok, S) => { // 455.2 掛上去的節點 = mount point
    remove(S.q); glow(S.G.M.usr, HL);
    cap('tree 有 root，從絕對路徑知道位置', '掛上去的那個節點就是 mount point');
  },
  async (tok, S) => { // 471.7 ① boot time
    S.w1 = note('① boot time', -5.0, 1.0);
    cap('mount 有三種時機：第一 boot time', '一開機就 mount 好，例如系統槽');
  },
  async (tok, S) => { // 480.2 OS 也存在檔案系統裡
    cap('OS 本身也存在檔案系統裡', '不先 mount 就沒辦法把 OS load 進 memory');
  },
  async (tok, S) => { // 504.4 ② run time 自動 mount
    note('② run time 自動 mount', -5.0, 0.4);
    cap('第二：run time 自動 mount', '一插上去就自動找、自動 mount 好');
  },
  async (tok, S) => { // 530.3 ③ manually
    note('③ manually', -5.0, -0.2);
    cap('最後：手動 mount', '特殊 device、找不到 driver 時');
  },
  async (tok, S) => { // 554.4 例子：usr、home 還沒有東西
    glow(S.G.M.usr, null);
    cap('例子：原本只有 local 有些檔案', 'usr、home 都還沒有東西');
  },
  async (tok, S) => { // 568.0 第二個 volume 掛在 usr 下
    const V = { a: { name: 'bin', x: -1.4, y: 2.5, kind: 'vol' }, b: { name: 'lib', x: 1.4, y: 2.5, kind: 'vol' } };
    graph(V, [], 4); seg(V3(0, 4.05), V3(-1.4, 2.75), '#31aab0'); seg(V3(0, 4.05), V3(1.4, 2.75), '#31aab0');
    tag('volume 2', 'ptr alt', -2.9, 2.5); glow(S.G.M.usr, HL);
    cap('把第二個 volume mount 進來，掛在 usr 下', 'usr 就是 mount point（不同顏色＝不同 FS）');
  },
  async (tok, S) => { // 591.0 recursive
    graph({ john: { name: 'john', x: 4, y: 2.5, kind: 'dir' } }, [], 2); seg(V3(4, 4.05), V3(4, 2.75));
    cap('甚至可以 recursive', '被 mount 的 volume 下面再掛別的，一直下去');
  },
  async (tok, S) => { // 604.7 Windows：只能 C:、D:、E:
    S.w = ['C:', 'D:', 'E:'].map((n, i) => cube(n, C.vol, [0.9, 0.5, 0.5], -5.2 + i * 1.1, 2.4, 0, 3));
    cap('Windows 比較感覺不到', '掛進來就是 C 槽、D 槽、E 槽：只能掛在 root');
  },
  async (tok, S) => { // 631.1 Linux / Mac：任何存在的資料夾
    graph({ g: { name: 'games', x: 4, y: 0.8, kind: 'vol', color: C.fat } }, [], 4); seg(V3(4, 2.25), V3(4, 1.05), '#9b7ef4');
    tag('volume 3', 'ptr alt', 5.6, 0.8);
    cap('Linux、Mac 可以自己選掛哪', '只要資料夾存在，例如掛在 john 下面');
  },
  async (tok, S) => { // 654.0 不同 partition，任意延展 tree
    good('每個 partition 都能掛上去，tree 任意延展', 0, -0.4);
    cap('這些可以是不同的 partition', '可以任意延展這個 tree structure');
  },
]);

scene('fs-23c-mtable', 'Mount table：跨 partition 找 /usr/hw.c', [[0, 4.2, 13], [0, 3, 0]], [
  async (tok, S) => { // 674.4 meta data 上發生什麼事
    S.N = { r: { name: '/', x: -3, y: 6, kind: 'dir' }, usr: { name: 'usr', x: -5, y: 4.3, kind: 'dir' }, bin: { name: 'bin', x: -3, y: 4.3, kind: 'dir' }, mnt: { name: 'mnt', x: -1, y: 4.3, kind: 'dir' } };
    S.G = graph(S.N, [['r', 'usr'], ['r', 'bin'], ['r', 'mnt']], 2);
    tag('P1（系統槽）', 'ptr', -3, 6.8);
    cap('mount point 在 metadata 上發生什麼事？', '');
  },
  async (tok, S) => { // 691.5 OS 維護 mount table
    S.mt = code(['mount table', 'usr → P2  port 1, SATA', 'mnt → P3  USB'], -3, 1.8, 0.45);
    cap('mount 一個 partition 或 volume 時', 'OS 會 maintain 一張 mount table');
  },
  async (tok, S) => { // 714.5 root 下三個 folder，usr、mnt 是掛進來的
    S.P2 = { r2: { name: 'root (= usr)', x: 3.5, y: 4.3, kind: 'vol' }, a: { name: 'john', x: 2.2, y: 2.6, kind: 'vol' }, b: { name: 'hw.c', x: 4.8, y: 2.6, kind: 'vol', color: C.fil } };
    S.G2 = graph(S.P2, [['r2', 'a'], ['r2', 'b']], 2); tag('P2', 'ptr', 3.5, 5.1);
    cap('root 下三個 folder：usr、mnt 不屬於 P1', '它們來自獨立的 partition P2、P3');
  },
  async (tok, S) => { // 749.3 寫一個 m 標記就好
    relabel(S.G.M.usr, 'usr  m'); relabel(S.G.M.mnt, 'mnt  m');
    cap('directory 裡只要寫一個 m', 'mark 起來就對了');
  },
  async (tok, S) => { // 753.3 從 root 開始 traverse
    glow(S.G.M.r, HL);
    cap('找 /usr/hw.c：一樣從 root 開始', '你的 system drive');
  },
  async (tok, S) => { // 762.8 usr 是 mount → 看 mount table
    glow(S.G.M.r, null); glow(S.G.M.usr, HL); S.mt.hl(1);
    cap('usr 標了 m：去看 mount table', '它對到哪一個 physical device？');
  },
  async (tok, S) => { // 769.0 port、protocol
    cap('mount table 存著 information', '接在哪個 port、用什麼 protocol');
  },
  async (tok, S) => { // 777.2 access 另一個 partition：root 就是 usr
    glow(S.G.M.usr, null); glow(S.G2.M.r2, HL);
    cap('透過它 access 另一個 partition', 'P2 從它的 root 開始：root 就相當於 usr');
  },
  async (tok, S) => { // 790.6 繼續 traverse，找到檔案
    glow(S.G2.M.r2, null); glow(S.G2.M.b, HL);
    cap('繼續 traverse，找到 hw.c', '');
  },
  async (tok, S) => { // 797.0 讀出內容
    S.d = cube('content', C.free, [1.4, 0.4, 0.6], 4.8, 1.2, 0, 2);
    cap('找到檔名後，content 依序存在後面', '就可以把資料讀出來');
  },
  async (tok, S) => { // 805.0 總結
    good('directory 上的 m + mount table + partition table', 1.0, 0.2);
    cap('有 mount table、directory 裡 mark 起來', 'partition table 存 access 需要的資訊');
  },
]);

scene('fs-23c-share', 'Sharing：user ID、group ID 與 owner / group / others', [[0, 6.5, 10.5], [0, 0.6, 0]], [
  async (tok, S) => { // 832.5 sharing 很重要
    S.f = cube('hw.c', C.fil, [1.4, 0.6, 1], 0, 0.3, 0.6, 3);
    cap('另一個重要的：sharing', '檔案系統在 multiple user 時最需要');
  },
  async (tok, S) => { // 853.7 permission 很重要
    S.b = bad('作業被別人看到或 override？', 0, 1.6, 0.6);
    cap('permission 非常重要', '作業被大家隨便看到、不小心被 override，問題很大');
  },
  async (tok, S) => { // 878.0 現在的做法
    remove(S.b);
    cap('演進下來，現在大家的做法', '');
  },
  async (tok, S) => { // 888.8 identify 使用者：user ID
    const users = [['alice', 'uid 1001'], ['bob', 'uid 1002'], ['carol', 'uid 1003'], ['dave', 'uid 1004']];
    S.U = users.map(([n, id], i) => { const m = cube(n, C.file, [1.3, 0.5, 0.8], -4.5 + i * 3, 0.25, -2.6, 2); tag(id, 'idx', -4.5 + i * 3, 0, -1.7); return m; });
    cap('第一：要能 identify 使用者', '每個人有 unique 的 user ID（名字為示意）');
  },
  async (tok, S) => { // 895.0 group ID
    S.grp = tag('group ID', 'ptr alt', 0, 1.3, -2.6);
    cap('另外還有 group ID', '同一些使用者有相同需求、share 相同 file');
  },
  async (tok, S) => { // 912.4 default group 就是自己
    cap('by default 的 group 就是你自己', '只有你在下面，所以沒感覺');
  },
  async (tok, S) => { // 930.3 管理者建 students
    txt(S.grp, 'group: students'); tint(S.U[1], C.free); tint(S.U[2], C.free);
    cap('系統管理時可以 create 一個 group：students', '把學生放進去，只能 access 某些檔案');
  },
  async (tok, S) => { // 942.7 file 這邊：分成三種 level
    tag('owner = alice，group = students', 'ptr', 0, 0.2, 1.7);
    S.bins = [['owner', -4.5], ['group', 0], ['others', 4.5]].map(([n, x]) => { ctx.tile(V3(x, 0.04, 3.4), 3, 1.6, '#e9dcc4'); return tag(n, 'ptr', x, 0.2, 4.4); });
    cap('file 這邊：分成三種 level', '');
  },
  async (tok, S) => { // 958.7 owner：只有一個
    move(S.U[0], -4.5, 0.25, 3.4);
    cap('第一個是 owner', '一個 file 只會有一個 owner');
  },
  async (tok, S) => { // 971.5 group
    move(S.U[1], -0.7, 0.25, 3.4); await wt(tok, 300); move(S.U[2], 0.7, 0.25, 3.4);
    cap('第二：不是 owner，但屬於 file 的 group', '例如 owner 可讀寫執行，group 只能讀');
  },
  async (tok, S) => { // 1001.7 others
    move(S.U[3], 4.5, 0.25, 3.4);
    cap('最後：其他 case 全丟到 others', '');
  },
  async (tok, S) => { // 1014.3 一定落在某一個
    cap('任何使用者操作這個 file', '一定落在某一個 level，照那個 level 的權限');
  },
  async (tok, S) => { // 1039.6 group 裡的人權限都相同
    note('同一個 group 的人：權限都一樣', 0, 2.0, 3.4);
    cap('對 file 而言只有一個 owner、一個 group', 'group 裡每個人權限相同，不能再細分');
  },
]);

scene('fs-23c-acl', 'ACL 簡化成 rwx × 3、ls -l、chmod 644', [[0, 6, 11], [0, 1.2, 0]], [
  async (tok, S) => { // 1072.6 permission 是什麼：r、w、x
    S.p = ['read', 'write', 'execute'].map((t, i) => bx(t, C.free, -3 + i * 3, 3.6, -1, 2.2, 0.5, 0.6));
    cap('permission 指的是什麼？', '就是 read、write、execute 三種');
  },
  async (tok, S) => { // 1095.8 每個 level 對到 privilege；只有 owner / root 能改
    sm('只有 owner 或 root 能改權限', 0, 4.4, -1);
    cap('每個 level 對到不同的 privilege', '只有 owner 或 root 能修改；其他人只能 follow');
  },
  async (tok, S) => { // 1135.5 access control 問題
    S.p.forEach((m) => fly(m));
    cap('權限怎麼描述？', '這叫 access control 的問題');
  },
  async (tok, S) => { // 1162.2 control list
    hd('Access-Control List（ACL）', -4, 5.2);
    cap('演變到現在：用一個 control list', '控制每個使用者對 file 有什麼權限');
  },
  async (tok, S) => { // 1175.1 最單純：one to one
    S.rows = [];
    for (let i = 0; i < 12; i++) { S.rows.push(cube('user' + (i + 1) + '：' + ['rw', 'r', 'rwx', '—'][i % 4], C.other, [2.6, 0.3, 0.45], -4, 0.15 + i * 0.32, -1, 2)); await wt(tok, 60); }
    cap('最單純：每個檔案一張 list', 'list 上列每個使用者的權限（one to one）');
  },
  async (tok, S) => { // 1188.5 使用者一多：不可行
    S.rows.forEach((m) => glow(m, NG));
    cap('使用者隨時增加：list 又長又要一直改', '還要 load 到 memory 才能判斷：不可行');
  },
  async (tok, S) => { // 1217.3 三個 class
    S.rows.forEach((r) => fly(r));
    ['owner', 'group', 'others'].forEach((g, gi) => tag(g, 'ptr', -4 + gi * 4, 0.1, 1.6));
    cap('現在的做法：三個 class', 'owner、group、others');
  },
  async (tok, S) => { // 1229.6 r、w、x
    S.M = [];
    ['owner', 'group', 'others'].forEach((g, gi) => [0, 1, 2].forEach((k) => S.M.push(cube('rwx'[k], GRAY, [1, 0.3, 1], -5.1 + gi * 4 + k * 1.1, 0.15, 0))));
    cap('privilege 也限制成三個動作', 'r = read、w = write、x = execute');
  },
  async (tok, S) => { // 1255.0 每個 class 3 個 bit
    note('每個 class 3 bits × 3 = 9 bits', 0, 4.2);
    cap('很長的 list 簡化成每個 class 3 個 bit', '乘三倍而已：儲存空間很少');
  },
  async (tok, S) => { // 1272.6 owner 111
    const set = (gi, bits) => bits.forEach((b, k) => { const m = S.M[gi * 3 + k]; tint(m, b ? C.free : GRAY); m.scale.y = b ? 2.6 : 1; m.position.y = b ? 0.4 : 0.15; });
    S.set = set; set(0, [1, 1, 1]); tag('111', 'ptr alt', -4, 1.6, 0);
    cap('owner 是 111', '三個權利都有；0 就代表沒有那個權利');
  },
  async (tok, S) => { // 1289.5 group 110、others 100
    S.set(1, [1, 1, 0]); tag('110', 'ptr alt', 0, 1.6, 0); S.set(2, [1, 0, 0]); tag('100', 'ptr alt', 4, 1.6, 0);
    cap('group 110：可以讀寫、不能執行', 'others 100：只能 read');
  },
  async (tok, S) => { // 1299.4 owner / root 改這幾個 bit
    cap('file 的 owner 或 root', '透過修改這幾個 bit 控制 access control');
  },
  async (tok, S) => { // 1327.7 ls -l
    S.ls = tag('$ ls -l   -rw-rw-r--  alice  staff  hw.c', '', 0, 0.2, -2.6); Object.assign(S.ls.element.style, MONO);
    cap('工作站上打 ls -l', '前面那串奇怪的符號就是 access control list');
  },
  async (tok, S) => { // 1348.3 第一個字元：directory 還是 file；後面 9 個
    cap('第一個字元：是 directory 還是 file', '接下來 9 個 = owner、group、others 各 3 個');
  },
  async (tok, S) => { // 1373.1 例子：rw- rw- r--
    S.set(0, [1, 1, 0]); S.set(1, [1, 1, 0]); S.set(2, [1, 0, 0]);
    cap('這是 file：owner rw-、group（staff）rw-', 'others 只有 r--');
  },
  async (tok, S) => { // 1421.0 folder 的 x：能不能 traverse
    S.dir = tag('目錄的 x = 能不能 traverse 進去', 'ptr alt', 0, 0.2, 2.6);
    cap('對 folder 而言 execute 的意思', '能不能 traverse 進去看裡面有什麼');
  },
  async (tok, S) => { // 1433.2 permission denied：檢查路徑上每個 parent
    bad('Permission denied？檢查路徑上每層 parent 的 x', 0, 0.2, 3.4);
    cap('遇到 access permission denied', '看路徑上每個 parent folder 有沒有 x');
  },
  async (tok, S) => { // 1464.7 group：students 只讀
    cap('不同 group 之間也好控制', '例如 students 只能 read，只有 owner 能 write');
  },
  async (tok, S) => { // 1495.2 chmod 644
    txt(S.ls, '$ chmod 644 hw.c   →   -rw-r--r--');
    S.set(0, [1, 1, 0]); S.set(1, [1, 0, 0]); S.set(2, [1, 0, 0]);
    cap('修改指令：chmod，例如 chmod 644', '6 = 110 = rw-，4 = 100 = r--');
  },
]);

scene('fs-23c-protect', 'Protection：damage 與 security', [[0, 6, 11], [0, 1, 0]], [
  async (tok, S) => { // 1524.3 protection 兩個層面
    tag('damage：資料不能遺失', 'ptr', -3.6, 0.2, 2.4); tag('security：不能被偷', 'ptr', 3.6, 0.2, 2.4);
    cap('protection 很重要：兩個層面', '');
  },
  async (tok, S) => { // 1550.0 ACL 也是 protection
    sm('ACL：誰能做什麼 → 也是 protection', 0, 0.2, 3.2);
    cap('剛才介紹的 ACL', '也是 part of protection 的機制');
  },
  async (tok, S) => { // 1560.5 damage：file 絕對不能遺失
    S.d1 = cube('disk 1', C.file, [1.6, 1.2, 1.2], -4.6, 0.6, 0); S.data = cube('data', C.fil, [0.8, 0.4, 0.6], -4.6, 1.5, 0, 2);
    cap('第一：damage', 'file 絕對不能遺失');
  },
  async (tok, S) => { // 1572.6 RAID：用很多硬碟
    S.d2 = cube('disk 2', C.file, [1.6, 1.2, 1.2], -2.6, 0.6, 0); S.copy = cube('data', C.fil, [0.8, 0.4, 0.6], -2.6, 1.5, 0, 2);
    cap('storage system 章節會介紹 RAID', '用很多顆硬碟');
  },
  async (tok, S) => { // 1581.1 一顆壞了從另一顆讀
    fly(S.d1); fly(S.data); glow(S.copy, OKG);
    cap('資料 copy 在很多硬碟：一顆壞了還能讀', '增加 reliability（可靠度）');
  },
  async (tok, S) => { // 1600.6 security / privacy
    cap('另一個麻煩的：privacy、security', '確保資料不會被別人偷走（資安是獨立大領域）');
  },
  async (tok, S) => { // 1620.7 最基本：password
    S.pc = cube('login', C.fat, [1.4, 0.8, 1], 1.6, 0.4, 0); S.pk = cube('pw', C.idx, [0.6, 0.4, 0.5], 1.6, 1.2, 0);
    cap('單一系統最基本：password', '登入進來就是合法使用者');
  },
  async (tok, S) => { // 1633.6 知道 ID → 查 ACL
    S.acl = sm('ID → 查 ACL', 1.6, 0.2, 1.0);
    cap('知道你的 ID 之後', '透過 ACL 判斷什麼能做、什麼不能做');
  },
  async (tok, S) => { // 1654.2 現在不用 login 也能侵入
    bad('不 login 也能透過程式侵入', 4.4, 2.6);
    cap('現在 password 很容易被繞過', '可以透過 web 程式等各種方式侵入');
  },
  async (tok, S) => { // 1674.6 有網路：封包被監聽 → 加密
    S.sv = cube('server', C.fat, [1.4, 0.8, 1], 5.6, 0.4, 0);
    await slide(tok, S.pk, 3.6, 1.2, 0, 700);
    S.th = cube('監聽', C.bad, [1, 0.6, 0.8], 3.6, 0.3, 1.8, 2);
    cap('有網路後：password 傳到 remote 電腦', '封包可能被監聽偷走 → 要加密等等');
  },
  async (tok, S) => { // 1705.0 RAID 之後講；總結
    good('使用者角度：sharing、mounting、protection', 0, 3.6);
    cap('資料不遺失：之後介紹 RAID', '這就是使用者角度的 file system overview');
  },
]);

// ════════ TA7728hp_IA（第 23D 講：File System Implementation） ════════
scene('fs-23d-intro', 'File system 實作：disk allocation 是核心', CAM, [
  async (tok, S) => { // 14.8 進到 file system 內部
    S.fs = bx('file system（內部）', FC.blue, 0, 5.8, 0, 3.6, 0.6, 0.8);
    cap('第二部分：file system 的內部', '不管使用者了：structure 與管理方式');
  },
  async (tok, S) => { // 43.3 disk allocation method
    hot('最重要：disk allocation method', 0, 6.8);
    cap('最需要知道的：disk allocation method', '');
  },
  async (tok, S) => { // 48.3 OS 管資源：storage
    S.d = prop('disk', 3.6, 0, 0, 1.2, 'disk 空間');
    cap('OS 在管理各種資源', 'file system 管的是儲存資源：disk 空間');
  },
  async (tok, S) => { // 64.2 一個 1GB 的檔案放哪？
    S.f = bx('1 GB 檔案', FC.orange, -4.0, 2.2, 0, 3.0, 0.8, 0.9);
    cap('一個 1 GB 的檔案', '要擺到硬碟的哪些位置？');
  },
  async (tok, S) => { // 72.1 一次連續放？
    S.q1 = bub('一次連續放？', -4.0, 3.4);
    cap('要一次連續放嗎？', '');
  },
  async (tok, S) => { // 76.4 切割之後放哪？
    kill(S.f); S.parts = [0, 1, 2, 3].map((i) => bx('¼', FC.orange, -5.4 + i * 0.95, 2.2, 0, 0.8, 0.8, 0.9));
    remove(S.q1); bub('切開的話，各放哪裡？怎麼記？', -4.0, 3.4);
    cap('切割的話', '又怎麼知道被切到哪些地方？');
  },
  async (tok, S) => { // 81.4 這就是 disk allocation
    for (let i = 0; i < 4; i++) slide(tok, S.parts[i], 2.0 + (i % 2) * 2.6, 1.6 + Math.floor(i / 2) * 0.9, 0, 700);
    await wt(tok, 800);
    cap('這就是 disk allocation', '把檔案 map 到 physical device 的位置');
  },
  async (tok, S) => { // 89.7 最後一個作業
    note('作業：implement 這一塊', 0, 4.6);
    cap('也是最後一個作業要改寫的部分', '');
  },
]);

scene('fs-23d-block', 'Block 與 sector：FS 只碰得到 block', CAM, [
  async (tok, S) => { // 114.1 file system 在做 mapping
    S.f = prop('file', -5.4, 3.6, 0, 1.0, 'file');
    S.a = lk(V3(-4.6, 4.2, 0), V3(-0.8, 4.2, 0), 0xc08a1f);
    cap('file system 最主要在做 mapping', '把資料放到 physical storage device 上');
  },
  async (tok, S) => { // 130.7 主流還是 hard drive
    S.d = prop('disk', 4.6, 2.6, 0, 1.1, 'hard drive');
    cap('這裡講的是 disk', '現在主流還是 hard drive');
  },
  async (tok, S) => { // 141.4 有一個最小的單位
    cap('對下層讀寫時有一個最小單位', '軟體這邊再怎麼 manage 也一樣');
  },
  async (tok, S) => { // 155.6 block
    S.blk = [0, 1, 2].map((i) => bx('block ' + i, FC.blue, -2.6 + i * 2.6, 3.8, 0, 2.4, 0.7, 0.9));
    cap('這個單位叫 block（data block）', 'file system 的最小單位');
  },
  async (tok, S) => { // 168.4 physical 的單位是 sector
    S.sec = []; for (let i = 0; i < 12; i++) S.sec.push(bx('', FC.tan, -3.5 + i * 0.6 + 0.0, 1.8, 0, 0.55, 0.5, 0.8));
    sm('sector', -4.4, 1.8);
    cap('physical 這邊：hard drive 最小的是 sector', '');
  },
  async (tok, S) => { // 175.6 不一定對在一起
    cap('sector 跟 block 不一定一樣大', '可能剛好一樣，也可能是倍數');
  },
  async (tok, S) => { // 187.8 一個 block 可能由多個 sector 組成
    for (let i = 0; i < 4; i++) glow(S.sec[i], HL);
    S.br = lk(V3(-2.6, 3.4, 0), V3(-2.6, 2.1, 0), 0xc08a1f);
    cap('一個 block 可能由多個 sector 組成', '');
  },
  async (tok, S) => { // 192.3 sector 通常 512 bytes
    sm('sector：通常 512 bytes', -1.9, 1.1);
    cap('一個 sector 通常是 512 bytes', '');
  },
  async (tok, S) => { // 194.5 block 1KB 甚至 4KB
    sm('block：1KB，甚至 4KB', 0, 4.6);
    cap('block 可能是 1KB，甚至 4KB', '（4KB = 8 個 512B sector）');
  },
  async (tok, S) => { // 200.4 不可能小於 sector
    bad('block 不可能小於 sector', 3.6, 1.0);
    cap('但不可能小於 sector', 'sector 是 physically 最小的單位');
  },
  async (tok, S) => { // 212.5 FS 只碰 block
    good('file system 只碰得到 block；block → sector 下面再轉', 0, 0.2);
    cap('這章只談 block', 'block 對到 sector 還有一層轉換，不一定一對一');
  },
]);

scene('fs-23d-multi', '一個 OS 可以有很多種 file system', CAM, [
  async (tok, S) => { // 230.9 一個 OS 不一定只有一個 FS
    S.os = bx('作業系統', FC.gray, 0, 6.0, 0, 3.0, 0.6, 0.8);
    cap('一個作業系統不一定只能有一個 file system', '');
  },
  async (tok, S) => { // 248.3 不同 volume 可以 format 成不同 FS
    S.v = [['C:', 'NTFS', FC.blue], ['D:', 'FAT32', FC.orange], ['E:', '（Mac 的 FS）', FC.purple]].map(([n, f, c], i) => [bx(n, c, -4 + i * 4, 3.6, 0, 2.6, 0.8, 1.0), sm(f, -4 + i * 4, 2.8)]);
    cap('不同 volume（C 槽、D 槽）', '可以 format 成不同的檔案系統');
  },
  async (tok, S) => { // 269.0 FAT32、NTFS、Mac
    cap('例如 FAT32、NTFS，Mac 也有自己的', '後面會講 FAT32 怎麼管理檔案');
  },
  async (tok, S) => { // 285.7 差別：disk allocation 與 search
    S.k = hot('差別：disk allocation、搜尋 file structure', 0, 1.6);
    cap('不同 FS 最大差別', 'disk allocation 的方式，和 search file structure 的實作');
  },
  async (tok, S) => { // 305.5 介面都一樣
    S.top = good('對上介面都一樣：file、sequential read / write、directory', 0, 4.9);
    cap('使用介面都一樣', '都是 file，support sequential 的讀寫');
  },
  async (tok, S) => { // 337.7 差在對下 disk 的管理
    cap('差在對下：disk 的管理方式', '');
  },
  async (tok, S) => { // 345.5 換 FS 要整個格式化
    S.v.forEach(([m]) => glow(m, NG));
    bad('format：資料全部清掉', 0, 0.6);
    cap('為什麼 format 要把資料全清掉？', '管理方式完全不同，不可能互相使用');
  },
]);

scene('fs-23d-mapping', 'File system 就是在做 mapping', CAM, [
  async (tok, S) => { // 366.8 主要角色：mapping
    hd('file system = mapping', 0, 6.8);
    cap('檔案系統最主要的角色就是 mapping', '');
  },
  async (tok, S) => { // 373.8 sequential API：file handle、buffer、size
    S.c = code(['read(fh, buf, size)'], -3.8, 5.6);
    S.m = bx('memory：buf', FC.pink, -3.8, 3.8, 0, 2.6, 0.7, 0.9);
    cap('FS 提供 sequential access 的 API', '有 file handle、buffer、size');
  },
  async (tok, S) => { // 389.8 對到 physical device 上的一塊空間
    S.d = prop('disk', 3.8, 2.6, 0, 1.2, 'storage device');
    cap('目的：把這些資訊對到 physical device 上的一塊空間', '');
  },
  async (tok, S) => { // 405.6 memory 的位置 → disk 的位置
    S.pk = bx('data', FC.orange, -3.8, 4.6, 0, 1.0, 0.4, 0.6);
    await slide(tok, S.pk, 3.0, 4.4, 0, 1200);
    cap('看起來很單純', '把 memory 的一個位置，對到 disk 上的一個位置');
  },
  async (tok, S) => { // 415.6 driver 下指令
    S.dr = bx('driver', FC.green, 0, 1.6, 0, 2.0, 0.6, 0.8);
    cap('還要有 driver 下指令', '操作 storage device 的 I/O controller');
  },
  async (tok, S) => { // 428.1 透過 controller 的 register
    S.ct = bx('I/O controller（registers）', FC.teal, 3.8, 1.0, 0, 3.0, 0.6, 0.8);
    lk(V3(1.0, 1.6, 0), V3(2.3, 1.1, 0));
    cap('透過 I/O controller 上的 register', '最後一個一個 byte 寫到 device 上（I/O 章節細講）');
  },
]);

scene('fs-23d-layers', 'Layered file system：logical / file-organization / basic', CAM, [
  async (tok, S) => { // 438.5 光是 mapping 就有很多 layer
    S.L = ['application program', 'logical file system', 'file-organization module', 'basic file system', 'I/O control（driver）', 'devices'].map((t, i) => bx(t, FC.paper, -2.6, 6.2 - i * 1.05, 0, 4.4, 0.75, 0.9));
    S.L.forEach((m) => { m.material.transparent = true; m.material.opacity = 0.35; });
    cap('中間的 mapping 會經過很多 layer', '現在 file system 的設計都是這樣');
  },
  async (tok, S) => { // 456.0 modularize
    cap('切成很多 layer', '每一層比較 modularize、清楚自己的任務');
  },
  async (tok, S) => { // 465.8 第一層：logical file system
    S.L[1].material.opacity = 1; tint(S.L[1], FC.sky); glow(S.L[1], HL);
    cap('第一層：logical file system', '最接近使用者，把檔案呈現給使用者');
  },
  async (tok, S) => { // 481.4 決定 view：定義 API
    S.n1 = sm('定義 API（sequential access）', 3.4, 5.3);
    cap('它決定 logical 的長相（view）', '例如定義 sequential access 的 API');
  },
  async (tok, S) => { // 495.0 resolve permission：ACL
    sm('檢查 permission（ACL）', 3.4, 4.9);
    cap('也 resolve permission', '剛才的 ACL 就屬於這一層');
  },
  async (tok, S) => { // 505.5 找到 file、open、提供 API
    cap('目的：找到 file、open 它，用 API 提供出去', '管理 access 是有效還是無效');
  },
  async (tok, S) => { // 525.5 改 ACL、改 API：只改這層
    note('改 ACL、加新 method → 只改這層', 3.4, 6.4);
    cap('要改 ACL 的 control、增加 API 的 method', '只要改 logical file system');
  },
  async (tok, S) => { // 541.1 第二塊：file-organization module
    glow(S.L[1], null); S.L[2].material.opacity = 1; tint(S.L[2], FC.mint); glow(S.L[2], HL);
    cap('第二塊：開始做 mapping', 'file-organization module');
  },
  async (tok, S) => { // 558.7 logical 位置 → 第幾個 block
    sm('logical position → 第幾個 block', 3.4, 4.0);
    cap('把 logical 的 file access position', '轉成 physical 位置：第幾個 block');
  },
  async (tok, S) => { // 580.0 例：a.txt 目前 position、要讀多少
    S.c = code(['a.txt  pos = 100（示意）', '→ 在第幾個 block？'], 3.4, 3.4, 0.45);
    cap('你有 file handle：a.txt、目前 position', '要 read / write 多少 size → 在哪個 data block？');
  },
  async (tok, S) => { // 608.5 作業就在這一層
    note('作業改寫的就是這層', 3.4, 2.2);
    cap('作業最主要就是寫這一層的機制', '要切成多少 block、放在 physical 什麼位置');
  },
  async (tok, S) => { // 631.6 第 100 個 byte 在第幾個 block
    cap('第 3 個、第 100 個 byte', '到底在第幾個 block 裡：file organization 在做的');
  },
  async (tok, S) => { // 643.7 basic file system：block → 哪個 disk、cylinder、track、sector
    S.c.kill(); glow(S.L[2], null); S.L[3].material.opacity = 1; tint(S.L[3], FC.lilac); glow(S.L[3], HL);
    S.c2 = code(['block → disk / partition', '      → cylinder / track', '      → sector number'], 3.4, 3.4, 0.45);
    cap('知道 block 後，對到 disk 上哪個 sector', 'basic file system：哪個 partition、cylinder、track、sector');
  },
  async (tok, S) => { // 696.0 一般很少碰；新 device 才改
    cap('這層通常很少碰', '只有出現新的 storage device 才要重寫 mapping');
  },
  async (tok, S) => { // 726.6 FS 最大差異在 file organization
    glow(S.L[3], null); glow(S.L[2], HL);
    good('各家 FS 最大差異：file-organization（怎麼分配 disk）', 0, -0.6);
    cap('現在一般 file system 最大的差異', '在 file organization：怎麼分配 disk 資源');
  },
  async (tok, S) => { // 742.6 FS 包含這三層，外面是 driver
    glow(S.L[2], null); S.L[4].material.opacity = 1; tint(S.L[4], FC.sand);
    S.br = hot('file system = 這三層', 3.4, 6.4);
    cap('file system 就包括這三個 layer', '再外面是 driver');
  },
  async (tok, S) => { // 787.7 真的 I/O 要 driver
    glow(S.L[4], HL); S.L[5].material.opacity = 1;
    cap('有了位置要真的 read / write', 'I/O operation 需要 driver：outside file system');
  },
  async (tok, S) => { // 817.2 總結
    glow(S.L[4], null);
    cap('file system 的 structure 就是這樣', '不用背名字：知道要修改的在哪一層');
  },
]);

scene('fs-23d-vfs', 'Virtual file system：一層統一的介面', CAM, [
  async (tok, S) => { // 852.8 support multiple FS、multiple device
    hd('OS：multiple file system + multiple storage device', 0, 6.8);
    cap('以整個 OS 來說', '要 support 多個 file system、多個 storage device');
  },
  async (tok, S) => { // 879.1 架構圖
    S.fs = [['UNIX FS', FC.blue], ['NTFS', FC.orange]].map(([n, c], i) => bx(n, c, -2.6 + i * 5.2, 2.8, 0, 2.6, 0.7, 0.9));
    cap('整個架構圖會變成這樣', '');
  },
  async (tok, S) => { // 888.6 使用者只想看到一個
    S.u = buddy('user', '', FC.purple, 0, 4.6, 0, 0.7);
    cap('對使用者，希望只看到一個 file system manager', '');
  },
  async (tok, S) => { // 893.8 fopen 假設只有一個 FS
    S.c = code(['fopen("a.txt")'], 3.4, 6.0);
    cap('call library 的 fopen', '假設只有一個 file system、一個 directory');
  },
  async (tok, S) => { // 906.6 實際上 partition 各自 format
    sm('partition 1', -2.6, 2.1); sm('partition 2', 2.6, 2.1);
    cap('但不同 partition format 成不同 volume', '這邊 UNIX file system、那邊 NTFS');
  },
  async (tok, S) => { // 920.4 中間要一層 interface
    S.v = bx('interface（abstraction）', FC.green, 0, 4.0, 0, 7.0, 0.5, 0.9);
    cap('使用者不需要看見', '中間需要一層 interface 做 abstraction');
  },
  async (tok, S) => { // 960.1 同一個 FS 用不同 disk：靠 driver
    S.d = [0, 1, 2].map((i) => prop('disk', -4.6 + i * 2.4, 0, 0, 0.7, 'disk ' + (i + 1)));
    S.dv = bx('drivers', FC.sand, 0, 1.5, 0, 7.0, 0.4, 0.8);
    cap('同一個 file system 也能用不同的 disk', '這只要透過不同的 driver');
  },
  async (tok, S) => { // 987.0 VFS：很薄的一層
    relabel(S.v, 'VFS（virtual file system）'); glow(S.v, HL);
    cap('上面那層叫 virtual file system', '很薄的一層，當作 unified 的 interface');
  },
  async (tok, S) => { // 998.5 看檔案由哪個 FS 管，dispatch 過去
    S.a = lk(V3(0.6, 3.7, 0), V3(2.6, 3.2, 0), 0xc08a1f);
    cap('看檔案是哪個檔案系統管', '就把呼叫轉給那個 file system');
  },
]);

scene('fs-23d-ondisk', 'On-disk structures：boot / partition control block、FCB、directory', CAM, [
  async (tok, S) => { // 1018.4 實作 mapping 需要哪些 data structure
    hd('實作 mapping 需要的 data structure', 0, 6.8);
    cap('介紹 FS 需要的 data structure', '');
  },
  async (tok, S) => { // 1040.3 第一類：on-disk
    S.d = bx('', FC.gray, 0, 1.0, 0, 12.0, 1.0, 1.2); sm('一個 partition（在 disk 上）', 0, 0.2);
    cap('第一類：on-disk structure', '必須存在 disk 上：檔案是永久存在的');
  },
  async (tok, S) => { // 1058.0 boot control block
    S.b = bx('boot control block', FC.red, -5.1, 2.4, 0, 1.6, 0.9, 1.0);
    cap('第一個：boot control block', '顧名思義，開機用的');
  },
  async (tok, S) => { // 1067.4 partition 前面 reserve
    sm('partition 最前面', -5.1, 3.2);
    cap('如果這個 partition 是開機用的系統槽', '最前面的空間 reserve 下來');
  },
  async (tok, S) => { // 1077.6 存開機用的 code、data
    note('開機用的 code + data', -4.4, 4.2);
    cap('裡面存開機需要的 code 和 data', '讓它變成一個可開機的 partition');
  },
  async (tok, S) => { // 1095.4 硬碟可以切好幾個 partition
    cap('一顆 hard drive 可以切好幾個 partition', '');
  },
  async (tok, S) => { // 1106.3 partition control block
    S.pc = bx('partition control block', FC.orange, -2.9, 2.4, 0, 2.6, 0.9, 1.0);
    cap('每個 partition 有 partition control block', '有多少 block、還有多少空間');
  },
  async (tok, S) => { // 1122.0 切完就 create
    glow(S.pc, HL);
    cap('做磁區分割時：切完位置就 create 它', 'OS 透過它知道怎麼 access 這個 partition');
  },
  async (tok, S) => { // 1139.3 formatting：FCB 與 directory
    glow(S.pc, null);
    S.dir = bx('directory', FC.blue, -0.6, 2.4, 0, 1.8, 0.9, 1.0); S.fcb = bx('FCBs', FC.purple, 1.4, 2.4, 0, 1.8, 0.9, 1.0);
    cap('partition 完要 formatting 變成 file system', '就需要 file control block，還有 directory');
  },
  async (tok, S) => { // 1162.5 先存 directory，剩下放 file 的 block
    S.db = bx('data blocks', FC.green, 4.4, 2.4, 0, 3.6, 0.9, 1.0);
    cap('通常先存 directory structure', '剩下的空間全部放 file 的 block');
  },
  async (tok, S) => { // 1199.2 一個 partition 長這樣
    [S.b, S.pc, S.dir, S.fcb, S.db].forEach((m) => glow(m, HL)); await wt(tok, 600); [S.b, S.pc, S.dir, S.fcb, S.db].forEach((m) => glow(m, null));
    cap('一般而言一個 partition 長這樣', '');
  },
  async (tok, S) => { // 1202.8 boot 是 optional
    S.b.material.transparent = true; S.b.material.opacity = 0.35;
    cap('第一個是 optional', '不是每個 partition 都拿來開機');
  },
  async (tok, S) => { // 1216.8 control block 之後才是 data block
    glow(S.db, HL);
    cap('control block 之後是 data block', '才是真正放資料的部分');
  },
  async (tok, S) => { // 1225.0 FCB 存 attribute，像 PCB
    glow(S.db, null); glow(S.fcb, HL);
    sm('FCB 就像 process control block：存 permission 等 attributes', 1.4, 4.0);
    cap('control block 存的就是 attribute', '跟 process control block 一樣');
  },
  async (tok, S) => { // 1237.2 load 到 open-file table
    S.m = bx('open-file table（memory）', FC.pink, 1.4, 5.4, 0, 3.4, 0.6, 0.8);
    S.a = lk(V3(1.4, 2.9, 0), V3(1.4, 5.0, 0), 0xc08a1f);
    cap('開檔時把 FCB load 到 open-file table', '就可以開始 access 一個 file');
  },
]);

// ════════ ZYgU9wrZaZo（第 24A 講：File System Implementation） ════════
// a partition strip on disk: boot | partition CB | directory | FCBs | data blocks
function strip(y = 1.2, all = false) {
  const SPEC = { boot: ['boot CB', FC.red, -5.3, 1.6], pcb: ['partition CB', FC.orange, -3.3, 2.2], dir: ['directory', FC.blue, -1.0, 2.0], fcb: ['FCBs', FC.purple, 1.0, 1.8], data: ['data blocks', FC.green, 4.2, 4.4] };
  const P = { base: bx('', FC.gray, 0, y - 0.7, 0, 12.4, 0.3, 1.2) };
  P.show = (k) => { if (!P[k]) { const [t, c, x, w] = SPEC[k]; P[k] = bx(t, c, x, y, 0, w, 0.9, 1.0); } return P[k]; };
  if (all) Object.keys(SPEC).forEach(P.show);
  return P;
}
scene('fs-24a-ondisk', 'On-disk structures：boot、partition control block、FCB、directory', CAM, [
  async (tok, S) => { // 15.1 很重要：實作的設計
    hd('File system implementation', 0, 6.8);
    cap('今天的部分很重要：file system 實作', '作業也要寫：檔案怎麼擺在硬碟上');
  },
  async (tok, S) => { // 43.4 要 maintain 一些 structure
    S.P = strip(); sm('一個 partition（disk 上）', 0, 0.0);
    cap('要管理檔案，先 maintain 重要的 structure', '才知道怎麼管 storage space、檔案、資料夾、磁區');
  },
  async (tok, S) => { // 65.6 persistent：先談 on-disk
    S.d = prop('disk', 5.6, 3.4, 0, 0.8, 'disk');
    cap('跟其他 structure 很不同：檔案是 persistent', '所以先從 on-disk structure 談起');
  },
  async (tok, S) => { // 89.2 boot control block
    S.P.show('boot'); glow(S.P.boot, HL);
    cap('第一個：boot control block', '用這個 volume 載入 OS 開機時，partition 最前面 reserve 的空間');
  },
  async (tok, S) => { // 120.2 開機最基本的 code
    note('不透過 file system 就能 load 的開機 code', -4.0, 3.0);
    cap('存 booting 用的 information', '甚至是最基本的 instruction，像 hard code 直接 load');
  },
  async (tok, S) => { // 170.2 partition control block
    glow(S.P.boot, null); S.P.show('pcb'); glow(S.P.pcb, HL);
    cap('再來：partition control block', 'partition 從哪到哪、range、有多少 space');
  },
  async (tok, S) => { // 219.1 file control block（不是 content）
    glow(S.P.pcb, null); S.P.show('fcb'); glow(S.P.fcb, HL);
    cap('再來要知道有哪些 file：file control block', '注意：不是 file content，只存 metadata');
  },
  async (tok, S) => { // 245.2 每個 file 一個，像 PCB
    S.f = stack(1.0, 5.6, ['location', 'size', 'name…'], { w: 2.2, c: FC.lilac, title: 'FCB' });
    cap('每個 file 都有一個 FCB', '就像每個 process 有 process control block');
  },
  async (tok, S) => { // 257.6 directory structure
    glow(S.P.fcb, null); S.P.show('dir'); glow(S.P.dir, HL);
    cap('還有 directory structure', '描述那顆 tree 或 acyclic graph');
  },
  async (tok, S) => { // 284.4 切完 partition：建立 partition control block
    glow(S.P.dir, null); glow(S.P.pcb, HL);
    cap('切完 partition 時', '就 create partition control block');
  },
  async (tok, S) => { // 294.7 沒 format：raw partition
    S.P.dir.material.transparent = true; S.P.fcb.material.transparent = true; S.P.dir.material.opacity = 0.25; S.P.fcb.material.opacity = 0.25;
    cap('沒有 formatting 的話', 'FCB、directory 都不存在：就是 raw partition');
  },
  async (tok, S) => { // 299.7 format：建 FCB、directory
    glow(S.P.pcb, null); S.P.dir.material.opacity = 1; S.P.fcb.material.opacity = 1; glow(S.P.dir, HL); glow(S.P.fcb, HL);
    cap('format 時就在建置 FCB、directory structure', '這些基本 information');
  },
  async (tok, S) => { // 315.2 create file 會修改
    glow(S.P.dir, null); glow(S.P.fcb, null);
    cap('之後 create file', '就會新增或修改這裡面的 content');
  },
  async (tok, S) => { // 324.3 修改要寫回 on-disk
    S.a = lk(V3(4.8, 3.4, 0), V3(1.0, 1.8, 0), 0xc08a1f);
    good('修改最後一定要寫回 on-disk structure', -1.6, 3.4);
    cap('這些全部都是 on disk', '修改之後 eventually 要寫回 disk，才不會遺失');
  },
]);

scene('fs-24a-layout', 'Partition layout：FCB 記錄 data blocks 的位置', CAM, [
  async (tok, S) => { // 338.3 partition 整個 layout
    S.P = strip(1.2, true);
    cap('一個 partition 整個 layout 長這樣', '');
  },
  async (tok, S) => { // 345.0 之後才是 data blocks
    glow(S.P.data, HL);
    cap('存完 FCB 之後', '這裡才是 data blocks：真正存 file content');
  },
  async (tok, S) => { // 354.2 可以任意擺，但位置要記在 FCB
    glow(S.P.data, null);
    S.b = [0, 1, 2].map((i) => bx('', FC.orange, 2.6 + i * 1.3, 1.2, 0.6, 0.6, 0.5, 0.3));
    S.a = S.b.map((m, i) => lk(V3(1.0, 1.7, 0.6), V3(2.6 + i * 1.3, 1.5, 0.6), 0xc08a1f));
    cap('data blocks 都是可用空間，可以任意擺放', '但擺放的位置要記在 FCB 裡，才找得到');
  },
  async (tok, S) => { // 366.2 最重要：file data blocks location
    glow(S.P.fcb, HL);
    note('FCB 最重要：data blocks 的 location', 1.0, 3.4);
    cap('FCB 裡更重要的是 file data blocks location', '作業要寫的就是：怎麼擺、用什麼方式記錄');
  },
]);

scene('fs-24a-inmem', 'In-memory structures：mount table、directory cache、兩張 open-file table', CAM, [
  async (tok, S) => { // 382.0 load 進 memory
    S.P = strip(0.9, true);
    S.m = zone('memory', 0, 3.6, 0, 12.4, 2.2, '#f3e3ea');
    cap('file system 被 load 或開始 access 時', '要把 information load 到 memory，OS 才能處理');
  },
  async (tok, S) => { // 406.7 boot 不用 load
    S.P.boot.material.transparent = true; S.P.boot.material.opacity = 0.3;
    cap('相對應的 structure 都有', '除了 booting：boot control block 不需要 load 到 memory');
  },
  async (tok, S) => { // 421.9 partition table（mount table）
    S.mt = bx('mount table', FC.orange, -4.6, 3.8, 0, 2.4, 0.7, 0.9);
    S.a1 = lk(V3(-3.3, 1.4, 0), V3(-4.4, 3.4, 0), 0xc08a1f);
    cap('第一個：partition 的 table', '要知道你有沒有 mount');
  },
  async (tok, S) => { // 427.7 mount = 把 partition table load 進 memory
    glow(S.mt, HL);
    cap('mount 一個 partition 做什麼？', '最主要就是把 partition table load 到 memory');
  },
  async (tok, S) => { // 451.2 traverse：load directory
    glow(S.mt, null); S.dc = bx('directory（部分）', FC.blue, -1.6, 3.8, 0, 2.4, 0.7, 0.9);
    S.a2 = lk(V3(-1.0, 1.4, 0), V3(-1.4, 3.4, 0), 0xc08a1f);
    cap('mount 完要 traverse 它', '所以需要 load directory structure');
  },
  async (tok, S) => { // 463.1 只 load 最近用的部分
    glow(S.dc, HL); sm('只有 recently accessed 的 entry', -1.6, 4.5);
    cap('注意：只 load 一部分', 'memory 有限，大部分時候也只用某些資料夾');
  },
  async (tok, S) => { // 497.3 MRU、preload 下一層
    sm('例如 MRU、preload 下一個 level', -1.6, 4.9);
    cap('合理的做法：most recently used', '或 preload 下一個 level，一次多 load 一點比較有效率');
  },
  async (tok, S) => { // 524.2 system-wide open-file table = FCB
    glow(S.dc, null); S.sw = bx('system-wide OFT', FC.purple, 1.6, 3.8, 0, 2.6, 0.7, 0.9);
    S.a3 = lk(V3(1.0, 1.4, 0), V3(1.4, 3.4, 0), 0xc08a1f); glow(S.sw, HL);
    cap('開啟 file：system-wide open-file table', '存的其實就是 FCB：只跟 file 有關、跟使用者無關');
  },
  async (tok, S) => { // 558.6 per-process：handle、position、permission
    glow(S.sw, null); S.pp = bx('per-process OFT', FC.sky, 4.6, 3.8, 0, 2.4, 0.7, 0.9); glow(S.pp, HL);
    sm('handle、position、permission', 4.6, 4.5);
    cap('根據不同使用者：per-process open-file table', 'handle、position、open by read 還是 write');
  },
  async (tok, S) => { // 588.7 不存在 disk 上
    bad('不在 disk 上', 4.6, 2.4);
    cap('這張不存在 disk 上', '是操作 file 過程中產生的資訊');
  },
  async (tok, S) => { // 597.4 四個主要 structure
    glow(S.pp, null); [S.mt, S.dc, S.sw, S.pp].forEach((m) => glow(m, HL));
    cap('就是這四個最主要的 structure', '存在 memory 裡，就可以開始操作 file');
  },
  async (tok, S) => { // 611.5 要分清楚 on disk / in memory
    [S.mt, S.dc, S.sw, S.pp].forEach((m) => glow(m, null));
    good('分清楚：on disk vs in memory', 0, 6.4);
    cap('尤其要區分 on disk 跟 in memory', '它們畢竟不一樣');
  },
]);

scene('fs-24a-open', 'open()：traverse directory → 找到 FCB → 載入 open-file table', CAM, [
  async (tok, S) => { // 616.8 用例子走一遍
    S.dk = zone('disk', -3.0, 0, 0, 7.0, 2.0, '#e7e0d4'); S.mm = zone('memory', 3.6, 0, 0, 5.8, 2.0, '#f3e3ea');
    cap('用幾個例子走一遍：open、read / write、create', '看這些 structure 運作的順序');
  },
  async (tok, S) => { // 631.1 open 一個 file
    S.c = code(['open("/usr/a.txt")'], 0, 6.6);
    cap('從 open 開始看', '要 open 一個 file 會發生什麼事？');
  },
  async (tok, S) => { // 642.2 已經 mount：從 root directory traverse
    S.dm = bx('directory（部分）', FC.blue, 3.6, 2.6, 0, 2.6, 0.6, 0.8); glow(S.dm, HL);
    cap('位置已經 mount 好', '直接從 root 的 directory 開始 traverse，照 path 找');
  },
  async (tok, S) => { // 669.1 不在 memory → 從 disk load
    S.dd = bx('directory（全部）', FC.blue, -4.6, 1.6, 0, 2.8, 0.6, 0.8);
    S.pk = bx('usr/ 的 entry', FC.sky, -4.6, 2.4, 0, 1.8, 0.4, 0.6);
    await slide(tok, S.pk, 3.6, 3.4, 0, 900);
    cap('directory 不會一次全部 load', 'traverse 時不在 memory，就去那個 partition load 進來');
  },
  async (tok, S) => { // 689.5 先看 memory，找不到再去 secondary
    cap('先去 memory 看', '找不到才去 on-disk structure 把剩下的依序 load 進來');
  },
  async (tok, S) => { // 703.0 找到 → FCB
    S.fd = bx('FCB(a.txt)', FC.purple, -1.4, 1.6, 0, 2.0, 0.6, 0.8); glow(S.fd, HL);
    cap('找到之後，directory 指到什麼？', '其實就是 file control block');
  },
  async (tok, S) => { // 721.4 把 FCB load 到 system-wide open-file table
    S.sw = bx('system-wide OFT', FC.purple, 3.6, 4.4, 0, 2.6, 0.6, 0.8);
    S.pk2 = bx('FCB', FC.purple, -1.4, 2.4, 0, 1.0, 0.4, 0.6); await slide(tok, S.pk2, 3.6, 5.0, 0, 900);
    cap('open 就是找到 FCB', '把 on-disk 的 FCB load 到 memory 的 open-file table');
  },
  async (tok, S) => { // 739.2 填 per-process table
    S.pp = bx('per-process OFT', FC.sky, 3.6, 5.8, 0, 2.6, 0.6, 0.8); glow(S.pp, HL);
    cap('再依 process 的 permission 等', '把 per-process open-file table 的資訊填起來');
  },
  async (tok, S) => { // 752.1 總結
    glow(S.pp, null); good('open = 找到 FCB，load 到 memory', -2.6, 4.6);
    cap('就完成了 file open', '最主要就是找到 FCB，把它 load 到 memory');
  },
]);

scene('fs-24a-rw', 'read() / write()：handle → per-process → system-wide → FCB → disk', CAM, [
  async (tok, S) => { // 760.1 read / write
    S.c = code(['read(fh, buf, 4)'], -4.6, 6.6);
    cap('接下來看 read 跟 write', '假設 file 已經 open 了');
  },
  async (tok, S) => { // 771.5 兩層 open-file table
    S.pp = stack(-3.4, 4.6, ['fh 3 → a.txt', 'pos 100、mode r'], { w: 2.8, c: FC.sky, title: 'per-process OFT' });
    S.sw = stack(1.6, 4.6, ['a.txt 的 FCB', 'block 位置'], { w: 2.8, c: FC.lilac, title: 'system-wide OFT' });
    cap('open-file table 有兩層', '一層是 FCB，一層是這個 process 的 information');
  },
  async (tok, S) => { // 783.3 file handle 是 entry 的 pointer
    glow(S.pp.cells[0], HL); S.a1 = lk(V3(-4.6, 6.3, 0), V3(-3.6, 4.9, 0), 0xc08a1f);
    cap('為什麼 call API 一定要 file handle？', '它就是 per-process table 裡 entry 的 pointer');
  },
  async (tok, S) => { // 796.7 知道 permission、position
    glow(S.pp.cells[0], null); glow(S.pp.cells[1], HL);
    cap('就知道檔案有沒有開、有哪些 permission', '以及目前的 position 在哪');
  },
  async (tok, S) => { // 803.8 permission denied → 擋回
    S.x = bad('permission denied → 這裡就擋回去', -3.4, 2.4);
    cap('如果 permission denied', '在這一層就被 reject 回來');
  },
  async (tok, S) => { // 810.0 要找真正的位置
    remove(S.x); glow(S.pp.cells[1], null);
    cap('確定 open 了、知道從哪讀', '接著要找它真正的位置');
  },
  async (tok, S) => { // 825.2 per-process 指到 system-wide 的 entry
    S.a2 = lk(V3(-2.0, 4.0, 0), V3(0.2, 4.6, 0), 0xc08a1f); glow(S.sw.cells[0], HL);
    cap('真正的位置存在 FCB 裡', '所以 per-process entry 要知道 system-wide entry 在哪');
  },
  async (tok, S) => { // 838.6 FCB 的位置資訊 → disk
    glow(S.sw.cells[0], null); glow(S.sw.cells[1], HL);
    S.d = prop('disk', 5.4, 0.6, 0, 1.0, 'disk'); S.a3 = lk(V3(3.0, 4.0, 0), V3(5.0, 2.0, 0), 0xc08a1f);
    cap('用 FCB 的資訊找到 content', '從 disk 那個位置讀出來或寫進去');
  },
  async (tok, S) => { // 854.6 FCB 很大：分批 load
    note('pointer 太多時，location 也可能用 linked list 串、分批 load', 0, 1.2);
    cap('FCB 也不一定全部 load', '檔案很大時 location 可能用 linked list 串，分批 load');
  },
  async (tok, S) => { // 893.0 總結流程
    glow(S.sw.cells[1], null);
    cap('read / write 流程', 'per-process table → system-wide table → FCB 的 location → physical 位置');
  },
]);

scene('fs-24a-create', 'create()：建 FCB、更新 directory、flush 回 disk', CAM, [
  async (tok, S) => { // 911.9 create
    S.dk = zone('disk', -3.6, 0, 0, 6.4, 2.0, '#e7e0d4'); S.mm = zone('memory', 3.6, 0, 0, 6.0, 2.0, '#f3e3ea');
    S.c = code(['create("/home/hw/b.txt")'], 0, 6.6);
    cap('接下來是 create', '這些 data structure 的操作，可以想見順序');
  },
  async (tok, S) => { // 925.0 先 create FCB
    S.fcb = bx('FCB(b.txt)', FC.purple, 3.6, 1.0, 0, 2.2, 0.6, 0.8); glow(S.fcb, HL);
    cap('create file 就是在 create FCB', '一開始 content 是空的，但要先有 control block 檔案才存在');
  },
  async (tok, S) => { // 941.8 要跟 directory 連結
    glow(S.fcb, null);
    S.N = { h: { name: 'home', x: 3.0, y: 4.6, kind: 'dir' }, hw: { name: 'hw', x: 3.0, y: 3.2, kind: 'dir' } };
    S.G = graph(S.N, [['h', 'hw']], 0);
    cap('FCB 要放到某個 file path', '所以 directory structure 也要 update');
  },
  async (tok, S) => { // 954.2 path 存不存在？
    S.q = bub('hw 這個資料夾存在嗎？', 0.0, 4.0);
    cap('可以 create 在任何 path', '要先 make sure 那個 path 存在，否則「資料夾不存在」');
  },
  async (tok, S) => { // 980.0 traverse；不在 memory 就從 disk load
    remove(S.q); S.dd = bx('directory', FC.blue, -4.6, 1.0, 0, 2.2, 0.6, 0.8);
    glow(S.G.M.h, HL); await wt(tok, 300); glow(S.G.M.hw, HL);
    cap('跟 open 類似：traverse directory', '不在 memory 就從 disk load，直到確定存在');
  },
  async (tok, S) => { // 994.2 加入 file name（leaf）
    S.G2 = graph({ b: { name: 'b.txt', x: 3.0, y: 1.9 } }, [], 2); line(3.0, 2.95, 3.0, 2.15, 0);
    cap('在那個 directory 下 create file name', 'file name 也是 directory 的一部分，像 tree 的 leaf');
  },
  async (tok, S) => { // 1013.6 指到 FCB
    S.a = lk(V3(3.6, 1.7, 0.2), V3(3.6, 1.35, 0.2), 0xc08a1f); glow(S.G2.M.b, HL); glow(S.fcb, HL);
    cap('把這個 file name 指到它的 FCB', '');
  },
  async (tok, S) => { // 1026.4 這只在 memory
    note('目前只在 memory！', 3.6, 6.0);
    cap('注意：process 在操作，這只在 memory 裡', '');
  },
  async (tok, S) => { // 1037.5 週期性 flush 回 disk
    S.p1 = bx('dir', FC.blue, 3.0, 1.0, 0.8, 0.8, 0.4, 0.4); S.p2 = bx('FCB', FC.purple, 4.2, 1.0, 0.8, 0.8, 0.4, 0.4);
    slide(tok, S.p1, -4.6, 1.6, 0.8, 900); await slide(tok, S.p2, -2.6, 1.6, 0.8, 900);
    cap('要確保不遺失就要寫回 disk', 'file system periodically flush 回去，或關機時全部 flush');
  },
  async (tok, S) => { // 1058.3 跳電就遺失
    bad('還沒寫回就跳電 → 資料遺失', -3.6, 3.0);
    cap('跳電資料遺失就是這樣', '只寫到 in-memory structure，來不及寫回 disk');
  },
  async (tok, S) => { // 1077.5 rename 等修改都一樣
    cap('不只 create', 'rename 等所有修改都一樣：只先寫在 memory，一段時間才 flush');
  },
  async (tok, S) => { // 1091.1 不正常關機：scan disk
    S.sc = bx('scan disk', FC.orange, -3.6, 4.4, 0, 2.2, 0.5, 0.7);
    cap('所以不正常關機後會先 scan disk', '看看有沒有資訊不 match');
  },
  async (tok, S) => { // 1103.3 只 flush 到一半
    glow(S.p1, OKG); glow(S.p2, NG);
    cap('為什麼不 match？', '改了很多地方，可能只 flush 到一半：像 transaction');
  },
  async (tok, S) => { // 1115.5 logging
    S.lg = bx('log', FC.teal, -1.2, 4.4, 0, 1.4, 0.5, 0.7);
    cap('很多 file system 可以 enable logging', '除了寫 memory，也把動作寫成 log');
  },
  async (tok, S) => { // 1141.1 log 直接寫到 disk → recovery
    await slide(tok, S.lg, -1.2, 1.6, 0, 800); glow(S.lg, OKG);
    cap('log 一定 guarantee 寫到 disk 上', 'crash 時拿 log 出來做 recovery');
  },
  async (tok, S) => { // 1162.4 ls 看到結果
    S.ls = code(['$ ls /home/hw', 'b.txt'], 3.6, 5.4);
    cap('真的完成了', '去 ls 一看就會看到它被 create 出來');
  },
  async (tok, S) => { // 1169.6 之後 write：加 data block、更新 FCB pointer
    S.db = bx('data block', FC.green, 5.6, 2.4, 0, 1.6, 0.5, 0.7); S.a2 = lk(V3(4.7, 1.2, 0), V3(5.3, 2.1, 0), 0x2fc092);
    cap('之後再 write', '只是加 data block，並 update FCB 裡的 pointer 資訊');
  },
]);

scene('fs-24a-vfs', 'VFS：mount 進來的不同 FS 用同一個介面', CAM, [
  async (tok, S) => { // 1186.0 系統裡不只一個 FS
    S.G = graph({ r: { name: '/', x: 0, y: 3.4, kind: 'dir' }, a: { name: 'ext4 volume', x: -3.4, y: 1.6, kind: 'vol' }, b: { name: 'NTFS volume', x: 3.4, y: 1.6, kind: 'vol', color: C.fil } }, [['r', 'a'], ['r', 'b']], 2);
    cap('整個系統裡不只一個 file system', 'mount 不同 volume，各由不同 FS 管理（名稱示意）');
  },
  async (tok, S) => { // 1202.9 前面加一層 unified interface：VFS
    S.v = bx('VFS（unified interface）', FC.green, 0, 5.0, 0, 7.0, 0.6, 0.9); glow(S.v, HL);
    cap('為什麼能全部接在一起？', '前面加一層 unified interface：virtual file system');
  },
  async (tok, S) => { // 1215.0 使用者透過不變的介面
    S.u = buddy('user', '', FC.purple, 0, 5.6, 0, 0.6);
    cap('使用者不直接對各 FS 的 API 操作', '而是透過這個 unified、不會變的 interface');
  },
  async (tok, S) => { // 1229.0 mount 時要 implement 它
    cap('不同 file system 要 mount 進來時', '要對應地 implement 這個 interface');
  },
  async (tok, S) => { // 1239.8 好處：永遠同一套 API
    good('寫程式永遠用相同 API', 4.6, 6.4);
    cap('最大好處：使用者 always 用相同的 API', '不用管下面 file system 的 implementation');
  },
  async (tok, S) => { // 1251.2 traverse 時跨 FS 也透過 VFS
    glow(S.G.M.r, HL); await wt(tok, 300); glow(S.G.M.b, HL);
    cap('traverse 時，tree 不屬於單一 FS', 'mount 接來接去，也是透過 VFS 用其他 FS 的資訊');
  },
  async (tok, S) => { // 1282.8 必要
    glow(S.G.M.r, null); glow(S.G.M.b, null);
    cap('所以這層是必要的', '才能把所有 file system 用相同介面操作');
  },
]);

scene('fs-24a-vfsobj', 'Linux VFS 的四個 object：inode、file、superblock、dentry', CAM, [
  async (tok, S) => { // 1295.6 Linux VFS：四個 class
    hd('Linux VFS：四個主要 object（class）', 0, 6.8);
    cap('Linux 的 VFS 實作', '分成四個主要的 object（class）');
  },
  async (tok, S) => { // 1320.6 inode = FCB
    S.i = bx('inode', FC.purple, -4.8, 4.8, 0, 2.2, 0.8, 0.9); sm('= file control block（on disk）', -4.8, 4.0);
    cap('最常聽到的 inode', '就是 individual file 的 FCB');
  },
  async (tok, S) => { // 1337.5 VFS 定義名字，各 FS implement
    cap('inode 是 VFS 這層定義的名字', '不同 file system 去 implement 它的操作與細節');
  },
  async (tok, S) => { // 1349.6 file object：open 後在 memory
    S.f = bx('file object', FC.sky, -1.6, 4.8, 0, 2.2, 0.8, 0.9); sm('open 之後的 in-memory object', -1.6, 4.0);
    cap('file object：兩個都是 file，差在哪？', 'inode 是 on-disk 的 FCB；file object 是 open 後 load 到 memory 的');
  },
  async (tok, S) => { // 1381.3 superblock：整個 file system
    S.sb = bx('superblock', FC.orange, 1.6, 4.8, 0, 2.2, 0.8, 0.9); sm('整個 file system（partition CB）', 1.6, 4.0);
    cap('superblock object：entire file system', '對到前面 partition control block 存的資料');
  },
  async (tok, S) => { // 1401.4 dentry：directory
    S.de = bx('dentry', FC.blue, 4.8, 4.8, 0, 2.2, 0.8, 0.9); sm('directory entry', 4.8, 4.0);
    cap('最後是 dentry object', '指的就是 directory');
  },
  async (tok, S) => { // 1418.1 四個
    [S.sb, S.de, S.i, S.f].forEach((m) => glow(m, HL)); await wt(tok, 500); [S.sb, S.de, S.i, S.f].forEach((m) => glow(m, null));
    cap('volume → directory → file', 'file 又分 on-disk 的 inode 和 active 的 file object');
  },
  async (tok, S) => { // 1427.3 每個 class 有 method：open
    S.m1 = code(['file->open()'], -1.6, 2.6); glow(S.f, HL);
    cap('每個 class 都有 method（interface）', '例如 open 在 file object 裡，要去 implement');
  },
  async (tok, S) => { // 1449.6 read
    S.m2 = code(['file->read()'], -1.6, 2.0);
    cap('要 read 一個 file', '一定是從已經 open 的 file object 讀：也有 read 的 API');
  },
  async (tok, S) => { // 1465.3 上層照 VFS 下指令
    glow(S.f, null); good('上層 system code 照 VFS 對 FS 下指令', 0, 0.6);
    cap('implement 好之後', '上面的 system code 就照 VFS 對 file system 下指令');
  },
]);

scene('fs-24a-keys', '實作兩大重點：directory 怎麼存、data block 怎麼擺', CAM, [
  async (tok, S) => { // 1475.3 最重要的兩部分
    hd('實作最重要的兩部分', 0, 6.8);
    cap('這些 object 的實作，最重要的兩部分', '');
  },
  async (tok, S) => { // 1488.7 directory structure：給 path 快速判斷
    S.p = hot('/home/john/a.txt 存在嗎？', -3.6, 5.6);
    cap('一個是 directory structure', 'directory 很大，給 path 要很快知道存不存在');
  },
  async (tok, S) => { // 1500.0 linked list
    S.ll = [0, 1, 2, 3].map((i) => bx(['home', 'john', 'hw', 'a.txt'][i], FC.blue, -5.6 + i * 1.3, 4.2, 0, 1.1, 0.45, 0.5));
    for (let i = 0; i < 3; i++) lk(V3(-5.0 + i * 1.3, 4.2, 0), V3(-4.95 + (i + 1) * 1.3 - 0.6, 4.2, 0));
    cap('可以用 linked list 把整個 tree 串起來', '');
  },
  async (tok, S) => { // 1504.8 hash table
    S.h = stack(-3.6, 3.1, ['h(a.txt) → entry'], { w: 3.0, c: FC.paper, title: 'hash table' });
    cap('或用 hash table', '用 lookup 的方式找');
  },
  async (tok, S) => { // 1513.8 影響 search time
    note('影響 search time：使用者感覺差很多', -3.6, 1.2);
    cap('不同方式 maintain directory', '會影響 search time，對效能感覺影響很大');
  },
  async (tok, S) => { // 1523.6 另一塊：data block 怎麼擺
    S.blk = []; for (let i = 0; i < 12; i++) S.blk.push(bx('', [3, 4, 5, 9].includes(i) ? FC.orange : FC.tan, 1.4 + (i % 4) * 1.2, 4.8 - Math.floor(i / 4) * 1.0, 0, 1.0, 0.7, 0.6));
    hd('data block 怎麼擺', 3.2, 6.0);
    cap('另一塊（接下來最重要）', '你的 data block 怎麼擺');
  },
  async (tok, S) => { // 1528.4 random 或 sequential 跟擺法有關
    cap('read / write 是 random 還是 sequential', '跟擺法有絕對的關係');
  },
  async (tok, S) => { // 1549.8 第一個 part 講完
    good('directory 的 entry 怎麼擺 + data block 怎麼擺', 0, 0.2);
    cap('file system 運作的基本流程講完了', '效能關鍵：directory entry、data block 的擺法');
  },
]);

// ════════ UpPyxA0THzU（第 24B 講：Allocation methods — contiguous / extent / linked / FAT / indexed） ════════
// 恐龍書的圖：contiguous（count 0-1、f 6-7、tr 14-16、mail 19-24、list 28-31）、linked（jeep 9→16→1→10→25）、FAT（217→618→339）
const CONTIG = { count: [0, 2], f: [6, 2], tr: [14, 3], mail: [19, 6], list: [28, 4] };
const JEEP = [9, 16, 1, 10, 25];
const ttl = (t) => tag(t, 'ptr', 0, 0.3, -3.3);
scene('fs-24b-overview', 'Allocation methods：contiguous、linked、indexed', CAM, [
  async (tok, S) => { // 14.8 allocation：content → data blocks
    S.f = prop('file', -5.4, 3.6, 0, 1.0, 'file');
    S.blk = []; for (let i = 0; i < 16; i++) S.blk.push(bx('', FC.tan, -2.6 + (i % 8) * 1.1, 4.6 - Math.floor(i / 8) * 0.9, 0, 0.95, 0.7, 0.6));
    cap('focus 在 allocation method', '檔案內容怎麼 map 到 data block、放在 disk 哪裡');
  },
  async (tok, S) => { // 42.9 影響讀寫頭路徑 → performance
    sm('擺法 → 讀寫頭移動的順序與路徑 → performance', 1.2, 3.1);
    cap('會影響讀寫頭的順序跟路徑長短', '也就是 performance');
  },
  async (tok, S) => { // 47.5 disk blocks 怎麼 allocate 給 file
    cap('allocation：disk 的 block', '到底怎麼 allocate 給 file 存資料');
  },
  async (tok, S) => { // 61.0 三種 data structure
    hd('三種基本做法', -3.6, 2.2);
    cap('基本做法：三種不同的 data structure', '');
  },
  async (tok, S) => { // 65.9 contiguous
    for (let i = 0; i < 4; i++) tint(S.blk[i], FC.orange);
    bx('Contiguous：連續擺放', FC.orange, -3.6, 1.3, 0, 3.6, 0.5, 0.7);
    cap('第一：contiguous', '顧名思義，連續擺放');
  },
  async (tok, S) => { // 71.6 linked
    [5, 10, 7, 13].forEach((i) => tint(S.blk[i], FC.blue));
    bx('Linked：像 linked list 串起來', FC.blue, -3.6, 0.6, 0, 3.6, 0.5, 0.7);
    cap('第二：linked', '像 linked list，把 block 串起來，至少找得到');
  },
  async (tok, S) => { // 86.0 indexed
    bx('Indexed：pointer 收集起來查表', FC.gold, -3.6, -0.1, 0, 3.6, 0.5, 0.7);
    cap('最後：index', '把每個 data block 的 pointer 收集起來，查表直接跳');
  },
  async (tok, S) => { // 107.3 disk 有限、file 長短會變
    note('考慮①：disk 空間有限、file 長短會改變', 2.6, 1.3);
    cap('還有變形要討論，因為要考慮', 'disk space 有限，而且 file 長短會改變');
  },
  async (tok, S) => { // 116.1 找不找得到夠長的連續空間
    cap('能不能找到夠長的連續空間？', '這是一個 issue');
  },
  async (tok, S) => { // 130.4 sequential vs random
    note('考慮②：sequential 讀 vs 跳著讀', 2.6, 0.5);
    cap('存好之後：sequentially 讀跟跳著讀', 'behavior 差別：各有好處跟壞處');
  },
]);

scene('fs-24b-contig', 'Contiguous allocation：directory 存 (start, length)', TOP, [
  async (tok, S) => { // 141.8 contiguous allocation
    diskGrid(); S.t = ttl('Contiguous allocation');
    cap('第一個 solution：contiguous allocation', '最直接、最簡單的做法');
  },
  async (tok, S) => { // 154.1 五個 files
    S.M = {}; const col = { count: C.fat, f: C.vol, tr: C.fil, mail: C.file, list: C.free };
    for (const [n, [s, l]] of Object.entries(CONTIG)) { S.M[n] = []; for (let k = 0; k < l; k++) S.M[n].push(blk(s + k, k ? '' : n, col[n], 0, 0, 1.5)); }
    cap('假設有五個 files（恐龍書的圖）', 'count、f、tr、mail、list');
  },
  async (tok, S) => { // 172.9 tr 從 14 開始：14、15、16
    for (const m of S.M.tr) { glow(m, HL); await wt(tok, 250); }
    cap('contiguous：從哪開始擺就必須接著', 'tr 從 14 開始存，就 14、15、16 依序下去');
  },
  async (tok, S) => { // 188.6 FCB 要存什麼？
    S.q = tag('FCB 要存什麼，才找得到資料？', 'ptr alt', 0, 1.0, 2.9);
    cap('FCB 裡要存的 information 是什麼？', '');
  },
  async (tok, S) => { // 198.2 tr 的第 1000 個 byte，block 200 → 第 5 個 block
    txt(S.q, '1000 ÷ 200 = 5 → 第 5 個 block（0 起算，示意）');
    cap('要找 tr 的第 1000 個 byte', '假設 block size 200：在第 5 個 block（示意）');
  },
  async (tok, S) => { // 213.2 存 start 與 length
    txt(S.t, 'directory：tr  start 14, length 3');
    cap('因為是 contiguous，要存的很簡單', 'starting point 跟長度');
  },
  async (tok, S) => { // 226.7 14 + 5 = 19
    txt(S.q, 'start + 5 = 14 + 5 = 19（示意算法）');
    S.cur = tag('▼', 'ptr alt', gp(19).x, 1.2, gp(19).z);
    cap('tr 從 14 開始：加 5 就是 19', '用算的就知道位置（公式示意）');
  },
  async (tok, S) => { // 238.5 block 編號從哪來：format 時
    cap('block 的 number 從哪來？', 'partition 給空間，format 時 file system 做 labeling');
  },
  async (tok, S) => { // 260.4 FS 選 block size
    cap('format 時 file system 可選 data block size', '所以知道 block size；file 放哪是另一回事');
  },
]);

scene('fs-24b-contigpc', 'Contiguous 的好處與 external fragmentation', TOP, [
  async (tok, S) => { // 284.6 好壞處
    diskGrid(); S.M = {};
    for (const [n, [s, l]] of Object.entries(CONTIG)) { S.M[n] = []; for (let k = 0; k < l; k++) S.M[n].push(blk(s + k, k ? '' : n, C.file)); }
    S.t = ttl('Contiguous：好處與壞處');
    cap('看它的好處跟壞處', '');
  },
  async (tok, S) => { // 292.6 找位置：用算的
    S.cur = tag('▼', 'ptr alt', gp(20).x, 1.2, gp(20).z); glow(S.M.mail[1], HL);
    cap('找任何資料的位置 effort 最小', '不用 traverse 整個 file：給 position 用算的');
  },
  async (tok, S) => { // 314.0 single I/O
    txt(S.t, '1 次 I/O request');
    cap('算出在第幾個 data block', '打一個 single I/O request 給 disk 就讀出來');
  },
  async (tok, S) => { // 320.4 seek time 最小
    glow(S.M.mail[1], null); for (const m of S.M.mail) { glow(m, OKG); await wt(tok, 150); }
    cap('seek time 最小：sequential、random 都沒差', 'sequential 知道下一個在哪；random 也直接算');
  },
  async (tok, S) => { // 344.6 directory entry 很小
    txt(S.t, 'directory entry：(start, length) 兩個 integer');
    cap('directory entry 也很小', '只要兩個值：start 與 block 數');
  },
  async (tok, S) => { // 361.0 external fragmentation
    S.M.mail.forEach((m) => glow(m, null));
    cap('trade-off：很容易有 external fragmentation', '這也很嚴重');
  },
  async (tok, S) => { // 371.6 檔案來來去去 → 碎片
    fly(S.M.f[0]); fly(S.M.f[1]); fly(S.M.list[0]); fly(S.M.list[1]); fly(S.M.list[2]); fly(S.M.list[3]);
    await wt(tok, 600);
    for (const i of [2, 3, 4, 5, 8, 9, 10, 11, 12, 13]) blk(i, '', C.other, 0, 0, 1.2);
    cap('檔案來來去去', 'fragment 越來越多：剩下的空位東一塊、西一塊');
  },
  async (tok, S) => { // 378.4 檔案增長：要整個搬走
    glow(S.M.tr[2], NG); S.x = tag('tr 要長大？後面 19 被 mail 佔了', 'ptr alt', 0, 1.0, 2.9);
    cap('更糟：檔案會增長', '用完後面的空間就長不了：要整個 file 搬到別處');
  },
  async (tok, S) => { // 403.8 disk 使用率下降
    txt(S.t, '越來越難使用 disk space：使用率下降');
    cap('越來越難使用 disk 空間', '要長時撞到別的 file：fail，或整個 copy，effort 很大');
  },
  async (tok, S) => { // 423.4 compaction（重組）
    txt(S.t, 'solution：compaction（磁碟重組）');
    cap('solution 跟 memory 管理一樣：compaction', '「硬碟整理一下」就是在處理 fragmentation');
  },
]);

scene('fs-24b-extent', 'Extent-based：contiguous + linked list', TOP, [
  async (tok, S) => { // 457.3 折中：extent-based
    diskGrid(); S.t = ttl('Extent-based file system');
    cap('不能 grow 的問題，有一個折中的 solution', 'extent-based file system');
  },
  async (tok, S) => { // 466.8 跟 linked list 結合
    cap('簡單講就是跟 linked list 結合', '基本三種做法，常會 hybrid 互補');
  },
  async (tok, S) => { // 492.5 一次 allocate 一個 extent
    S.e1 = [2, 3, 4].map((b, k) => blk(b, k + 1, C.fil, 0, 0, 1.5));
    cap('不夠時不是 allocate 一個 block', '一次給一個 extent：一組連續的 block');
  },
  async (tok, S) => { // 507.5 用完再給一個，可以在別處
    S.e2 = [12, 13, 14].map((b, k) => blk(b, k + 4, C.fil, 0, 0, 1.5));
    cap('用完不夠怎麼辦？再給一個 extent', '兩個 extent 可以在不同的地方');
  },
  async (tok, S) => { // 516.7 用 linked list 串起來
    S.e3 = [25, 26, 27].map((b, k) => blk(b, k + 7, C.fil, 0, 0, 1.5));
    S.l1 = seg(gp(4, 0.45), gp(12, 0.45), '#c08a1f'); S.l2 = seg(gp(14, 0.45), gp(25, 0.45), '#c08a1f');
    cap('然後用 linked list 把 extent 串起來', '（這裡每個 extent 3 塊，位置示意）');
  },
  async (tok, S) => { // 523.5 on-disk：extent 尾巴留 4 bytes 記下一個
    glow(S.e1[2], HL); glow(S.e2[2], HL);
    cap('別忘了這是 on-disk structure', 'extent 的尾巴留 4 bytes，記下一個 extent 的位置');
  },
  async (tok, S) => { // 547.7 extent：start、length、next
    txt(S.t, 'extent：(start, length, next)');
    cap('一個 extent 記錄：開始的 block、長度', '還有下一個 extent 在哪（沒有也要寫 null）');
  },
  async (tok, S) => { // 576.1 犧牲了什麼？
    glow(S.e1[2], null); glow(S.e2[2], null);
    cap('這樣的做法犧牲掉了什麼？', '');
  },
  async (tok, S) => { // 586.5 fixed size → internal fragmentation
    S.w = blk(5, '空', C.other, 0, 0, 1.2);
    cap('解決了 external fragment', '但 extent 固定大小時，用不完會有 internal fragmentation');
  },
  async (tok, S) => { // 608.4 犧牲 random access performance
    txt(S.t, '犧牲：random access performance');
    cap('最主要犧牲的', '是 random access 的 performance');
  },
  async (tok, S) => { // 618.3 讀第 7 個 block：在第 3 個 extent
    glow(S.e3[0], HL);
    cap('例：讀第 7 個 block，每個 extent 長 3', '第 7 個在第 3 個 extent 裡');
  },
  async (tok, S) => { // 631.0 要 traverse linked list
    S.cur = tag('讀', 'ptr alt', 0, 1, 0); cursorAt(S.cur, 4);
    cap('第 3 個 extent 在哪？', '必須 traverse linked list：把每個 extent 尾巴的資訊從 disk 讀進來');
  },
  async (tok, S) => { // 664.3 三個 I/O request
    S.n = tag('I/O 1', 'ptr alt', 4.6, 0.3, -3.3); glow(S.e1[2], HL); await wt(tok, 500);
    cursorAt(S.cur, 14); txt(S.n, 'I/O 2'); glow(S.e2[2], HL); await wt(tok, 500);
    cursorAt(S.cur, 25); txt(S.n, 'I/O 3'); glow(S.e3[0], OKG);
    cap('讀第 1 個 extent 尾巴、第 2 個 extent 尾巴', '最後才讀第 7 個 block：3 個 I/O request');
  },
  async (tok, S) => { // 676.4 多兩個 I/O
    txt(S.t, '本來 1 次 → 多了 2 次 additional I/O');
    cap('本來只要讀一次', '為了 traverse 多兩個 I/O：random 效能變差');
  },
  async (tok, S) => { // 714.2 總結
    cap('extent-based = contiguous + link', 'fixed size 時 internal、external 都還可能存在');
  },
]);

scene('fs-24b-linked', 'Linked allocation：jeep 9 → 16 → 1 → 10 → 25', TOP, [
  async (tok, S) => { // 727.6 另一個極端：全部用 link
    diskGrid(); S.t = ttl('Linked allocation');
    cap('第二個基本做法：另一個極端', '全部都用 link');
  },
  async (tok, S) => { // 741.0 每個 block 都用 link 串起來
    S.L = []; for (let k = 0; k < JEEP.length; k++) { S.L.push(blk(JEEP[k], k + 1, C.file, 0, 0, 1.5)); if (k) seg(gp(JEEP[k - 1], 0.45), gp(JEEP[k], 0.45), '#c08a1f'); await wt(tok, 150); }
    cap('標準的 linked allocation', '每一個 block 全部用 link 串起來（恐龍書 jeep）');
  },
  async (tok, S) => { // 755.2 存起始與結束
    txt(S.t, 'directory：jeep  start 9, end 25');
    cap('directory 存的很簡單：起始跟結束', '存結束：知道最後一塊的 id，不用 traverse 到底');
  },
  async (tok, S) => { // 770.5 每個 block 留幾個 byte 存下一個
    S.L.forEach((m) => glow(m, HL)); S.p = tag('每塊尾巴：next pointer', 'ptr alt', gp(16).x, 1.2, gp(16).z);
    cap('每個 block 最後 reserve 幾個 byte', '存下一個位置：所以頭只要存一個');
  },
  async (tok, S) => { // 793.9 size 沒問題：有空 block 就加
    S.L.forEach((m) => glow(m, null)); remove(S.p);
    S.n = blk(28, 6, C.free, 0, 0, 1.5); seg(gp(25, 0.45), gp(28, 0.45), '#2fc092');
    cap('好處：size 沒問題', '只要找到任何 available 的 data block 就加上去');
  },
  async (tok, S) => { // 801.0 grow / shrink 很容易
    cap('很容易 grow 或 shrink', 'free 掉的 data block 也很容易 reuse：最大的好處');
  },
  async (tok, S) => { // 816.0 sequential 還不錯
    S.cur = tag('讀', 'ptr alt', 0, 1, 0);
    for (let k = 0; k < JEEP.length; k++) { cursorAt(S.cur, JEEP[k]); glow(S.L[k], OKG); await wt(tok, 300); }
    cap('performance：sequential 其實不錯', 'sequential 就是 traverse，不會多讀');
  },
  async (tok, S) => { // 827.0 讀完 16 就把下一個 pointer 一起讀進來
    S.L.forEach((m) => glow(m, null)); cursorAt(S.cur, 16); glow(S.L[1], HL);
    cap('從頭讀：讀完 16 裡的 data', '下一個 pointer 也一起 load 進來，沒有 extra reading');
  },
  async (tok, S) => { // 848.6 random 很慘
    glow(S.L[1], null);
    for (let k = 0; k < 4; k++) { cursorAt(S.cur, JEEP[k]); glow(S.L[k], k < 3 ? NG : OKG); await wt(tok, 300); }
    cap('random 就非常慘', '要第 4 塊也得 traverse 前面：只為了拿裡面的 pointer');
  },
  async (tok, S) => { // 875.1 pointer 浪費空間
    S.L.forEach((m) => glow(m, null)); txt(S.t, '每個 block 犧牲幾個 byte 存 pointer');
    cap('另一個缺點：浪費空間存 pointer', '每個 block 都犧牲掉幾個 byte');
  },
]);

scene('fs-24b-linked2', 'Linked：cluster、reliability、配置 O(1)', TOP, [
  async (tok, S) => { // 891.8 cluster：把 block group 起來
    diskGrid(); S.t = ttl('改良：cluster（把 block group 起來）');
    S.c = {}; for (const [a, b] of [[8, 9], [20, 21], [2, 3]]) { S.c[a] = blk(a, '', C.file); S.c[b] = blk(b, '', C.file); }
    seg(gp(9, 0.45), gp(20, 0.45), '#c08a1f'); seg(gp(21, 0.45), gp(2, 0.45), '#c08a1f');
    cap('不想 traverse 那麼多、存那麼多 link？', '把很多 block cluster 在一起當一個單位（像 extent）');
  },
  async (tok, S) => { // 926.1 reliability
    txt(S.t, '另一個缺點：reliability');
    cap('link 要注意的另一個缺點', 'reliability');
  },
  async (tok, S) => { // 934.2 一個 link 斷掉，後面全沒了
    tint(S.c[20], C.bad); relabel(S.c[20], 'X'); tint(S.c[21], C.other); tint(S.c[2], C.other); tint(S.c[3], C.other);
    cap('linked list 只要一個 link 斷掉', '這整個 file 後面就全部 lost');
  },
  async (tok, S) => { // 943.3 斷電、metadata 沒修好
    cap('資料壞掉、或修改時斷電沒把 metadata 修好', '整個 file 可能就 collapse 掉');
  },
  async (tok, S) => { // 950.4 資源使用很有效率
    S.fl = tag('free list → 5 → 11 → 30 …', 'ptr alt', 0, 1.0, 2.9);
    cap('最大好處：資源使用非常有效率', '');
  },
  async (tok, S) => { // 959.1 O(1)：pop free list 最上面
    blk(5, 'new', C.free, 0, 0, 1.5); txt(S.fl, 'pop → 5（O(1)，不用 search）');
    cap('找 free 空間 order one，不用 search', 'free data block list 最上面 pop 出來就存：create 最快');
  },
]);

scene('fs-24b-fat', 'FAT32：pointer 收集成一張表、mount 時 load 進 memory', CAM, [
  async (tok, S) => { // 976.5 FAT32 用 link
    hd('FAT32（File Allocation Table）', 0, 6.9);
    S.dir = bx('directory：test → start 217', FC.blue, -4.2, 6.0, 0, 3.6, 0.5, 0.7);
    cap('真實 file system：有名的 FAT32', '其實就是用 link');
  },
  async (tok, S) => { // 992.3 要解決 random access、traversing
    cap('它怎麼避免剛才的問題？', '解決 random access 和 traversing 的 overhead：不想一個個 lookup disk');
  },
  async (tok, S) => { // 1002.5 把 pointer 收集成一張 table
    S.T = stack(0.6, 5.0, ['0', '…', '217 → 618', '…', '339 → EOF', '…', '618 → 339', '…'], { w: 2.4, dy: 0.56, c: FC.lilac, title: 'FAT' });
    cap('做法很簡單：把 linked list 的 pointer 全部收集起來', '變成 single 的 table 存起來（metadata）');
  },
  async (tok, S) => { // 1019.0 217 → 618 → 339
    S.D = [[217, 2.6, FC.orange], [618, 3.8, FC.orange], [339, 5.0, FC.orange]].map(([n, x]) => bx(String(n), FC.orange, 4.4, 5.6 - (x - 2.6) * 0.9, 0, 1.2, 0.6, 0.7));
    glow(S.T.cells[2], HL); await wt(tok, 400); glow(S.T.cells[6], HL); await wt(tok, 400); glow(S.T.cells[4], HL);
    cap('file 從 217 開始：217 指到 618', '618 存 339，339 是 EOF（恐龍書的圖）');
  },
  async (tok, S) => { // 1032.8 table 裡沒有 data content
    note('表裡只有 pointer，沒有 data', 3.6, 6.6);
    cap('這只是一個 table', '裡面沒有 data content，抽出來另外存');
  },
  async (tok, S) => { // 1043.2 mount 時整張 load 進 memory
    S.T.cells.forEach((m) => glow(m, null));
    S.m = bx('memory', FC.pink, 0.6, 0.3, 0, 3.2, 0.5, 0.8);
    await anim(tok, 900, (u) => { S.T.cells.forEach((m) => { m.position.x = 0.6 - 3.4 * u; }); S.T.lbls[0].position.x = 0.6 - 3.4 * u; });
    cap('好處：mount 時就把整個 table load 到 memory', 'pointer 比 data 小很多，sequential 一次讀進來');
  },
  async (tok, S) => { // 1070.7 random 也沒關係：在 memory lookup
    for (const i of [2, 6, 4]) { glow(S.T.cells[i], HL); await wt(tok, 250); }
    cap('就算 random access 也沒關係', '在 memory 裡 lookup：沒有 disk I/O');
  },
  async (tok, S) => { // 1082.1 找到 block ID 直接下指令：1 次
    glow(S.D[2], OKG); S.io = hot('disk I/O：1 次', 4.4, 2.0);
    cap('在 memory 找到真的 block ID，直接對 disk 下指令', 'lookup 變 1：跟 contiguous 一模一樣');
  },
  async (tok, S) => { // 1099.0 32 是 table entry 用 32 bit
    S.b32 = sm('每個 entry 32 bits', -2.8, 0.9);
    cap('為什麼叫 FAT32？', '32 指的是 table entry 用了 32 bit');
  },
  async (tok, S) => { // 1105.2 FAT64
    txt(S.b32, '每個 entry 32 bits（FAT64：64 bits）');
    cap('現在也有 FAT64', '只是位元變 64 bit，做法一樣');
  },
  async (tok, S) => { // 1121.4 fail recovery 是另一個 issue
    sm('fail recovery：另外用 log 等', 4.4, 1.2);
    cap('只要解決 random access 問題就 OK', 'fail recovery 是另一個 issue，可以用 log 等');
  },
  async (tok, S) => { // 1130.3 FAT 其實就是 cache
    good('FAT ≈ pointer 的 cache：random access 變得很快', 0, -0.4);
    cap('簡單講 FAT 就是一個 cache', '收集存在連續 block，load 到 memory：minimum seek time');
  },
  async (tok, S) => { // 1158.5 contiguous 的 FS：XFS（extent-based）
    sm('XFS：extent-based', -4.2, 5.4);
    cap('FAT32 用的是 linked', '好奇 contiguous 的話：XFS 是 extent-based，很多 OS 都 support');
  },
]);

scene('fs-24b-indexed', 'Indexed allocation：index block 直接查表', TOP, [
  async (tok, S) => { // 1192.7 index
    diskGrid(); S.t = ttl('Indexed allocation');
    cap('最後一個：index', '');
  },
  async (tok, S) => { // 1201.2 pointer 收集起來，但不用 traverse
    S.ib = blk(19, 'IB', C.idx, 0, 0, 1.5);
    cap('一樣把 pointer 收集起來', '跟 FAT 不同：沒有 traversing');
  },
  async (tok, S) => { // 1221.4 完全是 lookup
    S.dm = JEEP.map((b, k) => blk(b, k + 1, C.file, 0, 0, 1.5));
    JEEP.forEach((b) => seg(gp(19, 0.45), gp(b, 0.45), '#c08a1f'));
    S.lst = tag('[9, 16, 1, 10, 25, −1, −1, −1]', 'ptr alt', gp(19).x, 1.3, gp(19).z);
    cap('index 就完全是 lookup', '第幾個 data block 存在哪個 physical location，直接存');
  },
  async (tok, S) => { // 1231.6 找第 3 個 block：查第 3 個 entry
    glow(S.ib, HL); await wt(tok, 400); glow(S.dm[2], OKG);
    S.cur = tag('讀', 'ptr alt', 0, 1, 0); cursorAt(S.cur, 1);
    cap('要找這個 file 的第 3 個 block', '直接查表第 3 個 entry（= 1），直接去用');
  },
  async (tok, S) => { // 1240.0 index block 只存 pointer
    txt(S.t, 'index block：只存 pointer，不存檔案內容');
    cap('所有 index 存在一個 data block', '這個 block 存的不是檔案內容，只有 pointer');
  },
  async (tok, S) => { // 1258.5 data block 只有 data
    glow(S.ib, null); S.dm.forEach((m) => glow(m, OKG));
    cap('指到的 data block 裡只有 data', '完全沒有 pointer：最大的差別');
  },
  async (tok, S) => { // 1274.4 每個 file 一個 index block；FAT 是整個 FS 一張
    S.dm.forEach((m) => glow(m, null)); txt(S.t, 'index block：每個 file 一個　vs　FAT：整個 FS 一張');
    cap('index block 是每個 file 一個（獨立）', '前面的 FAT 是整個 file system 只有一張');
  },
  async (tok, S) => { // 1297.6 FAT 的其他 entry 是別的 file 的
    cap('FAT 裡其他 entry 存的是別的 file 的 pointer', '很大，連續存好幾個 data block；它還是 link 的概念');
  },
  async (tok, S) => { // 1318.1 FCB 只存 index block 的 id
    txt(S.t, 'FCB：jeep → index block 19');
    cap('FCB 只存這個 index block 的 id', '裡面才有這個 file 所有的資訊：直接 lookup');
  },
]);

// ════════ C42WzJATHg0（第 25A 講：Indexed、multi-level、inode、free space）— built-in scenes 的 cued 版 ════════
const CH10 = [9, 16, 5, 10, 25, 4, 30, 18, 27, 12];   // 10 塊的 linked 檔案（位置示意；前段取自恐龍書 jeep）
scene('fs-25a-review', '複習：Contiguous 與 Linked（讀第 5 塊要先讀前 4 塊）', TOP, [
  async (tok, S) => { // 14.4 contiguous：連續擺放
    diskGrid(); S.cm = []; for (let k = 0; k < 6; k++) S.cm.push(blk(19 + k, k + 1, C.fil, 0, 0, 1.5));
    S.t = ttl('Contiguous：mail  start 19, length 6（課本圖）');
    cap('上次第一種：contiguous', '連續擺放');
  },
  async (tok, S) => { // 17.0 sequential、random 都快
    cap('好處：sequential 或 random 讀都非常快', '');
  },
  async (tok, S) => { // 47.3 用算的知道 physical 位置
    glow(S.cm[4], HL); S.cur = tag('▼', 'ptr alt', gp(23).x, 1.2, gp(23).z);
    cap('告訴它第幾個 byte，用算的就知道 data block', '第 5 塊 = 19 + 4 = 23（示意）→ 直接對 disk 做 I/O');
  },
  async (tok, S) => { // 60.3 linked：像 linked list 串起來
    S.cm.forEach((m) => fly(m)); remove(S.cur);
    S.lm = []; for (let k = 0; k < CH10.length; k++) { S.lm.push(blk(CH10[k], k + 1, C.file, 0, 0, 1.5)); if (k) seg(gp(CH10[k - 1], 0.45), gp(CH10[k], 0.45), '#c08a1f'); }
    txt(S.t, 'Linked：10 個 block（位置示意）');
    cap('第二種：linked', '把每個 data block 像 linked list 串起來');
  },
  async (tok, S) => { // 72.0 只要有空間就能用
    cap('好處：只要有空間都可以使用', '');
  },
  async (tok, S) => { // 80.4 contiguous 的壞處：大小改變、空間破碎
    cap('contiguous 最大的壞處', '檔案大小改變或空間破碎時就放不下；linked 有空間就能用');
  },
  async (tok, S) => { // 96.1 sequential 也不錯
    cap('壞處剛好反過來：sequential 還不錯', '順著 linked list 讀');
  },
  async (tok, S) => { // 104.7 從第 5 塊開始讀：前 4 塊還得讀
    S.cur = tag('讀', 'ptr alt', 0, 1, 0); S.n = tag('', 'ptr alt', 4.2, 0.3, 2.9);
    for (let k = 0; k < 5; k++) { cursorAt(S.cur, CH10[k]); glow(S.lm[k], k < 4 ? HL : OKG); txt(S.n, 'I/O ' + (k + 1)); await wt(tok, 350); }
    cap('不從頭讀就有 overhead：從第 5 個讀到第 10 個', '前 4 個 block 還是得讀出來，才找得到第 5 個');
  },
  async (tok, S) => { // 113.7 random 更糟
    S.lm.forEach((m) => glow(m, null));
    for (let k = 0; k < 8; k++) { cursorAt(S.cur, CH10[k]); glow(S.lm[k], HL); txt(S.n, 'I/O ' + (k + 1)); await wt(tok, 150); }
    cap('random 就更糟', '跳來跳去：讀第 8 塊');
  },
  async (tok, S) => { // 119.7 甚至重複讀
    S.lm.forEach((m) => glow(m, null));
    for (let k = 0; k < 3; k++) { cursorAt(S.cur, CH10[k]); glow(S.lm[k], NG); txt(S.n, 'I/O ' + (9 + k)); await wt(tok, 250); }
    cap('甚至重複在那邊讀', '再跳回第 3 塊：又得從頭走（8 + 3 = 11 次，示意）');
  },
  async (tok, S) => { // 121.3 pointer 散落在 data block 上
    S.lm.forEach((m) => glow(m, HL));
    cap('沒效率的原因：pointer 散落在 disk 的 data block 上', '每讀出一個 pointer，就是一次 I/O');
  },
]);

scene('fs-25a-fat', 'FAT：pointer 收集起來、mount 時載入 memory', [[0.6, 9.5, 8.2], [0.6, 0, 0.5]], [
  async (tok, S) => { // 143.9 還是有被採用：有解法
    const ox = -1.6; diskGrid(32, ox); S.lm = CH10.map((b, k) => blk(b, k + 1, C.file, ox));
    cap('這種方式還是有被採用', '解決 random 時很多 I/O request 的方法其實有');
  },
  async (tok, S) => { // 150.0 把 pointer 全部收集起來
    S.tbl = code(['FAT', ...CH10.map((b, k) => 'FAT[' + String(b).padStart(2) + '] = ' + (k < 9 ? CH10[k + 1] : 'EOF'))], 5.4, 3.8, 0.4);
    cap('而且很單純：把 pointer 全部收集起來', '只留 pointer 的 information');
  },
  async (tok, S) => { // 159.5 存在前面幾個 block
    S.f0 = blk(0, 'FAT', C.fat, -1.6, 0, 1.5); S.f1 = blk(1, 'FAT', C.fat, -1.6, 0, 1.5);
    cap('存在前面的幾個 data block', '');
  },
  async (tok, S) => { // 168.1 mount 時 load 到 memory
    S.mem = cube('memory', C.mem, [3.6, 0.3, 1.2], 5.4, 3.0, 3.2);
    cap('mount 這個 file system 時', '就把它 load 到 memory');
  },
  async (tok, S) => { // 173.4 traversing 還在，但在 memory
    for (let k = 1; k <= 8; k++) { S.tbl.hl(k); await wt(tok, 200); }
    cap('traversing 這個動作還是有', '但在 memory 裡：不需要一直做 I/O');
  },
  async (tok, S) => { // 192.5 linked list 也可以很 efficient
    S.cur = tag('讀', 'ptr alt', 0, 1, 0); cursorAt(S.cur, CH10[7], -1.6); glow(S.lm[7], OKG);
    cap('這樣 linked list 也可以很 efficient', '讀第 8 塊：只要 1 次 disk I/O');
  },
  async (tok, S) => { // 202.3 考試要留意
    S.x = tag('考試說 linked list：通常指傳統版', 'ptr alt', -1.6, 0.3, -3.3);
    cap('但這已經不是傳統的 linked list', '考試問 linked list 要留意');
  },
  async (tok, S) => { // 210.2 FAT32 是改善版
    txt(S.x, 'FAT32 / FAT64：改善版（pointer 收集 + load 到 memory）');
    cap('FAT32 不是傳統的 link，是改善版', '傳統的 random 是問題');
  },
]);

scene('fs-25a-indexed', 'Indexed allocation：index block 19', TOP, [
  async (tok, S) => { // 227.5 第三個做法：index
    diskGrid(); S.t = ttl('Indexed allocation');
    cap('第三個做法：index', '');
  },
  async (tok, S) => { // 234.2 不是 linked list，是 direct access 的概念
    cap('一樣有 pointer，但不是 linked list', '而是 direct access 的概念');
  },
  async (tok, S) => { // 247.0 存在一起的 block：index block
    S.ib = blk(19, 'IB', C.idx, 0, 0, 1.5);
    S.lst = tag('[9, 16, 1, 10, 25, −1, −1, −1]', 'ptr alt', gp(19).x, 1.3, gp(19).z);
    cap('pointer 一定存在一起：index block', 'pointer 也要存在 disk 上的一個 block（恐龍書：19）');
  },
  async (tok, S) => { // 269.0 其他是 data block
    S.dm = JEEP.map((b, k) => blk(b, k + 1, C.file, 0, 0, 1.5)); JEEP.forEach((b) => seg(gp(19, 0.45), gp(b, 0.45), '#c08a1f'));
    cap('其他被指到的就是 data block', '');
  },
  async (tok, S) => { // 275.5 directory：檔名 + 指向 index block 的 pointer
    txt(S.t, 'directory：jeep → index block 19');
    cap('directory 存檔名和一個 pointer', '指到 index block 在哪');
  },
  async (tok, S) => { // 286.4 讀 index block，找 entry，直接 access
    S.cur = tag('讀', 'ptr alt', 0, 1, 0); cursorAt(S.cur, 19); glow(S.ib, HL); await wt(tok, 700);
    cursorAt(S.cur, 10); glow(S.dm[3], OKG);
    cap('把 index block 讀出來，看是第幾個 block', '例：第 4 格 = 10 → 直接 access block 10（示意）');
  },
  async (tok, S) => { // 304.3 這就是 index
    cap('這就是 indexed allocation', '把所有 pointer bring together，放在 special 的 index block');
  },
  async (tok, S) => { // 320.6 random、sequential 都有效率
    good('random、sequential 都一次就找到位置', 0, 1.0, 2.9);
    cap('random access 變得非常 efficient', 'sequential 也一樣，一次就找到位置');
  },
  async (tok, S) => { // 333.4 沒有 external fragmentation
    cap('也沒有 external fragmentation', '只要有空的位置都可以用，跟 linked 一樣');
  },
  async (tok, S) => { // 340.3 有 free list 就容易 create / extend
    cap('很容易 create file', '有 free list 知道哪些 block available，就能 extend 或 create');
  },
  async (tok, S) => { // 356.7 缺點：pointer
    glow(S.ib, null); S.dm.forEach((m) => glow(m, null));
    cap('缺點一樣是 pointer', '');
  },
  async (tok, S) => { // 364.3 要浪費一個 index block
    glow(S.ib, NG);
    cap('存 pointer 要浪費掉一整個 index block', '');
  },
  async (tok, S) => { // 370.6 linked 每塊只浪費 4 bytes
    cap('傳統 linked：每個 data block 只浪費 4 個 byte', '');
  },
  async (tok, S) => { // 390.1 小檔案只有 2 個 block → 8 bytes
    fresh([0, 5, 10], [0, 1, 0]);
    S.sl = []; for (let i = 0; i < 128; i++) S.sl.push(cube('', i < 2 ? C.idx : GRAY, [0.16, i < 2 ? 0.5 : 0.15, 0.4], -6.1 + (i % 64) * 0.19, i < 2 ? 0.25 : 0.08, -0.4 + Math.floor(i / 64) * 0.6));
    tag('只用 2 格（8B）', 'ptr alt', -5.6, 1.2, -0.4);
    cap('例如 file 很小：只有 2 個 data block', '只要 2 個 entry = 8 bytes 就好');
  },
  async (tok, S) => { // 406.9 index block 512 bytes
    tag('index block 512 bytes = 128 格 × 4B', 'ptr', 0, 0.3, 1.4);
    cap('但假設 index block 是 512 bytes', '還是得 allocate 一整個 512 bytes 的 index block');
  },
  async (tok, S) => { // 416.5 浪費比 linked 更嚴重
    for (let i = 2; i < 128; i++) glow(S.sl[i], NG);
    cap('剩下 504 bytes 都浪費：比 linked 更嚴重', 'index 跟 data 完全切開');
  },
]);

scene('fs-25a-linkidx', '檔案太大：Linked index scheme', [[0, 6, 11], [0, 1, 0]], [
  async (tok, S) => { // 431.9 另一個要克服的
    S.ib = cube('IB 19', C.idx, [2.6, 0.5, 1.2], -4.4, 0.25, -1, 3);
    cap('index block 還要克服另一件事', '檔案小會浪費；那檔案非常大呢？');
  },
  async (tok, S) => { // 446.1 pointer 多到超過一個 block
    for (let d = 0; d < 5; d++) cube('', C.file, [0.4, 0.3, 0.4], -5.4 + d * 0.5, 0.15, 1.2);
    cap('要存的 pointer 數量變很多', '多到可能超過一個 data block 能存的');
  },
  async (tok, S) => { // 455.3 512B ÷ 4B = 128
    S.n = tag('512B ÷ 4B = 128 個 pointer', 'ptr alt', -4.4, 1.0, -1);
    cap('block 512 bytes、一個 pointer 4 bytes', '超過 128 個 data block，一個 index block 就存不下');
  },
  async (tok, S) => { // 470.9 需要多個 index block
    cap('就需要多個 index block', '怎麼做 extension？');
  },
  async (tok, S) => { // 482.5 三種做法
    hd('三種解法', 2.6, 3.4);
    cap('有三種不一樣的方式解決', '');
  },
  async (tok, S) => { // 492.4 linked index scheme
    note('① linked index scheme', 2.6, 2.7);
    cap('第一個做法：linked index scheme', '');
  },
  async (tok, S) => { // 497.9 名字要留意
    cap('名字都用 linking、indexing，要留意', '它還是 index 的做法，只是用 link 解決 index block 不夠大');
  },
  async (tok, S) => { // 524.9 19 是第一個 index block
    glow(S.ib, HL);
    cap('一開始只有一個 index block：19', '裡面指到一個一個 data block');
  },
  async (tok, S) => { // 533.8 檔案長大：新的 index block
    glow(S.ib, null); S.ib2 = cube('IB #2', C.idx, [2.6, 0.5, 1.2], 0, 0.25, -1, 3);
    for (let d = 0; d < 5; d++) cube('', C.file, [0.4, 0.3, 0.4], -1 + d * 0.5, 0.15, 1.2);
    cap('檔案長得超過這個 size 怎麼辦？', 'create 一個新的 index block 存它的 pointer');
  },
  async (tok, S) => { // 551.7 index block 之間留 pointer
    seg(V3(-3.1, 0.3, -1), V3(-1.3, 0.3, -1), '#d64545'); tag('最後一格 → 下一個 index block', 'ptr alt', -2.2, 1.0, -1); remove(S.n);
    cap('兩個要連在一起：index block 之間留 pointer', '用 linked list 把 index block 串起來');
  },
  async (tok, S) => { // 572.9 本質是 index
    cap('linked index scheme', '其實是 index 的做法，只是把 index block 用 link 串起來');
  },
  async (tok, S) => { // 584.6 一直長就一直 create
    S.ib3 = cube('IB #3', C.idx, [2.6, 0.5, 1.2], 4.4, 0.25, -1, 3); seg(V3(1.3, 0.3, -1), V3(3.1, 0.3, -1), '#d64545');
    for (let d = 0; d < 5; d++) cube('', C.file, [0.4, 0.3, 0.4], 3.4 + d * 0.5, 0.15, 1.2);
    cap('file 一直漲就一直 create index block', '相對地 create 這些 link');
  },
  async (tok, S) => { // 592.1 random 跳到很遠：lookup 好幾個 index block
    S.cur = tag('lookup', 'ptr alt', 0, 1.2, -1);
    for (const [j, m] of [S.ib, S.ib2, S.ib3].entries()) { S.cur.position.set(-4.4 + j * 4.4, 1.2, -1); glow(m, HL); await wt(tok, 500); }
    cap('random access 跳到很遠的地方', '檔案越大越慢：要 look up 好幾個 index block');
  },
]);

scene('fs-25a-multilevel', 'Multi-level index：16 → 19 → data', [[0, 6, 12], [0, 1.6, 0]], [
  async (tok, S) => { // 612.3 第二種做法
    cap('第二種做法', '');
  },
  async (tok, S) => { // 621.7 跟 page table 一樣
    hd('multi-level（hierarchical）index', 0, 5.0);
    cap('非常像 memory 管理學過的做法', 'multi-level、hierarchical：跟 page table 的延伸一樣');
  },
  async (tok, S) => { // 635.3 一開始一個 index block
    S.outer = cube('16', C.idx, [1.6, 0.5, 1], -5, 0.25, 0, 2); tag('outer index', 'ptr', -5, 1.0, 0);
    cap('一開始當然只有一個 index block', '裡面存一些 pointer');
  },
  async (tok, S) => { // 646.8 pointer 指到的是 index block
    S.inner = [];
    for (let j = 0; j < 4; j++) { const z = -2.4 + j * 1.6; S.inner.push(cube(j === 0 ? '19' : '…', C.idx, [1.4, 0.45, 0.9], -1.2, 0.23, z, 2)); seg(V3(-4.2, 0.3, 0), V3(-1.9, 0.3, z), '#c08a1f'); }
    cap('但這是 hierarchy', '每個 pointer 指到的不是 data block，而是 index block');
  },
  async (tok, S) => { // 656.4 2 level、3 level 都可以
    cap('這是 2 level', '要加 3 level 等等都可以');
  },
  async (tok, S) => { // 660.1 16 → 19 → data
    for (let j = 0; j < 4; j++) { const z = -2.4 + j * 1.6; for (let d = 0; d < 3; d++) cube('', C.file, [0.9, 0.3, 0.6], 2 + d * 1.5, 0.15, z); seg(V3(-0.5, 0.3, z), V3(1.55, 0.3, z), '#8a7a60'); }
    glow(S.outer, HL); await wt(tok, 300); glow(S.inner[0], HL);
    cap('16 指到的 index block 裡，第一個寫 19', '19 指到的 block 裡還是 index，最後才是真正的 data');
  },
  async (tok, S) => { // 679.1 最大好處？
    glow(S.outer, null); glow(S.inner[0], null);
    cap('這個做法最大的好處是什麼？', '');
  },
  async (tok, S) => { // 699.5 linked index：10 個 index → lookup 10 次
    fresh([0, 6, 12], [0, 2, 0]);
    tag('要 lookup 的 index block 數', 'ptr', 0, 0.2, 2.6);
    S.a = []; for (let i = 0; i < 10; i++) { const x = -5.4 + i * 1.2; const a = cube(String(i + 1), C.bad, [0.45, 1, 0.45], x - 0.25, 0.5, 0); a.scale.y = (i + 1) * 0.45; a.position.y = a.scale.y / 2; S.a.push(a); await wt(tok, 80); }
    cap('前面的做法：檔案很大要 random 到尾巴', '有 10 個 index block 就要 lookup 10 次（紅）');
  },
  async (tok, S) => { // 709.3 前面快、後面慢
    cap('讀寫速度很不平均', '檔案前面很快、後面很慢');
  },
  async (tok, S) => { // 714.9 multi-level：直接跳下去
    for (let i = 0; i < 10; i++) { const x = -5.4 + i * 1.2; const b = cube('', C.free, [0.45, 1, 0.45], x + 0.25, 0.45, 0); b.scale.y = 0.9; b.position.y = 0.45; }
    cap('multi-level：很後面也直接跳下去', '前面後面速度差不多（綠，2 層）');
  },
  async (tok, S) => { // 737.7 系統比較 prefer
    cap('平均、穩定', '對系統效能管理、使用者來講通常比較 prefer');
  },
  async (tok, S) => { // 741.8 缺點：浪費空間
    bad('hierarchy：浪費 space 較嚴重', 0, 4.6);
    cap('缺點：浪費 space 比較嚴重', '因為 hierarchy，指數成長');
  },
  async (tok, S) => { // 757.1 很大的檔案適合；medium 用 linked
    cap('檔案非常大時適合 hierarchy', 'medium size 可能適合前面的 linked 做法');
  },
  async (tok, S) => { // 784.1 只有 leaf 是 data block pointer
    note('只有 leaf node 才是 data block 的 pointer', 0, 3.8);
    cap('記得：只有 leaf node', '才是那些 data block 的 pointer');
  },
]);

scene('fs-25a-inode', 'UNIX inode：12 direct + single / double / triple indirect', [[0, 9, 9], [0, 0, 0.2]], [
  async (tok, S) => { // 794.5 combined：UNIX inode 的預設
    S.sv = { ...IN }; Object.assign(IN, { bs: 4, ps: 4, nd: 12 });
    S.I = buildInode(false); Object.assign(IN, S.sv);
    cap('最後一個：combined', '也是 UNIX inode 的 default 做法');
  },
  async (tok, S) => { // 802.7 檔案大用多層，小用一兩層
    cap('用 multi-level，但依檔案大小', '很大就用很多 level；很小用 one / two level 就夠');
  },
  async (tok, S) => { // 819.0 像 Intel page table 4MB / 4KB
    cap('跟 memory 很接近', 'Intel page table 可用 4MB 或 4KB 的 page：一樣是折中 option');
  },
  async (tok, S) => { // 840.9 inode 存 data block 在哪
    cap('inode 存這個 file 的 information', '很重要的就是它的 data block 到底在哪');
  },
  async (tok, S) => { // 850.7 direct blocks
    for (let i = 0; i < 12; i++) { glow(S.I.slots[i].m, HL); await wt(tok, 60); }
    cap('檔案很小時最好直接指到', 'direct blocks：這裡直接存 data block 的 pointer');
  },
  async (tok, S) => { // 874.1 inode 大小有限
    cap('inode 也只是一個 data structure', '它的 size 一定是有限的');
  },
  async (tok, S) => { // 886.3 block 4KB：一個 entry 指 4KB
    S.c0 = tag('每格 → 1 個 block = 4KB', 'ptr alt', -3.0, 0.2, -3.6);
    cap('每個 entry 只能指到一個 data block', '假設 block 4KB：一個 entry 只能指 4KB');
  },
  async (tok, S) => { // 896.0 就算一千個 entry 也只到 4MB
    txt(S.c0, '只靠 direct：1024 格 × 4KB 也才 4MB');
    cap('就算有一千個 entry', '整個 file 最大也只到 4MB：太小，塞不下');
  },
  async (tok, S) => { // 909.3 single indirect
    glow(S.I.slots[12].m, HL); S.i1 = cube('IB', C.idx, [1.1, 0.4, 0.9], -1.9, 0.2, S.I.slots[12].z * 0.5, 2);
    seg(V3(-4.75, 0.25, S.I.slots[12].z), V3(-2.45, 0.25, S.I.slots[12].z * 0.5), '#c08a1f');
    txt(S.c0, 'single indirect：多一層 index block');
    cap('塞不下就用 multi-level：single indirect', '這個 pointer 指到的不是 data，而是 index block');
  },
  async (tok, S) => { // 931.1 4KB ÷ 4B = 1024 個 entry
    txt(S.c0, '4KB ÷ 4B = 1024 格（約一千）× 4KB = 4MB');
    cap('block 4KB、pointer 4 bytes', '一個 index block 存 1024（約一千）個 entry，各乘 4KB');
  },
  async (tok, S) => { // 953.0 超過 4MB：double
    glow(S.I.slots[13].m, HL);
    for (let j = 0; j < 2; j++) cube('', C.idx, [1.1, 0.4, 0.9], -1.9 + j * 2.3, 0.2, S.I.slots[13].z * 0.5, 2);
    txt(S.c0, 'double indirect：two level → 1024² × 4KB = 4GB');
    cap('超過四個 MB 還不夠，就用 double', 'two level：看從哪個 pointer 開始找，就知道值是 data 還是 index');
  },
  async (tok, S) => { // 987.4 triple
    glow(S.I.slots[14].m, HL);
    for (let j = 0; j < 3; j++) cube('', C.idx, [1.1, 0.4, 0.9], -1.9 + j * 2.3, 0.2, S.I.slots[14].z * 0.5, 2);
    txt(S.c0, 'triple indirect：1024³ × 4KB = 4TB');
    cap('以此類推到 triple', '可存的檔案大小又更大');
  },
  async (tok, S) => { // 998.5 好處：performance
    for (let i = 0; i < 15; i++) glow(S.I.slots[i].m, i < 12 ? OKG : null);
    cap('combined 最大好處在 performance', '小檔案大家都喜歡 direct：一次 lookup 就找到');
  },
  async (tok, S) => { // 1014.1 越後面 level 越多，I/O 越多
    txt(S.c0, 'lookup：direct 1、single 2、double 3、triple 4（含 data）');
    cap('越後面就是 multi-level 的缺點', '幾個 level 就要 lookup 幾次：I/O 次數變多');
  },
  async (tok, S) => { // 1023.3 size trade-off：12 × 4KB = 48KB
    S.cap = [tag('48KB', 'ptr alt', -3.6, 0.2, S.I.slots[5].z)];
    txt(S.c0, 'direct：12 × 4KB = 48KB');
    cap('trade-off 是 size：這裡有 12 個 entry', '每個 4KB → 只能到 48KB，很小的檔案');
  },
  async (tok, S) => { // 1042.3 single：再多 4MB
    S.cap.push(tag('+4MB', 'ptr alt', -3.6, 0.2, S.I.slots[12].z));
    txt(S.c0, '48KB + 4MB 以內：只用前兩部分');
    cap('超過就用 single indirect：光這裡就 4MB', '總共還要加上 48KB');
  },
  async (tok, S) => { // 1062.3 double 4GB、triple 4TB
    S.cap.push(tag('+4GB', 'ptr alt', -3.6, 0.2, S.I.slots[13].z)); S.cap.push(tag('+4TB', 'ptr alt', -3.6, 0.2, S.I.slots[14].z));
    txt(S.c0, '最大 = 48KB + 4MB + 4GB + 4TB');
    cap('再不夠長到 4GB', '最後一層就是 4TB：整顆 disk 也才 TB 級');
  },
  async (tok, S) => { // 1080.0 還是有極限；作業會用到
    cap('當然還是有極限：真的非常大時要改寫', '最後一個作業會用到這樣的概念：自己 manage data structure');
  },
]);

scene('fs-25a-freekinds', 'Free-space management：就是三種配置方式', TOP, [
  async (tok, S) => { // 1112.8 free space management
    diskGrid(); for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) blk(i, '', C.other);
    S.t = ttl('Free-space management');
    cap('最後：free space 的 management', '要知道剩餘空間在哪，才能做 allocation');
  },
  async (tok, S) => { // 1129.5 四種
    cap('做法可以分成四種', '後面三個名字看起來不一樣，其實不用特別看');
  },
  async (tok, S) => { // 1144.3 linked list = linked allocation
    S.L = []; for (let k = 1; k < FREE0.length; k++) S.L.push(seg(gp(FREE0[k - 1], 0.15), gp(FREE0[k], 0.15), '#2fc092'));
    S.h = tag('head', 'ptr alt', gp(2).x, 0.9, gp(2).z);
    txt(S.t, 'Linked list = linked allocation');
    cap('linked list 就是 linked allocation', '每個空塊存下一個空塊');
  },
  async (tok, S) => { // 1146.2 grouping = linked index
    S.L.forEach(kill); remove(S.h);
    S.g = tag('block 2 存：3,4,5,8,9,10,11,12,13 → 下一組', 'ptr alt', 0, 0.9, 2.9);
    txt(S.t, 'Grouping = linked index');
    cap('grouping 指的就是 linked index 的做法', '第一個空塊存 n 個空塊的位址（課本）');
  },
  async (tok, S) => { // 1149.8 counting = contiguous
    txt(S.g, '(2,4) (8,6) (17,2) (25,3)'); txt(S.t, 'Counting = contiguous');
    cap('counting 指的就是 contiguous 的做法', '記 (起點, 連續幾塊)');
  },
  async (tok, S) => { // 1154.7 把 free space 想成一個 file：只要 sequential
    txt(S.t, 'free space = 一個只要 sequential access 的 file');
    cap('把 free space 想成一個 file，全部串起來', '只需要 support sequential：每次拿第一個有空的');
  },
  async (tok, S) => { // 1188.5 名字不用背
    cap('名字不一樣，課本描述的就是這三種做法', '不用刻意背名字，知道做法就好');
  },
  async (tok, S) => { // 1198.5 唯一特別：bit vector
    txt(S.t, '唯一特別：bit vector（不串起來，只用 bit 判斷）');
    cap('唯一比較特別的：bit vector', '不串起來，只用 bit 判斷有沒有空');
  },
]);

scene('fs-25a-bitvec', 'Bit vector：一個 block 一個 bit', TOP, [
  async (tok, S) => { // 1223.8 partition 的 data block
    diskGrid(); S.ms = {}; for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) S.ms[i] = blk(i, '', C.other);
    S.t = ttl('Bit vector');
    cap('把整個 partition 的空間', '一個 file system 管一個 partition 的 data block');
  },
  async (tok, S) => { // 1240.5 一個 bit 表示有沒有空
    S.bl = []; for (let i = 0; i < 32; i++) { const p = gp(i, 0.6); S.bl.push(tag('?', 'idx', p.x + 0.2, 0.6, p.z - 0.15)); }
    cap('每個 block 只要知道有沒有用到', '用一個 bit 表示：多少 block 就多少 bit');
  },
  async (tok, S) => { // 1249.6 0 = free、1 = occupied
    for (let i = 0; i < 32; i++) { txt(S.bl[i], FREE0.includes(i) ? '0' : '1'); S.bl[i].element.className = 'lab-label ' + (FREE0.includes(i) ? 'ptr alt' : 'idx'); }
    let s = ''; for (let i = 0; i < 32; i++) { s += FREE0.includes(i) ? 0 : 1; if (i % 8 === 7 && i < 31) s += ' '; }
    S.str = tag(s, '', 0, 0.3, 2.9); Object.assign(S.str.element.style, MONO);
    cap('周老師：0 當作 free、1 是 occupied', '（恐龍書慣例相反：1 = free）');
  },
  async (tok, S) => { // 1257.0 找 0 就能配置
    for (const i of FREE0) { const m = blk(i, '', C.free); S.ms[i] = m; }
    cap('只要找 0 的', '就知道哪些可以做 allocation');
  },
  async (tok, S) => { // 1278.0 一次看到很多個
    cap('不把它當 file 串起來，只是 0101', '可以 exactly 知道哪些是空的，一次看到很多個');
  },
  async (tok, S) => { // 1283.1 好處：簡單
    txt(S.t, '好處：簡單');
    cap('好處第一個：很簡單', '0101');
  },
  async (tok, S) => { // 1288.0 判斷比 traverse 快
    cap('判斷也比較快', '比 traverse link 再判斷數字快：hardware 對 bit 的 logic 更簡單');
  },
  async (tok, S) => { // 1305.3 一次讀 64 / 32 bits
    for (let r = 0; r < 4; r++) { for (let c = 0; c < 8; c++) { const i = r * 8 + c; glow(S.ms[i], HL); } await wt(tok, 300); for (let c = 0; c < 8; c++) glow(S.ms[r * 8 + c], null); }
    cap('一次可以讀 64 或 32 個 bit', '處理速度比較快');
  },
  async (tok, S) => { // 1315.5 缺點：partition 非常大
    txt(S.t, '缺點：partition 很大 → bit 很多');
    cap('缺點：partition 長得非常大時', '硬碟越來越大，bit 數量也越來越多');
  },
  async (tok, S) => { // 1328.3 超過 CPU cache 就 slow down
    S.ex = tag('（課本例）1TB ÷ 4KB = 2²⁸ 塊 → 2²⁸ bits = 32MB', 'ptr alt', 0, 1.0, 3.5);
    cap('多到超過 CPU cache 大小', '就可能開始 slow down，發揮不了優勢');
  },
]);

scene('fs-25a-nearest', '為什麼要知道所有 free block：連續的 0、最近的空位', TOP, [
  async (tok, S) => { // 1347.0 為什麼要一次知道所有 0？
    diskGrid(); for (let i = 0; i < 32; i++) if (!FREE0.includes(i)) blk(i, '', C.other);
    for (let i = 0; i < 32; i++) { const p = gp(i, 0.6); tag(FREE0.includes(i) ? '0' : '1', FREE0.includes(i) ? 'ptr alt' : 'idx', p.x + 0.2, 0.6, p.z - 0.15); }
    S.t = ttl('為什麼要知道所有 0 的位置？');
    cap('不是隨便找一個有空的位置就好嗎？', '為什麼要一次知道所有 0 的位置');
  },
  async (tok, S) => { // 1360.3 contiguous 要連續的 0
    S.cur = tag('▼', 'ptr alt', 0, 1, 0); let run = 0, hit = -1;
    for (let i = 0; i < 32; i++) { cursorAt(S.cur, i); run = FREE0.includes(i) ? run + 1 : 0; await wt(tok, 60); if (run === 6) { hit = i; break; } }
    for (let k = hit - 5; k <= hit; k++) blk(k, '', C.free, 0, 0, 1.5);
    txt(S.t, '連續 6 個 0：block 8–13（示意）');
    cap('contiguous 不能隨便找，要連續的 0', 'bit vector 一次就找出有幾個連續的 0');
  },
  async (tok, S) => { // 1383.8 linked 也希望放近一點
    cap('linked list 雖然可以隨便擺', '但擺近一點、連續在一起，磁頭移動還是會減少');
  },
  async (tok, S) => { // 1400.6 同一個 file 放在相近的位置
    cap('不管什麼做法', '都希望同一個 file 放在相近的 physical location');
  },
  async (tok, S) => { // 1410.8 要知道哪些臨近有空位
    S.tg = tag('目標附近有哪些空位？', 'ptr', gp(20).x, 1.4, gp(20).z);
    cap('要知道哪些臨近的有空位', '不是一個 linked list 就能解決：要有 0101');
  },
  async (tok, S) => { // 1424.0 load 一塊範圍
    for (let d = 0; d <= 3; d++) for (const i of [20 - d, 20 + d]) { cursorAt(S.cur, i); await wt(tok, 120); }
    cap('可以 load 某一塊範圍', '看範圍內哪裡有空：做更好的判斷、選更近的位置');
  },
  async (tok, S) => { // 1442.8 linked list 很少直接用
    cap('linked list 那三種做法', '實際 file system code 很少直接這樣用：會切段、做類似 binary search');
  },
  async (tok, S) => { // 1469.4 給 position，回傳最近的 0
    txt(S.tg, '目標位置 20：最近、至少 2 塊的空位？');
    cap('file system 常要：給一個 position', '很快 return 離它最近的 0 在哪');
  },
  async (tok, S) => { // 1482.0 再加：大小至少某個 size
    blk(17, '', C.idx, 0, 0, 1.5); blk(18, '', C.idx, 0, 0, 1.5);
    cap('甚至多一個 condition：最近而且至少某個 size', '這裡：17–18（示意）');
  },
  async (tok, S) => { // 1497.2 其他做法要改，bit vector 不用
    txt(S.t, 'bit vector 不用修改就能回答');
    cap('加這兩個 condition，前面那些做法都要改', 'bit vector 不用修改，很容易判斷');
  },
]);

scene('fs-25a-summary', '考試重點：算 I/O 次數；FS 就是兩層 mapping', [[0, 5.5, 12], [0, 2, 0]], [
  async (tok, S) => { // 1515.4 圖：linked list、grouping、counting
    hd('Linked list ／ Grouping ／ Counting：跟之前一樣', 0, 5.6);
    cap('圖稍微看一下就好', 'linked list、grouping、counting 就是之前那幾種管理方式');
  },
  async (tok, S) => { // 1529.5 章節後半很重要
    cap('這章後半段很重要', 'allocation 的方式一定要知道怎麼運作');
  },
  async (tok, S) => { // 1545.2 不同 I/O pattern 產生多少 I/O request
    cap('還要思考不同的 allocation 方式', '對不同 I/O pattern 會產生多少 I/O request');
  },
  async (tok, S) => { // 1561.0 10 個 block 的檔案，讀第 10 塊第 3 byte
    note('檔案 10 個 block，讀第 10 個 block 的第 3 個 byte：幾次 I/O？', 0, 4.8);
    const items = [['Contiguous', 1, 'start + 9'], ['Linked', 10, '前 9 塊都要讀'], ['FAT（在 memory）', 1, '查表免 I/O'], ['Indexed', 2, 'index + data']];
    for (let i = 0; i < items.length; i++) {
      const [n, v, why] = items[i]; const x = -4.5 + i * 3;
      const b = cube(String(v), i === 1 ? C.bad : C.free, [1.2, 1, 1.2], x, 0, 0); b.scale.y = 0.01;
      tag(n, 'ptr', x, 0.1, 1.4); tag(why, 'idx', x, 0.1, 2.0);
      await anim(tok, 400, (t) => { b.scale.y = Math.max(0.01, v * 0.35 * t); b.position.y = b.scale.y / 2; });
    }
    sm('（示意：假設 FCB 已在 memory、index block 不在 memory）', 0, 0.1, 2.6);
    cap('例：檔案大小 10 個 block，讀第 10 塊的第 3 個 byte', '用各種方式串起來，各要幾次 I/O？');
  },
  async (tok, S) => { // 1585.7 名字很像要分清楚
    cap('這些名字有些類似', 'linked、linked index、multi-level……要分清楚');
  },
  async (tok, S) => { // 1599.8 FS 最重要：path → inode
    good('① file path → inode（FCB）', -2.4, 6.4);
    cap('file system 最重要的就是 mapping', '第一：namespace，一個 file path 對到 inode（FCB）');
  },
  async (tok, S) => { // 1619.5 FCB → physical location
    good('② FCB 裡的 location → physical location', 2.4, 6.4);
    cap('第二：FCB 裡存的 file location', '怎麼 map 到 physical location：就是這兩塊');
  },
]);

// ════════ pb0dALUBDm8（第 25B 講：Mass Storage — disk structure、CLV / CAV、access time） ════════
// a platter face-on at (cx, cy): tracks + sector boundaries; perTrack(r) = sectors on that track
function platter(cx, cy, radii, perTrack, color = '#8a7a60') {
  const o = { rings: radii.map((r) => ring(cx, cy, r, color)), ticks: [] };
  radii.forEach((r, k) => { const n = perTrack(k); const r0 = k ? radii[k - 1] : r - 0.5; for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n; o.ticks.push(line(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), cx + r * Math.cos(a), cy + r * Math.sin(a), 0.04, '#b8a888')); } });
  o.hub = cube('', FC.dark, [0.5, 0.5, 0.3], cx, cy, 0);
  return o;
}
scene('fs-25b-intro', 'Mass storage：file system 底下的 physical device', CAM, [
  async (tok, S) => { // 17.0 越走越底層：storage
    S.fs = bx('file system：管 logical 的 file', FC.blue, 0, 5.8, 0, 5.0, 0.7, 0.9);
    S.st = bx('storage system', FC.dark, 0, 4.4, 0, 5.0, 0.7, 0.9);
    cap('file system 講完，越走越底層', 'file system 下面用到的就是 storage');
  },
  async (tok, S) => { // 21.2 physical device 的 management
    sm('更 low level：physical storage device 的 management', 0, 3.7);
    cap('storage system', '指更 low level：physical storage device 的管理');
  },
  async (tok, S) => { // 42.7 Mass：多個 disk 拼出更好的系統
    S.ds = [0, 1, 2, 3].map((i) => prop('disk', -3.6 + i * 2.4, 0.6, 0, 0.8));
    cap('為什麼叫 mass storage？', '後面會介紹多個 disk 拼出更 reliable、更快的 storage system');
  },
  async (tok, S) => { // 66.3 hardware + software 兜起來
    good('現有 hardware + software 管理 → 更強、更便宜', 0, 2.4);
    cap('hardware 有在 improve', '但更多是靠現有硬體兜起來，用 software 管理：software 非常重要');
  },
  async (tok, S) => { // 86.3 先講 disk
    glow(S.ds[0].children[0], HL);
    cap('這裡只講 disk', '目前最 popular、最常見的 storage');
  },
  async (tok, S) => { // 99.0 SSD、Flash
    S.ssd = bx('SSD / Flash', FC.teal, 5.4, 1.2, 0, 2.0, 0.5, 0.8);
    cap('現在也有很多有趣的 device', '像 SSD、Flash');
  },
  async (tok, S) => { // 107.4 hard drive 構造
    note('① hard drive 構造', -4.6, 6.6);
    cap('先從最基本的 hard drive 構造開始', '');
  },
  async (tok, S) => { // 117.1 disk scheduling
    note('② disk scheduling：讀寫頭怎麼移動', -4.6, 6.0);
    cap('再介紹 disk scheduling', '讀寫頭移動的方法');
  },
  async (tok, S) => { // 122.6 RAID
    note('③ RAID', 4.6, 6.6);
    cap('最後是 RAID：非常重要', '店裡買得到的 RAID system，上完就有概念');
  },
]);

scene('fs-25b-structure', 'Disk structure：block → sector，編號要連續', CAM, [
  async (tok, S) => { // 137.2 disk structure
    S.d = prop('disk', -5.4, 0, 0, 1.2, 'hard drive');
    cap('首先講 disk 的 structure', '以 hard drive 當例子');
  },
  async (tok, S) => { // 149.3 切成 block（logical）
    S.b = [0, 1, 2].map((i) => bx('block ' + i, FC.blue, -5.4 + i * 1.5, 4.8, 0, 1.3, 0.6, 0.7));
    cap('disk 切成 block', '接續 file system：最後就是讀這些 block（logical 的 operation）');
  },
  async (tok, S) => { // 160.3 block map 到 sector
    S.s = []; for (let i = 0; i < 6; i++) S.s.push(bx('', FC.tan, -5.6 + i * 0.75, 3.6, 0, 0.65, 0.45, 0.6));
    lk(V3(-5.4, 4.45, 0), V3(-5.25, 3.9, 0), 0xc08a1f);
    cap('這些 block 其實 map 到 sector', 'block 由好幾個 sector 組成');
  },
  async (tok, S) => { // 167.5 好幾個讀寫盤
    S.cx = 2.8; S.cy = 3.0; S.P = platter(S.cx, S.cy, [1.2, 1.9, 2.6], () => 8);
    sm('platter（讀寫盤）', 2.8, -0.1);
    cap('disk 分成好幾個讀寫盤', '這裡畫其中一片的正面');
  },
  async (tok, S) => { // 171.3 track
    S.P.rings.forEach((l) => l.material.color.set('#c08a1f'));
    cap('一個讀寫盤有好幾個 track', '一圈一圈的');
  },
  async (tok, S) => { // 174.6 sector
    S.sec = ring(S.cx, S.cy, 2.25, '#d64545', 0.05, 0.75, 0.08);
    cap('再把 track 切成 sector', '');
  },
  async (tok, S) => { // 176.3 data block 對到一個或多個 sector
    cap('一個 data block', '可能對到一個或多個 sector');
  },
  async (tok, S) => { // 183.1 sector 要有 ID
    S.ids = []; for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; S.ids.push(sm(String(i), S.cx + 2.25 * Math.cos(a), S.cy + 2.25 * Math.sin(a))); }
    cap('很重要：sector 要有 ID', '才能 identify 它、做 mapping');
  },
  async (tok, S) => { // 195.5 sector 0 從哪開始無所謂
    hot('sector 0', S.cx + 3.0, S.cy + 0.5);
    cap('通常 sector 0 從最外圈（或最內圈）第一個 track 開始', '從哪開始其實無所謂');
  },
  async (tok, S) => { // 205.5 重點：編號要連續
    for (let i = 0; i < 8; i++) { S.ids[i].element.className = 'lab-label ptr alt'; await wt(tok, 120); }
    cap('重點：number 一定要有連續的現象', '');
  },
  async (tok, S) => { // 217.2 編號 ≈ 移動距離
    note('編號差 ≈ 讀寫頭要移動的距離', -2.4, 1.2);
    cap('硬碟最好順著它移動的方式讀寫', '所以 number 也 indicate 讀寫要移動的距離');
  },
  async (tok, S) => { // 230.7 scheduling 就是 minimize 移動距離
    good('disk scheduling：minimize 移動距離', -2.4, 0.4);
    cap('之後講 scheduling algorithm', '最好的就是 minimize 移動距離：看 number 就知道');
  },
]);

scene('fs-25b-clv', 'CLV：外圈轉慢、內圈轉快（CD / DVD）', CAM, [
  async (tok, S) => { // 251.1 drive 怎麼移動
    S.cx = -2.6; S.cy = 3.2;
    S.P = platter(S.cx, S.cy, [1.0, 1.8, 2.6], (k) => [6, 11, 16][k]);
    cap('知道怎麼 labeling 之後', '看這些 drive 怎麼移動');
  },
  async (tok, S) => { // 260.7 CD-ROM、DVD-ROM
    S.cd = prop('disk', 4.6, 0, 0, 0.9, 'CD / DVD');
    cap('除了傳統 hard drive', '類似的還有 CD-ROM、DVD-ROM');
  },
  async (tok, S) => { // 277.6 兩種型別
    cap('因為移動方式不同', '可以分成兩種型別');
  },
  async (tok, S) => { // 283.2 CLV
    hd('CLV：Constant Linear Velocity', 2.6, 6.6);
    cap('第一種：CLV（constant linear velocity）', '');
  },
  async (tok, S) => { // 295.2 外圈空間大、sector 多
    S.P.rings[2].material.color.set('#2fc092'); sm('外圈：16 個 sector（示意）', S.cx, 0.3);
    cap('越外圈空間越大', '存的 sector 越多，資料量越大');
  },
  async (tok, S) => { // 308.3 要維持相同的讀取速度
    S.rate = hot('目標：每秒讀出的資料量相同', 2.6, 5.8);
    cap('如果要維持相同的讀取速度', '');
  },
  async (tok, S) => { // 312.4 外圈：轉一小段就夠 → 轉慢一點
    S.arc = ring(S.cx, S.cy, 2.6, '#d64545', 0, Math.PI / 6, 0.1);
    S.sp = sm('外圈：轉 30°（示意）就讀到需要的量 → 可以轉慢', 2.6, 5.0);
    cap('讀外圈時資料量多', '可能轉一小段角度就夠：不用轉那麼快');
  },
  async (tok, S) => { // 328.9 內圈 sector 少
    S.P.rings[0].material.color.set('#d64545');
    cap('內圈面積小', '能存的 sector 數量比較少');
  },
  async (tok, S) => { // 359.1 內圈要轉一整圈
    S.arc2 = ring(S.cx, S.cy, 1.0, '#d64545', 0, Math.PI * 2, 0.12);
    cap('要讀相同的資料量', '內圈就必須整圈都讀完');
  },
  async (tok, S) => { // 369.5 內圈轉速要加快
    sm('內圈 → 轉速加快', 2.6, 4.4);
    let a = 0; await anim(tok, 1200, (u) => { a = u * Math.PI * 4; S.P.hub.rotation.z = a; });
    cap('所以外圈可以轉慢一點', '讀內圈時，轉的速度就要加快');
  },
  async (tok, S) => { // 383.1 CD-ROM 突然加速、聲音變大
    bub('放 DVD 時突然加速、聲音變大？', 4.6, 2.4);
    cap('讀 CD-ROM 有時突然很快、突然很慢', '放 DVD 時加速、聲音變大');
  },
  async (tok, S) => { // 418.0 看讀內圈還外圈
    cap('就是因為讀內圈要轉更快', '轉速不一致：depends on 讀的是內圈還是外圈');
  },
]);

scene('fs-25b-cav', 'CAV：轉速固定、外圈 density 較疏（hard drive）', CAM, [
  async (tok, S) => { // 430.0 第二種：CAV
    S.cx = -2.6; S.cy = 3.2; S.P = platter(S.cx, S.cy, [1.0, 1.8, 2.6], () => 8);
    hd('CAV：Constant Angular Velocity', 2.6, 6.6);
    cap('第二種：CAV（constant angular velocity）', '');
  },
  async (tok, S) => { // 440.3 角度相同 → 資料量相同
    S.w = [1.0, 1.8, 2.6].map((r) => ring(S.cx, S.cy, r, '#d64545', 0, Math.PI / 4, 0.1));
    cap('不管內圈外圈', '只要轉的角度相同，讀出來的資料量就相同');
  },
  async (tok, S) => { // 463.2 rotation 一致：7200
    S.rpm = hot('轉速固定：7200 RPM', 2.6, 5.8);
    await anim(tok, 1200, (u) => { S.P.hub.rotation.z = u * Math.PI * 4; });
    cap('rotation 的速度要一致', '不管讀內圈外圈，整個磁碟就是固定轉速，例如 7200');
  },
  async (tok, S) => { // 474.6 買硬碟：貴與便宜
    S.hd = prop('disk', 4.6, 0, 0, 0.9, 'hard drive');
    cap('買硬碟時，為什麼有些貴、有些便宜？', '有分不同等級（容不容易壞），再來是 size');
  },
  async (tok, S) => { // 491.7 一定要看 rotation speed
    sm('規格：rotation speed（RPM＝每分鐘轉數）', 2.6, 5.0);
    cap('第三個一定要注意看：rotation speed', '不然錢就被騙走了（單位是每分鐘轉數 RPM）');
  },
  async (tok, S) => { // 501.3 always 固定速度
    cap('rotation speed always 就是那個樣子', '不管資料放哪、怎麼用，都維持固定速度');
  },
  async (tok, S) => { // 524.8 外圈 density 較疏
    S.P.rings[2].material.color.set('#2fc092'); S.P.rings[0].material.color.set('#d64545');
    cap('為了配合這個特性', '外圈的 density 就必須比較疏鬆');
  },
  async (tok, S) => { // 543.1 外圈 sector 長，內圈密
    sm('外圈：sector 又長又寬（疏）', S.cx, 0.3); sm('內圈：密、小', S.cx, 6.3);
    cap('同樣角度外圈面積大，但讀出資料量要相同', '所以外圈 sector 越長越寬，內圈越密越小');
  },
  async (tok, S) => { // 552.2 data rate 一樣：predictable
    good('data rate 一樣：穩定、predictable', 2.6, 4.2);
    cap('確保 data rate 維持一樣', '對軟體而言，越穩定、越 predictable 越好');
  },
  async (tok, S) => { // 567.0 兩種選擇
    S.c = code(['CLV：改變轉速，density 一樣', 'CAV：轉速固定，改變 density'], 2.6, 3.2, 0.45);
    cap('因為面積的問題有兩種選擇', '要嘛隨內外圈改變轉速，要嘛改變儲存 density');
  },
  async (tok, S) => { // 588.2 hard drive 是第二種
    S.c.hl(1);
    cap('標準的 hard drive', '就是第二種：CAV');
  },
]);

scene('fs-25b-attach', 'Disk attachment：host controller ↔ bus ↔ disk controller', CAM, [
  async (tok, S) => { // 601.0 attach 到系統
    S.pc = bx('computer system', FC.sky, -4.4, 2.0, 0, 3.0, 2.2, 1.2); S.dk = prop('disk', 4.6, 0.9, 0, 1.2, 'disk drive');
    cap('知道機械運作的基本方法後', '要把這些 I/O device attach 到系統裡，讓它做 I/O');
  },
  async (tok, S) => { // 626.8 I/O subsystem 下一章
    note('I/O subsystem：下一章細講', 0, 6.4);
    cap('怎麼做 I/O 是下一章', '這裡先知道基本概念');
  },
  async (tok, S) => { // 634.5 透過 controller
    cap('會透過 controller', '之前也介紹過：分成兩邊');
  },
  async (tok, S) => { // 640.6 host controller
    S.hc = bx('host controller', FC.orange, -4.4, 3.6, 0, 2.6, 0.6, 0.9); glow(S.hc, HL);
    cap('computer system 這邊有 host controller', 'controller card、主機板上的 device，甚至 CPU 直接當');
  },
  async (tok, S) => { // 654.7 drive 這邊也有 controller
    S.dc = bx('disk controller', FC.orange, 4.6, 3.6, 0, 2.6, 0.6, 0.9); glow(S.dc, HL);
    cap('drive 這邊也必須有一個 controller', '是 disk 就是 disk drive 的 controller');
  },
  async (tok, S) => { // 664.1 中間溝通：bus
    glow(S.hc, null); glow(S.dc, null);
    S.bus = bx('bus', FC.gold, 0.1, 3.6, 0, 6.4, 0.2, 0.3);
    cap('兩邊是兩個小的 I/O unit 要溝通', '中間用什麼連線方式？');
  },
  async (tok, S) => { // 679.1 SATA 排線
    relabel(S.bus, 'bus（例如 SATA）');
    S.pk = bx('data', FC.green, -2.6, 4.2, 0, 0.9, 0.35, 0.5); await slide(tok, S.pk, 2.8, 4.2, 0, 1000);
    cap('就是常看到的 SATA 等等排線', '中間的 bus');
  },
  async (tok, S) => { // 688.4 每種 bus 有自己的 protocol
    cap('每種 bus 有自己的 protocol 和傳輸特性', 'sender、receiver 兩人溝通才能傳資料（下一章細講）');
  },
]);

scene('fs-25b-sched', 'Disk scheduling：很多 I/O request，要決定順序', CAM, [
  async (tok, S) => { // 707.9 disk scheduling algorithm
    S.dc = bx('disk controller', FC.orange, 3.6, 2.0, 0, 2.6, 0.7, 0.9); S.dk = prop('disk', 3.6, 3.0, 0, 0.9);
    hd('Disk scheduling algorithm', 0, 6.8);
    cap('管理 disk 第一個重要的 issue', 'disk 的 scheduling algorithm');
  },
  async (tok, S) => { // 717.5 收到很多 I/O request
    S.q = []; for (let i = 0; i < 5; i++) S.q.push(bx('req ' + (i + 1), FC.sky, -5.4 + i * 1.3, 4.6, 0, 1.1, 0.5, 0.6));
    cap('disk 會接收到很多 I/O request', '');
  },
  async (tok, S) => { // 721.3 來自 FS、database、任何 software
    sm('來自 file system、database、任何 application', -2.8, 5.4);
    cap('來自 file system、database，任何 software', '已經是最 low level：driver 下面了');
  },
  async (tok, S) => { // 742.4 controller 決定順序
    for (let i = 0; i < 5; i++) { await slide(tok, S.q[i], 2.0, 2.0, 0, 250); kill(S.q[i]); }
    S.ord = code(['順序？ 3 → 1 → 5 → 2 → 4（示意）'], -2.6, 2.0);
    cap('disk controller 接到之後要做決定', '按照什麼順序處理這些 I/O request');
  },
  async (tok, S) => { // 761.1 目的：減少讀寫時間
    good('目的：減少讀寫的時間', -2.6, 0.6);
    cap('disk scheduling 的目的', '當然就是減少讀寫的時間');
  },
]);

scene('fs-25b-access', 'Disk access time = seek + rotation + transfer', CAM, [
  async (tok, S) => { // 766.2 access time 怎麼 model
    S.cx = -2.4; S.cy = 3.2; S.P = platter(S.cx, S.cy, [1.0, 1.8, 2.6], () => 8);
    cap('先看 disk 讀寫時間怎麼算', '怎麼被 model 出來：disk access time');
  },
  async (tok, S) => { // 785.7 讀寫盤會 rotate
    await anim(tok, 1000, (u) => { S.P.hub.rotation.z = u * Math.PI * 2; });
    cap('hard drive 有很多讀寫盤', '第一件事：它會 rotate');
  },
  async (tok, S) => { // 796.1 rotate 速度是 constant
    cap('對 disk 而言 rotate 的速度是 constant', '不用管內圈外圈：每圈 sector 數一定');
  },
  async (tok, S) => { // 804.4 不同 track：讀寫頭要移動
    S.arm = bx('', FC.dark, S.cx + 3.6, S.cy + 0.0, 0.3, 2.4, 0.18, 0.18); S.head = bx('', FC.red, S.cx + 2.6, S.cy, 0.3, 0.3, 0.3, 0.3);
    sm('讀寫頭（arm）', S.cx + 4.0, S.cy + 0.5);
    cap('但有不同的 track', '讀不同 track 時，讀寫頭會往內或往外移');
  },
  async (tok, S) => { // 826.2 要知道第幾個 plate、第幾個 track
    S.tg = ring(0, 0, 1.0, '#d64545', 2.0, 2.6, 0.12); S.tg.position.set(S.cx, S.cy, 0);
    hot('目標 sector', S.cx - 1.6, S.cy + 1.6);
    cap('可能讀任何一個 sector', '要知道它在第幾個 plate、第幾個 track');
  },
  async (tok, S) => { // 841.5 先把讀寫頭移到 track
    await anim(tok, 1000, (u) => { S.head.position.x = S.cx + 2.6 - 1.6 * u; S.arm.position.x = S.cx + 3.6 - 1.6 * u; });
    S.l1 = good('① seek：移到那個 track', 3.6, 6.2);
    cap('讀寫頭可能在更外圈', '第一件事：把它移進來，移到那個 track');
  },
  async (tok, S) => { // 852.3 再轉過來
    await anim(tok, 1000, (u) => { S.tg.rotation.z = -2.0 * u; });
    S.l2 = good('② rotation：轉到那個 sector', 3.6, 5.5);
    cap('移進來之後再把盤轉過來', '這是 rotation，才到你要的位置');
  },
  async (tok, S) => { // 862.2 三段時間
    S.l3 = good('③ transfer：真的讀寫', 3.6, 4.8);
    cap('然後才開始讀寫', '整個時間 break down 成 seek time、rotation time、transfer time');
  },
  async (tok, S) => { // 868.5 seek time
    glow(S.head, HL);
    cap('seek time：移動磁頭（往前往後）', '依 track 的位置決定');
  },
  async (tok, S) => { // 880.0 rotation time：7200 RPM → ms
    glow(S.head, null);
    sm('7200 RPM：一圈 60 ÷ 7200 s ≈ 8.33 ms，平均等半圈 ≈ 4.17 ms', 3.0, 3.8);
    cap('rotation time：多快可以轉一圈', '看現在位置有多遠；7200 轉就算得出幾 ms');
  },
  async (tok, S) => { // 897.0 transfer time = bytes ÷ bandwidth
    sm('transfer time = 資料量 ÷ bandwidth', 3.0, 3.2);
    cap('最後才是真的 transfer time', 'depends on 資料大小：byte 數除以 bandwidth');
  },
  async (tok, S) => { // 917.2 反推 bandwidth
    sm('知道資料量與總時間 → 算出 bandwidth', 3.0, 2.6);
    cap('也可以倒推回來', '知道 transfer 多少、request 從開始到完成多久，就算得出 bandwidth');
  },
]);

scene('fs-25b-seek', '為什麼 scheduling 要 minimize seek time', CAM, [
  async (tok, S) => { // 933.8 三個時間
    S.bars = [['seek', 5, FC.red], ['rotation', 2, FC.orange], ['transfer', 1.2, FC.blue]].map(([n, h, c], i) => { const m = bx('', c, -3.6 + i * 3.6, h * 0.35, 0, 1.6, h * 0.7, 1.0); tag(n, 'ptr', -3.6 + i * 3.6, -0.3); return m; });
    sm('（高度示意）', 0, -0.9);
    cap('這三個時間可以注意到', '');
  },
  async (tok, S) => { // 938.2 transfer 跟 scheduling 無關
    glow(S.bars[2], HL);
    cap('transfer time 跟 disk scheduling 無關', '跟資料量、使用者的 I/O pattern 有關：controller 沒辦法最佳化');
  },
  async (tok, S) => { // 968.5 rotation 很快
    glow(S.bars[2], null); glow(S.bars[1], HL);
    cap('rotation time 基本上也非常快', '每分鐘 7200 轉：從這裡轉到那裡非常快');
  },
  async (tok, S) => { // 982.4 7200 的重點：大量資料要讀好幾圈
    cap('7200 轉的重點在哪？', '要讀的資料量很大、得轉好幾圈時，轉越快讀越快');
  },
  async (tok, S) => { // 1000.2 seek 才是最大的問題
    glow(S.bars[1], null); glow(S.bars[0], NG);
    cap('這兩個時間相對都很快，不需特別最佳化', '最後的 seek time，才是 hard drive 效能最大的問題');
  },
  async (tok, S) => { // 1016.5 機械式；SSD 沒有機械所以快
    bad('移動磁頭是機械動作：很慢', -3.6, 4.6); S.ssd = bx('SSD：沒有機械', FC.teal, 4.6, 5.4, 0, 2.6, 0.6, 0.8);
    cap('移動磁頭是機械式的行為', '為什麼 SSD 快？它沒有機械，原理不一樣');
  },
  async (tok, S) => { // 1031.1 scheduling = minimize seek time
    good('scheduling 的重點 = minimize seek time', 0, 6.4);
    cap('從最內圈移到最外圈就花非常多時間', '所以 scheduling 的目的就是 minimize seek time');
  },
  async (tok, S) => { // 1042.7 跟所有 request 的順序有關
    cap('seek time 跟單一 I/O request 無關', '而是跟所有人 I/O request 的讀取順序有關');
  },
  async (tok, S) => { // 1055.3 每個 track 各一個：依序 vs 亂跳
    S.tr = [0, 1, 2, 3, 4, 5].map((i) => bx('track ' + i, FC.paper, -5.0, 5.2 - i * 0.55, 0, 1.6, 0.45, 0.6));
    S.hd = hot('▶', -6.2, 5.2);
    for (const i of [0, 1, 2, 3, 4, 5]) { S.hd.position.y = 5.2 - i * 0.55; await wt(tok, 150); }
    for (const i of [3, 0, 5, 1, 4, 2]) { S.hd.position.y = 5.2 - i * 0.55; await wt(tok, 150); }
    cap('例：每個 track 剛好都有一個 sector 要讀', '依序讀 vs randomly 跳著讀：磁頭移動距離差非常多');
  },
  async (tok, S) => { // 1076.6 scheduling 很重要
    cap('所以 disk scheduling 對效能很重要', '它可以 minimize seek time 這個多餘的 overhead');
  },
  async (tok, S) => { // 1094.1 只有 disk / CD 有；SSD 不一樣
    glow(S.ssd, HL);
    cap('這個現象只有 disk、CD-ROM 這類有磁碟的才有', 'SSD 等其他 storage device 管理重點不一樣');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 9 章',
    title: '檔案系統',
    color: 'var(--os)',
    modes: [
      { id: 'alloc', name: '配置方式', enter: () => { clearLog(); enterAlloc(); } },
      { id: 'inode', name: 'inode 計算', enter: () => { clearLog(); enterInode(); } },
      { id: 'dir', name: '目錄結構', enter: () => { clearLog(); enterDir(); } },
      { id: 'free', name: 'Free space', enter: () => { clearLog(); enterFree(); } },
      { id: 'perm', name: '權限 rwx', enter: () => { clearLog(); enterPerm(); } },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'access-methods', 'dir-structures', 'acyclic-delete', 'general-graph-gc', 'mount-points', 'mount-table', 'share-ugo', 'acl-bits', 'protection-two',
      'contig-linked', 'fat', 'indexed-alloc', 'linked-index', 'multilevel-index', 'inode-combined', 'inode-access',
      'free-list-kinds', 'bit-vector', 'bitmap-nearest', 'io-count',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
