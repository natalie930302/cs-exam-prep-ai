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
import kit from './_kit.js';

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
    const fr = [...Array(TR_FR).keys()].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    move(pkt, 1.2, 5.5 - s * 0.62, 0.6); glow(row.l, GOLD); glow(row.b, GOLD);
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
      const n = pick([8, 9, 10, 11, 12]), psz = 1 << n, pages = 8, pt = [...Array(16).keys()].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, pages);
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
      const others = hs.filter((h) => h !== ch).map((h) => '第 ' + (h.i + 1) + ' 個（' + h.size + 'K）').map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    const opts = [...new Set(p.opts)].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
    [0, 256000, 300040, 420940, 880000, 1024000].forEach((a, i) => tag(String(a), 'idx', 5.6 + (i % 2) * 1.3, Y(a)));
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
      tint(m, GREEN); move(m, 1.6, Y(a), 0.7);
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
    tag('0x5000（例）', 'idx', 4.4, 4.75); tag('0x9000（例）', 'idx', 4.4, 1.95);
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
    move(pk, 3.8, 5.55, 0.8); glow(pt, GOLD); txt(cnt, 'memory access：1 次');
    say('第 1 次：先讀 page table', '查出 frame number');
    await beat(tok, 1900);
    relabel(pk, '(f, d)'); tint(pk, GREEN); move(pk, -1.8, 2.4, 0.7); glow(pt, null);
    await beat(tok, 1000);
    move(pk, 3.8, 2.35, 0.8); glow(da, OKG); txt(cnt, 'memory access：2 次');
    say('第 2 次：才真的讀到資料', '一次 read 變兩次 memory access');
    await beat(tok, 2200);
    const bar = cube('', BLUE, [1.2, 1, 1.2], 0.8, 0.5, 2.5); bar.scale.y = 4; bar.position.y = 2;
    const bl = tag('100 GB/s', 'ptr', 0.8, 4.5, 2.5);
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
    const outer = ['0', '1', '2', '…', '1023'].map((t, i) => { tag(t, 'idx', -6.0, 4.6 - i * 0.6); return cube(i === 3 ? '' : i === 4 ? 'null' : '→ 內層 #' + i, i === 4 ? GRAY : SAND, [1.8, 0.45, 0.7], -4.4, 4.6 - i * 0.6); });
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
      const pages = [...names, 'data ' + (k + 1)].map((n, i) => cube(n, i < 3 ? ORANGE : PC[pid], [1.2, 0.45, 0.6], -5.0 + (i % 2) * 1.4, y - Math.floor(i / 2) * 0.55));
      tag('table ' + pt.join(' '), 'idx', -1.4, y - 0.25);
      say(pid + ' 執行編輯器 ed', 'page table：' + pt.join('、'));
      await beat(tok, 1400);
      for (let i = 0; i < 4; i++) {
        const f = pt[i];
        line(-4.4 + (i % 2) * 1.4, y - Math.floor(i / 2) * 0.55, 2.9, fy(f), 0, i < 3 ? '#dd8238' : '#8fb7e0');
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ mem.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 7 章 Memory Management（清大 周志遠 10A–12B 講 + Paging with Example）— cued scenes ───
// Every scene is a list of steps; each step waits for the lecturer's sentence (notes "cues"), then makes one short move.
// Nothing loops or replays. 老師的數字照用（0x18/0x2018、346 + 14000、1,4,3,7、20/100 ns、10|10|12、0x448…）；老師沒給的數字標「示意」。
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
const pkt = (t, c, x, y, z = 0.7, w = 1.4) => cube(t, c, [w, 0.45, 0.5], x, y, z);
const MC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', gray: '#d8cfc0', dark: '#8d8170', sand: '#e9dcc4', paper: '#f6efe2', tlb: '#cfe6f7', lilac: '#dfd3fb', mint: '#d2f1e6' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010', DIMG = '#3a3000';
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
const CAMW = [[0, 4.4, 15], [0, 3.0, 0]];
// a memory column, rows listed top (low address) to bottom: [text, height, color]
function col(x, yTop, rows, w = 2.2, d = 0.9) {
  let y = yTop; const m = [], ys = [];
  for (const [t, h, c] of rows) { const cy = y - h / 2; m.push(bx(t, c, x, cy, 0, w, h - 0.05, d)); ys.push(cy); y -= h; }
  return { m, ys, bottom: y };
}
// a table: one cell per value, index labels at the left
function tbl(x, yTop, vals, o = {}) {
  const dy = o.dy || 0.56, w = o.w || 1.2, c = o.c || MC.sand;
  const cells = vals.map((v, i) => bx(String(v), Array.isArray(c) ? c[i] : c, x, yTop - i * dy, 0, w, dy - 0.08, 0.7));
  const idx = o.noIdx ? [] : vals.map((v, i) => sm(o.idx ? o.idx[i] : String(i), x - w / 2 - 0.35, yTop - i * dy));
  const title = o.title ? hd(o.title, x, yTop + 0.6) : null;
  return { cells, idx, title, y: (i) => yTop - i * dy };
}
// a row of bit cubes
function bits(s, x, y, colorAt, size = 0.42) {
  return s.split('').map((b, i) => bx(b, colorAt(i), x + i * (size + 0.06), y, 0, size, size, size));
}

// ════════ xxwRs_2XjjY（第 10A 講：Memory Management 背景、address binding） ════════
scene('mem-10a-intro', '本章談什麼：memory 怎麼管理', CAM, [
  async (tok, S) => {                                   // 14 第八章，最重要：process 的關鍵是 load 到 memory
    S.f = prop('file', -5.0, 2.0, 0, 1.2, 'program'); S.ram = zone('memory', 1.6, 0, 0, 7.0, 3.0);
    S.p = buddy('process', '', MC.blue, 0, 0, 0, 0.8);
    cap('最重要的一章：memory 管理', 'program 變成 process，關鍵就是 load 進 memory');
  },
  async (tok, S) => {                                   // 49 基本概念
    note('① 基本概念：program 與 memory 怎麼結合', -2.4, 6.4);
    cap('先介紹基本概念', 'memory 的使用怎麼跟 program 結合');
  },
  async (tok, S) => {                                   // 59 swapping：memory ↔ disk
    S.disk = prop('disk', 5.6, 0, 0, 1.0, 'disk');
    const c = pkt('content', MC.orange, 1.0, 1.2, 1.0); await slide(tok, c, 5.6, 1.6, 1.0, 700); await slide(tok, c, 2.0, 1.2, 1.0, 600); gone(c);
    note('② swapping：memory ↔ disk', -2.4, 5.8);
    cap('swapping', 'memory content 在 memory 和 disk 之間搬');
  },
  async (tok, S) => {                                   // 86 memory 是連續空間，code/heap/stack 怎麼 allocate
    gone(S.p);
    S.col = col(1.6, 4.4, [['code', 0.7, MC.blue], ['heap', 0.9, MC.green], ['…', 0.6, MC.paper], ['stack', 0.8, MC.purple]], 2.0);
    cap('memory 是一塊連續的空間', 'code、heap、stack 怎麼 allocate 給程式？');
  },
  async (tok, S) => {                                   // 105 切割散落 → paging、segmentation
    const xs = [-0.6, 3.6, 0.2, 3.0];
    await anim(tok, 900, (u) => S.col.m.forEach((m, i) => { m.position.x = 1.6 + (xs[i] - 1.6) * u; }));
    note('③ paging、segmentation：切開、散落各地', -2.4, 5.2);
    cap('為了有效使用實體空間', '會被切割、散落各地：paging、segmentation');
  },
  async (tok, S) => {                                   // 124 都是假象：map 到實體甚至硬碟
    bub('程式看到的連續空間，其實是假象', 1.6, 6.6);
    cap('你看到的都是假象', 'OS 把使用的空間 map 到實體，甚至 map 到硬碟');
  },
  async (tok, S) => {                                   // 138 segmentation fault
    bad('segmentation fault！', -4.6, 4.4);
    cap('為什麼 pointer 亂指會 segmentation fault？', '最接近 program 的那層就是 segmentation');
  },
  async (tok, S) => {                                   // 179 paging + segmentation 結合
    good('真正的 OS：segmentation + paging 結合', 0, 0.5, 2.0);
    cap('真正的作業系統兩者都用', '先個別介紹，最後再套在一起');
  },
]);

scene('mem-10a-bg', '為什麼 memory 這麼重要', CAM, [
  async (tok, S) => {                                   // 195 唯一 CPU 能直接 access 的 storage
    S.cpu = prop('cpu', -4.6, 0, 0, 1.2, 'CPU'); S.ram = bx('memory', MC.blue, 0, 1.0, 0, 2.6, 1.6, 1.4);
    S.a = arrow(V3(-3.6, 1.0, 0), V3(-1.4, 1.0, 0));
    cap('memory 是 CPU 唯一能直接 access 的', 'fetch instruction、fetch data 都從 memory');
  },
  async (tok, S) => {                                   // 208 instruction、data 都要在 memory；cache 只是暫存
    sm('instruction', -0.6, 2.2); sm('data', 0.8, 2.2); bx('cache', MC.tlb, -2.4, 2.2, 0, 1.0, 0.5, 0.6);
    cap('instruction 和 data 都必須在 memory', 'cache 只是中間加速的暫存');
  },
  async (tok, S) => {                                   // 228 沒辦法直接 access disk
    prop('disk', 4.4, 0, 0, 1.0, 'disk'); bad('CPU 不能直接讀 disk', 4.4, 2.6);
    cap('CPU 沒辦法直接 access disk', '或任何其他 storage device');
  },
  async (tok, S) => {                                   // 235 multiprogramming：很多 process 在 memory
    S.ps = ['P1', 'P2', 'P3'].map((n, i) => bx(n, [MC.orange, MC.green, MC.purple][i], -1.0 + i * 1.0, 3.2, 0, 0.9, 0.6, 0.8));
    cap('為了 CPU 使用率：multiprogramming', '很多 process 同時放在 memory');
  },
  async (tok, S) => {                                   // 262 OS 要 control 每支能用多少、放哪
    note('OS 管：每支能用多少？放在哪？', 0, 4.4);
    cap('這樣就複雜了', 'OS 要控制每支程式用多少 memory、散落在哪');
  },
  async (tok, S) => {                                   // 276 protection
    glow(S.ps[1], NG); bad('不能隨意改別人的 memory', 0, 5.1);
    cap('還要做 protection', '你不能隨意改別人程式的 memory');
  },
  async (tok, S) => {                                   // 294 memory 有限 → virtual memory，把 disk 當 memory
    glow(S.ps[1], null); good('virtual memory：disk 也當成 memory 的一部分', 1.0, 5.9);
    cap('memory 畢竟有限', 'virtual memory 把 disk 納進來管理');
  },
  async (tok, S) => {                                   // 321 手機、embedded 可能沒有 VM
    prop('monitor', -5.4, 3.8, 0, 0.7, '手機／embedded');
    cap('也不是全部都有', '手機、embedded system 可能拿掉 virtual memory');
  },
]);

scene('mem-10a-steps', 'Address binding 的三個時間點', CAMW, [
  async (tok, S) => {                                   // 355 address binding
    hd('從 program 到 memory', 0, 6.7);
    cap('先介紹 address binding', '把 program 跟 memory 對在一起');
  },
  async (tok, S) => {                                   // 364 loading、linking；static vs dynamic
    note('loading、linking：static 或 dynamic', 0, 6.1);
    cap('還有 loading 跟 linking', '很多過程可以發生在 run time：static vs dynamic');
  },
  async (tok, S) => {                                   // 401 swapping、paging、segmentation
    note('最後：swapping、paging、segmentation', 0, 5.5);
    cap('最後是 swapping、paging、segmentation', '會花比較多時間');
  },
  async (tok, S) => {                                   // 414 variable → memory address
    S.v = pkt('int data;', MC.blue, -5.6, 4.2, 0.3, 1.6); S.va = pkt('address ?', MC.orange, -5.6, 3.4, 0.3, 1.6);
    cap('program 跟 memory 的連結', 'variable 會變成某個 memory address');
  },
  async (tok, S) => {                                   // 435 對到 physical 哪裡，不是 compile 完就知道
    hot('對到 physical address 的哪裡？', -3.4, 2.5);
    cap('對到 physical 的什麼位置', '不一定 compile 完就知道，有很多可能');
  },
  async (tok, S) => {                                   // 448 分成三個時間點
    S.st = ['compile', 'link', 'load', 'run'].map((n, i) => bx(n, MC.gray, -2.2 + i * 2.5, 1.0, 0, 2.0, 0.7, 1.0));
    for (let i = 0; i < 3; i++) arrow(V3(-1.15 + i * 2.5, 1.0, 0.6), V3(-0.25 + i * 2.5, 1.0, 0.6));
    cap('根據時間點分成三種', '從 compile 到執行的流程');
  },
  async (tok, S) => {                                   // 461 compile time
    tint(S.st[0], MC.purple); hd('compile time', -2.2, 2.0);
    cap('compile time', '在 compile 這段時間就做決定');
  },
  async (tok, S) => {                                   // 475 load time
    tint(S.st[2], MC.teal); hd('load time', 2.8, 2.0);
    cap('load time', '準備把程式放進 memory 的時候');
  },
  async (tok, S) => {                                   // 495 execution time / run time
    tint(S.st[3], MC.orange); hd('execution（run）time', 5.3, 2.0);
    cap('execution time（run time）', '到了 memory、真的開始執行');
  },
  async (tok, S) => {                                   // 504 compile、link、load、run 四個流程
    sm('四個流程、三個時間點（link 不算 binding 時間）', 1.6, 0.0);
    cap('Compile、Link、Load、Run', '其中三段：compile / load / execution time');
  },
  async (tok, S) => {                                   // 521 library：link time 放進來（static）
    S.lib = pkt('C library', MC.pink, 0.3, 2.9, 0.3, 1.6); glow(S.st[1], HL);
    cap('像 C library', 'link 時就把 library 放進程式碼：static');
  },
  async (tok, S) => {                                   // 551 static loading vs dynamic loading（run time）
    glow(S.st[1], null); glow(S.st[2], HL); sm('static loading：load time', 2.8, 2.9);
    await wt(tok, 300); glow(S.st[3], HL); sm('dynamic loading：run time', 5.3, 3.6);
    cap('static loading 在 load time', 'dynamic loading：執行時才 load 進 memory');
  },
  async (tok, S) => {                                   // 569 dynamic linking 也是 run time
    sm('dynamic linking：run time', 5.3, 4.3); glow(S.st[2], null);
    cap('dynamic linking 也是 run time', '這四個名詞之後分別解釋');
  },
]);

scene('mem-10a-compile', 'Compile-time binding：absolute code', CAMW, [
  async (tok, S) => {                                   // 614 簡單程式：data 是 variable
    S.code = code(['int data;', 'data = data + 1;'], -4.6, 5.8);
    cap('一個很簡單的程式', 'data 是一個 variable，要 bind 到 physical address');
  },
  async (tok, S) => {                                   // 628 最早期：compile time 就決定
    hot('compile time 就決定 physical address', -4.0, 4.6);
    cap('最早期：在 compile time 做 binding', 'compile 時就 assign physical address');
  },
  async (tok, S) => {                                   // 643 機器碼吃的是 address 不是 name
    S.bin = code(['LOAD  0x1018', 'ADD   1', 'STORE 0x1018'], -4.6, 3.4);
    cap('compile 成機器碼', 'instruction 吃的不是 variable name，是 address');
  },
  async (tok, S) => {                                   // 682 load 時位置要一模一樣
    hd('memory', 3.6, 6.8);
    S.mem = col(3.6, 6.4, [['OS', 1.0, MC.dark], ['', 1.2, MC.paper], ['', 2.6, MC.paper], ['', 1.0, MC.paper]], 2.6);
    sm('0x1000', 5.4, 5.4);
    cap('load 時位置必須一模一樣', '不然就 mismatch，讀錯資料');
  },
  async (tok, S) => {                                   // 704 寫 0x1000：assume 被 load 到 0x1000
    S.prog = bx('program', MC.blue, -1.0, 4.2, 0, 2.6, 1.2, 0.9);
    await slide(tok, S.prog, 3.6, 5.4 - 0.6 - 0.02, 0.1, 800);
    cap('compile 時寫 0x1000', '假設程式執行時會被放到 0x1000');
  },
  async (tok, S) => {                                   // 725 CPU 一行一行讀，位置一樣 → 正確
    S.bin.hl(0); S.dl = sm('data 在 0x1000 + 0x18 = 0x1018', 3.6, 3.6);
    cap('CPU 只是一行一行讀', '看到什麼位置就去哪讀：擺的位置一樣，就讀得對');
  },
  async (tok, S) => {                                   // 740 compile-time address binding
    S.bin.hl(-1); good('compile-time address binding', -4.0, 1.6);
    cap('這就是 compile-time address binding', '');
  },
  async (tok, S) => {                                   // 744 只有一個程式、早期 DOS → absolute code
    hd('別名：absolute code', -4.0, 1.0);
    cap('電腦只跑一個程式時可以這樣做', '早期 DOS 就這麼做：absolute code');
  },
  async (tok, S) => {                                   // 798 好處：簡單、run time 很快
    good('好處：簡單、run time 很快（不用翻譯）', -3.0, 0.3);
    cap('好處非常簡單', 'CPU 要的位置就在那裡，run time 很快');
  },
  async (tok, S) => {                                   // 828 缺點：一搬動就完了（0x1000 → 0x2000）
    gone(S.dl); await slide(tok, S.prog, 3.6, 2.9, 0.1, 700); sm('搬到 0x2000', 5.5, 2.9);
    S.bin.ls.forEach((l) => { l.element.className = 'lab-label bad'; });
    cap('缺點：在 memory 裡一搬動就完了', '位置寫死在 code 裡：還在讀 0x1018');
  },
  async (tok, S) => {                                   // 859 必須 recompile、重新 load、重新執行
    bad('要搬 → recompile → 重新 load → 重新 execute', -2.2, -0.4);
    cap('除非 recompile，不然改不了', '整個程式 kill 掉重來');
  },
  async (tok, S) => {                                   // 899 對 general 電腦不理想
    note('多使用者、多 process 共用 memory：非常不理想', 0.6, 7.3);
    cap('簡單的 embedded device 還行', '多 process 共享 memory 的電腦就不理想');
  },
  async (tok, S) => {                                   // 943 為什麼要搬：run time 才知道、swap 回來位置被佔
    const o = bx('別人', MC.orange, 3.6, 5.4 - 0.6, 0.2, 2.5, 1.15, 0.9); void o;
    await slide(tok, S.prog, 6.2, 0.6, 0.1, 600);
    cap('為什麼程式會搬來搬去？', 'swap 到硬碟再回來，原位置可能已被別人佔住');
  },
]);

scene('mem-10a-load', 'Load-time binding：relocatable code', CAMW, [
  async (tok, S) => {                                   // 1005 改善：load time，延後決定
    hd('memory', 3.6, 6.8);
    S.mem = col(3.6, 6.4, [['OS', 1.0, MC.dark], ['（有人）', 1.2, MC.orange], ['', 2.6, MC.paper], ['', 1.0, MC.paper]], 2.6);
    sm('0x1000', 5.4, 5.4); sm('0x2000', 5.4, 4.2);
    cap('改善：load time binding', '把決定 address 的時間 delay 到 load');
  },
  async (tok, S) => {                                   // 1021 差別：compile 時不寫絕對位置
    S.code = code(['LOAD  base + 0x18', 'ADD   1', 'STORE base + 0x18'], -4.8, 5.6);
    cap('同樣的例子，差別很小', 'compile 時不寫絕對位置');
  },
  async (tok, S) => {                                   // 1041 留一個 base register
    S.base = bx('base = ?', MC.orange, -4.8, 3.6, 0, 2.0, 0.55, 0.8);
    cap('留一個叫 base register 的值', '留給 loader 去決定');
  },
  async (tok, S) => {                                   // 1061 程式裡是連續，只要相對位置
    sm('0x18 = 離程式開頭的相對位置', -4.8, 2.8);
    cap('compile 只管自己程式內', '程式空間是連續的，只算相對位置');
  },
  async (tok, S) => {                                   // 1088 load 時看 memory 哪裡有空
    glow(S.mem.m[2], HL);
    cap('load 的時候才看 memory 哪裡有空', 'depends on 當下這台電腦');
  },
  async (tok, S) => {                                   // 1103 loader 改寫成正確位置
    glow(S.mem.m[2], null); relabel(S.base, 'base = 0x2000');
    S.p = bx('program', MC.blue, -1.0, 2.0, 0, 2.5, 1.2, 0.9); await slide(tok, S.p, 3.6, 4.2 - 0.6, 0.1, 700);
    S.code.ls.forEach((l, i) => { if (i !== 1) txt(l, (i ? 'STORE' : 'LOAD ') + ' 0x2018      '); });
    cap('loader 找到空位，知道 base 是多少', '載入時把位址改寫成 0x2018');
  },
  async (tok, S) => {                                   // 1127 relocatable code
    good('relocatable code：compile 完可以放到任何空位', -1.6, 1.0);
    cap('這叫 relocatable code', '寫程式、compile 時不必知道哪裡有空');
  },
  async (tok, S) => {                                   // 1163 run time 想換位置？
    await slide(tok, S.p, 6.3, 0.8, 0.1, 600); const o = bx('別人', MC.purple, 3.6, 4.2 - 0.6, 0.2, 2.5, 1.15, 0.9); void o;
    cap('問題：run time 想換位置怎麼辦？', 'swap 到 disk 再回來，想放別的地方');
  },
  async (tok, S) => {                                   // 1179 必須 reload：kill 掉重新 load
    bad('想放回別處 → kill 掉、重新 load、再 run', -1.6, 0.3);
    cap('還是要 reload', '只有 loader 知道位置，要重新 load');
  },
  async (tok, S) => {                                   // 1198 但不用 recompile
    good('至少不用 recompile', -4.8, 1.8);
    cap('至少不用 compile', 'compile 完可能隔很久才執行，到時再找空間');
  },
]);

scene('mem-10a-exec', 'Execution-time binding：MMU 在送出前才翻譯', CAMW, [
  async (tok, S) => {                                   // 1274 還沒達到目的：run time binding
    hd('目標：execution-time binding', 0, 6.8);
    cap('還沒達到現在電腦的做法', 'runtime（execution time）address binding');
  },
  async (tok, S) => {                                   // 1303 同樣例子：compile、load 都沒差別
    S.code = code(['LOAD  0x18', 'ADD   1', 'STORE 0x18'], -5.0, 5.8);
    sm('compile 後：0x18', -5.0, 4.0); sm('load 後：還是 0x18', -5.0, 3.4);
    cap('同樣的例子', 'compile 和 load 都沒改：都是相對位置');
  },
  async (tok, S) => {                                   // 1318 0x18：從程式開頭算起
    hd('memory', 4.6, 6.8);
    S.mem = col(4.6, 6.4, [['OS', 1.0, MC.dark], ['', 1.2, MC.paper], ['program', 2.4, MC.blue], ['', 1.2, MC.paper]], 2.4);
    sm('0x2000', 6.3, 4.2);
    cap('0x18：相對於程式開頭', 'loader 什麼都不動，直接放 0x18');
  },
  async (tok, S) => {                                   // 1356 memory 裡的位址跟實際位置不一樣
    hot('instruction 寫 0x18', 4.6, 3.75, 0.6);
    cap('重點：位址跟實際位置居然不一樣', '前兩種放進 memory 前一定要 match');
  },
  async (tok, S) => {                                   // 1379 實際應該是 0x2018
    sm('data 實際在 0x2000 + 0x18 = 0x2018', 4.6, 1.2);
    cap('實際位置應該是 0x2018', 'instruction 裡放的還是 0x18');
  },
  async (tok, S) => {                                   // 1394 virtual address vs physical
    S.vp = [hd('0x18：virtual address（假的）', -3.0, 2.6), hd('0x2018：physical address（真的）', -3.0, 2.0)];
    cap('0x18 叫 virtual address', '0x2018 才是 physical address');
  },
  async (tok, S) => {                                   // 1421 為什麼 work：MMU
    S.cpu = bx('CPU', MC.dark, -5.4, 0.6, 0, 1.2, 0.9, 1.0);
    S.mmu = bx('MMU', '#f1d3d3', -1.6, 0.6, 0, 1.8, 1.0, 1.0);
    cap('為什麼會 work？', '送到 memory 前，有個 component：MMU');
  },
  async (tok, S) => {                                   // 1445 CPU 渾然不知，MMU 送出前轉成 0x2018
    const pk = pkt('0x18', MC.orange, -5.4, 1.5); await slide(tok, pk, -1.6, 1.5, 0.7, 500);
    glow(S.mmu, HL); relabel(pk, '0x2018'); tint(pk, MC.green); await wt(tok, 300); glow(S.mmu, null);
    await slide(tok, pk, 4.6, 4.2 - 0.3, 0.7, 700); gone(pk);
    cap('CPU 以為 0x18 就是正確位置', 'MMU 在送到 memory 前才轉成 0x2018');
  },
  async (tok, S) => {                                   // 1467 只有 MMU 知道；paging/segmentation 實作在 MMU
    note('paging、segmentation 都實作在 MMU', -1.6, -0.4);
    cap('memory 和 CPU 都不知道，只有 MMU 知道', '後面的 paging、segmentation 都在 MMU');
  },
  async (tok, S) => {                                   // 1492 頻繁 → hardware 實作
    good('每個 address 都要翻 → 用 hardware 做才夠快', -1.6, -1.0);
    cap('它是 OS 的一部分', '但存取太頻繁，真的實作是 hardware logic');
  },
  async (tok, S) => {                                   // 1545 CPU 送 logical 346
    gone(S.code.ls, S.vp); S.code = null;
    S.pk = pkt('346', MC.orange, -5.4, 1.5);
    cap('run time 實際發生什麼？', 'CPU 送出 logical address，例如 346');
  },
  async (tok, S) => {                                   // 1590 加 base（relocation）register 14000
    S.reg = bx('base 14000', MC.orange, -1.6, 2.0, 0, 1.8, 0.5, 0.8);
    await slide(tok, S.pk, -1.6, 1.5, 0.7, 500); relabel(S.pk, '14346'); tint(S.pk, MC.green);
    cap('最簡單的 translation：加 base register', '346 + 14000 = 14346');
  },
  async (tok, S) => {                                   // 1625 run time 要移動：14000 → 24000
    hot('程式搬到 24000', 4.6, 0.3);
    cap('run time 移動程式也沒關係', '例如從 14000 搬到 24000');
  },
  async (tok, S) => {                                   // 1640 context switch 時 load base → 24346
    relabel(S.reg, 'base 24000'); glow(S.reg, HL);
    relabel(S.pk, '346'); tint(S.pk, MC.orange); S.pk.position.set(-5.4, 1.5, 0.7);
    await slide(tok, S.pk, -1.6, 1.5, 0.7, 500); relabel(S.pk, '24346'); tint(S.pk, MC.green); glow(S.reg, null);
    cap('context switch 時把 base 值 load 進來', '同一個 346 → 346 + 24000 = 24346');
  },
  async (tok, S) => {                                   // 1662 MMU；後面 paging/seg 更複雜
    note('MMU = memory management unit（hardware）', -1.6, 3.0);
    cap('MMU 要熟記', '後面的 paging、segmentation 不只是加一個值');
  },
]);

scene('mem-10a-lp', 'Logical address vs physical address', CAM, [
  async (tok, S) => {                                   // 1703 logical / physical 概念
    S.cpu = bx('CPU', MC.dark, -5.0, 2.0, 0, 1.4, 1.0, 1.0); S.mmu = bx('MMU', '#f1d3d3', 0, 2.0, 0, 1.8, 1.0, 1.0); S.mem = bx('memory', MC.blue, 5.0, 2.0, 0, 1.8, 2.0, 1.0);
    cap('最重要的概念', 'logical address 跟 physical address');
  },
  async (tok, S) => {                                   // 1717 logical：CPU 送出來的（virtual）
    arrow(V3(-4.2, 2.0, 0.6), V3(-1.0, 2.0, 0.6)); hd('logical（virtual）address', -2.6, 3.0);
    cap('logical address：CPU 送出來的', '統稱 virtual address：它是假的');
  },
  async (tok, S) => {                                   // 1736 physical：送進 memory module
    arrow(V3(1.0, 2.0, 0.6), V3(4.0, 2.0, 0.6)); hd('physical address', 2.5, 3.0);
    cap('physical address', '真正送到 memory module 的 address');
  },
  async (tok, S) => {                                   // 1748 compile / load time：兩個一樣
    good('compile / load time：logical = physical', 0, 5.4);
    cap('compile time、load time', '兩個 address 一模一樣，也一定要一樣');
  },
  async (tok, S) => {                                   // 1764 run time：不同 → translation
    hot('execution time：logical ≠ physical → MMU translation', 0, 4.7);
    glow(S.mmu, HL);
    cap('run time 的特色：兩個不同', 'MMU 做 address translation 找到 mapping');
  },
  async (tok, S) => {                                   // 1781 好處：OS 管 physical 很彈性
    glow(S.mmu, null); good('OS：只要有空位就能用', 5.0, 0.5);
    cap('好處一：不用 match', 'OS 管 physical resource 很有彈性');
  },
  async (tok, S) => {                                   // 1805 programmer、compiler 只管 logical
    good('programmer、compiler：只管 logical', -5.0, 0.5);
    cap('好處二：programmer 只管 logical', '其他程式、memory 怎麼管都可以視而不見');
  },
  async (tok, S) => {                                   // 1841 compiler 最受益，全部丟給 MMU
    note('loader、compiler 什麼都不用做 → 全部丟給 MMU', 0, 6.2);
    cap('大幅減少系統複雜度', 'compiler 受益最大：全部丟給 MMU');
  },
]);

// ════════ Q2-sJ3eYGYE（第 10B 講：dynamic loading、linking 的問題） ════════
scene('mem-10b-why', 'Dynamic loading：用到才 load', CAMW, [
  async (tok, S) => {                                   // 2 paging、segmentation 都在講 translation
    hd('paging、segmentation = logical → physical 的 translation', 0, 6.7);
    cap('之後講的 paging、segmentation', '全部都在講兩種 address 的 translation');
  },
  async (tok, S) => {                                   // 31 為了最佳化：dynamic loading、linking
    note('有了 run time 的概念 → dynamic loading、dynamic linking', 0, 6.1);
    cap('為了最佳化 memory 的使用', '出現 dynamic loading 與 linking');
  },
  async (tok, S) => {                                   // 45 loader：把 program content load 進 memory
    S.disk = prop('disk', -5.6, 0, 0, 1.1, 'disk image'); S.ld = buddy('loader', '', MC.teal, -2.6, 0, 0, 0.7);
    hd('memory', 3.6, 5.4); S.mem = zone('', 3.6, 0, 0, 5.0, 3.0);
    cap('loading 跟 loader 有關', '把 program 的 memory content load 進 memory');
  },
  async (tok, S) => {                                   // 63 static loading：run 前全部放好
    S.blocks = ['main', 'f1', 'f2', 'f3', 'array'].map((n, i) => bx(n, [MC.blue, MC.green, MC.green, MC.green, MC.orange][i], 1.8 + (i % 3) * 1.6, 0.4 + Math.floor(i / 3) * 0.8, 0, 1.4, 0.7, 1.0));
    cap('早期：static loading', '執行前就把整個程式 create 出來放進 memory');
  },
  async (tok, S) => {                                   // 77 問題：整個 program 都佔住空間
    S.blocks.forEach((b) => glow(b, DIMG));
    cap('問題在哪？', 'entire program 的 content 全部 create、全部佔住');
  },
  async (tok, S) => {                                   // 94 例：array 一萬個 element，只要 10 個
    S.blocks.forEach((b) => glow(b, null)); relabel(S.blocks[4], 'int a[10000]'); S.blocks[4].scale.x = 2.0; S.blocks[4].position.x = 3.6;
    bub('其實只要 10 個 element', 3.6, 3.0);
    cap('程式常 allocate 一大堆卻不用', '例：多打了幾個 0，array 開 1 萬個');
  },
  async (tok, S) => {                                   // 124 浪費
    tint(S.blocks[4], MC.red); S.bd = bad('load time 就佔住 → 浪費', 3.6, 3.7);
    cap('load time 就得把空間佔住', '浪費很多根本用不到的 memory');
  },
  async (tok, S) => {                                   // 138 dynamic loading：真的要用才 load
    gone(S.blocks, S.bd); S.blocks = [];
    S.m = bx('main', MC.blue, 1.8, 0.4, 0, 1.4, 0.7, 1.0);
    good('dynamic loading：用到的時候才 load', 3.6, 3.7);
    cap('解法：dynamic loading', '發現你真的要用，才 load 進 memory');
  },
  async (tok, S) => {                                   // 169 OS 以 routine（function）為單位
    note('OS 的單位：routine（function code）', -3.0, 5.0);
    cap('variable 太底層不好管', 'OS 做的是 routine level：以 function code 為單位');
  },
  async (tok, S) => {                                   // 192 call 到才 load，沒 call 就不存在
    S.f = pkt('f1()', MC.green, -5.6, 2.6); await slide(tok, S.f, 3.4, 0.4, 0, 800);
    cap('call 到這個 function 才 load', '沒 call，它在 memory 裡就不存在');
  },
  async (tok, S) => {                                   // 237 很多 routine 從來沒用到
    sm('f2、f3……從來沒被 call', -5.6, 2.6);
    cap('觀察：很多 routine 從沒用到', '程式要考慮各種可能，實際只走一條路');
  },
  async (tok, S) => {                                   // 256 commercial code：70–80% 是 error handling
    bad('商業程式：70%～80% 的 function 在處理 error', -2.0, 4.3);
    cap('商業程式更是如此', '大部分 function code 都在做 error handling');
  },
  async (tok, S) => {                                   // 305 IBM 的例子：加一個 flag 花半年
    note('IBM：加一個 flag 印個 message，test 了半年', -2.0, 3.6);
    cap('真實經驗', '只加一個 flag，從頭 test 一遍花了將近半年');
  },
  async (tok, S) => {                                   // 340 dynamic loading 避免 load 用不到的 code
    S.ld.mood('happy'); good('不需要的 code 不必 load', -2.6, 2.0);
    cap('dynamic loading', '就能避免把用不到的 code load 進來');
  },
]);

scene('mem-10b-dl', 'Dynamic loading 怎麼用：dlopen、dlsym', CAMW, [
  async (tok, S) => {                                   // 352 OS 提供功能，但不主動做
    S.os = buddy('OS', '', MC.dark, -5.4, 0, 2.0, 0.7);
    cap('什麼時候在 run time load？', 'OS 提供這個功能，但不會主動幫你做');
  },
  async (tok, S) => {                                   // 372 交給使用者決定
    S.me = buddy('programmer', '', MC.pink, -3.6, 0, 2.0, 0.7);
    cap('哪些 function 要 dynamic loading', '交給使用者（programmer）決定');
  },
  async (tok, S) => {                                   // 382 C 的例子：include dlfcn.h
    S.c = code(['#include <dlfcn.h>', 'double (*cosine)(double);', 'h = dlopen("libm.so", RTLD_LAZY);', 'cosine = dlsym(h, "cos");', 'printf("%f", (*cosine)(2.0));', 'dlclose(h);'], -0.8, 6.4);
    S.c.hl(0);
    cap('C 的例子', 'include dynamic function 的 header：dlfcn.h');
  },
  async (tok, S) => {                                   // 400 先把 function compile 成 library
    S.lib = bx('library（libm.so）', MC.pink, 4.8, 0.4, 0, 2.6, 0.8, 1.0); prop('disk', 4.8, 0, -1.6, 0.8);
    cap('先把要 dynamic loading 的 function', '自己 compile 成一個 library（不需要 main）');
  },
  async (tok, S) => {                                   // 449 define 一個 cosine function pointer
    S.c.hl(1);
    cap('define 一個 cosine 的 function pointer', '程式知道有這個 function 存在');
  },
  async (tok, S) => {                                   // 460 dlopen：開啟、註冊 library
    S.c.hl(2); glow(S.lib, HL);
    cap('dlopen：把 library 開啟、註冊', '裡面的 function 是 run time 才 access 的');
  },
  async (tok, S) => {                                   // 486 cos 是 library 裡的那個 function
    S.c.hl(3); glow(S.lib, null); S.cs = sm('cosine ↔ library 裡的 cos', 4.8, 1.5);
    cap('run time 做 binding', 'cosine 對到 dynamic library 裡的 cos');
  },
  async (tok, S) => {                                   // 515 load 程式時不 load；call 到才從 disk load
    S.c.hl(4); S.k = pkt('cos 的 code', MC.pink, 4.8, 0.4, 0.7, 1.6);
    await slide(tok, S.k, 0.6, -0.2, 1.4, 800);
    cap('程式 load 時 cos 不在 memory', 'call 這一行時，才從 disk 的 library load 進來');
  },
  async (tok, S) => {                                   // 545 dlclose
    S.c.hl(5);
    cap('用完 dlclose 關掉', '用 dynamic loading 就這幾行');
  },
  async (tok, S) => {                                   // 555 好處：省 memory，也讓 programmer 有彈性
    gone(S.cs); S.c.hl(-1); S.gd = [good('省 memory', -5.0, 3.05), good('programmer 有彈性', -5.0, 2.3)];
    cap('好處：解決 memory 浪費', '對 programmer 也很有彈性');
  },
  async (tok, S) => {                                   // 576 run time 決定 bind 到 cos 或 cos double
    S.rt = sm('run time 決定：cos？還是更精準的 cos double？', 1.9, 2.3);
    cap('runtime 才決定 bind 到誰', '不同系統 support 的 function 不同');
  },
  async (tok, S) => {                                   // 608 現在多半為了 runtime 決定 function
    S.me.mood('happy'); S.nt = note('現在多為了：runtime 決定 call 哪個 function', 0.6, 1.55);
    cap('現在 programmer 用它', '多半不是為了省 memory，而是 runtime 決定 function');
  },
  async (tok, S) => {                                   // 633 圖：程式有 A、B、C 三個 function
    gone(S.c.ls, S.k, S.os, S.me, S.gd, S.rt, S.nt);
    hd('disk image', -4.6, 5.2); S.img = ['main', 'A', 'B', 'C'].map((n, i) => bx(n, i ? MC.green : MC.blue, -4.6, 4.4 - i * 0.8, 0, 1.6, 0.6, 0.8));
    hd('memory', 1.6, 5.2);
    cap('簡單的圖示', '程式 define 了三個 function（disk image）');
  },
  async (tok, S) => {                                   // 655 static loading：整個 load
    S.st = S.img.map((m, i) => bx(['main', 'A', 'B', 'C'][i], i ? MC.green : MC.blue, 0.6, 4.4 - i * 0.8, 0, 1.4, 0.6, 0.8)); sm('static', 0.6, 1.2);
    cap('static loading', '整個 load 到 memory');
  },
  async (tok, S) => {                                   // 661 dynamic：init 只有 static 部分；call B 才 load
    bx('main', MC.blue, 3.4, 4.4, 0, 1.4, 0.6, 0.8); bx('A', MC.green, 3.4, 3.6, 0, 1.4, 0.6, 0.8); sm('dynamic（B、C 是 dynamic）', 3.4, 1.2);
    S.b = bx('B', MC.green, -4.6, 2.8, 0.6, 1.4, 0.6, 0.8); await slide(tok, S.b, 3.4, 2.8, 0, 700);
    cap('dynamic：一開始只有 static 的部分', 'call 了 B，B 才被 load 進來');
  },
  async (tok, S) => {                                   // 690 call 完可以離開
    await slide(tok, S.b, 3.4, 2.8, 2.5, 600); gone(S.b);
    cap('call 完就可以離開', '動態地使用 memory 空間');
  },
]);

scene('mem-10b-link', 'Linking：每個程式都 link 一份 C library', CAMW, [
  async (tok, S) => {                                   // 730 call printf → link C library
    S.ps = [-4.0, 0, 4.0].map((x, i) => bx('program ' + (i + 1), [MC.blue, MC.orange, MC.purple][i], x, 4.6, 0, 2.4, 0.8, 0.9));
    cap('什麼是 linking？', 'call printf，就代表要去 link C library');
  },
  async (tok, S) => {                                   // 743 include header 為了 link
    sm('#include <stdio.h> → printf', -4.0, 5.5);
    cap('include header 的目的', '要去 link 某個 library，程式才完整');
  },
  async (tok, S) => {                                   // 760 每個 C program 都有 C library
    S.libs = [-4.0, 0, 4.0].map((x) => bx('C library', MC.pink, x, 3.6, 0, 2.4, 0.7, 0.9));
    cap('每個 C program', '都會 include、link 到 C library');
  },
  async (tok, S) => {                                   // 779 同時執行 → library 重複 load
    hd('memory', 0, 2.4);
    for (const l of S.libs) await slide(tok, l, l.position.x, 1.4, 0, 400);
    cap('三個程式同時執行', '同一份 library 被重複 load 進 memory');
  },
  async (tok, S) => {                                   // 800 跨 program 的 duplicate → 浪費
    S.libs.forEach((l) => glow(l, NG)); bad('同一份 code 存了 3 次', 0, 0.3, 1.0);
    cap('單一程式看沒問題', '跨 program 有很多 duplicate library → 浪費');
  },
]);

// ════════ YwPv-XEWDSU（第 10C 講：loader vs swapper、static / dynamic linking） ════════
scene('mem-10c-swapper', 'Loader 跟 swapper 不一樣', CAMW, [
  async (tok, S) => {                                   // 2 同學問：load time binding 是 disk image → memory
    S.disk = prop('disk', -5.4, 0, 0, 1.2, 'disk'); hd('memory', 4.2, 4.4); zone('', 4.2, 0, 0, 4.4, 3.0);
    S.img = pkt('disk image', MC.gray, -5.4, 2.3, 0.6, 1.6);
    cap('同學的問題', 'load time binding：從 disk image load 到 memory 時做');
  },
  async (tok, S) => {                                   // 50 run time：swapping 從 disk 搬回再設 address
    S.sw = pkt('memory content', MC.orange, -5.4, 3.1, 0.6, 1.8);
    cap('run time 的情況', 'swapping 把 content 從 disk 搬回來，再設 address');
  },
  async (tok, S) => {                                   // 68 相同點：都是 disk → memory
    await slide(tok, S.img, 3.4, 0.6, 0.4, 600); await slide(tok, S.sw, 5.2, 1.4, 0.4, 600);
    cap('像的地方', '都把 program 的 memory content 從 disk 搬到 memory');
  },
  async (tok, S) => {                                   // 77 但 loader 跟 swapper 是不同人
    S.L = buddy('loader', '', MC.teal, -2.6, 0, 1.6, 0.7); S.W = buddy('swapper', '', MC.orange, -0.6, 0, 1.6, 0.7);
    cap('但做事的人不一樣', 'loader 跟 swapper 是不同的 system component');
  },
  async (tok, S) => {                                   // 83 loader：整個程式重新開始，create PCB、heap、stack…
    S.L.mood('wow'); note('loader：create PCB、初始化 memory、heap、stack…', -1.6, 4.6);
    cap('loader 假設程式是重新開始', '要 create PCB、做 initialization，很複雜');
  },
  async (tok, S) => {                                   // 126 swapper：只是搬 data
    S.W.mood('happy'); note('swapper：只在 memory ↔ disk 之間 copy data', -1.6, 3.9);
    cap('swapper（下一章 virtual memory）', '單純搬 memory content，就是 data copy');
  },
  async (tok, S) => {                                   // 164 叫 loader 改位置 = 整個程式重跑
    bad('loader 改位置 → 整個程式重跑', -4.6, 6.0);
    cap('叫 loader 改位置', '意思就是整個程式重來');
  },
  async (tok, S) => {                                   // 171 virtual memory：run time 只改值
    good('swapper：搬好後在 run time 改一下 mapping 的值就好', 1.6, 6.0);
    cap('virtual memory 的機制', 'run time 很簡單地修改值就好');
  },
  async (tok, S) => {                                   // 197 一個叫 load time，一個叫 run time
    hd('load：program → process', -2.6, 2.6); hd('swap：data movement', -0.6, 3.2);
    cap('一個稱 load time，一個稱 run time', '雖然都跟 memory 和 disk 有關，差別很大');
  },
]);

scene('mem-10c-static', 'Static linking：每支 binary 都塞一份 library', CAMW, [
  async (tok, S) => {                                   // 222 回到 linking
    hd('linking', 0, 6.7);
    cap('回到剛才提到的 linking', '');
  },
  async (tok, S) => {                                   // 231 static linking：gcc 呼叫 linker
    S.src = bx('main.c', MC.blue, -5.0, 4.6, 0, 1.6, 0.6, 0.8); S.lk = buddy('linker', '', MC.teal, -2.6, 3.6, 0, 0.6);
    cap('預設是 static linking', 'gcc 會 call linker');
  },
  async (tok, S) => {                                   // 247 程式很小，link 完 binary 變大
    S.lib = bx('C library', MC.pink, -2.6, 5.9, 0, 2.0, 0.6, 0.8);
    S.bin = bx('a.out', MC.blue, 0.8, 4.6, 0, 1.2, 0.6, 0.8);
    await anim(tok, 700, (u) => { S.bin.scale.x = 1 + 1.4 * u; });
    cap('程式很小，link 完 binary 卻變大', '因為把 library 的程式碼一起綁進來');
  },
  async (tok, S) => {                                   // 261 single binary
    relabel(S.bin, 'a.out（main + library）');
    cap('變成一個 single binary', '所有 code 都放在一起');
  },
  async (tok, S) => {                                   // 271 loader 整包 load 到 memory
    hd('memory', 4.6, 6.7); S.m1 = bx('P1：main + C lib', MC.blue, 4.6, 5.6, 0, 2.8, 0.9, 0.9);
    cap('loader load 的時候', '拿到一整包，也不知道怎麼分，就整個 load');
  },
  async (tok, S) => {                                   // 283 library 大家都要用 → 每支都一份
    S.m2 = bx('P2：main + C lib', MC.orange, 4.6, 4.6, 0, 2.8, 0.9, 0.9); S.m3 = bx('P3：main + C lib', MC.purple, 4.6, 3.6, 0, 2.8, 0.9, 0.9);
    cap('library 就是大家都要用的', '很多程式一定 share 很多 library，尤其 C library');
  },
  async (tok, S) => {                                   // 297 memory 被 duplicate 的 library 佔滿
    [S.m1, S.m2, S.m3].forEach((m) => glow(m, NG)); bad('memory 被重複的 library 佔滿', 4.6, 2.6);
    cap('library 都不小', 'memory 可能被這些 duplicate 的 library 佔滿');
  },
  async (tok, S) => {                                   // 314 跟 dynamic loading 不一樣
    note('dynamic loading：只管「一支程式」什麼時候用', -3.0, 1.6);
    cap('這跟 dynamic loading 不一樣', 'dynamic loading 只管一支程式自己');
  },
  async (tok, S) => {                                   // 341 static linking + dynamic loading 還是各有一份
    bad('跨程式的問題：就算 dynamic loading，各自還是一份 copy', -3.0, 0.8);
    cap('這是跨程式的問題', 'static linking 加上 dynamic loading 仍然存在');
  },
]);

scene('mem-10c-dynlink', 'Dynamic linking：library 只放一份', CAMW, [
  async (tok, S) => {                                   // 358 dynamic linking = run time linking
    hd('dynamic linking = run time linking', 0, 6.7);
    cap('解法：dynamic linking', 'function call 另一個 library 的 call，在 run time 才 link');
  },
  async (tok, S) => {                                   // 379 load 時只有 main program
    hd('memory', 1.0, 6.0);
    S.p = [bx('P1：main', MC.blue, -1.6, 5.0, 0, 2.0, 0.7, 0.9), bx('P2：main', MC.orange, -1.6, 4.1, 0, 2.0, 0.7, 0.9)];
    cap('程式 load 進去時', '可能就只有 main program');
  },
  async (tok, S) => {                                   // 384 library 只要放一份（immutable）
    S.lib = bx('C library（一份）', MC.pink, 3.4, 3.0, 0, 2.8, 0.8, 0.9);
    S.lib.visible = false; S.lib.userData.lbl.visible = false;
    note('library 不會改（immutable）→ 可以 share', 1.0, 0.6);
    cap('library 只需要放一份', '它不能被修改，所以大家可以 sharing');
  },
  async (tok, S) => {                                   // 400 call printf 時才 link 過去
    S.c1 = sm('call printf', -1.6, 5.6);
    cap('要 call printf 的時候', '再 link 到 C library 的 printf function code');
  },
  async (tok, S) => {                                   // 409 第一支 call → load 進 memory
    S.lib.visible = true; S.lib.userData.lbl.visible = true; S.lib.position.y = 6.0;
    await slide(tok, S.lib, 3.4, 3.0, 0, 600); S.l1 = line(-0.6, 5.0, 2.0, 3.0, 0.3, MC.blue);
    cap('第一支程式先 call', '這時才把 library load 到 memory');
  },
  async (tok, S) => {                                   // 416 第二支：先看已經 load 了沒 → 直接用
    glow(S.lib, OKG); line(-0.6, 4.1, 2.0, 3.0, 0.3, MC.orange);
    cap('第二支程式也要 call printf', '先看 library 在不在 memory：在就直接用，不再 copy');
  },
  async (tok, S) => {                                   // 433 OS 確保只有一份
    good('整個系統只有一份 library → 沒有 duplication', 1.0, 1.4);
    cap('沒人用時當然還是要 load', 'OS 確保整個系統只有一份 library');
  },
]);

scene('mem-10c-stub', '怎麼實作：dynamic library 與 stub', CAMW, [
  async (tok, S) => {                                   // 447 實作：library 有兩種 compile 方式
    S.lib = bx('library 原始碼', MC.gray, -4.6, 5.6, 0, 2.4, 0.6, 0.8);
    cap('要真的實作', 'compile library 時有兩種方式');
  },
  async (tok, S) => {                                   // 458 dynamic library vs static library
    S.dl = bx('dynamic library', MC.pink, -6.0, 4.4, 0, 2.2, 0.6, 0.8); S.sl = bx('static library', MC.gray, -3.2, 4.4, 0, 2.2, 0.6, 0.8);
    cap('compile 成 dynamic library', '或 compile 成 static library');
  },
  async (tok, S) => {                                   // 468 Windows 的 DLL
    sm('Windows：一大堆 .dll 檔', -6.0, 3.7);
    cap('像 Windows 裡的 DLL', '那些全部都是 dynamic library');
  },
  async (tok, S) => {                                   // 478 為了效能，通常 prefer dynamic
    glow(S.dl, HL);
    cap('為了系統效能，通常 prefer dynamic', 'run time call 它，它才 load 到 memory');
  },
  async (tok, S) => {                                   // 494 compile 程式時對 linker 下 flag
    glow(S.dl, null); S.lk = buddy('linker', '', MC.teal, -0.4, 3.8, 0, 0.6);
    sm('flag：這個 library 是 dynamic 還是 static？', -0.4, 5.6);
    cap('你 compile 程式時', '要對 linker 下 flag，告訴它 library 是哪種');
  },
  async (tok, S) => {                                   // 506 static：綁在一起丟給 loader
    S.b1 = bx('binary：main + lib（大）', MC.blue, 4.2, 5.2, 0, 3.2, 0.6, 0.8);
    cap('static：全部綁在一起', '變一包丟給 loader，code 全在 binary 裡');
  },
  async (tok, S) => {                                   // 519 dynamic：library 先 compile 成 dynamic，binary 比較小
    S.b2 = bx('binary：main（小）', MC.blue, 3.6, 4.2, 0, 2.0, 0.6, 0.8);
    cap('dynamic：library 要先 compile 成 dynamic', 'binary 比較小：根本還沒 include 進去');
  },
  async (tok, S) => {                                   // 548 linker 偷加 stub
    S.stub = bx('stub', MC.orange, 6.3, 4.2, 0, 0.8, 0.6, 0.8);
    cap('linker 會幫你偷加一段程式', '一個很簡單的小程式：stub');
  },
  async (tok, S) => {                                   // 584 stub 問 OS：load 了沒？在哪？
    S.os = buddy('OS', '', MC.dark, 2.0, 0, 1.4, 0.7);
    const q = bub('library load 了嗎？在哪？', 5.0, 2.8); await wt(tok, 400); void q;
    cap('stub 是 function level 的', '它會去問 OS：有沒有 load 這個 library？在哪？');
  },
  async (tok, S) => {                                   // 603 被 call 的 library 也要 compile 不一樣
    glow(S.dl, HL);
    cap('被 call 的 library 也要修改', '所以 compile 時要說它是不是 dynamic library');
  },
  async (tok, S) => {                                   // 625 stub 問 OS → 找到位置 → link；沒有就 load
    glow(S.dl, null); S.os.mood('happy'); good('找到 → link；沒有 → 先 load 再 link', 3.6, 1.8);
    cap('stub 跟 OS 問到位置', '就做 linking；沒有就先 load 它');
  },
]);

scene('mem-10c-cmp', 'Dynamic vs static linking 的取捨', CAM, [
  async (tok, S) => {                                   // 637 最大貢獻：節省程式之間的 memory
    good('dynamic linking：省下「程式之間」的 memory', -2.6, 6.0);
    cap('最大的貢獻', '不斷節省 memory，而且是程式之間的');
  },
  async (tok, S) => {                                   // 650 programmer 只決定 dynamic 或 static library
    S.me = buddy('programmer', '', MC.pink, -4.6, 0, 1.0, 0.7);
    cap('programmer 沒辦法 control', '只能決定用 dynamic 還是 static library');
  },
  async (tok, S) => {                                   // 662 缺點：多了 stub → 執行時稍慢
    S.t1 = bx('dynamic：call → stub → 找 code', MC.pink, 2.0, 3.6, 0, 3.6, 0.6, 0.9); S.t2 = bx('static：call → code', MC.gray, 2.0, 2.6, 0, 2.4, 0.6, 0.9);
    cap('小缺點：多了 stub', 'run time 才去找，execution 會慢一點（不是很多）');
  },
  async (tok, S) => {                                   // 690 static：快、不需要 OS support
    glow(S.t2, OKG);
    cap('static 的好處', '比較快，也不需要 OS 的 support');
  },
  async (tok, S) => {                                   // 696 embedded / IoT 的 OS 可能不支援
    prop('cpu', 5.4, 0, 1.4, 0.7, 'IoT device');
    cap('embedded、IoT 的 OS 很簡單', '可能根本不 support dynamic linking');
  },
  async (tok, S) => {                                   // 720 dynamic library 可用在 dynamic linking 或 loading
    note('dynamic library：可給 dynamic linking（OS 做）或 dynamic loading（programmer 做）', 0, 0.6, 2.0);
    cap('不管 dynamic linking 或 loading', '用的 library 都叫 dynamic library，用法不同');
  },
  async (tok, S) => {                                   // 746 static library：兩件事都不能做
    bad('static library：兩件事都不能做', 0, 0.0, 2.6);
    cap('static library 沒選擇', 'dynamic linking 和 dynamic loading 都不能做');
  },
]);

scene('mem-10c-review', '前半段重點整理', CAM, [
  async (tok, S) => {                                   // 765 三種 address binding 的差別
    S.r = ['compile time', 'load time', 'execution time'].map((n, i) => bx(n, [MC.purple, MC.teal, MC.orange][i], -3.0, 5.4 - i * 1.0, 0, 2.8, 0.7, 0.9));
    cap('三種 address binding 的差別', '要很清楚');
  },
  async (tok, S) => {                                   // 774 越下面越有彈性
    hot('↓ 越有彈性：能做 run time 管理', 1.6, 3.4);
    cap('越下面越有彈性', '可以做很多 run time 的 memory management');
  },
  async (tok, S) => {                                   // 781 越上面越簡單、越快（MMU 也要時間）
    good('↑ 越簡單、跑得越快（沒有 MMU 的翻譯時間）', 1.6, 5.4);
    cap('越上面越簡單、執行越快', 'MMU 就算是 hardware 也要時間；簡單 device 會選上面');
  },
  async (tok, S) => {                                   // 804 virtual vs physical：CPU 送出 vs 送進 memory
    bx('CPU', MC.dark, -4.0, 1.0, 0, 1.2, 0.8, 0.9); bx('memory', MC.blue, 4.0, 1.0, 0, 1.6, 0.8, 0.9);
    sm('從 CPU 送出：virtual address', -1.2, 1.6); sm('送進 memory：physical address', 1.6, 0.4);
    cap('virtual vs physical address', '一個從 CPU 送出，一個送進 memory');
  },
  async (tok, S) => {                                   // 825 我們 programming against CPU
    note('寫程式只看到 virtual address', -1.2, 2.4);
    cap('We program against CPU', '我們都只是在對 virtual address 寫程式');
  },
  async (tok, S) => {                                   // 833 dynamic linking、loading 很常見
    note('裝套件：static 還是 dynamic？porting：dynamic loading', 0, 6.6);
    cap('dynamic linking、loading 很常見', '安裝套件、解 porting 問題都會碰到');
  },
]);

// ════════ bFHb-eTM7oU（第 10D 講：swapping、contiguous allocation、fragmentation、paging 入門） ════════
scene('mem-10d-swapspace', 'Swapping 與 swap space（backing store）', CAMW, [
  async (tok, S) => {                                   // 2 swapping：memory content 在 memory ↔ disk 移動
    hd('memory', -3.6, 5.4); S.mem = col(-3.6, 5.0, [['P1', 1.2, MC.blue], ['P2', 1.2, MC.orange], ['P3', 1.2, MC.purple]], 2.4);
    S.disk = prop('disk', 3.8, 0, 0, 1.6, 'disk');
    cap('swapping', 'memory content（已 load 之後）在 memory 和 disk 之間移動');
  },
  async (tok, S) => {                                   // 44 swap 到 disk 上指定的空間
    S.sp = bx('swap space', MC.lilac, 3.8, 2.6, 0, 2.6, 0.6, 1.2);
    cap('到底 swap 到 disk 哪裡？', 'disk 上 OS 專用的一塊指定空間');
  },
  async (tok, S) => {                                   // 64 灌 OS 時問 swap space 多大
    S.q = bub('要切多少給 swap space？', 3.8, 4.0);
    cap('灌過 OS 就知道', '安裝時會問你 swap space 要多少');
  },
  async (tok, S) => {                                   // 72 不夠 → out of memory
    S.oom = bad('連 swap 都用完 → out of memory', 3.8, 4.7);
    cap('swap space 不夠很快就 out of memory', 'out of memory 是連 swap 都用完，不只是實體 memory');
  },
  async (tok, S) => {                                   // 92 別名 backing store；不是檔案系統
    relabel(S.sp, 'backing store'); sm('不屬於 file system', 3.8, 1.2, 1.2);
    cap('swap space 又叫 backing store', '是還沒有檔案系統就先切出來的特殊空間');
  },
  async (tok, S) => {                                   // 116 目的：midterm scheduling，把整個 process swap 出去
    gone(S.q, S.oom); await slide(tok, S.mem.m[2], 3.8, 3.6, 0.6, 800);
    cap('目的：midterm scheduling', 'memory 不夠就挑 process 整個 swap 到 backing store');
  },
  async (tok, S) => {                                   // 133 virtual memory：以 page（4KB）為單位
    for (let i = 0; i < 3; i++) bx('4KB', MC.blue, 2.8 + i * 0.75, 0.3, 1.4, 0.65, 0.4, 0.5);
    cap('之後的 virtual memory', '不一定整個 process：可以以 page（4KB）為單位');
  },
  async (tok, S) => {                                   // 183 swap space 不是 user 檔案 → OS 直接管
    note('裡面是一堆 page，不是 user 檔案 → OS 直接管理', 3.8, 6.0);
    cap('swap space 不是檔案', '不交給 file system，由 OS 直接管理');
  },
  async (tok, S) => {                                   // 205 為什麼要 swap：free memory（dynamic allocation 會長）
    good('free 出 memory', -3.6, 1.0);
    cap('為什麼要 swapping？', '要 free out memory：dynamic allocate 會一直長');
  },
  async (tok, S) => {                                   // 221 不重要的先 swap 出去，讓執行中的有空間
    glow(S.mem.m[0], OKG); glow(S.mem.m[1], OKG);
    cap('有些 process 比較不重要、要等很久', '先 swap 到 disk，讓正在執行的有更多 memory');
  },
]);

scene('mem-10d-bind', 'Swapping 要配合 execution-time binding', CAMW, [
  async (tok, S) => {                                   // 243 swap 跟 binding 的關聯
    hd('memory', -2.4, 6.6); S.mem = col(-2.4, 6.2, [['OS', 1.0, MC.dark], ['P1', 1.4, MC.blue], ['', 1.4, MC.paper], ['P2', 1.4, MC.orange]], 2.4);
    S.disk = prop('disk', 4.4, 0, 0, 1.2, 'backing store');
    cap('swapping 跟 address binding 的關係', '');
  },
  async (tok, S) => {                                   // 255 compile / load time：必須 swap 回原位置
    await slide(tok, S.mem.m[1], 4.4, 2.2, 0.4, 700); sm('原位置', -0.6, 4.5);
    cap('compile / load time binding', 'swap 出去後，必須 swap 回「原來的位置」');
  },
  async (tok, S) => {                                   // 278 原位置給了別人 → 要等
    S.o = bx('P3（重要）', MC.purple, -2.4, 4.5, 0.1, 2.3, 1.3, 0.9);
    cap('你離開的空間會給別人用', '要回來，前面那個人得先離開');
  },
  async (tok, S) => {                                   // 294 重要的人一直佔著 → 永遠回不去
    bad('P1：永遠等不到原位置', 4.4, 4.0);
    cap('把你踢掉的可能更重要', '它一直站在那，你就永遠回不去');
  },
  async (tok, S) => {                                   // 307 execution time：MMU base register → 可以回不同位置
    await slide(tok, S.mem.m[1], -2.4, 3.1, 0.1, 800); sm('換個空位，改 base 就好', 0.6, 3.1);
    cap('execution time binding', 'MMU、base register 在 runtime 決定：可以回不同位置');
  },
  async (tok, S) => {                                   // 335 swapping 要跟 execution-time binding 一起用
    good('swapping + execution-time binding 才有效', -0.6, 0.3);
    cap('swapping 一定要配合', 'execution time binding 才有效果');
  },
]);

scene('mem-10d-io', '只有 idle 的 process 能 swap：I/O 與 OS buffer', CAMW, [
  async (tok, S) => {                                   // 345 swap 時 OS 要檢查
    S.p = bx('P1 的 memory', MC.blue, -1.0, 3.0, 0, 2.4, 1.6, 1.0);
    cap('一個重要觀念', 'process 被 swap 前，OS 必須先檢查');
  },
  async (tok, S) => {                                   // 371 必須是 idle
    hot('能 swap 嗎？必須是 idle', -1.0, 4.4);
    cap('process 不是隨時都能 swap', '必須是所謂的 idle');
  },
  async (tok, S) => {                                   // 382 idle：不能在做 I/O
    note('idle：不只不用 CPU，也不能在做 I/O', -1.0, 5.0);
    cap('idle 的意思', '它不能在做 I/O');
  },
  async (tok, S) => {                                   // 395 CPU time 跟 I/O time overlap
    S.cpu = prop('cpu', -5.4, 0, 0, 1.0, 'CPU');
    cap('還記得嗎？OS 的設計', '讓 CPU time 跟 I/O time overlap');
  },
  async (tok, S) => {                                   // 403 waiting queue：I/O device 透過 memory bus 寫它的 memory
    S.dev = prop('disk', 4.6, 0, 0, 1.0, 'I/O device');
    S.d = pkt('I/O data', MC.orange, 4.6, 2.3); await slide(tok, S.d, 1.6, 3.0, 0.6, 800);
    cap('在 waiting queue 時雖然不用 CPU', 'I/O device 正用 memory bus 把資料寫進它的 memory');
  },
  async (tok, S) => {                                   // 422 這時 swap → 寫錯地方
    await slide(tok, S.p, -1.0, 3.0, -3.0, 600); tint(S.d, MC.red); S.bd = bad('swap 走了 → I/O 寫錯地方！', 0.2, 1.4);
    cap('做 I/O 時把它 swap 掉就完了', 'I/O 會寫錯或沒地方寫');
  },
  async (tok, S) => {                                   // 459 I/O 的 waiting queue 不行，sleep 可以
    await slide(tok, S.p, -1.0, 3.0, 0, 500); gone(S.d, S.bd);
    sm('sleep 的 waiting queue：可以 swap', -4.0, 6.0); sm('I/O 的 waiting queue：不行', 2.4, 6.0);
    cap('在 I/O 的 waiting queue 不行', 'sleep 的 waiting queue 是 OK 的');
  },
  async (tok, S) => {                                   // 491 solution 1：做 I/O 設 flag，不 swap
    hot('解法一：做 I/O 時設 flag，不 swap（等它做完）', 0, 7.0);
    cap('解法一：比較強硬', 'I/O 之前設一個 flag，OS 就等它做完再 swap');
  },
  async (tok, S) => {                                   // 508 solution 2：OS buffer
    S.buf = bx('OS buffer', MC.dark, 2.4, 0.6, 0, 1.8, 0.8, 1.0);
    cap('解法二（比較常用）', 'I/O 是透過 OS 做：OS 有自己的 buffer');
  },
  async (tok, S) => {                                   // 527 資料先寫 OS buffer → 程式可以 swap
    const d = pkt('I/O data', MC.orange, 4.6, 2.3); await slide(tok, d, 2.4, 1.4, 0.6, 600);
    await slide(tok, S.p, -1.0, 3.0, -3.0, 600); S.d2 = d;
    cap('資料先搬到 OS 的 memory', '程式的 memory 沒被碰到，就可以被 swap 掉');
  },
  async (tok, S) => {                                   // 545 swap 回來再 copy 到 user memory
    await slide(tok, S.p, -1.0, 3.0, 0, 500); await slide(tok, S.d2, 1.6, 3.0, 0.6, 600);
    cap('I/O 做完、程式 swap 回來', '再把 OS buffer 的內容 copy 到程式的 memory');
  },
  async (tok, S) => {                                   // 557 這就是 buffering
    good('buffering：比較常用的解法', 2.4, 2.4);
    cap('這就是所謂的 buffering', 'OS 一定在 memory，不會被 swap');
  },
]);

scene('mem-10d-time', 'Swapping 的時間', CAMW, [
  async (tok, S) => {                                   // 613 swapping 時間很重要：disk 很慢
    S.mem = bx('memory', MC.blue, -4.0, 1.0, 0, 2.0, 1.6, 1.0); S.disk = prop('disk', 4.0, 0, 0, 1.2, 'disk');
    sm('memory 比 disk 快至少 100 倍', 0, 3.0);
    cap('swapping 時間很重要', 'disk 很慢；memory 至少快 100 倍');
  },
  async (tok, S) => {                                   // 630 跟 size 成正比：4GB 就搬 4GB
    const p = bx('4GB process', MC.orange, -4.0, 2.4, 0.6, 2.0, 0.6, 0.8); await slide(tok, p, 4.0, 2.4, 0.6, 2000);
    cap('時間跟 size 成正比', '一次 swap 整個 4GB 的 process，就要搬 4GB');
  },
  async (tok, S) => {                                   // 651 搬越少越好，不要搬錯人
    bad('P1 剛搬走又要用 → 又搬回來', 0, 4.4);
    cap('搬的資料越少越好', '還有不要搬錯人：剛搬走馬上又要用就慘了');
  },
  async (tok, S) => {                                   // 666 第九章：一次只搬 4KB page + 演算法
    good('第九章 virtual memory：一次只搬一個 4KB page，演算法決定搬誰', 0, 5.2);
    cap('第九章 virtual memory 的主題', '只搬小 page，用 algorithm minimize swap 次數');
  },
]);

scene('mem-10d-part', 'Contiguous allocation：fixed vs variable partition', CAMW, [
  async (tok, S) => {                                   // 700 重點：allocation，先只看 memory
    hd('memory', 0, 6.7);
    cap('進入這章的重點：allocation', '先把 disk 丟一邊，只看 memory 怎麼分配');
  },
  async (tok, S) => {                                   // 717 contiguous：連續
    S.bar = bx('', MC.paper, 0, 5.6, 0, 10, 0.6, 1.0);
    cap('第一種：contiguous', '就是給你一塊連續的空間');
  },
  async (tok, S) => {                                   // 730 discontiguous 等一下講
    S.dc = sm('（discontiguous：不連續，等一下講，比較難）', 0, 4.9);
    cap('難的是 discontiguous', '先看連續的就好');
  },
  async (tok, S) => {                                   // 738 連續比較符合 programming 概念
    S.cn = note('code、heap、stack：我們畫圖都畫成連續的', 0, 4.3);
    cap('連續比較符合 programming 的概念', '');
  },
  async (tok, S) => {                                   // 769 fixed partition
    gone(S.bar, S.dc, S.cn); S.slots = [];
    for (let i = 0; i < 5; i++) S.slots.push(bx('', MC.paper, -4.4 + i * 2.2, 3.0, 0, 2.0, 0.3, 1.0));
    hd('fixed partition', -6.0, 3.8);
    cap('第一種分配：fixed partition', '先把 physical memory 切成固定大小');
  },
  async (tok, S) => {                                   // 787 像停車格
    S.gl = S.slots.map((s, i) => sm('格 ' + (i + 1), -4.4 + i * 2.2, 2.5));
    cap('就像規劃停車場', '切成一格一格相同大小的停車格');
  },
  async (tok, S) => {                                   // 813 一車一格；格數 = degree of multiprogramming
    S.cars = [1.6, 1.0, 1.9].map((w, i) => bx('P' + (i + 1), [MC.blue, MC.orange, MC.purple][i], -4.4 + i * 2.2, 3.4, 0, w, 0.6, 0.8));
    good('5 格 = 最多 5 個 process（degree of multiprogramming）', 0, 4.8);
    cap('一台車只能停一格', '格數就是 degree of multiprogramming；管理很單純');
  },
  async (tok, S) => {                                   // 838 小機車只用 1/4 格 → 浪費
    glow(S.cars[1], NG); bad('只用一小部分，整格被佔住', -2.2, 1.9);
    cap('問題：小機車只用四分之一格', '還可以停兩三台，很浪費');
  },
  async (tok, S) => {                                   // 865 variable size partition
    gone(S.slots, S.cars, S.gl); S.v = [];
    let x = -5.6; [[1.6, 'P1', MC.blue], [1.0, 'P2', MC.orange], [1.9, 'P3', MC.purple], [1.2, 'P4', MC.green]].forEach(([w, n, c]) => { S.v.push(bx(n, c, x + w / 2, 1.0, 0, w - 0.05, 0.6, 0.9)); x += w; });
    hd('variable size partition', -6.0, 1.8);
    cap('variable size partition', '你要多少，我就切多少給你');
  },
  async (tok, S) => {                                   // 896 會有洞
    gone(S.v[1]); S.h1 = bx('hole', '#fff7e8', -5.6 + 1.6 + 0.5, 0.75, 0, 0.95, 0.1, 0.9);
    cap('這樣用就會有一些洞（hole）', '就像大家亂停車');
  },
  async (tok, S) => {                                   // 938 為什麼有洞：process join / leave
    gone(S.v[3]); bx('hole', '#fff7e8', -5.6 + 4.5 + 0.6, 0.75, 0, 1.15, 0.1, 0.9);
    cap('process 大小不同、會進來又離開', '離開後就產生洞，而且在 run time 不斷變化');
  },
  async (tok, S) => {                                   // 965 有好幾個洞時塞哪個？
    S.nw = bx('新 process', MC.teal, 0, 2.8, 0, 0.9, 0.6, 0.8);
    bub('塞哪一個洞？', 0, 3.8);
    cap('一個大洞、一個小洞都塞得下', '那要塞哪裡？');
  },
]);

scene('mem-10d-fit', 'First fit、Best fit、Worst fit', CAMW, [
  async (tok, S) => {                                   // 993 三種 basic 演算法
    S.H = [30, 70, 40, 90];
    S.rows = [['First fit', 4.6], ['Best fit', 2.8], ['Worst fit', 1.0]].map(([n, y]) => {
      hd(n, -6.2, y + 0.55); let x = -5.4; const hs = [];
      bx('', MC.dark, x + 0.15, y, 0, 0.3, 0.7, 0.8); x += 0.3;
      S.H.forEach((h) => { const w = h * 0.045; hs.push({ x0: x, w, h, m: bx(h + 'K', MC.paper, x + w / 2, y - 0.25, 0, w - 0.05, 0.2, 0.8) }); x += w; bx('', MC.dark, x + 0.15, y, 0, 0.3, 0.7, 0.8); x += 0.3; });
      return { y, hs };
    });
    sm('hole 大小與請求 35K 皆為示意（老師沒給數字）', 0, 0.0);
    S.req = bx('要 35K', MC.teal, 5.6, 6.2, 0, 1.6, 0.6, 0.8);
    cap('最直覺的三個演算法', 'first fit、best fit、worst fit');
  },
  async (tok, S) => {                                   // 998 first fit：從頭找第一個塞得下的
    const r = S.rows[0]; glow(r.hs[0].m, NG); await wt(tok, 300); glow(r.hs[0].m, null); glow(r.hs[1].m, OKG);
    const h = r.hs[1]; bx('35K', MC.teal, h.x0 + 35 * 0.045 / 2, r.y, 0.1, 35 * 0.045 - 0.05, 0.6, 0.8); sm('剩 35K', h.x0 + h.w - 0.4, r.y - 0.65);
    cap('first fit：從頭找，第一個塞得下就停', '30K 不夠，70K 夠 → 放進去，剩 35K');
  },
  async (tok, S) => {                                   // 1010 best fit：全部找過，挑最剛好的
    const r = S.rows[1]; r.hs.forEach((h) => glow(h.m, h.h >= 35 ? DIMG : null)); await wt(tok, 400); r.hs.forEach((h) => glow(h.m, null)); glow(r.hs[2].m, OKG);
    const h = r.hs[2]; bx('35K', MC.teal, h.x0 + 35 * 0.045 / 2, r.y, 0.1, 35 * 0.045 - 0.05, 0.6, 0.8); relabel(h.m, ''); sm('剩 5K', h.x0 + h.w - 0.1, r.y - 0.65);
    cap('best fit：全部找過一遍', '挑最 match 的 40K → 剩 5K');
  },
  async (tok, S) => {                                   // 1033 剩下的更小，很難再用
    bad('剩 5K：小到很難再給別人用', 1.6, 3.4);
    cap('出發點好，結果不一定好', '剩下的空間通常更小，反而浪費');
  },
  async (tok, S) => {                                   // 1053 worst fit：找最大的洞
    const r = S.rows[2]; glow(r.hs[3].m, OKG);
    const h = r.hs[3]; bx('35K', MC.teal, h.x0 + 35 * 0.045 / 2, r.y, 0.1, 35 * 0.045 - 0.05, 0.6, 0.8); sm('剩 55K', h.x0 + h.w - 0.6, r.y - 0.65);
    cap('worst fit：倒過來', '不跟人家爭，挑最大的洞 90K');
  },
  async (tok, S) => {                                   // 1067 剩下的還很大，別人可以用
    good('剩 55K：還夠別人用', 3.6, 1.6);
    cap('想法：大洞用掉一部分', '剩下的還很大，別人還能用');
  },
  async (tok, S) => {                                   // 1087 考試：模擬擺放
    note('考試：照規則模擬誰進來、誰離開', 0.4, 6.2);
    cap('考試可能會問', '用這三個規則模擬擺放；課本有習題');
  },
  async (tok, S) => {                                   // 1109 哪個好？較多人用 first fit
    hot('實際上：比較多人用 first fit', 4.6, 5.4);
    cap('到底哪個好？', '都是 heuristic，結果不確定；比較多人用 first fit');
  },
  async (tok, S) => {                                   // 1125 first fit 的 average case 最快
    glow(S.rows[0].hs[1].m, HL);
    cap('確定的是 first fit 的 complexity', 'average case 最好：找到第一個洞就結束');
  },
  async (tok, S) => {                                   // 1145 best / worst 要全部掃過
    glow(S.rows[1].hs[2].m, DIMG); glow(S.rows[2].hs[3].m, DIMG);
    cap('best fit 和 worst fit 要全部掃過', '效能又沒保證比較好 → 實作多用 first fit');
  },
]);

scene('mem-10d-frag', 'External vs internal fragmentation', CAMW, [
  async (tok, S) => {                                   // 1165 問題：空間浪費
    hd('variable size', -3.4, 6.6); hd('fixed partition', 3.6, 6.6);
    S.v = col(-3.4, 6.2, [['P1', 1.2, MC.blue], ['hole', 0.6, '#fff7e8'], ['P2', 1.2, MC.orange], ['hole', 0.7, '#fff7e8'], ['P3', 1.0, MC.purple], ['hole', 0.5, '#fff7e8']], 2.2);
    S.f = [0, 1, 2].map((i) => bx('', MC.paper, 3.6, 5.6 - i * 1.6, 0, 2.2, 1.5, 0.9));
    cap('兩種 allocation 的最大問題', '可能造成空間的浪費');
  },
  async (tok, S) => {                                   // 1179 fragmentation：零碎的空間
    S.fg = hot('fragmentation：零碎的空間', 0, 0.2);
    cap('專有名詞：fragmentation', '一定要記住：零碎的空間');
  },
  async (tok, S) => {                                   // 1192 分 external、internal
    S.ex = sm('external ?', -3.4, 7.0); sm('internal ?', 3.6, 7.0);
    cap('分成 external 跟 internal', '');
  },
  async (tok, S) => {                                   // 1197 external：在程式外（P1、P2 中間）
    glow(S.v.m[1], NG); glow(S.v.m[3], NG); glow(S.v.m[5], NG);
    gone(S.fg); hd('external：洞在 process 之間', -3.4, 0.45);
    cap('external：在程式外', '洞在 P1 跟 P2 的中間');
  },
  async (tok, S) => {                                   // 1210 有程式要跑，卻塞不進任何洞
    S.n = bx('P4', MC.teal, -6.2, 4.0, 0.4, 1.0, 1.4, 0.8); tint(S.n, MC.red);
    cap('有程式要執行，卻塞不進任何一個洞', '洞明明空著卻不能用 → external fragmentation');
  },
  async (tok, S) => {                                   // 1237 只在 variable size 發生
    sm('只在 variable size 發生', -3.4, -0.2);
    cap('只在 variable size 發生', 'fixed size 切好格子，來一個一定找得到位置');
  },
  async (tok, S) => {                                   // 1267 internal：fixed partition 時
    S.ps = [1.0, 0.6, 1.3].map((h, i) => bx('P' + (i + 5), [MC.blue, MC.orange, MC.purple][i], 3.6, 5.6 - i * 1.6 + 0.75 - h / 2, 0.1, 2.15, h, 0.9));
    cap('internal：右邊 fixed partition', '每個 process 要的空間不一樣');
  },
  async (tok, S) => {                                   // 1287 給很大的空間 → 裡面沒用到的浪費
    S.f.forEach((f) => glow(f, NG)); hd('internal：配出去的區塊裡面沒用到', 3.6, 0.45);
    cap('給它一整格，裡面沒用到的就浪費', '像重型機車佔一格：internal fragmentation');
  },
  async (tok, S) => {                                   // 1311 internal：把車位切小 → paging
    sm('解法：格子切小 → paging', 3.6, -0.2);
    cap('internal 沒什麼好解法', '唯一辦法是把車位切更小：下次的 paging');
  },
  async (tok, S) => {                                   // 1343 variable size：compaction
    gone(S.ex); hot('external 的解法：compaction', -3.4, 7.4);
    cap('variable size 的解法', 'compaction：壓縮');
  },
  async (tok, S) => {                                   // 1358 定期清理，把洞合起來
    gone(S.v.m[1], S.v.m[3], S.v.m[5]);
    await slide(tok, S.v.m[2], -3.4, 6.2 - 1.2 - 0.6, 0, 500); await slide(tok, S.v.m[4], -3.4, 6.2 - 2.4 - 0.5, 0, 500);
    const big = bx('一個大 hole', '#fff7e8', -3.4, 6.2 - 3.4 - 0.9, 0, 2.2, 1.75, 0.9);
    await slide(tok, S.n, -3.4, 6.2 - 3.4 - 0.75, 0.4, 600); tint(S.n, MC.teal); relabel(big, '');
    cap('定期清理 memory', '把洞清到一起，P4 就放得下了');
  },
  async (tok, S) => {                                   // 1370 disk 也常見（清理硬碟）
    prop('disk', 0.2, 2.2, 1.0, 0.7, '磁碟重組');
    cap('compaction 在 disk 上更常見', '「清理硬碟」就是在做 compaction');
  },
  async (tok, S) => {                                   // 1401 memory 會先切成小 page → 不嚴重
    note('memory 會先切成小 page → 不太有這問題', 0.2, -0.95, 2.0);
    cap('memory 也有同樣現象', '但會先切成很小的 page，除非用最傳統的 variable size');
  },
]);

scene('mem-10d-paging', 'Paging：page、frame 與 page table', CAMW, [
  async (tok, S) => {                                   // 1429 paging
    hd('paging', 0, 6.8);
    cap('接下來講一點 paging', '跟剛剛的差別是？');
  },
  async (tok, S) => {                                   // 1436 non-contiguous：一個程式的空間本身不連續
    S.c1 = sm('剛才：contiguous　→　現在：non-contiguous', 0, 6.2);
    cap('剛才都是 contiguous', 'non-contiguous：單一程式的 memory 本身就不連續');
  },
  async (tok, S) => {                                   // 1456 fixed size 的 non-contiguous = paging
    note('variable size 的不連續 → segmentation；fixed size 的不連續 → paging', 0, 5.6);
    cap('也分成兩種', 'fixed size 的 non-contiguous 就是 paging');
  },
  async (tok, S) => {                                   // 1482 logical 跟 physical 都切
    hd('logical', -4.6, 5.0); hd('physical', 3.4, 5.0);
    S.L = col(-4.6, 4.6, [['', 4.0, MC.blue]], 1.8); S.Pm = col(3.4, 4.6, [['', 4.4, MC.paper]], 1.8);
    cap('有 logical 跟 physical address', '想要不連續：兩邊都各自做 partition');
  },
  async (tok, S) => {                                   // 1512 physical 切出來的：frame
    gone(S.Pm.m); S.fr = []; for (let i = 0; i < 8; i++) { const f = bx('frame ' + i, MC.paper, 3.4, 4.32 - i * 0.55, 0, 1.8, 0.5, 0.8); f.userData.lbl.position.x = -1.75; S.fr.push(f); }
    cap('physical 切出來的一格一格', '叫做 frame：像車位一樣的空間');
  },
  async (tok, S) => {                                   // 1521 logical 切出來的：page
    gone(S.L.m); S.pg = []; for (let i = 0; i < 4; i++) S.pg.push(bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -4.6, 4.32 - i * 0.55, 0, 1.8, 0.5, 0.8));
    cap('logical 切出來的叫 page', '你的程式就是一堆 page');
  },
  async (tok, S) => {                                   // 1540 不能互換；size 完全相同
    S.fp = hot('frame = physical　page = logical　（大小完全相同）', 0, -0.3);
    cap('frame 和 page 不能互換', '但兩個的 size 完全相同，才能 mapping');
  },
  async (tok, S) => {                                   // 1576 程式大小 → 幾個 page → 找相同數量的 frame
    sm('4 個 page → 要找 4 個 frame', -4.6, 1.6);
    cap('程式多大就變成幾個 page', '目的是找到相同數量的 frame 擺進去');
  },
  async (tok, S) => {                                   // 1598 OS 要知道哪些 frame 是 free
    [0, 2, 5, 6].forEach((i) => tint(S.fr[i], MC.gray)); sm('灰色：已被別人用', 5.4, 0.6);
    cap('OS 要做的第一件事', '知道哪些 frame 是 free 的');
  },
  async (tok, S) => {                                   // 1609 page table：page number ↔ frame number
    S.pt = tbl(-1.0, 4.32, [1, 4, 3, 7], { dy: 0.55, title: 'page table' });
    cap('第二件、也是本章重點：page table', 'page number ↔ frame number 的 mapping，就是個 array');
  },
  async (tok, S) => {                                   // 1642 好處 1：non-contiguous，使用者以為連續
    const F = [1, 4, 3, 7];
    for (let i = 0; i < 4; i++) { const m = bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -4.6, 4.32 - i * 0.55, 0.5, 1.6, 0.45, 0.5); await slide(tok, m, 3.4, 4.32 - F[i] * 0.55, 0.5, 400); }
    cap('好處一：physical 可以不連續地分配', '使用者看到連續的空間，實際散落在不同 frame');
  },
  async (tok, S) => {                                   // 1670 好處 2：沒有 external；internal 可減少
    gone(S.fp); good('fixed size：沒有 external fragmentation', 0, -0.3);
    cap('好處二：page 是 fixed size', '完全沒有 external；internal 可以靠切小來減少（有 tradeoff）');
  },
  async (tok, S) => {                                   // 1707 好處 3：share memory
    good('share：page table 指到同一個 frame', 0, -1.0);
    cap('好處三、非常重要：share memory', 'dynamic linking 的 shared library 就是這樣做到的');
  },
  async (tok, S) => {                                   // 1740 切割 → fine-grained sharing
    gone(S.c1); sm('只 share code section、某個 function 所在的 page', 0, 6.2, 1.0);
    cap('為什麼要切成 page？', '只 share 需要的一小部分：fine-grained sharing');
  },
]);

scene('mem-10d-pt', 'Page table 圖例：1、4、3、7', CAMW, [
  async (tok, S) => {                                   // 1768 logical memory
    hd('logical memory', -5.0, 6.4);
    S.pg = [0, 1, 2, 3].map((i) => bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -5.0, 5.6 - i * 0.8, 0, 1.8, 0.7, 0.8));
    cap('一張圖就一目瞭然', '左邊是你的 program：logical memory space');
  },
  async (tok, S) => {                                   // 1781 右邊 physical frames
    hd('physical memory', 4.4, 6.6);
    S.fr = []; for (let f = 0; f < 8; f++) { S.fr.push(bx('', MC.paper, 4.4, 6.0 - f * 0.72, 0, 1.8, 0.62, 0.8)); sm('frame ' + f, 6.0, 6.0 - f * 0.72); }
    cap('右邊是 physical：一格一格 frame', '大小都一模一樣');
  },
  async (tok, S) => {                                   // 1792 page 0 → frame 1
    S.pt = tbl(-1.2, 5.6, ['', '', '', ''], { dy: 0.8, title: 'page table' });
    relabel(S.pt.cells[0], '1'); const m = bx('page 0', MC.blue, -5.0, 5.6, 0.5, 1.6, 0.55, 0.5); await slide(tok, m, 4.4, 6.0 - 0.72, 0.5, 600);
    cap('page 0 放在 frame 1', '');
  },
  async (tok, S) => {                                   // 1797 page 1 → frame 4；0…3 → 1、4、3、7
    const F = [1, 4, 3, 7];
    for (let i = 1; i < 4; i++) { relabel(S.pt.cells[i], String(F[i])); const m = bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -5.0, 5.6 - i * 0.8, 0.5, 1.6, 0.55, 0.5); await slide(tok, m, 4.4, 6.0 - F[i] * 0.72, 0.5, 450); }
    cap('page 1 放在 frame 4……隨便亂放', 'page table 記 0→1、1→4、2→3、3→7');
  },
  async (tok, S) => {                                   // 1813 這就是 page table
    S.pt.cells.forEach((c) => glow(c, HL));
    cap('這就是 page table', '靠它做 discontinuous allocation');
  },
  async (tok, S) => {                                   // 1824 OS allocate & maintain，使用者不能碰
    S.pt.cells.forEach((c) => glow(c, null)); sm('OS allocate、maintain；使用者碰不到（像 PCB）', -1.2, 1.9);
    cap('page table 是另一個 data structure', 'OS 去 allocate、maintain，使用者不能 touch');
  },
  async (tok, S) => {                                   // 1844 每個 process 有自己的 page table
    S.pt2 = tbl(1.4, 5.6, [2, '…'], { dy: 0.8, title: '另一支程式', c: MC.lilac });
    cap('每個 process 有自己的 page table', '另一支程式的 page 0 可能對到 frame 2');
  },
  async (tok, S) => {                                   // 1863 sharing：frame number 寫一樣
    relabel(S.pt2.cells[1], '4'); glow(S.pt2.cells[1], OKG); glow(S.pt.cells[1], OKG); glow(S.fr[4], OKG);
    sm('frame number 寫一樣 → share（示意）', 1.4, 3.6);
    cap('要 sharing 也很簡單', '只要裡面的 pointer（frame number）寫得一樣');
  },
  async (tok, S) => {                                   // 1873 protection：沒寫到別人的 frame 就碰不到
    glow(S.pt2.cells[1], null); glow(S.pt.cells[1], null); glow(S.fr[4], null);
    [1, 4, 3, 7].forEach((f) => glow(S.fr[f], OKG)); glow(S.fr[5], NG); sm('別人的 frame 5', 2.6, 6.0 - 5 * 0.72);
    cap('protection 也靠它', '表裡只有 1、4、3、7：MMU 根本指不到 frame 5');
  },
  async (tok, S) => {                                   // 1913 下次：byte address 的 translation
    note('下次：page 第幾個 byte → frame 第幾個 byte', -1.2, 0.6);
    cap('後面的 translation 下次講', 'program 用的是 byte address，不只是 page ↔ frame');
  },
]);

// ════════ p7C-ObHrCP8（第 11A 講：paging 的 address translation、page size） ════════
scene('mem-11a-recap', 'Paging 複習：兩邊都切、page table 做 mapping', CAMW, [
  async (tok, S) => {                                   // 14 page table；discontiguous allocation，不要 hole
    hd('今天的重點：page table', 0, 6.8);
    cap('為了增加 memory 使用率', 'discontiguous allocation：有空間就能用，不要 hole');
  },
  async (tok, S) => {                                   // 43 fixed：logical、physical 都切成一樣大
    hd('logical（program）', -5.0, 6.0); hd('physical', 4.4, 6.0);
    S.pg = [0, 1, 2, 3].map((i) => bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -5.0, 5.2 - i * 0.7, 0, 1.8, 0.6, 0.8));
    S.fr = []; for (let f = 0; f < 8; f++) { S.fr.push(bx('', MC.paper, 4.4, 5.3 - f * 0.65, 0, 1.8, 0.56, 0.8)); sm('frame ' + f, 6.0, 5.3 - f * 0.65); }
    cap('paging 是 fixed 的一種', 'logical、physical 兩邊都切成完全一樣大的 partition');
  },
  async (tok, S) => {                                   // 66 每個 program 的 page 數不同，會長
    S.pg.push(bx('page 4…', MC.gray, -5.0, 5.2 - 4 * 0.7, 0, 1.8, 0.6, 0.8));
    cap('每個 program 的 page 數不同', 'depends on 程式多大，而且會一直長');
  },
  async (tok, S) => {                                   // 78 兩邊都切 → 任意 mapping → page table
    gone(S.pg[4]); S.pt = tbl(-0.6, 5.2, [1, 4, 3, 7], { dy: 0.7, title: 'page table' });
    cap('兩邊都切，才能任意 mapping', '要一個 table 存這個關係：page table');
  },
  async (tok, S) => {                                   // 101 page → table → frame（1、4、3、7）
    const F = [1, 4, 3, 7];
    for (let i = 0; i < 4; i++) { glow(S.pt.cells[i], HL); const m = bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -5.0, 5.2 - i * 0.7, 0.5, 1.6, 0.45, 0.5); await slide(tok, m, 4.4, 5.3 - F[i] * 0.65, 0.5, 350); glow(S.pt.cells[i], null); }
    cap('一個 page 查 table', '就知道它在 physical 的哪個 frame：1、4、3、7');
  },
  async (tok, S) => {                                   // 123 實作上存 frame 的 base address
    S.pt.cells.forEach((c, i) => relabel(c, 'frame ' + [1, 4, 3, 7][i] + ' 起點')); S.pt.idx.forEach((l) => { l.position.x -= 0.9; });
    cap('概念上寫 frame number', '實作上存的是 frame 的 base address（起始位置）');
  },
  async (tok, S) => {                                   // 150 每個 process 一張，OS maintain 很多張
    sm('每個 process 一張 → OS 要 maintain 很多張', -0.6, 1.8);
    cap('每個 process 有自己的 page table', 'OS 要 maintain 非常多張');
  },
  async (tok, S) => {                                   // 160 loader：create PCB、page table、allocate memory
    S.ld = buddy('loader', '', MC.teal, -3.0, 0, 1.6, 0.6);
    note('create PCB → create page table → allocate frame → 放進 ready queue', 0, 0.5, 2.2);
    cap('process load 進 memory 時', 'loader 要 create PCB、page table，allocate memory');
  },
]);

scene('mem-11a-pd', 'Logical address = page number p | offset d', CAMW, [
  async (tok, S) => {                                   // 197 完整的 address translation
    hd('完整的 address translation', 0, 6.8);
    cap('進入重點', '怎麼做完整的 address translation？');
  },
  async (tok, S) => {                                   // 204 byte addressing
    S.row = []; for (let i = 0; i < 12; i++) S.row.push(bx('', MC.paper, -5.5 + i * 0.6, 5.6, 0, 0.55, 0.5, 0.6));
    S.ptr = hot('一個 address 指到一個 byte', -5.5, 6.3);
    cap('CPU access memory 是 byte addressing', '每個 address 指到一個 byte，像門牌號碼');
  },
  async (tok, S) => {                                   // 248 不是所有系統都是（4-byte addressing）
    S.ad = sm('有些系統：一個 address = 4 bytes', 2.4, 4.9);
    cap('不是所有系統都這樣', '有些設計是 4-byte addressing；沒特別說就是 byte');
  },
  async (tok, S) => {                                   // 267 logical address 切成兩部分
    S.a = bx('logical address（一串 bit）', MC.gray, 0, 3.8, 0, 8.0, 0.7, 1.0);
    cap('program 拿到的 logical address', '是一串 bit，我們把它切成兩部分');
  },
  async (tok, S) => {                                   // 291 前面：page number p
    gone(S.a); S.p = bx('p：page number', MC.blue, -2.0, 3.8, 0, 4.0, 0.7, 1.0);
    cap('前面幾個 bit：page number', '在我程式裡的第幾個 page');
  },
  async (tok, S) => {                                   // 312 後面：offset d
    S.d = bx('d：page offset', MC.orange, 2.0, 3.8, 0, 4.0, 0.7, 1.0);
    cap('後面的 bit：offset', '在這個 page 裡面的相對位置');
  },
  async (tok, S) => {                                   // 337 p 拿去 lookup page table → frame
    S.pt = tbl(-2.0, 2.4, ['f', 'f', 'f'], { dy: 0.55 }); glow(S.pt.cells[1], HL);
    cap('p 的目的', '拿去 look up page table，找到第幾個 frame');
  },
  async (tok, S) => {                                   // 360 page number 10 bits → 最多 2¹⁰ pages
    gone(S.pt.cells, S.pt.idx); relabel(S.p, 'p：10 bits'); hd('最多 2¹⁰ = 1024 個 page', -2.0, 2.8);
    cap('bit 長度的意義', 'page number 10 bits → 程式最多 2¹⁰ 個 page');
  },
  async (tok, S) => {                                   // 385 page 4KB × 2¹⁰ → 程式最多 4MB
    relabel(S.d, 'd：12 bits（4KB）'); good('2¹⁰ pages × 4KB = 2²² = 4 MB', 0, 2.0);
    cap('page 4KB、page number 10 bits', '程式最多只能用 2¹⁰ × 4KB = 4MB');
  },
  async (tok, S) => {                                   // 414 32-bit computer → 程式最多 4GB
    hot('32-bit address → 2³² = 4 GB', 0, 1.2);
    cap('早期 32-bit 電腦', '程式最多只能 allocate 4GB：受限在這裡');
  },
  async (tok, S) => {                                   // 431 32 → 64 bit：硬體全部要改
    sm('32 → 64 bit：所有 address、hardware 都要改', 0, 0.6);
    cap('從 32 bit 換到 64 bit', '所有 address 和 hardware 都要修改，很麻煩');
  },
  async (tok, S) => {                                   // 458 offset n bits → page size 2ⁿ
    glow(S.d, HL); S.on = sm('offset 有 n bits → page size = 2ⁿ', 2.0, 4.5);
    cap('page offset 的 bit 數', 'n bits 能描述的最大值，就是 page 的 size：2ⁿ');
  },
  async (tok, S) => {                                   // 486 4KB = 2¹² → offset 12 bits
    glow(S.d, null); gone(S.ad, S.on); good('page 4KB = 2¹² → offset 一定是 12 bits', 2.0, 4.6);
    cap('page size 4KB = 2¹²', 'address 裡必須留 12 個 bit 給 offset');
  },
]);

scene('mem-11a-xlate', 'Address translation：p 換成 frame，d 照抄', CAMW, [
  async (tok, S) => {                                   // 518 p + d = logical address
    S.p = bx('p', MC.blue, -5.0, 5.8, 0, 1.6, 0.6, 0.8); S.d = bx('d', MC.orange, -3.4, 5.8, 0, 1.6, 0.6, 0.8); hd('logical', -4.2, 6.5);
    cap('p 跟 d 加起來', '就是 logical 的 address');
  },
  async (tok, S) => {                                   // 525 physical：p 找 frame，frame base 寫前面
    S.pt = tbl(-0.4, 5.8, ['', '', 'f', ''], { dy: 0.6, title: 'page table' }); glow(S.pt.cells[2], HL);
    S.f = bx('f', MC.green, 3.4, 5.8, 0, 1.6, 0.6, 0.8); hd('physical', 4.2, 6.5);
    cap('變成 physical', '用 p 找到 frame，把 frame 的 base 寫在前面');
  },
  async (tok, S) => {                                   // 544 加上相同的 offset
    S.d2 = bx('d', MC.orange, -3.4, 5.8, 0.4, 1.6, 0.6, 0.8); await slide(tok, S.d2, 5.0, 5.8, 0, 700);
    cap('再加上相同的 offset', 'page 跟 frame 大小剛好一樣');
  },
  async (tok, S) => {                                   // 570 圖：64/32 bits，前面 p 後面 d
    S.nb = note('64 bits（早期 32 bits）：前面 p、後面 d', -4.2, 3.2);
    cap('直接看圖', 'address 有很多 bit：前面叫 p，後面叫 d');
  },
  async (tok, S) => {                                   // 589 page size 大 → d bits 多、p bits 少
    S.d.scale.x = 1.4; S.d.position.x = -3.1; S.p.scale.x = 0.7; S.p.position.x = -5.1;
    cap('怎麼切由系統的 page size 決定', 'page 大一點，d 的 bit 多，p 就少');
  },
  async (tok, S) => {                                   // 603 p → page table 的 entry → frame base
    const k = pkt('p', MC.blue, -5.1, 5.8); await slide(tok, k, -0.4, 4.6 + 0.4, 0.6, 600); gone(k);
    cap('p 轉成數字去找 page table 的 entry', '裡面存了 frame 的 base address');
  },
  async (tok, S) => {                                   // 619 接在一起（bit operation）
    const k = pkt('f', MC.green, -0.4, 4.6); await slide(tok, k, 3.4, 5.8, 0.6, 600); gone(k); glow(S.pt.cells[2], null);
    cap('把 f 直接貼過來，和 d 接在一起', '都是 bit operation');
  },
  async (tok, S) => {                                   // 632 → physical address
    glow(S.f, OKG); glow(S.d2, OKG);
    cap('就得到完整的 physical address', '');
  },
  async (tok, S) => {                                   // 636 例：page size 1KB = 2¹⁰ → offset 10 bits
    gone(S.p, S.d, S.d2, S.f, S.pt.cells, S.pt.idx, S.nb);
    hd('例：page 1KB = 2¹⁰ → offset 10 bits', 0, 5.4);
    cap('簡單的例子：page size 1KB', '2¹⁰：腦袋馬上想到 offset 是 10 個 bit');
  },
  async (tok, S) => {                                   // 654 一串 0101…：後 10 bits 是 offset
    S.bits = bits('010' + 'dddddddddd', -5.4, 3.6, (i) => (i < 3 ? MC.blue : MC.orange));
    cap('給你一串 0101…', '後面 10 個先切出來：那就是 page offset');
  },
  async (tok, S) => {                                   // 666 前面的值 = 2 → table 第 2 格（第三個）
    hot('p = 010₂ = 2', -4.9, 2.9);
    S.pt = tbl(2.6, 4.0, ['', '', '5', '', '', '', '', ''], { dy: 0.48, title: 'page table' }); glow(S.pt.cells[2], HL);
    cap('前面的值是 2', '去看 table 的 index 2：從 0 開始，是第三個位置');
  },
  async (tok, S) => {                                   // 686 裡面存 5 → frame 5
    sm('→ frame 5', 4.0, 3.04);
    cap('假設裡面存的是 5', 'page 2 放在第 5 個 frame');
  },
  async (tok, S) => {                                   // 693 base = page size × 5
    good('frame 5 的 base = 1024 × 5 = 5120', 2.6, 0.0);
    cap('frame 大小固定', 'base address = page size × 5 = 1024 × 5 = 5120');
  },
  async (tok, S) => {                                   // 717 13 bits：後 10 offset，前 3 page number
    sm('共 13 bits：前 3 bits 是 page number', -2.6, 2.2);
    cap('這個 address 一共 13 bits', '後 10 個是 offset，只剩前 3 個是 page number');
  },
  async (tok, S) => {                                   // 748 2 換成 5，加原本的 offset
    const nb = bits('101', -5.4, 1.2, () => MC.green); void nb;
    bits('dddddddddd', -5.4 + 3 * 0.48, 1.2, () => MC.orange);
    sm('physical = 5 × 1024 + d = 5120 + d', -1.6, 0.5);
    cap('把 2 替換成 5，offset 照抄', '就完成一個 address translation');
  },
  async (tok, S) => {                                   // 761 原理不變
    note('page size、address bits 會變，translation 的原理不變', 0, 6.2);
    cap('這個概念非常重要', '數字因需求改變，但翻譯原理不變');
  },
  async (tok, S) => {                                   // 807 typical 問題
    note('考前一定要能自己算：p 幾 bits、d 幾 bits、page size、table size', 0, 5.6);
    cap('這裡列了一大堆 typical 的問題', '考前一定要能自己回答');
  },
]);

scene('mem-11a-calc', '例題：32-bit logical、36-bit physical、page 4KB', CAMW, [
  async (tok, S) => {                                   // 837 給三個數字
    S.g = [bx('logical：32 bits', MC.blue, -4.2, 6.2, 0, 2.8, 0.6, 0.8), bx('physical：36 bits', MC.green, 0, 6.2, 0, 2.8, 0.6, 0.8), bx('page：4KB', MC.orange, 4.2, 6.2, 0, 2.4, 0.6, 0.8)];
    cap('比較複雜的例子', 'logical 32 bits、physical 36 bits、page 4KB');
  },
  async (tok, S) => {                                   // 846 logical bit 數不一定等於 physical
    sm('logical ≠ physical 的 bit 數也沒關係：只要能 map', 0, 5.5);
    cap('logical 的 bit 數不一定等於 physical', '只要 unique 的 logical 能 map 到 unique 的 physical');
  },
  async (tok, S) => {                                   // 869 剩下的空間給別的程式；VM 時 logical 可大於 physical
    sm('剩下的 physical 給別的程式；有 VM 時 logical 也可以比較大', 0, 5.0);
    cap('剩下的空間給誰？', '這只是一支程式；有 virtual memory 時 logical 可以 > physical');
  },
  async (tok, S) => {                                   // 916 page table entries = 2³² / 2¹² = 2²⁰
    S.r = [];
    S.r.push(bx('page table entries = 2³² ÷ 2¹² = 2²⁰', MC.paper, -2.0, 4.0, 0, 6.4, 0.55, 0.7));
    cap('page table 有幾個 entry？', '2³² ÷ 2¹²（4KB）= 2²⁰ 個 page');
  },
  async (tok, S) => {                                   // 977 program 最大 = 2³² = 4GB
    S.r.push(bx('program 最大 = 2³² B = 4 GB', MC.paper, -2.0, 3.35, 0, 6.4, 0.55, 0.7));
    cap('一個 program 最大的 memory', '2³² bytes = 4GB');
  },
  async (tok, S) => {                                   // 992 早期電腦為什麼不能超過 4GB
    sm('加再多硬體也沒用：address 描述不了', 4.6, 3.35);
    cap('早期電腦為什麼不能超過 4GB', '沒有 address 去描述它，翻譯不了');
  },
  async (tok, S) => {                                   // 1010 physical memory size = 2³⁶ = 64GB
    S.r.push(bx('physical memory = 2³⁶ B = 64 GB', MC.mint, -2.0, 2.7, 0, 6.4, 0.55, 0.7));
    cap('physical memory size', '看 physical address：2³⁶ = 64GB，兩個不一定 match');
  },
  async (tok, S) => {                                   // 1033 page number 的 bit 數 = 20
    S.r.push(bx('page number bits = 32 − 12 = 20', MC.paper, -2.0, 2.05, 0, 6.4, 0.55, 0.7));
    cap('page number 的 bit 數', '跟第一題一樣：20 bits');
  },
  async (tok, S) => {                                   // 1047 page table size in bytes：entries × 4 bytes
    S.r.push(bx('page table size = 2²⁰ × 4 B = 4 MB', MC.lilac, -2.0, 1.4, 0, 6.4, 0.55, 0.7));
    cap('page table 有幾個 byte？', 'entry 數 × 每個 entry 的 byte（通常 4）= 4MB');
  },
  async (tok, S) => {                                   // 1088 frame number bits = 36 − 12 = 24
    S.r.push(bx('frame number bits = 36 − 12 = 24', MC.mint, -2.0, 0.75, 0, 6.4, 0.55, 0.7));
    cap('frame number 的 bit 數', '要看 physical：36 − 12 = 24 bits');
  },
  async (tok, S) => {                                   // 1114 offset bits = 12
    S.r.push(bx('page offset bits = 12（4KB）', MC.orange, -2.0, 0.1, 0, 6.4, 0.55, 0.7));
    cap('page offset 的 bit 數', 'page size 4KB → 12 bits');
  },
  async (tok, S) => {                                   // 1128 三個數字推出這麼多
    S.g.forEach((g) => glow(g, HL));
    cap('只給三個數字', '就推出這麼多關聯：不用死背，想運作原理');
  },
]);

scene('mem-11a-free', 'Free frame list', CAMW, [
  async (tok, S) => {                                   // 1162 allocate 要知道哪些 frame 空的
    hd('physical memory', 4.4, 6.6); S.fr = []; for (let f = 0; f < 8; f++) { S.fr.push(bx('frame ' + f, [1, 2, 4, 6].includes(f) ? MC.gray : MC.paper, 4.4, 6.0 - f * 0.7, 0, 1.8, 0.6, 0.8)); }
    cap('會 translate 了', '但 allocate 時必須知道哪些 frame 是空的');
  },
  async (tok, S) => {                                   // 1182 free frame list：linked list
    hd('free frame list', -3.0, 6.6); S.L = [0, 3, 5, 7].map((f, i) => bx('frame ' + f, MC.mint, -4.6 + i * 1.5, 5.8, 0, 1.3, 0.55, 0.8));
    sm('（哪些 frame 空著為示意）', -2.4, 4.7);
    cap('OS 有一個 free frame list', '很單純：一個 linked list');
  },
  async (tok, S) => {                                   // 1192 create process：pop 一個 frame 放進 page table
    S.pt = tbl(-3.0, 3.2, ['', ''], { dy: 0.6, title: 'P 的 page table' });
    for (let i = 0; i < 2; i++) { const m = S.L.shift(); await slide(tok, m, -3.0, 3.2 - i * 0.6, 0.5, 500); gone(m); relabel(S.pt.cells[i], String([0, 3][i])); }
    S.L.forEach((m, i) => { m.position.x = -4.6 + i * 1.5; });
    cap('有 page 要找 frame', '從 list pop 最上面那個，寫進 page table（不連續也沒關係）');
  },
  async (tok, S) => {                                   // 1226 O(1)
    good('pop 一個：O(1)', -3.0, 1.4);
    cap('maintained by OS', '非常快：O(1)，一直 pop 出來就好');
  },
  async (tok, S) => {                                   // 1232 kill：看 page table，把 frame 還回 list
    for (let i = 0; i < 2; i++) { relabel(S.pt.cells[i], ''); const m = bx('frame ' + [0, 3][i], MC.mint, -3.0, 3.2 - i * 0.6, 0.5, 1.3, 0.55, 0.8); await slide(tok, m, -4.6 + (2 + i) * 1.5, 5.8, 0, 500); }
    cap('程式被 kill 掉、free memory', '看它的 page table，把 frame 放回 list');
  },
]);

scene('mem-11a-psize', 'Page size 怎麼選', CAMW, [
  async (tok, S) => {                                   // 1262 page size：兩邊唯一共通
    hd('page size', 0, 6.7);
    cap('影響效能很關鍵的 setting：page size', 'physical、logical 唯一共通的就是 page size');
  },
  async (tok, S) => {                                   // 1288 power of two
    note('一定是 2 的次方：才能用 bit operation（and、or、shift）', 0, 6.0);
    cap('原則一：一定是 power of two', '翻譯都是 bit operation，才快');
  },
  async (tok, S) => {                                   // 1309 512B ~ 16MB；常見 4KB、8KB
    S.sizes = ['512B', '4KB', '8KB', '…', '16MB'].map((t, i) => bx(t, i === 1 || i === 2 ? MC.green : MC.gray, -4.4 + i * 2.2, 4.8, 0, 1.8, 0.6, 0.8));
    cap('一般從 512 bytes 到 16MB 都有', '最常見是 4KB 或 8KB');
  },
  async (tok, S) => {                                   // 1352 調大到 16MB → internal fragmentation 嚴重
    glow(S.sizes[4], NG); S.big = bx('', MC.blue, 4.4, 2.6, 0, 1.0, 1.0, 1.0); bx('', MC.paper, 4.4, 1.4, 0, 2.6, 1.0, 1.0); bad('小程式用 16MB 的 page：大半浪費', 4.0, 3.6);
    cap('調大，例如 16MB', 'internal fragmentation 很嚴重：很多程式才幾 KB');
  },
  async (tok, S) => {                                   // 1386 調小 → page number 多 → table 大
    glow(S.sizes[4], null); glow(S.sizes[0], NG);
    S.tb = bx('page table', MC.sand, -4.4, 1.6, 0, 1.6, 0.4, 0.8);
    await anim(tok, 800, (u) => { S.tb.scale.y = 1 + 5 * u; S.tb.position.y = 1.4 + 1.0 * u; });
    cap('調小呢？memory 越來越大、64-bit', '不是 page size 大，就是 page number 多：table 變很大');
  },
  async (tok, S) => {                                   // 1447 每個 process 都要存 → 浪費 OS memory
    bad('每個 process 一張大 table → 浪費 OS 的 memory', -3.0, 4.0);
    cap('每個 process 都要存 page table', 'OS 會浪費不少空間');
  },
  async (tok, S) => {                                   // 1462 讀 4KB：1KB page 要讀 4 個，常在 disk → 慢
    S.k = [0, 1, 2, 3].map((i) => bx('1KB', MC.orange, -1.0 + i * 0.75, 0.4, 1.4, 0.7, 0.45, 0.5));
    cap('page 小，程式要碰的 page 數量多', '同樣讀 4KB，1KB 的 page 要讀 4 個；從 disk 一次一次抓更慢');
  },
  async (tok, S) => {                                   // 1510 4KB：經驗法則
    glow(S.sizes[1], OKG); good('所以通常是 4KB（經驗法則）', 0, 0.0, 2.6);
    cap('效能往下掉', '所以 page size 通常是 4KB，純粹經驗法則');
  },
]);

scene('mem-11a-sum', 'Paging 總結與 frame table', CAMW, [
  async (tok, S) => {                                   // 1555 page table 做 translation，切開 logical / physical
    hd('logical', -5.0, 6.0); hd('physical', 4.4, 6.0);
    [0, 1, 2, 3].forEach((i) => bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple][i], -5.0, 5.2 - i * 0.7, 0, 1.8, 0.6, 0.8));
    S.pt = tbl(-0.6, 5.2, [1, 4, 3, 7], { dy: 0.7, title: 'page table' });
    cap('summary：page table 做 translation', '把 physical 跟 logical memory 切開');
  },
  async (tok, S) => {                                   // 1576 logical 連續、physical 散落
    S.fr = []; for (let f = 0; f < 8; f++) S.fr.push(bx([1, 4, 3, 7].includes(f) ? 'page ' + [1, 4, 3, 7].indexOf(f) : '', [1, 4, 3, 7].includes(f) ? [MC.blue, MC.orange, MC.green, MC.purple][[1, 4, 3, 7].indexOf(f)] : MC.paper, 4.4, 5.3 - f * 0.65, 0, 1.8, 0.56, 0.8));
    cap('使用者的 logical space 永遠連續', 'physical 卻可以散落：不增加程式複雜度');
  },
  async (tok, S) => {                                   // 1606 OS maintain；run time 翻譯 → hardware
    sm('OS maintain；run time 翻譯 → 交給 hardware', -0.6, 1.8);
    cap('OS 要 maintain page table', 'run time 翻譯要花時間，所以用 hardware 做');
  },
  async (tok, S) => {                                   // 1622 frame table：每個 frame 存哪個 process 的 page
    S.ft = [1, 4, 3, 7].map((f) => sm('P1 的 page ' + [1, 4, 3, 7].indexOf(f), 6.5, 5.3 - f * 0.65));
    hd('frame table', 6.3, 6.0);
    cap('有 page table，那有 frame table 嗎？', '有：倒過來，記每個 frame 放了哪個 process 的哪個 page');
  },
  async (tok, S) => {                                   // 1643 只是 accounting，不參與 translation
    note('frame table：accounting 用，不參與 translation', -1.6, 0.4);
    cap('用 paging 時它意義不大', '純粹 accounting，不是 translation 的一部分');
  },
  async (tok, S) => {                                   // 1661 例外：inverted page table
    hot('特例：inverted page table 用它做 translation', -1.6, 1.1);
    cap('唯一特例', '最後會講的 inverted page table：一般電腦很少用');
  },
]);

// ════════ 8RyRHYruy-8（第 11B 講：PTBR、TLB、EMAT） ════════
scene('mem-11b-ptbr', 'Page table 在 memory：PTBR 隨 context switch 載入', CAM, [
  async (tok, S) => {                                   // 21 page table 在 memory，是 OS 的 memory
    hd('physical memory', 4.4, 6.9);
    S.mem = col(4.4, 6.5, [['OS', 0.9, MC.dark], ['P1 的 page table', 0.9, MC.blue], ['…', 0.7, MC.paper], ['P2 的 page table', 0.9, MC.purple], ['…', 0.9, MC.paper]], 2.8);
    sm('0x5000（示意）', 6.6, S.mem.ys[1]); sm('0x9000（示意）', 6.6, S.mem.ys[3]);
    cap('page table 是 memory structure', '放在 OS 的 memory 裡');
  },
  async (tok, S) => {                                   // 47 做 translation 的是 MMU（hardware）
    S.mmu = bx('MMU（hardware）', '#f1d3d3', 0, 4.4, 0, 2.6, 1.6, 1.2);
    cap('誰做 translation？', 'MMU：一個 hardware');
  },
  async (tok, S) => {                                   // 56 hardware 要把資料 load 到自己的 register
    S.pk = pkt('table 內容', MC.blue, 4.4, S.mem.ys[1]);
    await slide(tok, S.pk, 0, 3.4, 0.8, 700);
    cap('hardware 只能用 register 裡的資料', '要先把 page table 內容 load 進 MMU');
  },
  async (tok, S) => {                                   // 86 需要一個 base address
    gone(S.pk); S.reg = bx('base = ?', MC.orange, 0, 2.3, 0.4, 2.2, 0.55, 0.8);
    cap('MMU 得知道 table 存在哪', '需要一個 base address');
  },
  async (tok, S) => {                                   // 103 這個 base register 叫 PTBR
    relabel(S.reg, 'PTBR = 0x5000'); glow(S.reg, HL); glow(S.mem.m[1], HL);
    S.ln = line(1.1, 2.3, 3.0, S.mem.ys[1], 0.3, MC.blue);
    cap('PTBR：page-table base register', '存 page table 在 memory 的位置');
  },
  async (tok, S) => {                                   // 122 存的是 physical address
    hot('physical address！', 0, 1.5, 0.4);
    cap('PTBR 存的是 physical address', 'hardware 直接讀，沒人再幫它 translate');
  },
  async (tok, S) => {                                   // 158 值存在 process 的 PCB
    glow(S.reg, null); glow(S.mem.m[1], null);
    hd('PCB', -4.6, 6.4);
    S.p1 = bx('P1：PTBR 0x5000', MC.blue, -4.6, 5.5, 0, 2.8, 0.6, 0.8); S.p2 = bx('P2：PTBR 0x9000', MC.purple, -4.6, 4.6, 0, 2.8, 0.6, 0.8);
    S.run = hot('執行中：P1', -4.6, 3.5);
    cap('就像 context switch', 'PTBR 的值存在每個 process 的 PCB');
  },
  async (tok, S) => {                                   // 172 context switch 時 load 到 MMU register
    txt(S.run, '切換到：P2'); glow(S.p2, HL);
    const c = pkt('0x9000', MC.purple, -4.6, 4.6);
    await slide(tok, c, 0, 2.3, 0.7, 800); gone(c);
    relabel(S.reg, 'PTBR = 0x9000'); tint(S.reg, MC.purple); glow(S.p2, null);
    cap('context switch：PTBR 也重新 load', '不只 CPU register，MMU register 也要換');
  },
  async (tok, S) => {                                   // 186 下一支程式用自己的 page table
    gone(S.ln); line(1.1, 2.3, 3.0, S.mem.ys[3], 0.3, MC.purple); glow(S.mem.m[3], OKG);
    cap('P2 翻譯時用 P2 自己的 page table', '這樣才不會亂掉');
  },
]);

scene('mem-11b-two', '一次 read 變兩次 memory access', CAM, [
  async (tok, S) => {                                   // 216 讀一個 memory content，access 次數不是 1
    bx('CPU', MC.dark, -5.4, 2.4, 0, 1.4, 1.0, 1.0);
    bx('MMU', '#f1d3d3', -1.8, 2.4, 0, 1.8, 1.2, 1.0);
    hd('memory', 3.8, 6.4);
    S.pt = bx('page table', MC.sand, 3.8, 4.8, 0, 2.6, 1.0, 1.0); S.da = bx('你的資料', MC.blue, 3.8, 1.6, 0, 2.6, 1.0, 1.0);
    S.cnt = hot('memory access：0 次', 0, 6.4);
    cap('讀一個 memory content', '真正碰 memory 的次數不是 1');
  },
  async (tok, S) => {                                   // 228 第一次：load page table
    S.pk = pkt('(p, d)', MC.orange, -5.4, 2.4);
    await slide(tok, S.pk, -1.8, 2.4, 0.7, 500); await slide(tok, S.pk, 3.8, 5.55, 0.8, 600);
    glow(S.pt, HL); txt(S.cnt, 'memory access：1 次');
    cap('第 1 次：讀 page table', 'load 進 MMU 才能 translate');
  },
  async (tok, S) => {                                   // 247 第二次：真的讀資料
    relabel(S.pk, '(f, d)'); tint(S.pk, MC.green); glow(S.pt, null);
    await slide(tok, S.pk, 3.8, 2.35, 0.8, 600); glow(S.da, OKG); txt(S.cnt, 'memory access：2 次');
    cap('第 2 次：才真的讀到資料', '');
  },
  async (tok, S) => {                                   // 262 使用者看不到第一個
    bub('使用者只看到一次 read', -3.6, 5.0);
    cap('CPU 只 issue 一個 read', '因為 page table 變成兩個 memory read');
  },
  async (tok, S) => {                                   // 274 時間 double：100 GB/s → 50 GB/s
    const bar = bx('', MC.blue, -5.4, 0.8, 2.4, 1.0, 1, 1.0); bar.scale.y = 1.6; const bl = hd('100 GB/s', -5.4, 2.0, 2.4);
    await anim(tok, 700, (u) => { const h = 1.6 - 0.8 * u; bar.scale.y = h; bar.position.y = h / 2; bl.position.y = h + 0.4; });
    txt(bl, '50 GB/s'); tint(bar, MC.red);
    cap('access time 變兩倍', '花錢買 100 GB/s，只剩 50 GB/s');
  },
  async (tok, S) => {                                   // 292 加入 TLB
    S.tlb = bx('TLB', MC.tlb, -1.8, 4.2, 0, 1.6, 0.6, 0.8); glow(S.tlb, HL);
    cap('現在的電腦都加了 TLB', '');
  },
  async (tok, S) => {                                   // 300 TLB 是 cache：讀過的記起來，hit 只要一次
    glow(S.tlb, null); good('cache hit：只要 1 次 memory access', 0, 0.3, 1.2);
    cap('TLB 本質是 cache', '查過的先記著，hit 就不必再讀 page table');
  },
]);

scene('mem-11b-assoc', 'TLB：associative memory，O(1) 平行比對', CAM, [
  async (tok, S) => {                                   // 333 TLB 是 memory（cache）
    hd('TLB', 0.6, 6.4);
    S.rows = [[1, 4], [7, 9], [5, 2], [2, 6]].map(([p, f], i) => ({ p: bx('page ' + p, MC.tlb, -0.2, 5.4 - i * 0.8, 0, 1.6, 0.6, 0.8), f: bx('frame ' + f, MC.sand, 1.6, 5.4 - i * 0.8, 0, 1.6, 0.6, 0.8) }));
    sm('frame 值為示意', 0.7, 2.0);
    cap('TLB 是一塊 memory', '因為它是 cache');
  },
  async (tok, S) => {                                   // 352 associative memory
    hot('associative memory', 0.6, 7.0);
    cap('它是 associative memory', '跟一般 RAM 不一樣');
  },
  async (tok, S) => {                                   // 361 存查過的 page → frame
    S.rows.forEach((r) => glow(r.p, DIMG));
    cap('裡面是查過的 page → frame', '查過就記在這');
  },
  async (tok, S) => {                                   // 379 比一般 memory 快 10 倍以上
    S.rows.forEach((r) => glow(r.p, null));
    good('比一般 memory 快 10 倍以上', -4.4, 5.6);
    cap('像 L1、L2 cache', '速度通常快 10 倍以上');
  },
  async (tok, S) => {                                   // 388 cache 沒有順序；page table 可直接跳
    note('page table：第 3 頁 → 直接跳第 3 格', -4.4, 1.4);
    cap('cache 沒有 ordering', 'page table 可以 O(1) 直接跳到第 3 格');
  },
  async (tok, S) => {                                   // 401 1、7、5、2 → 找 page 3 要掃一遍 O(N)
    S.q = pkt('page 3？', MC.orange, -4.6, 4.2);
    for (let i = 0; i < 4; i++) { S.q.position.set(-2.0, 5.4 - i * 0.8, 0.7); glow(S.rows[i].p, DIMG); await wt(tok, 220); glow(S.rows[i].p, null); }
    tint(S.q, MC.red); S.on = bad('一個一個掃：O(N)', -4.6, 3.0);
    cap('裡面可能是 1、7、5、2', '一般 memory 要掃過一遍 → O(N)');
  },
  async (tok, S) => {                                   // 420 associative：同時查所有 entry → O(1)
    gone(S.on); tint(S.q, MC.orange); S.q.position.set(-2.4, 4.2, 0.7);
    S.rows.forEach((r) => glow(r.p, DIMG)); await wt(tok, 400); S.rows.forEach((r) => glow(r.p, null));
    tint(S.q, MC.red); good('全部 entry 同時比：O(1)', -4.6, 3.0);
    cap('hardware 同時比對所有 entry', 'lookup time 是 O(1)');
  },
  async (tok, S) => {                                   // 447 雖然是 search，但是 O(1)
    relabel(S.q, 'page 5？'); tint(S.q, MC.orange); glow(S.rows[2].p, OKG); glow(S.rows[2].f, OKG); tint(S.q, MC.green);
    cap('雖然是 search，時間是 O(1)', 'page 5 → hit，frame 2');
  },
  async (tok, S) => {                                   // 467 很貴、邏輯複雜 → 只有數千筆
    bad('昂貴 → 只有數千筆 entry', 0.6, 1.2);
    cap('邏輯複雜、昂貴', 'size 沒辦法大：幾千筆等級');
  },
  async (tok, S) => {                                   // 497 不可能塞下所有 page table
    note('整張 page table 塞不進來', 4.8, 4.2);
    cap('不可能把 page table 全塞進 TLB', '它就是一般的 cache');
  },
]);

scene('mem-11b-flow', 'TLB 與 page table 一起用：hit / miss', CAMW, [
  async (tok, S) => {                                   // 507 圖：一堆箭頭（associative）
    bx('CPU', MC.dark, -6.0, 1.0, 0, 1.2, 0.9, 1.0);
    S.mmu = bx('', '#f1d3d3', -3.0, 4.0, -0.6, 2.8, 2.6, 0.3); hd('MMU', -3.0, 5.6);
    S.tlb = [[1, 4], [7, 9], [5, 2]].map((e, i) => bx('p ' + e[0] + ' → f ' + e[1], MC.tlb, -3.0, 4.7 - i * 0.6, 0, 2.2, 0.5, 0.8));
    S.tlbE = [[1, 4], [7, 9], [5, 2]];
    hd('page table（memory）', 1.4, 6.6);
    S.PT = [3, 4, 6, 8, 1, 2, 0, 9];
    S.pt = tbl(1.4, 6.0, S.PT.map((f) => 'f ' + f), { dy: 0.6 });
    hd('physical memory', 5.0, 6.6);
    S.fm = []; for (let f = 0; f < 10; f++) { S.fm.push(bx('', MC.paper, 5.0, 6.0 - f * 0.56, 0, 1.6, 0.44, 0.7)); sm(String(f), 6.2, 6.0 - f * 0.56); }
    sm('數字為示意', 1.4, 0.6);
    S.cnt = hot('', -3.0, 0.3);
    cap('TLB 和 page table 一起用', 'TLB 是 associative memory');
  },
  async (tok, S) => {                                   // 525 先遮掉 TLB：原本兩次 access
    S.tlb.forEach((m) => { m.visible = false; m.userData.lbl.visible = false; });
    const pk = pkt('(2, d)', MC.orange, -6.0, 1.9);
    await slide(tok, pk, 2.9, S.pt.y(2), 0.8, 600); glow(S.pt.cells[2], HL);
    await slide(tok, pk, 5.0, 6.0 - 6 * 0.56 + 0.4, 0.8, 600); glow(S.fm[6], OKG);
    txt(S.cnt, '沒有 TLB：2 次 memory access'); gone(pk); glow(S.pt.cells[2], null); glow(S.fm[6], null);
    cap('先遮掉 TLB：就是原本的流程', 'p → page table → 讀資料：慢一倍');
  },
  async (tok, S) => {                                   // 545 加上 TLB；紅框是 MMU（hardware）
    S.tlb.forEach((m) => { m.visible = true; m.userData.lbl.visible = true; }); txt(S.cnt, '');
    glow(S.mmu, HL); await wt(tok, 500); glow(S.mmu, null);
    cap('加上 TLB', '紅框是 MMU，是 hardware；其他在 memory');
  },
  async (tok, S) => {                                   // 564 TLB 就是 MMU 的 cache
    note('TLB = MMU 的 cache', -3.0, 2.2);
    cap('TLB 就是 MMU 的 cache', '放在 MMU 裡面');
  },
  async (tok, S) => {                                   // 574 每個 process 一張 page table，TLB 只有一個
    sm('P1、P2、P3…各一張 page table', 1.4, 0.0);
    cap('page table 每個 process 一張', 'TLB 是 hardware，只有一個，大家共用');
  },
  async (tok, S) => {                                   // 595 translate 完把 (p, f) cache 起來；滿了踢掉
    const ev = S.tlbE.shift(); const em = S.tlb.shift(); gone(em);
    S.tlb.forEach((m, i) => { m.position.y = 4.7 - i * 0.6; });
    S.tlbE.push([2, 6]); const nm = bx('p 2 → f 6', MC.tlb, -3.0, 4.7 - 2 * 0.6, 0, 2.2, 0.5, 0.8); S.tlb.push(nm); glow(nm, HL);
    cap('translate 完就把 (p, f) 存進 TLB', '滿了踢掉最不常用的（踢掉 p ' + ev[0] + '）');
  },
  async (tok, S) => {                                   // 622 第一步先看 TLB：hit 直接拿 f，一次 access
    glow(S.tlb[2], null);
    const pk = pkt('(2, d)', MC.orange, -6.0, 1.9);
    await slide(tok, pk, -5.6, 3.5, 0.8, 500); glow(S.tlb[2], OKG);
    relabel(pk, ''); tint(pk, MC.green); await slide(tok, pk, 5.0, 6.0 - 6 * 0.56 + 0.4, 0.8, 700); relabel(pk, '(6, d)'); glow(S.fm[6], OKG); // crosses the TLB rows unlabelled, named on arrival
    txt(S.cnt, 'TLB hit：1 次 memory access'); S.pk = pk;
    cap('每次 translation 先查 TLB', 'hit：直接拿到 f，只碰 memory 一次');
  },
  async (tok, S) => {                                   // 642 miss：回到老路，兩次 access
    gone(S.pk); glow(S.fm[6], null); glow(S.tlb[2], null);
    const pk = pkt('(4, d)', MC.orange, -6.0, 1.9);
    await slide(tok, pk, -5.6, 3.5, 0.8, 400); tint(pk, MC.red); await wt(tok, 250); tint(pk, MC.orange);
    await slide(tok, pk, 2.9, S.pt.y(4), 0.8, 500); glow(S.pt.cells[4], HL);
    relabel(pk, '(1, d)'); tint(pk, MC.green); await slide(tok, pk, 5.0, 6.0 - 1 * 0.56 + 0.4, 0.8, 500); glow(S.fm[1], OKG);
    txt(S.cnt, 'TLB miss：2 次 memory access');
    cap('miss：O(1) 查完沒有', '走老路查 page table → 兩次 memory access');
  },
]);

scene('mem-11b-flush', 'Context switch：flush TLB 或加 PID', CAM, [
  async (tok, S) => {                                   // 669 只寫 page number 跟 frame number
    hd('TLB', -2.4, 6.5);
    S.mk = (t, i, c, w = 2.6) => bx(t, c || MC.tlb, -2.4, 5.6 - i * 0.7, 0, w, 0.55, 0.8);
    S.rows = [S.mk('p 0 → f 3', 0), S.mk('p 1 → f 4', 1), S.mk('p 2 → f 6', 2)];
    S.run = hot('執行中：P1', -6.0, 6.5);
    sm('P1：0→3、1→4、2→6（示意）', 3.8, 5.6); sm('P2：0→7、1→5（示意）', 3.8, 4.9);
    cap('目前 TLB 只記兩個數字', 'page number 跟 frame number');
  },
  async (tok, S) => {                                   // 685 每個 process 都有相同 page number，對到不同 frame
    txt(S.run, '執行中：P2');
    S.q = pkt('P2 要 page 0', MC.purple, -6.0, 4.2, 0.6, 1.9);
    await slide(tok, S.q, -4.6, 5.6, 0.6, 500); glow(S.rows[0], NG); tint(S.q, MC.red);
    cap('每個 process 都有 page 0', 'TLB 說 frame 3 —— 那是 P1 的！');
  },
  async (tok, S) => {                                   // 698 兩個 solution；第一個：flush
    gone(S.rows); S.rows = []; tint(S.q, MC.purple);
    hot('解法一：flush TLB', 3.8, 3.6);
    cap('解法一（最常用）：flush TLB', 'page table 換人了，舊的 cache 全部清空');
  },
  async (tok, S) => {                                   // 723 第二個：加 process ID 欄位
    gone(S.q);
    S.r2 = [['P1 | p 0 → f 3', MC.tlb], ['P1 | p 1 → f 4', MC.tlb], ['P2 | p 0 → f 7', MC.lilac]].map(([t, c], i) => S.mk(t, i, c, 3.2));
    const q2 = pkt('(P2, page 0)', MC.purple, -6.0, 4.0, 0.6, 1.9);
    await slide(tok, q2, -4.6, 4.2, 0.6, 400); S.r2.forEach((m, i) => glow(m, i === 2 ? OKG : null)); tint(q2, MC.green);
    hot('解法二：加 PID 欄位', 3.8, 2.8);
    cap('解法二：每筆多記 process ID', 'page number 和 PID 都相符才叫 hit');
  },
  async (tok, S) => {                                   // 745 一般 flush：程式會把 TLB 塞滿
    note('程式 memory 很大 → TLB 本來就塞滿自己的 page', 0.6, 1.6);
    cap('一般選 flush', '反正 TLB 全是現在這支程式的 page');
  },
  async (tok, S) => {                                   // 767 多 4 bytes：8 → 12 bytes，33%
    bad('每筆 4 + 4 = 8 bytes → 再加 PID 4 bytes = 12 bytes', 0.6, 0.9);
    cap('PID 要多存 4 bytes', '8 → 12 bytes：多出的佔 1/3（33%）');
  },
  async (tok, S) => {                                   // 785 context switch：load PTBR + flush TLB
    gone(S.r2); good('context switch：載入 PTBR + flush TLB', 0.6, 0.2);
    cap('把兩章串起來', 'context switch 要 load base register，還要 flush TLB');
  },
  async (tok, S) => {                                   // 804 flush 後全部 miss，直到填回來
    for (let i = 0; i < 3; i++) { const m = S.mk('miss → 填入', i, '#f3c9c9'); await wt(tok, 300); tint(m, MC.tlb); relabel(m, 'p ' + i + ' → f ' + [7, 5, 2][i]); }
    sm('（P2 的 p 2 → f 2 為示意）', -2.4, 3.3);
    cap('flush 後接下來全部 miss', '每次兩倍時間，直到 TLB 重新填起來');
  },
]);

scene('mem-11b-emat', 'EMAT：TLB 20 ns、memory 100 ns', CAM, [
  async (tok, S) => {                                   // 843 effective memory access time
    hd('Effective Memory Access Time（EMAT）', 0, 6.6);
    S.st = (x, parts, label) => { let y = 0; for (const [v, c] of parts) { const h = v * 0.022; bx(v >= 60 ? String(v) : '', c, x, y + h / 2, 0, 1.5, h - 0.03, 1.2); y += h; } sm(label, x, -0.25, 1.0); return y; };
    cap('效能怎麼算？', 'effective memory access time');
  },
  async (tok, S) => {                                   // 863 TLB 20 ns，memory 100 ns
    bx('TLB 20 ns', MC.orange, -4.8, 5.6, 0, 1.8, 0.5, 0.8); bx('memory 100 ns', MC.blue, -2.4, 5.6, 0, 2.2, 0.5, 0.8);
    cap('例子：TLB 20 ns，memory 100 ns', 'memory 慢 5 倍甚至更多');
  },
  async (tok, S) => {                                   // 873 hit rate 70%；hit = 20 + 100 = 120
    const t = S.st(-4.8, [[20, MC.orange], [100, MC.blue]], 'hit'); hot('120', -4.8, t + 0.4);
    cap('假設 hit rate 70%', 'hit：查 TLB 20 + 讀資料 100 = 120 ns');
  },
  async (tok, S) => {                                   // 888 miss：always 要先 search → 220
    const t = S.st(-2.4, [[20, MC.orange], [100, MC.blue], [100, MC.blue]], 'miss'); hot('220', -2.4, t + 0.4);
    cap('miss：20 + 100 + 100 = 220 ns', '20 一定要加：always 先 search TLB');
  },
  async (tok, S) => {                                   // 904 → 150
    const t = S.st(0.6, [[150, MC.green]], 'hit 70%'); hot('150', 0.6, t + 0.4);
    cap('0.7 × 120 + 0.3 × 220', '= 84 + 66 = 150 ns');
  },
  async (tok, S) => {                                   // 906 98% → 122
    const t = S.st(3.0, [[122, MC.green]], 'hit 98%'); hot('122', 3.0, t + 0.4);
    cap('hit rate 98%', '0.98 × 120 + 0.02 × 220 = 117.6 + 4.4 = 122 ns');
  },
  async (tok, S) => {                                   // 912 原本 worst case 200 → 快將近一倍
    const t = S.st(5.4, [[100, MC.gray], [100, MC.gray]], '沒有 TLB'); hd('200', 5.4, t + 0.4);
    cap('跟沒有 TLB 的 200 ns 比', '98% 時快將近一倍；下次講為什麼做得到 98%');
  },
]);

// ════════ u4zElpAChLM（第 12A 講：TLB hit rate、valid bit、PTLR、sharing、hierarchical / hashed page table） ════════
scene('mem-12a-emat', 'TLB hit rate 為什麼這麼高：locality', CAMW, [
  async (tok, S) => {                                   // 15 TLB 20 ns、memory 100 ns
    bx('TLB 20 ns', MC.orange, -5.0, 6.3, 0, 1.8, 0.5, 0.8); bx('memory 100 ns', MC.blue, -2.6, 6.3, 0, 2.2, 0.5, 0.8);
    S.all = [];
    S.st = (x, parts, label) => { let y = 0; for (const [v, c] of parts) { const h = v * 0.02; S.all.push(bx(v >= 60 ? String(v) : '', c, x, y + h / 2, 0, 1.3, h - 0.03, 1.0)); y += h; } S.all.push(sm(label, x, -0.25, 0.9)); return y; };
    cap('上次的例子', 'TLB 是 hardware，至少快 10 倍：20 ns vs 100 ns');
  },
  async (tok, S) => {                                   // 50 hit = 120
    const t = S.st(-5.6, [[20, MC.orange], [100, MC.blue]], 'hit'); S.all.push(hot('120', -5.6, t + 0.35));
    cap('hit：看一次 TLB，再讀 memory content', '20 + 100 = 120 ns');
  },
  async (tok, S) => {                                   // 61 miss 也要先查 TLB
    S.n20 = note('先看了才知道 hit 還是 miss → 20 ns 一定會發生', 3.0, 5.6);
    cap('TLB 這個最佳化有代價', 'miss 也要先查，20 ns 不管怎樣都會發生');
  },
  async (tok, S) => {                                   // 78 miss：page table + data → 220
    const t = S.st(-3.6, [[20, MC.orange], [100, MC.blue], [100, MC.blue]], 'miss'); S.all.push(hot('220', -3.6, t + 0.35));
    cap('miss 更慘', '查 TLB 20 + 讀 page table 100 + 讀資料 100 = 220 ns');
  },
  async (tok, S) => {                                   // 104 70% → 150，比 200 快 25%
    const t = S.st(-1.6, [[150, MC.green]], '70%'); S.all.push(hot('150', -1.6, t + 0.35));
    const t2 = S.st(4.4, [[100, MC.gray], [100, MC.gray]], '無 TLB'); S.all.push(hd('200', 4.4, t2 + 0.35));
    cap('hit rate 70%：0.7 × 120 + 0.3 × 220 = 150', '比沒有 TLB 的 200 ns 快了 25%');
  },
  async (tok, S) => {                                   // 116 98% → 122
    const t = S.st(0.4, [[122, MC.green]], '98%'); S.all.push(hot('122', 0.4, t + 0.35));
    cap('hit rate 98%', '0.98 × 120 + 0.02 × 220 = 122 ns');
  },
  async (tok, S) => {                                   // 141 98% 真的有這麼厲害？
    gone(S.n20); S.q = bub('98% 真的做得到嗎？會不會只有 40%？', 2.2, 4.9);
    cap('98% 看起來很驚人', '真的有這麼高嗎？');
  },
  async (tok, S) => {                                   // 159 實際 > 99%：locality
    S.gl = good('實際 hit rate 往往 > 99%：因為 locality', 2.6, 6.3);
    cap('事實上遠高於 99%', '原因：程式讀資料有很強的 locality');
  },
  async (tok, S) => {                                   // 189 instruction 一行接一行：PC 每次 +4
    gone(S.all, S.q); S.pg = bx('一個 page（4KB）', MC.paper, 2.4, 2.4, 1.5, 6.0, 0.5, 0.8);
    S.pc = hot('PC', -0.4, 3.1, 1.5);
    await anim(tok, 900, (u) => { S.pc.position.x = -0.4 + 1.2 * u; });
    cap('寫的 code 一行接一行執行', 'program counter 4 byte、4 byte 連續往下讀');
  },
  async (tok, S) => {                                   // 201 TLB cache 的是一整個 page（4KB）
    note('TLB 一筆 = 一整個 page（4KB = 2¹² bytes）的翻譯', 2.4, 1.6, 1.5);
    cap('TLB cache 的單位是什麼？', '一個 page：4KB');
  },
  async (tok, S) => {                                   // 211 第一次 miss，之後同 page 999 次 hit
    bad('第 1 次：miss', -0.6, 0.9, 1.5); good('之後 999 次（同一個 page）：全部 hit', 3.4, 0.9, 1.5);
    cap('第一次讀這個 page 會 miss', '假設 4 byte 一次讀 1000 次：扣掉第一次，999 次都 hit');
  },
  async (tok, S) => {                                   // 244 for loop 對 array 連續讀
    sm('for (i…) a[i]++：連續讀 → 大多 hit', 2.4, 0.3, 1.5);
    cap('寫 for loop 對 array 每個 element 加 1', 'array 很大，但連續讀，大部分都 hit');
  },
  async (tok, S) => {                                   // 282 98% → 122；更高就接近 100
    hot('hit rate 越高 → 越接近 100 ns', 4.4, 5.6);
    cap('hit rate 通常相當高', '98% 就 122；再高就盡量接近 100 ns');
  },
  async (tok, S) => {                                   // 300 TLB 是最佳化，translation 過程沒差
    gone(S.gl); note('TLB 是最佳化：可以沒有；翻譯的過程不變', 4.4, 6.3);
    cap('不要忘記 TLB 是一個最佳化', '只是從 TLB lookup 還是從 memory 讀 page table');
  },
]);

scene('mem-12a-valid', 'Page table 的 protection bit：valid / invalid', CAMW, [
  async (tok, S) => {                                   // 388 memory protection
    hd('memory protection', 0, 6.8);
    cap('page table 相關：memory protection', '每個 process 有自己的 memory，不能隨意 access 別人');
  },
  async (tok, S) => {                                   // 406 page table 加 protection bit
    S.pt = tbl(-2.0, 5.6, [2, 3, 4, 7, 8, 9, 0, 0], { dy: 0.6, w: 1.0, title: 'frame' });
    S.vb = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => bx('', MC.gray, -0.7, 5.6 - i * 0.6, 0, 0.7, 0.52, 0.7)); hd('bit', -0.7, 6.2);
    sm('frame 值為示意', -2.0, 0.4);
    cap('page table 裡通常再加一個 bit', '當作 protection bit');
  },
  async (tok, S) => {                                   // 420 valid / invalid；read-only / write / execute
    note('有效 / 無效、read-only、write、executable', 4.0, 5.6);
    cap('這個 bit 可以 indicate', '有效或無效；或這個 page 是 read-only、write、executable');
  },
  async (tok, S) => {                                   // 441 像 file 的權限、const
    sm('就像 file 的 read only、程式的 const', 4.0, 5.0);
    cap('有點像 file 有 read only、write only', '或程式裡 assign 之後不能動的 constant');
  },
  async (tok, S) => {                                   // 503 general OS 主要是 valid / invalid
    S.vb.forEach((m) => relabel(m, '?'));
    cap('一般 OS 在這裡最主要用的', '只是 valid 跟 invalid');
  },
  async (tok, S) => {                                   // 517 為什麼不能用：reserve 了但還沒用
    note('reserve 了但還沒用（還沒 malloc、stack 還沒長）', 4.4, 4.2);
    cap('這個 frame 的內容目前能不能用？', '例如 OS 先 reserve 很大的空間，你還沒真的用');
  },
  async (tok, S) => {                                   // 547 下一章：invalid = 被 swap 到 disk
    note('下一章最常見：invalid = 這個 page 被 swap 到 disk', 4.6, 3.5);
    cap('下一章 virtual memory 非常依賴這個 bit', 'invalid：page 存在，但被 swap 到 disk 上了');
  },
  async (tok, S) => {                                   // 600 例：page number 3 bits → 8 個 entry
    S.pg = [0, 1, 2, 3, 4, 5].map((i) => bx('page ' + i, MC.blue, -5.4, 5.6 - i * 0.6, 0, 1.4, 0.52, 0.7)); hd('program', -5.4, 6.2);
    cap('例：page number 只有 3 bits', '最多 8 個 page：早期就 statically 先 allocate 8 個 entry');
  },
  async (tok, S) => {                                   // 637 程式只用了 6 個 → 6、7 invalid
    S.vb.forEach((m, i) => { relabel(m, i < 6 ? 'v' : 'i'); tint(m, i < 6 ? MC.green : MC.red); });
    cap('program 會長，一開始只用 6 個', '前面都是 valid，6 跟 7 還沒 allocate → invalid');
  },
  async (tok, S) => {                                   // 660 指到 page 6 或 7 → 擋掉
    const q = pkt('pointer → page 6', MC.orange, 3.4, 2.2, 0.6, 2.4); await slide(tok, q, 1.6, 5.6 - 6 * 0.6, 0.6, 700); tint(q, MC.red);
    bad('查 page table 立刻擋掉：fault', 2.2, 0.8);
    cap('pointer 不小心指到 page 6 或 7', '查 page table 時立刻被擋掉，丟出 fault');
  },
]);

scene('mem-12a-ptlr', 'Page table length register（PTLR）', CAMW, [
  async (tok, S) => {                                   // 682 實際 page table 很大
    S.big = bx('page table（很大）', MC.sand, -3.0, 3.4, 0, 2.4, 5.6, 0.8);
    cap('實際上 page table 絕對不會這麼小', '我們可以 access 的空間相當大');
  },
  async (tok, S) => {                                   // 694 小程式：前 10 個 v、後 9000 個 invalid
    S.ov = [bx('前 10 筆：v', MC.green, -3.0, 5.9, 0.45, 2.3, 0.5, 0.1), bx('後面 9000 筆：invalid', MC.red, -3.0, 2.8, 0.45, 2.3, 4.2, 0.1)];
    cap('很多程式都很小', '前面十個 valid，後面 9000 個 entry 全是 invalid → 浪費');
  },
  async (tok, S) => {                                   // 726 page table length register
    S.reg = bx('PTLR = 6', MC.purple, 2.6, 5.6, 0, 2.0, 0.6, 0.8);
    cap('判斷 address 是否有效', '除了 invalid bit，還會存一個 page table length register');
  },
  async (tok, S) => {                                   // 741 像 chapter 1 的 memory limit
    sm('像第一章 base / limit 的 limit', 2.6, 4.9);
    cap('回憶 chapter 1 怎麼保護 memory', '有一個 memory length（limit）：同樣的概念');
  },
  async (tok, S) => {                                   // 755 不 create 8 個，只記 length 6
    gone(S.big, S.ov); S.pt = tbl(-3.0, 5.6, ['f', 'f', 'f', 'f', 'f', 'f'], { dy: 0.6, w: 1.2 });
    good('只 allocate 6 個 entry；page ≥ 6 → 直接擋', 2.6, 4.2);
    cap('不 create 8 個 entry', '用到多少就 allocate 多少，length 記 6，超過就 return');
  },
  async (tok, S) => {                                   // 821 好處一：縮短 table
    good('好處一：table 變短，不存沒用的 entry', 2.6, 3.4);
    cap('length 的好處一', '不需要存那些有的沒的 entry');
  },
  async (tok, S) => {                                   // 829 好處二：valid bit 只能以 page 為單位，length 可到 byte
    S.lp = bx('', MC.blue, -3.0, 5.6 - 5 * 0.6, 0.5, 0.7, 0.5, 0.2); S.lp.position.x = -3.25;
    sm('最後一個 page 只用到一半：bit 管不到 byte', 2.6, 2.6);
    cap('好處二、最主要：valid bit 只能以 page 為單位', 'allocation 是以 byte 為單位：要 length 記到第幾個 byte');
  },
  async (tok, S) => {                                   // 881 動態長大：只改長度；跨新 page 才加 entry
    relabel(S.reg, 'PTLR = 7'); const e = bx('f', MC.sand, -3.0, 5.6 - 6 * 0.6, 0, 1.2, 0.52, 0.7); void e; sm('6', -3.95, 5.6 - 6 * 0.6);
    cap('table 也是動態 allocate', '在同一個 page 裡長只改長度；長到新 page 才加 entry');
  },
  async (tok, S) => {                                   // 984 統整：page table 可加 attribute bit
    note('統整：entry 可以加 attribute bit，讓 OS 快速判斷', 2.6, 6.4);
    cap('統整一下', 'page table 可以加一些 attribute（bit），告訴 OS 這個 page 的限制');
  },
  async (tok, S) => {                                   // 1035 為什麼還要 bit：(1) 可能被 swap 到 disk
    S.v = [0, 1, 2, 3, 4, 5, 6].map((i) => bx(i === 3 ? 'i' : 'v', i === 3 ? MC.red : MC.green, -1.8, 5.6 - i * 0.6, 0, 0.6, 0.52, 0.7));
    sm('page 3 在長度內，但被 swap 到 disk', 2.6, 1.8);
    cap('有 length 為什麼還要 bit？原因一', '在長度內，也可能被 swap 到 disk，暫時不 available');
  },
  async (tok, S) => {                                   // 1058 (2) heap、stack 中間不連續
    sm('原因二：heap、stack 之間可能有沒 allocate 的 page', 2.6, 1.2);
    cap('原因二', '程式不會乖乖連續長：heap、stack 中間可能有洞');
  },
  async (tok, S) => {                                   // 1119 不在 page boundary → 還要 length
    hot('valid bit + length：兩個都要', 2.6, 0.5);
    cap('長度不一定在 page boundary', '所以 bit 跟 length 都需要');
  },
]);

scene('mem-12a-share', 'Shared pages：reentrant code', CAMW, [
  async (tok, S) => {                                   // 1126 page table：快速判斷有效無效
    hd('page table 的用途', -2.4, 6.8);
    cap('有了 page table，第一', '可以很快判斷有效無效，不會跟別的程式撞在一起');
  },
  async (tok, S) => {                                   // 1139 反過來：刻意 sharing
    note('反過來：刻意要 share（shared memory、thread）', -2.4, 6.2);
    cap('第二是反過來', '有時刻意要做 sharing：shared memory programming、thread');
  },
  async (tok, S) => {                                   // 1158 copy on write
    note('create process：copy on write，沒改的先共用', -2.4, 5.6);
    cap('create process 時', 'copy on write：有變動才 copy，沒變動就共用');
  },
  async (tok, S) => {                                   // 1183 shared library
    note('shared library：load 一份，大家用', -2.4, 5.0);
    cap('還有 shared library', 'load 到 memory 後大家共同使用');
  },
  async (tok, S) => {                                   // 1205 條件：reentrant code（pure code）
    hot('條件：reentrant code（pure code）', -2.4, 4.3);
    cap('可以 share 的 code 有條件', '必須是 reentrant code，也叫 pure code');
  },
  async (tok, S) => {                                   // 1223 library 沒人能修改
    sm('沒有使用者可以修改它（執行時不改自己）', -2.4, 3.7);
    cap('library 的定義就是 pure code', '沒有使用者可以去修改它');
  },
  async (tok, S) => {                                   // 1247 editor、application、library：只 load 一份
    sm('例：editor、application、library', -2.4, 3.2);
    cap('很多人同時要用', '透過 sharing，memory 裡只放一份就好');
  },
  async (tok, S) => {                                   // 1272 page table 指到同一個 frame
    note('不同 process 的不同 virtual address → 指到同一個 frame', -2.4, 2.5);
    cap('概念很單純', '在 page table 裡 mapping 到同一個 frame');
  },
  async (tok, S) => {                                   // 1303 paging：只 share 需要的幾個 page；private data 用自己的
    sm('只 share 需要的那幾個 page；private data 各用各的', -2.4, 1.9);
    cap('paging 的好處', '不用整個 sharing，只 share library 用到的那幾個 page');
  },
  async (tok, S) => {                                   // 1357 例：editor 三個 page → 3、4、6
    S.fy = (f) => 6.2 - f * 0.74; hd('physical', 4.8, 6.8);
    for (let f = 0; f < 8; f++) { bx('', MC.paper, 4.8, S.fy(f), -0.6, 1.8, 0.62, 0.3); sm(String(f), 6.0, S.fy(f)); }
    S.ed = {}; [3, 4, 6].forEach((f, i) => { S.ed[f] = bx('ed ' + (i + 1), MC.orange, 4.8, S.fy(f), 0, 1.6, 0.56, 0.6); });
    cap('例：每個人都有 editor，用了三個 page', '三張 page table 的前三格都對到 3、4、6');
  },
  async (tok, S) => {                                   // 1372 editor 一份、data 三份
    [[1, 'data 1', MC.blue], [7, 'data 2', MC.purple], [2, 'data 3', MC.teal]].forEach(([f, t, c]) => bx(t, c, 4.8, S.fy(f), 0, 1.6, 0.56, 0.6));
    sm('data 的 frame 1、7、2', 2.4, 0.4);
    cap('physically editor 只 load 一份', 'data 卻有三份不同的；三個使用者看到的結果都對');
  },
  async (tok, S) => {                                   // 1388 read-only bit → write 丟 fault
    [3, 4, 6].forEach((f) => glow(S.ed[f], HL)); bad('ed 的 page 設 read-only：write → fault', 2.4, -0.2);
    cap('pure code 把 read-only bit set 起來', '有人想 write 這個位置，OS 直接丟 fault 擋掉');
  },
]);

scene('mem-12a-why', '為什麼需要不同的 page table 結構', CAMW, [
  async (tok, S) => {                                   // 1434 不同的 page table structure
    hd('page table 的結構', 0, 6.8);
    cap('接下來非常重要', '不同的 page table structure');
  },
  async (tok, S) => {                                   // 1445 one level 的限制：程式越來越大
    S.ol = sm('one level：page number → offset，一次查完', 0, 6.2);
    cap('之前的做法有 limitation', '程式、logical address 越來越大時……');
  },
  async (tok, S) => {                                   // 1474 32 bits（4GB）→ 2²⁰ entries
    bx('page number：20 bits', MC.blue, -2.4, 5.2, 0, 4.4, 0.6, 0.9); bx('offset：12', MC.orange, 2.4, 5.2, 0, 3.0, 0.6, 0.9);
    cap('virtual address 要能 access 4GB', '32 bits ÷ 4KB（2¹²）→ 2²⁰ 個 entry');
  },
  async (tok, S) => {                                   // 1512 每個 4 bytes → 4MB
    S.slab = bx('', MC.dark, -3.0, 0.1, 0, 3.0, 0.2, 2.0); const l = hot('', -3.0, 0.8);
    await anim(tok, 900, (u) => { const h = 0.2 + 3.2 * u; S.slab.scale.y = h / 0.2; S.slab.position.y = h / 2; l.position.y = h + 0.4; txt(l, Math.round(u * 4096) + ' KB'); });
    txt(l, 'page table = 4 MB');
    cap('每個 entry 4 bytes', '光 page table 本身就 4MB');
  },
  async (tok, S) => {                                   // 1520 MMU 讀 physical → 必須 physically 連續
    note('MMU 直接讀 physical → 4MB 的 table 必須實體連續', 3.2, 3.6);
    cap('MMU 讀的是 physical address', '沒人幫它翻譯：這 4MB 在實體上必須完全連續');
  },
  async (tok, S) => {                                   // 1564 很難找到 4MB 連續
    for (let i = 0; i < 6; i++) bx('', i % 2 ? MC.gray : MC.paper, 2.4 + (i - 2.5) * 0.7, 1.4, 0, 0.62, 0.6, 0.8);
    bad('frame 都是 4KB 散落 → 很難找到 4MB 連續', 2.4, 2.3);
    cap('physical memory 很難找到 4MB 連續', '要 reserve 一大塊專門放 table，很沒效率');
  },
  async (tok, S) => {                                   // 1603 怎麼把 page table 變小
    good('目標：每一張 page table 變小，塞進零碎的空位', 0, 0.2, 1.4);
    cap('所以才有這麼多 structure', '怎麼讓 page table 的 size 變小？');
  },
  async (tok, S) => {                                   // 1624 hierarchical、hashed、inverted
    gone(S.ol); ['hierarchical', 'hashed', 'inverted'].forEach((t, i) => bx(t, [MC.purple, MC.teal, MC.pink][i], -4.0 + i * 4.0, 6.2, 0.6, 2.8, 0.6, 0.8));
    cap('typical 的做法有三個', 'hierarchical、hashed、inverted：留意 table 大小的變化');
  },
]);

scene('mem-12a-hier', 'Hierarchical（two-level）page table：10 | 10 | 12', CAMW, [
  async (tok, S) => {                                   // 1644 大 table 切成很多小 table
    S.big = bx('一張很大的 page table', MC.sand, -4.6, 3.4, 0, 2.6, 5.2, 0.8);
    cap('第一個做法：hierarchical', '把很大的 page table 切成很多小 table');
  },
  async (tok, S) => {                                   // 1679 每個小 table 放到不同的 physical 位置
    gone(S.big); S.sm = [0, 1, 2, 3].map((i) => bx('小 table #' + i, MC.tlb, -4.6, 5.6 - i * 1.4, 0, 2.4, 1.1, 0.8));
    await anim(tok, 900, (u) => S.sm.forEach((m, i) => { m.position.x = -4.6 + ([1.2, 4.8, 2.2, 5.6][i] - (-4.6)) * u; }));
    cap('每個小 table 是獨立的', '可以塞到 physical memory 不同的位置');
  },
  async (tok, S) => {                                   // 1692 要知道每個小 table 在哪 → 再一個 table
    S.out = tbl(-4.6, 5.6, ['→ #0', '→ #1', '→ #2', '→ #3'], { dy: 0.8, w: 1.4, title: 'outer table', c: MC.lilac });
    cap('放在不同位置，就要知道它們在哪', '前面再 create 一個 table：記每張小 table 的位置');
  },
  async (tok, S) => {                                   // 1746 two-level 例子（可延伸 3、4 level）
    hd('two-level（可延伸成 3、4 level）', 0, 6.9);
    cap('原本叫 one level', '接下來走 two level 的例子，同理可以三層、四層');
  },
  async (tok, S) => {                                   // 1764 32 bits：原本 20 | 12
    gone(S.out.cells, S.out.idx, S.out.title, S.sm);
    S.a = bx('p：20 bits', MC.blue, -2.0, 5.6, 0, 7.5 * 20 / 32, 0.6, 0.9); S.b = bx('d：12', MC.orange, -2.0 + 7.5 * 16 / 32, 5.6, 0, 7.5 * 12 / 32, 0.6, 0.9);
    cap('input 一樣是 32 bits', '原本前面 20 bits、後面 12 bits：table 非常龐大');
  },
  async (tok, S) => {                                   // 1780 切成 10 | 10 | 12
    gone(S.a); const w = 7.5 / 32;
    S.p1 = bx('p1：10', MC.purple, -2.0 - 7.5 * 6 / 32 - 5 * w + 5 * w, 5.6, 0, 10 * w - 0.05, 0.6, 0.9); S.p1.position.x = -5.75 + 5 * w;
    S.p2 = bx('p2：10', MC.blue, -5.75 + 15 * w, 5.6, 0, 10 * w - 0.05, 0.6, 0.9); S.b.position.x = -5.75 + 26 * w;
    cap('切成兩個 level：10 | 10 | 12', '後面 12 bits 一樣是 page offset');
  },
  async (tok, S) => {                                   // 1800 outer / inner page number
    sm('outer page number', S.p1.position.x, 6.25); sm('inner page number', S.p2.position.x, 6.25);
    cap('前面拆成兩段', '外面叫 outer，裡面叫 inner page number');
  },
  async (tok, S) => {                                   // 1818 outer 查 outer table；inner 查小 table 的 index
    S.ot = bx('outer page table', MC.lilac, -4.6, 3.4, 0, 2.2, 1.6, 0.8); S.it = bx('inner page table', MC.tlb, 0.2, 3.4, 0, 2.2, 1.6, 0.8);
    arrow(V3(S.p1.position.x, 5.2, 0.5), V3(-4.6, 4.3, 0.5)); arrow(V3(S.p2.position.x, 5.2, 0.5), V3(0.2, 4.3, 0.5));
    cap('前 10 bits 是 outer table 的 index', '後 10 bits 是小 table 裡的 index：合起來還是找得到');
  },
  async (tok, S) => {                                   // 1849 2D array：1000 = 10 × 100
    S.arr = bx('a[1000]', MC.gray, 4.6, 2.0, 0, 2.6, 0.5, 0.8); await wt(tok, 300);
    relabel(S.arr, 'a[10][100]');
    cap('就像寫程式的 array', '1000 個 element 的 array，可以寫成 10 × 100 的 2-level array');
  },
  async (tok, S) => {                                   // 1895 也可以切三層
    sm('還能再切：10 × 10 × 10', 4.6, 1.3);
    cap('也可以再切成三層', '每層越來越小：完全一樣的概念');
  },
  async (tok, S) => {                                   // 1915 最大的 table 只有 2¹⁰ entries
    good('每張 table 最多 2¹⁰ entries', -2.2, 1.4);
    cap('這樣拆解之後', '最大的 page table 只有 2¹⁰ 個 entry');
  },
  async (tok, S) => {                                   // 1932 誤解：total entry 數沒變少，反而多
    bad('但 total entry 數沒有變少，反而多了 outer table', -2.2, 0.7);
    cap('常見的誤解', '要 map 的位置數量一樣：total entry 數其實增加');
  },
  async (tok, S) => {                                   // 1962 重點：每張 4KB = 一個 page → 可放任何 frame
    hot('2¹⁰ × 4 B = 4 KB = 剛好一個 frame', -2.2, 0.0);
    cap('重點是單一 table 變小', '原本要 4MB 連續，現在每張 4KB，任何空 frame 都放得下');
  },
  async (tok, S) => {                                   // 2063 代價：3 次 memory access
    S.cnt = hot('memory access：3 次', 4.6, 5.4);
    cap('代價更明顯', '從兩次 memory access 變成三次：切越細，讀越多次');
  },
  async (tok, S) => {                                   // 2094 圖：outer 每個 entry 指 inner table 存在哪個 frame
    relabel(S.ot, 'outer：存 inner table 在哪個 frame'); relabel(S.it, 'inner：存資料的 frame');
    cap('看圖：2¹⁰ 個 entry 的 outer table', '裡面存的不是 frame number，而是 inner table 放在哪個 frame');
  },
  async (tok, S) => {                                   // 2174 P1 查 outer（1）→ P2 查 inner（2）→ 讀資料（3）
    const k = pkt('p1', MC.purple, S.p1.position.x, 5.6); await slide(tok, k, -4.6, 3.4, 0.6, 500); txt(S.cnt, 'access 1：outer table');
    relabel(k, 'p2'); tint(k, MC.blue); await slide(tok, k, 0.2, 3.4, 0.6, 500); txt(S.cnt, 'access 2：inner table');
    relabel(k, 'f + d'); tint(k, MC.green); await slide(tok, k, 4.6, 3.4, 0.6, 500); txt(S.cnt, 'access 3：讀資料');
    cap('p1 查 outer（第 1 次）→ p2 查 inner（第 2 次）', '得到 frame、加 offset（不用 access），讀資料是第 3 次');
  },
  async (tok, S) => {                                   // 2221 outer table 的位置：PCB 裡的 PTBR
    S.ptbr = bx('PTBR（存在 PCB）', MC.orange, -4.6, 1.9, 0, 2.4, 0.5, 0.8); arrow(V3(-4.6, 2.2, 0.5), V3(-4.6, 2.6, 0.5));
    cap('outer table 存在哪？', 'PCB 裡的 page table base register 指到它；後面幾層就要查表');
  },
]);

scene('mem-12a-64', '64-bit：層數太多', CAMW, [
  async (tok, S) => {                                   // 2272 hierarchical 可以隨便切
    hd('hierarchical：幾層、每層幾 bits 都可以', 0, 6.8);
    cap('這就是 hierarchical page table', '三層、四層、五層；每層幾個 bit 都無所謂');
  },
  async (tok, S) => {                                   // 2293 64 bits：2 level 是 42 | 10 | 12
    const w = 13 / 64; let x = -6.5;
    [[42, 'outer：42', MC.purple], [10, '10', MC.blue], [12, '12', MC.orange]].forEach(([n, t, c]) => { bx(t, c, x + n * w / 2, 5.6, 0, n * w - 0.05, 0.6, 0.9); x += n * w; });
    cap('現代電腦 64 bits', '如果只切 2 level：42 | 10 | 12');
  },
  async (tok, S) => {                                   // 2304 outer 2⁴² → 16 TB
    bad('outer table：2⁴² × 4 B = 16 TB', -2.2, 4.6);
    cap('outer table 有 2⁴² 個 entry', '× 4 bytes = 16 TB：兩層根本不夠');
  },
  async (tok, S) => {                                   // 2326 對分還是 20 幾 bits
    sm('就算對分，每層還是 20 幾 bits', -2.2, 3.9);
    cap('頂多對分', '每層還是二十幾個 bit，非常大');
  },
  async (tok, S) => {                                   // 2337 每層 10～12 bits → 約 5 層
    S.lv = [0, 1, 2, 3, 4].map((i) => bx('L' + (i + 1), MC.lilac, -4.8 + i * 1.6, 2.4, 0, 1.3, 0.6, 0.8));
    cap('每層最好 10～12 bits（剛好一個 frame）', '64-bit 要切到大概 5 個 level');
  },
  async (tok, S) => {                                   // 2362 total memory access 6 倍
    hot('5 層 table + 1 次資料 = 6 次 memory access', 0, 1.3);
    cap('total memory access 變 6 倍', '每多一層，就再多一次 memory access');
  },
  async (tok, S) => {                                   // 2384 實際最多 4 level
    good('實務上最多約 4 level', 0, 0.5);
    cap('真實電腦有這種做法', '但最多做到 4 level 就受不了：cache miss 時代價太大');
  },
]);

scene('mem-12a-hash', 'Hashed page table', CAMW, [
  async (tok, S) => {                                   // 2420 lookup → hashing
    hd('hashed page table', 0, 6.8);
    cap('這其實就是一個 lookup', 'data structure 學過很多 strategy：其中一個是 hashing');
  },
  async (tok, S) => {                                   // 2442 bucket
    S.by = (b) => 5.6 - b * 0.9; S.bk = [];
    for (let b = 0; b < 5; b++) { sm(String(b), -5.9, S.by(b)); S.bk.push(bx('', MC.sand, -5.0, S.by(b), 0, 1.2, 0.7, 0.8)); }
    cap('hashing 基本上就是分 bucket', '');
  },
  async (tok, S) => {                                   // 2456 例：5 個 bucket，mod 5
    sm('hash(p) = p mod 5（例子；frame 值為示意）', -4.2, 6.3);
    cap('hash 方式可以很簡單', '例如 5 個 bucket：mod 5 看餘數');
  },
  async (tok, S) => {                                   // 2479 hash by page number
    S.ch = {}; S.add = (p, f) => { const b = p % 5; S.ch[b] = S.ch[b] || []; const k = S.ch[b].length; const m = bx('p ' + p + ' | f ' + f, MC.tlb, -2.6 + k * 2.4, S.by(b), 0, 2.0, 0.6, 0.8); S.ch[b].push({ p, f, m }); line(-4.3 + k * 2.4, S.by(b), -3.6 + k * 2.4, S.by(b), 0, '#6e5f49'); return m; };
    for (const [p, f] of [[3, 7], [6, 2], [13, 5], [10, 9]]) { S.add(p, f); await wt(tok, 200); }
    cap('一開始只有 page number', '所以 hash by page number，放進對應的 bucket');
  },
  async (tok, S) => {                                   // 2488 bucket 數有彈性，跟 address bit 無關
    S.t6 = note('bucket 數自己定：跟 virtual address 的 bit 數無關', 0, 0.9);
    cap('跟剛才的差別', 'bucket 數很有彈性，不受 virtual address 的 bit 限制');
  },
  async (tok, S) => {                                   // 2502 bucket 少 → collision → 一個個找
    gone(S.t6); S.add(23, 1); S.t7 = [bad('bucket 少 → collision 多 → 要一個一個 search', 0, 0.9)];
    cap('bucket 很少', '會有很多 collision：找到 bucket 後還要一個一個 search');
  },
  async (tok, S) => {                                   // 2514 bucket 多 → 每個只有一兩個
    S.t7.push(good('bucket 多 → 每個只有一兩個 → 很快', 0, 0.2));
    cap('bucket 很多', '每個裡面只有一兩個 entry，就很快；多少個是 tradeoff');
  },
  async (tok, S) => {                                   // 2567 好處：程式用的 address 很分散
    gone(S.t7); S.t9 = [sm('program 用的 address：heap、stack 很分散', 0, 0.9)];
    cap('真正的好處', '程式不會連續使用 virtual address：有 heap、有 stack，很分散');
  },
  async (tok, S) => {                                   // 2594 原本的 table：中間沒用也要 entry
    S.t9.push(sm('一般 page table：中間沒用的也要留 entry', 0, 0.3));
    cap('之前的做法', '最大多少就要留多少 entry：中間沒用到也要有');
  },
  async (tok, S) => {                                   // 2647 hash：沒用到的 page 不在 bucket
    S.t9.push(good('hash：沒用到的 page 根本不在 bucket 裡', 0, -0.35));
    cap('hash 不一樣', '沒用到的 page 不會存在 bucket：用得少又散時很有效率');
  },
  async (tok, S) => {                                   // 2695 缺點：pointer 4 bytes，浪費一倍
    gone(S.t9); S.t12 = [bad('每筆多一個 pointer（4 B）：frame base 也才 4 B → 空間一倍', 0, 0.9)];
    cap('缺點：很多 pointer', 'entry 本來只存 4 bytes 的 frame base，pointer 又 4 bytes');
  },
  async (tok, S) => {                                   // 2720 traverse linked list：每次一 memory access
    S.t12.push(bad('走 linked list：每一步都是一次 memory access', 0, 0.2));
    cap('運氣不好要 traverse', '每走一個 pointer 就是一次 memory access，跟多層 table 一樣');
  },
  async (tok, S) => {                                   // 2738 translation：hash(p) → bucket → 比對 p（3、13、23）
    const q = pkt('找 p = 13', MC.orange, -3.8, 0.2); await slide(tok, q, -4.3, S.by(3) + 0.55, 0.6, 500); glow(S.bk[3], HL);
    for (const e of S.ch[3]) { await slide(tok, q, e.m.position.x, S.by(3) + 0.55, 0.6, 350); glow(e.m, e.p === 13 ? OKG : NG); if (e.p === 13) break; }
    cap('page number 直接 hash 到 bucket 3', '餘數都是 3 的有 3、13、23：要比對原本的值');
  },
  async (tok, S) => {                                   // 2779 entry：page number、frame number、pointer
    gone(S.t12); note('每個 element：page number｜frame number｜pointer', 0, 0.9);
    cap('每個 element 存三樣', 'page number、frame number、pointer；相符才拿 frame');
  },
]);

scene('mem-12a-cluster', 'Clustered：一個 element 裝好幾個 entry', CAMW, [
  async (tok, S) => {                                   // 2796 hashing 缺點：走 linked list
    S.l = [23, 33, 43].map((p, i) => { const m = bx('p ' + p, MC.tlb, -3.6 + i * 2.6, 4.0, 0, 1.6, 0.6, 0.8); if (i) line(-3.6 + (i - 1) * 2.6 + 0.8, 4.0, -3.6 + i * 2.6 - 0.8, 4.0, 0, '#6e5f49'); return m; });
    sm('（同一個 bucket 的 page，示意）', 0, 3.2);
    cap('補充：hashing 的缺點', '要走 linked list，一次只能看一個 entry');
  },
  async (tok, S) => {                                   // 2814 改良：放 list of entries
    await anim(tok, 800, (u) => S.l.forEach((m, i) => { m.position.x = -3.6 + i * 2.6 + ((-1.7 + i * 1.7) - (-3.6 + i * 2.6)) * u; }));
    bx('', MC.lilac, 0, 4.0, -0.5, 5.4, 0.9, 0.2);
    cap('早期就有人提出改良', '一個 element 不只放一個 entry，而是一組（23、33、43 包在一起）');
  },
  async (tok, S) => {                                   // 2840 連續存 → 一次讀進 MMU 比對
    const k = pkt('一次讀進 MMU', MC.green, 0, 4.0, 0.6, 2.0); await slide(tok, k, 0, 1.4, 0.6, 700);
    cap('存在連續的 memory 空間', '像一張小 inner table：一次 load 進 MMU、一次比對');
  },
  async (tok, S) => {                                   // 2868 減少 traverse 次數
    good('減少 linked list traverse 的次數', 0, 0.4);
    cap('就算要 scan 也沒關係', '至少一次讀進去，而不是找好幾次；下課後講 inverted');
  },
]);

// ════════ PTXHd17_NlU（第 12B 講：結構比較、inverted page table、segmentation、Pentium、例題） ════════
scene('mem-12b-review', '三種結構的重點複習', CAMW, [
  async (tok, S) => {                                   // 56 觀念一：切 data structure 為了讓 page table 變小
    hd('觀念一：為什麼要切？讓 page table 變小', 0, 6.8);
    cap('幾個容易混淆的重要觀念', '第一：切這些 data structure，是為了讓 page table 變小');
  },
  async (tok, S) => {                                   // 72 page table 放 physical，已切成 4KB frame
    S.fr = []; for (let i = 0; i < 10; i++) S.fr.push(bx('', [1, 3, 4, 7, 8].includes(i) ? MC.gray : MC.paper, -5.4 + i * 1.2, 5.4, 0, 1.1, 0.7, 0.8));
    sm('physical memory：一格一格 4KB frame（灰：已用）', 0, 4.7);
    cap('page table 也放在 physical memory', '而 physical memory 已經切成 4KB 的 frame');
  },
  async (tok, S) => {                                   // 86 大 table 要連續 frame → 找不到 → out of memory
    const t = bx('大 table：要 10 個連續 frame', MC.red, 0, 6.2, 0.4, 6.0, 0.5, 0.6); void t;
    bad('找不到 → out of memory（其實還有空間）', 0, 4.1);
    cap('放一張很大的 table 要連續的 frame', '不容易找到，可能就說 out of memory，其實還有 memory');
  },
  async (tok, S) => {                                   // 112 觀念二：hierarchical：entry 變多、table 變小、lookup 多次
    hd('觀念二：hierarchical', -3.6, 3.0); sm('entry 變多、每張變小、要 lookup 很多次', -3.6, 2.4);
    cap('第二：hierarchical', 'entry 數量變多，只是每張 table 變小；代價是 memory access 變多');
  },
  async (tok, S) => {                                   // 131 觀念三：hash 的差別：程式使用的位置亂跳
    hd('觀念三：hash 的差別', 3.6, 3.0);
    S.va = []; for (let i = 0; i < 10; i++) S.va.push(bx('', [0, 1, 8, 9].includes(i) ? MC.blue : MC.paper, -5.4 + i * 1.2, 1.2, 0, 1.1, 0.5, 0.8));
    sm('virtual address：頭尾有用、中間沒用（heap、stack）', 0, 0.6);
    cap('第三：跟 hash 的差別', '程式不會從 0 開始乖乖用：dynamic allocation、heap、stack 會亂跳');
  },
  async (tok, S) => {                                   // 161 table：中間沒用到也要 allocate
    S.va.forEach((m, i) => { if (![0, 1, 8, 9].includes(i)) glow(m, NG); });
    cap('如果是 table', '中間沒用到的 page，entry 也必須 allocate，valid bit、length 都沒用');
  },
  async (tok, S) => {                                   // 205 hash：只有用到的 entry 才放進 bucket
    S.va.forEach((m) => glow(m, null)); good('hash：只有用到的 4 個 entry 放進 bucket', 3.6, 2.4);
    cap('hash：只把有用到的 entry 拿去 hashing', '沒用到的不用事先 allocate');
  },
  async (tok, S) => {                                   // 242 空間大、用得散又少 → hash 有效率
    sm('空間很大、用得散又少 → hash 比較有效率', 3.6, 1.9);
    cap('真實系統裡', '空間大但用得散、數量少時，hash 省掉很多 entry');
  },
  async (tok, S) => {                                   // 256 改良：grouping，一次 load 1000 個 entry
    sm('改良：grouping → 一次讀 4KB（約 1000 個 entry）進 MMU', 0, -0.1);
    cap('但它還是 linked list', '改良：grouping，一次 load 很多 entry，減少讀 memory 的次數');
  },
]);

scene('mem-12b-inv', 'Inverted page table', CAMW, [
  async (tok, S) => {                                   // 298 最後一個：inverted page table
    hd('inverted page table', 0, 6.8);
    cap('最後一個：inverted page table', '');
  },
  async (tok, S) => {                                   // 306 不用 page table，用 frame table
    sm('不用 page table，改用 frame table：mapping 倒過來做', 0, 6.2);
    cap('如字面所說', '不用 page table，用 frame table：mapping 可以倒過來做');
  },
  async (tok, S) => {                                   // 323 index 是 frame number，存 page number
    S.E = [['P1', 0], ['P2', 3], ['P1', 2], ['P3', 0], ['P2', 1], ['P1', 3], ['P3', 2], ['P2', 0]];
    S.rows = S.E.map(([pid, p], i) => { sm('frame ' + i, -1.6, 5.4 - i * 0.62); return bx('page ' + p, MC.tlb, 0.4, 5.4 - i * 0.62, 0, 2.4, 0.52, 0.7); });
    sm('（內容為示意）', 0.4, 0.2);
    cap('table 的 index 就是 frame number', '裡面存的是 page number：剛好倒過來');
  },
  async (tok, S) => {                                   // 343 page number 很多重複 → 還要存 PID
    S.rows.forEach((m, i) => { relabel(m, S.E[i][0] + ' | page ' + S.E[i][1]); tint(m, { P1: MC.tlb, P2: MC.lilac, P3: MC.mint }[S.E[i][0]]); });
    cap('frame 只有一個，同號 page 卻很多', '每個 process 都有 page 1：entry 還要存 PID');
  },
  async (tok, S) => {                                   // 376 好處：page table 隨 process 增加
    S.many = [0, 1, 2, 3, 4].map((i) => bx('', MC.sand, -5.4 + i * 0.25, 3.0 - i * 0.25, -i * 0.3, 1.6, 1.4, 0.2)); sm('一萬個 process → 一萬張 page table', -5.0, 1.3);
    cap('為什麼要倒過來？為了省 memory', '一萬個 process 就要管一萬張 page table，還會長');
  },
  async (tok, S) => {                                   // 413 frame 是硬體，不變 → 事先 allocate、大小固定、使用率 100%
    S.gA = [good('frame 數量 = 硬體，不會變：事先 allocate、大小固定', 0.4, -0.5)];
    cap('frame 是 hardware，從來不變', 'frame table 可事先 allocate，size 不用動，使用率接近 100%');
  },
  async (tok, S) => {                                   // 454 所有 page table 加起來 >> frame table
    gone(S.many); S.gA.push(good('全系統一張，大小只看 physical memory', 0.4, -1.15));
    cap('比單一張 page table 大', '但所有 process 的 page table 加起來，一定遠大於 frame table');
  },
  async (tok, S) => {                                   // 490 缺點一：要 search
    gone(S.gA); S.gB = [bad('缺點一：要 search', 0.4, -0.5)];
    cap('兩個缺點', '第一：translation 時要 search 這張 frame table');
  },
  async (tok, S) => {                                   // 505 page table 直接跳；frame table 沒順序
    S.gB.push(sm('page table：page 3 直接跳第 3 格', 0.4, -1.15), sm('frame table：沒有順序，只能找', 0.4, -1.8));
    cap('page table 可以直接跳', 'frame 屬於不同 process 的不同 page，沒有 ordering');
  },
  async (tok, S) => {                                   // 528 缺點二：sharing 很難
    gone(S.gB); S.b2 = bad('缺點二：一個 frame 只記一個 (pid, page) → sharing 很難', 0.4, -0.5);
    cap('第二：sharing 很難', '一個 entry 只能對到一個 page，兩個 page 共用一個 frame 就沒辦法');
  },
  async (tok, S) => {                                   // 560 圖：給 (pid, p) → search → index = frame
    const q = pkt('(P1, page 3, d)', MC.blue, -5.2, 5.0, 0.6, 2.4);
    for (let i = 0; i < S.E.length; i++) { q.position.set(-3.6, 5.4 - i * 0.62, 0.6); const hit = S.E[i][0] === 'P1' && S.E[i][1] === 3; glow(S.rows[i], hit ? OKG : DIMG); await wt(tok, 160); if (hit) break; glow(S.rows[i], null); }
    relabel(q, '(frame 5, d)'); tint(q, MC.green);
    cap('給 PID 跟 p，一個一個 entry search', '找到第 5 個 entry → 它就是 frame 5，再接上 d');
  },
  async (tok, S) => {                                   // 619 virtual bits >> physical → entry 少；全系統一張
    S.gC = [good('virtual 的 bit 數通常遠大於 physical → entry 少', 0.4, -1.15)];
    cap('好處', 'size 只跟 physical memory 有關，整個系統一張就好');
  },
  async (tok, S) => {                                   // 656 可以整張 load 進 MMU 加速 search
    S.gC.push(sm('連續的 table → 可以 load 進 MMU 做 linear search', 0.4, -1.8));
    cap('search 可以加速', 'table entry 是連續的：一次 load 到 MMU 裡 search');
  },
  async (tok, S) => {                                   // 672 page sharing 很難 → 很少見
    gone(S.gC); hot('page sharing 太重要 → inverted 很少見', 0.4, -1.15);
    cap('更難解決的是 page sharing', '很難做得好，所以這個做法很少見');
  },
]);

scene('mem-12b-seg', 'Segmentation：用 programmer 的角度切', CAMW, [
  async (tok, S) => {                                   // 760 segmentation；segmentation fault
    hd('segmentation', 0, 6.8); bad('你們拿到的是 segmentation fault，不是 page fault', 0, 6.2);
    cap('最後要介紹 segmentation', '寫程式時拿到的錯是 segmentation fault');
  },
  async (tok, S) => {                                   // 771 OS 兩個都用；segmentation 離 programmer 近
    sm('programmer → segmentation → paging → physical', 0, 5.6);
    cap('OS 兩個都用', '離 programmer 比較近的是 segmentation；先把 paging 放一邊');
  },
  async (tok, S) => {                                   // 797 allocation：fixed size vs variable size
    S.t = [bx('fixed size', MC.gray, -3.0, 4.6, 0, 2.4, 0.6, 0.8), bx('variable size', MC.gray, 3.0, 4.6, 0, 2.4, 0.6, 0.8)];
    cap('allocation 分 fixed 跟 variable size', 'fixed size 就是 paging（固定 4KB）');
  },
  async (tok, S) => {                                   // 812 variable-size + discontiguous → segmentation
    relabel(S.t[0], 'fixed → paging'); relabel(S.t[1], 'variable → segmentation'); tint(S.t[1], MC.teal);
    cap('variable size 的不連續配置', '名字就叫 segmentation');
  },
  async (tok, S) => {                                   // 820 以使用者的角度切
    S.nu = note('不只大小不同：以使用者的角度切 program 的 memory', 3.0, 3.9);
    cap('更重要的是', '它以使用者的角度去想：怎麼切割 program 的 memory');
  },
  async (tok, S) => {                                   // 837 program 是好幾個 segment：code、function、object
    S.sg = [['main', 1.0, MC.blue], ['function', 0.6, MC.green], ['object', 0.8, MC.orange]].map(([n, h, c], i) => bx(n, c, -5.4 + i * 1.7, 2.4, 0, 1.5, h, 0.8));
    cap('program 本來就是好幾個 segment', 'code segment、call stack 裡的 function、OO 的 object');
  },
  async (tok, S) => {                                   // 856 heap、stack、symbol table
    [['heap', 1.2, MC.purple], ['stack', 0.9, MC.pink], ['symbol table', 0.5, MC.teal]].forEach(([n, h, c], i) => S.sg.push(bx(n, c, -0.3 + i * 1.8, 2.4, 0, 1.6, h, 0.8)));
    cap('還有 heap、stack', '學過 compiler 就知道還有 symbol table：都是一個一個的物件');
  },
  async (tok, S) => {                                   // 884 每個 size 不同、會長
    await anim(tok, 800, (u) => { S.sg[3].scale.y = 1 + 0.5 * u; S.sg[4].scale.y = 1 + 0.4 * u; });
    cap('每個大小不一樣', 'stack、heap 還可能動態長：都是 variable size');
  },
  async (tok, S) => {                                   // 914 segmentation：依內容切；assembly 的 code / data segment
    S.sg.forEach((m) => glow(m, HL)); sm('assembly：code segment、data segment', 0, 1.0);
    cap('依 code 的 memory 內容切成 segment', '寫過 assembly 就知道：code segment、data segment');
  },
  async (tok, S) => {                                   // 948 load 時：segment table 做 translation，放任何位置
    gone(S.nu); S.sg.forEach((m) => glow(m, null)); S.tb = bx('segment table', MC.lilac, 5.6, 4.0, 0, 2.2, 1.0, 0.8);
    cap('load 時怎麼擺？', '跟 paging 一樣，需要一個 segment table 做 translation');
  },
  async (tok, S) => {                                   // 964 缺點：external fragmentation
    bad('variable size → external fragmentation 嚴重', 3.6, 0.3);
    cap('比較討厭的是', 'variable size：external fragmentation 會很嚴重');
  },
]);

scene('mem-12b-segx', 'Segmentation 的 address translation', CAMW, [
  async (tok, S) => {                                   // 988 translation
    hd('segmentation 的 address translation', 0, 6.8);
    cap('來做 translation', '');
  },
  async (tok, S) => {                                   // 992 logical address = (segment number, offset)
    S.s = bx('s：segment number', MC.purple, -4.6, 5.8, 0, 2.8, 0.6, 0.8); S.d = bx('d：offset', MC.orange, -1.6, 5.8, 0, 2.6, 0.6, 0.8);
    cap('logical address 跟 paging 很像', '前面是第幾個 segment，offset 是 segment 裡的位置');
  },
  async (tok, S) => {                                   // 1030 paging offset 只到 4KB；segment offset 可以很大
    S.d.scale.x = 1.5; S.d.position.x = -1.0;
    cap('很大的不同', 'paging 的 offset 只到 4KB；segment 可以長到任意大');
  },
  async (tok, S) => {                                   // 1078 系統定義 segment 最大多少（如 4GB）
    sm('offset 的 bit 數 = 系統定義一個 segment 最大多大（例如 4GB）', -2.6, 5.1);
    cap('offset 的 bit 數', '只跟系統定義一個 segment 能長多大有關');
  },
  async (tok, S) => {                                   // 1099 table 每個 entry：base
    S.tb = [[1000, 1400], [400, 6300], [400, 4300], [1100, 3200], [1000, 4700]];
    S.lim = S.tb.map(([l], i) => { sm(String(i), 0.6, 4.2 - i * 0.6); return bx('limit ' + l, MC.lilac, 1.9, 4.2 - i * 0.6, 0, 1.9, 0.5, 0.7); });
    S.base = S.tb.map(([, b], i) => bx('base ' + b, MC.mint, 4.0, 4.2 - i * 0.6, 0, 1.9, 0.5, 0.7));
    S.lim.forEach((m) => { m.visible = false; m.userData.lbl.visible = false; });
    hd('segment table', 3.0, 4.9); sm('數字取自課本圖例（示意）', 3.0, 0.9);
    cap('table 跟 page table 很像', '每個 entry 指到一個 segment：存它的 base address');
  },
  async (tok, S) => {                                   // 1116 limit：長度任意 → 判斷 offset 是否有效
    S.lim.forEach((m) => { m.visible = true; m.userData.lbl.visible = true; });
    cap('多了一個 limit', 'segment 長度任意：要 limit 才知道 offset 有沒有效');
  },
  async (tok, S) => {                                   // 1162 table 位置存在 PCB；length（只用 4 個）
    sm('segment table 的位置存在 PCB；也有 length', 3.0, 0.4);
    cap('跟 paging 一樣', 'table 的 pointer 存在 PCB；也有 length：只用到幾個就寫幾');
  },
  async (tok, S) => {                                   // 1199 圖：s → index → base
    relabel(S.s, 's = 2'); relabel(S.d, 'd = 53');
    const k = pkt('s = 2', MC.purple, -4.6, 5.8); await slide(tok, k, 1.9, 4.2 - 2 * 0.6 + 0.4, 0.6, 600); gone(k);
    glow(S.lim[2], HL); glow(S.base[2], HL);
    cap('最重要的圖', 's 就是 table 的 index：第 2 個 segment → limit 400、base 4300');
  },
  async (tok, S) => {                                   // 1215 是「加」不是接：segment 可從任意 byte 開始
    S.res = hot('4300 + 53 = 4353', -2.0, 2.4);
    cap('這裡是真的「加」', 'segment 可從任意 byte 開始，不在 4KB boundary：兩個數字相加');
  },
  async (tok, S) => {                                   // 1261 offset < limit，否則 segmentation fault
    good('53 < 400 ✓', -2.0, 3.1);
    const k = pkt('(1, 500)', MC.blue, -4.6, 1.2, 0.6, 1.6); await slide(tok, k, -2.0, 1.2, 0.6, 400); tint(k, MC.red);
    bad('500 ≥ 400 → segmentation fault', -2.0, 0.5);
    cap('offset 要比 limit 小', '超過就是無效：天天看到的 segmentation fault（第二個例子為示意）');
  },
  async (tok, S) => {                                   // 1284 每個 segment 獨立控制大小、permission
    sm('heap 可設 10GB、data 1GB；也可設 read / write 權限', 0, -0.1);
    cap('每個 segment 完全獨立控制', 'limit 可以設不同；permission 不對也丟 segmentation fault');
  },
  async (tok, S) => {                                   // 1330 segment 不會 overlap；sharing 要整個 segment
    note('segment 之間永遠不 overlap；要 share 就 share 整個 segment', 0, 6.2);
    cap('不同 segment 永遠不會重疊', '要 sharing 就 create 獨立的 segment，share 給兩個 process');
  },
]);

scene('mem-12b-segshare', 'Segmentation vs paging、sharing 與 protection', CAMW, [
  async (tok, S) => {                                   // 1402 summary：segment entry 有 base + limit
    S.a = bx('page table entry：frame base', MC.sand, -3.4, 6.0, 0, 3.6, 0.6, 0.8); S.b = bx('segment table entry：base + limit', MC.lilac, 3.4, 6.0, 0, 3.6, 0.6, 0.8);
    cap('summary', 'page 存 frame 的 base；segment 除了 base 還有 limit');
  },
  async (tok, S) => {                                   // 1421 segment base 任意位置；page 在 boundary → append
    S.s1 = sm('page：base 一定在 4KB boundary → 後面全是 0 → 直接 append', -3.4, 5.3);
    cap('第二：segment base 可以是任何位置', 'page 一定在 frame 的 boundary：只記 frame number，後面接上 offset');
  },
  async (tok, S) => {                                   // 1450 segment 要乖乖相加
    S.s2 = sm('segment：base 任意 → 要乖乖相加', 3.4, 5.3);
    cap('segment 就要乖乖用加的', '');
  },
  async (tok, S) => {                                   // 1456 例：process 每個 content 一個 segment
    hd('logical', -5.2, 4.4); S.sg = [['main', MC.blue], ['heap', MC.purple], ['stack', MC.pink], ['editor', MC.orange]].map(([n, c], i) => bx(n, c, -5.2, 3.7 - i * 0.75, 0, 1.6, 0.6, 0.8));
    cap('實際例子', 'process 的每一塊 memory content 是一個 segment：寫 code 時就告訴 OS 了');
  },
  async (tok, S) => {                                   // 1484 MMU 用 free list 找空間（best fit…）
    hd('physical', 4.6, 4.4); S.ph = [3.7, 2.5, 1.0].map((y, i) => bx(['main', 'heap', 'stack'][i], [MC.blue, MC.purple, MC.pink][i], 4.6, y, 0, 2.0, [0.6, 1.0, 0.7][i], 0.8));
    cap('告訴 OS 要多少空間', '用 free list 找有空間的地方填 base：就是 variable size allocation（best fit 等）');
  },
  async (tok, S) => {                                   // 1523 sharing：editor 跨好幾個 page，不在 boundary
    S.pgd = [0, 1, 2].map((i) => bx('', MC.orange, 0.2 + i * 1.0, 1.2, 0, 0.9, 0.5, 0.6)); sm('editor 跨 3 個 page，最後一個沒用完', 1.2, 0.5);
    cap('為什麼 sharing 在 segment 層做？', 'editor 可能橫跨好幾個 page、不在 boundary：在 page 層 share 很複雜');
  },
  async (tok, S) => {                                   // 1550 segment：editor 就是一個 segment
    gone(S.pgd); glow(S.sg[3], HL);
    cap('program 本來就是用 segment 寫的', 'editor 一定是一個 segment；load 一個 library 就是一個新 segment');
  },
  async (tok, S) => {                                   // 1571 43062 bytes exactly
    S.ed = bx('editor：limit 43062', MC.orange, 4.6, -0.2, 0, 2.6, 0.6, 0.8); glow(S.sg[3], null);
    cap('segment table 裡的一個 entry', 'byte 數可以控制：editor 剛好 43062 bytes，多一個 byte 都不 share');
  },
  async (tok, S) => {                                   // 1601 兩個 process 指到同一個 physical segment
    hd('P2', -1.8, 4.4); const e2 = bx('editor', MC.orange, -1.8, 3.7, 0, 1.6, 0.6, 0.8); void e2;
    line(-4.4, 1.45, 3.3, -0.2, 0.3, '#dd8238'); line(-1.0, 3.7, 3.3, -0.2, 0.3, '#dd8238');
    cap('一樣的例子', '兩個 process 的 editor segment，指到同一個 physical segment');
  },
  async (tok, S) => {                                   // 1617 protection：rwx
    sm('editor：read / execute（不能 write）', 4.6, -0.8);
    cap('protection', 'paging 的 bit 主要是 valid（給 virtual memory 用）；segment 的 bit 多拿來做 rwx');
  },
  async (tok, S) => {                                   // 1648 thread：heap share，stack 不 share
    glow(S.sg[1], OKG); glow(S.sg[2], NG); sm('heap：share　stack：non-sharing', -5.2, 0.4);
    cap('還記得 thread 嗎？', 'heap 是 share 的、stack 不 share：stack 和 heap 是兩個 segment');
  },
  async (tok, S) => {                                   // 1686 方法：base address 設成相同
    gone(S.s1, S.s2); good('方法：兩張 segment table 的 base 設成一樣', 0, 5.4);
    cap('方法很簡單', '把 base address 設成相同，指到同一個 physical 位置');
  },
]);

scene('mem-12b-segpage', 'Segmentation + paging：linear address', CAMW, [
  async (tok, S) => {                                   // 1717 segmentation 在上面
    hd('segmentation 在上、paging 在下', 0, 6.8);
    cap('最後', '電腦的 segmentation 在上面：programming 用這個概念');
  },
  async (tok, S) => {                                   // 1727 壞處：external fragmentation
    bad('只用 segmentation → external fragmentation', 0, 6.2);
    cap('它的壞處', '很容易有 external fragmentation');
  },
  async (tok, S) => {                                   // 1735 segment 之後再做 paging
    S.sp = sm('segment 之後 → 再做 paging', 0, 5.6);
    cap('所以電腦在 segment 之後', '再對它做 paging');
  },
  async (tok, S) => {                                   // 1744 圖：process 的 segment 不同顏色
    hd('logical（segment）', -5.2, 5.4); S.sg = [['code', 0.9, MC.blue], ['heap', 1.4, MC.purple], ['stack', 0.8, MC.pink]].map(([n, h, c], i) => bx(n, c, -5.2, 4.6 - [0, 1.2, 2.7][i], 0, 1.6, h, 0.8));
    cap('看這個圖', '一個 process 的 memory content：不同顏色是不同 segment');
  },
  async (tok, S) => {                                   // 1757 中間：linear address（假空間）
    gone(S.sp); hd('linear address space（假的）', 0, 5.4); S.lin = bx('', MC.paper, 0, 2.6, -0.4, 2.0, 5.0, 0.2);
    S.ls = [[4.4, 0.9, MC.blue], [2.9, 1.4, MC.purple], [0.7, 0.8, MC.pink]].map(([y, h, c]) => bx('', c, 0, y, 0, 1.8, h, 0.6));
    cap('中間是一個假的空間', '叫 linear address：segment 放到各處，中間有洞也無所謂');
  },
  async (tok, S) => {                                   // 1791 一個 segment 切成好幾個 page
    S.cuts = []; for (let y = 0.4; y < 5.0; y += 0.55) S.cuts.push(bx('', '#6e5f49', 0, y, 0.35, 2.0, 0.03, 0.05));
    cap('一個 segment 可以再切成好多個 page', '把這個大空間用 paging 切成 fixed size：一個 segment 跨三四個 page');
  },
  async (tok, S) => {                                   // 1812 套 paging，map 到 physical frame
    hd('physical', 5.2, 5.4); for (let f = 0; f < 8; f++) bx('', MC.paper, 5.2, 4.8 - f * 0.6, -0.3, 1.6, 0.52, 0.2);
    const cols = [MC.blue, MC.purple, MC.purple, MC.pink, MC.blue, MC.purple]; const fs = [6, 1, 4, 0, 3, 7];
    for (let i = 0; i < 6; i++) { const m = bx('', cols[i], 0, 4.6 - i * 0.7, 0.6, 1.0, 0.45, 0.4); await slide(tok, m, 5.2, 4.8 - fs[i] * 0.6, 0.2, 300); }
    cap('套用之前學的 paging', '把 page 一個一個放到 physical 的 frame 上');
  },
  async (tok, S) => {                                   // 1830 好處：programmer、compiler 只管 segment
    good('programmer、compiler：只管 segment 和 offset', -5.2, 0.4);
    cap('好處', 'programmer 用 segment 寫程式；compiler 不用管落在哪個 page');
  },
  async (tok, S) => {                                   // 1856 沒有 external，internal 很少
    good('切成小 page：沒有 external，internal 很少', 2.6, -0.3);
    cap('MMU 再切成很多小 page', '完全沒有 external fragmentation，internal 很少：使用率很高');
  },
  async (tok, S) => {                                   // 1894 CPU logical → segmentation unit → linear → paging unit → physical
    gone(S.ls, S.cuts, S.lin, S.sg);
    const st = [['CPU', MC.dark], ['segmentation unit', MC.lilac], ['paging unit', MC.tlb], ['memory', MC.blue]];
    S.u = st.map(([n, c], i) => bx(n, c, -5.4 + i * 3.6, 3.0, 0.8, 2.4, 0.8, 0.8));
    sm('logical', -3.6, 3.7, 0.8); sm('linear', 0, 3.7, 0.8); sm('physical', 3.6, 3.7, 0.8);
    cap('officially 整個過程', 'CPU 送 logical → segmentation → linear → paging → physical');
  },
  async (tok, S) => {                                   // 1962 兩個 unit 都在 MMU
    bx('', '#f1d3d3', -0.6, 3.0, 0.2, 7.6, 1.6, 0.2); hd('MMU', -0.6, 4.1, 0.3);
    cap('segmentation unit 和 paging unit', '都在 MMU 裡：先 segmentation，再 paging');
  },
]);

scene('mem-12b-pentium', 'Intel Pentium 的位址轉換', CAMW, [
  async (tok, S) => {                                   // 1977 Pentium 的例子
    hd('Intel Pentium（早期 CPU）', 0, 6.8);
    cap('具體例子：Pentium', '它怎麼結合兩種 translation');
  },
  async (tok, S) => {                                   // 1996 logical address 48 bits
    const w = 12 / 48; S.sel = bx('selector：16', MC.purple, -6 + 8 * w, 5.8, 0, 16 * w - 0.05, 0.6, 0.9); S.off = bx('offset：32', MC.orange, -6 + 32 * w, 5.8, 0, 32 * w - 0.05, 0.6, 0.9);
    cap('一開始拿到 logical address', '例如 48 bits，分成兩個 part');
  },
  async (tok, S) => {                                   // 2014 offset 32 bits → segment 最多 4GB
    glow(S.off, HL); sm('一個 segment 最多 2³² = 4 GB', 2.0, 5.1);
    cap('後面 32 bits 是 segment offset', '一個 segment 最多 4GB：是 heap 或 stack 不能超過 4GB，不是整個程式');
  },
  async (tok, S) => {                                   // 2044 selector 16 bits：13 bits segment number
    glow(S.off, null); gone(S.sel); const w = 12 / 48;
    S.sn = bx('s：13', MC.purple, -6 + 6.5 * w, 5.8, 0, 13 * w - 0.05, 0.6, 0.9); S.g = bx('g', MC.teal, -6 + 13.5 * w, 5.8, 0, w - 0.03, 0.6, 0.9); S.pp = bx('p', MC.pink, -6 + 15 * w, 5.8, 0, 2 * w - 0.03, 0.6, 0.9);
    S.g.userData.lbl.position.y = 0.55; S.pp.userData.lbl.position.set(0.7, -0.55, 0);
    sm('最多 2¹³ 個 segment', -4.4, 5.1);
    cap('前面 16 bits 是 selector', '只有 13 bits 是 segment number：最多 2¹³ 個 segment');
  },
  async (tok, S) => {                                   // 2070 1 bit：share / local
    glow(S.g, HL); sm('1 bit：local 或 shared segment', -2.2, 4.5);
    cap('這 1 個 bit', '標示 local（private）還是 share 的 segment');
  },
  async (tok, S) => {                                   // 2119 2 bits：protection
    glow(S.g, null); glow(S.pp, HL); sm('2 bits：protection（read / write / execute）', -2.2, 4.0);
    cap('後面還有 protection bit', '用兩個 bit 區分 read only、write、executable');
  },
  async (tok, S) => {                                   // 2129 2¹⁴ 個 segment，一半 share
    glow(S.pp, null); hot('最多 2¹⁴ 個 segment（一半 share、一半 private），每個最多 4 GB', 0, 3.3);
    cap('有意義的是 13 bits + 1 bit', '最多 2¹⁴ 個 segment，一個最多 4GB');
  },
  async (tok, S) => {                                   // 2160 先 segmentation：兩張 table（private / share）
    S.t1 = bx('private（local）segment table', MC.lilac, -3.4, 2.0, 0, 3.6, 0.6, 0.8); S.t2 = bx('shared segment table', MC.mint, -3.4, 1.2, 0, 3.6, 0.6, 0.8);
    cap('translation：先不要想 paging', '那個 bit 決定查哪一張：private 和 share 是兩張完全不同的 table');
  },
  async (tok, S) => {                                   // 2196 13 bits index → base；+ offset → linear 32 bits
    glow(S.t2, HL); S.lin = bx('linear address：32 bits', MC.paper, 3.2, 1.6, 0, 4.4, 0.7, 0.9);
    cap('13 bits 當 index 讀出 base', 'base（32 bits）+ offset → 得到 linear address');
  },
  async (tok, S) => {                                   // 2280 linear → 2-level：10 | 10 | 12
    glow(S.t2, null); gone(S.lin); const w = 6 / 32;
    S.l = [[10, 'outer 10', MC.purple], [10, 'inner 10', MC.blue], [12, 'offset 12', MC.orange]].reduce((a, [n, t, c]) => { const x0 = a.x; a.m.push(bx(t, c, x0 + n * w / 2, 1.6, 0, n * w - 0.05, 0.7, 0.9)); a.x += n * w; return a; }, { x: 0.2, m: [] }).m;
    cap('linear address 交給 paging', 'Pentium 用 2-level page table：10 | 10 | 12');
  },
  async (tok, S) => {                                   // 2305 outer → inner → frame + offset
    for (const [i, t] of [[0, 'outer table'], [1, 'inner table']]) { const k = pkt(t, i ? MC.tlb : MC.lilac, S.l[i].position.x, 0.8, 0.6, 1.6); await wt(tok, 300); void k; }
    hot('→ frame number + offset', 3.2, -0.1);
    cap('前 10 bits 查 outer、再 10 bits 查 inner', '得到 frame number 再加 offset；paging 不 care 那串 bit 叫什麼');
  },
  async (tok, S) => {                                   // 2350 也支援 4MB page：22-bit offset
    relabel(S.l[2], 'offset 22（4MB page）'); S.l[2].scale.x = 22 / 12; S.l[2].position.x = 0.2 + 10 * 6 / 32 + 11 * 6 / 32; S.l[1].visible = false; S.l[1].userData.lbl.visible = false;
    cap('Intel 同時支援 4KB 和 4MB page', 'outer 表查完有個 bit：4MB 時後面 22 bits 全當 offset');
  },
  async (tok, S) => {                                   // 2435 physical 有大 page、小 page
    for (let i = 0; i < 2; i++) bx('4MB', MC.green, -5.2 + i * 1.8, -0.4, 1.2, 1.6, 0.8, 0.6); for (let i = 0; i < 6; i++) bx('', MC.mint, -1.4 + i * 0.45, -0.6, 1.2, 0.4, 0.4, 0.6);
    cap('physical memory 裡', '前面是很大的 4MB page，後面是小的 4KB page：大程式用大的');
  },
]);

scene('mem-12b-exam', '期中考例題：segmentation + paging', CAMW, [
  async (tok, S) => {                                   // 2490 summarize：例題
    hd('例題：segmentation + paging', 0, 6.8);
    cap('真實系統不用想那麼複雜', '把基本的 paging、segmentation 和兩者合起來會轉換就好');
  },
  async (tok, S) => {                                   // 2516 期中考常考
    S.mt = sm('前幾年期中考每次都考類似的', 0, 6.2);
    cap('回去一定要自己看', '至少這一題要做得出來');
  },
  async (tok, S) => {                                   // 2525 physical 512 bytes → 9 bits
    S.g1 = sm('physical 512 B = 2⁹ → physical address 9 bits', -3.6, 5.5);
    cap('physical memory size 512 bytes', '腦中馬上想到：512 = 2⁹，physical address 是 9 bits');
  },
  async (tok, S) => {                                   // 2535 page 32 bytes → offset 5 bits
    sm('page 32 B = 2⁵ → page offset 5 bits', -3.6, 5.0);
    cap('page size 32 bytes', '馬上跳出來：5 bits 是 page offset');
  },
  async (tok, S) => {                                   // 2545 8 個 segment → 前 3 bits
    sm('8 個 segment = 2³ → 前 3 bits 是 segment number', -3.6, 4.5);
    cap('一共 8 個 segment', 'virtual address 前 3 bits 是 segment number，剩下都是 segment offset');
  },
  async (tok, S) => {                                   // 2560 logical 0x448 → 12 bits
    S.b = bits('010001001000', -6.0, 3.4, (i) => (i < 3 ? MC.purple : MC.orange));
    hd('logical 0x448', 1.6, 3.4);
    cap('給你 logical address 0x448', '先換成 12 個 bit：0100 0100 1000');
  },
  async (tok, S) => {                                   // 2579 前 3 bits → segment 2
    hot('s = 010₂ = 2', -5.5, 2.7); sm('segment offset = 0 0100 1000₂ = 72', 0.0, 2.7);
    cap('hint：3 bits 是 segment', '看前 3 bits：答案是 2');
  },
  async (tok, S) => {                                   // 2592 查 segment table 第 2 個 → base
    S.st = tbl(4.4, 5.4, ['base₀', 'base₁', 'base₂', '…'], { dy: 0.55, title: 'segment table', c: MC.lilac }); glow(S.st.cells[2], HL);
    cap('查 segment table 的第 2 個位置', '讀出這個 segment 的 base address');
  },
  async (tok, S) => {                                   // 2600 base + segment offset → linear
    S.lin = hot('linear = base₂ + 72（9 bits）', -2.0, 1.9);
    cap('base 跟剩下的 bit（segment offset）相加', '得到一串數字：linear address');
  },
  async (tok, S) => {                                   // 2616 paging：後 5 bits offset、前 4 bits page number = 5
    S.lb = bits('0101ddddd', -6.0, 1.0, (i) => (i < 4 ? MC.blue : MC.orange));
    sm('page number = 0101₂ = 5', -5.2, 0.4);
    cap('回到 paging', 'page offset 5 bits，剩下 4 bits 是 page number：轉成數字是 5');
  },
  async (tok, S) => {                                   // 2636 page table 第 5 個 entry = 2
    S.pt = tbl(4.4, 2.6, ['', '', '', '', '', '2'], { dy: 0.4, w: 1.0, title: 'page table', c: MC.tlb }); glow(S.pt.cells[5], HL);
    cap('看 page table 第 5 個 entry', '是 2：frame number');
  },
  async (tok, S) => {                                   // 2641 2 換掉前 4 bits，後面照抄 → physical
    bits('0010ddddd', -1.4, 1.0, (i) => (i < 4 ? MC.green : MC.orange));
    hot('physical = 2 × 32 + (linear 的低 5 bits)', -0.2, 0.2);
    cap('2 就是前面這 4 個 bit', '後面照抄：得到 physical address');
  },
  async (tok, S) => {                                   // 2657 MMU 保證不 overlap；超過 limit 擋掉
    note('有效性由 MMU 保證：offset 超過 segment 長度 → 擋掉', 0, -0.6);
    cap('不用擔心會不會跟別人撞', 'allocate 時 MMU 確認過；offset 超過 segment 長度就被打掉');
  },
  async (tok, S) => {                                   // 2711 第八章結束：考前 go through 例子
    gone(S.mt); good('本章結束：考前一定要把這些例子 go through', 0, 6.2, 0.6);
    cap('第八章就到這裡', '考前一定要 go through 這些例子');
  },
]);

// ════════ pJ6qrCB8pDw（Paging in Operating Systems with Example） ════════
scene('mem-pg-why', '為什麼需要 paging：RAM 不夠用', CAMW, [
  async (tok, S) => {                                   // 52 paging 幫我們達成什麼
    hd('paging 幫我們做到什麼？', 0, 6.8);
    cap('先理解 paging 是什麼', '它到底幫我們做到什麼');
  },
  async (tok, S) => {                                   // 60 desktop：RAM、hard disk、CPU
    S.cpu = prop('cpu', -5.0, 0, 0, 1.2, 'CPU'); S.ram = bx('RAM（primary）', MC.blue, -0.6, 1.2, 0, 2.6, 1.6, 1.2); S.hd = prop('disk', 4.6, 0, 0, 1.6, 'hard disk（secondary）');
    cap('一台桌機或筆電', '三個元件：RAM（主記憶體）、hard disk、CPU');
  },
  async (tok, S) => {                                   // 100 RAM 有限：4GB～128GB vs disk 1TB
    sm('RAM：4 GB～128 GB', -0.6, 2.6); S.ds = sm('disk：500 GB、1 TB 起跳', 4.6, 2.8);
    cap('RAM 的容量很有限', 'RAM 約 4～128 GB，硬碟動輒 1 TB');
  },
  async (tok, S) => {                                   // 127 RAM 貴但快、volatile；執行時搬進 RAM
    const p = pkt('program', MC.orange, 4.6, 2.0); await slide(tok, p, -0.6, 2.0, 0.8, 800);
    cap('RAM 很貴，但非常快（volatile）', '程式存在硬碟，要執行時搬進 RAM，CPU 才跑得快');
  },
  async (tok, S) => {                                   // 165 程式越來越複雜；multitasking
    S.apps = [0, 1, 2, 3, 4, 5].map((i) => bx('app', [MC.green, MC.purple, MC.pink, MC.teal, MC.orange, MC.green][i], -1.6 + (i % 3) * 1.0, 3.6 + Math.floor(i / 3) * 0.6, 0, 0.9, 0.5, 0.6));
    cap('程式越來越複雜，RAM 卻沒變大多少', 'multitasking：工作管理員裡幾百個 process');
  },
  async (tok, S) => {                                   // 196 RAM 滿了 → memory management
    tint(S.ram, MC.red); bad('RAM 滿了！', -0.6, 5.2);
    cap('遊戲、繪圖軟體吃更多 RAM', '整個 RAM 滿了：這就需要 memory management');
  },
  async (tok, S) => {                                   // 211 paging 由 MMU 實作
    S.mmu = bx('MMU', '#f1d3d3', -3.0, 3.2, 0, 1.4, 0.8, 0.8);
    cap('paging 是一種有效管理 memory 的方法', '由 memory management unit（MMU）實作');
  },
  async (tok, S) => {                                   // 228 一部分 disk 當 virtual RAM
    gone(S.ds); S.vr = bx('virtual memory 區', MC.lilac, 4.6, 2.6, 0, 2.6, 0.6, 1.0);
    cap('把一部分 secondary memory 拿來用', '影片叫 virtual RAM：存放 process 的 page');
  },
  async (tok, S) => {                                   // 263 沒在用的 app 移到 disk，需要再搬回
    tint(S.ram, MC.blue);
    for (const i of [4, 5]) await slide(tok, S.apps[i], 4.6 + (i - 4.5) * 1.0, 3.2, 0, 600);
    cap('CPU 在跑其中幾個 app', '沒在用的移到 disk，需要時再搬回來');
  },
  async (tok, S) => {                                   // 283 不是真的加 RAM
    good('沒有真的加 RAM，而是借用 disk 的空間', 0, 0.0, 1.6);
    cap('不是實體地加 RAM', '而是用一部分 secondary memory：這就是 paging 的核心想法');
  },
]);

scene('mem-pg-theory', 'Paging 的定義：page、frame、MMU', CAMW, [
  async (tok, S) => {                                   // 300 theory
    hd('paging 的理論', 0, 6.8);
    cap('詳細看 paging 怎麼運作', '左邊理論，右邊同一張圖');
  },
  async (tok, S) => {                                   // 337 相同大小的 block：pages
    S.vm = []; for (let i = 0; i < 5; i++) S.vm.push(bx('', MC.lilac, 3.0 + (i % 5) * 0.85, 5.0, 0, 0.8, 0.6, 0.8));
    hd('secondary（virtual memory）', 4.7, 5.8);
    cap('OS 以相同大小的 block 搬資料', '這些 block 叫 pages');
  },
  async (tok, S) => {                                   // 354 例：每格 2KB
    S.vm.forEach((m) => relabel(m, '2KB'));
    cap('固定大小，例如每格 2KB', '');
  },
  async (tok, S) => {                                   // 365 paging 是 virtual memory 實作的重要部分
    note('paging：virtual memory 實作的重要部分', 4.7, 6.4);
    cap('paging 是 virtual memory 的重要部分', 'physical memory 不夠時，用它存放程式');
  },
  async (tok, S) => {                                   // 380 non-contiguous；避免 external fragmentation
    good('non-contiguous allocation、沒有 external fragmentation', -2.6, 0.3);
    cap('可以做 non-contiguous allocation', '也幫助解決 external fragmentation');
  },
  async (tok, S) => {                                   // 391 logical address space → 等大小 pages
    S.la = []; for (let i = 0; i < 5; i++) S.la.push(bx('page ' + i, [MC.blue, MC.orange, MC.green, MC.purple, MC.pink][i], -5.0, 5.0 - i * 0.7, 0, 1.8, 0.6, 0.8));
    hd('logical address space', -5.0, 5.8);
    cap('logical address space', '切成大小相同的 pages，每個都有 logical address');
  },
  async (tok, S) => {                                   // 417 physical → frames
    S.ph = []; for (let i = 0; i < 6; i++) S.ph.push(bx('frame ' + i, MC.paper, 0, 4.6 - i * 0.6, 0, 1.8, 0.52, 0.8));
    hd('RAM（physical）', 0, 5.3);
    cap('physical address space（RAM）', '切成相同大小的 blocks，叫 frames');
  },
  async (tok, S) => {                                   // 430 frame size = page size（2KB）
    S.ph.forEach((m, i) => relabel(m, 'frame ' + i + '：2KB'));
    cap('非常重要：frame size 一定等於 page size', 'page 2KB，frame 也是 2KB');
  },
  async (tok, S) => {                                   // 447 logical 由 CPU 產生；physical 在 RAM
    S.cpu = bx('CPU', MC.dark, -2.6, 0.9, 0, 1.2, 0.8, 0.8); sm('產生 logical（virtual）address', -4.6, 1.6);
    cap('logical / virtual address 由 CPU 產生', 'physical address 是 RAM 裡真正的位置');
  },
  async (tok, S) => {                                   // 467 mapping 由 MMU（hardware）做
    S.mmu = bx('MMU（hardware）', '#f1d3d3', 3.4, 0.9, 0, 2.2, 0.8, 0.8); arrow(V3(-1.9, 0.9, 0.5), V3(2.2, 0.9, 0.5));
    cap('virtual → physical 的 mapping', '由 MMU 這個 hardware 完成：這就是 paging technique');
  },
]);

scene('mem-pg-ex', '例子：process X 的 P5 在 frame 21', CAMW, [
  async (tok, S) => {                                   // 506 example
    hd('例子', 0, 6.8);
    cap('用例子看實際運作', '');
  },
  async (tok, S) => {                                   // 524 process X：P1～P5
    S.p = [1, 2, 3, 4, 5].map((i) => bx('P' + i, [MC.blue, MC.orange, MC.green, MC.purple, MC.pink][i - 1], -5.6, 5.6 - (i - 1) * 0.7, 0, 1.4, 0.6, 0.8));
    hd('process X', -5.6, 6.3);
    cap('假設 process X 分成 5 個 page', 'P1、P2……P5（影片從 1 開始編號）');
  },
  async (tok, S) => {                                   // 565 10KB ÷ 2KB = 5
    sm('10 KB ÷ 2 KB = 5 個 page', -5.6, 1.9);
    cap('process 有 10KB，page size 2KB', '所以切成 5 個 2KB 的 page');
  },
  async (tok, S) => {                                   // 603 CPU 產生 logical address（p, d）
    S.cpu = bx('CPU', MC.dark, -2.8, 5.6, 0, 1.2, 0.8, 0.8); S.addr = [bx('p', MC.blue, -3.6, 4.5, 0, 0.8, 0.55, 0.7), bx('d', MC.orange, -2.2, 4.5, 0, 0.8, 0.55, 0.7)];
    cap('CPU 產生 logical address', '由兩部分組成：p 和 d');
  },
  async (tok, S) => {                                   // 615 p = page number = page table 的 index
    glow(S.addr[0], HL);
    cap('p 是 page number', '當作 page table 的 index；table 存每個 page 在 physical 的位置');
  },
  async (tok, S) => {                                   // 638 page table：page → frame；每個 process 一張，放在 RAM
    S.pt = tbl(0.6, 5.6, ['f 12', 'f 3', 'f 8', 'INV', 'f 21'], { dy: 0.7, w: 1.4, idx: ['P1', 'P2', 'P3', 'P4', 'P5'], title: 'page table of X' });
    sm('（P1～P4 的值為示意）', 0.6, 1.9);
    cap('page table：page number ↔ frame number', '每個 process 一張，也放在 main memory');
  },
  async (tok, S) => {                                   // 707 CPU 要 P5
    glow(S.addr[0], null); relabel(S.addr[0], 'P5'); glow(S.p[4], HL);
    cap('CPU 產生 logical address', '假設要找 P5');
  },
  async (tok, S) => {                                   // 716 MMU 直接跳 P5 那一列
    const k = pkt('P5', MC.pink, -3.6, 4.5); await slide(tok, k, 0.6, S.pt.y(4) + 0.45, 0.6, 600); gone(k); glow(S.pt.cells[4], HL);
    cap('MMU 去 process X 的 page table', '直接跳到第 5 列：是 index，不用一行一行找');
  },
  async (tok, S) => {                                   // 745 frame 21
    hd('physical memory', 4.8, 6.3); S.f21 = bx('frame 21', MC.paper, 4.8, 4.0, 0, 2.0, 0.8, 0.8); sm('…', 4.8, 5.2); sm('…', 4.8, 3.2);
    const k = pkt('f 21', MC.green, 0.6, S.pt.y(4)); await slide(tok, k, 4.8, 4.6, 0.6, 600); gone(k); glow(S.f21, OKG);
    cap('對應的 frame number 是 f21', 'P5 在 main memory 的 frame 21');
  },
  async (tok, S) => {                                   // 774 d = page offset
    glow(S.addr[1], HL);
    cap('address 的另一部分 d', 'page offset：跟 base address 組合成 physical address');
  },
  async (tok, S) => {                                   // 829 d = 3（示意）兩邊一樣
    relabel(S.addr[1], '3'); sm('d = 3（示意）', -2.8, 3.8); S.f21.userData.lbl.position.y = 0.55;
    S.ln = [0, 1, 2, 3, 4].map((i) => bx(i === 3 ? '3' : '', i === 3 ? MC.orange : MC.paper, 4.0 + i * 0.4, 4.0, 0.5, 0.35, 0.35, 0.3));
    cap('page 2KB，裡面有很多內容', '假設 d = 3：offset 在 page 裡、在 frame 裡都一樣');
  },
  async (tok, S) => {                                   // 857 physical = frame 21 + offset 3
    hot('physical = 21 × 2048 + 3 = 43011', 4.4, 2.4);
    cap('MMU 解出 physical address', 'frame 21 接上 offset 3（以 byte 算：21 × 2048 + 3 = 43011）');
  },
  async (tok, S) => {                                   // 917 每個 process 自己 page table，放 main memory
    note('每個 process 有自己的 page table，存在 main memory', 0, 0.6);
    cap('重點', '每個 process 有自己的 page table，存在 main memory 裡');
  },
]);

scene('mem-pg-fault', 'Page fault 初探', CAMW, [
  async (tok, S) => {                                   // 932 page fault
    hd('page fault（下一集細講）', 0, 6.8);
    S.pt = tbl(-1.0, 5.6, ['f 12', 'f 3', 'f 8', 'INV', 'f 21'], { dy: 0.7, w: 1.4, idx: ['P1', 'P2', 'P3', 'P4', 'P5'], title: 'page table of X' });
    cap('最後快速講 page fault', '');
  },
  async (tok, S) => {                                   // 950 CPU 要 P4
    S.q = pkt('要 P4', MC.purple, 1.4, 6.4);
    cap('這次 CPU 要執行 process X 的 page 4', '');
  },
  async (tok, S) => {                                   // 957 MMU 查 P4 → INV
    await slide(tok, S.q, 1.0, 5.6 - 3 * 0.7, 0.6, 600); glow(S.pt.cells[3], NG); tint(S.q, MC.red);
    cap('MMU 查 P4 的 entry', '看到 INV：invalid bit');
  },
  async (tok, S) => {                                   // 970 P4 不在 RAM，在 disk
    S.d = prop('disk', 4.6, 0, 0, 1.4, 'secondary storage'); bx('P4', MC.purple, 4.6, 2.4, 0, 1.2, 0.6, 0.8);
    cap('invalid：P4 不在 RAM', '它在 secondary storage 的 virtual memory 裡');
  },
  async (tok, S) => {                                   // 985 page fault：要搬進來
    bad('page fault：要把 P4 搬進 physical memory', 1.6, 0.5);
    cap('這就是 page fault', 'page 不在 physical memory，必須搬進來（怎麼處理下集講）');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
