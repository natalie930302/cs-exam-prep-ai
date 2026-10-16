// 離散數學 第6章：進階計數（排容原理、錯排、映成函數與 Stirling 數、物品放箱子四種情況、生成函數、整數分割、Catalan 數、Burnside／Pólya）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
//
// 本章影片（易志偉 Lec16–19、趙啟超 第10–11、14–17講、Inclusion-Exclusion）目前都沒有逐字稿，
// 所以場景全部依課本（Rosen 第 6、8 章；Grimaldi 第 8–10 章）的經典例題：
//   1..100 中 2、3、5 的倍數（74）、x1+x2+x3 = 11 有上限（6 組）、帽子錯排 D4 = 9、6 → 3 的映成函數 540、
//   S(4,2) = 7、e1+e2+e3 = 17 的生成函數係數（3）、8 塊餅乾分給 3 個小孩各 2～4 塊（6）、p(5) = 7、C3 = 5、
//   4 顆珠子 2 色項鍊（6）。
// 記號：S(n,k) 第二類 Stirling 數；H(n,r) = C(n+r−1, r)（n 種東西可重複取 r 個）；onto(m,n) = n!·S(m,n)。
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
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
        set.split('').forEach((ch, k) => { const p = slotIn(x, pz, k, 0.25, 0.32, 0.22); g.balls.push(ball('', LC[ch], 0.19, p.x, p.y, p.z, 2.5)); });
        tag(set.split('').join(' '), 'val', x, 0.1, pz + 0.85); // one name per crate (letters on the balls would sit on each other)
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ acA.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 6 章 Advanced Counting（交大 易志偉 Lec16–Lec19、The Principle of Inclusion-Exclusion）— cued scenes ───
// 遞迴關係式、河內塔、線性齊次常係數遞迴（特徵方程式、重根）、非齊次（特殊解）、生成函數（計數、解遞迴）、
// 排容原理（兩個／三個集合、onto 函數、derangement）與關係（relation）的定義與性質。
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 老師的例子與數字照用；畫面上的數字都由程式從遞迴式／公式／暴力列舉各算一次（不相等會顯示 ✘）。
// 老師沒給、為了看清楚而加的例子在台上標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pl = (t, x, y, z = 0) => tag(t, '', x, y, z);
const C = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#c08a1f', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8', rose: '#f6d0dc', lemon: '#f7ecb5', yellow: '#f3d36b' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const ww = (t) => Math.min(12.4, Math.max(1.4, [...String(t)].length * 0.2 + 0.9));
const card = (t, c, x, y, w, h = 0.55) => cube(t, c, [w || ww(t), h, 0.8], x, y, 0, 1.0);
const tile = (t, c, x, y, s = 0.7) => cube(t, c, [s, s, 0.5], x, y, 0, 0);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.ls && o.add) return gone(o.ls); if (o.g && o.set) return kill(o.g); if (o.element) remove(o); else kill(o); });
const relab = (m, t) => { if (m && m.userData.lbl) txt(m.userData.lbl, String(t)); };
const lit = (m, c = HL) => { if (m && m.material) glow(m, c); };
const dark = (...ms) => ms.flat().forEach((m) => { if (m && m.material) glow(m, null); });
const SUBM = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', n: 'ₙ', k: 'ₖ' };
const SUPM = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', k: 'ᵏ' };
const sub = (s) => String(s).split('').map((c) => SUBM[c] || c).join('');
const sup = (s) => String(s).split('').map((c) => SUPM[c] || c).join('');
// number → short text: integers, simple fractions, else 3 decimals; minus sign as −
function fmt(v) {
  if (!isFinite(v)) return '∞';
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-9) return (r < 0 ? '−' : '') + Math.abs(r);
  for (let d = 2; d <= 64; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) return (n < 0 ? '−' : '') + Math.abs(n) + '/' + d; }
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const Cb = (n, r) => { if (r < 0) return 0; let v = 1; for (let i = 0; i < r; i++) v = v * (n - i) / (i + 1); return Math.round(v * 1e6) / 1e6; };  // works for negative n too
// a sequence from a recurrence: a[n0..] = init, then a[n] = f(a, n) up to nMax
function seq(n0, init, f, nMax) { const a = {}; init.forEach((v, i) => { a[n0 + i] = v; }); for (let n = n0 + init.length; n <= nMax; n++) a[n] = f(a, n); return a; }
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4, 15], [0, 3.2, 0]];
// derivation lines top → down; the newest one glows
function chain(x, yTop, dy = 0.72, w) {
  const ls = [];
  return { ls, add(e, c, ww2) { ls.forEach((m) => glow(m, null)); const m = card(e, c || C.sky, x, yTop - ls.length * dy, ww2 || w); glow(m, HL); ls.push(m); return m; } };
}
// compare two rows (recurrence values vs formula values) for n in ns; ✓ when equal
function cmp(ns, A, B, x0, y, nameA, nameB, dx = 0.9) {
  const all = [];
  all.push(sm(nameA, x0 - 1.6, y), sm(nameB, x0 - 1.6, y - 0.75), sm('n', x0 - 1.6, y + 0.6));
  ns.forEach((n, i) => {
    const x = x0 + i * dx;
    all.push(sm(String(n), x, y + 0.6));
    all.push(tile(fmt(A[n]), C.sky, x, y, 0.62), tile(fmt(B[n]), C.mint, x, y - 0.75, 0.62));
    all.push(Math.abs(A[n] - B[n]) < 1e-6 ? good('✓', x, y - 1.35) : bad('✘', x, y - 1.35));
  });
  return all;
}
// in a vertical plane: a circle (Venn diagram)
function ring(cx, cy, r, color = '#8a7a60', z = 0) {
  const pts = []; for (let k = 0; k <= 72; k++) { const a = (Math.PI * 2 * k) / 72; pts.push(V3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
// a flat filled disc behind a circle (to tint a Venn region roughly)
function disc(cx, cy, r, color, op = 0.18) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  m.position.set(cx, cy, -0.05); lab.world.add(m); return m;
}
async function moveTo(tok, o, x, y, ms = 700, arc = 0.6) {
  const a = o.position.clone();
  await anim(tok, ms, (u) => { o.position.x = a.x + (x - a.x) * u; o.position.y = a.y + (y - a.y) * u + Math.sin(Math.PI * u) * arc; });
}
async function moveAll(tok, list, ms = 800, arc = 0.5) {
  const from = list.map(([o]) => o.position.clone());
  await anim(tok, ms, (u) => list.forEach(([o, x, y], i) => { o.position.x = from[i].x + (x - from[i].x) * u; o.position.y = from[i].y + (y - from[i].y) * u + Math.sin(Math.PI * u) * arc; }));
}

// ════════ filS0k_GTvY（易志偉 Lec16：遞迴關係式、河內塔、線性齊次常係數遞迴） ════════
scene('acA-16-intro', 'Lec16：第七章要教的事', [
  async (tok, S) => { // 7.0
    hot('第七章：Advanced Counting Techniques', 0, 6.6);
    S.r = card('遞迴關係式（recurrence relation）', C.sky, 0, 5.4); lit(S.r);
    cap('第七章：遞迴關係式', '上次講過什麼叫遞迴式');
  },
  async (tok, S) => { // 36.1
    dark(S.r);
    S.q = card('寫出式子還不夠 → 要算出答案', C.lemon, 0, 4.3); lit(S.q);
    cap('不只寫出式子，要算出答案', '給你遞迴式，請你算出 aₙ');
  },
  async (tok, S) => { // 52.4
    dark(S.q);
    card('方法 ①', C.mint, -2.2, 3.0, 2.4); card('方法 ②', C.lilac, 2.2, 3.0, 2.4);
    note('考試一定考（會把那一題準備好）', 0, 1.9);
    cap('基本上兩個方法', '考試一定考');
  },
]);

scene('acA-16-sol', 'Lec16：什麼叫遞迴關係式的「解」', [
  async (tok, S) => { // 76.2
    S.R = card('aₙ = 2aₙ₋₁ − aₙ₋₂', C.sky, 0, 6.2, 4.6); lit(S.R);
    hot('recurrence relation（RR）', 0, 7.1);
    cap('這是一個遞迴關係式', 'recurrence relation，有時縮寫 RR');
  },
  async (tok, S) => { // 86.3
    S.st = [];
    for (let n = 0; n <= 5; n++) { S.st.push(tile('a' + sub(n), C.gray, -3 + n * 1.2, 4.9, 0.8)); }
    S.ar = arrow(V3(-0.6, 4.3, 0), V3(0.6, 4.3, 0), 0x6e5f49);
    sm('每一項由前面的項算出來', 0, 3.9);
    cap('它是一個數列', '後面的項根據前面的項寫下來');
  },
  async (tok, S) => { // 97.3
    S.g = card('猜：aₙ = 3n', C.lemon, -3.4, 3.0, 2.8); lit(S.g);
    cap('假設這個數列是 aₙ = 3n', '代進去，符合就說它是答案');
  },
  async (tok, S) => { // 114.3
    dark(S.g);
    S.c = chain(1.4, 3.0, 0.68, 6.4);
    S.c.add('左式：aₙ = 3n');
    cap('第一件事：代進去檢查', '左式已經有了，就是 3n');
  },
  async (tok, S) => { // 126.9
    S.c.add('右式：2aₙ₋₁ − aₙ₋₂');
    cap('右式是 2aₙ₋₁ − aₙ₋₂', '');
  },
  async (tok, S) => { // 136.4
    S.c.add('= 2·3(n − 1) − 3(n − 2)');
    cap('aₙ₋₁ = 3(n − 1)，aₙ₋₂ = 3(n − 2)', '照公式代進去');
  },
  async (tok, S) => { // 145.0
    const m = S.c.add('= 6n − 6 − 3n + 6 = 3n ✓', C.mint); glow(m, OKG);
    const A = seq(0, [0, 3], (a, n) => 2 * a[n - 1] - a[n - 2], 5);
    S.st.forEach((t, n) => { relab(t, fmt(A[n])); t.material.color.set(C.mint); });
    cap('左式 = 右式 → 3n 是一個解', '數列 0, 3, 6, 9, … 確實滿足');
  },
  async (tok, S) => { // 172.6
    gone(S.c.ls); S.c = chain(1.4, 3.0, 0.68, 6.4);
    S.c.add('再猜：aₙ = 2ⁿ', C.lemon);
    cap('那 2ⁿ 是不是答案？', '一樣代進去看看');
  },
  async (tok, S) => { // 180.0
    S.c.add('右式 = 2·2ⁿ⁻¹ − 2ⁿ⁻² = 2ⁿ − 2ⁿ⁻²');
    const m = S.c.add('≠ 2ⁿ ✘', C.rose); glow(m, NG);
    cap('算出來不等於 2ⁿ', '所以 2ⁿ 不是這個遞迴式的解');
  },
  async (tok, S) => { // 199.4
    note('遞迴式的「解」= 一個數列', 0, 0.6);
    cap('遞迴式的解，其實是一個數列', '');
  },
  async (tok, S) => { // 210.4
    const m = card('aₙ = 3n ← closed form（直接一個公式）', C.mint, 0, -0.3, 6.8); glow(m, OKG);
    cap('直接一個公式：closed form', '把 n 代進去就是答案');
  },
]);

scene('acA-16-interest', 'Lec16：複利與 Fibonacci，用觀察猜答案', [
  async (tok, S) => { // 220.2
    hot('先用歸納（觀察）來看', 0, 6.8);
    cap('先用歸納法來看', '');
  },
  async (tok, S) => { // 227.2
    S.c = chain(0, 6.0, 0.7, 6.4);
    S.c.add('Pₙ = Pₙ₋₁ + p·Pₙ₋₁');
    sm('p：一個倍率（常數）', 3.9, 5.5);
    cap('Pₙ = Pₙ₋₁ 加上 p 倍的 Pₙ₋₁', 'p 是一個常數倍率');
  },
  async (tok, S) => { // 241.1
    S.bank = prop('warehouse', -5.2, 2.6, 0, 0.7, '銀行');
    cap('這其實就是複利', 'P 是錢，p 是利率');
  },
  async (tok, S) => { // 254.1
    S.money = buddy('本金', 'P', C.yellow, -2.6, 2.4, 0, 0.8);
    cap('定存：下個月的本利和', '= 這個月本金 + 這個月利息');
  },
  async (tok, S) => { // 269.0
    S.money.set('P + pP'); S.money.mood('happy'); await S.money.hop(tok);
    cap('利息加到本金，再算下個月', '錢滾錢');
  },
  async (tok, S) => { // 279.0
    S.f = [2, 3, 5, 8].map((v, i) => tile(String(v), C.peach, 1.4 + i * 1.0, 2.6, 0.75));
    sm('兔子：2 → 3 → 5 → 8（Fibonacci）', 2.9, 1.8);
    cap('Fibonacci 數列：養兔子', '2 隻、3 隻、5 隻、8 隻');
  },
  async (tok, S) => { // 297.7
    gone(S.f, S.bank, S.money);
    note('沒有工具時：用歸納、用觀察', 0, 2.7);
    cap('沒有工具時，最會用歸納、觀察', '');
  },
  async (tok, S) => { // 309.3
    S.c.add('Pₙ = (1 + p)·Pₙ₋₁');
    cap('把 Pₙ₋₁ 提出來', '變成 (1 + p) 乘 Pₙ₋₁');
  },
  async (tok, S) => { // 321.0
    S.c.add('令 R = 1 + p：Pₙ = R·Pₙ₋₁', C.lilac);
    cap('等一下會一直乘，叫它 R', '');
  },
  async (tok, S) => { // 334.3
    S.c.add('= R·(R·Pₙ₋₂) = R²·Pₙ₋₂');
    cap('Pₙ₋₁ 又是 R 乘 Pₙ₋₂', '變成 R 平方');
  },
  async (tok, S) => { // 340.5
    S.c.add('= R³·Pₙ₋₃ = ⋯');
    cap('一直乘下去：R³ Pₙ₋₃', '差三項就是三次方');
  },
  async (tok, S) => { // 346.0
    const m = S.c.add('= Rⁿ·P₀ = (1 + p)ⁿ·P₀', C.mint); glow(m, OKG);
    cap('差 n 項就是 n 次方：Rⁿ P₀', '歸納出來的 closed form');
  },
  async (tok, S) => { // 368.0
    note('答案是指數函式！', 0, 1.0);
    cap('注意：這是指數函式', '等一下猜答案會用到');
  },
]);

// 河內塔：三根柱子、五個盤子
const PEGX = [-4, 0, 4];
function hanoi(nd, y0 = 0.3) {
  const all = [];
  all.push(cube('', '#c9bba3', [12, 0.2, 2.2], 0, y0 - 0.15, 0));
  PEGX.forEach((x, i) => { all.push(cube('', '#a99470', [0.16, 3.2, 0.16], x, y0 + 1.6, 0)); all.push(sm('柱 ' + (i + 1), x, y0 - 0.6)); });
  const discs = [];
  for (let k = nd; k >= 1; k--) { const m = cube(String(k), ['#e55a9b', '#dd8238', '#c08a1f', '#2fc092', '#4b9ee2', '#9b7ef4'][k - 1], [0.8 + k * 0.55, 0.36, 1.2], PEGX[0], y0 + 0.18 + (nd - k) * 0.38, 0); discs[k] = m; }
  return { all, discs, y0 };
}
scene('acA-16-hanoi', 'Lec16：河內塔（Tower of Hanoi）的遞迴想法', [
  async (tok, S) => { // 376.1
    S.H = hanoi(5); hot('河內塔（Tower of Hanoi）', 0, 6.6);
    cap('再來看河內塔', '可以簡單講，也可以複雜講');
  },
  async (tok, S) => { // 388.3
    S.k = buddy('國王', '?', C.gold, -5.6, 3.6, 0, 0.7);
    bub('答對娶公主，答錯變青蛙', -3.4, 5.6);
    cap('故事：國王嫁女兒要出數學題', '');
  },
  async (tok, S) => { // 403.0
    S.H.discs.forEach((d) => d && lit(d)); await wt(tok, 500); S.H.discs.forEach((d) => d && glow(d, null));
    cap('盤子由大到小疊在第一根柱子', '');
  },
  async (tok, S) => { // 410.6
    S.goal = arrow(V3(-4, 4.2, 0), V3(-0.3, 4.2, 0), 0xc08a1f); sm('目標：整疊搬到柱 2', -2, 4.6);
    cap('要把整疊搬到另一根柱子', '');
  },
  async (tok, S) => { // 415.0
    S.r1 = note('規則 ①：一次只能搬一個', 3.8, 5.6);
    cap('規則一：一次只能搬一個', '盤子可能是黃金做的，很重');
  },
  async (tok, S) => { // 435.0
    S.r2 = note('規則 ②：小的只能放在大的上面', 3.8, 4.9);
    cap('規則二：小的只能放在大的上面', '大的永遠在底下');
  },
  async (tok, S) => { // 453.0
    S.k.mood('wow'); S.k.set('幾次?');
    cap('最聰明的人要搬幾次？', '笨方法可能搬一千次都搬不完');
  },
  async (tok, S) => { // 483.4
    gone(S.goal); S.k.mood('calm');
    S.t = note('遞迴想法：大問題先解決一點點', 0, 6.0);
    cap('不真的去搬，用遞迴的想法', '大問題先解決一點點，其他如法炮製');
  },
  async (tok, S) => { // 552.5
    const D = S.H.discs, y0 = S.H.y0;
    const top = [1, 2, 3, 4].map((k) => D[k]); top.forEach((m) => lit(m));
    S.l1 = hot('① 上面 4 個 → 柱 3', 4, 4.3);
    await moveAll(tok, top.map((m, i) => [m, PEGX[2], y0 + 0.18 + (3 - (i)) * 0.38]), 1400, 1.6);
    cap('先假設：上面 1234 四個搬到柱 3', '經過很複雜的方法，總之搬得到');
  },
  async (tok, S) => { // 567.0
    const D = S.H.discs; [1, 2, 3, 4].forEach((k) => glow(D[k], null)); lit(D[5]);
    S.l2 = hot('② 最大的 → 柱 2', 0, 3.6);
    await moveTo(tok, D[5], PEGX[1], S.H.y0 + 0.18, 1000, 2.0);
    cap('再把最底下那個搬到柱 2', '只要搬一次');
  },
  async (tok, S) => { // 578.2
    const D = S.H.discs, y0 = S.H.y0; glow(D[5], null);
    const top = [1, 2, 3, 4].map((k) => D[k]); top.forEach((m) => lit(m));
    S.l3 = hot('③ 4 個 → 柱 2', 0, 4.9);
    await moveAll(tok, top.map((m, i) => [m, PEGX[1], y0 + 0.18 + (4 - i) * 0.38]), 1400, 1.6);
    top.forEach((m) => glow(m, null));
    cap('再把那四個搬回來疊上去', '工作完成');
  },
  async (tok, S) => { // 587.7
    gone(S.l1, S.l2, S.l3);
    note('那 4 個怎麼搬？一樣：先搬上面 3 個，再搬底下那個', 0, 5.3);
    cap('中間四個怎麼搬？用同樣的方法', '先搬上面三個，再搬底下那個');
  },
  async (tok, S) => { // 603.3
    bad('不能顛倒：先搬底下那個會壓在小的上面', 0, 4.7);
    cap('為什麼不能顛倒？', '最大的要最後放，才永遠在底下');
  },
  async (tok, S) => { // 625.6
    gone(S.H.all, S.H.discs.filter(Boolean), S.k); S.H = null;
    S.c = chain(0, 3.4, 0.75, 6.2);
    S.c.add('Hₙ = 搬 n 個盤子需要的次數', C.lilac);
    cap('寫成遞迴關係式', 'Hₙ：搬 n 個要幾次');
  },
  async (tok, S) => { // 637.4
    S.p1 = card('Hₙ₋₁', C.sky, -3, 1.5, 1.8); lit(S.p1); sm('先搬上面 n − 1 個', -3, 0.8);
    cap('第一步：Hₙ₋₁ 次，搬走上面 n − 1 個', '');
  },
  async (tok, S) => { // 651.0
    S.p2 = card('+ 1', C.peach, 0, 1.5, 1.4); lit(S.p2); sm('搬最底下那個', 0, 0.8);
    cap('再搬最底下那一個：1 次', '');
  },
  async (tok, S) => { // 660.7
    S.p3 = card('+ Hₙ₋₁', C.sky, 3, 1.5, 1.8); lit(S.p3); sm('再把 n − 1 個搬回來', 3, 0.8);
    cap('最後把 n − 1 個搬回來：Hₙ₋₁ 次', '');
  },
  async (tok, S) => { // 669.0
    dark(S.p1, S.p2, S.p3);
    const m = card('Hₙ = 2Hₙ₋₁ + 1', C.mint, 0, -0.1, 4.0); glow(m, OKG);
    cap('河內塔的遞迴關係式：Hₙ = 2Hₙ₋₁ + 1', '寫程式也是這樣寫');
  },
]);

scene('acA-16-hsolve', 'Lec16：代入法算出 Hₙ = 2ⁿ − 1', [
  async (tok, S) => { // 701.1
    hot('Hₙ 到底要搬幾次？', 0, 6.8);
    S.c = chain(0, 6.0, 0.66, 7.6);
    cap('知道式子之後：Hₙ 到底幾次？', '');
  },
  async (tok, S) => { // 712.3
    S.c.add('Hₙ = 2Hₙ₋₁ + 1');
    cap('用代入法', 'Hₙ 是兩倍 Hₙ₋₁ 加 1');
  },
  async (tok, S) => { // 716.4
    S.c.add('= 2(2Hₙ₋₂ + 1) + 1 = 2²Hₙ₋₂ + 2 + 1');
    cap('Hₙ₋₁ 換成 2Hₙ₋₂ + 1', '乘開：2² Hₙ₋₂ + 2 + 1');
  },
  async (tok, S) => { // 729.0
    S.c.add('= 2³Hₙ₋₃ + 2² + 2 + 1');
    cap('再把 Hₙ₋₂ 換掉', '2³ Hₙ₋₃ + 2² + 2¹ + 2⁰');
  },
  async (tok, S) => { // 744.4
    S.c.add('= 2ⁿ⁻¹H₁ + 2ⁿ⁻² + ⋯ + 2 + 1');
    cap('看出規律，一次寫到底', 'Hₙ₋₃ 的 3 換成 n − 1 → 2ⁿ⁻¹ H₁');
  },
  async (tok, S) => { // 765.7
    sm('後面是等比級數', 4.6, 3.1);
    cap('加起來又是一個等比級數', '');
  },
  async (tok, S) => { // 770.3
    S.c.add('H₁ = 1（一個盤子直接搬過去）', C.lemon);
    cap('H₁ 是多少？一個盤子搬一次', 'H₁ = 1');
  },
  async (tok, S) => { // 779.0
    const m = S.c.add('Hₙ = 2ⁿ⁻¹ + ⋯ + 2 + 1 = 2ⁿ − 1', C.mint); glow(m, OKG);
    cap('答案：Hₙ = 2ⁿ − 1', '');
  },
  async (tok, S) => { // 786.3
    const A = seq(1, [1], (a, n) => 2 * a[n - 1] + 1, 7), B = {}; for (let n = 1; n <= 7; n++) B[n] = 2 ** n - 1;
    S.t = cmp([1, 2, 3, 4, 5, 6, 7], A, B, -1.6, 1.6, '遞迴', '2ⁿ − 1');
    cap('5 個 31 次、6 個 63 次、7 個 127 次', '遞迴算的和公式算的一樣 ✓');
  },
  async (tok, S) => { // 796.1
    note('幾乎每多一個就兩倍 → 指數成長', 3.7, 0.4);
    cap('幾乎兩倍兩倍一直成長', '指數成長，不要被騙了');
  },
  async (tok, S) => { // 803.6
    card('10 個：2¹⁰ − 1 = 1023', C.peach, -3.2, -0.6, 4.0);
    card('20 個：2²⁰ − 1 = 1048575 ≈ 10⁶', C.rose, 2.6, -0.6, 5.2);
    cap('10 個要 1023 次', '20 個將近 10⁶ 次');
  },
  async (tok, S) => { // 813.6
    note('很多問題都會產生遞迴關係式 → 要會算答案', 0, 7.4);
    cap('各式各樣的問題都會產生遞迴式', '表面簡單，實際不容易 → 用理論來處理');
  },
]);

scene('acA-16-lhrr', 'Lec16：線性齊次常係數遞迴關係式', [
  async (tok, S) => { // 836.0
    hot('7-1 講完，重點是 7-2', 0, 6.8);
    cap('7-1 講完了，重點是 7-2', '');
  },
  async (tok, S) => { // 843.7
    S.F = card('aₙ = c₁aₙ₋₁ + c₂aₙ₋₂ + ⋯ + cₖaₙ₋ₖ', C.sky, 0, 5.8, 7.6); lit(S.F);
    cap('很常看到的形狀', '前 k 項各乘一個數字加起來');
  },
  async (tok, S) => { // 862.0
    sm('河內塔：前一項 ×2 再加東西；複利：前一項 ×R', 0, 5.1);
    cap('河內塔、利率其實也是這種', '前一項乘一個倍數');
  },
  async (tok, S) => { // 882.0
    note('有什麼好方法算？→ 開始用「猜」的', 0, 4.4);
    cap('有沒有好方法算出來？', '我們開始用猜的');
  },
  async (tok, S) => { // 895.0
    dark(S.F);
    S.w = ['linear', 'homogeneous', 'recurrence relation', 'constant coefficients'].map((t, i) => { const m = card(t, [C.mint, C.lilac, C.gray, C.peach][i], -4.2 + i * 2.9, 3.3, 2.7, 0.5); return m; });
    sm('線性', -4.2, 2.7); sm('齊次', -1.3, 2.7); sm('遞迴', 1.6, 2.7); sm('常係數', 4.5, 2.7);
    cap('先給一個名詞（縮寫 LHRRCC）', 'linear homogeneous recurrence relation with constant coefficients');
  },
  async (tok, S) => { // 928.7
    lit(S.w[0]);
    S.l = chain(0, 1.9, 0.66, 7.2);
    S.l.add('線性：只有一次項；不能平方、不能相乘、不能開根號', C.mint);
    cap('什麼叫線性？', '不能有二次項、不能相乘、不能開根號');
  },
  async (tok, S) => { // 958.3
    dark(S.w); lit(S.w[1]);
    S.l.add('齊次：沒有常數項（後面不能多放東西）', C.lilac);
    cap('什麼叫齊次？沒有常數項', '');
  },
  async (tok, S) => { // 968.7
    S.h1 = card('Hₙ = 2Hₙ₋₁ + 1', C.rose, -3.2, 0.3, 3.4); S.h1b = bad('有常數 1 → 非齊次', -3.2, -0.4);
    cap('例如河內塔：後面有常數 1', '這就是非齊次');
  },
  async (tok, S) => { // 986.2
    S.h2 = card('Pₙ = R·Pₙ₋₁', C.mint, 3.0, 0.3, 2.8); S.h2b = good('後面沒有 → 齊次', 3.0, -0.4);
    cap('前面複利的式子後面沒有東西', '這就是齊次');
  },
  async (tok, S) => { // 1024.4
    dark(S.w); lit(S.w[3]); gone(S.h1, S.h1b, S.h2, S.h2b);
    S.l.add('常係數：c₁ … cₖ 是常數（5、3、1、1.2、0 都可以）', C.peach);
    cap('constant coefficient：係數是常數', '放 5、放 3、放 1.2、放 0 都 OK');
  },
  async (tok, S) => { // 1041.1
    S.w.forEach((m) => lit(m, OKG));
    cap('我們現在要考慮的就是這一種', '線性齊次常係數遞迴關係式');
  },
]);

scene('acA-16-char', 'Lec16：猜 aₙ = rⁿ → 特徵方程式', [
  async (tok, S) => { // 1061.5
    S.R = card('aₙ = 3aₙ₋₁ + 4aₙ₋₂', C.sky, 0, 6.4, 4.4); lit(S.R);
    cap('例子：aₙ = 3aₙ₋₁ + 4aₙ₋₂', '');
  },
  async (tok, S) => { // 1086.3
    good('一次 ✓ 常係數 ✓ 沒有常數項 ✓', 0, 5.7);
    cap('都是一次、係數是常數、後面沒有東西', '是線性齊次常係數遞迴關係式');
  },
  async (tok, S) => { // 1121.1
    dark(S.R);
    sm('前面的答案：Rⁿ·P₀、2ⁿ − 1 都跟指數有關', 0, 5.1);
    cap('剛才兩個式子的答案都跟指數有關', '');
  },
  async (tok, S) => { // 1137.3
    S.g = card('猜：aₙ = rⁿ', C.lemon, -4.2, 4.2, 2.6); lit(S.g);
    cap('根據經驗：猜答案是指數函式', '只要找出底數 r 是多少');
  },
  async (tok, S) => { // 1171.5
    dark(S.g);
    S.c = chain(1.2, 4.2, 0.7, 6.6);
    S.c.add('rⁿ = 3rⁿ⁻¹ + 4rⁿ⁻²');
    cap('代回去試試看', 'rⁿ = 3rⁿ⁻¹ + 4rⁿ⁻²');
  },
  async (tok, S) => { // 1187.0
    S.c.add('rⁿ⁻²·(r² − 3r − 4) = 0');
    cap('移項，提出公因式 rⁿ⁻²', '剩下 r² − 3r − 4 = 0');
  },
  async (tok, S) => { // 1243.3
    sm('r = 0 代進去永遠是 0 → 沒有用，不管它', 1.2, 2.2);
    cap('r = 0 沒有用', '代進去永遠是 0');
  },
  async (tok, S) => { // 1263.0
    const m = S.c.add('r² − 3r − 4 = 0', C.lilac); glow(m, HL);
    cap('往下套，很重要的是這一個', '');
  },
  async (tok, S) => { // 1278.8
    hot('特徵方程式（characteristic equation）', 1.2, 1.3);
    cap('跟線性代數一樣，叫做「特徵」', '特徵方程式／特徵多項式');
  },
  async (tok, S) => { // 1313.5
    sm('−3、−4：右邊的 3aₙ₋₁、4aₙ₋₂ 移項過來', 1.2, 0.7);
    cap('−3、−4 是移項過來的', '');
  },
  async (tok, S) => { // 1327.2
    sm('只跟前兩項有關 → 二次 → 兩個根', 1.2, 0.2);
    cap('為什麼是平方？只跟前兩項有關', '二次式 → 大概會有兩個根');
  },
  async (tok, S) => { // 1380.2
    S.r1 = card('r = 4 → 4ⁿ', C.mint, -3.0, -0.6, 2.8); S.r2 = card('r = −1 → (−1)ⁿ', C.mint, 3.0, -0.6, 3.2);
    cap('(r − 4)(r + 1) = 0 → 兩個根', 'aₙ = 4ⁿ 或 aₙ = (−1)ⁿ');
  },
  async (tok, S) => { // 1405.4
    const A = {}, B = {}; for (let n = 2; n <= 5; n++) { A[n] = 4 ** n; B[n] = 3 * 4 ** (n - 1) + 4 * 4 ** (n - 2); }
    S.t = cmp([2, 3, 4, 5], A, B, -0.9, 2.9, '4ⁿ', '3·4ⁿ⁻¹+4·4ⁿ⁻²', 1.15);
    gone(S.c.ls);
    cap('把 4ⁿ 代進去確實是答案', '(−1)ⁿ 你們自己驗驗看');
  },
  async (tok, S) => { // 1417.1
    note('只有這兩個嗎？會不會有別的解？', 0, 7.2);
    cap('會不會有別的解？', '');
  },
]);

scene('acA-16-init', 'Lec16：通解 + 起始條件 → aₙ = 3·4ⁿ + 2(−1)ⁿ', [
  async (tok, S) => { // 1428.1
    hot('為什麼叫「線性」？跟線性代數有關', 0, 6.8);
    cap('這跟線性代數有點關係', '');
  },
  async (tok, S) => { // 1439.0
    S.sp = cube('', C.lilac, [5.6, 0.12, 2.4], 0, 5.2, 0); sm('所有解 = 一個函數的子空間', 0, 5.6);
    cap('線性遞迴式的解構成一個函數空間', '是一個子空間');
  },
  async (tok, S) => { // 1450.7
    S.b1 = card('4ⁿ', C.mint, -1.4, 4.4, 1.4); S.b2 = card('(−1)ⁿ', C.mint, 1.4, 4.4, 1.6); sm('兩個基底', 3.2, 4.4);
    cap('4ⁿ 和 (−1)ⁿ 是它的兩個基底', '');
  },
  async (tok, S) => { // 1460.2
    S.gen = card('aₙ = α·4ⁿ + β·(−1)ⁿ', C.sky, 0, 3.3, 4.8); lit(S.gen);
    cap('所有答案都長成這樣的線性組合', 'α 乘 4ⁿ 加 β 乘 (−1)ⁿ');
  },
  async (tok, S) => { // 1477.0
    sm('α、β 是多少？要給起始條件才唯一決定', 0, 2.6);
    cap('α、β 是多少？不知道', '要唯一決定，得給起始條件');
  },
  async (tok, S) => { // 1493.3
    dark(S.gen);
    S.ic = card('起始條件：a₀ = 5、a₁ = 10（老師隨手設定）', C.lemon, 0, 1.8, 6.6); lit(S.ic);
    cap('假設 a₀ = 5、a₁ = 10', '老師說這個隨便寫');
  },
  async (tok, S) => { // 1524.6
    dark(S.ic);
    S.e1 = card('n = 0：α·4⁰ + β·(−1)⁰ = α + β = 5', C.sky, 0, 1.0, 6.6); lit(S.e1);
    cap('代 a₀ = 5：n = 0', '4⁰ = 1、(−1)⁰ = 1 → α + β = 5');
  },
  async (tok, S) => { // 1541.1
    dark(S.e1);
    S.e2 = card('n = 1：4α − β = 10', C.sky, 0, 0.2, 4.4); lit(S.e2);
    cap('代 a₁ = 10：n = 1', '4α − β = 10');
  },
  async (tok, S) => { // 1556.7
    dark(S.e2);
    S.ab = card('兩式相加：5α = 15 → α = 3，β = 2', C.peach, 0, -0.6, 6.0); lit(S.ab);
    cap('兩式相加：α = 3，β = 2', '');
  },
  async (tok, S) => { // 1580.0
    dark(S.ab);
    S.ans = card('aₙ = 3·4ⁿ + 2·(−1)ⁿ', C.mint, 0, -1.4, 4.8); glow(S.ans, OKG);
    cap('答案：aₙ = 3·4ⁿ + 2·(−1)ⁿ', '');
  },
  async (tok, S) => { // 1592.6
    gone(S.sp, S.b1, S.b2, S.e1, S.e2, S.ic, S.gen);
    const A = seq(0, [5, 10], (a, n) => 3 * a[n - 1] + 4 * a[n - 2], 6), B = {}; for (let n = 0; n <= 6; n++) B[n] = 3 * 4 ** n + 2 * (-1) ** n;
    S.t = cmp([0, 1, 2, 3, 4, 5, 6], A, B, -2.4, 4.6, '遞迴', '公式', 1.05);
    cap('一整套做法：猜 → 特徵根 → 通解 → 代起始條件', '驗算：遞迴和公式每一項都一樣 ✓');
  },
  async (tok, S) => { // 1605.1
    note('目前只適用：齊次、線性', 0, 6.4);
    cap('記得：目前只適合齊次、線性', '有「尾巴」的後面會再講');
  },
]);

scene('acA-16-ex2', 'Lec16：再算一題 aₙ = aₙ₋₁ + 2aₙ₋₂', [
  async (tok, S) => { // 1641.1
    S.R = card('aₙ = aₙ₋₁ + 2aₙ₋₂', C.sky, 0, 6.4, 4.2); lit(S.R);
    cap('再算一題：aₙ = aₙ₋₁ + 2aₙ₋₂', '');
  },
  async (tok, S) => { // 1643.4
    good('線性 ✓ 齊次 ✓ 常係數 ✓', 0, 5.7);
    cap('是不是線性、齊次、常係數？', '三個條件都符合');
  },
  async (tok, S) => { // 1658.6
    sm('跟前兩項有關 → 特徵方程式是二次 → 一般有兩個根', 0, 5.1);
    cap('跟前兩項有關', '特徵方程式會是二次，一般有兩個根');
  },
  async (tok, S) => { // 1692.0
    dark(S.R);
    S.c = chain(0, 4.3, 0.72, 6.4);
    S.c.add('假設 aₙ = rⁿ 代入', C.lemon);
    cap('一樣先假設 aₙ = rⁿ 代入', '');
  },
  async (tok, S) => { // 1717.1
    S.c.add('rⁿ = rⁿ⁻¹ + 2rⁿ⁻²');
    cap('得到 rⁿ = rⁿ⁻¹ + 2rⁿ⁻²', '再提出公因式');
  },
  async (tok, S) => { // 1732.6
    S.c.add('characteristic equation：r² − r − 2 = 0', C.lilac);
    cap('特徵方程式：r² − r − 2 = 0', '');
  },
  async (tok, S) => { // 1757.0
    sm('熟了以後，前面的步驟可以直接跳掉', 0, 1.6);
    cap('熟了可以直接寫特徵方程式', '前面的步驟可以跳過');
  },
  async (tok, S) => { // 1769.3
    sm('−1：aₙ₋₁ 移過來；−2：2aₙ₋₂ 移過來', 0, 1.1);
    cap('為什麼是 −1、−2？', '右邊的項移過來的');
  },
  async (tok, S) => { // 1778.3
    S.c.add('(r − 2)(r + 1) = 0 → r = 2 或 −1');
    cap('(r − 2)(r + 1) = 0', 'r = 2 或 r = −1');
  },
  async (tok, S) => { // 1799.6
    const m = S.c.add('通解：aₙ = α·2ⁿ + β·(−1)ⁿ', C.mint); glow(m, OKG);
    const ok = [2, 3, 4, 5].every((n) => 2 ** n === 2 ** (n - 1) + 2 * 2 ** (n - 2) && (-1) ** n === (-1) ** (n - 1) + 2 * (-1) ** (n - 2));
    (ok ? good : bad)(ok ? '2ⁿ、(−1)ⁿ 代回原式都成立 ✓' : '✘', 0, 0.2);
    cap('齊次方程式的通解', 'α·2ⁿ + β·(−1)ⁿ');
  },
  async (tok, S) => { // 1820.2
    note('再把起始條件代進去，就能求出 α、β', 0, -0.6);
    cap('再把起始條件代進去', '就能把 α、β 算出來');
  },
]);

// ════════ XjTuFEQMxE0（易志偉 Lec17：三階、重根、非齊次的特殊解、生成函數定義） ════════
scene('acA-17-deriv', 'Lec17：重根也是微分後多項式的根', [
  async (tok, S) => { // 72.0
    S.p = card('p(x) 是多項式 → p′(x) 也是多項式', C.sky, 0, 5.6, 6.4); lit(S.p);
    cap('多項式微分還是多項式', '上次的複習');
  },
  async (tok, S) => { // 77.0
    dark(S.p);
    const m = card('x₀ 是 p 的重根 → p′(x₀) = 0（x₀ 還是根）', C.mint, 0, 4.4, 7.4); glow(m, OKG);
    sm('例（示意）：p = (x − 1)²，p′ = 2(x − 1)，x = 1 都是根', 0, 3.6);
    cap('重根 x₀ 在 p′ 也還是根', '等一下解「重根」會用到');
  },
]);

scene('acA-17-cubic', 'Lec17：三階 aₙ = 2aₙ₋₁ + 5aₙ₋₂ − 6aₙ₋₃', [
  async (tok, S) => { // 118.0
    S.R = card('aₙ = 2aₙ₋₁ + 5aₙ₋₂ − 6aₙ₋₃', C.sky, 0, 6.4, 5.8); lit(S.R);
    cap('先做一個練習', '線性齊次常係數');
  },
  async (tok, S) => { // 150.0
    sm('跟前 1、2、3 項有關 → 3 階', 0, 5.7);
    cap('跟前三項有關：3 階遞迴式', '');
  },
  async (tok, S) => { // 163.0
    note('沒給起始條件 → 求通解；三次式應該有三個根', 0, 5.0);
    cap('沒有給起始條件 → 算通解', '三次方程式應該可以算出三個根');
  },
  async (tok, S) => { // 193.0
    dark(S.R);
    S.c = chain(0, 4.1, 0.7, 6.6);
    S.c.add('aₙ = rⁿ 代入');
    cap('一樣把 aₙ = rⁿ 代入', '');
  },
  async (tok, S) => { // 205.0
    S.c.add('r³ − 2r² − 5r + 6 = 0', C.lilac);
    cap('特徵方程式：r³ − 2r² − 5r + 6 = 0', '');
  },
  async (tok, S) => { // 219.0
    const v = 1 - 2 - 5 + 6;
    S.c.add('試 r = 1：1 − 2 − 5 + 6 = ' + v + ' → (r − 1) 是因式');
    cap('先試 1、2、3', 'r = 1 代進去 = 0');
  },
  async (tok, S) => { // 238.0
    S.c.add('除掉 (r − 1)：剩 r² − r − 6');
    cap('除下來剩 r² − r − 6', '');
  },
  async (tok, S) => { // 253.0
    S.c.add('(r − 3)(r + 2)(r − 1) = 0');
    const f = (r) => r ** 3 - 2 * r ** 2 - 5 * r + 6;
    S.ok = [-2, 1, 3].every((r) => f(r) === 0);
    cap('(r − 3)(r + 2)(r − 1) = 0', '');
  },
  async (tok, S) => { // 269.0
    S.rts = [-2, 1, 3].map((r, i) => tile(fmt(r), C.mint, -1.4 + i * 1.4, -0.2, 0.8));
    S.okl = (S.ok ? good : bad)(S.ok ? '代回特徵方程式都 = 0 ✓' : '✘', 3.6, -0.2);
    cap('三個根：−2、1、3', '');
  },
  async (tok, S) => { // 277.0
    gone(S.rts, S.okl);
    S.b = ['(−2)ⁿ', '1ⁿ', '3ⁿ'].map((t, i) => card(t, C.mint, -2.4 + i * 2.4, -0.2, 1.7));
    cap('基本解：(−2)ⁿ、1ⁿ、3ⁿ', '');
  },
  async (tok, S) => { // 281.0
    gone(S.c.ls, S.b);
    S.g = card('aₙ = α(−2)ⁿ + β·1ⁿ + γ·3ⁿ', C.sky, 0, 4.2, 5.8); lit(S.g);
    sm('1ⁿ 就是 1，β·1ⁿ 寫成 β 就好', 0, 3.5);
    cap('通解：α(−2)ⁿ + β + γ3ⁿ', '1 的 n 次方就是 1');
  },
  async (tok, S) => { // 302.0
    dark(S.g);
    card('給 a₀、a₁、a₂ → 唯一解出 α、β、γ', C.lemon, 0, 2.6, 6.0);
    cap('給三個起始條件', '就能唯一解出 α、β、γ');
  },
  async (tok, S) => { // 313.0
    note('理想狀況：三個不同的根。但可能出現「重根」！', 0, 1.6);
    cap('這是很理想的狀況', '有可能會產生重根的現象');
  },
]);

scene('acA-17-double', 'Lec17：重根 (r − 1)² → 基本解 1ⁿ 與 n·1ⁿ', [
  async (tok, S) => { // 326.0
    S.R = card('aₙ = 2aₙ₋₁ − aₙ₋₂', C.sky, 0, 6.4, 4.2); lit(S.R);
    sm('（依老師寫出的特徵方程式 r² − 2r + 1 對回去）', 0, 5.8);
    cap('隨便舉一個例子', '');
  },
  async (tok, S) => { // 344.0
    dark(S.R); S.c = chain(0, 5.1, 0.7, 6.4);
    S.c.add('令 aₙ = rⁿ 代入');
    cap('一樣令 aₙ = rⁿ', '');
  },
  async (tok, S) => { // 351.0
    S.c.add('r² − 2r + 1 = 0 → (r − 1)² = 0', C.lilac);
    cap('r² − 2r + 1 = (r − 1)² = 0', '');
  },
  async (tok, S) => { // 364.0
    S.c.add('只得到 r = 1：二次重根（double root）');
    cap('只得到一個 r = 1', '這叫二次重根');
  },
  async (tok, S) => { // 378.0
    S.b1 = card('1ⁿ', C.mint, -1.6, 2.4, 1.6);
    S.b2 = card('？', C.gray, 1.6, 2.4, 1.6);
    cap('照剛才的方法只找到一個基本解', '');
  },
  async (tok, S) => { // 384.0
    sm('二階 → 要能配合兩個起始條件 → 需要兩個基本解', 0, 1.6);
    cap('二階遞迴要給兩個起始條件', '只有一個基本解應付不了所有情況');
  },
  async (tok, S) => { // 405.0
    lit(S.b2);
    cap('必須生出另外一個', '');
  },
  async (tok, S) => { // 413.0
    sm('重根 → 微分後代進去還是根（開場複習的事）', 0, 1.0);
    cap('有重根時：微分之後代進去還是根', '回去用微分試試看');
  },
  async (tok, S) => { // 446.0
    lit(S.b1, OKG);
    cap('規則：第一個基本解還是 1ⁿ', '');
  },
  async (tok, S) => { // 458.0
    relab(S.b2, 'n·1ⁿ'); S.b2.material.color.set(C.mint); glow(S.b2, OKG);
    sm('微分時指數掉下來 → 前面多乘一個 n', 1.6, 3.1);
    cap('第二個：前面多乘一個 n', '微分時指數會「掉下來」');
  },
  async (tok, S) => { // 496.0
    const ok = [2, 3, 4, 5, 6].every((n) => n === 2 * (n - 1) - (n - 2));
    (ok ? good : bad)('驗證 aₙ = n：2(n − 1) − (n − 2) = n ' + (ok ? '✓' : '✘'), 0, 0.3);
    card('aₙ = α·1ⁿ + β·n·1ⁿ = α + βn', C.sky, 0, -0.5, 5.0);
    cap('回去把 n·1ⁿ 代進去驗證', '確實也是解');
  },
]);

scene('acA-17-triple', 'Lec17：三重根 (r − 2)³ → 2ⁿ、n·2ⁿ、n²·2ⁿ', [
  async (tok, S) => { // 515.0
    S.f = card('(r − 2)³（先從答案倒推）', C.lilac, 0, 6.4, 5.0); lit(S.f);
    cap('再舉一個例子', '從 (r − 2)³ 倒推回去');
  },
  async (tok, S) => { // 535.0
    dark(S.f);
    S.e = card('(r − 2)³ = r³ − 6r² + 12r − 8', C.sky, 0, 5.6, 5.8); lit(S.e);
    cap('展開：r³ − 6r² + 12r − 8', '');
  },
  async (tok, S) => { // 574.0
    dark(S.e);
    S.R = card('aₙ = 6aₙ₋₁ − 12aₙ₋₂ + 8aₙ₋₃', C.peach, 0, 4.8, 5.8); lit(S.R);
    cap('對應的遞迴式', 'aₙ = 6aₙ₋₁ − 12aₙ₋₂ + 8aₙ₋₃');
  },
  async (tok, S) => { // 599.0
    dark(S.R);
    S.ce = card('特徵多項式 r³ − 6r² + 12r − 8 = (r − 2)³ = 0', C.lilac, 0, 4.0, 7.0); lit(S.ce);
    cap('它的特徵多項式就是這個', '');
  },
  async (tok, S) => { // 619.0
    dark(S.ce);
    S.r = card('r = 2：三重根', C.mint, 0, 3.2, 3.2); lit(S.r);
    cap('r = 2，是三重根', '');
  },
  async (tok, S) => { // 628.0
    sm('三階 → 一定要生出三個基本解', 0, 2.5);
    cap('三重根一定要生出三個基本解', '');
  },
  async (tok, S) => { // 636.0
    S.b = [card('2ⁿ', C.mint, -3, 1.5, 1.6)];
    cap('第一個：2ⁿ（原來的）', '');
  },
  async (tok, S) => { // 645.0
    S.b.push(card('n·2ⁿ', C.mint, 0, 1.5, 1.8));
    cap('第二個：前面乘 n → n·2ⁿ', '');
  },
  async (tok, S) => { // 655.0
    S.b.push(card('n²·2ⁿ', C.mint, 3, 1.5, 1.8));
    cap('第三個：再乘 n → n²·2ⁿ', '');
  },
  async (tok, S) => { // 666.0
    const fs = [(n) => 2 ** n, (n) => n * 2 ** n, (n) => n * n * 2 ** n];
    S.ok = fs.map((f) => [3, 4, 5, 6, 7].every((n) => f(n) === 6 * f(n - 1) - 12 * f(n - 2) + 8 * f(n - 3)));
    S.ok.forEach((o, i) => (o ? good : bad)(o ? '代回遞迴 ✓' : '✘', -3 + i * 3, 0.8));
    cap('不管幾重根，都用這個技巧', '三個都真的是解 ✓');
  },
  async (tok, S) => { // 674.0
    S.g = card('aₙ = α·2ⁿ + β·n·2ⁿ + γ·n²·2ⁿ', C.sky, 0, 0, 6.2); lit(S.g);
    cap('這就是向量空間的基底', '給三個起始值，解出係數就 OK');
  },
  async (tok, S) => { // 710.0
    sm('有虛根也一樣可以代，這裡先不管虛根', 0, -0.7);
    cap('有虛根其實也一樣', '這裡只管實數根');
  },
  async (tok, S) => { // 723.0
    note('重根 r₀：r₀ⁿ、n·r₀ⁿ（更多重就再乘 n）— 從微分來', 0, 7.2);
    cap('有重根 r₀：r₀ⁿ 和 n·r₀ⁿ', '這其實是從微分來的');
  },
]);

scene('acA-17-ex', 'Lec17：aₙ = 4aₙ₋₁ − 4aₙ₋₂，a₀ = 1、a₁ = 0', [
  async (tok, S) => { // 751.0
    S.R = card('aₙ = 4aₙ₋₁ − 4aₙ₋₂，a₀ = 1，a₁ = 0', C.sky, 0, 6.4, 6.4); lit(S.R);
    cap('真的算一題', 'a₀ = 1，a₁ = 0');
  },
  async (tok, S) => { // 773.0
    dark(S.R); S.c = chain(0, 5.5, 0.68, 6.6);
    S.c.add('aₙ = rⁿ 代入');
    cap('直接算：aₙ = rⁿ 代入', '');
  },
  async (tok, S) => { // 789.0
    S.c.add('r² − 4r + 4 = 0', C.lilac);
    cap('特徵方程式：r² − 4r + 4 = 0', '');
  },
  async (tok, S) => { // 795.0
    S.c.add('(r − 2)² = 0 → r = 2（二重根）');
    cap('因式分解：(r − 2)²', '2 是二重根');
  },
  async (tok, S) => { // 808.0
    S.c.add('aₙ = α·2ⁿ + β·n·2ⁿ', C.sky);
    cap('二重根 → 答案長這樣', 'α·2ⁿ + β·n·2ⁿ');
  },
  async (tok, S) => { // 835.0
    S.c.add('a₀ = 1：α·2⁰ + β·0 = α = 1');
    cap('代 a₀ = 1：n = 0', 'n·2ⁿ 那項變 0 → α = 1');
  },
  async (tok, S) => { // 855.0
    S.c.add('a₁ = 0：2α + 2β = 0');
    cap('代 a₁ = 0：n = 1', '2α + 1·2·β = 0');
  },
  async (tok, S) => { // 880.0
    S.c.add('α = 1 代下來 → β = −1');
    cap('把 α = 1 帶下來', 'β = −1');
  },
  async (tok, S) => { // 889.0
    const m = S.c.add('aₙ = 2ⁿ − n·2ⁿ = (1 − n)·2ⁿ', C.mint); glow(m, OKG);
    cap('答案：aₙ = 2ⁿ − n·2ⁿ', '可以化簡成 (1 − n)·2ⁿ');
  },
  async (tok, S) => { // 915.0
    gone(S.c.ls);
    const A = seq(0, [1, 0], (a, n) => 4 * a[n - 1] - 4 * a[n - 2], 6), B = {}; for (let n = 0; n <= 6; n++) B[n] = (1 - n) * 2 ** n;
    S.t = cmp([0, 1, 2, 3, 4, 5, 6], A, B, -2.4, 4.0, '遞迴', '(1 − n)2ⁿ', 1.05);
    cap('這是很標準的齊次（homogeneous）', '驗算：每一項都一樣 ✓');
  },
]);

scene('acA-17-shift', 'Lec17：非齊次 = 齊次解平移（特殊解的想法）', [
  async (tok, S) => { // 935.0
    hot('解一個有無窮多解的方程組，要怎麼寫出所有解？', 0, 7.2);
    cap('先問：方程組有無窮多解', '要怎麼把所有解表示出來？');
  },
  async (tok, S) => { // 954.0
    note('先找一組特殊解 + 齊次方程組的所有解 → 平移', 0, 6.4);
    cap('另一種講法：先算一組特殊解', '再加上齊次的所有解：平移');
  },
  async (tok, S) => { // 974.0
    S.ax = [line(-3.2, 2.6, 3.2, 2.6, 0, '#a99470'), line(0, -0.6, 0, 5.8, 0, '#a99470')];
    S.L0 = line(-3, -0.4, 3, 5.6, 0, '#5a6a7a');
    S.t0 = pl('x − y = 0（白）', -3.6, 0.2);
    cap('例：x − y = 0', '它的解是一條過原點的直線');
  },
  async (tok, S) => { // 1001.0
    S.t0b = sm('過原點 → 是平面上的向量子空間 S', -3.6, -0.4);
    cap('過原點 → 是向量子空間', '');
  },
  async (tok, S) => { // 1005.0
    S.L1 = line(-2.2, -0.6, 3.2, 4.8, 0, '#c08a1f');
    S.t1 = tag('x − y = 1（黃）', 'note', 3.9, 3.6);
    cap('另一個：x − y = 1', '是一條平行線');
  },
  async (tok, S) => { // 1033.0
    S.t1b = bad('黃線不過原點 → 不是子空間', 3.9, 2.9);
    cap('黃線不是向量子空間', '但兩條線是平移的關係');
  },
  async (tok, S) => { // 1047.0
    S.pt = cube('', C.red, [0.22, 0.22, 0.22], 0.8 * 2, 2.6 + 0.8 * 1, 0);
    S.ptl = sm('(2, 1)', 2.1, 3.8);
    cap('在黃線上隨便取一點：(2, 1)', '2 − 1 = 1，確實在黃線上');
  },
  async (tok, S) => { // 1052.0
    S.ar = [-1.5, 0, 1.5].map((t) => arrow(V3(t * 0.8, 2.6 + t * 0.8, 0), V3((t + 2) * 0.8, 2.6 + (t + 1) * 0.8, 0), 0xd64545));
    cap('把 S 裡每一點都加上 (2, 1)', '整條白線就移到黃線上');
  },
  async (tok, S) => { // 1071.0
    S.f = card('黃線 = { v + (2, 1) ：v ∈ S }', C.lemon, 0, -1.2, 5.2); lit(S.f);
    cap('黃線 = 所有 v + (2, 1)，v 在 S 裡', '');
  },
  async (tok, S) => { // 1099.0
    S.wy = sm('白：齊次（右邊 0）　黃：非齊次（右邊 1）', 0, 6.4);
    cap('白線是齊次，黃線是非齊次', '非齊次的解 = 齊次的解平移');
  },
  async (tok, S) => { // 1120.0
    dark(S.f);
    S.g = card('遞迴式後面多了東西 → 一樣的方法', C.sky, 0, -1.9, 5.6); lit(S.g);
    cap('遞迴式後面多了東西時', '也可以用這個方法');
  },
  async (tok, S) => { // 1141.0
    dark(S.g);
    S.k = card('答案 = 特殊解（一個就好）+ 齊次的通解', C.mint, 0, -2.6, 6.2); glow(S.k, OKG);
    cap('重點：只要找出一個特殊解', '再加上原來的通解，就是答案');
  },
  async (tok, S) => { // 1169.0
    gone(S.ax, S.L0, S.L1, S.t0, S.t0b, S.t1, S.t1b, S.pt, S.ptl, S.ar, S.wy, S.f, S.g);
    S.m = card('aₙ = c₁aₙ₋₁ + ⋯ + cₖaₙ₋ₖ  + F(n)', C.peach, 0, 4.4, 6.6); lit(S.m);
    sm('前面遮起來 = 原本的齊次式；F(n) 跟 a 都沒有關係', 0, 3.7);
    cap('例子長這樣：前面跟齊次一模一樣', '後面加一個跟 aᵢ 都沒有關係的 F(n)');
  },
  async (tok, S) => { // 1194.0
    dark(S.m);
    note('針對 F(n) 找特殊解，加上前面算出的齊次解', 0, 2.8);
    cap('針對後面的 F(n) 找一組特殊解', '加上前面的齊次解，就是所有答案');
  },
]);

scene('acA-17-nh1', 'Lec17：aₙ = 3aₙ₋₁ + 2n 的特殊解', [
  async (tok, S) => { // 1212.0
    hot('直接從例子下手', 0, 7.0);
    cap('直接從例子下手', '');
  },
  async (tok, S) => { // 1223.0
    S.R = card('aₙ = 3aₙ₋₁ + 2n', C.sky, 0, 6.2, 3.8); lit(S.R);
    cap('aₙ = 3aₙ₋₁ + 2n', '後面多了 2n');
  },
  async (tok, S) => { // 1234.0
    S.cov = cube('', C.gray, [1.0, 0.62, 0.9], 1.25, 6.2, 0.1); S.covl = sm('先遮住', 1.25, 6.85);
    cap('先不要看後面', '前面這部分會不會算？');
  },
  async (tok, S) => { // 1247.0
    dark(S.R);
    S.h = card('aₙ⁽ʰ⁾ = 3aₙ₋₁⁽ʰ⁾', C.lilac, -3.4, 5.0, 3.4); lit(S.h);
    sm('h：homogeneous（齊次）', -3.4, 4.4);
    cap('標一個 h：齊次的部分', '把尾巴切掉');
  },
  async (tok, S) => { // 1268.0
    dark(S.h);
    S.h2 = card('rⁿ 代入：r − 3 = 0 → r = 3', C.lilac, -3.4, 3.7, 4.2); lit(S.h2);
    cap('rⁿ 代入：r − 3 = 0', 'r = 3');
  },
  async (tok, S) => { // 1282.0
    dark(S.h2);
    S.h3 = card('aₙ⁽ʰ⁾ = α·3ⁿ', C.mint, -3.4, 2.5, 2.8); glow(S.h3, OKG);
    cap('一階：齊次解 α·3ⁿ', '第一部分完成');
  },
  async (tok, S) => { // 1298.0
    gone(S.cov, S.covl);
    lit(S.R);
    cap('接下來麻煩的是後面', '');
  },
  async (tok, S) => { // 1318.0
    dark(S.R);
    sm('不必找出所有解：只要找出一個解就好', 3.0, 5.0);
    cap('不用找所有解', '只要找出一個解就好');
  },
  async (tok, S) => { // 1330.0
    S.bd = buddy('尾巴', '2n', C.orange, 3.0, 2.6, 0, 0.8);
    S.bdl = bub('龍生龍、鳳生鳳：照尾巴去猜', 3.0, 4.3);
    cap('龍生龍、鳳生鳳', '照它的尾巴去猜');
  },
  async (tok, S) => { // 1350.0
    gone(S.bd, S.bdl);
    S.pg = card('尾巴是一次多項式 → 猜 aₙ⁽ᵖ⁾ = cn + d', C.lemon, 2.4, 2.6, 6.0); lit(S.pg);
    sm('p：particular（特殊）', 2.4, 2.0);
    cap('尾巴 2n 是一次多項式', '假設特殊解也是一次：cn + d');
  },
  async (tok, S) => { // 1402.0
    dark(S.pg);
    S.c = chain(0, 1.0, 0.66, 7.6);
    S.c.add('cn + d = 3[c(n − 1) + d] + 2n');
    cap('代進去', '左邊 cn + d；右邊 3[c(n − 1) + d] + 2n');
  },
  async (tok, S) => { // 1470.0
    S.c.add('cn + d = 3cn − 3c + 3d + 2n');
    cap('乘開：3cn − 3c + 3d + 2n', '');
  },
  async (tok, S) => { // 1490.0
    S.c.add('0 = (2c + 2)·n + (2d − 3c)');
    cap('全部移到同一邊', '有 n 的放一起，常數放一起');
  },
  async (tok, S) => { // 1526.0
    S.c.add('比較係數：2c + 2 = 0 → c = −1；2d − 3c = 0 → d = −3/2', C.peach);
    cap('多項式 = 0：每一項係數都要 = 0', 'c = −1，d = −3/2');
  },
  async (tok, S) => { // 1545.0
    const c = -1, d = -1.5, ok = [1, 2, 3, 4, 5].every((n) => c * n + d === 3 * (c * (n - 1) + d) + 2 * n);
    S.okl = (ok ? good : bad)(ok ? '−3/2 看起來怪，但代回去成立 ✓' : '✘', 0, -1.9);
    cap('−3/2 看起來很奇怪，對一下', '沒有算錯');
  },
  async (tok, S) => { // 1571.0
    gone(S.c.ls, S.okl);
    S.p = card('aₙ⁽ᵖ⁾ = −n − 3/2', C.mint, 2.6, 1.3, 3.6); glow(S.p, OKG);
    cap('特殊解：−n − 3/2', '');
  },
  async (tok, S) => { // 1573.0
    S.all = card('aₙ = aₙ⁽ʰ⁾ + aₙ⁽ᵖ⁾ = α·3ⁿ − n − 3/2', C.sky, 0, 0.0, 6.6); lit(S.all);
    cap('答案：齊次解 + 特殊解', 'α·3ⁿ − n − 3/2：所有的通解');
  },
]);

scene('acA-17-nh1b', 'Lec17：先湊通解，再代 a₁ = 3', [
  async (tok, S) => { // 1620.0
    S.all = card('aₙ = α·3ⁿ − n − 3/2', C.sky, 0, 6.2, 4.6); lit(S.all);
    S.ic = card('起始條件：a₁ = 3', C.lemon, 0, 5.2, 3.6);
    cap('如果再給一個起始條件 a₁ = 3', '只剩一個未知數 α');
  },
  async (tok, S) => { // 1653.0
    dark(S.all);
    S.w = card('✘ 直接把 a₁ = 3 代進齊次解 α·3ⁿ', C.rose, 0, 4.0, 5.8); glow(S.w, NG);
    cap('常見錯誤：直接代進齊次解', '這樣答案就不對');
  },
  async (tok, S) => { // 1674.0
    S.r = card('✓ 先湊出「齊次 + 特殊」，再代起始條件', C.mint, 0, 3.1, 6.4); glow(S.r, OKG);
    cap('一定要先算出齊次解跟特殊解', '湊起來之後再代起始條件');
  },
  async (tok, S) => { // 1692.0
    S.c = chain(0, 2.0, 0.66, 6.4);
    S.c.add('a₁ = 3 = 3α − 1 − 3/2');
    S.c.add('3α = 11/2 → α = 11/6');
    cap('3 = 3α − 1 − 3/2', '3α = 11/2，α = 11/6');
  },
  async (tok, S) => { // 1721.0
    const m = S.c.add('aₙ = (11/6)·3ⁿ − n − 3/2', C.mint); glow(m, OKG);
    const A = seq(1, [3], (a, n) => 3 * a[n - 1] + 2 * n, 6), B = {}; for (let n = 1; n <= 6; n++) B[n] = 11 / 6 * 3 ** n - n - 1.5;
    S.t = cmp([1, 2, 3, 4, 5, 6], A, B, -2.0, -0.6, '遞迴', '公式', 1.05);
    cap('答案：(11/6)·3ⁿ − n − 3/2', '驗算：遞迴和公式一樣 ✓');
  },
]);

scene('acA-17-nh2', 'Lec17：二階非齊次，A = 4、B = 57/4', [
  async (tok, S) => { // 1784.0
    hot('越來越複雜：二階的非齊次', 0, 7.0);
    sm('二階 → 齊次解有 α、β 兩個係數', 0, 6.4);
    cap('這一題是二階', '齊次解會有 α、β');
  },
  async (tok, S) => { // 1789.0
    S.n1 = note('特殊解從後面算：尾巴長什麼樣，特殊解就設什麼樣', 0, 5.7);
    cap('特殊解從尾巴來猜', '尾巴是一次多項式 → 設一次多項式');
  },
  async (tok, S) => { // 1813.0
    S.n2 = sm('若猜的跟齊次解「撞到」→ 解不出來 → 升一次再試（多一個變數）', 0, 5.0);
    cap('如果猜的形式跟通解有關係', '可能解不出來 → 升一次再試試');
  },
  async (tok, S) => { // 1863.0
    gone(S.n1, S.n2);
    S.R = card('aₙ = 7aₙ₋₁ − 10aₙ₋₂ + 16n + 5', C.sky, 0, 5.2, 6.0); lit(S.R);
    sm('（尾巴依老師算出的 A = 4、B = 57/4 對回去）', 0, 4.6);
    cap('再講一次：aₙ⁽ʰ⁾ 齊次、aₙ⁽ᵖ⁾ 特殊', 'p 是 particular');
  },
  async (tok, S) => { // 1876.0
    dark(S.R);
    S.h = card('蓋住尾巴：r² − 7r + 10 = 0 → r = 2、5', C.lilac, -2.4, 3.6, 5.4); lit(S.h);
    cap('齊次：把尾巴蓋起來', 'r² − 7r + 10 = 0，根是 2 跟 5');
  },
  async (tok, S) => { // 1886.0
    dark(S.h);
    S.hh = card('aₙ⁽ʰ⁾ = α·2ⁿ + β·5ⁿ', C.mint, -2.4, 2.7, 3.8);
    S.ice = prop('parcel', 3.6, 2.2, 0, 0.8, '冷凍庫');
    cap('齊次解先放到冷凍庫', '先不要去動它');
  },
  async (tok, S) => { // 1900.0
    bad('不能單獨拿它代起始條件', -2.4, 2.0);
    cap('不能單獨拿齊次解去算', '一定要跟特殊解湊在一起');
  },
  async (tok, S) => { // 1913.0
    S.p = card('設 aₙ⁽ᵖ⁾ = An + B 代入，比較係數', C.lemon, 0, 1.0, 6.2); lit(S.p);
    cap('特殊解：設 An + B', '尾巴是一次，就設一次');
  },
  async (tok, S) => { // 1939.0
    dark(S.p);
    const A = 4, B = 57 / 4, ok = [2, 3, 4, 5].every((n) => Math.abs(A * n + B - (7 * (A * (n - 1) + B) - 10 * (A * (n - 2) + B) + 16 * n + 5)) < 1e-9);
    S.pp = card('A = 4，B = 57/4 → aₙ⁽ᵖ⁾ = 4n + 57/4', C.mint, -0.8, 0.1, 6.0); glow(S.pp, OKG);
    (ok ? good : bad)(ok ? '代回原式成立 ✓' : '✘', 4.4, 0.1);
    cap('算出 A = 4，B = 57/4', '');
  },
  async (tok, S) => { // 1945.0
    note('不要永遠相信別人（課本也會錯）→ 自己驗算', 0, 7.3);
    cap('不要永遠相信有人會永遠對', '課本也會錯，全部要驗算');
  },
  async (tok, S) => { // 1982.0
    gone(S.ice);
    S.all = card('通解 = α·2ⁿ + β·5ⁿ + 4n + 57/4', C.sky, 0, -0.8, 6.4); lit(S.all);
    cap('齊次解 + 特殊解湊出來之後', '才可以把起始條件帶進去');
  },
  async (tok, S) => { // 2008.0
    sm('再把題目的兩個起始條件代進來 → 解出 α、β', 0, -1.5);
    cap('有了通解，再代兩個起始條件', '算出 α、β 就是最後答案');
  },
  async (tok, S) => { // 2020.0
    ['① 齊次解', '② 特殊解', '③ 代起始條件'].forEach((t, i) => card(t, [C.lilac, C.lemon, C.mint][i], -3.6 + i * 3.6, 6.3, 2.8));
    cap('標準題：分段給分', '齊次、特殊解、代入，每段都算分');
  },
]);

scene('acA-17-gf', 'Lec17：生成函數（generating function）的定義', [
  async (tok, S) => { // 2079.0
    hot('另一個方法：生成函數（generating function）', 0, 7.0);
    cap('一個方法不夠保險', '另一個方法：生成函式');
  },
  async (tok, S) => { // 2089.0
    sm('也可以解遞迴式，而且用途更多', 0, 6.4);
    cap('它也可以解遞迴', '而且用途更多');
  },
  async (tok, S) => { // 2097.0
    S.a = ['a₀', 'a₁', 'a₂', 'a₃', '⋯'].map((t, i) => tile(t, i === 4 ? C.gray : C.sky, -3 + i * 1.3, 5.3, 0.8));
    cap('給你一個數列 a₀、a₁、a₂、…', '');
  },
  async (tok, S) => { // 2113.0
    sm('有限數列：後面全部看作 0', 3.8, 4.6);
    cap('如果是有限的', '後面全部看作 0');
  },
  async (tok, S) => { // 2120.0
    S.g = card('G(x) = a₀ + a₁x + a₂x² + a₃x³ + ⋯', C.lilac, 0, 3.9, 6.8); lit(S.g);
    cap('數列的生成函式：G(x)', 'a₀ + a₁x + a₂x² + ⋯ 一直加下去');
  },
  async (tok, S) => { // 2148.0
    dark(S.g);
    S.s = card('G(x) = Σₙ₌₀^∞ aₙxⁿ', C.lilac, 0, 3.0, 4.4); lit(S.s);
    cap('數學式的寫法', 'Σ aₙ xⁿ，n 從 0 到無窮大');
  },
  async (tok, S) => { // 2163.0
    dark(S.s);
    sm('像在 0 的泰勒展開：aₙ = G⁽ⁿ⁾(0) / n!', 0, 2.3);
    cap('像泰勒展開在 0 展開', '第 n 項係數 = 微分 n 次在 0 的值 ÷ n!');
  },
  async (tok, S) => { // 2204.0
    gone(S.a);
    S.r1 = card('aᵢ = 1：1 + x + x² + x³ + ⋯', C.sky, -1.0, 1.3, 5.2); lit(S.r1);
    cap('例：每一項都是 1', 'a₀ = a₁ = a₂ = ⋯ = 1');
  },
  async (tok, S) => { // 2232.0
    S.e1 = card('= 1/(1 − x)', C.mint, 3.9, 1.3, 2.4); glow(S.e1, OKG);
    const x = 0.3; let s = 0; for (let i = 0; i < 60; i++) s += x ** i;
    sm('示意：x = 0.3 時 Σ ≈ ' + s.toFixed(4) + '，1/(1 − 0.3) = ' + (1 / 0.7).toFixed(4), 0.8, 0.6);
    cap('學過：可以寫成 1/(1 − x)', '');
  },
  async (tok, S) => { // 2240.0
    dark(S.r1);
    note('一整個數列 → 壓縮成一個函式', 0, 6.0);
    cap('把一整個數列壓縮成一個函式', '');
  },
  async (tok, S) => { // 2258.0
    sm('要第幾項 → 把它泰勒展開', 0, 5.4);
    cap('要算第幾項，就泰勒展開', '所以叫「生成」函式');
  },
  async (tok, S) => { // 2271.0
    S.r2 = card('aᵢ = 1/i!：1 + x + x²/2! + x³/3! + ⋯', C.sky, -1.0, -0.2, 5.8); lit(S.r2);
    cap('另一個例子：aᵢ = 1/i!', 'a₀ = 1、a₁ = 1/1!、a₂ = 1/2!、…');
  },
  async (tok, S) => { // 2288.0
    S.e2 = card('= eˣ', C.mint, 3.9, -0.2, 1.6); glow(S.e2, OKG);
    let s = 0; for (let i = 0; i < 20; i++) s += 1 / fact(i);
    sm('示意：x = 1 時 Σ 1/i! ≈ ' + s.toFixed(5) + ' = e', 0.8, -0.9);
    cap('代進去：這就是指數函數 eˣ', '');
  },
  async (tok, S) => { // 2306.0
    note('這個函式就代表了前面那個數列', 0, -1.7);
    cap('這個函式就代表前面那個數列', '');
  },
]);

// ════════ Tcc9mQDAX_4（易志偉 Lec18：生成函數計數、販賣機、extended binomial、用生成函數解遞迴、助教例題） ════════
// polynomial helpers (coefficient arrays, truncated at cap)
const pmul = (a, b, cap = 120) => { const r = Array(Math.min(a.length + b.length - 1, cap + 1)).fill(0); a.forEach((x, i) => b.forEach((y, j) => { if (i + j <= cap) r[i + j] += x * y; })); return r; };
const pset = (exps, cap = 120) => { const r = Array(cap + 1).fill(0); exps.forEach((e) => { if (e <= cap) r[e] += 1; }); return r; };
const range = (a, b, s = 1) => { const r = []; for (let i = a; i <= b; i += s) r.push(i); return r; };
// brute force: number of (e1,e2,e3) with e_i in sets and e1+e2+e3 = n
const count3 = (A, B, Cc, n) => { let c = 0; A.forEach((a) => B.forEach((b) => Cc.forEach((d) => { if (a + b + d === n) c++; }))); return c; };

scene('acA-18-e17', 'Lec18：e₁ + e₂ + e₃ = 17 → 看 x¹⁷ 的係數', [
  async (tok, S) => { // 7.0
    S.q = card('e₁ + e₂ + e₃ = 17 有幾組非負整數解？', C.sky, 0, 6.6, 6.6); lit(S.q);
    cap('上次看過的題目', 'e₁ + e₂ + e₃ = 17');
  },
  async (tok, S) => { // 36.0
    dark(S.q);
    S.e = ['e₁', 'e₂', 'e₃'].map((t, i) => { sm(t + ' 可以取 0, 1, 2, 3, …', -4 + i * 4, 5.7); return t; });
    cap('e₁ 可能是 0、1、2、3…', 'e₂、e₃ 也一樣');
  },
  async (tok, S) => { // 54.0
    S.P = ['(1 + x + x² + x³ + ⋯)', '(1 + x + x² + ⋯)', '(1 + x + x² + ⋯)'].map((t, i) => card(t, C.lilac, -4 + i * 4, 4.8, 3.6, 0.5));
    cap('試著用多項式的乘法來呈現', '每個 eᵢ 對一個括號');
  },
  async (tok, S) => { // 59.0
    lit(S.P[0]); S.p1 = card('x²', C.peach, -4, 3.7, 1.0); sm('e₁ 取 2 → 選 x²（指數 = 取的數）', -4, 3.1);
    cap('取 e₁ = 2：寫在 x 的指數', '選第一個括號的 x²');
  },
  async (tok, S) => { // 79.0
    dark(S.P); lit(S.P[1]); S.p2 = card('x³', C.peach, 0, 3.7, 1.0); sm('e₂ 取 3 → x³', 0, 3.1);
    cap('第二個括號：其實是無窮級數', 'e₂ 取 3 → x³');
  },
  async (tok, S) => { // 90.0
    dark(S.P); lit(S.P[2]); S.p3 = card('x⁰', C.peach, 4, 3.7, 1.0); sm('e₃ 取 0 → x⁰ = 1', 4, 3.1);
    cap('第三個也許取 0', 'x⁰');
  },
  async (tok, S) => { // 105.0
    dark(S.P); gone(S.p1, S.p2, S.p3);
    S.mul = card('用分配律全部乘開', C.lemon, 0, 3.4, 4.0); lit(S.mul);
    cap('想像用分配律全部乘開', '');
  },
  async (tok, S) => { // 111.0
    dark(S.mul);
    S.x17 = card('x¹⁷ 怎麼來？每個括號挑一項，指數相加 = 17', C.sky, 0, 2.5, 6.6); lit(S.x17);
    cap('x¹⁷ 是怎麼來的？', '三個括號各取一個，指數加起來 = 17');
  },
  async (tok, S) => { // 132.0
    dark(S.x17);
    S.ex = card('x² · x⁵ · x¹⁰ = x¹⁷', C.peach, 0, 1.6, 4.0); lit(S.ex);
    cap('例如 x² 乘 x⁵ 乘 x¹⁰', '乘起來是 x¹⁷');
  },
  async (tok, S) => { // 154.0
    dark(S.ex);
    note('分配律 = 把所有可能一一列出來', 0, 0.8);
    cap('做分配律就是把所有可能一一列出', '');
  },
  async (tok, S) => { // 161.0
    S.k = card('x¹⁷ 的係數 = 加起來是 17 的組合個數', C.mint, 0, -0.1, 6.4); glow(S.k, OKG);
    cap('整理回來：x¹⁷ 前面的係數', '就是三個數加起來 = 17 的組合個數');
  },
  async (tok, S) => { // 181.0
    gone(S.ex); S.t1 = card('(0, 2, 15)：1 · x² · x¹⁵', C.peach, -3.2, 1.6, 4.4);
    cap('例：e₁ 取 0、e₂ 取 2、e₃ 取 15', '1 · x² · x¹⁵ = x¹⁷');
  },
  async (tok, S) => { // 201.0
    S.t2 = card('(1, 1, 15)：x · x · x¹⁵', C.peach, 3.2, 1.6, 4.4);
    cap('再一個：x¹ · x¹ · x¹⁵', '又是一個 x¹⁷');
  },
  async (tok, S) => { // 215.0
    S.two = hot('收集起來：已經 2 個 x¹⁷ = 2 組解', 0, 0.9);
    cap('收集起來就有兩個 x¹⁷', '代表已經有兩組解');
  },
  async (tok, S) => { // 238.0
    gone(S.two);
    const all = range(0, 17), n = count3(all, all, all, 17);
    const G = pmul(pmul(pset(all, 17), pset(all, 17), 17), pset(all, 17), 17)[17];
    S.ans = card('答案就在 x¹⁷ 前面的係數：' + G + (G === n ? '（暴力列舉也是 ' + n + ' ✓）' : ' ✘'), C.mint, 0, -1.0, 7.4); glow(S.ans, OKG);
    cap('答案直接呈現在 x¹⁷ 的係數', '電腦乘開算出 171，暴力列舉也是 171');
  },
]);

scene('acA-18-gfcount', 'Lec18：這個生成函數 = 1/(1 − x)³', [
  async (tok, S) => { // 255.0
    S.G = card('G(x) = (1 + x + x² + ⋯)³', C.lilac, 0, 6.4, 5.0); lit(S.G);
    cap('這其實是一個生成函式', '');
  },
  async (tok, S) => { // 265.0
    const all = range(0, 12), co = pmul(pmul(pset(all, 12), pset(all, 12), 12), pset(all, 12), 12);
    S.r = co.slice(0, 6).map((v, i) => { sm('a' + sub(i), -3.0 + i * 1.2, 5.4); return tile(String(v), C.sky, -3.0 + i * 1.2, 4.7, 0.75); });
    sm('aₙ = e₁ + e₂ + e₃ = n 的解數', 0, 3.9);
    cap('a₀ = 和為 0 的解數，a₁ = 和為 1…', '這是一個數列，G(x) 是它的生成函數');
  },
  async (tok, S) => { // 296.0
    dark(S.G);
    S.q = card('e₁ + e₂ + e₃ = 100 有幾個解？→ 看 x¹⁰⁰ 的係數', C.lemon, 0, 3.0, 7.0); lit(S.q);
    cap('問和 = 100 有幾個解', '直接找 x¹⁰⁰ 前面的係數');
  },
  async (tok, S) => { // 319.0
    dark(S.q);
    S.f = card('每個括號是等比級數 → G(x) = 1/(1 − x)³', C.mint, 0, 2.0, 6.6); glow(S.f, OKG);
    cap('每一個都是等比級數', '所以 G(x) = 1/(1 − x)³');
  },
  async (tok, S) => { // 341.0
    sm('x¹⁰⁰ 的係數 = 泰勒展開第 100 個係數（微分 100 次 ÷ 100!）', 0, 1.2);
    cap('要 x¹⁰⁰ 的係數', '就是泰勒展開：微分 100 次');
  },
  async (tok, S) => { // 381.0
    note('老師這裡先不算出數字：這樣算出來的就是解的個數', 0, 0.3);
    cap('雖然先不知道答案', '至少知道這樣算出來的就是解的個數');
  },
]);

scene('acA-18-var', 'Lec18：變化題：e₁ ∈ {1, 3, 5}、e₂ ∈ {0, 5, 10}、e₃ 偶數', [
  async (tok, S) => { // 400.0
    sm('之前排容原理那類題目都很固定', 0, 7.0);
    cap('之前的題目很固定', '現在做一個變化題');
  },
  async (tok, S) => { // 413.0
    S.c1 = card('e₁ ∈ {1, 3, 5}', C.sky, -4.2, 6.2, 2.8);
    cap('e₁ 只能是 1、3、5', '');
  },
  async (tok, S) => { // 421.0
    S.c2 = card('e₂ ∈ {0, 5, 10}', C.sky, 0, 6.2, 2.8);
    cap('e₂ 只能是 0、5、10', '');
  },
  async (tok, S) => { // 425.0
    S.c3 = card('e₃ ∈ {2, 4, 6, 8, 10}', C.sky, 4.2, 6.2, 3.4);
    cap('e₃ 可能是 2、4、6、8、10', '能不能用某個生成函數的某一項表示？');
  },
  async (tok, S) => { // 441.0
    S.g1 = card('x + x³ + x⁵', C.lilac, -4.2, 5.0, 2.8); lit(S.g1);
    cap('e₁ 只允許 1、3、5', '寫成 x + x³ + x⁵');
  },
  async (tok, S) => { // 459.0
    dark(S.g1); S.g2 = card('1 + x⁵ + x¹⁰', C.lilac, 0, 5.0, 2.8); lit(S.g2);
    cap('e₂：0、5、10', '1 + x⁵ + x¹⁰');
  },
  async (tok, S) => { // 473.0
    dark(S.g2); S.g3 = card('x² + x⁴ + x⁶ + x⁸ + x¹⁰', C.lilac, 4.2, 5.0, 3.6); lit(S.g3);
    cap('e₃：2、4、6、8…', 'x² + x⁴ + x⁶ + ⋯');
  },
  async (tok, S) => { // 483.0
    dark(S.g3);
    const A = [1, 3, 5], B = [0, 5, 10], D = [2, 4, 6, 8, 10];
    const co = pmul(pmul(pset(A, 30), pset(B, 30), 30), pset(D, 30), 30)[17], bf = count3(A, B, D, 17);
    S.G = card('G(x) = 三個相乘；x¹⁷ 的係數就是答案', C.mint, 0, 3.8, 6.4); glow(S.G, OKG);
    S.v = sm('示意（電腦乘開）：x¹⁷ 係數 = ' + co + '；暴力列舉 = ' + bf + (co === bf ? ' ✓' : ' ✘'), 0, 3.1);
    sm('(1, 10, 6)、(3, 10, 4)、(5, 10, 2)', 0, 2.6);
    cap('三個相乘就是生成函式', '乘開後 x¹⁷ 的係數就是答案');
  },
  async (tok, S) => { // 498.0
    note('分配律展開、加總，其實就是一種列舉法', 0, 1.8);
    cap('適當地解釋，可以幫助思考', '展開、加總其實就是列舉法');
  },
  async (tok, S) => { // 531.0
    gone(S.c1, S.c2, S.c3, S.g1, S.g2, S.g3, S.G, S.v);
    S.r = card('另一種變形：e₁ 在 2～8、e₂ 在 3～9、e₃ 在 4～10（依字幕）', C.sky, 0, 0.9, 7.6); lit(S.r);
    cap('另一種變形：每個 eᵢ 有上下界', '');
  },
  async (tok, S) => { // 547.0
    dark(S.r);
    const A = range(2, 8), B = range(3, 9), D = range(4, 10);
    const co = pmul(pmul(pset(A, 30), pset(B, 30), 30), pset(D, 30), 30)[17], bf = count3(A, B, D, 17);
    S.f = card('(x² + ⋯ + x⁸)(x³ + ⋯ + x⁹)(x⁴ + ⋯ + x¹⁰) 的 x¹⁷ 係數', C.lilac, 0, 0.0, 7.6); lit(S.f);
    sm('示意（電腦乘開）：' + co + '；暴力列舉 ' + bf + (co === bf ? ' ✓' : ' ✘'), 0, -0.7);
    cap('對應的多項式寫成這樣', '一樣找 x¹⁷ 前面的係數');
  },
  async (tok, S) => { // 564.0
    note('老師沒有真的算：重點是解法不是單一的', 0, -1.5);
    cap('這裡不真的去算', '重點：處理問題的方式不是單一的');
  },
]);

scene('acA-18-vend', 'Lec18：販賣機：用 1、2、5 元硬幣付 r 元', [
  async (tok, S) => { // 584.0
    S.vm = prop('printer', -4.6, 2.4, 0, 1.2, '販賣機'); bob(S.vm, 0.04, 1.5);
    cap('去販賣機買東西', '它只接受剛剛好的錢');
  },
  async (tok, S) => { // 605.0
    S.coins = [1, 2, 5].map((v, i) => cube(v + ' 元', C.yellow, [0.8, 0.18, 0.8], -1.2 + i * 1.3, 5.6, 0));
    S.r = card('飲料 r 元', C.peach, 4.2, 5.6, 2.2);
    cap('飲料 r 元，硬幣有 1、2、5 元', '');
  },
  async (tok, S) => { // 615.0
    S.q = hot('付 r 元總共有幾種付法？', 0, 6.7);
    cap('付 r 元總共有幾種付法？', '');
  },
  async (tok, S) => { // 622.0
    sm('付法 = 幾個 1 元、幾個 2 元、幾個 5 元（同面額看起來一樣，不分）', 0, 4.8);
    cap('付法：幾個 1 元、幾個 2 元、幾個 5 元', '同面額的硬幣不去分辨');
  },
  async (tok, S) => { // 639.0
    S.G1 = card('(1 + x + x² + ⋯)(1 + x² + x⁴ + ⋯)(1 + x⁵ + x¹⁰ + ⋯)', C.lilac, 0.8, 4.0, 7.6); lit(S.G1);
    sm('xʳ 的係數 = 付 r 元的方法數', 0.8, 3.3);
    cap('每個都是級數，這樣寫', 'xʳ 的係數就是答案');
  },
  async (tok, S) => { // 655.0
    dark(S.G1);
    S.v2 = card('變形：付錢的「順序」不同，算不同付法', C.rose, 0.8, 2.4, 6.4); lit(S.v2);
    cap('還有一個變形', '付法的定義不一樣');
  },
  async (tok, S) => { // 711.0
    dark(S.v2);
    S.o1 = card('1 元 → 2 元', C.sky, -1.4, 1.5, 2.4); S.o2 = card('2 元 → 1 元', C.sky, 2.6, 1.5, 2.4); sm('≠', 0.6, 1.5);
    cap('先 1 後 2，不同於先 2 後 1', '朝三暮四的故事在這裡發生了');
  },
  async (tok, S) => { // 740.0
    S.n = note('先限制：剛剛好投 n 個硬幣', 0.8, 0.6);
    cap('先規定剛好要投 n 個硬幣', '例如剛好 5 個');
  },
  async (tok, S) => { // 759.0
    gone(S.G1, S.v2, S.coins, S.q);
    S.G2 = card('(x + x² + x⁵)(x + x² + x⁵)⋯(x + x² + x⁵) = (x + x² + x⁵)ⁿ', C.lilac, 0.8, 5.6, 7.6); lit(S.G2);
    cap('用生成函數：x + x² + x⁵ 連乘 n 次', '找 xʳ 的係數');
  },
  async (tok, S) => { // 805.0
    dark(S.G2);
    sm('分配律：每個括號只能取一個 → 一定剛好取 n 次', 0.8, 4.9);
    cap('分配律：每個括號只能取一個', '所以一定剛好取 n 次');
  },
  async (tok, S) => { // 838.0
    sm('第 k 個括號取 xᵛ = 第 k 次投 v 元', 0.8, 4.4);
    cap('第一個取 x 表示第一次丟 1 元', '第二個取 x² 表示第二次丟 2 元');
  },
  async (tok, S) => { // 876.0
    S.k = card('xʳ 的係數 = 剛好 n 個硬幣、有順序地付 r 元的方法數', C.mint, 0.8, 3.6, 7.6); glow(S.k, OKG);
    cap('乘開後 xʳ 的係數就是答案', '先 1 後 2、先 2 後 1 各貢獻一個 1');
  },
  async (tok, S) => { // 893.0
    S.G3 = card('不限硬幣數：Σₙ (x + x² + x⁵)ⁿ', C.lilac, 0.8, -0.2, 5.6); lit(S.G3);
    cap('不限硬幣數：全部加起來', 'n = 0、1、2、3…');
  },
  async (tok, S) => { // 913.0
    sm('n = 0：一個硬幣都不給（免費贈送）', 0.8, -0.9);
    cap('n = 0：一個都不給', '按個鈴就有東西喝');
  },
  async (tok, S) => { // 921.0
    dark(S.G3);
    S.G4 = card('= 1 / (1 − x − x² − x⁵)', C.mint, 0.8, -1.7, 4.6); glow(S.G4, OKG);
    cap('每一個都是等比級數的形式', '變成 1/(1 − x − x² − x⁵)');
  },
  async (tok, S) => { // 925.0
    sm('100 元：x¹⁰⁰ 的係數（微分 100 次 ÷ 100!）', 0.8, -2.4);
    cap('付 100 元有幾種？', 'x¹⁰⁰ 的係數：微分 100 次再除以 100!');
  },
]);

scene('acA-18-expand', 'Lec18：真的展開 (x + x² + x⁵)²', [
  async (tok, S) => { // 945.0
    hot('聽得懂嗎？其實都是直覺', 0, 7.0);
    cap('這是生成函數幾個好玩的例子', '有人搖頭，沒關係');
  },
  async (tok, S) => { // 967.0
    note('真的列舉給你們看', 0, 6.3);
    cap('我們就真的列舉給你們看', '');
  },
  async (tok, S) => { // 976.0
    S.G = card('(x + x² + x⁵)(x + x² + x⁵)', C.lilac, 0, 5.5, 5.0); lit(S.G);
    cap('寫兩次就夠了', '寫三次要 27 項');
  },
  async (tok, S) => { // 997.0
    dark(S.G);
    S.grid = [];
    const e = [1, 2, 5];
    e.forEach((a, i) => e.forEach((b, j) => { const m = tile('x' + sup(a + b), C.sky, -2.2 + j * 1.5, 4.1 - i * 0.85, 0.7); m.userData.e = a + b; S.grid.push(m); }));
    e.forEach((a, i) => sm('x' + (a > 1 ? sup(a) : ''), -3.4, 4.1 - i * 0.85)); e.forEach((b, j) => sm('x' + (b > 1 ? sup(b) : ''), -2.2 + j * 1.5, 4.8));
    cap('乘開總共 9 項', '一個配一個');
  },
  async (tok, S) => { // 1003.0
    sm('x·x + x·x² + x·x⁵ + x²·x + x²·x² + ⋯', 2.6, 2.0);
    cap('分配律：x 乘 x、x 乘 x²、x 乘 x⁵…', '先不要算指數');
  },
  async (tok, S) => { // 1034.0
    S.hi = (e) => S.grid.forEach((m) => glow(m, m.userData.e === e ? HL : null));
    S.co = [1, 2, 5].flatMap((a) => [1, 2, 5].map((b) => a + b)).reduce((o, e) => { o[e] = (o[e] || 0) + 1; return o; }, {});
    S.hi(2); S.out = card('x²', C.mint, 3.6, 4.6, 1.2);
    cap('x²：最少的，一個', '');
  },
  async (tok, S) => { // 1048.0
    S.hi(3); relab(S.out, 'x² + 2x³');
    cap('x³：一個、兩個', '加上 2x³');
  },
  async (tok, S) => { // 1065.0
    S.hi(4); relab(S.out, 'x² + 2x³ + x⁴'); S.out.scale.x = 1.8;
    cap('x⁴ 有一個；x⁵ 沒有', '');
  },
  async (tok, S) => { // 1069.0
    S.hi(6); relab(S.out, 'x² + 2x³ + x⁴ + 2x⁶'); S.out.scale.x = 2.4;
    cap('x⁶：兩個', '');
  },
  async (tok, S) => { // 1084.0
    S.grid.forEach((m) => glow(m, m.userData.e >= 7 ? HL : null));
    gone(S.out);
    const txtc = Object.keys(S.co).map(Number).sort((a, b) => a - b).map((e) => (S.co[e] > 1 ? S.co[e] : '') + 'x' + sup(e)).join(' + ');
    S.out = card(txtc, C.mint, 0, 1.2, 7.0); glow(S.out, OKG);
    cap('x⁷ 兩個，最後 x¹⁰ 一個', '9 項全部收集完');
  },
  async (tok, S) => { // 1101.0
    dark(S.grid);
    note('係數 = 投兩次、加起來剛好那個金額的方法數', 0, 0.3);
    cap('係數 = 投兩次加起來是那個金額的方法數', '');
  },
  async (tok, S) => { // 1115.0
    S.hi(2);
    sm('x² 的 1：第一次投 1 元、第二次投 1 元；2x³：(1, 2) 與 (2, 1)', 0, -0.4);
    cap('x² 那個 1：第一次 1 元、第二次 1 元', '這是投錢的順序');
  },
]);

scene('acA-18-ext', 'Lec18：extended binomial：(1 + x)⁻³ 的 x¹⁰⁰ 係數', [
  async (tok, S) => { // 1223.0
    hot('要第 100 項係數，不用真的微分', 0, 7.0);
    cap('要算第 100 項的係數', '不用微分，直接用公式');
  },
  async (tok, S) => { // 1232.0
    S.a = card('1 / (1 + x)³', C.sky, -3.2, 6.0, 2.8); lit(S.a);
    cap('例：1/(1 + x)³', '');
  },
  async (tok, S) => { // 1246.0
    dark(S.a); S.b = card('= (1 + x)⁻³', C.sky, 0.2, 6.0, 2.6); lit(S.b);
    cap('其實就是 (1 + x) 的 −3 次方', '之前講過的 extended binomial');
  },
  async (tok, S) => { // 1270.0
    dark(S.b);
    S.c = card('x¹⁰⁰ 的係數 = C(−3, 100)', C.lilac, 0, 5.0, 4.6); lit(S.c);
    cap('x¹⁰⁰ 的係數：−3 取 100', '');
  },
  async (tok, S) => { // 1283.0
    dark(S.c);
    let v = 1; for (let i = 0; i < 100; i++) v = v * (-3 - i) / (i + 1); v = Math.round(v);
    const v2 = Cb(102, 2);
    S.d = card('= (−3)(−4)⋯(−102) / 100! = ' + v, C.mint, 0, 4.0, 6.6); glow(S.d, OKG);
    sm('100 個負數相乘是正的；= C(102, 2) = ' + v2 + (v === v2 ? ' ✓' : ' ✘'), 0, 3.3);
    cap('從 −3 乘 −4 一直乘到 −102', '再除以 100!');
  },
  async (tok, S) => { // 1299.0
    sm('就是泰勒展開第 100 項的係數；後面會用到', 0, 2.8);
    cap('這就是泰勒展開第 100 項的係數', '後面會用到');
  },
  async (tok, S) => { // 1310.0
    gone(S.a, S.b, S.c, S.d);
    note('常用：−2 次方、−3 次方，記一下', 0, 6.2);
    cap('真的會用的大概是 −2、−3 次方', '稍微記一下');
  },
  async (tok, S) => { // 1324.0
    S.t1 = card('(1 + x)ⁿ = Σ C(n, k) xᵏ（n 是正整數）', C.sky, 0, 5.2, 6.6);
    cap('(1 + x)ⁿ：n 是整數時的展開', '');
  },
  async (tok, S) => { // 1334.0
    const co = pmul(pset(range(0, 8), 8), pset(range(0, 8), 8), 8);
    S.t2 = card('1/(1 − x)² = Σ (n + 1) xⁿ', C.mint, 0, 4.2, 5.0);
    S.r2 = co.slice(0, 6).map((v, n) => tile(String(v), v === n + 1 ? C.mint : C.rose, -3 + n * 1.2, 3.3, 0.6));
    sm('1, 2, 3, 4, …（示意：電腦把 (1 + x + x² + ⋯)² 乘開）', 0, 2.7);
    cap('1/(1 − x)²：係數 1、2、3、4…', '用剛才那個公式轉出來');
  },
  async (tok, S) => { // 1345.0
    const g = pset(range(0, 8), 8), co = pmul(pmul(g, g, 8), g, 8);
    S.t3 = card('1/(1 − x)³ = Σ C(n + 2, 2) xⁿ', C.mint, 0, 1.9, 5.4);
    S.r3 = co.slice(0, 6).map((v, n) => tile(String(v), v === Cb(n + 2, 2) ? C.mint : C.rose, -3 + n * 1.2, 1.0, 0.6));
    sm('1, 3, 6, 10, …', 0, 0.4);
    cap('還有 3 次方', '1/(1 − x)³：係數 1、3、6、10…');
  },
  async (tok, S) => { // 1363.0
    S.ar = arrow(V3(4.4, 4.0, 0), V3(4.4, 2.2, 0), 0xc08a1f); S.dl = sm('微分', 5.2, 3.1);
    cap('這兩個公式有關係', '關係在微積分：微分');
  },
  async (tok, S) => { // 1397.0
    S.dd = card('d/dx [1/(1 − x)²] = 2/(1 − x)³', C.peach, 0, -0.5, 5.4); lit(S.dd);
    cap('再微分一次', '這邊會有一個 2，不要忘了');
  },
  async (tok, S) => { // 1423.0
    dark(S.dd);
    note('這些是後面解題的工具', 0, -1.4);
    cap('記一下，這是解題的工具', '');
  },
]);

scene('acA-18-gfrr', 'Lec18：用生成函數解 aₖ = 3aₖ₋₁，a₀ = 2', [
  async (tok, S) => { // 1434.0
    hot('生成函數怎麼拿來解遞迴？', 0, 7.0);
    cap('生成函數怎麼拿來解遞迴', '從生成函數下手');
  },
  async (tok, S) => { // 1446.0
    S.c = chain(0, 6.2, 0.66, 7.4);
    S.c.add('G(x) = Σₙ₌₀^∞ aₙxⁿ = a₀ + a₁x + a₂x² + ⋯', C.lilac);
    cap('先根據定義寫出 G(x)', '');
  },
  async (tok, S) => { // 1479.0
    S.R = card('aₖ = 3aₖ₋₁', C.sky, -4.6, 7.2, 2.4); lit(S.R);
    cap('例：aₖ = 3aₖ₋₁', '把它代進去會有什麼結果');
  },
  async (tok, S) => { // 1500.0
    dark(S.R);
    S.c.add('G(x) = a₀ + Σₖ₌₁^∞ aₖxᵏ');
    cap('遞迴式只能從 k = 1 開始用', '因為有 aₖ₋₁；a₀ 要先挑出來');
  },
  async (tok, S) => { // 1533.0
    S.c.add('= a₀ + Σₖ₌₁^∞ 3aₖ₋₁ xᵏ');
    cap('代進去：aₖ = 3aₖ₋₁', '');
  },
  async (tok, S) => { // 1548.0
    S.c.add('= a₀ + 3·Σₖ₌₁^∞ aₖ₋₁ xᵏ');
    cap('3 很討厭，提到前面', '');
  },
  async (tok, S) => { // 1563.0
    S.c.add('= a₀ + 3x·Σₖ₌₁^∞ aₖ₋₁ xᵏ⁻¹');
    cap('每一項偷拿一個 x 出去', '指數變 k − 1，跟下標一樣');
  },
  async (tok, S) => { // 1601.0
    S.c.add('令 j = k − 1：Σⱼ₌₀^∞ aⱼ xʲ = G(x)', C.peach);
    cap('變數變換：令 j = k − 1', 'k = 1 時 j = 0，又回到 G(x)');
  },
  async (tok, S) => { // 1630.0
    S.c.add('a₀ = 2（題目一定要給起始條件）', C.lemon);
    cap('a₀ = 2 代入', '沒有起始條件不能算');
  },
  async (tok, S) => { // 1639.0
    S.c.add('G(x) = 2 + 3x·G(x)');
    cap('從 G(x) 出發，又回到 G(x)', '得到一個方程式');
  },
  async (tok, S) => { // 1654.0
    const m = S.c.add('(1 − 3x)·G(x) = 2 → G(x) = 2 / (1 − 3x)', C.mint); glow(m, OKG);
    cap('移項：G(x) = 2/(1 − 3x)', '');
  },
  async (tok, S) => { // 1671.0
    gone(S.c.ls);
    S.k = card('2/(1 − 3x) = 2·Σ 3ⁿxⁿ → aₙ = 2·3ⁿ', C.mint, 0, 6.2, 6.4); glow(S.k, OKG);
    const A = seq(0, [2], (a, n) => 3 * a[n - 1], 6), B = {}; for (let n = 0; n <= 6; n++) B[n] = 2 * 3 ** n;
    S.t = cmp([0, 1, 2, 3, 4, 5, 6], A, B, -2.4, 4.4, '遞迴', '2·3ⁿ', 1.05);
    cap('能不能把原來的數列寫下來？', '展開：aₙ = 2·3ⁿ ✓');
  },
]);

scene('acA-18-ta1', 'Lec18（助教）：aₙ = 8aₙ₋₁ + 10ⁿ⁻¹，a₁ = 9', [
  async (tok, S) => { // 1745.0
    S.R = card('aₙ = 8aₙ₋₁ + 10ⁿ⁻¹，a₁ = 9', C.sky, 0, 6.6, 5.4); lit(S.R);
    sm('（這段由助教在黑板上解題）', 0, 7.3);
    cap('助教解題：aₙ = 8aₙ₋₁ + 10ⁿ⁻¹', '給的是 a₁ = 9');
  },
  async (tok, S) => { // 1759.0
    dark(S.R); S.c = chain(0, 5.7, 0.62, 7.6);
    S.c.add('沒給 a₀：a₁ = 8a₀ + 10⁰ → 9 = 8a₀ + 1 → a₀ = 1', C.lemon);
    cap('沒有給 a₀，先把它找出來', '9 = 8a₀ + 1 → a₀ = 1');
  },
  async (tok, S) => { // 1785.0
    S.c.add('G(x) = Σₙ₌₀^∞ aₙxⁿ', C.lilac);
    cap('再套生成函數', '');
  },
  async (tok, S) => { // 1820.0
    S.c.add('G(x) − a₀ = Σₙ₌₁^∞ aₙxⁿ（遞迴從 n = 1 才能用）');
    cap('遞迴式從 n = 1 開始', 'a₀ 要另外拿出來');
  },
  async (tok, S) => { // 1908.0
    S.c.add('= 8·Σₙ₌₁ aₙ₋₁xⁿ + Σₙ₌₁ 10ⁿ⁻¹xⁿ');
    cap('10ⁿ⁻¹ 跟 a 沒有關係', '要把它拆成另一個和');
  },
  async (tok, S) => { // 1972.0
    S.c.add('= 8x·Σ aₙ₋₁xⁿ⁻¹ + x·Σ 10ⁿ⁻¹xⁿ⁻¹');
    cap('指數跟下標要一樣', '各提一個 x 出去');
  },
  async (tok, S) => { // 2031.0
    S.c.add('= 8x·G(x) + x·Σₖ₌₀ 10ᵏxᵏ');
    cap('變數變換，從 0 開始', '第一塊又回到 G(x)');
  },
  async (tok, S) => { // 2165.0
    S.c.add('Σ 10ᵏxᵏ = 1/(1 − 10x)', C.peach);
    cap('後面是等比級數', '= 1/(1 − 10x)');
  },
  async (tok, S) => { // 2259.0
    S.c.add('G(x) − 1 = 8x·G(x) + x/(1 − 10x)');
    cap('a₀ = 1 代進去', '整理成一個方程式');
  },
  async (tok, S) => { // 2338.0
    const m = S.c.add('G(x) = (1 − 9x) / [(1 − 8x)(1 − 10x)]', C.mint); glow(m, OKG);
    cap('合併：G(x) = (1 − 9x)/[(1 − 8x)(1 − 10x)]', '');
  },
  async (tok, S) => { // 2369.0
    gone(S.c.ls, S.R);
    S.pf = card('部分分式：A/(1 − 8x) + B/(1 − 10x)', C.lilac, 0, 6.2, 5.8); lit(S.pf);
    sm('通分：A(1 − 10x) + B(1 − 8x) = 1 − 9x', 0, 5.5);
    cap('拆成部分分式', 'A/(1 − 8x) + B/(1 − 10x)');
  },
  async (tok, S) => { // 2545.0
    dark(S.pf);
    const A = 0.5, B = 0.5, ok = [0, 0.05, 0.1, 0.3].every((x) => Math.abs(A * (1 - 10 * x) + B * (1 - 8 * x) - (1 - 9 * x)) < 1e-12);
    S.ab = card('A + B = 1，10A + 8B = 9 → A = B = 1/2', C.peach, 0, 4.6, 5.8); lit(S.ab);
    (ok ? good : bad)(ok ? '代回通分式成立 ✓' : '✘', 0, 3.9);
    cap('比較係數：A = 1/2，B = 1/2', '');
  },
  async (tok, S) => { // 2582.0
    dark(S.ab);
    S.ans = card('aₙ = (1/2)·8ⁿ + (1/2)·10ⁿ = (8ⁿ + 10ⁿ)/2', C.mint, 0, 3.0, 6.6); glow(S.ans, OKG);
    const A = seq(1, [9], (a, n) => 8 * a[n - 1] + 10 ** (n - 1), 6), B = {}; for (let n = 1; n <= 6; n++) B[n] = (8 ** n + 10 ** n) / 2;
    S.t = cmp([1, 2, 3, 4], A, B, -1.4, 1.4, '遞迴', '公式', 1.6);
    cap('變回原本生成函數的形式', 'aₙ = (8ⁿ + 10ⁿ)/2 ✓');
  },
]);

scene('acA-18-ta2', 'Lec18（助教）：從第二項開始的遞迴（方法示意）', [
  async (tok, S) => { // 2659.0
    hot('這題從第二項開始（a₀、a₁ 是起始條件）', 0, 7.0);
    sm('（字幕不清，只示意方法；數字以黑板為準）', 0, 6.4);
    cap('這一題要注意：從第二項開始', '');
  },
  async (tok, S) => { // 2713.0
    S.c = chain(0, 5.6, 0.68, 7.6);
    S.c.add('Σₙ₌₂^∞ aₙxⁿ = G(x) − a₀ − a₁x', C.lilac);
    cap('從第二項開始加', '再把遞迴式代進去');
  },
  async (tok, S) => { // 2776.0
    S.c.add('aₙ₋₁ 那塊提 x，aₙ₋₂ 那塊提 x²：指數對齊');
    cap('指數要跟下標一樣', 'n − 1 提一個 x，n − 2 提 x²');
  },
  async (tok, S) => { // 2830.0
    S.c.add('Σₙ₌₂ aₙ₋₁xⁿ⁻¹ = G(x) − a₀（沒掃到 a₀）');
    cap('變數變換後從第一項開始', '沒掃到的前面項要扣掉');
  },
  async (tok, S) => { // 2903.0
    S.c.add('整理後分母：1 − 7x + 10x²', C.peach);
    cap('整理後分母是 1 − 7x + 10x²', '（依字幕）');
  },
  async (tok, S) => { // 2950.0
    const ok = [0.1, 0.3, 2].every((x) => Math.abs((1 - 2 * x) * (1 - 5 * x) - (1 - 7 * x + 10 * x * x)) < 1e-12);
    S.c.add('1 − 7x + 10x² = (1 − 2x)(1 − 5x)' + (ok ? ' ✓' : ' ✘'));
    cap('分母要因式分解', '(1 − 2x)(1 − 5x)');
  },
  async (tok, S) => { // 3007.0
    S.c.add('拆成 A/(1 − 2x) + B/(1 − 5x)，通分比較係數', C.lilac);
    cap('部分分式，再比較係數', '解出 A、B');
  },
  async (tok, S) => { // 3207.0
    const m = S.c.add('展開：aₙ = A·2ⁿ + B·5ⁿ', C.mint); glow(m, OKG);
    cap('每一塊都是等比級數', 'aₙ = A·2ⁿ + B·5ⁿ 的形式');
  },
]);

scene('acA-18-ta3', 'Lec18（助教）：分母有平方項的部分分式（方法示意）', [
  async (tok, S) => { // 3341.0
    hot('下一題：一樣從第二項開始，代入原本的遞迴', 0, 7.0);
    sm('（字幕不清，只示意方法）', 0, 6.4);
    cap('從第二項開始加', '代入原本的遞迴式');
  },
  async (tok, S) => { // 3490.0
    S.c = chain(0, 5.6, 0.66, 7.6);
    S.c.add('變數變換時要注意：每一塊從第幾項開始', C.lemon);
    cap('做變數變換時要特別注意', '');
  },
  async (tok, S) => { // 3542.0
    S.c.add('每一塊都寫成 G(x) 再扣掉沒掃到的項');
    cap('每一塊都寫成 G(x)', '扣掉沒掃到的前幾項');
  },
  async (tok, S) => { // 3644.0
    S.c.add('從第二項開始 → 前面兩項 a₀ + a₁x 要扣掉');
    cap('從第二項開始算', '前面這兩項要扣掉');
  },
  async (tok, S) => { // 4057.0
    S.c.add('分母是三次 → 先因式分解', C.peach);
    cap('分母是三次', '要先因式分解');
  },
  async (tok, S) => { // 4109.0
    S.c.add('猜因式：代 1、−1、2…；代進去 = 0 的就是根');
    cap('猜因式：代 1、−1 看看', '代進去等於 0 就是因式');
  },
  async (tok, S) => { // 4189.0
    S.c.add('依字幕：分母 = (1 + x)(1 − 2x)²');
    cap('除下來：有一個平方項', '（依字幕）');
  },
  async (tok, S) => { // 4233.0
    const m = S.c.add('A/(1 + x) + B/(1 − 2x) + C/(1 − 2x)²', C.lilac); glow(m, HL);
    cap('有平方項：要多拆一個', 'B/(1 − 2x) 和 C/(1 − 2x)² 都要');
  },
  async (tok, S) => { // 4300.0
    S.c.add('全部通分，比較係數 → 解出 A、B、C');
    cap('全部通分', '比較係數，解出 A、B、C');
  },
  async (tok, S) => { // 4329.0
    gone(S.c.ls);
    const g = pset(range(0, 8), 8), co = pmul(g, g, 8);
    const m = card('1/(1 − x)² 的 xⁿ 係數 = n + 1 → 1/(1 − 2x)² 的是 (n + 1)·2ⁿ', C.mint, 0, 5.6, 7.6); glow(m, OKG);
    const ok = co.slice(0, 6).every((v, n) => v === n + 1);
    (ok ? good : bad)(ok ? '1, 2, 3, 4, 5, 6 ✓' : '✘', 0, 4.8);
    cap('1/(1 − x)² 怎麼展開？', '係數是 n + 1');
  },
]);

// ════════ DGYCglldsAY（易志偉 Lec19：排容應用（語言課、onto、derangement）與關係 relation） ════════
// three-set Venn diagram with region counts
const V3C = [[-1.3, 3.9], [1.3, 3.9], [0, 1.8]];
function venn3(names, r = 2.0) {
  const all = [];
  V3C.forEach(([x, y], i) => { all.push(ring(x, y, r, ['#4b9ee2', '#dd8238', '#2fc092'][i])); all.push(disc(x, y, r, ['#4b9ee2', '#dd8238', '#2fc092'][i], 0.1)); });
  all.push(hd(names[0], -3.4, 5.6), hd(names[1], 3.4, 5.6), hd(names[2], 0, -0.6));
  return all;
}
// region label positions: S only, F only, R only, SF, SR, FR, SFR
const VPOS = { s: [-2.1, 4.5], f: [2.1, 4.5], r: [0, 0.9], sf: [0, 4.7], sr: [-1.35, 2.5], fr: [1.35, 2.5], sfr: [0, 3.25] };
// relations on {1,2,3,4} (Rosen 9.1 例題的 R₁…R₆)
const RS = {
  R1: [[1, 1], [1, 2], [2, 1], [2, 2], [3, 4], [4, 1], [4, 4]], R2: [[1, 1], [1, 2], [2, 1]],
  R3: [[1, 1], [1, 4], [2, 2], [3, 3], [4, 1], [4, 4]], R4: [[2, 1], [3, 1], [3, 2], [4, 1], [4, 2], [4, 3]],
  R5: [[1, 1], [1, 2], [1, 3], [1, 4], [2, 2], [2, 3], [2, 4], [3, 3], [3, 4], [4, 4]], R6: [[3, 4]],
};
const hasP = (r, a, b) => r.some((p) => p[0] === a && p[1] === b);
const A4 = [1, 2, 3, 4];
const isRefl = (r, A = A4) => A.every((a) => hasP(r, a, a));
const isIrr = (r, A = A4) => A.every((a) => !hasP(r, a, a));
const isSym = (r) => r.every(([a, b]) => hasP(r, b, a));
const isAnti = (r) => r.every(([a, b]) => a === b || !hasP(r, b, a));
const isTrans = (r) => r.every(([a, b]) => r.every(([c, d]) => c !== b || hasP(r, a, d)));
const pairs = (r) => '{' + r.map(([a, b]) => '(' + a + ',' + b + ')').join(' ') + '}';
// a table: rows of relation names with ✓/✘ per property (pairs written compactly: 12 = (1,2))
// R₁…R₆ table: name, its pairs (left-aligned), then one ✓/✘ column per property (columns clear of the longest pair list)
const COLX = (i) => 2.9 + i * 1.3, ROWH = 0.95;
function propTable(names, tests, x0, y0) {
  const all = [];
  names.forEach((nm, i) => { all.push(hd(nm.replace('R', 'R') , -6.3, y0 - i * ROWH)); all.push(tag(RS[nm].map(([a, b]) => '' + a + b).join(' '), 'idx', -2.0, y0 - i * ROWH)); }); // pairs centred in their column
  return { all, mark(col, fn) { names.forEach((nm, i) => all.push((fn(RS[nm]) ? good : bad)(fn(RS[nm]) ? '✓' : '✘', COLX(col), y0 - i * ROWH))); } };
}
// a little digraph on nodes 1..4 placed on a square
const DG = { 1: [-1, 1], 2: [1, 1], 3: [-1, -1], 4: [1, -1] };
function digraph(r, cx, cy, s = 1.2) {
  const all = [];
  const P = (k) => V3(cx + DG[k][0] * s, cy + DG[k][1] * s, 0);
  A4.forEach((k) => { const m = tile(String(k), C.sky, P(k).x, P(k).y, 0.5); all.push(m); });
  r.forEach(([a, b]) => {
    if (a === b) { all.push(ring(P(a).x + (DG[a][0]) * 0.42, P(a).y + (DG[a][1]) * 0.42, 0.24, '#c08a1f')); return; }
    const pa = P(a), pb = P(b), d = pb.clone().sub(pa).normalize(), nrm = V3(-d.y, d.x, 0).multiplyScalar(hasP(r, b, a) ? 0.12 : 0);
    all.push(arrow(pa.clone().add(d.clone().multiplyScalar(0.34)).add(nrm), pb.clone().sub(d.clone().multiplyScalar(0.34)).add(nrm), 0x6e5f49));
  });
  return all;
}
// a 0-1 matrix of a relation
function matrix(rowsN, colsN, has, x0, y0, d = 0.62) {
  const all = [];
  colsN.forEach((c, j) => all.push(sm(String(c), x0 + j * d, y0 + 0.55)));
  rowsN.forEach((rn, i) => { all.push(sm(String(rn), x0 - 0.75, y0 - i * d)); colsN.forEach((c, j) => { const v = has(rn, c) ? 1 : 0; all.push(tile(String(v), v ? C.mint : C.gray, x0 + j * d, y0 - i * d, 0.52)); }); });
  return all;
}

scene('acA-19-lang', 'Lec19：三門語言課——三個集合的排容', [
  async (tok, S) => { // 8.0
    S.d = { s: 1232, f: 879, r: 114, sf: 103, sr: 23, fr: 14, u: 2092 };
    S.l = [card('|S| = 1232（西班牙語）', C.sky, -4.0, 7.0, 4.0)];
    cap('1232 個學生修西班牙語', '（數字依課本例題，字幕不太清楚）');
  },
  async (tok, S) => { // 9.0
    S.l.push(card('|F| = 879（法語）', C.peach, 0.2, 7.0, 3.2));
    cap('879 個修法語', '');
  },
  async (tok, S) => { // 10.0
    S.l.push(card('|R| = 114（俄語）', C.mint, 4.2, 7.0, 3.2));
    cap('114 個修俄語', '');
  },
  async (tok, S) => { // 11.0
    S.l.push(card('|S ∩ F| = 103', C.lilac, -4.0, 6.2, 2.8));
    cap('103 個同時修西班牙語和法語', '');
  },
  async (tok, S) => { // 13.0
    S.l.push(card('|S ∩ R| = 23', C.lilac, 0.2, 6.2, 2.6));
    cap('23 個修西班牙語和俄語', '');
  },
  async (tok, S) => { // 37.0
    S.l.push(card('|F ∩ R| = 14', C.lilac, 4.2, 6.2, 2.6));
    cap('14 個修法語和俄語', '');
  },
  async (tok, S) => { // 41.0
    S.u = card('至少修一門：|S ∪ F ∪ R| = 2092', C.lemon, 0, 5.4, 5.4); lit(S.u);
    cap('總共 2092 個學生至少修了一門', '');
  },
  async (tok, S) => { // 51.0
    dark(S.u);
    S.q = hot('三門都修的有幾個？|S ∩ F ∩ R| = ?', 0, 4.6);
    cap('三門課都修的有幾個？', '可能是外語系的學生');
  },
  async (tok, S) => { // 77.0
    gone(S.q);
    note('敘述很長 → 先用集合表示，就是排容原理', 0, 4.6);
    cap('其實就是排容原理', '先把事件用集合表示');
  },
  async (tok, S) => { // 94.0
    S.v = venn3(['S 西', 'F 法', 'R 俄'], 1.8);
    cap('西班牙語 S、法語 F、俄語 R', '把敘述寫成集合');
  },
  async (tok, S) => { // 136.0
    sm('講義寫顛倒：at least one = 聯集，不是交集', 4.6, 0.4);
    cap('講義打錯了：at least one 是聯集', '題目要問的才是交集');
  },
  async (tok, S) => { // 175.0
    S.c = card('2092 = 1232 + 879 + 114 − 103 − 23 − 14 + x', C.sky, 0, -1.4, 7.2); lit(S.c);
    cap('in all three languages：交集', '套用三個集合的排容公式');
  },
  async (tok, S) => { // 210.0
    dark(S.c);
    const d = S.d, x = d.u - d.s - d.f - d.r + d.sf + d.sr + d.fr;
    const reg = { sfr: x, sf: d.sf - x, sr: d.sr - x, fr: d.fr - x };
    reg.s = d.s - reg.sf - reg.sr - x; reg.f = d.f - reg.sf - reg.fr - x; reg.r = d.r - reg.sr - reg.fr - x;
    const tot = Object.values(reg).reduce((a, b) => a + b, 0);
    Object.keys(reg).forEach((k) => tag(String(reg[k]), k === 'sfr' ? 'ptr alt' : 'idx', VPOS[k][0], VPOS[k][1] + 0.0));
    S.a = card('x = |S ∩ F ∩ R| = ' + x, C.mint, 0, -2.2, 3.8); glow(S.a, OKG);
    (tot === d.u ? good : bad)('七塊加起來 = ' + tot + (tot === d.u ? ' ✓' : ' ✘'), 4.6, -2.2);
    cap('解出來：三門都修的有 7 個', '');
  },
]);

scene('acA-19-onto', 'Lec19：6 個元素到 3 個元素的 onto 函數 = 540', [
  async (tok, S) => { // 221.0
    hot('函數：一對一的有幾個？全部有幾個？', 0, 7.0);
    cap('以前講函數', '一對一函數幾個、所有函數幾個');
  },
  async (tok, S) => { // 238.0
    note('一直避開：映成（onto）函數有幾個？', 0, 6.3);
    cap('一直避開：映成函數有幾個', '排容提供一個方法');
  },
  async (tok, S) => { // 256.0
    S.dom = range(1, 6).map((k) => tile('x' + sub(k), C.sky, -4.4, 5.3 - k * 0.6, 0.48));
    S.cod = [1, 2, 3].map((k) => tile(String(k), C.peach, -1.6, 4.4 - k * 0.9, 0.6));
    sm('定義域 6 個', -4.4, 1.1); sm('對應域 3 個', -1.6, 0.6);
    cap('從 6 個元素的集合對到 3 個元素', '定義域與對應域的大小');
  },
  async (tok, S) => { // 286.0
    const f = [1, 2, 3, 1, 2, 2];  // 示意的一個 onto 函數
    S.ar = f.map((v, i) => arrow(S.dom[i].position.clone().add(V3(0.3, 0, 0)), S.cod[v - 1].position.clone().add(V3(-0.35, 0, 0)), 0x6e5f49));
    sm('示意：一個 onto 函數', -3.0, 5.6);
    cap('映成：對應域每一個都要被對到', '被對到幾次沒關係');
  },
  async (tok, S) => { // 298.0
    gone(S.ar);
    S.c = chain(2.6, 5.4, 0.64, 6.0);
    S.c.add('直接想很難 → 用排除法', C.lemon);
    cap('直接想很難', '用排除法');
  },
  async (tok, S) => { // 307.0
    S.c.add('P₁ = 沒有對到 1 的函數');
    cap('P₁：沒有對到 1 的那些函數', '');
  },
  async (tok, S) => { // 328.0
    S.c.add('P₂ = 沒對到 2；P₃ = 沒對到 3');
    cap('P₂：沒對到 2；P₃：沒對到 3', '');
  },
  async (tok, S) => { // 351.0
    sm('三種狀況都不能發生', 2.6, 3.0);
    cap('這三種狀況都不能發生', '1、2、3 都不能沒被對到');
  },
  async (tok, S) => { // 368.0
    S.c.add('onto 個數 = |U| − |P₁ ∪ P₂ ∪ P₃|', C.lilac);
    cap('排除 P₁、P₂、P₃ 裡所有函數', '就是補集：全部減掉聯集');
  },
  async (tok, S) => { // 386.0
    S.c.add('|U| = 所有函數 = 3⁶ = ' + 3 ** 6);
    cap('所有函數：每個都有 3 種選擇', '3⁶ 個');
  },
  async (tok, S) => { // 411.0
    gone(S.c.ls, S.dom, S.cod);
    S.c = chain(0, 5.6, 0.68, 8.6);
    S.c.add('|P₁ ∪ P₂ ∪ P₃| = Σ|Pᵢ| − Σ|Pᵢ ∩ Pⱼ| + |P₁ ∩ P₂ ∩ P₃|', C.lilac);
    cap('集中精力對付後面：用排容展開', '');
  },
  async (tok, S) => { // 413.0
    S.c.add('|P₁|：1 拿掉，只剩 2 個可對 → 2⁶');
    cap('P₁：1 沒被對到 → 把 1 拿掉', '只剩 2 個可以用：2⁶');
  },
  async (tok, S) => { // 452.0
    S.c.add('三個這種集合：C(3, 1)·2⁶ = ' + 3 * 64);
    cap('這種集合有三個：三取一', '每個大小都是 2⁶');
  },
  async (tok, S) => { // 474.0
    S.c.add('|P₁ ∩ P₂|：只剩 3 可對 → 1⁶；共 C(3, 2) 個 → ' + 3 * 1);
    cap('P₁ ∩ P₂：1、2 都不能被對到', '剩 3 → 1⁶；三取二有 3 種');
  },
  async (tok, S) => { // 519.0
    S.c.add('|P₁ ∩ P₂ ∩ P₃|：0 個可對 → 0⁶ = 0；C(3, 3) = 1');
    cap('三個都不能被對到 → 0⁶ = 0', '不可能，但還是照列');
  },
  async (tok, S) => { // 547.0
    let bf = 0; for (let f = 0; f < 729; f++) { const s = new Set(); let x = f; for (let i = 0; i < 6; i++) { s.add(x % 3); x = Math.floor(x / 3); } if (s.size === 3) bf++; }
    const v = 3 ** 6 - 3 * 2 ** 6 + 3 * 1 ** 6 - 0;
    const m = S.c.add('3⁶ − C(3,1)2⁶ + C(3,2)1⁶ − C(3,3)0⁶ = 729 − 192 + 3 − 0 = ' + v, C.mint); glow(m, OKG);
    (v === bf ? good : bad)('電腦暴力列舉 3⁶ 個函數：onto 有 ' + bf + ' 個 ' + (v === bf ? '✓' : '✘'), 0, 1.0);
    cap('全部算出來：540 個', '');
  },
  async (tok, S) => { // 552.0
    sm('對應域 4 個 → P₁…P₄；5 個 → P₁…P₅，規律一樣', 0, 0.3);
    cap('對應域有 4 個、5 個', '就要 P₁ 到 P₄、P₅，規律相同');
  },
  async (tok, S) => { // 597.0
    const m = card('m 個 → n 個的 onto 函數 = Σᵢ₌₀ⁿ (−1)ⁱ C(n, i)(n − i)ᵐ', C.lilac, 0, -0.6, 8.0); lit(m);
    cap('回去自己歸納一個通式', 'i = 0 到 n 的 Σ');
  },
]);

scene('acA-19-der', 'Lec19：derangement（錯排）', [
  async (tok, S) => { // 637.0
    hot('重排（permutation）', 0, 7.0);
    cap('還有一個數學問題：重排', '');
  },
  async (tok, S) => { // 645.0
    sm('線性代數的行列式也可以用重排來講', 0, 6.4);
    cap('線性代數講行列式時', '有一種講法就是用重排');
  },
  async (tok, S) => { // 661.0
    sm('每一列取一個元素、每一行也只能取一個 → 就是一種排列', 0, 5.9);
    cap('每一列取一個，每一行也只取一個', '乘起來、加正負號再加總');
  },
  async (tok, S) => { // 698.0
    S.top = [1, 2, 3, 4, 5].map((k, i) => tile(String(k), C.sky, -2.4 + i * 1.2, 4.8, 0.7));
    S.bot = [3, 1, 2, 5, 4].map((k, i) => tile(String(k), C.peach, -2.4 + i * 1.2, 3.6, 0.7));
    sm('位置', -3.7, 4.8); sm('排列（示意）', -3.9, 3.6);
    cap('1、2、3、4、5 打亂', '就叫一個重排');
  },
  async (tok, S) => { // 722.0
    S.d = card('derangement：i 不能在第 i 個位置', C.lilac, 0, 2.5, 5.6); lit(S.d);
    S.dn = sm('上面的示意 3 1 2 5 4：沒有人在原位 ✓', 0, 1.8);
    cap('derangement：比重排更嚴格', '1 不在第 1 個、…、5 不在第 5 個');
  },
  async (tok, S) => { // 764.0
    gone(S.d, S.dn, S.top, S.bot); // the derivation list takes this space
    S.c = chain(0, 5.0, 0.68, 7.6);
    S.c.add('排除法：Pᵢ = i 在第 i 個位置的排列', C.lemon);
    cap('做法跟剛才一樣：排除法', 'Pᵢ：i 剛好在第 i 個位置');
  },
  async (tok, S) => { // 798.0
    S.c.add('U = 所有排列，|U| = n!');
    cap('U 是所有排列', 'n! 個');
  },
  async (tok, S) => { // 851.0
    S.c.add('Dₙ = n! − |P₁ ∪ P₂ ∪ ⋯ ∪ Pₙ|', C.lilac);
    cap('把 P₁ 到 Pₙ 一次扣掉', '用排容展開聯集');
  },
  async (tok, S) => { // 866.0
    S.c.add('|Pᵢ| = (n − 1)!，有 C(n, 1) 個');
    cap('挑一個 i 固定：C(n, 1) 種', '其他 n − 1 個隨便排：(n − 1)!');
  },
  async (tok, S) => { // 877.0
    S.c.add('|Pᵢ ∩ Pⱼ| = (n − 2)!，有 C(n, 2) 個');
    cap('挑兩個固定：C(n, 2) 種', '每一種 (n − 2)!');
  },
  async (tok, S) => { // 898.0
    S.c.add('C(n, 1)(n − 1)! = n!/1!');
    cap('C(n, 1) 乘 (n − 1)!', '湊成 n!/1!');
  },
  async (tok, S) => { // 913.0
    S.c.add('C(n, 2)(n − 2)! = n!/2!');
    cap('C(n, 2) 乘 (n − 2)!', '也湊成 n!/2!');
  },
  async (tok, S) => { // 941.0
    const m = S.c.add('Dₙ = n![1 − 1/1! + 1/2! − 1/3! + ⋯ + (−1)ⁿ/n!]', C.mint); glow(m, OKG);
    const perm = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    const bf = perm([1, 2, 3, 4, 5]).filter((p) => p.every((v, i) => v !== i + 1)).length;
    let f = 0; for (let k = 0; k <= 5; k++) f += (-1) ** k / fact(k); f = Math.round(fact(5) * f);
    (f === bf ? good : bad)('示意：n = 5 → 公式 ' + f + '，暴力列舉 120 種排列也是 ' + bf + (f === bf ? ' ✓' : ' ✘'), 0, -0.6);
    cap('把 n! 全部提出來', '得到錯排公式');
  },
]);

scene('acA-19-rel', 'Lec19：關係（relation）= A × B 的子集', [
  async (tok, S) => { // 982.0
    hot('今天要講：關係（relations）', 0, 7.0);
    cap('今天要講關係：relations', '');
  },
  async (tok, S) => { // 997.0
    S.A = card('A = {1, 2, 3}', C.sky, -3.2, 6.1, 2.8); S.B = card('B = {a, b}', C.peach, 2.0, 6.1, 2.4);
    cap('還記得笛卡兒積（直積）嗎？', 'A = {1, 2, 3}，B = {a, b}');
  },
  async (tok, S) => { // 1012.0
    S.prs = []; [1, 2, 3].forEach((x, i) => ['a', 'b'].forEach((y, j) => S.prs.push(tile('(' + x + ',' + y + ')', C.lilac, -2.4 + j * 1.4, 4.9 - i * 0.8, 0.95))));
    sm('A × B 有 3 × 2 = 6 個元素，每個是一對 (a, b)', 2.8, 4.1);
    cap('A × B 裡有幾個元素？', '6 個，每個都是兩個湊成的一對');
  },
  async (tok, S) => { // 1057.0
    [0, 3, 4].forEach((i) => lit(S.prs[i], OKG));
    S.r = card('關係 = A × B 的一個子集（示意：挑了 3 個）', C.mint, 0, 1.9, 6.6); glow(S.r, OKG);
    cap('今天的關係就是在講這個', '直積的子集合');
  },
  async (tok, S) => { // 1145.0
    sm('關係的符號都用 R', 0, 1.2);
    cap('我們用 R 來表示關係', '');
  },
  async (tok, S) => { // 1193.0
    S.e = card('(1, a) ∈ R  寫成  1 R a：1 跟 a 有關係', C.sky, 0, 0.4, 6.6); lit(S.e);
    cap('(1, a) 在 R 裡', '通常寫成 1 R a：1 跟 a 有關係');
  },
  async (tok, S) => { // 1222.0
    dark(S.e);
    bad('順序不能對調：(1, a) ≠ (a, 1)', 0, -0.4);
    cap('座標不能交換', '前後順序不能換');
  },
  async (tok, S) => { // 1248.0
    const m = card('R ⊆ A × B：R 是「從 A 到 B」的關係', C.mint, 0, -1.2, 6.4); glow(m, OKG);
    cap('再重複一次', 'A × B 的子集，叫做從 A 到 B 的關係');
  },
]);

scene('acA-19-relex', 'Lec19：函數、<、≤ 都是關係', [
  async (tok, S) => { // 1283.0
    hot('有什麼用？函數也是關係的一種', 0, 7.0);
    cap('這有什麼用？', '函數其實也是關係的一種，只是加了限制');
  },
  async (tok, S) => { // 1303.0
    S.a = [1, 2, 3].map((k, i) => tile(String(k), C.sky, -3.0, 5.6 - i * 1.0, 0.6));
    S.b = ['a', 'b', 'c'].map((k, i) => tile(k, C.peach, 0, 5.6 - i * 1.0, 0.6));
    S.ar = [[0, 0], [1, 1], [2, 2]].map(([i, j]) => arrow(S.a[i].position.clone().add(V3(0.35, 0, 0)), S.b[j].position.clone().add(V3(-0.35, 0, 0)), 0x6e5f49));
    S.f = card('R = {(1, a), (2, b), (3, c)}', C.mint, 3.9, 4.6, 4.2);
    cap('1 對到 a、2 對到 b、3 對到 c', '寫成集合，長得就像函數');
  },
  async (tok, S) => { // 1340.0
    note('關係 = 函數的擴充（更廣泛）', 3.9, 3.7);
    cap('關係是函數的擴充', '不一定長得像函數');
  },
  async (tok, S) => { // 1369.0
    sm('這種左右兩排、畫線的圖：關係的圖示法', -1.5, 2.5);
    cap('這是關係的圖示法', '');
  },
  async (tok, S) => { // 1396.0
    gone(S.ar, S.f);
    S.ar = [[0, 0], [0, 2], [1, 0], [1, 1]].map(([i, j]) => arrow(S.a[i].position.clone().add(V3(0.35, 0, 0)), S.b[j].position.clone().add(V3(-0.35, 0, 0)), 0xc08a1f));
    S.f = card('R₁ = {(1, a), (1, c), (2, a), (2, b), …}', C.lemon, 3.9, 4.6, 4.8);
    sm('（示意：字幕聽到的幾條線）', 3.9, 3.9);
    cap('也可以隨便畫線', '1 對兩個、3 沒有對到也沒事');
  },
  async (tok, S) => { // 1469.0
    gone(S.a, S.b, S.ar, S.f);
    S.d = card('binary relation from A to B：R ⊆ A × B，a R b', C.sky, 0, 5.0, 7.0); lit(S.d);
    sm('二元：牽涉 A、B 兩個集合；不一定是函數', 0, 4.3);
    cap('英文定義：binary relation', '因為牽涉兩個集合');
  },
  async (tok, S) => { // 1567.0
    dark(S.d);
    S.lt = card('「<」也是關係：{(a, b) ∈ ℕ × ℕ ：a < b}', C.peach, 0, 3.3, 6.6); lit(S.lt);
    cap('小於也是一種關係', '(a, b) 屬於它就表示 a < b');
  },
  async (tok, S) => { // 1618.0
    dark(S.lt);
    S.le = card('「≤」也是：所有 a ≤ b 的配對', C.peach, 0, 2.5, 5.4); lit(S.le);
    cap('小於等於也可以看成關係', '');
  },
  async (tok, S) => { // 1635.0
    dark(S.le);
    S.ex = card('A = {0, 1, 2}，B = {a, b}：R = {(0, a), (0, b), (1, a), (2, b)}', C.mint, 0, 1.6, 7.6); lit(S.ex);
    cap('再看一個例子', '第一個都從 A 來，第二個都從 B 來');
  },
  async (tok, S) => { // 1659.0
    dark(S.ex);
    S.tw = card('A = 全台鄉鎮市區，B = 全台縣市', C.sky, 0, 0.6, 5.6);
    sm('東區、北區、香山區 → 新竹市；寶山、北埔 → 新竹縣', 0, -0.1);
    cap('關係很有用', 'A 是 360 幾個鄉鎮區，B 是縣市');
  },
  async (tok, S) => { // 1757.0
    const m = card('R = {(a, b) ：a 位在 b 裡} → 「隸屬」關係', C.mint, 0, -0.9, 6.6); glow(m, OKG);
    cap('寫一個關係：a 屬於 b', '隸屬關係這個名詞就是這樣來的');
  },
]);

scene('acA-19-inv', 'Lec19：補關係與反關係', [
  async (tok, S) => { // 1824.0
    hot('關係是集合 → 集合運算都能用', 0, 7.0);
    cap('關係是用集合定義的', '以前的集合運算都可以用');
  },
  async (tok, S) => { // 1841.0
    S.c = card('補關係 R̄ = (A × B) − R：原本「沒有關係」的配對', C.sky, 0, 6.0, 7.2); lit(S.c);
    cap('補集：原本沒關係的配對', '全部拿出來');
  },
  async (tok, S) => { // 1851.0
    dark(S.c);
    S.e = card('(信義區, 新竹縣) ∉ R → ∈ R̄', C.lemon, 0, 5.0, 5.0); lit(S.e);
    cap('台北的信義區不在新竹縣', '所以這一對在 R 的補集裡');
  },
  async (tok, S) => { // 1876.0
    dark(S.e);
    S.i = card('反關係 R⁻¹', C.lilac, 0, 3.8, 2.6); lit(S.i);
    cap('再來定義反關係', '');
  },
  async (tok, S) => { // 1887.0
    sm('像反函數：A → B 的函數，反函數是 B → A（1 → 5 變 5 → 1）', 0, 3.1);
    cap('有點像反函數', '自變數、因變數對調');
  },
  async (tok, S) => { // 1926.0
    dark(S.i);
    S.f = card('R ⊆ A × B → R⁻¹ = {(b, a) ：(a, b) ∈ R} ⊆ B × A', C.lilac, 0, 2.2, 7.4); lit(S.f);
    cap('從 B 到 A', '把每一對的順序顛倒過來就好');
  },
  async (tok, S) => { // 1945.0
    dark(S.f);
    const m = card('「<」的反關係 = 「>」', C.mint, 0, 1.0, 3.8); glow(m, OKG);
    cap('小於的反關係', '就是大於');
  },
]);

scene('acA-19-div', 'Lec19：{1,…,5} 上的整除關係、補關係、反關係', [
  async (tok, S) => { // 1968.0
    S.t = hot('A = {1, 2, 3, 4, 5}，A 到 A：R = {(a, b) ：a 整除 b}', 0, 7.0);
    cap('純粹用集合的眼光來看', 'A = {1, 2, 3, 4, 5}，從 A 到 A');
  },
  async (tok, S) => { // 1993.0
    const A = [1, 2, 3, 4, 5]; S.A = A;
    S.R = []; A.forEach((a) => A.forEach((b) => { if (b % a === 0) S.R.push([a, b]); }));
    S.m = matrix(A, A, (a, b) => b % a === 0, -5.6, 5.6, 0.6);
    sm('R（列 a、行 b）', -4.4, 6.5);
    S.rl = card('R：' + S.R.length + ' 對', C.mint, -4.4, 2.0, 2.0);
    cap('a 可以整除 b 的配對列出來', '1 整除 1、2、3、4、5…');
  },
  async (tok, S) => { // 2006.0
    sm('問：R 的補關係？反關係？', 0, 1.2);
    cap('問 R 的補關係是什麼', '反關係是什麼');
  },
  async (tok, S) => { // 2015.0
    const A = S.A;
    S.mc = matrix(A, A, (a, b) => b % a !== 0, -1.2, 5.6, 0.6);
    sm('R̄（0 ↔ 1 對調）', 0, 6.5);
    cap('補關係：A × A 裡不在 R 的', '一開頭的都在 R 裡，所以 R̄ 沒有');
  },
  async (tok, S) => { // 2077.0
    S.cl = card('R̄：' + (25 - S.R.length) + ' 對', C.peach, 0, 2.0, 2.0);
    cap('(2,1)、(2,3)、(2,5)、(3,1)…', '這就是補關係');
  },
  async (tok, S) => { // 2080.0
    const A = S.A;
    S.mi = matrix(A, A, (a, b) => a % b === 0, 3.2, 5.6, 0.6);
    sm('R⁻¹（沿對角線翻過來）', 4.4, 6.5);
    card('R⁻¹：' + S.R.length + ' 對', C.lilac, 4.4, 2.0, 2.0);
    cap('反關係：每一對對調', '(1,1) 還是 (1,1)，(1,2) 變 (2,1)…');
  },
  async (tok, S) => { // 2099.0
    const tot = S.R.length + (25 - S.R.length);
    const m = card('|R| + |R̄| = ' + S.R.length + ' + ' + (25 - S.R.length) + ' = ' + tot + ' = |A × A| = 5²', C.mint, 0, 0.9, 6.8); glow(m, OKG);
    cap('R 跟補關係加起來', '= A × A 的全部元素');
  },
]);

scene('acA-19-setop', 'Lec19：關係的聯集、交集、差集', [
  async (tok, S) => { // 2160.0
    hot('兩個關係可以做聯集、交集', 0, 7.0);
    cap('兩個關係可以做聯集、交集', '');
  },
  async (tok, S) => { // 2177.0
    sm('(a, b) ∈ R₁ ∪ R₂：在 R₁ 或在 R₂ 有關係；∈ R₁ ∩ R₂：兩個都有', 0, 6.4);
    cap('聯集：要嘛 R₁ 有關係，要嘛 R₂ 有', '交集：R₁、R₂ 都有關係');
  },
  async (tok, S) => { // 2204.0
    sm('也有差集', 0, 5.9);
    cap('也有差集的運算', '');
  },
  async (tok, S) => { // 2209.0
    S.R1 = [[1, 1], [2, 2], [3, 3]]; S.R2 = [[1, 1], [1, 2], [1, 3], [1, 4]];
    card('R₁ = {(1,1), (2,2), (3,3)}', C.sky, -3.0, 5.1, 4.2); card('R₂ = {(1,1), (1,2), (1,3), (1,4)}', C.peach, 2.6, 5.1, 5.0);
    sm('A = {1, 2, 3}，B = {1, 2, 3, 4}', 0, 4.4);
    cap('R₁、R₂ 的定義', '');
  },
  async (tok, S) => { // 2215.0
    const key = (p) => p.join(','), k2 = new Set(S.R2.map(key)), k1 = new Set(S.R1.map(key));
    S.un = [...S.R1, ...S.R2.filter((p) => !k1.has(key(p)))].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    S.it = S.R1.filter((p) => k2.has(key(p))); S.d12 = S.R1.filter((p) => !k2.has(key(p))); S.d21 = S.R2.filter((p) => !k1.has(key(p)));
    card('R₁ ∪ R₂ = ' + pairs(S.un), C.mint, 0, 3.5, 7.0);
    cap('聯集就是集合的聯集', '');
  },
  async (tok, S) => { // 2230.0
    card('R₁ ∩ R₂ = ' + pairs(S.it), C.mint, 0, 2.7, 3.6);
    cap('交集：兩個一樣的只有 (1, 1)', '');
  },
  async (tok, S) => { // 2236.0
    card('R₁ − R₂ = ' + pairs(S.d12), C.lemon, 0, 1.9, 4.4);
    cap('差集：在前一個、不在後一個', '刪去法：剩 (2,2) 和 (3,3)');
  },
  async (tok, S) => { // 2251.0
    card('R₂ − R₁ = ' + pairs(S.d21), C.lemon, 0, 1.1, 5.0);
    cap('反過來拿 R₁ 去刪 R₂', '(1,1) 被劃掉，剩 (1,2)、(1,3)、(1,4)');
  },
  async (tok, S) => { // 2260.0
    note('exclusive or 也可以：純粹當集合來看', 0, 0.2);
    cap('XOR 也都 OK', '關係就是 A × B 的子集，當集合看');
  },
]);

scene('acA-19-comp', 'Lec19：關係的個數與合成關係 S ∘ R', [
  async (tok, S) => { // 2282.0
    S.q = hot('|A| = m、|B| = n，A 到 B 可以定義幾個不同的關係？', 0, 7.0);
    cap('再出一個問題', 'A 到 B 總共可以定義幾個關係？');
  },
  async (tok, S) => { // 2307.0
    sm('關係 = A × B 的子集 → 問 A × B 有幾個子集', 0, 6.4);
    cap('關係就是 A × B 的子集合', '');
  },
  async (tok, S) => { // 2316.0
    const m = 2, n = 3; let cnt = 0; for (let s = 0; s < 2 ** (m * n); s++) cnt++;
    S.a = card('2^(|A|·|B|) = 2ᵐⁿ', C.mint, -2.4, 5.6, 3.0); glow(S.a, OKG);
    sm('示意：m = 2、n = 3 → 2⁶ = ' + cnt, 2.4, 5.6);
    cap('答案：2 的 |A| 乘 |B| 次方', '');
  },
  async (tok, S) => { // 2342.0
    gone(S.q);
    S.h = hot('合成關係（composite）：像合成函數', 0, 4.8);
    cap('像函數一樣，關係也能合成', '');
  },
  async (tok, S) => { // 2365.0
    sm('有方向性，從右邊代到左邊（像矩陣乘法）', 0, 4.2);
    cap('記得都有順序性', '從右邊代到左邊');
  },
  async (tok, S) => { // 2379.0
    S.A = [1, 2, 3].map((k, i) => tile(String(k), C.sky, -4.0, 3.2 - i * 1.0, 0.55));
    S.B = ['a', 'b', 'c'].map((k, i) => tile(k, C.peach, 0, 3.2 - i * 1.0, 0.55));
    S.C = ['x', 'y'].map((k, i) => tile(k, C.mint, 4.0, 2.7 - i * 1.0, 0.55));
    sm('A', -4.0, 3.9); sm('B', 0, 3.9); sm('C', 4.0, 3.9);
    cap('R 從 A 到 B，S 從 B 到 C', '共同的部分是 B');
  },
  async (tok, S) => { // 2390.0
    S.Rp = [[1, 'a'], [1, 'b'], [2, 'b'], [2, 'c']]; S.Sp = [['a', 'x'], ['a', 'y'], ['b', 'y']];
    const ai = (k) => k - 1, bi = (k) => ['a', 'b', 'c'].indexOf(k), ci = (k) => ['x', 'y'].indexOf(k);
    S.rA = S.Rp.map(([p, q]) => arrow(S.A[ai(p)].position.clone().add(V3(0.32, 0, 0)), S.B[bi(q)].position.clone().add(V3(-0.32, 0, 0)), 0x4b9ee2));
    S.sA = S.Sp.map(([p, q]) => arrow(S.B[bi(p)].position.clone().add(V3(0.32, 0, 0)), S.C[ci(q)].position.clone().add(V3(-0.32, 0, 0)), 0xdd8238));
    sm('R（藍，示意）', -2.0, 3.9); sm('S（橘，示意）', 2.0, 3.9);
    cap('合成關係是從 A 到 C', '中間的 B 到時候直接忽略');
  },
  async (tok, S) => { // 2413.0
    S.d = card('(a, c) ∈ S ∘ R ⇔ 有某個 b：a R b 且 b S c', C.lilac, 0, -0.4, 6.6); lit(S.d);
    cap('A 跟 C 有關係：中間有一個 b', '像兩個人中間有一個共同的朋友');
  },
  async (tok, S) => { // 2453.0
    dark(S.d);
    sm('寫法：S ∘ R（R 寫右邊、S 寫左邊），跟函數合成習慣一樣', 0, -1.1);
    cap('寫法：R 在右邊，S 在左邊', '跟函數合成的習慣一樣');
  },
  async (tok, S) => { // 2462.0
    S.out = [];
    cap('例子：一個一個去對', '');
  },
  async (tok, S) => { // 2485.0
    glow(S.A[0], HL); glow(S.B[0], HL); glow(S.C[0], HL);
    S.res = card('S ∘ R = {(1, x)', C.mint, 0, -2.0, 5.2);
    cap('1 跟 a 有關係，a 跟 x 有關係', '所以 (1, x)');
  },
  async (tok, S) => { // 2512.0
    glow(S.C[0], null); glow(S.C[1], HL);
    relab(S.res, 'S ∘ R = {(1, x), (1, y)');
    cap('1 → a，a → y', '所以 (1, y)');
  },
  async (tok, S) => { // 2519.0
    glow(S.B[0], null); glow(S.B[1], HL);
    sm('1 → b → y：(1, y) 已經有了，集合裡重複只留一個', 0, -2.7);
    cap('1 → b → y：又是 (1, y)', '已經有了，重複只留一個');
  },
  async (tok, S) => { // 2537.0
    glow(S.A[0], null); glow(S.A[1], HL);
    relab(S.res, 'S ∘ R = {(1, x), (1, y), (2, y)');
    cap('2 → b，b → y', '所以 (2, y)');
  },
  async (tok, S) => { // 2543.0
    glow(S.B[1], null); glow(S.B[2], HL); glow(S.C[1], null);
    const comp = []; S.Rp.forEach(([a, b]) => S.Sp.forEach(([b2, c]) => { if (b === b2 && !comp.some((p) => p[0] === a && p[1] === c)) comp.push([a, c]); }));
    relab(S.res, 'S ∘ R = {' + comp.map(([a, c]) => '(' + a + ', ' + c + ')').join(', ') + '}'); glow(S.res, OKG);
    cap('2 → c，但 S 沒有 c 開頭的', '所以不見了');
  },
]);

scene('acA-19-onset', 'Lec19：集合 A 上的關係有 2^(n²) 個', [
  async (tok, S) => { // 2571.0
    hot('relation on a set：A 到 A 的關係', 0, 7.0);
    cap('如果 A 跟 B 是同一個集合', '就說這是「在 A 上」的關係');
  },
  async (tok, S) => { // 2594.0
    sm('例：ℕ 上的「<」；{1, 2, 4} 上的「整除」', 0, 6.3);
    cap('像小於是自然數到自然數', '整除是 {1, 2, 4} 到 {1, 2, 4}');
  },
  async (tok, S) => { // 2612.0
    S.q = card('|A| = n，A 上的關係有幾個？', C.sky, 0, 5.3, 5.0); lit(S.q);
    cap('一個集合上的關係總共有幾個？', '');
  },
  async (tok, S) => { // 2622.0
    dark(S.q);
    const m = card('2^(n·n) = 2^(n²)', C.mint, 0, 4.2, 3.6); glow(m, OKG);
    cap('A 跟 B 都是同一個 A', '所以是 2 的 n 乘 n 次方');
  },
  async (tok, S) => { // 2692.0
    sm('= A × A 的子集個數；示意：n = 3 → 2⁹ = ' + 2 ** 9, 0, 3.4);
    cap('就是 A × A 的子集合個數', '2 的 |A × A| 次方');
  },
]);

scene('acA-19-refl', 'Lec19：反身性（reflexive）', [
  async (tok, S) => { // 2717.0
    hot('函數有一對一、映成…，關係也有幾個重要性質', 0, 7.0);
    cap('就像函數有一對一、映成', '關係也有幾個常拿來描述的性質');
  },
  async (tok, S) => { // 2746.0
    S.d = card('① 反身性 reflexive', C.lilac, 0, 6.2, 3.6); lit(S.d);
    cap('常講的有三個', '第一個叫反身性 reflexive');
  },
  async (tok, S) => { // 2757.0
    dark(S.d);
    S.f = card('∀a ∈ A：(a, a) ∈ R（每個元素都跟自己有關係）', C.sky, 0, 5.4, 7.0); lit(S.f);
    cap('A 中任何元素 a', '(a, a) 都要在 R 裡');
  },
  async (tok, S) => { // 2801.0
    dark(S.f);
    sm('A 到 A 時，不必畫兩排：直接在點上畫箭頭（有向圖）', 0, 4.7);
    cap('再介紹一個表示法', '兩邊都是 A，何必畫兩排');
  },
  async (tok, S) => { // 2846.0
    S.r = [[1, 2], [3, 4], [3, 3], [4, 1]];
    S.g = digraph(S.r, -2.6, 2.4, 1.1);
    S.rl = card('R = {(1,2), (3,4), (3,3), (4,1)}（示意）', C.peach, 2.8, 2.4, 5.0);
    cap('A = {1, 2, 3, 4}，隨便寫一個', '1→2、3→4、3 自己到自己、4→1');
  },
  async (tok, S) => { // 2911.0
    S.qq = sm('給這個圖，怎麼檢查有沒有反身性？', 2.8, 1.6);
    cap('給你圖，怎麼檢查反身性？', '');
  },
  async (tok, S) => { // 2949.0
    S.need = card('需要 (1,1)、(2,2)、(3,3)、(4,4)', C.lemon, 2.8, 0.9, 5.0); lit(S.need);
    cap('1、2、3、4 都要跟自己有關係', '');
  },
  async (tok, S) => { // 2984.0
    dark(S.need);
    (isRefl(S.r) ? good : bad)(isRefl(S.r) ? '✓' : '缺 (1,1) 等 → 沒有反身性 ✘', 2.8, 0.2);
    cap('這裡沒有 (1, 1)', '缺一個就不是：沒有反身性');
  },
  async (tok, S) => { // 3009.0
    gone(S.g); S.g = digraph([[1, 1], [2, 2], [3, 3], [4, 4], [1, 2]], -2.6, 2.4, 1.1);
    sm('反身：每個點都有自己繞一圈（示意）', -2.6, 0.5);
    cap('圖上：每個點都有自己繞一圈', '其他的線怎麼畫都不管');
  },
  async (tok, S) => { // 3046.0
    S.lt = card('「<」：a < a 不成立 → 沒有反身性 ✘', C.rose, 0, -0.6, 5.6);
    cap('小於有沒有反身性？', '自己不會小於自己：沒有');
  },
  async (tok, S) => { // 3075.0
    S.le = card('「≤」：a ≤ a 永遠成立 → 有反身性 ✓', C.mint, 0, -1.4, 5.6);
    cap('小於等於呢？', '永遠成立：有反身性');
  },
]);

scene('acA-19-irr', 'Lec19：反反身性（irreflexive）與 R₁…R₆', [
  async (tok, S) => { // 3098.0
    S.d = card('irreflexive ⇔ 補關係 R̄ 有反身性', C.lilac, 0, 6.6, 5.6); lit(S.d);
    cap('irreflexive：反反身性', '它的補關係具有反身性');
  },
  async (tok, S) => { // 3144.0
    dark(S.d);
    sm('R̄ 每個點都有圈 → R 本身一個 (a, a) 都不能有', 0, 5.9);
    cap('補關係裡每個圈都要有', '所以原本的 R 一個自環都不能有');
  },
  async (tok, S) => { // 3164.0
    S.e = card('剛才的 R 有 (3,3) 但沒 (1,1)：兩者都不是', C.peach, 0, 5.1, 6.4);
    cap('剛才的 R：有 (3,3)', '不是反身，也不是反反身');
  },
  async (tok, S) => { // 3200.0
    S.n = note('不是二選一：可能兩者都不是', 0, 4.3);
    cap('兩個不是一分為二', '可能兩者都不是');
  },
  async (tok, S) => { // 3216.0
    S.lt = card('「<」：補關係是「≥」，有反身性 → < 是反反身', C.mint, 0, 3.5, 6.8); glow(S.lt, OKG);
    cap('小於是反反身', '它的補集是大於等於，有反身性');
  },
  async (tok, S) => { // 3244.0
    gone(S.e, S.lt, S.n);
    S.T = propTable(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], [], -5.0, 4.0);
    sm('反身', COLX(0), 4.75); sm('（12 表示 (1,2)）', -2.0, 4.75);
    S.T.mark(0, (r) => isRefl(r));
    cap('判斷 R₁…R₆ 有沒有反身性', '要有 (1,1)、(2,2)、(3,3)、(4,4)');
  },
  async (tok, S) => { // 3290.0
    sm('反反身', COLX(1), 4.75);
    S.T.mark(1, (r) => isIrr(r));
    cap('反反身：一個 (a, a) 都不能有', 'R₄、R₆ 有反反身性');
  },
  async (tok, S) => { // 3338.0
    note('真正二選一的是：reflexive vs. not reflexive', 0, -1.8);
    cap('跟反身性二選一的', '其實是 not reflexive');
  },
]);

scene('acA-19-sym', 'Lec19：對稱與反對稱', [
  async (tok, S) => { // 3392.0
    S.d1 = card('對稱 symmetric：(a, b) ∈ R ⇒ (b, a) ∈ R', C.lilac, 0, 6.8, 6.4); lit(S.d1);
    cap('對稱：有 (a, b) 就一定要有 (b, a)', '有 (1,2) 就要有 (2,1)');
  },
  async (tok, S) => { // 3419.0
    dark(S.d1);
    sm('另一種寫法：R = R⁻¹（顛倒過來都找得到）', 0, 6.1);
    cap('抽象寫法：R 跟它的反關係一樣', '');
  },
  async (tok, S) => { // 3443.0
    S.lt = card('「<」：a < b 就不會 b < a → 不對稱', C.rose, -3.2, 5.3, 5.2);
    cap('小於：三一律', 'a < b 就絕對不會 b < a');
  },
  async (tok, S) => { // 3470.0
    S.mr = card('married to：對稱 ✓', C.mint, 3.4, 5.3, 3.6);
    cap('跟誰結婚', 'A 跟 B 結婚，等同 B 跟 A 結婚');
  },
  async (tok, S) => { // 3501.0
    S.d2 = card('反對稱 antisymmetric：a R b 且 b R a ⇒ a = b', C.lilac, 0, 4.4, 7.0); lit(S.d2);
    cap('反對稱：A 跟 B、B 跟 A 都有關係', '那 A、B 一定是同一個');
  },
  async (tok, S) => { // 3534.0
    dark(S.d2);
    S.g = digraph([[1, 2], [2, 4], [3, 3]], -3.6, 2.2, 0.9);
    S.s1 = sm('兩點之間最多單向（只去不回）；自己繞圈不管（示意）', 1.6, 2.6);
    cap('圖上：兩個人之間只能二選一', '只去不回；自己到自己不管');
  },
  async (tok, S) => { // 3625.0
    S.s2 = sm('集合檢查：看到 (1,2) 就不能有 (2,1)', 1.6, 2.0);
    cap('用集合檢查', '有 (1,2) 就絕對不能有 (2,1)');
  },
  async (tok, S) => { // 3677.0
    gone(S.g, S.lt, S.mr, S.s1, S.s2); S.d2.position.y = 5.3; for (const b of lab.bodies) if (b.obj === S.d2) b.target.y = 5.3;
    S.T = propTable(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], [], -5.0, 3.4);
    sm('對稱', COLX(0), 4.15); sm('反對稱', COLX(1), 4.15); sm('（12 表示 (1,2)）', -2.0, 4.15);
    S.show = (i) => { const nm = 'R' + (i + 1), r = RS[nm]; const y = 3.4 - i * ROWH; (isSym(r) ? good : bad)(isSym(r) ? '✓' : '✘', COLX(0), y); (isAnti(r) ? good : bad)(isAnti(r) ? '✓' : '✘', COLX(1), y); };
    S.show(0);
    cap('R₁：有 (3,4) 沒有 (4,3) → 不對稱', '有 (1,2) 又有 (2,1) → 不反對稱');
  },
  async (tok, S) => { // 3706.0
    S.show(1);
    cap('R₂：(1,2)、(2,1) 都在', '對稱；但不反對稱');
  },
  async (tok, S) => { // 3738.0
    S.show(2);
    cap('R₃：(1,4)、(4,1) 都在', '對稱');
  },
  async (tok, S) => { // 3765.0
    S.show(3);
    cap('R₄：(4,3) 沒有 (3,4)…', '不對稱，但是反對稱');
  },
  async (tok, S) => { // 3802.0
    S.show(4); S.show(5);
    cap('R₅：(1,2) 沒有 (2,1)…', '(2,2) 自己對調不管 → 反對稱');
  },
]);

scene('acA-19-trans', 'Lec19：遞移性（transitive）', [
  async (tok, S) => { // 3836.0
    S.d = card('遞移 transitive：a R b 且 b R c ⇒ a R c', C.lilac, 0, 6.8, 6.0); lit(S.d);
    cap('再來一個：transitive 遞移性', '');
  },
  async (tok, S) => { // 3843.0
    dark(S.d);
    sm('A、B 是朋友，B、C 是朋友 → A、C 一定是朋友（大家互相認識的小團體）', 0, 6.1);
    cap('像朋友圈：我認識你、你認識他', '我也要認識他');
  },
  async (tok, S) => { // 3875.0
    S.T = propTable(['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], [], -5.0, 4.6);
    sm('遞移', COLX(0), 5.35); sm('（12 表示 (1,2)）', -2.0, 5.35);
    const r = RS.R1; (isTrans(r) ? good : bad)(isTrans(r) ? '✓' : '✘', COLX(0), 4.6);
    S.w = card('R₁：(3,4)、(4,1) 但沒有 (3,1) → 不遞移', C.rose, 0, -1.2, 6.4);
    cap('R₁：(3,4) 和 (4,1)', '(3,1) 卻沒有 → 沒有遞移性');
  },
  async (tok, S) => { // 3927.0
    sm('要把所有「接得起來」的配對一個一個對過去', 0, -1.9);
    cap('比較討厭：必須一個一個對', '所有配對都要看過');
  },
  async (tok, S) => { // 3942.0
    gone(S.w);
    const r = RS.R2; (isTrans(r) ? good : bad)(isTrans(r) ? '✓' : '✘', COLX(0), 4.6 - ROWH);
    S.w = card('R₂：(2,1)、(1,2) ⇒ 需要 (2,2)，R₂ 沒有 → ✘（課本的 R₂）', C.peach, 0, -1.2, 7.6);
    cap('再對下一個：一對一對檢查', '（課本的 R₂ 缺 (2,2)，所以不遞移）');
  },
  async (tok, S) => { // 3972.0
    ['R3', 'R4', 'R5', 'R6'].forEach((nm, i) => (isTrans(RS[nm]) ? good : bad)(isTrans(RS[nm]) ? '✓' : '✘', COLX(0), 4.6 - (i + 2) * ROWH));
    note('最常用的三個：反身、對稱、遞移', 0, -2.6);
    cap('其他的自己 check', '反身、對稱、遞移最常用');
  },
]);

scene('acA-19-graph', 'Lec19：在有向圖上看四個性質', [
  async (tok, S) => { // 3992.0
    S.g1 = digraph([[1, 1], [2, 2], [3, 3], [4, 4]], -4.4, 4.6, 0.8); sm('反身：每點都有圈', -4.4, 3.0);
    cap('圖上的反身性', '每個點自己到自己都要有圈');
  },
  async (tok, S) => { // 4005.0
    S.g2 = digraph([[1, 2], [2, 1], [3, 4], [4, 3]], 0, 4.6, 0.8); sm('對稱：有路就雙向', 0, 3.0);
    cap('對稱：有路的話一定雙向', '');
  },
  async (tok, S) => { // 4026.0
    S.g3 = digraph([[1, 2], [2, 4], [3, 1]], 4.4, 4.6, 0.8); sm('反對稱：只能單行道', 4.4, 3.0);
    cap('反對稱：有路就是單行道', '只去不回');
  },
  async (tok, S) => { // 4038.0
    S.g4 = digraph([[1, 2], [2, 4], [1, 4]], 0, 0.8, 0.9); sm('遞移：1→2→4 就要有 1→4 直達', 0, -0.9);
    const ok = isTrans([[1, 2], [2, 4], [1, 4]]);
    (ok ? good : bad)(ok ? '檢查：遞移 ✓' : '✘', 3.0, 0.8);
    cap('遞移：1 到 2、2 到 4 有路', '1 到 4 一定要能直接到');
  },
]);

scene('acA-19-nary', 'Lec19：Rⁿ 與 n 元關係（資料庫，不考）', [
  async (tok, S) => { // 4074.0
    S.p = card('Rⁿ：R 跟自己合成 n 次（R³ = R ∘ R ∘ R）', C.lilac, 0, 6.6, 6.6); lit(S.p);
    cap('power relation', '像矩陣乘法、合成函數一直乘上去');
  },
  async (tok, S) => { // 4099.0
    dark(S.p);
    note('8-2 n-ary relations：大概提一下，不考', 0, 5.8);
    cap('8-2 大概提一下', '這個不考');
  },
  async (tok, S) => { // 4113.0
    S.xl = prop('monitor', -4.6, 2.6, 0, 0.9, '資料庫 / Excel');
    cap('學過資料庫嗎？用過 Excel 嗎？', '');
  },
  async (tok, S) => { // 4144.0
    sm('binary：A × B 的子集 → 多個集合的笛卡兒積 → n-ary relation', 0.8, 5.1);
    cap('直積不只兩個集合', '三個、四個也可以 → n 元關係');
  },
  async (tok, S) => { // 4187.0
    S.h = ['學號', '學期', '會費'].map((t, i) => card(t, C.peach, -0.8 + i * 2.3, 4.2, 2.1));
    cap('例：社團幹部做一張表', '學號、學期、會費');
  },
  async (tok, S) => { // 4249.0
    sm('A：所有學號　B：所有學期　C：{500, 1000}', 1.5, 3.5);
    cap('學號是集合 A，學期是 B', '會費 500 或 1000 是 C');
  },
  async (tok, S) => { // 4290.0
    S.r1 = ['00123', '100-1', '500'].map((t, i) => card(t, C.sky, -0.8 + i * 2.3, 2.8, 2.1));
    S.r2 = ['00123', '100-2', '1000'].map((t, i) => card(t, C.sky, -0.8 + i * 2.3, 2.0, 2.1));
    sm('一列 = (00123, 100-1, 500) ∈ A × B × C（示意資料）', 1.5, 1.3);
    cap('表上的一列', '就是直積裡的一個元素');
  },
  async (tok, S) => { // 4373.0
    const m = card('整張表 = A × B × C 的子集 = 一個 n 元關係', C.mint, 1.0, 0.4, 6.6); glow(m, OKG);
    cap('把所有列組成一個集合', '它是直積的子集：多元關係');
  },
  async (tok, S) => { // 4400.0
    sm('資料庫的 Join、selection（SQL）都能用這套解釋；這部分不考', 1.0, -0.4);
    cap('資料庫的 join、selection', '都可以用這套來解釋；不考');
  },
]);

scene('acA-19-mat', 'Lec19：用 0-1 矩陣表示關係', [
  async (tok, S) => { // 4444.0
    hot('8-3：更簡單、電腦也好處理的表示法', 0, 7.0);
    cap('寫集合畫畫畫很麻煩', '有沒有更簡單、電腦能處理的做法');
  },
  async (tok, S) => { // 4484.0
    sm('① 0-1 矩陣　② 有向圖（剛才已經偷偷教了）', 0, 6.4);
    cap('兩個表示法：0-1 矩陣、有向圖', '有向圖剛才已經偷偷教了');
  },
  async (tok, S) => { // 4511.0
    S.men = ['Joe', 'Fred', 'Mark']; S.wom = ['Susan', 'Mary', 'Sally'];
    S.like = [['Joe', 'Susan'], ['Joe', 'Mary'], ['Fred', 'Mary'], ['Mark', 'Mary'], ['Mark', 'Sally']];
    S.cells = {};
    S.wom.forEach((w, j) => sm(w, -2.6 + j * 1.3, 5.8));
    S.men.forEach((m, i) => { sm(m, -4.0, 5.1 - i * 0.8); S.wom.forEach((w, j) => { S.cells[m + w] = tile('0', C.gray, -2.6 + j * 1.3, 5.1 - i * 0.8, 0.6); }); });
    cap('男生 Joe、Fred、Mark', '女生 Susan、Mary、Sally：誰喜歡誰');
  },
  async (tok, S) => { // 4534.0
    S.set = (m, w) => { const c = S.cells[m + w]; relab(c, '1'); c.material.color.set(C.mint); glow(c, HL); };
    S.set('Joe', 'Susan');
    cap('Joe 喜歡 Susan', '打上 1');
  },
  async (tok, S) => { // 4538.0
    S.set('Joe', 'Mary');
    cap('Joe 也喜歡 Mary', '沒說不能一次喜歡兩個');
  },
  async (tok, S) => { // 4545.0
    S.set('Fred', 'Mary');
    cap('Fred 喜歡 Mary', '');
  },
  async (tok, S) => { // 4554.0
    S.set('Mark', 'Mary'); S.set('Mark', 'Sally');
    sm('（Mark 依後面念出的集合：Mary、Sally）', 0, 2.4);
    cap('Mark 喜歡誰', '這就是 0-1 矩陣的表示法');
  },
  async (tok, S) => { // 4562.0
    Object.values(S.cells).forEach((c) => glow(c, null));
    S.R = card('R = {' + S.like.map(([m, w]) => '(' + m + ', ' + w + ')').join(', ') + '}', C.lemon, 0, 1.6, 9.0);
    cap('也可以還原成集合', '原始的定義寫法');
  },
  async (tok, S) => { // 4650.0
    S.M = card('M_R：關係 R 的矩陣', C.lilac, 4.0, 4.4, 3.0);
    cap('記作 M_R', '表示是哪一個關係的矩陣');
  },
  async (tok, S) => { // 4685.0
    sm('A 的元素放列（左邊），B 的元素放行（上面）；方向要注意', 0, 0.8);
    cap('A 的成員寫在列，B 寫在行', '之後用矩陣乘法時方向很重要');
  },
  async (tok, S) => { // 4717.0
    gone(S.R, S.M); Object.values(S.cells).forEach((c) => kill(c));
    S.fr = ['apple', 'berry', 'cherry', 'durian'];
    S.ss = ['春', '夏', '秋', '冬'];
    S.eat = { 春: ['apple', 'cherry'], 夏: ['durian'], 秋: ['berry'], 冬: ['apple'] };
    S.F = {};
    S.fr.forEach((f, j) => sm(f, 0.6 + j * 1.3, 5.8));
    S.ss.forEach((s, i) => { sm(s, -0.6, 5.1 - i * 0.75); S.fr.forEach((f, j) => { S.F[s + f] = tile('0', C.gray, 0.6 + j * 1.3, 5.1 - i * 0.75, 0.56); }); });
    cap('又回到最愛的水果', '季節 → 這個季節有什麼水果可以吃');
  },
  async (tok, S) => { // 4753.0
    S.eat['春'].forEach((f) => { const c = S.F['春' + f]; relab(c, '1'); c.material.color.set(C.mint); });
    cap('春天有蘋果、有櫻桃', '0 表示沒有');
  },
  async (tok, S) => { // 4779.0
    ['夏', '秋', '冬'].forEach((s) => S.eat[s].forEach((f) => { const c = S.F[s + f]; relab(c, '1'); c.material.color.set(C.mint); }));
    cap('夏天榴槤、秋天 berry、冬天蘋果', '');
  },
]);

scene('acA-19-matprop', 'Lec19：從矩陣看反身、反反身、對稱、反對稱', [
  async (tok, S) => { // 4795.0
    hot('反身、對稱、遞移：要 A 到 A（同一個集合）才談', 0, 7.0);
    cap('剛才季節到水果不能談反身性', '要 A 跟 B 是同一個集合');
  },
  async (tok, S) => { // 4823.0
    sm('自己到自己的關係：矩陣是正方形', 0, 6.4);
    cap('自己到自己的關係', '矩陣一看就知道有沒有');
  },
  async (tok, S) => { // 4854.0
    S.m1 = matrix(A4, A4, (a, b) => a === b || (a === 1 && b === 3), -5.6, 5.2, 0.5); sm('反身：對角線全 1', -4.8, 2.6);
    cap('反身性：對角線必須全部是 1', '其他不管（示意）');
  },
  async (tok, S) => { // 4883.0
    S.m2 = matrix(A4, A4, (a, b) => a !== b && (a + b) % 3 === 0, -1.6, 5.2, 0.5); sm('反反身：對角線全 0', -0.8, 2.6);
    cap('反反身性：對角線全部是 0', '');
  },
  async (tok, S) => { // 4893.0
    const has = (a, b) => (a + b) % 2 === 1 || a === b;
    S.m3 = matrix(A4, A4, has, 2.4, 5.2, 0.5); sm('對稱：M = Mᵀ', 3.2, 2.6);
    cap('對稱：對角線一邊是 1，對面也要是 1', '一邊是 0，對面也是 0');
  },
  async (tok, S) => { // 4905.0
    const has = (a, b) => a < b && (a + b) % 2 === 1;
    S.m4 = matrix(A4, A4, has, -1.6, 0.6, 0.5); sm('反對稱：對面不能同時是 1', -0.8, -2.0);
    const ok = isAnti(A4.flatMap((a) => A4.filter((b) => has(a, b)).map((b) => [a, b])));
    (ok ? good : bad)(ok ? '示意矩陣：反對稱 ✓' : '✘', 3.2, 0.0);
    cap('反對稱：這邊是 1，對面一定是 0', '對角線上隨便');
  },
  async (tok, S) => { // 4927.0
    note('transitive 在矩陣上還看不出來', 3.2, -1.0);
    cap('遞移性在這裡還看不出來', '先到這邊下課');
  },
]);

// ════════ YlKDp03Kg68（The Principle of Inclusion-Exclusion，英文） ════════
// two-set Venn: A left, B right
const V2 = [[-1.2, 3.4], [1.2, 3.4]];
function venn2(na, nb, r = 2.0) {
  const all = [];
  V2.forEach(([x, y], i) => { all.push(ring(x, y, r, ['#4b9ee2', '#dd8238'][i])); all.push(disc(x, y, r, ['#4b9ee2', '#dd8238'][i], 0.1)); });
  all.push(hd(na, -3.2, 5.8), hd(nb, 3.2, 5.8));
  return all;
}
const V2P = { a: [-2.1, 3.4], ab: [0, 3.4], b: [2.1, 3.4] };

scene('acA-ie-homes', 'IE：房屋廣告（車庫 64、泳池 21、兩者 17）', [
  async (tok, S) => { // 0.4
    hot('The Principle of Inclusion-Exclusion（排容原理）', 0, 7.0);
    cap('今天看排容原理', '先看一個例子');
  },
  async (tok, S) => { // 10.4
    S.d = [card('有車庫 64', C.sky, -3.6, 6.2, 2.4), card('有泳池 21', C.peach, 0, 6.2, 2.4), card('兩者都有 17', C.lilac, 3.6, 6.2, 2.6)];
    cap('房屋廣告：64 間有車庫', '21 間有泳池，17 間兩者都有');
  },
  async (tok, S) => { // 17.0
    S.q = sm('總共有幾間房子在賣？', 0, 5.5);
    cap('總共有幾間房子在賣？', '先不用公式，走「長的路」');
  },
  async (tok, S) => { // 26.3
    gone(S.q);
    S.v = venn2('garages 車庫', 'pools 泳池', 1.9);
    cap('畫 Venn diagram', '左圈車庫、右圈泳池');
  },
  async (tok, S) => { // 30.0
    S.w = bad('不能直接把 64 放進左圈（裡面含那 17 間）', 0, 0.8);
    cap('不能直接把 64 放進圈裡', '因為有 17 間兩者都有');
  },
  async (tok, S) => { // 46.7
    gone(S.w);
    S.m = tag('17', 'ptr alt', V2P.ab[0], V2P.ab[1]);
    cap('先把 17 放在中間', '中間 = 交集：車庫和泳池都有');
  },
  async (tok, S) => { // 66.3
    S.a = tag('64 − 17 = ' + (64 - 17), 'ptr', V2P.a[0] - 0.2, V2P.a[1]);
    cap('左圈全部要是 64，含那 17', '所以只有車庫的：64 − 17 = 47');
  },
  async (tok, S) => { // 77.0
    S.b = tag('21 − 17 = ' + (21 - 17), 'ptr', V2P.b[0] + 0.2, V2P.b[1]);
    cap('右圈 21 也含那 17', '只有泳池的：21 − 17 = 4');
  },
  async (tok, S) => { // 109.1
    const m = card('47 + 17 + 4 = ' + (47 + 17 + 4) + ' 間', C.mint, 0, 0.6, 3.6); glow(m, OKG);
    cap('三塊加起來', '總共 68 間');
  },
]);

scene('acA-ie-two', 'IE：|A ∪ B| = |A| + |B| − |A ∩ B|', [
  async (tok, S) => { // 130.5
    note('不想每次都畫 Venn diagram 再算', 0, 7.0);
    cap('不想每次都畫圖再算', '看排容原理');
  },
  async (tok, S) => { // 147.2
    S.v = venn2('A', 'B', 1.9);
    cap('先看為什麼它是對的', '');
  },
  async (tok, S) => { // 159.3
    S.f = card('|A ∪ B| = |A| + |B| − |A ∩ B|', C.lilac, 0, 0.6, 5.4); lit(S.f);
    cap('A 的個數 + B 的個數 − 交集', '就是聯集的元素個數');
  },
  async (tok, S) => { // 182.5
    dark(S.f);
    S.c = { a: 1, ab: 1, b: 0 };
    S.t = Object.keys(V2P).map((k) => tag('×' + S.c[k], 'idx', V2P[k][0], V2P[k][1] - 0.5));
    S.upd = () => Object.keys(V2P).forEach((k, i) => { txt(S.t[i], '算了 ' + S.c[k] + ' 次'); S.t[i].element.className = 'lab-label ' + (S.c[k] === 1 ? 'good' : 'bad'); });
    S.upd();
    cap('加 |A|：A 的兩塊各算一次', '');
  },
  async (tok, S) => { // 200.1
    S.c.ab += 1; S.c.b += 1; S.upd();
    cap('加 |B|：B 的兩塊各算一次', '');
  },
  async (tok, S) => { // 209.7
    cap('左右兩塊各算一次', '中間算了兩次：不 OK');
  },
  async (tok, S) => { // 228.5
    S.c.ab -= 1; S.upd(); lit(S.f);
    cap('減掉交集一次', '每一塊都只算一次了');
  },
  async (tok, S) => { // 240.0
    dark(S.f);
    const m = card('64 + 21 − 17 = ' + (64 + 21 - 17), C.mint, 0, -0.3, 3.6); glow(m, OKG);
    cap('房屋：64 + 21 − 17', '跟剛才的答案一樣：68');
  },
]);

scene('acA-ie-711', 'IE：1000 以內被 7 或 11 整除的有幾個', [
  async (tok, S) => { // 260.7
    hot('兩個集合的例子', 0, 7.0);
    cap('用排容原理看幾個例子', '這裡還只有兩個集合');
  },
  async (tok, S) => { // 270.0
    S.q = card('不超過 1000 的正整數，被 7 或 11 整除的有幾個？', C.sky, 0, 6.2, 7.2); lit(S.q);
    cap('不超過 1000 的正整數', '被 7 或 11 整除的有幾個？');
  },
  async (tok, S) => { // 279.4
    dark(S.q);
    S.s = card('A = 被 7 整除，B = 被 11 整除：求 |A ∪ B|', C.lilac, 0, 5.2, 6.6);
    cap('A：被 7 整除；B：被 11 整除', '要的是聯集');
  },
  async (tok, S) => { // 291.7
    S.f = card('|A| + |B| − |A ∩ B|', C.lilac, 0, 4.3, 3.8); lit(S.f);
    cap('A 的個數 + B 的個數', '減掉同時被 7 和 11 整除的');
  },
  async (tok, S) => { // 314.0
    dark(S.f);
    S.a = card('|A| = ⌊1000/7⌋ = ' + Math.floor(1000 / 7), C.sky, -3.6, 3.2, 3.6);
    cap('用 floor function：⌊1000/7⌋', '無條件捨去');
  },
  async (tok, S) => { // 334.7
    S.b = card('|B| = ⌊1000/11⌋ = ' + Math.floor(1000 / 11), C.peach, 0.4, 3.2, 3.8);
    cap('加上被 11 整除的', '');
  },
  async (tok, S) => { // 339.0
    S.ab = card('|A ∩ B| = ⌊1000/77⌋ = ' + Math.floor(1000 / 77), C.lilac, 4.6, 3.2, 3.6);
    sm('同時被 7 和 11 整除 = 被 77 整除', 4.6, 2.5);
    cap('減掉同時被 7 和 11 整除的', '就是被 77 = 7 × 11 整除');
  },
  async (tok, S) => { // 356.0
    let bf = 0; for (let n = 1; n <= 1000; n++) if (n % 7 === 0 || n % 11 === 0) bf++;
    const v = 142 + 90 - 12;
    const m = card('142 + 90 − 12 = ' + v, C.mint, 0, 1.4, 3.8); glow(m, OKG);
    (v === bf ? good : bad)('電腦從 1 數到 1000：' + bf + (v === bf ? ' ✓' : ' ✘'), 0, 0.6);
    cap('142 + 90，12 個被算了兩次', '減掉一次：220');
  },
]);

scene('acA-ie-major', 'IE：數學系 15、資工系 42、雙主修 8', [
  async (tok, S) => { // 373.0
    S.q = card('離散數學班：數學系、資工系的學生', C.sky, 0, 6.2, 5.6);
    cap('第二個例子：資工系和數學系', '');
  },
  async (tok, S) => { // 383.0
    S.f = card('|M ∪ CS| = 修離散數學的總人數', C.lilac, 0, 5.2, 5.4); lit(S.f);
    cap('數學系聯集資工系', '就是修離散數學的總人數');
  },
  async (tok, S) => { // 396.2
    dark(S.f);
    const m = card('15 + 42 − 8 = ' + (15 + 42 - 8), C.mint, 0, 4.0, 3.6); glow(m, OKG);
    cap('數學 15 + 資工 42', '減掉兩個都是的 8：49');
  },
]);

// three-set Venn reuse (V3C, VPOS from Lec19 part)
scene('acA-ie-three', 'IE：三個集合的排容', [
  async (tok, S) => { // 431.6
    S.v = venn3(['A', 'B', 'C'], 1.8);
    cap('三個集合的排容', '看能不能找出規律');
  },
  async (tok, S) => { // 447.6
    S.k = ['s', 'f', 'r', 'sf', 'sr', 'fr', 'sfr'];
    S.mem = { s: 'A', f: 'B', r: 'C', sf: 'AB', sr: 'AC', fr: 'BC', sfr: 'ABC' };
    S.c = {}; S.k.forEach((k) => { S.c[k] = 0; });
    S.t = S.k.map((k) => tag('0', 'idx', VPOS[k][0], VPOS[k][1]));
    S.upd = () => S.k.forEach((k, i) => { txt(S.t[i], String(S.c[k])); S.t[i].element.className = 'lab-label ' + (S.c[k] === 1 ? 'good' : S.c[k] === 0 ? 'idx' : 'bad'); });
    S.f = card('|A| + |B| + |C|', C.lilac, 0, -1.4, 3.6); lit(S.f);
    cap('先把 A、B、C 加起來', '每一塊被算了幾次？');
  },
  async (tok, S) => { // 459.4
    S.k.forEach((k) => { if (S.mem[k].includes('A')) S.c[k]++; }); S.upd();
    cap('A 的四塊各算一次', '');
  },
  async (tok, S) => { // 472.7
    S.k.forEach((k) => { if (S.mem[k].includes('B')) S.c[k]++; }); S.upd();
    cap('B 的四塊各算一次', '');
  },
  async (tok, S) => { // 483.0
    S.k.forEach((k) => { if (S.mem[k].includes('C')) S.c[k]++; }); S.upd();
    cap('C 的四塊各算一次', '');
  },
  async (tok, S) => { // 493.1
    bad('只屬於一個的算 1 次；兩兩重疊算 2 次；中間算 3 次', 0, 7.0);
    cap('有問題：有些被算了不只一次', '我們要每一塊只算一次');
  },
  async (tok, S) => { // 510.1
    dark(S.f);
    S.f2 = card('− |A ∩ B| − |A ∩ C| − |B ∩ C|', C.rose, 0, -2.2, 4.8); lit(S.f2);
    cap('減掉兩兩的交集', 'A∩B、A∩C、B∩C');
  },
  async (tok, S) => { // 534.6
    S.k.forEach((k) => { const m = S.mem[k]; S.c[k] -= (m.length * (m.length - 1)) / 2; }); S.upd();
    cap('減完之後，看看現在算了幾次', '中間被減了三次');
  },
  async (tok, S) => { // 567.6
    cap('只屬於一個的 OK', '兩兩重疊的從 2 次變 1 次：OK');
  },
  async (tok, S) => { // 583.6
    cap('但中間：3 次 → 0 次', '一次都沒算到，不 OK');
  },
  async (tok, S) => { // 593.4
    dark(S.f2);
    S.f3 = card('+ |A ∩ B ∩ C|', C.mint, 0, -3.0, 3.0); lit(S.f3);
    S.c.sfr += 1; S.upd();
    cap('再把 A∩B∩C 加回來', '每一塊都只算一次了');
  },
  async (tok, S) => { // 612.5
    dark(S.f3);
    sm('四個集合呢？什麼規律？', 0, -3.6);
    cap('三個集合就是這樣', '四個集合可以繼續嗎？');
  },
  async (tok, S) => { // 624.2
    note('加單個 − 減兩兩交集 + 加三個交集 − 減四個交集 ⋯', 0, 7.0);
    cap('加單個、減兩個、加三個', '四個的話再減四個的交集…');
  },
]);

scene('acA-ie-digits', 'IE：0～9 的排列：開頭 987、第 5–6 位 45、或結尾 123', [
  async (tok, S) => { // 649.6
    S.q = card('0～9 這 10 個數字的排列：開頭 987，或第 5、6 位是 45，或結尾 123', C.sky, 0, 7.0, 9.6); lit(S.q);
    cap('三個集合的例子', '10 個數字的排列有幾個符合？');
  },
  async (tok, S) => { // 672.5
    dark(S.q);
    S.sets = [card('A：開頭 987', C.sky, -3.8, 6.1, 2.8), card('B：第 5、6 位是 4、5', C.peach, 0, 6.1, 3.6), card('C：結尾 123', C.mint, 3.8, 6.1, 2.8)];
    cap('A：開頭 987；B：第 5、6 位是 45', 'C：結尾 123');
  },
  async (tok, S) => { // 700.3
    S.f = card('|A ∪ B ∪ C| = |A| + |B| + |C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C|', C.lilac, 0, 5.2, 9.6); lit(S.f);
    cap('照剛才的公式', '加單個、減兩兩、加三個');
  },
  async (tok, S) => { // 752.2
    dark(S.f);
    sm('也可以寫成「減掉（兩兩交集的和）」，是一樣的', 0, 4.6);
    cap('也可以先把中間加起來再減', '哪種寫法順手都可以');
  },
  async (tok, S) => { // 765.2
    S.pos = range(1, 10).map((p) => { sm(String(p), -4.5 + (p - 1) * 1.0, 4.0); return tile('_', C.gray, -4.5 + (p - 1) * 1.0, 3.4, 0.7); });
    S.fix = { A: { 1: 9, 2: 8, 3: 7 }, B: { 5: 4, 6: 5 }, C: { 8: 1, 9: 2, 10: 3 } };
    // number of permutations with the given fixed positions: (free digits)! if consistent
    S.cnt = (keys) => { const f = {}; let ok = true; keys.forEach((k) => Object.entries(S.fix[k]).forEach(([p, d]) => { if (f[p] !== undefined && f[p] !== d) ok = false; f[p] = d; })); const used = new Set(Object.values(f)); if (used.size !== Object.keys(f).length) ok = false; return ok ? fact(10 - Object.keys(f).length) : 0; };
    S.show = (keys) => S.pos.forEach((m, i) => { let d = null; keys.forEach((k) => { if (S.fix[k][i + 1] !== undefined) d = S.fix[k][i + 1]; }); relab(m, d === null ? '_' : d); m.material.color.set(d === null ? C.gray : C.yellow); });
    S.terms = [];
    S.term = (t, x, y, c) => { const m = card(t, c, x, y, 2.9); S.terms.push(m); return m; };
    cap('10 個位置：1 到 10', '');
  },
  async (tok, S) => { // 784.1
    S.show(['A']); S.term('|A| = 7! = ' + S.cnt(['A']), C.sky, -3.6, 2.2);
    cap('A：開頭 987', '剩 7 個數字排 7 個位置：7!');
  },
  async (tok, S) => { // 806.1
    S.show(['B']); S.term('|B| = 8! = ' + S.cnt(['B']), C.peach, 0, 2.2);
    cap('B：第 5、6 位是 4、5', '剩 8 個數字排 8 個位置：8!');
  },
  async (tok, S) => { // 832.3
    S.show(['C']); S.term('|C| = 7! = ' + S.cnt(['C']), C.mint, 3.6, 2.2);
    cap('C：結尾 123', '剩 7 個：7!');
  },
  async (tok, S) => { // 854.7
    S.show(['A', 'B']); S.term('|A∩B| = 5! = ' + S.cnt(['A', 'B']), C.rose, -3.6, 1.3);
    cap('A∩B：開頭 987 又有 45', '剩 5 個：5!');
  },
  async (tok, S) => { // 886.0
    S.show(['A', 'C']); S.term('|A∩C| = 4! = ' + S.cnt(['A', 'C']), C.rose, 0, 1.3);
    cap('A∩C：開頭 987、結尾 123', '剩 4 個：4!');
  },
  async (tok, S) => { // 904.0
    S.show(['B', 'C']); S.term('|B∩C| = 5! = ' + S.cnt(['B', 'C']), C.rose, 3.6, 1.3);
    cap('B∩C：45 在第 5、6 位、結尾 123', '剩 5 個：5!');
  },
  async (tok, S) => { // 924.7
    sm('兩兩交集：減掉 5!、4!、5!', 0, 0.7);
    cap('減掉 5!、4!、5!', '');
  },
  async (tok, S) => { // 936.5
    S.show(['A', 'B', 'C']); S.term('|A∩B∩C| = 2! = ' + S.cnt(['A', 'B', 'C']), C.lemon, 0, 0.1);
    cap('A∩B∩C 要加回來', '只剩 0 和 6 兩個數字：2!');
  },
  async (tok, S) => { // 972.0
    const ks = [['A'], ['B'], ['C'], ['A', 'B'], ['A', 'C'], ['B', 'C'], ['A', 'B', 'C']];
    const v = ks.reduce((s, k) => s + (k.length % 2 ? 1 : -1) * S.cnt(k), 0);
    const m = card('5040 + 40320 + 5040 − 120 − 24 − 120 + 2 = ' + v, C.mint, 0, -0.8, 7.6); glow(m, OKG);
    cap('用計算機加加減減', '答案：50138');
  },
]);

scene('acA-ie-gen', 'IE：n 個集合的一般式', [
  async (tok, S) => { // 985.1
    hot('一般化：任意 n 個集合', 0, 7.0);
    cap('排容原理的一般化', '兩個、三個之後，任意 n 個');
  },
  async (tok, S) => { // 998.3
    S.c = chain(0, 6.0, 0.72, 8.4);
    S.c.add('|A₁ ∪ ⋯ ∪ Aₙ| = Σ|Aᵢ|');
    cap('先加所有「一個集合」的大小', '');
  },
  async (tok, S) => { // 1007.6
    S.c.add('− Σ|Aᵢ ∩ Aⱼ|（i < j：第 1 和第 2、第 1 和第 3…）');
    cap('減掉所有兩兩交集', '第一個配第二個、第一個配第三個…');
  },
  async (tok, S) => { // 1021.7
    S.c.add('+ Σ|Aᵢ ∩ Aⱼ ∩ Aₖ| − (四個的交集) + ⋯');
    cap('加所有三個的交集', '減所有四個的交集');
  },
  async (tok, S) => { // 1029.0
    const m = S.c.add('⋯ + (−1)ⁿ⁺¹ |A₁ ∩ A₂ ∩ ⋯ ∩ Aₙ|', C.mint); glow(m, OKG);
    cap('(−1)ⁿ⁺¹ 讓正負號交替', '加、減、加、減…');
  },
  async (tok, S) => { // 1041.4
    // check with n = 4 sets of 1..60 (示意)
    const N = 60, d = [2, 3, 5, 7], sets = d.map((k) => (x) => x % k === 0);
    let bf = 0; for (let x = 1; x <= N; x++) if (sets.some((f) => f(x))) bf++;
    let ie = 0; for (let m = 1; m < 16; m++) { const pick = sets.filter((_, i) => m & (1 << i)); let c = 0; for (let x = 1; x <= N; x++) if (pick.every((f) => f(x))) c++; ie += (pick.length % 2 ? 1 : -1) * c; }
    (ie === bf ? good : bad)('示意：1～60 被 2、3、5、7 整除（4 個集合）：排容 ' + ie + '，直接數 ' + bf + (ie === bf ? ' ✓' : ' ✘'), 0, 2.4);
    cap('四個、五個、六個集合', '不用畫 Venn diagram，用這個原理');
  },
  async (tok, S) => { // 1051.1
    note('下一部：relations（關係）', 0, 1.4);
    cap('下一部：relations', '');
  },
]);
  }

  // ═══ acB.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 6 章（清大 趙啟超 第10A、10B、11A、11B、11C+D講）— cued scenes ───
// multinomial、可重複的組合（× 與 |）、排容原理與證明、Euler φ(60) = 16、onto 函數與第二類 Stirling 數。
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 老師的例子（MISSISSIPPI、n = 4 取 2、φ(60)、m = 3 對 n = 2）照用；老師沒給數字的圖標「示意」。
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
const tile = (t, c, x, y, s = 0.7) => cube(t, c, [s, s, 0.5], x, y, 0, 0);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); kill(o); });
const relab = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, t); };
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4, 15], [0, 3.2, 0]];
// 一行一行的推導：新的一行發亮
function chain(x, yTop, dy = 0.7, w = 7.4) {
  const ls = [];
  return { ls, add(e, c) { ls.forEach((m) => glow(m, null)); const m = card(e, c || C.sky, x, yTop - ls.length * dy, w, 0.5); glow(m, HL); ls.push(m); return m; } };
}
// 在直立平面上畫一個圓（Venn diagram 用）
function ring(cx, cy, r, color = '#8a7a60', z = 0) {
  const pts = []; for (let k = 0; k <= 72; k++) { const a = (Math.PI * 2 * k) / 72; pts.push(V3(cx + r * Math.cos(a), cy + r * Math.sin(a), z)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l;
}
// 幾個東西一起移動（帶一點弧度）
async function moveAll(tok, list, ms = 800, arc = 0.5) {
  const from = list.map(([o]) => o.position.clone());
  await anim(tok, ms, (u) => list.forEach(([o, x, y], i) => { o.position.x = from[i].x + (x - from[i].x) * u; o.position.y = from[i].y + (y - from[i].y) * u + Math.sin(Math.PI * u) * arc; }));
}

// ════════ MQfb_LrlWl0（趙啟超 10A：multinomial、可重複的組合） ════════
scene('acB-mi-intro', '10A：從 binomial 到 multinomial', [
  async (tok, S) => { // 4.0
    S.b = card('(x + y)ⁿ = Σ C(n, r) xⁿ⁻ʳ yʳ', C.sky, 0, 5.4, 6.4); glow(S.b, HL);
    sm('r = 0, 1, …, n', 0, 4.7);
    cap('上次：binomial theorem', '(x + y)ⁿ 展開，係數是 C(n, r)');
  },
  async (tok, S) => { // 9.0
    glow(S.b, null);
    S.m = card('(x₁ + x₂ + ⋯ + xₖ)ⁿ = ？', C.lilac, 0, 3.7, 6.0); glow(S.m, HL);
    cap('今天：multinomial theorem', 'binomial 的 bi = 兩個');
  },
  async (tok, S) => { // 34.1
    ['x₁', 'x₂', 'x₃', '⋯', 'xₖ'].forEach((t, i) => tile(t, i === 3 ? C.gray : C.peach, -2.4 + i * 1.2, 2.3));
    sm('括號裡不止兩項：3 個、k 個', 0, 1.6);
    cap('不止兩個加起來，再 n 次方', '展開以後長什麼樣子？');
  },
  async (tok, S) => { // 59.4
    note('講定理之前，先看一個例子', 0, 0.7);
    cap('先看一個例子', '');
  },
]);

scene('acB-miss', '10A：MISSISSIPPI 有幾種排列？34650', [
  async (tok, S) => { // 64.0
    S.L = 'MISSISSIPPI'.split('').map((ch, i) => tile(ch, C.sky, (i - 5) * 0.95, 5.3));
    hot('MISSISSIPPI 有幾種不同的排列？', 0, 6.5);
    cap('把 MISSISSIPPI 的字母重新排', '有幾種看起來不一樣的排法？');
  },
  async (tok, S) => { // 93.2
    const a = S.L[2], b = S.L[3]; glow(a, HL); glow(b, HL);
    await moveAll(tok, [[a, b.position.x, 5.3], [b, a.position.x, 5.3]], 900, 0.8);
    sm('兩個 s 交換：看起來一樣 → 只算一種', 0, 4.4);
    cap('兩個 s 互換，看起來還是同一個字', '只能算同一種排列');
  },
  async (tok, S) => { // 117.2
    S.L.forEach((m) => glow(m, null));
    const grp = { M: [], I: [], S: [], P: [] }; S.L.forEach((m) => grp[m.userData.lbl.element.textContent].push(m));
    S.grp = grp; S.gx = { M: -5.4, I: -3.9, S: -0.3, P: 3.6 };
    const list = [];
    Object.keys(grp).forEach((k) => grp[k].forEach((m, j) => list.push([m, S.gx[k] + j * 0.8, 3.6])));
    const col = { M: C.purple, I: C.blue, S: C.orange, P: C.green };
    await moveAll(tok, list, 1000, 0.6);
    Object.keys(grp).forEach((k) => grp[k].forEach((m) => m.material.color.set(col[k])));
    S.cM = hd('M × 1', -5.4, 2.7); S.cI = hd('I × 4', -2.7, 2.7);
    cap('m 只有 1 個，i 有 4 個', '');
  },
  async (tok, S) => { // 130.5
    S.cS = hd('S × 4', 0.9, 2.7);
    cap('s 也有 4 個', '');
  },
  async (tok, S) => { // 144.6
    S.cP = hd('P × 2', 4.0, 2.7);
    cap('p 有 2 個', '');
  },
  async (tok, S) => { // 147.2
    S.tot = card('4 + 4 + 2 + 1 = 11 個字母', C.mint, 0, 1.7, 5.0); glow(S.tot, OKG);
    cap('全部 11 個字母', '4 + 4 + 2 + 1 = 11');
  },
  async (tok, S) => { // 169.5
    glow(S.tot, null);
    const sub = '₁₂₃₄';
    ['I', 'S', 'P'].forEach((k) => S.grp[k].forEach((m, j) => relab(m, k + sub[j])));
    S.f = card('先當作全不一樣：11! = 39,916,800', C.sky, 0, 0.9, 6.4); glow(S.f, HL);
    cap('先把 11 個字母都看成不一樣', '排列數 = 11!');
  },
  async (tok, S) => { // 191.1
    glow(S.f, null);
    const g = S.grp.I, xs = g.map((m) => m.position.x);
    g.forEach((m) => glow(m, HL));
    await moveAll(tok, g.map((m, j) => [m, xs[(j + 1) % 4], 3.6]), 900, 0.6);
    S.dI = hot('÷ 4!', -2.7, 4.5);
    cap('4 個 i 自己排一排，還是同一個字', '4! 種只能算 1 種');
  },
  async (tok, S) => { // 211.0
    S.grp.I.forEach((m) => glow(m, null));
    const g = S.grp.S, xs = g.map((m) => m.position.x);
    g.forEach((m) => glow(m, HL));
    await moveAll(tok, g.map((m, j) => [m, xs[(j + 3) % 4], 3.6]), 900, 0.6);
    S.dS = hot('÷ 4!', 0.9, 4.5);
    cap('4 個 s 排一排也一樣', '再除以 4!');
  },
  async (tok, S) => { // 219.0
    S.grp.S.forEach((m) => glow(m, null));
    const g = S.grp.P; g.forEach((m) => glow(m, HL));
    await moveAll(tok, [[g[0], g[1].position.x, 3.6], [g[1], g[0].position.x, 3.6]], 800, 0.6);
    S.dP = hot('÷ 2!', 4.0, 4.5); S.dM = hot('÷ 1!', -5.4, 4.5);
    cap('2 個 p：2!；1 個 m：1!', '');
  },
  async (tok, S) => { // 242.6
    S.grp.P.forEach((m) => glow(m, null));
    gone(S.f);
    S.ans = card('11! / (4! · 4! · 2! · 1!) = 34650', C.mint, 0, 0.9, 6.4); glow(S.ans, OKG);
    cap('全部除掉：34650 種', '高中學過的「有相同物的排列」');
  },
]);

scene('acB-mcoef', '10A：multinomial coefficient', [
  async (tok, S) => { // 261.3
    hot('multinomial coefficient（多項係數）', 0, 6.5);
    cap('剛才分母那個算式：multinomial coefficient', '用例子來介紹它');
  },
  async (tok, S) => { // 274.7
    const row = [[C.blue, 3], [C.orange, 2], [C.green, 2]];
    let x = -4.4;
    row.forEach(([c, k], i) => { for (let j = 0; j < k; j++) { tile('', c, x, 5.4, 0.6); x += 0.75; } sm(['type 1：n₁ 個', 'type 2：n₂ 個', 'type k：nₖ 個'][i], x - k * 0.375 - 0.4, 4.7); x += 0.9; if (i === 1) { sm('⋯', x - 0.2, 5.4); x += 0.7; } });
    sm('示意', 4.6, 5.4);
    cap('n 個東西，分成 k 種 type', '同一種 type 看起來一模一樣');
  },
  async (tok, S) => { // 323.2
    S.c = chain(0, 4.0, 0.75, 7.0);
    S.c.add('n₁ + n₂ + ⋯ + nₖ = n');
    cap('每種的個數加起來 = n', '');
  },
  async (tok, S) => { // 346.5
    S.c.add('記號：( n ; n₁, n₂, …, nₖ )', C.lilac);
    cap('記號：上面 n，下面 n₁, n₂, …, nₖ', '分得出來的排法有幾種');
  },
  async (tok, S) => { // 369.0
    S.c.add('= n! / ( n₁! n₂! ⋯ nₖ! )', C.mint);
    sm('MISSISSIPPI：n₁ = 4, n₂ = 4, n₃ = 2, n₄ = 1', 0, 1.8);
    cap('就是剛才例子的推廣', '每種自己排一排只算一種 → 除掉');
  },
  async (tok, S) => { // 404.2
    note('n₁, …, nₖ 都是 ≥ 0 的整數，加起來 = n', 0, 1.15);
    cap('條件：都是 ≥ 0 的整數，加起來是 n', '這樣才有定義');
  },
  async (tok, S) => { // 413.0
    const m = card('k = 2：( n ; n₁, n₂ ) = C(n, n₁)', C.peach, 0, 0.4, 6.4); glow(m, HL);
    cap('只有兩種時，就是 binomial coefficient', '');
  },
]);

scene('acB-mthm', '10A：multinomial theorem（為什麼係數是那樣）', [
  async (tok, S) => { // 434.5
    S.t = card('(x₁ + x₂ + ⋯ + xₖ)ⁿ', C.lilac, 0, 6.3, 5.0); glow(S.t, HL);
    cap('multinomial theorem', 'k 個變數加起來的 n 次方');
  },
  async (tok, S) => { // 468.6
    glow(S.t, null);
    S.r = card('= Σ ( n ; n₁, …, nₖ ) x₁ⁿ¹ x₂ⁿ² ⋯ xₖⁿᵏ', C.sky, 0, 5.5, 7.4); glow(S.r, HL);
    cap('每一項 x₁ⁿ¹⋯xₖⁿᵏ', '前面係數就是 multinomial coefficient');
  },
  async (tok, S) => { // 490.3
    glow(S.r, null);
    S.s1 = sm('Σ 跑遍所有 n₁ + ⋯ + nₖ = n 的非負整數', 0, 4.8);
    cap('加總所有 n₁ + ⋯ + nₖ = n 的情況', '這一個 Σ 其實包含很多項');
  },
  async (tok, S) => { // 500.0
    S.s2 = sm('可以自由變的只有 k − 1 個（最後一個被決定）', 0, 4.3);
    cap('能自由變的只有 k − 1 個', '前面都給了，最後一個就固定');
  },
  async (tok, S) => { // 528.4
    gone(S.s1, S.s2);
    S.br = [-4.2, 0, 4.2].map((cx) => { hd('( x₁ + x₂ + ⋯ + xₖ )', cx, 4.4); return ['x₁', 'x₂', '⋯', 'xₖ'].map((t, i) => tile(t, i === 2 ? C.gray : C.peach, cx - 1.3 + i * 0.87, 3.7, 0.62)); });
    sm('n = 3（示意）', 0, 3.0);
    cap('n 次方 = n 個括號乘在一起', '老師用 n = 3 比較簡單');
  },
  async (tok, S) => { // 550.4
    cap('展開 = 每個括號隨便挑一項，乘起來', '所有挑法加起來就是展開式');
  },
  async (tok, S) => { // 594.4
    const pick = [0, 1, 3]; S.br.forEach((b, i) => glow(b[pick[i]], HL));
    S.p1 = card('x₁ · x₂ · xₖ', C.sky, -3.0, 2.2, 3.0);
    cap('第一個挑 x₁、第二個 x₂、第三個 xₖ', '乘出來就是一項');
  },
  async (tok, S) => { // 604.0
    S.br.forEach((b) => b.forEach((m) => glow(m, null)));
    const pick = [0, 0, 1]; S.br.forEach((b, i) => glow(b[pick[i]], OKG));
    S.p2 = card('x₁ · x₁ · x₂ = x₁² x₂', C.mint, 2.6, 2.2, 4.0); glow(S.p2, OKG);
    cap('挑 x₁、x₁、x₂ → 乘開是 x₁² x₂', '');
  },
  async (tok, S) => { // 655.0
    S.br.forEach((b) => b.forEach((m) => glow(m, null)));
    const pick = [1, 0, 0]; S.br.forEach((b, i) => glow(b[pick[i]], OKG));
    S.p3 = card('x₂ · x₁ · x₁ = x₁² x₂', C.mint, 2.6, 1.4, 4.0);
    cap('換一個順序挑，也是 x₁² x₂', '');
  },
  async (tok, S) => { // 675.2
    S.k = card('x₁, x₁, x₂ 排一排：3! / (2! 1!) = 3', C.lilac, 0, 0.6, 6.4); glow(S.k, HL);
    cap('就是把 x₁, x₁, x₂ 排一排', '3!/(2!1!) = 3 → x₁²x₂ 的係數是 3');
  },
  async (tok, S) => { // 687.7
    glow(S.k, null);
    S.br.forEach((b) => b.forEach((m) => glow(m, null)));
    gone(S.p1, S.p2, S.p3, S.k);
    S.g = card('n₁ 個 x₁、…、nₖ 個 xₖ 排一排 → n! / (n₁! ⋯ nₖ!)', C.mint, 0, 1.4, 7.4); glow(S.g, OKG);
    cap('一般的情況：n₁ 個 x₁ … nₖ 個 xₖ 排一排', '係數 = multinomial coefficient');
  },
  async (tok, S) => { // 796.6
    glow(S.g, null);
    S.b2 = card('k = 2 → binomial theorem（Σ 只剩一個變數）', C.peach, 0, 0.6, 7.0); glow(S.b2, HL);
    cap('k = 2 時就回到 binomial theorem', 'Σ 是 k − 1 重的');
  },
]);

const KINDS = [['有順序、不重複', 'n!/(n−r)!'], ['有順序、可重複', 'nʳ'], ['無順序、不重複', 'C(n, r)'], ['無順序、可重複', '？']];
scene('acB-sel4', '10A：第四種選取：無順序、可重複', [
  async (tok, S) => { // 836.0
    S.ch = [card('無順序、不重複 → C(n, r)', C.sky, -3.6, 6.2, 4.6), card('binomial theorem', C.sky, 0.9, 6.2, 3.4), card('multinomial', C.sky, 4.6, 6.2, 2.6)];
    sm('→', -0.95, 6.2); sm('→', 2.95, 6.2);
    cap('從「無順序、不重複」的選取講起', 'binomial coefficient → 定理 → 推廣');
  },
  async (tok, S) => { // 866.6
    S.k = KINDS.map(([a, b], i) => { const x = i % 2 ? 2.6 : -2.6, y = i < 2 ? 4.4 : 3.2; const m = card(a + '：' + b, i === 3 ? C.peach : C.gray, x, y, 4.8); if (i === 3) glow(m, HL); return m; });
    sm('從 n 個裡選 r 個（示意課本記號）', 0, 2.4);
    cap('第四種：unordered selection with repetition', '順序無關、可以重複拿');
  },
  async (tok, S) => { // 891.1
    S.q = note('size n 的集合，拿 r 個（可重複、無順序）：幾種？', 0, 1.3);
    cap('有幾種？先推導，再回來寫答案', '');
  },
]);

const LX = [-3.0, -1.2, 0.6, 2.4], LY = [4.2, 3.4, 2.6, 1.8], ABCD = ['A', 'B', 'C', 'D'];
scene('acB-list', '10A：n = 4 取 r = 2（可重複）：列出 10 種', [
  async (tok, S) => { // 920.0
    S.top = ABCD.map((t, i) => tile(t, C.blue, -1.8 + i * 1.2, 5.7));
    hot('n = 4、r = 2', 4.6, 5.7);
    cap('例子：n = 4、r = 2', '集合 {A, B, C, D} 裡拿 2 個');
  },
  async (tok, S) => { // 953.1
    S.c = {}; S.c.AA = card('AA', C.sky, LX[0], LY[0], 1.4, 0.5); glow(S.c.AA, HL);
    cap('第一個拿 A；可以重複，第二個還能拿 A', 'AA');
  },
  async (tok, S) => { // 970.0
    glow(S.c.AA, null);
    ['AB', 'AC', 'AD'].forEach((t, j) => { S.c[t] = card(t, C.sky, LX[j + 1], LY[0], 1.4, 0.5); });
    cap('第一個 A：AA、AB、AC、AD', '4 種');
  },
  async (tok, S) => { // 981.0
    S.ba = bad('BA ✗（= AB）', LX[0], LY[1]);
    cap('第一個 B：第二個可以拿 A 嗎？不行', 'BA 跟 AB 一樣，順序無關');
  },
  async (tok, S) => { // 1003.2
    ['BB', 'BC', 'BD'].forEach((t, j) => { S.c[t] = card(t, C.sky, LX[j + 1], LY[1], 1.4, 0.5); });
    cap('所以只能 BB、BC、BD', '');
  },
  async (tok, S) => { // 1007.1
    ['CC', 'CD'].forEach((t, j) => { S.c[t] = card(t, C.sky, LX[j + 2], LY[2], 1.4, 0.5); });
    sm('A、B 開頭的都出現過', LX[0] + 0.4, LY[2]);
    cap('C：不能再拿 A、B → CC、CD', '');
  },
  async (tok, S) => { // 1026.6
    S.c.DD = card('DD', C.sky, LX[3], LY[3], 1.4, 0.5);
    cap('D：只剩 DD', '');
  },
  async (tok, S) => { // 1037.8
    Object.values(S.c).forEach((m) => glow(m, OKG));
    good('一共 10 種', 4.8, 3.0);
    cap('n = 4、r = 2：一共 10 種', '可是 n、r 大一點就很難列');
  },
  async (tok, S) => { // 1058.2
    Object.values(S.c).forEach((m) => glow(m, null));
    note('答案只跟「A 幾個、B 幾個、C 幾個、D 幾個」有關', 0, 0.8);
    cap('換個角度：只跟每一種拿了幾個有關', '');
  },
]);

const PAT = { AA: 'xx|||', AB: 'x|x||', AC: 'x||x|', AD: 'x|||x', BB: '|xx||', BC: '|x|x|', BD: '|x||x', CC: '||xx|', CD: '||x|x', DD: '|||xx' };
const pshow = (s) => s.split('').map((c) => (c === 'x' ? '×' : '|')).join(' ');
// 5 個位置：2 個 ×（橘色方塊）+ 3 條 |（灰色細柱）
function makePat(y, sp = 1.3) {
  const xs = [0, 1].map(() => tile('×', C.orange, 0, y, 0.7));
  const bs = [0, 1, 2].map(() => cube('', '#8a7a60', [0.18, 1.1, 0.3], 0, y, 0, 0));
  const P2 = { xs, bs, y, async set(tok, s, ms = 800) { let xi = 0, bi = 0; const list = s.split('').map((c, i) => [c === 'x' ? xs[xi++] : bs[bi++], (i - 2) * sp, y]); await moveAll(tok, list, ms, 0.4); } };
  return P2;
}
scene('acB-bars', '10A：用 × 和 | 表示每一種選法', [
  async (tok, S) => { // 1086.1
    S.P = makePat(5.0); S.P.xs.forEach((m) => { m.position.set(-6.0 + m.position.x, 6.0, 0); m.visible = false; });
    const bx = [-1.8, 0, 1.8]; S.P.bs.forEach((m, i) => m.position.set(bx[i], 5.0, 0));
    S.zl = ['A', 'B', 'C', 'D'].map((t, i) => hd(t, -2.7 + i * 1.8, 6.0));
    cap('四種東西 → 3 條隔板隔成 4 區', '這區是 A、B、C、D');
  },
  async (tok, S) => { // 1099.3
    S.P.xs.forEach((m, j) => { m.visible = true; m.position.set(-3.0 + j * 0.65, 5.0, 0); });
    S.lab = hot('AA', 4.6, 5.0);
    cap('兩個 A：在 A 區打兩個 ×', 'B、C、D 都沒有');
  },
  async (tok, S) => { // 1114.8
    gone(S.zl);
    await S.P.set(tok, PAT.AA, 700);
    S.rows = []; ['AA', 'AB', 'AC', 'AD'].forEach((k, i) => S.rows.push(sm(k + '  →  ' + pshow(PAT[k]), -3.2, 3.6 - i * 0.6)));
    cap('同樣：AB、AC、AD 也各畫一個', '× 寫在它屬於的那一區');
  },
  async (tok, S) => { // 1124.6
    ['BB', 'BC', 'BD', 'CC', 'CD', 'DD'].forEach((k, i) => S.rows.push(sm(k + '  →  ' + pshow(PAT[k]), i < 1 ? -3.2 : 3.2, i < 1 ? 3.6 - 4 * 0.6 : 3.6 - (i - 1) * 0.6)));
    cap('BB、BC、BD、CC、CD、DD 也一樣', '10 種選法 → 10 個圖案');
  },
  async (tok, S) => { // 1144.3
    S.n1 = note('每種選法 ↔ 一個「2 個 × + 3 條 |」的排列', 0, 0.4);
    cap('左邊每一種 ↔ 右邊一個圖案', '要說明這是 one-to-one correspondence');
  },
  async (tok, S) => { // 1171.4
    glow(S.P.xs[0], HL);
    S.rows[1].element.className = 'lab-label ptr alt'; S.rows[4].element.className = 'lab-label ptr alt';
    cap('選法不一樣 → 每種的個數不一樣', '畫出來的圖案就不一樣');
  },
  async (tok, S) => { // 1201.5
    S.rows[1].element.className = 'lab-label idx'; S.rows[4].element.className = 'lab-label idx';
    glow(S.P.xs[0], null);
    await S.P.set(tok, PAT.CC, 900); txt(S.lab, '= CC');
    cap('反過來：5 個符號隨便排一排', '| | × × | → 兩個 × 在 C 區 = CC');
  },
  async (tok, S) => { // 1224.6
    await S.P.set(tok, PAT.AB, 900); txt(S.lab, '= AB');
    cap('× | × | | → A 區一個、B 區一個', '= AB');
  },
  async (tok, S) => { // 1249.5
    gone(S.n1);
    S.n2 = good('bijection → 兩邊個數一樣', 0, 0.4);
    cap('這是 bijection，兩邊數目一樣', '數選法 = 數這種排列');
  },
  async (tok, S) => { // 1264.2
    gone(S.n2);
    S.ans = card('5 個符號：2 個 ×、3 條 | → 5! / (2! 3!) = 10', C.mint, 0, 0.4, 7.0); glow(S.ans, OKG);
    cap('這種排列有幾種？前面學過', '5!/(2!3!) = 10，跟列出來的一樣');
  },
]);

// ════════ NarGsMWpqc8（趙啟超 10B：C(n+r−1, r)、非負整數解、排容原理） ════════
const SLX = (i) => (i - 2) * 1.3;
scene('acB-bars2', '10B：C(5, 2) = 10，推廣成 C(n + r − 1, r)', [
  async (tok, S) => { // 4.2
    S.l = card('所有選法（拿 2 個）', C.sky, -3.4, 5.6, 3.6); S.r = card('所有「2 個 × 3 條 |」圖案', C.peach, 3.4, 5.6, 4.4);
    S.a1 = arrow(V3(-1.4, 5.8, 0.4), V3(1.0, 5.8, 0.4)); S.a2 = arrow(V3(1.0, 5.4, 0.4), V3(-1.4, 5.4, 0.4));
    cap('每種選法 ↔ 一個圖案', '1-to-1 correspondence（bijection）');
  },
  async (tok, S) => { // 56.0
    S.e = hot('|左邊| = |右邊|', 0, 4.7);
    cap('bijection → 兩個集合 size 一樣', '數左邊 = 數右邊');
  },
  async (tok, S) => { // 70.0
    S.nums = []; S.slots = [0, 1, 2, 3, 4].map((i) => { S.nums.push(sm(String(i + 1), SLX(i), 2.7)); return cube('', C.sand, [0.9, 0.12, 0.6], SLX(i), 2.95, 0, 0); });
    cap('右邊：一共 5 個位置', '2 個 × 和 3 條 |');
  },
  async (tok, S) => { // 81.0
    S.X = [1, 3].map((i) => tile('×', C.orange, SLX(i), 3.45, 0.7)); S.B = [0, 2, 4].map((i) => cube('', '#8a7a60', [0.18, 1.0, 0.3], SLX(i), 3.5, 0, 0));
    S.sx = sm('示意：挑第 2、4 格', 4.6, 3.5);
    cap('挑 2 個位置放 ×', '剩下的位置只能放 |');
  },
  async (tok, S) => { // 85.3
    S.a = card('C(5, 2) = 10', C.mint, 0, 1.6, 3.2); glow(S.a, OKG);
    cap('5 個位置挑 2 個：C(5, 2) = 10', 'n = 4、r = 2 的答案');
  },
  async (tok, S) => { // 119.0
    gone(S.slots, S.nums, S.X, S.B, S.a, S.e, S.l, S.r, S.a1, S.a2, S.sx);
    S.c = chain(0, 5.6, 0.75, 7.2);
    S.c.add('拿 r 個 → r 個 ×', C.peach);
    cap('推廣：要拿 r 個東西 → r 個 ×', '剛才拿 2 個，所以 2 個 ×');
  },
  async (tok, S) => { // 130.0
    S.c.add('n 種東西 → n − 1 條 |（隔成 n 區）', C.gray);
    cap('有 n 種東西 → 只要 n − 1 條隔板', '剛才 4 種用 3 條');
  },
  async (tok, S) => { // 141.1
    S.c.add('一共 r + (n − 1) = n + r − 1 個位置', C.sky);
    cap('全部 n + r − 1 個位置', '');
  },
  async (tok, S) => { // 159.0
    S.c.add('挑 r 個放 × → C(n + r − 1, r)', C.mint);
    cap('挑出 r 個位置放 ×，剩下放 |', 'C(n + r − 1, r)');
  },
  async (tok, S) => { // 178.0
    S.c.add('= C(n + r − 1, n − 1)（挑 | 的位置也一樣）', C.lilac);
    cap('寫成 C(n + r − 1, n − 1) 也對', '老師喜歡寫「取 r」：拿幾個就取幾個');
  },
  async (tok, S) => { // 194.0
    S.c.ls.forEach((m) => glow(m, null));
    S.f = card('無順序、可重複：C(n + r − 1, r)', C.mint, 0, 1.2, 6.4); glow(S.f, OKG);
    cap('把答案填回第四種', '高中也學過「重複組合」');
  },
]);

scene('acB-eqn', '10B：x₁ + x₂ + x₃ + x₄ = 2 的非負整數解', [
  async (tok, S) => { // 228.5
    S.t = ABCD.map((t, i) => tile(t, C.blue, -3.6 + i * 2.4, 6.2));
    cap('選法只跟 A、B、C、D 各拿幾個有關', '');
  },
  async (tok, S) => { // 236.2
    S.v = ['x₁', 'x₂', 'x₃', 'x₄'].map((t, i) => hot(t + ' = A 的個數'.replace('A', ABCD[i]), -3.6 + i * 2.4, 5.4));
    cap('A 的個數叫 x₁、B 叫 x₂、C 叫 x₃、D 叫 x₄', '');
  },
  async (tok, S) => { // 244.1
    S.e = card('x₁ + x₂ + x₃ + x₄ = 2', C.lilac, 0, 4.65, 4.6); glow(S.e, HL);
    cap('一共拿 2 個：x₁ + x₂ + x₃ + x₄ = 2', '');
  },
  async (tok, S) => { // 253.0
    glow(S.e, null);
    note('每種選法 ↔ 一組非負整數解（每個 xᵢ ≥ 0）', 0, 3.95);
    cap('每一種選法 ↔ 一組非負整數解', 'non-negative integer solution');
  },
  async (tok, S) => { // 302.0
    S.g = card('x₁ + ⋯ + xₙ = r 的非負整數解：C(n + r − 1, r) 組', C.mint, 0, 3.2, 7.4); glow(S.g, OKG);
    cap('一般：x₁ + ⋯ + xₙ = r 的非負整數解', '個數 = 從 n 種可重複拿 r 個');
  },
  async (tok, S) => { // 363.2
    glow(S.g, null);
    [['AA', '(2, 0, 0, 0)'], ['AB', '(1, 1, 0, 0)'], ['AC', '(1, 0, 1, 0)'], ['AD', '(1, 0, 0, 1)']].forEach(([a, b], i) => sm(a + ' → ' + b, -4.6 + i * 3.05, 2.5));
    cap('AA 是 2000，AB 是 1100', 'AC 是 1010，AD 是 1001');
  },
  async (tok, S) => { // 375.6
    S.ok = good('兩邊一一對應 → 一樣是 C(5, 2) = 10 組', 0, 1.8);
    cap('任何一組解 ↔ 一種選法', '數目一樣');
  },
  async (tok, S) => { // 392.6
    gone(S.ok);
    S.p = card('正整數解（每個 xᵢ ≥ 1）？令 yᵢ = xᵢ − 1 ≥ 0', C.peach, 0, 1.6, 7.4); glow(S.p, HL);
    cap('如果要 positive integer solution 呢？', '每個先扣掉 1，就變成非負');
  },
  async (tok, S) => { // 401.4
    glow(S.p, null);
    S.q = card('y₁ + ⋯ + yₙ = r − n（扣掉的 n 搬到右邊）', C.mint, 0, 0.8, 7.4); glow(S.q, OKG);
    cap('把扣掉的 1 搬到右邊', '又變回非負整數解的問題');
  },
]);

scene('acB-ie2', '10B：兩個集合的排容原理', [
  async (tok, S) => { // 442.6
    hot('principle of inclusion and exclusion（排容原理）', 0, 6.6);
    cap('principle of inclusion and exclusion', '以前看過簡單的 case，這裡講廣義的');
  },
  async (tok, S) => { // 463.6
    S.A = ring(-1.1, 3.6, 2.0); S.B = ring(1.1, 3.6, 2.0, '#4b7aa8');
    hd('A', -2.9, 5.6); hd('B', 2.9, 5.6);
    cap('兩個集合 A、B 的 Venn diagram', '');
  },
  async (tok, S) => { // 475.8
    S.q = card('|A ∪ B| = ？', C.lilac, 4.9, 1.0, 2.8);
    cap('要算 A ∪ B 的 cardinality（大小）', '');
  },
  async (tok, S) => { // 484.8
    S.nA = hot('1', -2.1, 3.6); S.nAB = hot('1', 0, 3.6);
    S.f = sm('|A|', -4.2, 1.0);
    cap('先把 |A| 算進來', '圈裡的數字 = 這塊被算了幾次');
  },
  async (tok, S) => { // 488.3
    S.nB = hot('1', 2.1, 3.6); txt(S.nAB, '2');
    txt(S.f, '|A| + |B|');
    cap('再加 |B|', '');
  },
  async (tok, S) => { // 498.4
    S.nAB.element.className = 'lab-label bad';
    cap('中間 A ∩ B 被算了兩次', 'A 算一次、B 又算一次');
  },
  async (tok, S) => { // 507.4
    txt(S.nAB, '1'); S.nAB.element.className = 'lab-label good';
    gone(S.q); txt(S.f, ' ');
    S.r = card('|A ∪ B| = |A| + |B| − |A ∩ B|', C.mint, 0, 0.5, 6.2); glow(S.r, OKG);
    cap('把重複的扣掉：− |A ∩ B|', '每一塊都剛好算一次');
  },
]);

const V3X = -1.9;
const R3 = { A: [-2.0, 4.8], B: [2.0, 4.8], C: [0, 1.2], AB: [0, 4.9], AC: [-1.2, 2.9], BC: [1.2, 2.9], ABC: [0, 3.6] };
scene('acB-ie3', '10B：三個集合的排容原理', [
  async (tok, S) => { // 539.4
    ring(V3X - 1.1, 4.2, 1.7); ring(V3X + 1.1, 4.2, 1.7, '#4b7aa8'); ring(V3X, 2.4, 1.7, '#5c8a4a');
    hd('A', V3X - 2.6, 5.9); hd('B', V3X + 2.6, 5.9); hd('C', V3X + 1.9, 0.9);
    S.q = hot('|A ∪ B ∪ C| = ？', 3.9, 6.3);
    cap('三個集合：|A ∪ B ∪ C| 怎麼算？', '');
  },
  async (tok, S) => { // 559.9
    S.n = {}; const v = { A: 1, B: 1, C: 1, AB: 2, AC: 2, BC: 2, ABC: 3 };
    Object.keys(R3).forEach((k) => { S.n[k] = hot(String(v[k]), V3X + R3[k][0], R3[k][1]); });
    S.c = chain(4.4, 5.4, 0.7, 3.2); S.c.add('+|A| +|B| +|C|');
    cap('先把三個的 size 加起來', '數字 = 那一塊被算了幾次');
  },
  async (tok, S) => { // 567.0
    txt(S.n.AB, '1'); txt(S.n.ABC, '2'); S.c.add('− |A ∩ B|', C.peach);
    cap('A ∩ B 重複了 → 扣掉', '');
  },
  async (tok, S) => { // 575.0
    txt(S.n.BC, '1'); txt(S.n.ABC, '1'); S.c.add('− |B ∩ C|', C.peach);
    cap('B ∩ C 也重複 → 扣掉', '');
  },
  async (tok, S) => { // 580.9
    txt(S.n.AC, '1'); txt(S.n.ABC, '0'); S.c.add('− |C ∩ A|', C.peach);
    cap('C ∩ A 也重複 → 扣掉', '');
  },
  async (tok, S) => { // 587.4
    S.n.ABC.element.className = 'lab-label bad';
    cap('可是正中間被扣了三次', '加三次、扣三次 → 變成 0，完全沒算到');
  },
  async (tok, S) => { // 599.0
    txt(S.n.ABC, '1'); S.n.ABC.element.className = 'lab-label good';
    Object.values(S.n).forEach((l) => { l.element.className = 'lab-label good'; });
    S.c.add('+ |A ∩ B ∩ C|', C.mint);
    cap('把三個的交集加回來', '每一塊都剛好算一次');
  },
  async (tok, S) => { // 618.0
    S.c.ls.forEach((m) => glow(m, null));
    S.f = card('= 單個和 − 兩兩和 + 三個交集', C.mint, 4.4, 1.7, 3.9); glow(S.f, OKG);
    cap('|A∪B∪C| = 單個和 − 兩兩交集和 + 三個交集', '');
  },
]);

scene('acB-iegen', '10B：n 個集合的排容原理（定理）', [
  async (tok, S) => { // 631.0
    S.L = card('|A₁ ∪ A₂ ∪ ⋯ ∪ Aₙ| = ？', C.lilac, 0, 6.3, 5.4); glow(S.L, HL);
    cap('推廣：n 個集合 A₁, A₂, …, Aₙ', '聯集的 size 怎麼算？');
  },
  async (tok, S) => { // 660.4
    glow(S.L, null);
    S.r3 = card('三個集合：α₁ − α₂ + α₃', C.sky, 0, 5.5, 4.6);
    cap('先用變數改寫：α₁ − α₂ + α₃', '');
  },
  async (tok, S) => { // 683.5
    S.d1 = sm('α₁ = 一個一個的 size 加起來', 0, 4.8);
    cap('α₁：每一個集合的 size 的和', '');
  },
  async (tok, S) => { // 686.4
    S.d2 = sm('α₂ = 所有「兩個交集」的 size 的和', 0, 4.3);
    cap('α₂：所有兩兩交集的 size 的和', '');
  },
  async (tok, S) => { // 701.0
    S.d3 = sm('α₃ = 所有「三個交集」的 size 的和', 0, 3.8);
    cap('α₃：三個三個的交集', '三個集合時只有一個');
  },
  async (tok, S) => { // 724.4
    S.g4 = note('四個集合：α₁ − α₂ + α₃ − α₄（一加一減）', 0, 3.1);
    cap('正、負、正…', '猜猜 4 個、5 個集合會怎樣？');
  },
  async (tok, S) => { // 759.5
    gone(S.r3, S.d1, S.d2, S.d3, S.g4);
    S.th = hot('定理：A₁, …, Aₙ 都是 finite set', 0, 5.3);
    cap('定理：n 個 finite set', '不是有限集合，size 就沒有定義');
  },
  async (tok, S) => { // 794.5
    S.R = card('= α₁ − α₂ + α₃ − ⋯ + (−1)ⁿ⁻¹ αₙ', C.mint, 0, 4.3, 6.6); glow(S.R, OKG);
    cap('一直加減到 αₙ', 'αₙ 是 n 個全部交集');
  },
  async (tok, S) => { // 835.4
    glow(S.R, null);
    S.sg = sm('奇數個 → +，偶數個 → −，所以 αₙ 前面是 (−1)ⁿ⁻¹', 0, 3.5);
    cap('奇數是正、偶數是負', 'αₙ 前面是 (−1)ⁿ⁻¹');
  },
  async (tok, S) => { // 855.3
    S.ai = card('αᵢ = Σ |每 i 個集合的交集|（taken i at a time）', C.sky, 0, 2.6, 7.4); glow(S.ai, HL);
    cap('αᵢ：一次拿 i 個集合做交集', '所有這種交集的 size 加起來，i = 1..n');
  },
  async (tok, S) => { // 925.5
    glow(S.ai, null);
    note('下次上課：直接證一般的 n（2、3 就不用另外證）', 0, 1.5);
    cap('今天先寫結果，下次證明', '');
  },
]);

// ════════ oWrW8vI5Bas（趙啟超 11A：排容原理的證明、Euler φ） ════════
scene('acB-ierecap', '11A：複習排容原理；名字的意思', [
  async (tok, S) => { // 13.2
    S.L = card('|A₁ ∪ A₂ ∪ ⋯ ∪ Aₙ|（都是 finite set）', C.lilac, 0, 6.0, 6.6); glow(S.L, HL);
    cap('上次：n 個 finite set 的聯集', 'cardinality（元素個數）怎麼算');
  },
  async (tok, S) => { // 52.2
    glow(S.L, null);
    S.R = card('= α₁ − α₂ + α₃ − ⋯ + (−1)ⁿ⁻¹ αₙ', C.mint, 0, 5.1, 6.6); glow(S.R, OKG);
    sm('αᵢ = 所有 i 個 i 個交集的 size 的和', 0, 4.4);
    cap('α₁ − α₂ + α₃ − ⋯', '奇數加、偶數減');
  },
  async (tok, S) => { // 98.0
    glow(S.R, null);
    S.i = card('Inclusion：包含進來（+）', C.sky, -3.1, 3.2, 4.4); S.e = card('Exclusion：排除在外（−）', C.peach, 3.1, 3.2, 4.4);
    cap('為什麼叫 Inclusion and Exclusion？', 'inclusion 包含，exclusion 排除');
  },
  async (tok, S) => { // 103.5
    note('加進來 → 多了就減掉 → 減多了再加回來 ⋯', 0, 2.2);
    cap('加進來、減掉、又加回來…', '加加減減');
  },
  async (tok, S) => { // 116.5
    good('n = 2、n = 3 看過了 → 證明一般的 n', 0, 1.2);
    cap('來證明一般 n 的情況', '');
  },
]);

const BX = [-4.8, -2.4, 0, 2.4, 4.8], HAS = [true, false, true, true, false];
scene('acB-proof', '11A：證明：每個元素剛好貢獻 1', [
  async (tok, S) => { // 129.3
    S.t = card('左邊 = 聯集裡元素的個數', C.lilac, 0, 6.3, 5.0);
    cap('證明：左邊就是聯集裡有幾個元素', '');
  },
  async (tok, S) => { // 159.7
    S.k = card('要證：每個元素對右邊剛好貢獻 1', C.peach, 0, 5.6, 5.8); glow(S.k, HL);
    cap('想法：每個元素對右邊的式子，加加減減後', '剛好貢獻 1');
  },
  async (tok, S) => { // 186.7
    glow(S.k, null);
    S.s = sm('每個貢獻 1 → 全部加起來 = 元素個數 = 左邊', 0, 4.95);
    cap('每個都貢獻 1，加起來就是元素個數', '右邊 = 左邊');
  },
  async (tok, S) => { // 214.7
    gone(S.t, S.k, S.s);
    S.box = BX.map((x, i) => { const m = cube('', C.sand, [1.9, 1.3, 0.4], x, 5.1, -0.3, 0); hd('A' + '₁₂₃₄₅'[i], x, 6.05); return m; });
    S.x = tile('x', C.gold, -6.3, 5.1, 0.6);
    sm('n = 5（示意）', 5.4, 6.4);
    cap('拿聯集裡的一個元素 x', 'x 至少在其中一個集合裡');
  },
  async (tok, S) => { // 241.0
    S.box.forEach((m, i) => { if (HAS[i]) { glow(m, OKG); tile('x', C.gold, BX[i], 5.1, 0.5); } });
    kill(S.x);
    S.r = hot('x 剛好在 r 個集合裡（示意 r = 3），1 ≤ r ≤ n', 0, 4.05);
    cap('假設 x 剛好在 r 個集合裡', 'r 至少 1、最多 n');
  },
  async (tok, S) => { // 292.4
    S.col = ['α₁', 'α₂', 'α₃', 'α₄', 'α₅'].map((t, i) => hd(t, BX[i], 3.2));
    S.v = [card('C(r,1) = 3', C.mint, BX[0], 2.4, 2.1, 0.5)];
    cap('x 對 α₁ 的貢獻：在幾個集合裡就是幾', 'α₁ = |A₁| + ⋯ + |Aₙ| → 貢獻 r');
  },
  async (tok, S) => { // 365.6
    S.v.push(card('C(r,2) = 3', C.mint, BX[1], 2.4, 2.1, 0.5));
    sm('Aᵢ ∩ Aⱼ 要 i、j 都在那 r 個裡', BX[1] + 1.0, 1.7);
    cap('α₂：x 要同時在 Aᵢ 和 Aⱼ 才算 1', '從 r 個裡挑 2 個：C(r, 2)');
  },
  async (tok, S) => { // 489.2
    S.v.push(card('C(r,3) = 1', C.mint, BX[2], 2.4, 2.1, 0.5));
    cap('一般的 αᵢ（i ≤ r）：貢獻 C(r, i)', 'i 個集合都要從那 r 個裡挑');
  },
  async (tok, S) => { // 574.7
    S.v.push(card('0', C.gray, BX[3], 2.4, 1.4, 0.5), card('0', C.gray, BX[4], 2.4, 1.4, 0.5));
    cap('i > r：x 不可能同時在 i 個集合裡', '貢獻 0');
  },
  async (tok, S) => { // 628.0
    S.net = card('淨貢獻 = C(r,1) − C(r,2) + ⋯ + (−1)ʳ⁻¹ C(r,r)', C.lilac, 0, 0.95, 7.4); glow(S.net, HL);
    sm('示意 r = 3：3 − 3 + 1 = 1', 0, 0.3);
    cap('照 α 前面的正負加加減減', '這就是 x 對右邊的 net contribution');
  },
]);

scene('acB-pascal', '11A：Pascal 三角形同一列加減 = 0', [
  async (tok, S) => { // 703.4
    S.q = card('C(r,1) − C(r,2) + ⋯ + (−1)ʳ⁻¹ C(r,r) = ？', C.lilac, 0, 6.4, 7.0); glow(S.q, HL);
    cap('這個加減的值是多少？', '回憶以前講過的式子');
  },
  async (tok, S) => { // 717.6
    glow(S.q, null);
    const rows = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
    S.row3 = [];
    rows.forEach((r, k) => r.forEach((v, j) => { const m = tile(String(v), k === 3 ? C.peach : C.sky, (j - k / 2) * 0.8, 5.5 - k * 0.62, 0.52); if (k === 3) S.row3.push(m); }));
    ['+', '−', '+', '−'].forEach((s, j) => hot(s, (j - 1.5) * 0.8, 3.1));
    S.z = card('C(r,0) − C(r,1) + C(r,2) − ⋯ + (−1)ʳ C(r,r) = 0', C.mint, 0, 2.3, 7.4); glow(S.z, OKG);
    sm('示意 r = 3：1 − 3 + 3 − 1 = 0', 4.9, 3.9);
    cap('Pascal 三角形同一列，一加一減 = 0', '');
  },
  async (tok, S) => { // 752.3
    glow(S.z, null);
    S.p = sm('證明：(x + y)ʳ 代 x = 1、y = −1 → (1 − 1)ʳ = 0（r ≥ 1）', 0, 1.6);
    cap('怎麼證？binomial theorem', 'x 代 1、y 代 −1');
  },
  async (tok, S) => { // 761.0
    S.row3[0].material.color.set(C.gold); glow(S.row3[0], HL);
    cap('跟我們要的式子很像', '只差了第一項 C(r, 0)');
  },
  async (tok, S) => { // 765.7
    S.m = card('C(r,1) − C(r,2) + ⋯ + (−1)ʳ⁻¹ C(r,r) = C(r,0)', C.peach, 0, 0.9, 7.4); glow(S.m, HL);
    cap('其他項搬到另一邊', '剩下的就是 C(r, 0)');
  },
  async (tok, S) => { // 792.5
    glow(S.m, null);
    S.one = good('C(r, 0) = 1', 0, 0.25);
    cap('C(r, 0) = 1', '每個 x 的淨貢獻都是 1');
  },
  async (tok, S) => { // 804.7
    gone(S.q); S.d = card('每個元素貢獻 1 → 右邊 = 元素個數 = |聯集|  ∎', C.mint, 0, 6.4, 7.4); glow(S.d, OKG);
    cap('有幾個 x 就貢獻幾', '右邊 = 聯集的 cardinality，證完');
  },
  async (tok, S) => { // 826.4
    glow(S.d, null);
    note('只用到 binomial coefficient 的性質，其他只是數一數', 0, 7.1);
    cap('重點只用到這個 binomial 的性質', '剩下是數每個元素貢獻多少');
  },
]);

scene('acB-phidef', '11A：Euler φ(n) 的定義', [
  async (tok, S) => { // 902.1
    S.t = card('排容原理 = 算聯集的 size', C.sky, 0, 6.2, 4.6);
    cap('排容原理只是在算聯集的 size', '來看一個例子：函數 φ(n)');
  },
  async (tok, S) => { // 931.0
    S.n = ['1', '2', '3', '4', '5', '6', '7', '8', '⋯', 'n'].map((t, i) => tile(t, t === '⋯' ? C.gray : C.blue, -4.5 + i * 1.0, 4.6, 0.7));
    sm('n 是正整數', 4.9, 5.4);
    cap('n 是正整數，看 1 到 n 這些整數', '');
  },
  async (tok, S) => { // 943.2
    S.rp = card('relatively prime（互質）：gcd(m, n) = 1', C.lilac, 0, 3.3, 6.4); glow(S.rp, HL);
    cap('relatively prime：最大公因數是 1', '除了 1 以外沒有共同的因數');
  },
  async (tok, S) => { // 969.1
    glow(S.rp, null);
    S.d = card('φ(n) = 1 到 n 中跟 n 互質的個數', C.mint, 0, 2.2, 6.4); glow(S.d, OKG);
    cap('φ(n)：1 到 n 裡跟 n 互質的整數有幾個', '大家都用 φ 這個符號');
  },
]);

scene('acB-phiname', '11A：Euler’s phi（totient）function', [
  async (tok, S) => { // 1112.7
    S.a = card('Euler’s phi function', C.sky, 0, 5.6, 4.6); glow(S.a, HL);
    cap('這個函數很有名：Euler’s phi function', 'Euler（尤拉），18 世紀瑞士數學家');
  },
  async (tok, S) => { // 1126.0
    glow(S.a, null);
    S.b = card('也叫 Euler’s totient function', C.peach, 0, 4.7, 4.6);
    cap('也有人叫它 Euler’s totient function', '名字不同，是同一個函數');
  },
  async (tok, S) => { // 1146.0
    S.c = card('φ(n) = | { m : 1 ≤ m ≤ n，gcd(m, n) = 1 } |', C.mint, 0, 3.4, 7.0); glow(S.c, OKG);
    cap('用集合寫：這個集合的 size', '跟剛才用文字講的一樣');
  },
]);

// ════════ Mez5poBYLcc（趙啟超 11B：φ 的小例子、φ(60) = 16） ════════
const PHIY = (n) => 6.1 - (n - 1) * 0.95;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function phiRow(n, S, show) {
  const ms = []; for (let m = 1; m <= n; m++) ms.push(tile(String(m), C.sky, -4.4 + (m - 1) * 1.0, PHIY(n), 0.66));
  hd('n = ' + n, -6.0, PHIY(n));
  S['r' + n] = ms; if (show) phiMark(n, S);
}
function phiMark(n, S) {
  let c = 0; S['r' + n].forEach((m, i) => { const ok = gcd(i + 1, n) === 1; if (ok) c++; m.material.color.set(ok ? C.green : C.red); });
  good('φ(' + n + ') = ' + c, 3.6, PHIY(n));
}
scene('acB-phismall', '11B：φ(1)…φ(6)：1, 1, 2, 2, 4, 2', [
  async (tok, S) => { // 19.0
    phiRow(1, S, true);
    sm('綠 = 跟 n 互質，紅 = 不互質', 3.6, 6.9);
    cap('n = 1：1 到 1 只有 1，跟 1 互質', 'φ(1) = 1');
  },
  async (tok, S) => { // 25.2
    phiRow(2, S, false);
    cap('n = 2：看 1、2', '');
  },
  async (tok, S) => { // 61.4
    phiMark(2, S);
    cap('2 跟 2 不互質（自己跟自己）', 'φ(2) = 1');
  },
  async (tok, S) => { // 82.1
    phiRow(3, S, true);
    cap('n = 3：1、2 跟 3 的 gcd 都是 1', '3 跟 3 的 gcd 是 3 → φ(3) = 2');
  },
  async (tok, S) => { // 102.9
    phiRow(4, S, true);
    cap('n = 4：2 跟 4 有公因數 2', '1、3 互質 → φ(4) = 2');
  },
  async (tok, S) => { // 127.6
    phiRow(5, S, true);
    cap('n = 5：除了 5 自己，都跟 5 互質', 'φ(5) = 4');
  },
  async (tok, S) => { // 143.3
    phiRow(6, S, true);
    cap('n = 6：只有 1、5 互質', '2、3、4、6 都有公因數 → φ(6) = 2');
  },
]);

scene('acB-phi0', '11B：從 0 到 n − 1 算也一樣', [
  async (tok, S) => { // 172.7
    S.t = [0, 1, 2, 3, 4, 5, 6].map((m) => tile(String(m), C.sky, -4.2 + m * 1.4, 4.4, 0.8));
    S.b1 = sm('定義：1 到 n（示意 n = 6）', 1.4, 5.4);
    cap('定義：1 到 n 裡跟 n 互質的個數', '');
  },
  async (tok, S) => { // 189.4
    S.b2 = sm('也可以定義：0 到 n − 1', -1.4, 3.4);
    cap('也可以定義成 0 到 n − 1', '兩個數目一樣，為什麼？');
  },
  async (tok, S) => { // 210.4
    S.t[6].material.color.set(C.red);
    sm('gcd(6, 6) = 6', 4.2, 5.4 - 2.4);
    cap('n 跟 n 不互質', 'gcd(n, n) = n');
  },
  async (tok, S) => { // 225.0
    S.t[0].material.color.set(C.red);
    S.z = card('0 = 3 × 0 = 4 × 0 = 6 × 0', C.peach, 0, 1.8, 5.0); glow(S.z, HL);
    cap('0 是任何正整數的倍數', '所以 0 跟 n 也不互質（n ≥ 2）');
  },
  async (tok, S) => { // 258.2
    glow(S.z, null);
    [1, 5].forEach((m) => S.t[m].material.color.set(C.green));
    good('兩頭都不算 → 兩種定義一樣（這裡都是 2）', 0, 0.8);
    cap('兩個邊界都不會算進去', '從哪邊開始都一樣');
  },
]);

const PR100 = '2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97'.split(' ');
scene('acB-phiprime', '11B：質數 p：φ(p) = p − 1', [
  async (tok, S) => { // 268.7
    [['φ(2) = 1', -3.4], ['φ(3) = 2', 0], ['φ(5) = 4', 3.4]].forEach(([t, x]) => card(t, C.sky, x, 6.0, 2.6));
    cap('φ(2) = 1、φ(3) = 2、φ(5) = 4', '2、3、5 都是質數');
  },
  async (tok, S) => { // 287.3
    S.p = card('p 是質數 → φ(p) = p − 1', C.mint, 0, 5.0, 5.2); glow(S.p, OKG);
    cap('質數 p：φ(p) = p − 1', '只要扣掉 p 自己');
  },
  async (tok, S) => { // 303.0
    glow(S.p, null);
    sm('質數：除了 1 和自己，沒有其他因數', 0, 4.25);
    cap('質數：除了 1 和本身沒有其他因數', '比它小的數跟它的 gcd 都是 1');
  },
  async (tok, S) => { // 320.8
    PR100.forEach((p, i) => tile(p, C.peach, -5.4 + (i % 13) * 0.9, 3.2 - Math.floor(i / 13) * 0.85, 0.66));
    sm('≤ 100 的質數：25 個', 0, 1.25);
    cap('小於等於 100 的質數', '');
  },
  async (tok, S) => { // 334.5
    note('要背它們：做質因數分解要用', 0, 0.4);
    cap('為什麼要背？做質因數分解', '');
  },
]);

scene('acB-phi60', '11B：φ(60)：拿掉 2、3、5 的倍數', [
  async (tok, S) => { // 365.5
    hot('φ(60) = ？', 0, 6.6);
    S.r = [1, 2, 3, 4, 5, 6].map((m) => tile(String(m), C.sky, -3.75 + (m - 1) * 1.5, 5.4, 0.8));
    S.l0 = sm('先看 φ(6)', 5.4, 5.4);
    cap('要算 φ(60)，先看 φ(6)', '');
  },
  async (tok, S) => { // 381.7
    S.r[1].material.color.set(C.red); S.l1 = sm('gcd = 2', S.r[1].position.x, 4.6);
    cap('2 要拿掉：2 跟 6 的 gcd 是 2', '因為 6 有因數 2');
  },
  async (tok, S) => { // 401.1
    S.r[2].material.color.set(C.red); S.l2 = sm('6 有因數 3', S.r[2].position.x, 4.6);
    cap('3 要拿掉：6 有因數 3', '');
  },
  async (tok, S) => { // 410.2
    S.r[3].material.color.set(C.red); S.r[5].material.color.set(C.red); S.l3 = sm('2 的倍數', S.r[3].position.x, 4.6);
    [0, 4].forEach((i) => S.r[i].material.color.set(C.green));
    cap('4 是 2 的倍數，也要拿掉', '');
  },
  async (tok, S) => { // 428.2
    S.k = card('把「質因數的倍數」都拿掉', C.lilac, 0, 3.7, 5.0); glow(S.k, HL);
    cap('就是把質因數的倍數都拿掉', '');
  },
  async (tok, S) => { // 440.4
    glow(S.k, null);
    S.f = card('60 = 2² × 3 × 5', C.peach, 0, 2.9, 3.6); glow(S.f, HL);
    cap('先做質因數分解', '60 = 2² × 3 × 5');
  },
  async (tok, S) => { // 482.2
    gone(S.r, S.k, S.f, S.l0, S.l1, S.l2, S.l3);
    S.g = []; for (let m = 1; m <= 60; m++) S.g.push(tile(String(m), C.sky, -4.95 + ((m - 1) % 15) * 0.7, 5.4 - Math.floor((m - 1) / 15) * 0.62, 0.5));
    S.f = card('60 = 2² × 3 × 5', C.peach, 0, 1.9, 3.6, 0.55, 0, 0);
    await wt(tok, 400);
    for (const p of [2, 3, 5]) { S.g.forEach((m, i) => { if ((i + 1) % p === 0) m.material.color.set(C.gray); }); await wt(tok, 500); }
    S.g.forEach((m, i) => { if (gcd(i + 1, 60) === 1) m.material.color.set(C.green); });
    cap('1 到 60 裡拿掉 2、3、5 的倍數', '剩下的（綠色）就跟 60 互質');
  },
]);

scene('acB-phiform', '11B：寫成集合：補集、De Morgan、排容', [
  async (tok, S) => { // 499.2
    S.c = chain(0, 6.3, 0.78, 7.6);
    S.c.add('φ(60) = | { m : 1 ≤ m ≤ 60，gcd(m, 60) = 1 } |', C.lilac);
    cap('原來的定義：這個集合的 size', '');
  },
  async (tok, S) => { // 524.3
    S.c.add('= | { m : 1 ≤ m ≤ 60，2 ∤ m，3 ∤ m，5 ∤ m } |');
    cap('2、3、5 都不是 m 的因數', '逗點 = 而且，都要成立');
  },
  async (tok, S) => { // 587.0
    S.d = sm('定義 Aᵢ = { m : 1 ≤ m ≤ 60，i | m }，i = 2, 3, 5', 0, 1.5);
    cap('定義 Aᵢ：1 到 60 中 i 的倍數', 'i 只要 2、3、5（60 的質因數）');
  },
  async (tok, S) => { // 615.1
    S.c.add('= | A₂ᶜ ∩ A₃ᶜ ∩ A₅ᶜ |', C.peach);
    cap('不是 2 的倍數 = A₂ 的 complement', '三個都要成立 → 交集');
  },
  async (tok, S) => { // 663.0
    S.c.add('= | (A₂ ∪ A₃ ∪ A₅)ᶜ |（De Morgan’s law）', C.sky);
    cap('De Morgan’s law：補集的交集', '= 聯集的補集');
  },
  async (tok, S) => { // 676.0
    S.c.add('= 60 − | A₂ ∪ A₃ ∪ A₅ |', C.sky);
    cap('聯集的補集 = 全部 60 個扣掉聯集', '');
  },
  async (tok, S) => { // 689.6
    S.c.add('= 60 − ( α₁ − α₂ + α₃ )（排容原理）', C.mint);
    cap('聯集 → 套排容原理（PIE）', '交集先取補集、De Morgan 變聯集');
  },
]);

scene('acB-phicalc', '11B：代進去：φ(60) = 60 · ½ · ⅔ · ⅘ = 16', [
  async (tok, S) => { // 756.0
    S.a2 = card('|A₂| = 60 / 2 = 30', C.sky, -3.6, 6.6, 4.2); glow(S.a2, HL);
    cap('|A₂|：1 到 60 裡 2 的倍數', '60 ÷ 2 = 30 個');
  },
  async (tok, S) => { // 789.5
    glow(S.a2, null);
    card('|A₃| = 60 / 3 = 20', C.sky, -3.6, 5.9, 4.2); card('|A₅| = 60 / 5 = 12', C.sky, -3.6, 5.2, 4.2);
    cap('同理 |A₃| = 20、|A₅| = 12', '');
  },
  async (tok, S) => { // 804.6
    S.b = card('|A₂ ∩ A₃| = 60 / 6 = 10', C.peach, 3.4, 6.6, 4.4); glow(S.b, HL);
    sm('又是 2 的倍數又是 3 的倍數 = 6 的倍數（最小公倍數）', 0, 4.35);
    cap('又是 2 又是 3 的倍數 → 6 的倍數', '2、3 是質數，lcm = 2 × 3 = 6');
  },
  async (tok, S) => { // 850.5
    glow(S.b, null);
    card('|A₃ ∩ A₅| = 60 / 15 = 4', C.peach, 3.4, 5.9, 4.4); card('|A₅ ∩ A₂| = 60 / 10 = 6', C.peach, 3.4, 5.2, 4.4);
    cap('|A₃ ∩ A₅| = 4、|A₅ ∩ A₂| = 6', '');
  },
  async (tok, S) => { // 861.7
    S.c = card('|A₂ ∩ A₃ ∩ A₅| = 60 / 30 = 2', C.lilac, 0, 3.6, 5.2); glow(S.c, HL);
    cap('三個都是 → 30 的倍數', '60 ÷ 30 = 2');
  },
  async (tok, S) => { // 890.0
    glow(S.c, null);
    S.f = card('60 ( 1 − ½ − ⅓ − ⅕ + 1/6 + 1/15 + 1/10 − 1/30 )', C.sky, 0, 2.75, 7.6); glow(S.f, HL);
    cap('故意不除出來，把 60 提出去', '括號裡一共 8 項');
  },
  async (tok, S) => { // 939.0
    glow(S.f, null);
    S.g = card('= 60 ( 1 − ½ )( 1 − ⅓ )( 1 − ⅕ )', C.mint, 0, 1.95, 6.0); glow(S.g, OKG);
    cap('8 項 = 兩項 × 兩項 × 兩項', '分解成三個括號相乘');
  },
  async (tok, S) => { // 970.3
    glow(S.g, null);
    sm('每個括號挑 1 或 −1/p：2 × 2 × 2 = 8 項', 0, 1.25);
    cap('乘開：每個括號挑一項', '三個 1 → 1；兩個 1 一個 −½ → −½…');
  },
  async (tok, S) => { // 1014.4
    S.ans = card('= 60 × ½ × ⅔ × ⅘ = 16', C.mint, -1.4, 0.5, 4.6); glow(S.ans, OKG);
    sm('驗算：60 − 62 + 20 − 2 = 16', 3.9, 0.5);
    cap('60 × ½ × ⅔ × ⅘ = 16', 'φ(60) = 16');
  },
]);

scene('acB-phigen', '11B：一般的 n：φ(n) = n ∏(1 − 1/p)', [
  async (tok, S) => { // 1043.1
    hot('一般的 n 呢？', 0, 6.4);
    S.a = card('φ(60) = 60 (1 − ½)(1 − ⅓)(1 − ⅕)', C.sky, 0, 5.5, 6.0);
    cap('看到特例，就想想一般的情況', '換一個 n，哪裡會不一樣？');
  },
  async (tok, S) => { // 1073.0
    sm('不一樣的只有：質因數分解（哪些質數、幾次方）', 0, 4.75);
    cap('不同的 n：質因數分解不一樣', '');
  },
  async (tok, S) => { // 1091.1
    S.g = card('φ(n) = n ∏ (1 − 1/p)，p 跑遍 n 的質因數', C.mint, 0, 3.8, 7.0); glow(S.g, OKG);
    cap('只要把質因數換掉就好', '作業：寫出一般的公式');
  },
  async (tok, S) => { // 1117.3
    glow(S.g, null);
    S.m = card('φ 滿足的性質（課本）：Σ_{d | n} φ(d) = n', C.peach, 0, 2.7, 6.6);
    sm('示意 n = 6：φ(1) + φ(2) + φ(3) + φ(6) = 1 + 1 + 2 + 2 = 6', 0, 2.0);
    cap('另一種方法：φ(n) 滿足一些式子', '');
  },
  async (tok, S) => { // 1144.0
    S.mb = card('→ Möbius inversion formula 直接解出 φ(n)', C.lilac, 0, 1.2, 6.6);
    cap('用 Möbius inversion formula 也能解', '答案一樣（這門課不講）');
  },
  async (tok, S) => { // 1186.6
    note('重點：formulation 寫對，後面只是套排容原理', 0, 0.3);
    cap('重點是 formulation', '寫出來就差不多了');
  },
]);

// ════════ ZZqiVUT8EWI（趙啟超 11C+D：onto 函數、第二類 Stirling 數） ════════
function dots(name, vals, cx, cy, color) {
  const n = vals.length, pos = {};
  const ry = Math.max(1.2, n * 0.4) * 0.95, pts = []; for (let k = 0; k <= 72; k++) { const a = (Math.PI * 2 * k) / 72; pts.push(V3(cx + 0.95 * Math.cos(a), cy + ry * Math.sin(a), 0)); }
  const r = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8a7a60' })); lab.world.add(r);
  hd(name, cx, cy + ry + 0.35);
  const el = vals.map((v, i) => { const y = cy + ((n - 1) / 2 - i) * 0.75; pos[v] = [cx, y]; return tile(v, color, cx, y, 0.5); });
  return { pos, el, r };
}
const fa = (X, u, Y, v, c = 0x6e5f49) => { const [x1, y1] = X.pos[u], [x2, y2] = Y.pos[v]; return arrow(V3(x1 + 0.35, y1, 0.3), V3(x2 - 0.35, y2, 0.3), c); };
scene('acB-funcs', '11C：X → Y 的函數、一對一、onto', [
  async (tok, S) => { // 4.0
    S.X = dots('X = {1, …, m}', ['1', '2', '⋯', 'm'], -4.6, 4.4, C.blue); S.Y = dots('Y = {1, …, n}', ['1', '2', '⋯', 'n'], -1.2, 4.4, C.orange);
    cap('|X| = m、|Y| = n', '取 X = {1..m}、Y = {1..n} 不失一般性');
  },
  async (tok, S) => { // 37.5
    S.ar = [fa(S.X, '1', S.Y, '2'), fa(S.X, '2', S.Y, '1'), fa(S.X, 'm', S.Y, '2')];
    sm('示意', -2.9, 2.0);
    cap('函數：X 的每個元素都有唯一一個對應', '');
  },
  async (tok, S) => { // 59.0
    S.c = chain(3.3, 6.3, 0.75, 5.6);
    S.c.add('所有函數：n · n ⋯ n = nᵐ');
    cap('每個 x 都有 n 種選擇，m 個 x', '乘法原理：nᵐ');
  },
  async (tok, S) => { // 89.3
    S.c.add('onto（surjective）：？', C.peach);
    cap('其中有幾個是 onto（surjective）？', '');
  },
  async (tok, S) => { // 108.0
    S.c.add('injective：n(n−1)⋯(n−m+1)', C.sky);
    cap('injective 算過：n 要 ≥ m', '第一個 n 種、第二個 n − 1 種…');
  },
  async (tok, S) => { // 132.7
    S.c.add('bijective（m = n）：n!', C.sky);
    cap('bijective：injective 而且兩邊一樣大', '排一排：n!');
  },
  async (tok, S) => { // 148.0
    S.c.add('onto(m, n) = ？', C.lilac);
    cap('現在算 onto 的個數，記作 onto(m, n)', '跟 m、n 有關');
  },
]);

scene('acB-ontosmall', '11C：先看小例子：n = 1、n = 2', [
  async (tok, S) => { // 217.5
    S.c = chain(-2.6, 6.3, 0.78, 6.4);
    hot('m 固定，n 變一變', 3.9, 6.3);
    cap('先看小的 case：m 不動，n 改一改', '');
  },
  async (tok, S) => { // 243.5
    S.c.add('n > m：onto(m, n) = 0', C.gray);
    cap('n 比 m 大：不可能每個都被對到', '最多只對到 m 個 → 0');
  },
  async (tok, S) => { // 271.3
    S.c.add('n = m：onto = 一對一 = bijective → m!', C.sky);
    cap('n = m：每個都被對到就一定一對一', '就是 bijective，m! 個');
  },
  async (tok, S) => { // 336.5
    S.c.add('n = 1：全部都對到那一個 → 1', C.sky);
    cap('n = 1：codomain 只有一個', '大家都對到它，只有 1 種');
  },
  async (tok, S) => { // 364.7
    S.c.add('n = 2：Y = {1, 2}，1 和 2 都要被對到', C.peach);
    S.X = dots('X（示意 m = 3）', ['1', '2', '3'], 2.6, 3.4, C.blue); S.Y = dots('Y', ['1', '2'], 5.4, 3.4, C.orange);
    cap('n = 2：1、2 都要被對到', '有幾種？');
  },
  async (tok, S) => { // 413.6
    S.c.add('反過來算：全部 − 不是 onto 的', C.lilac);
    cap('反過來算比較容易', '算 complement 再扣掉');
  },
  async (tok, S) => { // 435.3
    S.ar = ['1', '2', '3'].map((u) => fa(S.X, u, S.Y, '2', 0x7a1010));
    S.b1 = bad('1 沒被對到：全部 → 2', 3.9, 1.4);
    sm('另一種：全部 → 1（2 沒被對到）', 3.9, 0.8);
    cap('不是 onto：1 沒被對到 或 2 沒被對到', '兩個都沒被對到就不是函數了');
  },
  async (tok, S) => { // 476.3
    S.c.add('n = 2：2ᵐ − 2（示意 m = 3：8 − 2 = 6）', C.mint);
    cap('全部 2ᵐ 扣掉這兩種', 'onto(m, 2) = 2ᵐ − 2');
  },
  async (tok, S) => { // 541.1
    note('正著算很難，算 complement 比較好算', -2.6, 0.9);
    cap('正著算不好算 → 反過來算', '');
  },
]);

scene('acB-ontoform', '11D：formulation：Aᵢ = 沒對到 i 的函數', [
  async (tok, S) => { // 557.0
    S.n = card('不是 onto ⇔ 1 沒被對到 或 2 沒被對到 或 ⋯', C.peach, 0, 6.4, 7.0);
    cap('不是 onto：Y 裡有元素沒被對到', '1 沒對到、或 2 沒對到、或 3…');
  },
  async (tok, S) => { // 593.3
    hot('重點：formulation', 4.6, 5.6);
    cap('重點是 formulation', '');
  },
  async (tok, S) => { // 604.0
    S.d = card('Aᵢ = { f : X → Y，f 不取到值 i }', C.lilac, 0, 4.9, 6.4); glow(S.d, HL);
    cap('定義 Aᵢ：所有不會對到 i 的函數', 'do not take on the value i');
  },
  async (tok, S) => { // 631.0
    glow(S.d, null);
    sm('i = 1, …, n → 一共 n 個集合 A₁, …, Aₙ', 0, 4.25);
    cap('i 從 1 到 n，有 n 個集合', '');
  },
  async (tok, S) => { // 664.2
    S.c = chain(0, 3.5, 0.72, 7.2);
    S.c.add('onto ⇔ 1、2、⋯、n 每個都被對到');
    cap('onto：每一個都要被對到', '');
  },
  async (tok, S) => { // 673.3
    S.c.add('onto(m, n) = | A₁ᶜ ∩ A₂ᶜ ∩ ⋯ ∩ Aₙᶜ |', C.peach);
    cap('「i 被對到」= Aᵢ 的 complement', '每個都要成立 → 交集');
  },
  async (tok, S) => { // 739.4
    S.c.add('= | S | − | A₁ ∪ ⋯ ∪ Aₙ |（De Morgan）', C.sky);
    cap('De Morgan → 全部扣掉聯集', 'S = 所有 X → Y 的函數');
  },
  async (tok, S) => { // 787.0
    S.c.add('| S | = nᵐ', C.sky);
    cap('|S| 前面算過：nᵐ', '');
  },
  async (tok, S) => { // 797.4
    S.c.add('| A₁ ∪ ⋯ ∪ Aₙ | → 排容原理', C.mint);
    cap('剩下的聯集 → 套排容原理', '後面只是代公式');
  },
]);

scene('acB-ontoalpha', '11D：|Aᵢ| = (n − 1)ᵐ，αᵣ = C(n, r)(n − r)ᵐ', [
  async (tok, S) => { // 815.0
    hot('要算：單個、兩兩交集、三個交集…的 size', 0, 6.5);
    cap('排容要算一個一個、兩兩交集…的 size', '');
  },
  async (tok, S) => { // 826.2
    S.X = dots('X', ['1', '2', '⋯', 'm'], -4.8, 4.3, C.blue); S.Y = dots('Y', ['1', '2', '⋯', 'n'], -1.6, 4.3, C.orange);
    S.Y.el[0].material.color.set(C.gray); S.x1 = bad('i 不能被對到（示意）', -1.6, 1.0);
    cap('Aᵢ：i 沒有被對到', '其他的對不對到不管');
  },
  async (tok, S) => { // 856.6
    S.c = chain(3.6, 5.8, 0.8, 5.4);
    S.c.add('|Aᵢ| = (n − 1)ᵐ');
    cap('每個 x 只剩 n − 1 種可以選', '|Aᵢ| = (n − 1)ᵐ');
  },
  async (tok, S) => { // 874.5
    S.Y.el[1].material.color.set(C.gray);
    S.c.add('|Aᵢ ∩ Aⱼ| = (n − 2)ᵐ（i ≠ j）', C.peach);
    cap('i、j 都不能對到', '剩 n − 2 種 → (n − 2)ᵐ');
  },
  async (tok, S) => { // 916.3
    S.c.add('r 個交集：(n − r)ᵐ', C.lilac);
    cap('r 個都不能對到：(n − r)ᵐ', 'r = 1..n');
  },
  async (tok, S) => { // 976.4
    S.a = chain(3.0, 3.3, 0.75, 5.6);
    S.a.add('α₁ = n (n − 1)ᵐ = C(n, 1)(n − 1)ᵐ', C.mint);
    cap('α₁：n 個集合，每個 (n − 1)ᵐ', '');
  },
  async (tok, S) => { // 996.0
    S.a.add('α₂ = C(n, 2)(n − 2)ᵐ', C.mint);
    cap('α₂：C(n, 2) 個兩兩交集', '每個 (n − 2)ᵐ');
  },
  async (tok, S) => { // 1041.2
    S.a.add('αᵣ = C(n, r)(n − r)ᵐ', C.mint);
    cap('一般的 αᵣ = C(n, r)(n − r)ᵐ', '');
  },
]);

scene('acB-ontofinal', '11D：onto(m, n) = Σ (−1)ʳ C(n, r)(n − r)ᵐ', [
  async (tok, S) => { // 1085.4
    S.c = chain(0, 6.2, 0.8, 7.6);
    S.c.add('onto(m, n) = nᵐ − Σᵣ₌₁ⁿ (−1)ʳ⁻¹ αᵣ');
    cap('代回去：全部 nᵐ 扣掉排容那一串', '');
  },
  async (tok, S) => { // 1135.8
    S.c.add('= nᵐ − Σᵣ₌₁ⁿ (−1)ʳ⁻¹ C(n, r)(n − r)ᵐ', C.peach);
    cap('把 αᵣ 代進來', '');
  },
  async (tok, S) => { // 1149.0
    sm('r = 0 那一項：C(n, 0)(n − 0)ᵐ = nᵐ', 0, 3.85);
    cap('化簡：r = 0 時剛好是 nᵐ', '把它收進 Σ 裡');
  },
  async (tok, S) => { // 1166.0
    S.c.add('onto(m, n) = Σᵣ₌₀ⁿ (−1)ʳ C(n, r)(n − r)ᵐ', C.mint);
    cap('負號丟進去，範圍從 r = 0 開始', '這就是答案');
  },
  async (tok, S) => { // 1203.0
    note('要有 onto，m 要 ≥ n（m < n 時這式子算出 0）', 0, 2.9);
    cap('記得：m 要夠大，m ≥ n', '');
  },
  async (tok, S) => { // 1227.0
    S.v = card('示意 m = 3、n = 2：2³ − 2·1³ + 0 = 6 = 2³ − 2 ✓', C.sky, 0, 1.9, 7.4);
    cap('拿小例子驗算一下', '跟剛才 n = 2 的 2ᵐ − 2 一樣');
  },
]);

const BOXX = { A: 1.6, B: 4.6 };
scene('acB-ontobox', '11D：onto ↔ 不同的球放進有編號的盒子', [
  async (tok, S) => { // 1260.6
    S.t = card('onto(m, n)：domain size m，codomain size n', C.lilac, 0, 6.4, 6.6);
    cap('onto(m, n)：m 個 element 對到 n 個', 'm 要大一點');
  },
  async (tok, S) => { // 1305.4
    S.d = card('= 把 m 個不同物品放進 n 個有編號的容器，不能空', C.mint, 0, 5.6, 7.4); glow(S.d, OKG);
    cap('跟這個數目一樣：', 'distribute m distinct objects into n numbered containers');
  },
  async (tok, S) => { // 1325.0
    glow(S.d, null);
    S.balls = ['1', '2', '3'].map((t, i) => tile(t, C.blue, -5.4 + i * 0.9, 4.2, 0.6));
    S.bx = ['A', 'B'].map((k) => { const m = cube('', C.sand, [2.4, 0.3, 1.0], BOXX[k], 2.3, 0, 0); hd('盒 ' + k, BOXX[k], 1.75); return m; });
    sm('示意 m = 3、n = 2', -4.5, 3.4);
    cap('物品看得出不一樣；容器有編號', '除了編號以外看起來都一樣');
  },
  async (tok, S) => { // 1364.2
    note('條件：每個容器都不能空', 3.1, 0.9);
    cap('條件：不能有空的容器', '');
  },
  async (tok, S) => { // 1394.0
    S.X = dots('X', ['1', '2', '3'], -5.0, 1.6, C.blue); S.Y = dots('Y', ['a', 'b'], -2.4, 1.6, C.orange);
    S.ar = [fa(S.X, '1', S.Y, 'a'), fa(S.X, '2', S.Y, 'a'), fa(S.X, '3', S.Y, 'b')];
    cap('m = 3、n = 2 的一個 onto function', '1、2 → a，3 → b');
  },
  async (tok, S) => { // 1413.2
    await moveAll(tok, [[S.balls[0], BOXX.A - 0.5, 2.8], [S.balls[1], BOXX.A + 0.5, 2.8], [S.balls[2], BOXX.B, 2.8]], 1000, 1.0);
    cap('對應：1、2 放進盒 A，3 放進盒 B', '');
  },
  async (tok, S) => { // 1429.1
    good('每個都被對到 ⇔ 沒有空盒子 → 一一對應', 0, 6.4 - 1.6 - 0.1);
    cap('這是 one-to-one correspondence', '所以兩個數目一樣');
  },
]);

scene('acB-stirling', '11D：第二類 Stirling 數 S(m, n) = onto(m, n) / n!', [
  async (tok, S) => { // 1493.1
    S.s = card('S(m, n)：Stirling number of the second kind', C.lilac, 0, 6.4, 6.8); glow(S.s, HL);
    cap('這個數叫 S(m, n)', 'Stirling number of the second kind');
  },
  async (tok, S) => { // 1514.7
    glow(S.s, null);
    sm('小寫 s(m, n)：Stirling number of the first kind', 0, 5.75);
    cap('小寫 s(m, n) 是 first kind', '大寫 S 是 second kind');
  },
  async (tok, S) => { // 1539.2
    [['{ m n }：第二類 Stirling', -4.2], ['( m n )：binomial', 0], ['[ m n ]：第一類（差正負號）', 4.2]].forEach(([t, x]) => card(t, C.sky, x, 5.0, 3.9));
    cap('符號：大括號是第二類 Stirling', '小括號是 binomial，中括號跟第一類有關');
  },
  async (tok, S) => { // 1588.0
    S.d = card('m 個不同物品 → n 個「一樣的」容器，不能空', C.mint, 0, 4.1, 7.0); glow(S.d, OKG);
    cap('S(m, n)：放進 n 個 identical containers', '一樣不能有空的');
  },
  async (tok, S) => { // 1616.4
    glow(S.d, null);
    S.b = ['A', 'B'].map((k, i) => { const x = i ? 2.0 : -2.0; const m = cube('', C.sand, [2.4, 0.3, 1.0], x, 2.9, 0, 0); return [m, hd('盒 ' + k, x, 2.35)]; });
    S.in = [tile('1', C.blue, -2.45, 3.4, 0.55), tile('2', C.blue, -1.55, 3.4, 0.55), tile('3', C.blue, 2.0, 3.4, 0.55)];
    await wt(tok, 500);
    S.b.forEach(([m, l]) => kill(l));
    cap('差別：把容器上的編號撕掉', '');
  },
  async (tok, S) => { // 1633.5
    await moveAll(tok, [[S.b[0][0], 2.0, 2.9], [S.b[1][0], -2.0, 2.9], [S.in[0], 1.55, 3.4], [S.in[1], 2.45, 3.4], [S.in[2], -2.0, 3.4]], 1000, 0.8);
    S.sw = sm('{1, 2}{3} 和 {3}{1, 2}：只算一種', 0, 1.85);
    cap('盒子交換位置，看起來一樣', '只看怎麼分，不管在哪個盒子');
  },
  async (tok, S) => { // 1668.0
    S.f = card('n 個容器的 n! 種排法只算一種 → S(m, n) = onto(m, n) / n!', C.peach, 0, 1.2, 7.6); glow(S.f, HL);
    cap('容器排一排 n! 種，都只算一種', '所以除以 n!');
  },
  async (tok, S) => { // 1710.5
    glow(S.f, null);
    S.g = card('S(m, n) = (1 / n!) Σᵣ₌₀ⁿ (−1)ʳ C(n, r)(n − r)ᵐ', C.mint, 0, 0.45, 7.6); glow(S.g, OKG);
    cap('把 onto 的公式代進來', '');
  },
  async (tok, S) => { // 1737.0
    glow(S.g, null);
    gone(S.b.map((b) => b[0]), S.in, S.sw);
    good('示意：S(3, 2) = 6 / 2! = 3：{1,2}{3}、{1,3}{2}、{2,3}{1}', 0, 2.9);
    cap('onto 的個數再除以 n!', '排容原理的例子就到這裡');
  },
]);
  }

  // ═══ acC.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 6 章（清大 趙啟超 第14A–14D、15A–15D講 Generating Functions）— cued scenes ───
// 生成函數的定義與 formal power series、formal derivative、convolution ↔ 相乘、
// extended binomial theorem、用生成函數解 recurrence（Fibonacci、non-homogeneous、三階）、
// 用生成函數計數（a + b = n、z₁ + ⋯ + z_m = n 加上下限）。
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播。
// 老師的例子（數字、順序）照用；老師沒給數字、為了看清楚而加的例子在台上標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const C = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#c08a1f', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8', rose: '#f6d0dc', lemon: '#f7ecb5' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const ww = (t) => Math.min(12.6, Math.max(1.4, [...String(t)].length * 0.19 + 0.9));
const card = (t, c, x, y, w, h = 0.55) => cube(t, c, [w || ww(t), h, 0.8], x, y, 0, 1.0);
const tile = (t, c, x, y, s = 0.78) => cube(t, c, [s, s, 0.5], x, y, 0, 0);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); kill(o); });
const relab = (m, t) => { if (m && m.userData.lbl) txt(m.userData.lbl, String(t)); };
const lit = (m, c = HL) => { if (m && m.material) glow(m, c); };
const dark = (...ms) => ms.flat().forEach((m) => { if (m && m.material) glow(m, null); });
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.6, 15.5], [0, 3.2, 0]];
// 一行一行的推導：新的一行發亮，舊的變暗
function chain(x, yTop, dy = 0.72) {
  const ls = [];
  return {
    ls,
    add(e, c, w) { ls.forEach((m) => glow(m, null)); const m = card(e, c || C.sky, x, yTop - ls.length * dy, w); glow(m, HL); ls.push(m); return m; },
    clear() { gone(ls); ls.length = 0; },
  };
}
// 幾個東西一起移動（帶一點弧度）
async function moveAll(tok, list, ms = 800, arc = 0.4) {
  const from = list.map(([o]) => o.position.clone());
  await anim(tok, ms, (u) => list.forEach(([o, x, y], i) => { o.position.x = from[i].x + (x - from[i].x) * u; o.position.y = from[i].y + (y - from[i].y) * u + Math.sin(Math.PI * u) * arc; }));
}
// 一排係數格子：上面是係數方塊，下面是 xᵏ 標籤
function slotRow(heads, x0, dx, y) { return heads.map((h, i) => sm(h, x0 + i * dx, y)); }
const XP = ['x⁰', 'x¹', 'x²', 'x³', 'x⁴', 'x⁵', 'x⁶', 'x⁷', 'x⁸', 'x⁹'];

// ════════ TTSM0M9qlfA（趙啟超 14A：定義、formal power series、λⁿ、formal derivative） ════════
scene('acC-gf-def', '14A：generating function 的定義', [
  async (tok, S) => { // 4.4
    S.t = card('generating function（生成函數）', C.lilac, 0, 6.3); glow(S.t, HL);
    cap('今天開始：generating function', '');
  },
  async (tok, S) => { // 6.6
    glow(S.t, null);
    const names = ['a₀', 'a₁', 'a₂', 'a₃', '⋯', 'aₙ', '⋯'];
    S.a = names.map((t, i) => tile(t, t === '⋯' ? C.gray : C.peach, -4.5 + i * 1.5, 4.9));
    S.sq = hd('一個 sequence：a₀, a₁, a₂, …（可能無窮下去）', 0, 5.7);
    cap('先有一個 sequence', 'general term 是 aₙ');
  },
  async (tok, S) => { // 42.5
    S.h = slotRow(['常數項', 'x 一次', 'x²', 'x³', '', 'xⁿ', ''], -4.5, 1.5, 2.6);
    await moveAll(tok, S.a.slice(0, 3).map((m, i) => [m, -4.5 + i * 1.5, 3.3]), 900, 0.5);
    cap('a₀ 放常數項、a₁ 放 x 項、a₂ 放 x² 項', '');
  },
  async (tok, S) => { // 51.7
    await moveAll(tok, S.a.slice(3).map((m, i) => [m, -4.5 + (i + 3) * 1.5, 3.3]), 800, 0.5);
    S.A = card('A(x) = a₀ + a₁x + a₂x² + ⋯ + aₙxⁿ + ⋯', C.sky, 0, 1.5); glow(S.A, HL);
    cap('aₙ 放在 xⁿ 前面當係數，全部加起來', '');
  },
  async (tok, S) => { // 66.5
    glow(S.A, null);
    S.sig = card('A(x) = Σₙ₌₀^∞ aₙ xⁿ', C.mint, 0, 0.6); glow(S.sig, OKG);
    cap('寫成 summation：n 從 0 開始', '');
  },
  async (tok, S) => { // 82.6
    glow(S.sig, null);
    lit(S.a[5]); S.q = hot('要 aₙ？看 xⁿ 前面的係數', 3.0, 0.6 - 0.9);
    cap('給你 A(x)，就知道整個 sequence', '取 xⁿ 的係數就是 aₙ');
  },
  async (tok, S) => { // 102.6
    dark(S.a);
    S.a.forEach((m) => { if (m.userData.lbl && m.userData.lbl.element.textContent !== '⋯') glow(m, OKG); });
    good('A(x)「生出」整個數列 → generating function', 0, -1.2);
    cap('它 generate 這個 sequence', '所以叫 generating function');
  },
]);

scene('acC-gf-formal', '14A：formal power series（不管收斂）', [
  async (tok, S) => { // 127.4
    S.A = card('A(x) = Σ aₙ xⁿ  是一個 formal power series', C.sky, 0, 6.2); glow(S.A, HL);
    cap('A(x) 是 formal power series', '');
  },
  async (tok, S) => { // 137.4
    glow(S.A, null);
    S.f = card('formal = having the appearance without the substance', C.lilac, 0, 5.2); glow(S.f, HL);
    S.ap = card('appearance 外表', C.mint, -2.6, 4.2, 3.4); S.su = card('substance 實質', C.rose, 2.6, 4.2, 3.4);
    cap('formal：有外表，沒有實質', '');
  },
  async (tok, S) => { // 167.0
    glow(S.f, null); glow(S.ap, OKG); glow(S.su, NG);
    sm('看起來跟 power series 一樣', -2.6, 3.4); sm('但沒有 power series 的實質', 2.6, 3.4);
    cap('樣子像 power series', '但不談那些實質的東西');
  },
  async (tok, S) => { // 181.2
    S.x1 = card('示意：x = 0.5 收斂？', C.gray, -3, 2.3, 3.6); S.x2 = card('示意：x = 2 發散？', C.gray, 3, 2.3, 3.6);
    S.no = bad('都不管！不談 convergence', 0, 1.5);
    cap('不管 x 代多少收不收斂', 'convergence 的 issue 都不管');
  },
  async (tok, S) => { // 194.7
    gone(S.x1, S.x2); remove(S.no);
    const ts = ['a₀', 'a₁', 'a₂', 'a₃'].map((t, i) => tile(t, C.peach, -3 + i * 2, 2.6));
    slotRow(['x⁰', 'x¹', 'x²', 'x³'], -3, 2, 1.8);
    ts.forEach((m) => glow(m, HL));
    cap('只是把 a₀、a₁、a₂… 寫在各次項上', '就這樣而已');
  },
  async (tok, S) => { // 243.2
    note('文 ＝ appearance（外表）　質 ＝ substance（實質）', 0, 0.8);
    sm('《論語》：文質彬彬，然後君子', 0, 0.2);
    cap('中文：文是外表，質是內在', 'formal 就是「只有文」');
  },
]);

scene('acC-gf-z', '14A：跟 Z 轉換很像', [
  async (tok, S) => { // 302.4
    S.g = card('生成函數：Σ aₙ xⁿ', C.sky, -3.2, 5.2, 4.6); S.z = card('Z 轉換：Σ aₙ z⁻ⁿ', C.peach, 3.2, 5.2, 4.6);
    glow(S.z, HL);
    cap('電機系學過的 Z 轉換', '');
  },
  async (tok, S) => { // 321.3
    glow(S.g, HL); glow(S.z, HL);
    hd('xⁿ  ⟷  z⁻ⁿ', 0, 4.2);
    cap('兩個定義很像', '數學上習慣用 xⁿ，不用 z⁻¹');
  },
  async (tok, S) => { // 329.3
    dark(S.g, S.z);
    bad('Z 轉換會談 region of convergence', 3.2, 3.3); good('這裡收斂都不管', -3.2, 3.3);
    cap('Z 轉換要討論收斂區域', '這邊都不管');
  },
  async (tok, S) => { // 340.2
    S.k = card('後面算生成函數 ≈ 算 Z 轉換', C.mint, 0, 2.2); glow(S.k, OKG);
    cap('算法很類似', '學過 Z 轉換就像已經算過一次');
  },
]);

scene('acC-gf-binom', '14A：aₙ = C(m, n) → (1 + x)ᵐ', [
  async (tok, S) => { // 369.3
    S.d = card('aₙ = C(m, n)　（binomial coefficient）', C.sky, 0, 6.2); glow(S.d, HL);
    note('示意 m = 4', -5.6, 5.3);
    const v = [1, 4, 6, 4, 1, 0, 0, 0];
    S.t = v.map((x, i) => tile(x, i <= 4 ? C.peach : C.peach, -4.9 + i * 1.4, 4.6));
    slotRow(['n=0', '1', '2', '3', '4', '5', '6', '7'], -4.9, 1.4, 3.85);
    cap('第一個例子：aₙ = C(m, n)', '');
  },
  async (tok, S) => { // 382.7
    glow(S.d, null);
    S.t.slice(5).forEach((m) => { tint(m, C.gray); glow(m, NG); });
    bad('n > m：下面比上面大 → 自動是 0', 2.8, 3.1);
    cap('n 大於 m 以後都是 0', '不是 0 的只有 n = 0 … m');
  },
  async (tok, S) => { // 400.1
    S.L = chain(0, 2.3);
    S.L.add('A(x) = Σₙ C(m, n) xⁿ');
    cap('算它的生成函數', '');
  },
  async (tok, S) => { // 407.1
    S.L.add('後面都是 0 → 只加到 n = m：Σₙ₌₀ᵐ C(m, n) xⁿ');
    cap('n 只要加到 m', '');
  },
  async (tok, S) => { // 426.7
    const m = S.L.add('= (1 + x)ᵐ　← binomial theorem', C.mint); glow(m, OKG);
    sm('示意：(1 + x)⁴ = 1 + 4x + 6x² + 4x³ + x⁴', 0, 0.2);
    cap('就是 (1 + x)ᵐ', 'binomial theorem，要懂它怎麼來');
  },
  async (tok, S) => { // 461.4
    S.t.slice(0, 5).forEach((m) => glow(m, OKG));
    hot('反過來：給 (1 + x)ᵐ → 展開就知道 aₙ', 0, -0.5);
    cap('反過來給你 (1 + x)ᵐ', '用 binomial theorem 展開就知道 aₙ');
  },
]);

scene('acC-gf-geo', '14A：aₙ = λⁿ → 1/(1 − λx)', [
  async (tok, S) => { // 486.1
    S.t = ['1', 'λ', 'λ²', 'λ³', 'λ⁴', '⋯'].map((t, i) => tile(t, t === '⋯' ? C.gray : C.peach, -4 + i * 1.6, 6.1));
    sm('aₙ = λⁿ：geometric（等比）數列', 0, 5.4);
    cap('再來：aₙ = λⁿ', '等比數列');
  },
  async (tok, S) => { // 499.1
    S.L = chain(0, 4.5);
    S.L.add('A(x) = Σ λⁿxⁿ = 1 + λx + (λx)² + (λx)³ + ⋯');
    cap('代進定義', '每一項是 (λx)ⁿ');
  },
  async (tok, S) => { // 519.5
    const m = S.L.add('= 1 / (1 − λx)', C.mint); glow(m, OKG);
    cap('答案是 1/(1 − λx)', '');
  },
  async (tok, S) => { // 536.7
    note('看成等比級數的和：首項 1、公比 λx', 3.3, 3.25);
    cap('怎麼看？等比級數的和', '首項 ÷ (1 − 公比)');
  },
  async (tok, S) => { // 554.7
    S.L.add('另一算法：A(x) − 1 = λx + (λx)² + ⋯ = λx · A(x)', C.lilac);
    cap('或者：把 1 移到左邊', '右邊提出 λx，裡面還是 A(x)');
  },
  async (tok, S) => { // 604.8
    const m = S.L.add('(1 − λx)·A(x) = 1  ⇒  A(x) = 1/(1 − λx)', C.mint); glow(m, OKG);
    cap('A(x) 放同一邊', '一樣得到 1/(1 − λx)');
  },
  async (tok, S) => { // 623.3
    S.L.clear();
    S.e = card('(1 − λx) · (1 + λx + λ²x² + λ³x³ + ⋯)  =  1 ?', C.sky, 0, 4.5); glow(S.e, HL);
    cap('等號是什麼意思？', '乘過去，每個係數都相等');
  },
  async (tok, S) => { // 649.1
    glow(S.e, null);
    const hs = ['常數', 'x', 'x²', 'x³', 'x⁴'], v = ['1', 'λ − λ', 'λ² − λ²', 'λ³ − λ³', '⋯'];
    S.c = v.map((t, i) => card(t, C.peach, -4.4 + i * 2.2, 3.2, 1.9));
    slotRow(hs, -4.4, 2.2, 2.45);
    await wt(tok, 900);
    S.c.slice(1, 4).forEach((m) => { relab(m, '0'); tint(m, C.gray); });
    glow(S.c[0], OKG);
    cap('常數項 1，一次項 0，二次項 0 …', '只剩下 1 ✓');
  },
  async (tok, S) => { // 695.0
    hot('反過來：看到 1/(1 − λx) → aₙ = λⁿ', 0, 1.4);
    cap('反過來也要會', '看到 1/(1 − λx)，aₙ 就是 λⁿ');
  },
  async (tok, S) => { // 713.0
    const m = card('λⁿ  ⟷  1/(1 − λx)', C.lemon, 0, 0.4, 5.2); glow(m, HL);
    cap('記成一對', '兩個方向後面都會用');
  },
]);

scene('acC-gf-fderiv', '14A：formal derivative', [
  async (tok, S) => { // 747.4
    S.t = card('新工具：formal derivative', C.lilac, 0, 6.3); glow(S.t, HL);
    cap('再多一個工具', '後面算起來比較方便');
  },
  async (tok, S) => { // 760.0
    glow(S.t, null);
    S.A = card('A(x) = Σₙ≥₀ aₙ xⁿ', C.sky, -3.2, 5.3, 4.8);
    S.D = card('A′(x) = Σₙ≥₁ n·aₙ xⁿ⁻¹', C.mint, 3.2, 5.3, 4.8); glow(S.D, OKG);
    cap('A(x) 的 formal derivative', '它不是 derivative，是 formal derivative');
  },
  async (tok, S) => { // 793.0
    glow(S.D, null);
    S.r = ['a₀', 'a₁x', 'a₂x²', 'a₃x³', 'a₄x⁴'].map((t, i) => card(t, C.peach, -4.4 + i * 2.2, 3.9, 1.9));
    sm('A(x)', -6.2, 3.9);
    cap('定義跟以前「每一項微下來」一樣', '');
  },
  async (tok, S) => { // 811.3
    const d = ['', 'a₁', '2a₂x', '3a₃x²', '4a₄x³'];
    tint(S.r[0], C.gray); glow(S.r[0], NG);
    await moveAll(tok, S.r.slice(1).map((m, i) => [m, -4.4 + i * 2.2, 2.6]), 900, 0.5);
    S.r.slice(1).forEach((m, i) => { relab(m, d[i + 1]); glow(m, OKG); });
    sm("A′(x)", -6.2, 2.6);
    hd('常數項沒了；n 掉到前面；x 的次數少 1', 0, 1.8);
    cap('常數項不見，n 乘到前面', 'x 的次數少一個');
  },
  async (tok, S) => { // 827.6
    S.lim = card("微積分：f′(x) = lim_{h→0} [f(x + h) − f(x)] / h", C.rose, 0, 0.9); glow(S.lim, NG);
    cap('原本的微分是極限定義', '');
  },
  async (tok, S) => { // 850.0
    bad('formal derivative：根本沒有極限', 0, 0.1);
    good('aₙ 可以是 discrete 的東西 — 只有微分的「樣子」', 0, -0.6);
    cap('這裡完全沒有極限', '有微分的樣子、沒有微分的實質');
  },
]);

scene('acC-gf-rules', '14A：微分規則照樣成立', [
  async (tok, S) => { // 901.6
    S.t = card('有微分的樣子 → 常用的微分 rule 還是成立', C.lilac, 0, 6.2); glow(S.t, HL);
    S.L = chain(0, 4.9, 0.9);
    cap('以前微分常用的 rule', 'formal derivative 也照樣成立');
  },
  async (tok, S) => { // 924.4
    glow(S.t, null);
    S.L.add('(f + g)′ = f′ + g′', C.sky, 6);
    cap('加起來取 formal derivative', '= 個別取再加起來');
  },
  async (tok, S) => { // 946.6
    S.L.add('(f · g)′ = f′g + f g′', C.sky, 6);
    cap('乘在一起：一個微、一個不微', '');
  },
  async (tok, S) => { // 976.4
    S.L.add('(f / g)′ = (f′g − f g′) / g²', C.sky, 6);
    cap('分式也一樣', '');
  },
  async (tok, S) => { // 1018.2
    S.L.ls.forEach((m) => glow(m, OKG));
    good('代定義兩邊比一比 → 一樣；工具又多了', 0, 1.6);
    cap('兩邊代進去比，發現一樣', '多了這些工具，後面比較好算');
  },
]);

// ════════ zyiBuJs8gm4（趙啟超 14B：n·λⁿ、n·aₙ ↔ x·A′(x)、convolution ↔ 相乘） ════════
scene('acC-gf-nlam', '14B：aₙ = n·λⁿ 用 formal derivative', [
  async (tok, S) => { // 4.3
    S.q = card('aₙ = n · λⁿ　的生成函數 = ？', C.lilac, 0, 6.3); glow(S.q, HL);
    cap('要算 aₙ = n·λⁿ 的生成函數', '');
  },
  async (tok, S) => { // 8.5
    glow(S.q, null);
    S.k = card('已知：λⁿ ⟷ 1/(1 − λx)', C.mint, 0, 5.5, 5.4);
    cap('剛才算過 λⁿ 的生成函數', '');
  },
  async (tok, S) => { // 24.4
    const v = ['0', 'λx', '2λ²x²', '3λ³x³', '4λ⁴x⁴', '⋯'];
    S.A = v.map((t, i) => card(t, C.peach, -4.5 + i * 1.8, 4.3, 1.6));
    sm('A(x) =', -6.3, 4.3);
    cap('A(x) = 0 + λx + 2λ²x² + 3λ³x³ + ⋯', 'n = 0 那項是 0');
  },
  async (tok, S) => { // 52.4
    [2, 3, 4].forEach((i) => lit(S.A[i]));
    hot('前面多出 2、3、4 → 微下來才會多', 0, 3.5);
    cap('什麼時候前面會多一個 2、3？', '微分的時候 → 跟 formal derivative 有關');
  },
  async (tok, S) => { // 93.3
    dark(S.A);
    const v = ['1', 'λx', 'λ²x²', 'λ³x³', 'λ⁴x⁴', '⋯'];
    S.B = v.map((t, i) => card(t, C.sky, -4.5 + i * 1.8, 2.6, 1.6));
    sm('B(x) =', -6.3, 2.6); sm('= 1/(1 − λx)', 5.4, 1.95);
    cap('令 B(x) = Σ λⁿxⁿ = 1/(1 − λx)', '這個已經知道');
  },
  async (tok, S) => { // 120.8
    const d = ['', 'λ', '2λ²x', '3λ³x²', '4λ⁴x³', '⋯'];
    tint(S.B[0], C.gray);
    S.B.forEach((m, i) => { if (i) { relab(m, d[i]); glow(m, HL); } });
    sm('B′(x) =', -6.3, 1.95);
    cap('對 B(x) 取 formal derivative', 'B′(x) = λ + 2λ²x + 3λ³x² + ⋯');
  },
  async (tok, S) => { // 148.2
    dark(S.B);
    for (let i = 1; i <= 4; i++) { lit(S.A[i]); lit(S.B[i]); }
    hd('B′ 的每一項 × x → 就是 A 的每一項', 0, 1.0);
    cap('B′(x) 跟 A(x) 比', '每一項差一個 x');
  },
  async (tok, S) => { // 214.3
    dark(S.A, S.B);
    S.r = card('A(x) = x · B′(x)', C.mint, 0, 0.1, 4.6); glow(S.r, OKG);
    cap('所以 A(x) = x · B′(x)', '要算的跟知道的扯上關係');
  },
  async (tok, S) => { // 251.2
    glow(S.r, null);
    S.d = card('B′(x) = [ (1 − λx)⁻¹ ]′ = λ/(1 − λx)²', C.sky, 0, -0.65); glow(S.d, HL);
    cap('B′ 用以前的微分算法', '平方、負號、再乘 −λ → λ/(1 − λx)²');
  },
  async (tok, S) => { // 303.9
    glow(S.d, null);
    gone(S.k);
    S.ans = card('n·λⁿ  ⟷  λx/(1 − λx)²', C.lemon, 0, 5.5, 5.6); glow(S.ans, OKG);
    cap('A(x) = λx/(1 − λx)²', '');
  },
  async (tok, S) => { // 317.8
    good('橋樑：formal derivative', 0, 6.95);
    cap('中間的橋樑就是 formal derivative', '取完再代回來，答案就出來');
  },
]);

scene('acC-gf-nrule', '14B：推廣 n·aₙ ⟷ x·A′(x)', [
  async (tok, S) => { // 374.1
    S.c = card('剛才的推導：λx + 2λ²x² + 3λ³x³ + ⋯', C.sky, 0, 6.2); glow(S.c, HL);
    cap('其實不一定要是 λⁿ', '');
  },
  async (tok, S) => { // 397.9
    hot('把 λⁿ 圈起來：過程裡它根本沒被動到', 0, 5.4);
    cap('每個 λⁿ 圈起來看', '只是把 2、3、n 掉下來而已');
  },
  async (tok, S) => { // 416.0
    glow(S.c, null);
    S.a = card('假設已知：aₙ ⟷ A(x)', C.mint, -3.3, 4.4, 4.8);
    cap('假設 aₙ 的生成函數 A(x) 已經知道', '');
  },
  async (tok, S) => { // 444.4
    S.b = card('n·aₙ ⟷ x · A′(x)', C.lemon, 3.3, 4.4, 4.8); glow(S.b, OKG);
    arrow(V3(-0.8, 4.4, 0), V3(0.8, 4.4, 0));
    cap('每一項乘 n：n·aₙ ⟷ x·A′(x)', '只是這樣而已');
  },
  async (tok, S) => { // 500.4
    glow(S.b, null);
    const r1 = ['a₁', '2a₂x', '3a₃x²', '4a₄x³'], r2 = ['a₁x', '2a₂x²', '3a₃x³', '4a₄x⁴'];
    S.r = r1.map((t, i) => card(t, C.sky, -3.3 + i * 2.2, 2.9, 1.9));
    sm('A′(x) =', -5.4, 2.9);
    await wt(tok, 700);
    await moveAll(tok, S.r.map((m, i) => [m, -3.3 + i * 2.2, 1.7]), 800, 0.4);
    S.r.forEach((m, i) => { relab(m, r2[i]); glow(m, OKG); });
    sm('x·A′(x) =', -5.4, 1.7);
    slotRow(['1·a₁', '2·a₂', '3·a₃', '4·a₄'], -3.3, 2.2, 0.95);
    cap('寫出來、乘上 x', 'xⁿ 的係數正好是 n·aₙ ✓');
  },
  async (tok, S) => { // 534.1
    note('學過 Z 轉換的話，這些都很類似', 0, 0.1);
    cap('跟 Z 轉換的性質類似', '');
  },
]);

scene('acC-gf-conv-def', '14B：convolution cₙ = Σ aₖbₙ₋ₖ', [
  async (tok, S) => { // 554.5
    S.s = ['aₙ', 'bₙ', 'cₙ'].map((t, i) => card(t, [C.sky, C.peach, C.mint][i], -3 + i * 3, 6.2, 1.6));
    cap('三個 sequence：aₙ、bₙ、cₙ', '');
  },
  async (tok, S) => { // 577.4
    S.e = card('cₙ = a₀bₙ + a₁bₙ₋₁ + ⋯ + aₙb₀', C.mint, 0, 5.1); glow(S.e, HL);
    cap('cₙ 跟 aₙ、bₙ 的關係', '');
  },
  async (tok, S) => { // 596.4
    glow(S.e, null);
    S.f = card('cₙ = Σₖ₌₀ⁿ aₖ bₙ₋ₖ', C.lemon, 0, 4.2, 5); glow(S.f, HL);
    cap('寫成 summation', '兩個下標 k 和 n − k');
  },
  async (tok, S) => { // 607.4
    glow(S.f, null);
    note('示意 n = 3', -5.6, 3.4);
    const sub = '₀₁₂₃';
    S.p = [0, 1, 2, 3].map((k) => {
      const a = tile('a' + sub[k], C.sky, -4.2 + k * 2.6, 2.6, 0.7), b = tile('b' + sub[3 - k], C.peach, -3.4 + k * 2.6, 2.6, 0.7);
      sm(k + ' + ' + (3 - k) + ' = 3', -3.8 + k * 2.6, 1.85); return [a, b];
    });
    cap('下標加起來都是 n', 'a 的下標慢慢變大，b 的慢慢變小');
  },
  async (tok, S) => { // 646.5
    S.n = card('這叫 aₙ 和 bₙ 的 convolution（摺積）', C.lilac, 0, 0.9); glow(S.n, HL);
    cap('這叫 convolution', '重點：下標的和固定是 n');
  },
  async (tok, S) => { // 704.1
    glow(S.n, null);
    S.q = hot('已知 aₙ ⟷ A(x)、bₙ ⟷ B(x)，cₙ 的 C(x) = ？', 0, 0.0);
    cap('問題：C(x) 是多少？', '');
  },
  async (tok, S) => { // 757.5
    note('提示：Z 轉換裡，convolution ↔ 兩個轉換相乘', 0, -0.7);
    cap('學過 Z 轉換的會知道', 'convolution 會變成相乘');
  },
]);

const NK = (n, k) => [-6.3 + n * 0.55, -0.2 + k * 0.55];
scene('acC-gf-conv-proof', '14B：交換 double summation 的證明', [
  async (tok, S) => { // 770.2
    S.L = chain(0, 6.4, 0.7);
    S.L.add('C(x) = Σₙ≥₀ cₙxⁿ = Σₙ≥₀ Σₖ₌₀ⁿ aₖ bₙ₋ₖ xⁿ');
    cap('把 convolution 的定義代進來', '');
  },
  async (tok, S) => { // 841.3
    S.h1 = hd('先描述 n（n ≥ 0），給了 n 再描述 k（0 ≤ k ≤ n）', 0, 4.95);
    cap('double summation', '先 n，再 k');
  },
  async (tok, S) => { // 857.0
    S.h2 = note('碰到 double summation／double integral：試著把順序反過來', 0, 4.4);
    cap('要推導通常怎麼辦？', '把兩個 summation 反過來');
  },
  async (tok, S) => { // 886.0
    S.w = bad('n 和 k 有關係 → 範圍要重新描述', 3.6, 3.4);
    cap('兩個範圍有關', '反過來時範圍要重寫');
  },
  async (tok, S) => { // 922.6
    S.pt = [];
    for (let n = 0; n <= 5; n++) for (let k = 0; k <= n; k++) { const [x, y] = NK(n, k); const m = tile('', C.gray, x, y, 0.22); m.userData.nk = [n, k]; S.pt.push(m); }
    sm('n →', -2.6, -0.2); sm('k ↑', -6.3, 3.1);
    cap('畫 (n, k) 平面', 'n = 0, 1, 2, 3, …（離散的點）');
  },
  async (tok, S) => { // 949.5
    for (let n = 0; n <= 2; n++) { S.pt.filter((m) => m.userData.nk[0] === n).forEach((m) => { tint(m, C.blue); glow(m, HL); }); await wt(tok, 500); }
    cap('n = 0：k 只有 0；n = 1：k = 0, 1', 'n = 2：k = 0, 1, 2');
  },
  async (tok, S) => { // 965.4
    S.pt.forEach((m) => { tint(m, C.blue); glow(m, null); });
    const [x0, y0] = NK(0, 0), [x1, y1] = NK(5.4, 5.4);
    arrow(V3(x0, y0, 0), V3(x1, y1, 0), 0xc08a1f);
    sm('n = k 這條 45° 線（含線上）下方的點', -3.4, 3.6);
    cap('整個區域：n = k 線和它下方的點', '');
  },
  async (tok, S) => { // 988.7
    remove(S.w);
    good('反過來：先描述 k（k ≥ 0）', 3.6, 3.4);
    cap('反過來，先描述 k', 'k 可以是 0, 1, 2, …');
  },
  async (tok, S) => { // 1010.0
    S.pt.filter((m) => m.userData.nk[1] === 2).forEach((m) => { tint(m, C.orange); glow(m, HL); });
    good('給定 k（例：k = 2）→ n 從 k 開始：n ≥ k', 3.6, 2.7);
    cap('給定 k，n 要 ≥ k', '');
  },
  async (tok, S) => { // 1061.2
    remove(S.h1); remove(S.h2);
    S.L.add('= Σₖ≥₀ Σₙ≥ₖ aₖ bₙ₋ₖ xⁿ', C.lilac);
    cap('改寫：k ≥ 0，n ≥ k', '');
  },
  async (tok, S) => { // 1087.4
    S.L.add('= Σₖ≥₀ aₖxᵏ · Σₙ≥ₖ bₙ₋ₖ xⁿ⁻ᵏ', C.lilac);
    cap('跟 n 無關的 aₖ 提出來', 'xⁿ 拆成 xᵏ · xⁿ⁻ᵏ');
  },
  async (tok, S) => { // 1128.2
    S.L.add('令 k′ = n − k ≥ 0：= Σₖ aₖxᵏ · Σₖ′≥₀ bₖ′ xᵏ′', C.lilac);
    cap('n − k 換成新變數 k′', 'n ≥ k ⇒ k′ ≥ 0');
  },
  async (tok, S) => { // 1173.2
    const m = card('= A(x) · B(x)', C.mint, 3.4, 1.6, 4); glow(m, OKG);
    cap('兩個無關 → 拆成乘積', '前面是 A(x)，後面是 B(x)');
  },
]);

scene('acC-gf-conv-sum', '14B：convolution ⟷ 生成函數相乘', [
  async (tok, S) => { // 1198.0
    S.a = card('cₙ = Σₖ aₖ bₙ₋ₖ', C.sky, -3.3, 5.0, 4.2); S.b = card('C(x) = A(x) · B(x)', C.mint, 3.3, 5.0, 4.2);
    glow(S.b, OKG);
    cap('結論', 'cₙ 是 aₙ、bₙ 的 convolution ⇒ C(x) = A(x)B(x)');
  },
  async (tok, S) => { // 1236.0
    arrow(V3(-1.0, 5.0, 0), V3(1.0, 5.0, 0));
    hd('sequence 做 convolution ⟷ 生成函數相乘', 0, 4.1);
    cap('sequence 這邊做 convolution', '生成函數那邊就是 product');
  },
  async (tok, S) => { // 1250.6
    good('新數列能寫成兩個已知數列的 convolution → 生成函數相乘就好', 0, 3.1);
    cap('又多一個工具', '');
  },
]);

// ════════ Al6ODllhdnc（趙啟超 14C：1/(1 − λx)² 兩種算法、(1 + x)⁻ⁿ 與重複組合） ════════
scene('acC-gf-recap', '14C：手上的兩個工具', [
  async (tok, S) => { // 4.4
    S.t = card('目前：給 sequence → 算生成函數', C.lilac, 0, 6.2); glow(S.t, HL);
    cap('前面都是給 sequence 算生成函數', '');
  },
  async (tok, S) => { // 5.4
    glow(S.t, null);
    S.a = card('工具 1：n·aₙ ⟷ x·A′(x)（formal derivative）', C.sky, 0, 5.0); glow(S.a, HL);
    cap('第一個工具：formal derivative', '');
  },
  async (tok, S) => { // 7.3
    glow(S.a, null);
    S.b = card('工具 2：convolution ⟷ 生成函數相乘', C.sky, 0, 4.1); glow(S.b, HL);
    cap('第二個工具：convolution ⟷ 相乘', '');
  },
  async (tok, S) => { // 9.4
    glow(S.b, null);
    S.c = card('已知：λⁿ ⟷ 1/(1 − λx)', C.mint, 0, 3.2, 5.4); glow(S.c, OKG);
    cap('還有已經算過的', 'λⁿ ⟷ 1/(1 − λx)');
  },
]);

scene('acC-gf-inv2', '14C：反方向 — 給生成函數求 sequence', [
  async (tok, S) => { // 36.9
    S.f = card('sequence  ⟶  生成函數', C.sky, -3.2, 5.6, 4.6); S.g = card('生成函數  ⟶  sequence', C.peach, 3.2, 5.6, 4.6);
    glow(S.g, HL);
    cap('兩個方向都要會', '像 Z 轉換和 inverse Z 轉換');
  },
  async (tok, S) => { // 64.3
    glow(S.g, null);
    S.q = card('1/(1 − λx)²  對應的 cₙ = ？', C.lilac, 0, 4.3, 5.8); glow(S.q, HL);
    cap('反過來：給 1/(1 − λx)²', '求原來的 sequence cₙ');
  },
  async (tok, S) => { // 76.8
    glow(S.q, null);
    hd('方法一：convolution（相乘）', -3.2, 3.2); hd('方法二：formal derivative', 3.2, 3.2);
    cap('手上有兩種方法可以用', '先看第一種');
  },
]);

scene('acC-gf-sq-conv', '14C：方法一 1/(1 − λx)² 看成相乘', [
  async (tok, S) => { // 99.8
    S.L = chain(0, 6.4, 0.7);
    S.L.add('1/(1 − λx)² = 1/(1 − λx) · 1/(1 − λx)');
    cap('拆成兩個 1/(1 − λx) 相乘', '');
  },
  async (tok, S) => { // 129.7
    S.L.add('A(x) = B(x) = 1/(1 − λx)，C(x) = A(x)·B(x)');
    cap('令 A、B 都是 1/(1 − λx)', 'C = A·B');
  },
  async (tok, S) => { // 138.3
    S.L.add('⇒ cₙ = aₙ 和 bₙ 的 convolution；aₙ = bₙ = λⁿ');
    cap('相乘 ⟷ convolution', 'aₙ、bₙ 都是 λⁿ');
  },
  async (tok, S) => { // 167.0
    S.L.add('cₙ = Σₖ₌₀ⁿ aₖ bₙ₋ₖ');
    cap('下標加起來是 n', 'k 最小 0、最大 n');
  },
  async (tok, S) => { // 208.5
    S.L.add('= Σₖ₌₀ⁿ λᵏ · λⁿ⁻ᵏ = Σₖ₌₀ⁿ λⁿ');
    note('示意 n = 3', -5.6, 3.0);
    const sp = ['λ⁰·λ³', 'λ¹·λ²', 'λ²·λ¹', 'λ³·λ⁰'];
    S.p = sp.map((t, i) => card(t, C.peach, -3.6 + i * 2.4, 2.2, 2.1));
    await wt(tok, 700);
    S.p.forEach((m) => { relab(m, 'λ³'); glow(m, HL); });
    cap('λᵏ · λⁿ⁻ᵏ = λⁿ', '每一項都一樣');
  },
  async (tok, S) => { // 267.8
    dark(S.p);
    S.L.add('λⁿ 跟 k 無關 → constant，提出來：λⁿ · Σₖ₌₀ⁿ 1', C.lilac);
    cap('λⁿ 是 constant', '跟 k 無關，提到外面');
  },
  async (tok, S) => { // 310.2
    S.p.forEach((m, i) => { relab(m, '1'); tint(m, C.mint); });
    for (let i = 0; i < 4; i++) { glow(S.p[i], OKG); sm('k = ' + i, -3.6 + i * 2.4, 1.45); await wt(tok, 350); }
    hd('k = 0, 1, …, n：一共 n + 1 個 1', 0, 0.7);
    cap('k = 0 是 1、k = 1 也是 1 …', '一共 n + 1 個 1');
  },
  async (tok, S) => { // 352.6
    const m = card('cₙ = (n + 1) λⁿ', C.lemon, 0, -0.2, 4.6); glow(m, OKG);
    cap('cₙ = (n + 1)λⁿ', '');
  },
]);

scene('acC-gf-sq-deriv', '14C：方法二 用 formal derivative', [
  async (tok, S) => { // 389.0
    S.t = card('取 formal derivative → 分母會跑出平方', C.lilac, 0, 6.3); glow(S.t, HL);
    cap('第二個方法', '1/(1 − λx) 微一次，分母就有平方');
  },
  async (tok, S) => { // 425.5
    glow(S.t, null);
    S.r = card('工具：n·aₙ ⟷ x·A′(x)', C.mint, 0, 5.5, 5); glow(S.r, OKG);
    cap('用前面的結果', 'n·aₙ ⟷ x·A′(x)');
  },
  async (tok, S) => { // 442.5
    glow(S.r, null);
    S.L = chain(0, 4.7, 0.72);
    S.L.add('aₙ = λⁿ，A(x) = 1/(1 − λx)');
    cap('aₙ = λⁿ', '');
  },
  async (tok, S) => { // 457.0
    S.L.add('n·λⁿ ⟷ x · A′(x) = λx / (1 − λx)²');
    cap('A 取 formal derivative 再乘 x', '');
  },
  async (tok, S) => { // 495.3
    S.L.add('λx/(1 − λx)² = 0 + λx + 2λ²x² + 3λ³x³ + ⋯', C.peach);
    cap('左邊的 sequence 是 n·λⁿ', '照定義寫出來');
  },
  async (tok, S) => { // 525.6
    S.L.add('= λx · (1 + 2λx + 3λ²x² + ⋯)', C.peach);
    cap('每一項都可以提出 λx', '');
  },
  async (tok, S) => { // 549.4
    const m = S.L.add('兩邊除以 λx：1/(1 − λx)² = 1 + 2λx + 3λ²x² + ⋯', C.mint); glow(m, OKG);
    cap('左右兩邊都除掉 λx', '');
  },
  async (tok, S) => { // 573.0
    hot('xⁿ 的係數：(n + 1) λⁿ', 0, 1.2);
    cap('右邊通式：xⁿ 前面是 (n + 1)λⁿ', '平方項 3λ²、一次項 2λ');
  },
  async (tok, S) => { // 647.4
    const m = card('1/(1 − λx)²  ⟷  (n + 1) λⁿ', C.lemon, 0, 0.3, 5.6); glow(m, OKG);
    good('兩種方法，同一個答案', 0, -0.5);
    cap('convolution 和 formal derivative', '都算出 (n + 1)λⁿ');
  },
]);

scene('acC-gf-next', '14C：下一步 — extended binomial theorem', [
  async (tok, S) => { // 674.4
    S.a = card('1/(1 − λx)  ⟷  λⁿ', C.mint, -3.2, 6.0, 4.6); S.b = card('1/(1 − λx)²  ⟷  (n + 1)λⁿ', C.mint, 3.2, 6.0, 4.6);
    cap('一次方、平方都算好了', '');
  },
  async (tok, S) => { // 690.6
    S.q = card('1/(1 − λx)³？ … 1/(1 − λx)ᵐ？', C.rose, 0, 5.0, 5.8); glow(S.q, NG);
    cap('下一步三次方、m 次方', '這樣一個一個算太慢');
  },
  async (tok, S) => { // 735.6
    glow(S.q, null);
    S.e = card('新工具：extended binomial theorem', C.lilac, 0, 4.0); glow(S.e, HL);
    cap('引進新的東西', 'extended binomial theorem');
  },
  async (tok, S) => { // 753.9
    glow(S.e, null);
    S.o = card('以前：(1 + x)ⁿ = Σᵣ₌₀ⁿ C(n, r) xʳ，n 是正整數', C.sky, 0, 2.9); glow(S.o, HL);
    cap('以前的 binomial theorem', 'n 是正整數');
  },
  async (tok, S) => { // 800.6
    glow(S.o, null);
    S.n = card('第一個推廣：(1 + x)⁻ⁿ　負整數次方', C.lemon, 0, 1.8); glow(S.n, OKG);
    sm('(1 + x)⁻², (1 + x)⁻³, (1 + x)⁻⁴, …', 0, 1.1);
    cap('推廣到負整數次方', '');
  },
]);

scene('acC-gf-negpow', '14C：(1 + x)⁻ⁿ 展開有無窮多項', [
  async (tok, S) => { // 836.3
    S.q = card('(1 + x)⁻ⁿ = ？（n 是正整數）', C.lilac, 0, 6.2); glow(S.q, HL);
    cap('負整數次方怎麼展開？', '先寫一個樣子');
  },
  async (tok, S) => { // 852.7
    glow(S.q, null);
    hd('正整數次方：只有 n + 1 項', -3.2, 5.3); hot('負整數次方：無窮多項', 3.2, 5.3);
    cap('這個展開有無窮多項', 'r 從 0 一直下去');
  },
  async (tok, S) => { // 868.7
    const v = ['1', '− x', '+ x²', '− x³', '+ x⁴', '⋯'];
    sm('(1 + x)⁻¹ =', -6.0, 4.2);
    S.t = [];
    for (let i = 0; i < v.length; i++) { S.t.push(card(v[i], i % 2 ? C.rose : C.mint, -4.2 + i * 1.75, 4.2, 1.5)); await wt(tok, 250); }
    cap('例：(1 + x)⁻¹ = 1 − x + x² − x³ + ⋯', '正負相間、無窮下去');
  },
  async (tok, S) => { // 897.5
    S.th = card('(1 + x)⁻ⁿ = Σᵣ≥₀ (−1)ʳ C(n + r − 1, r) xʳ', C.lemon, 0, 2.9); glow(S.th, OKG);
    cap('展開的結果', 'xʳ 係數 = (−1)ʳ C(n + r − 1, r)');
  },
  async (tok, S) => { // 916.0
    glow(S.th, null);
    hot('C(n + r − 1, r)：重複組合數！為什麼？', 0, 1.9);
    cap('C(n + r − 1, r) 是重複組合數', '看證明');
  },
]);

const PICKS = []; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) PICKS.push([i, j, 4 - i - j]);
const EX = ['1', 'x', 'x²', 'x³', 'x⁴'];
scene('acC-gf-negproof', '14C：證明 — xʳ 係數 = 可重複的選法數', [
  async (tok, S) => { // 942.0
    S.top = card('先算 (1 − x)⁻ⁿ，最後再把 x 換成 −x', C.lilac, 0, 6.35); glow(S.top, HL);
    cap('先考慮 (1 − x)⁻ⁿ', '比較好看，最後 x 用 −x 代');
  },
  async (tok, S) => { // 984.0
    glow(S.top, null);
    S.e = card('(1 − x)⁻ⁿ = (1 − x)⁻¹ · (1 − x)⁻¹ ⋯ (1 − x)⁻¹　（n 個）', C.sky, 0, 5.6); glow(S.e, HL);
    cap('n 個 (1 − x)⁻¹ 乘起來', '');
  },
  async (tok, S) => { // 998.0
    glow(S.e, null);
    relab(S.e, '(1 − x)⁻ⁿ = (1 + x + x² + ⋯)(1 + x + x² + ⋯)⋯（n 個）');
    S.cols = [-5.2, -3.7, -2.2].map((cx) => EX.map((t, i) => tile(t, C.sky, cx, 4.3 - i * 0.78, 0.66)));
    cap('(1 − x)⁻¹ = 1 + x + x² + ⋯', '就是 λ = 1 的等比級數');
  },
  async (tok, S) => { // 1045.0
    S.eq = note('兩個 formal power series 相等 = 任何有限項的係數都一樣', 2.4, 4.6);
    cap('等號的意思', '任何有限項係數都相等，不管收斂');
  },
  async (tok, S) => { // 1063.0
    S.r = card('要算 xʳ 的係數', C.lemon, 2.4, 3.6, 4.2); glow(S.r, HL);
    cap('要算 xʳ 的係數', '');
  },
  async (tok, S) => { // 1082.6
    glow(S.r, null);
    S.ex = hot('例：n = 3、r = 4', 2.4, 2.8);
    sm('(1 − x)⁻¹', -5.2, 4.95); sm('(1 − x)⁻¹', -3.7, 4.95); sm('(1 − x)⁻¹', -2.2, 4.95);
    cap('先看例子：n = 3、r = 4', '三個括號，要 x⁴');
  },
  async (tok, S) => { // 1104.7
    hd('乘開 = 每個括號隨便挑一項，乘起來', 2.4, 2.1);
    cap('什麼叫乘開？', '每個括號挑一項乘起來，所有可能加起來');
  },
  async (tok, S) => { // 1140.0
    [2, 1, 1].forEach((e, c) => { tint(S.cols[c][e], C.orange); glow(S.cols[c][e], HL); });
    S.pk = card('x² · x · x = x⁴　→ 貢獻 1', C.peach, 2.4, 1.3, 4.6); glow(S.pk, HL);
    cap('例如：x² 挑第一個、x、x', '乘起來 x⁴，貢獻係數 1');
  },
  async (tok, S) => { // 1176.6
    glow(S.pk, null);
    const reset = () => S.cols.forEach((col) => col.forEach((m) => { tint(m, C.sky); glow(m, null); }));
    S.cnt = card('指數加起來 = 4 的挑法：0 種', C.mint, 2.4, 0.5, 4.6);
    for (let p = 0; p < PICKS.length; p++) {
      reset(); PICKS[p].forEach((e, c) => { tint(S.cols[c][e], C.orange); glow(S.cols[c][e], HL); });
      relab(S.cnt, '指數加起來 = 4 的挑法：' + (p + 1) + ' 種'); await wt(tok, 150);
    }
    glow(S.cnt, OKG);
    cap('x⁴ 的係數 = 指數和是 4 的挑法數', '一共 15 種');
  },
  async (tok, S) => { // 1209.2
    gone(S.pk);
    S.kind = card('= 三種東西，可重複地拿 4 個（x² 是第一種拿 2 個）', C.lilac, 0, -0.35); glow(S.kind, HL);
    cap('這是學過的問題', '3 種東西拿 4 個，可重複');
  },
  async (tok, S) => { // 1307.4
    glow(S.kind, null);
    relab(S.kind, '(1 − x)⁻ⁿ 的 xʳ 係數 = 從 n 種東西、可重複、不計順序，選 r 個');
    cap('一般化', 'unordered selection with repetition');
  },
  async (tok, S) => { // 1390.5
    remove(S.eq); remove(S.ex); gone(S.r);
    S.bar = card('× × │ × │ ×　（r 個 ×、n − 1 根柵欄）', C.peach, 2.4, 4.3, 5.2); glow(S.bar, HL);
    S.cf = card('= C(n + r − 1, r)；例：C(6, 4) = 15 ✓', C.mint, 2.4, 3.4, 5.2); glow(S.cf, OKG);
    cap('= C(n + r − 1, r)', 'n − 1 根柵欄和 r 個 × 的排法');
  },
  async (tok, S) => { // 1457.4
    dark(S.bar, S.cf);
    S.neg = card('x 換成 −x：xʳ → (−1)ʳxʳ ⇒ (1 + x)⁻ⁿ 的係數 (−1)ʳ C(n + r − 1, r)', C.lemon, 0, -1.1); glow(S.neg, OKG);
    cap('我們要的是 (1 + x)⁻ⁿ', 'x 用 −x 代，多一個 (−1)ʳ，證完');
  },
  async (tok, S) => { // 1526.7
    good('關鍵：「乘開」就是每個括號挑一項', 2.4, 1.4);
    cap('關鍵在怎麼看乘開', '下一步算 1/(1 − λx)ᵐ');
  },
]);

// ════════ q-T1GS0zeM4（趙啟超 14D：1/(1 − λx)ᵐ、extended binomial coefficient／theorem、(1 + x)^(−1/2)） ════════
scene('acC-gf-lam-m', '14D：1/(1 − λx)ᵐ ⟷ C(n + m − 1, m − 1)λⁿ', [
  async (tok, S) => { // 3.8
    S.q = card('1/(1 − λx)ᵐ　對應的 sequence = ？（m ≥ 1）', C.lilac, 0, 6.35); glow(S.q, HL);
    cap('一般的 m 次方', '');
  },
  async (tok, S) => { // 6.5
    glow(S.q, null);
    sm('m = 1：λⁿ　　m = 2：(n + 1)λⁿ　（已算過）', 0, 5.75);
    cap('m = 1、m = 2 前面算過', '');
  },
  async (tok, S) => { // 7.6
    S.L = chain(0, 5.1, 0.72);
    S.L.add('定理：(1 + x)⁻ᵐ = Σᵣ (−1)ʳ C(m + r − 1, r) xʳ');
    cap('用剛才的定理', '(1 + x)⁻ᵐ 的展開');
  },
  async (tok, S) => { // 38.4
    S.L.add('x 換成 −λx：(1 − λx)⁻ᵐ = Σᵣ (−1)ʳ C(m + r − 1, r) (−λx)ʳ');
    cap('把 x 用 −λx 代進去', '');
  },
  async (tok, S) => { // 57.2
    S.L.add('其中 (−λx)ʳ = (−1)ʳ λʳ xʳ', C.peach);
    cap('xʳ 變成 (−λx)ʳ', '多出 (−λ)ʳ');
  },
  async (tok, S) => { // 74.3
    S.L.add('(−1)ʳ · (−1)ʳ = 1 → = Σᵣ C(m + r − 1, r) λʳ xʳ', C.mint);
    cap('(−1)ʳ 乘 (−1)ʳ always 是 1', '負號就沒有了');
  },
  async (tok, S) => { // 120.3
    S.L.add('r 換成 n：aₙ = C(m + n − 1, n) λⁿ', C.lilac);
    cap('只是把 r 改名成 n', '');
  },
  async (tok, S) => { // 147.3
    const m = S.L.add('取 n 個 = 取 m − 1 個：aₙ = C(n + m − 1, m − 1) λⁿ', C.lemon); glow(m, OKG);
    cap('binomial coefficient 的性質', 'C(N, n) = C(N, N − n)，下面 m − 1 固定比較好看');
  },
  async (tok, S) => { // 232.0
    const rows = ['m = 1：C(n, 0)λⁿ = λⁿ', 'm = 2：C(n + 1, 1)λⁿ = (n + 1)λⁿ', 'm = 3：C(n + 2, 2)λⁿ = (n + 2)(n + 1)/2 · λⁿ'];
    for (let i = 0; i < 3; i++) { card(rows[i], C.mint, 0, 0.7 - i * 0.65); await wt(tok, 450); }
    cap('代 m = 1, 2, 3 檢查', '跟前面算的一樣，而且推廣了');
  },
  async (tok, S) => { // 268.1
    bad('不要硬背這個式子 → 背錯就沒道理了', 0, -1.4);
    cap('不要硬去記結果', '後面有更好看的寫法');
  },
]);

scene('acC-gf-extcoef', '14D：extended binomial coefficient C(α, r)', [
  async (tok, S) => { // 285.3
    S.t = card('定義：extended binomial coefficient　C(α, r)', C.lilac, 0, 6.3); glow(S.t, HL);
    cap('怎麼讓答案好看一點？', '定義 extended binomial coefficient');
  },
  async (tok, S) => { // 304.0
    glow(S.t, null);
    S.a = card('α：任何 real number（正負、非整數都行）', C.sky, -3.1, 5.2, 5.6); S.r = card('r：非負整數（要算 r!）', C.sky, 3.1, 5.2, 4.6);
    cap('兩個 parameter', 'α 是實數；r 是非負整數');
  },
  async (tok, S) => { // 362.5
    S.z = card('r = 0：C(α, 0) = 1', C.mint, 0, 4.0, 5); glow(S.z, OKG);
    cap('r = 0 時 always 定義成 1', '任何東西取 0 個都是 1');
  },
  async (tok, S) => { // 385.1
    glow(S.z, null);
    S.p = card('r > 0：C(α, r) = α(α − 1)(α − 2)⋯(α − r + 1) / r!', C.lemon, 0, 3.0); glow(S.p, OKG);
    cap('r > 0：跟以前的定義一模一樣', '上面 r 個連乘、下面 r!');
  },
  async (tok, S) => { // 431.8
    glow(S.p, null);
    note('示意：C(−2, 3) = (−2)(−3)(−4) / 3! = −24 / 6 = −4', 0, 2.0);
    good('以前用「連乘 / r!」定義，才能推廣到任何實數', 0, 1.2);
    cap('上面任何實數都能代', '把以前的 binomial coefficient 推廣了');
  },
]);

scene('acC-gf-negcoef', '14D：C(−n, r) = (−1)ʳ C(n + r − 1, r)', [
  async (tok, S) => { // 451.3
    S.o = card('(1 + x)⁻ⁿ = Σ (−1)ʳ C(n + r − 1, r) xʳ　← 有點麻煩', C.rose, 0, 6.3); glow(S.o, NG);
    cap('剛才的展開式', '不夠簡單、不夠漂亮');
  },
  async (tok, S) => { // 500.7
    glow(S.o, null);
    S.L = chain(0, 5.3, 0.75);
    S.L.add('C(−n, r) = ？　（n 正整數，上面是負的）');
    cap('看看 C(−n, r) 是多少', '以前沒定義，現在有了');
  },
  async (tok, S) => { // 534.8
    S.L.add('= (−n)(−n − 1)(−n − 2)⋯(−n − r + 1) / r!');
    cap('代 extended 的定義', '');
  },
  async (tok, S) => { // 557.0
    S.L.add('r 個因子各提出一個 −1 → (−1)ʳ', C.lilac);
    cap('把 −1 都提出來', '0 到 r − 1，一共 r 個');
  },
  async (tok, S) => { // 576.7
    S.L.add('= (−1)ʳ · (n + r − 1)(n + r − 2)⋯(n) / r!', C.lilac);
    cap('大的寫前面、小的寫後面', '從 n + r − 1 一路到 n');
  },
  async (tok, S) => { // 614.3
    const m = S.L.add('= (−1)ʳ · C(n + r − 1, r)', C.mint); glow(m, OKG);
    note('示意 n = 3、r = 4：(−3)(−4)(−5)(−6)/4! = 360/24 = 15 = C(6, 4)', 0, 1.25);
    cap('r 個連乘除以 r!', '就是 C(n + r − 1, r)');
  },
  async (tok, S) => { // 645.1
    S.n = card('(1 + x)⁻ⁿ = Σᵣ≥₀ C(−n, r) xʳ', C.lemon, 0, 0.3, 6.4); glow(S.n, OKG);
    cap('所以剛才的定理寫成這樣', '');
  },
  async (tok, S) => { // 692.6
    glow(S.n, null);
    hd('跟 (1 + x)ⁿ = Σ C(n, r) xʳ 一模一樣，只是次方是負的', 0, -0.55);
    cap('又簡單又好看', '會原本的 binomial theorem 就不用背');
  },
]);

scene('acC-gf-extthm', '14D：extended binomial theorem（任意實數 α）', [
  async (tok, S) => { // 768.7
    sm('正整數次方 ✓　負整數次方 ✓　其他次方？', 0, 6.3);
    cap('不只是整數次方', '');
  },
  async (tok, S) => { // 814.7
    S.t = card('(1 + x)^α = Σᵣ≥₀ C(α, r) xʳ', C.lemon, 0, 5.3, 6); glow(S.t, OKG);
    cap('extended binomial theorem', '');
  },
  async (tok, S) => { // 834.5
    glow(S.t, null);
    ['α = −1/2', 'α = −4', 'α = 1/2', 'α = 5/4'].forEach((t, i) => card(t, C.sky, -4.2 + i * 2.8, 4.1, 2.3));
    cap('α 是任何實數', '−1/2、1/2、5/4 都可以');
  },
  async (tok, S) => { // 881.3
    S.p = card('證明要用微積分的 Maclaurin series', C.lilac, 0, 3.0); glow(S.p, HL);
    cap('證明用 Maclaurin series', '所以有一些技術上的限制');
  },
  async (tok, S) => { // 917.9
    glow(S.p, null);
    S.x = card('技術性假設：x 是實數，|x| < 1（收斂）', C.rose, 0, 2.1); glow(S.x, NG);
    cap('主要是對 x 的假設', '因為微積分的定理有收斂問題');
  },
  async (tok, S) => { // 943.4
    good('除了這個技術限制，樣子跟原本的 binomial theorem 一樣', 0, 1.2);
    cap('樣子跟原來一樣', '');
  },
]);

scene('acC-gf-maclaurin', '14D：證明 — Maclaurin series', [
  async (tok, S) => { // 947.9
    S.t = card('Maclaurin series', C.lilac, 0, 6.3, 4); glow(S.t, HL);
    cap('證明用微積分的 Maclaurin series', '');
  },
  async (tok, S) => { // 971.4
    glow(S.t, null);
    sm('= 在 x = 0 這一點的 Taylor series 展開', 0, 5.65);
    cap('就是在 x = 0 的 Taylor 展開', '');
  },
  async (tok, S) => { // 997.4
    S.m = card('f(x) = Σᵣ≥₀ [ f⁽ʳ⁾(0) / r! ] xʳ', C.sky, 0, 4.9, 6); glow(S.m, HL);
    cap('係數：r 次微分代 0，除以 r!', '');
  },
  async (tok, S) => { // 1020.7
    glow(S.m, null);
    S.f = card('f(x) = (1 + x)^α　→ 只要算 r 次微分', C.mint, 0, 4.0);
    cap('現在 f(x) = (1 + x)^α', '');
  },
  async (tok, S) => { // 1051.1
    S.d = ['α', '(α − 1)', '(α − 2)', '⋯'].map((t, i) => card(t, C.peach, -3.6 + i * 2.4, 3.0, 2));
    for (let i = 0; i < 3; i++) { glow(S.d[i], HL); sm('第 ' + (i + 1) + ' 次', -3.6 + i * 2.4, 2.3); await wt(tok, 450); }
    cap('微一次 α 掉下來', '再微一次 α − 1 掉下來 …');
  },
  async (tok, S) => { // 1072.0
    dark(S.d);
    S.r = card('f⁽ʳ⁾(x) = α(α − 1)⋯(α − r + 1) · (1 + x)^(α − r)', C.sky, 0, 1.5); glow(S.r, HL);
    cap('微 r 次', '最後一次 α − r + 1 掉下來');
  },
  async (tok, S) => { // 1094.8
    glow(S.r, null);
    S.z = card('代 x = 0：(1 + 0)^(α − r) = 1', C.mint, 0, 0.7, 5);
    cap('x = 0 代進去', '1 的任何次方都是 1');
  },
  async (tok, S) => { // 1121.3
    const m = card('f⁽ʳ⁾(0) / r! = α(α − 1)⋯(α − r + 1) / r! = C(α, r)', C.lemon, 0, -0.1); glow(m, OKG);
    cap('再除以 r!', '正好是 extended binomial coefficient');
  },
  async (tok, S) => { // 1153.9
    good('證完：(1 + x)^α = Σ C(α, r) xʳ　（|x| < 1）', 0, -0.95);
    cap('證完了', '|x| < 1 是收斂的技術要求');
  },
]);

scene('acC-gf-halfneg', '14D：例 (1 + x)^(−1/2) 的展開', [
  async (tok, S) => { // 1211.4
    S.t = card('(1 + x)^(−1/2) = 1/√(1 + x)', C.lilac, 0, 6.3, 5.4); glow(S.t, HL);
    cap('例子：(1 + x) 的 −1/2 次方', '= 1/√(1 + x)');
  },
  async (tok, S) => { // 1229.0
    glow(S.t, null);
    S.c = [card('C(−½, 0) = 1', C.mint, -4.4, 5.0, 3.6), card('C(−½, 1) = −1/2', C.rose, 0, 5.0, 3.6)];
    cap('取 0 是 1；取 1 是 −1/2', '');
  },
  async (tok, S) => { // 1247.4
    S.c.push(card('C(−½, 2) = (−½)(−3/2) / 2! = 3/8', C.mint, -2.2, 4.0, 6));
    glow(S.c[2], HL);
    cap('取 2：(−1/2)(−1/2 − 1)/2!', '= 3/8');
  },
  async (tok, S) => { // 1263.8
    glow(S.c[2], null);
    S.c.push(card('C(−½, 3) = (−½)(−3/2)(−5/2) / 3! = −5/16', C.rose, -1.2, 3.1, 7.2));
    glow(S.c[3], HL);
    cap('取 3：再乘 (−1/2 − 2)，除以 3!', '= −5/16');
  },
  async (tok, S) => { // 1291.5
    glow(S.c[3], null);
    S.e = card('1/√(1 + x) = 1 − ½x + ⅜x² − (5/16)x³ + ⋯', C.sky, 0, 2.0); glow(S.e, HL);
    cap('整理起來', '正負相間');
  },
  async (tok, S) => { // 1322.5
    glow(S.e, null);
    S.g = card('xʳ 的係數 = (−1)ʳ · C(2r, r) / 2²ʳ', C.lemon, 0, 1.0, 6); glow(S.g, OKG);
    cap('通式', '(−1)ʳ 正負相間、分母 2 的 2r 次方');
  },
  async (tok, S) => { // 1376.5
    good('驗 r = 2：C(4, 2) / 2⁴ = 6/16 = 3/8 ✓', 0, 0.1);
    cap('代 r = 2 檢查', 'C(4, 2)/2⁴ = 3/8 ✓');
  },
]);

scene('acC-gf-extsum', '14D：任何次方都直接展開', [
  async (tok, S) => { // 1392.2
    S.t = card('(1 + x)^α：任何次方都能用 extended binomial theorem 展開', C.mint, 0, 6.0); glow(S.t, OKG);
    cap('這樣就好用多了', '只要適當定義 C(α, r)');
  },
  async (tok, S) => { // 1415.2
    glow(S.t, null);
    const v = [1, 4, 6, 4, 1, 0, 0, '⋯'];
    note('示意 (1 + x)⁴', -5.6, 5.0);
    v.forEach((x, i) => { const m = tile(x, i < 5 ? C.peach : C.gray, -4.6 + i * 1.3, 4.2); });
    sm('r > n：C(n, r) 自動是 0 → 無窮項變有限項', 0, 3.4);
    cap('正整數次方其實也可看成無窮項', '下面比上面大自動變 0');
  },
  async (tok, S) => { // 1443.8
    hot('算 inverse generating function：直接展開，不要硬背式子', 0, 2.4);
    cap('前面那些結果', '直接用它展開就好，不小心就背錯');
  },
]);

// ════════ LO5yHmkp5c4（趙啟超 15A：用生成函數解 recurrence — Fibonacci、aₙ = 3aₙ₋₁ + n） ════════
scene('acC-rr-intro', '15A：應用一 — 解 recurrence relation', [
  async (tok, S) => { // 3.8
    S.a = card('sequence  ⟷  generating function（兩個方向）', C.sky, 0, 6.2); glow(S.a, HL);
    cap('前面：兩個方向都會算了', '');
  },
  async (tok, S) => { // 8.4
    glow(S.a, null);
    S.b = card('應用一：解 recurrence relation', C.lilac, 0, 5.2); glow(S.b, HL);
    cap('第一個應用：解 recurrence relation', '以前是直接解');
  },
  async (tok, S) => { // 33.1
    glow(S.b, null);
    const st = ['recurrence', '算出 A(x)', '展開 / inverse', 'aₙ 的公式'];
    S.s = st.map((t, i) => card(t, [C.peach, C.mint, C.sky, C.lemon][i], -4.8 + i * 3.2, 3.8, 2.6));
    for (let i = 0; i < 3; i++) arrow(V3(-3.4 + i * 3.2, 3.8, 0), V3(-3.0 + i * 3.2, 3.8, 0));
    cap('先算生成函數，再反算回來', '');
  },
  async (tok, S) => { // 42.2
    note('類比：微分方程 → Laplace transform → inverse Laplace transform', 0, 2.7);
    cap('像用 Laplace transform 解微分方程', '');
  },
]);

const FR = (rowY, items, col) => items.map((t, i) => card(t, col, -4.6 + i * 1.9, rowY, 1.7));
scene('acC-rr-fib-gf', '15A：Fibonacci — 兩邊乘 xⁿ 再加總', [
  async (tok, S) => { // 58.6
    S.v = [0, 1, 1, 2, 3, 5, 8].map((v, i) => tile(v, C.peach, -4.5 + i * 1.5, 6.3, 0.7));
    sm('F₀  F₁  F₂ …', -6.3, 6.3);
    cap('例子：Fibonacci number', '前面直接解過，現在用生成函數再解一次');
  },
  async (tok, S) => { // 67.8
    S.d = card('Fₙ = Fₙ₋₁ + Fₙ₋₂（n ≥ 2），F₀ = 0，F₁ = 1', C.sky, 0, 5.45); glow(S.d, HL);
    cap('定義：n ≥ 2 時 Fₙ = Fₙ₋₁ + Fₙ₋₂', '兩個 initial condition');
  },
  async (tok, S) => { // 86.0
    glow(S.d, null);
    S.F = card('F(x) = Σₙ≥₀ Fₙ xⁿ', C.mint, 0, 4.7, 4.4); glow(S.F, OKG);
    cap('令 F(x) 是 Fₙ 的生成函數', '');
  },
  async (tok, S) => { // 106.0
    glow(S.F, null);
    S.e = card('Σₙ≥₂ Fₙxⁿ = Σₙ≥₂ Fₙ₋₁xⁿ + Σₙ≥₂ Fₙ₋₂xⁿ', C.lilac, 0, 3.95); glow(S.e, HL);
    cap('兩邊都乘 xⁿ，從 n = 2 加起來', '因為式子對所有 n ≥ 2 成立');
  },
  async (tok, S) => { // 150.8
    glow(S.e, null);
    hot('想辦法讓三項都跟 F(x) 扯上關係', 0, 3.3);
    cap('再把它跟生成函數扯上關係', '');
  },
  async (tok, S) => { // 162.5
    S.r1 = FR(2.5, ['F₂x²', 'F₃x³', 'F₄x⁴', '⋯'], C.peach);
    sm('第一項', -6.3, 2.5);
    cap('第一項：n = 2, 3, 4 … 代進去', 'F₂x² + F₃x³ + ⋯');
  },
  async (tok, S) => { // 186.7
    S.k1 = card('= F(x) − F₀ − F₁x', C.mint, 4.4, 2.5, 3.8); glow(S.k1, OKG);
    cap('差了常數項跟一次項', '');
  },
  async (tok, S) => { // 206.9
    glow(S.k1, null);
    S.r2 = FR(1.6, ['F₁x²', 'F₂x³', 'F₃x⁴', '⋯'], C.sky);
    sm('第二項', -6.3, 1.6);
    cap('第二項：F₁x² + F₂x³ + ⋯', '次方比下標多 1 → 提出 x');
  },
  async (tok, S) => { // 268.8
    S.k2 = card('= x · (F(x) − F₀)', C.mint, 4.4, 1.6, 3.8); glow(S.k2, OKG);
    cap('提出 x 以後只差一個常數項', '');
  },
  async (tok, S) => { // 285.4
    glow(S.k2, null);
    S.r3 = FR(0.7, ['F₀x²', 'F₁x³', 'F₂x⁴', '⋯'], C.lilac);
    sm('第三項', -6.3, 0.7);
    await wt(tok, 500);
    S.k3 = card('= x² · F(x)', C.mint, 4.4, 0.7, 3.8); glow(S.k3, OKG);
    cap('第三項：次方比下標多 2 → 提出 x²', '剛好是 x²F(x)');
  },
  async (tok, S) => { // 323.7
    [S.k1, S.k2, S.k3].forEach((m) => glow(m, OKG));
    good('三個都跟 F(x) 扯上關係了', 0, -0.2);
    cap('三項都變成 F(x) 的式子', '');
  },
]);

scene('acC-rr-fib-solve', '15A：解出 F(x) = x/(1 − x − x²)', [
  async (tok, S) => { // 349.3
    S.L = chain(0, 6.2, 0.78);
    S.L.add('F(x) − F₀ − F₁x = x(F(x) − F₀) + x²F(x)');
    cap('有 F(x) 的放一邊，沒有的放另一邊', '');
  },
  async (tok, S) => { // 361.6
    S.L.add('(1 − x − x²)·F(x) = F₀ + (F₁ − F₀)x');
    cap('左邊提出 F(x)', '剩下的移到右邊');
  },
  async (tok, S) => { // 397.8
    S.L.add('代 F₀ = 0、F₁ = 1：右邊 = x', C.lilac);
    cap('用 initial condition', '右邊剩下 x');
  },
  async (tok, S) => { // 414.0
    const m = S.L.add('F(x) = x / (1 − x − x²)', C.lemon); glow(m, OKG);
    note('驗算（示意）：x/(1 − x − x²) = 0 + x + x² + 2x³ + 3x⁴ + 5x⁵ + ⋯', 0, 2.75);
    const v = [0, 1, 1, 2, 3, 5, 8];
    v.forEach((x, i) => tile(x, C.peach, -4.5 + i * 1.5, 1.9, 0.7));
    cap('除過去，生成函數找到了', '下面只是把它 inverse 回來');
  },
  async (tok, S) => { // 446.4
    hd('乘 xⁿ → 從 n = 2 加總 → 化成 F(x) → 代 initial condition', 0, 1.0);
    cap('回顧步驟', '分母 1 − x − x² 來自移項');
  },
]);

scene('acC-rr-fib-pf', '15A：partial fraction 反算回 Fₙ', [
  async (tok, S) => { // 487.8
    S.k = card('λⁿ ⟷ 1/(1 − λx)：想辦法變成這個樣子', C.mint, 0, 6.3); glow(S.k, HL);
    cap('反過來：要湊成 1/(1 − λx)', '');
  },
  async (tok, S) => { // 510.5
    glow(S.k, null);
    S.L = chain(0, 5.45, 0.74);
    S.L.add('1 − x − x² = (1 − λ₁x)(1 − λ₂x)');
    cap('分母分解因式', '');
  },
  async (tok, S) => { // 527.2
    S.L.add('λ₁ = (1 + √5)/2，λ₂ = (1 − √5)/2', C.lilac);
    cap('λ₁、λ₂ 可以解出來', 'λ₁ + λ₂ = 1、λ₁λ₂ = −1');
  },
  async (tok, S) => { // 542.6
    S.L.add('x/(1 − x − x²) = α₁/(1 − λ₁x) + α₂/(1 − λ₂x)');
    cap('做 partial fraction expansion', '分項分式');
  },
  async (tok, S) => { // 584.4
    note('跟積分時的分項分式一樣（電機系的 residue 也會用）', 0, 2.55);
    cap('積分時也做過分項分式', '');
  },
  async (tok, S) => { // 645.0
    S.L.add('兩邊乘分母：x = α₁(1 − λ₂x) + α₂(1 − λ₁x)', C.peach);
    cap('左右兩邊乘 (1 − λ₁x)(1 − λ₂x)', '');
  },
  async (tok, S) => { // 676.2
    S.a1 = card('代 x = 1/λ₁：α₂ 那項變 0', C.sky, -3.3, 1.7, 4.8); glow(S.a1, HL);
    cap('代根讓一項消失', 'x = λ₁⁻¹ 代進去');
  },
  async (tok, S) => { // 733.0
    relab(S.a1, 'α₁ = 1/(λ₁ − λ₂) = 1/√5'); glow(S.a1, OKG);
    cap('λ₁ − λ₂ = √5', 'α₁ = 1/√5');
  },
  async (tok, S) => { // 748.5
    S.a2 = card('代 x = 1/λ₂：α₂ = 1/(λ₂ − λ₁) = −1/√5', C.sky, 3.3, 1.7, 5.4); glow(S.a2, OKG);
    cap('再用 x = λ₂⁻¹', 'α₂ = −1/√5');
  },
  async (tok, S) => { // 809.5
    dark(S.a1, S.a2);
    S.p = card('F(x) = (1/√5)·1/(1 − λ₁x) − (1/√5)·1/(1 − λ₂x)', C.mint, 0, 0.8); glow(S.p, HL);
    cap('再 inverse 回來', '1/(1 − λx) ⟷ λⁿ');
  },
  async (tok, S) => { // 832.0
    glow(S.p, null);
    S.ans = card('Fₙ = (1/√5)·[ ((1 + √5)/2)ⁿ − ((1 − √5)/2)ⁿ ]，n ≥ 0', C.lemon, 0, -0.05); glow(S.ans, OKG);
    cap('得到 Fibonacci 的通式', '');
  },
  async (tok, S) => { // 871.5
    good('跟以前直接解的答案一模一樣', 0, -0.85);
    cap('兩種方法，答案只有一個', '');
  },
]);

scene('acC-rr-flow', '15A：生成函數解 recurrence 的流程', [
  async (tok, S) => { // 880.0
    S.s = ['① 兩邊乘 xⁿ、加總 → 解出 A(x)', '② 分母分解因式', '③ partial fraction expansion', '④ 1/(1 − λx) ⟷ λⁿ 反回 aₙ'].map((t, i) => card(t, C.gray, 0, 5.8 - i * 1.0, 6.4));
    glow(S.s[0], HL); tint(S.s[0], C.mint);
    cap('先把生成函數解出來', '');
  },
  async (tok, S) => { // 904.5
    glow(S.s[0], null);
    [1, 2].forEach((i) => { tint(S.s[i], C.sky); glow(S.s[i], HL); });
    cap('反過來：分解因式', '再做 partial fraction expansion');
  },
  async (tok, S) => { // 917.4
    dark(S.s);
    tint(S.s[3], C.lemon); glow(S.s[3], OKG);
    cap('再把生成函數反回 sequence', '');
  },
  async (tok, S) => { // 938.5
    dark(S.s);
    hd('Fₙ 就是展開以後 xⁿ 的係數', 0, 1.6);
    cap('要的第 n 項', '就是 xⁿ 的係數');
  },
]);

scene('acC-rr-nonhom', '15A：non-homogeneous aₙ − 3aₙ₋₁ = n', [
  async (tok, S) => { // 960.7
    S.h = card('剛才：Fₙ − Fₙ₋₁ − Fₙ₋₂ = 0　homogeneous', C.sky, 0, 6.3); glow(S.h, HL);
    cap('剛才是 homogeneous', '移項以後右邊是 0');
  },
  async (tok, S) => { // 979.4
    glow(S.h, null);
    S.n = card('現在：aₙ − 3aₙ₋₁ = n（n ≥ 1），a₀ = 1　non-homogeneous', C.lilac, 0, 5.55); glow(S.n, HL);
    cap('右邊不是 0：non-homogeneous', '可以直接解，也可以用生成函數');
  },
  async (tok, S) => { // 1004.5
    glow(S.n, null);
    S.L = chain(0, 4.7, 0.72);
    S.L.add('A(x) = Σ aₙxⁿ；兩邊乘 xⁿ，從 n = 1 加');
    cap('一樣：乘 xⁿ、對 n ≥ 1 加起來', '');
  },
  async (tok, S) => { // 1027.0
    S.L.add('Σₙ≥₁ aₙxⁿ = A(x) − a₀', C.peach);
    cap('第一項差一個常數項 a₀', '');
  },
  async (tok, S) => { // 1046.4
    S.L.add('Σₙ≥₁ 3aₙ₋₁xⁿ = 3x · A(x)', C.peach);
    cap('第二項：a₀x + a₁x² + ⋯', '提出 x，就是 A(x)');
  },
  async (tok, S) => { // 1087.4
    S.L.add('Σₙ≥₁ n·xⁿ = x/(1 − x)²　（n·λⁿ 取 λ = 1）', C.peach);
    cap('右邊：前面算過 n·λⁿ', 'λ = 1 → x/(1 − x)²');
  },
  async (tok, S) => { // 1179.3
    S.L.add('(1 − 3x)·A(x) = a₀ + x/(1 − x)² = 1 + x/(1 − x)²', C.mint);
    cap('A(x) 放一邊，a₀ = 1 代進來', '');
  },
  async (tok, S) => { // 1216.5
    const m = S.L.add('A(x) = 1/(1 − 3x) + x / [(1 − x)²(1 − 3x)]', C.lemon); glow(m, OKG);
    cap('除過去', '第一項 1/(1 − 3x) 先不要併進去');
  },
  async (tok, S) => { // 1257.6
    dark(S.L.ls);
    hd('1/(1 − 3x) 已經是 1/(1 − λx) 的樣子 → 不動', -3.3, 0.0);
    hot('只對後面那項做 partial fraction', 3.3, 0.0);
    cap('第一項已經會反了', '只做後面那項');
  },
  async (tok, S) => { // 1295.7
    S.pf = card('x/[(1 − x)²(1 − 3x)] = α₁/(1 − x) + α₂/(1 − x)² + α₃/(1 − 3x)', C.sky, 0, -0.85); glow(S.pf, HL);
    cap('會有三項', '(1 − x) 是平方，所以有 1 − x 和 (1 − x)²');
  },
  async (tok, S) => { // 1329.0
    glow(S.pf, null);
    note('下一步：求出 α₁、α₂、α₃，再 inverse 回來', 0, -1.6);
    cap('接著把三個係數找出來', '跟積分時算係數一樣');
  },
]);

// ════════ 8zfYKqZaSi8（趙啟超 15B：求 α、驗算、三階 recurrence） ════════
scene('acC-rr-alpha', '15B：求 α₁、α₂、α₃（代根）', [
  async (tok, S) => { // 4.3
    S.e = card('x = α₁(1 − x)(1 − 3x) + α₂(1 − 3x) + α₃(1 − x)²', C.sky, 0, 6.3); glow(S.e, HL);
    cap('兩邊乘 (1 − x)²(1 − 3x)', '');
  },
  async (tok, S) => { // 35.4
    glow(S.e, null);
    hd('技巧：代分母的根，讓某些項變 0', 0, 5.55);
    cap('通常代那個根', '有些項就消掉');
  },
  async (tok, S) => { // 40.0
    S.a2 = card('x = 1：1 = α₂(1 − 3) ⇒ α₂ = −1/2', C.mint, 0, 4.7, 7); glow(S.a2, OKG);
    cap('代 x = 1', 'α₁、α₃ 那兩項都是 0');
  },
  async (tok, S) => { // 63.4
    glow(S.a2, null);
    S.a3 = card('x = 1/3：1/3 = α₃(1 − 1/3)² = α₃·4/9 ⇒ α₃ = 3/4', C.mint, 0, 3.9, 8.4); glow(S.a3, OKG);
    cap('再代 1 − 3x = 0 的根 x = 1/3', 'α₃ = 3/4');
  },
  async (tok, S) => { // 97.6
    glow(S.a3, null);
    S.c = card('比常數項（x = 0）：0 = α₁ + α₂ + α₃', C.sky, 0, 3.1, 7); glow(S.c, HL);
    cap('α₁ 用別的方法：比常數項', '左邊常數項 0');
  },
  async (tok, S) => { // 128.6
    glow(S.c, null);
    S.a1 = card('α₁ = −α₂ − α₃ = 1/2 − 3/4 = −1/4', C.mint, 0, 2.3, 7); glow(S.a1, OKG);
    cap('α₂、α₃ 已知', 'α₁ = −1/4');
  },
  async (tok, S) => { // 148.4
    glow(S.a1, null);
    S.f = card('A(x) = 1/(1 − 3x) + [ −¼/(1 − x) − ½/(1 − x)² + ¾/(1 − 3x) ]', C.lilac, 0, 1.2); glow(S.f, HL);
    cap('別忘了前面還有一項', '1/(1 − 3x)');
  },
  async (tok, S) => { // 180.7
    glow(S.f, null);
    S.g = card('A(x) = (7/4)/(1 − 3x) − (1/4)/(1 − x) − (1/2)/(1 − x)²', C.lemon, 0, 0.3); glow(S.g, OKG);
    cap('兩個 1/(1 − 3x) 合起來', '1 + 3/4 = 7/4');
  },
]);

scene('acC-rr-inv', '15B：反回 aₙ 並驗算', [
  async (tok, S) => { // 203.0
    S.g = card('A(x) = (7/4)/(1 − 3x) − (1/4)/(1 − x) − (1/2)/(1 − x)²', C.lemon, 0, 6.3); glow(S.g, HL);
    S.t = [];
    cap('把 A(x) inverse 回來', '1/(1 − λx) ⟷ λⁿ');
  },
  async (tok, S) => { // 217.9
    glow(S.g, null);
    S.t.push(card('(7/4)·3ⁿ', C.mint, -4.4, 5.2, 2.8)); glow(S.t[0], OKG);
    cap('1/(1 − 3x) ⟷ 3ⁿ', '');
  },
  async (tok, S) => { // 222.1
    S.t.push(card('− (1/4)·1ⁿ = − 1/4', C.mint, -0.6, 5.2, 3.6)); glow(S.t[1], OKG);
    cap('1/(1 − x) ⟷ 1ⁿ = 1', '');
  },
  async (tok, S) => { // 249.0
    S.t.push(card('− (1/2)(n + 1)', C.mint, 3.6, 5.2, 3.2)); glow(S.t[2], OKG);
    sm('1/(1 − x)² = Σ C(−2, n)(−x)ⁿ = Σ (n + 1)xⁿ', 0, 4.45);
    cap('平方那項用 extended binomial theorem', '不要去背，直接展開');
  },
  async (tok, S) => { // 283.5
    dark(S.t);
    S.a = card('aₙ = (7/4)·3ⁿ − n/2 − 3/4，n ≥ 0', C.lemon, 0, 3.6, 7); glow(S.a, OKG);
    cap('整理一下', '');
  },
  async (tok, S) => { // 308.3
    glow(S.a, null);
    S.c0 = card('n = 0：7/4 − 3/4 = 1 = a₀ ✓', C.mint, 0, 2.7, 6); glow(S.c0, OKG);
    cap('驗算 n = 0', '7/4 − 3/4 = 1 ✓');
  },
  async (tok, S) => { // 318.1
    glow(S.c0, null);
    const rr = [['a₁ = 3·1 + 1 = 4', '公式：21/4 − 1/2 − 3/4 = 4 ✓'], ['a₂ = 3·4 + 2 = 14', '公式：63/4 − 1 − 3/4 = 14 ✓'], ['a₃ = 3·14 + 3 = 45', '公式：189/4 − 3/2 − 3/4 = 45 ✓']];
    for (let i = 0; i < 3; i++) { card(rr[i][0], C.peach, -3.3, 1.8 - i * 0.75, 4.2); card(rr[i][1], C.mint, 2.6, 1.8 - i * 0.75, 5.4); await wt(tok, 500); }
    sm('示意：用 recurrence 算前幾項，代進公式比對', 0, -0.5);
    cap('用 recurrence 算前幾個', '代進公式看對不對');
  },
  async (tok, S) => { // 372.7
    good('驗算要用「別的方法」去驗', 0, -1.2);
    cap('不只是重看一遍', '要用別的方法驗算');
  },
  async (tok, S) => { // 388.5
    hd('homogeneous 或 non-homogeneous：方法都一樣；右邊多算一個生成函數而已', 0, -1.9);
    cap('方法都一樣', '正著算、反著算');
  },
]);

scene('acC-rr-third', '15B：三階 recurrence，右邊只有 n = 3 是 1', [
  async (tok, S) => { // 418.1
    S.t = card('再一個例子', C.lilac, 0, 6.35, 3); glow(S.t, HL);
    cap('再看一個例子', '');
  },
  async (tok, S) => { // 438.3
    glow(S.t, null);
    S.r = card('aₙ − 2aₙ₋₁ − aₙ₋₂ + 2aₙ₋₃ = f(n)，n ≥ 3', C.sky, 0, 5.6); glow(S.r, HL);
    S.f = card('f(3) = 1；n ≥ 4 時 f(n) = 0', C.peach, 0, 4.85, 5.4);
    cap('third order recurrence', '右邊 n = 3 是 1，n ≥ 4 是 0');
  },
  async (tok, S) => { // 465.9
    glow(S.r, null);
    S.ic = card('三階 → 3 個 initial condition：a₀ = 0、a₁ = 0、a₂ = 2', C.mint, 0, 4.1); glow(S.ic, OKG);
    cap('三階要三個 initial condition', 'n 從 3 開始，well defined');
  },
  async (tok, S) => { // 486.7
    glow(S.ic, null);
    S.L = chain(0, 3.3, 0.7);
    S.L.add('兩邊乘 xⁿ，從 n = 3 加起來');
    cap('一樣：乘 xⁿ、從 n ≥ 3 加', '');
  },
  async (tok, S) => { // 497.3
    S.L.add('Σₙ≥₃ aₙxⁿ = A(x) − a₀ − a₁x − a₂x²', C.peach);
    cap('第一項差了三項', '常數、一次、二次項');
  },
  async (tok, S) => { // 525.3
    S.L.add('−2x(A − a₀ − a₁x)　− x²(A − a₀)　+ 2x³A', C.peach);
    cap('後面依序提出 x、x²、x³', '各差兩項、一項、零項');
  },
  async (tok, S) => { // 583.7
    S.L.add('左邊合起來：(1 − 2x − x² + 2x³)·A(x) − (初始項)', C.lilac);
    cap('A(x) 前面是 1 − 2x − x² + 2x³', '');
  },
  async (tok, S) => { // 600.3
    S.rs = card('右邊：1·x³ + 0·x⁴ + 0·x⁵ + ⋯ = x³', C.peach, 0, -0.2, 6.4); glow(S.rs, HL);
    cap('右邊也乘 xⁿ 加起來', 'n = 3 是 1·x³，後面都是 0');
  },
  async (tok, S) => { // 645.8
    glow(S.rs, null);
    note('右邊再怎麼奇怪，乘上去加起來照算', 0, -0.85);
    cap('右邊不管什麼樣子', '照算就對了');
  },
  async (tok, S) => { // 670.2
    S.L.add('代 a₀ = a₁ = 0、a₂ = 2：只剩 −2x² 移到右邊', C.lilac);
    cap('只有 a₂ 不是 0', '移過去多一個 2x²');
  },
  async (tok, S) => { // 714.2
    S.A = card('A(x) = (2x² + x³) / (1 − 2x − x² + 2x³)', C.lemon, 0, -1.5); glow(S.A, OKG);
    cap('A(x) 算出來了', '');
  },
]);

scene('acC-rr-third-pf', '15B：三個不同的根 — partial fraction', [
  async (tok, S) => { // 751.9
    S.A = card('A(x) = x² · (2 + x) / (1 − 2x − x² + 2x³)', C.lemon, 0, 6.3); glow(S.A, HL);
    cap('把 x² 提出來', '只對後面做 partial fraction');
  },
  async (tok, S) => { // 813.0
    glow(S.A, null);
    S.d = card('1 − 2x − x² + 2x³ = (1 − 2x)(1 − x)(1 + x)', C.sky, 0, 5.4); glow(S.d, HL);
    cap('分母分解因式', '三個不同的 factor');
  },
  async (tok, S) => { // 830.7
    glow(S.d, null);
    S.p = card('(2 + x)/[(1 − 2x)(1 − x)(1 + x)] = α₁/(1 − 2x) + α₂/(1 − x) + α₃/(1 + x)', C.lilac, 0, 4.5); glow(S.p, HL);
    cap('上面三個 constant', '');
  },
  async (tok, S) => { // 860.5
    glow(S.p, null);
    S.a = [card('× (1 − 2x)，x = 1/2：α₁ = (5/2)/[(1/2)(3/2)] = 10/3', C.mint, 0, 3.5, 9)]; glow(S.a[0], OKG);
    cap('乘 (1 − 2x)，再代 x = 1/2', 'α₁ = 10/3');
  },
  async (tok, S) => { // 950.2
    glow(S.a[0], null);
    S.a.push(card('× (1 − x)，x = 1：α₂ = 3/[(−1)(2)] = −3/2', C.mint, 0, 2.7, 9)); glow(S.a[1], OKG);
    cap('乘 (1 − x)，代 x = 1', 'α₂ = −3/2');
  },
  async (tok, S) => { // 966.5
    glow(S.a[1], null);
    S.a.push(card('× (1 + x)，x = −1：α₃ = 1/[(3)(2)] = 1/6', C.mint, 0, 1.9, 9)); glow(S.a[2], OKG);
    cap('乘 (1 + x)，代 x = −1', 'α₃ = 1/6');
  },
  async (tok, S) => { // 1001.3
    glow(S.a[2], null);
    S.n = card('沒有 x² 的話：(10/3)·2ⁿ − 3/2 + (1/6)(−1)ⁿ', C.sky, 0, 1.0); glow(S.n, HL);
    cap('如果前面沒有 x²', '直接反回去是這樣');
  },
  async (tok, S) => { // 1018.0
    glow(S.n, null);
    const sh = [0, 0, 2, 5, 12, 25];
    S.sh = sh.map((v, i) => tile(i < 2 ? '0' : 'b' + '₀₁₂₃'[i - 2], i < 2 ? C.gray : C.peach, -3.6 + i * 1.3, 0.1, 0.72));
    slotRow(['x⁰', 'x¹', 'x²', 'x³', 'x⁴', 'x⁵'], -3.6, 1.3, -0.6);
    hot('× x²：整個往後移兩格 → n 變 n − 2', 3.4, 0.6);
    cap('多乘一個 x²', '全部往後挪兩格');
  },
  async (tok, S) => { // 1052.8
    const m = card('aₙ = (10/3)·2ⁿ⁻² − 3/2 + (1/6)(−1)ⁿ⁻²，n ≥ 2；a₀ = a₁ = 0', C.lemon, 0, -1.4); glow(m, OKG);
    cap('公式從 n ≥ 2 開始', '展開至少是平方項，前面都是 0');
  },
  async (tok, S) => { // 1075.8
    good('驗算（示意）：a₃ = 20/3 − 3/2 − 1/6 = 5 ✓（由 recurrence：2·2 + 0 − 0 + 1 = 5）', 0, -2.15);
    cap('步驟都一樣', '正的反的要算熟');
  },
]);

// ════════ zjsDjXEa6Zc 開頭：房貸作業的背景（每月還一樣多：利息越來越少、本金越來越多） ════════
// 老師只說「借二十萬、兩年還完」；利率沒給，這裡用示意的月利率 1%（年利率 12%）。D 由 aₙ₊₁ = (1 + i)aₙ − D、a₂₄ = 0 算出。
const LOAN = (() => {
  const P0 = 200000, i = 0.01, n = 24, D = Math.round(P0 * i / (1 - Math.pow(1 + i, -n)));
  const rows = []; let a = P0;
  for (let k = 1; k <= n; k++) { const I = Math.round(a * i), pr = Math.min(a, D - I); rows.push({ k, a, I, pr }); a = a - pr; }
  return { P0, i, n, D, rows, end: a };
})();
const loanBar = (r, x, w = 0.38) => {
  const sc = 3.0 / LOAN.D, hi = r.I * sc, hp = r.pr * sc;
  return [cube('', C.blue, [w, hp, 0.4], x, 0.2 + hp / 2, 0), cube('', C.orange, [w, hi, 0.4], x, 0.2 + hp + hi / 2, 0)];
};
const LX = (k) => -5.75 + (k - 1) * 0.5;
scene('acC-loan', '作業背景：房貸每月怎麼還', [
  async (tok, S) => { // 4
    S.t = card('借 200,000，兩年（24 個月）還完，每月還一樣多 D', C.lilac, 0, 6.3); glow(S.t, HL);
    S.f = hot('aₙ₊₁ = (1 + i)·aₙ − D　（aₙ：還欠的本金，i：月利率，示意 1%）', 0, 5.4);
    cap('房貸作業：每個月固定還一樣的錢', '欠的錢每月先長利息，再扣掉 D');
  },
  async (tok, S) => { // 23
    glow(S.t, null);
    const r = LOAN.rows[0]; S.b = [loanBar(r, LX(1))];
    S.l1 = sm('第 1 月：欠 ' + r.a + '，利息 ' + r.I + '，D = ' + LOAN.D + ' → 還本金 ' + r.pr, 0, 4.6);
    cap('第一個月：先產生一個月的利息', '還的錢一部分付利息（橘）、其餘還本金（藍）');
  },
  async (tok, S) => { // 36
    const r = LOAN.rows[1]; S.b.push(loanBar(r, LX(2)));
    S.l2 = sm('第 2 月：欠 ' + r.a + '，利息 ' + r.I + ' → 還本金 ' + r.pr, 0, 3.9);
    cap('本金變少了，第二個月的利息就少一點', '同樣還 D，還本金的部分變多');
  },
  async (tok, S) => { // 54
    const r = LOAN.rows[2]; S.b.push(loanBar(r, LX(3)));
    S.l3 = sm('第 3 月：欠 ' + r.a + '，利息 ' + r.I + ' → 還本金 ' + r.pr, 0, 3.15);
    cap('第三個月也一樣', '利息越來越少、本金越還越多');
  },
  async (tok, S) => { // 61
    gone(S.l1, S.l2, S.l3);
    for (const r of LOAN.rows.slice(3)) { S.b.push(loanBar(r, LX(r.k))); await wt(tok, 90); }
    sm('第 1 月', LX(1), -0.3); sm('第 24 月', LX(24), -0.3);
    const ok = Math.abs(LOAN.end) < 5 && LOAN.rows.every((r, k) => k === 0 || r.I <= LOAN.rows[k - 1].I);
    good('每月都是 D = ' + LOAN.D + '：橘色利息越來越少，24 個月後欠 0' + (ok ? ' ✓' : ' ✗'), 0, 4.4);
    cap('每月還的錢一樣', '利息部分越來越少，最後剛好還完');
  },
]);

// ════════ zjsDjXEa6Zc（趙啟超 15C：生成函數拿來計數 — a + b = n、集合的生成函數相乘） ════════
scene('acC-cnt-intro', '15C：應用二 — 用生成函數計數', [
  async (tok, S) => { // 123.8
    S.t = card('應用二：直接拿來做 enumeration（計數）', C.lilac, 0, 6.2); glow(S.t, HL);
    cap('生成函數的第二個用途', '拿來數「有幾種」');
  },
  async (tok, S) => { // 141.9
    glow(S.t, null);
    S.a = card('要數的東西跟 n 有關：叫它 aₙ', C.sky, 0, 5.1, 6); glow(S.a, HL);
    cap('要算的數目跟 n 有關', '叫它 aₙ');
  },
  async (tok, S) => { // 147.0
    glow(S.a, null);
    bad('不一個一個算 aₙ', -3.2, 4.2); good('去算 aₙ 的生成函數 A(x)', 3.2, 4.2);
    cap('不直接算 aₙ', '有時候算生成函數反而容易');
  },
  async (tok, S) => { // 173.8
    S.e = card('A(x) 算出來 → 展開 → 每一個 aₙ 都知道', C.mint, 0, 3.1); glow(S.e, OKG);
    cap('算出來以後展開', '所有的 aₙ 一次全都知道');
  },
]);

const SA = [0, 1, 2, 3, 4], SB = [2, 3, 4];
const AX = (a) => -4.2 + a * 1.05, BX = (b) => -4.2 + b * 1.05;
scene('acC-cnt-ab', '15C：a + b = n，a ∈ A、b ∈ B 有幾組解', [
  async (tok, S) => { // 201.5
    S.t = card('兩個集合 A、B（都是非負整數），n 是 non-negative integer', C.sky, 0, 6.3); glow(S.t, HL);
    cap('先用一類問題當例子', '');
  },
  async (tok, S) => { // 240.3
    glow(S.t, null);
    S.q = card('a + b = n，a ∈ A、b ∈ B：有幾組解？', C.lilac, 0, 5.5); glow(S.q, HL);
    cap('解 a + b = n', 'a 在 A 裡、b 在 B 裡');
  },
  async (tok, S) => { // 253.2
    glow(S.q, null);
    sm('A =', -5.6, 4.5); sm('B =', -5.6, 3.5);
    S.A = SA.map((a) => tile(a, C.sky, AX(a), 4.5, 0.75));
    S.B = SB.map((b) => tile(b, C.peach, BX(b), 3.5, 0.75));
    S.gl = []; S.cnt = card('gₙ：', C.gray, 3.8, 4.0, 4.4);
    cap('例：A = {0, 1, 2, 3, 4}，B = {2, 3, 4}', '答案跟 n 有關');
  },
  async (tok, S) => { // 292.7
    const show = async (n, rowY) => {
      const pairs = []; SA.forEach((a) => SB.forEach((b) => { if (a + b === n) pairs.push([a, b]); }));
      dark(S.A, S.B);
      for (const [a, b] of pairs) { glow(S.A[a], HL); glow(S.B[SB.indexOf(b)], HL); await wt(tok, 350); }
      S.gl.push(sm('n = ' + n + '：' + pairs.map(([a, b]) => a + '+' + b).join('、') + ' → ' + pairs.length + ' 組', 3.8, rowY));
      return pairs.length;
    };
    S.show = show;
    await show(2, 3.2);
    cap('n = 2：0 + 2', '1 + 什麼都不會是 2 → 1 組');
  },
  async (tok, S) => { // 330.4
    await S.show(3, 2.6);
    cap('n = 3：0 + 3、1 + 2', '2 + 2 就超過了 → 2 組');
  },
  async (tok, S) => { // 368.4
    await S.show(4, 2.0);
    cap('n = 4：0 + 4、1 + 3、2 + 2', '3 組');
  },
  async (tok, S) => { // 385.0
    await S.show(5, 1.4);
    cap('n = 5：1 + 4、2 + 3、3 + 2', '也是 3 組');
  },
  async (tok, S) => { // 430.0
    dark(S.A, S.B);
    S.gl.push(sm('n = 0、1：怎麼加都不可能 → 0 組', 3.8, 0.8));
    cap('n = 0、n = 1', '怎麼加都不可能 → 0 組');
  },
  async (tok, S) => { // 499.3
    const v = [0, 0, 1, 2, 3, 3];
    S.g = v.map((x, i) => tile(x, C.mint, -4.2 + i * 1.05, 1.0, 0.7));
    slotRow(['g₀', 'g₁', 'g₂', 'g₃', 'g₄', 'g₅'], -4.2, 1.05, 0.3);
    cap('這個數目叫 gₙ', 'g₀, g₁, g₂, … = 0, 0, 1, 2, 3, 3, …');
  },
]);

scene('acC-cnt-gfab', '15C：集合的生成函數，相乘就得到 G(x)', [
  async (tok, S) => { // 515.4
    S.G = card('G(x) = Σ gₙ xⁿ', C.mint, 0, 6.3, 4.4); glow(S.G, HL);
    cap('gₙ 的生成函數 G(x)', '跟平常的定義一樣');
  },
  async (tok, S) => { // 552.0
    glow(S.G, null);
    sm('直接算 G(x) 比較容易 → 一次把所有 gₙ 都算出來', 0, 5.6);
    cap('不一個一個算 gₙ', '直接算 G(x)，展開就全部知道');
  },
  async (tok, S) => { // 593.8
    S.ga = card('G_A(x) = Σ_{a ∈ A} xᵃ', C.sky, -3.3, 4.7, 4.6); glow(S.ga, HL);
    sm('A 的每個元素 a → 取 xᵃ 加起來', -3.3, 4.0);
    cap('定義 A 集合的生成函數', '每個元素 a 取 x 的 a 次方，加起來');
  },
  async (tok, S) => { // 641.1
    glow(S.ga, null);
    S.gb = card('G_B(x) = Σ_{b ∈ B} xᵇ', C.peach, 3.3, 4.7, 4.6); glow(S.gb, HL);
    sm('B 也一樣：取 xᵇ 加起來', 3.3, 4.0);
    cap('B 集合也一樣', '');
  },
  async (tok, S) => { // 678.4
    glow(S.gb, null);
    S.p = card('G_A(x) · G_B(x)：乘開 = 左邊挑一項 × 右邊挑一項，全部加起來', C.lilac, 0, 3.0); glow(S.p, HL);
    cap('考慮兩個相乘', '每邊挑一項乘起來，所有可能加起來');
  },
  async (tok, S) => { // 709.4
    glow(S.p, null);
    S.ty = card('典型的一項：xᵃ · xᵇ = x^(a + b)', C.sky, 0, 2.1, 6); glow(S.ty, HL);
    cap('看一個典型項', 'xᵃ · xᵇ = x 的 a + b 次方');
  },
  async (tok, S) => { // 735.2
    glow(S.ty, null);
    note('例：乘出 x⁵ ⇔ a + b = 5（a ∈ A、b ∈ B）', 0, 1.3);
    cap('乘出五次方', '就代表 a + b = 5');
  },
  async (tok, S) => { // 796.8
    S.c = card('xⁿ 的係數 = 「a + b = n」的組數（每一組貢獻 1）', C.mint, 0, 0.5); glow(S.c, OKG);
    cap('一組解就貢獻一個 1', '有幾組就貢獻幾');
  },
  async (tok, S) => { // 829.4
    glow(S.c, null);
    const m = card('⇒ G(x) = G_A(x) · G_B(x)', C.lemon, 0, -0.35, 5.6); glow(m, OKG);
    cap('那個係數就是 gₙ', '所以 G(x) = G_A(x) · G_B(x)');
  },
]);

scene('acC-cnt-gen', '15C：推廣到很多個變數', [
  async (tok, S) => { // 892.4
    S.e = card('a₁ + a₂ + ⋯ + a_m = n，aᵢ ∈ Aᵢ（i = 1 … m）', C.sky, 0, 5.8); glow(S.e, HL);
    cap('推廣：不只 a、b 兩個', 'm 個變數，各自在自己的集合裡');
  },
  async (tok, S) => { // 948.7
    glow(S.e, null);
    S.g = card('G(x) = G_{A₁}(x) · G_{A₂}(x) ⋯ G_{A_m}(x)', C.lemon, 0, 4.6); glow(S.g, OKG);
    cap('gₙ 的生成函數', '把每個集合的生成函數乘在一起');
  },
  async (tok, S) => { // 989.2
    hd('剛才 A、B 只是 m = 2 的情形', 0, 3.6);
    cap('只是把 A、B 推廣成 A₁ … A_m', '');
  },
]);

const MX = (j) => -3.4 + j * 1.25, MY = (i) => 4.2 - i * 0.78;
scene('acC-cnt-mult', '15C：回到例子 — 乘開一次全部算出來', [
  async (tok, S) => { // 1005.8
    S.h = card('手算：g₀ … g₅ = 0, 0, 1, 2, 3, 3', C.gray, 0, 6.35, 5.4); glow(S.h, HL);
    cap('回到剛才的例子', 'A = {0,1,2,3,4}、B = {2,3,4}');
  },
  async (tok, S) => { // 1040.0
    glow(S.h, null);
    S.ga = card('G_A = 1 + x + x² + x³ + x⁴', C.sky, -2.9, 5.55, 5); glow(S.ga, HL);
    S.ra = SA.map((a, i) => tile(XP[a], C.sky, -5.0, MY(i), 0.7));
    cap('A 集合的生成函數', '每個元素取 x 次方加起來');
  },
  async (tok, S) => { // 1100.9
    glow(S.ga, null);
    S.gb = card('G_B = x² + x³ + x⁴', C.peach, 3.2, 5.55, 4); glow(S.gb, HL);
    S.cb = SB.map((b, j) => tile(XP[b], C.peach, MX(j), 4.95, 0.7));
    cap('B 集合的生成函數', 'x² + x³ + x⁴');
  },
  async (tok, S) => { // 1106.6
    glow(S.gb, null);
    S.cell = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const e = SA[i] + SB[j];
      const m = tile(XP[e], C.gray, MX(j), MY(i), 0.7); m.userData.e = e; S.cell.push(m);
      await wt(tok, 110);
    }
    cap('兩個相乘：每一格 = 左 × 上', '都是有限項，直接乘開');
  },
  async (tok, S) => { // 1159.1
    const col = { 2: C.blue, 3: C.green, 4: C.orange, 5: C.purple, 6: C.pink, 7: C.teal, 8: C.gold };
    S.cell.forEach((m) => tint(m, col[m.userData.e]));
    S.poly = card('= x² + 2x³ + 3x⁴ + 3x⁵ + 3x⁶ + 2x⁷ + x⁸', C.mint, 0, 0.1, 7.6); glow(S.poly, OKG);
    cap('同次方的格子數一數', 'x² + 2x³ + 3x⁴ + 3x⁵ + 3x⁶ + 2x⁷ + x⁸');
  },
  async (tok, S) => { // 1177.6
    glow(S.poly, null);
    const v = [0, 0, 1, 2, 3, 3, 3, 2, 1];
    S.g = v.map((x, i) => tile(x, C.lemon, 0.5 + i * 0.72, 3.0, 0.6));
    slotRow(['g₀', 'g₁', 'g₂', 'g₃', 'g₄', 'g₅', 'g₆', 'g₇', 'g₈'], 0.5, 0.72, 2.4);
    sm('之後都是 0', 3.4, 1.85);
    cap('每個 gₙ 都知道了', 'g₀ … g₈ = 0, 0, 1, 2, 3, 3, 3, 2, 1');
  },
  async (tok, S) => { // 1190.1
    for (let i = 0; i <= 5; i++) glow(S.g[i], OKG);
    glow(S.h, OKG); relab(S.h, '手算 g₀ … g₅ = 0, 0, 1, 2, 3, 3 ✓ 一樣');
    cap('跟手算的一樣', '但一次全部算出來');
  },
  async (tok, S) => { // 1218.4
    good('只是機械式地乘開；這一類問題都可以這樣做', 0, -0.7);
    cap('這類問題都可以這樣做', '集合怎麼變都照樣做');
  },
]);

// ════════ ghXHy5y3EuE（趙啟超 15D：z₁ + ⋯ + z_m = n 的非負整數解、加上下限的例子） ════════
scene('acC-cnt-rep', '15D：z₁ + ⋯ + z_m = n — 用生成函數重算重複組合', [
  async (tok, S) => { // 4.5
    S.t = card('再一個例子（以前算過，用生成函數再算一次）', C.lilac, 0, 6.35); glow(S.t, HL);
    cap('再看一個例子', '答案當然一樣');
  },
  async (tok, S) => { // 30.0
    glow(S.t, null);
    S.q = card('z₁ + z₂ + ⋯ + z_m = n 的非負整數解有幾組？', C.sky, 0, 5.6); glow(S.q, HL);
    cap('非負整數解有幾組', '');
  },
  async (tok, S) => { // 46.2
    glow(S.q, null);
    S.old = card('以前：重複組合 —— × × │ × │ ⋯ 排 × 和柵欄', C.gray, -2.6, 4.7, 7.2);
    cap('以前用 × 和柵欄去想', '重複組合數');
  },
  async (tok, S) => { // 54.4
    S.nw = card('現在：生成函數 → 直接算', C.mint, 4.2, 4.7, 3.8); glow(S.nw, OKG);
    cap('現在直接用生成函數', '很機械式，不必特別去想');
  },
  async (tok, S) => { // 78.6
    glow(S.nw, null);
    S.A = card('套框架：zᵢ ∈ Aᵢ，每個 Aᵢ = {0, 1, 2, 3, …}', C.sky, 0, 3.8); glow(S.A, HL);
    cap('A₁、A₂ … A_m 都一樣', '都是所有的非負整數');
  },
  async (tok, S) => { // 147.4
    glow(S.A, null);
    S.g1 = card('G_{Aᵢ}(x) = x⁰ + x¹ + x² + ⋯ = 1/(1 − x)', C.mint, 0, 2.95); glow(S.g1, OKG);
    cap('每個集合的生成函數', '只要算一次：1/(1 − x)');
  },
  async (tok, S) => { // 184.1
    glow(S.g1, null);
    S.G = card('G(x) = [1/(1 − x)]ᵐ = (1 − x)⁻ᵐ', C.lemon, 0, 2.1, 6); glow(S.G, OKG);
    cap('m 個乘在一起', 'G(x) = (1 − x) 的 −m 次方');
  },
  async (tok, S) => { // 255.4
    glow(S.G, null);
    S.L = chain(0, 1.25, 0.7);
    S.L.add('extended binomial theorem：= Σₙ C(−m, n)(−x)ⁿ');
    cap('用 extended binomial theorem 展開', '');
  },
  async (tok, S) => { // 316.2
    S.L.add('C(−m, n) = (−1)ⁿ C(m + n − 1, n)；(−1)ⁿ·(−1)ⁿ = 1', C.lilac);
    cap('C(−m, n) 前面算過', '負號提出來，兩個 (−1)ⁿ 相乘消失');
  },
  async (tok, S) => { // 362.4
    const m = S.L.add('gₙ = C(m + n − 1, n)', C.lemon); glow(m, OKG);
    cap('xⁿ 的係數', 'gₙ = C(m + n − 1, n)');
  },
  async (tok, S) => { // 394.4
    note('示意 m = 3：gₙ = C(n + 2, n) = 1, 3, 6, 10, 15, …', 0, -0.95);
    cap('= 從 m 種可重複、不計順序選 n 個', '跟以前算的一模一樣');
  },
  async (tok, S) => { // 421.5
    good('不必想 × 和柵欄，只是正著算、反著算', 0, -1.6);
    cap('過程不必去想那些麻煩的事', '就是生成函數的計算');
  },
]);

const NVX = (v) => -6.0 + v * 0.4;
const ROWS = [
  { n: 'z₁ ≥ 0', ok: (v) => v >= 0, more: true, gf: 'A₁：1 + x + x² + ⋯ = 1/(1 − x)' },
  { n: '4 ≤ z₂ ≤ 7', ok: (v) => v >= 4 && v <= 7, more: false, gf: 'A₂：x⁴ + x⁵ + x⁶ + x⁷' },
  { n: '2 ≤ z₃ ≤ 6', ok: (v) => v >= 2 && v <= 6, more: false, gf: 'A₃：x² + x³ + x⁴ + x⁵ + x⁶' },
  { n: 'z₄ ≥ 13', ok: (v) => v >= 13, more: true, gf: 'A₄：x¹³ + x¹⁴ + ⋯ = x¹³/(1 − x)' },
];
const RY = (i) => 4.5 - i * 0.85;
scene('acC-cnt-bounds', '15D：z₁ + z₂ + z₃ + z₄ = n 加上下限', [
  async (tok, S) => { // 440.7
    S.t = card('好處：不管 Aᵢ 長什麼樣，方法都一樣', C.lilac, 0, 6.35); glow(S.t, HL);
    cap('生成函數的方便', 'Aᵢ 不同，直接算的話要一直想');
  },
  async (tok, S) => { // 493.5
    glow(S.t, null);
    S.q = card('z₁ + z₂ + z₃ + z₄ = n 的非負整數解，但有限制', C.sky, 0, 5.55); glow(S.q, HL);
    cap('故意加一些限制', '');
  },
  async (tok, S) => { // 531.8
    glow(S.q, null);
    S.rows = ROWS.map((r, i) => {
      sm(r.n, -6.6, RY(i) + 0.4);
      const ts = [];
      for (let v = 0; v <= 15; v++) { const m = tile(v, r.ok(v) ? [C.blue, C.green, C.orange, C.purple][i] : '#efe8dc', NVX(v), RY(i), 0.34); ts.push(m); }
      if (r.more) sm('⋯', 0.5, RY(i));
      return ts;
    });
    cap('z₁ ≥ 0、4 ≤ z₂ ≤ 7', '2 ≤ z₃ ≤ 6、z₄ ≥ 13');
  },
  async (tok, S) => { // 568.1
    bad('直接算：不同的 n 要分好多 case', 3.8, 5.0);
    cap('直接算有點麻煩', '用生成函數就很簡單');
  },
  async (tok, S) => { // 589.5
    S.gf = [];
    const add = (i) => { const m = card(ROWS[i].gf, C.mint, 3.9, RY(i), 5.6); glow(m, OKG); S.gf.forEach((o) => glow(o, null)); S.gf.push(m); S.rows[i].forEach((t) => { if (ROWS[i].ok(+t.userData.lbl.element.textContent)) glow(t, HL); }); };
    S.add = add; add(0);
    cap('A₁：所有非負整數', '1/(1 − x)');
  },
  async (tok, S) => { // 599.7
    S.rows[0].forEach((t) => glow(t, null)); S.add(1);
    cap('A₂ = {4, 5, 6, 7}', 'x⁴ + x⁵ + x⁶ + x⁷');
  },
  async (tok, S) => { // 610.7
    S.rows[1].forEach((t) => glow(t, null)); S.add(2);
    cap('A₃ = {2, 3, 4, 5, 6}', 'x² + ⋯ + x⁶');
  },
  async (tok, S) => { // 621.8
    S.rows[2].forEach((t) => glow(t, null)); S.add(3);
    cap('A₄ = {13, 14, 15, …}', '提出 x¹³，剩 1/(1 − x)');
  },
  async (tok, S) => { // 719.7
    S.rows[3].forEach((t) => glow(t, null)); dark(S.gf);
    S.P = card('G(x) = x¹⁹ (1 + x + x² + x³)(1 + x + x² + x³ + x⁴) / (1 − x)²', C.lemon, 0, 0.75); glow(S.P, OKG);
    cap('四個乘起來，能提的提出來', 'x⁴·x²·x¹³ = x¹⁹');
  },
  async (tok, S) => { // 757.4
    glow(S.P, null);
    hd('後面：乘開分子 → 除法 → partial fraction → 反回去（機械式，不算了）', 0, 0.0);
    cap('後面只是展開', '一定做得出來，只是麻煩一點');
  },
  async (tok, S) => { // 829.8
    note('示意（電腦逐一數過）：g₁₉ = 1、g₂₀ = 4、g₂₁ = 10；n < 19 時 0', 0, -0.65);
    cap('重點是把生成函數算出來', '後面展開不是問題');
  },
  async (tok, S) => { // 850.6
    good('一次把所有 gₙ 算出來，反而比一個一個算容易', 0, -1.3);
    cap('直接算要考慮好多 case', '生成函數一次全部搞定');
  },
]);
  }

  // ═══ acD.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 離散數學 第 6 章（清大 趙啟超 第16A–17D講）— cued scenes ───
// 換零錢的生成函數、整數分割 p(n)、Euler 五邊形數定理與 p(n) 的遞迴、distinct = odd、Ferrers 圖與 transpose、
// 演算法複雜度（時間表、Big-O）、bubble sort 與 insertion sort。
// 每個 scene 是一串 step；每個 step 等老師說到那句話（notes 的 cues）才動一下，不重播、不循環。
// 老師的例子（100¢、56¢、p(3)、p(4)、p(5)、8 的分割、14 = 4+3+3+2+1+1、n = 20/40/60、47 73 21 45 28 69 19 23）照用；
// 畫面上的係數、p(n)、時間都由程式算（多半算兩種方法互相比對，顯示 ✓／✘）；老師沒給的數字標「示意」。
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
const ok = (b, x, y, t) => (b ? good(t || '✓', x, y) : bad(t ? t.replace('✓', '✘') : '✘', x, y));
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', pink: '#e55a9b', teal: '#31aab0', red: '#d64545', sand: '#e9dcc4', gray: '#d8cfc0', gold: '#c08a1f', mint: '#d2f1e6', sky: '#cfe6f7', lilac: '#dfd3fb', peach: '#f6d3b8' };
const HL = '#6a4a00', NG = '#5a1010';
const PAL = ['#4b9ee2', '#e55a9b', '#2fc092', '#dd8238', '#9b7ef4', '#31aab0', '#c08a1f', '#5c7a4a'];
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.all) return gone(o.all); if (o.element) remove(o); else kill(o); });
const card = (t, c, x, y, w = 4, h = 0.55, drop = 0.8) => cube(t, c, [w, h, 0.45], x, y, 0, drop);
const relab = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, t); };
const SUPM = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ', k: 'ᵏ', m: 'ᵐ', i: 'ⁱ' };
const SUBM = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', n: 'ₙ', j: 'ⱼ', i: 'ᵢ' };
const sp = (s) => String(s).split('').map((c) => SUPM[c] || c).join('');
const sb = (s) => String(s).split('').map((c) => SUBM[c] || c).join('');
const xp = (e) => (e === 0 ? '1' : e === 1 ? 'x' : 'x' + sp(e));
function scene(id, title, steps, cam) {
  FRAG.push([id, title, async (tok) => {
    const c = cam || CAM; fresh(c[0], c[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 3.6, 15], [0, 3.1, 0]];
// ── formal power series (coefficient arrays up to x^N) ──
const zeros = (N) => Array(N + 1).fill(0);
function pmul(a, b, N) { const c = zeros(N); for (let i = 0; i <= N; i++) if (a[i]) for (let j = 0; i + j <= N; j++) if (b[j]) c[i + j] += a[i] * b[j]; return c; }
function geo(k, N, lo = 0, hi = Infinity) { const a = zeros(N); for (let e = lo; e <= hi && e * k <= N; e++) a[e * k] = 1; return a; } // Σ x^{ek}, lo ≤ e ≤ hi
function lin(terms, N) { const a = zeros(N); for (const [e, c] of terms) if (e <= N) a[e] += c; return a; }
const prod = (fs, N) => fs.reduce((acc, f) => pmul(acc, f, N), lin([[0, 1]], N));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const same = (a, b, n0, n1) => range(n0, n1).every((i) => a[i] === b[i]);
// polynomial text: "1 − x − x² + x⁵ …"
function pstr(a, maxDeg, more = true) {
  let s = '';
  for (let e = 0; e <= maxDeg && e < a.length; e++) {
    const c = a[e]; if (!c) continue; const mag = Math.abs(c);
    const body = e === 0 ? String(mag) : (mag === 1 ? '' : mag) + xp(e);
    s += s ? (c < 0 ? ' − ' : ' + ') + body : (c < 0 ? '−' : '') + body;
  }
  return (s || '0') + (more ? ' ⋯' : '');
}
// ── integer partitions ──
function parts(n, max = n) { if (n === 0) return [[]]; const o = []; for (let k = Math.min(n, max); k >= 1; k--) for (const r of parts(n - k, k)) o.push([k, ...r]); return o; }
const isDistinct = (p) => p.every((v, i) => i === 0 || v !== p[i - 1]);
const isOdd = (p) => p.every((v) => v % 2 === 1);
const pj = (p) => p.join(' + ');
const sameList = (A, B) => A.length === B.length && A.every((p, i) => pj(p) === pj(B[i]));
const conj = (p) => range(1, p[0] || 0).map((c) => p.filter((v) => v >= c).length);
const pent = (m) => (m * (3 * m - 1)) / 2;   // m → (3m² − m)/2 ; pent(−m) = (3m² + m)/2
// p(n) from Euler's recurrence
function pRec(N) {
  const p = [1];
  for (let n = 1; n <= N; n++) { let s = 0; for (let m = 1; pent(m) <= n; m++) { const sg = m % 2 ? 1 : -1; s += sg * (p[n - pent(m)] + (pent(-m) <= n ? p[n - pent(-m)] : 0)); } p[n] = s; }
  return p;
}
// p(n) from the product ∏ 1/(1 − x^k)
const pProd = (N) => prod(range(1, N).map((k) => geo(k, N)), N);
// the denominator ∏(1 − x^k) up to x^N
const euler = (N) => prod(range(1, N).map((k) => lin([[0, 1], [k, -1]], N)), N);
// a partition drawn as a bar of blocks (block width ∝ part)
function prow(ps, x0, y, u = 0.45, c, drop = 0.6) {
  let off = 0;
  return ps.map((k, i) => { const m = cube(String(k), c || PAL[(k - 1) % PAL.length], [k * u - 0.06, 0.42, 0.42], x0 + (off + k / 2) * u, y, 0, drop); off += k; return m; });
}
// Ferrers diagram: one row of dots per part, left aligned, largest on top
const DOT = new THREE.SphereGeometry(0.13, 14, 10);
function dot(x, y, c) { const m = new THREE.Mesh(DOT, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); m.position.set(x, y, 0); lab.world.add(m); return m; }
function ferrers(ps, x0, y0, s = 0.42, c = FC.blue) { const rows = ps.map((k, r) => range(0, k - 1).map((j) => dot(x0 + j * s, y0 - r * s, c))); return { rows, all: rows.flat(), x0, y0, s }; }
const paint = (m, c) => m.material.color.set(c);
// a coin facing the camera
function coin(t, c, r, x, y) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 32), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.3 }));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, 0);
  const l = lab.label(t, 'val'); l.position.set(0, 0.12, 0); m.add(l); lab.world.add(m); return m;
}
// coefficient rack: cubes with the power of x above each
function rack(vals, x0, y, dx = 0.8, c = FC.blue, label = '') {
  const all = []; if (label) all.push(sm(label, x0 - 1.3, y));
  const cells = vals.map((v, i) => cube(v < 0 ? '−' + Math.abs(v) : String(v), v < 0 ? FC.pink : v > 0 ? c : FC.gray, [0.64, 0.5, 0.45], x0 + i * dx, y, 0, 0.5));
  vals.forEach((v, i) => all.push(sm(xp(i), x0 + i * dx, y + 0.5)));
  all.push(...cells); return { all, cells };
}
async function slide(tok, o, x, y, ms = 500) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, 0), ms); }
async function moveMany(tok, list, ms = 700) { const from = list.map(([o]) => o.position.clone()); await anim(tok, ms, (u) => list.forEach(([o, x, y], i) => { o.position.x = from[i].x + (x - from[i].x) * u; o.position.y = from[i].y + (y - from[i].y) * u; })); }

// ════════ 0aAQE0u0Dq0（趙啟超 16A：換零錢、partition of integers 的生成函數） ════════
const COINS = [['penny', 1, '#b87333', 0.36], ['nickel', 5, '#b9bec4', 0.46], ['dime', 10, '#c9ced4', 0.33], ['quarter', 25, '#d4d8dc', 0.56]];
const CV = [1, 5, 10, 25];
// number of ways to change n cents (dynamic programming) and a brute-force recount
function changeDP(n, vals) { const w = zeros(n); w[0] = 1; for (const v of vals) for (let s = v; s <= n; s++) w[s] += w[s - v]; return w; }
function changeBrute(n) { let c = 0; for (let d = 0; 25 * d <= n; d++) for (let q = 0; 25 * d + 10 * q <= n; q++) for (let b = 0; 25 * d + 10 * q + 5 * b <= n; b++) c++; return c; }
function comboRow(cnt, vals, names, unit, target, y) {
  const segs = []; let sum = 0;
  for (let i = vals.length - 1; i >= 0; i--) if (cnt[i]) { segs.push(cnt[i] + ' 個 ' + names[i]); sum += cnt[i] * vals[i]; }
  return [pl(segs.join(' + '), -1.2, y), ok(sum === target, 4.9, y, '= ' + sum + unit + ' ✓')];
}

scene('acD-coin-setup', '16A：換零錢——n 分錢有幾種換法？', [
  async (tok, S) => { // @3.8
    hot('用 generating function 來數（enumeration）', 0, 7.2); cap('上次：用生成函數數「有幾種方法」', '再講最後一個例子');
  },
  async (tok, S) => { // @5.4
    hd('換零錢：n 分錢（n cents）有幾種換法？', 0, 6.4); cap('例子：換零錢的問題', 'number of ways to change n cents');
  },
  async (tok, S) => { // @76.6
    S.c = []; S.c[0] = coin('1¢', COINS[0][2], COINS[0][3], -4.5, 5.0); sm('penny：1 分', -4.5, 4.2); cap('美金硬幣 penny：1 分錢', '樣子很像台幣一塊');
  },
  async (tok, S) => { // @97.6
    S.c[1] = coin('5¢', COINS[1][2], COINS[1][3], -1.5, 5.0); sm('nickel：5 分', -1.5, 4.2); cap('nickel：5 分錢', '大小跟台幣五塊差不多');
  },
  async (tok, S) => { // @105.3
    S.c[2] = coin('10¢', COINS[2][2], COINS[2][3], 1.5, 5.0); sm('dime：10 分', 1.5, 4.2); cap('dime：10 分錢', '銀色、比 nickel 還小');
  },
  async (tok, S) => { // @118.9
    S.c[3] = coin('25¢', COINS[3][2], COINS[3][3], 4.5, 5.0); sm('quarter：25 分', 4.5, 4.2); cap('quarter：25 分（quarter dollar）', '四分之一塊美金');
  },
  async (tok, S) => { // @135.7
    S.ask = bub('n 分錢 → 換成這四種硬幣，一共幾種換法？', 0, 3.4); cap('問：n 分錢有幾種換法？', '每種硬幣個數不限');
  },
  async (tok, S) => { // @148.3
    gone(S.ask); hd('例：n = 100（一塊錢 = 100¢）', -3.4, 3.3);
    S.rows = [comboRow([0, 0, 0, 4], CV, COINS.map((c) => c[0]), '¢', 100, 2.5)]; cap('例：100¢ 換成 4 個 quarter', '25 × 4 = 100');
  },
  async (tok, S) => { // @159.1
    S.rows.push(comboRow([0, 1, 2, 3], CV, COINS.map((c) => c[0]), '¢', 100, 1.8)); cap('或 3 quarter + 2 dime + 1 nickel', '75 + 20 + 5 = 100');
  },
  async (tok, S) => { // @162.6
    S.rows.push(comboRow([100, 0, 0, 0], CV, COINS.map((c) => c[0]), '¢', 100, 1.1)); cap('或者 100 個 penny', '每種換法都算一種');
  },
  async (tok, S) => { // @164.7
    S.rows.push(comboRow([10, 2, 3, 2], CV, COINS.map((c) => c[0]), '¢', 100, 0.4)); cap('或 2Q + 3D + 2N + 10P', '50 + 30 + 10 + 10 = 100');
  },
  async (tok, S) => { // @194.1
    gone(S.rows); S.rows = [];
    hd('台幣也一樣：100 元換成 50、10、5、1 元硬幣', 0, 2.6);
    const TV = [1, 5, 10, 50], TN = ['1 元', '5 元', '10 元', '50 元'];
    S.rows.push(comboRow([0, 0, 0, 2], TV, TN, ' 元', 100, 1.9), comboRow([0, 0, 10, 0], TV, TN, ' 元', 100, 1.2), comboRow([100, 0, 0, 0], TV, TN, ' 元', 100, 0.5), comboRow([10, 0, 9, 0], TV, TN, ' 元', 100, -0.2));
    cap('像台幣 100 元換零錢', '兩個 50、十個 10、九個 10 加十個 1…');
  },
  async (tok, S) => { // @246.1
    note('直接數不容易：每個 n 的情況都不一樣 → 要對一般的 n 求答案', 0, -1.0); cap('直接算不容易', '要的是一般 n 的答案');
  },
]);

scene('acD-coin-gf', '16A：換零錢的生成函數 G(x)', [
  async (tok, S) => { // @256.8
    hot('換零錢：還是用 generating function', 0, 7.2); cap('一樣用生成函數', '其實一下就算出來');
  },
  async (tok, S) => { // @264.5
    hd('gₙ = n 分錢的換法數　　G(x) = Σ gₙ xⁿ', 0, 6.4); cap('把換法數叫 gₙ', '直接算它的生成函數 G(x)');
  },
  async (tok, S) => { // @320.7
    S.ic = COINS.map((c, i) => { const m = coin(c[1] + '¢', c[2], 0.3, -5.1 + i * 3.4, 5.4); return m; });
    S.k = COINS.map((c, i) => sm(c[0] + '：每個貢獻 ' + c[1], -5.1 + i * 3.4, 4.75)); cap('每種硬幣的貢獻不一樣', 'penny 1 分，quarter 25 分');
  },
  async (tok, S) => { // @342.1
    S.f = []; S.f[0] = card('1 + x + x² + x³ + ⋯', FC.peach, -5.1, 4.0, 3.1); cap('penny 的部分：1 + x + x² + ⋯', '0 個、1 個、2 個…');
  },
  async (tok, S) => { // @355.5
    glow(S.f[0], HL); S.n0 = sm('選 x² ⇔ 用 2 個 penny（每個指數 +1）', -4.3, 3.3); cap('選到 x² 就是用了兩個 penny', '一個 penny 指數貢獻 1');
  },
  async (tok, S) => { // @367.3
    glow(S.f[0], null); S.f[1] = card('1 + x⁵ + x¹⁰ + ⋯', FC.sky, -1.7, 4.0, 3.1); glow(S.f[1], HL); S.n1 = sm('每個 nickel 指數 +5', -0.6, 2.75);
    cap('nickel：1 + x⁵ + x¹⁰ + ⋯', '一個 nickel 貢獻 5');
  },
  async (tok, S) => { // @402.6
    glow(S.f[1], null); gone(S.n0, S.n1);
    S.f[2] = card('1 + x¹⁰ + x²⁰ + ⋯', FC.sky, 1.7, 4.0, 3.1); S.f[3] = card('1 + x²⁵ + x⁵⁰ + ⋯', FC.lilac, 5.1, 4.0, 3.1);
    sm('×', -3.4, 4.0); sm('×', 0, 4.0); sm('×', 3.4, 4.0); cap('dime 貢獻 10、quarter 貢獻 25', 'G(x) 就是四個乘起來');
  },
  async (tok, S) => { // @422.5
    S.tt = pl('乘開的一項：xᵃ · x⁵ᵇ · x¹⁰ᶜ · x²⁵ᵈ', 0, 2.9); S.tt2 = sm('a 個 penny、b 個 nickel、c 個 dime、d 個 quarter', 0, 2.35);
    cap('乘開的每一項：xᵃ·x⁵ᵇ·x¹⁰ᶜ·x²⁵ᵈ', 'a、b、c、d 是各幾個');
  },
  async (tok, S) => { // @457.0
    const pick = [1, 10, 20, 25]; const sum = pick.reduce((a, b) => a + b, 0);
    S.pk = pick.map((e, i) => { glow(S.f[i], HL); return hot(xp(e), -5.1 + i * 3.4, 3.35); });
    S.r1 = ok(sum === 56, 0, 1.6, 'x¹ · x¹⁰ · x²⁰ · x²⁵ = x⁵⁶（1 + 10 + 20 + 25 = ' + sum + '）✓'); cap('例如挑 x、x¹⁰、x²⁰、x²⁵', '乘起來是 x⁵⁶');
  },
  async (tok, S) => { // @493.1
    const cnt = [1, 2, 2, 1]; const tot = cnt.reduce((s, c, i) => s + c * CV[i], 0);
    S.r2 = ok(tot === 56, 0, 1.0, '⇒ 56¢ = 1 個 penny + 2 個 nickel + 2 個 dime + 1 個 quarter ✓'); cap('這代表 56¢ 的一種換法', '1 penny、2 nickel、2 dime、1 quarter');
  },
  async (tok, S) => { // @506.0
    S.f.forEach((f) => glow(f, null)); gone(S.pk);
    S.r3 = good('每一種乘出 xⁿ 的選法 = 一種換法 → 對 xⁿ 的係數貢獻 1 ⇒ 係數就是 gₙ', 0, 0.35); cap('每種選法對係數貢獻 1', '所以 xⁿ 的係數 = gₙ');
  },
  async (tok, S) => { // @571.3
    gone(S.tt, S.tt2, S.r1, S.r2, S.r3);
    ['1/(1 − x)', '1/(1 − x⁵)', '1/(1 − x¹⁰)', '1/(1 − x²⁵)'].forEach((t, i) => relab(S.f[i], t));
    S.cf = hot('G(x) = 1 / [(1 − x)(1 − x⁵)(1 − x¹⁰)(1 − x²⁵)]', 0, 2.9); sm('（1 + y + y² + ⋯ = 1/(1 − y)，公比 y = x、x⁵、x¹⁰、x²⁵）', 0, 2.35);
    cap('整理：G(x) = 1/[(1−x)(1−x⁵)(1−x¹⁰)(1−x²⁵)]', '每個都是等比級數');
  },
  async (tok, S) => { // @598.1
    const N = 100, G = prod(CV.map((v) => geo(v, N)), N), D = changeDP(N, CV);
    S.rk = rack(G.slice(0, 13), -4.6, 1.0, 0.8, FC.blue, 'gₙ');
    const fine = same(G, D, 0, N) && G[100] === changeBrute(100);
    ok(fine, 0, -0.1, '剩下只是展開（程式展開驗算：g₁₀₀ = ' + G[100] + '，跟逐一數的結果相同）✓'); cap('剩下只是展開的問題', '展開到 xⁿ，係數就是 gₙ');
  },
  async (tok, S) => { // @655.8
    note('台幣：1/[(1 − x)(1 − x⁵)(1 − x¹⁰)(1 − x⁵⁰)]——只把 25 換成 50', 0, -0.8); cap('換成台幣：25 改成 50 就好', '1、5、10、50 元');
  },
]);

scene('acD-coin-limit', '16A：硬幣個數有限制時', [
  async (tok, S) => { // @743.1
    hot('變化：硬幣個數有限制', 0, 7.2);
    sm('penny（個數不限）', -4.4, 6.2); S.a = card('1 + x + x² + x³ + ⋯', FC.peach, 1.2, 6.2, 5.2);
    sm('一定要 2 個 penny', -4.4, 5.0); S.b = card('x²（這部分固定，先扣掉 2¢）', FC.sky, 1.2, 5.0, 5.2); glow(S.b, HL);
    cap('一定要 2 個 penny：那部分固定', '先扣掉，只看剩下的');
  },
  async (tok, S) => { // @760.5
    glow(S.b, null);
    sm('penny 2～10 個', -4.4, 3.8); S.c = card(range(2, 10).map(xp).join(' + '), FC.mint, 1.2, 3.8, 5.6); glow(S.c, HL);
    cap('如果是 2 到 10 個', '就只乘 x² + x³ + ⋯ + x¹⁰');
  },
  async (tok, S) => { // @775.8
    glow(S.c, null); note('不限 = 所有可能都乘進去；有範圍 → 只乘那段範圍的項', 0, 2.6); cap('全部可能就整串都乘', '有範圍就只乘那個範圍');
  },
  async (tok, S) => { // @785.8
    good('看懂「乘開的每一項是什麼意思」，這些變化都不是問題', 0, 1.6); cap('看懂乘開的意思', '各種變化都會');
  },
]);

scene('acD-part-small', '16A：Partition of integers——p(3) = 3、p(4) = 5', [
  async (tok, S) => { // @798.5
    hot('Partition of integers（整數分割）', 0, 7.2); cap('下一個主題：partition of integers', '很早就被研究過');
  },
  async (tok, S) => { // @815.5
    hd('把 3 分割（每一份都是正整數）', -3.6, 6.3); prow([3], -5.6, 5.4); sm('一份：3', -1.6, 5.4); cap('例：把 3 分割', '分成一份：就是 3');
  },
  async (tok, S) => { // @835.7
    prow([2, 1], -5.6, 4.6); sm('兩份：2 + 1', -1.6, 4.6); cap('分成兩份：一個 2、一個 1', '');
  },
  async (tok, S) => { // @846.6
    S.n = note('1 + 2 跟 2 + 1 一樣（順序不算）', -3.6, 3.95); cap('2 + 1 跟 1 + 2 是同一種', '順序不影響');
  },
  async (tok, S) => { // @854.3
    gone(S.n); prow([1, 1, 1], -5.6, 3.8); sm('三份：1 + 1 + 1', -1.6, 3.8);
    ok(parts(3).length === 3, -3.6, 3.0, '3 有 3 種分法 ✓'); cap('分成三份：三個 1', '所以 3 有三種分法');
  },
  async (tok, S) => { // @875.6
    hd('把 4 分割', 3.4, 6.3); prow([4], 1.4, 5.4); sm('一份：4', 5.8, 5.4); cap('再看 4', '只分一份：4');
  },
  async (tok, S) => { // @887.3
    prow([3, 1], 1.4, 4.6); sm('3 + 1', 5.8, 4.6); cap('兩份：一個 3、一個 1', '1 + 3 是同一個');
  },
  async (tok, S) => { // @907.8
    prow([2, 2], 1.4, 3.8); sm('2 + 2', 5.8, 3.8); cap('兩份還有：兩個 2', '0 不算，要正整數');
  },
  async (tok, S) => { // @927.0
    prow([2, 1, 1], 1.4, 3.0); sm('2 + 1 + 1', 5.8, 3.0); cap('三份：2 + 1 + 1', '');
  },
  async (tok, S) => { // @931.1
    prow([1, 1, 1, 1], 1.4, 2.2); sm('1 + 1 + 1 + 1', 5.8, 2.2); cap('四份：四個 1', '');
  },
  async (tok, S) => { // @951.9
    ok(parts(4).length === 5, 3.4, 1.4, '4 有 5 種分法 ✓'); cap('所以 4 有五種分法', '3 有三種、4 有五種');
  },
  async (tok, S) => { // @997.3
    hd('p(n) = the number of ways to partition n', 0, 0.5); sm('p(3) = 3、p(4) = 5（n 是正整數）', 0, -0.05); cap('定義 p(n)：把 n 分割的方法數', '要算一般的 p(n)');
  },
  async (tok, S) => { // @1038.7
    note('直接數不容易：n = 6 就更麻煩了', 0, -0.7); cap('直接數很麻煩', 'n 一大就數不完');
  },
]);

scene('acD-part-gf', '16A：p(n) 的生成函數 P(x) = ∏ 1/(1 − xᵏ)', [
  async (tok, S) => { // @1070.1
    hot('p(n) 的生成函數', 0, 7.2); cap('還是用生成函數算 p(n)', '');
  },
  async (tok, S) => { // @1089.6
    sm('定義 p(0) = 1（為了常數項方便）', -3.6, 6.4); cap('先定義 p(0) = 1', '只是為了方便');
  },
  async (tok, S) => { // @1114.4
    hd('P(x) = Σ p(n)xⁿ（n ≥ 0）', 3.0, 6.4); cap('P(x) = Σ p(n) xⁿ', '');
  },
  async (tok, S) => { // @1154.8
    const L = [['4', 'k₄ = 1'], ['3 + 1', 'k₃ = 1、k₁ = 1'], ['2 + 2', 'k₂ = 2'], ['2 + 1 + 1', 'k₂ = 1、k₁ = 2'], ['1 + 1 + 1 + 1', 'k₁ = 4']];
    S.tb = L.map(([a, b], i) => [pl(a, -5.4, 3.5 - i * 0.55), sm(b, -3.0, 3.5 - i * 0.55)]);
    S.th = sm('4 的分法：幾個 1、幾個 2、幾個 3、幾個 4', -4.2, 4.0); cap('看每種分法有幾個 1、2、3…', '加起來要等於 n');
  },
  async (tok, S) => { // @1189.4
    S.f = []; S.f[0] = card('1 + x + x² + x³ + ⋯', FC.peach, -5.0, 5.3, 2.8); sm('1 的部分', -5.0, 4.75); cap('1 的部分：1 + x + x² + ⋯', '沒有 1、一個 1、兩個 1…');
  },
  async (tok, S) => { // @1206.4
    S.f[1] = card('1 + x² + x⁴ + x⁶ + ⋯', FC.sky, -1.9, 5.3, 2.8); sm('2 的部分', -1.9, 4.75); cap('2 的部分：1 + x² + x⁴ + ⋯', '一個 2、兩個 2…');
  },
  async (tok, S) => { // @1228.5
    S.f[2] = card('1 + x³ + x⁶ + x⁹ + ⋯', FC.mint, 1.2, 5.3, 2.8); sm('3 的部分', 1.2, 4.75); cap('3 的部分：1 + x³ + x⁶ + ⋯', '');
  },
  async (tok, S) => { // @1237.7
    S.f[3] = card('1 + x⁴ + x⁸ + ⋯', FC.lilac, 4.3, 5.3, 2.6); sm('4 的部分', 4.3, 4.75); cap('4 的部分：1 + x⁴ + x⁸ + ⋯', '');
  },
  async (tok, S) => { // @1254.6
    S.dots = hot('⋯', 6.3, 5.3); sm('一直乘下去', 6.2, 4.75); cap('一直乘下去', 'n 可以很大，所以要全部');
  },
  async (tok, S) => { // @1285.8
    note('先不管收不收斂（形式上的 power series）', 2.6, 4.2); cap('不管收不收斂', '');
  },
  async (tok, S) => { // @1314.4
    pl('xᵏ¹ · x²ᵏ² · x³ᵏ³ · x⁴ᵏ⁴ ⋯ = xⁿ', 2.6, 3.4); pl('⇔ n = k₁ + 2k₂ + 3k₃ + 4k₄ + ⋯', 2.6, 2.8);
    S.tb[3].forEach((l) => { l.element.className = 'lab-label ptr alt'; });
    const ex = 2 * 1 + 1 * 2; ok(ex === 4, 2.6, 2.2, '例 2 + 1 + 1：k₁ = 2、k₂ = 1 → x² · x² = x⁴ ✓'); cap('乘開一項 = 一組 k₁, k₂, k₃…', 'n = k₁ + 2k₂ + 3k₃ + ⋯');
  },
  async (tok, S) => { // @1365.7
    const N = 10, A = pProd(N), B = range(0, N).map((n) => parts(n).length);
    ok(same(A, B, 0, N), 2.6, 1.5, 'xⁿ 的係數：' + A.slice(0, 8).join(', ') + ' ⋯ = p(n) ✓'); cap('每一組解貢獻 1', 'xⁿ 的係數就是 p(n)');
  },
  async (tok, S) => { // @1384.3
    ['1/(1 − x)', '1/(1 − x²)', '1/(1 − x³)', '1/(1 − x⁴)'].forEach((t, i) => relab(S.f[i], t));
    hot('P(x) = ∏ 1/(1 − xᵏ)（k = 1, 2, 3, …）', 0, 0.6); cap('寫成 P(x) = ∏ 1/(1 − xᵏ)', '一直乘到無窮');
  },
  async (tok, S) => { // @1423.5
    note('跟換零錢一模一樣，只是要乘到無窮', 0, -0.1); cap('跟換零錢一樣', '只是乘到無窮');
  },
]);

scene('acD-part-trunc', '16A：只算某一個 p(n)：乘到 1/(1 − xⁿ) 就夠', [
  async (tok, S) => { // @1433.4
    hot('無窮乘積怎麼辦？', 0, 7.2); pl('P(x) = 1/(1 − x) · 1/(1 − x²) · 1/(1 − x³) · ⋯', 0, 6.4); cap('乘到無窮，怎麼處理？', '');
  },
  async (tok, S) => { // @1465.3
    hd('如果只要算某一個 n（n 固定）', 0, 5.6); sm('示意：n = 4', 0, 5.05); cap('第一個觀察：只算某一個 n', '例如 n 固定');
  },
  async (tok, S) => { // @1498.9
    const N = 4, A = prod(range(1, N).map((k) => geo(k, N)), N);
    pl('只乘到 1/(1 − x⁴)：1/[(1 − x)(1 − x²)(1 − x³)(1 − x⁴)]', 0, 4.3);
    S.r1 = rack(A, -1.6, 3.2, 0.8, FC.blue, '係數');
    ok(A[4] === parts(4).length, 0, 2.3, 'x⁴ 的係數 = ' + A[4] + ' = p(4) ✓'); cap('乘到 1/(1 − xⁿ) 就好', '取 xⁿ 的係數就是 p(n)');
  },
  async (tok, S) => { // @1521.5
    const N = 6, B = prod(range(1, N).map((k) => geo(k, N)), N), A = prod(range(1, 4).map((k) => geo(k, 4)), 4);
    pl('多乘 1/(1 − x⁵)、1/(1 − x⁶)：', -3.4, 1.4);
    S.r2 = rack(B, -1.6, 0.6, 0.8, FC.teal, '');
    ok(same(A, B, 0, 4), 0, -0.3, 'x⁰～x⁴ 的係數都沒變 ✓（每一份都 ≤ n，不會大於 n）'); cap('多乘的因式不會貢獻到 xⁿ', '每一份不可能大於 n');
  },
  async (tok, S) => { // @1536.3
    good('只算某一個 n：有限個因式就能算出 p(n)', 0, -1.0); cap('只要某個 n，就這樣算', '');
  },
]);

scene('acD-part-denom', '16A：分母乘開：1 − x − x² + x⁵ + x⁷ − ⋯', [
  async (tok, S) => { // @1548.6
    hot('但完整的 P(x) 要乘到無窮：想要 efficient 的算法', 0, 7.2); cap('還是想知道完整的展開', '或有效率的算法');
  },
  async (tok, S) => { // @1579.0
    hd('先不管分子，看分母：(1 − x)(1 − x²)(1 − x³)(1 − x⁴) ⋯', 0, 6.4); cap('先把分母乘開', '');
  },
  async (tok, S) => { // @1587.3
    sm('只算前面幾項：例如算到 x⁷，(1 − x⁸) 以後都不會貢獻', 0, 5.8); cap('只算前幾項就好', '後面的次數太大，貢獻不到');
  },
  async (tok, S) => { // @1639.7
    const E = euler(30); S.E = E;
    hot('= ' + pstr(E, 26), 0, 4.9);
    S.rk = rack(E.slice(0, 16), -6.0, 3.6, 0.8, FC.blue, '');
    cap('乘開以後是這樣', '1 − x − x² + x⁵ + x⁷ − ⋯');
  },
  async (tok, S) => { // @1656.8
    const two = pmul(lin([[0, 1], [1, -1]], 3), lin([[0, 1], [2, -1]], 3), 3);
    ok(same(two, S.E, 0, 2), 0, 2.5, '只要到 x²：乘到 (1 − x²) 就夠——(1 − x)(1 − x²) = ' + pstr(two, 3, false) + '，前 3 項一樣 ✓');
    sm('要到 x⁵：最多乘到 (1 − x⁵)', 0, 1.9); cap('要算到 x²，乘到 1 − x² 就好', '每個有限項都算得出來');
  },
  async (tok, S) => { // @1676.1
    [1, 2, 12, 15].forEach((e) => glow(S.rk.cells[e], NG)); [5, 7].forEach((e) => glow(S.rk.cells[e], HL));
    sm('1 之後兩個一組：負、負，正、正，負、負…', 0, 1.2); cap('有規律：兩個一組', '兩個負、兩個正、兩個負…');
  },
  async (tok, S) => { // @1694.1
    note('每組開頭：1、5、12、22 → 答案下一講揭曉', 0, 0.5); cap('每組開頭 1、5、12、22', '這個規律下一講講');
  },
]);

// ════════ I9tMLP4KeEY（趙啟超 16B：Euler 五邊形數定理、p(n) 的遞迴、有限制的分割） ════════
scene('acD-euler-thm', '16B：Euler’s Pentagonal Number Theorem', [
  async (tok, S) => { // @3.8
    hot('定理：∏(1 − xⁱ)，i = 1 到 ∞，乘開', 0, 7.2); cap('這是個定理', '把 ∏(1 − xⁱ) 乘開');
  },
  async (tok, S) => { // @6.4
    sm('常數項 1；後面兩個一組，用 m 標第幾組', 0, 6.5); cap('常數 1，後面兩個兩個一組', '用 m 標第 m 組');
  },
  async (tok, S) => { // @9.0
    sm('每組前面有 (−1)ᵐ：負、正、負、正…', 0, 6.0); cap('前面是 (−1)ᵐ', '正負相間');
  },
  async (tok, S) => { // @49.8
    S.g = [[1, 2], [5, 7], [12, 15]].map(([a, b], i) => { const m = i + 1, y = 5.0 - i * 0.75, sg = m % 2 ? '−' : '+';
      return [sm('m = ' + m, -5.2, y), card(sg + ' x' + sp(a), m % 2 ? FC.pink : FC.mint, -3.4, y, 1.6, 0.5), card(sg + ' x' + sp(b), m % 2 ? FC.pink : FC.mint, -1.6, y, 1.6, 0.5)]; });
    sm('下一組開頭：22', -3.4, 2.75); cap('m=1：1、2；m=2：5、7；m=3：12、15', '下一個是 22');
  },
  async (tok, S) => { // @99.6
    hd('∏(1 − xⁱ) = 1 + Σ (−1)ᵐ [ x^((3m² − m)/2) + x^((3m² + m)/2) ]', 0, 2.0); cap('規律：(3m² − m)/2 和 (3m² + m)/2', 'm = 1, 2, 3, …');
  },
  async (tok, S) => { // @108.9
    const m = 1; ok(pent(m) === 1 && pent(-m) === 2, 3.6, 5.0, 'm = 1：(3 − 1)/2 = ' + pent(m) + '，(3 + 1)/2 = ' + pent(-m) + ' ✓'); cap('m = 1：1 和 2', '');
  },
  async (tok, S) => { // @119.8
    const m = 2; ok(pent(m) === 5 && pent(-m) === 7, 3.6, 4.25, 'm = 2：(12 − 2)/2 = ' + pent(m) + '，(12 + 2)/2 = ' + pent(-m) + ' ✓'); cap('m = 2：5 和 7', '');
  },
  async (tok, S) => { // @128.0
    const m = 3; ok(pent(m) === 12 && pent(-m) === 15, 3.6, 3.5, 'm = 3：(27 − 3)/2 = ' + pent(m) + '，(27 + 3)/2 = ' + pent(-m) + ' ✓'); cap('m = 3：12 和 15', '');
  },
  async (tok, S) => { // @145.6
    const N = 40, E = euler(N), F = zeros(N); F[0] = 1;
    for (let m = 1; pent(m) <= N; m++) { const sg = m % 2 ? -1 : 1; F[pent(m)] += sg; if (pent(-m) <= N) F[pent(-m)] += sg; }
    ok(same(E, F, 0, N), 0, 1.2, '程式把乘積乘開到 x⁴⁰，跟公式逐項比對 ✓'); cap('一對一對、正負相間', '代 m 進去就知道');
  },
  async (tok, S) => { // @158.6
    pl('Euler 最早提出 → 有些組合數學書叫 Euler’s Identity', 0, 0.5); cap('Euler 提出的', '有些書叫 Euler’s Identity');
  },
  async (tok, S) => { // @182.7
    hot('Euler’s Pentagonal Number Theorem（五邊形數定理）', 0, -0.2); cap('比較常見的名字', 'Pentagonal Number Theorem');
  },
]);

// pentagon dots: pentagons of side 0, 1, …, m−1 sharing one corner and its two edges
function pentDots(m, s) {
  const out = []; const seen = new Set(); const D = [0, 72, 144, 216, 288].map((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)]);
  for (let k = 1; k <= m; k++) {
    const L = k - 1; let p = [0, 0]; const layer = [];
    for (const u of D) {
      for (let j = 0; j < Math.max(L, 1); j++) { const q = [p[0] + u[0] * j * s, p[1] + u[1] * j * s]; const key = q.map((v) => v.toFixed(3)).join(','); if (!seen.has(key)) { seen.add(key); layer.push(q); } }
      p = [p[0] + u[0] * L * s, p[1] + u[1] * L * s];
    }
    out.push(layer);
  }
  return out;
}
scene('acD-pentagon', '16B：Pentagonal numbers 1、5、12、22', [
  async (tok, S) => { // @234.0
    hot('Pentagonal = Pentagon（五邊形）的形容詞', 0, 7.2);
    const r = 1.1, cx = -3.0, cy = 3.0; S.out = range(0, 4).map((i) => { const a1 = Math.PI / 2 + (i * 2 * Math.PI) / 5, a2 = Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 5; return line(cx + r * Math.cos(a1), cy + r * Math.sin(a1), cx + r * Math.cos(a2), cy + r * Math.sin(a2)); });
    S.pn = sm('Pentagon：五角大廈、五邊形', -3.0, 1.4); cap('Pentagon 就是五邊形', '美國國防部五角大廈');
  },
  async (tok, S) => { // @264.2
    gone(S.out, S.pn); hd('pentagonal number = (3m² − m)/2', 3.2, 6.3); cap('pentagonal number = (3m² − m)/2', '');
  },
  async (tok, S) => { // @274.7
    S.num = [1, 2, 3, 4].map((m, i) => card(String(pent(m)), FC.sand, 1.6 + i * 1.1, 5.4, 0.8, 0.55)); sm('m = 1, 2, 3, 4', 3.25, 4.75); cap('1、5、12、22', '跟五邊形有關係');
  },
  ...[1, 2, 3, 4, 5].map((m) => async (tok, S) => { // @291.5 @294.3 @297.1 @324.9 @375.7
    if (!S.L) { S.L = pentDots(5, 0.55); S.dd = []; S.cnt = 0; }
    const x0 = -4.6, y0 = 1.0, c = PAL[(m - 1) % PAL.length];
    S.dd.forEach((d) => paint(d, '#b8ab94'));
    S.L[m - 1].forEach(([x, y]) => { S.dd.push(dot(x0 + x, y0 + y, c)); });
    S.cnt += S.L[m - 1].length;
    ok(S.cnt === pent(m), 3.2, 3.9 - (m - 1) * 0.5, 'm = ' + m + '：' + S.cnt + ' 個點 = (3·' + m + '² − ' + m + ')/2 ✓');
    S.num.forEach((n, i) => glow(n, i === m - 1 ? HL : null));
    cap(['1：就是一個點', '5：五邊形的五個點', '12：邊上多一點，裡面再一個五邊形', '22：每邊切三段', '下一個：每邊切四段 → 35'][m - 1], '點的總數 = (3m² − m)/2');
  }),
  async (tok, S) => { // @388.2
    S.num.forEach((n) => glow(n, null));
    pl('把 m 換成 −m：(3m² + m)/2 = ' + [1, 2, 3, 4].map((m) => pent(-m)).join('、'), 2.6, 1.2); sm('→ generalized pentagonal number', 2.6, 0.65); cap('把 m 帶 −m：(3m² + m)/2', 'generalized pentagonal number');
  },
  async (tok, S) => { // @401.6
    const ex = []; for (let m = 1; m <= 4; m++) ex.push(pent(m), pent(-m));
    hot('乘開後 x 的指數：' + ex.join('、') + ' ⋯', 1.6, 0.0); cap('x 的指數就是這些五邊形數', '所以叫 Pentagonal Number Theorem');
  },
]);

scene('acD-pn-derive', '16B：由生成函數倒推 p(n) 的遞迴式', [
  async (tok, S) => { // @486.9
    hot('用 Euler 的結果來算 p(n)', 0, 7.2); S.B = []; S.y = 6.4; cap('用這個結果來算 p(n)', '');
  },
  async (tok, S) => { // @500.7
    pl('P(x) = 1 / ∏(1 − xᵏ)　（生成函數已知）', 0, 6.4); pl('∏(1 − xᵏ) = ' + pstr(euler(16), 16) + '　（Euler）', 0, 5.8); cap('生成函數知道，分母乘開也知道', '');
  },
  async (tok, S) => { // @514.4
    hd('→ 倒回去找 p(n) 要滿足的 recurrence relation', 0, 5.15); cap('倒回去找遞迴關係', '');
  },
  async (tok, S) => { // @530.5
    sm('以前：給 recurrence → 求生成函數；現在反過來', 0, 4.6); cap('以前：遞迴式 → 生成函數', '現在反過來');
  },
  async (tok, S) => { // @558.1
    note('約定：n < 0 時 p(n) = 0；p(0) = 1（乘開常數項是 1）', 0, 4.05); cap('約定 n < 0 時 p(n) = 0', 'p(0) = 1');
  },
  async (tok, S) => { // @583.5
    S.rec = hot('p(n) = Σ (−1)ᵐ⁺¹ [ p(n − (3m² − m)/2) + p(n − (3m² + m)/2) ]，m ≥ 1', 0, 3.4); cap('p(n) 要滿足的遞迴式', '用前面的 p 算現在的');
  },
  async (tok, S) => { // @660.5
    S.rec.element.className = 'lab-label ptr'; pl('為什麼？　P(x) · ∏(1 − xᵏ) = 1', 0, 2.7); cap('因為 P(x) 乘分母 = 1', '');
  },
  async (tok, S) => { // @696.4
    pl('(p₀ + p₁x + p₂x² + ⋯)(1 − x − x² + x⁵ + x⁷ − ⋯) = 1', 0, 2.1); cap('把 Euler 的展開式代進來', '');
  },
  async (tok, S) => { // @736.0
    sm('兩邊係數相等：常數項 = 1；x、x²、x³ … 的係數都 = 0', 0, 1.5); cap('兩邊係數要相等', '常數項 1，其他都 0');
  },
  async (tok, S) => { // @754.2
    const p = pRec(5); const lhs = p[5] - p[4] - p[3] + p[0];
    ok(lhs === 0, 0, 0.85, '例 x⁵ 的係數：p₅ − p₄ − p₃ + p₀ = 0 ⇒ p₅ = p₄ + p₃ − p₀ ✓'); cap('例如看 x⁵ 的係數', '就得到 p₅ 的關係');
  },
  async (tok, S) => { // @780.6
    note('作業三第 8 題有類似的題目；兩邊整理、係數相等就找到了', 0, 0.2); cap('細節就不寫了', '作業有類似題');
  },
]);

scene('acD-pn-compute', '16B：用遞迴算 p(1)…p(10)、p(100)', [
  async (tok, S) => { // @816.7
    hot('m = 1 代進去：p(n) = p(n − 1) + p(n − 2) ⋯', 0, 7.2); cap('m = 1 代進去', 'p(n − 1) + p(n − 2)');
  },
  async (tok, S) => { // @839.0
    hd('p(n) = p(n−1) + p(n−2) − p(n−5) − p(n−7) + p(n−12) + p(n−15) − p(n−22) ⋯', 0, 6.4); cap('再來 − p(n−5) − p(n−7)', '然後 + p(n−12) + p(n−15)…');
  },
  async (tok, S) => { // @867.4
    S.p = pRec(100); S.cells = {}; S.X = (n) => -5.0 + n * 1.0;
    range(0, 10).forEach((n) => sm('p(' + n + ')', S.X(n), 4.65));
    S.cells[0] = cube('1', FC.orange, [0.75, 0.6, 0.5], S.X(0), 5.3, 0, 0.6); cap('每個 p(n) 用前面的算', 'p(0) = 1，負的當 0');
  },
  ...[1, 2, 3, 4, 5, 6].map((n) => async (tok, S) => { // @946.1 @961.0 @973.4 @994.1 @996.6 @1017.7
    const terms = []; let v = 0;
    for (let m = 1; pent(m) <= n; m++) { const sg = m % 2 ? 1 : -1; for (const g of [pent(m), pent(-m)]) if (g <= n) { terms.push([sg, n - g]); v += sg * S.p[n - g]; } }
    const ex = terms.map(([sg, k], i) => (i ? (sg > 0 ? ' + ' : ' − ') : sg > 0 ? '' : '−') + 'p(' + k + ')').join('');
    const vals = terms.map(([sg, k], i) => (i ? (sg > 0 ? ' + ' : ' − ') : sg > 0 ? '' : '−') + S.p[k]).join('');
    Object.values(S.cells).forEach((c) => glow(c, null)); terms.forEach(([, k]) => glow(S.cells[k], HL));
    S.cells[n] = cube(String(v), FC.blue, [0.75, 0.6, 0.5], S.X(n), 5.3, 0, 0.6);
    if (S.line) gone(S.line);
    S.line = ok(v === parts(n).length, 0, 3.6, 'p(' + n + ') = ' + ex + ' = ' + vals + ' = ' + v + '（直接數也是 ' + parts(n).length + '）✓');
    cap('p(' + n + ') = ' + ex + ' = ' + v, '');
  }),
  async (tok, S) => { // @1039.4
    Object.values(S.cells).forEach((c) => glow(c, null));
    [7, 8, 9, 10].forEach((n) => { S.cells[n] = cube(String(S.p[n]), FC.teal, [0.75, 0.6, 0.5], S.X(n), 5.3, 0, 0.6); });
    gone(S.line); S.line = ok([7, 8, 9, 10].every((n) => S.p[n] === parts(n).length), 0, 3.6, 'p(7) = 15、p(8) = 22、p(9) = 30、p(10) = 42 ✓');
    cap('p(7)=15、p(8)=22、p(9)=30、p(10)=42', '可以一直算下去');
  },
  async (tok, S) => { // @1060.5
    const Q = pProd(100);
    S.big = card('p(100) = ' + S.p[100].toLocaleString('en-US'), FC.gold, 0, 2.5, 4.6, 0.65); glow(S.big, HL);
    ok(S.p[100] === Q[100], 0, 1.75, '（遞迴算的 = 乘積展開的 x¹⁰⁰ 係數）✓'); cap('p(100) = 190,569,292', '一億九千零五十六萬多');
  },
  async (tok, S) => { // @1080.0
    note('直接一個一個列：要數一億九千多萬種，算到哪一年？用生成函數很輕鬆', 0, 1.0); cap('直接數要數到哪一年', '用生成函數就很輕鬆');
  },
  async (tok, S) => { // @1125.2
    const g = []; for (let m = 1; m <= 5; m++) g.push(pent(m), pent(-m));
    sm('n 越大，要加減的項越多：n − ' + g.join('、n − ') + ' ⋯', 0, 0.3); cap('n 越大，要加減的項越來越多', '1、2、5、7、12、15、22…');
  },
]);

scene('acD-part-restrict', '16B：有限制的分割 p(n | P)：以 5 為例', [
  async (tok, S) => { // @1142.2
    hot('有限制的 partition', 0, 7.2); cap('前面的分割沒有限制', '下面開始有限制');
  },
  async (tok, S) => { // @1164.9
    hd('p(n | P)：分割後每一份要滿足性質 P', 0, 6.45); cap('記號 p(n | P)', '一豎後面寫要滿足的條件');
  },
  async (tok, S) => { // @1228.2
    S.hD = hd('D：each part is distinct（每份都不同）', -2.0, 5.75); cap('例：each part is distinct', '每一份都要不一樣');
  },
  async (tok, S) => { // @1259.6
    S.hO = hd('O：each part is odd（每份都是奇數）', 3.6, 5.75); cap('例：each part is odd', '不能有 2、4 這種');
  },
  async (tok, S) => { // @1290.6
    S.P = parts(5); S.Y = (i) => 4.9 - i * 0.62;
    S.P.forEach((p, i) => { prow(p, -6.6, S.Y(i), 0.42, null, 0.4); sm(pj(p), -3.4, S.Y(i)); });
    ok(S.P.length === 7, -4.6, 0.3, '沒限制：p(5) = 7 ✓'); cap('用 5 來看：沒限制有 7 種', '');
  },
  ...[[0], [1, 2], [3, 4], [5, 6]].map((ix, k) => async (tok, S) => { // @1303.2 @1321.1 @1338.4 @1362.8
    ix.forEach((i) => { S.dD = S.dD || []; S.dD[i] = isDistinct(S.P[i]); ok(S.dD[i], -0.6, S.Y(i), S.dD[i] ? '✓' : '✘ 有重複'); });
    if (k === 3) { const n = S.dD.filter(Boolean).length; ok(n === 3, -0.6, 0.3, 'p(5 | distinct) = ' + n + ' ✓'); }
    cap(['一份：5，當然都不同', '兩份：4 + 1、3 + 2 都可以', '三份：3+1+1、2+2+1 都有重複', '四份、五份也不行 → 只有 3 種'][k], '');
  }),
  ...[[0], [1, 2], [3, 4], [5, 6]].map((ix, k) => async (tok, S) => { // @1409.3 @1418.6 @1430.0 @1444.6
    ix.forEach((i) => { S.dO = S.dO || []; S.dO[i] = isOdd(S.P[i]); ok(S.dO[i], 3.6, S.Y(i), S.dO[i] ? '✓' : '✘ 有偶數'); });
    if (k === 3) { const n = S.dO.filter(Boolean).length; ok(n === 3, 3.6, 0.3, 'p(5 | odd) = ' + n + ' ✓'); }
    cap(['只用奇數：5 可以', '兩份：4+1、3+2 都有偶數', '三份：3 + 1 + 1 可以', '五個 1 可以 → 也是 3 種'][k], '');
  }),
  async (tok, S) => { // @1501.4
    hot('兩個都是 3——這不是巧合（下次講）', 0, -0.4); cap('兩個都是 3', '不是巧合，下次講');
  },
]);

// ════════ VAn-mpZAbM4（趙啟超 17A：distinct = odd、生成函數證明、Ferrers 圖） ════════
const D8 = [[8], [7, 1], [6, 2], [5, 3], [5, 2, 1], [4, 3, 1]];
const O8 = [[7, 1], [5, 3], [5, 1, 1, 1], [3, 3, 1, 1], [3, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1]];
scene('acD-eight', '17A：分割 8——distinct 跟 odd 各有幾種', [
  async (tok, S) => { // @3.8
    hot('複習：p(n | P)，P = each part distinct 或 each part odd', 0, 7.2); cap('上次講到有限制的分割', 'distinct 或 odd');
  },
  async (tok, S) => { // @42.8
    sm('分割 5：distinct 有 3 種、odd 也 3 種', 0, 6.55); cap('分割 5：兩種條件都是 3 種', '');
  },
  async (tok, S) => { // @57.7
    hd('分割 8：each part is distinct', -3.6, 6.0); S.Y = (i) => 5.25 - i * 0.62; cap('再看 8：每一份都不一樣', '');
  },
  async (tok, S) => { // @78.2
    prow(D8[0], -6.8, S.Y(0), 0.38, null, 0.4); sm(pj(D8[0]), -2.0, S.Y(0)); cap('一份：8', '');
  },
  async (tok, S) => { // @80.8
    [1, 2, 3].forEach((i) => { prow(D8[i], -6.8, S.Y(i), 0.38, null, 0.4); sm(pj(D8[i]), -2.0, S.Y(i)); });
    bad('4 + 4 ✘（兩份一樣）', -3.6, S.Y(6) - 0.1); cap('兩份：7+1、6+2、5+3', '4 + 4 不行');
  },
  async (tok, S) => { // @104.2
    [4, 5].forEach((i) => { prow(D8[i], -6.8, S.Y(i), 0.38, null, 0.4); sm(pj(D8[i]), -2.0, S.Y(i)); }); cap('三份：5+2+1、4+3+1', '其他會有兩個一樣');
  },
  async (tok, S) => { // @134.0
    const A = parts(8).filter(isDistinct); ok(sameList(A, D8), -3.6, S.Y(7) - 0.2, '四份以上一定重複 → 共 ' + A.length + ' 種 ✓'); cap('四份以上一定重複', '所以 distinct 有 6 種');
  },
  async (tok, S) => { // @184.7
    hd('分割 8：each part is odd', 3.4, 6.0); sm('只能用 1、3、5、7（可重複）；一份 8 是偶數 ✘', 3.4, 5.55); cap('再看 each part is odd', '只能 1、3、5、7');
  },
  async (tok, S) => { // @204.9
    [0, 1].forEach((i) => { prow(O8[i], 0.4, S.Y(i) - 0.3, 0.38, null, 0.4); sm(pj(O8[i]), 5.6, S.Y(i) - 0.3); }); cap('兩份：7 + 1、5 + 3', '');
  },
  async (tok, S) => { // @208.8
    note('三份 ✘：三個奇數加起來是奇數', 3.4, S.Y(2) - 0.3); cap('三份不行', '一定會有偶數');
  },
  async (tok, S) => { // @221.1
    [2, 3].forEach((i) => { prow(O8[i], 0.4, S.Y(i + 1) - 0.3, 0.38, null, 0.4); sm(pj(O8[i]), 5.6, S.Y(i + 1) - 0.3); }); cap('四份：5+1+1+1、3+3+1+1', '');
  },
  async (tok, S) => { // @239.8
    prow(O8[4], 0.4, S.Y(5) - 0.3, 0.38, null, 0.4); sm(pj(O8[4]), 5.6, S.Y(5) - 0.3); cap('五份不行；六份：3 + 五個 1', '');
  },
  async (tok, S) => { // @261.8
    prow(O8[5], 0.4, S.Y(6) - 0.3, 0.38, null, 0.4); sm('1 × 8', 5.6, S.Y(6) - 0.3);
    const B = parts(8).filter(isOdd); ok(sameList(B, O8), 3.4, S.Y(7) - 0.5, '七份不行；八個 1 → 共 ' + B.length + ' 種 ✓'); cap('七份不行；八份：八個 1', 'odd 也是 6 種');
  },
  async (tok, S) => { // @295.0
    hot('兩個都是 6！', 0, -0.6); cap('兩個數目一樣', '5 一樣，8 也一樣');
  },
]);

scene('acD-conj', '17A：巧合嗎？先猜（conjecture）再證明', [
  async (tok, S) => { // @319.0
    hot('只是巧合嗎？', 0, 7.2); cap('這只是巧合嗎？', '');
  },
  async (tok, S) => { // @348.3
    const ns = range(1, 12); const dx = 0.9, x0 = -4.6;
    sm('n', x0 - 1.3, 5.6); sm('distinct', x0 - 1.3, 4.9); sm('odd', x0 - 1.3, 4.2);
    let all = true;
    ns.forEach((n, i) => { const a = parts(n).filter(isDistinct).length, b = parts(n).filter(isOdd).length; all = all && a === b;
      sm(String(n), x0 + i * dx, 5.6); cube(String(a), FC.blue, [0.66, 0.5, 0.45], x0 + i * dx, 4.9, 0, 0.5); cube(String(b), FC.green, [0.66, 0.5, 0.45], x0 + i * dx, 4.2, 0, 0.5); ok(a === b, x0 + i * dx, 3.6); });
    sm('示意：程式把 n = 1～12 都數一遍', 0, 3.0); cap('再試 7、試 9…', '都一樣');
  },
  async (tok, S) => { // @372.1
    hd('試了很多都一樣 → 寫一個猜想（conjecture）', 0, 2.2); cap('試多了都一樣，就猜它一樣', '寫成一個猜想');
  },
  async (tok, S) => { // @417.6
    note('猜錯的東西一輩子證不出來；這個是對的 → 來證明', 0, 1.4); cap('猜錯了永遠證不出來', '這個是對的，來證');
  },
]);

scene('acD-do-proof', '17A：用生成函數證明 distinct 個數 = odd 個數', [
  async (tok, S) => { // @444.6
    hot('用生成函數證明：p(n | distinct) = p(n | odd)', 0, 7.2); cap('用生成函數一下就證出來', '');
  },
  async (tok, S) => { // @471.5
    pl('P_d(x)：each part distinct 的生成函數　P_o(x)：each part odd 的', 0, 6.45); cap('兩個生成函數：P_d(x)、P_o(x)', '證明它們一樣');
  },
  async (tok, S) => { // @555.8
    pl('沒限制：(1 + x + x² + ⋯)(1 + x² + x⁴ + ⋯)(1 + x³ + x⁶ + ⋯) ⋯', 0, 5.85); cap('沒限制時是這樣', '');
  },
  async (tok, S) => { // @595.8
    sm('distinct：每個數最多用一次 → 每個因式只留到 xᵏ 這一項', 0, 5.3); cap('distinct：每個數最多一個', '後面的項都不能有');
  },
  async (tok, S) => { // @616.0
    hd('P_d(x) = (1 + x)(1 + x²)(1 + x³)(1 + x⁴) ⋯', 0, 4.7); cap('P_d(x) = (1+x)(1+x²)(1+x³)⋯', '');
  },
  async (tok, S) => { // @668.2
    pl('1 + x = (1 − x²)/(1 − x)', -3.2, 4.0); cap('1 + x = (1 − x²)/(1 − x)', '');
  },
  async (tok, S) => { // @681.7
    pl('1 + x² = (1 − x⁴)/(1 − x²)，1 + x³ = (1 − x⁶)/(1 − x³)', 2.6, 4.0); cap('同理：x 換成 x²、x³…', '');
  },
  async (tok, S) => { // @708.8
    S.fr = [['1 − x²', '1 − x'], ['1 − x⁴', '1 − x²'], ['1 − x⁶', '1 − x³'], ['1 − x⁸', '1 − x⁴'], ['1 − x¹⁰', '1 − x⁵']].map(([a, b], i) => {
      const x = -5.2 + i * 2.3; return { top: card(a, FC.sky, x, 3.1, 1.9, 0.45), bot: card(b, FC.peach, x, 2.5, 1.9, 0.45) }; });
    sm('⋯', 6.4, 2.8);
    glow(S.fr[0].top, NG); glow(S.fr[1].bot, NG); S.x1 = bad('x² 上下消掉', -4.0, 1.9); cap('乘起來，上面 1−x² 跟下面消掉', '');
  },
  async (tok, S) => { // @730.4
    glow(S.fr[1].top, NG); glow(S.fr[3].bot, NG); glow(S.fr[2].top, '#3a1010');
    sm('x⁴ 消掉、x⁶ 也會被後面的 1 − x⁶ 消掉 ⋯ 分子全部消光', 0, 1.9); gone(S.x1); cap('四次方、六次方也都消掉', '偶數次方全消光');
  },
  async (tok, S) => { // @741.5
    S.fr.forEach((f) => { f.top.visible = false; glow(f.bot, null); }); [1, 3].forEach((i) => { S.fr[i].bot.visible = false; });
    hot('= 1 / [(1 − x)(1 − x³)(1 − x⁵) ⋯]　只剩奇數次方', 0, 1.3); cap('剩下 1/[(1−x)(1−x³)(1−x⁵)⋯]', '只剩奇數次方');
  },
  async (tok, S) => { // @813.4
    pl('= (1 + x + x² + ⋯)(1 + x³ + x⁶ + ⋯)(1 + x⁵ + ⋯) ⋯ ＝ P_o(x)：每一份都是奇數', 0, 0.7); cap('這就是 each part odd 的生成函數', '= P_o(x)');
  },
  async (tok, S) => { // @842.6
    const N = 12;
    const A = prod(range(1, N).map((k) => lin([[0, 1], [k, 1]], N)), N), B = prod(range(1, N).filter((k) => k % 2).map((k) => geo(k, N)), N);
    rack(A, -4.4, -0.2, 0.75, FC.blue, 'P_d'); rack(B, -4.4, -1.1, 0.75, FC.green, 'P_o');
    ok(same(A, B, 0, N), 5.4, -0.65, '逐項相同 ✓'); cap('生成函數一樣 ⇒ 每個係數一樣', '證完了');
  },
]);

scene('acD-ferrers', '17A：Ferrers diagram', [
  async (tok, S) => { // @902.9
    hot('Ferrers diagram（Ferrers graph）', 0, 7.2); sm('用一排一排的點來畫一個 partition', 0, 6.55); cap('Ferrers diagram：用點畫分割', '');
  },
  async (tok, S) => { // @935.3
    hd('6 = 2 + 2 + 1 + 1', -4.6, 5.7); cap('例：6 = 2 + 2 + 1 + 1', '');
  },
  async (tok, S) => { // @963.5
    S.a = ferrers([2, 2, 1, 1], -5.3, 4.9, 0.45, FC.blue); note('從大排到小；每一份畫一排點；左邊對齊', 0, 1.6); cap('大到小排，一份畫一排點', '最左邊要對齊');
  },
  async (tok, S) => { // @990.2
    hd('6 = 3 + 1 + 1 + 1', 0, 5.7); S.b = ferrers([3, 1, 1, 1], -0.6, 4.9, 0.45, FC.pink); cap('3 + 1 + 1 + 1', '');
  },
  async (tok, S) => { // @994.9
    hd('6 = 4 + 2', 4.6, 5.7); S.c = ferrers([4, 2], 3.9, 4.9, 0.45, FC.green); cap('4 + 2', '');
  },
  async (tok, S) => { // @1023.5
    good('每個 partition ↔ 唯一一個 Ferrers 圖：one-to-one correspondence', 0, 0.9); cap('分割跟圖一一對應', 'one-to-one correspondence');
  },
]);

const R7 = [[5, 1, 1], [4, 2, 1], [3, 3, 1], [3, 2, 2]];
scene('acD-ferrers-col', '17A：parts ≤ r 的分割 ↔ n + r 恰 r 份的分割', [
  async (tok, S) => { // @1059.0
    hot('用 Ferrers 圖，很多性質一看就出來', 0, 7.2); cap('用 Ferrers 圖看性質', '');
  },
  async (tok, S) => { // @1084.7
    hd('左：分割 n，number of parts ≤ r', -3.6, 6.4); cap('左邊：分割 n，份數 ≤ r', '');
  },
  async (tok, S) => { // @1129.2
    hd('右：分割 n + r，number of parts = r', 3.6, 6.4); cap('右邊：分割 n + r，剛好 r 份', '');
  },
  async (tok, S) => { // @1148.4
    sm('兩邊之間建一個 bijection → 數目就一樣', 0, 5.8); note('示意：n = 4、r = 3', 0, 5.25); cap('建一個 bijection', '兩邊數目就一樣');
  },
  async (tok, S) => { // @1174.0
    S.F = R7.map((p, i) => ferrers(p, 1.2 + (i % 2) * 3.0, 4.3 - Math.floor(i / 2) * 1.8, 0.4, FC.blue));
    S.t = sm('每個圖都是 n + r = 7 個點', 3.6, 0.4); cap('先看右邊：全部有 n + r 點', '');
  },
  async (tok, S) => { // @1192.4
    S.F.forEach((f) => f.rows.forEach((r) => paint(r[0], FC.gold)));
    gone(S.t); S.t = sm('r 份 ⇒ 最左邊的 column 有 r = 3 點', 3.6, 0.4); cap('有 r 份 ⇒ 最左 column 有 r 點', '');
  },
  async (tok, S) => { // @1240.4
    note('每排由上到下越來越短（大排到小）', 3.6, -0.2); cap('圖一定是斜斜往下變短', '上面大、下面小');
  },
  async (tok, S) => { // @1326.3
    for (const f of S.F) for (const r of f.rows) { const d = r[0]; await anim(tok, 60, (u) => { d.position.y += 0.08 * u; }); kill(d); }
    cap('把最左邊的 column 拿掉', '少了 r 點');
  },
  async (tok, S) => { // @1358.3
    const L = []; const list = [];
    S.F.forEach((f, i) => { const tx = -5.8 + (i % 2) * 2.8, ty = 4.3 - Math.floor(i / 2) * 1.8; const q = [];
      f.rows.forEach((r, ri) => { if (r.length > 1) q.push(r.length - 1); r.slice(1).forEach((d, j) => list.push([d, tx + j * 0.4, ty - ri * 0.4])); }); L.push(q); });
    await moveMany(tok, list, 900);
    const want = parts(4).filter((p) => p.length <= 3);
    ok(sameList(L, want), -3.6, 0.4, '剩 n = 4 點、份數 ≤ 3：' + L.map(pj).join('、') + ' ✓'); cap('剩下 n 點，份數 ≤ r', '就變成左邊那種');
  },
  async (tok, S) => { // @1467.0
    arrow(V3(-1.2, 3.4, 0), V3(1.0, 3.4, 0)); arrow(V3(1.0, 2.8, 0), V3(-1.2, 2.8, 0));
    sm('拿掉第一 column ⇄ 加回一個 r 點的 column', 0, 2.3); cap('反過來：加一個 r 點的 column', '就回到右邊');
  },
  async (tok, S) => { // @1483.7
    good('一一對應 ⇒ 兩邊數目一樣（這裡都是 ' + R7.length + ' 種）', 0, -0.4); cap('一一對應，兩邊數目一樣', '');
  },
]);

// ════════ p7fXiuokfWs（趙啟超 17B：bijection、transpose、largest part = m ↔ m 份） ════════
scene('acD-bij-recap', '17B：兩個集合之間的 bijection', [
  async (tok, S) => { // @5.8
    hd('分割 n，parts ≤ r', -3.6, 6.3); S.A = parts(4).filter((p) => p.length <= 3).map((p, i) => card(pj(p), FC.sky, -3.6, 5.4 - i * 0.7, 2.6, 0.5)); sm('示意：n = 4、r = 3', -3.6, 2.4); cap('左邊：份數 ≤ r 的分割構成一個集合', '');
  },
  async (tok, S) => { // @9.4
    hd('分割 n + r，parts = r', 3.6, 6.3); S.B = R7.map((p, i) => card(pj(p), FC.peach, 3.6, 5.4 - i * 0.7, 2.6, 0.5)); cap('右邊：n + r 恰 r 份的分割', '也構成一個集合');
  },
  async (tok, S) => { // @21.1
    const L = parts(4).filter((p) => p.length <= 3);
    S.ok = R7.every((p, i) => pj(p.map((v) => v - 1).filter((v) => v > 0)) === pj(L[i]));
    S.A.forEach((a, i) => arrow(V3(-2.2, 5.4 - i * 0.7, 0), V3(2.2, 5.4 - i * 0.7, 0))); cap('中間建了一個一對一的對應', '這邊推到那邊，那邊推回來');
  },
  async (tok, S) => { // @26.8
    ok(S.ok, 0, 2.2, 'bijection ⇒ 兩個集合的 cardinality（size）一樣 ✓'); cap('bijection ⇒ 兩邊大小一樣', '證完了');
  },
  async (tok, S) => { // @37.8
    note('要證兩個數目一樣，常用這招：建一個 bijection', 0, 1.4); cap('證數目一樣常這樣做', '建一個 bijection');
  },
  async (tok, S) => { // @72.8
    ferrers([3, 2, 2], -0.6, 0.6, 0.4, FC.blue); sm('Ferrers 圖一定大排到小，不會下面比較長', 0, -0.8); cap('一定大排到小', '不會下面比較大');
  },
]);

const P14 = [4, 3, 3, 2, 1, 1];
scene('acD-transpose', '17B：Ferrers 圖的 transposition', [
  async (tok, S) => { // @96.6
    hd('14 的一個 partition：' + pj(P14), 0, 6.6); ok(P14.reduce((a, b) => a + b, 0) === 14, 4.8, 6.0, '= 14 ✓'); cap('看 14 的一個 partition', '4 + 3 + 3 + 2 + 1 + 1');
  },
  async (tok, S) => { // @112.3
    S.x0 = -1.6; S.y0 = 5.4; S.s = 0.5; S.F = ferrers(P14, S.x0, S.y0, S.s, FC.blue); S.F.rows.forEach((r) => paint(r[0], FC.gold));
    S.rl = P14.map((k, r) => sm(String(k), S.x0 - 0.7, S.y0 - r * S.s)); cap('它的 Ferrers 圖', '一個 4、兩個 3、一個 2、兩個 1');
  },
  async (tok, S) => { // @146.6
    sm('transposition：row 變 column、column 變 row', 3.4, 4.6); cap('考慮 transposition', 'row 變 column，column 變 row');
  },
  async (tok, S) => { // @168.0
    sm('（像矩陣取 transpose）', 3.4, 4.0); gone(S.rl);
    const list = []; S.F.rows.forEach((row, r) => row.forEach((d, c) => list.push([d, S.x0 + r * S.s, S.y0 - c * S.s])));
    await moveMany(tok, list, 1500); cap('就像矩陣取 transpose', '');
  },
  async (tok, S) => { // @179.9
    S.Q = conj(P14); S.ql = [sm(String(S.Q[0]), S.x0 - 0.7, S.y0)]; cap('第一個 column 變成第一個 row', '一共 6 點');
  },
  async (tok, S) => { // @189.5
    S.Q.slice(1).forEach((k, r) => S.ql.push(sm(String(k), S.x0 - 0.7, S.y0 - (r + 1) * S.s))); cap('第二 row 4 點、第三 row 3 點', '第四 row 1 點');
  },
  async (tok, S) => { // @205.3
    const legal = S.Q.every((v, i) => i === 0 || v <= S.Q[i - 1]);
    ok(legal, 3.4, 3.2, '還是合法的 Ferrers 圖：大排到小 ✓'); cap('轉過來還是合法的 Ferrers 圖', '點數也沒少');
  },
  async (tok, S) => { // @243.7
    const sum = S.Q.reduce((a, b) => a + b, 0); ok(sum === 14, 3.4, 2.5, pj(S.Q) + ' = ' + sum + '：還是 14 的 partition ✓'); cap('6 + 4 + 3 + 1 = 14', '還是 14 的 partition');
  },
  async (tok, S) => { // @263.7
    const list = []; S.F.rows.forEach((row, r) => row.forEach((d, c) => list.push([d, S.x0 + c * S.s, S.y0 - r * S.s])));
    gone(S.ql); await moveMany(tok, list, 1500);
    ok(pj(conj(S.Q)) === pj(P14), 3.4, 1.8, '再 transpose 回來就是原本的 ⇒ 一對一（bijection）✓'); cap('再 transpose 回來就回到原來', '所以是一對一');
  },
]);

const Q14 = conj(P14);
scene('acD-largest', '17B：largest part = m ↔ 恰有 m 份', [
  async (tok, S) => { // @323.7
    hot('用 transposition 證一個性質', 0, 7.2); sm('簡單的工具、不同的觀點，看到原本看不到的', 0, 6.55); cap('用這個來證下面的性質', '');
  },
  async (tok, S) => { // @375.8
    hd('分割 n，largest part = m', -3.4, 5.9); cap('第一種：最大的那一份是 m', '');
  },
  async (tok, S) => { // @397.2
    S.A = ferrers(P14, -5.6, 4.9, 0.42, FC.blue); S.B = ferrers(Q14, 1.4, 4.9, 0.42, FC.green);
    S.A.rows[0].forEach((d) => paint(d, FC.gold)); S.B.rows[0].forEach((d) => paint(d, FC.gold));
    sm(pj(P14) + '：largest = ' + Math.max(...P14), -4.2, 2.1); sm(pj(Q14) + '：largest = ' + Math.max(...Q14), 2.8, 2.1); cap('例：這個最大的 part 是 4', '那個最大的 part 是 6');
  },
  async (tok, S) => { // @411.0
    hd('分割 n，number of parts = m', 3.4, 5.9); cap('第二種：一共 m 份', '兩種個數一樣');
  },
  async (tok, S) => { // @450.7
    S.A.rows.forEach((r, i) => { if (i) paint(r[0], FC.teal); }); S.B.rows.forEach((r, i) => { if (i) paint(r[0], FC.teal); });
    sm('有 ' + P14.length + ' 份', -4.2, 1.55); sm('有 ' + Q14.length + ' 份', 2.8, 1.55); cap('number of parts：這個 6 份', '那個 4 份');
  },
  async (tok, S) => { // @488.4
    pl('largest part = m ⇔ 第一個 row 有 m 點', -3.4, 0.9); cap('最大份是 m ⇔ 第一 row 有 m 點', '');
  },
  async (tok, S) => { // @546.2
    pl('m 份 ⇔ 第一個 column 有 m 點', 3.4, 0.9); cap('要變成：第一 column 有 m 點', '');
  },
  async (tok, S) => { // @594.3
    arrow(V3(-2.6, 4.0, 0), V3(1.0, 4.0, 0)); arrow(V3(1.0, 3.5, 0), V3(-2.6, 3.5, 0)); ok(pj(conj(P14)) === pj(Q14), -0.8, 3.0, 'transpose ✓'); cap('transpose 過來就好', '');
  },
  async (tok, S) => { // @647.0
    sm('左：largest 4 → 右：4 份；右：largest 6 → 左：6 份', 0, 0.3); cap('第一 row m 點 ↔ 第一 column m 點', '最大份 m ↔ m 份');
  },
  async (tok, S) => { // @662.4
    const n = 6; let all = true; const cs = range(1, n).map((m) => { const a = parts(n).filter((p) => p[0] === m).length, b = parts(n).filter((p) => p.length === m).length; all = all && a === b; return a + '=' + b; });
    ok(all, 0, -0.3, '示意 n = 6，m = 1～6：' + cs.join('、') + ' ✓'); cap('這兩種分割一一對應', '個數一樣');
  },
  async (tok, S) => { // @752.8
    note('Ferrers 圖 + 生成函數，混著用可以證很多性質', 0, -0.9); cap('Ferrers 圖很好用', '跟生成函數混著用');
  },
]);

// ════════ XVt8JJgj8JE（趙啟超 17C：complexity of algorithms、Big-O） ════════
scene('acD-why', '17C：為什麼要估計複雜度', [
  async (tok, S) => { // @6.0
    hot('Complexity of algorithms（演算法的複雜度）', 0, 7.2); sm('enumeration 的最後一部分', 0, 6.55); cap('enumeration 最後一部分', 'complexity of algorithms');
  },
  async (tok, S) => { // @10.2
    S.m = prop('monitor', -4.2, 2.6, 0, 1.2); bub('做之前先估計：要花多少時間？', -4.2, 5.3); cap('先估計要花多少時間', '');
  },
  async (tok, S) => { // @36.4
    S.r = [card('n = 10：跑了 1 小時', FC.mint, 2.4, 5.0, 4.2), card('n = 100：？', FC.sky, 2.4, 4.2, 4.2), card('n = 1000：？', FC.sky, 2.4, 3.4, 4.2)]; cap('n = 10 跑一小時', '那 n = 100、1000 呢？');
  },
  async (tok, S) => { // @56.5
    relab(S.r[1], 'n = 100：要 5 年？等不到！'); glow(S.r[1], NG); cap('如果要跑 5 年', '根本等不到');
  },
  async (tok, S) => { // @76.8
    sm('先算複雜度：n = 100 的工作量是 n = 10 的幾倍', 2.4, 2.5); cap('先算複雜度', 'n = 100 是 n = 10 的幾倍');
  },
  async (tok, S) => { // @97.8
    note('跑兩個禮拜，中間可能停電、當機，就沒有結果', 2.4, 1.8); cap('跑兩個禮拜可能就當掉了', '');
  },
  async (tok, S) => { // @115.7
    good('用 complexity of algorithm 來估計', 0, 0.6); cap('用演算法的複雜度來考慮', '');
  },
]);

scene('acD-algo', '17C：什麼是 algorithm', [
  async (tok, S) => { // @125.4
    hd('algorithm = a list of precise instructions', 0, 6.4); cap('algorithm：一串精確的指令', '');
  },
  async (tok, S) => { // @179.8
    pl('designed to solve a particular type of problem', 0, 5.7); sm('（解一整類問題，不是只解一個特例）', 0, 5.15); cap('解的是一整類的問題', '不只是一個 special case');
  },
  async (tok, S) => { // @194.4
    sm('台灣通常叫「演算法」', 0, 4.5); cap('台灣叫演算法', '');
  },
  async (tok, S) => { // @204.8
    S.c = card('Programs = Algorithms + Data Structures', FC.gold, 0, 3.6, 7.0, 0.6); glow(S.c, HL); cap('Programs = Algorithms + Data Structures', '以前的一本書名');
  },
  async (tok, S) => { // @222.8
    glow(S.c, null); card('algorithm：怎麼做', FC.sky, -2.6, 2.4, 3.6); card('data structure：資料怎麼存', FC.peach, 2.6, 2.4, 4.4);
    note('兩部分要配合：資料存得好，演算法才能做得好', 0, 1.5); cap('一個怎麼做，一個怎麼存', '要互相配合');
  },
]);

scene('acD-fn', '17C：分析 algorithm：size n 與 f(n)', [
  async (tok, S) => { // @237.9
    hot('怎麼分析一個 algorithm', 0, 7.2); cap('來分析一個 algorithm', '');
  },
  async (tok, S) => { // @274.6
    card('① 把 algorithm 描述得很 precise', FC.sky, 0, 6.0, 7.0); cap('第一：描述得很精確', '');
  },
  async (tok, S) => { // @282.0
    card('② 定義問題（instance）的 size：n', FC.mint, 0, 5.1, 7.0); cap('定義問題的 size，叫 n', '');
  },
  async (tok, S) => { // @314.3
    S.f = card('③ f(n) = number of operations required', FC.peach, 0, 4.2, 7.0); glow(S.f, HL); cap('f(n)：需要做幾次運算', 'number of operations');
  },
  async (tok, S) => { // @348.0
    glow(S.f, null); sm('不只一種運算 → 看最花時間的那種（例：乘法比加法貴很多）', 0, 3.4); cap('不只一種運算時', '看最複雜的那種');
  },
  async (tok, S) => { // @363.7
    note('描述跟 size 都要精確，結果才不會錯', 0, 2.6); cap('描述、size 都要精確', '');
  },
]);

const TN = [20, 40, 60];
const fmtT = (sec) => {
  if (sec < 60) return String(parseFloat(sec.toPrecision(3))) + ' 秒';
  if (sec < 86400 * 365) return String(parseFloat((sec / 86400).toPrecision(3))) + ' 天';
  return Math.round(sec / (86400 * 365 * 100)) + ' 個世紀';
};
scene('acD-time', '17C：n、n²、n³、2ⁿ 要跑多久（每次 10⁻⁶ 秒）', [
  async (tok, S) => { // @494.3
    hot('複雜度 f(n)：size = n 時某種 operation 的次數', 0, 7.2); cap('複雜度就是這個 f(n)', '');
  },
  async (tok, S) => { // @534.3
    hd('不同的複雜度要花多少時間？', 0, 6.45); cap('看不同複雜度要花多久', '');
  },
  async (tok, S) => { // @561.2
    sm('假設每秒做 10⁶ 次 → 一次 10⁻⁶ 秒（1 μs）', 0, 5.9); cap('假設每秒一百萬次', '一次 10⁻⁶ 秒');
  },
  async (tok, S) => { // @576.6
    note('MIPS = Million Instructions Per Second', 0, 5.35); cap('MIPS：每秒幾百萬個指令', '');
  },
  async (tok, S) => { // @606.6
    S.X = (j) => -2.0 + j * 3.0; TN.forEach((n, j) => hd('n = ' + n, S.X(j), 4.6)); sm('f(n)', -5.2, 4.6); cap('n 取 20、40、60', '');
  },
  ...[['n', (n) => n], ['n²', (n) => n * n], ['n³', (n) => n ** 3]].map(([nm, f], r) => async (tok, S) => { // @628.7 @687.2 @744.2
    const y = 3.8 - r * 0.8; sm(nm, -5.2, y);
    TN.forEach((n, j) => cube(fmtT(f(n) * 1e-6), FC.sky, [2.7, 0.55, 0.45], S.X(j), y, 0, 0.6));
    cap(['f(n) = n：20 次 × 10⁻⁶ 秒…', 'n²：400、1600、3600 次', 'n³：8000、64000、216000 次'][r], '都不到 1 秒');
  }),
  async (tok, S) => { // @799.6
    S.y2 = 3.8 - 3 * 0.8; sm('2ⁿ', -5.2, S.y2); S.c = []; S.c[0] = cube(fmtT(2 ** 20 * 1e-6), FC.peach, [2.7, 0.55, 0.45], S.X(0), S.y2, 0, 0.6); cap('2ⁿ：n 跑到指數上去', '2²⁰ 次 ≈ 1 秒');
  },
  async (tok, S) => { // @811.8
    S.c[1] = cube(fmtT(2 ** 40 * 1e-6), FC.peach, [2.7, 0.55, 0.45], S.X(1), S.y2, 0, 0.6); cap('2⁴⁰：12.7 天', '還不到兩個禮拜');
  },
  async (tok, S) => { // @837.7
    S.c[2] = cube('？', FC.red, [2.7, 0.55, 0.45], S.X(2), S.y2, 0, 0.6); S.g = bub('猜猜看 n = 60 要多久？', S.X(2), 0.9); cap('n = 60 呢？猜猜看', '');
  },
  async (tok, S) => { // @876.2
    gone(S.g); const sec = 2 ** 60 * 1e-6; relab(S.c[2], fmtT(sec)); glow(S.c[2], NG);
    const yrs = sec / (86400 * 365); ok(Math.round(yrs / 100) === 366, S.X(2), 0.9, '≈ ' + Math.round(yrs).toLocaleString('en-US') + ' 年 ✓'); cap('366 個世紀', '三萬多年');
  },
  async (tok, S) => { // @889.0
    bad('指數成長很可怕：n = 40 不到兩週，n = 60 要三萬多年', 0, 0.1); cap('指數成長很可怕', '');
  },
  async (tok, S) => { // @902.0
    note('動手之前，先估計要花多少時間', 0, -0.6); cap('做事前先估計', '要有一點概念');
  },
]);

const fEx = (n) => 3 * n ** 3 - 20 * n ** 2 + 5 * n - 11;
scene('acD-bigo', '17C：Big-O notation 的定義', [
  async (tok, S) => { // @958.3
    hot('常用的 notation', 0, 7.2); cap('介紹常用的符號', '');
  },
  async (tok, S) => { // @983.7
    hd('Big-O notation：O(g(n))', 0, 6.45); cap('大寫的 O：Big-O notation', '');
  },
  async (tok, S) => { // @1041.3
    S.d = card('f(n) ∈ O(g(n))：存在正常數 k 和 N₀，對所有 n ≥ N₀，|f(n)| ≤ k·|g(n)|', FC.gold, 0, 5.6, 12.6, 0.6); glow(S.d, HL);
    cap('存在常數 k、N₀', 'n ≥ N₀ 時 |f(n)| ≤ k·|g(n)|');
  },
  async (tok, S) => { // @1057.1
    glow(S.d, null); sm('只看 n 夠大（n ≥ N₀）以後；前面 n 小的時候不管', 0, 4.9); cap('n 夠大以後才算', '前面小的不管');
  },
  async (tok, S) => { // @1069.1
    sm('寫成 f(n) ∈ O(g(n))，唸作「big O of g(n)」', 0, 4.35); cap('唸作 big O of g(n)', '');
  },
  async (tok, S) => { // @1139.8
    hd('例：f(n) = 3n³ − 20n² + 5n − 11', 0, 3.6); cap('舉個例子', 'f(n) = 3n³ − 20n² + 5n − 11');
  },
  async (tok, S) => { // @1174.5
    pl('n ≥ 1：|f(n)| ≤ 3n³ + 20n³ + 5n³ + 11n³ = 39n³', 0, 2.95);
    const ns = [1, 2, 3, 5, 10]; let all = true; for (let n = 1; n <= 1000; n++) all = all && Math.abs(fEx(n)) <= 39 * n ** 3;
    ns.forEach((n, i) => { const x = -4.4 + i * 2.2; sm('n = ' + n, x, 2.35); pl('|f| = ' + Math.abs(fEx(n)), x, 1.85); sm('39n³ = ' + 39 * n ** 3, x, 1.4); });
    ok(all, 0, 0.85, '程式檢查 n = 1～1000 都成立 ✓'); cap('係數取絕對值加起來：39', '|f(n)| ≤ 39n³');
  },
  async (tok, S) => { // @1186.4
    good('k = 39、N₀ = 1 ⇒ f(n) ∈ O(n³)（前面的 constant 不管）', 0, 0.25); cap('所以 f(n) 是 big O of n³', 'constant 不管它');
  },
  async (tok, S) => { // @1205.7
    sm('Big-O 告訴你：n 很大時大概的成長趨勢', 0, -0.35); cap('Big-O 看大概的趨勢', '');
  },
  async (tok, S) => { // @1236.8
    note('趨勢差很多：exponential 跟 polynomial（剛才那張表）', 0, -0.95); cap('趨勢的影響很大', '指數 vs 多項式');
  },
]);

scene('acD-dom', '17C：看長得最快的那一項', [
  async (tok, S) => { // @1267.9
    hd('n² + 17n + 3 ∈ O(n²)', 0, 6.4); const n = 100; sm('例 n = 100：n² = ' + n * n + '，17n + 3 = ' + (17 * n + 3), 0, 5.8); cap('n² + 17n + 3：big O of n²', 'n 很大時 n² 長最快');
  },
  async (tok, S) => { // @1302.7
    hd('2ⁿ + n³ + 12n（示意）∈ O(2ⁿ)', 0, 4.8); const n = 30; sm('例 n = 30：2ⁿ = ' + (2 ** n).toLocaleString('en-US') + '，n³ + 12n = ' + (n ** 3 + 12 * n).toLocaleString('en-US'), 0, 4.2); cap('exponential 比 polynomial 快多了', '所以看 2ⁿ');
  },
  async (tok, S) => { // @1321.8
    good('影響最大的 = growth 最快的那一項', 0, 3.3); cap('看 growth 最快的那一項', '');
  },
  async (tok, S) => { // @1340.1
    note('要寫實際的成長：n² 也 ≤ n⁵，但寫 O(n⁵) 沒有意義（示意）', 0, 2.4); cap('要寫有意義的那個', '不要寫一個大很多的');
  },
]);

// ════════ cM8ymJ355fc（趙啟超 17D：sorting、bubble sort、insertion sort） ════════
scene('acD-sort-def', '17D：sorting：找一個 permutation', [
  async (tok, S) => { // @3.8
    hot('Sorting algorithm：排大小', 0, 7.2); cap('sorting：把東西排大小', '通常小的在前');
  },
  async (tok, S) => { // @10.5
    S.v = [47, 73, 21]; S.c = S.v.map((v, i) => cube(String(v), FC.blue, [0.9, 0.9, 0.9], -2.0 + i * 2.0, 4.6, 0, 0.8));
    S.v.forEach((v, i) => sm('x' + sb(i + 1), -2.0 + i * 2.0, 3.85)); sm('示意', 4.0, 4.6); cap('一串不一樣的數 x₁, x₂, …, xₙ', 'sequence of distinct numbers');
  },
  async (tok, S) => { // @58.4
    sm('只要是 total order（任兩個都能比大小）的集合就能排，不一定是數字', 0, 6.4); cap('只要是 total order 就能排', '不一定是一般的數');
  },
  async (tok, S) => { // @99.5
    sm('排成 increasing order（小到大）；decreasing 也可以', 0, 5.85); cap('排成由小到大', '下面都做 increasing');
  },
  async (tok, S) => { // @161.6
    const pi = S.v.map((v, i) => i).sort((a, b) => S.v[a] - S.v[b]);
    pl('找一個 permutation π：x_π(1) < x_π(2) < ⋯ < x_π(n)', 0, 3.0);
    await moveMany(tok, pi.map((k, pos) => [S.c[k], -2.0 + pos * 2.0, 2.0]), 1000);
    pi.forEach((k, pos) => sm('π(' + (pos + 1) + ') = ' + (k + 1), -2.0 + pos * 2.0, 1.25));
    ok(pi.every((k, i) => i === 0 || S.v[pi[i - 1]] < S.v[k]), 0, 0.6, '21 < 47 < 73 ✓'); cap('用 permutation 排成小到大', 'x_π(1) < x_π(2) < ⋯');
  },
  async (tok, S) => { // @191.8
    note('permutation 是 bijection：π(1), …, π(n) 都不一樣', 0, -0.1); cap('permutation 是 bijection', '每個位置都不一樣');
  },
]);

const BUB = [47, 73, 21, 45, 28];
function arr(vals, x0, y, dx, c = FC.blue) { return vals.map((v, i) => ({ v, m: cube(String(v), c, [0.9, 0.9, 0.9], x0 + i * dx, y, 0, 0.7) })); }
async function bubblePass(tok, S, j) {
  const n = S.a.length;
  for (let i = 0; i < n - j; i++) {
    const A = S.a[i], B = S.a[i + 1]; glow(A.m, HL); glow(B.m, HL); S.cmp++; await wt(tok, 220);
    if (A.v > B.v) { await moveMany(tok, [[A.m, S.X(i + 1), S.y], [B.m, S.X(i), S.y]], 300); S.a[i] = B; S.a[i + 1] = A; }
    glow(A.m, null); glow(B.m, null);
  }
  paint(S.a[n - j].m, FC.green);
}
scene('acD-bubble', '17D：Bubble sort', [
  async (tok, S) => { // @212.7
    hot('Bubble sort（氣泡排序）', 0, 7.2); S.X = (i) => -3.6 + i * 1.8; S.y = 2.4; S.a = arr(BUB, -3.6, S.y, 1.8); S.cmp = 0;
    sm('示意：x₁…x₅ = ' + BUB.join('、'), 0, 1.3); cap('最簡單的 sorting：bubble sort', '');
  },
  async (tok, S) => { // @242.5
    S.n1 = note('像氣泡：最輕的先浮上來，再第二輕的…', 0, 3.7); cap('像氣泡一個一個浮上來', '最輕的先上來');
  },
  async (tok, S) => { // @263.4
    gone(S.n1); S.n1 = note('這裡反過來：最大的先沉到最後面', 0, 3.7); cap('這裡反過來寫', '最大的先沉下去');
  },
  async (tok, S) => { // @313.4
    gone(S.n1); S.code = code(['for j := 1 to n − 1 do', '  for i := 1 to n − j do', '    if xᵢ > xᵢ₊₁ then 交換 xᵢ、xᵢ₊₁'], -2.6, 6.3, 0.56); cap('用 pseudocode 寫', '兩層 for loop');
  },
  async (tok, S) => { // @343.3
    S.code.hl(2); await bubblePass(tok, S, 1); cap('j = 1：兩兩比，大的往後掉', '');
  },
  async (tok, S) => { // @364.9
    S.code.hl(0); S.t1 = ok(S.a[4].v === Math.max(...BUB), 0, 1.3 - 0.6, '比完一輪，最大的 ' + S.a[4].v + ' 在最後 ✓'); cap('比完一輪，最大的在最後', '');
  },
  async (tok, S) => { // @367.9
    S.code.hl(1); await bubblePass(tok, S, 2); cap('第二輪只比前面的', '第二大的掉到 n − 1');
  },
  async (tok, S) => { // @379.8
    sm('內圈：1 到 n − 1、1 到 n − 2、1 到 n − 3 …', 0, 4.4); cap('內圈 1 到 n−1、n−2、n−3…', '');
  },
  async (tok, S) => { // @392.9
    S.code.hl(2); await bubblePass(tok, S, 3); await bubblePass(tok, S, 4); paint(S.a[0].m, FC.green);
    const sorted = [...BUB].sort((a, b) => a - b); ok(S.a.every((o, i) => o.v === sorted[i]), 0, 0.1, '全部做完就排好了：' + S.a.map((o) => o.v).join(' < ') + ' ✓'); cap('一輪一輪做完就排好了', '');
  },
  async (tok, S) => { // @431.1
    S.code.hl(-1); good('就兩個 for loop', 0, -0.6); cap('bubble sort 就兩個 for loop', '');
  },
]);

scene('acD-bubble-count', '17D：Bubble sort 比較幾次', [
  async (tok, S) => { // @463.6
    hot('Bubble sort 的複雜度：數 comparison 的次數', 0, 7.2); cap('算一下複雜度', '數比大小的次數');
  },
  async (tok, S) => { // @490.6
    const n = 5; pl('第 j 個 pass：i 從 1 到 n − j → 比 n − j 次', 0, 6.4); sm('示意 n = 5', 0, 5.85);
    S.b = range(1, n - 1).map((j, k) => { const h = (n - j) * 0.7; cube(String(n - j), FC.blue, [0.9, h, 0.6], -3.0 + k * 2.0, 1.5 + h / 2, 0, 0); return sm('j = ' + j, -3.0 + k * 2.0, 1.0); }); cap('第 j 個 pass 比 n − j 次', '');
  },
  async (tok, S) => { // @540.3
    pl('total = (n − 1) + (n − 2) + ⋯ + 1', 0, 0.3); cap('全部加起來', '(n − 1) + (n − 2) + ⋯ + 1');
  },
  async (tok, S) => { // @565.3
    const n = 5, sum = range(1, n - 1).reduce((a, b) => a + b, 0); hd('= n(n − 1)/2', 0, -0.3);
    ok(sum === (n * (n - 1)) / 2, 4.6, -0.3, 'n = 5：4+3+2+1 = ' + sum + ' ✓'); cap('= n(n − 1)/2', '');
  },
  async (tok, S) => { // @574.5
    good('∈ O(n²)：看影響最大的 n² 項', 0, -0.95); cap('用 Big-O：O(n²)', '');
  },
]);

const INS = [47, 73, 21, 45, 28, 69, 19, 23];
scene('acD-insertion', '17D：Insertion sort：47 73 21 45 28 69 19 23', [
  async (tok, S) => { // @619.3
    hot('Insertion sort（插入排序）', 0, 7.2); sm('人自己排大小常常這樣做', 0, 6.55); cap('另一種：insertion sort', '人排大小常這樣做');
  },
  async (tok, S) => { // @668.6
    S.X = (i) => -5.25 + i * 1.5; S.in = INS.map((v, i) => cube(String(v), FC.sky, [1.0, 0.8, 0.8], S.X(i), 5.0, 0, 0.7)); INS.forEach((v, i) => sm(String(i + 1), S.X(i), 5.75));
    S.sorted = []; S.yS = 2.4; range(0, 7).forEach((i) => sm('·', S.X(i), S.yS - 0.7)); cap('要排這 8 個數', '一個一個拿出來塞進去');
  },
  ...INS.map((val, j) => async (tok, S) => { // @677.1 @678.2 @691.6 @715.1 @737.3 @756.7 @759.6 @775.2
    const m = S.in[j]; let i = 0;
    while (i < S.sorted.length && val > S.sorted[i].v) { glow(S.sorted[i].m, HL); await wt(tok, 140); glow(S.sorted[i].m, null); i++; }
    if (i < S.sorted.length) { glow(S.sorted[i].m, NG); await wt(tok, 160); glow(S.sorted[i].m, null); }
    const shift = S.sorted.slice(i).map((o, k) => [o.m, S.X(i + k + 1), S.yS]);
    if (shift.length) await moveMany(tok, shift, 400);
    await moveMany(tok, [[m, S.X(i), S.yS]], 500); glow(m, null);
    S.sorted.splice(i, 0, { v: val, m });
    cap([
      '第一個：47，就一個', '73 跟 47 比：比較大，放後面', '21 比 47 小：放最前面，47、73 往後移', '45：比 21 大、比 47 小',
      '28：比 21 大、比 45 小', '69：放在 47 和 73 中間', '19：最小，整排往後移', '23：19、21 比它小，28 比它大',
    ][j], S.sorted.map((o) => o.v).join(' '));
  }),
  async (tok, S) => { // @800.3
    const want = [...INS].sort((a, b) => a - b); ok(S.sorted.every((o, i) => o.v === want[i]), 0, 0.6, '一個一個塞進去，前面一直是排好的：' + S.sorted.map((o) => o.v).join(' < ') + ' ✓'); cap('這就是 insertion sort', '一次塞一個到對的位置');
  },
]);

scene('acD-ins-code', '17D：Insertion sort 的 pseudocode', [
  async (tok, S) => { // @820.5
    hot('Insertion sort 的 pseudocode', 0, 7.2);
    S.code = code(['for j := 2 to n do', '  i := 1', '  while xⱼ > xᵢ do i := i + 1', '  temp := xⱼ', '  for k := 0 to j − i − 1 do', '    xⱼ₋ₖ := xⱼ₋ₖ₋₁', '  xᵢ := temp'], -3.4, 6.4, 0.5);
    sm('（類似 Pascal 的 begin … end 格式）', 3.6, 6.4); cap('寫成 pseudocode', '類似 Pascal 的格式');
  },
  async (tok, S) => { // @843.9
    S.code.hl(0); sm('j 從 2 到 n：把第 j 個塞進去', 3.6, 5.7); cap('j 從 2 跑到 n', '');
  },
  async (tok, S) => { // @855.0
    S.X = (i) => -5.25 + i * 1.5; S.y = 1.6; const pre = [19, 21, 28, 45, 47, 69, 73];
    S.a = pre.map((v, i) => ({ v, m: cube(String(v), FC.blue, [1.0, 0.8, 0.8], S.X(i), S.y, 0, 0.6) }));
    S.xj = { v: 23, m: cube('23', FC.orange, [1.0, 0.8, 0.8], S.X(7), S.y, 0, 0.6) }; range(0, 7).forEach((i) => sm(String(i + 1), S.X(i), S.y - 0.75));
    sm('例（j = 8）：前面 x₁…x₇ 已經排好，要把 x₈ = 23 塞進來', 0, 2.75); cap('前面已經排好', '要把 xⱼ 塞進來');
  },
  async (tok, S) => { // @867.6
    S.code.hl(2); let i = 0;
    while (S.xj.v > S.a[i].v) { glow(S.a[i].m, HL); await wt(tok, 300); glow(S.a[i].m, null); i++; }
    glow(S.a[i].m, NG); S.i = i; S.ip = sm('i = ' + (i + 1), S.X(i), S.y + 0.75); cap('從第一個開始比', '比較大就跟下一個比');
  },
  async (tok, S) => { // @907.4
    glow(S.a[S.i].m, null); S.code.hl(3); S.tmp = sm('temp', 4.6, 3.5); await moveMany(tok, [[S.xj.m, 4.6, 4.2]], 600); cap('比到比它小的位置就停', 'xⱼ 先放到暫存 temp');
  },
  async (tok, S) => { // @921.0
    S.code.hl(5); sm('xᵢ … xⱼ₋₁ 全部往後移一格', 0, 0.35); cap('把 xᵢ 後面整段往後移一格', '');
  },
  async (tok, S) => { // @935.7
    for (let k = S.a.length - 1; k >= S.i; k--) await moveMany(tok, [[S.a[k].m, S.X(k + 1), S.y]], 250);
    cap('73、69、47、45、28 往後移', 'xᵢ 就空出來了');
  },
  async (tok, S) => { // @978.4
    S.code.hl(6); await moveMany(tok, [[S.xj.m, S.X(S.i), S.y]], 600);
    S.a.splice(S.i, 0, S.xj); ok(S.a.every((o, k) => k === 0 || S.a[k - 1].v < o.v), 0, -0.3, 'temp 放進 xᵢ：' + S.a.map((o) => o.v).join(' < ') + ' ✓'); cap('再把 temp 放進 xᵢ', '跟手寫的方法一樣');
  },
]);

scene('acD-ins-count', '17D：Insertion sort 的 worst case 與 n log n', [
  async (tok, S) => { // @1002.2
    hot('Insertion sort：比較幾次？', 0, 7.2); cap('算一下比較的次數', '');
  },
  async (tok, S) => { // @1015.8
    S.X = (i) => -5.25 + i * 1.5; const pre = [21, 28, 45, 47, 73];
    const a = pre.map((v, i) => cube(String(v), FC.blue, [1.0, 0.8, 0.8], S.X(i), 5.0, 0, 0.6)); cube('69', FC.orange, [1.0, 0.8, 0.8], S.X(6), 5.0, 0, 0.6);
    let c = 0; for (let i = 0; i < pre.length; i++) { c++; glow(a[i], HL); await wt(tok, 200); if (69 < pre[i]) break; }
    ok(c === 5, 0, 4.0, 'j = 6 塞 69：這次比了 ' + c + ' 次 ✓（也可能比 1 次就停）'); cap('69 要塞進來：比了五個', '也可能一個就停');
  },
  async (tok, S) => { // @1042.5
    sm('比較次數不一定 → 有人算 average case，有人算 worst case', 0, 3.4); cap('次數不一定', 'average 或 worst case');
  },
  async (tok, S) => { // @1053.1
    hd('今天算 worst case：比到最後才停', 0, 2.8); cap('今天算最差的情況', '');
  },
  async (tok, S) => { // @1068.3
    pl('第 j 個最多跟前面 j − 1 個都比過 → 最多 j − 1 次', 0, 2.2); cap('第 j 個最多比 j − 1 次', '');
  },
  async (tok, S) => { // @1106.9
    const n = 8, tot = range(2, n).reduce((s, j) => s + (j - 1), 0);
    pl('worst case total = 1 + 2 + ⋯ + (n − 1) = n(n − 1)/2', 0, 1.6); ok(tot === (n * (n - 1)) / 2, 0, 1.0, '示意 n = 8：1 + 2 + ⋯ + 7 = ' + tot + ' ✓'); cap('全部：1 加到 n − 1', '= n(n − 1)/2');
  },
  async (tok, S) => { // @1148.8
    good('∈ O(n²)', 0, 0.4); cap('所以還是 O(n²)', '');
  },
  async (tok, S) => { // @1158.6
    sm('bubble sort：次數固定；insertion sort：worst case；兩個都是 O(n²)', 0, -0.2); cap('兩個都是 O(n²)', 'bubble 固定、insertion 算最差');
  },
  async (tok, S) => { // @1169.2
    note('有些 sorting 在 worst case 只要 O(n log n) 次比較（用 tree 存資料，後面講）', 0, -0.8); cap('有些可以做到 n log n', '跟資料怎麼存有關');
  },
]);
  }
  // ═══ bs (Mathemaniac Burnside's Lemma, 6kfbotHL0fs) ═══
  {
const { V3, tag, cube, kill, glow, tint, anim, arrow, step, fresh } = K;
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const T = (t, c, x, y, z = 0) => tag(t, c, x, y, z);
const L = (t, c, x, y, z = 0) => { const l = tag(t, c, x, y, z); if (l.center) l.center.set(0, 0.5); return l; };
const cls = (l, c) => { if (l && l.element) l.element.className = 'lab-label ' + c; };
const setT = (l, t) => { if (l && l.element) l.element.textContent = t; };
const CAM = [[0, 4.2, 14], [0, 3.0, 0]];
const FC = { blue: '#4b9ee2', orange: '#dd8238', green: '#2fc092', purple: '#9b7ef4', red: '#d64545', sand: '#e9dcc4', gold: '#c08a1f', gray: '#cfc6b6' };
const OKG = '#0f5a3a', NG = '#7a1010', HL = '#6a4a00';
const COL = { R: '#d64545', G: '#2fc092', B: '#4b9ee2', N: '#e9dcc4' };
function scene(id, title, steps, cam = CAM) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
function board(x, yTop, dy = 0.7) {
  const ls = []; let last = null;
  return {
    add(t, c = 'note') {
      if (last && last.userData.hot) { cls(last, 'say'); last.userData.hot = false; }
      const l = L(t, c, x, yTop - ls.length * dy); ls.push(l); l.userData.hot = c === 'note'; last = l; return l;
    },
  };
}
// a cube whose 6 faces can be coloured: order +x, −x, +y, −y, +z, −z (letters R/G/B/N)
function fcube(x, y, s = 2.0, faces = 'NNNNNN') {
  const mats = [...faces].map((c) => new THREE.MeshStandardMaterial({ color: COL[c] || c, roughness: 0.55 }));
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mats);
  m.position.set(x, y, 0); m.rotation.set(0.35, -0.6, 0); m.castShadow = true;
  lab.world.add(m); m.userData.base = m.quaternion.clone(); return m;
}
const paint = (m, faces) => [...faces].forEach((c, i) => m.material[i].color.set(COL[c] || c));
// spin cube m about its own axis (local) by angle, starting from its base orientation
async function spin(tok, m, axis, angle, ms = 900) {
  const q0 = m.quaternion.clone(), a = axis.clone().normalize(), q = new THREE.Quaternion();
  await anim(tok, ms, (u) => { q.setFromAxisAngle(a, angle * u); m.quaternion.copy(q0).multiply(q); });
}
const reset = (m) => m.quaternion.copy(m.userData.base);
// a thin rod along local axis dir through cube m (child, so it turns with the cube)
function rod(m, dir, len = 3.4) {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 8), new THREE.MeshStandardMaterial({ color: '#6a4a00' }));
  r.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize()); m.add(r); return r;
}
const pair = (a, b, x, y) => [cube('', COL[a], [0.5, 0.5, 0.4], x - 0.27, y, 0), cube('', COL[b], [0.5, 0.5, 0.4], x + 0.27, y, 0)];

scene('bs-cube', '立方體塗色：旋轉後一樣的算一種', [
  async (tok, S) => { // 0.5
    S.B = board(-6.6, 6.4);
    S.B.add('紅綠藍塗立方體 6 個面');
    S.A = fcube(2.2, 3.2);
    ['R', 'G', 'B'].forEach((c, i) => cube('', COL[c], [0.5, 0.5, 0.5], 1.4 + i * 0.8, 5.6, 0, 1));
    cap('三種顏色塗立方體的 6 個面', '有幾種塗法？');
  },
  async (tok, S) => { // 10.0
    const f = 'RBGRGB';
    for (let i = 1; i <= 6; i++) { paint(S.A, f.slice(0, i) + 'NNNNNN'.slice(i)); await wt(tok, 160); }
    S.B.add('每面 3 種：3⁶ = 729');
    cap('每個面 3 種選擇', '3⁶ = 729');
  },
  async (tok, S) => { // 17.5
    await spin(tok, S.A, V3(0, 1, 0), Math.PI * 2, 1600);
    S.B.add('但立方體可以旋轉');
    cap('立方體可以轉', '轉了以後顏色換位置');
  },
  async (tok, S) => { // 25.0
    S.Bc = fcube(5.6, 3.2, 2.0, 'GBGRBR');
    T('看起來不同？', 'say', 5.6, 1.4);
    await wt(tok, 800);
    await spin(tok, S.A, V3(0, 1, 0), Math.PI / 2, 1200);
    T('A 轉 90° = B', 'good', 2.2, 1.4);
    S.B.add('轉得過去 → 算同一種', 'good');
    cap('A 轉 90° 就變成 B', '所以算同一種');
  },
  async (tok, S) => { // 40.0
    S.B.add('要數的是「軌道」（orbit）');
    cap('考慮對稱的計數', '先複習 orbit-stabilizer 定理');
  },
]);

scene('bs-orbit', '軌道與穩定子：|Orb(x)|·|Stab(x)| = |G|', [
  async (tok, S) => { // 91.5
    S.B = board(-6.6, 6.4);
    S.B.add('群 G 作用在集合 X');
    S.d = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) S.d.push(cube('', FC.gray, [0.4, 0.4, 0.4], 1.6 + c * 1.3, 4.4 - r * 1.3, 0));
    T('X（示意：12 個元素）', 'idx', 3.55, 5.4);
    S.orb = [0, 2, 5, 11]; S.orb2 = [1, 3, 4, 6, 8, 9]; S.orb3 = [7, 10];
    cap('X 的元素畫成點', 'G 是一組對稱');
  },
  async (tok, S) => { // 104.0
    S.px = T('x', 'ptr', S.d[0].position.x - 0.55, S.d[0].position.y);
    for (const i of S.orb) { tint(S.d[i], FC.gold); await wt(tok, 200); }
    S.B.add('Orb(x)：x 能到的元素');
    cap('亮的點：x 的軌道 Orb(x)', 'x 被對稱送到的地方');
  },
  async (tok, S) => { // 118.0
    glow(S.d[0], HL);
    S.B.add('Stab(x)：讓 x 不動的對稱');
    T('3 個對稱讓 x 不動（示意）', 'idx', 3.55, 0.4);
    cap('讓 x 留在原地的對稱', '構成穩定子 Stab(x)');
  },
  async (tok, S) => { // 126.0
    S.B.add('|Orb(x)|·|Stab(x)| = |G|', 'good');
    T('4 × 3 = 12 = |G|', 'good', 3.55, -0.3);
    cap('Orbit-stabilizer 定理', '|Orb(x)| · |Stab(x)| = |G|');
  },
  async (tok, S) => { // 155.0
    S.ps = T('x*', 'ptr alt', S.d[11].position.x + 0.6, S.d[11].position.y);
    cap('軌道裡另一個點 x*', '它能到哪裡？');
  },
  async (tok, S) => { // 162.0
    const p = (i) => S.d[i].position;
    S.a1 = arrow(p(11).clone(), p(0).clone(), 0x6a4a00); await wt(tok, 500);
    S.a2 = arrow(p(0).clone(), p(5).clone(), 0x0f5a3a);
    S.B.add('x* → 退回 x → 到任何亮點');
    cap('先退回 x，再走到想去的亮點', 'Orb(x*) 包含所有亮點');
  },
  async (tok, S) => { // 198.0
    const p = (i) => S.d[i].position;
    S.a3 = arrow(p(11).clone(), p(7).clone(), 0x7a1010); glow(S.d[7], NG);
    T('✗', 'bad', p(7).x, p(7).y + 0.55);
    S.B.add('暗點去不了 → Orb(x*) = Orb(x)', 'bad');
    cap('暗點：x* 到得了，x 也就到得了', '矛盾，所以去不了');
  },
  async (tok, S) => { // 220.0
    [S.a1, S.a2, S.a3].forEach(kill); glow(S.d[7], '#000000'); glow(S.d[0], '#000000');
    for (const i of S.orb2) tint(S.d[i], FC.green);
    for (const i of S.orb3) tint(S.d[i], FC.purple);
    S.B.add('每個元素恰在一個軌道', 'good');
    cap('軌道把 X 分成不重疊的幾塊', 'partition');
  },
]);

// the 2-cell strip example: X = 4 colourings (columns), G = {e, r} (rows); a cell is marked when g fixes x
const BX = [1.7, 3.0, 4.3, 5.6], BY = { e: 3.9, r: 2.7 }, HY = 5.2;
const BXS = [['R', 'R'], ['R', 'B'], ['B', 'R'], ['B', 'B']];
const BFIX = { e: [1, 1, 1, 1], r: [1, 0, 0, 1] };
scene('bs-count', '兩種數法：Σ|Fix(g)| = 軌道數 × |G|', [
  async (tok, S) => { // 227.5
    S.B = board(-6.6, 6.4);
    S.B.add('要數：轉完相異的塗色');
    S.x = BXS.map(([a, b], i) => pair(a, b, BX[i], HY));
    S.xl = T('X：2 格塗紅/藍（示意）', 'idx', 3.65, 6.1);
    cap('G 作用在所有塗色 X 上', 'X 的每個元素是一種塗法');
  },
  async (tok, S) => { // 247.8
    const [l, r] = S.x[1], cx = BX[1];
    S.ar = arrow(V3(BX[1], HY - 0.55), V3(BX[2], HY - 0.55), 0x6a4a00);
    S.rl = T('r：轉 180°', 'ptr', 3.65, HY - 1.05);
    await anim(tok, 1400, (u) => {
      const th = Math.PI * u;
      l.position.set(cx - 0.27 * Math.cos(th), HY, 0.27 * Math.sin(th));
      r.position.set(cx + 0.27 * Math.cos(th), HY, -0.27 * Math.sin(th));
    });
    S.x[2].forEach((m) => glow(m, HL));
    cap('紅藍轉 180° 就變成藍紅', '同一個軌道：轉得過去');
  },
  async (tok, S) => { // 268.1
    const [l, r] = S.x[1], cx = BX[1];
    await anim(tok, 900, (u) => {
      const th = Math.PI * (1 + u);
      l.position.set(cx - 0.27 * Math.cos(th), HY, 0.27 * Math.sin(th));
      r.position.set(cx + 0.27 * Math.cos(th), HY, -0.27 * Math.sin(th));
    });
    kill(S.ar); kill(S.rl); S.x[2].forEach((m) => glow(m, '#000000'));
    S.orb = [[0, 0, FC.gold], [1, 2, FC.green], [3, 3, FC.purple]].map(([i, j, c]) => {
      const m = cube('', c, [BX[j] - BX[i] + 1.15, 0.9, 0.1], (BX[i] + BX[j]) / 2, HY, -0.4);
      m.material.transparent = true; m.material.opacity = 0.45; return m;
    });
    kill(S.xl); S.xl = T('3 個軌道 = 3 種塗色', 'good', 3.65, 6.1);
    S.B.add('塗色數 = 軌道數');
    cap('整個軌道算同一種塗色', '數塗色 = 數軌道');
  },
  async (tok, S) => { // 295.5
    kill(S.xl);
    S.g = { e: cube('e', FC.sand, [0.7, 0.7, 0.4], 0.4, BY.e, 0, 1), r: cube('r', FC.sand, [0.7, 0.7, 0.4], 0.4, BY.r, 0, 1) };
    S.cell = {};
    for (const g of ['e', 'r']) S.cell[g] = BX.map((x) => cube('', '#efe6d4', [1.0, 1.0, 0.12], x, BY[g], -0.15));
    T('G ＼ X', 'idx', 0.4, HY);
    cap('把 G 和 X 排成一張表', 'e：不動　r：轉 180°');
  },
  async (tok, S) => { // 315.0
    S.dot = { e: [], r: [] };
    for (const g of ['e', 'r']) for (let i = 0; i < 4; i++) {
      if (BFIX[g][i]) S.dot[g][i] = cube('', OKG, [0.36, 0.36, 0.36], BX[i], BY[g], 0.15, 1.2);
      else S.dot[g][i] = T('✗', 'idx', BX[i], BY[g]);
      await wt(tok, 220);
    }
    cap('g·x = x 就打一個 ●（影片的一條線）', 'e 全部打 ●；r 只固定紅紅、藍藍');
  },
  async (tok, S) => { // 336.5
    for (const g of ['e', 'r']) {
      S.cell[g].forEach((m) => tint(m, '#f3d98a')); await wt(tok, 500);
      T(String(BFIX[g].reduce((a, b) => a + b)), 'ptr', 6.7, BY[g]);
      S.cell[g].forEach((m) => tint(m, '#efe6d4'));
    }
    S.B.add('橫著數：Σ|Fix(g)| = 6');
    cap('橫著數：每列是 |Fix(g)|', '4 + 2 = 6');
  },
  async (tok, S) => { // 381.0
    for (let i = 0; i < 4; i++) {
      ['e', 'r'].forEach((g) => tint(S.cell[g][i], '#f3d98a')); await wt(tok, 300);
      T(String(BFIX.e[i] + BFIX.r[i]), 'ptr alt', BX[i], 1.75);
      ['e', 'r'].forEach((g) => tint(S.cell[g][i], '#efe6d4'));
    }
    S.B.add('直著數：Σ|Stab(x)| = 6');
    cap('直著數：每行是 |Stab(x)|', '2、1、1、2');
  },
  async (tok, S) => { // 415.0
    for (const [i, j, t] of [[0, 0, '2'], [1, 2, '1 + 1 = 2'], [3, 3, '2']]) {
      for (let k = i; k <= j; k++) glow(S.x[k][0], HL), glow(S.x[k][1], HL);
      T(t, 'good', (BX[i] + BX[j]) / 2, 0.95); await wt(tok, 600);
      for (let k = i; k <= j; k++) glow(S.x[k][0], '#000000'), glow(S.x[k][1], '#000000');
    }
    cap('一個軌道一個軌道加：小計都是 2', '|Orb| · |Stab| = |G|');
  },
  async (tok, S) => { // 463.0
    T('3 個軌道 × 2 = 6', 'say', 3.65, 0.15);
    S.B.add('總數 = 軌道數 × |G|');
    cap('● 的總數 = 軌道數 × |G|', '3 × 2 = 6，跟橫著數一樣');
  },
  async (tok, S) => { // 475.0
    S.B.add('軌道數 = Σ|Fix(g)| / |G|', 'good');
    T('6 / 2 = 3 種', 'good', 3.65, -0.75);
    cap('Burnside 引理', '軌道數 = (1/|G|) Σ |Fix(g)|');
  },
]);

scene('bs-cube57', '立方體：|G| = 24，Σ|Fix| = 1368，答案 57', [
  async (tok, S) => { // 486.5
    S.B = board(-6.6, 6.4);
    S.B.add('N = (1/|G|) Σ|Fix(g)|');
    S.A = fcube(3.8, 3.4, 2.2, 'NNNNNN');
    cap('要算 |G| 和每個 g 的 |Fix(g)|', '');
  },
  async (tok, S) => { // 524.0
    paint(S.A, ['N', 'N', FC.gold, 'N', 'N', 'N']);
    S.r = rod(S.A, V3(0, 1, 0));
    for (let k = 0; k < 4; k++) { await spin(tok, S.A, V3(0, 1, 0), Math.PI / 2, 450); await wt(tok, 120); }
    S.B.add('|G| = 6 × 4 = 24（面的軌道 × 穩定子）');
    S.t = T('上面可到 6 個面；固定它的旋轉 4 個', 'idx', 3.8, 0.9);
    cap('上面可以轉到 6 個面，固定它的有 4 個', '|G| = 6 × 4 = 24');
  },
  async (tok, S) => { // 559.5
    kill(S.t); paint(S.A, 'RBGRGB'); reset(S.A);
    S.B.add('恆等 ×1：3⁶ = 729');
    cap('不轉：每種塗色都被固定', '3⁶ = 729');
  },
  async (tok, S) => { // 592.0
    paint(S.A, 'GGRBGG');
    await spin(tok, S.A, V3(0, 1, 0), Math.PI / 2, 1100);
    S.B.add('面軸 ±90° ×6：3³ = 27');
    cap('轉 90°：四個側面要同色', '上、下自由 → 3³');
  },
  async (tok, S) => { // 662.0
    reset(S.A); paint(S.A, 'GGRBRR');
    await spin(tok, S.A, V3(0, 1, 0), Math.PI, 1300);
    S.B.add('面軸 180° ×3：3⁴ = 81');
    cap('轉 180°：側面兩兩對調', '上、下、兩組側面 → 3⁴');
  },
  async (tok, S) => { // 684.0
    kill(S.r); reset(S.A); paint(S.A, 'RGRGRG');
    S.r = rod(S.A, V3(1, 1, 1), 4.2);
    await spin(tok, S.A, V3(1, 1, 1), Math.PI * 2 / 3, 1300);
    S.B.add('頂點軸 ±120° ×8：3² = 9');
    cap('繞長對角線轉 120°', '頂點周圍三個面同色 → 3²');
  },
  async (tok, S) => { // 712.0
    kill(S.r); reset(S.A); paint(S.A, 'RGRGBB');
    S.r = rod(S.A, V3(1, 1, 0), 4.0);
    await spin(tok, S.A, V3(1, 1, 0), Math.PI, 1300);
    S.B.add('邊軸 180° ×6：3³ = 27');
    cap('繞對邊中點轉 180°', '面兩兩對調成 3 組 → 3³');
  },
  async (tok, S) => { // 740.0
    S.B.add('1368 / 24 = 57 種', 'good');
    T('729 + 6·27 + 3·81 + 8·9 + 6·27 = 1368', 'say', 3.8, 0.9);
    cap('加總 1368，除以 24', '答案 57 種');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); mtok++; busy = false; },
  };
}
