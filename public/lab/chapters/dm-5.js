// 離散數學 第5章：計數原理（加法／乘法原理、排列 P(n,r)、組合 C(n,r)、重複組合（星棒法）、二項式定理、鴿籠原理）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 影片場景依照：
//   DBugSTeX1zw〈PERMUTATIONS and COMBINATIONS Review〉（TrevTutor）：TALES、BARBARIC、格子路徑 (0,0)→(4,4)、
//     10 題選 7 題的三種限制、x1+x2+x3 = 12、xi ≥ 2、8 顆球放 4 個箱子、x4 必須是奇數。
//   2-mxYrCNX60〈Pigeonhole Principle〉（TrevTutor）：4 隻鴿子 3 個籠子、⌈m/n⌉、朋友數相同、366 人生日、
//     1..20 選 11 個必有兩數和為 21、8×8 方格 17 點。
// 加法／乘法原理樹、P 與 C 的關係、二項式定理與巴斯卡三角形：依 Rosen 第 6 章補的課本場景。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let mtok = 0, busy = false;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  const Pn = (n, r) => (r < 0 || r > n ? 0 : fact(n) / fact(n - r));
  const Cb = (n, r) => { if (r < 0 || r > n || n < 0) return 0; let x = 1; for (let i = 1; i <= r; i++) x = x * (n - r + i) / i; return Math.round(x); };
  const COL = { ball: '#4b9ee2', pick: '#e55a9b', gold: '#c08a1f', gray: '#d8cfc0', green: '#2fc092', red: '#d64545', purple: '#9b7ef4', orange: '#dd8238', teal: '#31aab0', ink: '#6e5f49', bird: '#8b9bb4' };
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';

  // ───────────────────────── 共用小工具 ─────────────────────────
  function fresh(pos, look) { stopTimer(); mtok++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); } else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function ball(text, color, r, x, y, z = 0, dropH = 0) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    m.castShadow = true;
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); } else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const dropOn = (o, x, y, z = 0) => lab.dropTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { const mat = m.userData.mat || m.material; if (mat) mat.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { const mat = m.userData.mat || m.material; if (mat) mat.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  function line(x1, y1, z1, x2, y2, z2, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  // a thick rod between two points (path segments, friendship edges)
  function rod(a, b, color, r = 0.07) {
    const n = b.clone().sub(a); const L = n.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.position.copy(a).addScaledVector(n, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), n.normalize());
    m.castShadow = true; lab.world.add(m); return m;
  }
  async function tween(w, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  // waits: scenes use beat(tok), modes use a token that dies when the mode / scene changes
  async function wait(my, ms) { await sleep(ms); if (my !== mtok) throw new Error('stale'); }
  function guard(fn) {
    return async (...a) => {
      if (busy) { log('上一個動畫還在跑，等它跑完再按。', true); return; }
      busy = true; const my = mtok;
      try { await fn((ms) => wait(my, ms), ...a); } catch (e) { if (e.message !== 'stale') console.error(e); } finally { if (my === mtok) busy = false; }
    };
  }
  // pigeon = body + head + beak; a crate = open box the pigeons drop into
  function pigeon(color = COL.bird) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), mat); body.scale.set(1.3, 0.9, 0.95); body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat); head.position.set(0.2, 0.15, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), new THREE.MeshStandardMaterial({ color: '#e0a030' }));
    beak.rotation.z = -Math.PI / 2; beak.position.set(0.32, 0.14, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), mat); tail.position.set(-0.27, 0.04, 0); tail.rotation.z = 0.3;
    g.add(body, head, beak, tail); g.userData.mat = mat;
    return g;
  }
  function crate(x, z, w = 1.3, d = 1.3, h = 0.4, color = '#c9a878', name = '') {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const add = (sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(px, py, pz); m.receiveShadow = true; m.castShadow = true; g.add(m); };
    add(w, 0.06, d, 0, 0.03, 0);
    add(w, h, 0.06, 0, h / 2, -d / 2); add(w, h * 0.55, 0.06, 0, h * 0.275, d / 2);
    add(0.06, h, d, -w / 2, h / 2, 0); add(0.06, h, d, w / 2, h / 2, 0);
    g.position.set(x, 0, z); g.userData.mat = mat; lab.world.add(g);
    if (name) { const l = lab.label(name, 'idx'); l.position.set(0, -0.05, d / 2 + 0.35); g.add(l); g.userData.lbl = l; }
    return g;
  }
  // k-th thing inside a crate: 4 per layer
  const slotIn = (cx, cz, k, s = 0.28, dy = 0.36, y0 = 0.22) => V3(cx + (k % 2 ? s : -s), y0 + Math.floor(k / 4) * dy, cz + (Math.floor(k / 2) % 2 ? s : -s));

  // ───────────────────────── 乘法／加法原理樹 ─────────────────────────
  // stages = [n1, n2, …]; names[d][j] = 第 d 步第 j 個選項
  async function growTree(w, stages, names, pace = 900) {
    const L = stages.reduce((a, b) => a * b, 1);
    const levels = stages.length;
    const x0 = -6, x1 = 4.4, dx = (x1 - x0) / levels, yTop = 7.0, yBot = 0.6;
    const sp = L > 1 ? (yTop - yBot) / (L - 1) : 0;
    ball('', COL.ink, 0.25, x0, (yTop + yBot) / 2, 0);
    tag('開始', 'idx', x0, (yTop + yBot) / 2 - 0.5, 0);
    let prev = [{ x: x0, y: (yTop + yBot) / 2, path: '' }];
    let cnt = 1;
    for (let d = 0; d < levels; d++) {
      cnt *= stages[d];
      const span = L / cnt, x = x0 + (d + 1) * dx, nodes = [];
      const r = Math.max(0.07, Math.min(0.22, sp * span * 0.32));
      for (let j = 0; j < cnt; j++) {
        const y = yTop - (j * span + (span - 1) / 2) * sp;
        const par = prev[Math.floor(j / stages[d])];
        line(par.x, par.y, 0, x, y, 0, '#b9a684');
        const nm = names ? names[d][j % stages[d]] : String.fromCharCode(97 + d) + (j % stages[d] + 1);
        const m = ball('', [COL.ball, COL.pick, COL.green, COL.orange][j % stages[d] % 4], r, x, y, 0);
        if (cnt <= 14) tag(nm, 'idx', x + 0.15, y + r + 0.22, 0);
        nodes.push({ x, y, m, path: par.path + nm });
      }
      say('第 ' + (d + 1) + ' 步有 ' + stages[d] + ' 種選法', '目前分支數 = ' + stages.slice(0, d + 1).join(' × ') + ' = ' + cnt);
      setState('乘法原理', stages.map((s, i) => ['第 ' + (i + 1) + ' 步', i <= d ? s + ' 種' : '…']), '分支數 = ' + stages.slice(0, d + 1).join(' × ') + ' = <span class="ok">' + cnt + '</span>');
      prev = nodes;
      await w(pace);
    }
    tag('共 ' + L + ' 片葉子', 'ptr alt', x1 + 1.4, (yTop + yBot) / 2, 0);
    return prev;
  }
  const tr = { s: [3, 2, 2] };
  function enterTree() {
    fresh([0, 3.8, 14.5], [-0.6, 3.8, 0]);
    controls('第 1 步 <input id="tA" type="number" min="1" max="4" value="' + tr.s[0] + '"> 第 2 步 <input id="tB" type="number" min="1" max="4" value="' + tr.s[1] + '"> 第 3 步 <input id="tC" type="number" min="0" max="4" value="' + tr.s[2] + '">'
      + '<button class="primary" id="tGrow">乘法：長出樹</button><button id="tSum">加法：三堆擇一</button>');
    on('tGrow', guard(async (w) => {
      const s = ['tA', 'tB', 'tC'].map((id) => Math.max(0, Math.min(4, Number($(id).value) || 0)));
      const st = s[2] ? s : s.slice(0, 2);
      if (st.some((v) => v < 1)) { log('每一步至少要有 1 種選法（第 3 步填 0 代表只有兩步）。', true); return; }
      tr.s = s; lab.clear(); lab.frameCamera([0, 3.8, 14.5], [-0.6, 3.8, 0]);
      const leaves = await growTree(w, st, null, 700);
      log('乘法原理：分 ' + st.length + ' 步、每步選法數固定 → ' + st.join(' × ') + ' = ' + leaves.length + ' 種。');
    }));
    on('tSum', guard(async (w) => {
      const s = ['tA', 'tB', 'tC'].map((id) => Math.max(0, Math.min(4, Number($(id).value) || 0)));
      lab.clear(); lab.frameCamera([0, 6, 12], [0, 0.8, 0]);
      const all = [];
      s.forEach((n, g) => { tag(['A 堆', 'B 堆', 'C 堆'][g] + '：' + n, 'ptr', -4 + g * 4, 0.1, 1.6); for (let i = 0; i < n; i++) all.push(cube('', [COL.ball, COL.pick, COL.green][g], [0.6, 0.5, 0.6], -4 + g * 4 + (i % 2 ? 0.35 : -0.35), 0.25 + Math.floor(i / 2) * 0.55, 0, 3)); });
      say('三堆互不重疊，只能挑「一個」', s.join(' + ') + ' = ?');
      await w(1600);
      all.forEach((m, i) => move(m, (i - (all.length - 1) / 2) * 0.7, 0.25, -1.4));
      await w(1200);
      const tot = s.reduce((a, b) => a + b, 0);
      say('合成一排：' + tot + ' 種', '加法原理：互斥的情況相加');
      setState('加法原理', [['A 堆', s[0]], ['B 堆', s[1]], ['C 堆', s[2]]], '挑一個 = ' + s.join(' + ') + ' = <span class="ok">' + tot + '</span>');
      log('加法原理：工作可以用 A 或 B 或 C 其中一種方式完成，且彼此不重疊 → 方法數相加。');
    }));
    setState('乘法原理 vs 加法原理', [['乘法', '分步驟、每步都要做 → 相乘'], ['加法', '分情況、只做其中一種 → 相加']], '設定每一步的選法數，再按按鈕');
    log('乘法原理：一件事分成連續幾步完成，第 i 步有 nᵢ 種做法 → n₁ × n₂ × … 種。');
  }

  // ───────────────────────── 排列 vs 組合 ─────────────────────────
  const pk = { n: 5, r: 3, balls: [], chosen: [] };
  const LET = 'ABCDEFGH';
  const pkX = (i, n) => (i - (n - 1) / 2) * 1.2;
  const slotX = (k, r) => (k - (r - 1) / 2) * 1.45;
  function enterPick() {
    fresh([0, 7, 12], [0, 0.6, 0]);
    pk.balls = []; pk.chosen = [];
    for (let i = 0; i < pk.n; i++) pk.balls.push(ball(LET[i], COL.ball, 0.4, pkX(i, pk.n), 0.4, -2, 0));
    for (let k = 0; k < pk.r; k++) { ctx.tile(V3(slotX(k, pk.r), 0.04, 1.6), 1.2, 1.2); tag('第 ' + (k + 1) + ' 格', 'idx', slotX(k, pk.r), 0, 2.6); }
    controls('n = <input id="pN" type="number" min="2" max="8" value="' + pk.n + '"> r = <input id="pR" type="number" min="1" max="8" value="' + pk.r + '">'
      + '<button class="primary" id="pNext">挑下一個</button><button id="pAll">一次挑完</button><button id="pSet">不管順序（÷ r!）</button><button id="pReset">重來</button>');
    const reset = () => {
      const n = Math.max(2, Math.min(8, Number($('pN').value) || 5)), r = Math.max(1, Math.min(8, Number($('pR').value) || 3));
      if (r > n) { log('r 不能比 n 大：' + n + ' 個東西挑不出 ' + r + ' 個不同的。', true); return; }
      pk.n = n; pk.r = r; enterPick();
    };
    $('pN').onchange = reset; $('pR').onchange = reset; on('pReset', reset);
    on('pNext', () => pickNext());
    on('pAll', guard(async (w) => { while (pk.chosen.length < pk.r) { pickNext(); await w(450); } }));
    on('pSet', guard(async (w) => {
      if (pk.chosen.length < pk.r) { log('先把 ' + pk.r + ' 格都挑滿，才能討論「不管順序」。', true); return; }
      pk.chosen.forEach((m, k) => { const a = k / pk.r * Math.PI * 2; move(m, Math.cos(a) * 0.6, 0.4 + (k % 2) * 0.1, 1.6 + Math.sin(a) * 0.6); });
      await w(900);
      const P = Pn(pk.n, pk.r), C = Cb(pk.n, pk.r);
      say('同一組 {' + pk.chosen.map((m) => m.userData.lbl.element.textContent).join(', ') + '} 有 ' + pk.r + '! = ' + fact(pk.r) + ' 種排法', 'C(' + pk.n + ',' + pk.r + ') = P(' + pk.n + ',' + pk.r + ') ÷ ' + pk.r + '! = ' + P + ' ÷ ' + fact(pk.r) + ' = ' + C);
      log('組合：只在乎挑到誰。每一組被排列算了 r! 次 → C(n,r) = P(n,r) / r! = ' + C + '。');
      pkState(true);
    }));
    log('排列 P(n,r)：從 n 個不同的東西挑 r 個「排成一列」。先挑第 1 格、再第 2 格…');
    pkState(false);
  }
  function pickNext() {
    if (pk.chosen.length >= pk.r) { log('已經挑滿 ' + pk.r + ' 格了；按「不管順序」或「重來」。', true); return; }
    const rest = pk.balls.filter((m) => !pk.chosen.includes(m));
    const k = pk.chosen.length;
    const m = rest[rnd(rest.length)];
    pk.chosen.push(m); glow(m, GOLD); tint(m, COL.pick);
    move(m, slotX(k, pk.r), 0.45, 1.6);
    log('第 ' + (k + 1) + ' 格：還剩 ' + rest.length + ' 個可選，挑到 ' + m.userData.lbl.element.textContent);
    say('第 ' + (k + 1) + ' 格有 ' + rest.length + ' 種選法', Array.from({ length: k + 1 }, (_, i) => pk.n - i).join(' × '));
    pkState(false);
  }
  function pkState(set) {
    const P = Pn(pk.n, pk.r), C = Cb(pk.n, pk.r);
    setState('從 ' + pk.n + ' 個挑 ' + pk.r + ' 個', [['已挑', pk.chosen.length + ' / ' + pk.r], ['排列 P(n,r)', P], ['r!', fact(pk.r)], ['組合 C(n,r)', C]],
      'P(' + pk.n + ',' + pk.r + ') = ' + Array.from({ length: pk.r }, (_, i) => pk.n - i).join('×') + ' = n!/(n−r)! = ' + P
      + '<br>C(' + pk.n + ',' + pk.r + ') = P / r! = ' + (set ? '<span class="ok">' + C + '</span>' : C));
  }

  // ───────────────────────── 星棒法（重複組合） ─────────────────────────
  // x1 + … + xn = k，xi ≥ low：先每格放 low 個，剩下 free 個用 free 顆星星 + (n−1) 根棒子排一列
  const sb = { n: 3, k: 12, low: 0, idx: 0, bars: [] };
  function sbBuild(k, n, z = 0.6, y = 0.32) {
    const total = k + n - 1, sp = Math.min(0.85, 12.6 / Math.max(total, 1));
    const S = { k, n, total, sp, z, y, stars: [], bars: [], gl: [] };
    for (let i = 0; i < k; i++) S.stars.push(ball('', COL.gold, Math.min(0.28, sp * 0.36), 0, y + 3 + Math.random() * 2, z));
    for (let b = 0; b < n - 1; b++) S.bars.push(cube('', COL.ink, [Math.min(0.14, sp * 0.2), 1.1, 0.5], 0, 3.5, z));
    for (let b = 0; b < n; b++) S.gl.push(tag('', 'ptr', 0, 0, z + 1.1));
    S.stars.forEach((m) => lab.addBody(m)); S.bars.forEach((m) => lab.addBody(m));
    return S;
  }
  const sbPos = (S, i) => (i - (S.total - 1) / 2) * S.sp;
  // place stars / bars for composition comp (comp[b] stars in group b)
  function sbLayout(S, comp, drop = false, offs = null) {
    let slot = 0, si = 0;
    for (let b = 0; b < S.n; b++) {
      const first = slot;
      for (let c = 0; c < comp[b]; c++) { const x = sbPos(S, slot++); drop ? dropOn(S.stars[si++], x, S.y, S.z) : move(S.stars[si++], x, S.y, S.z); }
      const cx = comp[b] ? (sbPos(S, first) + sbPos(S, slot - 1)) / 2 : (b === 0 ? sbPos(S, 0) - S.sp * 0.6 : sbPos(S, first) - S.sp / 2);
      const shown = comp[b] + (offs ? offs[b] : 0);
      S.gl[b].position.set(b === S.n - 1 && !comp[b] ? sbPos(S, S.total - 1) + S.sp * 0.6 : cx, 0, S.z + 1.1);
      txt(S.gl[b], 'x' + (b + 1) + ' = ' + shown);
      if (b < S.n - 1) { const x = sbPos(S, slot++); drop ? dropOn(S.bars[b], x, 0.55, S.z) : move(S.bars[b], x, 0.55, S.z); }
    }
  }
  function compFromBars(p, total, n) { const c = []; let prev = -1; for (let i = 0; i < n - 1; i++) { c.push(p[i] - prev - 1); prev = p[i]; } c.push(total - 1 - prev); return c; }
  function nextBars(p, total) { // next (n−1)-combination of {0..total−1} in lexicographic order
    const m = p.length, q = [...p];
    for (let i = m - 1; i >= 0; i--) if (q[i] < total - m + i) { q[i]++; for (let j = i + 1; j < m; j++) q[j] = q[j - 1] + 1; return q; }
    return null;
  }
  function rankBars(p, total) { let q = Array.from({ length: p.length }, (_, i) => i), k = 1; while (q && q.join() !== p.join()) { q = nextBars(q, total); k++; } return k; }
  function enterStars() {
    fresh([0, 6.5, 11], [0, 0.6, 0]);
    controls('箱子 n = <input id="sN" type="number" min="2" max="5" value="' + sb.n + '"> 物品 k = <input id="sK" type="number" min="0" max="12" value="' + sb.k + '"> 每箱至少 <input id="sL" type="number" min="0" max="3" value="' + sb.low + '">'
      + '<button class="primary" id="sRand">隨機一種分法</button><button id="sNext">下一種</button><button id="sReset">重設</button>');
    const reset = () => {
      const n = Math.max(2, Math.min(5, Number($('sN').value) || 3)), k = Math.max(0, Math.min(12, Number($('sK').value) || 0)), low = Math.max(0, Math.min(3, Number($('sL').value) || 0));
      if (k - n * low < 0) { log('每箱至少 ' + low + ' 個 × ' + n + ' 箱 = ' + n * low + ' 個，比 k = ' + k + ' 還多：0 種分法。', true); return; }
      sb.n = n; sb.k = k; sb.low = low; enterStars();
    };
    ['sN', 'sK', 'sL'].forEach((id) => { $(id).onchange = reset; });
    on('sReset', reset);
    const free = sb.k - sb.n * sb.low;
    // pre-placed minimum: small orange cubes on a back shelf, one column per box
    if (sb.low) for (let b = 0; b < sb.n; b++) { tag('x' + (b + 1) + ' 先放 ' + sb.low, 'idx', (b - (sb.n - 1) / 2) * 2.2, 0, -2.4); for (let i = 0; i < sb.low; i++) cube('', COL.orange, [0.4, 0.35, 0.4], (b - (sb.n - 1) / 2) * 2.2 + (i - (sb.low - 1) / 2) * 0.5, 0.18, -1.8, 2); }
    const S = sbBuild(free, sb.n);
    sb.S = S; sb.bars = Array.from({ length: sb.n - 1 }, (_, i) => i); sb.idx = 1;
    const offs = Array(sb.n).fill(sb.low);
    sbLayout(S, compFromBars(sb.bars, S.total, sb.n), true, offs);
    const tot = Cb(free + sb.n - 1, sb.n - 1);
    const show = () => {
      const c = compFromBars(sb.bars, S.total, sb.n);
      sbLayout(S, c, false, offs);
      setState('x₁ + … + x' + sb.n + ' = ' + sb.k + (sb.low ? '，xᵢ ≥ ' + sb.low : '，xᵢ ≥ 0'), [['自由分配的星星', free], ['棒子', sb.n - 1], ['位置數', S.total], ['目前', '第 ' + sb.idx + ' / ' + tot + ' 種']],
        (sb.low ? '先每箱放 ' + sb.low + ' → 剩 ' + sb.k + ' − ' + sb.n * sb.low + ' = ' + free + '<br>' : '') + 'C(' + S.total + ', ' + (sb.n - 1) + ') = C(n+k−1, k) = <span class="ok">' + tot + '</span>');
    };
    on('sNext', () => { const q = nextBars(sb.bars, S.total); if (!q) { sb.bars = Array.from({ length: sb.n - 1 }, (_, i) => i); sb.idx = 1; log('列舉完一輪了，從頭開始。'); } else { sb.bars = q; sb.idx++; } show(); });
    on('sRand', () => {
      const pos = shuffle([...Array(S.total).keys()]).slice(0, sb.n - 1).sort((a, b) => a - b);
      sb.bars = pos; sb.idx = rankBars(pos, S.total);
      const c = compFromBars(pos, S.total, sb.n);
      log('棒子放在第 ' + pos.map((p) => p + 1).join('、') + ' 個位置 → ' + c.map((v, i) => 'x' + (i + 1) + '=' + (v + sb.low)).join('，'));
      show();
    });
    log('星棒法：k 顆一樣的星星 + (n−1) 根棒子排成一列，棒子把星星切成 n 段 = n 個箱子。');
    show();
  }

  // ───────────────────────── 巴斯卡三角形 ─────────────────────────
  const ps = { rows: [], n: -1 };
  const pX = (r, k) => (k - r / 2) * 0.9, pY = (r) => 7.0 - r * 0.8;
  function enterPascal() {
    fresh([0, 4, 13], [0, 3.6, 0]);
    ps.rows = []; ps.n = -1;
    controls('<button class="primary" id="pRow">長下一列</button><button id="pId">Pascal 恆等式</button><button id="pExp">展開 (x+y)ⁿ</button><button id="pClr">重來</button>');
    on('pRow', () => addRow());
    on('pClr', () => enterPascal());
    on('pId', () => {
      if (ps.n < 2) { log('至少要長到第 2 列，才有「上面兩格」可以相加。', true); return; }
      ps.rows.forEach((row) => row.forEach((m) => glow(m, null)));
      const r = 2 + rnd(ps.n - 1), k = 1 + rnd(r - 1);
      glow(ps.rows[r][k], GOLD); glow(ps.rows[r - 1][k - 1], GREEN); glow(ps.rows[r - 1][k], GREEN);
      say('C(' + r + ',' + k + ') = C(' + (r - 1) + ',' + (k - 1) + ') + C(' + (r - 1) + ',' + k + ')', Cb(r, k) + ' = ' + Cb(r - 1, k - 1) + ' + ' + Cb(r - 1, k));
      log('Pascal 恆等式：含第 n 個元素的組有 C(n−1,k−1) 種、不含的有 C(n−1,k) 種。');
    });
    on('pExp', () => {
      if (ps.n < 0) { log('先長出至少一列。', true); return; }
      const n = ps.n;
      const terms = Array.from({ length: n + 1 }, (_, k) => { const c = Cb(n, k), a = n - k; const xs = (a ? 'x' + (a > 1 ? sup(a) : '') : '') + (k ? 'y' + (k > 1 ? sup(k) : '') : ''); return (c > 1 ? c : '') + (xs || '1'); });
      say('(x+y)' + sup(n) + ' 的係數 = 第 ' + n + ' 列', terms.join(' + '));
      ps.rows[n].forEach((m) => glow(m, GOLD));
      log('二項式定理：(x+y)ⁿ = Σ C(n,k) xⁿ⁻ᵏ yᵏ。xⁿ⁻ᵏyᵏ 的係數 = 從 n 個括號挑 k 個出 y 的方法數。');
    });
    setState('巴斯卡三角形', [['第 r 列第 k 個', 'C(r, k)'], ['每列總和', '2ʳ']], '按「長下一列」');
    log('每一格 = 左上 + 右上；兩端都是 1。');
    addRow();
  }
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((d) => SUP[d]).join('');
  function addRow() {
    if (ps.n >= 8) { log('畫面放不下更多列了（第 8 列最大是 C(8,4) = 70）。', true); return; }
    const r = ++ps.n, row = [];
    for (let k = 0; k <= r; k++) {
      const v = Cb(r, k);
      row.push(cube(v, v === 1 ? COL.teal : ['#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238'][Math.min(3, Math.floor(Math.log2(v) / 2))], [0.78, 0.6, 0.6], pX(r, k), pY(r), 0, 2.5));
    }
    ps.rows.push(row);
    if (r > 0) tag('r=' + r, 'idx', -4.6, pY(r), 0); else tag('r=0', 'idx', -4.6, pY(0), 0);
    const sum = 2 ** r;
    setState('巴斯卡三角形（到第 ' + r + ' 列）', [['第 ' + r + ' 列', row.map((m) => m.userData.lbl.element.textContent).join(' ')], ['總和', sum + ' = 2' + sup(r)]], '每格 = 左上 + 右上 → C(n,k) = C(n−1,k−1) + C(n−1,k)');
    return row;
  }

  // ───────────────────────── 鴿籠原理 ─────────────────────────
  const pg = { m: 7, n: 3, birds: [], cnt: [], holes: [] };
  const holeX = (j, n) => (j - (n - 1) / 2) * Math.min(1.75, 12.5 / n);
  function enterPigeon() {
    fresh([0, 7.5, 11], [0, 0.8, 0]);
    pg.birds = []; pg.cnt = Array(pg.n).fill(0); pg.holes = [];
    for (let j = 0; j < pg.n; j++) pg.holes.push(crate(holeX(j, pg.n), 0, Math.min(1.4, 11 / pg.n), 1.4, 0.4, '#c9a878', '籠 ' + (j + 1)));
    controls('鴿子 m = <input id="gM" type="number" min="1" max="24" value="' + pg.m + '"> 籠子 n = <input id="gN" type="number" min="1" max="8" value="' + pg.n + '">'
      + '<button class="primary" id="gOne">丟一隻（隨機）</button><button id="gAll">全部隨機丟</button><button id="gEven">平均丟（最不擠）</button><button id="gClr">清空</button>');
    const reset = () => { pg.m = Math.max(1, Math.min(24, Number($('gM').value) || 1)); pg.n = Math.max(1, Math.min(8, Number($('gN').value) || 1)); enterPigeon(); };
    $('gM').onchange = reset; $('gN').onchange = reset; on('gClr', reset);
    on('gOne', () => { if (pg.birds.length >= pg.m) { log('m = ' + pg.m + ' 隻都丟完了；按「清空」重來。', true); return; } dropBird(rnd(pg.n)); });
    on('gAll', guard(async (w) => { while (pg.birds.length < pg.m) { dropBird(rnd(pg.n)); await w(220); } }));
    on('gEven', guard(async (w) => {
      if (pg.birds.length) { log('先「清空」，才能示範最平均的放法。', true); return; }
      for (let i = 0; i < pg.m; i++) { dropBird(i % pg.n); await w(220); }
      log('就算盡量平均，還是有一籠至少 ⌈' + pg.m + '/' + pg.n + '⌉ = ' + Math.ceil(pg.m / pg.n) + ' 隻。');
    }));
    log('鴿籠原理：m 隻鴿子放進 n 個籠子，必有一籠至少 ⌈m/n⌉ 隻。');
    pgState();
  }
  function dropBird(j) {
    const k = pg.cnt[j]++;
    const b = pigeon();
    const p = slotIn(holeX(j, pg.n), 0, k);
    b.position.set(p.x, p.y + 4, p.z); b.rotation.y = Math.random() * 6;
    lab.dropTo(lab.addBody(b), p);
    pg.birds.push(b);
    pgState();
  }
  function pgState() {
    const mx = Math.max(...pg.cnt), need = Math.ceil(pg.m / pg.n);
    pg.holes.forEach((h, j) => { h.userData.mat.color.set(pg.cnt[j] === mx && mx >= 2 ? '#e3a3a3' : '#c9a878'); txt(h.userData.lbl, '籠 ' + (j + 1) + '：' + pg.cnt[j]); });
    const done = pg.birds.length >= pg.m;
    setState('鴿籠原理 m = ' + pg.m + '，n = ' + pg.n, [['已丟', pg.birds.length + ' / ' + pg.m], ['最擠的籠子', mx + ' 隻'], ['保證至少', '⌈' + pg.m + '/' + pg.n + '⌉ = ' + need]],
      done ? (mx >= need ? '<span class="ok">成立</span>：最擠的籠子 ' + mx + ' ≥ ' + need : '<span class="no">不可能</span>') : '丟完 ' + pg.m + ' 隻再看最擠的籠子');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const WORDS = [['BARBARIC', 'B2 A2 R2'], ['BANANA', 'A3 N2'], ['LETTER', 'T2 E2'], ['COMMITTEE', 'M2 T2 E2'], ['SUCCESS', 'S3 C2'], ['MISSISSIPPI', 'S4 I4 P2']];
  function uniq(ans, cands) { const s = [String(ans)]; for (const c of cands) { const v = String(c); if (!s.includes(v) && s.length < 4) s.push(v); } let d = 1; while (s.length < 4) { const v = String(Number(ans) + d * 7); if (!s.includes(v)) s.push(v); d++; } return s; }
  function genQ() {
    const t = rnd(8);
    if (t === 0) {
      const n = 5 + rnd(5), r = 2 + rnd(3);
      const ans = Pn(n, r);
      return { q: n + ' 位同學選出正、副班長和風紀股長共 ' + r + ' 個不同職位（一人一職），有幾種選法？', opts: uniq(ans, [Cb(n, r), n ** r, Cb(n + r - 1, r)]), ans: String(ans), why: '職位不同 → 有順序：P(' + n + ',' + r + ') = ' + Array.from({ length: r }, (_, i) => n - i).join('×') + ' = ' + ans + '。只選人不分職位才是 C(n,r)。' };
    }
    if (t === 1) {
      const n = 6 + rnd(5), r = 2 + rnd(4);
      const ans = Cb(n, r);
      return { q: '從 ' + n + ' 題中選 ' + r + ' 題作答（不管作答順序），有幾種選法？', opts: uniq(ans, [Pn(n, r), Cb(n, r - 1), Cb(n + r - 1, r)]), ans: String(ans), why: '只在乎挑到哪幾題 → C(' + n + ',' + r + ') = ' + n + '!/(' + r + '!·' + (n - r) + '!) = ' + ans + '，也等於 C(' + n + ',' + (n - r) + ')。' };
    }
    if (t === 2) {
      const [w, rep] = WORDS[rnd(WORDS.length)];
      const cnt = {}; for (const ch of w) cnt[ch] = (cnt[ch] || 0) + 1;
      const den = Object.values(cnt).reduce((a, c) => a * fact(c), 1);
      const ans = fact(w.length) / den;
      return { q: '把 ' + w + ' 的字母重新排列，有幾種不同的排法？', opts: uniq(ans, [fact(w.length), fact(w.length) / 2, ans * 2]), ans: String(ans), why: w.length + '! 先把每個字母當作不同，再除掉相同字母互換的重複：' + w.length + '! / (' + Object.values(cnt).filter((c) => c > 1).map((c) => c + '!').join('·') + ') = ' + ans + '。' };
    }
    if (t === 3) {
      const a = 2 + rnd(4), b = 2 + rnd(4);
      const ans = Cb(a + b, a);
      return { q: '在方格上從 (0,0) 走到 (' + a + ',' + b + ')，每步只能往東或往北走一格，有幾條路徑？', opts: uniq(ans, [2 ** (a + b), Pn(a + b, a), a * b]), ans: String(ans), why: '路徑 = ' + a + ' 個 E 和 ' + b + ' 個 N 的排列：(' + (a + b) + ')!/(' + a + '!·' + b + '!) = C(' + (a + b) + ',' + a + ') = ' + ans + '。' };
    }
    if (t === 4) {
      const n = 3 + rnd(3), k = 6 + rnd(7), low = rnd(2) ? 0 : 1;
      const free = k - n * low, ans = Cb(free + n - 1, n - 1);
      return { q: 'x₁ + … + x' + n + ' = ' + k + '，每個 xᵢ 都是整數且 xᵢ ≥ ' + low + '，有幾組解？', opts: uniq(ans, [Cb(k + n - 1, n - 1), Cb(k + n - 1, n), Cb(k - 1, n), Cb(free + n, n)].filter((v) => v !== ans)), ans: String(ans), why: (low ? '先每個放 1 → 剩 ' + free + '；' : '') + '星棒法：' + free + ' 顆星 + ' + (n - 1) + ' 根棒子 → C(' + (free + n - 1) + ',' + (n - 1) + ') = ' + ans + '。' };
    }
    if (t === 5) {
      const n = 3 + rnd(10), m = n * (1 + rnd(4)) + 1 + rnd(n - 1);
      const ans = Math.ceil(m / n);
      return { q: m + ' 封信投進 ' + n + ' 個信箱，至少有一個信箱至少有幾封信？', opts: uniq(ans, [Math.floor(m / n), ans + 1, Math.max(1, ans - 1)]), ans: String(ans), why: '鴿籠原理：⌈' + m + '/' + n + '⌉ = ' + ans + '。若每箱都 ≤ ' + (ans - 1) + ' 封，最多只有 ' + (ans - 1) * n + ' 封 < ' + m + '。' };
    }
    if (t === 6) {
      const k = 2 + rnd(5);
      const ans = (k - 1) * 12 + 1;
      return { q: '至少要幾個人，才能保證其中有 ' + k + ' 人在同一個月出生？', opts: uniq(ans, [k * 12, (k - 1) * 12, k * 12 + 1]), ans: String(ans), why: '12 個月 = 12 個籠子；每月最多 ' + (k - 1) + ' 人時共 ' + (k - 1) * 12 + ' 人，再多 1 人就逼出 ' + k + ' 人同月：' + ans + '。' };
    }
    const n = 4 + rnd(5), k = 1 + rnd(n - 1), a = 1 + rnd(2);
    const ans = Cb(n, k) * a ** (n - k);
    return { q: '(' + (a > 1 ? a : '') + 'x + y)' + sup(n) + ' 展開後，x' + sup(n - k) + 'y' + sup(k) + ' 的係數是？', opts: uniq(ans, [Cb(n, k), Cb(n, k) * a ** k, Pn(n, k)]), ans: String(ans), why: '二項式定理：C(' + n + ',' + k + ')·(' + (a > 1 ? a : '') + 'x)' + sup(n - k) + '·y' + sup(k) + ' → 係數 C(' + n + ',' + k + ')' + (a > 1 ? '·' + a + sup(n - k) : '') + ' = ' + ans + '。' };
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
        const pick = decodeURIComponent(btn.dataset.o);
        qs.total++; if (pick === p.ans) qs.score++;
        el.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
          const o = decodeURIComponent(b.dataset.o);
          if (o === p.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
        });
        $('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === p.ans ? '答對了。' : '答錯了。') + p.why + '</div><button class="lab-next" id="qNext">下一題</button>';
        $('qNext').onclick = () => renderQuiz(el);
      };
    });
  }

  // ═════════════════════════ 場景 ═════════════════════════
  // ─── 課本（Rosen 6.1）：乘法原理樹、加法原理 ───
  async function scProductTree(tok) {
    fresh([0, 3.8, 14.5], [-0.6, 3.8, 0]);
    const w = (ms) => beat(tok, ms);
    say('3 件上衣、2 條褲子、2 雙鞋：幾種穿法？', '一件事分成 3 步完成');
    await w(2200);
    await growTree(w, [3, 2, 2], [['紅衣', '藍衣', '綠衣'], ['長褲', '短褲'], ['球鞋', '涼鞋']], 1700);
    say('每條從左到右的路徑 = 一種穿法', '3 × 2 × 2 = 12');
    await w(2600);
    say('乘法原理：每一步的選法數相乘', 'n₁ × n₂ × … × nₖ');
    await w(2800);
  }
  async function scSumRule(tok) {
    fresh([0, 7, 12.5], [0, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    const lists = [[23, COL.ball, '清單 A：23'], [15, COL.pick, '清單 B：15'], [19, COL.green, '清單 C：19']];
    const all = [];
    say('從三份清單中挑「一個」專題', 'Rosen 例：清單互不重疊');
    for (let g = 0; g < 3; g++) {
      const [n, c, nm] = lists[g], cx = -4.2 + g * 4.2;
      tag(nm, 'ptr', cx, 0, 2.2);
      for (let i = 0; i < n; i++) all.push(cube('', c, [0.42, 0.36, 0.42], cx + ((i % 5) - 2) * 0.5, 0.18 + Math.floor(i / 25) * 0.4, -1 + Math.floor((i % 25) / 5) * 0.5, 2.5 + Math.random()));
      await w(900);
    }
    await w(1200);
    say('三份合在一起：一個一個數', '23 + 15 + 19 = ?');
    all.forEach((m, i) => move(m, ((i % 12) - 5.5) * 0.52, 0.18, -1.4 + Math.floor(i / 12) * 0.52));
    await w(1800);
    tag('共 57 個', 'ptr alt', 0, 1.2, 1.8);
    say('加法原理：互斥的情況相加', '23 + 15 + 19 = 57');
    await w(2600);
    say('若有專題同時出現在兩份清單 → 會重複算', '要扣掉重疊 → 第 6 章的排容原理');
    for (let i = 0; i < 4; i++) glow(all[i * 9], RED);
    await w(3000);
  }

  // ─── DBugSTeX1zw：排列 TALES ───
  async function scPermTales(tok) {
    fresh([0, 6.5, 11.5], [0, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    const W = ['T', 'A', 'L', 'E', 'S'], ms = {};
    W.forEach((ch, i) => { ms[ch] = cube(ch, COL.ball, [0.9, 0.9, 0.9], (i - 2) * 1.3, 0.45, -1.8); });
    const cnt = [];
    for (let k = 0; k < 5; k++) { ctx.tile(V3((k - 2) * 1.5, 0.04, 1.6), 1.2, 1.2); tag('第 ' + (k + 1) + ' 格', 'idx', (k - 2) * 1.5, 0, 2.6); cnt.push(tag('', 'ptr alt', (k - 2) * 1.5, 1.8, 1.6)); cnt[k].element.style.visibility = 'hidden'; }
    say('TALES 這 5 個字母有幾種排法？', '例如 A T E S L 也是一種');
    await w(2600);
    const order = ['L', 'S', 'E', 'A', 'T'];
    const left = [...W];
    for (let k = 0; k < 5; k++) {
      left.forEach((ch) => glow(ms[ch], GOLD));
      cnt[k].element.style.visibility = ''; txt(cnt[k], (5 - k) + ' 種');
      say('第 ' + (k + 1) + ' 格：剩 ' + (5 - k) + ' 個字母可選', Array.from({ length: k + 1 }, (_, i) => 5 - i).join(' × '));
      await w(1500);
      const ch = order[k];
      left.forEach((c) => glow(ms[c], null));
      left.splice(left.indexOf(ch), 1);
      tint(ms[ch], COL.pick); move(ms[ch], (k - 2) * 1.5, 0.5, 1.6);
      await w(900);
    }
    say('5 × 4 × 3 × 2 × 1 = 5! = 120', '沒有重複字母的排列：n!');
    await w(3000);
  }
  // ─── BARBARIC ───
  async function scPermBarbaric(tok) {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    const L = [['B', '₁', COL.ball], ['A', '₁', COL.purple], ['R', '₁', COL.orange], ['B', '₂', COL.ball], ['A', '₂', COL.purple], ['R', '₂', COL.orange], ['I', '', COL.gray], ['C', '', COL.gray]];
    const ms = L.map(([c, s, col], i) => cube(c + s, col, [0.85, 0.85, 0.85], (i - 3.5) * 1.15, 0.43, 0, 3));
    say('BARBARIC：8 個字母，但 B、A、R 各有 2 個', '先假裝都不一樣 → 8! = 40320');
    await w(3000);
    const sorted = [0, 3, 1, 4, 2, 5, 6, 7];
    sorted.forEach((idx, pos) => move(ms[idx], (pos - 3.5) * 1.15, 0.43, 0));
    say('排成 B B A A R R I C 來看', '');
    await w(1800);
    const pairs = [[0, 3, 'B'], [1, 4, 'A'], [2, 5, 'R']];
    let den = 1;
    for (const [a, b, ch] of pairs) {
      const pa = sorted.indexOf(a), pb = sorted.indexOf(b);
      glow(ms[a], GOLD); glow(ms[b], GOLD);
      move(ms[a], (pb - 3.5) * 1.15, 1.4, 0); move(ms[b], (pa - 3.5) * 1.15, 1.4, 0);
      say(ch + '₁ ' + ch + '₂ 對調 → 看起來還是同一個字', '每個字被算了 2! 次');
      await w(1300);
      move(ms[a], (pb - 3.5) * 1.15, 0.43, 0); move(ms[b], (pa - 3.5) * 1.15, 0.43, 0);
      relabel(ms[a], ch); relabel(ms[b], ch);
      sorted[pa] = b; sorted[pb] = a;
      den *= 2;
      say('除以 ' + ch + ' 的 2!', '8! / ' + (den === 2 ? '2!' : den === 4 ? '(2!·2!)' : '(2!·2!·2!)'));
      await w(1500);
      glow(ms[a], null); glow(ms[b], null);
    }
    say('8! / (2!·2!·2!) = 40320 / 8 = 5040', '多項係數 (8; 2,2,2,1,1)');
    await w(3200);
  }
  // ─── 課本：P(n,r) 與 C(n,r) ───
  async function scPermVsComb(tok) {
    fresh([0, 7, 12.5], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    const bs = 'ABCDE'.split('').map((c, i) => ball(c, COL.ball, 0.4, (i - 2) * 1.2, 0.4, -2.6));
    for (let k = 0; k < 3; k++) ctx.tile(V3((k - 1) * 1.45, 0.04, -0.4), 1.2, 1.2);
    say('從 A～E 挑 3 個排成一列', 'P(5,3) = 5 × 4 × 3 = 60');
    for (let k = 0; k < 3; k++) { tint(bs[k], COL.pick); move(bs[k], (k - 1) * 1.45, 0.45, -0.4); await w(800); }
    await w(1200);
    say('同樣是 {A, B, C}，換順序就是不同排列', '3! = 6 種順序');
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const minis = [];
    for (let p = 0; p < 6; p++) {
      perms[p].forEach((idx, k) => minis.push(cube('ABC'[idx], COL.pick, [0.45, 0.35, 0.45], -5.6 + p * 1.85 + k * 0.5 - 0.5, 0.18, 2.2, 1.5)));
      await w(380);
    }
    await w(1400);
    say('組合只管挑到誰：6 種順序算 1 組', 'C(5,3) = P(5,3) / 3! = 60 / 6 = 10');
    minis.forEach((m, i) => move(m, (i % 3 - 1) * 0.5, 0.18 + Math.floor(i / 3) * 0.36, 2.2));
    await w(2200);
    say('C(n,r) = n! / (r!(n−r)!)', 'P(n,r) = n!/(n−r)!，C(n,r) = P(n,r)/r!');
    await w(3000);
  }
  // ─── 格子路徑 ───
  function grid(nx, ny, s, ox, oz) {
    for (let i = 0; i <= nx; i++) line(ox + i * s, 0.03, oz, ox + i * s, 0.03, oz - ny * s, '#b9a684');
    for (let j = 0; j <= ny; j++) line(ox, 0.03, oz - j * s, ox + nx * s, 0.03, oz - j * s, '#b9a684');
    return (i, j) => V3(ox + i * s, 0.12, oz - j * s);
  }
  async function walkPath(w, P, word, start, color, pace, wordRow) {
    let [i, j] = start; const segs = [];
    const tok = ball('', COL.red, 0.2, P(i, j).x, 0.3, P(i, j).z);
    lab.addBody(tok);
    for (let k = 0; k < word.length; k++) {
      const a = P(i, j); if (word[k] === 'E') i++; else j++;
      const b = P(i, j);
      segs.push(rod(a, b, color, 0.08));
      move(tok, b.x, 0.3, b.z);
      if (wordRow) segs.push(cube(word[k], word[k] === 'E' ? COL.ball : COL.green, [0.55, 0.55, 0.55], wordRow.x + k * 0.65, wordRow.y, wordRow.z));
      await w(pace);
    }
    segs.push(tok);
    return segs;
  }
  async function scLattice44(tok) {
    fresh([0, 8.5, 9.5], [0, 0.8, -0.3]);
    const w = (ms) => beat(tok, ms);
    const P = grid(4, 4, 1.3, -2.6, 2.6);
    tag('A (0,0)', 'ptr', -2.6 - 0.5, 0.2, 3.2); tag('B (4,4)', 'ptr alt', 2.6 + 0.5, 0.2, -3.2);
    tag('E = 往東', 'idx', 4.6, 0, 2.2); tag('N = 往北', 'idx', 4.6, 0, 1.6);
    say('從 (0,0) 走到 (4,4)，只能往北或往東', '每條路 = 一個「字」');
    await w(2600);
    let segs = await walkPath(w, P, 'EEEENNNN', [0, 0], COL.ball, 450, V3(-2.3, 3.2, -3.6));
    say('E E E E N N N N 是一條路', '一定是 4 個 E、4 個 N');
    await w(2000);
    segs.forEach(kill);
    segs = await walkPath(w, P, 'NENNENEE', [0, 0], COL.pick, 650, V3(-2.3, 3.2, -3.6));
    say('重新排列字母 → 另一條路：N E N N E N E E', '路徑 ↔ 字母排列 一一對應');
    await w(2400);
    say('8 個字母，4 個 N 一樣、4 個 E 一樣', '8! / (4!·4!) = 70 = C(8,4)');
    await w(3200);
  }
  async function scLatticeGeneral(tok) {
    fresh([0, 8.5, 9.5], [0, 0.6, -0.2]);
    const w = (ms) => beat(tok, ms);
    const P = grid(6, 5, 1.0, -3, 2.5);
    for (let i = 0; i <= 6; i++) tag(String(i), 'idx', -3 + i, 0, 3.0);
    for (let j = 0; j <= 5; j++) tag(String(j), 'idx', -3.5, 0, 2.5 - j);
    const A = P(1, 1), B = P(5, 4);
    ball('', COL.ink, 0.22, A.x, 0.25, A.z); ball('', COL.gold, 0.22, B.x, 0.25, B.z);
    tag('A (a,b) = (1,1)', 'ptr', A.x - 0.6, 0.6, A.z + 0.4); tag('B (c,d) = (5,4)', 'ptr alt', B.x + 0.4, 0.6, B.z - 0.4);
    say('一般情況：從 (a,b) 走到 (c,d)', '');
    await w(2200);
    const dx = rod(V3(A.x, 0.15, A.z + 0.0), V3(B.x, 0.15, A.z), COL.ball, 0.1);
    tag('Δx = c − a = 4', 'ptr', (A.x + B.x) / 2, 0.5, A.z + 0.5);
    await w(1200);
    const dy = rod(V3(B.x, 0.15, A.z), V3(B.x, 0.15, B.z), COL.green, 0.1);
    tag('Δy = d − b = 3', 'ptr', B.x + 1.2, 0.5, (A.z + B.z) / 2);
    say('要往東 m = c−a 次、往北 n = d−b 次', 'm = 4，n = 3');
    await w(2400);
    kill(dx); kill(dy);
    const word = shuffle('EEEENNN'.split('')).join('');
    await walkPath(w, P, word, [1, 1], COL.pick, 500, null);
    say('任一條路 = ' + word.split('').join(' '), '(m+n)! / (m!·n!) = 7!/(4!·3!) = 35');
    await w(2600);
    say('也就是 C(m+n, m) = C(m+n, n)', '若 B 在 A 的左下方，只准往東北走 → 0 條');
    await w(3000);
  }
  // ─── 10 題選 7 題 ───
  function cards(n, gapAt = -1) {
    return Array.from({ length: n }, (_, i) => {
      const x = (i - (n - 1) / 2) * 1.12 + (gapAt >= 0 ? (i < gapAt ? -0.4 : 0.4) : 0);
      const m = cube(i + 1, '#efe5d3', [0.9, 1.15, 0.12], x, 0.6, 0);
      m.userData.x = x; return m;
    });
  }
  const up = (m, c) => { tint(m, c); move(m, m.userData.x, 1.75, 0); };
  const down = (m) => { tint(m, '#efe5d3'); glow(m, null); move(m, m.userData.x, 0.6, 0); };
  async function scChoose7(tok) {
    fresh([0, 3.5, 12], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    const cs = cards(10);
    say('10 題中選 7 題作答，沒有限制', '');
    await w(1800);
    for (let rep = 0; rep < 2; rep++) {
      const pick = shuffle([...Array(10).keys()]).slice(0, 7);
      for (const i of pick) { up(cs[i], COL.green); await w(rep ? 120 : 380); }
      say(rep ? '換一組 → 另一種選法' : '只在乎選了哪 7 題 → 組合', 'C(10,7) = 10! / (7!·3!)');
      await w(1700);
      if (!rep) {
        cs.forEach((m, i) => { if (!pick.includes(i)) glow(m, RED); });
        say('選 7 題作答 = 選 3 題不答', 'C(10,7) = C(10,3) = 120');
        await w(2600);
      }
      cs.forEach(down);
      await w(600);
    }
    say('C(n,k) = n! / (k!(n−k)!) = C(n, n−k)', '10 選 7 = 120 種');
    await w(2800);
  }
  async function scChooseFirstTwo(tok) {
    fresh([0, 3.5, 12], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    const cs = cards(10);
    say('限制：第 1、2 題一定要答', '');
    await w(1600);
    up(cs[0], COL.gold); up(cs[1], COL.gold);
    say('前 2 題已選定：C(2,2) = 1', '還要再選 7 − 2 = 5 題');
    await w(2000);
    const pick = shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5);
    for (const i of pick) { up(cs[i], COL.green); await w(420); }
    say('從剩下 8 題選 5 題', 'C(2,2) · C(8,5) = 1 · 56 = 56');
    await w(2600);
    pick.forEach((i) => down(cs[i]));
    await w(500);
    for (const i of shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5)) { up(cs[i], COL.green); await w(150); }
    say('金色固定，綠色在 8 題裡換', '答案 56');
    await w(2800);
  }
  async function scChooseAtLeast4(tok) {
    fresh([0, 4, 13], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    const cs = cards(10, 6);
    tag('前 6 題', 'ptr', -3.2, 0, 1.2); tag('後 4 題', 'ptr', 3.8, 0, 1.2);
    say('前 6 題中至少答 4 題（共答 7 題）', '拆成兩區：前 6 題 ｜ 後 4 題');
    await w(2600);
    const cases = [
      [[0, 1, 3, 4], [7, 8, 9], '前 6 選 4、後 4 選 3', 'C(6,4)·C(4,3) = 15·4 = 60'],
      [[0, 1, 2, 3, 4], [8, 9], '前 6 選 5、後 4 選 2', 'C(6,5)·C(4,2) = 6·6 = 36'],
      [[0, 1, 2, 3, 4, 5], [9], '前 6 全選、後 4 選 1', 'C(6,6)·C(4,1) = 1·4 = 4'],
    ];
    const res = [];
    for (let c = 0; c < 3; c++) {
      const [a, b, cap, f] = cases[c];
      a.forEach((i) => up(cs[i], COL.green)); b.forEach((i) => up(cs[i], COL.ball));
      say(cap, f);
      await w(2000);
      if (c === 0) {
        [7, 8, 9].forEach((i) => down(cs[i])); await w(500);
        [6, 7, 9].forEach((i) => up(cs[i], COL.ball));
        say('後面也可以換成 7、8、10 → 兩區各自選，相乘', f);
        await w(2200);
      }
      res.push(tag(f.split(' = ')[0] + ' = ' + f.split(' = ').pop(), 'ptr alt', -4.6, 4.6 - c * 0.7, 0));
      cs.forEach(down);
      await w(700);
    }
    say('三種情況互斥 → 相加：60 + 36 + 4 = 100', 'Σ_{i=0}^{2} C(6, 4+i)·C(4, 3−i) = 100');
    await w(3400);
  }
  // ─── 星棒法 ───
  async function scStarsBars12(tok) {
    fresh([0, 6.5, 11], [0, 0.6, -0.5]);
    const w = (ms) => beat(tok, ms);
    [0, 1, 2].forEach((b) => crate((b - 1) * 3, -2.6, 2.2, 1.4, 0.4, '#c9a878', 'x' + (b + 1)));
    say('x₁ + x₂ + x₃ = 12，xᵢ ≥ 0 有幾組解？', '= 12 個一樣的東西放進 3 個不同的箱子');
    await w(2600);
    const S = sbBuild(12, 3, 0.8);
    S.bars.forEach((m) => { m.visible = false; });
    S.gl.forEach((l) => { l.element.style.visibility = 'hidden'; });
    // 12 stars first, packed without the bars
    S.stars.forEach((m, i) => dropOn(m, (i - 5.5) * S.sp, S.y, S.z));
    say('先把 12 個排成一列', '');
    await w(1600);
    S.bars.forEach((m) => { m.visible = true; });
    S.gl.forEach((l) => { l.element.style.visibility = ''; });
    sbLayout(S, [6, 2, 4]);
    say('插入 2 根隔板：切成 3 段', 'x₁ = 6，x₂ = 2，x₃ = 4');
    await w(2600);
    sbLayout(S, [0, 12, 0]);
    say('隔板也可以放兩端', 'x₁ = 0，x₂ = 12，x₃ = 0');
    await w(2400);
    sbLayout(S, [3, 5, 4]);
    await w(1200);
    S.bars.forEach((m) => glow(m, GOLD));
    say('其實是 14 個位置，挑 2 個放隔板', 'C(14, 2) = C(14, 12) = 91');
    await w(2800);
    say('一般式：x₁ + … + xₙ = k', 'C(n + k − 1, k) = C(n + k − 1, n − 1)');
    await w(3000);
  }
  async function scStarsLower(tok) {
    fresh([0, 6.5, 11], [0, 0.6, -0.5]);
    const w = (ms) => beat(tok, ms);
    [0, 1, 2].forEach((b) => crate((b - 1) * 3, -2.6, 2.2, 1.4, 0.4, '#c9a878', 'x' + (b + 1)));
    say('同一題加條件：每個 xᵢ ≥ 2', 'x₁ + x₂ + x₃ = 12');
    await w(2400);
    for (let b = 0; b < 3; b++) { for (let i = 0; i < 2; i++) cube('', COL.orange, [0.45, 0.4, 0.45], (b - 1) * 3 + (i ? 0.35 : -0.35), 0.25, -2.6, 3); await w(500); }
    say('先每箱放 2 個：用掉 6 個', '令 xᵢ = yᵢ + 2，yᵢ ≥ 0');
    await w(2400);
    const S = sbBuild(6, 3, 0.9);
    sbLayout(S, [2, 3, 1], true, [2, 2, 2]);
    say('剩 6 個自由分配', 'y₁ + y₂ + y₃ = 12 − 6 = 6');
    await w(2400);
    sbLayout(S, [0, 4, 2], false, [2, 2, 2]);
    await w(1400);
    sbLayout(S, [5, 0, 1], false, [2, 2, 2]);
    say('6 顆星 + 2 根隔板 = 8 個位置', 'C(8, 2) = C(8, 6) = 28');
    await w(3000);
    say('有下限：先放好下限，再用星棒法', '換變數把 xᵢ ≥ 2 變回 yᵢ ≥ 0');
    await w(2800);
  }
  async function scStarsBalls(tok) {
    fresh([0, 6.5, 11], [0, 0.6, -0.5]);
    const w = (ms) => beat(tok, ms);
    [0, 1, 2, 3].forEach((b) => crate((b - 1.5) * 2.6, -2.6, 2, 1.4, 0.4, '#c9a878', '箱 ' + (b + 1)));
    say('8 顆一樣的白球放進 4 個不同的箱子', '= x₁ + x₂ + x₃ + x₄ = 8');
    await w(2600);
    let S = sbBuild(8, 4, 0.9);
    S.stars.forEach((m) => tint(m, '#f4efe6'));
    sbLayout(S, [3, 0, 4, 1], true);
    say('允許空箱（xᵢ ≥ 0）', 'C(4 + 8 − 1, 8) = C(11, 8) = 165');
    await w(3000);
    sbLayout(S, [0, 2, 2, 4]);
    await w(1500);
    say('若要求「沒有空箱」呢？', '影片寫 C(11,8) 對應的是可空箱');
    await w(2600);
    S.stars.forEach((m) => kill(m)); S.bars.forEach((m) => kill(m)); S.gl.forEach((l) => kill(l));
    for (let b = 0; b < 4; b++) ball('', COL.orange, 0.26, (b - 1.5) * 2.6, 0.3, -2.6, 3);
    await w(1200);
    S = sbBuild(4, 4, 0.9);
    S.stars.forEach((m) => tint(m, '#f4efe6'));
    sbLayout(S, [1, 0, 2, 1], true, [1, 1, 1, 1]);
    say('都不空：先每箱放 1 顆，剩 4 顆自由分', 'C(4 + 4 − 1, 4) = C(7, 3) = 35');
    await w(3200);
  }
  async function scStarsOdd(tok) {
    fresh([0, 6.5, 11.5], [0, 0.8, -0.5]);
    const w = (ms) => beat(tok, ms);
    const cx = [-4.2, -1.6, 1.0];
    cx.forEach((x, b) => crate(x, -2.6, 2, 1.4, 0.4, '#c9a878', 'x' + (b + 1)));
    const c4 = crate(4.2, -2.6, 2, 1.4, 0.4, '#e3c06a', 'x₄（奇數）');
    say('x₁ + x₂ + x₃ + x₄ = 8，x₄ 必須是奇數', 'x₄ ∈ {1, 3, 5, 7}：分 4 種情況');
    await w(2800);
    const rows = [[1, 7, 36], [3, 5, 21], [5, 3, 10], [7, 1, 3]];
    let inX4 = [], S = null, acc = 0;
    for (const [x4, r, v] of rows) {
      inX4.forEach(kill); inX4 = [];
      if (S) { S.stars.forEach(kill); S.bars.forEach(kill); S.gl.forEach(kill); }
      for (let i = 0; i < x4; i++) { const p = slotIn(4.2, -2.6, i, 0.3, 0.3, 0.2); inX4.push(ball('', COL.pick, 0.18, p.x, p.y, p.z, 2.5)); }
      S = sbBuild(r, 3, 0.9);
      const comp = [0, 0, 0]; for (let i = 0; i < r; i++) comp[rnd(3)]++;
      sbLayout(S, comp, true);
      acc += v;
      tag('x₄=' + x4 + '：C(' + (r + 2) + ',' + r + ') = ' + v, 'ptr alt', 4.2, 4.4 - rows.findIndex((q) => q[0] === x4) * 0.65, -1);
      say('x₄ = ' + x4 + ' → x₁+x₂+x₃ = ' + r, 'C(3 + ' + r + ' − 1, ' + r + ') = ' + v);
      await w(2600);
    }
    glow(c4.children[0], GOLD);
    say('4 種情況互斥 → 相加', '36 + 21 + 10 + 3 = 70');
    await w(3400);
  }
  // ─── 課本：二項式定理與巴斯卡三角形 ───
  async function scBinomial(tok) {
    fresh([0, 3.8, 14.5], [-0.6, 3.8, 0]);
    const w = (ms) => beat(tok, ms);
    say('(x+y)³ = (x+y)(x+y)(x+y)', '每個括號挑 x 或 y');
    await w(2200);
    const leaves = await growTree(w, [2, 2, 2], [['x', 'y'], ['x', 'y'], ['x', 'y']], 1100);
    const groups = {};
    leaves.forEach((n) => { const k = n.path.split('').filter((c) => c === 'y').length; (groups[k] = groups[k] || []).push(n); });
    for (let k = 0; k <= 3; k++) {
      groups[k].forEach((n) => glow(n.m, ['#203060', GOLD, GREEN, RED][k]));
      say('含 ' + k + ' 個 y 的葉子有 ' + groups[k].length + ' 片', '= C(3,' + k + ') = ' + Cb(3, k));
      await w(1300);
    }
    say('(x+y)³ = x³ + 3x²y + 3xy² + y³', '係數 = C(3,k)：從 3 個括號挑 k 個出 y');
    await w(2800);
    lab.clear(); lab.frameCamera([0, 4, 13], [0, 3.6, 0]);
    ps.rows = []; ps.n = -1;
    say('把每個 n 的係數疊起來：巴斯卡三角形', '');
    for (let r = 0; r <= 6; r++) { addRow(); await w(700); }
    glow(ps.rows[4][2], GOLD); glow(ps.rows[3][1], GREEN); glow(ps.rows[3][2], GREEN);
    say('每格 = 左上 + 右上', 'C(4,2) = C(3,1) + C(3,2) → 6 = 3 + 3');
    await w(2800);
    ps.rows[6].forEach((m) => glow(m, GOLD));
    say('第 6 列：1 6 15 20 15 6 1', '(x+y)ⁿ = Σ C(n,k) xⁿ⁻ᵏ yᵏ；每列總和 2ⁿ');
    await w(3000);
  }

  // ─── 2-mxYrCNX60：鴿籠原理 ───
  function holes(n, names, z = 0, w = 1.6) { return Array.from({ length: n }, (_, j) => crate((j - (n - 1) / 2) * (w + 0.5), z, w, 1.4, 0.4, '#c9a878', names ? names[j] : '籠 ' + (j + 1))); }
  function birdTo(hx, hz, k, from) { const b = pigeon(); const p = slotIn(hx, hz, k); b.position.copy(from || V3(p.x, p.y + 4, p.z)); b.rotation.y = 1.2; lab.addBody(b); move(b, p.x, p.y, p.z); return b; }
  async function scPigeonBasic(tok) {
    fresh([0, 6, 10], [0, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    const H = holes(3); const hx = (j) => H[j].position.x;
    const start = (i) => V3(-5.5 + (i % 2) * 0.6, 0.25, 2.2 - Math.floor(i / 2) * 0.6);
    let bs = [0, 1, 2, 3].map((i) => { const b = pigeon(); b.position.copy(start(i)); lab.addBody(b); return b; });
    say('左邊 4 隻鴿子（物品），右邊 3 個籠子（容器）', '');
    await w(2400);
    const d1 = [0, 0, 0, 2], cnt = [0, 0, 0];
    for (let i = 0; i < 4; i++) { const j = d1[i]; const p = slotIn(hx(j), 0, cnt[j]++); move(bs[i], p.x, p.y, p.z); await w(600); }
    say('隨便放：分布 3、0、1', '有一籠超過 1 隻');
    await w(2400);
    bs.forEach((b, i) => move(b, start(i).x, start(i).y, start(i).z));
    await w(1100);
    cnt.fill(0);
    for (let i = 0; i < 3; i++) { const p = slotIn(hx(i), 0, cnt[i]++); move(bs[i], p.x, p.y, p.z); await w(700); }
    say('想一籠只放一隻……', '第 4 隻沒地方去');
    glow(bs[3], RED);
    await w(2200);
    const p = slotIn(hx(0), 0, cnt[0]++); move(bs[3], p.x, p.y, p.z);
    glow(H[0], null); H[0].userData.mat.color.set('#e3a3a3');
    say('只好塞進已有鴿子的籠子：2、1、1', '鴿子比籠子多 → 必有一籠 ≥ 2 隻');
    await w(3200);
  }
  async function scPigeonGeneral(tok) {
    fresh([0, 7.5, 11], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    say('推廣：m 個物品放進 n 個容器', '必有一個容器至少 ⌈m/n⌉ 個');
    await w(2400);
    let H = holes(3);
    let bs = [];
    for (let i = 0; i < 4; i++) { bs.push(birdTo(H[i % 3].position.x, 0, Math.floor(i / 3))); await w(350); }
    say('4 / 3 = 1.33…，向上取整 → 2', '⌈4/3⌉ = 2');
    await w(2600);
    lab.clear();
    H = holes(4, null, 0, 1.5);
    bs = [];
    for (let i = 0; i < 10; i++) { bs.push(birdTo(H[i % 4].position.x, 0, Math.floor(i / 4))); await w(260); }
    H[0].userData.mat.color.set('#e3a3a3'); H[1].userData.mat.color.set('#e3a3a3');
    say('10 隻、4 籠：最平均也是 3、3、2、2', '⌈10/4⌉ = 3');
    await w(2800);
    say('也可能 10 隻全擠一籠，但不可能每籠都 < 3', '至少 3 是「保證」，不是「恰好」');
    bs.forEach((b, i) => { const p = slotIn(H[0].position.x, 0, i); move(b, p.x, p.y, p.z); });
    await w(3200);
  }
  async function scPigeonFriends(tok) {
    fresh([0, 7, 11.5], [0.4, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    const pos = [V3(-5.6, 0.4, -1.6), V3(-2.8, 0.4, -1.6), V3(-2.8, 0.4, 1.2), V3(-5.6, 0.4, 1.2)];
    const ppl = pos.map((p, i) => cube(i + 1, COL.ball, [0.75, 0.75, 0.75], p.x, p.y, p.z, 2));
    say('n 個人之中，一定有兩人朋友數相同', '例：4 個人');
    await w(2400);
    const E = [[0, 1], [0, 3], [2, 3]];
    for (const [a, b] of E) { rod(pos[a], pos[b], COL.pick, 0.06); await w(700); }
    const deg = [2, 1, 1, 2];
    deg.forEach((d, i) => tag(d + ' 位朋友', 'ptr', pos[i].x, 1.3, pos[i].z));
    say('1 跟 2、4 是朋友；3 跟 4 是朋友', '朋友數：2、1、1、2');
    await w(2600);
    const H = [1, 2, 3].map((d, j) => crate(1.2 + j * 2.0, 0, 1.6, 1.4, 0.4, '#c9a878', d + ' 位朋友'));
    say('籠子 = 朋友數 1 … n−1（共 n−1 個）', '鴿子 = n 個人');
    await w(2400);
    const cnt = [0, 0, 0];
    for (let i = 0; i < 4; i++) { const j = deg[i] - 1; const p = slotIn(H[j].position.x, 0, cnt[j]++); cube(i + 1, COL.ball, [0.45, 0.45, 0.45], p.x, p.y + 0.02, p.z, 3); await w(700); }
    H[0].userData.mat.color.set('#e3a3a3'); H[1].userData.mat.color.set('#e3a3a3');
    say('n 個人進 n−1 個籠子 → 必有兩人同一籠', '影片假設每人至少 1 位朋友');
    await w(2800);
    say('允許 0 位朋友也成立：0 和 n−1 不會同時出現', '可能的朋友數仍只有 n−1 種');
    await w(3200);
  }
  async function scPigeonBirthday(tok) {
    fresh([0, 9, 8], [0, 0, 0]);
    const w = (ms) => beat(tok, ms);
    const cols = 19, s = 0.36, cell = (d) => V3((d % cols - (cols - 1) / 2) * s, 0.05, (Math.floor(d / cols) - 9.5) * s);
    for (let d = 0; d < 365; d++) ctx.tile(cell(d), 0.3, 0.3, ['#e9dcc4', '#e2d2b4'][Math.floor(d / 30.5) % 2]);
    tag('365 天（每格 = 一天）', 'ptr', 0, 0.2, -4.2);
    say('366 個人、365 天：一定有兩人同一天生日', '');
    await w(1800);
    const cnt = tag('0 人', 'ptr alt', 4.6, 0.6, 3.6);
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < cols; c++) { const d = r * cols + c; if (d >= 365) break; const p = cell(d); cube('', COL.ball, [0.24, 0.24, 0.24], p.x, 0.17, p.z); }
      txt(cnt, Math.min(365, (r + 1) * cols) + ' 人');
      say('前 ' + Math.min(365, (r + 1) * cols) + ' 人：故意每人都不同天', '');
      await w(130);
    }
    say('365 人剛好每天一人', '第 366 人呢？');
    await w(2200);
    const d = rnd(365), p = cell(d);
    const last = cube('', COL.red, [0.26, 0.26, 0.26], p.x, 0.43, p.z, 4);
    txt(cnt, '366 人');
    await w(1200);
    glow(last, RED);
    say('只能落在已經有人的那一天', '⌈366/365⌉ = 2：至少 2 人同天');
    await w(2600);
    say('是「至少 2」：也可能更多人同天', '（若算 2/29，要 367 人）');
    await w(3000);
  }
  async function scPigeonSum21(tok) {
    fresh([0, 6.5, 12], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    const nums = {};
    for (let v = 1; v <= 20; v++) nums[v] = cube(v, '#efe5d3', [0.6, 0.55, 0.6], ((v - 1) % 10 - 4.5) * 0.9, 0.28, (v > 10 ? 1.2 : 0.3) + 1.2);
    say('S = {1, 2, …, 20}，任選 11 個數', '必有兩數相加 = 21？');
    await w(2600);
    const H = []; for (let j = 0; j < 10; j++) H.push(crate((j - 4.5) * 1.25, -1.2, 1.1, 1.2, 0.35, '#c9a878', '{' + (j + 1) + ',' + (20 - j) + '}'));
    say('把和為 21 的兩數配成一對：10 個籠子', '{1,20} {2,19} … {10,11}');
    for (let j = 0; j < 10; j++) { move(nums[j + 1], H[j].position.x - 0.25, 0.3, -1.2); move(nums[20 - j], H[j].position.x + 0.25, 0.3, -1.2); await w(260); }
    await w(1600);
    say('想反駁：每對只挑一個', '挑 1, 2, …, 10：任兩數和都 ≠ 21');
    for (let v = 1; v <= 10; v++) { tint(nums[v], COL.green); move(nums[v], H[v - 1].position.x - 0.25, 1.1, -1.2); await w(220); }
    await w(2000);
    say('但要挑 11 個：第 11 個一定落進某一對', '');
    await w(1600);
    tint(nums[19], COL.red); move(nums[19], H[1].position.x + 0.25, 1.1, -1.2);
    glow(nums[2], RED); glow(nums[19], RED);
    say('挑 19 → 2 + 19 = 21', '');
    await w(2000);
    tint(nums[12], COL.red); move(nums[12], H[8].position.x + 0.25, 1.1, -1.2);
    glow(nums[9], RED); glow(nums[12], RED);
    say('挑 12 → 9 + 12 = 21', '11 個數放進 10 個籠子：⌈11/10⌉ = 2');
    await w(2600);
    say('籠子是 10 對，不是 20 個數', '⌈11/20⌉ 是錯的想法');
    await w(2800);
  }
  async function scPigeonGrid(tok) {
    fresh([0, 9.5, 8.5], [0, 0, 0.2]);
    const w = (ms) => beat(tok, ms);
    const s = 0.8; // 1 cm = 0.8 world units → 8 cm = 6.4
    const base = new THREE.Mesh(new THREE.BoxGeometry(8 * s, 0.06, 8 * s), new THREE.MeshStandardMaterial({ color: '#f4ecdc' }));
    base.position.set(0, 0.03, 0); base.receiveShadow = true; lab.world.add(base);
    tag('8 cm × 8 cm', 'ptr', 0, 0.2, 4 * s + 0.5);
    say('8×8 的正方形裡放 17 個點', '一定有兩點距離 ≤ √8 cm？');
    await w(2600);
    for (let i = 0; i <= 4; i++) { line(-4 * s + i * 2 * s, 0.08, -4 * s, -4 * s + i * 2 * s, 0.08, 4 * s, '#9c8b70'); line(-4 * s, 0.08, -4 * s + i * 2 * s, 4 * s, 0.08, -4 * s + i * 2 * s, '#9c8b70'); }
    say('切成 16 個 2×2 的小方格 = 16 個籠子', '小方格裡最遠的兩點是對角線：√(2²+2²) = √8');
    await w(3000);
    const pts = [];
    const at = (c, fx, fz) => V3(-4 * s + (c % 4) * 2 * s + fx * 2 * s, 0.2, -4 * s + Math.floor(c / 4) * 2 * s + fz * 2 * s);
    for (let c = 0; c < 16; c++) { const p = at(c, 0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7); pts.push(ball('', COL.ball, 0.13, p.x, p.y, p.z, 3)); await w(150); }
    say('前 16 點：每格一點', '第 17 點呢？');
    await w(2000);
    const c = 5 + rnd(6);
    const q = at(c, 0.85, 0.15), first = pts[c];
    const p17 = ball('', COL.red, 0.14, q.x, q.y, q.z, 3);
    await w(1200);
    glow(first, RED); glow(p17, RED);
    rod(first.position.clone(), q.clone(), COL.red, 0.04);
    const cx = -4 * s + (c % 4) * 2 * s, cz = -4 * s + Math.floor(c / 4) * 2 * s;
    rod(V3(cx, 0.1, cz), V3(cx + 2 * s, 0.1, cz + 2 * s), COL.gold, 0.035);
    say('同一格的兩點，距離 ≤ 對角線 √8', '⌈17/16⌉ = 2');
    await w(2800);
    say('反過來問：最少幾點才保證？', '16 個籠子 → 至少 17 點');
    await w(3000);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'product-rule-tree': { title: '乘法原理：3 × 2 × 2 的選擇樹', play: scProductTree },
    'sum-rule-piles': { title: '加法原理：23 + 15 + 19 = 57（課本）', play: scSumRule },
    'perm-tales': { title: 'TALES 的排列：5! = 120', play: scPermTales },
    'perm-barbaric': { title: 'BARBARIC：8!/(2!2!2!) = 5040', play: scPermBarbaric },
    'perm-vs-comb': { title: '排列與組合：P(5,3) ÷ 3! = C(5,3)（課本）', play: scPermVsComb },
    'lattice-44': { title: '格子路徑 (0,0)→(4,4)：8!/(4!4!) = 70', play: scLattice44 },
    'lattice-general': { title: '一般格子路徑：C(m+n, m)', play: scLatticeGeneral },
    'choose-7-of-10': { title: '10 題選 7 題：C(10,7) = C(10,3) = 120', play: scChoose7 },
    'choose-first-two': { title: '前兩題必答：C(8,5) = 56', play: scChooseFirstTwo },
    'choose-at-least-4': { title: '前 6 題至少答 4 題：60 + 36 + 4 = 100', play: scChooseAtLeast4 },
    'stars-bars-12': { title: '星棒法：x₁+x₂+x₃ = 12 → C(14,2) = 91', play: scStarsBars12 },
    'stars-lower-bound': { title: '每個 xᵢ ≥ 2：先放下限 → C(8,2) = 28', play: scStarsLower },
    'stars-balls-boxes': { title: '8 顆球放 4 箱：可空 165、不空 35', play: scStarsBalls },
    'stars-odd-x4': { title: 'x₄ 必為奇數：36 + 21 + 10 + 3 = 70', play: scStarsOdd },
    'binomial-pascal': { title: '二項式定理與巴斯卡三角形（課本）', play: scBinomial },
    'pigeon-basic': { title: '4 隻鴿子、3 個籠子', play: scPigeonBasic },
    'pigeon-general': { title: '推廣鴿籠原理：⌈m/n⌉', play: scPigeonGeneral },
    'pigeon-friends': { title: '一定有兩人朋友數相同', play: scPigeonFriends },
    'pigeon-birthday': { title: '366 人必有兩人同天生日', play: scPigeonBirthday },
    'pigeon-sum21': { title: '1～20 選 11 個：必有兩數和為 21', play: scPigeonSum21 },
    'pigeon-grid17': { title: '8×8 方格放 17 點：必有兩點距離 ≤ √8', play: scPigeonGrid },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ ct.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const icon = P.icon;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 5 章（TrevTutor 鴿籠／排列組合複習、交大 易志偉 Lec14–15 Counting、清大 趙啟超 第5A–5D講 鴿籠原理、
//     第9A–9D講 Principles of Counting）— cued scenes ───
// 每個 scene 是一串 steps；每一步等老師講到那一句（notes 的 cues）才動一下。不重播、不循環。
// 老師的例子與數字照用；老師沒給、為了畫面補的數字一律標「示意」。所有計數都在程式裡算（Cb / Pn / fact / 列舉）。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const glw = (m, c) => { const mt = m.userData.mat || m.material; if (mt) mt.emissive = new THREE.Color(c || '#000000'); };
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const CAMP = [[0, 6.4, 10.5], [0, 0.6, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f', gray: '#cfc6b6', card: '#efe5d3', sky: '#cfe6f7', mint: '#d2f1e6' };
const OKG = '#0f5a3a', NG = '#7a1010', HL = '#6a4a00';
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
// a board: lines appear one under another (left-aligned); add() lights the newest line
function board(x, yTop, dy = 0.6) {
  const ls = []; let last = null;
  return {
    ls,
    add(t, c = 'note', dx = 0) {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = L(t, c, x + dx, yTop - ls.length * dy); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
    set(i, c) { cls(ls[i < 0 ? ls.length + i : i], c); },
    dim() { ls.forEach((l) => cls(l, 'idx')); last = null; },
    clear() { ls.forEach((l) => kill(l)); ls.length = 0; last = null; },
  };
}
const chip = (t, c, x, y, w = 0.9, h = 0.6, drop = 0, z = 0) => cube(t, c, [w, h, 0.6], x, y, z, drop);
// move several plain objects along a small arc at once (pigeons flying, numbers hopping into a box)
async function arc(tok, objs, targets, ms = 700, h = 1.2) {
  const a = objs.map((o) => o.position.clone());
  await anim(tok, ms, (u) => objs.forEach((o, i) => { o.position.lerpVectors(a[i], targets[i], u); o.position.y += Math.sin(Math.PI * u) * h; }));
}
// a pigeon standing at p (not a physics body, so arc() can fly it)
function bird(p, color) { const b = pigeon(color); b.position.copy(p); b.rotation.y = 0.35; lab.world.add(b); return b; }
// a row of open crates centred on x = cx; returns {H, x(j), put(obj, j) → target, cnt}
function crates(n, names, cx = 0, z = 0, w = 1.6, gap = 0.5, color = '#c9a878') {
  const H = Array.from({ length: n }, (_, j) => crate(cx + (j - (n - 1) / 2) * (w + gap), z, w, 1.4, 0.4, color, names ? names[j] : '籠 ' + (j + 1)));
  const cnt = Array(n).fill(0);
  return { H, cnt, x: (j) => H[j].position.x, slot(j) { return slotIn(H[j].position.x, z, cnt[j]++); }, hot(j, on = true) { H[j].userData.mat.color.set(on ? '#e3a3a3' : color); }, name(j, t) { txt(H[j].userData.lbl, t); } };
}
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// shift a just-dropped Pascal row sideways (its falling target too)
function shiftRow(row, dx) {
  row.forEach((m) => { const b = bodyOf(m); b.target.x += dx; m.position.x += dx; });
  const lt = lab.world.children[lab.world.children.length - 1]; // addRow's 'r=…' label comes last
  if (lt && lt.element && /^r=/.test(lt.element.textContent)) lt.position.x += dx + 1.2;
}
function pascalRows(upto, dx = 3) { ps.rows = []; ps.n = -1; for (let r = 0; r <= upto; r++) shiftRow(addRow(), dx); }

// ════════ 2-mxYrCNX60（TrevTutor：Pigeonhole Principle） ════════
const pStart = (i) => V3(-5.7 + (i % 2) * 0.75, 0.25, 1.0 - Math.floor(i / 2) * 0.75);
scene('ct-php-basic', '鴿籠原理：4 隻鴿子、3 個籠子', [
  async (tok, S) => { // pigeons = items
    S.b = [0, 1, 2, 3].map((i) => bird(pStart(i)));
    S.lb = L('鴿子 = 物品（items）', 'say', -6.6, 2.2, 0.4);
    cap('左邊：4 隻鴿子', '也叫 items（物品）');
  },
  async (tok, S) => { // pigeonholes = containers
    S.C = crates(3, null, 1.2, 0, 1.6, 0.5);
    L('籠子 = 容器（containers）', 'say', -0.8, 2.2, 0.4);
    cap('右邊：3 個鴿籠', '也叫 containers（容器）');
  },
  async (tok, S) => { // the question
    S.q = T('把鴿子分進籠子：一定會看到什麼？', 'note', 1.2, 3.4, 0);
    cap('問題：不管怎麼分，總會看到什麼？', '');
  },
  async (tok, S) => { // 3,0,1
    const d = [0, 0, 0, 2];
    for (let i = 0; i < 4; i++) { const p = S.C.slot(d[i]); await arc(tok, [S.b[i]], [p], 450, 1.0); }
    cap('隨便放放看', '');
  },
  async (tok, S) => {
    [0, 1, 2].forEach((j) => S.C.name(j, '籠 ' + (j + 1) + '：' + S.C.cnt[j]));
    S.C.hot(0);
    cap('分布 3、0、1', '有一籠不只一隻');
  },
  async (tok, S) => { // only one in each box: take them out again
    S.C.hot(0, false); S.C.cnt.fill(0); [0, 1, 2].forEach((j) => S.C.name(j, '籠 ' + (j + 1)));
    await arc(tok, S.b, S.b.map((b, i) => pStart(i)), 700, 1.0);
    cap('重來：想要每籠只放一隻', '');
  },
  async (tok, S) => {
    for (let i = 0; i < 3; i++) { await arc(tok, [S.b[i]], [S.C.slot(i)], 450, 1.0); S.C.name(i, '籠 ' + (i + 1) + '：1'); }
    cap('一籠一隻、一籠一隻、一籠一隻', '');
  },
  async (tok, S) => { // the extra one
    glw(S.b[3], NG);
    T('多出來這隻怎麼辦？', 'bad', -5.3, 1.4, 0.4);
    cap('第 4 隻沒地方去了', '');
  },
  async (tok, S) => {
    await arc(tok, [S.b[3]], [S.C.slot(0)], 600, 1.3);
    glw(S.b[3], null); S.C.name(0, '籠 1：2'); S.C.hot(0);
    cap('只好塞進已經有鴿子的籠子', '分布 2、1、1');
  },
  async (tok, S) => {
    kill(S.q);
    T('鴿子比籠子多 ⇒ 一定有一籠 ≥ 2 隻', 'note', 1.2, 3.4, 0);
    cap('鴿籠原理：鴿子比籠子多', '就一定有某個籠子不只一隻');
  },
], CAMP);

scene('ct-php-general', '推廣：至少 ⌈m/n⌉ 個', [
  async (tok, S) => {
    S.B = board(-6.6, 4.6, 0.62);
    S.B.add('m 個物品、n 個容器，m > n');
    cap('推廣：m 個物品放進 n 個容器', '物品比容器多');
  },
  async (tok, S) => {
    S.B.add('⇒ 至少有一個容器 ≥ ⌈m/n⌉ 個', 'good');
    cap('至少有一個容器裝了 ⌈m/n⌉ 個', '⌈ ⌉ 叫 ceiling（上取整）');
  },
  async (tok, S) => {
    S.B.add('⌈x.yzw…⌉ = x + 1（有小數就進位）');
    cap('ceiling：有小數就往上進位', '例如 ⌈2.1⌉ = 3（示意）');
  },
  async (tok, S) => { // 4 items, 3 containers
    S.C = crates(3, null, 2.0, 0, 1.4, 0.45);
    S.b = [];
    for (let i = 0; i < 4; i++) { const b = bird(V3(-1.6 + i * 0.5, 4.2, 1.6)); S.b.push(b); }
    await arc(tok, S.b, [0, 1, 2, 0].map((j) => S.C.slot(j)), 900, 0.6);
    S.B.add('4 個放 3 箱：4/3 = 1.333…');
    cap('前面的例子：4 個物品、3 個容器', '4 ÷ 3 = 1.333…');
  },
  async (tok, S) => {
    S.C.hot(0); S.C.name(0, '籠 1：2');
    S.B.add('⌈4/3⌉ = 2 → 有一籠至少 2 隻', 'good');
    cap('ceiling 把 1.333… 進位成 2', '至少有一籠 2 隻');
  },
  async (tok, S) => { // 10 items, 4 containers
    S.b.forEach((b) => kill(b)); S.C.H.forEach((h) => kill(h));
    S.C = crates(4, null, 2.0, 0, 1.25, 0.35);
    S.b = [];
    for (let i = 0; i < 10; i++) S.b.push(bird(V3(-1.8 + (i % 5) * 0.55, 4.0 + Math.floor(i / 5) * 0.5, 1.6)));
    await arc(tok, S.b, S.b.map((b, i) => S.C.slot(i % 4)), 1000, 0.6);
    [0, 1, 2, 3].forEach((j) => S.C.name(j, '籠 ' + (j + 1) + '：' + S.C.cnt[j]));
    S.B.add('10 個放 4 箱：10/4 = 2.5');
    cap('10 個物品、4 個容器', '最平均也只能 3、3、2、2');
  },
  async (tok, S) => {
    S.C.hot(0); S.C.hot(1);
    S.B.add('⌈10/4⌉ = 3 → 至少有一箱 ≥ 3 個', 'good');
    cap('至少有一個容器有 3 個', '當然也可能更多');
  },
  async (tok, S) => { // all ten in one container
    S.C.cnt.fill(0);
    await arc(tok, S.b, S.b.map(() => S.C.slot(0)), 900, 0.8);
    [0, 1, 2, 3].forEach((j) => { S.C.name(j, '籠 ' + (j + 1) + '：' + S.C.cnt[j]); S.C.hot(j, j === 0); });
    cap('也可以 10 個全擠在同一箱', '10 ≥ 3，一樣成立');
  },
  async (tok, S) => {
    S.B.add('不可能「每一箱都 < 3 個」', 'note');
    T('每箱 ≤ 2 → 最多 4 × 2 = 8 < 10', 'bad', 2.0, 3.2, 0);
    cap('不會出現「每箱都少於 3 個」', '因為那樣最多只裝得下 8 個');
  },
], CAMP);

scene('ct-php-friends', '一定有兩人朋友數相同', [
  async (tok, S) => {
    S.B = board(-6.6, 6.3, 0.6);
    S.B.add('n 個人（可能是朋友，也可能是陌生人）');
    cap('一群 n 個人', '有人朋友多、有人不愛交際');
  },
  async (tok, S) => {
    S.B.add('一定有兩個人，群內朋友數一樣', 'good');
    cap('結論：一定有兩人朋友數相同', '');
  },
  async (tok, S) => { // four people
    S.pos = [V3(-5.4, 0.4, -1.4), V3(-2.8, 0.4, -1.4), V3(-2.8, 0.4, 1.4), V3(-5.4, 0.4, 1.4)];
    S.pp = S.pos.map((p, i) => cube(i + 1, FC.blue, [0.75, 0.75, 0.75], p.x, p.y, p.z, 2));
    cap('舉例：4 個人，編號 1、2、3、4', '');
  },
  async (tok, S) => { rod(S.pos[0], S.pos[1], FC.pink, 0.06); cap('1 和 2 是朋友', '連一條線'); },
  async (tok, S) => { rod(S.pos[0], S.pos[3], FC.pink, 0.06); cap('1 和 4 是朋友', ''); },
  async (tok, S) => { rod(S.pos[2], S.pos[3], FC.pink, 0.06); cap('3 和 4 是朋友', ''); },
  async (tok, S) => {
    S.dg = [];
    S.dg.push(T('2 位朋友', 'ptr', S.pos[0].x, 1.3, S.pos[0].z));
    cap('數連出去的線：1 有 2 位朋友', '2 和 4');
  },
  async (tok, S) => {
    [[1, 1], [3, 2], [2, 1]].forEach(([i, d]) => S.dg.push(T(d + ' 位朋友', 'ptr', S.pos[i].x, 1.3, S.pos[i].z)));
    cap('2 有 1 位、4 有 2 位、3 有 1 位', '朋友數：2、1、1、2');
  },
  async (tok, S) => { // abstract
    S.pp.forEach((m) => glow(m, '#000000'));
    S.B.add('n 個人 = 物品（鴿子）');
    cap('抽象一點：n 個人當作物品', '');
  },
  async (tok, S) => {
    S.B.add('每個人可能有幾位朋友？');
    cap('每個人的朋友數，可能是多少？', '');
  },
  async (tok, S) => {
    S.B.add('1、2、…、n − 1 位');
    cap('最少 1 位、最多 n − 1 位', '影片假設每人至少 1 位朋友');
  },
  async (tok, S) => {
    S.B.add('跟所有人都是朋友 → n − 1 位（不算自己）');
    cap('跟其他人全都是朋友：n − 1 位', '');
  },
  async (tok, S) => { // values = containers
    S.C = crates(4, ['1 位', '2 位', '…', 'n−1 位'], 2.3, 0.2, 1.1, 0.3);
    cap('把每一種朋友數當作一個籠子', '共 n − 1 個籠子');
  },
  async (tok, S) => {
    S.B.add('n 個人放進 n − 1 個籠子 ⇒ 必有兩人同籠', 'good');
    cap('n 個人、n − 1 種朋友數', '鴿籠原理：有兩人在同一籠');
  },
  async (tok, S) => { // n-1 people one per container
    S.who = ['人1', '人2', '…', '人n−1'].map((t, j) => { const p = S.C.slot(j); return chip(t, FC.orange, p.x, p.y + 0.05, 0.62, 0.4, 2.5, p.z); });
    cap('先讓 n − 1 個人各占一籠', '1 位、2 位、…、n − 1 位');
  },
  async (tok, S) => { // the n-th person
    const m = chip('人n', FC.red, 2.3, 3.6, 0.62, 0.4, 0, 1.6);
    const p = S.C.slot(1);
    await arc(tok, [m], [V3(p.x, p.y + 0.45, p.z)], 900, 0.8);
    S.C.hot(1);
    cap('第 n 個人只能落進已經有人的籠子', '就有兩人朋友數相同');
  },
  async (tok, S) => {
    S.B.add('影片假設：每人至少 1 位朋友', 'say');
    S.B.add('補充：有人 0 位時就不會有人 n−1 位，仍只有 n−1 種', 'idx');
    cap('影片不討論 0 位朋友', '其實也成立：0 和 n−1 不會同時出現');
  },
]);

const dayCell = (d) => V3((d % 19 - 9) * 0.36, 0.05, (Math.floor(d / 19) - 9.5) * 0.36);
scene('ct-php-birthday', '366 人必有兩人同天生日', [
  async (tok, S) => {
    for (let d = 0; d < 365; d++) ctx.tile(dayCell(d), 0.3, 0.3, ['#e9dcc4', '#e2d2b4'][Math.floor(d / 30.5) % 2]);
    T('365 天（每格 = 一天 = 一個籠子）', 'ptr', 0, 0.2, -4.2);
    S.cnt = T('0 人', 'ptr alt', 4.9, 0.6, 3.3);
    cap('366 個人、一年 365 天', '');
  },
  async (tok, S) => {
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 19; c++) { const d = r * 19 + c; if (d >= 365) break; const p = dayCell(d); cube('', FC.blue, [0.22, 0.22, 0.22], p.x, 0.16, p.z); }
      txt(S.cnt, Math.min(365, (r + 1) * 19) + ' 人');
      await wt(tok, 70);
    }
    const p = dayCell(200);
    S.last = cube('', FC.red, [0.24, 0.24, 0.24], p.x, 0.4, p.z, 3); glow(S.last, NG);
    txt(S.cnt, '366 人');
    cap('故意每天放一人，365 人就放滿了', '第 366 人只能和別人同天');
  },
  async (tok, S) => {
    T('至少 2 人同天：⌈366/365⌉ = 2', 'note', 0, 1.4, 3.8);
    cap('結論永遠是「≥ 2」', '');
  },
  async (tok, S) => {
    const p = dayCell(40);
    S.tall = cube('365 人', FC.purple, [0.3, 3.0, 0.3], p.x, 1.55, p.z);
    T('示意：也可能大家都同一天', 'idx', p.x, 3.4, p.z);
    cap('也可能 365 人都同一天生日', '「至少 2」照樣成立');
  },
  async (tok, S) => {
    T('366 人 → 一定有 ≥ 2 人同天生日', 'good', 0, 2.2, 3.8);
    cap('不管怎麼分：至少兩人同一天', '（2/29 也算的話要 367 人）');
  },
], [[0, 9, 8], [0, 0, 0]]);

scene('ct-php-sum21', '1～20 選 11 個：必有兩數和為 21', [
  async (tok, S) => {
    S.n = {};
    for (let v = 1; v <= 20; v++) S.n[v] = chip(v, FC.card, ((v - 1) % 10 - 4.5) * 0.95, 0.3, 0.62, 0.55, 0, (v > 10 ? 2.6 : 1.7));
    cap('S = {1, 2, …, 20}', '');
  },
  async (tok, S) => {
    S.q = T('任挑 11 個 ⇒ 一定有兩數相加 = 21？', 'note', 0, 2.0, 3.6);
    cap('挑 11 個數，保證有兩個加起來是 21', '怎麼證？');
  },
  async (tok, S) => { cap('難的是：籠子要怎麼設？', ''); T('籠子是什麼？', 'say', 0, 2.6, -1.2); },
  async (tok, S) => {
    S.H = []; for (let j = 0; j < 10; j++) S.H.push(crate((j - 4.5) * 1.25, -1.2, 1.1, 1.2, 0.35, '#c9a878', '{' + (j + 1) + ',' + (20 - j) + '}'));
    cap('把「加起來是 21」的兩數配成一組', '');
  },
  ...[[0, 4], [4, 8], [8, 10]].map(([a, b]) => async (tok, S) => {
    const objs = [], tg = [];
    for (let j = a; j < b; j++) { objs.push(S.n[j + 1], S.n[20 - j]); tg.push(V3(S.H[j].position.x - 0.25, 0.3, -1.2), V3(S.H[j].position.x + 0.25, 0.3, -1.2)); }
    await arc(tok, objs, tg, 800, 0.8);
    cap(Array.from({ length: b - a }, (_, k) => '{' + (a + k + 1) + ',' + (20 - a - k) + '}').join(' '), '每組和都是 21');
  }),
  async (tok, S) => {
    S.H.forEach((h) => h.userData.mat.color.set('#d9c08a'));
    cap('1～20 每個數剛好屬於一組', '共 10 組 = 10 個籠子');
  },
  async (tok, S) => { // try to disprove: one from each pair
    const objs = [], tg = [];
    for (let v = 1; v <= 10; v++) { tint(S.n[v], FC.green); objs.push(S.n[v]); tg.push(V3(S.H[v - 1].position.x - 0.25, 1.1, -1.2)); }
    await arc(tok, objs, tg, 900, 0.5);
    cap('想反駁：每組只挑一個', '挑 1、2、3、…、10');
  },
  async (tok, S) => { cap('這 10 個數，任兩個加起來都不是 21', '只有 10 個而已'); T('挑了 10 個：還沒有和為 21', 'say', 0, 2.6, 3.6); },
  async (tok, S) => { cap('但要挑 11 個：第 11 個一定落進某一組', ''); kill(S.q); S.q = T('第 11 個只能從這些組裡拿', 'note', 0, 2.0, 3.6); },
  async (tok, S) => {
    tint(S.n[19], FC.red); await arc(tok, [S.n[19]], [V3(S.H[1].position.x + 0.25, 1.1, -1.2)], 600, 0.8);
    glow(S.n[2], NG); glow(S.n[19], NG);
    cap('挑 19 → 2 + 19 = 21', '');
  },
  async (tok, S) => {
    tint(S.n[12], FC.red); await arc(tok, [S.n[12]], [V3(S.H[8].position.x + 0.25, 1.1, -1.2)], 600, 0.8);
    glow(S.n[9], NG); glow(S.n[12], NG);
    cap('挑 12 → 9 + 12 = 21', '挑 12 個、17 個也一樣');
  },
  async (tok, S) => { T('⌈11/20⌉？ 錯！', 'bad', -3.6, 3.4, -1.2); cap('不是 ⌈11/20⌉', '籠子不是 20 個數'); },
  async (tok, S) => { T('11 個數 → 10 組：⌈11/10⌉ = 2', 'good', 2.4, 3.4, -1.2); cap('11 個數放進 10 個籠子', '⌈11/10⌉ = 2：有一組兩個都被挑'); },
  async (tok, S) => { cap('關鍵：先把數字分組成籠子', '這就是不明顯的地方'); },
], [[0, 6.5, 12], [0, 0.8, 0]]);

const gs = 0.8; // 1 cm = 0.8 world units: the 8 cm square is 6.4 wide
const gAt = (c, fx, fz) => V3(-4 * gs + (c % 4) * 2 * gs + fx * 2 * gs, 0.2, -4 * gs + Math.floor(c / 4) * 2 * gs + fz * 2 * gs);
function gLines() { const ls = []; for (let i = 1; i < 4; i++) { ls.push(line(-4 * gs + i * 2 * gs, 0.08, -4 * gs, -4 * gs + i * 2 * gs, 0.08, 4 * gs, '#9c8b70')); ls.push(line(-4 * gs, 0.08, -4 * gs + i * 2 * gs, 4 * gs, 0.08, -4 * gs + i * 2 * gs, '#9c8b70')); } return ls; }
const GX = [0.3, 0.7, 0.55, 0.2, 0.8, 0.45, 0.25, 0.65, 0.5, 0.75, 0.35, 0.6, 0.4, 0.8, 0.2, 0.55]; // 示意 positions
scene('ct-php-grid17', '8×8 方格放 17 點：必有兩點距離 ≤ √8', [
  async (tok, S) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(8 * gs, 0.06, 8 * gs), new THREE.MeshStandardMaterial({ color: '#f4ecdc' }));
    base.position.set(0, 0.03, 0); base.receiveShadow = true; lab.world.add(base);
    cap('一個正方形的格子', '每一格大小一樣');
  },
  async (tok, S) => {
    S.gl = gLines();
    T('每格 2 cm', 'ptr', -3 * gs, 0.2, 4 * gs + 0.5); T('8 cm × 8 cm', 'ptr', 2 * gs, 0.2, 4 * gs + 0.5);
    cap('每一小格邊長 2 cm', '整個是 8 cm × 8 cm');
  },
  async (tok, S) => { S.q = T('17 個點 ⇒ 有兩點距離 ≤ √8 cm', 'note', 0, 1.4, -4 * gs - 0.6); cap('放 17 個點', '一定有兩點距離在 √8 cm 以內'); },
  async (tok, S) => { cap('不管點放在哪裡都成立', '很神奇的證明'); },
  async (tok, S) => { S.gl.forEach((l) => { l.material.color.set('#c08a1f'); }); cap('老師很好心：直接畫好 16 個小方格', ''); },
  async (tok, S) => {
    S.pts = [];
    for (let c = 0; c < 16; c++) { const p = gAt(c, GX[c], GX[15 - c]); S.pts.push(ball('', FC.blue, 0.13, p.x, p.y, p.z, 2)); await wt(tok, 60); }
    const q = gAt(5, 0.85, 0.15); S.p17 = ball('', FC.red, 0.14, q.x, q.y, q.z, 3);
    glw(S.pts[5], NG); glw(S.p17, NG);
    cap('16 格各放一點，第 17 點一定和別人同格', '（點的位置是示意）');
  },
  async (tok, S) => { S.gl.forEach((l) => { l.visible = false; }); cap('如果只說「8 cm × 8 cm」不畫格子呢？', '就難多了'); },
  async (tok, S) => { kill(S.q); S.q = T('反過來問：最少要幾點？', 'note', 0, 1.4, -4 * gs - 0.6); cap('再難一點：最少要幾個點才保證？', '倒過來推'); },
  async (tok, S) => {
    S.dia = rod(V3(-4 * gs, 0.12, -4 * gs), V3(-2 * gs, 0.12, -2 * gs), FC.gold, 0.045);
    T('對角線 = 最遠距離 √8', 'ptr alt', -3 * gs, 0.6, -3 * gs);
    cap('同一小塊裡，最遠的是對角線', '要它等於 √8');
  },
  async (tok, S) => { T('√(2² + 2²) = √8 → 2 × 2 的方塊', 'say', -3 * gs, 1.1, -3 * gs - 0.4); cap('√8 = √(2² + 2²)', '所以小塊是 2 × 2'); },
  async (tok, S) => { S.gl.forEach((l) => { l.visible = true; }); cap('用 2 × 2 的方塊把正方形鋪滿', ''); },
  async (tok, S) => { T('16 個籠子：要 ⌈N/16⌉ = 2', 'note', 0, 1.9, 4 * gs + 0.9); cap('共 16 塊 = 16 個籠子', '要 ⌈N/16⌉ = 2 的最小 N'); },
  async (tok, S) => { T('最小 N = 17', 'good', 3.6, 1.2, 4 * gs + 0.9); cap('所以 N = 17', '16 點可以每格一點，還不保證'); },
  async (tok, S) => { cap('這類題目考的是：怎麼設計籠子', '考試很常見'); },
], [[0, 9.5, 8.5], [0, 0, 0.2]]);

// ════════ DBugSTeX1zw（TrevTutor：Permutations and Combinations Review） ════════
const CAMR = [[0, 6.5, 11.5], [0, 0.8, 0]];
scene('ct-pc-tales', 'TALES 的排列：5! = 120', [
  async (tok, S) => {
    S.W = ['T', 'A', 'L', 'E', 'S']; S.m = {};
    S.W.forEach((ch, i) => { S.m[ch] = cube(ch, FC.blue, [0.9, 0.9, 0.9], (i - 2) * 1.3, 0.45, -1.8, 2); });
    cap('TALES 這 5 個字母有幾種排法？', '');
  },
  async (tok, S) => {
    S.ex = T('例如 A T E S L 也是一種新順序', 'say', 0, 2.2, -1.8);
    cap('字母可以換來換去', '例如 A T E S L');
  },
  async (tok, S) => {
    kill(S.ex);
    S.cnt = [];
    for (let k = 0; k < 5; k++) { ctx.tile(V3((k - 2) * 1.5, 0.04, 1.6), 1.2, 1.2); T('第 ' + (k + 1) + ' 格', 'idx', (k - 2) * 1.5, 0, 2.6); S.cnt.push(T('', 'ptr alt', (k - 2) * 1.5, 1.6, 1.6)); }
    txt(S.cnt[0], '5 種');
    cap('第 1 格：5 個字母都能放', '5 種');
  },
  async (tok, S) => {
    for (let k = 1; k < 5; k++) { txt(S.cnt[k], (5 - k) + ' 種'); await wt(tok, 250); }
    cap('第 2 格剩 4 種、再來 3、2、1', '每放一個就少一個');
  },
  async (tok, S) => {
    S.f = T('5 × 4 × 3 × 2 × 1 = 5! = 120', 'note', 0, 3.0, 0);
    cap('5 × 4 × 3 × 2 × 1', '= 5!（5 階乘）= 120');
  },
  ...[['L', '第 1 格挑 L', 'L'], ['S', '剩 A T E S，挑 S', 'L S'], ['E', '剩 A T E，挑 E', 'L S E'], ['A', '剩 A、T，挑 A，最後放 T', 'L S E A T']].map(([ch, a, b], k) => async (tok, S) => {
    const pick = (c, slot) => { tint(S.m[c], FC.pink); move(S.m[c], (slot - 2) * 1.5, 0.5, 1.6); };
    pick(ch, k); if (ch === 'A') { await wt(tok, 500); pick('T', 4); }
    cap(a, b);
  }),
  async (tok, S) => { kill(S.f); T('不重複的排列（permutation without repetition）：5! = 120', 'good', 0, 3.0, 0); cap('這就是「不重複的排列」', 'n 個不同的東西排一列：n!'); },
], CAMR);

scene('ct-pc-barbaric', 'BARBARIC：8!/(2!·2!·2!) = 5040', [
  async (tok, S) => {
    S.L = [['B', '₁', FC.blue], ['A', '₁', FC.purple], ['R', '₁', FC.orange], ['B', '₂', FC.blue], ['A', '₂', FC.purple], ['R', '₂', FC.orange], ['I', '', FC.gray], ['C', '', FC.gray]];
    S.m = [];
    for (let i = 0; i < 3; i++) S.m.push(cube(S.L[i][0], S.L[i][2], [0.85, 0.85, 0.85], (i - 3.5) * 1.15, 1.6, 0, 2));
    cap('換一個字：BARBARIC', '先寫 B、A、R');
  },
  async (tok, S) => {
    for (let i = 3; i < 8; i++) { S.m.push(cube(S.L[i][0], S.L[i][2], [0.85, 0.85, 0.85], (i - 3.5) * 1.15, i < 6 ? 0.43 : 1.6, 0, 2)); await wt(tok, 200); }
    cap('又出現 B、A、R，還有 I、C', '共 8 個字母');
  },
  async (tok, S) => {
    S.m.forEach((m, i) => move(m, (i - 3.5) * 1.15, 0.43, 0));
    S.B = board(-6.6, 4.8, 0.62); S.B.add('8 個位置：先當作全都不同 → 8! = 40320');
    cap('8 個位置要填', '先假裝都不同：8!');
  },
  async (tok, S) => {
    [[0, 3], [1, 4], [2, 5]].forEach(([a, b]) => { glow(S.m[a], HL); glow(S.m[b], HL); });
    cap('可是 B 一樣、A 一樣、R 也一樣', '');
  },
  async (tok, S) => {
    S.m.forEach((m) => glow(m, '#000000'));
    S.ord = [0, 3, 1, 4, 2, 5, 6, 7];
    S.ord.forEach((idx, pos) => move(S.m[idx], (pos - 3.5) * 1.15, 0.43, 0));
    S.m.forEach((m, i) => relabel(m, S.L[i][0] + S.L[i][1]));
    cap('排成 B B A A R R I C 看看', '標上 ₁、₂ 分辨');
  },
  async (tok, S) => {
    move(S.m[0], (1 - 3.5) * 1.15, 1.5, 0); move(S.m[3], (0 - 3.5) * 1.15, 1.5, 0);
    await wt(tok, 900);
    move(S.m[0], (1 - 3.5) * 1.15, 0.43, 0); move(S.m[3], (0 - 3.5) * 1.15, 0.43, 0);
    cap('B₁ B₂ 和 B₂ B₁', '看起來是同一個字');
  },
  async (tok, S) => { S.B.add('每個字的 B 被算了 2 次 → ÷ 2!'); relabel(S.m[0], 'B'); relabel(S.m[3], 'B'); cap('每對 B 被算了兩次', '除以 2!'); },
  async (tok, S) => {
    S.B.add('A 也算兩次 → ÷ 2!；R 也是 → ÷ 2!');
    [1, 4, 2, 5].forEach((i) => relabel(S.m[i], S.L[i][0]));
    cap('A、R 也一樣', '再除兩次 2!');
  },
  async (tok, S) => { S.B.add('8! / (2!·2!·2!) = 40320 / 8 = ' + fact(8) / 8, 'good'); cap('8! / (2!·2!·2!)', '= ' + fact(8) / 8); },
  async (tok, S) => { S.B.add('多項係數：(8; 2, 2, 2, 1, 1)'); cap('也可以寫成多項係數', '8 分成 2、2、2、1、1'); },
  async (tok, S) => { S.B.add('I、C 各 1 個：÷ 1! = 1，可以省略', 'say'); cap('其實也除了 1!（I、C）', '1! = 1，省略不寫'); },
  async (tok, S) => { S.B.add('TALES 其實是 5!/(1!·1!·1!·1!·1!) = 120', 'say'); cap('前一題 TALES 也能這樣寫', '只是不必要'); },
], CAMR);

const CAML = [[0, 8.5, 9.5], [0, 0.8, -0.3]];
scene('ct-pc-lattice', '格子路徑 (0,0)→(4,4)：8!/(4!4!) = 70', [
  async (tok, S) => { S.P = grid(4, 4, 1.3, -2.6, 2.6); cap('格子路徑（lattice path）', '下一支影片會用到'); },
  async (tok, S) => {
    T('A', 'ptr', -2.6 - 0.5, 0.2, 3.2); T('B', 'ptr alt', 2.6 + 0.5, 0.2, -3.2);
    T('E = 往東', 'idx', 4.6, 0, 2.2); T('N = 往北', 'idx', 4.6, 0, 1.6);
    cap('從 A 走到 B', '只准往北（N）或往東（E）');
  },
  async (tok, S) => { T('(0,0)', 'idx', -2.6 - 0.5, 0.2, 3.7); T('(4,4)', 'idx', 2.6 + 0.5, 0.2, -3.7); cap('(0,0) → (4,4)', '往右 4 格、往上 4 格'); },
  async (tok, S) => { S.seg = await walkPath((ms) => wt(tok, ms), S.P, 'EEEE', [0, 0], FC.blue, 260, V3(-2.3, 3.2, -3.6)); cap('像在拼一個字：E E E E', '先往東 4 次'); },
  async (tok, S) => { S.seg = S.seg.concat(await walkPath((ms) => wt(tok, ms), S.P, 'NNNN', [4, 0], FC.blue, 260, V3(0.3, 3.2, -3.6))); cap('再往北 4 次：N N N N', 'E E E E N N N N 是一條路'); },
  async (tok, S) => { S.w2 = T('重新排列 → N E N N E N E E', 'note', 0, 4.4, -3.6); cap('把字母重新排列', '就得到另一條路'); },
  async (tok, S) => { S.seg.forEach(kill); S.seg = await walkPath((ms) => wt(tok, ms), S.P, 'NENNENEE', [0, 0], FC.pink, 260, V3(-2.3, 3.2, -3.6)); cap('畫出來：北、東、北、北、東、北、東、東', '路徑 ↔ 字母排列'); },
  async (tok, S) => { cap('有幾種排法，就有幾條不同的路', ''); },
  async (tok, S) => { T('8! / (4!·4!) = ' + fact(8) / (fact(4) * fact(4)), 'good', 0, 1.2, 3.9); cap('8 個字母：4 個 N 一樣、4 個 E 一樣', '8! / (4!·4!) = 70'); },
], CAML);

scene('ct-pc-latgen', '一般格子路徑：(m+n)!/(m!·n!)', [
  async (tok, S) => {
    S.P = grid(6, 5, 1.0, -3, 2.5);
    const A = S.P(1, 1), B = S.P(5, 4); S.A = A; S.Bp = B;
    ball('', FC.blue, 0.22, A.x, 0.25, A.z); ball('', FC.gold, 0.22, B.x, 0.25, B.z);
    T('(a, b)', 'ptr', A.x - 0.6, 0.6, A.z + 0.4); T('(c, d)', 'ptr alt', B.x + 0.4, 0.6, B.z - 0.4);
    cap('一般化：從 (a, b) 走到 (c, d)', '（圖上位置是示意）');
  },
  async (tok, S) => { cap('要往上走幾步、往右走幾步？', ''); },
  async (tok, S) => { rod(V3(S.A.x, 0.15, S.A.z), V3(S.Bp.x, 0.15, S.A.z), FC.blue, 0.1); T('Δx = c − a（往東）', 'ptr', (S.A.x + S.Bp.x) / 2, 0.5, S.A.z + 0.6); cap('x 從 a 變到 c', '往東 c − a 步'); },
  async (tok, S) => { rod(V3(S.Bp.x, 0.15, S.A.z), V3(S.Bp.x, 0.15, S.Bp.z), FC.green, 0.1); T('Δy = d − b（往北）', 'ptr', S.Bp.x + 1.3, 0.5, (S.A.z + S.Bp.z) / 2); cap('y 從 b 變到 d', '往北 d − b 步'); },
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.6); S.B.add('總步數 = (c − a) + (d − b)'); cap('總共要走幾步？', '東的步數 + 北的步數'); },
  async (tok, S) => { S.B.add('分子：((c − a) + (d − b))!'); cap('全部字母的排列', '((c−a)+(d−b))!'); },
  async (tok, S) => { S.B.add('÷ (c − a)! · (d − b)!（E 一樣、N 一樣）'); cap('再除掉相同字母', 'c − a 個 E、d − b 個 N'); },
  async (tok, S) => { S.B.add('令 m = c − a, n = d − b → (m + n)! / (m!·n!)', 'good'); cap('令 m = c − a、n = d − b', '(m+n)! / (m!·n!)'); },
  async (tok, S) => { S.B.add('終點在左下方、只准往東北 → 其實是 0 條', 'bad'); cap('若要往左下走呢？', '只准往東北的話，答案是 0'); },
  async (tok, S) => { S.B.add('= C(m + n, m) = C(m + n, n)', 'good'); cap('也可以寫成組合數', 'C(m+n, m) = C(m+n, n)'); },
], CAML);

const CAMQ = [[0, 3.5, 12], [0, 1.2, 0]];
const SEVEN = [0, 1, 3, 4, 6, 8, 9]; // 示意：其中一種選法
scene('ct-pc-ch7', '10 題選 7 題：C(10,7) = C(10,3) = 120', [
  async (tok, S) => { S.cs = cards(10); cap('考試 10 題，要答 7 題', ''); },
  async (tok, S) => { for (const i of SEVEN) { up(S.cs[i], FC.green); await wt(tok, 150); } cap('沒有任何限制', '只在乎選了哪 7 題（示意一種）'); },
  async (tok, S) => { S.f = T('C(10,7) = 10! / (7!·3!) = ' + Cb(10, 7), 'note', 0, 3.4, 0); cap('10 選 7', '10! / (7!·3!)'); },
  async (tok, S) => { T('C(n, k) = n! / (k!·(n − k)!)', 'say', 0, 4.1, 0); cap('一般公式', 'C(n,k) = n!/(k!(n−k)!)'); },
  async (tok, S) => {
    S.cs.forEach((m, i) => { if (!SEVEN.includes(i)) glow(m, NG); });
    T('C(n, k) = C(n, n − k)：選 7 題作答 = 選 3 題不答 → C(10,3) = ' + Cb(10, 3), 'good', 0, 4.8, 0);
    cap('C(n,k) = C(n, n−k)', '展開來是同一個式子');
  },
  async (tok, S) => { cap('這個一定要記住', '考試會很開心'); },
], CAMQ);

scene('ct-pc-first2', '前兩題必答：C(2,2)·C(8,5) = 56', [
  async (tok, S) => { S.cs = cards(10); cap('如果第 1、2 題一定要答呢？', ''); },
  async (tok, S) => { up(S.cs[0], FC.gold); up(S.cs[1], FC.gold); T('前 2 題：C(2,2) = 1', 'ptr', -5.0, 2.7, 0); cap('前兩題兩題都選', 'C(2,2) = 1 種'); },
  async (tok, S) => { for (const i of [2, 4, 5, 7, 9]) { up(S.cs[i], FC.green); await wt(tok, 150); } cap('剩下 8 題，還要再選 5 題', '7 − 2 = 5（示意一種）'); },
  async (tok, S) => { T('1 × C(8,5) = ' + Cb(8, 5), 'note', 0, 3.4, 0); cap('C(2,2) = 1', '答案 1 × C(8,5)'); },
  async (tok, S) => { cap('其實就是：後 8 題選 5 題', 'C(8,5) = 56'); },
], CAMQ);

scene('ct-pc-atleast4', '前 6 題至少答 4 題：60 + 36 + 4 = 100', [
  async (tok, S) => { S.cs = cards(10, 6); cap('前 6 題中至少要答 4 題', '一共答 7 題'); },
  async (tok, S) => { S.B = board(-6.6, 5.6, 0.55); S.B.add('前 6 選 4 · 後 4 選 3：C(6,4)·C(4,3)'); cap('前 6 題選 4、後 4 題選 3', ''); },
  async (tok, S) => { T('前 6 題', 'ptr', -3.2, 0, 1.2); T('後 4 題', 'ptr', 3.8, 0, 1.2); cap('分成兩區', '前 6 題｜後 4 題'); },
  async (tok, S) => { for (const i of [0, 1, 3, 4]) up(S.cs[i], FC.green); cap('前區挑第 1、2、4、5 題', ''); },
  async (tok, S) => { for (const i of [7, 8, 9]) up(S.cs[i], FC.blue); cap('後區挑第 8、9、10 題', ''); },
  async (tok, S) => {
    down(S.cs[8]); up(S.cs[6], FC.blue);
    S.B.add('= 15 · 4 = 60（後區也可以換成 7、8、10）');
    cap('後區的選法也會變：7、8、10', '兩區各自選 → 相乘');
  },
  async (tok, S) => {
    S.cs.forEach(down); await wt(tok, 300);
    for (const i of [0, 1, 2, 3, 4]) up(S.cs[i], FC.green); for (const i of [8, 9]) up(S.cs[i], FC.blue);
    S.B.add('前 6 選 5 · 後 4 選 2：C(6,5)·C(4,2) = 6 · 6 = 36');
    cap('「至少」4 題：也可以前區答 5 題', '後區只剩 2 題');
  },
  async (tok, S) => {
    S.cs.forEach(down); await wt(tok, 300);
    for (const i of [0, 1, 2, 3, 4, 5]) up(S.cs[i], FC.green); up(S.cs[9], FC.blue);
    S.B.add('前 6 全選 · 後 4 選 1：C(6,6)·C(4,1) = 1 · 4 = 4');
    cap('前 6 題全答', '後區只選 1 題');
  },
  async (tok, S) => { S.B.add('寫成 Σ：i 從 4 到 6 … C(6, i)·C(4, ?)'); cap('三種情況互斥 → 相加', '試著寫成 Σ'); },
  async (tok, S) => { S.B.add('Σ_{i=0}^{2} C(6, 4 + i)·C(4, 3 − i)', 'good'); cap('改用 i 從 0 到 2', 'C(6,4+i)·C(4,3−i)'); },
  async (tok, S) => { const tot = [0, 1, 2].reduce((a, i) => a + Cb(6, 4 + i) * Cb(4, 3 - i), 0); S.B.add('= 60 + 36 + 4 = ' + tot, 'good'); cap('Σ 只是簡潔的寫法', '答案 ' + tot); },
], [[0, 4, 13], [0, 1.6, 0]]);

const CAMS = [[0, 6.5, 11], [0, 0.6, -0.5]];
scene('ct-pc-sb12', '星棒法：x₁+x₂+x₃ = 12 → C(14,2) = 91', [
  async (tok, S) => { cap('換成「可以重複」的組合', 'combinations with repetition'); },
  async (tok, S) => { S.f = T('x₁ + x₂ + x₃ = 12 有幾組非負整數解？', 'note', 0, 3.4, -2.6); cap('x₁ + x₂ + x₃ = 12', '有幾組整數解？'); },
  async (tok, S) => { [0, 1, 2].forEach((b) => crate((b - 1) * 3, -2.6, 2.2, 1.4, 0.4, '#c9a878', 'x' + (b + 1))); cap('3 個不同的箱子 x₁、x₂、x₃', '把 12 個東西分進去'); },
  async (tok, S) => {
    S.pre = []; const comp = [6, 2, 4];
    comp.forEach((c, b) => { for (let i = 0; i < c; i++) { const p = slotIn((b - 1) * 3, -2.6, i, 0.3, 0.3, 0.2); S.pre.push(ball('', FC.gold, 0.16, p.x, p.y, p.z, 2)); } });
    T('6 + 2 + 4', 'ptr', 0, 0.2, -1.2);
    cap('箱子可以是 0 個以上', '例如 6、2、4');
  },
  async (tok, S) => {
    S.pre.forEach(kill);
    S.S = sbBuild(12, 3, 0.8);
    S.S.bars.forEach((m) => { m.visible = false; }); S.S.gl.forEach((l) => { l.element.style.visibility = 'hidden'; });
    S.S.stars.forEach((m, i) => dropOn(m, (i - 5.5) * S.S.sp, S.S.y, S.S.z));
    cap('把 12 個排成一列', '');
  },
  async (tok, S) => {
    S.S.bars.forEach((m) => { m.visible = true; }); S.S.gl.forEach((l) => { l.element.style.visibility = ''; });
    sbLayout(S.S, [6, 2, 4]);
    cap('3 個箱子 → 插 2 根隔板', 'x₁ = 6，x₂ = 2，x₃ = 4');
  },
  async (tok, S) => { sbLayout(S.S, [0, 12, 0]); cap('隔板也可以都放兩端', 'x₁ = 0，x₂ = 12，x₃ = 0'); },
  async (tok, S) => { S.S.bars.forEach((m) => glow(m, HL)); T('14 個位置挑 2 個放隔板', 'ptr alt', 0, 2.0, 0.8); cap('其實是 14 個位置', '挑 2 個放隔板'); },
  async (tok, S) => { kill(S.f); S.f = T('C(14, 12) = C(14, 2) = ' + Cb(14, 2), 'good', 0, 3.4, -2.6); cap('14 選 2', '= 14 選 12 = 91'); },
  async (tok, S) => { T('另一種看法：3 箱 + 12 個 − 1 = 14，選 12', 'say', 0, 2.8, 0.8); cap('箱數 + 物品數 − 1', '再選 12'); },
  async (tok, S) => { T('x₁ + … + xₙ = k → C(n + k − 1, k) = C(n + k − 1, n − 1)', 'note', 0, 4.1, -2.6); cap('一般公式', 'C(n+k−1, k) = C(n+k−1, n−1)'); },
  async (tok, S) => { cap('這題 n = 3、k = 12', 'C(3 + 12 − 1, 12) = C(14,12)'); },
], CAMS);

scene('ct-pc-sblow', '每個 xᵢ ≥ 2：先放下限 → C(8,2) = 28', [
  async (tok, S) => { [0, 1, 2].forEach((b) => crate((b - 1) * 3, -2.6, 2.2, 1.4, 0.4, '#c9a878', 'x' + (b + 1))); S.B = board(-6.6, 4.9, 0.55); S.B.add('x₁ + x₂ + x₃ = 12，每個 xᵢ ≥ 2'); cap('加條件：每個箱子至少 2 個', ''); },
  async (tok, S) => { S.B.add('換變數：影片寫 x₁′ = x₁ + 2'); cap('做變數代換', '把問題改寫'); },
  async (tok, S) => { S.B.add('目標：變回「≥ 0」的標準題'); cap('我們只會算 ≥ 0 的', '把下限移到 0'); },
  async (tok, S) => {
    for (let b = 0; b < 3; b++) { for (let i = 0; i < 2; i++) cube('', FC.orange, [0.45, 0.4, 0.45], (b - 1) * 3 + (i ? 0.35 : -0.35), 0.25, -2.6, 3); await wt(tok, 300); }
    S.B.add('x₂、x₃ 也一樣：每箱先放 2 個');
    cap('等於每個箱子先放 2 個', 'x₁、x₂、x₃ 都一樣');
  },
  async (tok, S) => { S.B.add('右邊要扣掉先放的 2'); cap('方程式右邊扣掉', '先放掉的部分'); },
  async (tok, S) => {
    S.B.add('12 − 2 − 2 − 2 = 6：新變數總和 = 6，都 ≥ 0', 'good');
    S.S = sbBuild(6, 3, 0.9); sbLayout(S.S, [2, 3, 1], true, [2, 2, 2]);
    cap('剩 6 個自由分配', '新變數都 ≥ 0');
  },
  async (tok, S) => { S.B.add('C(3 + 6 − 1, 6) = C(8, 6) = C(8, 2) = ' + Cb(8, 2), 'good'); sbLayout(S.S, [0, 4, 2], false, [2, 2, 2]); cap('3 箱選 6、減 1', 'C(8,6) = C(8,2) = 28'); },
  async (tok, S) => { S.B.add('容斥原理的題目會再用到', 'say'); cap('之後講容斥原理會用到', '先記住這招'); },
], CAMS);

scene('ct-pc-balls', '8 顆白球放 4 個不同箱子', [
  async (tok, S) => { [0, 1, 2, 3].forEach((b) => crate((b - 1.5) * 2.6, -2.6, 2, 1.4, 0.4, '#c9a878', '箱 ' + (b + 1))); cap('文字題：8 顆白球放進 4 個不同箱子', '題目說「沒有空箱」'); },
  async (tok, S) => { S.f = T('x₁ + x₂ + x₃ + x₄ = 8', 'note', 0, 3.4, -2.6); cap('4 個不同箱子 = 4 個變數', 'x₁ + x₂ + x₃ + x₄ = 8'); },
  async (tok, S) => {
    S.S = sbBuild(8, 4, 0.9); S.S.stars.forEach((m) => tint(m, '#f4efe6')); sbLayout(S.S, [3, 0, 4, 1], true);
    T('影片：C(4 + 8 − 1, 8) = C(11, 8) = ' + Cb(11, 8), 'say', 0, 2.6, 0.9);
    cap('套公式', 'C(4+8−1, 8) = C(11,8) = 165');
  },
  async (tok, S) => {
    T('xᵢ ≥ 0 是「可以空箱」→ 165', 'bad', -3.4, 4.2, -2.6);
    T('真的不空：先各放 1，剩 4 → C(7,3) = ' + Cb(7, 3), 'good', 3.0, 4.2, -2.6);
    cap('注意：影片這裡用 xᵢ ≥ 0', '真的要求不空，答案是 35');
  },
], CAMS);

scene('ct-pc-odd', 'x₄ 必為奇數：36 + 21 + 10 + 3 = 70', [
  async (tok, S) => {
    [-4.2, -1.6, 1.0].forEach((x, b) => crate(x, -2.6, 2, 1.4, 0.4, '#c9a878', 'x' + (b + 1)));
    S.c4 = crate(4.2, -2.6, 2, 1.4, 0.4, '#e3c06a', 'x₄（奇數）');
    S.B = board(-6.6, 5.8, 0.55); S.B.add('x₁ + x₂ + x₃ + x₄ = 8，x₄ 是奇數');
    cap('同一個方程式', '限制：x₄ 必須是奇數');
  },
  async (tok, S) => { S.B.add('x₄ ∈ {1, 3, 5, 7} → 拆成 4 題'); cap('x₄ 只能是 1、3、5、7', '分成 4 個小題'); },
  async (tok, S) => {
    S.in4 = []; for (let i = 0; i < 1; i++) { const p = slotIn(4.2, -2.6, i, 0.3, 0.3, 0.2); S.in4.push(ball('', FC.pink, 0.18, p.x, p.y, p.z, 2.5)); }
    S.B.add('x₄ = 1：x₁ + x₂ + x₃ + 1 = 8');
    cap('x₄ = 1 的情況', 'x₁ + x₂ + x₃ + 1 = 8');
  },
  async (tok, S) => { S.B.add('x₄ = 3、5、7：+3 = 8、+5 = 8、+7 = 8'); cap('x₄ = 3、5、7 也各一題', ''); },
  async (tok, S) => { cap('四種情況分開算，再全部加起來', '互斥 → 加法原理'); },
  ...[[1, 7], [3, 5], [5, 3], [7, 1]].map(([x4, r]) => async (tok, S) => {
    S.in4.forEach(kill); S.in4 = [];
    for (let i = 0; i < x4; i++) { const p = slotIn(4.2, -2.6, i, 0.3, 0.3, 0.2); S.in4.push(ball('', FC.pink, 0.18, p.x, p.y, p.z, 2.5)); }
    if (S.S) { S.S.stars.forEach(kill); S.S.bars.forEach(kill); S.S.gl.forEach(kill); }
    S.S = sbBuild(r, 3, 0.9); const comp = [0, 0, 0]; for (let i = 0; i < r; i++) comp[i % 3]++; sbLayout(S.S, comp, true);
    const v = Cb(3 + r - 1, r);
    S.B.add('x₄ = ' + x4 + '：x₁+x₂+x₃ = ' + r + ' → C(' + (r + 2) + ', ' + r + ') = ' + v + (x4 === 7 ? '　合計 = 70' : ''), x4 === 7 ? 'good' : 'note');
    cap('x₁ + x₂ + x₃ = ' + r, '3 + ' + r + ' − 1 = ' + (r + 2) + '，選 ' + r + ' → ' + v);
  }),
], CAMS);

// ════════ aLDHXK2M2yk（交大 易志偉 Lec14：Counting 1/2 — 加法／乘法原理、密碼、IP、樹狀圖） ════════
// a small horizontal tree: nodes = list of prefixes (strings) that are allowed; leaves spread on y.
function prefixTree(prefixes, alpha, x0, dx, yTop, yBot, sz = 0.42) {
  const leaves = prefixes.filter((p) => !prefixes.some((q) => q.length === p.length + 1 && q.startsWith(p)));
  leaves.sort((a, b) => (a < b ? -1 : 1));
  const pos = {}, sp = leaves.length > 1 ? (yTop - yBot) / (leaves.length - 1) : 0;
  leaves.forEach((p, i) => { pos[p] = yTop - i * sp; });
  const byLen = [...prefixes].sort((a, b) => b.length - a.length);
  for (const p of byLen) if (pos[p] === undefined) { const ch = prefixes.filter((q) => q.length === p.length + 1 && q.startsWith(p)); pos[p] = ch.reduce((s, q) => s + pos[q], 0) / ch.length; }
  const nodes = {};
  return {
    pos, leaves, nodes,
    show(len, color = FC.blue) { // reveal every node of this length
      for (const p of prefixes.filter((q) => q.length === len)) {
        const x = x0 + len * dx, y = pos[p];
        if (len > 0) { const par = p.slice(0, -1); line(x0 + (len - 1) * dx, pos[par], 0, x, y, 0, '#b9a684'); }
        const m = cube(len ? p[p.length - 1] : '·', len ? color : FC.gray, [sz, sz, sz], x, y, 0, 0);
        nodes[p] = m;
      }
    },
  };
}
scene('ct-l14-tools', '本章的計數工具', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.62); S.B.add('5-1、5-2：計數的基本工具'); cap('這一章：計數（counting）', '以前用過的工具，講得更深入'); },
  async (tok, S) => { S.B.add('① 加法原理、乘法原理'); cap('第一個：加法原理、乘法原理', ''); },
  async (tok, S) => { S.B.add('② 排容原理（inclusion–exclusion）'); cap('再來：排容原理', '前面講過很多次'); },
  async (tok, S) => { S.B.add('③ 樹狀圖：幫你把情況列舉出來'); cap('容易被忽略的工具：樹狀圖', '其實只是列舉的工具'); },
  async (tok, S) => {
    S.B.add('④ 鴿籠原理');
    S.C = crates(4, ['A', 'B', 'C', 'D'], 2.4, 0, 1.2, 0.35);
    const who = [0, 1, 2, 3, 1].map((j, i) => { const p = S.C.slot(j); return chip('人' + (i + 1), FC.orange, p.x, p.y + 0.05, 0.6, 0.4, 2.5, p.z); });
    S.C.hot(1);
    T('5 人、4 個等級 → 至少 2 人同等級', 'note', 2.4, 2.4, 0);
    cap('成績有 A、B、C、D 四級，5 個人', '至少有兩人成績一樣');
  },
], [[0, 5.2, 12.5], [0, 2.6, 0]]);

// cities and routes
function city(name, x, z = 0) { const m = cube('', '#e9dcc4', [1.3, 0.5, 1.0], x, 0.25, z); T(name, 'ptr', x, 0.9, z); return m; }
function routes(xa, xb, k, color, z = 0, h0 = 0.6) { const rs = []; for (let i = 0; i < k; i++) { const zz = z + (i - (k - 1) / 2) * 0.55; rs.push(rod(V3(xa + 0.65, 0.3, zz), V3(xb - 0.65, 0.3, zz), color, 0.05)); } return rs; }
scene('ct-l14-rules', '加法原則與乘法原則', [
  async (tok, S) => { S.B = board(-6.6, 5.6, 0.6); S.B.add('第一件事 m 種做法、第二件事 n 種'); cap('兩件事情', '第一件 m 種、第二件 n 種'); },
  async (tok, S) => { S.B.add('挑一件做 → m + n（加法原則）', 'good'); cap('兩件挑一件做', 'm + n：加法原則'); },
  async (tok, S) => { S.B.add('兩件都做 → m × n（乘法原則）', 'good'); T('示意：2 × 3 = 6', 'say', 4.2, 5.0, 0); cap('兩個作業題目都要交', '2 × 3 = 6 種：乘法原則'); },
  async (tok, S) => { S.tp = city('臺北', -4.5, 1.5); S.tc = city('臺中', 0, 1.5); S.kh = city('高雄', 4.5, 1.5); cap('畫成圖：臺北、臺中、高雄', ''); },
  async (tok, S) => { routes(-4.5, 0, 3, FC.blue, 1.5); T('m 種（高鐵、客運…）', 'idx', -2.25, 0.6, 2.6); cap('臺北到臺中：m 種坐法', '高鐵、公路局…'); },
  async (tok, S) => { routes(0, 4.5, 2, FC.green, 1.5); T('n 種', 'idx', 2.25, 0.6, 2.6); T('臺北→臺中→高雄：m × n', 'good', 0, 2.0, 1.5); cap('臺中到高雄：n 種', '兩段都要走：m × n'); },
  async (tok, S) => { S.yl = city('宜蘭', 4.5, -2.0); for (let i = 0; i < 3; i++) rod(V3(-3.85, 0.3, 1.0 - i * 0.3), V3(3.85, 0.3, -1.6 - i * 0.3), FC.orange, 0.05); T('開車：示意 3 條路', 'idx', 0, 0.6, -0.6); cap('臺北到宜蘭：開車有幾條路', ''); },
  async (tok, S) => { for (let i = 0; i < 3; i++) rod(V3(-3.85, 0.9 + i * 0.35, 1.2), V3(3.85, 0.9 + i * 0.35, -2.0), FC.purple, 0.04); T('或坐飛機、直升機、船', 'idx', 0, 2.2, -0.6); cap('也可以坐飛機、直升機、坐船', '只要選一種方式'); },
  async (tok, S) => { T('臺北→宜蘭：m + n', 'good', 0, 2.8, -2.0); cap('二選一：m + n', '加法原則'); },
], [[0, 6.5, 12.5], [0, 1.6, 0]]);

scene('ct-l14-seats', '座位標籤：字母 × 數字', [
  async (tok, S) => { cap('例子：教室椅子的座號', '有兩個標籤'); S.B = board(-6.6, 6.0, 0.6); S.B.add('座號 = 英文字母 + 數字'); },
  async (tok, S) => { S.s = [cube('A', FC.blue, [0.9, 0.9, 0.9], -1.0, 0.45, 0), cube('1', FC.orange, [1.3, 0.9, 0.9], 0.4, 0.45, 0)]; cap('前面一個英文字母、後面一個數字', '像電影院 A1、A2、B1…'); },
  async (tok, S) => { S.B.add('A1、A2、A3、B1、B2…'); relabel(S.s[0], 'B'); relabel(S.s[1], '3'); cap('A1、A2、A3、B1、B2、B3…', '最多可以有幾個不同座位？'); },
  async (tok, S) => { S.B.add('字母：26 種'); T('26 種', 'ptr alt', -1.0, 1.4, 0); cap('兩格都要填', '字母有 26 種'); },
  async (tok, S) => { S.B.add('數字：老師說 99 個（1～99）'); T('99 種', 'ptr alt', 0.4, 1.4, 0); cap('數字有 99 個', ''); },
  async (tok, S) => { S.B.add('26 × 99 = ' + 26 * 99, 'good'); S.B.add('（Rosen 課本：數字 ≤ 100 → 26 × 100 = 2600）', 'idx'); cap('乘法原則：26 × 99 = 2574', ''); },
], [[0, 4, 12], [0, 2.2, 0]]);

scene('ct-l14-bits7', '長度 7 的 bit string：2⁷ = 128', [
  async (tok, S) => { cap('bit string：只由 0、1 組成的字串', 'bit 就是二進位的 0 或 1'); T('bit：0 或 1', 'say', 0, 3.4, 0); },
  async (tok, S) => { S.c = []; for (let i = 0; i < 7; i++) { ctx.tile(V3((i - 3) * 1.2, 0.04, 0), 1.0, 1.0); S.c.push(T('', 'ptr alt', (i - 3) * 1.2, 1.4, 0)); } cap('長度 7：有 7 個位置要填', ''); },
  async (tok, S) => {
    const ex = '1011001'; // 示意
    for (let i = 0; i < 7; i++) { cube(ex[i], ex[i] === '1' ? FC.blue : FC.gray, [0.8, 0.8, 0.8], (i - 3) * 1.2, 0.45, 0, 1.5); txt(S.c[i], '2'); await wt(tok, 120); }
    T('2 × 2 × 2 × 2 × 2 × 2 × 2 = 2⁷ = ' + 2 ** 7, 'good', 0, 2.6, 0);
    cap('每格 2 種、7 格都要填', '2⁷ = 128（乘法原則）');
  },
], [[0, 4, 11], [0, 1.4, 0]]);

function setDots(names, x, color, zc = 0) { return names.map((n, i) => { const z = zc + (i - (names.length - 1) / 2) * 1.1; const m = ball('', color, 0.25, x, 0.3, z); T(n, 'idx', x + (x < 0 ? -0.6 : 0.6), 0.3, z); return m; }); }
scene('ct-l14-funcs', '函式個數 nᵐ 與一對一函式個數', [
  async (tok, S) => {
    S.A = setDots(['a₁', 'a₂', 'a₃'], -2.5, FC.blue); S.Bd = setDots(['b₁', 'b₂', 'b₃', 'b₄'], 2.5, FC.green);
    T('A：|A| = m（示意 3）', 'ptr', -2.5, 1.0, -2.6); T('B：|B| = n（示意 4）', 'ptr', 2.5, 1.0, -2.9);
    cap('函式 f：A → B', '|A| = m、|B| = n');
  },
  async (tok, S) => {
    S.ar = [];
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 4; j++) S.ar.push(arrow(S.A[i].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[j].position.clone().add(V3(-0.3, 0.1, 0)), 0xb9a684)); await wt(tok, 200); }
    T('每個人都有 n 種選擇', 'say', 0, 2.2, 0);
    cap('A 的每個元素都要對到 B 裡某一個', '每個都有 n 種選法');
  },
  async (tok, S) => { T('m 個人各選 n 種 → n^m（|B|^|A|）＝ 示意 4³ = ' + 4 ** 3, 'good', 0, 2.9, 0); cap('m 個都要選：n × n × … × n', '= nᵐ 個函式'); },
  async (tok, S) => {
    S.ar.forEach(kill);
    T('一對一：不同的 a 要對到不同的 b → 必須 n ≥ m', 'note', 0, 3.6, 0);
    cap('一對一函式', '先決條件：n ≥ m');
  },
  async (tok, S) => {
    const pick = [1, 3, 0], cnt = ['n = 4', 'n − 1 = 3', 'n − 2 = 2'];
    for (let i = 0; i < 3; i++) { arrow(S.A[i].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[pick[i]].position.clone().add(V3(-0.3, 0.1, 0)), 0xd64545); glw(S.Bd[pick[i]], HL); T(cnt[i] + ' 種', 'ptr alt', -1.2, 0.9, S.A[i].position.z); await wt(tok, 450); }
    cap('a₁ 隨便選 n 種；a₂ 要避開 → n − 1 種', '下一個再少一種…');
  },
  async (tok, S) => { T('n(n − 1)(n − 2)…(n − m + 1)　示意 4·3·2 = ' + Pn(4, 3), 'good', 0, 4.3, 0); cap('一路乘到最後一個人', 'n − m + 1'); },
], [[0, 6.5, 10], [0, 0.8, 0]]);

scene('ct-l14-loops', '巢狀迴圈執行幾次：n₁·n₂·…·nₘ', [
  async (tok, S) => { S.C = code(['k := 0', 'for i₁ := 1 to n₁', '  for i₂ := 1 to n₂', '    …', '      for iₘ := 1 to nₘ', '        k := k + 1'], -4.2, 5.6, 0.62); S.C.hl(0); cap('trace 一段程式：最後 k 是多少？', ''); },
  async (tok, S) => { S.C.hl(4); cap('巢狀迴圈：i₁、i₂、…、iₘ', '共 m 個變數'); },
  async (tok, S) => { [1, 2, 4].forEach((r, i) => T(['i₁：1～n₁', 'i₂：1～n₂', 'iₘ：1～nₘ'][i], 'ptr', 2.6, 5.6 - r * 0.62)); cap('i₁ 從 1 到 n₁、i₂ 從 1 到 n₂…', ''); },
  async (tok, S) => {
    S.C.hl(5);
    S.k = T('k = 0', 'ptr alt', 2.6, 1.4);
    for (let v = 1; v <= 6; v++) { txt(S.k, 'k = ' + v + '（示意 n₁ = 2、n₂ = 3）'); await wt(tok, 200); }
    cap('每一組 (i₁, i₂, …, iₘ) 都讓 k 加 1', '');
  },
  async (tok, S) => { T('k = n₁ × n₂ × … × nₘ', 'good', 0, 0.6); cap('執行次數 = 組合數', '乘法原則：n₁·n₂·…·nₘ'); },
], [[0, 3.6, 12], [0, 3.0, 0]]);

scene('ct-l14-lists', '三份題目單挑一題：23 + 15 + 19', [
  async (tok, S) => { cap('開始混用加法原則和乘法原則', ''); },
  async (tok, S) => { S.H = [['單子 1：23 題', FC.blue], ['單子 2：15 題', FC.pink], ['單子 3：19 題', FC.green]].map(([n, c], g) => { T(n, 'ptr', -4.2 + g * 4.2, 0, 2.2); return c; }); cap('作業有三張題目單', '每人挑一題'); },
  async (tok, S) => {
    S.all = [];
    [23, 15, 19].forEach((n, g) => { for (let i = 0; i < n; i++) S.all.push(cube('', S.H[g], [0.42, 0.36, 0.42], -4.2 + g * 4.2 + ((i % 5) - 2) * 0.5, 0.18, -1 + Math.floor(i / 5) * 0.5, 2.5)); });
    cap('第一張 23 題、第二張 15 題、第三張 19 題', '');
  },
  async (tok, S) => { T('只挑一題：23 + 15 + 19 = ' + (23 + 15 + 19), 'good', 0, 1.8, 2.2); cap('只要挑一題', '23 + 15 + 19 = 57'); },
  async (tok, S) => { T('加法 = 把可能性分類，挑其中一類', 'note', 0, 2.6, 2.2); cap('加法原則其實就是「分類」', '分三類，從中挑一個'); },
], [[0, 7, 12.5], [0, 0.6, 0]]);

const P6 = 36 ** 6 - 26 ** 6, P7 = 36 ** 7 - 26 ** 7, P8 = 36 ** 8 - 26 ** 8;
scene('ct-l14-password', '密碼：長度 6～8、至少一個數字', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.58); S.B.add('密碼長度 6～8 個字元'); cap('電腦密碼：太短怕被猜到，太長會被截掉', '長度 6～8'); },
  async (tok, S) => { S.B.add('每個字元：大寫字母或數字'); cap('每個字元可以是大寫字母或數字', ''); },
  async (tok, S) => { S.B.add('至少要有一個數字'); cap('還規定：至少要有一個數字', '總共有幾種密碼？'); },
  async (tok, S) => {
    S.g = [6, 7, 8].map((n, i) => { const row = []; for (let k = 0; k < n; k++) row.push(cube('', [FC.blue, FC.pink, FC.green][i], [0.5, 0.5, 0.5], 2.4 + k * 0.58, 4.6 - i * 1.0, 0)); T('P' + n, 'ptr', 1.7, 4.6 - i * 1.0); return row; });
    S.B.add('分三組：P₆、P₇、P₈');
    cap('長度 6、7、8 一起考慮太複雜', '先分成三組');
  },
  async (tok, S) => { S.B.add('P = P₆ + P₇ + P₈（加法原則）', 'good'); cap('三組只會是其中一組', '加起來：加法原則'); },
  async (tok, S) => { S.B.add('每格 26 + 10 = 36 種'); S.g[0].forEach((m) => relabel(m, '')); cap('先看長度 6', '每格 26 + 10 = 36 種'); },
  async (tok, S) => { S.B.add('全部 36⁶；完全沒數字 26⁶'); cap('全部可能 36⁶', '分成：有數字的、沒數字的'); },
  async (tok, S) => { S.B.add('P₆ = 36⁶ − 26⁶ = ' + fmt(P6), 'good'); cap('要的 = 全部 − 不能用的', '36⁶ − 26⁶'); },
  async (tok, S) => { S.B.add('P₇ = 36⁷ − 26⁷、P₈ = 36⁸ − 26⁸'); S.B.add('P = ' + fmt(P6 + P7 + P8), 'good'); cap('長度 7、8 一樣算', '全部相加'); },
  async (tok, S) => { cap('網站常限制密碼', '加了限制後還剩多少可以選？'); },
], [[0, 4.2, 13.5], [0, 3.2, 0]]);

const IPA = (2 ** 7 - 1) * (2 ** 24 - 2), IPB = 2 ** 14 * (2 ** 16 - 2), IPC = 2 ** 21 * (2 ** 8 - 2);
function bitRow(bits, x0, y, colors, w = 0.36) { return bits.split('').map((b, i) => cube(b === '.' ? '' : b, colors(i), [w * 0.92, 0.42, 0.42], x0 + i * w, y, 0)); }
scene('ct-l14-ipv4', 'IPv4 位址有幾個', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('換 IPv6 之前：IPv4'); cap('網路上的 IP address', 'IPv4 的舊規矩'); },
  async (tok, S) => { S.B.add('4 個 8 位元數字'); for (let i = 0; i < 4; i++) cube('8 bit', FC.sky, [1.3, 0.5, 0.5], 1.6 + i * 1.5, 5.8, 0); cap('四個 8 位元（byte）組成', ''); },
  async (tok, S) => { S.B.add('分 Class A、B、C'); cap('為了管理方便，分成三類', 'Class A、B、C'); },
  async (tok, S) => { S.B.add('全球有多少個可用？'); cap('全世界到底有多少 IP 可用？', '今年大概用光了'); },
  async (tok, S) => { S.ex = T('例：140.113.x.x（交大）', 'note', 3.9, 4.9); cap('例如交大是 140.113…', ''); },
  async (tok, S) => { S.B.add('每一段 0～255'); cap('每一段是 0 到 255', '= 2⁸ 種'); },
  async (tok, S) => { S.B.add('粗估 2³² ≈ 4 × 10⁹'); cap('什麼規矩都不管：2⁸·2⁸·2⁸·2⁸ = 2³²', '大約 4 × 10⁹'); },
  async (tok, S) => { S.B.add('= Net ID + Host ID'); cap('每個 IP 分兩部分', '前面 Net ID、後面 Host ID'); },
  async (tok, S) => {
    S.B.clear(); kill(S.ex);
    S.ra = bitRow('0' + '.'.repeat(31), 1.2, 6.2, (i) => (i === 0 ? FC.red : i < 8 ? FC.blue : FC.green), 0.17);
    L('A：0｜Net 7 bit', 'ptr', -6.6, 6.2);
    cap('Class A：最高位元是 0', '後面 7 bit 是 Net ID（藍）');
  },
  async (tok, S) => { L('Host 24 bit', 'idx', -2.4, 6.2); cap('後面 24 bit 是 Host ID（綠）', '隨便填'); },
  async (tok, S) => {
    bitRow('10' + '.'.repeat(30), 1.2, 5.4, (i) => (i < 2 ? FC.red : i < 16 ? FC.blue : FC.green), 0.17);
    L('B：10｜Net 14｜Host 16', 'ptr', -6.6, 5.4);
    cap('Class B：開頭 1 0', 'Net ID 6 + 8 = 14 bit、Host ID 16 bit');
  },
  async (tok, S) => {
    bitRow('110' + '.'.repeat(29), 1.2, 4.6, (i) => (i < 3 ? FC.red : i < 24 ? FC.blue : FC.green), 0.17);
    L('C：110｜Net 21｜Host 8', 'ptr', -6.6, 4.6);
    cap('Class C：開頭 1 1 0', 'Net ID 5 + 16 = 21 bit、Host ID 8 bit');
  },
  async (tok, S) => { S.ex = T('140 = 128 + 8 + 4 = 10001100₂ → 開頭 10 → Class B', 'note', 1.0, 3.8); cap('140 寫成二進位：10001100', '開頭是 1 0 → Class B'); },
  async (tok, S) => { S.R = board(-6.6, 3.0, 0.55); S.R.add('A 的 Net ID ≠ 全 1'); cap('還有細節規定', 'Class A 的 Net ID 不能全 1'); },
  async (tok, S) => { S.R.add('Host ID ≠ 全 0、全 1'); cap('Host ID 不能全 0、不能全 1', '各扣掉 2 個'); },
  async (tok, S) => { T('A：(2⁷ − 1)(2²⁴ − 2) = ' + fmt(IPA), 'say', 3.4, 3.0); cap('Class A 有幾個？', '(2⁷ − 1)(2²⁴ − 2)'); },
  async (tok, S) => { T('B：2¹⁴(2¹⁶ − 2) = ' + fmt(IPB), 'say', 3.4, 2.4); cap('Class B：Net ID 沒限制', '2¹⁴(2¹⁶ − 2)'); },
  async (tok, S) => { T('C：2²¹(2⁸ − 2) = ' + fmt(IPC), 'say', 3.4, 1.8); T('合計 ' + fmt(IPA + IPB + IPC) + ' ≈ 3.7 × 10⁹', 'good', 3.4, 1.2); cap('Class C：2²¹(2⁸ − 2)', 'A + B + C 全部加起來'); },
  async (tok, S) => { S.R.add('粗估 4 × 10⁹：差一點'); cap('和粗估的 4 × 10⁹ 差不多', '為什麼少了一些？'); },
  async (tok, S) => { S.R.add('開頭 111 → 另作他用'); S.R.add('約 7/8 合法：4 × 7/8 ≈ 3.5'); cap('開頭 3 bit 有 8 種，111 那種被排除', '大約 7/8 合法'); },
  async (tok, S) => { S.R.add('估算：2¹⁰ ≈ 1000', 'say'); cap('自己心裡要有個底', '2¹⁰ 當作 1000 來估'); },
], [[0, 4.0, 14], [0, 3.4, 0]]);

const NO11 = (() => { const out = ['']; for (let len = 1; len <= 4; len++) for (const p of out.filter((q) => q.length === len - 1)) for (const b of '01') { const s = p + b; if (!s.includes('11')) out.push(s); } return out; })();
scene('ct-l14-tree', '樹狀圖：長度 4、沒有連續兩個 1', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('bit string，長度 4'); cap('樹狀圖的例子：0、1 字串', '長度 4'); },
  async (tok, S) => { S.B.add('全部 2⁴ = 16 種'); cap('長度 4 的 0/1 字串', '最多 2⁴ = 16 種'); },
  async (tok, S) => { S.B.add('不允許兩個連續的 1'); cap('限制：不能有兩個連續的 1', '還剩幾種？'); },
  async (tok, S) => { S.B.add('笨方法：全列出再刪'); cap('列舉 16 個也是演算法', '不一定要用很厲害的定理'); },
  async (tok, S) => { S.Tr = prefixTree(NO11, '01', -1.2, 1.75, 6.2, 0.6); S.Tr.show(0); cap('用工具把思緒理清楚', '樹狀圖'); },
  async (tok, S) => { S.Tr.show(1); cap('第 1 個位置：填 0 或填 1', '兩個分支'); },
  async (tok, S) => { S.Tr.show(2); T('前一個是 1 → 只能填 0', 'bad', 2.6, 0.2); cap('第 2 個位置：前面是 0 → 0、1 都行', '前面是 1 → 只能填 0'); },
  async (tok, S) => { S.Tr.show(3); cap('第 3 個位置也一樣', '填了 1 的後面一定接 0'); },
  async (tok, S) => { S.Tr.show(4); cap('第 4 個位置', '一步一步堆出來'); },
  async (tok, S) => {
    for (const p of ['0000', '0100']) { for (let k = 1; k <= 4; k++) glow(S.Tr.nodes[p.slice(0, k)], HL); await wt(tok, 500); }
    T('從樹根走到葉子 = 一個字串：0000、0100…', 'note', 1.6, 7.0);
    cap('從葉子倒著走回樹根', '就讀出一個字串');
  },
  async (tok, S) => { S.Tr.leaves.forEach((p, i) => T(String(i + 1), 'ptr alt', -1.2 + 4 * 1.75 + 0.7, S.Tr.pos[p])); S.B.add('葉子 = 一種可能 → ' + S.Tr.leaves.length + ' 種', 'good'); cap('數葉子：1、2、…、8', '答案是 8'); },
  async (tok, S) => { S.B.add('先定第一步，再往下分'); cap('樹狀圖幫你理清思緒', '列舉完，常配合加法原則'); },
], [[0, 4.2, 14], [0, 3.4, 0]]);

scene('ct-l14-iptree', '用樹狀圖分 IP 的類別', [
  async (tok, S) => {
    S.Tr = prefixTree(['', '0', '1', '10', '11', '110', '111'], '01', -4.0, 2.4, 5.6, 1.0); S.Tr.show(0); S.Tr.show(1);
    T('Class A', 'good', -4.0 + 2.4 + 1.2, S.Tr.pos['0']);
    cap('剛才的 IP：第一個位元是 0', '→ Class A');
  },
  async (tok, S) => { S.Tr.show(2); T('Class B', 'good', -4.0 + 4.8 + 1.2, S.Tr.pos['10']); cap('第一個是 1、第二個放 0', '→ Class B'); },
  async (tok, S) => { S.Tr.show(3); T('Class C', 'good', -4.0 + 7.2 + 1.2, S.Tr.pos['110']); T('另作他用', 'bad', -4.0 + 7.2 + 1.3, S.Tr.pos['111']); cap('第三個放 0 → Class C', '放 1 → 另有他用，不是一般 IP'); },
  async (tok, S) => { cap('樹狀圖常和排列組合一起用', '想法比較容易呈現'); },
], [[0, 4.0, 13], [0, 3.2, 0]]);

// ════════ --gFe7gbFIQ（交大 易志偉 Lec15：Counting 2/2 — 鴿籠、排列、組合、重複組合、二項式定理） ════════
const prodRange = (n, r) => { let x = 1; for (let i = 0; i < r; i++) x *= n - i; return x; };
scene('ct-l15-eggs', '火鍋的 4 顆蛋分給 3 個人', [
  async (tok, S) => {
    S.p = ['甲', '乙', '丙'].map((nm, i) => buddy(nm, '', [FC.blue, FC.pink, FC.green][i], (i - 1) * 3.2, 0, -0.6, 0.9));
    S.e = [0, 1, 2, 3].map((i) => ball('', '#fbf6ea', 0.2, -0.6 + i * 0.4, 0.2, 2.2));
    cap('三個人去吃火鍋，店長送 4 顆蛋', '要怎麼分？');
  },
  async (tok, S) => { T('蛋不能切', 'bad', 0, 1.0, 2.4); cap('多出一顆，蛋又不能切', '大家就吵起來了'); },
  async (tok, S) => { S.B = board(-6.6, 5.6, 0.6); S.B.add('平均 4 ÷ 3 = 1.33… 顆'); cap('平均每人 4 ÷ 3 = 1.33… 顆', ''); },
  async (tok, S) => {
    S.at = (k, i) => V3((k - 1) * 3.2 + (i % 2 ? 0.25 : -0.25), 0.2, 0.7 + Math.floor(i / 2) * 0.4);
    await arc(tok, S.e, [S.at(0, 0), S.at(1, 0), S.at(2, 0), S.at(0, 1)], 900, 1.0);
    S.B.add('多的 0.33 一定跑到某人身上 → 有人拿 2 顆', 'good');
    cap('多出來的那一點一定落到某人身上', '至少有一個人拿到 2 顆');
  },
  async (tok, S) => { await arc(tok, S.e, [0, 1, 2, 3].map((i) => S.at(1, i)), 900, 1.0); S.p[1].mood('happy'); cap('也可能有人很愛吃蛋，4 顆全拿走', '4 ≥ 2，一樣符合'); },
  async (tok, S) => { S.p[1].mood('calm'); await arc(tok, S.e, [S.at(0, 0), S.at(1, 0), S.at(2, 0), S.at(2, 1)], 900, 1.0); cap('先每人一顆，剩下一顆給某人', '那個人就有 2 顆'); },
  async (tok, S) => { await arc(tok, S.e, [S.at(0, 0), S.at(0, 1), S.at(1, 0), S.at(1, 1)], 900, 1.0); S.p[2].mood('sad'); cap('也可能兩人各 2 顆、一人沒有', '不管怎樣，保證有人 ≥ 2'); },
  async (tok, S) => { S.p[2].mood('calm'); S.B.add('N 顆蛋、k 個人：平均 N / k'); cap('一般化：N 顆蛋、k 個人', '平均 N/k 顆'); },
  async (tok, S) => { S.B.add('有小數 → 有人拿到「下一個整數」'); cap('平均是整數就沒事', '有小數，就有人拿到比平均多'); },
  async (tok, S) => { S.B.add('平均 3.5 → 至少有人拿 4：⌈N/k⌉（上高斯）', 'good'); cap('例如平均 3.5，至少有人拿 4 顆', '用上高斯 ⌈N/k⌉'); },
  async (tok, S) => { S.B.add('證明：反證法 + 高斯符號的不等式', 'say'); cap('證明很簡單：反證法', '假設每人都 < ⌈N/k⌉ 就矛盾'); },
], [[0, 5.0, 11.5], [0, 1.6, 0]]);

const ONES = (k) => '1'.repeat(k);
scene('ct-l15-ones', '任何 n 都有只含 0 和 1 的倍數', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.58); S.B.add('講義裡比較難的一題'); cap('講義裡比較難的題目', '先把題目看懂'); },
  async (tok, S) => { S.B.add('對所有自然數 n，存在 n 的倍數 m'); cap('對每一個自然數 n', '都找得到 n 的一個倍數 m'); },
  async (tok, S) => { S.B.add('m 的十進位數字只有 0 和 1'); cap('而且 m 寫成十進位，只有 0 和 1', '不是二進位！'); },
  async (tok, S) => { T('n = 5 → m = 10', 'note', 3.2, 6.0); cap('例：n = 5', 'm = 10 是 5 的倍數，只有 1 和 0'); },
  async (tok, S) => { T('n = 3 → m = 111（1+1+1 = 3）', 'note', 3.2, 5.3); cap('例：n = 3', 'm = 111：數字和是 3 的倍數'); },
  async (tok, S) => { S.B.add('不管 n 是多少，都存在這樣的 m？'); cap('不管 n 給多少都成立？', '這就是題目'); },
  async (tok, S) => { cap('加減乘除好像沒辦法描述「只有 0 和 1」', '怎麼下手？'); },
  async (tok, S) => { S.B.add('想法：找兩個「除以 n 同餘」的數'); cap('用同餘的想法', '兩個數除以 n 餘數一樣'); },
  async (tok, S) => { S.B.add('兩數相減 → 被 n 整除'); cap('把兩個同餘的數相減', '差就是 n 的倍數'); },
  async (tok, S) => {
    S.n = 4; S.C = crates(S.n, Array.from({ length: S.n }, (_, r) => '餘 ' + r), 3.0, 0, 1.25, 0.35);
    S.B.add('除以 n 的餘數：0、1、…、n − 1（n 種）');
    cap('除以 n 的餘數只有 n 種', '0、1、2、…、n − 1 = n 個籠子（示意 n = 4）');
  },
  async (tok, S) => { S.B.add('取 n + 1 個數 → 一定有兩個同餘'); cap('找 n + 1 個數', '鴿籠原理：一定有兩個同餘'); },
  async (tok, S) => {
    S.cards = []; for (let k = 1; k <= S.n + 1; k++) S.cards.push(chip(ONES(k), FC.card, 1.6 + (k - 1) * 1.25, 3.2, 0.3 + 0.17 * k, 0.5, 0, 1.4));
    S.B.add('取 1、11、111、…、11…1（n + 1 個 1）');
    cap('取 1、11、111、…', '最後一個有 n + 1 個 1（示意 n = 4：到 11111）');
  },
  async (tok, S) => {
    const tg = [];
    for (let k = 1; k <= S.n + 1; k++) { const r = Number(BigInt(ONES(k)) % BigInt(S.n)); S.cards[k - 1].userData.r = r; S.C.slot(r); tg.push(V3(S.C.x(r), 0.35 + (S.C.cnt[r] - 1) * 0.55, 0)); }
    await arc(tok, S.cards, tg, 1000, 1.0);
    S.C.hot(3);
    cap('n + 1 個數，餘數只有 n 種', '11 和 111 除以 4 都餘 3');
  },
  async (tok, S) => { S.B.add('m₁ ≡ m₂ (mod n) → n | (m₁ − m₂)', 'good'); cap('同餘的兩個數相減', 'm₁ − m₂ 一定被 n 整除'); },
  async (tok, S) => { T('111 − 11 = 100 = 4 × 25：前面是 1、後面是 0', 'good', 3.6, 4.4); cap('長的減短的：前面 1…1、後面 0…0', '只有 0 和 1！'); },
  async (tok, S) => { cap('鴿籠原理常用來證明這種奇怪的事', '只要說明清楚就是證明'); },
], [[0, 4.3, 13.5], [0, 3.2, 0]]);

scene('ct-l15-quick', '鴿籠原理的幾個小例子', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.58); S.B.add('成績 0～100 分：101 種'); cap('成績 0 到 100 分', '一共 101 種可能'); },
  async (tok, S) => { S.B.add('班上超過 101 人 → 至少兩人同分', 'good'); cap('班上超過 101 人', '保證至少兩人同分'); },
  async (tok, S) => { S.A = setDots(['', '', '', ''], 0.6, FC.blue, 1.0); S.Bd = setDots(['', '', ''], 4.6, FC.green, 1.0); T('定義域', 'idx', 0.6, 1.1, -1.4); T('對應域', 'idx', 4.6, 1.1, -0.9); cap('函式：A 裡每個元素對到 B 的一個', ''); },
  async (tok, S) => {
    [0, 1, 2, 2].forEach((j, i) => arrow(S.A[i].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[j].position.clone().add(V3(-0.3, 0.1, 0)), i >= 2 ? 0xd64545 : 0xb9a684));
    glw(S.Bd[2], NG);
    S.B.add('|A| > |B| → 一定不是一對一');
    cap('自變數比因變數多', '一定有一個被對到兩次 → 不是一對一');
  },
  async (tok, S) => { S.B.add('又叫 Dirichlet drawer principle（抽屜原理）'); cap('鴿籠原理的另一個名字', 'Dirichlet 抽屜原理'); },
  async (tok, S) => { S.B.add('280 人、一年 52 週，每週辦一次慶生會'); cap('慶生會：280 人、52 週', '某一週最多要準備幾個蛋糕？'); },
  async (tok, S) => { S.B.add('280 / 52 ≈ ' + (280 / 52).toFixed(2) + ' → ⌈280/52⌉ = ' + Math.ceil(280 / 52), 'good'); cap('至少有一週要準備 6 個以上', '上高斯 ⌈280/52⌉ = 6'); },
  async (tok, S) => { S.B.add('「以上」含等號（≥）；「之上」不含（>）', 'say'); cap('中文：以上 = 大於等於', '之上 = 大於'); },
]);

scene('ct-l15-seats', '排列：100 人選 6 人坐 6 個位置', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.58); S.B.add('排列：位置不同，答案就不同'); for (let k = 0; k < 6; k++) { ctx.tile(V3(-1 + k * 1.3, 0.04, 0.5), 1.1, 1.1); T('座位 ' + (k + 1), 'idx', -1 + k * 1.3, 0, 1.4); } cap('這邊坐滿 6 個學生', '班上 100 人'); },
  async (tok, S) => { S.st = chip('甲', FC.blue, -1, 0.35, 0.7, 0.5); await wt(tok, 500); move(S.st, 0.3, 0.35, 0.5); cap('坐第一個位置、換坐第二個位置', '是不一樣的結果'); },
  async (tok, S) => { S.B.add('= 排隊：第幾個位置有差'); cap('排列就是排隊的意思', ''); },
  async (tok, S) => { kill(S.st); S.B.add('100 人中請 6 人來坐，幾種排法？'); cap('100 個同學挑 6 個來坐', '有幾種排列？'); },
  async (tok, S) => { S.cnt = [100, 99, 98, 97, 96, 95].map((v, k) => T('', 'ptr alt', -1 + k * 1.3, 1.5, 0.5)); txt(S.cnt[0], '100'); chip('', FC.blue, -1, 0.35, 0.7, 0.5, 2, 0.5); cap('第一個位置：100 人都可能', '100 種'); },
  async (tok, S) => { txt(S.cnt[1], '99'); chip('', FC.blue, 0.3, 0.35, 0.7, 0.5, 2, 0.5); cap('坐下一個，剩 99 人', '第二個位置 99 種'); },
  async (tok, S) => { for (let k = 2; k < 6; k++) { txt(S.cnt[k], String(100 - k)); chip('', FC.blue, -1 + k * 1.3, 0.35, 0.7, 0.5, 2, 0.5); await wt(tok, 200); } cap('第三個 98 種，依序乘下去', ''); },
  async (tok, S) => { S.B.add('6 個位置都要坐 → 乘法原則'); cap('六件事要同時發生', '乘法原則'); },
  async (tok, S) => { S.B.add('P(100, 6) = 100·99·98·97·96·95 = 100!/94!', 'good'); S.B.add('= ' + fmt(prodRange(100, 6)), 'say'); cap('permutation：n 個挑 r 個排隊', 'P(n, r) = n!/(n − r)!'); },
], [[0, 4.2, 13], [0, 2.8, 0]]);

scene('ct-l15-bomb', '拆炸彈：10 條電線依序剪 3 條', [
  async (tok, S) => { S.bomb = cube('', '#3d4450', [2.2, 1.0, 1.2], 2.0, 0.5, -1.2); icon('💣', '', 2.0, 1.7, -1.2); cap('特種部隊拆炸彈', ''); },
  async (tok, S) => { S.w = []; for (let i = 0; i < 10; i++) S.w.push(rod(V3(-3.2 + i * 0.55, 0.15, 1.2), V3(1.0 + i * 0.25, 0.6, -0.7), ['#d64545', '#4b9ee2', '#2fc092', '#f3d36b', '#9b7ef4'][i % 5], 0.045)); cap('上面有 10 條不一樣的電線', ''); },
  async (tok, S) => { S.B = board(-6.6, 6.0, 0.6); S.B.add('要剪 3 條，而且順序有關係'); cap('要剪掉 3 條', '剪的順序也有關係'); },
  async (tok, S) => { S.B.add('依序 = 有 order → permutation'); cap('「依序」就是有順序', '有順序就是排列'); },
  async (tok, S) => {
    const cut = [6, 1, 8];
    for (let k = 0; k < 3; k++) { glw(S.w[cut[k]], HL); T(['10', '9', '8'][k] + ' 種', 'ptr alt', -3.2 + cut[k] * 0.55, 0.8, 1.4); await wt(tok, 400); }
    cap('第一條 10 種、第二條 9 種、第三條 8 種', '（剪哪幾條是示意）');
  },
  async (tok, S) => { S.B.add('10 × 9 × 8 = ' + prodRange(10, 3) + ' 種剪法', 'good'); cap('10 × 9 × 8 = 720', ''); },
  async (tok, S) => { S.B.add('只有一種是對的 → 活命機會 1/720', 'bad'); cap('只有一種剪法是對的', '1/720'); },
], [[0, 4.2, 12], [0, 2.2, 0]]);

const LET8 = 'ABCDEFGH';
scene('ct-l15-abc', 'ABC 必須相鄰：6! 與 6!·3!', [
  async (tok, S) => { S.m = {}; LET8.split('').forEach((c, i) => { S.m[c] = cube(c, 'ABC'.includes(c) ? FC.orange : FC.blue, [0.8, 0.8, 0.8], (i - 3.5) * 1.0, 0.4, 0, 1.5); }); S.B = board(-6.6, 6.0, 0.58); S.B.add('A～H 共 8 個字母，全部排列'); cap('A 到 H 八個字母', '全部排列有 8! 種'); },
  async (tok, S) => { S.B.add('要求：ABC 放在一起'); cap('老師比較龜毛：喜歡 ABC 放在一起', ''); },
  async (tok, S) => { const ord = 'ADECBGFH'; ord.split('').forEach((c, i) => move(S.m[c], (i - 3.5) * 1.0, 0.4, 0)); cap('例如 A D E C B G F H', '這也是一種排列'); },
  async (tok, S) => { S.B.add('contain the string ABC：要相鄰，而且照 A B C 順序'); cap('題目：包含字串 ABC', 'ABC 要連在一起，而且照這個順序'); },
  async (tok, S) => { ['A', 'C', 'B'].forEach((c) => glow(S.m[c], NG)); S.bad = [T('A、B、C 沒在一起 ✗', 'bad', 0, 1.6, 0)]; cap('剛才那個：A、B、C 分散了', '不要'); },
  async (tok, S) => { ['A', 'C', 'B'].forEach((c) => glow(S.m[c], '#000000')); 'BCADEFGH'.split('').forEach((c, i) => move(S.m[c], (i - 3.5) * 1.0, 0.4, 0)); S.bad.push(T('B C A 在一起但順序不對 ✗', 'bad', 0, 2.3, 0)); cap('B C A D E F…', '在一起，但不是 ABC 的順序，也不要'); },
  async (tok, S) => { 'ABCDEFGH'.split('').forEach((c, i) => move(S.m[c], (i < 3 ? (i - 1) * 0.8 - 3.0 : (i - 3) * 1.1 - 0.8), 0.4, 0)); (S.bad || []).forEach(kill); S.blk = cube('', '#f3d36b', [2.6, 0.12, 1.0], -3.0, 0.02, 0); cap('ABC 其實是「連體嬰」', '綁成一個人'); },
  async (tok, S) => { T('1', 'ptr', -3.0, 1.3, 0); 'DEFGH'.split('').forEach((c, i) => T(String(i + 2), 'ptr', i * 1.1 - 0.8, 1.3, 0)); cap('所以不是 8 個，只有 6 個', 'ABC、D、E、F、G、H'); },
  async (tok, S) => { S.B.add('6 個全部排列：6! = ' + fact(6), 'good'); cap('6 個全部排隊', '6! = 720'); },
  async (tok, S) => { S.B.add('變化型：ABC 要在一起，但順序不限'); cap('變化型：ABC 一定要在一起', '但不一定照 A B C 排'); },
  async (tok, S) => { S.B.add('ABC 自己內部可以換位置'); cap('代表 ABC 的那一塊', '裡面可以換位置'); },
  async (tok, S) => {
    const perms = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
    perms.forEach((p, i) => T(p, 'say', -2.6 + i * 1.2, 1.9, 0));
    cap('ABC、ACB、BAC、BCA、CAB、CBA', '3! = 6 種');
  },
  async (tok, S) => { S.B.add('6! × 3! = ' + fact(6) * fact(3), 'good'); cap('每一種排列再乘 3!', '6! × 3! = 4320'); },
  async (tok, S) => { cap('題目看起來很像，問的事情不一樣', '答案就不一樣'); },
], [[0, 4.2, 12.5], [0, 2.4, 0]]);

const FRUIT = ['🍎', '🍊', '🍐', '🍌'];
scene('ct-l15-fruit6', '可重複的排列：4 種水果放 6 個位置', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.58); S.B.add('可重複的排列'); cap('可重複的排列', '東西不會用完'); },
  async (tok, S) => { FRUIT.forEach((g, i) => icon(g, ['蘋果', '柳丁', '梨子', '香蕉'][i], -1.2 + i * 1.5, 3.6, -1.5)); cap('一箱柳丁、很多蘋果、香蕉…', '每種都很多'); },
  async (tok, S) => { S.slots = []; for (let k = 0; k < 6; k++) { ctx.tile(V3(-1.5 + k * 1.3, 0.04, 1.2), 1.1, 1.1); S.slots.push(T('', 'ptr alt', -1.5 + k * 1.3, 1.3, 1.2)); } S.B.add('4 種水果、6 個位置'); cap('4 種水果、6 個位置', '把水果放上去'); },
  async (tok, S) => { S.B.add('水果很多，不會用完'); cap('數量非常多', '放不完'); },
  async (tok, S) => { txt(S.slots[0], '4'); icon(FRUIT[1], '', -1.5, 0.6, 1.2, 'sm'); cap('第一個位置：4 種', ''); },
  async (tok, S) => { const pick = [0, 1, 1, 3, 2]; for (let k = 1; k < 6; k++) { txt(S.slots[k], '4'); icon(FRUIT[pick[k - 1]], '', -1.5 + k * 1.3, 0.6, 1.2, 'sm'); await wt(tok, 200); } cap('東西不會用光：每個位置都還是 4 種', '（放哪個水果是示意）'); },
  async (tok, S) => { S.B.add('4⁶ = ' + 4 ** 6, 'good'); cap('每個位置 4 種、6 個位置', '4⁶ = 4096'); },
  async (tok, S) => { S.B.add('= 函式的個數'); cap('其實就是函式', ''); },
  async (tok, S) => { S.B.add('定義域 6 個位置 → 對應域 4 種水果：4⁶', 'say'); cap('定義域 6 個元素，各挑 1 個水果', '函式個數 = 可重複的排列'); },
], [[0, 4.2, 12.5], [0, 2.6, 0]]);

scene('ct-l15-success', '有相同字母的排列：SUCCESS', [
  async (tok, S) => { S.w = 'SUCCESS'; S.m = S.w.split('').map((c, i) => cube(c, c === 'S' ? FC.blue : c === 'C' ? FC.orange : FC.gray, [0.85, 0.85, 0.85], (i - 3) * 1.1, 0.43, 0, 1.5)); S.B = board(-6.6, 6.4, 0.55); S.B.add('7 個字母重新排列'); cap('7 個英文字母：S U C C E S S', '重新排列有幾種？'); },
  async (tok, S) => { cap('兩個 S 互換位置', '外表看起來沒有差別'); move(S.m[0], (5 - 3) * 1.1, 1.4, 0); move(S.m[5], (0 - 3) * 1.1, 1.4, 0); await wt(tok, 900); move(S.m[0], (5 - 3) * 1.1, 0.43, 0); move(S.m[5], (0 - 3) * 1.1, 0.43, 0); },
  async (tok, S) => { [[0, 'S₁'], [5, 'S₂'], [6, 'S₃']].forEach(([i, t]) => relabel(S.m[i], t)); cap('先假裝不一樣：標上 S₁、S₂、S₃', ''); },
  async (tok, S) => { relabel(S.m[2], 'C₁'); relabel(S.m[3], 'C₂'); cap('C 也標成 C₁、C₂', '其他都不一樣'); },
  async (tok, S) => { S.B.add('假裝都不同：7! = ' + fact(7)); cap('7 個都不同的話', '7! 種排法'); },
  async (tok, S) => { [0, 5, 6].forEach((i) => glow(S.m[i], HL)); S.B.add('S₁S₂S₃ 換來換去其實是同一個'); cap('S₁、S₂、S₃ 換來換去', '看起來都一樣'); },
  async (tok, S) => { S.B.add('3 個 S 有 3! = 6 種站法 → ÷ 3!'); cap('3 個 S 有 6 種站位置的方法', '除以 3!'); },
  async (tok, S) => { [0, 5, 6].forEach((i) => glow(S.m[i], '#000000')); [2, 3].forEach((i) => glow(S.m[i], HL)); S.B.add('C₁C₂ → ÷ 2!；答案 7!/(3!·2!) = ' + fact(7) / (fact(3) * fact(2)), 'good'); cap('C 有兩個，再除以 2!', '7!/(3!·2!) = 420'); },
  async (tok, S) => { [2, 3].forEach((i) => glow(S.m[i], '#000000')); S.m.forEach((m, i) => relabel(m, S.w[i])); S.B.add('一般：n! / (n₁!·n₂!·…·nₖ!)'); cap('一般式：n 個東西，第 i 種有 nᵢ 個', 'n!/(n₁!n₂!…nₖ!)'); },
  async (tok, S) => { S.B.add('U、E 各 1 個：÷ 1!，答案一樣', 'say'); cap('U 和 E 也除了 1!', '1! = 1，所以不寫'); },
  async (tok, S) => { cap('排列題不只這三種', '但這三種是最常見的基本型'); },
], [[0, 4.4, 12.5], [0, 2.6, 0]]);

scene('ct-l15-comb', '組合：不管順序 → C(10,5) = P(10,5)/5!', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('組合 combination'); cap('另一個概念：組合', '像抽獎、搬東西比賽'); },
  async (tok, S) => { S.it = [icon('🧊', '冰箱', 1.5, 1.0, 0), icon('❄️', '冷氣', 3.5, 1.0, 0)]; cap('一分鐘內搬得出來的都是你的', '先搬冰箱、先搬冷氣，結果一樣'); },
  async (tok, S) => { S.B.add('沒有順序概念 → 組合'); cap('只看最後拿到什麼', '不管誰先誰後：組合'); },
  async (tok, S) => { S.it.forEach(remove); S.bs = []; for (let i = 0; i < 10; i++) S.bs.push(ball(String(i + 1), FC.blue, 0.32, -1.6 + (i % 5) * 1.1, 0.35, -1.8 + Math.floor(i / 5) * 0.9)); S.B.add('集合 S 有 10 個東西，挑 5 樣'); cap('S 有 10 個東西', '隨便挑 5 樣'); },
  async (tok, S) => { const pk = [1, 3, 4, 7, 8]; for (let k = 0; k < 5; k++) { move(S.bs[pk[k]], -1.6 + k * 1.1, 0.35, 1.6); tint(S.bs[pk[k]], FC.pink); await wt(tok, 200); } S.B.add('先當作有順序：P(10, 5)'); cap('先假裝順序有關：挑 5 個出來排隊', 'P(10,5)'); },
  async (tok, S) => { cap('組合不管挑出來的順序', '冰箱冷氣、冷氣冰箱算同一種'); },
  async (tok, S) => { S.B.add('同樣 5 個有 5! 種順序 → ÷ 5!'); cap('同樣這 5 個，排隊有 5! 種變化', '都算同一種，除掉'); },
  async (tok, S) => { S.B.add('C(10, 5) = P(10, 5)/5! = ' + Cb(10, 5), 'good'); S.B.add('符號：C(n,r)、Cⁿᵣ、(n r) 都有人用', 'say'); cap('C 是 combination', '寫法很多，要看得懂'); },
  async (tok, S) => { cap('公式：P(n,r) 再除掉認為一樣的', 'C(n,r) = P(n,r)/r!'); },
], [[0, 4.4, 12.5], [0, 2.6, 0]]);

const FR3 = (() => { const out = ['']; for (let a = 0; a <= 4; a++) { out.push(String(a)); for (let o = 0; o <= 4 - a; o++) { out.push(a + '' + o); out.push(a + '' + o + (4 - a - o)); } } return out; })();
scene('ct-l15-fruit4', '挑 4 個水果：樹狀圖 15 種 = 星棒法 C(6,2)', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.52); S.B.add('蘋果、柳丁、梨子挑 4 個（可重複）'); cap('只挑 4 個水果', '先用窮舉法'); },
  async (tok, S) => { S.Tr = prefixTree(FR3, '', -2.4, 2.2, 6.6, 0.4, 0.34); S.Tr.show(0); S.Tr.show(1, FC.red); T('🍎 個數', 'idx', -0.2, 7.0); cap('第一層：蘋果挑 0、1、2、3、4 個', 'Decision tree'); },
  async (tok, S) => { S.Tr.show(2, FC.orange); T('🍊 個數', 'idx', 2.0, 7.0); cap('再挑柳丁：蘋果 0 個 → 柳丁 0～4', '蘋果 1 個 → 柳丁只能 0～3'); },
  async (tok, S) => { S.Tr.show(3, FC.green); T('🍐 補足 4', 'idx', 4.2, 7.0); cap('最後是梨子：只能補足 4 個', '沒有選擇了'); },
  async (tok, S) => { S.B.add('數葉子：' + S.Tr.leaves.length + ' 種', 'good'); cap('數一數：1、2、…、15', '列舉不會漏掉'); },
  async (tok, S) => { cap('難道每次都只會這個笨方法？', '有沒有新的想法'); },
  async (tok, S) => { S.Tr2 = null; Object.values(S.Tr.nodes).forEach((m) => kill(m)); lab.world.children.filter((o) => o.isLine).forEach((o) => lab.world.remove(o)); S.B.add('想成結帳：4 顆星星'); S.S = sbBuild(4, 3, 0.9); S.S.bars.forEach((m) => { m.visible = false; }); S.S.gl.forEach((l) => { l.element.style.visibility = 'hidden'; }); S.S.stars.forEach((m, i) => dropOn(m, (i - 1.5) * S.S.sp, S.S.y, S.S.z)); cap('去大潤發、Costco 結帳', '要挑 4 個水果 = 4 顆星星'); },
  async (tok, S) => { T('先放蘋果、再放柳丁、再放梨子', 'say', 0.8, 2.6, 0.9); cap('結帳時照種類排好', '蘋果、柳丁、梨子'); },
  async (tok, S) => { S.S.bars.forEach((m) => { m.visible = true; }); S.S.gl.forEach((l) => { l.element.style.visibility = ''; }); sbLayout(S.S, [1, 2, 1]); S.S.gl.forEach((l, b) => txt(l, ['🍎', '🍊', '🍐'][b] + ' ' + [1, 2, 1][b])); cap('用分隔棒隔開三種', '要 2 根棒子'); },
  async (tok, S) => { cap('這樣隔：1 個蘋果、2 個柳丁、1 個梨子', ''); },
  async (tok, S) => { sbLayout(S.S, [0, 2, 2]); S.S.gl.forEach((l, b) => txt(l, ['🍎', '🍊', '🍐'][b] + ' ' + [0, 2, 2][b])); cap('也可以：沒買蘋果、2 個柳丁、2 個梨子', ''); },
  async (tok, S) => { S.B.add('買法 ↔ 星星和棒子的排法：一對一'); cap('每一種買法都對應一種排法', '一對一，沒有漏掉'); },
  async (tok, S) => { sbLayout(S.S, [0, 0, 4]); S.S.gl.forEach((l, b) => txt(l, ['🍎', '🍊', '🍐'][b] + ' ' + [0, 0, 4][b])); T('004：棒棒★★★★', 'note', 0.8, 3.3, 0.9); cap('0 0 4：先兩根棒子，再四顆星', '0 1 3 也一樣對應'); },
  async (tok, S) => { S.B.add('4 星 + 2 棒 = 6 個位置'); cap('4 顆星、2 根棒子，一共 6 個東西', '星星一樣、棒子一樣'); },
  async (tok, S) => { S.B.add('6! / (4!·2!) = ' + fact(6) / (fact(4) * fact(2)) + '，和樹狀圖一樣', 'good'); cap('6!/(4!·2!) = 15', '跟窮舉的一樣'); },
  async (tok, S) => { cap('這個最重要', '星棒法：可重複的組合'); },
], [[0, 4.6, 14], [0, 3.6, 0]]);

scene('ct-l15-rones', '長度 n、有 r 個 1 的字串', [
  async (tok, S) => { S.row = []; for (let i = 0; i < 7; i++) S.row.push(cube('', FC.gray, [0.8, 0.8, 0.8], (i - 3) * 1.0, 0.4, 0)); T('長度 n（示意 n = 7）', 'ptr', 0, 1.6, 0); cap('填 n 個位數的 0/1 字串', '標準題'); },
  async (tok, S) => { [0, 2, 5].forEach((i) => { relabel(S.row[i], '1'); tint(S.row[i], FC.blue); }); [1, 3, 4, 6].forEach((i) => relabel(S.row[i], '0')); T('r 個 1（示意 r = 3）', 'ptr alt', 0, 2.3, 0); cap('要求裡面剛好 r 個 1', ''); },
  async (tok, S) => { T('n! / (r!·(n − r)!)　示意 7!/(3!·4!) = ' + Cb(7, 3), 'good', 0, 3.1, 0); cap('n! 再除掉 r 個 1 的 r!', '和 n − r 個 0 的 (n − r)!'); },
], [[0, 4, 11], [0, 1.6, 0]]);

scene('ct-l15-eq11', 'x₁ + x₂ + x₃ = 11 的自然數解', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.58); S.B.add('x₁ + x₂ + x₃ = 11'); cap('更數學的寫法：方程式', 'x₁ + x₂ + x₃ = 11'); },
  async (tok, S) => { S.B.add('自然數解：從 0 開始'); cap('自然數從 0 開始', '可以一個都不挑'); },
  async (tok, S) => { [0, 1, 2].forEach((b) => { crate((b - 1) * 2.6, -2.4, 2.0, 1.3, 0.4, '#c9a878', ['x₁ 🍎', 'x₂ 🍊', 'x₃ 🍐'][b]); }); cap('x₁ 蘋果、x₂ 柳丁、x₃ 梨子的個數', '跟挑水果同一題'); },
  async (tok, S) => { S.S = sbBuild(11, 3, 0.9); sbLayout(S.S, [4, 3, 4], true); cap('碗比較大：可以裝 11 個', ''); },
  async (tok, S) => { S.B.add('11 星 + 2 棒：13! / (11!·2!) = ' + Cb(13, 2), 'good'); cap('11 顆星用 2 根棒子隔開', '13!/(11!·2!) = 78'); },
  async (tok, S) => { S.B.add('有人記成 H 符號：不用背', 'say'); cap('另外有個 H 符號的公式', '腦筋轉一下就好，不必背'); },
], [[0, 5.2, 12.5], [0, 2.0, -0.6]]);

scene('ct-l15-pos11', '正整數解：每人先發一個', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.58); S.B.add('x₁ + x₂ + x₃ = 11，xᵢ 是正整數'); cap('改成正整數（從 1 開始）', '怎麼解？'); },
  async (tok, S) => { S.B.add('正整數 = 每種至少給 1 個'); cap('想成實際的東西', '每一種至少給一個'); },
  async (tok, S) => { [0, 1, 2].forEach((b) => { crate((b - 1) * 2.6, -2.4, 2.0, 1.3, 0.4, '#c9a878', ['x₁ 🍎', 'x₂ 🍊', 'x₃ 🍐'][b]); cube('', FC.orange, [0.4, 0.36, 0.4], (b - 1) * 2.6, 0.22, -2.4, 3); }); cap('先發：一個蘋果、一個柳丁、一個梨子', ''); },
  async (tok, S) => { S.S = sbBuild(8, 3, 0.9); sbLayout(S.S, [3, 2, 3], true, [1, 1, 1]); S.B.add('剩 11 − 3 = 8 個再分'); cap('剩下 8 個再分', ''); },
  async (tok, S) => { S.B.add('= 自然數解：C(10, 2) = ' + Cb(10, 2), 'good'); cap('變成沒有限制的自然數題', 'C(8 + 2, 2) = 45'); },
], [[0, 5.2, 12.5], [0, 2.0, -0.6]]);

scene('ct-l15-shift', '下限 3、1、−1：變數變換', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('x₁ ≥ 3、x₂ ≥ 1、x₃ ≥ −1，和 = 11'); cap('進階題：各有不同下限', '整數解有幾個？'); },
  async (tok, S) => { S.C = [0, 1, 2].map((b) => crate((b - 1) * 2.6, -2.4, 2.0, 1.3, 0.4, '#c9a878', 'x' + (b + 1))); for (let i = 0; i < 3; i++) cube('', FC.orange, [0.36, 0.32, 0.36], -2.6 + (i - 1) * 0.45, 0.2, -2.4, 3); cap('x₁ 至少 3 個：先給他 3 個', ''); },
  async (tok, S) => { cube('', FC.orange, [0.36, 0.32, 0.36], 0, 0.2, -2.4, 3); cap('x₂ 至少 1 個：先給 1 個', ''); },
  async (tok, S) => { S.debt = cube('−1', FC.red, [0.5, 0.36, 0.5], 2.6, 0.2, -2.4, 3); cap('x₃ ≥ −1：可以「吐一個出來」', '不好解釋，等一下用變數變換'); },
  async (tok, S) => { S.B.add('右邊：11 − 3 − 1 + 1 = 8', 'good'); cap('先用掉 3、1，再補回 1', '剩 8 個'); },
  async (tok, S) => { S.B.add('正式做法：變數變換'); cap('比較數學的寫法', '變數變換'); },
  async (tok, S) => { S.B.add('令 x₁ = x₁′ + 3 → x₁′ ≥ 0'); cap('令 x₁ = x₁′ + 3', 'x₁ ≥ 3 等於 x₁′ ≥ 0'); },
  async (tok, S) => { S.B.add('x₂ = x₂′ + 1、x₃ = x₃′ − 1 → 都 ≥ 0'); cap('x₂ = x₂′ + 1、x₃ = x₃′ − 1', '新變數都 ≥ 0'); },
  async (tok, S) => { S.B.add('代入：x₁′ + x₂′ + x₃′ = 8 → C(10, 2) = ' + Cb(10, 2), 'good'); S.S = sbBuild(8, 3, 0.9); sbLayout(S.S, [2, 4, 2], true); cap('代進去移項', 'x₁′ + x₂′ + x₃′ = 8'); },
], [[0, 5.2, 12.5], [0, 2.2, -0.6]]);

// brute force check of the upper-bound hint (示意): x1 in [3,5], x2 ≥ 1, x3 ≥ −1, sum 11
const UB = (() => { let c = 0; for (let a = 3; a <= 5; a++) for (let b = 1; b <= 11; b++) { const z = 11 - a - b; if (z >= -1) c++; } return c; })();
scene('ct-l15-upper', '再加上限：提示用排容', [
  async (tok, S) => { S.B = board(-6.6, 6.0, 0.6); S.B.add('同一題，再限制 x₁ 不能超過 5'); cap('再挑剔一點：x₁ 不能超過 5', '頭就痛了'); },
  async (tok, S) => { S.B.add('提示：inclusion–exclusion'); cap('提示：排容原理', ''); },
  async (tok, S) => {
    S.B.add('≥ 3 的算一次，再扣掉超過 5（≥ 6）的', 'good');
    T('示意：' + Cb(10, 2) + ' − ' + Cb(7, 2) + ' = ' + (Cb(10, 2) - Cb(7, 2)) + '（列舉檢查 ' + UB + '）', 'say', 1.0, 3.2);
    cap('合法的 = x₁ ≥ 3 的 − x₁ ≥ 6 的', '條件更多時要真的用排容');
  },
]);

scene('ct-l15-binom', '二項式定理與巴斯卡三角形', [
  async (tok, S) => { S.B = board(-6.6, 7.0, 0.55); S.B.add('二項式定理'); cap('二項式定理', '以前寫 C，現在很多人用 (n k)'); },
  async (tok, S) => { S.B.add('(x+y)² = x²+2xy+y²'); cap('高中背過：(x + y)²', 'x² + 2xy + y²'); },
  async (tok, S) => { S.B.add('(x+y)³ = x³+3x²y+3xy²+y³'); cap('(x + y)³', 'x³ + 3x²y + 3xy² + y³'); },
  async (tok, S) => { cap('前面的係數有規律', '其實是組合數'); },
  async (tok, S) => { ps.rows = []; ps.n = -1; for (let r = 0; r <= 2; r++) { shiftRow(addRow(), 3); await wt(tok, 300); } cap('巴斯卡三角形：兩邊都是 1', '中間是左上 + 右上'); },
  async (tok, S) => { shiftRow(addRow(), 3); glow(ps.rows[3][1], HL); glow(ps.rows[2][0], OKG); glow(ps.rows[2][1], OKG); cap('再下一層：1 3 3 1', '這是 (x + y)³ 的係數'); },
  async (tok, S) => { shiftRow(addRow(), 3); [ps.rows[3][1], ps.rows[2][0], ps.rows[2][1]].forEach((m) => glow(m, '#000000')); ps.rows[4].forEach((m) => glow(m, HL)); cap('1 4 6 4 1', '(x + y)⁴ 的係數'); },
  async (tok, S) => { ps.rows[4].forEach((m) => glow(m, '#000000')); S.B.add('xⁿ → C(n, 0)'); cap('不用這樣慢慢加', '直接帶組合數'); },
  async (tok, S) => { S.B.add('xⁿ⁻¹y → C(n,1)、xⁿ⁻²y² → C(n,2)'); cap('xⁿ⁻¹y¹ 是 C(n,1)', 'xⁿ⁻²y² 是 C(n,2)，要背'); },
  async (tok, S) => { S.B.add('xⁿ⁻³y² 的係數？'); cap('xⁿ⁻³y² 的係數是多少？', ''); },
  async (tok, S) => { S.B.add('次數和 ≠ n → 係數 0', 'good'); cap('每一項的次數加起來一定是 n', '看不到的項，係數就是 0'); },
], [[0, 4.4, 14], [0, 3.6, 0]]);

scene('ct-l15-why', '為什麼係數是 C(n, k)', [
  async (tok, S) => { S.br = [0, 1, 2, 3].map((i) => T('(x + y)', 'say', -3.6 + i * 2.4, 4.6)); T('示意 n = 4', 'idx', 0, 5.4); cap('用排列組合的想法', ''); },
  async (tok, S) => { cap('(x + y) 乘 n 個', '展開 = 分配律全部乘開'); },
  async (tok, S) => { S.pk = []; const ch = 'xyxx'; for (let i = 0; i < 4; i++) { S.pk.push(chip(ch[i], ch[i] === 'x' ? FC.blue : FC.green, -3.6 + i * 2.4, 3.6, 0.7, 0.6, 1)); await wt(tok, 200); } T('→ x³y', 'note', 4.8, 3.6); cap('每個括號挑 x 或 y 其中一個', '乘起來就是一項'); },
  async (tok, S) => { S.pk.forEach(kill); for (let i = 0; i < 4; i++) chip('x', FC.blue, -3.6 + i * 2.4, 2.6, 0.7, 0.6, 1); T('xⁿ：n 組全挑 x → C(n, n) = 1', 'good', 0, 1.6); cap('xⁿ：每一組都挑 x', '只有 1 種'); },
  async (tok, S) => { T('C(n, n) = C(n, 0)：挑 0 個 y', 'say', 0, 1.0); cap('也可以說：y 挑 0 個', 'C(n, 0)'); },
  async (tok, S) => { T('xⁿ⁻¹y：n 組裡挑 1 組出 y → C(n, 1)', 'good', 0, 0.4); cap('xⁿ⁻¹y：挑一組出 y', '有 n 種挑法'); },
  async (tok, S) => { T('每種挑法係數都是 1，加起來 = C(n, k)', 'note', 0, 6.2); cap('每種挑法的係數都是 1', '加起來就是組合數'); },
], [[0, 4.0, 13], [0, 3.0, 0]]);

scene('ct-l15-ident', '代值證明：Σ C(n,k) = 2ⁿ 等', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.62); S.B.add('證明 Σ_{k=0}^{n} C(n, k) = 2ⁿ'); cap('稍作變化：證明恆等式', 'C(n,0) + C(n,1) + … + C(n,n) = 2ⁿ'); },
  async (tok, S) => { S.B.add('(x + y)ⁿ = Σ C(n,k) xⁿ⁻ᵏ yᵏ，令 x = 1、y = 1'); cap('不要真的乘開', '給 x、y 適當的值'); },
  async (tok, S) => { S.B.add('左邊 (1 + 1)ⁿ = 2ⁿ，右邊 Σ C(n, k)', 'good'); cap('左邊 2ⁿ', '右邊每項都乘 1：得證'); },
  async (tok, S) => { S.B.add('Σ (−1)ᵏ C(n, k)：令 x = 1、y = −1'); cap('有 (−1)ᵏ 的', 'y 帶 −1'); },
  async (tok, S) => { S.B.add('(1 + (−1))ⁿ = 0', 'good'); cap('1 + (−1) = 0', '所以加加減減 = 0'); },
  async (tok, S) => { S.B.add('Σ 2ᵏ C(n, k)：令 x = 1、y = 2 → 3ⁿ', 'good'); cap('有 2ᵏ 的：y 帶 2', '(1 + 2)ⁿ = 3ⁿ'); },
]);

scene('ct-l15-pascal', '巴斯卡恆等式：拿不拿鑽石', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.58); S.B.add('證明 C(n+1, k) = C(n, k−1) + C(n, k)'); cap('最後一個證明', ''); },
  async (tok, S) => { cap('這其實就是巴斯卡三角形', ''); },
  async (tok, S) => { pascalRows(3, 3); cap('1；1 1；1 2 1；1 3 3 1', ''); },
  async (tok, S) => { glow(ps.rows[3][1], HL); glow(ps.rows[2][0], OKG); glow(ps.rows[2][1], OKG); cap('3 = C(3, 1) = C(2, 0) + C(2, 1)', '下面一格 = 上面兩格'); },
  async (tok, S) => { S.B.add('下一層 = 上一層兩項相加'); cap('換成變數', '上一層、項次平移一格'); },
  async (tok, S) => { S.B.add('笨方法：用階乘公式展開驗算', 'say'); cap('可以用高中的笨方法', '把階乘寫出來驗算'); },
  async (tok, S) => { cap('排列組合只要出嘴巴', '什麼都不用算'); },
  async (tok, S) => { ps.rows.forEach((row) => row.forEach((m) => glow(m, '#000000'))); S.bs = []; for (let i = 0; i < 6; i++) S.bs.push(ball('', i === 0 ? '#9fd3f0' : FC.blue, 0.28, -1.2 + i * 0.9, 0.3, 2.4)); T('n + 1 個東西挑 k 個', 'ptr', 1.0, 1.0, 2.4); cap('n + 1 個東西挑 k 個', '有幾種挑法？'); },
  async (tok, S) => { icon('💎', '', -1.2, 1.2, 2.4); cap('看第一個：假設是一顆鑽石', '拿或不拿'); },
  async (tok, S) => { S.B.add('拿鑽石：C(n, k−1)', 'good'); glw(S.bs[0], HL); cap('拿了鑽石放口袋', '剩 n 個，還要挑 k − 1 個'); },
  async (tok, S) => { glw(S.bs[0], NG); S.B.add('不拿鑽石：C(n, k)', 'good'); cap('不喜歡鑽石，丟掉', '剩 n 個，還能挑 k 個'); },
  async (tok, S) => { S.B.add('互斥 → 相加：組合式證明', 'note'); cap('寫故事就好，也是證明', '組合式證明（combinatorial proof）'); },
], [[0, 4.4, 14], [0, 3.6, 0]]);

// ════════ 清大 趙啟超 第5A–5D講 Pigeonhole Principle ════════
scene('ct-z5-state', '鴿籠原理的敘述', [
  async (tok, S) => { S.B = board(-6.6, 6.0, 0.6); S.B.add('Pigeonhole Principle'); cap('今天介紹 Pigeonhole Principle', '鴿籠原理'); },
  async (tok, S) => { S.b = [0, 1, 2, 3, 4].map((i) => bird(V3(0.6 + i * 0.75, 2.6, 1.6))); cap('pigeon 是鴿子（賽鴿那種）', ''); },
  async (tok, S) => { S.C = crates(4, null, 2.4, 0, 1.2, 0.35); cap('pigeonhole 是養鴿子的籠子', '一格一格的'); },
  async (tok, S) => { S.B.add('m 隻鴿子放進 n 個籠子'); cap('m 隻鴿子放進 n 個鴿籠', '（示意 m = 5、n = 4）'); },
  async (tok, S) => { S.B.add('m > n'); cap('鴿子比籠子多：m > n', ''); },
  async (tok, S) => { S.B.add('⇒ 某個籠子裡有超過一隻', 'good'); cap('結論：某些籠子裡不只一隻', ''); },
  async (tok, S) => {
    await arc(tok, S.b.slice(0, 4), [0, 1, 2, 3].map((j) => S.C.slot(j)), 800, 1.0);
    await arc(tok, [S.b[4]], [S.C.slot(1)], 600, 1.2); S.C.hot(1);
    cap('每個籠子都放一隻後', '多的那隻只能和別人擠');
  },
  async (tok, S) => { S.B.add('中文：蘿蔔比坑多 → 有坑放兩個以上', 'say'); cap('中文說法：一個蘿蔔一個坑', '蘿蔔比坑多，就有坑裡兩個以上'); },
], [[0, 5.0, 11.5], [0, 2.0, 0]]);

scene('ct-z5-proof', '證明：用 contrapositive', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.62); S.B.add('證明很簡單'); cap('來看證明', ''); },
  async (tok, S) => { S.B.add('若 P 則 Q ⇔ 若非 Q 則非 P（contrapositive）'); cap('要證「若 P 則 Q」', '改證「若非 Q 則非 P」'); },
  async (tok, S) => { S.B.add('假設：沒有籠子超過一隻（非 Q）'); cap('先假設結論不對', '所有籠子都不超過一隻'); },
  async (tok, S) => { S.C = crates(4, null, 2.6, 0, 1.2, 0.35); for (let j = 0; j < 4; j++) bird(S.C.slot(j)); S.B.add('每個籠子最多 1 隻'); cap('每個籠子最多只有一隻', ''); },
  async (tok, S) => { S.B.add('n 個籠子 → 鴿子最多 n 隻'); T('最多 n 隻', 'ptr alt', 2.6, 1.6); cap('n 個籠子', '所以鴿子總數不超過 n'); },
  async (tok, S) => { S.B.add('但鴿子有 m 隻、m > n：矛盾', 'bad'); cap('原來說有 m 隻，而且 m > n', '跟假設矛盾'); },
  async (tok, S) => { S.B.add('用 not Q ⇒ not P 證完 P ⇒ Q', 'good'); cap('contrapositive 證完', '想想都知道'); },
], [[0, 5.0, 13], [0, 2.8, 0]]);

scene('ct-z5-func', '函式版本：一對一需要 |B| ≥ |A|', [
  async (tok, S) => { S.A = setDots(['', '', '', ''], -0.4, FC.blue, 0.6); S.Bd = setDots(['', '', ''], 4.0, FC.green, 0.6); T('A（domain）', 'ptr', -0.4, 1.2, -2.0); T('B（codomain）', 'ptr', 4.0, 1.2, -1.5); S.B = board(-6.6, 6.2, 0.6); S.B.add('用 one-to-one function 來寫'); cap('換個樣子：用函式來寫', ''); },
  async (tok, S) => { S.B.add('f：A → B，一對一 = injective'); cap('A 是 domain、B 是 codomain', 'one-to-one 又叫 injective'); },
  async (tok, S) => { S.B.add('A、B 都是有限集合'); cap('A、B 都是 finite set', 'size 才有意義'); },
  async (tok, S) => { S.B.add('一對一 ⇒ |B| ≥ |A|（必要條件）', 'good'); cap('要一對一，codomain 要夠大', '|B| ≥ |A|'); },
  async (tok, S) => {
    [0, 1, 2, 2].forEach((j, i) => arrow(S.A[i].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[j].position.clone().add(V3(-0.3, 0.1, 0)), i >= 2 ? 0xd64545 : 0xb9a684));
    glw(S.Bd[2], NG);
    cap('B 不夠大：鴿子比籠子多', '某個籠子有兩隻 → 不是一對一');
  },
  async (tok, S) => { S.B.add('|A| > |B| ⇒ f 不是一對一'); cap('反過來寫（contrapositive）', 'domain 比 codomain 大 → 不是一對一'); },
  async (tok, S) => { S.B.add('三種寫法都是 equivalent', 'say'); cap('這幾個敘述是一樣的', '都叫 pigeonhole principle'); },
  async (tok, S) => { S.B.add('關鍵：誰是鴿子、誰是籠子', 'note'); cap('應用時：確定哪些是鴿子、哪些是籠子', '兩邊數目算一算'); },
], [[0, 5.0, 13], [0, 2.4, 0]]);

const W4 = [1, 2, 3, 4].map((k) => 26 ** k), W4S = W4.reduce((a, b) => a + b, 0);
scene('ct-z5-words', '50 萬個 4 字母以內的英文字', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('給 500,000 個英文字'); cap('例子：50 萬個英文字', ''); },
  async (tok, S) => { S.B.add('每個字由 ≤ 4 個小寫字母組成'); cap('每個字是 4 個以下的小寫字母', 'lowercase'); },
  async (tok, S) => { S.B.add('可能全部都不一樣嗎？'); cap('這 50 萬個字可能全部不同嗎？', ''); },
  async (tok, S) => { S.B.add('兩個集合的 size 算一算'); cap('兩個數字：50 萬', '和「所有可能的字」有幾個'); },
  async (tok, S) => { S.B.add('小寫字母 26 個（常識）'); cap('小寫英文字母有 26 個', '常識'); },
  ...[1, 2, 3, 4].map((k) => async (tok, S) => {
    for (let i = 0; i < k; i++) cube('', FC.blue, [0.5, 0.5, 0.5], 0.2 + i * 0.6, 5.6 - (k - 1) * 1.0, 0);
    T(k + ' 個字母：26' + (k > 1 ? '^' + k : '') + ' = ' + fmt(W4[k - 1]), 'say', 4.9, 5.6 - (k - 1) * 1.0);
    cap(k + ' 個字母的字', k === 1 ? '只有一個位置：26 種' : '每個位置 26 種：26' + ['', '', '²', '³', '⁴'][k]);
  }),
  async (tok, S) => { T('合計 ' + fmt(W4S), 'good', 3.4, 1.4); cap('全部加起來', '475,254 個不同的字'); },
  async (tok, S) => { S.B.add('500,000 > 475,254：鴿子 > 籠子'); cap('50 萬 > 47 萬 5 千多', '50 萬個字是鴿子、所有可能的字是籠子'); },
  async (tok, S) => { S.B.add('⇒ 一定有兩個字一樣（會重複）', 'good'); cap('至少有兩個字一樣', '不可能全部不同'); },
  async (tok, S) => { S.B.add('如果只有 40 萬：可能全不同', 'say'); cap('若只有 40 萬個', '數目沒那麼多，就可能全部不同'); },
  async (tok, S) => { cap('大部分題目：把兩個數字算出來', '確定誰是鴿子、誰是籠子，比一比'); },
], [[0, 4.2, 13.5], [0, 3.2, 0]]);

scene('ct-z5-div', '1～200 選 101 個：先把 x 寫成 2ᵏ·y', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('關鍵：怎麼想這件事'); cap('再看一個例子', '關鍵只在怎麼想'); },
  async (tok, S) => { S.dots = []; for (let v = 1; v <= 200; v++) S.dots.push(cube('', FC.card, [0.26, 0.2, 0.26], 0.4 + ((v - 1) % 20) * 0.32, 0.1, -2.4 + Math.floor((v - 1) / 20) * 0.34)); S.B.add('從 S = {1, 2, …, 200} 選 101 個整數'); cap('S = {1, 2, …, 200}', '選 101 個不同的整數'); },
  async (tok, S) => { S.B.add('證明：有兩個數，一個整除另一個'); cap('一定有兩個整數', 'one divides the other'); },
  async (tok, S) => { S.B.add('= 一個是另一個的因數（倍數）'); cap('整除：一個是另一個的因數', '也就是另一個是它的倍數'); },
  async (tok, S) => { cap('關鍵：你把數寫成什麼樣子', '寫出來基本上就結束了'); },
  async (tok, S) => { S.B.add('x = 2ᵏ · y（把 2 的因數全部提出來）', 'good'); cap('把 x 寫成 2ᵏ × y', '2 的因數全部提到前面'); },
  async (tok, S) => { S.B.add('k ≥ 0；x 是奇數時 k = 0'); cap('k 是 ≥ 0 的整數', 'x 不是 2 的倍數，k 就是 0'); },
  async (tok, S) => { T('28 = 2² × 7 → k = 2、y = 7', 'note', 3.6, 3.6); glw(S.dots[27], HL); cap('例：28 = 4 × 7 = 2² × 7', 'k = 2、y = 7（質因數分解）'); },
  async (tok, S) => { S.B.add('gcd(2, y) = 1'); cap('y 裡面不會再有 2 的因數', 'gcd(2, y) = 1'); },
  async (tok, S) => { S.B.add('GCD = 最大公因數', 'say'); cap('GCD：greatest common divisor', '最大公因數'); },
  async (tok, S) => { S.B.add('LCM = 最小公倍數', 'say'); cap('LCM：least common multiple', '最小公倍數'); },
  async (tok, S) => { S.B.add('gcd = 1：互質（relatively prime）'); cap('gcd 等於 1 叫互質', 'relatively prime'); },
  async (tok, S) => { S.B.add('這樣寫法唯一：k、y 都只有一種'); cap('寫成這樣是唯一的', '沒有 ambiguity'); },
  async (tok, S) => { S.B.add('⇒ y 是奇數', 'good'); cap('所有 2 都提到前面了', '所以 y 是奇數'); },
], [[0, 4.6, 13.5], [0, 2.8, 0]]);

scene('ct-z5-div2', '奇數 y 只有 100 種 → 必有 a | b', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('y 是奇數，且 y ≤ 200'); cap('y 是奇數', 'y 是 x 的因數，不會超過 200'); },
  async (tok, S) => { S.row = []; for (let i = 0; i < 100; i++) S.row.push(cube('', FC.sand, [0.1, 0.25, 0.5], 0.3 + i * 0.065, 0.12, 0)); T('y ∈ T = {1, 3, 5, …, 199}', 'ptr', 3.5, 0.9); cap('y 只可能是 1、3、5、…、199', ''); },
  async (tok, S) => { S.B.add('|T| = 100（1～200 的奇數）'); cap('1 到 200 的奇數有 100 個', '|T| = 100'); },
  async (tok, S) => { S.B.add('拿 101 個整數，每個寫成 2ᵏ·y'); cap('拿 101 個整數出來', '不同的 y 最多只有 100 種'); },
  async (tok, S) => { S.B.add('101 隻鴿子、100 個籠子 → 兩數的 y 相同', 'good'); glw(S.row[3], HL); cap('by the pigeonhole principle', '有兩個整數的 y 一樣'); },
  async (tok, S) => { S.B.add('a = 2ᵐ·y、b = 2ⁿ·y'); cap('這兩個數：a = 2ᵐ·y、b = 2ⁿ·y', 'y 一樣，2 的次方不同'); },
  async (tok, S) => { S.B.add('a ≠ b ⇒ m ≠ n'); cap('兩個不同的整數', '所以 m ≠ n'); },
  async (tok, S) => { S.B.add('m < n ⇒ b 是 a 的倍數'); cap('如果 m < n', 'b 就是 a 的倍數'); },
  async (tok, S) => { T('2² × 7 = 28 → 再乘 2 → 2³ × 7 = 56', 'note', 3.4, 4.2); cap('例：2² × 7 和 2³ × 7', '再乘一個 2 就變它'); },
  async (tok, S) => { T('a | b：a 整除 b', 'good', 3.4, 3.4); cap('符號 a | b', '念 a divides b'); },
  async (tok, S) => { T('定義：b = a·c（c 是自然數）', 'say', 3.4, 2.8); cap('a | b 的定義', 'b = a × 另一個自然數 c'); },
  async (tok, S) => { T('a 是 b 的因數；b 是 a 的倍數', 'say', 3.4, 2.2); cap('也可說：a is a divisor of b', 'b is a multiple of a'); },
  async (tok, S) => { S.B.add('否則 m > n ⇒ b | a'); cap('否則 m > n', '反過來 b 整除 a'); },
  async (tok, S) => { S.B.add('不管哪種：一個整除另一個', 'good'); cap('either case 都證出來了', ''); },
  async (tok, S) => { S.B.add('關鍵：把 x 寫成 2ᵏ·y'); cap('關鍵只是把 x 寫成 2ᵏ × y', '後面一下子就出來'); },
  async (tok, S) => { S.B.add('籠子 = 同一個 y 的數放一起', 'note'); cap('鴿籠怎麼分？', '同樣 y 的放在一起'); },
  async (tok, S) => { cap('y 一定是奇數', '這是 gcd(2, y) = 1 要求的'); },
], [[0, 4.6, 13.5], [0, 2.8, 0]]);

// equilateral triangle, side 1 → 6 world units, lying on the floor (x, z)
const TS = 6.0, TA = V3(-TS / 2, 0.05, 2.0), TC = V3(TS / 2, 0.05, 2.0), TE = V3(0, 0.05, 2.0 - TS * Math.sqrt(3) / 2);
const mid = (p, q) => p.clone().add(q).multiplyScalar(0.5);
const tri = (p, q, r, col = '#6e5f49') => [line(p.x, 0.06, p.z, q.x, 0.06, q.z, col), line(q.x, 0.06, q.z, r.x, 0.06, r.z, col), line(r.x, 0.06, r.z, p.x, 0.06, p.z, col)];
const TPTS = [[0.15, 0.2], [0.55, 0.25], [0.3, 0.55], [0.75, 0.15], [0.6, 0.3]]; // 示意 barycentric-ish spots
scene('ct-z5-tri', '等邊三角形放 5 點：必有兩點距離 < ½', [
  async (tok, S) => { tri(TA, TC, TE); T('A', 'ptr', TA.x - 0.4, 0.3, TA.z + 0.3); T('C', 'ptr', TC.x + 0.4, 0.3, TC.z + 0.3); T('E', 'ptr', TE.x, 0.3, TE.z - 0.4); T('AC = 1', 'idx', 0, 0.2, 2.6); cap('三角形 ACE 是等邊三角形', 'AC 長度 1'); },
  async (tok, S) => { T('每個角 60°', 'say', 0, 0.6, 0.6); cap('三個邊一樣 → 三個角一樣', '每個角 60 度'); },
  async (tok, S) => { S.pt = []; const u = [[0.2, 0.15], [0.45, 0.2], [0.35, 0.45], [0.7, 0.1], [0.62, 0.28]]; u.forEach(([a, b]) => { const p = TA.clone().add(TC.clone().sub(TA).multiplyScalar(a)).add(TE.clone().sub(TA).multiplyScalar(b)); S.pt.push(ball('', FC.blue, 0.13, p.x, 0.18, p.z, 2)); }); cap('從三角形內部挑 5 個點', '（點的位置是示意）'); },
  async (tok, S) => { T('interior：只有內部，不含邊', 'idx', 4.4, 0.3, -0.6); cap('interior 是內部', '外框上的點不算'); },
  async (tok, S) => { T('⇒ 至少兩點距離 < ½', 'note', 0, 2.0, -3.6); cap('要證：至少有兩點', '距離小於二分之一'); },
  async (tok, S) => { cap('鴿子就是這 5 個點', '籠子要自己做出來'); },
  async (tok, S) => { cap('目標：把三角形切成 4 塊', '每一塊裡任兩點距離都 < ½'); },
  async (tok, S) => { S.m1 = mid(TA, TC); S.m2 = mid(TC, TE); S.m3 = mid(TE, TA); tri(S.m1, S.m2, S.m3, FC.gold); T('½', 'idx', -1.5, 0.2, 2.4); T('½', 'idx', 1.5, 0.2, 2.4); cap('連三邊中點', '切成 4 個邊長 ½ 的等邊三角形'); },
  async (tok, S) => { cap('同一個小三角形裡的兩點', '距離都 < ½（頂點不算在內部）'); },
  async (tok, S) => { T('R1', 'ptr', -1.5, 0.3, 1.2); T('R2', 'ptr', 1.5, 0.3, 1.2); T('R3', 'ptr', 0, 0.3, -1.4); T('R4', 'ptr', 0, 0.3, 0.6); cap('這 4 個區域就是 4 個籠子', 'R1、R2、R3、R4'); },
  async (tok, S) => { glw(S.pt[3], NG); glw(S.pt[4], NG); cap('5 個點、4 個區域', '至少兩點落在同一區域'); },
  async (tok, S) => { cap('一定在內部，不會剛好在端點', '所以距離 < ½，證完'); },
  async (tok, S) => { cap('大部分題目：鴿子很清楚', '重點是想出籠子'); },
  async (tok, S) => { cap('沒有萬用方法', '見招拆招'); },
], [[0, 8.5, 7.5], [0, 0, 0.2]]);

scene('ct-z5-friends', '有限人群中必有兩人朋友數相同', [
  async (tok, S) => { cap('多看一點例子就比較容易', '原理很簡單，應用要會想'); },
  async (tok, S) => { cap('這題乍看籠子很多', '仔細看其實沒那麼多'); },
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.5); S.B.add('任何有限的人群 A'); S.pos = [0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * Math.PI * 2; return V3(1.4 + Math.cos(a) * 1.4, 0.35, -1.4 + Math.sin(a) * 1.4); }); S.pp = S.pos.map((p, i) => cube(i + 1, FC.blue, [0.6, 0.6, 0.6], p.x, p.y, p.z, 2)); cap('A 是一群人，人數有限', '（示意 5 人）'); },
  async (tok, S) => { S.B.add('⇒ 有兩人在 A 裡的朋友數相同', 'good'); cap('一定有兩人朋友數一樣', '只算 A 裡面的朋友'); },
  async (tok, S) => { S.B.add('假設 |A| ≥ 2'); cap('至少要有 2 個人', '一個人就沒有「兩個人」了'); },
  async (tok, S) => { S.B.add('朋友是 mutual（互相的）'); cap('朋友是互相的', ''); },
  async (tok, S) => { cap('不容許單相思', '你當他朋友，他也當你朋友'); },
  async (tok, S) => { S.B.add('x 是 x′ 的朋友 ⇔ x′ 是 x 的朋友'); [[0, 1], [1, 2], [0, 3]].forEach(([a, b]) => rod(S.pos[a], S.pos[b], FC.pink, 0.05)); cap('x 是 x′ 的朋友', 'x′ 也是 x 的朋友（示意）'); },
  async (tok, S) => { S.B.clear(); S.B.add('定義 f(x) = x 在 A 裡的朋友數'); cap('定義一個函式 f', 'number of friends'); },
  async (tok, S) => { [2, 2, 1, 1, 0].forEach((d, i) => T('f=' + d, 'ptr', S.pos[i].x, 1.0, S.pos[i].z)); cap('f(x)：x 在 A 裡有幾個朋友', '外面的不算'); },
  async (tok, S) => { S.B.add('要證：存在 x₁ ≠ x₂，f(x₁) = f(x₂)'); cap('要證：有兩人 f 值一樣', ''); },
  async (tok, S) => { S.B.add('⇔ f 不是一對一（不是 injective）', 'good'); cap('也就是：f 不是一對一', '變成數學問題'); },
  async (tok, S) => { S.B.add('domain A：|A| = m'); cap('domain 的 size 是 m', 'm ≥ 2'); },
  async (tok, S) => { S.C = crates(5, ['0', '1', '2', '3', 'm−1'], 3.6, 2.2, 0.8, 0.15); S.B.add('codomain B = {0, 1, …, m − 1}'); cap('朋友數可能是 0、1、2、…、m − 1', '最多 m − 1（自己不算）'); },
  async (tok, S) => { S.B.add('|B| = m：數目一樣，還不能說'); cap('兩邊都是 m', '光看數目沒辦法說不是一對一'); },
  async (tok, S) => { S.C.hot(4); S.B.add('有人 m − 1 個朋友 ⇒ 其他人都是他朋友'); cap('仔細看：有人有 m − 1 個朋友', '表示所有其他人都是他朋友'); },
  async (tok, S) => { S.B.add('⇒ 沒有人 0 個朋友'); cap('朋友是互相的', '所以沒有人沒有朋友'); },
  async (tok, S) => { S.C.hot(0); T('0 與 m − 1 不會同時出現', 'bad', 3.6, 1.2, 2.2); cap('0 和 m − 1 不能同時是 f 的值', '有 0 就沒 m − 1；有 m − 1 就沒 0'); },
  async (tok, S) => { S.B.add('f 的值域最多 m − 1 個值'); cap('f 的值域（range）最多 m − 1 個', ''); },
  async (tok, S) => { S.B.add('m 隻鴿子、≤ m − 1 個籠子 ⇒ 不是一對一', 'good'); cap('鴿籠原理：f 一定不是 injective', ''); },
  async (tok, S) => { S.B.add('⇒ 有 x₁、x₂ 朋友數一樣', 'good'); cap('就有兩人朋友數相同', '證完'); },
  async (tok, S) => { cap('怎麼想到的？', '找個小例子試試看就會看到'); },
], [[0, 4.6, 13.5], [0, 3.0, 0]]);

function balance(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); lab.world.add(g);
  const post = lab.box('#8a7a60', [0.16, 1.4, 0.16]); post.position.set(0, 0.7, 0); g.add(post);
  const beam = new THREE.Group(); beam.position.set(0, 1.45, 0); g.add(beam);
  const bar = lab.box('#6e5f49', [3.0, 0.08, 0.14]); beam.add(bar);
  [-1.4, 1.4].forEach((px) => { const pan = lab.box('#c9a878', [0.9, 0.06, 0.9]); pan.position.set(px, -0.3, 0); beam.add(pan); });
  return { g, beam, async tilt(tok, a, ms = 600) { const a0 = beam.rotation.z; await anim(tok, ms, (u) => { beam.rotation.z = a0 + (a - a0) * u; }); } };
}
scene('ct-z5-balls', '10 顆球、天平用兩次：不可能', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('還是 pigeonhole：兩個集合 + 一個函式'); cap('最後一個例子', '有點像益智問題，其實是鴿籠原理'); },
  async (tok, S) => { S.bl = []; for (let i = 0; i < 10; i++) S.bl.push(ball('', '#d8cfc0', 0.26, -0.8 + i * 0.62, 0.27, 2.2)); S.B.add('10 顆球，外表一樣'); cap('10 顆球，外表看起來都一樣', ''); },
  async (tok, S) => { S.B.add('其中恰有一顆比較重'); cap('裡面只有一顆比其他重', '外表看不出來'); },
  async (tok, S) => { S.bal = balance(2.4, -0.8); S.B.add('工具：天平（沒有刻度）'); cap('有一個天平', '不是秤，沒有刻度'); },
  async (tok, S) => { S.B.add('只看得到：左重、右重、一樣重'); cap('只看得到三種結果', '右邊重、左邊重、一樣重'); },
  async (tok, S) => { await S.bal.tilt(tok, 0.18); await wt(tok, 300); await S.bal.tilt(tok, 0); cap('兩邊各放兩顆', '有重球那邊就沉下去；都一樣就平'); },
  async (tok, S) => { S.B.add('天平只准用兩次'); cap('只准用天平兩次', ''); },
  async (tok, S) => { S.B.add('能不能保證找到重球？'); cap('always 能決定哪顆比較重？', ''); },
  async (tok, S) => { cap('有人說他有方法', '判斷：這樣的方法存在嗎？'); },
  async (tok, S) => { S.out = []; ['左重', '右重', '平'].forEach((t, i) => S.out.push(T(t, 'say', 1.0, 4.6 - i * 0.7))); cap('第一次：三種結果', '第二次：也是三種'); },
  async (tok, S) => { const r = ['左', '右', '平']; let k = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { T(r[i] + r[j], 'ptr', 3.2 + j * 1.1, 4.6 - i * 0.7); k++; } T('3 × 3 = 9 種看到的結果', 'good', 4.3, 5.4); cap('兩次一共只看到 3 × 3 = 9 種', ''); },
  async (tok, S) => { S.bl.forEach((b, i) => T(String(i + 1), 'idx', b.position.x, 0.75, 2.2)); S.B.clear(); S.B.add('要分辨 10 種情況（哪顆重）'); cap('哪顆重：有 10 種情況', ''); },
  async (tok, S) => { S.B.add('9 < 10 → 不可能全部分出來', 'bad'); cap('3² = 9 < 10', '一定沒辦法全部分開'); },
  async (tok, S) => { glw(S.bl[3], NG); glw(S.bl[7], NG); cap('至少有兩種狀況', '天平看起來一模一樣 → 分不出來'); },
  async (tok, S) => { S.B.add('運氣好可能分得出來，但不是 always', 'say'); cap('by the pigeonhole principle', '有時運氣好，但不是一定'); },
  async (tok, S) => { cap('不用去驗證他的方法', '算一算結果的數目就知道'); },
  async (tok, S) => { S.B.add('10 隻鴿子、9 個籠子', 'good'); cap('10 隻鴿子、9 個籠子', '必有兩種狀況擠在同一結果'); },
  async (tok, S) => { S.B.add('衍生：12 顆球，一顆較重或較輕'); cap('衍生題：12 顆球', '一顆不一樣，可能重也可能輕'); },
  async (tok, S) => { S.B.add('24 種情況 ≤ 3³ = 27 種結果'); cap('12 × 2 = 24 種情況', '天平用 3 次：27 種結果'); },
  async (tok, S) => { S.B.add('數目夠 ≠ 一定做得到（要找出方法）', 'note'); cap('24 < 27 只是「有可能」', '要真的設計出方法'); },
  async (tok, S) => { cap('這題做得到', '回家想一想（益智問題）'); },
], [[0, 4.4, 13.5], [0, 3.0, 0]]);

scene('ct-z5-onto', 'onto 與 bijection：兩邊一樣大', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.58); S.B.add('A、B 都是 finite set'); cap('最後補充 onto 的情況', 'A、B 都是有限集合'); },
  async (tok, S) => { S.B.add('onto（surjective）：B 每個都被對到'); cap('onto 也叫 surjective', 'B 的每個元素都要被對到'); },
  async (tok, S) => { S.A = setDots(['', ''], 0.6, FC.blue, 0.4); S.Bd = setDots(['', '', '', ''], 4.6, FC.green, 0.4); arrow(S.A[0].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[0].position.clone().add(V3(-0.3, 0.1, 0)), 0xb9a684); arrow(S.A[1].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[1].position.clone().add(V3(-0.3, 0.1, 0)), 0xb9a684); glw(S.Bd[2], NG); glw(S.Bd[3], NG); cap('A 太少：例如 5 個對 10 個', '不可能全部對到（示意 2 對 4）'); },
  async (tok, S) => { S.B.add('onto ⇒ |A| ≥ |B|', 'good'); cap('A 要夠大', '|A| ≥ |B| 是必要條件'); },
  async (tok, S) => { S.B.add('|A| < |B| ⇒ 不是 onto'); cap('反過來', 'A 比 B 小就一定不是 onto'); },
  async (tok, S) => { S.B.add('一對一 ⇒ |A| ≤ |B|'); cap('前面：一對一要 B 夠大', '|A| ≤ |B|'); },
  async (tok, S) => { S.B.add('又一對一又 onto ⇒ |A| = |B|', 'good'); cap('兩個都成立', '只好相等'); },
  async (tok, S) => { S.B.add('= bijection（one-to-one correspondence）'); cap('又一對一、又 onto', '叫 bijection'); },
  async (tok, S) => { S.B.add('要證兩集合一樣大：建立一個 bijection', 'note'); cap('常用來證明兩邊數目一樣', '建立一個一一對應'); },
  async (tok, S) => { S.B.add('（只對有限集合談 size）', 'say'); cap('finite set 才能這樣說 size', ''); },
  async (tok, S) => { cap('證明用 contrapositive', '很簡單，不證了'); },
], [[0, 4.6, 13.5], [0, 2.8, 0]]);

// ════════ 清大 趙啟超 第9A–9D講 Principles of Counting ════════
function dotsIn(n, cx, cz, color, r = 0.6, labels = null) { return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + 0.4, x = cx + Math.cos(a) * r * (n > 1 ? 1 : 0), z = cz + Math.sin(a) * r * (n > 1 ? 1 : 0); const m = ball('', color, 0.2, x, 0.25, z); if (labels) T(labels[i], 'idx', x, 0.65, z); return m; }); }
scene('ct-z9-rules', '加法原理與乘法原理（集合寫法）', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('第二部分 Enumeration：Principles of Counting'); cap('進入第二部分：Enumeration（計數）', '先教 principles of counting'); },
  async (tok, S) => { S.B.add('兩個原理：加法原理、乘法原理'); cap('高中排列組合大概就兩個原理', '加法原理、乘法原理'); },
  async (tok, S) => { S.zA = zone('A', 1.4, 0.03, 0, 2.4, 2.4, '#dbe9f6'); S.zB = zone('B', 4.6, 0.03, 0, 2.4, 2.4, '#dcf1e6'); S.a = dotsIn(3, 1.4, 0, FC.blue); S.b = dotsIn(2, 4.6, 0, FC.green); S.B.add('加法原理：A、B 是有限集合'); cap('Addition Principle', 'A、B 都是 finite set（示意 3 個、2 個）'); },
  async (tok, S) => { S.B.add('A ∩ B = ∅（disjoint）'); T('沒有交集', 'say', 3.0, 1.6, 0); cap('A 和 B 沒有交集', 'disjoint'); },
  async (tok, S) => { S.B.add('|A ∪ B| = |A| + |B|', 'good'); T('3 + 2 = 5', 'good', 3.0, 2.3, 0); cap('聯集的大小 = 兩個加起來', '|A ∪ B| = |A| + |B|'); },
  async (tok, S) => { S.B.add('要數一個集合 → 拆成兩個不相交的部分'); cap('要數一個集合有幾個元素', '拆成兩個不相交的部分，各數各的'); },
  async (tok, S) => { S.B.add('重點：不要數到重複', 'note'); cap('重點是交集是空集合', '才不會重複數'); },
  async (tok, S) => { S.B.clear(); S.B.add('乘法原理：A、B 有限'); cap('Multiplication Principle', ''); },
  async (tok, S) => { S.B.add('Cartesian product：A × B'); cap('A 和 B 的 Cartesian product', 'A × B'); },
  async (tok, S) => {
    S.B.add('A × B = {(a, b) : a ∈ A, b ∈ B}（有順序的 pair）');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { chip('(a' + (i + 1) + ',b' + (j + 1) + ')', FC.card, 1.4 + j * 1.6, 4.6 - i * 0.75, 1.4, 0.5); await wt(tok, 120); }
    cap('ordered pair：順序有關的一對', '前面在 A、後面在 B');
  },
  async (tok, S) => { S.B.add('|A × B| = |A| · |B|', 'good'); T('3 × 2 = 6', 'good', 2.2, 5.4, 0); cap('每個 a 配每個 b 都不同', '|A × B| = |A| × |B|'); },
  async (tok, S) => { S.B.add('高中學的大部分都用這兩個原理', 'say'); cap('後面的東西', '基本上都用這兩個原理算得出來'); },
], [[0, 4.4, 13.5], [0, 2.8, 0]]);

scene('ct-z9-four', '四種選法：有沒有順序 × 能不能重複', [
  async (tok, S) => {
    S.cell = (r, c, t, cl = 'say') => T(t, cl, 0.5 + c * 3.6, 4.0 - r * 1.3);
    T('可以重複', 'ptr', 0.5, 5.2); T('不能重複', 'ptr', 4.1, 5.2); T('有順序', 'ptr', -2.6, 4.0); T('沒順序', 'ptr', -2.6, 2.7);
    S.c1 = S.cell(0, 0, 'ordered, with repetition', 'note');
    cap('第一種：ordered selection with repetition', '');
  },
  async (tok, S) => { S.cell(1, 0, 'unordered, with repetition', 'idx'); S.cell(1, 1, 'unordered, without repetition', 'idx'); cap('ordered：順序有關', '後面還有 unordered：順序無關'); },
  async (tok, S) => { S.cell(0, 1, 'ordered, without repetition', 'idx'); cap('repetition：可以重複', '後面還有 without repetition'); },
  async (tok, S) => { T('2 × 2 = 4 種', 'good', 2.3, 1.4); cap('有沒有順序 × 能不能重複', '一共 4 種'); },
  async (tok, S) => { T('從 size n 的集合選 m 個', 'say', 2.3, 0.6); cap('從 n 個東西的集合', '拿 m 個出來'); },
  async (tok, S) => { cap('可以重複：第一次拿 1 號', '第二次還可以拿 1 號'); },
], [[0, 3.8, 12], [0.6, 3.0, 0]]);

scene('ct-z9-nm', '有順序、可重複：nᵐ', [
  async (tok, S) => { S.c = []; for (let k = 0; k < 4; k++) { ctx.tile(V3(-1.8 + k * 1.3, 0.04, 0.5), 1.1, 1.1); S.c.push(T('', 'ptr alt', -1.8 + k * 1.3, 1.4, 0.5)); T('第 ' + (k + 1) + ' 個', 'idx', -1.8 + k * 1.3, 0, 1.4); } txt(S.c[0], 'n 種'); cap('第一個東西有幾種？', '集合有 n 個 → n 種（示意 m = 4 個位置）'); },
  async (tok, S) => { for (let k = 1; k < 4; k++) { txt(S.c[k], 'n 種'); await wt(tok, 200); } cap('可以重複：第一個拿什麼不影響第二個', '第二個還是 n 種…第 m 個也是 n 種'); },
  async (tok, S) => { T('n × n × … × n = nᵐ', 'good', 0.2, 2.6, 0.5); cap('乘法原理：m 個 n 相乘', 'nᵐ'); },
], [[0, 4, 11], [0, 1.4, 0]]);

scene('ct-z9-funcs', '從 A 到 B 的函式有 nᵐ 個', [
  async (tok, S) => { S.A = setDots(['a₁', 'a₂', '…', 'aₘ'], -1.8, FC.blue, 0.4); S.Bd = setDots(['b₁', 'b₂', '…', 'bₙ'], 2.6, FC.green, 0.4); T('|A| = m', 'ptr', -1.8, 1.0, -2.0); T('|B| = n', 'ptr', 2.6, 1.0, -2.0); cap('|A| = m、|B| = n', 'F = 所有從 A 到 B 的函式'); },
  async (tok, S) => { for (let j = 0; j < 4; j++) { S.ar = arrow(S.A[0].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[j].position.clone().add(V3(-0.3, 0.1, 0)), 0xb9a684); await wt(tok, 150); } T('n 種', 'ptr alt', 0.4, 1.0, S.A[0].position.z); cap('a₁ 可以對到 b₁～bₙ', 'n 種'); },
  async (tok, S) => { for (let j = 0; j < 4; j++) arrow(S.A[1].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[j].position.clone().add(V3(-0.3, 0.1, 0)), 0xc9b48e); T('n 種', 'ptr alt', 0.4, 1.0, S.A[1].position.z); cap('a₂ 也是 n 種', '只是函式，誰都可以對'); },
  async (tok, S) => { T('|F| = n × n × … × n = nᵐ', 'good', 0.4, 2.4, 0); cap('一直到 aₘ 都是 n 種', '全部 nᵐ'); },
  async (tok, S) => { T('= 從 B 有順序、可重複地拿 m 個', 'say', 0.4, 3.0, 0); cap('跟上面是同一個問題', '每個有順序的選法對應一個函式'); },
], [[0, 6.0, 10], [0.4, 0.9, 0]]);

scene('ct-z9-power', '冪集合的大小：2ⁿ', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.6); S.B.add('|S| = n，求 |P(S)|'); cap('S 有 n 個元素', '它的 power set 有多大？'); },
  async (tok, S) => { S.B.add('P(S)：S 的所有子集合構成的集合'); cap('power set = 所有部分集合', '構成的集合'); },
  async (tok, S) => {
    S.el = ['a₁', 'a₂', 'a₃'].map((t, i) => { T(t, 'ptr', 0.6 + i * 1.4, 5.6); return T('在 / 不在', 'say', 0.6 + i * 1.4, 5.0); });
    cap('a₁ 要不要在子集合裡？', '可以在、可以不在（示意 n = 3）');
  },
  async (tok, S) => {
    let k = 0; for (let m = 0; m < 8; m++) { const sub = [0, 1, 2].filter((i) => m >> i & 1).map((i) => 'a' + '₁₂₃'[i]); T('{' + sub.join(',') + '}', 'note', 0.4 + (k % 4) * 1.6, 3.8 - Math.floor(k / 4) * 0.8); k++; await wt(tok, 120); }
    S.B.add('2 × 2 × … × 2 = 2ⁿ', 'good');
    cap('每個元素 2 種', '2 × 2 × 2 = 8 = 2³');
  },
  async (tok, S) => { S.B.add('每個元素在不在都選好 → 一個子集合', 'say'); cap('每個元素在不在都決定好', '就是一個不同的子集合'); },
], [[0, 4.2, 12.5], [0, 3.2, 0]]);

scene('ct-z9-norep', '有順序、不重複：n(n−1)…(n−m+1)', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.6); S.B.add('ordered selection without repetition'); cap('還是有順序', '但這次不能重複'); },
  async (tok, S) => { S.B.add('從 n 個裡拿 m 個，不能重複'); S.c = []; for (let k = 0; k < 4; k++) { ctx.tile(V3(-0.6 + k * 1.5, 0.04, 0.5), 1.2, 1.2); S.c.push(T('', 'ptr alt', -0.6 + k * 1.5, 1.4, 0.5)); } cap('n 個東西拿 m 個', '拿了就不能再拿'); },
  async (tok, S) => { txt(S.c[0], 'n'); cube('a₁', FC.blue, [0.8, 0.6, 0.8], -0.6, 0.3, 0.5, 2); cap('第一個：n 種都可能', '例如拿了 a₁'); },
  async (tok, S) => { txt(S.c[1], 'n − 1'); cube('a₃', FC.blue, [0.8, 0.6, 0.8], 0.9, 0.3, 0.5, 2); cap('第二個不能是 a₁', '剩 n − 1 種，例如 a₃'); },
  async (tok, S) => { txt(S.c[2], 'n − 2'); cap('第三個不能是 a₁、a₃', '剩 n − 2 種'); },
  async (tok, S) => { txt(S.c[3], 'n − m + 1'); T('第 m 個', 'idx', 3.9, 0, 1.4); cap('以此類推', '第 m 個是 n − (m − 1) = n − m + 1'); },
  async (tok, S) => { S.B.add('n(n − 1)(n − 2)…(n − m + 1)', 'good'); cap('乘法原理全部乘起來', 'n(n−1)…(n−m+1)'); },
  async (tok, S) => { S.B.add('差別：可重複每個都 n；不重複一個一個少', 'say'); cap('跟剛才的差別', '不能重複，所以一個一個變少'); },
], [[0, 4.2, 12.5], [0, 2.6, 0]]);

// 9B
scene('ct-z9-inj', '一對一函式的個數', [
  async (tok, S) => { S.A = setDots(['a₁', 'a₂', 'a₃'], -1.8, FC.blue, 0.4); S.Bd = setDots(['b₁', 'b₂', 'b₃', 'b₄'], 2.6, FC.green, 0.4); S.B = board(-6.6, 6.4, 0.55); S.B.add('|A| = m、|B| = n，一對一函式有幾個？'); cap('還是函式的例子', '這次要求 injective（一對一）'); },
  async (tok, S) => { S.B.add('a₁ 對到 b₁ → a₂ 就不能對 b₁'); cap('兩個對到同一個就不是一對一', '（示意 m = 3、n = 4）'); },
  async (tok, S) => { arrow(S.A[0].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[0].position.clone().add(V3(-0.3, 0.1, 0)), 0xd64545); glw(S.Bd[0], HL); T('n 種', 'ptr alt', 0.4, 1.0, S.A[0].position.z); cap('a₁：n 種都可以', ''); },
  async (tok, S) => { arrow(S.A[1].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[3].position.clone().add(V3(-0.3, 0.1, 0)), 0xd64545); glw(S.Bd[3], HL); T('n − 1 種', 'ptr alt', 0.4, 1.0, S.A[1].position.z); cap('a₂ 不能選 b₁', '剩 n − 1 種'); },
  async (tok, S) => { arrow(S.A[2].position.clone().add(V3(0.3, 0.1, 0)), S.Bd[1].position.clone().add(V3(-0.3, 0.1, 0)), 0xd64545); T('n − m + 1', 'ptr alt', 0.4, 1.0, S.A[2].position.z); S.B.add('n(n − 1)…(n − m + 1)', 'good'); cap('最後一個剩 n − m + 1 種', '示意 4 × 3 × 2 = ' + Pn(4, 3)); },
  async (tok, S) => { S.B.add('= ordered selection without repetition'); cap('跟「有順序、不重複」同一個問題', '選了就不能再選'); },
  async (tok, S) => { S.B.add('鴿籠原理：要 n ≥ m（最後一項 ≥ 1）', 'say'); cap('鴿籠原理告訴我們 n ≥ m', '才有一對一函式'); },
], [[0, 5.6, 11.5], [0.2, 1.4, 0]]);

scene('ct-z9-perm', 'permutation = 從 A 到 A 的 bijection', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('特例：permutation'); cap('一對一函式的特例', '叫 permutation（排列）'); },
  async (tok, S) => { S.B.add('A：非空有限集合'); cap('A 是不是空集合的有限集合', ''); },
  async (tok, S) => { S.B.add('permutation：A → A 的 bijection', 'good'); cap('從 A 對應到 A 的 bijection', 'domain 和 codomain 一樣'); },
  async (tok, S) => { S.B.add('兩邊一樣大：一對一 ⇔ onto'); cap('兩邊 size 一樣', '一對一就會 onto，onto 就會一對一'); },
  async (tok, S) => { S.B.add('通常取 A = {1, 2, …, n}'); cap('只跟 A 的 size 有關', '把 A 寫成 1 到 n'); },
  async (tok, S) => { S.top = [1, 2, 3, 4, 5].map((v, i) => chip(v, FC.card, 0.6 + i * 1.2, 4.6, 0.7, 0.5)); S.B.add('例：n = 5，α：A → A'); cap('例如 n = 5', '函式 α 從 A 到 A'); },
  async (tok, S) => { S.bot = [2, 4, 5, 1, 3].map((v, i) => chip(v, FC.blue, 0.6 + i * 1.2, 2.6, 0.7, 0.5, 1)); cap('α(1) = 2、α(2) = 4、α(3) = 5…', '每個都不一樣'); },
  async (tok, S) => { for (let i = 0; i < 5; i++) { arrow(V3(0.6 + i * 1.2, 4.25, 0), V3(0.6 + i * 1.2, 2.95, 0), 0x6e5f49); await wt(tok, 150); } cap('1 → 2、2 → 4、3 → 5、4 → 1、5 → 3', '上下兩列表示法'); },
  async (tok, S) => { cap('其實就是把 1 2 3 4 5 重排', '跟以前學的排列一樣'); },
], [[0, 4.4, 13], [0, 3.2, 0]]);

scene('ct-z9-group', '題外：permutation 與群', [
  async (tok, S) => { S.B = board(-6.6, 6.0, 0.62); S.B.add('數學系代數：group（群）'); cap('數學系的代數一開始教 group', '常用 permutation 當例子'); },
  async (tok, S) => { S.B.add('兩個 permutation 可以定義運算'); cap('兩個 permutation 之間', '可以定義一個運算'); },
  async (tok, S) => { S.B.add('封閉、結合、單位元素、反元素 → 群；不滿足交換律 → non-Abelian', 'say'); cap('滿足群的四個條件', '但不滿足交換律：non-Abelian group'); },
  async (tok, S) => { T('只寫下面那列：2 4 5 1 3', 'note', 1.6, 2.4); cap('有時只寫下面那一列', '上面固定是 1 2 3 4 5'); },
]);

scene('ct-z9-sn', 'Sₙ 有 n! 個元素', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.58); S.B.add('Sₙ = 所有 permutation 的集合'); cap('所有 permutation 的集合', '叫 Sₙ'); },
  async (tok, S) => { S.B.add('叫 symmetric group（對稱群）'); cap('Sₙ 是一個群', 'symmetric group'); },
  async (tok, S) => { S.c = []; for (let k = 0; k < 5; k++) { ctx.tile(V3(0.4 + k * 1.3, 0.04, 0.5), 1.1, 1.1); S.c.push(T(['n', 'n−1', 'n−2', '…', '1'][k], 'ptr alt', 0.4 + k * 1.3, 1.3, 0.5)); await wt(tok, 150); } cap('第一個 n 種、第二個 n − 1 種…', '最後剩 1 種'); },
  async (tok, S) => { S.B.add('|Sₙ| = n(n − 1)…1 = n!', 'good'); cap('n factorial', '中文叫「階乘」'); },
  async (tok, S) => { S.B.add('遞迴定義：n! = n · (n − 1)!（n ≥ 1）'); cap('n! 的定義是遞迴的', 'n! = n × (n−1)!'); },
  async (tok, S) => { S.B.add('初始條件：0! = 1', 'good'); cap('initial condition', '定義 0! = 1'); },
  async (tok, S) => { for (let k = 0; k <= 5; k++) { T(k + '! = ' + fact(k), 'say', 1.6 + (k % 3) * 1.9, 3.6 - Math.floor(k / 3) * 0.7); await wt(tok, 120); } cap('1! = 1 × 0! = 1、2! = 2 × 1! = 2…', '數學歸納一下：n! = n × … × 1'); },
  async (tok, S) => { S.B.add('n 必須是 ≥ 0 的整數（沒有 (−1)!）', 'say'); cap('n 必須是非負整數', '沒有負的階乘'); },
], [[0, 4.4, 13], [0, 3.0, 0]]);

scene('ct-z9-line10', '10 人排一列；P2、P6、P9 要相鄰', [
  async (tok, S) => { S.p = []; for (let i = 0; i < 10; i++) S.p.push(cube('P' + (i + 1), [2, 6, 9].includes(i + 1) ? FC.pink : FC.blue, [0.62, 0.62, 0.62], -2.7 + i * 0.75, 0.31, 2.2)); S.B = board(-6.6, 6.4, 0.55); S.B.add('10 個人：P1～P10'); cap('應用題：10 個人 P1～P10', ''); },
  async (tok, S) => { S.B.add('排成一列，有幾種？'); cap('In how many ways can the 10 people', 'be lined up in a row?'); },
  async (tok, S) => { for (let k = 0; k < 4; k++) { T(String(10 - k), 'ptr alt', -2.7 + k * 0.75, 1.1, 2.2); await wt(tok, 150); } cap('第一個位置 10 種、第二個 9 種…', '最後 1 種'); },
  async (tok, S) => { S.B.add('10! = ' + fmt(fact(10)), 'good'); cap('10 個人的排列', '10! = 3,628,800'); },
  async (tok, S) => { S.B.add('factorial 成長得非常快', 'say'); cap('n! 比 n 成長快非常多', '才 10 就三百多萬'); },
  async (tok, S) => { S.B.add('限制：P2、P6、P9 要站在一起'); cap('P2、P6、P9 希望站在一起', ''); },
  async (tok, S) => { cap('這三個人是閨蜜', '剛才的 362 萬種裡，並不都站一起'); },
  async (tok, S) => {
    S.p.forEach((m) => kill(m)); S.G = cube('G', FC.pink, [1.5, 0.62, 0.62], -2.3, 0.31, 2.2);
    S.o = [1, 3, 4, 5, 7, 8, 10].map((v, i) => cube('P' + v, FC.blue, [0.62, 0.62, 0.62], -1.0 + i * 0.75, 0.31, 2.2));
    S.B.add('先把三人看成一個 G = {P2, P6, P9}');
    cap('先把三個人綁成一個 G', '');
  },
  async (tok, S) => { S.B.add('剩 7 人 + G = 8 個單位'); cap('剩下 7 個人加上 G', '一共 8 個'); },
  async (tok, S) => { S.B.add('8 個排列：8!'); cap('8 個單位的排列', '8!'); },
  async (tok, S) => { const ord = [0, 1, 2, 3, 4, 5, 6]; S.o.forEach((m, i) => move(m, -2.0 + (i + 1) * 0.75 + (i >= 0 ? 0.2 : 0), 0.31, 2.2)); move(S.G, -2.6, 0.31, 2.2); cap('例如 P1 G P3 P4 P5 P7 P8 P10', ''); },
  async (tok, S) => { ['P2', 'P6', 'P9'].forEach((t, i) => chip(t, FC.pink, -3.3 + i * 0.65, 1.2, 0.55, 0.45, 1.5, 2.2)); S.B.add('G 裡面還可以排：3!'); cap('G 裡面三個人還能自己排', '3!'); },
  async (tok, S) => { S.B.add('8! × 3! = ' + fmt(fact(8) * fact(3)), 'good'); cap('兩個數目乘起來', '8! × 3! = 241,920'); },
  async (tok, S) => { cap('只有 24 萬多', '這些都只用到乘法原理'); },
], [[0, 4.4, 13], [0, 2.6, 0]]);

scene('ct-z9-unord', '接下來：沒有順序的選法', [
  async (tok, S) => { T('ordered with repetition ✓', 'good', 1.0, 4.4); T('ordered without repetition ✓', 'good', 1.0, 3.7); cap('有順序的兩種都講完了', ''); },
  async (tok, S) => { T('unordered without repetition', 'note', 1.0, 3.0); cap('再來：unordered selection', 'without repetition'); },
  async (tok, S) => { T('unordered with repetition', 'say', 1.0, 2.3); cap('最後：unordered with repetition', ''); },
], [[0, 4, 12], [0.6, 3.0, 0]]);

// 9C
scene('ct-z9-binom', 'binomial coefficient 的定義', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('unordered selection：順序無關'); cap('跟前面差別：順序無關', 'unordered selection'); },
  async (tok, S) => { S.B.add('從 n 個拿 m 個，不能重複，順序無關'); cap('從 n 個東西拿 m 個', '不能重複、順序無關'); },
  async (tok, S) => { T('1 2 3 4', 'note', 2.0, 5.6); T('2 1 3 4', 'note', 4.4, 5.6); T('算同一個', 'say', 3.2, 4.9); cap('先拿 1、2、3、4 跟先拿 2、1、3、4', '只算一個'); },
  async (tok, S) => { S.B.add('先當 ordered：n(n−1)…(n−m+1)'); cap('先當作順序有關', 'n(n − 1)…(n − m + 1)'); },
  async (tok, S) => { S.B.add('同一組的不同順序有 m! 種'); cap('拿出來的 m 個東西', '排列有 m! 種'); },
  async (tok, S) => { S.B.add('每 m! 個只算一個 → 除以 m!', 'good'); cap('每這麼多個只能算一個', '所以除掉 m!'); },
  async (tok, S) => { S.B.add('定義 (n m) = n(n−1)…(n−m+1) / m!'); T('(n m)：binomial coefficient', 'note', 3.0, 3.6); cap('這個符號叫 binomial coefficient', '二項式係數'); },
  async (tok, S) => { S.B.add('組合數：n、m 正整數，n ≥ m'); cap('當作組合數時', 'n、m 都是正整數'); },
  async (tok, S) => { S.B.add('但定義本身不要求 n ≥ m'); cap('這個定義並沒要求大小順序', '後面會看到好處'); },
  async (tok, S) => { S.B.add('之後推廣：n 可以是負數、實數', 'say'); cap('之後推廣：extended binomial coefficient', 'n 可以是負整數、甚至實數'); },
  async (tok, S) => { S.B.add('念法：n 取 m', 'say'); cap('通常唸成「n 取 m」', '不用高中的 C 符號'); },
], [[0, 4.4, 13.5], [0, 3.4, 0]]);

scene('ct-z9-sub8', '8 個元素的集合：3、5、9 元素子集合', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.el = []; for (let i = 0; i < 8; i++) S.el.push(ball(String(i + 1), FC.blue, 0.3, 0.4 + (i % 4) * 1.0, 0.32, -1.4 + Math.floor(i / 4) * 1.0)); S.B.add('|A| = 8'); cap('A 有 8 個元素', '換成其他數目道理一樣'); },
  async (tok, S) => { S.B.add('A 有幾個 3-element subset？'); cap('3-element subset', '有 3 個元素的子集合'); },
  async (tok, S) => { [0, 1, 2].forEach((i) => tint(S.el[i], FC.pink)); T('{1,2,3} = {2,1,3}', 'say', 5.4, 1.4); cap('集合裡沒有順序', '{1,2,3} 和 {2,1,3} 一樣'); },
  async (tok, S) => { S.B.add('(8 3) = 8·7·6 / 3! = ' + Cb(8, 3), 'good'); cap('8 取 3', '8 × 7 × 6 ÷ (3 × 2 × 1) = 56'); },
  async (tok, S) => { [0, 1, 2].forEach((i) => tint(S.el[i], FC.blue)); [3, 4, 5, 6, 7].forEach((i) => tint(S.el[i], FC.green)); S.B.add('5-element subset：(8 5) = ' + Cb(8, 5)); cap('把 3 換成 5', '8 取 5 也是 56'); },
  async (tok, S) => { S.B.add('拿 3 個 = 不拿 5 個 → 一樣多'); cap('為什麼一樣？', '選要的 3 個 = 選不要的 5 個'); },
  async (tok, S) => { S.B.add('9-element subset？'); cap('再把 5 換成 9', 'A 只有 8 個元素'); },
  async (tok, S) => { S.B.add('(8 9) = 8·7·6·5·4·3·2·1·0 / 9! = 0', 'good'); cap('照定義代：分子有 9 項', '最後一項是 0'); },
  async (tok, S) => { cap('下面比上面大', '分子一定有 0，答案自動是 0'); },
  async (tok, S) => { S.B.add('一般：n < r ⇒ (n r) = 0'); cap('In general', 'n < r 時 n 取 r = 0'); },
  async (tok, S) => { S.B.add('若定義成 n!/((n−m)!m!)，會出現負數階乘（沒定義）', 'say'); cap('用階乘式定義的話', '會出現負數的 factorial，沒有定義'); },
], [[0, 4.4, 13.5], [0, 2.8, 0]]);

scene('ct-z9-pid', 'Pascal identity 的組合式證明', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.55); S.B.add('Pascal identity：(n r) = (n−1 r−1) + (n−1 r)'); cap('binomial coefficient 的性質', 'Pascal identity'); },
  async (tok, S) => { S.B.add('可以畫出 Pascal triangle'); cap('用它可以畫出巴斯卡三角形', ''); },
  async (tok, S) => { S.B.add('證法一：代定義、整理', 'say'); cap('一種證法：把定義帶進去', '右邊加一加整理'); },
  async (tok, S) => { S.B.add('證法二：combinatorial argument'); cap('另一種：combinatorial argument', '組合的方式來講'); },
  async (tok, S) => { S.el = []; for (let i = 0; i < 6; i++) S.el.push(ball(i === 5 ? 'n' : String(i + 1), i === 5 ? FC.gold : FC.blue, 0.3, 0.6 + i * 1.0, 0.32, 0.6)); S.B.add('左邊：{1, …, n} 的 r-subset 個數'); cap('左邊：n 個元素的集合', '有 r 個元素的子集合個數（示意 n = 6）'); },
  async (tok, S) => { glw(S.el[5], HL); S.B.add('分兩種：含 n、不含 n'); cap('看某一個固定的元素 n', ''); },
  async (tok, S) => { S.B.add('含 n：剩 n − 1 個選 r − 1 → (n−1 r−1)', 'good'); cap('子集合裡有 n', '剩 n − 1 個選 r − 1 個'); },
  async (tok, S) => { glw(S.el[5], NG); S.B.add('不含 n：從 n − 1 個選 r → (n−1 r)', 'good'); cap('子集合裡沒有 n', '從 1～n−1 選 r 個'); },
  async (tok, S) => { S.B.add('兩種 disjoint → 加法原理'); cap('不是有 n 就是沒有 n', '交集是空集合：相加'); },
  async (tok, S) => { S.B.add('不要硬背，想一想就知道', 'say'); cap('不要印記硬背', '知道道理，忘了就想一想'); },
  async (tok, S) => { S.B.add('左右兩邊數同一個東西，數法不同 → 相等', 'note'); cap('combinatorial proof', '兩種方法數同一個東西'); },
], [[0, 4.4, 13.5], [0, 2.8, 0]]);

scene('ct-z9-ptri', 'Pascal triangle', [
  async (tok, S) => { S.lb = []; const put = (n, k) => S.lb.push(T('(' + n + ' ' + k + ')', 'say', (k - n / 2) * 1.3, 6.4 - n * 0.9)); put(0, 0); put(1, 0); put(1, 1); cap('第 0 層：0 取 0', '第 1 層：1 取 0、1 取 1'); },
  async (tok, S) => { for (let n = 2; n <= 4; n++) for (let k = 0; k <= n; k++) S.lb.push(T('(' + n + ' ' + k + ')', 'say', (k - n / 2) * 1.3, 6.4 - n * 0.9)); cap('2 取 0、2 取 1、2 取 2…', '一直到 4 取 4'); },
  async (tok, S) => { cap('n = 0、1、2、3、4…', '一層一層排在間隔上'); },
  async (tok, S) => { T('2 取 1 = 1 取 0 + 1 取 1', 'note', 3.6, 2.2); cap('每一格 = 上面兩格相加', 'Pascal identity'); },
  async (tok, S) => { S.lb.forEach(remove); S.v = []; for (let n = 0; n <= 4; n++) for (let k = 0; k <= n; k++) S.v.push(T(String(Cb(n, k)), (k === 0 || k === n) ? 'ptr' : 'ptr alt', (k - n / 2) * 1.3, 6.4 - n * 0.9)); cap('最左、最右都是 1', 'n 取 0 = n 取 n = 1'); },
  async (tok, S) => { cap('1 1 → 1 2 1 → 1 3 3 1 → 1 4 6 4 1', '上面兩個加起來'); },
  async (tok, S) => { for (let k = 0; k <= 5; k++) T(String(Cb(5, k)), (k === 0 || k === 5) ? 'ptr' : 'ptr alt', (k - 2.5) * 1.3, 6.4 - 5 * 0.9); cap('再一層：1 5 10 10 5 1', '這就是 Pascal triangle'); },
], [[0, 4.4, 12], [0, 3.6, 0]]);

// 9D
scene('ct-z9-sym', '(n r) = (n n−r)', [
  async (tok, S) => { S.B = board(-6.6, 6.0, 0.62); S.B.add('r ≤ n：(n r) = (n n−r)'); S.el = []; for (let i = 0; i < 8; i++) S.el.push(ball('', i < 3 ? FC.pink : FC.blue, 0.3, 0.6 + i * 0.8, 0.32, 0.6)); cap('n 取 r = n 取 n − r', '（示意 n = 8、r = 3）'); },
  async (tok, S) => { S.B.add('r 要 ≥ 0 的整數，所以 n ≥ r'); cap('下面這個必須是 ≥ 0 的整數', '才能寫'); },
  async (tok, S) => { T('拿要的 3 個', 'say', 1.4, 1.2, 0.6); T('= 拿不要的 5 個', 'say', 4.6, 1.2, 0.6); cap('拿 r 個要的', '和拿 n − r 個不要的，數目一樣'); },
], [[0, 4, 12], [0, 2.4, 0]]);

scene('ct-z9-thm', '二項式定理：係數為什麼是 (n r)', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('binomial theorem：展開 (x + y)ⁿ'); cap('binomial theorem', '把 (x + y)ⁿ 展開'); },
  async (tok, S) => { S.B.add('typical term：□ xⁿ⁻ʳ yʳ'); cap('一般項長這樣', '前面還有一個係數'); },
  async (tok, S) => { S.br = [0, 1, 2, 3, 4].map((i) => T('(x + y)', 'say', 0.4 + i * 1.5, 5.4)); cap('(x + y)ⁿ = (x + y)(x + y)…', 'n 個相乘（示意 n = 5）'); },
  async (tok, S) => { cap('乘開：每個括號挑一項', '乘起來，再把所有可能加起來'); },
  async (tok, S) => { S.pk = 'xyxxy'.split('').map((c, i) => chip(c, c === 'x' ? FC.blue : FC.green, 0.4 + i * 1.5, 4.5, 0.6, 0.55, 1)); T('→ x³y²', 'note', 3.4, 3.7); cap('挑 x、y、x、x、y', '乘出來 x³y²'); },
  async (tok, S) => { cap('這一種挑法的係數是 1', '貢獻 1 到 x³y² 的係數'); },
  async (tok, S) => { S.B.add('有 r 個括號挑 y、n − r 個挑 x → xⁿ⁻ʳyʳ'); cap('n 個裡有 r 個挑 y', '其他 n − r 個挑 x'); },
  async (tok, S) => { S.B.add('次數相加一定是 n'); cap('(n − r) + r = n', '每個括號都挑一個'); },
  async (tok, S) => { S.B.add('r = 0, 1, …, n'); cap('r 從 0 到 n', '沒有 y、一個 y、…全部 y'); },
  async (tok, S) => { cap('有多少種挑法會得到 x³y²？', '那就是係數'); },
  async (tok, S) => { S.pk.forEach(kill); S.pk = 'yyxxx'.split('').map((c, i) => chip(c, c === 'x' ? FC.blue : FC.green, 0.4 + i * 1.5, 4.5, 0.6, 0.55, 1)); T('5 個位置挑 2 個放 y：(5 2) = ' + Cb(5, 2), 'good', 3.4, 3.0); cap('也可以兩個 y 在前面…', '5 個位置挑 2 個放 y：5 取 2'); },
  async (tok, S) => { S.B.add('係數 = (n r)：(x + y)ⁿ = Σ (n r) xⁿ⁻ʳ yʳ', 'good'); cap('一般：n 個裡挑 r 個放 y', '係數就是 n 取 r'); },
  async (tok, S) => { S.B.add('不要背：想一想就知道', 'say'); cap('不要背公式套題型', '瞭解了根本不用背'); },
], [[0, 4.4, 13.5], [0, 3.4, 0]]);

scene('ct-z9-sum', 'Σ (n r) = 2ⁿ', [
  async (tok, S) => { S.B = board(-6.6, 6.2, 0.6); S.B.add('(n 0) + (n 1) + … + (n n) = 2ⁿ'); cap('證明這個等式', ''); },
  async (tok, S) => { S.B.add('用 binomial theorem：對任何 x、y 都成立'); cap('用二項式定理證', '對任何 x、y 都成立，可以代特別的值'); },
  async (tok, S) => { S.B.add('令 x = y = 1'); cap('想辦法把 x、y 弄掉', 'x、y 都代 1'); },
  async (tok, S) => { S.B.add('(1 + 1)ⁿ = 2ⁿ = Σ (n r)', 'good'); cap('左邊 2ⁿ', '右邊 1 的幾次方都是 1'); },
  async (tok, S) => { S.B.add('組合解釋：所有子集合的個數', 'note'); cap('combinatorial argument', '左邊是 size n 的集合的子集合總數'); },
  async (tok, S) => { for (let r = 0; r <= 4; r++) T('(4 ' + r + ') = ' + Cb(4, r), 'say', 2.4, 4.6 - r * 0.6); T('合計 16 = 2⁴', 'good', 2.4, 1.4); cap('0 個元素、1 個、…、n 個的子集合', '分開算加起來（示意 n = 4）'); },
  async (tok, S) => { S.B.add('展開 (x+y)ⁿ 不合併：2ⁿ 項', 'say'); cap('從展開來看', '不合併同類項，一共 2ⁿ 項'); },
]);

scene('ct-z9-sq', 'Σ (n r)² = (2n n)', [
  async (tok, S) => { S.B = board(-6.6, 6.6, 0.55); S.B.add('(n 0)² + (n 1)² + … + (n n)² = (2n n)'); cap('這次先平方再加', '等於 2n 取 n'); },
  async (tok, S) => { S.B.add('看 (1 + x)²ⁿ'); cap('因為有 2n', '看 (1 + x) 的 2n 次方'); },
  async (tok, S) => { S.B.add('(1 + x)ⁿ · (1 + x)ⁿ = (1 + x)²ⁿ'); cap('(1+x)ⁿ 乘 (1+x)ⁿ', '= (1+x)²ⁿ'); },
  async (tok, S) => { S.B.add('右邊 xⁿ 的係數 = (2n n)', 'good'); cap('右邊：xⁿ 的係數', '2n 取 n'); },
  async (tok, S) => { S.B.add('左邊 xⁿ 的係數 = ?'); cap('左邊乘開，xⁿ 的係數是多少？', ''); },
  async (tok, S) => { S.r1 = [0, 1, 2, 3].map((k) => T('(3 ' + k + ')x' + ['⁰', '¹', '²', '³'][k], 'say', 1.4 + k * 1.5, 3.6)); S.r2 = [0, 1, 2, 3].map((k) => T('(3 ' + k + ')x' + ['⁰', '¹', '²', '³'][k], 'say', 1.4 + k * 1.5, 2.4)); T('示意 n = 3', 'idx', 3.6, 4.3); cap('展開：(n 0) + (n 1)x + … + (n n)xⁿ', '兩個一樣的東西相乘'); },
  async (tok, S) => { S.ln = [arrow(V3(1.4, 3.35, 0), V3(1.4 + 3 * 1.5, 2.65, 0), 0xd64545)]; cap('常數項配 xⁿ 項', '(n 0)(n n)'); },
  async (tok, S) => { S.ln.push(arrow(V3(2.9, 3.35, 0), V3(1.4 + 2 * 1.5, 2.65, 0), 0xd64545)); cap('一次項配 n − 1 次項', '(n 1)(n n−1)…依此類推'); },
  async (tok, S) => { S.B.add('= Σ (n r)(n n−r)'); cap('左邊 xⁿ 係數', '= Σ (n r)(n n−r)'); },
  async (tok, S) => { S.B.add('(n r) = (n n−r) → Σ (n r)²', 'good'); cap('n 取 r = n 取 n − r', '就變成平方和'); },
  async (tok, S) => { T('示意：1² + 3² + 3² + 1² = 20 = (6 3)', 'good', 3.6, 1.4); cap('檢查 n = 3', '1 + 9 + 9 + 1 = 20 = 6 取 3'); },
  async (tok, S) => { S.B.add('兩邊的 xⁿ 係數相等 ⇒ 等式成立', 'good'); cap('左右兩邊是同一個多項式', '每一項係數都一樣，xⁿ 也一樣'); },
  async (tok, S) => { S.B.add('同一個東西用兩種方法看', 'note'); cap('這種證明常常是', '同一個量用兩種方法看'); },
], [[0, 4.4, 13.5], [0, 3.4, 0]]);

scene('ct-z9-alt', '加減交錯：Σ (−1)ʳ (n r) = 0', [
  async (tok, S) => { S.B = board(-6.6, 6.4, 0.6); S.B.add('(n 0) − (n 1) + (n 2) − … + (−1)ⁿ (n n)'); cap('這次加減交錯', '加、減、加、減…'); },
  async (tok, S) => { S.B.add('一般項：(−1)ʳ (n r)'); cap('偶數項是正、奇數項是負', '用 (−1)ʳ 表示'); },
  async (tok, S) => { T('1 − 4 + 6 − 4 + 1 = ' + [0, 1, 2, 3, 4].reduce((a, k) => a + (k % 2 ? -1 : 1) * Cb(4, k), 0), 'note', 2.6, 4.4); cap('例如 1 4 6 4 1', '加減交錯是 0'); },
  async (tok, S) => { T('1 − 5 + 10 − 10 + 5 − 1 = ' + [0, 1, 2, 3, 4, 5].reduce((a, k) => a + (k % 2 ? -1 : 1) * Cb(5, k), 0), 'note', 2.6, 3.6); T('（直接相加是 2ⁿ）', 'idx', 2.6, 2.9); cap('1 5 10 10 5 1 也是 0', '永遠是 0'); },
  async (tok, S) => { S.B.add('binomial theorem：x = 1、y = −1'); cap('也用二項式定理', 'x 代 1、y 代 −1'); },
  async (tok, S) => { S.B.add('(1 − 1)ⁿ = 0 = Σ (−1)ʳ (n r)', 'good'); cap('左邊 (1 − 1)ⁿ = 0', '右邊剛好是要證的式子'); },
  async (tok, S) => { S.B.add('相關恆等式還有很多', 'say'); cap('這三個都用二項式定理', '這種恆等式還有很多'); },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '離散數學・第 5 章',
    title: '計數原理：排列、組合、鴿籠原理',
    color: 'var(--dm)',
    modes: [
      { id: 'tree', name: '乘法／加法原理', enter: enterTree },
      { id: 'pick', name: '排列 vs 組合', enter: enterPick },
      { id: 'stars', name: '星棒法', enter: enterStars },
      { id: 'pascal', name: '巴斯卡三角形', enter: enterPascal },
      { id: 'pigeon', name: '鴿籠原理', enter: enterPigeon },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'product-rule-tree', 'sum-rule-piles',
      'perm-tales', 'perm-barbaric', 'perm-vs-comb', 'lattice-44', 'lattice-general',
      'choose-7-of-10', 'choose-first-two', 'choose-at-least-4',
      'stars-bars-12', 'stars-lower-bound', 'stars-balls-boxes', 'stars-odd-x4',
      'binomial-pascal',
      'pigeon-basic', 'pigeon-general', 'pigeon-friends', 'pigeon-birthday', 'pigeon-sum21', 'pigeon-grid17',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
