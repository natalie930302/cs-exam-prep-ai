// 離散數學 第10章：代數結構 — 二元運算與封閉性、群的四條公理（Cayley 表檢查）、循環群（旋轉）與生成元、
// 子群、陪集與 Lagrange 定理、置換群 S₃／cycle notation、ring 與 field（ℤₙ 的零因子）、Boolean algebra 化簡。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章唯一的影片（Algebraic Structures: Groups, Rings, and Fields）還沒有逐字稿，所有場景依課本
// （Grimaldi 第 16 章 Groups／Rings、第 15 章 Boolean Algebra；Rosen 第 12 章）標準例子製作，標題前註明（課本）。
// 慣例：置換合成 σ∘τ = 先做 τ 再做 σ；Cayley 表第 a 列第 b 行放 a∘b；Boolean：x' 表補數、xy 表 AND、x + y 表 OR。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const lcm = (a, b) => a / gcd(a, b) * b;
  const mod = (a, n) => ((a % n) + n) % n;
  const PAL = ['#cdbfa6', '#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a', '#d64545', '#7a8fd6', '#b06fb0', '#6fb08a', '#b0956f', '#8a6fb0', '#6f9fb0'];
  const COL = { idle: '#cdbfa6', hot: '#d64545', gold: '#c08a1f', ok: '#2fc092', blue: '#4b9ee2', dim: '#e9e1d3', off: '#e6ddcf', on: '#e9c53a' };
  const GOLD = '#6a4a00', RED = '#5a1010', GREEN = '#0f5a3a';

  // ───────────────────────── 共用小工具 ─────────────────────────
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const txt = (l, t) => { l.element.textContent = t; };
  const glow = (m, c) => { if (m && m.material) m.material.emissive = new THREE.Color(c || '#000000'); };
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
  async function anim(tok, ms, fn) { const steps = 14; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok === undefined) await sleep(ms / steps); else await beat(tok, ms / steps); } }

  // ───────────────────────── 代數結構：資料 ─────────────────────────
  // S₃：用 [σ(0),σ(1),σ(2)] 表示；r = 旋轉 120°、f = 固定頂點 0 的翻轉
  const compose = (s, t) => t.map((i) => s[i]); // (s∘t)(i) = s(t(i))：先 t 再 s
  const S3E = { e: [0, 1, 2], r: [1, 2, 0], 'r²': [2, 0, 1], f: [0, 2, 1] };
  S3E.rf = compose(S3E.r, S3E.f); S3E['r²f'] = compose(S3E['r²'], S3E.f);
  const S3N = Object.keys(S3E);
  const s3name = (p) => S3N.find((k) => S3E[k].join() === p.join());
  function structure(kind, n) {
    if (kind === 'zadd') return { name: '(ℤ' + sub(n) + ', +)', els: range(n).map(String), op: (a, b) => String(mod(+a + +b, n)), abelian: true };
    if (kind === 'zmul') return { name: '(ℤ' + sub(n) + ', ×)', els: range(n).map(String), op: (a, b) => String(mod(+a * +b, n)) };
    if (kind === 'zmul0') return { name: '(ℤ' + sub(n) + ' − {0}, ×)', els: range(n).slice(1).map(String), op: (a, b) => String(mod(+a * +b, n)) };
    if (kind === 'units') return { name: '(ℤ' + sub(n) + '*, ×)', els: range(n).filter((a) => gcd(a, n) === 1).map(String), op: (a, b) => String(mod(+a * +b, n)) };
    if (kind === 'zsub') return { name: '(ℤ' + sub(n) + ', −)', els: range(n).map(String), op: (a, b) => String(mod(+a - +b, n)) };
    return { name: 'S₃（三角形的對稱）', els: S3N.slice(), op: (a, b) => s3name(compose(S3E[a], S3E[b])) };
  }
  const range = (n) => [...Array(n).keys()];
  const sub = (n) => String(n).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[d]).join('');
  function axioms(S) {
    const E = S.els, inS = (x) => E.includes(x), res = {};
    let cw = null; for (const a of E) for (const b of E) if (!cw && !inS(S.op(a, b))) cw = [a, b];
    res.closure = { ok: !cw, w: cw, why: cw ? cw[0] + '∘' + cw[1] + ' = ' + S.op(cw[0], cw[1]) + ' 不在集合裡' : '表裡每格都在集合內' };
    let aw = null;
    if (!cw) for (const a of E) for (const b of E) for (const c of E) if (!aw && S.op(S.op(a, b), c) !== S.op(a, S.op(b, c))) aw = [a, b, c];
    res.assoc = { ok: !cw && !aw, w: aw, why: cw ? '不封閉，先不談' : aw ? '(' + aw[0] + '∘' + aw[1] + ')∘' + aw[2] + ' = ' + S.op(S.op(aw[0], aw[1]), aw[2]) + ' ≠ ' + aw[0] + '∘(' + aw[1] + '∘' + aw[2] + ') = ' + S.op(aw[0], S.op(aw[1], aw[2])) : '(a∘b)∘c = a∘(b∘c) 全部 ' + E.length ** 3 + ' 組都對' };
    const id = E.find((e) => E.every((a) => S.op(e, a) === a && S.op(a, e) === a));
    res.identity = { ok: id !== undefined, e: id, why: id !== undefined ? 'e = ' + id + '：那一列、那一行和表頭一模一樣' : '找不到 e 使 e∘a = a∘e = a' };
    const inv = {}; let noInv = null;
    if (id !== undefined) for (const a of E) { const b = E.find((x) => S.op(a, x) === id && S.op(x, a) === id); if (b === undefined) { if (noInv === null) noInv = a; } else inv[a] = b; }
    res.inverse = { ok: id !== undefined && noInv === null, inv, w: noInv, why: id === undefined ? '沒有單位元，談不上反元素' : noInv !== null ? noInv + ' 沒有反元素（那一列沒有 ' + id + '）' : E.map((a) => a + '⁻¹=' + inv[a]).join(' ') };
    res.group = res.closure.ok && res.assoc.ok && res.identity.ok && res.inverse.ok;
    res.abelian = !cw && E.every((a) => E.every((b) => S.op(a, b) === S.op(b, a)));
    return res;
  }
  const okSpan = (ok) => (ok ? '<span class="ok">✓</span>' : '<span class="no">✗</span>');

  // Cayley 表：n×n 方塊，顏色 = 元素
  function cayleyTable(S, o = {}) {
    const E = S.els, n = E.length, cs = o.cs ?? Math.min(0.8, 5.6 / n), x0 = (o.cx ?? 0) - (n - 1) * cs / 2, z0 = o.z0 ?? -2.4;
    const colOf = (v) => (E.includes(v) ? PAL[(E.indexOf(v) + 1) % PAL.length] : '#3a3a3a');
    const head = { row: [], col: [] }, cells = [];
    E.forEach((a, i) => {
      head.col.push(cube(a, colOf(a), [cs * 0.86, 0.3, cs * 0.86], x0 + i * cs, 0.15, z0 - cs * 1.15));
      head.row.push(cube(a, colOf(a), [cs * 0.86, 0.3, cs * 0.86], x0 - cs * 1.15, 0.15, z0 + i * cs));
    });
    tag('∘', 'ptr', x0 - cs * 1.15, 0.4, z0 - cs * 1.15);
    E.forEach((a, i) => { cells.push(E.map((b, j) => { const v = S.op(a, b); const m = o.empty ? null : cube(v, colOf(v), [cs * 0.86, 0.22, cs * 0.86], x0 + j * cs, 0.11, z0 + i * cs); return m; })); });
    const fill = (i, j, dropH = 2) => { const v = S.op(E[i], E[j]); cells[i][j] = cube(v, colOf(v), [cs * 0.86, 0.22, cs * 0.86], x0 + j * cs, 0.11, z0 + i * cs, dropH); return cells[i][j]; };
    const clearGlow = () => { cells.flat().forEach((m) => m && glow(m, null)); head.row.concat(head.col).forEach((m) => glow(m, null)); };
    return { E, cells, head, fill, clearGlow, cs, x0, z0, colOf };
  }

  // ───────────────────────── 模式 1：Cayley 表與群公理 ─────────────────────────
  const cy = { kind: 'zadd', n: 4 };
  function enterCayley() {
    fresh([0, 9.6, 7.6], [0, 0, 0.2]);
    const S = structure(cy.kind, cy.n);
    controls('<select id="yK"><option value="zadd">(ℤₙ, +)</option><option value="zsub">(ℤₙ, −)</option><option value="zmul">(ℤₙ, ×)</option><option value="zmul0">(ℤₙ − {0}, ×)</option><option value="units">(ℤₙ*, ×) 與 n 互質</option><option value="s3">S₃</option></select>'
      + '<label>n = <input id="yN" type="number" min="2" max="12" value="' + cy.n + '" style="width:52px"></label>'
      + '<button id="yC">封閉</button><button id="yA">結合</button><button id="yI">單位元</button><button id="yV">反元素</button>');
    $('yK').value = cy.kind;
    $('yK').onchange = (e) => { cy.kind = e.target.value; enterCayley(); };
    $('yN').onchange = (e) => { const n = Number(e.target.value); if (!(n >= 2 && n <= 12)) { log('n 請填 2～12', true); e.target.value = cy.n; return; } cy.n = n; enterCayley(); };
    const T = cayleyTable(S), ax = axioms(S);
    const E = S.els;
    setState(S.name + (ax.group ? ' 是群' : ' 不是群'), [['封閉 closure', okSpan(ax.closure.ok)], ['結合 associative', okSpan(ax.assoc.ok)], ['單位元 identity', okSpan(ax.identity.ok) + (ax.identity.ok ? ' e = ' + ax.identity.e : '')], ['反元素 inverse', okSpan(ax.inverse.ok)], ['交換 abelian', okSpan(ax.abelian)]],
      (ax.group ? '<span class="ok">四條都成立 → group</span>' + (ax.abelian ? '（abelian：表對主對角線對稱）' : '（non-abelian）') + '<br>群的 Cayley 表每列、每行都是一個排列（Latin square）' : '<span class="no">不是群</span>')
      + (cy.kind === 'zmul' ? '<br>零因子：' + (E.filter((a) => +a && E.some((b) => +b && S.op(a, b) === '0')).join(', ') || '沒有（n 是質數 → ℤₙ 是 field）') : ''));
    on('yC', () => { T.clearGlow(); if (ax.closure.ok) { T.cells.flat().forEach((m) => glow(m, GREEN)); log('封閉：' + ax.closure.why); } else { const [a, b] = ax.closure.w; glow(T.cells[E.indexOf(a)][E.indexOf(b)], RED); log('不封閉：' + ax.closure.why, true); } });
    on('yA', () => { T.clearGlow(); if (ax.assoc.ok) log('結合律：' + ax.assoc.why); else { if (ax.assoc.w) ax.assoc.w.forEach((x) => glow(T.head.row[E.indexOf(x)], RED)); log('結合律不成立：' + ax.assoc.why, true); } });
    on('yI', () => { T.clearGlow(); if (ax.identity.ok) { const i = E.indexOf(ax.identity.e); T.cells[i].forEach((m) => glow(m, GOLD)); T.cells.forEach((r) => glow(r[i], GOLD)); log('單位元：' + ax.identity.why); } else log(ax.identity.why, true); });
    on('yV', () => {
      T.clearGlow();
      if (!ax.identity.ok) { log(ax.inverse.why, true); return; }
      E.forEach((a, i) => E.forEach((b, j) => { if (S.op(a, b) === ax.identity.e) glow(T.cells[i][j], GREEN); }));
      if (ax.inverse.w !== null && ax.inverse.w !== undefined) { const i = E.indexOf(ax.inverse.w); T.cells[i].forEach((m) => glow(m, RED)); log(ax.inverse.why, true); }
      else log('反元素（綠格 = 結果是 e）：' + ax.inverse.why);
    });
    log('群（group）：封閉、結合、有單位元、每個元素有反元素。按按鈕逐條檢查。');
  }

  // ───────────────────────── 模式 2：循環群 = 旋轉 ─────────────────────────
  const cyc = { n: 6, k: 1, pos: 0, seen: [0] };
  function polygonPlate(n, R = 2.2) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.3, n), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 0.7 }));
    m.castShadow = true; m.receiveShadow = true;
    const g = new THREE.Group(); g.add(m); m.position.y = 0.15;
    const mark = lab.box(COL.hot, [0.4, 0.4, 0.4]); mark.position.set(0, 0.5, -R * 0.82); g.add(mark);
    // CylinderGeometry 的頂點從 +z 方向開始：把 0 號頂點轉到正上方（−z）
    g.rotation.y = 0;
    lab.world.add(g);
    return g;
  }
  const ringXZ = (n, R, i) => { const t = -Math.PI / 2 - i * 2 * Math.PI / n; return [Math.cos(t) * R, Math.sin(t) * R]; };
  function enterCyclic() {
    fresh([0, 9.4, 7.2], [0, 0, 0.3]);
    cyc.pos = 0; cyc.seen = [0];
    controls('<label>n = <input id="cN" type="number" min="3" max="12" value="' + cyc.n + '" style="width:52px"></label><label>生成元 k = <input id="cK" type="number" min="0" max="11" value="' + cyc.k + '" style="width:52px"></label><button class="primary" id="cStep">再轉 k 格</button><button id="cAll">轉到回原位</button><button id="cReset">重來</button>');
    $('cN').onchange = (e) => { const n = Number(e.target.value); if (!(n >= 3 && n <= 12)) { log('n 請填 3～12', true); e.target.value = cyc.n; return; } cyc.n = n; cyc.k = Math.min(cyc.k, n - 1); enterCyclic(); };
    $('cK').onchange = (e) => { const k = Number(e.target.value); if (!(k >= 0 && k < cyc.n)) { log('k 請填 0～' + (cyc.n - 1), true); e.target.value = cyc.k; return; } cyc.k = k; enterCyclic(); };
    const n = cyc.n, plate = polygonPlate(n);
    const tiles = range(n).map((i) => { const [x, z] = ringXZ(n, 3.6, i); return cube('R' + i, COL.idle, [0.75, 0.3, 0.6], x, 0.15, z); });
    const show = () => {
      const ord = n / gcd(n, cyc.k);
      tiles.forEach((m, i) => { m.material.color.set(cyc.seen.includes(i) ? PAL[1] : COL.idle); glow(m, i === cyc.pos ? GOLD : null); });
      setState('C' + sub(n) + '：正 ' + n + ' 邊形的旋轉', [['Rᵢ', '轉 i·360°/' + n], ['目前', 'R' + cyc.pos], ['⟨R' + cyc.k + '⟩', '{' + range(ord).map((t) => 'R' + mod(t * cyc.k, n)).join(', ') + '}'], ['ord(R' + cyc.k + ')', n + '/gcd(' + n + ',' + cyc.k + ') = ' + ord]],
        gcd(n, cyc.k) === 1 ? '<span class="ok">R' + cyc.k + ' 是生成元</span>：轉得到每一個位置（gcd = 1）' : '<span class="no">R' + cyc.k + ' 不是生成元</span>：只生成 ' + ord + ' 個元素的子群');
    };
    const step = async () => {
      const from = plate.rotation.y, to = from + cyc.k * 2 * Math.PI / n;
      cyc.pos = mod(cyc.pos + cyc.k, n);
      if (!cyc.seen.includes(cyc.pos)) cyc.seen.push(cyc.pos);
      show();
      for (let t = 1; t <= 12; t++) { plate.rotation.y = from + (to - from) * t / 12; await sleep(25); }
      log('R' + mod(cyc.pos - cyc.k, n) + ' ∘ R' + cyc.k + ' = R' + cyc.pos + '（' + mod(cyc.pos - cyc.k, n) + ' + ' + cyc.k + ' ≡ ' + cyc.pos + ' mod ' + n + '）');
    };
    on('cStep', step);
    on('cAll', async () => { for (let t = 0; t < n; t++) { await step(); if (cyc.pos === 0) break; await sleep(200); } });
    on('cReset', enterCyclic);
    log('Rᵢ ∘ Rⱼ = R₍ᵢ₊ⱼ₎ mod n：旋轉群和 (ℤₙ, +) 同構，是循環群。');
    show();
  }

  // ───────────────────────── 模式 3：陪集與 Lagrange ─────────────────────────
  const cs3 = { n: 12, k: 4 };
  function enterCoset() {
    fresh([0, 10, 8.2], [0, 1, 0.6]);
    controls('<label>|G| = n = <input id="lN" type="number" min="2" max="16" value="' + cs3.n + '" style="width:52px"></label><label>H = ⟨k⟩，k = <input id="lK" type="number" min="0" max="15" value="' + cs3.k + '" style="width:52px"></label><button class="primary" id="lGo">分成陪集 a + H</button>');
    $('lN').onchange = (e) => { const n = Number(e.target.value); if (!(n >= 2 && n <= 16)) { log('n 請填 2～16', true); e.target.value = cs3.n; return; } cs3.n = n; cs3.k = mod(cs3.k, n); enterCoset(); };
    $('lK').onchange = (e) => { const k = Number(e.target.value); if (!(k >= 0 && k < cs3.n)) { log('k 請填 0～' + (cs3.n - 1), true); e.target.value = cs3.k; return; } cs3.k = k; enterCoset(); };
    const n = cs3.n, k = cs3.k, d = gcd(n, k) || n, h = n / d;
    const H = range(h).map((t) => mod(t * k, n)).sort((a, b) => a - b);
    const blocks = range(n).map((x) => { const [px, pz] = ringXZ(n, 3, x); return cube(x, H.includes(x) ? PAL[1] : COL.idle, [0.6, 0.5, 0.6], px, 0.25, pz); });
    setState('(ℤ' + sub(n) + ', +) 的子群 H = ⟨' + k + '⟩', [['H', '{' + H.join(', ') + '}'], ['|H|', String(h)], ['陪集個數 [G:H]', String(d)]],
      'Lagrange：|G| = |H| · [G:H] → ' + n + ' = ' + h + ' × ' + d + '<br>子群的大小一定整除 |G|');
    on('lGo', () => {
      range(n).forEach((x) => { const r = x % d, t = Math.floor(x / d); blocks[x].material.color.set(PAL[(r + 1) % PAL.length]); move(blocks[x], (r - (d - 1) / 2) * Math.min(1.6, 11 / Math.max(d, 1)), 0.25 + t * Math.min(0.55, 6 / h), 0); });
      log('陪集：' + range(d).map((r) => r + '+H = {' + H.map((x) => mod(x + r, n)).sort((a, b) => a - b).join(',') + '}').join('；'));
      log('每個陪集一樣大（|H| = ' + h + '）、兩兩不相交、合起來是 G → 分割。');
    });
    log('陪集 a + H = {a + h | h ∈ H}。所有陪集把 G 切成大小相同的幾塊。');
  }

  // ───────────────────────── 模式 4：置換群 ─────────────────────────
  const pm = { n: 4, slots: null };
  function parsePerm(s, n) {
    const a = String(s).trim().split(/[\s,]+/).map(Number);
    if (a.length !== n || a.some((x) => !(x >= 1 && x <= n)) || new Set(a).size !== n) return null;
    return a.map((x) => x - 1);
  }
  function cycles(p) {
    const seen = new Set(), out = [];
    for (let i = 0; i < p.length; i++) { if (seen.has(i)) continue; const c = []; let j = i; while (!seen.has(j)) { seen.add(j); c.push(j + 1); j = p[j]; } if (c.length > 1) out.push(c); }
    return out;
  }
  const cycStr = (p) => { const c = cycles(p); return c.length ? c.map((x) => '(' + x.join(' ') + ')').join('') : '(1)（恆等）'; };
  const ordOf = (p) => cycles(p).reduce((s, c) => lcm(s, c.length), 1);
  const parity = (p) => (cycles(p).reduce((s, c) => s + c.length - 1, 0) % 2 ? '奇置換' : '偶置換');
  const oneLine = (p) => p.map((x) => x + 1).join(' ');
  function enterPerm() {
    fresh([0, 7.5, 9], [0, 0.6, 0]);
    const n = pm.n;
    controls('<label>n = <select id="pN"><option>3</option><option>4</option><option>5</option></select></label><label>σ = <input id="pS" value="' + (n === 3 ? '2 3 1' : n === 4 ? '2 1 4 3' : '3 1 2 5 4') + '" style="width:80px"></label><label>τ = <input id="pT" value="' + (n === 3 ? '1 3 2' : n === 4 ? '2 3 4 1' : '1 2 4 3 5') + '" style="width:80px"></label>'
      + '<button class="primary" id="pDoS">做 σ</button><button id="pST">σ∘τ（先 τ）</button><button id="pTS">τ∘σ（先 σ）</button><button id="pReset">歸位</button>');
    $('pN').value = String(n);
    $('pN').onchange = (e) => { pm.n = Number(e.target.value); enterPerm(); };
    const X = (i) => (i - (n - 1) / 2) * 1.8;
    range(n).forEach((i) => { ctx.tile(V3(X(i), 0.04, 0), 1.3, 1.3); tag('位置 ' + (i + 1), 'idx', X(i), 0.1, 1.1); });
    pm.slots = range(n).map((i) => cube(i + 1, PAL[i + 1], [0.9, 0.8, 0.9], X(i), 0.45, 0));
    const res = tag('', 'ptr alt', 0, 2.4, 0);
    const apply = async (p) => {
      const old = pm.slots.slice();
      old.forEach((m, i) => { move(m, X(p[i]), 1.6, 0); });
      await sleep(500);
      old.forEach((m, i) => { move(m, X(p[i]), 0.45, 0); pm.slots[p[i]] = m; });
      await sleep(400);
    };
    const get = (id) => { const p = parsePerm($(id).value, n); if (!p) log((id === 'pS' ? 'σ' : 'τ') + ' 要是 1～' + n + ' 的排列（one-line notation，例如 2 3 1）', true); return p; };
    const show = (title, p) => { txt(res, title + ' = ' + cycStr(p)); setState(title, [['one-line', oneLine(p)], ['cycle', cycStr(p)], ['order', String(ordOf(p))], ['奇偶', parity(p)]], 'σ(i) = 第 i 個數：位置 i 的方塊搬到位置 σ(i)<br>order = 各 cycle 長度的 lcm'); };
    on('pDoS', async () => { const s = get('pS'); if (!s) return; await apply(s); show('σ', s); log('σ = ' + cycStr(s) + '，order ' + ordOf(s)); });
    const both = async (first, second, nm) => { const a = get(first), b = get(second); if (!a || !b) return; await apply(a); await apply(b); const c = compose(b, a); show(nm, c); log(nm + ' = ' + cycStr(c)); };
    on('pST', () => both('pT', 'pS', 'σ∘τ'));
    on('pTS', () => both('pS', 'pT', 'τ∘σ'));
    on('pReset', enterPerm);
    log('Sₙ = {1..n} 的所有排列，運算是合成；|Sₙ| = n!。n ≥ 3 時 σ∘τ 和 τ∘σ 一般不同（non-abelian）。');
    show('σ', parsePerm($('pS').value, n) || range(n));
  }

  // ───────────────────────── 模式 5：Boolean algebra（3 變數方塊） ─────────────────────────
  // 解析：expr = term ('+' term)*；term = factor (['·'|'*'] factor)*（相鄰即 AND）；factor = atom ("'")*
  function parseBool(src) {
    const s = String(src).replace(/\s+/g, '').replace(/[’`]/g, "'"); let i = 0;
    const peek = () => s[i];
    function atom() {
      const c = s[i];
      if (c === '(') { i++; const e = expr(); if (s[i] !== ')') throw new Error('少了 )'); i++; return e; }
      if (c === '~' || c === '¬') { i++; const a = atom(); return (v) => 1 - a(v); }
      if ('xyz'.includes(c)) { i++; const k = 'xyz'.indexOf(c); return (v) => v[k]; }
      if (c === '0' || c === '1') { i++; const k = +c; return () => k; }
      throw new Error(c === undefined ? '式子不完整' : '看不懂「' + c + '」');
    }
    function factor() { let a = atom(); while (peek() === "'") { i++; const b = a; a = (v) => 1 - b(v); } return a; }
    function term() { let a = factor(); while (i < s.length && (peek() === '·' || peek() === '*' || peek() === '(' || 'xyz01~¬'.includes(peek()))) { if (peek() === '·' || peek() === '*') i++; const b = factor(), c = a; a = (v) => c(v) & b(v); } return a; }
    function expr() { let a = term(); while (peek() === '+') { i++; const b = term(), c = a; a = (v) => c(v) | b(v); } return a; }
    const f = expr(); if (i < s.length) throw new Error('看不懂「' + s.slice(i) + '」');
    return f;
  }
  const BV = range(8).map((m) => [(m >> 2) & 1, (m >> 1) & 1, m & 1]);
  const vName = (v) => v.join('');
  function boolCube(cx, o = {}) {
    const S = o.s ?? 1.5, y0 = o.y0 ?? 0.6;
    const pos = (v) => V3(cx + (v[0] - 0.5) * 2 * S, y0 + v[2] * 2 * S, (0.5 - v[1]) * 2 * S);
    const vm = BV.map((v) => cube(vName(v), COL.off, [0.62, 0.42, 0.42], ...pos(v).toArray()));
    const edges = [];
    for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
      const d = a ^ b; if (d !== 1 && d !== 2 && d !== 4) continue;
      const p = pos(BV[a]), q = pos(BV[b]), n = q.clone().sub(p);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, n.length() - 0.6, 6), new THREE.MeshStandardMaterial({ color: '#b9a98c' }));
      m.position.copy(p.clone().add(q).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(V3(0, 1, 0), n.normalize());
      lab.world.add(m); edges.push({ a, b, m });
    }
    tag('x →', 'idx', cx + 2 * S * 0.5 + 0.6, 0.2, 2 * S * 0.5 + 0.5);
    return {
      vm, edges, pos,
      light(f, color = COL.on) { BV.forEach((v, i) => { const on = f(v); vm[i].material.color.set(on ? color : COL.off); vm[i].scale.set(on ? 1.15 : 1, on ? 1.15 : 1, on ? 1.15 : 1); }); edges.forEach((e) => e.m.material.color.set('#b9a98c')); },
      edgeHi(a, b, c) { const e = edges.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)); if (e) e.m.material.color.set(c); },
    };
  }
  const LAWS = {
    absorb: ['x + xy', 'x', 'Absorption 吸收律'],
    demorgan: ["(x + y)'", "x'y'", 'De Morgan'],
    dist: ['x + yz', '(x + y)(x + z)', 'Distributive（+ 對 · 也可分配）'],
    consensus: ["xy + x'z + yz", "xy + x'z", 'Consensus'],
    idem: ['x + x', 'x', 'Idempotent 冪等'],
    simplify: ["xyz + xyz' + x'yz", 'xy + yz', '化簡（合併相鄰頂點）'],
    wrong: ['x + yz', '(x + y)z', '錯誤示範'],
  };
  const bl = { k: 'absorb' };
  function enterBool() {
    fresh([0, 6.4, 11.5], [0, 1.8, 0]);
    const [l0, r0] = LAWS[bl.k];
    controls('<select id="bL">' + Object.keys(LAWS).map((k) => '<option value="' + k + '">' + LAWS[k][2] + '</option>').join('') + '</select><label>f = <input id="bF" value="' + l0 + '" style="width:120px"></label><label>g = <input id="bG" value="' + r0 + '" style="width:120px"></label><button class="primary" id="bGo">比較 f 與 g</button>');
    $('bL').value = bl.k;
    $('bL').onchange = (e) => { bl.k = e.target.value; enterBool(); };
    const L = boolCube(-3.2), R = boolCube(3.2);
    tag('f', 'ptr', -3.2, 4.4, 0); tag('g', 'ptr alt', 3.2, 4.4, 0);
    const go = () => {
      let f, g;
      try { f = parseBool($('bF').value); } catch (e) { log('f：' + e.message, true); return; }
      try { g = parseBool($('bG').value); } catch (e) { log('g：' + e.message, true); return; }
      L.light(f); R.light(g, COL.ok);
      const diff = BV.filter((v) => f(v) !== g(v));
      diff.forEach((v) => { const i = BV.indexOf(v); glow(L.vm[i], RED); glow(R.vm[i], RED); });
      BV.forEach((v, i) => { if (!diff.includes(v)) { glow(L.vm[i], null); glow(R.vm[i], null); } });
      setState('f 與 g 的真值（頂點 = xyz）', [['f = 1 的頂點', BV.filter((v) => f(v)).map(vName).join(' ') || '無'], ['g = 1 的頂點', BV.filter((v) => g(v)).map(vName).join(' ') || '無']],
        diff.length ? '<span class="no">不相等</span>：在 ' + diff.map(vName).join('、') + ' 不同' : '<span class="ok">f = g</span>：8 個頂點完全一樣 → 恆等式成立');
      log(diff.length ? 'f ≠ g，反例 xyz = ' + vName(diff[0]) : 'f = g（8 種輸入都相同）', !!diff.length);
    };
    on('bGo', go);
    log('方塊的 8 個頂點 = (x,y,z) 的 8 種輸入；亮的頂點 = 函數值 1。兩式亮法一樣 ⇔ 布林恆等式。');
    go();
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const phi = (n) => range(n).filter((a) => gcd(a, n) === 1).length;
  function genQ() {
    const r = Math.random();
    if (r < 0.13) { const n = pick([6, 8, 9, 10, 12, 15, 18, 20]), k = 1 + rnd(n - 1), o = n / gcd(n, k); return { q: '在 (ℤ' + sub(n) + ', +) 中，元素 ' + k + ' 的 order 是？', opts: [...new Set([o, n, k, gcd(n, k), n - k].map(String))].slice(0, 4), ans: String(o), why: 'ord(k) = n / gcd(n,k) = ' + n + '/' + gcd(n, k) + ' = ' + o + '。' }; }
    if (r < 0.25) { const n = pick([5, 6, 8, 9, 10, 12, 14, 15, 16, 18]); const g = range(n).filter((a) => gcd(a, n) === 1); return { q: '(ℤ' + sub(n) + ', +) 有幾個生成元？', opts: [...new Set([g.length, n - 1, Math.floor(n / 2), 2].map(String))].concat(['1']).slice(0, 4), ans: String(g.length), why: '生成元 = 與 n 互質的 k，共 φ(' + n + ') = ' + g.length + ' 個：' + g.join(', ') + '。' }; }
    if (r < 0.37) { const n = pick([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]); const pr = range(n - 2).every((t) => n % (t + 2) !== 0); return { q: '(ℤ' + sub(n) + ' − {0}, ×) 是群嗎？', opts: ['是', '不是：不封閉（有零因子）', '不是：沒有單位元', '不是：不結合'], ans: pr ? '是' : '不是：不封閉（有零因子）', why: pr ? n + ' 是質數：非零元素都和 ' + n + ' 互質、都有乘法反元素。' : n + ' 不是質數：例如 ' + (range(n).find((t) => t > 1 && n % t === 0)) + ' × ' + (n / range(n).find((t) => t > 1 && n % t === 0)) + ' ≡ 0，0 不在集合裡。' }; }
    if (r < 0.49) { const n = pick([12, 15, 18, 20, 24, 30]); const non = range(n).map((x) => x + 1).filter((d) => n % d !== 0 && d < n); const bad = pick(non); const divs = range(n).map((x) => x + 1).filter((d) => n % d === 0 && d > 1 && d < n); const o = [bad, ...divs.sort(() => Math.random() - 0.5).slice(0, 3)].map(String); return { q: '|G| = ' + n + '，下列哪個「不可能」是子群的大小？', opts: o, ans: String(bad), why: 'Lagrange：子群大小必整除 |G| = ' + n + '，而 ' + bad + ' ∤ ' + n + '。' }; }
    if (r < 0.6) { const n = pick([7, 9, 10, 11, 12, 13, 14, 15]); const us = range(n).filter((a) => a > 1 && gcd(a, n) === 1); const a = pick(us); const inv = range(n).find((b) => mod(a * b, n) === 1); return { q: '在 (ℤ' + sub(n) + '*, ×) 中，' + a + ' 的反元素是？', opts: [...new Set([inv, n - a, mod(inv + 1, n) || 2, a].map(String))].concat(['1']).slice(0, 4), ans: String(inv), why: a + ' × ' + inv + ' = ' + a * inv + ' ≡ 1 (mod ' + n + ')。' }; }
    if (r < 0.72) {
      const n = 5 + rnd(3); const p = range(n).sort(() => Math.random() - 0.5);
      return { q: 'σ = (' + oneLine(p) + ')（one-line）寫成 cycle 是？order？', opts: [...new Set([cycStr(p) + '，order ' + ordOf(p), cycStr(p) + '，order ' + cycles(p).reduce((s, c) => s + c.length, 0), cycStr(range(n).map((i) => p.indexOf(i))) + '，order ' + ordOf(p), cycStr(p) + '，order ' + n, cycStr(p) + '，order ' + ordOf(p) * 2, cycStr(range(n).map((i) => p.indexOf(i))) + '，order ' + n])].slice(0, 4), ans: cycStr(p) + '，order ' + ordOf(p), why: '從 1 開始追 1 → σ(1) → …；order = 各 cycle 長度的 lcm（不是和）。' + (cycles(p).length ? '' : '') };
    }
    if (r < 0.86) {
      const qs2 = [["x + xy = ？", ['x', 'xy', 'y', '1'], 'x', '吸收律：x + xy = x(1 + y) = x。'], ["(xy)' = ？", ["x' + y'", "x'y'", "x + y", "xy'"], "x' + y'", 'De Morgan：(xy)\' = x\' + y\'。'], ["x(x' + y) = ？", ['xy', 'x', 'y', '0'], 'xy', "xx' + xy = 0 + xy = xy。"], ["x + x'y = ？", ['x + y', 'y', 'xy', '1'], 'x + y', "分配律：x + x'y = (x + x')(x + y) = x + y。"], ["xy + xy' = ？", ['x', 'y', '1', 'xy'], 'x', "x(y + y') = x·1 = x：方塊上相鄰兩頂點合成一條邊。"], ["x + 1 = ？", ['1', 'x', '0', "x'"], '1', 'Boundedness（Dominance）：x + 1 = 1。'], ["x + yz 的 dual 是？", ['x(y + z)', "x' + y'z'", 'x + y + z', 'xyz'], 'x(y + z)', 'Dual：+ ↔ ·、0 ↔ 1，變數不取補。']];
      const [q, opts, ans, why] = pick(qs2); return { q: 'Boolean algebra：' + q, opts, ans, why };
    }
    const S = pick([['(ℤ₄, +)', '是群（abelian）'], ['(ℤ₆, ×)', '不是群：0 沒有反元素'], ['(ℤ₅*, ×)', '是群（abelian）'], ['S₃', '是群（non-abelian）'], ['(ℤ₄, −)', '不是群：沒有單位元（減法不結合）']]);
    return { q: S[0] + ' 是群嗎？', opts: ['是群（abelian）', '是群（non-abelian）', '不是群：0 沒有反元素', '不是群：沒有單位元（減法不結合）'], ans: S[1], why: '逐條檢查封閉、結合、單位元、反元素；S₃ 中 rf ≠ fr 所以 non-abelian。' };
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
  async function scClosure(tok) {
    fresh([0, 8, 9], [0, 0.6, 0]);
    say('（課本）二元運算 ∘：A × A → A', '「→ A」就是封閉性 closure');
    await beat(tok, 2600);
    const pairs = [[1, 3], [5, 7], [3, 9]];
    for (let k = 0; k < pairs.length; k++) {
      const [a, b] = pairs[k], x = -4 + k * 4;
      const ma = cube(a, PAL[1], [0.8, 0.7, 0.8], x - 0.7, 0.35, -1.6, 3), mb = cube(b, PAL[1], [0.8, 0.7, 0.8], x + 0.7, 0.35, -1.6, 3);
      await beat(tok, 700);
      move(ma, x - 0.45, 0.35, 0.4); move(mb, x + 0.45, 0.35, 0.4);
      await beat(tok, 500);
      lab.flyAway(bodyOf(ma), V3(0, 3, 0)); lab.flyAway(bodyOf(mb), V3(0, 3, 0));
      cube(a + b, COL.hot, [1, 0.8, 1], x, 0.4, 0.4, 2.5);
      say('奇數 + 奇數：' + a + ' + ' + b + ' = ' + (a + b) + '（偶數）', '跑出奇數集合 → (奇數, +) 不封閉');
      await beat(tok, 1500);
    }
    lab.clear();
    for (let k = 0; k < pairs.length; k++) {
      const [a, b] = pairs[k], x = -4 + k * 4;
      cube(a + '×' + b, PAL[1], [1.4, 0.7, 0.9], x, 0.35, -1.2, 2);
      await beat(tok, 500);
      cube(a * b, COL.ok, [1, 0.8, 1], x, 0.4, 0.8, 2.5);
      say('奇數 × 奇數 = ' + a * b + '：還是奇數', '(奇數, ×) 封閉');
      await beat(tok, 1200);
    }
    say('先確認封閉，才談得上代數結構', 'semigroup（封閉＋結合）→ monoid（＋單位元）→ group（＋反元素）');
    await beat(tok, 3400);
  }
  async function scGroupZ4(tok) {
    fresh([0, 9.6, 7.6], [0, 0, 0.2]);
    const S = structure('zadd', 4), T = cayleyTable(S, { empty: true });
    say('（課本）(ℤ₄, +) 的 Cayley 表', '第 a 列第 b 行 = (a + b) mod 4');
    await beat(tok, 2200);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { T.fill(i, j); say(i + ' + ' + j + ' = ' + (i + j) + (i + j >= 4 ? ' → mod 4 = ' + (i + j) % 4 : ''), ''); await beat(tok, 330); }
    await beat(tok, 900);
    T.cells.flat().forEach((m) => glow(m, GREEN));
    say('① 封閉：16 格全是 0～3', ''); await beat(tok, 2200); T.clearGlow();
    T.cells[0].forEach((m) => glow(m, GOLD)); T.cells.forEach((r) => glow(r[0], GOLD));
    say('② 單位元 0：第 0 列、第 0 行和表頭一樣', 'a + 0 = 0 + a = a'); await beat(tok, 2600); T.clearGlow();
    S.els.forEach((a, i) => S.els.forEach((b, j) => { if (S.op(a, b) === '0') glow(T.cells[i][j], GREEN); }));
    say('③ 反元素：每列都有一個 0', '1⁻¹ = 3、2⁻¹ = 2、3⁻¹ = 1'); await beat(tok, 2800); T.clearGlow();
    glow(T.head.row[1], GOLD); glow(T.head.col[2], GOLD); glow(T.cells[1][2], GOLD);
    say('④ 結合：(1 + 2) + 3 = 1 + (2 + 3) = 2', '整數加法本來就結合，mod 不影響'); await beat(tok, 2800); T.clearGlow();
    say('四條都成立 → 群；表對角線對稱 → abelian', '每列每行都是 0,1,2,3 的排列（Latin square）');
    await beat(tok, 3400);
  }
  async function scNotGroup(tok) {
    fresh([0, 9.8, 7.8], [0, 0, 0.3]);
    const S = structure('zmul', 6), T = cayleyTable(S);
    say('（課本）(ℤ₆, ×)：封閉、結合、單位元 1 都有', '');
    await beat(tok, 2600);
    T.cells[0].forEach((m) => glow(m, RED));
    say('0 那一列全是 0：找不到 0 × ? = 1', '0 沒有反元素 → 不是群');
    await beat(tok, 2800); T.clearGlow();
    [2, 3, 4].forEach((i) => T.cells[i].forEach((m) => glow(m, RED)));
    say('2、3、4 的列裡也沒有 1', '只有 1、5 有反元素（和 6 互質）');
    await beat(tok, 2800); T.clearGlow();
    glow(T.cells[2][3], RED); glow(T.cells[3][2], RED);
    say('2 × 3 = 0：zero divisor（零因子）', '拿掉 0 也不行：ℤ₆ − {0} 對 × 不封閉');
    await beat(tok, 3000);
    lab.clear();
    const T2 = cayleyTable({ name: 'ℤ₅ − {0}', els: ['1', '2', '3', '4'], op: (a, b) => String(mod(+a * +b, 5)) });
    say('ℤ₅ − {0} = {1,2,3,4} 對 × 是群', '5 是質數：每列都有 1（2⁻¹ = 3、4⁻¹ = 4）');
    ['1', '2', '3', '4'].forEach((a, i) => ['1', '2', '3', '4'].forEach((b, j) => { if (mod(+a * +b, 5) === 1) glow(T2.cells[i][j], GREEN); }));
    await beat(tok, 3600);
  }
  async function scCyclicRot(tok) {
    fresh([0, 9.4, 7.2], [0, 0, 0.3]);
    const n = 6, plate = polygonPlate(n);
    const tiles = range(n).map((i) => { const [x, z] = ringXZ(n, 3.6, i); return cube('R' + i, COL.idle, [0.75, 0.3, 0.6], x, 0.15, z); });
    say('（課本）正六邊形的旋轉：R₀…R₅', 'Rᵢ = 轉 60°·i');
    await beat(tok, 2600);
    const spin = async (k, seen, color) => {
      let pos = 0; seen.push(0); tiles[0].material.color.set(color);
      for (let t = 0; t < n; t++) {
        const from = plate.rotation.y, to = from + k * Math.PI / 3;
        await anim(tok, 600, (u) => { plate.rotation.y = from + (to - from) * u; });
        pos = mod(pos + k, n);
        tiles[pos].material.color.set(color); glow(tiles[pos], GOLD);
        say('再轉一次 R' + k + '：到 R' + pos, 'R' + k + ' 的 ' + (t + 1) + ' 次方 = R' + pos);
        await beat(tok, 500); glow(tiles[pos], null);
        if (pos === 0) break;
      }
    };
    await spin(1, [], PAL[1]);
    say('R₁ 轉 6 次走遍全部 → R₁ 是生成元', 'C₆ = ⟨R₁⟩：循環群（cyclic group）');
    await beat(tok, 2800);
    tiles.forEach((m) => m.material.color.set(COL.idle));
    await spin(2, [], PAL[2]);
    say('R₂ 只到 R₀、R₂、R₄ → 子群 ⟨R₂⟩，order 3', 'ord(Rₖ) = 6 / gcd(6, k)');
    await beat(tok, 3000);
    say('生成元：gcd(k, 6) = 1 → R₁、R₅', 'Rᵢ∘Rⱼ = R₍ᵢ₊ⱼ₎ mod 6：和 (ℤ₆, +) 同構');
    await beat(tok, 3200);
  }
  async function scLagrange(tok) {
    fresh([0, 10, 8.2], [0, 1, 0.6]);
    const n = 12, H = [0, 4, 8];
    const blocks = range(n).map((x) => { const [px, pz] = ringXZ(n, 3, x); return cube(x, COL.idle, [0.6, 0.5, 0.6], px, 0.25, pz); });
    say('（課本）G = (ℤ₁₂, +)，子群 H = ⟨4⟩ = {0, 4, 8}', '');
    H.forEach((x) => blocks[x].material.color.set(PAL[1]));
    await beat(tok, 2800);
    for (let r = 0; r < 4; r++) {
      const C = H.map((h) => (h + r) % n);
      C.forEach((x, t) => { blocks[x].material.color.set(PAL[r + 1]); move(blocks[x], -3.3 + r * 2.2, 0.25 + t * 0.55, 0); });
      say(r + ' + H = {' + C.join(', ') + '}', '陪集（coset）：H 整塊平移 ' + r);
      await beat(tok, 1700);
    }
    say('4 個陪集，每個 3 個元素，互不重疊', '陪集把 G 分割成同樣大小的塊');
    await beat(tok, 2800);
    say('Lagrange：|G| = |H| · [G:H] → 12 = 3 × 4', '子群大小必整除群的大小');
    await beat(tok, 3000);
    say('推論：元素的 order 整除 |G|；|G| 是質數 ⇒ G 是循環群', '所以 ℤ₁₂ 沒有大小 5 的子群');
    await beat(tok, 3200);
  }
  async function scS3(tok) {
    fresh([0, 8.5, 8], [0, 0.4, 0]);
    const tri = new THREE.Group();
    const R = 2.2, cornersXZ = [0, 1, 2].map((i) => [Math.sin(i * 2 * Math.PI / 3) * R, -Math.cos(i * 2 * Math.PI / 3) * R]);
    const shape = new THREE.Shape(cornersXZ.map(([x, z]) => new THREE.Vector2(x, -z)));
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 0.7, side: THREE.DoubleSide }));
    plate.rotation.x = -Math.PI / 2; tri.add(plate);
    const corners = cornersXZ.map(([x, z], i) => { const m = lab.box(PAL[i + 1], [0.5, 0.5, 0.5]); m.position.set(x * 0.78, 0.5, z * 0.78); m.add(lab.label(String(i + 1), 'val')); tri.add(m); return m; });
    tri.position.set(-2.6, 0.2, 0.3); lab.world.add(tri);
    cornersXZ.forEach(([x, z], i) => tag('位置 ' + (i + 1), 'idx', -2.6 + x * 1.35, 0.1, 0.3 + z * 1.35));
    const out = tag('', 'ptr alt', 3.2, 0.3, -1.6);
    say('（課本）正三角形的 6 個對稱 = S₃', '3 個旋轉 + 3 個翻轉，|S₃| = 3! = 6');
    await beat(tok, 2800);
    // 以世界座標軸轉：先做的操作先乘，後做的 premultiply（避免 Euler 角的順序問題）
    const turn = async (axis, ang, hop) => { const q0 = tri.quaternion.clone(); await anim(tok, 900, (u) => { tri.quaternion.copy(q0).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, ang * u)); if (hop) tri.position.y = 0.2 + Math.sin(u * Math.PI) * 1.2; }); };
    const rot = (deg) => turn(V3(0, 1, 0), deg * Math.PI / 180, false);
    const flip = () => turn(V3(0, 0, 1), Math.PI, true);
    say('r：轉 120°', 'r = (1 2 3)'); await rot(120); txt(out, 'r'); await beat(tok, 1200);
    say('f：沿過頂點 1 的軸翻面', 'f = (2 3)'); await flip(); txt(out, 'f∘r（先 r 再 f）'); await beat(tok, 1600);
    say('先 r 再 f：得到的是一個翻轉', 'f∘r = (1 3)'); await beat(tok, 2200);
    tri.quaternion.identity(); tri.position.y = 0.2; txt(out, ''); await beat(tok, 800);
    say('換順序：先 f 再 r', ''); await flip(); await rot(120); txt(out, 'r∘f（先 f 再 r）');
    say('結果是另一個翻轉', 'r∘f = (1 2) ≠ f∘r'); await beat(tok, 2600);
    say('S₃ 不交換：最小的 non-abelian group', '一般 n ≥ 3 時 Sₙ 都不交換');
    await beat(tok, 3200);
  }
  async function scCycleNotation(tok) {
    fresh([0, 7.5, 9], [0, 0.6, 0]);
    const n = 5, p = [2, 0, 1, 4, 3]; // σ = 3 1 2 5 4（one-line）
    const X = (i) => (i - 2) * 1.8;
    range(n).forEach((i) => { ctx.tile(V3(X(i), 0.04, 0), 1.3, 1.3); tag(String(i + 1), 'idx', X(i), 0.1, 1.1); });
    const bl = range(n).map((i) => cube(i + 1, PAL[i + 1], [0.9, 0.8, 0.9], X(i), 0.45, 0));
    say('（課本）σ = (1 2 3 4 5 / 3 1 2 5 4)', 'σ(1) = 3、σ(2) = 1、σ(3) = 2、σ(4) = 5、σ(5) = 4');
    await beat(tok, 3000);
    const chains = [[0, 2, 1], [3, 4]];
    for (const c of chains) {
      for (let k = 0; k < c.length; k++) { glow(bl[c[k]], GOLD); say('追蹤：' + c.slice(0, k + 1).map((x) => x + 1).join(' → ') + (k === c.length - 1 ? ' → ' + (c[0] + 1) : ''), ''); await beat(tok, 900); }
      say('得到 cycle (' + c.map((x) => x + 1).join(' ') + ')', ''); await beat(tok, 1300);
    }
    for (let t = 1; t <= 6; t++) {
      const old = bl.slice();
      old.forEach((m, i) => { move(m, X(p[i]), 0.45, 0); bl[p[i]] = m; });
      say('做第 ' + t + ' 次 σ', t === 6 ? '6 次後全部回原位' : t === 3 ? '3 次：(1 3 2) 這段回原位，(4 5) 還沒' : t === 2 ? '2 次：(4 5) 回原位' : '');
      await beat(tok, 1100);
    }
    say('σ = (1 3 2)(4 5)，order = lcm(3, 2) = 6', '互斥 cycle 可交換；order 是長度的 lcm');
    await beat(tok, 3400);
  }
  async function scRingField(tok) {
    fresh([0, 10.5, 8.4], [0, 0, 0.3]);
    const A = cayleyTable(structure('zmul', 6), { cx: -3.2, cs: 0.62 });
    const B = cayleyTable(structure('zmul', 5), { cx: 3.4, cs: 0.7 });
    tag('ℤ₆ 的 ×', 'ptr', -3.2, 0.3, 2.2); tag('ℤ₅ 的 ×', 'ptr alt', 3.4, 0.3, 2.2);
    say('（課本）Ring (R, +, ·)：+ 是 abelian group、· 封閉結合、分配律', 'ℤₙ 配上 mod n 的 + 與 × 是 commutative ring');
    await beat(tok, 3200);
    [[2, 3], [3, 2], [3, 4], [4, 3]].forEach(([i, j]) => glow(A.cells[i][j], RED));
    say('ℤ₆：2·3 = 0、3·4 = 0 → 有零因子', '不是 integral domain，更不是 field');
    await beat(tok, 3000);
    range(5).forEach((i) => range(5).forEach((j) => { if (i && j && (i * j) % 5 === 1) glow(B.cells[i][j], GREEN); }));
    say('ℤ₅：每個非零元素的列都有 1', '非零元素都有乘法反元素 → field');
    await beat(tok, 3000);
    say('ℤₙ 是 field ⇔ n 是質數', 'Field：+ 是 abelian group，非零元素對 · 也是 abelian group');
    await beat(tok, 3400);
  }
  async function scBoolCube(tok) {
    fresh([0, 6.4, 11.5], [0, 1.8, 0]);
    const C = boolCube(0, { s: 1.6 });
    say('（課本）3 變數布林函數 = 方塊的 8 個頂點', '頂點 xyz：x 往右、y 往後、z 往上');
    await beat(tok, 3000);
    const f = parseBool('xy + z');
    for (const v of BV) { const i = BV.indexOf(v); if (f(v)) { C.vm[i].material.color.set(COL.on); C.vm[i].scale.set(1.15, 1.15, 1.15); glow(C.vm[i], GOLD); say('xyz = ' + vName(v) + '：xy + z = 1', ''); await beat(tok, 650); glow(C.vm[i], null); } }
    say('f = xy + z：亮 5 個頂點', 'z = 1 是整個上面；xy = 1 是右後那條邊');
    await beat(tok, 3000);
    say('每個 minterm = 一個頂點；f = 亮的 minterm 的和', 'f = Σm(1,3,5,6,7)（m 的編號 = xyz 當二進位）');
    await beat(tok, 3200);
  }
  async function scBoolLaws(tok) {
    fresh([0, 6.4, 11.5], [0, 1.8, 0]);
    const L = boolCube(-3.2), R = boolCube(3.2);
    const lt = tag('', 'ptr', -3.2, 4.4, 0), rt = tag('', 'ptr alt', 3.2, 4.4, 0);
    const show = async (l, r, cap, f2) => { txt(lt, l); txt(rt, r); L.light(parseBool(l)); R.light(parseBool(r), COL.ok); say(cap, f2); await beat(tok, 3200); };
    say('（課本）布林恆等式：兩邊亮的頂點一模一樣', '8 種輸入都相同 ⇔ 等式成立');
    await beat(tok, 2400);
    await show('x + xy', 'x', '吸收律 x + xy = x', 'xy 那條邊本來就在 x = 1 那一面裡');
    await show("(x + y)'", "x'y'", "De Morgan：(x + y)' = x'y'", '補數：+ 和 · 互換');
    await show('x + yz', '(x + y)(x + z)', '分配律：+ 對 · 也能分配', '這條在一般代數不成立');
    await show("xy + x'z + yz", "xy + x'z", 'Consensus：yz 是多餘的', 'yz 的兩個頂點已被 xy、x\'z 蓋住');
    say('Duality：+ ↔ ·、0 ↔ 1 互換，恆等式仍成立', 'x + xy = x 的 dual：x(x + y) = x');
    await beat(tok, 3200);
  }
  async function scBoolSimplify(tok) {
    fresh([0, 6.4, 11.5], [0, 1.8, 0]);
    const C = boolCube(0, { s: 1.6 });
    const f = "xyz + xyz' + x'yz";
    C.light(parseBool(f));
    say("（課本）化簡 f = xyz + xyz' + x'yz", '三個 minterm = 三個亮頂點');
    await beat(tok, 3000);
    const id = (s) => BV.findIndex((v) => vName(v) === s);
    C.edgeHi(id('111'), id('110'), COL.hot);
    say("xyz + xyz' = xy(z + z') = xy", '相鄰（只差 z）的兩頂點 → 合成一條邊');
    await beat(tok, 3000);
    C.edgeHi(id('111'), id('011'), COL.blue);
    say("xyz + x'yz = yz", '111 可以重複使用（x + x = x）');
    await beat(tok, 3000);
    say('f = xy + yz', '一條邊 = 2 個 literal 的乘積；一整面 = 1 個 literal');
    await beat(tok, 3400);
  }

  const scenes = {
    'binop-closure': { title: '（課本）二元運算與封閉性', play: scClosure },
    'group-z4': { title: '（課本）(ℤ₄, +) 的 Cayley 表：四條公理', play: scGroupZ4 },
    'not-group-z6': { title: '（課本）(ℤ₆, ×) 不是群；ℤ₅ − {0} 是', play: scNotGroup },
    'cyclic-rotation': { title: '（課本）循環群：六邊形的旋轉', play: scCyclicRot },
    'lagrange': { title: '（課本）陪集與 Lagrange 定理', play: scLagrange },
    'perm-s3': { title: '（課本）S₃：三角形的對稱、不交換', play: scS3 },
    'cycle-notation': { title: '（課本）cycle notation 與置換的 order', play: scCycleNotation },
    'ring-field': { title: '（課本）Ring 與 field：ℤ₆ vs ℤ₅', play: scRingField },
    'bool-cube': { title: '（課本）布林函數 = 方塊上亮的頂點', play: scBoolCube },
    'bool-laws': { title: '（課本）吸收、De Morgan、分配、consensus', play: scBoolLaws },
    'bool-simplify': { title: '（課本）化簡：相鄰頂點合成邊', play: scBoolSimplify },
  };

  return {
    kicker: '離散數學・第 10 章',
    title: '代數結構：群、環、布林代數',
    color: 'var(--dm)',
    modes: [
      { id: 'cayley', name: 'Cayley 表與群公理', enter: enterCayley },
      { id: 'cyclic', name: '循環群（旋轉）', enter: enterCyclic },
      { id: 'coset', name: '陪集與 Lagrange', enter: enterCoset },
      { id: 'perm', name: '置換群', enter: enterPerm },
      { id: 'bool', name: '布林代數', enter: enterBool },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['binop-closure', 'group-z4', 'not-group-z6', 'cyclic-rotation', 'lagrange', 'perm-s3', 'cycle-notation', 'ring-field', 'bool-cube', 'bool-laws', 'bool-simplify'],
    stop() { stopTimer(); },
  };
}
