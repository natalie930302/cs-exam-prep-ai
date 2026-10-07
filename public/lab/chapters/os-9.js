// 作業系統 第9章：檔案系統（access method、directory、mount、ACL、allocation、inode、free space）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
// 影片：清大 周志遠 第23A–25B講（23C、25A 有字幕，場景依字幕重現；其餘依恐龍書 Ch.13–14 補）。
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
    ],
    stop() { stopTimer(); busy = false; },
  };
}
