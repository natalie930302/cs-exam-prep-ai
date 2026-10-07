// 離散數學 第6章：進階計數（排容原理、錯排、映成函數與 Stirling 數、物品放箱子四種情況、生成函數、整數分割、Catalan 數、Burnside／Pólya）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec16–19、趙啟超 第10–11、14–17講、Inclusion-Exclusion）目前都沒有逐字稿，
// 所以場景全部依課本（Rosen 第 6、8 章；Grimaldi 第 8–10 章）的經典例題：
//   1..100 中 2、3、5 的倍數（74）、x1+x2+x3 = 11 有上限（6 組）、帽子錯排 D4 = 9、6 → 3 的映成函數 540、
//   S(4,2) = 7、e1+e2+e3 = 17 的生成函數係數（3）、8 塊餅乾分給 3 個小孩各 2～4 塊（6）、p(5) = 7、C3 = 5、
//   4 顆珠子 2 色項鍊（6）。
// 記號：S(n,k) 第二類 Stirling 數；H(n,r) = C(n+r−1, r)（n 種東西可重複取 r 個）；onto(m,n) = n!·S(m,n)。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  let mtok = 0, busy = false;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  const Cb = (n, r) => { if (r < 0 || r > n || n < 0) return 0; let x = 1; for (let i = 1; i <= r; i++) x = x * (n - r + i) / i; return Math.round(x); };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => a / gcd(a, b) * b;
  const Der = (n) => { let a = 1, b = 0; if (n === 0) return 1; for (let i = 2; i <= n; i++) { const c = (i - 1) * (a + b); a = b; b = c; } return b; };
  const S2 = (n, k) => { const T = Array.from({ length: n + 1 }, () => Array(k + 1).fill(0)); T[0][0] = 1; for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, k); j++) T[i][j] = T[i - 1][j - 1] + j * T[i - 1][j]; return T[n][k]; };
  const pk = (n, k) => { if (n === 0 && k === 0) return 1; if (n <= 0 || k <= 0) return 0; return pk(n - 1, k - 1) + pk(n - k, k); }; // partitions of n into exactly k parts
  const pAll = (n) => { let s = 0; for (let k = 1; k <= n; k++) s += pk(n, k); return n === 0 ? 1 : s; };
  const catalan = (n) => Cb(2 * n, n) / (n + 1);
  const COL = { ball: '#4b9ee2', pick: '#e55a9b', gold: '#c08a1f', gray: '#d8cfc0', green: '#2fc092', red: '#d64545', purple: '#9b7ef4', orange: '#dd8238', teal: '#31aab0', ink: '#6e5f49' };
  const PAL = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a'];
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((d) => SUP[d]).join('');

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
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    m.castShadow = true;
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); } else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { const mat = m.userData.mat || m.material; if (mat) mat.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { const mat = m.userData.mat || m.material; if (mat) mat.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  function line(x1, y1, z1, x2, y2, z2, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  function rod(a, b, color, r = 0.07) {
    const n = b.clone().sub(a); const L = n.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.position.copy(a).addScaledVector(n, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), n.normalize());
    m.castShadow = true; lab.world.add(m); return m;
  }
  function disc(x, z, r, color, y = 0.02) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 64), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }));
    m.position.set(x, y, z); lab.world.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 80), new THREE.MeshStandardMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.03, z); lab.world.add(ring);
    return m;
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
  const slotIn = (cx, cz, k, s = 0.25, dy = 0.34, y0 = 0.2) => V3(cx + (k % 2 ? s : -s), y0 + Math.floor(k / 4) * dy, cz + (Math.floor(k / 2) % 2 ? s : -s));
  async function tween(w, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); await w(ms / steps); } }
  async function wait(my, ms) { await sleep(ms); if (my !== mtok) throw new Error('stale'); }
  function guard(fn) {
    return async (...a) => {
      if (busy) { log('上一個動畫還在跑，等它跑完再按。', true); return; }
      busy = true; const my = mtok;
      try { await fn((ms) => wait(my, ms), ...a); } catch (e) { if (e.message !== 'stale') console.error(e); } finally { if (my === mtok) busy = false; }
    };
  }
  // bars on the xy plane: one bar per exponent, height ∝ coefficient
  function bars(coef, x0, sp, hMax, color, yBase = 0, z = 0) {
    const mx = Math.max(1, ...coef);
    return coef.map((c, i) => {
      const h = Math.max(0.02, c / mx * hMax);
      const m = lab.box(color, [sp * 0.7, 1, 0.5]); m.scale.y = h; m.position.set(x0 + i * sp, yBase + h / 2, z); lab.world.add(m);
      m.userData.lbl = lab.label(c ? String(c) : '', 'idx'); m.userData.lbl.position.set(0, 0.5 + 0.25 / h, 0); m.add(m.userData.lbl);
      return m;
    });
  }
  const polyMul = (a, b, cap) => { const r = Array(Math.min(a.length + b.length - 1, cap + 1)).fill(0); a.forEach((x, i) => b.forEach((y, j) => { if (i + j <= cap) r[i + j] += x * y; })); return r; };

  // ───────────────────────── 排容原理：Venn ─────────────────────────
  // 1..N 中 d₀、d₁、d₂ 的倍數；每顆方塊是一個數，顏色 = 目前被算了幾次
  const vn = { N: 100, d: [2, 3, 5], cubes: [], step: 0, times: {}, sum: 0, regLbl: {} };
  const V3C = [[-1.5, -0.8], [1.5, -0.8], [0, 1.6]], V2C = [[-1.4, 0], [1.4, 0]];
  const ANCH3 = { 1: [-3.0, -1.7], 2: [3.0, -1.7], 4: [0, 3.4], 3: [0, -2.15], 5: [-1.75, 1.15], 6: [1.75, 1.15], 7: [0, 0.05], 0: [-5.6, 2.8] };
  const ANCH2 = { 1: [-2.6, 0], 2: [2.6, 0], 3: [0, 0], 0: [-5.6, 2.6] };
  const TIMES_COL = ['#cdbfa6', '#2fc092', '#dd8238', '#d64545'];
  function vnTerms(k) {
    const nm = ['A', 'B', 'C'];
    const all = [];
    for (let mask = 1; mask < (1 << k); mask++) all.push(mask);
    all.sort((a, b) => bits(a) - bits(b) || a - b);
    return all.map((m) => ({ mask: m, sign: bits(m) % 2 ? 1 : -1, name: nm.filter((_, i) => m & (1 << i)).join('∩') }));
  }
  const bits = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
  const maskOf = (v, d) => d.reduce((s, x, i) => s | (v % x === 0 ? 1 << i : 0), 0);
  function vnBuild(N, d) {
    vn.N = N; vn.d = d; vn.cubes = []; vn.step = 0; vn.sum = 0; vn.times = {}; vn.regLbl = {};
    const k = d.length, C = k === 3 ? V3C : V2C, A = k === 3 ? ANCH3 : ANCH2, R = k === 3 ? 2.9 : 2.5;
    C.forEach(([x, z], i) => { disc(x, z, R, PAL[i], 0.02 + i * 0.005); tag(['A', 'B', 'C'][i] + '：' + d[i] + ' 的倍數', 'ptr', i === 2 ? x + 2.7 : x + (i ? 1.6 : -1.6), 0.1, i === 2 ? z + 2.2 : z - R - 0.25); });
    const groups = {};
    for (let v = 1; v <= N; v++) { const m = maskOf(v, d); (groups[m] = groups[m] || []).push(v); }
    for (const m of Object.keys(A).map(Number)) {
      const list = groups[m] || [];
      const cols = Math.max(1, Math.ceil(Math.sqrt(list.length))), sp = 0.34;
      list.forEach((v, i) => {
        const [ax, az] = A[m];
        const x = ax + (i % cols - (cols - 1) / 2) * sp, z = az + (Math.floor(i / cols) - (Math.ceil(list.length / cols) - 1) / 2) * sp;
        const c = cube(N <= 40 ? v : '', TIMES_COL[0], [0.27, 0.22, 0.27], x, 0.13, z);
        if (N <= 40) { c.userData.lbl.element.style.fontSize = '10px'; c.userData.lbl.element.style.padding = '0 2px'; }
        c.userData.mask = m; vn.cubes.push(c);
      });
      vn.times[m] = 0;
      const [ax, az] = A[m];
      vn.regLbl[m] = tag(m ? '' : '都不是：' + list.length, m ? 'ptr alt' : 'idx', ax, 0.9, az - (m === 0 ? 1.4 : 0));
      if (m) vn.regLbl[m].element.style.visibility = 'hidden';
    }
    vn.terms = vnTerms(k);
  }
  const vnSetSize = (mask) => { let l = 1; vn.d.forEach((x, i) => { if (mask & (1 << i)) l = lcm(l, x); }); return Math.floor(vn.N / l); };
  function vnStep() {
    const t = vn.terms[vn.step];
    if (!t) return null;
    vn.step++;
    const size = vnSetSize(t.mask);
    vn.sum += t.sign * size;
    for (const m of Object.keys(vn.times).map(Number)) if (m && (m & t.mask) === t.mask) vn.times[m] += t.sign;
    vn.cubes.forEach((c) => {
      const inT = (c.userData.mask & t.mask) === t.mask;
      const tm = vn.times[c.userData.mask] || 0;
      tint(c, c.userData.mask ? TIMES_COL[Math.max(0, Math.min(3, tm))] : TIMES_COL[0]);
      glow(c, inT ? (t.sign > 0 ? GREEN : RED) : null);
      c.position.y = inT ? 0.45 : 0.13;
    });
    for (const m of Object.keys(vn.regLbl).map(Number)) if (m) { const l = vn.regLbl[m]; l.element.style.visibility = ''; txt(l, '算 ' + vn.times[m] + ' 次'); }
    const lc = vn.d.length === 3 ? (t.mask === 7 ? lcm(lcm(vn.d[0], vn.d[1]), vn.d[2]) : null) : null;
    return { t, size, lc };
  }
  function vnState() {
    const rows = vn.terms.map((t, i) => [(t.sign > 0 ? '+ ' : '− ') + '|' + t.name + '|', i < vn.step ? String(vnSetSize(t.mask)) : '…']);
    const union = vn.cubes.filter((c) => c.userData.mask).length;
    setState('1～' + vn.N + ' 中 ' + vn.d.join('、') + ' 的倍數', rows, '目前總和 = ' + vn.sum + (vn.step === vn.terms.length ? '<br><span class="ok">每一區都剛好算 1 次 → |聯集| = ' + union + '</span>' : '<br>方塊顏色：灰 0 次、綠 1 次、橘 2 次、紅 3 次'));
  }
  function enterVenn() {
    fresh([0, 9.5, 9], [0, 0, 0.3]);
    controls('N = <input id="vN" type="number" min="10" max="100" value="' + vn.N + '"> <select id="vD"><option value="2,3,5">2、3、5</option><option value="2,3,7">2、3、7</option><option value="3,4,5">3、4、5</option><option value="2,5,7">2、5、7</option><option value="2,3">只看 2、3</option><option value="3,5">只看 3、5</option></select>'
      + '<button class="primary" id="vStep">下一項</button><button id="vAll">全部算完</button><button id="vReset">重來</button>');
    $('vD').value = vn.d.join(',');
    const reset = () => { const N = Math.max(10, Math.min(100, Number($('vN').value) || 100)); const d = $('vD').value.split(',').map(Number); vn.d = d; vn.N = N; enterVenn(); };
    $('vN').onchange = reset; $('vD').onchange = reset; on('vReset', reset);
    vnBuild(vn.N, vn.d);
    const doStep = () => {
      const r = vnStep();
      if (!r) { log('已經算完所有項了；按「重來」換一組。', true); return false; }
      log((r.t.sign > 0 ? '加上' : '扣掉') + ' |' + r.t.name + '| = ⌊' + vn.N + '/' + lcmOf(r.t.mask) + '⌋ = ' + r.size + ' → 總和 ' + vn.sum);
      vnState(); return true;
    };
    on('vStep', doStep);
    on('vAll', guard(async (w) => { while (doStep()) await w(500); }));
    log('排容原理：一項一項加減，看每一區被算了幾次。最後每一區都剛好算 1 次。');
    vnState();
  }
  const lcmOf = (mask) => { let l = 1; vn.d.forEach((x, i) => { if (mask & (1 << i)) l = lcm(l, x); }); return l; };

  // ───────────────────────── 錯排（帽子問題） ─────────────────────────
  const dr = { n: 4, ppl: [], hats: [], perm: [] };
  const drX = (i) => (i - (dr.n - 1) / 2) * Math.min(1.6, 11 / dr.n);
  function person(i, x) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: PAL[i], roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 16), mat); body.position.y = 0.5; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshStandardMaterial({ color: '#f1d3b3' })); head.position.y = 1.25;
    g.add(body, head); g.userData.mat = mat; g.position.set(x, 0, 0);
    const l = lab.label('人 ' + (i + 1), 'idx'); l.position.set(0, -0.15, 0.6); g.add(l);
    lab.world.add(g); return g;
  }
  function hat(i) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 16), new THREE.MeshStandardMaterial({ color: PAL[i], roughness: 0.4 }));
    m.castShadow = true; m.add(lab.label(String(i + 1), 'idx')); lab.world.add(m); return m;
  }
  function drPlace(perm) { // person i gets hat perm[i]
    dr.perm = perm;
    perm.forEach((h, i) => move(dr.hats[h], drX(i), 1.72, 0));
    let fixed = 0;
    dr.ppl.forEach((p, i) => { const f = perm[i] === i; if (f) fixed++; glow(p, f ? RED : null); });
    return fixed;
  }
  function drState(extra) {
    const n = dr.n, D = Der(n);
    setState('n = ' + n + ' 人的帽子', [['n!', fact(n)], ['錯排 Dₙ', D], ['Dₙ / n!', (D / fact(n)).toFixed(4)], ['1/e', (1 / Math.E).toFixed(4)]],
      'Dₙ = n!(1 − 1/1! + 1/2! − … + (−1)ⁿ/n!)' + (extra ? '<br>' + extra : ''));
  }
  function enterDerange() {
    fresh([0, 4.5, 11], [0, 1.0, 0]);
    dr.ppl = []; dr.hats = [];
    for (let i = 0; i < dr.n; i++) dr.ppl.push(person(i, drX(i)));
    for (let i = 0; i < dr.n; i++) { const h = hat(i); h.position.set(drX(i), 1.72, 0); dr.hats.push(h); lab.addBody(h); }
    controls('n = <input id="dN" type="number" min="2" max="7" value="' + dr.n + '"><button class="primary" id="dRand">隨機發帽子</button><button id="dDer">只發錯排</button><button id="dSim">模擬 1000 次</button><button id="dBack">還給本人</button>');
    $('dN').onchange = () => { dr.n = Math.max(2, Math.min(7, Number($('dN').value) || 4)); enterDerange(); };
    on('dRand', () => {
      const p = shuffle([...Array(dr.n).keys()]);
      const f = drPlace(p);
      log('發帽子：' + p.map((h, i) => '人' + (i + 1) + '←帽' + (h + 1)).join('，') + (f ? '；有 ' + f + ' 人拿到自己的（紅色）' : '；沒人拿到自己的 → 錯排'));
      drState(f ? '<span class="no">不是錯排</span>：' + f + ' 個固定點' : '<span class="ok">是錯排</span>');
    });
    on('dDer', () => {
      let p, t = 0; do { p = shuffle([...Array(dr.n).keys()]); t++; } while (p.some((h, i) => h === i));
      drPlace(p);
      log('重抽了 ' + t + ' 次才抽到錯排：' + p.map((h) => h + 1).join(' '));
      drState('<span class="ok">錯排</span>：人 i 都沒拿到帽 i');
    });
    on('dSim', () => {
      let ok = 0; for (let k = 0; k < 1000; k++) { const p = shuffle([...Array(dr.n).keys()]); if (!p.some((h, i) => h === i)) ok++; }
      log('1000 次隨機發帽，沒人拿到自己的有 ' + ok + ' 次（理論 ' + (Der(dr.n) / fact(dr.n) * 1000).toFixed(0) + ' 次）');
      drState('模擬：' + ok + ' / 1000 = ' + (ok / 1000).toFixed(3));
    });
    on('dBack', () => { drPlace([...Array(dr.n).keys()]); drState('每個人都拿到自己的：' + dr.n + ' 個固定點'); });
    log('錯排（derangement）：n 個人的帽子重新發，沒有人拿到自己的。');
    drState();
  }

  // ───────────────────────── 物品放箱子（四種情況） ─────────────────────────
  const bx = { n: 4, k: 3, objD: true, boxD: true, onto: false };
  function distCount(n, k, objD, boxD, onto) {
    if (objD && boxD) return onto ? fact(k) * S2(n, k) : k ** n;
    if (!objD && boxD) return onto ? Cb(n - 1, k - 1) : Cb(n + k - 1, n);
    if (objD && !boxD) { if (onto) return S2(n, k); let s = 0; for (let j = 1; j <= k; j++) s += S2(n, j); return s; }
    if (onto) return pk(n, k); let s = 0; for (let j = 1; j <= k; j++) s += pk(n, j); return s;
  }
  function distFormula(n, k, objD, boxD, onto) {
    if (objD && boxD) return onto ? k + '!·S(' + n + ',' + k + ')（= onto）' : k + sup(n) + '（每個物品選一箱）';
    if (!objD && boxD) return onto ? 'C(' + (n - 1) + ',' + (k - 1) + ')（先每箱放 1）' : 'H(' + k + ',' + n + ') = C(' + (n + k - 1) + ',' + n + ')（星棒法）';
    if (objD && !boxD) return onto ? 'S(' + n + ',' + k + ')（第二類 Stirling）' : 'S(' + n + ',1) + … + S(' + n + ',' + k + ')';
    return onto ? 'p(' + n + ', 恰 ' + k + ' 部分)（整數分割）' : 'p(' + n + ', ≤ ' + k + ' 部分)';
  }
  function randDist() {
    const { n, k, objD, boxD, onto } = bx;
    for (let t = 0; t < 500; t++) {
      let f;
      if (objD) f = Array.from({ length: n }, () => rnd(k));
      else { const pos = shuffle([...Array(n + k - 1).keys()]).slice(0, k - 1).sort((a, b) => a - b); const c = []; let prev = -1; pos.forEach((p) => { c.push(p - prev - 1); prev = p; }); c.push(n + k - 2 - prev); f = []; c.forEach((v, b) => { for (let i = 0; i < v; i++) f.push(b); }); }
      const cnt = Array(k).fill(0); f.forEach((b) => cnt[b]++);
      if (!onto || cnt.every((c) => c > 0)) return f;
    }
    return Array.from({ length: n }, (_, i) => i % k);
  }
  function enterBoxes() {
    fresh([0, 7, 10.5], [0, 0.6, 0]);
    const sel = (id, a, b, v) => '<select id="' + id + '"><option value="1"' + (v ? ' selected' : '') + '>' + a + '</option><option value="0"' + (v ? '' : ' selected') + '>' + b + '</option></select>';
    controls('物品 n = <input id="bN" type="number" min="1" max="8" value="' + bx.n + '"> 箱子 k = <input id="bK" type="number" min="1" max="5" value="' + bx.k + '">'
      + sel('bO', '相異物', '相同物', bx.objD) + sel('bB', '相異箱', '相同箱', bx.boxD) + sel('bE', '不可空箱', '可空箱', bx.onto)
      + '<button class="primary" id="bRand">隨機放一種</button>');
    const reset = () => { bx.n = Math.max(1, Math.min(8, Number($('bN').value) || 4)); bx.k = Math.max(1, Math.min(5, Number($('bK').value) || 3)); bx.objD = $('bO').value === '1'; bx.boxD = $('bB').value === '1'; bx.onto = $('bE').value === '1'; enterBoxes(); };
    ['bN', 'bK', 'bO', 'bB', 'bE'].forEach((id) => { $(id).onchange = reset; });
    const cx = (b) => (b - (bx.k - 1) / 2) * 2.3;
    const crates = []; for (let b = 0; b < bx.k; b++) crates.push(crate(cx(b), -0.6, 1.9, 1.6, 0.42, bx.boxD ? PAL[b] : '#c9a878', bx.boxD ? '箱 ' + (b + 1) : ''));
    const objs = []; for (let i = 0; i < bx.n; i++) objs.push(ball(bx.objD ? 'abcdefgh'[i] : '', bx.objD ? PAL[i % 8] : '#f4efe6', 0.24, (i - (bx.n - 1) / 2) * 0.7, 0.24, 2.4));
    objs.forEach((o) => lab.addBody(o));
    const place = () => {
      let f = randDist();
      if (!bx.boxD) { // identical boxes: show the groups sorted by size, boxes have no identity
        const groups = Array.from({ length: bx.k }, () => []); f.forEach((b, i) => groups[b].push(i));
        groups.sort((a, b) => b.length - a.length || a[0] - b[0]);
        f = Array(bx.n); groups.forEach((g, b) => g.forEach((i) => { f[i] = b; }));
      }
      const cnt = Array(bx.k).fill(0);
      f.forEach((b, i) => { const p = slotIn(cx(b), -0.6, cnt[b]++, 0.33, 0.34, 0.25); move(objs[i], p.x, p.y, p.z); });
      const desc = Array.from({ length: bx.k }, (_, b) => '[' + f.map((bb, i) => (bb === b ? (bx.objD ? 'abcdefgh'[i] : '●') : '')).join('') + ']').join(' ');
      log('一種放法：' + desc + (bx.boxD ? '' : '（箱子相同：只看怎麼分組）'));
    };
    on('bRand', () => { if (!distCount(bx.n, bx.k, bx.objD, bx.boxD, bx.onto)) { log('這個設定沒有任何放法：物品比箱子少，不可能每箱都有。', true); return; } place(); });
    const all = [[1, 1], [0, 1], [1, 0], [0, 0]].map(([o, b]) => [o, b, distCount(bx.n, bx.k, !!o, !!b, false), distCount(bx.n, bx.k, !!o, !!b, true)]);
    const name = (o, b) => (o ? '相異物' : '相同物') + '→' + (b ? '相異箱' : '相同箱');
    const cur = distCount(bx.n, bx.k, bx.objD, bx.boxD, bx.onto);
    setState(name(bx.objD, bx.boxD) + '，' + (bx.onto ? '不可空' : '可空'), all.map(([o, b, a, s]) => [name(o, b), a + '（不空 ' + s + '）']),
      distFormula(bx.n, bx.k, bx.objD, bx.boxD, bx.onto) + ' = <span class="ok">' + cur + '</span>');
    log('先判斷：物品相不相同？箱子相不相同？能不能空？四種情況公式完全不同。');
    if (cur === 0) log('這個設定 0 種：' + (bx.onto ? '物品比箱子少，不可能每箱都有。' : ''), true); else place();
  }

  // ───────────────────────── 生成函數 ─────────────────────────
  const gf = { r: 17, v: [[2, 5, 'any'], [3, 6, 'any'], [4, 7, 'any']], rows: [], prod: [] };
  const allowed = (lo, hi, par, e) => e >= lo && (hi === null || e <= hi) && (par === 'any' || (par === 'even' ? e % 2 === 0 : e % 2 === 1));
  function gfPolys() { return gf.v.map(([lo, hi, par]) => Array.from({ length: gf.r + 1 }, (_, e) => (allowed(lo, hi, par, e) ? 1 : 0))); }
  function gfTermStr([lo, hi, par]) {
    const ex = []; for (let e = 0; e <= Math.min(gf.r, 30); e++) if (allowed(lo, hi, par, e)) ex.push(e);
    const t = (e) => (e === 0 ? '1' : e === 1 ? 'x' : 'x' + sup(e));
    return '(' + (ex.length > 4 ? ex.slice(0, 3).map(t).join('+') + '+…' + (hi === null ? '' : '+' + t(ex[ex.length - 1])) : ex.map(t).join('+')) + ')';
  }
  function enterGF() {
    fresh([0, 4.2, 13.5], [0, 3.4, 0]);
    const vin = (i) => { const [lo, hi, par] = gf.v[i] || [0, null, 'any']; return '<span style="white-space:nowrap">x' + (i + 1) + '：<input id="gL' + i + '" type="number" min="0" max="20" value="' + lo + '" style="width:52px">～<input id="gH' + i + '" type="number" min="0" max="20" value="' + (hi === null ? '' : hi) + '" placeholder="∞" style="width:52px"><select id="gP' + i + '"><option value="any">不限</option><option value="even">偶數</option><option value="odd">奇數</option></select></span>'; };
    controls('r = <input id="gR" type="number" min="1" max="20" value="' + gf.r + '">' + vin(0) + vin(1) + vin(2) + '<button class="primary" id="gMul">相乘看係數</button><button id="gSol">列出一組解</button>');
    gf.v.forEach(([, , par], i) => { $('gP' + i).value = par; });
    const read = () => {
      gf.r = Math.max(1, Math.min(20, Number($('gR').value) || 10));
      gf.v = [0, 1, 2].map((i) => { const lo = Math.max(0, Number($('gL' + i).value) || 0); const hs = String($('gH' + i).value).trim(); const hi = hs === '' ? null : Math.max(lo, Number(hs)); return [lo, hi, $('gP' + i).value || 'any']; });
      enterGF();
    };
    ['gR', 'gL0', 'gH0', 'gP0', 'gL1', 'gH1', 'gP1', 'gL2', 'gH2', 'gP2'].forEach((id) => { $(id).onchange = read; });
    const sp = Math.min(0.62, 12.4 / (gf.r + 1)), x0 = -((gf.r) * sp) / 2;
    const P = gfPolys();
    gf.rows = P.map((p, i) => {
      tag('x' + (i + 1), 'ptr', x0 - 0.8, 7.3 - i * 0.62, 0);
      return p.map((c, e) => cube(c ? (gf.r <= 14 ? e : '') : '', c ? PAL[i] : '#eee6d8', [sp * 0.8, 0.45, 0.3], x0 + e * sp, 7.3 - i * 0.62, 0));
    });
    for (let e = 0; e <= gf.r; e += (gf.r > 14 ? 2 : 1)) tag(String(e), 'idx', x0 + e * sp, 0, 0.7);
    const prod = polyMul(polyMul(P[0], P[1], gf.r), P[2], gf.r);
    while (prod.length < gf.r + 1) prod.push(0);
    gf.prod = prod;
    gf.bars = null;
    on('gMul', guard(async (w) => {
      if (gf.bars) gf.bars.forEach(kill);
      const mx = Math.max(1, ...prod);
      gf.bars = prod.map((c, e) => { const m = lab.box(e === gf.r ? COL.gold : COL.ball, [sp * 0.7, 1, 0.5]); m.scale.y = 0.01; m.position.set(x0 + e * sp, 0.005, 0); m.userData.lbl = lab.label('', 'idx'); m.add(m.userData.lbl); lab.world.add(m); return m; });
      await tween(w, 900, (t) => gf.bars.forEach((m, e) => { const h = Math.max(0.01, prod[e] / mx * 4.2 * t); m.scale.y = h; m.position.y = h / 2; m.userData.lbl.position.set(0, 0.5 + 0.3 / h, 0); }));
      gf.bars.forEach((m, e) => txt(m.userData.lbl, prod[e] ? String(prod[e]) : ''));
      log('xʳ 的係數 = 從每個括號各挑一項、指數加起來剛好 r 的方法數 = ' + prod[gf.r]);
    }));
    on('gSol', () => {
      const sols = [];
      for (let a = 0; a <= gf.r; a++) if (P[0][a]) for (let b = 0; a + b <= gf.r; b++) if (P[1][b]) { const c = gf.r - a - b; if (P[2][c]) sols.push([a, b, c]); }
      gf.rows.forEach((row) => row.forEach((m) => { glow(m, null); m.position.z = 0; }));
      if (!sols.length) { log('x^' + gf.r + ' 的係數是 0：沒有任何一組解。', true); return; }
      const s = sols[rnd(sols.length)];
      s.forEach((e, i) => { glow(gf.rows[i][e], GOLD); gf.rows[i][e].position.z = 0.5; });
      log('一組解：x1 = ' + s[0] + '，x2 = ' + s[1] + '，x3 = ' + s[2] + '（共 ' + sols.length + ' 組）');
    });
    setState('生成函數：x' + sup(gf.r) + ' 的係數', gf.v.map((v, i) => ['x' + (i + 1), gfTermStr(v)]), '係數 = x₁+x₂+x₃ = ' + gf.r + ' 的解數 = <span class="ok">' + prod[gf.r] + '</span>');
    log('每個變數一個括號：允許的值 e 就放一項 xᵉ。三個括號相乘，x^r 的係數就是解的個數。');
  }

  // ───────────────────────── Catalan：不越過對角線的路徑 ─────────────────────────
  const ct = { n: 3, word: '', segs: [], idx: 0 };
  function ctGrid(n) {
    const s = Math.min(1.3, 6.6 / n), ox = -n * s / 2, oz = n * s / 2;
    for (let i = 0; i <= n + 1; i++) { if (i <= n) line(ox + i * s, 0.03, oz, ox + i * s, 0.03, oz - (n + 1) * s, '#c9b48e'); }
    for (let j = 0; j <= n + 1; j++) line(ox, 0.03, oz - j * s, ox + n * s, 0.03, oz - j * s, '#c9b48e');
    rod(V3(ox, 0.05, oz), V3(ox + n * s, 0.05, oz - n * s), COL.green, 0.03);
    rod(V3(ox, 0.05, oz - s), V3(ox + (n) * s, 0.05, oz - (n + 1) * s), COL.red, 0.025);
    tag('y = x', 'idx', ox + n * s + 0.4, 0.1, oz - n * s);
    tag('y = x + 1', 'idx', ox + n * s + 0.6, 0.1, oz - (n + 1) * s);
    tag('(0,0)', 'idx', ox - 0.4, 0.1, oz + 0.4); tag('(' + n + ',' + n + ')', 'ptr alt', ox + n * s + 0.3, 0.3, oz - n * s + 0.4);
    return { P: (i, j) => V3(ox + i * s, 0.14, oz - j * s), s };
  }
  function ctDraw(G, word, color, y = 0.14) {
    const segs = []; let i = 0, j = 0;
    for (const ch of word) { const a = G.P(i, j); if (ch === 'E') i++; else j++; const b = G.P(i, j); a.y = b.y = y; segs.push(rod(a, b, color, 0.075)); }
    return segs;
  }
  const isDyck = (w) => { let h = 0; for (const c of w) { h += c === 'N' ? 1 : -1; if (h > 0) return false; } return true; };
  function dyckWords(n) { const out = []; const rec = (s, e, nn) => { if (s.length === 2 * n) { out.push(s); return; } if (e < n) rec(s + 'E', e + 1, nn); if (nn < e) rec(s + 'N', e, nn + 1); }; rec('', 0, 0); return out; }
  function reflectWord(w) { let h = 0; for (let k = 0; k < w.length; k++) { h += w[k] === 'N' ? 1 : -1; if (h === 1) return { k, w: w.slice(0, k + 1) + w.slice(k + 1).split('').map((c) => (c === 'N' ? 'E' : 'N')).join('') }; } return null; }
  function enterCatalan() {
    fresh([0, 9, 7.5], [0, 0, -0.3]);
    controls('n = <input id="cN" type="number" min="1" max="6" value="' + ct.n + '"><button class="primary" id="cRand">隨機路徑</button><button id="cGood">下一條好路徑</button><button id="cRef">反射壞路徑</button>');
    $('cN').onchange = () => { ct.n = Math.max(1, Math.min(6, Number($('cN').value) || 3)); ct.idx = 0; enterCatalan(); };
    const G = ctGrid(ct.n);
    const clearSegs = () => { ct.segs.forEach(kill); ct.segs = []; };
    on('cRand', () => {
      clearSegs();
      ct.word = shuffle([...'E'.repeat(ct.n) + 'N'.repeat(ct.n)]).join('');
      const ok = isDyck(ct.word);
      ct.segs = ctDraw(G, ct.word, ok ? COL.green : COL.red);
      log(ct.word + (ok ? '：沒有越過 y = x → 好路徑' : '：碰到 y = x + 1 → 壞路徑（可按「反射」）'));
      ctState(ok ? '<span class="ok">好路徑</span>' : '<span class="no">壞路徑</span>');
    });
    on('cGood', () => {
      clearSegs();
      const all = dyckWords(ct.n); ct.word = all[ct.idx % all.length];
      ct.segs = ctDraw(G, ct.word, COL.green);
      log('第 ' + (ct.idx % all.length + 1) + ' / ' + all.length + ' 條好路徑：' + ct.word);
      ct.idx++; ctState('好路徑 ' + ((ct.idx - 1) % all.length + 1) + ' / ' + all.length);
    });
    on('cRef', () => {
      if (!ct.word || isDyck(ct.word)) { log('先按「隨機路徑」抽到一條紅色的壞路徑，才能反射。', true); return; }
      const r = reflectWord(ct.word);
      ct.segs.push(...ctDraw(G, r.w, COL.gold, 0.26));
      log('第一次碰到 y = x + 1 是第 ' + (r.k + 1) + ' 步；之後 E↔N 對調 → ' + r.w + '，終點變成 (' + (ct.n - 1) + ',' + (ct.n + 1) + ')');
      ctState('反射後終點 (' + (ct.n - 1) + ',' + (ct.n + 1) + ')：壞路徑 ↔ 到 (n−1, n+1) 的路徑一一對應');
    });
    log('從 (0,0) 走到 (n,n)，只能往東 E、往北 N，而且不能走到對角線上方。');
    ctState('');
  }
  function ctState(extra) {
    const n = ct.n;
    setState('Catalan 數 Cₙ（n = ' + n + '）', [['全部路徑 C(2n,n)', Cb(2 * n, n)], ['壞路徑 C(2n,n+1)', Cb(2 * n, n + 1)], ['好路徑 Cₙ', catalan(n)]],
      'Cₙ = C(2n,n) − C(2n,n+1) = C(2n,n)/(n+1) = <span class="ok">' + catalan(n) + '</span>' + (extra ? '<br>' + extra : ''));
  }

  // ───────────────────────── Burnside：項鍊 ─────────────────────────
  const bn = { n: 4, k: 2, minis: [], r: 0 };
  const BEAD = ['#2e2418', '#f4efe6', '#e55a9b'];
  const rotStr = (s, r) => s.slice(r) + s.slice(0, r);
  const canon = (s) => { let b = s; for (let r = 1; r < s.length; r++) { const t = rotStr(s, r); if (t < b) b = t; } return b; };
  function allColorings(n, k) { const out = []; const rec = (s) => { if (s.length === n) { out.push(s); return; } for (let c = 0; c < k; c++) rec(s + c); }; rec(''); return out; }
  function necklace(s, x, y, z, R, br) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, Math.max(0.012, br * 0.18), 6, 40), new THREE.MeshStandardMaterial({ color: '#b9a684' }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
    const n = s.length;
    for (let i = 0; i < n; i++) { const a = Math.PI / 2 - i * 2 * Math.PI / n; const b = new THREE.Mesh(new THREE.SphereGeometry(br, 14, 10), new THREE.MeshStandardMaterial({ color: BEAD[+s[i]], roughness: 0.35 })); b.position.set(Math.cos(a) * R, 0, -Math.sin(a) * R); b.castShadow = true; g.add(b); }
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(R + br * 1.8, R + br * 1.8, 0.02, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f', transparent: true, opacity: 0 }));
    hl.position.y = -br; g.add(hl);
    g.userData.hl = hl; g.userData.s = s;
    g.position.set(x, y, z); lab.world.add(g); return g;
  }
  const lightMini = (g, on, color) => { g.userData.hl.material.opacity = on ? 0.45 : 0; if (color) g.userData.hl.material.color.set(color); };
  function bnLayout(n, k) {
    const cols = allColorings(n, k);
    const per = Math.ceil(Math.sqrt(cols.length)), sp = Math.min(1.45, 8.2 / per);
    return { cols, per, sp, R: sp * 0.3, br: sp * 0.09, pos: (i) => [0.9 + (i % per - (per - 1) / 2) * sp, (Math.floor(i / per) - (Math.ceil(cols.length / per) - 1) / 2) * sp] };
  }
  function enterBurnside() {
    fresh([0, 10, 7.5], [0.4, 0, 0.3]);
    controls('珠子 n = <input id="nN" type="number" min="3" max="6" value="' + bn.n + '"> 顏色 k = <input id="nK" type="number" min="2" max="3" value="' + bn.k + '">'
      + ' 旋轉 r = <select id="nR"></select><button class="primary" id="nFix">看 r 固定哪些</button><button id="nOrb">按軌道分組</button>');
    $('nR').innerHTML = Array.from({ length: bn.n }, (_, r) => '<option value="' + r + '">' + r + ' 格（' + Math.round(360 * r / bn.n) + '°）</option>').join('');
    const reset = () => { bn.n = Math.max(3, Math.min(6, Number($('nN').value) || 4)); bn.k = Math.max(2, Math.min(3, Number($('nK').value) || 2)); enterBurnside(); };
    $('nN').onchange = reset; $('nK').onchange = reset;
    const L = bnLayout(bn.n, bn.k);
    const big = necklace('0'.repeat(bn.n).split('').map(() => rnd(bn.k)).join(''), -5.1, 0.3, -0.5, 1.1, 0.22);
    tag('旋轉這條', 'idx', -5.1, 0, 1.2);
    bn.minis = [];
    const show = L.cols.length <= 81;
    if (show) L.cols.forEach((s, i) => { const [x, z] = L.pos(i); bn.minis.push(necklace(s, x, 0.15, z, L.R, L.br)); });
    else log('k^n = ' + L.cols.length + ' 太多，畫面只顯示公式。', true);
    const fixedCount = (r) => bn.k ** gcd(bn.n, r);
    on('nFix', guard(async (w) => {
      const r = Number($('nR').value) || 0;
      const a0 = big.rotation.y;
      await tween(w, 600, (t) => { big.rotation.y = a0 + t * 2 * Math.PI * r / bn.n; });
      let c = 0;
      bn.minis.forEach((g) => { const f = rotStr(g.userData.s, r) === g.userData.s; if (f) c++; lightMini(g, f, '#c08a1f'); });
      const cyc = gcd(bn.n, r);
      log('轉 ' + r + ' 格：位置分成 gcd(' + bn.n + ',' + r + ') = ' + cyc + ' 個循環，每個循環同色 → 固定 ' + bn.k + sup(cyc) + ' = ' + fixedCount(r) + ' 種' + (show ? '（畫面亮起 ' + c + ' 條）' : ''));
      bnState();
    }));
    on('nOrb', guard(async (w) => {
      if (!show) { log('著色數太多，不畫分組。', true); return; }
      const orbs = {}; bn.minis.forEach((g) => { const c = canon(g.userData.s); (orbs[c] = orbs[c] || []).push(g); });
      const keys = Object.keys(orbs).sort();
      let i = 0;
      keys.forEach((k, ri) => orbs[k].forEach((g) => { lightMini(g, true, PAL[ri % 8]); const [x, z] = L.pos(i++); move(g, x, 0.15, z); }));
      await w(900);
      log('互相轉得到的排在一起、同一個顏色：共 ' + keys.length + ' 組 = ' + keys.length + ' 種不同的項鍊');
    }));
    log('Burnside：不同項鍊數 = 每個旋轉「固定的著色數」的平均。');
    bnState();
  }
  function bnState() {
    const n = bn.n, k = bn.k;
    const fx = Array.from({ length: n }, (_, r) => k ** gcd(n, r));
    const tot = fx.reduce((a, b) => a + b, 0);
    setState(n + ' 顆珠子、' + k + ' 色（只轉不翻）', fx.map((f, r) => ['轉 ' + r + ' 格', k + sup(gcd(n, r)) + ' = ' + f]),
      '(' + fx.join(' + ') + ') / ' + n + ' = <span class="ok">' + tot / n + '</span> 種項鍊');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function uniq(ans, cands) { const s = [String(ans)]; for (const c of cands) { const v = String(c); if (!s.includes(v) && s.length < 4 && v !== 'NaN') s.push(v); } let d = 1; while (s.length < 4) { const v = String(Number(ans) + d * 3); if (!s.includes(v)) s.push(v); d++; } return s; }
  function genQ() {
    const t = rnd(9);
    if (t === 0) {
      const n = 3 + rnd(5), ans = Der(n);
      return { q: n + ' 個人把帽子交給服務生，拿回來時沒有人拿到自己的帽子，有幾種情形？', opts: uniq(ans, [fact(n) - ans, fact(n - 1), fact(n) / 2]), ans: String(ans), why: 'D' + n + ' = ' + n + '!(1 − 1/1! + 1/2! − … ) = ' + ans + '；也可用 Dₙ = (n−1)(Dₙ₋₁ + Dₙ₋₂)。' };
    }
    if (t === 1) {
      const sets = [[2, 3, 5], [2, 3, 7], [3, 5, 7], [2, 5, 7]][rnd(4)], N = 50 + rnd(51);
      const f = (l) => Math.floor(N / l);
      const [a, b, c] = sets;
      const ans = f(a) + f(b) + f(c) - f(a * b) - f(a * c) - f(b * c) + f(a * b * c);
      return { q: '1～' + N + ' 之中，能被 ' + a + '、' + b + ' 或 ' + c + ' 整除的整數有幾個？', opts: uniq(ans, [f(a) + f(b) + f(c), f(a) + f(b) + f(c) - f(a * b) - f(a * c) - f(b * c), N - ans]), ans: String(ans), why: '排容：' + f(a) + '+' + f(b) + '+' + f(c) + '−' + f(a * b) + '−' + f(a * c) + '−' + f(b * c) + '+' + f(a * b * c) + ' = ' + ans + '。' };
    }
    if (t === 2) {
      const m = 4 + rnd(3), n = 2 + rnd(2);
      let ans = 0; for (let i = 0; i <= n; i++) ans += (i % 2 ? -1 : 1) * Cb(n, i) * (n - i) ** m;
      return { q: '從 ' + m + ' 個元素的集合映到 ' + n + ' 個元素的集合，映成（onto）函數有幾個？', opts: uniq(ans, [n ** m, S2(m, n), Cb(m - 1, n - 1)]), ans: String(ans), why: 'Σ(−1)ⁱC(' + n + ',i)(' + n + '−i)' + sup(m) + ' = ' + ans + ' = ' + n + '!·S(' + m + ',' + n + ')。' };
    }
    if (t === 3) {
      const n = 4 + rnd(3), k = 2 + rnd(2), ans = S2(n, k);
      return { q: n + ' 個不同的物品放進 ' + k + ' 個相同的箱子，每箱至少一個，有幾種放法？', opts: uniq(ans, [fact(k) * ans, k ** n, Cb(n - 1, k - 1)]), ans: String(ans), why: '相異物放相同箱、不空 = S(' + n + ',' + k + ') = ' + ans + '；箱子若相異要再乘 ' + k + '!。' };
    }
    if (t === 4) {
      const n = 4 + rnd(4), k = 2 + rnd(3), od = rnd(2), bd = rnd(2), onto = rnd(2) === 1;
      const ans = distCount(n, k, !!od, !!bd, onto);
      const others = [[1, 1], [0, 1], [1, 0], [0, 0]].filter(([o, b]) => o !== od || b !== bd).map(([o, b]) => distCount(n, k, !!o, !!b, onto));
      return { q: n + ' 個' + (od ? '不同' : '相同') + '的球放進 ' + k + ' 個' + (bd ? '不同' : '相同') + '的箱子，' + (onto ? '每箱至少一球' : '箱子可以空') + '，有幾種放法？', opts: uniq(ans, [...others, distCount(n, k, !!od, !!bd, !onto)]), ans: String(ans), why: distFormula(n, k, !!od, !!bd, onto) + ' = ' + ans + '。先分清物品／箱子是否相同、能否空箱。' };
    }
    if (t === 5) {
      const k = 3, lo = 1 + rnd(2), hi = lo + 2 + rnd(2), r = k * lo + 2 + rnd(k * (hi - lo) - 3);
      let p = [1]; const f = Array.from({ length: hi + 1 }, (_, e) => (e >= lo ? 1 : 0)); for (let i = 0; i < k; i++) p = polyMul(p, f, 60);
      const ans = p[r] || 0;
      return { q: r + ' 塊相同的餅乾分給 ' + k + ' 個小孩，每人 ' + lo + '～' + hi + ' 塊，有幾種分法？（看 (x' + sup(lo) + '+…+x' + sup(hi) + ')³ 中 x' + sup(r) + ' 的係數）', opts: uniq(ans, [Cb(r + k - 1, k - 1), Cb(r - k * lo + k - 1, k - 1), ans + 1]), ans: String(ans), why: '每個小孩一個括號，挑出指數和 = ' + r + ' 的組合數 = ' + ans + '；不能直接用星棒法，因為有上限 ' + hi + '。' };
    }
    if (t === 6) {
      const n = 3 + rnd(5), ans = catalan(n);
      return { q: '從 (0,0) 走到 (' + n + ',' + n + ')，每步往東或往北，且不可走到 y = x 上方，有幾條路徑？', opts: uniq(ans, [Cb(2 * n, n), Cb(2 * n, n + 1), Cb(2 * n, n) / n]), ans: String(ans), why: 'Catalan 數 C' + n + ' = C(' + 2 * n + ',' + n + ')/(' + (n + 1) + ') = ' + ans + '；壞路徑反射後對應到 (' + (n - 1) + ',' + (n + 1) + ')，有 C(' + 2 * n + ',' + (n + 1) + ') 條。' };
    }
    if (t === 7) {
      const n = 3 + rnd(4), k = 2 + rnd(2);
      let s = 0; for (let r = 0; r < n; r++) s += k ** gcd(n, r);
      const ans = s / n;
      return { q: n + ' 顆珠子的圓形項鍊用 ' + k + ' 種顏色著色，只把旋轉後相同的視為一樣（不考慮翻面），有幾種不同的項鍊？', opts: uniq(ans, [k ** n, Math.round(k ** n / n), ans + 1]), ans: String(ans), why: 'Burnside：轉 r 格固定 k^gcd(n,r) 種；平均 = (' + Array.from({ length: n }, (_, r) => k ** gcd(n, r)).join('+') + ')/' + n + ' = ' + ans + '。' };
    }
    const n = 4 + rnd(5), ans = pAll(n);
    return { q: '整數 ' + n + ' 的分割數 p(' + n + ')（不計順序，寫成正整數之和的方法數）是多少？', opts: uniq(ans, [2 ** (n - 1), n, ans + 2]), ans: String(ans), why: 'p(' + n + ') = ' + ans + '；2^' + (n - 1) + ' 是「有順序」的合成數（composition），不是分割。' };
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

  // ═════════════════════════ 場景（課本） ═════════════════════════
  async function scIETwo(tok) {
    fresh([0, 9.5, 8.5], [0, 0, 0.2]);
    const w = (ms) => beat(tok, ms);
    vnBuild(30, [2, 3]);
    say('1～30 中，2 或 3 的倍數有幾個？', '|A ∪ B| = ?');
    await w(2600);
    const caps = [['|A| = ⌊30/2⌋ = 15', '先加上 2 的倍數'], ['|B| = ⌊30/3⌋ = 10', '再加上 3 的倍數'], ['6 的倍數被算了兩次', '− |A∩B| = ⌊30/6⌋ = 5']];
    for (let i = 0; i < 3; i++) {
      vnStep(); vnState();
      say(caps[i][1], caps[i][0]);
      await w(i === 1 ? 2200 : 2600);
      if (i === 1) { say('中間（6, 12, 18, 24, 30）變橘色', '被算了 2 次！'); await w(2400); }
    }
    say('|A ∪ B| = |A| + |B| − |A ∩ B|', '15 + 10 − 5 = 20');
    await w(3200);
  }
  async function scIEThree(tok) {
    fresh([0, 9.5, 9], [0, 0, 0.3]);
    const w = (ms) => beat(tok, ms);
    vnBuild(100, [2, 3, 5]);
    say('1～100 中，2、3 或 5 的倍數有幾個？', '一顆方塊 = 一個數');
    await w(2600);
    const capF = ['+ |A| = 50', '+ |B| = 33', '+ |C| = 20', '− |A∩B| = ⌊100/6⌋ = 16', '− |A∩C| = ⌊100/10⌋ = 10', '− |B∩C| = ⌊100/15⌋ = 6', '+ |A∩B∩C| = ⌊100/30⌋ = 3'];
    const capS = ['加上 2 的倍數', '加 3 的倍數：重疊處變 2 次', '加 5 的倍數：正中間被算 3 次', '扣掉兩兩交集', '繼續扣', '正中間被扣成 0 次了', '把正中間加回來'];
    for (let i = 0; i < 7; i++) {
      vnStep(); vnState();
      say(capS[i], capF[i] + '　總和 ' + vn.sum);
      await w(i >= 5 ? 2600 : 2100);
    }
    say('每一區都剛好算 1 次', '50+33+20−16−10−6+3 = 74');
    await w(3400);
  }
  async function scIEUpper(tok) {
    fresh([4.5, 7, 9.5], [0, 1.6, 0]);
    const w = (ms) => beat(tok, ms);
    const s = 0.5, P = (a, b, c) => V3(-2.75 + a * s, 0.3 + c * s, 2.75 - b * s);
    for (const [v, nm] of [[V3(1, 0, 0), 'x₁'], [V3(0, 0, -1), 'x₂'], [V3(0, 1, 0), 'x₃']]) { const o = P(0, 0, 0); rod(o.clone().addScaledVector(v, -0.2), o.clone().addScaledVector(v, 6.2), '#9c8b70', 0.025); tag(nm, 'ptr', o.x + v.x * 6.5, o.y + v.y * 6.5, o.z + v.z * 6.5); }
    const pts = [];
    say('x₁ + x₂ + x₃ = 11 的非負整數解', '每顆球 = 一組解，排成一個三角形平面');
    for (let a = 0; a <= 11; a++) for (let b = 0; a + b <= 11; b++) { const c = 11 - a - b; const p = P(a, b, c); const m = ball('', COL.ball, 0.12, p.x, p.y, p.z); m.userData.x = [a, b, c]; pts.push(m); }
    await w(2400);
    say('共 C(13, 2) = 78 組', '條件：x₁ ≤ 3、x₂ ≤ 4、x₃ ≤ 6');
    await w(2600);
    const bad = [[(x) => x[0] >= 4, 'A₁：x₁ ≥ 4', 'C(9,2) = 36'], [(x) => x[1] >= 5, 'A₂：x₂ ≥ 5', 'C(8,2) = 28'], [(x) => x[2] >= 7, 'A₃：x₃ ≥ 7', 'C(6,2) = 15']];
    const cols = [COL.red, COL.orange, COL.purple];
    for (let i = 0; i < 3; i++) {
      pts.forEach((m) => { if (bad[i][0](m.userData.x)) { tint(m, cols[i]); } });
      say('壞的 ' + bad[i][1], '先放好下限再用星棒法：' + bad[i][2]);
      await w(2400);
    }
    say('兩兩交集要加回來', '|A₁A₂| = C(4,2) = 6，|A₁A₃| = C(2,2) = 1，|A₂A₃| = 0');
    pts.forEach((m) => { const x = m.userData.x; const k = bad.filter((b) => b[0](x)).length; if (k >= 2) glow(m, GOLD); });
    await w(2800);
    say('壞的共 36+28+15−6−1−0+0 = 72', '');
    await w(2000);
    pts.forEach((m) => { if (bad.some((b) => b[0](m.userData.x))) fly(m, V3((Math.random() - 0.5) * 4, 6, 2)); });
    await w(1400);
    pts.forEach((m) => { if (!bad.some((b) => b[0](m.userData.x))) { tint(m, COL.green); glow(m, GREEN); } });
    say('剩下的好解：78 − 72 = 6', '(3,4,4) (3,3,5) (2,4,5) (3,2,6) (2,3,6) (1,4,6)');
    await w(3400);
  }
  async function scDerangement(tok) {
    fresh([0, 6.5, 11], [0, 0.8, 0]);
    const w = (ms) => beat(tok, ms);
    dr.n = 4; dr.ppl = []; dr.hats = [];
    const px = (i) => (i - 1.5) * 1.3 - 3.2;
    for (let i = 0; i < 4; i++) { const p = person(i, px(i)); p.position.z = -2.2; dr.ppl.push(p); }
    const hs = []; for (let i = 0; i < 4; i++) { const h = hat(i); h.position.set(px(i), 1.72, -2.2); lab.addBody(h); hs.push(h); }
    say('4 個人寄放帽子，拿回來全拿錯？', '錯排 D₄：沒有人拿到自己的');
    await w(2400);
    const perm = [1, 0, 3, 2];
    perm.forEach((h, i) => move(hs[h], px(i), 1.72, -2.2));
    say('例：1↔2、3↔4 對調', '這是一種錯排');
    await w(2200);
    const all = []; const rec = (p) => { if (p.length === 4) { all.push(p); return; } for (let i = 0; i < 4; i++) if (!p.includes(i)) rec([...p, i]); }; rec([]);
    const minis = all.map((p, idx) => {
      const g = []; const cx = 0.6 + (idx % 4) * 1.75, cz = -2.6 + Math.floor(idx / 4) * 0.95;
      p.forEach((h, i) => { const m = cube(String(h + 1), PAL[h], [0.36, 0.3, 0.36], cx + (i - 1.5) * 0.4, 0.15, cz); m.userData.lbl.element.style.fontSize = '10px'; if (h === i) glow(m, RED); g.push(m); });
      return { p, g };
    });
    say('全部 4! = 24 種發法；紅框 = 拿到自己的', '');
    await w(2600);
    const terms = [['− C(4,1)·3! = 24', '有人拿到自己的：先扣'], ['+ C(4,2)·2! = 12', '兩人都拿對的被扣兩次 → 加回'], ['− C(4,3)·1! = 4', '再扣三人拿對'], ['+ C(4,4)·0! = 1', '四人全對加回']];
    for (const [f, c] of terms) { say(c, '24 ' + f); await w(1800); }
    minis.forEach(({ p, g }) => { if (p.some((h, i) => h === i)) g.forEach((m) => fly(m, V3(0, 6, 3))); });
    await w(1400);
    say('D₄ = 24 − 24 + 12 − 4 + 1 = 9', 'Dₙ = n!(1 − 1/1! + 1/2! − … + (−1)ⁿ/n!) ≈ n!/e');
    await w(3400);
  }
  async function scOnto(tok) {
    fresh([0, 7, 11], [0, 0.6, 0]);
    const w = (ms) => beat(tok, ms);
    const cx = (b) => (b - 1) * 3.2;
    const cr = [0, 1, 2].map((b) => crate(cx(b), -0.8, 2.6, 1.8, 0.42, PAL[b], ['A', 'B', 'C'][b]));
    const bs = Array.from({ length: 6 }, (_, i) => ball(String(i + 1), '#efe5d3', 0.26, (i - 2.5) * 0.8, 0.26, 2.3));
    say('6 個不同的球放進 3 個不同的箱子，每箱都不空', '= 從 6 元素到 3 元素的映成函數');
    await w(2600);
    const put = (f) => { const cnt = [0, 0, 0]; f.forEach((b, i) => { const p = slotIn(cx(b), -0.8, cnt[b]++, 0.4, 0.34, 0.27); move(bs[i], p.x, p.y, p.z); }); };
    put([0, 1, 2, 0, 1, 1]);
    say('不管空不空：每顆球 3 種選擇', '3⁶ = 729');
    await w(2400);
    for (let b = 0; b < 3; b++) {
      cr[b].userData.mat.color.set('#bbb2a3');
      const oth = [0, 1, 2].filter((x) => x !== b); put([0, 1, 2, 3, 4, 5].map((i) => oth[(i + (i > 2 ? 1 : 0)) % 2]));
      say('箱 ' + 'ABC'[b] + ' 空：球只能去另外 2 箱', '− 2⁶ = 64');
      await w(1700);
      cr[b].userData.mat.color.set(PAL[b]);
    }
    say('兩個箱子同時空：被扣了兩次 → 加回', '+ C(3,2)·1⁶ = 3');
    await w(2400);
    say('onto(6,3) = 3⁶ − C(3,1)2⁶ + C(3,2)1⁶ − C(3,3)0⁶', '729 − 192 + 3 − 0 = 540');
    put([0, 1, 2, 2, 1, 0]);
    await w(3000);
    say('也等於 3!·S(6,3) = 6 × 90', 'onto(m,n) = Σ(−1)ⁱ C(n,i)(n−i)ᵐ');
    await w(3000);
  }
  async function scStirling(tok) {
    fresh([0, 7.5, 10.5], [0, 0.4, 0]);
    const w = (ms) => beat(tok, ms);
    say('{a, b, c, d} 分進 2 個「相同」的箱子，不空', 'S(4,2) = ?');
    await w(2400);
    const parts = [['a', 'bcd'], ['b', 'acd'], ['c', 'abd'], ['d', 'abc'], ['ab', 'cd'], ['ac', 'bd'], ['ad', 'bc']];
    const LC = { a: PAL[0], b: PAL[1], c: PAL[2], d: PAL[3] };
    const pairPos = (i) => [i < 4 ? (i - 1.5) * 3.3 : (i - 5) * 3.3, i < 4 ? -1.6 : 1.4];
    const groups = [];
    for (let i = 0; i < 7; i++) {
      const [px, pz] = pairPos(i);
      const g = { crates: [], balls: [] };
      parts[i].forEach((set, j) => {
        const x = px + (j ? 0.75 : -0.75);
        g.crates.push(crate(x, pz, 1.3, 1.3, 0.35, '#c9a878'));
        set.split('').forEach((ch, k) => { const p = slotIn(x, pz, k, 0.25, 0.32, 0.22); g.balls.push(ball(ch, LC[ch], 0.19, p.x, p.y, p.z, 2.5)); });
      });
      groups.push(g);
      say(i < 4 ? '一個自己一箱，其他三個一箱' : '兩個兩個分', '第 ' + (i + 1) + ' 種：{' + parts[i][0] + '} {' + parts[i][1] + '}');
      await w(i < 4 ? 800 : 1100);
    }
    say('箱子相同 → 只看怎麼分組', 'S(4,2) = 7');
    await w(2600);
    groups.forEach((g) => { g.crates[0].userData.mat.color.set(COL.ball); g.crates[1].userData.mat.color.set(COL.pick); });
    say('箱子改成不同（藍、粉）：每種分組有 2! 種放法', '2!·S(4,2) = 14 = 不空的映成函數');
    await w(2800);
    say('再加上「一箱全空」的 2 種', '14 + 2 = 16 = 2⁴');
    await w(2600);
    say('遞迴：S(n,k) = S(n−1,k−1) + k·S(n−1,k)', 'd 自己一箱 S(3,1) = 1，或加進 2 箱之一 2·S(3,2) = 6 → 7');
    await w(3400);
  }
  async function scDistTable(tok) {
    fresh([0, 9, 9.5], [0, 0, 0.4]);
    const w = (ms) => beat(tok, ms);
    say('4 個物品放進 3 個箱子：先分清楚題型', '物品相不相同？箱子相不相同？可不可以空？');
    await w(2800);
    const Q = [
      [-3.5, -2.3, true, true, '相異物 → 相異箱', '3⁴ = 81（不空 3!·S(4,3) = 36）', [0, 1, 1, 2]],
      [3.5, -2.3, false, true, '相同物 → 相異箱', 'H(3,4) = C(6,4) = 15（不空 C(3,2) = 3）', [0, 0, 1, 2]],
      [-3.5, 2.0, true, false, '相異物 → 相同箱', 'S(4,1)+S(4,2)+S(4,3) = 14（不空 S(4,3) = 6）', [0, 0, 1, 2]],
      [3.5, 2.0, false, false, '相同物 → 相同箱', 'p(4, ≤3 部分) = 4（不空 1：2+1+1）', [0, 0, 1, 2]],
    ];
    for (const [qx, qz, od, bd, title, f, asg] of Q) {
      tag(title, 'ptr', qx, 0.1, qz - 1.25);
      const cnt = [0, 0, 0];
      for (let b = 0; b < 3; b++) crate(qx + (b - 1) * 1.45, qz, 1.25, 1.2, 0.32, bd ? PAL[b] : '#c9a878', bd ? String(b + 1) : '');
      asg.forEach((b, i) => { const p = slotIn(qx + (b - 1) * 1.45, qz, cnt[b]++, 0.24, 0.3, 0.2); ball(od ? 'abcd'[i] : '', od ? PAL[4 + i] : '#f4efe6', 0.18, p.x, p.y, p.z, 2.5); });
      const fl = tag(f, 'ptr alt', qx, 0.1, qz + 1.35);
      say(title, f);
      await w(3000);
      fl.element.style.fontSize = '11px';
    }
    say('最常搞混：H、S、onto 三種', 'H：相同物→相異箱；S：相異物→相同箱；onto：相異物→相異箱不空');
    await w(3600);
  }
  async function scGFCoef(tok) {
    fresh([0, 4.4, 13], [0, 3.4, 0]);
    const w = (ms) => beat(tok, ms);
    say('e₁ + e₂ + e₃ = 17，2≤e₁≤5、3≤e₂≤6、4≤e₃≤7', '每個變數寫成一個括號');
    await w(2800);
    const R = [[2, 5], [3, 6], [4, 7]];
    const sp = 0.7, x0 = -4.5;
    const rows = R.map(([lo, hi], i) => {
      tag('e' + (i + 1), 'ptr', x0 - 1, 7 - i * 0.8, 0);
      const ms = {};
      for (let e = lo; e <= hi; e++) ms[e] = cube('x' + sup(e), PAL[i], [0.62, 0.5, 0.35], x0 + e * sp, 7 - i * 0.8, 0, 2);
      return ms;
    });
    await w(1400);
    say('(x²+x³+x⁴+x⁵)(x³+…+x⁶)(x⁴+…+x⁷)', '每個括號挑一項，指數相加 = 17');
    await w(2600);
    const sols = [[4, 6, 7], [5, 5, 7], [5, 6, 6]];
    for (const s of sols) {
      rows.forEach((r) => Object.values(r).forEach((m) => { glow(m, null); m.position.z = 0; }));
      s.forEach((e, i) => { glow(rows[i][e], GOLD); rows[i][e].position.z = 0.6; });
      say('挑 x' + sup(s[0]) + '·x' + sup(s[1]) + '·x' + sup(s[2]), s.join(' + ') + ' = 17');
      await w(1800);
    }
    const f = (lo, hi) => Array.from({ length: hi + 1 }, (_, e) => (e >= lo ? 1 : 0));
    const prod = polyMul(polyMul(f(2, 5), f(3, 6), 18), f(4, 7), 18);
    const bs = bars(prod.slice(9), -3.2, sp, 2.6, COL.ball, 0.2);
    for (let e = 9; e <= 18; e++) tag('x' + sup(e), 'idx', -3.2 + (e - 9) * sp, 0, 0.7);
    glow(bs[17 - 9], GOLD); tint(bs[17 - 9], COL.gold);
    say('乘開後 x¹⁷ 的係數 = 3', '係數 = 解的個數');
    await w(3400);
  }
  async function scGFCookies(tok) {
    fresh([0, 6.5, 11.5], [0, 1.2, 0]);
    const w = (ms) => beat(tok, ms);
    say('8 塊相同的餅乾分給 3 個小孩', '每人至少 2 塊、最多 4 塊');
    const cx = (b) => (b - 1) * 3;
    [0, 1, 2].forEach((b) => crate(cx(b), -0.5, 2.2, 1.6, 0.4, PAL[b], '小孩 ' + (b + 1)));
    await w(2400);
    say('每個小孩：x² + x³ + x⁴', '(x² + x³ + x⁴)³ 中 x⁸ 的係數');
    await w(2600);
    const ways = [[2, 2, 4], [2, 4, 2], [4, 2, 2], [2, 3, 3], [3, 2, 3], [3, 3, 2]];
    let cookies = [];
    for (let k = 0; k < ways.length; k++) {
      cookies.forEach(kill); cookies = [];
      ways[k].forEach((n, b) => { for (let i = 0; i < n; i++) { const p = slotIn(cx(b), -0.5, i, 0.4, 0.26, 0.2); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18), new THREE.MeshStandardMaterial({ color: '#c8935a' })); m.position.set(p.x, p.y + 2, p.z); m.castShadow = true; lab.dropTo(lab.addBody(m), p); cookies.push(m); } });
      tag(ways[k].join('+'), 'ptr alt', -5.4 + k * 2.15, 3.6, -2);
      say('第 ' + (k + 1) + ' 種：' + ways[k].join(' + '), 'x' + sup(ways[k][0]) + '·x' + sup(ways[k][1]) + '·x' + sup(ways[k][2]) + ' = x⁸');
      await w(1300);
    }
    say('x⁸ 的係數 = 6', '(x²+x³+x⁴)³ = x⁶(1+x+x²)³ → 看 x² 的係數 = 6');
    await w(3400);
  }
  async function scGFClosed(tok) {
    fresh([0, 4.4, 13], [0, 3.2, 0]);
    const w = (ms) => beat(tok, ms);
    const sp = 0.85, x0 = -3.8, N = 9;
    for (let e = 0; e < N; e++) tag('x' + sup(e), 'idx', x0 + e * sp, 0, 0.7);
    say('1/(1−x) = 1 + x + x² + x³ + …', '每個係數都是 1：一種東西可以拿任意個');
    let bs = bars(Array(N).fill(1), x0, sp, 0.6, COL.ball, 0.05, -1.5);
    tag('1/(1−x)', 'ptr', x0 - 1.3, 0.4, -1.5);
    await w(3000);
    let cur = Array(N).fill(1);
    const rowsZ = [0, 1.5];
    for (let k = 2; k <= 3; k++) {
      cur = polyMul(cur, Array(N).fill(1), N - 1);
      bars(cur, x0, sp, k === 2 ? 1.6 : 3.4, k === 2 ? COL.purple : COL.gold, 0.05, rowsZ[k - 2]);
      tag('1/(1−x)' + sup(k), 'ptr', x0 - 1.3, 0.4, rowsZ[k - 2]);
      say('1/(1−x)' + sup(k) + '：係數 ' + cur.slice(0, 6).join(', ') + ' …', k === 2 ? 'xʳ 的係數 = r + 1 = C(r+1, 1)' : 'xʳ 的係數 = C(r+2, 2)');
      await w(3000);
    }
    say('1/(1−x)ⁿ 的 xʳ 係數 = C(n+r−1, r)', '就是星棒法：n 種東西可重複拿 r 個');
    await w(3400);
  }
  async function scPartitions(tok) {
    fresh([0, 3.8, 13], [0, 2.6, 0]);
    const w = (ms) => beat(tok, ms);
    say('整數分割：5 寫成正整數之和，不計順序', 'p(5) = ?');
    await w(2400);
    const P5 = [[5], [4, 1], [3, 2], [3, 1, 1], [2, 2, 1], [2, 1, 1, 1], [1, 1, 1, 1, 1]];
    const cs = 0.3;
    const diagrams = [];
    for (let k = 0; k < 7; k++) {
      const ox = -5.6 + k * 1.85, ms = [];
      P5[k].forEach((len, r) => { for (let c = 0; c < len; c++) ms.push({ m: cube('', PAL[r % 8], [cs * 0.9, cs * 0.9, cs * 0.9], ox + c * cs, 4.2 - r * cs, 0, 2), r, c }); });
      tag(P5[k].join('+'), 'idx', ox + 0.6, 2.4, 0);
      diagrams.push({ ox, ms });
      await w(650);
    }
    say('Ferrers 圖：每一列 = 一個部分', 'p(5) = 7');
    await w(2800);
    const d = diagrams[1];
    say('把 4+1 沿對角線翻轉（共軛）', '列 ↔ 行');
    await w(1600);
    d.ms.forEach(({ m, r, c }) => move(m, d.ox + r * cs, 4.2 - c * cs, 0));
    await w(1400);
    say('4+1 翻成 2+1+1+1', '「最多 k 個部分」↔「每部分 ≤ k」：個數相同');
    await w(3400);
  }
  async function scCatalanPaths(tok) {
    fresh([0, 9, 7.5], [0, 0, -0.3]);
    const w = (ms) => beat(tok, ms);
    const G = ctGrid(3);
    say('(0,0) 走到 (3,3)，不能走到 y = x 的上方', '只能往東 E、往北 N');
    await w(2600);
    const all = dyckWords(3);
    let segs = [];
    for (let k = 0; k < all.length; k++) {
      segs.forEach(kill);
      segs = ctDraw(G, all[k], PAL[k]);
      say('第 ' + (k + 1) + ' 條：' + all[k], '');
      await w(1500);
    }
    say('只有 5 條：C₃ = 5', '全部路徑 C(6,3) = 20，大多數都越線了');
    await w(2800);
    say('Catalan 數：1, 1, 2, 5, 14, 42, …', 'Cₙ = C(2n,n)/(n+1)；也數括號配對、二元樹個數');
    await w(3200);
  }
  async function scCatalanReflect(tok) {
    fresh([0, 9, 7.5], [0, 0, -0.3]);
    const w = (ms) => beat(tok, ms);
    const G = ctGrid(3);
    say('壞路徑：某一步碰到 y = x + 1', '例：E N N E E N');
    await w(2200);
    ctDraw(G, 'ENNEEN', COL.red);
    await w(1400);
    const hit = G.P(1, 2); ball('', COL.gold, 0.2, hit.x, 0.3, hit.z);
    say('第一次碰到紅線：(1, 2)', '');
    await w(2000);
    ctDraw(G, 'ENNNNE', COL.gold, 0.28);
    say('之後每一步 E↔N 對調（對紅線反射）', '終點變成 (2, 4) = (n−1, n+1)');
    await w(3000);
    say('壞路徑 ↔ 到 (2,4) 的路徑：一一對應', '壞的 = C(6, 2) = 15');
    await w(2800);
    say('好的 = 20 − 15 = 5', 'Cₙ = C(2n,n) − C(2n,n+1) = C(2n,n)/(n+1)');
    await w(3200);
  }
  async function scBurnside(tok) {
    fresh([0, 10, 7.5], [0.4, 0, 0.3]);
    const w = (ms) => beat(tok, ms);
    bn.n = 4; bn.k = 2;
    const L = bnLayout(4, 2);
    const big = necklace('0011', -5.1, 0.3, -0.5, 1.1, 0.22);
    const minis = L.cols.map((s, i) => { const [x, z] = L.pos(i); return necklace(s, x, 0.15, z, L.R, L.br); });
    say('4 顆珠子、黑白兩色：2⁴ = 16 種著色', '但旋轉後一樣的算同一條項鍊');
    await w(2800);
    const rows = [[0, '不轉：16 條全都不變', '固定 2⁴ = 16'], [1, '轉 90°：只有全黑、全白不變', '1 個循環 (1234) → 2¹ = 2'], [2, '轉 180°：位置 1↔3、2↔4', '2 個循環 (13)(24) → 2² = 4'], [3, '轉 270°：跟 90° 一樣', '2¹ = 2']];
    for (const [r, c, f] of rows) {
      const a0 = big.rotation.y;
      await tween(w, 700, (t) => { big.rotation.y = a0 + t * Math.PI / 2 * (r ? 1 : 0); });
      minis.forEach((g) => lightMini(g, rotStr(g.userData.s, r) === g.userData.s, '#c08a1f'));
      say(c, f);
      await w(2500);
    }
    say('Burnside：平均固定數 = 軌道數', '(16 + 2 + 4 + 2) / 4 = 6');
    await w(2600);
    const orbs = {}; minis.forEach((g) => { const c = canon(g.userData.s); (orbs[c] = orbs[c] || []).push(g); });
    Object.keys(orbs).sort().forEach((k, ri) => orbs[k].forEach((g, j) => { lightMini(g, true, PAL[ri]); move(g, -0.6 + j * 1.45, 0.15, (ri - 2.5) * 1.2); }));
    say('互轉得到的排在同一列：剛好 6 列', '6 種不同的項鍊');
    await w(3000);
    say('Pólya：k 色時，轉 r 格固定 k^(循環數)', '(k⁴ + k + k² + k) / 4');
    await w(3200);
  }

  const scenes = {
    'ie-two-sets': { title: '排容原理：|A∪B| = |A| + |B| − |A∩B|', play: scIETwo },
    'ie-three-sets': { title: '三個集合：1～100 中 2、3、5 的倍數 = 74', play: scIEThree },
    'ie-upper-bound': { title: '有上限的整數解：78 − 72 = 6', play: scIEUpper },
    'derangement-hats': { title: '帽子錯排：D₄ = 9', play: scDerangement },
    'onto-functions': { title: '映成函數：3⁶ − 3·2⁶ + 3·1⁶ = 540', play: scOnto },
    'stirling-s42': { title: '第二類 Stirling 數：S(4,2) = 7', play: scStirling },
    'distribution-table': { title: '物品放箱子的四種情況', play: scDistTable },
    'gf-coefficient': { title: '生成函數：x¹⁷ 的係數 = 解的個數', play: scGFCoef },
    'gf-cookies': { title: '8 塊餅乾分 3 人（各 2～4 塊）：6 種', play: scGFCookies },
    'gf-closed-form': { title: '1/(1−x)ⁿ 的係數 = C(n+r−1, r)', play: scGFClosed },
    'partition-ferrers': { title: '整數分割 p(5) = 7 與 Ferrers 圖', play: scPartitions },
    'catalan-paths': { title: 'Catalan 數：不越過對角線的路徑 C₃ = 5', play: scCatalanPaths },
    'catalan-reflection': { title: '反射原理：壞路徑 = C(2n, n+1)', play: scCatalanReflect },
    'burnside-necklace': { title: 'Burnside 引理：4 珠 2 色項鍊 = 6', play: scBurnside },
  };

  return {
    kicker: '離散數學・第 6 章',
    title: '進階計數：排容、生成函數、Burnside',
    color: 'var(--dm)',
    modes: [
      { id: 'venn', name: '排容原理', enter: enterVenn },
      { id: 'derange', name: '錯排', enter: enterDerange },
      { id: 'boxes', name: '物品放箱子', enter: enterBoxes },
      { id: 'genfunc', name: '生成函數', enter: enterGF },
      { id: 'catalan', name: 'Catalan 路徑', enter: enterCatalan },
      { id: 'burnside', name: 'Burnside 項鍊', enter: enterBurnside },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'ie-two-sets', 'ie-three-sets', 'ie-upper-bound', 'derangement-hats', 'onto-functions',
      'stirling-s42', 'distribution-table',
      'gf-closed-form', 'gf-coefficient', 'gf-cookies', 'partition-ferrers',
      'catalan-paths', 'catalan-reflection', 'burnside-necklace',
    ],
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
