// 離散數學 第10章：代數結構 — 二元運算與封閉性、群的四條公理（Cayley 表檢查）、循環群（旋轉）與生成元、
// 子群、陪集與 Lagrange 定理、置換群 S₃／cycle notation、ring 與 field（ℤₙ 的零因子）、Boolean algebra 化簡。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章唯一的影片（Algebraic Structures: Groups, Rings, and Fields）還沒有逐字稿，所有場景依課本
// （Grimaldi 第 16 章 Groups／Rings、第 15 章 Boolean Algebra；Rosen 第 12 章）標準例子製作，標題前註明（課本）。
// 慣例：置換合成 σ∘τ = 先做 τ 再做 σ；Cayley 表第 a 列第 b 行放 a∘b；Boolean：x' 表補數、xy 表 AND、x + y 表 OR。
import kit from './_kit.js';

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
    if (r < 0.49) { const n = pick([12, 15, 18, 20, 24, 30]); const non = range(n).map((x) => x + 1).filter((d) => n % d !== 0 && d < n); const bad = pick(non); const divs = range(n).map((x) => x + 1).filter((d) => n % d === 0 && d > 1 && d < n); const o = [bad, ...divs.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]).slice(0, 3)].map(String); return { q: '|G| = ' + n + '，下列哪個「不可能」是子群的大小？', opts: o, ans: String(bad), why: 'Lagrange：子群大小必整除 |G| = ' + n + '，而 ' + bad + ' ∤ ' + n + '。' }; }
    if (r < 0.6) { const n = pick([7, 9, 10, 11, 12, 13, 14, 15]); const us = range(n).filter((a) => a > 1 && gcd(a, n) === 1); const a = pick(us); const inv = range(n).find((b) => mod(a * b, n) === 1); return { q: '在 (ℤ' + sub(n) + '*, ×) 中，' + a + ' 的反元素是？', opts: [...new Set([inv, n - a, mod(inv + 1, n) || 2, a].map(String))].concat(['1']).slice(0, 4), ans: String(inv), why: a + ' × ' + inv + ' = ' + a * inv + ' ≡ 1 (mod ' + n + ')。' }; }
    if (r < 0.72) {
      const n = 5 + rnd(3); const p = range(n).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
      return { q: 'σ 的 one-line notation 是「' + oneLine(p) + '」（σ(1), σ(2), … 依序列出），寫成 cycle 是？order？', opts: [...new Set([cycStr(p) + '，order ' + ordOf(p), cycStr(p) + '，order ' + cycles(p).reduce((s, c) => s + c.length, 0), cycStr(range(n).map((i) => p.indexOf(i))) + '，order ' + ordOf(p), cycStr(p) + '，order ' + n, cycStr(p) + '，order ' + ordOf(p) * 2, cycStr(range(n).map((i) => p.indexOf(i))) + '，order ' + n])].slice(0, 4), ans: cycStr(p) + '，order ' + ordOf(p), why: '從 1 開始追 1 → σ(1) → …；order = 各 cycle 長度的 lcm（不是和）。' + (cycles(p).length ? '' : '') };
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
    say('r：轉 120°（頂點 1 → 位置 2）', 'r = (1 2 3)'); await rot(-120); txt(out, 'r'); await beat(tok, 1200);
    say('f：沿過頂點 1 的軸翻面', 'f = (2 3)'); await flip(); txt(out, 'f∘r（先 r 再 f）'); await beat(tok, 1600);
    say('先 r 再 f：得到的是一個翻轉', 'f∘r = (1 3)'); await beat(tok, 2200);
    tri.quaternion.identity(); tri.position.y = 0.2; txt(out, ''); await beat(tok, 800);
    say('換順序：先 f 再 r', ''); await flip(); await rot(-120); txt(out, 'r∘f（先 f 再 r）');
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ alg.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 10 章（Algebraic Structures: Groups, Rings, and Fields 英文短片）— cued scenes ───
// 影片只有投影片，畫面上的公式與例子照講者的順序；所有算式（ℚ[√2] 的加法、FOIL、反元素、ℤ₅ 的群檢查、
// ℤ₅／ℤ₆ 的乘法反元素、矩陣不交換）都由程式算出來再顯示 ✓。講者沒有給數字的地方（ℤ_n 用 n = 5、
// 2×2 矩陣、多項式、ℝⁿ 的向量）是自己挑的小例子，畫面標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const ok = (b, t, x, y) => (b ? good(t, x, y) : bad(t.replace(/✓/g, '✘'), x, y));
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (typeof o.all === 'function') return gone(o.all()); if (o.element) remove(o); else kill(o); });
const CAM = [[0, 3.6, 15], [0, 3.3, 0]];
const AC = { node: '#cdbfa6', g: '#4b9ee2', r: '#e55a9b', f: '#2fc092', v: '#9b7ef4', gold: '#c08a1f', hot: '#d64545', yel: '#e9c53a', zero: '#efe5d3' };
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const lines = (arr, x, y, dy = 0.62, cls = '') => arr.map((t, i) => tag(t, cls, x, y - i * dy));
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
// 物件小方塊（代表集合裡的元素）
const blk = (t, c, x, y) => cube(t, c, [0.62, 0.62, 0.3], x, y, 0);
// 「階梯」：group → ring → field（性質由少到多）
function ladder(S, x = 3.6, y = 6.2) {
  S.lad = [['group', AC.g], ['ring', AC.r], ['field', AC.f], ['vector space', AC.v]].map(([n, c], i) => { const m = cube(n, c, [1.9, 0.5, 0.3], x + i * 0.0, y - i * 0.75, 0); m.material.color.set('#efe5d3'); return m; });
  S.ladOn = (i, c) => S.lad[i].material.color.set(c);
}

// ── 數學小工具 ──
const md = (a, n) => ((a % n) + n) % n;
function zGroup(n) { // (ℤ_n, +)：封閉、結合、單位元、反元素，全部窮舉檢查
  const E = [...Array(n).keys()], op = (a, b) => md(a + b, n);
  const clo = E.every((a) => E.every((b) => E.includes(op(a, b))));
  const asc = E.every((a) => E.every((b) => E.every((c) => op(op(a, b), c) === op(a, op(b, c)))));
  const id = E.find((e) => E.every((a) => op(e, a) === a && op(a, e) === a));
  const inv = id !== undefined && E.every((a) => E.some((b) => op(a, b) === id));
  const com = E.every((a) => E.every((b) => op(a, b) === op(b, a)));
  return { clo, asc, id, inv, com, ok: clo && asc && id !== undefined && inv };
}
const mInv = (a, n) => { for (let b = 1; b < n; b++) if (md(a * b, n) === 1) return b; return null; };
const mm = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
const mEq = (A, B) => A[0][0] === B[0][0] && A[0][1] === B[0][1] && A[1][0] === B[1][0] && A[1][1] === B[1][1];
const mS = (A) => '[' + A[0].join(' ') + ' ; ' + A[1].join(' ') + ']';
const det = (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0];
// ℚ[√2]：[a, b] 代表 a√2 + b
const qAdd = (u, v) => [u[0] + v[0], u[1] + v[1]];
const qMul = (u, v) => [u[0] * v[1] + u[1] * v[0], 2 * u[0] * v[0] + u[1] * v[1]];
const fr = (x) => (Number.isInteger(x) ? String(x) : x === 1.5 ? '3/2' : x === -1.5 ? '−3/2' : String(x));
const qS = (u) => { const a = u[0], b = u[1]; const s = (a === 1 ? '' : a === -1 ? '−' : fr(a).replace('-', '−')) + '√2'; return b === 0 ? s : s + (b < 0 ? ' − ' + fr(-b) : ' + ' + fr(b)); };

// ════════ vfyUU_prh9s（Algebraic Structures: Groups, Rings, and Fields） ════════
scene('ab-what', '什麼是 algebraic structure（代數結構）', [
  async (tok, S) => { S.t = hd('Algebraic structures：groups、rings、fields', 0, 7.0); ladder(S, 0, 5.6); cap('簡介：群、環、體', ''); },
  async (tok, S) => { gone(S.lad); S.big = cube('', '#efe5d3', [5.6, 2.6, 0.1], -2.2, 4.4, -0.3); S.d = pl('一堆物件（objects）組成的集合', -2.2, 6.1); cap('代數結構：一堆物件', ''); },
  async (tok, S) => { S.o = [['3', AC.g], ['f(x)', AC.r], ['[1 2;3 4]', AC.f], ['−1/2', AC.g], ['x²+1', AC.r]].map(([t, c], i) => blk(t, c, -4.2 + i * 1.0, 4.4)); S.n = sm('可以是數字、函數、矩陣…什麼都可以', -2.2, 2.7); cap('物件可以是數字，也可以不是', ''); },
  async (tok, S) => { S.op = hot('再加上一個或多個運算：⊕、★…', 3.4, 4.6); S.op2 = sm('（加起來、乘起來、或別的）', 3.4, 3.9); cap('再加上一個或多個運算', ''); },
  async (tok, S) => { S.c = note('依「運算有幾個、有哪些性質」來分類', 3.4, 2.9); cap('依運算的個數與性質分類', ''); },
]);
scene('ab-why', '為什麼要分類代數結構', [
  async (tok, S) => { S.t = hd('為什麼要分類？', 0, 7.0); cap('為什麼要這樣分類？', ''); },
  async (tok, S) => { S.a = pl('① 在不同的數系之間找共通點（數字、矩陣、函數…）', 0, 5.9); cap('找出看似不同系統的關聯', ''); },
  async (tok, S) => { S.b = pl('② 發現性質相似的新系統', 0, 5.1); cap('發現性質相似的新系統', ''); },
  async (tok, S) => { S.c = hot('③ 一次證明：對所有「性質相同」的系統都成立', 0, 4.3); cap('最重要：證一次，全部適用', ''); },
  async (tok, S) => { S.d = good('證明一個「所有 group」的定理 ⇒ 過去、未來、還沒發現的 group 都成立', 0, 3.4); cap('對所有 group 證明的定理，每個 group 都適用', ''); },
]);
scene('ab-group', 'Group（群）的定義：結合律、單位元、反元素', [
  async (tok, S) => { S.t = hd('第一種：group（群）', 0, 7.0); cap('第一種代數結構：group', ''); },
  async (tok, S) => { ladder(S, 4.6, 6.2); S.ladOn(0, AC.g); S.n = sm('依性質由少到多排列', 4.6, 3.2); cap('順序：性質最少的到最多的', ''); },
  async (tok, S) => { S.G = cube('', '#efe5d3', [4.4, 2.2, 0.1], -3.0, 4.3, -0.3); S.gl = pl('G：物件的集合', -3.0, 5.7); S.e = ['a', 'b', 'c', 'g'].map((t, i) => blk(t, AC.g, -4.5 + i * 1.0, 4.3)); cap('G 是物件的集合', ''); },
  async (tok, S) => { S.op = hot('運算 ⊕（可以是 +、×、或別的）', -3.0, 2.6); S.cl = sm('（課本把「a ⊕ b 仍在 G 裡」= closure 封閉性列為第一條）', -1.0, 1.9); cap('運算故意用陌生的符號 ⊕', ''); },
  async (tok, S) => { S.p = lines(['① associativity', '② identity', '③ inverse'], 3.2, 5.8, 0.7); cap('三個性質', ''); },
  async (tok, S) => { setCls(S.p[0], 'ptr alt'); S.f1 = pl('(a ⊕ b) ⊕ c = a ⊕ (b ⊕ c)', 0, 0.9); cap('結合律：怎麼分組都一樣', ''); },
  async (tok, S) => {
    S.br = sm('先算 b ⊕ c，再接 a　＝　先算 a ⊕ b，再接 c', 0, 0.2);
    await P.anim(tok, 900, (u) => { S.e[1].position.y = 4.3 + 0.35 * Math.sin(Math.PI * u); S.e[2].position.y = 4.3 + 0.35 * Math.sin(Math.PI * u); });
    cap('三個物件，怎麼括都一樣', '');
  },
  async (tok, S) => { setCls(S.p[0], ''); setCls(S.p[1], 'ptr alt'); gone(S.f1, S.br); S.f1 = pl('有一個特別的元素 e（實際上可能叫 0 或 1）', 0, 0.9); S.e[3].material.color.set(AC.yel); relabel(S.e[3], 'e'); cap('單位元：一個特別的元素 e', ''); },
  async (tok, S) => { S.br = pl('e ⊕ g = g ⊕ e = g（什麼都沒發生）', 0, 0.2); cap('和 e 運算，什麼都沒變', ''); },
  async (tok, S) => { setCls(S.p[1], ''); setCls(S.p[2], 'ptr alt'); gone(S.f1, S.br); S.f1 = pl('每個 g 都有反元素 g⁻¹', 0, 0.9); cap('反元素：每個元素都有', ''); },
  async (tok, S) => { S.br = pl('g ⊕ g⁻¹ = g⁻¹ ⊕ g = e（哪個順序都回到 e）', 0, 0.2); cap('和反元素運算，回到單位元', ''); },
]);
scene('ab-zgroup', '例：(ℤ, +) 是 group', [
  async (tok, S) => { S.t = hd('例子：(ℤ, +)', 0, 7.0); cap('來看例子', ''); },
  async (tok, S) => { S.z = [-3, -2, -1, 0, 1, 2, 3].map((n, i) => blk(String(n).replace('-', '−'), n === 0 ? AC.yel : AC.g, -4.5 + i * 1.0, 5.4)); S.d = pl('ℤ = {…, −2, −1, 0, 1, 2, …}：正、負整數和 0', -1.5, 4.4); cap('ℤ：所有整數', ''); },
  async (tok, S) => { S.op = hot('運算：一般的加法 +', 3.6, 6.2); cap('運算就是加法', ''); },
  async (tok, S) => { S.ck = pl('要檢查三件事', 3.6, 5.4); cap('要檢查三件事', ''); },
  async (tok, S) => {
    const a = 2, b = 3, c = 4; S.l1 = ok((a + b) + c === a + (b + c), '① 結合：(a + b) + c = a + (b + c)；示意 (2+3)+4 = 2+(3+4) = 9 ✓', -0.4, 3.4); cap('加法有結合律', '');
  },
  async (tok, S) => { S.l2 = ok([-3, 0, 5].every((a) => a + 0 === a && 0 + a === a), '② 單位元是 0：a + 0 = 0 + a = a ✓', -0.4, 2.6); cap('單位元就是 0', ''); },
  async (tok, S) => { S.l3 = ok([-3, 2, 7].every((a) => a + -a === 0), '③ a 的反元素是 −a：a + (−a) = 0，例 3 + (−3) = 0 ✓', -0.4, 1.8); cap('a 的反元素是 −a', ''); },
  async (tok, S) => { S.done = good('三條都成立 ⇒ (ℤ, +) 是 group', -0.4, 0.9); cap('所以 (ℤ, +) 是 group', ''); },
]);
const MA = [[1, 1], [0, 1]], MB = [[1, 0], [1, 1]], MC = [[2, 0], [0, 1]];   // 示意矩陣（行列式都不是 0）
scene('ab-more', '更多 group：ℤ_n、ℚ、ℝ*、可逆函數、可逆矩陣；abelian group', [
  async (tok, S) => {
    const Z5 = zGroup(5); S.t = hd('更多 group 的例子', 0, 7.0);
    S.tb = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) S.tb.push(cube(String(md(i + j, 5)), md(i + j, 5) === 0 ? AC.yel : '#efe5d3', [0.5, 0.5, 0.1], -5.6 + j * 0.55, 5.6 - i * 0.55, 0));
    S.tl = [0, 1, 2, 3, 4].flatMap((k) => [sm(String(k), -6.15, 5.6 - k * 0.55), sm(String(k), -5.6 + k * 0.55, 6.15)]);
    S.a = ok(Z5.ok, '(ℤ_n, + mod n)：示意 n = 5，加法表窮舉檢查 ✓', 1.6, 6.1); cap('整數 mod n 加法：group', '');
  },
  async (tok, S) => { S.b = pl('(ℚ, +)：分數相加', 1.6, 5.3); cap('有理數加法：group', ''); },
  async (tok, S) => { S.c = pl('(ℝ*, ×)：非零實數相乘，單位元是 1', 1.6, 4.6); cap('非零實數乘法，單位元是 1', ''); },
  async (tok, S) => { S.d = sm('還有 (ℚ*, ×)、(ℝ, +)…列不完', 1.6, 3.9); cap('這不是全部，還有很多', ''); },
  async (tok, S) => { gone(S.tb, S.tl); S.e = pl('可逆函數，運算是合成 ∘', -3.6, 6.1); cap('另一種：可逆函數與合成', ''); },
  async (tok, S) => { S.e2 = sm('f ∘ (g ∘ h) = (f ∘ g) ∘ h：結合', -3.6, 5.4); cap('函數合成有結合律', ''); },
  async (tok, S) => { S.e3 = sm('可逆 ⇒ 有反函數；單位元 I(x) = x', -3.6, 4.8); cap('單位元是 I(x) = x', ''); },
  async (tok, S) => { gone(S.a, S.b, S.c, S.d); S.m = pl('2 × 2 可逆矩陣，運算是矩陣乘法', 2.4, 6.1); S.m0 = sm('示意：A = ' + mS(MA) + '，B = ' + mS(MB) + '（det = ' + det(MA) + '、' + det(MB) + '）', 2.4, 5.4); cap('2×2 可逆矩陣與乘法', ''); },
  async (tok, S) => { S.m1 = sm('單位元：I = [1 0 ; 0 1]', 2.4, 4.8); cap('單位元是單位矩陣', ''); },
  async (tok, S) => { const AB = mm(MA, MB), BA = mm(MB, MA); S.m2 = ok(!mEq(AB, BA), 'AB = ' + mS(AB) + ' ≠ BA = ' + mS(BA) + ' ✓', 1.2, 3.9); cap('AB 不一定等於 BA', ''); },
  async (tok, S) => { S.m3 = ok(mEq(mm(mm(MA, MB), MC), mm(MA, mm(MB, MC))), '但 (AB)C = A(BC) = ' + mS(mm(MA, mm(MB, MC))) + ' ✓（結合）', 1.2, 3.1); cap('但矩陣乘法有結合律', ''); },
  async (tok, S) => { S.ab = hot('若一定有 a ⊕ b = b ⊕ a：commutative / abelian group', 0, 2.0); S.ab2 = sm('group 本身不要求交換律', 0, 1.35); cap('會交換的叫 abelian group', ''); },
  async (tok, S) => {
    const Z5 = zGroup(5); S.y = good('abelian：ℤ、ℤ_n' + (Z5.com ? '' : '?') + '、ℚ、ℝ*', -2.6, 0.5); S.nn = bad('不是 abelian：可逆函數、2×2 可逆矩陣', 2.8, 0.5); cap('有些例子會交換，有些不會', '');
  },
]);
scene('ab-ring', 'Ring（環）：兩個運算的公理', [
  async (tok, S) => { S.t = hd('下一種：ring（環）', 0, 7.0); ladder(S, 4.6, 6.2); S.ladOn(0, AC.g); S.ladOn(1, AC.r); cap('比 group 複雜一點：ring', ''); },
  async (tok, S) => { S.o = hot('兩個運算：⊕（加法）、★（乘法）', -2.4, 6.1); cap('兩個運算：加法、乘法', ''); },
  async (tok, S) => { S.q = pl('要成為 ring 需要：', -2.4, 5.3); cap('ring 需要什麼？', ''); },
  async (tok, S) => { S.l1 = pl('① (R, ⊕) 是 abelian group：0、加法反元素、結合、交換', -1.2, 4.6); S.l1n = sm('（講者口誤說 commutative ring，意思是加法交換群）', -1.2, 4.05); cap('對加法是交換群', ''); },
  async (tok, S) => { S.l2 = pl('② ★ 結合：(a ★ b) ★ c = a ★ (b ★ c)', -1.2, 3.4); cap('乘法要結合', ''); },
  async (tok, S) => { S.l3 = pl('③ 乘法單位元，通常叫 1', -1.2, 2.75); cap('要有乘法單位元 1', ''); },
  async (tok, S) => { S.l4 = pl('④ 分配律：a★(b⊕c) = a★b ⊕ a★c、(b⊕c)★a = b★a ⊕ c★a', -1.2, 2.1); cap('分配律：左分配、右分配', ''); },
  async (tok, S) => { S.l5 = note('★ 不必交換：a ★ b 不一定等於 b ★ a（所以左右分配律都要寫）', -1.2, 1.35); cap('乘法不一定交換', ''); },
  async (tok, S) => { setCls(S.l3, 'ptr alt'); cap('注意這一條：乘法單位元', ''); },
  async (tok, S) => { S.r1 = sm('有些人研究「其他都有、就是沒有 1」的結構：rng（ring 去掉 i）', 2.6, 0.6); cap('沒有 1 的叫 rng', ''); },
  async (tok, S) => { S.r2 = sm('也有人叫它 rong（"wrong"）：沒有 1 不太對', 2.6, 0.0); cap('也有人叫 rong', ''); },
  async (tok, S) => { setCls(S.l3, 'good'); S.r3 = good('本片的標準定義：ring 要有乘法單位元 1', -3.8, 0.6); S.r4 = sm('（Grimaldi 的 ring 不要求 1；有 1 的叫 ring with unity）', -3.8, 0.0); cap('標準的 ring 要有 1', ''); },
]);
scene('ab-ringex', 'Ring 的例子：ℤ、ℤ_n、2×2 矩陣、多項式', [
  async (tok, S) => { S.t = hd('Ring 的例子', 0, 7.0); S.a = pl('要有加法和乘法，而且要滿足很多性質', 0, 6.1); cap('ring 要有加法和乘法', ''); },
  async (tok, S) => { S.b = sm('真的要驗證是 ring 要證很多條，這裡不逐一證明', 0, 5.5); cap('要驗證是很多工作', ''); },
  async (tok, S) => { S.c = pl('(ℤ, +, ×)', -3.6, 4.6); cap('整數的加法和乘法', ''); },
  async (tok, S) => { S.d = pl('(ℤ_n, + mod n, × mod n)', -3.6, 3.9); cap('整數 mod n', ''); },
  async (tok, S) => { S.e = pl('所有 2 × 2 矩陣（不必可逆）', 2.6, 4.6); S.e2 = sm('ring 不要求乘法反元素', 2.6, 4.0); cap('2×2 矩陣：不必可逆', ''); },
  async (tok, S) => {
    const M = [[1, 2], [3, 4]], N = M.map((r) => r.map((x) => -x)), Z = [[M[0][0] + N[0][0], M[0][1] + N[0][1]], [M[1][0] + N[1][0], M[1][1] + N[1][1]]];
    S.e3 = ok(Z.flat().every((x) => x === 0), '加法反元素：每格加負號，示意 [1 2;3 4] + [−1 −2;−3 −4] = 0 ✓', 0.8, 3.2); cap('加法反元素：每一格加負號', '');
  },
  async (tok, S) => {
    const p = [1, 1], q = [-1, 1], pr = [0, 0, 0]; p.forEach((a, i) => q.forEach((b, j) => { pr[i + j] += a * b; }));   // 係數由低到高：(1 + x)(−1 + x)
    S.f = ok(pr[0] === -1 && pr[1] === 0 && pr[2] === 1, 'ℝ[x]：實係數多項式；示意 (x + 1)(x − 1) = x² − 1 ✓', 0, 2.1); cap('實係數多項式也是 ring', '');
  },
]);
scene('ab-field', 'Field（體）：可交換、非零都有乘法反元素', [
  async (tok, S) => { S.t = hd('再複雜一點：field（體）', 0, 7.0); ladder(S, 4.6, 6.2); S.ladOn(0, AC.g); S.ladOn(1, AC.r); S.ladOn(2, AC.f); cap('field 和 ring 很像', ''); },
  async (tok, S) => { S.a = pl('兩個運算：加法、乘法；F 是 commutative ring', -2.0, 6.1); cap('field 是交換環', ''); },
  async (tok, S) => { S.b = pl('commutative 指乘法可交換：a × b = b × a', -2.0, 5.4); cap('乘法一定要能交換', ''); },
  async (tok, S) => { S.c = hot('每個 f ≠ 0 都有乘法反元素', -2.0, 4.6); cap('0 以外每個都有乘法反元素', ''); },
  async (tok, S) => { S.d = pl('f × g = g × f = 1', -2.0, 3.9); cap('f 乘 g 等於 1', ''); },
  async (tok, S) => { S.e = note('field = 乘法可交換、非零元素都有乘法反元素的 ring', -2.0, 3.1); cap('一句話：交換環 + 非零可逆', ''); },
  async (tok, S) => { gone(S.lad, S.a, S.b, S.c, S.d, S.e); S.x = pl('例子', -4.8, 6.1); cap('很多熟悉的例子', ''); },
  async (tok, S) => {
    const p = 5, inv = [1, 2, 3, 4].map((a) => [a, mInv(a, p)]);
    S.z5 = inv.map(([a, b], i) => sm(a + ' × ' + b + ' ≡ ' + md(a * b, p) + ' (mod 5)', -3.6, 5.3 - i * 0.55));
    S.z5c = ok(inv.every(([a, b]) => b !== null && md(a * b, p) === 1), 'ℤ_p（p 質數）是 field：示意 ℤ₅，1–4 都有反元素 ✓', -2.0, 2.9); cap('p 是質數時，ℤ_p 是 field', '');
  },
  async (tok, S) => {
    const no = [1, 2, 3, 4, 5].filter((a) => mInv(a, 6) === null);
    S.z6 = ok(no.join() === '2,3,4', 'n 不是質數就不行：ℤ₆ 裡 ' + no.join('、') + ' 沒有乘法反元素 ✓（例 2 × k mod 6 只有 0、2、4）', 1.0, 2.1); cap('n 不是質數：有元素沒有反元素', '');
  },
  async (tok, S) => { S.q = pl('ℚ（分數）、ℝ（實數）、ℂ（複數 a + bi，i = √−1）', 1.0, 1.2); cap('還有 ℚ、ℝ、ℂ', ''); },
]);
const Q1 = [3, 4], Q2 = [4, 6], Q3 = [2, -4], Q4 = [-5, 3], QX = [3, 4];
scene('ab-q2', 'ℚ[√2]：加法、FOIL 乘法、用有理化找乘法反元素', [
  async (tok, S) => { S.t = hd('ℚ[√2] = {a√2 + b | a, b ∈ ℚ}', 0, 7.0); cap('最後一個例子：ℚ[√2]', ''); },
  async (tok, S) => { S.a = sm('運算就是一般數字的加法、乘法', 0, 6.4); cap('示範運算怎麼做', ''); },
  async (tok, S) => { S.l = [pl('(' + qS(Q1) + ') + (' + qS(Q2) + ')', -3.0, 5.6)]; cap('加法：3√2 + 4 加上 4√2 + 6', ''); },
  async (tok, S) => { const s = qAdd(Q1, Q2); S.l.push(ok(s[0] === 7 && s[1] === 10, '= (3 + 4)√2 + (4 + 6) = ' + qS(s) + ' ✓（同類項合併）', -3.0, 5.0)); cap('同類項合併：7√2 + 10', ''); },
  async (tok, S) => { S.m = [pl('(' + qS(Q3) + ')(' + qS(Q4) + ')', 2.6, 4.1)]; cap('乘法：用 FOIL 展開', ''); },
  async (tok, S) => { S.m.push(sm('First：2√2 × (−5√2) = ' + (2 * -5 * 2), 2.6, 3.5)); cap('First：前 × 前', ''); },
  async (tok, S) => { S.m.push(sm('Outer：2√2 × 3 = ' + (2 * 3) + '√2', 2.6, 3.0)); cap('Outer：外 × 外', ''); },
  async (tok, S) => { S.m.push(sm('Inner：(−4) × (−5√2) = ' + (-4 * -5) + '√2', 2.6, 2.5)); cap('Inner：內 × 內', ''); },
  async (tok, S) => { S.m.push(sm('Last：(−4) × 3 = ' + (-4 * 3), 2.6, 2.0)); cap('Last：後 × 後', ''); },
  async (tok, S) => { S.m.push(pl('= −20 + 6√2 + 20√2 − 12', 2.6, 1.4)); cap('化簡四項', ''); },
  async (tok, S) => { const p = qMul(Q3, Q4); S.m.push(ok(p[0] === 26 && p[1] === -32 && Math.abs((2 * Math.SQRT2 - 4) * (-5 * Math.SQRT2 + 3) - (26 * Math.SQRT2 - 32)) < 1e-9, '= ' + qS(p) + ' ✓', 2.6, 0.75)); cap('合併：26√2 − 32', ''); },
  async (tok, S) => { gone(S.l, S.m); S.w = hot('為什麼是 field？難的是：乘法反元素', 0, 6.0); cap('為什麼有乘法反元素？', ''); },
  async (tok, S) => { S.k = [pl('想找 a√2 + b，使 (3√2 + 4)(a√2 + b) = 1', 0, 5.2)]; cap('找一個數，乘起來等於 1', ''); },
  async (tok, S) => { S.k.push(pl('想要 1 / (3√2 + 4)，但它不是 a√2 + b 的樣子', 0, 4.5)); cap('1/(3√2+4) 形式不對', ''); },
  async (tok, S) => { S.k.push(pl('上下同乘 3√2 − 4（分母有理化）', 0, 3.8)); cap('上下同乘 3√2 − 4', ''); },
  async (tok, S) => { S.k.push(ok((3 * 3 * 2) - 4 * 4 === 2, '分母：(3√2)² − 4² = 18 − 16 = 2 ✓（平方差）', 0, 3.1)); cap('分母變成整數 2', ''); },
  async (tok, S) => {
    const inv = [1.5, -2], pr = qMul(QX, inv); S.k.push(ok(pr[0] === 0 && pr[1] === 1, '= (3√2 − 4)/2 = ' + qS(inv) + '；驗算 (3√2 + 4)(' + qS(inv) + ') = 1 ✓', 0, 2.4));
    cap('反元素：3/2 √2 − 2', '');
  },
  async (tok, S) => { S.k.push(sm('3/2 可以，因為係數在 ℚ 裡；3 和 4 沒什麼特別，任何非零元素都能這樣做', 0, 1.7)); cap('換成別的數也一樣做得到', ''); },
  async (tok, S) => { S.k.push(note('這不是完整證明，但說明了為什麼每個非零元素都有反元素', 0, 1.0)); cap('這是證明的想法', ''); },
]);
scene('ab-vspace', 'Vector space（向量空間）：兩個集合、純量乘法', [
  async (tok, S) => { S.t = hd('再一種：vector space（向量空間）', 0, 7.0); cap('最複雜的：向量空間', ''); },
  async (tok, S) => { S.V = cube('V（向量）', AC.v, [2.4, 1.0, 0.2], -3.6, 5.6, 0); S.F = cube('F（純量）', AC.f, [2.4, 1.0, 0.2], -0.6, 5.6, 0); cap('兩個集合：向量 V、純量 F', ''); },
  async (tok, S) => { S.a = pl('(V, +) 是 commutative group：零向量、反向量、結合、交換', 1.0, 4.4); cap('V 對向量加法是交換群', ''); },
  async (tok, S) => { S.b = pl('F 是 field（純量可以相乘，單位是 1）', 1.0, 3.8); cap('F 是一個 field', ''); },
  async (tok, S) => { S.c = hot('純量乘法：s ∈ F、v ∈ V ⇒ s·v ∈ V', 1.0, 3.1); cap('純量乘以向量', ''); },
  async (tok, S) => { S.d = sm('還有幾條說明它們怎麼互動：', 1.0, 2.5); cap('還有一些互動的規則', ''); },
  async (tok, S) => { S.d1 = pl('1·v = v', -4.0, 1.8); cap('1 乘 v 還是 v', ''); },
  async (tok, S) => { S.d2 = pl('(ab)·v = a·(b·v)', -1.2, 1.8); cap('兩個純量：先乘再乘一樣', ''); },
  async (tok, S) => { S.d3 = pl('a(u + v) = au + av、(a + b)v = av + bv', 3.2, 1.8); cap('分配律兩條', ''); },
  async (tok, S) => {
    const v = [1, 2, 3], s = 2, w = [4, -1, 0], sv = v.map((x) => s * x), vw = v.map((x, i) => x + w[i]);
    S.e = ok(sv.join() === '2,4,6' && vw.join() === '5,1,3', 'ℝⁿ（n 元組）：示意 (1,2,3) + (4,−1,0) = (' + vw.join(',') + ')，2·(1,2,3) = (' + sv.join(',') + ') ✓', 0, 0.9); cap('最常見：ℝⁿ', '');
  },
  async (tok, S) => { S.f = sm('ℝ → ℝ 的函數：兩個函數可以相加，也可以乘上純量', 0, 0.3); cap('函數也可以是向量', ''); },
  async (tok, S) => { S.g = sm('ℂ 可以看成 ℝ 上的向量空間（忽略兩個複數相乘）', 0, -0.25); cap('ℂ 當向量空間：忽略乘法', ''); },
  async (tok, S) => { S.h = sm('ℚ[√2] 也一樣：當向量空間時不看向量之間的乘法', 0, -0.8); cap('ℚ[√2] 也可以', ''); },
  async (tok, S) => { S.i = note('接下去是 basis、dimension：線性代數的內容', 3.6, 6.2); cap('接著是基底與維度：線代', ''); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['binop-closure', 'group-z4', 'not-group-z6', 'cyclic-rotation', 'lagrange', 'perm-s3', 'cycle-notation', 'ring-field', 'bool-cube', 'bool-laws', 'bool-simplify'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
