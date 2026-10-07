// 離散數學 第5章：計數原理（加法／乘法原理、排列 P(n,r)、組合 C(n,r)、重複組合（星棒法）、二項式定理、鴿籠原理）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 影片場景依照：
//   DBugSTeX1zw〈PERMUTATIONS and COMBINATIONS Review〉（TrevTutor）：TALES、BARBARIC、格子路徑 (0,0)→(4,4)、
//     10 題選 7 題的三種限制、x1+x2+x3 = 12、xi ≥ 2、8 顆球放 4 個箱子、x4 必須是奇數。
//   2-mxYrCNX60〈Pigeonhole Principle〉（TrevTutor）：4 隻鴿子 3 個籠子、⌈m/n⌉、朋友數相同、366 人生日、
//     1..20 選 11 個必有兩數和為 21、8×8 方格 17 點。
// 加法／乘法原理樹、P 與 C 的關係、二項式定理與巴斯卡三角形：依 Rosen 第 6 章補的課本場景。
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
    ],
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
