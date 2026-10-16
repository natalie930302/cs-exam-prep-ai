// 作業系統 第10章：I/O 系統與 Mass Storage（磁碟排程、RAID、polling / interrupt / DMA、壞軌、swap）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
// 影片：清大 周志遠 第26A–26D講（26B 有字幕，場景依字幕重現；其餘依恐龍書 Ch.11–12 補）。
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ io.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, icon, dim } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 10 章 Mass Storage / I/O（清大 周志遠 26A–26D 講 + SCAN 英文短片）— cued scenes ───
// Every scene is a list of steps; each step waits for the lecturer's sentence (notes "cues"), then makes one short move.
// Nothing loops or replays. 磁碟排程用老師（＝恐龍書）的 queue：head 53，98,183,37,122,14,124,65,67，cylinder 0–199；
// 磁頭順序與總移動都由本模組的 schedule() 算出來（不是手寫），最後再跟 seekTotal() 對一次。老師沒給的數字標「示意」。
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
const MC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', gold: '#c08a1f', lilac: '#dfd3fb', mint: '#d2f1e6', sky: '#cfe6f7' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const CAMW = [[0, 4.6, 15.5], [0, 3.0, 0]];
const CAMD = [[0, 10.5, 8.6], [0, 0, 0.3]];          // disk-scheduling view (from above)
const CAMP = [[0, 7.0, 9.5], [0, 0.8, 0]];           // platter view

// ── 磁碟（platter）：沿用模組的 buildPlatter()，慢慢轉 ──
function platter() {
  const Pl = buildPlatter();
  if (lab.onFrame) lab.onFrame((dt) => { if (Pl.g.parent) Pl.g.rotation.y += dt * 0.9; });
  return Pl;
}

// ── 磁碟排程舞台：cylinder 軸 + request 標記 + 磁頭；go() 一次走到一個 request ──
const QH = 53, QQ = BOOK_Q;                          // 老師的例子（同恐龍書）
const X = (c) => -6 + c * 12 / 199;
function dsk(head, reqs, o = {}) {
  const z0 = -3.3;
  const D = { cur: head, z: -2.7, tot: 0, dz: o.dz || 0.6, mk: {}, parts: [], lbl: {} };
  bx('', '#6e5f49', 0, 0.03, z0, 12.2, 0.06, 0.06);
  for (const t of [0, 199]) sm(String(t), X(t), 0.05, z0 + 0.55);
  sm('cylinder', 6.75, 0.05, z0);
  [...reqs].sort((a, b) => a - b).forEach((r, i) => {
    D.mk[r] = bx('', MC.orange, X(r), 0.25, z0, 0.16, 0.5, 0.16);
    D.lbl[r] = hd(String(r), X(r), 0.75, i % 2 ? z0 - 0.45 : z0 - 0.95);
  });
  D.hm = bx('', MC.blue, X(head), 0.2, D.z, 0.4, 0.4, 0.4);
  D.hl = hot('head ' + head, X(head) - 0.9, 0.6, D.z);
  D.tl = hot('總移動 0', 4.8, 0.6, 4.3);
  D.go = async (tok, to, jump = false) => {
    const from = D.cur, d = Math.abs(to - from), zA = D.z, z1 = D.z + D.dz;
    seg(V3(X(from), 0.2, zA), V3(X(to), 0.2, z1), jump ? '#d64545' : '#2f6fb0');
    await anim(tok, jump ? 500 : Math.min(1300, 300 + d * 5), (u) => D.hm.position.set(X(from + (to - from) * u), 0.2, zA + D.dz * u));
    if (!jump) { D.tot += d; D.parts.push(d); }
    txt(D.tl, '總移動 ' + D.tot);
    if (D.mk[to]) tint(D.mk[to], MC.green);
    D.cur = to; D.z = z1; return d;
  };
  D.jumpTo = (to, jump = false) => {   // 不播動畫，直接畫好（用在重畫整條路線）
    const from = D.cur, d = Math.abs(to - from), z1 = D.z + D.dz;
    seg(V3(X(from), 0.2, D.z), V3(X(to), 0.2, z1), jump ? '#d64545' : '#2f6fb0');
    D.hm.position.set(X(to), 0.2, z1);
    if (!jump) { D.tot += d; D.parts.push(d); }
    txt(D.tl, '總移動 ' + D.tot); if (D.mk[to]) tint(D.mk[to], MC.green);
    D.cur = to; D.z = z1; return d;
  };
  return D;
}
// 一步一個 request：順序由 schedule() 算出
function moves(alg, dir, name) {
  return schedule(alg, QH, QQ, dir).map((s) => async (tok, S) => {
    const d = await S.D.go(tok, s.to, !!s.jump);
    if (s.jump) cap('直接拉回 ' + s.to + '（途中不讀，不計）', name + '：累計 ' + S.D.tot);
    else if (!S.D.mk[s.to]) cap('走到盡頭 ' + s.to + '（+' + d + '）', name + '：累計 ' + S.D.tot);
    else cap('→ ' + s.to + '（+' + d + '）', name + '：累計 ' + S.D.tot);
  });
}
// 跟模組的 seekTotal()（回程不計）對一次；不一致時 log 警告
function chk(D, alg, dir) {
  const want = seekTotal(QH, schedule(alg, QH, QQ, dir), false).tot;
  if (D.tot !== want) log(ALG[alg] + ' total ' + D.tot + ' != ' + want, true);
  return want;
}
const sumText = (D) => D.parts.join('+') + ' = ' + D.tot;

// ════════ Ui3Pei65U80（第 26A 講：Disk scheduling） ════════
scene('io-26a-goal', 'Disk scheduling 的目的：減少 seek time', CAMP, [
  async (tok, S) => {                                   // 21 接續：disk scheduling 目的
    S.P = platter(); sm('platter', -1.5, 0.2, 3.9); hd('read-write head', 4.8, 1.4, 0);
    cap('Disk scheduling', '目的：改善硬碟讀取資料的時間');
  },
  async (tok, S) => {                                   // 45 access time = seek + rotation + transfer
    S.b1 = bx('seek', MC.blue, -3.6, 4.4, -2, 2.6, 0.55, 0.6);
    S.b2 = bx('rotation', MC.purple, -0.8, 4.4, -2, 2.6, 0.55, 0.6);
    S.b3 = bx('transfer', MC.green, 1.8, 4.4, -2, 2.4, 0.55, 0.6);
    sm('+', -2.2, 4.4, -1.5); sm('+', 0.5, 4.4, -1.5); hot('讀一次的時間 =', -3.6, 5.2, -2);
    cap('讀一次 = 三段時間相加', 'seek ＋ rotational latency ＋ transfer');
  },
  async (tok, S) => {                                   // 58 能減少的是 seek：讀寫頭移動
    glow(S.b1, HL);
    const x0 = S.P.arm.position.x; await anim(tok, 900, (u) => { S.P.arm.position.x = x0 - 1.2 * u; });
    cap('disk scheduling 能減少的是 seek time', '也就是讀寫頭（手臂）移動的時間');
  },
  async (tok, S) => {                                   // 68 機械式移動 → 慢
    bad('機械移動：慢！', 4.6, 2.6, 0);
    cap('讀寫頭移動是機械式的', '相對很久 → 目標：minimize seek time');
  },
  async (tok, S) => {                                   // 82 seek time ≈ seek distance
    good('seek time ≈ seek distance（移動距離）', 0, 3.4, -2);
    cap('seek time 就看 seek distance', '磁頭要移動多遠');
  },
  async (tok, S) => {                                   // 91 介紹幾個基本演算法
    ['FCFS', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK', 'C-LOOK'].forEach((n, i) => hd(n, -5 + i * 2, 6.2, -2));
    cap('接下來介紹幾個基本演算法', '實際系統以它們為基礎再修改');
  },
]);

scene('io-26a-input', '排程的輸入：request queue 與 track number', CAMP, [
  async (tok, S) => {                                   // 105 FCFS 最基本
    S.P = platter();
    hd('FCFS：first come, first served', -1.0, 5.6, -2);
    cap('第一個：first come, first served', '最基本的做法，很多管理問題都用得上');
  },
  async (tok, S) => {                                   // 119 input = list of locations
    note('input：一串要讀的位置（request）', -1.0, 4.9, -2);
    cap('排程的輸入', '一串要讀寫的位置（request）');
  },
  async (tok, S) => {                                   // 126 位置 = cylinder + track + sector
    hd('track', 1.4, 1.2, 0.4); hd('sector', 0.6, 1.0, 1.6); hd('cylinder = 各盤面同半徑的 track', -1.5, 2.2, -3.2);
    cap('讀寫位置 = 第幾 cylinder、track、sector', '同半徑的 track 疊起來叫 cylinder');
  },
  async (tok, S) => {                                   // 137 只有 track number 跟磁頭移動有關
    const x0 = S.P.arm.position.x; await anim(tok, 900, (u) => { S.P.arm.position.x = x0 - 1.8 * u; });
    good('磁頭移動距離只看 track（cylinder）number', -1.0, 4.2, -2);
    cap('跟磁頭移動有關的只有 track number', '所以只看這個號碼');
  },
  async (tok, S) => {                                   // 158 系統送來的 request
    QQ.forEach((r, i) => bx(String(r), MC.orange, -5.2 + i * 1.5, 6.6, -2, 1.2, 0.5, 0.5));
    sm('queue', -6.6, 6.6, -2);
    cap('driver 看到的 request queue', '98, 183, 37, 122, 14, 124, 65, 67');
  },
]);

scene('io-26a-fcfs', 'FCFS：照到達順序（總移動 640）', CAMD, [
  async (tok, S) => {                                   // 172 head 目前在 53
    S.D = dsk(QH, QQ, { dz: 0.68 });
    cap('磁頭目前在 cylinder 53', 'queue：98, 183, 37, 122, 14, 124, 65, 67');
  },
  async (tok, S) => {                                   // 184 FCFS：照順序
    QQ.forEach((r, i) => sm('#' + (i + 1), X(r), 0.9, -3.3 + (i % 2 ? -0.45 : -0.95) - 0.4));
    cap('FCFS：不管現在在哪', '就照到達順序一個一個讀');
  },
  ...moves('fcfs', null, 'FCFS'),                      // 185–204 一句一個 request
  async (tok, S) => {                                   // 206 加起來
    const want = chk(S.D, 'fcfs'); hot(sumText(S.D), -1.0, 0.6, 4.6);
    cap('把每段距離加起來 = ' + want + ' cylinders', '移動距離就代表花的時間');
  },
  async (tok, S) => {                                   // 212 看運氣
    note('沒有任何安排：看運氣', -3.0, 0.6, 5.4);
    cap('FCFS 沒有任何安排', '好不好全看運氣');
  },
  async (tok, S) => {                                   // 224 zigzag
    bad('來回 zigzag → 很多重複的距離', 2.6, 0.6, 5.4);
    cap('路徑一直左右來回（zigzag）', '重複走很多距離 → 效能差');
  },
]);

scene('io-26a-sstf', 'SSTF：每次挑最近的（總移動 236）', CAMD, [
  async (tok, S) => {                                   // 242 避免移太遠
    S.D = dsk(QH, QQ, { dz: 0.68 });
    cap('第二種：避免移動太遠', '每次都移到最近的下一個位置');
  },
  async (tok, S) => {                                   // 253 SSTF
    hot('SSTF：Shortest Seek Time First', -1.0, 0.6, 5.2);
    cap('Shortest Seek Time First（SSTF）', '以目前的距離來挑');
  },
  async (tok, S) => {                                   // 258 一樣在 53
    glow(S.D.hm, HL);
    cap('同樣這些 request，head 一樣在 53', '先看每個 request 離 53 多遠');
  },
  async (tok, S) => {                                   // 262 列出距離
    S.dl = QQ.map((r) => sm('|' + r + '−53|=' + Math.abs(r - QH), X(r), 0.2, -2.2 + (r % 3) * 0.35));
    cap('距離：98→45、183→130、37→16 …', '65 只差 12，最近');
  },
  ...moves('sstf', null, 'SSTF').map((f, i) => (i ? f : async (tok, S) => { gone(S.dl); glow(S.D.hm, null); await f(tok, S); })),   // 268–285 一句一個
  async (tok, S) => {                                   // 286 236
    const want = chk(S.D, 'sstf'); hot(sumText(S.D), -1.0, 0.6, 4.9);
    cap('總移動 ' + want + ' cylinders', '比 FCFS 的 640 好很多');
  },
  async (tok, S) => {                                   // 295 不保證最好
    bad('但不保證是最好的', -3.4, 0.6, 5.6);
    cap('注意：SSTF 不保證最好', '它只看「目前」的結果');
  },
  async (tok, S) => {                                   // 307 online：新 request 不斷進來
    const n = bx('新', MC.pink, X(160), 0.25, -3.3, 0.16, 0.5, 0.16); sm('新 request（示意）', X(160), 1.0, -4.3);
    cap('系統一直在跑（online）', '移動完又會有新的 request 進來');
  },
  async (tok, S) => {                                   // 321 greedy
    note('greedy：只挑眼前最近的', 2.4, 0.6, 5.6);
    cap('看不見未來，只是 greedy 地移到最近', '可能一下子被拉到很遠');
  },
  async (tok, S) => {                                   // 358 還是有 zigzag
    bad('67 → 37：往回走的重複路徑', 0, 0.6, 6.3);
    cap('結果裡還是有回頭路（zigzag）', '兩邊距離很接近時，往哪走都不一定好');
  },
]);

scene('io-26a-scan', 'SCAN：先往一邊掃到底再折返（總移動 236）', CAMD, [
  async (tok, S) => {                                   // 390 第三種 SCAN
    S.D = dsk(QH, QQ, { dz: 0.62 });
    cap('第三種：SCAN', '先往一邊走，再往另一邊走');
  },
  async (tok, S) => {                                   // 401 不管 request，traverse
    note('不管 request 在哪：一路掃過去', -2.6, 0.6, 5.3);
    cap('不管有什麼 request', '就是一路 traverse 整顆磁碟');
  },
  async (tok, S) => {                                   // 408 從 53 先往左
    S.ar = arrow(V3(X(53), 0.9, -2.2), V3(X(20), 0.9, -2.2), 0x2f6fb0);
    cap('從 53 開始，先往左（往 0）', '到底之後再往右');
  },
  ...moves('scan', 'down', 'SCAN').map((f, i) => (i ? f : async (tok, S) => { gone(S.ar); await f(tok, S); })),   // 411–431
  async (tok, S) => {                                   // 437 = 236
    const want = chk(S.D, 'scan', 'down'); hot(sumText(S.D) + '（= 53 + 183）', -1.0, 0.6, 4.6);
    cap('總移動 ' + want + ' cylinders', '這個例子剛好跟 SSTF 一樣');
  },
  async (tok, S) => {                                   // 443 SSTF 容易來回擺動
    good('SCAN 只來回一趟，不會左右擺動', -1.0, 0.6, 5.5);
    cap('有時 SCAN 反而更好', 'SSTF 受 request 位置影響，容易來回擺');
  },
  async (tok, S) => {                                   // 455 IO 很慢，queue 裡又有新 request
    [30, 110, 170].forEach((c) => bx('', MC.pink, X(c), 0.25, -3.3, 0.16, 0.5, 0.16)); sm('移動時新來的 request（示意）', X(110), 1.0, -4.4);
    cap('I/O 很慢，掃的同時 queue 又進來很多', '順路就把它們讀掉');
  },
]);

scene('io-26a-wait', 'SCAN 的問題：兩端的等待時間不平均', CAMD, [
  async (tok, S) => {                                   // 479 SCAN 有一個問題
    bx('', '#6e5f49', 0, 0.03, -1, 12.2, 0.06, 0.06); sm('0', X(0), 0.05, -0.4); sm('199', X(199), 0.05, -0.4);
    S.h = bx('', MC.blue, X(150), 0.2, -1, 0.4, 0.4, 0.4); S.ar = arrow(V3(X(150), 0.8, -1), V3(X(185), 0.8, -1), 0x2f6fb0);
    cap('SCAN 有一個問題', '看兩端的 request 要等多久');
  },
  async (tok, S) => {                                   // 494 兩邊等待時間不平均
    S.r = bx('R', MC.orange, X(192), 0.3, -1, 0.5, 0.6, 0.5); hd('在最右邊的 request', X(192) - 0.8, 1.2, -1.8);
    cap('兩邊的 request', '在 queue 裡等的時間很不平均');
  },
  async (tok, S) => {                                   // 510 運氣好：馬上被讀
    await anim(tok, 900, (u) => { S.h.position.x = X(150 + 42 * u); }); tint(S.r, MC.green);
    good('運氣好：磁頭正要過來 → 幾乎不用等', 0, 0.6, 1.2);
    cap('運氣好：磁頭剛好正要過來', '馬上就被讀到');
  },
  async (tok, S) => {                                   // 535 運氣不好：剛 miss，要等兩趟
    tint(S.r, MC.red); gone(S.ar);
    S.a1 = arrow(V3(X(192), 0.8, 2.2), V3(X(5), 0.8, 2.2), 0xd64545); S.a2 = arrow(V3(X(5), 0.8, 3.0), V3(X(192), 0.8, 3.0), 0xd64545);
    bad('剛好錯過：要等磁頭掃到另一端再回來（兩趟）', 0, 0.6, 4.0);
    cap('運氣不好：磁頭剛好過去', '要等它走到底、再走回來：兩趟');
  },
  async (tok, S) => {                                   // 559 要嘛很快要嘛很慢
    note('等待時間忽長忽短 → I/O 不穩定', 0, 0.6, 5.0);
    cap('兩端的等待：要嘛接近 0，要嘛很久', 'I/O 時間變得不穩定');
  },
  async (tok, S) => {                                   // 572 中間：平均一圈
    const m = bx('M', MC.purple, X(100), 0.3, -1, 0.5, 0.6, 0.5); hd('中間的 request', X(100), 1.2, -1.8);
    good('中間的：半趟 + 半趟，平均剛好一趟', 0, 0.6, 5.9);
    cap('中間的 request 比較穩定', '半趟加半趟，平均就是一趟');
  },
]);

scene('io-26a-cscan', 'C-SCAN：只單向服務，到底直接拉回（總移動 183）', CAMD, [
  async (tok, S) => {                                   // 589 C-SCAN
    S.D = dsk(QH, QQ, { dz: 0.56 });
    cap('改善等待時間：C-SCAN', 'Circular SCAN');
  },
  async (tok, S) => {                                   // 598 等待時間都平均
    note('目標：不管 request 在哪，等待時間都一樣', -1.0, 0.6, 5.6);
    cap('不管 request 在哪個位置', '大家的等待時間都很平均');
  },
  async (tok, S) => {                                   // 613 round robin 最 fair
    hd('像 round robin：輪完一圈再從頭', -1.0, 0.6, 6.2);
    cap('概念就是 round robin', 'round robin 最公平');
  },
  ...moves('cscan', 'up', 'C-SCAN').slice(0, 7),       // 622–634 往右服務、走到 199
  moves('cscan', 'up', 'C-SCAN')[7],                   // 637 直接拉回 0
  async (tok, S) => {                                   // 639 這段距離不算
    bad('紅線：看起來很長，但途中不讀資料 → 不算', -1.6, 0.6, 3.3);
    cap('中間這段看似很長，其實不算', '沒讀任何資料，直接拉過去很快');
  },
  ...moves('cscan', 'up', 'C-SCAN').slice(8),          // 646–649 再往右讀 14、37
  async (tok, S) => {                                   // 659 只往一個方向
    good('只往一個方向讀寫', 3.4, 0.6, 5.0);
    cap('C-SCAN 只往一個方向做讀寫', '到底就直接拉回原點');
  },
  async (tok, S) => {                                   // 669 wait time uniform；總移動
    const want = chk(S.D, 'cscan', 'up'); hot(sumText(S.D) + '（回程 199 不算）', -1.0, 0.6, 6.4);
    cap('錯過了也只要等一趟 → 等待平均', '總移動 ' + want + '（不算跳回的 199）');
  },
]);

scene('io-26a-look', 'LOOK / C-LOOK：只走到最遠的 request（C-LOOK 總移動 153）', CAMD, [
  async (tok, S) => {                                   // 713 SCAN 一格一格移動
    S.D = dsk(QH, QQ, { dz: 0.5 });
    cap('回頭看 SCAN', '不管 request 在哪，一個 position 一個 position 移');
  },
  async (tok, S) => {                                   // 739 一定走到 0 和最後
    S.e0 = bad('request 裡沒有 0，SCAN 還是走到 0', X(0) + 1.4, 0.6, -1.9);
    cap('SCAN 一定走到 0 和最後一格', '我們的 request 其實沒有 0');
  },
  async (tok, S) => {                                   // 751 183 → 199 多餘
    S.e1 = bad('最後是 183，卻走到 199', X(199) - 1.5, 0.6, -1.9);
    cap('最後一個 request 是 183', '卻走到 199：兩端多走了冤枉路');
  },
  async (tok, S) => {                                   // 787 LOOK 與 C-LOOK
    gone(S.e0, S.e1);
    const look = seekTotal(QH, schedule('look', QH, QQ, 'down'), false).tot;
    note('LOOK：雙向（像 SCAN）；C-LOOK：單向（像 C-SCAN）', -1.0, 0.6, 5.6);
    sm('同一組 queue：LOOK 先往 0 = ' + look, -1.0, 0.6, 6.3);
    cap('另一種做法：LOOK', '分 LOOK（雙向）和 C-LOOK（單向）');
  },
  async (tok, S) => {                                   // 800 例子是 C-LOOK
    cap('老師的例子是 C-LOOK', '一樣只往右邊讀');
  },
  ...moves('clook', 'up', 'C-LOOK'),                   // 801–809 一句一個（含跳回 14）
  async (tok, S) => {                                   // 811 跟 SCAN 很像
    note('看起來跟 C-SCAN 很像', 3.4, 0.6, 3.6);
    cap('C-LOOK 跟 C-SCAN 看起來很像', '最大差別在兩端');
  },
  async (tok, S) => {                                   // 818 不會走到 0 和 199
    const want = chk(S.D, 'clook', 'up'); hot(sumText(S.D) + '（跳回 169 不算）', -1.0, 0.6, 4.6);
    cap('不走到 0 和 199，只到最遠的 request', '總移動 ' + want + ' cylinders');
  },
  async (tok, S) => {                                   // 827 look = lookup queue
    good('LOOK = 先 look（查看）queue 裡的 request', -1.0, 0.6, 5.4);
    cap('為什麼叫 LOOK？', '它會先看 queue 裡 request 的位置再決定');
  },
  async (tok, S) => {                                   // 839 往單側最近的移動
    note('往單一方向最近的那個走', -1.0, 0.6, 6.1);
    cap('決定方式：往單側最近的 request 移動', '其實跟 SSTF 很像');
  },
  async (tok, S) => {                                   // 866 SSTF 不管左右；C-LOOK 只往右
    sm('SSTF：左右都看，挑最近 ｜ C-LOOK：只看右邊的最近', -1.0, 0.6, 6.8);
    cap('SSTF 不管左右，挑最近的', 'C-LOOK 只挑右邊最近的');
  },
]);

scene('io-26a-compare', 'LOOK 的缺點與各演算法比較', CAM, [
  async (tok, S) => {                                   // 889 runtime 時 C-LOOK 像 SSTF
    S.rows = [['SSTF', MC.blue], ['SCAN', MC.green], ['C-SCAN', MC.teal], ['LOOK / C-LOOK', MC.purple]].map(([n, c], i) => bx(n, c, -4.2, 5.2 - i * 1.2, 0, 3.0, 0.7, 0.8));
    note('request 不斷變動時：C-LOOK 的行為像 SSTF', 1.6, 5.2 - 3 * 1.2);
    cap('執行時 queue 一直在變', 'C-LOOK 的長相其實比較像 SSTF');
  },
  async (tok, S) => {                                   // 899 好處：不到兩端極側
    good('LOOK 好處：不走到兩端', 1.6, 1.0);
    cap('LOOK 的好處', '跟 SCAN 比，不會移到最極端的兩側');
  },
  async (tok, S) => {                                   // 915 缺點：移動太快
    bad('LOOK 缺點：一次就跳到下一個 request', 1.6, 0.3);
    cap('缺點：行為接近 SSTF', '有時移動得太快');
  },
  async (tok, S) => {                                   // 925 SCAN 每個位置檢查
    S.h = bx('', MC.blue, -1.6, 1.4 + 2.4, 0, 0.35, 0.35, 0.35);
    await anim(tok, 1200, (u) => { S.h.position.x = -1.6 + 5.2 * u; }); bx('', MC.pink, 1.0, 3.8, 0, 0.16, 0.5, 0.16); tint(S.rows[1], MC.green);
    good('SCAN：每個位置都看 → 路上新來的順便讀', 1.6, 4.4);
    cap('SCAN 每一個位置都會檢查', '路上有新 request 就順便讀出來');
  },
  async (tok, S) => {                                   // 952 LOOK 直接跳 → miss
    bad('LOOK：直接跳過去 → 中間新來的都 miss', 1.6, 2.0);
    cap('LOOK 從這裡直接跳到那裡', '這段時間新來的 request 全都 miss');
  },
  async (tok, S) => {                                   // 976 總結：SSTF 最直覺
    glow(S.rows[0], HL);
    cap('總結：SSTF 最直覺', '但不一定給出最好的結果');
  },
  async (tok, S) => {                                   // 995 移動快 → miss
    sm('移動快 → 途中 miss 比較多 request', 1.6, 5.8);
    cap('SSTF 移動比較快', '移動途中可能 miss 掉比較多 request');
  },
  async (tok, S) => {                                   // 1008 左右擺盪
    sm('會左右擺盪 → 長期效能不一定好', 1.6, 5.3);
    cap('還可能左右擺盪', '長期來看效能不一定最好');
  },
  async (tok, S) => {                                   // 1020 loading 重 → SCAN
    glow(S.rows[0], null); glow(S.rows[1], OKG);
    good('loading 重（到處都有 request）→ SCAN 好', 1.6, 6.6);
    cap('loading 很重時：SCAN 比較好', '移動途中一直有 request 可以順便讀');
  },
  async (tok, S) => {                                   // 1040 loading 輕 → SSTF
    glow(S.rows[0], OKG);
    good('loading 輕 → SSTF 好（直接跳過去）', -4.2, 6.6);
    cap('loading 輕時：SSTF 比較好', '中間沒人來，乾脆直接跳過去');
  },
  async (tok, S) => {                                   // 1059 SCAN 不會 starvation
    glow(S.rows[0], null); glow(S.rows[1], null);
    sm('SCAN：不會 starvation', -1.6, 4.0);
    cap('SCAN 乖乖一步一步讀', '而且不會 starvation');
  },
  async (tok, S) => {                                   // 1069 C-SCAN、C-LOOK 等待平均
    glow(S.rows[2], OKG); sm('C-SCAN / C-LOOK：等待平均', -1.6, 2.8);
    cap('C-SCAN、C-LOOK', '等待時間很平均');
  },
  async (tok, S) => {                                   // 1079 SSTF starvation
    glow(S.rows[2], null); glow(S.rows[0], NG);
    bad('SSTF：可能卡在某一區 → 遠處 request starvation', -1.6, 6.0);
    cap('SSTF 可能一直卡在某個區域', '另一側的 request 等非常久：starvation');
  },
  async (tok, S) => {                                   // 1090 LOOK 像 SSTF 但沒有 starvation
    glow(S.rows[0], null); glow(S.rows[3], OKG);
    good('LOOK：像 SSTF，但只往單側 → 解決 starvation', -1.6, 1.6);
    cap('LOOK 像 SSTF', '但只往單側移動，不會被困住 → 沒有 starvation');
  },
]);

scene('io-26a-fs', 'Disk scheduling 要和 file system 配合', CAM, [
  async (tok, S) => {                                   // 1114 減 seek distance
    S.dk = prop('disk', 4.6, 0, 0, 1.4, 'disk');
    cap('disk scheduling：減少 seek distance', '但要從整個 I/O 的角度來看');
  },
  async (tok, S) => {                                   // 1127 跟 FS 放資料的方式有關
    S.fs = bx('file system：data 怎麼擺', MC.green, -3.0, 4.6, 0, 5.0, 0.7, 0.8);
    cap('要跟 file system 一起看', '資料為什麼分散、要來回讀？');
  },
  async (tok, S) => {                                   // 1137 凌亂分散 ↔ FS 管理
    S.bl = [0, 1, 2, 3].map((i) => bx('f' + i, MC.orange, -5 + [0, 3.2, 1.0, 4.4][i], 2.8, 0, 0.8, 0.5, 0.6));
    cap('讀寫凌亂、分散', '跟 FS 怎麼放 data 息息相關');
  },
  async (tok, S) => {                                   // 1151 不連續 → 最佳化有限
    bad('FS 沒有連續擺 → 底層再怎麼排也有限', -2.0, 1.8);
    cap('如果 FS 一開始就沒連續擺', '底層再怎麼最佳化都有限');
  },
  async (tok, S) => {                                   // 1165 很多使用者
    gone(S.bl);
    S.u1 = buddy('使用者 A', '', MC.blue, -5.2, 0, 1.5, 0.7); S.u2 = buddy('使用者 B', '', MC.purple, -3.2, 0, 1.5, 0.7);
    cap('就算 FS 擺得很連續', '硬碟也不是只有一個使用者在用');
  },
  async (tok, S) => {                                   // 1180 request 混在一起
    S.ra = [1, 2, 3].map((k) => bx('A' + k, MC.blue, -4.6 + k * 0.9, 3.0, 0, 0.8, 0.5, 0.6));
    S.rb = [1, 2, 3].map((k) => bx('B' + k, MC.purple, -4.6 + k * 0.9, 2.3, 0, 0.8, 0.5, 0.6));
    cap('大家同時用同一顆硬碟', 'request 會混在一起');
  },
  async (tok, S) => {                                   // 1192 兩個人都在 sequential 讀
    note('A、B 各自都是循序（sequential）讀', -2.4, 3.8);
    cap('兩個人各自都是循序在讀', '…');
  },
  async (tok, S) => {                                   // 1204 合起來 → random
    const ord = [S.ra[0], S.rb[0], S.ra[1], S.rb[1], S.ra[2], S.rb[2]];
    const st = ord.map((m) => m.position.clone());
    await anim(tok, 1000, (u) => ord.forEach((m, i) => { m.position.set(st[i].x + (-3.6 + i * 0.9 - st[i].x) * u, st[i].y + (2.0 - st[i].y) * u, 0); }));
    bad('到了硬碟：A1 B1 A2 B2 … 變成 random', 1.0, 1.5);
    cap('合起來到了硬碟', 'I/O pattern 就變成 random 了');
  },
  async (tok, S) => {                                   // 1213 disk scheduling 重組回連續
    good('disk scheduling 把它重組回比較連續的順序', 1.0, 0.6);
    cap('最底層的 disk scheduling', '把它重組回有效率的連續順序：上下層都要配合');
  },
]);

scene('io-26a-recap', '總結：記得算 seek distance', CAM, [
  async (tok, S) => {                                   // 1227 這就是 disk scheduling
    cap('這就是 disk scheduling', '同一組 queue：head 53');
  },
  async (tok, S) => {                                   // 1229 記得幾個基本演算法
    const rows = [['fcfs', null], ['sstf', null], ['scan', 'down'], ['cscan', 'up'], ['clook', 'up']];
    rows.forEach(([a, d], i) => {
      const t = seekTotal(QH, schedule(a, QH, QQ, d), false).tot;
      bx(ALG[a], [MC.gray, MC.blue, MC.green, MC.teal, MC.purple][i], -2.6, 6.0 - i * 0.9, 0, 2.4, 0.6, 0.8);
      hot(t + ' cylinders', 0.9, 6.0 - i * 0.9);
    });
    cap('記得這幾個演算法怎麼做', '總移動（同一組 queue）');
  },
  async (tok, S) => {                                   // 1236 seek distance 怎麼算
    note('考試重點：seek distance 怎麼算', 0, 1.3);
    cap('最重要：會算 seek distance', '把每一段移動的距離加起來');
  },
  async (tok, S) => {                                   // 1240 C-SCAN 跳回不算
    bad('C-SCAN / C-LOOK：從一側直接跳到另一側的距離不算', 0, 0.6);
    cap('注意 C-SCAN 跳回的那段', '畫圖看得到，但通常不算');
  },
  async (tok, S) => {                                   // 1254 中間不讀
    good('那只是很快地把磁頭拉回去，中間不讀資料', 0, -0.1);
    cap('因為那只是單純移動', '很快，而且中間不讀資料');
  },
]);

// ════════ 1Hl-S_eFbhE（第 26B 講：formatting、booting、壞軌、swap space、RAID 的目的）— 模組場景的 cued 版本 ════════
scene('io-26b-format', 'Low-level formatting：header／data／trailer', CAM, [
  async (tok, S) => {                                   // 15 議題
    ['① formatting', '② booting', '③ 壞軌怎麼處理', '④ swap space'].forEach((t, i) => note(t, -4.8 + i * 3.2, 6.6));
    cap('Disk management 的幾個議題', 'formatting、booting、壞軌、swap');
  },
  async (tok, S) => {                                   // 48 硬碟本身也要 formatting
    S.raw = bx('全新的磁碟空間', MC.gray, 0, 0.3, -1.6, 12, 0.5, 1.0);
    cap('硬碟這個 hardware 本身也要 formatting', '叫 low-level formatting');
  },
  async (tok, S) => {                                   // 74 建立 sector
    gone(S.raw); S.secs = [];
    for (let i = 0; i < 8; i++) S.secs.push(bx('', MC.blue, -5.25 + i * 1.5, 0.3, -1.6, 1.3, 0.5, 1.0));
    hd('sector × N', -5.2, 1.1, -1.6);
    cap('先切出一個一個 sector', '有 sector 才能放 data block');
  },
  async (tok, S) => {                                   // 88 ECC
    note('每個 sector 加上 error-correcting code（ECC）', 0, 1.4, -1.6);
    cap('為了偵測錯誤', '每個 sector 都加上 error-correcting code');
  },
  async (tok, S) => {                                   // 105 header / data / trailer
    S.h = bx('header', MC.gray, -3.4, 2.6, 1.0, 1.8, 0.7, 1.0);
    S.d = bx('data（512 B）', MC.blue, -0.4, 2.6, 1.0, 4.0, 0.7, 1.0);
    S.t = bx('trailer', MC.gold, 2.6, 2.6, 1.0, 1.8, 0.7, 1.0);
    cap('一個 sector = header + data + trailer', '把其中一格放大來看');
  },
  async (tok, S) => {                                   // 116 sector number + ECC
    hd('sector number', -3.4, 3.4, 1.0); hot('ECC', 2.6, 3.4, 1.0);
    cap('裡面存 sector number 和 ECC', '');
  },
  async (tok, S) => {                                   // 123 bit 多可更正；少（parity）只能偵測
    good('ECC 的 bit 多 → 能更正', 4.8, 4.4, 1.0); note('bit 少（例如 parity bit）→ 只能偵測', 4.8, 3.8, 1.0);
    cap('ECC 用的 bit 多，可以更正錯誤', 'bit 少（如 parity bit）至少能偵測');
  },
  async (tok, S) => {                                   // 131 sector 大小只算 data area
    glow(S.d, HL); bad('header、trailer 不算進 sector 大小', -0.4, 4.4, 1.0);
    cap('會浪費一些空間', '但俗稱的 sector 大小只算 data area');
  },
  async (tok, S) => {                                   // 153 low-level format 完 = 買來的硬碟
    glow(S.d, null); good('買來的硬碟：已經做好 low-level formatting', 0, 5.4, 1.0);
    cap('low-level formatting 做完', '就是你買來的那顆硬碟');
  },
  async (tok, S) => {                                   // 169 OS 接手：partition + logical formatting
    bx('partition：P1 ｜ P2', MC.teal, 0, 6.2, -2.4, 7, 0.5, 0.8);
    bx('logical formatting：建立 file system', MC.green, 0, 6.9, -2.4, 7, 0.5, 0.8);
    cap('之後 OS 接手', '做 partitioning 和 logical formatting（建 FS）');
  },
]);

scene('io-26b-boot', 'Booting：ROM → boot block → FS → OS', CAM, [
  async (tok, S) => {                                   // 185 boot 需要 code
    S.disk = prop('disk', 4.8, 0, 0, 1.4, 'disk');
    cap('開機需要 code', '最後都是放在硬碟上');
  },
  async (tok, S) => {                                   // 202 放在 FS 裡讀不到
    S.fs = bx('file system（還沒架起來）', MC.green, 0.6, 3.0, 0, 4.4, 0.6, 0.8); prop('lock', 3.2, 3.4, 0, 0.9);
    cap('如果 boot code 放在 file system 裡', 'FS 還沒架起來，根本讀不出來');
  },
  async (tok, S) => {                                   // 223 raw data
    S.raw = bx('boot code（raw data）', MC.orange, 0.6, 1.9, 0, 4.4, 0.6, 0.8);
    cap('所以很多 boot code 用 raw data 形式', '直接放在硬碟上，不需要 FS');
  },
  async (tok, S) => {                                   // 236 bootstrap 初始化
    S.rom = bx('bootstrap', MC.purple, -4.6, 1.9, 0, 2.6, 0.6, 0.8);
    note('初始化 CPU、register、memory', -4.6, 2.8);
    cap('最一開始：bootstrap program', '做最基本的初始化：CPU、register、memory');
  },
  async (tok, S) => {                                   // 249 放在 ROM
    hd('主機板的 ROM', -4.6, 1.0);
    cap('這部分燒在主機板（motherboard）的 ROM', '');
  },
  async (tok, S) => {                                   // 274 其他的放 disk
    glow(S.raw, HL);
    cap('另一部分（用哪個 FS、哪個 OS）比較複雜', '放在 disk 上');
  },
  async (tok, S) => {                                   // 299 boot disk、boot block
    glow(S.raw, null); relabel(S.raw, 'boot block');
    good('有這段 code 的磁碟 = system drive / boot disk', 0.6, 5.0);
    cap('可以開機的硬碟叫 boot disk', '最前面存 boot code 的空間叫 boot block');
  },
  async (tok, S) => {                                   // 334 boot code 後面是 partition → FS
    S.part = bx('partition', MC.teal, 0.6, 0.8, 0, 4.4, 0.6, 0.8);
    cap('boot code 後面是 partition', 'partition 裡就是 file system');
  },
  async (tok, S) => {                                   // 359 流程：ROM → MBR → 選 OS
    S.chain = [['ROM', MC.purple], ['MBR', MC.orange], ['選 OS', MC.gold]].map(([n, c], i) => bx(n, c, -5.4 + i * 2.2, 6.4, -1.5, 1.9, 0.6, 0.8));
    cap('流程：ROM 的 code 先跑', '偵測各硬碟的 MBR（boot block）→ 讓你選 OS');
  },
  async (tok, S) => {                                   // 391 讀開機程式 → load FS → OS
    [['partition', MC.teal], ['FS', MC.green], ['OS kernel', MC.blue]].forEach(([n, c], i) => bx(n, c, 1.2 + i * 2.2, 6.4, -1.5, 1.9, 0.6, 0.8));
    relabel(S.fs, 'file system（已架起來）');
    cap('選好之後讀開機程式、load partition 與 FS', '再從 FS 讀出作業系統');
  },
]);

// 一條 track：10 個 sector（physical 0–9）+ 2 個 spare（10、11）
function track(z = 0) {
  for (let p = 0; p < NS + NSP; p++) { ctx.tile(V3(sx(p), 0.04, z), 0.9, 1.2, p >= NS ? '#d6e7d9' : '#e9dcc4'); sm(String(p), sx(p), 0.05, z + 0.9); }
  sm('spare', sx(NS + 0.5), 0.05, z + 1.4); sm('physical 位置', -6.6, 0.05, z + 0.9);
  const M = {}; for (let lg = 0; lg < NS; lg++) M[lg] = bx(String(lg), MC.blue, sx(lg), 0.2, z, 0.8, 0.4, 1.0);
  return M;
}
// 依 logical 0–9 順序讀，磁頭跟著 physical 位置跑；回傳移動格數
async function readAlong(tok, map, z = 0) {
  const h = hot('▼', sx(map[0]), 1.0, z); let dist = 0, prev = map[0];
  const path = map.slice(1);
  await anim(tok, 1800, (u) => {
    const f = u * path.length, k = Math.min(path.length - 1, Math.floor(f)), a = k ? path[k - 1] : map[0], b = path[k], w = f - k;
    h.position.x = sx(a + (b - a) * Math.min(1, w));
  });
  for (const p of path) { dist += Math.abs(p - prev); prev = p; }
  h.position.x = sx(prev); return dist;
}

scene('io-26b-bad', '壞軌：simple disk 只能標記', CAM, [
  async (tok, S) => {                                   // 416 壞軌 → 資料遺失
    S.M = track();
    cap('第三個議題：壞軌', '硬碟常見的問題，資料會遺失');
  },
  async (tok, S) => {                                   // 436 兩種
    note('看 controller：簡單的 vs 有計算能力的', 0, 3.2);
    cap('處理方式分兩種', '看 disk controller 有沒有計算能力');
  },
  async (tok, S) => {                                   // 447 IDE：每個 sector 有 ECC
    hd('早期 IDE = simple disk', -3.6, 2.4); glow(S.M[4], NG);
    cap('早期 IDE 就是 simple disk', '靠每個 sector 的 ECC 偵測錯誤');
  },
  async (tok, S) => {                                   // 468 能重建就重建，不行就遺失
    note('ECC 能修就修；修不了 → 資料遺失', 2.6, 2.4);
    cap('能重建就幫你重建', '不行，資料就遺失了');
  },
  async (tok, S) => {                                   // 479 mark 起來以後不用
    kill(S.M[4]); S.x = bx('✕', MC.red, sx(4), 0.2, 0, 0.8, 0.4, 1.0);
    cap('它能做的只有把這格 mark 成壞軌', '以後不再使用');
  },
  async (tok, S) => {                                   // 490 對上層沒有處理
    bad('上層軟體不管：資料遺失，甚至開不了機', 0, 1.6);
    cap('對上面的軟體沒有任何處理', '資料可能遺失，甚至系統開不了機');
  },
]);

scene('io-26b-spare', 'Sector sparing：spare 頂替 sector 4', CAM, [
  async (tok, S) => {                                   // 502 SCSI 新做法
    S.M = track(); hd('SCSI controller（比較聰明）', -3.0, 2.6);
    cap('第二種：比較新的 SCSI 這類 controller', '');
  },
  async (tok, S) => {                                   // 517 不只知道哪壞，還讓 sector 能再用
    glow(S.M[4], NG);
    cap('它不只知道哪裡壞掉', '還會想辦法讓壞掉的 sector 能重新使用');
  },
  async (tok, S) => {                                   // 532 forwarding / remap：最後有空位
    for (const p of [NS, NS + 1]) ctx.tile(V3(sx(p), 0.06, 0), 0.9, 1.2, '#bfe3c8');
    note('方法一：sector sparing（forwarding / remap）', 0, 3.4); hd('空的 spare', sx(NS + 0.5), 1.0, 0);
    cap('方法一：forwarding（remap）', 'sector 4 壞了，最後面有空的位置');
  },
  async (tok, S) => {                                   // 544 spare 當 sector 4
    glow(S.M[4], null); await slide(tok, S.M[4], sx(4), 1.7, 0, 300); await slide(tok, S.M[4], sx(NS), 1.7, 0, 600); await slide(tok, S.M[4], sx(NS), 0.2, 0, 300); tint(S.M[4], MC.green); // hops over the other sectors
    S.x = bx('✕', MC.red, sx(4), 0.2, 0, 0.8, 0.4, 1.0);
    good('瞬間解決', sx(NS), 1.5, 0);
    cap('把後面的空位當 sector 4 來用', '很快，瞬間就解決');
  },
  async (tok, S) => {                                   // 554 logical 連續、physical 不連續
    bad('logical 0–9 連續，physical 卻 3 → 10 → 5', 0, 2.4);
    cap('但 physical 位置不再連續', 'logical sector number 還是連續的');
  },
  async (tok, S) => {                                   // 562 影響 disk scheduling
    const map = Array.from({ length: NS }, (_, i) => (i === 4 ? NS : i));
    const d = await readAlong(tok, map);
    hot('依序讀 0–9：磁頭移動 ' + d + ' 格（原本 9 格）', 0, 1.6, 2.2);
    cap('依序讀 0–9，磁頭要跳過去再跳回來', '移動 ' + d + ' 格：scheduling 效能受影響');
  },
]);

scene('io-26b-slip', 'Sector slipping：大家往後挪一格', CAM, [
  async (tok, S) => {                                   // 572 slipping = shift
    S.M = track(); glow(S.M[4], NG);
    note('方法二：sector slipping（shift）', 0, 3.4);
    cap('另一個做法：slipping', '也就是 shift');
  },
  async (tok, S) => {                                   // 584 4 空掉，5 重新 label 成 4，往後移
    kill(S.M[4]); S.x = bx('✕', MC.red, sx(4), 0.2, 0, 0.8, 0.4, 1.0);
    const ms = [5, 6, 7, 8, 9].map((lg) => S.M[lg]);
    await anim(tok, 1200, (u) => ms.forEach((m, i) => { m.position.x = sx(5 + i) + u * 1.0; }));
    S.n4 = bx('4', MC.green, sx(5), 0.2, 0, 0.8, 0.4, 1.0); hd('physical 5 現在叫 sector 4', sx(5), 1.2, 0);
    cap('原來的 5 重新 label 成 sector 4', '以此類推，大家往後移一格');
  },
  async (tok, S) => {                                   // 597 代價高
    bad('要搬動後面所有資料 → 修補時間很長', 0, 2.4);
    cap('代價很高', '後面所有資料都要搬');
  },
  async (tok, S) => {                                   // 610 修補完效能好
    const map = Array.from({ length: NS }, (_, i) => (i < 4 ? i : i + 1));
    const d = await readAlong(tok, map);
    good('之後依序讀 0–9：移動 ' + d + ' 格，仍然連續', 0, 1.6, 2.2);
    cap('但修補完之後', '讀取仍連續，效能比較好（移動 ' + d + ' 格）');
  },
  async (tok, S) => {                                   // 625 只有聰明 controller；simple disk 越來越少
    note('sparing、slipping 都要聰明的 controller；simple disk 空間只會越來越少', 0, 4.2);
    cap('這兩種都只有聰明的 controller 才會做', 'simple disk 的空間只會越來越少');
  },
]);

scene('io-26b-swapwhere', 'Swap space：檔案 vs raw partition', CAM, [
  async (tok, S) => {                                   // 639 swap space 放硬碟
    S.mem = bx('memory', MC.blue, -4.6, 4.8, 0, 2.6, 0.8, 0.9); S.pg = bx('page', MC.orange, -4.6, 3.8, 0, 1.2, 0.5, 0.6);
    await slide(tok, S.pg, -1.2, 2.2, 0, 800);
    cap('virtual memory 換出去的 page', '放在硬碟上的 swap space');
  },
  async (tok, S) => {                                   // 652 方法一：FS 的一個檔案
    S.fs = bx('file system', MC.green, 1.2, 3.0, -1.0, 7, 0.6, 1.0); S.sf = bx('swap file', MC.pink, 3.2, 3.6, -1.0, 1.8, 0.5, 0.8);
    cap('方法一：當成 file system 裡的一個檔案', '透過 FS 存取');
  },
  async (tok, S) => {                                   // 682 方法二：raw partition
    S.p1 = bx('file system', MC.green, -0.4, 1.0, 1.2, 5, 0.6, 1.0); S.p2 = bx('swap（raw partition）', MC.pink, 4.2, 1.0, 1.2, 3.8, 0.6, 1.0);
    cap('方法二：直接切一塊 raw partition', '不用 FS，由 OS 的 memory management 自己管');
  },
  async (tok, S) => {                                   // 704 快：不經 FS，page 4KB 固定
    good('快：不經過 FS；page 固定 4KB → 演算法很簡單', 2.0, 0.0, 2.2);
    cap('大部分人選這個：比較快', '不經過 FS，page 固定 4KB');
  },
  async (tok, S) => {                                   // 727 缺點：大小固定，切太小要 resize
    glow(S.p2, NG); bad('切太小 → 要 resize partition，很麻煩', 2.0, -0.6, 2.2);
    cap('缺點：它是獨立的一塊，大小固定', '一開始切太小，之後 resize 很麻煩');
  },
  async (tok, S) => {                                   // 762 切太大 → 檔案空間被壓縮
    bad('切太大 → 存檔案的空間被壓縮', 2.0, -1.2, 2.2);
    cap('切太大也不好', '能拿來存檔案的空間就被壓縮了');
  },
  async (tok, S) => {                                   // 775 FS 方式：慢但有彈性
    glow(S.p2, null); glow(S.sf, OKG);
    good('swap file：比較慢，但空間有彈性', 4.6, 4.4, -1.0);
    cap('用 FS 的方式雖然比較慢', '空間全交給 FS，swap 要多少拿多少：有彈性');
  },
  async (tok, S) => {                                   // 799 兩者都用
    glow(S.sf, null);
    bx('借', MC.pink, -1.6, 1.7, 1.2, 0.9, 0.5, 0.8);
    note('先用 swap partition，不夠再跟 FS 借（較慢）', -1.6, 6.2);
    cap('現在大部分 OS 兩者都用', '先切 swap partition，不夠再跟 FS 借');
  },
]);

scene('io-26b-swappolicy', 'Swap 策略：只在 page out 時存動態資料', CAM, [
  async (tok, S) => {                                   // 822 什麼資料、什麼時候放 swap
    hd('memory', -4.0, 5.2); hd('swap space', 3.8, 5.2);
    S.kinds = [['code', MC.blue], ['code', MC.blue], ['data', MC.teal], ['heap', MC.orange], ['stack', MC.purple]];
    S.mem = S.kinds.map(([k, c], i) => bx(k, c, -5.8 + i * 1.2 + 0.4, 4.2, 0, 1.1, 0.6, 0.8));
    S.sw = zone('swap space（硬碟）', 3.8, 2.2, 0, 5.4, 2.4, '#f3dfe8');
    cap('什麼資料、什麼時候放到 swap space？', '');
  },
  async (tok, S) => {                                   // 837 慢、佔空間 → 越少越好
    note('swap 在硬碟：慢、又佔空間 → 存越少越好', 0, 6.4);
    cap('swap space 比較慢，而且是有限的空間', '能存越少越好');
  },
  async (tok, S) => {                                   // 846 swap 滿 → crash
    bad('swap 也滿了 → 系統可能直接 crash', 0, 0.8);
    cap('swap space 也滿的時候', '系統很可能就直接 crash');
  },
  async (tok, S) => {                                   // 858 傳統：全部 copy 一份
    S.cp = S.kinds.map(([k, c], i) => bx(k, c, 1.8 + (i % 3) * 1.4, 2.4 + Math.floor(i / 3) * 0.7, 0, 1.2, 0.5, 0.8));
    cap('最傳統：load 到 memory 就 copy 一份', '放在 swap space 當 backup');
  },
  async (tok, S) => {                                   // 877 浪費空間
    bad('不管需不需要都存 → 浪費', 3.8, 4.2);
    cap('不管需不需要都存一份', '造成很大的空間浪費');
  },
  async (tok, S) => {                                   // 891 改：要 swap 時才 copy
    gone(S.cp); good('改進：被 swap out（memory 放不下）時才 copy', 0, 6.0);
    cap('第二種：load 時先不 copy', 'memory 已經有一份了，被 swap out 時才放到硬碟');
  },
  async (tok, S) => {                                   // 909 進一步：code
    glow(S.mem[0], HL); glow(S.mem[1], HL);
    cap('有些作業系統再進一步減少', '看 code 的部分');
  },
  async (tok, S) => {                                   // 928 code 在 FS：直接丟
    prop('file', -6.2, 1.2, 0, 0.9, 'binary 檔');
    await slide(tok, S.mem[0], -4.8, 7.0, 0, 700); kill(S.mem[0]);
    cap('code 本來就在 FS 的 binary file 裡', '被 swap 時直接丟掉，需要再從 binary load');
  },
  async (tok, S) => {                                   // 959 只存 run time 的 stack/heap
    glow(S.mem[1], null);
    await slide(tok, S.mem[4], 3.2, 2.4, 0, 800); await slide(tok, S.mem[3], 4.6, 2.4, 0, 600);
    cap('只有 run time 動態產生的 stack、heap', '被 swap 時才放進 swap space');
  },
  async (tok, S) => {                                   // 980 static 不存
    note('static（像 code）：本來就從 FS 載入 → 不存', -3.4, 2.6);
    cap('static 的資料（像 code）', '本來就是從 FS 讀出來的，不用存');
  },
  async (tok, S) => {                                   // 1036 總結
    good('只存「動態的」，而且只在「page out」時存 → swap 用量最小', 0, 0.2);
    cap('總結：creation 時不 copy，page out 才 copy', '而且只存動態的 → 用量最小');
  },
]);

scene('io-26b-swapmap', 'Swap map：每個 slot 一個 counter', CAM, [
  async (tok, S) => {                                   // 1087 raw partition 管理快：size 固定
    S.cnt = [0, 0, 0, 0, 0, 0, 0, 0];
    S.slots = S.cnt.map((_, i) => { ctx.tile(V3(-5.25 + i * 1.5, 0.04, 0), 1.3, 1.3); return hot('0', -5.25 + i * 1.5, 1.1, 0.8); });
    hd('swap slots（每格大小固定 = 1 page）', -1.0, 2.4);
    cap('raw partition 的 swap 為什麼快？', '每格大小都固定');
  },
  async (tok, S) => {                                   // 1108 一個 array：存哪個 process 的第幾 page
    S.pg = {}; [[0, 'A:p3'], [1, 'B:p0'], [3, 'A:p7'], [4, 'C:p1']].forEach(([i, n]) => { S.pg[i] = bx(n, MC.orange, -5.25 + i * 1.5, 0.25, 0, 1.15, 0.45, 1.1); });
    sm('（示意）', 5.4, 0.3, 0);
    cap('用一個簡單的 array', '記每格存哪個 process 的第幾個 page');
  },
  async (tok, S) => {                                   // 1120 誰用、何時回收
    note('什麼時候回收？看還有沒有人要 access 這個 page', -1.0, 3.2);
    cap('哪些格子是空的、誰在用', '什麼時候能回收：看還有沒有人 access');
  },
  async (tok, S) => {                                   // 1133 counter
    [[0, 1], [1, 2], [3, 1], [4, 3]].forEach(([i, c]) => { S.cnt[i] = c; txt(S.slots[i], String(c)); });
    sm('counter = 有幾個 process 在用（示意）', -1.0, 1.7, 1.5);
    cap('每格存一個 counter', '記有多少 process reference 這個 page');
  },
  async (tok, S) => {                                   // 1142 process 離開 → −1
    [0, 1, 4].forEach((i) => { S.cnt[i]--; txt(S.slots[i], String(S.cnt[i])); });
    cap('process 離開、不要那個 page 了', '它用到的 counter 就 −1');
  },
  async (tok, S) => {                                   // 1145 到 0 → 給別人
    await slide(tok, S.pg[0], -5.25, 3.0, 0, 600); kill(S.pg[0]);
    good('counter = 0 → 沒人用，可以存別人的 page', -3.8, 3.8);
    cap('counter 降到 0', '這格沒人用了，可以拿去放別人的 page');
  },
  async (tok, S) => {                                   // 1156 不需要 FS
    note('一個 integer array 就管好了，不需要 file system', 0, 4.6);
    cap('只要 counter 就能管理', '非常簡單，不需要透過 file system');
  },
]);

scene('io-26b-raidwhy', 'RAID 的目的與三個技巧', CAM, [
  async (tok, S) => {                                   // 1167 RAID：一種 storage system
    hd('RAID：一種 storage system', 0, 6.6);
    cap('最後：RAID', '很重要，它是一種 storage system');
  },
  async (tok, S) => {                                   // 1191 每單位價格越來越便宜
    note('硬體越來越便宜（看「每單位儲存空間」的價格）', 0, 5.9);
    cap('背景：硬體越來越便宜', '每單位儲存空間的價格一直下降');
  },
  async (tok, S) => {                                   // 1217 很多便宜 disk 兜在一起
    S.ds = [0, 1, 2, 3].map((i) => bx('便宜 disk', MC.gray, -4.5 + i * 3, 0.5, -1, 2.0, 1.0, 1.2));
    cap('想法：把很多便宜的 disk 兜在一起', '便宜 = 容易壞、效能較差');
  },
  async (tok, S) => {                                   // 1242 ≈ 昂貴硬碟；名稱
    good('≈ 一顆昂貴硬碟的可靠度 / 效能，甚至更好', 0, 2.6, -1);
    hot('Redundant Arrays of Inexpensive Disks', 0, 5.2);
    cap('達到跟昂貴硬碟一樣、甚至更好', 'RAID = Redundant Arrays of Inexpensive Disks');
  },
  async (tok, S) => {                                   // 1267 reliability
    S.r1 = bx('目的一：reliability', MC.purple, -3.0, 4.2, 0, 4.4, 0.6, 0.8);
    cap('目的一：比較 reliable', '空間多可以備份；很多顆同時壞的機率更小');
  },
  async (tok, S) => {                                   // 1293 performance
    S.r2 = bx('目的二：performance', MC.blue, 3.0, 4.2, 0, 4.4, 0.6, 0.8);
    sm('一顆約 100–150 MB/s → 兩顆一起讀 ≈ 兩倍', 3.0, 3.5);
    cap('目的二：performance（平行讀取）', '一顆 100–150 MB/s，兩顆一起讀約兩倍');
  },
  async (tok, S) => {                                   // 1318 striping
    ['A0', 'A1', 'A2', 'A3'].forEach((n, i) => bx(n, MC.blue, -4.5 + i * 3, 1.35, -1, 1.4, 0.4, 0.8));
    note('① striping：切開放到多顆 → 平行', -4.0, 3.0, -1);
    cap('技巧一：striping', '把資料切開放到很多顆上 → 平行');
  },
  async (tok, S) => {                                   // 1338 mirror
    bx('A0 副本', MC.purple, -1.5, 1.8, -1, 1.4, 0.4, 0.8);
    note('② mirroring / replication：備份', 0.4, 3.0, -1);
    cap('技巧二：mirroring（replication）', '把資料備份 → 更可靠');
  },
  async (tok, S) => {                                   // 1352 coding
    bx('P', MC.gold, 4.5, 1.8, -1, 1.4, 0.4, 0.8);
    note('③ coding：多存 redundant code', 4.4, 3.0, -1);
    cap('技巧三：coding', '多存 redundant code，用來偵錯甚至修正');
  },
]);

// ════════ TiyQuiVq0Zs（第 26C 講：RAID 0–6、hybrid） ════════
// 一排硬碟：每顆一塊地板 + 名字；put() 在第 i 顆第 r 列放一個 block
function disks(n, o = {}) {
  const w = o.w || 2.2, z = o.z || 0, xs = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w + (o.x || 0); xs.push(x);
    ctx.tile(V3(x, 0.04, z), w - 0.3, 1.4); sm(o.names ? o.names[i] : 'disk ' + i, x, 0.05, z + 1.0);
  }
  return { xs, z, put: (t, c, i, r, bw) => bx(t, c, xs[i], 0.35 + r * 0.6, z, bw || Math.min(1.9, w - 0.4), 0.5, 1.0) };
}
const xor = (...v) => v.reduce((a, b) => a ^ b, 0);

scene('io-26c-intro', 'RAID level：三個技巧的不同組合', CAM, [
  async (tok, S) => {                                   // 14 striping、mirror、error correction
    ['striping', 'mirroring', 'error correction'].forEach((t, i) => bx(t, [MC.blue, MC.purple, MC.gold][i], -4 + i * 4, 4.6, 0, 3.4, 0.7, 0.8));
    cap('RAID 的選擇就在這三件事', 'striping、mirroring、error correction 怎麼做');
  },
  async (tok, S) => {                                   // 19 不同設計 → 不同 level
    note('設計方式不同 → 叫做不同 level 的 RAID', 0, 5.8);
    cap('目的一樣、技巧一樣', '設計不同，就叫不同 level');
  },
  async (tok, S) => {                                   // 47 RAID 0、1、2、3 …
    ['RAID 0', 'RAID 1', 'RAID 2', 'RAID 3', 'RAID 4', 'RAID 5', 'RAID 6'].forEach((t, i) => (i <= 1 || i === 5 ? hot : hd)(t, -6 + i * 2, 2.4));
    sm('常見的是前面幾種（0、1、5 …）', 0, 1.6);
    cap('從最簡單的 RAID 0 開始', '0、1、2、3 …常見的是前面幾種');
  },
]);

scene('io-26c-r0', 'RAID 0：只有 striping', CAM, [
  async (tok, S) => {                                   // 56 RAID 0 只 striping
    hd('RAID 0：只用 striping', 0, 6.4);
    cap('RAID 0', '只用了 striping 這一招');
  },
  async (tok, S) => {                                   // 73 兩顆硬碟
    S.D = disks(2, { w: 4 });
    cap('striping：把資料切開', '依序放到每一顆硬碟（例子：兩顆）');
  },
  async (tok, S) => {                                   // 85 A1、A2 … 依序放
    S.A = [];
    for (let k = 0; k < 4; k++) { S.A.push(S.D.put('A' + (k + 1), MC.blue, k % 2, Math.floor(k / 2))); await wt(tok, 250); }
    cap('同一個 data block A 切成 A1、A2 …', '輪流放到 disk 0、disk 1');
  },
  async (tok, S) => {                                   // 97 三顆就 A1 A2 A3
    note('三顆硬碟就是 A1、A2、A3 各放一顆，以此類推', 0, 5.6);
    cap('如果有三顆', '就變成 A1、A2、A3 …依此類推');
  },
  async (tok, S) => {                                   // 110 讀時全部讀出
    S.A.forEach((m) => glow(m, HL));
    cap('它們是同一份資料', '要全部讀出來，才拿得到完整的值');
  },
  async (tok, S) => {                                   // 123 放完一個再放下一個，round robin
    S.A.forEach((m) => glow(m, null));
    for (let k = 0; k < 4; k++) { S.D.put('B' + (k + 1), MC.green, k % 2, 2 + Math.floor(k / 2)); await wt(tok, 200); }
    cap('A 放完再放 B', '用 round robin 的方式 stripe 到所有 disk');
  },
  async (tok, S) => {                                   // 135 目的：performance
    S.a1 = arrow(V3(-2, 3.4, 0), V3(-2, 5.0, 0), 0x2f6fb0); S.a2 = arrow(V3(2, 3.4, 0), V3(2, 5.0, 0), 0x2f6fb0);
    good('兩顆一起讀 → I/O bandwidth ×2', 0, 5.0, 1.2);
    cap('目的只有一個：performance', '兩顆一起讀，頻寬 double；三顆三倍');
  },
  async (tok, S) => {                                   // 157 瓶頸在 disk 就加硬碟
    note('只要瓶頸在 disk（不是 bus 等上游），加硬碟就變快', 0, 7.0);
    cap('I/O 不夠快？很直覺：多加硬碟', '前提：瓶頸在 disk，而不是 system bus');
  },
  async (tok, S) => {                                   // 186 n 顆 → n 倍
    hot('n 顆硬碟 → 讀寫速度約 n 倍', -3.6, 6.4); bad('但沒有任何備份：壞一顆就全毀', 3.4, 6.4);
    cap('n 顆硬碟，效能約 n 倍', 'RAID 0 最大的好處（但沒有 redundancy）');
  },
]);

scene('io-26c-r1', 'RAID 1：mirroring', CAM, [
  async (tok, S) => {                                   // 205 RAID 1：reliability
    hd('RAID 1：只求 reliability', 0, 6.4);
    cap('RAID 1：另一個極端', '只想要 reliability：資料不要遺失');
  },
  async (tok, S) => {                                   // 228 一顆壞掉機率高
    S.one = prop('disk', 0, 0, 2.6, 1.0, '只有一顆');
    cap('一般人只有一顆硬碟', '壞掉機率還蠻高；重要資料放 RAID 1');
  },
  async (tok, S) => {                                   // 237 copy 兩份
    kill(S.one); S.D = disks(2, { w: 4 });
    S.m = [];
    for (let k = 0; k < 3; k++) { S.m.push(S.D.put('A' + (k + 1), MC.blue, 0, k)); S.m.push(S.D.put('A' + (k + 1) + ' 副本', MC.purple, 1, k)); await wt(tok, 250); }
    cap('把資料 copy 成兩份', '三顆就三份，以此類推');
  },
  async (tok, S) => {                                   // 251 n 顆同時壞才遺失
    S.m.filter((_, i) => i % 2 === 0).forEach((m) => tint(m, MC.red)); bad('✕ disk 0 壞了', S.D.xs[0], 2.4);
    good('disk 1 還有完整一份', S.D.xs[1], 2.4);
    cap('壞一顆沒關係', '除非 n 顆同時壞，資料才會遺失');
  },
  async (tok, S) => {                                   // 267 三份夠；空間減半
    S.m.filter((_, i) => i % 2 === 0).forEach((m) => tint(m, MC.blue));
    hot('1 TB + 1 TB → 只能存 1 TB', 0, 4.4);
    cap('一般備份三份就夠', '缺點：空間只剩一半（兩顆 1T 只存 1T）');
  },
  async (tok, S) => {                                   // 280 讀也能加速
    glow(S.m[0], OKG); glow(S.m[3], OKG);
    good('讀：A1 從 disk 0、A2 從 disk 1 → 讀頻寬也加倍', 0, 5.2);
    cap('讀也能順便變快', '兩邊都有，A1 從這顆讀、A2 從那顆讀');
  },
  async (tok, S) => {                                   // 307 寫 = 一顆，甚至最慢那顆
    glow(S.m[0], null); glow(S.m[3], null);
    bad('寫：每份都要寫 → 跟一顆一樣，甚至等最慢那顆', 0, 6.0);
    cap('寫就沒辦法加速', '每份都要寫，速度最多跟一顆一樣');
  },
]);

// Hamming(7,4)：依老師的數字 data 1101 → parity 010（三個圈各涵蓋三個 data bit）
const HAM = { d: [1, 1, 0, 1], cover: [[1, 2, 3], [0, 1, 3], [0, 2, 3]] };   // P1:{d2,d3,d4} P2:{d1,d2,d4} P3:{d1,d3,d4}
const hamP = (d) => HAM.cover.map((c) => xor(...c.map((i) => d[i])));
scene('io-26c-r2', 'RAID 2：Hamming code', CAMW, [
  async (tok, S) => {                                   // 333 2、3、4：做 error correction
    hd('RAID 2、3、4：用 coding 做 error correction', 0, 7.0);
    cap('接下來 RAID 2、3、4', '要更有效率地做 error correction');
  },
  async (tok, S) => {                                   // 349 RAID 1 浪費一半
    bad('RAID 1：兩份 copy → 浪費一半空間', 0, 6.3);
    cap('RAID 1 兩份 copy 就浪費一半空間', 'data redundancy 比例太高');
  },
  async (tok, S) => {                                   // 370 RAID 2 coding
    S.D = disks(7, { w: 1.7, names: ['D1', 'D2', 'D3', 'D4', 'P1', 'P2', 'P3'] });
    S.b = HAM.d.map((v, i) => S.D.put(String(v), MC.blue, i, 0, 1.0));
    cap('RAID 2 用 coding 解決', '每顆放一個 bit：D = data');
  },
  async (tok, S) => {                                   // 383 要先知道哪顆壞
    note('bit flip 常常沒有徵兆 → 先要知道「哪一顆」錯', 0, 5.6);
    cap('第一件事：知道是哪顆出錯', '有時只是 bit flip，沒有任何徵兆');
  },
  async (tok, S) => {                                   // 407 Hamming code
    hot('Hamming code', 0, 4.8);
    cap('RAID 2 用的是 Hamming code', '常見的 error-correcting code');
  },
  async (tok, S) => {                                   // 421 D 與 P；bit level
    sm('D = data bit　P = parity bit　（每格只是一個 0 或 1：bit level）', 0, 4.1);
    cap('D 是 data，P 是 parity bit', '只用在 bit level：每格就是 0 或 1');
  },
  async (tok, S) => {                                   // 442 交錯區域算 parity
    HAM.cover.forEach((c, k) => sm('P' + (k + 1) + ' = ' + c.map((i) => 'D' + (i + 1)).join(' ⊕ '), S.D.xs[4 + k], 2.0 + (k % 2) * 0.5));
    cap('四個 data，照圈圈交錯的地方算 parity', '每個 P 管三個 data bit');
  },
  async (tok, S) => {                                   // 464 1101 → 010
    S.p = hamP(HAM.d).map((v, k) => S.D.put(String(v), MC.gold, 4 + k, 0, 1.0));
    hot('data 1101 → parity ' + hamP(HAM.d).join(''), 0, 3.3);
    cap('例子：data 1101', '照規則算出 parity = ' + hamP(HAM.d).join(''));
  },
  async (tok, S) => {                                   // 477 一個 bit flip → 找到並修正
    const bad1 = 1, d2 = HAM.d.map((v, i) => (i === bad1 ? 1 - v : v));
    relabel(S.b[bad1], String(d2[bad1])); tint(S.b[bad1], MC.red);
    const chk = hamP(d2).map((v, k) => v !== hamP(HAM.d)[k]);
    chk.forEach((f, k) => glow(S.p[k], f ? NG : OKG));
    const who = HAM.d.findIndex((_, i) => HAM.cover.every((c, k) => c.includes(i) === chk[k]));
    bad('D' + (bad1 + 1) + ' flip：' + chk.map((f, k) => 'P' + (k + 1) + (f ? '✕' : '✓')).join(' ') + ' → 只有 D' + (who + 1) + ' 剛好被 ✕ 的 P 都管到', 0, 6.3);
    await wt(tok, 900);
    relabel(S.b[bad1], String(HAM.d[bad1])); tint(S.b[bad1], MC.green);
    cap('任一 bit flip，會讓它所在的 parity 對不上', '找出是 D' + (who + 1) + '，0 改回 1');
  },
  async (tok, S) => {                                   // 496 一個可修，兩個只能偵測
    S.p.forEach((m) => glow(m, null));
    good('1 個 bit 錯 → 可以 recover', -3.4, 5.6); note('2 個 bit 錯 → 只能 detect', 3.4, 5.6);
    cap('只有一個 bit 錯：能修回來', '兩個錯：只能偵測，不能更正');
  },
  async (tok, S) => {                                   // 537 4 + 3 = 7 顆
    hot('4 個 data + 3 個 parity → 一定要 7 顆硬碟', 0, 4.8);
    cap('硬碟數量跟 coding 綁在一起', '(7,4)：四顆 data 加三顆 parity = 7 顆');
  },
  async (tok, S) => {                                   // 576 overhead 75% vs 100%
    sm('mirroring：多 4 顆 = 100%　｜　Hamming：多 3 顆 = 75%', 0, 4.1);
    cap('一樣能修一顆壞掉的', '多存的比例：copy 100%，Hamming 只要 3/4 = 75%');
  },
]);

scene('io-26c-r34', 'RAID 3 / 4：一個 parity 就夠', CAMW, [
  async (tok, S) => {                                   // 635 Hamming 太數學
    note('Hamming code：用純數學的方式在想', 0, 7.0);
    cap('Hamming code 還不夠好', '它純粹從 0、1 的數學去想');
  },
  async (tok, S) => {                                   // 658 sector 本來就有 ECC
    hd('每個 sector 本來就有 ECC', 0, 6.3);
    cap('想想真實的硬碟', '每個 sector 本來就有 error-correcting code');
  },
  async (tok, S) => {                                   // 674 detection 已做掉 → 只需 recovery
    good('哪一顆壞了？硬碟自己會說 → RAID 只要負責 recovery', 0, 5.6);
    cap('不能更正時，它至少知道誰壞了', 'detection 已經做掉，RAID 只要做 recovery');
  },
  async (tok, S) => {                                   // 682 一個 parity 就夠
    S.D = disks(4, { w: 2.8, names: ['disk 0', 'disk 1', 'disk 2', 'parity'] });
    S.v = [1, 0, 1]; S.b = S.v.map((v, i) => S.D.put('A' + (i + 1) + ' = ' + v, MC.blue, i, 0));
    S.p = S.D.put('P = ' + xor(...S.v), MC.gold, 3, 0);
    cap('只考慮一顆壞掉：一個 parity bit 就夠', 'P = 所有 data 的 XOR（1 的個數是奇是偶）');
  },
  async (tok, S) => {                                   // 709 disk 1 壞 → 算回 A2
    tint(S.b[1], MC.red); relabel(S.b[1], 'A2 = ?'); bad('知道 disk 1 壞了', S.D.xs[1], 1.4);
    await wt(tok, 700);
    const back = xor(S.v[0], S.v[2], xor(...S.v));
    relabel(S.b[1], 'A2 = ' + back); tint(S.b[1], MC.green);
    hot('A2 = A1 ⊕ A3 ⊕ P = ' + S.v[0] + '⊕' + S.v[2] + '⊕' + xor(...S.v) + ' = ' + back + '（示意）', 0, 5.0);
    cap('知道是 A2 壞了，值是多少？', '用一個 parity bit 就能算回來');
  },
  async (tok, S) => {                                   // 728 3 data + 1 parity → 33%
    hot('3 data + 1 parity → 多存 1/3 ≈ 33%', 0, 4.3);
    cap('space efficiency 大幅改善', '三顆 data 配一個 parity：多存 33%');
  },
  async (tok, S) => {                                   // 750 4 data → 25%
    sm('4 data + 1 parity → 25%：data 硬碟越多，比例越低', 0, 3.6);
    cap('data 用的硬碟越多', 'overhead 越少：四顆 data 配一個 parity 只要 25%');
  },
  async (tok, S) => {                                   // 762 代價：多顆同時壞機率升高
    bad('代價：硬碟越多，同時壞兩顆的機率越高', 0, 6.3);
    cap('減少是有代價的', '硬碟越多，多顆一起壞的機率越高（這裡假設只壞一顆）');
  },
  async (tok, S) => {                                   // 786 RAID 3 = bit level
    hd('RAID 3：bit level（每格 1 bit）', -3.6, 7.0);
    cap('RAID 3 和 4 差在哪？', 'RAID 3 是 bit level：每個 A 是一個 bit');
  },
  async (tok, S) => {                                   // 809 RAID 4 = block level
    hd('RAID 4：block level（每格一個 block，例如 8 bits）', 3.0, 7.6);
    cap('RAID 4 是 block level', '每個 A 是一個 block，parity 每個位置各自算');
  },
  async (tok, S) => {                                   // 836 原理一樣，效能不同
    note('原理完全一樣，只差「單位」→ 效能不同', 0, 2.6);
    cap('原理一模一樣', '差在單位，所以效能不同');
  },
  async (tok, S) => {                                   // 849 讀一個 byte：bit level 要同步
    S.D.xs.slice(0, 3).forEach((x) => arrow(V3(x, 2.0, 0), V3(x, 3.4, 0), 0x2f6fb0));
    bad('RAID 3：讀一個 byte 也要所有 disk 一起讀、互相同步 → 要等', 0, 1.6, 1.5);
    cap('讀一個 byte，bit level 要讀好幾顆', '硬碟之間要同步，就會浪費時間');
  },
  async (tok, S) => {                                   // 889 block level 不用同步
    good('RAID 4：小資料只讀一顆，不用同步 → 快', 0, 1.0, 2.0);
    cap('block level 讀一個 block 就好', '不用同步，比較快');
  },
  async (tok, S) => {                                   // 916 多使用者仍可平行
    good('不同使用者讀不同 block → 各顆一起工作，平行度還在', 0, 0.4, 2.5);
    cap('一個人用不到其他顆？', '系統有很多使用者，大家讀不同 block，照樣平行');
  },
]);

scene('io-26c-r5', 'RAID 5：parity 輪流放', CAMW, [
  async (tok, S) => {                                   // 965 RAID 5 最常用
    S.D = disks(4, { w: 2.8 });
    hd('RAID 5：最常被用到的 RAID', 0, 6.8);
    cap('RAID 5', '最常被用到的一種');
  },
  async (tok, S) => {                                   // 976 parity 位置不同
    S.cells = [];
    const names = [['A1', 'A2', 'A3', 'Pa'], ['B1', 'B2', 'Pb', 'B3'], ['C1', 'Pc', 'C2', 'C3'], ['Pd', 'D1', 'D2', 'D3']];
    names.forEach((row, r) => row.forEach((n, i) => S.cells.push(S.D.put(n, n[0] === 'P' ? MC.gold : MC.blue, i, r))));
    cap('看起來跟 RAID 4 一樣', '差別：parity 的位置不一樣');
  },
  async (tok, S) => {                                   // 990 使用者不讀 parity
    note('parity 是 coding 出來的：沒有 fail 就不會去讀它', 0, 3.4, 1.4);
    cap('使用者讀資料時不讀 parity', '除非有硬碟 fail');
  },
  async (tok, S) => {                                   // 998 RAID 4：parity disk 對讀者不存在
    sm('RAID 4：parity 全在同一顆 → 那顆對讀者等於不存在，只剩 n−1 顆在讀', 0, 6.1);
    cap('RAID 4 把 parity 集中在一顆', '讀的頻寬只剩 n−1 顆');
  },
  async (tok, S) => {                                   // 1021 RAID 5：parity 也 striping
    S.cells.forEach((m) => { if (m.userData.lbl && m.userData.lbl.element.textContent[0] === 'P') glow(m, HL); });
    cap('RAID 5 把 parity 也做 striping', '用 round robin 散在每顆硬碟上');
  },
  async (tok, S) => {                                   // 1033 A 與 B 同時讀 → n 倍
    S.cells.forEach((m) => glow(m, null));
    [0, 1, 2].forEach((i) => glow(S.cells[i], OKG)); glow(S.cells[7], OKG);
    good('讀 A1 A2 A3 的同時，另一人讀 B3 → 每顆都用上，讀 = n 倍', 0, 5.4);
    cap('讀 A 用 disk 0–2，同時別人讀 B3 用 disk 3', '每顆都用得到 → 讀的頻寬 n 倍');
  },
  async (tok, S) => {                                   // 1070 寫：改值 parity 也要改
    S.cells.forEach((m) => glow(m, null)); glow(S.cells[1], HL); glow(S.cells[3], HL);
    cap('寫的時候更慘（對 RAID 4 而言）', '改一個值，它那一列的 parity 也要改');
  },
  async (tok, S) => {                                   // 1096 RAID 4：parity disk 永遠是 bottleneck
    bad('RAID 4：每次寫都要寫同一顆 parity disk → 永遠的 bottleneck', 0, 7.4);
    cap('RAID 4：大家都搶著寫那顆 parity disk', '它永遠是 bottleneck');
  },
  async (tok, S) => {                                   // 1105 RAID 5：read、write 平均分散
    glow(S.cells[1], null); glow(S.cells[3], null);
    good('RAID 5：讀和寫都平均分到每一顆', 0, 4.7);
    cap('RAID 5 的 parity 散開', '不管 read 或 write 都平均分配到每顆硬碟');
  },
]);

// RAID 5 small write：4 顆（3 data + parity），改 disk 2（示意的 4-bit 值）
const RW = { d: [0b1010, 0b0110, 0b0011], nd: 0b0101 };
scene('io-26c-write', 'RAID 5 寫入：怎麼更新 parity', CAMW, [
  async (tok, S) => {                                   // 1141 write 效能看 parity 怎麼算
    S.D = disks(4, { w: 2.8, names: ['disk 0', 'disk 1', 'disk 2', 'parity'] });
    S.b = RW.d.map((v, i) => S.D.put(bin4(v), MC.blue, i, 0)); S.p = S.D.put(bin4(xor(...RW.d)), MC.gold, 3, 0);
    sm('（數值為示意）', 4.9, 0.4, 1.2);
    cap('write 的效能', '要看 parity 怎麼更新');
  },
  async (tok, S) => {                                   // 1164 改第三顆的資料
    S.nw = bx('新值 ' + bin4(RW.nd), MC.green, S.D.xs[2], 3.0, 0, 2.2, 0.5, 0.9);
    cap('假設四顆，其中一顆是 parity', '要改第三顆（disk 2）的資料');
  },
  async (tok, S) => {                                   // 1175 方法一：把其他 data 讀出來
    glow(S.b[0], OKG); glow(S.b[1], OKG);
    hd('方法一：讀出其他 data（N−2 = 2 個 read）', -1.6, 5.2);
    cap('方法一（最笨的）：其他兩個 data 我不知道', '要先讀出來：N−2 個 read');
  },
  async (tok, S) => {                                   // 1188 算新 parity，寫回 data + parity
    const np = xor(RW.d[0], RW.d[1], RW.nd);
    relabel(S.b[2], bin4(RW.nd)); tint(S.b[2], MC.green); relabel(S.p, bin4(np)); glow(S.p, HL);
    sm('新 P = ' + bin4(RW.d[0]) + ' ⊕ ' + bin4(RW.d[1]) + ' ⊕ ' + bin4(RW.nd) + ' = ' + bin4(np) + '；寫回 data、P（2 個 write）', 0, 4.5);
    cap('算出新的 parity', '再寫回新 data 和 parity：2 個 write');
  },
  async (tok, S) => {                                   // 1208 共 N 個 request → 跟一顆一樣
    bad('一共 (N−2) + 2 = N 個 request：N 顆硬碟只完成一次寫 → 跟一顆一樣', 0, 6.0);
    cap('N 顆硬碟，卻發了 N 個 request', '效能跟只有一顆一樣，沒有任何 improvement');
  },
  async (tok, S) => {                                   // 1231 方法二：只讀舊 data 和舊 parity
    [0, 1].forEach((i) => glow(S.b[i], null)); glow(S.p, null);
    relabel(S.b[2], bin4(RW.d[2])); tint(S.b[2], MC.blue); relabel(S.p, bin4(xor(...RW.d)));
    glow(S.b[2], OKG); glow(S.p, OKG);
    hd('方法二：只讀「舊 data」和「舊 parity」', 1.6, 6.8);
    cap('方法二：真的要把大家都讀出來嗎？', '只要讀 parity 和要改的那個舊值');
  },
  async (tok, S) => {                                   // 1242 差值加到 parity
    const np = xor(xor(...RW.d), RW.d[2], RW.nd);
    sm('新 P = 舊 P ⊕ 舊 data ⊕ 新 data = ' + bin4(xor(...RW.d)) + ' ⊕ ' + bin4(RW.d[2]) + ' ⊕ ' + bin4(RW.nd) + ' = ' + bin4(np), 0, 3.8, 1.4);
    if (np !== xor(RW.d[0], RW.d[1], RW.nd)) log('RAID5 parity update mismatch', true);
    cap('新舊值的差，加到 parity 上', '就得到新的 parity（跟方法一算的一樣）');
  },
  async (tok, S) => {                                   // 1256 always 2 read + 2 write
    const np = xor(xor(...RW.d), RW.d[2], RW.nd);
    relabel(S.b[2], bin4(RW.nd)); tint(S.b[2], MC.green); relabel(S.p, bin4(np));
    good('不管幾顆硬碟：永遠 2 個 read + 2 個 write', 0, 3.1, 1.4);
    cap('不管有幾顆硬碟', '永遠是 2 個 read、2 個 write');
  },
  async (tok, S) => {                                   // 1273 bandwidth n/4
    hot('write bandwidth ≈ n ÷ 4', 0, 6.6);
    cap('n 顆一起工作是 n 倍', '但一次寫要 4 個 request → n ÷ 4');
  },
  async (tok, S) => {                                   // 1296 4 顆 = 一顆；越多越快
    sm('4 顆：4 ÷ 4 = 1（跟一顆一樣）；8 顆：8 ÷ 4 = 2 倍', 0, 7.3);
    cap('只有四顆時算起來跟一顆一樣', '五顆、六顆…越多，write 也能跟著加速');
  },
]);

scene('io-26c-r6', 'RAID 6：多顆壞掉也能救', CAMW, [
  async (tok, S) => {                                   // 1331 RAID 6 更多 parity
    S.D = disks(5, { w: 2.4 });
    const rows = [['A1', 'A2', 'A3', 'P', 'Q'], ['B1', 'B2', 'P', 'Q', 'B3'], ['C1', 'P', 'Q', 'C2', 'C3']];
    S.cells = []; rows.forEach((row, r) => row.forEach((n, i) => S.cells.push(S.D.put(n, n === 'P' ? MC.gold : n === 'Q' ? MC.orange : MC.blue, i, r))));
    cap('RAID 6 以後', '更複雜：放更多的 parity');
  },
  async (tok, S) => {                                   // 1346 multiple disk failure
    [1, 3].forEach((i) => { S.cells.filter((_, k) => k % 5 === i).forEach((m) => tint(m, MC.red)); bad('✕', S.D.xs[i], 2.6); });
    cap('目的：解決 multiple disk failure', 'RAID 0–5 都只考慮一顆壞掉');
  },
  async (tok, S) => {                                   // 1370 需要更多 redundant information
    note('兩顆同時壞 → 需要更多 redundant 資訊（P + Q，類似 Hamming 那種 coding）', 0, 4.6);
    cap('要救回兩顆，就要更多 redundant 資訊', '回到 Hamming code 那種算法');
  },
  async (tok, S) => {                                   // 1392 浪費空間；7、8、9 少用
    bad('parity 越多越浪費空間、寫入越慢 → 7、8、9 很少人用', 0, 5.4);
    cap('parity 多了就浪費比較多空間', 'RAID 7、8、9 寫入效能差，實際很少用');
  },
]);

scene('io-26c-hybrid', 'Hybrid：RAID 0+1 與 1+0', CAMW, [
  async (tok, S) => {                                   // 1414 hybrid
    hd('Hybrid：把不同 RAID 的概念拼在一起', 0, 7.2);
    cap('最後：hybrid RAID', '把不同 RAID 的概念拼起來');
  },
  async (tok, S) => {                                   // 1428 最常見 0 + 1
    note('parity 那些太複雜 → 最常見是 0 和 1 的結合', 0, 6.5);
    cap('常見的就是 RAID 0 和 1 的結合', '分 0+1 和 1+0：先做哪個的差別');
  },
  async (tok, S) => {                                   // 1439 0+1：先 striping 再 mirror
    S.L = disks(4, { w: 1.6, x: -3.4, z: -1.2 }); hd('RAID 0+1', -3.4, 4.6, -1.2);
    ['A1', 'A2', 'A1', 'A2'].forEach((n, i) => S.L.put(n, i < 2 ? MC.blue : MC.purple, i, 0, 1.2));
    ['A3', 'A4', 'A3', 'A4'].forEach((n, i) => S.L.put(n, i < 2 ? MC.blue : MC.purple, i, 1, 1.2));
    sm('stripe 組 1', -4.2, 2.0, -1.2); sm('stripe 組 2（mirror）', -2.2, 2.0, -1.2);
    cap('0+1：先做 RAID 0（striping）', '再把整組 mirror 一份');
  },
  async (tok, S) => {                                   // 1450 1+0：先 copy 再 striping
    S.R = disks(4, { w: 1.6, x: 3.4, z: -1.2 }); hd('RAID 1+0', 3.4, 4.6, -1.2);
    ['A1', 'A1', 'A2', 'A2'].forEach((n, i) => S.R.put(n, i % 2 ? MC.purple : MC.blue, i, 0, 1.2));
    ['A3', 'A3', 'A4', 'A4'].forEach((n, i) => S.R.put(n, i % 2 ? MC.purple : MC.blue, i, 1, 1.2));
    sm('mirror 對 1', 2.6, 2.0, -1.2); sm('mirror 對 2', 4.2, 2.0, -1.2);
    cap('1+0：反過來', '先 copy（mirror），再做 striping');
  },
  async (tok, S) => {                                   // 1462 看起來一樣
    note('兩邊都是 4 顆、資料都存兩份 → 看起來一模一樣', 0, 5.8);
    cap('兩個看起來完全一模一樣', '仔細看有一個小差別');
  },
  async (tok, S) => {                                   // 1473 1+0 fail 機率小
    good('1+0 通常比較好', 3.4, 5.2, -1.2);
    cap('通常 RAID 1+0', '讀資料失敗的機率比較小');
  },
  async (tok, S) => {                                   // 1489 階層：底層 controller 先處理
    sm('1+0：底層每一對 mirror 有自己的 controller → 一顆壞了，直接拿旁邊的副本', 3.4, 3.2, 1.4);
    cap('RAID 是有階層的：每層有 controller', '1+0 的底層是 mirror：壞一顆，當場拿副本');
  },
  async (tok, S) => {                                   // 1518 0+1：A2 壞 → report error → 上層再找另一組
    bad('0+1：A2 壞 → 這組 stripe 讀不出 → 回報上層 → 再請另一組讀 → 溝通多、delay 大', -3.4, 3.2, 1.4);
    cap('0+1：底層是 stripe 組，A2 壞了就讀不出來', '要回報上層，再去另一組讀：來回溝通');
  },
  async (tok, S) => {                                   // 1551 1+0 local 解決
    good('1+0：在底層 locally 就把 failure 解決', 3.4, 2.4, 1.4);
    cap('1+0 在 local 就先解決 failure', '0+1 需要跨 controller 溝通，比較慢');
  },
]);

// ════════ Ypxv0k322n8（第 26D 講：I/O Systems） ════════
scene('io-26d-why', 'I/O subsystem：多樣的 device，統一的 interface', CAM, [
  async (tok, S) => {                                   // 57 系統不是計算就是 I/O
    S.cpu = prop('cpu', -4.6, 4.4, 0, 1.2, 'CPU'); S.mem = bx('memory', MC.blue, -1.8, 4.6, 0, 2.2, 0.8, 0.9);
    hd('計算', -3.2, 6.0); hd('I/O', 3.6, 6.0);
    cap('系統運作：要嘛在計算，要嘛在 I/O', 'I/O system 負責跟 storage、各種 device 溝通');
  },
  async (tok, S) => {                                   // 82 各式各樣的 device
    S.dev = [prop('keyboard', -4.8, 0, 0, 1.0, 'keyboard'), prop('monitor', -1.6, 0, 0, 0.9, 'monitor'), prop('printer', 1.6, 0, 0, 0.9, 'printer'), prop('disk', 4.6, 0, 0, 1.1, 'disk')];
    cap('I/O 的終點是 I/O devices', '各式各樣都有');
  },
  async (tok, S) => {                                   // 93 challenge：多樣化
    bad('最大的挑戰：device 非常多樣化', 3.6, 4.6);
    cap('困難在於非常多樣化', '每種 device 的控制方式都不一樣');
  },
  async (tok, S) => {                                   // 115 programmer 想要 unified interface
    S.ui = bx('統一的 interface（open / read / write …）', MC.green, 0, 2.6, 0, 11, 0.5, 0.8);
    cap('但對 software 來說', '希望有 unified interface：同一套方法控制不同 device');
  },
  async (tok, S) => {                                   // 134 driver layer
    S.drv = [-4.8, -1.6, 1.6, 4.6].map((x, i) => bx('driver', MC.purple, x, 1.9, 0, 2.2, 0.45, 0.8));
    hd('OS 最下層：device driver layer', 0, 3.4);
    cap('演進的結果：OS 最下層有一層 driver', '由 device 的廠商自己實作、安裝');
  },
  async (tok, S) => {                                   // 152 依統一 interface 實作 → isolation
    good('廠商照 OS 規定的 interface 寫 driver → 上層看不到差異（isolation）', 0, 6.8);
    cap('照統一的 interface 實作怎麼溝通', '把各種 device 的差異隔離在 driver 裡');
  },
  async (tok, S) => {                                   // 171 分類：storage
    glow(S.drv[3], OKG); note('storage 類（SSD、hard drive、tape）：行為類似 → 一種 interface', 2.4, -0.9);
    cap('interface 不好定 → 先把 device 分類', 'storage 類（SSD、HDD、tape）行為很像');
  },
  async (tok, S) => {                                   // 194 networking
    note('network 類：不管哪種網卡，運作方式類似 → 另一種 interface', -2.4, -1.5);
    cap('networking 也是一類', '不管哪種 network adapter，用類似的 interface');
  },
  async (tok, S) => {                                   // 212 不同型別不同 interface；還有後門
    bad('還有「開後門」：直接操作 device → 很多 bug 從這來', 3.6, 5.3);
    cap('不同型別設計不同 interface', '還有一種：開後門，隨你直接控制');
  },
  async (tok, S) => {                                   // 224 新 device → 新 interface
    sm('新 device（像 touch screen 有位置資訊）→ 可能加新的 interface', 0, -2.1);
    cap('interface 也隨時代改變', '像手機的 touch screen，就可能需要新的 interface');
  },
]);

scene('io-26d-hw', 'I/O 硬體：port、bus、controller', CAMW, [
  async (tok, S) => {                                   // 258 port
    S.cpu = prop('cpu', -5.0, 5.6, 0, 1.1, 'CPU');
    S.port = bx('port', MC.gold, 2.6, 2.2, 0, 1.2, 0.5, 0.8);
    S.dv = prop('monitor', 2.6, 0, 0, 0.8, 'device');
    cap('device 連到系統的那個點', '叫做 port（一個 endpoint）');
  },
  async (tok, S) => {                                   // 277 插 USB → port 就是 device 的 ID
    hot('port number = 這個 device 的 ID', 2.6, 3.0);
    cap('像插 USB、接投影機', '一定是插到某個 port：port 就是 device 的 ID');
  },
  async (tok, S) => {                                   // 297 bus
    S.bus = bx('bus（一組 wire）', MC.dark, 0, 3.8, 0, 12, 0.25, 0.4);
    cap('資料要透過 bus 傳進來', 'bus 就是連接 controller、device 的那些線');
  },
  async (tok, S) => {                                   // 316 bus 兩層意義
    sm('① physical：電線上怎麼傳　② protocol：一個 message 幾個 byte、怎麼解讀', 0, 4.4);
    cap('bus 有兩層意義', '物理上怎麼傳，以及溝通的規則（protocol）');
  },
  async (tok, S) => {                                   // 339 PCI bus
    relabel(S.bus, 'PCI bus');
    cap('最常聽到的是 PCI bus', '主機板上支援 I/O device 的 bus');
  },
  async (tok, S) => {                                   // 360 controller
    S.ctl = bx('controller', MC.teal, 2.6, 1.4, 0, 2.0, 0.6, 0.8);
    cap('controller：控制這些溝通的硬體', '上面也有自己的 code');
  },
  async (tok, S) => {                                   // 379 smart controller
    good('聰明的 controller（如 SCSI）自己就能修硬碟 → 減輕 CPU 負擔（但比較貴）', 0, 6.9);
    cap('有比較 smart 的 controller', '像 SCSI：自己處理，不用 OS 幫忙 → CPU 輕鬆');
  },
  async (tok, S) => {                                   // 419 典型 PC 架構
    S.c2 = bx('disk controller', MC.teal, -2.6, 1.4, 0, 2.6, 0.6, 0.8); S.d2 = prop('disk', -2.6, -0.2, 0, 0.8);
    cap('一般電腦：同類 device 由一個 controller 管', 'controller 最後再跟 processor 溝通');
  },
  async (tok, S) => {                                   // 439 controller ↔ controller
    S.cc = arrow(V3(-1.2, 1.4, 0.6), V3(1.5, 1.4, 0.6), 0x2f6fb0);
    sm('資料從一個 port 進、直接從另一個 port 出，不經過 CPU', 0, 0.6, 1.2);
    cap('controller 之間也可以直接溝通', '一樣透過 bus');
  },
  async (tok, S) => {                                   // 463 PCIe、IDE bus
    relabel(S.bus, 'PCIe bus（主要連接 controller）');
    S.ide = bx('IDE bus', MC.gray, -2.6, 2.6, -1.4, 3, 0.2, 0.3);
    cap('現在主要是 PCIe bus', '另外還有自己的 IDE bus、IDE controller');
  },
  async (tok, S) => {                                   // 472 北橋
    S.nb = bx('北橋（快：memory、高頻寬）', MC.orange, -2.0, 5.6, 0, 3.6, 0.6, 0.8);
    cap('CPU 晶片組有南橋、北橋', '北橋管快的：memory、high bandwidth、low latency');
  },
  async (tok, S) => {                                   // 505 南橋
    S.sb = bx('南橋（慢：IDE 等傳統 controller）', MC.lilac, 3.6, 5.6, 0, 3.8, 0.6, 0.8);
    cap('南橋管速度慢的傳統 controller', '快慢分開管，慢的才不會拖累快的');
  },
]);

scene('io-26d-port', 'Port-mapped I/O：I/O instruction 寫到 port', CAMW, [
  async (tok, S) => {                                   // 541 軟體怎麼下指令
    S.cpu = prop('cpu', -4.8, 4.0, 0, 1.2, 'CPU');
    S.ctl = bx('device controller', MC.teal, 3.2, 1.0, 0, 3.2, 0.6, 0.9);
    cap('有了 port、controller、bus', '軟體到底怎麼對 device 下指令？');
  },
  async (tok, S) => {                                   // 559 port-mapped I/O
    hd('最傳統：port-mapped I/O', 0, 6.6);
    cap('最傳統的方式', '叫 port-mapped I/O');
  },
  async (tok, S) => {                                   // 571 port number 一開始就固定
    S.pn = hot('port 0x3F8', 3.2, 1.8);
    cap('每個 device 用 port number（port address）區分', '電腦做出來時就燒死了，跟軟體無關');
  },
  async (tok, S) => {                                   // 604 CPU 知道傳給誰
    S.a = arrow(V3(-3.8, 4.0, 0), V3(2.2, 1.6, 0), 0x2f6fb0);
    cap('CPU 執行的 code', '就知道資料要傳給哪個 port');
  },
  async (tok, S) => {                                   // 629 controller 上的 register
    S.reg = ['data-in', 'data-out', 'status', 'control（command）'].map((n, i) => bx(n, [MC.blue, MC.blue, MC.gold, MC.purple][i], 3.2, 3.0 + i * 0.6, 0, 3.0, 0.5, 0.7));
    cap('controller 上有幾個 register', 'data、command（control）、status');
  },
  async (tok, S) => {                                   // 646 寫 register → 做 I/O
    const pk = bx('寫 command', MC.orange, -3.6, 4.2, 0.8, 1.6, 0.4, 0.5); await slide(tok, pk, 3.2, 4.8, 0.8, 900); kill(pk); glow(S.reg[3], HL);
    cap('把值寫進這些 register', '要 read 還是 write、多少資料 → 就開始做 I/O');
  },
  async (tok, S) => {                                   // 658 I/O instruction：欄位是 port address
    glow(S.reg[3], null);
    S.ins = code(['MOV  R1, [0x1000]   ; memory address', 'OUT  0x3F8, R1      ; port address'], -1.6, 0.2, 0.6, 2.0);
    S.ins.hl(1);
    cap('對 port 下的指令叫 I/O instruction', '欄位裡一定有 port address，不是 memory address');
  },
  async (tok, S) => {                                   // 691 IN / OUT
    good('常見的 I/O instruction：IN、OUT（後面接 port number 和資料）', -1.6, -1.2, 2.0);
    cap('常見的有 IN 和 OUT', 'issue 時要給 port number，後面是資料');
  },
  async (tok, S) => {                                   // 700 典型 port 位址
    const T = [['DMA controller', '000–00F'], ['interrupt controller', '020–021'], ['timer', '040–043'], ['game controller', '200–20F'], ['serial port', '2F8–2FF']];
    T.forEach(([n, r], i) => { sm(n, -5.4, 2.4 - i * 0.5, -1.0); sm(r, -2.8, 2.4 - i * 0.5, -1.0); });
    hd('PC 的 I/O port 位址（課本表）', -4.2, 3.0, -1.0);
    cap('典型的 port number', 'DMA controller、timer、serial port …一開始就 hardcode');
  },
]);

scene('io-26d-mmio', 'Port-mapped vs memory-mapped I/O', CAMW, [
  async (tok, S) => {                                   // 743 第一種分法：addressing
    hd('分法一：怎麼指定要寫給誰（addressing）', 0, 7.2);
    S.cpu = prop('cpu', -5.0, 4.4, 0, 1.1, 'CPU');
    S.ctl = bx('controller buffer', MC.teal, 4.4, 1.0, 0, 2.8, 0.6, 0.9);
    cap('把資料寫到 I/O device 有幾種分法', '第一種：用什麼方式定位要寫給誰');
  },
  async (tok, S) => {                                   // 762 port-mapped
    S.p1 = arrow(V3(-4.0, 4.4, 0), V3(3.2, 1.4, 0), 0x2f6fb0); sm('OUT port, data', -0.6, 3.4, 0.4);
    cap('port-mapped I/O', '用 I/O instruction 直接指定 port number');
  },
  async (tok, S) => {                                   // 785 memory-mapped I/O
    kill(S.p1);
    S.mem = bx('memory 的一段區間', MC.blue, 0, 4.6, 0, 3.4, 0.7, 0.9);
    hd('memory-mapped I/O：寫到 memory', 0, 6.4);
    cap('第二種：memory-mapped I/O', '不寫 port，寫到 memory');
  },
  async (tok, S) => {                                   // 807 用 MOV、沒有 port number
    S.ins = code(['MOV [0xF000], R1   ; 一般的 memory 指令'], -1.0, 3.2, 0.6, 1.4);
    cap('instruction 就是一般的 MOV', '裡面沒有 port number');
  },
  async (tok, S) => {                                   // 818 像 memory-mapped file
    S.lnk = arrow(V3(1.6, 4.4, 0), V3(4.2, 1.5, 0), 0x31aab0);
    note('先把 controller 的 buffer map 到 memory 的某一段（像 memory-mapped file）', 0, 5.6);
    cap('寫 memory 怎麼會寫到 device？', '事先把 controller 的 buffer map 到 memory');
  },
  async (tok, S) => {                                   // 837 寫那段 memory = 寫到 port
    const pk = bx('data', MC.orange, -4.0, 4.6, 0.8, 1.0, 0.4, 0.5); await slide(tok, pk, 0, 3.95, 0.8, 600); await slide(tok, pk, 4.4, 2.05, 0.8, 700); // lands on top of the controller, not on its name
    cap('寫到那段 memory', '就等於寫到那個 port 上的 buffer');
  },
  async (tok, S) => {                                   // 862 好處：大量資料
    good('適合大量資料：CPU 只要寫 memory 就好', -3.8, 2.4);
    cap('好處：很適合大量資料傳輸', 'CPU 最快，不希望它為了 I/O 在那邊等');
  },
  async (tok, S) => {                                   // 886 交給 DMA / controller
    sm('剩下的交給 DMA 或 controller，CPU 空出來', -3.8, 1.8);
    cap('CPU 寫完 memory 就不管了', '剩下的交給 DMA 或 controller');
  },
  async (tok, S) => {                                   // 906 缺點
    bad('缺點：不太 reliable（crash 可能遺失）；資料小時 map / setup 很浪費', 0, 0.4, 1.6);
    cap('缺點：跟 memory-mapped file 一樣', '不太 reliable；資料量小時光 setup 就不划算');
  },
  async (tok, S) => {                                   // 926 顯示卡
    S.mon = prop('monitor', 4.6, 3.2, -1.4, 0.8, '顯示卡');
    cap('最好的例子：顯示卡', '大量資料的 I/O 都適合 memory-mapped');
  },
  async (tok, S) => {                                   // 950 keyboard 很糟
    prop('keyboard', -4.6, 0, 1.6, 0.8, 'keyboard');
    bad('keyboard 一次一個 byte → 用 memory-mapped 很不划算 → 用 port', -2.0, 1.2, 2.4);
    cap('資料很小的，像 keyboard', '用 memory-mapped 很糟：看 I/O 特性選方式');
  },
]);

scene('io-26d-poll', 'Polling vs interrupt：主動還是被動', CAMW, [
  async (tok, S) => {                                   // 968 分法二：主動 / 被動
    hd('分法二：主動（polling）還是被動（interrupt）', 0, 7.2);
    S.cpu = buddy('CPU', '', MC.blue, -4.4, 0, 0, 1.0);
    S.dev = prop('printer', 4.2, 0, 0, 1.0, 'device');
    S.st = bx('status：busy', MC.gold, 4.2, 2.4, 0, 2.2, 0.5, 0.7);
    cap('知道寫給誰之後', '下一個問題：主動 push，還是被動等通知？');
  },
  async (tok, S) => {                                   // 981 polling：busy-waiting
    S.code = code(['while (status == busy)', '    ;   // 一直問', 'write(next byte);'], -1.0, 5.4, 0.55, 0);
    for (let k = 0; k < 2; k++) { const q = sm('好了沒？', -2.6, 2.0, 0.6); await slide(tok, q, 2.8, 2.4, 0.6, 450); remove(q); }
    S.cpu.mood('sad');
    cap('polling：while loop 一直查 status register', '這就是 busy-waiting');
  },
  async (tok, S) => {                                   // 1002 一個 byte 一個 byte push
    txt(S.st.userData.lbl, 'status：ready'); S.code.hl(2);
    const b = bx('byte', MC.orange, -3.4, 1.6, 0.6, 0.8, 0.4, 0.5); await slide(tok, b, 3.4, 1.6, 0.6, 700); kill(b);
    cap('決定什麼時候寫下一個 byte', '主動一直 push 過去');
  },
  async (tok, S) => {                                   // 1011 interrupt：被動通知
    S.code.kill(); S.cpu.mood('happy');
    S.irq = arrow(V3(3.0, 2.0, 0.6), V3(-3.2, 1.4, 0.6), 0xd64545); hot('interrupt：我好了！', 0, 2.6, 0.6);
    cap('被動的：interrupt', '資料寫好了，device 再通知 CPU');
  },
  async (tok, S) => {                                   // 1022 小 I/O：busy wait 划算
    note('I/O 很小：設定、處理 interrupt 反而比較花時間 → 直接 busy-wait', 0, 5.6);
    cap('busy-waiting 雖然浪費 CPU', '但 I/O 很小時，處理 interrupt 更花時間，乾脆等');
  },
  async (tok, S) => {                                   // 1034 大量：interrupt
    good('資料量大 → interrupt，CPU 可以去做別的事', 0, 4.9);
    cap('資料量大就用 interrupt', 'CPU 空出來做其他事');
  },
]);

scene('io-26d-dma', 'Programmed I/O vs DMA：誰來搬資料', CAMW, [
  async (tok, S) => {                                   // 1041 分法三：誰執行搬移
    hd('分法三：誰來搬資料？', 0, 7.2);
    S.cpu = prop('cpu', -4.8, 4.2, 0, 1.2, 'CPU'); S.mem = bx('memory', MC.blue, 4.4, 4.4, 0, 2.6, 0.8, 0.9);
    S.ctl = bx('device controller', MC.teal, 0, 0.6, 0, 3.0, 0.6, 0.9);
    cap('知道給誰、用哪種方式之後', '到底由誰執行搬移？');
  },
  async (tok, S) => {                                   // 1055 device 是被動的
    note('device 只是被動的空間；會執行指令的只有 processor', 0, 2.2);
    cap('搬資料需要一個 processor', 'I/O device 是被動的，只會被讀寫');
  },
  async (tok, S) => {                                   // 1067 programmed I/O
    hot('programmed I/O：CPU 自己搬', -4.8, 6.0);
    cap('傳統做法：用 CPU 下指令搬', '叫 programmed I/O');
  },
  async (tok, S) => {                                   // 1091 每搬一次一個 instruction
    for (let k = 0; k < 3; k++) { const b = bx('4B', MC.orange, 0, 1.4, 0.8, 0.6, 0.35, 0.4); await slide(tok, b, -4.4, 4.6, 0.8, 350); await slide(tok, b, 4.0, 4.6, 0.8, 350); kill(b); }
    bad('每搬一次就一個 instruction → CPU 被綁住', -4.8, 2.6);
    cap('每搬一筆，就要一個 CPU instruction', 'CPU 一直在下 I/O instruction，被綁住了');
  },
  async (tok, S) => {                                   // 1111 DMA
    hd('DMA：Direct Memory Access', 2.6, 6.0);
    cap('最重要的：DMA（Direct Memory Access）', '用 controller 直接搬，CPU 不用參與');
  },
  async (tok, S) => {                                   // 1133 DMA controller
    S.dma = bx('DMA controller', MC.purple, 3.6, 2.2, 0, 2.6, 0.6, 0.9);
    for (let k = 0; k < 2; k++) { const b = bx('4B', MC.orange, 0, 1.4, 0.8, 0.6, 0.35, 0.4); await slide(tok, b, 3.6, 2.6, 0.8, 350); await slide(tok, b, 4.4, 4.6, 0.8, 350); kill(b); }
    cap('系統裡專門裝一個 DMA controller', '不屬於任何 device，只負責搬資料、不做計算');
  },
  async (tok, S) => {                                   // 1160 資料量大才需要
    note('資料量大時才值得請它幫忙', 2.6, 0.0, 1.4);
    cap('什麼時候需要另一個人幫忙？', '資料量很大的時候');
  },
  async (tok, S) => {                                   // 1175 CPU initiate → interrupt
    S.ir = arrow(V3(2.4, 2.4, 0.6), V3(-3.8, 3.8, 0.6), 0xd64545); sm('搬完 → interrupt', -0.6, 3.6, 0.6);
    cap('CPU 跟 DMA 發起一個 I/O request', '之後等 interrupt 通知就好');
  },
  async (tok, S) => {                                   // 1201 DMA = memory-mapped + interrupt
    good('DMA：通常搭配 memory-mapped + interrupt', 3.0, -0.6, 2.0);
    cap('CPU 只想看到「資料已經在 memory 裡」', '所以 DMA 通常是 memory-mapped + interrupt');
  },
  async (tok, S) => {                                   // 1225 programmed I/O = polling
    note('programmed I/O：通常搭配 polling（busy-waiting，一個 byte 一個 byte）', -3.0, -1.2, 2.0);
    cap('三種分法可以組合', 'programmed I/O 常配 polling，一個 byte 一個 byte push');
  },
]);

scene('io-26d-dmastep', 'DMA 一步一步：讀 100 MB 的檔案', CAMW, [
  async (tok, S) => {                                   // 1243 從 CPU 開始
    S.cpu = prop('cpu', -5.0, 5.0, 0, 1.1, 'CPU');
    S.mem = bx('memory：buffer X', MC.blue, 4.2, 5.2, 0, 3.0, 0.8, 0.9);
    S.drv = bx('device driver', MC.purple, -2.0, 5.2, 0, 2.4, 0.6, 0.8);
    S.dc = bx('disk controller', MC.teal, -3.4, 1.2, 0, 2.8, 0.6, 0.9); S.dk = prop('disk', -5.6, -0.4, 0, 0.8);
    S.dma = bx('DMA controller', MC.orange, 2.4, 2.4, 0, 2.8, 0.6, 0.9);
    cap('DMA 怎麼運作：step by step', '一切從 CPU 開始');
  },
  async (tok, S) => {                                   // 1291 例子：讀 100 MB 的 file
    S.f = prop('file', -5.6, 1.6, 1.4, 0.6, '100 MB');
    cap('例子：程式要把 100 MB 的 file 讀進來', '放到 memory，之後直接 access');
  },
  async (tok, S) => {                                   // 1307 ① CPU 下 I/O request → OS → driver
    S.a1 = arrow(V3(-4.2, 5.2, 0.6), V3(-3.0, 5.2, 0.6), 0x2f6fb0); hot('①', -3.6, 5.8, 0.6);
    cap('① CPU 下 I/O request', '從 program → OS → device driver');
  },
  async (tok, S) => {                                   // 1315 ② driver 告訴 disk controller
    S.a2 = arrow(V3(-2.2, 4.8, 0.6), V3(-3.2, 1.6, 0.6), 0x2f6fb0); hot('②', -3.4, 3.4, 0.6);
    sm('從 disk 的哪裡 → 放到 buffer X，長度 C = 100 MB', -1.4, 3.0, 1.4);
    cap('② driver 跟 disk controller 說', '資料在 disk 哪裡、要放到 memory 的 X、長度 C');
  },
  async (tok, S) => {                                   // 1356 ③ 要用 DMA
    hot('③ 用 DMA 來做', -0.6, 1.9, 0.6);
    cap('③ 告訴 disk controller', '這次要用 DMA 的方式完成');
  },
  async (tok, S) => {                                   // 1378 ④ 請 DMA controller set up
    S.a3 = arrow(V3(-1.9, 1.4, 0.6), V3(1.0, 2.2, 0.6), 0x2f6fb0);
    sm('DMA 知道：來源在哪、目的 X、還剩 C', 2.4, 3.1, 0.6);
    cap('④ disk controller 請 DMA controller 搬', '提供來源、目的位址（initiate 一個 I/O）');
  },
  async (tok, S) => {                                   // 1399 ⑤ buffer 只有 4 bytes → 一次 4 bytes
    for (let k = 0; k < 3; k++) { const b = bx('4B', MC.gold, -3.4, 1.6, 1.0, 0.6, 0.35, 0.4); await slide(tok, b, 2.4, 2.8, 1.0, 400); await slide(tok, b, 4.2, 4.3, 1.0, 350); kill(b); } // each 4 bytes stops just under buffer X (its name stays clear)
    sm('controller buffer 只有 4 bytes（示意）→ 來回非常多次，全由 DMA 執行', 1.0, 0.6, 1.8);
    cap('⑤ controller 的 buffer 假設只有 4 bytes', '就 4 bytes 4 bytes 慢慢搬，DMA 一直來回');
  },
  async (tok, S) => {                                   // 1419 ⑥ 寫到 X，知道何時寫完
    S.cnt = hot('X += 4、C −= 4 … 直到 C = 0', 4.2, 6.2);
    cap('⑥ 每搬 4 bytes 就寫到 X 的位置', 'DMA 自己算位址，知道什麼時候寫完');
  },
  async (tok, S) => {                                   // 1433 ⑦ 寫完 → interrupt CPU
    S.irq = arrow(V3(1.2, 2.8, 1.0), V3(-4.2, 4.6, 1.0), 0xd64545); bad('⑦ interrupt：做完了！', -1.4, 4.0, 1.0);
    cap('⑦ 全部寫完，DMA 產生一個 interrupt', '告訴 CPU：剛剛的 I/O request 做完了');
  },
  async (tok, S) => {                                   // 1444 ⑧ 通知 program
    glow(S.mem, OKG); good('資料都在 memory 了', 4.2, 6.9);
    cap('⑧ 再通知當初做 I/O 的 program', '它一看 memory，資料都在了');
  },
  async (tok, S) => {                                   // 1477 CPU 只接到一次 interrupt
    hot('CPU 只接到 1 次 interrupt', -5.0, 6.6);
    cap('整個過程 CPU 只接到一個 interrupt', '中間其實來來回回非常多次（都是 DMA 在做）');
  },
  async (tok, S) => {                                   // 1487 對比 programmed I/O
    bad('programmed I/O：每 4 bytes CPU 都要處理一次（100 MB ÷ 4 B → 上千萬次）', 0, -0.6, 2.0);
    cap('如果是 programmed I/O', 'CPU 每 4 bytes 就要處理一次：速度一直被拖慢');
  },
  async (tok, S) => {                                   // 1521 總結
    note('driver → disk controller → DMA controller 搬 → interrupt CPU', 0, 7.4);
    cap('總結 DMA', 'disk controller 找 DMA setup，搬完 DMA 再 signal CPU');
  },
]);

scene('io-26d-kio', 'Kernel I/O subsystem：scheduling、buffering、caching、spooling', CAMW, [
  async (tok, S) => {                                   // 1577 I/O scheduling
    S.it = ['I/O scheduling', 'buffering', 'caching', 'spooling', 'error handling', 'protection'].map((n, i) => bx(n, MC.gray, -5.6, 6.4 - i * 0.8, 0, 2.6, 0.55, 0.8));
    glow(S.it[0], HL);
    cap('kernel 的 I/O subsystem 要做很多事', '第一：I/O scheduling');
  },
  async (tok, S) => {                                   // 1588 disk scheduling、FS scheduling
    note('= disk scheduling、file system 的 scheduling（影響效能）', 1.2, 6.4);
    cap('就是學過的 disk scheduling', '還有 file system 的 scheduling');
  },
  async (tok, S) => {                                   // 1594 buffering：速度不同
    glow(S.it[0], null); glow(S.it[1], HL);
    S.a = prop('keyboard', -2.0, 3.2, 0, 0.8, '慢的 device'); S.b = prop('disk', 4.6, 3.2, 0, 0.9, '快的 device');
    cap('第二：buffering', '不同 device 的速度一定不一樣');
  },
  async (tok, S) => {                                   // 1613 buffer 累積再寫
    S.buf = bx('buffer（memory）', MC.sky, 1.4, 3.6, 0, 2.0, 0.6, 0.8);
    for (let k = 0; k < 3; k++) { const p = bx('', MC.orange, -1.2, 3.8, 0.6, 0.3, 0.3, 0.3); await slide(tok, p, 1.0 + k * 0.3, 4.1, 0.6, 350); }
    cap('先寫到一塊有彈性的空間累積', '等累積一段時間，再一次寫到另一個 device');
  },
  async (tok, S) => {                                   // 1632 代價：memory copy
    sm('代價：多了 memory copy；好處：不會 overflow', 1.4, 2.8);
    cap('buffer 一定是某塊 memory', '代價是多做幾次 data copy，換來不會 overflow');
  },
  async (tok, S) => {                                   // 1652 caching
    glow(S.it[1], null); glow(S.it[2], HL);
    S.c = bx('cache（副本）', MC.mint, 1.4, 2.2, 0, 2.0, 0.6, 0.8);
    cap('第三：caching', '不想每次都走到最慢的 device');
  },
  async (tok, S) => {                                   // 1671 目的不同
    note('cache：可以丟掉的副本，為了「重複讀更快」｜ buffer：調節 device 之間的速度', 1.4, 1.4);
    cap('同一塊 memory 可以兼做 cache 和 buffer', '但目的不同：cache 是可丟的副本');
  },
  async (tok, S) => {                                   // 1699 spooling：output only
    glow(S.it[2], null); glow(S.it[3], HL);
    S.pr = prop('printer', 4.6, 0, 1.6, 0.9, 'printer');
    S.sp = bx('spool（disk 上排隊）', MC.lilac, 1.0, 0.3, 1.6, 2.6, 0.5, 0.8);
    cap('第四：spooling（只用在 output）', '像 printer 這一類');
  },
  async (tok, S) => {                                   // 1715 一份收齊再送印
    S.jobs = ['P1', 'P2'].map((n, i) => bx(n + ' 的輸出', MC.orange, -3.0, 0.3 + i * 0.55, 1.6, 1.8, 0.45, 0.7));
    await slide(tok, S.jobs[0], 1.0, 0.85, 1.6, 600); await slide(tok, S.jobs[0], 4.6, 1.4, 1.6, 600); kill(S.jobs[0]);
    cap('先把資料 load 到 spool 空間', '一份收齊了，再一次送去 printer 印出來');
  },
  async (tok, S) => {                                   // 1735 error handling
    glow(S.it[3], null); glow(S.it[4], HL);
    note('偵測、修復錯誤（ECC、RAID…），而且不能讓整個系統 crash', 1.2, -0.8, 1.4);
    cap('第五：error handling', '偵測、修復錯誤，而且不能讓系統 crash');
  },
  async (tok, S) => {                                   // 1769 protection
    glow(S.it[4], null); glow(S.it[5], HL);
    good('I/O instruction 全是 privileged instruction → 只有 kernel 能執行', 1.2, -1.5, 2.0);
    cap('第六：protection', 'I/O 是共用又敏感的：I/O instruction 都是 privileged');
  },
]);

scene('io-26d-devfile', 'Unix：device 當成 file；device queue', CAMW, [
  async (tok, S) => {                                   // 1784 device 當 file
    prop('file', -4.6, 2.4, 0, 1.2, 'file'); sm('=', -3.2, 3.2); prop('printer', -1.8, 2.4, 0, 0.9, 'device');
    cap('Linux / Unix 怎麼管理 I/O？', '把 device 當成 file：I/O 就像讀寫檔案');
  },
  async (tok, S) => {                                   // 1813 /dev 資料夾
    S.dv = code(['/dev/', '  sda     → disk', '  tty0    → terminal', '  lp0     → printer'], 2.6, 4.8, 0.55, 0);
    cap('作業系統裡有個資料夾放一大堆檔案', '每個檔案對應一個 device，寫進去其實是寫到 device 的 buffer');
  },
  async (tok, S) => {                                   // 1832 device queue
    S.q = ['disk'].map((n) => hd(n + ' 的 queue：', -5.4, 0.6));
    S.r = [0, 1, 2].map((i) => bx('req ' + (i + 1), MC.orange, -3.2 + i * 1.7, 0.6, 0, 1.4, 0.5, 0.7));
    cap('還有 device queue', '每個 device 的 request 串成一串');
  },
  async (tok, S) => {                                   // 1849 scheduling 用這些資訊
    S.r.forEach((m, i) => { m.position.x = -3.2 + [2, 0, 1][i] * 1.7; });
    cap('scheduling 就靠這些資訊', '決定哪個 request 先做、哪個後做');
  },
  async (tok, S) => {                                   // 1857 status
    relabel(S.r[1], 'req 2：processing'); relabel(S.r[0], 'req 1：waiting'); relabel(S.r[2], 'req 3：waiting');
    [0, 1, 2].forEach((i) => { S.r[i].scale.x = 1.6; S.r[i].position.x = -2.6 + [2, 0, 1][i] * 2.4; });
    cap('每個 request 還記著 status', '現在是 waiting，還是正在 processing');
  },
]);

scene('io-26d-block', 'Blocking vs non-blocking I/O', CAMW, [
  async (tok, S) => {                                   // 1880 blocking
    S.p = buddy('program', '', MC.blue, -4.6, 0, 0, 1.0); S.k = bx('kernel：做 I/O', MC.purple, 2.6, 0.8, 0, 3.0, 0.6, 0.9);
    S.c = code(['write(fd, buf, n);  // system call'], -1.0, 4.2, 0.6, 0);
    S.p.mood('sad'); hd('blocking：完成前不 return', -4.6, 2.6);
    cap('每個 I/O 都是一個 system call', 'blocking：要等做完才 return');
  },
  async (tok, S) => {                                   // 1898 synchronous
    note('blocking → synchronous（同步）', 2.6, 2.4);
    cap('blocking 的結果', '是 synchronous（同步）的溝通');
  },
  async (tok, S) => {                                   // 1905 write return = 做完
    S.p.mood('happy'); good('write return 時 → 一定已經寫完', -1.0, 5.0);
    cap('call 一個 write，等它 return', '就知道 write 已經做完了');
  },
  async (tok, S) => {                                   // 1921 non-blocking：立刻 return
    hd('non-blocking：立刻 return', 2.6, 3.2); await S.p.hop(tok);
    cap('另一型：non-blocking', 'call 下去馬上 return，不卡住 program');
  },
  async (tok, S) => {                                   // 1951 asynchronous：還沒做完
    bad('return 了，但 I/O 其實還沒做完 → asynchronous（非同步）', 0, 5.8);
    cap('system 記下需要的資訊，慢慢幫你做', 'return 時其實還沒完成：asynchronous');
  },
  async (tok, S) => {                                   // 1969 blocking 好寫但效能差
    note('blocking：最好寫，但 program 卡在那 → 效能差', -3.0, 6.6);
    cap('blocking 寫程式最直覺', '缺點：上面的人卡在那裡等，效能很差');
  },
  async (tok, S) => {                                   // 1981 non-blocking + interrupt 通知
    S.irq = arrow(V3(1.4, 1.2, 0.6), V3(-3.6, 1.2, 0.6), 0xd64545); sm('做完 → interrupt 通知', -1.0, 1.8, 0.6);
    cap('所以大家通常用 non-blocking / asynchronous', '做完的時候透過 interrupt 通知');
  },
  async (tok, S) => {                                   // 2010 write + callback
    S.c.kill(); S.c2 = code(['write(...);           // ① 先 call，立刻 return', '...做別的事...', 'on_write_done() { } // ② callback：真的做完'], -1.0, 4.4, 0.6, 0); S.c2.hl(2);
    cap('一個 I/O 由兩個 function 組成', 'write 先 call，write callback 被呼叫時才真的完成');
  },
]);

scene('io-26d-perf', 'I/O 為什麼慢：很多層、很多 copy', CAMW, [
  async (tok, S) => {                                   // 2047 一層一層
    S.L = [['user application', MC.blue], ['I/O subsystem / FS', MC.green], ['device driver', MC.purple], ['controller / hardware', MC.teal]].map(([n, c], i) => bx(n, c, -2.0, 6.0 - i * 1.3, 0, 4.6, 0.7, 0.9));
    cap('一次 I/O 的流程', '從 hardware → driver → I/O subsystem / FS');
  },
  async (tok, S) => {                                   // 2059 caching → 快速回到 user
    good('上層有 cache：能命中就直接回到 user', 3.8, 4.7);
    cap('上層會做 caching', '不一定要走到最下層，盡量很快回到使用者');
  },
  async (tok, S) => {                                   // 2069 不行才到 driver
    S.h = hot('▼', -2.0, 6.6); await anim(tok, 1200, (u) => { S.h.position.y = 6.6 - 4.0 * u; });
    sm('driver 用 interrupt 跟 controller 溝通 → 程式不用卡著', 3.8, 2.1);
    cap('cache 不行，才一路到 device driver', 'driver 透過 interrupt 跟 controller 溝通');
  },
  async (tok, S) => {                                   // 2088 I/O 是 bottleneck
    bad('I/O 常常是 bottleneck', 3.8, 6.4);
    cap('I/O 通常非常慢', '處理大量 data 時，I/O 常是瓶頸');
  },
  async (tok, S) => {                                   // 2114 很多層 → context switch
    sm('每 call 一層 → context switch', 3.8, 3.4);
    cap('要一層一層 call 下去才完成', '層數多 → 一堆 context switch');
  },
  async (tok, S) => {                                   // 2145 每層 copy
    for (let k = 0; k < 3; k++) { const c = bx('copy', MC.orange, 0.8, 6.0 - k * 1.3, 0.8, 0.9, 0.4, 0.5); await slide(tok, c, 0.8, 5.4 - k * 1.3, 0.8, 300); }
    cap('每一層都有 buffer 或 cache', '資料一直被 copy：理想上只要一次 copy');
  },
  async (tok, S) => {                                   // 2183 zero copy
    good('zero copy：直接在 user memory / controller memory 之間搬', 3.8, 0.8);
    cap('高效能 I/O 的技術：zero copy', '從 user memory 直接 copy 到 controller（甚至遠端）');
  },
  async (tok, S) => {                                   // 2202 interrupt overhead
    sm('interrupt：可以分工，但多了 overhead', 3.8, 0.1);
    cap('interrupt 有好有壞', '好處是分工，壞處是多了 overhead');
  },
  async (tok, S) => {                                   // 2225 原則
    note('減少 layer、context switch、copy；小 I/O 少用 interrupt；大量用 DMA', 0, -0.9, 1.6);
    cap('提升 I/O 效能的原則', '少 context switch、少 copy、小 I/O 少用 interrupt、用 DMA');
  },
]);

scene('io-26d-api', 'Application I/O interface：device 分類', CAMW, [
  async (tok, S) => {                                   // 2249 driver 提供 interface
    S.drv = bx('device driver：提供 interface', MC.purple, 0, 6.6, 0, 6, 0.6, 0.9);
    cap('driver 最主要就是提供 interface', '');
  },
  async (tok, S) => {                                   // 2268 device 特性
    sm('特性不同：存取方式（循序 / 隨機）、速度、單向 / 雙向 …', 0, 5.8);
    cap('device 型別太多，特性都不同', '存取方式、速度、one-way 或 two-way');
  },
  async (tok, S) => {                                   // 2280 分類
    S.cls = ['block', 'character', 'memory-mapped', 'network', 'timer'].map((n, i) => bx(n, [MC.blue, MC.green, MC.teal, MC.orange, MC.gold][i], -5.2 + i * 2.6, 4.4, 0, 2.3, 0.6, 0.8));
    cap('依特性分類', 'block、character、memory-mapped、network、timer');
  },
  async (tok, S) => {                                   // 2302 不 match → backdoor
    bad('分不進去就開後門（早期 MS-DOS）：直接寫 controller → security hole', 0, 2.4);
    cap('總有 device 分不進去', '早期 MS-DOS 的 backdoor：方便，卻是嚴重的 security 漏洞');
  },
  async (tok, S) => {                                   // 2349 block：read / write / seek
    sm('read、write、seek（一次一整個 block）', S.cls[0].position.x, 3.6);
    glow(S.cls[0], HL);
    cap('block device：像 file system 熟的那種', 'read、write、seek，一次一整個 block');
  },
  async (tok, S) => {                                   // 2356 character：以 byte 為單位
    glow(S.cls[0], null); glow(S.cls[1], HL);
    sm('get / put 一個 byte（keyboard）', S.cls[1].position.x, 3.0);
    cap('character device：以 byte 為單位', '像 keyboard');
  },
  async (tok, S) => {                                   // 2364 小的 polling、大的 interrupt
    glow(S.cls[1], null);
    note('資料小的可以 polling，資料大的用 interrupt', 0, 1.6);
    cap('資料的大小不同', '小的可能用 polling，大的用 interrupt');
  },
  async (tok, S) => {                                   // 2375 network：send / receive
    glow(S.cls[3], HL); sm('send、receive（socket）', S.cls[3].position.x, 3.6);
    cap('network device', '行為就是 send 和 receive');
  },
  async (tok, S) => {                                   // 2384 stream、pipe 等
    glow(S.cls[3], null);
    sm('還有 stream、pipe 等：多層才完成一個 I/O', 0, 0.8);
    cap('其他比較特殊的：stream、pipe', '很多層才完成 → 又是不同的 interface');
  },
]);

// ════════ lQAYseBJPuA（SCAN Disk Scheduling Algorithm，TutorialsPoint 英文短片；同一組 queue，用「上一個 request 在 60」判斷方向） ════════
scene('io-scan2-prob', 'SCAN 題目：head 在 53，上一個 request 在 60', CAMD, [
  async (tok, S) => {                                   // 0 同一題，換 SCAN
    cap('同一個磁碟排程問題', '這次用 SCAN 演算法來解');
  },
  async (tok, S) => {                                   // 22 200 個 cylinder
    bx('', '#6e5f49', 0, 0.03, -3.3, 12.2, 0.06, 0.06); sm('0', X(0), 0.05, -2.75); sm('199', X(199), 0.05, -2.75);
    cap('磁碟有 200 個 cylinder', '編號 0 到 199');
  },
  async (tok, S) => {                                   // 30 head 在 53
    S.h = bx('', MC.blue, X(53), 0.2, -1.6, 0.4, 0.4, 0.4); hot('head 53', X(53) - 1.0, 0.6, -1.6);
    cap('讀寫頭目前在 cylinder 53', '');
  },
  async (tok, S) => {                                   // 40 上一個 request 在 60
    bx('', MC.gray, X(60), 0.2, -1.6, 0.3, 0.3, 0.3); sm('上一個：60', X(60) + 1.1, 0.6, -1.0);
    seg(V3(X(60), 0.5, -1.6), V3(X(53), 0.5, -1.6), '#d64545');
    note('SCAN 會用到「上一個 request 在 60」這個資訊', 0, 0.6, 0.4);
    cap('上一個 request 在 cylinder 60', 'SCAN 會用到這個資訊');
  },
  async (tok, S) => {                                   // 51 FIFO queue
    QQ.forEach((r, i) => bx(String(r), MC.orange, -4.9 + i * 1.4, 0.3, 2.6, 1.1, 0.5, 0.6)); sm('queue（FIFO）', -5.2, 0.3, 3.5);
    cap('等待中的 request 依 FIFO 順序', '98, 183, 37, 122, 14, 124, 65, 67');
  },
  async (tok, S) => {                                   // 57 算總移動距離
    hot('讀寫頭總共要移動多少 cylinder？', 0, 0.6, 4.6);
    cap('題目：算出讀寫頭總共移動的距離', '');
  },
]);

scene('io-scan2-dir', 'SCAN 的方向：看磁頭原本往哪裡走', CAMD, [
  async (tok, S) => {                                   // 66 依遞增順序排好
    S.D = dsk(QH, QQ, { dz: 0.6 }); kill(S.D.hm); remove(S.D.hl);
    cap('把 0、199 和所有 request 依遞增順序排好', '0, 14, 37, 65, 67, 98, 122, 124, 183, 199');
  },
  async (tok, S) => {                                   // 75 把 53 放進去
    S.D.hm = bx('', MC.blue, X(QH), 0.2, S.D.z, 0.4, 0.4, 0.4); S.D.hl = hot('head 53', X(QH) - 0.9, 0.6, S.D.z);
    cap('再把 53 放進去', '它不在 request 裡，但讀寫頭一開始就在 53');
  },
  async (tok, S) => {                                   // 87 60 → 53：往遞減方向
    bx('', MC.gray, X(60), 0.2, S.D.z, 0.3, 0.3, 0.3); sm('上一個 60', X(60) + 0.9, 0.6, -2.1);
    S.ar = arrow(V3(X(60), 0.9, -1.5), V3(X(10), 0.9, -1.5), 0x2f6fb0); sm('慣性：往編號變小的方向', X(30), 0.6, -0.8);
    cap('上一個在 60，現在在 53：60 → 53 是遞減', '讀寫頭有往小編號移動的「慣性」');
  },
  async (tok, S) => {                                   // 116 先到 0，再上到 183
    good('所以：53 → 37 → 14 → 0，再 → 65 → … → 183', 0, 0.6, 0.6);
    cap('所以先往 0 一路走到底', '再折返往上，走到 183');
  },
  async (tok, S) => {                                   // 123 如果上一個是 6
    arrow(V3(X(53), 0.9, 1.6), V3(X(190), 0.9, 1.6), 0xe55a9b);
    bad('假設上一個是 6：6 → 53 遞增 → 先 183、199，再折返服務 37、14', 0, 0.6, 2.4);
    cap('如果上一個是 6 呢？', '6 → 53 是遞增：先走到 183、199，再折返服務 37、14');
  },
  async (tok, S) => {                                   // 140 SCAN 需要這個資訊
    note('SCAN 要知道磁頭原本的移動方向', 0, 0.6, 3.6);
    cap('所以 SCAN 需要「上一個 request」這個資訊', '才知道一開始要往哪個方向掃');
  },
]);

// 9 段移動量（照影片的寫法：0 → 65 寫成 65 − 0）
const SCAN2 = [[53, 37], [37, 14], [14, 0], [65, 0], [67, 65], [98, 67], [122, 98], [124, 122], [183, 124]];
scene('io-scan2-run', 'SCAN 的服務順序與總移動（236）', CAMD, [
  async (tok, S) => {                                   // 146 從 53 開始
    S.D = dsk(QH, QQ, { dz: 0.6 }); S.D.tl.position.set(-4.6, 0.6, 3.6);
    bx('', MC.gray, X(60), 0.2, S.D.z, 0.3, 0.3, 0.3); sm('上一個 60', X(60) + 0.9, 0.6, -2.1);
    cap('從 53 開始，先往遞減方向', '（上一個在 60）');
  },
  ...moves('scan', 'down', 'SCAN'),                     // 154–170 37, 14, 0, 65, 67, 98, 122, 124, 183
  async (tok, S) => {                                   // 175 每一段的移動量
    S.r = SCAN2.map(([a, b], i) => sm(a + '−' + b, -5.6 + i * 1.4, 0.6, i % 2 ? 5.3 : 4.6));
    cap('每一段的移動量：大的減小的', '53−37、37−14、14−0、65−0、67−65 …');
  },
  async (tok, S) => {                                   // 206 算出來
    SCAN2.forEach(([a, b], i) => txt(S.r[i], a + '−' + b + '=' + (a - b)));
    cap('做減法', '16, 23, 14, 65, 2, 31, 24, 2, 59');
  },
  async (tok, S) => {                                   // 241 加總 236
    const want = chk(S.D, 'scan', 'down');
    good(SCAN2.map(([a, b]) => a - b).join('+') + ' = ' + want, 0, 0.6, 6.1);
    cap('全部加起來：總移動 ' + want + ' cylinders', '跟 53 + 183 一樣');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
