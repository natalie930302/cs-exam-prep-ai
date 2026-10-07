// 作業系統 第10章：I/O 系統與 Mass Storage（磁碟排程、RAID、polling / interrupt / DMA、壞軌、swap）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
// 影片：清大 周志遠 第26A–26D講（26B 有字幕，場景依字幕重現；其餘依恐龍書 Ch.11–12 補）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010', GRAY = '#d8cfc0';
  const C = { blue: '#4b9ee2', green: '#2fc092', purple: '#9b7ef4', orange: '#dd8238', gold: '#c08a1f', red: '#d64545', teal: '#31aab0', pink: '#e55a9b', gray: '#c9bba3' };
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
  const tint = (m, c) => { if (m) m.material.color.set(c); };
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
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok !== undefined) await beat(tok, ms / steps); else await sleep(ms / steps); } }
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  // ───────────────────────── 磁碟排程（模式 + 場景共用） ─────────────────────────
  const BOOK_Q = [98, 183, 37, 122, 14, 124, 65, 67];   // 恐龍書：head 在 53，cylinder 0–199
  const ALG = { fcfs: 'FCFS', sstf: 'SSTF', scan: 'SCAN', cscan: 'C-SCAN', look: 'LOOK', clook: 'C-LOOK' };
  function schedule(alg, head, reqs, dir, maxC = 199) {
    const steps = [];
    if (alg === 'fcfs') reqs.forEach((r) => steps.push({ to: r, serve: true }));
    if (alg === 'sstf') {
      let cur = head; const rest = [...reqs];
      while (rest.length) { let bi = 0; rest.forEach((r, i) => { if (Math.abs(r - cur) < Math.abs(rest[bi] - cur)) bi = i; }); cur = rest.splice(bi, 1)[0]; steps.push({ to: cur, serve: true }); }
    }
    const lo = reqs.filter((r) => r < head).sort((a, b) => b - a);   // 由近到遠（往 0）
    const hi = reqs.filter((r) => r >= head).sort((a, b) => a - b);  // 由近到遠（往 max）
    const S = (arr) => arr.forEach((r) => steps.push({ to: r, serve: true }));
    const up = dir === 'up';
    if (alg === 'scan') {
      if (up) { S(hi); if (lo.length) { steps.push({ to: maxC }); S(lo); } }
      else { S(lo); if (hi.length) { steps.push({ to: 0 }); S(hi); } }
    }
    if (alg === 'look') { if (up) { S(hi); S(lo); } else { S(lo); S(hi); } }
    if (alg === 'cscan') {
      if (up) { S(hi); if (lo.length) { steps.push({ to: maxC }); steps.push({ to: 0, jump: true }); S([...lo].reverse()); } }
      else { S(lo); if (hi.length) { steps.push({ to: 0 }); steps.push({ to: maxC, jump: true }); S([...hi].reverse()); } }
    }
    if (alg === 'clook') {
      if (up) { S(hi); if (lo.length) { const l2 = [...lo].reverse(); steps.push({ to: l2[0], jump: true, serve: true }); S(l2.slice(1)); } }
      else { S(lo); if (hi.length) { const h2 = [...hi].reverse(); steps.push({ to: h2[0], jump: true, serve: true }); S(h2.slice(1)); } }
    }
    return steps;
  }
  function seekTotal(head, steps, countJump) {
    let cur = head, tot = 0, ret = 0;
    for (const s of steps) { const d = Math.abs(s.to - cur); if (s.jump) ret += d; else tot += d; cur = s.to; }
    return { tot: tot + (countJump ? ret : 0), ret, noRet: tot };
  }
  const cx = (c, maxC = 199) => -6 + c * 12 / maxC;
  // draws the cylinder axis + request markers; returns marker meshes keyed by value
  function drawAxis(reqs, head, maxC = 199) {
    const ax = lab.box('#6e5f49', [12.2, 0.06, 0.06]); ax.position.set(0, 0.03, -3); lab.world.add(ax);
    for (const t of [0, 50, 100, 150, maxC]) tag(String(t), 'idx', cx(t, maxC), 0.05, -2.6);
    tag('cylinder', 'idx', 6.6, 0.05, -3);
    const mk = {};
    [...new Set(reqs)].sort((a, b) => a - b).forEach((r, i) => {
      mk[r] = cube('', C.orange, [0.16, 0.5, 0.16], cx(r, maxC), 0.25, -3);
      tag(String(r), 'ptr', cx(r, maxC), 0.6, i % 2 ? -3.55 : -4.1);
    });
    const hd = tag('head ' + head, 'ptr alt', cx(head, maxC), 0.6, -2.2);
    return mk;
  }
  async function runSched(o, tok) {
    const { alg, head, reqs, dir, countJump, maxC = 199, fast } = o;
    const steps = schedule(alg, head, reqs, dir, maxC);
    const mk = drawAxis(reqs, head, maxC);
    const dz = Math.min(0.7, 6.4 / Math.max(steps.length, 1));
    let cur = head, z = -2.2, tot = 0;
    const hm = cube('', C.blue, [0.4, 0.4, 0.4], cx(head, maxC), 0.2, z);
    const ct = tag('', 'ptr alt', 5.2, 0.4, 3.9);
    const served = [];
    for (const s of steps) {
      const d = Math.abs(s.to - cur);
      const z2 = z + dz;
      seg(V3(cx(cur, maxC), 0.2, z), V3(cx(s.to, maxC), 0.2, z2), s.jump ? '#d64545' : '#2f6fb0');
      if (!s.jump || countJump) tot += d;
      txt(ct, '移動 ' + tot);
      if (o.caption !== false) say(s.jump ? '跳回 ' + s.to + '（回程不服務）' : s.serve ? '→ ' + s.to + '（移動 ' + d + '）' : '走到盡頭 ' + s.to, ALG[alg] + '：累計 ' + tot + (s.jump && !countJump ? '（回程不計）' : ''));
      await anim(tok, fast ? 120 : 250 + d * 6, (t) => { hm.position.set(cx(cur + (s.to - cur) * t, maxC), 0.2, z + dz * t); });
      cur = s.to; z = z2;
      if (s.serve && mk[s.to]) { tint(mk[s.to], C.green); served.push(s.to); }
      await wait(tok, fast ? 40 : 250);
    }
    return { steps, tot, ...seekTotal(head, steps, countJump) };
  }
  const SC = { alg: 'sstf', head: 53, q: BOOK_Q.join(','), dir: 'down', countJump: true };
  function enterSched() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 10.5, 8.2], [0, 0, 0.3]);
    controls(
      '<select id="sA">' + Object.keys(ALG).map((k) => '<option value="' + k + '">' + ALG[k] + '</option>').join('') + '</select>'
      + '<label>head <input id="sH" type="number" min="0" max="199" value="' + SC.head + '"></label>'
      + '<label>queue <input id="sQ" value="' + SC.q + '" size="22"></label>'
      + '<select id="sD"><option value="down">往 0 移動</option><option value="up">往 199 移動</option></select>'
      + '<label><input id="sJ" type="checkbox"' + (SC.countJump ? ' checked' : '') + '>回程計入</label>'
      + '<button class="primary" id="sGo">執行</button><button id="sCmp">六種比較</button>'
    );
    $('sA').value = SC.alg; $('sD').value = SC.dir;
    $('sA').onchange = (e) => { SC.alg = e.target.value; };
    $('sD').onchange = (e) => { SC.dir = e.target.value; };
    $('sJ').onchange = (e) => { SC.countJump = e.target.checked; };
    on('sGo', async () => {
      if (busy) return;
      const p = readSched(); if (!p) return;
      busy = true;
      try { lab.clear(); const r = await runSched({ alg: SC.alg, ...p, dir: SC.dir, countJump: SC.countJump }); schedState(r); log(ALG[SC.alg] + '：' + [p.head, ...r.steps.map((s) => (s.jump ? '⤳' : '') + s.to)].join(' → ') + '，共 ' + r.tot + ' cylinders'); }
      finally { busy = false; }
    });
    on('sCmp', () => {
      const p = readSched(); if (!p) return;
      clearLog();
      for (const k of Object.keys(ALG)) { const st = schedule(k, p.head, p.reqs, SC.dir); const t = seekTotal(p.head, st, SC.countJump); log(ALG[k].padEnd(7) + '：' + t.tot + (t.ret ? '（含回程 ' + t.ret + '）' : '')); }
    });
    drawAxis(BOOK_Q, SC.head);
    log('預設是恐龍書的例子：head 在 53，queue = 98, 183, 37, 122, 14, 124, 65, 67。');
    schedState(null);
  }
  function readSched() {
    const head = Number($('sH').value);
    const reqs = ($('sQ').value || '').split(/[,\s]+/).filter(Boolean).map(Number);
    if (!(head >= 0 && head <= 199)) { log('head 要在 0–199。', true); return null; }
    if (!reqs.length || reqs.some((r) => !(r >= 0 && r <= 199) || !Number.isInteger(r))) { log('queue 要是 0–199 的整數，用逗號分隔。', true); return null; }
    if (reqs.length > 14) { log('畫面最多放 14 個請求。', true); return null; }
    SC.head = head; SC.q = reqs.join(',');
    return { head, reqs };
  }
  function schedState(r) {
    const N = {
      fcfs: '照到達順序，公平但亂跳', sstf: '每次挑離 head 最近的；可能 starvation', scan: '電梯：走到底再回頭', cscan: '只單向服務，到底後直接跳回另一端', look: 'SCAN 但只走到最遠的請求', clook: 'C-SCAN 但只走到最遠的請求',
    };
    setState('磁碟排程：' + ALG[SC.alg], [['head', String(SC.head)], ['方向', SC.dir === 'down' ? '往 0' : '往 199'], ['回程', SC.countJump ? '計入' : '不計'], ['總移動', r ? r.tot + ' cylinders' : '—']],
      N[SC.alg] + (r && r.ret ? '<br>回程跳躍 ' + r.ret + '；不計回程 = ' + r.noRet : ''));
  }

  // ───────────────────────── 模式 2：Polling / Interrupt / DMA ─────────────────────────
  const IO = { mode: 'poll', n: 4 };
  const IONAME = { poll: 'Polling（busy-waiting）', intr: 'Interrupt-driven I/O', dma: 'DMA' };
  function ioPlan(mode, n, D = 3) {
    // returns blocks: [lane, start, len, kind]
    const B = [];
    let t = 0;
    if (mode === 'poll') for (let i = 0; i < n; i++) { B.push(['dev', t, D, 'dev']); B.push(['cpu', t, D, 'poll']); t += D; B.push(['cpu', t, 1, 'copy']); t += 1; }
    if (mode === 'intr') for (let i = 0; i < n; i++) { B.push(['dev', t, D, 'dev']); B.push(['cpu', t, D, 'user']); t += D; B.push(['cpu', t, 1, 'isr']); t += 1; }
    if (mode === 'dma') {
      B.push(['cpu', 0, 1, 'setup']); t = 1;
      for (let i = 0; i < n; i++) { B.push(['dev', t, D, 'dev']); B.push(['dma', t + D - 0.5, 0.5, 'steal']); B.push(['cpu', t, D, 'user']); t += D; }
      B.push(['cpu', t, 1, 'isr']); t += 1;
    }
    return { B, T: t };
  }
  const IOK = { poll: [C.orange, 'busy-wait'], copy: [C.blue, '搬'], user: [C.green, '其他工作'], isr: [C.purple, 'ISR'], dev: [C.teal, 'device'], setup: [C.purple, '設定 DMA'], steal: [C.red, '偷'] };
  async function drawIO(mode, n, tok, fast) {
    const { B, T } = ioPlan(mode, n);
    const U = Math.min(0.55, 11.5 / T), x0 = -5.8;
    const LZ = { cpu: -1.4, dev: 0.4, dma: 2.0 };
    tag('CPU', 'ptr', -6.6, 0.2, LZ.cpu); tag('Device', 'ptr', -6.6, 0.2, LZ.dev);
    if (mode === 'dma') tag('DMA', 'ptr', -6.6, 0.2, LZ.dma);
    const ax = lab.box('#6e5f49', [T * U + 0.2, 0.04, 0.04]); ax.position.set(x0 + T * U / 2, 0.02, 3); lab.world.add(ax); tag('time →', 'idx', x0 + T * U + 0.6, 0.05, 3);
    let useful = 0, wasted = 0, ints = 0;
    const sorted = [...B].sort((a, b) => a[1] - b[1]);
    for (const [lane, s, len, k] of sorted) {
      const [col, nm] = IOK[k];
      const m = cube(len >= 2 ? nm : '', col, [Math.max(0.1, len * U - 0.05), k === 'steal' ? 0.3 : 0.45, 0.9], x0 + (s + len / 2) * U, 0.22, LZ[lane], 1.5);
      if (k === 'user') useful += len;
      if (k === 'poll') wasted += len;
      if (k === 'isr') ints++;
      if (k === 'isr' || k === 'steal') tag(k === 'isr' ? 'interrupt' : '', 'idx', x0 + (s + len / 2) * U, 0.9, LZ[lane]);
      await wait(tok, fast ? 60 : 260);
    }
    return { T, useful, wasted, ints };
  }
  function enterIO() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 8.5, 9], [0, 0, 0.4]);
    controls('<select id="oM"><option value="poll">Polling</option><option value="intr">Interrupt</option><option value="dma">DMA</option></select><label>傳 <input id="oN" type="number" min="1" max="6" value="' + IO.n + '"> 個字</label><button class="primary" id="oGo">播放時間軸</button>');
    $('oM').value = IO.mode;
    $('oM').onchange = (e) => { IO.mode = e.target.value; };
    on('oGo', async () => {
      if (busy) return;
      const n = Number($('oN').value);
      if (!(n >= 1 && n <= 6)) { log('一次示範 1–6 個字（word / byte）。', true); return; }
      IO.n = n; busy = true;
      try { lab.clear(); const r = await drawIO(IO.mode, n); ioState(r); log(IONAME[IO.mode] + '：CPU 有效工作 ' + r.useful + '/' + r.T + ' 時間單位，interrupt ' + r.ints + ' 次'); }
      finally { busy = false; }
    });
    log('每個字 device 要 3 個時間單位；看 CPU 那條在做什麼。');
    ioState(null);
  }
  function ioState(r) {
    const F = {
      poll: 'CPU 反覆讀 status register 的 busy bit<br><span class="no">等待時間全浪費</span>；device 很快時反而划算',
      intr: 'device 好了才 interrupt CPU<br>CPU 可做別的事，但<span class="no">每個字都 interrupt 一次</span>',
      dma: 'CPU 只設定 DMA（來源、目的、長度）<br>整塊搬完才 <span class="ok">interrupt 一次</span>；DMA 用 cycle stealing 佔 bus',
    };
    setState(IONAME[IO.mode], r ? [['總時間', r.T + ' 單位'], ['CPU 有效工作', r.useful + ' 單位'], ['CPU 空轉', r.wasted + ' 單位'], ['interrupt 次數', String(r.ints)]] : [['傳輸字數', String(IO.n)]], F[IO.mode]);
  }

  // ───────────────────────── 模式 3：RAID ─────────────────────────
  const RD = { level: 5, cells: [], failed: -1, vals: [] };
  const RNAME = { 0: 'RAID 0（striping）', 1: 'RAID 1（mirroring）', 4: 'RAID 4（block parity，專用 parity disk）', 5: 'RAID 5（distributed parity）' };
  const bin4 = (v) => v.toString(2).padStart(4, '0');
  const nDisk = (lv) => (lv === 1 ? 2 : 4);
  const dX = (d, n) => (d - (n - 1) / 2) * 3;
  function raidLayout(lv, rows = 4) {
    // returns cells [{disk,row,kind:'data'|'par'|'mir', name, v}]
    const n = nDisk(lv), cells = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      if (lv === 0) for (let d = 0; d < n; d++) { cells.push({ disk: d, row: r, kind: 'data', name: 'B' + k, v: RD.vals[k] }); k++; }
      if (lv === 1) { cells.push({ disk: 0, row: r, kind: 'data', name: 'B' + k, v: RD.vals[k] }); cells.push({ disk: 1, row: r, kind: 'mir', name: 'B' + k, v: RD.vals[k] }); k++; }
      if (lv === 4 || lv === 5) {
        const pd = lv === 4 ? n - 1 : (n - 1 - (r % n));
        let par = 0; const row = [];
        for (let d = 0; d < n; d++) if (d !== pd) { row.push({ disk: d, row: r, kind: 'data', name: 'B' + k, v: RD.vals[k] }); par ^= RD.vals[k]; k++; }
        row.push({ disk: pd, row: r, kind: 'par', name: 'P' + r, v: par });
        cells.push(...row);
      }
    }
    return cells;
  }
  function cellColor(c) { return c.kind === 'par' ? C.gold : c.kind === 'mir' ? C.purple : C.blue; }
  async function drawRaid(lv, tok, fast) {
    RD.level = lv; RD.failed = -1;
    const n = nDisk(lv);
    for (let d = 0; d < n; d++) { ctx.tile(V3(dX(d, n), 0.04, 0), 2.6, 1.6); tag('disk ' + d, 'ptr', dX(d, n), 0.1, 1.2); }
    RD.cells = raidLayout(lv);
    RD.disks = [];
    for (const c of RD.cells) {
      c.m = cube(c.name + ' ' + bin4(c.v), cellColor(c), [2.3, 0.5, 1.2], dX(c.disk, n), 0.3 + c.row * 0.62, 0, 3);
      if (fast !== 'now') await wait(tok, fast ? 40 : 160);
    }
  }
  async function failDisk(d, tok) {
    const n = nDisk(RD.level);
    if (RD.failed >= 0) { log('已經壞了一顆（disk ' + RD.failed + '），先重建。', true); return false; }
    if (d < 0 || d >= n) { log('這個 RAID 只有 disk 0–' + (n - 1) + '。', true); return false; }
    RD.failed = d;
    RD.cells.filter((c) => c.disk === d).forEach((c) => { fly(c.m); c.m = null; });
    tag('✕ 故障', 'ptr', dX(d, n), 0.1, 1.9);
    log('disk ' + d + ' 故障。', true);
    return true;
  }
  async function rebuild(tok) {
    const n = nDisk(RD.level), d = RD.failed;
    if (d < 0) { log('沒有故障的 disk。', true); return; }
    if (RD.level === 0) { log('RAID 0 沒有 redundancy：disk ' + d + ' 上的資料永久遺失！', true); say('RAID 0：資料救不回來', '只有 striping，沒有備份'); return; }
    for (const c of RD.cells.filter((x) => x.disk === d)) {
      const others = RD.cells.filter((x) => x.row === c.row && x.disk !== d);
      others.forEach((o) => glow(o.m, GOLD));
      const v = RD.level === 1 ? others[0].v : others.reduce((a, o) => a ^ o.v, 0);
      say(RD.level === 1 ? '從 mirror 複製 ' + c.name : c.name + ' = ' + others.map((o) => bin4(o.v)).join(' ⊕ '), '= ' + bin4(v) + (v === c.v ? ' ✓' : ''));
      await wait(tok, 1300);
      others.forEach((o) => glow(o.m, null));
      c.m = cube(c.name + ' ' + bin4(v), cellColor(c), [2.3, 0.5, 1.2], dX(d, n), 0.3 + c.row * 0.62, 0, 3);
      glow(c.m, GREEN);
      await wait(tok, 500);
    }
    RD.failed = -1;
    log('重建完成：' + (RD.level === 1 ? '直接複製 mirror。' : '每一列 XOR 剩下的 block。'));
  }
  function enterRaid() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 5, 12], [0, 1.4, 0]);
    controls('<select id="rL"><option value="0">RAID 0</option><option value="1">RAID 1</option><option value="4">RAID 4</option><option value="5">RAID 5</option></select>'
      + '<button class="primary" id="rW">寫入新資料</button><label>壞掉 disk <input id="rD" type="number" min="0" max="3" value="1"></label><button id="rF">故障</button><button id="rR">重建</button>');
    $('rL').value = String(RD.level);
    $('rL').onchange = (e) => { RD.level = Number(e.target.value); clearLog(); enterRaid(); };
    on('rW', async () => { if (busy) return; busy = true; try { newVals(); lab.clear(); await drawRaid(RD.level); raidState(); } finally { busy = false; } });
    on('rF', async () => { if (busy) return; busy = true; try { await failDisk(Number($('rD').value)); raidState(); } finally { busy = false; } });
    on('rR', async () => { if (busy) return; busy = true; try { await rebuild(); raidState(); } finally { busy = false; } });
    if (!RD.vals.length) newVals();
    drawRaid(RD.level, undefined, 'now'); raidState();
    log(RNAME[RD.level] + '：方塊上的 4 個 bit 是資料內容，parity = 同一列 XOR。');
  }
  function newVals() { RD.vals = Array.from({ length: 16 }, () => rnd(1, 15)); }
  function raidState() {
    const lv = RD.level, n = nDisk(lv);
    const eff = { 0: '100%', 1: '50%', 4: (n - 1) + '/' + n, 5: (n - 1) + '/' + n }[lv];
    const F = {
      0: '資料切塊輪流放：讀寫平行、容量 100%<br><span class="no">沒有 redundancy</span>：壞一顆就全毀',
      1: '每塊存兩份：可靠、讀可以兩顆分攤<br>容量只剩一半',
      4: '一顆專用 parity disk：XOR 可重建任一顆<br><span class="no">每次寫都要更新 parity disk → 瓶頸</span>',
      5: 'parity 輪流放在各顆：分散寫入負載<br>可容忍 1 顆故障；容量 (n−1)/n',
    };
    setState(RNAME[lv], [['disk 數', String(n)], ['可用容量', eff], ['可容忍故障', lv === 0 ? '0 顆' : '1 顆'], ['目前', RD.failed >= 0 ? 'disk ' + RD.failed + ' 故障' : '正常']], F[lv]);
  }

  // ───────────────────────── 模式 4：磁碟結構與存取時間 ─────────────────────────
  const DK = { rpm: 7200, seek: 5, rate: 100, kb: 4, track: 1 };
  function buildPlatter() {
    const g = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 64), new THREE.MeshStandardMaterial({ color: '#b9c3cf', metalness: 0.4, roughness: 0.3 }));
    plat.castShadow = true; g.add(plat);
    for (let t = 0; t < 4; t++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 + t * 0.6, 0.02, 6, 64), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.07; g.add(ring);
    }
    for (let s = 0; s < 8; s++) {
      const a = s * Math.PI / 4;
      const sp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.01, 0.03), new THREE.MeshBasicMaterial({ color: '#8a7a60' }));
      sp.position.set(Math.cos(a) * 2.2, 0.075, Math.sin(a) * 2.2); sp.rotation.y = -a; g.add(sp);
    }
    const sec = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: C.orange, emissive: '#4a2000' }));
    sec.position.set(2.0, 0.1, 0.5); g.add(sec);
    g.position.set(-1.5, 0.6, 0);
    lab.world.add(g);
    const spindle = lab.box('#6e5f49', [0.3, 0.6, 0.3]); spindle.position.set(-1.5, 0.3, 0); lab.world.add(spindle);
    const arm = lab.box('#4a4a4a', [3.6, 0.1, 0.2]); arm.position.set(3.6, 0.85, 0); lab.world.add(arm);
    const headL = tag('read-write head', 'ptr', 4.8, 1.3, 0);
    return { g, sec, arm };
  }
  function trackX(t) { return -1.5 + 1.1 + t * 0.6; }
  function enterDisk() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7.5, 8], [0, 0.4, 0]);
    const P = buildPlatter();
    tag('platter', 'idx', -1.5, 0.2, 3.8); tag('track', 'idx', -1.5 + 2.9, 0.9, 0.4); tag('sector', 'idx', 0.6, 0.9, 1.2);
    controls('<label>RPM <input id="kR" type="number" value="' + DK.rpm + '" min="3600" max="15000" step="600"></label><label>平均 seek <input id="kS" type="number" value="' + DK.seek + '" min="1" max="20"> ms</label>'
      + '<label>傳輸率 <input id="kT" type="number" value="' + DK.rate + '" min="10" max="1000"> MB/s</label><label>讀 <input id="kK" type="number" value="' + DK.kb + '" min="1" max="1024"> KB</label><button class="primary" id="kGo">讀一次</button>');
    let ang = 0;
    P.arm.position.x = trackX(DK.track) + 1.8;
    timer = setInterval(() => { ang += 0.05 * DK.rpm / 7200; P.g.rotation.y = ang; }, 30);
    on('kGo', async () => {
      if (busy) return;
      const r = Number($('kR').value), s = Number($('kS').value), t = Number($('kT').value), k = Number($('kK').value);
      if (!(r > 0 && s >= 0 && t > 0 && k > 0)) { log('請輸入正數。', true); return; }
      Object.assign(DK, { rpm: r, seek: s, rate: t, kb: k });
      busy = true;
      try {
        const nt = (DK.track + 1 + rnd(0, 2)) % 4, x0 = P.arm.position.x, x1 = trackX(nt) + 1.8;
        say('1. seek：手臂移到 track ' + nt, '平均 ' + s + ' ms');
        await anim(undefined, 700, (u) => { P.arm.position.x = x0 + (x1 - x0) * u; });
        DK.track = nt;
        say('2. 旋轉延遲：等 sector 轉過來', '平均半圈 = ' + (30000 / r).toFixed(2) + ' ms');
        await sleep(1200);
        say('3. transfer：讀出資料', k + 'KB ÷ ' + t + 'MB/s');
        await sleep(800);
        diskState(true);
      } finally { busy = false; }
    });
    diskState(false);
    log('Access time = seek time + rotational latency + transfer time。');
  }
  function diskState(done) {
    const rot = 30000 / DK.rpm, tr = DK.kb / 1024 / DK.rate * 1000;
    setState('磁碟存取時間', [['seek', DK.seek + ' ms'], ['平均 rotational latency', rot.toFixed(2) + ' ms（半圈）'], ['transfer', tr.toFixed(3) + ' ms'], ['一圈', (60000 / DK.rpm).toFixed(2) + ' ms']],
      'access time = ' + DK.seek + ' + ' + rot.toFixed(2) + ' + ' + tr.toFixed(3) + ' = <span class="ok">' + (DK.seek + rot + tr).toFixed(2) + ' ms</span><br>seek 通常最大 → 磁碟排程就是在減少 seek');
  }

  // ───────────────────────── 模式 5：壞軌 sparing / slipping ─────────────────────────
  const BD = { bad: 4, method: 'sparing', map: null };
  const NS = 10, NSP = 2;
  const sx = (p) => -5.5 + p * 1.0;
  function drawTrack(map, badPhys) {
    lab.clear();
    for (let p = 0; p < NS + NSP; p++) { ctx.tile(V3(sx(p), 0.04, 0), 0.9, 1.2, p >= NS ? '#d6e7d9' : '#e9dcc4'); tag(String(p), 'idx', sx(p), 0.05, 0.9); }
    tag('spare', 'idx', sx(NS + 0.5), 0.05, 1.4);
    const M = {};
    for (let p = 0; p < NS + NSP; p++) {
      if (p === badPhys) { M.bad = cube('✕', C.red, [0.8, 0.4, 1], sx(p), 0.2, 0); continue; }
      const lg = map.indexOf(p);
      if (lg >= 0) M[lg] = cube(lg, C.blue, [0.8, 0.4, 1], sx(p), 0.2, 0);
    }
    tag('physical 位置', 'idx', -6.6, 0.05, 0.9);
    return M;
  }
  async function readSeq(map, tok) {
    const hd = tag('▼', 'ptr alt', sx(map[0]), 1, 0);
    let dist = 0, prev = map[0], jumps = 0;
    for (let lg = 0; lg < NS; lg++) {
      const p = map[lg];
      if (Math.abs(p - prev) > 1) jumps++;
      dist += Math.abs(p - prev);
      const p0 = prev;
      await anim(tok, 120 + Math.abs(p - p0) * 50, (u) => hd.position.set(sx(p0 + (p - p0) * u), 1, 0));
      prev = p;
      await wait(tok, 120);
    }
    kill(hd);
    return { dist, jumps };
  }
  function enterBad() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6, 9], [0, 0.4, 0]);
    controls('<label>壞掉 sector <input id="bB" type="number" min="0" max="9" value="' + BD.bad + '"></label><button class="primary" id="bSp">Sector sparing</button><button id="bSl">Sector slipping</button><button id="bRd">依序讀 0–9</button><button id="bRs">重設</button>');
    BD.map = Array.from({ length: NS }, (_, i) => i); BD.badPhys = -1;
    drawTrack(BD.map, -1);
    const fix = async (method) => {
      if (busy) return;
      const b = Number($('bB').value);
      if (!(b >= 0 && b < NS) || !Number.isInteger(b)) { log('logical sector 0–9。', true); return; }
      if (BD.badPhys >= 0) { log('已經處理過一個壞軌，先重設。', true); return; }
      busy = true;
      try {
        BD.bad = b; BD.method = method; BD.badPhys = b;
        if (method === 'sparing') { BD.map[b] = NS; log('sparing：logical ' + b + ' 改指到 spare（physical ' + NS + '）。'); }
        else { for (let lg = NS - 1; lg >= b; lg--) BD.map[lg] = lg + 1; log('slipping：' + b + '–9 全部往後挪一格，用掉一個 spare。'); }
        drawTrack(BD.map, b);
        badState();
      } finally { busy = false; }
    };
    on('bSp', () => fix('sparing'));
    on('bSl', () => fix('slipping'));
    on('bRd', async () => { if (busy) return; busy = true; try { const r = await readSeq(BD.map); log('依序讀 logical 0–9：磁頭移動 ' + r.dist + ' 格，跳躍 ' + r.jumps + ' 次。'); badState(r); } finally { busy = false; } });
    on('bRs', () => { clearLog(); enterBad(); });
    log('聰明的 controller（SCSI）會把壞掉的 sector 換掉；IDE 這種 simple disk 只會標記壞軌。');
    badState();
  }
  function badState(r) {
    setState('壞軌處理', [['壞掉的 sector', BD.badPhys >= 0 ? String(BD.bad) : '—'], ['方法', BD.badPhys < 0 ? '—' : BD.method === 'sparing' ? 'Sector sparing（forwarding）' : 'Sector slipping'], ['讀 0–9 移動', r ? r.dist + ' 格' : '—']],
      'sparing：瞬間完成，但 physical 不連續 → 排程效能變差<br>slipping：搬動所有資料，代價高，但之後仍連續');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const t = Math.random();
    if (t < 0.45) {
      const head = rnd(30, 170);
      const reqs = []; while (reqs.length < 6) { const r = rnd(0, 199); if (r !== head && !reqs.includes(r)) reqs.push(r); }
      const alg = pickOne(['fcfs', 'sstf', 'scan', 'cscan', 'look', 'clook']), dir = pickOne(['up', 'down']);
      const st = schedule(alg, head, reqs, dir), ans = seekTotal(head, st, true).tot;
      const alt = ['fcfs', 'sstf', 'scan', 'look'].map((a) => seekTotal(head, schedule(a, head, reqs, dir), true).tot);
      const opts = [...new Set([ans, ...alt, seekTotal(head, st, false).tot, ans + 2 * Math.min(...reqs)])].filter((x) => x > 0);
      const o4 = [ans, ...opts.filter((x) => x !== ans).slice(0, 3)];
      while (o4.length < 4) o4.push(ans + 10 * o4.length);
      return { q: 'cylinder 0–199，head 在 ' + head + '，' + (['fcfs', 'sstf'].includes(alg) ? '' : '正往 ' + (dir === 'up' ? '199' : '0') + ' 的方向移動，') + 'queue：' + reqs.join(', ') + '。用 ' + ALG[alg] + '，磁頭總移動多少 cylinders？' + (alg === 'cscan' || alg === 'clook' ? '（回程計入）' : ''), opts: o4.map(String), ans: String(ans), why: '順序：' + [head, ...st.map((s) => s.to)].join(' → ') + '。' };
    }
    if (t < 0.6) {
      const v = [rnd(1, 15), rnd(1, 15), rnd(1, 15)], p = v[0] ^ v[1] ^ v[2], lost = rnd(0, 2);
      const keep = v.filter((_, i) => i !== lost);
      const ans = bin4(v[lost]);
      return { q: 'RAID 5 某一列：' + v.map((x, i) => (i === lost ? 'D' + i + ' = ?（故障）' : 'D' + i + ' = ' + bin4(x))).join('，') + '，P = ' + bin4(p) + '。D' + lost + ' 是多少？', opts: (() => { const o = [...new Set([ans, bin4(keep[0] ^ keep[1]), bin4((~v[lost]) & 15), bin4(p)])]; while (o.length < 4) { const r = bin4(rnd(0, 15)); if (!o.includes(r)) o.push(r); } return o; })(), ans, why: 'D' + lost + ' = 其他 data ⊕ P = ' + keep.map(bin4).join(' ⊕ ') + ' ⊕ ' + bin4(p) + ' = ' + ans + '。' };
    }
    if (t < 0.72) {
      const lv = pickOne([0, 1, 5]), n = lv === 1 ? pickOne([2, 4, 6, 8]) : rnd(3, 8), sz = pickOne([1, 2, 4]);
      const cap = { 0: n * sz, 1: n * sz / 2, 5: (n - 1) * sz }[lv];
      return { q: n + ' 顆 ' + sz + 'TB 的硬碟組 RAID ' + lv + '（RAID 1 以兩兩鏡像計），可用容量？', opts: [...new Set([cap, n * sz, n * sz / 2, (n - 1) * sz, (n - 2) * sz, (n + 1) * sz].map((x) => x + 'TB'))].filter((x) => x !== cap + 'TB').slice(0, 3).concat(cap + 'TB'), ans: cap + 'TB', why: { 0: 'RAID 0 全部用來存資料。', 1: '每份資料兩份，容量一半。', 5: '每列有一塊 parity，等於少一顆。' }[lv] };
    }
    if (t < 0.84) {
      const rpm = pickOne([5400, 7200, 10000, 15000]), seek = rnd(3, 9);
      const rot = 30000 / rpm, ans = (seek + rot).toFixed(2) + ' ms';
      return { q: rpm + ' RPM、平均 seek ' + seek + ' ms，忽略傳輸時間，平均 access time？', opts: [...new Set([ans, (seek + 2 * rot).toFixed(2) + ' ms', seek + ' ms', (seek + rot / 2).toFixed(2) + ' ms'])], ans, why: '平均 rotational latency = 半圈 = 60000 ÷ ' + rpm + ' ÷ 2 = ' + rot.toFixed(2) + ' ms。' };
    }
    const qset = [
      { q: '傳一大塊資料時，哪種方式 CPU 被 interrupt 的次數最少？', opts: ['DMA', 'Interrupt-driven I/O', 'Polling', '三者相同'], ans: 'DMA', why: 'DMA 整塊搬完才 interrupt 一次（polling 雖不 interrupt，但 CPU 一直 busy-wait）。' },
      { q: 'Sector sparing 與 slipping 比較，何者處理快但會讓 physical 位置不連續？', opts: ['Sector sparing', 'Sector slipping', '兩者都會', '兩者都不會'], ans: 'Sector sparing', why: 'sparing 直接拿 spare 頂替；slipping 要搬動後面所有資料。' },
      { q: '哪種磁碟排程可能造成 starvation？', opts: ['SSTF', 'FCFS', 'C-SCAN', 'C-LOOK'], ans: 'SSTF', why: '一直有靠近 head 的新請求時，遠處的請求永遠輪不到。' },
      { q: 'C-SCAN 相對 SCAN 的好處？', opts: ['等待時間比較平均', '總移動距離一定比較短', '不需要知道方向', '不會走到底'], ans: '等待時間比較平均', why: '只單向服務，兩端的請求不會等特別久。' },
      { q: 'Swap space 用 raw partition 而不是檔案的主要好處？', opts: ['不經過 file system，速度快', '大小可以隨時調整', '不佔用硬碟', '可以存程式碼'], ans: '不經過 file system，速度快', why: '缺點是大小固定；現代 OS 常兩者並用。' },
      { q: 'RAID 4 的主要瓶頸？', opts: ['每次寫入都要更新同一顆 parity disk', '沒有 redundancy', '容量只剩一半', '不能讀'], ans: '每次寫入都要更新同一顆 parity disk', why: 'RAID 5 把 parity 輪流放在各顆來分散。' },
      { q: 'Spooling 最典型的例子？', opts: ['印表機佇列', 'TLB', 'page table', 'RAID 0'], ans: '印表機佇列', why: '印表機一次只能印一份，輸出先存到 disk 排隊。' },
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

  // ───────────────────────── 場景：1Hl-S_eFbhE（26B） ─────────────────────────
  async function scLowFormat(tok) {
    fresh([0, 5.5, 10.5], [0, 1.4, 0]);
    say('Low-level format：先切出 sector', '你買來的硬碟就已經做好這一層');
    for (let i = 0; i < 8; i++) { cube('', C.blue, [1.3, 0.3, 1], -5.25 + i * 1.5, 0.15, -2.2, 2); await beat(tok, 150); }
    await beat(tok, 1200);
    const h = cube('header', C.gray, [1.6, 0.6, 1.2], -3.4, 0.3, 0.8, 2);
    const d = cube('data 512B', C.blue, [3.6, 0.6, 1.2], -0.7, 0.3, 0.8, 2);
    const tr = cube('trailer', C.gold, [1.6, 0.6, 1.2], 2.0, 0.3, 0.8, 2);
    say('sector = header＋data＋trailer', '');
    await beat(tok, 2200);
    tag('sector number', 'idx', -3.4, 1.1, 0.8); tag('ECC', 'ptr alt', 2.0, 1.1, 0.8);
    say('存 sector 編號與 ECC', 'bit 多可以更正；少（例如 parity bit）至少能偵測');
    await beat(tok, 3000);
    say('說 sector 大小，只算 data 區', 'header / trailer 的空間不算');
    glow(d, GOLD); await beat(tok, 2200); glow(d, null);
    const lay = [['硬碟（low-level formatted）', C.gray], ['partition：P1 | P2', C.teal], ['logical formatting：建立 file system', C.green]];
    for (let i = 0; i < lay.length; i++) { cube(lay[i][0], lay[i][1], [6, 0.45, 1.2], 2.6, 2.0 + i * 0.6, -0.8, 2); await beat(tok, 900); }
    say('OS 接手：partition → logical format', '有了 sector number，上層才能分割、建 FS');
    await beat(tok, 3000);
  }
  async function scBoot(tok) {
    fresh([0, 5, 12], [0, 1.2, 0]);
    const steps = [['ROM bootstrap', C.purple, '主機板 ROM：初始化 CPU、register、memory'], ['MBR / boot block', C.orange, '開機磁碟最前面：raw data，不需 FS'], ['選 OS', C.gold, '讀各 boot block 知道裝了哪些 OS'], ['boot partition', C.teal, '載入 partition'], ['file system', C.green, '把 FS 架起來'], ['OS kernel', C.blue, '從 FS 讀出作業系統程式']];
    const ms = [];
    for (let i = 0; i < steps.length; i++) {
      const x = -5.5 + i * 2.2;
      ms.push(cube(steps[i][0], steps[i][1], [2, 0.6, 1.1], x, 0.3, 0, 0));
      if (i) seg(V3(x - 1.2, 0.3), V3(x - 1.0, 0.3), '#6e5f49');
    }
    say('Booting：從哪裡讀第一段程式？', 'OS 在 FS 裡，但 FS 還沒架起來');
    await beat(tok, 2600);
    const cur = tag('▼', 'ptr alt', -5.5, 1.2, 0);
    for (let i = 0; i < steps.length; i++) {
      cur.position.set(-5.5 + i * 2.2, 1.2, 0); glow(ms[i], GOLD);
      say(steps[i][0], steps[i][2]);
      await beat(tok, 2000);
      glow(ms[i], null);
    }
    say('一段一段把更複雜的 code 載進來', '有 boot block 的磁碟 = system drive / boot disk');
    await beat(tok, 3000);
  }
  async function scBadSimple(tok) {
    fresh([0, 6, 9], [0, 0.4, 0]);
    BD.map = Array.from({ length: NS }, (_, i) => i);
    let M = drawTrack(BD.map, -1);
    say('壞軌：先看 simple disk（IDE）', 'controller 沒什麼計算能力');
    await beat(tok, 2400);
    glow(M[4], RED);
    say('ECC 偵測到 sector 4 有錯', '能重建就重建，不行資料就遺失');
    await beat(tok, 2400);
    M = drawTrack(BD.map.map((p, i) => (i === 4 ? -9 : p)), 4);
    say('只能標記壞軌，以後不用', '對上層軟體不做任何處理');
    await beat(tok, 2400);
    say('空間越來越少，嚴重時開不了機', '');
    await beat(tok, 2800);
  }
  async function scSparing(tok) {
    fresh([0, 6, 9], [0, 0.4, 0]);
    BD.map = Array.from({ length: NS }, (_, i) => i);
    drawTrack(BD.map, -1);
    say('聰明的 SCSI controller 會補救', '方法一：sector sparing（forwarding）');
    await beat(tok, 2600);
    BD.map[4] = NS;
    drawTrack(BD.map, 4);
    say('sector 4 壞了 → spare 頂替', '瞬間解決');
    await beat(tok, 2600);
    say('依序讀 0–9：磁頭要跳到後面再跳回來', 'logical 連續，physical 不連續');
    const r = await readSeq(BD.map, tok);
    say('移動 ' + r.dist + ' 格（原本 9 格）', '排程、讀取效能受影響');
    await beat(tok, 3000);
  }
  async function scSlipping(tok) {
    fresh([0, 6, 9], [0, 0.4, 0]);
    BD.map = Array.from({ length: NS }, (_, i) => i);
    let M = drawTrack(BD.map, -1);
    glow(M[4], RED);
    say('方法二：sector slipping（shift）', 'sector 4 壞了');
    await beat(tok, 2400);
    for (let lg = NS - 1; lg >= 4; lg--) {
      BD.map[lg] = lg + 1;
      if (lg > 4) { move(M[lg], sx(lg + 1), 0.2, 0); }
      await beat(tok, 380);
    }
    M = drawTrack(BD.map, 4);
    say('原本 5 重新 label 成 4，大家往後一格', '要搬所有資料：修補時間很長');
    await beat(tok, 2800);
    const r = await readSeq(BD.map, tok);
    say('之後讀取仍連續：移動 ' + r.dist + ' 格', '代價高，但效能比較好');
    await beat(tok, 3000);
  }
  async function scSwapWhere(tok) {
    fresh([0, 5, 11], [0, 1, 0]);
    say('Swap space：換出的 page 放 disk', '兩種管理方式');
    const fs1 = cube('file system', C.green, [8, 0.6, 1.4], -1, 0.3, -1.6, 2);
    const sw = cube('swap file', C.pink, [1.6, 0.4, 1], 1.8, 0.85, -1.6, 3);
    await beat(tok, 2400);
    say('一、當成 FS 裡的一個檔案', '有彈性，但要經過 file system → 慢');
    await beat(tok, 2600);
    const p1 = cube('file system', C.green, [6, 0.6, 1.4], -2, 0.3, 1.2, 2);
    const p2 = cube('swap（raw partition）', C.pink, [3.4, 0.6, 1.4], 3, 0.3, 1.2, 2);
    say('二、切一塊 raw partition 給 swap', 'page 大小固定（4KB），演算法簡單、快');
    await beat(tok, 2800);
    say('缺點：大小固定', '切太小不夠用，切太大壓縮檔案空間');
    glow(p2, RED); await beat(tok, 2400); glow(p2, null);
    say('現代 OS 兩者都用', '先用 swap partition，不夠再跟 FS 借');
    cube('借', C.pink, [1, 0.4, 1], -1.2, 0.85, 1.2, 3);
    await beat(tok, 3000);
  }
  async function scSwapPolicy(tok) {
    fresh([0, 5.5, 11], [0, 1.2, 0]);
    const kinds = [['text', C.blue], ['text', C.blue], ['data', C.teal], ['heap', C.orange], ['stack', C.orange]];
    tag('memory', 'ptr', -4.2, 0.2, 1.6); tag('swap space', 'ptr', 3.4, 0.2, 1.6);
    const mem = kinds.map(([k, c], i) => cube(k, c, [1.3, 0.45, 1], -6 + i * 1.4 + 0.6, 0.23, 0, 2));
    say('做法一：一 create 就全部 copy 一份到 swap', '不管需不需要 → 很浪費空間');
    await beat(tok, 1600);
    const cp = [];
    for (let i = 0; i < mem.length; i++) { cp.push(cube(kinds[i][0], kinds[i][1], [1.1, 0.4, 0.9], 1.4 + (i % 3) * 1.3, 0.2 + Math.floor(i / 3) * 0.5, 0, 3)); await beat(tok, 300); }
    await beat(tok, 2000);
    cp.forEach((m) => fly(m));
    await beat(tok, 800);
    say('做法二：被 page out 時才 copy', 'memory 裡已經有一份了');
    await beat(tok, 2200);
    glow(mem[0], RED);
    say('text（code）被換出：直接丟掉', 'binary 本來就在 FS 裡，需要時重新 load');
    await beat(tok, 1400);
    fly(mem[0]); await beat(tok, 1600);
    glow(mem[4], RED);
    say('stack、heap 是 run time 動態產生的', '只有它們被 page out 時才放 swap');
    await beat(tok, 1200);
    move(mem[4], 1.4, 0.23, 0);
    await beat(tok, 2600);
    say('只放動態、不放 static → swap 用量最小', 'creation time 不 copy，page out 才 copy');
    await beat(tok, 3000);
  }
  async function scSwapMap(tok) {
    fresh([0, 6, 10], [0, 0.6, 0]);
    say('raw partition 的 swap：管理很簡單', '每個 slot 一個 counter');
    const cnt = [0, 0, 0, 0, 0, 0, 0, 0];
    const slots = cnt.map((_, i) => { ctx.tile(V3(-5.25 + i * 1.5, 0.04, 0), 1.3, 1.3); return tag('0', 'ptr alt', -5.25 + i * 1.5, 0.9, 0.8); });
    const pages = [];
    const put = async (i, name, c) => { pages[i] = cube(name, C.orange, [1.1, 0.4, 1.1], -5.25 + i * 1.5, 0.2, 0, 3); cnt[i] = c; txt(slots[i], String(c)); await beat(tok, 500); };
    await put(0, 'A:p3', 1); await put(1, 'B:p0', 2); await put(3, 'A:p7', 1); await put(4, 'C:p1', 3);
    say('counter = 幾個 process 還在用', '0 = 空的 slot');
    await beat(tok, 2800);
    say('process 離開：它用到的 counter − 1', '');
    for (const i of [1, 4]) { cnt[i]--; txt(slots[i], String(cnt[i])); await beat(tok, 700); }
    cnt[0]--; txt(slots[0], '0'); fly(pages[0]);
    say('降到 0 → 這格可以給別人用', '一個 integer array 就管好了，不用 FS');
    await beat(tok, 3200);
  }
  async function scRaidWhy(tok) {
    fresh([0, 5.5, 11.5], [0, 1.2, 0]);
    say('RAID：用很多便宜硬碟湊起來', 'Redundant Arrays of Inexpensive Disks');
    const ds = [];
    for (let i = 0; i < 4; i++) { ds.push(cube('便宜 disk', C.gray, [1.8, 1, 1.2], -4.5 + i * 3, 0.5, -1, 3)); await beat(tok, 300); }
    await beat(tok, 1600);
    say('很多便宜的湊在一起 ≈ 一顆昂貴的', '目標：reliability 與 performance');
    await beat(tok, 2600);
    say('一、striping：切開放多顆 → 平行', '一顆 100–150 MB/s，兩顆一起讀約兩倍');
    const st = ['A0', 'A1', 'A2', 'A3'].map((n, i) => cube(n, C.blue, [1.4, 0.4, 0.8], -4.5 + i * 3, 1.25, -1, 3));
    await beat(tok, 2800);
    say('二、mirroring（replication）：備份', '同時壞很多顆的機率很小');
    const mr = cube('A0 副本', C.purple, [1.4, 0.4, 0.8], -1.5, 1.7, -1, 3);
    await beat(tok, 2600);
    say('三、coding：多存 redundant code', '用來偵錯甚至修補（parity）');
    cube('P', C.gold, [1.4, 0.4, 0.8], 4.5, 1.7, -1, 3);
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景：課本補充（恐龍書） ─────────────────────────
  async function scDiskStructure(tok) {
    fresh([0, 7.5, 8], [0, 0.4, 0]);
    const P = buildPlatter();
    let ang = 0;
    timer = setInterval(() => { ang += 0.05; P.g.rotation.y = ang; }, 30);
    say('課本：磁碟結構', 'platter 上一圈圈 track，切成 sector');
    await beat(tok, 2600);
    tag('track', 'ptr', -1.5 + 2.9, 1.0, 0.4); tag('sector', 'ptr', 0.6, 1.0, 1.4);
    say('同半徑的 track 合稱 cylinder', '磁頭一起移動');
    await beat(tok, 2600);
    say('1. seek：手臂移到目標 cylinder', 'seek time 通常最大');
    const x0 = P.arm.position.x;
    await anim(tok, 900, (u) => { P.arm.position.x = x0 - 1.2 * u; });
    await beat(tok, 1400);
    say('2. 旋轉延遲：等 sector 轉到下方', '平均半圈；7200 RPM → 4.17 ms');
    await beat(tok, 2600);
    say('3. transfer time', 'access time = seek + rotation + transfer');
    await beat(tok, 3000);
    stopTimer();
  }
  function schedScene(alg, dir, cap, extra) {
    return async (tok) => {
      fresh([0, 10.5, 8.2], [0, 0, 0.3]);
      say('課本：' + ALG[alg] + (dir ? (dir === 'up' ? '（往 199）' : '（往 0）') : ''), cap);
      drawAxis(BOOK_Q, 53);
      await beat(tok, 2400);
      lab.clear();
      const r = await runSched({ alg, head: 53, reqs: BOOK_Q, dir: dir || 'down', countJump: true }, tok);
      say(ALG[alg] + ' 總移動 ' + r.tot + ' cylinders', extra(r));
      await beat(tok, 3400);
    };
  }
  async function scRaidLevel(lv, tok) {
    fresh([0, 5, 12], [0, 1.4, 0]);
    const cap = { 0: '課本：RAID 0（striping）', 1: '課本：RAID 1（mirroring）', 5: '課本：RAID 5（distributed parity）' }[lv];
    newVals();
    say(cap, { 0: '資料切塊輪流寫到各顆', 1: '每塊寫兩份', 5: 'parity 輪流放在不同 disk' }[lv]);
    await drawRaid(lv, tok);
    await beat(tok, 2200);
    if (lv === 5) { say('parity = 同一列 data 的 XOR', 'P0 = B0 ⊕ B1 ⊕ B2'); RD.cells.filter((c) => c.row === 0).forEach((c) => glow(c.m, GOLD)); await beat(tok, 2600); RD.cells.forEach((c) => glow(c.m, null)); }
    say('disk 1 故障', '');
    await failDisk(1, tok);
    await beat(tok, 1600);
    await rebuild(tok);
    if (lv === 0) { await beat(tok, 2400); say('RAID 0：效能最好、容量 100%', '但沒有 redundancy'); }
    else if (lv === 1) say('RAID 1：可靠，容量剩 50%', '讀可以兩顆分攤');
    else say('RAID 5：容忍 1 顆故障，容量 (n−1)/n', 'RAID 4 用專用 parity disk → 寫入瓶頸');
    await beat(tok, 3200);
  }
  async function scIOScene(mode, tok) {
    fresh([0, 8.5, 9], [0, 0, 0.4]);
    const cap = { poll: ['課本：Polling（busy-waiting）', 'CPU 一直讀 status register 等 busy bit 清掉'], intr: ['課本：Interrupt-driven I/O', 'device 好了才發 interrupt，CPU 先做別的'], dma: ['課本：DMA', 'CPU 只設定 DMA，整塊搬完才 interrupt'] }[mode];
    say(cap[0], cap[1]);
    const r = await drawIO(mode, 4, tok);
    const end = { poll: ['橘色全是空等', 'device 很快時 polling 反而划算'], intr: ['每傳一個字 interrupt 一次', '大量資料時 interrupt 成本很高'], dma: ['只 interrupt 一次', '紅色 = cycle stealing：DMA 偷用 memory bus'] }[mode];
    say(end[0], 'CPU 有效工作 ' + r.useful + ' / ' + r.T + ' 時間單位');
    await beat(tok, 2600);
    say(end[1], '');
    await beat(tok, 2800);
  }
  async function scBuffering(tok) {
    fresh([0, 6, 11], [0, 1, 0]);
    say('課本：Buffering', '解決速度不匹配，例如 modem → disk');
    const dev = cube('modem（慢）', C.teal, [2, 0.8, 1.2], -5, 0.4, -1.2), dk = cube('disk（快）', C.blue, [2, 0.8, 1.2], 5, 0.4, -1.2);
    const b1 = cube('buffer 1', C.gray, [1.8, 0.5, 1], -1.2, 0.25, -1.2), b2 = cube('buffer 2', C.gray, [1.8, 0.5, 1], 1.2, 0.25, -1.2);
    for (let k = 0; k < 2; k++) {
      tint(b1, C.orange); say('double buffering：填 buffer 1', '同時把 buffer 2 寫到 disk'); tint(b2, k ? C.green : C.gray); await beat(tok, 1600);
      tint(b1, C.green); tint(b2, C.orange); say('兩個 buffer 角色交換', '生產者、消費者不用互等'); await beat(tok, 1600);
    }
    say('Caching：在快的記憶體放一份副本', 'buffer 可能是唯一一份；cache 一定是副本');
    cube('cache（副本）', C.purple, [2.4, 0.5, 1], 0, 0.25, 1.2, 2);
    await beat(tok, 3000);
    say('Spooling：印表機一次只能印一份', '各 process 的輸出先放 disk 排隊');
    const jobs = ['P1 輸出', 'P2 輸出', 'P3 輸出'].map((n, i) => cube(n, C.orange, [1.6, 0.4, 0.8], -4 + i * 1.9, 0.2, 3.0, 3));
    const pr = cube('printer', C.gray, [1.6, 0.8, 1], 4.6, 0.4, 3.0);
    await beat(tok, 2200);
    for (const j of jobs) { move(j, 4.6, 1.0, 3.0); await beat(tok, 700); fly(j, V3(2, 6, -2)); await beat(tok, 300); }
    say('一份印完才送下一份', 'spool = 讓獨占裝置可被多個 process 共用');
    await beat(tok, 3000);
  }

  const scenes = {
    'disk-structure': { title: '課本：磁碟結構與 access time', play: scDiskStructure },
    'sched-fcfs': { title: '課本：FCFS 排程（640）', play: schedScene('fcfs', null, '照到達順序：98, 183, 37, 122 …', () => '左右亂跳') },
    'sched-sstf': { title: '課本：SSTF 排程（236）', play: schedScene('sstf', null, '每次挑離 head 最近的', () => '不一定最佳；可能 starvation') },
    'sched-scan': { title: '課本：SCAN 電梯法', play: schedScene('scan', 'down', '先往 0 走到底，再回頭', (r) => '53 + 183 = ' + r.tot) },
    'sched-cscan': { title: '課本：C-SCAN 單向服務', play: schedScene('cscan', 'up', '往 199 服務到底，跳回 0 再往上', (r) => '回程 ' + r.ret + ' 計入；不計則 ' + r.noRet) },
    'sched-look': { title: '課本：LOOK', play: schedScene('look', 'down', 'SCAN 但只走到最遠的請求 14', (r) => '39 + 169 = ' + r.tot) },
    'sched-clook': { title: '課本：C-LOOK', play: schedScene('clook', 'up', 'C-SCAN 但只走到 183，跳回 14', (r) => '回程 ' + r.ret + ' 計入；不計則 ' + r.noRet) },
    'low-format': { title: 'Low-level formatting：header / data / trailer', play: scLowFormat },
    'boot-flow': { title: 'Booting：ROM → boot block → FS → OS', play: scBoot },
    'bad-simple': { title: '壞軌：simple disk 只能標記', play: scBadSimple },
    'sector-sparing': { title: 'Sector sparing：spare 頂替 sector 4', play: scSparing },
    'sector-slipping': { title: 'Sector slipping：往後挪一格', play: scSlipping },
    'swap-where': { title: 'Swap space：檔案 vs raw partition', play: scSwapWhere },
    'swap-policy': { title: 'Swap 策略：只在 page out 時存動態資料', play: scSwapPolicy },
    'swap-map': { title: 'Swap map：每個 slot 一個 counter', play: scSwapMap },
    'raid-why': { title: 'RAID 的目的與三個技巧', play: scRaidWhy },
    'raid-0': { title: '課本：RAID 0 striping', play: (tok) => scRaidLevel(0, tok) },
    'raid-1': { title: '課本：RAID 1 mirroring', play: (tok) => scRaidLevel(1, tok) },
    'raid-5': { title: '課本：RAID 5 parity 重建', play: (tok) => scRaidLevel(5, tok) },
    'io-polling': { title: '課本：Polling 時間軸', play: (tok) => scIOScene('poll', tok) },
    'io-interrupt': { title: '課本：Interrupt-driven I/O 時間軸', play: (tok) => scIOScene('intr', tok) },
    'io-dma': { title: '課本：DMA 時間軸', play: (tok) => scIOScene('dma', tok) },
    'buffering': { title: '課本：Buffering、caching、spooling', play: scBuffering },
  };

  return {
    kicker: '作業系統・第 10 章',
    title: 'I/O 系統與磁碟',
    color: 'var(--os)',
    modes: [
      { id: 'sched', name: '磁碟排程', enter: () => { clearLog(); enterSched(); } },
      { id: 'io', name: 'Polling / 中斷 / DMA', enter: () => { clearLog(); enterIO(); } },
      { id: 'raid', name: 'RAID', enter: () => { clearLog(); enterRaid(); } },
      { id: 'disk', name: '存取時間', enter: () => { clearLog(); enterDisk(); } },
      { id: 'bad', name: '壞軌處理', enter: () => { clearLog(); enterBad(); } },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'disk-structure', 'sched-fcfs', 'sched-sstf', 'sched-scan', 'sched-cscan', 'sched-look', 'sched-clook',
      'low-format', 'boot-flow', 'bad-simple', 'sector-sparing', 'sector-slipping', 'swap-where', 'swap-policy', 'swap-map',
      'raid-why', 'raid-0', 'raid-1', 'raid-5', 'io-polling', 'io-interrupt', 'io-dma', 'buffering',
    ],
    stop() { stopTimer(); busy = false; },
  };
}
