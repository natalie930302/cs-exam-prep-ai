// 線性代數 第4章：向量空間（Subspace、Span、Basis、Dimension、四個基本子空間、Rank-Nullity）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 座標慣例：數學的 (x, y, z) 畫成 world (x, z, −y)：z 朝上、y 往畫面裡面。
import kit from './_kit.js';

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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ vsA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, showL, relabel, tint } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 4 章：MIT 18.06（Strang）L6 / L7 / L8 / L9 / L10 — cued scenes（vsA）───
// 所有矩陣、消去步驟、R、special solutions、rank、維度都用 la-4 的 rrefSteps / nullBasis / subspaces 在程式裡算，
// 再和老師黑板上的數字比對，畫面上顯示 ✓／✘。老師沒給數字、自己補的例子在畫面上標「示意」。
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
const ok = (b, x, y, t, z = 0) => (b ? good(t, x, y, z) : bad(t.replace(/✓/g, '✘'), x, y, z));
const sy = (t, x, y, z = 0) => tag('示意', 'note', x, y, z);
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const gone = (...os) => os.forEach((o) => {
  if (!o) return; if (Array.isArray(o)) return gone(...o);
  if (o.ls && typeof o.kill === 'function') return o.kill();
  if (o.c && Array.isArray(o.c)) return gone(o.c.flat());
  if (o.ms && o.ls) { gone(o.ms, o.ls); if (o.plank) kill(o.plank); return; }
  if (o.lbl) remove(o.lbl); if (o.edge) kill(o.edge);
  if (o.element) remove(o); else kill(o);
});
const isZ = (v) => v.every((x) => Math.abs(x) < 1e-9);
const same = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
const sameM = (A, B) => A.length === B.length && A.every((r, i) => same(r, B[i]));
const mulMM = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const rk = (M) => rrefSteps(M).rank;
const colOf = (A, j) => A.map((r) => r[j]);
const inSpan = (vecs, b) => rk(T(vecs)) === rk(T([...vecs, b]));
const vs = (v) => vstr(v);
const mstr = (M) => '[' + M.map((r) => r.map(fmt).join(' ')).join('; ') + ']';
// a scene = a list of step functions; each runs when the video reaches its cue.
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    fresh(...(o.cam || [[0, 3.4, 13.5], [0, 3.2, 0]]));
    if (o.view) cam(...o.view);
    const S = {};
    if (o.setup) await o.setup(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// bars that keep their own plank so gone() can clear them
function bar(vals, x0, base, z = 0, color = COL.a, o = {}) {
  const n0 = lab.world.children.length;
  const B = bars(vals, x0, base, z, color, o);
  B.plank = lab.world.children.slice(n0).find((c) => c.isMesh && c.material && c.material.type === 'MeshBasicMaterial');
  return B;
}
// grow an arrow from 0 to v (or from a point)
async function grow(tok, S, a, v, from, ms = 700) { await anim(tok, ms, (t) => S.set(a, scl(v, t), from)); }
const flash = async (tok, m, c = GOLD, n = 2) => { for (let i = 0; i < n; i++) { glow(m, c); await wt(tok, 220); glow(m, null); await wt(tok, 160); } glow(m, c); };

// ════════ 8o5Cmfpeo6g（L6）：子空間、column space、null space ════════
// 老師的矩陣 A = [1 1 2; 2 1 3; 3 1 4; 4 1 5]（la-4 的 A6），第 3 欄 = 第 1 欄 + 第 2 欄。
const C6 = T(A6);                              // 三個欄（R⁴ 的向量）
const N6 = subspaces(A6);                      // rank、null space 基底
const V6 = { cam: [[0, 4, 11], [0, 2.4, 0]], view: [30, 22, 11, [0, 2.4, 0]] };
const PU = [1, 0, 0.3], PV = [0, 1, 0.5], PN = cross(PU, PV);   // 平面 P：z = 0.3x + 0.5y
const LD = [-0.5, 0.6, 1];                                       // 直線 L 的方向
const onP = (x) => Math.abs(dot(x, PN)) < 1e-9;
const onL = (x) => norm(cross(x, LD)) < 1e-9;

scene('vsA-l6-subspace', 'L6：向量空間與子空間（平面 P、直線 L）', [
  async (tok, S) => {
    cap('向量空間：可以相加、可以乘常數', '先看整個 R³');
    S.v = S.S.arrow([0, 0, 0], COL.a, 'v'); S.w = S.S.arrow([0, 0, 0], COL.b, 'w');
    await anim(tok, 700, (t) => { S.S.set(S.v, scl(S.vv, t)); S.S.set(S.w, scl(S.ww, t)); });
  },
  async (tok, S) => {
    cap('任兩個向量相加：v + w 還在空間裡', '');
    S.w2 = S.S.arrow([0, 0, 0], COL.b); S.S.set(S.w2, S.ww, S.vv);
    S.sum = S.S.arrow([0, 0, 0], COL.g, 'v + w');
    await grow(tok, S.S, S.sum, addv(S.vv, S.ww));
  },
  async (tok, S) => {
    gone(S.w2, S.sum);
    cap('任一向量乘常數：c·v 還在空間裡', '例：c = −1.5');
    S.cv = S.S.arrow([0, 0, 0], COL.c, 'c·v');
    await grow(tok, S.S, S.cv, scl(S.vv, -1.5));
  },
  async (tok, S) => {
    gone(S.cv);
    cap('合起來：所有線性組合 c·v + d·w 都留在裡面', '');
    S.cb = S.S.arrow([0, 0, 0], COL.g, 'c·v + d·w');
    let cur = [0, 0, 0];
    for (const [c, d] of [[1, 1], [0.6, -1.2], [-1, 0.7]]) { const tgt = addv(scl(S.vv, c), scl(S.ww, d)), from = cur; await anim(tok, 650, (t) => S.S.set(S.cb, addv(from, scl(addv(tgt, scl(from, -1)), t)))); cur = tgt; }
  },
  async (tok, S) => {
    gone(S.cb);
    cap('整個 R³ 就是一個向量空間', '加、乘常數都不會跑出 R³');
    S.box = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ color: COL.g, transparent: true, opacity: 0, depthWrite: false }));
    S.box.position.copy(S.S.w([0, 0, 0])); lab.world.add(S.box);
    await anim(tok, 600, (t) => (S.box.material.opacity = 0.08 * t));
  },
  async (tok, S) => {
    gone(S.box, S.v, S.w);
    cap('subspace（子空間）：R³ 裡的一群向量', '自己也要是一個向量空間');
  },
  async (tok, S) => {
    cap('最簡單的例子：過原點的平面 P', '平面一直延伸，沒有邊界');
    S.P = S.S.plane(PU, PV, COL.a, 0); await anim(tok, 700, (t) => S.P.fade(0.22 * t));
    const p = S.S.w([2.3, 2.3, 1.85]); hd('平面 P', p.x, p.y, p.z);
  },
  async (tok, S) => {
    cap('P 上兩個向量相加：還在 P 上', '');
    const p1 = [1.2, -0.6, 0.06], p2 = [-0.3, 1.2, 0.51], s = addv(p1, p2);
    S.a = S.S.arrow(p1, COL.b, 'p₁'); S.b = S.S.arrow(p2, COL.c, 'p₂');
    S.s = S.S.arrow([0, 0, 0], COL.g, 'p₁ + p₂'); await grow(tok, S.S, S.s, s);
    S.k1 = ok(onP(p1) && onP(p2) && onP(s), -4.6, 6.2, 'p₁ + p₂ 在 P 上 ✓');
  },
  async (tok, S) => {
    gone(S.s, S.b);
    cap('P 上的向量乘 −2：還在 P 上', '');
    const p1 = [1.2, -0.6, 0.06];
    S.a.tag('−2·p₁');
    await anim(tok, 900, (t) => S.S.set(S.a, scl(p1, 1 - 3 * t)));
    S.k2 = ok(onP(scl(p1, -2)), -4.6, 5.6, '−2·p₁ 在 P 上 ✓');
  },
  async (tok, S) => {
    gone(S.a, S.k1, S.k2);
    cap('過原點的平面 P 是 R³ 的子空間', '');
    S.o = S.S.ball([0, 0, 0], COL.g, 0.15); await flash(tok, S.o, GOLD, 2);
  },
  async (tok, S) => {
    cap('過原點的直線 L 也是子空間', '');
    S.L = S.S.line(LD, COL.r, 0.01);
    await anim(tok, 900, (t) => S.S.setLine(S.L, LD, 0.01 + 2.0 * t));
    const p = S.S.w(scl(LD, 1.75)); hot('直線 L', p.x, p.y, p.z);
  },
  async (tok, S) => {
    cap('所有子空間都必須含零向量 0', '直線、平面都得穿過原點');
    await flash(tok, S.o, GOLD, 3);
  },
  async (tok, S) => {
    cap('精確地說：P、L 都是 R³ 的子空間', '');
    pl('P ⊂ R³、L ⊂ R³', -4.4, 6.0);
  },
], Object.assign({}, V6, { setup: async (tok, S) => { S.S = space3(0, 2.6, 0, 1, 2.5); S.vv = [1.4, -0.4, 0.3]; S.ww = [0.2, 1.3, 0.9]; } }));

scene('vsA-l6-union', 'L6：P ∪ L 不是子空間，交集一定是', [
  async (tok, S) => {
    cap('兩個子空間：平面 P、直線 L', '把它們放在一起看');
    await flash(tok, S.L, GOLD, 2);
  },
  async (tok, S) => {
    cap('P ∪ L：在 P 上或在 L 上的所有向量', '這個聯集是子空間嗎？');
    await anim(tok, 500, (t) => S.P.fade(0.2 + 0.1 * t));
  },
  async (tok, S) => {
    cap('大部分向量既不在 P 上、也不在 L 上', '聯集只拿了 P 和 L 上的');
    const q = [1.3, 1.1, -1.4];
    S.q = S.S.arrow(q, COL.gray, 'q'); S.qk = ok(!onP(q) && !onL(q), 3.2, 6.2, 'q ∉ P ∪ L ✓');
  },
  async (tok, S) => {
    gone(S.q, S.qk);
    cap('取 P 上一個 p、L 上一個 ℓ', '');
    S.pp = [1.5, 0.4, 0.65]; S.ll = scl(LD, 0.8);
    S.p = S.S.arrow(S.pp, COL.a, 'p ∈ P'); S.l = S.S.arrow(S.ll, COL.r, 'ℓ ∈ L');
    await wt(tok, 300);
  },
  async (tok, S) => {
    cap('相加：p + ℓ 跑到 P 和 L 外面', '加法不封閉');
    S.l2 = S.S.arrow([0, 0, 0], COL.r); await anim(tok, 700, (t) => S.S.set(S.l2, scl(S.ll, t), S.pp));
    const s = addv(S.pp, S.ll); S.s = S.S.arrow(s, COL.k, 'p + ℓ'); S.s.glow(RED);
    S.sk = ok(onP(S.pp) && onL(S.ll) && !onP(s) && !onL(s), 3.2, 6.2, 'p + ℓ ∉ P、∉ L ✓');
  },
  async (tok, S) => {
    cap('結論：P ∪ L 不是子空間', '');
    bad('P ∪ L 不是子空間', 3.2, 5.6);
  },
  async (tok, S) => {
    gone(S.p, S.l, S.l2, S.s, S.sk);
    cap('交集 P ∩ L：同時在 P 和 L 上的向量', '這是子空間嗎？');
  },
  async (tok, S) => {
    cap('這張圖裡：P ∩ L 只有零向量', 'L 沒有躺在 P 裡');
    S.o = S.S.ball([0, 0, 0], COL.g, 0.17); await flash(tok, S.o, GOLD, 3);
    S.ik = ok(!onP(LD), 3.2, 5.0, 'L 的方向不在 P 上 → P ∩ L = {0} ✓');
  },
  async (tok, S) => {
    cap('{0} 本身就是一個子空間', '0 + 0 = 0、c·0 = 0');
  },
  async (tok, S) => {
    gone(S.L, S.Ltag, S.ik);
    cap('一般情形：任兩個子空間 S、T', 'S ∩ T 一定是子空間');
    S.T = S.S.plane(S.tu, S.tv, COL.d, 0); await anim(tok, 700, (t) => S.T.fade(0.2 * t));
    const pt = S.S.w([2.2, -1.2, 2.0]); hot('T', pt.x, pt.y, pt.z); txt(S.Ptag, 'S'); sy(0, -4.6, 6.2);
    S.X = S.S.line(S.dd, COL.g, 0.01, [0, 0, 0], 0.05);
    await anim(tok, 700, (t) => S.S.setLine(S.X, S.dd, 0.01 + 2.3 * t));
    const px = S.S.w(scl(S.dd, 2.5)); hd('S ∩ T', px.x, px.y, px.z);
  },
  async (tok, S) => {
    cap('v、w 在交集裡：都在 S、也都在 T', '');
    S.v = S.S.arrow([0, 0, 0], COL.a, 'v'); S.w = S.S.arrow([0, 0, 0], COL.c, 'w');
    await anim(tok, 600, (t) => { S.S.set(S.v, scl(S.dd, 0.35 * t)); S.S.set(S.w, scl(S.dd, 0.9 * t)); });
  },
  async (tok, S) => {
    cap('v + w 在 S（S 是子空間），也在 T', '所以 v + w 在交集裡');
    gone(S.w); S.vw = S.S.arrow([0, 0, 0], COL.k, 'v + w'); await grow(tok, S.S, S.vw, scl(S.dd, 1.25));
    const s = scl(S.dd, 1.25);
    S.k1 = ok(Math.abs(dot(s, PN)) < 1e-9 && Math.abs(dot(s, S.tn)) < 1e-9, 3.0, 6.2, 'v + w ∈ S 且 ∈ T ✓');
  },
  async (tok, S) => {
    gone(S.vw);
    cap('乘常數也一樣：7v 在 S、也在 T', '');
    S.v.tag('7v'); await anim(tok, 800, (t) => S.S.set(S.v, scl(S.dd, 0.35 * (1 + 6 * t))));
    const s = scl(S.dd, 0.35 * 7);
    S.k2 = ok(Math.abs(dot(s, PN)) < 1e-9 && Math.abs(dot(s, S.tn)) < 1e-9, 3.0, 5.6, '7v ∈ S ∩ T ✓');
  },
  async (tok, S) => {
    cap('交集通常比較小，但一定是子空間', '<span class="ok">交集是子空間；聯集通常不是</span>');
    S.X.material.emissive = new THREE.Color(GOLD);
  },
  async (tok, S) => {
    cap('兩個條件：相加、乘常數', '合起來就是：線性組合留在裡面');
    S.cd = code(['① v + w 在裡面', '② c·v 在裡面', '⇒ 所有 c·v + d·w 在裡面'], -5.2, 1.2, 0.5);
    S.cd.hl(2);
  },
], Object.assign({}, V6, { setup: async (tok, S) => {
  S.S = space3(0, 2.6, 0, 1, 2.5);
  S.P = S.S.plane(PU, PV, COL.a, 0.2); const p = S.S.w([2.3, 2.3, 1.85]); S.Ptag = hd('P', p.x, p.y, p.z);
  S.L = S.S.line(LD, COL.r, 2.0); const q = S.S.w(scl(LD, 1.75)); S.Ltag = hot('L', q.x, q.y, q.z);
  S.tu = [1, 0, -0.4]; S.tv = [0, 0.6, 1]; S.tn = cross(S.tu, S.tv);
  const d = cross(PN, S.tn); S.dd = scl(d, 1 / norm(d));
} }));

scene('vsA-l6-colspace', 'L6：Column space C(A) = 欄的所有組合', [
  async (tok, S) => { cap('接下來：矩陣 A 的 column space', '記號 C(A)'); },
  async (tok, S) => {
    cap('例子：A 有三個欄', '(1,2,3,4)、(1,1,1,1)、(2,3,4,5)');
    S.g = mgrid(A6, -6.4, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] });
    hd('A（4×3）', -5.6, 6.35);
    await wt(tok, 300);
  },
  async (tok, S) => {
    cap('這三個欄，每一個都是向量', '');
    S.cb = C6.map((c, j) => { const B = bar(c, -2.4 + j * 1.9, 2.0, 0, [COL.a, COL.b, COL.c][j], { k: 0.38 }); sm('欄 ' + (j + 1), B.mid, 1.2); return B; });
    await wt(tok, 300);
  },
  async (tok, S) => { cap('C(A) 是 R 幾的子空間？', ''); S.q = hot('R？', 3.6, 5.6); },
  async (tok, S) => {
    cap('R⁴：每個欄有 4 個分量', '');
    txt(S.q, 'C(A) ⊂ R⁴'); S.cb.forEach((B) => B.glow(GOLD)); await wt(tok, 600); S.cb.forEach((B) => B.glow(null));
  },
  async (tok, S) => {
    cap('因為 A 是 4×3：4 列 → 欄有 4 個分量', 'm = 4 決定在哪個空間');
    for (let i = 0; i < 4; i++) { S.g.row(i, GOLD); await wt(tok, 250); S.g.row(i, null); }
  },
  async (tok, S) => {
    cap('三個欄當然都在 C(A) 裡', '');
    for (let j = 0; j < 3; j++) { S.g.col(j, GOLD); S.cb[j].glow(GOLD); await wt(tok, 350); S.g.col(j, null); S.cb[j].glow(null); }
  },
  async (tok, S) => { cap('但只放三個向量，不是子空間', '要能相加、乘常數'); S.no = bad('只有 3 個向量 ≠ 子空間', 3.6, 4.9); },
  async (tok, S) => {
    gone(S.no);
    cap('把所有線性組合放進來', 'C(A) = 所有 x₁·欄1 + x₂·欄2 + x₃·欄3');
    S.res = bar([0, 0, 0, 0], 4.0, 2.0, 0, COL.g, { k: 0.38 }); hot('組合 Ax', S.res.mid, 1.2);
    S.xl = pl('x = (1, 1, 0)', 4.6, 5.0);
    const t1 = mulMV(A6, [1, 1, 0]); await anim(tok, 800, (t) => S.res.set(scl(t1, t)));
  },
  async (tok, S) => {
    cap('組合 + 組合 = 還是組合', '乘 11 也還是組合');
    txt(S.xl, '(1,1,0) + (0,1,1) = (1,2,1)');
    const a = mulMV(A6, [1, 1, 0]), b = mulMV(A6, [0, 1, 1]), c = mulMV(A6, [1, 2, 1]);
    await anim(tok, 800, (t) => S.res.set(addv(a, scl(addv(c, scl(a, -1)), t))));
    S.k = ok(same(addv(a, b), c), 4.6, 4.4, 'A(1,1,0) + A(0,1,1) = A(1,2,1) ✓');
  },
  async (tok, S) => { gone(S.k); cap('C(A)：含這三個欄的「最小」子空間', '一定要有的都放了，就停在這裡'); },
  async (tok, S) => { cap('C(A) 有多大？會是整個 R⁴ 嗎？', ''); txt(S.q, 'C(A) = R⁴ ？'); },
  async (tok, S) => {
    cap('不會：三個向量的組合填不滿 R⁴', '只是 R⁴ 裡比較小的子空間');
    txt(S.q, 'C(A) ⊊ R⁴'); S.k2 = ok(N6.rank < 4, 3.6, 4.9, '3 個向量 → 維度最多 3 < 4 ✓');
  },
], { cam: [[0, 3.6, 13.5], [0, 3.4, 0]] });

scene('vsA-l6-solvable', 'L6：Ax = b 有解 ⇔ b 在 C(A) 裡', [
  async (tok, S) => { cap('接到方程式：Ax = b', '定義背後的目的'); },
  async (tok, S) => { cap('Ax = b 對每個 b 都有解嗎？', ''); txt(S.tl, 'b = ?'); },
  async (tok, S) => { cap('答案：不是', ''); S.no = bad('不是每個 b 都有解', 2.6, 6.3); },
  async (tok, S) => {
    gone(S.no);
    cap('4 個方程式、只有 3 個未知數', '');
    for (let i = 0; i < 4; i++) { S.g.row(i, GOLD); await wt(tok, 250); S.g.row(i, null); }
  },
  async (tok, S) => {
    cap('Ax = x₁·欄1 + x₂·欄2 + x₃·欄3', '要湊出右邊的 b');
    ['x₁ ·', 'x₂ ·', 'x₃ ·'].forEach((t, j) => hot(t, S.cb[j].mid, 4.4));
  },
  async (tok, S) => { cap('三個欄的組合：R⁴ 裡一小片', '像 R⁴ 裡的一個平面'); },
  async (tok, S) => { cap('但有些 b 解得出來', '哪些 b 可以？'); },
  async (tok, S) => {
    await S.run(tok, [0, 0, 0, 0], [0, 0, 0], 'b = 0：x = 0 一定行');
  },
  async (tok, S) => {
    cap('b = (1, 2, 3, 4)：解得出來嗎？', '它就是第 1 欄');
    S.tg.set([1, 2, 3, 4]); S.res.set([0, 0, 0, 0]); txt(S.tl, 'b = (1, 2, 3, 4)'); S.res.glow(null); gone(S.k);
  },
  async (tok, S) => { await S.run(tok, [1, 2, 3, 4], [1, 0, 0], 'x = (1, 0, 0)：一倍的第 1 欄'); },
  async (tok, S) => {
    cap('b = (1, 1, 1, 1) 呢？', '');
    S.tg.set([1, 1, 1, 1]); S.res.set([0, 0, 0, 0]); txt(S.tl, 'b = (1, 1, 1, 1)'); S.res.glow(null); gone(S.k);
  },
  async (tok, S) => { await S.run(tok, [1, 1, 1, 1], [0, 1, 0], 'x = (0, 1, 0)'); },
  async (tok, S) => {
    cap('技巧：先想一個 x，再看 b = Ax', '示意：x = (1, 1, 0)');
    const b = mulMV(A6, [1, 1, 0]); S.tg.set(b); txt(S.tl, 'b = ' + vs(b)); S.res.set([0, 0, 0, 0]); S.res.glow(null); gone(S.k); S.sy = sy(0, 5.6, 1.2);
    await S.run(tok, b, [1, 1, 0], 'x = (1, 1, 0) → b = ' + vs(b), true);
  },
  async (tok, S) => {
    gone(S.sy, S.k);
    cap('Ax = b 有解 ⇔ b 在 column space 裡', 'b 是欄的組合，係數就是 x');
    good('Ax = b 可解 ⇔ b ∈ C(A)', 1.6, 6.3);
  },
  async (tok, S) => {
    cap('b 不是欄的組合 → 找不到 x', '示意：b = (1, 0, 0, 0)');
    S.tg.set([1, 0, 0, 0]); S.res.set([0, 0, 0, 0]); txt(S.tl, 'b = (1, 0, 0, 0)'); sy(0, 5.6, 1.2);
    S.k = ok(!inSpan(C6, [1, 0, 0, 0]), 4.4, 5.6, 'b ∉ C(A) → 無解 ✓');
    S.res.glow(RED);
  },
], { cam: [[0, 3.6, 13.5], [0, 3.4, 0]], setup: async (tok, S) => {
  S.g = mgrid(A6, -6.8, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j], gap: 0.66, size: 0.54 }); hd('A', -6.1, 6.25);
  S.cb = C6.map((c, j) => bar(c, -3.4 + j * 1.9, 2.0, 0, [COL.a, COL.b, COL.c][j], { k: 0.32 }));
  S.tg = bar([0, 0, 0, 0], 3.6, 2.0, 0, COL.k, { k: 0.32 }); S.tg.ghost();
  S.res = bar([0, 0, 0, 0], 3.6, 2.0, 0.02, COL.g, { k: 0.32, noNum: true });
  S.tl = hot('b', 4.2, 1.2); sm('=', 2.6, 2.6);
  S.run = async (tok, b, x, msg, quiet) => {
    if (!quiet) cap(msg, '先想 x，算出 Ax，跟 b 比');
    const r = mulMV(A6, x); await anim(tok, 800, (t) => S.res.set(scl(r, t)));
    S.k = ok(same(r, b), 4.4, 5.6, 'A' + vs(x) + ' = b ✓'); S.res.glow(GREEN);
  };
} });

scene('vsA-l6-dependent', 'L6：第 3 欄 = 第 1 欄 + 第 2 欄，C(A) 是 2 維', [
  async (tok, S) => { cap('這個例子：三個欄的組合是什麼？', ''); },
  async (tok, S) => { cap('三個欄獨立嗎？', '每一欄都帶來新東西嗎？'); },
  async (tok, S) => { cap('能不能丟掉某一欄，C(A) 不變？', '答案：可以'); },
  async (tok, S) => { cap('丟哪一欄？第 3 欄最自然', ''); S.g.col(2, GOLD); S.cb[2].glow(GOLD); },
  async (tok, S) => {
    cap('欄 3 = 欄 1 + 欄 2', '它沒有帶來新方向');
    S.st = bar([0, 0, 0, 0], S.cb[2].ms[0].position.x, 2.2, 0.36, COL.g, { noNum: true, k: 0.38 });
    await anim(tok, 700, (t) => S.st.set(scl(C6[0], t)));
    await anim(tok, 700, (t) => S.st.set(addv(C6[0], scl(C6[1], t))));
    S.k = ok(same(addv(C6[0], C6[1]), C6[2]), 3.8, 6.2, '(1,2,3,4) + (1,1,1,1) = (2,3,4,5) ✓');
  },
  async (tok, S) => {
    gone(S.st); S.g.col(2, null); S.cb[2].glow(null);
    cap('第 1、2 欄叫 pivot columns', '第 3 欄不是 pivot 欄');
    S.g.paintCol(2, '#e7dcc8'); S.cb[0].glow(GREEN); S.cb[1].glow(GREEN);
    S.k2 = ok(same(N6.piv, [0, 1]), 3.8, 5.6, 'pivot 欄 = 第 1、2 欄 ✓');
  },
  async (tok, S) => {
    cap('丟掉第 1 欄可以嗎？也可以', '欄 1 = 欄 3 − 欄 2');
    S.k3 = ok(same(addv(C6[2], scl(C6[1], -1)), C6[0]), 3.8, 5.0, '(2,3,4,5) − (1,1,1,1) = (1,2,3,4) ✓');
  },
  async (tok, S) => { cap('慣例：從左邊開始，保留不相依的欄', '第 3 欄和前兩欄在同一個平面上'); },
  async (tok, S) => {
    cap('C(A) 是 R⁴ 裡的 2 維子空間', '');
    S.k4 = ok(N6.rank === 2, 3.8, 4.4, 'rank = 2 → dim C(A) = 2 ✓');
  },
], { cam: [[0, 3.6, 13], [0, 3.4, 0]], setup: async (tok, S) => {
  S.g = mgrid(A6, -6.6, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); hd('A', -5.8, 6.35);
  S.cb = C6.map((c, j) => { const B = bar(c, -2.6 + j * 2.0, 2.2, 0, [COL.a, COL.b, COL.c][j], { k: 0.38 }); sm('欄 ' + (j + 1), B.mid, 1.4); return B; });
} });

scene('vsA-l6-null', 'L6：Null space N(A) = c(1, 1, −1)', [
  async (tok, S) => { cap('另一個子空間：null space N(A)', '跟 C(A) 完全不同'); },
  async (tok, S) => { cap('N(A) 裡裝的不是右邊的 b', '裝的是 x'); },
  async (tok, S) => { cap('N(A) = 所有讓 Ax = 0 的 x', '右邊只看全部是 0 的情形'); },
  async (tok, S) => {
    cap('x 有 3 個分量 → N(A) 在 R³ 裡', '');
    S.S = space3(3.8, 2.4, 0, 0.6, 2.2, ['x₁', 'x₂', 'x₃'], 'R³（x 住的地方）');
    await wt(tok, 300);
  },
  async (tok, S) => {
    cap('A 是 m×n：C(A) ⊂ Rᵐ、N(A) ⊂ Rⁿ', '這裡 C(A) ⊂ R⁴、N(A) ⊂ R³');
    pl('C(A) ⊂ R⁴（m = 4）', -4.2, 0.5); pl('N(A) ⊂ R³（n = 3）', -4.2, -0.1);
  },
  async (tok, S) => {
    cap('先找一個解：零向量', 'A·0 = 0，不管 A 是什麼');
    S.o = S.S.ball([0, 0, 0], COL.g, 0.13);
    S.k0 = ok(isZ(mulMV(A6, [0, 0, 0])), -1.6, 6.3, 'A·0 = 0 ✓');
  },
  async (tok, S) => {
    cap('再一個：x = (1, 1, −1)', '欄 1 + 欄 2 − 欄 3 = 0');
    S.res = bar([0, 0, 0, 0], -5.4, 1.4, 0.3, COL.g, { k: 0.26 }); sm('Ax', S.res.mid, 0.7);
    await anim(tok, 600, (t) => S.res.set(scl(C6[0], t)));
    await anim(tok, 600, (t) => S.res.set(addv(C6[0], scl(C6[1], t))));
    await anim(tok, 700, (t) => S.res.set(addv(addv(C6[0], C6[1]), scl(C6[2], -t))));
    S.p1 = S.S.ball([1, 1, -1], COL.r, 0.12);
    S.k1 = ok(isZ(mulMV(A6, [1, 1, -1])), -1.6, 5.7, 'A(1, 1, −1) = 0 ✓');
  },
  async (tok, S) => { cap('只有幾個向量，還不是子空間', ''); },
  async (tok, S) => {
    cap('(2, 2, −2) 也是解', '');
    S.p2 = S.S.ball([2, 2, -2], COL.r, 0.12);
    S.k2 = ok(isZ(mulMV(A6, [2, 2, -2])), -1.6, 5.1, 'A(2, 2, −2) = 0 ✓');
  },
  async (tok, S) => {
    cap('全部的解：c·(1, 1, −1)', 'c = 0 是零向量，c = 1 是 (1, 1, −1)');
    S.L = S.S.line([1, 1, -1], COL.r, 0.01, [0, 0, 0], 0.035);
    await anim(tok, 1000, (t) => S.S.setLine(S.L, [1, 1, -1], 0.01 + 3.3 * t));
    S.k3 = ok(same(N6.null[0], [-1, -1, 1]) || same(N6.null[0], [1, 1, -1]), -1.6, 4.5, 'special solution ∥ (1, 1, −1) ✓');
  },
  async (tok, S) => {
    cap('(7, 7, −7)、(−11, −11, 11)… 都在線上', '');
    const d = S.S.ball([0, 0, 0], COL.g, 0.1);
    await anim(tok, 1200, (t) => d.position.copy(S.S.w(scl([1, 1, -1], -1.6 + 3.4 * t))));
    S.k4 = ok(isZ(mulMV(A6, [7, 7, -7])) && isZ(mulMV(A6, [-11, -11, 11])), -1.6, 3.9, 'A(7,7,−7) = A(−11,−11,11) = 0 ✓');
  },
  async (tok, S) => {
    cap('N(A) 是 R³ 裡過原點的一條線', '往兩邊無限延伸');
    S.L.material.emissive = new THREE.Color(GOLD);
  },
], { cam: [[0, 3.6, 13.5], [0, 3.2, 0]], setup: async (tok, S) => {
  S.g = mgrid(A6, -6.6, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j], gap: 0.62, size: 0.5 }); hd('A', -6.0, 6.2);
  S.cb = C6.map((c, j) => bar(c, -6.0 + j * 1.6, 2.9, 0, [COL.a, COL.b, COL.c][j], { k: 0.2, gap: 0.3, w: 0.24 }));
} });

scene('vsA-l6-nullwhy', 'L6：為什麼 N(A) 是子空間', [
  async (tok, S) => { cap('憑什麼叫 N(A) 一個「空間」？', '要檢查兩個條件'); },
  async (tok, S) => { cap('條件：相加、乘常數都要留在裡面', ''); S.cd.hl(0); },
  async (tok, S) => {
    cap('若 Av = 0、Aw = 0，A(v + w) = ？', '');
    S.cd.hl(1);
    S.v = S.S.arrow([0, 0, 0], COL.a, 'v'); S.w = S.S.arrow([0, 0, 0], COL.c, 'w');
    await anim(tok, 600, (t) => { S.S.set(S.v, scl(S.vv, t)); S.S.set(S.w, scl(S.ww, t), S.vv); });
  },
  async (tok, S) => {
    cap('分配律：A(v + w) = Av + Aw = 0 + 0', '所以 v + w 也在 N(A)');
    S.cd.hl(2);
    S.s = S.S.arrow([0, 0, 0], COL.g, 'v + w'); await grow(tok, S.S, S.s, addv(S.vv, S.ww));
    ok(isZ(mulMV(A6, addv(S.vv, S.ww))) && same(mulMV(A6, addv(S.vv, S.ww)), addv(mulMV(A6, S.vv), mulMV(A6, S.ww))), -5.0, 1.0, 'A(v + w) = Av + Aw = 0 ✓');
  },
  async (tok, S) => {
    cap('乘常數：A(12v) = 12·Av = 0', '常數可以提到外面');
    S.cd.hl(3);
    ok(isZ(mulMV(A6, scl(S.vv, 12))), -5.0, 0.4, 'A(12v) = 12·Av = 0 ✓');
  },
], { cam: [[0, 3.6, 13], [0, 3.0, 0]], setup: async (tok, S) => {
  S.S = space3(3.0, 2.6, 0, 0.75, 2.4, ['x₁', 'x₂', 'x₃'], 'N(A)');
  S.S.line([1, 1, -1], COL.r, 3.0, [0, 0, 0], 0.03);
  S.vv = [1, 1, -1]; S.ww = [0.8, 0.8, -0.8];
  S.cd = code(['兩個條件：', 'Av = 0、Aw = 0', '⇒ A(v + w) = Av + Aw = 0', '⇒ A(12v) = 12·Av = 0'], -5.4, 5.2, 0.6);
} });

scene('vsA-l6-shifted', 'L6：Ax = (1, 2, 3, 4) 的解不是子空間', [
  async (tok, S) => { cap('右邊改成 b = (1, 2, 3, 4)', '4 個方程式、3 個未知數'); },
  async (tok, S) => {
    cap('有一個解：x = (1, 0, 0)', 'b 剛好是第 1 欄');
    S.a = S.S.ball([1, 0, 0], COL.b, 0.13); const p = S.S.w([1, 0, 0.4]); hot('(1, 0, 0)', p.x, p.y, p.z);
    ok(same(mulMV(A6, [1, 0, 0]), S.b), -5.2, 6.2, 'A(1, 0, 0) = b ✓');
  },
  async (tok, S) => { cap('所有的解，會形成子空間嗎？', ''); },
  async (tok, S) => {
    cap('不會：x = 0 根本不是解', 'A·0 = 0 ≠ b');
    S.z = S.S.ball([0, 0, 0], COL.r, 0.14); glow(S.z, RED);
    ok(!same(mulMV(A6, [0, 0, 0]), S.b), -5.2, 5.6, 'A·0 ≠ b → 0 不是解 ✓');
  },
  async (tok, S) => {
    cap('另一個解：x = (0, −1, 1)', '−欄 2 + 欄 3 = (1, 2, 3, 4)');
    S.c = S.S.ball([0, -1, 1], COL.b, 0.13); const p = S.S.w([0, -1, 1.4]); hot('(0, −1, 1)', p.x, p.y, p.z);
    ok(same(mulMV(A6, [0, -1, 1]), S.b), -5.2, 5.0, 'A(0, −1, 1) = b ✓');
  },
  async (tok, S) => {
    cap('解集合：一條「不過原點」的線', '');
    S.Ls = S.S.line([1, 1, -1], COL.b, 0.01, [1, 0, 0], 0.045);
    await anim(tok, 1000, (t) => S.S.setLine(S.Ls, [1, 1, -1], 0.01 + 2.2 * t, [1, 0, 0]));
    ok(isZ(mulMV(A6, addv([0, -1, 1], scl([1, 0, 0], -1)))), -5.2, 4.4, '兩解相減 ∈ N(A) ✓');
  },
  async (tok, S) => {
    cap('子空間一定要過原點', '過原點的那條灰線才是 N(A)');
    S.N = S.S.line([1, 1, -1], COL.gray, 0.01, [0, 0, 0], 0.03);
    await anim(tok, 700, (t) => S.S.setLine(S.N, [1, 1, -1], 0.01 + 2.6 * t));
    const p = S.S.w([1.6, 1.6, -1.6]); sm('N(A)', p.x, p.y, p.z);
  },
  async (tok, S) => {
    cap('描述子空間的方法一：給幾個向量', '取它們的所有組合 → C(A)');
    S.cd = code(['方法一：給向量，取組合 → C(A)', '方法二：給方程式 Ax = 0 → N(A)'], -5.6, 1.2, 0.6); S.cd.hl(0);
  },
  async (tok, S) => { cap('方法二：給 x 要滿足的方程式', '滿足 Ax = 0 的 x → N(A)'); S.cd.hl(1); },
], { cam: [[0, 4, 11.5], [0, 2.6, 0]], view: [26, 22, 11, [0, 2.6, 0]], setup: async (tok, S) => {
  S.S = space3(0, 2.6, 0, 0.9, 2.5, ['x₁', 'x₂', 'x₃']); S.b = [1, 2, 3, 4];
  hd('Ax = (1, 2, 3, 4)', -4.4, 6.8);
} });

// ════════ VqP2tREMvt0（L7）：Ax = 0 的演算法：pivot 變數、special solutions、R ════════
// 老師的 A = [1 2 2 2; 2 4 6 8; 3 6 8 10]（la-4 的 A8）；第二個例子是它的轉置。
const E8 = rrefSteps(A8), Q8 = subspaces(A8);
const U8 = [[1, 2, 2, 2], [0, 0, 2, 4], [0, 0, 0, 0]];
const A8t = T(A8), E8t = rrefSteps(A8t), Q8t = subspaces(A8t);
const XN = ['x₁', 'x₂', 'x₃', 'x₄'];
// 列運算：row i ← row i − f·row j（同時更新畫面）
function rowOp(S, i, f, j) { S.M[i] = S.M[i].map((x, k) => x - f * S.M[j][k]); S.g.clearGlow(); S.g.setAll(S.M); S.g.row(i, GOLD); }
function rowDiv(S, i, d) { S.M[i] = S.M[i].map((x) => x / d); S.g.clearGlow(); S.g.setAll(S.M); S.g.row(i, GOLD); }
function rowSwap(S, i, j) { [S.M[i], S.M[j]] = [S.M[j], S.M[i]]; S.g.clearGlow(); S.g.setAll(S.M); S.g.row(i, GOLD); S.g.row(j, GOLD); }
const eqU = (M) => sameM(M.map((r) => r.map((x) => (Math.abs(x) < 1e-12 ? 0 : x))), M);

scene('vsA-l7-elim', 'L7：消去法把 A 化成 echelon form U', [
  async (tok, S) => { cap('例子：A 有 3 列、4 欄', '第 2 列 (2,4,6,8)、第 3 列 (3,6,8,10)'); S.g = mgrid(S.M, -4.6, 5.4, 0); XN.forEach((n, j) => sm(n, S.g.xs[j], 6.1)); },
  async (tok, S) => {
    cap('一眼看出：欄 2 = 2 × 欄 1', '欄 2 不是獨立的');
    S.g.col(0, GOLD); S.g.col(1, GOLD);
    S.k1 = ok(same(colOf(A8, 1), scl(colOf(A8, 0), 2)), 1.8, 6.0, '欄 2 = 2·欄 1 ✓');
  },
  async (tok, S) => {
    S.g.clearGlow();
    cap('列也一樣：列 1 + 列 2 = 列 3', '第 3 列不是獨立的');
    S.g.row(0, GOLD); S.g.row(1, GOLD); S.g.row(2, GREEN);
    S.k2 = ok(same(addv(A8[0], A8[1]), A8[2]), 1.8, 5.4, '列 1 + 列 2 = 列 3 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); gone(S.k1, S.k2); cap('演算法：消去法，用在長方形矩陣', 'pivot 位置是 0 也要繼續往下做'); },
  async (tok, S) => { cap('消去不會改變 null space', '解 Ax = 0 的 x 都不變'); good('N(A) 不變', 1.8, 6.0); },
  async (tok, S) => { cap('但會改變 column space', '要注意什麼變、什麼不變'); bad('C(A) 會變', 1.8, 5.4); },
  async (tok, S) => {
    cap('右邊一直是 0，就不寫了', '只在左邊做');
    [0, 1, 2].forEach((i) => cube('0', '#efe6d4', [0.5, 0.5, 0.25], -1.25, 5.4 - i * 0.78, 0)); sm('= 0', -1.25, 6.1);
  },
  async (tok, S) => { cap('第一個 pivot：左上角的 1', ''); glow(S.g.c[0][0], GREEN); tint(S.g.c[0][0], COL.a); },
  async (tok, S) => { cap('R2 − 2·R1 → (0, 0, 2, 4)', '第 2 欄也變 0：麻煩的訊號'); rowOp(S, 1, 2, 0); },
  async (tok, S) => { cap('R3 − 3·R1 → (0, 0, 2, 4)', '第 1 欄處理完'); rowOp(S, 2, 3, 0); },
  async (tok, S) => {
    S.g.clearGlow();
    cap('第 2 欄：pivot 位置是 0，下面也是 0', '沒得交換 → 這欄沒有 pivot');
    S.g.col(1, RED);
  },
  async (tok, S) => { cap('代表欄 2 和前面的欄相依', '不用停下來想，直接往下一欄'); },
  async (tok, S) => { S.g.clearGlow(); cap('第 3 欄：第二個 pivot = 2', ''); tint(S.g.c[1][2], COL.a); glow(S.g.c[1][2], GREEN); },
  async (tok, S) => { cap('R3 − 1·R2 → 整列都是 0', ''); rowOp(S, 2, 1, 1); },
  async (tok, S) => {
    S.g.clearGlow();
    cap('這就是 U：echelon（階梯）形式', '非零的數排成階梯');
    const st = [[-4.95, 5.0], [-3.4, 5.0], [-3.4, 4.2], [-1.6, 4.2]];
    for (let k = 0; k + 1 < st.length; k++) rod(COL.r, 0.035).setW(V3(st[k][0], st[k][1], 0.2), V3(st[k + 1][0], st[k + 1][1], 0.2));
    hd('U', -1.4, 5.4); S.k = ok(sameM(S.M, U8), 1.8, 4.8, 'U = [1 2 2 2; 0 0 2 4; 0 0 0 0] ✓');
  },
  async (tok, S) => {
    cap('pivot 有 2 個 → rank = 2', 'rank = pivot 的個數');
    S.k2 = ok(E8.rank === 2, 1.8, 4.2, 'rank(A) = 2 ✓');
  },
], { cam: [[0, 3.6, 12.5], [0, 3.6, 0]], setup: async (tok, S) => { S.M = A8.map((r) => r.slice()); } });

scene('vsA-l7-special', 'L7：pivot 變數、free 變數、special solutions', [
  async (tok, S) => { cap('改解 Ux = 0：解完全一樣', '同一個 null space'); },
  async (tok, S) => { cap('pivot 欄：第 1、3 欄', '有 pivot 的欄'); S.g.paintCol(0, COL.a); S.g.paintCol(2, COL.a); },
  async (tok, S) => {
    cap('free 欄：第 2、4 欄', '沒有 pivot 的欄');
    S.g.paintCol(1, COL.b); S.g.paintCol(3, COL.b);
    S.k = ok(same(E8.piv, [0, 2]), -1.6, 6.3, 'pivot 欄 = 1、3 ✓');
  },
  async (tok, S) => {
    gone(S.k);
    cap('free 變數 x₂、x₄：可以隨便給值', '再解出 pivot 變數 x₁、x₃');
    S.x = ['?', '?', '?', '?'].map((v, i) => cube(v, i % 2 ? COL.b : COL.a, [0.6, 0.6, 0.3], -1.4, 5.6 - i * 0.74, 0));
    XN.forEach((n, i) => sm(n, -2.1, 5.6 - i * 0.74));
  },
  async (tok, S) => { cap('第一種選擇：x₂ = 1、x₄ = 0', ''); relabel(S.x[1], 1); relabel(S.x[3], 0); },
  async (tok, S) => {
    cap('Ux = 0 寫成方程式', '');
    S.cd = code(['x₁ + 2x₂ + 2x₃ + 2x₄ = 0', '          2x₃ + 4x₄ = 0'], 1.4, 5.6, 0.6);
  },
  async (tok, S) => { cap('回代：最後一式 → x₃ = 0', '因為 x₄ = 0'); S.cd.hl(1); relabel(S.x[2], 0); glow(S.x[2], GOLD); },
  async (tok, S) => {
    glow(S.x[2], null);
    cap('第一式：x₁ + 2 = 0 → x₁ = −2', 's₁ = (−2, 1, 0, 0)');
    S.cd.hl(0); relabel(S.x[0], -2); glow(S.x[0], GOLD);
    S.s1 = bar(S.N[0], 1.2, 1.6, 0, COL.c, { k: 0.4 }); hot('s₁', S.s1.mid, 3.0);
    S.k1 = ok(isZ(mulMV(A8, S.N[0])) && same(S.N[0], [-2, 1, 0, 0]), 1.2, 0.5, 'A s₁ = 0 ✓');
  },
  async (tok, S) => { glow(S.x[0], null); cap('意思是：−2·欄 1 + 1·欄 2 = 0', '欄 2 正好是欄 1 的兩倍'); S.k1b = ok(isZ(addv(scl(colOf(A8, 0), -2), colOf(A8, 1))), 1.2, -0.1, '−2(1,2,3) + (2,4,6) = 0 ✓'); },
  async (tok, S) => { gone(S.k1b); cap('它的任何倍數 c·s₁ 也在 N(A)', '一條 R⁴ 裡的直線'); await anim(tok, 900, (t) => S.s1.set(scl(S.N[0], 1 - 1.5 * Math.sin(Math.PI * t)))); },
  async (tok, S) => { cap('這樣就是整個 null space 嗎？不是', '還有另一個 free 變數'); },
  async (tok, S) => { cap('另一種選擇：x₂ = 0、x₄ = 1', ''); S.x.forEach((m, i) => relabel(m, ['?', 0, '?', 1][i])); S.cd.hl(-1); },
  async (tok, S) => { cap('最後一式：2x₃ + 4 = 0 → x₃ = −2', ''); S.cd.hl(1); relabel(S.x[2], -2); glow(S.x[2], GOLD); },
  async (tok, S) => {
    glow(S.x[2], null);
    cap('第一式：x₁ − 4 + 2 = 0 → x₁ = 2', 's₂ = (2, 0, −2, 1)');
    S.cd.hl(0); relabel(S.x[0], 2); glow(S.x[0], GOLD);
    S.s2 = bar(S.N[1], 3.6, 1.6, 0, COL.d, { k: 0.4 }); hot('s₂', S.s2.mid, 3.0);
    S.k2 = ok(isZ(mulMV(A8, S.N[1])) && same(S.N[1], [2, 0, -2, 1]), 3.6, 0.5, 'A s₂ = 0 ✓');
  },
  async (tok, S) => { glow(S.x[0], null); cap('2·欄 1 − 2·欄 3 + 欄 4 = 0', ''); S.k2b = ok(isZ(addv(addv(scl(colOf(A8, 0), 2), scl(colOf(A8, 2), -2)), colOf(A8, 3))), 3.6, -0.1, '2(1,2,3) − 2(2,6,8) + (2,8,10) = 0 ✓'); },
  async (tok, S) => { gone(S.k2b); cap('這兩個叫 special solutions', 'free 變數給特別的值 1 和 0'); S.s1.glow(GOLD); S.s2.glow(GOLD); },
  async (tok, S) => {
    S.s1.glow(null); S.s2.glow(null);
    cap('N(A) = 所有 c·s₁ + d·s₂', '兩個 special solutions 的所有組合');
    S.xc = bar([0, 0, 0, 0], -5.6, 1.6, 0, COL.g, { k: 0.4 }); S.xl = hot('c·s₁ + d·s₂', S.xc.mid, 3.0);
    let cur = [0, 0, 0, 0]; let allZ = true;
    for (const [c, d] of [[1, 1], [0.5, -1], [-1, 0.5]]) { const tg = addv(scl(S.N[0], c), scl(S.N[1], d)), fr = cur; allZ = allZ && isZ(mulMV(A8, tg)); await anim(tok, 600, (t) => S.xc.set(addv(fr, scl(addv(tg, scl(fr, -1)), t)))); cur = tg; }
    S.k3 = ok(allZ, -5.6, 0.5, 'A(c·s₁ + d·s₂) = 0 ✓');
  },
  async (tok, S) => { cap('每一個 free 變數給一個 special solution', ''); },
  async (tok, S) => {
    cap('r 個 pivot 變數、n − r 個 free 變數', 'n − r = 4 − 2 = 2');
    S.k4 = ok(S.N.length === 4 - E8.rank && E8.rank === 2, -1.6, 6.3, 'free 變數 = n − r = 2 ✓');
  },
  async (tok, S) => { cap('看起來 3 個方程式，其實只有 2 個獨立', 'r = 2'); },
], { cam: [[0, 3.4, 13.5], [0, 3.2, 0]], setup: async (tok, S) => {
  S.g = mgrid(U8, -6.6, 5.6, 0); XN.forEach((n, j) => sm(n, S.g.xs[j], 6.3)); hd('U', -6.9, 4.8);
  S.N = Q8.null;
} });

scene('vsA-l7-rref', 'L7：Reduced row echelon form R', [
  async (tok, S) => { cap('再多做一步，把 U 整理得更乾淨', ''); },
  async (tok, S) => { cap('目標：reduced row echelon form R', ''); hd('U → R', -2.2, 6.4); },
  async (tok, S) => {
    cap('那一列 0：第 3 列是列 1、列 2 的組合', '消去法把它消掉了');
    S.g.row(2, RED); S.k = ok(same(addv(A8[0], A8[1]), A8[2]), 1.4, 6.0, 'A 的列 3 = 列 1 + 列 2 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); gone(S.k); cap('往上消：pivot 上方也變 0', ''); glow(S.g.c[0][2], GOLD); },
  async (tok, S) => { cap('R1 − R2 → (1, 2, 0, −2)', 'pivot 上方變 0'); rowOp(S, 0, 1, 1); },
  async (tok, S) => { cap('R2 ÷ 2 → (0, 0, 1, 2)', '讓 pivot 變成 1'); rowDiv(S, 1, 2); },
  async (tok, S) => {
    S.g.clearGlow();
    cap('這就是 R', '[1 2 0 −2; 0 0 1 2; 0 0 0 0]');
    S.k = ok(sameM(S.M, E8.R), 1.4, 6.0, 'R = rref(A) ✓');
  },
  async (tok, S) => { cap('MATLAB：rref(A) 直接算出 R', ''); S.ml = code(['>> R = rref(A)'], 1.4, 5.3, 0.6); },
  async (tok, S) => { gone(S.ml); cap('pivot 列：1、2；pivot 欄：1、3', ''); S.g.row(0, GOLD); S.g.row(1, GOLD); await wt(tok, 500); S.g.clearGlow(); S.g.paintCol(0, COL.a); S.g.paintCol(2, COL.a); },
  async (tok, S) => {
    cap('pivot 列 × pivot 欄 = 2×2 單位矩陣 I', '');
    [[0, 0], [0, 2], [1, 0], [1, 2]].forEach(([i, j]) => glow(S.g.c[i][j], GREEN)); hot('I', -6.9, 5.0);
  },
  async (tok, S) => { cap('下面的 0 列：原本那列是別列的組合', ''); S.g.row(2, RED); },
  async (tok, S) => {
    S.g.clearGlow();
    cap('Ax = 0、Ux = 0、Rx = 0：解都一樣', '列運算是合法的');
    S.cd = code(['Ax = 0', 'Ux = 0', 'Rx = 0'], 1.4, 5.3, 0.5);
    S.k2 = ok(sameM(nullBasis(E8.R, E8.piv, 4), Q8.null) && isZ(mulMV(U8, Q8.null[0])) && isZ(mulMV(U8, Q8.null[1])), 1.4, 3.6, '三個方程式 null space 相同 ✓');
  },
  async (tok, S) => {
    gone(S.cd, S.k2);
    cap('free 欄裡看到：(2, 0) 和 (−2, 2)', '');
    S.g.paintCol(1, COL.b); S.g.paintCol(3, COL.b); [[0, 1], [1, 1], [0, 3], [1, 3]].forEach(([i, j]) => glow(S.g.c[i][j], GOLD));
  },
  async (tok, S) => {
    cap('special solutions 裡變號出現', 's₁ 的 (x₁, x₃) = (−2, 0)；s₂ = (2, −2)');
    const N = Q8.null;
    S.s = N.map((v, k) => { v.forEach((x, i) => cube(fmt(x), i === 0 || i === 2 ? COL.a : COL.b, [0.6, 0.6, 0.3], 2.0 + k * 1.1, 5.4 - i * 0.74, 0)); hot('s' + (k + 1), 2.0 + k * 1.1, 6.1); return v; });
    const F = [[S.M[0][1], S.M[0][3]], [S.M[1][1], S.M[1][3]]];
    S.k = ok(N[0][0] === -F[0][0] && N[0][2] === -F[1][0] && N[1][0] === -F[0][1] && N[1][2] === -F[1][1], 1.4, 2.0, 'pivot 部分 = −F ✓');
  },
  async (tok, S) => { cap('I = 單位矩陣部分，F = free 部分', ''); hot('F', -2.5, 6.3); },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => {
  S.M = U8.map((r) => r.slice()); S.g = mgrid(S.M, -6.0, 5.4, 0); XN.forEach((n, j) => sm(n, S.g.xs[j], 6.1));
} });

scene('vsA-l7-block', 'L7：R = [I F; 0 0] 與 null space matrix N = [−F; I]', [
  async (tok, S) => {
    cap('假設 pivot 欄排在前面', 'R = [I F; 0 0]');
    S.I = cube('I', COL.a, [1.6, 1.6, 0.3], -5.0, 5.0, 0, 2); S.F = cube('F', COL.b, [2.0, 1.6, 0.3], -3.1, 5.0, 0, 2);
    S.Z = cube('0', '#e7dcc8', [3.8, 0.9, 0.3], -4.0, 3.6, 0, 2); hd('R =', -6.5, 5.0);
  },
  async (tok, S) => {
    cap('I：r×r（r 個 pivot 列、r 個 pivot 欄）', 'F：n − r 個 free 欄');
    sm('r 欄', -5.0, 6.1); sm('n − r 欄', -3.1, 6.1); sm('r 列', -6.4, 4.4); sm('m − r 列', -6.4, 3.6);
  },
  async (tok, S) => { cap('null space matrix N', '每一欄都是一個 special solution'); hd('N =', 0.2, 5.0); },
  async (tok, S) => { cap('要 R·N = 0', ''); },
  async (tok, S) => {
    cap('N = [−F; I]', 'free 部分放 I，pivot 部分放 −F');
    S.nF = cube('−F', COL.r, [2.0, 1.6, 0.3], 2.4, 5.0, 0, 2); S.nI = cube('I', COL.b, [2.0, 2.0, 0.3], 2.4, 3.2, 0, 2);
    sm('pivot 變數', 4.3, 5.0); sm('free 變數', 4.3, 3.2);
  },
  async (tok, S) => { cap('MATLAB：null(A) 給的就是 N', '先算 R，再把 free 變數填 1、0'); S.ml = code(['>> N = null(A)'], 0.6, 1.6, 0.6); },
  async (tok, S) => { gone(S.ml); cap('Rx = 0：x_pivot + F·x_free = 0', ''); S.cd = code(['R x = [I F] [x_pivot; x_free] = 0', '⇒ x_pivot + F x_free = 0'], -6.6, 1.6, 0.55); S.cd.hl(1); },
  async (tok, S) => { cap('移項：x_pivot = −F·x_free', '回代就只剩這一步'); gone(S.cd); S.cd = code(['x_pivot = −F x_free'], -6.6, 1.6, 0.55); S.cd.hl(0); },
  async (tok, S) => {
    cap('x_free 取 I → x_pivot = −F', '老師的例子：F = [2 −2; 0 2]');
    const Nm = T(Q8.null);   // 4×2
    const F = [[E8.R[0][1], E8.R[0][3]], [E8.R[1][1], E8.R[1][3]]];
    const piv = [Nm[0], Nm[2]], fre = [Nm[1], Nm[3]];
    S.k = ok(isZ(mulMM(E8.R, Nm).flat()) && sameM(piv, F.map((r) => r.map((x) => -x))) && sameM(fre, [[1, 0], [0, 1]]), -6.6, 0.8, 'R·N = 0、pivot 部分 = −F、free 部分 = I ✓');
  },
], { cam: [[0, 3.4, 12.5], [0, 3.4, 0]] });

scene('vsA-l7-ex2', 'L7：第二個例子：Aᵀ 的 null space 是一條線', [
  async (tok, S) => { cap('再做一個例子', ''); },
  async (tok, S) => { cap('取上一個 A 的轉置：4×3', '[1 2 3; 2 4 6; 2 6 8; 2 8 10]'); S.g = mgrid(S.M, -6.4, 5.8, 0); ['x₁', 'x₂', 'x₃'].forEach((n, j) => sm(n, S.g.xs[j], 6.5)); },
  async (tok, S) => {
    cap('會有幾個 pivot？欄 3 = 欄 1 + 欄 2', '所以不會有 3 個');
    S.g.col(2, GOLD); S.k = ok(same(addv(colOf(A8t, 0), colOf(A8t, 1)), colOf(A8t, 2)), -2.6, 6.6, '欄 3 = 欄 1 + 欄 2 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); gone(S.k); cap('預期：欄 1、2 是 pivot 欄，欄 3 是 free 欄', '消去法應該會發現'); },
  async (tok, S) => { cap('第一個 pivot；R2 − 2·R1 → 整列 0', ''); tint(S.g.c[0][0], COL.a); rowOp(S, 1, 2, 0); },
  async (tok, S) => { cap('R3 − 2·R1 → (0, 2, 2)', ''); rowOp(S, 2, 2, 0); },
  async (tok, S) => { cap('R4 − 2·R1 → (0, 4, 4)', '第 1 欄處理完'); rowOp(S, 3, 2, 0); },
  async (tok, S) => { cap('第 2 欄 pivot 位置是 0，下面有 2', '交換 R2 ↔ R3'); rowSwap(S, 1, 2); },
  async (tok, S) => { cap('R4 − 2·R2 → 整列 0', '得到 U'); tint(S.g.c[1][1], COL.a); rowOp(S, 3, 2, 1); hd('U', -6.9, 4.4); },
  async (tok, S) => {
    S.g.clearGlow();
    cap('第 3 欄：pivot 位置 0、下面全 0 → 停', 'rank 還是 2');
    S.k = ok(E8t.rank === 2 && sameM(S.M, [[1, 2, 3], [0, 2, 2], [0, 0, 0], [0, 0, 0]]), -2.6, 6.6, 'U 正確、rank = 2 ✓');
  },
  async (tok, S) => { cap('A 和 Aᵀ 的 pivot 欄個數一樣', '大事實：rank(A) = rank(Aᵀ)'); S.k2 = ok(E8.rank === E8t.rank, -2.6, 6.0, 'rank(A) = rank(Aᵀ) = 2 ✓'); },
  async (tok, S) => { gone(S.k, S.k2); cap('free 欄：3 − 2 = 1 個', 'x₃ 是 free 變數'); S.g.paintCol(2, COL.b); },
  async (tok, S) => {
    cap('free 變數 x₃ 設成 1', '設 0 只會得到全 0');
    S.x = ['?', '?', '1'].map((v, i) => cube(v, i === 2 ? COL.b : COL.a, [0.6, 0.6, 0.3], -2.6, 4.6 - i * 0.74, 0)); hot('x', -2.6, 5.3);
  },
  async (tok, S) => {
    cap('2x₂ + 2x₃ = 0 → x₂ = −1', '第一式：x₁ + 2x₂ + 3x₃ = 0');
    relabel(S.x[1], -1); glow(S.x[1], GOLD);
  },
  async (tok, S) => {
    glow(S.x[1], null);
    cap('x₁ = −1：−欄1 − 欄2 + 欄3 = 0', '');
    relabel(S.x[0], -1); glow(S.x[0], GOLD);
    S.k = ok(isZ(mulMV(A8t, [-1, -1, 1])) && same(Q8t.null[0], [-1, -1, 1]), -2.6, 1.6, 'Aᵀ(−1, −1, 1) = 0 ✓');
  },
  async (tok, S) => {
    glow(S.x[0], null);
    cap('整個 null space：c·(−1, −1, 1)', '一條過原點的線（在 R³）');
    S.S = space3(3.8, 2.6, 0, 0.75, 2.2, ['x₁', 'x₂', 'x₃'], 'R³：null space');
    S.L = S.S.line([-1, -1, 1], COL.r, 0.01, [0, 0, 0], 0.04);
    S.a = S.S.arrow([-1, -1, 1], COL.r, '(−1, −1, 1)');
    await anim(tok, 900, (t) => S.S.setLine(S.L, [-1, -1, 1], 0.01 + 2.5 * t));
  },
  async (tok, S) => { cap('要 basis 時只要這個向量', '要整個 null space 就要寫 c'); },
  async (tok, S) => {
    gone(S.k);
    cap('繼續化成 R：R1 − R2 → (1, 0, 1)', '');
    rowOp(S, 0, 1, 1);
  },
  async (tok, S) => {
    cap('R2 ÷ 2 → (0, 1, 1)', 'R = [I F; 0 0]');
    rowDiv(S, 1, 2); S.g.clearGlow();
    S.k = ok(sameM(S.M, E8t.R), -2.6, 1.6, 'R = rref(Aᵀ) ✓');
  },
  async (tok, S) => {
    cap('free 部分放 1，pivot 部分放 −F', 'F = (1, 1) → x = (−1, −1, 1)');
    const F = [E8t.R[0][2], E8t.R[1][2]];
    S.k2 = ok(same([-F[0], -F[1], 1], Q8t.null[0]), -2.6, 1.0, 'N = [−F; 1] = (−1, −1, 1) ✓');
  },
], { cam: [[0, 3.6, 13.5], [0, 3.4, 0]], setup: async (tok, S) => { S.M = A8t.map((r) => r.slice()); } });

// ════════ 9Q1q7s1jTzU（L8）：Ax = b 的完整解、rank 與解的個數 ════════
// 同一個 A = [1 2 2 2; 2 4 6 8; 3 6 8 10]；右邊 b 用「係數向量」[c₁, c₂, c₃]（= c₁b₁ + c₂b₂ + c₃b₃）一起做列運算。
const BN = ['b₁', 'b₂', 'b₃'];
function bstr(c) {
  let s = '';
  for (let i = c.length - 1; i >= 0; i--) {
    const k = c[i]; if (Math.abs(k) < 1e-12) continue;
    const a = Math.abs(k), coef = a === 1 ? '' : fmt(a);
    s += (s ? (k < 0 ? '−' : '+') : (k < 0 ? '−' : '')) + coef + BN[i];
  }
  return s || '0';
}
const B8 = [1, 5, 6], XP8 = [-2, 0, 3 / 2, 0];
function augOp(S, i, f, j) {
  S.M[i] = S.M[i].map((x, k) => x - f * S.M[j][k]); S.bc[i] = S.bc[i].map((x, k) => x - f * S.bc[j][k]);
  if (S.bn) S.bn[i] = S.bn[i] - f * S.bn[j];
  S.g.clearGlow(); S.g.setAll(S.M); S.bc.forEach((c, a) => S.bg.set(a, 0, bstr(c))); S.g.row(i, GOLD); S.bg.clearGlow(); glow(S.bg.c[i][0], GOLD);
  if (S.nb) S.bn.forEach((v, a) => relabel(S.nb[a], fmt(v)));
}
const solve2 = (M, b) => { const E = rrefSteps(M.map((r, i) => [...r, b[i]])); return E; };

scene('vsA-l8-aug', 'L8：增廣矩陣 [A | b] 消去：0 = b₃ − b₂ − b₁', [
  async (tok, S) => { cap('同一個矩陣 A（上一講的例子）', '目標：完整解出 Ax = b'); },
  async (tok, S) => {
    cap('第 3 列 = 第 1 列 + 第 2 列', '左邊加起來會撞在一起');
    S.g.row(0, GOLD); S.g.row(1, GOLD); S.g.row(2, GREEN);
    S.k = ok(same(addv(A8[0], A8[1]), A8[2]), 3.2, 6.2, '列 1 + 列 2 = 列 3 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); cap('所以 b₁、b₂、b₃ 要滿足某個條件', '消去法會把它找出來'); },
  async (tok, S) => {
    cap('例如 b = (1, 5, 17)：沒有解', '');
    S.e1 = pl('b = (1, 5, 17)', 3.6, 5.4); S.e1k = ok(solve2(A8, [1, 5, 17]).piv.includes(4), 3.6, 4.8, '無解 ✓');
  },
  async (tok, S) => {
    cap('b₁ = 1、b₂ = 5 時，b₃ 只能是 6', '要 b₁ + b₂ = b₃');
    S.e2 = pl('b = (1, 5, 6)', 3.6, 4.2); S.e2k = ok(!solve2(A8, B8).piv.includes(4), 3.6, 3.6, '有解 ✓');
  },
  async (tok, S) => { cap('左邊某個組合 = 0 → 右邊同一組合也要 = 0', '列1 + 列2 − 列3 = 0 ⇒ b₁ + b₂ − b₃ = 0'); },
  async (tok, S) => {
    gone(S.k, S.e1, S.e1k, S.e2, S.e2k);
    cap('把 b 接在 A 右邊：增廣矩陣 [A | b]', '對 b 做一樣的列運算');
    S.bg = mgrid(S.bc.map((c) => [bstr(c)]), S.g.xs[3] + 0.78, 5.4, 0, { widths: [1.5], color: () => '#f0d9a8' });
    hd('[A | b]', -1.6, 6.3);
  },
  async (tok, S) => { cap('R2 − 2·R1', '右邊變成 b₂ − 2b₁'); augOp(S, 1, 2, 0); },
  async (tok, S) => { cap('R3 − 3·R1', '右邊變成 b₃ − 3b₁'); augOp(S, 2, 3, 0); },
  async (tok, S) => { S.g.clearGlow(); cap('pivot 在第 1、3 欄', ''); tint(S.g.c[0][0], COL.a); tint(S.g.c[1][2], COL.a); },
  async (tok, S) => { cap('R3 − R2：左邊整列 0', '右邊 = b₃ − b₂ − b₁'); augOp(S, 2, 1, 1); },
  async (tok, S) => {
    S.g.clearGlow(); S.bg.clearGlow(); S.g.row(2, RED); glow(S.bg.c[2][0], RED);
    cap('最後一式：0 = b₃ − b₂ − b₁', '這就是有解的條件');
    S.k = ok(same(S.bc[2], [-1, -1, 1]), 3.2, 6.2, '最後一列右邊 = b₃ − b₂ − b₁ ✓');
  },
  async (tok, S) => {
    S.g.clearGlow(); S.bg.clearGlow();
    cap('b = (1, 5, 6)：右邊變成 (1, 3, 0)', '');
    const rhs = S.bc.map((c) => dot(c, B8));
    S.nb = rhs.map((v, i) => cube(fmt(v), '#cfe6c4', [0.62, 0.62, 0.3], 3.4, 5.4 - i * 0.78, 0)); sm('b = (1,5,6)', 3.4, 6.1);
    S.k2 = ok(same(rhs, [1, 3, 0]), 3.2, 3.0, '最後一列 0 = 0 ✓');
  },
  async (tok, S) => { cap('最後一式 0 = 0 沒問題', '剩下 2 個方程式、4 個未知數'); S.g.row(0, GREEN); S.g.row(1, GREEN); },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => {
  S.M = A8.map((r) => r.slice()); S.bc = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  S.g = mgrid(A8, -4.6, 5.4, 0);
} });

scene('vsA-l8-solv', 'L8：可解條件的兩種說法', [
  async (tok, S) => { cap('可解性：右邊 b 要滿足什麼？', ''); S.g.row(2, RED); },
  async (tok, S) => { S.g.clearGlow(); cap('之前的答案：b 在 column space 裡', 'Ax = b 可解 ⇔ b ∈ C(A)'); good('Ax = b 可解 ⇔ b ∈ C(A)', 2.6, 6.3); },
  async (tok, S) => {
    cap('b 必須是欄的組合', '例：(1, 5, 6) 是欄的組合');
    S.k = ok(same(mulMV(A8, XP8), B8), 2.6, 5.7, '−2·欄1 + (3/2)·欄3 = (1, 5, 6) ✓');
  },
  async (tok, S) => {
    cap('另一種說法：若列的某個組合 = 0 列', '列 1 + 列 2 − 列 3 = 0');
    S.g.row(0, GOLD); S.g.row(1, GOLD); S.g.row(2, GOLD);
    S.k2 = ok(isZ(addv(addv(A8[0], A8[1]), scl(A8[2], -1))), 2.6, 5.1, '列1 + 列2 − 列3 = 0 ✓');
  },
  async (tok, S) => {
    cap('那 b 的同一組合也必須 = 0', 'b₁ + b₂ − b₃ = 0');
    S.g.clearGlow();
    S.k3 = ok(B8[0] + B8[1] - B8[2] === 0, 2.6, 4.5, 'b = (1,5,6)：1 + 5 − 6 = 0 ✓');
    bad('b = (1,5,17)：1 + 5 − 17 = −11 → 無解', 2.6, 3.9);
  },
  async (tok, S) => { cap('兩種說法等價', '都等於「Ax = b 有解」'); },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => {
  S.g = mgrid(A8, -6.2, 5.4, 0, { color: () => '#d9cbb2' }); hd('A', -5.4, 6.1);
} });

scene('vsA-l8-xp', 'L8：特解 x_p：free 變數設 0', [
  async (tok, S) => { cap('有解的時候，要把解找出來', ''); },
  async (tok, S) => { cap('步驟 1：先找一個特解 x_p', 'particular solution'); hot('x_p', 3.4, 6.2); },
  async (tok, S) => { cap('把所有 free 變數設成 0', '它們可以隨便給，0 最方便'); },
  async (tok, S) => { cap('再解出 pivot 變數', '剩下一定只有一種解法'); },
  async (tok, S) => {
    cap('x₂ = 0、x₄ = 0（沒有 pivot 的欄）', '');
    S.g.paintCol(1, '#eee4d2'); S.g.paintCol(3, '#eee4d2'); relabel(S.x[1], 0); relabel(S.x[3], 0);
  },
  async (tok, S) => {
    cap('剩下：x₁ + 2x₃ = 1、2x₃ = 3', '只用 pivot 欄');
    S.cd = code(['x₁ + 2x₃ = 1', '     2x₃ = 3'], -3.0, 2.2, 0.6);
  },
  async (tok, S) => { cap('回代：x₃ = 3/2', ''); S.cd.hl(1); relabel(S.x[2], '3/2'); glow(S.x[2], GOLD); },
  async (tok, S) => { glow(S.x[2], null); cap('x₁ = 1 − 2x₃ = −2', ''); S.cd.hl(0); relabel(S.x[0], -2); glow(S.x[0], GOLD); },
  async (tok, S) => {
    glow(S.x[0], null);
    cap('x_p = (−2, 0, 3/2, 0)', '');
    const E = solve2(A8, B8), xp = [0, 0, 0, 0]; E.piv.forEach((c, k) => { xp[c] = E.R[k][4]; });
    S.k = ok(same(xp, XP8), 0.6, 1.4, 'x_p = (−2, 0, 3/2, 0) ✓');
  },
  async (tok, S) => {
    cap('代回原本的方程式檢查', '考試時記得做');
    const r = mulMV(A8, XP8);
    S.chk = A8.map((row, i) => ok(r[i] === B8[i], 0.6, 0.8 - i * 0.55, '第 ' + (i + 1) + ' 式：' + fmt(r[i]) + ' = ' + B8[i] + ' ✓'));
  },
], { cam: [[0, 3.4, 12.5], [0, 3.4, 0]], setup: async (tok, S) => {
  const M = [[1, 2, 2, 2, 1], [0, 0, 2, 4, 3], [0, 0, 0, 0, 0]];
  const E = rrefSteps(A8.map((r, i) => [...r, B8[i]]));
  S.g = mgrid(M, -4.8, 5.4, 0, { color: (i, j) => (j === 4 ? '#f0d9a8' : (i === 0 && j === 0) || (i === 1 && j === 2) ? COL.a : '#d9cbb2') });
  ['x₁', 'x₂', 'x₃', 'x₄', 'b'].forEach((n, j) => sm(n, S.g.xs[j], 6.1));
  S.x = ['?', '?', '?', '?'].map((v, i) => cube(v, i % 2 ? '#eee4d2' : COL.a, [0.62, 0.62, 0.3], 3.4, 5.4 - i * 0.78, 0));
  S.ok0 = ok(E.rank === 2 && !E.piv.includes(4), -2.4, 6.7, '[A | b] 消去後 0 = 0 ✓');
} });

scene('vsA-l8-complete', 'L8：完整解 x = x_p + x_n', [
  async (tok, S) => { cap('x_p 只是一個解，我們要全部', ''); },
  async (tok, S) => { cap('加上 null space 裡的任何向量', ''); },
  async (tok, S) => { cap('完整解：x = x_p + x_n', ''); S.cd = code(['x = x_p + x_n', 'A x_p = b', 'A x_n = 0', 'A(x_p + x_n) = b + 0 = b'], -6.6, 6.0, 0.55); S.cd.hl(0); },
  async (tok, S) => { cap('A x_p = b', ''); S.cd.hl(1); },
  async (tok, S) => { cap('A x_n = 0', ''); S.cd.hl(2); },
  async (tok, S) => {
    cap('相加：A(x_p + x_n) = b + 0 = b', '一個解 + null space 的東西 = 還是解');
    S.cd.hl(3); const xn = addv(S.N[0], scl(S.N[1], 2));
    S.k = ok(same(mulMV(A8, addv(XP8, xn)), B8), -6.6, 3.6, '例：A(x_p + s₁ + 2s₂) = b ✓');
  },
  async (tok, S) => {
    gone(S.k);
    cap('x_p 加上兩個 special solutions 的組合', 's₁ = (−2, 1, 0, 0)、s₂ = (2, 0, −2, 1)');
    S.bp = bar(XP8, -0.4, 2.6, 0, COL.r, { k: 0.4 }); hot('x_p', S.bp.mid, 4.2);
    S.b1 = bar(S.N[0], 2.0, 2.6, 0, COL.c, { k: 0.4 }); hot('s₁', S.b1.mid, 4.2);
    S.b2 = bar(S.N[1], 4.4, 2.6, 0, COL.d, { k: 0.4 }); hot('s₂', S.b2.mid, 4.2);
    S.k = ok(same(S.N[0], [-2, 1, 0, 0]) && same(S.N[1], [2, 0, -2, 1]), 2.0, 5.0, 's₁、s₂ 正確 ✓');
  },
  async (tok, S) => {
    cap('x = x_p + c₁s₁ + c₂s₂', 'c₁、c₂ 任意');
    S.bx = bar(XP8, -0.4, 0.2, 0, COL.g, { k: 0.4 }); hot('x', S.bx.mid, -0.6);
    let cur = XP8, allok = true;
    for (const [a, b] of [[1, 0], [0.5, 1], [-1, 0.5]]) { const tg = addv(XP8, addv(scl(S.N[0], a), scl(S.N[1], b))), fr = cur; allok = allok && same(mulMV(A8, tg), B8); await anim(tok, 600, (t) => S.bx.set(addv(fr, scl(addv(tg, scl(fr, -1)), t)))); cur = tg; }
    S.k2 = ok(allok, 3.4, 0.2, '每一個 x 都滿足 Ax = b ✓');
  },
  async (tok, S) => {
    cap('x_p 前面不能乘常數', 'A(3x_p) = 3b ≠ b');
    S.k3 = ok(!same(mulMV(A8, scl(XP8, 3)), B8), 3.4, -0.4, 'A(3x_p) ≠ b ✓');
  },
  async (tok, S) => { cap('x_n 可以乘 3、可以相加', '右邊一直是 0'); },
  async (tok, S) => {
    gone(S.cd, S.bp, S.b1, S.b2, S.bx, S.k, S.k2, S.k3);
    cap('把所有解畫出來：x 在 R⁴（4 維）', '示意：用 3D 畫');
    S.S = space3(0, 2.6, 0, 0.8, 2.6, ['', '', '']); sy(0, 0, 6.3);
  },
  async (tok, S) => { cap('所有解會形成子空間嗎？不會', ''); },
  async (tok, S) => {
    cap('N(A)：R⁴ 裡的 2 維子空間', '兩個參數 c₁、c₂ → 像一個平面');
    S.Np = S.S.plane(S.u, S.v, COL.gray, 0); await anim(tok, 700, (t) => S.Np.fade(0.2 * t));
    const p = S.S.w(addv(S.u, S.v)); sm('N(A)', p.x, p.y, p.z);
  },
  async (tok, S) => { cap('x_p 在某個地方', ''); S.ap = S.S.arrow([0, 0, 0], COL.r, 'x_p'); await grow(tok, S.S, S.ap, S.xp); },
  async (tok, S) => {
    cap('x = x_p + x_n：整個平面平移到 x_p', '');
    S.Pp = S.S.plane(S.u, S.v, COL.b, 0); await anim(tok, 1200, (t) => { S.Pp.fade(0.26 * t); S.Pp.setSpan(S.u, S.v, scl(S.xp, t)); });
    const xn = addv(scl(S.u, 0.7), scl(S.v, -0.5)); S.ax = S.S.arrow(addv(S.xp, xn), COL.g, 'x'); S.an = S.S.arrow([0, 0, 0], COL.gray, 'x_n'); S.S.set(S.an, xn, S.xp);
  },
  async (tok, S) => { cap('像子空間，但被移離原點', '不含 0 → 不是子空間'); bad('不過原點 → 不是子空間', 0, 5.7); },
], { cam: [[0, 3.6, 13], [0, 3.0, 0]], setup: async (tok, S) => { S.N = Q8.null; S.u = [1.2, -0.6, 0.2]; S.v = [0.3, 1.1, -0.4]; S.xp = [0.4, -0.3, 1.6]; } });

scene('vsA-l8-rankbound', 'L8：rank 的範圍：r ≤ m、r ≤ n', [
  async (tok, S) => { cap('一般的 m×n 矩陣，rank r', '例：A 是 3×4，r = 2'); sm('n = 4 欄', -2.9, 6.3); sm('m = 3 列', -6.6, 4.6); },
  async (tok, S) => {
    cap('rank 的定義：pivot 的個數', '');
    S.g.setAll(E8.R); E8.piv.forEach((c, k) => { tint(S.g.c[k][c], COL.a); glow(S.g.c[k][c], GREEN); }); hd('R', -1.4, 5.4);
    S.k = ok(E8.rank === 2, 1.4, 6.0, 'r = 2 ✓');
  },
  async (tok, S) => {
    cap('r ≤ m：每一列最多一個 pivot', '');
    for (let i = 0; i < 3; i++) { S.g.row(i, GOLD); await wt(tok, 300); S.g.row(i, null); }
    E8.piv.forEach((c, k) => glow(S.g.c[k][c], GREEN));
    S.k2 = ok(E8.rank <= 3, 1.4, 5.4, 'r = 2 ≤ m = 3 ✓');
  },
  async (tok, S) => {
    cap('r ≤ n：每一欄最多一個 pivot', '');
    for (let j = 0; j < 4; j++) { S.g.col(j, GOLD); await wt(tok, 250); S.g.col(j, null); }
    E8.piv.forEach((c, k) => glow(S.g.c[k][c], GREEN));
    S.k3 = ok(E8.rank <= 4, 1.4, 4.8, 'r = 2 ≤ n = 4 ✓');
  },
  async (tok, S) => { cap('full rank：r 盡量大', '兩種情形：r = n 或 r = m'); },
], { cam: [[0, 3.4, 12.5], [0, 3.8, 0]], setup: async (tok, S) => { S.g = mgrid(A8, -5.4, 5.4, 0); } });

const AC = [[1, 3], [2, 1], [6, 1], [5, 1]], EC = rrefSteps(AC);
scene('vsA-l8-fullcol', 'L8：full column rank r = n：0 或 1 個解', [
  async (tok, S) => { cap('full column rank：r = n', ''); hd('r = n', -5.0, 6.4); },
  async (tok, S) => { cap('每一欄都有 pivot', ''); S.g.c.forEach((r, i) => r.forEach((m, j) => { if (i === j) { tint(m, COL.a); relabel(m, '■'); } })); },
  async (tok, S) => { cap('沒有 free 變數', 'n 個變數全是 pivot 變數'); },
  async (tok, S) => { cap('N(A) 只有零向量', '沒有 free 變數可以給 1'); good('N(A) = {0}', -1.4, 6.4); },
  async (tok, S) => { cap('完整解就只有 x = x_p', '沒有 null space 可以加'); },
  async (tok, S) => { cap('若有解就唯一：0 或 1 個解', ''); good('0 或 1 個解', -1.4, 5.8); },
  async (tok, S) => {
    cap('例子：又高又瘦的 4×2 矩陣', '[1 3; 2 1; 6 1; 5 1]');
    S.g.c.forEach((r) => r.forEach((m) => tint(m, '#d9cbb2'))); S.g.setAll(AC); S.g.paintCol(0, COL.a); S.g.paintCol(1, COL.b);
  },
  async (tok, S) => { cap('rank = 2：兩欄方向不同', ''); S.k = ok(EC.rank === 2, 0.6, 4.6, 'rank = 2 = n ✓'); },
  async (tok, S) => {
    cap('R = [I; 0]：上面 2×2 單位矩陣、下面全 0', '');
    S.R = mgrid(EC.R, -3.4, 5.4, 0, { color: (i, j) => (i === j ? COL.a : '#e7dcc8') }); hd('R', -3.0, 6.2);
    S.k2 = ok(sameM(EC.R, [[1, 0], [0, 1], [0, 0], [0, 0]]), 0.6, 4.0, 'R = [I; 0] ✓');
  },
  async (tok, S) => { cap('N(A) 只有 0：只有 0·欄1 + 0·欄2 = 0', ''); S.k3 = ok(nullBasis(EC.R, EC.piv, 2).length === 0, 0.6, 3.4, 'N(A) = {0} ✓'); },
  async (tok, S) => { gone(S.k, S.k2, S.k3); cap('4 個方程式、2 個未知數', '不是每個 b 都有解'); },
  async (tok, S) => {
    cap('隨便挑 b：通常無解', '示意：b = (1, 0, 0, 0)');
    S.k = ok(rk(AC.map((r, i) => [...r, [1, 0, 0, 0][i]])) === 3, 0.6, 4.6, 'b = (1,0,0,0)：無解 ✓'); sy(0, 4.6, 5.2);
  },
  async (tok, S) => { cap('b = 0：當然有解 x = 0', ''); },
  async (tok, S) => {
    cap('b = (4, 3, 7, 6) = 欄 1 + 欄 2', '唯一解 x = (1, 1)');
    const E = rrefSteps(AC.map((r, i) => [...r, [4, 3, 7, 6][i]]));
    S.k2 = ok(same(mulMV(AC, [1, 1]), [4, 3, 7, 6]) && E.rank === 2 && !E.piv.includes(2), 0.6, 4.0, 'x = (1, 1) 是唯一解 ✓');
  },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => {
  S.g = mgrid([['', ''], ['', ''], ['', ''], ['', '']], -6.2, 5.4, 0); sm('示意：每欄一個 pivot', -5.6, 1.9);
} });

const AR = [[1, 2, 6, 5], [3, 1, 1, 1]], ER = rrefSteps(AR);
scene('vsA-l8-fullrow', 'L8：full row rank r = m：每個 b 都有解', [
  async (tok, S) => { cap('full row rank：r = m', ''); hd('r = m', -5.0, 6.4); },
  async (tok, S) => { cap('每一列都有 pivot', ''); [[0, 0], [1, 1]].forEach(([i, j]) => { tint(S.g.c[i][j], COL.a); relabel(S.g.c[i][j], '■'); }); },
  async (tok, S) => { cap('消去後沒有零列', '→ 對 b 沒有任何條件'); },
  async (tok, S) => { cap('每個 b 都解得出來', '有解（existence）'); good('每個 b 都有解', -1.0, 6.4); },
  async (tok, S) => { cap('free 變數：n − r = n − m 個', ''); good('free 變數 n − m 個', -1.0, 5.8); },
  async (tok, S) => {
    cap('例子：把上一個例子轉置', '[1 2 6 5; 3 1 1 1]，2×4');
    S.g.c.forEach((r) => r.forEach((m) => tint(m, '#d9cbb2'))); S.g.setAll(AR);
  },
  async (tok, S) => { cap('rank = 2', ''); S.k = ok(ER.rank === 2, 0.6, 4.6, 'rank = 2 = m ✓'); },
  async (tok, S) => { cap('pivot 欄：第 1、2 欄', ''); S.g.paintCol(0, COL.a); S.g.paintCol(1, COL.a); S.k2 = ok(same(ER.piv, [0, 1]), 0.6, 4.0, 'pivot 欄 = 1、2 ✓'); },
  async (tok, S) => {
    cap('R = [I F]：F 是 free 欄的部分', '');
    S.R = mgrid(ER.R, -6.4, 3.4, 0, { gap: 0.95, size: 0.82, color: (i, j) => (j < 2 ? (i === j ? COL.a : '#e7dcc8') : '#f0d9a8') }); hd('R', -6.9, 3.4);
    S.k3 = ok(sameM(ER.R, [[1, 0, -4 / 5, -3 / 5], [0, 1, 17 / 5, 14 / 5]]), 0.6, 3.4, 'R = [1 0 −4/5 −3/5; 0 1 17/5 14/5] ✓');
  },
  async (tok, S) => { cap('沒有零列；F 會進到 special solutions', 'n − r = 2 個 special solutions'); S.k4 = ok(nullBasis(ER.R, ER.piv, 4).length === 2, 0.6, 2.8, '2 個 special solutions ✓'); },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => {
  S.g = mgrid([['', '', '', ''], ['', '', '', '']], -6.2, 5.4, 0); sm('示意：每列一個 pivot', -5.0, 3.9);
} });

scene('vsA-l8-cases', 'L8：r = m = n 與 rank 的四種情況', [
  async (tok, S) => { cap('最重要的情形：r = m = n', ''); },
  async (tok, S) => { cap('例子：[1 2; 3 1]', ''); S.g = mgrid([[1, 2], [3, 1]], -6.2, 5.8, 0, { color: () => COL.a }); hd('A', -5.8, 6.5); },
  async (tok, S) => { cap('方陣，而且滿秩（full rank）', 'r = 2 = m = n'); S.k = ok(rk([[1, 2], [3, 1]]) === 2, -3.2, 6.4, 'rank = 2 ✓'); },
  async (tok, S) => { cap('就是可逆（invertible）矩陣', ''); S.k2 = ok(1 * 1 - 2 * 3 === -5, -3.2, 5.8, 'det = 1 − 6 = −5 ≠ 0 ✓'); },
  async (tok, S) => { cap('R = I', ''); S.g.setAll(rrefSteps([[1, 2], [3, 1]]).R); S.k3 = ok(sameM(rrefSteps([[1, 2], [3, 1]]).R, [[1, 0], [0, 1]]), -3.2, 5.2, 'R = I ✓'); },
  async (tok, S) => { cap('N(A) = {0}', ''); },
  async (tok, S) => { cap('對 b₁、b₂ 沒有任何條件', ''); },
  async (tok, S) => { cap('每個 b 都有解，而且唯一', 'r = m → 有解；r = n → 唯一'); },
  async (tok, S) => { gone(S.g, S.k, S.k2, S.k3); cap('總表 1：r = m = n', 'R = I → 恰 1 個解'); await S.box(0); },
  async (tok, S) => { cap('總表 2：r = n < m', 'R = [I; 0] → 0 或 1 個解'); await S.box(1); },
  async (tok, S) => { cap('老師這裡把條件更正為 r = n', '上一格是 full column rank'); note('老師口誤後更正：[I; 0] 是 r = n', 2.4, 6.6); },
  async (tok, S) => { cap('總表 3：r = m < n', 'R = [I F] → 一定有解'); await S.box(2); },
  async (tok, S) => { cap('而且一定有 null space', '→ 無限多個解'); },
  async (tok, S) => { cap('總表 4：r < m 且 r < n', 'R = [I F; 0 0] → 0 或 ∞ 個解'); await S.box(3); },
  async (tok, S) => { cap('rank 決定解的個數', '只有確切數值要回到矩陣算'); },
], { cam: [[0, 3.4, 13], [0, 3.4, 0]], setup: async (tok, S) => {
  const cases = [
    ['r = m = n', 'R = I', '恰 1 個解', -3.8, 4.4, COL.d, [[1, 2], [3, 1]]],
    ['r = n < m', 'R = [I; 0]', '0 或 1 個解', 3.8, 4.4, COL.a, AC],
    ['r = m < n', 'R = [I F]', '∞ 個解', -3.8, 1.6, COL.b, AR],
    ['r < m, r < n', 'R = [I F; 0 0]', '0 或 ∞ 個解', 3.8, 1.6, COL.c, A8],
  ];
  S.box = async (k) => {
    const [c, r, a, x, y, col, M] = cases[k], m = M.length, n = M[0].length, rr = rk(M);
    const right = k === 0 ? rr === m && rr === n : k === 1 ? rr === n && rr < m : k === 2 ? rr === m && rr < n : rr < m && rr < n;
    cube('', col, [3.8, 2.1, 0.25], x, y, -0.3, 2.5);
    hd(c, x, y + 0.6, 0.1); mono(tag(r, '', x, y, 0.1)); hot(a, x, y - 0.6, 0.1);
    ok(right, x, y - 1.25, '例：' + m + '×' + n + '，r = ' + rr + ' ✓', 0.1);
    await wt(tok, 400);
  };
} });

// ════════ yjBerM5jWsc（L9）：線性獨立、span、basis、dimension ════════
// R² 的例子：v₁ = (2, 1)、v₂ = (1, 2)、v₃ = (2.5, −1)（老師目測黑板上的圖說的數字）。
// R³：(1,1,2)、(2,2,5)；老師說 (3,3,8) 可以當第三個——程式算出它其實也在平面上（老師在 L10 開頭自己更正）。
// 最後的矩陣 A = [1 2 3 1; 1 1 2 1; 1 2 3 1]。
const W1 = [2, 1, 0], W2 = [1, 2, 0], W3 = [2.5, -1, 0];
const A2 = [[2, 1, 2.5], [1, 2, -1]], Q2 = subspaces(A2), Q2i = subspaces([[2, 1], [1, 2]]);
const A9 = [[1, 2, 3, 1], [1, 1, 2, 1], [1, 2, 3, 1]], E9 = rrefSteps(A9), Q9 = subspaces(A9), C9 = T(A9);
const VB1 = [1, 1, 2], VB2 = [2, 2, 5];
const V2D = { cam: [[0, 8, 9], [0, 2.4, 0]], view: [0, 62, 10, [0, 2.4, -0.4]] };
// head-to-tail chain of c_k·v_k starting at 0; returns arrows
async function chain(tok, Sp, vecs, cs, colors, ms = 450) {
  let p = [0, 0, 0]; const out = [];
  for (let k = 0; k < vecs.length; k++) {
    const d = scl(vecs[k], cs[k]), a = Sp.arrow([0, 0, 0], colors[k], fmt(cs[k]) + '·v' + '₁₂₃'[k]); out.push(a);
    const from = p; await anim(tok, ms, (t) => Sp.set(a, scl(d, t), from)); p = addv(p, d);
  }
  return { arrows: out, end: p };
}

scene('vsA-l9-free', 'L9：未知數比方程式多 ⇒ Ax = 0 有非零解', [
  async (tok, S) => { cap('先講一個很重要的事實', ''); },
  async (tok, S) => {
    cap('A 的欄比列多：n > m', '方程式少、未知數多');
    S.g = mgrid(A2, -5.6, 5.2, 0); hd('A：m = 2、n = 3', -4.0, 6.0); sy(0, -4.4, 3.4);
  },
  async (tok, S) => { cap('結論：N(A) 裡有非零的 x', '也就是 Ax = 0 有 special solutions'); },
  async (tok, S) => {
    cap('理由：消去法化成 echelon form', '每列最多一個 pivot');
    S.g.setAll(Q2.R); Q2.piv.forEach((c, k) => tint(S.g.c[k][c], COL.a)); hd('R', -6.3, 4.4);
  },
  async (tok, S) => {
    cap('pivot 最多 m 個 → 至少 n − m 個 free 變數', '這裡 3 − 2 = 1');
    S.g.paintCol(2, COL.b); S.k = ok(3 - Q2.rank >= 3 - 2, 0.6, 5.6, 'free 變數 ≥ n − m = 1 ✓');
  },
  async (tok, S) => {
    cap('free 變數設 1，再解 pivot 變數', '得到一個「不全為 0」的解');
    const x = Q2.null[0]; S.k2 = ok(!isZ(x) && isZ(mulMV(A2, x)), 0.6, 5.0, 'x = ' + vs(x) + '，Ax = 0 ✓');
  },
], { cam: [[0, 3.4, 12], [0, 3.6, 0]] });

scene('vsA-l9-indep', 'L9：線性獨立的定義', [
  async (tok, S) => { cap('一群向量什麼時候叫「獨立」？', ''); },
  async (tok, S) => {
    cap('x₁, …, xₙ 線性獨立，如果……', '示意：R³ 裡三個向量');
    S.as = [S.u, S.v, S.w].map((x, k) => S.S.arrow(x, [COL.a, COL.b, COL.c][k], 'x' + '₁₂₃'[k])); sy(0, -4.6, 6.2);
  },
  async (tok, S) => {
    cap('問題：有沒有組合會得到 0？', 'c₁x₁ + c₂x₂ + c₃x₃ = 0 ?');
    S.ch = await chain(tok, S.S, [S.u, S.v, S.w], [1, 0.8, -0.6], [COL.a, COL.b, COL.c]);
    S.k = ok(!isZ(S.ch.end), 3.6, 6.2, '這個組合 ≠ 0 ✓');
  },
  async (tok, S) => {
    gone(S.ch.arrows, S.k);
    cap('若某個「不全為 0」的組合 = 0 → 相依', '示意：把 x₃ 換成 x₁ + x₂');
    S.as[2].visible = false; showL(S.as[2].lbl, false);
    const w2 = addv(S.u, S.v); S.d = S.S.arrow(w2, COL.r, 'x₃ = x₁ + x₂');
    S.ch = await chain(tok, S.S, [S.u, S.v, w2], [1, 1, -1], [COL.a, COL.b, COL.r]);
    S.k = ok(isZ(S.ch.end), 3.6, 6.2, '1·x₁ + 1·x₂ − 1·x₃ = 0 ✓ → 相依');
  },
  async (tok, S) => {
    gone(S.ch.arrows, S.k, S.d); S.as[2].visible = true; showL(S.as[2].lbl, true);
    cap('獨立：只有全 0 的組合會得到 0', '');
    S.cd = code(['c₁x₁ + … + cₙxₙ ≠ 0', '（除非 c₁ = … = cₙ = 0）'], -6.4, 1.4, 0.55);
    S.k = ok(rk([S.u, S.v, S.w]) === 3, 3.6, 6.2, 'x₁、x₂、x₃ 獨立（rank 3）✓');
  },
], Object.assign({}, V6, { setup: async (tok, S) => { S.S = space3(0, 2.6, 0, 1, 2.5); S.u = [1.4, 0.3, 0.5]; S.v = [-0.4, 1.3, 0.7]; S.w = [0.3, -0.5, 1.4]; } }));

scene('vsA-l9-r2', 'L9：R² 的例子：v 和 2v、零向量、三個向量', [
  async (tok, S) => { cap('在二維平面 R² 裡看例子', ''); },
  async (tok, S) => { cap('v 和 2v', '示意：v = (1, 0.5)'); S.a = S.S.arrow([0, 0, 0], COL.a, 'v₁ = v'); S.b = S.S.arrow([0, 0, 0], COL.b, 'v₂ = 2v'); await anim(tok, 600, (t) => { S.S.set(S.b, scl([2, 1, 0], t)); S.S.set(S.a, scl([1, 0.5, 0], t)); }); },
  async (tok, S) => { cap('相依：一個是另一個的兩倍', ''); },
  async (tok, S) => {
    cap('2·v₁ − v₂ = 0', '一個不全為 0 的組合');
    S.ch = await chain(tok, S.S, [[1, 0.5, 0], [2, 1, 0]], [2, -1], [COL.a, COL.b]);
    S.k = ok(isZ(S.ch.end), -3.8, 6.0, '2·v₁ − v₂ = 0 ✓');
  },
  async (tok, S) => {
    gone(S.a, S.b, S.ch.arrows, S.k);
    cap('另一例：v₁ 和零向量', 'v₁ = (2, 1)、v₂ = 0');
    S.a = S.S.arrow([2, 1, 0], COL.a, 'v₁ = (2, 1)'); S.o = S.S.ball([0, 0, 0], COL.r, 0.16); const p = S.S.w([0, -0.5, 0]); S.l0 = hot('v₂ = 0', p.x, p.y, p.z);
  },
  async (tok, S) => { cap('還是相依', ''); },
  async (tok, S) => {
    cap('0·v₁ + 6·v₂ = 0', '取 0 個 v₁、6 個 v₂');
    S.k = ok(isZ(addv(scl([2, 1], 0), scl([0, 0], 6))), -3.8, 6.0, '0·v₁ + 6·v₂ = 0 ✓（係數不全為 0）');
    await flash(tok, S.o, GOLD, 2);
  },
  async (tok, S) => { cap('只要有零向量，就不可能獨立', ''); S.l1 = bad('有 0 向量 → 一定相依', -3.8, 5.4); },
  async (tok, S) => {
    gone(S.a, S.o, S.k, S.l0, S.l1);
    cap('兩個不同方向的向量：獨立', 'v₁ = (2, 1)、v₂ = (1, 2)');
    S.a1 = S.S.arrow(W1, COL.a, 'v₁'); S.a2 = S.S.arrow(W2, COL.b, 'v₂');
    S.k = ok(rk([W1, W2]) === 2, -3.8, 6.0, 'v₁、v₂ 獨立 ✓');
  },
  async (tok, S) => { gone(S.k); cap('再放進第三個向量 v₃', '三個向量在平面上'); S.a3 = S.S.arrow([0, 0, 0], COL.c, 'v₃'); await grow(tok, S.S, S.a3, W3); },
  async (tok, S) => { cap('相依！', '為什麼一定相依？'); },
  async (tok, S) => {
    cap('把它們放進矩陣的欄：A 是 2×3', 'v₁ ≈ (2, 1)、v₂ ≈ (1, 2)、v₃ ≈ (2.5, −1)');
    S.g = mgrid(A2, 2.6, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); hd('A', 3.4, 6.3);
  },
  async (tok, S) => { cap('2×3：未知數比方程式多 → 有 free 變數', '就是剛剛那個重要事實'); S.k = ok(Q2.rank < 3, 2.0, 3.4, 'rank 2 < 3 → 有非零的 c ✓'); },
  async (tok, S) => {
    cap('c = (−2, 1.5, 1)：−2v₁ + 1.5v₂ + v₃ = 0', '走出去、再走回原點');
    const c = Q2.null[0];
    S.ch = await chain(tok, S.S, [W1, W2, W3], c, [COL.a, COL.b, COL.c], 600);
    S.k2 = ok(isZ(S.ch.end) && same(c, [-2, 1.5, 1]), 2.0, 2.8, '−2v₁ + 1.5v₂ + v₃ = 0 ✓');
  },
], Object.assign({}, V2D, { setup: async (tok, S) => { S.S = space3(0, 2.4, 0, 0.9, 2.8, ['x', 'y', '']); } }));

scene('vsA-l9-nullind', 'L9：欄獨立 ⇔ N(A) = {0}', [
  async (tok, S) => { cap('把 v₁, …, vₙ 放成矩陣 A 的欄', '用矩陣回答獨立 / 相依'); },
  async (tok, S) => {
    cap('獨立 ⇔ N(A) 只有零向量', '');
    S.k = ok(Q2i.null.length === 0, -4.8, 2.4, 'N([v₁ v₂]) = {0} → 獨立 ✓');
  },
  async (tok, S) => {
    cap('相依 ⇔ 有非零的 c 讓 Ac = 0', '某個組合得到零欄');
    S.k2 = ok(Q2.null.length > 0, 2.2, 2.4, 'A(−2, 1.5, 1) = 0 → 相依 ✓');
  },
  async (tok, S) => {
    cap('獨立時：每欄都是 pivot 欄，rank = n', '沒有 free 變數');
    tint(S.gi.c[0][0], COL.a); tint(S.gi.c[1][1], COL.a); S.k3 = ok(Q2i.rank === 2, -4.8, 1.8, 'rank = n = 2 ✓');
  },
  async (tok, S) => {
    cap('相依時：rank < n，有 free 變數', 'free 欄是前面欄的組合');
    S.gd.paintCol(2, COL.b); S.k4 = ok(Q2.rank === 2 && Q2.rank < 3, 2.2, 1.8, 'rank = 2 < n = 3 ✓');
  },
  async (tok, S) => { cap('定義本身不需要矩陣', '但最常見的是「欄向量」，就回到 null space'); },
], { cam: [[0, 3.4, 12], [0, 3.6, 0]], setup: async (tok, S) => {
  S.gi = mgrid([[2, 1], [1, 2]], -5.6, 5.2, 0, { color: (i, j) => [COL.a, COL.b][j] }); hd('[v₁ v₂]', -5.2, 6.0);
  S.gd = mgrid(A2, 1.2, 5.2, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); hd('[v₁ v₂ v₃]', 2.0, 6.0);
} });

scene('vsA-l9-span', 'L9：span：所有線性組合', [
  async (tok, S) => { cap('一群向量「張成」（span）一個空間', '是什麼意思？'); S.a = S.S.arrow(S.u, COL.a, 'v₁'); S.b = S.S.arrow(S.v, COL.b, 'v₂'); sy(0, -4.6, 6.2); },
  async (tok, S) => { cap('其實見過了：欄的所有組合 = column space', ''); },
  async (tok, S) => {
    cap('span：空間裡就是這些向量的所有組合', '');
    S.c = S.S.arrow([0, 0, 0], COL.g, 'c₁v₁ + c₂v₂'); let cur = [0, 0, 0];
    for (const [a, b] of [[1, 1], [-1, 0.6], [0.7, -1.1]]) { const tg = addv(scl(S.u, a), scl(S.v, b)), fr = cur; await anim(tok, 500, (t) => S.S.set(S.c, addv(fr, scl(addv(tg, scl(fr, -1)), t)))); cur = tg; }
    S.P = S.S.plane(S.u, S.v, COL.b, 0); await anim(tok, 500, (t) => S.P.fade(0.22 * t));
  },
  async (tok, S) => { gone(S.c); cap('所以「欄 span 出 column space」', ''); },
  async (tok, S) => { cap('span = 含這些向量的最小空間', '要有它們，就一定要有所有組合'); },
  async (tok, S) => {
    cap('它們獨立嗎？不一定', '示意：再加一個在平面上的 v₃');
    S.w = S.S.arrow([0, 0, 0], COL.r, 'v₃'); await grow(tok, S.S, S.w, addv(scl(S.u, 0.5), scl(S.v, 0.8)));
    S.k = ok(rk([S.u, S.v, addv(scl(S.u, 0.5), scl(S.v, 0.8))]) === 2, 3.4, 6.2, 'v₁、v₂、v₃ 還是 span 平面，但相依 ✓');
  },
], Object.assign({}, V6, { setup: async (tok, S) => { S.S = space3(0, 2.6, 0, 1, 2.5); S.u = [1.4, 0.3, 0.5]; S.v = [-0.4, 1.3, 0.7]; } }));

scene('vsA-l9-basis', 'L9：basis = 獨立 + span', [
  async (tok, S) => { cap('又能 span、又獨立：數量剛剛好', '少了不夠，多了會相依'); },
  async (tok, S) => { cap('basis（基底）：一串向量，兩個性質', ''); S.cd = code(['basis v₁, …, v_d：', '① 線性獨立', '② span 整個空間'], -6.4, 1.6, 0.55); S.cd.hl(0); },
  async (tok, S) => { cap('性質一：獨立', ''); S.cd.hl(1); S.k = ok(rk([S.u, S.v]) === 2, 3.4, 6.2, 'v₁、v₂ 獨立 ✓'); },
  async (tok, S) => { cap('性質二：span 這個空間', ''); S.cd.hl(2); await anim(tok, 500, (t) => S.P.fade(0.12 + 0.12 * t)); },
  async (tok, S) => { cap('給出 basis，就把子空間說清楚了', '取所有組合就是它'); },
], Object.assign({}, V6, { setup: async (tok, S) => {
  S.S = space3(0, 2.6, 0, 1, 2.5); S.u = [1.4, 0.3, 0.5]; S.v = [-0.4, 1.3, 0.7];
  S.S.arrow(S.u, COL.a, 'v₁'); S.S.arrow(S.v, COL.b, 'v₂'); S.P = S.S.plane(S.u, S.v, COL.b, 0.12); sy(0, -4.6, 6.2);
} }));

scene('vsA-l9-r3', 'L9：R³ 的基底；(3, 3, 8) 其實不行', [
  async (tok, S) => { cap('例子：整個 R³ 的基底', ''); },
  async (tok, S) => {
    cap('第一個想到的：(1,0,0)、(0,1,0)、(0,0,1)', 'x、y、z 軸方向');
    S.e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v, i) => S.S.arrow(v, [COL.a, COL.b, COL.c][i], 'e' + '₁₂₃'[i]));
  },
  async (tok, S) => { cap('獨立：c₁e₁ + c₂e₂ + c₃e₃ = 0 ⇒ c 全為 0', ''); },
  async (tok, S) => {
    cap('寫成矩陣就是 I：N(I) = {0}', '所以欄獨立');
    S.k = ok(rrefSteps([[1, 0, 0], [0, 1, 0], [0, 0, 1]]).rank === 3, -4.4, 6.4, 'N(I) = {0} ✓');
  },
  async (tok, S) => { gone(S.e, S.k); cap('但基底不只一組', ''); },
  async (tok, S) => {
    cap('試試 (1, 1, 2)、(2, 2, 5)', '');
    S.a = S.S.arrow(VB1, COL.a, '(1,1,2)'); S.b = S.S.arrow(VB2, COL.b, '(2,2,5)');
  },
  async (tok, S) => { cap('獨立嗎？是', ''); S.k = ok(rk([VB1, VB2]) === 2, -4.4, 6.4, '(1,1,2)、(2,2,5) 獨立 ✓'); },
  async (tok, S) => {
    cap('span R³ 嗎？不行，只 span 一個平面', '還需要第三個向量');
    S.P = S.S.plane(VB1, VB2, COL.b, 0); await anim(tok, 600, (t) => S.P.fade(0.2 * t));
  },
  async (tok, S) => {
    cap('(3, 3, 7) 不行：它是前兩個的和', '在同一個平面上');
    S.c7 = S.S.arrow([0, 0, 0], COL.r, '(3,3,7)'); await grow(tok, S.S, S.c7, [3, 3, 7]);
    S.k2 = ok(same(addv(VB1, VB2), [3, 3, 7]), -4.4, 5.8, '(1,1,2) + (2,2,5) = (3,3,7) ✓');
  },
  async (tok, S) => {
    gone(S.c7);
    cap('老師改用 (3, 3, 8)，以為會跳出平面', '程式檢查：它其實也在平面上');
    S.c8 = S.S.arrow([0, 0, 0], COL.c, '(3,3,8)'); await grow(tok, S.S, S.c8, [3, 3, 8]);
    S.k3 = ok(same(addv(scl(VB1, -1), scl(VB2, 2)), [3, 3, 8]), -4.4, 5.2, '(3,3,8) = −(1,1,2) + 2·(2,2,5) ✓');
    note('老師這裡口誤，下一講開頭更正', -4.4, 4.6);
  },
  async (tok, S) => {
    cap('檢驗法：放進矩陣的欄，做消去', '有 free 變數嗎？');
    S.g = mgrid(T([VB1, VB2, [3, 3, 8]]), 2.6, 1.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j], gap: 0.66, size: 0.54 });
    S.k4 = ok(rk([VB1, VB2, [3, 3, 8]]) === 2, 2.2, -0.5, 'rank 2 → 有 free 變數 → 不是基底 ✓');
  },
  async (tok, S) => {
    cap('Rⁿ 裡 n 個向量是基底 ⇔ 方陣可逆', '這個矩陣有兩列一樣 → 不可逆');
    S.g.row(0, GOLD); S.g.row(1, GOLD);
    S.k5 = ok(same(T([VB1, VB2, [3, 3, 8]])[0], T([VB1, VB2, [3, 3, 8]])[1]), 2.2, -1.1, '第 1、2 列相同 → det = 0 ✓');
  },
  async (tok, S) => { S.g.clearGlow(); gone(S.c8); cap('(1,1,2)、(2,2,5)：是那個平面的基底', '獨立 + span 平面'); },
  async (tok, S) => {
    cap('再塞 (3, 3, 7)：還是 span 平面', '但不獨立了 → 不是基底');
    S.c7 = S.S.arrow([0, 0, 0], COL.r, '(3,3,7)'); await grow(tok, S.S, S.c7, [3, 3, 7]);
  },
], { cam: [[0, 4, 11.5], [0, 3.0, 0]], view: [38, 18, 11.5, [0.6, 3.2, 0]], setup: async (tok, S) => { S.S = space3(0, 2.0, 0, 0.5, 2.6); } });

scene('vsA-l9-dim', 'L9：每組基底的個數都一樣：dimension', [
  async (tok, S) => { cap('基底不唯一', ''); },
  async (tok, S) => {
    cap('任何可逆的 3×3 矩陣，欄都是 R³ 的基底', '示意：[1 0 1; 1 1 0; 0 1 1]');
    const M = [[1, 0, 1], [1, 1, 0], [0, 1, 1]], cols = T(M); sy(0, -4.6, 6.2);
    await anim(tok, 900, (t) => S.as.forEach((a, i) => S.S.set(a, addv(scl(S.E[i], 1 - t), scl(cols[i], t)))));
    S.as.forEach((a, i) => a.tag('b' + '₁₂₃'[i]));
    S.k = ok(rk(M) === 3, 3.6, 6.2, 'det ≠ 0（rank 3）→ 基底 ✓');
  },
  async (tok, S) => { cap('所有基底有一個共同點', ''); },
  async (tok, S) => { cap('向量的個數都一樣：R³ 的基底都是 3 個', ''); S.k2 = ok(rk([[1, 0, 0], [0, 1, 0], [0, 0, 1]]) === 3 && rk([[1, 0, 1], [1, 1, 0], [0, 1, 1]]) === 3, 3.6, 5.6, '兩組都是 3 個 ✓'); },
  async (tok, S) => { cap('Rⁿ 的基底：都是 n 個向量', ''); },
  async (tok, S) => { cap('任何空間：每組基底的向量個數相同', 'column space、null space 也一樣'); },
  async (tok, S) => { cap('如果是 6：7 個太多、5 個不夠', '6 剛剛好'); },
  async (tok, S) => { cap('這個數字叫做 dimension（維度）', 'dim R³ = 3'); good('dim = 基底向量的個數', 3.6, 5.0); },
  async (tok, S) => { cap('四個名詞到齊', ''); S.cd = code(['獨立：組合不為 0', 'span：所有組合', 'basis：獨立 + span', 'dimension：基底的個數'], -6.6, 1.8, 0.5); },
], Object.assign({}, V6, { setup: async (tok, S) => {
  S.S = space3(0, 2.6, 0, 1, 2.5); S.E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  S.as = S.E.map((v, i) => S.S.arrow(v, [COL.a, COL.b, COL.c][i], 'e' + '₁₂₃'[i]));
} }));

scene('vsA-l9-colbasis', 'L9：C(A) 的基底與 rank = dim C(A)', [
  async (tok, S) => { cap('例子：某個矩陣的 column space', ''); },
  async (tok, S) => {
    cap('A = [1 2 3 1; 1 1 2 1; 1 2 3 1]', '欄 3 = 欄 1 + 欄 2，欄 4 = 欄 1');
    S.g = mgrid(A9, -6.6, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c, COL.d][j] }); hd('A', -6.0, 6.3);
    S.as = C9.map((c, j) => S.S.arrow([0, 0, 0], [COL.a, COL.b, COL.c, COL.d][j], '欄' + (j + 1)));
    await anim(tok, 700, (t) => S.as.forEach((a, j) => S.S.set(a, scl(C9[j], t))));
  },
  async (tok, S) => { cap('四個欄 span C(A) 嗎？當然', 'C(A) 就是這樣定義的'); },
  async (tok, S) => { cap('它們是 C(A) 的基底嗎？不是：不獨立', 'null space 裡有東西'); },
  async (tok, S) => {
    cap('N(A) 裡有 (−1, −1, 1, 0)', '欄 3 = 欄 1 + 欄 2');
    S.k = ok(isZ(mulMV(A9, [-1, -1, 1, 0])), -4.6, 1.4, 'A(−1, −1, 1, 0) = 0 ✓');
  },
  async (tok, S) => {
    cap('C(A) 的基底：pivot 欄 1、2', '最自然的答案');
    S.g.paintCol(2, '#e7dcc8'); S.g.paintCol(3, '#e7dcc8'); S.as[2].glow(null);
    S.k2 = ok(same(E9.piv, [0, 1]), -4.6, 0.8, 'pivot 欄 = 1、2 ✓');
  },
  async (tok, S) => { cap('rank = 2', ''); S.k3 = ok(E9.rank === 2, -4.6, 0.2, 'rank(A) = 2 ✓'); },
  async (tok, S) => {
    cap('rank(A) = dim C(A)', 'pivot 欄的個數 = column space 的維度');
    S.P = S.S.plane(C9[0], C9[1], COL.a, 0); await anim(tok, 700, (t) => S.P.fade(0.22 * t));
    const p = S.S.w(addv(C9[0], C9[1])); hd('C(A)：2 維平面', p.x, p.y + 0.4, p.z);
  },
  async (tok, S) => { cap('說法要對：矩陣有 rank，空間有 dimension', '不說「A 的維度」'); },
  async (tok, S) => {
    cap('別的基底：欄 1、3；欄 2、3；欄 2、4…', '');
    S.k4 = ok([[0, 2], [1, 2], [1, 3]].every(([i, j]) => rk([C9[i], C9[j]]) === 2), -4.6, -0.4, '每一對都獨立、都在 C(A) ✓');
  },
  async (tok, S) => {
    cap('或用不是欄的向量：(2,2,2)、(7,5,7)', '');
    S.x1 = S.S.arrow([2, 2, 2], COL.g, '(2,2,2)'); S.x2 = S.S.arrow([0, 0, 0], COL.r, '(7,5,7)'); S.S.set(S.x2, scl([7, 5, 7], 0.5)); S.x2.tag('(7,5,7)（畫一半長）');
    S.k5 = ok(inSpan(C9, [2, 2, 2]) && inSpan(C9, [7, 5, 7]) && rk([[2, 2, 2], [7, 5, 7]]) === 2, -4.6, -1.0, '都在 C(A)、彼此獨立 ✓');
  },
  async (tok, S) => { cap('知道 dim = 2：任兩個獨立向量自動是基底', '數量對、又獨立，就一定 span'); },
], { cam: [[0, 3.6, 13.5], [0, 3.0, 0]], setup: async (tok, S) => { S.S = space3(3.4, 2.2, 0, 0.42, 2.6, ['b₁', 'b₂', 'b₃'], 'R³（欄住的地方）'); } });

scene('vsA-l9-nulldim', 'L9：dim N(A) = n − r', [
  async (tok, S) => { cap('換 null space：它的維度是多少？', ''); },
  async (tok, S) => {
    cap('(−1, −1, 1, 0) 在 N(A) 裡', '還有別的嗎？有');
    S.b1 = bar(Q9.null[0], -1.8, 2.2, 0, COL.c, { k: 0.6 }); hot('s₁', S.b1.mid, 3.6);
  },
  async (tok, S) => { cap('只有它一個 span 不出整個 N(A)', '至少還要一個'); },
  async (tok, S) => {
    cap('free 變數 x₃、x₄：給 (0, 1)', '欄 4 = 欄 1 → s₂ = (−1, 0, 0, 1)');
    S.b2 = bar(Q9.null[1], 1.4, 2.2, 0, COL.d, { k: 0.6 }); hot('s₂', S.b2.mid, 3.6);
    S.k = ok(same(Q9.null[0], [-1, -1, 1, 0]) && same(Q9.null[1], [-1, 0, 0, 1]) && Q9.null.every((x) => isZ(mulMV(A9, x))), -0.2, 5.6, 'A s₁ = A s₂ = 0 ✓');
  },
  async (tok, S) => { cap('null space 告訴我們：欄怎樣相依', ''); },
  async (tok, S) => { cap('s₁、s₂ 是 N(A) 的基底嗎？是', 'N(A) 是 2 維'); S.k2 = ok(rk(Q9.null) === 2, -0.2, 5.0, 's₁、s₂ 獨立 ✓'); },
  async (tok, S) => { cap('dim N(A) = free 變數的個數', ''); },
  async (tok, S) => { cap('n − r = 4 − 2 = 2', 'n 欄、r 個 pivot 欄'); S.k3 = ok(Q9.null.length === 4 - E9.rank, -0.2, 4.4, 'dim N(A) = n − r = 2 ✓'); },
], { cam: [[0, 3.4, 12], [0, 3.4, 0]], setup: async (tok, S) => {
  S.g = mgrid(A9, -6.6, 5.6, 0, { gap: 0.66, size: 0.54 }); hd('A', -6.0, 6.2); sm('x₃、x₄ free', -5.6, 3.2);
} });

// ════════ nHlE7EgJFds（L10）：四個基本子空間 ════════
// 例子 A = [1 2 3 1; 1 1 2 1; 1 2 3 1]（同 L9 的 A9）：m = 3、n = 4、r = 2。
// Gauss-Jordan [A I] → [R E] 的每一步都在程式裡做，E·A = R、E 的最後一列是 N(Aᵀ) 的基底。
const M338 = T([VB1, VB2, [3, 3, 8]]);
const GJ = [['sub', 1, 1, 0, 'R2 − R1'], ['sub', 2, 1, 0, 'R3 − R1'], ['mul', 1, -1, 0, 'R2 × (−1)'], ['sub', 0, 2, 1, 'R1 − 2·R2']];
function gjRun(A, n = GJ.length) {
  const M = A.map((r) => r.slice()), I = A.map((_, i) => A.map((_, j) => (i === j ? 1 : 0)));
  for (const [op, i, f, j] of GJ.slice(0, n)) for (const X of [M, I]) { if (op === 'sub') X[i] = X[i].map((x, k) => x - f * X[j][k]); else X[i] = X[i].map((x) => x * f); }
  return { R: M, E: I };
}
const GJ9 = gjRun(A9);
const V4 = { cam: [[0, 6.5, 13.5], [0, 2.4, 0]] };

scene('vsA-l10-fix', 'L10：更正上一講：(3, 3, 8) 不獨立', [
  async (tok, S) => { cap('先更正上一講的錯', '回到 R³ 的標準基底'); S.e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v, i) => S.S.arrow(v, [COL.a, COL.b, COL.c][i], 'e' + '₁₂₃'[i])); },
  async (tok, S) => {
    gone(S.e);
    cap('另一組：(1, 1, 2)、(2, 2, 5) 獨立', '');
    S.a = S.S.arrow(VB1, COL.a, '(1,1,2)'); S.b = S.S.arrow(VB2, COL.b, '(2,2,5)');
  },
  async (tok, S) => { cap('(3, 3, 7) 不行：它是兩者的和', ''); S.c = S.S.arrow([0, 0, 0], COL.r, '(3,3,7)'); await grow(tok, S.S, S.c, [3, 3, 7]); },
  async (tok, S) => { gone(S.c); cap('上一講改放 (3, 3, 8)', '以為它會稍微跳出平面'); S.d = S.S.arrow([0, 0, 0], COL.c, '(3,3,8)'); await grow(tok, S.S, S.d, [3, 3, 8]); },
  async (tok, S) => { cap('下課後學生說：(3, 3, 8) 不獨立！', ''); bad('(3,3,8) 不獨立', -4.0, 6.6); },
  async (tok, S) => {
    cap('她沒去找組合，而是看矩陣：不可逆', '兩列一模一樣');
    S.g = mgrid(M338, -6.4, 4.8, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); hd('[三個欄]', -5.6, 5.5);
    S.g.row(0, GOLD); S.g.row(1, GOLD);
    S.k = ok(same(M338[0], M338[1]), -4.0, 1.8, '第 1 列 = 第 2 列 ✓');
  },
  async (tok, S) => { cap('列相依 → 欄也相依', '方陣不可逆'); S.k2 = ok(rk(M338) === 2, -4.0, 1.2, 'rank = 2 < 3 ✓'); },
  async (tok, S) => { S.g.clearGlow(); cap('今天的結論會把 column space 和 row space 連起來', ''); },
  async (tok, S) => {
    cap('rank 只有 2 → 只有 2 個欄獨立', '(3, 3, 8) 就在那個平面上');
    S.P = S.S.plane(VB1, VB2, COL.b, 0); await anim(tok, 700, (t) => S.P.fade(0.22 * t));
    S.k3 = ok(same(addv(scl(VB1, -1), scl(VB2, 2)), [3, 3, 8]), -4.0, 0.6, '(3,3,8) = −(1,1,2) + 2·(2,2,5) ✓');
  },
], { cam: [[0, 4, 12], [0, 3.0, 0]], view: [34, 16, 12, [1.4, 3.2, 0]], setup: async (tok, S) => { S.S = space3(2.2, 2.0, 0, 0.5, 2.6); } });

scene('vsA-l10-four', 'L10：四個基本子空間是哪四個', [
  async (tok, S) => { cap('一個矩陣帶來四個基本子空間', '用 A = [1 2 3 1; 1 1 2 1; 1 2 3 1] 對照'); },
  async (tok, S) => { cap('① column space C(A)', '欄的所有組合'); S.card(0); for (let j = 0; j < 4; j++) { S.g.col(j, GOLD); await wt(tok, 200); S.g.col(j, null); } },
  async (tok, S) => { cap('② null space N(A)', 'Ax = 0 的所有解'); S.card(1); },
  async (tok, S) => { cap('③ row space：列的所有組合', '新的子空間'); S.card(2); for (let i = 0; i < 3; i++) { S.g.row(i, GOLD); await wt(tok, 250); S.g.row(i, null); } },
  async (tok, S) => {
    cap('列是 row space 的基底嗎？不一定', '列相依時不是：這裡列 3 = 列 1');
    S.g.row(0, GOLD); S.g.row(2, GOLD); S.k = ok(same(A9[0], A9[2]), -4.6, 2.6, '列 3 = 列 1 ✓ → 3 列不是基底');
  },
  async (tok, S) => {
    S.g.clearGlow(); gone(S.k);
    cap('老師想用欄向量：把 A 轉置', 'row space = C(Aᵀ)');
    S.gt = mgrid(T(A9), -2.6, 5.2, 0, { gap: 0.6, size: 0.48, color: () => '#cfe1f3' }); hd('Aᵀ', -2.2, 5.8);
  },
  async (tok, S) => { cap('④ null space of Aᵀ：N(Aᵀ)', ''); S.card(3); },
  async (tok, S) => { cap('N(Aᵀ) 通常叫 left null space', '等一下說為什麼'); sm('= left null space', S.cx[3] + 1.2, S.cy[3] - 0.55, 0.3); },
], { cam: [[0, 3.4, 13], [0, 3.4, 0]], setup: async (tok, S) => {
  S.g = mgrid(A9, -6.6, 5.2, 0); hd('A（3×4）', -5.6, 5.9);
  const names = ['C(A)：column space', 'N(A)：null space', 'C(Aᵀ)：row space', 'N(Aᵀ)'], cols = [COL.d, COL.r, COL.a, COL.c];
  S.cx = [2.4, 2.4, 2.4, 2.4]; S.cy = [5.4, 4.2, 3.0, 1.8];
  S.card = (k) => { cube('', cols[k], [4.4, 0.9, 0.2], S.cx[k] + 1.2, S.cy[k], -0.2, 2); hd(names[k], S.cx[k] + 1.2, S.cy[k], 0.2); };
} });

// 大圖：左 Rⁿ（row space、null space），右 Rᵐ（column space、left null space）；形狀用 [1 2 3; 2 4 6; 1 1 1] 示意
const FA = [[1, 2, 3], [2, 4, 6], [1, 1, 1]], FQ = subspaces(FA);
function bigPicture(S) {
  S.L = space3(-3.5, 2.5, 0, 0.62, 2.1, ['', '', ''], 'Rⁿ'); S.R = space3(3.5, 2.5, 0, 0.62, 2.1, ['', '', ''], 'Rᵐ');
  S.draw = async (tok, Sp, basis, color, nm, dlbl) => {
    let m;
    if (basis.length === 1) { m = Sp.line(basis[0], color, 0.01, [0, 0, 0], 0.045); await anim(tok, 600, (t) => Sp.setLine(m, basis[0], 0.01 + 3.0 * t)); const p = Sp.w(scl(basis[0], 3.3 / norm(basis[0]))); hd(nm, p.x, p.y, p.z); if (dlbl) S.dl.push(hot(dlbl, p.x, p.y - 0.5, p.z)); }
    else { m = Sp.plane(basis[0], basis[1], color, 0); await anim(tok, 600, (t) => m.fade(0.24 * t)); const s = addv(basis[0], basis[1]), p = Sp.w(scl(s, 2.6 / norm(s))); hd(nm, p.x, p.y, p.z); if (dlbl) S.dl.push(hot(dlbl, p.x, p.y - 0.5, p.z)); }
    return m;
  };
  S.dl = [];
}

scene('vsA-l10-where', 'L10：四個子空間住在哪裡：Rⁿ 與 Rᵐ', [
  async (tok, S) => { cap('A 是 m×n：四個空間各住在哪？', ''); },
  async (tok, S) => { cap('N(A)：x 有 n 個分量 → 在 Rⁿ', ''); S.t[0] = pl('N(A) ⊂ Rⁿ', -3.5, -0.2); },
  async (tok, S) => { cap('C(A)：欄有 m 個分量 → 在 Rᵐ', ''); S.t[1] = pl('C(A) ⊂ Rᵐ', 3.5, -0.2); },
  async (tok, S) => { cap('C(Aᵀ)：A 的列有 n 個分量 → 在 Rⁿ', ''); S.t[2] = pl('C(Aᵀ) ⊂ Rⁿ', -3.5, -0.8); },
  async (tok, S) => { cap('N(Aᵀ)：在 Rᵐ', '第四個空間不該被冷落'); S.t[3] = pl('N(Aᵀ) ⊂ Rᵐ', 3.5, -0.8); },
  async (tok, S) => {
    cap('畫成大圖：左邊 Rⁿ 有 row space、null space', '示意圖');
    await S.draw(tok, S.L, FQ.row, COL.a, 'row space'); await S.draw(tok, S.L, FQ.null, COL.r, 'null space');
  },
  async (tok, S) => { cap('右邊 Rᵐ 有 column space、N(Aᵀ)', ''); await S.draw(tok, S.R, FQ.col, COL.d, 'column space'); await S.draw(tok, S.R, FQ.left, COL.c, 'N(Aᵀ)'); },
  async (tok, S) => { cap('任務：每個空間的 basis 和 dimension', ''); },
], Object.assign({}, V4, { setup: async (tok, S) => { bigPicture(S); S.t = []; sy(0, 0, 6.8); } }));

scene('vsA-l10-dims', 'L10：四個子空間的維度', [
  async (tok, S) => { cap('先給簡短的答案：維度', '例：A 是 3×4、r = 2'); },
  async (tok, S) => { cap('dim C(A) = r', ''); await S.draw(tok, S.R, FQ.col, COL.d, 'C(A)', 'dim r'); },
  async (tok, S) => {
    cap('basis：原矩陣 A 的 pivot 欄', '有 r 個 → dim = r');
    S.k = ok(E9.piv.length === E9.rank && same(E9.piv, [0, 1]), 0, 0.2, '例：pivot 欄 1、2，dim C(A) = 2 ✓');
  },
  async (tok, S) => { cap('row space 的維度也是 r', '很美妙的事實'); await S.draw(tok, S.L, FQ.row, COL.a, 'C(Aᵀ)', 'dim r'); S.k2 = ok(rk(T(A9)) === E9.rank, 0, -0.4, '例：dim C(Aᵀ) = 2 = r ✓'); },
  async (tok, S) => { cap('上一講的錯就是這樣看出來的', '兩列相同 → row space 2 維 → 欄只有 2 個獨立'); S.k3 = ok(rk(M338) === 2, 0, -1.0, '[1 2 3; 1 2 3; 2 5 8]：rank 2 ✓'); },
  async (tok, S) => { gone(S.k, S.k2, S.k3); cap('N(A) 的 basis：special solutions', '每個 free 變數一個'); },
  async (tok, S) => { cap('共 n − r 個 → dim N(A) = n − r', ''); await S.draw(tok, S.L, FQ.null, COL.r, 'N(A)', 'dim n − r'); },
  async (tok, S) => { cap('Rⁿ 裡：r + (n − r) = n', 'pivot 變數 + free 變數 = 全部變數'); S.k = ok(E9.rank + Q9.null.length === 4, -3.5, 0.2, '例：2 + 2 = 4 = n ✓'); },
  async (tok, S) => { cap('dim N(Aᵀ) = m − r', ''); await S.draw(tok, S.R, FQ.left, COL.c, 'N(Aᵀ)', 'dim m − r'); },
  async (tok, S) => { cap('Aᵀ 有 m 欄：r + (m − r) = m', 'Aᵀ 也是一個好好的矩陣'); S.k2 = ok(E9.rank + Q9.left.length === 3, 3.5, 0.2, '例：2 + 1 = 3 = m ✓'); },
], Object.assign({}, V4, { setup: async (tok, S) => { bigPicture(S); sy(0, 0, 6.8); } }));

scene('vsA-l10-rowbasis', 'L10：row space 的基底：R 的前 r 列', [
  async (tok, S) => { cap('row space 的 basis 怎麼找？', ''); },
  async (tok, S) => { cap('可以把 A 轉置再消去……', '但應該不用重做一次'); },
  async (tok, S) => { cap('A = [1 2 3 1; 1 1 2 1; 1 2 3 1]', '上一講的矩陣'); S.g = mgrid(S.M, -6.4, 5.4, 0); hd('A', -5.6, 6.1); },
  async (tok, S) => { cap('R2 − R1 → (0, −1, −1, 0)', ''); rowOp(S, 1, 1, 0); },
  async (tok, S) => { cap('R3 − R1 → 整列 0', ''); rowOp(S, 2, 1, 0); },
  async (tok, S) => { cap('R2 × (−1) → (0, 1, 1, 0)', '讓 pivot 變 1'); S.M[1] = S.M[1].map((x) => -x); S.g.clearGlow(); S.g.setAll(S.M); S.g.row(1, GOLD); },
  async (tok, S) => {
    cap('R1 − 2·R2 → (1, 0, 1, 1)', '得到 R');
    rowOp(S, 0, 2, 1); hd('R', -6.9, 4.6);
    S.k = ok(sameM(S.M, E9.R), -0.6, 6.2, 'R = rref(A) = [1 0 1 1; 0 1 1 0; 0 0 0 0] ✓');
  },
  async (tok, S) => {
    S.g.clearGlow();
    cap('R 裡看到：I、下面的 0、還有 F', '');
    [[0, 0], [1, 1]].forEach(([i, j]) => tint(S.g.c[i][j], COL.a)); [[0, 2], [0, 3], [1, 2], [1, 3]].forEach(([i, j]) => tint(S.g.c[i][j], COL.b));
  },
  async (tok, S) => {
    cap('column space 變了：C(R) ≠ C(A)', '(1, 1, 1) 在 C(A)，不在 C(R)');
    S.k2 = ok(inSpan(C9, [1, 1, 1]) && !inSpan(T(E9.R), [1, 1, 1]), -0.6, 5.6, '(1,1,1) ∈ C(A)、∉ C(R) ✓');
  },
  async (tok, S) => { cap('但列運算保留 row space', 'A 和 R 的 row space 一模一樣'); good('row space(A) = row space(R)', -0.6, 5.0); },
  async (tok, S) => {
    cap('基底：R 的前 r 列', '(1, 0, 1, 1)、(0, 1, 1, 0)');
    S.g.row(0, GREEN); S.g.row(1, GREEN); S.g.row(2, null);
  },
  async (tok, S) => {
    cap('為什麼在 row space？它們由 A 的列組合而來', '');
    S.k3 = ok(same(addv(A9[0], scl(A9[1], -1)), E9.R[1]) && same(addv(scl(A9[0], -1), scl(A9[1], 2)), E9.R[0]), -0.6, 4.4, 'R 的列 2 = A 列1 − A 列2 ✓');
  },
  async (tok, S) => { cap('r 個、彼此獨立 → dim = r', ''); S.k4 = ok(rk(E9.R.slice(0, 2)) === 2, -0.6, 3.8, '兩列獨立，dim = 2 ✓'); },
  async (tok, S) => {
    cap('倒著做列運算：A 的列是 R 的列的組合', '兩個 row space 相同');
    S.k5 = ok(A9.every((row) => inSpan(E9.R.slice(0, 2), row)), -0.6, 3.2, 'A 的每一列 = R 前兩列的組合 ✓');
  },
], { cam: [[0, 3.4, 12.5], [0, 3.8, 0]], setup: async (tok, S) => { S.M = A9.map((r) => r.slice()); } });

scene('vsA-l10-left', 'L10：left null space 與 E', [
  async (tok, S) => { cap('第四個空間：N(Aᵀ)', ''); },
  async (tok, S) => { cap('裡面是 y：Aᵀy = 0', ''); S.cd = code(['Aᵀ y = 0', 'yᵀ A = 0ᵀ'], -6.6, 1.6, 0.6); S.cd.hl(0); },
  async (tok, S) => { cap('兩邊轉置：yᵀA = 0ᵀ', '轉置會把乘法順序倒過來'); S.cd.hl(1); },
  async (tok, S) => { cap('y 從左邊乘 A → left null space', 'y 變成一個列向量'); },
  async (tok, S) => { cap('怎麼找它的 basis？', 'R 沒有直接告訴我們'); },
  async (tok, S) => { cap('從 A 到 R：所有列運算合起來是哪個矩陣？', ''); },
  async (tok, S) => {
    cap('Gauss-Jordan：在 A 右邊接上 I', '[A  I] → [R  E]');
    S.gi = mgrid([[1, 0, 0], [0, 1, 0], [0, 0, 1]], -2.4, 5.4, 0, { color: () => '#cfe6c4' }); hd('I', -1.6, 6.1);
  },
  async (tok, S) => { cap('E 記錄了所有步驟：E·A = R', ''); gone(S.cd); S.cd = code(['E A = R'], -6.6, 1.6, 0.6); S.cd.hl(0); },
  async (tok, S) => { cap('可逆方陣時：R = I，E 就是 A⁻¹', '第二章學過的'); },
  async (tok, S) => {
    cap('把同樣的步驟也做在 I 上', 'R2 − R1、R3 − R1、R2 × (−1)、R1 − 2R2');
    for (let n = 1; n <= GJ.length; n++) { const st = gjRun(A9, n); S.g.setAll(st.R); S.gi.setAll(st.E); S.g.clearGlow(); S.gi.clearGlow(); S.g.row(GJ[n - 1][1], GOLD); S.gi.row(GJ[n - 1][1], GOLD); await wt(tok, 550); }
    S.g.clearGlow(); S.gi.clearGlow(); hd('E', -1.6, 3.0);
  },
  async (tok, S) => {
    cap('E = [−1 2 0; 1 −1 0; −1 0 1]', '檢查：E·A = R');
    S.k = ok(sameM(GJ9.E, [[-1, 2, 0], [1, -1, 0], [-1, 0, 1]]) && sameM(mulMM(GJ9.E, A9), E9.R), 0.6, 6.3, 'E·A = R ✓');
  },
  async (tok, S) => { cap('rank 2 → dim N(Aᵀ) = m − r = 3 − 2 = 1', ''); S.k2 = ok(Q9.left.length === 1, 0.6, 5.7, 'dim N(Aᵀ) = 1 ✓'); },
  async (tok, S) => {
    cap('basis：E 的最後一列 (−1, 0, 1)', '它乘 A 得到 R 的零列');
    S.gi.row(2, GREEN); S.g.row(2, GREEN);
    S.k3 = ok(isZ(mulMV(T(A9), GJ9.E[2])) && inSpan(Q9.left, GJ9.E[2]), 0.6, 5.1, 'yᵀA = 0：y = (−1, 0, 1) ✓');
  },
  async (tok, S) => {
    cap('−列 1 + 列 3 = 零列', '看 A 就知道');
    S.g.setAll(A9); S.g.clearGlow(); S.g.row(0, GOLD); S.g.row(2, GOLD);
    S.k4 = ok(isZ(addv(scl(A9[0], -1), A9[2])), 0.6, 4.5, '−(1,2,3,1) + (1,2,3,1) = 0 ✓');
  },
  async (tok, S) => {
    S.g.clearGlow();
    cap('總結：Rⁿ 裡 row + null 維度和 = n', 'Rᵐ 裡 column + left null 維度和 = m');
    S.k5 = ok(E9.rank + Q9.null.length === 4 && E9.rank + Q9.left.length === 3, 0.6, 3.9, '2 + 2 = 4；2 + 1 = 3 ✓');
  },
], { cam: [[0, 3.4, 12.5], [0, 3.6, 0]], setup: async (tok, S) => { S.g = mgrid(A9, -6.4, 5.4, 0); hd('A', -5.6, 6.1); } });

scene('vsA-l10-mat', 'L10：新的向量空間：所有 3×3 矩陣', [
  async (tok, S) => { cap('新的向量空間', '不再是 Rⁿ 的子空間'); },
  async (tok, S) => { cap('M = 所有 3×3 矩陣', '每個矩陣就是一個「向量」'); S.g = mgrid([[1, 2, 0], [0, 3, 1], [4, 0, 5]], -6.0, 5.4, 0, { color: () => '#e7dcc8' }); sy(0, -5.2, 2.8); },
  async (tok, S) => {
    cap('可以相加、乘 7、取組合，有零矩陣', '向量空間的規則都成立');
    await anim(tok, 800, (t) => S.g.setAll([[1, 2, 0], [0, 3, 1], [4, 0, 5]].map((r) => r.map((x) => Math.round(x * (1 + 6 * t))))));
    await wt(tok, 300); S.g.setAll([[0, 0, 0], [0, 0, 0], [0, 0, 0]]); hot('7A、零矩陣…', -5.2, 6.3);
  },
  async (tok, S) => { cap('矩陣可以相乘，但這裡先不管', '只用加法和乘常數'); },
  async (tok, S) => {
    cap('子空間：所有上三角矩陣', '');
    S.U = mgrid([[0, 0, 0], [0, 0, 0], [0, 0, 0]], -2.0, 5.4, 0, { color: (i, j) => (j >= i ? COL.b : '#efe6d4') }); hd('上三角 U', -1.2, 6.2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < i; j++) S.U.set(i, j, 0);
    for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) S.U.set(i, j, '*');
  },
  async (tok, S) => {
    cap('另一個子空間：所有對稱矩陣', '');
    S.Sy = mgrid([['a', 'b', 'c'], ['b', 'd', 'e'], ['c', 'e', 'f']], 2.0, 5.4, 0, { color: (i, j) => (i === j ? COL.a : '#cfe1f3') }); hd('對稱 S', 2.8, 6.2);
  },
  async (tok, S) => {
    cap('交集：又對稱又上三角 → 對角矩陣', '下面是 0，上面也得是 0');
    S.D = mgrid([['*', 0, 0], [0, '*', 0], [0, 0, '*']], 5.0, 5.4, 0, { color: (i, j) => (i === j ? COL.d : '#efe6d4'), gap: 0.62, size: 0.5 }); hd('D', 5.6, 6.2);
  },
  async (tok, S) => { cap('D 比較「小」：用維度來比', ''); },
  async (tok, S) => { cap('dim D = 3', ''); hot('dim D = 3', 5.6, 2.9); },
  async (tok, S) => {
    cap('三個對角矩陣當基底', '示意：diag(1,0,0)、diag(0,3,0)、diag(0,0,7)');
    const ds = [[1, 0, 0], [0, 3, 0], [0, 0, 7]];
    ds.forEach((d, k) => mgrid([[d[0], 0, 0], [0, d[1], 0], [0, 0, d[2]]], -5.6 + k * 2.6, 1.6, 0, { gap: 0.55, size: 0.44, color: (i, j) => (i === j && d[i] ? COL.d : '#efe6d4') }));
    S.k = ok(rk(ds) === 3, 0, -0.6, '三個獨立、span 所有對角矩陣 ✓');
  },
  async (tok, S) => { cap('把 Rⁿ 的想法延伸到 n×n 矩陣', '一樣能加、能乘常數'); },
], { cam: [[0, 3.4, 13], [0, 3.4, 0]] });
  }

  // ═══ vsB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 線性代數 第 4 章（MIT 18.06 L11／L12／L13、18.06 recitation「Independence, Basis, and Dimension」、
//     3Blue1Brown 第 1、2、7、16 集）— cued scenes（vsB）───
// 每個矩陣、rank、零空間基底、算出來的值都由程式現場計算（用本章的 rrefSteps／nullBasis），
// 和老師口述的答案比對，畫面顯示 ✓／✘。逐字稿沒錄到數字、由我們補上的例子，畫面標「示意」。
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
const ok = (b, x, y, t) => (b ? good(t, x, y) : bad('✘ ' + t.replace(/✓/g, '✘'), x, y));
const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.isObject3D) { if (o.lbl) remove(o.lbl); if (o.element) remove(o); else kill(o); return; } if (o.ls && typeof o.kill === 'function') return o.kill(); if (o.nb && o.ea) return gone(o.ea.map((a) => a.el), o.ea, o.nb); if (o.c && o.xs) return gone(o.c.flat()); if (o.parts) gone(o.parts); });
const CAM = [[0, 3.4, 13], [0, 3.2, 0]];
const VC = { a: '#4b9ee2', b: '#dd8238', c: '#9b7ef4', d: '#2fc092', r: '#d64545', g: '#c08a1f', k: '#6e5f49', gray: '#b9ad99', pale: '#e7dcc8', y: '#e9c53a' };
function scene(id, title, steps, o = {}) {
  FRAG.push([id, title, async (tok) => {
    const c = o.cam || CAM; fresh(c[0], c[1]);
    const S = {};
    if (o.init) await o.init(tok, S);
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}

// ── 矩陣運算（全部現場算） ──
const zeros = (m, n) => Array.from({ length: m }, () => new Array(n).fill(0));
const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const mad = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
const msc = (A, c) => A.map((r) => r.map((x) => x * c));
const rk = (A) => rrefSteps(A).rank;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const isSym = (A) => A.every((r, i) => r.every((x, j) => near(x, A[j][i])));
const isUp = (A) => A.every((r, i) => r.every((x, j) => j >= i || near(x, 0)));
const isDiag = (A) => isSym(A) && isUp(A);
const eqM = (A, B) => A.length === B.length && A.every((r, i) => r.every((x, j) => near(x, B[i][j])));
const eqV = (a, b) => a.length === b.length && a.every((x, i) => near(x, b[i]));
const Eij = (i, j, n = 3) => { const z = zeros(n, n); z[i][j] = 1; return z; };
const det2 = (M) => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const det3 = (M) => dot(M[0], cross(M[1], M[2]));
const inv2 = (M) => { const d = det2(M); return [[M[1][1] / d, -M[0][1] / d], [-M[1][0] / d, M[0][0] / d]]; };
const col = (A, j) => A.map((r) => r[j]);
const isZero = (v) => v.every((x) => near(x, 0));
const mrow = (r, w = 3) => '[' + r.map((x) => fmt(x).padStart(w)).join('') + ' ]';
const mstr = (M, w) => M.map((r) => mrow(r, w));
// 文字矩陣（等寬字）：回傳 kit 的 code 面板
const mtx = (M, x, y, w = 3, dy = 0.5) => code(mstr(M, w), x, y, dy);

// ── 3D 箭頭（和本章的箭頭同樣式）──
function varrow(color, r = 0.055) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.7, 1, 14), mat);
  const g = new THREE.Group(); g.add(shaft, head); g.visible = false; lab.world.add(g);
  g.setW = (a, b) => {
    const d = b.clone().sub(a), L = d.length();
    g.visible = L > 1e-4; if (g.lbl) showL(g.lbl, g.visible);
    if (!g.visible) return g;
    const u = d.clone().divideScalar(L), hl = Math.min(0.3, L * 0.45), sl = L - hl;
    shaft.quaternion.setFromUnitVectors(UP, u); head.quaternion.copy(shaft.quaternion);
    shaft.scale.set(1, Math.max(sl, 1e-3), 1); shaft.position.copy(a).addScaledVector(u, sl / 2);
    head.scale.set(1, hl, 1); head.position.copy(a).addScaledVector(u, sl + hl / 2);
    if (g.lbl) g.lbl.position.copy(b).addScaledVector(u, 0.3).add(V3(0, 0.12, 0));
    return g;
  };
  g.tag = (t, cls) => { if (!g.lbl) { g.lbl = lab.label('', cls || 'ptr'); lab.world.add(g.lbl); } txt(g.lbl, t); return g; };
  g.glow = (c) => { mat.emissive = new THREE.Color(c || '#000000'); };
  g.color = (c) => mat.color.set(c);
  return g;
}

// ── 2D 座標平面（數學 (x, y) → 畫面 (ox + x·s, oy + y·s)），格線可以被矩陣 M 變形 ──
function plane2(ox, oy, s = 0.6, n = 5, o = {}) {
  const G = { ox, oy, s, n, M: [[1, 0], [0, 1]], lines: [], vecs: [], parts: [] };
  const z0 = o.z || 0;
  G.w = (p) => V3(ox + p[0] * s, oy + p[1] * s, z0);
  const ap = (M, p) => [M[0][0] * p[0] + M[0][1] * p[1], M[1][0] * p[0] + M[1][1] * p[1]];
  G.ap = ap;
  const mk = (a, b, color, op, fixed) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([G.w(a), G.w(b)]), new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op }));
    lab.world.add(l); const e = { l, a, b, fixed }; G.lines.push(e); G.parts.push(l); return l;
  };
  if (o.grid !== false) for (let k = -n; k <= n; k++) { if (!k) continue; mk([k, -n], [k, n], o.gridColor || '#8fb3d9', 0.45); mk([-n, k], [n, k], o.gridColor || '#8fb3d9', 0.45); }
  if (o.ghost) for (let k = -n; k <= n; k++) { mk([k, -n], [k, n], '#cfc4b0', 0.35, true); mk([-n, k], [n, k], '#cfc4b0', 0.35, true); }
  G.ax = [mk([-n, 0], [n, 0], '#6e5f49', 1), mk([0, -n], [0, n], '#6e5f49', 1)];
  if (o.ticks) for (let k = -n; k <= n; k++) if (k) { mk([k, -0.12], [k, 0.12], '#6e5f49', 1, true); mk([-0.12, k], [0.12, k], '#6e5f49', 1, true); }
  if (o.names !== false) { const px = G.w([n + 0.35, 0]), py = G.w([0, n + 0.35]); G.parts.push(sm('x', px.x, px.y), sm('y', py.x, py.y)); }
  G.redraw = () => {
    for (const e of G.lines) if (!e.fixed) { const a = G.w(ap(G.M, e.a)), b = G.w(ap(G.M, e.b)); e.l.geometry.setFromPoints([a, b]); }
    for (const v of G.vecs) v.draw();
  };
  // 一支向量：v（數學座標）、from（尾巴，預設原點）；move = true 時跟著 M 一起變形
  G.vec = (v, color, label, opt = {}) => {
    const A = varrow(color, opt.r || 0.055); if (label) A.tag(label, opt.cls);
    const V = { A, v: v.slice(), from: (opt.from || [0, 0]).slice(), move: !!opt.move };
    V.draw = () => { const M = V.move ? G.M : [[1, 0], [0, 1]]; A.setW(G.w(ap(M, V.from)), G.w(ap(M, [V.from[0] + V.v[0], V.from[1] + V.v[1]]))); };
    V.set = (v2, from) => { V.v = v2.slice(); if (from) V.from = from.slice(); V.draw(); };
    V.tip = () => { const M = V.move ? G.M : [[1, 0], [0, 1]]; return ap(M, [V.from[0] + V.v[0], V.from[1] + V.v[1]]); };
    V.parts = [A, A.lbl]; V.draw(); G.vecs.push(V); return V;
  };
  G.dot = (p, color = VC.r, r = 0.1) => { const b = dotBall(color, r); b.position.copy(G.w(p)); G.parts.push(b); return b; };
  G.seg = (a, b, color = VC.g, r = 0.035) => { const m = rod(color, r); m.setW(G.w(a), G.w(b)); G.parts.push(m); return m; };
  G.setM = (M) => { G.M = M.map((r) => r.slice()); G.redraw(); };
  G.morph = async (tok, ms, M1) => { const M0 = G.M.map((r) => r.slice()); await anim(tok, ms, (u) => { G.M = M0.map((r, i) => r.map((x, j) => x + (M1[i][j] - x) * u)); G.redraw(); }); G.M = M1.map((r) => r.slice()); G.redraw(); };
  G.label = (t, p, cls = 'idx') => { const q = G.w(p); const l = tag(t, cls, q.x, q.y, z0 + 0.1); G.parts.push(l); return l; };
  return G;
}
// 一條「直線」：過原點、方向 d（數學座標），在平面 G 上畫成一根粗棒
const lineThrough = (G, d, color, len = 5, r = 0.04, c = [0, 0]) => { const k = len / Math.hypot(d[0], d[1]); return G.seg([c[0] - d[0] * k, c[1] - d[1] * k], [c[0] + d[0] * k, c[1] + d[1] * k], color, r); };

// ── 函數圖：x ∈ [x0, x1] 畫在 (X, Y) 為原點、比例 sx, sy ──
function fplot(X, Y, sx, sy, x0, x1, o = {}) {
  const F = { parts: [] };
  F.w = (x, y) => V3(X + x * sx, Y + y * sy, 0);
  const ax = new THREE.Line(new THREE.BufferGeometry().setFromPoints([F.w(x0, 0), F.w(x1, 0)]), new THREE.LineBasicMaterial({ color: '#6e5f49' }));
  lab.world.add(ax); F.parts.push(ax);
  if (o.yaxis !== false) { const ay = new THREE.Line(new THREE.BufferGeometry().setFromPoints([F.w(0, o.ymin ?? -2), F.w(0, o.ymax ?? 2)]), new THREE.LineBasicMaterial({ color: '#6e5f49' })); lab.world.add(ay); F.parts.push(ay); }
  const pts = (f) => { const out = []; for (let k = 0; k <= 160; k++) { const x = x0 + (x1 - x0) * k / 160; out.push(F.w(x, f(x))); } return out; };
  F.curve = (f, color) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts(f)), new THREE.LineBasicMaterial({ color })); lab.world.add(l); F.parts.push(l); l.setF = (g) => l.geometry.setFromPoints(pts(g)); return l; };
  return F;
}
// 鏡頭繞轉（用 kit 的 anim，快轉時直接跳到終點）
async function orbitTo(tok, ms, a0, a1, e0, e1, dist, look) { await anim(tok, ms, (u) => cam(a0 + (a1 - a0) * u, e0 + (e1 - e0) * u, dist, look)); }

// ════════ 2IdtqGM6KWU（MIT 18.06 L11：Matrix spaces、rank 1、small world graphs） ════════
const flat = (M) => M.flat();
const E9 = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) E9.push({ i, j, M: Eij(i, j) });
const SYMB = [Eij(0, 0), Eij(1, 1), Eij(2, 2), mad(Eij(0, 1), Eij(1, 0)), mad(Eij(0, 2), Eij(2, 0)), mad(Eij(1, 2), Eij(2, 1))];
const UPB = E9.filter((e) => e.j >= e.i).map((e) => e.M), DGB = E9.filter((e) => e.i === e.j).map((e) => e.M);
const dimOf = (Ms) => (Ms.length ? rk(Ms.map(flat)) : 0);
const DIM_M = dimOf(E9.map((e) => e.M)), DIM_S = dimOf(SYMB), DIM_U = dimOf(UPB), DIM_D = dimOf(DGB), DIM_SU = dimOf([...SYMB, ...UPB]);
const SYM_OK = SYMB.every(isSym), UP_OK = UPB.every(isUp), DG_OK = DGB.every(isDiag);
const g3 = (M, x, y, color, o = {}) => mgrid(M, x, y, 0, Object.assign({ color: typeof color === 'function' ? color : () => color }, o));
const small9 = (S, y = 0.9, pick) => {
  S.e9 = E9.map((e, k) => { const g = g3(e.M.map((r) => r.map((v) => (v ? 1 : ''))), -6.4 + k * 1.5, y, VC.pale, { size: 0.3, gap: 0.36 }); if (pick && pick(e.M)) g.c.flat().forEach((m) => tint(m, VC.d)); return g; });
};
const A11 = [[1, 2, 0], [0, 3, 1], [4, 0, 2]], B11 = [[0, 1, 1], [2, 0, 0], [1, 1, 3]];
const S1 = [[1, 2, 3], [2, 4, 5], [3, 5, 6]], S2 = [[0, 1, 0], [1, 2, 1], [0, 1, 0]];
const U1 = [[1, 2, 3], [0, 4, 5], [0, 0, 6]], U2 = [[2, 0, 1], [0, 1, 0], [0, 0, 3]];
scene('vsB-l11-mspace', 'L11：3×3 矩陣也是向量', [
  async (tok, S) => { // @17
    S.h = hd('上一講的「向量」：不是一排數字', 0, 7.2);
    S.A = g3(A11, -6.2, 5.6, VC.a); sm('A（示意）', -5.4, 6.35); S.B = g3(B11, -2.4, 5.6, VC.b); sm('B（示意）', -1.6, 6.35);
    cap('上一講最後的例子：矩陣', '它們不是一排數字');
  },
  async (tok, S) => { // @33
    pl('+', -3.4, 4.85); pl('=', 0.4, 4.85);
    const C = mad(A11, B11); S.sum = g3(C, 1.4, 5.6, VC.d); sm('A + B', 2.2, 6.35);
    pl('2 ×', 4.1, 4.85); S.k2 = g3(msc(A11, 2), 4.8, 5.6, VC.c); sm('2A', 5.6, 6.35);
    ok(eqM(C, A11.map((r, i) => r.map((x, j) => x + B11[i][j]))) && C[2][0] === 5, -1.0, 2.6, '對應的格子相加 ✓　每格乘 2 ✓');
    cap('可以相加、可以乘一個數', '所以也可以叫它們「向量」');
  },
  async (tok, S) => { // @72
    S.m = hot('M = 所有 3×3 矩陣構成的向量空間', 0, 1.6);
    cap('例子：M = 所有 3×3 矩陣', '');
  },
  async (tok, S) => { // @89
    good('相加 ✓　乘純量 ✓　→ 結果還是 3×3', 0, 0.8);
    cap('加起來、乘常數，還是 3×3 矩陣', '留在 M 裡面');
  },
  async (tok, S) => { // @92
    const AB = mm(A11, B11);
    bad('A·B 也算得出來（第一列 = ' + mrow(AB[0], 2) + '），但「矩陣相乘」不是向量空間的運算', 0, 0.0);
    cap('兩個矩陣可以相乘，但我們不做', '向量空間只看：加法、乘純量');
  },
  async (tok, S) => { // @112
    fresh(CAM[0], CAM[1]);
    hd('M 裡面有趣的子空間', 0, 7.2);
    S.s1 = g3(S1, -6.2, 5.6, VC.a); sm('對稱（示意）', -5.4, 6.35);
    [[0, 1], [0, 2], [1, 2]].forEach(([i, j]) => { glow(S.s1.c[i][j], GOLD); glow(S.s1.c[j][i], GOLD); });
    ok(isSym(S1), -5.4, 3.3, 'Aᵀ = A：對稱 ✓');
    cap('子空間一：對稱矩陣 S', '對角線兩邊互為鏡像');
  },
  async (tok, S) => { // @125
    S.u1 = g3(U1, -6.2, 2.0, VC.b); sm('上三角（示意）', -5.4, 2.75);
    [[1, 0], [2, 0], [2, 1]].forEach(([i, j]) => tint(S.u1.c[i][j], '#f3ece0'));
    ok(isUp(U1), -5.4, -0.3, '對角線下方全是 0 ✓');
    cap('子空間二：上三角矩陣 U', '');
  },
  async (tok, S) => { // @141
    pl('+', -3.4, 4.85); S.s2 = g3(S2, -2.4, 5.6, VC.a); pl('=', 0.4, 4.85);
    const C = mad(S1, S2); S.r = g3(C, 1.4, 5.6, VC.d); S.rl = ok(isSym(C), 2.2, 3.3, '對稱 + 對稱 = 對稱 ✓');
    cap('兩個對稱矩陣相加：還是對稱', '');
  },
  async (tok, S) => { // @145
    gone(S.r, S.rl);
    const C = mm(S1, S2); S.r = g3(C, 1.4, 5.6, VC.r); pl('×', -3.4, 5.4);
    S.rl = ok(!isSym(C), 2.6, 3.3, '對稱 × 對稱：(1,2) 格 = ' + C[0][1] + '、(2,1) 格 = ' + C[1][0] + ' → 不對稱 ✓');
    cap('相乘呢？乘積不一定對稱', '但我們不乘，只相加 → S 是子空間');
  },
  async (tok, S) => { // @159
    pl('+', -3.4, 1.25); S.u2 = g3(U2, -2.4, 2.0, VC.b); pl('=', 0.4, 1.25);
    const C = mad(U1, U2); g3(C, 1.4, 2.0, VC.d); ok(isUp(C), 2.2, -0.3, '上三角 + 上三角 = 上三角 ✓');
    cap('兩個上三角相加：還是上三角', '所以 U 也是子空間');
  },
]);

scene('vsB-l11-basis', 'L11：M 的基底與維度 9', [
  async (tok, S) => { // @168
    hd('M 的基底是什麼？維度是多少？', 0, 7.2);
    S.g = g3(zeros(3, 3).map((r) => r.map(() => '')), -0.8, 5.8, VC.pale);
    cap('問題：子空間的基底？維度？整個 M 的維度？', '');
  },
  async (tok, S) => { // @181
    S.n = sm('先替整個 M 找一組「自然」的基底', 0, 3.2);
    cap('所有 3×3 矩陣有一組很自然的基底', '把它寫下來，數一數有幾個');
  },
  async (tok, S) => { // @227
    'abcdefghi'.split('').forEach((ch, k) => S.g.set(Math.floor(k / 3), k % 3, ch));
    S.cnt = hot('一個 3×3 矩陣要 9 個數才能決定', 0, 2.6);
    cap('決定一個 3×3 矩陣需要幾個數？', '9 個');
  },
  async (tok, S) => { // @239
    const show = (k) => { const g = g3(E9[k].M.map((r) => r.map((v) => (v ? 1 : ''))), -6.4 + k * 1.5, 0.9, VC.pale, { size: 0.3, gap: 0.36 }); tint(g.c[E9[k].i][E9[k].j], VC.a); };
    S.show = show; show(0); S.g.clearGlow(); glow(S.g.c[0][0], GOLD);
    cap('最明顯的基底：只有一格是 1 的矩陣', '第一個：左上角是 1');
  },
  async (tok, S) => { // @246
    S.show(1); S.g.clearGlow(); glow(S.g.c[0][1], GOLD);
    cap('下一個：1 換到旁邊那格', '');
  },
  async (tok, S) => { // @256
    for (let k = 2; k < 8; k++) { S.show(k); S.g.clearGlow(); glow(S.g.c[E9[k].i][E9[k].j], GOLD); await wt(tok, 220); }
    cap('第三個、第四個……依序往下', '');
  },
  async (tok, S) => { // @263
    S.show(8); S.g.clearGlow(); glow(S.g.c[2][2], GOLD);
    cap('最後一個：1 在右下角', '');
  },
  async (tok, S) => { // @274
    S.g.clearGlow(); txt(S.cnt, '標準基底：9 個矩陣 → dim M = ' + DIM_M);
    ok(DIM_M === 9, 0, 1.9, '程式檢查：這 9 個彼此獨立 ✓（攤平後 rank = ' + DIM_M + '）');
    cap('這就是標準基底', 'dim M = 9');
  },
  async (tok, S) => { // @276
    gone(S.n); const cubes = S.g.c.flat(), from = cubes.map((m) => m.position.clone());
    await anim(tok, 1600, (u) => cubes.forEach((m, k) => m.position.lerpVectors(from[k], V3(4.6, 6.6 - k * 0.56, 0), u)));
    note('9 個數排成方形，而不是一直行 → M 幾乎就是 R⁹', -1.6, 3.6);
    cap('M 其實就像 9 維空間', '只是 9 個數排成正方形，不是排成一行');
  },
]);

scene('vsB-l11-su', 'L11：對稱 S、上三角 U 的維度都是 6', [
  async (tok, S) => { // @301
    hd('S：所有 3×3 對稱矩陣', -4.8, 7.2);
    S.s = g3(zeros(3, 3).map((r) => r.map(() => '')), -5.6, 5.8, VC.pale);
    cap('對稱 3×3 矩陣構成的子空間', '它的維度？基底？');
  },
  async (tok, S) => { // @327
    small9(S, 0.9, isSym);
    const n = E9.filter((e) => isSym(e.M)).length;
    S.c3 = ok(n === 3, 0, 2.0, 'M 的 9 個基底矩陣裡，只有 ' + n + ' 個是對稱的（綠色）✓');
    cap('原本的 9 個基底，有幾個落在 S 裡？', '只有 3 個：1 在對角線上的那 3 個');
  },
  async (tok, S) => { // @359
    const X = mad(Eij(0, 1), Eij(1, 0));
    S.nb = note('可是 S 不只這些：例如 E₁₂ + E₂₁ 也對稱' + (isSym(X) ? ' ✓' : ''), 0, 2.8);
    cap('但光這 3 個不夠', 'S 裡還有別的方向');
  },
  async (tok, S) => { // @390
    gone(S.c3, S.nb);
    ['a', 'b', 'c'].forEach((ch, k) => { S.s.set(k, k, ch); tint(S.s.c[k][k], VC.a); });
    S.cnt = hot('要選幾個數？', -4.8, 3.3);
    cap('一個對稱矩陣，要自己選幾個數？', '');
  },
  async (tok, S) => { // @405
    [[0, 1, 'd'], [0, 2, 'e'], [1, 2, 'f']].forEach(([i, j, ch]) => { S.s.set(i, j, ch); tint(S.s.c[i][j], VC.d); });
    txt(S.cnt, '對角 3 個 + 上方 3 個 = 6');
    cap('對角線 3 個，加上對角線上方 3 個', '');
  },
  async (tok, S) => { // @413
    [[1, 0, 'd'], [2, 0, 'e'], [2, 1, 'f']].forEach(([i, j, ch]) => { S.s.set(i, j, ch); tint(S.s.c[i][j], '#bfe6d4'); });
    ok(DIM_S === 6 && SYM_OK, -4.8, 2.6, '下方抄上方 → dim S = ' + DIM_S + ' ✓');
    cap('下方 3 個由上方決定', 'dim S = 6');
  },
  async (tok, S) => { // @417
    hd('U：所有 3×3 上三角矩陣', 3.6, 7.2);
    S.u = g3(zeros(3, 3).map((r) => r.map(() => '')), 2.8, 5.8, VC.pale);
    cap('上三角矩陣 U 的維度呢？', '');
  },
  async (tok, S) => { // @431
    let c = 0;
    for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) { S.u.set(i, j, '*'); tint(S.u.c[i][j], VC.b); c++; await wt(tok, 160); }
    ok(c === DIM_U && UP_OK, 3.6, 3.3, 'dim U = ' + DIM_U + ' ✓');
    cap('一樣是 6', '');
  },
  async (tok, S) => { // @449
    S.e9.forEach((g, k) => g.c.flat().forEach((m) => tint(m, isUp(E9[k].M) ? VC.b : VC.pale)));
    const n = E9.filter((e) => isUp(e.M)).length;
    ok(n === 6, 0, 2.0, '這次 9 個裡剛好有 ' + n + ' 個是上三角（橘色）✓ → 直接就是 U 的基底');
    cap('這次很巧：大基底裡剛好藏著 U 的基底', '');
  },
  async (tok, S) => { // @467
    note('S 就沒這麼巧：子空間的基底通常要重新找', 0, 2.8);
    cap('對稱的情況就不行', '一般要替子空間重新想一組基底');
  },
]);

scene('vsB-l11-cap', 'L11：S ∩ U = 對角矩陣，維度 3', [
  async (tok, S) => { // @486
    hd('又對稱、又是上三角？', 0, 7.2);
    S.s = g3([['a', 'd', 'e'], ['d', 'b', 'f'], ['e', 'f', 'c']], -6.0, 5.6, VC.a); sm('S', -5.2, 6.35);
    S.u = g3([['*', '*', '*'], [0, '*', '*'], [0, 0, '*']], -1.0, 5.6, VC.b); sm('U', -0.2, 6.35);
    cap('同時屬於 S 和 U 的矩陣', '');
  },
  async (tok, S) => { // @519
    const D = [[1, 0, 0], [0, 5, 0], [0, 0, 2]];
    S.d = g3(D, 3.6, 5.6, (i, j) => (i === j ? VC.d : VC.pale)); sm('D（示意）', 4.4, 6.35);
    ok(isSym(D) && isUp(D), 4.4, 3.3, '對稱：下方 = 上方；上三角：下方 = 0 → 上方也 = 0 ✓');
    cap('對稱 + 上三角 → 只剩對角線', '也就是對角矩陣');
  },
  async (tok, S) => { // @546
    hot('S ∩ U：同時在 S 裡、也在 U 裡的「向量」', 0, 2.2);
    cap('∩（intersection）= 兩邊都有的', '');
  },
  async (tok, S) => { // @552
    ok(DIM_D === 3 && DG_OK, 0, 1.3, 'S ∩ U = 對角矩陣 D，dim = ' + DIM_D + ' ✓（基底：3 個對角的 Eᵢᵢ）');
    cap('S ∩ U = 對角矩陣', 'dim = 3');
  },
]);

const Ssm = [[1, 2, 0], [2, 1, 0], [0, 0, 1]], Usm = [[0, 0, 3], [0, 0, 0], [0, 0, 0]];
const MG = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
const sPart = MG.map((r, i) => r.map((x, j) => (i > j ? x : i < j ? MG[j][i] : 0))), uPart = mad(MG, msc(sPart, -1));
scene('vsB-l11-sum', 'L11：S ∪ U 不是子空間；S + U = M', [
  async (tok, S) => { // @585
    hd('S ∪ U：對稱「或」上三角的矩陣', 0, 7.2);
    cap('把兩個子空間「合在一起」（union）', '這樣好嗎？');
  },
  async (tok, S) => { // @622
    const C = mad(Ssm, Usm);
    g3(Ssm, -6.2, 5.6, VC.a); sm('對稱（示意）', -5.4, 6.35); pl('+', -3.4, 4.85);
    g3(Usm, -2.4, 5.6, VC.b); sm('上三角', -1.6, 6.35); pl('=', 0.4, 4.85);
    g3(C, 1.4, 5.6, VC.r);
    ok(!isSym(C) && !isUp(C), 2.2, 3.3, '既不對稱、也不是上三角 → 不在 S ∪ U ✓');
    cap('S ∪ U 不是子空間', '兩個成員相加就跑出去了');
  },
  async (tok, S) => { // @628
    const G = plane2(4.9, 0.9, 0.42, 3, { grid: false, names: false }); S.G = G;
    lineThrough(G, [1, 0], VC.a, 3); lineThrough(G, [1, 1], VC.b, 3);
    const a = [2, 0], b = [1, 1]; G.vec(a, VC.a); G.vec(b, VC.b); G.vec([a[0] + b[0], a[1] + b[1]], VC.r, 'a+b');
    sm('像平面上兩條線：和不在任一條線上', 4.9, -0.6);
    cap('就像平面上兩條直線', '只放兩條線不夠，要把中間「填滿」');
  },
  async (tok, S) => { // @658
    S.p = hot('S + U = { s + u：s ∈ S，u ∈ U }', -2.6, 2.0);
    cap('新的空間：S + U', '用 S 的東西和 U 的東西做組合');
  },
  async (tok, S) => { // @698
    note('任意一個對稱 s，加上任意一個上三角 u', -2.6, 1.2);
    cap('任何 S 裡的 + 任何 U 裡的', '不是把兩堆放在一起而已');
  },
  async (tok, S) => { // @754
    fresh(CAM[0], CAM[1]); hd('對稱 + 上三角，能湊出哪些矩陣？', 0, 7.2);
    g3(MG, -6.2, 5.6, VC.k); sm('任一個 3×3（示意）', -5.4, 6.35); pl('=', -3.4, 4.85);
    g3(sPart, -2.4, 5.6, VC.a); sm('s（對稱）', -1.6, 6.35); pl('+', 0.4, 4.85);
    g3(uPart, 1.4, 5.6, VC.b); sm('u（上三角）', 2.2, 6.35);
    ok(isSym(sPart) && isUp(uPart) && eqM(mad(sPart, uPart), MG), 0, 3.0, 's 對稱 ✓　u 上三角 ✓　s + u = 原矩陣 ✓');
    cap('下半部抄成對稱的 s，剩下的就是上三角 u', '什麼矩陣都湊得出來：S + U = M');
  },
  async (tok, S) => { // @790
    hot('dim(S + U) = ' + DIM_SU, 0, 2.0);
    cap('S + U 就是全部 3×3 矩陣', 'dimension 9');
  },
  async (tok, S) => { // @818
    S.f = pl('dim S + dim U = dim(S ∩ U) + dim(S + U)', 0, 1.1); Object.assign(S.f.element.style, { fontSize: '14px', fontWeight: '800' });
    cap('一個漂亮的公式', 'dim S + dim U = dim(S∩U) + dim(S+U)');
  },
  async (tok, S) => { // @848
    ok(DIM_S + DIM_U === DIM_D + DIM_SU, 0, 0.3, DIM_S + ' + ' + DIM_U + ' = ' + DIM_D + ' + ' + DIM_SU + ' ✓（四個維度都是程式算的）');
    cap('6 + 6 = 3 + 9', '交集與和的維度剛好配得起來');
  },
]);

const resid = (f) => { let m = 0; for (let k = 0; k <= 40; k++) { const x = k * 0.15, h = 1e-3; m = Math.max(m, Math.abs((f(x + h) - 2 * f(x) + f(x - h)) / (h * h) + f(x))); } return m; };
scene('vsB-l11-ode', 'L11：y″ + y = 0 的解空間', [
  async (tok, S) => { // @878
    hd('再一個「沒有向量」的向量空間：微分方程的解', 0, 7.2);
    S.F = fplot(-6.2, 3.4, 12.2 / (2 * Math.PI), 1.25, 0, 2 * Math.PI, { ymin: -1.6, ymax: 1.6 });
    sm('x', 6.3, 3.1);
    cap('最後一個新的向量空間', '來自微分方程');
  },
  async (tok, S) => { // @899
    S.eq = hot('y″ + y = 0', -4.6, 6.2);
    cap('方程：y 的二次微分 + y = 0', '找所有的解');
  },
  async (tok, S) => { // @920
    S.F.curve(Math.cos, VC.a); sm('cos x', -5.8, 5.0);
    ok(resid(Math.cos) < 1e-3, 3.0, 6.2, 'y = cos x：y″ + y ≈ 0 ✓');
    cap('y = cos x 是解', '(cos x)″ = −cos x');
  },
  async (tok, S) => { // @924
    S.F.curve(Math.sin, VC.b); sm('sin x', -3.4, 5.0);
    ok(resid(Math.sin) < 1e-3, 3.0, 5.5, 'y = sin x：y″ + y ≈ 0 ✓');
    cap('y = sin x 也是解', '');
  },
  async (tok, S) => { // @932
    S.ei = note('e^{ix} 也是解，但 e^{ix} = cos x + i sin x，本來就在裡面', 0, 0.9);
    cap('e^{ix} 也是解', '但它已經是 cos 和 sin 的組合');
  },
  async (tok, S) => { // @945
    gone(S.ei); hot('解的集合 = 這個微分方程的 null space', 0, 0.9);
    cap('其實我們在看 null space', '「讓式子等於 0」的全部解');
  },
  async (tok, S) => { // @994
    let c1 = 1, c2 = 0; const lbl = pl('', 3.2, 4.9);
    const cur = S.F.curve((x) => Math.cos(x), VC.g);
    const go = async (a, b, ms) => { const a0 = c1, b0 = c2; await anim(tok, ms, (u) => { c1 = a0 + (a - a0) * u; c2 = b0 + (b - b0) * u; cur.setF((x) => c1 * Math.cos(x) + c2 * Math.sin(x)); txt(lbl, 'y = ' + c1.toFixed(1) + ' cos x + ' + c2.toFixed(1) + ' sin x'); }); };
    await go(0.6, 1, 900); await go(-1, 0.5, 900);
    cap('完整解：y = c₁ cos x + c₂ sin x', '每一組 c₁、c₂ 都是解 → 這是一個向量空間');
  },
  async (tok, S) => { // @1049
    S.b = hot('基底：{ cos x, sin x }', 3.2, 6.2);
    cap('這個解空間的基底', 'cos x 和 sin x');
  },
  async (tok, S) => { // @1059
    note('就像 Ax = 0 的 special solutions', 3.2, 0.1);
    cap('它們就像 special solutions', '只是現在是微分方程的 null space');
  },
  async (tok, S) => { // @1101
    const xs = [0.3, 1.1, 2.0, 2.9, 4.4];
    ok(rk([xs.map(Math.cos), xs.map(Math.sin)]) === 2, -3.6, 0.1, 'cos、sin 不是彼此的倍數（取樣 rank 2）✓ → dimension = 2');
    cap('基底裡有幾個？2 個', '解空間是 2 維');
  },
  async (tok, S) => { // @1112
    txt(S.b, '另一組基底：{ e^{ix}, e^{−ix} }');
    cap('基底不只一組', 'e^{ix}、e^{−ix} 也是一組基底');
  },
  async (tok, S) => { // @1157
    bub('它們看起來是「函數」，但能相加、能乘常數 → 就能當向量', 0, 7.0);
    cap('這些東西看起來不像向量', '但可以做線性組合，所以就是向量');
  },
]);

const R1 = [[1, 4, 5], [2, 8, 10]], u1 = [1, 2], v1 = [1, 4, 5];
const R1_RANK = rk(R1), UVT = u1.map((a) => v1.map((b) => a * b));
scene('vsB-l11-rank1', 'L11：Rank 1 矩陣 = u vᵀ', [
  async (tok, S) => { // @1200
    hd('矩陣最重要的一個數：rank', 0, 7.2);
    cap('回到矩陣最關鍵的數字', 'rank');
  },
  async (tok, S) => { // @1217
    sm('m × n 矩陣：r ≤ m，r ≤ n', 0, 6.6);
    cap('rank 不會比列數 m 大，也不會比欄數 n 大', '');
  },
  async (tok, S) => { // @1230
    S.t = hot('rank 1 的矩陣：應該很簡單', 0, 6.0);
    cap('來看 rank 1 的矩陣', '');
  },
  async (tok, S) => { // @1261
    S.A = g3([[1, 4, 5], ['?', '?', '?']], -6.0, 4.8, VC.a);
    sm('2 × 3', -5.2, 5.5);
    cap('2×3 矩陣，第一列是 1 4 5', '第二列可以是什麼？');
  },
  async (tok, S) => { // @1287
    R1[1].forEach((v, j) => S.A.set(1, j, v));
    ok(R1_RANK === 1, -5.2, 2.6, '第二列 = 2 × 第一列 → rank = ' + R1_RANK + ' ✓');
    cap('2 8 10：第一列的倍數', '不獨立 → rank 1');
  },
  async (tok, S) => { // @1313
    S.A.row(0, GOLD);
    S.rs = sm('row space 基底：(1, 4, 5)', -5.0, 1.9);
    cap('row space 的基底', '就是第一列 (1, 4, 5)');
  },
  async (tok, S) => { // @1326
    S.A.clearGlow(); S.A.col(0, GOLD);
    S.cs = sm('column space：dim = rank = 1', -5.0, 1.3);
    cap('column space 的維度也是 1', 'dim C(A) = dim C(Aᵀ) = r');
  },
  async (tok, S) => { // @1364
    const c2 = col(R1, 1), c3 = col(R1, 2);
    ok(eqV(c2, scl(u1, 4)) && eqV(c3, scl(u1, 5)), -5.0, 0.6, '第 2 欄 = 4·(1, 2)，第 3 欄 = 5·(1, 2) ✓');
    cap('其他欄都是第一欄 (1, 2) 的倍數', '');
  },
  async (tok, S) => { // @1380
    S.A.clearGlow();
    S.u = u1.map((x, i) => cube(x, VC.c, [0.62, 0.62, 0.3], 0.6, 4.8 - i * 0.78, 0, 1.5)); sm('u（pivot 欄）', 0.6, 3.5);
    S.v = v1.map((x, j) => cube(x, VC.b, [0.62, 0.62, 0.3], 1.8 + j * 0.78, 5.8, 0, 1.5)); sm('vᵀ', 4.4, 5.8);
    cap('把 A 寫成：pivot 欄 (1, 2) 乘上一列 (1, 4, 5)', '一欄 × 一列');
  },
  async (tok, S) => { // @1401
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { glow(S.u[i], GOLD); glow(S.v[j], GOLD); cube(UVT[i][j], VC.g, [0.62, 0.62, 0.3], 1.8 + j * 0.78, 4.8 - i * 0.78, 0, 1.2); await wt(tok, 200); glow(S.u[i], null); glow(S.v[j], null); }
    ok(eqM(UVT, R1), 2.6, 2.6, '(2×1)(1×3) = 2×3，而且 u vᵀ = A ✓');
    cap('2×1 乘 1×3 得到 2×3', '算出來剛好就是 A');
  },
  async (tok, S) => { // @1418
    S.f = hot('每個 rank 1 矩陣都長這樣：A = u vᵀ', 2.6, 1.6);
    cap('每個 rank 1 矩陣 = 某一欄 × 某一列', 'u、v 都是 column vector，vᵀ 變成一列');
  },
  async (tok, S) => { // @1462
    note('rank 1 矩陣是組成所有矩陣的積木', 2.6, 0.8);
    cap('rank 1 矩陣是積木', '');
  },
  async (tok, S) => { // @1475
    const blocks = [0, 1, 2, 3].map((k) => { const b = cube('rank 1', [VC.a, VC.b, VC.c, VC.d][k], [1.1, 0.7, 0.2], -4.6 + k * 1.75, -0.4, 0, 1.5); if (k) pl('+', -5.475 + k * 1.75, -0.4); return b; });
    sm('5×17、rank 4 的矩陣 = 4 個 rank 1 相加（示意）', 0, -1.2); void blocks;
    cap('5×17、rank 4 的矩陣', '可以拆成 4 個 rank 1 矩陣相加');
  },
]);

// 5×17：A 用前 4 個標準方向，B 用後 4 個（示意），rank 都由程式算
const big = (diag) => { const M = zeros(5, 17); diag.forEach((d, i) => { M[i][i] = d; }); return M; };
const A4 = big([1, 1, 1, 1, 0]), B4 = big([0, 1, 1, 1, 1]), AB4 = mad(A4, B4);
const RA4 = rk(A4), RB4 = rk(B4), RAB4 = rk(AB4);
const P1 = [[1, 0], [0, 0]], P2 = [[0, 0], [0, 1]];
scene('vsB-l11-notsub', 'L11：rank 4（或 rank 1）的矩陣不構成子空間', [
  async (tok, S) => { // @1527
    hd('所有 rank 4 的矩陣，構成子空間嗎？', 0, 7.2);
    cap('問題：rank 4 的矩陣形成子空間嗎？', '');
  },
  async (tok, S) => { // @1565
    S.m = cube('M：所有 5 × 17 矩陣', VC.pale, [5.2, 1.0, 0.2], 0, 5.8, 0);
    cap('大空間 M：所有 5×17 矩陣', '看裡面 rank 4 的那一群');
  },
  async (tok, S) => { // @1594
    note('先讓零矩陣進來：看「rank ≤ 4」', 0, 4.8);
    cap('要當子空間一定要有零矩陣', '所以改看 rank 4 或更小');
  },
  async (tok, S) => { // @1616
    S.q = hot('兩個 rank 4 相加，還是 rank ≤ 4 嗎？', 0, 4.0);
    cap('關鍵問題：加法封閉嗎？', '');
  },
  async (tok, S) => { // @1633
    const show = (M) => M.map((r) => r.slice(0, 5));
    g3(show(A4), -6.4, 3.0, VC.a, { size: 0.36, gap: 0.42 }); sm('A：rank ' + RA4, -5.6, 0.6);
    pl('+', -4.0, 2.2); g3(show(B4), -3.4, 3.0, VC.b, { size: 0.36, gap: 0.42 }); sm('B：rank ' + RB4, -2.6, 0.6);
    pl('=', -1.0, 2.2); g3(show(AB4), -0.4, 3.0, VC.r, { size: 0.36, gap: 0.42 }); sm('A + B', 0.4, 0.6);
    sm('（只畫前 5 欄，其餘 12 欄全是 0；示意）', -2.6, 0.1);
    ok(RA4 === 4 && RB4 === 4 && RAB4 === 5, 4.2, 2.6, 'rank(A + B) = ' + RAB4 + ' ✓');
    cap('通常不會：rank 可能變成 5', '');
  },
  async (tok, S) => { // @1651
    pl('rank(A + B) ≤ rank A + rank B = 8', 4.2, 1.8);
    sm('但 5×17 的 rank 最多 = 5', 4.2, 1.2);
    cap('一般事實：rank(A+B) ≤ rank(A) + rank(B)', '而 5×17 矩陣 rank 最大也只有 5');
  },
  async (tok, S) => { // @1685
    const C = mad(P1, P2);
    g3(P1, -6.0, -0.8, VC.a, { size: 0.4, gap: 0.48 }); pl('+', -4.6, -1.05); g3(P2, -4.2, -0.8, VC.b, { size: 0.4, gap: 0.48 }); pl('=', -2.8, -1.05); g3(C, -2.4, -0.8, VC.r, { size: 0.4, gap: 0.48 });
    ok(rk(P1) === 1 && rk(P2) === 1 && rk(C) === 2, 2.2, -1.0, 'rank 1 + rank 1 = rank ' + rk(C) + ' ✓（示意）');
    cap('換成 rank 1 也一樣', 'rank 1 + rank 1 通常是 rank 2');
  },
  async (tok, S) => { // @1703
    bad('rank 4 的集合、rank 1 的集合：都不是子空間（加法不封閉）', 0, -1.9);
    cap('結論：不是子空間', '');
  },
]);

const v4 = [2, -1, 3, -4], w4 = [1, 1, -1, -1];
const sum4 = (v) => v.reduce((s, x) => s + x, 0);
scene('vsB-l11-sumzero', 'L11：R⁴ 中「分量和 = 0」是子空間', [
  async (tok, S) => { // @1724
    hd('R⁴ 裡的一個子空間問題', 0, 7.2);
    cap('再問一個子空間的問題', '在 R⁴ 裡');
  },
  async (tok, S) => { // @1737
    S.v = bars(v4, -6.0, 4.0, 0, VC.a, { k: 0.38, gap: 0.5 }); sm('v = (v₁, v₂, v₃, v₄)（示意）', -5.2, 6.2);
    cap('R⁴ 的向量有 4 個分量', 'v₁、v₂、v₃、v₄');
  },
  async (tok, S) => { // @1755
    S.h = hot('S = { v ∈ R⁴：v₁ + v₂ + v₃ + v₄ = 0 }', 1.8, 6.4);
    ok(sum4(v4) === 0, -5.2, 2.0, '2 − 1 + 3 − 4 = ' + sum4(v4) + ' ✓');
    cap('S：分量加起來等於 0 的向量', '');
  },
  async (tok, S) => { // @1791
    S.q = pl('S 是子空間嗎？', 1.8, 5.6);
    cap('它是子空間嗎？', '是。來檢查');
  },
  async (tok, S) => { // @1805
    const v6 = scl(v4, 6); S.b6 = bars(v6.map((x) => x / 6), -1.6, 4.0, 0, VC.c, { k: 0.38, gap: 0.5, noNum: true });
    sm('6v（高度縮小畫）', -0.8, 6.0); ok(sum4(v6) === 0, -0.8, 2.0, '6v：分量和 = 6·0 = ' + sum4(v6) + ' ✓');
    cap('乘 6：分量和還是 0', '6 × 0 = 0');
  },
  async (tok, S) => { // @1819
    const vw = addv(v4, w4);
    bars(w4, 2.4, 4.0, 0, VC.b, { k: 0.38, gap: 0.5 }); sm('w（示意）', 3.2, 6.0);
    bars(vw, 4.6, 4.0, 0, VC.d, { k: 0.38, gap: 0.5 }); sm('v + w', 5.4, 6.0);
    ok(sum4(w4) === 0 && sum4(vw) === 0, 4.4, 1.4, 'v + w = ' + vstr(vw) + '，和 = ' + sum4(vw) + ' ✓');
    cap('兩個相加：分量和還是 0', '→ S 是子空間');
  },
  async (tok, S) => { // @1827
    S.d = hot('它的維度？基底？', 0, 0.4);
    cap('那 S 的維度是多少？基底呢？', '');
  },
  async (tok, S) => { // @1869
    txt(S.d, 'dim S = 3（下一段用 null space 證明）');
    cap('維度是 3', '');
  },
]);

const A1x4 = [[1, 1, 1, 1]], Q14 = subspaces(A1x4);
const SAID3 = [[-1, 1, 0, 0], [-1, 0, 1, 0], [-1, 0, 0, 1]];
const NB_OK = Q14.null.length === 3 && Q14.null.every((x, k) => eqV(x, SAID3[k]) && isZero(mulMV(A1x4, x)));
scene('vsB-l11-four1', 'L11：S = N([1 1 1 1]) 與它的四個子空間', [
  async (tok, S) => { // @1872
    hd('S 是哪個矩陣的 null space？', 0, 7.2);
    cap('這跟 Ax = 0 有什麼關係？', 'S 是某個矩陣的 null space');
  },
  async (tok, S) => { // @1899
    S.A = g3(A1x4, -6.2, 5.8, VC.a); sm('A = [1 1 1 1]', -5.0, 6.5);
    pl('A v = v₁ + v₂ + v₃ + v₄ = 0', -4.8, 5.0);
    cap('A = [1 1 1 1]', 'Av = 0 就是「分量和 = 0」');
  },
  async (tok, S) => { // @1964
    ok(Q14.rank === 1, -4.8, 4.3, 'rank r = ' + Q14.rank + ' ✓');
    cap('先看 rank：r = 1', '');
  },
  async (tok, S) => { // @1977
    pl('dim N(A) = n − r', -4.8, 3.6);
    cap('null space 的維度公式', 'n − r');
  },
  async (tok, S) => { // @1999
    ok(Q14.null.length === 3, -4.8, 2.9, 'n = 4，r = 1 → 4 − 1 = ' + Q14.null.length + ' ✓');
    cap('n = 4 欄，r = 1', 'null space 是 3 維');
  },
  async (tok, S) => { // @2036
    S.A.row(0, GOLD); sm('row space：(1,1,1,1) 的倍數，1 維', -4.8, 2.2);
    cap('row space：這一列的所有倍數', '1 維');
  },
  async (tok, S) => { // @2063
    S.A.clearGlow(); glow(S.A.c[0][0], GOLD); [1, 2, 3].forEach((j) => tint(S.A.c[0][j], '#cfe3f5'));
    sm('pivot：x₁；free：x₂、x₃、x₄', -4.8, 1.5);
    cap('null space 的基底：special solutions', '自由變數是 x₂、x₃、x₄');
  },
  async (tok, S) => { // @2110
    S.s = [];
    const sh = (k) => { const B = bars(Q14.null[k], -0.4 + k * 2.4, 4.2, 0, [VC.b, VC.c, VC.d][k], { k: 0.6, gap: 0.45 }); sm('s' + (k + 1) + ' = ' + vstr(Q14.null[k]), 0.3 + k * 2.4, 6.1); S.s.push(B); };
    sh(0); cap('第一個：x₂ = 1，其他自由變數 = 0', 'x₁ = −1 才會加起來 0');
  },
  async (tok, S) => { // @2120
    (() => { const k = 1; bars(Q14.null[k], -0.4 + k * 2.4, 4.2, 0, VC.c, { k: 0.6, gap: 0.45 }); sm('s2 = ' + vstr(Q14.null[k]), 0.3 + k * 2.4, 6.1); })();
    cap('第二個：x₃ = 1', 'x₁ = −1');
  },
  async (tok, S) => { // @2128
    (() => { const k = 2; bars(Q14.null[k], -0.4 + k * 2.4, 4.2, 0, VC.d, { k: 0.6, gap: 0.45 }); sm('s3 = ' + vstr(Q14.null[k]), 0.3 + k * 2.4, 6.1); })();
    ok(NB_OK, 2.0, 2.9, '三個都滿足 A s = 0，和老師說的一樣 ✓');
    cap('第三個：x₄ = 1', '這 3 個就是 S 的基底');
  },
  async (tok, S) => { // @2155
    S.c = sm('C(A) ⊂ R¹：每一欄只有 1 個分量 → C(A) = R¹', 2.0, 2.2);
    cap('column space：在 R¹ 裡', '1 的所有倍數 = 整個 R¹');
  },
  async (tok, S) => { // @2223
    ok(Q14.left.length === 0, 2.0, 1.5, 'N(Aᵀ)：只有零向量 {0} ✓');
    cap('第四個：N(Aᵀ)', '唯一讓列組合成 0 的方法：全部乘 0');
  },
  async (tok, S) => { // @2261
    const d = [Q14.rank, Q14.null.length, Q14.rank, Q14.left.length];
    [['C(Aᵀ)', d[0], VC.a], ['N(A)', d[1], VC.r], ['C(A)', d[2], VC.d], ['N(Aᵀ)', d[3], VC.c]].forEach(([nm, k, c], i) => { if (k) cube(k, c, [0.7, k * 0.5, 0.7], -5.8 + i * 1.3, -0.6 + k * 0.25, 0, 1.5); sm(nm + '：' + k, -5.8 + i * 1.3, -1.3); });
    ok(d[0] + d[1] === 4, -2.0, 0.8, 'row 1 + null 3 = 4 = n ✓');
    cap('檢查維度：1 + 3 = 4 = n', '');
  },
  async (tok, S) => { // @2276
    ok(Q14.rank + Q14.left.length === 1, 2.6, 0.8, 'column 1 + left null 0 = 1 = m ✓');
    cap('1 + 0 = 1 = m', '');
  },
  async (tok, S) => { // @2313
    note('{0} 是子空間：dim 0，基底是空集合', 2.6, -0.4);
    cap('只有零向量的子空間', 'dimension 0，基底是空集合');
  },
]);

// small world：圖的距離都用 BFS 算
function bfsDiam(n, E) {
  const adj = Array.from({ length: n }, () => []); E.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  let D = 0; for (let s = 0; s < n; s++) { const d = new Array(n).fill(-1); d[s] = 0; const q = [s]; while (q.length) { const x = q.shift(); for (const y of adj[x]) if (d[y] < 0) { d[y] = d[x] + 1; q.push(y); } } D = Math.max(D, ...d); }
  return D;
}
function ringG(n, cx, cy, R, E, col = VC.a) {
  const P = Array.from({ length: n }, (_, k) => [cx + R * Math.cos(Math.PI / 2 + 2 * Math.PI * k / n), cy + R * Math.sin(Math.PI / 2 + 2 * Math.PI * k / n)]);
  const nodes = P.map((p) => { const b = dotBall(col, 0.2); b.position.set(p[0], p[1], 0); return b; });
  const edge = ([a, b], c = '#9c8b70', r = 0.035) => { const m = rod(c, r); m.setW(V3(P[a][0], P[a][1], -0.05), V3(P[b][0], P[b][1], -0.05)); return m; };
  E.forEach((e) => edge(e)); return { P, nodes, edge };
}
const G5 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2]];
scene('vsB-l11-graph', 'L11：graph = 節點 + 邊', [
  async (tok, S) => { // @2344
    hd('最後一個主題：small world graph', 0, 7.2);
    cap('最後幾分鐘：small world graph', '下一講要談圖和線性代數');
  },
  async (tok, S) => { // @2382
    const F = fplot(-6.4, 5.0, 0.4, 0.5, 0, 2 * Math.PI * 1.2, { yaxis: false }); F.curve(Math.sin, VC.gray);
    bad('不是這種函數圖形', -4.9, 4.0);
    cap('這裡的 graph 不是微積分的函數圖', '意思完全不同');
  },
  async (tok, S) => { // @2398
    hot('graph = 一堆節點（node）+ 連接節點的邊（edge）', 2.0, 6.2);
    cap('graph：節點和邊', '邊把兩個節點連起來');
  },
  async (tok, S) => { // @2410
    const g = ringG(5, 2.0, 3.0, 1.9, G5);
    g.nodes.forEach((b, k) => b.add(lab.label(String(k + 1), 'val')));
    sm('5 個節點、' + G5.length + ' 條邊（擺法示意）', 2.0, 0.6);
    cap('例：5 個節點、6 條邊', '');
  },
  async (tok, S) => { // @2435
    note('一個矩陣就能記下整張圖（下一講）', -4.2, 2.4);
    cap('會有一個矩陣告訴我們這張圖的一切', '留到下一講');
  },
  async (tok, S) => { // @2454
    fresh(CAM[0], CAM[1]); hd('教室裡每個人是一個節點；是朋友就連一條邊', 0, 7.2);
    const n = 14, E = []; for (let k = 0; k < n; k++) E.push([k, (k + 1) % n]); E.push([0, 5], [3, 9]);
    S.g = ringG(n, 0, 3.2, 2.7, E, VC.b); sm('（示意）', 3.6, 0.4);
    cap('每個人是一個節點', '兩個人是朋友，就連一條邊');
  },
  async (tok, S) => { // @2503
    hot('問題：任兩個人之間，最多要走幾步？', 0, 0.0);
    cap('問題：從任何人到任何人要幾步？', '最遠的兩個人距離多少？');
  },
]);

const RING = Array.from({ length: 12 }, (_, k) => [k, (k + 1) % 12]);
const SHORT = [[0, 6], [3, 9], [1, 7]];
const D0 = bfsDiam(12, RING), D1 = bfsDiam(12, [...RING, ...SHORT]);
scene('vsB-l11-small', 'L11：幾條捷徑讓距離大幅縮短', [
  async (tok, S) => { // @2609
    hd('距離最遠的兩個人，相隔幾步？', 0, 7.2);
    S.g = ringG(12, -2.0, 3.2, 2.6, RING);
    S.d = ok(D0 === 6, 3.6, 4.2, '12 人圍成一圈（示意）：最遠 = ' + D0 + ' 步 ✓（BFS 算的）');
    cap('真正的問題：最遠可以隔多遠？', '');
  },
  async (tok, S) => { // @2621
    note('「六度分隔」：大約 6 步就連到任何人', 3.6, 3.2);
    cap('six degrees of separation', '大約 6 步');
  },
  async (tok, S) => { // @2686
    SHORT.forEach((e) => S.g.edge(e, VC.r, 0.05));
    ok(D1 < D0, 3.6, 2.2, '加 ' + SHORT.length + ' 條捷徑（紅）：最遠 = ' + D1 + ' 步 ✓');
    cap('只要幾條捷徑', '距離就大幅縮短');
  },
  async (tok, S) => { // @2718
    sm('World Wide Web：網站 = 節點，超連結 = 邊', 3.6, 1.2);
    cap('像全球資訊網這種圖', '節點是網站，邊是連結');
  },
]);

// ════════ 6-wh6yvk6uc（MIT 18.06 L12：Graphs, networks, incidence matrices） ════════
// 老師的圖：4 個節點、5 條邊 1→2、2→3、1→3、1→4、3→4（= 本章的 NODES／EDGES／INC，節點位置是示意）
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const yy = (k) => 'y' + SUB[k + 1], xx = (k) => 'x' + SUB[k + 1];
const AT = T(INC), QI = subspaces(INC), QT = rrefSteps(AT);
const lin = (r, nm) => { let s = ''; r.forEach((c, k) => { if (!c) return; const t = (Math.abs(c) === 1 ? '' : Math.abs(c)) + nm(k); s += s ? (c > 0 ? ' + ' : ' − ') + t : (c > 0 ? '' : '−') + t; }); return s || '0'; };
const AXS = INC.map((r) => xx(r.indexOf(1)) + ' − ' + xx(r.indexOf(-1)));   // 由 INC 的每一列產生：終點 − 起點
const KCL = AT.map((r) => lin(r, yy) + ' = 0');      // −y₁ − y₃ − y₄ = 0 …
const SAID_AX = ['x₂ − x₁', 'x₃ − x₂', 'x₃ − x₁', 'x₄ − x₁', 'x₄ − x₃'];
const AX_OK = AXS.every((s, i) => s === SAID_AX[i]) && INC.every((r) => r.filter((v) => v).length === 2);
const SAID_KCL = ['−y₁ − y₃ − y₄ = 0', 'y₁ − y₂ = 0', 'y₂ + y₃ − y₅ = 0', 'y₄ + y₅ = 0'];
const KCL_OK = KCL.every((s, i) => s === SAID_KCL[i]);
const L1 = [1, 1, -1, 0, 0], L2 = [0, 0, 1, -1, 1], L3 = [1, 1, 0, -1, 1];
const incG = (x, y, o = {}) => { const g = mgrid(INC.map((r) => r.map((v) => (o.blank ? '' : v))), x, y, 0, { color: (i, j) => (o.blank || !INC[i][j] ? '#e7dcc8' : INC[i][j] > 0 ? COL.d : COL.b), size: o.size || 0.56, gap: o.gap || 0.66 }); g.hdr = ['節1', '節2', '節3', '節4'].map((n, j) => sm(n, g.xs[j], y + 0.55)); g.rl = INC.map((_, i) => sm('e' + (i + 1), x - 0.6, g.y(i))); return g; };
const fillRow = (g, i) => INC[i].forEach((v, j) => { g.set(i, j, v); tint(g.c[i][j], !v ? '#e7dcc8' : v > 0 ? COL.d : COL.b); });
async function flowLoop(tok, G, path, color, ms = 1500) {
  const ds = path.map(() => dotBall(color, 0.13));
  path.forEach(([e]) => G.ea[e].glow(GOLD));
  await anim(tok, ms, (u) => path.forEach(([e, dir], i) => { const a = G.ea[e], s = dir > 0 ? a.p : a.q, q = dir > 0 ? a.q : a.p; ds[i].position.copy(s).lerp(q, u); }));
  path.forEach(([e]) => G.ea[e].glow(null));
  return ds;
}
const GCAM = [[0, 3.2, 13], [-0.4, 3.1, 0]];

scene('vsB-l12-graph', 'L12：一張圖、4 個節點、5 條有方向的邊', [
  async (tok, S) => { // @133
    hd('應用數學最重要的模型；離散版本是一張圖', 0, 7.2);
    cap('今天講線性代數的應用', '最重要的模型，離散版就是一張圖');
  },
  async (tok, S) => { // @154
    S.d = pl('graph = 節點（node）+ 邊（edge）', 2.6, 6.2);
    cap('圖：節點和邊', '');
  },
  async (tok, S) => { // @190
    S.nb = NODES.slice(0, 3).map((p, k) => { const b = dotBall(COL.a, 0.3); b.position.set(p[0], p[1], 0); b.add(lab.label(String(k + 1), 'val')); return b; });
    cap('先放節點 1、2、3', '');
  },
  async (tok, S) => { // @198
    const b = dotBall(COL.a, 0.3); b.position.set(NODES[3][0], NODES[3][1], 0); b.add(lab.label('4', 'val')); S.nb.push(b);
    S.rods = EDGES.map(([s, t]) => { const m = rod('#9c8b70', 0.04); m.setW(V3(NODES[s][0], NODES[s][1], -0.05), V3(NODES[t][0], NODES[t][1], -0.05)); return m; });
    cap('再連邊，加上節點 4', '');
  },
  async (tok, S) => { // @210
    hot('n = 4 個節點', 2.6, 5.2);
    cap('n = 4', '節點數 → 矩陣的欄數');
  },
  async (tok, S) => { // @221
    hot('m = ' + EDGES.length + ' 條邊 → 每條邊是矩陣的一列', 2.6, 4.4);
    cap('m = 邊的數目 = 5', '每條邊對應矩陣的一列');
  },
  async (tok, S) => { // @242
    gone(S.rods, S.nb); S.G = drawG();
    sm(EDGES.map(([s, t]) => (s + 1) + '→' + (t + 1)).join('、'), 2.6, 3.6);
    cap('每條邊給一個方向（箭頭）', '1→2、1→3、2→3、1→4、3→4');
  },
  async (tok, S) => { // @264
    note('順著箭頭算 +、逆著箭頭算 −；方向是隨便指定的', 2.6, 2.8);
    cap('電流順著箭頭算正、逆著算負', '方向本身隨便定');
  },
  async (tok, S) => { // @280
    pl('電位（potential）、電位差、電流（current）', 2.6, 2.0);
    cap('用電路的語言：電位、電位差、電流', '把它想成一個電路網路');
  },
  async (tok, S) => { // @304
    sm('也可以是水管、油管網路，或橋樑、圓頂的結構', 2.6, 1.3);
    cap('同樣的數學也適用水流、結構', '');
  },
], { cam: GCAM });

scene('vsB-l12-inc', 'L12：incidence matrix 與迴圈', [
  async (tok, S) => { // @343
    S.G = drawG(NODES, EDGES, { noEdgeLabel: true });
    S.g = incG(1.4, 5.4, { blank: true }); hd('incidence matrix A（5 × 4）', 2.4, 6.6);
    cap('把圖寫成矩陣：incidence matrix', '');
  },
  async (tok, S) => { // @360
    S.g.rl.forEach((l) => setCls(l, 'ptr alt'));
    cap('每一列對應一條邊', '5 條邊 → 5 列；4 個節點 → 4 欄');
  },
  async (tok, S) => { // @372
    S.g.rl.forEach((l) => setCls(l, 'idx')); S.G.ea[0].glow(GOLD); fillRow(S.g, 0);
    cap('邊 1：從節點 1 到節點 2', '起點 −1、終點 +1，其他 0');
  },
  async (tok, S) => { // @414
    S.G.ea[0].glow(null); gone(S.G); S.G = drawG();
    cap('替邊編號：e1 到 e5', '');
  },
  async (tok, S) => { // @441
    S.G.ea[1].glow(GOLD); fillRow(S.g, 1);
    cap('邊 2：節點 2 → 3', '第 2、3 欄是 −1、+1');
  },
  async (tok, S) => { // @450
    S.G.ea[1].glow(null); S.G.ea[2].glow(GOLD); fillRow(S.g, 2);
    cap('邊 3：節點 1 → 3', '');
  },
  async (tok, S) => { // @475
    [0, 1, 2].forEach((i) => S.G.ea[i].glow(GOLD));
    S.lp = hot('邊 1、2、3 圍成一個迴圈（loop）', 2.4, 1.4);
    cap('邊 1、2、3 形成一個迴圈', '迴圈的數目和位置非常關鍵');
  },
  async (tok, S) => { // @506
    [0, 1, 2].forEach((i) => S.g.row(i, GOLD));
    txt(S.lp, '這三列線性獨立嗎？');
    cap('這三列獨立嗎？', '');
  },
  async (tok, S) => { // @521
    const ok3 = eqV(addv(INC[0], INC[1]), INC[2]);
    ok(ok3, 2.4, 0.7, '列 1 + 列 2 = ' + vstr(addv(INC[0], INC[1])) + ' = 列 3 ✓');
    cap('列 1 加列 2 剛好等於列 3', '→ 相依');
  },
  async (tok, S) => { // @532
    txt(S.lp, '迴圈 ↔ 線性相依的列');
    cap('迴圈對應到相依的列', '');
  },
  async (tok, S) => { // @544
    S.g.clearGlow(); [0, 1, 2].forEach((i) => S.G.ea[i].glow(null)); S.G.ea[3].glow(GOLD); fillRow(S.g, 3);
    cap('邊 4：節點 1 → 4', '');
  },
  async (tok, S) => { // @549
    S.G.ea[3].glow(null); S.G.ea[4].glow(GOLD); fillRow(S.g, 4);
    cap('邊 5：節點 3 → 4', 'A 完成了');
  },
  async (tok, S) => { // @589
    S.G.ea[4].glow(null);
    const nz = INC.flat().filter((v) => v).length;
    ok(nz === 2 * INC.length && INC.every((r) => r.filter((v) => v).length === 2), 2.4, 0.0, '每列只有 2 個非零 → 非零共 ' + nz + ' = 2m ✓（很 sparse）');
    cap('大部分是 0：每列只有兩個非零', '非零個數 = 2m，非常 sparse');
  },
], { cam: GCAM });

const XP = [0, 1, 3, 2];
scene('vsB-l12-null', 'L12：N(A)：電位與電位差', [
  async (tok, S) => { // @633
    S.G = drawG(); S.g = incG(0.9, 5.4); hd('第一個問題：A 的 null space', 2.0, 6.6);
    cap('第一個問題：null space', '');
  },
  async (tok, S) => { // @652
    [0, 1, 2, 3].forEach((j) => S.g.col(j, GOLD));
    cap('等於問：這 4 欄獨立嗎？', '獨立的話，null space 只有零向量');
  },
  async (tok, S) => { // @705
    S.g.clearGlow(); S.x = [0, 1, 2, 3].map((j) => sm(xx(j), S.g.xs[j], 2.0)); S.eqs = [];
    S.ah = hd('Ax =', 4.4, 5.9);
    cap('直接解 Ax = 0', 'x = (x₁, x₂, x₃, x₄)');
  },
  async (tok, S) => { // @745
    S.g.row(0, GOLD); S.eqs.push(mono(tag(AXS[0], '', 5.2, S.g.y(0))));
    cap('第一列 (−1, 1, 0, 0) 乘 x', '得到 x₂ − x₁');
  },
  async (tok, S) => { // @761
    for (let i = 1; i < 5; i++) { S.g.clearGlow(); S.g.row(i, GOLD); S.eqs.push(mono(tag(AXS[i], '', 5.2, S.g.y(i)))); await wt(tok, 300); }
    S.g.clearGlow(); ok(AX_OK, 5.2, 2.0, '和老師寫的 5 個分量一致 ✓');
    cap('其他列：x₃ − x₂、x₃ − x₁、x₄ − x₁、x₄ − x₃', '');
  },
  async (tok, S) => { // @793
    S.eqs.forEach((l) => setCls(l, 'ptr alt'));
    cap('A 在算什麼？', '每條邊兩端的「差」');
  },
  async (tok, S) => { // @810
    S.eqs.forEach((l) => setCls(l, ''));
    S.xl = NODES.map((p, k) => hot(xx(k) + ' = ' + XP[k], p[0], p[1] + 0.62, 0.3)); S.xs = sm('（電位數值是示意）', -3.2, 0.0);
    cap('把 x 想成節點上的電位（potential）', '');
  },
  async (tok, S) => { // @843
    const e = mulMV(INC, XP);
    S.dl = EDGES.map(([s, t], i) => { const mid = V3((NODES[s][0] + NODES[t][0]) / 2, (NODES[s][1] + NODES[t][1]) / 2, 0.4); return pl(fmt(e[i]), mid.x, mid.y - 0.1, 0.4); });
    S.eqs.forEach((l, i) => txt(l, AXS[i] + ' = ' + e[i]));
    cap('Ax = 每條邊的電位差', '');
  },
  async (tok, S) => { // @867
    S.q = hot('什麼時候電位差全部是 0？', 4.4, 0.8);
    cap('什麼 x 讓所有差都是 0？', '這就是在找 null space');
  },
  async (tok, S) => { // @914
    const one = [1, 1, 1, 1], e = mulMV(INC, one);
    S.xl.forEach((l, k) => txt(l, xx(k) + ' = 1')); S.dl.forEach((l, i) => txt(l, fmt(e[i]))); S.eqs.forEach((l, i) => txt(l, AXS[i] + ' = ' + e[i]));
    ok(isZero(e), 4.4, 0.1, 'x = (1, 1, 1, 1)：Ax = 0 ✓');
    cap('x = (1, 1, 1, 1)：電位全一樣', '差全是 0');
  },
  async (tok, S) => { // @931
    gone(S.q);
    ok(QI.null.length === 1 && eqV(QI.null[0], [1, 1, 1, 1]), 4.4, 0.8, 'N(A) = c·(1, 1, 1, 1)，dim = ' + QI.null.length + ' ✓');
    cap('N(A) 的基底：(1, 1, 1, 1)', 'null space 是 R⁴ 裡的一條線，dim 1');
  },
  async (tok, S) => { // @987
    S.xl.forEach((l, k) => txt(l, xx(k) + ' = ' + (XP[k] + 5))); const e = mulMV(INC, XP.map((v) => v + 5));
    S.dl.forEach((l, i) => txt(l, fmt(e[i])));
    note('每個電位都 + 5：電位差完全不變', -3.2, -0.6);
    cap('電位只決定到「差一個常數」', '整體加減一個常數，差不變');
  },
  async (tok, S) => { // @995
    sm('電流是電位「差」推動的；電位全相同就不會動', 4.4, -0.6);
    cap('讓電流流動的是電位差', '電位全部一樣就什麼都不會動');
  },
  async (tok, S) => { // @1066
    sm('就像不定積分的 + C', 4.4, -1.2);
    cap('就像微積分的 + C', '要先定一個起點');
  },
  async (tok, S) => { // @1078
    S.xl.forEach((l, k) => txt(l, xx(k) + ' = ' + (XP[k] - XP[3]))); glow(S.G.nb[3], GREEN); S.g.col(3, RED);
    cap('接地（ground）：令 x₄ = 0', '');
  },
  async (tok, S) => { // @1096
    const A3 = INC.map((r) => r.slice(0, 3));
    gone(S.g.c.map((r) => r[3]), S.g.hdr[3], S.x[3]);
    ok(rk(A3) === 3, -3.2, -1.2, '去掉第 4 欄：剩下 3 欄獨立（rank ' + rk(A3) + '）✓');
    cap('x₄ 不再是未知數，第 4 欄消失', '剩下 3 欄是獨立的');
  },
  async (tok, S) => { // @1138
    ok(QI.rank === 3, 4.4, -1.8, 'rank A = ' + QI.rank + ' ✓（5 × 4，null space 1 維 → 4 − 1）');
    cap('所以 rank = 3', '');
  },
], { cam: GCAM });

scene('vsB-l12-at', 'L12：Aᵀ 與 dim N(Aᵀ) = m − r', [
  async (tok, S) => { // @1195
    hd('N(Aᵀ)：Aᵀy = 0', 0, 7.2);
    sm('可能是應用數學最基本的方程', 0, 6.6);
    cap('接著看 A 轉置的 null space', 'Aᵀy = 0：應用數學最基本的方程');
  },
  async (tok, S) => { // @1238
    S.q = hot('它的維度是多少？', 0, 6.0);
    cap('它的維度？', '');
  },
  async (tok, S) => { // @1259
    S.g = mgrid(AT, -3.2, 5.0, 0, { color: (i, j) => (!AT[i][j] ? '#e7dcc8' : AT[i][j] > 0 ? COL.d : COL.b), size: 0.6, gap: 0.72 });
    ['y₁', 'y₂', 'y₃', 'y₄', 'y₅'].forEach((n, j) => sm(n, S.g.xs[j], 5.6)); sm('Aᵀ：4 × 5（n × m）', -1.8, 1.6);
    cap('Aᵀ 是 n × m = 4 × 5', 'A 的欄變成 Aᵀ 的列');
  },
  async (tok, S) => { // @1276
    S.g.row(0, GOLD); pl('第 1 列 = ' + vstr(AT[0]) + '（A 的第 1 欄）', 3.6, 5.0);
    cap('A 的第一欄 → Aᵀ 的第一列', '(−1, 0, −1, −1, 0)');
  },
  async (tok, S) => { // @1284
    for (let i = 1; i < 4; i++) { S.g.clearGlow(); S.g.row(i, GOLD); await wt(tok, 450); }
    S.g.clearGlow(); cap('第 2、3、4 欄也一樣變成列', '');
  },
  async (tok, S) => { // @1308
    pl('乘上 y = (y₁, y₂, y₃, y₄, y₅)', 3.6, 4.2);
    cap('Aᵀ 乘的是有 5 個分量的 y', '');
  },
  async (tok, S) => { // @1360
    txt(S.q, '一般公式？用 r、m、n 表示');
    cap('先講一般公式', '');
  },
  async (tok, S) => { // @1381
    pl('dim N(Aᵀ) = m − r', 3.6, 3.2);
    cap('dim N(Aᵀ) = m − r', 'Aᵀ 有 m 欄，其中 r 欄是 pivot，剩下 m − r 個自由');
  },
  async (tok, S) => { // @1408
    ok(QI.left.length === 5 - 3, 3.6, 2.4, 'm − r = 5 − 3 = ' + QI.left.length + ' ✓');
    cap('5 − 3 = 2', '接下來找它的基底，並看懂這個方程');
  },
]);

scene('vsB-l12-ohm', 'L12：電位 → 電位差 → 電流（Ohm 定律）→ KCL', [
  async (tok, S) => { // @1444
    hd('應用數學的大圖像', 0, 7.2);
    const box = (t, x, y, c) => { cube('', c, [2.4, 0.9, 0.3], x, y, 0, 1.5); return hd(t, x, y, 0.3); };
    S.box = box; box('x：節點電位', -4.2, 5.4, COL.a);
    S.ar = (x1, y1, x2, y2, t) => { const a = varrow('#8a7b66', 0.05); a.setW(V3(x1, y1, 0), V3(x2, y2, 0)); return hot(t, (x1 + x2) / 2, (y1 + y2) / 2 + 0.45, 0.2); };
    S.ar(-2.9, 5.4, 2.9, 5.4, 'e = Ax'); box('e：電位差', 4.2, 5.4, COL.b);
    cap('從電位 x 出發，A 算出電位差 e', '');
  },
  async (tok, S) => { // @1449
    S.ar(4.2, 4.85, 4.2, 2.65, '× C');
    cap('矩陣 C 把電位差變成電流', '');
  },
  async (tok, S) => { // @1459
    S.box('y：邊上的電流', 4.2, 2.1, COL.c); sm('y₁, y₂, y₃, y₄, y₅', 4.2, 1.4);
    cap('y = 邊上的電流', '');
  },
  async (tok, S) => { // @1474
    pl('y = C e：Ohm 定律', 0.6, 3.6);
    cap('這一步是 Ohm 定律', '');
  },
  async (tok, S) => { // @1493
    sm('電流 = 電導 × 電位差；電導 = 1 / 電阻', 0.6, 3.0);
    cap('邊上的電流 = 一個數 × 電位差', '那個數是電導，1 / 電阻');
  },
  async (tok, S) => { // @1522
    S.ar(2.9, 2.1, -2.9, 2.1, 'Aᵀy = 0'); S.box('平衡', -4.2, 2.1, COL.d);
    cap('最後一步：Aᵀy = 0', '');
  },
  async (tok, S) => { // @1541
    hot('Aᵀy = 0：Kirchhoff 電流定律（KCL）', 0, 0.6);
    cap('它有個有名的名字', 'Kirchhoff\'s Current Law（KCL）');
  },
  async (tok, S) => { // @1573
    note('實際應用裡同時出現 A 和 Aᵀ → 四個子空間正是該懂的東西', 0, -0.3);
    cap('真實應用裡，A 和 Aᵀ 一起出現', '所以四個基本子空間正是我們要懂的');
  },
]);

scene('vsB-l12-kcl', 'L12：KCL：每個節點流進 = 流出', [
  async (tok, S) => { // @1600
    S.G = drawG(NODES, EDGES, { edgeName: 'y' }); hd('找 5 個電流，滿足 KCL', 2.4, 6.6);
    S.L = KCL.map((s, i) => mono(tag('節' + (i + 1) + '：' + s, '', 3.2, 5.4 - i * 0.62))); S.L.forEach((l) => showL(l, false));
    cap('Aᵀy = 0 的解：5 個電流', '先看懂這條定律在說什麼');
  },
  async (tok, S) => { // @1630
    showL(S.L[0], true); setCls(S.L[0], 'ptr alt');
    ok(KCL_OK, 3.2, 1.6, 'Aᵀ 每一列寫出的式子和黑板一致 ✓');
    cap('Aᵀ 第一列：−y₁ − y₃ − y₄ = 0', '這條式子從哪來？');
  },
  async (tok, S) => { // @1645
    S.G.ea.forEach((a) => a.glow(GOLD)); await wt(tok, 600); S.G.ea.forEach((a) => a.glow(null));
    cap('把圖重畫一次，邊上標電流 y', '');
  },
  async (tok, S) => { // @1702
    glow(S.G.nb[0], GOLD); [0, 2, 3].forEach((e) => S.G.ea[e].glow(GOLD));
    cap('y₁、y₃、y₄ 都從節點 1 流出', '第一條式子說的是節點 1');
  },
  async (tok, S) => { // @1714
    S.n = note('淨流量 = 0：平衡方程、守恆定律', -3.2, 0.0);
    cap('節點 1 的淨流量是 0', '這是平衡方程（守恆定律）');
  },
  async (tok, S) => { // @1747
    glow(S.G.nb[0], null); [0, 2, 3].forEach((e) => S.G.ea[e].glow(null)); setCls(S.L[0], '');
    showL(S.L[1], true); setCls(S.L[1], 'ptr alt'); glow(S.G.nb[1], GOLD); [0, 1].forEach((e) => S.G.ea[e].glow(GOLD));
    cap('第二列：y₁ − y₂ = 0', '節點 2：流進 y₁ = 流出 y₂');
  },
  async (tok, S) => { // @1766
    glow(S.G.nb[1], null); [0, 1].forEach((e) => S.G.ea[e].glow(null)); setCls(S.L[1], '');
    showL(S.L[2], true); setCls(S.L[2], 'ptr alt'); glow(S.G.nb[2], GOLD); [1, 2, 4].forEach((e) => S.G.ea[e].glow(GOLD));
    cap('第三列：y₂ + y₃ − y₅ = 0', '節點 3：y₂、y₃ 流進，y₅ 流出');
  },
  async (tok, S) => { // @1784
    glow(S.G.nb[2], null); [1, 2, 4].forEach((e) => S.G.ea[e].glow(null)); setCls(S.L[2], '');
    showL(S.L[3], true); setCls(S.L[3], 'ptr alt'); glow(S.G.nb[3], GOLD); [3, 4].forEach((e) => S.G.ea[e].glow(GOLD));
    cap('第四列：y₄ + y₅ = 0', '節點 4 的總流量是 0');
  },
  async (tok, S) => { // @1797
    glow(S.G.nb[3], null); [3, 4].forEach((e) => S.G.ea[e].glow(null)); setCls(S.L[3], '');
    txt(S.n, '電荷不會在節點累積：流進 = 流出');
    cap('電荷不會堆在節點上', '它只是在網路裡繞');
  },
], { cam: GCAM });

const inNT = (y) => isZero(mulMV(AT, y));
scene('vsB-l12-loops', 'L12：繞迴圈的電流 = N(Aᵀ) 的基底', [
  async (tok, S) => { // @1808
    S.G = drawG(NODES, EDGES, { edgeName: 'y' }); hd('哪些 y 滿足 Aᵀy = 0？看圖就知道', 2.4, 6.6);
    cap('回到線性代數：哪個 y 解這些方程？', '不想做消去，看圖找');
  },
  async (tok, S) => { // @1858
    const R = QT.R;
    S.r = mgrid(R, 1.0, 5.6, 0, { color: (i) => (i < QT.rank ? '#d9cbb2' : COL.r), size: 0.44, gap: 0.52 }); sm('Aᵀ 消去後的 R', 2.0, 3.3);
    ok(isZero(R[3]) && QT.rank === 3, 4.6, 4.4, '最後一列全是 0（rank 3）✓');
    cap('如果對 Aᵀ 做消去', '最後一列會全是 0，因為 rank 只有 3');
  },
  async (tok, S) => { // @1906
    gone(S.r); S.q = hot('電流怎麼繞，節點才不會累積電荷？', 2.4, 5.8);
    cap('電流要怎麼在網路裡流', '才不會在節點堆積電荷？');
  },
  async (tok, S) => { // @1923
    S.n = pl('基底要 ' + QI.left.length + ' 個向量（dim N(Aᵀ) = 2）', 2.4, 5.1);
    cap('要找幾個？2 個', '這是 2 維空間');
  },
  async (tok, S) => { // @1948
    S.y = pl('y = (1, ?, ?, ?, ?)', 2.4, 4.3); S.G.ea[0].glow(GOLD);
    cap('先讓 y₁ = 1', '1 安培順著邊 1 流');
  },
  async (tok, S) => { // @1961
    txt(S.y, 'y = (1, 1, ?, ?, ?)'); S.G.ea[1].glow(GOLD);
    cap('y₂ 也是 1', '節點 2 的式子 y₁ = y₂');
  },
  async (tok, S) => { // @1979
    txt(S.y, 'y = (1, 1, −1, ?, ?)'); S.G.ea[2].glow(GOLD);
    cap('y₃ = −1', '逆著邊 3 的箭頭流回節點 1');
  },
  async (tok, S) => { // @1991
    txt(S.y, 'y = ' + vstr(L1)); S.d1 = await flowLoop(tok, S.G, [[0, 1], [1, 1], [2, -1]], COL.r);
    cap('1 安培繞迴圈 1-2-3', 'y₄ = y₅ = 0');
  },
  async (tok, S) => { // @2005
    ok(inNT(L1), 2.4, 3.6, 'Aᵀ y = 0 ✓：沿迴圈的電流滿足 KCL');
    cap('檢查：滿足 KCL', '任何繞迴圈的電流都滿足');
  },
  async (tok, S) => { // @2033
    S.y2 = pl('y = ' + vstr(L2), 2.4, 2.8); S.d2 = await flowLoop(tok, S.G, [[2, 1], [4, 1], [3, -1]], COL.d);
    ok(inNT(L2), 2.4, 2.2, '第二個迴圈 1-3-4：Aᵀ y = 0 ✓');
    cap('第二個：繞另一個迴圈', 'y₃ = 1、y₅ = 1、y₄ = −1');
  },
  async (tok, S) => { // @2051
    ok(rk([L1, L2]) === 2, 2.4, 1.5, '兩個彼此獨立 ✓ → N(Aᵀ) 的基底');
    cap('兩個迴圈電流彼此獨立', '這就是 N(Aᵀ) 的基底');
  },
  async (tok, S) => { // @2068
    gone(S.d1, S.d2); S.y3 = pl('外圈：y = ' + vstr(L3), 2.4, 0.8); S.d3 = await flowLoop(tok, S.G, [[0, 1], [1, 1], [4, 1], [3, -1]], COL.c);
    ok(inNT(L3), 2.4, 0.2, '外圈電流也滿足 KCL ✓');
    cap('繞外面的大迴圈呢？', '(1, 1, 0, −1, 1) 也在 N(Aᵀ) 裡');
  },
  async (tok, S) => { // @2101
    ok(eqV(addv(L1, L2), L3), 2.4, -0.5, '外圈 = 迴圈一 + 迴圈二（邊 3 抵消）✓ → 不獨立');
    cap('它不是新的', '是前兩個相加，邊 3 上的電流互相抵消');
  },
  async (tok, S) => { // @2129
    txt(S.q, 'N(Aᵀ) 找到了：就是「繞獨立小迴圈的電流」');
    cap('解出了 KCL', '而且是用網路的語言看懂它');
  },
], { cam: GCAM });

const TREE = [0, 1, 3];
scene('vsB-l12-tree', 'L12：row space 與樹（沒有迴圈的圖）', [
  async (tok, S) => { // @2158
    S.G = drawG(); hd('row space of A = column space of Aᵀ', 2.4, 6.6);
    S.g = mgrid(AT, 0.4, 5.4, 0, { color: (i, j) => (!AT[i][j] ? '#e7dcc8' : AT[i][j] > 0 ? COL.d : COL.b), size: 0.5, gap: 0.6 });
    S.g.xs.forEach((x, j) => sm('e' + (j + 1), x, 6.0));
    cap('最後一個子空間：A 的 row space', '也就是 Aᵀ 的 column space');
  },
  async (tok, S) => { // @2175
    ok(QI.rank === 3, 4.6, 5.0, 'dim = rank = ' + QI.rank + ' ✓');
    cap('維度？就是 rank，3', 'A 的 5 列裡有 3 列獨立');
  },
  async (tok, S) => { // @2199
    [0, 1, 2].forEach((j) => S.g.col(j, GOLD));
    cap('Aᵀ 的前三欄獨立嗎？', '不是');
  },
  async (tok, S) => { // @2216
    ok(eqV(addv(col(AT, 0), col(AT, 1)), col(AT, 2)), 4.6, 4.2, '欄 1 + 欄 2 = 欄 3 ✓（來自迴圈）');
    cap('欄 1 + 欄 2 = 欄 3', '因為邊 1、2、3 是一個迴圈');
  },
  async (tok, S) => { // @2227
    S.g.clearGlow(); QT.piv.forEach((j) => S.g.paintCol(j, COL.g));
    ok(eqV(QT.piv, TREE), 4.6, 3.4, 'pivot 欄 = ' + QT.piv.map((j) => j + 1).join('、') + ' ✓（程式消去得到）');
    cap('pivot 欄：第 1、2、4 欄', '第 3 欄不是');
  },
  async (tok, S) => { // @2245
    TREE.forEach((i) => { S.G.ea[i].color(COL.g); S.G.ea[i].glow(GREEN); }); [2, 4].forEach((i) => S.G.ea[i].color('#ddd2c0'));
    cap('Aᵀ 的欄對應邊', '邊 1、2、4（綠色加粗）');
  },
  async (tok, S) => { // @2265
    pl('同樣 4 個節點、只有 3 條邊的小圖', 2.4, 1.6);
    cap('只看綠色的邊：一張比較小的圖', '4 個節點、3 條邊');
  },
  async (tok, S) => { // @2291
    sm('這 3 條邊沒有迴圈；相依都是迴圈造成的', 2.4, 1.0);
    cap('這 3 條邊沒有迴圈', '所有相依都來自迴圈');
  },
  async (tok, S) => { // @2324
    S.G.ea[2].color(COL.r); S.G.ea[2].glow(RED);
    const withE3 = rk([0, 1, 2, 3].map((i) => INC[i]));
    ok(withE3 === 3, 2.4, 0.4, '再加邊 3：4 列的 rank 還是 ' + withE3 + ' → 出現迴圈 ✓');
    cap('再加任何一條邊', '就會出現迴圈');
  },
  async (tok, S) => { // @2342
    hot('沒有迴圈的圖叫做樹（tree）', 2.4, -0.4);
    cap('沒有迴圈的圖：tree', '');
  },
], { cam: GCAM });

const P5 = [0, 1, 2, 3, 4].map((k) => { const a = (90 + k * 72) * Math.PI / 180; return [-3.2 + 2.1 * Math.cos(a), 3.0 + 2.0 * Math.sin(a)]; });
const E7 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [0, 3]];
const INC7 = E7.map(([s, t]) => { const r = [0, 0, 0, 0, 0]; r[s] = -1; r[t] = 1; return r; });
const LOOPS7 = E7.length - rk(INC7);
scene('vsB-l12-euler', 'L12：Euler 公式：節點 − 邊 + 迴圈 = 1', [
  async (tok, S) => { // @2360
    S.G = drawG(); hd('用維度公式', 2.4, 6.6);
    cap('用我們的維度公式', '');
  },
  async (tok, S) => { // @2381
    pl('dim N(Aᵀ) = m − r', 2.6, 5.8);
    cap('dim N(Aᵀ) = m − r', '');
  },
  async (tok, S) => { // @2391
    sm('左邊 = 獨立迴圈數；m = 邊數', 2.6, 5.2);
    cap('左邊是獨立迴圈的個數', 'm 是邊的數目');
  },
  async (tok, S) => { // @2418
    pl('r = n − 1（因為 (1,1,1,1) 在 N(A) 裡）', 2.6, 4.5);
    cap('rank 是多少？n − 1', '4 欄裡有一個相依：(1, 1, 1, 1)');
  },
  async (tok, S) => { // @2484
    S.f = hot('節點 − 邊 + 迴圈 = 1', 2.6, 3.6);
    ok(4 - 5 + QI.left.length === 1, 2.6, 2.9, '4 − 5 + ' + QI.left.length + ' = 1 ✓');
    cap('移項：節點數 − 邊數 + 迴圈數 = 1', '');
  },
  async (tok, S) => { // @2516
    sm('節點像 0 維、邊像 1 維、迴圈像 2 維（有面積）', 2.6, 2.2);
    cap('節點像點（0 維），邊像線（1 維）', '迴圈圍出一塊面積（2 維）');
  },
  async (tok, S) => { // @2536
    txt(S.f, 'Euler 公式：節點 − 邊 + 迴圈 = 1');
    cap('對每個（連通的）圖都成立', '這叫 Euler 公式');
  },
  async (tok, S) => { // @2553
    note('線性代數證明了一個拓樸事實', 2.6, 1.4);
    cap('線性代數證出了 Euler 公式', '');
  },
  async (tok, S) => { // @2566
    fresh(GCAM[0], GCAM[1]); S.G2 = drawG(P5, E7, { noEdgeLabel: true }); hd('另一張圖（擺法示意）', 2.4, 6.6);
    cap('再畫一張邊和迴圈更多的圖', '');
  },
  async (tok, S) => { // @2581
    S.c = pl('節點 = 5', 2.6, 5.4);
    cap('節點：5 個', '');
  },
  async (tok, S) => { // @2584
    txt(S.c, '節點 = 5，邊 = ' + E7.length);
    cap('邊：7 條', '');
  },
  async (tok, S) => { // @2590
    ok(LOOPS7 === 3, 2.6, 4.6, '獨立迴圈 = m − r = 7 − ' + rk(INC7) + ' = ' + LOOPS7 + ' ✓');
    cap('迴圈：3 個', '');
  },
  async (tok, S) => { // @2595
    ok(5 - E7.length + LOOPS7 === 1, 2.6, 3.8, '5 − 7 + 3 = 1 ✓');
    cap('Euler 是對的，永遠得到 1', '');
  },
], { cam: GCAM });

const LAP = mm(AT, INC);
scene('vsB-l12-atca', 'L12：e = Ax、y = Ce、Aᵀy = f → AᵀCAx = f', [
  async (tok, S) => { // @2616
    hd('把整個循環接起來', 0, 7.2);
    const box = (t, x, y, c) => { cube('', c, [2.4, 0.9, 0.3], x, y, 0, 1.5); return hd(t, x, y, 0.3); };
    S.box = box; S.ar = (x1, y1, x2, y2, t) => { const a = varrow('#8a7b66', 0.05); a.setW(V3(x1, y1, 0), V3(x2, y2, 0)); return hot(t, (x1 + x2) / 2, (y1 + y2) / 2 + 0.45, 0.2); };
    box('x：電位', -4.2, 5.4, COL.a);
    cap('最後把三個方程接成一圈', '');
  },
  async (tok, S) => { // @2637
    S.ar(-2.9, 5.4, 2.9, 5.4, 'e = Ax'); S.box('e：電位差', 4.2, 5.4, COL.b);
    cap('電位差 e = Ax', '');
  },
  async (tok, S) => { // @2648
    S.ar(4.2, 4.85, 4.2, 2.65, 'y = Ce'); S.box('y：電流', 4.2, 2.1, COL.c);
    cap('電流 y = Ce', 'Ohm 定律');
  },
  async (tok, S) => { // @2655
    S.ar(2.9, 2.1, -2.9, 2.1, 'Aᵀy = 0'); S.box('KCL', -4.2, 2.1, COL.d);
    cap('電流滿足 KCL：Aᵀy = 0', '沒有外加電源時的電路方程');
  },
  async (tok, S) => { // @2681
    S.q = hot('還缺：讓事情發生的外部來源', 0, 0.9);
    cap('還缺一個外部來源', '讓電流真的動起來');
  },
  async (tok, S) => { // @2706
    S.f = pl('外加電流源 f → Aᵀy = f', 0, 0.2);
    cap('加入電流源', '它出現在 KCL 的右邊：Aᵀy = f');
  },
  async (tok, S) => { // @2725
    sm('例：1 安培從一個節點送進、從另一個節點送出（示意）', 0, -0.4);
    cap('從一個節點送進 1 安培、另一個節點送出', 'KCL 右邊就不是 0 了');
  },
  async (tok, S) => { // @2745
    gone(S.q); S.chain = mono(tag('x  →(A)→  e  →(C)→  y  →(Aᵀ)→  f', '', 0, 3.8, 0.3));
    cap('三步串起來', 'x 乘 A、再乘 C、再乘 Aᵀ');
  },
  async (tok, S) => { // @2777
    S.eq = hot('Aᵀ C A x = f', 0, 3.1);
    cap('應用數學的基本方程', 'AᵀCAx = f');
  },
  async (tok, S) => { // @2798
    sm('平衡狀態：沒有時間，看電流最後怎麼分布', 0, 1.4);
    cap('這是「平衡」時的方程', '時間不在裡面，看一切穩定後的樣子');
  },
  async (tok, S) => { // @2844
    gone(S.chain); S.l = mgrid(LAP, 2.6, 6.4, 0, { color: (i, j) => (i === j ? COL.d : '#d9cbb2'), size: 0.4, gap: 0.48 }); sm('AᵀA（這張圖）', 3.3, 4.0);
    ok(isSym(LAP), 3.3, 3.4, '(AᵀA)ᵀ = AᵀA：對稱 ✓');
    cap('AᵀA 有什麼特性？', '一定是對稱矩陣');
  },
]);

// ════════ l88D4r74gtM（MIT 18.06 L13：Quiz 1 review） ════════
// 逐字稿沒錄到黑板上的數字時（完整解、B = CD），用 Strang 原考題的數字，並和老師口述推出的結果互相驗證。
const LCAM = [[0, 3.4, 13], [0, 3.2, 0]];
const vstack = (A, B) => [...A.map((r) => r.slice()), ...B.map((r) => r.slice())];
const hstack = (A, B) => A.map((r, i) => [...r, ...B[i]]);
const U53 = [[1, 2, 3], [0, 4, 5], [0, 0, 6], [0, 0, 0], [0, 0, 0]];
const Z53 = zeros(5, 3);
const B103 = vstack(U53, msc(U53, 2)), C106 = vstack(hstack(U53, U53), hstack(U53, Z53));
const RU = rk(U53), RB = rk(B103), RC = rk(C106), NCT = nullBasis(rrefSteps(T(C106)).R, rrefSteps(T(C106)).piv, 10).length;
// 區塊消去：每一步真的對 10 × 6 矩陣做列運算，再和區塊形式比對
const blk = (a, b, c, d) => vstack(hstack(a, b), hstack(c, d));
const C1 = vstack(C106.slice(0, 5), C106.slice(5).map((r, i) => r.map((x, j) => x - C106[i][j])));
const C2 = vstack(C1.slice(0, 5).map((r, i) => r.map((x, j) => x + C1[5 + i][j])), C1.slice(5));
const C3 = vstack(C2.slice(0, 5), msc(C2.slice(5), -1));
const BLK_OK = eqM(C1, blk(U53, U53, Z53, msc(U53, -1))) && eqM(C2, blk(U53, Z53, Z53, msc(U53, -1))) && eqM(C3, blk(U53, Z53, Z53, U53)) && rk(C3) === RC;
const bcol = (t) => (t === '0' ? '#e7dcc8' : t.includes('−') ? COL.r : t.includes('2') ? COL.c : COL.a);
function blocks(cells, x0 = -5.2, y0 = 5.4, w = 1.3, h = 1.5) {
  const bk = cells.map((row, i) => row.map((t, j) => cube(t, bcol(t), [w - 0.1, h - 0.1, 0.3], x0 + j * w, y0 - i * h, 0)));
  return { bk, set: (c2) => c2.forEach((row, i) => row.forEach((t, j) => { relabel(bk[i][j], t); tint(bk[i][j], bcol(t)); })) };
}
scene('vsB-l13-span', 'L13：R⁷ 裡 u、v、w 張成的維度', [
  async (tok, S) => { // @84
    hd('u、v、w 是 R⁷ 裡的非零向量', 0, 7.2);
    cap('第一題：u、v、w 是 R⁷ 裡的非零向量', '');
  },
  async (tok, S) => { // @100
    hot('它們張成的子空間，維度可能是多少？', 0, 6.5);
    cap('它們張成 R⁷ 的一個子空間', '可能的維度有哪些？');
  },
  async (tok, S) => { // @118
    const cases = [[[1, 0.5, 0.3], [2, 1, 0.6], [-1, -0.5, -0.3]], [[1, 0, 0.3], [0, 1, 0.3], [1, 1, 0.6]], [[1, 0, 0], [0, 1, 0], [0.3, 0.3, 1]]];
    S.r = cases.map((vs, k) => {
      const Sp = space3(-4.4 + k * 4.4, 2.6, 0, 0.62, 1.7);
      vs.forEach((v, i) => Sp.arrow(v, [COL.a, COL.b, COL.c][i]));
      const r = rk(vs);
      if (r === 1) Sp.line(vs[0], COL.g, 2.4, [0, 0, 0], 0.035);
      if (r === 2) Sp.plane(vs[0], vs[1], COL.g, 0.22);
      if (r === 3) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshBasicMaterial({ color: COL.g, transparent: true, opacity: 0.1, depthWrite: false })); b.position.copy(Sp.w([0, 0, 0])); lab.world.add(b); }
      sm('dim = ' + r + '（示意）', -4.4 + k * 4.4, 0.2); return r;
    });
    ok(S.r.join() === '1,2,3', 0, -0.6, '1、2 或 3 ✓（三個例子的 rank 由程式算）');
    cap('答案：1、2 或 3', '圖只畫前三個座標（示意）');
  },
  async (tok, S) => { // @124
    sm('不會超過 3：只有 3 個向量', -2.2, 5.6);
    cap('不會超過 3', '因為只有 3 個向量');
  },
  async (tok, S) => { // @129
    sm('不會是 0：向量都不是零向量', 2.4, 5.6);
    cap('也不會是 0', '題目說了它們都不是零向量');
  },
], { cam: LCAM });

scene('vsB-l13-u', 'L13：5×3 的 U（rank 3）、[U; 2U]、[U U; U 0]', [
  async (tok, S) => { // @157
    hd('U：5 × 3、echelon form、3 個 pivot', 0, 7.2);
    S.u = mgrid(U53, -6.2, 5.8, 0, { color: (i, j) => (i === j && i < 3 ? COL.g : U53[i][j] ? COL.a : '#e7dcc8'), size: 0.5, gap: 0.6 }); sm('U（數字示意）', -5.6, 2.6);
    ok(RU === 3, -5.6, 2.0, 'rank = ' + RU + ' ✓');
    cap('5 × 3 的矩陣 U，echelon form，r = 3', '形狀：3 欄、5 列');
  },
  async (tok, S) => { // @180
    S.q = hot('N(U) = ？', 0, 5.6);
    cap('U 的 null space 是什麼？', '要用題目給的資訊回答，不是背定義');
  },
  async (tok, S) => { // @222
    ok(nullBasis(rrefSteps(U53).R, rrefSteps(U53).piv, 3).length === 0, 0, 4.9, 'rank 3 = 欄數 → 3 欄獨立 → N(U) = {(0, 0, 0)} ✓');
    cap('只有零向量', 'rank 3，3 個欄都獨立');
  },
  async (tok, S) => { // @258
    fresh(LCAM[0], LCAM[1]); hd('B = [U; 2U]：10 × 3', -3.6, 7.2);
    S.B = blocks([['U'], ['2U']], -4.4, 5.2);
    cap('B 是 10 × 3：上面 U、下面 2U', '它的 echelon form 和 rank？');
  },
  async (tok, S) => { // @304
    S.B.set([['U'], ['0']]);
    const RB_ = rrefSteps(B103).R;
    ok(eqM(RB_.slice(0, 5), rrefSteps(U53).R) && isZero(RB_.slice(5).flat()), -4.4, 2.6, '下半 − 2 × 上半 → [U; 0] ✓');
    cap('下面的列減掉 2 倍上面的列', '得到 [U; 0]（把 U 當成已是 reduced form）');
  },
  async (tok, S) => { // @364
    hd('C = [U U; U 0]：10 × 6', 2.6, 7.2);
    S.C = blocks([['U', 'U'], ['U', '0']], 1.6, 5.2);
    cap('再看 C = [U U; U 0]', '它的 echelon form？');
  },
  async (tok, S) => { // @391
    S.C.set([['U', 'U'], ['0', '−U']]);
    cap('下面減上面', '[U U; 0 −U]');
  },
  async (tok, S) => { // @433
    S.C.set([['U', '0'], ['0', '−U']]);
    cap('再用下面去清上面', '[U 0; 0 −U]');
  },
  async (tok, S) => { // @449
    S.C.set([['U', '0'], ['0', 'U']]);
    ok(BLK_OK, 2.9, 2.6, '三步列運算在 10 × 6 矩陣上逐格驗證 ✓');
    cap('下面乘 −1，pivot 變正', '[U 0; 0 U]');
  },
  async (tok, S) => { // @493
    sm('最後一點：中間的零列要移到最底下', 2.9, 2.0);
    cap('嚴格的 reduced form 還要一步', '把零列移到最下面');
  },
  async (tok, S) => { // @507
    ok(RC === 6, 2.9, 1.3, 'rank C = ' + RC + ' ✓');
    cap('C 的 rank？6', '');
  },
  async (tok, S) => { // @529
    ok(RB === 3, -3.6, 1.3, 'rank B = ' + RB + ' ✓（不是 6）');
    cap('那 B 的 rank？3', '消去後只看得到 3 個 pivot');
  },
  async (tok, S) => { // @546
    S.n = hot('dim N(Cᵀ) = ？', 0, 0.5);
    cap('最後：Cᵀ 的 null space 維度', '先看 C 的大小');
  },
  async (tok, S) => { // @570
    txt(S.n, 'C 是 10 × 6：m = 10');
    cap('C 是 10 × 6', 'Cᵀ 有 10 欄');
  },
  async (tok, S) => { // @604
    ok(NCT === 4, 0, -0.2, 'dim N(Cᵀ) = m − r = 10 − 6 = ' + NCT + ' ✓');
    cap('10 − 6 = 4', '');
  },
], { cam: LCAM });

const XP3 = [2, 0, 0], N31 = [1, 1, 0], N32 = [0, 0, 1], B3 = [2, 4, 2];
const c1 = scl(B3, 1 / 2), c3 = [0, 0, 0], c2 = scl(c1, -1);   // 依老師的推理：A·x_p = 2·第一欄；(0,0,1) ∈ N → 第三欄 0；(1,1,0) ∈ N → 第二欄 = −第一欄
const A3 = [0, 1, 2].map((i) => [c1[i], c2[i], c3[i]]);
const A3_OK = eqV(mulMV(A3, XP3), B3) && isZero(mulMV(A3, N31)) && isZero(mulMV(A3, N32)) && rk(A3) === 1;
scene('vsB-l13-back', 'L13：從完整解反推矩陣 A', [
  async (tok, S) => { // @644
    hd('Ax = (2, 4, 2) 的完整解：x = (2, 0, 0) + c(1, 1, 0) + d(0, 0, 1)', 0, 7.2);
    sm('（逐字稿沒錄到數字；取自 Strang 原考題，和下面推出的 A 一致）', 0, 6.6);
    cap('題目給完整解，不給矩陣', '');
  },
  async (tok, S) => { // @672
    S.q = hot('A 的 row space 維度？', 0, 5.9);
    cap('A 的 row space 維度是多少？', '也就是 rank');
  },
  async (tok, S) => { // @723
    S.g = mgrid([['?', '?', '?'], ['?', '?', '?'], ['?', '?', '?']], -6.0, 5.0, 0, { color: () => '#e7dcc8' });
    sm('b 有 3 個分量 → 3 列；x 有 3 個分量 → 3 欄', -2.0, 4.4);
    cap('先看形狀', 'b 和 x 都有 3 個分量 → 3 × 3');
  },
  async (tok, S) => { // @773
    ok(rk([N31, N32]) === 2, -2.0, 3.7, '(1,1,0)、(0,0,1) 獨立 → dim N(A) = 2 → r = 3 − 2 = 1 ✓');
    cap('rank 是 1', '完整解裡有兩個獨立的 null space 向量');
  },
  async (tok, S) => { // @819
    sm('C(A)：1　N(A)：2　C(Aᵀ)：1　N(Aᵀ)：2', -2.0, 3.0);
    cap('四個子空間的維度全知道了', '');
  },
  async (tok, S) => { // @824
    txt(S.q, '那 A 本身是什麼？');
    cap('進一步：把 A 找出來', '');
  },
  async (tok, S) => { // @863
    c1.forEach((v, i) => { S.g.set(i, 0, v); tint(S.g.c[i][0], COL.a); });
    sm('A(2,0,0) = 2 × 第一欄 = (2,4,2) → 第一欄 (1,2,1)', 0.8, 2.3);
    cap('A 乘 (2, 0, 0) 只用到第一欄', '2 × 第一欄 = (2, 4, 2) → 第一欄 = (1, 2, 1)');
  },
  async (tok, S) => { // @905
    c3.forEach((v, i) => { S.g.set(i, 2, v); tint(S.g.c[i][2], '#e7dcc8'); });
    sm('(0,0,1) ∈ N(A) → 第三欄 = 0', 0.8, 1.7);
    cap('(0, 0, 1) 在 null space', '→ 第三欄是 0');
  },
  async (tok, S) => { // @929
    c2.forEach((v, i) => { S.g.set(i, 1, v); tint(S.g.c[i][1], COL.b); });
    sm('(1,1,0) ∈ N(A) → 第一欄 + 第二欄 = 0', 0.8, 1.1);
    ok(A3_OK, -4.2, 1.6, 'A x_p = b ✓　A·(1,1,0) = 0 ✓　A·(0,0,1) = 0 ✓');
    cap('(1, 1, 0) 在 null space', '→ 第二欄 = (−1, −2, −1)');
  },
  async (tok, S) => { // @951
    fresh(LCAM[0], LCAM[1]); hd('哪些 b 能讓 Ax = b 有解？', 0, 7.2);
    S.g = mgrid(A3, -6.0, 5.6, 0, { color: (i, j) => [COL.a, COL.b, '#e7dcc8'][j] });
    cap('接著問：對哪些 b，Ax = b 有解？', '每個 b 都可以嗎？不行');
  },
  async (tok, S) => { // @994
    hot('有解 ⇔ b 在 column space 裡', 0.6, 5.6);
    cap('有解，正好是 b 在 column space 的時候', '題目還要你說出 column space 是什麼');
  },
  async (tok, S) => { // @1024
    const Q = subspaces(A3);
    ok(Q.col.length === 1 && eqV(Q.col[0], [1, 2, 1]), 0.6, 4.8, 'C(A) = (1, 2, 1) 的所有倍數 ✓');
    const Sp = space3(2.2, 1.6, 0, 0.6, 1.8, ['b₁', 'b₂', 'b₃']); Sp.line([1, 2, 1], COL.d, 2.6, [0, 0, 0], 0.04); S.Sp = Sp;
    cap('C(A)：(1, 2, 1) 的倍數', '一條過原點的線');
  },
  async (tok, S) => { // @1038
    S.Sp.arrow(scl(B3, 0.5), COL.r, 'b = (2,4,2)（縮半畫）');
    ok(eqV(B3, scl([1, 2, 1], 2)), -4.2, 2.6, '(2, 4, 2) = 2·(1, 2, 1) → 在 C(A) 上 → 有解 ✓');
    cap('原題的 b = (2, 4, 2) 是 (1, 2, 1) 的倍數', '所以才有解');
  },
  async (tok, S) => { // @1052
    note('別忘了另一個極端：full rank（r = m 或 r = n）', -3.6, 1.2);
    cap('這題 null space 很大', '別忘了另一個極端：full rank 的情況');
  },
], { cam: LCAM });

const PINV = [[2, 1], [1, 1]], NPINV = msc(PINV, -1);
const SING1 = [[1, 0], [0, 0]], SING2 = [[0, 0], [0, 1]], NIL = [[0, 1], [0, 0]];
scene('vsB-l13-tf1', 'L13：是非題：N(A)、可逆矩陣、B² = 0', [
  async (tok, S) => { // @1125
    hd('方陣 A：N(A) = {0}，那 N(Aᵀ) 呢？', 0, 7.2);
    cap('是非題：方陣，null space 只有零向量', 'Aᵀ 的 null space 呢？');
  },
  async (tok, S) => { // @1137
    const Q = subspaces(PINV);
    ok(Q.null.length === 0 && Q.left.length === 0, 0, 6.5, 'N(Aᵀ) 也只有 {0}：方陣 rank = n，m − r = 0 ✓（2×2 例子程式驗證）');
    cap('也是只有零向量', '方陣：r = n = m，所以 m − r = 0');
  },
  async (tok, S) => { // @1155
    S.m = cube('所有 5 × 5 矩陣：' + 25 + ' 維向量空間', VC.pale, [6.0, 0.8, 0.2], 0, 5.4, 0);
    cap('5×5 矩陣全體是一個向量空間', '25 維');
  },
  async (tok, S) => { // @1169
    S.q = hot('可逆矩陣構成子空間嗎？', 0, 4.4);
    cap('其中的可逆矩陣，構成子空間嗎？', '不是');
  },
  async (tok, S) => { // @1200
    const C = mad(PINV, NPINV);
    mgrid(PINV, -6.0, 3.4, 0, { color: () => COL.a, size: 0.5, gap: 0.6 }); pl('+', -4.6, 3.1); mgrid(NPINV, -4.1, 3.4, 0, { color: () => COL.b, size: 0.5, gap: 0.6 }); pl('=', -2.7, 3.1); mgrid(C, -2.2, 3.4, 0, { color: () => COL.r, size: 0.5, gap: 0.6 });
    ok(det2(PINV) !== 0 && det2(NPINV) !== 0 && det2(C) === 0, -3.4, 2.0, '可逆 + 可逆 = 零矩陣（不可逆）✓（2×2 示意）');
    cap('兩個可逆矩陣相加，不一定可逆', '');
  },
  async (tok, S) => { // @1209
    bad('連零矩陣都不在裡面 → 不可能是子空間', 2.8, 3.1);
    cap('它甚至不包含零矩陣', '乘 0 就跑出去了');
  },
  async (tok, S) => { // @1221
    const C = mad(SING1, SING2);
    mgrid(SING1, -6.0, 1.2, 0, { color: () => COL.a, size: 0.5, gap: 0.6 }); pl('+', -4.6, 0.9); mgrid(SING2, -4.1, 1.2, 0, { color: () => COL.b, size: 0.5, gap: 0.6 }); pl('=', -2.7, 0.9); mgrid(C, -2.2, 1.2, 0, { color: () => COL.d, size: 0.5, gap: 0.6 });
    ok(det2(SING1) === 0 && det2(SING2) === 0 && det2(C) !== 0, 2.8, 0.9, '奇異 + 奇異 = 單位矩陣（可逆）✓ → 奇異矩陣也不是子空間');
    cap('奇異（不可逆）矩陣也不行', '有零矩陣，但相加可能變可逆');
  },
  async (tok, S) => { // @1238
    fresh(LCAM[0], LCAM[1]); hd('是非：B² = 0 ⇒ B = 0？', 0, 7.2);
    cap('是非題：B² = 0，B 一定是 0 嗎？', 'B 要是方陣才能自己乘自己');
  },
  async (tok, S) => { // @1272
    hot('錯：有些矩陣平方是零矩陣', 0, 6.4);
    cap('有這種矩陣', '所以這句話是錯的');
  },
  async (tok, S) => { // @1287
    const B2 = mm(NIL, NIL);
    mgrid(NIL, -3.6, 4.8, 0, { color: (i, j) => (NIL[i][j] ? COL.r : '#e7dcc8') }); pl('×', -1.9, 4.4);
    mgrid(NIL, -1.3, 4.8, 0, { color: (i, j) => (NIL[i][j] ? COL.r : '#e7dcc8') }); pl('=', 0.4, 4.4);
    mgrid(B2, 1.0, 4.8, 0, { color: () => '#e7dcc8' });
    ok(isZero(B2.flat()) && !isZero(NIL.flat()), 0, 2.6, 'B = [0 1; 0 0] ≠ 0，但 B² = 0 ✓');
    cap('最好的例子：[0 1; 0 0]', '後面的章節還會一直遇到它');
  },
], { cam: LCAM });

scene('vsB-l13-indepq', 'L13：n × n、欄獨立：Ax = b 一定有解？（題目）', [
  async (tok, S) => { // @1327
    hd('n 個方程、n 個未知數，欄獨立', 0, 7.2);
    S.A = mgrid([[2, 1, 0], [1, 3, 1], [0, 1, 2]], -1.2, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); sm('（示意）', 1.6, 5.6);
    cap('n × n 矩陣，欄都獨立', '');
  },
  async (tok, S) => { // @1350
    hot('Ax = b 對每個 b 都有解嗎？', 0, 2.6);
    cap('問：Ax = b 是不是一定有解？', '先讓大家想一想');
  },
], { cam: LCAM });

const AI3 = [[2, 1, 0], [1, 3, 1], [0, 1, 2]];
scene('vsB-l13-indepa', 'L13：n × n、欄獨立 ⇒ 可逆 ⇒ 一定有解', [
  async (tok, S) => { // @1492
    hd('欄獨立 ⇒ rank = n', 0, 7.2);
    S.A = mgrid(AI3, -1.2, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] });
    ok(rk(AI3) === 3, 0, 2.6, 'rank = ' + rk(AI3) + ' = n ✓（示意矩陣）');
    cap('欄獨立，表示 rank 就是 n', '');
  },
  async (tok, S) => { // @1499
    ok(det3(AI3) !== 0, 0, 1.9, '方陣 + rank n → 可逆（det = ' + det3(AI3) + '）✓');
    cap('方陣而且 rank n', '就是可逆矩陣');
  },
  async (tok, S) => { // @1507
    good('答案：是，每個 b 都恰有一解', 0, 1.2);
    cap('答案是「是」', '第二章就熟悉的好情況');
  },
], { cam: LCAM });

const CC = [[1, 1, 0], [0, 1, 0], [1, 0, 1]], DD = [[1, 0, -1, 2], [0, 1, 1, -1], [0, 0, 0, 0]], BB = mm(CC, DD);
const RD = rrefSteps(DD), NBD = nullBasis(RD.R, RD.piv, 4);
const SAID_N = [[1, -1, 1, 0], [-2, 1, 0, 1]];
const NBD_OK = NBD.length === 2 && NBD.every((x, k) => eqV(x, SAID_N[k]) && isZero(mulMV(BB, x)));
const XPB = [1, 0, 0, 0];
scene('vsB-l13-cd', 'L13：B = C D：C 可逆，不改變 null space', [
  async (tok, S) => { // @1534
    hd('B = C D（不乘開，直接回答）', 0, 7.2);
    S.C = mgrid(CC, -6.4, 5.8, 0, { color: () => COL.a, size: 0.5, gap: 0.6 }); sm('C', -5.8, 6.4);
    S.D = mgrid(DD, -4.2, 5.8, 0, { color: (i, j) => (i === 2 ? '#e7dcc8' : j < 2 ? COL.g : COL.b), size: 0.5, gap: 0.6 }); sm('D', -3.3, 6.4);
    sm('（數字取自 Strang 原考題，逐字稿沒錄到）', -3.6, 3.7);
    cap('3 × 4 的矩陣 B = C × D', '不把乘法算開，直接回答問題');
  },
  async (tok, S) => { // @1601
    S.q = hot('N(B) 的基底？', 2.4, 6.2);
    cap('問題：N(B) 的一組基底', '');
  },
  async (tok, S) => { // @1648
    sm('B 是 3 × 4 → x 在 R⁴ 裡', 2.4, 5.6);
    cap('B 是 3 × 4', '所以 null space 在 R⁴ 裡');
  },
  async (tok, S) => { // @1682
    S.C.c.flat().forEach((m) => glow(m, GOLD));
    cap('先看前面那個方陣 C：可逆嗎？', '');
  },
  async (tok, S) => { // @1714
    S.C.clearGlow(); S.C.col(2, GOLD);
    sm('第 3 欄 (0,0,1)：其他欄在那個位置都是 0 → 它一定要用到', 2.4, 4.9);
    cap('看第 3 欄：在一個別人都是 0 的位置有 1', '組合成 0 不能用到它');
  },
  async (tok, S) => { // @1737
    S.C.clearGlow(); ok(det3(CC) !== 0, 2.4, 4.2, 'C 的欄獨立，det C = ' + det3(CC) + ' → 可逆 ✓');
    cap('C 是可逆的方陣', '');
  },
  async (tok, S) => { // @1776
    pl('Bx = 0 ⇒ C(Dx) = 0 ⇒ Dx = 0（乘 C⁻¹）', 2.4, 3.5);
    cap('N(B) 和 N(D) 一樣嗎？', '一樣：C 可逆，Cy = 0 只有 y = 0');
  },
  async (tok, S) => { // @1842
    ok(eqM(rrefSteps(BB).R, RD.R), 2.4, 2.8, '前面乘可逆的 C，不改變 null space ✓（B 和 D 的 RREF 相同）');
    cap('可逆的 C 不會改變 null space', '只要找 D 的 null space');
  },
  async (tok, S) => { // @1868
    S.D.clearGlow(); RD.piv.forEach((j) => S.D.col(j, GREEN));
    ok(RD.rank === 2, 2.4, 2.1, '2 個 pivot 欄 → rank 2 ✓');
    cap('D 有兩個 pivot 欄', 'rank 2，要找兩個 special solutions');
  },
  async (tok, S) => { // @1877
    S.b1 = bars(NBD[0], -6.2, 0.9, 0, COL.b, { k: 0.45, gap: 0.45 }); sm('s₁ = ' + vstr(NBD[0]), -5.6, -0.4);
    cap('第一個：第 3 個變數 = 1', '再補上 pivot 變數讓 Dx = 0');
  },
  async (tok, S) => { // @1897
    S.b2 = bars(NBD[1], -3.2, 0.9, 0, COL.c, { k: 0.45, gap: 0.45 }); sm('s₂ = ' + vstr(NBD[1]), -2.6, -0.4);
    ok(NBD_OK, -4.0, -1.0, 'B s₁ = 0 ✓　B s₂ = 0 ✓（和老師的答案一致）');
    cap('第二個：第 4 個變數 = 1', '代回去乘，確實得到 0');
  },
  async (tok, S) => { // @1909
    const F = DD.slice(0, 2).map((r) => r.slice(2));
    ok(eqV([-F[0][0], -F[1][0]], NBD[0].slice(0, 2)) && eqV([-F[0][1], -F[1][1]], NBD[1].slice(0, 2)), 2.4, 1.3, '自由部分 F = [−1 2; 1 −1]：null space 裡看到 −F 和 I ✓');
    cap('對照 D 的自由變數部分 F', 'null space 矩陣 = [−F; I]');
  },
  async (tok, S) => { // @1936
    S.q2 = hot('解 Bx = (1, 0, 1) 的完整解', 2.4, 0.5);
    cap('下一題：解 Bx = (1, 0, 1)', '');
  },
  async (tok, S) => { // @1979
    ok(eqV(col(BB, 0), [1, 0, 1]), 2.4, -0.2, 'B 的第一欄 = C·(1,0,0) = (1, 0, 1) = 右邊 ✓ → x_p = (1, 0, 0, 0)');
    cap('B 的第一欄剛好就是右邊', '特解取 (1, 0, 0, 0)');
  },
  async (tok, S) => { // @2002
    S.full = pl('x = (1, 0, 0, 0) + c·s₁ + d·s₂', 2.4, -0.9);
    cap('完整解 = 特解 + null space', 'x = x_p + c s₁ + d s₂');
  },
  async (tok, S) => { // @2018
    sm('null space 那部分有任意常數 c、d；特解沒有', 2.4, -1.5);
    cap('null space 部分帶著任意常數', '特解是固定的一個');
  },
], { cam: LCAM });

const XALT = addv(XPB, NBD[0]);
scene('vsB-l13-xp', 'L13：特解只要「一個」，選最方便的', [
  async (tok, S) => { // @2045
    hd('學生問：x_particular 是怎麼來的？', 0, 7.2);
    S.B = mgrid(BB, -6.2, 5.6, 0, { color: (i, j) => (j === 0 ? COL.a : '#d9cbb2'), size: 0.5, gap: 0.6 }); sm('B = C D', -5.3, 6.2);
    cap('學生問：這個特解是怎麼找的？', '');
  },
  async (tok, S) => { // @2061
    S.B.col(0, GOLD);
    ok(eqV(mulMV(BB, XPB), [1, 0, 1]), 0.6, 5.0, 'B·(1,0,0,0) = B 的第一欄 = (1, 0, 1) ✓');
    cap('乘 (1, 0, 0, 0) 就是取出第一欄', '它剛好等於右邊 (1, 0, 1)');
  },
  async (tok, S) => { // @2115
    S.B.clearGlow(); hot('特解只有一個嗎？不，完全不是', 0.6, 4.2);
    cap('特解只有一個嗎？', '不是：任何一個解都能當特解');
  },
  async (tok, S) => { // @2138
    ok(eqV(mulMV(BB, XALT), [1, 0, 1]), 0.6, 3.4, 'x_p + s₁ = ' + vstr(XALT) + ' 也是解 ✓');
    cap('例如特解加上 s₁', '也是一個解');
  },
  async (tok, S) => { // @2149
    sm('「特解」只是說「取一個」，沒規定哪一個 → 取最方便的', 0.6, 2.7);
    cap('particular 只是說取一個', '挑最方便的那個就好');
  },
  async (tok, S) => { // @2167
    note('特解 + null space：所有線性系統都有的結構', 0.6, 1.8);
    cap('「特解 + null space」這個結構', '遍及所有線性系統，不只有限矩陣');
  },
], { cam: LCAM });

const Q01 = subspaces(NIL);
const SW = [[1, 2], [3, 4], [5, 6]], SWP = [SW[1], SW[0], SW[2]];
const QSW = subspaces(SW), QSWP = subspaces(SWP);
const sameSpan = (a, b) => rk(a) === rk(b) && rk([...a, ...b]) === rk(a);
const I2 = [[1, 0], [0, 1]], D2 = [[1, 0], [0, 2]];
scene('vsB-l13-tf2', 'L13：是非題：row space 與 column space、四個子空間', [
  async (tok, S) => { // @2222
    hd('m = n ⇒ row space = column space？', 0, 7.2);
    cap('是非：方陣的 row space = column space？', '');
  },
  async (tok, S) => { // @2237
    bad('錯', 3.2, 7.2);
    cap('錯', '');
  },
  async (tok, S) => { // @2251
    mgrid(NIL, -6.0, 5.8, 0, { color: (i, j) => (NIL[i][j] ? COL.r : '#e7dcc8') });
    ok(eqV(Q01.row[0], [0, 1]) && eqV(Q01.col[0], [1, 0]), -2.0, 5.8, 'row space：(0, 1) 的倍數；column space：(1, 0) 的倍數 ✓ → 不同');
    cap('例：[0 1; 0 0]', 'row space 是 (0,1) 的倍數，column space 是 (1,0) 的倍數');
  },
  async (tok, S) => { // @2273
    sm('如果 A 對稱，row space = column space 才對', -2.0, 5.1);
    cap('如果矩陣對稱', '兩者才相同');
  },
  async (tok, S) => { // @2284
    S.q = pl('A 和 −A 的四個子空間一樣？　對', 0, 4.2);
    cap('A 和 −A 有相同的四個子空間嗎？', '有：乘 −1 不改變任何子空間');
  },
  async (tok, S) => { // @2308
    S.q2 = hot('四個子空間都相同 ⇒ A 是 B 的倍數？', 0, 3.4);
    cap('四個子空間都相同，A 一定是 B 的倍數嗎？', '先試著找反例');
  },
  async (tok, S) => { // @2412
    sm('極端情況：取 6 × 6 可逆矩陣', 0, 2.8);
    cap('取極端情況：可逆矩陣', '');
  },
  async (tok, S) => { // @2456
    sm('row、column space = 整個 R⁶；兩個 null space = {0}', 0, 2.3);
    cap('row space、column space 都是整個 R⁶', 'null space 都只有零向量');
  },
  async (tok, S) => { // @2473
    mgrid(I2, -6.0, 1.6, 0, { color: (i, j) => (i === j ? COL.a : '#e7dcc8'), size: 0.5, gap: 0.6 }); mgrid(D2, -4.4, 1.6, 0, { color: (i, j) => (i === j ? COL.b : '#e7dcc8'), size: 0.5, gap: 0.6 });
    ok(rk(I2) === 2 && rk(D2) === 2 && !eqM(D2, msc(I2, D2[0][0])), -1.0, 1.3, 'I 和 diag(1, 2)：子空間全同，但不是倍數 ✓ → 錯（2×2 示意）');
    cap('任兩個可逆矩陣都有相同子空間', '但不必互為倍數 → 錯');
  },
  async (tok, S) => { // @2557
    sm('不過它們一定有相同的 rank', -1.0, 0.6);
    cap('能說的是：它們有相同的 rank', '');
  },
  async (tok, S) => { // @2604
    fresh(LCAM[0], LCAM[1]); hd('交換 A 的兩列，哪些子空間不變？', 0, 7.2);
    mgrid(SW, -6.0, 5.6, 0, { color: (i) => [COL.a, COL.b, '#d9cbb2'][i], size: 0.5, gap: 0.6 }); sm('A（示意）', -5.6, 3.8);
    mgrid(SWP, -3.6, 5.6, 0, { color: (i) => [COL.b, COL.a, '#d9cbb2'][i], size: 0.5, gap: 0.6 }); sm('交換第 1、2 列', -3.2, 3.8);
    cap('交換兩列之後', '哪些子空間保持不變？');
  },
  async (tok, S) => { // @2628
    ok(sameSpan(QSW.row, QSWP.row) && QSW.null.length === QSWP.null.length && QSW.null.length === 0, 2.2, 5.0, 'row space 相同 ✓　null space 相同 ✓');
    cap('row space 和 null space 不變', '');
  },
  async (tok, S) => { // @2636
    ok(!eqV(col(SW, 0), col(SWP, 0)), 2.2, 4.2, '欄向量的分量順序換了 → column space 一般會變 ✓');
    cap('column space 是錯的答案', '欄裡的分量被交換了');
  },
], { cam: LCAM });

const V123 = [1, 2, 3];
scene('vsB-l13-perp', 'L13：(1, 2, 3) 不能同時在 row space 和 null space', [
  async (tok, S) => { // @2645
    hd('(1, 2, 3) 能不能既是 A 的一列、又在 N(A) 裡？', 0, 7.2);
    cap('下一章的題目', '(1, 2, 3) 能同時是一列、又在 null space 裡嗎？');
  },
  async (tok, S) => { // @2717
    sm('row space 和 null space 都在 Rⁿ 裡（這裡 n = 3）', 0, 6.5);
    cap('這兩個子空間在同一個空間 Rⁿ', '它們會怎麼重疊？');
  },
  async (tok, S) => { // @2768
    S.g = mgrid([V123, ['…', '…', '…']], -5.6, 5.4, 0, { color: (i) => (i ? '#e7dcc8' : COL.a) }); sm('A 的第一列', -4.8, 6.0);
    pl('x 在 N(A) 裡 ⇒ 每一列 · x = 0', 0.6, 5.4);
    cap('如果 x 在 null space', 'A 的每一列乘 x 都要是 0');
  },
  async (tok, S) => { // @2781
    pl('第一列 = (1,2,3)，x = (1,2,3)：1·1 + 2·2 + 3·3', 0.6, 4.6);
    cap('第一列是 (1, 2, 3)，x 也是 (1, 2, 3)', '');
  },
  async (tok, S) => { // @2792
    const d = dot(V123, V123);
    ok(d === 14, 0.6, 3.8, '= ' + d + ' ≠ 0 ✓ → 不可能');
    cap('算出來是 14，不是 0', '所以不可能');
  },
  async (tok, S) => { // @2808
    const Sp = space3(-3.0, 1.6, 0, 0.7, 2.0); S.Sp = Sp;
    Sp.plane([1, 0, 0], [0, 1, 0], COL.a, 0.22); Sp.line([0, 0, 1], COL.r, 2.2, [0, 0, 0], 0.045);
    sm('row space（藍）∩ null space（紅）= {0}（示意）', 2.6, 2.4);
    cap('更完整的圖像', 'row space 和 null space 只共用零向量');
  },
  async (tok, S) => { // @2830
    ok(dot([1, 0, 0], [0, 0, 1]) === 0 && dot([0, 1, 0], [0, 0, 1]) === 0, 2.6, 1.6, '而且互相垂直：null space ⊥ row space');
    cap('其實 null space 和 row space 互相垂直', '這是下一個主題');
  },
], { cam: LCAM });

// ════════ eeMJg4uI7o0（MIT 18.06：Independence, basis, and dimension） ════════
const RA1 = [2, 1, 5], RA2 = [4, 2, 0], RA3b = addv(RA1, RA2), RA3 = [1, 0, 0];
const RMAT = [0, 1, 2].map((i) => [RA1[i], RA2[i], RA3[i]]);
const RV = { look: [0, 2.6, 0] };
const box3 = (Sp, c = COL.g, w = 4.6) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, w, w), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.08, depthWrite: false })); b.position.copy(Sp.w([0, 0, 0])); lab.world.add(b); return b; };
scene('vsB-rec-indep', 'Recitation：a₁、a₂ 獨立，張成一個平面', [
  async (tok, S) => { // @0
    cam(28, 18, 12.5, RV.look);
    S.h = hd('向量空間 → 維度與基底', -3.2, 7.4);
    cap('有了向量空間，就要談它的維度', '最重要的是：基底（basis）');
  },
  async (tok, S) => { // @17
    S.Sp = space3(0, 2.4, 0, 0.5, 2.9);
    S.d = sm('R³：我們住的空間，dimension = 3', -3.2, 6.8);
    cap('空間可以是整個 3 維空間', '維度 3；那「基底」是什麼意思？');
  },
  async (tok, S) => { // @32
    S.k = pl('獨立 → 基底 → 維度', -3.2, 6.2);
    cap('要解釋三件事：獨立、基底、維度', '前兩個懂了，維度就簡單');
  },
  async (tok, S) => { // @51
    S.a1 = S.Sp.arrow(RA1, COL.a, 'a₁ = (2, 1, 5)');
    cap('畫出 a₁ = (2, 1, 5)', '');
  },
  async (tok, S) => { // @61
    S.l1 = S.Sp.line(RA1, COL.gray, 3.2, [0, 0, 0], 0.025);
    cap('a₂ 在同一條線上嗎？', '如果在，兩個向量就相依');
  },
  async (tok, S) => { // @74
    S.a2 = S.Sp.arrow(RA2, COL.b, 'a₂ = (4, 2, 0)');
    cap('a₂ = (4, 2, 0) 不在那條線上', '第三個分量是 0：它一點也不往上');
  },
  async (tok, S) => { // @87
    ok(rk([RA1, RA2]) === 2, -3.2, 5.5, 'a₁、a₂ 不是彼此的倍數 → 獨立 ✓（rank 2）');
    cap('所以 a₁、a₂ 是獨立的', '');
  },
  async (tok, S) => { // @97
    S.l1.visible = false; S.pl = S.Sp.plane(RA1, RA2, COL.g, 0.22);
    cap('它們的所有組合', '構成 3 維空間裡一個平坦的平面');
  },
  async (tok, S) => { // @108
    S.sp = hot('a₁、a₂ 張成（span）這個平面', -3.2, 4.8);
    cap('a₁ 和 a₂ 張成（span）這個平面', '平面 = 它們的所有組合');
  },
  async (tok, S) => { // @138
    txt(S.sp, 'a₁、a₂ 是這個平面的基底（basis）');
    cap('a₁、a₂ 是這個平面的基底', '組合填滿平面，而且彼此獨立');
  },
  async (tok, S) => { // @151
    S.pl.fade(0.06); S.l1.visible = true; S.a2.visible = false; showL(S.a2.lbl, false);
    note('丟掉一個 → 只剩一條線：兩個都需要', -3.2, 4.1);
    await wt(tok, 1400); S.pl.fade(0.22); S.l1.visible = false; S.a2.visible = true; showL(S.a2.lbl, true);
    cap('兩個都需要', '丟掉一個，就只能張成一條線');
  },
], { cam: [[0, 3, 12], [0, 2.6, 0]] });

scene('vsB-rec-third', 'Recitation：第三個向量：(6, 3, 5) 相依、(1, 0, 0) 獨立', [
  async (tok, S) => { // @160
    cam(28, 18, 12.5, RV.look);
    S.Sp = space3(0, 2.4, 0, 0.5, 2.9); S.Sp.arrow(RA1, COL.a, 'a₁'); S.Sp.arrow(RA2, COL.b, 'a₂'); S.pl = S.Sp.plane(RA1, RA2, COL.g, 0.2);
    hd('在 3 維空間加第三個向量', -3.2, 7.4);
    cap('再加第三個向量', '要選什麼？');
  },
  async (tok, S) => { // @168
    const g = S.Sp.arrow([0, 0, 0], COL.b); await anim(tok, 1200, (u) => S.Sp.set(g, scl(RA2, u), RA1));
    S.a3 = S.Sp.arrow(RA3b, COL.r, 'a₃ = (6, 3, 5)');
    ok(eqV(RA3b, [6, 3, 5]), -3.2, 6.6, 'a₁ + a₂ = (6, 3, 5) ✓');
    cap('取 a₃ = a₁ + a₂ = (6, 3, 5)', '');
  },
  async (tok, S) => { // @180
    ok(rk([RA1, RA2, RA3b]) === 2, -3.2, 6.0, '三個的 rank 還是 2 → a₃ 在同一個平面上 ✓');
    cap('它在同一個平面上', '');
  },
  async (tok, S) => { // @189
    S.a3.glow(RED); S.t = bad('相依：仍然張成這個平面，但不是基底', -3.2, 5.3);
    cap('三個向量相依', '組合還是那個平面，但不是基底');
  },
  async (tok, S) => { // @210
    sm('一個平面用不到 3 個向量：基底要「每個都需要」', -3.2, 4.7);
    cap('對一個平面來說太多了', '基底的向量必須獨立，每個都需要');
  },
  async (tok, S) => { // @243
    S.a3.visible = false; showL(S.a3.lbl, false); gone(S.t);
    S.a3n = S.Sp.arrow(RA3, COL.c, 'a₃ = (1, 0, 0)');
    cap('換一個新方向：a₃ = (1, 0, 0)', '');
  },
  async (tok, S) => { // @258
    ok(rk([RA1, RA2, RA3]) === 3, -3.2, 4.0, '(1, 0, 0) 不是 a₁、a₂ 的組合：rank 3 ✓');
    cap('(1, 0, 0) 不是 a₁、a₂ 的組合', '它離開了那個平面');
  },
  async (tok, S) => { // @278
    S.bx = box3(S.Sp, COL.g, 5.6);
    cap('三個的所有組合', '填滿整個 3 維空間');
  },
  async (tok, S) => { // @302
    hot('a₁、a₂、a₃：整個 R³ 的基底', -3.2, 3.3);
    cap('它們是整個 R³ 的基底', '獨立，而且張成全部');
  },
], { cam: [[0, 3, 12], [0, 2.6, 0]] });

scene('vsB-rec-def', 'Recitation：獨立的欄 ⇔ N(A) = {0}；R³ 的子空間', [
  async (tok, S) => { // @334
    hd('獨立（independent）的定義', 0, 7.2);
    cap('把「獨立」寫成定義', '');
  },
  async (tok, S) => { // @352
    pl('A 的欄獨立 ⇔ Av = 0 的唯一解是 v = 0', 0, 6.5);
    cap('A 的欄獨立', 'Av = 0 只有 v = 0 這個解');
  },
  async (tok, S) => { // @371
    sm('欄獨立 → null space 只有零向量', 0, 5.9);
    cap('欄獨立，就沒有（非零的）null space', '');
  },
  async (tok, S) => { // @386
    S.g = mgrid(RMAT, -6.0, 5.0, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); ['a₁', 'a₂', 'a₃'].forEach((n, j) => sm(n, S.g.xs[j], 5.6));
    cap('例：A = [a₁ a₂ a₃]', '欄是剛剛的 (2,1,5)、(4,2,0)、(1,0,0)');
  },
  async (tok, S) => { // @401
    const Q = subspaces(RMAT);
    ok(Q.rank === 3 && Q.null.length === 0, -2.0, 4.2, 'rank 3 → C(A) = 整個 R³ ✓　N(A) = {0} ✓');
    cap('欄獨立：column space 是整個 R³', 'null space 只有零向量');
  },
  async (tok, S) => { // @419
    hot('基底 = 一組獨立、而且張成整個空間的向量', 0, 2.8);
    cap('基底的定義', '獨立的向量，而且張成那個（子）空間');
  },
  async (tok, S) => { // @464
    fresh(CAM[0], CAM[1]); cam(24, 16, 13, [0, 2.8, 0]);
    hd('R³ 的子空間有哪些？', -2.6, 7.4);
    S.Sp = space3(0, 2.6, 0, 0.8, 2.6); S.bx = box3(S.Sp, COL.g, 4.2);
    sm('最大：整個 R³ 也算子空間', -3.4, 6.7);
    cap('整個空間也算自己的子空間', '最大的那一個');
  },
  async (tok, S) => { // @481
    S.bx.visible = false; S.o = S.Sp.ball([0, 0, 0], COL.r, 0.16);
    sm('最小：只有零向量 {0}', -3.4, 6.1);
    cap('只有零向量也算子空間', '最小的那一個，只有一個點');
  },
  async (tok, S) => { // @498
    S.Sp.line([1, 0.6, 0.8], COL.b, 2.4, [0, 0, 0], 0.035); S.Sp.plane([1, 0, 0.2], [0, 1, -0.3], COL.a, 0.18);
    sm('中間：所有過原點的直線、所有過原點的平面', -3.4, 5.5);
    cap('還有所有過原點的直線（小）', '以及所有過原點的平面（大一點）');
  },
  async (tok, S) => { // @510
    hot('維度：{0} → 0、直線 → 1、平面 → 2、R³ → 3', -3.4, 4.8);
    cap('它們的維度：0、1、2、3', '維度 = 需要幾個基底向量');
  },
]);

const BAS2 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], FOUR = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]];
const PU = [1, 0, 0.4], PV = [0, 1, 0.2], PW = addv(scl(PU, 0.5), scl(PV, -0.8));
scene('vsB-rec-dim', 'Recitation：維度 = 基底的向量個數', [
  async (tok, S) => { // @530
    hd('獨立：只有「全部乘 0」的組合會得到 0', 0, 7.2);
    cap('再說一次獨立', '只有全部係數都是 0，組合才會是零向量');
  },
  async (tok, S) => { // @549
    S.g = mgrid(RMAT, -6.0, 5.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] });
    pl('a₁、a₂、a₃ 是 column space 的基底', -1.0, 5.6);
    cap('所以 a₁、a₂、a₃ 是 column space 的基底', '獨立，而且組合出整個 column space');
  },
  async (tok, S) => { // @565
    S.d = hot('維度（dimension）= 基底裡向量的個數', -1.0, 4.9);
    cap('維度是一個數字', '基底裡有幾個向量');
  },
  async (tok, S) => { // @593
    S.g2 = mgrid(BAS2, -6.0, 2.6, 0, { color: (i, j) => [COL.a, COL.b, COL.c][j] }); sm('另一組基底（示意）', -5.2, 0.4);
    ok(rk(BAS2) === 3, -1.0, 2.6, '也是 R³ 的基底 ✓');
    cap('一個空間有很多組不同的基底', '');
  },
  async (tok, S) => { // @620
    txt(S.d, '但每組基底都剛好 3 個');
    cap('R³ 的任何基底，都需要剛好 3 個獨立向量', '');
  },
  async (tok, S) => { // @625
    ok(rk([RA1, RA2]) < 3, -1.0, 1.9, '2 個向量：rank 最多 2 → 張不滿 R³ ✓');
    cap('2 個向量永遠張不滿 R³', '');
  },
  async (tok, S) => { // @632
    ok(rk(FOUR) === 3, -1.0, 1.2, '4 個向量（示意）：rank 最多 3 → 一定相依 ✓');
    cap('R³ 裡 4 個向量不可能獨立', '太少就張不滿，太多就相依');
  },
  async (tok, S) => { // @654
    good('每組基底的個數都一樣 = 維度', -1.0, 0.4);
    cap('每一組基底的向量個數都一樣', '這個數就是維度');
  },
  async (tok, S) => { // @675
    fresh(CAM[0], CAM[1]); cam(24, 18, 12.5, [0, 2.8, 0]);
    hd('子空間：R³ 裡一個過原點的平面', -2.8, 7.4);
    S.Sp = space3(0, 2.6, 0, 0.9, 2.6); S.Sp.plane(PU, PV, COL.g, 0.22);
    cap('留在 3 維空間，但子空間只是一個平面', '它通過原點');
  },
  async (tok, S) => { // @689
    S.u = S.Sp.arrow(PU, COL.a, 'u'); S.v = S.Sp.arrow(PV, COL.b, 'v');
    ok(rk([PU, PV]) === 2, -3.4, 6.6, '平面上兩個不同方向的向量：獨立 ✓');
    cap('平面上取一個向量，再取另一個', '方向不同，所以獨立');
  },
  async (tok, S) => { // @700
    S.w = S.Sp.arrow(PW, COL.r, 'w（也在平面上）');
    ok(rk([PU, PV, PW]) === 2, -3.4, 6.0, '平面上的第三個向量：rank 還是 2 → 找不到第三個獨立的 ✓');
    cap('但在平面裡找不到第三個獨立的向量', '');
  },
  async (tok, S) => { // @725
    S.w.visible = false; showL(S.w.lbl, false);
    hot('平面的每組基底都是 2 個 → dimension 2', -3.4, 5.3);
    cap('這個平面的每一組基底都是 2 個向量', '維度是 2');
  },
  async (tok, S) => { // @735
    sm('它不是 R²：它是 R³ 裡的一個平面（向量有 3 個分量）', -3.4, 4.7);
    cap('它不是 R²', '是 3 維空間裡的平面，只是維度是 2');
  },
  async (tok, S) => { // @750
    const v2 = addv(PU, PV);
    await anim(tok, 1200, (u) => S.Sp.set(S.v, addv(scl(PV, 1 - u), scl(v2, u))));
    ok(rk([PU, v2]) === 2, -3.4, 4.0, '換一支也可以：u、u + v 一樣獨立、張成平面 ✓');
    cap('不喜歡這支？換一個方向也行', '還是兩個獨立向量，也是一組基底');
  },
  async (tok, S) => { // @771
    note('獨立、張成、基底、維度', -3.4, 3.2);
    cap('關鍵概念：獨立、張成、基底', '維度 = 基底有幾個向量');
  },
]);

// ════════ fNk_zzaMoSs（3Blue1Brown 第 1 集：Vectors） ════════
const PX = -1.8, PY = 3.2, PS = 0.55;
const TX3 = 3.6;   // 右側文字欄
scene('vsB-v-views', '3B1B 1：向量的三種觀點', [
  async (tok, S) => { // @11
    hd('線性代數最基本的積木：向量（vector）', 0, 7.2);
    cap('一切的根本：向量', '先確定大家說的「向量」是同一件事');
  },
  async (tok, S) => { // @20
    S.v3 = [['物理系', -4.4], ['資工系', 0], ['數學系', 4.4]].map(([t, x]) => hd(t, x, 6.2));
    cap('三種相關但不同的看法', '物理學生、資工學生、數學家');
  },
  async (tok, S) => { // @30
    setCls(S.v3[0], 'ptr alt');
    S.G = plane2(-4.4, 3.4, 0.5, 3, { grid: false, names: false }); S.G.ax.forEach((l) => { l.visible = false; });
    S.a = S.G.vec([2, 1.2], VC.a, '', { from: [-1.2, -1] });
    sm('箭頭：長度 + 方向', -4.4, 1.4);
    cap('物理：向量是空間中的箭頭', '由長度和方向決定');
  },
  async (tok, S) => { // @39
    await anim(tok, 1400, (u) => S.a.set([2, 1.2], [-1.2 + 1.0 * u, -1 + 1.4 * u]));
    sm('搬到別處：還是同一個向量', -4.4, 0.8);
    cap('長度和方向不變', '搬到哪裡都是同一個向量');
  },
  async (tok, S) => { // @44
    sm('平面上：2 維；我們的空間：3 維', -4.4, 0.2);
    cap('平面上的向量是 2 維', '我們生活的空間裡是 3 維');
  },
  async (tok, S) => { // @51
    setCls(S.v3[0], 'ptr'); setCls(S.v3[1], 'ptr alt');
    S.list = mtx([['?'], ['?']], -0.2, 5.0, 3);
    cap('資工：向量是有順序的一串數字', '');
  },
  async (tok, S) => { // @57
    S.list.kill(); S.house = code(['[ 2600 ]  ← 坪數（平方英尺）', '[ 30萬  ]  ← 價格'], -0.6, 5.0, 0.55);
    sm('（數字示意）', 0, 3.7);
    cap('例：分析房價，只看坪數和價格', '每間房子 = 一對數字');
  },
  async (tok, S) => { // @69
    S.sw = code(['[ 30萬  ]', '[ 2600 ]'], 0, 3.0, 0.5);
    bad('順序不同 = 不同的向量', 0, 1.9);
    cap('順序很重要', '第一個是坪數、第二個是價格');
  },
  async (tok, S) => { // @76
    sm('vector ≈ list；長度 2 → 2 維', 0, 1.3);
    cap('這裡「向量」差不多就是 list 的花俏說法', '長度是 2，所以是 2 維');
  },
  async (tok, S) => { // @85
    setCls(S.v3[1], 'ptr'); setCls(S.v3[2], 'ptr alt');
    S.m = pl('任何能「相加」、能「乘一個數」的東西', 4.4, 5.0);
    cap('數學家：想把兩種看法一般化', '只要有合理的加法、乘數，就是向量');
  },
  async (tok, S) => { // @108
    hot('向量加法 ＋ 乘以一個數：貫穿整個線性代數', 0, -0.4);
    cap('先暫時放著抽象定義', '但記得：加法和乘數是整門課的核心');
  },
]);

scene('vsB-v-coords', '3B1B 1：座標：從原點走到箭頭尖端的指示', [
  async (tok, S) => { // @119
    hd('說到「向量」，先想一支箭頭', TX3, 7.2);
    S.free = varrow(VC.a); S.free.setW(V3(-3.6, 1.0, 0), V3(-1.4, 2.6, 0));
    cap('提到向量，先想成一支箭頭', '');
  },
  async (tok, S) => { // @132
    S.G = plane2(PX, PY, PS, 5, { grid: false, names: false }); S.G.ax.forEach((l) => { l.visible = true; });
    const a0 = V3(-3.6, 1.0, 0), b0 = V3(-1.4, 2.6, 0), o = S.G.w([0, 0]), d = b0.clone().sub(a0);
    await anim(tok, 1200, (u) => { const a = a0.clone().lerp(o, u); S.free.setW(a, a.clone().add(d)); });
    cap('放進 xy 座標系', '尾巴放在原點');
  },
  async (tok, S) => { // @139
    sm('線性代數：向量幾乎都從原點出發', TX3, 6.5);
    cap('和物理不同', '線性代數裡的向量幾乎都「根」在原點');
  },
  async (tok, S) => { // @151
    sm('→ 用座標翻譯成一串數字', TX3, 6.0);
    cap('再透過座標，把箭頭翻譯成一串數字', '');
  },
  async (tok, S) => { // @172
    gone(S.free); const px = S.G.w([5.4, 0]), py = S.G.w([0, 5.4]);
    hot('x 軸', px.x, px.y); hot('y 軸', py.x, py.y);
    cap('水平的是 x 軸', '垂直的是 y 軸');
  },
  async (tok, S) => { // @180
    S.o = S.G.dot([0, 0], VC.r, 0.13); S.G.label('原點：所有向量的根', [0.3, -0.7], 'idx');
    cap('兩軸交會處：原點', '空間的中心、所有向量的根');
  },
  async (tok, S) => { // @186
    for (let k = -5; k <= 5; k++) if (k) { S.G.seg([k, -0.15], [k, 0.15], '#6e5f49', 0.02); S.G.seg([-0.15, k], [0.15, k], '#6e5f49', 0.02); }
    cap('選一個長度當 1', '在兩軸上每隔 1 畫刻度');
  },
  async (tok, S) => { // @197
    S.grid = plane2(PX, PY, PS, 5, { names: false }); S.grid.ax.forEach((l) => { l.visible = false; });
    cap('刻度延伸成格線', '代表整個 2 維空間');
  },
  async (tok, S) => { // @202
    S.v = S.G.vec([-2, 3], VC.b, '（示意）');
    S.c = sm('座標 = 從尾巴（原點）走到尖端的指示', TX3, 5.2);
    cap('向量的座標：一對數字', '告訴你怎麼從原點走到箭頭尖端');
  },
  async (tok, S) => { // @209
    S.walk = S.G.dot([0, 0], VC.g, 0.14); const a = S.G.w([0, 0]), b = S.G.w([-2, 0]);
    await anim(tok, 1000, (u) => S.walk.position.lerpVectors(a, b, u));
    S.G.seg([0, 0], [-2, 0], VC.g, 0.04); pl('第一個數 −2：沿 x 軸往左 2', TX3, 4.5);
    cap('第一個數：沿 x 軸走多遠', '正數往右、負數往左');
  },
  async (tok, S) => { // @218
    const a = S.G.w([-2, 0]), b = S.G.w([-2, 3]);
    await anim(tok, 1000, (u) => S.walk.position.lerpVectors(a, b, u));
    S.G.seg([-2, 0], [-2, 3], VC.d, 0.04); pl('第二個數 3：平行 y 軸往上 3', TX3, 3.9);
    cap('第二個數：平行 y 軸走多遠', '正數往上、負數往下');
  },
  async (tok, S) => { // @228
    S.br = mtx([[-2], [3]], TX3 - 0.4, 3.0, 3);
    sm('直的寫、用方括號：和「點」區分', TX3 + 1.8, 2.7);
    cap('慣例：把兩個數直著寫', '外面加方括號，和點的寫法區分');
  },
  async (tok, S) => { // @236
    good('每一對數 ↔ 恰好一個向量', TX3, 1.6);
    cap('每一對數字對應一個向量', '每個向量也只對應一對數字');
  },
  async (tok, S) => { // @244
    fresh(CAM[0], CAM[1]); cam(30, 20, 12, [0, 2.8, 0]);
    S.Sp = space3(0, 2.4, 0, 0.8, 2.8);
    hd('三維：再加一條 z 軸', -3.2, 7.4);
    cap('三維呢？加第三條軸：z 軸', '和 x、y 軸都垂直');
  },
  async (tok, S) => { // @256
    const v = [2, 1, 2.5]; S.v = v;
    const d = S.Sp.ball([0, 0, 0], VC.g, 0.12), P = [[0, 0, 0], [v[0], 0, 0], [v[0], v[1], 0], v];
    for (let k = 0; k < 3; k++) { const a = S.Sp.w(P[k]), b = S.Sp.w(P[k + 1]); await anim(tok, 600, (u) => d.position.lerpVectors(a, b, u)); }
    S.Sp.arrow(v, VC.b, '(2, 1, 2.5)（示意）');
    cap('每個向量對應一組有序的三個數', '依序沿 x、平行 y、平行 z 走');
  },
  async (tok, S) => { // @268
    good('每一組三個數 ↔ 恰好一個向量', -3.2, 6.6);
    cap('每組三個數對應唯一的向量', '反過來也一樣');
  },
]);

const VA = [1, 2], VB = [3, -1], VAB = addv(VA, VB);
scene('vsB-v-add', '3B1B 1：向量加法：頭接尾', [
  async (tok, S) => { // @277
    hd('兩個基本運算：加法、乘以數', 0, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false });
    cap('回到兩個運算', '線性代數的每個主題都圍繞著它們');
  },
  async (tok, S) => { // @288
    S.a = S.G.vec(VA, VC.a, 'v'); S.b = S.G.vec(VB, VC.b, 'w');
    cap('一支往上偏右，一支往右偏下', '');
  },
  async (tok, S) => { // @293
    await anim(tok, 1400, (u) => S.b.set(VB, [VA[0] * u, VA[1] * u]));
    cap('把第二支移過去', '讓它的尾巴接在第一支的尖端');
  },
  async (tok, S) => { // @300
    S.s = S.G.vec([0, 0], VC.d, 'v + w');
    await anim(tok, 900, (u) => S.s.set(scl(VAB, u)));
    cap('從第一支的尾巴，畫到第二支的尖端', '這支新向量就是和');
  },
  async (tok, S) => { // @309
    sm('（加法是唯一讓向量離開原點的時候）', TX3, 6.2);
    cap('這幾乎是唯一一次', '我們讓向量離開原點');
  },
  async (tok, S) => { // @321
    pl('每個向量 = 一次「移動」：先走 v、再走 w = 直接走 v + w', TX3, 5.5);
    cap('為什麼這樣定義？', '把向量想成一步移動：兩步合起來就是和');
  },
  async (tok, S) => { // @349
    const y = -1.0, L = (x) => V3(-5.4 + x * 0.55, y, 0); S.nl = [rod('#6e5f49', 0.02)]; S.nl[0].setW(L(-1), L(8));
    for (let k = 0; k <= 7; k++) sm(String(k), L(k).x, y - 0.35);
    const d = dotBall(VC.r, 0.12); d.position.copy(L(0));
    await anim(tok, 700, (u) => d.position.copy(L(2 * u))); await anim(tok, 1100, (u) => d.position.copy(L(2 + 5 * u)));
    pl('2 + 5 = ' + (2 + 5), L(3.5).x, y + 0.5);
    cap('就像數線上的加法', '先走 2 步、再走 5 步 = 走 7 步');
  },
  async (tok, S) => { // @361
    S.n = code(['v = [  1 ]   w = [  3 ]', '    [  2 ]       [ −1 ]'], TX3, 4.6, 0.5);
    cap('看數字：v = (1, 2)，w = (3, −1)', '');
  },
  async (tok, S) => { // @377
    const P = [[0, 0], [1, 0], [1, 2], [4, 2], [4, 1]], d = S.G.dot([0, 0], VC.r, 0.13);
    for (let k = 0; k < 4; k++) { const a = S.G.w(P[k]), b = S.G.w(P[k + 1]); await anim(tok, 550, (u) => d.position.lerpVectors(a, b, u)); }
    sm('右 1、上 2、右 3、下 1', TX3, 3.4);
    cap('四步路線：右 1、上 2', '再右 3、下 1');
  },
  async (tok, S) => { // @388
    ok(eqV(VAB, [1 + 3, 2 + (-1)]), TX3, 2.7, '重排：右 (1 + 3)、上 (2 − 1) → (4, 1) ✓');
    cap('先做完所有往右的、再做上下的', '得到 (1 + 3, 2 + (−1)) = (4, 1)');
  },
  async (tok, S) => { // @405
    S.gen = code(['[x₁]   [x₂]   [x₁ + x₂]', '[y₁] + [y₂] = [y₁ + y₂]'], TX3, 1.8, 0.5);
    cap('一般來說：對應的分量相加', '');
  },
]);

const VS = [2, 1];
scene('vsB-v-scale', '3B1B 1：乘以純量：伸縮與反向', [
  async (tok, S) => { // @414
    hd('另一個運算：乘以一個數', 0, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false }); S.v = S.G.vec(VS, VC.a, 'v（示意）');
    cap('另一個基本運算：乘以一個數', '看幾個例子最清楚');
  },
  async (tok, S) => { // @420
    S.k = S.G.vec(VS, VC.d, '2v'); await anim(tok, 1000, (u) => S.k.set(scl(VS, 1 + u)));
    cap('乘 2：拉長成兩倍', '');
  },
  async (tok, S) => { // @429
    await anim(tok, 1000, (u) => S.k.set(scl(VS, 2 + (1 / 3 - 2) * u))); S.k.A.tag('⅓ v');
    cap('乘 1/3：壓縮成三分之一', '');
  },
  async (tok, S) => { // @437
    await anim(tok, 1500, (u) => S.k.set(scl(VS, 1 / 3 + (-1.8 - 1 / 3) * u))); S.k.A.tag('−1.8 v');
    cap('乘 −1.8：先反向', '再拉長 1.8 倍');
  },
  async (tok, S) => { // @448
    S.t = hot('伸長、壓縮、反向 = scaling；那個數 = scalar（純量）', TX3, 6.2);
    cap('伸縮（或反向）叫 scaling', '做這件事的數叫 scalar');
  },
  async (tok, S) => { // @461
    sm('線性代數裡 scalar ≈ number', TX3, 5.5);
    cap('數字在線性代數最主要的工作就是縮放向量', '所以 scalar 和「數」幾乎同義');
  },
  async (tok, S) => { // @472
    const d = scl(VS, 2); S.k.set(d); S.k.A.tag('2v');
    ok(eqV(d, [2 * VS[0], 2 * VS[1]]), TX3, 4.7, '2·[2; 1] = [4; 2]：每個分量都乘 2 ✓');
    cap('用數字看：每個分量都乘上那個 scalar', '');
  },
  async (tok, S) => { // @490
    note('線性代數圍繞兩個運算：向量加法、純量乘法', TX3, 3.8);
    cap('之後的影片會一直看到', '一切都圍繞這兩個運算');
  },
  async (tok, S) => { // @508
    sm('箭頭？一串數字？哪一個「本質」都不重要', TX3, 3.1);
    cap('向量本質上是箭頭還是數字？', '其實不重要');
  },
  async (tok, S) => { // @522
    pl('重要的是：能在兩種看法之間來回翻譯', TX3, 2.4);
    cap('線性代數有用，是因為能在兩種觀點間來回翻譯', '');
  },
  async (tok, S) => { // @529
    sm('資料分析：把一大堆數字「看」成圖', TX3, 1.7);
    cap('對資料分析師：把數字串變成看得見的圖', '看出資料裡的規律');
  },
  async (tok, S) => { // @540
    sm('物理、電腦繪圖：用數字描述、操作空間', TX3, 1.1);
    cap('對物理學家、電腦繪圖工程師', '用電腦算得動的數字來描述空間');
  },
]);

// ════════ k7RM-ot2NWY（3Blue1Brown 第 2 集：Linear combinations, span, and basis vectors） ════════
const IH = [1, 0], JH = [0, 1], V32 = [3, -2];
const NB1 = [1, 1.5], NB2 = [1.5, -0.5];       // 「往右上」「往右下」的另一組基底（示意）
const comb = (a, u, b, v) => addv(scl(u, a), scl(v, b));
scene('vsB-s-basis', '3B1B 2：座標是純量；î、ĵ 是基底', [
  async (tok, S) => { // @12
    hd('另一種看座標的方式', TX3, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false });
    cap('上一集：一對數字 ↔ 一支 2 維向量', '換個角度看座標');
  },
  async (tok, S) => { // @33
    S.v = S.G.vec(V32, VC.k, '(3, −2)');
    pl('把每個座標想成一個 scalar', TX3, 6.4);
    cap('例如 (3, −2)', '把每個座標都想成一個 scalar：它在縮放什麼？');
  },
  async (tok, S) => { // @43
    sm('xy 座標系裡有兩支特別的向量', TX3, 5.8);
    cap('xy 座標系裡有兩支很特別的向量', '');
  },
  async (tok, S) => { // @49
    S.i = S.G.vec(IH, VC.d, 'î');
    cap('î：指向右、長度 1', 'x 方向的單位向量');
  },
  async (tok, S) => { // @54
    S.j = S.G.vec(JH, VC.r, 'ĵ');
    cap('ĵ：指向上、長度 1', 'y 方向的單位向量');
  },
  async (tok, S) => { // @61
    await anim(tok, 1000, (u) => S.i.set([1 + 2 * u, 0])); S.i.A.tag('3î');
    cap('x 座標 3：把 î 拉長 3 倍', '');
  },
  async (tok, S) => { // @69
    await anim(tok, 1200, (u) => S.j.set([0, 1 - 3 * u])); S.j.A.tag('−2ĵ');
    cap('y 座標 −2：把 ĵ 翻過來、拉長 2 倍', '');
  },
  async (tok, S) => { // @75
    await anim(tok, 1000, (u) => S.j.set([0, -2], [3 * u, 0]));
    ok(eqV(comb(3, IH, -2, JH), V32), TX3, 5.1, '3î + (−2)ĵ = (3, −2) ✓');
    cap('這個向量 = 兩支縮放過的向量相加', '「縮放再相加」非常重要');
  },
  async (tok, S) => { // @87
    hot('î、ĵ = 座標系的基底（basis）', TX3, 4.4);
    cap('î、ĵ 合稱座標系的基底', '座標（scalar）縮放的就是它們');
  },
  async (tok, S) => { // @114
    gone(S.i, S.j, S.v); S.b1 = S.G.vec(NB1, VC.a, 'v'); S.b2 = S.G.vec(NB2, VC.b, 'w');
    sm('換一組基底：往右上的 v、往右下的 w（示意）', TX3, 3.7);
    cap('也可以選別的基底向量', '一樣得到合理的新座標系');
  },
  async (tok, S) => { // @127
    S.c = S.G.vec([0, 0], VC.d, 'a v + b w'); const AB = [[1, 0.5], [2, -1], [-1, 1.5], [0.6, 1.2]];
    let p = [1, 1]; for (const q of AB) { const p0 = p.slice(); await anim(tok, 500, (u) => { p = [p0[0] + (q[0] - p0[0]) * u, p0[1] + (q[1] - p0[1]) * u]; S.c.set(comb(p[0], NB1, p[1], NB2)); }); S.G.dot(comb(q[0], NB1, q[1], NB2), VC.d, 0.07); }
    cap('選兩個 scalar，各縮放一支再相加', '能得到哪些向量？');
  },
  async (tok, S) => { // @144
    ok(det2([[NB1[0], NB2[0]], [NB1[1], NB2[1]]]) !== 0, TX3, 3.0, '每一支 2 維向量都到得了（v、w 不共線）✓');
    cap('答案：每一支 2 維向量都到得了', '想想為什麼');
  },
  async (tok, S) => { // @152
    const p = comb(3, NB1, -2, NB2); S.c.set(p); S.c.A.tag('3v − 2w');
    pl('同樣的 (3, −2)，在新基底下 = ' + vstr(p), TX3, 2.3);
    cap('新基底也能在數字和向量間來回翻譯', '但同一對數字指到的向量不一樣了');
  },
  async (tok, S) => { // @175
    note('用數字描述向量，永遠隱含「選了哪組基底」', TX3, 1.5);
    cap('只要用數字描述向量', '背後就隱含了一個基底的選擇');
  },
]);

const SP1 = [1, 2], SP2 = [2, -1], SPL = [2, 4];
scene('vsB-s-span', '3B1B 2：線性組合與 span', [
  async (tok, S) => { // @186
    hd('縮放兩支向量再相加 = 線性組合（linear combination）', 0, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false }); S.v = S.G.vec(SP1, VC.a, 'v'); S.w = S.G.vec(SP2, VC.b, 'w');
    S.f = pl('a v + b w', TX3, 6.3);
    cap('縮放兩支向量再相加', '叫做這兩支向量的線性組合');
  },
  async (tok, S) => { // @198
    S.c = S.G.vec(SP1, VC.d, ''); const pts = [];
    await anim(tok, 1800, (u) => { const b = -1.6 + 3.2 * u; S.c.set(comb(1, SP1, b, SP2)); });
    S.G.seg(comb(1, SP1, -1.6, SP2), comb(1, SP1, 1.6, SP2), VC.d, 0.03); void pts;
    sm('固定 a = 1、只讓 b 變：尖端畫出一條直線', TX3, 5.6);
    cap('固定一個 scalar，讓另一個自由變化', '尖端畫出一條直線 → 「線性」');
  },
  async (tok, S) => { // @209
    for (const [a, b] of [[-1, 0.5], [0.5, -1.2], [1.5, 1], [-0.8, -1]]) { await anim(tok, 400, (u) => S.c.set(comb(a * u + 1 * (1 - u), SP1, b, SP2))); S.G.dot(comb(a, SP1, b, SP2), VC.d, 0.07); }
    cap('兩個 scalar 都自由變化', '會得到哪些向量？');
  },
  async (tok, S) => { // @216
    for (let a = -2; a <= 2; a += 0.5) for (let b = -2; b <= 2; b += 0.5) { const p = comb(a, SP1, b, SP2); if (Math.abs(p[0]) <= 5 && Math.abs(p[1]) <= 5) S.G.dot(p, '#7fc8a9', 0.05); }
    ok(rk([SP1, SP2]) === 2, TX3, 5.0, '大多數情況：整個平面都到得了 ✓');
    cap('大多數的兩支向量', '可以到達平面上每一點');
  },
  async (tok, S) => { // @224
    fresh(CAM[0], CAM[1]); hd('不走運：兩支向量在同一條線上', 0, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false }); S.G.vec(SP1, VC.a, 'v'); S.G.vec(SPL, VC.b, 'w = 2v');
    lineThrough(S.G, SP1, VC.d, 5.5, 0.05);
    ok(rk([SP1, SPL]) === 1, TX3, 6.2, '只能在一條過原點的線上 ✓（rank 1）');
    cap('如果兩支剛好排成一線', '尖端只能停在這條過原點的直線上');
  },
  async (tok, S) => { // @234
    sm('兩支都是零向量：只能停在原點', TX3, 5.5);
    cap('還有第三種：兩支都是零向量', '那就只能待在原點');
  },
  async (tok, S) => { // @241
    hot('span：所有線性組合能到達的向量', TX3, 4.7);
    cap('能到達的所有向量的集合', '叫做這兩支向量的 span');
  },
  async (tok, S) => { // @267
    sm('= 只用「加法」和「乘數」能走到哪裡', TX3, 4.0);
    cap('span 在問：只用兩個基本運算', '能到達哪些向量？');
  },
  async (tok, S) => { // @283
    fresh(CAM[0], CAM[1]); hd('把向量想成「點」', 0, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false });
    S.vs = [-2, -1, 1, 2].map((k) => S.G.vec(scl(SP1, k), VC.a));
    cap('一整條線上的向量，畫成箭頭太擠', '常見的做法：用點來代表');
  },
  async (tok, S) => { // @296
    S.vs.forEach((V) => { S.G.dot(V.v, VC.r, 0.1); gone(V.A); });
    sm('每支向量 → 它尖端的那一點（尾巴在原點）', TX3, 6.2);
    cap('每支向量只畫它尖端的點', '尾巴照樣想成在原點');
  },
  async (tok, S) => { // @310
    lineThrough(S.G, SP1, VC.r, 5.5, 0.03);
    cap('「尖端在某條線上的所有向量」', '就想成那條線本身');
  },
  async (tok, S) => { // @320
    const pl2 = new THREE.Mesh(new THREE.PlaneGeometry(10 * PS, 10 * PS), new THREE.MeshBasicMaterial({ color: VC.d, transparent: true, opacity: 0.15, depthWrite: false }));
    pl2.position.set(PX, PY, -0.02); lab.world.add(pl2);
    cap('所有 2 維向量一起', '就想成一整片無限延伸的平面');
  },
  async (tok, S) => { // @335
    note('單一向量 → 箭頭；一群向量 → 點', TX3, 5.4);
    cap('只看一支向量：想成箭頭', '一群向量：想成點');
  },
]);

const U3 = [1, 0.2, 0.6], W3 = [0.2, 1, 0.4], Z3on = addv(scl(U3, 0.8), scl(W3, -0.6)), Z3 = [-0.3, 0.4, 1.3];
const SCAM = [[0, 3, 12], [0, 2.6, 0]];
scene('vsB-s-3d', '3B1B 2：三維的 span：平面與整個空間', [
  async (tok, S) => { // @355
    cam(32, 20, 12, [0, 2.6, 0]);
    S.Sp = space3(0, 2.4, 0, 1.1, 2.8); hd('三維空間的 span', -3.4, 7.4);
    cap('在 3 維空間，span 更有意思', '');
  },
  async (tok, S) => { // @363
    S.u = S.Sp.arrow(U3, VC.a, 'v'); S.w = S.Sp.arrow(W3, VC.b, 'w');
    ok(rk([U3, W3]) === 2, -3.4, 6.7, '方向不同 ✓');
    cap('3 維裡兩支方向不同的向量', '它們的 span 是什麼？');
  },
  async (tok, S) => { // @373
    sm('span = 所有線性組合 a v + b w', -3.4, 6.1);
    cap('span = 所有線性組合', '把兩支各自縮放再相加');
  },
  async (tok, S) => { // @386
    S.c = S.Sp.arrow(U3, VC.d, 'a v + b w');
    for (const [a, b] of [[1.2, 0.4], [-0.6, 1.1], [-1, -0.8], [0.7, -1.2]]) { const c0 = S.c.v.slice(); await anim(tok, 450, (u) => S.Sp.set(S.c, addv(scl(c0, 1 - u), scl(comb(a, U3, b, W3), u)))); S.Sp.ball(comb(a, U3, b, W3), VC.d, 0.06); }
    cap('像轉兩個旋鈕調整兩個 scalar', '跟著和的尖端走');
  },
  async (tok, S) => { // @396
    S.pl = S.Sp.plane(U3, W3, VC.g, 0.22);
    cap('尖端畫出一片穿過原點的平面', '這片平面就是 v、w 的 span');
  },
  async (tok, S) => { // @414
    S.z = S.Sp.arrow(Z3on, VC.c, 'u');
    cap('再加第三支向量', '三支的 span 是什麼？');
  },
  async (tok, S) => { // @420
    sm('a v + b w + c u：三個 scalar', -3.4, 6.7);
    cap('三支的線性組合', '選三個 scalar、各自縮放、全部相加');
  },
  async (tok, S) => { // @444
    ok(rk([U3, W3, Z3on]) === 2, -3.4, 6.1, '第三支在 v、w 的平面上：span 不變（rank 2）✓');
    cap('如果第三支落在前兩支的 span 上', 'span 不會變大，還是那片平面');
  },
  async (tok, S) => { // @462
    await anim(tok, 1200, (u) => S.Sp.set(S.z, addv(scl(Z3on, 1 - u), scl(Z3, u))));
    cap('隨便選一支，幾乎一定不在那片平面上', '');
  },
  async (tok, S) => { // @471
    ok(rk([U3, W3, Z3]) === 3, -3.4, 5.4, '指向新的方向：rank 3 → 到得了每一支 3 維向量 ✓');
    cap('它指向新的方向', '解鎖了所有 3 維向量');
  },
  async (tok, S) => { // @475
    await anim(tok, 2200, (u) => { const c = scl(Z3, -1 + 2 * u); S.pl.setSpan(U3, W3, c); });
    cap('縮放第三支，平面跟著移動', '掃過整個空間');
  },
]);

const DU = [1, 0.2, 0.6], DW = [0.2, 1, 0.4], DZ = addv(scl(DU, 0.8), scl(DW, -0.6));
scene('vsB-s-dep', '3B1B 2：線性相依、線性獨立、基底', [
  async (tok, S) => { // @497
    cam(32, 20, 12, [0, 2.6, 0]);
    S.Sp = space3(0, 2.4, 0, 1.1, 2.8); S.Sp.arrow(DU, VC.a, 'v'); S.Sp.arrow(DW, VC.b, 'w'); S.z = S.Sp.arrow(DZ, VC.c, 'u'); S.Sp.plane(DU, DW, VC.g, 0.2);
    hd('有一支是多餘的', -3.4, 7.4);
    cap('第三支在前兩支的 span 上（或兩支排成一線）', '需要一個名詞描述「有一支多餘」');
  },
  async (tok, S) => { // @511
    S.z.glow(RED); ok(rk([DU, DW, DZ]) === rk([DU, DW]), -3.4, 6.7, '拿掉 u，span 沒有變小 ✓ → 線性相依');
    cap('拿掉某一支 span 也不會變小', '就說它們線性相依（linearly dependent）');
  },
  async (tok, S) => { // @520
    ok(eqV(DZ, comb(0.8, DU, -0.6, DW)), -3.4, 6.1, 'u = 0.8 v − 0.6 w ✓：u 是其他向量的組合');
    cap('換句話說：有一支能寫成其他向量的線性組合', '因為它本來就在其他向量的 span 裡');
  },
  async (tok, S) => { // @533
    const Z = [-0.3, 0.4, 1.3]; S.Sp.set(S.z, Z); S.z.glow(null);
    ok(rk([DU, DW, Z]) === 3, -3.4, 5.4, '換成新方向：每一支都增加一個維度 → 線性獨立 ✓');
    cap('如果每一支都真的多貢獻一個維度', '就說它們線性獨立（linearly independent）');
  },
  async (tok, S) => { // @553
    hot('基底 = 一組線性獨立、而且張成整個空間的向量', -3.4, 4.6);
    cap('基底的正式定義', '線性獨立、而且 span 是整個空間');
  },
]);

// ════════ uQhTuRlWMxw（3Blue1Brown 第 7 集：Inverse matrices, column space and null space） ════════
const SYS = [[2, 5, 3], [4, 0, 8], [1, 3, 0]], SYSV = [-3, 0, 2];       // 方程組（示意）
const AI = [[1, 1], [-1, 2]], XI = [1, 1], VI = mulMV(AI, XI);          // 2×2 可逆（示意）
const ROT = [[0, -1], [1, 0]], SHR = [[1, 1], [0, 1]];
const SG = [[1, 2], [0.5, 1]], SGN = [-2, 1];                           // det 0：壓到一條線（示意）
const M3R2 = [[1, 0, 1], [0, 1, 1], [1, 1, 2]], M3R1 = [[1, 2, 3], [2, 4, 6], [1, 2, 3]], M3R3 = [[1, 0.3, 0], [0, 1, 0.2], [0.2, 0, 1]];
const ID2 = [[1, 0], [0, 1]];
scene('vsB-i-sys', '3B1B 7：線性方程組 = Ax = v', [
  async (tok, S) => { // @11
    hd('用「線性變換」看：逆矩陣、column space、rank、null space', 0, 7.2);
    cap('這集用線性變換的眼光', '看逆矩陣、column space、rank、null space');
  },
  async (tok, S) => { // @28
    sm('不講計算方法（關鍵字：Gaussian elimination、row echelon form）', 0, 6.6);
    cap('不教怎麼算', '重點是直覺；計算通常交給軟體');
  },
  async (tok, S) => { // @52
    pl('線性代數描述「空間的操作」：電腦繪圖、機器人', -3.4, 5.9);
    cap('線性代數能描述空間的變換', '用在電腦繪圖、機器人');
  },
  async (tok, S) => { // @67
    pl('更廣泛的理由：解某些方程組', -3.4, 5.3);
    cap('它幾乎每個技術領域都需要', '因為它能解某些方程組');
  },
  async (tok, S) => { // @71
    sm('一串未知的變數 + 一串把它們連起來的方程', -3.4, 4.7);
    cap('方程組：一串未知數，加上一串關係式', '');
  },
  async (tok, S) => { // @86
    S.eq = code(['2x + 5y + 3z = −3', '4x      + 8z =  0', ' x + 3y      =  2'], 2.4, 5.6, 0.55); sm('（示意）', 4.6, 3.9);
    cap('幸運的話，方程有特別的形式', '每個變數只被乘一個常數，然後相加');
  },
  async (tok, S) => { // @97
    bad('沒有次方、沒有函數、沒有變數互乘', -3.4, 3.7);
    cap('沒有次方、沒有奇怪的函數', '也沒有兩個變數相乘');
  },
  async (tok, S) => { // @103
    sm('變數放左邊、常數放右邊', -3.4, 3.0);
    cap('整理：變數全放左邊', '常數放右邊');
  },
  async (tok, S) => { // @114
    S.eq.kill(); S.eq = code(['2x + 5y + 3z = −3', '4x + 0y + 8z =  0', '1x + 3y + 0z =  2'], 2.4, 5.6, 0.55);
    cap('同一個變數上下對齊', '缺的補上係數 0');
  },
  async (tok, S) => { // @124
    hot('線性方程組（linear system of equations）', 2.4, 3.6);
    cap('這叫線性方程組', '');
  },
  async (tok, S) => { // @128
    S.A = mgrid(SYS, -2.4, 1.6, 0, { color: () => VC.a, size: 0.5, gap: 0.6 }); pl('·', -0.6, 1.0);
    S.x = mgrid([['x'], ['y'], ['z']], 0.0, 1.6, 0, { color: () => VC.pale, size: 0.5, gap: 0.6 }); pl('=', 0.8, 1.0);
    S.v = mgrid(SYSV.map((a) => [a]), 1.4, 1.6, 0, { color: () => VC.b, size: 0.5, gap: 0.6 });
    const xs = (() => { const E = rrefSteps(SYS.map((r, i) => [...r, SYSV[i]])); return E.R.map((r) => r[3]); })();
    ok(eqV(mulMV(SYS, xs), SYSV), 4.6, 1.0, '和矩陣乘向量一模一樣 ✓');
    cap('看起來就像矩陣乘向量', '整組方程可以寫成一條向量方程');
  },
  async (tok, S) => { // @149
    sm('A', -1.8, 2.3); sm('x', 0, 2.3); sm('v', 1.4, 2.3); hot('A x = v', 4.6, 1.9);
    cap('係數矩陣叫 A、未知數向量叫 x、右邊叫 v', 'A x = v');
  },
  async (tok, S) => { // @167
    note('A 是一個線性變換：找一個 x，變換後剛好落在 v', 0, -0.6);
    cap('A 對應一個線性變換', '解 Ax = v：找一支 x，變換後落在 v 上');
  },
]);

scene('vsB-i-inv', '3B1B 7：det ≠ 0：倒帶找 x、逆矩陣 A⁻¹', [
  async (tok, S) => { // @195
    hd('2 個方程、2 個未知數：A 是 2 × 2', TX3, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false, ghost: true });
    cap('先看簡單的：2 個方程、2 個未知數', 'A 是 2 × 2，x 和 v 都是 2 維');
  },
  async (tok, S) => { // @205
    pl('關鍵：A 有沒有把空間壓扁到更低維？', TX3, 6.5);
    cap('怎麼看解，取決於 A 有沒有把空間壓扁', '壓成一條線或一個點？還是保持 2 維？');
  },
  async (tok, S) => { // @222
    sm('也就是：det(A) = 0？還是 ≠ 0？', TX3, 5.9);
    cap('用上一集的話說', 'determinant 是 0 還是不是 0');
  },
  async (tok, S) => { // @231
    S.v = S.G.vec(VI, VC.r, 'v'); S.x = S.G.vec(XI, VC.a, 'x', { move: true });
    await S.G.morph(tok, 2000, AI);
    ok(det2(AI) !== 0 && eqV(mulMV(AI, XI), VI), TX3, 5.2, 'det = ' + det2(AI) + ' ≠ 0：恰好一支 x 落在 v 上 ✓（示意 A）');
    cap('det ≠ 0：空間沒被壓扁', '恰好有一支向量 x 會落在 v 上');
  },
  async (tok, S) => { // @247
    S.x.move = false; S.x.set(VI);
    await anim(tok, 2000, (u) => { const M = AI.map((r, i) => r.map((a, j) => a + (ID2[i][j] - a) * u)); S.G.setM(M); const xi = mulMV(inv2(M.map((r) => r.slice())), VI); S.x.set(xi); });
    S.x.set(XI); ok(eqV(mulMV(inv2(AI), VI), XI), TX3, 4.5, '倒帶：v 回到 x = ' + vstr(XI) + ' ✓');
    cap('把變換倒著播', '跟著 v 走回去，就找到 x');
  },
  async (tok, S) => { // @260
    hot('倒帶的變換 = A 的逆，A⁻¹', TX3, 3.8);
    cap('倒著播本身也是一個線性變換', '叫做 A 的逆（inverse），寫 A⁻¹');
  },
  async (tok, S) => { // @266
    gone(S.x, S.v); await S.G.morph(tok, 1100, ROT); await S.G.morph(tok, 1100, ID2);
    sm('逆時針轉 90° 的逆 = 順時針轉 90°', TX3, 3.1);
    cap('A 逆時針轉 90°', 'A⁻¹ 就是順時針轉 90°');
  },
  async (tok, S) => { // @274
    await S.G.morph(tok, 1100, SHR); await S.G.morph(tok, 1100, ID2);
    sm('把 ĵ 往右推 1 的 shear ↔ 往左推 1', TX3, 2.5);
    cap('往右的 shear（ĵ 推到右邊一格）', '逆就是往左推一格');
  },
  async (tok, S) => { // @284
    await S.G.morph(tok, 1000, AI); await S.G.morph(tok, 1000, ID2);
    pl('先做 A、再做 A⁻¹ → 回到原狀', TX3, 1.8);
    cap('一般來說：先做 A、再做 A⁻¹', '會回到起點');
  },
  async (tok, S) => { // @294
    const P = mm(inv2(AI), AI);
    ok(eqM(P, ID2), TX3, 1.1, 'A⁻¹A = ' + mstr(P, 2).join(' ') + ' = I ✓');
    cap('連續做兩個變換 = 矩陣相乘', 'A⁻¹ A = 「什麼都不做」的矩陣');
  },
  async (tok, S) => { // @308
    S.i = S.G.vec([1, 0], VC.d, 'î'); S.j = S.G.vec([0, 1], VC.r, 'ĵ');
    sm('identity：î、ĵ 不動 → 欄是 (1,0)、(0,1)', TX3, 0.5);
    cap('什麼都不做的變換叫 identity', 'î、ĵ 都留在原地，欄是 (1,0) 和 (0,1)');
  },
  async (tok, S) => { // @320
    gone(S.i, S.j); S.v = S.G.vec(VI, VC.r, 'v'); S.x = S.G.vec(mulMV(inv2(AI), VI), VC.a, 'x = A⁻¹v');
    cap('找到逆矩陣後（實務上用電腦）', '解就是 x = A⁻¹ v：倒帶跟著 v 走');
  },
  async (tok, S) => { // @340
    sm('隨便選一個矩陣，det ≠ 0 幾乎是一定的 → 唯一解', TX3, -0.1);
    cap('隨機的矩陣幾乎都是 det ≠ 0', '兩個未知數兩個方程，幾乎一定有唯一解');
  },
  async (tok, S) => { // @353
    sm('更高維也一樣：方程數 = 未知數，A 不壓扁 → 有 A⁻¹', TX3, -0.7);
    cap('更高維也一樣', '只要不壓扁空間，就有逆變換');
  },
]);

scene('vsB-i-rank', '3B1B 7：det = 0：壓扁、rank、column space', [
  async (tok, S) => { // @403
    hd('det = 0：空間被壓到更低維', TX3, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false, ghost: true });
    await S.G.morph(tok, 2000, SG);
    ok(det2(SG) === 0, TX3, 6.5, 'det = 0：整個平面壓成一條線 ✓（示意 A）');
    cap('det = 0：變換把空間壓扁', '沒有逆變換');
  },
  async (tok, S) => { // @411
    bad('沒辦法把一條線「撐開」回平面', TX3, 5.9);
    cap('不可能把一條線撐開成平面', '至少函數做不到');
  },
  async (tok, S) => { // @418
    sm('那得把一個輸入變成一整條線的輸出；函數只能一進一出', TX3, 5.3);
    cap('那需要把每個向量變成一整條線', '但函數一個輸入只能有一個輸出');
  },
  async (tok, S) => { // @429
    sm('3 × 3：壓成平面、直線、甚至一點 → det 都是 0', TX3, 4.7);
    cap('3 個方程 3 個未知數也一樣', '壓成平面、直線或一個點，det 都是 0');
  },
  async (tok, S) => { // @447
    const vin = mulMV(SG, [1, 0.5]); S.vin = S.G.vec(vin, VC.d, 'v 在線上：有解');
    ok(Math.abs(vin[0] * SG[1][0] - vin[1] * SG[0][0]) < 1e-9, TX3, 4.0, 'v = A·(1, 0.5) → 在那條線上，有解 ✓');
    cap('沒有逆，仍可能有解', '前提是 v 剛好在那條線上');
  },
  async (tok, S) => { // @463
    sm('3 × 3：壓成一條線，比壓成平面更難有解', TX3, 3.3);
    cap('有些 det = 0 的情況限制更多', '壓成線比壓成平面更難有解');
  },
  async (tok, S) => { // @486
    S.r = hot('輸出是一條線 → rank 1', TX3, 2.6);
    ok(rk(SG) === 1, TX3, 2.0, 'rank(A) = ' + rk(SG) + ' ✓');
    cap('輸出是一條線（1 維）', '就說這個變換的 rank 是 1');
  },
  async (tok, S) => { // @495
    sm('輸出是平面 → rank 2', TX3, 1.4);
    cap('所有向量落在一個平面上', 'rank 就是 2');
  },
  async (tok, S) => { // @500
    txt(S.r, 'rank = 變換後「輸出」的維度');
    cap('rank = 輸出有幾個維度', '');
  },
  async (tok, S) => { // @508
    sm('2 × 2：rank 2 是最好的（det ≠ 0）', TX3, 0.8);
    cap('2 × 2 矩陣：rank 2 已經是最好', '基底向量仍張成整個平面、det ≠ 0');
  },
  async (tok, S) => { // @519
    fresh(CAM[0], CAM[1]); cam(30, 20, 12.5, [0, 2.6, 0]);
    hd('3 × 3：rank 2 = 壓成平面', -3.4, 7.4);
    S.Sp = space3(0, 2.4, 0, 0.8, 2.8); const Q = subspaces(M3R2); S.Q = Q;
    S.pl = S.Sp.plane(Q.col[0], Q.col[1], VC.g, 0.22);
    ok(Q.rank === 2, -3.4, 6.7, 'rank = 2：塌了，但沒有 rank 1 那麼扁 ✓（示意 A）');
    cap('3 × 3 矩陣 rank 2', '空間塌了，但不像 rank 1 那麼嚴重');
  },
  async (tok, S) => { // @527
    S.bx = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.2, 4.2), new THREE.MeshBasicMaterial({ color: VC.a, transparent: true, opacity: 0.07, depthWrite: false })); S.bx.position.copy(S.Sp.w([0, 0, 0])); lab.world.add(S.bx);
    ok(rk(M3R3) === 3, -3.4, 6.1, '另一個 3 × 3（示意）：det ≠ 0，輸出填滿 3 維 → rank 3 ✓');
    cap('det ≠ 0、輸出填滿整個 3 維', 'rank 3');
  },
  async (tok, S) => { // @534
    S.bx.visible = false; hot('所有可能的輸出 = column space', -3.4, 5.4);
    cap('所有可能輸出的集合（線、面、整個空間）', '叫做這個矩陣的 column space');
  },
  async (tok, S) => { // @546
    S.cs = [0, 1, 2].map((j) => S.Sp.arrow(col(M3R2, j), [VC.a, VC.b, VC.c][j], '第' + (j + 1) + '欄'));
    cap('名字的由來：矩陣的欄', '告訴你基底向量 î、ĵ、k̂ 落在哪裡');
  },
  async (tok, S) => { // @556
    ok(eqV(col(M3R2, 2), addv(col(M3R2, 0), col(M3R2, 1))), -3.4, 4.8, 'column space = 欄的 span（第 3 欄 = 第 1 + 第 2 欄）✓');
    cap('變換後基底向量的 span = 所有輸出', 'column space 就是欄的 span');
  },
  async (tok, S) => { // @564
    sm('rank = column space 的維度', -3.4, 4.2);
    cap('更精確的 rank 定義', 'column space 的維度');
  },
  async (tok, S) => { // @570
    sm('rank = 欄數：full rank', -3.4, 3.6);
    cap('rank 最大、等於欄數時', '叫做 full rank');
  },
]);

const Q3 = subspaces(M3R2), Q31 = subspaces(M3R1);
scene('vsB-i-null', '3B1B 7：null space（kernel）：被壓到原點的向量', [
  async (tok, S) => { // @578
    hd('零向量一定在 column space 裡', TX3, 7.2);
    S.G = plane2(PX, PY, PS, 5, { names: false, ghost: true }); S.o = S.G.dot([0, 0], VC.r, 0.13);
    cap('零向量一定在 column space', '線性變換必須讓原點保持不動');
  },
  async (tok, S) => { // @587
    await S.G.morph(tok, 1400, AI); await S.G.morph(tok, 900, ID2);
    sm('full rank：只有零向量會落在原點', TX3, 6.5);
    cap('full rank 的變換', '只有零向量本身會落在原點');
  },
  async (tok, S) => { // @592
    sm('不是 full rank：會有一大群向量落在零', TX3, 5.9);
    cap('不是 full rank 的矩陣', '壓到更低維，會有很多向量落在零');
  },
  async (tok, S) => { // @602
    S.ns = [-1.5, -1, -0.5, 0.5, 1, 1.5].map((k) => S.G.vec(scl(SGN, k), VC.r, '', { move: true }));
    lineThrough(S.G, SGN, '#f0b3b3', 5.5, 0.02);
    await S.G.morph(tok, 2200, SG);
    ok(isZero(mulMV(SG, SGN)), TX3, 5.2, 'A·(−2, 1) = 0：整條線被壓到原點 ✓');
    cap('2 維被壓成一條線', '另一個方向的整條線全被壓到原點');
  },
  async (tok, S) => { // @611
    ok(Q3.null.length === 1, TX3, 4.5, '3 維壓成平面（rank 2）→ 一條線（' + vstr(Q3.null[0]) + ' 方向）落在原點 ✓');
    cap('3 維壓成平面', '也有一整條線的向量落在原點');
  },
  async (tok, S) => { // @620
    ok(Q31.null.length === 2, TX3, 3.8, '3 維壓成一條線（rank 1）→ 一整個平面落在原點 ✓');
    cap('3 維壓成一條線', '那就有一整個平面的向量落在原點');
  },
  async (tok, S) => { // @633
    hot('落在原點的向量集合：null space（kernel）', TX3, 3.0);
    cap('這些落在原點的向量', '叫做 null space，或 kernel');
  },
  async (tok, S) => { // @645
    sm('v = 0 時：null space = Ax = 0 的所有解', TX3, 2.3);
    cap('方程組的角度', 'v 是零向量時，null space 給出所有的解');
  },
  async (tok, S) => { // @662
    pl('有逆變換 → 用 A⁻¹ 解', TX3, 1.6);
    cap('總結：變換有逆', '就用逆來解方程組');
  },
  async (tok, S) => { // @673
    pl('column space → 判斷「有沒有解」', TX3, 1.0);
    cap('沒有逆時：column space', '告訴我們解存不存在');
  },
  async (tok, S) => { // @678
    pl('null space → 所有解長什麼樣子', TX3, 0.4);
    cap('null space', '告訴我們所有解的集合長什麼樣');
  },
]);

// ════════ TgKwz5Ikpc8（3Blue1Brown 第 16 集：Abstract vector spaces） ════════
const AV = [2, 1], AB1 = [1, 1], AB2 = [-1, 1];
const ACO = (() => { const M = [[AB1[0], AB2[0]], [AB1[1], AB2[1]]]; return mulMV(inv2(M), AV); })();
const ff = (x) => Math.sin(x) + 0.3, gg = (x) => 0.15 * x - 0.4;
const dcoef = (c) => c.slice(1).map((a, i) => a * (i + 1));
const padc = (c, n = 8) => { const o = new Array(n).fill(0); c.forEach((a, i) => { if (i < n) o[i] = a; }); return o; };
const polyStr = (c) => { let s = ''; for (let k = c.length - 1; k >= 0; k--) { const a = c[k]; if (!a) continue; const t = (Math.abs(a) === 1 && k ? '' : Math.abs(a)) + (k ? 'x' + (k > 1 ? '⁰¹²³⁴⁵⁶⁷⁸⁹'[k] : '') : ''); s += s ? (a > 0 ? ' + ' : ' − ') + t : (a < 0 ? '−' : '') + t; } return s || '0'; };
const DM = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (j === i + 1 ? j : 0)));
const PQ = [5, 4, 5, 1], DPQ = mulMV(DM, padc(PQ));
const DM_OK = DM.every((_, j) => eqV(col(DM, j), padc(dcoef(padc([], j + 1).map((_, k) => (k === j ? 1 : 0)))))) && eqV(DPQ, padc(dcoef(PQ)));
scene('vsB-a-what', '3B1B 16：向量到底是什麼？', [
  async (tok, S) => { // @22
    hd('向量到底是什麼？', TX3, 7.2);
    S.G = plane2(PX, PY, PS, 4, { names: false }); S.v = S.G.vec(AV, VC.a, 'v');
    cap('回到第一集的問題', '向量到底是什麼？');
  },
  async (tok, S) => { // @23
    pl('① 平面上的箭頭，座標只是為了方便？', TX3, 6.4);
    cap('2 維向量本質上是平面上的箭頭', '只是方便起見用座標描述？');
  },
  async (tok, S) => { // @31
    S.c = mtx([[2], [1]], TX3 - 0.6, 5.7, 3); pl('② 一對實數，剛好能畫成箭頭？', TX3 + 0.8, 5.5);
    cap('還是本質上是一對實數', '只是剛好可以畫成箭頭？');
  },
  async (tok, S) => { // @38
    hot('③ 還是：兩者都是更深層東西的表現？', TX3, 4.7);
    cap('或者兩者都只是', '更深層概念的不同樣貌？');
  },
  async (tok, S) => { // @48
    S.b = bars([3, -1, 2, 0.5], TX3 - 0.8, 3.2, 0, VC.c, { k: 0.3, gap: 0.45 }); sm('4 維向量 = 4 個數（示意）', TX3 + 0.6, 2.4);
    cap('當成一串數字很清楚', '4 維、100 維向量都變得具體可操作');
  },
  async (tok, S) => { // @65
    S.G.vec(AB1, VC.d, 'b₁'); S.G.vec(AB2, VC.r, 'b₂');
    ok(eqV(addv(scl(AB1, ACO[0]), scl(AB2, ACO[1])), AV), TX3, 1.6, '同一支 v：標準座標 (2, 1)；用 b₁、b₂ 是 ' + vstr(ACO) + ' ✓');
    cap('但熟練的人會覺得：空間獨立於座標存在', '座標取決於你選哪組基底，有點任意');
  },
  async (tok, S) => { // @84
    sm('determinant、eigenvector：不管選什麼座標都一樣', TX3, 1.0);
    cap('determinant、eigenvector 這些核心概念', '跟座標系的選擇無關');
  },
  async (tok, S) => { // @117
    note('那數學家說的「空間」到底是什麼？', TX3, 0.3);
    cap('所以數學家說「空間」', '到底是什麼意思？');
  },
]);

const FP = { X: -0.6, Y: 3.2, sx: 0.5, sy: 0.9 };
scene('vsB-a-func', '3B1B 16：函數也是向量', [
  async (tok, S) => { // @133
    hd('函數：也是一種向量', 0, 7.2);
    S.F = fplot(FP.X, FP.Y, FP.sx, FP.sy, -6, 6, { ymin: -2, ymax: 2.3 });
    cap('既不是箭頭、也不是數字串', '卻有向量的特質：函數');
  },
  async (tok, S) => { // @139
    S.F.curve(ff, VC.a); S.F.curve(gg, VC.b); sm('f（示意）', FP.X + 5 * FP.sx, FP.Y + 2.1 * FP.sy); sm('g', FP.X + 6.2 * FP.sx, FP.Y + 0.6 * FP.sy);
    cap('兩個函數 f、g 可以相加', '得到新函數 f + g');
  },
  async (tok, S) => { // @156
    const x0 = -4, w = (y) => S.F.w(x0, y);
    S.m = [dotBall(VC.a, 0.09), dotBall(VC.b, 0.09)]; S.m[0].position.copy(w(ff(x0))); S.m[1].position.copy(w(gg(x0)));
    S.F.curve(() => 0, '#6e5f49'); sm('x = −4', w(-1.9).x, w(-1.9).y);
    cap('在某個輸入，例如 −4', 'f + g 的輸出 = f(−4) + g(−4)');
  },
  async (tok, S) => { // @165
    const c = S.F.curve(ff, VC.d); await anim(tok, 1500, (u) => c.setF((x) => ff(x) + u * gg(x)));
    const d = dotBall(VC.d, 0.11); d.position.copy(S.F.w(-4, ff(-4) + gg(-4)));
    ok(near((ff(-4) + gg(-4)), ff(-4) + gg(-4)), -4.4, 6.4, '(f + g)(−4) = ' + ff(-4).toFixed(2) + ' + (' + gg(-4).toFixed(2) + ') = ' + (ff(-4) + gg(-4)).toFixed(2) + ' ✓');
    cap('一般來說：(f + g)(x) = f(x) + g(x)', '');
  },
  async (tok, S) => { // @181
    for (let x = -5.5; x <= 5.5; x += 1) S.F.seg = rod('#7fc8a9', 0.02).setW(S.F.w(x, 0), S.F.w(x, ff(x) + gg(x)));
    sm('像逐個座標相加，只是有無限多個座標', 0, 0.6);
    cap('就像向量逐個座標相加', '只是現在有無限多個座標');
  },
  async (tok, S) => { // @192
    const c = S.F.curve(ff, VC.c); await anim(tok, 1400, (u) => c.setF((x) => (1 + u) * ff(x))); sm('2f', FP.X + 1.6 * FP.sx, FP.Y + 2.3 * FP.sy);
    cap('函數乘一個實數', '把所有輸出都乘上那個數');
  },
  async (tok, S) => { // @200
    sm('同樣：逐個座標乘上那個數', 0, 0.0);
    cap('一樣類似向量逐座標乘純量', '只是座標有無限多個');
  },
  async (tok, S) => { // @209
    note('能相加、能縮放 → 線性代數的工具也能用在函數上', 0, -0.6);
    cap('向量能做的只有相加和縮放', '所以線性代數的工具應該也能用在函數上');
  },
]);

const LIN = [[1, 1], [0.5, 1.5]];
const PF = [0, 0, 1], PG = [0, 0, 0, 1];   // x²、x³（示意）
scene('vsB-a-lin', '3B1B 16：線性的正式定義：可加性與齊次性', [
  async (tok, S) => { // @227
    hd('函數的線性變換：吃進函數、吐出函數', 0, 7.2);
    cap('函數也有線性變換', '輸入一個函數、輸出另一個函數');
  },
  async (tok, S) => { // @240
    S.F = fplot(-4.6, 3.0, 0.9, 0.35, -1.8, 1.8, { ymin: -3, ymax: 6 });
    S.F.curve((x) => x ** 3, VC.a); S.F.curve((x) => 3 * x * x, VC.d);
    sm('x³（藍）→ d/dx → 3x²（綠）（示意）', -4.6, 0.4);
    cap('熟悉的例子：微積分的微分', '把一個函數變成另一個函數');
  },
  async (tok, S) => { // @248
    sm('這時也叫 operator（運算子）', 2.6, 6.4);
    cap('在這種情境常叫 operator', '意思和 transformation 一樣');
  },
  async (tok, S) => { // @256
    pl('對函數來說，「線性」是什麼意思？', 2.6, 5.8);
    cap('問題：函數的變換什麼時候算「線性」？', '');
  },
  async (tok, S) => { // @277
    S.h = hot('線性 = 兩個性質', 2.6, 5.1);
    cap('正式定義：滿足兩個性質', '可加性（additivity）、齊次性（scaling）');
  },
  async (tok, S) => { // @286
    pl('可加性：L(v + w) = L(v) + L(w)', 2.6, 4.4);
    cap('可加性：先加再變換', '= 先各自變換再相加');
  },
  async (tok, S) => { // @305
    pl('齊次性：L(c v) = c L(v)', 2.6, 3.8);
    cap('齊次性：先縮放再變換', '= 先變換再縮放');
  },
  async (tok, S) => { // @322
    sm('→ 保持向量加法與純量乘法', 2.6, 3.2);
    cap('常聽到的說法', '線性變換保持加法與純量乘法');
  },
  async (tok, S) => { // @332
    gone(S.F); S.G = plane2(-3.4, 3.4, 0.45, 4, { names: false, ghost: true }); await S.G.morph(tok, 1800, LIN);
    sm('2 維的樣子：格線保持平行、等距（示意）', -3.4, 0.9);
    cap('以前說的「格線平行且等距」', '就是這兩個性質在 2 維平面的樣子');
  },
  async (tok, S) => { // @345
    const v = [2, 1], Lv = mulMV(LIN, v);
    S.G.vec([1, 0], VC.d, 'L(î)', { move: true }); S.G.vec([0, 1], VC.r, 'L(ĵ)', { move: true }); S.G.vec(v, VC.a, 'L(v)', { move: true });
    ok(eqV(Lv, addv(scl(col(LIN, 0), 2), col(LIN, 1))), 2.6, 2.4, 'v = 2î + ĵ → L(v) = 2L(î) + L(ĵ) ✓');
    cap('重要結果：線性變換完全由基底向量的去處決定', '這也是矩陣乘向量能成立的原因');
  },
  async (tok, S) => { // @378
    sm('微分也滿足這兩個性質', 2.6, 1.7);
    cap('微積分學生天天在用', '微分是可加的、也有齊次性');
  },
  async (tok, S) => { // @388
    const l = dcoef(addv(padc(PF, 4), padc(PG, 4))), r = addv(padc(dcoef(PF), 3), padc(dcoef(PG), 3));
    ok(eqV(l, r), 2.6, 1.0, '(x² + x³)′ = 2x + 3x² = (x²)′ + (x³)′ ✓');
    cap('兩個函數相加再微分', '= 各自微分再相加');
  },
  async (tok, S) => { // @400
    const l = dcoef(scl(padc(PG, 4), 5)), r = scl(dcoef(padc(PG, 4)), 5);
    ok(eqV(l, r), 2.6, 0.3, '(5x³)′ = 15x² = 5·(x³)′ ✓');
    cap('先縮放再微分', '= 先微分再縮放');
  },
]);

scene('vsB-a-deriv', '3B1B 16：用矩陣表示微分', [
  async (tok, S) => { // @410
    hd('用矩陣描述微分', 0, 7.2);
    cap('把類比做到底', '用一個矩陣描述微分');
  },
  async (tok, S) => { // @418
    sm('函數空間通常是無限維', 0, 6.6);
    cap('有點難：函數空間通常是無限維', '');
  },
  async (tok, S) => { // @424
    S.p = pl('只看多項式：x² + 3x + 5、4x⁷ − 5x²', -3.4, 6.0);
    cap('只看多項式', '每個多項式有限項，但次數可以任意高');
  },
  async (tok, S) => { // @442
    sm('先要選一組基底，才有座標', -3.4, 5.4);
    cap('要給座標，先選基底', '');
  },
  async (tok, S) => { // @458
    S.bs = hot('b₀(x) = 1', -3.4, 4.8);
    cap('自然的選擇：x 的次方', '第一個基底函數是常數 1');
  },
  async (tok, S) => { // @464
    txt(S.bs, 'b₀ = 1、b₁ = x、b₂ = x²、b₃ = x³、…');
    cap('b₁ = x、b₂ = x²、b₃ = x³……', '角色就像 î、ĵ、k̂');
  },
  async (tok, S) => { // @482
    sm('次數沒有上限 → 基底有無限多個', -3.4, 4.2);
    cap('多項式次數沒有上限', '所以基底有無限多個，座標也無限多');
  },
  async (tok, S) => { // @495
    const c = [5, 3, 1];
    S.c1 = mtx(padc(c).map((a) => [a]), -6.4, 3.4, 3, 0.4); sm('x² + 3x + 5', -6.0, 0.0);
    ok(polyStr(c) === 'x² + 3x + 5', -3.4, 3.4, '→ (5, 3, 1, 0, 0, …) ✓');
    cap('x² + 3x + 5 的座標', '(5, 3, 1)，後面全是 0');
  },
  async (tok, S) => { // @520
    const c = [0, 0, -5, 0, 0, 0, 0, 4];
    S.c2 = mtx(padc(c).map((a) => [a]), -4.6, 3.4, 3, 0.4); sm('4x⁷ − 5x²', -4.2, 0.0);
    ok(polyStr(c) === '4x⁷ − 5x²', -3.4, 2.8, '→ (0, 0, −5, 0, 0, 0, 0, 4, …) ✓');
    cap('4x⁷ − 5x² 的座標', '(0, 0, −5, 0, 0, 0, 0, 4)，後面全是 0');
  },
  async (tok, S) => { // @543
    fresh(CAM[0], CAM[1]); hd('微分 = 一個無限大的矩陣（只畫左上 8 × 8）', 0, 7.2);
    S.D = mgrid(DM, -5.6, 6.0, 0, { color: (i, j) => (DM[i][j] ? VC.g : '#e7dcc8'), size: 0.4, gap: 0.47 });
    cap('在這組座標下，微分是一個無限大的矩陣', '大部分是 0');
  },
  async (tok, S) => { // @553
    for (let i = 0; i < 7; i++) glow(S.D.c[i][i + 1], GOLD);
    sm('對角線右上一格：1, 2, 3, 4, …', -3.9, 2.0);
    cap('正整數沿著「偏一格的對角線」排下去', '');
  },
  async (tok, S) => { // @565
    S.x = mgrid(padc(PQ).map((a) => [a]), -1.4, 6.0, 0, { color: () => VC.a, size: 0.4, gap: 0.47 }); sm('x³ + 5x² + 4x + 5', -1.0, 1.9);
    pl('=', -0.6, 4.4); S.out = mgrid(padc([]).map(() => ['']), 0.2, 6.0, 0, { color: () => VC.pale, size: 0.4, gap: 0.47 });
    cap('拿 x³ + 5x² + 4x + 5 的座標', '放在矩陣右邊相乘');
  },
  async (tok, S) => { // @580
    S.D.row(0, GOLD); glow(S.x.c[1][0], GOLD); S.out.set(0, 0, DPQ[0]); tint(S.out.c[0][0], VC.d);
    sm('第 1 個：1 × 4 = ' + DPQ[0] + '　← (4x)′ = 4', 2.8, 5.6);
    cap('結果第一個座標只來自 1 × 4', '常數項 4：因為 4x 微分是 4');
  },
  async (tok, S) => { // @595
    S.D.clearGlow(); glow(S.x.c[1][0], null); S.D.row(1, GOLD); glow(S.x.c[2][0], GOLD); S.out.set(1, 0, DPQ[1]); tint(S.out.c[1][0], VC.d);
    sm('第 2 個：2 × 5 = ' + DPQ[1] + '　← (5x²)′ = 10x', 2.8, 5.0);
    cap('第二個座標：2 × 5 = 10', '對應 5x² 微分得 10x');
  },
  async (tok, S) => { // @611
    S.D.clearGlow(); glow(S.x.c[2][0], null); S.D.row(2, GOLD); glow(S.x.c[3][0], GOLD);
    for (let i = 2; i < 8; i++) { S.out.set(i, 0, DPQ[i]); tint(S.out.c[i][0], i === 2 ? VC.d : '#e7dcc8'); }
    ok(eqV(DPQ, padc(dcoef(PQ))), 2.8, 4.4, '第 3 個：3 × 1 = 3，之後全 0 → 3x² + 10x + 4 ✓');
    cap('第三個：3 × 1 = 3', '對應 x³ 微分得 3x²；之後全是 0');
  },
  async (tok, S) => { // @626
    S.D.clearGlow(); glow(S.x.c[3][0], null);
    sm('能這樣做，是因為微分是線性的', 2.8, 3.6);
    cap('之所以可以，是因為微分是線性的', '');
  },
  async (tok, S) => { // @631
    for (let j = 1; j < 8; j++) { S.D.col(j, GOLD); await wt(tok, 200); S.D.clearGlow(); }
    ok(DM_OK, 2.8, 2.9, '第 j 欄 = (xʲ)′ = j·xʲ⁻¹ 的座標 ✓（逐欄驗證）');
    cap('怎麼做出這個矩陣？', '把每個基底函數微分，結果的座標放進對應的欄');
  },
  async (tok, S) => { // @660
    note('矩陣乘向量、微分：其實是同一家族', 2.8, 2.1);
    cap('矩陣乘向量和微分', '看似毫不相干，其實是同一家族');
  },
]);

const AXIOMS = ['1. u + (v + w) = (u + v) + w', '2. v + w = w + v', '3. 有 0：0 + v = v', '4. 有 −v：v + (−v) = 0', '5. a(bv) = (ab)v', '6. 1·v = v', '7. a(v + w) = av + aw', '8. (a + b)v = av + bv'];
scene('vsB-a-axioms', '3B1B 16：向量空間的八條公理', [
  async (tok, S) => { // @671
    hd('箭頭的概念，在函數世界都有對應', 0, 7.2);
    code(['dot product   ↔  inner product', 'eigenvector   ↔  eigenfunction'], -2.2, 6.4, 0.55);
    cap('dot product、eigenvector 在函數世界都有對應', '名字不同：inner product、eigenfunction');
  },
  async (tok, S) => { // @688
    S.q = hot('那「向量」到底是什麼？', 0, 5.0);
    cap('回到「向量是什麼」', '數學裡有很多「像向量」的東西');
  },
  async (tok, S) => { // @696
    [['箭頭', -4.4], ['數字串', -1.5], ['函數', 1.5], ['……', 4.4]].forEach(([t, x]) => bub(t, x, 4.2));
    cap('只要有合理的「縮放」和「相加」', '箭頭、數字串、函數……工具都能用');
  },
  async (tok, S) => { // @733
    pl('這些「像向量的東西」的集合 = 向量空間（vector space）', 0, 3.4);
    cap('這些集合叫做向量空間', '');
  },
  async (tok, S) => { // @749
    fresh(CAM[0], CAM[1]); hd('一份規則清單：加法和縮放必須遵守', 0, 7.2);
    cap('數學家的做法', '列出加法和縮放必須遵守的規則');
  },
  async (tok, S) => { // @756
    S.ax = code(AXIOMS, -4.6, 6.3, 0.5);
    cap('這些規則叫公理（axioms）', '現代線性代數有 8 條');
  },
  async (tok, S) => { // @770
    for (let k = 0; k < 8; k++) { S.ax.hl(k); await wt(tok, 220); } S.ax.hl(-1);
    cap('其實就是一份檢查清單', '確定加法和縮放的行為合乎預期');
  },
  async (tok, S) => { // @779
    pl('公理 = 數學家 ↔ 使用者之間的介面', 2.6, 6.0);
    cap('公理不是自然法則', '是數學家和應用者之間的介面');
  },
  async (tok, S) => { // @792
    sm('有人定義了奇怪的空間（例如 π 生物）→ 先逐條檢查', 2.6, 5.3);
    cap('有人發明一種奇怪的向量空間', '只要逐條檢查公理，就能套用線性代數的結果');
  },
  async (tok, S) => { // @808
    sm('數學家只要用公理證明 → 所有空間都能用', 2.6, 4.6);
    cap('數學家只用公理證明結果', '不必去想所有可能的奇怪空間');
  },
  async (tok, S) => { // @842
    sm('所以課本用「可加性 + 齊次性」定義線性變換', 2.6, 3.9);
    cap('所以幾乎每本課本', '都用可加性和齊次性定義線性變換，而不是格線');
  },
  async (tok, S) => { // @862
    hot('數學家的答案：向量長什麼樣子不重要', 2.6, 3.1);
    cap('數學家對「向量是什麼」的回答', '忽略這個問題：形式不重要，只要符合規則');
  },
  async (tok, S) => { // @882
    sm('就像「3」：抽象化所有「三個東西」', 2.6, 2.4);
    cap('就像問「3」到底是什麼', '它是所有「三個東西」的抽象');
  },
  async (tok, S) => { // @907
    note('但學習時，先從具體的 2 維箭頭開始最好', 2.6, 1.6);
    cap('但學的時候先從具體、看得見的開始', '例如原點出發的 2 維箭頭');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { gen++; },
  };
}
