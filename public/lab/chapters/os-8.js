// 作業系統 第8章：虛擬記憶體（Virtual Memory）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片（清大 周志遠 第13A–14D講等）目前都還沒有逐字稿，場景全部依恐龍書（Silberschatz, Operating System Concepts）的圖例與數字：
//   valid-invalid bit 圖（A–H，A 在 frame 4、C 在 6、F 在 9）、page fault 處理 6 步驟（load M → trap → … → restart）、
//   EAT：memory 200 ns、page-fault service 8 ms、p = 1/1000 → 8.2 µs；變慢 < 10% → p < 0.0000025、
//   copy-on-write（fork 後 page C 被修改才複製）、modify（dirty）bit、
//   reference string 7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1 / 3 frames：FIFO 15、OPT 9、LRU 12、
//   Belady's anomaly：1,2,3,4,1,2,5,1,2,3,4,5 → 3 frames 9 次、4 frames 10 次、
//   LRU stack（4 7 0 7 1 0 1 2 1 2 7 1 2：a 之前 2 1 0 7 4、b 之後 7 2 1 0 4）、additional-reference-bits（11000100 vs 01110111）、
//   second-chance（clock）、enhanced second-chance (r, m) 四類、proportional allocation（62 frames，10 與 127 pages → 4 與 57）、
//   thrashing 曲線、working set（Δ = 10，WS(t1) = {1,2,5,6,7}、WS(t2) = {3,4}）、page-fault frequency 上下界。
// 慣例：Clock 演算法新載入的 page reference bit 設為 1、指標指向下一格；OPT 平手時換掉最早載入的。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const BLUE = '#4b9ee2', ORANGE = '#dd8238', GREEN = '#2fc092', PURPLE = '#9b7ef4', PINK = '#e55a9b', TEAL = '#31aab0';
  const RED = '#d64545', GRAY = '#d8cfc0', DARK = '#8d8170', SAND = '#e9dcc4', GOLD = '#6a4a00', OKG = '#0f5a3a', BADR = '#5a1010', PALE = '#f6efe2';
  const PCOL = ['#4b9ee2', '#2fc092', '#9b7ef4', '#dd8238', '#e55a9b', '#31aab0', '#c08a1f', '#5c7a4a', '#b5651d', '#7a8fa6'];
  const pcol = (p) => PCOL[Math.abs(p) % PCOL.length];
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
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function line(x1, y1, x2, y2, z = 0, color = '#a8946c') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function polyline(pts, color, z = 0) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => V3(x, y, z))), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function ghost(color, w, h, d, x, y, z = 0, op = 0.14) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x, y, z); lab.world.add(m); return m;
  }

  // ═════════════════════════ 置換演算法：模擬核心 ═════════════════════════
  const BOOK = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
  const BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
  const ALG_NAME = { fifo: 'FIFO', opt: 'OPT（Optimal）', lru: 'LRU', clock: 'Second-chance（Clock）' };
  const argmin = (a) => a.reduce((b, v, i) => (v < a[b] ? i : b), 0);
  function simulate(ref, F, alg) {
    const fr = Array(F).fill(null), loadT = Array(F).fill(-1), useT = Array(F).fill(-1), rb = Array(F).fill(0);
    let ptr = 0;
    const steps = [];
    ref.forEach((p, i) => {
      let slot = fr.indexOf(p), victim = null, scan = [], nextUse = null;
      const fault = slot < 0;
      if (!fault) { useT[slot] = i; rb[slot] = 1; }
      else {
        slot = fr.indexOf(null);
        if (alg === 'clock') {
          if (slot < 0) { let g = 0; while (rb[ptr] && g++ < 2 * F) { scan.push(ptr); rb[ptr] = 0; ptr = (ptr + 1) % F; } slot = ptr; }
          ptr = (slot + 1) % F;
        } else if (slot < 0) {
          if (alg === 'fifo') slot = argmin(loadT);
          else if (alg === 'lru') slot = argmin(useT);
          else {
            let far = -1;
            const order = [...Array(F).keys()].sort((a, b) => loadT[a] - loadT[b]);
            for (const s of order) { const n = ref.indexOf(fr[s], i + 1), d = n < 0 ? Infinity : n; if (d > far) { far = d; slot = s; } }
            nextUse = far;
          }
        }
        victim = fr[slot]; fr[slot] = p; loadT[slot] = i; useT[slot] = i; rb[slot] = 1;
      }
      steps.push({ i, p, fault, slot, victim, frames: fr.slice(), rb: rb.slice(), ptr, scan, nextUse, lastUse: null });
    });
    return steps;
  }
  const faults = (ref, F, alg) => simulate(ref, F, alg).filter((s) => s.fault).length;
  function stepNote(st, alg, ref) {
    if (!st.fault) return 'ref ' + st.p + '：hit';
    if (st.victim === null) return 'ref ' + st.p + '：fault，放進空的 frame';
    if (alg === 'fifo') return 'ref ' + st.p + '：fault，換掉最早進來的 ' + st.victim;
    if (alg === 'lru') return 'ref ' + st.p + '：fault，換掉最久沒用的 ' + st.victim;
    if (alg === 'opt') return 'ref ' + st.p + '：fault，換掉 ' + st.victim + (st.nextUse === Infinity ? '（以後不再用）' : '（下次在第 ' + (st.nextUse + 1) + ' 個才用）');
    return 'ref ' + st.p + '：fault，' + (st.scan.length ? '清掉 ' + st.scan.length + ' 個 reference bit 後' : '') + '換掉 ' + st.victim;
  }

  // 3D 格子：每個 reference 一欄，欄裡由上到下是各 frame
  function makeGrid(ref, F, top, opts = {}) {
    const L = ref.length, cw = Math.min(0.62, (opts.width || 12.4) / L), x0 = (opts.x0 === undefined ? -6.2 : opts.x0) + cw / 2;
    const X = (i) => x0 + i * cw, rowY = (r) => top - 0.75 - r * 0.56, faultY = top - 0.75 - F * 0.56 - 0.05;
    const g = { L, F, cw, X, rowY, faultY, top, refs: [], cols: [], marks: [], count: 0 };
    ref.forEach((p, i) => g.refs.push(cube(p, pcol(p), [cw * 0.84, 0.46, 0.5], X(i), top, 0)));
    if (opts.name) tag(opts.name, 'ptr', X(0) - cw / 2 - 0.1, top + 0.55);
    for (let r = 0; r < F; r++) for (let i = 0; i < L; i++) ctx.tile(V3(X(i), rowY(r) - 0.25, -0.1), cw * 0.9, 0.5, '#efe5d3');
    g.cnt = tag('', 'ptr alt', opts.cntX === undefined ? X(L - 1) + 0.2 : opts.cntX, faultY - 0.55);
    return g;
  }
  function gridColumn(g, st, drop = true) {
    const col = [];
    for (let r = 0; r < g.F; r++) {
      const p = st.frames[r];
      if (p === null) { col.push(null); continue; }
      const isNew = st.fault && r === st.slot;
      const m = cube(p, isNew ? pcol(p) : '#efe5d3', [g.cw * 0.84, 0.46, 0.5], g.X(st.i), g.rowY(r), 0, isNew && drop ? 1.8 : 0);
      if (!isNew) tint(m, '#e3d6bf');
      col.push(m);
    }
    g.cols.push(col);
    if (st.fault) { g.count++; g.marks.push(cube('F', RED, [g.cw * 0.6, 0.3, 0.3], g.X(st.i), g.faultY, 0.1)); }
    txt(g.cnt, 'page fault：' + g.count);
    glow(g.refs[st.i], GOLD); if (st.i > 0) glow(g.refs[st.i - 1], null);
    return col;
  }
  async function playGrid(tok, ref, F, alg, top, opts = {}) {
    const g = makeGrid(ref, F, top, opts);
    const steps = simulate(ref, F, alg);
    for (const st of steps) {
      gridColumn(g, st);
      if (opts.speak !== false) say(stepNote(st, alg, ref), (opts.formula || ALG_NAME[alg] + '，' + F + ' frames') + '：目前 ' + g.count + ' 次');
      await wait(tok, st.fault ? (opts.ms || 820) : (opts.hitMs || 520));
    }
    glow(g.refs[ref.length - 1], null);
    return g;
  }

  // ═════════════════════════ Mode 1：置換演算法逐步模擬 ═════════════════════════
  const rp = { alg: 'fifo', F: 3, ref: BOOK.slice(), steps: [], k: 0, g: null };
  function rpParse(s) {
    const a = String(s).split(/[\s,，]+/).filter(Boolean).map(Number);
    if (!a.length || a.some((v) => !Number.isInteger(v) || v < 0 || v > 9)) return null;
    return a.slice(0, 24);
  }
  function rpReset() {
    lab.clear();
    rp.steps = simulate(rp.ref, rp.F, rp.alg); rp.k = 0;
    const top = Math.min(6.4, 1.6 + rp.F * 0.56 + 0.9);
    rp.g = makeGrid(rp.ref, rp.F, top);
    for (let r = 0; r < rp.F; r++) tag('frame ' + r, 'idx', -6.7, rp.g.rowY(r));
    rp.rbTags = [];
    rpState();
  }
  function rpState(note) {
    const done = rp.steps.slice(0, rp.k), f = done.filter((s) => s.fault).length;
    const last = done[done.length - 1];
    setState(ALG_NAME[rp.alg] + '，' + rp.F + ' frames', [['reference string', rp.ref.join(' ')], ['已處理', rp.k + ' / ' + rp.ref.length], ['page fault', String(f)], ['hit', String(rp.k - f)],
      ['frames', last ? last.frames.map((v) => (v === null ? '－' : v)).join(' | ') : '（空）']].concat(rp.alg === 'clock' && last ? [['reference bits', last.rb.join(' ') + '（指標在 frame ' + last.ptr + '）']] : []),
      (note ? note + '<br>' : '') + (rp.k === rp.ref.length ? '總共 <span class="no">' + f + '</span> 次 page fault，fault rate ' + (100 * f / rp.ref.length).toFixed(0) + '%' : '紅色 F = 這一欄發生 page fault'));
  }
  function rpStep() {
    if (rp.k >= rp.steps.length) { log('已經跑完了：按「重來」或換字串。', true); return false; }
    const st = rp.steps[rp.k++];
    gridColumn(rp.g, st, true);
    rp.rbTags.forEach(kill); rp.rbTags = [];
    if (rp.alg === 'clock') st.rb.forEach((b, r) => rp.rbTags.push(tag((r === st.ptr ? '▶ ' : '') + 'r=' + b, r === st.ptr ? 'ptr alt' : 'idx', 6.7, rp.g.rowY(r))));
    const note = stepNote(st, rp.alg, rp.ref);
    log(note);
    rpState(note);
    return true;
  }
  function enterReplace() {
    fresh([0, 3.6, 14], [0, 3.0, 0]);
    controls('<select id="rAlg"><option value="fifo">FIFO</option><option value="opt">OPT</option><option value="lru">LRU</option><option value="clock">Second-chance</option></select>'
      + '<label>frames <input id="rF" type="number" min="1" max="6" value="' + rp.F + '" style="width:50px"></label>'
      + '<input id="rS" value="' + rp.ref.join(' ') + '" style="width:230px">'
      + '<button id="rSet">套用字串</button><button class="primary" id="rStep">下一步</button><button id="rAll">跑完</button><button id="rRst">重來</button><button id="rBook">課本字串</button><button id="rRnd">隨機</button>');
    $('rAlg').value = rp.alg;
    $('rAlg').onchange = (e) => { rp.alg = e.target.value; rpReset(); log('改用 ' + ALG_NAME[rp.alg] + '。'); };
    $('rF').onchange = (e) => { const v = Number(e.target.value); if (!(Number.isInteger(v) && v >= 1 && v <= 6)) { log('frame 數請填 1–6。', true); e.target.value = rp.F; return; } rp.F = v; rpReset(); };
    on('rSet', () => { const a = rpParse($('rS').value); if (!a) { log('reference string 請用 0–9 的數字，以空白或逗號分開（最多 24 個）。', true); return; } rp.ref = a; rpReset(); log('新的 reference string：' + a.join(' ')); });
    on('rStep', () => rpStep());
    on('rAll', () => { while (rpStep()) { /* run to end */ } });
    on('rRst', () => { rpReset(); log('重來。'); });
    on('rBook', () => { rp.ref = BOOK.slice(); $('rS').value = rp.ref.join(' '); rpReset(); log('課本字串：3 frames 時 FIFO 15、OPT 9、LRU 12。'); });
    on('rRnd', () => { rp.ref = Array.from({ length: 14 }, () => rnd(6)); $('rS').value = rp.ref.join(' '); rpReset(); });
    rpReset();
    log('一步一步看：哪一個 page 被換掉、為什麼。OPT 要「偷看未來」，實際上做不到，只用來比較。');
  }

  // ═════════════════════════ Mode 2：比較與 Belady's anomaly ═════════════════════════
  const cmp = { ref: BELADY.slice(), objs: [] };
  function enterCompare() {
    fresh([0, 4.2, 14.5], [0, 3.0, 0]);
    controls('<input id="cS" value="' + cmp.ref.join(' ') + '" style="width:240px"><button class="primary" id="cSet">比較</button><button id="cBel">Belady 字串</button><button id="cBook">課本字串</button><button id="cRnd">隨機</button>');
    on('cSet', () => { const a = rpParse($('cS').value); if (!a) { log('請輸入 0–9 的數字（最多 24 個）。', true); return; } cmp.ref = a; cmpDraw(); });
    on('cBel', () => { cmp.ref = BELADY.slice(); $('cS').value = cmp.ref.join(' '); cmpDraw(); });
    on('cBook', () => { cmp.ref = BOOK.slice(); $('cS').value = cmp.ref.join(' '); cmpDraw(); });
    on('cRnd', () => { cmp.ref = Array.from({ length: 16 }, () => rnd(7)); $('cS').value = cmp.ref.join(' '); cmpDraw(); });
    tag('frame 數', 'idx', 6.4, -0.2, 1.2);
    tag('FIFO', 'ptr', -4.5, 6.8); tag('LRU', 'ptr', -3.0, 6.8); tag('OPT', 'ptr', -1.6, 6.8);
    cube('', ORANGE, [0.3, 0.3, 0.3], -5.2, 6.8); cube('', BLUE, [0.3, 0.3, 0.3], -3.6, 6.8); cube('', GREEN, [0.3, 0.3, 0.3], -2.2, 6.8);
    log('每組三根柱子：同一個 reference string 在 1–7 個 frame 下的 page fault 次數。FIFO 那根如果「frame 變多卻變高」就是 Belady\'s anomaly。');
    cmpDraw();
  }
  function cmpDraw() {
    cmp.objs.forEach(kill); cmp.objs = [];
    const res = [], maxF = 7, mx = cmp.ref.length;
    const S = 5.6 / mx;
    let anomaly = [];
    for (let F = 1; F <= maxF; F++) {
      const r = { F, fifo: faults(cmp.ref, F, 'fifo'), lru: faults(cmp.ref, F, 'lru'), opt: faults(cmp.ref, F, 'opt') };
      res.push(r);
      const x = -5.4 + (F - 1) * 1.8;
      [['fifo', ORANGE, -0.42], ['lru', BLUE, 0], ['opt', GREEN, 0.42]].forEach(([k, c, dx]) => {
        const h = Math.max(0.05, r[k] * S);
        const m = cube('', c, [0.38, h, 0.6], x + dx, h / 2, 0, 0); cmp.objs.push(m);
        if (k === 'fifo') cmp.objs.push(tag(String(r[k]), 'idx', x + dx, h + 0.3));
      });
      cmp.objs.push(tag(String(F), 'ptr', x, -0.2, 0.9));
      if (F > 1 && r.fifo > res[F - 2].fifo) { anomaly.push(F); const a = tag('Belady!', 'ptr alt', x - 0.42, r.fifo * S + 0.9); cmp.objs.push(a); }
    }
    setState('Page fault 次數 vs frame 數', res.map((r) => [r.F + ' frames', 'FIFO ' + r.fifo + '｜LRU ' + r.lru + '｜OPT ' + r.opt]),
      anomaly.length ? '<span class="no">FIFO 出現 Belady\'s anomaly</span>：frame 數 ' + anomaly.map((F) => (F - 1) + ' → ' + F).join('、') + ' 時 fault 反而變多<br>LRU、OPT 是 stack algorithm，不會發生'
        : '這個字串沒有出現 Belady\'s anomaly；OPT 永遠最少');
    log('字串 ' + cmp.ref.join(' ') + '：' + res.map((r) => r.F + 'f→' + r.fifo + '/' + r.lru + '/' + r.opt).join('，'));
  }

  // ═════════════════════════ Mode 3：Page fault 處理（讀／寫、dirty bit） ═════════════════════════
  const PAGES = 'ABCDEFGH'.split('');
  const pf = { pt: [], frames: [], loadQ: [], st: { ref: 0, fault: 0, rd: 0, wr: 0 }, o: {} };
  const pfY = (i) => 6.1 - i * 0.66, frY = (k) => 5.2 - k * 1.1;
  function pfReset() {
    pf.pt = PAGES.map(() => ({ v: false, f: null, d: false }));
    pf.frames = [null, null, null]; pf.loadQ = []; pf.st = { ref: 0, fault: 0, rd: 0, wr: 0 };
  }
  function pfDraw() {
    lab.clear();
    const o = pf.o = {};
    o.cpu = cube('CPU', DARK, [1.2, 0.9, 1.0], -6.0, 1.0);
    tag('page table', 'ptr', -3.2, 6.85); tag('frame', 'idx', -3.6, 6.45); tag('v/i', 'idx', -2.55, 6.45); tag('dirty', 'idx', -1.75, 6.45);
    o.rows = PAGES.map((n, i) => { tag(n, 'idx', -4.6, pfY(i)); return { f: cube('', PALE, [1.0, 0.45, 0.6], -3.6, pfY(i)), v: cube('i', GRAY, [0.6, 0.45, 0.6], -2.55, pfY(i)), d: cube('0', PALE, [0.6, 0.45, 0.6], -1.75, pfY(i)) }; });
    tag('physical memory（3 frames）', 'ptr', 1.2, 6.85);
    o.fr = [0, 1, 2].map((k) => { tag('frame ' + k, 'idx', 0.0, frY(k)); return cube('free', PALE, [1.6, 0.9, 1.0], 1.4, frY(k)); });
    tag('backing store', 'ptr', 5.2, 6.85);
    o.disk = PAGES.map((n, i) => cube(n, pcol(i), [0.7, 0.45, 0.6], 4.7 + (i % 2) * 0.9, 6.0 - Math.floor(i / 2) * 0.66));
    o.os = cube('OS', PURPLE, [1.6, 0.8, 1.0], -0.4, 0.5);
    pfSync();
  }
  function pfSync() {
    const o = pf.o;
    pf.pt.forEach((e, i) => {
      relabel(o.rows[i].f, e.v ? String(e.f) : ''); relabel(o.rows[i].v, e.v ? 'v' : 'i'); tint(o.rows[i].v, e.v ? GREEN : GRAY);
      relabel(o.rows[i].d, e.d ? '1' : '0'); tint(o.rows[i].d, e.d ? ORANGE : PALE);
    });
    pf.frames.forEach((p, k) => { relabel(o.fr[k], p === null ? 'free' : PAGES[p]); tint(o.fr[k], p === null ? PALE : pcol(p)); });
    const s = pf.st;
    setState('Demand paging：page fault 處理', [['存取次數', String(s.ref)], ['page fault', String(s.fault)], ['讀 disk（swap in）', String(s.rd)], ['寫回 disk（dirty）', String(s.wr)],
      ['frames（FIFO）', pf.frames.map((p) => (p === null ? '－' : PAGES[p])).join(' | ')]], '只有 dirty bit = 1 的 victim 才要寫回 disk');
  }
  async function pfAccess(p, write, tok) {
    const o = pf.o, e = pf.pt[p];
    pf.st.ref++;
    Object.values(o.rows).forEach((r) => { glow(r.v, null); glow(r.f, null); });
    o.fr.forEach((m) => glow(m, null)); o.disk.forEach((m) => glow(m, null)); glow(o.os, null);
    const pk = cube((write ? '寫 ' : '讀 ') + PAGES[p], write ? ORANGE : BLUE, [1.1, 0.42, 0.5], -6.0, 1.9, 0.6);
    move(pk, -2.55, pfY(p) + 0.45, 0.6); glow(o.rows[p].v, GOLD);
    await wait(tok, 800);
    if (e.v) {
      glow(o.rows[p].v, OKG);
      if (write) e.d = true;
      move(pk, 1.4, frY(e.f) + 0.65, 0.6); glow(o.fr[e.f], OKG);
      log((write ? '寫 ' : '讀 ') + PAGES[p] + '：valid → 直接在 frame ' + e.f + ' 存取' + (write ? '，dirty bit 設成 1' : ''));
      pfSync(); await wait(tok, 600); fly(pk); return;
    }
    pf.st.fault++;
    glow(o.rows[p].v, BADR);
    log('① ' + PAGES[p] + ' 的 bit 是 i → ② trap 給 OS（page fault）', true);
    move(pk, -0.4, 1.3, 0.6); glow(o.os, GOLD);
    await wait(tok, 900);
    log('③ OS 確認是合法存取，page 在 backing store');
    glow(o.disk[p], GOLD);
    await wait(tok, 700);
    let k = pf.frames.indexOf(null);
    if (k < 0) {
      const vp = pf.loadQ.shift(); k = pf.pt[vp].f;
      log('沒有 free frame：FIFO 選 victim ' + PAGES[vp] + '（frame ' + k + '）');
      glow(o.fr[k], BADR);
      await wait(tok, 700);
      if (pf.pt[vp].d) {
        pf.st.wr++;
        const out = cube(PAGES[vp], pcol(vp), [0.7, 0.45, 0.5], 1.4, frY(k), 0.7);
        move(out, 4.7 + (vp % 2) * 0.9, 6.0 - Math.floor(vp / 2) * 0.66, 0.7);
        log('victim ' + PAGES[vp] + ' 的 dirty bit = 1：先寫回 disk（多一次 I/O）', true);
        await wait(tok, 900); fly(out);
      } else log('victim ' + PAGES[vp] + ' 沒被改過（dirty = 0）：直接丟掉，不用寫回');
      pf.pt[vp] = { v: false, f: null, d: false };
      pf.frames[k] = null; pfSync();
    }
    pf.st.rd++;
    const inn = cube(PAGES[p], pcol(p), [0.7, 0.45, 0.5], 4.7 + (p % 2) * 0.9, 6.0 - Math.floor(p / 2) * 0.66, 0.7);
    move(inn, 1.4, frY(k), 0.7);
    log('④ 把 ' + PAGES[p] + ' 從 disk 讀進 frame ' + k);
    await wait(tok, 1000); kill(inn);
    pf.frames[k] = p; pf.loadQ.push(p);
    pf.pt[p] = { v: true, f: k, d: false };
    pfSync(); glow(o.rows[p].v, OKG);
    log('⑤ 更新 page table：' + PAGES[p] + ' → frame ' + k + '，bit 改成 v');
    await wait(tok, 700);
    if (write) pf.pt[p].d = true;
    move(pk, 1.4, frY(k) + 0.65, 0.6); glow(o.fr[k], OKG); glow(o.os, null);
    log('⑥ 重新執行剛才那個指令：這次成功' + (write ? '，dirty bit = 1' : ''));
    pfSync(); await wait(tok, 600); fly(pk);
  }
  function enterFault() {
    fresh([0, 4.0, 14.5], [0, 3.4, 0]);
    pfReset(); pfDraw();
    controls('<select id="fP">' + PAGES.map((n, i) => '<option value="' + i + '">' + n + '</option>').join('') + '</select>'
      + '<button class="primary" id="fRd">讀取</button><button id="fWr">寫入</button><button id="fRnd">隨機存取</button><button id="fRst">重來</button>');
    const go = (w) => { const p = Number($('fP').value); if (!(p >= 0 && p < 8)) { log('請選 A–H。', true); return; } runOp(() => pfAccess(p, w)); };
    on('fRd', () => go(false)); on('fWr', () => go(true));
    on('fRnd', () => { $('fP').value = String(rnd(8)); go(Math.random() < 0.4); });
    on('fRst', () => { pfReset(); pfDraw(); log('pure demand paging：一開始一個 page 都不在 memory。'); });
    log('pure demand paging：一開始所有 page 都是 i。讀或寫一個 page，看 page fault 的 6 個步驟；3 個 frame 滿了用 FIFO 換。');
  }

  // ═════════════════════════ Mode 4：EAT with page faults ═════════════════════════
  const ea = { m: 200, s: 8, x: 3 };
  const eaCalc = (m, sMs, p) => (1 - p) * m + p * sMs * 1e6;
  function enterEat() {
    fresh([0, 4.0, 13], [0, 2.8, 0]);
    controls('<label>memory <input id="aM" type="range" min="50" max="300" step="10" value="' + ea.m + '"> <b id="aMv"></b> ns</label>'
      + '<label>fault service <input id="aS" type="range" min="1" max="20" value="' + ea.s + '"> <b id="aSv"></b> ms</label>'
      + '<label>p = 10^−<input id="aX" type="range" min="2" max="8" step="0.25" value="' + ea.x + '"> <b id="aXv"></b></label><button id="aBook">例子</button>');
    const read = () => { ea.m = Number($('aM').value); ea.s = Number($('aS').value); ea.x = Number($('aX').value); eaUpdate(); };
    ['aM', 'aS', 'aX'].forEach((id) => { $(id).oninput = read; });
    on('aBook', () => { $('aM').value = 200; $('aS').value = 8; $('aX').value = 3; read(); log('課本：200 ns、8 ms、p = 1/1000 → 8.2 µs，慢了 40 倍。'); });
    ea.bars = ['memory access', 'EAT', '可接受（+10%）'].map((n, i) => { const x = -3.6 + i * 3.6; tag(n, 'ptr', x, -0.1, 1.2); return { m: cube('', [BLUE, RED, GREEN][i], [1.6, 1, 1.2], x, 0.5), v: tag('', 'ptr alt', x, 1) }; });
    tag('高度為對數尺度', 'idx', 5.6, 6.4);
    log('EAT = (1 − p) × memory access + p × page-fault service time。p 只要稍微大一點，EAT 就被 disk 拖垮。');
    eaUpdate();
  }
  function eaUpdate() {
    const p = Math.pow(10, -ea.x), eat = eaCalc(ea.m, ea.s, p), ok = ea.m * 1.1, pmax = 0.1 * ea.m / (ea.s * 1e6 - ea.m);
    $('aMv').textContent = ea.m; $('aSv').textContent = ea.s; $('aXv').textContent = ea.x;
    const H = (ns) => Math.max(0.1, Math.log10(ns) * 1.1);
    [ea.m, eat, ok].forEach((v, i) => { const h = H(v), b = ea.bars[i]; b.m.scale.y = h; b.m.position.y = h / 2; b.v.position.y = h + 0.4; txt(b.v, v >= 1000 ? (+(v / 1000).toFixed(2)) + ' µs' : (+v.toFixed(1)) + ' ns'); });
    tint(ea.bars[1].m, eat <= ok ? GREEN : RED);
    setState('Effective access time', [['p', p.toExponential(2)], ['memory access', ea.m + ' ns'], ['page-fault service', ea.s + ' ms = ' + (ea.s * 1e6).toLocaleString() + ' ns'], ['EAT', (+eat.toFixed(1)).toLocaleString() + ' ns'], ['變慢', (eat / ea.m).toFixed(2) + ' 倍']],
      'EAT = ' + ea.m + ' + ' + (ea.s * 1e6 - ea.m).toLocaleString() + ' × p<br>要變慢 &lt; 10%：p &lt; ' + pmax.toExponential(2) + '（約 ' + Math.round(1 / pmax).toLocaleString() + ' 次存取才能 fault 一次）');
  }

  // ═════════════════════════ Mode 5：Working set ═════════════════════════
  const WSREF = [2, 6, 1, 5, 7, 7, 7, 7, 5, 1, 6, 2, 3, 4, 1, 2, 3, 4, 4, 4, 3, 4, 3, 4, 4, 4, 1, 3, 2, 3, 4, 4, 4, 3, 4, 4, 4];
  const ws = { D: 10, t: 10, o: {} };
  const wsSet = (ref, t, D) => [...new Set(ref.slice(Math.max(0, t - D), t))].sort((a, b) => a - b);
  function wsDraw() {
    lab.clear();
    const L = WSREF.length, cw = 12.6 / L, X = (i) => -6.3 + cw / 2 + i * cw;
    ws.X = X; ws.cw = cw;
    ws.o.refs = WSREF.map((p, i) => cube(p, pcol(p), [cw * 0.86, 0.42, 0.42], X(i), 4.4));
    for (let i = 0; i < L; i += 5) tag(String(i + 1), 'idx', X(i), 3.85);
    ws.o.win = ghost('#c08a1f', 1, 0.8, 0.8, 0, 4.4, 0, 0.25);
    ws.o.t = tag('', 'ptr alt', 0, 5.2);
    ws.o.set = [];
    tag('working set', 'ptr', -4.2, 2.4);
  }
  function wsUpdate() {
    const { D, t } = ws, X = ws.X, cw = ws.cw;
    const a = Math.max(0, t - D);
    ws.o.win.scale.x = (t - a) * cw; ws.o.win.position.x = (X(a) + X(t - 1)) / 2;
    ws.o.t.position.x = X(t - 1); txt(ws.o.t, 't = ' + t);
    ws.o.refs.forEach((m, i) => glow(m, i >= a && i < t ? GOLD : null));
    ws.o.set.forEach(kill); ws.o.set = [];
    const S = wsSet(WSREF, t, D);
    S.forEach((p, k) => ws.o.set.push(cube(p, pcol(p), [0.7, 0.6, 0.7], -2.6 + k * 0.9, 2.4)));
    setState('Working set（Δ = ' + D + '）', [['t', String(t)], ['視窗', WSREF.slice(a, t).join(' ')], ['WS(t)', '{' + S.join(', ') + '}'], ['WSS', String(S.length)]],
      'WS(t) = 最近 Δ 個 reference 用到的 page<br>D = Σ WSSᵢ > 可用 frame 數 m → 會 thrashing，要暫停某個 process');
  }
  function enterWset() {
    fresh([0, 4.4, 13], [0, 3.2, 0]);
    controls('<label>Δ <input id="wD" type="range" min="1" max="15" value="' + ws.D + '"> <b id="wDv"></b></label>'
      + '<label>t <input id="wT" type="range" min="1" max="' + WSREF.length + '" value="' + ws.t + '" style="width:220px"> <b id="wTv"></b></label><button id="wT1">課本 t₁</button><button id="wT2">課本 t₂</button><button class="primary" id="wPlay">播放</button>');
    const read = () => { ws.D = Number($('wD').value); ws.t = Number($('wT').value); $('wDv').textContent = ws.D; $('wTv').textContent = ws.t; wsUpdate(); };
    $('wD').oninput = read; $('wT').oninput = read;
    on('wT1', () => { $('wD').value = 10; $('wT').value = 10; read(); log('t₁：最近 10 個是 2 6 1 5 7 7 7 7 5 1 → WS = {1, 2, 5, 6, 7}'); });
    on('wT2', () => { $('wD').value = 10; $('wT').value = 26; read(); log('t₂：最近 10 個是 3 4 4 4 3 4 3 4 4 4 → WS = {3, 4}'); });
    on('wPlay', () => { stopTimer(); ws.t = Math.min(ws.D, WSREF.length); timer = setInterval(() => { if (ws.t >= WSREF.length) { stopTimer(); return; } ws.t++; $('wT').value = ws.t; read(); }, 380); });
    wsDraw(); read();
    log('拖動 t 看視窗滑過 reference string：locality 改變時（例如進入新的函式），working set 也跟著換。Δ 太小抓不到整個 locality，太大會跨好幾個 locality。');
  }

  // ═════════════════════════ 小測驗 ═════════════════════════
  let qs = { score: 0, total: 0 };
  function genQ() {
    const k = rnd(9);
    if (k <= 2) {
      const ref = Array.from({ length: 10 + rnd(4) }, () => rnd(6)), F = pick([3, 4]), alg = pick(['fifo', 'lru', 'opt']);
      const r = { fifo: faults(ref, F, 'fifo'), lru: faults(ref, F, 'lru'), opt: faults(ref, F, 'opt') };
      const ans = String(r[alg]);
      const opts = [...new Set([ans, String(r.fifo), String(r.lru), String(r.opt), String(r[alg] + 1), String(r[alg] - 1)])].slice(0, 4);
      if (!opts.includes(ans)) opts[0] = ans;
      return { q: 'reference string：' + ref.join(' ') + '，' + F + ' 個 frame（一開始全空），' + ALG_NAME[alg] + ' 會發生幾次 page fault？', opts, ans, why: 'FIFO ' + r.fifo + '、LRU ' + r.lru + '、OPT ' + r.opt + ' 次（前 ' + F + ' 個不同的 page 一定是 compulsory fault）。OPT 一定最少。' };
    }
    if (k === 3) {
      const m = pick([100, 200]), s = pick([5, 8, 10]), den = pick([1000, 5000, 10000]), p = 1 / den, eat = eaCalc(m, s, p);
      const f = (v) => (+(v / 1000).toFixed(3)) + ' µs';
      return { q: 'memory access ' + m + ' ns、page-fault service ' + s + ' ms、page fault rate p = 1/' + den + '，EAT 約是？', opts: [f(eat), f(m + s * 1e6 / den / 10), f(s * 1e6 / den), f(m * (1 + 1 / den))], ans: f(eat), why: '(1 − p) × ' + m + ' + p × ' + (s * 1e6).toLocaleString() + ' ≈ ' + Math.round(eat).toLocaleString() + ' ns。' };
    }
    if (k === 4) {
      const m = pick([62, 64, 93, 100]), s1 = pick([10, 20, 30]), s2 = pick([90, 127, 150]), a1 = Math.floor(s1 / (s1 + s2) * m), a2 = Math.floor(s2 / (s1 + s2) * m);
      return { q: '共 ' + m + ' 個 free frame，P1 大小 ' + s1 + ' pages、P2 ' + s2 + ' pages，用 proportional allocation（取整數）各分幾個？', opts: [a1 + ' 與 ' + a2, Math.floor(m / 2) + ' 與 ' + Math.ceil(m / 2), (a1 + 1) + ' 與 ' + (a2 - 1), s1 + ' 與 ' + (m - s1)], ans: a1 + ' 與 ' + a2, why: 'aᵢ = sᵢ / S × m：' + s1 + '/' + (s1 + s2) + ' × ' + m + ' ≈ ' + (s1 / (s1 + s2) * m).toFixed(1) + '，' + s2 + '/' + (s1 + s2) + ' × ' + m + ' ≈ ' + (s2 / (s1 + s2) * m).toFixed(1) + '。' };
    }
    if (k === 5) {
      const D = pick([3, 4, 5, 6]), t = D + 4 + rnd(WSREF.length - D - 4), S = wsSet(WSREF, t, D);
      const fmtS = (a) => '{' + a.join(', ') + '}', ans = fmtS(S);
      const cand = [fmtS(wsSet(WSREF, t, D + 3)), fmtS(wsSet(WSREF, t - 3, D)), fmtS([...new Set(WSREF.slice(0, t))].sort((a, b) => a - b)), fmtS(wsSet(WSREF, t, D - 2)), fmtS(wsSet(WSREF, t - D, D)), fmtS(S.slice(1)), fmtS([...S, 9])];
      const opts = [ans, ...[...new Set(cand)].filter((x) => x !== ans && x !== '{}')].slice(0, 4);
      return { q: 'reference string：' + WSREF.slice(0, t).join(' ') + ' …，Δ = ' + D + '，在第 ' + t + ' 個 reference 之後的 working set 是？', opts, ans, why: '只看最後 ' + D + ' 個：' + WSREF.slice(t - D, t).join(' ') + ' → ' + ans + '。' };
    }
    if (k === 6) {
      const F = 4, bits = Array.from({ length: F }, () => rnd(2)), ptr = rnd(F), pages = [3, 8, 5, 1].sort(() => Math.random() - 0.5);
      let p = ptr, g = 0; const b = bits.slice(); while (b[p] && g++ < 8) { b[p] = 0; p = (p + 1) % F; }
      const ans = 'page ' + pages[p];
      return { q: 'Second-chance：frame 0–3 的 page 是 ' + pages.join('、') + '，reference bit 是 ' + bits.join(' ') + '，指標在 frame ' + ptr + '。發生 page fault 時換掉誰？', opts: pages.map((x) => 'page ' + x), ans, why: '從 frame ' + ptr + ' 開始：bit = 1 的清成 0 給第二次機會、往下走；第一個 bit = 0 的就是 victim（全部是 1 時繞一圈後等於 FIFO）。' };
    }
    const items = [
      { q: '哪一個置換演算法可能發生 Belady\'s anomaly？', opts: ['FIFO', 'LRU', 'OPT', '以上皆不會'], ans: 'FIFO', why: 'LRU 和 OPT 是 stack algorithm：n 個 frame 裡的 page 集合永遠是 n + 1 個 frame 的子集合，所以 frame 變多 fault 不會變多。' },
      { q: 'Thrashing 的主要原因是？', opts: ['process 分到的 frame 少於它的 working set，一直 page fault', 'CPU 太快', 'TLB 太大', 'disk 空間不夠'], ans: 'process 分到的 frame 少於它的 working set，一直 page fault', why: '大家都在等 paging device，CPU 使用率掉下來；OS 若再提高 multiprogramming 反而更糟。解法：working set、PFF、降低 degree of multiprogramming。' },
      { q: 'fork() 之後使用 copy-on-write，什麼時候才真的複製 page？', opts: ['parent 或 child 要寫入那個 page 時', 'fork() 一呼叫就全部複製', 'child 呼叫 exec() 時', '永遠不複製'], ans: 'parent 或 child 要寫入那個 page 時', why: '一開始共用、標成 copy-on-write；誰先寫就複製一份給誰。只讀的 page 一直共用。' },
      { q: '選 victim 時 modify（dirty）bit 的用途是？', opts: ['dirty = 0 的 page 不用寫回 disk，少一次 I/O', '決定 page 是否合法', '記錄 page 被參考幾次', '標示 page 是否共用'], ans: 'dirty = 0 的 page 不用寫回 disk，少一次 I/O', why: '沒被改過的 page 在 disk 上的副本還是對的，直接覆蓋即可。' },
      { q: 'Enhanced second-chance 中，最優先被換掉的是 (reference, modify) =？', opts: ['(0, 0)', '(0, 1)', '(1, 0)', '(1, 1)'], ans: '(0, 0)', why: '最近沒用又沒改過：換掉最便宜。順序 (0,0) → (0,1) → (1,0) → (1,1)。' },
      { q: 'Page-fault frequency（PFF）策略中，fault rate 高於上界時怎麼做？', opts: ['多給這個 process frame', '拿走這個 process 的 frame', '換成 FIFO', '關掉 TLB'], ans: '多給這個 process frame', why: '高於上界：frame 不夠，給它更多；低於下界：frame 太多，拿走一些。沒有 free frame 時就暫停某個 process。' },
      { q: 'Local replacement 和 global replacement 的差別？', opts: ['local 只能換自己的 frame；global 可以搶別的 process 的', 'local 用 LRU、global 用 FIFO', 'local 只用在 kernel', '兩者一樣'], ans: 'local 只能換自己的 frame；global 可以搶別的 process 的', why: 'global 通常 throughput 較好，但一個 process 的 fault rate 會受別人影響。' },
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

  // ═════════════════════════ 場景（課本）：demand paging ═════════════════════════
  async function scDemandValid(tok) {
    fresh([0, 4.4, 15], [0, 3.2, 0]);
    const PT = [4, null, 6, null, null, 9, null, null];
    tag('logical memory', 'ptr', -5.6, 6.9);
    const lm = PAGES.map((n, i) => { tag(String(i), 'idx', -6.6, 6.2 - i * 0.66); return cube(n, pcol(i), [0.9, 0.5, 0.6], -5.6, 6.2 - i * 0.66); });
    tag('page table', 'ptr', -2.8, 6.9);
    const rows = PT.map((f, i) => ({ f: cube(f === null ? '' : f, PALE, [0.8, 0.5, 0.6], -3.2, 6.2 - i * 0.66), v: cube('', GRAY, [0.6, 0.5, 0.6], -2.3, 6.2 - i * 0.66) }));
    tag('physical memory', 'ptr', 1.4, 6.9);
    const fy = (f) => 6.3 - f * 0.48;
    for (let f = 0; f < 12; f++) { tag(String(f), 'idx', 0.3, fy(f)); ctx.tile(V3(1.4, fy(f) - 0.2, 0), 1.6, 0.4, '#efe5d3'); }
    tag('backing store', 'ptr', 5.0, 6.9);
    PAGES.forEach((n, i) => cube(n, pcol(i), [0.7, 0.45, 0.6], 4.5 + (i % 2) * 0.9, 6.0 - Math.floor(i / 2) * 0.66));
    say('整個程式都在 disk（backing store）', 'demand paging：用到才載入');
    await beat(tok, 2600);
    say('lazy swapper（pager）：只載入需要的 page', '這裡只有 A、C、F 被用到');
    for (const [p, f] of [[0, 4], [2, 6], [5, 9]]) {
      glow(lm[p], GOLD);
      cube(PAGES[p], pcol(p), [1.4, 0.38, 0.6], 1.4, fy(f), 0, 2.5);
      await beat(tok, 900);
      relabel(rows[p].v, 'v'); tint(rows[p].v, GREEN); glow(lm[p], null);
      await beat(tok, 500);
    }
    rows.forEach((r, i) => { if (PT[i] === null) relabel(r.v, 'i'); });
    say('valid-invalid bit：v = 在 memory', 'i = 不合法，或還在 disk 上');
    await beat(tok, 3000);
    glow(lm[1], GOLD); glow(rows[1].v, BADR);
    say('存取 B：bit 是 i → page fault', '硬體 trap 給 OS');
    await beat(tok, 2800);
    say('pure demand paging：一開始一個都不載入', '靠 locality of reference，fault 不會太多');
    await beat(tok, 3000);
  }
  async function scFaultSteps(tok) {
    fresh([0, 4.4, 15], [0, 3.2, 0]);
    cube('load M', DARK, [1.6, 0.6, 0.9], -5.6, 5.6); tag('指令', 'idx', -5.6, 6.3);
    tag('page table', 'ptr', -2.6, 6.6);
    const ent = cube('i', GRAY, [1.0, 0.6, 0.8], -2.6, 5.6);
    tag('M 的 entry', 'idx', -2.6, 4.9);
    const os = cube('OS', PURPLE, [1.8, 0.9, 1.0], -2.6, 1.4);
    tag('physical memory', 'ptr', 2.0, 6.6);
    const free = cube('free frame', PALE, [1.8, 0.7, 0.9], 2.0, 3.6);
    cube('', SAND, [1.8, 0.7, 0.9], 2.0, 4.4); cube('', SAND, [1.8, 0.7, 0.9], 2.0, 2.8);
    tag('backing store', 'ptr', 5.6, 6.6);
    const dm = cube('M', TEAL, [1.0, 0.6, 0.8], 5.6, 4.0);
    const stepL = tag('', 'ptr alt', 0, 0.2);
    const st = async (n, cap, f, ms = 2600) => { txt(stepL, '步驟 ' + n); say(cap, f); await beat(tok, ms); };
    const pk = cube('M', ORANGE, [0.8, 0.45, 0.5], -5.6, 5.6, 0.6);
    move(pk, -2.6, 5.6, 0.7);
    await st('①', '① 參考 M：查 page table', 'bit = i：M 不在 memory');
    glow(ent, BADR);
    move(pk, -2.6, 1.4, 0.7); glow(os, GOLD);
    await st('②', '② trap：page fault 交給 OS', '先確認是合法存取（不合法就終止 process）');
    move(pk, 5.6, 4.0, 0.7); glow(dm, GOLD);
    await st('③', '③ page 在 backing store 上', '找一個 free frame，排 disk 讀取');
    const inn = cube('M', TEAL, [1.0, 0.5, 0.6], 5.6, 4.0, 0.8);
    move(inn, 2.0, 3.6, 0.8);
    await st('④', '④ 把 M 讀進 free frame', '等 disk 的時候 CPU 可以先給別的 process', 2800);
    kill(inn); relabel(free, 'M'); tint(free, TEAL); glow(dm, null);
    relabel(ent, 'v'); tint(ent, GREEN); glow(ent, OKG);
    await st('⑤', '⑤ 更新 page table：bit 改成 v', '記下 frame number');
    glow(os, null); move(pk, -5.6, 5.6, 0.6);
    await beat(tok, 700);
    move(pk, 2.0, 3.6, 0.7); glow(free, OKG);
    await st('⑥', '⑥ 重新執行被中斷的指令', '這次 M 已經在 memory：成功', 3000);
    txt(stepL, '');
    say('page fault 是 trap，指令必須能 restart', '例如 block move 要先檢查兩端都在 memory');
    await beat(tok, 3000);
  }
  async function scEatFault(tok) {
    fresh([0, 4.0, 13], [0, 2.8, 0]);
    say('memory access 200 ns、page-fault service 8 ms', '8 ms = 8,000,000 ns');
    const H = (ns) => Math.log10(ns) * 0.85;
    const bars = [];
    const mk = (x, v, c, nm) => { const h = H(v); const m = cube('', c, [1.6, h, 1.2], x, h / 2, 0, 0); tag(nm, 'ptr', x, -0.1, 1.2); const l = tag('', 'ptr alt', x, h + 0.4); bars.push(m); return l; };
    const l1 = mk(-4, 200, BLUE, 'memory'); txt(l1, '200 ns');
    await beat(tok, 1800);
    const l2 = mk(-1.3, 8e6, RED, 'page fault'); txt(l2, '8,000,000 ns');
    tag('高度為對數尺度', 'idx', 5.4, 6.4);
    await beat(tok, 2400);
    say('EAT = (1 − p) × 200 + p × 8,000,000', '= 200 + 7,999,800 × p');
    await beat(tok, 3000);
    const l3 = mk(1.4, 8199.8, ORANGE, 'p = 1/1000'); txt(l3, '≈ 8.2 µs');
    say('每 1000 次存取 fault 一次', 'EAT ≈ 8.2 µs：慢了 40 倍！');
    await beat(tok, 3200);
    const l4 = mk(4.1, 220, GREEN, '慢 < 10%'); txt(l4, '220 ns');
    say('要求只慢 10%：EAT < 220 ns', '20 > 7,999,800 × p → p < 0.0000025');
    await beat(tok, 3200);
    say('約 40 萬次存取才能 fault 一次', 'page fault rate 一定要壓得很低');
    await beat(tok, 3000);
  }
  async function scCow(tok) {
    fresh([0, 4.4, 14], [0, 3.0, 0]);
    tag('process₁（parent）', 'ptr', -4.6, 6.4); tag('process₂（child）', 'ptr', 4.6, 6.4); tag('physical memory', 'ptr', 0, 6.4);
    const pg = { A: cube('page A', BLUE, [1.8, 0.6, 0.9], 0, 5.2), B: cube('page B', PURPLE, [1.8, 0.6, 0.9], 0, 4.2), C: cube('page C', ORANGE, [1.8, 0.6, 0.9], 0, 3.2) };
    const ys = { A: 5.2, B: 4.2, C: 3.2 };
    const pr = {}, ch = {};
    Object.keys(ys).forEach((k) => { pr[k] = cube(k, PALE, [0.7, 0.5, 0.6], -4.6, ys[k]); line(-4.25, ys[k], -0.9, ys[k], 0, '#4b9ee2'); });
    say('parent 有 page A、B、C', '');
    await beat(tok, 2000);
    const cl = {};
    Object.keys(ys).forEach((k) => { ch[k] = cube(k, PALE, [0.7, 0.5, 0.6], 4.6, ys[k], 0, 2); cl[k] = line(4.25, ys[k], 0.9, ys[k], 0, '#9b7ef4'); });
    say('fork()：child 不複製，直接共用同一份 page', '共用的 page 標成 copy-on-write');
    Object.values(pg).forEach((m) => glow(m, '#3a3000'));
    await beat(tok, 3000);
    Object.values(pg).forEach((m) => glow(m, null));
    const w = cube('寫入 C', RED, [1.2, 0.45, 0.5], 4.6, 1.6, 0.6);
    say('child 要寫 page C', '這時候才複製');
    move(w, 4.6, ys.C + 0.5, 0.6); glow(ch.C, GOLD);
    await beat(tok, 1800);
    const cc = cube('copy of C', ORANGE, [1.8, 0.6, 0.9], 0, 3.2, 0.2);
    move(cc, 0, 1.8, 0);
    await beat(tok, 1300);
    kill(cl.C); line(4.25, ys.C, 0.9, 1.8, 0, '#9b7ef4');
    say('child 改指向自己的副本，再寫入', 'parent 的 C 不受影響');
    glow(cc, OKG); fly(w);
    await beat(tok, 2800);
    say('A、B 只有讀：一直共用', '只複製被修改的 page → fork 快很多');
    await beat(tok, 2800);
    say('vfork()：連 page table 都不複製', 'child 直接用 parent 的空間，通常馬上 exec()');
    await beat(tok, 3000);
  }
  async function scNeedReplace(tok) {
    fresh([0, 4.4, 14], [0, 3.0, 0]);
    tag('physical memory（滿了）', 'ptr', -1.0, 6.4);
    const fr = [['A', 0], ['B', 1], ['C', 0]].map(([n, d], k) => ({ m: cube(n, pcol(k), [1.8, 0.7, 0.9], -1.0, 5.2 - k * 1.0), d, l: tag('dirty = ' + d, 'idx', 0.9, 5.2 - k * 1.0) }));
    tag('backing store', 'ptr', 4.8, 6.4);
    const disk = cube('disk', DARK, [2.0, 1.6, 1.0], 4.8, 4.2);
    const io = tag('disk I/O：0', 'ptr alt', 4.8, 2.6);
    say('要載入 page D，但沒有 free frame', '→ page replacement');
    const nd = cube('D', TEAL, [0.9, 0.5, 0.6], -5.4, 4.2, 0, 2);
    await beat(tok, 2600);
    say('① 用置換演算法選一個 victim', '先選 B');
    glow(fr[1].m, BADR);
    await beat(tok, 2000);
    say('B 的 dirty bit = 1：被改過', '② 先寫回 disk，再改 page table 為 i');
    const out = cube('B', pcol(1), [0.9, 0.5, 0.6], -1.0, 4.2, 0.6); move(out, 4.8, 4.2, 0.6); txt(io, 'disk I/O：1');
    await beat(tok, 2200); fly(out);
    say('③ 把 D 讀進空出的 frame', '④ 更新 page table、重新執行指令');
    move(nd, -1.0, 4.2, 0.7); txt(io, 'disk I/O：2'); kill(fr[1].m);
    await beat(tok, 2600);
    say('如果 victim 選 C（dirty = 0）', 'disk 上的副本還是對的：不用寫回');
    glow(fr[2].m, BADR);
    await beat(tok, 2400);
    txt(io, '只要 1 次 I/O');
    say('dirty bit 讓 page transfer 從 2 次變 1 次', 'modify bit 由硬體在寫入時設定');
    await beat(tok, 3000);
    void disk;
  }

  // ═════════════════════════ 場景（課本）：置換演算法 ═════════════════════════
  const gridCam = () => fresh([0, 3.4, 13.5], [0, 3.0, 0]);
  async function scFifo(tok) {
    gridCam();
    say('課本 reference string，3 個 frame', 'FIFO：換掉最早進來的');
    await beat(tok, 2200);
    const g = await playGrid(tok, BOOK, 3, 'fifo', 5.4, { ms: 700, hitMs: 450 });
    say('FIFO 共 15 次 page fault', '簡單，但可能把常用的 page 換掉');
    await beat(tok, 3200);
    void g;
  }
  async function scOpt(tok) {
    gridCam();
    say('OPT：換掉「最久以後才會用到」的', '保證 page fault 最少');
    await beat(tok, 2200);
    await playGrid(tok, BOOK, 3, 'opt', 5.4, { ms: 950, hitMs: 450 });
    say('OPT 只有 9 次 page fault', '要知道未來 → 做不到，只當比較基準');
    await beat(tok, 3200);
  }
  async function scLru(tok) {
    gridCam();
    say('LRU：換掉「最久沒被用過」的', '用過去推測未來');
    await beat(tok, 2200);
    await playGrid(tok, BOOK, 3, 'lru', 5.4, { ms: 800, hitMs: 450 });
    say('LRU 12 次：介於 FIFO 15 和 OPT 9 之間', 'LRU 是 stack algorithm，沒有 Belady\'s anomaly');
    await beat(tok, 3200);
  }
  async function scBelady(tok) {
    fresh([0, 3.6, 14], [0, 3.4, 0]);
    say('FIFO，reference string 1 2 3 4 1 2 5 1 2 3 4 5', '先給 3 個 frame');
    await beat(tok, 2400);
    const g3 = await playGrid(tok, BELADY, 3, 'fifo', 6.6, { ms: 650, hitMs: 450, name: '3 frames', width: 9, x0: -4.8, cntX: 5.4, formula: 'FIFO，3 frames' });
    say('3 個 frame：9 次 page fault', '');
    await beat(tok, 2000);
    say('多給一個 frame，應該會比較少吧？', '改成 4 個 frame');
    await beat(tok, 2000);
    const g4 = await playGrid(tok, BELADY, 4, 'fifo', 3.3, { ms: 650, hitMs: 450, name: '4 frames', width: 9, x0: -4.8, cntX: 5.4, formula: 'FIFO，4 frames' });
    txt(g3.cnt, 'page fault：9'); txt(g4.cnt, 'page fault：10 !');
    say('4 個 frame 反而 10 次！', 'Belady\'s anomaly：frame 變多，fault 變多');
    await beat(tok, 3400);
    say('LRU、OPT 是 stack algorithm 不會發生', 'n 個 frame 的內容 ⊆ n + 1 個 frame 的內容');
    await beat(tok, 3200);
  }
  async function scLruStack(tok) {
    fresh([0, 4.0, 13.5], [0, 3.0, 0]);
    const REF = [4, 7, 0, 7, 1, 0, 1, 2, 1, 2, 7, 1, 2];
    const cw = 0.62, X = (i) => -6.0 + i * cw;
    const rm = REF.map((p, i) => cube(p, pcol(p), [0.52, 0.45, 0.5], X(i), 6.2));
    tag('a', 'ptr alt', (X(9) + X(10)) / 2, 6.9); tag('b', 'ptr alt', (X(10) + X(11)) / 2, 6.9);
    tag('stack（上 = 最近用過）', 'ptr', 3.6, 6.2);
    const sm = new Map(); let stack = [];
    const sy = (k) => 5.2 - k * 0.66;
    say('LRU 的一種實作：用 stack 記錄使用順序', '被參考的 page 拿到最上面');
    await beat(tok, 2600);
    const snap = tag('', 'ptr alt', 3.6, 1.2);
    for (let i = 0; i < REF.length; i++) {
      const p = REF[i];
      glow(rm[i], GOLD); if (i) glow(rm[i - 1], null);
      stack = [p, ...stack.filter((x) => x !== p)];
      if (!sm.has(p)) sm.set(p, cube(p, pcol(p), [1.2, 0.55, 0.7], 3.6, sy(stack.length - 1) + 2, 0, 0));
      stack.forEach((x, k) => move(sm.get(x), 3.6, sy(k), 0));
      say('參考 ' + p + '：移到最上面', 'stack：' + stack.join(' '));
      if (i === 9) { txt(snap, 'a 之前：' + stack.join(' ')); await beat(tok, 2600); }
      else if (i === 10) { txt(snap, 'b 之後：' + stack.join(' ')); await beat(tok, 2600); }
      else await beat(tok, 900);
    }
    say('最底下的 4 就是 LRU：要換就換它', '不用搜尋；但每次參考都要改 6 個指標');
    await beat(tok, 3000);
    say('另一種：counter，每個 entry 記最後使用時間', '換掉時間最小的（要搜尋）');
    await beat(tok, 3000);
  }
  async function scRefBits(tok) {
    fresh([0, 4.0, 13], [0, 3.0, 0]);
    say('硬體只給一個 reference bit：用過就設 1', 'OS 每隔一段時間記錄一次');
    await beat(tok, 2600);
    const pages = [['page X', '11000100'], ['page Y', '01110111']];
    const rows = pages.map(([n, b], r) => {
      tag(n, 'ptr', -5.4, 4.8 - r * 1.8);
      return b.split('').map((ch, i) => cube(ch, ch === '1' ? BLUE : PALE, [0.6, 0.6, 0.6], -3.6 + i * 0.75, 4.8 - r * 1.8, 0, 2));
    });
    tag('← 最近', 'idx', -3.6, 5.6); tag('8 個週期前 →', 'idx', 1.6, 5.6);
    say('additional-reference-bits：8-bit 位移暫存器', '每個週期右移，新的 reference bit 放最左邊');
    await beat(tok, 3200);
    const t1 = tag('= 196', 'ptr alt', 3.4, 4.8), t2 = tag('= 119', 'ptr alt', 3.4, 3.0);
    say('當成無號整數比大小', '11000100 = 196，01110111 = 119');
    await beat(tok, 3000);
    rows[1].forEach((m) => glow(m, BADR));
    say('數字最小的 = 最近最少用 → victim', 'Y（119）比 X（196）更久沒用');
    await beat(tok, 3000);
    rows[1].forEach((m) => glow(m, null));
    say('下一個週期：X 沒用到、Y 用到了', '右移，最左邊放新的 bit');
    const nx = '01100010', ny = '10111011';
    rows[0].forEach((m, i) => relabel(m, nx[i])); rows[1].forEach((m, i) => relabel(m, ny[i]));
    rows[0].forEach((m, i) => tint(m, nx[i] === '1' ? BLUE : PALE)); rows[1].forEach((m, i) => tint(m, ny[i] === '1' ? BLUE : PALE));
    txt(t1, '= 98'); txt(t2, '= 187');
    await beat(tok, 3200);
    say('00000000 = 8 個週期都沒用', '11111111 = 每個週期都用');
    await beat(tok, 2800);
  }
  async function scClock(tok) {
    fresh([0, 7.5, 10], [0, 0.6, 0]);
    const N = 6, R = 3.0;
    const pages = [3, 8, 1, 5, 2, 9], bits = [0, 1, 1, 0, 1, 1];
    const pos = (k) => { const a = Math.PI / 2 - k * 2 * Math.PI / N; return [Math.cos(a) * R, Math.sin(a) * R]; };
    const ms = pages.map((p, k) => { const [x, z] = pos(k); return cube(p, pcol(p), [1.0, 0.7, 1.0], x, 0.35, -z); });
    const bl = bits.map((b, k) => { const [x, z] = pos(k); return tag('r = ' + b, 'ptr', x * 1.45, 0.3, -z * 1.45); });
    const hand = cube('', DARK, [0.18, 0.18, R - 0.9], 0, 0.3, 0);
    const setHand = (k) => { const [x, z] = pos(k); hand.position.set(x * 0.45, 0.3, -z * 0.45); hand.rotation.y = Math.atan2(x, -z); };
    tag('circular queue', 'idx', 0, 0.2, 0);
    let ptr = 1; setHand(ptr);
    say('Second-chance：frame 排成一圈，指標指向下一個候選', '每個 page 有 reference bit');
    await beat(tok, 3000);
    say('page fault：從指標開始看', 'r = 1 → 清成 0、給第二次機會、往下走');
    await beat(tok, 2400);
    while (bits[ptr]) {
      glow(ms[ptr], GOLD); bits[ptr] = 0; txt(bl[ptr], 'r = 0');
      say('page ' + pages[ptr] + '：r = 1 → 清成 0，放過一次', '');
      await beat(tok, 1300); glow(ms[ptr], null);
      ptr = (ptr + 1) % N; setHand(ptr);
      await beat(tok, 500);
    }
    glow(ms[ptr], BADR);
    say('page ' + pages[ptr] + '：r = 0 → 換掉它', '新的 page 放進來');
    await beat(tok, 2000);
    fly(ms[ptr]);
    const [x, z] = pos(ptr);
    ms[ptr] = cube(7, pcol(7), [1.0, 0.7, 1.0], x, 0.35, -z, 3); bits[ptr] = 1; txt(bl[ptr], 'r = 1');
    ptr = (ptr + 1) % N; setHand(ptr);
    await beat(tok, 2200);
    say('全部 r = 1 時繞一圈全清掉', '→ 退化成 FIFO');
    await beat(tok, 3000);
  }
  async function scEnhanced(tok) {
    fresh([0, 4.2, 13], [0, 3.0, 0]);
    const cls = [['(0, 0)', '最近沒用、沒改過', '最適合換', GREEN], ['(0, 1)', '最近沒用、改過', '換之前要寫回', TEAL], ['(1, 0)', '最近用過、沒改過', '可能很快再用', ORANGE], ['(1, 1)', '最近用過、改過', '最不該換', RED]];
    const ms = cls.map(([k, a, b, c], i) => { const y = 5.6 - i * 1.15; tag(a, 'idx', -0.6, y); tag(b, 'idx', 3.6, y); return cube(k, c, [1.8, 0.8, 0.9], -4.2, y, 0, 2 + i * 0.4); });
    tag('(reference, modify)', 'ptr', -4.2, 6.6);
    say('Enhanced second-chance：看 (reference, modify)', '分成四類');
    await beat(tok, 2600);
    for (let i = 0; i < 4; i++) { glow(ms[i], GOLD); say('第 ' + (i + 1) + ' 類 ' + cls[i][0] + '：' + cls[i][1], cls[i][2]); await beat(tok, 2000); glow(ms[i], null); }
    glow(ms[0], OKG);
    say('換掉「最低類別」裡遇到的第一個', '可能要繞好幾圈才找到');
    await beat(tok, 3000);
    say('優先換沒改過的：省一次寫回 disk 的 I/O', '');
    await beat(tok, 2400);
  }

  // ═════════════════════════ 場景（課本）：frame 分配、thrashing、working set ═════════════════════════
  async function scAllocation(tok) {
    fresh([0, 6.5, 11.5], [0, 0.8, 0]);
    say('62 個 free frame，兩個 process', 'P1 大小 10 pages、P2 大小 127 pages');
    const W = 0.62, pos = (i) => [-5.6 + (i % 18) * W, -1.6 + Math.floor(i / 18) * W * 1.2];
    const tiles = [];
    for (let i = 0; i < 62; i++) { const [x, z] = pos(i); tiles.push(cube('', PALE, [W - 0.08, 0.3, W - 0.08], x, 0.15, z)); }
    tag('62 frames', 'ptr', 0, 1.4, -2.8);
    await beat(tok, 2600);
    const paint = async (n1, n2, cap, f) => {
      tiles.forEach((m, i) => { tint(m, i < n1 ? BLUE : i < n1 + n2 ? PURPLE : PALE); m.position.y = i < n1 + n2 ? 0.3 : 0.15; });
      say(cap, f); await beat(tok, 3200);
    };
    const l1 = tag('', 'ptr', -5.6, 1.4, 3.0), l2 = tag('', 'ptr alt', 2.4, 1.4, 3.0);
    txt(l1, 'P1：31'); txt(l2, 'P2：31');
    await paint(31, 31, 'equal allocation：一人一半', 'P1 才 10 pages 卻拿 31 個 → 浪費');
    txt(l1, 'P1：4'); txt(l2, 'P2：57');
    await paint(4, 57, 'proportional allocation：依大小分', '10/137 × 62 ≈ 4，127/137 × 62 ≈ 57');
    say('也可以依 priority 分配', '每個 process 還有最少 frame 數（由指令集決定）');
    await beat(tok, 3000);
    say('global replacement：可以搶別人的 frame', 'local：只能換自己的；global 通常 throughput 較好');
    await beat(tok, 3200);
  }
  async function scThrashing(tok) {
    fresh([0, 4.0, 13], [0, 3.0, 0]);
    const U = [18, 36, 52, 65, 75, 82, 85, 72, 46, 22];
    const X = (d) => -5.0 + d * 1.0, Y = (u) => 0.4 + u / 100 * 5.4;
    line(-5.2, 0.4, 5.6, 0.4, 0, '#6e5f49'); line(-5.2, 0.4, -5.2, 6.2, 0, '#6e5f49');
    tag('degree of multiprogramming', 'idx', 2.4, -0.1, 0.6); tag('CPU 使用率', 'idx', -5.2, 6.6);
    const dot = cube('', ORANGE, [0.35, 0.35, 0.35], X(1), Y(U[0]));
    const pts = [[X(1), Y(U[0])]];
    let curve = null;
    say('process 越多，CPU 越忙', '一開始使用率跟著上升');
    for (let d = 1; d <= U.length; d++) {
      pts.push([X(d), Y(U[d - 1])]);
      if (curve) kill(curve); curve = polyline(pts.slice(1), '#c08a1f');
      move(dot, X(d), Y(U[d - 1]));
      if (d === 7) { say('到某一點後，每個 process 分到的 frame 太少', '一直 page fault，都在等 paging device'); await beat(tok, 2600); }
      if (d === 8) { tint(dot, RED); say('使用率下降 → OS 以為太閒，再加 process', '→ 更多 fault，使用率更低'); await beat(tok, 2800); }
      await beat(tok, 650);
    }
    ghost(RED, 3.2, 5.6, 0.2, X(8.6), 3.2, -0.2, 0.1); tag('thrashing', 'ptr alt', X(8.6), 6.0);
    say('Thrashing：花在 paging 的時間比執行還多', 'frame 數 < working set 就會發生');
    await beat(tok, 3200);
    say('解法：local replacement、working set、PFF', '必要時降低 degree of multiprogramming');
    await beat(tok, 3000);
  }
  async function scWorkingSet(tok) {
    fresh([0, 4.4, 13], [0, 3.2, 0]);
    ws.D = 10; ws.t = 1; wsDraw(); ws.t = 10; wsUpdate();
    say('locality：一段時間內只用一小群 page', 'working set window Δ = 10');
    await beat(tok, 3000);
    say('t₁：最近 10 個 reference', 'WS(t₁) = {1, 2, 5, 6, 7}');
    await beat(tok, 3200);
    for (let t = 11; t <= 26; t++) { ws.t = t; wsUpdate(); say('視窗往右滑：t = ' + t, 'WS = {' + wsSet(WSREF, t, 10).join(', ') + '}'); await beat(tok, 420); }
    say('t₂：程式進入新的 locality', 'WS(t₂) = {3, 4}');
    await beat(tok, 3200);
    say('D = Σ WSSᵢ = 總需求', 'D > 可用 frame 數 m → 暫停某個 process');
    await beat(tok, 3200);
    say('Δ 太小抓不到整個 locality', 'Δ 太大會把好幾個 locality 混在一起');
    await beat(tok, 3000);
  }
  async function scPff(tok) {
    fresh([0, 4.0, 13], [0, 3.0, 0]);
    const X = (f) => -5.0 + f * 0.8, Y = (r) => 0.4 + r * 5.2;
    const rate = (f) => 1 / (1 + 0.55 * f * f / 4);
    line(-5.2, 0.4, 5.6, 0.4, 0, '#6e5f49'); line(-5.2, 0.4, -5.2, 6.0, 0, '#6e5f49');
    tag('frame 數', 'idx', 4.8, -0.1, 0.6); tag('page-fault rate', 'idx', -5.2, 6.4);
    const pts = []; for (let f = 0.5; f <= 13; f += 0.25) pts.push([X(f), Y(rate(f))]);
    polyline(pts, '#c08a1f');
    line(-5.2, Y(0.55), 5.6, Y(0.55), 0, RED); tag('upper bound', 'ptr alt', 5.0, Y(0.55) + 0.35);
    line(-5.2, Y(0.12), 5.6, Y(0.12), 0, GREEN); tag('lower bound', 'ptr', 5.0, Y(0.12) + 0.35);
    say('Page-fault frequency：直接盯著 fault rate', '設上界和下界');
    await beat(tok, 2800);
    const dot = cube('P', ORANGE, [0.4, 0.4, 0.4], X(2), Y(rate(2)));
    say('fault rate 高於上界：frame 不夠', '→ 多給它 frame');
    await beat(tok, 2000);
    for (let f = 2.5; f <= 5; f += 0.5) { move(dot, X(f), Y(rate(f))); await beat(tok, 380); }
    say('回到上下界之間：剛剛好', '');
    await beat(tok, 2000);
    move(dot, X(11), Y(rate(11)));
    say('低於下界：frame 太多', '→ 拿走一些給別人');
    await beat(tok, 2400);
    for (let f = 10.5; f >= 8.5; f -= 0.5) { move(dot, X(f), Y(rate(f))); await beat(tok, 380); }
    say('需要 frame 卻沒有 free frame', '→ 暫停（swap out）一個 process');
    await beat(tok, 3000);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'demand-paging-valid': { title: '（課本）Demand paging 與 valid-invalid bit', play: scDemandValid },
    'page-fault-steps': { title: '（課本）Page fault 處理的 6 個步驟', play: scFaultSteps },
    'eat-page-fault': { title: '（課本）EAT：200 ns 與 8 ms', play: scEatFault },
    'copy-on-write': { title: '（課本）fork() 的 copy-on-write', play: scCow },
    'page-replacement-basic': { title: '（課本）沒有 free frame：victim 與 dirty bit', play: scNeedReplace },
    'fifo-replace': { title: '（課本）FIFO：15 次 page fault', play: scFifo },
    'opt-replace': { title: '（課本）OPT：9 次 page fault', play: scOpt },
    'lru-replace': { title: '（課本）LRU：12 次 page fault', play: scLru },
    'belady-anomaly': { title: '（課本）Belady\'s anomaly：3 frames 9 次、4 frames 10 次', play: scBelady },
    'lru-stack': { title: '（課本）LRU 的 stack 實作', play: scLruStack },
    'additional-ref-bits': { title: '（課本）Additional-reference-bits：11000100 vs 01110111', play: scRefBits },
    'second-chance-clock': { title: '（課本）Second-chance（clock）演算法', play: scClock },
    'enhanced-second-chance': { title: '（課本）Enhanced second-chance：(r, m) 四類', play: scEnhanced },
    'frame-allocation': { title: '（課本）Frame 分配：equal vs proportional', play: scAllocation },
    'thrashing': { title: '（課本）Thrashing：CPU 使用率崩落', play: scThrashing },
    'working-set': { title: '（課本）Working set：Δ = 10', play: scWorkingSet },
    'pff': { title: '（課本）Page-fault frequency 上下界', play: scPff },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ vm.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 8 章 Virtual Memory（清大 周志遠 13A–14D 講 + LRU/Optimal 例題 + Page Fault Handling）— cued scenes ───
// 每個場景是一串 step；每個 step 等老師講到那句話（notes 的 cues）才做一個短動作，不重播、不循環。
// 置換演算法的每一格都由 vmSim() 實際模擬算出來（FIFO 9／10、OPT 6、LRU 8；19 個 reference 的例題 FIFO 13、LRU 14、OPT 10），
// EAT 用老師投影片的數字（200 ns、8 ms、p = 1/1000 → 8.2 µs）；老師沒給的數字標「示意」。
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
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const PGC = { 1: '#4b9ee2', 2: '#2fc092', 3: '#9b7ef4', 4: '#dd8238', 5: '#e55a9b', 6: '#31aab0', 7: '#c08a1f', 0: '#7a8fa6' };
const pc = (p) => PGC[p] || '#b5a58a';
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
const CAMW = [[0, 4.4, 15.5], [0, 3.2, 0]];
// a list of short lines (a slide's bullet points), shown one at a time
// (left-aligned at x)
function bullets(x, yTop, dy = 0.62) { let n = 0; return (t, kind = 'note') => { const l = tag(t, kind, x, yTop - (n++) * dy); l.center.set(0, 0.5); return l; }; }
// a polyline from [x, y] points
function poly(pts, color = '#8d6b3a', z = 0) { const ls = []; for (let i = 1; i < pts.length; i++) ls.push(line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], z, color)); return ls; }
// small axes: origin (x0, y0), width w, height h
function axes(x0, y0, w, h, xl, yl) {
  const a = [line(x0, y0, x0 + w, y0, 0, '#6e5f49'), line(x0, y0, x0, y0 + h, 0, '#6e5f49')];
  a.push(sm(xl, x0 + w - 0.4, y0 - 0.4), sm(yl, x0 + 0.3, y0 + h + 0.35));
  return a;
}
// a page table: rows [page, frame, bit]; columns: page # | frame # | v/i
function ptable(x, yTop, rows, o = {}) {
  const dy = o.dy || 0.6, w = o.w || 0.9;
  const head = o.head === false ? [] : [sm(o.h0 || 'page', x - w - 0.05, yTop + 0.55), sm(o.h1 || 'frame', x, yTop + 0.55), sm('v / i', x + w * 0.8, yTop + 0.55)];
  const cells = rows.map(([p, f, b], i) => {
    const y = yTop - i * dy;
    const c0 = bx(String(p), o.pcol ? o.pcol(p) : MC.sand, x - w - 0.05, y, 0, w - 0.08, dy - 0.08, 0.6);
    const c1 = bx(f == null ? '' : String(f), MC.paper, x, y, 0, w - 0.08, dy - 0.08, 0.6);
    const c2 = bx(String(b), b === 'v' || b === 1 || b === '1' ? MC.mint : '#f3c9c9', x + w * 0.8, y, 0, w * 0.55, dy - 0.08, 0.6);
    return [c0, c1, c2];
  });
  return {
    cells, head, y: (i) => yTop - i * dy,
    set(i, f, b) { relabel(cells[i][1], f == null ? '' : String(f)); relabel(cells[i][2], String(b)); tint(cells[i][2], b === 'v' || b === 1 || b === '1' ? MC.mint : '#f3c9c9'); },
  };
}
// ── page replacement: a real simulation (slots stay put; order = queue / stack, newest first) ──
function vmSim(ref, F, alg) {
  const fr = Array(F).fill(null), loadAt = Array(F).fill(-1), last = {}, out = [];
  ref.forEach((p, i) => {
    let slot = fr.indexOf(p), fault = false, victim = null;
    if (slot < 0) {
      fault = true; slot = fr.indexOf(null);
      if (slot < 0) {
        const pickMin = (key) => fr.reduce((b, v, k) => (key(k) < key(b) ? k : b), 0);
        if (alg === 'fifo') slot = pickMin((k) => loadAt[k]);
        else if (alg === 'lru') slot = pickMin((k) => last[fr[k]]);
        else {
          const nx = fr.map((v) => { const j = ref.indexOf(v, i + 1); return j < 0 ? Infinity : j; });
          const mx = Math.max(...nx);
          slot = fr.reduce((b, v, k) => (nx[k] === mx && (nx[b] !== mx || loadAt[k] < loadAt[b]) ? k : b), nx.indexOf(mx));
        }
        victim = fr[slot];
      }
      fr[slot] = p; loadAt[slot] = i;
    }
    last[p] = i;
    const order = alg === 'lru'
      ? fr.filter((v) => v !== null).sort((a, b) => last[b] - last[a])
      : fr.map((v, k) => [v, loadAt[k]]).filter((e) => e[0] !== null).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    out.push({ p, i, fault, victim, slot, frames: fr.slice(), order });
  });
  return out;
}
const vmFaults = (ref, F, alg) => vmSim(ref, F, alg).filter((s) => s.fault).length;
// the replacement table: reference string across the top, one column per reference, frames below.
// view 'order' draws the queue/stack (newest on top, like the lecturer); 'slots' keeps each frame's row.
function rgrid(ref, F, alg, o = {}) {
  const dx = o.dx || 0.95, x0 = o.x0 != null ? o.x0 : -((ref.length - 1) * dx) / 2, yH = o.y != null ? o.y : 6.0, dy = o.dy || 0.66, cs = o.cs || 0.56;
  const st = vmSim(ref, F, alg), view = o.view || 'order';
  const head = ref.map((p, i) => sm(String(p), x0 + i * dx, yH));
  const fl = F > 0 && o.slotNames ? o.slotNames.map((n, k) => sm(n, x0 - dx * 0.9, yH - 0.75 - k * dy)) : [];
  const cnt = hd((o.name || alg.toUpperCase()) + '：page fault 0', o.cx != null ? o.cx : 0, o.cy != null ? o.cy : yH + 0.75);
  let k = 0, faults = 0, hits = 0, cur = null;
  const cols = [];
  const G = {
    st, head, cnt, cols,
    get k() { return k; }, get faults() { return faults; }, get hits() { return hits; },
    x: (i) => x0 + i * dx, yRow: (r) => yH - 0.75 - r * dy, yMark: yH - 0.75 - F * dy + 0.05,
    clear() { cols.forEach((c) => { c.cubes.forEach(kill); gone(c.mk, c.vic); }); gone(head, fl, cnt); },
    // show the next n references (one column each); returns the last state
    async go(tok, n = 1, ms = 380) {
      let s = null;
      for (let c = 0; c < n && k < st.length; c++) {
        s = st[k]; const x = x0 + k * dx;
        if (cur) glow(cur, null);
        const vals = view === 'order' ? s.order : s.frames;
        const cubes = [];
        vals.forEach((v, r) => {
          if (v === null) return;
          const m = cube(String(v), pc(v), [cs, cs, cs], x, yH - 0.75 - r * dy, 0, v === s.p && s.fault ? 1.2 : 0);
          cubes.push(m); if (v === s.p) cur = m;
        });
        glow(cur, s.fault ? NG : OKG);
        head[k].element.className = 'lab-label ' + (s.fault ? 'bad' : 'good');
        const mk = s.fault ? bad('F', x, yH - 0.75 - F * dy + 0.05) : good('✓', x, yH - 0.75 - F * dy + 0.05);
        const vic = s.victim != null && o.showVictim !== false ? sm('−' + s.victim, x, yH - 0.75 - F * dy - 0.45) : null;
        if (s.fault) faults++; else hits++;
        txt(cnt, (o.name || alg.toUpperCase()) + '：page fault ' + faults + (o.hits ? '，hit ' + hits : ''));
        cols.push({ cubes, mk, vic });
        k++;
        await wt(tok, ms);
      }
      return s;
    },
  };
  return G;
}
// a cycle of boxes around a centre, with arrows between them
function cycle(names, cx, cy, r, color = MC.sand) {
  const n = names.length, pts = names.map((t, i) => { const a = Math.PI / 2 - (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r]; });
  const bs = names.map((t, i) => bx(t, color, pts[i][0], pts[i][1], 0, 2.9, 0.55, 0.6));
  const as = pts.map((p, i) => { const q = pts[(i + 1) % n]; const a = V3(p[0], p[1], 0.4), b = V3(q[0], q[1], 0.4); const d = b.clone().sub(a); return arrow(a.clone().addScaledVector(d, 0.3), a.clone().addScaledVector(d, 0.7)); });
  return { bs, as, pts };
}

// ════════ TnmN_KNIbc4（第 13A 講：Virtual Memory 背景） ════════
scene('vm-13a-plan', '本章談什麼：virtual memory', CAM, [
  async (tok, S) => {                                   // 14.8 第九章 virtual memory：memory 管理會用到硬碟
    S.ram = zone('memory', -2.6, 0, 0, 4.4, 2.4); S.disk = prop('disk', 3.4, 0, 0, 1.1, 'disk');
    S.p = [0, 1, 2].map((i) => bx('page', MC.blue, -3.8 + i * 1.2, 0.4, 0, 1.0, 0.5, 0.8));
    const g = pkt('page', MC.orange, -1.4, 1.2, 0.6, 1.0); await slide(tok, g, 3.4, 1.6, 0.6, 700);
    cap('第九章：virtual memory', 'memory 管理不只用 memory，還會用到硬碟');
  },
  async (tok, S) => {                                   // 36.4 先介紹 virtual memory；學過 paging
    S.b = bullets(-6.2, 6.4); S.b('① 什麼是 virtual memory（接著 paging）');
    cap('先簡單介紹 virtual memory', '上一章學過 paging：用 page 管理 memory');
  },
  async (tok, S) => {                                   // 44.8 demand paging
    S.b('② demand paging：virtual memory 下的 paging');
    cap('有了 virtual memory', '在它底下做 paging 的方式叫 demand paging');
  },
  async (tok, S) => {                                   // 58.3 fork、process creation 也是 memory allocation
    S.b('③ process creation（fork）＝ memory allocation');
    cap('之前講過 fork', 'process creation 其實就是在做 memory allocation');
  },
  async (tok, S) => {                                   // 77.0 page replacement algorithm
    S.b('④ page replacement algorithm（很重要）', 'ptr');
    cap('本章重點：page replacement algorithm', '演算法很簡單，但一定要會');
  },
  async (tok, S) => {                                   // 86.0 thrashing：process 越多 CPU 使用率反而下降
    S.b('⑤ thrashing：process 越多，CPU 使用率反而往下掉', 'bad');
    cap('另一個非常重要：thrashing', '開越多 process，CPU 使用率居然下降');
  },
  async (tok, S) => {                                   // 112.2 解釋 thrashing、OS 怎麼避免
    good('會解釋 thrashing，以及 OS 怎麼避免它', 0, 2.6);
    cap('virtual memory 也會帶來效能影響', '要知道 thrashing 是什麼、OS 怎麼避免');
  },
]);

scene('vm-13a-why', '為什麼不必把整支程式放進 memory', CAM, [
  async (tok, S) => {                                   // 122.6 不希望一開始就把整個 process 放進 memory
    hd('一支 program 的內容', -4.2, 6.6);
    S.parts = [['main code', MC.blue], ['error 處理', MC.red], ['很少走的 branch', MC.orange], ['library', MC.purple], ['int a[10000]', MC.teal]]
      .map(([t, c], i) => bx(t, c, -4.2, 5.8 - i * 0.75, 0, 3.0, 0.6, 0.8));
    S.mem = zone('memory', 3.0, 1.0, 0, 4.4, 3.0);
    cap('不希望一開始就把整個 process', '的 memory content 全部放進 memory');
  },
  async (tok, S) => {                                   // 140.7 之前：dynamic loading、dynamic linking
    S.b = bullets(0.6, 6.4); S.b('之前：dynamic loading、dynamic linking 減少用量');
    cap('前面章節學過', 'dynamic loading、dynamic linking 可以減少 memory 使用');
  },
  async (tok, S) => {                                   // 150.2 virtual memory 更 aggressive
    S.b('這章：virtual memory 更積極地節省', 'ptr');
    cap('virtual memory 更 aggressive 地節省', '放進 memory 的東西要更有意義');
  },
  async (tok, S) => {                                   // 171.4 error 處理的 code 用不到
    glow(S.parts[1], NG); sm('多半用不到', -1.9, 5.05);
    cap('很多 error 處理的 code', '根本用不到（dynamic loading 解決）');
  },
  async (tok, S) => {                                   // 186.0 branch：很多 code path 用不到
    glow(S.parts[2], NG); sm('沒走到', -1.9, 4.3);
    cap('program 有一堆 code path 跟 branch', '很多分支其實不會走到');
  },
  async (tok, S) => {                                   // 198.0 shared library → dynamic linking
    glow(S.parts[3], HL); sm('dynamic linking', -1.9, 3.55);
    cap('shared library', '用 dynamic linking 的方式解決');
  },
  async (tok, S) => {                                   // 207.4 array 宣告了卻沒用（多打幾個零）
    glow(S.parts[4], NG); bad('一萬個 element，大多沒用到', -4.2, 1.8);
    cap('array、variable allocate 了卻沒用', '多打幾個零就很浪費：這個還沒解決過');
  },
  async (tok, S) => {                                   // 241.3 VM：沒被 access 的 page 就不放 memory
    const used = pkt('用到的 page', MC.blue, -4.2, 5.8, 0.6, 1.6);
    await slide(tok, used, 2.0, 1.4, 0.6, 700);
    const u2 = pkt('用到的 page', MC.teal, -4.2, 2.8, 0.6, 1.6); await slide(tok, u2, 3.9, 1.4, 0.6, 600);
    cap('virtual memory 可以做到更 low level', 'page 沒被 access 到，就不放在 memory 裡');
  },
  async (tok, S) => {                                   // 260.6 utilization：放進去的東西真的被 access
    good('目的：放進 memory 的都是真的會被 access 的', 0.8, 3.4);
    cap('一切都是為了增加 memory utilization', '不是放了多少，而是放進去的真的被用到');
  },
]);

scene('vm-13a-benefit', 'Virtual memory 的四個好處', CAM, [
  async (tok, S) => {                                   // 287.5 logical 跟 physical 切開的極致
    hd('logical（virtual）', -4.4, 6.4); hd('physical memory', 0.6, 6.4);
    S.lg = [0, 1, 2, 3, 4, 5].map((i) => bx('page ' + i, MC.lilac, -4.4, 5.6 - i * 0.62, 0, 1.6, 0.52, 0.7));
    S.ph = [0, 1, 2].map((i) => bx('frame', MC.paper, 0.6, 5.6 - i * 0.62, 0, 1.6, 0.52, 0.7));
    S.ar = [arrow(V3(-3.5, 5.6, 0.4), V3(-0.3, 4.98, 0.4)), arrow(V3(-3.5, 4.36, 0.4), V3(-0.3, 5.6, 0.4))];
    cap('virtual memory：把 logical 跟 physical', 'address 切開來的極致');
  },
  async (tok, S) => {                                   // 316.4 甚至 map 到 disk 上
    S.disk = prop('disk', 4.6, 2.2, 0, 1.0, 'disk');
    S.ar.push(arrow(V3(-3.5, 3.12, 0.4), V3(3.9, 2.8, 0.4)), arrow(V3(-3.5, 2.5, 0.4), V3(3.9, 2.6, 0.4)));
    cap('既然切開了，不一定要 map 到 physical', '甚至可以 map 到 disk，使用者根本不 care');
  },
  async (tok, S) => {                                   // 338.7 ① process 可以比 physical memory 大
    S.b = bullets(-6.0, 1.7, 0.5); S.b('① program 可以比 physical memory 還大（例：physical 只有 16 GB）', 'good');
    cap('好處一：可以 run 非常大的 program', 'logical space 可以比 physical 還大，慢一點但能跑');
  },
  async (tok, S) => {                                   // 380.4 ② 增加資源使用率：硬碟也當 memory
    S.b('② 硬碟也當 memory → CPU、I/O 等資源使用率提高', 'good');
    cap('好處二：增加資源使用率', 'disk 也當作 memory 的一部分，空間變大');
  },
  async (tok, S) => {                                   // 409.2 degree of multiprogramming 變高
    S.ps = ['P1', 'P2', 'P3', 'P4'].map((n, i) => buddy(n, '', [MC.blue, MC.green, MC.purple, MC.orange][i], 2.6 + i * 1.15, 4.4, 0, 0.5));
    cap('可以放更多 process：degree of multiprogramming', '越多程式在 memory，越不會有資源閒著');
  },
  async (tok, S) => {                                   // 436.8 ③ programming 簡化（compiler、linker）
    S.b('③ programming 簡化：compiler 只管自己的 logical space', 'good');
    cap('好處三：programming 變簡單', 'compiler、linker 不必 care physical 哪裡被用');
  },
  async (tok, S) => {                                   // 504.8 ④ program 跑比較快
    S.b('④ program 跑比較快（尤其是啟動）', 'good');
    cap('好處四：program 跑得比較快', '沒有 VM 時要整支 load，program 大就很久');
  },
  async (tok, S) => {                                   // 529.1 demand paging：一次只搬 4KB，不是 10MB
    const a = pkt('4 KB', MC.green, 4.6, 2.9, 0.8, 0.9); await slide(tok, a, 0.6, 3.7, 0.8, 600);
    bad('整支 10 MB 一次 load：慢', 4.4, 6.9); good('demand paging：一次 4 KB', 4.4, 6.3);
    cap('demand paging 一開始什麼都不 load', '要用的 page 才放進來，一次只搬 4KB');
  },
  async (tok, S) => {                                   // 576.0 VM 包含 virtual address，又更進一步到 disk
    note('virtual memory ⊃ virtual address：還多用到 disk', 0.4, 0.2);
    cap('跟第八章 virtual address 的好處有重疊', 'virtual memory 更進一步：用到 disk');
  },
]);

scene('vm-13a-seg', '為什麼通常是 demand paging', CAM, [
  async (tok, S) => {                                   // 605.8 demand paging 或 demand segmentation
    S.l = bx('demand paging', MC.blue, -3.0, 5.6, 0, 3.2, 0.7, 0.9); S.r = bx('demand segmentation', MC.purple, 3.0, 5.6, 0, 3.6, 0.7, 0.9);
    cap('virtual memory 的做法分兩種', 'demand paging，或 demand segmentation');
  },
  async (tok, S) => {                                   // 632.0 以 page 或 segment 為單位放到 disk
    S.pg = [0, 1, 2, 3].map((i) => bx('', MC.tlb, -4.2 + i * 0.8, 4.4, 0, 0.7, 0.5, 0.6));
    S.sg = [[1.2, 1.0], [2.6, 1.6], [4.2, 0.7]].map(([x, w]) => bx('', MC.lilac, x, 4.4, 0, w, 0.5, 0.6));
    cap('同樣的概念', '可以一個 page 為單位，也可以一個 segment 為單位');
  },
  async (tok, S) => {                                   // 640.8 segment 大小不固定：找洞要 O(n)
    bad('大小不固定：搬回來要找洞（best / worst fit）→ O(n)', 3.0, 3.4);
    cap('通常不用 segmentation：大小不固定', '搬走再搬回來要找空洞，至少 O(n)');
  },
  async (tok, S) => {                                   // 663.8 paging fixed size：free list O(1)
    good('fixed size：free list 拿一個就好 → O(1)', -3.0, 3.4);
    cap('paging 是 fixed size', '有空位就能用，free list 找位置只要 O(1)');
  },
  async (tok, S) => {                                   // 695.9 兩個都有時：segmentation 在上、paging 在下
    S.top = bx('segmentation（上層）', MC.lilac, 0, 2.2, 0, 4.4, 0.6, 0.9); S.bot = bx('paging（下層）', MC.tlb, 0, 1.5, 0, 4.4, 0.6, 0.9);
    cap('兩個都存在時', 'segmentation 在上頭、paging 在下面');
  },
  async (tok, S) => {                                   // 715.0 segmentation：user 的角度（code、heap、stack）
    glow(S.top, HL); sm('user program 的 view：code、heap、stack', 4.6, 2.2);
    cap('segmentation 是以 user 的角度切割', 'code、heap、stack 各是一個 segment，好寫程式');
  },
  async (tok, S) => {                                   // 736.3 paging 方便硬體管理
    glow(S.top, null); glow(S.bot, HL); sm('找空位 O(1)、沒有 external fragmentation', 4.6, 1.5);
    cap('放到 physical memory 時，paging 好管理', 'O(1) 找空位、沒有 external fragmentation');
  },
  async (tok, S) => {                                   // 796.2 demand paging 在 paging 這個 level
    glow(S.bot, null); glow(S.l, OKG); good('demand paging 只在 paging level 做', -3.0, 6.5);
    cap('所以只會看到 demand paging', 'segmentation 主要跟 compiler 比較有關');
  },
]);

scene('vm-13a-map', 'Virtual memory 示意：page 可以待在 disk', CAM, [
  async (tok, S) => {                                   // 809.0 logical 是一堆 page，page table（memory map）
    hd('virtual memory', -4.8, 6.6); hd('page table', -1.4, 6.6); hd('physical memory', 2.4, 6.6);
    S.v = ['A', 'B', 'C', 'D'].map((n, i) => bx(n, pc(i + 1), -4.8, 5.8 - i * 0.65, 0, 1.2, 0.55, 0.7));
    S.t = ptable(-1.1, 5.8, [[0, 1, 'v'], [1, 0, 'v'], [2, 2, 'v'], [3, null, 'i']], { head: false, w: 0.8 });
    S.f = [['B', 2], ['A', 1], ['C', 3]].map(([n, c], i) => bx(n, pc(c), 2.4, 5.8 - i * 0.65, 0, 1.2, 0.55, 0.7));
    S.disk = prop('disk', 5.4, 1.6, 0, 1.0, 'disk'); bx('D', pc(4), 5.4, 3.0, 0, 0.9, 0.5, 0.6);
    cap('logical address 就是一堆 page', '經過 page table（memory map）對到 physical memory');
  },
  async (tok, S) => {                                   // 834.9 很久沒被 access 的 page swap 到 disk
    const c = S.f[2]; await slide(tok, c, 5.4, 3.6, 0, 800);
    S.t.set(2, null, 'i');
    cap('virtual memory 再加一層', '很久沒被 access 的 page，swap 到 disk 上');
  },
  async (tok, S) => {                                   // 849.3 要用時 OS 發現在 disk，搬回來照常 access
    S.cpu = prop('cpu', -4.8, 1.0, 0, 0.8, 'CPU');
    const c = S.f[2]; await slide(tok, c, 2.4, 4.5, 0, 800); S.t.set(2, 2, 'v');
    cap('CPU 要 access 時，OS 發現它在 disk', '搬回 physical memory，然後照常 access');
  },
  async (tok, S) => {                                   // 871.1 disk 當 memory 的一部分；但 CPU 只能讀 memory
    bad('CPU 不能直接 access disk：page 要先回到 memory', 1.0, 0.6);
    cap('disk 被當作 memory 的一部分', '但 memory 大小沒變，page 還是要先回 memory');
  },
  async (tok, S) => {                                   // 891.0 誰該被踢到 disk → replacement algorithm
    hot('誰該被踢到 disk？→ replacement algorithm', 0.8, 7.2);
    cap('到底誰該被踢到 disk', '就是 replacement algorithm；選錯就一直來回搬');
  },
  async (tok, S) => {                                   // 912.4 swapping 只是 copy 4KB bytes，不是 load program
    note('swap 只是 copy 4KB 的 bytes；不是 load program（建 page table、PCB）', 0, 0.0);
    cap('從 disk 搬到 memory 不是 load program', '只是把 4KB 的 bytes copy 過去而已');
  },
]);

scene('vm-13a-novm', '沒有 virtual memory 時，程式怎麼跑', CAM, [
  async (tok, S) => {                                   // 949.9 第八章：compile 完的 binary，是 virtual address
    hd('program（virtual address）', -4.6, 6.6);
    S.code = ['load', 'add', 'store', 'jump'].map((n, i) => bx(n, MC.lilac, -4.6, 5.8 - i * 0.62, 0, 1.8, 0.52, 0.7));
    cap('先看第八章的做法', 'compile 完的 binary：用的是 virtual address');
  },
  async (tok, S) => {                                   // 989.7 run：loader 建 PCB、page table
    S.pcb = bx('PCB', MC.sand, -1.4, 6.0, 0, 1.4, 0.6, 0.8);
    S.t = ptable(-1.2, 4.8, [[0, null, 'i'], [1, null, 'i'], [2, null, 'i'], [3, null, 'i']], { head: false, w: 0.8 });
    cap('run 一個 program：loader 要先 load', '建立 PCB，還有 page table');
  },
  async (tok, S) => {                                   // 1014.9 沒有 VM：一開始全部 load 到 physical memory
    hd('physical memory', 3.0, 6.6);
    S.ph = [];
    for (let i = 0; i < 4; i++) { const m = bx(S.code[i].userData.lbl.element.textContent, MC.blue, 3.0, 5.8 - i * 0.62, 0, 1.8, 0.52, 0.7); S.ph.push(m); S.t.set(i, [5, 2, 7, 3][i], 'v'); await wt(tok, 200); }
    cap('沒有 virtual memory、沒有 demand paging', '一開始就把所有東西 load 到 physical memory');
  },
  async (tok, S) => {                                   // 1028.6 memory 不夠：整個 process swap 到硬碟
    S.disk = prop('disk', 5.8, 0.4, 0, 0.9, 'disk');
    const g = pkt('整個 process', MC.blue, 3.0, 3.4, 0.8, 1.8); await slide(tok, g, 5.8, 1.8, 0.8, 800);
    cap('memory 不夠或很久沒跑', '就整個 process 為單位 swap 到硬碟');
  },
  async (tok, S) => {                                   // 1046.5 執行：透過 page table translation
    S.pc = hot('PC', -6.1, 5.8);
    for (let i = 0; i < 3; i++) { glow(S.code[i], HL); glow(S.ph[i], HL); await wt(tok, 300); glow(S.code[i], null); glow(S.ph[i], null); S.pc.position.y = 5.8 - (i + 1) * 0.62; }
    cap('開始執行：透過 page table', '找到 physical address，再去 access');
  },
  async (tok, S) => {                                   // 1073.8 run time dynamically allocate：改 page table
    S.t2 = ptable(-1.2, 2.3, [[4, 9, 'v']], { head: false, w: 0.8 }); bx('new', MC.green, 3.0, 3.3, 0, 1.8, 0.52, 0.7);
    cap('run time 也可能 dynamically allocate', '先改 page table、allocate，再把資料放過去');
  },
  async (tok, S) => {                                   // 1101.5 散落各處：要知道哪些 valid、哪些 invalid
    S.t3 = ptable(-1.2, 1.7, [[5, null, 'i']], { head: false, w: 0.8 });
    cap('使用起來是散落的，不一定依序', '所以要知道哪些 entry valid、哪些 invalid');
  },
  async (tok, S) => {                                   // 1118.5 結束時 free memory、table
    S.ph.forEach((m) => tint(m, MC.paper)); S.t.cells.forEach((r, i) => S.t.set(i, null, 'i'));
    cap('最後程式結束', '把 memory、page table 等等 free 掉');
  },
]);

// ════════ VAaunFe_lRs（第 13B 講：Demand Paging & Process Creation） ════════
scene('vm-13b-what', 'Demand paging：要了才搬', CAM, [
  async (tok, S) => {                                   // 14.8 demand：你要才做
    S.mem = zone('memory', -2.8, 0, 0, 5.0, 2.6); S.disk = prop('disk', 4.2, 0, 0, 1.1, 'disk');
    S.pg = ['A', 'B', 'C', 'D', 'E'].map((n, i) => bx(n, pc(i + 1), 2.6 + i * 0.75, 1.8, 0, 0.65, 0.5, 0.6));
    cap('demand paging 的 demand', '就是「你要了，我才去做」');
  },
  async (tok, S) => {                                   // 25.1 不是一次全部 load，要哪頁才搬
    await slide(tok, S.pg[1], -4.0, 0.5, 0, 700); hot('要 B → 只搬 B', -4.0, 1.4);
    cap('不是一次把 page 全部 load 進去', '你要這個 page，我才搬它');
  },
  async (tok, S) => {                                   // 38.4 ① I/O 少：一次 4KB
    S.b = bullets(-6.2, 6.2); S.b('① I/O 少、load time 短：一次只搬一個 page（4KB），不是 10MB', 'good');
    cap('好處一：I/O 比較少', '一次只搬一個 4KB 的 page，速度當然快');
  },
  async (tok, S) => {                                   // 53.0 ② memory 使用率提高，剩下給別人
    S.b('② memory 只放要用的 → 剩下的空間給別的程式', 'good');
    S.o = bx('別的 process', MC.teal, -1.6, 0.5, 0, 1.8, 0.5, 0.7);
    cap('好處二：memory 使用率提高', '剩下的空間可以給別的程式用');
  },
  async (tok, S) => {                                   // 70.7 degree of multiprogramming 增加
    S.b('→ degree of multiprogramming 增加', 'good');
    cap('別的程式也能 load 進 memory', '增加 degree of multiprogramming');
  },
  async (tok, S) => {                                   // 74.7 就算沒有 dynamic loading，也能以 page 為單位決定
    note('不靠 dynamic loading／linking：以 page 為單位，決定放 memory 或先留在 disk', 0, 3.0);
    cap('就算沒有 dynamic loading、linking', '光看 process 用 memory 的行為，以 page 為單位決定');
  },
]);

scene('vm-13b-invalid', '無效位址 vs 還沒搬進來', CAM, [
  async (tok, S) => {                                   // 94.9 access 時要判斷
    hd('process 的 address space', -3.0, 6.6);
    S.sp = [0, 1, 2, 3].map((i) => bx('page ' + i, MC.lilac, -3.0, 5.8 - i * 0.62, 0, 2.0, 0.52, 0.7));
    S.out = bx('（沒 allocate）', '#efe7da', -3.0, 5.8 - 4 * 0.62, 0, 2.0, 0.52, 0.7);
    cap('用 demand paging 要處理一件事', 'access 一個 memory 時，要判斷它是什麼情況');
  },
  async (tok, S) => {                                   // 108.3 invalid reference：超過 allocate 範圍
    glow(S.out, NG); bad('invalid reference：超出範圍，真的不該 access', 2.4, 3.3);
    cap('invalid reference', '真的沒有 allocate、超出使用範圍的 address');
  },
  async (tok, S) => {                                   // 130.1 另一種：有效但不在 memory
    glow(S.sp[2], HL); good('有效，只是還沒搬進 memory', 2.4, 4.6);
    cap('另一種情況要區分', 'address 有效，只是還沒搬進 memory');
  },
  async (tok, S) => {                                   // 151.0 fault，但是告訴 OS demand 來了
    hot('→ 發出 fault：告訴 OS「demand 來了」去做 paging', 2.2, 5.4);
    cap('這個 access 會造成錯誤（fault）', '但它是在告訴 OS：demand 來了，去做 paging');
  },
  async (tok, S) => {                                   // 164.1 pure demand paging：一開始 memory 什麼都沒有
    S.mem = zone('memory（空的）', 2.6, 0, 0, 4.4, 2.0);
    S.pt = bx('page table', MC.sand, 0.4, 1.3, 0, 1.6, 0.5, 0.7); S.pcb = bx('PCB', MC.sand, 0.4, 0.6, 0, 1.6, 0.5, 0.7);
    cap('pure demand paging', 'load process 時只建 page table、PCB，memory 什麼都沒有');
  },
  async (tok, S) => {                                   // 177.1 run 時才把 page 放到 memory
    const c = pkt('page 2', MC.lilac, -3.0, 4.56, 0.6, 1.2); await slide(tok, c, 2.0, 0.6, 0.6, 800);
    cap('真的開始 run', '用到哪個 page，才把它放到 memory');
  },
  async (tok, S) => {                                   // 192.2 pure 比較極端；實際可能先 load 一定會用的
    note('pure 是極端；實際系統可能先 load 前面一定會用的', 2.6, 2.6);
    cap('pure 是比較極端的做法', '實際系統可能先 load 前面一定會用到的內容');
  },
]);

scene('vm-13b-pager', 'Swapper（process 為單位）vs pager（page 為單位）', CAM, [
  async (tok, S) => {                                   // 209.5 跟 mid-term scheduler（swapper）的差別
    S.mem = zone('memory', -2.6, 0, 0, 5.0, 3.0); S.disk = prop('disk', 4.4, 0, 0, 1.1, 'disk');
    S.p1 = [0, 1, 2].map((i) => bx('P1', MC.blue, -4.2 + i * 1.0, 0.5, 0, 0.9, 0.5, 0.7));
    S.p2 = [0, 1, 2].map((i) => bx('P2', MC.green, -4.2 + i * 1.0, 1.4, 0, 0.9, 0.5, 0.7));
    cap('demand paging 跟 mid-term scheduler', '（俗稱 swapper）的差別，現在很明顯了');
  },
  async (tok, S) => {                                   // 225.7 swapper：以 process 為單位
    hd('swapper：整個 process', -2.6, 3.2);
    await anim(tok, 900, (u) => S.p1.forEach((m, i) => m.position.set(-4.2 + i * 1.0 + (3.4 + i * 0.4 - (-4.2 + i * 1.0)) * u, 0.5 + 1.6 * u, 0)));
    cap('swapper 以 process 為單位', '把整個 process swap 出去');
  },
  async (tok, S) => {                                   // 233.7 pager：以 page 為單位
    hd('pager：一次一個 page', -2.6, 3.9);
    await slide(tok, S.p2[2], 4.4, 1.6, 0.6, 700);
    cap('demand paging 是 pager 做的事', '以 page 為單位，不會一次放整個 process');
  },
  async (tok, S) => {                                   // 259.3 部分在 disk，process 仍可運作
    good('P2 部分在 disk，仍然繼續執行', -2.6, 2.4);
    cap('process 可以部分在 disk', '不需要把整個 process suspend，它還能運作');
  },
  async (tok, S) => {                                   // 270.2 兩個都有：不同 level
    note('OS 兩個都有：不同 level 的管理，不衝突', 0, 5.0);
    cap('OS 通常 swapper、pager 都有', 'swapper 整個移走時，pager 就沒事做了');
  },
]);

scene('vm-13b-vbit', 'Valid-invalid bit', CAM, [
  async (tok, S) => {                                   // 296.9 怎麼知道有效還無效
    hot('怎麼分辨？', 0, 6.7);
    cap('要做 paging 就要處理', '怎麼知道這個 address reference 有效還是無效');
  },
  async (tok, S) => {                                   // 312.9 page table 的 valid-invalid bit
    S.t = ptable(-0.6, 5.6, [[0, 4, 'v'], [1, null, 'i'], [2, 6, 'v'], [3, null, 'i'], [4, null, 'i']], { pcol: (p) => pc(p + 1) });
    cap('靠 page table 的 valid-invalid bit', '這個 bit 主要就是拿來做 virtual memory 的');
  },
  async (tok, S) => {                                   // 326.2 1（v）→ 在 memory
    [0, 2].forEach((i) => glow(S.t.cells[i][2], OKG)); good('v（1）：在 memory', 3.6, 5.6);
    cap('bit 設起來（v）', '代表這個 page 在 memory');
  },
  async (tok, S) => {                                   // 333.7 0（i）→ 有效但不在 memory
    [1, 3, 4].forEach((i) => glow(S.t.cells[i][2], NG)); bad('i（0）：有效，但目前不在 memory', 3.6, 4.4);
    cap('是 0（i）呢', '代表它有效，只是目前不在 memory');
  },
  async (tok, S) => {                                   // 339.3 看到 0 → page fault，OS 搬進來
    S.prop = prop('disk', 4.2, 1.0, 0, 0.8, 'disk');
    const a = pkt('page 1', pc(2), 4.2, 2.0, 0.7, 1.1); await slide(tok, a, 1.0, 5.0, 0.7, 700);
    S.t.set(1, 9, 'v'); glow(S.t.cells[1][2], OKG); gone(a);
    cap('access 時看到 0 → page fault', 'OS 接到 fault，把這個 page 搬進 memory');
  },
  async (tok, S) => {                                   // 362.0 pure demand paging：一開始全部 0
    [0, 2, 3, 4].forEach((i) => { S.t.set(i, null, 'i'); glow(S.t.cells[i][2], NG); });
    note('pure demand paging：一開始所有 bit 都是 i', -0.6, 1.8);
    cap('pure demand paging 一開始沒有 page 在 memory', '所以所有 bit 都設成 0（i）');
  },
  async (tok, S) => {                                   // 390.4 read/write 權限在 segmentation
    note('read／write 等 permission：在 segment level 做', -0.6, 1.2);
    cap('那 read、write 權限呢？', '通常在 segmentation 那層做；paging 只管在 disk 還是 memory');
  },
  async (tok, S) => {                                   // 410.2 swap 到 backing store（swap space）
    sm('swap space（backing store）≠ file system', 4.2, 0.2);
    cap('swap 去哪？backing store', '它跟 file system 不一樣，最後講 file system 再提');
  },
]);

scene('vm-13b-run', '例子：pure demand paging 一步步跑', CAM, [
  async (tok, S) => {                                   // 424.1 同樣的例子用 demand paging
    hd('program', -5.0, 6.6);
    S.code = ['inst 0', 'inst 1', 'inst 2', 'inst 3'].map((n, i) => bx(n, MC.lilac, -5.0, 5.8 - i * 0.62, 0, 1.6, 0.52, 0.7));
    sm('示意：一個 page 只放一個 instruction', -5.0, 3.0);
    cap('剛剛完全一樣的例子', '這次用 demand paging 的概念來跑');
  },
  async (tok, S) => {                                   // 433.8 load：建空的 page table（PCB 也建）
    S.t = ptable(-1.4, 5.8, [[0, null, 'i'], [1, null, 'i'], [2, null, 'i'], [3, null, 'i']], { w: 0.8 });
    bx('PCB', MC.sand, -1.6, 2.6, 0, 1.4, 0.5, 0.7); hd('physical memory', 3.6, 6.6);
    S.fr = [0, 1, 2, 3].map((i) => bx('', MC.paper, 3.6, 5.8 - i * 0.62, 0, 1.6, 0.52, 0.7));
    sm('frame 2', 4.8, 5.8); sm('frame 5', 4.8, 5.18); sm('frame 6', 4.8, 4.56); sm('frame 7', 4.8, 3.94);
    cap('load 時只 create page table', '裡面是空的；PCB 還是要建，但 memory 什麼都沒放');
  },
  async (tok, S) => {                                   // 446.9 執行第一個 instruction → 查 page table
    S.pc = hot('PC', -6.3, 5.8); glow(S.code[0], HL); glow(S.t.cells[0][2], HL);
    cap('開始執行第一個 instruction', 'memory access 一樣先去看 page table');
  },
  async (tok, S) => {                                   // 458.4 invalid → page fault
    S.f = bad('i → page fault！', -1.2, 6.9); glow(S.t.cells[0][2], NG);
    cap('發現 valid bit 是 invalid', '產生 page fault（不是 segmentation fault）');
  },
  async (tok, S) => {                                   // 472.2 call OS，OS 知道內容在 disk 哪裡
    S.os = buddy('OS', '', MC.orange, 0.6, 0.0, 0, 0.6); S.disk = prop('disk', 5.8, 0.4, 0, 0.9, 'disk');
    cap('fault 產生後會 call OS（interrupt）', 'OS 處理 paging：知道那行指令放在 disk 的哪裡');
  },
  async (tok, S) => {                                   // 486.6 load 到 memory
    const a = pkt('inst 0', MC.lilac, 5.8, 1.6, 0.7, 1.2); await slide(tok, a, 3.6, 5.8, 0.7, 800); gone(a);
    relabel(S.fr[0], 'inst 0'); tint(S.fr[0], MC.lilac);
    cap('把它 load 到 memory 裡', 'load 進去之後就知道它在哪個 frame');
  },
  async (tok, S) => {                                   // 491.6 update page table、valid bit 設起來
    S.t.set(0, 2, 'v'); glow(S.t.cells[0][2], OKG);
    cap('update page table', '填上 frame 的位置，把 valid bit 設起來');
  },
  async (tok, S) => {                                   // 503.5 PC 減 4，重新執行
    gone(S.f); S.re = hot('PC − 4：重做同一個 instruction', -2.4, 6.9);
    cap('program counter 本來會 +4', 'page fault 處理完後把它 −4，移回去重新 fetch');
  },
  async (tok, S) => {                                   // 528.3 這次有東西，正常執行
    gone(S.re); good('這次有了 → 正常執行', -1.6, 6.9); S.os.mood('happy');
    cap('重複執行一模一樣的指令', '這一次就發現有東西了，正常執行');
  },
  async (tok, S) => {                                   // 544.1 下一個不同 page → 再 fault、搬、update、重做
    for (let i = 1; i < 3; i++) {
      S.pc.position.y = 5.8 - i * 0.62; glow(S.code[i - 1], null); glow(S.code[i], HL);
      const a = pkt('inst ' + i, MC.lilac, 5.8, 1.6, 0.7, 1.2); await slide(tok, a, 3.6, 5.8 - i * 0.62, 0.7, 500); gone(a);
      relabel(S.fr[i], 'inst ' + i); tint(S.fr[i], MC.lilac); S.t.set(i, [5, 6][i - 1], 'v'); glow(S.t.cells[i][2], OKG);
    }
    cap('下一個指令一樣先檢查', '不同的 page 就 fault → 搬進來 → update → 再做一次');
  },
  async (tok, S) => {                                   // 579.9 怎麼知道 address 有效？segment length 先檢查
    note('有效與否：上一層 segment length 先檢查過了；這裡只看在不在 memory', 0, 1.6);
    cap('怎麼知道 address 有沒有效？', '上一層 segment 會先檢查 length；到 paging 只看在不在 memory');
  },
]);

scene('vm-13b-steps', 'Page fault 處理步驟', CAMW, [
  async (tok, S) => {                                   // 619.1 pure demand paging 的步驟
    S.cpu = prop('cpu', -5.6, 4.6, 0, 0.9, 'CPU'); S.t = ptable(-1.6, 5.6, [[0, 3, 'v'], [1, null, 'i'], [2, 7, 'v']], { w: 0.8, pcol: (p) => pc(p + 1) });
    S.os = buddy('OS', '', MC.orange, 1.1, 3.6, 0, 0.55); S.disk = prop('disk', 5.4, 0.4, 0, 1.0, 'disk');
    hd('physical memory', 3.0, 6.6); S.fr = [0, 1, 2, 3].map((i) => bx(['', '', '', 'free'][i], [MC.blue, MC.purple, MC.green, MC.paper][i], 3.0, 5.8 - i * 0.62, 0, 1.6, 0.52, 0.7));
    S.st = bullets(-6.6, 3.0, 0.5);
    cap('pure demand paging 的步驟', '把剛剛的流程列下來');
  },
  async (tok, S) => {                                   // 626.1 ① access → invalid → page fault trap
    const a = arrow(V3(-5.0, 5.0, 0.4), V3(-2.9, 4.9, 0.4)); glow(S.t.cells[1][2], NG);
    S.st('① access：bit 是 i → page fault（trap）', 'bad');
    cap('第一步：access，發現是 invalid', '丟出 page fault：software interrupt，所以叫 trap');
  },
  async (tok, S) => {                                   // 643.4 ② OS 先檢查 segment length／memory limit
    S.os.mood('wow'); S.st('② OS 檢查：超出 segment length／memory limit？→ 真的無效');
    cap('OS 接到後先再檢查一次', '跟 segment length、PCB 裡的 memory limit 比，判斷有效無效');
  },
  async (tok, S) => {                                   // 672.5 有效才看 valid bit；不在 memory 就 paging
    S.st('　有效 → 不在 memory，進入 paging');
    cap('有效的才去看 valid bit', 'valid 就直接 access；不在 memory 就繼續做 paging');
  },
  async (tok, S) => {                                   // 699.9 找 empty frame（free list O(1)）
    glow(S.fr[3], HL); S.st('③ 找 empty frame（free list，O(1)）');
    cap('第二步：找一個 empty frame', '用 free list，O(1) 時間就找到');
  },
  async (tok, S) => {                                   // 719.9 swap：從 disk copy 進 frame
    const a = pkt('page 1', pc(2), 5.4, 1.6, 0.7, 1.2); await slide(tok, a, 3.0, 3.94, 0.7, 800); gone(a);
    relabel(S.fr[3], 'page 1'); tint(S.fr[3], pc(2)); glow(S.fr[3], null);
    S.st('④ 從 disk 把 page copy 進來');
    cap('做 swapping', '就是把 memory content 從 disk copy 過來');
  },
  async (tok, S) => {                                   // 726.3 update page table、valid bit 設成 v
    S.t.set(1, 9, 'v'); glow(S.t.cells[1][2], OKG); S.st('⑤ update page table：frame 號碼、bit → v');
    sm('（示意：frame 9）', 0.6, 6.4);
    cap('update page table 的內容', '還要把 valid bit 設成 valid');
  },
  async (tok, S) => {                                   // 737.7 最後 restart：PC −4
    S.st('⑥ restart：PC − 4，重做那個 instruction', 'good'); S.os.mood('happy');
    cap('最後一步千萬別忘了：restart', 'program counter 減 4，重新執行之前的指令');
  },
  async (tok, S) => {                                   // 758.5 整理：先 access，bit 無效 → interrupt 被 pager catch
    hot('page fault 由 OS 的 pager 接住', 3.4, 2.9);
    cap('整理一下：不管三七二十一先 access', '看到 bit 無效就產生 interrupt，被 OS 的 pager 接住');
  },
  async (tok, S) => {                                   // 780.6 disk 位置在 load／搬出時就記下來
    sm('page 在 disk 的位置：load 或搬出時就記下了', 3.6, 2.3);
    cap('page 在 disk 的哪裡？', 'load 或搬到 disk 時就記下來了，所以找得到');
  },
]);

scene('vm-13b-noframe', '沒有 free frame：要先 replacement', CAM, [
  async (tok, S) => {                                   // 817.0 剛剛的 case 有 free frame
    hd('physical memory', 0, 6.6);
    S.fr = [1, 2, 3, 4].map((p, i) => bx('page ' + p, pc(p), 0, 5.8 - i * 0.62, 0, 1.8, 0.52, 0.7));
    S.new = pkt('page 6', pc(6), -4.6, 4.6, 0.6, 1.2); S.disk = prop('disk', 4.6, 2.6, 0, 1.0, 'disk');
    cap('剛剛的 case 有 free frame', '那很單純，找到就放進去');
  },
  async (tok, S) => {                                   // 825.6 沒有 free frame 怎麼辦？
    bad('沒有 free frame！', -4.6, 5.6);
    cap('萬一 frame 全都滿了怎麼辦？', '在「找 free frame」後面要多一步');
  },
  async (tok, S) => {                                   // 839.4 強迫某 page swap 到 disk
    glow(S.fr[2], NG); await slide(tok, S.fr[2], 4.6, 4.0, 0, 800);
    cap('強迫某一個 page 從 memory', 'swap 到 disk，清出一個位置');
  },
  async (tok, S) => {                                   // 852.0 選誰 → replacement algorithm
    hot('踢誰？→ replacement algorithm', 0, 2.6);
    await slide(tok, S.new, 0, 5.8 - 2 * 0.62, 0, 700);
    cap('要把誰踢出去', '那個演算法就是 replacement algorithm');
  },
  async (tok, S) => {                                   // 863.5 只有必要時（沒有 free frame）才 trigger
    note('先找 free frame；沒有才 call replacement', 0, 1.9);
    cap('只有必要時才會 trigger', '流程還是先找 free frame，沒有了才 call replacement');
  },
  async (tok, S) => {                                   // 882.3 效能取決於 replacement 的設計
    good('效能取決於 replacement algorithm 的設計', 0, 1.2);
    cap('這個流程的效能', '就取決於 replacement algorithm 的設計');
  },
]);

scene('vm-13b-eat', 'Demand paging 的 effective access time', CAM, [
  async (tok, S) => {                                   // 892.8 看 demand paging 對 memory access time 的影響
    hd('Effective Access Time（EAT）', 0, 7.0);
    cap('demand paging 對 access time 的影響', '算法跟 TLB 的 EAT 很像');
  },
  async (tok, S) => {                                   // 911.7 p = page fault rate
    S.p = bx('p = page fault rate（0 ≤ p ≤ 1）', MC.sand, 0, 6.2, 0, 6.0, 0.6, 0.8);
    cap('用一個 p 代表 page fault rate', '也就是百分之多少的 memory access 會 page fault');
  },
  async (tok, S) => {                                   // 936.0 (1 − p) × ma
    S.f1 = bx('EAT = (1 − p) × ma', MC.mint, -1.6, 5.3, 0, 4.4, 0.6, 0.8);
    cap('沒有 page fault 的機率是 1 − p', '就乘上 memory access time（ma）');
  },
  async (tok, S) => {                                   // 957.9 ma 不是定值：TLB、還要 transfer bytes
    sm('ma：含 TLB hit／miss、把 bytes 從 memory 傳到 register 的時間', -1.6, 4.7);
    cap('ma 細算其實不是定值', '看 TLB 有沒有 hit，還包含把 bytes 讀回 CPU 的時間');
  },
  async (tok, S) => {                                   // 1002.6 + p × page fault time
    S.f2 = bx('+ p × page fault time', '#f3c9c9', 3.0, 5.3, 0, 3.6, 0.6, 0.8);
    cap('有 page fault 就乘上 page fault time', '從 disk 搬到 memory，再回到 CPU 的時間');
  },
  async (tok, S) => {                                   // 1034.0 memory 很快；page fault 是 ms 級
    S.ma = bx('ma = 200 ns', MC.mint, -3.4, 4.0, 0, 2.6, 0.6, 0.8); S.pf = bx('page fault time = 8 ms', '#f3c9c9', 1.6, 4.0, 0, 3.6, 0.6, 0.8);
    S.bar1 = bx('', MC.green, -5.0, 3.35, 0, 0.1, 0.35, 0.5); S.bar2 = bx('', MC.red, -5.0, 2.9, 0, 0.1, 0.35, 0.5);
    await anim(tok, 900, (u) => { S.bar2.scale.x = 1 + 99 * u; S.bar2.position.x = -5.0 + 0.05 * 99 * u; });
    sm('（長度只是示意：實際差 4 萬倍）', 0.0, 2.45);
    cap('memory access 很快（200 ns）', 'page fault 要讀 disk，是 ms 等級（8 ms）');
  },
  async (tok, S) => {                                   // 1065.6 整理：EAT ∝ p × page fault time
    S.f3 = bx('EAT = 200 + p × 7,999,800（ns）', MC.sand, 0, 1.8, 0, 6.0, 0.6, 0.8);
    cap('把 p 抽出來整理', 'EAT 幾乎正比於 page fault time × page fault rate');
  },
  async (tok, S) => {                                   // 1097.8 例子：1000 次裡 1 次 fault
    S.p1 = hot('p = 1/1000 = 0.001', -4.6, 1.0);
    cap('代個數字看：1000 次 access', '只有 1 次 page fault，p = 0.001');
  },
  async (tok, S) => {                                   // 1112.2 EAT ≈ 8.2 µs，慢 40 倍
    S.r = bad('EAT = 199.8 + 8000 = 8199.8 ns ≈ 8.2 µs → 慢約 40 倍', 1.4, 1.0);
    cap('結果 EAT ≈ 8.2 µs', '原本只要 200 ns，慢了 40 倍（不是 40%）');
  },
  async (tok, S) => {                                   // 1136.3 只想慢 10% → p < 0.0000025
    gone(S.p1, S.r); good('只慢 10%：220 > 200 + 7,999,800p → p < 0.0000025（約 40 萬次才 1 次）', 0, 1.0);
    cap('如果只能容忍慢 10%', 'page fault rate 要極低：p < 0.0000025');
  },
  async (tok, S) => {                                   // 1174.3 為什麼不覺得慢：locality
    S.loc = note('為什麼電腦不覺得慢？locality', -3.4, 0.3);
    cap('為什麼有 virtual memory 卻不覺得慢？', '跟 TLB 一樣的道理：locality');
  },
  async (tok, S) => {                                   // 1189.7 一次搬 4KB，之後的 access 都 hit
    const pg = bx('4 KB page', MC.blue, 3.0, 0.3, 0.6, 1.6, 0.5, 0.6);
    for (let i = 0; i < 5; i++) { cube('', MC.green, [0.2, 0.2, 0.2], 2.2 + i * 0.4, 0.75, 0.6); await wt(tok, 120); }
    sm('fault 一次，後面的 access 都在同一頁', 3.0, -0.25);
    cap('一次 page fault 就搬進一整個 4KB page', '後面的 access（像 for loop）都能 reuse');
  },
  async (tok, S) => {                                   // 1247.7 breakdown：時間被 disk access dominate
    note('拆開看：trap、restore、reset page table 都很快；時間全被 disk access 主宰', 0, -0.8);
    cap('把步驟拆開來看', '主要時間都花在 disk access，其他都很快');
  },
]);

scene('vm-13b-proc', 'Process 與 virtual memory', CAM, [
  async (tok, S) => {                                   // 1305.0 有了 VM，對 process 的好處
    hd('virtual memory 對 process 的好處', 0, 6.6); S.b = bullets(-5.6, 5.8, 0.75);
    cap('有了 virtual memory 的概念', '對 process 管理、使用 memory content 有哪些好處');
  },
  async (tok, S) => {                                   // 1323.3 ① demand paging：load time 小、swapping 快
    S.b('① demand paging：load time 很小、swapping 快', 'good');
    cap('第一個：demand paging', 'load time 很小，每次 swapping 也很快');
  },
  async (tok, S) => {                                   // 1342.9 ② fork → copy-on-write
    S.b('② fork：copy-on-write（內容真的不同時才 create page）', 'good');
    S.pa = buddy('parent', '', MC.blue, -1.6, 0.4, 0, 0.6); S.ch = buddy('child', '', MC.green, 1.6, 0.4, 0, 0.6);
    cap('第二個：fork 要做 memory copy', '用 copy-on-write：內容不一樣時才 create 新 page');
  },
  async (tok, S) => {                                   // 1371.4 ③ memory-mapped file
    gone(S.pa, S.ch); S.b('③ memory-mapped file', 'good'); S.fs = bx('fread／fopen → file system（很多步驟）', MC.sand, 0, 2.2, 0, 5.4, 0.55, 0.7);
    cap('第三個：memory-mapped file', '平常用 fread、fopen 透過 file system，步驟多比較慢');
  },
  async (tok, S) => {                                   // 1398.3 file offset 跟 memory address 綁在一起
    S.mem = bx('memory address', MC.tlb, -2.4, 1.0, 0, 2.6, 0.55, 0.7); S.file = bx('file offset', MC.lilac, 2.4, 1.0, 0, 2.6, 0.55, 0.7);
    S.a = arrow(V3(-1.0, 1.0, 0.4), V3(1.0, 1.0, 0.4));
    cap('把 file 的 offset 跟 memory address 綁在一起', '就可以跳過 file system');
  },
  async (tok, S) => {                                   // 1426.1 倒過來：disk 上的 file 當 memory 來 access
    glow(S.fs, NG); good('disk 上的 file 當作 memory content 來 access → 比較快', 0, 0.1);
    cap('跟 virtual memory 倒過來', '把 disk 上的 file content 當 memory 來 access，效能較好');
  },
]);

// ════════ ngdrizxxvPY（第 14A 講：Demand Paging 複習、Copy-on-Write、Memory-Mapped File） ════════
scene('vm-14a-eat', '複習：EAT 被 page fault 主宰', CAM, [
  async (tok, S) => {                                   // 14.0 上次的算式：多一層 disk access
    hd('EAT = (1 − p) × ma + p × page fault time', 0, 6.6);
    S.cpu = prop('cpu', -5.0, 3.4, 0, 0.9, 'CPU'); S.ram = bx('memory', MC.blue, -1.6, 3.8, 0, 2.0, 1.0, 1.0); S.disk = prop('disk', 3.6, 3.2, 0, 1.1, 'disk');
    cap('上次的 EAT 算式', '跟 TLB 那個很像，只是多一層 disk access');
  },
  async (tok, S) => {                                   // 19.6 結果兩極：被 page fault dominate
    S.b1 = bx('', MC.green, -5.4, 1.8, 0, 0.1, 0.35, 0.5); S.b2 = bx('', MC.red, -5.4, 1.2, 0, 0.1, 0.35, 0.5);
    sm('memory access', -6.2, 2.25); sm('page fault', -6.2, 0.75);
    await anim(tok, 900, (u) => { S.b2.scale.x = 1 + 99 * u; S.b2.position.x = -5.4 + 0.05 * 99 * u; });
    cap('公式不必刻意背', '結果很兩極：整個時間被 page fault 主宰');
  },
  async (tok, S) => {                                   // 42.8 disk 比 memory 慢很多
    bad('disk 比 memory 慢非常多', 3.6, 5.0);
    cap('因為 disk 比 memory 慢太多', '用簡單的數學 model 就能評估 page fault rate 的影響');
  },
  async (tok, S) => {                                   // 64.8 使用者能容忍 10% → p 極低
    note('能容忍慢 10% → page fault rate 要極低，遠低於 TLB miss rate', -1.0, 0.5);
    cap('使用者大概能容忍慢 10%', '算出來 page fault rate 要非常非常低');
  },
  async (tok, S) => {                                   // 96.3 原因：locality
    good('做得到，因為 locality', -3.4, 5.6);
    cap('為什麼做得到？', '程式的 locality');
  },
  async (tok, S) => {                                   // 106.2 一次搬一整個 page：4KB、8KB、甚至 4MB
    const p = pkt('4 KB page', MC.blue, 3.6, 3.6, 0.8, 1.4); await slide(tok, p, -1.6, 3.8, 1.0, 800);
    sm('page size：4KB、8KB，Pentium 可選 4MB', -1.6, 5.1);
    cap('page fault 雖然慢，但一次搬一整個 page', '通常 4KB，現在有 8KB，Pentium 還能選 4MB');
  },
  async (tok, S) => {                                   // 136.5 每次 access 只幾個 byte → 同頁不再 fault
    for (let i = 0; i < 6; i++) { cube('', MC.green, [0.16, 0.16, 0.16], -2.4 + i * 0.32, 4.6, 0.8); await wt(tok, 100); }
    sm('每次只讀 1～4 byte：同一頁裡都不再 fault', -1.6, 2.9);
    cap('每次 memory access 只讀幾個 byte', '接下來在這個 page 裡的 access 都不會再 fault');
  },
  async (tok, S) => {                                   // 164.1 不是沒影響：程式跳來跳去、開太多程式
    bad('開太多程式 → memory 不夠 → fault 變多 → 越來越慢', -1.0, -0.1);
    cap('但不是沒有影響', '程式跳來跳去、開一堆程式，page fault 機率升高就變慢');
  },
  async (tok, S) => {                                   // 192.9 SSD：swap space 放 SSD
    S.ssd = bx('SSD（swap space）', MC.teal, 5.2, 2.0, 0, 2.4, 0.6, 0.9);
    good('page fault 讀得快 → 電腦變快', 5.2, 1.3);
    cap('為什麼大家要裝 SSD？', 'swap space 切在 SSD 上，處理 page fault 快很多');
  },
]);

scene('vm-14a-topics', '今天的主題', CAM, [
  async (tok, S) => {                                   // 230.1 跟 memory 息息相關的幾個機制
    S.b = bullets(-4.6, 5.6, 1.0); S.b('demand paging：每次只搬一個 4KB page（講過了）');
    cap('跟 memory 息息相關的機制', 'demand paging 之前講過了');
  },
  async (tok, S) => {                                   // 248.6 copy-on-write：fork 變快
    S.b('copy-on-write：讓 fork 變快', 'ptr');
    cap('今天第一個：copy-on-write', 'fork 時用 copy-on-write，讓 fork 變快');
  },
  async (tok, S) => {                                   // 258.7 memory-mapped file：跳過 file system
    S.b('memory-mapped file：跳過 file system，比較快', 'ptr');
    cap('第二個：memory-mapped file', 'file system 步驟很多；mmap 可以完全跳過它');
  },
]);

scene('vm-14a-cow', 'Copy-on-write 的想法', CAM, [
  async (tok, S) => {                                   // 297.7 fork：child 是 parent 的 copy，很浪費
    S.pa = buddy('parent', '', MC.blue, -4.4, 0, 0, 0.7); S.ch = buddy('child', '', MC.green, 4.4, 0, 0, 0.7);
    S.pp = ['A', 'B', 'C'].map((n, i) => bx(n, pc(i + 1), -4.4, 2.4 + i * 0.62, 0, 1.2, 0.52, 0.7));
    S.cp = ['A', 'B', 'C'].map((n, i) => bx(n, pc(i + 1), 4.4, 2.4 + i * 0.62, 0, 1.2, 0.52, 0.7));
    bad('全部 copy 一份：很浪費時間', 0, 5.0);
    cap('fork 的 default：child 是 parent 的 copy', '內容一模一樣，真的去 copy 很浪費時間');
  },
  async (tok, S) => {                                   // 327.7 MMU 是 mapping → 內容一樣就 share
    S.cp.forEach(kill); S.ar = [0, 1, 2].map((i) => arrow(V3(3.6, 2.4 + i * 0.62, 0.4), V3(-3.6, 2.4 + i * 0.62, 0.4)));
    good('page table 指到同一份 physical page：sharing', 0, 5.6);
    cap('MMU 本來就是在做 mapping', '內容完全一樣，用 sharing 讓兩邊看到同一份');
  },
  async (tok, S) => {                                   // 348.4 兩個不同程式，一方改了就要拆開
    note('但它們是兩個不同的程式：有人改了就要拆開', 0, 4.4);
    cap('但兩個畢竟是不同的程式', '其中一個改了 memory content，就要完全拆開');
  },
  async (tok, S) => {                                   // 360.7 什麼時候改？write → 才 copy
    glow(S.pp[2], HL); hot('write！→ 這時才 copy：copy-on-write', 0, 3.8);
    const c = bx('C′', pc(3), -4.4, 2.4 + 2 * 0.62, 0, 1.2, 0.52, 0.7); await slide(tok, c, 4.4, 3.64, 0, 700); kill(S.ar[2]);
    cap('什麼時候會改？write 的時候', 'read 沒問題；write 時 OS 才 copy：copy-on-write');
  },
  async (tok, S) => {                                   // 383.6 create process 變快；trade-off：跑時才 copy
    good('fork 很快', -2.4, 6.4); bad('trade-off：執行時才 copy，稍慢', 2.4, 6.4);
    cap('建立新 process 的時間大幅縮短', '代價是執行中才 copy，會稍微慢一點');
  },
  async (tok, S) => {                                   // 416.5 free frame 給新 page 前會 zero-out
    sm('給新 page 的 free frame 會先 zero-out（清成 0），避免看到前一個 process 的資料', 0, 1.3);
    cap('補充：拿 free frame 給新 page 時', '通常先 zero-out 清光，避免 security 問題');
  },
]);

scene('vm-14a-cowex', 'COW 例子：parent 改了 page C', CAM, [
  async (tok, S) => {                                   // 457.5 fork 後 parent、child 內容一樣
    S.pa = buddy('parent', '', MC.blue, -4.8, 3.6, 0, 0.6); S.ch = buddy('child', '', MC.green, 4.8, 3.6, 0, 0.6);
    hd('physical memory', 0, 6.6);
    S.pg = ['page A', 'page B', 'page C'].map((n, i) => bx(n, pc(i + 1), 0, 5.6 - i * 0.75, 0, 1.8, 0.6, 0.8));
    sm('PCB 不同（OS 自己維護）', 4.8, 2.6);
    cap('fork 時 parent 和 child 內容完全一樣', '唯一不同的是 PCB，那是 OS 維護的');
  },
  async (tok, S) => {                                   // 486.0 不必 copy：page table 設成一樣，share
    S.ap = S.pg.map((m, i) => arrow(V3(-4.0, 4.2, 0.4), V3(-1.0, 5.6 - i * 0.75, 0.4)));
    S.ac = S.pg.map((m, i) => arrow(V3(4.0, 4.2, 0.4), V3(1.0, 5.6 - i * 0.75, 0.4)));
    cap('所以不需要 copy', 'page table 設成一樣，physical memory 用 sharing');
  },
  async (tok, S) => {                                   // 500.4 fork 回傳值不同 → 做不同的事
    S.code = code(['pid = fork();', 'if (pid > 0) {   // parent', '  int Test1;  ← 新 variable', '}'], 0, 2.4);
    cap('靠 fork 回傳的 ID', '讓 parent 和 child 做不一樣的事');
  },
  async (tok, S) => {                                   // 514.3 parent 新建 variable Test1（stack 裡）→ write page C
    S.code.hl(2); glow(S.pg[2], HL); S.pa.mood('wow');
    cap('parent 在 function 裡新建 variable Test1', '它在 stack 裡：這是 write，page C 要改');
  },
  async (tok, S) => {                                   // 538.7 copy-on-write：複製一份 page C
    const c = bx('copy of C', pc(3), 0, 5.6 - 1.5, 0, 1.8, 0.6, 0.8);
    await slide(tok, c, -2.6, 3.5, 0, 800); relabel(c, 'C + Test1'); kill(S.ap[2]);
    S.ap.push(arrow(V3(-4.0, 3.9, 0.4), V3(-2.6, 3.7, 0.4))); glow(S.pg[2], null);
    cap('page C 不一樣了 → copy-on-write', 'parent 把 C copy 出一份新的');
  },
  async (tok, S) => {                                   // 564.4 誰用新的無所謂；parent 有 Test1，child 沒有
    good('parent 看到 Test1', -4.8, 2.9); sm('child 沒有 Test1（不存在）', 4.8, 2.0);
    S.pa.mood('happy'); S.ch.mood('happy');
    cap('誰用新的、誰用舊的無所謂', '重點是有兩份：parent 有 Test1，child 沒有');
  },
]);

scene('vm-14a-mmap', 'Memory-mapped file 的概念', CAM, [
  async (tok, S) => {                                   // 602.1 memory-mapped file
    hd('memory-mapped file', 0, 6.7); S.file = prop('file', 4.6, 3.0, 0, 1.4, 'file（disk）');
    cap('下一個比較特別的：memory-mapped file', '先看它的概念');
  },
  async (tok, S) => {                                   // 613.6 用 memory access 的方式 read／write file
    S.prg = buddy('program', '', MC.blue, -4.8, 2.6, 0, 0.7);
    cap('讓 user program 用 memory access 的方式', '去 read 或 write 一個 file');
  },
  async (tok, S) => {                                   // 629.5 就是 array：file 是 byte stream
    S.arr = [0, 1, 2, 3, 4, 5].map((i) => bx('A[' + i + ']', MC.tlb, -2.2 + i * 0.9, 5.0, 0, 0.8, 0.55, 0.7));
    S.byt = [0, 1, 2, 3, 4, 5].map((i) => bx('byte ' + i, MC.lilac, -2.2 + i * 0.9, 1.4, 0, 0.8, 0.55, 0.7));
    S.ar = [0, 1, 2, 3, 4, 5].map((i) => arrow(V3(-2.2 + i * 0.9, 4.65, 0.4), V3(-2.2 + i * 0.9, 1.8, 0.4)));
    cap('什麼叫 memory access 的方式？就是 array', 'file 是 byte stream，map 到一個 byte array');
  },
  async (tok, S) => {                                   // 651.6 一個指令 map 上去，之後用 pointer 操作
    S.no = bad('不用 fread／fwrite', -4.8, 5.0);
    cap('一個指令就把整個 file map 到 memory', '之後用 array、pointer 的概念操作');
  },
  async (tok, S) => {                                   // 670.9 跟 virtual memory 一樣的概念
    note('同 virtual memory：memory address 對到 disk 上的一個位置', 0, 0.4);
    cap('其實跟 virtual memory 是一樣的概念', 'memory address 直接對到 disk 上的 content');
  },
  async (tok, S) => {                                   // 708.4 改 A[1] → OS 寫回 file 的那個 byte
    relabel(S.arr[1], "A[1]='x'"); glow(S.arr[1], HL); await wt(tok, 400); glow(S.byt[1], HL); relabel(S.byt[1], "'x'");
    cap('你只是改了 A[1] 這個 memory', 'OS 知道它對到 file 的哪個 byte，寫回去');
  },
]);

scene('vm-14a-mmappc', 'Memory-mapped file 的優缺點', CAM, [
  async (tok, S) => {                                   // 747.6 最大好處：bypass file system
    S.u = buddy('program', '', MC.blue, -5.0, 3.4, 0, 0.7);
    S.fs = bx('file system', MC.sand, 0, 4.4, 0, 2.6, 1.4, 1.0); S.d = prop('file', 5.0, 3.4, 0, 1.2, 'file');
    S.byp = arrow(V3(-4.2, 3.0, 0.8), V3(4.2, 3.0, 0.8));
    good('① bypass file system', 0, 2.4);
    cap('最大好處：bypass 整個 file system', '因為是 memory access');
  },
  async (tok, S) => {                                   // 757.6 FS 要檢查 permission、是否 open…
    sm('檢查 permission、有沒有 open、…', 0, 5.4); glow(S.fs, NG);
    cap('file system 畢竟是一個 system', '隨便一個 fread 都要檢查 permission 等等，call path 很長');
  },
  async (tok, S) => {                                   // 795.5 ② sharing 容易
    S.u2 = buddy('P2', '', MC.green, -3.6, 3.4, 0, 0.55); good('② sharing 容易：page table 指到同一塊', 0, 1.8);
    cap('另一個好處：sharing', '把 file content 放進 memory，用 paging 就能 share');
  },
  async (tok, S) => {                                   // 815.6 FS 會 lock；mmap 自己用 locking 細緻控制
    sm('file system：有人以 write 開啟，別人就不能寫（lock）；mmap：自己寫 locking', 0, 6.0);
    cap('file system 很嚴謹：檔案被 write 開就 lock', 'mmap 讓 programmer 自己用 locking 細緻控制');
  },
  async (tok, S) => {                                   // 885.8 壞處①：沒有 access control
    S.bad = bullets(-6.6, 1.1, 0.5); S.bad('✗ ① 容易弄壞：沒有 access control（read／write／execute）', 'bad');
    cap('壞處很多：第一，容易用也容易弄壞', 'memory 只有 share 或不 share，沒有 access control');
  },
  async (tok, S) => {                                   // 954.0 ②data loss
    S.bad('✗ ② data loss：在 memory 裡，斷電就沒了', 'bad');
    cap('第二：data loss', '資料在 memory，一 crash 就全沒了；file system 會幫你 recover');
  },
  async (tok, S) => {                                   // 1030.2 ③programming 難
    S.bad('✗ ③ programming 難：自己決定幾個 byte、什麼型別', 'bad');
    cap('第三：programming', 'file 有一堆 API；這裡只是 array，型別、位移都要自己負責');
  },
  async (tok, S) => {                                   // 1078.4 適合：單純、要快、temporary、少數使用者
    hot('適合：資料單純、要很快、temporary、少數使用者', 0, 6.6);
    cap('使用很單純、要很快、暫時的 file', '只有一個或少數使用者時，才用 memory-mapped file');
  },
  async (tok, S) => {                                   // 1106.2 系統層常用：swap、VM 是同樣機制
    note('系統層常用：swap／virtual memory 本身就是同樣的機制', 0, 7.2);
    cap('比較多是系統層的軟體在用', '像 swap、virtual memory，本身就是同樣的機制');
  },
]);

scene('vm-14a-code', 'File system 讀寫 vs memory-mapped file', CAMW, [
  async (tok, S) => {                                   // 1152.3 disk file 是 serialize 的 bytes；一個 page 對 4KB
    hd('disk file', 4.6, 6.8); S.df = [0, 1, 2].map((i) => bx('4 KB', MC.lilac, 4.6, 6.0 - i * 0.65, 0, 1.4, 0.55, 0.7));
    hd('memory', 0.6, 6.8); S.mp = [0, 1, 2].map((i) => bx('page', MC.tlb, 0.6, 6.0 - i * 0.65, 0, 1.4, 0.55, 0.7));
    S.l = [0, 1, 2].map((i) => arrow(V3(3.8, 6.0 - i * 0.65, 0.4), V3(1.4, 6.0 - i * 0.65, 0.4)));
    cap('disk 上的 file 也是一排 byte', '一個 page 就對到 4KB 的 content');
  },
  async (tok, S) => {                                   // 1185.0 多個 process 可同時 map
    S.pr = ['P1', 'P2'].map((n, i) => bx(n, [MC.blue, MC.green][i], -2.6, 6.0 - i * 0.9, 0, 1.0, 0.55, 0.7));
    arrow(V3(-2.0, 6.0, 0.4), V3(-0.2, 5.6, 0.4)); arrow(V3(-2.0, 5.1, 0.4), V3(-0.2, 5.4, 0.4));
    cap('很多 process 可以同時 map 到這個 file', '只要把 page table 設一下');
  },
  async (tok, S) => {                                   // 1202.4 熟悉的：open、seek、read
    S.c1 = code(['fd = open(file);', 'lseek(fd, off);', 'read(fd, buf, 4);', 'buf[0]++;', 'write(fd, buf, 4);', 'close(fd);'], -4.6, 3.8, 0.5);
    S.c1.hl(0);
    cap('上面這個是大家熟悉的', 'open file，seek 到某個位置，再 read');
  },
  async (tok, S) => {                                   // 1239.2 FS 做 buffering／caching：一次抓 256 bytes
    S.c1.hl(2); S.buf = bx('FS buffer：256 bytes', MC.sand, 2.6, 2.4, 0, 2.6, 0.55, 0.7);
    const a = pkt('256 B', MC.lilac, 4.6, 4.7, 0.7, 0.9); await slide(tok, a, 2.6, 2.4, 0.9, 700); gone(a);
    cap('file system 很重要的工作：buffering／caching', 'disk 太慢，所以 prefetch 一次抓一整塊（例：256 bytes）');
  },
  async (tok, S) => {                                   // 1293.7 user 只要 4 bytes：再 copy 到 user space
    S.ub = bx('user buf：4 bytes', MC.tlb, 2.6, 1.3, 0, 2.6, 0.55, 0.7);
    const b = pkt('4 B', MC.lilac, 2.6, 2.4, 0.7, 0.6); await slide(tok, b, 2.6, 1.3, 0.9, 600); gone(b);
    bad('memory copy 兩次', 5.4, 1.8);
    cap('使用者只要一個 int（4 bytes）', '再從 buffer copy 到 user space：等於 copy 兩次');
  },
  async (tok, S) => {                                   // 1325.8 write 寫到 buffer，close 時才 flush
    S.c1.hl(4); await wt(tok, 300); S.c1.hl(5); sm('close 時才 flush 到硬碟（fflush 可強迫）', 2.6, 0.5);
    cap('write 也一樣：先寫到 buffer', '等 close 時才 flush 到硬碟；fflush 會強迫寫');
  },
  async (tok, S) => {                                   // 1377.0 mmap：open 後跟 OS 說 map 哪一段，回傳 pointer
    S.c1.kill(); gone(S.buf, S.ub);
    S.c2 = code(['fd = open(file);', 'p = mmap(..., fd, off);', 'p[1000]++;', 'munmap(p, len);', 'close(fd);'], -4.6, 3.8, 0.5);
    S.c2.hl(1); S.ptr = hot('p', -0.6, 5.6);
    cap('memory-mapped file：open 一樣', '跟 OS 說要把 file 哪一段 map 到 memory，回傳一個 pointer');
  },
  async (tok, S) => {                                   // 1448.4 用 pointer 直接寫 → 等於 fwrite
    S.c2.hl(2); glow(S.mp[1], HL); relabel(S.mp[1], 'page ✎');
    cap('不用 read、write 這些 file system call', '用 pointer 直接 ++，那就是一個 write');
  },
  async (tok, S) => {                                   // 1484.3 只改 memory，還沒 sync → 斷電就沒
    bad('還沒 sync 到 disk：斷電就沒了（data loss）', 2.6, 2.0);
    cap('寫下去只是改自己的 memory content', '兩邊還沒 sync，這時斷電資料就沒了');
  },
  async (tok, S) => {                                   // 1511.8 munmap 時整段寫回 file
    S.c2.hl(3); const a = pkt('整段寫回', MC.tlb, 0.6, 5.35, 0.8, 1.4); await slide(tok, a, 4.6, 5.35, 0.8, 800); gone(a);
    glow(S.mp[1], null); glow(S.df[1], HL);
    cap('只有 call munmap 時才寫下來', '不知道你改了哪裡，就整段 dump 回 file');
  },
  async (tok, S) => {                                   // 1562.5 例子：顯示卡、螢幕 pixel
    S.mon = prop('monitor', 4.6, 0.2, 0, 0.9, '顯示卡／螢幕');
    cap('最好的例子：顯示卡', '螢幕 pixel 就是 memory content，map 進來一次寫完再 flush');
  },
]);

// ════════ P1MlFqr5VMw（第 14B 講：Page Replacement、FIFO、Belady's anomaly） ════════
const BEL = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
scene('vm-14b-why', 'Page replacement 為什麼重要', CAM, [
  async (tok, S) => {                                   // 15.1 page fault 要 free frame，找不到 → replacement
    hd('physical memory（滿了）', 0, 6.6);
    S.fr = [1, 2, 3, 4].map((p, i) => bx('page ' + p, pc(p), 0, 5.8 - i * 0.62, 0, 1.8, 0.52, 0.7));
    S.n = pkt('page 5', pc(5), -4.6, 4.6, 0.6, 1.2); bad('沒有 free frame', -4.6, 5.5);
    cap('page fault 要找 free frame 放進去', '可能找不到：全被佔了，就要多做 replacement');
  },
  async (tok, S) => {                                   // 20.4 replace 誰？
    hot('replace 誰？', 2.6, 4.9);
    cap('要 replace 誰？', '這就是 replacement algorithm 的目的');
  },
  async (tok, S) => {                                   // 44.1 好壞決定 page fault 次數
    glow(S.fr[1], NG); await slide(tok, S.fr[1], 4.6, 2.0, 0, 700); await wt(tok, 200); await slide(tok, S.fr[1], 0, 5.18, 0, 700);
    bad('剛踢掉的馬上又要用 → 又一次 disk access', 0, 2.6); glow(S.fr[1], null);
    cap('演算法好壞決定 page fault 次數', '把等一下要用的踢掉，它又要搬回來：又一次 disk access');
  },
  async (tok, S) => {                                   // 80.6 沒 free frame 的解法①：swap 整個 process
    S.b = bullets(-6.4, 1.6, 0.55); S.b('解法一：swapper 把整個 process swap 出去 → 那程式完全不能動', 'bad');
    cap('沒有 free frame 時，極端的做法', '挑一個 process 整個 swap 到 disk：它就完全不能動了');
  },
  async (tok, S) => {                                   // 120.4 OS 喜歡 fine-grained：pager 挑 page
    S.b('解法二（常用）：pager 只挑一個 page swap 出去', 'good');
    cap('OS 比較喜歡 fine-grained', '在 page level：pager 只挑一個 page 換出去');
  },
  async (tok, S) => {                                   // 139.6 一個程式很多 page 沒在用，容易找
    sm('程式很多 page 都沒在用，很容易找到', 2.6, 4.2);
    cap('一個程式有很多 page 都沒在用', '所以挑一個 page 比較容易');
  },
]);

scene('vm-14b-dirty', 'Dirty（modify）bit：沒改過就不必寫回', CAM, [
  async (tok, S) => {                                   // 149.4 page 踢回 disk
    hd('memory', -2.8, 6.6); hd('dirty', -1.2, 6.6); S.disk = prop('disk', 4.2, 2.2, 0, 1.2, 'disk');
    S.fr = [['lib（只讀）', 1], ['data', 2], ['code', 3]].map(([n, c], i) => bx(n, pc(c), -2.8, 5.8 - i * 0.7, 0, 2.2, 0.56, 0.7));
    cap('page 被 swap 到 disk', '有點像 memory-mapped file 的情況');
  },
  async (tok, S) => {                                   // 163.8 disk 上本來就有一份 copy
    S.copy = [0, 1, 2].map((i) => bx('copy', MC.paper, 4.2 - 0.9 + i * 0.9, 3.6, 0, 0.8, 0.45, 0.6));
    cap('memory content 一開始其實在 disk', 'load 進 memory 而已：disk 上本來就有一份 copy');
  },
  async (tok, S) => {                                   // 189.8 很多沒改過（library 只讀）→ 再 copy 浪費
    glow(S.fr[0], OKG); sm('只有 read，從沒改過', -5.2, 5.8);
    cap('很多 page 根本沒改過，像 library 只讀', '踢回去時再 copy 一次就很浪費');
  },
  async (tok, S) => {                                   // 208.1 page table 多一個 bit：dirty bit
    S.bits = [0, 0, 0].map((b, i) => bx('0', MC.mint, -1.2, 5.8 - i * 0.7, 0, 0.5, 0.5, 0.6));
    cap('page table 每個 page 多一個很重要的 bit', '叫 dirty bit（modify bit）');
  },
  async (tok, S) => {                                   // 223.6 load 進來 = 0；修改過才設成 1
    glow(S.fr[1], HL); relabel(S.bits[1], '1'); tint(S.bits[1], '#f3c9c9'); sm('寫過 → 1', 0.2, 5.1);
    cap('load 進來時都是 0，跟硬碟上一樣', '只要一修改，OS 就把它設成 1');
  },
  async (tok, S) => {                                   // 245.1 踢出時檢查：0 → 直接覆蓋，不寫回
    glow(S.fr[0], NG); good('dirty = 0 → 不用寫回，直接讓別人覆蓋', -1.0, 2.6);
    cap('要 swap 出去時，OS 檢查這個 bit', '沒被設起來 = 從沒改過：不用理它，直接覆蓋');
  },
  async (tok, S) => {                                   // 264.8 1 → 整頁寫回 disk
    const w = pkt('整頁 4KB', pc(2), -2.8, 5.1, 0.7, 1.2); await slide(tok, w, 4.2, 3.6, 0.8, 800);
    bad('dirty = 1 → 整個 page 寫回 disk', -1.0, 2.0);
    cap('bit 被設起來 = 某個 byte 改過', '不知道是哪一個，只好整頁寫回硬碟');
  },
  async (tok, S) => {                                   // 284.3 本來一次 fault 要讀＋寫 → 時間減半
    note('一次 page fault：寫出 victim ＋ 讀進新 page；dirty = 0 時省掉「寫」→ 時間約減半', 0, 1.2);
    cap('本來一次 page fault 要讀出來還要寫回去', '有 dirty bit，沒改過就不用寫，時間減半');
  },
]);

scene('vm-14b-two', '兩個問題：frame allocation 與 page replacement', CAM, [
  async (tok, S) => {                                   // 315.9 要探討兩個問題
    S.ps = ['P1', 'P2', 'P3'].map((n, i) => buddy(n, '', [MC.blue, MC.green, MC.purple][i], -4.4 + i * 2.2, 3.6, 0, 0.6));
    cap('做 replacement 之前', '其實要探討兩個問題');
  },
  async (tok, S) => {                                   // 322.3 ① 每個 process 給多少 frame
    S.fa = [3, 2, 4].map((n, i) => { const r = []; for (let k = 0; k < n; k++) r.push(bx('', [MC.blue, MC.green, MC.purple][i], -4.8 + i * 2.2 + (k % 2) * 0.6, 2.7 - Math.floor(k / 2) * 0.5, 0, 0.5, 0.4, 0.5)); return r; });
    hd('① frame-allocation algorithm：每個 process 給幾個 frame？', 0, 6.4);
    cap('第一：每個 process 給多少個 frame？', '叫 frame-allocation algorithm');
  },
  async (tok, S) => {                                   // 348.5 要 100 個，可能只給 10 個
    sm('程式可能要 100 個 frame，只給它 10 個（示意）', 0, 5.7);
    cap('一個 process 可能要 100 個 frame', '機制可能只給它 10 個，反正不必整支 load');
  },
  async (tok, S) => {                                   // 359.8 ② 那 10 個裡面 replace 誰
    glow(S.fa[0][1], NG); hd('② page-replacement algorithm：在自己的 frame 裡換掉誰？', 0, 0.6);
    cap('第二：在那幾個 frame 裡面', '要用新的就得 replace：page replacement');
  },
  async (tok, S) => {                                   // 372.8 先講 replacement，只看單一程式
    glow(S.fa[0][1], null); S.ps[1].g.visible = false; S.ps[2].g.visible = false; S.fa[1].concat(S.fa[2]).forEach((m) => (m.visible = false));
    good('先講 replacement：只 focus 一支程式', -1.4, 3.6);
    cap('先講 replacement，再講 frame allocation', '先 focus 單一程式：哪個 page 要被踢出去');
  },
]);

scene('vm-14b-steps', 'Page replacement 的步驟', CAM, [
  async (tok, S) => {                                   // 400.2 ① 找要的 page 在 disk 哪裡
    S.disk = prop('disk', 4.8, 0.6, 0, 1.1, 'disk'); S.want = bx('page 6', pc(6), 4.8, 2.4, 0, 1.2, 0.5, 0.7);
    hd('memory', -1.0, 6.6); S.fr = [1, 2, 3, 4].map((p, i) => bx('page ' + p, pc(p), -1.0, 5.8 - i * 0.62, 0, 1.8, 0.52, 0.7));
    S.b = bullets(-6.6, 2.2, 0.55); S.b('① 找到要的 page 在 disk 的位置');
    cap('第一步：找到造成 page fault 的那個 page', '在 disk 的什麼位置');
  },
  async (tok, S) => {                                   // 410.8 ② 先找 free frame，有就先用
    S.b('② 有 free frame 就先用');
    cap('想把它 swap 進來', '先去看 free frame 有沒有空的，有就先用');
  },
  async (tok, S) => {                                   // 418.9 沒有 → replacement algorithm 選 victim、swap 出去
    glow(S.fr[2], NG); S.v = bad('victim', 1.0, 4.56); await slide(tok, S.fr[2], 4.8, 3.6, 0, 700);
    S.b('　沒有 → replacement algorithm 選 victim，swap 出去', 'bad');
    cap('沒有的話就 call replacement algorithm', '選一個 frame 當 victim（受害者），swap 出去');
  },
  async (tok, S) => {                                   // 432.9 ③ 讀進來、update page table
    gone(S.v); await slide(tok, S.want, -1.0, 4.56, 0, 700); S.b('③ 讀進新 page、update page table');
    cap('把新 page 放進去之後', '要 update page table');
  },
  async (tok, S) => {                                   // 437.5 ④ restart instruction
    S.b('④ restart 那個 instruction', 'good');
    cap('最後重新執行那個 instruction', '跟之前一樣，只是多了 replace 這一步');
  },
]);

scene('vm-14b-refstr', 'Reference string：演算法的 input', CAM, [
  async (tok, S) => {                                   // 472.4 formulate 成數學問題
    hd('page replacement algorithm', 0, 6.6);
    cap('replacement algorithm', '怎麼被 formulate 成一個數學問題');
  },
  async (tok, S) => {                                   // 484.7 goal：減少 page fault
    good('目標：page fault 次數（rate）越少越好', 0, 5.8);
    cap('目標很明確', '減少 page fault rate，也就是減少 page fault 次數');
  },
  async (tok, S) => {                                   // 490.8 input：reference string
    S.addr = ['0x1004', '0x2010', '0x3A0C', '0x4FF0'].map((a, i) => bx(a, MC.paper, -4.5 + i * 3.0, 4.4, 0, 1.8, 0.5, 0.7));
    cap('input 是 reference string', '程式執行時一連串 access 的 page id');
  },
  async (tok, S) => {                                   // 516.1 不 care byte address，只 care 第幾個 page
    S.addr.forEach((m, i) => { relabel(m, 'page ' + (i + 1)); tint(m, pc(i + 1)); });
    cap('不 care 是哪個 byte address', '同一個 page 裡位置不同沒差，只看第幾個 page');
  },
  async (tok, S) => {                                   // 528.0 例：1 2 3 4 1 2 5 …
    S.rs = BEL.map((p, i) => cube(String(p), pc(p), [0.6, 0.6, 0.6], -5.5 + i * 1.0, 2.4, 0, 1.0));
    cap('例如 1 2 3 4 1 2 5 …', '讀第 1 個 page、第 2 個、3、4、再第 1 個……');
  },
  async (tok, S) => {                                   // 545.7 基本演算法：FIFO … 最重要 LRU
    S.b = bullets(-4.6, 1.3, 0.55); S.b('基本演算法：FIFO、Optimal、LRU …'); S.b('最重要：LRU（一般系統都用）', 'ptr');
    cap('我們只看基本的演算法，重點是 concept', 'FIFO 很直觀；最重要的是 LRU');
  },
]);

scene('vm-14b-fifo', 'FIFO：3 個 frame，9 次 page fault', CAMW, [
  async (tok, S) => {                                   // 597.0 先看 FIFO
    S.G = rgrid(BEL, 3, 'fifo', { dx: 0.95, y: 6.0 }); sm('reference string', -6.4, 6.0);
    cap('先從 first in, first out 看', 'input：reference string');
  },
  async (tok, S) => {                                   // 614.0 還需要 frame 數：3 個
    S.fl = ['新 ↑', '', '舊 ↓'].map((t, r) => sm(t, -6.4, S.G.yRow(r))); hd('3 個 frame', -6.4, 6.8);
    cap('第二個需要：physical memory 有幾個 frame', '簡單的例子：只有 3 個 frame');
  },
  async (tok, S) => {                                   // 645.4 被 access 的一定要在 frame；其他留誰
    note('現在被 access 的 page 一定要在 frame；問題是其他位置留給誰', 0, 1.6);
    cap('現在被 access 的 page 一定要放進 frame', '重點是：要踢掉人時，踢誰？');
  },
  async (tok, S) => {                                   // 673.0 從全部都空的開始
    sm('一開始 memory 全空', S.G.x(0), 2.3);
    cap('例子通常從全部都空的開始', '前面發生什麼我們也不知道');
  },
  async (tok, S) => {                                   // 685.8 ref 1 → page fault
    await S.G.go(tok, 1);
    cap('要 page 1：有空位，直接放進去', '紅色 F 代表一次 page fault');
  },
  async (tok, S) => {                                   // 695.4 順序不重要；FIFO 用 queue（head、tail）
    sm('（畫的是 FIFO queue：上面最新、下面最舊）', 0, 1.1);
    cap('三個位置的順序不重要', '這樣畫是 FIFO queue：head、tail 兩個 pointer');
  },
  async (tok, S) => {                                   // 727.0 紅 = page fault；算次數
    cap('目的：算這個 input、這個 frame 數下', '會產生幾次 page fault，越少越好');
  },
  async (tok, S) => {                                   // 756.4 第一次 access 一定 fault
    cap('第一次 access 一定是 page fault', '（實際有 locality、frame 也多得多，例子是縮小版）');
  },
  async (tok, S) => {                                   // 778.8 ref 2
    await S.G.go(tok, 1);
    cap('page 2：第一次 access，page fault', '新的放最上面，往下推');
  },
  async (tok, S) => {                                   // 815.7 ref 3
    await S.G.go(tok, 1);
    cap('page 3：一樣是 page fault', '前三個依序全部 fault，queue 是 3 2 1');
  },
  async (tok, S) => {                                   // 827.4 ref 4 → 踢 1
    await S.G.go(tok, 1);
    cap('page 4 來了：滿了，要 replace', 'FIFO：最早進來的 1 被踢掉');
  },
  async (tok, S) => {                                   // 861.7 順序只是 queue，page 沒真的搬
    note('page 在 frame 裡沒有移動：只是 queue 這個 data structure 在變', 0, 0.5);
    cap('畫起來好像 page 在搬，其實沒有', '這只是 maintain queue 的 data structure');
  },
  async (tok, S) => {                                   // 898.1 ref 1 又來 → fault
    await S.G.go(tok, 1);
    cap('才把 1 踢掉，1 就又來了', '又是一次 page fault：不好的演算法');
  },
  async (tok, S) => {                                   // 916.3 ref 2 → fault
    await S.G.go(tok, 1);
    cap('2 進來：一樣很不幸', '又一次 page fault');
  },
  async (tok, S) => {                                   // 922.6 ref 5 → fault
    await S.G.go(tok, 1);
    cap('5 也是 page fault', '把 queue 最底的 4 推出去');
  },
  async (tok, S) => {                                   // 925.4 ref 1 → hit
    await S.G.go(tok, 1);
    cap('這時 1 進來是 hit', '但 FIFO 不會移動它：1 仍是下一個被踢的');
  },
  async (tok, S) => {                                   // 937.0 ref 2 hit；ref 3 → 踢 1
    await S.G.go(tok, 2);
    cap('2 是 hit；3 進來往下推', '1 雖然剛被 access，還是被踢出去');
  },
  async (tok, S) => {                                   // 950.1 go through：4、5
    await S.G.go(tok, 2);
    cap('大家就這樣 go through', '4 是 fault，最後的 5 是 hit');
  },
  async (tok, S) => {                                   // 957.2 數紅色：9 次
    good('FIFO、3 個 frame：' + S.G.faults + ' 次 page fault', 0, -0.1);
    cap('最後數有幾個紅色', 'FIFO 會造成 ' + S.G.faults + ' 次 page fault');
  },
]);

scene('vm-14b-belady', "Belady's anomaly：frame 變多，fault 反而變多", CAMW, [
  async (tok, S) => {                                   // 972.6 FIFO 顯然不太好
    S.r3 = hd('FIFO、3 frames：' + vmFaults(BEL, 3, 'fifo') + ' 次', -3.6, 7.8);
    cap('FIFO 顯然不太好', '這個數字應該還可以再往下減');
  },
  async (tok, S) => {                                   // 984.3 另一個大問題：anomaly
    hot('FIFO 另一個大問題：anomaly（Belady 發現）', 2.6, 7.8);
    cap('FIFO 還有一個很大的問題', '叫 anomaly：Belady 這位 researcher 發現的');
  },
  async (tok, S) => {                                   // 1006.8 增加 frame，以為 fault 會降
    S.d1 = sm('直覺：frame（resource）越多 → page fault 越少', 0, 0.9);
    cap('增加 frame 數，也就是增加 resource', '你一定會想：page fault 會降低');
  },
  async (tok, S) => {                                   // 1023.3 但沒減少，甚至增加
    S.d2 = bad('anomaly：frame 變多，page fault 沒減少，甚至增加！', 0, 0.3);
    cap('anomaly 就是：增加了 frame', 'page fault 卻沒減少，甚至還增加');
  },
  async (tok, S) => {                                   // 1036.9 一樣的例子，frame 3 → 4 再跑
    S.G = rgrid(BEL, 4, 'fifo', { dx: 0.95, y: 6.2, name: 'FIFO、4 frames' });
    await S.G.go(tok, 12, 160);
    cap('完全一樣的例子，只把 frame 從 3 變 4', '完全一樣的演算法，自己跑一次');
  },
  async (tok, S) => {                                   // 1051.1 變成 10 次
    glow(S.G.cols[S.G.cols.length - 1].cubes[0], null); S.r4 = bad('4 frames：' + S.G.faults + ' 次 > 3 frames：' + vmFaults(BEL, 3, 'fifo') + ' 次', 0, 1.6);
    cap('page fault 變成 ' + S.G.faults + ' 次', '剛剛 3 個 frame 是 ' + vmFaults(BEL, 3, 'fifo') + ' 次：跟預期相違背');
  },
  async (tok, S) => {                                   // 1085.8 畫出來：應該 non-increasing，FIFO 會往上
    S.G.clear(); gone(S.r4, S.d1, S.d2); S.ax = axes(-4.6, 0.6, 9.2, 5.6, 'frame 數', 'page fault 次數');
    const pts = [1, 2, 3, 4, 5, 6, 7].map((F) => [-4.0 + (F - 1) * 1.35, 0.6 + vmFaults(BEL, F, 'fifo') * 0.42]);
    S.c = poly(pts, '#c0392b');
    pts.forEach(([x, y], i) => { cube(String(vmFaults(BEL, i + 1, 'fifo')), i === 3 ? MC.red : MC.orange, [0.42, 0.42, 0.42], x, y, 0.3); sm(String(i + 1), x, 0.25); });
    S.up = hot('3 → 4：往上跳', -4.0 + 3 * 1.35 + 1.4, 0.6 + 10 * 0.42 + 0.5);
    cap('畫出來：x 是 frame 數、y 是 page fault', '應該要 non-increasing，FIFO 卻在 3→4 往上跳');
  },
  async (tok, S) => {                                   // 1117.9 系統設計者很討厭：無法 tune
    sm('多買 memory，電腦反而變慢 → 很難調整系統', 1.6, 6.6);
    cap('對系統設計者很討厭', '花更多錢插更多 memory，電腦卻跑更慢：很難 tune');
  },
  async (tok, S) => {                                   // 1170.5 FIFO 兩個問題
    note('FIFO 的兩個問題：① page fault 多　② Belady\'s anomaly', 0, -0.4);
    cap('FIFO 的問題有兩個層面', 'page fault 不夠少，更討厭的是這個 anomaly');
  },
]);

// ════════ TXcPJuccafA（第 14C 講：Optimal、LRU、stack algorithm、LRU 近似、counting） ════════
scene('vm-14c-opt', 'Optimal：踢掉最晚才會再用的', CAM, [
  async (tok, S) => {                                   // 14.0 FIFO 不一定好、又有 anomaly
    bad("FIFO：不一定好，還有 Belady's anomaly", 0, 6.6);
    cap('FIFO 不一定好，還有 anomaly', '系統設計者不太喜歡用');
  },
  async (tok, S) => {                                   // 19.3 optimal 很容易描述
    hd('optimal algorithm', 0, 5.9);
    cap('replacement 問題的 optimal', '其實很容易描述');
  },
  async (tok, S) => {                                   // 44.0 一句話：最晚會被用到的先踢
    S.fr = [1, 2, 3].map((p, i) => bx('page ' + p, pc(p), -4.6, 4.6 - i * 0.7, 0, 1.6, 0.56, 0.7));
    hd('未來的 reference（示意）', 1.6, 5.2);
    S.fut = [2, 1, 2, 1, 3].map((p, i) => cube(String(p), pc(p), [0.55, 0.55, 0.55], -1.4 + i * 0.9, 4.4, 0));
    S.far = hot('page 3 最晚才再用 → 踢它', 1.6, 3.4); glow(S.fr[2], NG);
    cap('一句話：最晚才會被使用的，先踢出去', '（Belady 提出的 optimal）');
  },
  async (tok, S) => {                                   // 59.7 直覺：踢別的一定先用到，先 fault
    sm('踢 1 或 2：它們很快又要用 → 更早 page fault', 1.6, 2.7);
    cap('踢其他的，它們一定會先被用到', '就會先產生 page fault；踢最不可能用到的當然最好');
  },
  async (tok, S) => {                                   // 90.7 只看順序不看時間
    note('只看 access 的順序，不看隔幾秒', 1.6, 2.0);
    cap('重點是 access 的 order', '隔幾秒、幾 ms 不重要；最晚被 access 的先踢');
  },
  async (tok, S) => {                                   // 109.8 但做不到：要知道未來
    S.fut.forEach((m) => relabel(m, '?')); bad('前提：要知道未來的 access pattern → 做不到', 0, 1.2);
    cap('說得簡單，理論上也好證明', '但 implement 不了：你必須知道未來的 reference string');
  },
  async (tok, S) => {                                   // 141.2 預測有極限：branch
    sm('compiler 能預測一部分，但有 branch 就不可能 100% 知道', 0, 0.6);
    cap('compiler 可以做某種程度的 prediction', '但程式有 branch，不可能 perfectly 知道順序');
  },
  async (tok, S) => {                                   // 163.6 當 baseline
    good('用途：baseline（最少的 page fault 是多少）', 0, 0.0);
    cap('所以它是 theoretical algorithm', '當 baseline：知道最少幾次，其他演算法看能多貼近');
  },
]);

scene('vm-14c-optex', 'OPT 例子：4 個 frame，6 次', CAMW, [
  async (tok, S) => {                                   // 190.1 4 個 frame
    S.G = rgrid(BEL, 4, 'opt', { dx: 0.95, y: 6.2, name: 'OPT', view: 'slots' });
    cap('一樣來 go through 這個例子', '這次有 4 個 frame，同一個 reference string');
  },
  async (tok, S) => {                                   // 198.4 前四個放進去，都 fault
    await S.G.go(tok, 4, 260);
    cap('前四個就擺進去', '全部都 page fault，就算是 optimal 也一樣');
  },
  async (tok, S) => {                                   // 208.2 1 來：往未來看；1 是 hit
    S.fut = hot('OPT 不看過去的 queue，往未來看 →', S.G.x(5), 1.9);
    await S.G.go(tok, 1);
    cap('1 來了：OPT 不 care 過去', '從這個點往後看；1 本來就在，是 hit');
  },
  async (tok, S) => {                                   // 231.5 2 也留著
    await S.G.go(tok, 1);
    cap('2 也是 hit，繼續留著', '沒有什麼好選的');
  },
  async (tok, S) => {                                   // 235.9 5：1 下一個就用、2 隔兩個、3、4 → 踢 4
    gone(S.fut); S.d = sm('之後：1 下一個就用、2 再下一個、3、4 最晚 → 踢 4', S.G.x(6), 1.9);
    await S.G.go(tok, 1);
    cap('5 來了，要 replace 一個', '往後看：最晚才用到的是 4，就踢 4');
  },
  async (tok, S) => {                                   // 265.9 1、2、3 全是 hit
    gone(S.d); await S.G.go(tok, 3, 300);
    cap('接下來 1、2、3', '很明顯全部都是 hit，保留原來的 content');
  },
  async (tok, S) => {                                   // 275.6 4 來：唯一不能丟 5；1 2 3 以後都沒了
    S.t = sm('之後只剩 5；1、2、3 都不再用 → 平手（這裡換最早進來的 1）', S.G.x(5), 1.9);
    await S.G.go(tok, 1);
    cap('4 來了：唯一不能丟的是 5', '1、2、3 以後都不會再用，丟誰都可以');
  },
  async (tok, S) => {                                   // 289.5 考試 tiebreaker 誰都行
    sm('考試遇到這種平手：丟誰都 OK', S.G.x(5), 1.4);
    cap('考試遇到最後的 tiebreaker', '丟誰都無所謂；如果後面還有 2、3、1，就丟 1');
  },
  async (tok, S) => {                                   // 306.2 規則：最晚用到的丟掉；5 是 hit
    gone(S.t); await S.G.go(tok, 1);
    cap('就 follow 這個簡單的規則', '最晚才會用到的丟掉；最後的 5 是 hit');
  },
  async (tok, S) => {                                   // 319.0 總共 6 次
    good('OPT：' + S.G.faults + ' 次（FIFO 3 frames 9 次、4 frames 10 次）', 0, 0.8);
    cap('只有 ' + S.G.faults + ' 次 page fault', '前面 9、10 次；最好最好就是 ' + S.G.faults);
  },
  async (tok, S) => {                                   // 336.8 預測 reuse distance 去逼近
    note('實務：觀察程式、預測下次 reuse 的距離（甚至用 learning）來逼近 OPT', 0, 0.2);
    cap('很多演算法在想怎麼 predict', '預測下一次 reuse 的距離，把最遠的踢掉來逼近 optimal');
  },
]);

scene('vm-14c-lru', 'LRU：往回看，踢最久沒用的', CAM, [
  async (tok, S) => {                                   // 378.6 實際最常用 LRU
    hd('LRU：Least Recently Used', 0, 6.6);
    cap('實際上沒辦法用 optimal', '所以大家用什麼？最多的是 LRU');
  },
  async (tok, S) => {                                   // 390.4 heuristic：往回看
    S.past = [1, 2, 3, 4, 1, 2].map((p, i) => cube(String(p), pc(p), [0.6, 0.6, 0.6], -5.0 + i * 1.0, 4.6, 0));
    S.now = hot('現在 →', 1.6, 4.6); S.back = arrow(V3(0.6, 3.8, 0.4), V3(-4.6, 3.8, 0.4));
    sm('不能往未來看，就往回看', -2.0, 3.3);
    cap('一個 heuristic：least recently used', '不能看未來，那就往回看');
  },
  async (tok, S) => {                                   // 409.6 locality：剛用完的很可能再用
    glow(S.past[5], OKG); glow(S.past[4], OKG);
    good('locality：剛用過的很可能再用', 3.4, 5.4);
    cap('程式有 locality', '剛使用完的 page，很高的機率會再用；附近的也是');
  },
  async (tok, S) => {                                   // 445.2 往回看最久沒被 access 的踢掉
    glow(S.past[2], NG); bad('最久沒被 access 的（3）→ 先踢', -2.0, 2.6);
    cap('越久沒用到的，越不會用到', '往回看，最久以前被 access 的那個先踢掉');
  },
  async (tok, S) => {                                   // 454.8 實驗證明不錯；implementation O(1)
    note('實驗：效果不錯；而且 implementation 可以 O(1)', 0, 1.6);
    cap('因為 locality，實驗證明 LRU 蠻好的', '還有一個非常重要：它可以 O(1) 做完');
  },
]);

scene('vm-14c-lruimpl', 'LRU 的兩種實作：counter 與 stack', CAM, [
  async (tok, S) => {                                   // 494.2 兩種 implementation
    hd('LRU 的 implementation', 0, 6.6);
    cap('LRU 的 implementation', '有兩種');
  },
  async (tok, S) => {                                   // 497.3 counter：每頁存 time stamp
    hd('① counter（time stamp）', -3.4, 5.8);
    S.f = [[3, 't=12'], [1, 't=15'], [4, 't=9'], [2, 't=14']].map(([p, t], i) => { bx('page ' + p, pc(p), -4.2, 5.0 - i * 0.62, 0, 1.4, 0.52, 0.7); return bx(t, MC.paper, -2.6, 5.0 - i * 0.62, 0, 1.2, 0.52, 0.7); });
    sm('（時間示意）', -3.4, 2.1);
    cap('第一種：counter implementation', '每次 access 就記下 time stamp（幾點幾分用的）');
  },
  async (tok, S) => {                                   // 515.3 linear scan 找最舊 → O(n)
    for (const m of S.f) { glow(m, HL); await wt(tok, 220); glow(m, null); }
    glow(S.f[2], NG); bad('linear search：O(n)，frame 越多越慢', -3.4, 1.5);
    cap('找最舊的要 linear scan', 'O(n)：frame 越多跑得越慢，非常不好');
  },
  async (tok, S) => {                                   // 529.8 用 stack：O(1)
    hd('② stack（像 FIFO 的 queue）', 3.2, 5.8);
    S.st = [2, 1, 3, 4].map((p, i) => bx('page ' + p, pc(p), 3.2, 5.0 - i * 0.62, 0, 1.4, 0.52, 0.7));
    sm('最上：最近用的', 4.9, 5.0); sm('最下：下一個被踢', 4.9, 3.14); good('O(1) 找到 victim', 3.2, 2.2);
    cap('真的 implement 會用 stack', '有點像 FIFO 的 queue，O(1) 就知道該踢誰');
  },
]);

scene('vm-14c-lruex', 'LRU 例子：4 個 frame，8 次', CAMW, [
  async (tok, S) => {                                   // 546.6 前面一樣 1234 全部 fault
    S.G = rgrid(BEL, 4, 'lru', { dx: 0.95, y: 6.2, name: 'LRU' });
    S.fl = ['最近 ↑', '', '', '最久 ↓'].map((t, r) => sm(t, -6.6, S.G.yRow(r)));
    await S.G.go(tok, 4, 260);
    cap('前面一樣：1 2 3 4 全部 fault', '放進 stack，新的在最上面');
  },
  async (tok, S) => {                                   // 554.1 跟 FIFO 不同：1 是 hit
    await S.G.go(tok, 1);
    cap('跟 FIFO 不一樣的地方在這裡', '1 進來是一個 hit');
  },
  async (tok, S) => {                                   // 567.2 拉到最上；2 變成下一個被踢的
    S.nx = sm('↑ 1 被拉到最上；最底的 2 是下一個 victim', S.G.x(4), 1.9);
    cap('我知道 1 是最近用的，不想踢它', '從 stack 底拉回最上面；2 變成最久沒用的');
  },
  async (tok, S) => {                                   // 596.9 新的往下 push；最近 access 永遠在最上
    gone(S.nx); sm('規則：被 access（hit 或新進來）就放到最上面', 0, 1.4);
    cap('hit 了就拉到最前面', '新的就往下 push：最近被 access 的永遠在最上面');
  },
  async (tok, S) => {                                   // 614.6 2 也 hit → 2 1 4 3
    await S.G.go(tok, 1);
    cap('2 一樣已經有了，拉上去', 'stack 變成 2 1 4 3');
  },
  async (tok, S) => {                                   // 620.2 5 進來：踢 3（FIFO 會踢 1）
    await S.G.go(tok, 1);
    cap('5 進來，位置不夠：繼續 push', '最底的 3 被踢掉（FIFO 會踢 1）');
  },
  async (tok, S) => {                                   // 637.8 後面照規則
    await S.G.go(tok, 5, 300);
    cap('後面照規則：1、2 hit；3、4、5 fault', '總共 ' + S.G.faults + ' 次 page fault');
  },
  async (tok, S) => {                                   // 642.2 考試：用實作角度模擬
    good('LRU：' + S.G.faults + ' 次（FIFO 10、OPT 6）', 0, 0.8);
    cap('考試或自己模擬時', '用實作的角度、照固定規則在腦中跑，最不會錯');
  },
]);

scene('vm-14c-lruo1', '為什麼 LRU 是 O(1)：hash map ＋ doubly linked list', CAM, [
  async (tok, S) => {                                   // 657.9 為什麼 O(1)
    hd('LRU 為什麼是 O(1)？', 0, 6.7);
    cap('為什麼 LRU 是 O(1)？', '其實還蠻容易看到的');
  },
  async (tok, S) => {                                   // 665.0 doubly linked list：O(1) dequeue／enqueue
    S.nd = [2, 1, 4, 3].map((p, i) => bx(String(p), pc(p), -4.2 + i * 2.2, 4.6, 0, 0.9, 0.7, 0.7));
    S.lk = [0, 1, 2].map((i) => [arrow(V3(-3.6 + i * 2.2, 4.75, 0.3), V3(-2.4 + i * 2.2, 4.75, 0.3)), arrow(V3(-2.4 + i * 2.2, 4.45, 0.3), V3(-3.6 + i * 2.2, 4.45, 0.3))]);
    sm('head：最近', -4.2, 5.4); sm('tail：最久', 2.4, 5.4);
    cap('用 doubly linked list', 'insert、dequeue、enqueue 都是 O(1)');
  },
  async (tok, S) => {                                   // 672.8 怎麼知道 1 在 list 哪裡？
    hot('1 在 list 的哪裡？一個個找就 O(n)', -2.0, 3.6);
    cap('你可能會問：1 hit 了', '怎麼 O(1) 知道它在 queue 的哪個位置？');
  },
  async (tok, S) => {                                   // 690.8 hash map 存 node pointer
    S.hm = [1, 2, 3, 4].map((p, i) => bx('key ' + p, MC.sand, -4.4 + i * 1.6, 1.6, 0, 1.3, 0.5, 0.7));
    hd('hash map：page → node 的 pointer', -2.0, 2.4);
    const a = arrow(V3(-4.4, 1.9, 0.4), V3(-2.0, 4.2, 0.4)); glow(S.hm[0], HL); glow(S.nd[1], HL);
    cap('大家的做法：用一個 hash map', 'hash 1 就拿到它在 linked list 的 pointer');
  },
  async (tok, S) => {                                   // 707.6 dequeue 再 enqueue 到 head
    await slide(tok, S.nd[1], -4.2, 4.6, 0, 600); await slide(tok, S.nd[0], -2.0, 4.6, 0, 500); glow(S.nd[1], null);
    good('hash + doubly linked list：平均 O(1)', 1.4, 0.6);
    cap('找到之後 dequeue、重新 enqueue 到最前面', 'hash map + double link list：平均 O(1)');
  },
  async (tok, S) => {                                   // 731.9 最常用；cache 也用 LRU
    note('不只 paging：cache 的 replacement 也大多用 LRU', 0, 0.0);
    cap('所以 LRU 是最常被使用的', '不只 paging，cache 的 replacement 也都用 LRU');
  },
  async (tok, S) => {                                   // 763.8 LRU 8：比 FIFO 好，離 OPT 6 有距離
    S.cmp = [['FIFO', 10, MC.orange], ['LRU', 8, MC.blue], ['OPT', 6, MC.green]].map(([n, v, c], i) => { const b = bx(n + '：' + v, c, 4.2, 3.4 - i * 0.65, 0, 0.25 * v, 0.5, 0.6); return b; });
    sm('4 個 frame、同一串', 4.2, 3.95);
    cap('LRU 也不是最好：8 次', '比 FIFO 好，但跟 optimal 的 6 還有一點距離');
  },
]);

scene('vm-14c-stack', 'Stack algorithm：frame 變多不會更糟', CAMW, [
  async (tok, S) => {                                   // 779.3 系統人在乎可證明的 property
    hd('stack algorithm', 0, 7.0);
    cap('heuristic 的好壞不一定', '系統人更 care 可以被證明的 property');
  },
  async (tok, S) => {                                   // 792.3 OPT、LRU 都是 stack algorithm
    S.b = bullets(-6.6, 6.2, 0.5); S.b('LRU、Optimal 都屬於 stack algorithm', 'good');
    cap('LRU 跟 optimal 都屬於', '所謂的 stack algorithm：一個 class of algorithm');
  },
  async (tok, S) => {                                   // 813.5 定義：n 個 frame 時的 page 集合
    S.rs = BEL.slice(0, 7).map((p, i) => cube(String(p), pc(p), [0.5, 0.5, 0.5], -5.4 + i * 0.75, 4.6, 0));
    S.now = hot('時間點：第 7 個 reference 之後', -3.2, 5.3);
    const s3 = vmSim(BEL, 3, 'lru')[6].order; hd('LRU、3 frames', 1.6, 5.4);
    S.c3 = s3.map((p, i) => cube(String(p), pc(p), [0.6, 0.6, 0.6], 1.0 + i * 0.75, 4.6, 0));
    cap('定義：原來有 n 個 frame', '同一個時間點，裡面放著某個 page 的 subset');
  },
  async (tok, S) => {                                   // 838.2 frame 加 1：新集合包含原來的
    const s4 = vmSim(BEL, 4, 'lru')[6].order, s3 = vmSim(BEL, 3, 'lru')[6].order; hd('LRU、4 frames', 1.6 + 0.4, 3.6);
    S.c4 = s4.map((p, i) => { const m = cube(String(p), pc(p), [0.6, 0.6, 0.6], 1.0 + i * 0.75, 2.8, 0); if (s3.includes(p)) glow(m, OKG); return m; });
    good('{' + s3.join(', ') + '} ⊆ {' + s4.join(', ') + '}', 2.2, 2.0);
    cap('同樣的 input，frame 加 1 或加 2', 'stack algorithm：原來的 page 一定還在裡面（superset）');
  },
  async (tok, S) => {                                   // 876.5 像 stack：越大越包含
    S.b('frame 越多，放的東西一定是原來的 superset（像 stack 一直往上疊）');
    cap('就像 stack 一直往上加', 'stack 越大，裡面一定包含原來全部');
  },
  async (tok, S) => {                                   // 916.2 保證：增加 frame 不會增加 fault → 沒有 anomaly
    S.b('→ 增加 frame，page fault 不可能變多：沒有 anomaly', 'good');
    cap('它 guarantee：增加 resource', '原來的都在，page fault 不可能變多：沒有 anomaly');
  },
  async (tok, S) => {                                   // 961.1 LRU 證明：往回看 4 個 distinct vs 5 個
    S.lb = arrow(V3(-0.9, 4.0, 0.4), V3(-5.6, 4.0, 0.4));
    sm('LRU：往回看，最先看到的 n 個不同 page；n + 1 時一定包含它們', -3.0, 3.5);
    cap('LRU 為什麼是？任何時間點往回看', '先看到的 4 個 distinct；5 個 frame 就看 5 個，一定包含原來 4 個');
  },
  async (tok, S) => {                                   // 1010.9 OPT：往未來看，同理
    sm('OPT：往未來看，一樣的道理', -3.0, 3.0);
    cap('optimal 只是方向不同', '往未來看 n 個 distinct，frame 多就看更多：也是 stack algorithm');
  },
  async (tok, S) => {                                   // 1044.2 FIFO 不是
    const f3 = vmSim(BEL, 3, 'fifo')[6].order, f4 = vmSim(BEL, 4, 'fifo')[6].order;
    const miss = f3.filter((p) => !f4.includes(p));
    bad('FIFO 不是：同一時間點 3 frames {' + f3.join(', ') + '}，4 frames {' + f4.join(', ') + '}，少了 ' + miss.join('、'), 0, 0.9);
    cap('FIFO 不是 stack algorithm', '同一時間點，4 個 frame 的內容沒有包含 3 個 frame 的');
  },
]);

scene('vm-14c-approx', 'LRU 的變形：additional-reference-bits、second chance', CAM, [
  async (tok, S) => {                                   // 1069.8 cache／replacement 演算法非常多
    hd('LRU 的變形（課本）', 0, 6.7);
    cap('cache 的 replacement algorithm 非常多', '不會一一 go through，知道 concept 就好');
  },
  async (tok, S) => {                                   // 1089.3 additional reference bit、second chance
    S.b = bullets(-6.4, 6.0, 0.55); S.b('additional-reference-bits：每頁 8 bits 定期右移，值最小的最久沒用（例：01110111 < 11000100）');
    S.b('second chance（clock）');
    cap('課本提到幾個變化', '像 additional reference bit、second chance');
  },
  async (tok, S) => {                                   // 1095.8 second chance：給第二次機會
    const pts = [[0, 3.7], [2.0, 2.4], [0, 1.1], [-2.0, 2.4]];
    S.ring = [[2, 1], [5, 1], [1, 0], [4, 1]].map(([p, r], i) => ({ p: bx('page ' + p, pc(p), pts[i][0], pts[i][1], 0, 1.5, 0.5, 0.7), r: bx(String(r), r ? MC.mint : '#f3c9c9', pts[i][0] + 1.0, pts[i][1], 0, 0.45, 0.45, 0.5) }));
    S.ptr = hot('▶ 指標', -1.6, 3.7); sm('（課本版 clock，示意）', 0, 0.3);
    S.nw = pkt('page 6', pc(6), 4.8, 2.4, 0.6, 1.2);
    cap('second chance：被選中時給第二次機會', '課本做法：FIFO 加一個 reference bit（clock）');
  },
  async (tok, S) => {                                   // 1114.4 被踢出來先降級（bit 1 → 0，跳過）
    for (const i of [0, 1]) { relabel(S.ring[i].r, '0'); tint(S.ring[i].r, '#f3c9c9'); glow(S.ring[i].p, HL); await wt(tok, 400); glow(S.ring[i].p, null); S.ptr.position.set([2.0, 0][i] - 1.6, [2.4, 1.1][i], 0); }
    cap('被踢出來的先放到低 priority', 'clock：reference bit 是 1 就清成 0、跳過，給第二次機會');
  },
  async (tok, S) => {                                   // 1123.8 真正被踢的是 low priority 裡的
    glow(S.ring[2].p, NG); await slide(tok, S.nw, 0, 1.1, 0.6, 700); kill(S.ring[2].p); relabel(S.ring[2].r, '1'); tint(S.ring[2].r, MC.mint);
    cap('真正要踢的，從 low priority 裡挑', 'bit 是 0 的 page 1 被換成 page 6');
  },
  async (tok, S) => {                                   // 1155.2 都是 LRU 的變形
    good('基本上都是 LRU 的變形（近似 LRU）', 0, -0.3);
    cap('這些基本上都是 LRU 的變形', '因為 LRU 有剛剛那幾個非常重要的好處');
  },
]);

scene('vm-14c-count', 'Counting：LFU 與 MFU', CAM, [
  async (tok, S) => {                                   // 1174.0 另一型：frequency
    hd('counting-based：看 frequency', 0, 6.7);
    S.f = [[1, 9], [2, 2], [3, 5]].map(([p, c], i) => ({ p: bx('page ' + p, pc(p), -1.2, 5.6 - i * 0.75, 0, 1.6, 0.6, 0.7), c: bx('count ' + c, MC.paper, 0.8, 5.6 - i * 0.75, 0, 1.6, 0.6, 0.7) }));
    sm('（次數示意）', 0, 3.1);
    cap('前面看 recency（多久前用）', '另一型是根據 frequency（用了幾次）');
  },
  async (tok, S) => {                                   // 1184.9 最常用的留著
    cap('最常用到的留在 frame 裡', 'page fault 次數就會減少：比較 make sense？');
  },
  async (tok, S) => {                                   // 1217.3 LFU：count 最低的踢
    glow(S.f[1].p, NG); bad('LFU：count 最小的踢掉（page 2）', -3.8, 4.85);
    cap('LFU：least frequently used', 'frequency 最低的先踢掉');
  },
  async (tok, S) => {                                   // 1239.3 MFU：count 最高的踢
    glow(S.f[0].p, NG); bad('MFU：count 最大的踢掉（page 1）', 4.2, 5.6);
    cap('MFU 倒過來', '最常用的那個，反而踢掉');
  },
  async (tok, S) => {                                   // 1252.9 LFU 問題：burst
    sm('LFU 的問題：某段時間 burst 衝高 count，之後不用卻一直佔著', 0, 2.4);
    cap('常用不代表正在用', '一段 burst 把 count 衝很高，之後不用卻一直佔著 memory');
  },
  async (tok, S) => {                                   // 1303.3 MFU 想法：剛用很多可能已用完
    sm('MFU 的想法：用很多的可能剛用完（for loop 算完了）', 0, 1.8);
    cap('MFU 的想法', '一直用某個 array 的 for loop，算完就不再用了');
  },
  async (tok, S) => {                                   // 1331.1 不受歡迎：counting 成本高、overflow
    bad('不受歡迎：每次 access 都要 count，成本高；counter 還會 overflow', 0, 1.1);
    cap('這些通常不受歡迎', '每次 access 都要加 counter，成本很高，還會 overflow');
  },
  async (tok, S) => {                                   // 1386.8 LRU 通常不比它們差
    good('LRU 的結果通常不比它們差，甚至更好', 0, 0.4);
    cap('LRU 的結果', '通常不會比這些差，甚至更好');
  },
]);

// ════════ cfPNAeAatGs（第 14D 講：Allocation of Frames、Thrashing、Working set、PFF） ════════
const WSREF = [2, 6, 1, 5, 7, 7, 7, 7, 5, 1, 6, 2, 3, 4, 1, 2, 3, 4, 4, 4, 3, 4, 3, 4, 4, 4];   // 課本 working-set 圖的 reference（到 t2 為止）
scene('vm-14d-min', '每個 process 最少要幾個 frame', CAM, [
  async (tok, S) => {                                   // 14.0 跨 process：每個拿多少 frame
    S.ps = ['P1', 'P2', 'P3'].map((n, i) => buddy(n, '', [MC.blue, MC.green, MC.purple][i], -4.4 + i * 2.2, 0.2, 0, 0.6));
    S.mem = zone('physical memory（大家 share）', 0, 2.2, 0, 8.0, 1.2);
    cap('第二個問題：跨 process', '大家 share physical memory，每個 process 該拿幾個 frame？');
  },
  async (tok, S) => {                                   // 43.5 太少會怎樣：最少需要的 frame 數
    hot('太少會怎樣？一個 instruction 最少要幾個 frame？', 0, 6.6);
    cap('拿到太少會發生什麼問題', '先知道：一個程式要能執行，有個最少需要的 frame 數');
  },
  async (tok, S) => {                                   // 59.9 極端例子：一個 instruction 最多要 6 個 frame
    bad('極端例子：執行一個 instruction，worst case 要 6 個 frame', 0, 5.9);
    cap('極端的例子：一個 instruction', 'worst case 要同時 touch 6 個 frame，少一個就跑不起來');
  },
  async (tok, S) => {                                   // 95.9 早期 IBM 機器
    gone(S.ps, S.mem); S.pg = [];
    hd('早期 IBM 機器（IBM 370 的 MVC 指令）', 0, 5.2);
    cap('為什麼要 6 個？', '這是很早期的一台 IBM 機器');
  },
  async (tok, S) => {                                   // 104.9 instruction 6 bytes → 跨 2 個 page
    S.ins = bx('MVC 指令（6 bytes）', MC.purple, -4.4, 3.8, 0, 2.4, 0.6, 0.8);
    S.pg.push(bx('page', MC.paper, -5.0, 2.8, 0, 1.0, 0.5, 0.6), bx('page', MC.paper, -3.8, 2.8, 0, 1.0, 0.5, 0.6));
    sm('剛好跨在兩個 page 中間 → 2', -4.4, 2.1);
    cap('instruction 很複雜：6 個 byte', '倒楣的話跨在兩個 page 中間：光 fetch 就要 2 個 frame');
  },
  async (tok, S) => {                                   // 139.0 move：從 base address 搬 length 個 byte
    hd('memory → memory 直接搬：from（base + length）→ to（base + length）', 0, 4.6);
    cap('它是一個很 powerful 的 move', '從某個 base address 開始搬一段長度，直接 memory 對 memory');
  },
  async (tok, S) => {                                   // 200.4 來源跨 2 個 page
    S.src = bx('from 區塊', MC.blue, 0, 3.8, 0, 2.0, 0.6, 0.8);
    S.pg.push(bx('page', MC.paper, -0.6, 2.8, 0, 1.0, 0.5, 0.6), bx('page', MC.paper, 0.6, 2.8, 0, 1.0, 0.5, 0.6)); sm('又 2', 0, 2.1);
    cap('base 在一個 page 裡，長度不用太長', '六、八個 byte 就可能跨過去：又是 2 個 page');
  },
  async (tok, S) => {                                   // 213.6 目的地也跨 2 個 → 6
    S.dst = bx('to 區塊', MC.green, 4.4, 3.8, 0, 2.0, 0.6, 0.8);
    S.pg.push(bx('page', MC.paper, 3.8, 2.8, 0, 1.0, 0.5, 0.6), bx('page', MC.paper, 5.0, 2.8, 0, 1.0, 0.5, 0.6)); sm('再 2', 4.4, 2.1);
    S.pg.forEach((m) => glow(m, HL)); good('2 + 2 + 2 = 6 個 page → 至少要 6 個 frame', 0, 1.3);
    cap('搬到的地方又跨兩個 page', '2 + 2 + 2 = 6：至少要空出 6 個 frame 才能執行');
  },
  async (tok, S) => {                                   // 258.5 通常 2～4 個
    note('通常不會那麼誇張，但 2～4 個 frame 一定需要', 0, 0.5);
    cap('通常不會那麼誇張', '但兩個到四個 frame 是一定需要的');
  },
]);

scene('vm-14d-fixed', 'Fixed allocation vs priority allocation', CAM, [
  async (tok, S) => {                                   // 274.6 frame allocation：每個 process 給多少
    hd('frame allocation：每個 process 給幾個 frame？', 0, 6.7);
    cap('frame allocation 的目的', '決定每個 process 到底給它多少個 frame');
  },
  async (tok, S) => {                                   // 283.5 fixed：一開始的資訊決定，跟 run time 無關
    S.l = bx('fixed allocation', MC.tlb, -3.4, 5.8, 0, 3.4, 0.6, 0.8); sm('run 之前就決定，跟 run time 無關', -3.4, 5.15);
    cap('第一大類：fixed allocation', '根據 process 一開始的資訊決定，跟 run time 無關');
  },
  async (tok, S) => {                                   // 297.5 equal：100 frame、5 process → 20
    S.eq = [0, 1, 2, 3, 4].map((i) => bx('20', pc(i + 1), -5.4 + i * 1.0, 4.2, 0, 0.9, 0.6, 0.7));
    sm('equal：100 個 frame ÷ 5 個 process = 每個 20', -3.4, 3.5);
    cap('例如 equal：100 個 frame、5 個 process', '平分，每個 20 個');
  },
  async (tok, S) => {                                   // 306.9 proportional：依 process 大小
    S.pr = [bx('10 pages → 4', MC.blue, -4.6, 2.6, 0, 2.2, 0.55, 0.7), bx('127 pages → 57', MC.green, -2.1, 2.6, 0, 2.4, 0.55, 0.7)];
    sm('proportional（課本例：62 frames）：10/137×62 ≈ 4、127/137×62 ≈ 57', -3.4, 1.9);
    cap('或 proportional：依 process 的大小比例', '事先知道它的 memory size，照比例分');
  },
  async (tok, S) => {                                   // 323.3 priority：run time 依 priority 決定
    S.r = bx('priority allocation', MC.lilac, 3.4, 5.8, 0, 3.4, 0.6, 0.8); sm('run time 才決定，依 priority', 3.4, 5.15);
    cap('另一大類：priority allocation', '在 run time 才決定，根據每個 process 的 priority');
  },
  async (tok, S) => {                                   // 355.9 priority 高給多一點；run time 可調
    S.hi = buddy('高 priority', '', MC.orange, 2.2, 2.6, 0, 0.6); S.lo = buddy('低', '', MC.gray, 4.6, 2.6, 0, 0.5);
    S.hf = [0, 1, 2, 3].map((i) => bx('', MC.orange, 1.6 + i * 0.4, 2.0, 0, 0.35, 0.35, 0.4)); bx('', MC.gray, 4.6, 2.0, 0, 0.35, 0.35, 0.4);
    sm('priority 在 run time 可以調（跑太久就降）', 3.4, 1.2);
    cap('priority 高的通常比較重要，給多一點', 'priority 在 run time 可以調整，例如跑太久就降低');
  },
]);

scene('vm-14d-global', 'Local vs global replacement', CAM, [
  async (tok, S) => {                                   // 389.6 另一個角度：local vs global
    S.A = [0, 1, 2].map((i) => bx('A' + i, MC.blue, -4.6 + i * 0.9, 4.6, 0, 0.8, 0.6, 0.7)); S.B = [0, 1, 2].map((i) => bx('B' + i, MC.green, 1.6 + i * 0.9, 4.6, 0, 0.8, 0.6, 0.7));
    sm('process A 的 frame', -3.7, 5.3); sm('process B 的 frame', 2.5, 5.3);
    S.na = pkt('A 的新 page', MC.blue, -3.7, 6.4, 0.6, 1.6);
    cap('另一個分類角度', 'local 跟 global');
  },
  async (tok, S) => {                                   // 408.6 local：只能換自己的
    glow(S.A[0], NG); hd('local：只能換掉自己的 page（常跟 fixed 綁）', -1.0, 3.6);
    cap('local：一個 process 要做 page replacement', '只能替換掉它自己的 page，通常跟 fixed 綁在一起');
  },
  async (tok, S) => {                                   // 426.2 要 100 只給 10：自己去搶那 10 個
    sm('要 100 個卻只給 10 個：就只能在這 10 個裡搶（示意）', -1.0, 3.0);
    cap('你要 100 個，我只給你 10 個', '那就自己在那 10 個位置裡搶');
  },
  async (tok, S) => {                                   // 446.4 事前不知道行為 → 效果差
    bad('程式行為變異大，事前決定的效果通常很差', -1.0, 2.4);
    cap('local 或 fixed 一定不好', '事前不知道程式的行為，變異性又很高');
  },
  async (tok, S) => {                                   // 457.2 global：從任何 process 挑 victim
    glow(S.A[0], null); glow(S.B[1], NG); hd('global：victim 可以是任何 process 的 page', -1.0, 1.6);
    cap('global：不限制你只能用自己的', '挑 victim 時，任何程式的 page 只要沒在用都能換');
  },
  async (tok, S) => {                                   // 477.6 跟 priority 綁：高的搶低的
    await slide(tok, S.B[1], 3.6, 0.4, 0, 600); relabel(S.B[1], 'A3'); tint(S.B[1], MC.blue); await slide(tok, S.B[1], -1.9, 4.6, 0, 700); glow(S.B[1], null);
    cap('通常跟 priority-based allocation 綁在一起', 'priority 高的可以一直搶 priority 低的 frame');
  },
  async (tok, S) => {                                   // 498.2 問題：被搶到連最少都不夠 → 要 minimum
    glow(S.B[0], NG); glow(S.B[2], NG); bad('B 被搶到剩很少：連 minimum 都不夠 → 要設下限', 2.6, 0.6);
    cap('一直搶別人的問題', '最小的那個可能連 6 個 frame 都沒有：所以要有 minimum 限制');
  },
  async (tok, S) => {                                   // 515.3 更重要：thrashing
    hot('更重要：frame 很少時會 thrashing', 0, 6.9);
    cap('更重要的是接下來的 thrashing', 'frame 很少時跑得非常非常慢，CPU 幾乎沒在用');
  },
  async (tok, S) => {                                   // 541.8 一般用 global + priority
    good('一般：global + priority（但要解決 thrashing）', 0, -0.2);
    cap('一般一定是用 global 加 priority', '但它要解決接下來的 thrashing 問題');
  },
]);

scene('vm-14d-thrash', 'Thrashing：paging 比執行還久', CAM, [
  async (tok, S) => {                                   // 564.8 thrashing 來自 page fault
    S.cpu = prop('cpu', -4.6, 4.2, 0, 1.0, 'CPU'); S.disk = prop('disk', 4.6, 4.0, 0, 1.0, 'disk');
    cap('thrashing 是什麼？', '因為有 page fault 產生');
  },
  async (tok, S) => {                                   // 574.8 page 不在 → access disk 很慢
    const p = pkt('page', MC.blue, 4.6, 5.2, 0.6, 1.0); await slide(tok, p, -3.4, 5.2, 0.6, 1400); gone(p);
    cap('page 不在 memory 就要 access disk', 'access disk 很慢');
  },
  async (tok, S) => {                                   // 585.0 CPU 等 I/O，不能 overlap
    S.zz = bad('CPU 只能等：這個 instruction 需要這個 page', -4.6, 6.2);
    cap('page 搬進來之前 CPU 不能動', 'page fault 發生在 instruction 執行中，沒辦法 overlap，一定要等');
  },
  async (tok, S) => {                                   // 622.7 page fault 很頻繁 → 很多 I/O
    for (let i = 0; i < 3; i++) { const p = pkt('page', MC.orange, 4.6, 5.2, 0.6, 1.0); await slide(tok, p, -3.4, 5.2 - i * 0.1, 0.6, 500); gone(p); }
    cap('page fault 非常頻繁時', '就會有非常多的 I/O');
  },
  async (tok, S) => {                                   // 638.0 之前：degree 越高越好
    gone(S.zz); S.ax = axes(-4.6, 0.0, 9.0, 3.2, 'degree of multiprogramming', 'CPU 使用率');
    S.up = poly([[-4.6, 0.2], [-3.0, 1.4], [-1.4, 2.3], [0.2, 2.9]], '#2f8f5b');
    cap('之前一直教：degree of multiprogramming 越多越好', '可以 overlap CPU 跟 I/O，OS 也喜歡一直增加');
  },
  async (tok, S) => {                                   // 653.3 一直增加 → 每人 frame 減少 → fault 上升
    sm('process 一多：每人分到的 frame 變少 → page fault rate 上升', 0.4, 3.9);
    cap('一直增加，大家分到的 frame 一直減少', 'page fault rate 開始增加：剛 access 的 page 很容易被踢掉');
  },
  async (tok, S) => {                                   // 667.0 CPU 等 I/O → 使用率掉下去
    S.dn = poly([[0.2, 2.9], [1.2, 3.0], [2.0, 2.4], [2.6, 0.6], [3.6, 0.2]], '#c0392b');
    bad('thrashing', 2.9, 1.9);
    cap('CPU 都在等 I/O，開始 idle', '使用率整個掉下去，而且很嚴重、很迅速');
  },
  async (tok, S) => {                                   // 697.0 定義：paging 時間 > execution
    hd('定義：花在 paging 的時間 > 執行 user instruction 的時間', 0, 6.7);
    cap('thrashing 的定義就一句話', '系統花在 paging（I/O 搬 page）的時間超過 execution');
  },
  async (tok, S) => {                                   // 720.9 一定觀察到 CPU 使用率嚴重下降
    note('觀察得到：degree of multiprogramming 很高，CPU 使用率卻嚴重往下掉', 0, -0.9);
    cap('而且一定會觀察到', 'degree 很高，CPU 使用率卻嚴重往下掉');
  },
]);

scene('vm-14d-cycle', 'Thrashing 的惡性循環', CAM, [
  async (tok, S) => {                                   // 735.4 為什麼掉這麼快：惡性循環
    hd('為什麼 CPU 使用率掉得這麼快？', 0, 6.8);
    S.C = cycle(['① page fault 增加', '② I/O 增加、CPU idle', '③ OS 以為 degree 太低', '④ 加 process 進來', '⑤ 每人 frame 更少'], 0, 3.1, 2.3, MC.paper);
    S.C.bs.forEach((b) => (b.visible = false)); S.C.as.forEach((a) => (a.visible = false));
    cap('它不是慢慢掉，而是極速往下', '因為進入了一個惡性循環');
  },
  async (tok, S) => {                                   // 751.3 一開始有些 page fault，degree 增加機率上升
    S.C.bs[0].visible = true; glow(S.C.bs[0], NG);
    cap('一開始產生了一些 page fault', 'degree of multiprogramming 一直增加，機率一直往上升');
  },
  async (tok, S) => {                                   // 764.8 fault → I/O → CPU idle
    S.C.as[0].visible = true; S.C.bs[1].visible = true; glow(S.C.bs[1], NG);
    cap('page fault 產生 I/O 的動作', 'CPU 開始 idle，使用率往下掉');
  },
  async (tok, S) => {                                   // 776.2 OS 以為 degree 太低
    S.C.as[1].visible = true; S.C.bs[2].visible = true; S.os = buddy('OS', '', MC.orange, 4.6, 5.2, 0, 0.5); S.os.mood('wow');
    cap('OS 自以為很聰明：看到 CPU 往下掉', '以為是 degree of multiprogramming 太低');
  },
  async (tok, S) => {                                   // 791.3 增加 degree，讓更多 process 進 ready queue
    S.C.as[2].visible = true; S.C.bs[3].visible = true;
    cap('所以增加 degree of multiprogramming', '讓更多 process 進入 ready queue，希望 overlap CPU 跟 I/O');
  },
  async (tok, S) => {                                   // 802.4 新 process 要 frame，跟原來的搶
    S.C.as[3].visible = true; S.C.bs[4].visible = true; glow(S.C.bs[4], NG);
    cap('新的 process 需要 frame 才能 run', '它們跟原來的 process 競爭 frame');
  },
  async (tok, S) => {                                   // 823.9 每人更少 → fault 更多 → 回到第一步
    S.C.as[4].visible = true; for (let r = 0; r < 2; r++) for (const b of S.C.bs) { glow(b, HL); await wt(tok, 120); glow(b, NG); }
    cap('每人 frame 更少 → page fault 更多', 'I/O 更長、CPU 掉更兇：又回到第一步');
  },
  async (tok, S) => {                                   // 851.0 像懸崖一樣掉下去
    bad('像懸崖一樣直接掉下去：I/O 時間遠大於 CPU', 0, -0.2);
    cap('所以才會看見它像 cliff 一樣', '直接掉下去，I/O 遠大於 CPU，系統幾乎不動');
  },
  async (tok, S) => {                                   // 884.8 解法：控制 frame 數／degree
    S.os.mood('calm'); good('解法：控制 frame 數／degree → working set、page-fault frequency', 0, -0.8);
    cap('怎麼解決？控制正確的 frame 數量', '介紹兩個 solution：working set、page-fault frequency');
  },
]);

scene('vm-14d-ws', 'Working set 的概念', CAM, [
  async (tok, S) => {                                   // 925.9 working set：跟著 locality
    hd('working set：從 locality 出發', 0, 6.7);
    cap('working set', '概念是從 locality 的角度開始思考');
  },
  async (tok, S) => {                                   // 937.9 一段 window 內用了多少 page
    S.ref = [1, 2, 1, 5, 2, 1, 7, 2, 5, 1, 3, 4, 3, 3, 4, 4, 3, 4, 4, 3];
    S.rs = S.ref.map((p, i) => cube(String(p), pc(p), [0.46, 0.46, 0.46], -5.7 + i * 0.6, 4.6, 0));
    S.win = P.ghostBox('#4b9ee2', 0.6 * 10, 0.8, 0.8); S.win.position.set(-5.7 + 4.5 * 0.6, 4.6, 0);
    sm('一段 time window 裡（示意）', -2.2, 5.4);
    cap('給一段時間（window）', '算這段時間內，這個 process 用了多少個 page');
  },
  async (tok, S) => {                                   // 954.2 用了幾個就給幾個 frame
    const w = [...new Set(S.ref.slice(0, 10))].sort((a, b) => a - b); S.n = good('用到 {' + w.join(', ') + '} → 給 ' + w.length + ' 個 frame', -2.2, 3.6);
    cap('它用了幾個，就給它幾個 frame', '給多了它也不會用，給少了就可能 page fault');
  },
  async (tok, S) => {                                   // 972.2 locality 隨時間改變
    await anim(tok, 1000, (u) => { S.win.position.x = -5.7 + 4.5 * 0.6 + 10 * 0.6 * u; });
    const w = [...new Set(S.ref.slice(10, 20))].sort((a, b) => a - b); gone(S.n); S.n = good('換到另一段 locality：{' + w.join(', ') + '}（size 也變了）', 2.4, 3.6);
    cap('locality 會隨時間改變', '先 access 某個 array，再換到另一個、或 function code');
  },
  async (tok, S) => {                                   // 1017.8 定義 Δ，數 working set size
    hd('Δ = window 大小；WSS = window 內不同 page 的個數', 0, 2.4);
    cap('working set model：先定義 time window Δ', '再數這段時間內有多少個不同的 page（WSS）');
  },
  async (tok, S) => {                                   // 1039.4 每支程式都算，照這個分配
    note('每支程式都算出 WSS，照這個分配 frame', 0, 1.6);
    cap('每支程式的 size 都算出來', '就照這個去分配；真的不夠再按比例');
  },
]);

scene('vm-14d-wsex', 'Working set 例子：Δ = 10', CAMW, [
  async (tok, S) => {                                   // 1059.5 實際是時間，但簡化成數次數
    S.rs = WSREF.map((p, i) => cube(String(p), pc(p), [0.42, 0.42, 0.42], -6.25 + i * 0.5, 4.6, 0));
    sm('page reference table（課本圖）', -4.0, 5.5);
    cap('實際上是時間', '但通常為了簡單，只看順序：數最近多少個 memory access');
  },
  async (tok, S) => {                                   // 1080.2 保留過去 10 個
    S.win = P.ghostBox('#4b9ee2', 0.5 * 10, 0.75, 0.75); S.win.position.set(-6.25 + 4.5 * 0.5, 4.6, 0);
    S.d = hd('Δ = 10', -6.25 + 4.5 * 0.5, 3.8);
    cap('系統一直跑，就一直保留過去 10 個記錄', '這個 Δ 就是 window');
  },
  async (tok, S) => {                                   // 1090.9 t1：1 2 5 6 7 → WSS = 5
    const w = [...new Set(WSREF.slice(0, 10))].sort((a, b) => a - b);
    S.t1 = hot('t1', -6.25 + 9 * 0.5 + 0.25, 5.4);
    S.ws1 = good('WS(t1) = {' + w.join(', ') + '} → WSS = ' + w.length, -3.0, 2.8);
    cap('t1 時，過去 10 個出現的 page', '是 ' + w.join(' ') + '：working set size 是 ' + w.length);
  },
  async (tok, S) => {                                   // 1106.2 換到另一個 locality：page、size 都不同
    await anim(tok, 1200, (u) => { S.win.position.x = -6.25 + 4.5 * 0.5 + 16 * 0.5 * u; S.d.position.x = S.win.position.x; });
    const w = [...new Set(WSREF.slice(16, 26))].sort((a, b) => a - b);
    S.t2 = hot('t2', -6.25 + 25 * 0.5 + 0.25, 5.4);
    S.ws2 = good('WS(t2) = {' + w.join(', ') + '} → WSS = ' + w.length, 3.0, 2.8);
    cap('隨時間進到另一個 locality', '不只 page 不同，size 也不同：5 變 ' + w.length);
  },
  async (tok, S) => {                                   // 1118.2 OS 隨時觀察，設到最適合
    note('OS 要隨時觀察，把每個 process 的 frame 數設到最適合的值', 0, 1.6);
    cap('所以 OS 要隨時去觀察', '設定到最適合的一個值：這就是 working set');
  },
]);

scene('vm-14d-wsd', 'D = Σ WSSi 與 m', CAM, [
  async (tok, S) => {                                   // 1130.0 寫成 algorithm：WSSi
    hd('寫成 algorithm', 0, 6.8);
    S.ps = [['P1', 5], ['P2', 2], ['P3', 4]].map(([n, w], i) => ({ b: buddy(n, '', [MC.blue, MC.green, MC.purple][i], -4.6 + i * 2.2, 4.2, 0, 0.55), t: sm('WSS' + (i + 1) + ' = ' + w, -4.6 + i * 2.2, 3.7) }));
    sm('（數字示意）', 4.0, 4.4);
    cap('第一：定義 WSSi', '第 i 個 process 的 working set size');
  },
  async (tok, S) => {                                   // 1143.8 每個 process 不同；加總 D
    S.D = bx('D = Σ WSSi = 5 + 2 + 4 = 11', MC.sand, -1.0, 2.6, 0, 5.0, 0.6, 0.8);
    cap('每個 process 都不同，全部加總', 'D 就是總共需要的 frame 數：都夠才不會 page fault');
  },
  async (tok, S) => {                                   // 1171.5 m：可用 frame 數
    S.m = bx('m = 可用 frame 數 = 10', MC.mint, -1.0, 1.8, 0, 5.0, 0.6, 0.8);
    cap('小 m 是真的 available 的 frame 數', '也就是 physical memory 的 size');
  },
  async (tok, S) => {                                   // 1188.7 D > m → thrashing 危險
    glow(S.D, NG); S.w = bad('D > m：有人會 page fault → thrashing 的危險！', 3.4, 2.2);
    cap('OS 算出 D 跟 m 比', 'D 比較大：知道現在有 thrashing 的危險');
  },
  async (tok, S) => {                                   // 1212.1 suspend 一個 process（priority 最低）
    const p3 = S.ps[2]; await anim(tok, 900, (u) => { p3.b.g.position.y = 4.2 + 2.4 * u; p3.b.g.position.x = -0.2 + 5.0 * u; });
    p3.b.mood('sad'); txt(p3.t, 'P3 suspend（swap 出去）'); relabel(S.D, 'D = 5 + 2 = 7 ≤ m'); glow(S.D, OKG); gone(S.w);
    cap('OS 去 suspend 一個 process', '例如 priority 最低的，整個 swap 到 disk：讓 D ≤ m');
  },
  async (tok, S) => {                                   // 1244.8 m ≫ D → 啟動新的 process
    good('反過來 m ≫ D：frame 空著 → 啟動新的或恢復被 suspend 的 process', 0, 0.8);
    cap('相反的，m 遠大於 D', 'degree 不夠：挑 priority 高的 process 重新 active，CPU 使用率上升');
  },
  async (tok, S) => {                                   // 1294.9 常見錯：只寫一個 WSS
    bad('考試常錯：只寫一個 WSS 是錯的 → 每個 process 都要算、再加總比較', 0, 0.1);
    cap('每年好多同學只寫一個 WSS', '那完全錯：每個 process 都要數，加總後才能控制');
  },
]);

scene('vm-14d-pff', 'Page-fault frequency（PFF）', CAM, [
  async (tok, S) => {                                   // 1329.2 working set 可解決，CPU 使用率高
    hd('working set：有效，但很 expensive', 0, 6.8);
    cap('working set 可以明顯解決這個問題', '通常能讓 CPU 使用率達到很高');
  },
  async (tok, S) => {                                   // 1338.0 缺點：每次 access 都要 counting
    bad('每次 memory access 都要 count → overhead 很高', 0, 6.2);
    cap('缺點是 expensive，實作不容易', '每個 memory access 都要加 counter，overhead 很高');
  },
  async (tok, S) => {                                   // 1384.3 另一個做法：page-fault frequency
    S.ax = axes(-4.6, 0.4, 8.6, 4.4, '分到的 frame 數', 'page fault rate');
    const pts = []; for (let k = 0; k <= 16; k++) { const x = -4.4 + k * 0.5; pts.push([x, 0.6 + 4.0 * Math.exp(-k / 4)]); }
    S.cv = poly(pts, '#8d6b3a');
    cap('另一個比較直覺的做法', '從 page fault 的角度：rate 太高就代表在 thrashing');
  },
  async (tok, S) => {                                   // 1401.3 monitor 每個 process 的 rate，控制在範圍
    S.ub = line(-4.6, 3.0, 4.0, 3.0, 0, '#c0392b'); S.lb = line(-4.6, 1.2, 4.0, 1.2, 0, '#2f8f5b');
    sm('upper bound', 4.8, 3.0); sm('lower bound', 4.8, 1.2);
    cap('monitor 每個 process 的 page fault rate', '控制在一個範圍中間（例如 10%、5%）');
  },
  async (tok, S) => {                                   // 1425.5 為什麼不是 0%
    sm('太低（接近 0）：frame 太多閒著，degree 不夠', 0.8, 0.9);
    cap('為什麼不是 0%？', '0% 代表給了太多 free frame，degree of multiprogramming 不夠');
  },
  async (tok, S) => {                                   // 1446.7 upper／lower bound
    cap('所以有 upper bound 跟 lower bound', '在範圍中間表現通常最理想，這是 tune 出來的');
  },
  async (tok, S) => {                                   // 1474.7 overhead 小：只在 page fault 時 +1
    good('只要在 page fault 時把 counter + 1：overhead 很小', 0, 5.5);
    cap('跟 working set 的大差別', '只要數 page fault 的 event：OS 本來就要處理，順便 +1');
  },
  async (tok, S) => {                                   // 1515.7 超過上界給 frame；低於下界收回
    S.hi = cube('P1', MC.red, [0.4, 0.4, 0.4], -3.4, 3.5, 0.3); S.lo = cube('P2', MC.green, [0.4, 0.4, 0.4], 2.6, 0.9, 0.3);
    sm('超過上界 → 多給 frame', -2.0, 4.0); sm('低於下界 → 收回 frame 給別人', 2.6, 1.6);
    await anim(tok, 900, (u) => { S.hi.position.x = -3.4 + 2.4 * u; S.hi.position.y = 3.5 - 1.3 * u; });
    cap('rate 太高的 process frame 不夠：給它 frame', 'frame 從 rate 太低的人身上拿：做 balancing');
  },
  async (tok, S) => {                                   // 1552.8 frame 增加 fault 一定減少（stack algorithm）
    note('frame 增加 → page fault 一定減少（因為用 stack algorithm，沒有 anomaly）', 0, -0.4);
    cap('frame 增加 page fault 一定減少', '這就是為什麼不能有 anomaly：要 follow stack algorithm');
  },
]);

scene('vm-14d-rel', 'Working set 與 PFF 的關係', CAM, [
  async (tok, S) => {                                   // 1586.7 兩個方法解決同一個問題
    hd('working set 與 page-fault frequency：同一件事的兩面', 0, 6.8);
    cap('兩種方式在解決同一個問題', '所以相關性非常高');
  },
  async (tok, S) => {                                   // 1600.2 時間軸上 rate 有高有低
    S.ax = axes(-5.4, 0.6, 10.6, 4.4, '時間', 'page fault rate');
    const pts = []; for (let k = 0; k <= 60; k++) { const x = -5.2 + k * 0.17; const ph = (k % 20) / 20; pts.push([x, 1.0 + (ph < 0.15 ? 3.4 * Math.sin((ph / 0.15) * Math.PI) : 0.15)]); }
    S.cv = poly(pts, '#8d6b3a'); sm('（曲線示意）', 3.8, 5.4);
    cap('以時間的角度看', 'page fault rate 有時高、有時低');
  },
  async (tok, S) => {                                   // 1607.2 進入新 locality 時升高
    hot('進入新的 locality → rate 升高（peak）', -1.8, 5.4);
    cap('什麼時候會高？', '進入一個新的 locality，要重新算 working set 的時候');
  },
  async (tok, S) => {                                   // 1619.0 兩個 peak 之間就是一個 working set
    S.span = P.ghostBox('#2fc092', 3.0, 3.6, 0.4); S.span.position.set(-5.2 + 20 * 0.17 / 2 + 0.25, 2.6, 0);
    sm('兩個 peak 之間：一個 working set', -3.0, 0.2);
    cap('兩個 peak 之間', '就是一段 working set；working set 在 rate 往上衝時更新 size，PFF 在超過上界時調整');
  },
  async (tok, S) => {                                   // 1660.9 working set 較少用；PFF 較多
    good('實務：working set 的 implementation overhead 高 → 大多觀察 page fault', 0, -0.5);
    cap('重點是 locality 會改變', 'working set 較少用：大家多半觀察 page fault rate');
  },
]);

// ════════ DXU7SqsYDvg（LRU 與 Optimal 例題：19 個 reference、3 個 frame） ════════
const R19 = [3, 2, 1, 3, 4, 1, 6, 2, 4, 3, 4, 2, 1, 4, 5, 2, 1, 3, 4];
const G19 = (alg, name) => rgrid(R19, 3, alg, { dx: 0.68, cs: 0.5, y: 6.0, name, view: 'slots', hits: true, slotNames: ['f1', 'f2', 'f3'] });
// one step = the next reference (or n of them)
const nx = (n, a, b) => async (tok, S) => { await S.G.go(tok, n); cap(a, b); };
scene('vm-ex-lru', 'LRU 例題：14 次 page fault', CAMW, [
  async (tok, S) => {                                   // 0.0 同一個例子：reference string
    S.G = G19('lru', 'LRU'); sm('reference string', -4.8, 6.75);
    cap('跟 FIFO 那集同一個例子', 'reference string：CPU 依序要 page 3、2、1 …');
  },
  async (tok, S) => {                                   // 14.8 3 個 frame；求 page fault 與 hit ratio
    hd('3 個 frame', 4.8, 6.75);
    cap('給 3 個 frame，用 LRU', '求 page fault 次數，還有 hit ratio');
  },
  async (tok, S) => {                                   // 27.5 frame 全空時也算 page fault
    sm('frame 全空時進來的，也算 page fault', 0, 1.3);
    cap('題目也可能加一個條件', 'frame 一開始全空，放進去也算 page fault');
  },
  async (tok, S) => {                                   // 42.3 LRU：替換最久沒用的
    note('LRU：換掉最久沒被用到的 page', 0, 0.7);
    cap('LRU：least recently used', '換掉最長一段時間沒被用到的 page');
  },
  nx(1, '先要 page 3：沒有 → page fault', '放進 f1'),                                   // 64.2
  nx(1, 'page 2：只有 3 在 → page fault', '把 2 load 進來'),                             // 92.6
  nx(1, 'page 1：還有空的 frame', '放進去，一樣是 page fault'),                          // 113.8
  nx(1, 'page 3：已經在 frame 裡', '這是一次 hit'),                                     // 126.7
  async (tok, S) => {                                   // 133.9 4：miss，frames 全滿
    S.q = hot('4：miss，3 個 frame 全滿', S.G.x(4), 1.9);
    cap('下一個是 4：不在 → miss', '3 個 frame 都滿了，放不下');
  },
  async (tok, S) => {                                   // 143.5 OS 選一個 page swap out
    sm('選一個 swap out 到 secondary memory，4 swap in', S.G.x(4), 1.4);
    cap('OS 要選一個 page swap out', '換成 4 swap in；選誰由 LRU 決定');
  },
  async (tok, S) => {                                   // 184.5 trick：從右往左看 → 2 最久沒用
    gone(S.q); S.tr = arrow(V3(S.G.x(3), 6.55, 0.3), V3(S.G.x(0), 6.55, 0.3));
    await S.G.go(tok, 1);
    cap('技巧：從 4 往左看 reference string', '先看到 3、再 1、最後才是 2：2 最久沒用，換掉 2');
  },
  nx(1, 'page 1：在 → hit', '3 4 1'),                                                   // 227.7
  nx(1, 'page 6：miss', '往左看 1、4、3：最左的是 3，換掉 3'),                           // 235.3
  nx(1, 'page 2：miss', '最近是 6、再來 1、最左的是 4：換掉 4'),                         // 270.2
  nx(1, 'page 4：miss', '6 2 1 中最左的是 1：換掉 1'),                                   // 290.9
  nx(1, 'page 3：miss', '4、2、6 中最左的是 6：換掉 6'),                                 // 315.3
  nx(1, 'page 4：在 → hit', '3 2 4'),                                                   // 339.6
  nx(1, 'page 2：在 → hit', '3 2 4'),                                                   // 344.2
  nx(1, 'page 1：miss', '往左看 2、4、3：換掉 3'),                                       // 347.0
  nx(1, 'page 4：在 → hit', '1 2 4'),                                                   // 368.6
  nx(1, 'page 5：miss', '4、1、2 中最左的是 2：換掉 2'),                                 // 371.2
  nx(1, 'page 2：miss', '5、4、1 中最左的是 1：換掉 1'),                                 // 384.7
  nx(1, 'page 1：miss', '2、5、4 中最左的是 4：換掉 4'),                                 // 398.2
  nx(1, 'page 3：miss', '1、2、5 中最左的是 5：換掉 5'),                                 // 405.5
  nx(1, 'page 4：miss', '3、1、2 中最左的是 2：換掉 2'),                                 // 417.6
  async (tok, S) => {                                   // 431.2 數：14 次
    gone(S.tr); good('LRU：page fault = ' + S.G.faults + ' 次', -2.6, 0.7);
    cap('數一數 page fault', '1 到 ' + S.G.faults + '：共 ' + S.G.faults + ' 次');
  },
  async (tok, S) => {                                   // 439.3 hit ratio = 5/19
    good('hit ratio = ' + S.G.hits + ' / ' + R19.length, 1.4, 0.7);
    cap('hit ratio：hit 有 ' + S.G.hits + ' 次', '除以總共 ' + R19.length + ' 次：' + S.G.hits + '/' + R19.length);
  },
  async (tok, S) => {                                   // 461.3 miss ratio = 14/19
    bad('miss ratio = ' + S.G.faults + ' / ' + R19.length + ' = 1 − ' + S.G.hits + '/' + R19.length, 0, 0.1);
    cap('miss ratio', S.G.faults + '/' + R19.length + '，也就是 1 − ' + S.G.hits + '/' + R19.length);
  },
]);

scene('vm-ex-opt', 'Optimal 例題：10 次 page fault', CAMW, [
  async (tok, S) => {                                   // 479.2 用 optimal 解同一題
    S.G = G19('opt', 'OPT'); sm('reference string', -4.8, 6.75);
    cap('同一題，改用 optimal', '看會有幾次 page fault');
  },
  async (tok, S) => {                                   // 495.4 換掉未來最久不會用的
    note('OPT：換掉未來最久不會被用到的 page（看未來）', 0, 0.7);
    cap('criteria：換掉 near future 不會用的', '未來最長一段時間不會用到的 page');
  },
  async (tok, S) => {                                   // 517.9 3、2、1：miss
    await S.G.go(tok, 3, 300);
    cap('3、2、1 都不在', '三次 miss，frame 全滿了');
  },
  nx(1, 'page 3：在 → hit', '3 2 1'),                                                   // 529.0
  async (tok, S) => {                                   // 536.3 4：miss，要選 victim
    S.q = hot('4：miss，要選 victim', S.G.x(4), 1.9);
    cap('4 不在 → miss', '哪一個要被選成 victim？');
  },
  async (tok, S) => {                                   // 560.3 往右看未來：3 最遠
    gone(S.q); S.tr = arrow(V3(S.G.x(5), 6.55, 0.3), V3(S.G.x(9), 6.55, 0.3));
    await S.G.go(tok, 1);
    cap('從 4 往右看未來', '先是 1、再來 2、3 最晚：選 3 當 victim');
  },
  nx(1, 'page 1：在 → hit', '4 2 1'),                                                   // 631.3
  nx(1, 'page 6：miss', '往右看 2、4、1：1 最右邊 → 換掉 1'),                            // 639.7
  nx(2, 'page 2、page 4：都在', '兩次 hit'),                                            // 657.3
  nx(1, 'page 3：miss', '4、2 之後都會用，6 再也不會用：換掉 6'),                         // 668.4
  nx(1, 'page 4：在 → hit', '4 2 3'),                                                   // 692.4
  nx(1, 'page 2：在 → hit', '4 2 3'),                                                   // 697.3
  nx(1, 'page 1：miss', '往右看 4、2、3：3 最右 → 換掉 3'),                              // 706.7
  nx(1, 'page 4：在 → hit', '1 2 4'),                                                   // 721.7
  nx(1, 'page 5：miss', '2、1、4 中 4 最右：換掉 4'),                                    // 725.6
  nx(1, 'page 2：在 → hit', '5 2 1'),                                                   // 739.8
  nx(1, 'page 1：在 → hit', '5 2 1'),                                                   // 743.8
  async (tok, S) => {                                   // 746.2 3：miss；5 2 1 以後都不會用
    S.q = hot('3：miss；5、2、1 以後都不會再用', S.G.x(14), 1.9);
    cap('3 不在 → miss', '5、2、1 以後都不會再被要求：換誰都可以');
  },
  async (tok, S) => {                                   // 775.4 這時用 FIFO：最早進來的是 2
    gone(S.q); S.ff = sm('平手 → 用 FIFO：最早進來的是 2', S.G.x(14), 1.9);
    await S.G.go(tok, 1);
    cap('這種情況就套 FIFO', '三個裡最早進來的是 2：換掉 2');
  },
  async (tok, S) => {                                   // 801.0 4：沒有未來 → FIFO 換 1
    gone(S.ff); sm('又沒有未來 → FIFO：換掉 1', S.G.x(14), 1.9);
    await S.G.go(tok, 1);
    cap('4 也是 miss，後面沒有 request 了', '一樣用 FIFO：5、3、1 裡最早進來的是 1');
  },
  async (tok, S) => {                                   // 821.3 10 次 page fault、9 次 hit
    gone(S.tr); good('OPT：page fault ' + S.G.faults + ' 次，hit ratio ' + S.G.hits + '/' + R19.length, 0, 0.1);
    cap('page fault 共 ' + S.G.faults + ' 次', 'hit ' + S.G.hits + ' 次：hit ratio ' + S.G.hits + '/' + R19.length + '、miss ratio ' + S.G.faults + '/' + R19.length);
  },
  async (tok, S) => {                                   // 849.6 最好，但無法 implement
    S.G.clear();
    hd('optimal：page fault 最少，但無法 implement（要預測未來）', 0, 6.4);
    cap('optimal 給你最少的 page fault', '但要預測未來，幾乎不可能實作');
  },
  async (tok, S) => {                                   // 873.9 benchmark
    sm('用途：benchmark，拿來跟其他演算法比較', 0, 5.7);
    cap('那它有什麼用？benchmark', '當標準，比較其他 replacement 演算法的好壞');
  },
  async (tok, S) => {                                   // 897.6 FIFO 13、LRU 14、OPT 10
    const rows = [['FIFO', 'fifo', MC.orange], ['LRU', 'lru', MC.blue], ['OPT', 'opt', MC.green]];
    S.bars = rows.map(([n, a, c], i) => { const f = vmFaults(R19, 3, a); const b = bx(n + '：' + f + ' 次（hit ' + (R19.length - f) + '/' + R19.length + '）', c, -4.0 + f * 0.25, 4.6 - i * 0.8, 0, f * 0.5, 0.6, 0.7); return b; });
    cap('同一串的比較', 'FIFO ' + vmFaults(R19, 3, 'fifo') + '、LRU ' + vmFaults(R19, 3, 'lru') + '、optimal ' + vmFaults(R19, 3, 'opt'));
  },
  async (tok, S) => {                                   // 916.8 不能說 FIFO 比較好
    note('這一串 FIFO 比 LRU 少，但換一串可能相反；OPT 一定最少', 0, 1.8);
    cap('不能因此說 FIFO 比 LRU 好', '換一串可能相反；只有 optimal 一定最少');
  },
]);

// ════════ Nif2TZ5Cohw（Page Faults & Page Fault Handling，含 Thrashing） ════════
scene('vm-pf-what', 'Process A 與 page fault', CAM, [
  async (tok, S) => {                                   // 41.3 process A 分成 4 個 page
    hd('process A', -4.4, 6.6);
    S.pg = ['P1', 'P2', 'P3', 'P4'].map((n, i) => bx(n, pc(i + 1), -4.4, 5.8 - i * 0.65, 0, 1.4, 0.55, 0.7));
    cap('process A 很大，page size 很小', '所以切成 4 個 page：P1、P2、P3、P4');
  },
  async (tok, S) => {                                   // 61.1 virtual memory 切 page，main memory 切 frame
    hd('main memory（frames）', 1.6, 6.6); S.fr = [0, 1, 2, 3].map((i) => bx('frame', MC.paper, 1.6, 5.8 - i * 0.65, 0, 1.4, 0.55, 0.7));
    sm('page 大小 = frame 大小', -1.4, 3.2);
    cap('virtual memory 切成 pages', 'main memory 切成 frames，page 跟 frame 一樣大');
  },
  async (tok, S) => {                                   // 71.7 page fault：要的 page 不在 main memory
    S.disk = prop('disk', 5.4, 0.6, 0, 1.0, 'secondary storage'); [0, 1, 3].forEach((i, k) => { relabel(S.fr[k], ['P1', 'P2', 'P4'][k]); tint(S.fr[k], pc(i + 1)); });
    await slide(tok, S.pg[2], 5.4, 2.2, 0, 800); bad('P3 不在 main memory → page fault', 0, 1.6);
    cap('page fault：要執行的 page 不在 main memory', '它在 secondary storage（virtual memory）裡');
  },
  async (tok, S) => {                                   // 86.0 secondary storage 留空間放 page
    note('在 secondary storage 留一塊空間放 page：main memory 滿了也能「擴充」', 0, 0.6);
    cap('paging 在 secondary storage 留空間', 'main memory 滿了，就把一些 page 放那裡：擴充 main memory');
  },
]);

scene('vm-pf-steps', 'Page fault handling 六步驟', CAMW, [
  async (tok, S) => {                                   // 107.4 CPU 在執行 P2 的 load X
    S.cpu = prop('cpu', -5.8, 5.2, 0, 0.9, 'CPU'); S.ins = bx('P2：load X', pc(2), -5.8, 4.1, 0, 1.8, 0.55, 0.7);
    hd('main memory', 4.0, 6.9);
    S.mem = [['F7', 'P1', pc(1)], ['F8', 'P2', pc(2)], ['F9', 'P4', pc(4)], ['', '✗ 已占用', MC.gray], ['F34', 'free', MC.paper]].map(([f, t, c], i) => { sm(f, 2.9, 6.2 - i * 0.62); return bx(t, c, 4.0, 6.2 - i * 0.62, 0, 1.6, 0.52, 0.7); });
    sm('（F9 為示意）', 5.6, 4.96);
    cap('CPU 正在執行 process A 的 P2', 'P2 裡有一個指令：load X');
  },
  async (tok, S) => {                                   // 119.8 load X 需要 P3 → 發出 request
    S.req = hot('需要 P3', -5.8, 3.3);
    cap('load X 需要 P3', 'CPU 發出要 P3 的 request');
  },
  async (tok, S) => {                                   // 128.8 CPU 不知道 → MMU 查 page table（step 1）
    S.mmu = bx('MMU', MC.teal, -3.2, 4.1, 0, 1.0, 0.6, 0.7);
    S.t = ptable(-0.7, 6.2, [['P1', 'F7', 'v'], ['P2', 'F8', 'v'], ['P3', null, 'i'], ['P4', 'F9', 'v']], { w: 0.85, pcol: (p) => pc(Number(String(p).slice(1))) });
    S.b = bullets(-6.8, 2.4, 0.48); S.b('① MMU 查 page table');
    cap('CPU 不知道 P3 不在 memory', 'MMU 拿 P3 去查 process A 的 page table（step 1）');
  },
  async (tok, S) => {                                   // 167.0 第一欄 page number、第二欄 frame number
    cap('第一欄是 page number', '第二欄是 frame number');
  },
  async (tok, S) => {                                   // 172.0 P3 是 invalid bit
    glow(S.t.cells[2][2], NG); glow(S.t.cells[2][0], HL);
    cap('P3 那一格是 i（invalid bit）', '代表 P3 不在 main memory');
  },
  async (tok, S) => {                                   // 185.4 memory：P1、P2 下面直接是 P4
    S.mem.slice(0, 3).forEach((m) => glow(m, HL)); await wt(tok, 600); S.mem.slice(0, 3).forEach((m) => glow(m, null));
    cap('看 memory：P1、P2，下面直接是 P4', '沒有 P3');
  },
  async (tok, S) => {                                   // 199.5 step 2：page fault → trap signal
    S.os = buddy('OS', '', MC.orange, -3.2, 5.6, 0, 0.5); S.b('② page fault → trap signal 給 OS', 'bad');
    cap('step 2：發生 page fault', '產生一個 page trap signal 給 OS');
  },
  async (tok, S) => {                                   // 228.1 trap：高優先，OS 不能忽略
    S.os.mood('wow');
    cap('trap 是很高優先的 signal', 'OS 不能 preempt、不能忽略，一定要處理');
  },
  async (tok, S) => {                                   // 255.9 step 3：OS 在 secondary storage 找到 P3
    S.disk = prop('disk', 5.6, -0.2, 0, 1.0, 'secondary storage'); S.p3 = bx('P3', pc(3), 5.6, 1.5, 0, 1.0, 0.5, 0.6); glow(S.p3, HL);
    S.b('③ OS 在 secondary storage 找到 P3');
    cap('step 3：OS 到 secondary storage', '在當作 virtual memory 的那塊找到 P3');
  },
  async (tok, S) => {                                   // 282.4 step 4：放進 free frame F34
    glow(S.p3, null); await slide(tok, S.p3, 4.0, 6.2 - 4 * 0.62, 0.5, 900); kill(S.mem[4]); S.b('④ 搬進 free frame：F34');
    cap('step 4：把缺的 page 帶回 main memory', 'F34 是空的（✗ 那塊被占用），P3 載入 F34');
  },
  async (tok, S) => {                                   // 316.9 不連續也沒關係：page table 當 index
    sm('P1、P2 在 F7、F8；P3 在 F34：不連續也沒關係', 4.0, 2.7);
    cap('P1、P2 緊鄰在 F7、F8，P3 卻在 F34', '不連續也沒關係：page table 就像 index');
  },
  async (tok, S) => {                                   // 367.5 step 5：update page table
    S.t.set(2, 'F34', 'v'); glow(S.t.cells[2][2], OKG); S.b('⑤ update page table：P3 → F34');
    cap('step 5：update page table', '填上 P3 所在的 frame：F34');
  },
  async (tok, S) => {                                   // 382.5 step 6：restart load X
    S.b('⑥ restart：重新執行 load X', 'good'); gone(S.req); S.os.mood('happy');
    cap('step 6：restart the instruction', 'CPU 重新執行 load X，這次在 page table 找到 P3');
  },
  async (tok, S) => {                                   // 409.8 如果 P3 本來就在：1 直接到 6
    note('如果 P3 本來就在 F34：step 1 → step 6，不需要 2～5', 0, -0.6);
    cap('如果 P3 原本就在 F34', '就不會 page fault：從 step 1 直接到 step 6');
  },
]);

scene('vm-pf-eat', 'EAT 計算題：91 ms', CAM, [
  async (tok, S) => {                                   // 462.5 小計算題
    hd('page fault 的計算題', 0, 6.8);
    cap('看一個常考的小計算題', '跟 page fault 有關');
  },
  async (tok, S) => {                                   // 475.9 0 ≤ p ≤ 1
    S.p = bx('0 ≤ p（page fault 機率）≤ 1', MC.sand, 0, 6.0, 0, 5.4, 0.6, 0.8);
    cap('第一點：page fault 機率 p', '介於 0 到 1 之間');
  },
  async (tok, S) => {                                   // 501.9 EAT 公式
    S.f = bx('EAT = (1 − p) × memory access + p × page fault overhead', MC.mint, 0, 5.0, 0, 9.0, 0.6, 0.8);
    cap('第二點：effective access time', 'EAT = (1 − p) × memory access + p × page fault overhead');
  },
  async (tok, S) => {                                   // 531.0 overhead = step 2～6 額外時間
    sm('overhead：page fault 時多走 step 2～6 的時間；沒 fault 就 1 → 6', 0, 4.35);
    cap('page fault overhead', '發生 page fault 時，多做 step 2～6 的額外時間');
  },
  async (tok, S) => {                                   // 560.0 題目數字
    S.g = [bx('memory access = 100 ms', MC.tlb, -4.0, 3.4, 0, 3.4, 0.55, 0.7), bx('overhead = 10 ms', '#f3c9c9', 0, 3.4, 0, 2.8, 0.55, 0.7), bx('10 次有 1 次 fault → p = 0.1', MC.sand, 4.2, 3.4, 0, 3.6, 0.55, 0.7)];
    sm('（影片的題目數字）', 0, 2.85);
    cap('題目：memory access 100 ms、overhead 10 ms', '10 次 access 有 1 次 page fault：p = 1/10');
  },
  async (tok, S) => {                                   // 592.4 代入 (1 − 0.1) × 100
    S.s1 = bx('EAT = (1 − 0.1) × 100', MC.mint, -1.6, 2.0, 0, 4.4, 0.55, 0.7);
    cap('代入公式', '(1 − 0.1) × memory access 100');
  },
  async (tok, S) => {                                   // 611.9 單位要統一
    sm('單位要統一（ms、µs、ns 都先換成同一種）', 0, 1.35);
    cap('注意單位', 'ms、µs、ns 都要先換成同一個單位');
  },
  async (tok, S) => {                                   // 619.3 + 0.1 × 10
    S.s2 = bx('+ 0.1 × 10', '#f3c9c9', 2.6, 2.0, 0, 2.2, 0.55, 0.7);
    cap('再加上 p × overhead', '0.1 × 10 ms');
  },
  async (tok, S) => {                                   // 637.8 = 90 + 1 = 91 ms
    S.ans = good('= 0.9 × 100 + 0.1 × 10 = 90 + 1 = 91 ms', 0, 0.5);
    cap('0.9 × 100 = 90，0.1 × 10 = 1', 'EAT = 91 ms');
  },
]);

scene('vm-pf-thrash', 'Thrashing：working set 太大時', CAM, [
  async (tok, S) => {                                   // 660.1 最後：thrashing
    S.ram = zone('RAM（physical memory）', -2.6, 0, 0, 4.6, 3.2); S.vm = zone('virtual memory（disk）', 3.6, 0, 0, 3.6, 3.2);
    cap('最後談 thrashing', '照著理論一句句看');
  },
  async (tok, S) => {                                   // 667.9 初始化後只用少量 code／data pages
    sm('剛啟動：loading 很久；之後只用少量 page', -2.6, 3.4);
    cap('初始化完成後，多數程式', '只用到一小部分的 code 與 data pages（像遊戲先 loading）');
  },
  async (tok, S) => {                                   // 712.5 最常被 access 的 pages = working set
    S.ws = [0, 1].map((i) => bx('WS', MC.blue, -3.6 + i * 1.0, 0.5, 0, 0.9, 0.5, 0.7));
    cap('最常被 access 的那些 pages', '叫做 working set');
  },
  async (tok, S) => {                                   // 724.8 working set 小 → 很少 page fault
    good('working set 小 → 很少 page fault，VM 很有效率', -2.6, 2.6);
    cap('working set 只占總 page 的一小部分', 'virtual memory 最有效率，處理 page fault 的計算很少');
  },
  async (tok, S) => {                                   // 758.8 working set 變大 → RAM 滿，page 來回
    for (let i = 2; i < 8; i++) { S.ws.push(bx('WS', MC.blue, -4.6 + (i % 4) * 1.0, 0.5 + Math.floor(i / 4) * 0.6, 0, 0.9, 0.5, 0.7)); await wt(tok, 120); }
    for (let r = 0; r < 2; r++) { const a = pkt('page', MC.orange, -1.2, 1.6, 0.6, 0.9); await slide(tok, a, 3.6, 1.0, 0.6, 400); await slide(tok, a, -1.2, 1.6, 0.6, 400); gone(a); }
    cap('working set 變大，RAM 被塞滿', '有些 page 被搬到 virtual memory，需要時又搬回來');
  },
  async (tok, S) => {                                   // 789.3 fault 劇增，處理時間壓過運算 → thrashing
    bad('page fault 劇增：處理 fault 的時間壓過運算 → thrashing', 0.4, 4.2);
    cap('page fault 急遽增加', '處理 fault 的時間壓過運算時間：這就叫 thrashing');
  },
  async (tok, S) => {                                   // 814.5 簡單說：失控的 swapping
    note('一句話：因為 page fault，page 在 RAM 與 virtual memory 之間失控地來回 swap', 0.4, 5.0);
    cap('簡單說：thrashing 是 uncontrolled swapping', '因為 page fault，page 在 RAM 跟 VM 之間一直來回');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 8 章',
    title: '虛擬記憶體：Demand Paging、Page Replacement',
    color: 'var(--os)',
    modes: [
      { id: 'replace', name: '置換演算法', enter: enterReplace },
      { id: 'compare', name: '比較與 Belady', enter: enterCompare },
      { id: 'fault', name: 'Page fault 處理', enter: enterFault },
      { id: 'eat', name: 'EAT 計算', enter: enterEat },
      { id: 'wset', name: 'Working set', enter: enterWset },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'demand-paging-valid', 'page-fault-steps', 'eat-page-fault', 'copy-on-write',
      'page-replacement-basic', 'fifo-replace', 'belady-anomaly', 'opt-replace', 'lru-replace', 'lru-stack',
      'additional-ref-bits', 'second-chance-clock', 'enhanced-second-chance',
      'frame-allocation', 'thrashing', 'working-set', 'pff',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
