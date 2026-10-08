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
    ],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
