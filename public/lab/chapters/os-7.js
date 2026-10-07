// 作業系統 第7章：記憶體管理（Main Memory）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子來源：
//   清大 周志遠 第11B講（有字幕）：page table 放在 memory、PTBR 隨 context switch 載入、
//     一次 read 變兩次 memory access（100 GB/s → 50 GB/s）、TLB = associative memory（entry 1、7、5、2，O(1) 平行比對）、
//     TLB hit / miss 流程、context switch 時 flush TLB 或加 PID 欄位（每筆 8 → 12 bytes）、
//     EMAT：TLB 20 ns、memory 100 ns，hit 70% → 150 ns、98% → 122 ns。
//   其餘（第10A–10D、11A、12A、12B 講尚無逐字稿）依恐龍書（Silberschatz, Operating System Concepts）的圖例：
//     symbolic → relocatable → absolute（count → 14 → 74014）、base 300040 / limit 120900、relocation 14000 + 346 = 14346、
//     first / best / worst fit 習題（hole 100K/500K/200K/300K/600K，process 212K/417K/112K/426K）、50-percent rule、
//     18,464 bytes hole 與 18,462 bytes 請求、page 2048 bytes 的 72,766 bytes process（internal 962 bytes）、
//     32 bytes 記憶體 / page 4 bytes（page table 5, 6, 1, 2）、32-bit + 4KB 的 page table 4 MB、two-level 10|10|12、
//     hashed / inverted page table、ed 編輯器共用 page（frame 3, 4, 6）、segmentation 圖例（(2,53) → 4353）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const BLUE = '#4b9ee2', ORANGE = '#dd8238', GREEN = '#2fc092', PURPLE = '#9b7ef4', PINK = '#e55a9b', TEAL = '#31aab0';
  const RED = '#d64545', GRAY = '#d8cfc0', DARK = '#8d8170', SAND = '#e9dcc4', GOLD = '#6a4a00', OKG = '#0f5a3a', BADR = '#5a1010';
  const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' };
  function fresh(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    fn().catch((err) => { if (!/changed/.test(err.message)) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }
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
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const mono = (l) => { Object.assign(l.element.style, MONO); return l; };
  // CSS2D labels ignore a hidden parent, so hide the value label too
  const vis = (m, on) => { m.visible = on; if (m.userData.lbl) m.userData.lbl.visible = on; };
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function line(x1, y1, x2, y2, z = 0, color = '#a8946c') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function ghost(color, w, h, d, x, y, z = 0, op = 0.14) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x, y, z); lab.world.add(m); return m;
  }
  // a small packet that travels along a list of points
  async function travel(tok, m, pts, ms = 450) { for (const [x, y, z] of pts) { move(m, x, y, z || 0); await wait(tok, ms); } }
  const bin = (v, w) => v.toString(2).padStart(w, '0');
  const fmtB = (b) => { const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (+b.toFixed(2)) + ' ' + u[i]; };
  const pow2 = (k) => k < 31 ? (1 << k) : Math.pow(2, k);

  // ═════════════════════════ Mode 1：Paging 位址轉換（含 TLB） ═════════════════════════
  const tr = { n: 2, pt: [], valid: [], tlb: [], useTlb: true, st: { acc: 0, hit: 0, miss: 0, ns: 0, trap: 0 }, o: {}, addr: 13 };
  const TR_M = 5, TR_FR = 8; // logical 32 bytes（5 bits），physical 8 frames
  function trNewTable() {
    const pages = 1 << (TR_M - tr.n);
    const fr = [...Array(TR_FR).keys()].sort(() => Math.random() - 0.5);
    tr.pt = []; tr.valid = [];
    const validN = pages === 8 ? 6 : 3;
    for (let p = 0; p < pages; p++) { tr.pt.push(fr[p % TR_FR]); tr.valid.push(p < validN); }
    tr.tlb = [];
  }
  const trY = (i) => 5.0 - i * 0.56;
  function trDraw() {
    lab.clear();
    const o = tr.o = {};
    const pages = tr.pt.length, pBits = TR_M - tr.n, fBits = 3;
    tag('logical address', 'ptr', -4.0, 6.95);
    o.lb = []; for (let i = 0; i < TR_M; i++) o.lb.push(cube('0', i < pBits ? BLUE : ORANGE, [0.52, 0.52, 0.52], -5.3 + i * 0.62, 6.2));
    tag('p（' + pBits + ' bits）', 'idx', -5.3 + (pBits - 1) * 0.31, 5.62); tag('d（' + tr.n + ' bits）', 'idx', -5.3 + pBits * 0.62 + (tr.n - 1) * 0.31, 5.62);
    tag('page table', 'ptr', -1.1, 5.55);
    o.pt = tr.pt.map((f, p) => { tag(String(p), 'idx', -1.85, trY(p)); return cube(tr.valid[p] ? 'f = ' + f : 'invalid', tr.valid[p] ? SAND : GRAY, [1.3, 0.42, 0.8], -1.0, trY(p)); });
    tag('TLB（3 筆）', 'ptr alt', -4.6, 4.75);
    ghost(RED, 2.6, 2.0, 1.2, -4.6, 3.45, 0, 0.07);
    tag('MMU', 'idx', -5.75, 2.3);
    o.tlb = [0, 1, 2].map((i) => cube('', '#f6efe2', [2.1, 0.42, 0.8], -4.6, 4.1 - i * 0.56));
    tag('physical address', 'ptr', 3.3, 6.95);
    o.pb = []; for (let i = 0; i < fBits + tr.n; i++) o.pb.push(cube('0', i < fBits ? GREEN : ORANGE, [0.52, 0.52, 0.52], 1.6 + i * 0.62, 6.2));
    tag('physical memory', 'ptr', 5.2, 5.55);
    o.fr = []; for (let f = 0; f < TR_FR; f++) { tag('frame ' + f, 'idx', 3.75, trY(f)); o.fr.push(cube(f * (1 << tr.n) + '–' + ((f + 1) * (1 << tr.n) - 1), '#f6efe2', [1.6, 0.42, 0.8], 5.3, trY(f))); }
    o.pkt = null;
    trTlbDraw(); trBits(tr.addr, null, null); trState();
  }
  function trTlbDraw() {
    tr.o.tlb.forEach((m, i) => { const e = tr.tlb[i]; relabel(m, e ? 'p ' + e.p + ' → f ' + e.f : '（空）'); tint(m, e ? '#cfe6f7' : '#f6efe2'); glow(m, null); });
  }
  function trBits(addr, f, d) {
    const s = bin(addr, TR_M);
    tr.o.lb.forEach((m, i) => relabel(m, s[i]));
    const fb = f === null ? '?'.repeat(3) : bin(f, 3), db = d === null ? '?'.repeat(tr.n) : bin(d, tr.n);
    (fb + db).split('').forEach((ch, i) => relabel(tr.o.pb[i], ch));
  }
  function trState(extra) {
    const s = tr.st, avg = s.acc ? (s.ns / s.acc).toFixed(1) : '—';
    setState('Paging 位址轉換', [['page size', (1 << tr.n) + ' bytes（d = ' + tr.n + ' bits）'], ['logical / physical', '32 bytes / ' + (TR_FR << tr.n) + ' bytes'],
      ['TLB', tr.useTlb ? '開（20 ns）' : '關'], ['存取次數', String(s.acc)], ['TLB hit / miss', s.hit + ' / ' + s.miss], ['trap', String(s.trap)], ['平均時間', avg === '—' ? avg : avg + ' ns']],
      (extra ? extra + '<br>' : '') + 'physical = f × page size + d（memory 100 ns）');
  }
  async function trTranslate(addr, tok) {
    const o = tr.o, ps = 1 << tr.n, p = addr >> tr.n, d = addr & (ps - 1);
    tr.addr = addr;
    o.fr.forEach((m) => glow(m, null)); o.pt.forEach((m) => glow(m, null)); o.tlb.forEach((m) => glow(m, null));
    trBits(addr, null, null);
    if (o.pkt) kill(o.pkt);
    o.lb.forEach((m, i) => glow(m, i < TR_M - tr.n ? '#0b2a4a' : GOLD));
    log('logical ' + addr + ' = ' + bin(addr, TR_M) + ' → p = ' + p + '，d = ' + d);
    await wait(tok, 700);
    o.lb.forEach((m) => glow(m, null));
    const pkt = o.pkt = cube('p = ' + p, BLUE, [1.1, 0.4, 0.5], -4.0, 5.3, 0.6);
    let f = null, ns = 0;
    if (tr.useTlb) {
      move(pkt, -4.6, 4.6, 0.7); ns += 20;
      o.tlb.forEach((m) => glow(m, '#3a3000'));
      await wait(tok, 650);
      o.tlb.forEach((m) => glow(m, null));
      const hi = tr.tlb.findIndex((e) => e.p === p);
      if (hi >= 0) {
        f = tr.tlb[hi].f; glow(o.tlb[hi], OKG);
        const e = tr.tlb.splice(hi, 1)[0]; tr.tlb.unshift(e);
        tr.st.hit++;
        log('TLB hit：page ' + p + ' → frame ' + f + '（只碰 memory 一次）');
        await wait(tok, 500); trTlbDraw(); glow(o.tlb[0], OKG);
      } else { tr.st.miss++; log('TLB miss：要去 memory 讀 page table'); }
    }
    if (f === null) {
      move(pkt, -1.0, trY(p), 0.7); ns += 100;
      await wait(tok, 550);
      if (!tr.valid[p]) {
        glow(o.pt[p], BADR); tint(pkt, RED); relabel(pkt, 'trap');
        tr.st.trap++; tr.st.acc++; tr.st.ns += ns;
        log('page ' + p + ' 的 valid-invalid bit 是 invalid：不屬於這個 process → trap 給 OS（addressing error）', true);
        trState('<span class="no">page ' + p + ' invalid → trap</span>');
        return;
      }
      f = tr.pt[p]; glow(o.pt[p], OKG);
      log('讀 page table[' + p + '] = frame ' + f + '（第 1 次 memory access）');
      if (tr.useTlb) {
        tr.tlb.unshift({ p, f });
        if (tr.tlb.length > 3) { const ev = tr.tlb.pop(); log('TLB 滿了：踢掉最久沒用的 p ' + ev.p); }
        await wait(tok, 400); trTlbDraw(); glow(o.tlb[0], '#3a3000');
      }
    }
    relabel(pkt, 'f = ' + f); tint(pkt, GREEN);
    trBits(addr, f, d);
    o.pb.forEach((m) => glow(m, GOLD));
    await wait(tok, 600);
    o.pb.forEach((m) => glow(m, null));
    move(pkt, 5.3, trY(f) + 0.45, 0.7); ns += 100;
    glow(o.fr[f], OKG);
    const phys = f * ps + d;
    log('physical = ' + f + ' × ' + ps + ' + ' + d + ' = ' + phys + '（讀資料：再 1 次 memory access）；本次 ' + ns + ' ns');
    tr.st.acc++; tr.st.ns += ns;
    trState('<span class="ok">' + addr + ' → ' + phys + '</span>（' + bin(f, 3) + ' ' + bin(d, tr.n) + '），本次 ' + ns + ' ns');
  }
  function enterTranslate() {
    fresh([0, 4.2, 15.5], [0, 3.6, 0]);
    if (!tr.pt.length || tr.pt.length !== 1 << (TR_M - tr.n)) trNewTable();
    controls('<label>page size <select id="tPs"><option value="2">4 bytes</option><option value="3">8 bytes</option></select></label>'
      + '<label>logical address <input id="tA" type="number" min="0" max="31" value="' + tr.addr + '" style="width:60px"></label>'
      + '<button class="primary" id="tGo">翻譯</button><button id="tRnd">隨機位址</button>'
      + '<label><input type="checkbox" id="tTlb"' + (tr.useTlb ? ' checked' : '') + '> TLB</label><button id="tNew">新的 page table</button>');
    $('tPs').value = String(tr.n);
    $('tPs').onchange = (e) => { tr.n = Number(e.target.value); trNewTable(); tr.st = { acc: 0, hit: 0, miss: 0, ns: 0, trap: 0 }; tr.addr = Math.min(tr.addr, 31); enterTranslate(); };
    $('tTlb').onchange = (e) => { tr.useTlb = e.target.checked; tr.tlb = []; trTlbDraw(); trState(); log(tr.useTlb ? '開啟 TLB：先查 TLB，hit 只要一次 memory access。' : '關閉 TLB：每次都要先讀 page table，兩次 memory access。'); };
    const go = (a) => {
      if (!Number.isInteger(a) || a < 0 || a > 31) { log('logical address 要是 0–31（5 bits）的整數。', true); return; }
      $('tA').value = a; runOp(() => trTranslate(a));
    };
    on('tGo', () => go(Number($('tA').value)));
    on('tRnd', () => go(rnd(32)));
    on('tNew', () => { trNewTable(); tr.st = { acc: 0, hit: 0, miss: 0, ns: 0, trap: 0 }; trDraw(); log('換了一張新的 page table（TLB 也清空）。'); });
    trDraw();
    log('輸入 0–31 的 logical address：高位元是 page number p、低位元是 offset d。');
    log('灰色 invalid 的 page 不屬於這個 process，存取會 trap。多按幾次同一個 page，看 TLB 怎麼變 hit。');
  }

  // ═════════════════════════ Mode 2：連續配置 first / best / worst fit ═════════════════════════
  const fit = { alg: 'first', segs: [], meshes: new Map(), holes: [], nextPid: 1 };
  const FIT_TOTAL = 1000, FIT_S = 0.012;
  const fx = (k) => -6 + k * FIT_S;
  function fitReset(preset) {
    fit.meshes.forEach((m) => kill(m)); fit.meshes = new Map(); fit.nextPid = 1;
    fit.segs = [{ start: 0, size: 100, pid: 'OS' }];
    if (preset) {
      const lay = [[100, 'P'], [150, null], [80, 'P'], [220, null], [60, 'P'], [120, null], [100, 'P'], [70, null]];
      let s = 100; lay.forEach(([sz, w]) => { fit.segs.push({ start: s, size: sz, pid: w ? 'P' + fit.nextPid++ : null }); s += sz; });
      if (s < FIT_TOTAL) fit.segs.push({ start: s, size: FIT_TOTAL - s, pid: 'P' + fit.nextPid++ });
    } else fit.segs.push({ start: 100, size: 900, pid: null });
  }
  function fitHoles() { return fit.segs.filter((s) => s.pid === null); }
  function fitChoose(holes, size, alg) {
    const ok = holes.filter((h) => h.size >= size);
    if (!ok.length) return null;
    if (alg === 'first') return ok[0];
    if (alg === 'best') return ok.reduce((a, b) => (b.size < a.size ? b : a));
    return ok.reduce((a, b) => (b.size > a.size ? b : a));
  }
  function fitRender(dropPid) {
    fit.holes.forEach(kill); fit.holes = [];
    for (const s of fit.segs) {
      const x = fx(s.start + s.size / 2), w = s.size * FIT_S;
      if (s.pid === null) {
        const h = cube('', '#f6efe2', [Math.max(0.02, w - 0.04), 0.12, 1.2], x, 0.06); fit.holes.push(h);
        if (w > 0.5) fit.holes.push(tag(s.size + 'K', 'idx', x, -0.1, 1.0));
        continue;
      }
      let m = fit.meshes.get(s.pid);
      if (!m) {
        m = cube(s.pid === 'OS' ? 'OS' : s.pid, s.pid === 'OS' ? DARK : [BLUE, PURPLE, ORANGE, TEAL, PINK, GREEN][(Number(s.pid.slice(1)) || 0) % 6], [Math.max(0.03, w - 0.05), 0.7, 1.2], x, 0.35, 0, s.pid === dropPid ? 3 : 0);
        m.userData.sz = tag(s.size + 'K', 'idx', 0, 0.55, 0); m.add(m.userData.sz);
        fit.meshes.set(s.pid, m);
      } else move(m, x, 0.35, 0);
    }
    for (const [pid, m] of fit.meshes) if (!fit.segs.some((s) => s.pid === pid)) { fly(m); fit.meshes.delete(pid); }
    fitState();
  }
  function fitState(extra) {
    const hs = fitHoles(), free = hs.reduce((a, h) => a + h.size, 0), big = hs.reduce((a, h) => Math.max(a, h.size), 0);
    setState('連續配置：' + { first: 'First-fit', best: 'Best-fit', worst: 'Worst-fit' }[fit.alg], [['hole', hs.map((h) => h.size + 'K').join('、') || '無'], ['free 總和', free + 'K'], ['最大 hole', big + 'K'], ['hole 數', String(hs.length)]],
      (extra ? extra + '<br>' : '') + 'external fragmentation：總和夠，但沒有一塊連續的夠大');
    const sel = $('fFree');
    if (sel) sel.innerHTML = fit.segs.filter((s) => s.pid && s.pid !== 'OS').map((s) => '<option>' + s.pid + '</option>').join('');
  }
  function fitAlloc(size) {
    const hs = fitHoles(), h = fitChoose(hs, size, fit.alg);
    const free = hs.reduce((a, x) => a + x.size, 0);
    if (!h) {
      log(size + 'K 放不下：' + (free >= size ? 'free 總和 ' + free + 'K 夠，但沒有一個 hole 夠大 → external fragmentation，可以試試「緊縮」。' : 'free 總和只有 ' + free + 'K，真的不夠。'), true);
      fitState('<span class="no">' + size + 'K 放不下</span>'); return;
    }
    const pid = 'P' + fit.nextPid++;
    const i = fit.segs.indexOf(h);
    const rest = { start: h.start + size, size: h.size - size, pid: null };
    fit.segs.splice(i, 1, { start: h.start, size, pid }, ...(rest.size > 0 ? [rest] : []));
    log({ first: 'First-fit：從頭找第一個夠大的', best: 'Best-fit：找夠大的裡面最小的', worst: 'Worst-fit：找最大的' }[fit.alg] + ' → ' + h.size + 'K 的 hole，' + pid + '（' + size + 'K）放進去，剩 ' + rest.size + 'K');
    fitRender(pid);
  }
  function fitMerge() {
    const out = [];
    for (const s of fit.segs) { const last = out[out.length - 1]; if (last && last.pid === null && s.pid === null) last.size += s.size; else out.push({ ...s }); }
    fit.segs = out;
  }
  function enterFit() {
    fresh([0, 6.5, 11.5], [0, 0.4, 0]);
    fit.meshes = new Map(); fit.holes = [];
    controls('<select id="fAlg"><option value="first">First-fit</option><option value="best">Best-fit</option><option value="worst">Worst-fit</option></select>'
      + '<label>大小 <input id="fSz" type="number" min="10" max="900" value="120" style="width:64px">K</label><button class="primary" id="fAdd">配置</button>'
      + '<select id="fFree"></select><button id="fDel">釋放</button><button id="fCmp">緊縮 compaction</button><button id="fPre">有洞的情境</button><button id="fRst">清空</button>');
    $('fAlg').value = fit.alg;
    $('fAlg').onchange = (e) => { fit.alg = e.target.value; fitState(); log('改用 ' + e.target.selectedOptions[0].text); };
    on('fAdd', () => { const v = Math.round(Number($('fSz').value)); if (!(v >= 10 && v <= 900)) { log('大小請填 10–900（K）。', true); return; } fitAlloc(v); });
    on('fDel', () => {
      const pid = $('fFree').value; const s = fit.segs.find((x) => x.pid === pid);
      if (!s) { log('沒有可以釋放的 process（OS 不能釋放）。', true); return; }
      s.pid = null; fitMerge(); log(pid + ' 結束，空間還回來；相鄰的 hole 會合併。'); fitRender();
    });
    on('fCmp', () => {
      let s = 0; const procs = fit.segs.filter((x) => x.pid !== null);
      fit.segs = procs.map((x) => { const r = { ...x, start: s }; s += x.size; return r; });
      if (s < FIT_TOTAL) fit.segs.push({ start: s, size: FIT_TOTAL - s, pid: null });
      log('Compaction：把 process 往低位址搬，所有 hole 合成一塊（需要 execution-time binding，搬完改 relocation register）。');
      fitRender();
    });
    on('fPre', () => { fitReset(true); fitRender(); log('目前有 4 個零散的 hole（150K、220K、120K、70K）：試試配置 300K。'); });
    on('fRst', () => { fitReset(false); fitRender(); log('清空：OS 之外整塊都是 hole。'); });
    tag('0', 'idx', -6, -0.15, 0.9); tag('1000K', 'idx', 6, -0.15, 0.9);
    fitReset(true); fitRender();
    log('選一種演算法、輸入大小按「配置」。放不下時看看 free 總和是不是其實夠。');
  }

  // ═════════════════════════ Mode 3：EMAT 計算 ═════════════════════════
  const em = { t: 20, m: 100, h: 70, L: 1, bars: [] };
  function emCalc(t, m, h, L) { const hit = t + m, miss = t + (L + 1) * m; return { hit, miss, eat: h / 100 * hit + (1 - h / 100) * miss, none: (L + 1) * m }; }
  function enterEmat() {
    fresh([0, 4.6, 14], [0, 3.0, 0]);
    controls('<label>TLB <input id="eT" type="range" min="0" max="50" value="' + em.t + '"> <b id="eTv"></b> ns</label>'
      + '<label>memory <input id="eM" type="range" min="20" max="200" step="10" value="' + em.m + '"> <b id="eMv"></b> ns</label>'
      + '<label>hit rate <input id="eH" type="range" min="0" max="100" value="' + em.h + '"> <b id="eHv"></b>%</label>'
      + '<label>page table 層數 <select id="eL"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>'
      + '<button id="eLec">回到上課例子</button>');
    $('eL').value = String(em.L);
    const read = () => { em.t = Number($('eT').value); em.m = Number($('eM').value); em.h = Number($('eH').value); em.L = Number($('eL').value); emUpdate(); };
    ['eT', 'eM', 'eH'].forEach((id) => { $(id).oninput = read; }); $('eL').onchange = read;
    on('eLec', () => { $('eT').value = 20; $('eM').value = 100; $('eH').value = 70; $('eL').value = 1; read(); log('上課例子：TLB 20 ns、memory 100 ns、hit 70% → 150 ns。'); });
    em.bars = [];
    const names = ['TLB hit', 'TLB miss', 'EMAT', '沒有 TLB'];
    names.forEach((n, i) => {
      const x = -4.5 + i * 3;
      tag(n, 'ptr', x, -0.1, 1.2);
      const a = cube('', ORANGE, [1.4, 1, 1.2], x, 0.5), b = cube('', BLUE, [1.4, 1, 1.2], x, 0.5);
      const v = tag('', 'ptr alt', x, 1, 0);
      em.bars.push({ x, a, b, v });
    });
    log('橘色 = 查 TLB 的時間，藍色 = memory access。miss 時要先讀 page table（L 層就讀 L 次）再讀資料。');
    emUpdate();
  }
  function emUpdate() {
    const r = emCalc(em.t, em.m, em.h, em.L), S = 5.6 / Math.max(r.miss, r.none, 1);
    $('eTv').textContent = em.t; $('eMv').textContent = em.m; $('eHv').textContent = em.h;
    const set = (bar, tlbPart, memPart, label) => {
      const ha = Math.max(0.001, tlbPart * S), hb = Math.max(0.001, memPart * S);
      bar.a.scale.y = ha; bar.a.position.y = ha / 2; bar.b.scale.y = hb; bar.b.position.y = ha + hb / 2;
      bar.v.position.y = ha + hb + 0.4; txt(bar.v, label);
    };
    const tlbShare = em.t, memE = r.eat - em.t;
    set(em.bars[0], em.t, em.m, r.hit + ' ns');
    set(em.bars[1], em.t, (em.L + 1) * em.m, r.miss + ' ns');
    set(em.bars[2], tlbShare, memE, (+r.eat.toFixed(1)) + ' ns');
    set(em.bars[3], 0, r.none, r.none + ' ns');
    tint(em.bars[2].b, GREEN);
    setState('EMAT（effective memory access time）', [['TLB / memory', em.t + ' / ' + em.m + ' ns'], ['hit rate', em.h + '%'], ['hit', em.t + ' + ' + em.m + ' = ' + r.hit], ['miss', em.t + ' + ' + (em.L + 1) + '×' + em.m + ' = ' + r.miss]],
      'EMAT = ' + (em.h / 100) + ' × ' + r.hit + ' + ' + (+(1 - em.h / 100).toFixed(2)) + ' × ' + r.miss + ' = <span class="ok">' + (+r.eat.toFixed(2)) + ' ns</span>'
      + '<br>比沒有 TLB 的 ' + r.none + ' ns ' + (r.eat < r.none ? '快 ' + (+(r.none / r.eat).toFixed(2)) + ' 倍' : '<span class="no">還慢</span>（hit rate 太低）'));
  }

  // ═════════════════════════ Mode 4：Segmentation ═════════════════════════
  const SEG = [
    { name: 'subroutine', limit: 1000, base: 1400, c: BLUE },
    { name: 'sqrt', limit: 400, base: 6300, c: PURPLE },
    { name: 'main program', limit: 400, base: 4300, c: ORANGE },
    { name: 'stack', limit: 1100, base: 3200, c: TEAL },
    { name: 'symbol table', limit: 1000, base: 4700, c: PINK },
  ];
  const segY = (a) => 6.6 - (a - 1000) / 6000 * 6.2;
  function segDraw() {
    const o = {};
    tag('segment table', 'ptr', -1.4, 6.6);
    tag('limit', 'idx', -2.0, 6.1); tag('base', 'idx', -0.6, 6.1);
    o.rows = SEG.map((s, i) => {
      const y = 5.5 - i * 0.62;
      tag(String(i), 'idx', -2.9, y);
      return { l: cube(s.limit, '#f6efe2', [1.2, 0.45, 0.8], -2.0, y), b: cube(s.base, '#f6efe2', [1.2, 0.45, 0.8], -0.6, y) };
    });
    tag('physical memory', 'ptr', 4.0, 6.95);
    ghost('#b9a988', 2.6, 6.2, 1.0, 4.0, 3.5, 0, 0.12);
    o.segs = SEG.map((s, i) => {
      const y0 = segY(s.base), y1 = segY(s.base + s.limit);
      const m = cube('seg ' + i, s.c, [2.4, y0 - y1 - 0.04, 0.9], 4.0, (y0 + y1) / 2);
      tag(String(s.base), 'idx', 5.75, y0); return m;
    });
    tag('6700', 'idx', 5.75, segY(6700));
    o.names = SEG.map((s, i) => tag(i + '：' + s.name, 'idx', -5.4, 5.5 - i * 0.62));
    tag('user view', 'ptr', -5.4, 6.6);
    return o;
  }
  async function segTranslate(o, s, d, tok, speak) {
    const S = SEG[s], row = o.rows[s];
    o.rows.forEach((r) => { glow(r.l, null); glow(r.b, null); }); o.segs.forEach((m) => glow(m, null));
    if (o.pkt) kill(o.pkt);
    const pkt = o.pkt = cube('(' + s + ', ' + d + ')', S.c, [1.4, 0.45, 0.6], -5.4, 1.2, 0.6);
    if (speak) say('logical address = (segment ' + s + ', offset ' + d + ')', '先用 s 查 segment table');
    await wait(tok, 1100);
    move(pkt, -1.3, 5.5 - s * 0.62 + 0.5, 0.6); glow(row.l, GOLD); glow(row.b, GOLD);
    await wait(tok, 1100);
    if (d >= S.limit) {
      tint(pkt, RED); relabel(pkt, 'trap'); glow(row.l, BADR);
      if (speak) say('offset ' + d + ' ≥ limit ' + S.limit + ' → trap', 'addressing error：超出 segment 範圍');
      log('(' + s + ', ' + d + ')：' + d + ' ≥ limit ' + S.limit + ' → trap 給 OS', true);
      return null;
    }
    const pa = S.base + d;
    if (speak) say('offset ' + d + ' < limit ' + S.limit + '：合法', 'physical = base + d = ' + S.base + ' + ' + d + ' = ' + pa);
    await wait(tok, 1300);
    relabel(pkt, String(pa)); tint(pkt, GREEN);
    move(pkt, 4.0, segY(pa), 0.9); glow(o.segs[s], OKG);
    log('(' + s + ', ' + d + ')：' + d + ' < ' + S.limit + ' → ' + S.base + ' + ' + d + ' = ' + pa);
    return pa;
  }
  function enterSeg() {
    fresh([0, 4.2, 14.5], [0, 3.4, 0]);
    const o = segDraw();
    controls('<label>s <input id="sS" type="number" min="0" max="4" value="2" style="width:50px"></label><label>d <input id="sD" type="number" min="0" max="2000" value="53" style="width:70px"></label>'
      + '<button class="primary" id="sGo">翻譯</button><button id="sRnd">隨機</button>');
    const go = (s, d) => {
      if (!(Number.isInteger(s) && s >= 0 && s <= 4)) { log('segment 編號只有 0–4。', true); return; }
      if (!(Number.isInteger(d) && d >= 0)) { log('offset 要是非負整數。', true); return; }
      runOp(async () => { const pa = await segTranslate(o, s, d); setState('Segmentation', [['(s, d)', '(' + s + ', ' + d + ')'], ['limit', String(SEG[s].limit)], ['base', String(SEG[s].base)], ['結果', pa === null ? 'trap' : String(pa)]], pa === null ? '<span class="no">d ≥ limit → trap</span>' : '<span class="ok">' + SEG[s].base + ' + ' + d + ' = ' + pa + '</span>'); });
    };
    on('sGo', () => go(Number($('sS').value), Number($('sD').value)));
    on('sRnd', () => { const s = rnd(5), d = rnd(1300); $('sS').value = s; $('sD').value = d; go(s, d); });
    setState('Segmentation', [['segment 數', '5'], ['檢查', 'd < limit？']], 'physical = base[s] + d；d ≥ limit → trap');
    log('Segment table 是恐龍書的圖例。試 (2, 53)、(3, 852)、(0, 1222)。');
  }

  // ═════════════════════════ Mode 5：Page table 大小與多層分頁 ═════════════════════════
  const ps = { A: 32, P: 12, E: 4, objs: [] };
  function psCalc(A, P, E) {
    const pb = A - P, entries = Math.pow(2, pb), single = entries * E, per = P - Math.log2(E);
    const levels = Math.max(1, Math.ceil(pb / per));
    const split = []; let left = pb;
    for (let i = 0; i < levels; i++) { const b = i === 0 ? pb - per * (levels - 1) : per; split.push(b); left -= b; }
    return { pb, entries, single, per, levels, split };
  }
  function enterPtSize() {
    fresh([0, 4, 13.5], [0, 2.6, 0]);
    controls('<label>位址 <select id="pA"><option>16</option><option>32</option><option>36</option><option>48</option><option>64</option></select> bits</label>'
      + '<label>page <select id="pP"><option value="10">1 KB</option><option value="11">2 KB</option><option value="12">4 KB</option><option value="13">8 KB</option><option value="14">16 KB</option><option value="16">64 KB</option></select></label>'
      + '<label>entry <select id="pE"><option>4</option><option>8</option></select> bytes</label>');
    $('pA').value = String(ps.A); $('pP').value = String(ps.P); $('pE').value = String(ps.E);
    const read = () => { ps.A = Number($('pA').value); ps.P = Number($('pP').value); ps.E = Number($('pE').value); psUpdate(); };
    ['pA', 'pP', 'pE'].forEach((id) => { $(id).onchange = read; });
    log('一張 page table 本身也要放進 page 裡：每個 page 能放 page size ÷ entry size 個 entry，不夠就再分一層。');
    psUpdate();
  }
  function psUpdate() {
    ps.objs.forEach(kill); ps.objs = [];
    const r = psCalc(ps.A, ps.P, ps.E), W = 12, S = W / ps.A;
    if (r.pb <= 0) { log('page 比整個位址空間還大：page number 沒有 bits 了，換小一點的 page。', true); setState('Page table 大小', [['offset', ps.P + ' bits'], ['page number', '0 bits']], '<span class="no">不合理的組合</span>'); return; }
    let x = -6;
    const cols = [PURPLE, BLUE, TEAL, PINK, GREEN, '#c08a1f', '#5c7a4a'];
    r.split.forEach((b, i) => {
      const w = b * S; ps.objs.push(cube(b, cols[i % cols.length], [w - 0.05, 0.8, 1.2], x + w / 2, 4.2));
      ps.objs.push(tag(r.levels === 1 ? 'p' : 'p' + (i + 1), 'idx', x + w / 2, 3.4)); x += w;
    });
    const w = ps.P * S; ps.objs.push(cube(ps.P, ORANGE, [w - 0.05, 0.8, 1.2], x + w / 2, 4.2)); ps.objs.push(tag('d', 'idx', x + w / 2, 3.4));
    ps.objs.push(tag(ps.A + '-bit logical address', 'ptr', 0, 5.3));
    // single-level table vs one page, log scale heights
    const hT = Math.min(3, 0.3 + Math.log2(r.single / pow2(ps.P) + 1) * 0.12), hP = 0.3;
    ps.objs.push(cube('', DARK, [1.4, hT, 1.4], -2.2, hT / 2)); ps.objs.push(tag('單層 table ' + fmtB(r.single), 'ptr alt', -2.2, hT + 0.5));
    ps.objs.push(cube('', SAND, [1.4, hP, 1.4], 2.2, hP / 2)); ps.objs.push(tag('一個 page ' + fmtB(pow2(ps.P)), 'ptr', 2.2, hP + 0.5));
    setState('Page table 大小', [['offset d', ps.P + ' bits'], ['page number', r.pb + ' bits'], ['單層 entry 數', '2^' + r.pb], ['單層 table', fmtB(r.single)], ['每頁可放', '2^' + r.per + ' 個 entry'], ['需要層數', String(r.levels)]],
      'bits 切法：' + r.split.join(' | ') + ' | ' + ps.P + '<br>沒有 TLB 時一次存取 = ' + (r.levels + 1) + ' 次 memory access');
  }

  // ═════════════════════════ 小測驗 ═════════════════════════
  let qs = { score: 0, total: 0 };
  function genQ() {
    const k = rnd(9);
    if (k === 0) {
      const n = pick([8, 9, 10, 11, 12]), psz = 1 << n, pages = 8, pt = [...Array(16).keys()].sort(() => Math.random() - 0.5).slice(0, pages);
      const p = rnd(pages), d = rnd(psz), la = p * psz + d, pa = pt[p] * psz + d;
      return { q: 'page size = ' + psz + ' bytes，page table = [' + pt.join(', ') + ']（index 0 起）。logical address ' + la + ' 的 physical address 是？', opts: [String(pa), String(pt[p] + d), String(p * psz + pt[p]), String(pt[p] * psz + d + psz)], ans: String(pa), why: 'p = ⌊' + la + ' / ' + psz + '⌋ = ' + p + '，d = ' + d + '；frame = ' + pt[p] + ' → ' + pt[p] + ' × ' + psz + ' + ' + d + ' = ' + pa + '。' };
    }
    if (k === 1) {
      const m = pick([16, 20, 24, 32]), n = pick([9, 10, 11, 12, 13]);
      return { q: m + '-bit logical address、page size ' + fmtB(pow2(n)) + '：page number 和 offset 各幾 bits？', opts: [(m - n) + ' / ' + n, n + ' / ' + (m - n), (m - n + 1) + ' / ' + (n - 1), m + ' / ' + n], ans: (m - n) + ' / ' + n, why: 'page size 2^' + n + ' → offset ' + n + ' bits，剩下 ' + m + ' − ' + n + ' = ' + (m - n) + ' bits 是 page number。' };
    }
    if (k === 2) {
      const A = pick([32, 32, 36]), P = pick([12, 13, 14]), E = pick([4, 8]), size = Math.pow(2, A - P) * E;
      return { q: A + '-bit 位址、page ' + fmtB(pow2(P)) + '、每個 entry ' + E + ' bytes，單層 page table 多大？', opts: [fmtB(size), fmtB(size / E), fmtB(size * 2), fmtB(Math.pow(2, A - P))], ans: fmtB(size), why: '2^' + (A - P) + ' 個 entry × ' + E + ' bytes = ' + fmtB(size) + '。' };
    }
    if (k === 3) {
      const t = pick([10, 20, 25]), m = pick([50, 100, 200]), h = pick([70, 80, 90, 95, 98]);
      const r = emCalc(t, m, h, 1), f = (v) => (+v.toFixed(2)) + ' ns';
      const wrong = h / 100 * m + (1 - h / 100) * 2 * m;
      return { q: 'TLB ' + t + ' ns、memory ' + m + ' ns、hit rate ' + h + '%（單層 page table），EMAT = ?', opts: [f(r.eat), f(wrong), f(h / 100 * (t + m) + (1 - h / 100) * (t + m)), f(r.eat + m)].filter((v, i, a) => a.indexOf(v) === i), ans: f(r.eat), why: 'hit：' + t + ' + ' + m + ' = ' + r.hit + '；miss：' + t + ' + 2×' + m + ' = ' + r.miss + '；' + h / 100 + '×' + r.hit + ' + ' + (+(1 - h / 100).toFixed(2)) + '×' + r.miss + ' = ' + f(r.eat) + '。' };
    }
    if (k === 4) {
      const holes = [...Array(5)].map(() => 50 + rnd(12) * 50), size = 100 + rnd(6) * 25, alg = pick(['first', 'best', 'worst']);
      if (!holes.some((h) => h >= size)) holes[rnd(5)] = size + 50;
      const hs = holes.map((s, i) => ({ size: s, i }));
      const ch = fitChoose(hs, size, alg);
      const ans = '第 ' + (ch.i + 1) + ' 個（' + ch.size + 'K）';
      const others = hs.filter((h) => h !== ch).map((h) => '第 ' + (h.i + 1) + ' 個（' + h.size + 'K）').sort(() => Math.random() - 0.5);
      const opts = [ans, ...others.slice(0, 2), '放不下'];
      return { q: 'hole 依位址順序是 ' + holes.map((h) => h + 'K').join('、') + '。用 ' + { first: 'First-fit', best: 'Best-fit', worst: 'Worst-fit' }[alg] + ' 配置 ' + size + 'K，會放進哪個？', opts, ans, why: { first: 'First-fit：從頭找第一個 ≥ ' + size + 'K 的。', best: 'Best-fit：所有夠大的 hole 裡挑最小的（剩下的碎片最小）。', worst: 'Worst-fit：挑最大的 hole（剩下的還夠大能再用）。' }[alg] };
    }
    if (k === 5) {
      const P = pick([1024, 2048, 4096]), sz = P * (5 + rnd(30)) + 1 + rnd(P - 1), pages = Math.ceil(sz / P), frag = pages * P - sz;
      return { q: 'page size ' + P + ' bytes，process 大小 ' + sz.toLocaleString() + ' bytes。需要幾個 frame？internal fragmentation 幾 bytes？', opts: [pages + ' 個；' + frag, (pages - 1) + ' 個；' + (sz - (pages - 1) * P), pages + ' 個；' + (sz - (pages - 1) * P), (pages + 1) + ' 個；' + (frag + P)], ans: pages + ' 個；' + frag, why: sz + ' = ' + (pages - 1) + ' × ' + P + ' + ' + (sz - (pages - 1) * P) + ' → 要 ' + pages + ' 個 frame，最後一個浪費 ' + P + ' − ' + (sz - (pages - 1) * P) + ' = ' + frag + ' bytes。' };
    }
    if (k === 6) {
      const s = rnd(5), S = SEG[s], over = Math.random() < 0.4, d = over ? S.limit + rnd(300) : rnd(S.limit);
      const ans = over ? 'trap（addressing error）' : String(S.base + d);
      return { q: 'segment table（limit, base）：' + SEG.map((x, i) => i + ':(' + x.limit + ',' + x.base + ')').join(' ') + '。logical (' + s + ', ' + d + ') 對到？', opts: [...new Set([ans, String(S.base + d), 'trap（addressing error）', String(S.limit + d), String(S.base + S.limit)])].slice(0, 4), ans, why: over ? d + ' ≥ limit ' + S.limit + ' → trap。' : d + ' < ' + S.limit + ' → base ' + S.base + ' + ' + d + ' = ' + (S.base + d) + '。' };
    }
    if (k === 7) {
      const items = [
        ['Paging 會產生哪種 fragmentation？', 'internal（最後一個 page 沒用完）'],
        ['Variable-partition 連續配置會產生哪種 fragmentation？', 'external（hole 太零散）'],
        ['Segmentation 會產生哪種 fragmentation？', 'external（hole 太零散）'],
        ['Fixed-size block（多給 2 bytes 不追蹤）產生的是哪種 fragmentation？', 'internal（最後一個 page 沒用完）'],
      ];
      const [q, a] = pick(items);
      return { q, opts: ['internal（最後一個 page 沒用完）', 'external（hole 太零散）', '兩種都沒有', '兩種都有'], ans: a, why: 'internal = 配給你的區塊裡沒用到的部分；external = 區塊之間的 hole 加起來夠但不連續。Paging 沒有 external，但最後一頁平均浪費半頁。' };
    }
    const items = [
      { q: '沒有 TLB 時，用二層 page table 讀一個資料要存取 memory 幾次？', opts: ['3 次', '2 次', '1 次', '4 次'], ans: '3 次', why: '外層 table 1 次 + 內層 table 1 次 + 資料 1 次。' },
      { q: 'Context switch 時，跟 paging 有關要做什麼？', opts: ['重新載入 PTBR，並 flush TLB（或用 PID 區分）', '把整張 page table 複製到 TLB', '重新配置所有 frame', '什麼都不用做'], ans: '重新載入 PTBR，並 flush TLB（或用 PID 區分）', why: '每個 process 有自己的 page table；TLB 裡舊 process 的 (p, f) 不能給新 process 用。' },
      { q: 'Inverted page table 的特點是？', opts: ['整個系統一張，每個 frame 一個 entry', '每個 process 一張，每個 page 一個 entry', '只放在 TLB 裡', '用 base + limit 取代'], ans: '整個系統一張，每個 frame 一個 entry', why: 'entry 存 (pid, page)，省記憶體但查詢要搜尋（常配合 hash），也不好做 shared memory。' },
      { q: 'Compaction 的前提是？', opts: ['execution-time binding（可以在執行中搬移）', 'compile-time binding', '使用 paging', '沒有 OS'], ans: 'execution-time binding（可以在執行中搬移）', why: '搬完只要改 relocation register；compile / load time binding 的位址已經寫死。' },
      { q: 'base = 300040、limit = 120900，下列哪個位址會 trap？', opts: ['420940', '300040', '420939', '350000'], ans: '420940', why: '合法範圍是 base ≤ a < base + limit = 420940，等於上界也不行。' },
    ];
    return pick(items);
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts)].sort(() => Math.random() - 0.5);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 場景（課本）：位址綁定、base / limit、relocation ═════════════════════════
  async function scBinding(tok) {
    fresh([0, 5, 14], [0, 2.6, 0]);
    const st = [[-4.6, 'source program'], [0, 'object module'], [4.6, 'memory 中的 binary']];
    st.forEach(([x, n]) => { ctx.tile(V3(x, 0.04, 0), 3.4, 2.2); tag(n, 'ptr', x, 0.1, 1.5); });
    tag('compiler', 'idx', -2.3, 1.5); tag('linker / loader', 'idx', 2.3, 1.5);
    line(-2.8, 1.1, -1.8, 1.1); line(1.8, 1.1, 2.8, 1.1);
    const c = cube('count', BLUE, [2.6, 0.6, 1], -4.6, 0.4, 0, 3);
    say('程式裡的位址一開始是符號', 'symbolic address：變數 count');
    await beat(tok, 2400);
    move(c, 0, 0.4); relabel(c, '模組開頭 + 14');
    say('compiler 把它變成可重定位位址', 'relocatable：離模組開頭 14 bytes');
    await beat(tok, 2600);
    move(c, 4.6, 0.4); relabel(c, '74014');
    say('載入 memory 時才變成絕對位址', 'absolute：模組從 74000 開始 → 74014');
    await beat(tok, 2600);
    const rows = [['compile time', '起點寫死在程式裡', '起點改了就要重新 compile'], ['load time', '產生 relocatable code', '起點改了就重新 load'], ['execution time', '執行中還能搬家', '要有 MMU 硬體幫忙']];
    const ms = [];
    for (let i = 0; i < 3; i++) {
      const y = 5.6 - i * 1.0;
      ms.push(cube(rows[i][0], [PURPLE, TEAL, ORANGE][i], [2.6, 0.6, 0.8], -3.6, y, 0, 2));
      tag(rows[i][1], 'idx', 0.4, y);
      say('Binding 時機：' + rows[i][0], rows[i][2]);
      await beat(tok, 2300);
    }
    glow(ms[2], GOLD);
    say('大多數 OS 用 execution-time binding', 'logical address ≠ physical address，由 MMU 轉換');
    await beat(tok, 3000);
  }
  async function scBaseLimit(tok) {
    fresh([0, 3.8, 14], [0, 3.4, 0]);
    const MAX = 1024000, Y = (a) => 6.6 - a / MAX * 6.3;
    [[0, 256000, 'OS', DARK], [256000, 300040, 'process', SAND], [300040, 420940, 'process', BLUE], [420940, 880000, 'process', SAND], [880000, 1024000, '', '#f6efe2']].forEach(([a, b, n, c]) => {
      const h = Y(a) - Y(b); cube(n, c, [2.4, h - 0.04, 1.1], 3.6, (Y(a) + Y(b)) / 2);
    });
    [0, 256000, 300040, 420940, 880000, 1024000].forEach((a) => tag(String(a), 'idx', 5.6, Y(a)));
    const base = cube('base 300040', ORANGE, [2.2, 0.55, 0.8], -2.6, 6.0), lim = cube('limit 120900', PURPLE, [2.2, 0.55, 0.8], 0.2, 6.0);
    const g1 = ghost('#c08a1f', 0.25, 2.0, 1.4, -2.6, 2.0, 0, 0.35), g2 = ghost('#9b7ef4', 0.25, 2.0, 1.4, 0.2, 2.0, 0, 0.35);
    tag('a ≥ base ?', 'idx', -2.6, 3.3); tag('a < base + limit ?', 'idx', 0.2, 3.3);
    cube('CPU', DARK, [1.4, 1.0, 1.0], -5.6, 0.5);
    say('每個 process 有一段合法範圍', 'base 300040 ~ base + limit = 420940');
    glow(base, GOLD); glow(lim, GOLD);
    await beat(tok, 2800);
    glow(base, null); glow(lim, null);
    const tests = [[350000, 0], [299000, 1], [420940, 2]];
    for (const [a, bad] of tests) {
      const m = cube(String(a), BLUE, [1.5, 0.5, 0.6], -5.6, 1.6, 0.5);
      say('CPU 發出位址 ' + a, '硬體每次都檢查，不經過 OS');
      await beat(tok, 1300);
      move(m, -2.6, 2.0, 0.5); await beat(tok, 900);
      if (bad === 1) {
        tint(m, RED); g1.material.color.set(RED);
        say(a + ' < base → trap', '交給 OS：addressing error'); await beat(tok, 2200);
        fly(m); g1.material.color.set('#c08a1f'); continue;
      }
      move(m, 0.2, 2.0, 0.5); await beat(tok, 900);
      if (bad === 2) {
        tint(m, RED); g2.material.color.set(RED);
        say(a + ' 不小於 420940 → trap', '上界是「<」：等於也不合法'); await beat(tok, 2400);
        fly(m); g2.material.color.set('#9b7ef4'); continue;
      }
      tint(m, GREEN); move(m, 3.6, Y(a), 0.7);
      say('兩關都過：去 memory 讀 ' + a, '300040 ≤ 350000 < 420940');
      await beat(tok, 2200);
    }
    say('base / limit 只能由 OS 在 kernel mode 載入', '特權指令：user 程式不能改');
    await beat(tok, 3000);
  }
  async function scRelocation(tok) {
    fresh([0, 4.4, 14], [0, 2.4, 0]);
    cube('CPU', DARK, [1.4, 1.0, 1.0], -5.6, 0.5);
    ghost(RED, 4.4, 2.6, 2.0, -0.6, 1.4, 0, 0.07); tag('MMU', 'ptr', -0.6, 3.0, 0);
    const lim = cube('limit 74600', PURPLE, [1.8, 0.5, 0.8], -1.9, 2.1), rel = cube('relocation 14000', ORANGE, [2.2, 0.5, 0.8], 0.8, 2.1);
    tag('<', 'idx', -1.9, 1.3); tag('+', 'idx', 0.8, 1.3);
    tag('memory', 'ptr', 4.8, 6.6);
    const Y = (a) => 6.2 - a / 90000 * 5.8;
    const proc = cube('process', BLUE, [2.0, 74600 / 90000 * 5.8 - 0.05, 0.9], 4.8, (Y(14000) + Y(88600)) / 2);
    const bl = tag('14000', 'idx', 6.3, Y(14000));
    say('CPU 只看得到 logical address', 'logical 0 ~ max，physical R ~ R + max');
    await beat(tok, 2600);
    async function send(a, R) {
      const m = cube(String(a), BLUE, [1.1, 0.45, 0.6], -5.6, 1.6, 0.7);
      say('logical address ' + a, '先跟 limit 比：' + a + ' < 74600 ?');
      await beat(tok, 1100); move(m, -1.9, 1.3, 0.8); glow(lim, GOLD); await beat(tok, 1100); glow(lim, null);
      if (a >= 74600) { tint(m, RED); say(a + ' ≥ limit → trap', 'addressing error'); await beat(tok, 2200); fly(m); return; }
      move(m, 0.8, 1.3, 0.8); glow(rel, GOLD); await beat(tok, 900); glow(rel, null);
      relabel(m, String(a + R)); tint(m, GREEN);
      say('加上 relocation register', a + ' + ' + R + ' = ' + (a + R));
      await beat(tok, 1200);
      move(m, 4.8, Y(a + R), 0.8);
      await beat(tok, 1700);
      fly(m);
    }
    await send(346, 14000);
    say('process 被搬到 20000（例如 compaction）', 'OS 只要改 relocation register');
    move(proc, 4.8, (Y(20000) + Y(94600)) / 2); txt(bl, '20000'); bl.position.y = Y(20000); relabel(rel, 'relocation 20000');
    await beat(tok, 2400);
    await send(346, 20000);
    await send(80000, 20000);
    say('程式不用改：同一個 346 對到新的位置', 'execution-time binding 靠 MMU');
    await beat(tok, 3000);
  }

  // ═════════════════════════ 場景（課本）：連續配置、fragmentation ═════════════════════════
  async function scFit(tok) {
    fresh([0, 8.6, 9.8], [0, 0, 0.4]);
    const HOLES = [100, 500, 200, 300, 600], PROCS = [212, 417, 112, 426], S = 0.0056, GAP = 0.32;
    const rows = [['first', 'First-fit', -2.4], ['best', 'Best-fit', 0], ['worst', 'Worst-fit', 2.4]];
    const R = rows.map(([alg, name, z]) => {
      tag(name, 'ptr', -6.2, 0.2, z);
      let x = -5.0; const hs = [];
      cube('', DARK, [GAP, 0.7, 1.2], x + GAP / 2, 0.35, z); x += GAP;
      HOLES.forEach((cap, i) => {
        const w = cap * S, free = cube('', '#f6efe2', [w - 0.04, 0.12, 1.2], x + w / 2, 0.06, z);
        const lb = tag(cap + 'K', 'idx', x + w / 2, -0.15, z + 0.75);
        hs.push({ i, x0: x, cap, used: 0, free, lb }); x += w;
        cube('', DARK, [GAP, 0.7, 1.2], x + GAP / 2, 0.35, z); x += GAP;
      });
      return { alg, name, z, hs };
    });
    say('5 個 hole：100K、500K、200K、300K、600K', '依序要放 212K、417K、112K、426K');
    await beat(tok, 3000);
    const cols = [BLUE, PURPLE, ORANGE, TEAL];
    for (const row of R) {
      const res = [];
      for (let k = 0; k < PROCS.length; k++) {
        const size = PROCS[k];
        const p = cube('P' + (k + 1), cols[k], [size * S, 0.6, 1.0], 0, 2.4, row.z);
        say(row.name + '：放 P' + (k + 1) + '（' + size + 'K）', { first: '從頭找第一個夠大的', best: '夠大的裡面挑最小的', worst: '挑最大的' }[row.alg]);
        const ok = row.hs.filter((h) => h.cap - h.used >= size);
        ok.forEach((h) => glow(h.free, '#3a3000'));
        await beat(tok, 1100);
        let ch = null;
        if (ok.length) ch = row.alg === 'first' ? ok[0] : ok.reduce((a, b) => (row.alg === 'best' ? (b.cap - b.used < a.cap - a.used ? b : a) : (b.cap - b.used > a.cap - a.used ? b : a)));
        ok.forEach((h) => glow(h.free, null));
        if (!ch) {
          tint(p, RED); move(p, 5.8, 1.6, row.z);
          tag('等待', 'ptr alt', 5.8, 2.3, row.z);
          say(size + 'K 沒有 hole 放得下', '只能等別人釋放');
          res.push('×'); await beat(tok, 1800); continue;
        }
        const x = ch.x0 + ch.used * S + size * S / 2;
        move(p, x, 0.35, row.z);
        ch.used += size;
        const left = ch.cap - ch.used, wl = Math.max(0.001, left * S - 0.04);
        ch.free.scale.x = wl / Math.max(0.001, ch.cap * S - 0.04); ch.free.position.x = ch.x0 + ch.used * S + left * S / 2;
        txt(ch.lb, '剩 ' + left + 'K'); ch.lb.position.x = ch.free.position.x;
        res.push(ch.cap + 'K');
        say('放進 ' + ch.cap + 'K 的 hole', '剩下 ' + left + 'K');
        await beat(tok, 1300);
      }
      log(row.name + '：' + PROCS.map((s, i) => s + 'K → ' + res[i]).join('，'));
    }
    say('這題 Best-fit 最好：四個都放得下', 'First / Worst fit 的 426K 要等');
    await beat(tok, 3200);
    say('模擬顯示：first 與 best 比 worst 好', 'first-fit 通常最快');
    await beat(tok, 2600);
  }
  async function scExtFrag(tok) {
    fresh([0, 6.5, 11], [0, 0.6, 0]);
    const S = 0.011, X = (k) => -5.5 + k * S;
    const segs = [[0, 200, 'OS', DARK], [200, 150, 'P1', BLUE], [350, 100, null], [450, 150, 'P2', PURPLE], [600, 100, null], [700, 150, 'P3', ORANGE], [850, 150, null]];
    const ms = {}, holes = [];
    segs.forEach(([s, sz, n, c]) => {
      if (n) ms[n] = cube(n, c, [sz * S - 0.05, 0.7, 1.2], X(s + sz / 2), 0.35);
      else { holes.push(cube('', '#f6efe2', [sz * S - 0.05, 0.12, 1.2], X(s + sz / 2), 0.06)); holes.push(tag(sz + 'K', 'idx', X(s + sz / 2), -0.1, 1.0)); }
    });
    tag('0', 'idx', -5.5, -0.15, 0.9); tag('1000K', 'idx', 5.5, -0.15, 0.9);
    say('process 進進出出，留下零散的 hole', 'hole：100K、100K、150K');
    await beat(tok, 2800);
    const p4 = cube('P4 300K', TEAL, [300 * S, 0.7, 1.2], 0, 2.8);
    say('P4 要 300K：hole 總和 350K 夠', '但沒有一塊連續 ≥ 300K');
    holes.filter((h) => h.isMesh).forEach((h) => glow(h, '#3a3000'));
    await beat(tok, 2600);
    tint(p4, RED);
    say('放不下 → external fragmentation', '空間在 hole 之間，加起來夠卻不連續');
    await beat(tok, 2600);
    tint(p4, TEAL);
    say('解法一：compaction，把 process 往前搬', '需要 execution-time binding（動態 relocation）');
    holes.forEach(kill);
    move(ms.P2, X(350 + 75), 0.35); await beat(tok, 800);
    move(ms.P3, X(500 + 75), 0.35); await beat(tok, 900);
    const big = cube('', '#f6efe2', [350 * S - 0.05, 0.12, 1.2], X(650 + 175), 0.06); tag('350K', 'idx', X(825), -0.1, 1.0);
    await beat(tok, 900);
    move(p4, X(650 + 150), 0.35);
    say('hole 合成一塊 350K，P4 放得下', 'compaction 搬資料很花時間');
    await beat(tok, 2600);
    say('50-percent rule：first-fit 下 N 塊配置', '約再損失 0.5N 塊 → 1/3 記憶體可能不能用');
    await beat(tok, 3200);
    say('解法二：讓位址空間不必連續', '→ paging / segmentation');
    await beat(tok, 2600);
    void big;
  }
  async function scIntFrag(tok) {
    fresh([0, 6.5, 12], [0, 1.4, 0]);
    const bar = cube('hole 18,464 bytes', '#f6efe2', [10, 0.3, 1.0], 0, 0.15, -2.6);
    say('有個 hole 18,464 bytes，要求 18,462 bytes', '剛好多出 2 bytes');
    await beat(tok, 2600);
    const used = cube('配置 18,462', BLUE, [9.99, 0.6, 1.0], -0.005, 0.3, -2.6, 2);
    await beat(tok, 1200);
    const left = cube('', RED, [0.12, 0.6, 1.0], 4.94, 0.3, -2.6, 2);
    tag('2 bytes', 'ptr alt', 4.94, 1.0, -2.6);
    say('追蹤一個 2 bytes 的 hole 比它本身還貴', '乾脆整塊給：固定大小的 block');
    await beat(tok, 2800);
    say('多給的、沒用到的 = internal fragmentation', '浪費在「分配出去的區塊裡面」');
    await beat(tok, 2600);
    kill(bar); fly(used); fly(left);
    say('Paging：page 2048 bytes，process 72,766 bytes', '72,766 = 35 × 2048 + 1,086');
    await beat(tok, 2400);
    const W = 0.62;
    for (let i = 0; i < 36; i++) {
      const r = Math.floor(i / 9), c = i % 9, x = -2.5 + c * W, z = -1.5 + r * W;
      if (i < 35) cube('', BLUE, [W - 0.08, 0.4, W - 0.08], x, 0.2, z, 2.5);
      else {
        const f = 1086 / 2048, w = W - 0.08;
        cube('', BLUE, [w * f, 0.4, w], x - w / 2 + w * f / 2, 0.2, z, 2.5);
        cube('', RED, [w * (1 - f), 0.4, w], x + w / 2 - w * (1 - f) / 2, 0.2, z, 2.5);
        tag('只用 1,086', 'ptr alt', x, 1.0, z);
      }
      if (i % 4 === 3) await beat(tok, 120);
    }
    say('要 36 個 frame，最後一個只用 1,086 bytes', 'internal = 2048 − 1086 = 962 bytes');
    await beat(tok, 3000);
    say('最壞浪費約一整個 frame，平均半個 page', 'page 越小碎片越少，但 page table 越大');
    await beat(tok, 3000);
  }

  // ═════════════════════════ 場景（課本）：paging 基本架構 ═════════════════════════
  async function scPagingBasic(tok) {
    fresh([0, 4.2, 14.5], [0, 3.2, 0]);
    const L = 'abcdefghijklmnop'.split(''), PT = [5, 6, 1, 2], C = [BLUE, PURPLE, ORANGE, TEAL];
    const ly = (p) => 5.6 - p * 0.9, fy = (f) => 6.3 - f * 0.78;
    tag('logical memory', 'ptr', -4.8, 6.6);
    const lc = L.map((ch, i) => { const p = i >> 2, d = i & 3; return cube(ch, C[p], [0.5, 0.5, 0.5], -6.1 + d * 0.58, ly(p)); });
    for (let p = 0; p < 4; p++) tag('page ' + p, 'idx', -6.9, ly(p) - 0.45);
    tag('page table', 'ptr', -1.8, 6.6);
    const pt = PT.map((f, p) => { tag(String(p), 'idx', -2.6, ly(p)); return cube(f, SAND, [0.8, 0.5, 0.6], -1.8, ly(p)); });
    tag('physical memory', 'ptr', 3.4, 6.95);
    for (let f = 0; f < 8; f++) { tag('frame ' + f, 'idx', 1.2, fy(f)); tag(String(f * 4), 'idx', 5.4, fy(f)); for (let d = 0; d < 4; d++) ctx.tile(V3(2.3 + d * 0.58, fy(f) - 0.25, 0), 0.5, 0.5, '#efe5d3'); }
    say('16 bytes 的程式，page = 4 bytes', '切成 4 個 page；physical 32 bytes = 8 個 frame');
    await beat(tok, 2800);
    const pc = [];
    for (let p = 0; p < 4; p++) {
      glow(pt[p], GOLD);
      say('page ' + p + ' 放進 frame ' + PT[p], 'page table[' + p + '] = ' + PT[p]);
      for (let d = 0; d < 4; d++) pc.push(cube(L[p * 4 + d], C[p], [0.5, 0.5, 0.5], 2.3 + d * 0.58, fy(PT[p]), 0, 2.5));
      await beat(tok, 1500);
      glow(pt[p], null);
    }
    say('page 不必連續：frame 5、6、1、2', '沒有 external fragmentation');
    await beat(tok, 2400);
    for (const la of [0, 3, 4, 13]) {
      const p = la >> 2, d = la & 3, f = PT[p], pa = f * 4 + d;
      glow(lc[la], GOLD); glow(pt[p], GOLD);
      const tgt = pc[p * 4 + d]; glow(tgt, OKG);
      say('logical ' + la + '（' + L[la] + '）：page ' + p + '、offset ' + d, 'frame ' + f + ' → ' + f + ' × 4 + ' + d + ' = ' + pa);
      await beat(tok, 2600);
      glow(lc[la], null); glow(pt[p], null); glow(tgt, null);
    }
    say('physical = frame × page size + offset', '程式看到連續的 0–15，實際散在各處');
    await beat(tok, 3000);
  }
  async function scAddrBits(tok) {
    fresh([0, 4.4, 13.5], [0, 3.0, 0]);
    tag('logical 13', 'ptr', -4.2, 6.2);
    const lb = '1101'.split('').map((b, i) => cube(b, GRAY, [0.6, 0.6, 0.6], -5.1 + i * 0.7, 5.2, 0, 2));
    say('logical address 13 寫成 4 bits', '16 bytes 的 logical space → m = 4');
    await beat(tok, 2400);
    lb.forEach((m, i) => tint(m, i < 2 ? BLUE : ORANGE));
    tag('p = 11₂ = 3', 'idx', -4.75, 4.4); tag('d = 01₂ = 1', 'idx', -3.35, 4.4);
    say('page = 4 bytes = 2² → 低 2 bits 是 offset', '高 m − n = 2 bits 是 page number');
    await beat(tok, 3000);
    tag('page table', 'ptr', 0.2, 6.2);
    const pt = [5, 6, 1, 2].map((f, p) => { tag(String(p), 'idx', -0.6, 5.3 - p * 0.65); return cube(bin(f, 3), SAND, [1.0, 0.5, 0.6], 0.2, 5.3 - p * 0.65); });
    const pk = cube('11', BLUE, [0.9, 0.45, 0.5], -4.75, 5.2, 0.6);
    move(pk, 0.2, 5.3 - 3 * 0.65 + 0.5, 0.6); glow(pt[3], GOLD);
    say('拿 p = 3 查 page table', '第 3 格：frame 2 = 010₂');
    await beat(tok, 2600);
    kill(pk);
    tag('physical', 'ptr', 4.0, 6.2);
    const pb = [];
    '010'.split('').forEach((b, i) => pb.push(cube(b, GREEN, [0.6, 0.6, 0.6], 2.6 + i * 0.7, 5.2, 0, 2)));
    await beat(tok, 900);
    '01'.split('').forEach((b, i) => pb.push(cube(b, ORANGE, [0.6, 0.6, 0.6], 4.7 + i * 0.7, 5.2, 0, 2)));
    tag('f', 'idx', 3.3, 4.4); tag('d 原封不動', 'idx', 5.05, 4.4);
    say('frame number 換掉 page number，d 不變', '01001₂ = 9');
    await beat(tok, 3000);
    say('一般式：logical 2^m、page 2^n', 'p = 高 m − n bits，d = 低 n bits');
    const W = 12 / 32;
    const a = cube('p：20 bits', BLUE, [20 * W - 0.05, 0.7, 1.0], -6 + 10 * W, 1.6, 0, 2), b = cube('d：12', ORANGE, [12 * W - 0.05, 0.7, 1.0], -6 + 26 * W, 1.6, 0, 2);
    tag('32-bit 位址、page 4 KB = 2¹²', 'idx', 0, 0.8);
    await beat(tok, 3200);
    say('除法變成切 bits：不用真的算除法', 'p = a >> n，d = a & (2ⁿ − 1)');
    await beat(tok, 2800);
    void a; void b;
  }

  // ═════════════════════════ 場景（周志遠 11B）：PTBR、兩次存取、TLB ═════════════════════════
  async function scPtbr(tok) {
    fresh([0, 4.4, 14], [0, 3.2, 0]);
    tag('physical memory', 'ptr', 4.4, 6.9);
    const t1 = cube('P1 的 page table', BLUE, [2.6, 0.9, 1.0], 4.4, 5.4), t2 = cube('P2 的 page table', PURPLE, [2.6, 0.9, 1.0], 4.4, 2.6);
    cube('…', '#f6efe2', [2.6, 0.9, 1.0], 4.4, 4.0); cube('…', '#f6efe2', [2.6, 0.9, 1.0], 4.4, 1.2);
    tag('0x5000（例）', 'idx', 6.4, 5.4); tag('0x9000（例）', 'idx', 6.4, 2.6);
    ghost(RED, 2.6, 2.0, 1.6, 0, 3.6, 0, 0.08); tag('MMU（hardware）', 'ptr', 0, 4.9);
    const reg = cube('PTBR = 0x5000', ORANGE, [2.2, 0.55, 0.8], 0, 3.4);
    let ln = line(1.1, 3.4, 3.1, 5.4, 0.2, BLUE);
    tag('PCB', 'ptr', -4.6, 6.4);
    const pcb1 = cube('P1：PTBR 0x5000', BLUE, [2.6, 0.6, 0.8], -4.6, 5.4), pcb2 = cube('P2：PTBR 0x9000', PURPLE, [2.6, 0.6, 0.8], -4.6, 4.4);
    const run = tag('執行中：P1', 'ptr alt', -4.6, 2.6);
    say('page table 是 OS 放在 memory 的資料結構', '做翻譯的是 hardware：MMU');
    await beat(tok, 2800);
    say('MMU 要知道 table 在哪：PTBR', 'page-table base register');
    glow(reg, GOLD); glow(t1, GOLD);
    await beat(tok, 2800);
    say('PTBR 存的是 physical address', '硬體直接去讀，沒人再幫它翻譯');
    await beat(tok, 2800);
    glow(reg, null); glow(t1, null);
    say('context switch：P1 → P2', '先把 P1 的狀態存回 PCB');
    glow(pcb1, GOLD); await beat(tok, 1800); glow(pcb1, null);
    const cp = cube('0x9000', PURPLE, [1.2, 0.45, 0.6], -4.6, 4.4, 0.6);
    glow(pcb2, GOLD);
    say('載入 P2 的 PCB：CPU register 和 PTBR 都換', 'PTBR 的值就存在 PCB 裡');
    move(cp, 0, 3.4, 0.6); await beat(tok, 1400);
    kill(cp); relabel(reg, 'PTBR = 0x9000'); tint(reg, PURPLE); glow(pcb2, null);
    kill(ln); ln = line(1.1, 3.4, 3.1, 2.6, 0.2, PURPLE); txt(run, '執行中：P2');
    glow(t2, OKG);
    say('現在翻譯用的是 P2 自己的 page table', '每個 process 一張，才不會亂掉');
    await beat(tok, 3200);
  }
  async function scTwoAccess(tok) {
    fresh([0, 4.4, 14], [0, 2.8, 0]);
    cube('CPU', DARK, [1.4, 1.0, 1.0], -5.4, 2.4);
    ghost(RED, 2.0, 1.6, 1.4, -1.8, 2.4, 0, 0.08); tag('MMU', 'ptr', -1.8, 3.5);
    tag('memory', 'ptr', 3.8, 6.4);
    const pt = cube('page table', SAND, [2.6, 1.0, 1.0], 3.8, 4.8), da = cube('你的資料', BLUE, [2.6, 1.0, 1.0], 3.8, 1.6);
    const cnt = tag('memory access：0 次', 'ptr alt', 0, 6.4);
    say('CPU 發出一個 memory read', '使用者以為只讀一次');
    await beat(tok, 2200);
    const pk = cube('(p, d)', ORANGE, [1.0, 0.45, 0.6], -5.4, 2.4, 0.7);
    move(pk, -1.8, 2.4, 0.7); await beat(tok, 900);
    move(pk, 3.8, 4.8, 0.8); glow(pt, GOLD); txt(cnt, 'memory access：1 次');
    say('第 1 次：先讀 page table', '查出 frame number');
    await beat(tok, 1900);
    relabel(pk, '(f, d)'); tint(pk, GREEN); move(pk, -1.8, 2.4, 0.7); glow(pt, null);
    await beat(tok, 1000);
    move(pk, 3.8, 1.6, 0.8); glow(da, OKG); txt(cnt, 'memory access：2 次');
    say('第 2 次：才真的讀到資料', '一次 read 變兩次 memory access');
    await beat(tok, 2200);
    const bar = cube('', BLUE, [1.2, 1, 1.2], -4.4, 0.5, 2.5); bar.scale.y = 4; bar.position.y = 2;
    const bl = tag('100 GB/s', 'ptr', -4.4, 4.5, 2.5);
    say('access time 變兩倍', '花錢買 100 GB/s，只剩 50 GB/s 的效果');
    await anim(tok, 800, (t) => { const h = 4 - 2 * t; bar.scale.y = h; bar.position.y = h / 2; bl.position.y = h + 0.5; });
    txt(bl, '50 GB/s'); tint(bar, RED);
    await beat(tok, 2400);
    say('解法：TLB，翻譯過的先記起來', 'cache hit 時只要一次 memory access');
    await beat(tok, 3000);
  }
  async function scTlbAssoc(tok) {
    fresh([0, 4.2, 13], [0, 3.0, 0]);
    tag('TLB（associative memory）', 'ptr', 0.6, 6.4);
    const E = [[1, 4], [7, 9], [5, 2], [2, 6]];
    const rows = E.map(([p, f], i) => { const y = 5.3 - i * 0.8; return { p: cube('page ' + p, '#cfe6f7', [1.6, 0.6, 0.8], -0.2, y), f: cube('frame ' + f, SAND, [1.6, 0.6, 0.8], 1.6, y) }; });
    tag('frame 值為示意', 'idx', 0.7, 1.9);
    say('TLB 記查過的 page → frame', '沒有順序：可能是 1、7、5、2');
    await beat(tok, 2800);
    const q = cube('page 3？', ORANGE, [1.4, 0.55, 0.6], -4.6, 4.1, 0.5);
    const cnt = tag('', 'ptr alt', -4.6, 2.9);
    say('一般 memory：只能一格一格比', '掃過全部 entry → O(n)');
    for (let i = 0; i < 4; i++) {
      move(q, -2.0, 5.3 - i * 0.8, 0.5); glow(rows[i].p, '#3a3000'); txt(cnt, '比了 ' + (i + 1) + ' 次');
      await beat(tok, 750); glow(rows[i].p, null);
    }
    tint(q, RED); say('掃完才知道 miss', 'entry 越多越慢');
    await beat(tok, 2000);
    tint(q, ORANGE); move(q, -4.6, 4.1, 0.5); txt(cnt, '');
    await beat(tok, 700);
    say('associative memory：所有 entry 同時比對', '硬體平行查 → lookup O(1)');
    rows.forEach((r) => glow(r.p, '#3a3000'));
    txt(cnt, '一次比完');
    await beat(tok, 1500);
    rows.forEach((r) => glow(r.p, null)); tint(q, RED); say('page 3：miss', '還是 O(1) 就知道');
    await beat(tok, 1800);
    relabel(q, 'page 5？'); tint(q, ORANGE);
    rows.forEach((r) => glow(r.p, '#3a3000')); await beat(tok, 900);
    rows.forEach((r, i) => glow(r.p, i === 2 ? OKG : null)); glow(rows[2].f, OKG); tint(q, GREEN);
    say('page 5：hit → frame 2', '雖然是 search，但時間是 O(1)');
    await beat(tok, 2600);
    say('比一般 memory 快 10 倍以上，但很貴', 'entry 只有數千筆等級：放不下整張 page table');
    await beat(tok, 3200);
  }
  async function scTlbHitMiss(tok) {
    fresh([0, 4.6, 15], [0, 3.0, 0]);
    const PT = [3, 4, 6, 8, 1, 2, 0, 9];
    cube('CPU', DARK, [1.2, 0.9, 1.0], -6.0, 1.0);
    ghost(RED, 2.8, 2.6, 1.4, -3.0, 4.2, 0, 0.08); tag('MMU', 'ptr', -3.0, 5.85);
    tag('TLB', 'idx', -4.2, 5.4);
    const tlb = [[1, 4], [7, 9], [5, 2]];
    const tm = tlb.map((e, i) => cube('p ' + e[0] + ' → f ' + e[1], '#cfe6f7', [2.2, 0.5, 0.8], -3.0, 4.9 - i * 0.65));
    tag('page table（memory）', 'ptr', 1.2, 6.6);
    const pm = PT.map((f, p) => { tag(String(p), 'idx', 0.3, 6.0 - p * 0.62); return cube('f ' + f, SAND, [1.2, 0.45, 0.7], 1.2, 6.0 - p * 0.62); });
    tag('physical memory', 'ptr', 4.8, 6.6);
    const fm = []; for (let f = 0; f < 10; f++) { fm.push(cube('', '#f6efe2', [1.6, 0.42, 0.7], 4.8, 6.0 - f * 0.56)); tag(String(f), 'idx', 6.0, 6.0 - f * 0.56); }
    const cnt = tag('', 'ptr alt', -3.0, 0.4);
    say('TLB 是 MMU 的 cache；page table 在 memory', '每個 process 一張 page table，TLB 只有一個');
    await beat(tok, 3000);
    async function access(p, d) {
      const pk = cube('(' + p + ', ' + d + ')', ORANGE, [1.0, 0.45, 0.6], -6.0, 1.9, 0.7);
      say('CPU 發出 (p = ' + p + ', d = ' + d + ')', '第一步一定先查 TLB');
      await beat(tok, 1100);
      move(pk, -4.6, 4.2, 0.8); tm.forEach((m) => glow(m, '#3a3000'));
      await beat(tok, 1000);
      tm.forEach((m) => glow(m, null));
      const hi = tlb.findIndex((e) => e[0] === p);
      let n = 0;
      if (hi >= 0) {
        glow(tm[hi], OKG);
        say('TLB hit：直接拿到 frame ' + tlb[hi][1], '只碰 memory 一次');
      } else {
        tint(pk, RED); say('TLB miss：走回頭路查 page table', '');
        await beat(tok, 1300); tint(pk, ORANGE);
        move(pk, 1.2, 6.0 - p * 0.62 + 0.45, 0.8); glow(pm[p], GOLD); n++; txt(cnt, 'memory access：' + n);
        say('第 1 次 memory access：讀 page table[' + p + ']', 'frame = ' + PT[p]);
        await beat(tok, 1700);
        glow(pm[p], null);
        const ev = tlb.shift(); const em = tm.shift(); fly(em);
        tlb.push([p, PT[p]]);
        tm.forEach((m, i) => move(m, -3.0, 4.9 - i * 0.65));
        const nm = cube('p ' + p + ' → f ' + PT[p], '#cfe6f7', [2.2, 0.5, 0.8], -3.0, 4.9 - 2 * 0.65, 0, 2); tm.push(nm); glow(nm, GOLD);
        say('把 (' + p + ', ' + PT[p] + ') 放進 TLB', 'TLB 滿了：踢掉 p ' + ev[0]);
        await beat(tok, 1800); glow(nm, null);
      }
      const f = hi >= 0 ? tlb[hi][1] : PT[p];
      relabel(pk, '(' + f + ', ' + d + ')'); tint(pk, GREEN);
      move(pk, 4.8, 6.0 - f * 0.56 + 0.4, 0.8); glow(fm[f], OKG); n++; txt(cnt, 'memory access：' + n);
      say('讀 frame ' + f + ' 的資料', '這次共 ' + n + ' 次 memory access');
      await beat(tok, 2200);
      glow(fm[f], null); tm.forEach((m) => glow(m, null)); fly(pk); txt(cnt, '');
    }
    await access(2, 7);
    await access(2, 3);
    say('hit：1 次 memory access；miss：2 次', 'hit rate 越高越接近原本的速度');
    await beat(tok, 3000);
  }
  async function scTlbFlush(tok) {
    fresh([0, 4.4, 14], [0, 3.0, 0]);
    tag('TLB', 'ptr', -2.4, 6.5);
    const mk = (t, i, c) => cube(t, c || '#cfe6f7', [2.6, 0.55, 0.8], -2.4, 5.6 - i * 0.7);
    let rows = [mk('p 0 → f 3', 0), mk('p 1 → f 4', 1), mk('p 2 → f 6', 2)];
    const run = tag('執行中：P1', 'ptr alt', -6.0, 6.5);
    tag('P1：0→3、1→4、2→6', 'idx', 3.8, 5.6); tag('P2：0→7、1→5', 'idx', 3.8, 4.9);
    say('TLB 裡都是 P1 的 (page, frame)', '只記 page 跟 frame 兩個數字');
    await beat(tok, 2600);
    txt(run, '執行中：P2');
    const q = cube('P2 要 page 0', PURPLE, [1.9, 0.5, 0.6], -6.0, 4.2, 0.5);
    say('context switch 到 P2，P2 也有 page 0', 'page number 每個 process 都會重複');
    await beat(tok, 2200);
    move(q, -4.6, 5.6, 0.5); glow(rows[0], BADR); tint(q, RED);
    say('TLB 說 frame 3：那是 P1 的 frame！', 'P2 的 page 0 其實在 frame 7');
    await beat(tok, 2800);
    say('解法一：flush TLB，全部清空', '最常用的做法');
    rows.forEach((m) => fly(m)); rows = []; tint(q, PURPLE);
    await beat(tok, 1600);
    tint(q, RED); say('清空後：P2 接下來的存取全部 miss', '每次都兩次 memory access');
    await beat(tok, 2200);
    rows.push(mk('p 0 → f 7', 0, '#dfd3fb')); tint(q, PURPLE);
    say('miss 後再一筆一筆填回來', 'context switch 變慢的主要原因之一');
    await beat(tok, 2600);
    fly(q); rows.forEach((m) => fly(m)); rows = [];
    await beat(tok, 800);
    say('解法二：每筆多一個 PID 欄位', 'PID 和 page 都相符才算 hit');
    const r2 = [['P1 | p 0 → f 3', '#cfe6f7'], ['P1 | p 1 → f 4', '#cfe6f7'], ['P2 | p 0 → f 7', '#dfd3fb']].map(([t, c], i) => cube(t, c, [3.2, 0.55, 0.8], -2.1, 5.6 - i * 0.7, 0, 2));
    await beat(tok, 1600);
    const q2 = cube('(P2, page 0)', PURPLE, [1.9, 0.5, 0.6], -6.0, 4.2, 0.5);
    move(q2, -4.6, 4.2, 0.5); r2.forEach((m) => glow(m, '#3a3000')); await beat(tok, 900);
    r2.forEach((m, i) => glow(m, i === 2 ? OKG : null)); tint(q2, GREEN);
    say('只有 P2 那筆相符 → frame 7', 'context switch 不用清空');
    await beat(tok, 2400);
    say('代價：每筆 8 bytes 變 12 bytes', 'TLB 很貴；程式又常把 TLB 塞滿 → 多半選 flush');
    await beat(tok, 3200);
  }
  async function scEmat(tok) {
    fresh([0, 4.0, 14], [0, 2.8, 0]);
    const S = 0.022;
    function stack(x, parts, label) {
      let y = 0; const ms = [];
      for (const [v, c] of parts) { const h = v * S; ms.push(cube(v >= 60 ? String(v) : '', c, [1.5, h - 0.03, 1.2], x, y + h / 2, 0, 3)); y += h; }
      tag(label, 'ptr', x, -0.1, 1.2);
      return { ms, top: y };
    }
    say('TLB lookup 20 ns，memory access 100 ns', '上課例子');
    await beat(tok, 2400);
    const h = stack(-4.8, [[20, ORANGE], [100, BLUE]], 'hit');
    tag('120', 'ptr alt', -4.8, h.top + 0.4);
    say('hit：20 + 100 = 120 ns', '一定要先查 TLB，20 不能忘');
    await beat(tok, 2600);
    const m = stack(-2.4, [[20, ORANGE], [100, BLUE], [100, BLUE]], 'miss');
    tag('220', 'ptr alt', -2.4, m.top + 0.4);
    say('miss：20 + 100 + 100 = 220 ns', '查 TLB、讀 page table、讀資料');
    await beat(tok, 2600);
    const e70 = stack(0.6, [[150, GREEN]], 'hit 70%');
    tag('150', 'ptr alt', 0.6, e70.top + 0.4);
    say('hit rate 70%', '0.7 × 120 + 0.3 × 220 = 84 + 66 = 150 ns');
    await beat(tok, 3200);
    const e98 = stack(3.0, [[122, GREEN]], 'hit 98%');
    tag('122', 'ptr alt', 3.0, e98.top + 0.4);
    say('hit rate 98%', '0.98 × 120 + 0.02 × 220 = 117.6 + 4.4 = 122 ns');
    await beat(tok, 3200);
    const no = stack(5.4, [[100, GRAY], [100, GRAY]], '沒有 TLB');
    tag('200', 'ptr', 5.4, no.top + 0.4);
    say('跟沒有 TLB 的 200 ns 比', '98% 時快了將近一倍');
    await beat(tok, 3200);
  }

  // ═════════════════════════ 場景（課本）：page table 結構 ═════════════════════════
  async function scPtSize(tok) {
    fresh([0, 4.6, 14], [0, 2.6, 0]);
    const W = 12 / 32;
    const a = cube('page number：20 bits', BLUE, [20 * W - 0.05, 0.7, 1.0], -6 + 10 * W, 5.6, 0, 2);
    const b = cube('offset：12', ORANGE, [12 * W - 0.05, 0.7, 1.0], -6 + 26 * W, 5.6, 0, 2);
    say('32-bit 位址、page 4 KB', 'offset 12 bits，page number 20 bits');
    await beat(tok, 2600);
    say('page table 要 2²⁰ ≈ 100 萬個 entry', '每個 4 bytes → 4 MB');
    const pg = cube('1 page = 4 KB', SAND, [1.2, 0.3, 1.2], 3.6, 0.15, 0, 2);
    const slab = cube('', DARK, [3.2, 0.2, 3.2], -2.4, 0.1); slab.scale.y = 0.01;
    const sl = tag('', 'ptr alt', -2.4, 0.6);
    await anim(tok, 1400, (t) => { const h = 0.01 + t * 3.2 / 0.2; slab.scale.y = h; slab.position.y = h * 0.1; sl.position.y = h * 0.2 + 0.5; txt(sl, Math.round(t * 4096) + ' KB'); });
    txt(sl, 'page table 4 MB = 1024 個 page');
    await beat(tok, 2400);
    say('每個 process 都要一張，還要連續放', '連續 4 MB → 又回到連續配置的麻煩');
    await beat(tok, 3000);
    say('解法：把 page table 本身也拿去 paging', '→ hierarchical / hashed / inverted');
    await beat(tok, 2800);
    void a; void b; void pg;
  }
  async function scTwoLevel(tok) {
    fresh([0, 4.6, 15], [0, 2.8, 0]);
    const W = 12 / 32;
    cube('p1：10', PURPLE, [10 * W - 0.05, 0.6, 0.9], -6 + 5 * W, 6.3, 0, 2);
    cube('p2：10', BLUE, [10 * W - 0.05, 0.6, 0.9], -6 + 15 * W, 6.3, 0, 2);
    cube('d：12', ORANGE, [12 * W - 0.05, 0.6, 0.9], -6 + 26 * W, 6.3, 0, 2);
    say('page number 20 bits 再切成 p1 | p2', '每段 10 bits：一張 table 1024 筆 × 4 B = 剛好一個 page');
    await beat(tok, 3200);
    tag('outer page table', 'ptr', -4.4, 5.3);
    const outer = ['0', '1', '2', '…', '1023'].map((t, i) => { tag(t, 'idx', -5.6, 4.6 - i * 0.6); return cube(i === 3 ? '' : i === 4 ? 'null' : '→ 內層 #' + i, i === 4 ? GRAY : SAND, [1.8, 0.45, 0.7], -4.4, 4.6 - i * 0.6); });
    tag('inner page tables', 'ptr', 0, 5.3);
    const inner = [0, 1, 2].map((k) => cube('內層 #' + k, '#cfe6f7', [1.9, 0.5, 0.7], 0, 4.6 - k * 1.3));
    const innerRows = ['0', '1', '2', '3'].map((t, i) => cube(i === 3 ? 'f 12' : 'f ' + [5, 9, 2][i], SAND, [1.3, 0.38, 0.6], 2.5, 3.7 - i * 0.5));
    innerRows.forEach((m) => vis(m, false));
    tag('memory', 'ptr', 5.4, 5.3);
    const fr = cube('frame 12', GREEN, [1.6, 0.8, 0.8], 5.4, 2.0);
    const cnt = tag('', 'ptr alt', 0, 0.3);
    say('例：p1 = 1、p2 = 3、d = 100', '');
    await beat(tok, 2000);
    const pk = cube('p1 = 1', PURPLE, [1.0, 0.42, 0.5], -6 + 5 * W, 6.3, 0.6);
    move(pk, -4.4, 4.0 + 0.4, 0.6); glow(outer[1], GOLD); txt(cnt, 'memory access：1');
    say('第 1 次：outer table[1] → 內層 #1', '');
    await beat(tok, 2200);
    glow(inner[1], GOLD);
    innerRows.forEach((m, i) => { vis(m, true); m.position.y = 3.3 + 0.5 - i * 0.5; });
    relabel(pk, 'p2 = 3'); tint(pk, BLUE); move(pk, 2.5, 3.3 + 0.5 - 3 * 0.5 + 0.4, 0.6); glow(innerRows[3], GOLD); txt(cnt, 'memory access：2');
    say('第 2 次：內層 #1 的第 3 格 → frame 12', '');
    await beat(tok, 2400);
    relabel(pk, 'f 12 + d 100'); tint(pk, GREEN); move(pk, 5.4, 2.6, 0.6); glow(fr, OKG); txt(cnt, 'memory access：3');
    say('第 3 次才讀到資料', 'physical = 12 × 4096 + 100 = 49252');
    await beat(tok, 2800);
    glow(outer[4], BADR);
    say('沒用到的區域，內層 table 根本不配置', 'outer 填 null → 省下大量空間');
    await beat(tok, 2800);
    say('64-bit：outer 還有 2⁴² 筆，兩層不夠', '層數越多，miss 時 memory access 越多');
    await beat(tok, 3000);
  }
  async function scHashed(tok) {
    fresh([0, 4.2, 14], [0, 3.0, 0]);
    tag('hash table', 'ptr', -4.6, 6.6);
    const B = 8, by = (b) => 6.0 - b * 0.72;
    const bk = []; for (let b = 0; b < B; b++) { tag(String(b), 'idx', -5.5, by(b)); bk.push(cube('', SAND, [0.9, 0.5, 0.7], -4.6, by(b))); }
    const chains = {};
    const ins = [[5, 3], [2, 4], [13, 8], [7, 6], [21, 1]];
    say('hash(p) = p mod 8（示意）', '同一格的用 linked list 串起來');
    await beat(tok, 2200);
    for (const [p, f] of ins) {
      const b = p % B; chains[b] = chains[b] || [];
      const k = chains[b].length;
      const m = cube('p ' + p + ' | f ' + f, '#cfe6f7', [1.7, 0.5, 0.7], -2.6 + k * 2.2, by(b), 0, 2);
      if (k === 0) line(-4.15, by(b), -3.45, by(b), 0, '#6e5f49'); else line(-2.6 + (k - 1) * 2.2 + 0.85, by(b), -2.6 + k * 2.2 - 0.85, by(b), 0, '#6e5f49');
      chains[b].push({ p, f, m });
      say('page ' + p + ' → 第 ' + b + ' 格', '每個 element：page number、frame、next');
      await beat(tok, 1100);
    }
    const q = cube('找 p = 13', ORANGE, [1.5, 0.5, 0.6], -4.6, 0.3, 0.6);
    say('查 page 13：13 mod 8 = 5', '先 hash 到第 5 格');
    await beat(tok, 1600);
    move(q, -4.6, by(5) + 0.5, 0.6); glow(bk[5], GOLD);
    await beat(tok, 1300);
    for (const e of chains[5]) {
      move(q, e.m.position.x, by(5) + 0.5, 0.6); glow(e.m, e.p === 13 ? OKG : BADR);
      say('比對 p ' + e.p + (e.p === 13 ? '：相符 → frame ' + e.f : '：不是，往下走'), '');
      await beat(tok, 1500);
      if (e.p === 13) break;
    }
    say('適合超過 32 bits 的位址空間', 'clustered 版本：一個 element 管好幾個 page');
    await beat(tok, 3000);
  }
  async function scInverted(tok) {
    fresh([0, 4.2, 14], [0, 3.0, 0]);
    tag('inverted page table（全系統一張）', 'ptr', 0, 6.7);
    const E = [['P1', 0], ['P2', 3], ['P1', 2], ['P3', 0], ['P2', 1], ['P1', 3], ['P3', 2], ['P2', 0]];
    const C = { P1: '#cfe6f7', P2: '#dfd3fb', P3: '#d2f1e6' };
    const rows = E.map(([pid, p], i) => { tag('i = ' + i, 'idx', -1.6, 6.0 - i * 0.66); return cube(pid + ' | page ' + p, C[pid], [2.2, 0.5, 0.7], 0, 6.0 - i * 0.66); });
    say('每個 frame 一個 entry：記 (pid, page)', 'entry 的 index i 就是 frame number');
    await beat(tok, 3000);
    const q = cube('(P1, 3, d)', BLUE, [1.6, 0.5, 0.6], -5.2, 3.6, 0.5);
    say('要找 P1 的 page 3', '在 table 裡搜尋 (pid, p)');
    await beat(tok, 1800);
    for (let i = 0; i < E.length; i++) {
      move(q, -2.6, 6.0 - i * 0.66, 0.5); const hit = E[i][0] === 'P1' && E[i][1] === 3;
      glow(rows[i], hit ? OKG : '#3a3000');
      await beat(tok, hit ? 900 : 550);
      if (hit) { say('找到了：i = ' + i, 'physical address = (' + i + ', d)'); relabel(q, '(' + i + ', d)'); tint(q, GREEN); break; }
      glow(rows[i], null);
    }
    await beat(tok, 2400);
    say('好處：table 大小只跟 physical memory 有關', '不再每個 process 一張大 table');
    await beat(tok, 2800);
    say('壞處：要搜尋整張表 → 用 hash 加速', 'shared memory 難做：一個 frame 只記一個 pid');
    await beat(tok, 3200);
  }
  async function scShared(tok) {
    fresh([0, 4.6, 15], [0, 3.2, 0]);
    const PTs = { P1: [3, 4, 6, 1], P2: [3, 4, 6, 7], P3: [3, 4, 6, 2] };
    const names = ['ed 1', 'ed 2', 'ed 3'];
    const fy = (f) => 6.4 - f * 0.78;
    tag('physical memory', 'ptr', 3.8, 6.95);
    for (let f = 0; f < 8; f++) { tag(String(f), 'idx', 2.6, fy(f)); ctx.tile(V3(3.8, fy(f) - 0.3, 0), 1.8, 0.6, '#efe5d3'); }
    const placed = {};
    const procs = Object.keys(PTs);
    const PC = { P1: BLUE, P2: PURPLE, P3: TEAL };
    for (let k = 0; k < 3; k++) {
      const pid = procs[k], y = 5.8 - k * 2.0, pt = PTs[pid];
      tag(pid, 'ptr', -6.3, y);
      const pages = [...names, 'data ' + (k + 1)].map((n, i) => cube(n, i < 3 ? ORANGE : PC[pid], [1.0, 0.45, 0.6], -5.0 + (i % 2) * 1.1, y - Math.floor(i / 2) * 0.55));
      tag('table ' + pt.join(' '), 'idx', -2.0, y - 0.25);
      say(pid + ' 執行編輯器 ed', 'page table：' + pt.join('、'));
      await beat(tok, 1400);
      for (let i = 0; i < 4; i++) {
        const f = pt[i];
        line(-4.4 + (i % 2) * 1.1, y - Math.floor(i / 2) * 0.55, 2.9, fy(f), 0, i < 3 ? '#dd8238' : '#8fb7e0');
        if (!placed[f]) { placed[f] = cube(i < 3 ? names[i] : 'data ' + (k + 1), i < 3 ? ORANGE : PC[pid], [1.6, 0.5, 0.6], 3.8, fy(f), 0, 2.5); }
        else glow(placed[f], GOLD);
        glow(pages[i], GOLD);
        await beat(tok, 500);
      }
      say(k === 0 ? 'ed 的 3 個 page 放進 frame 3、4、6' : 'ed 已經在 frame 3、4、6：直接共用', k === 0 ? 'data 1 在 frame 1' : '只多放自己的 data ' + (k + 1));
      await beat(tok, 2200);
      Object.values(placed).forEach((m) => glow(m, null));
    }
    say('三個 process 共用同一份 ed：只佔 3 個 frame', '不共用要 9 個');
    await beat(tok, 2800);
    say('共用的 code 必須是 reentrant', '執行時不會修改自己（read-only）');
    await beat(tok, 3000);
  }
  async function scSegmentation(tok) {
    fresh([0, 4.2, 14.5], [0, 3.4, 0]);
    say('使用者眼中的程式：一段一段的', 'main、subroutine、sqrt、stack、symbol table');
    const o = segDraw();
    o.segs.forEach((m) => vis(m, false));
    await beat(tok, 2600);
    for (let i = 0; i < SEG.length; i++) {
      vis(o.segs[i], true); glow(o.rows[i].l, GOLD); glow(o.rows[i].b, GOLD);
      say('segment ' + i + '（' + SEG[i].name + '）', 'limit ' + SEG[i].limit + '、base ' + SEG[i].base);
      await beat(tok, 1100);
      glow(o.rows[i].l, null); glow(o.rows[i].b, null);
    }
    say('logical address = (segment, offset)', '各段長度不同、放在各處');
    await beat(tok, 2200);
    await segTranslate(o, 2, 53, tok, true); await beat(tok, 2200);
    await segTranslate(o, 3, 852, tok, true); await beat(tok, 2200);
    await segTranslate(o, 0, 1222, tok, true); await beat(tok, 2400);
    say('segment 大小不一 → 會有 external fragmentation', '跟 variable partition 一樣要 best / first fit');
    await beat(tok, 3000);
  }
  async function scFragCompare(tok) {
    fresh([0, 5.5, 13], [0, 1.6, 0]);
    const cols = [[-4.4, '連續配置', 'external'], [0, 'Paging', 'internal'], [4.4, 'Segmentation', 'external']];
    cols.forEach(([x, n]) => tag(n, 'ptr', x, 4.6));
    // contiguous
    [[0.6, BLUE], [0.4, null], [0.8, PURPLE], [0.3, null], [0.7, ORANGE], [0.3, null]].reduce((y, [h, c]) => { if (c) cube('', c, [2.4, h - 0.04, 1.0], -4.4, y + h / 2, 0, 2); else cube('', RED, [2.4, h - 0.04, 0.2], -4.4, y + h / 2, 0.5); return y + h; }, 0.2);
    // paging
    for (let i = 0; i < 4; i++) cube('', BLUE, [2.4, 0.5, 1.0], 0, 0.45 + i * 0.56, 0, 2);
    cube('', BLUE, [1.0, 0.5, 1.0], -0.7, 0.45 + 4 * 0.56, 0, 2); cube('', RED, [1.4, 0.5, 1.0], 0.5, 0.45 + 4 * 0.56, 0, 2);
    // segmentation
    [[1.1, TEAL], [0.25, null], [0.5, PINK], [0.4, null], [0.9, ORANGE]].reduce((y, [h, c]) => { if (c) cube('', c, [2.4, h - 0.04, 1.0], 4.4, y + h / 2, 0, 2); else cube('', RED, [2.4, h - 0.04, 0.2], 4.4, y + h / 2, 0.5); return y + h; }, 0.2);
    await beat(tok, 1400);
    for (const [x, n, k] of cols) {
      tag(k, k === 'internal' ? 'ptr alt' : 'ptr', x, -0.2, 1.2);
      say(n + '：' + k + ' fragmentation', k === 'internal' ? '最後一頁沒用完（紅色）' : 'hole 夾在中間、太零散（紅色）');
      await beat(tok, 2400);
    }
    say('internal：浪費在配出去的區塊裡', 'external：浪費在區塊之間的 hole');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'address-binding': { title: '（課本）Address binding：compile / load / execution time', play: scBinding },
    'base-limit': { title: '（課本）Base / limit register 保護', play: scBaseLimit },
    'relocation-register': { title: '（課本）MMU：relocation register 14000 + 346', play: scRelocation },
    'contiguous-fit': { title: '（課本）First / Best / Worst fit：212K、417K、112K、426K', play: scFit },
    'external-frag': { title: '（課本）External fragmentation 與 compaction', play: scExtFrag },
    'internal-frag': { title: '（課本）Internal fragmentation：72,766 bytes 浪費 962', play: scIntFrag },
    'paging-basic': { title: '（課本）Paging：page table 5、6、1、2', play: scPagingBasic },
    'address-bits': { title: '（課本）位址切成 p | d：13 → 9', play: scAddrBits },
    'ptbr-context-switch': { title: 'PTBR：page table 的位置，隨 context switch 載入', play: scPtbr },
    'two-memory-access': { title: '一次 read 變兩次 memory access', play: scTwoAccess },
    'tlb-associative': { title: 'TLB：associative memory，O(1) 平行比對', play: scTlbAssoc },
    'tlb-hit-miss': { title: 'TLB hit / miss 的流程', play: scTlbHitMiss },
    'tlb-flush-asid': { title: 'Context switch：flush TLB 或加 PID', play: scTlbFlush },
    'emat-calc': { title: 'EMAT：70% → 150 ns、98% → 122 ns', play: scEmat },
    'page-table-size': { title: '（課本）32-bit + 4KB：page table 4 MB', play: scPtSize },
    'two-level-paging': { title: '（課本）Two-level paging：10 | 10 | 12', play: scTwoLevel },
    'hashed-page-table': { title: '（課本）Hashed page table', play: scHashed },
    'inverted-page-table': { title: '（課本）Inverted page table', play: scInverted },
    'shared-pages': { title: '（課本）Shared pages：三個 process 共用 ed', play: scShared },
    'segmentation': { title: '（課本）Segmentation：(2, 53) → 4353', play: scSegmentation },
    'frag-compare': { title: '（課本）Internal vs External fragmentation', play: scFragCompare },
  };

  return {
    kicker: '作業系統・第 7 章',
    title: '記憶體管理：Paging、Segmentation、碎裂',
    color: 'var(--os)',
    modes: [
      { id: 'translate', name: 'Paging 位址轉換', enter: enterTranslate },
      { id: 'fit', name: '連續配置', enter: enterFit },
      { id: 'emat', name: 'TLB 與 EMAT', enter: enterEmat },
      { id: 'seg', name: 'Segmentation', enter: enterSeg },
      { id: 'ptsize', name: 'Page table 大小', enter: enterPtSize },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'address-binding', 'base-limit', 'relocation-register',
      'contiguous-fit', 'external-frag', 'internal-frag',
      'paging-basic', 'address-bits',
      'ptbr-context-switch', 'two-memory-access', 'tlb-associative', 'tlb-hit-miss', 'tlb-flush-asid', 'emat-calc',
      'page-table-size', 'two-level-paging', 'hashed-page-table', 'inverted-page-table', 'shared-pages',
      'segmentation', 'frag-compare',
    ],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
