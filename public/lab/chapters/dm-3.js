// 離散數學 第3章：集合與函數（集合運算、文氏圖、排容、冪集合、笛卡兒積、
// 單射／滿射／雙射、合成與反函數、可數與不可數、Cantor 對角線）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 課本慣例：Rosen（ℕ 在可數性證明中從 1 開始對應；Cantor 對角線用「d ≠ 4 換成 4，否則 5」）。
import kit from './_kit.js';

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
      return { q: 'f(x) = ' + a + 'x + ' + b + '，g(x) = ' + c + 'x + ' + d + '。f∘g(x) = ?', opts: [ans, 'f∘g(x) = ' + a * c + 'x + ' + (c * b + d), 'f∘g(x) = ' + (a + c) + 'x + ' + (b + d), 'f∘g(x) = ' + a * c + 'x + ' + b * d], ans, why: 'f∘g(x) = f(g(x)) = ' + a + '(' + c + 'x + ' + d + ') + ' + b + '；先做 g 再做 f。' + a * c + 'x + ' + (c * b + d) + ' 是 g∘f(x)。' };
    }
    const items = [['ℤ', '可數'], ['正有理數 ℚ⁺', '可數'], ['(0, 1) 的實數', '不可數'], ['所有有限長度的二進位字串', '可數'], ['ℕ 的所有子集 P(ℕ)', '不可數'], ['ℤ × ℤ', '可數'], ['無理數', '不可數']];
    const [s, a] = pick(items);
    return { q: s + ' 是可數還是不可數？', opts: ['可數', '不可數', '有限', '無法判斷'], ans: a, why: a === '可數' ? '可以排成一列（和 ℕ 一一對應），例如沿對角線或依長度排。' : 'Cantor 對角線：任何清單都能造出不在清單上的元素。' };
  }
  let qs = { score: 0, total: 0 };
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...new Set(p.opts.map(String))].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ sfA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 3 章 集合與函數（清大 趙啟超 2A、2B、4A、4B）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 老師板書的例子（A = {1,2,3,4}、B = {1,3}…）照用；老師沒給具體元素的圖標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const C = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#c08a1f', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const card = (t, c, x, y, w = 4, h = 0.55, z = 0, drop = 1.2) => cube(t, c, [w, h, 0.8], x, y, z, drop);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.kill && o.el) return o.kill(); kill(o); });
function scene(id, title, cam, steps, init) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    if (init) init(S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4, 15], [0, 3.2, 0]];
const CAMV = [[0, 9.5, 8.2], [0, 0, 0.3]];

// ── 橢圓外框（集合）＋裡面的元素方塊 ──
function ring(cx, cy, rx, ry, color = '#8a7a60', rot = 0, z = 0) {
  const pts = [];
  for (let k = 0; k <= 72; k++) { const a = (Math.PI * 2 * k) / 72, u = rx * Math.cos(a), v = ry * Math.sin(a); pts.push(V3(cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
function oval(name, vals, cx, cy, o = {}) {
  const n = vals.length, row = o.dir !== 'col', sp = o.sp || (row ? 0.95 : 0.8);
  const rx = o.rx || (row ? Math.max(1.1, (n * sp) / 2 + 0.5) : 1.05), ry = o.ry || (row ? 0.85 : Math.max(1.0, (n * sp) / 2 + 0.4));
  const S = { cx, cy, rx, ry, el: {}, pos: {} };
  S.ring = ring(cx, cy, rx, ry);
  if (name) S.nm = hd(name, cx, cy + ry + 0.3);
  vals.forEach((v, i) => {
    const off = (i - (n - 1) / 2) * sp, x = row ? cx + off : cx, y = row ? cy : cy - off;
    S.pos[v] = [x, y]; S.el[v] = cube(String(v), o.color || C.blue, [0.62, 0.52, 0.4], x, y, 0.2, o.drop === undefined ? 0.9 : o.drop);
  });
  S.kill = () => { kill(S.ring); if (S.nm) kill(S.nm); Object.values(S.el).forEach(kill); };
  return S;
}
// 函數箭頭：從集合 X 的元素 u 指到集合 Y 的元素 v
function farrow(X, u, Y, v, color = 0x6e5f49, z = 0.3, dy = 0) {
  const [x1, y1] = X.pos[u], [x2, y2] = Y.pos[v], s = x2 > x1 ? 1 : -1;
  return arrow(V3(x1 + s * 0.38, y1 + dy, z), V3(x2 - s * 0.38, y2 + dy, z), color);
}
const dot = (x, y) => { const m = cube('', C.gold, [0.3, 0.3, 0.3], x, y, 0.7); glow(m, HL); return m; };
async function hop(tok, m, X, u, Y, v, ms = 700) { const [x1, y1] = X.pos[u], [x2, y2] = Y.pos[v]; await anim(tok, ms, (t) => m.position.set(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * 0.6, 0.7)); }
// 一行一行的推導：新的一行發亮，右邊寫理由
function chain(x, yTop, dy = 0.66, w = 6.4, whyX) {
  const ls = [];
  return { ls, add(e, why, c) { ls.forEach((m) => glow(m, null)); const y = yTop - ls.length * dy; const m = card(e, c || C.sky, x, y, w, 0.5); glow(m, HL); if (why) sm(why, whyX === undefined ? x + w / 2 + 1.3 : whyX, y); ls.push(m); return m; } };
}

// ── 文氏圖（模組內建的地磚版；塗色 = 升高）。n = 1 時只畫一個集合 A ──
if (!CIRC[1]) CIRC[1] = [['A', 0, 0, 2.6]];
const RK = (m) => (m.A ? 'A' : '') + (m.B ? 'B' : '') + (m.C ? 'C' : '') || 'U';
function vscene(id, title, n, steps) {
  scene(id, title, CAMV, steps, (S) => { S.V = makeVenn(n); S.f = hot(' ', 0, 1.0, -4.55); S.g = sm(' ', 0, 1.0, 4.25); });
}
const shade = (tok, S, fn, col, ms = 500) => S.V.shade(W(tok), fn, col, ms);
const say2 = (S, f, g = ' ') => { txt(S.f, f); txt(S.g, g || ' '); };

// ════════ f_Vw45CmKXs（趙啟超 2A：Set Theory） ════════
scene('sfA-eq', '2A：集合相等：{1,2,3} = {3,2,1}', CAM, [
  async (tok, S) => { // 4.7
    S.ch = [card('∩ 交集', C.sky, -4.2, 5.4, 2.6), card('∪ 聯集', C.sky, 0, 5.4, 2.6), card('Aᶜ 補集', C.sky, 4.2, 5.4, 2.6)];
    cap('上一堂：集合的定義、∩、∪、complement', '複習');
  },
  async (tok, S) => { // 7.0
    gone(S.ch);
    S.A = ring(-3, 3, 1.8, 1.3); S.B = ring(3, 3, 1.8, 1.3); S.na = hd('A', -3, 4.65); S.nb = hd('B', 3, 4.65);
    S.q = hot('？', 0, 3);
    cap('今天：兩個集合之間的關係（relation）', '');
  },
  async (tok, S) => { // 9.3
    txt(S.q, '=');
    cap('第一種關係：相等  A = B', '兩個集合一模一樣');
  },
  async (tok, S) => { // 54.8
    gone(S.A, S.B, S.na, S.nb, S.q);
    S.L = oval('', [1, 2, 3], -3.2, 3); S.R = oval('', [3, 2, 1], 3.2, 3);
    hd('{1, 2, 3}', -3.2, 4.4); hd('{3, 2, 1}', 3.2, 4.4);
    cap('{1, 2, 3} 和 {3, 2, 1} 一樣嗎？', '');
  },
  async (tok, S) => { // 66.2
    const ms = [S.R.el[3], S.R.el[1]], x0 = [ms[0].position.x, ms[1].position.x];
    await anim(tok, 900, (t) => { ms[0].position.x = x0[0] + (x0[1] - x0[0]) * t; ms[1].position.x = x0[1] + (x0[0] - x0[1]) * t; ms[0].position.y = 3 + Math.sin(Math.PI * t) * 0.7; });
    cap('set 是 unordered collection：沒有順序', '換個順序排，還是同一個集合');
  },
  async (tok, S) => { // 83.7
    note('除非特別說是「有順序的」(ordered)', 0, 1.3);
    cap('一般的集合不管順序', '除非特別講是 ordered set');
  },
  async (tok, S) => { // 90.3
    hot('=', 0, 3);
    [S.L, S.R].forEach((X) => Object.values(X.el).forEach((m) => glow(m, OKG)));
    cap('元素一樣 → 兩個集合相等', '{1, 2, 3} = {3, 2, 1}');
  },
]);

scene('sfA-sub', '2A：子集合 A ⊆ B：{1,2} ⊆ {1,2,3}', CAM, [
  async (tok, S) => { // 97.7
    S.t = hot('A ⊆ B', 0, 6.3);
    cap('第二種關係：subset 部分集合（子集合）', 'A is a subset of B');
  },
  async (tok, S) => { // 125.9
    S.rb = ring(0, 3, 3.4, 2.1); S.ra = ring(-0.9, 2.8, 1.5, 1.1);
    S.nb = hd('B', 2.6, 4.9); S.na = hd('A', -0.9, 4.15);
    cap('A 的任何一個元素，都是 B 的元素', 'A 整個裝在 B 裡面');
  },
  async (tok, S) => { // 132.5
    gone(S.rb, S.ra, S.nb, S.na);
    S.lg = card('∀x ( x ∈ A → x ∈ B )', C.lilac, 0, 5.2, 6.0);
    cap('用邏輯寫：對所有 x，x ∈ A ⇒ x ∈ B', '一個 implication（若…則…）');
  },
  async (tok, S) => { // 159.9
    S.a = oval('', [1, 2], -3.2, 2.6); S.b = oval('', [1, 2, 3], 2.8, 2.6);
    hd('{1, 2}', -3.2, 3.85); hd('{1, 2, 3}', 2.8, 3.85);
    cap('例子：{1, 2} 是不是 {1, 2, 3} 的 subset？', '');
  },
  async (tok, S) => { // 179.4
    glow(S.a.el[1], OKG); glow(S.b.el[1], OKG); farrow(S.a, 1, S.b, 1, 0x0f5a3a, 0.5, -0.45);
    cap('1 在 {1, 2} 裡，也在 {1, 2, 3} 裡', '');
  },
  async (tok, S) => { // 182.2
    glow(S.a.el[2], OKG); glow(S.b.el[2], OKG); farrow(S.a, 2, S.b, 2, 0x0f5a3a, 0.5, 0.45);
    good('{1, 2} ⊆ {1, 2, 3}', 0, 1.0);
    cap('2 也是 → 每個元素都過關', '所以 {1, 2} ⊆ {1, 2, 3}');
  },
  async (tok, S) => { // 193.7
    glow(S.lg, HL);
    cap('要證 A ⊆ B，就證上面那個 implication', '任取 x ∈ A，推到 x ∈ B');
  },
  async (tok, S) => { // 204.6
    glow(S.lg, null);
    note('⊆ 下面那一橫：可以相等（A ⊆ A 也對）', 0, 0.2);
    cap('⊆ 下面有一橫：A 可以等於 B，但不一定要', '像 ≤ 的那一橫');
  },
]);

scene('sfA-proper', '2A：真子集合 proper subset ⊂', CAM, [
  async (tok, S) => { // 215.5
    hot('A ⊂ B：proper subset（真子集合）', 0, 6.2);
    cap('proper subset 是什麼？', '');
  },
  async (tok, S) => { // 227.8
    card('⊆：可以相等', C.sky, -3.3, 4.8, 3.6); card('⊂：一橫拿掉 → 不會相等', C.peach, 3.0, 4.8, 4.8);
    cap('符號上：把下面那一橫拿掉', '這本書的寫法');
  },
  async (tok, S) => { // 236.8
    S.d = card('A ⊂ B  ⇔  A ⊆ B 而且 A ≠ B', C.lilac, 0, 3.5, 6.6); glow(S.d, HL);
    cap('A 是 B 的部分集合，而且 A 不是 B', '');
  },
  async (tok, S) => { // 258.3
    glow(S.d, null);
    good('{1, 2} ⊂ {1, 2, 3}  ✓', -3.2, 2.1); bad('{1, 2, 3} ⊂ {1, 2, 3}  ✗（相等）', 3.0, 2.1); sm('示意', 0, 1.3);
    cap('subset 可能等於 B；proper subset 一定不等於 B', '所以多一個字：proper');
  },
]);

scene('sfA-disj', '2A：disjoint 與「A = B ⇔ 互為子集」', CAM, [
  async (tok, S) => { // 268.9
    S.a = oval('A', [1, 2], -3.2, 3.2); S.b = oval('B', [3, 4], 3.2, 3.2); sm('示意', 0, 5.6);
    hot('disjoint（不相交）', 0, 6.3);
    cap('兩個集合 disjoint 是什麼意思？', '');
  },
  async (tok, S) => { // 278.9
    S.e = card('A ∩ B = ∅', C.mint, 0, 1.4, 3.4); glow(S.e, HL);
    cap('它們的交集是空集合：沒有共同的元素', 'the intersection of A and B is an empty set');
  },
  async (tok, S) => { // 304.6
    gone(S.a, S.b, S.e);
    hot('要證 A = B，怎麼證？', 0, 6.3);
    cap('要證兩個集合一樣，通常怎麼做？', '');
  },
  async (tok, S) => { // 313.7
    S.d = card('A = B  ⇔  A ⊆ B 而且 B ⊆ A', C.lilac, 0, 5.0, 6.6); glow(S.d, HL);
    ring(-1.2, 2.6, 1.9, 1.3); ring(1.2, 2.6, 1.9, 1.3, '#4b7aa8');
    hd('A', -2.6, 4.0); hd('B', 2.6, 4.0);
    cap('if and only if：A ⊆ B，而且 B ⊆ A', '兩個都要成立');
  },
  async (tok, S) => { // 329.6
    glow(S.d, null);
    note('證 A = B → 證 A ⊆ B，再證 B ⊆ A', 0, 0.8);
    cap('互為部分集合，就只好一樣了', '兩個方向都要證');
  },
]);

const ROWX = [-4.6, -2.3, -0.3, 1.9, 4.5];
scene('sfA-subB', '2A：B = {1,3} 有幾個 subset？一個一個數', CAM, [
  async (tok, S) => { // 340.4
    S.A = oval('A', [1, 2, 3, 4], -3.3, 5.0); S.B = oval('B', [1, 3], 3.4, 5.0, { color: C.orange });
    cap('A = {1, 2, 3, 4}，B = {1, 3}', '');
  },
  async (tok, S) => { // 347.5
    hot('B 有幾個 subset？', 0, 3.6);
    cap('問題：B 有多少個 subset？', '只跟 B 有關');
  },
  async (tok, S) => { // 379.5
    S.c0 = card('∅', C.sand, ROWX[0], 2.3, 1.5); glow(S.c0, HL); sm('0 個元素', ROWX[0], 1.6);
    cap('第一個：空集合 ∅', '∅ 是任何集合的 subset');
  },
  async (tok, S) => { // 391.6
    S.n = note('∅ 沒有元素 → 「每個元素都在 B」自動成立', 0, 0.8);
    cap('為什麼？∅ 裡根本沒有元素會違規', '所以 ∅ ⊆ B');
  },
  async (tok, S) => { // 411.7
    gone(S.n); glow(S.c0, null);
    S.c1 = [card('{1}', C.sky, ROWX[1] - 0.05, 2.3, 1.5), card('{3}', C.sky, ROWX[2] + 0.05, 2.3, 1.5)];
    sm('1 個元素', (ROWX[1] + ROWX[2]) / 2, 1.6);
    cap('一個元素的：{1}、{3}', '兩個');
  },
  async (tok, S) => { // 422.4
    S.c2 = card('{1, 3}', C.peach, ROWX[3], 2.3, 1.6); glow(S.c2, HL); sm('2 個元素', ROWX[3], 1.6);
    cap('兩個元素的：{1, 3}（兩個都在）', '');
  },
  async (tok, S) => { // 432.8
    glow(S.c2, null);
    bad('3 個元素？沒有', ROWX[4], 2.3);
    cap('有沒有三個元素的 subset？沒有', 'B 只有兩個元素');
  },
  async (tok, S) => { // 439.5
    [S.c0, ...S.c1, S.c2].forEach((m) => glow(m, OKG));
    good('答案：4 個', 0, 0.8);
    cap('B 一共有 4 個 subset', '∅、{1}、{3}、{1, 3}');
  },
]);

scene('sfA-pset', '2A：power set P(B)，個數 2ⁿ', CAM, [
  async (tok, S) => { // 442.7
    S.B = oval('B', [1, 3], -5.0, 5.2, { color: C.orange });
    S.ch = ['∅', '{1}', '{3}', '{1, 3}'].map((t, i) => card(t, C.sky, -2.6 + i * 1.75, 5.2, 1.5));
    S.p = hot('P(B)', 5.0, 5.2);
    cap('把這 4 個寫在一起，記作 P(B)', '');
  },
  async (tok, S) => { // 454.0
    hot('2^B', 5.0, 4.4); sm('（另一種寫法）', 5.0, 3.85);
    cap('有些書寫成 2 的 B 次方：2^B', '不同的書寫法不同');
  },
  async (tok, S) => { // 501.2
    S.big = card('P(B) = { ∅, {1}, {3}, {1, 3} }', C.mint, -1.0, 3.7, 6.4); glow(S.big, HL);
    cap('power set：B 的所有 subset 收進一個集合', '每個元素本身都是 B 的一個 subset');
  },
  async (tok, S) => { // 536.2
    glow(S.big, null);
    hot('為什麼寫成 2^B？跟「個數」有關', 0, 2.75);
    cap('為什麼符號寫成 2^B？', '跟 subset 的個數有關');
  },
  async (tok, S) => { // 553.3
    S.k = [card('1：在 或 不在 → 2 種', C.sky, -3.4, 1.9, 4.2), card('3：在 或 不在 → 2 種', C.sky, -3.4, 1.15, 4.2)];
    S.r = good('2 × 2 = 4', 1.5, 1.5);
    cap('不用一個一個列：每個元素都可以在或不在', '2 × 2 = 4');
  },
  async (tok, S) => { // 590.7
    gone(S.k, S.r);
    [1, 2, 3, 4].forEach((v, i) => { cube(String(v), C.blue, [0.6, 0.52, 0.4], -5.2 + i * 1.3, 1.6, 0.2, 0.9); sm('×2', -5.2 + i * 1.3, 0.95); });
    S.r = good('A：2 × 2 × 2 × 2 = 2⁴ = 16', 1.9, 1.6);
    cap('A 有四個元素：1、2、3、4 各兩種', '2⁴ = 16 個 subset');
  },
  async (tok, S) => { // 610.5
    S.f = card('|P(S)| = 2^|S|', C.lilac, 1.9, 0.6, 3.6); glow(S.f, HL);
    cap('subset 的個數只跟元素個數有關', '元素個數寫在指數上');
  },
  async (tok, S) => { // 633.5
    glow(S.f, null);
    note('2^B 只是符號，意思跟 P(B) 一樣', 1.6, 6.3);
    cap('2^B 只是一個符號，不用想太多', '跟 P(B) 同一個意思');
  },
]);

scene('sfA-propcnt', '2A：proper subset 的個數：3、15、31', CAM, [
  async (tok, S) => { // 682.0
    S.B = oval('B', [1, 3], -5.0, 5.0, { color: C.orange });
    S.ch = ['∅', '{1}', '{3}', '{1, 3}'].map((t, i) => card(t, C.sky, -2.6 + i * 1.75, 5.0, 1.5));
    hot('B 有幾個 proper subset？', 1.5, 6.2);
    cap('那 B 有幾個 proper subset？', '');
  },
  async (tok, S) => { // 692.4
    glow(S.ch[3], NG); bad('B 自己 ✗', 2.65, 4.3);
    good('4 − 1 = 3 個', 5.3, 5.0);
    cap('subset 有 4 個，把 B 自己拿掉', '答案是 3');
  },
  async (tok, S) => { // 709.6
    card('proper subset：是 B 的 subset，而且不是 B', C.lilac, 0, 3.3, 6.8);
    cap('因為 proper subset 的定義', '是 subset，而且不等於 B');
  },
  async (tok, S) => { // 719.8
    card('A = {1, 2, 3, 4}：2⁴ − 1 = 15', C.mint, 0, 2.3, 6.0);
    cap('A 有幾個 proper subset？15 個', '全部 2⁴ 個，減掉自己');
  },
  async (tok, S) => { // 732.0
    card('C 有 5 個元素：2⁵ − 1 = 31', C.peach, 0, 1.4, 6.0);
    sm('依此類推：n 個元素 → 2ⁿ − 1', 0, 0.6);
    cap('C 有 5 個元素：2⁵ − 1', '依此類推');
  },
]);

const SUBS = [[], [1], [2], [3], [4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4], [1, 2, 3, 4]];
const sname = (s) => (s.length ? '{' + s.join(',') + '}' : '∅');
scene('sfA-disjcnt', '2A：A 的 subset 中有幾個和 B disjoint？', CAM, [
  async (tok, S) => { // 744.1
    S.A = oval('A', [1, 2, 3, 4], -3.6, 5.3); S.B = oval('B', [1, 3], -3.6, 3.2, { color: C.orange });
    hot('A 的 subset 中，有幾個和 B disjoint？', 0, 6.75);
    cap('第三個問題：A 的 subset 中，幾個跟 B disjoint？', 'How many subsets of A are disjoint from B?');
  },
  async (tok, S) => { // 756.2
    sm('disjoint：交集是 ∅', -3.6, 2.0);
    cap('disjoint：兩個的交集是空集合', '');
  },
  async (tok, S) => { // 762.0
    S.g = SUBS.map((s, i) => card(sname(s), C.sky, 0.9 + (i % 4) * 1.7, 5.9 - Math.floor(i / 4) * 0.8, 1.55, 0.5, 0, 0.8));
    sm('A 的 2⁴ = 16 個 subset', 3.45, 2.6);
    cap('A 一共有 2⁴ = 16 個 subset', '');
  },
  async (tok, S) => { // 782.8
    for (let i = 0; i < 16; i++) { glow(S.g[i], SUBS[i].some((v) => v === 1 || v === 3) ? NG : OKG); await wt(tok, 90); }
    cap('笨方法：16 個一個一個跟 B 做交集', '可以，只是麻煩一點');
  },
  async (tok, S) => { // 802.2
    S.g.forEach((m) => glow(m, null));
    glow(S.A.el[1], NG); glow(S.A.el[3], NG);
    S.d = card('A − B', C.peach, -3.6, 1.3, 3.0);
    cap('快一點：先把 A 裡面 B 的部分扣掉', '算 difference：A − B');
  },
  async (tok, S) => { // 820.6
    kill(S.d); S.d = card('A − B = {2, 4}', C.mint, -3.6, 1.3, 3.6); glow(S.d, HL);
    glow(S.A.el[2], OKG); glow(S.A.el[4], OKG);
    cap('扣掉以後剩下 {2, 4}', '它的 subset 都碰不到 1 和 3');
  },
  async (tok, S) => { // 830.0
    SUBS.forEach((s, i) => { if (!s.some((v) => v === 1 || v === 3)) glow(S.g[i], OKG); });
    cap('{2, 4} 的每個 subset 都跟 B disjoint', '∅、{2}、{4}、{2, 4}');
  },
  async (tok, S) => { // 848.7
    good('答案：2² = 4 個', -3.6, 0.45);
    cap('2 跟 4 各可以在或不在：2² = 4', '答案是 4');
  },
]);

vscene('sfA-lawc', '2A：補集的定律：(Aᶜ)ᶜ、A ∩ Aᶜ、A ∪ Aᶜ', 1, [
  async (tok, S) => { // 870.0
    say2(S, '∩、∪、complement 要滿足的 law');
    cap('交集、聯集、補集會滿足一些定律（law）', '');
  },
  async (tok, S) => { // 913.6
    await shade(tok, S, (m) => !m.A, C.pink); say2(S, 'Aᶜ', 'A 的外面');
    cap('A 取 complement：不在 A 裡面的', '');
  },
  async (tok, S) => { // 921.4
    await shade(tok, S, (m) => m.A, C.blue); say2(S, '(Aᶜ)ᶜ = A', '補集再取補集 → 回到 A');
    cap('再取一次 complement → 就是 A 自己', '「不在 A」的否定 = 在 A');
  },
  async (tok, S) => { // 939.6
    await shade(tok, S, () => false, C.blue); say2(S, 'A ∩ Aᶜ = ∅', '在 A 又不在 A：沒有');
    cap('A ∩ Aᶜ = 空集合', '一邊在 A 裡，一邊不在，沒有共同的');
  },
  async (tok, S) => { // 965.4
    await shade(tok, S, () => true, C.green); say2(S, 'A ∪ Aᶜ = U', '全部（universe）');
    cap('A ∪ Aᶜ = universe', '不在 A 的，再聯集回 A，就是全部');
  },
]);

vscene('sfA-comm', '2A：交換律 A ∩ B = B ∩ A', 2, [
  async (tok, S) => { // 998.3
    say2(S, 'Commutative law 交換律');
    cap('交換律：運算順序換過來，答案不變', '');
  },
  async (tok, S) => { // 1022.5
    await shade(tok, S, (m) => m.A && m.B, C.purple); say2(S, 'A ∩ B = B ∩ A', '在 A 又在 B ＝ 在 B 又在 A');
    cap('交集滿足交換律', 'A ∩ B = B ∩ A');
  },
  async (tok, S) => { // 1048.1
    await shade(tok, S, (m) => m.A || m.B, C.blue); say2(S, 'A ∪ B = B ∪ A', '在 A 或在 B ＝ 在 B 或在 A');
    cap('聯集也滿足交換律', 'A ∪ B = B ∪ A');
  },
  async (tok, S) => { // 1068.0
    await shade(tok, S, () => false, C.blue); say2(S, '反例：矩陣乘法 AB ≠ BA', '(2×3)(3×1) 可以乘；反過來 (3×1)(2×3) 根本不能乘（示意）');
    cap('不是所有運算都有交換律', '例如矩陣乘法');
  },
]);

vscene('sfA-assoc', '2A：結合律 (A ∩ B) ∩ C = A ∩ (B ∩ C)', 3, [
  async (tok, S) => { // 1090.0
    say2(S, 'Associative law 結合律', '三個在一起時，括號括哪裡都一樣');
    cap('結合律：比交換律更常見', '');
  },
  async (tok, S) => { // 1122.4
    await shade(tok, S, (m) => m.A && m.B, C.sky, 400);
    await shade(tok, S, (m) => m.A && m.B && m.C, C.purple, 400); say2(S, '(A ∩ B) ∩ C', '先算括號：A ∩ B，再跟 C 交集');
    cap('(A ∩ B) ∩ C：括號裡的先做', '');
  },
  async (tok, S) => { // 1143.1
    await shade(tok, S, (m) => m.B && m.C, C.sky, 400);
    await shade(tok, S, (m) => m.A && m.B && m.C, C.purple, 400); say2(S, '(A ∩ B) ∩ C = A ∩ (B ∩ C)', '先 B ∩ C 再跟 A 交集：塗出來一樣');
    cap('先 B ∩ C 再跟 A 交集：一樣', '');
  },
  async (tok, S) => { // 1159.0
    await shade(tok, S, (m) => m.A || m.B || m.C, C.blue); say2(S, '(A ∪ B) ∪ C = A ∪ (B ∪ C)', '聯集也滿足結合律');
    cap('聯集也滿足結合律', '');
  },
  async (tok, S) => { // 1170.1
    await shade(tok, S, (m) => m.A && m.B && m.C, C.purple); say2(S, 'A ∩ B ∩ C', '括號可以不寫：沒有 ambiguity');
    cap('所以可以直接寫三個交集在一起', '本來交集只定義兩個集合');
  },
  async (tok, S) => { // 1197.3
    say2(S, '矩陣乘法：(AB)C = A(BC)', '滿足結合律，但不滿足交換律');
    cap('矩陣乘法：有結合律，沒有交換律', '');
  },
]);

// ════════ BxbJxYFSOdo（2B：Logic and Set Theory）與 r8HEDHCKhR4（2B：Set Theory）共用 ════════
vscene('sfA-dist', '2B：分配律（三個集合的文氏圖）', 3, [
  async (tok, S) => { // 4.5
    say2(S, 'Distributive law 分配律');
    cap('第四個：分配律', '');
  },
  async (tok, S) => { // 8.2
    await shade(tok, S, (m) => m.A && m.B, C.sky, 400);
    await shade(tok, S, (m) => (m.A && m.B) || m.C, C.blue, 400); say2(S, '(A ∩ B) ∪ C', '先 A ∩ B，再聯集 C');
    cap('先做 A ∩ B，得到一個集合，再聯集 C', '');
  },
  async (tok, S) => { // 16.3 / 12.8
    await shade(tok, S, (m) => m.A || m.C, C.sky, 400);
    await shade(tok, S, (m) => (m.A || m.C) && (m.B || m.C), C.blue, 400); say2(S, '(A ∩ B) ∪ C = (A ∪ C) ∩ (B ∪ C)', '(A ∪ C) ∩ (B ∪ C) 塗出來一樣');
    cap('跟 (A ∪ C) ∩ (B ∪ C) 一樣', '');
  },
  async (tok, S) => { // 28.6 / 31.8
    say2(S, '就像 a × (b + c) = a × b + a × c', '乘法對加法有分配律');
    cap('就像數字的加法、乘法', '先加再乘 = 先乘再加');
  },
  async (tok, S) => { // 44.7 / 43.0
    await shade(tok, S, (m) => (m.A || m.B) && m.C, C.purple); say2(S, '(A ∪ B) ∩ C', '交集對聯集、聯集對交集都有分配律');
    cap('反過來也成立：(A ∪ B) ∩ C', '');
  },
  async (tok, S) => { // 76.8
    await shade(tok, S, (m) => m.A && m.C, '#cbb8f6', 400);
    await shade(tok, S, (m) => (m.A && m.C) || (m.B && m.C), C.purple, 400); say2(S, '(A ∪ B) ∩ C = (A ∩ C) ∪ (B ∩ C)', '老師更正板書後的兩條分配律');
    cap('= (A ∩ C) ∪ (B ∩ C)', '');
  },
]);

vscene('sfA-dm', '2B：集合版 De Morgan（文氏圖看一下）', 2, [
  async (tok, S) => { // 102.5 / 94.4
    say2(S, "De Morgan's law（集合版）");
    cap("第五個：De Morgan's law", '前面邏輯講過的');
  },
  async (tok, S) => { // 114.9
    say2(S, '邏輯版：¬(p ∧ q) ≡ ¬p ∨ ¬q', '現在換成集合版');
    cap('那是邏輯的版本，現在是集合的版本', '');
  },
  async (tok, S) => { // 118.4
    await shade(tok, S, (m) => !(m.A && m.B), C.orange); say2(S, '(A ∩ B)ᶜ = Aᶜ ∪ Bᶜ', '全部取 complement，∩ 和 ∪ 對調');
    cap('(A ∩ B)ᶜ = Aᶜ ∪ Bᶜ', '');
  },
  async (tok, S) => { // 157.7 / 157.7
    await shade(tok, S, (m) => !(m.A || m.B), C.blue); say2(S, '(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', '另一條');
    cap('(A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', '我們來證這一條');
  },
  async (tok, S) => { // 194.0 / 183.1
    await shade(tok, S, (m) => m.A || m.B, '#9fc4ea'); say2(S, '左邊：先看 A ∪ B', '');
    cap('左邊：A ∪ B 是這一塊', '');
  },
  async (tok, S) => { // 199.6 / 200.5
    await shade(tok, S, (m) => !(m.A || m.B), C.blue); say2(S, '(A ∪ B)ᶜ：外面', '');
    cap('它的 complement 就是外面', '');
  },
  async (tok, S) => { // 205.8 / 203.7
    await shade(tok, S, (m) => !m.A, '#f0b4cf'); say2(S, '右邊：Aᶜ = A 的外面', '');
    cap('右邊：Aᶜ 是 A 的外面', '');
  },
  async (tok, S) => { // 210.7
    await shade(tok, S, (m) => !m.B, '#f6d0a8'); say2(S, 'Bᶜ = B 的外面', '');
    cap('Bᶜ 是 B 的外面', '');
  },
  async (tok, S) => { // 215.8 / 216.3
    await shade(tok, S, (m) => !m.A && !m.B, C.blue); say2(S, 'Aᶜ ∩ Bᶜ = 兩個的外面', '和左邊塗出來一模一樣');
    cap('交集起來：既不是 A 也不是 B → 兩塊一樣', '');
  },
  async (tok, S) => { // 221.8 / 220.0
    say2(S, 'Venn diagram 只是幫你看，不是證明', '還是要好好寫一個證明');
    cap('畫個 Venn diagram 不算證明', '');
  },
]);

scene('sfA-dmpf', '2B：逐元素證明 (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', CAM, [
  async (tok, S) => { // 227.4
    hot('證明 (A ∪ B)ᶜ = Aᶜ ∩ Bᶜ', 0, 6.75);
    S.d = card('X = Y  ⇔  X ⊆ Y 而且 Y ⊆ X', C.lilac, 0, 6.05, 6.4); glow(S.d, HL);
    cap('要證兩個集合相等：證互為 subset', '');
  },
  async (tok, S) => { // 243.2
    glow(S.d, null);
    note('證 X ⊆ Y：任取 x ∈ X，推到 x ∈ Y', 0, 5.4);
    cap('證 X ⊆ Y 就是：X 裡任何元素都在 Y 裡', '');
  },
  async (tok, S) => { // 261.1
    hd('⊆ 方向', -3.4, 4.85); S.L = chain(-3.4, 4.3, 0.6, 6.2);
    S.L.add('x ∈ (A ∪ B)ᶜ'); S.goal = sm('目標：x ∈ Aᶜ ∩ Bᶜ', -3.4, 0.05);
    cap('任取 x 在左邊，最後要推到 x 在右邊', '中間一步一步填滿');
  },
  async (tok, S) => { // 315.2 / 316.9
    S.L.add('⇒ x ∉ A ∪ B');
    cap('在 complement 裡 = 不屬於原來的集合', 'complement 的定義');
  },
  async (tok, S) => { // 347.9
    S.L.add('⇒ ¬( x ∈ A ∪ B )');
    cap('「不屬於」就是「屬於」這句話的否定', '');
  },
  async (tok, S) => { // 355.6 / 356.6
    S.L.add('⇒ ¬( x ∈ A ∨ x ∈ B )');
    cap('x ∈ A ∪ B 的意思：x ∈ A 或 x ∈ B', '聯集的定義');
  },
  async (tok, S) => { // 376.1
    S.L.add('⇒ x ∉ A ∧ x ∉ B', null, C.peach);
    cap("用邏輯的 De Morgan's law：or 變 and", '不在 A，也不在 B');
  },
  async (tok, S) => { // 405.4 / 405.6
    S.L.add('⇒ x ∈ Aᶜ ∧ x ∈ Bᶜ');
    cap('不在 A → 在 Aᶜ；不在 B → 在 Bᶜ', '');
  },
  async (tok, S) => { // 420.0
    S.L.add('⇒ x ∈ Aᶜ ∩ Bᶜ  ✓', null, C.mint); kill(S.goal);
    cap('同時在 Aᶜ 和 Bᶜ → 在交集裡', '(A ∪ B)ᶜ ⊆ Aᶜ ∩ Bᶜ 證完');
  },
  async (tok, S) => { // 470.9 / 461.3
    hd('⊇ 方向（反過來）', 3.4, 4.85); S.R = chain(3.4, 4.3, 0.6, 6.2);
    S.R.add('x ∈ Aᶜ ∩ Bᶜ');
    cap('再證另一個方向', '任取 x 在右邊，目標推到左邊');
  },
  async (tok, S) => { // 510.7 / 510.9
    S.R.add('⇒ x ∉ A ∧ x ∉ B');
    cap('在交集 = 在 Aᶜ 而且在 Bᶜ = 不在 A 也不在 B', '定義');
  },
  async (tok, S) => { // 535.0 / 529.0
    S.R.add('⇒ ¬( x ∈ A ∨ x ∈ B )', null, C.peach);
    cap("De Morgan 倒過來用：這是一個 statement 的否定", '');
  },
  async (tok, S) => { // 553.5 / 553.4
    S.R.add('⇒ x ∉ A ∪ B ⇒ x ∈ (A ∪ B)ᶜ  ✓', null, C.mint);
    cap('x 不在 A ∪ B → x 在 (A ∪ B)ᶜ', 'Aᶜ ∩ Bᶜ ⊆ (A ∪ B)ᶜ');
  },
  async (tok, S) => { // 582.8 / 582.7
    good('互為 subset ⇒ 兩邊相等 ∎', 3.4, 1.2);
    cap('兩邊互為部分集合，只可能相等', '證完');
  },
  async (tok, S) => { // 615.5 / 615.3
    glow(S.d, HL);
    note('「相等」⇔ A ⊆ B 而且 B ⊆ A（回答同學的問題）', 0, 0.35);
    cap('A = B 若且唯若 A ⊆ B 且 B ⊆ A', '所以剛剛證的就是相等');
  },
]);

vscene('sfA-lawvenn', '2B：[A ∪ (B ∩ C)]ᶜ 兩邊先用文氏圖看', 3, [
  async (tok, S) => { // 651.5
    say2(S, '先用 Venn diagram 看一下（不是證明）', '三個 set：三個圓圈');
    cap('現在用前面那些 law 來證', '先用三個圓的 Venn diagram 看一看');
  },
  async (tok, S) => { // 673.1 / 673.2
    await shade(tok, S, (m) => m.B && m.C, C.sky); say2(S, 'B ∩ C', '中間這一塊');
    cap('左邊：B ∩ C 是中間這一塊', '');
  },
  async (tok, S) => { // 680.3 / 681.7
    await shade(tok, S, (m) => m.A || (m.B && m.C), '#9fc4ea'); say2(S, 'A ∪ (B ∩ C)', '再聯集 A');
    cap('再聯集 A', '');
  },
  async (tok, S) => { // 683.6 / 686.4
    await shade(tok, S, (m) => !(m.A || (m.B && m.C)), C.blue); say2(S, '左邊：[A ∪ (B ∩ C)]ᶜ', '取 complement：外面的部分');
    cap('取 complement：它的外面', '這是左邊');
  },
  async (tok, S) => { // 714.3
    await shade(tok, S, (m) => !m.C && !m.A, '#f6d0a8'); say2(S, 'Cᶜ ∩ Aᶜ', 'A 和 C 的外面');
    cap('右邊：Cᶜ ∩ Aᶜ，A 跟 C 的外面', '');
  },
  async (tok, S) => { // 737.0
    await shade(tok, S, (m) => !m.A && !m.B, '#f0b4cf'); say2(S, 'Aᶜ ∩ Bᶜ', 'A 和 B 的外面');
    cap('Aᶜ ∩ Bᶜ：不在 A 也不在 B', '');
  },
  async (tok, S) => { // 744.1
    await shade(tok, S, (m) => (!m.C && !m.A) || (!m.A && !m.B), C.blue); say2(S, '右邊：(Cᶜ ∩ Aᶜ) ∪ (Aᶜ ∩ Bᶜ)', '和左邊塗出來一樣');
    cap('全部聯集起來：和左邊一樣', '只是看一下而已');
  },
]);

scene('sfA-lawchain', '2B：用定律化簡：De Morgan、交換、分配', CAM, [
  async (tok, S) => { // 759.2
    hot('[A ∪ (B ∩ C)]ᶜ = (Cᶜ ∩ Aᶜ) ∪ (Aᶜ ∩ Bᶜ)', 0, 6.75);
    S.n = note('前面那幾個 law 都可以直接用', 0, 6.1);
    cap('證明時，前面那幾條 law 都可以用', '');
  },
  async (tok, S) => { // 784.7
    sm('策略：化到你覺得最簡單，再跟另一邊比一比', 0, 5.5);
    cap('又交集又聯集又 complement 的式子', '一邊化到最簡，跟另一邊比');
  },
  async (tok, S) => { // 830.3 / 832.8
    S.L = chain(-1.3, 4.85, 0.6, 7.0, 4.9);
    S.L.add('[A ∪ (B ∩ C)]ᶜ', null, C.lilac); S.L.add('= Aᶜ ∩ (B ∩ C)ᶜ');
    sm("De Morgan's law", 4.9, 4.25);
    cap("一看就是 De Morgan's law", '聯集的補集 → 補集的交集');
  },
  async (tok, S) => { // 834.9 / 842.2
    S.L.add('= Aᶜ ∩ (Bᶜ ∪ Cᶜ)', null, C.sky); sm("De Morgan's law", 4.9, 3.65);
    cap("裡面再用一次 De Morgan's law", '');
  },
  async (tok, S) => { // 884.6 / 884.9
    S.L.add('= (Bᶜ ∪ Cᶜ) ∩ Aᶜ'); sm('交換律（∩）', 4.9, 3.05);
    cap('交集的交換律：前後對調', 'commutative law');
  },
  async (tok, S) => { // 893.6
    S.L.add('= (Bᶜ ∩ Aᶜ) ∪ (Cᶜ ∩ Aᶜ)', null, C.peach); sm('分配律', 4.9, 2.45);
    cap('再用分配律做下去', 'distributive law');
  },
  async (tok, S) => { // 924.8 / 924.9
    S.L.ls.forEach((m) => glow(m, null));
    note('跟目標比一比：只差順序', 0, 6.1); kill(S.n);
    cap('跟目標比較：差不多了，只差順序', '');
  },
  async (tok, S) => { // 954.3 / 954.1
    S.L.add('= (Cᶜ ∩ Aᶜ) ∪ (Bᶜ ∩ Aᶜ)'); sm('交換律（∪）', 4.9, 1.85);
    cap('先把這兩塊對調', '交換律');
  },
  async (tok, S) => { // 969.7 / 964.7
    S.L.add('= (Cᶜ ∩ Aᶜ) ∪ (Aᶜ ∩ Bᶜ)', null, C.mint); sm('交換律（∩）', 4.9, 1.25);
    cap('再把裡面順序換一換', '交換律');
  },
  async (tok, S) => { // 996.0 / 989.6
    good('= 右邊 ∎', -1.3, 0.45);
    cap('就證出來了', '看到什麼 law 就用什麼');
  },
]);

vscene('sfA-regions', '2B：三個集合的文氏圖有 2³ = 8 塊', 3, [
  async (tok, S) => { // 1035.0 / 1036.9
    say2(S, '三個 set 的 Venn diagram：幾個區域？');
    cap('三個集合 A、B、C 的 Venn diagram', '這邊有幾個區域？');
  },
  async (tok, S) => { // 1043.2
    S.nums = ['A', 'AB', 'B', 'AC', 'ABC', 'BC', 'C', 'U'].map((k, i) => tag(String(i + 1), 'ptr alt', S.V.cent[k].x, 1.0, S.V.cent[k].z));
    say2(S, '1、2、…、7，再加外面：8 個區域');
    cap('裡面 7 塊，還有外面，一共 8 塊', '');
  },
  async (tok, S) => { // 1046.1 / 1047.6
    say2(S, '為什麼是 8 = 2³？');
    cap('為什麼是 2 的 3 次方？', '');
  },
  async (tok, S) => { // 1055.4 / 1054.8
    await shade(tok, S, (m) => RK(m) === 'AB', C.purple); say2(S, 'A ∩ B ∩ Cᶜ', '在 A、在 B、不在 C');
    cap('這塊：在 A 又在 B，不在 C', 'A ∩ B ∩ Cᶜ');
  },
  async (tok, S) => { // 1070.7 / 1068.2
    await shade(tok, S, (m) => RK(m) === 'C', C.orange); say2(S, 'Aᶜ ∩ Bᶜ ∩ C', '不在 A、不在 B、在 C');
    cap('這塊：不在 A、不在 B，在 C', 'Aᶜ ∩ Bᶜ ∩ C');
  },
  async (tok, S) => { // 1092.7
    await shade(tok, S, () => false, C.blue); say2(S, '每塊 = A(ᶜ?) ∩ B(ᶜ?) ∩ C(ᶜ?)', '每個集合：有沒有 complement 兩種 → 2 × 2 × 2 = 8');
    cap('每一塊：A、B、C 各自有沒有取 complement', '2 × 2 × 2 = 8 種');
  },
]);

// ── r8HEDHCKhR4 才有的部分 ──
const E4 = [[-0.61, -0.36, 3.28, 1.31, 0.87], [-0.97, 0.96, 3.28, 1.31, 0.81], [0.97, 0.96, 3.28, 1.31, -0.81], [0.61, -0.36, 3.28, 1.31, -0.87]];
function venn4pts(E) {
  const pts = {};
  for (let x = -5; x <= 5; x += 0.1) for (let y = -0.8; y <= 7; y += 0.1) {
    let k = ''; E.forEach(([cx, cy, rx, ry, r], i) => { const dx = x - cx, dy = y - cy, u = dx * Math.cos(r) + dy * Math.sin(r), v = -dx * Math.sin(r) + dy * Math.cos(r); if ((u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1) k += 'ABCD'[i]; });
    if (k) (pts[k] ||= []).push([x, y]);
  }
  return pts;
}
scene('sfA-venn4', '2B：四個集合的文氏圖：16 塊', CAM, [
  async (tok, S) => { // 1110.2
    const s = 0.9, oy = 3.0;
    S.E = E4.map(([cx, cy, rx, ry, r]) => [cx * s, cy * s + oy, rx * s, ry * s, r]);
    S.E.forEach(([cx, cy, rx, ry, r]) => ring(cx, cy, rx, ry, '#8a7a60', r, 0));
    S.pts = venn4pts(S.E);
    // 集合名字放在「只屬於它」那一塊裡離中心最遠的點
    ['A', 'B', 'C', 'D'].forEach((k) => { let best = null, bd = -1; (S.pts[k] || []).forEach((q) => { const d = q[0] ** 2 + (q[1] - oy) ** 2; if (d > bd) { bd = d; best = q; } }); if (best) hd(k, best[0] * 0.92, oy + (best[1] - oy) * 0.92, 0.3); });
    cap('四個 set 的 Venn diagram 也畫得出來', '只是很少看到');
  },
  async (tok, S) => { // 1124.4
    const keys = Object.keys(S.pts).sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
    keys.forEach((k, i) => { const p = S.pts[k], mx = p.reduce((t, q) => t + q[0], 0) / p.length, my = p.reduce((t, q) => t + q[1], 0) / p.length; let best = p[0], bd = 1e9; p.forEach((q) => { const d = (q[0] - mx) ** 2 + (q[1] - my) ** 2; if (d < bd) { bd = d; best = q; } }); sm(String(i + 1), best[0], best[1], 0.3); });
    sm(String(keys.length + 1) + '（外面）', 5.0, 6.2, 0.3);
    good('2⁴ = 16 個區域', -5.0, 6.2);
    cap('數一數：連外面一共 16 塊', '2⁴ = 16，沒錯');
  },
  async (tok, S) => { // 1144.1
    note('五個集合：已經不太能畫了', 0, -0.4);
    cap('五個的就不太能畫了', '好玩而已');
  },
]);

scene('sfA-bigop', '2B：n 個集合的交集 ⋂ 與聯集 ⋃', CAM, [
  async (tok, S) => { // 1163.6
    S.a = card('(A ∩ B) ∩ C = A ∩ (B ∩ C) = A ∩ B ∩ C', C.lilac, 0, 5.8, 7.2); glow(S.a, HL);
    cap('交集、聯集都滿足結合律', '所以可以寫三個在一起');
  },
  async (tok, S) => { // 1184.6
    glow(S.a, null);
    S.b = card('A₁ ∩ A₂ ∩ ⋯ ∩ Aₙ', C.sky, 0, 4.6, 5.2); glow(S.b, HL);
    cap('推廣到 n 個集合交集在一起', '不管怎麼括，答案都一樣');
  },
  async (tok, S) => { // 1199.3
    glow(S.b, null);
    S.c = card('⋂ᵢ₌₁ⁿ Aᵢ  =  A₁ ∩ A₂ ∩ ⋯ ∩ Aₙ', C.mint, 0, 3.4, 6.6); glow(S.c, HL);
    sm('像 Σ：Σᵢ₌₁ⁿ aᵢ = a₁ + a₂ + ⋯ + aₙ', 0, 2.75);
    cap('寫成像 summation 那樣的符號', '只是懶得寫那麼長');
  },
  async (tok, S) => { // 1218.8
    glow(S.c, null);
    S.d = card('⋃ᵢ₌₁ⁿ Aᵢ  =  A₁ ∪ A₂ ∪ ⋯ ∪ Aₙ', C.peach, 0, 1.9, 6.6); glow(S.d, HL);
    cap('同理，聯集也有一個符號', '');
  },
  async (tok, S) => { // 1241.6
    glow(S.d, null);
    note('能這樣寫，是因為有 associative law（結合律）', 0, 0.9);
    cap('可以這樣寫，是因為結合律', '括到哪裡都一樣');
  },
]);

scene('sfA-card', '2B：finite set 與 cardinality |A|', CAM, [
  async (tok, S) => { // 1253.2
    S.f = oval('', [1, 3], -3.4, 4.2, { color: C.orange }); hd('finite set（有限集合）', -3.4, 5.6); sm('元素個數有限（示意）', -3.4, 3.0);
    cap('finite set：元素的個數是有限的', '');
  },
  async (tok, S) => { // 1287.3
    S.i = oval('', [1, 2, 3, 4, '…'], 3.4, 4.2, { sp: 0.8 }); hd('infinite set（無限集合）', 3.4, 5.6); sm('例：{1, 2, 3, …}（示意）', 3.4, 3.0);
    cap('不是 finite set，就是 infinite set', '元素有無限多個');
  },
  async (tok, S) => { // 1327.1
    S.c = card('|A|', C.lilac, 0, 1.9, 1.6); glow(S.c, HL);
    cap('A 是 finite set 時，定義一個符號 |A|', '像絕對值那樣框起來');
  },
  async (tok, S) => { // 1351.4
    glow(S.c, null);
    hd('cardinality ／ order ／ size', 0, 1.2);
    cap('叫做 cardinality，也叫 order 或 size', '');
  },
  async (tok, S) => { // 1389.5
    kill(S.c); S.c = card('|A| ≜ A 的元素個數　例：|{1, 3}| = 2', C.mint, 0, 1.9, 7.0); glow(S.c, HL);
    cap('|A| 定義成 A 裡面元素的個數', 'number of elements in A');
  },
  async (tok, S) => { // 1397.3
    glow(S.c, null);
    note('只對 finite set 定義（infinite set 沒有這個值）', 3.0, 0.45);
    cap('只有 finite set 才定義 |A|', '');
  },
]);

// ════════ zsQ-r279BbA（趙啟超 4A：Functions） ════════
// 示意用的小集合：A = {a₁,a₂,a₃}，B = {b₁,b₂,b₃}，C = {c₁,c₂}
const FA = ['a₁', 'a₂', 'a₃'], FB = ['b₁', 'b₂', 'b₃'], FC = ['c₁', 'c₂'];
const F1 = { 'a₁': 'b₂', 'a₂': 'b₁', 'a₃': 'b₃' }, G1 = { 'b₁': 'c₁', 'b₂': 'c₂', 'b₃': 'c₂' };
scene('sfA-comp', '4A：合成函數 g ∘ f：先 f 再 g', CAM, [
  async (tok, S) => { // 4.3
    S.ch = [card('one-to-one（injective）', C.sky, -4.3, 5.6, 3.6), card('onto（surjective）', C.sky, 0, 5.6, 3.4), card('1-1 correspondence（bijective）', C.sky, 4.4, 5.6, 4.2)];
    cap('前面：函數的定義、1-1、onto、1-1 correspondence', 'injective、surjective、bijective');
  },
  async (tok, S) => { // 7.2
    gone(S.ch);
    S.A = oval('A', FA, -4.5, 2.8, { dir: 'col' }); S.B = oval('B', FB, 0, 2.8, { dir: 'col', color: C.orange });
    S.fa = FA.map((a) => farrow(S.A, a, S.B, F1[a], 0x2a6fb0));
    hd('f: A → B', -2.25, 5.4); sm('示意', 0, 0.3);
    cap('第一個函數 f：domain A，codomain B', '把兩個函數「合成」，可以看成一種運算');
  },
  async (tok, S) => { // 34.3
    S.C = oval('C', FC, 4.5, 2.8, { dir: 'col', color: C.green });
    S.ga = FB.map((b) => farrow(S.B, b, S.C, G1[b], 0xb05a2a));
    hd('g: B → C', 2.25, 5.4);
    cap('另一個函數 g：domain B，codomain C', '');
  },
  async (tok, S) => { // 43.3
    S.t = hot('g ∘ f : A → C', 0, 6.4);
    cap('合成 g ∘ f（g 圈 f）：也是一個函數', 'domain A、codomain C');
  },
  async (tok, S) => { // 74.0
    S.d = card('(g ∘ f)(a) = g( f(a) )', C.lilac, 0, 0.5, 4.6); glow(S.d, HL);
    S.m = dot(-4.5, S.A.pos['a₁'][1]); await hop(tok, S.m, S.A, 'a₁', S.B, 'b₂');
    cap('a 先經過 f，跑到 B 裡面：f(a)', '');
  },
  async (tok, S) => { // 99.5
    await hop(tok, S.m, S.B, 'b₂', S.C, 'c₂');
    cap('再經過 g，跑到 C：g(f(a))', '這就是 (g ∘ f)(a)');
  },
  async (tok, S) => { // 110.2
    glow(S.d, null);
    note('裡面的先做：f 先、g 後；f 寫在右邊', 0, 6.35); kill(S.t);
    cap('括號裡面的先做', 'f 在右邊先做，g 在左邊後做');
  },
  async (tok, S) => { // 119.5
    bad('g ∘ f ≠ f ∘ g（不滿足交換律）', -3.2, -0.3);
    cap('這個運算不 commute', 'g ∘ f 跟 f ∘ g 不一樣');
  },
  async (tok, S) => { // 138.0
    sm('f ∘ g 可能根本沒定義：g 的結果在 C，f 只吃 A', 2.6, -0.3);
    cap('f ∘ g 甚至不見得能做', '像矩陣乘法，反過來有時根本不能乘');
  },
  async (tok, S) => { // 181.5
    kill(S.m); [...S.fa, ...S.ga].forEach((a) => a.traverse((o) => o.material && (o.material.opacity = 0.35, o.material.transparent = true)));
    cap('合成可以這樣想', '跟著一個元素走一遍');
  },
  async (tok, S) => { // 195.5
    glow(S.A.el['a₃'], HL); glow(S.B.el['b₃'], HL); S.x1 = farrow(S.A, 'a₃', S.B, 'b₃', 0x6a4a00, 0.6);
    cap('A 的一點 a，經過 f 對應到 B 的一點 b', '');
  },
  async (tok, S) => { // 209.6
    glow(S.C.el['c₂'], HL); S.x2 = farrow(S.B, 'b₃', S.C, 'c₂', 0x6a4a00, 0.6);
    cap('g 對 B 的每一點都有定義：b 再跑到 C 的 c', '');
  },
  async (tok, S) => { // 232.2
    FA.forEach((a) => farrow(S.A, a, S.C, G1[F1[a]], 0x0f5a3a, 1.2, 0.12));
    hot('g ∘ f：直接從 A 到 C', 0, 6.4);
    cap('直接看從這邊到這邊：就是合成函數', 'A 到 C 的函數');
  },
]);

scene('sfA-assocf', '4A：合成滿足結合律 h ∘ (g ∘ f) = (h ∘ g) ∘ f', CAM, [
  async (tok, S) => { // 260.2
    const X = [-5.4, -1.8, 1.8, 5.4];
    ['A', 'B', 'C', 'D'].forEach((n, i) => { ring(X[i], 3.0, 0.9, 0.9); hd(n, X[i], 3.0); });
    ['f', 'g', 'h'].forEach((n, i) => { arrow(V3(X[i] + 0.95, 3.0, 0), V3(X[i + 1] - 0.95, 3.0, 0), 0x6e5f49); sm(n, (X[i] + X[i + 1]) / 2, 3.35); });
    S.X = X;
    cap('三個函數：f: A → B，g: B → C，h: C → D', '');
  },
  async (tok, S) => { // 268.4
    const X = S.X; arrow(V3(X[1], 1.9, 0), V3(X[3], 1.9, 0), 0xb05a2a); hd('h ∘ g : B → D', 1.8, 1.45);
    cap('h 可以先跟 g 合成：B 到 D', '');
  },
  async (tok, S) => { // 289.0
    const X = S.X; arrow(V3(X[0], 0.8, 0), V3(X[3], 0.8, 0), 0x6a4a00); hd('(h ∘ g) ∘ f : A → D', 0, 0.35);
    cap('結果再跟 f 合成：A 到 D', '');
  },
  async (tok, S) => { // 306.5
    const X = S.X; arrow(V3(X[0], 4.1, 0), V3(X[2], 4.1, 0), 0x2a6fb0); hd('g ∘ f : A → C', -1.8, 4.55);
    cap('也可以先做 g ∘ f：A 到 C', '');
  },
  async (tok, S) => { // 320.1
    const X = S.X; arrow(V3(X[0], 5.2, 0), V3(X[3], 5.2, 0), 0x6a4a00); hd('h ∘ (g ∘ f) : A → D', 0, 5.65);
    cap('再跟 h 合成：也是 A 到 D', '兩種做法結果一樣');
  },
  async (tok, S) => { // 324.5
    const c = card('h ∘ (g ∘ f) = (h ∘ g) ∘ f = h ∘ g ∘ f', C.mint, 0, 6.5, 6.8); glow(c, HL);
    cap('合成滿足結合律', '所以可以不括號，直接寫三個');
  },
  async (tok, S) => { // 354.0
    note('順序不能亂：domain 和 codomain 要接得起來', 0, -0.4);
    cap('但 domain 和 codomain 要對得上才能合成', '');
  },
]);

scene('sfA-compprops', '4A：合成保持 injective / surjective / bijective', CAM, [
  async (tok, S) => { // 374.2
    [['A', -3], ['B', 0], ['C', 3]].forEach(([n, x]) => { ring(x, 5.6, 0.7, 0.6); hd(n, x, 5.6); });
    arrow(V3(-2.25, 5.6, 0), V3(-0.75, 5.6, 0)); sm('f', -1.5, 5.95); arrow(V3(0.75, 5.6, 0), V3(2.25, 5.6, 0)); sm('g', 1.5, 5.95);
    cap('f: A → B，g: B → C，看 g ∘ f 的幾個性質', '');
  },
  async (tok, S) => { // 389.7
    S.a = card('① f、g 都 injective ⇒ g ∘ f 也 injective', C.sky, 0, 4.0, 7.2); glow(S.a, HL);
    cap('第一：兩個都是 1-1，合成還是 1-1', '');
  },
  async (tok, S) => { // 427.7
    glow(S.a, null); S.b = card('② f、g 都 surjective ⇒ g ∘ f 也 surjective', C.peach, 0, 3.0, 7.2); glow(S.b, HL);
    cap('第二：兩個都是 onto，合成還是 onto', '');
  },
  async (tok, S) => { // 445.3
    glow(S.b, null); S.c = card('③ f、g 都 bijective ⇒ g ∘ f 也 bijective', C.mint, 0, 2.0, 7.2); glow(S.c, HL);
    cap('第三：兩個都是 bijective，合成還是 bijective', '');
  },
]);

scene('sfA-injpf', '4A：證明 injective ∘ injective 是 injective', CAM, [
  async (tok, S) => { // 493.0
    hot('證：f、g 都 injective ⇒ g ∘ f injective', 0, 6.75);
    cap('先證第一點', '假設 f、g 都是 1-1');
  },
  async (tok, S) => { // 503.1
    card('injective：f(a₁) = f(a₂) ⇒ a₁ = a₂', C.lilac, 0, 6.0, 6.6);
    sm('（＝ 不一樣的對到不一樣；用等式比較好處理）', 0, 5.4);
    cap('1-1 的定義：對應過去一樣，原來就一樣', '等式比不等式好處理');
  },
  async (tok, S) => { // 523.1
    S.L = chain(-1.4, 4.6, 0.75, 6.4, 4.6);
    S.L.add('假設 (g ∘ f)(a₁) = (g ∘ f)(a₂)', null, C.lilac);
    cap('先假設合成以後，對應過去一樣', '');
  },
  async (tok, S) => { // 535.8
    S.goal = good('目標：a₁ = a₂', 4.6, 0.6);
    cap('最後要推到 a₁ = a₂', '知道終點，中間想辦法走過去');
  },
  async (tok, S) => { // 580.0
    S.L.add('⇒ g( f(a₁) ) = g( f(a₂) )', '合成的定義');
    cap('根據合成的定義：先帶進 f，再帶進 g', '');
  },
  async (tok, S) => { // 597.2
    S.L.add('⇒ f(a₁) = f(a₂)', 'g 是 injective', C.peach);
    cap('g 是 1-1：g 的結果一樣 → g 裡面的東西一樣', 'f(a₁)、f(a₂) 都是 B 的元素');
  },
  async (tok, S) => { // 635.7
    S.L.add('⇒ a₁ = a₂  ∎', 'f 是 injective', C.mint); txt(S.goal, '目標達成：a₁ = a₂ ✓');
    cap('f 是 1-1 → a₁ = a₂，證完', '只用了定義，一個彎也沒轉');
  },
  async (tok, S) => { // 693.6
    note('直接推不動：從前面推、從後面推，在中間接起來', 0, 0.0);
    cap('有時不好直接推', '就從兩頭推，找個地方接起來');
  },
]);

const FB2 = ['b₁', 'b₂'], F2 = { 'a₁': 'b₁', 'a₂': 'b₂', 'a₃': 'b₂' }, G2 = { 'b₁': 'c₁', 'b₂': 'c₂' };
scene('sfA-surjpf', '4A：證明 surjective ∘ surjective 是 surjective', CAM, [
  async (tok, S) => { // 703.2
    hot('證：f、g 都 surjective ⇒ g ∘ f surjective', 0, 6.75);
    cap('再證第二點：兩個 onto，合成還是 onto', '');
  },
  async (tok, S) => { // 711.6
    card('surjective（onto）：codomain 每個元素都被對到', C.lilac, 0, 6.1, 7.0);
    cap('onto 的定義：對過來這邊，每一個都有人對到', '');
  },
  async (tok, S) => { // 729.7
    S.A = oval('A', FA, -4.5, 2.9, { dir: 'col' }); S.B = oval('B', FB2, 0, 2.9, { dir: 'col', color: C.orange }); S.C = oval('C', FC, 4.5, 2.9, { dir: 'col', color: C.green });
    FA.forEach((a) => farrow(S.A, a, S.B, F2[a], 0x2a6fb0)); FB2.forEach((b) => farrow(S.B, b, S.C, G2[b], 0xb05a2a));
    sm('示意', -6.3, 0.9);
    S.g = card('目標：∀c ∈ C，∃a ∈ A，(g ∘ f)(a) = c', C.sky, 0, 5.45, 6.6); glow(S.g, HL); glow(S.C.el['c₂'], HL);
    cap('要證：C 裡每一個 c，都找得到 A 裡的 a', '經過合成函數對到 c');
  },
  async (tok, S) => { // 753.1
    S.n = note('中間經過 B：反著走兩步回去', 0, 0.75);
    cap('它是中間經過 B，兩次過來的', '所以反著推回去兩次');
  },
  async (tok, S) => { // 797.6
    kill(S.n); glow(S.B.el['b₂'], HL); farrow(S.C, 'c₂', S.B, 'b₂', 0x6a4a00, 0.8, 0.15);
    S.t1 = sm('g onto ⇒ ∃b ∈ B，g(b) = c', 2.4, 0.75);
    cap('因為 g 是 onto：C 裡任何 c，B 裡都有 b 對到它', 'g(b) = c');
  },
  async (tok, S) => { // 853.0
    glow(S.A.el['a₂'], HL); farrow(S.B, 'b₂', S.A, 'a₂', 0x6a4a00, 0.8, 0.15);
    S.t2 = sm('f onto ⇒ ∃a ∈ A，f(a) = b', -2.4, 0.75);
    cap('又因為 f 是 onto：這個 b 也有 a 對到它', 'f(a) = b');
  },
  async (tok, S) => { // 883.3
    gone(S.t1, S.t2);
    S.k = card('c = g(b) = g( f(a) ) = (g ∘ f)(a)', C.mint, -1.4, 0.4, 6.0); glow(S.k, HL);
    cap('把兩個式子串在一起', 'c = g(b)、b = f(a) 帶回去');
  },
  async (tok, S) => { // 913.7
    glow(S.k, null); glow(S.g, OKG);
    good('∀c ∃a ⇒ g ∘ f 是 onto ∎', 4.5, 0.4);
    cap('任何 c 都存在 a：這就是 onto 的定義', '證完');
  },
  async (tok, S) => { // 994.7
    note('橋樑：B 裡的那個 b；只用了定義', 0, 4.75);
    cap('中間的橋樑就是 B 裡那個元素', '完全只用定義，沒轉彎');
  },
]);

scene('sfA-bijc', '4A：bijective ∘ bijective 是 bijective', CAM, [
  async (tok, S) => { // 1027.9
    S.a = card('bijective = injective 而且 surjective', C.lilac, 0, 5.4, 6.4); glow(S.a, HL);
    cap('第三點：bijective 就是又 1-1 又 onto', '');
  },
  async (tok, S) => { // 1041.0
    glow(S.a, null); card('由 ①：g ∘ f 是 injective', C.sky, 0, 4.2, 5.4);
    cap('根據第一點：合成是 injective', '');
  },
  async (tok, S) => { // 1044.7
    card('由 ②：g ∘ f 是 surjective', C.peach, 0, 3.2, 5.4);
    cap('根據第二點：合成是 surjective', '');
  },
  async (tok, S) => { // 1050.6
    good('⇒ g ∘ f 是 bijective ∎', 0, 2.1);
    cap('同時是，所以合成以後也是 bijective', '由 ① 和 ② 直接得到');
  },
]);

const FI = { 'a₁': 'b₂', 'a₂': 'b₃', 'a₃': 'b₁' }, GI = { 'b₂': 'a₁', 'b₃': 'a₂', 'b₁': 'a₃' };
scene('sfA-invdef', '4A：invertible：g ∘ f = 1_A，f ∘ g = 1_B', CAM, [
  async (tok, S) => { // 1073.0
    hot('有運算，就會有 inverse', 0, 6.6);
    S.A = oval('A', FA, -3.2, 3.0, { dir: 'col' }); S.B = oval('B', FB, 3.2, 3.0, { dir: 'col', color: C.orange }); sm('示意', 0, 0.6);
    FA.forEach((a) => farrow(S.A, a, S.B, FI[a], 0x2a6fb0, 0.3, 0.12)); hd('f', 0, 4.9);
    cap('定義完合成，再來是 inverse', '');
  },
  async (tok, S) => { // 1082.7
    FB.forEach((b) => farrow(S.B, b, S.A, GI[b], 0xb05a2a, 0.3, -0.12)); hd('g', 0, 1.2);
    card('f invertible：存在 g: B → A', C.lilac, 0, 5.8, 5.6);
    cap('f 是 invertible：存在另一個函數 g', 'domain、codomain 反過來：B 到 A');
  },
  async (tok, S) => { // 1113.7
    S.m = dot(-3.2, S.A.pos['a₁'][1]);
    await hop(tok, S.m, S.A, 'a₁', S.B, 'b₂', 600); await hop(tok, S.m, S.B, 'b₂', S.A, 'a₁', 600);
    S.c1 = card('① (g ∘ f)(a) = a', C.sky, -4.3, 0.0, 3.6); glow(S.c1, HL);
    cap('A 裡所有 a：先 f 再 g，回到原來的 a', '');
  },
  async (tok, S) => { // 1131.3
    glow(S.c1, null); S.m.position.set(3.2, S.B.pos['b₁'][1], 0.7);
    await hop(tok, S.m, S.B, 'b₁', S.A, 'a₃', 600); await hop(tok, S.m, S.A, 'a₃', S.B, 'b₁', 600);
    S.c2 = card('② (f ∘ g)(b) = b', C.peach, 4.3, 0.0, 3.6); glow(S.c2, HL);
    cap('B 裡所有 b：先 g 再 f，回到原來的 b', '反過來的順序，一般不一樣');
  },
  async (tok, S) => { // 1157.3
    glow(S.c2, null);
    sm('g ∘ f = 1_A，f ∘ g = 1_B（identity）', 0, -0.7);
    cap('兩種都變成 identity：原來的東西', '');
  },
  async (tok, S) => { // 1168.7
    good('f 是 invertible；g 叫做 f 的 inverse', 0, 6.6);
    cap('這時就說 f 是 invertible', 'g 叫做 f 的 inverse');
  },
]);

// ════════ 5QvVXhrnTHQ（趙啟超 4B：Functions） ════════
scene('sfA-lr', '4B：left inverse、right inverse', CAM, [
  async (tok, S) => { // 3.8
    hot('g 是 f 的 inverse：兩個條件', 0, 6.4);
    S.a = card('① g ∘ f = 1_A', C.sky, -3.2, 5.3, 4.4); S.b = card('② f ∘ g = 1_B', C.peach, 3.2, 5.3, 4.4);
    cap('inverse 要滿足兩個條件', '');
  },
  async (tok, S) => { // 7.9
    glow(S.a, HL); hd('只有 ①：g 是 left inverse', -3.2, 4.35);
    cap('只滿足第一個：g 叫 f 的 left inverse', 'g 在 f 的左邊');
  },
  async (tok, S) => { // 9.6
    glow(S.a, null); glow(S.b, HL); hd('只有 ②：g 是 right inverse', 3.2, 4.35);
    cap('只滿足第二個：g 叫 f 的 right inverse', 'g 在 f 的右邊');
  },
  async (tok, S) => { // 34.4
    glow(S.b, null);
    note('∘ 不滿足交換律 → 左、右不一樣', 0, 3.3);
    cap('左邊運算、右邊運算不 commute', '所以左右要分開講');
  },
  async (tok, S) => { // 52.4
    glow(S.a, OKG); glow(S.b, OKG);
    good('又是 left 又是 right → inverse', 0, 2.4);
    cap('又是 left inverse 又是 right inverse', '才叫做 inverse');
  },
  async (tok, S) => { // 62.0
    sm('把 ∘ 看成運算：從左邊把 f 削掉 → a；從右邊削掉 → b', 0, 1.5);
    cap('就像從左邊、從右邊運算上去，把它消掉', '');
  },
]);

const LA = [1, 2], LB = ['x', 'y', 'z'];
scene('sfA-uniqintro', '4B：an inverse vs the inverse：唯一性是性質', CAM, [
  async (tok, S) => { // 71.1
    S.a = card('g 叫做 f 的 an inverse', C.lilac, 0, 6.2, 5.0); glow(S.a, HL);
    cap('定義裡說：g 是 f 的 an inverse', 'an 是不定冠詞');
  },
  async (tok, S) => { // 85.0
    glow(S.a, null); note('定義只說「存在一個」，沒排除可能有兩個', 0, 5.5);
    cap('定義只說「如果有一個 g…」', '並沒有排除可能有兩個');
  },
  async (tok, S) => { // 103.6
    sm('只有一個時才能用定冠詞：the inverse', 0, 4.9);
    cap('如果只有一個，才用定冠詞 the', '');
  },
  async (tok, S) => { // 118.0
    S.p = card('性質：inverse 存在就唯一（後面證明）', C.mint, 0, 4.1, 6.4); glow(S.p, HL);
    cap('唯一通常不放在定義，而是當性質來證', '有 inverse 就一定只有一個');
  },
  async (tok, S) => { // 163.0
    glow(S.p, null);
    S.A = oval('A', LA, -5.2, 1.8, { dir: 'col' }); S.B = oval('B', LB, -2.4, 1.8, { dir: 'col', color: C.orange });
    farrow(S.A, 1, S.B, 'x', 0x2a6fb0); farrow(S.A, 2, S.B, 'y', 0x2a6fb0);
    card('g₁：x→1，y→2，z→1', C.sky, 2.6, 2.6, 4.4); card('g₂：x→1，y→2，z→2', C.peach, 2.6, 1.8, 4.4);
    sm('g₁ ∘ f = g₂ ∘ f = 1_A：兩個不同的 left inverse（示意）', 1.6, 0.9);
    cap('只有 left inverse 或 right inverse 時', '不見得唯一：隨便一個小例子就看得出來');
  },
  async (tok, S) => { // 197.0
    note('像矩陣：方陣的 inverse 唯一；長方形矩陣可能有 left / right inverse，但不唯一', 0, 0.1);
    cap('有點像矩陣', '方陣才有 inverse；長方形的左右 inverse 不見得唯一');
  },
]);

scene('sfA-uniqpf', '4B：證明 inverse 唯一：g = g′', CAM, [
  async (tok, S) => { // 247.7
    hot('證：f 的 inverse 若存在就唯一', 0, 6.75);
    note('套路：假設有兩個，再證它們一樣', 0, 6.1);
    cap('證「唯一」的標準做法', '假設有兩個，推一推發現它們相等');
  },
  async (tok, S) => { // 274.2
    card('g ∘ f = 1_A，f ∘ g = 1_B', C.sky, -3.4, 5.35, 5.6); card('g′ ∘ f = 1_A，f ∘ g′ = 1_B', C.peach, 3.4, 5.35, 5.6);
    cap('假設 g 和 g′ 都滿足 inverse 的條件', '把可以用的條件先寫下來');
  },
  async (tok, S) => { // 312.0
    S.goal = hot('目標：∀b ∈ B，g(b) = g′(b)', 0, 4.55);
    cap('要證 g = g′：定義域裡每個 b，對過去都一樣', '先把目的搞清楚');
  },
  async (tok, S) => { // 381.8
    S.L = chain(-1.4, 3.85, 0.62, 6.0, 4.6);
    S.L.add('g(b) 是 A 的元素', 'g: B → A', C.lilac);
    cap('g(b) 對應到 A 裡的一個元素', '');
  },
  async (tok, S) => { // 412.4
    S.L.add('g(b) = (g′ ∘ f)( g(b) )', 'g′ ∘ f = 1_A');
    cap('把 g(b) 當成 A 裡的 a：g′ ∘ f 不改變它', '用 g′ 的第一個條件');
  },
  async (tok, S) => { // 434.1
    S.L.add('= g′( f( g(b) ) )', '合成的定義');
    cap('把合成的定義寫出來', '');
  },
  async (tok, S) => { // 457.7
    S.L.add('= g′( (f ∘ g)(b) )', '結合律', C.peach);
    cap('括號換個地方：裡面看成 f ∘ g', '用了合成的結合律');
  },
  async (tok, S) => { // 513.3
    S.L.add('= g′(b)', 'f ∘ g = 1_B', C.mint);
    cap('f ∘ g 是 identity：(f ∘ g)(b) = b', '');
  },
  async (tok, S) => { // 527.1
    txt(S.goal, '✓ 對所有 b：g(b) = g′(b)');
    good('∀b：g(b) = g′(b) ⇒ g = g′，唯一 ∎', 0, 0.45);
    cap('對每個 b 都一樣 → 兩個函數相等', '所以 inverse 一定唯一');
  },
]);

scene('sfA-finv', '4B：記號 f⁻¹，(f⁻¹)⁻¹ = f', CAM, [
  async (tok, S) => { // 594.2
    S.A = oval('A', FA, -3.2, 3.0, { dir: 'col' }); S.B = oval('B', FB, 3.2, 3.0, { dir: 'col', color: C.orange }); sm('示意', 0, 0.6);
    FA.forEach((a) => farrow(S.A, a, S.B, FI[a], 0x2a6fb0, 0.3, 0.12)); hd('f', 0, 4.9);
    FB.forEach((b) => farrow(S.B, b, S.A, GI[b], 0xb05a2a, 0.3, -0.12)); hd('f⁻¹', 0, 1.2);
    S.a = card('唯一 → 記作 f⁻¹（f inverse，反函數）', C.lilac, 0, 6.0, 6.2); glow(S.a, HL);
    cap('因為唯一，符號就很明確：f⁻¹', '右上角加一個 −1');
  },
  async (tok, S) => { // 624.0
    glow(S.a, null); S.b = card('(f⁻¹)⁻¹ = f', C.mint, 0, -0.2, 3.4); glow(S.b, HL);
    cap('反函數再取反函數：就是原來的 f', '');
  },
]);

scene('sfA-iff', '4B：f invertible ⇔ f bijective（直觀）', CAM, [
  async (tok, S) => { // 662.2
    hot('什麼時候 f 有 inverse？', 0, 6.6);
    cap('不是每個函數都有 inverse', '什麼時候才有？');
  },
  async (tok, S) => { // 694.6
    S.c = card('f invertible  ⇔  ？', C.lilac, 0, 5.8, 5.6); glow(S.c, HL);
    sm('⇔ ＝ iff ＝ if and only if（若且唯若）', 0, 5.2);
    cap('IFF：if and only if，若且唯若', '兩個方向都成立');
  },
  async (tok, S) => { // 725.8
    kill(S.c); S.c = card('f invertible  ⇔  f bijective', C.mint, 0, 5.8, 5.6); glow(S.c, HL);
    cap('答案：f 是 bijective', '又 1-1 又 onto');
  },
  async (tok, S) => { // 747.3
    glow(S.c, null);
    note('要證兩個方向：⇐ 和 ⇒', 0, 4.6);
    cap('若且唯若：要證向右推，也要證向左推', '');
  },
  async (tok, S) => { // 819.4
    S.A = oval('A', FA, -3.2, 2.2, { dir: 'col' }); S.B = oval('B', FB, 3.2, 2.2, { dir: 'col', color: C.orange }); sm('示意', 0, 0.0);
    S.fa = FA.map((a) => farrow(S.A, a, S.B, FI[a], 0x2a6fb0, 0.3, 0.12));
    S.ga = FB.map((b) => farrow(S.B, b, S.A, GI[b], 0xb05a2a, 0.3, -0.12));
    cap('inverse 就是把每支箭頭反過來', '');
  },
  async (tok, S) => { // 835.6
    S.b4 = cube('b₄', C.red, [0.62, 0.52, 0.4], 5.0, 2.2, 0.2, 0.9); glow(S.b4, NG);
    S.t = bad('b₄ 沒被對到 → 反回去沒定義', 3.6, 4.3);
    cap('B 的每個元素都要有定義：每個都要被對到', '所以要 onto');
  },
  async (tok, S) => { // 846.1
    gone(S.b4, S.t); kill(S.fa[1]); S.fa[1] = farrow(S.A, 'a₂', S.B, 'b₂', 0xd64545, 0.4, 0.12);
    bad('兩個對一個：b₂ 反回去是 a₁ 還是 a₂？', 0, 4.3);
    cap('不能兩個對一個：反回去不知道去哪', '所以要 one-to-one');
  },
]);

scene('sfA-bij2inv', '4B：證 ⇐：bijective ⇒ invertible', CAM, [
  async (tok, S) => { // 857.3
    S.A = oval('A', FA, -5.3, 3.4, { dir: 'col' }); S.B = oval('B', FB, -2.3, 3.4, { dir: 'col', color: C.orange }); sm('示意', -3.8, 1.2);
    FA.forEach((a) => farrow(S.A, a, S.B, FI[a], 0x2a6fb0, 0.3, 0.12));
    S.L = chain(3.0, 6.2, 0.8, 6.4);
    S.L.add('假設 f bijective（1-1 而且 onto）', null, C.lilac);
    cap('先假設 f 是 bijective', '再證它是 invertible');
  },
  async (tok, S) => { // 863.8
    S.L.add('onto：∀b ∈ B，∃a ∈ A，f(a) = b');
    cap('onto：B 裡每個 b，都有 a 對到它', '');
  },
  async (tok, S) => { // 878.8
    S.L.add('1-1：這個 a 是唯一的', null, C.peach);
    cap('one-to-one：不會兩個對一個', '所以那個 a 唯一');
  },
  async (tok, S) => { // 925.9
    FB.forEach((b) => farrow(S.B, b, S.A, GI[b], 0xb05a2a, 0.3, -0.12)); hd('g', -3.8, 5.6);
    S.L.add('定義 g(b) = 那個唯一的 a', null, C.mint);
    cap('定義 g：把 b 對回那個 a', '就是把箭頭反過來');
  },
  async (tok, S) => { // 957.4
    S.L.add('g 是函數：每個 b 有定義、答案唯一');
    cap('g 是個函數：每個 b 都有定義（onto）', '結果唯一、沒有 ambiguity（1-1）');
  },
  async (tok, S) => { // 995.7
    S.L.add('g( f(a) ) = a  ⇒  g ∘ f = 1_A');
    cap('再證 g 是 inverse：先看 g(f(a))', 'f(a) = b，g(b) = a');
  },
  async (tok, S) => { // 1022.0
    S.L.add('f( g(b) ) = b  ⇒  f ∘ g = 1_B', null, C.mint);
    good('g 是 f 的 inverse ⇒ f invertible ∎', 1.0, 0.45);
    cap('又是 left 又是 right inverse', '所以 f 是 invertible');
  },
]);

scene('sfA-inv2bij', '4B：證 ⇒：invertible ⇒ bijective', CAM, [
  async (tok, S) => { // 1081.6
    S.A = oval('A', FA, -5.3, 3.4, { dir: 'col' }); S.B = oval('B', FB, -2.3, 3.4, { dir: 'col', color: C.orange }); sm('示意', -3.8, 1.2);
    FA.forEach((a) => farrow(S.A, a, S.B, FI[a], 0x2a6fb0, 0.3, 0.12));
    S.L = chain(3.0, 6.2, 0.8, 6.4);
    S.L.add('反方向：假設 f invertible，inverse 記作 f⁻¹', null, C.lilac);
    cap('另一個方向：先假設 f 有 inverse', '用剛才的符號 f⁻¹');
  },
  async (tok, S) => { // 1109.1
    S.L.add('要證 bijective：surjective ＋ injective');
    cap('要證兩件事：injective 和 surjective', '先證哪個都可以');
  },
  async (tok, S) => { // 1117.3
    S.L.add('onto：∀b ∈ B，要找 a，f(a) = b');
    cap('先證 surjective：每個 b 都要找到 a', '');
  },
  async (tok, S) => { // 1134.5
    FB.forEach((b) => farrow(S.B, b, S.A, GI[b], 0xb05a2a, 0.3, -0.12)); hd('f⁻¹', -3.8, 5.6);
    S.L.add('取 a = f⁻¹(b)', null, C.peach);
    cap('a 要怎麼找？用 inverse 對回去', '');
  },
  async (tok, S) => { // 1141.4
    S.L.add('f( f⁻¹(b) ) = b（f ∘ f⁻¹ = 1_B）✓ onto', null, C.mint);
    cap('因為 f⁻¹ 是 right inverse：f(f⁻¹(b)) = b', '所以 f 是 surjective');
  },
  async (tok, S) => { // 1209.2
    S.L.add('1-1：設 f(a₁) = f(a₂)');
    cap('最後證 injective：假設對應過去一樣', '要推到 a₁ = a₂');
  },
  async (tok, S) => { // 1230.8
    S.L.add('兩邊取 f⁻¹ ⇒ a₁ = a₂ ✓ 1-1', null, C.mint);
    cap('等號兩邊都取 f⁻¹，就像消掉', 'f⁻¹(f(a)) = a');
  },
  async (tok, S) => { // 1264.5
    good('injective ＋ surjective ⇒ bijective ∎', 3.0, 0.2);
    cap('又是 injective 又是 surjective', '所以是 bijective，兩個方向都證完');
  },
  async (tok, S) => { // 1279.0
    note('直觀：不是 onto → 有 b 沒有定義；兩個對一個 → 反回去不知道選誰', -2.6, -0.45);
    cap('用圖想：所以 invertible 一定要 bijective', '理解意思，不用死背');
  },
]);
  }

  // ═══ sfB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 3 章（交大 易志偉 Lec05–Lec07：證明收尾、集合、函數、數列與加總、可數）— cued scenes ───
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 老師沒在黑板上給完整數字、由講解重建的例子，舞台上標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const C = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#e2b13c', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8', dark: '#8d8170' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const card = (t, c, x, y, w = 4, h = 0.55, z = 0, drop = 1.2) => cube(t, c, [w, h, 0.8], x, y, z, drop);
const num = (v, x, y, c = C.blue, s = 0.62, drop = 1.4) => cube(String(v), c, [Math.max(s, 0.24 * String(v).length + 0.2), s, s], x, y, 0.3, drop);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.g && o.body) return kill(o.g); if (o.ls) return gone(o.ls); if (o.all) return gone(o.all); kill(o); });
const glowAll = (arr, c) => arr.forEach((m) => m && glow(m, c));
const CAM = [[0, 4, 15], [0, 3.2, 0]];
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// 一疊卡片：新的一張發亮
function board(x, yTop, w = 6, dy = 0.74) {
  const ls = [];
  return { ls, add(t, c = C.sky, ww) { ls.forEach((m) => glow(m, null)); const y = yTop - ls.length * dy; const m = card(t, c, x, y, ww || w, 0.56); glow(m, HL); ls.push(m); return m; }, last() { return ls[ls.length - 1]; } };
}
// 平面上的圓／橢圓（集合的框）
function ringL(cx, cy, r, color = '#8a7a60', z = 0.04) {
  const pts = []; for (let k = 0; k <= 64; k++) { const a = (Math.PI * 2 * k) / 64; pts.push(V3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
function oval(cx, cy, rx, ry, color) { const l = ringL(0, 0, 1, color); l.scale.set(rx, ry, 1); l.position.set(cx, cy, 0); return l; }
function disc(cx, cy, r, color, op = 0.28) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(cx, cy, 0.02); lab.world.add(m); return m;
}
// 一個集合：框 + 名字 + 元素方塊
function blob(name, items, cx, cy, rx, ry, color = C.blue, cols) {
  const ring = oval(cx, cy, rx, ry);
  const nm = name ? hd(name, cx - rx * 0.7, cy + ry + 0.15) : null;
  const n = items.length; cols = cols || Math.max(1, Math.min(n, Math.round(Math.sqrt(n * rx / ry))));
  const rows = Math.ceil(n / cols);
  const cubes = items.map((v, i) => { const r = Math.floor(i / cols), c = i % cols; return num(v, cx + (c - (cols - 1) / 2) * Math.min(1.1, (rx * 1.5) / cols), cy + ((rows - 1) / 2 - r) * Math.min(0.85, (ry * 1.5) / rows), color, 0.56); });
  return { ring, nm, cubes, all: [ring, nm, ...cubes] };
}
// 數線
function nline(lo, hi, y, sc = 1.2, cx = 0, every = 1) {
  const X = (v) => cx + v * sc; const all = [line(X(lo) - 0.4, y, X(hi) + 0.4, y)];
  for (let v = lo; v <= hi; v += every) all.push(sm(String(v).replace('-', '−'), X(v), y - 0.42));
  return { X, all };
}
const bar = (x0, x1, y, c, h = 0.2) => cube(null, c, [Math.max(0.12, x1 - x0), h, 0.3], (x0 + x1) / 2, y, 0.1);
const arr = (x1, y1, x2, y2, c) => arrow(V3(x1, y1, 0.3), V3(x2, y2, 0.3), c);

// ════════ 8_bLOJfZW6g（易志偉 Lec05：證明方法收尾、集合的定義） ════════
scene('sfB-l5-cases', 'Lec05：列舉法要把情況列完（y 是整數）', [
  async (tok, S) => { // 7.1 列舉法：切成好幾件事
    S.b = board(-3.7, 6.6, 6.2); S.b.add('列舉法：把一件事切成好幾件來討論', C.gold);
    cap('列舉法（窮舉法）', '一次處理很難，就切成幾個情況');
  },
  async (tok, S) => { // 11.2 整數：正、負、還有 0
    S.L = nline(-5, 5, 0.9, 1.25);
    S.b.add('例：某個數是整數 → 正數、負數、還有 0');
    cap('整數可以分成正數、負數', '還有一個 0 不要忘記');
  },
  async (tok, S) => { // 34.0 1,2,3,4；−1,−2,−3；0
    S.pos = []; for (const v of [1, 2, 3, 4]) { S.pos.push(num(v, S.L.X(v), 1.6, C.blue)); await wt(tok, 120); }
    S.neg = []; for (const v of [-1, -2, -3]) { S.neg.push(num('−' + -v, S.L.X(v), 1.6, C.pink)); await wt(tok, 120); }
    S.z = num(0, S.L.X(0), 1.6, C.gold); glow(S.z, HL); hot('別忘了 0', S.L.X(0), 2.45);
    cap('正：1, 2, 3, 4…　負：−1, −2, −3…', '整數裡還有一個 0');
  },
  async (tok, S) => { // 46.3 題目：把「y 是整數」切成幾個 case
    S.b.add('題目要證明時：把「y 是整數」切成幾個 case');
    cap('回味這個題目', '把「y 是整數」這件事做切割');
  },
  async (tok, S) => { // 77.6 y=0、y=1、y≥2
    S.c = board(3.7, 6.6, 6.0, 0.62);
    S.c.add('case：y = 0', C.mint); S.c.add('case：y = 1', C.mint); S.c.add('case：y ≥ 2', C.mint);
    S.g0 = bar(S.L.X(0) - 0.2, S.L.X(0) + 0.2, 0.9, C.green); S.g1 = bar(S.L.X(1) - 0.2, S.L.X(1) + 0.2, 0.9, C.green); S.g2 = bar(S.L.X(2) - 0.2, S.L.X(5) + 0.4, 0.9, C.green);
    cap('書上的證明分成三個 case', 'y = 0、y = 1、y ≥ 2');
  },
  async (tok, S) => { // 92.0 漏掉負數
    glowAll(S.neg, NG); S.miss = bad('漏掉了：y 也可能是負數！', S.L.X(-3), 2.6);
    cap('問題出在這裡：漏掉了', 'y 是整數，還有負數的可能');
  },
  async (tok, S) => { // 118.4 補 y=−1、y≤−2
    S.c.add('補：y = −1', C.peach); S.c.add('補：y ≤ −2', C.peach);
    bar(S.L.X(-1) - 0.2, S.L.X(-1) + 0.2, 0.9, C.orange); bar(S.L.X(-5) - 0.4, S.L.X(-2) + 0.2, 0.9, C.orange);
    glowAll(S.neg, null); remove(S.miss);
    cap('補強：再列 y = −1、y ≤ −2', '代進去，論述跟 y = 1、y ≥ 2 一模一樣');
  },
  async (tok, S) => { // 141.0 WLOG
    S.b.add('只要多寫幾行字：WLOG', C.lilac);
    note('Without Loss of Generality（同理可證）', -3.7, 3.3);
    cap('那幾行字就是 WLOG', 'Without Loss of Generality');
  },
  async (tok, S) => { // 165.2 y = ±1、|y| ≥ 2
    S.c.add('更精簡：y = ±1、|y| ≥ 2', C.sky);
    cap('更懶的寫法', 'y = ±1，|y| ≥ 2（用絕對值）');
  },
  async (tok, S) => { // 193.0 一定要全部列舉到
    good('最重要：所有情況都要列舉到', 0, 3.0);
    cap('怎麼分類沒有一定', '但一定要把所有情況都列完');
  },
]);

scene('sfB-l5-zero', 'Lec05：x² 一定是正數？漏了 x = 0', [
  async (tok, S) => { // 198.4 證明：x 實數 → x² 是正數
    S.b = board(-3.7, 6.6, 6.2); S.b.add('題目：x 是實數 → x² 一定是正數？', C.gold);
    S.L = nline(-4, 4, 1.0, 1.4);
    cap('同樣犯錯的例子', '證明：x 是實數，則 x² 是正數');
  },
  async (tok, S) => { // 212.6 正不包含 0
    S.b.add('注意：「正」不包含 0');
    cap('講「正」的時候', '都不包含 0');
  },
  async (tok, S) => { // 230.5 分兩個 case
    S.c = board(3.7, 6.6, 5.6, 0.7);
    S.c.add('case 1：x > 0', C.mint); S.c.add('case 2：x < 0', C.mint);
    S.p = bar(S.L.X(0) + 0.15, S.L.X(4) + 0.4, 1.0, C.blue); S.n = bar(S.L.X(-4) - 0.4, S.L.X(0) - 0.15, 1.0, C.pink);
    cap('它的證明分成兩個 case', 'x 是正數、x 是負數');
  },
  async (tok, S) => { // 240.0 漏 x = 0
    S.hole = num(0, S.L.X(0), 1.0, C.red, 0.5); glow(S.hole, NG); S.q = bad('x = 0 呢？', S.L.X(0), 1.9);
    cap('還有 x = 0 這個情況', '證明裡故意把它忘掉');
  },
  async (tok, S) => { // 257.0 case1 ✓
    good('x > 0 → x² > 0 ✓', 3.7, 4.6); glow(S.p, OKG);
    cap('case 1：x > 0', 'x² > 0，沒有錯');
  },
  async (tok, S) => { // 261.2 case2 ✓
    good('x < 0 → x² > 0 ✓', 3.7, 3.9); glow(S.n, OKG);
    cap('case 2：x < 0', 'x² > 0，也對');
  },
  async (tok, S) => { // 265.4 第三個沒講 → 全錯
    remove(S.q); bad('x = 0 → x² = 0，不是正數 ✗', 3.7, 3.2);
    cap('第三個 case 沒講', '只要漏掉一個，證明就全錯');
  },
  async (tok, S) => { // 274.6 規則一
    S.b.add('窮舉法守則①：所有情況都要列出來', C.lilac);
    cap('窮舉法一定要確保', '第一：把所有情況列舉出來');
  },
  async (tok, S) => { // 284.7 規則二
    S.b.add('守則②：列出來之後，每一個都要證到', C.lilac);
    cap('第二：列出來之後', '每一個情況都要證明到');
  },
]);

scene('sfB-l5-1729', 'Lec05：存在性證明（一）直接給答案 1729', [
  async (tok, S) => { // 303.3 證明「存在 x 使 P(x)」
    hot('要證明：∃x P(x)（存在一個 x 讓 P(x) 成立）', 0, 6.6);
    cap('最後收尾：存在性的證明', '存在一個 x，讓 P(x) 成立');
  },
  async (tok, S) => { // 321.5 第一類
    S.l = card('第一類：直接給一個答案', C.mint, -3.6, 5.6, 6.2); glow(S.l, HL);
    note('不管有上百上千個答案，給一個就夠（constructive）', -3.6, 4.95);
    cap('第一類：真的給你一個答案', '只要給一個，就證明存在');
  },
  async (tok, S) => { // 332.4 第二類
    glow(S.l, null); S.r = card('第二類：答案不好找 → 說服你一定有', C.peach, 3.6, 5.6, 6.6); glow(S.r, HL);
    note('配合列舉法、矛盾證法…（nonconstructive）', 3.6, 4.95);
    cap('第二類：答案不好找', '用別的方法說服你「真的有」');
  },
  async (tok, S) => { // 375.6 題目
    glow(S.r, null); S.b = board(-2.4, 4.0, 8.4, 0.8);
    S.b.add('題：有正整數能用「兩種不同方法」寫成兩個正整數的立方和', C.gold, 9.6);
    cap('題目：有個正整數', '可以用兩種方法寫成兩個立方的和');
  },
  async (tok, S) => { // 426.4 示意 1³+2³ = 9
    S.b.add('看懂題意（示意）：1³ + 2³ = 1 + 8 = 9', C.sky);
    cap('先看懂題意：1³ + 2³ = 9', '問有沒有數字能拆成兩組立方和');
  },
  async (tok, S) => { // 445.6 1729 = 10³ + 9³
    S.big = num('1729', 5.4, 1.6, C.gold, 0.9); glow(S.big, HL);
    S.b.add('1729 = 10³ + 9³ = 1000 + 729', C.mint);
    cap('真的找出一個：1729', '1729 = 10³ + 9³');
  },
  async (tok, S) => { // 455.0 12³ + 1³
    S.b.add('1729 = 12³ + 1³ = 1728 + 1', C.mint);
    cap('還有另外一組', '1729 = 12³ + 1³');
  },
  async (tok, S) => { // 476.1 直接給答案
    good('給出 1729 → 證明完成（constructive）', 0, 0.6);
    cap('直接給一個答案', '不必管 150、160 行不行');
  },
]);

scene('sfB-l5-sqrt2', 'Lec05：存在性證明（二）√2 的 √2 次方', [
  async (tok, S) => { // 497.1 存在無理數 x, y 使 x^y 有理
    hot('證明：存在無理數 x、y，使 x^y 是有理數', 0, 6.6);
    cap('第二個例子', '存在無理數 x、y，使 x^y 是有理數');
  },
  async (tok, S) => { // 518.2 底、指數無理，結果有理
    note('底是無理數、指數也是無理數，算出來卻要是有理數', 0, 6.0);
    cap('底無理、指數無理', '算開來卻要是有理數，確實有點難');
  },
  async (tok, S) => { // 544.4 已知 √2 無理
    S.k = card('已知：√2 是無理數', C.lilac, -4.6, 5.1, 4.2); glow(S.k, HL);
    cap('心裡先知道', '√2 是無理數（之前證過）');
  },
  async (tok, S) => { // 559.3 考慮 √2^√2
    glow(S.k, null); S.top = card('考慮 √2^√2', C.gold, 0, 4.2, 3.6); glow(S.top, HL);
    note('它是有理數還是無理數？算不出來！', 0, 3.55);
    cap('考慮 √2 的 √2 次方', '不直接證它是不是無理數，因為算不出來');
  },
  async (tok, S) => { // 577.2 分兩個 case
    glow(S.top, null);
    arr(-0.6, 3.9, -3.6, 2.9); arr(0.6, 3.9, 3.6, 2.9);
    S.c1 = card('case 1：√2^√2 是有理數', C.mint, -3.8, 2.55, 5.4); S.c2 = card('case 2：√2^√2 是無理數', C.peach, 3.8, 2.55, 5.4);
    cap('數字只有兩類：有理、無理', '所以分成兩個 case（列舉法）');
  },
  async (tok, S) => { // 605.8 case1：x = y = √2
    glow(S.c1, HL); S.a1 = card('取 x = √2、y = √2 → 答案！', C.mint, -3.8, 1.6, 5.4);
    cap('case 1：√2^√2 是有理數', '底 √2、指數 √2 都無理 → 就是答案');
  },
  async (tok, S) => { // 643.0 case2：x = √2^√2、y = √2
    glow(S.c1, null); glow(S.c2, HL); S.a2 = card('取 x = √2^√2（無理）、y = √2', C.peach, 3.8, 1.6, 5.6);
    cap('case 2：√2^√2 是無理數', '改取 x = √2^√2、y = √2');
  },
  async (tok, S) => { // 664.0 x^y = 2
    S.calc = card('x^y = (√2^√2)^√2 = √2^(√2·√2) = √2² = 2', C.sky, 3.0, 0.65, 7.6); glow(S.calc, HL);
    cap('指數律：次方再次方 = 指數相乘', '(√2^√2)^√2 = √2² = 2');
  },
  async (tok, S) => { // 681.3 兩個 case 都有答案
    glow(S.calc, null); good('2 是有理數 → 兩種 case 都找得到答案', -3.4, 0.4);
    note('但到底是哪一組？不知道（nonconstructive）', -3.4, -0.25);
    cap('不管哪個 case 都有答案', '但不知道是哪一組 → 非構造性證明');
  },
]);

scene('sfB-l5-unique', 'Lec05：唯一存在 ∃!（ar + b = 0）', [
  async (tok, S) => { // 708.0 ∃!
    S.b = board(-3.4, 6.6, 6.8, 0.72); S.b.add('∃!x P(x)：唯一存在（! 也有人寫 1）', C.gold);
    cap('另一個符號：∃ 加一個驚嘆號', '叫做「唯一存在」');
  },
  async (tok, S) => { // 724.2 存在而且找不到其他答案
    S.b.add('不只存在，而且找不到其他答案');
    cap('唯一存在', '不只存在，而且找不到別的答案');
  },
  async (tok, S) => { // 734.4 寫法
    S.b.add('∃x₀ P(x₀) ∧ ∀x (x ≠ x₀ → ¬P(x))', C.lilac);
    cap('寫法：有一個 x₀ 讓 P(x₀) 成立', '而且不等於 x₀ 的 x，P(x) 都不對');
  },
  async (tok, S) => { // 757.6 證明分兩件事
    S.b.add('證明分兩件事：①存在　②其他都不對', C.mint);
    cap('證明唯一存在', '分兩件事：找出 x₀，再證其他都錯');
  },
  async (tok, S) => { // 785.5 例
    S.e = card('例：a、b 實數，a ≠ 0 → 唯一實數 r 使 ar + b = 0', C.gold, 0, 2.9, 10.4); glow(S.e, HL);
    cap('例子：a ≠ 0', '有唯一的實數 r，使 ar + b = 0');
  },
  async (tok, S) => { // 812.4 存在 r = −b/a
    glow(S.e, null); S.r = card('存在：r = −b/a，代進去 a(−b/a) + b = 0 ✓', C.mint, -2.6, 2.0, 7.4); glow(S.r, HL);
    cap('存在：把 b 移過去再除以 a', 'r = −b/a，代進去真的成立');
  },
  async (tok, S) => { // 826.4 a ≠ 0 才能除
    note('a 不是 0 → 才能當分母', 3.9, 2.0);
    cap('因為 a 不是 0', '所以可以除，分母沒問題');
  },
  async (tok, S) => { // 830.7 假設另有 s ≠ r
    glow(S.r, null); S.s = card('唯一：假設另有 s ≠ r，也有 as + b = 0', C.peach, -2.6, 1.15, 7.4); glow(S.s, HL);
    cap('接著假設另外有一個 s', 's 跟 r 不相等，也滿足 as + b = 0');
  },
  async (tok, S) => { // 863.5 ar+b = as+b → r = s 矛盾
    glow(S.s, null); S.m = card('ar + b = as + b → ar = as → r = s（a ≠ 0）', C.sky, -2.6, 0.3, 7.4); glow(S.m, HL);
    bad('與 s ≠ r 矛盾！', 3.9, 0.3);
    cap('兩式都等於 0，放在一起', '移項消去得 r = s，跟假設矛盾');
  },
  async (tok, S) => { // 900.5 唯一 = 存在 + 唯一性
    good('唯一存在 = 證存在 + 證其他數字都不對', 0, -0.5);
    cap('所以一定要證明兩件事', '存在，以及其他數字都不對');
  },
]);

scene('sfB-l5-fermat', 'Lec05：猜想 conjecture 與費馬最後定理', [
  async (tok, S) => { // 910.3 conjecture
    S.b = board(-3.4, 6.6, 6.8, 0.74); S.b.add('conjecture 猜想：大家相信應該會對', C.gold);
    cap('常常看到的 conjecture', '中文叫猜想：應該會對');
  },
  async (tok, S) => { // 927.3 沒人舉得出反例
    S.b.add('①從古到今沒有人舉得出反例');
    cap('第一：沒有人能舉出反例', '要證明錯很簡單：舉一個反例就全錯');
  },
  async (tok, S) => { // 945.6 也沒人證明對
    S.b.add('②但也沒有人能證明它是對的');
    cap('但也沒有人能證明它對', '這種就稱為猜想');
  },
  async (tok, S) => { // 957.6 費馬
    S.f = card('費馬最後定理：xⁿ + yⁿ = zⁿ', C.lilac, -3.4, 3.55, 6.8); glow(S.f, HL); S.b.ls.forEach((m) => glow(m, null));
    cap('有名的例子：費馬最後定理', 'xⁿ + yⁿ = zⁿ');
  },
  async (tok, S) => { // 968.0 n > 2 沒整數解
    glow(S.f, null); S.g = card('n > 2 時：沒有正整數解', C.mint, -3.4, 2.8, 6.8); glow(S.g, HL);
    cap('n 大於 2 的時候', '這個式子沒有（正）整數解');
  },
  async (tok, S) => { // 989.0 n=2：畢氏定理 3,4,5
    glow(S.g, null);
    const o = [2.4, 0.4], u = 0.75; // 直角三角形 3-4-5
    S.tri = [line(o[0], o[1], o[0] + 4 * u, o[1]), line(o[0], o[1], o[0], o[1] + 3 * u), line(o[0] + 4 * u, o[1], o[0], o[1] + 3 * u)];
    sm('4', o[0] + 2 * u, o[1] - 0.35); sm('3', o[0] - 0.35, o[1] + 1.5 * u); sm('5', o[0] + 2.2 * u, o[1] + 1.9 * u);
    S.h = card('n = 2 是畢氏定理：3² + 4² = 9 + 16 = 25 = 5²', C.sky, -3.4, 2.05, 6.8); glow(S.h, HL);
    cap('n = 2 就是畢氏定理', '3、4、5 馬上給你一組解，所以排除 2');
  },
  async (tok, S) => { // 1000.2 被證出來 → 不再是猜想
    glow(S.h, null); good('後來被證出來（1994）→ 就不再是 conjecture', -3.4, 1.1);
    cap('1637 年提出，1994 年才被證出', '被證出來後，就不再是猜想了');
  },
]);

scene('sfB-l5-collatz', 'Lec05：3x + 1 猜想（x = 3 走到 1）', [
  async (tok, S) => { // 1024.0 3x+1
    hot('另一個有名的猜想：3x + 1', 0, 6.6);
    cap('歷史上有名的另一個猜想', '3x + 1');
  },
  async (tok, S) => { // 1028.0 transform = 函式
    S.T = card('transform T：就是一個函式', C.gold, -3.6, 5.7, 6); glow(S.T, HL);
    cap('transform 是什麼？', '其實就是函式');
  },
  async (tok, S) => { // 1034.4 偶數 → x/2
    glow(S.T, null); S.ev = card('x 是偶數：T(x) = x / 2', C.sky, -3.6, 4.95, 6); glow(S.ev, HL);
    cap('放進去的 x 是偶數', '函式值是 x ÷ 2（還是整數）');
  },
  async (tok, S) => { // 1048.6 奇數 → 3x+1
    glow(S.ev, null); S.od = card('x 是奇數：T(x) = 3x + 1', C.peach, -3.6, 4.2, 6); glow(S.od, HL);
    cap('放的是奇數，不能除', '就算 3x + 1（會變成偶數）');
  },
  async (tok, S) => { // 1063.1 一直合成 → 1
    glow(S.od, null); S.cl = card('猜想：一直把答案放回 T，最後一定到 1', C.lilac, 3.4, 5.0, 6.6); glow(S.cl, HL);
    cap('算出來的答案再放回 T', '一直合成下去，最後一定得到 1');
  },
  async (tok, S) => { // 1094.0 舉例 x = 3
    glow(S.cl, null); S.xs = [3, 10, 5, 16, 8, 4, 2, 1]; S.X = (i) => -6.2 + i * 1.75;
    S.n = [num(3, S.X(0), 1.6, C.peach, 0.8)]; glow(S.n[0], HL);
    cap('看不懂就舉例子', '最簡單的：x = 3');
  },
  async (tok, S) => { // 1096.0 3 → 10
    S.n.push(num(10, S.X(1), 1.6, C.sky, 0.8)); arr(S.X(0) + 0.45, 1.6, S.X(1) - 0.5, 1.6); sm('3·3+1', (S.X(0) + S.X(1)) / 2, 2.3);
    glow(S.n[0], null); glow(S.n[1], HL);
    cap('3 是奇數', '3 × 3 + 1 = 10');
  },
  async (tok, S) => { // 1112.6 10 → 5
    S.n.push(num(5, S.X(2), 1.6, C.peach, 0.8)); arr(S.X(1) + 0.5, 1.6, S.X(2) - 0.45, 1.6); sm('÷2', (S.X(1) + S.X(2)) / 2, 2.3);
    glow(S.n[1], null); glow(S.n[2], HL);
    cap('10 是偶數', '10 ÷ 2 = 5');
  },
  async (tok, S) => { // 1121.4 5 → 16
    S.n.push(num(16, S.X(3), 1.6, C.sky, 0.8)); arr(S.X(2) + 0.45, 1.6, S.X(3) - 0.5, 1.6); sm('3·5+1', (S.X(2) + S.X(3)) / 2, 2.3);
    glow(S.n[2], null); glow(S.n[3], HL);
    cap('5 是奇數', '3 × 5 + 1 = 16');
  },
  async (tok, S) => { // 1127.2 16 = 2⁴ → 8,4,2,1
    glow(S.n[3], null);
    for (let i = 4; i < 8; i++) { S.n.push(num(S.xs[i], S.X(i), 1.6, C.sky, 0.8)); arr(S.X(i - 1) + 0.5, 1.6, S.X(i) - 0.45, 1.6); await wt(tok, 300); }
    glow(S.n[7], OKG); good('16 = 2⁴ → 一路除 2 → 1', 2.0, 0.6);
    cap('16 是 2 的 4 次方', '一直除以 2：8、4、2、1');
  },
  async (tok, S) => { // 1156.1 看不懂就代數字
    note('題目看不懂 → 代一個數字進去體會', -3.6, 3.2);
    cap('題目看不懂的時候', '試著代一個數字進去體會一下');
  },
]);

scene('sfB-l5-setdef', 'Lec05：集合的定義（element、∈、∉）', [
  async (tok, S) => { // 1228.0 定義看清楚
    S.b = board(3.4, 6.6, 7.0, 0.72); S.b.add('先把定義、用的名詞看清楚', C.gold);
    cap('第二章：集合', '第一件事：把定義看清楚');
  },
  async (tok, S) => { // 1244.3 set = unordered collection
    S.b.add('set（集合）：unordered collection of objects');
    S.s = blob('S', ['a', 'b', 'c', 'd'], -3.6, 3.2, 2.6, 1.9, C.blue, 2);
    cap('集合：一堆東西的收集', 'an unordered collection of objects');
  },
  async (tok, S) => { // 1253.1 unordered
    S.b.add('重點 unordered：沒有次序（不像座標分 x、y）');
    for (const m of S.s.cubes) { glow(m, HL); await wt(tok, 150); } glowAll(S.s.cubes, null);
    cap('重點是 unordered', '集合裡的東西沒有順序');
  },
  async (tok, S) => { // 1265.0 element / member
    S.b.add('裡面每個東西：element 或 member（元素）');
    bub('element', S.s.cubes[0].position.x - 1.2, 4.8);
    cap('裡面每一個東西', '專有名詞叫 element 或 member');
  },
  async (tok, S) => { // 1273.3 contains / belongs to
    S.b.add('集合 contains 元素；元素 belongs to 集合');
    cap('集合「包含」這個元素', '元素「屬於」這個集合');
  },
  async (tok, S) => { // 1297.4 大寫 S、T、U
    S.b.add('集合用大寫：S、T、U（S = Set）、A、B', C.lilac);
    glow(S.s.cubes[0], null); hot('大寫 S', -5.7, 5.4);
    cap('集合習慣用大寫英文字', 'S、T、U（Set 的 S），或 A、B');
  },
  async (tok, S) => { // 1316.8 元素小寫
    S.b.add('元素用小寫：a、b、c', C.lilac);
    cap('集合裡的元素', '習慣用小寫的 a、b、c');
  },
  async (tok, S) => { // 1328.7 a ∈ S
    glow(S.s.cubes[0], OKG); S.in = good('a ∈ S（a 屬於 S）', -3.6, 0.6);
    cap('不想每次寫「屬於」', '直接寫 a ∈ S');
  },
  async (tok, S) => { // 1344.0 a ∉ S
    S.out = num('z', 1.0, 2.0, C.gray, 0.56); bad('z ∉ S（S 裡找不到 z）', 1.0, 0.6);
    cap('把 ∈ 加一撇', 'z ∉ S：S 裡面找不到 z');
  },
]);

scene('sfB-l5-roster', 'Lec05：列舉法寫集合 {…}', [
  async (tok, S) => { // 1350.0 大括號、逗點
    hot('寫集合：大括號 { }，元素用逗點隔開', 0, 6.6);
    cap('把集合寫出來', '用大括號包起來，裡面用逗點隔開');
  },
  async (tok, S) => { // 1369.5 逗點中間只算一個
    note('逗點中間不管多複雜（一籃蘋果也行），只算一個元素', 0, 6.0);
    cap('逗點隔開的就是一個元素', '裡面不管多複雜，只算一個');
  },
  async (tok, S) => { // 1387.6 S = {1,2,3,4}
    S.s = blob('S = {1, 2, 3, 4}', [1, 2, 3, 4], -4.6, 3.6, 1.9, 1.3, C.blue, 2);
    sm('1∈S、2∈S、3∈S、4∈S', -4.6, 1.9);
    cap('S = {1, 2, 3, 4}', '可以寫 1∈S、2∈S、3∈S、4∈S');
  },
  async (tok, S) => { // 1397.5 V = {a,e,i,o,u}
    S.v = blob('V = {a, e, i, o, u}', ['a', 'e', 'i', 'o', 'u'], 0.4, 3.6, 2.2, 1.3, C.green, 3);
    sm('英文的母音字母', 0.4, 1.9);
    cap('V = {a, e, i, o, u}', '特性：英文的母音字母');
  },
  async (tok, S) => { // 1414.4 無窮但有規律 → …
    note('無窮無盡、但看得出規律 → 用「…」點下去', 4.6, 5.0);
    cap('如果東西無窮無盡', '但看得出規律，就點點點下去');
  },
  async (tok, S) => { // 1431.2 Z
    S.L = nline(-3, 3, 0.4, 1.0, 3.0);
    for (let v = -3; v <= 3; v++) num(v < 0 ? '−' + -v : v, 3.0 + v, 1.0, C.purple, 0.5);
    sm('…', -0.6, 1.0); sm('…', 6.6, 1.0);
    hd('Z = {…, −2, −1, 0, 1, 2, …}', 3.0, 2.0);
    cap('Z = {…, −2, −1, 0, 1, 2, …}', '以後 Z 都表示整數集合，要記起來');
  },
]);

scene('sfB-l5-builder', 'Lec05：set builder 寫法與常用集合', [
  async (tok, S) => { // 1444.3 set builder
    S.b = board(-2.6, 6.6, 9.4, 0.76); S.b.add('set builder：不一一列出，改給「條件」', C.gold);
    cap('另一種寫法：set builder', '不明講誰在裡面，而是給條件');
  },
  async (tok, S) => { // 1463.1 S = {x | P(x)}
    S.b.add('S = { x | P(x) }：P(x) 為真的 x 才放進來', C.lilac);
    S.m = prop('parcel', 5.6, 4.6, 0, 0.9, 'P(x) 為真？');
    cap('S = {x | P(x)}', '元素 x 要讓述詞 P(x) 為真才可以放進來');
  },
  async (tok, S) => { // 1478.2 R
    S.b.add('R = 所有實數');
    cap('粗體大寫 R', '所有實數都放進來：實數集合');
  },
  async (tok, S) => { // 1491.0 Q
    S.b.add('Q = { p/q | p, q ∈ Z，q ≠ 0 }：有理數');
    cap('Q 是有理數', '能寫成兩個整數相除的數');
  },
  async (tok, S) => { // 1503.4 Q⁺
    S.b.add('Q⁺ = { x ∈ R | x = p/q（p, q ∈ Z）且 x > 0 }：正有理數', C.mint);
    cap('上面加個 + 號：正的', '兩個條件用 and，都要符合');
  },
  async (tok, S) => { // 1528.3 Z⁺ Z⁻ N
    S.b.add('Z⁺ 正整數、Z⁻ 負整數、N 自然數');
    cap('Z⁺ 正整數、Z⁻ 負整數', 'N 是自然數');
  },
  async (tok, S) => { // 1537.5 ∅
    S.b.add('∅ 空集合 = { x | 永遠不成立 }：什麼都沒有', C.peach);
    cap('最重要的：空集合', '不管 x 放什麼都說不是，所以裡面什麼都沒有');
  },
]);

scene('sfB-l5-equal', 'Lec05：集合相等：順序、重複、區間', [
  async (tok, S) => { // 1568.4 順序沒關係
    blob('{1, 2, 3}', [1, 2, 3], -4.2, 4.6, 1.8, 1.0, C.blue, 3); hot('=', -1.6, 4.6); blob('{3, 1, 2}', [3, 1, 2], 1.0, 4.6, 1.8, 1.0, C.blue, 3);
    cap('集合跟順序沒關係', '{1, 2, 3} 和 {3, 1, 2} 是同一個集合');
  },
  async (tok, S) => { // 1577.0 重複只算一個
    blob('{1, 2, 2, 2}', [1, 2, 2, 2], -4.2, 1.9, 2.1, 1.0, C.green, 4); hot('=', -1.6, 1.9); blob('{1, 2}', [1, 2], 1.0, 1.9, 1.4, 1.0, C.green, 2);
    cap('同一個 2 寫兩次、三次', '都只算一個，只是浪費墨水');
  },
  async (tok, S) => { // 1587.7 區間
    card('[1, 10] = { x | 1 ≤ x ≤ 10 }', C.lilac, 4.6, 3.3, 5.0);
    cap('區間也可以這樣寫', '兩種寫法指的都是 1 到 10 之間的 x');
  },
]);

scene('sfB-l5-card', 'Lec05：cardinality |S|：有限與無窮', [
  async (tok, S) => { // 1611.6 cardinality
    S.s = blob('S = {1, 2, 2, 3}', [1, 2, 2, 3], -4.2, 4.2, 2.1, 1.2, C.blue, 4);
    hot('cardinality：集合裡有幾個「不一樣」的元素', 2.4, 6.4);
    cap('再定義 cardinality', '算集合裡有幾個不一樣的元素');
  },
  async (tok, S) => { // 1630.2 |S|
    S.c = card('符號：|S|（用絕對值的樣子）', C.lilac, 2.4, 5.4, 6.4); glow(S.c, HL);
    cap('符號用絕對值', 'S 的 cardinality 寫成 |S|');
  },
  async (tok, S) => { // 1641.0 = 3
    glow(S.c, null); glow(S.s.cubes[2], NG); sm('重複', S.s.cubes[2].position.x, 3.2);
    S.r = card('|S| = 3（不管寫成什麼形式）', C.mint, 2.4, 4.6, 6.4); glow(S.r, HL);
    cap('不一樣的元素有 1、2、3', '所以 |S| = 3');
  },
  async (tok, S) => { // 1649.2 |∅| = 0
    glow(S.r, null); S.e = card('|∅| = 0（一個東西都沒有）', C.sky, 2.4, 3.8, 6.4); glow(S.e, HL);
    cap('空集合', '一個東西都沒有，答案是 0');
  },
  async (tok, S) => { // 1652.3 有限集合
    glow(S.e, null); S.f = card('數得完 → finite set 有限集合', C.mint, 2.4, 3.0, 6.4); glow(S.f, HL);
    cap('元素個數數得完', '稱為有限集合：|S| 真的是一個數字');
  },
  async (tok, S) => { // 1670.7 無窮
    glow(S.f, null);
    for (let v = 0; v <= 8; v++) { num(v, -6.0 + v * 1.0, 1.0, C.purple, 0.5); await wt(tok, 80); }
    sm('… 無窮無盡', 3.6, 1.0); hd('N = {0, 1, 2, 3, …}', -2.0, 1.8);
    S.i = card('數不完 → infinite set 無窮集合', C.peach, 2.4, 2.2, 6.4); glow(S.i, HL);
    cap('自然數 0、1、2、3…數得完嗎？', '數不完：infinite set 無窮集合');
  },
]);

// 元素方塊：外層一個 = 一格；內層集合寫在方塊上
function topRow(items, y, c = C.sky) {
  const w = items.map((t) => 0.3 + 0.2 * t.length), gap = 0.25, tot = w.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let x = -tot / 2; const cs = items.map((t, i) => { const m = cube(t, c, [w[i], 0.62, 0.62], x + w[i] / 2, y, 0.3, 1.2); x += w[i] + gap; return m; });
  const L = hd('{', -tot / 2 - 0.45, y), R = hd('}', tot / 2 + 0.45, y);
  return { cs, all: [...cs, L, R] };
}
scene('sfB-l5-count', 'Lec05：練習：集合裡有幾個元素？', [
  async (tok, S) => { // 1699.2 ∅ = {}
    S.e = card('空集合 ∅ 也可以寫成 { }', C.sky, -3.8, 6.4, 5.4); glow(S.e, HL);
    cap('練習一下', '空集合 ∅ 也可以寫成 { }');
  },
  async (tok, S) => { // 1715.0 A = {∅}
    glow(S.e, null); S.a = card('A = {∅}：有 1 個元素！', C.peach, 3.4, 6.4, 5.8); glow(S.a, HL);
    cap('A = {∅} 裡有幾個東西？', '一個：∅ 被當成一個符號放在裡面');
  },
  async (tok, S) => { // 1728.7 空集合要全空
    glow(S.a, null); note('真的空集合：括號裡要全部空著', 3.4, 5.75);
    cap('如果是空集合', '括號裡應該要全部空著');
  },
  async (tok, S) => { // 1755.0 V = { … }
    S.v = topRow(['{a, b, c}', 'x', 'y', 'z', '{x}'], 3.6); hd('V =', -4.6, 3.6); sm('（示意：依講解重建）', 0, 2.75);
    cap('再寫一個 V', '請問 V 有幾個元素？');
  },
  async (tok, S) => { // 1772.8 最外層括號、往內看一層逗點
    glowAll(S.v.cs, HL); await wt(tok, 400); glowAll(S.v.cs, null);
    cap('先看最外面的括號', '才是 V 自己的括號，往內看一層的逗點');
  },
  async (tok, S) => { // 1790.0 裡面再放集合只算一個
    glow(S.v.cs[0], HL); bub('裡面寫得再複雜，也只算 1 個', S.v.cs[0].position.x, 4.5);
    cap('裡面又放一個東西', '不要管它多複雜，就算一個');
  },
  async (tok, S) => { // 1808.8 一個個寫 ∈
    glow(S.v.cs[0], null); S.lst = card('{a,b,c} ∈ V、x ∈ V、y ∈ V、z ∈ V、{x} ∈ V', C.mint, 0, 1.9, 9.6); glow(S.lst, HL);
    cap('所以可以寫', '{a, b, c} ∈ V，x ∈ V，y ∈ V，z ∈ V');
  },
  async (tok, S) => { // 1834.7 x 和 {x} 不一樣
    glow(S.lst, null); glow(S.v.cs[1], HL); glow(S.v.cs[4], HL); note('x 和 {x} 不一樣：{x} 是「x 所成的集合」', 0, 1.15);
    cap('特別注意 x 跟 {x}', '{x} 是 x 所成的集合，也是 V 的一個元素');
  },
  async (tok, S) => { // 1856.7 數逗點：5 個
    glowAll(S.v.cs, null);
    for (const m of S.v.cs) { glow(m, OKG); await wt(tok, 200); }
    good('|V| = 5', 4.6, 2.6);
    cap('看逗點隔開的', '一個、兩個、三個、四個、五個');
  },
  async (tok, S) => { // 1906.4 C = {{1,2}}：1 個
    glowAll(S.v.cs, null);
    S.cC = cube('{1, 2}', C.lilac, [1.5, 0.62, 0.62], 0, 0.1, 0.3, 1.2); hd('C = {', -1.5, 0.1); hd('}', 1.0, 0.1); sm('（示意）', 2.3, 0.1);
    glow(S.cC, HL); bad('|C| = 1', -4.6, 0.1);
    cap('C 集合：最外層裡面找不到逗點', '這是一堆，所以只有 1 個元素');
  },
  async (tok, S) => { // 1924.6 它裡面的元素是兩個
    note('{1, 2} 這個元素「裡面」才有 2 個東西', 3.0, -0.6);
    cap('它的元素 {1, 2} 裡面', '才有兩個符號；{1, 2} ∈ C');
  },
]);

scene('sfB-l5-subset', 'Lec05：子集合 ⊆ 與真子集合', [
  async (tok, S) => { // 1955.8 子集合
    S.B = oval(-3.4, 3.2, 3.2, 2.4); hd('B', -6.0, 5.6);
    S.A = oval(-4.2, 3.0, 1.5, 1.2, '#4b9ee2'); hd('A', -5.4, 4.3);
    hot('子集合 subset', 3.4, 6.6);
    cap('定義子集合', '寫法有兩套，先看比較嚴格的定義');
  },
  async (tok, S) => { // 1965.0 A ⊆ B
    S.b = board(3.4, 5.8, 7.0, 0.72); S.b.add('A ⊆ B：A 是 B 的子集合（A subset of B）', C.gold);
    cap('A、B 兩個集合', 'A 是 B 的子集合：A ⊆ B');
  },
  async (tok, S) => { // 1993.2 iff every element ...
    S.b.add('iff：A 的每個元素也都是 B 的元素');
    S.xs = [num('x', -4.6, 3.0, C.blue, 0.5), num('y', -3.8, 3.0, C.blue, 0.5)];
    cap('if and only if', 'A 裡的元素都一定在 B 裡面找得到');
  },
  async (tok, S) => { // 2001.0 ∀x(x∈A → x∈B)
    S.b.add('∀x ( x ∈ A → x ∈ B ) 永遠為真', C.lilac); glowAll(S.xs, OKG);
    cap('寫成邏輯述詞', '對所有 x：x 在 A 裡，則 x 一定在 B 裡');
  },
  async (tok, S) => { // 2032.8 例 1,2,3 ∈ N；−1 ∉ N
    S.b.add('例：1, 2, 3 ∈ N；−1、−2 ∉ N（N 含 0 與正整數）', C.mint);
    cap('1、2、3 屬於自然數', '−1 不屬於：自然數只含 0 和正整數');
  },
  async (tok, S) => { // 2047.1 proper subset
    S.b.add('proper subset 真子集合：A ⊂ B', C.gold);
    cap('另一個名詞', 'proper subset 真子集合');
  },
  async (tok, S) => { // 2054.1 排除 A = B
    S.w = num('w', -1.6, 3.0, C.orange, 0.5); glow(S.w, HL); bub('B 裡至少有一個不在 A', -1.6, 4.0);
    cap('排除 A 跟 B 相等的可能', 'B 裡面至少有一個元素不在 A');
  },
  async (tok, S) => { // 2064.6 式子
    S.b.add('A ⊆ B ∧ ∃x ( x ∈ B ∧ x ∉ A )', C.lilac);
    cap('寫出來：A 是 B 的子集合', '而且另外找得到一個 x 在 B、不在 A');
  },
  async (tok, S) => { // 2086.8 ∅ ⊆ S
    good('定理：任何集合 S，∅ ⊆ S', -3.4, 0.3);
    cap('定理：任何集合', '一定有空集合這個子集合');
  },
  async (tok, S) => { // 2094.3 S ⊆ S
    good('而且 S ⊆ S（自己是自己的子集合）', 3.4, 0.3);
    cap('另外', '它自己是自己的一個子集合');
  },
]);

// ════════ 6U8lGu2pZyM（易志偉 Lec06：文氏圖、排容、冪集合、直積、集合運算、函數、高斯、一對一） ════════
const rectL = (x0, y0, x1, y1, c) => [line(x0, y0, x1, y0, 0, c), line(x1, y0, x1, y1, 0, c), line(x1, y1, x0, y1, 0, c), line(x0, y1, x0, y0, 0, c)];
const dotF = (x, y, c = C.dark) => cube(null, c, [0.2, 0.2, 0.2], x, y, 0.15);
const dotO = (x, y) => ringL(x, y, 0.11, '#5a4a30', 0.16);
// 座標軸：原點 (ox, oy)，每單位 sx、sy
function axes(ox, oy, sx, sy, x0, x1, y0, y1, every = 1) {
  const X = (v) => ox + v * sx, Y = (v) => oy + v * sy;
  const all = [line(X(x0) - 0.3, oy, X(x1) + 0.3, oy), line(ox, Y(y0) - 0.3, ox, Y(y1) + 0.3)];
  if (every < 100) for (let v = Math.ceil(x0); v <= x1; v += every) if (v) all.push(sm(String(v).replace('-', '−'), X(v), oy - 0.32));
  if (every < 100) for (let v = Math.ceil(y0); v <= y1; v += every) if (v) all.push(sm(String(v).replace('-', '−'), ox - 0.32, Y(v)));
  return { X, Y, all };
}
// 函數箭頭圖：A 一欄、B 一欄
function fdiag(as, bs, xa = -3, xb = 3, yc = 3.3, dy = 0.85, na = 'A', nb = 'B') {
  const yA = (i) => yc + ((as.length - 1) / 2 - i) * dy, yB = (i) => yc + ((bs.length - 1) / 2 - i) * dy;
  const ha = (Math.max(as.length, 2) * dy) / 2 + 0.45, hb = (Math.max(bs.length, 2) * dy) / 2 + 0.45;
  const all = [oval(xa, yc, 0.95, ha), oval(xb, yc, 0.95, hb), hd(na, xa, yc + ha + 0.3), hd(nb, xb, yc + hb + 0.3)];
  const A = as.map((v, i) => num(v, xa, yA(i), C.blue, 0.5)), B = bs.map((v, i) => num(v, xb, yB(i), C.green, 0.5));
  all.push(...A, ...B);
  return { A, B, yA, yB, all, link(i, j, c) { const a = arr(xa + 0.35, yA(i), xb - 0.35, yB(j), c); all.push(a); return a; } };
}
// 小表格：一格一顆方塊
function table(heads, x0, yTop, dx, dy) {
  const X = (c) => x0 + c * dx, Y = (r) => yTop - (r + 1) * dy;
  const hs = heads.map((h, c) => tag(h, 'ptr', X(c), yTop));
  return { hs, X, Y, cell(r, c, v, col) { return cube(v, col || (v === 'T' ? C.green : C.gray), [dx * 0.8, dy * 0.75, 0.5], X(c), Y(r), 0, 1.0); } };
}
const curve = (G, f, x0, x1, color) => { const pts = []; for (let k = 0; k <= 40; k++) { const x = x0 + ((x1 - x0) * k) / 40; pts.push(V3(G.X(x), G.Y(f(x)), 0.05)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; };

scene('sfB-l6-venn', 'Lec06：文氏圖：宇集 U 與 A、B、C', [
  async (tok, S) => { // 10.0
    hot('文氏圖 Venn Diagram：幫我們理解集合', 0, 6.75);
    cap('上次跳過的：文氏圖', 'Venn diagram，用圖幫我們理解');
  },
  async (tok, S) => { // 28.3 框框 = 集合的範圍
    ringL(-3, 3.8, 1.9); hd('A', -4.6, 5.8);
    cap('一個框框', '表示一個集合的範圍');
  },
  async (tok, S) => { // 43.7 U：a～g
    rectL(-6.6, 1.2, 6.6, 6.3); hd('U', -6.2, 6.0);
    S.el = {}; const Pp = { a: [-1.5, 3.8], f: [-3.6, 4.4], g: [-3.6, 3.2], b: [1.5, 4.4], c: [1.5, 3.2], d: [3.6, 4.4], e: [3.6, 3.2] };
    for (const k of 'abcdefg') { S.el[k] = num(k, Pp[k][0], Pp[k][1], C.sand, 0.5); await wt(tok, 90); }
    cap('U 是宇集', '裡面所有元素：a、b、c、d、e、f、g');
  },
  async (tok, S) => { // 62.0 A = {a, f, g}
    for (const k of 'afg') { tint(S.el[k], C.sky); glow(S.el[k], HL); }
    S.ca = card('A = {a, f, g}', C.sky, -4.4, 0.2, 4.0); glow(S.ca, HL);
    cap('框在裡面的就是元素', 'A = {a, f, g}');
  },
  async (tok, S) => { // 75.8 B = {a, b, c}
    glowAll(Object.values(S.el), null); glow(S.ca, null); ringL(0, 3.8, 1.9); hd('B', 0, 6.0);
    for (const k of 'abc') glow(S.el[k], HL);
    S.cb = card('B = {a, b, c}', C.mint, 0, 0.2, 4.0); glow(S.cb, HL);
    cap('B 是這個框', 'B = {a, b, c}');
  },
  async (tok, S) => { // 80.0 C = {b, c, d, e}
    glowAll(Object.values(S.el), null); glow(S.cb, null); ringL(3, 3.8, 1.9); hd('C', 4.6, 5.8);
    for (const k of 'bcde') glow(S.el[k], HL);
    S.cc = card('C = {b, c, d, e}', C.peach, 4.4, 0.2, 4.0); glow(S.cc, HL);
    cap('還有 C', 'C = {b, c, d, e}');
  },
  async (tok, S) => { // 117.2 A ∩ B = {a}
    glowAll(Object.values(S.el), null); glow(S.cc, null); disc(-1.5, 3.8, 0.45, C.purple, 0.45); glow(S.el.a, HL);
    bub('A ∩ B = {a}', -0.9, 1.6);
    cap('A 跟 B 的交集', '兩個重合的區域：只有 a');
  },
  async (tok, S) => { // 124.9 A ∪ B
    disc(-3, 3.8, 1.9, C.blue, 0.16); disc(0, 3.8, 1.9, C.blue, 0.16);
    for (const k of 'abcfg') glow(S.el[k], HL);
    bub('A ∪ B = {a, b, c, f, g}', -4.6, 1.6);
    cap('A 跟 B 的聯集', '被兩個框包住的：a、b、c、f、g');
  },
  async (tok, S) => { // 157.6 只能幫助理解
    note('文氏圖不能拿來證明，只是幫我們理解', 0, -0.5);
    cap('文氏圖不能做什麼事', '只是幫我們理解而已');
  },
]);

scene('sfB-l6-ie2', 'Lec06：排容原理：|A ∪ B| = |A| + |B| − |A ∩ B|', [
  async (tok, S) => { // 167.3
    ringL(-3.2, 3.4, 2.0); ringL(-0.4, 3.4, 2.0); hd('A', -4.8, 5.6); hd('B', 1.2, 5.6);
    S.el = {}; const Pp = { a: [-1.8, 3.4], f: [-3.8, 4.0], g: [-3.8, 2.8], b: [0.2, 4.0], c: [0.2, 2.8] };
    for (const k in Pp) S.el[k] = num(k, Pp[k][0], Pp[k][1], C.sand, 0.5);
    hot('inclusion–exclusion principle 排容原理', 2.6, 6.75);
    cap('先講 inclusion–exclusion principle', '排容原理最簡單的形式');
  },
  async (tok, S) => { // 171.3
    S.b = board(4.4, 5.6, 5.2, 0.8); S.b.add('|A ∪ B| = ?（不太會算）', C.gold);
    cap('A ∪ B 這個集合的大小', '元素個數不太會直接算的話…');
  },
  async (tok, S) => { // 186.0
    S.b.add('= |A| + |B| − |A ∩ B|', C.lilac);
    cap('可以算 |A| 加 |B|', '再減掉 |A ∩ B|');
  },
  async (tok, S) => { // 216.1 A: a,f,g；B: a,b,c
    for (const k of 'afg') glow(S.el[k], HL); bub('|A| = 3', -3.8, 1.0); await wt(tok, 500);
    glowAll(Object.values(S.el), null); for (const k of 'abc') glow(S.el[k], HL); bub('|B| = 3', 0.4, 1.0);
    cap('先算 A 裡的 a、f、g', '再算 B 裡的 a、b、c');
  },
  async (tok, S) => { // 226.4 a 被算兩次
    glowAll(Object.values(S.el), null); disc(-1.8, 3.4, 0.6, C.red, 0.35); glow(S.el.a, NG); bad('a 被算了兩次！', -1.8, 6.0);
    cap('中間這一塊是重複的', '被你算了兩次，所以要減掉');
  },
  async (tok, S) => { // 240.8 3 + 3 − 1 = 5
    S.b.add('= 3 + 3 − 1 = 5 ✓', C.mint); sm('（圖上就是 a、b、c、f、g）', 4.4, 2.6);
    cap('這就是排容原理', '聯集是「或」：3 + 3 − 1 = 5');
  },
]);

scene('sfB-l6-div', 'Lec06：1 到 100 能被 2 或 3 整除的有幾個？', [
  async (tok, S) => { // 247.7
    S.c = []; for (let n = 1; n <= 100; n++) { const r = Math.floor((n - 1) / 10), c = (n - 1) % 10; S.c.push(cube(String(n), C.sand, [0.47, 0.47, 0.3], -6.6 + c * 0.52, 6.3 - r * 0.52, 0)); }
    S.b = board(3.2, 6.4, 6.6, 0.7); S.b.add('1～100 能被 2 或 3 整除的有幾個？', C.gold);
    cap('計算題：1 到 100', '可以被 2 或 3 整除的有幾個？');
  },
  async (tok, S) => { // 278.3 A
    for (let n = 2; n <= 100; n += 2) tint(S.c[n - 1], C.blue);
    S.b.add('A = { x | 1 ≤ x ≤ 100，2 | x }', C.sky);
    cap('A：1 到 100 裡', '可以被 2 整除的數所成的集合');
  },
  async (tok, S) => { // 291.7 B
    for (let n = 3; n <= 100; n += 3) tint(S.c[n - 1], n % 2 ? C.orange : C.purple);
    S.b.add('B = { x | 1 ≤ x ≤ 100，3 | x }', C.peach);
    cap('B：可以被 3 整除的', '紫色 = 同時被 2 和 3 整除');
  },
  async (tok, S) => { // 304.1 要算 |A ∪ B|
    S.b.add('要算 |A ∪ B|：「或」不能直接用除法算');
    cap('要算的是 A ∪ B', '「或」沒辦法直接用除法處理');
  },
  async (tok, S) => { // 323.1 改算 A ∩ B：被 6 整除
    for (let n = 6; n <= 100; n += 6) glow(S.c[n - 1], HL);
    S.b.add('A ∩ B：被 2 且被 3 整除 = 被 6 整除', C.lilac);
    cap('改從 A ∩ B 來算', '被 2 整除且被 3 整除 = 被 6 整除');
  },
  async (tok, S) => { // 340.7 公式
    S.b.add('|A ∪ B| = |A| + |B| − |A ∩ B|', C.gold);
    cap('所以 |A ∪ B|', '= |A| + |B| − |A ∩ B|');
  },
  async (tok, S) => { // 352.5 |A| = 50
    good('|A| = 100 ÷ 2 = 50', 3.2, 2.2);
    cap('|A| 是多少？', '100 ÷ 2 = 50');
  },
  async (tok, S) => { // 364.5 100/3 = 33.33 → 33
    good('|B| = 100 ÷ 3 = 33.33… → 33', 3.2, 1.6);
    cap('|B| = 100 ÷ 3', '除出來是 33.33…，小數沒有用（最後一個是 99）');
  },
  async (tok, S) => { // 388.5 floor
    note('只取整數部分：下高斯 floor，⌊100/3⌋ = 33', 3.2, 1.0);
    cap('有一個函式叫下高斯', 'floor：取不比它大的最大整數');
  },
  async (tok, S) => { // 431.6 ⌊100/6⌋ = 16
    good('|A ∩ B| = ⌊100 ÷ 6⌋ = ⌊16.67⌋ = 16', 3.2, 0.4);
    cap('|A ∩ B| = 100 ÷ 6', '16.67 取下高斯 = 16（最後一個是 96）');
  },
  async (tok, S) => { // 434.3 67
    S.ans = card('50 + 33 − 16 = 67', C.mint, -4.2, 0.4, 4.6); glow(S.ans, OKG);
    cap('答案', '50 + 33 − 16 = 67');
  },
]);

scene('sfB-l6-bigop', 'Lec06：很多集合的聯集、交集符號', [
  async (tok, S) => { // 461.0
    hot('聯集、交集都有結合律：誰先算都一樣', 0, 6.4);
    for (let i = 0; i < 4; i++) ringL(-4.5 + i * 1.5, 3.6, 1.1);
    ['A₁', 'A₂', 'A₃', 'Aₙ'].forEach((t, i) => hd(t, -4.5 + i * 1.5, 5.0));
    cap('聯集、交集都有結合律', '可以自己跟自己結合');
  },
  async (tok, S) => { // 470.8 ⋃
    S.u = card('A₁ ∪ A₂ ∪ … ∪ Aₙ = ⋃ᵢ₌₁ⁿ Aᵢ', C.sky, 0, 1.7, 7.6); glow(S.u, HL);
    cap('很多個集合連集', '寫成 ⋃（i = 1 到 n）Aᵢ');
  },
  async (tok, S) => { // 487.1 ⋂
    glow(S.u, null); S.n = card('A₁ ∩ A₂ ∩ … ∩ Aₙ = ⋂ᵢ₌₁ⁿ Aᵢ', C.lilac, 0, 0.9, 7.6); glow(S.n, HL);
    cap('很多個集合交集也一樣', '順序沒關係，只管這幾個集合');
  },
]);

// 三圓文氏圖：每一塊被算了幾次
const R3 = { A: [-1.1, 0.6], B: [1.1, 0.6], C: [0, -1.3] };
const REG = { a: [-2.1, 1.1], b: [2.1, 1.1], c: [0, -2.4], ab: [0, 1.4], ac: [-1.3, -0.6], bc: [1.3, -0.6], abc: [0, 0] };
scene('sfB-l6-ie3', 'Lec06：排容原理：三個集合', [
  async (tok, S) => { // 505.0
    S.b = board(3.6, 6.4, 6.0, 0.72); S.b.add('|A₁ ∪ A₂ ∪ … ∪ Aₙ| = ?', C.gold);
    cap('問題：n 個集合聯集', '個數怎麼算？要看規律');
  },
  async (tok, S) => { // 526.0 三個集合
    S.ox = -3.6; S.oy = 3.4;
    for (const k in R3) ringL(S.ox + R3[k][0], S.oy + R3[k][1], 1.9);
    hd('A', S.ox - 3.1, S.oy + 2.2); hd('B', S.ox + 3.1, S.oy + 2.2); hd('C', S.ox + 2.0, S.oy - 3.0);
    S.cnt = {}; for (const k in REG) S.cnt[k] = hot('0', S.ox + REG[k][0], S.oy + REG[k][1]);
    note('數字 = 這一塊被算了幾次', S.ox, -0.1);
    cap('先看三個：A ∪ B ∪ C', '回去看文氏圖');
  },
  async (tok, S) => { // 540.5 |A|+|B|+|C|
    const v = { a: 1, b: 1, c: 1, ab: 2, ac: 2, bc: 2, abc: 3 }; for (const k in v) txt(S.cnt[k], String(v[k]));
    S.b.add('|A| + |B| + |C|', C.sky);
    cap('先算 A、B、C 的個數', '加起來：重疊的地方被算了 2 次、3 次');
  },
  async (tok, S) => { // 553.5 − |A∩B|
    txt(S.cnt.ab, '1'); txt(S.cnt.abc, '2'); disc(S.ox, S.oy + 1.0, 0.7, C.red, 0.3);
    S.b.add('− |A ∩ B|', C.peach);
    cap('A 跟 B 當中被重複多算', '扣掉 |A ∩ B|');
  },
  async (tok, S) => { // 561.3 − |A∩C|
    txt(S.cnt.ac, '1'); txt(S.cnt.abc, '1'); disc(S.ox - 0.8, S.oy - 0.4, 0.7, C.red, 0.3);
    S.b.add('− |A ∩ C|', C.peach);
    cap('A 跟 C 之間重複的', '也扣掉 |A ∩ C|');
  },
  async (tok, S) => { // 567.7 − |B∩C|
    txt(S.cnt.bc, '1'); txt(S.cnt.abc, '0'); disc(S.ox + 0.8, S.oy - 0.4, 0.7, C.red, 0.3);
    S.oops = bad('中間被扣成 0 次了！', S.ox, S.oy - 0.55);
    S.b.add('− |B ∩ C|', C.peach);
    cap('B 跟 C 也多算一次', '扣掉 |B ∩ C|——但中間被多扣了');
  },
  async (tok, S) => { // 586.9 + |A∩B∩C|
    txt(S.cnt.abc, '1'); remove(S.oops); disc(S.ox, S.oy, 0.45, C.green, 0.5);
    S.b.add('+ |A ∩ B ∩ C|', C.mint);
    good('每一塊都剛好算 1 次 ✓', 3.6, 1.2);
    cap('多減的要加回去', '+ |A ∩ B ∩ C|');
  },
]);

scene('sfB-l6-ien', 'Lec06：排容原理的一般式', [
  async (tok, S) => { // 606.4
    S.b = board(-1.2, 6.5, 10.0, 0.72); S.b.add('一般式：|A₁ ∪ A₂ ∪ … ∪ Aₙ| =', C.gold);
    cap('從三個出發', '得到排容原理最一般的式子');
  },
  async (tok, S) => { // 618.6 每個 |Ai|
    S.b.add('|A₁| + |A₂| + … + |Aₙ|（每個小框框都加）', C.sky);
    cap('第一步：每一個 |Aᵢ|', '全部加起來');
  },
  async (tok, S) => { // 635.1 − 兩兩
    S.b.add('− |A₁∩A₂| − |A₁∩A₃| − …（所有兩兩配對）', C.peach);
    cap('多加的扣掉', '所有兩個集合的組合找出來扣掉');
  },
  async (tok, S) => { // 662.3 + 三個
    S.b.add('+ |A₁∩A₂∩A₃| + |A₁∩A₂∩A₄| + …（三個的）', C.mint);
    cap('又多扣了一些', '加回三個集合的交集，全部列舉');
  },
  async (tok, S) => { // 685.8 − 四個 + 五個 …
    S.b.add('− 四個的 + 五個的 − …（正負交替）', C.lilac);
    cap('接著又多算了', '再減四個的、加五個的…');
  },
  async (tok, S) => { // 695.1 最後一項
    S.b.add('+ (−1)ⁿ⁺¹ |A₁ ∩ A₂ ∩ … ∩ Aₙ|', C.gold);
    cap('最後一項', '一個取正、兩個取負：(−1)ⁿ⁺¹');
  },
  async (tok, S) => { // 723.0 精簡 Σ|Ai|
    S.s = board(1.2, 1.9, 9.6, 0.62); S.s.add('精簡：Σᵢ |Aᵢ|', C.sky, 3.4);
    cap('寫得更精簡', '先 Σ（i = 1 到 n）|Aᵢ|');
  },
  async (tok, S) => { // 737.8 − Σ_{i<j}
    S.s.add('− Σ over 1≤i<j≤n |Aᵢ ∩ Aⱼ|（i、j 不一樣）', C.peach, 6.4);
    cap('兩個的怎麼表示？', 'i、j 在 1 到 n 中而且不一樣');
  },
  async (tok, S) => { // 778.5 + Σ_{i<j<k}
    S.s.add('+ Σ over 1≤i<j<k≤n |Aᵢ ∩ Aⱼ ∩ Aₖ|', C.mint, 6.4);
    cap('三個的依此類推', 'i、j、k 在 1 到 n 中、彼此不同');
  },
  async (tok, S) => { // 835.2 … + (−1)^{n+1}|⋂|
    S.s.add('− … + (−1)ⁿ⁺¹ |⋂ᵢ₌₁ⁿ Aᵢ|', C.lilac, 5.0);
    cap('一直加到最後一項', '(−1)ⁿ⁺¹ 乘上全部的交集');
  },
]);

scene('sfB-l6-power', 'Lec06：冪集合 P({1, 2, 3})', [
  async (tok, S) => { // 876.3
    hot('power set 冪集合', 0, 6.7);
    cap('什麼叫 power set', '直接舉例子');
  },
  async (tok, S) => { // 894.0 A = {1,2,3}
    blob('A = {1, 2, 3}', [1, 2, 3], -4.8, 5.0, 1.6, 0.8, C.blue, 3);
    cap('一個集合 A', '由 1、2、3 三個東西組成');
  },
  async (tok, S) => { // 907.2 2^A
    S.n = card('記作 2^A（power = 次方）', C.lilac, 2.6, 5.6, 5.6); glow(S.n, HL);
    cap('A 的 power set', '一般寫成 2 的 A 次方：2^A');
  },
  async (tok, S) => { // 922.2 所有子集合
    glow(S.n, null); note('= A 的「所有子集合」收集起來所成的集合', 2.6, 4.9);
    cap('它的意義', '把 A 所有可能的子集合收集起來');
  },
  async (tok, S) => { // 932.6 ∅
    S.row = (i, t, y) => { const m = cube(t, C.mint, [0.25 * t.length + 0.4, 0.55, 0.5], -4.6 + i * 2.3, y, 0.3, 1.2); glow(m, HL); return m; };
    S.all = [S.row(0, '∅', 3.4)];
    cap('第一個：空集合', '空集合是任何集合的子集合');
  },
  async (tok, S) => { // 938.0 一個元素
    glowAll(S.all, null); for (const [i, t] of [[1, '{1}'], [2, '{2}'], [3, '{3}']]) S.all.push(S.row(i, t, 3.4));
    cap('一個元素的', '{1}、{2}、{3}');
  },
  async (tok, S) => { // 956.3 兩個元素
    glowAll(S.all, null); for (const [i, t] of [[1, '{1, 2}'], [2, '{2, 3}'], [3, '{1, 3}']]) S.all.push(S.row(i, t, 2.3));
    cap('子集合也可能有兩個元素', '{1, 2}、{2, 3}、{1, 3}');
  },
  async (tok, S) => { // 960.2 {1,2,3}
    glowAll(S.all, null); S.all.push(S.row(2, '{1, 2, 3}', 1.2));
    cap('還有', '{1, 2, 3} 自己');
  },
  async (tok, S) => { // 974.0 元素是集合
    glowAll(S.all, null); hd('2^A = {', -6.6, 2.3); hd('}', 3.6, 1.2);
    note('2^A 的元素是「一個一個的集合」', 0, 0.4);
    cap('這些都是 power set 的元素', '它的元素是一個一個的集合');
  },
  async (tok, S) => { // 1013.3 8 個
    for (const m of S.all) { glow(m, OKG); await wt(tok, 120); }
    good('|2^A| = 8', 4.8, 3.4);
    cap('數一下：最外層括號往內看一層', '一、二、…八：有 8 個元素');
  },
]);

scene('sfB-l6-pow2', 'Lec06：為什麼是 2 的 n 次方：挑或不挑', [
  async (tok, S) => { // 1025.0 B = {0,1}
    blob('B = {0, 1}', [0, 1], -5.0, 5.4, 1.2, 0.7, C.green, 2);
    cap('再看一個例子', 'B = {0, 1}');
  },
  async (tok, S) => { // 1041.0 P(B)
    S.pb = card('2^B = { ∅, {0}, {1}, {0, 1} }', C.mint, 1.2, 5.6, 6.6); glow(S.pb, HL);
    cap('B 的 power set', '空集合、{0}、{1}、{0, 1} 都是 B 的子集合');
  },
  async (tok, S) => { // 1070.1 4 個
    good('4 個', 5.2, 5.0);
    cap('數一數', '一、二、三、四：4 個');
  },
  async (tok, S) => { // 1078.1 8 怎麼來
    glow(S.pb, null); hot('A = {1, 2, 3}：2^A 為什麼是 8 個？', 0, 4.3);
    cap('A 的 power set 有 8 個元素', '這個 8 是怎麼來的？');
  },
  async (tok, S) => { // 1098.8 {1}：挑 1
    ['1', '2', '3'].forEach((t, i) => hd(t, -2.0 + i * 1.3, 3.4)); hd('子集合', -4.4, 3.4);
    S.sw = (r, bits, name) => { hd(name, -4.4, 2.6 - r * 0.8); return bits.map((b, i) => cube(b ? '要' : '不要', b ? C.green : C.gray, [1.0, 0.55, 0.5], -2.0 + i * 1.3, 2.6 - r * 0.8, 0, 1.0)); };
    S.sw(0, [1, 0, 0], '{1}');
    cap('子集合 {1} 的意思', '從 A 裡挑了 1，2、3 不要');
  },
  async (tok, S) => { // 1108.5 {2,3}
    S.sw(1, [0, 1, 1], '{2, 3}');
    cap('{2, 3} 呢？', '挑了 2 跟 3，1 不要');
  },
  async (tok, S) => { // 1139.6 2³
    S.c = card('每個元素：挑或不挑 → 2 × 2 × 2 = 2³ = 8', C.lilac, 3.6, 1.0, 7.0); glow(S.c, HL);
    cap('三個東西給你挑', '每一個都有挑、不挑兩種：2³');
  },
  async (tok, S) => { // 1188.0 所以寫 2^A
    note('「2」= 挑或不挑兩種選擇 → 所以寫成 2^A', 3.6, 0.3);
    cap('這也是為什麼寫 2^A', '2 表示挑或不挑兩種選擇');
  },
  async (tok, S) => { // 1191.5 |2^B| = 2^|B| = 4
    glow(S.c, null); S.f = card('|2^B| = 2^|B| = 2² = 4', C.mint, -4.4, 0.6, 4.6); glow(S.f, HL);
    cap('B 的 power set', '0、1 兩個東西給你選：2² = 4 種');
  },
  async (tok, S) => { // 1213.5 P(A) = 2^A
    glow(S.f, null); S.g = card('P(A) = 2^A，|P(A)| = 2^|A|', C.gold, -4.4, -0.2, 4.6); glow(S.g, HL);
    cap('寫成函式形式就是 P(A)', '很重要的公式：|P(A)| = 2^|A|');
  },
]);

scene('sfB-l6-cart', 'Lec06：笛卡兒積 {1, 2, 3} × {a, b}', [
  async (tok, S) => { // 1239.3 有序對
    hot('A × B 直積：元素是「有序對」(a, b)', 0, 6.7);
    cap('A × B 叫做直積', '集合裡的東西是有序對');
  },
  async (tok, S) => { // 1247.6 像座標
    note('像座標：x、y 都一模一樣才算同一點，(1, 2) ≠ (2, 1)', 0, 6.1);
    cap('有序對就跟座標一樣', 'x 座標、y 座標都一樣才相等');
  },
  async (tok, S) => { // 1268.6 前面從 A、後面從 B
    S.d = card('A × B = { (a, b) | a ∈ A，b ∈ B }', C.lilac, 0, 5.3, 7.4); glow(S.d, HL);
    cap('前面從集合 A 拿', '後面從集合 B 拿，所有可能寫下來');
  },
  async (tok, S) => { // 1279.3 A={1,2,3}, B={a,b}
    glow(S.d, null);
    [1, 2, 3].forEach((v, i) => num(v, -5.2, 3.6 - i * 0.95, C.blue, 0.6)); hd('A', -6.2, 3.6);
    ['a', 'b'].forEach((v, j) => num(v, -2.6 + j * 2.6, 4.5, C.green, 0.6)); hd('B', -1.3, 4.5);
    cap('舉例：A = {1, 2, 3}', 'B = {a, b}，一邊三個、一邊兩個');
  },
  async (tok, S) => { // 1306.0 固定 1
    S.cell = (i, j) => { const m = cube('(' + (i + 1) + ', ' + 'ab'[j] + ')', C.mint, [1.6, 0.6, 0.5], -2.6 + j * 2.6, 3.6 - i * 0.95, 0, 1.0); glow(m, HL); return m; };
    S.cs = [S.cell(0, 0), S.cell(0, 1)];
    cap('固定前面是 1', '後面可以換 a 或 b');
  },
  async (tok, S) => { // 1320.5 2
    glowAll(S.cs, null); S.cs.push(S.cell(1, 0), S.cell(1, 1));
    cap('前面換 2', '後面再取 a、取 b');
  },
  async (tok, S) => { // 1323.2 3
    glowAll(S.cs, null); S.cs.push(S.cell(2, 0), S.cell(2, 1));
    cap('3 的時候', '後面可以放 a，也可以放 b');
  },
  async (tok, S) => { // 1352.0 6 個
    glowAll(S.cs, null); for (const m of S.cs) { glow(m, OKG); await wt(tok, 120); }
    good('|A × B| = 6', 4.2, 3.6);
    cap('A × B 有幾個？', '一、二、三、四、五、六：6 個');
  },
  async (tok, S) => { // 1368.8 3 × 2
    S.f = card('|A × B| = |A| × |B| = 3 × 2 = 6', C.gold, 4.2, 2.7, 5.4); glow(S.f, HL);
    cap('6 是怎麼來的？', 'A 的個數乘上 B 的個數：3 × 2');
  },
  async (tok, S) => { // 1383.6 5 × 3 = 15
    glow(S.f, null); note('排隊問題：兩個位置，5 人 × 3 人 → 15 種配法', 2.0, 0.6);
    cap('就像排隊問題', '一邊 5 人、一邊 3 人：5 × 3 = 15 種配法');
  },
]);

scene('sfB-l6-cartpow', 'Lec06：綜合練習：2^(A×B) 有 64 個', [
  async (tok, S) => { // 1403.0
    hot('綜合練習：2^(A × B)，A = {1, 2, 3}、B = {a, b}', 0, 6.7);
    cap('綜合練習', 'A × B 的 power set：放它的子集合');
  },
  async (tok, S) => { // 1416.0 ∅
    S.b = board(-3.4, 5.9, 6.6, 0.66); S.b.add('∅', C.mint);
    cap('第一個當然是', '空集合');
  },
  async (tok, S) => { // 1432.1 一個
    S.b.add('{ (1, a) }　← 一個元素的', C.mint);
    cap('一個一個列：先列一個的', '{(1, a)} 是 A × B 的一個子集合');
  },
  async (tok, S) => { // 1442.8 兩個
    S.b.add('{ (1, a), (1, b) }　← 兩個的', C.sky);
    cap('再放兩個的', '(1, a) 跟 (1, b) 放在一起，算一個東西');
  },
  async (tok, S) => { // 1457.5 {(1,a),(2,a)}
    S.b.add('{ (1, a), (2, a) }、…', C.sky);
    cap('(1, a) 跟 (2, a) 也可以放一起', '可以一個一個列');
  },
  async (tok, S) => { // 1467.0 三個
    S.b.add('{ (1, a), (1, b), (2, a) }　← 三個的…', C.lilac);
    cap('接著列三個的', '再放四個、五個、六個的…寫不完');
  },
  async (tok, S) => { // 1483.0 寫不完
    hot('總共要寫幾個？', 3.8, 5.6);
    cap('為什麼寫不完？', '來看總共要寫幾個');
  },
  async (tok, S) => { // 1501.0 |A×B| = 6
    S.c1 = card('|A × B| = 3 × 2 = 6', C.sky, 3.8, 4.8, 5.0); glow(S.c1, HL);
    cap('先看 A × B 有多大', '|A| × |B| = 3 × 2 = 6');
  },
  async (tok, S) => { // 1504.5 64
    glow(S.c1, null); S.c2 = card('|2^(A×B)| = 2⁶ = 64', C.gold, 3.8, 4.0, 5.0); glow(S.c2, HL);
    cap('所以 power set 的大小', '2 的 6 次方 = 64 個集合');
  },
  async (tok, S) => { // 1519.0 一般 A1 × … × An
    glow(S.c2, null); S.g = card('A₁ × … × Aₙ = { (a₁, …, aₙ) | aᵢ ∈ Aᵢ }', C.lilac, 2.4, 1.7, 8.0); glow(S.g, HL);
    cap('一般式：n 個集合的直積', '每個 aᵢ 從 Aᵢ 裡各挑一個');
  },
  async (tok, S) => { // 1570.3 大小相乘
    glow(S.g, null); S.h = card('|A₁ × … × Aₙ| = |A₁| · |A₂| ⋯ |Aₙ|', C.mint, 2.4, 0.9, 8.0); glow(S.h, HL);
    cap('直積的大小', '個別集合的大小乘在一起');
  },
  async (tok, S) => { // 1585.8 價目表
    glow(S.h, null); prop('parcel', -5.8, -0.4, 0, 0.7); prop('note', -4.6, 0.0, 0, 1.2);
    note('price：季節 × 水果 × 計價單位 → 多少錢', 1.6, -0.1);
    cap('可以拿來幹嘛？水果商的價目表', 'price 是從 A × B × C 對應到錢的函式');
  },
]);

// 兩圓文氏圖的各區塊
function venn2(cx, cy, r = 1.9, d = 1.05) {
  const a = Math.atan2(Math.sqrt(r * r - d * d), d);
  const mk = (s, color, op = 0.45) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.position.set(cx, cy, 0.02); lab.world.add(m); return m; };
  const sh = {
    A() { const s = new THREE.Shape(); s.absarc(-d, 0, r, 0, Math.PI * 2, false); return s; },
    B() { const s = new THREE.Shape(); s.absarc(d, 0, r, 0, Math.PI * 2, false); return s; },
    AB() { const s = new THREE.Shape(); s.absarc(d, 0, r, Math.PI - a, Math.PI + a, false); s.absarc(-d, 0, r, -a, a, false); return s; },
    AmB() { const s = new THREE.Shape(); s.absarc(-d, 0, r, a, Math.PI * 2 - a, false); s.absarc(d, 0, r, Math.PI + a, Math.PI - a, true); return s; },
    BmA() { const s = new THREE.Shape(); s.absarc(d, 0, r, a - Math.PI, Math.PI - a, false); s.absarc(-d, 0, r, a, -a, true); return s; },
  };
  const V = { fills: [] };
  V.draw = (na = 'A', nb = 'B') => { ringL(cx - d, cy, r); ringL(cx + d, cy, r); hd(na, cx - d - r * 0.7, cy + r * 0.95); hd(nb, cx + d + r * 0.7, cy + r * 0.95); };
  V.fill = (k, color, op) => { const m = mk(sh[k](), color, op); V.fills.push(m); return m; };
  V.unfill = () => { V.fills.forEach((m) => lab.world.remove(m)); V.fills.length = 0; };
  return V;
}

scene('sfB-l6-ops', 'Lec06：交集、聯集、差集的正式定義', [
  async (tok, S) => { // 1644.8
    S.V = venn2(-3.4, 3.0); S.V.draw();
    S.b = board(3.6, 6.4, 6.4, 0.75); S.b.add('A、B 兩個集合：正式定義符號', C.gold);
    cap('A、B 是兩個集合', '正式定義幾個會用的符號');
  },
  async (tok, S) => { // 1670.5 ∩
    S.V.fill('AB', C.purple, 0.55);
    S.b.add('A ∩ B = { x | x ∈ A ∧ x ∈ B }', C.lilac);
    cap('交集：新的集合', '交集是 and：x 在 A 而且在 B');
  },
  async (tok, S) => { // 1684.5 ∪
    S.V.unfill(); S.V.fill('A', C.blue, 0.25); S.V.fill('B', C.blue, 0.25);
    S.b.add('A ∪ B = { x | x ∈ A ∨ x ∈ B }', C.sky);
    cap('聯集', 'x 屬於 A 或屬於 B，兩個其中一個都收');
  },
  async (tok, S) => { // 1701.8 A − B
    S.V.unfill();
    S.b.add('A − B = { x | x ∈ A ∧ x ∉ B }', C.peach);
    cap('差集 A − B', '只能在 A 裡面，不能在 B 裡面');
  },
  async (tok, S) => { // 1722.8 交大／清大
    S.st = buddy('清大生', '', C.peach, 1.2, 0.0, 1.2, 0.6); S.st.mood('wow');
    bub('交大的課：清大來偷聽的要趕出去', -3.4, 0.4);
    cap('就像交大的課', '來了清大學生偷聽，要把他趕出去');
  },
  async (tok, S) => { // 1735.8 A − B 這塊
    S.V.fill('AmB', C.orange, 0.55); hot('A − B', -5.2, 3.0);
    cap('A − B 是哪一塊？', 'A 裡面扣掉跟 B 重疊的那一塊');
  },
  async (tok, S) => { // 1749.0 B − A
    S.V.fill('BmA', C.teal, 0.55); hot('B − A', -1.6, 3.0);
    cap('B − A 呢？', 'B 裡面扣掉跟 A 重疊的');
  },
  async (tok, S) => { // 1753.7 蘋果被咬一口
    S.st.mood('happy'); await S.st.hop(tok);
    note('A − B 像蘋果 A 被 B 咬掉一口', -3.4, 5.6);
    cap('就像一顆蘋果', 'A 被 B 咬掉一口');
  },
]);

scene('sfB-l6-comp', 'Lec06：補集、互斥（U = {1, …, 10}）', [
  async (tok, S) => { // 1779.3 U
    rectL(-6.6, 0.6, -0.6, 6.1); hd('U', -6.2, 5.8);
    S.b = board(3.6, 6.4, 6.0, 0.72); S.b.add('U：universal set 宇集', C.gold);
    cap('假設 U 是我們的宇集', 'universal set');
  },
  async (tok, S) => { // 1790.8 Ā
    ringL(-3.6, 3.3, 1.6); hd('A', -4.8, 4.9);
    S.b.add('Ā = { x ∈ U | x ∉ A }（補集）', C.lilac);
    cap('補集 Ā（A bar）', 'x 在 U 裡找得到，但不能是 A 的');
  },
  async (tok, S) => { // 1814.2 外面那一塊
    S.out = cube(null, C.peach, [5.9, 5.4, 0.02], -3.6, 3.35, -0.05); S.hole = disc(-3.6, 3.3, 1.6, '#fffaf0', 0.95);
    S.bb = bub('Ā：外面這一塊', -1.9, 1.0);
    cap('從圖來看', 'Ā 就是 A 外面的這一整塊');
  },
  async (tok, S) => { // 1830.0 U − A
    S.b.add('Ā = U − A', C.sky);
    cap('換個想法', 'Ā 就是 U 把 A 整個拿掉');
  },
  async (tok, S) => { // 1844.6 disjoint
    gone(S.out, S.hole); remove(S.bb);
    S.b.add('disjoint 互斥：A ∩ B = ∅', C.peach);
    cap('再定義一個名詞 disjoint', '像關節沒接在一起：兩個集合沒有交集');
  },
  async (tok, S) => { // 1869.3 例：奇數、偶數
    S.A = [1, 3, 5, 7, 9].map((v, i) => num(v, -4.6 + (i % 3) * 1.0, 3.8 - Math.floor(i / 3) * 1.0, C.blue, 0.5));
    S.B = [2, 4, 6, 8, 10].map((v, i) => num(v, -1.2, 5.3 - i * 0.95, C.green, 0.5));
    sm('偶數', -1.2, 0.85);
    S.b.add('例：A 奇數、B 偶數 → A ∩ B = ∅', C.mint);
    cap('U = {1, …, 10}：A 奇數、B 偶數', '一奇一偶，A ∩ B 一定是空集合');
  },
  async (tok, S) => { // 1884.8 A ∩ C = {3, 5}
    S.b.add('若 C = {2,3,4,5}：A ∩ C = {3,5}', C.sky);
    glow(S.A[1], HL); glow(S.A[2], HL);
    cap('A ∩ C 呢？', '看奇數的部分：3 跟 5');
  },
  async (tok, S) => { // 1887.7 A ∪ B = U
    glowAll(S.A, OKG); glowAll(S.B, OKG);
    S.b.add('A ∪ B = U', C.mint);
    cap('A ∪ B 是多少？', '其實就等於 U');
  },
  async (tok, S) => { // 1919.6 Ā = B
    glowAll(S.A, null);
    S.b.add('Ā = B = {2, 4, 6, 8, 10}', C.gold);
    cap('A 的補集是多少？', '在這個例子裡就是 B');
  },
]);

scene('sfB-l6-part', 'Lec06：分割 partition', [
  async (tok, S) => { // 1931.5
    hot('partition 分割（很後面才會教到）', 0, 6.7);
    cap('偷偷先講一個概念', 'partition：分割');
  },
  async (tok, S) => { // 1952.3 U 由幾個子集合組成
    rectL(-6.4, 1.0, -0.4, 5.8); hd('U', -6.0, 6.1);
    S.p = [[-5.4, C.blue, 'A₁'], [-3.4, C.green, 'A₂'], [-1.4, C.orange, 'A₃']].map(([x, c, n]) => cube(n, c, [1.9, 4.7, 0.3], x, 3.4, 0, 1.0));
    cap('U 可以由幾個子集合構成', '例如 A₁、A₂、A₃');
  },
  async (tok, S) => { // 1971.8 切一刀
    S.p.forEach((m, i) => P.move(m, -5.6 + i * 2.2, 3.4, 0));
    note('一刀切下去：中間絕對不會連在一起', -3.4, 0.4);
    cap('因為是切割', '一刀切下去，中間不會連在一起');
  },
  async (tok, S) => { // 1982.0 U = ⋃ Ai
    S.b = board(3.6, 6.0, 6.0, 0.75); S.b.add('① U = A₁ ∪ A₂ ∪ … ∪ Aₙ', C.sky);
    cap('條件一：它們的聯集', '等於 U');
  },
  async (tok, S) => { // 1999.7 Ai ∩ Aj = ∅
    S.b.add('② Aᵢ ∩ Aⱼ = ∅（所有 i ≠ j）', C.peach);
    cap('條件二：兩兩交集是空集合', '裡面都沒有重疊，切得乾乾淨淨');
  },
  async (tok, S) => { // 2047.8 例：A、B
    S.b.add('例：A（奇數）、B（偶數）是 U 的 partition', C.mint);
    cap('剛才的例子', 'A ∪ B = U，A ∩ B = ∅ → 是 partition');
  },
  async (tok, S) => { // 2057.1 A,B,C,D
    gone(S.p);
    S.q = [[[1, 2, 3], C.blue, 'A'], [[4, 5, 6], C.green, 'B'], [[7, 8, 9], C.orange, 'C'], [[10], C.purple, 'D']].map(([vs, c, n], i) => { hd(n, -5.6 + i * 1.6, 5.2); return vs.map((v, k) => num(v, -5.6 + i * 1.6, 4.2 - k * 0.9, c, 0.55)); });
    S.b.add('A = {1,2,3}、B = {4,5,6}、C = {7,8,9}、D = {10}', C.lilac, 7.0);
    cap('再一個：U = {1, …, 10}', 'A = {1,2,3}、B = {4,5,6}、C = {7,8,9}、D = {10}');
  },
  async (tok, S) => { // 2068.7 U = A∪B∪C∪D
    S.b.add('U = A ∪ B ∪ C ∪ D', C.sky);
    cap('會發現', 'U = A ∪ B ∪ C ∪ D');
  },
  async (tok, S) => { // 2089.8 pairwise disjoint
    for (const g of S.q) glowAll(g, OKG);
    S.b.add('兩兩互斥 pairwise disjoint → partition ✓', C.mint);
    cap('而且它們兩兩互斥', 'pairwise disjoint：A、B、C、D 是 U 的 partition');
  },
]);

scene('sfB-l6-ident', 'Lec06：集合恆等式', [
  async (tok, S) => { // 2121.5
    S.b = board(0, 6.6, 9.0, 0.7); S.b.add('證明兩個集合相等：跟證明等式一樣', C.gold);
    cap('集合的相等怎麼證？', '就跟證明等式一樣');
  },
  async (tok, S) => { // 2128.5
    S.b.add('這些公式都是從「邏輯等價」推過來的');
    cap('等一下看到的公式', '其實是從邏輯等式推過來的');
  },
  async (tok, S) => { // 2149.1
    S.b.add('A ∪ ∅ = A', C.sky);
    cap('只寫幾個', 'A ∪ ∅ = A');
  },
  async (tok, S) => { // 2154.9
    S.b.add('A ∩ ∅ = ∅', C.sky);
    cap('比較特殊的', 'A ∩ ∅ = ∅');
  },
  async (tok, S) => { // 2158.0
    S.b.add('補集的補集：(Ā)‾ = A', C.lilac);
    cap('A 的補集的補集', '等於 A');
  },
  async (tok, S) => { // 2163.9
    S.b.add('De Morgan：(A ∩ B)‾ = Ā ∪ B̄', C.peach);
    cap('迪摩根律', 'A ∩ B 的補集 = Ā ∪ B̄');
  },
  async (tok, S) => { // 2177.0
    S.b.add('De Morgan：(A ∪ B)‾ = Ā ∩ B̄', C.peach);
    cap('另一條', 'A ∪ B 的補集 = Ā ∩ B̄');
  },
  async (tok, S) => { // 2183.0
    S.b.add('分配律：A ∪ (B ∩ C) = (A ∪ B) ∩ (A ∪ C)', C.mint);
    cap('分配律', 'A ∪ (B ∩ C) = (A ∪ B) ∩ (A ∪ C)');
  },
  async (tok, S) => { // 2194.3
    S.b.add('分配律：A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)', C.mint);
    cap('A ∩ (B ∪ C) 也一樣', '有分配律（老師沒寫出來）');
  },
]);

scene('sfB-l6-member', 'Lec06：membership table 證 De Morgan', [
  async (tok, S) => { // 2221.8 Venn 可說明
    const V = venn2(-4.4, 4.8, 1.2, 0.65); V.draw();
    note('簡單的：畫文氏圖就能說明', -4.4, 2.9);
    cap('這些要怎麼證明？', '簡單的話，畫個文氏圖就可以說明');
  },
  async (tok, S) => { // 2233.0 membership table
    hot('Membership Table：跟真值表一樣', 2.2, 6.7);
    note('要證：(A ∩ B)‾ = Ā ∪ B̄', 2.2, 6.15);
    cap('常用的工具：Membership Table', '跟真值表一樣');
  },
  async (tok, S) => { // 2260.7 列出 A、B
    S.T = table(['A', 'B', 'A∩B', '(A∩B)‾', 'Ā', 'B̄', 'Ā∪B̄'], -1.6, 5.4, 1.35, 0.78);
    cap('式子裡有 A、B 兩個集合', '先把 A、B 列下來');
  },
  async (tok, S) => { // 2278.8 在 A 裡或不在
    S.n1 = note('單看 A：元素只有「在 A 裡」、「不在 A 裡」兩種', 2.2, 1.0);
    cap('對一個元素來說', '只有屬於 A、不屬於 A 兩種');
  },
  async (tok, S) => { // 2321.3 四種組合
    const rows = [['T', 'T'], ['T', 'F'], ['F', 'T'], ['F', 'F']];
    for (let r = 0; r < 4; r++) { S.T.cell(r, 0, rows[r][0]); S.T.cell(r, 1, rows[r][1]); await wt(tok, 120); }
    remove(S.n1); S.n2 = sm('T：x 是這個集合的元素', 2.2, 1.0);
    cap('T 表示 x 是這個集合的元素', '配上 B，總共四種可能');
  },
  async (tok, S) => { // 2369.7 A ∩ B
    const v = ['T', 'F', 'F', 'F']; for (let r = 0; r < 4; r++) { S.T.cell(r, 2, v[r]); await wt(tok, 120); }
    cap('左式：先看 A ∩ B', '在 A 裡也在 B 裡，才會在交集裡');
  },
  async (tok, S) => { // 2400.0 (A∩B)‾
    const v = ['F', 'T', 'T', 'T']; S.L = []; for (let r = 0; r < 4; r++) { S.L.push(S.T.cell(r, 3, v[r])); await wt(tok, 120); }
    cap('A ∩ B 的補集', '在交集裡就不在補集；不在就在補集');
  },
  async (tok, S) => { // 2426.8 Ā
    const v = ['F', 'F', 'T', 'T']; for (let r = 0; r < 4; r++) { S.T.cell(r, 4, v[r]); await wt(tok, 120); }
    cap('右式：先看 Ā', '在 A 裡就不在 Ā；不在 A 反而在 Ā');
  },
  async (tok, S) => { // 2437.5 B̄
    const v = ['F', 'T', 'F', 'T']; for (let r = 0; r < 4; r++) { S.T.cell(r, 5, v[r]); await wt(tok, 120); }
    cap('同樣考慮 B̄', '在 B 裡就不在 B̄');
  },
  async (tok, S) => { // 2447.0 Ā ∪ B̄
    const v = ['F', 'T', 'T', 'T']; S.R = []; for (let r = 0; r < 4; r++) { S.R.push(S.T.cell(r, 6, v[r])); await wt(tok, 120); }
    cap('最後 Ā ∪ B̄', '因為是聯集：有一個有它就有');
  },
  async (tok, S) => { // 2464.7 一模一樣
    glowAll(S.L, OKG); glowAll(S.R, OKG); remove(S.n2); good('這兩欄一模一樣 → 兩個集合相等', 2.2, 1.0);
    cap('這一行跟這一行', '列舉的情況一模一樣 → 相等');
  },
  async (tok, S) => { // 2477.6 每列是一種情況
    note('第 2 列：x ∈ A 但 x ∉ B；第 3 列：x ∉ A 但 x ∈ B', 2.2, 0.4);
    cap('其實就是列舉法', '用表格寫下四類可能的狀況');
  },
]);

scene('sfB-l6-proof', 'Lec06：證明集合相等：互相包含、邏輯推導', [
  async (tok, S) => { // 2526.9
    S.b = board(-3.4, 6.6, 6.8, 0.72); S.b.add('方法①：用基本等式推演', C.sky);
    cap('比較複雜的等式', '可以利用集合的基本等式來推演');
  },
  async (tok, S) => { // 2543.7 互相包含
    S.b.add('方法②：證明兩個集合互相包含', C.lilac);
    cap('另外一個方法', '要證兩個集合相等…');
  },
  async (tok, S) => { // 2571.4
    S.m = card('(A∩B)‾ ⊆ Ā∪B̄　且　Ā∪B̄ ⊆ (A∩B)‾', C.peach, -3.4, 4.3, 6.8); glow(S.m, HL);
    cap('以 De Morgan 為例', '前面包含於後面，後面也包含於前面');
  },
  async (tok, S) => { // 2573.0 唯一情況是相等
    glow(S.m, null); good('互相包含 → 唯一的情況就是相等', -3.4, 3.6);
    cap('兩個集合互相包含', '唯一的情況就是兩個集合一樣');
  },
  async (tok, S) => { // 2597.5 用說的
    note('課本也可以「用說的」：其實還是列舉', -3.4, 3.0);
    cap('課本也說可以用講的', '其實還是列舉：x 在 A 裡、不在 A 裡…');
  },
  async (tok, S) => { // 2624.8 方法③ 邏輯述詞
    S.c = board(3.6, 6.6, 6.6, 0.68); S.c.add('方法③：換成邏輯述詞來推', C.gold);
    cap('另一種方法', '把它換成邏輯述詞來看');
  },
  async (tok, S) => { // 2637.0
    S.c.add('x ∈ (A ∩ B)‾', C.sky);
    cap('從補集的意思開始', '（宇集已知，就省略）');
  },
  async (tok, S) => { // 2683.1
    S.c.add('⇔ ¬( x ∈ A ∩ B )', C.sky);
    cap('x 不屬於 A ∩ B', '寫成 NOT（x 屬於 A ∩ B）');
  },
  async (tok, S) => { // 2694.3
    S.c.add('⇔ ¬( x ∈ A ∧ x ∈ B )', C.sky);
    cap('交集的定義', 'x 要屬於 A，而且 x 要屬於 B');
  },
  async (tok, S) => { // 2704.2
    S.c.add('⇔ ¬(x ∈ A) ∨ ¬(x ∈ B)（邏輯 De Morgan）', C.lilac);
    cap('NOT 拿進去', 'and 變成 or');
  },
  async (tok, S) => { // 2720.7
    S.c.add('⇔ x ∉ A ∨ x ∉ B', C.sky);
    cap('再推演一下', 'x 不屬於 A，或 x 不屬於 B');
  },
  async (tok, S) => { // 2735.6
    S.c.add('⇔ x ∈ Ā ∨ x ∈ B̄', C.sky);
    cap('另一個寫法', 'x 屬於 Ā，或 x 屬於 B̄');
  },
  async (tok, S) => { // 2750.8
    S.c.add('⇔ x ∈ Ā ∪ B̄（聯集的定義）', C.mint);
    cap('最後用聯集的定義', '就是 Ā ∪ B̄');
  },
  async (tok, S) => { // 2759.0 總結
    good('邏輯述詞推演／互相包含／membership table（小問題）', 0, 0.4);
    cap('總結：證明集合相等', '邏輯推演、互相包含、membership table');
  },
]);

scene('sfB-l6-func', 'Lec06：函數的定義：每個 a 恰好一支箭頭', [
  async (tok, S) => { // 2799.4
    hot('函式 function：複習定義', 0, 6.7);
    cap('所謂的函式', '從最基本的定義複習');
  },
  async (tok, S) => { // 2820.7 有方向
    S.D = fdiag(['a', 'b', 'c', 'd'], ['🍎', '🍊', '🍌'], -3, 3, 3.3, 0.9);
    note('有方向：from A to B（A 到 B 跟 B 到 A 不一樣）', 0, 0.6);
    cap('先有 A、B 兩個集合', '函式有方向：from A to B');
  },
  async (tok, S) => { // 2841.7 f: A → B
    S.n = card('f : A → B', C.lilac, 0, 6.1, 3.2); glow(S.n, HL);
    cap('符號寫成', 'f : A → B');
  },
  async (tok, S) => { // 2863.7 exactly one
    glow(S.n, null); S.l = [S.D.link(0, 0)]; glow(S.D.A[0], HL);
    S.bb = bub('每個 A 的元素對到 B 裡「恰好一個」', 0, 5.3);
    cap('每一個 A 裡面的元素', '要對應到 B 裡面 exactly one 一個');
  },
  async (tok, S) => { // 2892.1 所有 A 都要有
    S.l.push(S.D.link(1, 2), S.D.link(2, 1), S.D.link(3, 1)); glowAll(S.D.A, HL);
    cap('另一個條件', '所有的 A 都要有一條線出去');
  },
  async (tok, S) => { // 2927.3 f(a) = 🍎
    glowAll(S.D.A, null); glow(S.D.A[0], OKG); glow(S.D.B[0], OKG);
    S.fa = good('f(a) = 🍎（a 的函式值是蘋果）', 0, 0.0);
    cap('a 會對應到蘋果', '寫成 f(a) = 蘋果');
  },
  async (tok, S) => { // 2950.0 漏掉 → 不是
    gone(S.l); remove(S.fa); remove(S.bb); glowAll([...S.D.A, ...S.D.B], null);
    S.l = [S.D.link(0, 0), S.D.link(2, 1), S.D.link(3, 2)]; glow(S.D.A[1], NG);
    S.x1 = bad('b 被漏掉 → 不是函式', 0, 0.0);
    cap('這樣是不是函式？', '不是：有一個 b 被漏掉');
  },
  async (tok, S) => { // 2961.1 一對兩個
    S.l.push(S.D.link(1, 0), S.D.link(1, 2));
    remove(S.x1); bad('b 對到兩個 → 也不是函式', 0, 0.0);
    cap('每個都畫了，但 b 比較貪心', '對應到兩個東西，也不是函式');
  },
  async (tok, S) => { // 2985.4 判斷法
    good('判斷：A 的每個人都畫一條線出去，而且只有一條', 0, -0.6);
    cap('怎麼判斷是不是函式？', '每個都有線出去，而且只有一條');
  },
]);

scene('sfB-l6-terms', 'Lec06：domain、codomain、image、pre-image', [
  async (tok, S) => { // 3006.0
    S.D = fdiag(['a', 'a′', 'c'], ['b', 'e'], -3, 3, 3.3, 1.0);
    S.D.link(0, 0); S.D.link(1, 0); S.D.link(2, 1);
    S.k = card('f : A → B，f(a) = b', C.lilac, 0, 6.3, 4.6); glow(S.k, HL);
    cap('名詞介紹：f 從 A 對應到 B', 'a 對應到 b 寫成 f(a) = b');
  },
  async (tok, S) => { // 3018.7 domain
    glow(S.k, null); hot('A：domain 定義域', -3, 0.8);
    cap('A 稱為什麼？', 'domain，定義域');
  },
  async (tok, S) => { // 3031.2 codomain
    hot('B：codomain 對應域', 3, 0.8);
    cap('B 呢？', '英文叫 codomain，對應域');
  },
  async (tok, S) => { // 3036.8 image
    glow(S.D.A[0], HL); glow(S.D.B[0], HL); bub('b 是 a 的 image（值）', 0, 5.2);
    cap('b 是 a 在 f 下的什麼？', 'image，中文常翻作「值」');
  },
  async (tok, S) => { // 3053.8 pre-image
    bub('a 是 b 的 pre-image', 0, 4.6);
    cap('那 a 是 b 的什麼？', 'b 的一個 pre-image');
  },
  async (tok, S) => { // 3085.0 the image
    note('the image of a：a 的值只有一個 → 用 the', 0, 0.0);
    cap('英文要看得很細', 'b 是唯一的，所以寫 the image of a');
  },
  async (tok, S) => { // 3106.4 a pre-image of b
    glow(S.D.A[1], HL); note('b 可能被好幾個對到 → a pre-image of b（用 a）', 0, -0.6);
    cap('b 可能被好幾個人對應到', 'pre-image 可能不只一個，所以說 a pre-image');
  },
]);

scene('sfB-l6-floor', 'Lec06：下高斯 floor ⌊x⌋', [
  async (tok, S) => { // 3138.3
    S.b = board(-4.4, 6.6, 5.0, 0.7); S.b.add('floor 地板函式：⌊x⌋ 下高斯', C.gold);
    cap('下高斯，或者是地板函式', 'the floor function');
  },
  async (tok, S) => { // 3154.9 ⌊1.5⌋ = 1
    S.b.add('⌊1.5⌋ = 1', C.sky);
    cap('⌊1.5⌋ 是多少？', '不能比 1.5 大、但是最大的整數：1');
  },
  async (tok, S) => { // 3177.0 ⌊0⌋ = 0
    S.b.add('⌊0⌋ = 0（整數就是自己）', C.sky);
    cap('如果是 0 呢？', '剛好是整數，答案就是自己');
  },
  async (tok, S) => { // 3187.6 ⌊−1.5⌋ = −2
    S.b.add('⌊−1.5⌋ = −2（不是 −1！）', C.peach);
    cap('⌊−1.5⌋ 是 −1 還是 −2？', '−1 比 −1.5 大，所以是 −2');
  },
  async (tok, S) => { // 3211.3 R → R
    S.b.add('f : R → R，定義域 = 所有實數', C.lilac);
    S.G = axes(2.2, 3.2, 1.1, 1.0, -3, 3, -2.5, 2.5);
    cap('考慮 f 從 R 到 R', '定義域：所有實數');
  },
  async (tok, S) => { // 3237.8 值域 Z
    S.b.add('值域（range）= 所有整數 Z', C.mint);
    cap('值域呢？', '算出來只會是整數：所有整數');
  },
  async (tok, S) => { // 3241.8 −2 的 preimage 很多
    S.b.add('−1.5、−1.4、−1.3… 都是 −2 的 preimage', C.sky);
    cap('−2 是 −1.5 的 image', '−2 的 preimage 有好幾個');
  },
  async (tok, S) => { // 3275.8 臨界點
    const G = S.G;
    for (const v of [0, 1, 2]) { dotF(G.X(v), G.Y(v), C.blue); await wt(tok, 150); }
    cap('畫圖要小心臨界點', '0 對到 0、1 對到 1、2 對到 2');
  },
  async (tok, S) => { // 3287.2 1~2 之間都是 1
    const G = S.G; bar(G.X(1), G.X(2), G.Y(1), C.blue, 0.1);
    cap('比 1 大、比 2 小的', '值都是 1：一段水平線');
  },
  async (tok, S) => { // 3316.4 空心圈
    const G = S.G;
    for (const v of [-3, -2, -1, 0, 2]) { bar(G.X(v), G.X(v + 1), G.Y(v), C.blue, 0.1); if (v < 0) dotF(G.X(v), G.Y(v), C.blue); }
    for (const w of [-2, -1, 0, 1, 2, 3]) dotO(G.X(w), G.Y(w - 1));
    bub('左端實心、右端空心圈', 4.6, 6.2);
    cap('終點那邊會誤會', '用空心圈表示「不是這點」，要看上面');
  },
]);

scene('sfB-l6-ceil', 'Lec06：上高斯 ceiling ⌈x⌉', [
  async (tok, S) => { // 3346.3
    S.b = board(-4.4, 6.6, 5.0, 0.7); S.b.add('ceiling 天花板函式：⌈x⌉ 上高斯', C.gold);
    cap('另一個特殊的：ceiling function', '天花板：往上跳');
  },
  async (tok, S) => { // 3357.4 ⌈1.5⌉ = 2
    S.b.add('⌈1.5⌉ = 2', C.sky);
    cap('1.5 取多少？', '往上跳：2');
  },
  async (tok, S) => { // 3361.7 ⌈2⌉ = 2
    S.b.add('⌈2⌉ = 2（已經在天花板了）', C.sky);
    cap('如果是 2 呢？', '一樣取 2，已經在天花板了');
  },
  async (tok, S) => { // 3371.5 ⌈0⌉ = 0
    S.b.add('⌈0⌉ = 0', C.sky);
    cap('整數 0', '答案還是 0');
  },
  async (tok, S) => { // 3379.0 ⌈−1.5⌉ = −1
    S.b.add('⌈−1.5⌉ = −1', C.peach);
    cap('−1.5 呢？', '往上跳到 −1');
  },
  async (tok, S) => { // 3399.8 圖
    S.G = axes(2.2, 3.0, 1.1, 1.0, -3, 3, -2.5, 3.2); const G = S.G;
    dotF(G.X(0), G.Y(0), C.orange);
    for (const v of [0, 1, 2]) { bar(G.X(v), G.X(v + 1), G.Y(v + 1), C.orange, 0.1); dotF(G.X(v + 1), G.Y(v + 1), C.orange); dotO(G.X(v), G.Y(v + 1)); await wt(tok, 200); }
    bub('右端實心、空心圈在左邊', 4.6, 6.7);
    cap('整數的格子點畫實心', '比 0 大是 1、比 1 大是 2，空心圈在左邊');
  },
  async (tok, S) => { // 3420.2 負的那段
    const G = S.G;
    for (const v of [-3, -2, -1]) { bar(G.X(v), G.X(v + 1), G.Y(v + 1), C.orange, 0.1); dotF(G.X(v + 1), G.Y(v + 1), C.orange); dotO(G.X(v), G.Y(v + 1)); }
    cap('負的這邊一樣', '例如 −2 到 −1 之間都是 −1');
  },
]);

scene('sfB-l6-ineq', 'Lec06：高斯的不等式：x = n + ε', [
  async (tok, S) => { // 3438.9
    S.L = nline(-1, 3, 1.4, 2.2, -1.6);
    num('x', -1.6 + 1.6 * 2.2, 2.1, C.purple, 0.5); num('⌊x⌋', -1.6 + 1 * 2.2, 2.1, C.blue, 0.5);
    S.b = board(2.6, 6.6, 8.4, 0.75); S.b.add('⌊x⌋ 可能比 x 小一點點，但不會小超過 1', C.gold);
    cap('取下高斯可能會變小一點點', '但不會小超過 1');
  },
  async (tok, S) => { // 3450.0 一層樓
    S.st = buddy('', '', C.sky, -4.6, 3.4, 0, 0.6); S.st.mood('wow');
    note('從半空中掉下來，不會掉超過一層樓', -4.6, 5.1);
    await S.st.hop(tok);
    cap('就像在半空中掉下來', '不會掉超過一層樓');
  },
  async (tok, S) => { // 3459.3 x − 1 < ⌊x⌋ ≤ x
    S.b.add('x − 1 < ⌊x⌋ ≤ x', C.sky);
    cap('記得左邊沒有等號', '但 ⌊x⌋ 有可能等於 x 自己');
  },
  async (tok, S) => { // 3482.5 移項
    S.b.add('移項：⌊x⌋ ≤ x < ⌊x⌋ + 1', C.lilac);
    cap('把它移項', 'x 大於等於 ⌊x⌋、小於 ⌊x⌋ + 1');
  },
  async (tok, S) => { // 3486.1 上高斯
    S.b.add('上高斯：x ≤ ⌈x⌉ < x + 1', C.peach);
    cap('上高斯也一樣', '比自己大，但不會大超過 1');
  },
  async (tok, S) => { // 3551.6 x = n + ε
    S.b.add('更好用：x = n + ε，n ∈ Z，0 ≤ ε < 1', C.mint);
    bar(-1.6 + 1 * 2.2, -1.6 + 1.6 * 2.2, 1.4, C.green, 0.14); sm('n', -1.6 + 2.2, 0.55); sm('ε', -1.6 + 1.3 * 2.2, 2.0);
    cap('都以整數當分隔點', 'x = 整數 n + 小數 ε（0 ≤ ε < 1）');
  },
]);

scene('sfB-l6-2x', 'Lec06：證明 ⌊2x⌋ = ⌊x⌋ + ⌊x + ½⌋', [
  async (tok, S) => { // 3603.0
    hot('證明：⌊2x⌋ = ⌊x⌋ + ⌊x + ½⌋', 0, 6.7);
    cap('來看一個證明題', '⌊2x⌋ = ⌊x⌋ + ⌊x + 1/2⌋');
  },
  async (tok, S) => { // 3648.3 區間
    nline(0, 2, 5.4, 3.0, -6.0);
    note('高斯把數線切成一個一個區間（以整數分隔）', -3.0, 4.6);
    cap('以前的技巧用不上', '高斯符號把數線切成一個一個區間');
  },
  async (tok, S) => { // 3660.7 2ε
    bar(-6.0, -4.5, 5.4, C.blue, 0.16); bar(-4.5, -3.0, 5.4, C.orange, 0.16);
    sm('ε < 0.5：×2 還在 0～1', -5.4, 6.0); sm('ε ≥ 0.5：×2 超過 1', -2.4, 6.0);
    cap('裡面有一個 2x', '小於 0.5 乘 2 還在 1 裡；大於 0.5 會超過 1');
  },
  async (tok, S) => { // 3692.0 列舉法 x = n + ε
    S.s = card('列舉法：設 x = n + ε，n ∈ Z，0 ≤ ε < 1', C.gold, 3.6, 5.6, 6.6); glow(S.s, HL);
    cap('用列舉法', '假設 x = 整數 n + 小數 ε');
  },
  async (tok, S) => { // 3734.9 case 1
    glow(S.s, null); S.a = board(-3.4, 3.4, 6.8, 0.72); S.a.add('case 1：0 ≤ ε < ½', C.sky);
    cap('case 1', 'ε 在 0 到 0.5 之間');
  },
  async (tok, S) => { // 3760.0 左式
    S.a.add('左：⌊2n + 2ε⌋ = 2n（0 ≤ 2ε < 1）');
    cap('左式：2(n + ε) = 2n + 2ε', '2ε 在 0～1 之間，小數直接不要：2n');
  },
  async (tok, S) => { // 3810.2 右式
    S.a.add('右：⌊n + ε⌋ + ⌊n + ε + ½⌋ = n + n = 2n');
    cap('右式：x + 1/2 = n + ε + 1/2', 'ε + 1/2 還小於 1，所以是 n + n');
  },
  async (tok, S) => { // 3868.8 左 = 右
    S.a.add('左 = 右 ✓', C.mint);
    cap('左式等於右式', '這是 case 1');
  },
  async (tok, S) => { // 3879.5 case 2
    S.c = board(3.6, 3.4, 6.8, 0.72); S.c.add('case 2：½ ≤ ε < 1', C.peach);
    cap('列舉法不能漏掉其他情況', 'case 2：0.5 ≤ ε < 1');
  },
  async (tok, S) => { // 3889.1 左式 2n+1
    S.c.add('左：⌊2n + 2ε⌋ = 2n + 1（1 ≤ 2ε < 2）');
    cap('左式：2n + 2ε', '2ε 在 1～2 之間，拿走 1、留小數：2n + 1');
  },
  async (tok, S) => { // 3938.4 右式
    S.c.add('右：⌊n + ε⌋ + ⌊n + ε + ½⌋ = n + (n + 1)');
    cap('右式：前面還是 n', '後面加 1/2 會超過 1：n + 1');
  },
  async (tok, S) => { // 3956.0 都對
    S.c.add('= 2n + 1 = 左 ✓', C.mint);
    good('兩個 case 都對 → 證明結束', 0, 0.0);
    cap('所有情況分成兩個，兩個都對', '證明結束（要寫清楚 case 1、case 2）');
  },
]);

scene('sfB-l6-split', 'Lec06：技巧：高斯裡乘幾，就切幾段', [
  async (tok, S) => { // 3986.0
    hot('上下高斯的證明：大致不脫離這兩招', 0, 6.6);
    note('①直接套不等式　②不行就用列舉法切區間', 0, 6.0);
    cap('上下高斯的證明', '不等式直接用，不行就列舉法');
  },
  async (tok, S) => { // 4015.3
    S.c = card('先看高斯符號裡面的東西「乘多少」', C.gold, 0, 5.1, 7.0); glow(S.c, HL);
    cap('最主要先看', '高斯符號裡面這個東西乘多少');
  },
  async (tok, S) => { // 4020.9 乘 4
    glow(S.c, null); nline(0, 1, 3.6, 10, -5); const X = (v) => -5 + v * 10;
    [C.blue, C.green, C.orange, C.purple].forEach((c, i) => bar(X(i / 4) + 0.03, X((i + 1) / 4) - 0.03, 3.6, c, 0.18));
    ['0.25', '0.5', '0.75'].forEach((t, i) => sm(t, X((i + 1) / 4), 3.15)); hd('乘 4 → 切 4 段', -5.6, 4.3);
    cap('裡面乘 4', '切成 0～0.25、0.25～0.5、0.5～0.75、0.75～1');
  },
  async (tok, S) => { // 4031.4 乘 5
    const X = (v) => -5 + v * 10; nline(0, 1, 1.6, 10, -5);
    [C.blue, C.green, C.orange, C.purple, C.pink].forEach((c, i) => bar(X(i / 5) + 0.03, X((i + 1) / 5) - 0.03, 1.6, c, 0.18));
    ['0.2', '0.4', '0.6', '0.8'].forEach((t, i) => sm(t, X((i + 1) / 5), 1.15)); hd('乘 5 → 切 5 段', -5.6, 2.3);
    cap('乘 5 呢？', '切成五段：0～0.2、0.2～0.4…');
  },
]);

scene('sfB-l6-inj', 'Lec06：一對一、映成、對射的定義', [
  async (tok, S) => { // 4045.8
    hot('對射 = one-to-one and onto', 0, 6.7);
    cap('映成函式、對射', '對射就是 1 to 1 and onto');
  },
  async (tok, S) => { // 4065.4 f: A → B
    S.b = board(0, 6.0, 11.0, 0.72); S.b.add('f 是一個 A 到 B 的函式', C.gold);
    cap('正式寫定義', 'f 是一個 A 到 B 的函式');
  },
  async (tok, S) => { // 4072.7 one-to-one
    S.b.add('one-to-one（一對一）＝ injection 嵌射', C.sky);
    cap('f is called one-to-one', '又叫 injection');
  },
  async (tok, S) => { // 4099.4 ∀a∀b
    S.b.add('iff ∀a ∀b ( f(a) = f(b) → a = b )', C.sky);
    cap('a、b 不一樣，函式值就不一樣', '反過來寫：f(a) = f(b) 則 a = b');
  },
  async (tok, S) => { // 4145.3 onto
    S.b.add('onto（映成）＝ surjection 蓋射', C.peach);
    cap('f is called onto', '又叫 surjection，蓋射');
  },
  async (tok, S) => { // 4150.2 每個 B 都被對到
    S.b.add('B 裡的每個元素都要被對應到', C.peach);
    cap('蓋射', '每一個 B 裡的東西都要被對應到');
  },
  async (tok, S) => { // 4162.6 ∀b ∃a
    S.b.add('iff ∀b ∈ B ∃a ∈ A ( f(a) = b )', C.peach);
    cap('對所有 B 裡的 b', '都存在一個 a，使得 f(a) = b');
  },
  async (tok, S) => { // 4216.4 bijection
    S.b.add('one-to-one correspondence ＝ bijection 對射', C.mint);
    cap('形容詞：one-to-one correspondence', '名詞：bijection，對射');
  },
  async (tok, S) => { // 4233.0 both
    S.b.add('f 既是 one-to-one，又是 onto', C.mint);
    cap('意思是', 'f 同時是一對一，而且是映成');
  },
]);

scene('sfB-l6-hline', 'Lec06：判斷一對一：撞號與水平線', [
  async (tok, S) => { // 4262.4
    S.D = fdiag(['a', 'b', 'c', 'd'], ['1', '2', '3', '4', '5', '…', '100'], -5.0, -1.4, 3.3, 0.7);
    cap('A = {a, b, c, d}', 'B 裡有 1、2、3…到 100');
  },
  async (tok, S) => { // 4270.8 a→1, b→3, c→5
    S.D.link(0, 0); S.D.link(1, 2); S.D.link(2, 4);
    cap('a 對到 1，b 對到 3', 'c 對到 5');
  },
  async (tok, S) => { // 4277.6 d→3 撞
    S.D.link(3, 2, 0xb03030); glow(S.D.B[2], NG); glow(S.D.A[1], NG); glow(S.D.A[3], NG);
    bad('d 也對到 3 → 不是一對一', -3.2, 0.0);
    cap('d 如果不小心對到 3', '跟 b 的函式值一樣 → 不是一對一');
  },
  async (tok, S) => { // 4311.9 拋物線
    S.G = axes(3.9, 1.0, 0.9, 0.9, -2.5, 2.5, -0.2, 5.5);
    S.par = curve(S.G, (x) => x * x, -2.2, 2.2, '#d64545');
    line(S.G.X(-2.4), S.G.Y(1), S.G.X(2.4), S.G.Y(1), 0.06, '#4b9ee2'); S.d1 = dotF(S.G.X(-1), S.G.Y(1), C.red); S.d2 = dotF(S.G.X(1), S.G.Y(1), C.red);
    S.t1 = sm('y = x²：x = 1、−1 都對到 1 ✗', 3.9, 6.5);
    cap('看圖：拋物線', 'x = 1 跟 x = −1 都對到 1 → 不是一對一');
  },
  async (tok, S) => { // 4331.5 x³
    lab.world.remove(S.par); gone(S.d1, S.d2); remove(S.t1);
    S.cub = curve(S.G, (x) => x * x * x + 2.5, -1.4, 1.4, '#2fc092');
    S.t2 = sm('y = x³（示意，往上移畫）：水平線最多交一點 ✓', 3.9, 6.5);
    cap('像 x³ 一直往上跑', '畫水平線最多只交到一個點 → 一對一');
  },
  async (tok, S) => { // 4355.4 √x
    lab.world.remove(S.cub); remove(S.t2);
    curve(S.G, (x) => Math.sqrt(x) * 1.8, 0, 2.4, '#9b7ef4');
    sm('f(x) = √x：[0, ∞) → R（示意比例）', 3.9, 6.5);
    cap('開根號函式', '從正實數連集 0，對應到實數');
  },
  async (tok, S) => { // 4388.3 每條水平線最多一個交點
    good('水平線最多一個交點 → 一對一', 3.9, -0.2);
    note('負的那邊沒有交點沒關係：一對一只要求「最多一個」', 3.6, -0.75);
    cap('每條水平線最多一個交點', '每個值最多對應一個自變數 → 一對一');
  },
]);

// ════════ yR-nZxFS8Hk（易志偉 Lec07：一對一／映成、反函數、數列與加總、可數） ════════
// 小型箭頭圖（三種射一起比較用）
function mini(cx, as, bs, links, name, color) {
  const xa = cx - 1.1, xb = cx + 1.1, yc = 3.0, dy = 0.75;
  const yA = (i) => yc + ((as.length - 1) / 2 - i) * dy, yB = (i) => yc + ((bs.length - 1) / 2 - i) * dy;
  oval(xa, yc, 0.55, (as.length * dy) / 2 + 0.35); oval(xb, yc, 0.55, (bs.length * dy) / 2 + 0.35);
  const A = as.map((v, i) => num(v, xa, yA(i), C.blue, 0.42)), B = bs.map((v, i) => num(v, xb, yB(i), C.green, 0.42));
  const ls = links.map(([i, j]) => arr(xa + 0.28, yA(i), xb - 0.28, yB(j)));
  const t = card(name, color, cx, 5.5, 3.6); glow(t, HL);
  return { A, B, ls, t };
}

scene('sfB-l7-names', 'Lec07：injection、surjection、bijection 三個名詞', [
  async (tok, S) => { // 8.7
    hot('幾個英文名詞與中文', 0, 6.7);
    cap('如果沒聽過', '先介紹幾個英文名詞');
  },
  async (tok, S) => { // 10.2 injection
    S.i = mini(-4.6, ['a', 'b', 'c'], ['1', '2', '3', '4'], [[0, 0], [1, 1], [2, 3]], 'injection 嵌射', C.sky);
    cap('injection', '一般聽過的叫嵌射（單射）');
  },
  async (tok, S) => { // 37.2 每刀不同
    note('像剁東西：每一刀都落在不一樣的地方', -4.6, 0.9);
    cap('兩個不一樣的自變數', '第一刀、第二刀下去，答案絕對不一樣');
  },
  async (tok, S) => { // 49.1 surjection 蓋射
    glow(S.i.t, null); S.s = mini(0, ['a', 'b', 'c', 'd'], ['1', '2', '3'], [[0, 0], [1, 1], [2, 2], [3, 2]], 'surjection 蓋射', C.peach);
    note('像鍋蓋蓋下去', 0, 0.9);
    cap('surjection 叫蓋射', '就像一個鍋蓋蓋下去');
  },
  async (tok, S) => { // 62.6 全部被對到
    glowAll(S.s.B, OKG);
    note('對應域的元素全部都被用到', 0, 0.35);
    cap('所有對應域裡的元素', '都會被對應到、都會被用到');
  },
  async (tok, S) => { // 70.8 bijection
    glow(S.s.t, null); S.b = mini(4.6, ['a', 'b', 'c'], ['1', '2', '3'], [[0, 1], [1, 0], [2, 2]], 'bijection 對射', C.mint);
    note('bi = 二：一對一「且」映成', 4.6, 0.9);
    cap('bijection：bi 是二的意思', '對射，又稱一對一且映成函式');
  },
  async (tok, S) => { // 93.8 另一組說法
    glow(S.b.t, null);
    sm('one-to-one 一對一', -4.6, 6.25); sm('onto 映成', 0, 6.25); sm('one-to-one correspondence', 4.6, 6.25);
    cap('另一組說法', 'one-to-one、onto、one-to-one correspondence');
  },
]);

scene('sfB-l7-defs', 'Lec07：一對一與映成：圖和邏輯式', [
  async (tok, S) => { // 123.2
    S.D = fdiag(['a', 'b', 'c'], ['f(a)', 'f(b)', 'f(c)', '·'], -4.6, -1.0, 3.2, 0.95);
    S.b = board(3.6, 6.6, 6.6, 0.72); S.b.add('三種函式的區別，從圖上看', C.gold);
    cap('這三個函式最主要的區別', '用圖來看');
  },
  async (tok, S) => { // 149.7 a ≠ b → f(a) ≠ f(b)
    S.l = [S.D.link(0, 0), S.D.link(1, 1)]; glow(S.D.A[0], HL); glow(S.D.A[1], HL);
    S.b.add('一對一：a ≠ b → f(a) ≠ f(b)', C.sky);
    cap('如果 a 不等於 b', '對過去的 f(a) 一定不等於 f(b)');
  },
  async (tok, S) => { // 185.0 等價寫法
    S.b.add('等價（逆否）：f(a) = f(b) → a = b', C.sky);
    cap('不喜歡「不等於」的話', '顛倒寫：f(a) = f(b) 則 a = b');
  },
  async (tok, S) => { // 209.3 ∀a∀b
    S.b.add('∀a ∀b ( f(a) = f(b) → a = b ) 永遠為真', C.lilac);
    cap('對任何兩個自變數 a、b', '函式值相等，a、b 就一定相等');
  },
  async (tok, S) => { // 227.6 錯開
    glowAll(S.D.A, null); S.l.push(S.D.link(2, 2));
    bub('不同的自變數，對過去一定錯開', -2.8, 0.6);
    cap('畫圖來看', '不一樣的 a、b，對過去一定是錯開的');
  },
  async (tok, S) => { // 236.1 onto：B 很多元素
    gone(S.D.all); S.E = fdiag(['a₁', 'a₂', 'a₃', 'a₄'], ['b₁', 'b₂', 'b₃'], -4.6, -1.0, 3.2, 0.95);
    S.b.add('映成 onto：B 有很多元素…', C.peach);
    cap('onto 的意思', '假設 B 這邊有 100 個、200 個元素');
  },
  async (tok, S) => { // 247.7 每個都被對到
    S.E.link(0, 0); S.E.link(1, 1); S.E.link(2, 2); S.E.link(3, 2); glowAll(S.E.B, OKG);
    sm('b₃ 被兩個對到也沒關係', -1.0, 0.3);
    cap('每一個都會被對應到', '有的被兩個、三個對到都沒關係');
  },
  async (tok, S) => { // 266.6 ∀b ∃a
    S.b.add('∀b ∈ B ∃a ∈ A ( f(a) = b )', C.peach);
    cap('對後面任何一個元素 b', '往前一定找得到某個 a，使 f(a) = b');
  },
  async (tok, S) => { // 295.7 不一定唯一
    S.b.add('找到的 a 不一定唯一（2 個、3 個都行）');
    cap('那個 a 不一定唯一', '可能有兩個、三個都沒關係');
  },
  async (tok, S) => { // 323.2 bijection
    S.b.add('對射 bijection：兩個條件都要滿足', C.mint);
    cap('一對一且映成（對射）', '這兩個條件都要滿足');
  },
]);

scene('sfB-l7-sq', 'Lec07：y = x²：換定義域、對應域，答案不同', [
  async (tok, S) => { // 362.0
    S.b = board(-3.9, 6.6, 6.0, 0.7); S.b.add('判斷：一對一？映成？對射？', C.gold);
    cap('課本習題常叫你判斷', '再舉一個例子');
  },
  async (tok, S) => { // 377.4 y = x²
    S.G = axes(3.6, 2.6, 0.95, 0.75, -3, 3, -3, 4.8);
    S.par = curve(S.G, (x) => x * x, -2.15, 2.15, '#d64545');
    cap('最簡單的：y = x²', '高中都全部畫成一個拋物線');
  },
  async (tok, S) => { // 403.8 要講定義域、對應域
    S.b.add('先講清楚：定義域？對應域？');
    cap('現在講得比較細', '必須說清楚定義域、對應域在哪個範圍');
  },
  async (tok, S) => { // 417.6 R → R
    S.b.add('f : R → R', C.lilac);
    cap('什麼都不想：R 到 R', '它具有哪幾個特性？');
  },
  async (tok, S) => { // 437.2 y = 2 幾個 x
    S.h2 = line(S.G.X(-3), S.G.Y(2), S.G.X(3), S.G.Y(2), 0.06, '#4b9ee2'); sm('y = 2', S.G.X(3) + 0.1, S.G.Y(2) + 0.3);
    cap('一對一的意思：取 y = 2', '問有幾個自變數會對到 y = 2');
  },
  async (tok, S) => { // 457.0 ±√2
    S.p1 = dotF(S.G.X(-Math.SQRT2), S.G.Y(2), C.red); S.p2 = dotF(S.G.X(Math.SQRT2), S.G.Y(2), C.red);
    sm('−√2', S.G.X(-Math.SQRT2), S.G.Y(2) - 0.4); sm('√2', S.G.X(Math.SQRT2), S.G.Y(2) - 0.4);
    S.b.add('y = 2：x = √2、−√2 兩個 → 不是一對一 ✗', C.peach);
    cap('畫水平線', 'x = √2、x = −√2 兩個答案 → 不是一對一');
  },
  async (tok, S) => { // 478.6 x = ±√y
    S.b.add('解方程：x = ±√y，y ≠ 0 時永遠兩個');
    cap('也可以解方程式', 'x = ±√y：不是 0 的時候永遠有兩個答案');
  },
  async (tok, S) => { // 521.3 y = −2 無解
    line(S.G.X(-3), S.G.Y(-2), S.G.X(3), S.G.Y(-2), 0.06, '#9b7ef4'); sm('y = −2', S.G.X(3) + 0.1, S.G.Y(-2) + 0.3);
    S.b.add('y = −2：無解 → 不是映成 ✗', C.peach);
    cap('是不是蓋射？不是', 'y = −2 無解，沒有自變數對得到');
  },
  async (tok, S) => { // 555.7 對應域 R⁺ ∪ {0}
    S.neg = cube(null, C.gray, [6.0, 2.3, 0.05], S.G.X(0), S.G.Y(-1.5), -0.05);
    S.b.add('f : R → R⁺ ∪ {0}（不管負數）', C.mint);
    cap('動一點手腳', '對應域拿掉負數：R⁺ 連集 {0}');
  },
  async (tok, S) => { // 586.3 onto
    S.b.add('→ 每個 y ≥ 0 都有解：映成 ✓', C.mint);
    cap('這時它是蓋射 surjection', '無解的情況被取消，永遠都有解');
  },
  async (tok, S) => { // 605.0 R⁺ → R⁺
    lab.world.remove(S.par); S.half = curve(S.G, (x) => x * x, 0.05, 2.15, '#2fc092');
    S.b.add('f : R⁺ → R⁺（只看右半邊）→ 一對一 ✓', C.mint);
    cap('要一對一也 OK', '考慮 R⁺ 到 R⁺：只剩右半邊');
  },
  async (tok, S) => { // 629.7 bijection
    S.b.add('既一對一又映成 → bijection', C.gold);
    cap('它也是 onto、也是 one-to-one', '所以是一個 bijection');
  },
  async (tok, S) => { // 645.2 結論
    good('同一個式子，定義域、對應域不同 → 答案不同', 0, -0.4);
    cap('講函式要說清楚定義域、對應域', '同一個函式，A、B 取得不一樣，答案就不一樣');
  },
]);

scene('sfB-l7-inv1', 'Lec07：反函數的動機：G-sensor 與 cos θ', [
  async (tok, S) => { // 672.0
    hot('反函式 inverse：什麼時候會有？', 0, 6.7);
    cap('最後一個：反函式', '一個函式什麼時候有反函式？');
  },
  async (tok, S) => { // 694.4 G-sensor
    S.sen = prop('parcel', -4.6, 3.0, 0, 0.9, 'G-sensor');
    cap('先舉例：車子裡放一個 G-sensor', '可以量重力加速度的感測器，有 x、y、z 軸');
  },
  async (tok, S) => { // 712.1 上坡角度改變
    await anim(tok, 800, (u) => { S.sen.rotation.z = 0.35 * u; });
    note('上坡時感測器傾斜：重力大小一樣，向量方向變了', -4.6, 1.2);
    cap('車子上坡的時候', '重力一樣是 1g，但量到的向量方向不同');
  },
  async (tok, S) => { // 727.5 g1、g2
    S.o = V3(0.6, 2.4, 0.3); arrow(S.o, V3(2.8, 5.0, 0.3), 0x4b9ee2); arrow(S.o, V3(4.2, 3.4, 0.3), 0xdd8238);
    hd('g₁', 2.8, 5.35); hd('g₂', 4.5, 3.6);
    cap('第一次量到 g₁', '下一次量到 g₂，方向不一樣');
  },
  async (tok, S) => { // 739.8 θ
    const pts = []; for (let k = 0; k <= 16; k++) { const a = 0.27 + ((0.87 - 0.27) * k) / 16; pts.push(V3(0.6 + 1.1 * Math.cos(a), 2.4 + 1.1 * Math.sin(a), 0.3)); }
    lab.world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#6a4a00' }))); hot('θ', 2.0, 3.25);
    cap('常常要知道的', '是兩個向量的夾角 θ');
  },
  async (tok, S) => { // 744.4 內積
    S.b = board(3.4, 1.5, 7.4, -0.7); S.b.add('g₁ · g₂ = |g₁| |g₂| cos θ', C.lilac);
    cap('熟知的公式：內積', 'g₁ · g₂ = |g₁| 乘 |g₂| 乘 cos θ');
  },
  async (tok, S) => { // 769.6 cos θ 可算
    S.b.add('cos θ = (g₁ · g₂) / (|g₁| |g₂|) ← 算得出來', C.sky);
    cap('移一移', '就可以算出 cos θ 的值');
  },
  async (tok, S) => { // 782.2 要 θ
    S.b.add('但我要的是 θ，不是 cos θ！', C.peach);
    cap('問題是我想要的', '不是 cos θ，而是角度 θ');
  },
  async (tok, S) => { // 804.7 cos θ = 1/2
    fresh(CAM[0], CAM[1]);
    S.G = axes(0, 3.6, 0.9, 1.6, -6.5, 6.5, -1.2, 1.2, 100);
    S.cos = curve(S.G, (u) => Math.cos((u * Math.PI) / 2), -6.4, 6.4, '#4b9ee2'); sm('θ（每格 90°）', 5.4, 2.9);
    line(S.G.X(-6.5), S.G.Y(0.5), S.G.X(6.5), S.G.Y(0.5), 0.06, '#d64545'); sm('cos θ = 1/2', -5.6, S.G.Y(0.5) + 0.3);
    cap('假設算出 cos θ = 1/2', '當初的 θ 應該等於多少？');
  },
  async (tok, S) => { // 843.2 60°、−60°、很多
    const deg = [60, -60, 300, -300]; S.ds = [];
    for (const d of deg) { S.ds.push(dotF(S.G.X(d / 90), S.G.Y(0.5), C.red)); sm(d + '°', S.G.X(d / 90), S.G.Y(0.5) + 0.35); await wt(tok, 250); }
    cap('第一個答案 60°', '還有 −60°，甚至 300°、−300°…很多個');
  },
  async (tok, S) => { // 869.5 困擾
    bad('放 1/2 進去，回答一大堆角度 → 不是我們喜歡的', 0, 0.9);
    cap('好幾個 θ 都對到 1/2', '想當函式用，卻回答一大堆角度');
  },
]);

scene('sfB-l7-inv2', 'Lec07：限制成對射：cos 在 [0, π]', [
  async (tok, S) => { // 893.4
    S.G = axes(-3.0, 3.4, 0.9, 1.6, -4.2, 4.2, -1.2, 1.2, 100);
    S.cos = curve(S.G, (u) => Math.cos((u * Math.PI) / 2), -4.1, 4.1, '#9db7d0'); sm('θ（每格 90°）', -1.0, 1.25);
    S.b = board(4.0, 6.7, 6.0, 0.66); S.b.add('做一個比較嚴格的限定', C.gold);
    cap('要問人家當初的自變數', '函式也不是隨便問，要嚴格限定');
  },
  async (tok, S) => { // 911.3 對射
    S.b.add('希望 f 是一個對射', C.lilac);
    cap('剛剛定義的三個要用在這裡', '我們希望 f 是一個對射函式');
  },
  async (tok, S) => { // 921.2 長相
    cap('以 cos θ 來看', '它的長相大概是這個樣子');
  },
  async (tok, S) => { // 933.6 0 到 π
    sm('0', S.G.X(0), 2.9); sm('π（180°）', S.G.X(2), 2.9);
    cap('這裡是 0', '這裡是 π，也就是 180°');
  },
  async (tok, S) => { // 943.3 截一段
    S.b.add('允許動定義域、對應域：截一段當對射');
    cap('允許你動定義域、對應域', '在這裡截出一段對射函式');
  },
  async (tok, S) => { // 958.2 [0, π] → [−1, 1]
    S.seg = curve(S.G, (u) => Math.cos((u * Math.PI) / 2), 0, 2, '#d64545');
    S.b.add('標準：θ ∈ [0, π] → cos θ ∈ [−1, 1]', C.mint);
    cap('標準答案：從 0 截到 π', '函式值最大 1、最小 −1，再過去又重複了');
  },
  async (tok, S) => { // 987.4 60° 在框內
    line(S.G.X(-4.2), S.G.Y(0.5), S.G.X(4.2), S.G.Y(0.5), 0.06, '#c08a1f');
    dotF(S.G.X(60 / 90), S.G.Y(0.5), C.green); good('60° ✓', S.G.X(60 / 90), S.G.Y(0.5) + 0.45);
    dotF(S.G.X(-60 / 90), S.G.Y(0.5), C.gray); bad('−60° 不在框裡', S.G.X(-60 / 90) - 1.2, S.G.Y(0.5) + 0.45);
    cap('這時 60° 是我要的', '−60° 在另一邊，不在我畫的框框裡');
  },
  async (tok, S) => { // 1014.6 [−1, 1]
    S.b.add('cos θ 不會是 2、−2：只能放 [−1, 1]', C.sky);
    cap('cos θ 不會有 2、−2', '要反查的值，請放在 −1 到 1 之間');
  },
  async (tok, S) => { // 1039.7 前提
    S.b.add('前提：這個函式必須是對射', C.lilac);
    cap('要考慮反查的問題', '前提是函式必須是對射');
  },
  async (tok, S) => { // 1074.3 反查 = 反函式
    S.b.add('給 y，反查當初的 x：這個動作 = 反函式 f⁻¹', C.gold);
    cap('給我一個 y 值，反查 x', '把反查的動作當作函式：反函式');
  },
  async (tok, S) => { // 1080.9 一定有答案
    S.c = board(-3.0, 0.3, 8.4, -0.62); S.c.add('f⁻¹ 也是函式：①放進去一定要有答案', C.sky);
    cap('反函式還是一個函式', '第一：放進去一定要有答案');
  },
  async (tok, S) => { // 1090.4 不會兩個答案
    S.c.add('②絕對不會有兩個答案', C.sky);
    cap('第二', '放進去絕對不會有兩個答案');
  },
  async (tok, S) => { // 1102.1 onto 保證有答案
    glow(S.c.ls[0], OKG); sm('← onto 保證', 2.6, 0.3);
    cap('對射是 onto', '每個 y 至少有一個 x 對到它 → 保證有答案');
  },
  async (tok, S) => { // 1116.1 一對一保證唯一
    glow(S.c.ls[1], OKG); sm('← one-to-one 保證', 2.8, 0.92);
    cap('一對一保證', '找回去的答案只有一個');
  },
  async (tok, S) => { // 1131.5 bijection
    good('所以講反函式，一定要 bijection', 3.8, 0.0);
    cap('講反函式的前提', '一定要是 bijection');
  },
  async (tok, S) => { // 1149.5 y = cos x；放 0.5 → 60°
    hot('y = f(x) = cos x：f⁻¹(0.5) = 60°？', -3.0, 6.7);
    cap('反應不過來就寫原式', 'y = cos x，放 0.5 為什麼得 60°？');
  },
  async (tok, S) => { // 1181.3 顛倒過來
    note('因為 cos 60° = 1/2，整個顛倒：cos⁻¹(1/2) = 60°', -3.0, 6.15);
    cap('當初是 cos 60° = 1/2', '現在問 1/2 的自變數：cos⁻¹(1/2) = 60°');
  },
]);

scene('sfB-l7-id', 'Lec07：反函數與合成：恆等函數', [
  async (tok, S) => { // 1197.5
    hot('定理：反函式可以跟原函式合成', 0, 6.7);
    cap('簡單的定理', '反函式可以跟原來的函式做合成');
  },
  async (tok, S) => { // 1211.8 cos 60° = 1/2
    S.t = num('60°', -4.0, 3.6, C.blue, 0.9); S.h = num('1/2', 4.0, 3.6, C.green, 0.9);
    S.a1 = arr(-3.3, 4.1, 3.3, 4.1); hd('f = cos', 0, 4.55);
    cap('cos 60° 得到 1/2', '把這個叫做 f(θ)');
  },
  async (tok, S) => { // 1220.4 f⁻¹(1/2) = 60°
    S.a2 = arr(3.3, 3.1, -3.3, 3.1, 0xdd8238); hd('f⁻¹', 0, 2.65);
    cap('反函式放 1/2', '答案也是 60°');
  },
  async (tok, S) => { // 1232.4 f⁻¹(f(θ)) = θ
    S.b = board(0, 1.7, 9.0, 0.7); S.b.add('合成：放 θ 進去，最後的答案也是 θ', C.lilac);
    cap('合成函式：放一個 θ 進去', '最後的答案也是 θ');
  },
  async (tok, S) => { // 1244.0 identity
    S.b.add('identity function 恆等函式 ι：放 a 得 a', C.gold);
    cap('具有這個特性的叫恆等函式', 'identity：放 a 得 a，放 b 得 b');
  },
  async (tok, S) => { // 1283.4 θ = 60°：先算後面
    gone(S.b.ls); glow(S.t, HL); S.g1 = good('先算裡面：f(60°) = 1/2', 0, 1.7);
    cap('θ = 60°：合成要先算後面', 'f(60°) = 1/2');
  },
  async (tok, S) => { // 1297.3 再回來
    glow(S.t, null); glow(S.h, HL); S.g2 = good('再算 f⁻¹(1/2) = 60° → 回到原點', 0, 1.1);
    cap('剛才講了 1/2 對回去', '還是 60°');
  },
  async (tok, S) => { // 1312.6 證明 f(x) = y
    glow(S.h, null); remove(S.g1); remove(S.g2); S.c = board(0, 0.4, 9.0, -0.62); S.c.add('證明：已知 f(x) = y', C.sky);
    cap('證明其實只是說明', '原來的條件：放 x 得 y');
  },
  async (tok, S) => { // 1357.0 f⁻¹(f(x)) = x
    S.c.add('f⁻¹(f(x)) = f⁻¹(y) = x', C.mint);
    cap('先算裡面得到 y', '反函式問 y 就是問當初的自變數：x');
  },
  async (tok, S) => { // 1397.7 f(f⁻¹(y)) = y
    S.c.add('f(f⁻¹(y)) = f(x) = y', C.mint);
    cap('另一個：先放 y 給反函式', '得到 x，再用 f 查回來：y');
  },
  async (tok, S) => { // 1427.4 兩個不能寫成同一個
    bad('嚴格說：兩個恆等函式不能直接寫成相等', 0, 6.05);
    cap('這裡寫得不完全對', '這兩個函式其實不能等於');
  },
  async (tok, S) => { // 1506.0 吃的自變數不同
    note('f⁻¹∘f 吃 A 的元素（ι_A），f∘f⁻¹ 吃 B 的元素（ι_B）→ 拆開寫', 0, 5.45);
    cap('一個吃 A 的元素、一個吃 B 的', '自變數不一樣，要拆成兩個寫');
  },
]);

scene('sfB-l7-cube', 'Lec07：求反函數：f(x) = x³', [
  async (tok, S) => { // 1526.9
    S.b = board(-3.6, 6.6, 6.6, 0.74); S.b.add('課本常叫你算反函式', C.gold);
    cap('2-3 節到這裡告一段落', '課本常叫你算反函式，其實不難');
  },
  async (tok, S) => { // 1535.8 f(x) = x³
    S.b.add('例：f(x) = x³', C.sky);
    S.G = axes(3.6, 3.2, 1.1, 0.45, -2.2, 2.2, -6.5, 6.5, 100);
    S.c = curve(S.G, (x) => x * x * x, -1.75, 1.75, '#2fc092');
    cap('舉例', 'f(x) = x³');
  },
  async (tok, S) => { // 1546.6 一直往上跑
    S.b.add('三次方一直往上跑 → 對射，有反函式', C.mint);
    cap('三次方函式一直往上跑', '所以沒問題，有反函式');
  },
  async (tok, S) => { // 1553.7 求 f⁻¹(y)
    S.b.add('求 f⁻¹(y) = ?', C.lilac);
    cap('問你 f 的反函式怎麼寫', '就是要你放 y 進去');
  },
  async (tok, S) => { // 1573.1 y = x³
    S.b.add('寫 y = x³，把 x 化簡出來', C.sky);
    cap('什麼都不要想', '寫 y = x³，問 x 要等於多少 y');
  },
  async (tok, S) => { // 1591.6 x = y^{1/3}
    S.b.add('x = y^(1/3) = ∛y → f⁻¹(y) = ∛y', C.mint);
    dotF(S.G.X(1.5), S.G.Y(3.375), C.red); sm('示意：f(1.5) = 3.375 → f⁻¹(3.375) = 1.5', 2.8, -0.1);
    cap('x 就是 y 的 1/3 次方', '答案是 y 的立方根');
  },
]);

scene('sfB-l7-seq', 'Lec07：數列其實是一種函數', [
  async (tok, S) => { // 1620.4
    hot('數列 sequence', 0, 6.7);
    cap('接下來看數列', '先看它的基本定義');
  },
  async (tok, S) => { // 1636.5 以前：a1、a2、a3
    S.b = board(3.4, 6.0, 7.0, 0.72); S.b.add('以前：a₁ = …、a₂ = …、a₃ = …', C.sky);
    cap('以前講的數列', 'a₁ 等於多少、a₂ 等於多少…');
  },
  async (tok, S) => { // 1645.3 正式定義
    S.b.add('現在給一個比較正式的定義', C.gold);
    cap('現在給一個', '比較正式的定義');
  },
  async (tok, S) => { // 1648.3 數列是函式
    S.b.add('數列其實是一個函式！', C.lilac);
    cap('數列其實就是某一種函式', '只是自變數比較特別');
  },
  async (tok, S) => { // 1662.7 下標當自變數
    S.ix = [1, 2, 3, 4].map((v, i) => num(v, -5.6, 5.0 - i * 1.1, C.blue, 0.55)); hd('下標 n', -5.6, 5.9);
    cap('把下標 1、2、3 當作自變數', '數列的第 n 項就是函式值');
  },
  async (tok, S) => { // 1664.4 1, 1/2, 1/3
    S.vs = ['1', '1/2', '1/3', '1/4'].map((v, i) => { arr(-5.2, 5.0 - i * 1.1, -2.9, 5.0 - i * 1.1); return num(v, -2.4, 5.0 - i * 1.1, C.green, 0.55); });
    hd('aₙ = 1/n（示意）', -2.6, 5.9);
    cap('自變數 1 → 值 1，2 → 1/2', '3 → 1/3：只是換一個名詞來講');
  },
  async (tok, S) => { // 1687.0 下標
    S.b.add('下標通常從 1 或 0 開始，也有人用負的');
    cap('數列的下標通常是 1、2、3', '或從 0 開始，甚至 −1、−2 也可以');
  },
  async (tok, S) => { // 1704.4 定義
    S.b.add('定義：數列 = 從「整數的子集合」出發的函式', C.mint);
    cap('數列是一個函式', '自變數是整數的子集合（通常是 N 或 Z⁺）');
  },
  async (tok, S) => { // 1724.8 函式值 = 第幾項
    S.b.add('函式值 aₙ = 第 n 項', C.mint);
    cap('得到的函式值', '就是第幾項的意思');
  },
]);

scene('sfB-l7-sigma', 'Lec07：Σ 加總：Σₙ₌₂⁴ 3(2ⁿ + 1) = 93', [
  async (tok, S) => { // 1738.8
    hot('數列最在意的：把它加總', 0, 6.7);
    cap('數列比較在意的', '是第幾項到第幾項全部加在一起');
  },
  async (tok, S) => { // 1746.6 summation
    S.b = board(-3.4, 6.0, 6.6, 0.74); S.b.add('summation（以前叫級數）', C.gold);
    cap('這個名詞叫 summation', '以前叫級數');
  },
  async (tok, S) => { // 1761.7 第 j 項到第 k 項
    S.b.add('從第 j 項加到第 k 項');
    cap('常常在意的是', '從第 j 項加到第 k 項');
  },
  async (tok, S) => { // 1766.3 Σ
    S.b.add('Σᵢ₌ⱼᵏ aᵢ = aⱼ + aⱼ₊₁ + … + aₖ（j ≤ k）', C.lilac);
    cap('寫法：Σ（i = j 到 k）aᵢ', '習慣從小的項次寫到大的');
  },
  async (tok, S) => { // 1798.3 例
    S.e = card('例：Σₙ₌₂⁴ 3(2ⁿ + 1)', C.peach, 3.6, 6.0, 6.0); glow(S.e, HL);
    cap('舉一個例子', '3 乘 (2ⁿ + 1)，其實就是一個數列 aₙ');
  },
  async (tok, S) => { // 1823.8 依序代 2、3、4
    glow(S.e, null); note('n 依序代 2、3、4，三個答案加起來', 3.6, 5.3);
    cap('請你依序把 n 代進去', '2 代一次、3 代一次、4 代一次，再加起來');
  },
  async (tok, S) => { // 1845.8 n=2
    S.a = []; S.a.push(num('15', 1.6, 3.2, C.sky, 0.9)); sm('3(2²+1) = 3×5', 1.6, 2.3);
    cap('n = 2：a₂', '3 × (4 + 1) = 15');
  },
  async (tok, S) => { // 1858.0 n=3
    S.a.push(num('27', 3.8, 3.2, C.sky, 0.9)); sm('3(2³+1) = 3×9', 3.8, 1.75);
    cap('n = 3：a₃', '3 × (8 + 1) = 27');
  },
  async (tok, S) => { // 1862.8 n=4
    S.a.push(num('51', 6.0, 3.2, C.sky, 0.9)); sm('3(2⁴+1) = 3×17', 6.0, 2.3);
    cap('n = 4：a₄', '3 × (16 + 1) = 51');
  },
  async (tok, S) => { // 1871.1 93
    glowAll(S.a, OKG); good('15 + 27 + 51 = 93', 3.8, 0.9);
    cap('真的把它算開來', '15 + 27 + 51 = 93');
  },
]);

scene('sfB-l7-arith', 'Lec07：等差與等比級數', [
  async (tok, S) => { // 1894.3
    S.b = board(3.4, 6.6, 7.0, 0.66); S.b.add('等差 = 算術（arithmetic）；等比 = 幾何（geometric）', C.gold);
    cap('以前的級數有等差跟等比', '等差是算術，等比是幾何');
  },
  async (tok, S) => { // 1910.1 a, a+d, a+2d
    S.b.add('等差：a, a + d, a + 2d, …', C.sky);
    cap('等差數列', '第一項 a，第二項 a + d，第三項 a + 2d');
  },
  async (tok, S) => { // 1919.1 首項、公差
    S.b.add('a：首項；d：公差（相鄰兩項都差 d）', C.sky);
    cap('a 稱為首項', 'd 稱為公差，兩項之間都差 d');
  },
  async (tok, S) => { // 1925.2 cₙ = 5 + 6n
    S.b.add('例：cₙ = 5 + 6n', C.mint);
    cap('舉例', 'cₙ = 5 + 6n');
  },
  async (tok, S) => { // 1936.5 5, 11, 17
    S.cols = []; [5, 11, 17, 23].forEach((v, i) => { S.cols.push(cube(String(v), i < 3 ? C.blue : C.gray, [0.9, v * 0.2, 0.6], -5.8 + i * 1.0, 0.4 + v * 0.1, 0, 1.0)); });
    sm('c₀ c₁ c₂ c₃', -4.3, -0.05); sm('+6　+6　+6', -4.3, 5.6);
    cap('c₀ = 5、c₁ = 11、c₂ = 17', '中間都差 6');
  },
  async (tok, S) => { // 1959.5 疊起來像梯形
    tint(S.cols[3], C.blue); S.tz = [line(-6.25, 0.4, -6.25, 1.4), line(-6.25, 1.4, -2.35, 5.0), line(-2.35, 5.0, -2.35, 0.4), line(-2.35, 0.4, -6.25, 0.4)];
    S.b.add('和 Σᵢ₌₀ⁿ (a + id)：疊起來像梯形', C.lilac);
    cap('從第 0 項加上去', '把等差數列疊起來，是一個梯形的樣子');
  },
  async (tok, S) => { // 1972.1 梯形面積
    S.b.add('梯形面積 = (上底 + 下底) × 高 ÷ 2');
    cap('梯形面積是多少？', '上底加下底，乘高，除以 2');
  },
  async (tok, S) => { // 1974.4 上底 a，下底 a + nd
    sm('a', -5.8, 1.4); sm('a + nd', -2.8, 5.35);
    cap('上底是第一項 a（i = 0）', '下底是最後一項 a + nd（i = n）');
  },
  async (tok, S) => { // 1991.3 高 n+1
    S.b.add('高 = n + 1（i = 0 到 n 共 n + 1 項）→ (n + 1)(2a + nd) / 2', C.mint, 7.0);
    cap('高為什麼是 n + 1？', 'i 從 0 到 n，總共 n + 1 項');
  },
  async (tok, S) => { // 2000.3 等比
    S.c = board(3.4, 1.9, 7.0, 0.66); S.c.add('等比：a, ar, ar², …', C.peach);
    cap('等比級數', '首項 a，每一項之間差 r 倍');
  },
  async (tok, S) => { // 2010.5 利息
    S.c.add('常用來算利息（複利）', C.peach);
    cap('一般拿來算利息', '計算複利的時候會用到');
  },
  async (tok, S) => { // 2030.2 公比
    S.c.add('a：首項；r：公比 = 後項 ÷ 前項', C.peach);
    cap('a 稱為首項', 'r 稱為公比：後項除以前項');
  },
  async (tok, S) => { // 2055.2 公式證法
    S.c.add('Sₙ − r·Sₙ 上下相減 → Σⱼ₌₀ⁿ arʲ = a(rⁿ⁺¹ − 1)/(r − 1)，r ≠ 1', C.mint, 7.0);
    cap('等比級數公式的標準證法', '列出 Sₙ，乘公比，上下兩式相減整理');
  },
]);

scene('sfB-l7-guess', 'Lec07：1, 2, 3 後面一定是 4 嗎？', [
  async (tok, S) => { // 2074.6
    hot('大學生該知道的事：小學智力測驗其實是錯的', 0, 6.7);
    cap('大學生該知道的事', '小學的智力測驗其實都是錯的');
  },
  async (tok, S) => { // 2082.2 1,2,3,?
    S.r = [1, 2, 3].map((v, i) => num(v, -5.6 + i * 1.2, 5.3, C.blue, 0.7)); S.q = num('?', -2.0, 5.3, C.gold, 0.7);
    cap('a₁ = 1、a₂ = 2、a₃ = 3', '請問 a₄ 一定等於 4 嗎？');
  },
  async (tok, S) => { // 2101.2 不知道
    glow(S.q, NG); bad('寫 4 是錯的；標準答案：不知道', -3.0, 4.4);
    cap('你當初寫 4 其實是錯的', '標準答案是：不知道');
  },
  async (tok, S) => { // 2109.8 −1,1,−1,1,?
    S.r2 = ['−1', '1', '−1', '1'].map((v, i) => num(v, -5.6 + i * 1.2, 3.2, C.purple, 0.7)); S.q2 = num('?', -0.8, 3.2, C.gold, 0.7);
    cap('−1、1、−1，再多給一項 1', '猜 a₅ 是 −1？答案還是不對');
  },
  async (tok, S) => { // 2124.3 千百種
    glow(S.q2, NG); note('可能性有千百種', -3.0, 2.3);
    cap('因為可能性有千百種', '不會只有你猜的那一種');
  },
  async (tok, S) => { // 2132.6 多項式條件數
    S.b = board(3.6, 6.0, 6.6, 0.72); S.b.add('決定 5 次多項式：6 個係數 → 要 6 個條件', C.sky);
    S.b.add('決定 2 次多項式：3 個係數 → 3 個條件', C.sky);
    cap('舉例：決定一個五次多項式', '要六個條件；二次多項式三個就夠');
  },
  async (tok, S) => { // 2155.8 數列當多項式
    S.b.add('把數列想成多項式 p(n)：只給了 3 個條件', C.lilac);
    cap('假設這個數列是多項式', '你只跟我講 1、2、3 三個條件');
  },
  async (tok, S) => { // 2187.3 限定 2 次
    S.b.add('限定是 2 次 → 解得出唯一一個', C.mint);
    cap('如果限定是二次多項式', '三個條件可以解出唯一的答案');
  },
  async (tok, S) => { // 2199.1 3、4、5 次
    S.b.add('3、4、5 次 → 條件不夠，答案很多個', C.peach);
    S.ex = card('示意：aₙ = n + (n−1)(n−2)(n−3) → 1, 2, 3, 10', C.peach, -3.0, 0.8, 7.2); glow(S.ex, HL);
    cap('如果是三次、四次、五次呢？', '只給三個條件，算不出唯一的答案');
  },
  async (tok, S) => { // 2234.1 四個條件也一樣
    glow(S.ex, null); S.b.add('給 4 個條件也一樣：沒說幾次就沒有唯一答案');
    cap('給四個條件也一樣', '他沒說是幾次多項式，就算不出唯一答案');
  },
]);

scene('sfB-l7-setsum', 'Lec07：無窮級數、在集合上加總', [
  async (tok, S) => { // 2272.1
    S.b = board(-3.2, 6.6, 7.6, 0.72); S.b.add('無窮級數：Σᵢ₌₁^∞ aᵢ', C.gold);
    cap('一個名詞：無窮級數', '加很多很多項，上面寫無窮大');
  },
  async (tok, S) => { // 2282.0 下標一直變大
    S.b.add('下標一直變：10、100、1000、…');
    cap('下標可以一直變', '十、一百、一千，一直下去');
  },
  async (tok, S) => { // 2292.1 越來越小
    S.b.add('要能算出和：項必須越來越小');
    cap('真的能算出和的話', '這個數列本身應該越來越小');
  },
  async (tok, S) => { // 2308.3 用集合指定下標
    S.b.add('也可以用「集合」指定要加哪些：Σ over x ∈ X ', C.lilac);
    cap('有時候不指定第幾項', '而是用集合，從集合裡挑數字');
  },
  async (tok, S) => { // 2323.4 X = {1,2,5,7}
    S.X = blob('X = {1, 2, 5, 7}', [1, 2, 5, 7], 3.6, 5.1, 2.4, 0.8, C.blue, 4);
    S.e = card('Σ over x ∈ X (x² + 1)', C.peach, 3.6, 3.4, 4.6); glow(S.e, HL);
    cap('例：X = {1, 2, 5, 7}', '加總 x² + 1，x 從 X 裡挑');
  },
  async (tok, S) => { // 2351.0 2 + 5 + 26 + 50 = 83
    glow(S.e, null); const v = [[1, 2], [2, 5], [5, 26], [7, 50]];
    for (const [i, [x, y]] of v.entries()) { glow(S.X.cubes[i], HL); num(y, 1.8 + i * 1.2, 2.3, C.green, 0.6); sm(x + '²+1', 1.8 + i * 1.2, 1.7); await wt(tok, 200); glow(S.X.cubes[i], null); }
    good('2 + 5 + 26 + 50 = 83', 3.6, 1.0);
    cap('挑 1、2、5、7 代進去', '1² + 1、2² + 1、5² + 1、7² + 1，加起來');
  },
  async (tok, S) => { // 2377.8 邏輯述詞
    S.b.add('另一種：Σ over P(x)，P(x) 為真的 x 才代進去', C.lilac);
    cap('集合常用的另一個變形', '用邏輯述詞：滿足 P(x) 的 x 才拿來加');
  },
  async (tok, S) => { // 2415.3 過濾
    note('Σ 下面的條件只是一個「過濾器」', -3.2, 2.2);
    cap('放在下面只是一個過濾', '決定哪些變數讓你代進去算');
  },
]);

scene('sfB-l7-sumex', 'Lec07：加總例子：Σ 2⁻ⁱ = 2、質數的平方和', [
  async (tok, S) => { // 2442.4
    S.e = card('Σᵢ₌₀^∞ 2⁻ⁱ = 1 + 1/2 + 1/4 + …', C.sky, -2.6, 6.2, 7.4); glow(S.e, HL);
    S.sc = 4.6; S.x0 = -6.4; S.acc = 0; S.segs = [];
    cap('2 的 −i 次方', 'i = 0 是 2⁰，i = 1 是 2⁻¹，i = 2 是 2⁻²…');
  },
  async (tok, S) => { // 2457.6 公比 1/2
    const cs = [C.blue, C.green, C.orange, C.purple, C.pink, C.teal];
    for (let i = 0; i < 6; i++) { const w = Math.pow(2, -i); S.segs.push(bar(S.x0 + S.acc * S.sc + 0.02, S.x0 + (S.acc + w) * S.sc - 0.02, 4.6, cs[i], 0.5)); S.acc += w; await wt(tok, 200); }
    sm('1', S.x0 + 0.5 * S.sc, 4.0); sm('1/2', S.x0 + 1.25 * S.sc, 4.0);
    cap('其實也是等比級數', '公比是 1/2，寫成指數就是 −1 次方');
  },
  async (tok, S) => { // 2463.8 = 2
    line(S.x0 + 2 * S.sc, 3.9, S.x0 + 2 * S.sc, 5.3, 0, '#d64545'); hot('2', S.x0 + 2 * S.sc, 5.6);
    good('1 / (1 − 1/2) = 2', -2.6, 3.2);
    cap('越加越靠近 2', '答案加起來是 2');
  },
  async (tok, S) => { // 2468.8 質數條件
    glow(S.e, null); S.f = card('Σ（x 是質數，x < 10）x²', C.peach, -2.6, 2.0, 6.0); glow(S.f, HL);
    cap('另一種形式', '要加總的 x 必須是質數，而且小於 10');
  },
  async (tok, S) => { // 2481.9 2,3,5,7
    S.p = [2, 3, 5, 7].map((v, i) => num(v, -5.0 + i * 1.6, 1.0, C.blue, 0.6));
    cap('滿足條件的有哪些？', '2、3、5、7，沒了');
  },
  async (tok, S) => { // 2490.0 4+9+25+49 = 87
    glow(S.f, null); [4, 9, 25, 49].forEach((v, i) => num(v, -5.0 + i * 1.6, 0.1, C.green, 0.6));
    good('4 + 9 + 25 + 49 = 87', 3.2, 0.5);
    cap('代進去：2²、3²、5²、7²', '加起來 4 + 9 + 25 + 49 = 87');
  },
]);

scene('sfB-l7-rules', 'Lec07：Σ 的運算：提常數、拆開、平移下標', [
  async (tok, S) => { // 2504.9
    S.b = board(-3.4, 6.7, 6.6, 0.62); S.b.add('處理加總符號的加減乘除', C.gold);
    cap('以後會常處理', '加總符號的加減乘除');
  },
  async (tok, S) => { // 2519.4 Σ 2n
    S.b.add('Σₙ₌₁¹⁰ 2n = ?', C.sky);
    cap('假設要算', 'Σ（n = 1 到 10）2n');
  },
  async (tok, S) => { // 2536.6 展開
    S.b.add('= 2·1 + 2·2 + 2·3 + … + 2·10');
    cap('不信邪就寫下來', '2 × 1 + 2 × 2 + 2 × 3 … + 2 × 10');
  },
  async (tok, S) => { // 2548.0 提公因式
    S.b.add('= 2 (1 + 2 + 3 + … + 10)');
    cap('大家都乘 2', '可以提出公因式');
  },
  async (tok, S) => { // 2567.1 常數拿到外面
    S.b.add('= 2 Σₙ₌₁¹⁰ n = 2 × 55 = 110', C.mint);
    cap('常數跟 n 沒關係', '放心拿到外面：2 × 55 = 110');
  },
  async (tok, S) => { // 2595.2 兩個數列
    S.c = board(3.6, 6.7, 6.6, 0.62); S.c.add('aₙ = 2n，bₙ = 2ⁿ', C.peach);
    cap('第二件事：兩個數列', 'aₙ = 2n，bₙ = 2ⁿ');
  },
  async (tok, S) => { // 2614.7 Σ(2n + 2ⁿ)
    S.c.add('Σₙ₌₁¹⁰ (2n + 2ⁿ) = ?', C.peach);
    cap('Σ（2n + 2ⁿ）', '這個公式背過嗎？沒有');
  },
  async (tok, S) => { // 2638.1 展開
    S.c.add('= (2·1+2¹) + (2·2+2²) + … + (2·10+2¹⁰)');
    cap('展開來看', '2·1 + 2¹ + 2·2 + 2² + … 一直到 2·10 + 2¹⁰');
  },
  async (tok, S) => { // 2659.7 分兩堆
    S.c.add('結合律 + 交換律：乘 2 的一堆、次方的一堆');
    cap('用結合律跟交換律', '乘 2 的擺一堆，2 的次方擺一堆');
  },
  async (tok, S) => { // 2684.6 拆開
    S.c.add('= Σ 2n + Σ 2ⁿ', C.lilac);
    cap('前面那一堆是 Σ 2n', '後面那一堆是 Σ 2ⁿ：可以分開算');
  },
  async (tok, S) => { // 2715.9 等差 + 等比
    S.c.add('= 110 + (2¹¹ − 2) = 110 + 2046 = 2156', C.mint);
    cap('一個等差、一個等比', '都有公式：110 + 2046 = 2156');
  },
  async (tok, S) => { // 2731.0 減號也行
    note('加號換成減號也 OK', 3.6, 1.5);
    cap('拆項', '加號換成減號也沒問題');
  },
  async (tok, S) => { // 2743.7 平移下標
    gone(S.b.ls, S.c.ls); S.d = board(0, 4.4, 10.0, 0.72); S.d.add('平移下標：內容不變，看起來不一樣', C.gold);
    cap('有時候可以動一下下標', '把公式稍微做一個變換');
  },
  async (tok, S) => { // 2768.0 a1 + … + a10
    S.d.add('Σₙ₌₁¹⁰ aₙ = a₁ + a₂ + … + a₁₀', C.sky);
    cap('Σ（n = 1 到 10）aₙ', '就是 a₁ + a₂ + … + a₁₀');
  },
  async (tok, S) => { // 2786.7 +2 −2
    S.d.add('1 = 3 − 2、2 = 4 − 2、…、10 = 12 − 2', C.sky);
    cap('動一下手腳：每個下標 +2 −2', '1 寫成 3 − 2，10 寫成 12 − 2');
  },
  async (tok, S) => { // 2825.2 Σ_{i=3}^{12} a_{i−2}
    S.d.add('= Σᵢ₌₃¹² aᵢ₋₂', C.mint);
    cap('可以寫成', 'Σ（i = 3 到 12）a 的 i − 2：做一個平移');
  },
]);

scene('sfB-l7-split', 'Lec07：切兩段、倒過來加、兩兩一組', [
  async (tok, S) => { // 2881.7
    S.n = [...Array(10)].map((_, i) => num(i + 1, -5.85 + i * 1.3, 5.6, C.sky, 0.6));
    cap('一大串可能答案太大', '可以先算前一半，再算後一半');
  },
  async (tok, S) => { // 2893.7 公式
    S.b = board(0, 4.4, 10.0, 0.72); S.b.add('Σᵢᵏ = Σᵢʲ + Σⱼ₊₁ᵏ（中間找一個 j 切兩段）', C.lilac);
    cap('從中間找一個 j', '前面算到第 j 項，後面從 j + 1 到 k');
  },
  async (tok, S) => { // 2902.5 例
    for (let i = 0; i < 5; i++) tint(S.n[i], C.blue); for (let i = 5; i < 10; i++) tint(S.n[i], C.orange);
    S.b.add('1 + … + 10 = (1 + … + 5) + (6 + … + 10) = 15 + 40 = 55', C.mint);
    cap('例：1 加到 10', '前五項 15，加上後五項 40（結合律）');
  },
  async (tok, S) => { // 2940.0 倒序
    gone(S.n); S.b.add('倒過來加：Σₙ₌₀ᵏ f(k − n)', C.peach);
    cap('另一個式子', 'Σ（n = 0 到 k）f(k − n)');
  },
  async (tok, S) => { // 2941.7 前：f0…fk
    S.f = [...Array(5)].map((_, i) => num('f' + i, -4.8 + i * 1.6, 6.2, C.blue, 0.6));
    cap('原來的 Σ f(n)', '是 f₀、f₁、f₂ 一直到 fₖ');
  },
  async (tok, S) => { // 2951.6 後：fk…f0
    S.g = [...Array(5)].map((_, i) => num('f' + (4 - i), -4.8 + i * 1.6, 5.35, C.orange, 0.6));
    cap('n = 0 代進去是 fₖ', 'n = 1 是 fₖ₋₁…n = k 是 f₀');
  },
  async (tok, S) => { // 2977.6 反序加法
    S.b.add('從 f₀ 加到 fₖ ＝ 從 fₖ 加到 f₀（反序加法，內容一樣）', C.mint);
    cap('這是反序加法', '顛倒過來，實質上是同一件事');
  },
  async (tok, S) => { // 2999.8 兩兩相加
    gone(S.f, S.g); S.b.add('兩兩一組：Σₙ₌₀²ᵏ⁺¹ fₙ = Σₙ₌₀ᵏ (f₂ₙ + f₂ₙ₊₁)', C.peach);
    cap('小學算數就這樣', '把兩項兩項相加');
  },
  async (tok, S) => { // 3004.1 f0+f1, f2+f3
    S.pr = []; for (let i = 0; i < 4; i++) { S.pr.push(card('f' + 2 * i + ' + f' + (2 * i + 1), C.lilac, -4.8 + i * 3.2, 5.6, 2.6)); await wt(tok, 150); }
    cap('n = 0 是 f₀ + f₁', 'n = 1 是 f₂ + f₃，一路到最後');
  },
  async (tok, S) => { // 3025.6 項次沒變
    good('項次都沒變，只是排列組合', 0, 0.2);
    cap('這邊的項跟那邊的項一樣', '都沒有變，只是排列組合');
  },
]);

scene('sfB-l7-double', 'Lec07：雙重加總：雙層迴圈 = 18', [
  async (tok, S) => { // 3042.9
    hot('進階練習：雙重加總 = 雙層迴圈', 0, 6.7);
    cap('進階練習', '有時候會看到這種迴圈');
  },
  async (tok, S) => { // 3045.0 code
    S.k = code(['for i = 1 to 2', '  for j = 1 to 3', '    s += i * j'], -4.4, 5.6, 0.55);
    S.e = card('Σᵢ₌₁² Σⱼ₌₁³ i·j', C.lilac, 3.6, 5.4, 4.0);
    cap('for i = 1 到 2，for j = 1 到 3', 's 加等於 i 乘 j');
  },
  async (tok, S) => { // 3071.8 先固定 i = 1
    S.k.hl(0); hot('i = 1', -6.2, 3.4);
    cap('答案是多少？', '跟迴圈一樣：先固定 i = 1，算裡面');
  },
  async (tok, S) => { // 3108.4 i=1 的三項
    S.k.hl(2); S.r1 = [1, 2, 3].map((j, k) => num('1×' + j, -4.6 + k * 1.6, 3.4, C.sky, 0.6));
    cap('i = 1：j 換 1、2、3', '1×1 + 1×2 + 1×3');
  },
  async (tok, S) => { // 3121.6 i=2
    hot('i = 2', -6.2, 2.3); S.r2 = [1, 2, 3].map((j, k) => num('2×' + j, -4.6 + k * 1.6, 2.3, C.peach, 0.6));
    cap('接著 i 變成 2', 'j 又從 1 開始變：2×1 + 2×2 + 2×3');
  },
  async (tok, S) => { // 3141.1 另一寫法
    S.k.hl(-1); S.b = board(3.6, 4.4, 6.6, 0.72); S.b.add('也有人寫 Σ over 1≤i≤2, 1≤j≤3 i·j', C.sky);
    cap('有人甚至這樣寫', 'i、j 在範圍裡所有的組合都代進去');
  },
  async (tok, S) => { // 3182.6 分群提出 i
    S.b.add('分群：1·(1 + 2 + 3) + 2·(1 + 2 + 3)');
    cap('用分群的想法', 'i = 1 那群提出 1，i = 2 那群提出 2');
  },
  async (tok, S) => { // 3218.1 Σ_i (i Σ_j j)
    S.b.add('= Σᵢ₌₁² ( i · Σⱼ₌₁³ j )', C.lilac);
    cap('再提出公因式', '可以寫成 Σᵢ（i 乘 Σⱼ j）');
  },
  async (tok, S) => { // 3264.6 1+2+3 = 6
    S.b.add('先做裡面 j 的加總：1 + 2 + 3 = 6 → Σᵢ 6i', C.sky);
    cap('先做裡面 j 的加總', '1 + 2 + 3 = 6，變成 6i');
  },
  async (tok, S) => { // 3274.1 18
    S.b.add('= 6 (1 + 2) = 18', C.mint); glowAll([...S.r1, ...S.r2], OKG);
    good('1+2+3 + 2+4+6 = 18 ✓', -3.0, 1.1);
    cap('6 提出來，算完', '6 × (1 + 2) = 18');
  },
]);

scene('sfB-l7-formula', 'Lec07：常用加總公式與微分技巧', [
  async (tok, S) => { // 3359.2
    S.b = board(-3.4, 6.7, 6.8, 0.66);
    S.b.add('Σₖ₌₁ⁿ k = n(n + 1)/2', C.sky); S.b.add('Σₖ₌₁ⁿ k² = n(n + 1)(2n + 1)/6', C.sky); S.b.add('Σₖ₌₁ⁿ k³ = n²(n + 1)²/4', C.sky);
    cap('幾個常用的公式', '這個會、這個也會；三次方的看你高興背');
  },
  async (tok, S) => { // 3386.6 Σ xᵏ
    S.b.add('Σₖ₌₀^∞ xᵏ = 1/(1 − x)，|x| < 1（等比）', C.mint);
    cap('xᵏ 加總會不會？', '等比級數，會算');
  },
  async (tok, S) => { // 3399.7 Σ k x^{k−1}
    S.b.add('Σₖ₌₁^∞ k xᵏ⁻¹ = 1/(1 − x)² ← 有人會嗎？', C.peach);
    cap('問題是這個', '看起來很複雜，其實跟上面有關係');
  },
  async (tok, S) => { // 3410.6 微分
    S.k = hot('關係：把上面的式子對 x 微分', 3.6, 6.7);
    cap('關係在哪裡？', '把上面的式子對 x 微分');
  },
  async (tok, S) => { // 3437.2 首項/(1−公比)
    S.c = board(3.6, 6.0, 6.6, 0.7); S.c.add('Σᵢ₌₀^∞ xⁱ = 1 / (1 − x)（首項 ÷ (1 − 公比)）', C.sky);
    cap('已經知道', 'Σ xⁱ = 首項除以（1 − 公比）');
  },
  async (tok, S) => { // 3451.0 兩邊微分
    S.c.add('兩邊同時 d/dx', C.lilac);
    cap('這個式子兩邊', '分別微分，答案一樣');
  },
  async (tok, S) => { // 3477.8 i x^{i−1}
    S.c.add('左：xⁱ 微分 = i·xⁱ⁻¹');
    cap('微分拿進去', 'xⁱ 微分等於 i 乘 x 的 i − 1 次方');
  },
  async (tok, S) => { // 3490.6 常數項
    S.c.add('i = 0 是常數 1，微分變 0 → 從 i = 1 開始', C.peach);
    cap('不要忘記：常數項微分', '微分之後不見了，所以從第一項開始');
  },
  async (tok, S) => { // 3523.8 連鎖律
    S.c.add('右：(1 − x)⁻¹ 微分：−1 拿下來，連鎖律又一個 −1');
    cap('右邊用連鎖律', '−1 次方拿下來一個 −1，裡面又跑出一個 −1');
  },
  async (tok, S) => { // 3537.5 1/(1−x)²
    S.c.add('→ Σᵢ₌₁^∞ i·xⁱ⁻¹ = 1/(1 − x)² ✓', C.mint);
    cap('兩個負號抵消', '得到的就是 1/(1 − x)²');
  },
  async (tok, S) => { // 3557.6 generating function
    note('後面講 generating function 會再用到', -3.4, 2.4);
    cap('有興趣可以再微一次', '後面用 generating function 時會再拿出來用');
  },
  async (tok, S) => { // 3571.8 泰勒展開
    note('這兩個其實是 1/(1−x)、1/(1−x)² 在 x = 0 的泰勒展開', -3.4, 1.8);
    cap('這其實就是泰勒展開', '1/(1 − x) 在 x = 0 的泰勒展開');
  },
]);

scene('sfB-l7-k2', 'Lec07：練習：Σₖ₌₅₀¹⁰⁰ k²', [
  async (tok, S) => { // 3599.5
    S.e = card('Σₖ₌₅₀¹⁰⁰ k² = ?', C.gold, 0, 6.2, 4.6); glow(S.e, HL);
    cap('為什麼要講那些公式？', 'k² 從第 50 項加到第 100 項');
  },
  async (tok, S) => { // 3606.0 不是從 1
    glow(S.e, null); note('知道平方和公式，但它不是從第 1 項開始', 0, 5.5);
    cap('平方公式都知道', '但他動了手腳：不是從第 1 項開始');
  },
  async (tok, S) => { // 3615.0 切兩段
    const X = (v) => -6 + (v / 100) * 12;
    S.a = bar(X(0), X(49), 4.2, C.gray, 0.4); S.c = bar(X(49), X(100), 4.2, C.orange, 0.4);
    sm('1～49', X(24), 3.6); sm('50～100（要的）', X(75), 3.6);
    cap('1 到 100 切成兩段', '1 到 49，和 50 到 100');
  },
  async (tok, S) => { // 3629.0 相減
    S.b = board(0, 2.8, 10.0, 0.72); S.b.add('= Σₖ₌₁¹⁰⁰ k² − Σₖ₌₁⁴⁹ k²', C.lilac);
    cap('兩個都從第 1 項開始，都會算', '所以 = 1 加到 100 減掉 1 加到 49');
  },
  async (tok, S) => { // 3641.2 數字
    S.b.add('= 100·101·201/6 − 49·50·99/6 = 338350 − 40425 = 297925', C.mint);
    cap('套平方和公式 n(n+1)(2n+1)/6', '338350 − 40425 = 297925');
  },
]);

scene('sfB-l7-card', 'Lec07：cardinality：一樣大 ⇔ 有對射', [
  async (tok, S) => { // 3658.3
    hot('cardinality 重講一次，再仔細細分', 0, 6.7);
    cap('很重要的概念', '集合的大小 cardinality 重講一次');
  },
  async (tok, S) => { // 3669.4 有限
    S.b = board(-3.4, 6.0, 6.6, 0.7); S.b.add('有限集合：數得完（5 個、6 個、7 個）', C.sky);
    cap('上次分成兩大類：有限', '裡面數得完，個數是有限的');
  },
  async (tok, S) => { // 3683.8 無窮
    S.b.add('無窮集合：自然數、實數、有理數…', C.peach);
    cap('有些數不完', '像自然數、實數、有理數：無窮集合');
  },
  async (tok, S) => { // 3713.4 可數 / 不可數
    S.b.add('無窮也分兩類：可數 countable／不可數 uncountable', C.lilac);
    cap('無窮也有大有小', '分成可數、不可數兩類');
  },
  async (tok, S) => { // 3720.2 考試標準題
    note('今天的重點：研究所考試的標準題', -3.4, 1.0);
    cap('這是今天的重點', '考試有幾題標準題，研究所一定要會');
  },
  async (tok, S) => { // 3733.7 5 個
    S.L = ['a', 'b', 'c', 'd', 'e'].map((v, i) => num(v, 2.0, 5.6 - i * 0.95, C.blue, 0.55));
    S.R = [1, 2, 3, 4, 5].map((v, i) => num(v, 5.6, 5.6 - i * 0.95, C.green, 0.55));
    cap('{a, b, c, d, e} 是 5 個', '{1, 2, 3, 4, 5} 也說是 5 個');
  },
  async (tok, S) => { // 3758.3 對射函式
    for (let i = 0; i < 5; i++) { arr(2.35, 5.6 - i * 0.95, 5.25, 5.6 - i * 0.95); await wt(tok, 120); }
    cap('為什麼一樣？', '因為可以找到一個對射函式把它們連在一起');
  },
  async (tok, S) => { // 3773.7 一樣大
    S.b.add('|A| = |B| ⇔ A、B 之間存在對射', C.gold);
    cap('能構成對射函式', '我們就說這兩個集合大小一樣');
  },
  async (tok, S) => { // 3792.7 工具
    good('比大小的工具：找出函式，找到就是證明', 0, 0.3);
    cap('說一樣大、比較大、比較小', '都要靠函式這個工具，找得到就是證明');
  },
]);

scene('sfB-l7-countable', 'Lec07：可數：能跟自然數「點名」', [
  async (tok, S) => { // 3809.0
    hot('可數 countable vs 不可數 uncountable', 0, 6.7);
    cap('接下來兩個東西', '可數跟不可數');
  },
  async (tok, S) => { // 3815.8 可數包含
    S.b = board(3.4, 6.0, 7.0, 0.68); S.b.add('可數 = 有限集合 + 無窮集合裡的一部分', C.sky);
    cap('所謂的可數', '包含有限集合，和無窮集合裡的一部分');
  },
  async (tok, S) => { // 3827.2 定義
    S.b.add('定義：A 和 N 的某個子集合之間有對射 → 可數', C.gold);
    cap('一個集合 A', '能跟自然數的某個子集合找到對射，就叫可數');
  },
  async (tok, S) => { // 3862.5 N 的子集合
    S.b.add('N 的子集合，例如 {1, 2, 3}');
    cap('自然數的子集合', '通常就是指 1、2、3 這樣的');
  },
  async (tok, S) => { // 3873.2 點名 a,b,c
    S.A = ['a', 'b', 'c'].map((v, i) => num(v, -5.6 + i * 1.3, 5.0, C.blue, 0.6));
    S.tg = []; for (let i = 0; i < 3; i++) { S.tg.push(hot((i + 1) + ' 號', -5.6 + i * 1.3, 5.8)); await wt(tok, 200); }
    cap('其實就是數數的動作', 'a 點名 1 號、b 2 號、c 3 號');
  },
  async (tok, S) => { // 3894.3 點名 = 函式
    S.b.add('點名就是一個函式：一對一且映成 → 可數', C.mint);
    cap('點名的動作就是一個函式', '跟 1、2、3 一對一且映成 → {a, b, c} 可數');
  },
  async (tok, S) => { // 3908.4 0.1~0.4
    S.D = ['0.1', '0.2', '0.3', '0.4'].map((v, i) => num(v, -5.8 + i * 1.3, 3.0, C.purple, 0.6));
    cap('再來 {0.1, 0.2, 0.3, 0.4}', '一樣對它點名');
  },
  async (tok, S) => { // 3924.5 隨便點
    [4, 2, 3, 1].forEach((n, i) => hot(n + ' 號', -5.8 + i * 1.3, 3.8));
    cap('點名順序隨便抓', '0.1 對 4、0.2 對 2、0.3 對 3、0.4 對 1');
  },
  async (tok, S) => { // 3933.8 只要是對射
    good('只要是一對一且映成 → 證明可數', -3.4, 2.1);
    cap('不管函式怎麼抓', '只要是一對一且映成，就證明它可數');
  },
  async (tok, S) => { // 3951.3 沒跳號 → 4
    note('從 1 依序數上去、沒有跳號 → 最後的 4 就是大小', -3.4, 1.5);
    cap('從 1、2、3、4 依序數，沒有跳號', '所以 4 就是這個集合的大小');
  },
  async (tok, S) => { // 3966.7 自然數由來
    S.k = buddy('', '', C.mint, 5.4, 0.0, 1.0, 0.6); S.k.mood('happy');
    S.b.add('自然數：人生下來就會數（幾頭羊、幾個小孩）', C.sky);
    cap('為什麼叫自然數？', '養幾頭羊、幾隻小狗、幾個小孩，從 0 開始數');
  },
  async (tok, S) => { // 3984.7 59 人
    S.b.add('班上點名點到 59 人 → 可數', C.sky); await S.k.hop(tok);
    cap('班上點名點到 59 個', '學生所成的集合可數：每個人都數得到');
  },
  async (tok, S) => { // 4027.6 數得到 vs 數得完
    S.c = board(-3.4, -0.3, 6.8, -0.62); S.c.add('兩個名詞：「數得到」vs「數得完」', C.lilac);
    cap('N 本身數不完', '這裡有兩個名詞：數得到、數得完');
  },
  async (tok, S) => { // 4053.0 數得到 = 可數
    S.c.add('數得到：你說任何數（一億兩千…），我都數得到 → 可數', C.mint);
    cap('你給一個數字，我一定數得到', '這個「數得到」就是可數');
  },
  async (tok, S) => { // 4067.2 數得完 = 有限
    S.c.add('數得完：一下子全部點名完 → 有限集合', C.peach);
    cap('數得完：香蕉、蘋果、芭樂', '一下子全部點完 → 有限集合');
  },
]);

scene('sfB-l7-zn', 'Lec07：整數 Z 跟自然數 N 一樣多', [
  async (tok, S) => { // 4073.0
    hot('整數 Z 和自然數 N，哪一個比較多？', 0, 6.7);
    cap('來看整數集合和自然數集合', '你覺得哪一個集合比較大？');
  },
  async (tok, S) => { // 4088.6 兩列
    S.Z = [-3, -2, -1, 0, 1, 2, 3].map((v, i) => num(v < 0 ? '−' + -v : v, -4.2 + i * 1.4, 5.4, C.purple, 0.6)); sm('…', -5.5, 5.4); sm('…', 5.5, 5.4); hd('Z', -6.6, 5.4);
    S.N = [0, 1, 2, 3, 4, 5, 6].map((v, i) => num(v, -4.2 + i * 1.4, 2.0, C.green, 0.6)); sm('…', 5.5, 2.0); hd('N', -6.6, 2.0);
    cap('Z：…、−2、−1、0、1、2、…', 'N：0、1、2、3 這樣下去');
  },
  async (tok, S) => { // 4106.7 直覺
    S.bb = bub('直覺：Z 好像比較多？', 0, 3.7);
    cap('對錯沒關係，憑直覺', '都是無窮多，有人覺得 Z 比較大');
  },
  async (tok, S) => { // 4134.5 一樣大 ⇔ 對射
    S.b = board(0, 0.9, 12.0, 0.6); S.b.add('一樣大 ⇔ 找得到對射', C.gold);
    cap('回到 cardinality', '兩個集合一樣大：可以找到對射函式');
  },
  async (tok, S) => { // 4158.7 找不到要排除全部
    S.b.add('說「找不到」要排除千百種函式；說「找得到」直接給出來就好', C.sky);
    cap('說找不到，要排除所有可能', '要找到就簡單：直接給我那個函式');
  },
  async (tok, S) => { // 4171.3 一樣大
    S.b.add('結論：其實 |Z| = |N|，一樣大！', C.mint);
    cap('感覺 Z 比較大', '實際上兩個一樣大');
  },
  async (tok, S) => { // 4197.4 兩頭無窮
    gone(S.b.ls); S.bd = bad('Z 兩頭都無窮，不能直接一個對一個', 0, 0.6);
    cap('自然數有一個無窮的頭', 'Z 兩邊都是無窮，很難直接對應');
  },
  async (tok, S) => { // 4206.8 切一半
    for (let i = 0; i < 3; i++) tint(S.Z[i], C.pink);
    for (let i = 3; i < 7; i++) tint(S.Z[i], C.blue);
    cap('把整數切一半', '負整數一半、0 和正整數一半');
  },
  async (tok, S) => { // 4218.6 偶數、奇數
    S.N.forEach((m, i) => tint(m, i % 2 ? C.pink : C.blue));
    remove(S.bd); S.nt = note('非負的 → 偶數；負的 → 奇數', 0, 0.6);
    cap('想法：0、1、2、3 對到偶數', '−1、−2、−3 對到奇數');
  },
  async (tok, S) => { // 4228.6 0→0, 1→2, 2→4
    const X = (i) => -4.2 + i * 1.4;
    for (const [z, n] of [[0, 0], [1, 2], [2, 4], [3, 6]]) { arr(X(z + 3), 5.0, X(n), 2.4, 0x4b9ee2); await wt(tok, 200); }
    cap('0 對到 0', '1 對到 2、2 對到 4（3 對到 6）');
  },
  async (tok, S) => { // 4237.5 −1→1, −2→3
    const X = (i) => -4.2 + i * 1.4;
    for (const [z, n] of [[-1, 1], [-2, 3], [-3, 5]]) { arr(X(z + 3), 5.0, X(n), 2.4, 0xe55a9b); await wt(tok, 200); }
    cap('−1 對到 1', '−2 對到 3（−3 對到 5）');
  },
  async (tok, S) => { // 4251.1 沒重複、全對到
    S.N.forEach((m) => glow(m, OKG));
    remove(S.bb); S.gd = good('沒有重複對應、每個自然數都被對到 → 對射', 0, 3.7);
    cap('有沒有重複對應？沒有', '偶數、奇數都會被對到：一對一且映成');
  },
  async (tok, S) => { // 4276.2 f(z) = 2z
    remove(S.nt); S.f = board(0, 0.9, 9.0, 0.62); S.f.add('f(z) = 2z，當 z ≥ 0', C.sky);
    cap('公式寫下來', '0 → 0、1 → 2：兩倍，f(z) = 2z（z ≥ 0）');
  },
  async (tok, S) => { // 4302.0 z < 0
    S.f.add('f(z) = −2z − 1，當 z < 0', C.peach);
    cap('負數：先乘 −2 變正的', '−1 × (−2) = 2，要得到 1 再減 1：−2z − 1');
  },
  async (tok, S) => { // 4329.7 完成證明
    hot('f 是 bijection → 證明完成', 0, 6.15);
    cap('找出這個函式', '就等於完成證明（記得說明它是 bijection）');
  },
  async (tok, S) => { // 4341.1 跳脫直覺
    remove(S.gd); note('無窮的時候狀況有點怪：要跳脫原來的直覺', 0, 3.7);
    cap('第一件事', '無窮的時候狀況有點怪，要跳脫直覺');
  },
]);

const GX = (m) => -6.0 + m * 1.15, GY = (n) => 0.7 + n * 1.15;
scene('sfB-l7-grid', 'Lec07：格子點 N × N 也可數（沿斜線數）', [
  async (tok, S) => { // 4352.9
    hot('直積 N × N 會不會比 N 大？', 0, 6.7);
    cap('再來看直積', '有沒有辦法比自然數大？');
  },
  async (tok, S) => { // 4370.1 格子點
    S.P = {}; for (let m = 0; m <= 4; m++) for (let n = 0; n <= 4; n++) S.P[m + ',' + n] = cube(null, C.gray, [0.32, 0.32, 0.32], GX(m), GY(n), 0.2);
    line(GX(0) - 0.4, GY(0), GX(4) + 0.6, GY(0)); line(GX(0), GY(0) - 0.4, GX(0), GY(4) + 0.6); sm('m', GX(4) + 0.8, GY(0)); sm('n', GX(0), GY(4) + 0.85);
    S.b = board(3.6, 6.0, 6.4, 0.7); S.b.add('格子點 { (m, n) | m, n ∈ N }', C.sky);
    cap('座標都是整數的點：格子點', '這個集合就是 N × N');
  },
  async (tok, S) => { // 4402.8 會不會比較多
    S.b.add('一條線上的整數比不過，那二維的呢？');
    cap('拿二維的來問', '這些點會不會比自然數還多？');
  },
  async (tok, S) => { // 4408.8 一樣多
    S.b.add('答案：一樣多！', C.mint);
    cap('答案還是一樣', '格子點的個數跟自然數一樣多');
  },
  async (tok, S) => { // 4426.4 數數的方法
    S.b.add('要證明：給一個數數的方法（任何點都數得到）', C.lilac);
    cap('要證明就要給數數的方法', '你給我任何一個點，我都說得出它的編號');
  },
  async (tok, S) => { // 4447.8 斜線
    for (let s = 0; s <= 4; s++) line(GX(0) - 0.25, GY(s) + 0.25, GX(s) + 0.25, GY(0) - 0.25, 0.1, '#c9b48a');
    S.b.add('標準解法：沿著 45° 斜線一條一條數', C.gold);
    cap('標準解法', '抓斜線，一條一條數');
  },
  async (tok, S) => { // 4449.6 (0,0) = 0
    S.no = (m, n, k) => { tint(S.P[m + ',' + n], C.blue); glow(S.P[m + ',' + n], HL); hot(String(k), GX(m) + 0.32, GY(n) + 0.32, 0.3); };
    S.no(0, 0, 0);
    cap('第一個先算這個點 (0, 0)', '它是 0 號');
  },
  async (tok, S) => { // 4476.1 (0,1)=1, (1,0)=2
    S.no(0, 1, 1); await wt(tok, 250); S.no(1, 0, 2);
    cap('接著這條斜線：(0, 1) 是 1 號', '(1, 0) 是 2 號（x 小的先數）');
  },
  async (tok, S) => { // 4498.1 (0,2)=3…
    S.no(0, 2, 3); await wt(tok, 200); S.no(1, 1, 4); await wt(tok, 200); S.no(2, 0, 5);
    cap('再下一條：(0, 2) 是 3 號', '接著 4 號、5 號');
  },
  async (tok, S) => { // 4507.6 6…14
    let k = 6; for (let s = 3; s <= 4; s++) for (let m = 0; m <= s; m++) { S.no(m, s - m, k++); await wt(tok, 120); }
    cap('第六、七、八…', '一直數到第十四個點');
  },
  async (tok, S) => { // 4524.0 每條有限
    S.b.add('每條斜線上的點都是有限個 → 總有一天數到你', C.mint);
    cap('斜線一直往外擴', '每條線上的點有限，不管點在哪，總會數到');
  },
  async (tok, S) => { // 4547.2 1,2,3,4,5
    for (let s = 0; s <= 4; s++) sm((s + 1) + ' 點', GX(s) + 0.55, GY(0) - 0.55);
    cap('找規律：每條線上的點數', '1、2、3、4、5');
  },
  async (tok, S) => { // 4564.0 m + n = s
    for (let s = 0; s <= 4; s++) sm('m+n=' + s, GX(0) - 0.85, GY(s) + 0.05);
    cap('這條線的特徵', 'm + n = 0、m + n = 1、m + n = 2…');
  },
  async (tok, S) => { // 4608.1 m+n=3：前面 6 點
    gone(S.b.ls); S.c = board(3.6, 6.0, 6.6, 0.72);
    glow(S.P['2,1'], '#7a1010'); bub('示意：點 (2, 1)', GX(2) + 0.2, GY(1) + 0.85);
    S.c.add('(2, 1) 在 m + n = 3 上：前面有 1 + 2 + 3 = 6 點', C.sky);
    cap('假設落在 m + n = 3 這條線', '前面幾排：1 + 2 + 3 = 6 個點');
  },
  async (tok, S) => { // 4629.2 一般
    S.c.add('一般：前面有 1 + 2 + … + (m + n) 點', C.lilac);
    cap('不是你那一排的', '前面有 1 + 2 + … 加到 m + n 這麼多點');
  },
  async (tok, S) => { // 4677.4 再數 m + 1
    S.c.add('在自己這條線上，x 從 0 數起：再數 m + 1 個', C.sky);
    cap('在你這條線上從 x 小的數', 'x = 0、1、2 → 再數 m + 1 個就到你');
  },
  async (tok, S) => { // 4691.0 公式
    S.c.add('從 0 開始編號要減 1：f(m, n) = (m+n)(m+n+1)/2 + m', C.mint);
    S.c.add('(2, 1)：6 + 3 − 1 = 8 ✓', C.mint);
    cap('因為從 0 開始算，最後減 1', 'f(m, n) = (m + n)(m + n + 1)/2 + m');
  },
  async (tok, S) => { // 4721.4 對射
    good('f 是 bijection → |N × N| = |N|', 3.6, 0.6);
    cap('這是一個對射函式', '證明兩個集合一樣大');
  },
]);

scene('sfB-l7-cantor', 'Lec07：實數比自然數多（對角線法預告）', [
  async (tok, S) => { // 4733.2
    hot('有沒有比自然數大的？有：實數 R', 0, 6.7);
    cap('有沒有東西比自然數大？', '有：實數');
  },
  async (tok, S) => { // 4746.8 困境
    S.b = board(3.6, 6.0, 6.8, 0.7); S.b.add('困境：要說「不存在」對射，不能把函式全列出來', C.peach);
    cap('現在的困境', '要說不存在這個函式，卻沒辦法列舉所有函式');
  },
  async (tok, S) => { // 4760.9 反證法
    S.b.add('用反證法：先假設實數是可數的', C.gold);
    cap('用反證法', '先假設所有實數是可數的，可以點名');
  },
  async (tok, S) => { // 4778.5 點名 r1..r4
    S.rows = ['r₁', 'r₂', 'r₃', 'r₄'].map((t, i) => hd(t, -6.4, 5.2 - i * 0.9));
    S.b.add('只看 0 到 1 之間：r₁, r₂, r₃, r₄, …', C.sky);
    cap('照你點名的方式', '考慮 0 到 1 的區間：1 號、2 號、3 號、4 號');
  },
  async (tok, S) => { // 4789.0 寫小數位
    const D = ['4159', '2718', '3341', '5002']; S.d = [];
    D.forEach((ds, i) => { sm('0.', -5.6, 5.2 - i * 0.9); S.d.push([...ds].map((c, j) => num(c, -4.8 + j * 0.8, 5.2 - i * 0.9, C.sand, 0.55))); });
    sm('（數字是示意）', -3.6, 1.6);
    cap('把它們的小數位寫出來', '1 號是 0.多多多，2 號是 0.多多多…');
  },
  async (tok, S) => { // 4815.5 找一個數
    for (let i = 0; i < 4; i++) { glow(S.d[i][i], HL); await wt(tok, 200); }
    const nd = ['5', '4', '5', '4']; nd.forEach((c, j) => num(c, -4.8 + j * 0.8, 0.8, C.mint, 0.55)); sm('r = 0.', -5.9, 0.8);
    note('第 i 位：對角數字 ≠ 4 就寫 4，= 4 就寫 5', -3.6, 0.1);
    cap('我找一個數字', '它跟 r₁ 第 1 位不同、跟 r₂ 第 2 位不同…');
  },
  async (tok, S) => { // 4825.7 對應不到
    S.b.add('r 不是 r₁、不是 r₂、不是 r₃…永遠對應不到 → 矛盾', C.mint);
    good('實數 R 比自然數大（下次細講）', 3.6, 1.6);
    cap('你永遠找不到它的編號', '所以實數比自然數大，下次再繼續補充');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
      'func-def', 'inj-surj', 'composition', 'inverse', 'countable-z', 'countable-q', 'cantor-diagonal'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
