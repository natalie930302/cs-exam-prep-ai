// 離散數學 第9章：二元關係 — 箭頭圖與 0/1 矩陣、reflexive / symmetric / antisymmetric / transitive、
// 合成、閉包（reflexive / symmetric / transitive：Warshall）、等價關係與分割、偏序與 Hasse 圖、
// maximal / minimal / greatest / least、lub / glb 與 lattice、拓撲排序。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec20–21、趙啟超 6A–8B、Equivalence Relation）目前都還沒有逐字稿，
// 所有場景依課本（Rosen 第 9 章 Relations／Grimaldi 第 7 章）的標準例子製作，標題前註明（課本）。
// 慣例（Rosen）：M_R 的 (i,j) 格 = 1 ⇔ (aᵢ,aⱼ) ∈ R；Warshall 的 W_k = 只允許經過 a₁…a_k 的路徑；
// 合成 S∘R = 先 R 再 S，M_{S∘R} = M_R ⊙ M_S（Boolean product）。
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
      const cls = [rr, rr + m, rr + 2 * m].join(', ');
      return { q: '在 ℤ 上 a R b ⇔ a ≡ b (mod ' + m + ')。[' + a + '] 包含哪些非負整數？', opts: [cls + ', …', [rr + 1, rr + 1 + m, rr + 1 + 2 * m].join(', ') + ', …', [Math.abs(a), Math.abs(a) + m].join(', ') + ', …', [0, m, 2 * m].join(', ') + (rr ? ', …' : ' 以外的數')], ans: cls + ', …', why: a + ' 除以 ' + m + ' 餘 ' + rr + '，等價類 = 所有餘 ' + rr + ' 的整數。' };
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
      'equiv-mod3', 'equiv-partition', 'poset-divides', 'hasse-build', 'extremal', 'lattice', 'topo-sort'],
    stop() { stopTimer(); },
  };
}
