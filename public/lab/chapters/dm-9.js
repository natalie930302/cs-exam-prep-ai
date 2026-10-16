// 離散數學 第9章：二元關係 — 箭頭圖與 0/1 矩陣、reflexive / symmetric / antisymmetric / transitive、
// 合成、閉包（reflexive / symmetric / transitive：Warshall）、等價關係與分割、偏序與 Hasse 圖、
// maximal / minimal / greatest / least、lub / glb 與 lattice、拓撲排序。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec20–21、趙啟超 6A–8B、Equivalence Relation）目前都還沒有逐字稿，
// 所有場景依課本（Rosen 第 9 章 Relations／Grimaldi 第 7 章）的標準例子製作，標題前註明（課本）。
// 慣例（Rosen）：M_R 的 (i,j) 格 = 1 ⇔ (aᵢ,aⱼ) ∈ R；Warshall 的 W_k = 只允許經過 a₁…a_k 的路徑；
// 合成 S∘R = 先 R 再 S，M_{S∘R} = M_R ⊙ M_S（Boolean product）。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const COL = { idle: '#cdbfa6', vis: '#2fc092', edge: '#9c8b70', one: '#4b9ee2', zero: '#efe5d3', hot: '#d64545', gold: '#c08a1f', new: '#2fc092', pink: '#e55a9b', purple: '#9b7ef4', orange: '#dd8238', dim: '#e9e1d3' };
  const CLS = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a'];
  const UP = V3(0, 1, 0);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => a / gcd(a, b) * b;

  // ───────────────────────── 共用小工具 ─────────────────────────
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  const glow = (m, c) => { if (m && m.material) m.material.emissive = new THREE.Color(c || '#000000'); };
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    if (o.parent) o.parent.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function arrow(a, b, o = {}) {
    const gap = o.gap ?? 0.42, r = o.r ?? 0.045, off = o.off || 0;
    const n = b.clone().sub(a).normalize();
    let side = V3(-n.z, 0, n.x); if (side.lengthSq() < 1e-6) side = V3(1, 0, 0);
    side.normalize().multiplyScalar(off);
    const s = a.clone().addScaledVector(n, gap).add(side), e = b.clone().addScaledVector(n, -gap).add(side);
    const L = Math.max(0.05, s.distanceTo(e) - (o.directed === false ? 0 : 0.28));
    const mat = new THREE.MeshStandardMaterial({ color: o.color || COL.edge, roughness: 0.6 });
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
    cyl.position.copy(s).addScaledVector(n, L / 2); cyl.quaternion.setFromUnitVectors(UP, n); g.add(cyl);
    if (o.directed !== false) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 12), mat);
      cone.position.copy(e).addScaledVector(n, -0.15); cone.quaternion.setFromUnitVectors(UP, n); g.add(cone);
    }
    g.userData = { mat, cyl };
    (o.parent || lab.world).add(g);
    return g;
  }
  function loopMesh(p, color, parent, vertical) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    if (vertical) m.position.set(p.x + 0.55, p.y + 0.35, p.z);
    else m.position.set(p.x, p.y + 0.55, p.z - 0.25);
    (parent || lab.world).add(m);
    m.userData = { mat: m.material };
    return m;
  }
  const paintArc = (g, c, thick) => { g.userData.mat.color.set(c); if (g.userData.cyl) { const k = thick ? 1.8 : 1; g.userData.cyl.scale.set(k, 1, k); } };
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok === undefined) await sleep(ms / steps); else await beat(tok, ms / steps); } }

  // ───────────────────────── 關係：資料與性質 ─────────────────────────
  const P = (a, b) => a + ',' + b;
  const relOf = (A, f) => new Set(A.flatMap((a) => A.filter((b) => f(a, b)).map((b) => P(a, b))));
  const has = (R, a, b) => R.has(P(a, b));
  function props(A, R) {
    const out = {};
    const miss = A.find((a) => !has(R, a, a));
    out.ref = { ok: miss === undefined, w: miss === undefined ? null : [P(miss, miss)], why: miss === undefined ? '每個 (a,a) 都在' : '缺 (' + miss + ',' + miss + ')' };
    let sw = null; for (const a of A) for (const b of A) if (!sw && has(R, a, b) && !has(R, b, a)) sw = [a, b];
    out.sym = { ok: !sw, w: sw ? [P(sw[0], sw[1])] : null, why: sw ? '(' + sw + ') 在、(' + sw[1] + ',' + sw[0] + ') 不在' : '每個 (a,b) 都有 (b,a)' };
    let aw = null; for (const a of A) for (const b of A) if (!aw && a !== b && has(R, a, b) && has(R, b, a)) aw = [a, b];
    out.anti = { ok: !aw, w: aw ? [P(aw[0], aw[1]), P(aw[1], aw[0])] : null, why: aw ? '(' + aw + ') 和 (' + aw[1] + ',' + aw[0] + ') 都在、但 ' + aw[0] + ' ≠ ' + aw[1] : '沒有一對 a ≠ b 互指' };
    let tw = null; for (const a of A) for (const b of A) for (const c of A) if (!tw && has(R, a, b) && has(R, b, c) && !has(R, a, c)) tw = [a, b, c];
    out.tra = { ok: !tw, w: tw ? [P(tw[0], tw[1]), P(tw[1], tw[2])] : null, miss: tw ? P(tw[0], tw[2]) : null, why: tw ? '(' + tw[0] + ',' + tw[1] + ')、(' + tw[1] + ',' + tw[2] + ') 在，但 (' + tw[0] + ',' + tw[2] + ') 不在' : '每條 a→b→c 都有 a→c' };
    return out;
  }
  const PROP_NAMES = { ref: 'Reflexive 反身', sym: 'Symmetric 對稱', anti: 'Antisymmetric 反對稱', tra: 'Transitive 遞移' };
  const okSpan = (ok) => (ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');

  // 箭頭圖（地上圍一圈）＋ 0/1 矩陣（右邊）
  function relView(A, o = {}) {
    const n = A.length, R0 = o.R || 2.1, cx = o.cx ?? -3.2, cz = o.cz ?? 0.2, mx = o.mx ?? 2.2, mz = o.mz ?? -1.4, cs = o.cs ?? (n > 4 ? 0.62 : 0.8);
    const pos = {}, vm = {};
    A.forEach((a, i) => {
      const t = Math.PI / 2 + i * 2 * Math.PI / n;
      pos[a] = V3(cx + Math.cos(t) * R0, 0.3, cz - Math.sin(t) * R0);
      const m = cube(a, COL.idle, [0.6, 0.5, 0.6], pos[a].x, 0.3, pos[a].z); vm[a] = m;
    });
    const cells = {};
    A.forEach((a, i) => {
      tag(String(a), 'idx', mx - cs * 0.9, 0.1, mz + i * cs);
      tag(String(a), 'idx', mx + i * cs, 0.1, mz - cs * 0.9);
      A.forEach((b, j) => { cells[P(a, b)] = cube('0', COL.zero, [cs * 0.86, 0.14, cs * 0.86], mx + j * cs, 0.07, mz + i * cs); });
    });
    const arcs = new THREE.Group(); lab.world.add(arcs);
    let arcMap = {};
    function set(R, hi = {}) {
      arcs.children.slice().forEach((c) => arcs.remove(c));
      arcMap = {};
      for (const k of R) {
        const [a, b] = k.split(',');
        const c = hi[k] || COL.edge;
        if (a === b) arcMap[k] = loopMesh(pos[a], c, arcs, false);
        else arcMap[k] = arrow(pos[a], pos[b], { parent: arcs, color: c, off: R.has(P(b, a)) ? 0.16 : 0 });
        if (hi[k]) paintArc(arcMap[k], c, true);
      }
      for (const a of A) for (const b of A) {
        const k = P(a, b), m = cells[k], one = R.has(k);
        m.material.color.set(hi[k] || (one ? COL.one : COL.zero));
        m.scale.y = one ? 3 : 1; m.position.y = one ? 0.21 : 0.07;
        relabel(m, one ? '1' : '0');
        glow(m, hi[k] && !one ? '#5a1010' : null);
      }
    }
    return { A, pos, vm, cells, set, cs, mx, mz };
  }

  // 預設關係（A = {1,2,3,4}）
  const A4 = ['1', '2', '3', '4'];
  const N = (x) => Number(x);
  const PRESETS = {
    eq: { name: 'a = b', R: () => relOf(A4, (a, b) => a === b) },
    le: { name: 'a ≤ b', R: () => relOf(A4, (a, b) => N(a) <= N(b)) },
    lt: { name: 'a < b', R: () => relOf(A4, (a, b) => N(a) < N(b)) },
    div: { name: 'a | b（整除）', R: () => relOf(A4, (a, b) => N(b) % N(a) === 0) },
    mod2: { name: 'a ≡ b (mod 2)', R: () => relOf(A4, (a, b) => (N(a) - N(b)) % 2 === 0) },
    ex: { name: '例：{(1,1),(1,2),(2,1),(2,2),(3,4),(4,1),(4,4)}', R: () => new Set(['1,1', '1,2', '2,1', '2,2', '3,4', '4,1', '4,4']) },
    empty: { name: '空關係 ∅', R: () => new Set() },
    rand: { name: '隨機', R: () => relOf(A4, () => Math.random() < 0.35) },
  };

  // ───────────────────────── 模式 1：關係與四個性質 ─────────────────────────
  const pm = { k: 'div', R: null };
  function enterProps(regen) {
    fresh([0, 9.6, 8.4], [0, 0, 0.4]);
    if (!pm.R || regen) pm.R = PRESETS[pm.k].R();
    controls('<select id="rP">' + Object.keys(PRESETS).map((k) => '<option value="' + k + '">' + PRESETS[k].name + '</option>').join('') + '</select>'
      + '<label>(a,b) = <input id="rIn" value="1,3" style="width:60px"></label><button class="primary" id="rTog">加入／移除</button>'
      + '<select id="rW"><option value="">看反例：—</option><option value="ref">反身</option><option value="sym">對稱</option><option value="anti">反對稱</option><option value="tra">遞移</option></select>');
    $('rP').value = pm.k;
    $('rP').onchange = (e) => { pm.k = e.target.value; enterProps(true); };
    const v = relView(A4);
    tag('A = {1,2,3,4}', 'ptr', -3.2, 0.3, 3.2); tag('M_R', 'ptr alt', 3.4, 0.3, 2.4);
    const show = (focus) => {
      const pr = props(A4, pm.R), hi = {};
      if (focus && pr[focus] && !pr[focus].ok) { pr[focus].w.forEach((k) => { hi[k] = COL.hot; }); if (pr[focus].miss) hi[pr[focus].miss] = COL.orange; }
      v.set(pm.R, hi);
      const eqv = pr.ref.ok && pr.sym.ok && pr.tra.ok, po = pr.ref.ok && pr.anti.ok && pr.tra.ok;
      setState('R ⊆ A × A，|R| = ' + pm.R.size, Object.keys(PROP_NAMES).map((k) => [PROP_NAMES[k], okSpan(pr[k].ok) + ' ' + pr[k].why]),
        (eqv ? '<span class="ok">等價關係</span>（反身＋對稱＋遞移）' : '不是等價關係') + '<br>' + (po ? '<span class="ok">偏序</span>（反身＋反對稱＋遞移）' : '不是偏序'));
    };
    on('rTog', () => {
      const m = String($('rIn').value).replace(/[()\s]/g, '').split(',');
      if (m.length !== 2 || !A4.includes(m[0]) || !A4.includes(m[1])) { log('請輸入 A 裡的兩個元素，例如 2,3', true); return; }
      const k = P(m[0], m[1]);
      if (pm.R.has(k)) { pm.R.delete(k); log('移除 (' + k + ')'); } else { pm.R.add(k); log('加入 (' + k + ')' + (m[0] === m[1] ? '：loop' : '')); }
      show($('rW').value);
    });
    $('rW').onchange = (e) => { const f = PROP_NAMES[e.target.value] ? e.target.value : ''; show(f); if (f) { const pr = props(A4, pm.R); log(PROP_NAMES[f] + '：' + (pr[f].ok ? '成立，沒有反例' : pr[f].why), !pr[f].ok); } };
    log('箭頭 a → b ⇔ (a,b) ∈ R ⇔ 矩陣第 a 列第 b 行是 1；loop 對應對角線。');
    show('');
  }

  // ───────────────────────── 模式 2：閉包與 Warshall ─────────────────────────
  const WEX = { A: ['a', 'b', 'c', 'd'], R: ['a,d', 'b,a', 'b,c', 'c,a', 'c,d', 'd,c'] };
  function warshallSteps(A, R) {
    const n = A.length, W = A.map((a) => A.map((b) => R.has(P(a, b)) ? 1 : 0)), steps = [];
    steps.push({ k: -1, W: W.map((r) => r.slice()), add: [], msg: 'W₀ = M_R' });
    for (let k = 0; k < n; k++) {
      const add = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!W[i][j] && W[i][k] && W[k][j]) add.push([i, j]);
      add.forEach(([i, j]) => { W[i][j] = 1; });
      steps.push({ k, W: W.map((r) => r.slice()), add, msg: 'W' + '₁₂₃₄₅₆'[k] + '：允許經過 ' + A.slice(0, k + 1).join(',') + (add.length ? '，新增 ' + add.map(([i, j]) => '(' + A[i] + ',' + A[j] + ')').join(' ') : '，沒有新增') });
    }
    return steps;
  }
  const cm = { R: null };
  function enterClosure(reset) {
    fresh([0, 9.6, 8.4], [0, 0, 0.4]);
    if (!cm.R || reset) cm.R = new Set(WEX.R);
    const A = WEX.A;
    controls('<button id="cRef">反身閉包</button><button id="cSym">對稱閉包</button><button class="primary" id="cW">Warshall 下一步</button><button id="cReset">重來</button>');
    const v = relView(A);
    tag('A = {a,b,c,d}', 'ptr', -3.2, 0.3, 3.2);
    let ws = null, wi = 0;
    const show = (hi = {}, note = '') => {
      v.set(cm.R, hi);
      const pr = props(A, cm.R);
      setState('閉包：加入「最少」的配對讓性質成立', [['|R|', String(cm.R.size)], ['反身', okSpan(pr.ref.ok)], ['對稱', okSpan(pr.sym.ok)], ['遞移', okSpan(pr.tra.ok)]], note || '綠色 = 剛加進來的配對');
    };
    on('cRef', () => { ws = null; const hi = {}; A.forEach((a) => { if (!cm.R.has(P(a, a))) { cm.R.add(P(a, a)); hi[P(a, a)] = COL.new; } }); log('反身閉包 R ∪ Δ：補上所有 (a,a)，加了 ' + Object.keys(hi).length + ' 個'); show(hi); });
    on('cSym', () => { ws = null; const hi = {}; [...cm.R].forEach((k) => { const [a, b] = k.split(','); if (!cm.R.has(P(b, a))) { cm.R.add(P(b, a)); hi[P(b, a)] = COL.new; } }); log('對稱閉包 R ∪ R⁻¹：每個 (a,b) 補上 (b,a)，加了 ' + Object.keys(hi).length + ' 個'); show(hi); });
    on('cW', () => {
      if (!ws) { ws = warshallSteps(A, cm.R); wi = 0; log('Warshall：W₀ = M_R，W_k 只允許中途經過前 k 個點。'); show({}, ws[0].msg); return; }
      if (wi >= ws.length - 1) { log('W₄ 就是遞移閉包 R*，已經做完。', true); return; }
      wi++;
      const st = ws[wi], hi = {};
      A.forEach((x, i) => { hi[P(A[st.k], x)] = hi[P(A[st.k], x)] || (st.W[st.k][i] ? COL.gold : undefined); hi[P(x, A[st.k])] = hi[P(x, A[st.k])] || (st.W[i][st.k] ? COL.gold : undefined); });
      Object.keys(hi).forEach((k) => { if (!hi[k]) delete hi[k]; });
      st.add.forEach(([i, j]) => { cm.R.add(P(A[i], A[j])); hi[P(A[i], A[j])] = COL.new; });
      log(st.msg + '（W[i][j] ← W[i][j] ∨ (W[i][k] ∧ W[k][j])）');
      show(hi, st.msg + '<br>金色 = 第 k 列／第 k 行的 1');
    });
    on('cReset', () => enterClosure(true));
    log('R = {(a,d),(b,a),(b,c),(c,a),(c,d),(d,c)}（課本 Warshall 例）。');
    show();
  }

  // ───────────────────────── 模式 3：等價關係與分割 ─────────────────────────
  const eq = { m: 3, n: 12 };
  function enterEquiv() {
    fresh([0, 10, 8.6], [0, 0, 0.6]);
    controls('<label>同餘 mod <input id="eM" type="number" min="1" max="6" value="' + eq.m + '" style="width:52px"></label><button class="primary" id="eGo">依等價類分堆</button><label>看 [a]：a = <input id="eA" type="number" min="0" max="11" value="5" style="width:52px"></label><button id="eCls">亮出 [a]</button>');
    $('eM').onchange = (e) => { const m = Number(e.target.value); if (!(m >= 1 && m <= 6)) { log('m 請填 1～6', true); e.target.value = eq.m; return; } eq.m = m; enterEquiv(); };
    const S = [...Array(eq.n).keys()];
    const blocks = S.map((x) => cube(x, COL.idle, [0.62, 0.55, 0.62], -5.5 + x * 1, 0.28, -2.6));
    // 12×12 矩陣
    const cs = 0.36, mx = 1.4, mz = -0.6;
    const cells = S.map((a) => S.map((b) => { const one = (a - b) % eq.m === 0; const m = lab.box(one ? CLS[((a % eq.m) + eq.m) % eq.m] : COL.zero, [cs * 0.86, one ? 0.3 : 0.08, cs * 0.86]); m.position.set(mx + b * cs, one ? 0.15 : 0.04, mz + a * cs); lab.world.add(m); return m; }));
    tag('M_R（12×12）', 'ptr alt', mx + 2, 0.3, mz - 0.6);
    const classes = [...Array(eq.m).keys()].map((r) => S.filter((x) => x % eq.m === r));
    setState('a R b ⇔ a ≡ b (mod ' + eq.m + ')，A = {0,…,11}', classes.map((c, r) => ['[' + r + ']', '{' + c.join(',') + '}']),
      '反身 a−a=0、對稱、遞移都成立 → <span class="ok">等價關係</span><br>等價類兩兩不相交、聯集 = A → 一個<b>分割</b>（共 ' + eq.m + ' 塊）');
    on('eGo', () => {
      S.forEach((x) => { const r = x % eq.m, k = classes[r].indexOf(x); blocks[x].material.color.set(CLS[r]); move(blocks[x], -5.6 + r * (eq.m > 1 ? 5.4 / (eq.m - 1) : 0), 0.28 + k * 0.58, 1.6); });
      log('依餘數分堆：每一堆就是一個等價類 [r]。');
    });
    on('eCls', () => {
      const a = Number($('eA').value); if (!(a >= 0 && a <= 11)) { log('a 請填 0～11', true); return; }
      S.forEach((x) => glow(blocks[x], (x - a) % eq.m === 0 ? '#6a4a00' : null));
      cells.forEach((row, i) => row.forEach((m, j) => glow(m, i === a && (i - j) % eq.m === 0 ? '#6a4a00' : null)));
      log('[' + a + '] = {x | x ≡ ' + a + ' (mod ' + eq.m + ')} = {' + classes[a % eq.m].join(',') + '}：就是矩陣第 ' + a + ' 列的 1');
    });
    log('等價關係 ⇔ 分割：每個等價關係切出一個分割，每個分割也定義一個等價關係。');
  }

  // ───────────────────────── 偏序：Hasse 版面 ─────────────────────────
  const divisors = (n) => [...Array(n).keys()].map((i) => i + 1).filter((d) => n % d === 0);
  const POSETS = {
    d12: { name: 'D₁₂（整除）', els: () => divisors(12).map(String), leq: (a, b) => N(b) % N(a) === 0 },
    d24: { name: 'D₂₄（整除）', els: () => divisors(24).map(String), leq: (a, b) => N(b) % N(a) === 0 },
    d30: { name: 'D₃₀（整除）', els: () => divisors(30).map(String), leq: (a, b) => N(b) % N(a) === 0 },
    d36: { name: 'D₃₆（整除）', els: () => divisors(36).map(String), leq: (a, b) => N(b) % N(a) === 0 },
    pset: { name: 'P({a,b,c})（⊆）', els: () => ['∅', 'a', 'b', 'c', 'ab', 'ac', 'bc', 'abc'], leq: (x, y) => x === '∅' || [...x].every((ch) => y.includes(ch)) },
    ex7: { name: '{1,2,3,4,6,8,12}（整除）', els: () => ['1', '2', '3', '4', '6', '8', '12'], leq: (a, b) => N(b) % N(a) === 0 },
    rosen: { name: '{2,4,5,10,12,20,25}（整除）', els: () => ['2', '4', '5', '10', '12', '20', '25'], leq: (a, b) => N(b) % N(a) === 0 },
    nl: { name: '{1,2,3,4,5}（整除）', els: () => ['1', '2', '3', '4', '5'], leq: (a, b) => N(b) % N(a) === 0 },
    chain: { name: '{1,2,3,4}（≤，全序）', els: () => ['1', '2', '3', '4'], leq: (a, b) => N(a) <= N(b) },
  };
  function poInfo(els, leq) {
    const lt = (a, b) => a !== b && leq(a, b);
    const covers = [];
    for (const a of els) for (const b of els) if (lt(a, b) && !els.some((c) => lt(a, c) && lt(c, b))) covers.push([a, b]);
    const rank = {};
    const rk = (x) => { if (rank[x] !== undefined) return rank[x]; const below = covers.filter(([, b]) => b === x).map(([a]) => rk(a)); return (rank[x] = below.length ? 1 + Math.max(...below) : 0); };
    els.forEach(rk);
    const minimal = els.filter((x) => !els.some((y) => lt(y, x))), maximal = els.filter((x) => !els.some((y) => lt(x, y)));
    const least = els.find((x) => els.every((y) => leq(x, y))), greatest = els.find((x) => els.every((y) => leq(y, x)));
    const ub = (a, b) => els.filter((u) => leq(a, u) && leq(b, u)), lb = (a, b) => els.filter((u) => leq(u, a) && leq(u, b));
    const lub = (a, b) => { const U = ub(a, b); return U.find((u) => U.every((v) => leq(u, v))); };
    const glb = (a, b) => { const L = lb(a, b); return L.find((u) => L.every((v) => leq(v, u))); };
    let nonLat = null;
    for (const a of els) for (const b of els) if (!nonLat && (lub(a, b) === undefined || glb(a, b) === undefined)) nonLat = [a, b, lub(a, b) === undefined ? 'lub' : 'glb'];
    return { els, leq, lt, covers, rank, minimal, maximal, least, greatest, ub, lb, lub, glb, nonLat };
  }
  // 豎起來的 Hasse 圖：高度 = rank
  function hassePos(info, ox = 0, sx = 1.6, sy = 1.35, y0 = 0.5) {
    const byR = {}; info.els.forEach((x) => { (byR[info.rank[x]] = byR[info.rank[x]] || []).push(x); });
    const pos = {};
    Object.entries(byR).forEach(([r, xs]) => xs.forEach((x, i) => { pos[x] = V3(ox + (i - (xs.length - 1) / 2) * sx, y0 + N(r) * sy, 0); }));
    return pos;
  }
  function drawPoset(info, pos, size = [0.78, 0.55, 0.55]) {
    const vm = {};
    info.els.forEach((x) => { vm[x] = cube(x, COL.idle, size, pos[x].x, pos[x].y, pos[x].z); });
    return vm;
  }

  // ───────────────────────── 模式 4：偏序與 Hasse 圖 ─────────────────────────
  const hm = { k: 'd12' };
  function enterHasse() {
    const P0 = POSETS[hm.k], info = poInfo(P0.els(), P0.leq);
    const top = Math.max(...Object.values(info.rank));
    fresh([0, 2.4 + top * 0.65, 11.5], [0, 0.6 + top * 0.65, 0]);
    controls('<select id="hP">' + Object.keys(POSETS).map((k) => '<option value="' + k + '">' + POSETS[k].name + '</option>').join('') + '</select>'
      + '<button id="hFull">完整關係圖</button><button id="hLoop">拿掉 loop</button><button id="hTra">拿掉遞移邊</button><button class="primary" id="hHasse">Hasse 圖</button>'
      + '<select id="hA">' + info.els.map((x) => '<option>' + x + '</option>').join('') + '</select><select id="hB">' + info.els.map((x) => '<option>' + x + '</option>').join('') + '</select><button id="hLub">lub / glb</button>');
    $('hP').value = hm.k;
    $('hP').onchange = (e) => { hm.k = e.target.value; enterHasse(); };
    const pos = hassePos(info);
    const vm = drawPoset(info, pos);
    const arcs = new THREE.Group(); lab.world.add(arcs);
    const clearArcs = () => arcs.children.slice().forEach((c) => arcs.remove(c));
    const isCover = (a, b) => info.covers.some(([x, y]) => x === a && y === b);
    const drawRel = (loops, trans, directed) => {
      clearArcs();
      for (const a of info.els) for (const b of info.els) {
        if (!info.leq(a, b)) continue;
        if (a === b) { if (loops) loopMesh(pos[a], COL.edge, arcs, true); continue; }
        if (!trans && !isCover(a, b)) continue;
        arrow(pos[a], pos[b], { parent: arcs, color: isCover(a, b) ? COL.gold : COL.dim, directed, gap: 0.4 });
      }
    };
    const st = () => setState(P0.name + '：偏序集', [['minimal', info.minimal.join(', ')], ['maximal', info.maximal.join(', ')], ['least', info.least ?? '不存在'], ['greatest', info.greatest ?? '不存在'], ['Hasse 邊數（covers）', String(info.covers.length)]],
      info.nonLat ? '<span class="no">不是 lattice</span>：' + info.nonLat[0] + '、' + info.nonLat[1] + ' 的 ' + info.nonLat[2] + ' 不存在' : '<span class="ok">是 lattice</span>：任兩元素都有 lub、glb');
    on('hFull', () => { drawRel(true, true, true); log('完整的有向圖：每個 a ≼ b 都畫一條箭頭（含 loop）。'); });
    on('hLoop', () => { drawRel(false, true, true); log('偏序一定反身 → loop 不用畫。'); });
    on('hTra', () => { drawRel(false, false, true); log('遞移推得出的邊不用畫：只留 cover（中間沒有別的元素）。'); });
    on('hHasse', () => { drawRel(false, false, false); log('箭頭全部朝上 → 箭頭也省略：這就是 Hasse diagram。'); });
    on('hLub', () => {
      const a = $('hA').value, b = $('hB').value;
      if (!info.els.includes(a) || !info.els.includes(b)) { log('先選兩個元素。', true); return; }
      info.els.forEach((x) => { vm[x].material.color.set(COL.idle); glow(vm[x], null); });
      info.ub(a, b).forEach((x) => vm[x].material.color.set('#f2c4c4'));
      info.lb(a, b).forEach((x) => vm[x].material.color.set('#c4dcf2'));
      [a, b].forEach((x) => glow(vm[x], '#6a4a00'));
      const L = info.lub(a, b), G = info.glb(a, b);
      if (L) vm[L].material.color.set(COL.hot); if (G) vm[G].material.color.set(COL.one);
      log('上界 {' + info.ub(a, b).join(',') + '} → lub(' + a + ',' + b + ') = ' + (L ?? '不存在') + '；下界 {' + info.lb(a, b).join(',') + '} → glb = ' + (G ?? '不存在'), !L || !G);
    });
    drawRel(false, false, false);
    st();
    log('偏序：反身＋反對稱＋遞移。Hasse 圖：省略 loop、省略遞移邊、方向一律朝上。');
  }

  // ───────────────────────── 模式 5：拓撲排序 ─────────────────────────
  const tp = { k: 'rosen20', order: [] };
  const TOPO = {
    rosen20: { name: '{1,2,4,5,12,20}（整除）', els: () => ['1', '2', '4', '5', '12', '20'], leq: (a, b) => N(b) % N(a) === 0 },
    d12: POSETS.d12, pset: POSETS.pset,
    tasks: { name: '工作先後（A 要在 B 前）', els: () => ['A', 'B', 'C', 'D', 'E', 'F', 'G'], leq: (a, b) => a === b || ({ A: 'CDEFG', B: 'DEFG', C: 'EG', D: 'FG', E: 'G', F: 'G', G: '' }[a] || '').includes(b) },
  };
  function enterTopo() {
    const T = TOPO[tp.k], info = poInfo(T.els(), T.leq);
    const top = Math.max(...Object.values(info.rank));
    fresh([0, 2.6 + top * 0.6, 11.5], [0, 0.4 + top * 0.6, 0.6]);
    tp.order = [];
    const left = new Set(info.els);
    const minNow = () => [...left].filter((x) => ![...left].some((y) => info.lt(y, x)));
    controls('<select id="tP">' + Object.keys(TOPO).map((k) => '<option value="' + k + '">' + TOPO[k].name + '</option>').join('') + '</select><select id="tM"></select><button class="primary" id="tTake">取出這個 minimal</button><button id="tAuto">自動</button><button id="tReset">重來</button>');
    $('tP').value = tp.k;
    $('tP').onchange = (e) => { tp.k = e.target.value; enterTopo(); };
    const pos = hassePos(info, 0, 1.6, 1.25, 0.5);
    const vm = drawPoset(info, pos);
    const arcs = info.covers.map(([a, b]) => ({ a, b, g: arrow(pos[a], pos[b], { color: COL.gold, directed: false, gap: 0.4 }) }));
    const refresh = () => {
      const mins = minNow();
      $('tM').innerHTML = mins.map((x) => '<option>' + x + '</option>').join('');
      info.els.forEach((x) => { if (left.has(x)) { vm[x].material.color.set(mins.includes(x) ? COL.vis : COL.idle); } });
      setState('拓撲排序（compatible total order）', [['已排', tp.order.join(' ≺ ') || '—'], ['目前 minimal', mins.join(', ') || '—']],
        left.size ? '每次取一個 minimal element（綠色）接到後面' : '<span class="ok">完成</span>：若 a ≼ b，a 一定排在 b 前面');
    };
    const take = (x) => {
      if (!left.has(x)) return;
      if (!minNow().includes(x)) { log(x + ' 不是 minimal：還有比它小的元素沒排。', true); return; }
      left.delete(x); tp.order.push(x);
      move(vm[x], -5.4 + (tp.order.length - 1) * (10.8 / Math.max(1, info.els.length - 1)), 0.3, 3);
      vm[x].material.color.set(COL.one);
      arcs.filter((e) => e.a === x || e.b === x).forEach((e) => { e.g.visible = false; });
      log('取出 ' + x);
      refresh();
    };
    on('tTake', () => take($('tM').value));
    on('tAuto', () => { stopTimer(); timer = setInterval(() => { const m = minNow(); if (!m.length) { stopTimer(); return; } take(m[0]); }, 800); });
    on('tReset', enterTopo);
    log('有限偏序集一定有 minimal element；一直取 minimal，就得到相容的全序。答案通常不唯一。');
    refresh();
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
  function genQ() {
    const r = Math.random();
    if (r < 0.3) {
      const A = ['1', '2', '3'];
      const R = relOf(A, () => Math.random() < 0.45);
      if (Math.random() < 0.4) A.forEach((a) => R.add(P(a, a)));
      const pr = props(A, R);
      const keys = ['ref', 'sym', 'anti', 'tra'], short = { ref: '反身', sym: '對稱', anti: '反對稱', tra: '遞移' };
      const fmt = (bits) => keys.map((k, i) => short[k] + (bits[i] ? '✓' : '✗')).join(' ');
      const truth = keys.map((k) => pr[k].ok);
      const opts = [fmt(truth)];
      for (let i = 0; i < 4 && opts.length < 4; i++) { const b = truth.slice(); b[i] = !b[i]; const s = fmt(b); if (!opts.includes(s)) opts.push(s); }
      const list = [...R].sort().map((k) => '(' + k + ')').join(',');
      return { q: 'A = {1,2,3}，R = {' + list + '}。R 的性質？', opts, ans: opts[0], why: keys.map((k) => short[k] + '：' + pr[k].why).join('；') + '。' };
    }
    if (r < 0.45) {
      const n = 2 + rnd(3), kinds = [['所有關係', Math.pow(2, n * n), '2^(n²)'], ['反身關係', Math.pow(2, n * n - n), '2^(n²−n)：對角線固定是 1'], ['對稱關係', Math.pow(2, n * (n + 1) / 2), '2^(n(n+1)/2)：對角線＋上三角自由選'], ['反對稱關係', Math.pow(2, n) * Math.pow(3, n * (n - 1) / 2), '2ⁿ·3^(n(n−1)/2)：每對 {a,b} 有 3 種（都不選、只 (a,b)、只 (b,a)）']];
      const [nm, v, why] = pick(kinds);
      const opts = [...new Set([v, Math.pow(2, n * n), Math.pow(2, n * n - n), Math.pow(2, n * (n + 1) / 2), Math.pow(2, n) * Math.pow(3, n * (n - 1) / 2), Math.pow(2, n * (n - 1))])].slice(0, 4).map(String);
      if (!opts.includes(String(v))) opts[0] = String(v);
      return { q: '|A| = ' + n + '，A 上共有幾個' + nm + '？', opts, ans: String(v), why: why + ' = ' + v + '。' };
    }
    if (r < 0.55) {
      const n = 3 + rnd(3), B = [1, 1, 2, 5, 15, 52, 203][n];
      return { q: '|A| = ' + n + '，A 上有幾個等價關係？', opts: [String(B), String(Math.pow(2, n)), String(n * (n - 1) / 2 + 1), String([1, 1, 2, 6, 24, 120][n] || 720)], ans: String(B), why: '等價關係 ↔ 分割，個數是 Bell number B' + n + ' = ' + B + '。' };
    }
    if (r < 0.65) {
      const m = 3 + rnd(5), a = rnd(30) - 10;
      const rr = ((a % m) + m) % m;
      const ser = (r0) => [r0, r0 + m, r0 + 2 * m].join(', ') + ', …';
      const cls = ser(rr);
      // 干擾選項：餘數差 1、差 2 的那兩類（m ≥ 3，三類一定不同），以及「只有 a 自己」這個常見錯誤
      return { q: '在 ℤ 上 a R b ⇔ a ≡ b (mod ' + m + ')。[' + a + '] 裡最小的三個非負整數是？', opts: [cls, ser((rr + 1) % m), ser((rr + 2) % m), '只有 ' + a + ' 自己'], ans: cls, why: a + ' 除以 ' + m + ' 餘 ' + rr + '，等價類 = 所有除以 ' + m + ' 餘 ' + rr + ' 的整數。' };
    }
    if (r < 0.78) {
      const n = pick([12, 18, 20, 24, 30, 36]), els = divisors(n).map(String), info = poInfo(els, (x, y) => N(y) % N(x) === 0);
      const a = pick(els.slice(1, -1)), b = pick(els.slice(1, -1).filter((x) => x !== a)) || '1';
      const kind = Math.random() < 0.5 ? 'lub' : 'glb';
      const ans = kind === 'lub' ? info.lub(a, b) : info.glb(a, b);
      return { q: '偏序集 (D' + n + ', |)：' + kind + '(' + a + ', ' + b + ') = ？', opts: [...new Set([ans, String(lcm(N(a), N(b))), String(gcd(N(a), N(b))), String(N(a) * N(b)), String(n), '1'])].slice(0, 4), ans, why: '整除偏序裡 lub = lcm、glb = gcd：lcm = ' + lcm(N(a), N(b)) + '、gcd = ' + gcd(N(a), N(b)) + '。D' + n + ' 是 lattice。' };
    }
    if (r < 0.9) {
      const n = pick([8, 12, 18, 20, 24, 30, 36]), info = poInfo(divisors(n).map(String), (x, y) => N(y) % N(x) === 0);
      const c = info.covers.length;
      return { q: 'D' + n + '（' + n + ' 的正因數，整除）的 Hasse 圖有幾條邊？', opts: [...new Set([c, c + 1, c + 2, Math.max(1, c - 1), divisors(n).length - 1])].slice(0, 4).map(String), ans: String(c), why: 'Hasse 圖只畫 cover：b = a × (一個質數)。共 ' + c + ' 條：' + info.covers.map(([x, y]) => x + '–' + y).join(' ') + '。' };
    }
    const sets = [['2', '4', '5', '10', '12', '20', '25'], ['1', '2', '3', '4', '5'], ['2', '3', '6', '9', '18'], ['3', '5', '6', '10', '15', '30']];
    const els = pick(sets), info = poInfo(els, (x, y) => N(y) % N(x) === 0);
    const k = pick(['maximal', 'minimal']);
    const ans = '{' + info[k].join(',') + '}';
    const other = '{' + info[k === 'maximal' ? 'minimal' : 'maximal'].join(',') + '}';
    return { q: '({' + els.join(',') + '}, |) 的 ' + k + ' elements？', opts: [...new Set([ans, other, '{' + els[0] + '}', '{' + els[els.length - 1] + '}'])].concat(['不存在']).slice(0, 4), ans, why: k + '：' + (k === 'maximal' ? '沒有比它大的' : '沒有比它小的') + '元素（可以不只一個；只有一個且和所有元素可比時才是 ' + (k === 'maximal' ? 'greatest' : 'least') + '）。' };
  }
  // 選項去重；數字題不足 4 個時補上相近的數
  function fixOpts(p) {
    const o = [...new Set(p.opts.map(String))];
    if (!o.includes(p.ans)) o.unshift(p.ans);
    const a = Number(p.ans);
    for (let d = 1; o.length < 4 && Number.isFinite(a) && d < 40; d++) for (const v of [a + d, a - d]) if (o.length < 4 && v >= 0 && !o.includes(String(v))) o.push(String(v));
    return { ...p, opts: o.slice(0, Math.max(4, o.indexOf(p.ans) + 1)) };
  }
  function renderQuiz(el) {
    const p = fixOpts(genQ());
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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

  // ───────────────────────── 場景（課本） ─────────────────────────
  const CAMR = [[0, 9.6, 8.4], [0, 0, 0.4]];
  async function scArrowsMatrix(tok) {
    fresh(...CAMR);
    const v = relView(A4);
    tag('A = {1,2,3,4}', 'ptr', -3.2, 0.3, 3.2); tag('M_R', 'ptr alt', 3.4, 0.3, 2.4);
    say('（課本）二元關係 R ⊆ A × A', '(a,b) ∈ R 也寫成 a R b');
    v.set(new Set()); await beat(tok, 2400);
    const R = new Set(), seq = ['1,1', '1,2', '2,1', '2,2', '3,4', '4,1', '4,4'];
    for (const k of seq) {
      R.add(k); v.set(R, { [k]: COL.gold });
      const [a, b] = k.split(',');
      say(a === b ? '(' + k + ')：自己指自己 = loop' : '(' + k + ')：箭頭 ' + a + ' → ' + b, '矩陣第 ' + a + ' 列第 ' + b + ' 行 = 1');
      await beat(tok, 1300);
    }
    v.set(R);
    say('同一個關係，兩種畫法：箭頭圖 ↔ 0/1 矩陣', '|R| = 7 = 矩陣裡 1 的個數');
    await beat(tok, 3000);
  }
  async function scProp(tok, key) {
    fresh(...CAMR);
    const v = relView(A4);
    const cases = {
      ref: [['le', '≤：每個 a ≤ a → 對角線全是 1', 'Reflexive：∀a，(a,a) ∈ R'], ['lt', '<：沒有 a < a → 一個 loop 都沒有', '反例 (1,1) ∉ R → 不反身（其實是 irreflexive）']],
      sym: [['mod2', 'a ≡ b (mod 2)：有 a→b 就有 b→a', 'Symmetric：矩陣對主對角線鏡射不變'], ['le', '≤：1→2 有、2→1 沒有', '反例 (1,2) ∈ R、(2,1) ∉ R']],
      anti: [['div', '整除：a | b 且 b | a 只可能 a = b', 'Antisymmetric：a≠b 時不會互指'], ['mod2', 'mod 2：1→3 和 3→1 都有', '反例：互指但 1 ≠ 3']],
      tra: [['le', '≤：a ≤ b、b ≤ c ⇒ a ≤ c', 'Transitive：a→b→c 一定有 a→c'], ['ex', '例：3→4、4→1，但 3→1 沒有', '反例：(3,4)、(4,1) ∈ R，(3,1) ∉ R']],
    }[key];
    for (const [pk, cap, f] of cases) {
      const R = PRESETS[pk].R(), pr = props(A4, R)[key];
      v.set(R);
      say('（課本）' + PRESETS[pk].name, PROP_NAMES[key]);
      await beat(tok, 1800);
      if (key === 'ref') { const hi = {}; A4.forEach((a) => { hi[P(a, a)] = R.has(P(a, a)) ? COL.new : COL.hot; }); v.set(R, hi); }
      else if (key === 'sym') {
        const hi = {}; for (const k of R) { const [a, b] = k.split(','); if (a !== b) hi[k] = R.has(P(b, a)) ? COL.new : COL.hot; }
        v.set(R, hi);
      } else if (key === 'anti') {
        const hi = {}; for (const k of R) { const [a, b] = k.split(','); if (a !== b) hi[k] = R.has(P(b, a)) ? COL.hot : COL.new; }
        v.set(R, hi);
      } else {
        const hi = {}; if (!pr.ok) { pr.w.forEach((k) => { hi[k] = COL.gold; }); hi[pr.miss] = COL.hot; } else { ['1,2', '2,4', '1,4'].forEach((k) => { hi[k] = k === '1,4' ? COL.new : COL.gold; }); }
        v.set(R, hi);
      }
      say(cap, (pr.ok ? '✓ ' : '✗ ') + f);
      await beat(tok, 3400);
    }
    if (key === 'anti') { say('注意：反對稱 ≠ 不對稱', '空關係、= 關係 既對稱又反對稱'); await beat(tok, 3000); }
    if (key === 'ref') { say('矩陣看法：主對角線全是 1', '有向圖看法：每個點都有 loop'); await beat(tok, 2600); }
  }
  async function scComposition(tok) {
    fresh([0, 8.6, 9.4], [0, 0.4, 0.6]);
    const A = ['1', '2', '3'];
    const R = new Set(['1,1', '1,2', '2,3']), S = new Set(['1,3', '2,1', '3,2']);
    const pos = (layer, a) => V3(-4.6 + layer * 3, 0.3, -1.6 + (N(a) - 1) * 1.6);
    const vm = [0, 1, 2].map((L) => Object.fromEntries(A.map((a) => [a, cube(a, COL.idle, [0.55, 0.5, 0.55], ...pos(L, a).toArray())])));
    tag('A', 'idx', -4.6, 0.3, -2.6); tag('R →', 'ptr', -3.1, 0.3, -2.6); tag('S →', 'ptr alt', -0.1, 0.3, -2.6);
    say('（課本）合成 S∘R：先走 R、再走 S', 'R = {(1,1),(1,2),(2,3)}，S = {(1,3),(2,1),(3,2)}');
    [...R].forEach((k) => { const [a, b] = k.split(','); arrow(pos(0, a), pos(1, b), { color: COL.one }); });
    [...S].forEach((k) => { const [a, b] = k.split(','); arrow(pos(1, a), pos(2, b), { color: COL.pink }); });
    await beat(tok, 3000);
    const SR = new Set();
    for (const k of R) {
      const [a, b] = k.split(',');
      for (const k2 of S) { const [b2, c] = k2.split(','); if (b2 !== b) continue; SR.add(P(a, c)); arrow(V3(pos(0, a).x, 0.9, pos(0, a).z), V3(pos(2, c).x, 0.9, pos(2, c).z), { color: COL.gold }); say(a + ' →R ' + b + ' →S ' + c + ' ⇒ (' + a + ',' + c + ') ∈ S∘R', ''); await beat(tok, 1600); }
    }
    say('S∘R = {' + [...SR].sort().map((k) => '(' + k + ')').join(',') + '}', '矩陣：M_{S∘R} = M_R ⊙ M_S（Boolean 乘法）');
    await beat(tok, 3200);
    say('Rⁿ = R∘R∘…∘R：走 n 步可到', 'R 遞移 ⇔ Rⁿ ⊆ R（n ≥ 1）');
    await beat(tok, 3000);
  }
  async function scClosureRS(tok) {
    fresh(...CAMR);
    const A = ['1', '2', '3'];
    const v = relView(A, { R: 1.8, cs: 0.9, mx: 2.4, mz: -1 });
    const R = new Set(['1,1', '1,2', '2,3']);
    v.set(R);
    say('（課本）閉包：加「最少」的配對讓性質成立', 'R = {(1,1),(1,2),(2,3)}，A = {1,2,3}');
    await beat(tok, 2800);
    const r1 = new Set(R), hi1 = {}; A.forEach((a) => { if (!r1.has(P(a, a))) { r1.add(P(a, a)); hi1[P(a, a)] = COL.new; } });
    v.set(r1, hi1);
    say('反身閉包 r(R) = R ∪ Δ：補 (2,2)、(3,3)', 'Δ = {(a,a) | a ∈ A}');
    await beat(tok, 3000);
    v.set(R); await beat(tok, 700);
    const s1 = new Set(R), hi2 = {}; [...R].forEach((k) => { const [a, b] = k.split(','); if (!s1.has(P(b, a))) { s1.add(P(b, a)); hi2[P(b, a)] = COL.new; } });
    v.set(s1, hi2);
    say('對稱閉包 s(R) = R ∪ R⁻¹：補 (2,1)、(3,2)', 'R⁻¹ = {(b,a) | (a,b) ∈ R}');
    await beat(tok, 3000);
    v.set(R); await beat(tok, 700);
    const t1 = new Set(R); t1.add('1,3');
    v.set(t1, { '1,3': COL.new });
    say('遞移閉包 t(R) = R ∪ R² ∪ R³ ∪ …：補 (1,3)', '1→2→3 ⇒ 1→3；一般用 Warshall 算');
    await beat(tok, 3400);
  }
  async function scWarshall(tok) {
    fresh(...CAMR);
    const A = WEX.A, R = new Set(WEX.R);
    const v = relView(A);
    v.set(R);
    say('（課本）Warshall：求遞移閉包', 'R = {(a,d),(b,a),(b,c),(c,a),(c,d),(d,c)}');
    await beat(tok, 3000);
    const steps = warshallSteps(A, R);
    const cur = new Set(R);
    for (const st of steps.slice(1)) {
      const hi = {};
      A.forEach((x, i) => { if (st.W[st.k][i]) hi[P(A[st.k], x)] = COL.gold; if (st.W[i][st.k]) hi[P(x, A[st.k])] = COL.gold; });
      v.set(cur, hi);
      say('k = ' + A[st.k] + '：看第 ' + A[st.k] + ' 列和第 ' + A[st.k] + ' 行', 'W[i][j] ← W[i][j] ∨ (W[i][k] ∧ W[k][j])');
      await beat(tok, 2200);
      st.add.forEach(([i, j]) => { cur.add(P(A[i], A[j])); hi[P(A[i], A[j])] = COL.new; });
      v.set(cur, hi);
      say(st.msg, '經過 ' + A[st.k] + ' 能到的 → 補成直達');
      await beat(tok, 2400);
    }
    v.set(cur);
    say('W₄ = 遞移閉包：b 那一行全是 0（沒有人到得了 b）', '時間 O(n³)；比算 R ∪ R² ∪ … ∪ Rⁿ 快');
    await beat(tok, 3400);
  }
  async function scEquivMod(tok) {
    fresh([0, 9.5, 8.6], [0, 0.6, 0.4]);
    const S = [...Array(12).keys()];
    const blocks = S.map((x) => cube(x, COL.idle, [0.6, 0.55, 0.6], -5.5 + x, 0.28, -2.4, 2));
    say('（課本）ℤ 上 a R b ⇔ a ≡ b (mod 3)', '3 | (a − b)');
    await beat(tok, 2600);
    say('反身：a − a = 0；對稱：3|(a−b) ⇒ 3|(b−a)', '遞移：(a−b)+(b−c) = a−c');
    await beat(tok, 3000);
    for (const x of S) { const r = x % 3, k = Math.floor(x / 3); blocks[x].material.color.set(CLS[r]); move(blocks[x], -3.4 + r * 3.4, 0.28 + k * 0.58, 1.2); await beat(tok, 220); }
    ['[0]', '[1]', '[2]'].forEach((s, r) => tag(s, 'ptr alt', -3.4 + r * 3.4, 0.3, 2.3));
    say('三個等價類：[0]、[1]、[2]', '[a] = {x | x R a}；同類的元素彼此等價');
    await beat(tok, 3000);
    say('等價類兩兩不相交、聯集是全部 → 一個分割', '[0] ∩ [1] = ∅，[0] ∪ [1] ∪ [2] = ℤ');
    await beat(tok, 3200);
  }
  async function scEquivPartition(tok) {
    fresh([0, 9, 9], [0, 0.4, 0.6]);
    const A = ['1', '2', '3', '4', '5', '6'], parts = [['1', '2', '3'], ['4', '5'], ['6']];
    const cls = (x) => parts.findIndex((p) => p.includes(x));
    const blocks = A.map((x, i) => cube(x, CLS[cls(x)], [0.6, 0.55, 0.6], -5 + (i % 3) * 0.9, 0.28, -1.2 + Math.floor(i / 3) * 1.2));
    say('（課本）分割 {1,2,3} | {4,5} | {6}', '→ 定義 a R b ⇔ a、b 在同一塊');
    parts.forEach((p, r) => p.forEach((x, k) => move(blocks[N(x) - 1], -5.2 + r * 1.3, 0.28 + k * 0.58, 1.6)));
    await beat(tok, 2600);
    const cs = 0.62, mx = 0.4, mz = -1.6;
    A.forEach((a, i) => { tag(a, 'idx', mx - cs, 0.1, mz + i * cs); tag(a, 'idx', mx + i * cs, 0.1, mz - cs); });
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) { const one = cls(A[i]) === cls(A[j]); cube(one ? '1' : '', one ? CLS[cls(A[i])] : '#efe5d3', [cs * 0.86, one ? 0.36 : 0.1, cs * 0.86], mx + j * cs, one ? 0.18 : 0.05, mz + i * cs, one ? 1.5 : 0); }
      await beat(tok, 380);
    }
    say('矩陣變成對角線上的實心方塊', '方塊大小 3×3、2×2、1×1：|R| = 9 + 4 + 1 = 14');
    await beat(tok, 3200);
    say('等價關係 ↔ 分割：一一對應', '所以 n 元素集合的等價關係數 = Bell number（n = 3 有 5 個）');
    await beat(tok, 3400);
  }
  async function scPosetDiv(tok) {
    fresh(...CAMR);
    const A = ['1', '2', '3', '4'];
    const v = relView(A);
    const R = PRESETS.div.R();
    v.set(R);
    say('（課本）整除 | 在 {1,2,3,4} 上', '');
    await beat(tok, 2000);
    const pr = props(A, R);
    const hiRef = {}; A.forEach((a) => { hiRef[P(a, a)] = COL.new; }); v.set(R, hiRef);
    say('反身：a | a', pr.ref.ok ? '✓' : '✗'); await beat(tok, 1800);
    const hiA = {}; for (const k of R) { const [a, b] = k.split(','); if (a !== b) hiA[k] = COL.gold; } v.set(R, hiA);
    say('反對稱：a | b 且 b | a ⇒ a = b（正整數）', '沒有雙向箭頭 ✓'); await beat(tok, 2400);
    v.set(R, { '1,2': COL.gold, '2,4': COL.gold, '1,4': COL.new });
    say('遞移：1 | 2、2 | 4 ⇒ 1 | 4', '✓'); await beat(tok, 2200);
    v.set(R);
    say('三個都成立 → 偏序（partial order），(A, |) 是 poset', '記作 a ≼ b');
    await beat(tok, 2400);
    v.set(R, { '2,3': COL.hot, '3,2': COL.hot });
    say('2 ∤ 3、3 ∤ 2：2 和 3 incomparable（不可比）', '所以叫「偏」序；≤ 任兩數都可比 → 全序（total order）');
    await beat(tok, 3600);
  }
  async function scHasseBuild(tok) {
    const P0 = POSETS.ex7, info = poInfo(P0.els(), P0.leq);
    fresh([0, 4.4, 11.5], [0, 2.6, 0]);
    const pos = hassePos(info);
    drawPoset(info, pos);
    const arcs = new THREE.Group(); lab.world.add(arcs);
    const isCover = (a, b) => info.covers.some(([x, y]) => x === a && y === b);
    const draw = (loops, trans, dir, hiNon) => {
      arcs.children.slice().forEach((c) => arcs.remove(c));
      for (const a of info.els) for (const b of info.els) {
        if (!info.leq(a, b)) continue;
        if (a === b) { if (loops) loopMesh(pos[a], COL.edge, arcs, true); continue; }
        if (!trans && !isCover(a, b)) continue;
        arrow(pos[a], pos[b], { parent: arcs, color: isCover(a, b) ? COL.gold : hiNon ? COL.hot : COL.edge, directed: dir, gap: 0.4 });
      }
    };
    say('（課本）({1,2,3,4,6,8,12}, |) 的 Hasse 圖', '先畫出完整的有向圖');
    draw(true, true, true, false);
    await beat(tok, 3200);
    draw(false, true, true, false);
    say('第 1 步：偏序一定反身 → 拿掉所有 loop', '');
    await beat(tok, 2600);
    draw(false, true, true, true);
    say('第 2 步：紅色的邊可由遞移推出', '例：1→2→4 已經有，1→4 不用畫');
    await beat(tok, 3000);
    draw(false, false, true, false);
    say('只留 cover：a ≺ b 且中間沒有 c', '例：4 ⋖ 8、4 ⋖ 12、6 ⋖ 12');
    await beat(tok, 2800);
    draw(false, false, false, false);
    say('第 3 步：箭頭全朝上 → 箭頭也省略', '這就是 Hasse diagram（' + info.covers.length + ' 條邊）');
    await beat(tok, 3400);
  }
  async function scExtremal(tok) {
    const P0 = POSETS.rosen, info = poInfo(P0.els(), P0.leq);
    fresh([0, 3.6, 11], [0, 1.9, 0]);
    const pos = hassePos(info, 0, 2);
    const vm = drawPoset(info, pos);
    info.covers.forEach(([a, b]) => arrow(pos[a], pos[b], { color: COL.gold, directed: false, gap: 0.4 }));
    say('（課本）({2,4,5,10,12,20,25}, |)', '');
    await beat(tok, 2400);
    info.maximal.forEach((x) => vm[x].material.color.set(COL.hot));
    say('maximal：上面沒有更大的 → 12、20、25', '可以不只一個');
    await beat(tok, 3000);
    info.minimal.forEach((x) => vm[x].material.color.set(COL.one));
    say('minimal：下面沒有更小的 → 2、5', '');
    await beat(tok, 2600);
    say('greatest / least：和每個元素都可比的最大／最小', '這裡兩個都不存在（maximal 有 3 個）');
    await beat(tok, 3200);
    lab.clear();
    const Q = POSETS.d12, qi = poInfo(Q.els(), Q.leq), qp = hassePos(qi, 0, 2);
    const qm = drawPoset(qi, qp);
    qi.covers.forEach(([a, b]) => arrow(qp[a], qp[b], { color: COL.gold, directed: false, gap: 0.4 }));
    qm['12'].material.color.set(COL.hot); qm['1'].material.color.set(COL.one);
    say('D₁₂：12 是 greatest、1 是 least', 'greatest 存在時一定唯一，也是唯一的 maximal');
    await beat(tok, 3400);
  }
  async function scLattice(tok) {
    const Q = POSETS.d12, qi = poInfo(Q.els(), Q.leq);
    fresh([0, 3.6, 11], [0, 1.9, 0]);
    const qp = hassePos(qi, -2.6, 1.8);
    const qm = drawPoset(qi, qp);
    qi.covers.forEach(([a, b]) => arrow(qp[a], qp[b], { color: COL.gold, directed: false, gap: 0.4 }));
    say('（課本）D₁₂：4 和 6 的上界、下界', '');
    await beat(tok, 2000);
    qi.ub('4', '6').forEach((x) => qm[x].material.color.set('#f2c4c4'));
    qm['12'].material.color.set(COL.hot);
    say('上界只有 12 → lub(4,6) = 12 = lcm', 'least upper bound');
    await beat(tok, 2600);
    qi.lb('4', '6').forEach((x) => qm[x].material.color.set('#c4dcf2'));
    qm['2'].material.color.set(COL.one);
    say('下界 1、2 → glb(4,6) = 2 = gcd', 'greatest lower bound');
    await beat(tok, 2600);
    say('任兩元素都有 lub、glb → lattice', '(Dₙ, |) 一定是 lattice');
    await beat(tok, 2400);
    const N0 = POSETS.nl, ni = poInfo(N0.els(), N0.leq), np = hassePos(ni, 3.6, 1.2);
    const nm = drawPoset(ni, np, [0.6, 0.5, 0.5]);
    ni.covers.forEach(([a, b]) => arrow(np[a], np[b], { color: COL.gold, directed: false, gap: 0.36 }));
    say('對照：({1,2,3,4,5}, |)', '');
    await beat(tok, 2000);
    nm['2'].material.color.set(COL.hot); nm['3'].material.color.set(COL.hot);
    say('2 和 3 沒有共同上界 → lub(2,3) 不存在', '<span class="no">不是 lattice</span>');
    await beat(tok, 3400);
  }
  async function scTopo(tok) {
    const T = TOPO.rosen20, info = poInfo(T.els(), T.leq);
    fresh([0, 3.4, 11.5], [0, 1.6, 0.6]);
    const pos = hassePos(info, 0, 1.8, 1.25);
    const vm = drawPoset(info, pos);
    const arcs = info.covers.map(([a, b]) => ({ a, b, g: arrow(pos[a], pos[b], { color: COL.gold, directed: false, gap: 0.4 }) }));
    say('（課本）拓撲排序 ({1,2,4,5,12,20}, |)', '找一個全序，和原本的偏序相容');
    await beat(tok, 2800);
    const left = new Set(info.els), order = [];
    const choose = ['1', '5', '2', '4', '20', '12'];
    for (const x of choose) {
      const mins = [...left].filter((y) => ![...left].some((z) => info.lt(z, y)));
      mins.forEach((m) => vm[m].material.color.set(COL.vis));
      say('目前 minimal：' + mins.join('、'), '挑 ' + x + ' 接到後面');
      await beat(tok, 1600);
      left.delete(x); order.push(x);
      move(vm[x], -5 + (order.length - 1) * 2, 0.3, 3);
      vm[x].material.color.set(COL.one);
      arcs.filter((e) => e.a === x || e.b === x).forEach((e) => { e.g.visible = false; });
      await beat(tok, 900);
    }
    say('1 ≺ 5 ≺ 2 ≺ 4 ≺ 20 ≺ 12', 'minimal 不只一個時可任選 → 拓撲排序不唯一');
    await beat(tok, 3600);
  }

  const scenes = {
    'rel-arrows-matrix': { title: '（課本）關係 = 箭頭圖 = 0/1 矩陣', play: scArrowsMatrix },
    'rel-reflexive': { title: '（課本）Reflexive：對角線全是 1', play: (t) => scProp(t, 'ref') },
    'rel-symmetric': { title: '（課本）Symmetric：矩陣鏡射對稱', play: (t) => scProp(t, 'sym') },
    'rel-antisymmetric': { title: '（課本）Antisymmetric：不會互指', play: (t) => scProp(t, 'anti') },
    'rel-transitive': { title: '（課本）Transitive：a→b→c 就有 a→c', play: (t) => scProp(t, 'tra') },
    'rel-composition': { title: '（課本）合成 S∘R', play: scComposition },
    'closure-rs': { title: '（課本）反身、對稱、遞移閉包', play: scClosureRS },
    'warshall': { title: '（課本）Warshall 求遞移閉包', play: scWarshall },
    'equiv-mod3': { title: '（課本）mod 3 同餘：三個等價類', play: scEquivMod },
    'equiv-partition': { title: '（課本）等價關係 ↔ 分割', play: scEquivPartition },
    'poset-divides': { title: '（課本）整除是偏序；incomparable', play: scPosetDiv },
    'hasse-build': { title: '（課本）畫 Hasse 圖：拿掉 loop 與遞移邊', play: scHasseBuild },
    'extremal': { title: '（課本）maximal / minimal / greatest / least', play: scExtremal },
    'lattice': { title: '（課本）lub、glb 與 lattice', play: scLattice },
    'topo-sort': { title: '（課本）拓撲排序', play: scTopo },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ reA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, showL } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 9 章（清大 趙啟超 第6A–8B講 Relations）— cued scenes ───
// 每個 step 對應老師說的一句話。所有集合、ordered pair、矩陣、Hasse 圖的 cover 邊、
// equivalence class、partition 個數、partial order 個數（19）、maximal／minimal／greatest／least、
// lub／glb 都由程式在畫面上的例子算出來（能列舉的就暴力列舉驗算），畫面顯示 ✓／✘。
// 老師沒有給具體數字的地方用自己挑的小例子，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const ck = (b) => (b ? ' ✓' : ' ✘');
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const left = (l) => { if (l.center) l.center.set(0, 0.5); return l; };
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
const TC = { node: '#cdbfa6', edge: '#9c8b70', faint: '#e4dccd', a: '#4b9ee2', b: '#e55a9b', hot: '#d64545', gold: '#c08a1f', green: '#2fc092', yel: '#e9c53a', purple: '#9b7ef4', orange: '#dd8238', teal: '#31aab0', zero: '#efe5d3', one: '#4b9ee2' };
const BLK = [TC.a, TC.b, TC.green, TC.orange, TC.purple, TC.teal, TC.gold, '#5c7a4a'];
// a scene = a list of step functions; each runs when the video reaches its cue.
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a column of text lines that appear one by one (left-aligned)
// (max: keep only the last `max` lines — older ones scroll off the top)
function board(x, y, dy = 0.58, max = 99) {
  const B = { ls: [], y };
  B.add = (t, cls = '') => {
    if (B.ls.length >= max) { remove(B.ls.shift()); B.ls.forEach((l) => { l.position.y += dy; }); B.y += dy; }
    const l = left(tag(t, cls, x, B.y)); B.ls.push(l); B.y -= dy; return l;
  };
  B.gap = (k = 0.5) => { B.y -= dy * k; };
  B.clear = () => { gone(B.ls); B.ls = []; B.y = y; };
  return B;
}

// ── 3D 小零件（畫在畫面平面上） ──
const NG = new THREE.SphereGeometry(0.3, 18, 12);
const CG = new THREE.CylinderGeometry(1, 1, 1, 8);
function seg(x1, y1, x2, y2, c = TC.edge, r = 0.05, z = -0.03) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.max(0.02, Math.hypot(dx, dy));
  const m = new THREE.Mesh(CG, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  m.scale.set(r, L, r); m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z); m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
  lab.world.add(m); return m;
}
function dot(name, x, y, c = TC.node, s = 1) {
  const m = new THREE.Mesh(NG, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  m.scale.setScalar(s); m.position.set(x, y, 0); lab.world.add(m);
  if (name !== null && name !== undefined) { m.userData.lbl = lab.label(String(name), 'val'); m.add(m.userData.lbl); }
  return m;
}
const paint = (m, c, gl) => { m.material.color.set(c); glow(m, gl || '#000000'); };
// directed arrow between two points in the plane (stops short of the dots)
function darr(p, q, c = TC.edge, gap = 0.36) {
  const a = V3(p[0], p[1], 0.02), b = V3(q[0], q[1], 0.02), d = b.clone().sub(a), L = d.length(); d.normalize();
  return arrow(a.clone().addScaledVector(d, gap), b.clone().addScaledVector(d, -gap), c);
}
function loopAt(p, c = TC.edge) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 24), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  m.position.set(p[0], p[1] + 0.48, 0); lab.world.add(m); return m;
}
function blob(x, y, rx, ry, c, op = 0.22, rot = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
  m.scale.set(rx, ry, 1); m.position.set(x, y, -0.2); m.rotation.z = rot; lab.world.add(m); return m;
}
// a 0/1 matrix: rows rl, cols cl, value f(i,j); top-left cell at (x, y)
function mat01(rl, cl, f, x, y, cs = 0.62) {
  const M = { cells: [], ex: [] };
  rl.forEach((r, i) => M.ex.push(sm(String(r), x - cs * 0.9, y - i * cs)));
  cl.forEach((c, j) => M.ex.push(sm(String(c), x + j * cs, y + cs * 0.8)));
  rl.forEach((r, i) => { M.cells[i] = []; cl.forEach((c, j) => { const v = f ? f(i, j) : null; M.cells[i][j] = cube(v == null ? ' ' : String(v), v === 1 ? TC.one : TC.zero, [cs * 0.86, cs * 0.86, 0.08], x + j * cs, y - i * cs, 0); }); });
  M.set = (i, j, v) => { const m = M.cells[i][j]; if (m.userData.lbl) txt(m.userData.lbl, String(v)); m.material.color.set(v === 1 ? TC.one : TC.zero); };
  M.all = () => [...M.ex, ...M.cells.flat()];
  return M;
}
// Hasse diagram: pos = {name: [x, y]}, covers = [[a, b], …] (a below b)
function hasse(pos, covers, o = {}) {
  const H = { V: {}, E: {}, P: pos, ex: [] };
  for (const n of Object.keys(pos)) H.V[n] = dot(o.nm ? o.nm(n) : n, pos[n][0], pos[n][1], TC.node, o.s || 1);
  for (const [a, b] of covers) H.E[a + '|' + b] = seg(pos[a][0], pos[a][1], pos[b][0], pos[b][1], o.c || TC.edge, o.r || 0.05);
  H.all = () => [...Object.values(H.V), ...Object.values(H.E), ...H.ex];
  return H;
}

// ── 關係的計算（都在畫面上的例子上算） ──
const PR = (a, b) => a + ',' + b;
const relOf = (A, f) => new Set(A.flatMap((a) => A.filter((b) => f(a, b)).map((b) => PR(a, b))));
const pairs = (R) => [...R].map((k) => k.split(','));
const showPairs = (R) => pairs(R).map(([a, b]) => '(' + a + ',' + b + ')').join(' ');
function propsOf(A, R) {
  const h = (a, b) => R.has(PR(a, b));
  const ref = A.every((a) => h(a, a));
  const sym = A.every((a) => A.every((b) => !h(a, b) || h(b, a)));
  const anti = A.every((a) => A.every((b) => a === b || !(h(a, b) && h(b, a))));
  const tra = A.every((a) => A.every((b) => A.every((c) => !(h(a, b) && h(b, c)) || h(a, c))));
  const tot = A.every((a) => A.every((b) => h(a, b) || h(b, a)));
  return { ref, sym, anti, tra, tot, eq: ref && sym && tra, po: ref && anti && tra };
}
function allRelations(A) {   // every subset of A×A
  const U = A.flatMap((a) => A.map((b) => PR(a, b))), out = [];
  for (let m = 0; m < (1 << U.length); m++) out.push(new Set(U.filter((_, k) => (m >> k) & 1)));
  return out;
}
// bitmask versions (fast brute force over all 2^(n²) relations): bit i·n+j ⇔ (i, j) ∈ R
const bitR = (m, n, i, j) => (m >> (i * n + j)) & 1;
function isEqB(m, n) {
  for (let i = 0; i < n; i++) if (!bitR(m, n, i, i)) return false;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (bitR(m, n, i, j) && !bitR(m, n, j, i)) return false;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (bitR(m, n, i, j)) for (let k = 0; k < n; k++) if (bitR(m, n, j, k) && !bitR(m, n, i, k)) return false;
  return true;
}
function isPoB(m, n) {
  for (let i = 0; i < n; i++) if (!bitR(m, n, i, i)) return false;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && bitR(m, n, i, j) && bitR(m, n, j, i)) return false;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (bitR(m, n, i, j)) for (let k = 0; k < n; k++) if (bitR(m, n, j, k) && !bitR(m, n, i, k)) return false;
  return true;
}
const isTotB = (m, n) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!bitR(m, n, i, j) && !bitR(m, n, j, i)) return false; return true; };
function countRelB(n, test) { let c = 0; for (let m = 0; m < (1 << (n * n)); m++) if (test(m, n)) c++; return c; }
function setPartitions(arr) {
  if (!arr.length) return [[]];
  const [x, ...rest] = arr, out = [];
  for (const p of setPartitions(rest)) {
    out.push([[x], ...p]);
    p.forEach((_, i) => out.push(p.map((b, j) => (j === i ? [x, ...b] : b))));
  }
  return out;
}
function coversOf(A, le) {   // a ⋖ b : a ≺ b with nothing strictly between
  const lt = (a, b) => a !== b && le(a, b);
  return A.flatMap((a) => A.filter((b) => lt(a, b) && !A.some((c) => lt(a, c) && lt(c, b))).map((b) => [a, b]));
}
const maximalOf = (A, le) => A.filter((x) => !A.some((a) => a !== x && le(x, a)));
const minimalOf = (A, le) => A.filter((x) => !A.some((a) => a !== x && le(a, x)));
const greatestOf = (A, le) => A.filter((x) => A.every((a) => le(a, x)));
const leastOf = (A, le) => A.filter((x) => A.every((a) => le(x, a)));
const divs = (a, b) => b % a === 0;
const md = (x, n) => ((x % n) + n) % n;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => a / gcd(a, b) * b;
const setStr = (xs) => '{' + xs.join(', ') + '}';
const none = (xs) => (xs.length ? setStr(xs) : '沒有');

// ════════ PedAKD8Ybkk（趙啟超 6A：binary relation、Cartesian product、矩陣、digraph、equivalence relation 定義） ════════
const A3 = ['1', '2', '3'], BXY = ['x', 'y'];
const R6 = [['1', 'x'], ['1', 'y'], ['2', 'x'], ['3', 'y']];          // 老師的例子
const R6S = new Set(R6.map(([a, b]) => PR(a, b)));
const AXB = A3.flatMap((a) => BXY.map((b) => [a, b]));
const R6_SUB = R6.every(([a, b]) => AXB.some(([c, d]) => c === a && d === b));
const A4 = ['1', '2', '3', '4'];
const DIV4 = relOf(A4, (a, b) => divs(+a, +b));
const DIV4_LIST = A4.flatMap((a) => A4.filter((b) => divs(+a, +b)).map((b) => [a, b]));
const DIV4_P = propsOf(A4, DIV4);
const pS = ([a, b]) => '(' + a + ',' + b + ')';
// 左邊：A 與 B 兩個集合
function setsAB(S) {
  S.bA = blob(-5.2, 3.6, 1.0, 1.9, TC.a, 0.18); S.tA = hd('A', -5.2, 6.0);
  S.vA = {}; A3.forEach((a, i) => { S.vA[a] = dot(a, -5.2, 5.0 - i * 1.4); });
}
function setB(S) {
  S.bB = blob(-1.8, 3.6, 1.0, 1.6, TC.b, 0.18); S.tB = hd('B', -1.8, 6.0);
  S.vB = {}; BXY.forEach((b, i) => { S.vB[b] = dot(b, -1.8, 4.4 - i * 1.6); });
}

scene('reA-6a-pair', '6A：例子——A、B 兩個集合與 ordered pair', [
  async (tok, S) => { // @4.3
    S.h = hd('binary relation（二元關係）', 0, 6.8); cap('開始教 relation', '今天講 binary relation');
  },
  async (tok, S) => { // @7.2
    setsAB(S); cap('A = {1, 2, 3}', '');
  },
  async (tok, S) => { // @8.0
    setB(S); cap('B = {x, y}', '兩個 symbol');
  },
  async (tok, S) => { // @9.6
    S.B = board(0.6, 5.6); S.r = S.B.add('R = {' + R6.map(pS).join(', ') + '}', 'ptr alt'); cap('考慮這個集合 R', '');
  },
  async (tok, S) => { // @64.0
    S.B.add('R 裡有 ' + R6.length + ' 個 ordered pair（有序對）'); cap('R 有四個 ordered pair', '');
  },
  async (tok, S) => { // @72.4
    S.B.add('(1, x) ≠ (x, 1)：前後順序有關係', 'bad'); cap('ordered：順序有關係', '前後對調就不一樣');
  },
  async (tok, S) => { // @79.4
    S.arr = R6.map(([a, b], k) => darr(S.vA[a].position.toArray(), S.vB[b].position.toArray(), BLK[k], 0.34));
    S.B.add('前面一定來自 A，後面一定來自 B'); cap('前面從 A、後面從 B', '每條箭頭 = 一個 pair');
  },
  async (tok, S) => { // @97.4
    S.B.add('R 定義了 A、B 元素之間的一個 relation', 'good'); cap('R 就是一個 relation', '');
  },
  async (tok, S) => { // @106.3
    S.B.gap(0.3); S.B.add('Cartesian product：A × B', 'ptr'); cap('先定義 Cartesian product', 'A × B');
  },
  async (tok, S) => { // @131.6
    S.B.add('A × B = 所有 (a, b)，a ∈ A、b ∈ B');
    S.g = AXB.map(([a, b], k) => pl(pS([a, b]), 1.2 + (k % 2) * 1.7, S.B.y - 0.1 - Math.floor(k / 2) * 0.55));
    cap('所有前面在 A、後面在 B 的 pair', '');
  },
]);

scene('reA-6a-subset', '6A：relation = Cartesian product 的 subset', [
  async (tok, S) => { // @160.8
    S.g = {}; AXB.forEach(([a, b], k) => { S.g[PR(a, b)] = pl(pS([a, b]), -5.4 + (k % 2) * 1.9, 5.2 - Math.floor(k / 2) * 0.8); });
    S.t = hd('A × B', -4.5, 6.2); S.B = board(0.2, 6.3);
    S.B.add('relation 的定義（binary relation）', 'ptr'); cap('什麼叫 relation', '');
  },
  async (tok, S) => { // @171.6
    S.B.add('R 是「從 A 到 B」的 relation'); cap('R：從 A 到 B', '');
  },
  async (tok, S) => { // @183.1
    S.B.add('A × B 的任何一個 subset 都定義一個 relation', 'ptr alt'); cap('R ⊆ A × B', '任何 subset 都是 relation');
  },
  async (tok, S) => { // @198.7
    S.B.add('|A × B| = ' + A3.length + ' × ' + BXY.length + ' = ' + AXB.length + ck(AXB.length === 6)); cap('A × B 一共有 6 個 ordered pair', '3 × 2');
  },
  async (tok, S) => { // @214.1
    R6.forEach(([a, b]) => setCls(S.g[PR(a, b)], 'good'));
    S.B.add('R 只有其中 ' + R6.length + ' 個 → R ⊆ A × B' + ck(R6_SUB), 'good'); cap('R 是 A × B 的 subset', '所以 R 是 relation');
  },
  async (tok, S) => { // @225.7
    R6.forEach(([a, b]) => setCls(S.g[PR(a, b)], ''));
    [['2', 'y'], ['3', 'x']].forEach(([a, b]) => setCls(S.g[PR(a, b)], 'ptr alt'));
    S.n = note('示意：隨便挑 {(2,y), (3,x)} 也是一個 relation', -3.6, 2.7);
    S.B.add('任意挑一部分 → 都是 relation（共 2^' + AXB.length + ' = ' + (1 << AXB.length) + ' 個）'); cap('隨便挑一部分都是 relation', '有沒有意思看包含哪些');
  },
  async (tok, S) => { // @261.7
    gone(Object.values(S.g), S.t, S.n); S.g = {};
    A3.forEach((a, i) => A3.forEach((b, j) => { S.g[PR(a, b)] = pl(pS([a, b]), -6.0 + j * 1.6, 5.2 - i * 0.8); }));
    S.t = hd('A × A', -4.4, 6.2);
    S.B.gap(0.3); S.B.add('只有一個集合 A：A × A 的 subset = A 上的 relation', 'ptr'); cap('一個集合 A 上的 relation', 'A × A 的 subset');
  },
  async (tok, S) => { // @302.6
    S.B.add('A × A 簡寫成 A²（這裡 |A²| = ' + A3.length ** 2 + '）'); cap('A × A 寫成 A²', '');
  },
  async (tok, S) => { // @321.1
    S.B.add('A³ = A × A × A：ordered triple (a₁, a₂, a₃)，共 ' + A3.length ** 3 + ' 個'); cap('三個做 Cartesian product：A³', '順序一樣有關係');
  },
  async (tok, S) => { // @378.0
    S.B.add('後面幾乎都是：一個集合 A 裡兩個 element 的關係', 'good'); cap('後面都看一個集合上的 relation', '');
  },
]);

// 4×4 的 A × A，每格一個 ordered pair
function grid44(S, x0 = -6.2, y0 = 5.4) {
  S.g = {}; A4.forEach((a, i) => A4.forEach((b, j) => { S.g[PR(a, b)] = pl(pS([a, b]), x0 + j * 1.45, y0 - i * 0.8); }));   // 亮起來的 pair 標籤比較寬：間距要夠，才不會互相擠開
}
function markRow(S, a) {
  const hits = A4.filter((b) => divs(+a, +b));
  A4.forEach((b) => setCls(S.g[PR(a, b)], divs(+a, +b) ? 'good' : 'bad'));
  return hits;
}

scene('reA-6a-div', '6A：例子——{1,2,3,4} 上的整除關係', [
  async (tok, S) => { // @400.0
    grid44(S); S.t = hd('A = {1, 2, 3, 4}；A × A 有 ' + A4.length ** 2 + ' 個 pair', -4.3, 6.4); S.B = board(0.2, 6.0);
    cap('舉個例子：A = {1, 2, 3, 4}', '');
  },
  async (tok, S) => { // @429.0
    S.B.add('R = {(a₁, a₂) ∈ A² : a₁ | a₂}', 'ptr alt'); cap('條件：a₁ 整除 a₂', 'a₁、a₂ 都在 A 裡');
  },
  async (tok, S) => { // @442.5
    S.B.add('a₁ | a₂：a₁ 是 a₂ 的因數（a₁ divides a₂）'); cap('a₁ 是 a₂ 的因數', '');
  },
  async (tok, S) => { // @455.4
    S.B.add('把 R 裡的 ordered pair 全部列出來：'); cap('把 ordered pair 一個一個列出來', '');
  },
  async (tok, S) => { // @469.5
    const h = markRow(S, '1'); S.B.add('1 開頭：' + h.map((b) => pS(['1', b])).join(' ') + '（1 整除每個數）'); cap('1 開頭：四個都可以', '');
  },
  async (tok, S) => { // @500.4
    const h = markRow(S, '2'); S.B.add('2 開頭：' + h.map((b) => pS(['2', b])).join(' ') + '（2∤1、2∤3）'); cap('2 開頭：(2,2)、(2,4)', '');
  },
  async (tok, S) => { // @514.7
    const h = markRow(S, '3'); S.B.add('3 開頭：' + h.map((b) => pS(['3', b])).join(' ')); cap('3 開頭：只有 (3,3)', '');
  },
  async (tok, S) => { // @532.4
    const h = markRow(S, '4'); S.B.add('4 開頭：' + h.map((b) => pS(['4', b])).join(' ')); cap('4 開頭：只有 (4,4)', '');
  },
  async (tok, S) => { // @545.6
    A4.forEach((a) => A4.forEach((b) => { if (!divs(+a, +b)) setCls(S.g[PR(a, b)], 'idx'); }));
    S.B.add('R = {' + DIV4_LIST.map(pS).join(' ') + '}，共 ' + DIV4.size + ' 個' + ck(DIV4.size === 8), 'good'); cap('這就是 A² 的一個 subset', '共 8 個 ordered pair');
  },
  async (tok, S) => { // @553.1
    S.B.add('意思：前面是後面的因數。任何 A² 的 subset 都是 relation，這個比較有意思'); cap('有些 relation 比較有意思', '');
  },
]);

scene('reA-6a-matrix', '6A：表示 relation——列出 pair、zero-one matrix', [
  async (tok, S) => { // @586.0
    S.B = board(0.2, 6.3); S.B.add('表示法 1：把所有 ordered pair 列出來', 'ptr');
    S.B.add('R = {' + R6.map(pS).join(', ') + '}'); cap('怎麼表示一個 relation？', '第一種：全部列出來');
  },
  async (tok, S) => { // @608.5
    S.B.gap(0.3); S.B.add('表示法 2：用一個矩陣', 'ptr'); cap('第二種：用矩陣表示', '');
  },
  async (tok, S) => { // @617.1
    S.B.add('A 到 B，|A| = m、|B| = n → m × n 的 zero-one matrix'); cap('m × n 的 0-1 矩陣', 'relation matrix');
  },
  async (tok, S) => { // @628.7
    S.B.add('(a, b) ∈ R 的位置寫 1，不在就寫 0', 'ptr alt'); cap('在 R 裡寫 1，不在寫 0', '');
  },
  async (tok, S) => { // @638.4
    S.B.add('例：A = {1,2,3}、B = {x,y}'); cap('回到一開始的例子', '');
  },
  async (tok, S) => { // @653.2
    S.M = mat01(A3, BXY, null, -4.6, 4.8, 0.9); S.mt = hd('M（' + A3.length + ' × ' + BXY.length + '）', -4.1, 6.3);
    S.B.add('row 對應 1、2、3；column 對應 x、y'); cap('3 × 2 的矩陣', '先標好每列每行是誰');
  },
  async (tok, S) => { // @677.5
    A3.forEach((a, i) => BXY.forEach((b, j) => S.M.set(i, j, R6S.has(PR(a, b)) ? 1 : 0)));
    const ones = A3.reduce((s, a) => s + BXY.filter((b) => R6S.has(PR(a, b))).length, 0);
    S.B.add('1x、1y、2x、3y 填 1，其他填 0（' + ones + ' 個 1 = |R|' + ck(ones === R6.length) + '）', 'good'); cap('在裡面寫 1，不在寫 0', '');
  },
  async (tok, S) => { // @700.3
    S.B.add('說好行列順序，矩陣就唯一表示這個 relation'); cap('順序講好就唯一表示', '');
  },
  async (tok, S) => { // @738.4
    gone(S.M, S.mt); S.M = mat01(A4, A4, (i, j) => (DIV4.has(PR(A4[i], A4[j])) ? 1 : 0), -5.2, 5.0, 0.8); S.mt = hd('整除關係的 4 × 4 矩陣', -4.0, 6.3);
    const ones = A4.reduce((s, a) => s + A4.filter((b) => DIV4.has(PR(a, b))).length, 0);
    S.B.add('整除例子：4 × 4 矩陣，' + ones + ' 個 1' + ck(ones === DIV4.size)); cap('整除的例子：4 × 4 矩陣', '');
  },
  async (tok, S) => { // @775.1
    S.B.add('列出 pair 或用矩陣：同一件事，只是表示法', 'good'); cap('兩種寫法是同一件事', '');
  },
]);

// 整除關係的 digraph：1 2 / 3 4 擺成正方形
const DG = { 1: [-5.2, 1.4], 2: [-2.2, 1.4], 3: [-5.2, 4.6], 4: [-2.2, 4.6] };
scene('reA-6a-digraph', '6A：表示 relation——directed graph（digraph）', [
  async (tok, S) => { // @794.5
    S.B = board(0.4, 6.3); S.B.add('表示法 3：directed graph（只有一個集合 A）', 'ptr'); cap('第三種：directed graph', 'A 和 B 是同一個集合');
  },
  async (tok, S) => { // @805.4
    S.B.add('directed graph 簡稱 digraph'); cap('digraph = directed graph', '');
  },
  async (tok, S) => { // @817.1
    S.d = [dot(null, -5.6, 6.2, TC.node, 0.6), dot(null, -4.2, 6.2, TC.node, 0.6), seg(-5.6, 6.2, -4.2, 6.2), dot(null, -3.0, 6.2, TC.node, 0.6), dot(null, -1.6, 6.2, TC.node, 0.6), darr([-3.0, 6.2], [-1.6, 6.2], TC.edge, 0.2)];
    S.d.push(sm('undirected', -4.9, 5.7), sm('directed', -2.3, 5.7));
    S.B.add('graph 兩種：undirected（邊沒方向）、directed（邊有方向）'); cap('差別只在邊有沒有方向', '');
  },
  async (tok, S) => { // @827.0
    gone(S.d); S.B.add('例：A = {1,2,3,4}，R：a₁ | a₂'); cap('還是用整除的例子', '');
  },
  async (tok, S) => { // @849.3
    S.V = {}; A4.forEach((a) => { S.V[a] = dot(a, DG[a][0], DG[a][1]); });
    S.B.add('vertex（端點）：每個 element 對應一個點 → ' + A4.length + ' 個'); cap('每個 element 一個 vertex', '');
  },
  async (tok, S) => { // @869.2
    S.B.add('edge（邊）：把兩個 vertex 連起來，而且有方向'); cap('edge 有方向', '');
  },
  async (tok, S) => { // @882.8
    S.L = { 1: loopAt(DG[1], TC.gold) }; S.B.add('(1,1)：自己繞自己一圈（loop）'); cap('(1,1) 畫成自己繞一圈', '');
  },
  async (tok, S) => { // @889.0
    S.A = ['2', '3', '4'].map((b) => darr(DG[1], DG[b], TC.a)); S.B.add('(1,2)、(1,3)、(1,4)：從 1 指出去'); cap('1 → 2、1 → 3、1 → 4', '');
  },
  async (tok, S) => { // @903.2
    ['2', '3', '4'].forEach((a) => { S.L[a] = loopAt(DG[a], TC.gold); }); S.A.push(darr(DG[2], DG[4], TC.a));
    S.B.add('(2,2)、(2,4)、(3,3)、(4,4)'); cap('其他的也畫上去', '');
  },
  async (tok, S) => { // @923.0
    const arcs = Object.keys(S.L).length + S.A.length;
    S.B.add('邊數 ' + arcs + ' = |R|' + ck(arcs === DIV4.size) + '：digraph ⇔ 矩陣 ⇔ pair 列表', 'good'); cap('和矩陣是 one-to-one correspondence', '');
  },
  async (tok, S) => { // @978.9
    S.B.add('notation：(a₁, a₂) ∈ R 也寫成 a₁ R a₂（例：1 R 2）', 'ptr alt'); cap('a₁ R a₂：a₁ 和 a₂ 有關係 R', '');
  },
]);

const AB3 = { a: [-5.6, 2.2], b: [-3.6, 4.6], c: [-1.6, 2.2] };
scene('reA-6a-equiv', '6A：Equivalence relation 的三個條件', [
  async (tok, S) => { // @1018.4
    S.B = board(0.4, 6.3); S.B.add('前面：一般 binary relation 的定義'); cap('後面看幾種特別的 relation', '');
  },
  async (tok, S) => { // @1040.0
    S.B.add('equivalence relation（等價關係）', 'ptr'); cap('第一種：equivalence relation', 'equivalent 等價');
  },
  async (tok, S) => { // @1061.0
    S.B.add('R 是 A 上的 relation（A² 的 subset），要滿足三個條件'); cap('要滿足三個條件', '');
  },
  async (tok, S) => { // @1101.4
    S.V = {}; A4.forEach((a) => { S.V[a] = dot(a, DG[a][0] + 0.4, DG[a][1] - 0.2, TC.node, 0.9); S.V[a].userData.l = loopAt([DG[a][0] + 0.4, DG[a][1] - 0.2], TC.green); });
    S.n = note('像整除例子：(1,1)…(4,4) 都在' + ck(DIV4_P.ref), -3.3, 0.0);
    S.B.add('① 對每個 a ∈ A：(a, a) ∈ R（自己跟自己有關係）'); cap('第一：自己跟自己要有關係', '');
  },
  async (tok, S) => { // @1127.2
    S.B.add('這叫 reflexive（反身性）', 'good'); cap('reflexive 反身性', '');
  },
  async (tok, S) => { // @1145.1
    gone(Object.values(S.V).map((v) => [v, v.userData.l]), S.n); S.V = {};
    ['a', 'b'].forEach((n) => { S.V[n] = dot(n, AB3[n][0], AB3[n][1]); });
    S.e1 = darr(AB3.a, AB3.b, TC.a); S.n = note('示意', -5.8, 6.2);
    S.B.add('② (a, b) ∈ R ⇒ (b, a) ∈ R'); cap('第二：a R b 就推得 b R a', '');
  },
  async (tok, S) => { // @1180.3
    S.e2 = darr([AB3.b[0] + 0.12, AB3.b[1] - 0.12], [AB3.a[0] + 0.12, AB3.a[1] - 0.12], TC.b);
    S.B.add('這叫 symmetric（對稱性）：沒有前後順序', 'good'); cap('symmetric 對稱性', '');
  },
  async (tok, S) => { // @1195.1
    gone(S.e2); S.V.c = dot('c', AB3.c[0], AB3.c[1]); S.e3 = darr(AB3.b, AB3.c, TC.a);
    await wt(tok, 500); S.e4 = darr(AB3.a, AB3.c, TC.green);
    S.B.add('③ (a, b) ∈ R 且 (b, c) ∈ R ⇒ (a, c) ∈ R'); cap('第三：a R b、b R c ⇒ a R c', '');
  },
  async (tok, S) => { // @1218.5
    S.B.add('這叫 transitive（遞移性）', 'good'); cap('transitive 遞移性', '可以傳過去');
  },
  async (tok, S) => { // @1228.2
    S.B.add('reflexive + symmetric + transitive ⇒ equivalence relation', 'ptr alt'); cap('三個都滿足就是 equivalence relation', '');
  },
]);

// ════════ EAvNAZUNDnw（趙啟超 6B：3 | (a − b) 是 equivalence relation、congruence modulo n、mod 運算、各位數字和） ════════
const zx = (k, lo = -4, dx = 0.68) => -6.3 + (k - lo) * dx;
// 整數數線：lo..hi，y 高度；回傳每個整數的點
function zline(S, lo, hi, y = 1.0, dx = 0.68, col) {
  S.Z = {}; S.zx = (k) => zx(k, lo, dx);
  S.zl = seg(S.zx(lo) - 0.5, y, S.zx(hi) + 0.5, y, TC.faint, 0.03);
  for (let k = lo; k <= hi; k++) S.Z[k] = dot(String(k), S.zx(k), y, col ? col(k) : TC.node, 0.62);
  S.dots = [sm('…', S.zx(lo) - 0.8, y), sm('…', S.zx(hi) + 0.8, y)];
}
function arch(x1, x2, y, h, c = TC.a) {
  const out = [], K = 10; let p = [x1, y];
  for (let k = 1; k <= K; k++) { const t = Math.PI * k / K, q = [(x1 + x2) / 2 - Math.cos(t) * (x2 - x1) / 2, y + Math.sin(t) * h]; out.push(seg(p[0], p[1], q[0], q[1], c, 0.04, 0.05)); p = q; }
  return out;
}
const R3 = (a, b) => md(a - b, 3) === 0;
const RANGE = Array.from({ length: 31 }, (_, i) => i - 15);
const ZR = RANGE.map(String);
const R3_P = propsOf(ZR, relOf(ZR, (a, b) => R3(+a, +b)));
const CONG_OK = [2, 3, 4, 5, 6].every((n) => propsOf(ZR, relOf(ZR, (a, b) => md(+a - +b, n) === 0)).eq);

scene('reA-6b-mod3', '6B：例子——Z 上的 a R b ⇔ 3 | (a − b)', [
  async (tok, S) => { // @4.8
    zline(S, -4, 14); S.h = hd('A = Z：所有整數（負整數、0、正整數）', -1.2, 6.6); S.B = board(-6.3, 5.8); cap('舉個例子：A 是所有整數 Z', '');
  },
  async (tok, S) => { // @9.2
    S.B.add('a R b ⇔ ？'); cap('relation 怎麼定義？', '');
  },
  async (tok, S) => { // @57.9
    S.B.add('a R b ⇔ a − b 是 3 的倍數', 'ptr alt'); cap('a − b 是 3 的倍數就有關係', '');
  },
  async (tok, S) => { // @93.9
    S.B.add('也寫成 3 | (a − b)：3 整除 a − b'); cap('寫成 3 | (a − b)', '3 是 a − b 的因數');
  },
  async (tok, S) => { // @107.9
    S.dots.forEach((d) => setCls(d, 'ptr')); S.B.add('Z 有無窮多個 element，沒辦法一個一個列出來'); cap('Z 無窮多個，只能用條件描述', '');
  },
  async (tok, S) => { // @124.2
    S.a1 = arch(S.zx(1), S.zx(4), 1.35, 1.0, TC.a); paint(S.Z[1], TC.a); paint(S.Z[4], TC.a);
    S.B.add('1 R 4：1 − 4 = ' + (1 - 4) + ' 是 3 的倍數' + ck(R3(1, 4)), 'good'); cap('1 跟 4 有關係', '1 − 4 = −3');
  },
  async (tok, S) => { // @132.7
    S.a2 = arch(S.zx(2), S.zx(5), 1.35, 0.8, TC.b); S.a3 = arch(S.zx(2), S.zx(14), 1.35, 2.2, TC.green);
    [2, 5, 14].forEach((k) => paint(S.Z[k], TC.green));
    S.B.add('2 R 5：' + (2 - 5) + ck(R3(2, 5)) + '；2 R 14：2 − 14 = ' + (2 - 14) + ck(R3(2, 14)), 'good'); cap('2 跟 5、2 跟 14 也有關係', '−12 也是 3 的倍數');
  },
  async (tok, S) => { // @141.5
    S.B.add('要證明：這是 equivalence relation → check 三個條件', 'ptr'); cap('證明它是 equivalence relation', 'reflexive、symmetric、transitive');
  },
]);

function chk3(S, x = 3.6, y = 6.2) {
  S.c = { ref: pl('reflexive ？', x, y), sym: pl('symmetric ？', x, y - 0.7), tra: pl('transitive ？', x, y - 1.4) };
}
const done3 = (S, k, nm) => { txt(S.c[k], nm + ' ✓'); setCls(S.c[k], 'good'); };
scene('reA-6b-proof', '6B：證明 3 | (a − b) 是 equivalence relation', [
  async (tok, S) => { // @155.6
    chk3(S); setCls(S.c.ref, 'ptr alt'); S.B = board(-6.3, 6.3); S.B.add('reflexive：a R a 嗎？', 'ptr'); cap('第一個：反身性', '');
  },
  async (tok, S) => { // @170.1
    S.B.add('a − a = 0 = 3 × 0'); cap('a − a 是 3 的倍數嗎？', 'a − a = 0');
  },
  async (tok, S) => { // @198.3
    S.B.add('0 是任何整數的倍數 → a R a', 'good'); done3(S, 'ref', 'reflexive'); cap('0 是任何整數的倍數', '反身性成立');
  },
  async (tok, S) => { // @209.1
    setCls(S.c.sym, 'ptr alt'); S.B.gap(0.3); S.B.add('symmetric：a R b ⇒ b R a？', 'ptr'); cap('再來 check 對稱性', '');
  },
  async (tok, S) => { // @227.4
    S.B.add('a R b：a − b = 3k（k 是整數）'); cap('a R b 的意思：a − b = 3k', '');
  },
  async (tok, S) => { // @243.7
    S.B.add('兩邊乘 −1：b − a = 3(−k)，−k 也是整數 → b R a', 'good'); done3(S, 'sym', 'symmetric'); cap('兩邊乘負號', 'b − a 也是 3 的倍數');
  },
  async (tok, S) => { // @275.0
    setCls(S.c.tra, 'ptr alt'); S.B.gap(0.3); S.B.add('transitive：a R b 且 b R c ⇒ a R c？', 'ptr'); cap('再來是遞移性', '');
  },
  async (tok, S) => { // @312.5
    S.B.add('a − b = 3k₁，b − c = 3k₂（k₁、k₂ 不一定一樣）'); cap('兩個條件各寫成 3 的倍數', '');
  },
  async (tok, S) => { // @331.8
    S.B.add('a − c = (a − b) + (b − c) = 3(k₁ + k₂) → a R c', 'good'); done3(S, 'tra', 'transitive'); cap('把兩個加起來', 'k₁ + k₂ 還是整數');
  },
  async (tok, S) => { // @374.7
    S.B.add('→ equivalence relation（在 −15…15 上逐一驗算' + ck(R3_P.eq) + '）', 'ptr alt'); cap('所以是 equivalence relation', '');
  },
]);

const EX_A = 17, EX_B = 5, EX_N = 4;   // 示意用的數字
scene('reA-6b-cong', '6B：推廣——congruence modulo n', [
  async (tok, S) => { // @484.4
    S.B = board(-6.3, 6.3); S.B.add('把 3 換成 4：證明一模一樣'); cap('把 3 換成 4 會怎樣？', '證明一模一樣');
  },
  async (tok, S) => { // @502.0
    S.B.add('換成 5、換成 2：還是一樣'); cap('換成 5、2 也一樣', '');
  },
  async (tok, S) => { // @525.5
    S.B.add('把 3 換成 n（n ≥ 2 的正整數）都會 work', 'ptr'); cap('換成任何 n ≥ 2', '');
  },
  async (tok, S) => { // @545.7
    S.B.add('這個關係叫 congruence modulo n（模 n 同餘）', 'ptr alt'); cap('congruence modulo n', '');
  },
  async (tok, S) => { // @588.4
    S.big = hot('a ≡ b (mod n)', 3.6, 5.2); cap('符號：三橫的 ≡', '後面括號 mod n');
  },
  async (tok, S) => { // @598.4
    S.B.add('唸作「a is congruent to b modulo n」'); cap('a is congruent to b modulo n', '');
  },
  async (tok, S) => { // @642.2
    S.B.add('定義：a − b = kn（k 是某個整數），a − b 是 n 的倍數'); cap('定義：a − b 是 n 的倍數', '');
  },
  async (tok, S) => { // @663.4
    S.B.add('也就是 n | (a − b)');
    S.ex = note('示意：' + EX_A + ' − ' + EX_B + ' = ' + (EX_A - EX_B) + ' = ' + (EX_A - EX_B) / EX_N + ' × ' + EX_N + ' → ' + EX_A + ' ≡ ' + EX_B + ' (mod ' + EX_N + ')' + ck(md(EX_A - EX_B, EX_N) === 0), 3.0, 3.8);
    cap('n 整除 a − b', '同一件事');
  },
  async (tok, S) => { // @688.6
    S.B.add('證明把 3 換成 n 就好 → Z 上的 equivalence relation（n = 2…6 驗算' + ck(CONG_OK) + '）', 'good'); cap('congruence mod n 是 equivalence relation', '');
  },
  async (tok, S) => { // @749.0
    S.B.add('另一種看法：a mod n = b mod n', 'ptr');
    S.ex2 = note(EX_A + ' mod ' + EX_N + ' = ' + md(EX_A, EX_N) + '，' + EX_B + ' mod ' + EX_N + ' = ' + md(EX_B, EX_N) + ck(md(EX_A, EX_N) === md(EX_B, EX_N)), 3.0, 3.0);
    cap('另一種看法：除以 n 的餘數一樣', '');
  },
]);

scene('reA-6b-modop', '6B：x mod n——取餘數', [
  async (tok, S) => { // @760.2
    S.B = board(-6.3, 6.3); S.B.add('x mod n 這個運算是什麼？', 'ptr'); cap('什麼叫 x mod n', 'C 語言也有這個運算');
  },
  async (tok, S) => { // @779.6
    S.B.add('x 是整數，n 是 ≥ 2 的正整數'); cap('x 是整數、n ≥ 2', '');
  },
  async (tok, S) => { // @790.0
    S.B.add('x mod n = x 除以 n 的餘數（remainder）', 'ptr alt'); cap('除下去，只取餘數', '');
  },
  async (tok, S) => { // @825.4
    S.cs = []; for (let k = 0; k < 5; k++) S.cs.push(cube('', k < 3 ? TC.a : TC.orange, [0.5, 0.5, 0.5], 1.2 + k * 0.7, 4.6, 0, 1.5));
    S.gb = blob(1.9, 4.6, 1.2, 0.5, TC.a, 0.15);
    S.B.add('5 mod 3 = ' + md(5, 3) + '（5 = 3 × 1 + 2）' + ck(md(5, 3) === 2)); cap('5 mod 3 = 2', '三個一組，剩 2');
  },
  async (tok, S) => { // @842.2
    gone(S.cs, S.gb); S.B.add('負的也可以：−2 mod 3 = ？'); cap('負數也可以 mod', '');
  },
  async (tok, S) => { // @873.9
    S.B.add('餘數一定 ≥ 0 而且小於除數：0 ≤ 餘數 ≤ n − 1', 'ptr'); cap('餘數要在 0 到 n − 1 之間', '');
  },
  async (tok, S) => { // @892.4
    S.B.add('−2 = 3 × (−1) + 1 → −2 mod 3 = ' + md(-2, 3) + ck(md(-2, 3) === 1), 'good'); cap('−2 = 3 × (−1) + 1', '所以餘數是 1');
  },
  async (tok, S) => { // @908.3
    zline(S, -6, 11, 1.0, 0.68, (k) => BLK[md(k, 3)]);
    S.lg = [0, 1, 2].map((r) => tag('mod 3 = ' + r, '', 2.4 + r * 1.6, 2.2));
    S.lg.forEach((l, r) => { l.element.style.background = BLK[r]; l.element.style.color = '#fff'; });
    S.B.add('mod 3 的結果只可能是 0、1、2（負數也一樣）'); cap('mod 3 只有 0、1、2 三種', '');
  },
  async (tok, S) => { // @931.7
    [-4, -1, 2, 5, 8, 11].forEach((k) => glow(S.Z[k], '#3a2a00'));
    S.B.add('a ≡ b (mod n) ⇔ a mod n = b mod n（同顏色的互相 ≡）', 'good'); cap('同餘 ⇔ 餘數一樣', '');
  },
]);

const MA = 17, MB = 8, MM = 5;   // 示意
scene('reA-6b-modarith', '6B：mod 的加法與乘法', [
  async (tok, S) => { // @960.4
    S.B = board(-6.3, 6.3); S.B.add('mod m 的運算（a、b 整數，m ≥ 2）', 'ptr'); S.n = note('示意：a = ' + MA + '、b = ' + MB + '、m = ' + MM, 3.2, 6.2); cap('順便講一下 mod m 的運算', '');
  },
  async (tok, S) => { // @970.6
    S.B.add('(a + b) mod m：加起來再 mod'); S.B.add('  ' + MA + ' + ' + MB + ' = ' + (MA + MB) + '，' + (MA + MB) + ' mod ' + MM + ' = ' + md(MA + MB, MM), 'idx');
    cap('a + b 加起來再 mod m', '');
  },
  async (tok, S) => { // @990.0
    const v = md(md(MA, MM) + md(MB, MM), MM);
    S.B.add('= ((a mod m) + (b mod m)) mod m：先 mod 再加，可能超過 m 再 mod 一次');
    S.B.add('  ' + md(MA, MM) + ' + ' + md(MB, MM) + ' = ' + (md(MA, MM) + md(MB, MM)) + '，mod ' + MM + ' = ' + v + ck(v === md(MA + MB, MM)), 'good');
    cap('也可以先 mod 再加', '超過 m 再 mod 一次');
  },
  async (tok, S) => { // @1019.6
    const v = md(md(MA, MM) * md(MB, MM), MM);
    S.B.add('乘法也一樣：(a·b) mod m = ((a mod m)(b mod m)) mod m');
    S.B.add('  ' + MA + '×' + MB + ' = ' + MA * MB + ' → ' + md(MA * MB, MM) + '；' + md(MA, MM) + '×' + md(MB, MM) + ' = ' + md(MA, MM) * md(MB, MM) + ' → ' + v + ck(v === md(MA * MB, MM)), 'good');
    cap('乘法：先乘再 mod = 先 mod 再乘', '');
  },
  async (tok, S) => { // @1054.0
    S.B.add('先加（乘）再 mod = 先 mod 再加（乘）再 mod；答案在 0…m − 1', 'ptr alt'); cap('兩種算法答案一樣', '');
  },
]);

const NUM = '12356978', ND = NUM.split('').map(Number), DSUM = ND.reduce((s, d) => s + d, 0);
const NMOD = Number(BigInt(NUM) % 3n);
const P10 = [1, 2, 3, 4, 5, 6, 7].map((k) => Number((10n ** BigInt(k)) % 3n));
scene('reA-6b-digit', '6B：為什麼看「各位數字和」就知道是不是 3 的倍數', [
  async (tok, S) => { // @1069.1
    S.B = board(-6.3, 3.7, 0.52); cap('舉個小學學過的例子', '');
  },
  async (tok, S) => { // @1085.4
    S.d = ND.map((d, i) => cube(String(d), TC.zero, [0.62, 0.62, 0.3], -2.5 + i * 0.75, 5.6, 0, 1.2));
    S.p = ND.map((_, i) => sm('10' + ['⁷', '⁶', '⁵', '⁴', '³', '²', '¹', '⁰'][i], -2.5 + i * 0.75, 4.95));
    S.h = hd('N = 12,356,978', -4.8, 6.6); cap('一千兩百三十五萬六千九百七十八', '');
  },
  async (tok, S) => { // @1100.3
    S.B.add('是不是 3 的倍數？小學：各位數字加起來看是不是 3 的倍數');
    S.sum = pl(ND.join(' + ') + ' = ' + DSUM, 0, 4.3); cap('小學教：各位數字加起來', '為什麼可以這樣？');
  },
  async (tok, S) => { // @1135.1
    S.B.add('一般化：N = aₙaₙ₋₁…a₁a₀（十進位，n + 1 個 digit）', 'ptr'); cap('一般的十進位數', '');
  },
  async (tok, S) => { // @1157.3
    S.B.add('3 的倍數 ⇔ N mod 3 = 0'); cap('3 的倍數：mod 3 是 0', '');
  },
  async (tok, S) => { // @1175.7
    S.B.add('N = aₙ·10ⁿ + aₙ₋₁·10ⁿ⁻¹ + … + a₁·10 + a₀'); cap('把每一位乘上 10 的次方', '');
  },
  async (tok, S) => { // @1204.2
    S.B.add('加法：全部加起來 mod 3 = 各自 mod 3 加起來再 mod 3'); cap('先拆成每一項各自 mod', '');
  },
  async (tok, S) => { // @1246.2
    S.B.add('乘法：aᵢ·10ⁱ mod 3 = (aᵢ)(10ⁱ mod 3) mod 3'); cap('每一項是兩個乘起來', '也可以各自 mod');
  },
  async (tok, S) => { // @1299.5
    S.B.clear(); S.B.add('→ 只要算 10ⁱ mod 3', 'ptr'); cap('關鍵：10 的次方 mod 3', '');
  },
  async (tok, S) => { // @1307.3
    S.B.add('10 mod 3 = ' + md(10, 3) + ck(md(10, 3) === 1), 'good'); cap('10 mod 3 = 1', '');
  },
  async (tok, S) => { // @1309.2
    S.B.add('10² mod 3 = (1 × 1) mod 3 = ' + P10[1] + '；10³ mod 3 = ' + P10[2] + ck(P10[1] === 1 && P10[2] === 1), 'good'); cap('10² 和 10³ mod 3 也是 1', '1 × 1 × 1 還是 1');
  },
  async (tok, S) => { // @1339.0
    S.p.forEach((l) => { txt(l, '→1'); setCls(l, 'good'); });
    S.B.add('10ⁿ mod 3 = 1（n ≥ 0；10¹…10⁷ 驗算' + ck(P10.every((v) => v === 1)) + '）', 'good'); cap('10ⁿ mod 3 永遠是 1', '');
  },
  async (tok, S) => { // @1373.6
    S.B.add('N mod 3 = (a₀ + a₁ + … + aₙ) mod 3', 'ptr alt');
    S.B.add('例：' + DSUM + ' mod 3 = ' + md(DSUM, 3) + '，直接算 N mod 3 = ' + NMOD + ck(md(DSUM, 3) === NMOD) + ' → ' + (NMOD === 0 ? '是' : '不是') + ' 3 的倍數', 'good');
    cap('看各位數字和 mod 3 就好', '這就是小學那個規則的原因');
  },
  async (tok, S) => { // @1419.3
    S.B.add('這段的重點：congruence modulo n 是 equivalence relation', 'ptr'); cap('重點是 congruence mod n', '它是 equivalence relation');
  },
]);

// ════════ MvNiJbIxfu0（趙啟超 7A：equivalence class、三個性質與證明、partition 的定義） ════════
// 小圖示：reflexive（loop）、symmetric（來回）、transitive（三角形）
function mini(kind, x, y) {
  const o = [];
  if (kind === 'ref') { o.push(dot('a', x, y, TC.node, 0.7), loopAt([x, y], TC.green)); }
  if (kind === 'sym') { o.push(dot('a', x - 0.8, y, TC.node, 0.7), dot('b', x + 0.8, y, TC.node, 0.7), darr([x - 0.8, y + 0.12], [x + 0.8, y + 0.12], TC.a, 0.3), darr([x + 0.8, y - 0.12], [x - 0.8, y - 0.12], TC.b, 0.3)); }
  if (kind === 'tra') { const a = [x - 0.9, y - 0.4], b = [x, y + 0.5], c = [x + 0.9, y - 0.4]; o.push(dot('a', ...a, TC.node, 0.7), dot('b', ...b, TC.node, 0.7), dot('c', ...c, TC.node, 0.7), darr(a, b, TC.a, 0.3), darr(b, c, TC.a, 0.3), darr(a, c, TC.green, 0.3)); }
  return o;
}
// 示意例子：A = {0,…,8}、R = congruence mod 3
const A9 = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const cls3 = (x) => A9.filter((y) => md(y - x, 3) === 0);
const P9 = (v) => [-5.6 + md(v, 3) * 2.0, 5.3 - Math.floor(v / 3) * 1.25];
const eqSet = (a, b) => a.length === b.length && a.every((v) => b.includes(v));
function nine(S) { S.v = {}; A9.forEach((v) => { S.v[v] = dot(String(v), ...P9(v)); }); }
function clsBlob(r, c, op = 0.2) { const [x] = P9(r); return blob(x, 4.05, 0.7, 1.95, c, op); }

scene('reA-7a-recap', '7A：複習——equivalence relation 的三個條件', [
  async (tok, S) => { // @3.8
    S.B = board(-6.3, 6.3); S.B.add('equivalence relation：集合 A 上的 binary relation（A × A 的 subset）', 'ptr'); cap('上次教到 equivalence relation', '');
  },
  async (tok, S) => { // @32.9
    S.B.add('① reflexive：對所有 a ∈ A，a R a'); S.m1 = mini('ref', 4.0, 5.6); cap('自己跟自己有關係', 'reflexive');
  },
  async (tok, S) => { // @47.0
    S.B.add('② symmetric：a R b ⇒ b R a'); S.m2 = mini('sym', 4.0, 3.9); cap('a R b 就有 b R a', 'symmetric');
  },
  async (tok, S) => { // @56.3
    S.B.add('③ transitive：a R b、b R c ⇒ a R c'); S.m3 = mini('tra', 4.0, 1.9); cap('a R b、b R c ⇒ a R c', 'transitive');
  },
  async (tok, S) => { // @77.1
    S.B.gap(0.3); S.B.add('例：congruence modulo n（n ≥ 2）', 'ptr alt'); cap('例子：congruence modulo n', '');
  },
  async (tok, S) => { // @91.6
    S.B.add('a ≡ b (mod n)：a − b 是 n 的倍數 ⇔ a mod n = b mod n'); cap('相減是 n 的倍數', '或 mod n 的結果一樣');
  },
]);

scene('reA-7a-class', '7A：equivalence class [x] 與三個性質', [
  async (tok, S) => { // @118.0
    nine(S); S.n = note('示意：A = {0,…,8}，R = congruence mod 3', -3.6, 6.6); S.B = board(0.4, 6.0);
    S.B.add('A 上有一個 equivalence relation R', 'ptr'); cap('集合 A 上有 equivalence relation R', '');
  },
  async (tok, S) => { // @126.3
    S.B.add('對每個 x ∈ A，定義一個符號 [x]'); cap('對每個 x 定義 [x]', '');
  },
  async (tok, S) => { // @143.9
    const c = cls3(1); paint(S.v[1], TC.orange, '#5a2a00'); c.filter((y) => y !== 1).forEach((y) => paint(S.v[y], TC.a));
    S.b1 = clsBlob(1, TC.a); S.B.add('[x] = {y ∈ A : y R x}：所有跟 x 有關係的 y', 'ptr alt');
    S.B.add('例：[1] = ' + setStr(c), 'idx'); cap('[x]：所有跟 x 有關係的元素', '');
  },
  async (tok, S) => { // @159.0
    S.B.add('[x] 叫 x 的 equivalence class（等價類）', 'good'); cap('叫 x 的 equivalence class', '');
  },
  async (tok, S) => { // @179.5
    S.b0 = clsBlob(0, TC.green); S.b2 = clsBlob(2, TC.b);
    S.B.add('每個元素都有：[0] = ' + setStr(cls3(0)) + '、[2] = ' + setStr(cls3(2)), 'idx'); cap('每個元素都可以定義 class', '');
  },
  async (tok, S) => { // @202.0
    S.B.gap(0.3); S.B.add('(a) x ∈ [x]' + ck(A9.every((x) => cls3(x).includes(x))), 'ptr'); cap('性質 (a)：x 在自己的 class 裡', '');
  },
  async (tok, S) => { // @212.7
    S.B.add('(b) x R y ⇔ [x] = [y]（例：1 R 4，[1] = [4]' + ck(eqSet(cls3(1), cls3(4))) + '）', 'ptr'); cap('(b)：x R y 若且唯若 [x] = [y]', '');
  },
  async (tok, S) => { // @229.1
    const ok2 = A9.every((x) => A9.every((y) => eqSet(cls3(x), cls3(y)) || !cls3(x).some((v) => cls3(y).includes(v))));
    S.B.add('(c) [x] = [y] 或 [x] ∩ [y] = ∅（disjoint）' + ck(ok2), 'ptr'); cap('(c)：不是一樣就是 disjoint', '交集是空集合');
  },
]);

// 抽象的證明圖：x、y 兩個點和它們的 class
const PX = [-5.0, 3.4], PY = [-1.8, 3.4];
scene('reA-7a-pa', '7A：證明 (a)——x ∈ [x]', [
  async (tok, S) => { // @250.1
    S.bx = blob(-3.4, 3.4, 2.2, 1.6, TC.a, 0.18); S.t = hd('[x]', -3.4, 5.4); S.x = dot('x', -6.3, 1.2, TC.orange);
    S.B = board(0.4, 6.0); S.B.add('證明 (a)：x ∈ [x]', 'ptr'); cap('先看第一點', 'x 在自己的 class 裡');
  },
  async (tok, S) => { // @266.0
    S.B.add('[x] 裡放的是跟 x 有關係的元素 → 只要證 x R x'); cap('要證 x 跟 x 自己有關係', '');
  },
  async (tok, S) => { // @286.7
    S.l = loopAt([-6.3, 1.2], TC.green); S.B.add('R 是 reflexive（反身性）→ x R x', 'good'); cap('因為 reflexive', '');
  },
  async (tok, S) => { // @310.1
    await anim(tok, 900, (u) => { S.x.position.set(-6.3 + u * 2.9, 1.2 + u * 2.2, 0); S.l.position.set(-6.3 + u * 2.9, 1.68 + u * 2.2, 0); });
    S.B.add('→ x ∈ [x]：每個 class 一定包含自己', 'ptr alt'); cap('class 一定包含自己', '');
  },
]);

scene('reA-7a-pb', '7A：證明 (b)——x R y ⇔ [x] = [y]', [
  async (tok, S) => { // @329.7
    S.bx = blob(PX[0], PX[1], 1.5, 1.9, TC.a, 0.18); S.by = blob(PY[0], PY[1], 1.5, 1.9, TC.b, 0.18);
    S.tx = hd('[x]', PX[0], 5.7); S.ty = hd('[y]', PY[0], 5.7); S.x = dot('x', ...PX, TC.orange); S.y = dot('y', ...PY, TC.orange);
    S.xy = darr(PX, PY, TC.gold); S.B = board(0.6, 6.3); S.B.add('證明 (b)：x R y ⇒ [x] = [y]', 'ptr'); cap('第二點：x R y 推到 [x] = [y]', '');
  },
  async (tok, S) => { // @340.5
    S.B.add('if and only if：⇒ 和 ⇐ 兩個方向都要證'); cap('若且唯若：兩個方向', '');
  },
  async (tok, S) => { // @356.2
    S.B.add('證兩個集合一樣：互相包含（⊆ 和 ⊇）'); cap('兩個集合一樣：互包含', '');
  },
  async (tok, S) => { // @423.7
    S.wp = [PX[0] - 0.6, PX[1] - 1.2]; S.w = dot('w', ...S.wp, TC.green); S.B.add('[x] ⊆ [y]：任取 w ∈ [x]', 'ptr alt'); cap('先證 [x] ⊆ [y]', '任取 [x] 裡的 w');
  },
  async (tok, S) => { // @448.6
    S.wx = darr(S.wp, PX, TC.a); S.B.add('w ∈ [x] ⇒ w R x（定義）'); cap('w 在 [x] 裡：w R x', '');
  },
  async (tok, S) => { // @470.1
    S.wy = darr(S.wp, PY, TC.green); S.B.add('w R x、x R y ⇒ w R y（transitive）'); cap('用 transitive', 'w R x、x R y ⇒ w R y');
  },
  async (tok, S) => { // @492.3
    gone(S.wx, S.wy); const to = [PY[0] - 0.6, PY[1] - 1.2];
    await anim(tok, 900, (u) => S.w.position.set(S.wp[0] + (to[0] - S.wp[0]) * u, S.wp[1] + (to[1] - S.wp[1]) * u, 0));
    S.B.add('→ w ∈ [y]，所以 [x] ⊆ [y]', 'good'); cap('w 也在 [y] 裡', '[x] ⊆ [y]');
  },
  async (tok, S) => { // @536.2
    gone(S.w); S.tp = [PY[0] + 0.6, PY[1] - 1.2]; S.t = dot('t', ...S.tp, TC.purple); S.ty2 = darr(S.tp, PY, TC.b);
    S.B.add('[y] ⊆ [x]：任取 t ∈ [y] ⇒ t R y', 'ptr alt'); cap('再證 [y] ⊆ [x]', '任取 [y] 裡的 t');
  },
  async (tok, S) => { // @570.5
    S.yx = darr([PY[0], PY[1] - 0.15], [PX[0], PX[1] - 0.15], TC.b); S.B.add('x R y ⇒ y R x（symmetric）'); cap('對稱性：y R x', '');
  },
  async (tok, S) => { // @596.0
    S.tx2 = darr(S.tp, PX, TC.green); S.B.add('t R y、y R x ⇒ t R x（transitive）→ t ∈ [x]', 'good'); cap('t R x，所以 t 在 [x] 裡', '');
  },
  async (tok, S) => { // @634.4
    gone(S.ty2, S.tx2, S.yx, S.t);
    await anim(tok, 1000, (u) => { S.bx.position.x = PX[0] + u * 1.6; S.by.position.x = PY[0] - u * 1.6; S.tx.position.x = PX[0] + u * 1.2; S.ty.position.x = PY[0] - u * 1.2; });
    S.B.add('兩邊互相包含 → [x] = [y]', 'good'); cap('互相包含：[x] = [y]', '');
  },
  async (tok, S) => { // @644.1
    gone(S.xy); S.B.gap(0.3); S.B.add('反方向 ⇐：假設 [x] = [y]', 'ptr'); cap('反方向：假設 [x] = [y]', '');
  },
  async (tok, S) => { // @669.5
    S.xy = darr(PX, PY, TC.gold); S.B.add('x ∈ [x]（性質 a）= [y] ⇒ x ∈ [y] ⇒ x R y', 'good'); cap('x 在 [x]，也就在 [y]', '所以 x R y');
  },
  async (tok, S) => { // @705.0
    S.B.add('兩個方向都證完：只用到定義和三個性質', 'ptr alt'); cap('(b) 證完', '');
  },
]);

scene('reA-7a-pc', '7A：證明 (c)——不是一樣就是 disjoint', [
  async (tok, S) => { // @733.5
    S.B = board(0.6, 6.3); S.B.add('(c) [x] = [y] 或 [x] ∩ [y] = ∅', 'ptr'); cap('第三點', '');
  },
  async (tok, S) => { // @742.7
    S.bx = blob(-4.4, 3.4, 1.6, 1.7, TC.a, 0.2); S.by = blob(-2.4, 3.4, 1.6, 1.7, TC.b, 0.2); S.no = bad('只交一部分？不可能', -3.4, 1.0);
    S.B.add('不會只交集一部分'); cap('不會只有一部分重疊', '');
  },
  async (tok, S) => { // @772.5
    S.B.add('什麼時候一樣？x R y 時（就是 (b)）'); cap('x R y 時 class 一樣', '');
  },
  async (tok, S) => { // @809.0
    gone(S.no); S.B.add('x、y 沒有關係 → 要證 [x] ∩ [y] = ∅', 'ptr alt');
    S.x = dot('x', -5.2, 3.6, TC.orange); S.y = dot('y', -1.6, 3.6, TC.orange); S.nx = bad('x R y 不成立', -3.4, 6.0); cap('x、y 沒關係時', '交集要是空集合');
  },
  async (tok, S) => { // @825.7
    S.B.add('反證法：先假設 [x] ∩ [y] ≠ ∅'); cap('先假設交集不是空的', '推出矛盾');
  },
  async (tok, S) => { // @859.0
    S.v = dot('v', -3.4, 3.1, TC.green); S.B.add('存在 v，v ∈ [x] 而且 v ∈ [y]'); cap('有一個 v 在兩個 class 裡', '');
  },
  async (tok, S) => { // @892.0
    glow(S.v, '#0f5a3a'); S.B.add('把 v 當橋樑'); cap('用 v 當橋樑', '');
  },
  async (tok, S) => { // @908.4
    S.a1 = darr([-3.4, 3.1], [-5.2, 3.6], TC.a); S.a2 = darr([-3.4, 3.1], [-1.6, 3.6], TC.b); S.B.add('v R x、v R y'); cap('v R x，v R y', '');
  },
  async (tok, S) => { // @917.9
    gone(S.a1); S.a1 = darr([-5.2, 3.6], [-3.4, 3.1], TC.a); S.B.add('symmetric：v R x ⇒ x R v'); cap('對稱性把方向反過來', 'x R v');
  },
  async (tok, S) => { // @931.6
    S.a3 = darr([-5.2, 3.9], [-1.6, 3.9], TC.green); S.B.add('x R v、v R y ⇒ x R y（transitive）'); cap('遞移性：x R y', '');
  },
  async (tok, S) => { // @940.0
    gone(S.v, S.a1, S.a2, S.a3); setCls(S.nx, 'bad');
    await anim(tok, 1000, (u) => { S.bx.position.x = -4.4 - u * 1.1; S.by.position.x = -2.4 + u * 1.1; });
    S.B.add('和「x、y 沒關係」矛盾 → [x] ∩ [y] = ∅', 'good'); cap('矛盾！所以交集是空集合', '');
  },
]);

// MvNiJbIxfu0 課堂問答：(b) 第二段為什麼能用 symmetric —— 「x R y」這個假設兩段都一直在
scene('reA-7a-qa', '7A：問答——x R y 的假設一直都在', [
  async (tok, S) => {
    S.bx = blob(PX[0], PX[1], 1.5, 1.9, TC.a, 0.18); S.by = blob(PY[0], PY[1], 1.5, 1.9, TC.b, 0.18);
    hd('[x]', PX[0], 5.7); hd('[y]', PY[0], 5.7); dot('x', ...PX, TC.orange); dot('y', ...PY, TC.orange);
    S.xy = darr(PX, PY, TC.gold); S.h = hot('假設：x R y', -3.4, 0.9);
    S.B = board(0.6, 6.3); S.B.add('問：(b) 第二段為什麼能用 symmetric？', 'ptr'); cap('同學問：第二段為什麼可以這樣推', '');
  },
  async (tok, S) => {
    const wp = [PX[0] - 0.6, PX[1] - 1.2]; S.w = dot('w', ...wp, TC.green); S.a1 = darr(wp, PX, TC.a); S.a2 = darr(wp, PY, TC.green);
    S.B.add('第一段 [x] ⊆ [y]：w R x、x R y ⇒ w R y'); cap('第一段：用到 x R y', '再用 transitive');
  },
  async (tok, S) => {
    gone(S.w, S.a1, S.a2); setCls(S.h, 'good');
    S.B.add('x R y 是一開始的假設：兩段證明都一直可以用', 'ptr alt'); cap('x R y 是一開始的假設', '整個 ⇒ 方向都假設它成立');
  },
  async (tok, S) => {
    S.yx = darr([PY[0], PY[1] - 0.15], [PX[0], PX[1] - 0.15], TC.b);
    const tp = [PY[0] + 0.6, PY[1] - 1.2]; S.t = dot('t', ...tp, TC.purple); darr(tp, PY, TC.b); darr(tp, PX, TC.green);
    S.B.add('第二段 [y] ⊆ [x]：x R y ⇒ y R x（symmetric）');
    S.B.add('t R y、y R x ⇒ t R x', 'good'); cap('第二段：假設還在，用 symmetric 反過來', 'y R x 才能接上 transitive');
  },
]);

// 示意：一群元素「物以類聚」
const FL = [[-6.0, 5.6], [-3.1, 2.0], [-1.0, 4.9], [-4.6, 3.4], [-0.6, 1.8], [-5.4, 1.4], [-2.4, 5.8], [-3.6, 4.2], [-1.6, 2.9]];
scene('reA-7a-flock', '7A：equivalence classes 的直觀——物以類聚', [
  async (tok, S) => { // @1065.0
    S.v = A9.map((v) => dot(String(v), ...FL[v])); S.n = note('示意：mod 3', -3.4, 6.6); S.B = board(0.8, 5.6);
    S.B.add('A 裡每個元素都有自己的 equivalence class'); cap('整個集合 A，每個元素都有 class', '');
  },
  async (tok, S) => { // @1081.7
    const row = (v) => A9.filter((w) => md(w, 3) === md(v, 3) && FL[w][1] > FL[v][1]).length;
    const to = (v) => [-5.6 + md(v, 3) * 2.2, 5.3 - row(v) * 1.3];
    const part = (u, c) => Math.min(1, Math.max(0, u * 3 - c));
    await anim(tok, 1800, (u) => A9.forEach((v) => { const k = part(u, md(v, 3)); S.v[v].position.set(FL[v][0] + (to(v)[0] - FL[v][0]) * k, FL[v][1] + (to(v)[1] - FL[v][1]) * k, 0); }));
    S.bl = [0, 1, 2].map((r) => blob(-5.6 + r * 2.2, 4.0, 0.75, 2.0, BLK[r], 0.2)); A9.forEach((v) => paint(S.v[v], BLK[md(v, 3)]));
    S.B.add('互相 equivalent 的 → 同一個 class'); cap('equivalent 的就聚在同一個 class', '');
  },
  async (tok, S) => { // @1104.6
    S.B.add('自己在自己的 class；同一個 class 裡的元素，class 都一樣'); cap('同一群的 class 都一樣', '');
  },
  async (tok, S) => { // @1123.4
    S.B.add('不同 class 交集是空的：有交集就會被橋樑接成同一個'); cap('不同 class 沒有交集', '');
  },
  async (tok, S) => { // @1141.7
    S.bf = bub('Birds of a feather flock together：物以類聚', 3.2, 2.2); cap('Birds of a feather flock together', '物以類聚');
  },
  async (tok, S) => { // @1169.6
    S.B.add('equivalence relation 把元素分成不同的 classes', 'good'); cap('把元素分成不同的 class', '');
  },
]);

const PIE = 7;
function pie(x, y, r, n) {
  const ws = [];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, da = Math.PI * 2 / n;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24, a0, da * 0.97), new THREE.MeshStandardMaterial({ color: BLK[k % BLK.length], roughness: 0.7, side: THREE.DoubleSide }));
    m.position.set(x, y, -0.1); lab.world.add(m);
    const mid = a0 + da / 2; m.userData.dir = [Math.cos(mid), Math.sin(mid)];
    m.userData.lbl = lab.label('A' + '₁₂₃₄₅₆₇₈'[k], 'val'); m.userData.lbl.position.set(Math.cos(mid) * r * 0.62, Math.sin(mid) * r * 0.62, 0.05); m.add(m.userData.lbl);
    ws.push(m);
  }
  return ws;
}
scene('reA-7a-partition', '7A：集合的 partition', [
  async (tok, S) => { // @1179.4
    S.B = board(0.6, 6.3); S.B.add('集合論：partition（分割）', 'ptr'); cap('集合裡有個東西叫 partition', '');
  },
  async (tok, S) => { // @1197.0
    S.B.add('A 的 partition：一些 non-empty subsets Aᵢ'); cap('一些不是空的 subset', '');
  },
  async (tok, S) => { // @1208.2
    S.B.add('i ∈ I，I 是 index set（例：A₁、A₃、A₅，不一定連續）'); cap('用 index set 編號', '');
  },
  async (tok, S) => { // @1237.7
    S.B.add('① ⋃_{i∈I} Aᵢ = A：全部 union 起來是 A', 'ptr alt'); cap('條件一：union 是原來的集合', '');
  },
  async (tok, S) => { // @1245.6
    S.B.add('② i ≠ j ⇒ Aᵢ ∩ Aⱼ = ∅：兩兩 disjoint', 'ptr alt'); cap('條件二：兩兩交集是空集合', '');
  },
  async (tok, S) => { // @1284.0
    S.B.add('這些 Aᵢ 叫做 A 的一個 partition', 'good'); cap('叫 A 的 partition', '');
  },
  async (tok, S) => { // @1301.0
    S.pie = pie(-3.4, 3.4, 2.4, PIE); S.n = note('示意：A 切成 A₁ … A₇', -3.4, 6.4); cap('把 A 切成一塊一塊', '');
  },
  async (tok, S) => { // @1329.0
    await anim(tok, 900, (u) => S.pie.forEach((m) => m.position.set(-3.4 + m.userData.dir[0] * 0.35 * u, 3.4 + m.userData.dir[1] * 0.35 * u, -0.1)));
    S.bp = bub('就像一個 pie 切開來', -3.4, 0.4); cap('就像把 pie 切開', '');
  },
]);

// ════════ gK9BvMo2uCY（趙啟超 7B：distinct equivalence classes 是 partition、partition 定義 equivalence relation、一一對應） ════════
const D9 = [...new Set(A9.map((x) => cls3(x).join(',')))].map((s) => s.split(',').map(Number));
const UNION_OK = A9.every((v) => D9.some((c) => c.includes(v)));
const DISJ_OK = D9.every((c, i) => D9.every((d, j) => i === j || !c.some((v) => d.includes(v))));
// 示意 partition：A = {1,…,6} = {1,2} ∪ {3,4,5} ∪ {6}
const A6 = ['1', '2', '3', '4', '5', '6'];
const PART6 = [['1', '2'], ['3', '4', '5'], ['6']];
const blkOf = (x) => PART6.findIndex((b) => b.includes(x));
const RP = relOf(A6, (a, b) => blkOf(a) === blkOf(b));
const RP_P = propsOf(A6, RP);
const PP6 = { 1: [-5.9, 4.6], 2: [-5.0, 3.2], 3: [-3.5, 5.2], 4: [-2.6, 3.9], 5: [-3.6, 2.6], 6: [-1.0, 4.0] };
function part6(S) {
  S.pb = [blob(-5.45, 3.9, 0.95, 1.45, BLK[0], 0.2, 0.5), blob(-3.2, 3.9, 1.1, 1.9, BLK[1], 0.2), blob(-1.0, 4.0, 0.7, 0.7, BLK[2], 0.2)];
  S.pt = [hd('A₁', -6.2, 5.8), hd('A₂', -3.2, 6.3), hd('A₃', -1.0, 5.1)];
  S.v = {}; A6.forEach((a) => { S.v[a] = dot(a, ...PP6[a], BLK[blkOf(a)]); });
}

scene('reA-7b-class2part', '7B：不同的 equivalence classes 構成 partition', [
  async (tok, S) => { // @42.3
    S.pie = pie(-3.4, 3.6, 2.0, 5); S.B = board(0.6, 6.3); S.B.add('把 pie 切成一塊一塊：兩塊之間交集是空的'); cap('pie 切成一塊塊', '這就是 partition');
  },
  async (tok, S) => { // @50.4
    S.B.add('這跟 equivalence class 有什麼關係？', 'ptr'); cap('和 equivalence class 的關係', '');
  },
  async (tok, S) => { // @62.0
    gone(S.pie); nine(S); S.n = note('示意：A = {0,…,8}，R = mod 3', -3.6, 6.6);
    S.B.add('A 上定義一個 equivalence relation R → 有 equivalence classes'); cap('有 equivalence relation 就有 classes', '');
  },
  async (tok, S) => { // @86.3
    S.bl = [0, 1, 2].map((r) => clsBlob(r, BLK[r])); A9.forEach((v) => paint(S.v[v], BLK[md(v, 3)]));
    S.B.add('不同的 equivalence classes 構成 A 的一個 partition', 'ptr alt'); cap('不同的 classes 就是一個 partition', '');
  },
  async (tok, S) => { // @104.6
    S.B.add('[0] = [3] = [6] = ' + setStr(cls3(0)) + '：一樣的只算一次 → ' + D9.length + ' 個不同的' + ck(D9.length === 3)); cap('一樣的 class 只算一次', '');
  },
  async (tok, S) => { // @115.2
    S.B.add('要證：union 是 A，而且兩兩交集是空集合'); cap('要證 partition 的兩個條件', '');
  },
  async (tok, S) => { // @152.2
    S.B.add('union = A：每個元素都在自己的 class 裡（性質 a）' + ck(UNION_OK), 'good'); cap('每個元素都在自己的 class', '一個都不會漏');
  },
  async (tok, S) => { // @169.4
    S.B.add('不同的 class 交集 = ∅（性質 c：不一樣就 disjoint）' + ck(DISJ_OK), 'good'); cap('不同的 class 交集是空的', '');
  },
]);

scene('reA-7b-part2rel', '7B：反過來——由 partition 定義 equivalence relation', [
  async (tok, S) => { // @183.7
    S.B = board(0.6, 6.3); S.B.add('equivalence relation → classes → partition'); cap('有 equivalence relation 就有 partition', '');
  },
  async (tok, S) => { // @223.0
    part6(S); S.n = note('示意 partition', -3.4, 1.0); S.B.add('反過來：先有一個 partition', 'ptr'); cap('反過來：先有 partition', '');
  },
  async (tok, S) => { // @249.0
    S.B.add('定義：x R y ⇔ x、y 在 partition 的同一個 subset', 'ptr alt');
    S.B.add('R = ' + PART6.map((b) => b.length + '²').join(' + ') + ' = ' + RP.size + ' 個 pair', 'idx'); cap('同一塊就說有關係', '');
  },
  async (tok, S) => { // @292.9
    S.B.add('這樣定義的 relation 會是 equivalence relation'); cap('它會是 equivalence relation', '');
  },
  async (tok, S) => { // @336.4
    S.B.add('只要證 reflexive、symmetric、transitive', 'ptr'); cap('證三個條件就好', '');
  },
]);

scene('reA-7b-proof', '7B：證明「同一塊」是 equivalence relation', [
  async (tok, S) => { // @349.4
    part6(S); S.l = A6.map((a) => loopAt(PP6[a], TC.green)); S.B = board(0.6, 6.3);
    S.B.add('reflexive：x 跟自己當然在同一塊' + ck(RP_P.ref), 'good'); cap('反身性：自己跟自己同一塊', '');
  },
  async (tok, S) => { // @380.7
    gone(S.l); S.a = [darr(PP6[3], PP6[4], TC.a), darr([PP6[4][0] + 0.1, PP6[4][1] - 0.1], [PP6[3][0] + 0.1, PP6[3][1] - 0.1], TC.b)];
    S.B.add('symmetric：x、y 同一塊 ⇒ y、x 同一塊' + ck(RP_P.sym), 'good'); cap('對稱性：把話再說一次', '');
  },
  async (tok, S) => { // @429.1
    gone(S.a, S.pb, S.pt, Object.values(S.v));
    S.bi = blob(-4.6, 3.6, 1.7, 1.5, TC.a, 0.2); S.bj = blob(-2.2, 3.6, 1.7, 1.5, TC.b, 0.2);
    S.ti = hd('Aᵢ', -5.6, 5.3); S.tj = hd('Aⱼ', -1.2, 5.3); S.x = dot('x', -5.4, 3.4); S.y = dot('y', -3.4, 3.6, TC.gold); S.z = dot('z', -1.4, 3.4);
    S.B.add('transitive：x、y ∈ Aᵢ；y、z ∈ Aⱼ（先不能說兩塊一樣）'); cap('x、y 在 Aᵢ；y、z 在 Aⱼ', '');
  },
  async (tok, S) => { // @481.0
    S.B.add('y 在 Aᵢ ∩ Aⱼ 裡 → 交集不是空的 → Aᵢ 一定等於 Aⱼ', 'ptr alt'); cap('兩塊都含 y', '所以一定是同一塊');
  },
  async (tok, S) => { // @506.2
    S.B.add('不然就和 partition（不同塊交集 = ∅）矛盾'); cap('否則違反 partition 的定義', '');
  },
  async (tok, S) => { // @519.5
    await anim(tok, 1000, (u) => { S.bi.position.x = -4.6 + u * 1.2; S.bj.position.x = -2.2 - u * 1.2; S.bi.scale.x = 1.7 + u * 0.6; S.bj.scale.x = 1.7 + u * 0.6; });
    txt(S.tj, 'Aⱼ = Aᵢ'); S.xz = darr([-5.4, 3.0], [-1.4, 3.0], TC.green);
    S.B.add('x、z 都在 Aᵢ ⇒ x R z', 'good'); cap('x 和 z 也在同一塊', 'x R z');
  },
  async (tok, S) => { // @539.7
    S.B.add('三個都證完 → equivalence relation（示意例子驗算' + ck(RP_P.eq) + '）', 'ptr alt'); cap('所以是 equivalence relation', '');
  },
]);

// 一一對應：左邊 = A 上所有 equivalence relations，右邊 = A 的所有 partitions（A = {1,2,3} 示意）
const A3P = setPartitions(['1', '2', '3']);
const pStr = (p) => p.map((b) => '{' + b.join('') + '}').join('');
const eqOfP = (p) => relOf(['1', '2', '3'], (a, b) => p.some((blk) => blk.includes(a) && blk.includes(b)));
const EQ3 = allRelations(['1', '2', '3']).filter((R) => propsOf(['1', '2', '3'], R).eq);
const EQ4N = countRelB(4, isEqB);
const PART4N = setPartitions(['1', '2', '3', '4']).length;
const MAP_OK = A3P.every((p) => EQ3.some((R) => R.size === eqOfP(p).size && [...R].every((k) => eqOfP(p).has(k))));
function bijPic(S, lines = true) {
  S.L = blob(-5.0, 3.6, 1.4, 2.4, TC.a, 0.16); S.R = blob(-1.4, 3.6, 1.4, 2.4, TC.b, 0.16);
  S.Lt = hd('equivalence relations', -5.0, 6.4); S.Rt = hd('partitions', -1.4, 6.4);
  S.ld = A3P.map((p, k) => dot(null, -5.0, 5.3 - k * 0.85, TC.a, 0.45)); S.rd = A3P.map((p, k) => dot(null, -1.4, 5.3 - k * 0.85, TC.b, 0.45));
  S.rl = A3P.map((p, k) => sm(pStr(p), -0.2, 5.3 - k * 0.85));
  S.ln = lines ? A3P.map((_, k) => seg(-4.8, 5.3 - k * 0.85, -1.6, 5.3 - k * 0.85, TC.gold, 0.03)) : [];
}
scene('reA-7b-bij', '7B：equivalence relations ↔ partitions 一一對應', [
  async (tok, S) => { // @550.7
    S.B = board(1.0, 6.3); S.B.add('把兩個性質放在一起看', 'ptr'); cap('把兩個性質放在一起', '');
  },
  async (tok, S) => { // @562.6
    S.B.add('equivalence relation → 它的 classes 是一個 partition'); cap('relation → partition', '');
  },
  async (tok, S) => { // @569.2
    S.B.add('partition →「在同一塊」是一個 equivalence relation'); cap('partition → relation', '');
  },
  async (tok, S) => { // @591.0
    S.B.add('一對一：one-to-one correspondence（bijection）', 'ptr alt'); cap('兩者一一對應', '');
  },
  async (tok, S) => { // @612.0
    bijPic(S, false); S.R.visible = false; S.Rt.visible = false; S.rd.forEach((d) => (d.visible = false)); S.rl.forEach((l) => showL(l, false));
    S.n = note('示意：A = {1,2,3}', -3.2, 0.6); S.B.add('左邊：A 上所有 equivalence relations 的集合（A 有限 → 有限）'); cap('左邊：所有 equivalence relations', '');
  },
  async (tok, S) => { // @647.1
    S.R.visible = true; S.Rt.visible = true; S.rd.forEach((d) => (d.visible = true)); S.rl.forEach((l) => showL(l, true));
    S.B.add('右邊：A 的所有 partitions 的集合'); cap('右邊：所有 partitions', '');
  },
  async (tok, S) => { // @666.4
    S.ln = A3P.map((_, k) => seg(-4.8, 5.3 - k * 0.85, -1.6, 5.3 - k * 0.85, TC.gold, 0.03));
    S.B.add('中間有一個 bijection：一個對一個' + ck(MAP_OK)); cap('中間有一個 bijection', '');
  },
  async (tok, S) => { // @691.0
    S.B.add('有限集合之間有 bijection → 兩邊 size 一樣：' + EQ3.length + ' = ' + A3P.length + ck(EQ3.length === A3P.length), 'good'); cap('兩邊個數一樣多', '');
  },
  async (tok, S) => { // @735.2
    S.B.add('要數 equivalence relations → 改數 partitions（比較好數）', 'ptr'); cap('數不好數的那邊 → 改數另一邊', 'enumeration');
  },
  async (tok, S) => { // @776.1
    S.B.add('例：4 個元素 → 去數 partition（列舉：' + PART4N + ' = ' + EQ4N + ck(PART4N === EQ4N) + '）'); cap('四個元素：數 partition 就好', '');
  },
]);

// ════════ lmgRzAA4ZbY（趙啟超 7C：數 partition、mod n 的 classes、分班、等號、partial order 定義） ════════
const EQ3N = countRelB(3, isEqB);
const BY_SIZE = (k) => A3P.filter((p) => p.length === k).length;
scene('reA-7c-recap', '7C：複習——兩邊一一對應、個數一樣', [
  async (tok, S) => { // @3.8
    bijPic(S); S.n = note('示意：A = {1,2,3}', -3.2, 0.6); S.B = board(1.0, 6.0);
    S.B.add('A 上所有 equivalence relations ↔ A 的所有 partitions', 'ptr'); cap('兩個集合之間有 bijection', '');
  },
  async (tok, S) => { // @7.7
    S.B.add('A 有限 → 兩邊 size 一樣，從哪一邊算都可以', 'good'); cap('兩邊數目一樣', '算哪邊都可以');
  },
]);

// 三個元素的 5 種 partition，一列一種
function partRow(p, y, x0 = -6.0) {
  const out = [], pos = {}; let x = x0;
  p.forEach((blk, bi) => {
    const xs = x; blk.forEach((e) => { pos[e] = [x, y]; out.push(dot(e, x, y, BLK[bi], 0.75)); x += 0.75; });
    out.push(blob((xs + x - 0.75) / 2, y, 0.25 + blk.length * 0.38, 0.38, BLK[bi], 0.22)); x += 0.55;
  });
  return out;
}
const rowY = (k) => 5.6 - k * 0.95;
const SORTED3 = [...A3P].sort((a, b) => b.length - a.length);
scene('reA-7c-count3', '7C：三個元素的 partition 有 1 + 3 + 1 = 5 種', [
  async (tok, S) => { // @34.3
    S.h = hd('A = {1, 2, 3}', -4.6, 6.6); S.B = board(0.4, 6.3, 0.52); S.B.add('A 有三個元素：不同的 partition 有幾種？', 'ptr'); cap('三個元素的集合有幾種 partition？', '');
  },
  async (tok, S) => { // @49.7
    S.B.add('只要懂 partition 的定義：數一數就好'); cap('懂定義就數得出來', '');
  },
  async (tok, S) => { // @59.6
    S.r = [partRow(SORTED3[0], rowY(0))]; S.c1 = sm('各自一塊：' + BY_SIZE(3) + ' 種', -1.4, rowY(0));
    S.B.add('三個各自一塊：' + BY_SIZE(3) + ' 種'); cap('每個自己一塊：1 種', '');
  },
  async (tok, S) => { // @72.0
    [1, 2, 3].forEach((k) => S.r.push(partRow(SORTED3[k], rowY(k)))); S.c2 = sm('兩個一塊＋一個：' + BY_SIZE(2) + ' 種', -1.4, rowY(2));
    S.B.add('兩個一塊、一個一塊：' + BY_SIZE(2) + ' 種（看哪一個落單）'); cap('兩個一起、一個落單：3 種', '');
  },
  async (tok, S) => { // @96.2
    S.r.push(partRow(SORTED3[4], rowY(4))); S.c3 = sm('全部一塊：' + BY_SIZE(1) + ' 種', -1.4, rowY(4));
    S.B.add('三個全部一塊：' + BY_SIZE(1) + ' 種'); cap('全部在一起：1 種', '');
  },
  async (tok, S) => { // @105.2
    S.B.add('沒有別的了：1 + 3 + 1 = ' + A3P.length + ck(A3P.length === 5), 'good'); cap('一共 5 種 partition', '');
  },
  async (tok, S) => { // @113.2
    S.B.add('答案只跟 |A| 有關，跟元素是 1 2 3 還是 4 5 6 無關'); cap('只跟元素個數有關', '');
  },
  async (tok, S) => { // @125.7
    S.B.gap(0.3); S.B.add('那三個元素上有幾個 equivalence relation？直接數不好想', 'ptr'); cap('equivalence relation 有幾個？', '要滿足三個條件，不好數');
  },
  async (tok, S) => { // @144.3
    S.B.add('兩邊一樣多 → ' + A3P.length + ' 個（2⁹ = 512 個 relation 逐一檢查：' + EQ3N + ck(EQ3N === A3P.length) + '）', 'good'); cap('所以也是 5 個', '');
  },
  async (tok, S) => { // @150.5
    const p = SORTED3[1], R = eqOfP(p);
    S.r[1].forEach((o) => { if (o.material && o.material.emissive) glow(o, '#3a2a00'); });
    S.B.add('把每一塊看成 class：' + pStr(p) + ' → R = {' + showPairs(R) + '}'); cap('把每一塊當成一個 class', '就定義了 relation');
  },
  async (tok, S) => { // @172.0
    S.B.add('四個元素：慢慢數也不難（答案：' + PART4N + ' 種）'); cap('四個元素自己數數看', '');
  },
]);

// congruence modulo n 的 classes（以 n = 3 示意）
const NN = 3, ZL = [-6, 11];
const ZC = (r) => Array.from({ length: ZL[1] - ZL[0] + 1 }, (_, i) => i + ZL[0]).filter((k) => md(k, NN) === r);
scene('reA-7c-modclass', '7C：congruence modulo n 的 equivalence classes', [
  async (tok, S) => { // @232.2
    zline(S, ZL[0], ZL[1], 0.5, 0.68); S.B = board(-6.3, 6.4, 0.5); S.B.add('congruence modulo n：A = Z 上的 equivalence relation', 'ptr'); cap('回來看 congruence modulo n', '');
  },
  async (tok, S) => { // @243.0
    S.B.add('n ≥ 2（n = 1 時 mod 1 永遠是 0，沒有意思）'); cap('n 至少是 2', '');
  },
  async (tok, S) => { // @259.3
    S.B.add('它的 equivalence classes 是哪些？'); cap('它的 classes 是哪些？', '');
  },
  async (tok, S) => { // @284.6
    S.B.add('a ≡ b ⇔ a mod n = b mod n；x mod n 只可能是 0, 1, …, n − 1'); cap('mod n 只有 0 到 n − 1', '');
  },
  async (tok, S) => { // @318.0
    S.B.add('→ 一共 n 個不同的 class'); S.n = note('示意：n = ' + NN, 4.6, 6.4); cap('所以有 n 個 class', '');
  },
  async (tok, S) => { // @322.6
    ZC(0).forEach((k) => paint(S.Z[k], BLK[0])); S.B.add('[0] = n 的倍數 = {…, −2n, −n, 0, n, 2n, …}；n = 3：' + ZC(0).join(', '), 'ptr alt'); cap('[0]：n 的倍數', '整除的那些');
  },
  async (tok, S) => { // @371.5
    ZC(1).forEach((k) => paint(S.Z[k], BLK[1])); S.B.add('[1] = 除以 n 餘 1 = {…, 1 − n, 1, 1 + n, …}：' + ZC(1).join(', ')); cap('[1]：除以 n 餘 1', '把 [0] 全部加 1');
  },
  async (tok, S) => { // @401.7
    ZC(2).forEach((k) => paint(S.Z[k], BLK[2])); S.B.add('[2] 再加 1 …… 一直到 [n − 1]：' + ZC(2).join(', ')); cap('[2]、… 到 [n − 1]', '');
  },
  async (tok, S) => { // @428.0
    const all = Array.from({ length: ZL[1] - ZL[0] + 1 }, (_, i) => i + ZL[0]);
    const n3 = new Set(all.map((k) => md(k, NN))).size;
    S.B.add('一共 n 個 equivalence classes（n = 3：' + n3 + ' 個' + ck(n3 === NN) + '）', 'good'); cap('一共 n 個 class', '');
  },
  async (tok, S) => { // @433.0
    S.B.add('每個整數都在其中一個 → union 是 Z → Z 的一個 partition', 'good'); cap('它們構成 Z 的 partition', '');
  },
  async (tok, S) => { // @449.7
    S.B.add('看 equivalence classes = 看 partition = 知道 relation 長什麼樣'); cap('看 classes 就懂這個 relation', '');
  },
]);

// 分班（示意：12 個學號）
const ST = Array.from({ length: 12 }, (_, i) => i + 1);
const stHome = (s) => [-6.0 + ((s - 1) % 6) * 1.05, 5.4 - Math.floor((s - 1) / 6) * 1.1];
scene('reA-7c-class', '7C：分班就是 partition', [
  async (tok, S) => { // @470.1
    S.v = {}; ST.forEach((s) => { S.v[s] = dot(String(s), ...stHome(s)); }); S.n = note('示意：老師說全班 174 人，這裡用 12 個學號', -3.4, 6.6);
    S.B = board(0.8, 4.4, 0.7); S.B.add('大一必修課人很多，要分班'); cap('以前大一要分班', '');
  },
  async (tok, S) => { // @487.7
    const to = (s) => [-6.0 + Math.floor((s - 1) / 2) * 1.0, s % 2 ? 3.4 : 1.9];
    await anim(tok, 1200, (u) => ST.forEach((s) => { const a = stHome(s), b = to(s); S.v[s].position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0); }));
    ST.forEach((s) => paint(S.v[s], BLK[s % 2])); S.lb = [sm('mod 2 = 1（單號）', -6.6 + 3.4, 4.0), sm('mod 2 = 0（雙號）', -6.6 + 3.4, 1.3)];
    S.B.add('單雙號：學號 mod 2 是 0 還是 1 → 兩班'); cap('單雙號分兩班', 'mod 2');
  },
  async (tok, S) => { // @491.3
    gone(S.lb); const to = (s) => [-6.0 + Math.floor((s - 1) / 3) * 1.0, 3.9 - md(s, 3) * 1.25];
    const fr = ST.map((s) => S.v[s].position.clone());
    await anim(tok, 1200, (u) => ST.forEach((s, i) => { const b = to(s), sw = Math.sign(b[1] - fr[i].y) * 0.45 * Math.sin(Math.PI * u); S.v[s].position.set(fr[i].x + (b[0] - fr[i].x) * u + sw, fr[i].y + (b[1] - fr[i].y) * u, 0); }));
    ST.forEach((s) => paint(S.v[s], BLK[md(s, 3) + 2]));
    S.lb = [0, 1, 2].map((r) => sm('3n' + (r ? '+' + r : ''), -0.7, 3.9 - r * 1.25));
    S.B.add('3n、3n+1、3n+2：mod 3 → 三班'); cap('mod 3 分三班', '');
  },
  async (tok, S) => { // @513.4
    S.B.add('分班就是一個 partition（每人剛好一班）', 'good'); cap('分班就是 partition', '');
  },
  async (tok, S) => { // @529.4
    S.B.add('不同課分法不一樣：這門課同班，那門課不一定'); cap('每門課的分法不同', '');
  },
]);

const AE = ['1', '2', '3', '4', '5', '6'];
const EQREL = relOf(AE, (a, b) => a === b), EQ_P = propsOf(AE, EQREL);
scene('reA-7c-equal', '7C：等號是最強的 equivalence relation', [
  async (tok, S) => { // @538.4
    S.B = board(0.4, 6.3); S.B.add('另一個 equivalence relation：等號 =（equality）', 'ptr'); cap('另一個例子：等號', '');
  },
  async (tok, S) => { // @554.3
    S.B.add('claim：= 是 equivalence relation'); cap('等號是 equivalence relation', '');
  },
  async (tok, S) => { // @565.6
    S.B.add('x = x；x = y ⇒ y = x；x = y、y = z ⇒ x = z' + ck(EQ_P.eq), 'good'); cap('三個條件都沒問題', '');
  },
  async (tok, S) => { // @579.5
    S.B.add('最強的 equivalence relation：一般的 equivalence 是「放鬆的等號」'); cap('equivalence 像放鬆的等號', '');
  },
  async (tok, S) => { // @613.4
    S.v = AE.map((a, i) => dot(a, -6.0 + (i % 3) * 2.0, 4.8 - Math.floor(i / 3) * 2.0)); S.n = note('示意：A = {1,…,6}', -4.0, 6.6);
    S.B.add('x 的 equivalence class：只有 x 自己'); cap('每個 class 只有自己', '');
  },
  async (tok, S) => { // @642.3
    S.bl = AE.map((a, i) => blob(-6.0 + (i % 3) * 2.0, 4.8 - Math.floor(i / 3) * 2.0, 0.55, 0.55, BLK[i], 0.25));
    S.B.add('partition：每一塊都只有一個元素'); cap('partition：一個元素一塊', '');
  },
  async (tok, S) => { // @646.1
    S.B.add('一個元素的集合叫 singleton', 'ptr alt'); cap('singleton：一個元素的集合', '');
  },
  async (tok, S) => { // @684.9
    S.B.add('equivalence relation 的重點：classes 物以類聚、兩兩交集是空的', 'good'); cap('equivalence relation 講到這裡', '');
  },
]);

scene('reA-7c-po', '7C：partial order 的定義', [
  async (tok, S) => { // @702.0
    S.B = board(-6.3, 6.3); S.B.add('另一個常見的 relation：partial order（偏序）', 'ptr'); cap('下一個：partial order', '');
  },
  async (tok, S) => { // @717.1
    S.B.add('也叫 partial ordering（partial ordering relation）'); cap('有的書叫 partial ordering', '');
  },
  async (tok, S) => { // @742.6
    S.B.add('一樣要滿足三個條件'); cap('一樣三個條件', '');
  },
  async (tok, S) => { // @747.1
    S.B.add('① reflexive：a R a（跟 equivalence 一樣）'); S.m1 = mini('ref', 4.2, 5.7); cap('第一個一樣：reflexive', '');
  },
  async (tok, S) => { // @770.3
    S.B.add('③ transitive：a R b、b R c ⇒ a R c（也一樣）'); S.m3 = mini('tra', 4.2, 1.7); cap('第三個也一樣：transitive', '');
  },
  async (tok, S) => { // @786.0
    S.B.add('中間不一樣：symmetric 換成 antisymmetric', 'ptr alt'); cap('中間換成 antisymmetric', '');
  },
  async (tok, S) => { // @794.4
    S.m2 = mini('sym', 4.2, 3.8); S.x2 = bad('a ≠ b 時不能兩個都在', 4.2, 3.0);
    S.B.add('② antisymmetric：a R b 且 b R a ⇒ a = b'); cap('a R b 又 b R a，只能 a = b', '');
  },
  async (tok, S) => { // @821.6
    S.B.add('三個都滿足 → partial order', 'good'); cap('滿足三個就是 partial order', '');
  },
  async (tok, S) => { // @837.0
    S.B.gap(0.3); S.B.add('order：排順序；partial：只有一部分可以排'); cap('order 是排順序', 'partial 是部分可以排');
  },
  async (tok, S) => { // @864.2
    S.B.add('兩個不一樣的，不能 a 在 b 前面、b 又在 a 前面'); cap('不能互相排在對方前面', '');
  },
  async (tok, S) => { // @887.0
    S.B.add('a 在 b 前、b 在 c 前 ⇒ a 在 c 前'); cap('順序可以傳下去', '');
  },
  async (tok, S) => { // @902.2
    S.B.add('partial：不是任何兩個都能排順序', 'ptr alt'); cap('不是任兩個都能排', '');
  },
]);

// ════════ zuoCvi9f56Y（趙啟超 7D：整除與 ⊆ 是 partial order、Hasse diagram 的畫法與兩個例子） ════════
const N12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DIV12_P = propsOf(N12, relOf(N12, (a, b) => divs(+a, +b)));
scene('reA-7d-div', '7D：整除是自然數上的 partial order', [
  async (tok, S) => { // @4.2
    S.B = board(-6.3, 6.4, 0.52); S.B.add('集合：所有自然數 N = {1, 2, 3, …}', 'ptr'); cap('集合是所有的自然數', '');
  },
  async (tok, S) => { // @6.4
    S.B.add('relation：a | b（a 整除 b）', 'ptr alt'); cap('關係：a 整除 b', '');
  },
  async (tok, S) => { // @7.5
    S.B.add('a 是 b 的因數；b 是 a 的倍數'); cap('a 是 b 的因數', '');
  },
  async (tok, S) => { // @9.4
    S.B.add('問：整除是不是 partial order？'); cap('它是不是 partial order？', '');
  },
  async (tok, S) => { // @34.2
    S.B.add('a | b ⇔ b = a·k（k 是某個自然數）'); cap('定義：b = a 乘某個自然數', '');
  },
  async (tok, S) => { // @48.7
    S.d = { 2: dot('2', 3.4, 5.4), 3: dot('3', 5.2, 5.4) }; S.l = [loopAt([3.4, 5.4], TC.green), loopAt([5.2, 5.4], TC.green)];
    S.B.add('reflexive：a | a（2 | 2、3 | 3）' + ck(DIV12_P.ref), 'good'); cap('自己整除自己', 'reflexive 成立');
  },
  async (tok, S) => { // @65.1
    S.B.add('antisymmetric：a | b 且 b | a ⇒ a = b？', 'ptr'); cap('再來是 antisymmetric', '');
  },
  async (tok, S) => { // @81.7
    S.B.add('b = a·k₁、a = b·k₂ → b/a 和 a/b 都是正整數'); cap('互為倍數', '兩個比值都是正整數');
  },
  async (tok, S) => { // @117.6
    S.B.add('b/a 和 a/b 互為倒數'); cap('兩個比值互為倒數', '');
  },
  async (tok, S) => { // @126.4
    S.B.add('互為倒數的正整數只有 1 → b/a = 1 → a = b' + ck(DIV12_P.anti), 'good'); cap('只有 1 和 1 互為倒數', '所以 a = b');
  },
  async (tok, S) => { // @153.6
    S.B.clear(); S.B.add('transitive：a | b、b | c ⇒ a | c？', 'ptr'); cap('最後是 transitive', '');
  },
  async (tok, S) => { // @173.5
    S.B.add('b = a·k₁、c = b·k₂（k₁、k₂ 不一定一樣）'); cap('寫出兩個定義', '');
  },
  async (tok, S) => { // @212.0
    S.B.add('c = (a·k₁)·k₂ = a·(k₁k₂) → a | c' + ck(DIV12_P.tra), 'good'); cap('代進去：c 是 a 的倍數', '');
  },
  async (tok, S) => { // @236.7
    S.B.add('整除是 N 上的 partial order（1…12 暴力驗算' + ck(DIV12_P.po) + '）', 'ptr alt'); cap('整除是 partial order', '');
  },
  async (tok, S) => { // @252.3
    gone(S.l, Object.values(S.d)); S.d = { 1: dot('1', 3.4, 2.6), 2: dot('2', 4.7, 2.6), 3: dot('3', 6.0, 4.4) };
    S.a = darr([3.4, 2.6], [6.0, 4.4], TC.green); S.x = bad('2 ∤ 3、3 ∤ 2：不能比', 4.8, 1.6);
    S.B.add('1 | 3 可以排；2 和 3 不能排 → partial'); cap('有的可以比，有的不行', '所以叫 partial');
  },
  async (tok, S) => { // @296.0
    S.B.add('順序：因數排在倍數前面', 'good'); cap('用因數來排順序', '');
  },
]);

const SL = ['a', 'b', 'c'];
const SUBS = Array.from({ length: 8 }, (_, m) => m);
const subStr = (m) => (m ? '{' + SL.filter((_, i) => (m >> i) & 1).join(',') + '}' : '∅');
const SUBN = SUBS.map(String);
const SUB_P = propsOf(SUBN, relOf(SUBN, (x, y) => (+x & +y) === +x));
const subLe = (x, y) => (x & y) === x;
scene('reA-7d-subset', '7D：power set 上的 ⊆ 是 partial order', [
  async (tok, S) => { // @315.3
    S.B = board(-6.3, 6.3); S.B.add('第二個例子：power set', 'ptr'); cap('第二個例子：power set', '');
  },
  async (tok, S) => { // @325.0
    S.s = SUBS.map((m, i) => pl(subStr(m), 2.2 + (i % 4) * 1.35, 5.7 - Math.floor(i / 4) * 0.8)); S.n = note('示意：S = {a, b, c}', 3.8, 6.6);
    S.B.add('A = P(S)：S 的所有 subset 構成的集合'); cap('P(S)：所有 subset 的集合', '每個 element 是一個 subset');
  },
  async (tok, S) => { // @356.4
    S.B.add('partial order：⊆（包含於）', 'ptr alt'); cap('關係是 ⊆', '');
  },
  async (tok, S) => { // @386.0
    S.B.add('reflexive：A ⊆ A' + ck(SUB_P.ref), 'good'); cap('自己包含於自己', '');
  },
  async (tok, S) => { // @410.3
    S.B.add('antisymmetric：A ⊆ B 且 B ⊆ A ⇒ A = B' + ck(SUB_P.anti), 'good'); cap('互相包含就相等', '證集合相等的老方法');
  },
  async (tok, S) => { // @434.0
    S.B.add('transitive：A ⊆ B、B ⊆ C ⇒ A ⊆ C' + ck(SUB_P.tra), 'good'); cap('包含可以傳下去', '');
  },
  async (tok, S) => { // @454.4
    S.B.add('⊆ 是 P(S) 上的 partial order（8 個 subset 暴力驗算' + ck(SUB_P.po) + '）', 'ptr alt'); cap('⊆ 是 partial order', '');
  },
  async (tok, S) => { // @462.0
    setCls(S.s[1], 'ptr alt'); setCls(S.s[2], 'ptr alt');
    S.B.add('{a} 和 {b} 誰也不包含誰' + ck(!subLe(1, 2) && !subLe(2, 1)) + ' → partial'); cap('不是任兩個都能比', '');
  },
  async (tok, S) => { // @483.4
    S.B.add('equivalence：等價；partial order：排順序（但不是任兩個）', 'good'); cap('兩種 relation 的味道不同', '');
  },
]);

scene('reA-7d-hasse', '7D：Hasse diagram 的畫法', [
  async (tok, S) => { // @498.4
    S.B = board(0.4, 6.3); S.B.add('有限集合上的 partial order：用一個圖來描述'); cap('用圖描述 partial order', '');
  },
  async (tok, S) => { // @510.6
    S.B.add('Hasse diagram（Helmut Hasse，德國數學家，1898–1979）', 'ptr'); cap('Hasse diagram', '');
  },
  async (tok, S) => { // @553.0
    S.B.add('把 partial order 寫成 ≼（只是符號）'); cap('partial order 寫成 ≼', '');
  },
  async (tok, S) => { // @566.4
    S.P = { a: [-4.6, 1.4], c: [-3.0, 3.4], b: [-4.6, 5.4] }; S.v = {}; Object.keys(S.P).forEach((n) => { S.v[n] = dot(n, ...S.P[n]); });
    S.n = note('示意', -6.2, 6.4); S.B.add('每個 element 畫一個點'); cap('每個 element 一個點', '');
  },
  async (tok, S) => { // @580.5
    S.B.add('a、b 要連線時：a 畫在 b 的下面'); cap('小的畫在下面', '');
  },
  async (tok, S) => { // @604.0
    S.B.add('連線條件 ①：a ≼ b', 'ptr alt'); cap('條件一：a ≼ b', '');
  },
  async (tok, S) => { // @612.1
    S.B.add('② a ≠ b（合起來寫成 a ≺ b）', 'ptr alt'); cap('條件二：a 和 b 不一樣', '自己跟自己不連');
  },
  async (tok, S) => { // @628.1
    S.e = [seg(...S.P.a, ...S.P.c), seg(...S.P.c, ...S.P.b)];
    S.B.add('③ 中間沒有 c 使 a ≺ c ≺ b', 'ptr alt'); cap('條件三：中間沒有 c', '');
  },
  async (tok, S) => { // @650.0
    S.ab = dash([S.P.a, S.P.b], TC.hot); S.x = bad('有 c 在中間 → a、b 不連', -5.6, 3.4);
    S.B.add('有這樣的 c：a、b 就不連；其他情況就連', 'good'); cap('有中間人就不連', '');
  },
]);
function dash(pts, c = TC.hot, r = 0.04) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; const L = Math.hypot(x2 - x1, y2 - y1), k = Math.max(2, Math.round(L / 0.25));
    for (let j = 0; j < k; j += 2) { const a = j / k, b = Math.min(1, (j + 1) / k); out.push(seg(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, c, r, 0.02)); }
  }
  return out;
}

const D6 = Array.from({ length: 6 }, (_, i) => i + 1).filter((d) => 6 % d === 0).map(String);
const D6LE = (a, b) => divs(+a, +b);
const D6C = coversOf(D6, D6LE);
const D6R = relOf(D6, D6LE);
const HP6 = { 1: [-4.2, 2.6], 2: [-5.6, 4.4], 3: [-2.8, 4.4], 6: [-4.2, 6.2] };
const DP6 = { 1: [3.6, 2.6], 2: [2.2, 4.4], 3: [5.0, 4.4], 6: [3.6, 6.2] };
const hasC = (a, b) => D6C.some(([x, y]) => x === a && y === b);
scene('reA-7d-hasse6', '7D：例子——6 的因數與整除的 Hasse diagram', [
  async (tok, S) => { // @666.3
    S.B = board(-6.3, 1.4, 0.5, 3); S.B.add('舉個例子', 'ptr'); cap('舉個例子', '');
  },
  async (tok, S) => { // @670.0
    S.B.add('A = 6 的正因數 = ' + setStr(D6) + ck(D6.join() === '1,2,3,6')); cap('6 的因數：1、2、3、6', '');
  },
  async (tok, S) => { // @696.3
    S.B.add('partial order：整除'); cap('關係是整除', '');
  },
  async (tok, S) => { // @701.3
    S.v = {}; D6.forEach((d) => { S.v[d] = dot(d, ...HP6[d]); }); S.t = hd('Hasse diagram', -4.2, 7.3);
    S.B.add('4 個點；滿足關係時，前面的畫在下面'); cap('四個點，因數在下面', '');
  },
  async (tok, S) => { // @714.7
    S.B.add('自己跟自己不連（要 a ≠ b）'); cap('自己跟自己不連', '');
  },
  async (tok, S) => { // @720.4
    S.e = { '1|2': seg(...HP6[1], ...HP6[2]) }; S.B.add('1 | 2，中間沒有別的 → 連 1–2' + ck(hasC('1', '2'))); cap('1 整除 2：連起來', '');
  },
  async (tok, S) => { // @727.0
    S.e['1|3'] = seg(...HP6[1], ...HP6[3]); S.B.add('1 | 3 → 連 1–3' + ck(hasC('1', '3'))); cap('1 整除 3：連起來', '');
  },
  async (tok, S) => { // @732.6
    S.x = dash([HP6[1], HP6[6]], TC.hot); S.B.add('1 | 6，但 1 | 2 | 6 → 1–6 不連' + ck(!hasC('1', '6')), 'bad'); cap('1 和 6 不連', '中間有 2');
  },
  async (tok, S) => { // @739.0
    gone(S.x); S.e['3|6'] = seg(...HP6[3], ...HP6[6]); S.e['2|6'] = seg(...HP6[2], ...HP6[6]);
    S.B.add('3 | 6、2 | 6 → 連；cover 邊共 ' + D6C.length + ' 條' + ck(D6C.length === Object.keys(S.e).length && D6C.every(([a, b]) => S.e[a + '|' + b]))); cap('3–6、2–6 連起來', '');
  },
  async (tok, S) => { // @761.5
    S.B.add('自己跟自己本來就滿足（reflexive）：不畫'); cap('讓圖簡潔一點', '');
  },
  async (tok, S) => { // @776.4
    S.w = {}; D6.forEach((d) => { S.w[d] = dot(d, ...DP6[d], TC.a); }); S.t2 = hd('當成 relation 的 digraph', 3.6, 7.3);
    S.lp = D6.map((d) => loopAt(DP6[d], TC.gold));
    S.ar = {}; pairs(D6R).filter(([a, b]) => a !== b).forEach(([a, b]) => { S.ar[a + '|' + b] = darr(DP6[a], DP6[b], TC.a); });
    const arcs = S.lp.length + Object.keys(S.ar).length;
    S.B.add('對比：digraph 要畫 ' + arcs + ' 條（= |R|' + ck(arcs === D6R.size) + '）'); cap('digraph 有這麼多線', '');
  },
  async (tok, S) => { // @813.3
    gone(S.lp); S.B.add('拿掉 loop：reflexive 本來就成立'); cap('先拿掉 loop', '');
  },
  async (tok, S) => { // @821.7
    gone(S.ar['1|6']); delete S.ar['1|6']; S.B.add('拿掉 1→6：1→2→6 走得到（transitive）'); cap('走得到的就不畫', '');
  },
  async (tok, S) => { // @834.2
    const same = Object.keys(S.ar).length === D6C.length && D6C.every(([a, b]) => S.ar[a + '|' + b]);
    S.B.add('剩下的就是 Hasse diagram' + ck(same) + '：往上走走得到 ⇔ 有關係', 'good'); cap('往上走得到就有關係', '');
  },
]);

const HPOS = { 0: [-3.4, 0.8], 1: [-5.4, 2.6], 2: [-3.4, 2.6], 4: [-1.4, 2.6], 3: [-5.4, 4.4], 5: [-3.4, 4.4], 6: [-1.4, 4.4], 7: [-3.4, 6.2] };
const PCOV = coversOf(SUBS, subLe);
const PLE_N = SUBS.reduce((s, x) => s + SUBS.filter((y) => subLe(x, y)).length, 0);
const popc = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
scene('reA-7d-hassepow', '7D：例子——P({a,b,c}) 與 ⊆ 的 Hasse diagram', [
  async (tok, S) => { // @884.0
    S.B = board(0.6, 6.3, 0.52); S.B.add('另一個例子', 'ptr'); cap('再畫一個例子', '');
  },
  async (tok, S) => { // @891.2
    S.B.add('A = P(S)，S = {a, b, c}'); cap('S = {a, b, c} 的 power set', '');
  },
  async (tok, S) => { // @903.3
    S.B.add('|A| = 2³ = ' + SUBS.length + ck(SUBS.length === 8)); cap('一共 8 個 subset', '');
  },
  async (tok, S) => { // @914.3
    S.B.add('partial order：⊆'); cap('關係是 ⊆', '');
  },
  async (tok, S) => { // @925.7
    S.v = {}; S.v[0] = dot('∅', ...HPOS[0]); S.B.add('8 個點：最下面是空集合 ∅'); cap('最下面放空集合', '');
  },
  async (tok, S) => { // @935.7
    SUBS.filter((m) => m).forEach((m) => { S.v[m] = dot(subStr(m), ...HPOS[m], TC.node, popc(m) === 3 ? 1.3 : 1.15); });
    S.B.add('一個元素的 3 個、兩個元素的 3 個、最上面 {a,b,c}'); cap('一層一層往上排', '');
  },
  async (tok, S) => { // @957.3
    S.e = {}; const add = (x, y) => { S.e[x + '|' + y] = seg(...HPOS[x], ...HPOS[y]); };
    S.add = add; [1, 2, 4].forEach((m) => add(0, m)); S.B.add('從下面連：∅ 連 {a}、{b}、{c}'); cap('∅ 連到三個單元素集合', '');
  },
  async (tok, S) => { // @967.6
    S.B.add('∅ 不直接連上面：經過這三點往上走得到'); cap('上面的不用直接連', '');
  },
  async (tok, S) => { // @979.0
    [[1, 3], [1, 5], [2, 3], [2, 6], [4, 5], [4, 6]].forEach(([x, y]) => S.add(x, y)); S.B.add('{a} 連 {a,b}、{a,c}；{b}、{c} 也一樣'); cap('單元素連到含它的兩元素集合', '');
  },
  async (tok, S) => { // @991.0
    [3, 5, 6].forEach((m) => S.add(m, 7));
    const same = Object.keys(S.e).length === PCOV.length && PCOV.every(([x, y]) => S.e[x + '|' + y]);
    S.B.add('最後連到 {a,b,c}：共 ' + PCOV.length + ' 條邊' + ck(same), 'good'); cap('最後連到 {a,b,c}', '');
  },
  async (tok, S) => { // @1005.4
    [[0, 1], [1, 3], [3, 7]].forEach(([x, y]) => { const e = S.e[x + '|' + y]; e.material.color.set(TC.orange); e.scale.x = e.scale.z = 0.1; });
    S.B.add('往上走得到 ⇔ ⊆：∅ → {a} → {a,b} → {a,b,c}'); cap('往上走得到就有 ⊆', '');
  },
  async (tok, S) => { // @1041.6
    S.B.add('看圖就知道整個 partial order'); cap('看圖就懂這個 partial order', '');
  },
  async (tok, S) => { // @1062.4
    S.B.add('要會：定義、畫圖、從圖列出所有 ordered pair（共 ' + PLE_N + ' 個' + ck(PLE_N === 27) + '）', 'ptr alt'); cap('會畫圖，也要會從圖讀回來', '');
  },
]);

// ════════ ayTx5zNqsms（趙啟超 8A：total order、數 {1,2,3} 上的 partial order（19 個）、poset、maximal／minimal） ════════
const Z11 = Array.from({ length: 11 }, (_, i) => String(i - 5));
const LEQ_P = propsOf(Z11, relOf(Z11, (a, b) => +a <= +b));
const D6_TOT = propsOf(D6, D6R).tot;
scene('reA-8a-recap', '8A：複習——partial order 與 Hasse diagram', [
  async (tok, S) => { // @4.2
    S.B = board(-6.3, 6.4, 0.7); S.B.add('partial order：集合 A 上的 relation R，三個條件', 'ptr'); cap('複習 partial order 的定義', '');
  },
  async (tok, S) => { // @7.6
    S.B.add('① reflexive：a R a'); cap('自己跟自己', 'reflexive');
  },
  async (tok, S) => { // @9.5
    S.B.add('② antisymmetric：a R b 且 b R a ⇒ a = b'); cap('互相都有，只能相等', 'antisymmetric');
  },
  async (tok, S) => { // @35.0
    S.B.add('③ transitive：a R b、b R c ⇒ a R c'); cap('可以傳下去', 'transitive');
  },
  async (tok, S) => { // @51.4
    S.B.add('有順序（前後、左右），但不是所有都能排 → partial'); cap('有順序，但只有部分能排', '');
  },
  async (tok, S) => { // @64.2
    S.H = hasse({ 1: [4.8, 0.6], 2: [3.6, 2.3], 3: [6.0, 2.3], 6: [4.8, 4.0] }, D6C); S.t = hd('6 的因數、整除', 4.8, 5.0); S.B.add('可以用 Hasse diagram 畫出整個 partial order'); cap('用 Hasse diagram 描述', '');
  },
  async (tok, S) => { // @82.0
    S.B.add('兩個例子：整除（因數關係）、⊆（包含於）'); cap('兩個例子：整除與 ⊆', '');
  },
  async (tok, S) => { // @102.7
    S.B.add('寫成 a ≼ b：看起來有「左右、前後」的味道', 'ptr alt'); cap('寫成 a ≼ b', '');
  },
]);

scene('reA-8a-total', '8A：total order——任兩個都能比', [
  async (tok, S) => { // @137.7
    S.B = board(-6.3, 6.5, 0.68, 8); S.B.add('特別的 partial order：total order（全序）', 'ptr'); cap('特別的一種：total order', 'partial 這名字的來源');
  },
  async (tok, S) => { // @156.6
    S.B.add('條件：A 裡任何兩個 element 都 comparable'); cap('任何兩個都可以比', '');
  },
  async (tok, S) => { // @170.6
    S.B.add('comparable：a ≼ b 或 b ≼ a（總分得出前後）'); cap('comparable：一定分得出前後', '');
  },
  async (tok, S) => { // @200.4
    S.B.add('一般的 partial order：兩個拿出來不一定能比'); cap('一般的不一定能比', '');
  },
  async (tok, S) => { // @209.5
    S.d = [dot('2', 3.0, 4.6), dot('3', 5.0, 4.6)]; S.x = bad('2 ∤ 3、3 ∤ 2：不能比', 4.0, 3.8);
    S.B.add('整除：2 和 3 不 comparable → 不是 total order' + ck(!D6_TOT), 'bad'); cap('整除：2 和 3 不能比', '');
  },
  async (tok, S) => { // @250.5
    gone(S.d, S.x); S.B.add('例：≤（less than or equal to）在 Z 上', 'ptr alt'); cap('例子：整數上的 ≤', '');
  },
  async (tok, S) => { // @280.2
    S.B.add('≤ 是 partial order：三個條件都成立' + ck(LEQ_P.po)); cap('≤ 是 partial order', '');
  },
  async (tok, S) => { // @297.6
    S.B.add('而且任何兩個整數都能比 → total order' + ck(LEQ_P.tot), 'good'); cap('任兩個整數都能比大小', '所以是 total order');
  },
  async (tok, S) => { // @345.0
    S.B.add('total order 的 Hasse diagram 長什麼樣？'); cap('它的 Hasse diagram？', '');
  },
  async (tok, S) => { // @359.5
    const ch = ['−2', '−1', '0', '1', '2', '3'], pos = {}; ch.forEach((n, i) => { pos[n] = [5.8, 0.4 + i * 1.15]; });
    S.H = hasse(pos, ch.slice(1).map((n, i) => [ch[i], n])); S.n = sm('（示意：Z 的一段）', 5.8, -0.3);
    S.B.add('排成一條線往上', 'good'); cap('排成一條直線', '');
  },
  async (tok, S) => { // @423.3
    S.B.add('排名次（1 2 3 …）要 total order；partial 不行'); cap('排名次要 total order', '');
  },
]);

// 數 {1,2,3} 上的 partial order：按照 Hasse diagram 的形狀分類（暴力列舉 512 個 relation）
const POS3 = [];
for (let m = 0; m < 512; m++) if (isPoB(m, 3)) POS3.push(m);
function shapeOf(m) {
  const lt = (i, j) => i !== j && bitR(m, 3, i, j);
  const cov = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (lt(i, j) && ![0, 1, 2].some((k) => lt(i, k) && lt(k, j))) cov.push([i, j]);
  if (cov.length === 0) return 0;
  if (cov.length === 1) return 1;
  const [[a, b], [c, d]] = cov;
  if (a === c) return 2;          // 一點在下、兩點在上
  if (b === d) return 3;          // 一點在上、兩點在下
  return 4;                       // 一條線
}
const SH_N = [0, 1, 2, 3, 4].map((k) => POS3.filter((m) => shapeOf(m) === k).length);
const TOT3 = POS3.filter((m) => isTotB(m, 3)).length;
const SHX = (k) => -5.4 + k * 2.6;
function drawShape(k) {
  const x = SHX(k), o = [];
  const D = (px, py) => { const m = dot(null, px, py, TC.node, 0.8); o.push(m); return [px, py]; };
  if (k === 0) { D(x - 0.7, 5.0); D(x, 5.0); D(x + 0.7, 5.0); }
  if (k === 1) { const a = D(x - 0.4, 4.3), b = D(x - 0.4, 5.8); D(x + 0.6, 5.0); o.push(seg(...a, ...b)); }
  if (k === 2) { const a = D(x, 4.3), b = D(x - 0.6, 5.8), c = D(x + 0.6, 5.8); o.push(seg(...a, ...b), seg(...a, ...c)); }
  if (k === 3) { const a = D(x, 5.8), b = D(x - 0.6, 4.3), c = D(x + 0.6, 4.3); o.push(seg(...b, ...a), seg(...c, ...a)); }
  if (k === 4) { const a = D(x, 3.9), b = D(x, 5.0), c = D(x, 6.1); o.push(seg(...a, ...b), seg(...b, ...c)); }
  return o;
}
const SH_SAID = [1, 6, 3, 3, 6];
const shTag = (k, extra = '') => good(SH_N[k] + ' 個' + ck(SH_N[k] === SH_SAID[k]) + extra, SHX(k), 3.2);
scene('reA-8a-count', '8A：{1,2,3} 上有幾個 partial order？（19 個）', [
  async (tok, S) => { // @446.0
    S.B = board(-6.3, 2.3, 0.5, 5); S.B.add('enumeration：離散數學很重要的部分——數數目', 'ptr'); cap('enumeration：數一數', '');
  },
  async (tok, S) => { // @457.1
    S.h = hd('A = {1, 2, 3}', 0, 7.0); S.B.add('A = {1, 2, 3}'); cap('A 有三個元素', '');
  },
  async (tok, S) => { // @461.4
    S.B.add('A 上的 relation = A × A 的 subset，不一定是 partial order'); cap('relation 不一定是 partial order', '');
  },
  async (tok, S) => { // @477.0
    S.B.add('問：有幾個是 partial order？其中幾個是 total order？', 'ptr alt'); cap('有幾個 partial order？', '幾個 total order？');
  },
  async (tok, S) => { // @502.4
    S.B.add('方法一：A × A 有 9 個 pair → 2⁹ = ' + (1 << 9) + ' 個 relation，一個一個 check（麻煩、容易漏）'); cap('方法一：全部 check', '可以做，但很麻煩');
  },
  async (tok, S) => { // @532.5
    S.B.add('方法二：數有幾種不同的 Hasse diagram', 'ptr'); cap('方法二：數 Hasse diagram', '');
  },
  async (tok, S) => { // @565.8
    S.B.add('三個 element → 三個點，中間有的連、有的不連'); cap('三個點，連或不連', '');
  },
  async (tok, S) => { // @574.6
    S.s0 = drawShape(0); S.c0 = shTag(0);
    S.B.add('三點都不連：只有 (1,1)、(2,2)、(3,3) → 怎麼標號都是同一個'); cap('都不連：只有 1 個', '標號怎麼換都一樣');
  },
  async (tok, S) => { // @665.1
    S.s1 = drawShape(1); S.B.add('兩點連、一點獨立'); cap('兩點有關係、一點獨立', '');
  },
  async (tok, S) => { // @710.2
    S.c1 = shTag(1); S.B.add('獨立的點 3 種 × 誰在上面 2 種 = 3 × 2 × 1 = 6'); cap('3 × 2 × 1 = 6 個', '');
  },
  async (tok, S) => { // @768.1
    S.s2 = drawShape(2); S.c2 = shTag(2); S.B.add('一點在下、兩點在上：選下面那點 → 3 個（上面兩點對調一樣）'); cap('一下兩上：3 個', '');
  },
  async (tok, S) => { // @794.0
    S.s3 = drawShape(3); S.c3 = shTag(3); S.B.add('反過來，一點在上、兩點在下 → 3 個'); cap('一上兩下：3 個', '');
  },
  async (tok, S) => { // @806.0
    S.s4 = drawShape(4); S.c4 = shTag(4); S.B.add('排成一條線：3! = 6 個'); cap('一條線：3! = 6 個', '');
  },
  async (tok, S) => { // @850.3
    S.B.add('沒有別的形狀了（有線就一高一低）'); cap('沒有其他形狀了', '');
  },
  async (tok, S) => { // @866.0
    const tot = SH_SAID.reduce((s, v) => s + v, 0);
    gone(S.h); S.sum = hot('1 + 6 + 3 + 3 + 6 = ' + tot + '（512 個逐一檢查：' + POS3.length + ck(POS3.length === tot) + '）', 0, 7.0);
    cap('全部一共 19 個 partial order', '');
  },
  async (tok, S) => { // @881.4
    S.s4.forEach((m) => { if (m.material) glow(m, '#5a2a00'); }); setCls(S.c4, 'ptr alt');
    S.B.add('total order 一定是一條線：19 個裡有 ' + TOT3 + ' 個' + ck(TOT3 === 6), 'good'); cap('其中 6 個是 total order', '');
  },
  async (tok, S) => { // @908.1
    S.B.add('數 equivalence relation 時也是換個方法（數 partition），不要從 2⁹ 個去挑'); cap('換個角度數比較不會錯', '');
  },
]);

scene('reA-8a-poset', '8A：poset 與 totally ordered set', [
  async (tok, S) => { // @940.0
    S.H = hasse(HP6, D6C); S.B = board(0.4, 6.3); S.B.add('集合 A 上定義了一個 partial order'); cap('集合上有一個 partial order', '');
  },
  async (tok, S) => { // @944.0
    S.B.add('(A, ≼) 叫 partially ordered set', 'ptr'); cap('叫 partially ordered set', '');
  },
  async (tok, S) => { // @960.0
    S.B.add('簡寫 poset（P-O-S-E-T）', 'ptr alt'); cap('簡稱 poset', '');
  },
  async (tok, S) => { // @989.7
    S.B.add('如果 ≼ 是 total order → totally ordered set'); cap('total 的叫 totally ordered set', '');
  },
  async (tok, S) => { // @1006.4
    S.B.add('一般的 order 不一定 total：不見得任兩個都能比（如左圖 2、3）', 'good'); cap('一般不見得任兩個能比', '');
  },
]);

const V3S = ['1', '2', '3'], V3LE = (a, b) => divs(+a, +b);
const V3MAX = maximalOf(V3S, V3LE), V3MIN = minimalOf(V3S, V3LE), V3G = greatestOf(V3S, V3LE);
const V3P = { 1: [-3.6, 1.8], 2: [-5.0, 4.6], 3: [-2.2, 4.6] };
scene('reA-8a-maxmin', '8A：maximal 與 minimal element', [
  async (tok, S) => { // @1020.3
    S.B = board(0.4, 6.3); S.B.add('後面幾個名詞：都在 poset 上定義', 'ptr'); cap('衍生出來的幾個名詞', '');
  },
  async (tok, S) => { // @1030.2
    S.B.add('寫成 ≼：左邊叫「小」、右邊叫「大」（方便講）'); cap('左邊叫小、右邊叫大', '');
  },
  async (tok, S) => { // @1047.1
    S.H = hasse(V3P, coversOf(V3S, V3LE)); S.n = note('示意：{1,2,3}、整除', -3.6, 6.4);
    S.B.add('x ∈ A 叫 maximal element（極大元素）', 'ptr alt'); cap('maximal element', '');
  },
  async (tok, S) => { // @1078.1
    S.B.add('沒有人比它大：不存在 a ∈ A 使 x ≺ a'); cap('沒有人比它大', '');
  },
  async (tok, S) => { // @1088.3
    S.B.add('x ≺ a：x ≼ a 而且 x ≠ a（把底下那一橫拿掉）'); cap('≺：滿足 ≼ 但不相等', '');
  },
  async (tok, S) => { // @1119.9
    V3MAX.forEach((v) => paint(S.H.V[v], TC.orange, '#5a2a00')); S.mx = good('maximal：' + setStr(V3MAX), -3.6, 6.0);
    S.B.add('「沒有人比它大」≠「它比所有人都大」', 'bad'); cap('不是同一件事', '');
  },
  async (tok, S) => { // @1124.0
    S.B.add('因為有些根本不能比：2 和 3 都是 maximal，但 greatest ' + none(V3G)); cap('2 和 3 不能比', '');
  },
  async (tok, S) => { // @1154.2
    V3MIN.forEach((v) => paint(S.H.V[v], TC.a, '#0b2a4a')); S.mn = good('minimal：' + setStr(V3MIN), -3.6, 0.9);
    S.B.add('minimal element：沒有人比它小（不存在 a ≺ x）', 'ptr alt'); cap('minimal：沒有人比它小', '');
  },
  async (tok, S) => { // @1201.3
    S.B.add('maximal：沒有比它大的；minimal：沒有比它小的', 'good'); cap('maximal 與 minimal', '');
  },
]);

// ════════ AqETkP2lPY4（趙啟超 8B：greatest／least、三個 Hasse 例子、lower／upper bound、glb／lub、lattice） ════════
const CH4 = ['1', '2', '4', '8'], AC4 = ['2', '3', '5', '7'], N9 = ['2', '3', '5', '7', '11', '6', '35', '12', '385'];
const DLE = (a, b) => divs(+a, +b);
const ACLE = (a, b) => a === b;          // (b) 只有自己跟自己
const EXS = [
  { A: CH4, le: DLE, P: { 1: [-5.4, 1.2], 2: [-5.4, 2.7], 4: [-5.4, 4.2], 8: [-5.4, 5.7] }, x: -5.4, nm: '(a)' },
  { A: AC4, le: ACLE, P: { 2: [-3.3, 3.4], 3: [-2.3, 3.4], 5: [-1.3, 3.4], 7: [-0.3, 3.4] }, x: -1.8, nm: '(b)' },
  { A: N9, le: DLE, P: { 2: [1.4, 1.4], 3: [2.6, 1.4], 5: [3.8, 1.4], 7: [5.0, 1.4], 11: [6.2, 1.4], 6: [2.0, 3.5], 35: [4.4, 3.5], 12: [2.0, 5.6], 385: [5.3, 5.6] }, x: 3.8, nm: '(c)' },
].map((e) => Object.assign(e, { C: coversOf(e.A, e.le), mx: maximalOf(e.A, e.le), mn: minimalOf(e.A, e.le), g: greatestOf(e.A, e.le), l: leastOf(e.A, e.le) }));
const SAID8 = [{ mx: '8', mn: '1', g: '8', l: '1' }, { mx: '2,3,5,7', mn: '2,3,5,7', g: '', l: '' }, { mx: '12,385', mn: '2,3,5,7,11', g: '', l: '' }];
// 答案寫在各自的圖下面：(b) 的圖比較高，答案放在它正下方；(a)、(c) 的答案放在最下面（兩區上下錯開，寬的標籤不會互相擠到）
const KROW = { mx: ['maximal', 0.0], mn: ['minimal', -0.65], g: ['greatest', -1.3], l: ['least', -1.95] };
const KROWB = { mx: 2.6, mn: 1.95, g: 1.3, l: 0.65 };
function exRes(S, i, k) {
  const e = EXS[i], v = e[k], okk = v.join(',') === SAID8[i][k];
  S.res.push(ok(okk, e.x, i === 1 ? KROWB[k] : KROW[k][1], KROW[k][0] + '：' + none(v) + ' ✓'));
  const col = { mx: [TC.orange, '#5a2a00'], mn: [TC.a, '#0b2a4a'], g: [TC.hot, '#5a0000'], l: [TC.green, '#0f5a3a'] }[k];
  v.forEach((n) => paint(S.H[i].V[n], col[0], col[1]));
}
scene('reA-8b-great', '8B：greatest 與 least element', [
  async (tok, S) => { // @4.2
    S.B = board(0.2, 6.3); S.B.add('前面：maximal、minimal；現在：greatest', 'ptr'); cap('再來是 greatest element', '');
  },
  async (tok, S) => { // @5.8
    S.H = hasse(V3P, coversOf(V3S, V3LE)); S.n = note('示意：{1,2,3}、整除', -3.6, 6.4);
    S.B.add('greatest element x：比所有人都大（對所有 a ∈ A，a ≼ x）', 'ptr alt'); cap('greatest：比所有人都大', '');
  },
  async (tok, S) => { // @7.2
    S.B.add('先決條件：x 要跟所有人都能比'); cap('先要跟每個人都能比', '');
  },
  async (tok, S) => { // @35.5
    S.B.add('least element x：比所有人都小（對所有 a，x ≼ a）', 'ptr alt'); cap('least：比所有人都小', '');
  },
  async (tok, S) => { // @53.0
    S.B.add('greatest 和 maximal 不一樣', 'bad'); cap('greatest ≠ maximal', '');
  },
  async (tok, S) => { // @66.5
    V3MAX.forEach((v) => paint(S.H.V[v], TC.orange, '#5a2a00'));
    S.t = good('maximal：' + setStr(V3MAX) + '，greatest：' + none(V3G), -3.6, 0.6);
    S.B.add('maximal 只說「沒有人比它大」，不一定比所有人大（2、3 不能比）'); cap('maximal 不一定比所有人大', '因為有些不能比');
  },
  async (tok, S) => { // @82.4
    S.B.add('同理：minimal 和 least 也不一樣', 'good'); cap('minimal 和 least 也不同', '');
  },
]);

scene('reA-8b-ex', '8B：三個例子——找 maximal、minimal、greatest、least', [
  async (tok, S) => { // @85.6
    S.top = hd('三個 partial order（用 Hasse diagram 畫）', 0, 7.2); cap('看三個例子', '');
  },
  async (tok, S) => { // @92.4
    S.H = EXS.map((e) => hasse(e.P, e.C)); S.res = [];
    S.lab = EXS.map((e, i) => sm(e.nm, i === 2 ? 6.6 : e.x, i === 2 ? 5.6 : i === 1 ? 4.2 : 6.5));
    S.n = note('(c) 依老師說的答案重建的整除關係（示意）', 3.6, 6.55);
    const okC = EXS.every((e, i) => e.C.length === [3, 0, 7][i]);
    S.ck = sm('三個都是合法的 Hasse diagram' + ck(okC), -1.8, 0.4); cap('(a) 1 2 4 8 (b) 2 3 5 7 (c) 九個', '');
  },
  async (tok, S) => { // @125.5
    gone(S.ck); S.b1 = bub('每個例子問四件事：maximal、minimal、greatest、least', -1.0, 7.9); cap('哪些是 maximal、minimal？', 'greatest、least 呢？');
  },
  async (tok, S) => { // @139.1
    exRes(S, 0, 'mx'); cap('(a) maximal：8', '沒有人比它大');
  },
  async (tok, S) => { // @144.3
    exRes(S, 0, 'mn'); cap('(a) minimal：1', '');
  },
  async (tok, S) => { // @151.5
    exRes(S, 0, 'g'); cap('(a) greatest：8', '比所有人都大');
  },
  async (tok, S) => { // @158.7
    exRes(S, 0, 'l'); cap('(a) least：1', '');
  },
  async (tok, S) => { // @164.3
    gone(S.b1); S.b1 = bub('total order：maximal = greatest、minimal = least', -3.0, 7.9); cap('total order 時兩者一樣', '排成一條隊伍');
  },
  async (tok, S) => { // @190.3
    gone(S.b1); S.b1 = bub('(b) 四個元素，只有自己跟自己有關係', -3.0, 7.9); cap('(b) 只有自己跟自己', '');
  },
  async (tok, S) => { // @208.6
    exRes(S, 1, 'mx'); cap('(b) maximal：全部', '沒有人在它上面');
  },
  async (tok, S) => { // @218.0
    exRes(S, 1, 'mn'); cap('(b) minimal：也是全部', '');
  },
  async (tok, S) => { // @230.0
    exRes(S, 1, 'g'); cap('(b) greatest：沒有', '要能往下走到每一個');
  },
  async (tok, S) => { // @243.6
    exRes(S, 1, 'l'); cap('(b) least：也沒有', '');
  },
  async (tok, S) => { // @259.0
    gone(S.b1); S.b1 = bub('(c) 9 個元素', 2.0, 7.9); cap('(c) 九個元素', '');
  },
  async (tok, S) => { // @298.2
    exRes(S, 2, 'mx'); cap('(c) maximal：12 和 385', 'maximal 不只一個');
  },
  async (tok, S) => { // @310.7
    exRes(S, 2, 'mn'); cap('(c) minimal：2 3 5 7 11', '');
  },
  async (tok, S) => { // @319.0
    exRes(S, 2, 'g'); cap('(c) greatest：沒有', '12 和 385 無關');
  },
  async (tok, S) => { // @332.4
    exRes(S, 2, 'l'); cap('(c) least：沒有', '');
  },
  async (tok, S) => { // @354.3
    gone(S.b1); S.b1 = bub('partial order：不是任兩個都能比 → maximal 不一定是 greatest', -1.0, 7.9); cap('不是任兩個都能比', '世界上很多東西不能比');
  },
]);

// 示意：A = 12 的因數、整除；B = {4, 6}
const D12 = ['1', '2', '3', '4', '6', '12'];
const D12C = coversOf(D12, DLE);
const D12P = { 1: [-3.8, 0.8], 2: [-4.8, 2.6], 3: [-2.6, 2.6], 4: [-5.6, 4.4], 6: [-3.6, 4.4], 12: [-4.6, 6.2] };
const BB = ['4', '6'];
const LBs = D12.filter((x) => BB.every((b) => DLE(x, b))), UBs = D12.filter((y) => BB.every((b) => DLE(b, y)));
const GLB = greatestOf(LBs, DLE), LUB = leastOf(UBs, DLE);
scene('reA-8b-bound', '8B：lower bound、upper bound、glb、lub', [
  async (tok, S) => { // @400.4
    S.B = board(0.0, 6.3, 0.56); S.B.add('再看幾個定義', 'ptr'); cap('回去看定義', '');
  },
  async (tok, S) => { // @405.5
    S.H = hasse(D12P, D12C); BB.forEach((b) => paint(S.H.V[b], TC.b, '#4a0a2a'));
    S.bb = blob(-4.6, 4.4, 1.6, 0.6, TC.b, 0.2); S.n = note('示意：A = 12 的因數、整除；B = {4, 6}', -4.0, 7.2);
    S.B.add('(A, ≼) 是 poset，B ⊆ A（A 的一部分）'); cap('A 是 poset，B 是 A 的一部分', '');
  },
  async (tok, S) => { // @421.0
    S.B.add('定義 lower bound、upper bound'); cap('lower bound 與 upper bound', '');
  },
  async (tok, S) => { // @426.0
    LBs.forEach((x) => paint(S.H.V[x], TC.a, '#0b2a4a'));
    S.B.add('x ∈ A 是 B 的 lower bound：對所有 b ∈ B，x ≼ b → ' + setStr(LBs), 'ptr alt'); cap('lower bound：比 B 裡每個都小', '');
  },
  async (tok, S) => { // @460.2
    S.B.add('lower bound 不一定在 B 裡，在 A 裡就好（' + LBs.filter((x) => !BB.includes(x)).length + ' 個都不在 B）'); cap('不一定在 B 裡', '在 A 裡就可以');
  },
  async (tok, S) => { // @473.6
    UBs.forEach((y) => paint(S.H.V[y], TC.orange, '#5a2a00'));
    S.B.add('y 是 B 的 upper bound：對所有 b ∈ B，b ≼ y → ' + setStr(UBs), 'ptr alt'); cap('upper bound：比 B 裡每個都大', '');
  },
  async (tok, S) => { // @484.5
    S.B.add('要跟 B 每個元素都 comparable；partial order 就能定義'); cap('只要 partial order 就能定義', '');
  },
  async (tok, S) => { // @509.0
    S.B.add('lower bound 不一定只有一個：這裡有 ' + LBs.length + ' 個'); cap('lower bound 可能好幾個', '');
  },
  async (tok, S) => { // @534.6
    glow(S.H.V[GLB[0]], '#0f5a3a'); S.g = good('glb = ' + GLB[0], D12P[GLB[0]][0] - 1.2, D12P[GLB[0]][1]);
    S.B.add('greatest lower bound（glb）：本身是 lower bound，又比所有 lower bound 大', 'good'); cap('glb：最大的下界', '');
  },
  async (tok, S) => { // @598.3
    S.u = good('lub = ' + LUB[0], D12P[LUB[0]][0] + 1.3, D12P[LUB[0]][1]);
    S.B.add('least upper bound（lub）：upper bound 裡最小的', 'good'); cap('lub：最小的上界', '');
  },
]);

// B = {1/n}：在數線 [0, 1] 上
const QX = (v) => -6.0 + v * 11.0;
const NB = 400, BV = Array.from({ length: NB }, (_, i) => 1 / (i + 1));
const LUBQ = Math.max(...BV), EPS = 0.05, NEPS = Math.floor(1 / EPS) + 1;
scene('reA-8b-q', '8B：例子——B = {1/n} 的 lub 與 glb', [
  async (tok, S) => { // @627.6
    S.B = board(-6.3, 6.6, 0.68, 6); S.B.add('例子：A = Q（有理數，rational numbers）', 'ptr'); cap('A 是所有有理數', '');
  },
  async (tok, S) => { // @637.0
    S.B.add('可以寫成分數的數'); cap('有理數：可以寫成分數', '');
  },
  async (tok, S) => { // @645.4
    S.B.add('partial order：≤（其實是 total order）'); cap('關係是 ≤', '其實是 total order');
  },
  async (tok, S) => { // @659.6
    S.ax = seg(QX(-0.05), 1.0, QX(1.08), 1.0, TC.faint, 0.03); S.t0 = sm('0', QX(0), 0.4); S.t1 = sm('1', QX(1), 0.4);
    S.pts = BV.slice(0, 40).map((v) => dot(null, QX(v), 1.0, TC.a, 0.32));
    S.tl = [1, 2, 3, 4].map((n) => sm('1/' + n, QX(1 / n), 1.5));
    S.B.add('B = {1, 1/2, 1/3, 1/4, …, 1/100, 1/101, …}', 'ptr alt'); cap('B = {1/n}：越來越靠近 0', '');
  },
  async (tok, S) => { // @683.0
    S.B.add('最有興趣：lub 和 glb'); cap('看 lub 和 glb', '');
  },
  async (tok, S) => { // @690.4
    S.B.add('lub（least upper bound）是多少？'); cap('lub 是多少？', '');
  },
  async (tok, S) => { // @709.0
    S.B.add('upper bound：要比 B 裡每一個都大（≥）'); cap('upper bound 要 ≥ 每一個', '');
  },
  async (tok, S) => { // @718.3
    S.lub = good('lub = 1 ∈ B（max = ' + LUBQ + ck(LUBQ === 1) + '）', QX(1) - 0.8, 2.3);
    S.B.add('比 1 小就不是 upper bound → lub = 1', 'good'); cap('lub = 1', '');
  },
  async (tok, S) => { // @746.0
    S.B.add('glb（greatest lower bound）比較有趣', 'ptr'); cap('glb 比較有趣', '');
  },
  async (tok, S) => { // @756.4
    S.B.add('要比所有元素都小，而且是 lower bound 裡最大的'); cap('lower bound 裡最大的', '');
  },
  async (tok, S) => { // @763.4
    S.z = dot('0', QX(0), 1.0, TC.green, 0.5); S.B.add('答案是 0（學過極限就知道）'); cap('答案是 0', '');
  },
  async (tok, S) => { // @771.0
    S.e = dot(null, QX(EPS), 1.0, TC.hot, 0.45); S.et = bad('ε > 0 都會被某個 1/n 超過', QX(EPS) + 2.2, 2.3);
    S.B.add('任何 ε > 0 都不是 lower bound（例：1/' + NEPS + ' < ' + EPS + ck(1 / NEPS < EPS) + '）'); cap('任何正數都不是 lower bound', '');
  },
  async (tok, S) => { // @799.6
    gone(S.e, S.et); S.B.add('0 ≤ 每個 1/n，而且沒有更大的 lower bound → glb = 0', 'good'); cap('glb = 0', '');
  },
  async (tok, S) => { // @814.2
    S.gl = good('glb = 0 ∉ B（1/n > 0' + ck(BV.every((v) => v > 0)) + '）', QX(0) + 1.6, 2.3);
    S.B.add('lub、glb 不一定在 B 裡，但一定在 A 裡'); cap('glb 不一定在 B 裡', '');
  },
  async (tok, S) => { // @860.6
    S.B.add('glb 又叫 infimum（inf）；lub 又叫 supremum（sup）', 'ptr alt'); cap('inf 與 sup', '');
  },
  async (tok, S) => { // @915.3
    S.B.add('只要 partial order 就能定義，不需要 total order'); cap('partial order 就能定義', '');
  },
]);

// lattice：(N, ≤) 與 (N, |)
const NUP = Array.from({ length: 120 }, (_, i) => i + 1);
function lubIn(le, x, y) { const ub = NUP.filter((z) => le(x, z) && le(y, z)); return ub.filter((z) => ub.every((w) => le(z, w))); }
function glbIn(le, x, y) { const lb = NUP.filter((z) => le(z, x) && le(z, y)); return lb.filter((z) => lb.every((w) => le(w, z))); }
const LE_N = (a, b) => a <= b, DV_N = (a, b) => b % a === 0;
const L23 = lubIn(LE_N, 2, 3), G23 = glbIn(LE_N, 2, 3), L46 = lubIn(DV_N, 4, 6), G46 = glbIn(DV_N, 4, 6);
const LATT_LE = NUP.slice(0, 10).every((x) => NUP.slice(0, 10).every((y) => lubIn(LE_N, x, y)[0] === Math.max(x, y) && glbIn(LE_N, x, y)[0] === Math.min(x, y)));
const LATT_DV = NUP.slice(0, 10).every((x) => NUP.slice(0, 10).every((y) => lubIn(DV_N, x, y)[0] === lcm(x, y) && glbIn(DV_N, x, y)[0] === gcd(x, y)));
scene('reA-8b-lattice', '8B：lattice——任兩個元素都有 lub 和 glb', [
  async (tok, S) => { // @925.6
    S.B = board(0.2, 6.4, 0.52, 9); S.B.add('最後一個定義', 'ptr'); cap('最後一點點定義', '');
  },
  async (tok, S) => { // @932.0
    S.B.add('poset 裡任何兩個元素 x、y 都有 lub 也都有 glb'); cap('任兩個都有 lub 和 glb', '');
  },
  async (tok, S) => { // @941.0
    S.B.add('→ 這個 poset 叫 lattice（格）', 'ptr alt'); cap('這種 poset 叫 lattice', '');
  },
  async (tok, S) => { // @989.2
    const ch = ['1', '2', '3', '4', '5', '6'], pos = {}; ch.forEach((n, i) => { pos[n] = [-4.6, 0.6 + i * 1.1]; });
    S.H = hasse(pos, ch.slice(1).map((n, i) => [ch[i], n])); S.n = sm('（N 的一段）', -3.2, 0.6);
    S.B.add('例：(N, ≤)，其實是 total order'); cap('例子：自然數與 ≤', '');
  },
  async (tok, S) => { // @1004.2
    S.B.add('lub(x, y)：≥ 兩個數的裡面最小的 → max(x, y)'); cap('lub：兩個裡比較大的', '');
  },
  async (tok, S) => { // @1033.4
    S.B.add('glb(x, y)：兩個裡比較小的 → min(x, y)'); cap('glb：兩個裡比較小的', '');
  },
  async (tok, S) => { // @1038.1
    paint(S.H.V['2'], TC.a, '#0b2a4a'); paint(S.H.V['3'], TC.orange, '#5a2a00');
    S.B.add('例：2、3 → lub = ' + L23[0] + '、glb = ' + G23[0] + ck(L23[0] === 3 && G23[0] === 2), 'good'); cap('2 和 3：lub 3、glb 2', '');
  },
  async (tok, S) => { // @1065.5
    S.B.add('所以 (N, ≤) 是 lattice' + ck(LATT_LE), 'good'); cap('(N, ≤) 是 lattice', '');
  },
  async (tok, S) => { // @1092.3
    gone(S.H, S.n); S.H = hasse(D12P, D12C); S.n = note('示意：12 的因數那一段', -4.4, 7.2);
    S.B.add('換一個 partial order：整除 |', 'ptr'); cap('換成整除', '');
  },
  async (tok, S) => { // @1104.7
    S.B.add('2 | 4、3 | 6；但不是任兩個都能比 → 不是 total order'); cap('整除不是 total order', '');
  },
  async (tok, S) => { // @1119.1
    paint(S.H.V['4'], TC.b, '#4a0a2a'); paint(S.H.V['6'], TC.b, '#4a0a2a'); paint(S.H.V['12'], TC.orange, '#5a2a00');
    S.B.add('lub：公倍數裡最小的 → lcm（例 4、6：' + L46[0] + ck(L46[0] === lcm(4, 6)) + '）'); cap('lub 是最小公倍數 lcm', '');
  },
  async (tok, S) => { // @1149.0
    paint(S.H.V['2'], TC.a, '#0b2a4a');
    S.B.add('glb：公因數裡最大的 → gcd（例 4、6：' + G46[0] + ck(G46[0] === gcd(4, 6)) + '）'); cap('glb 是最大公因數 gcd', '');
  },
  async (tok, S) => { // @1163.0
    S.B.add('任兩個自然數都有 lcm、gcd → (N, |) 是 lattice' + ck(LATT_DV), 'good'); cap('(N, |) 也是 lattice', '');
  },
  async (tok, S) => { // @1216.1
    S.B.add('relation 講完：一般 relation、equivalence relation、partial order', 'ptr alt'); cap('relation 的部分講完了', '');
  },
]);
  }

  // ═══ reB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, showL, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 9 章（交大 易志偉 Lec20–21 Relations、Equivalence Relation 英文短片）— cued scenes ───
// 每個關係都用集合（'a>b' 字串）在程式裡算：合成、Rⁿ、closure、Warshall 每一輪、四個性質、等價類與分割，
// 再和老師口述的結果比對，畫面顯示 ✓／✘。黑板上的圖看不到，端點擺放位置都是示意；
// 老師沒說清楚的例子（Lec20 的 S、性質判斷的兩張圖、等價關係的小遊戲）是自己設計的，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, t, x, y) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && typeof o.kill === 'function') return o.kill(); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const CAM = [[0, 3.6, 15], [0, 3.3, 0]];
const TC = { node: '#cdbfa6', edge: '#9c8b70', zero: '#efe5d3', one: '#4b9ee2', a: '#4b9ee2', b: '#e55a9b', hot: '#d64545', gold: '#c08a1f', green: '#2fc092', yel: '#e9c53a', purple: '#9b7ef4', orange: '#dd8238', teal: '#31aab0' };
const CLS = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4'];
// a scene = a list of step functions; each runs when the video reaches its cue.
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}

// ── 3D 小零件（全部畫在面向鏡頭的平面上） ──
const NG = new THREE.SphereGeometry(0.3, 18, 12);
const CG = new THREE.CylinderGeometry(1, 1, 1, 8);
const CN = new THREE.ConeGeometry(1, 1, 12);
const TG = new THREE.TorusGeometry(0.2, 0.035, 8, 24);
const mt = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
function darr(x1, y1, x2, y2, c = TC.edge, o = {}) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, off = o.off ?? 0.09, nx = -uy * off, ny = ux * off;
  const g0 = o.gap ?? 0.36, sx = x1 + ux * g0 + nx, sy = y1 + uy * g0 + ny, ex = x2 - ux * g0 + nx, ey = y2 - uy * g0 + ny;
  const len = Math.max(0.05, Math.hypot(ex - sx, ey - sy) - 0.24), rot = Math.atan2(uy, ux) - Math.PI / 2, mat = mt(c);
  const grp = new THREE.Group();
  const cyl = new THREE.Mesh(CG, mat); cyl.scale.set(o.r || 0.04, len, o.r || 0.04); cyl.position.set(sx + ux * len / 2, sy + uy * len / 2, 0); cyl.rotation.z = rot; grp.add(cyl);
  if (o.directed !== false) { const cone = new THREE.Mesh(CN, mat); cone.scale.set(0.12, 0.26, 0.12); cone.position.set(ex - ux * 0.13, ey - uy * 0.13, 0); cone.rotation.z = rot; grp.add(cone); }
  grp.userData.mat = mat; grp.userData.cyl = cyl; lab.world.add(grp); return grp;
}
function loopM(x, y, c = TC.edge) { const m = new THREE.Mesh(TG, mt(c)); m.position.set(x, y + 0.47, 0); m.userData.mat = m.material; lab.world.add(m); return m; }
function blob(x, y, rx, ry, c, op = 0.2) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
  m.scale.set(rx, ry, 1); m.position.set(x, y, -0.25); lab.world.add(m); return m;
}
function lines(arr, x, y, dy = 0.62, cls = '') { return arr.map((t, i) => tag(t, cls, x, y - i * dy)); }

// ── 關係（集合 of 'a>b'）的計算 ──
const kp = (a, b) => a + '>' + b;
const R_ = (s) => new Set(s.split(' ').filter(Boolean).map((t) => kp(t[0], t[1])));
const prs = (R) => [...R].map((k) => k.split('>'));
const sortR = (R, V) => prs(R).sort((p, q) => V.indexOf(p[0]) - V.indexOf(q[0]) || V.indexOf(p[1]) - V.indexOf(q[1]));
const fmtR = (R, V) => '{' + sortR(R, V).map(([a, b]) => '(' + a + ',' + b + ')').join(',') + '}';
function comp(R, S) { const out = new Set(); for (const [a, b] of prs(R)) for (const [b2, c] of prs(S)) if (b === b2) out.add(kp(a, c)); return out; } // S∘R：先 R 再 S
function pow(R, n) { let X = new Set(R); for (let i = 1; i < n; i++) X = comp(X, R); return X; }
const uni = (...Rs) => new Set(Rs.flatMap((R) => [...R]));
const sub = (A, B) => [...A].every((k) => B.has(k));
const same = (A, B) => A.size === B.size && sub(A, B);
const minus = (A, B) => new Set([...A].filter((k) => !B.has(k)));
function tclo(V, R) { const W = new Set(R); for (const k of V) for (const i of V) for (const j of V) if (W.has(kp(i, k)) && W.has(kp(k, j))) W.add(kp(i, j)); return W; }
function reachAll(V, R) { const out = new Set(); for (const s of V) { const seen = new Set(), st = [s]; while (st.length) { const x = st.pop(); for (const [a, b] of prs(R)) if (a === x && !seen.has(b)) { seen.add(b); st.push(b); } } seen.forEach((t) => out.add(kp(s, t))); } return out; }
function propsOf(V, R) {
  const o = {}; o.ref = V.every((a) => R.has(kp(a, a))); o.irr = V.every((a) => !R.has(kp(a, a)));
  o.symW = prs(R).find(([a, b]) => !R.has(kp(b, a))) || null; o.sym = !o.symW;
  o.antiW = prs(R).find(([a, b]) => a !== b && R.has(kp(b, a))) || null; o.anti = !o.antiW;
  o.traW = null; for (const [a, b] of prs(R)) for (const [b2, c] of prs(R)) if (!o.traW && b === b2 && !R.has(kp(a, c))) o.traW = [a, b, c]; o.tra = !o.traW;
  o.eq = o.ref && o.sym && o.tra; return o;
}
const rowOf = (R, V, a) => V.filter((b) => R.has(kp(a, b)));
function eqClose(V, R) { return tclo(V, uni(R, new Set(V.map((a) => kp(a, a))), new Set(prs(R).map(([a, b]) => kp(b, a))))); }

// ── 有向圖（端點 = 球，邊 = 箭頭，loop = 小圈） ──
function mkG(Pm, o = {}) {
  const g = { V: {}, P: {}, E: {}, ex: [] };
  for (const n of Object.keys(Pm)) {
    const [x, y] = Pm[n]; g.P[n] = [x, y];
    const m = new THREE.Mesh(NG, mt(o.c || TC.node)); m.scale.setScalar(o.r || 1); m.position.set(x, y, 0); lab.world.add(m);
    m.add(lab.label(n, 'val')); g.V[n] = m;
  }
  g.add = (u, v, c = TC.edge) => {
    const k = kp(u, v); if (g.E[k]) { g.col(u, v, c); return g.E[k]; }
    g.E[k] = u === v ? loopM(g.P[u][0], g.P[u][1], c) : darr(g.P[u][0], g.P[u][1], g.P[v][0], g.P[v][1], c);
    return g.E[k];
  };
  g.load = (R, c) => { for (const [u, v] of prs(R)) g.add(u, v, c); };
  g.col = (u, v, c) => { const e = g.E[kp(u, v)]; if (e) e.userData.mat.color.set(c); };
  g.del = (u, v) => { const k = kp(u, v); if (g.E[k]) { kill(g.E[k]); delete g.E[k]; } };
  g.clearE = () => { for (const k of Object.keys(g.E)) { kill(g.E[k]); delete g.E[k]; } };
  g.paint = (c = TC.edge) => { for (const k of Object.keys(g.E)) g.E[k].userData.mat.color.set(c); };
  g.path = (p, c = TC.orange) => { for (let i = 0; i + 1 < p.length; i++) g.col(p[i], p[i + 1], c); };
  g.vcol = (n, c, gl) => { g.V[n].material.color.set(c); glow(g.V[n], gl || '#000000'); };
  g.vreset = () => { for (const n of Object.keys(g.V)) g.vcol(n, o.c || TC.node); };
  g.all = () => [...Object.values(g.V), ...Object.values(g.E), ...g.ex];
  return g;
}

// ── 0/1 矩陣（每格一個小方塊） ──
function mkM(rn, cn, x0, y0, cs = 0.55, title) {
  const M = { c: {}, rn, cn, ex: [] };
  rn.forEach((r, i) => M.ex.push(sm(r, x0 - cs * 0.6 - 0.32, y0 - i * cs)));   // 列名／行名離格子遠一點：格子裡的 0／1 標籤比格子寬，太近會被「標籤不重疊」推開而對不上列
  cn.forEach((c, j) => M.ex.push(sm(c, x0 + j * cs, y0 + cs * 0.55 + 0.25)));
  if (title) M.ex.push(hd(title, x0 + (cn.length - 1) * cs / 2, y0 + cs * 0.55 + 0.85));
  rn.forEach((r, i) => cn.forEach((c, j) => { const m = cube('0', TC.zero, [cs * 0.86, cs * 0.86, 0.1], x0 + j * cs, y0 - i * cs, 0); relabel(m, ''); M.c[kp(r, c)] = m; }));
  M.set = (r, c, v, hc) => { const m = M.c[kp(r, c)]; if (!m) return; relabel(m, v === null ? '' : String(v)); m.material.color.set(hc || (v === 1 ? TC.one : TC.zero)); glow(m, hc ? '#2a1a00' : null); };
  M.load = (R, hi, hc = TC.orange) => { for (const r of rn) for (const c of cn) { const k = kp(r, c); M.set(r, c, R.has(k) ? 1 : 0, hi && hi.has(k) ? hc : null); } };
  M.blank = () => { for (const r of rn) for (const c of cn) M.set(r, c, null); };
  M.hiRow = (r, hc = TC.yel) => { for (const c of cn) M.c[kp(r, c)].material.color.set(hc); };
  M.hiCol = (c, hc = TC.yel) => { for (const r of rn) M.c[kp(r, c)].material.color.set(hc); };
  M.all = () => [...Object.values(M.c), ...M.ex];
  return M;
}

// ════════ CtxWiSNrxvI（易志偉 Lec20：關係矩陣、合成 = Boolean 矩陣乘法、Rⁿ、transitive ⇔ Rⁿ ⊆ R、R² R³ 的路徑意義、閉包） ════════
const L20A = ['1', '2', '3', '4'], L20B = ['a', 'b', 'c'], L20C = ['x', 'y', 'z'];
const L20R = R_('1a 1b 2b 2c 4a');                 // 老師口述：1a、1b、2b、2c、4a
const L20S = R_('ax by cy cz');                    // S 是示意（逐字稿聽不出 S；只知道 a→x 有、b→x 沒有）
const L20SR = comp(L20R, L20S);
const ABpos = { 1: [-6.2, 6.0], 2: [-6.2, 5.0], 3: [-6.2, 4.0], 4: [-6.2, 3.0], a: [-4.4, 5.5], b: [-4.4, 4.5], c: [-4.4, 3.5] };

scene('reB-l20-mat', 'Lec20：關係的箭頭圖與關係矩陣 M_R', [
  async (tok, S) => { // A、B 兩個集合
    S.g = mkG(ABpos); S.t = hd('A = {1, 2, 3, 4}　B = {a, b, c}', 1.6, 6.8);
    cap('從 A 到 B 的一個關係 R', '');
  },
  async (tok, S) => {
    S.t2 = pl('R ⊆ A × B：R 是一堆有序對 (a, b)', 1.6, 6.0); cap('關係 R 是 A × B 的子集合', '');
  },
  async (tok, S) => {
    S.bA = blob(-6.2, 4.5, 0.75, 2.0, TC.a); S.bB = blob(-4.4, 4.5, 0.75, 1.6, TC.b);
    S.la = sm('集合 A', -6.2, 2.0); S.lb = sm('集合 B', -4.4, 2.4); cap('用圖來表示：左邊 A，右邊 B', '');
  },
  async (tok, S) => { S.g.add('1', 'a', TC.orange); cap('1 和 a 有關係：畫一條 1 → a', ''); },
  async (tok, S) => {
    S.g.col('1', 'a', TC.edge); for (const [u, v] of [['1', 'b'], ['2', 'b'], ['2', 'c'], ['4', 'a']]) S.g.add(u, v);
    S.r = pl('R = ' + fmtR(L20R, [...L20A, ...L20B]), -3.0, 1.2); cap('1b、2b、2c、4a 也有關係', '');
  },
  async (tok, S) => { S.M = mkM(L20A, L20B, 1.2, 5.0, 0.72, 'M_R'); cap('把同一個關係寫成矩陣 M_R', ''); },
  async (tok, S) => {
    S.n1 = note('列（橫的）= A 的元素，行（直的）= B 的元素', 2.0, 1.9);
    S.M.hiRow('1', TC.yel); cap('A 標在列，B 標在行', '');
    await wt(tok, 700); S.M.blank();
  },
  async (tok, S) => { S.M.set('1', 'a', 1); S.M.set('1', 'b', 1); gone(S.n1); cap('1 和 a、1 和 b 有關係 → 填 1', ''); },
  async (tok, S) => { S.M.set('2', 'b', 1); cap('2 和 b 有關係 → 填 1', ''); },
  async (tok, S) => { S.M.set('2', 'c', 1); cap('2 和 c 有關係 → 填 1', ''); },
  async (tok, S) => {
    S.M.load(L20R); const ones = Object.keys(S.M.c).filter((k) => L20R.has(k)).length;
    S.ck = ok(ones === L20R.size && L20R.size === 5, '4a 填 1，其他填 0：5 個 1 = 5 個有序對 ✓', 2.0, 1.9);
    cap('其他沒有關係的地方都填 0', '');
  },
]);

const ABCpos = { 1: [-6.5, 6.0], 2: [-6.5, 5.0], 3: [-6.5, 4.0], 4: [-6.5, 3.0], a: [-4.9, 5.5], b: [-4.9, 4.5], c: [-4.9, 3.5], x: [-3.3, 5.5], y: [-3.3, 4.5], z: [-3.3, 3.5] };
scene('reB-l20-comp', 'Lec20：合成關係 S∘R 與 Boolean 矩陣乘法', [
  async (tok, S) => {
    S.g = mkG(ABCpos); S.g.load(L20R); S.g.load(L20S, TC.purple);
    S.t = hd('S ⊆ B × C（S 為示意）', -4.9, 7.0); S.n = note('合成：S∘R', 1.8, 1.0);
    cap('再來一個從 B 到 C 的關係 S，看合成', '');
  },
  async (tok, S) => {
    S.g.path(['1', 'a', 'x'], TC.orange);
    S.d = lines(['S∘R = {(p, r) | 有某個 q：pRq 且 qSr}', '先走 R，再走 S'], 1.8, 2.2, 0.6); cap('R 先、S 後：1 → a → x', '');
  },
  async (tok, S) => {
    S.g.paint(TC.edge); S.g.load(L20S, TC.purple); for (const [u, v] of prs(L20R)) S.g.col(u, v, TC.edge);
    S.MR = mkM(L20A, L20B, -1.3, 5.8, 0.66, 'M_R'); S.MR.load(L20R);
    S.MS = mkM(L20B, L20C, 1.75, 5.8, 0.66, 'M_S'); S.MS.load(L20S);
    cap('M_R 是 4×3，M_S 是 3×3', '');
  },
  async (tok, S) => {
    gone(S.d); S.d = lines(['Boolean：0·0 = 0，0·1 = 0，1·1 = 1', '加法用 OR：1 + 1 = 1'], 1.8, 2.2, 0.6); cap('乘法 = AND，加法 = OR', '');
  },
  async (tok, S) => {
    S.MX = mkM(L20A, L20C, 4.8, 5.8, 0.66, 'M_{S∘R}'); S.MX.blank(); cap('結果是 4×3：列 = A，行 = C', '');
  },
  async (tok, S) => {
    S.MR.hiRow('1'); S.MS.hiCol('x'); S.MX.set('1', 'x', '?', TC.yel);
    gone(S.d); S.d = lines(['(1, x)：1 能不能經過某個 q 走到 x？'], 1.8, 2.2); cap('看 (1, x)：第 1 列 × 第 x 行', '');
  },
  async (tok, S) => {
    S.g.path(['1', 'b'], TC.orange);
    S.v1 = pl('經過 b：1Rb = ' + (L20R.has('1>b') ? 1 : 0) + '，bSx = ' + (L20S.has('b>x') ? 1 : 0) + ' → 0', 1.8, 1.6);
    cap('1 和 b 有關係，但 b 和 x 沒有', '');
  },
  async (tok, S) => {
    S.g.col('1', 'b', TC.edge); S.g.path(['1', 'a', 'x'], TC.green);
    S.v2 = pl('經過 a：1Ra = 1，aSx = ' + (L20S.has('a>x') ? 1 : 0) + ' → 1', 1.8, 1.0);
    cap('經過 a：1 → a → x 走得通', '');
  },
  async (tok, S) => {
    S.v3 = pl('經過 c：1Rc = ' + (L20R.has('1>c') ? 1 : 0) + ' → 0', 1.8, 0.4); cap('經過 c：1 和 c 沒關係', '');
  },
  async (tok, S) => {
    S.MX.set('1', 'x', L20SR.has('1>x') ? 1 : 0, TC.green); cap('只要有一條走得通，就填 1', '');
  },
  async (tok, S) => {
    gone(S.v1, S.v2, S.v3); S.g.paint(TC.edge); S.MR.load(L20R); S.MS.load(L20S);
    S.MX.load(L20SR); S.d2 = pl('每一格 = M_R 的一列 ⊙ M_S 的一行', 1.8, 1.4);
    cap('其他格子同樣：列乘行', '');
  },
  async (tok, S) => {
    let okM = true; for (const p of L20A) for (const r of L20C) { let v = 0; for (const q of L20B) if (L20R.has(kp(p, q)) && L20S.has(kp(q, r))) v = 1; if (v !== (L20SR.has(kp(p, r)) ? 1 : 0)) okM = false; }
    S.ck = ok(okM, 'M_{S∘R} = M_R ⊙ M_S ✓（和逐對檢查一樣）', 1.8, 0.7); cap('合成關係 = 兩個矩陣的 Boolean 乘法', '');
  },
  async (tok, S) => {
    S.w = bad('M_S ⊙ M_R：3×3 乘 4×3，對不起來 ✘', 1.8, 0.0); cap('順序：R 在前、S 在後，不能顛倒', '');
  },
]);

// 同一個集合上的關係：這堂課後面的例子 A = {1,2,3,4}
const L20Q = R_('11 12 22 23 42');
const Qpos = { 1: [-6.2, 5.6], 2: [-4.4, 5.6], 3: [-4.4, 3.6], 4: [-6.2, 3.6] };
scene('reB-l20-power', 'Lec20：R on A、M_R 是方陣、R² 與 R³ 的矩陣', [
  async (tok, S) => {
    S.g = mkG(Qpos); S.g.load(L20Q); S.t = hd('R 定義在 A 上：R ⊆ A × A', -5.3, 7.0);
    S.n = sm('（用這堂課後面的例子）', -5.3, 2.6); cap('a relation R on A', '');
  },
  async (tok, S) => { S.M1 = mkM(L20A, L20A, -2.2, 5.9, 0.58, 'M_R'); S.M1.load(L20Q); cap('列、行都是 A：n × n 的方陣', ''); },
  async (tok, S) => { S.d = pl('R 可以和自己合成：R∘R = R²', 1.6, 2.3); cap('R 自己跟自己合成', ''); },
  async (tok, S) => {
    S.M2 = mkM(L20A, L20A, 1.0, 5.9, 0.58, 'M_{R²}'); S.M2.load(pow(L20Q, 2));
    let okM = true; for (const i of L20A) for (const j of L20A) { const v = L20A.some((q) => L20Q.has(kp(i, q)) && L20Q.has(kp(q, j))); if (v !== pow(L20Q, 2).has(kp(i, j))) okM = false; }
    S.c2 = ok(okM, 'M_{R²} = M_R ⊙ M_R ✓', 1.6, 1.6); cap('M_{R²} = M_R ⊙ M_R', '');
  },
  async (tok, S) => {
    S.M3 = mkM(L20A, L20A, 4.2, 5.9, 0.58, 'M_{R³}'); S.M3.load(pow(L20Q, 3));
    S.c3 = pl('R 連續合成三次：M_{R³} = M_R ⊙ M_R ⊙ M_R', 1.6, 0.9); cap('合成三次 = 矩陣的三次方', '');
  },
  async (tok, S) => { S.c4 = note('簡寫：Rⁿ = R 自己合成 n 次，M_{Rⁿ} = M_R^[n]', 1.6, 0.2); cap('記號：R 的 n 次方', ''); },
]);

// ── transitive ⇔ Rⁿ ⊆ R ──
const TRI = { a: [-5.6, 3.4], b: [-4.2, 5.6], c: [-2.8, 3.4] };
scene('reB-l20-trans-thm', 'Lec20：transitive 與定理 R transitive ⇔ Rⁿ ⊆ R（⇒ 方向）', [
  async (tok, S) => { S.g = mkG(TRI); S.g.add('a', 'b'); S.g.add('b', 'c'); S.t = pl('aRb 且 bRc', -4.2, 1.8); cap('a 和 b 有關係，b 和 c 有關係', ''); },
  async (tok, S) => { S.g.add('a', 'c', TC.orange); txt(S.t, 'aRb 且 bRc ⇒ aRc'); cap('那 a 和 c 一定要有關係', ''); },
  async (tok, S) => { S.h = hd('transitive（遞移）', -4.2, 7.0); cap('這個性質叫 transitive', ''); },
  async (tok, S) => { S.th = hot('定理：R 是 transitive ⇔ Rⁿ ⊆ R（n = 1, 2, 3, …）', 2.4, 6.6); cap('定理：遞移 ⇔ Rⁿ 都包含在 R 裡', ''); },
  async (tok, S) => { S.L = [pl('先看 n = 2：R transitive ⇒ R² ⊆ R', 2.4, 5.6)]; cap('先證：遞移 ⇒ R² ⊆ R', ''); },
  async (tok, S) => { S.g.del('a', 'c'); S.L.push(sm('證明（⇒）', 2.4, 4.9)); cap('來證明，看合成在看什麼', ''); },
  async (tok, S) => { S.L.push(pl('取任意 (a, c) ∈ R²', 2.4, 4.3)); cap('假設 (a, c) 在 R² 裡', ''); },
  async (tok, S) => {
    S.g.path(['a', 'b', 'c'], TC.orange); S.L.push(pl('⇒ 存在某個 b：aRb 且 bRc', 2.4, 3.6)); cap('那一定有中間的某個 b', '');
  },
  async (tok, S) => { S.g.add('a', 'c', TC.green); S.L.push(pl('⇒ R 是 transitive，所以 aRc', 2.4, 2.9)); cap('用遞移性：a 和 c 有關係', ''); },
  async (tok, S) => { S.L.push(good('⇒ (a, c) ∈ R，所以 R² ⊆ R ✓', 2.4, 2.1)); cap('R² 的每一對都在 R 裡', ''); },
]);

const LE3 = ['1', '2', '3'], LE = R_('11 12 13 22 23 33');   // 示意：≤ on {1,2,3}
scene('reB-l20-trans-conv', 'Lec20：反方向 R² ⊆ R ⇒ transitive、歸納、矩陣形式', [
  async (tok, S) => {
    S.g = mkG(TRI); S.g.add('a', 'b'); S.g.add('b', 'c'); S.th = hot('if and only if：還要證另一個方向', 2.4, 6.6);
    cap('剛剛只證了一個方向', '');
  },
  async (tok, S) => { S.L = [pl('⇐：已知 R² ⊆ R', 2.4, 5.7)]; cap('反過來：已知 R² ⊆ R', ''); },
  async (tok, S) => { S.L.push(pl('求證：任意 a, b, c，aRb 且 bRc ⇒ aRc', 2.4, 5.0)); cap('要證 R 是遞移的', ''); },
  async (tok, S) => { S.g.path(['a', 'b', 'c'], TC.orange); S.L.push(pl('aRb 且 bRc ⇒ (a, c) ∈ R∘R = R²', 2.4, 4.3)); cap('由合成的定義：(a, c) 在 R² 裡', ''); },
  async (tok, S) => { S.g.add('a', 'c', TC.green); S.L.push(good('R² ⊆ R ⇒ (a, c) ∈ R：aRc ✓', 2.4, 3.6)); cap('用已知條件：a 和 c 有關係', ''); },
  async (tok, S) => { S.L.push(pl('n = 2, 3, 4, …：用數學歸納法', 2.4, 2.9)); cap('其他 n 用數學歸納法', ''); },
  async (tok, S) => { S.L.push(sm('Rⁿ⁺¹ = Rⁿ∘R：已知 Rⁿ ⊆ R，同樣的想法 ⇒ Rⁿ⁺¹ ⊆ R', 2.4, 2.3)); cap('證 R³ 時，已經知道 R² ⊆ R', ''); },
  async (tok, S) => {
    gone(S.L, S.g, S.th); S.t = hd('矩陣的形式（示意：≤ on {1,2,3}）', 0, 7.0);
    S.M1 = mkM(LE3, LE3, -4.2, 5.6, 0.6, 'M_R'); S.M1.load(LE);
    S.M2 = mkM(LE3, LE3, -0.6, 5.6, 0.6, 'M_R^[2]'); S.M2.load(pow(LE, 2));
    cap('這個定理寫成矩陣的樣子', '');
  },
  async (tok, S) => {
    S.M2.load(pow(LE, 2), new Set(['1>3']), TC.yel); S.M1.load(LE, new Set(['1>3']), TC.yel);
    S.d = pl('M_R^[n] 的 (i, j) = 1 ⇒ M_R 的 (i, j) = 1', 2.2, 2.6); cap('Rⁿ 某格是 1，R 那格也要是 1', '');
  },
  async (tok, S) => {
    const okAll = [2, 3].every((n) => sub(pow(LE, n), LE)) && propsOf(LE3, LE).tra;
    S.ck = ok(okAll, '≤ 是 transitive：R²、R³ 的每個 1 在 M_R 也是 1 ✓', 2.2, 1.7); cap('有 1 的地方 R 裡一定也有', '');
  },
]);

// ── R² 與 R³ 的圖（老師的例子：R = {(1,1),(1,2),(2,2),(2,3),(4,2)}） ──
const QL = { 1: [-6.2, 5.4], 2: [-4.2, 5.4], 3: [-4.2, 3.2], 4: [-6.2, 3.2] };
const QM = { 1: [-1.1, 5.4], 2: [0.9, 5.4], 3: [0.9, 3.2], 4: [-1.1, 3.2] };
const QR = { 1: [3.9, 5.4], 2: [5.9, 5.4], 3: [5.9, 3.2], 4: [3.9, 3.2] };
const L20Q2 = pow(L20Q, 2), L20Q3 = pow(L20Q, 3);
const SAID_Q2 = R_('11 12 13 22 23 42 43');
function q2pair(S, a, c, via) { S.g2.add(a, c, TC.orange); S.gL.paint(TC.edge); S.gL.path([a, via, c], TC.orange); }
scene('reB-l20-r2', 'Lec20：例子 R 的圖，畫出 R²', [
  async (tok, S) => { S.t = hd('R = {(1,1), (1,2), (2,2), (2,3), (4,2)}', -1.0, 7.0); cap('例子：一個關係 R', ''); },
  async (tok, S) => { S.a = pl('A = {1, 2, 3, 4}', -5.2, 1.7); cap('集合 A = {1, 2, 3, 4}', ''); },
  async (tok, S) => { S.gL = mkG(QL); S.l1 = sm('R', -5.2, 6.4); cap('另一種表示：畫圖', ''); },
  async (tok, S) => { S.gL.add('1', '1'); S.gL.add('1', '2'); S.gL.add('2', '3'); cap('1→1、1→2、2→3', ''); },
  async (tok, S) => { S.gL.add('4', '2'); S.gL.add('2', '2'); cap('4→2、2→2', ''); },
  async (tok, S) => { S.g2 = mkG(QM); S.l2 = sm('R² = R∘R：怎麼畫？', -0.1, 6.4); cap('R² 的圖應該怎麼畫？', ''); },
  async (tok, S) => { q2pair(S, '1', '1', '1'); cap('1→1→1：(1,1) 在 R² 裡', ''); },
  async (tok, S) => { q2pair(S, '1', '2', '1'); cap('1 透過 1 到 2：(1,2)', ''); },
  async (tok, S) => { q2pair(S, '1', '3', '2'); cap('1→2→3：(1,3)', ''); },
  async (tok, S) => { S.gL.paint(TC.edge); S.gL.path(['1', '2', '2'], TC.orange); S.n = sm('1→2→2 也得到 (1,2)：已經畫過', -0.1, 1.9); cap('1→2→2 也是 (1,2)，本來就有', ''); },
  async (tok, S) => { gone(S.n); S.gL.paint(TC.edge); S.gL.vcol('3', TC.hot); S.n = sm('3 沒有箭頭出去：從 3 走不下去', -0.1, 1.9); cap('3 沒有跟誰有關係', ''); },
  async (tok, S) => { gone(S.n); S.gL.vreset(); q2pair(S, '4', '3', '2'); cap('4→2→3：(4,3)', ''); },
  async (tok, S) => { q2pair(S, '4', '2', '2'); cap('4→2→2：(4,2)', ''); },
  async (tok, S) => { q2pair(S, '2', '3', '2'); cap('2→2→3：(2,3)', ''); },
  async (tok, S) => {
    q2pair(S, '2', '2', '2'); S.gL.paint(TC.edge); S.g2.paint(TC.edge);
    S.ck = ok(same(L20Q2, SAID_Q2), 'R² = ' + fmtR(L20Q2, L20A) + ' ✓', -0.1, 1.2); cap('2→2→2：(2,2)，R² 畫完', '');
  },
]);

scene('reB-l20-r3', 'Lec20：R² 的邊 = 長度 2 的路，R³ = 長度 3 的路', [
  async (tok, S) => {
    S.gL = mkG(QL); S.gL.load(L20Q); S.g2 = mkG(QM); S.g2.load(L20Q2); S.l1 = sm('R', -5.2, 6.4); S.l2 = sm('R²', -0.1, 6.4);
    S.t = hd('R³ = R²∘R', 4.9, 7.0); cap('R³ = R² 再和 R 合成；先解釋 R²', '');
  },
  async (tok, S) => { S.g2.col('1', '1', TC.orange); S.gL.path(['1', '1', '1'], TC.orange); S.n = bub('(1,1)：1 對到 1，1 再對到 1', -0.1, 1.9); cap('為什麼 R² 有 (1,1)：1→1 再 1→1', ''); },
  async (tok, S) => { S.g2.paint(); S.gL.paint(); S.g2.col('1', '2', TC.orange); S.gL.path(['1', '1', '2'], TC.orange); S.n.element.textContent = '(1,2)：1→1 再 1→2'; cap('(1,2)：1 經過 1 到 2', ''); },
  async (tok, S) => { S.g2.paint(); S.gL.paint(); S.g2.col('4', '2', TC.orange); S.gL.path(['4', '2', '2'], TC.orange); S.n.element.textContent = '(4,2)：4→2 再 2→2'; cap('(4,2)：4 到 2，2 再繞自己', ''); },
  async (tok, S) => { S.g2.paint(); S.gL.paint(); S.g2.col('4', '3', TC.orange); S.gL.path(['4', '2', '3'], TC.orange); S.n.element.textContent = '(4,3)：4→2 再 2→3'; cap('(4,3)：4 到 2，2 到 3', ''); },
  async (tok, S) => {
    S.g2.paint(); S.gL.paint();
    const okP = [...L20Q2].every((k) => { const [a, c] = k.split('>'); return L20A.some((b) => L20Q.has(kp(a, b)) && L20Q.has(kp(b, c))); });
    S.n.element.textContent = 'R² 的每條邊 = R 裡兩筆畫得到的路'; S.ck = ok(okP, '每條都由 R 的兩條邊接成 ✓', -0.1, 1.2);
    cap('R² 的一條線 = 原圖兩筆可以到', '');
  },
  async (tok, S) => { gone(S.ck); S.g2.col('1', '3', TC.orange); S.gL.path(['1', '2', '3'], TC.orange); S.n.element.textContent = '1 到 3：有一條長度 2 的路（頭尾相接）'; cap('1 到 3 有一條長度為 2 的路', ''); },
  async (tok, S) => { S.g2.paint(); S.gL.paint(); S.g3 = mkG(QR); S.l3 = sm('R³：長度 3 的路', 4.9, 6.4); cap('R³ 的一條線 = 長度 3 的路', ''); },
  async (tok, S) => { S.g3.add('1', '1', TC.orange); S.gL.path(['1', '1'], TC.orange); S.n.element.textContent = '(1,1)：1 自己繞三圈'; cap('1 繞 1 圈、2 圈、3 圈回到自己', ''); },
  async (tok, S) => { S.gL.paint(); S.g3.paint(); S.g3.add('1', '3', TC.orange); S.gL.path(['1', '2', '2', '3'], TC.orange); S.n.element.textContent = '(1,3)：1→2，2 繞一圈，2→3'; cap('1→2→2→3：長度 3', ''); },
  async (tok, S) => {
    S.gL.paint(); S.g3.paint(); S.g3.add('4', '3', TC.orange); S.gL.path(['4', '2', '2', '3'], TC.orange); S.n.element.textContent = '(4,3)：4→2，2 繞一圈，2→3';
    cap('4→2→2→3：(4,3) 也在 R³', '');
  },
  async (tok, S) => {
    S.gL.paint(); S.g3.paint(); S.g3.load(L20Q3);
    S.n.element.textContent = 'R³ = ' + fmtR(L20Q3, L20A);
    S.ck = ok(['1>1', '1>3', '4>3'].every((k) => L20Q3.has(k)), '老師說的 (1,1)、(1,3)、(4,3) 都在 R³ ✓', -0.1, 1.2);
    cap('像地圖：有沒有長度 3 的路？看 R³', '');
  },
  async (tok, S) => { gone(S.ck); S.d = note('有方向的圖 = directed graph；點 = vertex，線 = edge', -0.1, 0.5); cap('這種圖叫有向圖', ''); },
  async (tok, S) => {
    S.d2 = sm('（順帶）bipartite graph：點分兩半，線只在兩半之間（像前面 A→B 的圖）', -0.1, -0.1); cap('順帶一提：二分圖', '');
  },
]);

// ── 從圖看性質（兩張示意圖） ──
const HEX = {}; ['1', '2', '3', '4', '5', '6'].forEach((n, i) => { const t = Math.PI / 2 - i * Math.PI / 3; HEX[n] = [-3.8 + 1.9 * Math.cos(t), 4.0 + 1.75 * Math.sin(t)]; });
const PG1 = R_('11 22 33 44 55 66 12 21 23 34');   // 示意：全部有 loop、1↔2、2→3、3→4
const PG2 = R_('13 32 34 43');                     // 示意：沒有 loop、1→3、3→2、3↔4
const V6 = Object.keys(HEX), V4 = ['1', '2', '3', '4'];
const SQ = { 1: [-5.4, 5.4], 2: [-2.6, 5.4], 3: [-4.0, 3.6], 4: [-4.0, 1.7] };
function propBoard(S) { S.pl = {}; [['ref', 'reflexive'], ['sym', 'symmetric'], ['anti', 'antisymmetric'], ['tra', 'transitive']].forEach(([k, n], i) => { S.pl[k] = pl(n + '：?', 3.4, 5.8 - i * 0.75); }); }
const mark = (S, k, name, v, why) => { gone(S.pl[k]); S.pl[k] = v ? good(name + '：✓ ' + why, 3.4, 5.8 - ['ref', 'sym', 'anti', 'tra'].indexOf(k) * 0.75) : bad(name + '：✘ ' + why, 3.4, 5.8 - ['ref', 'sym', 'anti', 'tra'].indexOf(k) * 0.75); };
scene('reB-l20-props', 'Lec20：從有向圖判斷四個性質（示意圖）', [
  async (tok, S) => { S.t = hd('從圖看性質', 0, 7.0); S.d = pl('reflexive：每個點都有自己到自己的圈圈', 1.2, 2.0); cap('反身：每個點上都有圈圈', ''); },
  async (tok, S) => { S.d2 = pl('antisymmetric：兩點之間最多一個方向', 1.2, 1.35); cap('反對稱：只能過去，不能回來', ''); },
  async (tok, S) => { S.d3 = pl('symmetric：有去就要有回', 1.2, 0.7); cap('對稱：所有的邊有去就有回', ''); },
  async (tok, S) => {
    gone(S.d, S.d2, S.d3); S.g = mkG(HEX); S.g.load(PG1); S.n = sm('例 1（示意圖）', -3.8, 6.6); propBoard(S);
    const p = propsOf(V6, PG1); mark(S, 'ref', 'reflexive', p.ref, '每點都有圈'); cap('1 到 6 每點都有圈：有反身性', '');
  },
  async (tok, S) => { const p = propsOf(V6, PG1); S.g.col(p.symW[0], p.symW[1], TC.hot); mark(S, 'sym', 'symmetric', p.sym, p.symW.join('→') + ' 沒回來'); cap('有過去、沒有回來：不對稱', ''); },
  async (tok, S) => { const p = propsOf(V6, PG1); S.g.paint(); S.g.col(p.antiW[0], p.antiW[1], TC.hot); S.g.col(p.antiW[1], p.antiW[0], TC.hot); mark(S, 'anti', 'antisymmetric', p.anti, p.antiW.join('↔') + ' 有去有回'); cap('有去有回：不是反對稱', ''); },
  async (tok, S) => { S.g.paint(); cap('有沒有遞移性？想一下', ''); },
  async (tok, S) => {
    const p = propsOf(V6, PG1), [a, b, c] = p.traW; S.g.path([a, b, c], TC.orange);
    mark(S, 'tra', 'transitive', p.tra, a + '→' + b + '→' + c + ' 但沒有 ' + a + '→' + c); cap('過去再過去，直達的線不在', '');
  },
  async (tok, S) => {
    gone(S.g, Object.values(S.pl), S.n); S.g = mkG(SQ); S.g.load(PG2); S.n = sm('例 2（示意圖）', -4.0, 6.6); propBoard(S);
    const p = propsOf(V4, PG2); mark(S, 'ref', 'reflexive', p.ref, '一個圈都沒有'); S.ir = ok(p.irr, '每個點都沒圈：irreflexive（反反身）✓', 3.4, 2.4);
    cap('一個圈都沒有：沒有反身性', '');
  },
  async (tok, S) => { const p = propsOf(V4, PG2); S.g.col(p.symW[0], p.symW[1], TC.hot); mark(S, 'sym', 'symmetric', p.sym, p.symW.join('→') + ' 單行道'); cap('有單行道：不對稱', ''); },
  async (tok, S) => { const p = propsOf(V4, PG2); S.g.paint(); S.g.col(p.antiW[0], p.antiW[1], TC.hot); S.g.col(p.antiW[1], p.antiW[0], TC.hot); mark(S, 'anti', 'antisymmetric', p.anti, p.antiW.join('↔') + ' 雙向道'); cap('有雙向道：不是反對稱', ''); },
  async (tok, S) => {
    const p = propsOf(V4, PG2), [a, b, c] = p.traW; S.g.paint(); S.g.path([a, b, c], TC.orange);
    mark(S, 'tra', 'transitive', p.tra, a + '→' + b + '→' + c + '，缺 ' + a + '→' + c); cap('隨便找一個反例：遞移也不成立', '');
  },
]);

// ── closure（老師的例子：A = {1,2,3,4}，R = {(1,2),(2,2),(2,3),(3,3),(3,4)}，畫起來像 Z） ──
const ZP = { 1: [-6.0, 5.6], 2: [-3.4, 5.6], 3: [-6.0, 2.9], 4: [-3.4, 2.9] };
const ZR = R_('12 22 23 33 34');
const ZRr = uni(ZR, new Set(V4.map((a) => kp(a, a)))), ZRs = uni(ZR, new Set(prs(ZR).map(([a, b]) => kp(b, a))));
scene('reB-l20-closure', 'Lec20：closure（閉包）：反身閉包與對稱閉包', [
  async (tok, S) => { S.t = hd('8-4：關係缺某個性質時，允許補上一些邊', 0, 7.0); cap('沒有想要的性質？允許補一些邊', ''); },
  async (tok, S) => { S.d = pl('問題：最少要補哪些，才有反身性？', 1.6, 6.1); cap('用最少的料補到有反身性', ''); },
  async (tok, S) => { S.d2 = hot('closure（閉包）', 1.6, 5.3); cap('這就是 closure', ''); },
  async (tok, S) => { S.d3 = lines(['property X（反身、對稱、遞移…）', 'R 的 X closure = 包含 R、有性質 X 的最小關係'], 1.6, 4.6, 0.6); cap('X closure：補最少，讓 R 有性質 X', ''); },
  async (tok, S) => { gone(S.d, S.d2, S.d3); S.r = pl('A = {1,2,3,4}，R = ' + fmtR(ZR, V4), 1.6, 6.1); cap('例子：A = {1,2,3,4}', ''); },
  async (tok, S) => { S.g = mkG(ZP); cap('先從圖來看', ''); },
  async (tok, S) => { S.g.load(ZR); S.z = sm('1→2、2→3、3→4：看起來像一個 Z', -4.7, 1.8); cap('1→2、2→3、2→2、3→3、3→4', ''); },
  async (tok, S) => {
    gone(S.z); const miss = V4.filter((a) => !ZR.has(kp(a, a))); miss.forEach((a) => S.g.vcol(a, TC.hot));
    S.m = bad('缺：' + miss.map((a) => '(' + a + ',' + a + ')').join('、') + ' → 沒有反身性', 1.6, 5.2); cap('1 和 4 沒有圈：不是反身', '');
  },
  async (tok, S) => { S.g.vreset(); minus(ZRr, ZR).forEach((k) => { const [a] = k.split('>'); S.g.add(a, a, TC.yel); }); gone(S.m); S.m = pl('補上黃色的 (1,1)、(4,4)', 1.6, 5.2); cap('補上兩個黃色的圈', ''); },
  async (tok, S) => {
    S.ck = ok(minus(ZRr, ZR).size === 2 && propsOf(V4, ZRr).ref, '反身閉包 = R ∪ {(1,1),(4,4)}：只補 2 個 ✓', 1.6, 4.4); cap('最少補兩條：這就是反身閉包', '');
  },
  async (tok, S) => {
    gone(S.ck, S.m); for (const k of minus(ZRr, ZR)) { const [a, b] = k.split('>'); S.g.del(a, b); }
    S.m = pl('對稱閉包：有去沒回的，全部補回來', 1.6, 5.2); cap('換成對稱：要補哪些？', '');
  },
  async (tok, S) => { minus(ZRs, ZR).forEach((k) => { const [a, b] = k.split('>'); S.g.add(a, b, TC.orange); }); cap('補 2→1、3→2、4→3', ''); },
  async (tok, S) => {
    const add = sortR(minus(ZRs, ZR), V4).map(([a, b]) => '(' + a + ',' + b + ')').join('、');
    S.ck = ok(propsOf(V4, ZRs).sym && minus(ZRs, ZR).size === 3, '對稱閉包 = R ∪ {' + add + '} ✓', 1.6, 4.4); cap('自己到自己的圈，去回一樣', '');
  },
  async (tok, S) => { S.f1 = pl('反身閉包 r(R) = R ∪ {(a, a) | a ∈ A}', 1.6, 3.5); cap('反身閉包的一般寫法', ''); },
  async (tok, S) => { S.f2 = pl('對稱閉包 s(R) = R ∪ R⁻¹（R⁻¹ 是反過來的關係）', 1.6, 2.8); cap('對稱閉包：R 聯集 R 的反關係', ''); },
  async (tok, S) => { S.f3 = note('重點是遞移閉包：下次講', 1.6, 2.0); cap('遞移閉包比較難，下次講', ''); },
]);

// ════════ ouXIBZTTtuk（易志偉 Lec21：反身／對稱閉包、路徑與 R²、遞移閉包、暴力法、Warshall、等價關係、等價類、分割） ════════
// 黑板上的 7 點圖看不到；從老師逐句描述拼回來的邊：G→F、F→F、F→D、D→C、D→E、C→B、C→E（A 孤立）。
// 用這 7 條邊算出來的 R²、R³、Warshall 每一輪新增的 1，都和老師口述一致（下方 SAID_* 比對）。擺放位置是示意。
const V7 = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const G7P = { A: [-6.3, 1.7], G: [-6.2, 5.6], F: [-4.6, 6.0], D: [-4.6, 3.9], C: [-3.0, 4.6], B: [-1.5, 6.0], E: [-1.6, 3.0] };
const G7 = R_('GF FF FD DC DE CB CE');
const G7r = uni(G7, new Set(V7.map((a) => kp(a, a)))), G7s = uni(G7, new Set(prs(G7).map(([a, b]) => kp(b, a))));
const G72 = pow(G7, 2), G73 = pow(G7, 3), G7T = tclo(V7, G7), G7REACH = reachAll(V7, G7);
const SAID_R2 = { A: '', B: '', C: '', D: 'BE', G: 'DF' };          // 老師逐列講的 R²
const SAID_R3 = { A: '', B: '', C: '', D: '', E: '' };
const rowTxt = (R, a) => rowOf(R, V7, a).join(', ') || '（沒有）';
const g7 = () => { const g = mkG(G7P); g.load(G7); return g; };
const M7 = (title, x0 = 1.2, y0 = 6.5) => mkM(V7, V7, x0, y0, 0.62, title);   // 0.62：格子要比格子裡的 0／1 標籤大，標籤才不會互相擠開
function paths(R, a, c, n) { const out = []; const go = (p) => { if (p.length === n + 1) { if (p[n] === c) out.push(p.slice()); return; } for (const b of V7) if (R.has(kp(p[p.length - 1], b))) { p.push(b); go(p); p.pop(); } }; go([a]); return out; }

scene('reB-l21-rsclo', 'Lec21：7 點的例子：反身閉包、對稱閉包（圖與矩陣）', [
  async (tok, S) => { S.g = g7(); S.t = hd('A 上的關係：7 個點 A–G（擺放為示意）', 0.8, 7.0); cap('集合 A 有 7 個元素，畫成圖', ''); },
  async (tok, S) => { S.d = pl('三種 closure：先講兩個簡單的', 2.6, 6.2); cap('三種閉包，先講反身、對稱', ''); },
  async (tok, S) => { txt(S.d, '反身閉包：補最少的邊，讓它有反身性'); cap('反身閉包：補最少讓它有反身性', ''); },
  async (tok, S) => { S.d2 = pl('反身性 = 每一個點身上都有一個圈圈', 2.6, 5.5); cap('每個點身上都要一個圈', ''); },
  async (tok, S) => {
    minus(G7r, G7).forEach((k) => { const [a] = k.split('>'); S.g.add(a, a, TC.yel); });
    S.ck = ok(minus(G7r, G7).size === 6, '補 6 個黃圈（F 本來就有）✓', 2.6, 4.7); cap('照抄原來的，再加上 AA、BB…', '');
  },
  async (tok, S) => { S.f = pl('r(R) = R ∪ {(a, a) | a ∈ A}', 2.6, 3.9); cap('這就是反身閉包', ''); },
  async (tok, S) => {
    gone(S.ck, S.f, S.d2); for (const k of minus(G7r, G7)) { const [a] = k.split('>'); S.g.del(a, a); }
    txt(S.d, '對稱閉包：有去就要有回'); cap('對稱閉包：有去要回', '');
  },
  async (tok, S) => { minus(G7s, G7).forEach((k) => { const [a, b] = k.split('>'); S.g.add(a, b, TC.orange); }); S.d2 = pl('補上橘色的回頭箭頭：' + minus(G7s, G7).size + ' 條', 2.6, 5.5); cap('把橘色的回頭線補上去', ''); },
  async (tok, S) => { S.f = pl('s(R) = R ∪ R⁻¹', 2.6, 4.7); cap('寫法：R 聯集 R 的反關係', ''); },
  async (tok, S) => { S.f2 = note('矩陣形式：對稱 ⇔ 沿對角線對折兩邊一樣', 2.6, 3.9); cap('矩陣：沿對角線對稱', ''); },
  async (tok, S) => {
    gone(S.d, S.d2, S.f, S.f2, S.t); for (const k of minus(G7s, G7)) { const [a, b] = k.split('>'); S.g.del(a, b); }
    S.M = M7('M_R（7×7）'); S.M.load(G7); cap('用矩陣寫：7 × 7', '');
  },
  async (tok, S) => {
    S.M.load(G7r, minus(G7r, G7), TC.yel); S.d = pl('反身閉包：對角線不是 1 的，全部改成 1', 2.5, 2.0); cap('對角線全部改成 1', '');
  },
  async (tok, S) => { S.M.load(G7); txt(S.d, '對稱閉包：從 M_R 重新開始'); cap('對稱閉包：兩件事不要混在一起', ''); },
  async (tok, S) => {
    S.M.load(G7s, minus(G7s, G7), TC.orange);
    const symM = V7.every((i) => V7.every((j) => G7s.has(kp(i, j)) === G7s.has(kp(j, i))));
    txt(S.d, '(C,B) 有 → (B,C) 改 1；(D,C)→(C,D)；(C,E)→(E,C)…'); S.ck = ok(symM, '對折後兩邊一樣：對稱 ✓', 2.5, 1.3); cap('沒有對稱的地方補 1', '');
  },
]);

scene('reB-l21-paths', 'Lec21：路徑、長度，R² = 剛好長度 2，R³ = 剛好長度 3', [
  async (tok, S) => { S.g = g7(); S.t = hd('關係的合成：R∘R 寫成 R²', 0.8, 7.0); cap('很重要的概念：R²', ''); },
  async (tok, S) => { S.d = pl('路徑（path）：F 可以走到 B', 2.6, 6.2); cap('什麼是路徑：F 走得到 B', ''); },
  async (tok, S) => { S.g.path(['F', 'D', 'C', 'B'], TC.orange); txt(S.d, 'F→D、D→C、C→B：前後串起來'); cap('F 和 D、D 和 C、C 和 B 有關係', ''); },
  async (tok, S) => { S.d2 = pl('三段組成：長度 = 3', 2.6, 5.5); cap('這條路的長度是 3', ''); },
  async (tok, S) => {
    S.g.paint(); S.g.path(['D', 'C', 'B'], TC.orange); txt(S.d, '(D, B) ∈ R²：D→C→B'); txt(S.d2, 'R² 的 1 = 長度 2 的路徑');
    S.ck = ok(G72.has('D>B'), '(D, B) 在 R² 裡 ✓', 2.6, 4.8); cap('D 有長度 2 的路到 B', '');
  },
  async (tok, S) => { gone(S.d, S.d2, S.ck, S.t); S.g.paint(); S.M = M7('M_{R²}：走剛好兩步'); S.M.blank(); cap('用「走兩步」來寫 R² 的矩陣', ''); },
  async (tok, S) => { S.M.hiRow('A', TC.yel); await wt(tok, 500); S.M.load(new Set()); for (const r of V7.slice(1)) for (const c of V7) S.M.set(r, c, null); S.d = pl('A：' + rowTxt(G72, 'A') + '（沒有人跟它有關係）', 2.5, 2.0); cap('A 兩步可以到哪？沒有', ''); },
  async (tok, S) => { for (const c of V7) S.M.set('B', c, G72.has(kp('B', c)) ? 1 : 0); txt(S.d, 'B：' + rowTxt(G72, 'B') + '（B 沒有路出去）'); S.g.vcol('B', TC.hot); cap('B 沒有路出去', ''); },
  async (tok, S) => {
    S.g.vreset(); for (const c of V7) S.M.set('C', c, G72.has(kp('C', c)) ? 1 : 0); S.g.path(['C', 'B'], TC.orange); S.g.path(['C', 'E'], TC.orange);
    txt(S.d, 'C：' + rowTxt(G72, 'C') + '（B、E 都是死路）'); cap('C 走到 B、E，但都是死路', '');
  },
  async (tok, S) => {
    S.g.paint(); for (const c of V7) S.M.set('D', c, G72.has(kp('D', c)) ? 1 : 0, G72.has(kp('D', c)) ? TC.orange : null); S.g.path(['D', 'C', 'B'], TC.orange); S.g.path(['D', 'C', 'E'], TC.orange);
    txt(S.d, 'D：' + rowTxt(G72, 'D') + '（D→C→B、D→C→E）'); cap('D 兩步到 B、到 E', '');
  },
  async (tok, S) => { S.g.paint(); S.M.load(new Set(prs(G72).filter(([a]) => 'ABCD'.includes(a)).map(([a, b]) => kp(a, b)))); for (const r of 'FG') for (const c of V7) S.M.set(r, c, null); txt(S.d, 'E：' + rowTxt(G72, 'E')); cap('E 也沒有', ''); },
  async (tok, S) => {
    for (const c of V7) S.M.set('F', c, G72.has(kp('F', c)) ? 1 : 0, G72.has(kp('F', c)) ? TC.orange : null);
    S.g.path(['F', 'F'], TC.orange); S.g.path(['F', 'D', 'C'], TC.orange);
    txt(S.d, 'F：' + rowTxt(G72, 'F') + '（F 有圈，可以原地踏步）'); cap('F 兩步到 C；在自己的圈繞也算一步', '');
  },
  async (tok, S) => {
    S.g.paint(); S.M.load(G72, new Set(rowOf(G72, V7, 'G').map((b) => kp('G', b)))); S.g.path(['G', 'F', 'F'], TC.orange); S.g.path(['F', 'D'], TC.orange);
    const said = Object.keys(SAID_R2).every((a) => rowOf(G72, V7, a).join('') === SAID_R2[a]);
    const bm = V7.every((i) => V7.every((j) => V7.some((q) => G7.has(kp(i, q)) && G7.has(kp(q, j))) === G72.has(kp(i, j))));
    txt(S.d, 'G：' + rowTxt(G72, 'G') + '（G→F→F、G→F→D）'); S.ck = ok(said && bm, '和 M_R ⊙ M_R 一樣、和老師逐列講的一樣 ✓', 2.5, 1.3); cap('G 兩步到 F、到 D', '');
  },
  async (tok, S) => {
    gone(S.ck, S.M); S.g.paint(); S.M = M7('M_{R³}：走剛好三步'); S.M.blank(); for (const a of 'ABC') for (const c of V7) S.M.set(a, c, G73.has(kp(a, c)) ? 1 : 0);
    txt(S.d, 'A、B、C 走三步：全部 0'); cap('R³：A、B、C 都是 0', '');
  },
  async (tok, S) => { for (const c of V7) S.M.set('D', c, G73.has(kp('D', c)) ? 1 : 0); txt(S.d, 'D：一步、兩步之後就走不動 → 0'); cap('D 三步：沒有', ''); },
  async (tok, S) => { for (const c of V7) S.M.set('E', c, G73.has(kp('E', c)) ? 1 : 0); txt(S.d, 'E：0'); cap('E 也是 0', ''); },
  async (tok, S) => {
    for (const c of V7) S.M.set('F', c, G73.has(kp('F', c)) ? 1 : 0, G73.has(kp('F', c)) ? TC.orange : null);
    S.g.path(['F', 'F'], TC.orange); S.g.path(['F', 'D', 'C', 'B'], TC.orange);
    txt(S.d, 'F：' + rowTxt(G73, 'F') + '（繞圈的次數自由運用）'); cap('F 比較多：繞幾圈再出去', '');
  },
  async (tok, S) => {
    S.g.paint(); S.M.load(G73, new Set(rowOf(G73, V7, 'G').map((b) => kp('G', b))));
    const said = Object.keys(SAID_R3).every((a) => rowOf(G73, V7, a).join('') === SAID_R3[a]);
    txt(S.d, 'G：' + rowTxt(G73, 'G') + '（自己找找看）'); S.ck = ok(said && same(G73, comp(G72, G7)), 'M_{R³} = M_{R²} ⊙ M_R ✓', 2.5, 1.3); cap('G 也可以透過 F 到一些地方', '');
  },
  async (tok, S) => { gone(S.ck); txt(S.d, 'R²：剛好長度 2 的路；R³：剛好長度 3 的路'); cap('這就是合成的具體意義', ''); },
]);

scene('reB-l21-tclo', 'Lec21：遞移閉包：所有到得了的地方都拉一條直達線', [
  async (tok, S) => { S.g = g7(); S.t = hd('遞移閉包（transitive closure）', 0.8, 7.0); cap('回到遞移閉包', ''); },
  async (tok, S) => {
    S.g.path(['G', 'F', 'D'], TC.orange); S.g.add('G', 'D', TC.green);
    S.d = pl('G→F、F→D，但沒有 G→D：不遞移 → 補 G→D', 2.6, 6.2); cap('G→F→D：要補上 G→D', '');
  },
  async (tok, S) => {
    S.g.paint(); S.g.col('G', 'D', TC.green); S.g.path(['D', 'C'], TC.orange); S.g.add('G', 'C', TC.green);
    S.d2 = pl('加了 G→D，又有 G→D→C → 再補 G→C…要一直重複', 2.6, 5.5); cap('加上去的線也要考慮：一直重複', '');
  },
  async (tok, S) => { S.f = hot('R* = R ∪ R² ∪ R³ ∪ … = ⋃_{i=1}^{∞} Rⁱ', 2.6, 4.7); cap('遞移閉包 = 所有 Rⁱ 聯集起來', ''); },
  async (tok, S) => { S.g.paint(); S.g.path(['G', 'F', 'D', 'C', 'B'], TC.orange); S.d3 = pl('G→F→D→C→B 長度 4：也要補 G→B', 2.6, 3.9); cap('不管這條路多長，到得了就補', ''); },
  async (tok, S) => {
    S.g.paint(); minus(G7T, G7).forEach((k) => { const [a, b] = k.split('>'); S.g.add(a, b, TC.green); });
    S.ck = ok(same(G7T, G7REACH), '所有到得了的兩點都有直達線（' + minus(G7T, G7).size + ' 條新的）✓', 2.6, 3.1); cap('到得了的全部拉一條直達快車', '');
  },
]);

const BCODE = ['A := M_R；B := A', 'for i := 2 to n:', '  A := A ⊙ M_R    // 長度 i', '  B := B ∨ A      // 聯集', 'return B         // = M_{R*}'];
scene('reB-l21-brute', 'Lec21：路徑、cycle、connected 的名詞；照定義算遞移閉包', [
  async (tok, S) => { S.g = g7(); S.t = hd('長度 n 的路徑：a→x₁→x₂→…→x_{n−1}→b', 0.8, 7.0); S.d = pl('共 n 個有序對，長度就是 n', 2.6, 6.2); cap('長度為 n 的路徑', ''); },
  async (tok, S) => { txt(S.d, 'directed graph（有向圖）、edge（邊）、path（路徑）'); cap('名詞：有向圖、邊、路徑', ''); },
  async (tok, S) => { S.g.path(['F', 'F'], TC.orange); S.d2 = pl('從自己出發、回到自己：cycle（圖上只有 F→F）', 2.6, 5.5); cap('從自己走回自己：cycle', ''); },
  async (tok, S) => {
    S.g.paint(); S.g.add('D', 'G', TC.purple); S.g.path(['G', 'F', 'D', 'G'], TC.orange);
    S.n = sm('（假設多一條 D→G）', 2.6, 4.9); txt(S.d2, 'G→F→D→G：也是一個 cycle'); cap('假設多一條邊：G→F→D→G', '');
  },
  async (tok, S) => {
    S.g.del('D', 'G'); S.g.paint(); gone(S.n); const rs = rowOf(G7REACH, V7, 'G'); rs.forEach((b) => S.g.vcol(b, TC.green));
    txt(S.d2, 'connected：G 可以連到 ' + rs.join('、')); cap('G 可以連到 F、D、C、E、B', '');
  },
  async (tok, S) => { S.g.vreset(); S.d3 = pl('遞移閉包 = 所有走得到的地方', 2.6, 4.9); cap('遞移閉包 = 你可以走到哪裡', ''); },
  async (tok, S) => { gone(S.d, S.d2, S.d3); S.d = pl('照定義：R ∪ R² ∪ … 要算到無窮大？', 2.6, 6.2); cap('問題：程式不能算到無窮大', ''); },
  async (tok, S) => { S.d2 = pl('7 個點：最長有用的路 = 把其他點都走過再繞回來', 2.6, 5.5); cap('7 個點，最長的路走多遠？', ''); },
  async (tok, S) => {
    let k = 1; while (k < 7 && !sub(pow(G7, k + 1), uni(...Array.from({ length: k }, (_, i) => pow(G7, i + 1))))) k++;
    S.d3 = ok(same(uni(...Array.from({ length: 7 }, (_, i) => pow(G7, i + 1))), G7REACH), '算到 Rⁿ（n = 點數）就夠：R ∪ … ∪ R⁷ = 所有到得了的 ✓', 2.6, 4.8); cap('只要算到 n 次方', '');
  },
  async (tok, S) => { gone(S.g, S.d, S.d2, S.d3, S.t); S.c = code(BCODE, -4.6, 6.4, 0.6); S.c.hl(0); cap('最簡單的演算法：照定義', ''); },
  async (tok, S) => { S.c.hl(2); S.d = pl('Boolean 乘法：1 + 1 = 1', -3.6, 2.6); cap('矩陣乘法裡 1 + 1 = 1', ''); },
  async (tok, S) => { S.c.hl(3); S.d2 = pl('∨（join）：兩個矩陣對應格子做 OR', -3.6, 1.9); cap('聯集 = 對應格子 OR 起來', ''); },
  async (tok, S) => { S.c.hl(2); S.M = M7('i = 2：B = M_R ∨ M_{R²}', 1.6, 6.5); S.M.load(uni(G7, G72), minus(G72, G7)); cap('i = 2：加進長度 2 可以到的', ''); },
  async (tok, S) => {
    S.c.hl(4); let A = new Set(G7), B = new Set(G7); for (let i = 2; i <= 7; i++) { A = comp(A, G7); B = uni(B, A); }
    S.M.load(B, minus(B, G7)); S.ck = ok(same(B, G7REACH), 'i = 3 … 7 做完：B = 遞移閉包 ✓', 3.1, 1.2); cap('一直做到 n：全部找出來', '');
  },
  async (tok, S) => { gone(S.ck, S.d, S.d2); S.d = pl('每次矩陣乘法 n³ 次乘法，迴圈 n 次 → O(n⁴)', -1.4, 0.9); cap('複雜度：n 的四次方', ''); },
  async (tok, S) => {
    const ch = ['1', '2', '3', '4'], CR = R_('12 23 34'), wrong = uni(CR, pow(CR, 2), pow(CR, 4)), right = tclo(ch, CR);
    S.w = bad('講義上的「省時版」只算 M、M²、M⁴、M⁸…，跳過 3、5、6、7 次：not correct', -1.4, 0.2);
    S.w2 = ok(!wrong.has('1>4') && right.has('1>4'), '示意：1→2→3→4 的 (1,4) 只在 R³，省時版漏掉 ✓', -1.4, -0.45); cap('講義上那支省時版是錯的', '');
  },
]);

scene('reB-l21-warshall', 'Lec21：Warshall 演算法：中介站一個一個加進來', [
  async (tok, S) => { S.g = g7(); S.t = hd('Warshall’s algorithm（比暴力法聰明）', 0.8, 7.0); cap('Warshall 演算法', ''); },
  async (tok, S) => { S.d = pl('想法：找「中介站」，看大家能不能透過它到別的地方', 2.6, 6.2); cap('想法：先找一些中介站', ''); },
  async (tok, S) => { S.g.vcol('A', TC.gold, '#3a2a00'); S.d2 = pl('先只准經過 A', 2.6, 5.5); cap('先把 A 當中介站', ''); },
  async (tok, S) => { S.g.vcol('B', TC.gold, '#3a2a00'); txt(S.d2, '再把 B 加進來：可以經過 A 或 B'); cap('再把 B 加進來', ''); },
  async (tok, S) => { S.g.vcol('C', TC.gold, '#3a2a00'); txt(S.d2, '再加 C…中介站越擴越大'); cap('再把 C 含進來', ''); },
  async (tok, S) => { V7.forEach((v) => S.g.vcol(v, TC.gold, '#3a2a00')); txt(S.d2, '全部都能當中介站 → 就是遞移閉包'); cap('最後：不管經過幾個點都算到', ''); },
  async (tok, S) => {
    gone(S.d, S.d2, S.t); S.g.vreset(); S.M = M7('W（從 M_R 開始）', 1.2, 6.5); S.M.load(G7); S.W = new Set(G7);
    S.g.vcol('A', TC.gold, '#3a2a00'); S.M.hiCol('A'); S.k = hot('k = A：誰走得到 A？', 3.2, 1.9); cap('k = A：大家能不能先到 A？', '');
  },
  async (tok, S) => { S.M.load(S.W); S.n = pl('沒有人到得了 A → 不變', 3.2, 1.2); cap('都沒有：A 對大家沒用', ''); },
  async (tok, S) => { gone(S.n); S.g.vreset(); S.g.vcol('B', TC.gold, '#3a2a00'); txt(S.k, 'k = B：誰走得到 B？'); S.M.hiCol('B'); cap('k = B：考慮經過 B', ''); },
  async (tok, S) => { S.M.load(S.W); S.M.set('C', 'B', 1, TC.green); S.n = pl('C 到得了 B', 3.2, 1.2); cap('C 可以到 B', ''); },
  async (tok, S) => { S.M.hiRow('B', TC.yel); txt(S.n, '但 B 那一列全是 0：B 哪裡都不去 → 不變'); cap('B 很內向，哪裡都不去', ''); },
  async (tok, S) => { gone(S.n); S.M.load(S.W); S.g.vreset(); S.g.vcol('C', TC.gold, '#3a2a00'); txt(S.k, 'k = C：誰走得到 C？'); S.M.hiCol('C'); cap('k = C：經過 C 到哪裡去', ''); },
  async (tok, S) => { S.M.load(S.W); S.M.set('D', 'C', 1, TC.green); S.n = pl('D 到得了 C', 3.2, 1.2); cap('D 可以走到 C', ''); },
  async (tok, S) => {
    const add = []; for (const j of V7) if (!S.W.has(kp('D', j)) && S.W.has(kp('C', j))) add.push(j); add.forEach((j) => S.W.add(kp('D', j)));
    S.M.load(S.W, new Set(add.map((j) => kp('D', j)))); txt(S.n, 'C 能到 B、E → D 也能到：新增 (D,' + add.join('),(D,') + ')；(D,E) 本來就有');
    S.ck1 = add.join('') === 'B'; cap('D 透過 C 走到 B；E 本來就有', '');
  },
  async (tok, S) => { S.M.load(S.W); txt(S.n, 'E、F、G 走不到 C'); cap('其他人都走不到 C', ''); },
  async (tok, S) => { S.g.vreset(); S.g.vcol('D', TC.gold, '#3a2a00'); txt(S.k, 'k = D：誰走得到 D？'); S.M.hiCol('D'); txt(S.n, ''); cap('k = D：誰可以透過 D', ''); },
  async (tok, S) => { S.M.load(S.W); S.M.set('F', 'D', 1, TC.green); txt(S.n, 'F 到得了 D'); cap('F 可以走到 D', ''); },
  async (tok, S) => {
    const add = []; for (const j of V7) if (!S.W.has(kp('F', j)) && S.W.has(kp('D', j))) add.push(j); add.forEach((j) => S.W.add(kp('F', j)));
    S.M.load(S.W, new Set(add.map((j) => kp('F', j)))); txt(S.n, 'D 列 OR 進 F 列：F 新增 ' + add.join('、')); S.ck2 = add.join('') === 'BCE'; cap('D 能到哪，F 就能到哪', '');
  },
  async (tok, S) => { S.M.load(S.W, new Set(['F>B']), TC.yel); S.g.path(['F', 'D', 'C', 'B'], TC.orange); txt(S.n, '(F,B) 的 1：其實是 F→D→C→B 濃縮成一格'); cap('這個 1 可能代表一條很長的路', ''); },
  async (tok, S) => { S.g.paint(); S.M.load(S.W); S.r = note('規則：i 到得了 k，就把第 k 列整列 OR 到第 i 列', 3.2, 0.4); cap('做法：整列 copy 下來做 OR', ''); },
  async (tok, S) => { txt(S.n, 'G 到得了 D 嗎？還不行 → 這一輪結束'); cap('G 走不到 D：這輪結束', ''); },
  async (tok, S) => {
    S.g.vreset(); S.g.vcol('E', TC.gold, '#3a2a00'); txt(S.k, 'k = E：C、D、F 到得了 E'); S.M.hiRow('E', TC.yel);
    const add = []; for (const i of V7) for (const j of V7) if (!S.W.has(kp(i, j)) && S.W.has(kp(i, 'E')) && S.W.has(kp('E', j))) add.push(i + j);
    txt(S.n, 'E 列全是 0：加上去也沒有改變' + (add.length ? '' : ' ✓')); cap('k = E：E 那列全 0，沒變化', '');
  },
  async (tok, S) => { S.M.load(S.W); S.g.vreset(); S.g.vcol('F', TC.gold, '#3a2a00'); txt(S.k, 'k = F：F 到 F（自己）'); txt(S.n, '把自己加到自己：不用做事'); cap('k = F：F 加自己，沒事', ''); },
  async (tok, S) => {
    const add = []; for (const j of V7) if (!S.W.has(kp('G', j)) && S.W.has(kp('F', j))) add.push(j); add.forEach((j) => S.W.add(kp('G', j)));
    S.M.load(S.W, new Set(add.map((j) => kp('G', j)))); txt(S.n, 'G 到得了 F：F 列整列 OR 下來，G 新增 ' + add.join('、')); S.ck3 = add.join('') === 'BCDE'; cap('G 走得到 F：F 整列往下加', '');
  },
  async (tok, S) => {
    S.M.load(S.W); S.g.vreset(); S.g.vcol('G', TC.gold, '#3a2a00'); txt(S.k, 'k = G：沒有人走得到 G → 結束');
    gone(S.n, S.r); S.ck = ok(S.ck1 && S.ck2 && S.ck3 && same(S.W, G7T) && same(S.W, G7REACH), 'W = 遞移閉包（和暴力法一樣）✓', 3.2, 1.2); cap('k = G：結束', '');
  },
  async (tok, S) => {
    gone(S.g, S.k, S.ck); S.c = code(['for k := 1 to n:      // 中介站', '  for i := 1 to n:', '    for j := 1 to n:', '      w_ij := w_ij ∨ (w_ik ∧ w_kj)'], -4.6, 6.0, 0.6); S.c.hl(3);
    cap('程式：k 是中介站，第 k 列整排加下去', '');
  },
  async (tok, S) => { S.c.hl(-1); S.d = good('三層迴圈各 n 次 → O(n³)，比暴力法 O(n⁴) 快', -2.6, 2.6); cap('三個迴圈：n³，比暴力法快', ''); },
]);

// ── 等價關係 ──
const PEN = {}; ['A', 'B', 'C', 'D', 'E'].forEach((n, i) => { const t = Math.PI / 2 - i * 2 * Math.PI / 5; PEN[n] = [-3.6 + 2.0 * Math.cos(t), 4.0 + 1.9 * Math.sin(t)]; });
const V5 = Object.keys(PEN);
const loops5 = new Set(V5.map((a) => kp(a, a)));
const showRel = (S, R, hi, c = TC.orange) => { S.g.clearE(); for (const [u, v] of prs(R)) S.g.add(u, v, hi && hi.has(kp(u, v)) ? c : TC.edge); };
function classesOf(V, R) { const seen = new Set(), out = []; for (const a of V) if (!seen.has(a)) { const cl = V.filter((b) => R.has(kp(a, b))); cl.forEach((b) => seen.add(b)); out.push(cl); } return out; }
scene('reB-l21-eqdef', 'Lec21：等價關係 = 反身 + 對稱 + 遞移，圖長成「一坨一坨」', [
  async (tok, S) => { S.t = hd('equivalence relation（等價關係）= reflexive + symmetric + transitive', 0, 7.0); S.g = mkG(PEN); S.n = sm('（示意圖）', -3.6, 1.4); cap('三個性質同時有：等價關係', ''); },
  async (tok, S) => { showRel(S, loops5, loops5, TC.yel); S.d = pl('反身：所有人都畫圈圈', 3.2, 6.0); cap('反身：每個點都有圈', ''); },
  async (tok, S) => { S.R = uni(loops5, R_('CE EC EB BE')); showRel(S, S.R, R_('CE EC EB BE')); S.d2 = pl('對稱：有一條過去就有一條回來', 3.2, 5.3); cap('對稱：過去就要回來', ''); },
  async (tok, S) => { S.R.add('C>B'); showRel(S, S.R, R_('CB')); S.d3 = pl('遞移：C→E、E→B ⇒ 要補 C→B', 3.2, 4.6); cap('遞移：C 到 E、E 到 B，就要補 C 到 B', ''); },
  async (tok, S) => { S.R.add('B>C'); showRel(S, S.R, R_('BC')); S.d4 = pl('又因為對稱：B→C 也要補', 3.2, 3.9); cap('補了又要因對稱再補回去', ''); },
  async (tok, S) => {
    const p = propsOf(V5, S.R); S.ck = ok(p.eq, '三性質都成立：{B,C,E} 互相全連 ✓', 3.2, 3.1); cap('同時有三性質：圖長這樣', '');
  },
  async (tok, S) => {
    gone(S.d, S.d2, S.d3, S.d4, S.ck); S.R0 = R_('CB BA AD CE'); showRel(S, uni(loops5, S.R0));
    S.d = pl('遊戲：隨便加幾條邊，再補到三性質都成立（示意）', 3.2, 6.0); cap('小遊戲：加一些邊，再補齊', '');
  },
  async (tok, S) => { S.R = uni(loops5, S.R0, R_('BC')); showRel(S, S.R, R_('BC')); S.d2 = pl('C→B ⇒ 對稱：B→C', 3.2, 5.3); cap('C 到 B，對稱要補 B 到 C', ''); },
  async (tok, S) => { S.R = uni(S.R, R_('CA AC')); showRel(S, S.R, R_('CA AC')); S.d3 = pl('C→B→A ⇒ 遞移：C→A，再對稱 A→C', 3.2, 4.6); cap('C 透過 B 到 A：補 C→A', ''); },
  async (tok, S) => {
    const E = eqClose(V5, S.R0); showRel(S, E, minus(E, S.R)); S.R = E;
    S.d4 = pl('A→D、C→E…一直補：補完共 ' + E.size + ' 對 = 5 × 5', 3.2, 3.9); cap('事情還不止這麼少：一直補下去', '');
  },
  async (tok, S) => { const cl = classesOf(V5, S.R); S.ck = ok(cl.length === 1 && S.R.size === 25, '連在一起的就全部連起來：一整坨 ✓', 3.2, 3.1); cap('有連在一起的，就全部連在一起', ''); },
  async (tok, S) => { gone(S.d, S.d2, S.d3, S.d4, S.ck); S.R0 = R_('AB DE'); showRel(S, S.R0); S.d = pl('極端的例子：只有 A→B、D→E（示意）', 3.2, 6.0); cap('再看一個極端的例子', ''); },
  async (tok, S) => {
    const E = eqClose(V5, S.R0); S.R = E; showRel(S, minus(E, R_('CC')), minus(E, S.R0));
    S.d2 = pl('有關係的全部要有關係：{A,B}、{D,E} 各自全連', 3.2, 5.3); cap('有關係的，全部都要有關係', '');
  },
  async (tok, S) => {
    showRel(S, S.R, R_('CC'), TC.yel); const cl = classesOf(V5, S.R);
    S.d3 = ok(cl.length === 3 && S.R.size === 4 + 4 + 1, 'C 自己一坨，但要補圈 (C,C)：共 4 + 4 + 1 = 9 對 ✓', 3.2, 4.6); cap('C 自己一坨，別忘了它的圈', '');
  },
  async (tok, S) => {
    const cl = classesOf(V5, S.R); S.bl = cl.map((c, i) => { const xs = c.map((n) => PEN[n][0]), ys = c.map((n) => PEN[n][1]); const cx = xs.reduce((s, x) => s + x, 0) / c.length, cy = ys.reduce((s, y) => s + y, 0) / c.length; return blob(cx, cy + 0.15, 0.75 + (Math.max(...xs) - Math.min(...xs)) / 2, 0.75 + (Math.max(...ys) - Math.min(...ys)) / 2, CLS[i], 0.22); });
    S.d4 = pl('像班上的小團體：你的朋友都是我的朋友', 3.2, 3.9); cap('像一群一群的小團體', '');
  },
  async (tok, S) => { S.d5 = note('「等價」：同一群的人都可以當代表，跟一個人講 = 跟整群講', 3.2, 3.1); cap('為什麼叫等價：誰都能當代表', ''); },
]);

const FA = ['1', '2', '3', '4', '5'], FV = { 1: 'x', 2: 'y', 3: 'x', 4: 'x', 5: 'y' };   // 示意的函數 f
const FR = new Set(FA.flatMap((a) => FA.filter((b) => FV[a] === FV[b]).map((b) => kp(a, b))));
const md = (a, m) => ((a % m) + m) % m;
const CONG = (lo, hi, m) => { const V = []; for (let i = lo; i <= hi; i++) V.push(String(i)); const R = new Set(); for (const a of V) for (const b of V) if (md(+a - +b, m) === 0) R.add(kp(a, b)); return { V, R }; };
const kpN = (a, b) => a + '>' + b;
function propsN(V, R) { // 多位數元素版本（'>' 分隔）
  const ps = [...R].map((k) => k.split('>')); const ref = V.every((a) => R.has(kpN(a, a))); const sym = ps.every(([a, b]) => R.has(kpN(b, a)));
  let tra = true; for (const [a, b] of ps) for (const [b2, c] of ps) if (b === b2 && !R.has(kpN(a, c))) tra = false; return { ref, sym, tra, eq: ref && sym && tra };
}
scene('reB-l21-eqproof', 'Lec21：照定義證明等價關係：=、f(a) = f(b)、同餘 mod 5', [
  async (tok, S) => { S.t = hd('要說 R 是等價關係：照定義檢查', 0, 7.0); cap('要說服人家：根據定義', ''); },
  async (tok, S) => { S.L = lines(['R：任意 a ∈ A，aRa', 'S：aRb ⇒ bRa', 'T：aRb 且 bRc ⇒ aRc'], -3.4, 6.0, 0.7); S.n = sm('對所有 a, b, c ∈ A，三件事都要檢查', -3.4, 3.8); cap('三件事全部檢查一次', ''); },
  async (tok, S) => { S.e = hot('例 1：「=」（等於）', 2.6, 6.0); cap('例子：等於', ''); },
  async (tok, S) => { S.e1 = good('a = a ✓（自己等於自己）', 2.6, 5.3); cap('a = a：反身', ''); },
  async (tok, S) => { S.e2 = good('a = b ⇒ b = a ✓（等式可以寫顛倒）', 2.6, 4.6); cap('a = b 就有 b = a：對稱', ''); },
  async (tok, S) => { S.e3 = good('a = b、b = c ⇒ a = c ✓', 2.6, 3.9); cap('a = b = c，所以 a = c：遞移', ''); },
  async (tok, S) => {
    gone(S.e, S.e1, S.e2, S.e3); S.e = hot('例 2：f: A → B，aRb ⇔ f(a) = f(b)', 2.6, 6.0);
    S.g = mkG({ 1: [0.4, 4.8], 2: [1.4, 4.8], 3: [2.4, 4.8], 4: [3.4, 4.8], 5: [4.4, 4.8], x: [1.4, 2.6], y: [3.4, 2.6] });
    for (const a of FA) S.g.add(a, FV[a], TC.purple); S.n2 = sm('（f 為示意）', 4.9, 2.6); cap('函數值一樣就說有關係', '');
  },
  async (tok, S) => { S.e1 = good('f(a) = f(a)：反身 ✓', 2.6, 1.6); cap('自己對到同一個值：反身', ''); },
  async (tok, S) => { S.e2 = good('f(a) = f(b) ⇒ f(b) = f(a)：對稱 ✓', 2.6, 1.0); cap('a、b 同值，b、a 也同值：對稱', ''); },
  async (tok, S) => { const p = propsOf(FA, FR); S.e3 = ok(p.eq, 'f(a) = f(b) = f(c)：遞移 ✓（逐對檢查 ' + FR.size + ' 對）', 2.6, 0.4); cap('a、b 同值，b、c 同值，a、c 也同值', ''); },
  async (tok, S) => { gone(S.e, S.e1, S.e2, S.e3, S.g, S.n2); S.e = hot('例 3：同餘 a ≡ b (mod m)', 2.6, 6.0); cap('以前學過的同餘符號', ''); },
  async (tok, S) => { S.e1 = pl('m = 5：除以 5 餘數一樣', 2.6, 5.3); cap('看除以 5 的餘數', ''); },
  async (tok, S) => { S.e2 = ok(md(1, 5) === md(6, 5), '1 ÷ 5 餘 1，6 ÷ 5 餘 1 ⇒ 1 ≡ 6 ✓', 2.6, 4.6); cap('1 和 6 除以 5 都餘 1', ''); },
  async (tok, S) => { S.e3 = ok(md(1, 5) === md(11, 5) && md(6, 5) === md(11, 5), '1 ≡ 11，所以 6 ≡ 11 ✓', 2.6, 3.9); cap('1 和 11 也同餘，那 6 和 11 也同餘', ''); },
  async (tok, S) => { const { V, R } = CONG(-10, 15, 5); const p = propsN(V, R); S.e4 = ok(p.eq, '反身、對稱、遞移：同餘是等價關係 ✓（−10…15 全部驗算）', 2.6, 3.1); cap('同餘本身就是一個等價關係', ''); },
]);

const NUMS = []; for (let i = -5; i <= 14; i++) NUMS.push(i);
const COLX = [-5.2, -2.6, 0, 2.6, 5.2];
scene('reB-l21-classes', 'Lec21：除以 5 的餘數：五堆 = 五個等價類 [0]…[4]', [
  async (tok, S) => {
    S.t = hd('數字很大時，可以用除以 5 的餘數代表', 0, 7.0); S.cb = {};
    NUMS.forEach((n, i) => { S.cb[n] = cube(String(n), TC.node, [0.6, 0.5, 0.3], -5.6 + (i % 10) * 1.24, 6.0 - Math.floor(i / 10) * 0.8, 0); });
    cap('整數用它的餘數來代表', '');
  },
  async (tok, S) => { S.h = []; const go = (r) => { const ms = NUMS.filter((n) => md(n, 5) === r); ms.forEach((n, j) => { P.move(S.cb[n], COLX[r], 3.7 - j * 0.66, 0); S.cb[n].material.color.set(CLS[r]); }); S.h.push(sm('餘 ' + r, COLX[r], 4.35)); }; S.go = go; go(0); cap('0、5、10、−5：一群人', ''); },
  async (tok, S) => { S.go(1); cap('1、6、11、−4：除以 5 餘 1', ''); },
  async (tok, S) => { S.go(2); S.go(3); S.go(4); cap('餘 2、餘 3、餘 4', ''); },
  async (tok, S) => { const okA = NUMS.every((n) => [0, 1, 2, 3, 4].filter((r) => md(n, 5) === r).length === 1); S.ck = ok(okA, '總共 5 堆，每個數剛好在一堆 ✓', 0, 0.9); cap('總共分成五堆', ''); },
  async (tok, S) => { gone(S.ck); S.k0 = hot('[0]', COLX[0], 5.0); cap('符號：一個框框，把 0 寫在裡面', ''); },
  async (tok, S) => { S.d = pl('[0] = {…, −5, 0, 5, 10, …}', 0, 0.9); cap('[0] 代表 −5、0、5、10 這堆', ''); },
  async (tok, S) => { S.d2 = ok(NUMS.filter((n) => md(n, 5) === md(5, 5)).join() === NUMS.filter((n) => md(n, 5) === 0).join(), '[5] = [0]：換誰當代表都可以 ✓', 0, 0.25); txt(S.k0, '[0] = [5]'); cap('不喜歡 0？用 5 當代表也可以', ''); },
  async (tok, S) => { S.k1 = hot('[1]', COLX[1], 5.0); txt(S.d, '[1] = {…, −4, 1, 6, 11, …}'); gone(S.d2); cap('這一堆就用 1 來表示', ''); },
  async (tok, S) => { S.k2 = [2, 3, 4].map((r) => hot('[' + r + ']', COLX[r], 5.0)); txt(S.d, '整數分成 [0]、[1]、[2]、[3]、[4] 五類'); cap('整數可以分成五類', ''); },
  async (tok, S) => { S.d2 = note('每一類叫 equivalence class（等價類）', 0, 0.25); cap('這叫等價類', ''); },
]);

const PA = ['1', '2', '3', '4', '5'], PBL = [['1', '2'], ['3', '4'], ['5']];
const PREL = new Set(PBL.flatMap((b) => b.flatMap((x) => b.map((y) => kp(x, y)))));
scene('reB-l21-partition', 'Lec21：partition（分割）的兩個條件，和等價關係是一體兩面', [
  async (tok, S) => { S.t = hd('partition（分割）', 0, 7.0); cap('另一個講法：分割', ''); },
  async (tok, S) => { S.bx = [0, 1, 2, 3, 4].map((r) => blob(COLX[r], 3.4, 1.15, 1.25, CLS[r], 0.25)); S.lb = [0, 1, 2, 3, 4].map((r) => [hot('[' + r + ']', COLX[r], 4.4), ...[-5, 0, 5].map((q, j) => sm(String(q + r) + (j === 2 ? ', …' : ','), COLX[r], 3.7 - j * 0.5))]); cap('所有整數在 mod 5 底下分成五類', ''); },
  async (tok, S) => { S.d = pl('每個人只能挑自己所屬的那一群', 0, 6.1); cap('每個人只能在自己那一群', ''); },
  async (tok, S) => { txt(S.d, '整數被切割成五塊：這叫 partition'); cap('整數被切成五塊：partition', ''); },
  async (tok, S) => { S.d2 = pl('partition 有兩個特性', 0, 5.4); cap('分割有兩個特性', ''); },
  async (tok, S) => { S.c1 = pl('① 每個人只屬於其中一塊（5 只在 [0]）', 0, 2.3); cap('第一：每個人只屬於唯一一塊', ''); },
  async (tok, S) => { S.c2 = pl('② 每個人一定有歸屬（餘數一定是 0–4 之一）', 0, 1.6); cap('第二：每個人一定要有歸屬', ''); },
  async (tok, S) => {
    gone(S.bx, S.lb, S.c1, S.c2, S.d, S.d2); S.big = blob(-3.0, 3.8, 3.0, 2.3, '#cdbfa6', 0.2);
    S.bl = [[-4.8, 4.9], [-2.9, 5.1], [-1.2, 4.3], [-4.4, 2.7], [-2.0, 2.6]].map(([x, y], i) => { const b = blob(x, y, 0.8, 0.7, CLS[i], 0.35); return [b, pl('A' + (i + 1), x, y)]; });
    S.d = pl('集合 A 切成子集合 A₁ … A₅', 3.0, 6.0); cap('一個集合切成 A1 到 A5', '');
  },
  async (tok, S) => { S.d2 = pl('每一塊 = 一個等價類', 3.0, 5.3); cap('每一塊裡的人互相有關係', ''); },
  async (tok, S) => { gone(S.big, S.bl); txt(S.d, '舉一個例子'); gone(S.d2); cap('舉一個集合的例子', ''); },
  async (tok, S) => {
    S.g = mkG({ 1: [-5.4, 4.6], 2: [-4.2, 4.6], 3: [-2.6, 4.6], 4: [-1.4, 4.6], 5: [0.2, 4.6] });
    S.bl = [blob(-4.8, 4.6, 1.1, 0.6, CLS[0], 0.3), blob(-2.0, 4.6, 1.1, 0.6, CLS[1], 0.3), blob(0.2, 4.6, 0.55, 0.6, CLS[2], 0.3)];
    txt(S.d, 'A = {1,2,3,4,5}：A₁ = {1,2}，A₂ = {3,4}，A₃ = {5}'); cap('A1 = {1,2}、A2 = {3,4}、A3 = {5}', '');
  },
  async (tok, S) => { S.d2 = pl('A₁、A₂、A₃ 都是 A 的子集合', 3.0, 3.2); cap('每一塊都是 A 的子集合', ''); },
  async (tok, S) => { const u = new Set(PBL.flat()); S.e1 = ok(PA.every((a) => u.has(a)) && u.size === PA.length, 'A₁ ∪ A₂ ∪ A₃ = A ✓（每個人至少在一塊）', 3.0, 2.5); cap('聯集起來等於 A', ''); },
  async (tok, S) => {
    let dis = true; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j && PBL[i].some((x) => PBL[j].includes(x))) dis = false;
    S.e2 = ok(dis, 'Aᵢ ∩ Aⱼ = ∅（i ≠ j）✓（不能重複）', 3.0, 1.8); cap('不同塊的交集是空集合', '');
  },
  async (tok, S) => { gone(S.d2, S.e1, S.e2); txt(S.d, '在分割上定義一個關係：同一塊的全部連起來'); cap('在分割上定義一個關係', ''); },
  async (tok, S) => { for (const x of ['1', '2']) for (const y of ['1', '2']) S.g.add(x, y, CLS[0]); S.e1 = pl('{1,2}：(1,1)(2,2)(1,2)(2,1)', 3.0, 3.2); cap('1、2 一夥：所有配對都連起來', ''); },
  async (tok, S) => { for (const x of ['3', '4']) for (const y of ['3', '4']) S.g.add(x, y, CLS[1]); S.e2 = pl('{3,4}：(3,3)(3,4)(4,3)(4,4)', 3.0, 2.5); cap('3、4 一夥：互相都有關係', ''); },
  async (tok, S) => { S.g.add('5', '5', CLS[2]); S.e3 = pl('{5}：(5,5)', 3.0, 1.8); cap('5 跟別人沒關係，但跟自己有', ''); },
  async (tok, S) => {
    const p = propsOf(PA, PREL); const back = classesOf(PA, PREL).map((c) => c.join('')).join('|') === PBL.map((b) => b.join('')).join('|');
    S.ck = ok(p.eq && PREL.size === 9 && back, '共 9 對，是等價關係，等價類剛好是 A₁、A₂、A₃ ✓', 0, 0.9); cap('等價關係和分割是一體兩面', '');
  },
]);

const NL = (x) => x * 1.6;   // 數線比例
scene('reB-l21-more', 'Lec21：更多等價關係（字串長度、|a|、小數部分）、[a] 的寫法、分割的形式', [
  async (tok, S) => { S.t = hd('字串上的關係：長度一樣就有關係', 0, 7.0); cap('字串：長度一樣就有關係', ''); },
  async (tok, S) => {
    const ss = ['"123"', '"abc"', '"xyz"', '"pqr"', '"stu"'];
    S.s = ss.map((s, i) => pl(s, -4.0 + i * 2.0, 6.0));
    S.d = pl('長度 = 字元個數；"123"、"abc"、"xyz"… 長度都是 3：同一組', 0, 5.2); cap('長度 3 的字串是同一組', '');
  },
  async (tok, S) => { S.d2 = good('自己和自己一樣長、我和你一樣長則你和我一樣長、可以串下去 ✓', 0, 4.5); cap('反身、對稱、遞移都成立', ''); },
  async (tok, S) => { gone(S.s, S.d, S.d2); txt(S.t, '整數：|a| = |b| 就有關係'); S.d = pl('2 和 −2：絕對值一樣 → 有關係', 0, 6.0); cap('2 和 −2 絕對值一樣', ''); },
  async (tok, S) => { S.d2 = pl('−2 和 2 也有關係（對稱）；2 和 2 有關係（反身）', 0, 5.3); cap('對稱、反身', ''); },
  async (tok, S) => {
    const V = []; for (let i = -6; i <= 6; i++) V.push(String(i)); const R = new Set(); for (const a of V) for (const b of V) if (Math.abs(+a) === Math.abs(+b)) R.add(kpN(a, b));
    S.d3 = ok(propsN(V, R).eq, '2 ~ −2、−2 ~ 2 ⇒ 2 ~ 2：遞移 ✓（−6…6 全部驗算）', 0, 4.6); cap('遞移也成立：等價關係', '');
  },
  async (tok, S) => {
    gone(S.d, S.d2, S.d3); txt(S.t, '小數部分一樣：aRb ⇔ a − b 是整數');
    S.ax = P.line(-6.4, 3.0, 6.4, 3.0); S.tk = [-3, -2, -1, 0, 1, 2, 3].map((n) => sm(String(n), NL(n), 2.6)); cap('小數點後面那部分一樣', '');
  },
  async (tok, S) => {
    S.pts = [1.3, 2.3, 3.3].map((v) => { const m = cube('', TC.green, [0.18, 0.4, 0.18], NL(v), 3.0, 0); return [m, sm(String(v), NL(v), 3.6)]; });
    const okd = Number.isInteger(Math.round((2.3 - 1.3) * 1e9) / 1e9) && Number.isInteger(Math.round((3.3 - 2.3) * 1e9) / 1e9);
    S.d = ok(okd, '1.3 ~ 2.3 ~ 3.3（差都是整數）✓', 0, 6.0); cap('1.3 跟 2.3、3.3 一樣', '');
  },
  async (tok, S) => {
    S.n13 = [cube('', TC.hot, [0.18, 0.4, 0.18], NL(-1.3), 3.0, 0), sm('−1.3', NL(-1.3), 3.6)];
    S.d2 = bad('但 1.3 和 −1.3：差 2.6 不是整數 ✘', 0, 5.3); cap('但跟 −1.3 不一樣', '');
  },
  async (tok, S) => { S.d3 = pl('定義是「相減等於整數」，不是「看起來小數一樣」', 0, 4.6); cap('記得定義：兩個相減是整數', ''); },
  async (tok, S) => {
    S.m17 = [cube('', TC.green, [0.18, 0.4, 0.18], NL(-1.7), 3.0, 0), sm('−1.7', NL(-1.7), 3.6), cube('', TC.green, [0.18, 0.4, 0.18], NL(-0.7), 3.0, 0), sm('−0.7', NL(-0.7), 3.6)];
    S.d4 = ok(Math.abs((1.3 - (-1.7)) - 3) < 1e-9, '和 1.3 同類的負數是 −0.7、−1.7（1.3 − (−1.7) = 3）✓', 0, 1.9); cap('跟 1.3 同類的是 −1.7', '');
  },
  async (tok, S) => { S.d5 = note('負數小心：−1.3 = −2 + 0.7，它的「小數部分」是 0.7', 0, 1.2); cap('小心負數這個陷阱', ''); },
  async (tok, S) => {
    gone(S.d, S.d2, S.d3, S.d4, S.d5, S.ax, S.tk, S.pts, S.n13, S.m17); txt(S.t, '等價類：[a] = {x | x R a}'); S.d = pl('跟 a 有關係的全部寫成一個集合', 0, 6.0);
    cap('跟 a 同一類的寫成一個集合', '');
  },
  async (tok, S) => {
    const cl = classesOf(PA, PREL); S.d2 = ok(cl.length === 3 && cl[0].join() === '1,2', '剛剛的例子：[1] = [2] = {1,2}，[3] = {3,4}，[5] = {5} ✓', 0, 5.3); cap('[1] = {1,2}，挑 2 當代表也可以', '');
  },
  async (tok, S) => { S.d3 = pl('partition：把這些子集合再放進一個集合', 0, 4.6); cap('分割是「子集合組成的集合」', ''); },
  async (tok, S) => { S.e1 = pl('字串：[a] = 和 a 一樣長的所有字串', 0, 3.7); cap('字串的等價類：一樣長的', ''); },
  async (tok, S) => { S.e2 = pl('絕對值：[a] = {a, −a}', 0, 3.1); cap('絕對值：a 和 −a 兩個', ''); },
  async (tok, S) => { S.e3 = pl('小數部分：[a] = {…, a − 2, a − 1, a, a + 1, a + 2, …}', 0, 2.5); cap('相減是整數：a 加減整數', ''); },
  async (tok, S) => { S.e4 = pl('同餘 mod m：[a] = {…, a − m, a, a + m, a + 2m, …}', 0, 1.9); cap('同餘：a 加減 m 的倍數', ''); },
  async (tok, S) => { S.e5 = good('A 的分割寫成：{{1, 2}, {3, 4}, {5}}', 0, 1.1); cap('分割的正式寫法', ''); },
]);

// ════════ RexPywlCmV8（Equivalence Relation 英文短片：定義與 R1–R6 六個例子，A = {0,1,2,3}） ════════
const EA = ['0', '1', '2', '3'];
const EQP = { 0: [-5.8, 5.6], 1: [-3.4, 5.6], 2: [-3.4, 3.0], 3: [-5.8, 3.0] };
const ER = { R1: R_('00 11 22 33'), R2: R_('00 02 20 22 23 32 33'), R3: R_('00 11 12 21 22 33'), R4: R_('00 01 02 10 11 12 20 22 33'), R5: new Set(), R6: new Set(EA.flatMap((a) => EA.map((b) => kp(a, b)))) };
function eqBoard(S, name, R, o = {}) {
  S.g = mkG(EQP); S.g.load(R); S.M = mkM(EA, EA, -0.9, 5.9, 0.55, 'M_' + name); S.M.load(R);
  S.t = hd(name + ' = ' + (R.size === 0 ? '∅' : R.size === 16 ? 'A × A（16 對）' : fmtR(R, EA)), 0, 7.8);
  S.rows = {}; S.mk = (k, v, t) => { gone(S.rows[k]); const y = { ref: 5.6, sym: 4.9, tra: 4.2, eq: 3.2 }[k]; S.rows[k] = v === null ? pl(t, 4.1, y) : v ? good(t, 4.1, y) : bad(t, 4.1, y); };
}
scene('reB-eq-def', 'Equivalence relation 的定義', [
  async (tok, S) => { S.t = hd('Equivalence relation（等價關係）', 0, 6.6); cap('先看定義', ''); },
  async (tok, S) => { S.L = lines(['R 是 A 上的關係', 'R 是等價關係 ⇔', '  reflexive（反身）', '  symmetric（對稱）', '  transitive（遞移）'], 0, 5.6, 0.62); cap('反身、對稱、遞移 ⇔ 等價關係', ''); },
  async (tok, S) => { S.n = note('if and only if：三個都要成立', 0, 2.2); cap('三個性質缺一不可', ''); },
  async (tok, S) => { S.L.slice(2).forEach((l) => { l.element.className = 'lab-label good'; }); cap('一定要三個都滿足', ''); },
]);
scene('reB-eq-r1', 'R1 = {(0,0),(1,1),(2,2),(3,3)}', [
  async (tok, S) => { S.h = hd('看例子：A = {0, 1, 2, 3}', 0, 7.2); S.g = mkG(EQP); cap('用例子來理解', ''); },
  async (tok, S) => { S.h.element.textContent = 'A = {0, 1, 2, 3}'; cap('集合 A 有 0、1、2、3', ''); },
  async (tok, S) => { gone(S.h, S.g); eqBoard(S, 'R1', ER.R1); cap('R1 只有四個 (a, a)', ''); },
  async (tok, S) => { S.mk('eq', null, 'R1 是等價關係嗎？'); cap('R1 是等價關係嗎？', ''); },
  async (tok, S) => { S.mk('ref', null, 'reflexive？每個 a 都要有 (a, a)'); cap('先看反身', ''); },
  async (tok, S) => { S.g.col('0', '0', TC.green); S.M.set('0', '0', 1, TC.green); cap('有 (0,0)', ''); },
  async (tok, S) => { S.g.col('1', '1', TC.green); S.M.set('1', '1', 1, TC.green); cap('有 (1,1)', ''); },
  async (tok, S) => { S.g.col('2', '2', TC.green); S.M.set('2', '2', 1, TC.green); cap('有 (2,2)', ''); },
  async (tok, S) => { S.g.col('3', '3', TC.green); S.M.set('3', '3', 1, TC.green); cap('最後有 (3,3)', ''); },
  async (tok, S) => { S.mk('ref', propsOf(EA, ER.R1).ref, 'reflexive ✓'); cap('所以 R1 是反身的', ''); },
  async (tok, S) => { const p = propsOf(EA, ER.R1); S.mk('sym', p.sym, 'symmetric ✓'); S.mk('tra', p.tra, 'transitive ✓'); cap('對稱、遞移也成立（自己檢查）', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R1).eq, 'R1 是等價關係 ✓'); cap('三個都成立：等價關係', ''); },
]);
scene('reB-eq-r2', 'R2：缺 (1,1)，不反身', [
  async (tok, S) => { eqBoard(S, 'R2', ER.R2); cap('R2 有 7 個有序對', ''); },
  async (tok, S) => { S.mk('eq', null, 'R2 是等價關係嗎？'); cap('R2 是等價關係嗎？', ''); },
  async (tok, S) => { S.mk('ref', null, 'reflexive？'); cap('先問自己：反身嗎？', ''); },
  async (tok, S) => { S.g.col('0', '0', TC.green); S.M.set('0', '0', 1, TC.green); cap('有 (0,0)', ''); },
  async (tok, S) => { S.g.col('2', '2', TC.green); S.M.set('2', '2', 1, TC.green); cap('有 (2,2)', ''); },
  async (tok, S) => { S.g.col('3', '3', TC.green); S.M.set('3', '3', 1, TC.green); cap('有 (3,3)', ''); },
  async (tok, S) => { S.g.vcol('1', TC.hot); S.M.set('1', '1', 0, TC.hot); S.mk('ref', propsOf(EA, ER.R2).ref, 'reflexive ✘：沒有 (1,1)'); cap('但沒有 (1,1)：不反身', ''); },
  async (tok, S) => { S.mk('sym', null, '其他性質不用再檢查'); cap('不用再檢查其他性質', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R2).eq, 'R2 不是等價關係 ✓'); cap('R2 不是等價關係', ''); },
]);
scene('reB-eq-r3', 'R3：{0}、{1,2}、{3} 三群，是等價關係', [
  async (tok, S) => { eqBoard(S, 'R3', ER.R3); cap('R3 有 6 個有序對', ''); },
  async (tok, S) => { S.mk('eq', null, 'R3 是等價關係嗎？'); cap('R3 是等價關係嗎？', ''); },
  async (tok, S) => { for (const a of EA) S.g.col(a, a, TC.green); S.mk('ref', propsOf(EA, ER.R3).ref, 'reflexive ✓：(0,0)(1,1)(2,2)(3,3)'); cap('四個 (a, a) 都在：反身', ''); },
  async (tok, S) => { S.g.paint(); S.mk('sym', null, 'symmetric？'); cap('對稱嗎？', ''); },
  async (tok, S) => { S.g.col('1', '2', TC.orange); S.g.col('2', '1', TC.orange); S.M.load(ER.R3, R_('12 21')); cap('有 (1,2)，也有 (2,1)', ''); },
  async (tok, S) => { S.M.load(ER.R3); S.mk('sym', propsOf(EA, ER.R3).sym, 'symmetric ✓'); cap('所以對稱', ''); },
  async (tok, S) => { S.g.paint(); S.mk('tra', null, 'transitive？'); cap('遞移嗎？', ''); },
  async (tok, S) => { S.g.path(['1', '2', '1'], TC.orange); S.g.col('1', '1', TC.green); S.n = pl('(1,2)、(2,1) ⇒ (1,1) 在 ✓', 4.1, 1.9); cap('(1,2)、(2,1) ⇒ 要有 (1,1)：有', ''); },
  async (tok, S) => { S.g.paint(); S.g.path(['2', '1', '2'], TC.orange); S.g.col('2', '2', TC.green); S.n.element.textContent = '(2,1)、(1,2) ⇒ (2,2) 在 ✓'; cap('(2,1)、(1,2) ⇒ 要有 (2,2)：有', ''); },
  async (tok, S) => { S.g.paint(); S.mk('tra', propsOf(EA, ER.R3).tra, 'transitive ✓（所有組合都驗算）'); cap('所以也遞移', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R3).eq, 'R3 是等價關係 ✓：類別 {0}、{1,2}、{3}'); cap('R3 是等價關係', ''); },
]);
scene('reB-eq-r4', 'R4：缺 (2,1)，不對稱', [
  async (tok, S) => { eqBoard(S, 'R4', ER.R4); cap('R4 有 9 個有序對', ''); },
  async (tok, S) => { S.mk('eq', null, 'R4 是等價關係嗎？'); cap('R4 是等價關係嗎？', ''); },
  async (tok, S) => { for (const a of EA) S.g.col(a, a, TC.green); S.mk('ref', propsOf(EA, ER.R4).ref, 'reflexive ✓'); cap('(0,0)(1,1)(2,2)(3,3) 都在：反身', ''); },
  async (tok, S) => { S.g.paint(); S.mk('sym', null, 'symmetric？'); cap('對稱嗎？一對一對檢查', ''); },
  async (tok, S) => { S.g.col('0', '1', TC.green); S.g.col('1', '0', TC.green); cap('(0,1) → (1,0) 在', ''); },
  async (tok, S) => { S.g.col('0', '2', TC.green); S.g.col('2', '0', TC.green); cap('(0,2) → (2,0) 在', ''); },
  async (tok, S) => { S.g.col('1', '2', TC.hot); S.M.load(ER.R4, R_('21'), TC.hot); S.n = bad('(1,2) 在，(2,1) 不在', 4.1, 1.9); cap('(1,2) 在，但沒有 (2,1)', ''); },
  async (tok, S) => { S.mk('sym', propsOf(EA, ER.R4).sym, 'symmetric ✘'); cap('所以不對稱', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R4).eq, 'R4 不是等價關係 ✓'); cap('R4 不是等價關係', ''); },
]);
scene('reB-eq-r5', 'R5 = ∅：空關係不反身', [
  async (tok, S) => { eqBoard(S, 'R5', ER.R5); cap('R5 是空集合', ''); },
  async (tok, S) => { S.mk('ref', null, 'reflexive？'); cap('反身嗎？', ''); },
  async (tok, S) => { EA.forEach((a) => S.M.set(a, a, 0, TC.hot)); S.mk('ref', propsOf(EA, ER.R5).ref, 'reflexive ✘：(0,0)…(3,3) 一個都沒有'); cap('空關係不反身', ''); },
  async (tok, S) => { S.mk('sym', null, '不用再看對稱'); cap('不用再檢查對稱', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R5).eq, 'R5 不是等價關係 ✓'); cap('R5 不是等價關係', ''); },
]);
scene('reB-eq-r6', 'R6 = A × A：最大的關係，是等價關係', [
  async (tok, S) => { eqBoard(S, 'R6', ER.R6); cap('R6 = A × A', ''); },
  async (tok, S) => { S.mk('ref', null, 'reflexive？'); cap('反身嗎？', ''); },
  async (tok, S) => { S.n = pl('A × A 是最大的關係：' + ER.R6.size + ' 對全部都有', 4.1, 1.9); cap('最大的關係：每一對都在', ''); },
  async (tok, S) => { const p = propsOf(EA, ER.R6); S.mk('ref', p.ref, 'reflexive ✓'); S.mk('sym', p.sym, 'symmetric ✓'); S.mk('tra', p.tra, 'transitive ✓'); cap('一定反身、對稱、遞移', ''); },
  async (tok, S) => { S.mk('eq', propsOf(EA, ER.R6).eq, 'R6 是等價關係 ✓（只有一類）'); cap('R6 是等價關係', ''); },
]);
scene('reB-eq-sum', '整理：六個例子', [
  async (tok, S) => {
    S.t = hd('六個關係的結果', 0, 7.0);
    S.L = Object.keys(ER).map((n, i) => { const p = propsOf(EA, ER[n]); return ok(p.eq, n + '：' + (p.eq ? '是 ✓' : '不是 ✘（' + (!p.ref ? '不反身' : !p.sym ? '不對稱' : '不遞移') + '）'), -3.0, 6.0 - i * 0.7); });
    cap('看過六個不同的關係', '');
  },
  async (tok, S) => { S.d = pl('判斷方法：檢查三個性質', 2.6, 6.0); cap('判斷很簡單：檢查三個性質', ''); },
  async (tok, S) => { S.d2 = good('反身、對稱、遞移都成立 ⇒ 等價關係', 2.6, 5.2); cap('三個都成立，就是等價關係', ''); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '離散數學・第 9 章',
    title: '二元關係：等價關係與偏序',
    color: 'var(--dm)',
    modes: [
      { id: 'props', name: '關係與性質', enter: () => enterProps() },
      { id: 'closure', name: '閉包與 Warshall', enter: () => enterClosure(true) },
      { id: 'equiv', name: '等價類與分割', enter: enterEquiv },
      { id: 'hasse', name: '偏序與 Hasse 圖', enter: enterHasse },
      { id: 'topo', name: '拓撲排序', enter: enterTopo },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['rel-arrows-matrix', 'rel-reflexive', 'rel-symmetric', 'rel-antisymmetric', 'rel-transitive', 'rel-composition', 'closure-rs', 'warshall',
      'equiv-mod3', 'equiv-partition', 'poset-divides', 'hasse-build', 'extremal', 'lattice', 'topo-sort'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
