// 線性代數 第4章：向量空間（Subspace、Span、Basis、Dimension、四個基本子空間、Rank-Nullity）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 座標慣例：數學的 (x, y, z) 畫成 world (x, z, −y)：z 朝上、y 往畫面裡面。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, setState, controls, on, say, beat } = ctx;

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const COL = { a: '#4b9ee2', b: '#dd8238', c: '#9b7ef4', d: '#2fc092', r: '#d64545', g: '#c08a1f', k: '#6e5f49', gray: '#b9ad99' };
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '12px', fontWeight: '600' };
  let gen = 0;
  function fresh(pos, look) { gen++; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  const mono = (l) => { Object.assign(l.element.style, MONO); return l; };
  const txt = (l, t) => { l.element.textContent = t; };
  const showL = (l, v) => { l.element.style.visibility = v ? '' : 'hidden'; };
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
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); else { m.userData.lbl = lab.label(String(t), 'val'); m.add(m.userData.lbl); } };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  async function wait(tok, ms) { if (tok != null) await beat(tok, ms); else { const g = gen; await sleep(ms); if (g !== gen) throw new Error('cancel'); } }
  async function tw(tok, ms, fn) { const steps = Math.max(2, Math.round(ms / 33)); for (let k = 1; k <= steps; k++) { fn(ease(k / steps)); await wait(tok, ms / steps); } }
  const safe = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'cancel') throw e; } };
  function fmt(x) {
    if (typeof x === 'string') return x;
    if (!isFinite(x)) return '∞';
    if (Math.abs(x) < 1e-9) return '0';
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    for (const d of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) { const n = x * d; if (Math.abs(n - Math.round(n)) < 1e-7) return Math.round(n) + '/' + d; }
    return String(Math.round(x * 100) / 100);
  }
  const vstr = (v) => '(' + v.map(fmt).join(', ') + ')';
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const addv = (a, b) => a.map((x, i) => x + b[i]);
  const scl = (a, k) => a.map((x) => x * k);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const T = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const mulMV = (M, x) => M.map((r) => dot(r, x));
  function orthoBasis(u, v) {
    const e1 = scl(u, 1 / norm(u));
    let w = addv(v, scl(e1, -dot(v, e1)));
    if (norm(w) < 1e-9) w = Math.abs(e1[0]) < 0.9 ? cross(e1, [1, 0, 0]) : cross(e1, [0, 1, 0]);
    return [e1, scl(w, 1 / norm(w))];
  }
  // ── 3D 箭頭、桿子、平面 ──
  const UP = V3(0, 1, 0);
  function rod(color, r = 0.03, opacity = 1) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6, transparent: opacity < 1, opacity }));
    lab.world.add(m);
    m.setW = (a, b) => { const d = b.clone().sub(a), L = d.length(); m.visible = L > 1e-5; if (!m.visible) return m; m.quaternion.setFromUnitVectors(UP, d.clone().divideScalar(L)); m.scale.set(1, L, 1); m.position.copy(a).addScaledVector(d, 0.5); return m; };
    return m;
  }
  function arrow(color, r = 0.055) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
    shaft.castShadow = head.castShadow = true;
    const g = new THREE.Group(); g.add(shaft, head); g.visible = false; lab.world.add(g);
    g.setW = (a, b) => {
      const d = b.clone().sub(a), L = d.length();
      g.visible = L > 1e-4;
      if (g.lbl) showL(g.lbl, g.visible);
      if (!g.visible) return g;
      const u = d.clone().divideScalar(L), hl = Math.min(0.3, L * 0.45), sl = L - hl;
      shaft.quaternion.setFromUnitVectors(UP, u); head.quaternion.copy(shaft.quaternion);
      shaft.scale.set(1, Math.max(sl, 1e-3), 1); shaft.position.copy(a).addScaledVector(u, sl / 2);
      head.scale.set(1, hl, 1); head.position.copy(a).addScaledVector(u, sl + hl / 2);
      if (g.lbl) g.lbl.position.copy(b).addScaledVector(u, 0.32).add(V3(0, 0.14, 0));
      return g;
    };
    g.tag = (t, cls) => { if (!g.lbl) { g.lbl = lab.label('', cls || 'ptr'); lab.world.add(g.lbl); } txt(g.lbl, t); return g; };
    g.glow = (c) => { mat.emissive = new THREE.Color(c || '#000000'); };
    g.color = (c) => mat.color.set(c);
    return g;
  }
  function dotBall(color, r = 0.12) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })); m.castShadow = true; lab.world.add(m); return m; }
  function planeMesh(S, u, v, color, ext, opacity = 0.2, center = [0, 0, 0]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color }));
    lab.world.add(m); lab.world.add(edge);
    m.edge = edge;
    m.setSpan = (u2, v2, c = center) => {
      const [e1, e2] = orthoBasis(u2, v2);
      const P = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => S.w([0, 1, 2].map((k) => c[k] + (a * e1[k] + b * e2[k]) * ext)));
      const arr = geo.attributes.position.array;
      P.forEach((p, i) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; });
      geo.attributes.position.needsUpdate = true; geo.computeBoundingSphere();
      edge.geometry.setFromPoints(P);
    };
    m.fade = (o) => { m.material.opacity = o; m.visible = o > 0.004; edge.visible = o > 0.03; };
    m.setSpan(u, v);
    return m;
  }
  // 一個 R³：math (x,y,z) → world (ox + x·s, oy + z·s, oz − y·s)
  function space3(ox = 0, oy = 2.7, oz = 0, s = 1, ext = 2.5, names = ['x', 'y', 'z'], title) {
    const S = { s, ext };
    S.w = (p) => V3(ox + p[0] * s, oy + (p[2] || 0) * s, oz - (p[1] || 0) * s);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((e, i) => {
      rod('#a8987f', 0.016).setW(S.w(scl(e, -ext / s)), S.w(scl(e, ext / s)));
      const p = S.w(scl(e, ext / s + 0.25 / s)); tag(names[i], 'idx', p.x, p.y, p.z);
    });
    if (title) { const p = S.w([0, 0, ext / s + 0.75 / s]); tag(title, 'ptr', p.x, p.y, p.z); }
    S.arrow = (v, color, t, cls) => { const a = arrow(color); a.v = v.slice(); if (t) a.tag(t, cls); a.setW(S.w([0, 0, 0]), S.w(v)); return a; };
    S.set = (a, v, from) => { a.v = v.slice(); a.setW(S.w(from || [0, 0, 0]), S.w(addv(from || [0, 0, 0], v))); };
    S.line = (u, color, len = ext / s, center = [0, 0, 0], r = 0.028) => { const m = rod(color, r); S.setLine(m, u, len, center); return m; };
    S.setLine = (m, u, len = ext / s, center = [0, 0, 0]) => { const e = scl(u, len / norm(u)); m.setW(S.w(addv(center, scl(e, -1))), S.w(addv(center, e))); };
    S.plane = (u, v, color, opacity = 0.2, center) => planeMesh(S, u, v, color, ext / s * 0.95, opacity, center);
    S.ball = (p, color, r) => { const b = dotBall(color, r); b.position.copy(S.w(p)); return b; };
    return S;
  }
  // 方塊矩陣：M 可含字串（例如 'b2−2b1'）；widths 可指定每欄寬度
  function mgrid(M, x0, y0, z = 0, o = {}) {
    const gap = o.gap || 0.78, sz = o.size || 0.62, widths = o.widths || [];
    const xs = []; let x = x0;
    for (let j = 0; j < M[0].length; j++) { const w = widths[j] || sz; xs.push(x + w / 2 - sz / 2); x += w + (gap - sz); }
    const c = M.map((row, i) => row.map((v, j) => cube(fmt(v), o.color ? o.color(i, j) : '#d9cbb2', [widths[j] || sz, sz, 0.3], xs[j], y0 - i * gap, z)));
    return {
      c, xs, y: (i) => y0 - i * gap,
      set(i, j, v) { relabel(c[i][j], fmt(v)); },
      setAll(A) { A.forEach((r, i) => r.forEach((v, j) => relabel(c[i][j], fmt(v)))); },
      row(i, col) { c[i].forEach((m) => glow(m, col)); },
      col(j, col) { c.forEach((r) => glow(r[j], col)); },
      paintCol(j, col) { c.forEach((r) => tint(r[j], col)); },
      clearGlow() { c.forEach((r) => r.forEach((m) => glow(m, null))); },
    };
  }
  // R⁴ 之類的向量畫成一排長條（基準線在 base）
  function bars(vals, x0, base, z = 0, color = COL.a, o = {}) {
    const k = o.k || 0.42, w = o.w || 0.3, gap = o.gap || 0.38;
    const ms = vals.map((v, i) => { const m = lab.box(color, [w, 1, w]); m.position.set(x0 + i * gap, base, z); lab.world.add(m); return m; });
    const ls = vals.map((v, i) => tag('', 'idx', x0 + i * gap, base, z + 0.3));
    const plank = new THREE.Mesh(new THREE.BoxGeometry(gap * vals.length, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: '#a8987f' }));
    plank.position.set(x0 + gap * (vals.length - 1) / 2, base, z); lab.world.add(plank);
    const B = {
      ms, ls, vals: vals.slice(),
      set(v) {
        B.vals = v.slice();
        v.forEach((x, i) => { const h = x * k; ms[i].scale.y = Math.max(Math.abs(h), 0.001); ms[i].position.y = base + h / 2; ms[i].visible = Math.abs(h) > 0.002; ls[i].position.set(x0 + i * gap, base + h + (h >= 0 ? 0.22 : -0.22), z + 0.25); txt(ls[i], o.noNum ? '' : fmt(Math.round(x * 100) / 100)); });
      },
      color(c) { ms.forEach((m) => tint(m, c)); },
      glow(c) { ms.forEach((m) => glow(m, c)); },
      ghost() { ms.forEach((m) => { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.28; m.material.depthWrite = false; }); },
      mid: x0 + gap * (vals.length - 1) / 2,
    };
    B.set(vals);
    return B;
  }
  // 鏡頭繞著 look 轉：angle（度，0 = 正前方）、elev（度）
  function cam(angle, elev, dist, look) {
    const a = angle * Math.PI / 180, e = elev * Math.PI / 180;
    lab.frameCamera([look[0] + dist * Math.sin(a) * Math.cos(e), look[1] + dist * Math.sin(e), look[2] + dist * Math.cos(a) * Math.cos(e)], look);
  }
  async function orbit(tok, ms, a0, a1, elev, dist, look) { await tw(tok, ms, (t) => cam(a0 + (a1 - a0) * t, elev, dist, look)); }

  // ── 線性代數運算：RREF（逐步紀錄）、零空間基底 ──
  const EPS = 1e-9;
  function rrefSteps(M) {
    const A = M.map((r) => r.slice()), m = A.length, n = A[0].length, piv = [], steps = [];
    const snap = () => A.map((r) => r.map((x) => (Math.abs(x) < 1e-10 ? 0 : x)));
    let r = 0;
    for (let c = 0; c < n && r < m; c++) {
      let p = -1; for (let i = r; i < m; i++) if (Math.abs(A[i][c]) > EPS) { p = i; break; }
      if (p < 0) { steps.push({ text: '第 ' + (c + 1) + ' 欄在第 ' + (r + 1) + ' 列以下全是 0 → 自由欄', A: snap(), row: -1, col: c }); continue; }
      if (p !== r) { [A[r], A[p]] = [A[p], A[r]]; steps.push({ text: '交換 R' + (r + 1) + ' ↔ R' + (p + 1), A: snap(), row: r, col: c }); }
      const pv = A[r][c];
      if (Math.abs(pv - 1) > EPS) { for (let j = 0; j < n; j++) A[r][j] /= pv; steps.push({ text: 'R' + (r + 1) + ' ÷ ' + fmt(pv) + '：pivot 變 1', A: snap(), row: r, col: c }); }
      for (let i = 0; i < m; i++) if (i !== r && Math.abs(A[i][c]) > EPS) {
        const f = A[i][c]; for (let j = 0; j < n; j++) A[i][j] -= f * A[r][j];
        steps.push({ text: 'R' + (i + 1) + ' − (' + fmt(f) + ')·R' + (r + 1), A: snap(), row: i, col: c });
      }
      piv.push(c); r++;
    }
    return { R: snap(), piv, rank: piv.length, steps };
  }
  function nullBasis(R, piv, n) {
    const free = []; for (let j = 0; j < n; j++) if (!piv.includes(j)) free.push(j);
    return free.map((f) => { const x = new Array(n).fill(0); x[f] = 1; piv.forEach((pc, k) => { x[pc] = -R[k][f]; }); return x; });
  }
  function subspaces(A) {
    const m = A.length, n = A[0].length, E = rrefSteps(A), Et = rrefSteps(T(A));
    return {
      rank: E.rank, piv: E.piv, R: E.R,
      row: E.R.slice(0, E.rank), null: nullBasis(E.R, E.piv, n),
      col: E.piv.map((j) => A.map((r) => r[j])), left: nullBasis(Et.R, Et.piv, m), m, n,
    };
  }
  function parseM(s) {
    const rows = String(s).trim().split(/\s*[;\n]\s*/).filter(Boolean).map((r) => r.split(/[\s,]+/).filter(Boolean).map(Number));
    if (!rows.length || rows.some((r) => r.length !== rows[0].length || r.some((x) => !isFinite(x)))) return null;
    return rows;
  }

  // ───────────────────────── 模式 1：張成與線性獨立 ─────────────────────────
  const sp = { vecs: [[2, 0, 0.6], [0.4, 1.8, 0.4], [1.2, 0.9, 0.5]], on: [true, true, false] };
  function enterSpan() {
    fresh([5.6, 6.2, 9.4], [0, 2.4, 0]);
    sp.S = space3(0, 2.6, 0, 0.9, 2.6);
    sp.arrows = sp.vecs.map((v, i) => sp.S.arrow(v, [COL.a, COL.b, COL.c][i], ['u', 'v', 'w'][i]));
    sp.line = sp.S.line([1, 0, 0], COL.g); sp.line.visible = false;
    sp.plane = sp.S.plane([1, 0, 0], [0, 1, 0], COL.g, 0.18); sp.plane.fade(0);
    sp.box = new THREE.Mesh(new THREE.BoxGeometry(4.6, 4.6, 4.6), new THREE.MeshBasicMaterial({ color: COL.g, transparent: true, opacity: 0.07, depthWrite: false }));
    sp.box.position.copy(sp.S.w([0, 0, 0])); lab.world.add(sp.box); sp.box.visible = false;
    controls(['u', 'v', 'w'].map((n, i) => '<label><input type="checkbox" id="spOn' + i + '"' + (sp.on[i] ? ' checked' : '') + '> ' + n + ' = <input id="spV' + i + '" value="' + sp.vecs[i].join(',') + '" style="width:92px"></label>').join(' ')
      + '<button class="primary" id="spDraw">畫出 span</button><button id="spDep">讓 w 落在 u、v 平面上</button>');
    on('spDraw', () => readSpan());
    on('spDep', () => { sp.vecs[2] = addv(scl(sp.vecs[0], 0.5), scl(sp.vecs[1], 0.8)).map((x) => Math.round(x * 100) / 100); sp.on = [true, true, true]; if ($('spV2')) $('spV2').value = sp.vecs[2].join(','); [0, 1, 2].forEach((i) => { if ($('spOn' + i)) $('spOn' + i).checked = true; }); drawSpan(); log('w = 0.5u + 0.8v：w 在 u、v 張成的平面上 → 相依。'); });
    log('勾選要用的向量、改座標（x,y,z），按「畫出 span」：所有線性組合 c₁u + c₂v + c₃w 組成的集合。');
    drawSpan();
  }
  function readSpan() {
    for (let i = 0; i < 3; i++) {
      const el = $('spV' + i); if (!el) continue;
      const v = String(el.value).split(/[\s,]+/).filter(Boolean).map(Number);
      if (v.length !== 3 || v.some((x) => !isFinite(x))) { log(['u', 'v', 'w'][i] + ' 要寫成三個數字，例如 1,0,2。', true); return; }
      if (norm(v) > 3) { log(['u', 'v', 'w'][i] + ' 太長了（長度 > 3），畫面放不下，請縮小。', true); return; }
      sp.vecs[i] = v; sp.on[i] = $('spOn' + i).checked !== false;
    }
    drawSpan();
  }
  function drawSpan() {
    const S = sp.S, use = sp.vecs.filter((v, i) => sp.on[i]);
    sp.vecs.forEach((v, i) => { S.set(sp.arrows[i], v); sp.arrows[i].visible = sp.on[i] && norm(v) > 1e-9; if (sp.arrows[i].lbl) showL(sp.arrows[i].lbl, sp.arrows[i].visible); sp.arrows[i].glow(null); });
    const r = use.length ? rrefSteps(T(use)).rank : 0;
    sp.line.visible = r === 1; sp.plane.fade(r === 2 ? 0.2 : 0); sp.box.visible = r === 3;
    if (r === 1) S.setLine(sp.line, use.find((v) => norm(v) > 1e-9), 2.8);
    if (r === 2) { const basis = []; for (const v of use) { if (rrefSteps(T([...basis, v])).rank > basis.length) basis.push(v); } sp.plane.setSpan(basis[0], basis[1]); }
    const indep = r === use.length;
    let dep = '';
    if (!indep && use.length) {
      // 找出最後一個被前面向量表示的
      const names = ['u', 'v', 'w'].filter((n, i) => sp.on[i]);
      for (let k = 1; k < use.length; k++) if (rrefSteps(T(use.slice(0, k + 1))).rank === rrefSteps(T(use.slice(0, k))).rank) { dep = names[k] + ' 是前面向量的組合 → 多餘'; sp.arrows[['u', 'v', 'w'].indexOf(names[k])].glow(RED); break; }
      if (!dep) dep = '有零向量';
    }
    const shape = ['只有原點 {0}', '一條過原點的線', '一個過原點的平面', '整個 R³'][r];
    setState('span 的形狀', [['用了幾個向量', String(use.length)], ['rank（獨立的個數）', String(r)], ['span', shape], ['線性獨立？', use.length ? (indep ? '是' : '否') : '—']],
      (indep ? '<span class="ok">每個向量都貢獻新方向</span>' : '<span class="no">' + dep + '</span>') + '<br>dim(span) = rank = ' + r);
    log('span = ' + shape + '（rank ' + r + '）' + (indep ? '' : '；' + dep));
  }

  // ───────────────────────── 模式 2：RREF 與四個子空間 ─────────────────────────
  const rr = { src: '1 2 2 2; 2 4 6 8; 3 6 8 10', A: null, k: 0, E: null };
  function enterRref() {
    fresh([0, 3.4, 13], [0, 3.2, 0]);
    controls('<label>A = <input id="rrA" value="' + rr.src + '" style="width:210px"></label>'
      + '<button id="rrLoad">載入</button><button class="primary" id="rrStep">下一步</button><button id="rrAll">做到底</button>');
    on('rrLoad', () => { const A = parseM($('rrA').value); if (!A) { log('格式：同一列用空白或逗號，列之間用分號，例如 1 2; 3 4', true); return; } if (A.length > 4 || A[0].length > 5) { log('最多 4 列 × 5 欄，畫面才放得下。', true); return; } rr.src = $('rrA').value; loadRref(A); });
    on('rrStep', () => stepRref());
    on('rrAll', () => { let g = 0; while (rr.E && rr.k < rr.E.steps.length && g++ < 60) stepRref(true); stepRref(); });
    loadRref(parseM(rr.src));
  }
  function loadRref(A) {
    lab.clear();
    rr.A = A; rr.k = 0; rr.E = rrefSteps(A);
    const m = A.length, n = A[0].length;
    rr.g = mgrid(A, -(n - 1) * 0.39 - 1.6, 5.6, 0);
    rr.cl = A[0].map((_, j) => tag('x' + (j + 1), 'idx', rr.g.xs[j], 6.2));
    rr.info = tag('', 'ptr', 3.6, 4.4); rr.info2 = tag('', 'idx', 3.6, 3.7);
    showL(rr.info, false); showL(rr.info2, false);
    log('A 是 ' + m + '×' + n + '。按「下一步」做列運算（row operation）到 reduced row echelon form R。');
    setState('A（' + m + '×' + n + '）', [['步驟', '0 / ' + rr.E.steps.length]], '列運算不改變 row space 與 null space');
  }
  function stepRref(quiet) {
    if (!rr.E) return;
    const E = rr.E, m = rr.A.length, n = rr.A[0].length;
    if (rr.k >= E.steps.length) { if (!quiet) finishRref(); return; }
    const s = E.steps[rr.k++];
    rr.g.clearGlow(); rr.g.setAll(s.A);
    if (s.row >= 0) rr.g.row(s.row, GOLD);
    if (!quiet) log(s.text);
    setState('列運算中', [['步驟', rr.k + ' / ' + E.steps.length], ['剛做', s.text]], 'pivot 欄：' + (E.piv.filter((c) => c <= s.col).map((c) => 'x' + (c + 1)).join('、') || '—'));
    if (rr.k >= E.steps.length && !quiet) finishRref();
    void m; void n;
  }
  function finishRref() {
    const A = rr.A, m = A.length, n = A[0].length, Q = subspaces(A), E = rr.E;
    rr.g.clearGlow(); rr.g.setAll(E.R);
    for (let j = 0; j < n; j++) rr.g.paintCol(j, E.piv.includes(j) ? COL.a : '#e7dcc8');
    showL(rr.info, true); showL(rr.info2, true);
    const free = A[0].map((_, j) => j).filter((j) => !E.piv.includes(j));
    txt(rr.info, 'rank r = ' + Q.rank); txt(rr.info2, 'pivot 欄 ' + (E.piv.map((c) => 'x' + (c + 1)).join(',') || '無') + '；自由欄 ' + (free.length ? free.map((j) => 'x' + (j + 1)).join(',') : '無'));
    const b = (vs) => vs.length ? vs.map(vstr).join(' ') : '∅（只有 0）';
    setState('四個基本子空間（m = ' + m + ', n = ' + n + ', r = ' + Q.rank + '）', [
      ['C(A) ⊂ R' + m, 'dim ' + Q.rank], ['N(A) ⊂ R' + n, 'dim ' + (n - Q.rank)], ['C(Aᵀ) ⊂ R' + n, 'dim ' + Q.rank], ['N(Aᵀ) ⊂ R' + m, 'dim ' + (m - Q.rank)]],
      'C(A) 基底（原矩陣的 pivot 欄）：' + b(Q.col) + '<br>N(A) 基底（special solutions）：' + b(Q.null) + '<br>C(Aᵀ) 基底（R 的非零列）：' + b(Q.row) + '<br>N(Aᵀ) 基底：' + b(Q.left)
      + '<br><span class="ok">r + (n − r) = ' + n + '</span>；<span class="ok">r + (m − r) = ' + m + '</span>');
    log('完成：rank ' + Q.rank + '。C(A) 要拿「原矩陣」的 pivot 欄，不是 R 的欄（列運算會改變 column space）。');
  }

  // ───────────────────────── 模式 3：四個子空間 3D ─────────────────────────
  const FOUR = {
    r2: { name: 'rank 2：[1 2 3; 2 4 6; 1 1 1]', A: [[1, 2, 3], [2, 4, 6], [1, 1, 1]] },
    r1: { name: 'rank 1：[1 2 1; 2 4 2; −1 −2 −1]', A: [[1, 2, 1], [2, 4, 2], [-1, -2, -1]] },
    r3: { name: 'rank 3：[2 1 0; 0 1 1; 1 0 2]', A: [[2, 1, 0], [0, 1, 1], [1, 0, 2]] },
    r2b: { name: 'rank 2：[1 0 −1; 0 1 1; 1 1 0]', A: [[1, 0, -1], [0, 1, 1], [1, 1, 0]] },
  };
  const fourSt = { key: 'r2' };
  function enterFour() {
    fresh([0, 6.5, 13.5], [0, 2.4, 0]);
    controls('<select id="fsA">' + Object.keys(FOUR).map((k) => '<option value="' + k + '">' + FOUR[k].name + '</option>').join('') + '</select>'
      + '<label>x = <input id="fsX" value="1,1,1" style="width:80px"></label><button class="primary" id="fsMap">把 x 送過去 Ax</button>');
    $('fsA').value = fourSt.key;
    $('fsA').onchange = (e) => { fourSt.key = e.target.value; enterFour(); };
    on('fsMap', safe(() => mapFour()));
    drawFour(FOUR[fourSt.key].A);
  }
  function drawFour(A) {
    const Q = subspaces(A);
    const L = space3(-3.5, 2.5, 0, 0.62, 2.1, ['x₁', 'x₂', 'x₃'], 'Rⁿ（x 住的地方）');
    const R = space3(3.5, 2.5, 0, 0.62, 2.1, ['b₁', 'b₂', 'b₃'], 'Rᵐ（Ax 住的地方）');
    fourSt.L = L; fourSt.R = R; fourSt.Q = Q; fourSt.A = A;
    const draw = (S, basis, color, nm) => {
      if (basis.length === 1) { S.line(basis[0], color, 3.2, [0, 0, 0], 0.04); const p = S.w(scl(basis[0], 3.4 / norm(basis[0]))); tag(nm, 'ptr', p.x, p.y, p.z); }
      if (basis.length === 2) { S.plane(basis[0], basis[1], color, 0.24); const p = S.w(scl(addv(basis[0], basis[1]), 2.6 / norm(addv(basis[0], basis[1])))); tag(nm, 'ptr', p.x, p.y, p.z); }
      if (basis.length === 3) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, depthWrite: false })); b.position.copy(S.w([0, 0, 0])); lab.world.add(b); const p = S.w([1.5, 0, 3]); tag(nm + ' = 整個 R³', 'ptr', p.x, p.y, p.z); }
      if (basis.length === 0) { S.ball([0, 0, 0], color, 0.13); const p = S.w([0, 0, -0.6]); tag(nm + ' = {0}', 'idx', p.x, p.y, p.z); }
    };
    draw(L, Q.row, COL.a, 'row space'); draw(L, Q.null, COL.r, 'null space');
    draw(R, Q.col, COL.d, 'column space'); draw(R, Q.left, COL.c, 'left null space');
    const m = 3, n = 3;
    setState('A 的四個子空間（r = ' + Q.rank + '）', [['row space C(Aᵀ)', 'dim ' + Q.rank], ['null space N(A)', 'dim ' + (n - Q.rank)], ['column space C(A)', 'dim ' + Q.rank], ['left null N(Aᵀ)', 'dim ' + (m - Q.rank)]],
      'row space ⊥ null space（在 Rⁿ）<br>column space ⊥ left null space（在 Rᵐ）<br><span class="ok">r + (n − r) = n，r + (m − r) = m</span>');
    log('左邊：row space（藍）與 null space（紅）互相垂直；右邊：column space（綠）與 left null space（紫）互相垂直。');
  }
  async function mapFour() {
    const x = String($('fsX').value).split(/[\s,]+/).filter(Boolean).map(Number);
    if (x.length !== 3 || x.some((v) => !isFinite(v))) { log('x 要寫三個數字，例如 1,1,1。', true); return; }
    if (norm(x) > 3.2) { log('x 太長了，畫面放不下（長度請 ≤ 3）。', true); return; }
    const { L, R, Q, A } = fourSt;
    // x = x_r + x_n
    let xn = [0, 0, 0];
    if (Q.null.length) { const [e1, e2] = Q.null.length === 2 ? orthoBasis(Q.null[0], Q.null[1]) : [scl(Q.null[0], 1 / norm(Q.null[0])), null]; xn = scl(e1, dot(x, e1)); if (e2) xn = addv(xn, scl(e2, dot(x, e2))); }
    const xr = addv(x, scl(xn, -1)), b = mulMV(A, x);
    const ax = L.arrow(x, COL.k, 'x'); await wait(null, 500);
    const ar = L.arrow(xr, COL.a, 'x_r'); const an = arrow(COL.r); an.tag('x_n'); L.set(an, xn, xr);
    log('x = x_r + x_n：x_r = ' + vstr(xr) + ' 在 row space，x_n = ' + vstr(xn) + ' 在 null space。');
    await wait(null, 900);
    const k = norm(b) > 3.2 ? 3 / norm(b) : 1;
    const ab = R.arrow([0, 0, 0], COL.d, k < 1 ? 'Ax（縮小 ×' + k.toFixed(2) + '）' : 'Ax = A x_r');
    if (k < 1) log('Ax = ' + vstr(b) + ' 太長，箭頭等比例縮小畫（方向不變，仍在 column space 裡）。');
    await tw(null, 900, (t) => R.set(ab, scl(b, t * k)));
    setState('Ax = A(x_r + x_n) = A x_r', [['x', vstr(x)], ['x_r（row space）', vstr(xr)], ['x_n（null space）', vstr(xn)], ['Ax', vstr(b)]], 'A x_n = 0：null space 的部分被壓成 0<br>Ax 一定落在 column space');
    void ax; void ar;
  }

  // ───────────────────────── 模式 4：Ax = b 的完整解 ─────────────────────────
  const SOL = {
    line: { name: '2×3，rank 2：[1 0 1; 0 1 1]', A: [[1, 0, 1], [0, 1, 1]], b: '1,1' },
    plane: { name: '1×3，rank 1：[1 1 1]', A: [[1, 1, 1]], b: '2' },
    r1: { name: '2×3，rank 1：[1 2 0; 2 4 0]', A: [[1, 2, 0], [2, 4, 0]], b: '2,4' },
  };
  const sol = { key: 'line' };
  function enterSolve() {
    fresh([5.8, 6, 9.6], [0, 2.4, 0]);
    controls('<select id="soA">' + Object.keys(SOL).map((k) => '<option value="' + k + '">' + SOL[k].name + '</option>').join('') + '</select>'
      + '<label>b = <input id="soB" value="' + SOL[sol.key].b + '" style="width:70px"></label><button class="primary" id="soSolve">求完整解</button>');
    $('soA').value = sol.key;
    $('soA').onchange = (e) => { sol.key = e.target.value; enterSolve(); };
    on('soSolve', () => solveB());
    sol.S = space3(0, 2.6, 0, 0.85, 2.6);
    const A = SOL[sol.key].A, Q = subspaces(A);
    sol.Q = Q;
    if (Q.null.length === 1) sol.S.line(Q.null[0], COL.gray, 3.2, [0, 0, 0], 0.035);
    if (Q.null.length === 2) sol.S.plane(Q.null[0], Q.null[1], COL.gray, 0.16);
    sol.set = null; sol.xp = null;
    log('灰色：N(A)，Ax = 0 的解（過原點）。輸入 b 按「求完整解」：x = x_p + x_n。');
    setState('A = ' + SOL[sol.key].name, [['rank', String(Q.rank)], ['dim N(A)', String(3 - Q.rank)]], '完整解 = 一個特解 x_p + 整個 N(A)');
  }
  function solveB() {
    const A = SOL[sol.key].A, m = A.length;
    const b = String($('soB').value).split(/[\s,]+/).filter(Boolean).map(Number);
    if (b.length !== m || b.some((x) => !isFinite(x))) { log('b 要有 ' + m + ' 個數字。', true); return; }
    const aug = A.map((r, i) => [...r, b[i]]), E = rrefSteps(aug);
    if (E.piv.includes(3)) { log('消去後出現 0 = 非零：b 不在 column space，無解。', true); setState('無解', [['b', vstr(b)]], '<span class="no">b ∉ C(A)</span>'); return; }
    const xp = [0, 0, 0]; E.piv.forEach((c, k) => { xp[c] = E.R[k][3]; });
    if (norm(xp) > 2.4) { log('x_p = ' + vstr(xp) + ' 離原點太遠，畫面放不下；請把 b 改小一點。', true); return; }
    if (sol.set) { lab.world.remove(sol.set); if (sol.set.edge) lab.world.remove(sol.set.edge); }
    if (sol.xp) { sol.xp.visible = false; if (sol.xp.lbl) showL(sol.xp.lbl, false); }
    const Q = sol.Q;
    if (Q.null.length === 1) sol.set = sol.S.line(Q.null[0], COL.b, 3.0, xp, 0.045);
    else sol.set = sol.S.plane(Q.null[0], Q.null[1], COL.b, 0.24, xp);
    sol.xp = sol.S.arrow(xp, COL.r, 'x_p');
    setState('x = x_p + x_n', [['b', vstr(b)], ['x_p（自由變數 = 0）', vstr(xp)], ['N(A) 基底', Q.null.map(vstr).join(' ')]],
      '橘色解集合 = 灰色 N(A) 平移到 x_p<br><span class="no">不過原點 → 不是子空間</span>（b ≠ 0 時）');
    log('特解 x_p = ' + vstr(xp) + '；解集合是 N(A) 平移過去。');
  }

  // ───────────────────────── 模式 5：圖與 incidence matrix ─────────────────────────
  const GN = [[-5.4, 3.1], [-3.3, 5.3], [-1.2, 3.1], [-3.3, 0.9], [-5.6, 5.4]];
  const GE = [[0, 1], [1, 2], [0, 2], [0, 3], [2, 3], [1, 3], [0, 4], [1, 4]];
  const gr = { on: [true, true, true, true, true, false, false, false], nodes: 4 };
  function enterGraph() {
    fresh([0, 3.3, 14], [-1.2, 3.1, 0]);
    controls(GE.map((e, i) => '<button id="grE' + i + '">' + (e[0] + 1) + '→' + (e[1] + 1) + '</button>').join('') + '<button id="grNode">節點 5：' + (gr.nodes === 5 ? '有' : '無') + '</button>');
    GE.forEach((e, i) => on('grE' + i, () => { if ((e[0] === 4 || e[1] === 4) && gr.nodes < 5) { log('先按「節點 5」加入第 5 個節點。', true); return; } gr.on[i] = !gr.on[i]; drawGraph(); }));
    on('grNode', () => { gr.nodes = gr.nodes === 5 ? 4 : 5; if (gr.nodes === 4) GE.forEach((e, i) => { if (e[0] === 4 || e[1] === 4) gr.on[i] = false; }); enterGraph(); });
    drawGraph();
  }
  function drawGraph() {
    lab.clear();
    const n = gr.nodes, E = GE.filter((e, i) => gr.on[i]), m = E.length;
    for (let k = 0; k < n; k++) { const b = dotBall(COL.a, 0.3); b.position.set(GN[k][0], GN[k][1], 0); b.add(lab.label(String(k + 1), 'val')); }
    E.forEach((e, i) => { const a = arrow('#8a7b66', 0.04); const p = V3(...GN[e[0]], 0), q = V3(...GN[e[1]], 0), d = q.clone().sub(p).normalize(); a.setW(p.clone().addScaledVector(d, 0.36), q.clone().addScaledVector(d, -0.36)); const mid = p.clone().add(q).multiplyScalar(0.5); tag('e' + (i + 1), 'idx', mid.x + 0.25, mid.y + 0.2, 0.2); });
    if (!m) { setState('圖', [['節點 n', String(n)], ['邊 m', '0']], '按上面的按鈕加邊'); return; }
    const A = E.map(([s, t]) => { const r = new Array(n).fill(0); r[s] = -1; r[t] = 1; return r; });
    const g = mgrid(A, 0.9, 5.6, 0, { gap: 0.62, size: 0.5, color: (i, j) => (A[i][j] === 0 ? '#e7dcc8' : A[i][j] > 0 ? COL.d : COL.b) });
    for (let j = 0; j < n; j++) tag('節' + (j + 1), 'idx', g.xs[j], 6.15);
    const Q = subspaces(A), loops = m - Q.rank, comp = n - Q.rank;
    setState('incidence matrix A（' + m + '×' + n + '）', [['邊 m', String(m)], ['節點 n', String(n)], ['rank r', String(Q.rank)], ['dim N(A)（連通塊數）', String(n - Q.rank)], ['獨立迴圈 = m − r', String(loops)]],
      '節點 − 邊 + 迴圈 = ' + n + ' − ' + m + ' + ' + loops + ' = <span class="ok">' + (n - m + loops) + '</span>' + (comp === 1 ? '（連通圖 = 1，Euler 公式）' : '（= 連通塊數 ' + comp + '）'));
    log('每列 = 一條邊：起點 −1、終點 +1。迴圈 ↔ 相依的列；N(Aᵀ) 的維度 = 獨立迴圈數。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  const qs = { score: 0, total: 0 };
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function genQ() {
    const k = Math.random();
    if (k < 0.18) {
      const m = ri(2, 6), n = ri(2, 7), r = ri(1, Math.min(m, n));
      const which = pick(['N(A)', 'N(Aᵀ)', 'C(A)', 'C(Aᵀ)']);
      const ans = { 'N(A)': n - r, 'N(Aᵀ)': m - r, 'C(A)': r, 'C(Aᵀ)': r }[which];
      const opts = [...new Set([ans, n - r, m - r, r, Math.abs(m - n), ans + 1].map(String))].slice(0, 4);
      if (!opts.includes(String(ans))) opts[0] = String(ans);
      return { q: 'A 是 ' + m + '×' + n + '，rank = ' + r + '。dim ' + which + ' = ？', opts, ans: String(ans), why: 'dim C(A) = dim C(Aᵀ) = r；dim N(A) = n − r = ' + (n - r) + '；dim N(Aᵀ) = m − r = ' + (m - r) + '。' };
    }
    if (k < 0.34) {
      const S = [['R³ 中過原點的平面', '是'], ['R³ 中不過原點的直線', '不是'], ['R² 中兩條過原點直線的聯集', '不是'], ['兩個子空間的交集', '是'], ['{v ∈ R³：v₁ + v₂ + v₃ = 0}', '是'], ['{v ∈ R³：v₁ + v₂ = 1}', '不是'], ['R² 的第一象限 {x ≥ 0, y ≥ 0}', '不是'], ['所有 2×2 rank 1 矩陣', '不是'], ['所有 3×3 對稱矩陣', '是'], ['Ax = b（b ≠ 0）的所有解', '不是'], ['Ax = 0 的所有解', '是'], ['只有零向量 {0}', '是']];
      const [s, a] = pick(S);
      const why = { '是': '含 0，且加法、純量乘法封閉。', '不是': '不含 0 或加法 / 純量乘法會跑出去（例如兩個 rank 1 相加通常 rank 2）。' }[a];
      return { q: '「' + s + '」是不是向量子空間？', opts: ['是', '不是'], ans: a, why };
    }
    if (k < 0.48) {
      const u = [ri(-2, 2), ri(-2, 2), ri(1, 3)], v = [ri(1, 3), ri(-2, 2), ri(-2, 2)];
      const dep = Math.random() < 0.5, a = ri(-2, 2) || 1, b = ri(-2, 2) || 1;
      const w = dep ? addv(scl(u, a), scl(v, b)) : [ri(-3, 3), ri(-3, 3), ri(-3, 3)];
      const r = rrefSteps(T([u, v, w])).rank;
      const ans = r === 3 ? '線性獨立，span = R³' : r === 2 ? '相依，span 是平面' : '相依，span 是直線';
      return { q: 'u = ' + vstr(u) + '、v = ' + vstr(v) + '、w = ' + vstr(w) + '：', opts: ['線性獨立，span = R³', '相依，span 是平面', '相依，span 是直線', '線性獨立，span 是平面'], ans, why: '把三個向量排成矩陣算 rank = ' + r + (dep ? '；w = ' + a + 'u + ' + b + 'v。' : '。') };
    }
    if (k < 0.6) {
      const n = ri(4, 9), mm = ri(Math.max(3, n - 3), n + 4);
      const ans = String(mm - n + 1);
      return { q: '一個連通圖有 ' + n + ' 個節點、' + mm + ' 條邊。incidence matrix 的 dim N(Aᵀ)（獨立迴圈數）= ？', opts: [...new Set([ans, String(mm - n), String(mm - n + 2), String(n - 1)])], ans, why: 'rank = n − 1 = ' + (n - 1) + '（N(A) 只有常數向量）；dim N(Aᵀ) = m − r = ' + mm + ' − ' + (n - 1) + ' = ' + ans + '。也就是 Euler：節點 − 邊 + 迴圈 = 1。' };
    }
    if (k < 0.72) {
      const b1 = ri(-4, 6), b2 = ri(-4, 6), ok = Math.random() < 0.5, b3 = ok ? b1 + b2 : b1 + b2 + pick([-3, -1, 2, 5]);
      return { q: 'A = [1 2 2 2; 2 4 6 8; 3 6 8 10]（第 3 列 = 第 1 列 + 第 2 列）。b = (' + b1 + ', ' + b2 + ', ' + b3 + ')，Ax = b 有解嗎？', opts: ['有解（無限多個）', '有唯一解', '無解'], ans: ok ? '有解（無限多個）' : '無解', why: '消去後最後一列是 0 = b₃ − b₂ − b₁ = ' + (b3 - b2 - b1) + '。' + (ok ? '成立；rank 2 < n = 4 有 2 個自由變數 → 無限多解。' : '不成立 → 無解。') };
    }
    if (k < 0.84) {
      const u = [ri(1, 3), ri(-3, 3)], v = [ri(1, 4), ri(-2, 5), ri(-3, 3)];
      const i = ri(0, 1), j = ri(0, 2), ans = String(u[i] * v[j]);
      return { q: 'rank 1 矩陣 A = u vᵀ，u = ' + vstr(u) + '、v = ' + vstr(v) + '。A 的第 ' + (i + 1) + ' 列第 ' + (j + 1) + ' 欄 = ？', opts: [...new Set([ans, String(u[i] + v[j]), String(u[1 - i] * v[j]), String(u[i] * v[(j + 1) % 3])])], ans, why: '(u vᵀ)ᵢⱼ = uᵢ vⱼ = ' + u[i] + ' × ' + v[j] + '。每一列都是 vᵀ 的倍數，所以 rank 1。' };
    }
    const cases = [['r = m = n', '恰一解'], ['r = n < m', '0 或 1 個解'], ['r = m < n', '無限多解（一定有解）'], ['r < m 且 r < n', '0 或無限多解']];
    const [c, a] = pick(cases);
    return { q: 'm×n 矩陣、rank r，' + c + ' 時 Ax = b 的解有幾個？', opts: cases.map((x) => x[1]), ans: a, why: 'r = m：每列都有 pivot → 一定有解；r = n：沒有自由變數 → 最多一解。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q" style="white-space:pre-wrap">' + p.q + '</div><div class="lab-quiz-opts">'
      + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
    el.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
      btn.onclick = () => {
        if (el.querySelector('.right')) return;
        const pk = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pk === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => { const o = decodeURIComponent(b.dataset.o); if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pk === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 跟著影片的場景 ═════════════════════════
  const A6 = [[1, 1, 2], [2, 1, 3], [3, 1, 4], [4, 1, 5]];
  const A6c = T(A6);
  // ─── 8o5Cmfpeo6g（MIT 18.06 L6）：子空間、column space、null space ───
  async function scSubspace(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 24, 11, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    say('R³ 本身是向量空間', '能相加、能乘常數，結果還在裡面');
    await beat(tok, 2200);
    const u = [1, 0, 0.3], v = [0, 1, 0.5];
    const P = S.plane(u, v, COL.a, 0); await tw(tok, 700, (t) => P.fade(0.22 * t));
    const pl = S.w([2.2, 2.2, 1.6]); tag('平面 P', 'ptr', pl.x, pl.y, pl.z);
    say('子空間：住在 R³ 裡、自己也是向量空間', '例：過原點的平面 P');
    await beat(tok, 2000);
    const a = S.arrow([1.2, -0.6, 0.06], COL.b, 'v'), b = S.arrow([-0.3, 1.2, 0.51], COL.c, 'w');
    await beat(tok, 900);
    const s = S.arrow([0, 0, 0], COL.g, 'v + w');
    await tw(tok, 1100, (t) => S.set(s, scl([0.9, 0.6, 0.57], t)));
    say('P 裡兩個向量相加：還在 P 上', 'v + w ∈ P');
    await beat(tok, 2000);
    await tw(tok, 1100, (t) => S.set(a, scl([1.2, -0.6, 0.06], 1 - 3 * t)));
    a.tag('−2v');
    say('乘上 −2：還在 P 上', 'c·v ∈ P');
    await beat(tok, 2000);
    const L = S.line([-0.5, 0.6, 1], COL.r, 2.6); const lp = S.w([-0.95, 1.14, 1.9]); tag('直線 L', 'ptr alt', lp.x, lp.y, lp.z);
    say('過原點的直線 L 也是子空間', '所有子空間都必須含 0 向量');
    await beat(tok, 2400);
    s.visible = false; showL(s.lbl, false); a.visible = false; showL(a.lbl, false); b.visible = false; showL(b.lbl, false);
    await tw(tok, 1200, (t) => P.setSpan(u, v, [0, 0, 1.2 * t]));
    say('平面往上平移：不含 0 → 不是子空間', '子空間一定過原點');
    await beat(tok, 2600);
    await tw(tok, 900, (t) => P.setSpan(u, v, [0, 0, 1.2 * (1 - t)]));
    void L;
    say('子空間 = 加法、純量乘法都封閉', '合起來：所有線性組合 cv + dw 都留在裡面');
    await beat(tok, 2800);
  }
  async function scUnionIntersect(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(-28, 22, 11, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const P = S.plane([1, 0, 0.3], [0, 1, 0.5], COL.a, 0.2); void P;
    S.line([-0.5, 0.6, 1], COL.r, 2.6);
    const lp = S.w([-0.95, 1.14, 1.9]); tag('L', 'ptr alt', lp.x, lp.y, lp.z);
    const pp = S.w([2.2, 2.2, 1.6]); tag('P', 'ptr', pp.x, pp.y, pp.z);
    say('P ∪ L：P 的向量加上 L 的向量', '這個聯集是子空間嗎？');
    await beat(tok, 2400);
    const p = S.arrow([1.5, 0.4, 0.65], COL.a, 'p ∈ P'), l = S.arrow([-0.4, 0.48, 0.8], COL.r, 'ℓ ∈ L');
    await beat(tok, 1300);
    const s = arrow(COL.g); s.tag('p + ℓ');
    await tw(tok, 1000, (t) => S.set(s, scl([-0.4, 0.48, 0.8], t), [1.5, 0.4, 0.65]));
    const sum = S.arrow([1.1, 0.88, 1.45], COL.k, 'p + ℓ');
    s.visible = false; showL(s.lbl, false);
    sum.glow(RED);
    say('相加跑到 P 和 L 外面', '<span class="no">P ∪ L 不是子空間</span>（加法不封閉）');
    await beat(tok, 2800);
    [p, l, sum].forEach((x) => { x.visible = false; showL(x.lbl, false); });
    const o = S.ball([0, 0, 0], COL.g, 0.18);
    say('P ∩ L：同時在 P 和 L 上的向量', '這張圖裡只剩零向量 {0}');
    for (let i = 0; i < 3; i++) { glow(o, GOLD); await beat(tok, 450); glow(o, null); await beat(tok, 350); }
    say('{0} 本身就是一個子空間', '0 + 0 = 0，c·0 = 0');
    await beat(tok, 2200);
    const Q = S.plane([1, 0, -0.4], [0, 0.6, 1], COL.d, 0.2); void Q;
    say('任兩個子空間 S、T 的交集都是子空間', 'v, w ∈ S∩T ⇒ v + w ∈ S 且 ∈ T');
    const line = S.line(cross(cross([1, 0, 0.3], [0, 1, 0.5]), cross([1, 0, -0.4], [0, 0.6, 1])), COL.g, 2.4, [0, 0, 0], 0.05);
    for (let i = 0; i < 3; i++) { line.material.emissive = new THREE.Color(GOLD); await beat(tok, 400); line.material.emissive = new THREE.Color('#000'); await beat(tok, 300); }
    say('兩個平面交成一條過原點的線', '<span class="ok">交集是子空間；聯集通常不是</span>');
    await beat(tok, 2800);
  }
  function aMatrix(x0, y0) {
    const g = mgrid(A6, x0, y0, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] });
    tag('A（4×3）', 'ptr', x0 + 0.78, y0 + 0.75);
    return g;
  }
  async function scColspaceDef(tok) {
    fresh([0, 3.4, 13.5], [0.5, 3, 0]);
    const g = aMatrix(-5.6, 5.4);
    const cb = A6c.map((c, j) => { const B = bars(c, -1.6 + j * 2.2, 2.4, 0, [COL.a, COL.b, COL.c][j]); tag('第 ' + (j + 1) + ' 欄', 'idx', B.mid, 1.6); return B; });
    say('A 的每一欄都是 R⁴ 的向量（4 個分量）', 'C(A) ⊂ R⁴，因為 A 是 4×3');
    for (let j = 0; j < 3; j++) { g.col(j, GOLD); cb[j].glow(GOLD); await beat(tok, 900); g.col(j, null); cb[j].glow(null); }
    say('只放三個欄還不是子空間', '要把所有線性組合都放進來');
    await beat(tok, 2200);
    const res = bars([0, 0, 0, 0], 5, 2.4, 0, COL.g); tag('b = Ax', 'ptr alt', res.mid, 1.6);
    const xl = tag('', 'ptr', 5.6, 5.6);
    for (const x of [[1, 0, 0], [0, 1, 0], [1, 1, 0], [2, -1, 0.5]]) {
      txt(xl, 'x = ' + vstr(x));
      const tgt = mulMV(A6, x), from = res.vals.slice();
      say('x = ' + vstr(x) + ' → ' + x.map((c, j) => fmt(c) + '·欄' + (j + 1)).join(' + '), 'Ax = ' + vstr(tgt));
      await tw(tok, 900, (t) => res.set(from.map((v, i) => v + (tgt[i] - v) * t)));
      await beat(tok, 1500);
    }
    say('C(A) = 所有 Ax = 所有欄的線性組合', '三個 R⁴ 向量的組合填不滿整個 R⁴');
    await beat(tok, 3000);
  }
  async function scColspaceSolvable(tok) {
    fresh([0, 3.4, 13.5], [0.5, 3, 0]);
    aMatrix(-5.6, 5.4);
    tag('x₁·', 'idx', -2.1, 3.4); tag('x₂·', 'idx', -0.1, 3.4); tag('x₃·', 'idx', 1.9, 3.4);
    const cb = A6c.map((c, j) => bars(c, -1.6 + j * 2.0, 2.4, 0, [COL.a, COL.b, COL.c][j], { k: 0.32 }));
    const tg = bars([0, 0, 0, 0], 4.6, 2.4, 0, COL.k, { k: 0.32 }); tg.ghost();
    const res = bars([0, 0, 0, 0], 4.6, 2.4, 0.01, COL.g, { k: 0.32, noNum: true });
    const tl = tag('目標 b', 'ptr alt', 5.17, 1.6);
    say('Ax = b：4 個方程式、3 個未知數', '是不是每個 b 都有解？');
    await beat(tok, 2400);
    const tries = [[[0, 0, 0, 0], [0, 0, 0], 'b = 0：x = 0 一定行'], [[1, 2, 3, 4], [1, 0, 0], 'b = 第 1 欄：x = (1, 0, 0)'], [[1, 1, 1, 1], [0, 1, 0], 'b = 全 1：x = (0, 1, 0)']];
    for (const [b, x, cap] of tries) {
      tg.set(b); res.set([0, 0, 0, 0]); txt(tl, '目標 b = ' + vstr(b));
      say(cap, '先想好 x，再看 b = Ax 是什麼');
      await beat(tok, 900);
      const tgt = mulMV(A6, x);
      await tw(tok, 900, (t) => res.set(scl(tgt, t)));
      res.glow(GREEN); await beat(tok, 1300); res.glow(null);
    }
    tg.set([1, 0, 0, 0]); res.set([0, 0, 0, 0]); txt(tl, '目標 b = (1, 0, 0, 0)');
    say('b = (1, 0, 0, 0)：試不出來', '它不是三個欄的組合');
    for (const x of [[1, -1, 0], [0.5, 0, 0], [-1, 1, 0.5]]) { const tgt = mulMV(A6, x); await tw(tok, 500, (t) => res.set(scl(tgt, t))); await beat(tok, 350); }
    res.glow(RED);
    await beat(tok, 1200);
    say('Ax = b 有解 ⇔ b 在 column space 裡', '<span class="ok">b ∈ C(A)</span>：b 是欄的組合，組合係數就是 x');
    await beat(tok, 3200);
    void cb;
  }
  async function scColspaceDependent(tok) {
    fresh([0, 3.4, 12.5], [0, 3, 0]);
    const g = aMatrix(-5.6, 5.4);
    const c1 = bars(A6c[0], -1.4, 2.4, 0, COL.a), c2 = bars(A6c[1], 1.0, 2.4, 0, COL.b), c3 = bars(A6c[2], 3.6, 2.4, 0, COL.c);
    tag('欄 1', 'idx', c1.mid, 1.6); tag('欄 2', 'idx', c2.mid, 1.6); tag('欄 3', 'idx', c3.mid, 1.6);
    say('能不能丟掉一欄，column space 不變？', '每一欄都有貢獻新的方向嗎？');
    await beat(tok, 2400);
    g.col(2, GOLD); c3.glow(GOLD);
    say('看第 3 欄：(2, 3, 4, 5)', '= (1, 2, 3, 4) + (1, 1, 1, 1)');
    await beat(tok, 1600);
    // 把欄 1 和欄 2 疊起來
    const s = bars([0, 0, 0, 0], 3.6, 2.4, 0.35, COL.g, { noNum: true });
    await tw(tok, 900, (t) => s.set(scl(A6c[0], t)));
    await tw(tok, 900, (t) => s.set(addv(A6c[0], scl(A6c[1], t))));
    s.glow(GREEN);
    say('欄 1 + 欄 2 疊起來 = 欄 3', '第 3 欄沒有帶來新東西 → 相依（dependent）');
    await beat(tok, 2600);
    g.col(2, null); c3.glow(null);
    g.paintCol(2, '#e7dcc8');
    say('pivot 欄：第 1、2 欄；第 3 欄不是 pivot 欄', '慣例：從左邊開始保留獨立的欄');
    await beat(tok, 2600);
    say('其實丟掉第 1 欄也行（欄 1 = 欄 3 − 欄 2）', '');
    await beat(tok, 2200);
    say('C(A) 是 R⁴ 裡的 2 維子空間', 'dim C(A) = 2 = 獨立欄的個數');
    await beat(tok, 3000);
  }
  async function scNullspaceLine(tok) {
    fresh([0, 4.2, 13.5], [0.6, 2.8, 0]);
    aMatrix(-6.3, 5.6);
    const cb = A6c.map((c, j) => bars(c, -2.5 + j * 1.75, 3.2, 0, [COL.a, COL.b, COL.c][j], { k: 0.28 }));
    const S = space3(4.4, 2.5, 0, 0.62, 2.2, ['x₁', 'x₂', 'x₃'], 'N(A) ⊂ R³');
    say('null space N(A)：所有 Ax = 0 的解 x', '裝的是 x（R³），不是 b（R⁴）');
    await beat(tok, 2600);
    say('x = 0 一定是解', 'A·0 = 0');
    const o = S.ball([0, 0, 0], COL.g, 0.13);
    await beat(tok, 1600);
    say('再找一個：x = (1, 1, −1)', '欄 1 + 欄 2 − 欄 3 = 0');
    const res = bars([0, 0, 0, 0], -2.5, 1.0, 0.3, COL.g, { k: 0.28 }); tag('Ax', 'ptr alt', res.mid, 0.25);
    await tw(tok, 800, (t) => res.set(scl(A6c[0], t)));
    await tw(tok, 800, (t) => res.set(addv(A6c[0], scl(A6c[1], t))));
    await tw(tok, 1000, (t) => res.set(addv(addv(A6c[0], A6c[1]), scl(A6c[2], -t))));
    res.glow(GREEN);
    const p1 = S.ball([1, 1, -1], COL.r, 0.12);
    await beat(tok, 1600);
    say('(2, 2, −2)、(7, 7, −7)… 都是解', 'N(A) = { c·(1, 1, −1) }');
    const L = S.line([1, 1, -1], COL.r, 3.4, [0, 0, 0], 0.035);
    L.scale.y = 0.001;
    await tw(tok, 1400, (t) => S.setLine(L, [1, 1, -1], 3.4 * Math.max(t, 0.01)));
    say('N(A) 是 R³ 裡過原點的一條線', 'c = 0 就是零向量，c = 1 就是 (1, 1, −1)');
    await beat(tok, 2600);
    say('為什麼是子空間？Av = 0、Aw = 0', 'A(v + w) = Av + Aw = 0；A(12v) = 12·Av = 0');
    await beat(tok, 3400);
    void o; void p1; void cb;
  }
  async function scShiftedLine(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(26, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 0.9, 2.5, ['x₁', 'x₂', 'x₃']);
    const N = S.line([1, 1, -1], COL.gray, 2.8, [0, 0, 0], 0.03);
    const np = S.w([1.7, 1.7, -1.7]); tag('N(A)', 'idx', np.x, np.y, np.z);
    say('右邊改成 b = (1, 2, 3, 4)', 'Ax = b 的解還是子空間嗎？');
    await beat(tok, 2400);
    const z = S.ball([0, 0, 0], COL.r, 0.12);
    say('x = 0 不是解（A·0 = 0 ≠ b）', '<span class="no">連 0 都不在 → 不是子空間</span>');
    await beat(tok, 2400); z.visible = false;
    const a = S.ball([1, 0, 0], COL.b, 0.13); const al = S.w([1, 0, 0.35]); tag('(1, 0, 0)', 'ptr alt', al.x, al.y, al.z);
    say('一個解：x = (1, 0, 0)', 'b 就是第 1 欄');
    await beat(tok, 1800);
    const b = S.ball([0, -1, 1], COL.b, 0.13); const bl = S.w([0, -1, 1.35]); tag('(0, −1, 1)', 'ptr alt', bl.x, bl.y, bl.z);
    say('另一個：x = (0, −1, 1)', '−欄 2 + 欄 3 = (1, 2, 3, 4)');
    await beat(tok, 2000);
    const Ls = S.line([1, 1, -1], COL.b, 2.4, [0, 0, 0], 0.045);
    await tw(tok, 1500, (t) => S.setLine(Ls, [1, 1, -1], 2.4, [t, 0, 0]));
    say('解集合 = N(A) 那條線平移到 (1, 0, 0)', '一條不過原點的線');
    await beat(tok, 2800);
    say('描述子空間的兩種方式', 'C(A)：給幾個向量取組合；N(A)：給方程式 Ax = 0');
    await beat(tok, 3000);
    void N; void a; void b;
  }

  // ─── 9Q1q7s1jTzU（MIT 18.06 L8）：Ax = b 的完整解 ───
  const A8 = [[1, 2, 2, 2], [2, 4, 6, 8], [3, 6, 8, 10]];
  async function scElimAug(tok) {
    fresh([0, 3.3, 12.5], [0.6, 3.6, 0]);
    const M = A8.map((r, i) => [...r, 'b' + (i + 1)]);
    const g = mgrid(M, -3.2, 5.4, 0, { widths: [0, 0, 0, 0, 1.5], color: (i, j) => (j === 4 ? '#f0d9a8' : '#d9cbb2') });
    tag('[A | b]', 'ptr', -1.6, 6.15);
    say('A：第 3 列 = 第 1 列 + 第 2 列', '把 b 接在 A 右邊 → 增廣矩陣 [A | b]');
    g.row(0, GOLD); g.row(1, GOLD); await beat(tok, 1300); g.clearGlow(); g.row(2, GREEN); await beat(tok, 1500); g.clearGlow();
    const steps = [
      [1, [0, 0, 2, 4, 'b2−2b1'], 'R2 − 2·R1', '左右兩邊做一樣的事'],
      [2, [0, 0, 2, 4, 'b3−3b1'], 'R3 − 3·R1', '第 1 欄消完；第 1 個 pivot = 1'],
      [2, [0, 0, 0, 0, 'b3−b2−b1'], 'R3 − R2', '第 2 個 pivot 在第 3 欄（= 2）'],
    ];
    for (const [r, row, op, cap] of steps) {
      g.row(r, GOLD);
      row.forEach((v, j) => g.set(r, j, v));
      say(cap, op);
      await beat(tok, 2000);
      g.clearGlow();
    }
    tint(g.c[0][0], COL.a); tint(g.c[1][2], COL.a);
    g.row(2, RED);
    say('最後一列：0 = b₃ − b₂ − b₁', '這就是有解的條件');
    await beat(tok, 3000);
  }
  async function scSolvability(tok) {
    fresh([0, 3.3, 12.5], [0.4, 3.6, 0]);
    const R = [[1, 2, 2, 2], [0, 0, 2, 4], [0, 0, 0, 0]];
    const g = mgrid(R.map((r, i) => [...r, '']), -3.2, 5.4, 0, { widths: [0, 0, 0, 0, 0.9], color: (i, j) => (j === 4 ? '#f0d9a8' : (i === 0 && j === 0) || (i === 1 && j === 2) ? COL.a : '#d9cbb2') });
    const bl = tag('', 'ptr alt', 3.3, 5.4);
    const run = async (b, cap) => {
      const e = [b[0], b[1] - 2 * b[0], b[2] - b[1] - b[0]];
      txt(bl, 'b = ' + vstr(b));
      e.forEach((v, i) => g.set(i, 4, v));
      say(cap, '消去後右邊 = (' + e.join(', ') + ')');
      await beat(tok, 1400);
      g.row(2, e[2] === 0 ? GREEN : RED);
      say(e[2] === 0 ? '最後一列 0 = 0 ✓ 有解' : '最後一列 0 = ' + e[2] + ' ✗ 無解', 'b₃ − b₂ − b₁ = ' + e[2]);
      await beat(tok, 2200); g.clearGlow();
    };
    await run([1, 5, 6], 'b = (1, 5, 6)：1 + 5 = 6');
    await run([1, 5, 17], 'b = (1, 5, 17)：1 + 5 ≠ 17');
    say('說法一：b 在 column space 裡', 'Ax = b 可解 ⇔ b ∈ C(A)');
    await beat(tok, 2600);
    say('說法二：列的組合 = 0 列 ⇒ b 的同一組合 = 0', '列1 + 列2 − 列3 = 0 ⇒ b₁ + b₂ − b₃ = 0');
    await beat(tok, 3200);
  }
  async function scParticular(tok) {
    fresh([0, 3.3, 12.5], [0.6, 3.6, 0]);
    const g = mgrid([[1, 2, 2, 2, 1], [0, 0, 2, 4, 3], [0, 0, 0, 0, 0]], -3.6, 5.4, 0, { color: (i, j) => (j === 4 ? '#f0d9a8' : '#d9cbb2') });
    ['x₁', 'x₂', 'x₃', 'x₄', 'b'].forEach((n, j) => tag(n, 'idx', g.xs[j], 6.1));
    say('b = (1, 5, 6) 消去完：0 = 0 ✓', '接下來找一個特解 x_p');
    await beat(tok, 2200);
    g.paintCol(0, COL.a); g.paintCol(2, COL.a);
    say('pivot 欄：x₁、x₃；自由欄：x₂、x₄', '自由變數沒有 pivot，可以隨便給值');
    await beat(tok, 2400);
    g.paintCol(1, '#eee4d2'); g.paintCol(3, '#eee4d2');
    const xs = ['?', '0', '?', '0'].map((v, i) => cube(v, i % 2 ? '#eee4d2' : COL.a, [0.62, 0.62, 0.3], 3.4, 5.4 - i * 0.78, 0, 2));
    tag('x_p', 'ptr alt', 3.4, 6.1);
    say('步驟 1：自由變數全部設 0', 'x₂ = 0、x₄ = 0');
    await beat(tok, 2200);
    g.row(1, GOLD);
    say('第 2 列：2x₃ = 3', 'x₃ = 3/2');
    relabel(xs[2], '3/2'); glow(xs[2], GOLD);
    await beat(tok, 2200); g.clearGlow(); glow(xs[2], null);
    g.row(0, GOLD);
    say('回代第 1 列：x₁ + 2x₃ = 1', 'x₁ = 1 − 3 = −2');
    relabel(xs[0], '−2'); glow(xs[0], GOLD);
    await beat(tok, 2200); g.clearGlow(); glow(xs[0], null);
    say('x_p = (−2, 0, 3/2, 0)', '記得代回原方程式檢查');
    await beat(tok, 3000);
  }
  async function scComplete(tok) {
    fresh([0, 0, 0], [0, 2.6, 0]); cam(24, 20, 11.5, [0, 2.6, 0]);
    const S = space3(0, 2.6, 0, 0.8, 2.6, ['', '', '']);
    const ttl = tag('示意：R⁴ 畫成 3D', 'idx', 0, 5.9);
    const s1 = [1.2, -0.6, 0.2], s2 = [0.3, 1.1, -0.4], xp = [0.4, -0.3, 1.6];
    const N = S.plane(s1, s2, COL.gray, 0); await tw(tok, 700, (t) => N.fade(0.2 * t));
    const np = S.w(addv(s1, s2)); tag('N(A)：2 維', 'idx', np.x, np.y, np.z);
    say('N(A) 有兩個 special solutions', 's₁ = (−2, 1, 0, 0)、s₂ = (2, 0, −2, 1)');
    const a1 = S.arrow(s1, COL.a, 's₁'), a2 = S.arrow(s2, COL.c, 's₂');
    await beat(tok, 2600);
    say('x_n = c₁s₁ + c₂s₂：整個平面（過原點）', '兩個自由變數 → 兩個參數');
    await beat(tok, 2000);
    const ap = S.arrow(xp, COL.r, 'x_p');
    say('加上特解 x_p = (−2, 0, 3/2, 0)', 'A x_p = b');
    await beat(tok, 2000);
    const Pp = S.plane(s1, s2, COL.b, 0.0);
    await tw(tok, 1400, (t) => { Pp.fade(0.26 * t); Pp.setSpan(s1, s2, scl(xp, t)); });
    const pp = S.w(addv(xp, addv(s1, s2))); tag('x = x_p + x_n', 'ptr alt', pp.x, pp.y, pp.z);
    say('完整解 = x_p + 整個 N(A)', 'A(x_p + x_n) = b + 0 = b');
    await beat(tok, 2200);
    const x = arrow(COL.g); x.tag('x');
    let cur = xp.slice();
    for (const [c1, c2] of [[0.6, 0.3], [-0.5, 0.8], [0.4, -0.7], [0, 0]]) {
      const tgt = addv(xp, addv(scl(s1, c1), scl(s2, c2))), from = cur.slice();
      await tw(tok, 700, (t) => x.setW(S.w([0, 0, 0]), S.w(addv(from, scl(addv(tgt, scl(from, -1)), t)))));
      cur = tgt;
      say('c₁ = ' + c1 + '、c₂ = ' + c2 + '：還是解', 'x 的尖端一直在橘色平面上');
      await beat(tok, 900);
    }
    say('x_p 前面不能乘常數，x_n 可以', '解集合：平移過的平面，不含 0 → 不是子空間');
    await beat(tok, 3200);
    void a1; void a2; void ap; void ttl;
  }
  async function scFullColumn(tok) {
    fresh([0, 3.4, 13], [0.3, 3.2, 0]);
    const A = [[1, 3], [2, 1], [6, 1], [5, 1]];
    const g = mgrid(A, -6, 5.4, 0, { color: (i, j) => [COL.a, COL.b][j] }); tag('A（4×2）', 'ptr', -5.6, 6.15);
    say('r = n：每一欄都有 pivot（full column rank）', '又高又瘦的矩陣，例如 4×2');
    await beat(tok, 2400);
    const R = mgrid([[1, 0], [0, 1], [0, 0], [0, 0]], -3.4, 5.4, 0, { color: (i, j) => (i === j ? COL.a : '#e7dcc8') }); tag('R', 'ptr', -3.0, 6.15);
    say('R = [I; 0]：上面單位矩陣、下面全 0', '沒有自由變數 → N(A) = {0}');
    await beat(tok, 2600);
    const c1 = bars([1, 2, 6, 5], -0.6, 2.2, 0, COL.a, { k: 0.3 }), c2 = bars([3, 1, 1, 1], 1.4, 2.2, 0, COL.b, { k: 0.3 });
    const tg = bars([4, 3, 7, 6], 3.8, 2.2, 0, COL.k, { k: 0.3 }); tg.ghost(); tag('b = (4, 3, 7, 6)', 'ptr alt', 4.37, 1.4);
    const res = bars([0, 0, 0, 0], 3.8, 2.2, 0.01, COL.g, { k: 0.3, noNum: true });
    say('b = (4, 3, 7, 6) = 欄 1 + 欄 2', '');
    await tw(tok, 800, (t) => res.set(scl([1, 2, 6, 5], t)));
    await tw(tok, 800, (t) => res.set(addv([1, 2, 6, 5], scl([3, 1, 1, 1], t))));
    res.glow(GREEN);
    say('唯一解 x = (1, 1)', '沒有 null space 可以加');
    await beat(tok, 2400);
    tg.set([1, 0, 0, 0]); res.glow(RED); res.set([1, 2, 6, 5]);
    say('隨便挑的 b：4 個方程式、2 個未知數', '通常無解');
    await beat(tok, 2200);
    say('r = n：解的個數是 0 或 1', 'N(A) = {0}，有解就唯一');
    await beat(tok, 3000);
    void g; void R; void c1; void c2;
  }
  async function scFullRow(tok) {
    fresh([0, 3.4, 12.5], [0.3, 3.6, 0]);
    const g = mgrid([[1, 2, 6, 5], [3, 1, 1, 1]], -5.8, 5.2, 0, { color: () => COL.a }); tag('A = 上一個例子的轉置（2×4）', 'ptr', -4.6, 6.0);
    say('r = m：每一列都有 pivot（full row rank）', '又矮又胖：2×4，rank 2');
    await beat(tok, 2400);
    const R = mgrid([[1, 0, -4 / 5, -3 / 5], [0, 1, 17 / 5, 14 / 5]], 0.4, 5.2, 0, { gap: 0.95, size: 0.82, color: (i, j) => (j < 2 ? (i === j ? COL.d : '#e7dcc8') : '#f0d9a8') }); tag('R = [I  F]', 'ptr alt', 1.8, 6.0);
    say('R = [I F]：沒有全 0 的列', '前兩欄是 pivot 欄，F 是自由欄的部分');
    await beat(tok, 2800);
    say('沒有 0 = (…) 的條件 → 每個 b 都有解', 'Ax = b 一定可解（existence）');
    R.row(0, GREEN); R.row(1, GREEN); await beat(tok, 2200); R.clearGlow();
    say('自由變數 n − r = 4 − 2 = 2 個', '→ 解有無限多個');
    R.paintCol(2, COL.b); R.paintCol(3, COL.b);
    await beat(tok, 3000);
    void g;
  }
  async function scRankCases(tok) {
    fresh([0, 3.4, 13], [0, 3.4, 0]);
    const g = mgrid([[1, 2], [3, 1]], -1.0, 5.6, 0, { color: () => COL.a }); tag('A', 'ptr', -0.6, 6.3);
    say('r = m = n：方陣、滿秩', '[1 2; 3 1] → R = I，可逆');
    await beat(tok, 2200);
    g.setAll([[1, 0], [0, 1]]); g.row(0, GREEN); g.row(1, GREEN);
    say('R = I：N(A) = {0}，b 沒有任何條件', '每個 b 恰好一個解');
    await beat(tok, 2600);
    g.c.flat().forEach((m) => fly(m));
    const cases = [
      ['r = m = n', 'R = I', '恰 1 個解', -4.2, 4.6, COL.d],
      ['r = n < m', 'R = [I; 0]', '0 或 1 個解', 4.2, 4.6, COL.a],
      ['r = m < n', 'R = [I F]', '∞ 個解', -4.2, 2.0, COL.b],
      ['r < m, r < n', 'R = [I F; 0 0]', '0 或 ∞ 個解', 4.2, 2.0, COL.c],
    ];
    for (const [c, r, a, x, y, col] of cases) {
      cube('', col, [3.4, 1.9, 0.25], x, y, -0.3, 3);
      tag(c, 'ptr', x, y + 0.55, 0.1); mono(tag(r, '', x, y, 0.1)); tag(a, 'ptr alt', x, y - 0.55, 0.1);
      say(c + '：' + r, a);
      await beat(tok, 1900);
    }
    say('rank 決定解的個數', 'r = m ⇒ 一定有解；r = n ⇒ 最多一解');
    await beat(tok, 3400);
  }

  // ─── 2IdtqGM6KWU（MIT 18.06 L11）：矩陣空間、rank 1、子空間維度 ───
  function grid3(x0, y0, color) { return mgrid([[0, 0, 0], [0, 0, 0], [0, 0, 0]], x0, y0, 0, { color: () => color || '#e7dcc8' }); }
  async function scMatrixSpace(tok) {
    fresh([0, 3.4, 11], [0, 3.6, 0]);
    const g = grid3(-0.78, 4.6);
    tag('M = 所有 3×3 矩陣', 'ptr', 0, 5.6);
    say('「向量」不一定是一排數字', '3×3 矩陣可以相加、乘常數 → 也是向量空間');
    await beat(tok, 2600);
    const cnt = tag('', 'ptr alt', 3.2, 3.8);
    for (let k = 0; k < 9; k++) {
      const i = Math.floor(k / 3), j = k % 3;
      g.set(i, j, 1); tint(g.c[i][j], COL.a); g.c[i][j].position.z = 0.25;
      txt(cnt, '基底矩陣 ' + (k + 1));
      say('標準基底：只有一格是 1', 'E' + (i + 1) + (j + 1));
      await beat(tok, 650);
      g.set(i, j, 0); tint(g.c[i][j], '#e7dcc8'); g.c[i][j].position.z = 0;
    }
    txt(cnt, 'dim M = 9');
    say('共 9 個基底 → dim M = 9', '就像 R⁹，只是 9 個數排成方形');
    await beat(tok, 3000);
  }
  async function scSymUpper(tok) {
    fresh([0, 3.4, 13], [0, 3.4, 0]);
    const S = grid3(-5.4, 5.2), U = grid3(-0.78, 5.2), D = grid3(3.84, 5.2);
    tag('S：對稱', 'ptr', -4.6, 6.0); tag('U：上三角', 'ptr', 0, 6.0); tag('S ∩ U', 'ptr', 4.6, 6.0);
    const sl = tag('', 'ptr alt', -4.6, 2.4), ul = tag('', 'ptr alt', 0, 2.4), dl = tag('', 'ptr alt', 4.6, 2.4);
    say('子空間：對稱矩陣 S、上三角矩陣 U', '相加還是對稱 / 上三角（這裡不做矩陣相乘）');
    await beat(tok, 2600);
    const pairs = [[[0, 0]], [[1, 1]], [[2, 2]], [[0, 1], [1, 0]], [[0, 2], [2, 0]], [[1, 2], [2, 1]]];
    for (let k = 0; k < pairs.length; k++) { pairs[k].forEach(([i, j]) => { tint(S.c[i][j], COL.a); S.set(i, j, 'a' + (k + 1)); }); txt(sl, 'dim S = ' + (k + 1)); await beat(tok, 520); }
    say('對稱：對角 3 個 + 上半 3 個', 'dim S = 6（下半由上半決定）');
    await beat(tok, 2000);
    let c = 0;
    for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) { tint(U.c[i][j], COL.b); U.set(i, j, '*'); txt(ul, 'dim U = ' + ++c); await beat(tok, 420); }
    say('上三角：dim U = 6', '標準基底裡剛好有 6 個在 U 裡');
    await beat(tok, 2000);
    for (let i = 0; i < 3; i++) { tint(D.c[i][i], COL.d); D.set(i, i, '*'); }
    txt(dl, 'dim = 3');
    say('既對稱又上三角 = 對角矩陣', 'S ∩ U = D，dim 3');
    await beat(tok, 2400);
    say('S ∪ U 不是子空間：要「相加」才封閉', 'S + U = { s + u }');
    await beat(tok, 2200);
    D.c.flat().forEach((m) => { tint(m, COL.g); relabel(m, '*'); }); txt(dl, 'S + U = M：dim 9');
    say('對稱 + 上三角 → 任何 3×3 矩陣都湊得出', 'S + U = M');
    await beat(tok, 2400);
    say('dim S + dim U = dim(S ∩ U) + dim(S + U)', '6 + 6 = 3 + 9');
    await beat(tok, 3200);
  }
  async function scOde(tok) {
    fresh([0, 3.2, 12.5], [0, 3.2, 0]);
    const X0 = -5.6, sx = 11.2 / (2 * Math.PI), Y0 = 3.2, sy = 1.3;
    const curve = (f, color) => { const pts = []; for (let k = 0; k <= 120; k++) { const x = k / 120 * 2 * Math.PI; pts.push(V3(X0 + x * sx, Y0 + f(x) * sy, 0)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; };
    rod('#a8987f', 0.015).setW(V3(X0, Y0, 0), V3(X0 + 11.4, Y0, 0)); tag('x', 'idx', X0 + 11.6, Y0);
    say('另一種向量空間：微分方程的解', 'y″ + y = 0');
    await beat(tok, 2200);
    curve(Math.cos, COL.a); tag('cos x', 'ptr', X0 + 0.3, Y0 + sy + 0.4);
    say('y = cos x 是解', '');
    await beat(tok, 1500);
    curve(Math.sin, COL.b); tag('sin x', 'ptr alt', X0 + sx * Math.PI / 2, Y0 + sy + 0.4);
    say('y = sin x 也是解', '');
    await beat(tok, 1500);
    let c1 = 1, c2 = 0;
    const comb = curve((x) => c1 * Math.cos(x) + c2 * Math.sin(x), COL.g);
    const cl = tag('', 'ptr', 4.3, 5.6);
    say('所有解 = c₁ cos x + c₂ sin x', '這是 null space：解的空間');
    for (const [a, b] of [[0.5, 1], [-1, 0.6], [1.2, -0.8], [0.7, 0.7]]) {
      const a0 = c1, b0 = c2;
      await tw(tok, 800, (t) => { c1 = a0 + (a - a0) * t; c2 = b0 + (b - b0) * t; const pts = []; for (let k = 0; k <= 120; k++) { const x = k / 120 * 2 * Math.PI; pts.push(V3(X0 + x * sx, Y0 + (c1 * Math.cos(x) + c2 * Math.sin(x)) * sy, 0)); } comb.geometry.setFromPoints(pts); txt(cl, 'c₁ = ' + c1.toFixed(1) + '、c₂ = ' + c2.toFixed(1)); });
      await beat(tok, 700);
    }
    say('基底 {cos x, sin x}，dimension = 2', '二階方程 → 2 維；e^{ix}、e^{−ix} 也是一組基底');
    await beat(tok, 3200);
  }
  async function scRankOne(tok) {
    fresh([0, 3.4, 12], [0, 3.6, 0]);
    const v = [1, 4, 5], u = [1, 2];
    say('rank 1 矩陣：第 2 列是第 1 列的倍數', '[1 4 5; 2 8 10]');
    const A = mgrid([[1, 4, 5], [2, 8, 10]], -5.4, 4.8, 0, { color: () => COL.a });
    await beat(tok, 2200);
    say('row space 基底：(1, 4, 5)；column space 基底：(1, 2)', 'dim C(A) = dim C(Aᵀ) = r = 1');
    A.row(0, GOLD); await beat(tok, 1400); A.clearGlow(); A.col(0, GOLD); await beat(tok, 1400); A.clearGlow();
    const vr = v.map((x, j) => cube(x, COL.b, [0.62, 0.62, 0.3], 0.8 + j * 0.78, 5.8, 0, 2)), uc = u.map((x, i) => cube(x, COL.c, [0.62, 0.62, 0.3], 0, 4.8 - i * 0.78, 0, 2));
    tag('vᵀ', 'ptr alt', 3.4, 5.8); tag('u', 'ptr alt', -0.6, 3.5);
    say('A = u vᵀ：一欄 × 一列', '(2×1)(1×3) = 2×3');
    await beat(tok, 1600);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      glow(uc[i], GOLD); glow(vr[j], GOLD);
      cube(u[i] * v[j], COL.g, [0.62, 0.62, 0.3], 0.8 + j * 0.78, 4.8 - i * 0.78, 0, 1.6);
      await beat(tok, 450); glow(uc[i], null); glow(vr[j], null);
    }
    say('每個 rank 1 矩陣都長這樣：u vᵀ', 'rank 1 是組成所有矩陣的積木');
    await beat(tok, 2600);
    say('5×17、rank 4 的矩陣 = 4 個 rank 1 相加', '');
    await beat(tok, 2200);
    const B = mgrid([[0, 0, 1], [0, 0, 0]], 4.0, 4.8, 0, { color: () => COL.c }); tag('+', 'val', 3.4, 4.4); tag('rank 1', 'idx', 4.8, 3.2); tag('rank 1', 'idx', -4.6, 3.2);
    say('rank 1 + rank 1 通常是 rank 2', '<span class="no">rank 1 矩陣的集合不是子空間</span>（加法不封閉）');
    await beat(tok, 3400);
    void B;
  }
  async function scNullOnes(tok) {
    fresh([0, 3.4, 13], [0.3, 3.2, 0]);
    const g = mgrid([[1, 1, 1, 1]], -6.1, 5.6, 0, { color: () => COL.a }); tag('A = [1 1 1 1]', 'ptr', -4.9, 6.3);
    say('S = { v ∈ R⁴：v₁ + v₂ + v₃ + v₄ = 0 }', '它是子空間嗎？維度多少？');
    await beat(tok, 2600);
    say('S 就是 N(A)：A = [1 1 1 1]', 'A v = v₁ + v₂ + v₃ + v₄ = 0');
    g.row(0, GOLD); await beat(tok, 2200); g.clearGlow();
    say('rank r = 1，n = 4', 'dim N(A) = n − r = 3');
    await beat(tok, 2000);
    const sp3 = [[-1, 1, 0, 0], [-1, 0, 1, 0], [-1, 0, 0, 1]];
    for (let k = 0; k < 3; k++) {
      const B = bars([0, 0, 0, 0], -1.4 + k * 2.2, 3.0, 0, [COL.b, COL.c, COL.d][k], { k: 0.8 });
      await tw(tok, 700, (t) => B.set(scl(sp3[k], t)));
      tag('s' + (k + 1), 'ptr alt', B.mid, 4.3);
      say('special solution ' + (k + 1) + '：自由變數 x' + (k + 2) + ' = 1', 'pivot 變數 x₁ = −1，加起來 = 0');
      await beat(tok, 1500);
    }
    const dims = [['C(Aᵀ)', 1, COL.a], ['N(A)', 3, COL.r], ['C(A)', 1, COL.d], ['N(Aᵀ)', 0, COL.c]];
    say('四個子空間的維度', 'row 1 + null 3 = 4 = n；col 1 + left null 0 = 1 = m');
    for (let k = 0; k < 4; k++) {
      const [nm, d, col] = dims[k], x = -5.8 + k * 1.2;
      if (d) cube(d, col, [0.7, d * 0.55, 0.7], x, 0.3 + d * 0.275, 1.6, 2);
      tag(nm + '：' + d, 'idx', x, 0.1, 2.3);
      await beat(tok, 700);
    }
    await beat(tok, 2200);
    say('零空間 {0} 的維度是 0', '它的基底是空集合');
    await beat(tok, 2600);
  }

  // ─── 6-wh6yvk6uc（MIT 18.06 L12）：圖、incidence matrix、KCL、Euler ───
  const NODES = [[-5.2, 3.0], [-3.2, 5.0], [-1.2, 3.0], [-3.2, 1.0]];
  const EDGES = [[0, 1], [1, 2], [0, 2], [0, 3], [2, 3]];
  const INC = EDGES.map(([s, t]) => { const r = [0, 0, 0, 0]; r[s] = -1; r[t] = 1; return r; });
  function drawG(nodes = NODES, edges = EDGES, opt = {}) {
    const nb = nodes.map((p, k) => { const b = dotBall(COL.a, 0.3); b.position.set(p[0], p[1], 0); b.add(lab.label(String(k + 1), 'val')); return b; });
    const ea = edges.map(([s, t], i) => {
      const a = arrow('#8a7b66', 0.045), p = V3(nodes[s][0], nodes[s][1], 0), q = V3(nodes[t][0], nodes[t][1], 0), d = q.clone().sub(p).normalize();
      a.setW(p.clone().addScaledVector(d, 0.36), q.clone().addScaledVector(d, -0.36));
      const mid = p.clone().add(q).multiplyScalar(0.5), nrm = V3(-d.y, d.x, 0).multiplyScalar(0.32);
      if (!opt.noEdgeLabel) a.el = tag((opt.edgeName || 'e') + (i + 1), 'idx', mid.x + nrm.x, mid.y + nrm.y, 0.2);
      a.p = p; a.q = q; return a;
    });
    return { nb, ea };
  }
  async function scIncidence(tok) {
    fresh([0, 3.2, 13], [-0.6, 3.1, 0]);
    say('圖（graph）= 節點 + 邊', 'n = 4 個節點、m = 5 條邊，每條邊給一個方向');
    const G = drawG();
    await beat(tok, 2600);
    const g = mgrid(INC.map((r) => r.map(() => '')), 0.9, 5.2, 0, { color: () => '#e7dcc8' });
    ['節1', '節2', '節3', '節4'].forEach((n, j) => tag(n, 'idx', g.xs[j], 5.85));
    for (let i = 0; i < 5; i++) {
      tag('e' + (i + 1), 'idx', 0.25, g.y(i));
      G.ea[i].glow(GOLD);
      INC[i].forEach((v, j) => { g.set(i, j, v); if (v) tint(g.c[i][j], v > 0 ? COL.d : COL.b); });
      say('邊 ' + (i + 1) + '：從節點 ' + (EDGES[i][0] + 1) + ' 到 ' + (EDGES[i][1] + 1), '起點 −1、終點 +1');
      await beat(tok, 1300);
      G.ea[i].glow(null);
    }
    say('incidence matrix A：5×4，每列只有兩個非零', '很 sparse，非零個數 = 2m');
    await beat(tok, 2400);
    [0, 1, 2].forEach((i) => { G.ea[i].glow(GOLD); g.row(i, GOLD); });
    say('邊 1、2、3 圍成一個迴圈（loop）', '列 1 + 列 2 = 列 3 → 這三列相依');
    await beat(tok, 3200);
    g.clearGlow(); [0, 1, 2].forEach((i) => G.ea[i].glow(null));
    say('迴圈 ↔ 相依的列', '');
    await beat(tok, 2000);
  }
  async function scPotentials(tok) {
    fresh([0, 3.2, 13], [-0.4, 3.1, 0]);
    const G = drawG();
    const xl = NODES.map((p) => tag('', 'ptr alt', p[0], p[1] + 0.62, 0.3));
    const dl = EDGES.map(([s, t]) => { const mid = V3((NODES[s][0] + NODES[t][0]) / 2, (NODES[s][1] + NODES[t][1]) / 2, 0.4); return tag('', 'ptr', mid.x, mid.y - 0.05, mid.z); });
    const eq = ['x₂ − x₁', 'x₃ − x₂', 'x₃ − x₁', 'x₄ − x₁', 'x₄ − x₃'];
    const pan = eq.map((e, i) => mono(tag('e' + (i + 1) + '：' + e, '', 2.2, 5.0 - i * 0.55)));
    tag('Ax =', 'ptr', 0.6, 5.0);
    const show = (x) => { x.forEach((v, k) => txt(xl[k], 'x' + (k + 1) + ' = ' + v)); EDGES.forEach(([s, t], i) => { const d = x[t] - x[s]; txt(dl[i], String(d)); G.ea[i].glow(d ? GOLD : null); }); };
    say('x = 節點上的電位（potential）', 'Ax = 每條邊兩端的電位差');
    show([0, 1, 3, 2]); pan.forEach((l) => (l.element.className = 'lab-label'));
    await beat(tok, 3200);
    say('什麼 x 讓所有電位差都是 0？', 'Ax = 0 → 找 null space');
    await beat(tok, 2000);
    for (const c of [1, 2, 5]) { show([c, c, c, c]); say('x = (' + [c, c, c, c].join(', ') + ')：電位全一樣', '差全是 0 → 不會有電流'); await beat(tok, 1500); }
    say('N(A) = { c·(1, 1, 1, 1) }，dim 1', '電位只決定到「差一個常數」');
    await beat(tok, 2600);
    show([3, 1, 2, 0]); glow(G.nb[3], GREEN);
    say('接地（ground）：令 x₄ = 0', '拿掉第 4 欄，剩下 3 欄獨立');
    await beat(tok, 2600);
    say('rank = n − 1 = 3', '任何 3 個電位都是好的未知數');
    await beat(tok, 2800);
  }
  async function scKcl(tok) {
    fresh([0, 3.2, 13], [-0.4, 3.1, 0]);
    const G = drawG(NODES, EDGES, { edgeName: 'y' });
    const lines = ['節1：−y₁ − y₃ − y₄ = 0', '節2：y₁ − y₂ = 0', '節3：y₂ + y₃ − y₅ = 0', '節4：y₄ + y₅ = 0'];
    tag('Aᵀy = 0（KCL）', 'ptr', 2.6, 5.4);
    const L = lines.map((s, i) => mono(tag(s, '', 2.6, 4.7 - i * 0.55)));
    say('y = 每條邊上的電流', 'Aᵀy = 0：Kirchhoff 電流定律（KCL）');
    await beat(tok, 2600);
    for (let k = 0; k < 4; k++) { L[k].element.className = 'lab-label ptr alt'; glow(G.nb[k], GOLD); say('每個節點：流進 = 流出', lines[k]); await beat(tok, 1300); L[k].element.className = 'lab-label'; glow(G.nb[k], null); }
    say('dim N(Aᵀ) = m − r = 5 − 3 = 2', '要找兩個獨立的電流解');
    await beat(tok, 2400);
    const dots = [];
    const runLoop = async (path, cap, f, color) => {
      // path: [[edgeIndex, dir]]
      dots.forEach((d) => (d.visible = false));
      const ds = path.map(() => dotBall(color, 0.14));
      dots.push(...ds);
      path.forEach(([e]) => G.ea[e].glow(GOLD));
      say(cap, f);
      for (let rep = 0; rep < 2; rep++) {
        await tw(tok, 1500, (t) => path.forEach(([e, dir], i) => { const a = G.ea[e], s = dir > 0 ? a.p : a.q, q = dir > 0 ? a.q : a.p; ds[i].position.copy(s).lerp(q, t); }));
      }
      path.forEach(([e]) => G.ea[e].glow(null));
    };
    await runLoop([[0, 1], [1, 1], [2, -1]], '1 安培繞迴圈 1-2-3', 'y = (1, 1, −1, 0, 0)', COL.r);
    await runLoop([[2, 1], [4, 1], [3, -1]], '再繞迴圈 1-3-4', 'y = (0, 0, 1, −1, 1)', COL.d);
    await runLoop([[0, 1], [1, 1], [4, 1], [3, -1]], '外圈 = 前兩個相加（邊 3 抵消）', 'y = (1, 1, 0, −1, 1)：不獨立', COL.c);
    say('N(Aᵀ) 的基底 = 兩個獨立小迴圈', '任何沿迴圈的電流都滿足 KCL');
    await beat(tok, 3000);
  }
  async function scTree(tok) {
    fresh([0, 3.2, 13], [-0.4, 3.1, 0]);
    const G = drawG();
    say('row space 的維度 = rank = 3', 'A 的 5 列裡只有 3 列獨立');
    await beat(tok, 2400);
    say('Aᵀ 的 pivot 欄 = 邊 1、2、4', '邊 3 = 邊 1 + 邊 2（來自迴圈），所以不是 pivot');
    [0, 1, 3].forEach((i) => { G.ea[i].color(COL.g); G.ea[i].glow(GREEN); });
    [2, 4].forEach((i) => G.ea[i].color('#ddd2c0'));
    await beat(tok, 3000);
    say('邊 1、2、4：連到全部 4 個節點、沒有迴圈', '這叫做樹（tree）');
    await beat(tok, 2600);
    G.ea[2].color(COL.r); G.ea[2].glow(RED);
    say('再加任何一條邊就會出現迴圈', '獨立的邊 ↔ 沒有迴圈');
    await beat(tok, 3000);
  }
  async function scEuler(tok) {
    fresh([0, 3.2, 13], [-0.4, 3.1, 0]);
    drawG();
    const f = tag('', 'ptr alt', 2.6, 4.6);
    say('dim N(Aᵀ) = m − r，而 r = n − 1', '迴圈數 = 邊 − (節點 − 1)');
    await beat(tok, 2600);
    say('節點 − 邊 + 迴圈 = 1', 'Euler 公式：線性代數證出來的拓樸事實');
    txt(f, '4 − 5 + 2 = 1');
    await beat(tok, 3000);
    lab.clear();
    const P = [0, 1, 2, 3, 4].map((k) => { const a = (90 + k * 72) * Math.PI / 180; return [-3.2 + 2.1 * Math.cos(a), 3.0 + 2.0 * Math.sin(a)]; });
    const E2 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [0, 3]];
    drawG(P, E2, { noEdgeLabel: true });
    const f2 = tag('', 'ptr alt', 2.6, 4.6);
    say('另一個圖：5 個節點', '');
    await beat(tok, 1600);
    txt(f2, '節點 5');
    await beat(tok, 900);
    say('7 條邊、3 個迴圈', '');
    txt(f2, '5 − 7 + 3 = 1');
    await beat(tok, 2600);
    say('每個連通圖都成立', '節點（0 維）− 邊（1 維）+ 迴圈（2 維）= 1');
    await beat(tok, 3000);
  }
  async function scAtca(tok) {
    fresh([0, 3.4, 12], [0, 3.4, 0]);
    const box = (t, x, y, col) => { cube('', col, [2.2, 1.0, 0.4], x, y, 0, 2); tag(t, 'ptr', x, y, 0.3); };
    const ar = (x1, y1, x2, y2, t) => { const a = arrow('#8a7b66', 0.05); a.setW(V3(x1, y1, 0), V3(x2, y2, 0)); tag(t, 'ptr alt', (x1 + x2) / 2, (y1 + y2) / 2 + 0.45, 0.2); };
    say('應用數學最基本的三步', '電位 x → 電位差 e → 電流 y → 外加電流 f');
    box('x：節點電位', -4.2, 5.0, COL.a); await beat(tok, 900);
    ar(-3.0, 5.0, 2.9, 5.0, 'e = Ax'); box('e：電位差', 4.2, 5.0, COL.b);
    say('e = Ax', 'A 算出每條邊的電位差');
    await beat(tok, 1800);
    ar(4.2, 4.4, 4.2, 2.2, 'y = Ce'); box('y：邊上電流', 4.2, 1.6, COL.c);
    say('y = Ce：Ohm 定律', 'C = 電導（1 / 電阻）');
    await beat(tok, 1800);
    ar(2.9, 1.6, -2.9, 1.6, 'Aᵀy = f'); box('f：外加電流', -4.2, 1.6, COL.d);
    say('Aᵀy = f：KCL（平衡方程式）', '沒有外加電流時 f = 0');
    await beat(tok, 2000);
    mono(tag('AᵀC A x = f', 'ptr', 0, 3.3, 0.3));
    say('三步合起來：AᵀCAx = f', '平衡狀態的網路方程式');
    await beat(tok, 2400);
    say('AᵀA 一定是對稱矩陣', '(AᵀA)ᵀ = AᵀA');
    await beat(tok, 3000);
  }

  // ─── 課本補充（影片沒有逐字稿的部分）───
  async function scSpan3d(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(30, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const u = [1.4, 0.3, 0.5], v = [-0.4, 1.3, 0.7], w = [0.3, -0.5, 1.4];
    const au = S.arrow(u, COL.a, 'u');
    say('span{u}：u 的所有倍數 cu', '一個向量 → 一條過原點的線');
    const L = S.line(u, COL.a, 0.01);
    await tw(tok, 1200, (t) => S.setLine(L, u, 0.01 + 2.6 * t));
    const m = arrow(COL.g); m.tag('cu');
    for (const c of [1.6, -1.2, 0.5]) { await tw(tok, 500, () => S.set(m, scl(u, c))); await beat(tok, 300); }
    m.visible = false; showL(m.lbl, false);
    await beat(tok, 700);
    const av = S.arrow(v, COL.b, 'v');
    say('span{u, v}：所有 c₁u + c₂v', '兩個不同方向 → 一個平面');
    const P = S.plane(u, v, COL.b, 0); await tw(tok, 900, (t) => P.fade(0.22 * t));
    const m2 = arrow(COL.g); m2.tag('c₁u + c₂v');
    for (const [a, b] of [[1, 1], [-1, 0.5], [0.6, -1.2]]) { await tw(tok, 600, () => S.set(m2, addv(scl(u, a), scl(v, b)))); await beat(tok, 350); }
    m2.visible = false; showL(m2.lbl, false);
    await beat(tok, 700);
    const aw = S.arrow(w, COL.c, 'w');
    say('第三個向量不在平面上', 'span{u, v, w} = 整個 R³');
    const B = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ color: COL.c, transparent: true, opacity: 0, depthWrite: false }));
    B.position.copy(S.w([0, 0, 0])); lab.world.add(B);
    await tw(tok, 1000, (t) => (B.material.opacity = 0.08 * t));
    await orbit(tok, 2600, 30, 80, 22, 10.5, [0, 2.4, 0]);
    say('span 一定過原點：線、平面或整個空間', '（課本補充：3Blue1Brown 的 span 觀念）');
    await beat(tok, 2600);
    void au; void av; void aw;
  }
  async function scIndependence(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(40, 18, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    const u = [1.4, 0.3, 0.5], v = [-0.4, 1.3, 0.7];
    S.arrow(u, COL.a, 'u'); S.arrow(v, COL.b, 'v');
    S.plane(u, v, COL.b, 0.2);
    const w = S.arrow([0.3, -0.5, 1.6], COL.c, 'w');
    say('w 不在 u、v 的平面上 → 三個獨立', 'c₁u + c₂v + c₃w = 0 只有全 0 的解');
    await beat(tok, 2800);
    const wt = addv(scl(u, 0.6), scl(v, 0.9));
    say('把 w 移到平面上…', '');
    await tw(tok, 1600, (t) => S.set(w, addv(scl([0.3, -0.5, 1.6], 1 - t), scl(wt, t))));
    w.glow(RED);
    say('w = 0.6u + 0.9v：落在平面上', '<span class="no">線性相依</span>：0.6u + 0.9v − w = 0');
    await beat(tok, 2800);
    const g1 = arrow(COL.a), g2 = arrow(COL.b);
    await tw(tok, 900, (t) => S.set(g1, scl(u, 0.6 * t)));
    await tw(tok, 900, (t) => S.set(g2, scl(v, 0.9 * t), scl(u, 0.6)));
    say('w 沒有帶來新方向 → span 還是平面', '相依 ⇔ 某個向量是其他的組合');
    await orbit(tok, 2600, 40, 95, 4, 10.5, [0, 2.4, 0]);
    say('從側面看：三個向量都躺在同一個平面', 'R³ 裡 3 個向量獨立 ⇔ 矩陣可逆（det ≠ 0）');
    await beat(tok, 3000);
  }
  async function scBasisDim(tok) {
    fresh([0, 0, 0], [0, 2.4, 0]); cam(28, 22, 10.5, [0, 2.4, 0]);
    const S = space3(0, 2.6, 0, 1, 2.5);
    say('基底（basis）：獨立 + 能張成整個空間', '');
    const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v, i) => S.arrow(v, [COL.a, COL.b, COL.c][i], ['e₁', 'e₂', 'e₃'][i]));
    await beat(tok, 2200);
    const x = [1.5, 1.0, 1.8], ax = S.arrow(x, COL.g, 'x');
    say('x = 1.5e₁ + 1e₂ + 1.8e₃', '每個向量的組合方式唯一');
    await beat(tok, 2600);
    const nb = [[1.2, 0.4, 0], [-0.3, 1.1, 0.5], [0.2, -0.3, 1.2]];
    say('換一組獨立的三個向量：也是基底', 'R³ 的基底有無限多組');
    await tw(tok, 1400, (t) => e.forEach((a, i) => S.set(a, addv(scl([[1, 0, 0], [0, 1, 0], [0, 0, 1]][i], 1 - t), scl(nb[i], t)))));
    e.forEach((a, i) => a.tag(['b₁', 'b₂', 'b₃'][i]));
    await beat(tok, 2200);
    say('但每組基底都恰好 3 個向量', 'dimension = 基底向量的個數：dim R³ = 3');
    await beat(tok, 2600);
    e[2].visible = false; showL(e[2].lbl, false);
    S.plane(nb[0], nb[1], COL.a, 0.18);
    say('只剩 2 個：張不滿 R³，只張成平面', '少了不夠張成；多了一定相依');
    await beat(tok, 3000);
    void ax;
  }
  async function scFourSub(tok) {
    fresh([0, 6.5, 13.5], [0, 2.4, 0]);
    const A = [[1, 2, 3], [2, 4, 6], [1, 1, 1]];
    const L = space3(-3.5, 2.5, 0, 0.62, 2.1, ['x₁', 'x₂', 'x₃'], 'Rⁿ（n = 3）');
    const R = space3(3.5, 2.5, 0, 0.62, 2.1, ['b₁', 'b₂', 'b₃'], 'Rᵐ（m = 3）');
    say('A = [1 2 3; 2 4 6; 1 1 1]，rank r = 2', '四個子空間：兩個在 Rⁿ、兩個在 Rᵐ');
    await beat(tok, 2600);
    const rp = L.plane([1, 2, 3], [1, 1, 1], COL.a, 0); await tw(tok, 700, (t) => rp.fade(0.24 * t));
    say('row space C(Aᵀ)：列的組合，dim r = 2', '');
    await beat(tok, 1800);
    L.line([-1, 2, -1], COL.r, 3.2, [0, 0, 0], 0.045);
    say('null space N(A)：dim n − r = 1', '(−1, 2, −1) 跟每一列內積都是 0 → 垂直');
    await beat(tok, 2600);
    const cp = R.plane([1, 2, 1], [2, 4, 1], COL.d, 0); await tw(tok, 700, (t) => cp.fade(0.24 * t));
    say('column space C(A)：dim r = 2', '');
    await beat(tok, 1800);
    R.line([-2, 1, 0], COL.c, 3.2, [0, 0, 0], 0.045);
    say('left null space N(Aᵀ)：dim m − r = 1', '(−2, 1, 0) ⊥ 每一欄');
    await beat(tok, 2600);
    const x = [1, 1, 1], b = mulMV(A, x);
    const ax = L.arrow(x, COL.k, 'x');
    const ab = R.arrow([0, 0, 0], COL.g, 'Ax');
    await tw(tok, 1200, (t) => R.set(ab, scl(b, t * 0.5)));
    ab.tag('Ax（縮小 1/2）');
    say('任何 x 送過去，Ax 一定落在 column space', 'null space 的部分被壓成 0');
    await beat(tok, 2800);
    say('dim：r + (n − r) = n，r + (m − r) = m', '2 + 1 = 3；2 + 1 = 3');
    await beat(tok, 3000);
    void ax;
  }
  async function scRankNullity(tok) {
    fresh([0, 3.3, 12.5], [0.4, 3.6, 0]);
    const g = mgrid(A8, -3.2, 5.4, 0); A8[0].forEach((_, j) => tag('x' + (j + 1), 'idx', g.xs[j], 6.1));
    say('A（3×4）消去成 R', 'rank = pivot 的個數');
    await beat(tok, 2000);
    const E = rrefSteps(A8);
    for (const s of E.steps) { g.clearGlow(); g.setAll(s.A); if (s.row >= 0) g.row(s.row, GOLD); say(s.text, ''); await beat(tok, 1100); }
    g.clearGlow();
    g.paintCol(0, COL.a); g.paintCol(2, COL.a); g.paintCol(1, COL.b); g.paintCol(3, COL.b);
    say('pivot 欄 2 個（藍）、自由欄 2 個（橘）', 'rank r = 2，nullity = 2');
    await beat(tok, 2600);
    const N = nullBasis(E.R, E.piv, 4);
    N.forEach((x, k) => x.forEach((v, i) => cube(fmt(v), COL.b, [0.62, 0.62, 0.3], 2.4 + k * 1.0, 5.4 - i * 0.78, 0, 2)));
    tag('s₁', 'ptr alt', 2.4, 6.1); tag('s₂', 'ptr alt', 3.4, 6.1);
    say('每個自由變數給一個 special solution', 'N(A) 的基底：(−2, 1, 0, 0)、(2, 0, −2, 1)');
    await beat(tok, 2800);
    say('Rank-Nullity：r + dim N(A) = n', '2 + 2 = 4（欄數）');
    await beat(tok, 3200);
  }
  async function scChangeBasis(tok) {
    fresh([0, 11, 7.5], [0, 0, -0.4]);
    const s = 0.8, w = (p) => V3(p[0] * s, 0.06, -p[1] * s);
    const gridL = (b1, b2, color, op, n) => { const pts = []; for (let k = -n; k <= n; k++) { pts.push(w(addv(scl(b1, k), scl(b2, -n))), w(addv(scl(b1, k), scl(b2, n))), w(addv(scl(b2, k), scl(b1, -n))), w(addv(scl(b2, k), scl(b1, n)))); } const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); lab.world.add(l); return l; };
    gridL([1, 0], [0, 1], '#b9ad99', 0.6, 6);
    const a = (v, c, t) => { const r = arrow(c, 0.06); r.tag(t); r.setW(w([0, 0]), w(v)); return r; };
    a([1, 0], COL.a, 'î'); a([0, 1], COL.a, 'ĵ');
    say('同一個向量，換一組基底，座標就不同', '標準基底 î、ĵ');
    await beat(tok, 2200);
    const v = a([-4, 1], COL.g, 'v');
    say('標準座標：v = (−4, 1)', '−4 î + 1 ĵ');
    await beat(tok, 2200);
    const ng = gridL([2, 1], [-1, 1], COL.b, 0.0, 2);
    await tw(tok, 900, (t) => (ng.material.opacity = 0.75 * t));
    a([2, 1], COL.b, 'b₁ = (2, 1)'); a([-1, 1], COL.b, 'b₂ = (−1, 1)');
    say('新基底 b₁ = (2, 1)、b₂ = (−1, 1)', '新的格子');
    await beat(tok, 2400);
    const p1 = arrow(COL.c, 0.07), p2 = arrow(COL.r, 0.07);
    await tw(tok, 900, (t) => p1.setW(w([0, 0]), w(scl([2, 1], -1 * t))));
    await tw(tok, 900, (t) => p2.setW(w([-2, -1]), w(addv([-2, -1], scl([-1, 1], 2 * t)))));
    v.glow(GOLD);
    say('v = −1·b₁ + 2·b₂', '在新基底下的座標是 (−1, 2)');
    await beat(tok, 2600);
    say('換基底矩陣 B = [b₁ b₂]：B(−1, 2) = (−4, 1)', '新座標 → 標準座標乘 B；反過來乘 B⁻¹');
    await beat(tok, 3200);
  }
  async function scOpsTrap(tok) {
    fresh([0, 3.3, 12], [0, 3.6, 0]);
    const g = mgrid([[1, 2], [2, 4]], -4.6, 5.0, 0, { color: () => COL.a }); tag('A', 'ptr', -4.2, 5.8);
    say('地雷：列運算會改變 column space', 'A = [1 2; 2 4]');
    await beat(tok, 2400);
    const R = mgrid([[1, 2], [0, 0]], 0.6, 5.0, 0, { color: () => COL.b }); tag('R（列運算後）', 'ptr', 1.0, 5.8);
    say('R2 − 2R1 → R = [1 2; 0 0]', '');
    await beat(tok, 2000);
    const ca = bars([1, 2], -4.6, 1.2, 0, COL.a, { k: 0.6, gap: 0.6 }); tag('C(A)：(1, 2) 的倍數', 'idx', -4.3, 0.5);
    const cr = bars([1, 0], 0.6, 1.2, 0, COL.b, { k: 0.6, gap: 0.6 }); tag('C(R)：(1, 0) 的倍數', 'idx', 0.9, 0.5);
    say('C(A) 由 (1, 2) 張成；C(R) 由 (1, 0) 張成', '<span class="no">C(A) ≠ C(R)</span>');
    await beat(tok, 3000);
    g.col(0, GREEN);
    say('C(A) 的基底：回到「原矩陣 A」拿 pivot 欄', '列運算只用來找「哪幾欄」是 pivot');
    await beat(tok, 2800);
    R.row(0, GREEN);
    say('row space 不變：可以直接用 R 的非零列', 'C(Aᵀ) = C(Rᵀ)，N(A) = N(R)');
    await beat(tok, 3000);
    void ca; void cr;
  }

  const scenes = {
    'subspace-plane-line': { title: '子空間：過原點的平面與直線', play: scSubspace },
    'union-intersect': { title: 'P ∪ L 不是子空間，P ∩ L 是', play: scUnionIntersect },
    'colspace-def': { title: 'Column space：A 的欄的所有組合', play: scColspaceDef },
    'colspace-solvable': { title: 'Ax = b 有解 ⇔ b ∈ C(A)', play: scColspaceSolvable },
    'colspace-dependent': { title: '第 3 欄 = 第 1 欄 + 第 2 欄：C(A) 是 2 維', play: scColspaceDependent },
    'nullspace-line': { title: 'Null space：c(1, 1, −1) 是一條線', play: scNullspaceLine },
    'shifted-line': { title: 'Ax = b 的解：不過原點，不是子空間', play: scShiftedLine },
    'elim-augmented': { title: '增廣矩陣 [A | b] 消去：0 = b₃ − b₂ − b₁', play: scElimAug },
    'solvability': { title: '可解條件：b ∈ C(A)', play: scSolvability },
    'particular-solution': { title: '特解 x_p：自由變數設 0', play: scParticular },
    'complete-solution': { title: '完整解 x = x_p + x_n', play: scComplete },
    'full-column-rank': { title: 'r = n：N(A) = {0}，0 或 1 個解', play: scFullColumn },
    'full-row-rank': { title: 'r = m：R = [I F]，一定有解', play: scFullRow },
    'rank-cases': { title: 'rank 的四種情況與解的個數', play: scRankCases },
    'matrix-space': { title: '3×3 矩陣空間：dim 9', play: scMatrixSpace },
    'sym-upper': { title: '對稱 S、上三角 U：S ∩ U 與 S + U', play: scSymUpper },
    'ode-solutions': { title: 'y″ + y = 0 的解空間：cos x、sin x', play: scOde },
    'rank-one': { title: 'Rank 1 矩陣 = u vᵀ', play: scRankOne },
    'null-ones': { title: 'v₁ + v₂ + v₃ + v₄ = 0：N([1 1 1 1])', play: scNullOnes },
    'incidence-matrix': { title: '圖的 incidence matrix', play: scIncidence },
    'potentials': { title: 'Ax = 電位差；N(A) = 常數電位', play: scPotentials },
    'kcl-loops': { title: 'Aᵀy = 0：KCL 與迴圈電流', play: scKcl },
    'spanning-tree': { title: '獨立的邊 = 沒有迴圈的樹', play: scTree },
    'euler-formula': { title: 'Euler 公式：節點 − 邊 + 迴圈 = 1', play: scEuler },
    'atca': { title: 'e = Ax、y = Ce、Aᵀy = f', play: scAtca },
    'span-3d': { title: '（課本）span：線、平面、整個 R³', play: scSpan3d },
    'independence-3d': { title: '（課本）線性相依：w 落在平面上', play: scIndependence },
    'basis-dimension': { title: '（課本）基底與維度', play: scBasisDim },
    'four-subspaces': { title: '（課本）四個基本子空間與正交', play: scFourSub },
    'rank-nullity': { title: '（課本）Rank-Nullity：r + dim N(A) = n', play: scRankNullity },
    'change-of-basis-grid': { title: '（課本）換基底：同一向量、不同座標', play: scChangeBasis },
    'colspace-trap': { title: '（課本）地雷：C(A) 要用原矩陣的 pivot 欄', play: scOpsTrap },
  };

  return {
    kicker: '線性代數・第 4 章',
    title: '向量空間',
    color: 'var(--la)',
    modes: [
      { id: 'span', name: '張成與獨立', enter: enterSpan },
      { id: 'rref', name: 'RREF 與四個子空間', enter: enterRref },
      { id: 'four', name: '四個子空間 3D', enter: enterFour },
      { id: 'solve', name: 'Ax = b 完整解', enter: enterSolve },
      { id: 'graph', name: '圖與 incidence matrix', enter: enterGraph },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'span-3d', 'independence-3d', 'basis-dimension',
      'subspace-plane-line', 'union-intersect', 'colspace-def', 'colspace-solvable', 'colspace-dependent', 'nullspace-line', 'shifted-line',
      'rank-nullity', 'elim-augmented', 'solvability', 'particular-solution', 'complete-solution', 'full-column-rank', 'full-row-rank', 'rank-cases',
      'four-subspaces', 'colspace-trap',
      'matrix-space', 'sym-upper', 'ode-solutions', 'rank-one', 'null-ones',
      'incidence-matrix', 'potentials', 'kcl-loops', 'spanning-tree', 'euler-formula', 'atca',
      'change-of-basis-grid',
    ],
    stop() { gen++; },
  };
}
