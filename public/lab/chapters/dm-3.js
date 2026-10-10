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
