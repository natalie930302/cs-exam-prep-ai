// 離散數學 第3章：集合與函數（集合運算、文氏圖、排容、冪集合、笛卡兒積、
// 單射／滿射／雙射、合成與反函數、可數與不可數、Cantor 對角線）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（ℕ 在可數性證明中從 1 開始對應；Cantor 對角線用「d ≠ 4 換成 4，否則 5」）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, say, beat } = ctx;
  const on = (id, fn) => ctx.on(id, () => { Promise.resolve().then(fn).catch((e) => { if (!/mode changed/.test(String(e && e.message))) console.error(e); }); });
  let timer = null;
  let epoch = 0; // 換模式／重進模式就 +1，讓還在跑的互動動畫自己停下
  const stopTimer = () => { clearInterval(timer); timer = null; epoch++; };
  let busy = false;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
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
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function line(x1, y1, z1, x2, y2, z2, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function arrow(x1, y1, z1, x2, y2, z2, color = '#6e5f49') {
    const from = V3(x1, y1, z1), dir = V3(x2 - x1, y2 - y1, z2 - z1);
    const len = dir.length(); dir.normalize();
    const a = new THREE.ArrowHelper(dir, from, len, new THREE.Color(color).getHex(), 0.32, 0.2);
    lab.world.add(a); return a;
  }
  const W = (tok) => { const e = epoch; return async (ms) => { if (tok !== undefined) return beat(tok, ms); await sleep(Math.min(ms, 260)); if (e !== epoch) throw new Error('mode changed'); }; };
  async function anim(w, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

  // ───────────────────────── 文氏圖（InstancedMesh 的地磚，塗色 = 升高） ─────────────────────────
  const CIRC = {
    2: [['A', -1.25, 0, 2.5], ['B', 1.25, 0, 2.5]],
    3: [['A', -1.15, 0.8, 2.2], ['B', 1.15, 0.8, 2.2], ['C', 0, -1.15, 2.2]],
  };
  const BASE = new THREE.Color('#e9dcc4');
  function makeVenn(n) {
    const C = CIRC[n], step = 0.3, cells = [];
    for (let x = -5.4; x <= 5.41; x += step) for (let z = -3.6; z <= 3.61; z += step) {
      const m = {}; C.forEach(([nm, cx, cz, r]) => { m[nm] = (x - cx) ** 2 + (z - cz) ** 2 <= r * r; });
      cells.push({ x, z, m, key: C.map(([nm]) => (m[nm] ? nm : '')).join('') || 'U' });
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(step * 0.9, 1, step * 0.9), new THREE.MeshStandardMaterial({ roughness: 0.8 }), cells.length);
    im.castShadow = true; im.receiveShadow = true;
    const h = cells.map(() => 0.06), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    const put = (i, hh) => { S.set(1, hh, 1); P.set(cells[i].x, hh / 2, cells[i].z); M.compose(P, Q, S); im.setMatrixAt(i, M); };
    cells.forEach((_, i) => { put(i, h[i]); im.setColorAt(i, BASE); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    lab.world.add(im);
    C.forEach(([nm, cx, cz, r]) => {
      const pts = []; for (let k = 0; k <= 64; k++) { const t = k / 64 * Math.PI * 2; pts.push(V3(cx + r * Math.cos(t), 0.62, cz + r * Math.sin(t))); }
      lab.world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#6e5f49' })));
      const dx = cx === 0 ? 0 : Math.sign(cx), dz = cz === 0 ? 0 : Math.sign(cz);
      tag(nm, 'ptr', cx + dx * r * 0.72, 0.9, cz + dz * r * 0.72 + (n === 2 ? -r * 0.8 : 0));
    });
    tag('U', 'ptr alt', -5.3, 0.6, -3.5);
    // 每個區域的中心（放數字用）
    const cent = {};
    cells.forEach((c) => { const k = c.key; (cent[k] ||= { x: 0, z: 0, n: 0 }); cent[k].x += c.x; cent[k].z += c.z; cent[k].n++; });
    Object.values(cent).forEach((c) => { c.x /= c.n; c.z /= c.n; });
    if (cent.U) { cent.U.x = 4.6; cent.U.z = 3.1; }
    const V = {
      cells, im, cent,
      async shade(w, fn, color, ms = 500) {
        const col = new THREE.Color(color || '#4b9ee2');
        const tgt = cells.map((c) => (fn(c.m) ? 0.55 : 0.06));
        const h0 = h.slice();
        cells.forEach((c, i) => im.setColorAt(i, tgt[i] > 0.1 ? col : BASE));
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        await anim(w, ms, (t) => { cells.forEach((_, i) => { h[i] = h0[i] + (tgt[i] - h0[i]) * t; put(i, h[i]); }); im.instanceMatrix.needsUpdate = true; });
      },
      async heights(w, countFn, ms = 500) {
        const cols = ['#e9dcc4', '#2fc092', '#dd8238', '#d64545', '#9b7ef4'];
        const tgt = cells.map((c) => 0.06 + 0.42 * Math.max(0, countFn(c)));
        const h0 = h.slice();
        cells.forEach((c, i) => im.setColorAt(i, new THREE.Color(cols[Math.max(0, Math.min(4, countFn(c)))])));
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        await anim(w, ms, (t) => { cells.forEach((_, i) => { h[i] = h0[i] + (tgt[i] - h0[i]) * t; put(i, h[i]); }); im.instanceMatrix.needsUpdate = true; });
      },
    };
    return V;
  }
  const OPS = {
    2: [
      ['A ∪ B', (m) => m.A || m.B], ['A ∩ B', (m) => m.A && m.B], ['A − B', (m) => m.A && !m.B], ['B − A', (m) => m.B && !m.A], ['A ⊕ B', (m) => m.A !== m.B],
      ['Aᶜ', (m) => !m.A], ['(A ∪ B)ᶜ', (m) => !(m.A || m.B)], ['Aᶜ ∩ Bᶜ', (m) => !m.A && !m.B], ['(A ∩ B)ᶜ', (m) => !(m.A && m.B)], ['Aᶜ ∪ Bᶜ', (m) => !m.A || !m.B],
    ],
    3: [
      ['A ∪ B ∪ C', (m) => m.A || m.B || m.C], ['A ∩ B ∩ C', (m) => m.A && m.B && m.C], ['A ∩ (B ∪ C)', (m) => m.A && (m.B || m.C)], ['(A ∩ B) ∪ (A ∩ C)', (m) => (m.A && m.B) || (m.A && m.C)],
      ['A ∪ (B ∩ C)', (m) => m.A || (m.B && m.C)], ['(A ∪ B) ∩ (A ∪ C)', (m) => (m.A || m.B) && (m.A || m.C)], ['A − (B ∪ C)', (m) => m.A && !m.B && !m.C], ['(A ∩ B) − C', (m) => m.A && m.B && !m.C], ['(A ∪ B ∪ C)ᶜ', (m) => !(m.A || m.B || m.C)],
    ],
  };

  // ───────────────────────── Mode 1：文氏圖運算 ─────────────────────────
  const vn = { n: 2, op: 0, V: null };
  function enterVenn() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 9.5, 8.2], [0, 0, 0.3]);
    vn.V = makeVenn(vn.n);
    controls('<select id="vN"><option value="2">兩個集合</option><option value="3">三個集合</option></select><select id="vO">' + OPS[vn.n].map((o, i) => '<option value="' + i + '">' + o[0] + '</option>').join('') + '</select><button class="primary" id="vGo">塗色</button><button id="vClr">清掉</button>');
    $('vN').value = String(vn.n); $('vO').value = String(vn.op);
    $('vN').onchange = (e) => { vn.n = Number(e.target.value) === 3 ? 3 : 2; vn.op = 0; clearLog(); enterVenn(); };
    $('vO').onchange = (e) => { vn.op = Math.min(OPS[vn.n].length - 1, Math.max(0, Number(e.target.value) || 0)); vennGo(); };
    on('vGo', () => vennGo());
    on('vClr', () => (busy ? null : vn.V.shade(W(), () => false)));
    log('U 是宇集（universal set）；塗起來（升高）的地磚就是運算結果。');
    setState('文氏圖', [['集合數', String(vn.n)], ['區域數', String(1 << vn.n)]], '選一個運算按「塗色」');
  }
  async function vennGo(tok) {
    if (busy) return; busy = true;
    const [nm, fn] = OPS[vn.n][vn.op];
    try { await vn.V.shade(W(tok), fn, '#4b9ee2'); } finally { busy = false; }
    const regs = Object.keys(vn.V.cent).filter((k) => fn(vn.V.cells.find((c) => c.key === k).m));
    setState('文氏圖：' + nm, [['集合數', String(vn.n)], ['塗到的區域', regs.map((k) => (k === 'U' ? '外面' : k)).join('、')]], '區域名稱 = 落在哪幾個集合裡');
    log(nm + ' → 區域 ' + regs.join('、'));
  }

  // ───────────────────────── Mode 2：排容原理（高度 = 被數了幾次） ─────────────────────────
  // Rosen 例：Spanish 1232、French 879、Russian 114、S∩F 103、S∩R 23、F∩R 14、總數 2092 → 三者 7
  const ie = { A: 1232, B: 879, C: 114, AB: 103, AC: 23, BC: 14, ABC: 7, V: null, tags: [] };
  function regionCounts() {
    const r = {};
    r.ABC = ie.ABC; r.AB = ie.AB - ie.ABC; r.AC = ie.AC - ie.ABC; r.BC = ie.BC - ie.ABC;
    r.A = ie.A - r.AB - r.AC - r.ABC; r.B = ie.B - r.AB - r.BC - r.ABC; r.C = ie.C - r.AC - r.BC - r.ABC;
    return r;
  }
  const IEF = ['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC'];
  function enterIE() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 9.5, 8.2], [0, 0, 0.3]);
    ie.V = makeVenn(3);
    controls(IEF.map((k) => '<label>|' + k.split('').join('∩') + '| <input id="i' + k + '" type="number" min="0" max="5000" value="' + ie[k] + '" style="width:64px"></label>').join('') + '<button class="primary" id="iRun">逐項加減</button>');
    IEF.forEach((k) => { $('i' + k).onchange = (e) => { ie[k] = Math.max(0, Math.min(5000, Math.round(Number(e.target.value) || 0))); clearLog(); enterIE(); }; });
    on('iRun', () => ieRun());
    const r = regionCounts();
    const badK = Object.keys(r).filter((k) => r[k] < 0);
    if (badK.length) log('這組數字不可能：區域 ' + badK.join('、') + ' 會是負的（交集不能比集合大）。', true);
    ie.tags = Object.keys(r).map((k) => tag(String(r[k]), r[k] < 0 ? 'ptr' : 'val', ie.V.cent[k].x, 0.8, ie.V.cent[k].z));
    log('|A∪B∪C| = |A|+|B|+|C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C|');
    ieState('');
  }
  function ieTotal() { return ie.A + ie.B + ie.C - ie.AB - ie.AC - ie.BC + ie.ABC; }
  async function ieRun(tok) {
    if (busy) return; busy = true;
    const w = W(tok), V = ie.V;
    const cnt = { A: 0, B: 0, C: 0 };
    let added = { s: 0, p: 0, t: 0 };
    const cover = (c) => { const m = c.m, k = (m.A ? 1 : 0) + (m.B ? 1 : 0) + (m.C ? 1 : 0); if (!k) return 0; const pairs = (m.A && m.B ? 1 : 0) + (m.A && m.C ? 1 : 0) + (m.B && m.C ? 1 : 0); return added.s * k - added.p * pairs + added.t * (m.A && m.B && m.C ? 1 : 0); };
    void cnt;
    try {
      added.s = 1;
      if (tok) say('先加 |A| + |B| + |C|', '高度 = 這一區被數了幾次');
      await V.heights(w, (c) => cover(c), 700);
      ieState('加完三個集合：兩兩重疊被數 2 次，中間被數 3 次');
      await w(tok ? 2600 : 200);
      added.p = 1;
      if (tok) say('減掉三個兩兩交集', '中間那塊被減了 3 次 → 變 0 次');
      await V.heights(w, (c) => cover(c), 700);
      ieState('減完兩兩交集：中間那塊變成 0 次');
      await w(tok ? 2600 : 200);
      added.t = 1;
      if (tok) say('再加回 |A ∩ B ∩ C|', '每一區剛好被數 1 次');
      await V.heights(w, (c) => cover(c), 700);
    } finally { busy = false; }
    ieState('<span class="ok">每區都是 1 次 → |A∪B∪C| = ' + ieTotal() + '</span>');
  }
  function ieState(msg) {
    setState('排容原理（三個集合）', [['|A|+|B|+|C|', String(ie.A + ie.B + ie.C)], ['−兩兩交集', String(ie.AB + ie.AC + ie.BC)], ['+三者交集', String(ie.ABC)], ['|A∪B∪C|', String(ieTotal())]],
      (msg ? msg + '<br>' : '') + '地磚數字 = 只屬於那一區的人數');
  }

  // ───────────────────────── Mode 3：冪集合 ─────────────────────────
  const ELS = ['a', 'b', 'c', 'd'];
  const ECOL = { a: '#4b9ee2', b: '#9b7ef4', c: '#2fc092', d: '#dd8238' };
  const pw = { n: 3, k: 0 };
  const PX = (i, N) => (i - (N - 1) / 2) * Math.min(1.25, 12.5 / N);
  function enterPower() {
    stopTimer(); lab.clear(); busy = false;
    pw.k = 0;
    lab.frameCamera([0, 5.2, 14], [0, 2.4, 0]);
    const S = ELS.slice(0, pw.n);
    S.forEach((e, i) => cube(e, ECOL[e], [0.8, 0.6, 0.8], -1.2 * (pw.n - 1) / 2 + i * 1.2, 6, -2));
    tag('S = {' + S.join(', ') + '}', 'ptr', 0, 7, -2);
    controls('<label>|S| = <input id="pN" type="number" min="0" max="4" value="' + pw.n + '"></label><button class="primary" id="pStep">下一個子集</button><button id="pAll">全部列出</button>');
    $('pN').onchange = (e) => { pw.n = Math.max(0, Math.min(4, Math.round(Number(e.target.value)) || 0)); clearLog(); enterPower(); };
    on('pStep', () => powerStep());
    on('pAll', async () => { const e = epoch; while (e === epoch && pw.k < (1 << pw.n)) { const k0 = pw.k; await powerStep(); if (pw.k === k0) break; } });
    log('每個元素「選或不選」→ 一個 bit；n 個 bit 共 2ⁿ 種 → |P(S)| = 2ⁿ。');
    pwState();
  }
  async function powerStep(tok) {
    const N = 1 << pw.n;
    if (busy) return;
    if (pw.k >= N) { log('2^' + pw.n + ' = ' + N + ' 個子集都列完了。', true); return; }
    busy = true;
    const w = W(tok), k = pw.k, x = PX(k, N);
    const bits = ELS.slice(0, pw.n).map((_, i) => (k >> (pw.n - 1 - i)) & 1);
    const mem = ELS.slice(0, pw.n).filter((_, i) => bits[i]);
    try {
      tag(bits.join('') || '—', 'idx', x, -0.3, 0.8);
      if (!mem.length) { cube('∅', '#efe6d6', [0.8, 0.12, 0.8], x, 0.06, 0, 1); }
      for (let i = 0; i < mem.length; i++) { cube(mem[i], ECOL[mem[i]], [0.8, 0.6, 0.8], x, 0.3 + i * 0.64, 0, 3); await w(tok ? 140 : 30); }
      tag('{' + mem.join(',') + '}', 'idx', x, 0.4 + mem.length * 0.64 + 0.2);
      pw.k++;
      if (tok) say('bit ' + (bits.join('') || '（空）') + ' → {' + mem.join(', ') + '}', '第 ' + pw.k + ' / ' + N + ' 個子集');
      await w(tok ? 650 : 40);
    } finally { busy = false; }
    pwState();
  }
  function pwState() {
    const N = 1 << pw.n;
    setState('冪集合 P(S)', [['|S|', String(pw.n)], ['已列出', pw.k + ' / ' + N]], '|P(S)| = 2^' + pw.n + ' = ' + N + '<br>∅ 和 S 自己都在 P(S) 裡');
  }

  // ───────────────────────── Mode 4：笛卡兒積 ─────────────────────────
  const cp = { m: 2, k: 3 };
  const BEL = ['a', 'b', 'c', 'd', 'e'];
  function enterCart() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 9, 8], [0, 0, 0.6]);
    const GX = (j) => (j - (cp.k - 1) / 2) * 1.6, GZ = (i) => (i - (cp.m - 1) / 2) * 1.3 + 0.6;
    for (let i = 0; i < cp.m; i++) cube(i + 1, '#4b9ee2', [0.8, 0.6, 0.8], -cp.k * 0.8 - 1.4, 0.3, GZ(i));
    for (let j = 0; j < cp.k; j++) cube(BEL[j], '#dd8238', [0.8, 0.6, 0.8], GX(j), 0.3, -cp.m * 0.65 - 0.6);
    tag('A', 'ptr', -cp.k * 0.8 - 1.4, 1, GZ(0) - 1); tag('B', 'ptr', GX(0) - 1.1, 1, -cp.m * 0.65 - 0.6);
    for (let i = 0; i < cp.m; i++) for (let j = 0; j < cp.k; j++) ctx.tile(V3(GX(j), 0.04, GZ(i)), 1.4, 1.1);
    cp.GX = GX; cp.GZ = GZ; cp.done = false;
    controls('<label>|A| = <input id="cM" type="number" min="1" max="4" value="' + cp.m + '"></label><label>|B| = <input id="cK" type="number" min="1" max="5" value="' + cp.k + '"></label><button class="primary" id="cGo">填出 A × B</button>');
    $('cM').onchange = (e) => { cp.m = Math.max(1, Math.min(4, Math.round(Number(e.target.value)) || 2)); clearLog(); enterCart(); };
    $('cK').onchange = (e) => { cp.k = Math.max(1, Math.min(5, Math.round(Number(e.target.value)) || 3)); clearLog(); enterCart(); };
    on('cGo', () => cartGo());
    log('A × B = {(a, b) | a ∈ A, b ∈ B}：有序對，順序有差。');
    setState('笛卡兒積', [['|A|', String(cp.m)], ['|B|', String(cp.k)]], '|A × B| = |A| · |B| = ' + cp.m * cp.k);
  }
  async function cartGo(tok) {
    if (busy) return;
    if (cp.done) { log('已經填滿了；改 |A| 或 |B| 再試。', true); return; }
    busy = true;
    const w = W(tok);
    try {
      for (let i = 0; i < cp.m; i++) for (let j = 0; j < cp.k; j++) {
        cube('(' + (i + 1) + ',' + BEL[j] + ')', '#9b7ef4', [1.25, 0.4, 0.9], cp.GX(j), 0.25, cp.GZ(i), 2.5);
        await w(tok ? 380 : 40);
      }
      cp.done = true;
    } finally { busy = false; }
    setState('笛卡兒積', [['|A|', String(cp.m)], ['|B|', String(cp.k)], ['|A × B|', String(cp.m * cp.k)]], '<span class="ok">' + cp.m + ' × ' + cp.k + ' = ' + cp.m * cp.k + ' 個有序對</span><br>A × B ≠ B × A（除非 A = B 或有一個是空集合）');
  }

  // ───────────────────────── Mode 5：函數箭頭 ─────────────────────────
  const fn = { nx: 4, ny: 4, f: [0, 1, 2, 3], arrows: [], X: [], Y: [], inv: false };
  const DOM = ['a', 'b', 'c', 'd', 'e'];
  const FY = (i, n) => 5.4 - (i - (n - 1) / 2) * 1.15 - 2.6;
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  function drawFunc(f, nx, ny, xl, xr, nameL, nameR, colL, colR) {
    const L = [], R = [];
    for (let i = 0; i < nx; i++) L.push(cube(nameL(i), colL, [0.9, 0.7, 0.8], xl, FY(i, nx), 0));
    for (let j = 0; j < ny; j++) R.push(cube(nameR(j), colR, [0.9, 0.7, 0.8], xr, FY(j, ny), 0));
    const A = f.map((j, i) => arrow(xl + 0.5, FY(i, nx), 0, xr - 0.5, FY(j, ny), 0));
    return { L, R, A };
  }
  function enterFunc() {
    stopTimer(); lab.clear(); busy = false;
    lab.frameCamera([0, 3.6, 13.5], [0, 2.8, 0]);
    const D = drawFunc(fn.f, fn.nx, fn.ny, -3, 3, (i) => DOM[i], (j) => j + 1, '#4b9ee2', '#dd8238');
    fn.X = D.L; fn.Y = D.R; fn.arrows = D.A;
    tag('X（domain）', 'ptr', -3, 6.6); tag('Y（codomain）', 'ptr', 3, 6.6);
    controls('<label>|X| <input id="fX" type="number" min="1" max="5" value="' + fn.nx + '"></label><label>|Y| <input id="fY" type="number" min="1" max="5" value="' + fn.ny + '"></label>'
      + '<button id="fR">隨機函數</button><button id="fI">隨機單射</button><button id="fS">隨機滿射</button><button class="primary" id="fC">判斷</button><button id="fV">反函數</button>');
    $('fX').onchange = (e) => { fn.nx = Math.max(1, Math.min(5, Math.round(Number(e.target.value)) || 4)); fn.f = Array.from({ length: fn.nx }, () => Math.floor(Math.random() * fn.ny)); clearLog(); enterFunc(); };
    $('fY').onchange = (e) => { fn.ny = Math.max(1, Math.min(5, Math.round(Number(e.target.value)) || 4)); fn.f = Array.from({ length: fn.nx }, () => Math.floor(Math.random() * fn.ny)); clearLog(); enterFunc(); };
    on('fR', () => { fn.f = Array.from({ length: fn.nx }, () => Math.floor(Math.random() * fn.ny)); enterFunc(); });
    on('fI', () => { if (fn.nx > fn.ny) { log('|X| > |Y|：鴿籠原理，一定有兩個 x 撞同一個 y，不可能單射。', true); return; } fn.f = shuffle([...Array(fn.ny).keys()]).slice(0, fn.nx); enterFunc(); });
    on('fS', () => {
      if (fn.nx < fn.ny) { log('|X| < |Y|：箭頭不夠多，蓋不滿 Y，不可能滿射。', true); return; }
      const f = shuffle([...Array(fn.ny).keys()].concat(Array.from({ length: fn.nx - fn.ny }, () => Math.floor(Math.random() * fn.ny))));
      fn.f = f; enterFunc();
    });
    on('fC', () => funcCheck());
    on('fV', () => funcInverse());
    log('函數：X 的每個元素恰好射出一支箭頭。');
    funcState('');
  }
  function props(f, ny) {
    const inc = Array(ny).fill(0); f.forEach((j) => inc[j]++);
    return { inc, inj: inc.every((c) => c <= 1), surj: inc.every((c) => c >= 1) };
  }
  async function funcCheck(tok) {
    const P = props(fn.f, fn.ny), w = W(tok);
    fn.Y.forEach((m, j) => glow(m, P.inc[j] > 1 ? RED : P.inc[j] === 0 ? GOLD : GREEN));
    await w(tok ? 400 : 10);
    const s = P.inj && P.surj ? '雙射（bijection）' : P.inj ? '單射（one-to-one），不是滿射' : P.surj ? '滿射（onto），不是單射' : '既不是單射也不是滿射';
    log(s + (P.inj ? '' : '：紅色的 y 被兩支以上箭頭打到') + (P.surj ? '' : '；金色的 y 沒有箭頭'), !(P.inj && P.surj));
    funcState(s);
    return P;
  }
  async function funcInverse(tok) {
    if (busy) return;
    const P = props(fn.f, fn.ny);
    if (!(P.inj && P.surj)) { log('不是雙射就沒有反函數：' + (!P.inj ? '有 y 對到兩個 x（反過來不是函數）' : '有 y 沒有 x 可回（反過來有元素沒箭頭）'), true); await funcCheck(tok); return false; }
    busy = true;
    const w = W(tok);
    try {
      fn.arrows.forEach((a) => kill(a));
      fn.arrows = [];
      await w(tok ? 500 : 20);
      fn.f.forEach((j, i) => fn.arrows.push(arrow(2.5, FY(j, fn.ny), 0, -2.5, FY(i, fn.nx), 0, '#c08a1f')));
    } finally { busy = false; }
    funcState('箭頭全部反過來：f⁻¹: Y → X');
    log('f⁻¹(' + fn.f.map((j, i) => (j + 1) + ') = ' + DOM[i]).join('，f⁻¹(') );
    return true;
  }
  function funcState(msg) {
    const P = props(fn.f, fn.ny);
    setState('函數 f: X → Y', [['f', fn.f.map((j, i) => DOM[i] + '↦' + (j + 1)).join(' ')], ['單射', P.inj ? '是' : '否'], ['滿射', P.surj ? '是' : '否']],
      (msg ? msg + '<br>' : '') + '單射：不同 x → 不同 y；滿射：每個 y 都被打到');
  }

  // ───────────────────────── Mode 6：可數與 Cantor 對角線 ─────────────────────────
  const ca = { view: 'diag', step: 0, digits: [], grid: [], made: [], N: 6 };
  function enterCantor() {
    stopTimer(); lab.clear(); busy = false;
    ca.step = 0; ca.made = [];
    controls('<select id="kV"><option value="diag">Cantor 對角線：(0,1) 不可數</option><option value="z">ℤ 可數：0, 1, −1, 2, −2…</option><option value="q">正有理數可數：沿對角線走</option></select><button class="primary" id="kStep">下一步</button><button id="kAll">走完</button><button id="kNew">重新出題</button>');
    $('kV').value = ca.view;
    $('kV').onchange = (e) => { ca.view = ['diag', 'z', 'q'].includes(e.target.value) ? e.target.value : 'diag'; clearLog(); enterCantor(); };
    on('kStep', () => cantorStep());
    on('kAll', async () => { const e = epoch; for (let i = 0; i < 40 && !ca.end && e === epoch && !busy; i++) await cantorStep(); });
    on('kNew', () => { ca.digits = []; clearLog(); enterCantor(); });
    ca.end = false;
    if (ca.view === 'diag') setupDiag(); else if (ca.view === 'z') setupZ(); else setupQ();
  }
  const DX = (j) => -3.2 + j * 1.0, DY = (i) => 5.6 - i * 0.82;
  function setupDiag() {
    lab.frameCamera([0, 3.8, 13.5], [0, 2.9, 0]);
    if (!ca.digits.length) ca.digits = Array.from({ length: ca.N }, () => Array.from({ length: ca.N }, () => Math.floor(Math.random() * 10)));
    ca.grid = ca.digits.map((row, i) => {
      tag('r' + (i + 1) + ' = 0.', 'idx', DX(0) - 1.3, DY(i));
      return row.map((d, j) => cube(d, '#e5ddd0', [0.85, 0.6, 0.6], DX(j), DY(i), 0));
    });
    tag('…', 'val', DX(ca.N) - 0.2, DY(2));
    tag('新數 r = 0.', 'ptr alt', DX(0) - 1.6, DY(ca.N) - 0.4);
    log('假設 (0,1) 的實數可以排成一列 r1, r2, r3, …（Rosen 的寫法）。');
    log('規則：第 i 個數的第 i 位 d 若 ≠ 4 就寫 4，否則寫 5。');
    setState('Cantor 對角線', [['已處理', '0 / ' + ca.N]], '新數和第 i 個數在第 i 位一定不同');
  }
  function setupZ() {
    lab.frameCamera([0, 5, 13], [0, 1.4, 0]);
    ca.zs = [];
    for (let v = -4; v <= 4; v++) ca.zs.push(cube(v, '#e5ddd0', [0.9, 0.7, 0.9], v * 1.3, 0.35, -1.2));
    tag('ℤ', 'ptr', -6.2, 0.6, -1.2); tag('ℕ', 'ptr', -6.2, 0.6, 2.2);
    log('f(n) = n/2（n 偶）、−(n−1)/2（n 奇）：ℕ = {1, 2, 3, …} ↔ ℤ 的雙射。');
    setState('ℤ 是可數的', [['已配對', '0']], '可數 = 能和 ℕ 一一對應（排成一列）');
  }
  const zOf = (n) => (n % 2 === 0 ? n / 2 : -(n - 1) / 2);
  function qOrder(limit) {
    const out = [];
    for (let s = 2; out.length < limit && s <= 12; s++) {
      const ps = []; for (let p = 1; p < s; p++) ps.push(p);
      if (s % 2 === 1) ps.reverse();
      for (const p of ps) { const q = s - p; if (p <= 5 && q <= 5) out.push([p, q, gcd(p, q) === 1]); }
    }
    return out;
  }
  function setupQ() {
    lab.frameCamera([0, 9, 7.5], [0, 0, 0.4]);
    ca.qm = {};
    for (let p = 1; p <= 5; p++) for (let q = 1; q <= 5; q++) ca.qm[p + '/' + q] = cube(p + '/' + q, '#e5ddd0', [1.1, 0.3, 0.8], (q - 3) * 1.45, 0.15, (p - 3) * 1.1);
    tag('分子 p ↓', 'idx', -5.4, 0.3, -2.6); tag('分母 q →', 'idx', -2.9, 0.3, -3.3);
    ca.qlist = qOrder(25); ca.qn = 0;
    log('沿著 p + q = 2, 3, 4… 的對角線來回走；沒約分的（例如 2/2）跳過，以免重複。');
    setState('正有理數可數', [['編號到', '0']], '每個 p/q 都會在有限步內被走到');
  }
  async function cantorStep(tok) {
    if (busy || ca.end) { if (ca.end) log('已經走完了；按「重新出題」或換一種。', true); return; }
    busy = true;
    const w = W(tok);
    try {
      if (ca.view === 'diag') {
        const i = ca.step, d = ca.digits[i][i], nd = d === 4 ? 5 : 4;
        glow(ca.grid[i][i], GOLD); tint(ca.grid[i][i], '#f2c14e');
        await w(tok ? 600 : 30);
        ca.made.push(cube(nd, '#2fc092', [0.85, 0.6, 0.6], DX(i), DY(ca.N) - 0.4, 0, 2));
        if (tok) say('r' + (i + 1) + ' 的第 ' + (i + 1) + ' 位是 ' + d + ' → 新數寫 ' + nd, '新數 ≠ r' + (i + 1));
        log('第 ' + (i + 1) + ' 位：r' + (i + 1) + ' 是 ' + d + '，新數寫 ' + nd + ' → 新數 ≠ r' + (i + 1));
        ca.step++;
        setState('Cantor 對角線', [['已處理', ca.step + ' / ' + ca.N], ['新數', '0.' + ca.digits.slice(0, ca.step).map((r, k) => (r[k] === 4 ? 5 : 4)).join('') + '…']],
          ca.step >= ca.N ? '<span class="no">新數跟清單上每一個都不同 → 清單不完整</span><br>所以 (0,1) 不可數' : '新數和第 i 個數在第 i 位一定不同');
        if (ca.step >= ca.N) ca.end = true;
      } else if (ca.view === 'z') {
        const n = ca.step + 1, z = zOf(n);
        const m = cube(n, '#4b9ee2', [0.9, 0.7, 0.9], z * 1.3, 0.35, 2.2, 2);
        void m;
        arrow(z * 1.3, 0.5, 1.6, z * 1.3, 0.5, -0.6, '#c08a1f');
        tint(ca.zs[z + 4], '#2fc092');
        if (tok) say(n + ' ↦ ' + z, 'f(n) = ' + (n % 2 === 0 ? 'n/2' : '−(n−1)/2'));
        log(n + ' ↦ ' + z);
        ca.step++;
        setState('ℤ 是可數的', [['已配對', String(ca.step)], ['最新', n + ' ↦ ' + z]], '每個整數都會被某個 n 對到，沒有遺漏也沒有重複');
        if (ca.step >= 9) ca.end = true;
      } else {
        const [p, q, ok] = ca.qlist[ca.qn];
        const m = ca.qm[p + '/' + q];
        if (ok) { ca.step++; tint(m, '#2fc092'); relabel(m, '#' + ca.step + ' ' + p + '/' + q); }
        else { tint(m, '#bdb3a3'); relabel(m, p + '/' + q + ' 跳過'); }
        glow(m, GOLD);
        if (tok) say(ok ? '第 ' + ca.step + ' 個：' + p + '/' + q : p + '/' + q + ' = ' + p / gcd(p, q) + '/' + q / gcd(p, q) + '，已經數過', '');
        await w(tok ? 520 : 20);
        glow(m, null);
        ca.qn++;
        setState('正有理數可數', [['編號到', String(ca.step)], ['剛走過', p + '/' + q]], '沿對角線走，每條對角線有限長 → 每個 p/q 都有編號');
        if (ca.qn >= ca.qlist.length) ca.end = true;
      }
      await w(tok ? 500 : 20);
    } finally { busy = false; }
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.14) {
      const U = [1, 2, 3, 4, 5, 6, 7, 8];
      const A = U.filter(() => Math.random() < 0.5), B = U.filter(() => Math.random() < 0.5);
      const ops = [['A ∪ B', (x) => A.includes(x) || B.includes(x)], ['A ∩ B', (x) => A.includes(x) && B.includes(x)], ['A − B', (x) => A.includes(x) && !B.includes(x)], ['A ⊕ B', (x) => A.includes(x) !== B.includes(x)], ['(A ∪ B)ᶜ', (x) => !(A.includes(x) || B.includes(x))]];
      const [nm, f] = pick(ops);
      const fmt = (arr) => '{' + arr.join(', ') + '}';
      const ans = fmt(U.filter(f));
      const opts = [ans, ...ops.filter((o) => o[0] !== nm).map((o) => fmt(U.filter(o[1])))];
      return { q: 'U = {1,…,8}，A = ' + fmt(A) + '，B = ' + fmt(B) + '。' + nm + ' = ?', opts: [...new Set(opts)].slice(0, 4), ans, why: nm + '：' + { 'A ∪ B': '在 A 或 B', 'A ∩ B': '同時在 A 和 B', 'A − B': '在 A 不在 B', 'A ⊕ B': '恰在其中一個', '(A ∪ B)ᶜ': '兩個都不在' }[nm] + '。' };
    }
    if (k < 0.28) {
      const a = 20 + Math.floor(Math.random() * 60), b = 15 + Math.floor(Math.random() * 50), c = 10 + Math.floor(Math.random() * 40);
      const t = 1 + Math.floor(Math.random() * 5), ab = t + Math.floor(Math.random() * 8), ac = t + Math.floor(Math.random() * 6), bc = t + Math.floor(Math.random() * 6);
      const ans = a + b + c - ab - ac - bc + t;
      return { q: '|A|=' + a + '，|B|=' + b + '，|C|=' + c + '，|A∩B|=' + ab + '，|A∩C|=' + ac + '，|B∩C|=' + bc + '，|A∩B∩C|=' + t + '。|A∪B∪C| = ?', opts: [ans, ans - t, a + b + c - ab - ac - bc, a + b + c].map(String).filter((v, i, s) => s.indexOf(v) === i).concat([String(ans + t)]).slice(0, 4), ans: String(ans), why: '加單 − 減兩兩 + 加三者：' + (a + b + c) + ' − ' + (ab + ac + bc) + ' + ' + t + ' = ' + ans + '。忘了加回三者交集是最常見的錯。' };
    }
    if (k < 0.4) {
      const n = Math.floor(Math.random() * 6);
      const q = pick([['|P(S)|', Math.pow(2, n), [n * n, 2 * n, Math.pow(2, n) - 1]], ['|P(P(S))|（n ≤ 2）', null, null]]);
      if (q[1] === null) { const m = Math.min(n, 2); const v = Math.pow(2, Math.pow(2, m)); return { q: '|S| = ' + m + '，|P(P(S))| = ?', opts: [String(v), String(Math.pow(2, m)), String(Math.pow(2, m) * 2), String(v * 2)].filter((x, i, s) => s.indexOf(x) === i), ans: String(v), why: '|P(S)| = 2^' + m + ' = ' + Math.pow(2, m) + '，再取一次冪集合：2^' + Math.pow(2, m) + ' = ' + v + '。' }; }
      return { q: '|S| = ' + n + '，冪集合 P(S) 有幾個元素？', opts: [q[1], ...q[2]].map(String).filter((x, i, s) => s.indexOf(x) === i).concat(['不一定']).slice(0, 4), ans: String(q[1]), why: '每個元素選或不選 → 2^' + n + '；包含 ∅ 和 S 本身。' };
    }
    if (k < 0.5) {
      const items = [['∅ ∈ {∅}', '真', '{∅} 的唯一元素就是 ∅。'], ['∅ ⊆ {1, 2}', '真', '∅ 是任何集合的子集。'], ['{∅} = ∅', '假', '{∅} 有一個元素，∅ 沒有元素。'], ['{1} ∈ {1, 2}', '假', '{1, 2} 的元素是 1 和 2，不是 {1}。'], ['{1} ⊆ {1, 2}', '真', '1 ∈ {1, 2}。'], ['|{∅, {∅}}| = 2', '真', '兩個不同的元素：∅ 和 {∅}。'], ['A × ∅ = ∅', '真', '沒有 b 可以配。'], ['{1, 2} × {3} = {3} × {1, 2}', '假', '有序對 (1,3) ≠ (3,1)。']];
      const [s, a, why] = pick(items);
      return { q: '「' + s + '」為真還是假？', opts: ['真', '假'], ans: a, why };
    }
    if (k < 0.66) {
      const nx = 2 + Math.floor(Math.random() * 3), ny = 2 + Math.floor(Math.random() * 3);
      const f = Array.from({ length: nx }, () => Math.floor(Math.random() * ny));
      const P = props(f, ny);
      const ans = P.inj && P.surj ? '雙射' : P.inj ? '單射但非滿射' : P.surj ? '滿射但非單射' : '都不是';
      return { q: 'f: {' + DOM.slice(0, nx).join(', ') + '} → {' + Array.from({ length: ny }, (_, j) => j + 1).join(', ') + '}，' + f.map((j, i) => 'f(' + DOM[i] + ') = ' + (j + 1)).join('，') + '。f 是？', opts: ['雙射', '單射但非滿射', '滿射但非單射', '都不是'], ans, why: '被打到的次數：' + P.inc.map((c, j) => (j + 1) + '→' + c).join('、') + '。單射 = 每個 ≤ 1；滿射 = 每個 ≥ 1。' };
    }
    if (k < 0.76) {
      const items = [['f: ℤ → ℤ，f(x) = x + 1', '雙射'], ['f: ℤ → ℤ，f(x) = 2x', '單射但非滿射'], ['f: ℤ → ℤ，f(x) = x²', '都不是'], ['f: ℝ → ℝ，f(x) = x³', '雙射'], ['f: ℤ → ℤ，f(x) = ⌈x/2⌉', '滿射但非單射'], ['f: ℝ → ℝ，f(x) = x²', '都不是'], ['f: ℝ⁺ → ℝ⁺，f(x) = x²', '雙射'], ['f: ℕ → ℕ，f(n) = n + 1（ℕ 含 0）', '單射但非滿射']];
      const [s, a] = pick(items);
      return { q: s + ' 是？', opts: ['雙射', '單射但非滿射', '滿射但非單射', '都不是'], ans: a, why: '看值域有沒有蓋滿 codomain（滿射）、有沒有兩個 x 撞同一個值（單射）；同一個式子換 domain/codomain 結論會變。' };
    }
    if (k < 0.86) {
      const a = 1 + Math.floor(Math.random() * 4), b = Math.floor(Math.random() * 6), c = 1 + Math.floor(Math.random() * 4), d = Math.floor(Math.random() * 6);
      const ans = 'f∘g(x) = ' + a * c + 'x + ' + (a * d + b);
      return { q: 'f(x) = ' + a + 'x + ' + b + '，g(x) = ' + c + 'x + ' + d + '。f∘g(x) = ?', opts: [ans, 'f∘g(x) = ' + a * c + 'x + ' + (c * b + d), 'f∘g(x) = ' + (a + c) + 'x + ' + (b + d), 'f∘g(x) = ' + a * c + 'x + ' + b * d], ans, why: 'f∘g(x) = f(g(x)) = ' + a + '(' + c + 'x + ' + d + ') + ' + b + '；先做 g 再做 f。第二個選項是 g∘f。' };
    }
    const items = [['ℤ', '可數'], ['正有理數 ℚ⁺', '可數'], ['(0, 1) 的實數', '不可數'], ['所有有限長度的二進位字串', '可數'], ['ℕ 的所有子集 P(ℕ)', '不可數'], ['ℤ × ℤ', '可數'], ['無理數', '不可數']];
    const [s, a] = pick(items);
    return { q: s + ' 是可數還是不可數？', opts: ['可數', '不可數', '有限', '無法判斷'], ans: a, why: a === '可數' ? '可以排成一列（和 ℕ 一一對應），例如沿對角線或依長度排。' : 'Cantor 對角線：任何清單都能造出不在清單上的元素。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts.map(String))].sort(() => Math.random() - 0.5);
    if (!opts.includes(p.ans)) opts[0] = p.ans;
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

  // ───────────────────────── 場景（課本：Rosen 2.1–2.3、2.5，Grimaldi 3.1–3.2、5.2–5.6） ─────────────────────────
  async function scSetBasics(tok) {
    fresh([0, 5.5, 13], [0, 1.6, 0]);
    say('集合：一堆「不分順序、不重複」的元素', 'Rosen：{x | x 是小於 10 的正奇數}');
    await beat(tok, 2600);
    const tray = cube('', '#efe6d6', [8, 0.1, 2.2], -1, 0.05, 0);
    void tray;
    for (const [i, v] of [1, 3, 5, 7, 9].entries()) { cube(v, '#4b9ee2', [0.9, 0.8, 0.9], -4 + i * 1.5, 0.5, 0, 3); await beat(tok, 450); }
    say('= {1, 3, 5, 7, 9}', 'set-builder 寫法 = 列舉寫法');
    await beat(tok, 2200);
    const ex = cube(3, '#dd8238', [0.9, 0.8, 0.9], 5.2, 0.5, 0, 3);
    say('再丟一個 3 進去？', '{1, 3, 3, 5} = {1, 3, 5}：重複不算');
    await beat(tok, 1600);
    fly(ex, V3(2, 7, 2));
    await beat(tok, 1800);
    lab.clear();
    say('∅ 和 {∅} 不一樣', '∅ 沒有元素；{∅} 有一個元素（空盒子）');
    const b1 = cube('', '#efe6d6', [2.2, 0.15, 2.2], -3, 0.08, 0); void b1;
    tag('∅：|∅| = 0', 'ptr', -3, 1.2);
    cube('', '#efe6d6', [2.2, 0.15, 2.2], 3, 0.08, 0);
    cube('∅', '#c9b48e', [1.1, 0.5, 1.1], 3, 0.4, 0, 3);
    tag('{∅}：|{∅}| = 1', 'ptr alt', 3, 1.4);
    await beat(tok, 3200);
    say('∅ 是每個集合的子集；∅ ∈ {∅} 也成立', '∅ ⊆ A；A ⊆ A');
    await beat(tok, 3000);
  }
  async function scVennOps(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.3]);
    const V = makeVenn(2);
    const seq = [['A ∪ B', (m) => m.A || m.B, '#4b9ee2', '聯集：在 A 或在 B'], ['A ∩ B', (m) => m.A && m.B, '#9b7ef4', '交集：同時在 A 和 B'], ['A − B', (m) => m.A && !m.B, '#2fc092', '差集：在 A 但不在 B'],
      ['A ⊕ B', (m) => m.A !== m.B, '#dd8238', '對稱差：恰在其中一個'], ['Aᶜ', (m) => !m.A, '#e55a9b', '補集：U 裡不在 A 的']];
    for (const [nm, f, c, cap] of seq) {
      say(cap, nm);
      await V.shade(W(tok), f, c, 600);
      await beat(tok, 2000);
    }
    say('A ⊕ B = (A − B) ∪ (B − A)', '= (A ∪ B) − (A ∩ B)');
    await V.shade(W(tok), (m) => m.A !== m.B, '#dd8238', 500);
    await beat(tok, 2600);
  }
  async function scSetDeMorgan(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.3]);
    const V = makeVenn(2);
    say('集合版 De Morgan', '(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ');
    await beat(tok, 2000);
    await V.shade(W(tok), (m) => m.A || m.B, '#9fc4ea', 500); say('先塗 A ∪ B', ''); await beat(tok, 1400);
    await V.shade(W(tok), (m) => !(m.A || m.B), '#4b9ee2', 500); say('取補集：(A ∪ B)ᶜ = 外面那圈', '左邊'); await beat(tok, 2000);
    await V.shade(W(tok), () => false, '#000', 400);
    await V.shade(W(tok), (m) => !m.A, '#f0b4cf', 500); say('Aᶜ', ''); await beat(tok, 1300);
    await V.shade(W(tok), (m) => !m.B, '#f6d0a8', 500); say('Bᶜ', ''); await beat(tok, 1300);
    await V.shade(W(tok), (m) => !m.A && !m.B, '#4b9ee2', 500); say('Aᶜ ∩ Bᶜ：兩個都不在', '右邊 —— 和左邊塗出來一模一樣');
    await beat(tok, 2600);
    say('另一條：(A ∩ B)ᶜ = Aᶜ ∪ Bᶜ', '對應邏輯的 ¬(p ∧ q) ≡ ¬p ∨ ¬q');
    await V.shade(W(tok), (m) => !(m.A && m.B), '#dd8238', 600);
    await beat(tok, 3000);
  }
  async function scDistributive(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.3]);
    const V = makeVenn(3);
    say('分配律：A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)', '');
    await beat(tok, 2200);
    await V.shade(W(tok), (m) => m.B || m.C, '#cbb8f6', 500); say('B ∪ C', ''); await beat(tok, 1400);
    await V.shade(W(tok), (m) => m.A && (m.B || m.C), '#9b7ef4', 500); say('再和 A 取交集', '左邊'); await beat(tok, 2200);
    await V.shade(W(tok), () => false, '#000', 400);
    await V.shade(W(tok), (m) => m.A && m.B, '#9fdcc4', 500); say('A ∩ B', ''); await beat(tok, 1300);
    await V.shade(W(tok), (m) => (m.A && m.B) || (m.A && m.C), '#9b7ef4', 500); say('∪ (A ∩ C)', '右邊 —— 同樣的三塊');
    await beat(tok, 2800);
    say('也可以用 membership table 證（和真值表一樣）', 'x ∈ A ∧ (x ∈ B ∨ x ∈ C)');
    await beat(tok, 2600);
  }
  async function scIE2(tok) {
    fresh([0, 9.5, 8.2], [0, 0, 0.3]);
    const V = makeVenn(2);
    say('Rosen：資工系 25 人、數學系 13 人、雙主修 8 人', '至少一個系的有幾人？');
    await beat(tok, 2600);
    const cnt = (c) => (c.m.A ? 1 : 0) + (c.m.B ? 1 : 0);
    await V.heights(W(tok), (c) => (c.m.A ? 1 : 0), 500); tag('|A| = 25', 'ptr', -3.2, 1.2, -2.6); say('+ |A| = 25', ''); await beat(tok, 1500);
    await V.heights(W(tok), cnt, 500); tag('|B| = 13', 'ptr', 3.2, 1.2, -2.6); say('+ |B| = 13：中間被數了兩次', '高度 2 = 數了 2 次'); await beat(tok, 2400);
    await V.heights(W(tok), (c) => Math.min(1, cnt(c)), 600); say('− |A ∩ B| = 8', '每一區都只數一次');
    await beat(tok, 2000);
    tag('17', 'val', V.cent.A.x, 0.9, V.cent.A.z); tag('8', 'val', V.cent.AB.x, 0.9, V.cent.AB.z); tag('5', 'val', V.cent.B.x, 0.9, V.cent.B.z);
    say('|A ∪ B| = 25 + 13 − 8 = 30', '17 + 8 + 5 = 30');
    await beat(tok, 3200);
  }
  async function scIE3(tok) {
    Object.assign(ie, { A: 1232, B: 879, C: 114, AB: 103, AC: 23, BC: 14, ABC: 7 });
    enterIE(); controls('');
    say('Rosen：西語 1232、法語 879、俄語 114 人…', '兩兩：103、23、14；總共 2092 人');
    await beat(tok, 3000);
    await ieRun(tok);
    say('2092 = 1232 + 879 + 114 − 103 − 23 − 14 + x', 'x = |S ∩ F ∩ R| = 7');
    await beat(tok, 3400);
  }
  async function scPowerSet(tok) {
    pw.n = 3; enterPower(); controls('');
    say('P({a, b, c})：所有子集的集合', '每個元素選或不選 → 一個 bit');
    await beat(tok, 2400);
    for (let i = 0; i < 8; i++) await powerStep(tok);
    say('8 = 2³ 個子集，包含 ∅ 與 {a, b, c}', '|P(S)| = 2^|S|');
    await beat(tok, 3000);
    say('P(∅) = {∅}，有 1 個元素', '2⁰ = 1');
    await beat(tok, 2600);
  }
  async function scCartesian(tok) {
    cp.m = 2; cp.k = 3; enterCart(); controls('');
    say('Rosen：A = {1, 2}，B = {a, b, c}', 'A × B = 所有有序對 (a, b)');
    await beat(tok, 2400);
    await cartGo(tok);
    say('|A × B| = 2 × 3 = 6', '(1, a) 和 (a, 1) 不一樣 → A × B ≠ B × A');
    await beat(tok, 3000);
    say('關係（relation）就是 A × B 的子集', '函數是一種特別的關係');
    await beat(tok, 2600);
  }
  async function scFuncDef(tok) {
    fresh([0, 3.6, 13.5], [0, 2.8, 0]);
    say('函數 f: X → Y：X 的每個元素恰好一支箭頭', '');
    await beat(tok, 2000);
    const D = drawFunc([0, 2, 2], 3, 3, -3, 3, (i) => DOM[i], (j) => j + 1, '#4b9ee2', '#dd8238');
    D.L.forEach((m) => glow(m, GREEN));
    say('a、b、c 各射一支 → 是函數', '兩支打到同一個 y 沒關係；y = 2 沒被打到也沒關係');
    await beat(tok, 3000);
    const extra = arrow(-2.5, FY(0, 3), 0, 2.5, FY(1, 3), 0, '#d64545');
    glow(D.L[0], RED);
    say('a 射出兩支 → 不是函數', 'f(a) 必須唯一');
    await beat(tok, 2600);
    kill(extra); kill(D.A[2]); glow(D.L[0], GREEN); glow(D.L[2], RED);
    say('c 沒有箭頭 → 也不是函數', '每個 x 都要有 f(x)');
    await beat(tok, 2600);
    say('domain = X、codomain = Y、range = 真的被打到的', 'range ⊆ codomain');
    await beat(tok, 2600);
  }
  async function scInjSurj(tok) {
    fresh([0, 3.6, 14.5], [0, 2.8, 0]);
    const cases = [
      [[0, 1, 3], 3, 4, '單射（one-to-one）：沒有兩支打到同一個', '不是滿射：4 沒被打到'],
      [[0, 1, 2, 2], 4, 3, '滿射（onto）：每個 y 都有箭頭', '不是單射：c、d 都打到 3'],
      [[1, 2, 0], 3, 3, '雙射（bijection）：一對一又蓋滿', '|X| = |Y|，可以反過來'],
    ];
    for (const [f, nx, ny, cap, f2] of cases) {
      lab.clear();
      const D = drawFunc(f, nx, ny, -3, 3, (i) => DOM[i], (j) => j + 1, '#4b9ee2', '#dd8238');
      say(cap, '');
      await beat(tok, 1600);
      const P = props(f, ny);
      D.R.forEach((m, j) => glow(m, P.inc[j] > 1 ? RED : P.inc[j] === 0 ? GOLD : GREEN));
      say(cap, f2);
      await beat(tok, 2800);
    }
    say('有限集合：單射 ⇒ |X| ≤ |Y|，滿射 ⇒ |X| ≥ |Y|', '|X| = |Y| 時單射 ⇔ 滿射');
    await beat(tok, 3000);
  }
  async function scCompose(tok) {
    fresh([0, 3.6, 15], [0, 2.8, 0]);
    say('Rosen：g: {a,b,c} → {a,b,c}，f: {a,b,c} → {1,2,3}', 'f∘g(x) = f(g(x))：先 g 再 f');
    const g = [1, 2, 0], f = [2, 1, 0];
    const L = [0, 1, 2].map((i) => cube(DOM[i], '#4b9ee2', [0.9, 0.7, 0.8], -4.8, FY(i, 3), 0));
    const M = [0, 1, 2].map((i) => cube(DOM[i], '#9b7ef4', [0.9, 0.7, 0.8], 0, FY(i, 3), 0));
    const R = [0, 1, 2].map((i) => cube(i + 1, '#dd8238', [0.9, 0.7, 0.8], 4.8, FY(i, 3), 0));
    void M; void R;
    await beat(tok, 2200);
    g.forEach((j, i) => arrow(-4.3, FY(i, 3), 0, -0.5, FY(j, 3), 0));
    tag('g', 'ptr', -2.4, 6.6);
    say('g(a) = b，g(b) = c，g(c) = a', '');
    await beat(tok, 2200);
    f.forEach((j, i) => arrow(0.5, FY(i, 3), 0, 4.3, FY(j, 3), 0));
    tag('f', 'ptr', 2.4, 6.6);
    say('f(a) = 3，f(b) = 2，f(c) = 1', '');
    await beat(tok, 2200);
    for (let i = 0; i < 3; i++) {
      glow(L[i], GOLD);
      const mid = g[i], end = f[mid];
      arrow(-4.3, FY(i, 3) + 0.15, 0.6, 4.3, FY(end, 3) + 0.15, 0.6, '#c08a1f');
      say('f∘g(' + DOM[i] + ') = f(' + DOM[mid] + ') = ' + (end + 1), '');
      await beat(tok, 1800);
      glow(L[i], null);
    }
    say('f∘g(a) = 2，f∘g(b) = 1，f∘g(c) = 3', 'g∘f 根本沒定義：f 的值域 {1,2,3} 不是 g 的定義域');
    await beat(tok, 3200);
  }
  async function scInverse(tok) {
    fn.nx = 3; fn.ny = 3; fn.f = [1, 2, 0]; enterFunc(); controls('');
    say('Rosen：f(a) = 2，f(b) = 3，f(c) = 1', '這是雙射嗎？');
    await beat(tok, 2400);
    await funcCheck(tok);
    say('每個 y 剛好被打一次 → 雙射', '');
    await beat(tok, 1800);
    await funcInverse(tok);
    say('箭頭全部反過來：f⁻¹(1) = c，f⁻¹(2) = a，f⁻¹(3) = b', 'f⁻¹∘f = 恆等函數');
    await beat(tok, 3000);
    fn.f = [0, 0, 2]; enterFunc(); controls('');
    say('不是雙射呢？', 'a、b 都打到 1，2 沒被打到');
    await beat(tok, 1600);
    await funcInverse(tok);
    say('反過來 1 會指向兩個、2 沒地方去 → 沒有反函數', 'invertible ⇔ bijection');
    await beat(tok, 3000);
  }
  async function scCountZ(tok) {
    ca.view = 'z'; enterCantor(); controls('');
    say('可數：能和 ℕ 一一對應（排成一列）', 'Rosen：證明 ℤ 是可數的');
    await beat(tok, 2600);
    for (let i = 0; i < 9; i++) await cantorStep(tok);
    say('0, 1, −1, 2, −2, 3, −3 …', '|ℤ| = |ℕ| = ℵ₀，雖然 ℕ ⊊ ℤ');
    await beat(tok, 3000);
  }
  async function scCountQ(tok) {
    ca.view = 'q'; enterCantor(); controls('');
    say('正有理數 p/q 也可數', '沿 p + q = 2, 3, 4… 的對角線走');
    await beat(tok, 2600);
    for (let i = 0; i < 25; i++) await cantorStep(tok);
    say('沒約分的（2/2、2/4…）跳過', '每個正有理數都拿到一個編號 → 可數');
    await beat(tok, 3000);
  }
  async function scCantor(tok) {
    ca.view = 'diag'; ca.digits = [[2, 3, 7, 9, 1, 4], [4, 4, 0, 1, 8, 2], [9, 0, 4, 6, 3, 5], [1, 5, 9, 2, 6, 5], [3, 3, 3, 3, 4, 3], [5, 0, 0, 0, 0, 4]];
    enterCantor(); controls('');
    say('反證：假設 (0,1) 的實數能排成一列', 'r1, r2, r3, … 寫成小數');
    await beat(tok, 2800);
    for (let i = 0; i < 6; i++) await cantorStep(tok);
    say('新數第 i 位 ≠ rᵢ 第 i 位 → 不等於任何 rᵢ', '清單漏了它 → 矛盾 → (0,1) 不可數');
    await beat(tok, 3400);
    say('選 4、5 是為了避開 0.4999… = 0.5000… 的問題', '');
    await beat(tok, 2600);
    ca.digits = [];
  }

  const scenes = {
    'set-basics': { title: '集合：不分順序、不重複；∅ vs {∅}（Rosen 例）', play: scSetBasics },
    'venn-ops': { title: '文氏圖：∪ ∩ − ⊕ 補集（課本）', play: scVennOps },
    'set-demorgan': { title: '集合 De Morgan：兩邊塗出一樣（課本）', play: scSetDeMorgan },
    'set-distributive': { title: '分配律：三個集合的文氏圖（課本）', play: scDistributive },
    'ie-two': { title: '排容：25 + 13 − 8 = 30（Rosen 例）', play: scIE2 },
    'ie-three': { title: '排容三集合：語言課 2092 人（Rosen 例）', play: scIE3 },
    'power-set': { title: '冪集合 P({a,b,c})：8 個子集（課本）', play: scPowerSet },
    'cartesian': { title: '笛卡兒積 {1,2} × {a,b,c}（Rosen 例）', play: scCartesian },
    'func-def': { title: '函數：每個 x 恰好一支箭頭（課本）', play: scFuncDef },
    'inj-surj': { title: '單射、滿射、雙射（課本）', play: scInjSurj },
    'composition': { title: '合成 f∘g（Rosen 例）', play: scCompose },
    'inverse': { title: '反函數：雙射才能反過來（Rosen 例）', play: scInverse },
    'countable-z': { title: 'ℤ 可數：0, 1, −1, 2, −2…（Rosen 例）', play: scCountZ },
    'countable-q': { title: '正有理數可數：沿對角線走（課本）', play: scCountQ },
    'cantor-diagonal': { title: 'Cantor 對角線：(0,1) 不可數（課本）', play: scCantor },
  };

  return {
    kicker: '離散數學・第 3 章',
    title: '集合與函數',
    color: 'var(--dm)',
    modes: [
      { id: 'venn', name: '文氏圖', enter: enterVenn },
      { id: 'ie', name: '排容計數', enter: enterIE },
      { id: 'power', name: '冪集合', enter: enterPower },
      { id: 'cart', name: '笛卡兒積', enter: enterCart },
      { id: 'func', name: '函數箭頭', enter: enterFunc },
      { id: 'cantor', name: '可數與對角線', enter: enterCantor },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['set-basics', 'venn-ops', 'set-demorgan', 'set-distributive', 'ie-two', 'ie-three', 'power-set', 'cartesian',
      'func-def', 'inj-surj', 'composition', 'inverse', 'countable-z', 'countable-q', 'cantor-diagonal'],
    stop() { stopTimer(); busy = false; },
  };
}
