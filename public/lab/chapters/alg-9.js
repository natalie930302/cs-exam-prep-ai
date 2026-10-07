// 演算法 第9章：NP 理論（P、NP、NP-complete、NP-hard、Reduction）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片目前都沒有逐字稿，所有場景依 CLRS 第 34 章：
//   34.1 多項式時間與判定問題、34.2 憑證驗證（HAM-CYCLE、SAT）與 NP、34.3 reduction 與 NPC 定義、
//   Cook–Levin（CIRCUIT-SAT 是 NPC）、圖 34.13 的歸約家族樹、
//   圖 34.14 的 3-CNF-SAT → CLIQUE 例子：φ = (x1 ∨ ¬x2 ∨ ¬x3) ∧ (¬x1 ∨ x2 ∨ x3) ∧ (x1 ∨ x2 ∨ x3)、
//   34.5.2 CLIQUE ↔ VERTEX-COVER（補圖）、34.5.4 HAM-CYCLE → TSP。
// 圖、電路與公式除了圖 34.14 以外都是自建的小例子（場景標題不標「CLRS 圖」）。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function reset(pos, look) { stopTimer(); epoch++; busy = false; lab.clear(); controls(''); lab.frameCamera(pos, look); }
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    fn().catch((err) => { if (!/changed/.test(err.message)) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }

  // ───────────────────────── 共用小工具 ─────────────────────────
  const C = { R: '#d64545', G: '#2fc092', B: '#4b9ee2', Y: '#e0b23c', P: '#9b7ef4', O: '#dd8238', K: '#cfc4b0', D: '#6e5f49', PK: '#e55a9b' };
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', REDEM = '#5a1010', EDGE = '#b9a888';
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
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
  function kill(o) {
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const setCls = (l, cls) => { l.element.className = 'lab-label' + (cls ? ' ' + cls : ''); };
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await wait(tok, ms / steps); } }
  function rod(a, b, color = EDGE, r = 0.05) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
    const d = b.clone().sub(a), len = Math.max(0.001, d.length());
    m.scale.set(1, len, 1);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    lab.world.add(m); return m;
  }
  const ek = (a, b) => (String(a) < String(b) ? a + '-' + b : b + '-' + a);
  function graph(nodes, edges, opt = {}) {
    const size = opt.size || [0.7, 0.5, 0.7];
    const N = {}, E = {};
    for (const id in nodes) { const [x, y, z] = nodes[id]; N[id] = cube(opt.label ? opt.label(id) : id, opt.color || C.K, size, x, y, z, opt.drop ? 2.5 : 0); }
    for (const [a, b] of edges) E[ek(a, b)] = rod(V3(...nodes[a]), V3(...nodes[b]), opt.edge || EDGE, opt.r || 0.05);
    return { N, E, pos: nodes };
  }
  function ellipse(cx, cz, rx, rz, color, y, opacity = 0.3) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 56), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.scale.set(rx, 1, rz); m.position.set(cx, y, cz); lab.world.add(m); return m;
  }
  const lit = (l) => (l > 0 ? 'x' + l : '¬x' + -l);
  const litVal = (l, a) => (l > 0 ? a[l - 1] : !a[-l - 1]);
  const clauseVal = (c, a) => c.some((l) => litVal(l, a));
  const cnfStr = (F) => F.map((c) => '(' + c.map(lit).join(' ∨ ') + ')').join(' ∧ ');

  // ═════════════════════════ 34.1：多項式 vs 指數、判定問題 ═════════════════════════
  async function scPolyExp(tok) {
    reset([0, 4.4, 14], [0, 2.8, 0]);
    const rows = [[10, '1 µs', '1 µs'], [20, '8 µs', '1 ms'], [30, '27 µs', '1 秒'], [40, '64 µs', '18 分鐘'], [50, '125 µs', '13 天'], [60, '216 µs', '36 年']];
    const H = (sec) => Math.max(0.05, (Math.log10(sec) + 7) * 0.4);
    tag('藍 = n³', 'ptr', -3.6, 0, 2.2); tag('紅 = 2ⁿ', 'ptr alt', 3.6, 0, 2.2);
    say('電腦每秒做 10⁹ 步：n³ 和 2ⁿ 各要多久？', '柱高是對數尺度：高一格 ×10');
    await wait(tok, 2600);
    for (let k = 0; k < rows.length; k++) {
      const [n, a, b] = rows[k], x = -5.5 + k * 2.2;
      tag('n=' + n, 'idx', x, 0, 1.2);
      const ma = cube('', C.B, [0.7, 1, 0.7], x - 0.4, 0.01, 0), mb = cube('', C.R, [0.7, 1, 0.7], x + 0.4, 0.01, 0);
      const ha = H(Math.pow(n, 3) / 1e9), hb = H(Math.pow(2, n) / 1e9);
      await anim(tok, 500, (t) => { ma.scale.y = ha * t; ma.position.y = ma.scale.y / 2; mb.scale.y = hb * t; mb.position.y = mb.scale.y / 2; });
      tag(a, 'idx', x - 0.45, ha + 0.35); tag(b, 'ptr alt', x + 0.45, hb + 0.35);
      say('n = ' + n + '：n³ 要 ' + a + '，2ⁿ 要 ' + b, '');
      await wait(tok, 1300);
    }
    say('多項式時間 O(nᵏ) = tractable；指數時間很快就算不完', 'P = 能在多項式時間「解」的判定問題');
    await wait(tok, 3600);
  }
  // 自建圖：{u, v, x, y} 是大小 4 的 clique
  const G6 = { nodes: { u: [-1.8, 0.3, -1.6], v: [1.8, 0.3, -1.6], w: [3.4, 0.3, 0.6], x: [1.8, 0.3, 2.2], y: [-1.8, 0.3, 2.2], z: [-3.4, 0.3, 0.3] },
    edges: [['u', 'v'], ['u', 'x'], ['u', 'y'], ['v', 'x'], ['v', 'y'], ['x', 'y'], ['w', 'z'], ['v', 'w'], ['y', 'z']] };
  async function scDecisionOpt(tok) {
    reset([0, 8.5, 8.5], [0, 0, 0.3]);
    const g = graph(G6.nodes, G6.edges, { drop: true });
    say('最佳化版：這張圖最大的 clique 有多大？', 'clique = 兩兩都有邊的一群頂點');
    await wait(tok, 3000);
    const ans = tag('', 'ptr alt', 0, 0.3, -3.2);
    const tries = [[3, ['u', 'v', 'x'], true], [4, ['u', 'v', 'x', 'y'], true], [5, null, false]];
    for (const [k, S, yes] of tries) {
      Object.values(g.N).forEach((m) => { tint(m, C.K); glow(m, null); });
      Object.values(g.E).forEach((e) => e.material.color.set(EDGE));
      txt(ans, 'k = ' + k + '：' + (yes ? 'YES' : 'NO'));
      if (S) {
        S.forEach((v) => tint(g.N[v], C.G));
        for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) g.E[ek(S[i], S[j])].material.color.set(C.Y);
      }
      say('判定版：有沒有大小 ≥ ' + k + ' 的 clique？', yes ? '有：' + S.join('、') + ' 兩兩相連' : '沒有 → 答 NO');
      await wait(tok, 2600);
    }
    say('判定版只回答 YES / NO', '會解最佳化 → 判定版馬上會；判定版也可用二分搜 k 反推最佳值');
    await wait(tok, 3400);
    say('NP 理論都用判定版（decision problem）來定義', '判定版不會比最佳化版難');
    await wait(tok, 3000);
  }

  // ═════════════════════════ 34.2：憑證驗證 ═════════════════════════
  const PHI = [[1, -2, 3], [-1, 2, 4], [2, -3, -4], [-1, -2, 3], [1, 3, 4]];
  function sat3View(F, nvar, yTop = 5.6) {
    const vars = [];
    for (let i = 0; i < nvar; i++) { vars.push(cube('x' + (i + 1) + '=?', C.K, [1.3, 0.6, 0.7], (i - (nvar - 1) / 2) * 1.7, yTop, 0)); }
    const groups = F.map((c, k) => {
      const cx = (k - (F.length - 1) / 2) * 2.6;
      const ls = c.map((l, j) => cube(lit(l), '#efe6d6', [0.78, 0.5, 0.6], cx + (j - 1) * 0.82, 2.4, 0));
      const box = cube('C' + (k + 1), C.K, [2.4, 0.4, 0.6], cx, 1.4, 0);
      return { ls, box };
    });
    return {
      vars, groups,
      show(a) {
        a.forEach((v, i) => { relabel(vars[i], 'x' + (i + 1) + '=' + (v === null ? '?' : v ? 1 : 0)); tint(vars[i], v === null ? C.K : v ? C.G : C.D); });
        if (a.some((v) => v === null)) return null;
        let all = true;
        F.forEach((c, k) => { c.forEach((l, j) => tint(groups[k].ls[j], litVal(l, a) ? C.G : '#efe6d6')); const ok = clauseVal(c, a); all = all && ok; tint(groups[k].box, ok ? C.G : C.R); });
        return all;
      },
    };
  }
  function allAssign(n) { const out = []; for (let m = 0; m < (1 << n); m++) out.push(Array.from({ length: n }, (_, i) => !!(m >> (n - 1 - i) & 1))); return out; }
  async function scSatVerify(tok) {
    reset([0, 4.4, 14.5], [0, 3.2, 0]);
    const view = sat3View(PHI, 4);
    say('3-CNF 公式 φ：5 個子句、4 個變數', 'φ = ' + cnfStr(PHI));
    await wait(tok, 3000);
    const cert = allAssign(4).find((a) => PHI.every((c) => clauseVal(c, a)));
    say('有人給你一組賦值（certificate）', '');
    for (let i = 0; i < 4; i++) { const a = cert.map((v, k) => (k <= i ? v : null)); view.show(a); await wait(tok, 500); }
    for (let k = 0; k < PHI.length; k++) {
      const part = cert.slice();
      view.show(part);
      PHI.forEach((_, kk) => { if (kk > k) { tint(view.groups[kk].box, C.K); view.groups[kk].ls.forEach((m) => tint(m, '#efe6d6')); } });
      glow(view.groups[k].box, GOLD);
      say('檢查 C' + (k + 1) + '：有一個文字為真就成立', '');
      await wait(tok, 900);
      glow(view.groups[k].box, null);
    }
    view.show(cert);
    say('全部子句都成立 → 驗證通過', '驗證只要掃過公式一次：O(公式長度)，多項式時間');
    await wait(tok, 3000);
    const cnt = tag('', 'ptr alt', 0, 0.3, 1.6);
    let found = 0;
    say('沒有憑證、自己找：最笨的方法是試遍 2⁴ = 16 種', 'n 個變數 → 2ⁿ 種');
    const all = allAssign(4);
    for (let i = 0; i < all.length; i++) {
      if (view.show(all[i])) found++;
      txt(cnt, '試了 ' + (i + 1) + ' / 16，可滿足 ' + found + ' 組');
      await wait(tok, 260);
    }
    say('「驗證」多項式，「找」目前只知道指數', 'NP：YES 的實例都有多項式長度、可多項式時間驗證的憑證');
    await wait(tok, 3800);
  }
  // HAM-CYCLE 憑證（自建 6 點圖）
  const HG = { nodes: { 1: [-3.4, 0.3, -1.6], 2: [0, 0.3, -2.4], 3: [3.4, 0.3, -1.6], 4: [3.4, 0.3, 1.6], 5: [0, 0.3, 2.4], 6: [-3.4, 0.3, 1.6] },
    edges: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 4], [2, 5], [2, 6]] };
  async function walkCert(tok, g, cert, ms) {
    const seen = new Set();
    const ball = cube('', C.R, [0.35, 0.35, 0.35], g.pos[cert[0]][0], 1.0, g.pos[cert[0]][2]);
    for (let i = 0; i < cert.length; i++) {
      const a = cert[i], b = cert[(i + 1) % cert.length];
      if (seen.has(a)) { glow(g.N[a], REDEM); kill(ball); return '頂點 ' + a + ' 出現兩次'; }
      seen.add(a); glow(g.N[a], GOLD);
      const e = g.E[ek(a, b)];
      if (!e) { glow(g.N[b], REDEM); kill(ball); return a + ' 和 ' + b + ' 之間沒有邊'; }
      e.material.color.set(C.Y);
      const p0 = g.pos[a], p1 = g.pos[b];
      await anim(tok, ms, (t) => ball.position.set(p0[0] + (p1[0] - p0[0]) * t, 1.0, p0[2] + (p1[2] - p0[2]) * t));
    }
    kill(ball);
    return seen.size === Object.keys(g.N).length ? null : '沒有走遍所有頂點';
  }
  async function scCertVerify(tok) {
    reset([0, 8.5, 8.5], [0, 0, 0.3]);
    const g = graph(HG.nodes, HG.edges, { drop: true });
    say('HAM-CYCLE：有沒有一個環路恰好經過每個頂點一次？', '');
    await wait(tok, 2600);
    const certL = tag('', 'ptr alt', 0, 0.3, -3.6);
    const good = [1, 2, 3, 4, 5, 6];
    txt(certL, '憑證：⟨1, 2, 3, 4, 5, 6⟩');
    say('有人給你一個憑證：頂點順序 ⟨1, 2, 3, 4, 5, 6⟩', '驗證者：每個頂點恰一次、相鄰兩點之間都有邊');
    await wait(tok, 2400);
    const r1 = await walkCert(tok, g, good, 700);
    say(r1 ? '驗證失敗：' + r1 : '驗證通過 → 答案 YES', '檢查 n 條邊：O(n)（用相鄰矩陣）');
    await wait(tok, 2800);
    Object.values(g.N).forEach((m) => glow(m, null));
    Object.values(g.E).forEach((e) => e.material.color.set(EDGE));
    const bad = [1, 4, 3, 2, 6, 5];
    txt(certL, '憑證：⟨' + bad.join(', ') + '⟩');
    say('換一張憑證 ⟨' + bad.join(', ') + '⟩', '');
    await wait(tok, 1600);
    const r2 = await walkCert(tok, g, bad, 600);
    say('驗證失敗：' + r2, '只代表「這張憑證」不對，不代表沒有 Hamiltonian cycle');
    await wait(tok, 3200);
    say('自己找：6 個頂點有 (6−1)!/2 = 60 種候選環路', 'n 個頂點 ≈ n! 種；驗證卻只要多項式時間');
    await wait(tok, 3200);
    say('P ⊆ NP：會在多項式時間解，就能不看憑證直接驗證', 'P = NP？目前沒人知道');
    await wait(tok, 3200);
  }

  // ═════════════════════════ 類別地圖 ═════════════════════════
  const PROBS = [
    { name: '排序', reg: 'P', pos: [-3.4, -0.1], why: 'O(n lg n)：在 P' },
    { name: '最短路徑', reg: 'P', pos: [-2.4, -0.9], why: 'Dijkstra / Bellman-Ford：多項式，在 P' },
    { name: '2-SAT', reg: 'P', pos: [-2.3, 0.8], why: '每個子句 2 個文字：可用強連通元件在線性時間解，在 P' },
    { name: 'SAT', reg: 'NPC', pos: [1.0, -1.2], why: 'Cook–Levin：第一個（經由 CIRCUIT-SAT）被證明的 NPC' },
    { name: '3-SAT', reg: 'NPC', pos: [2.2, -1.2], why: 'SAT ≤p 3-CNF-SAT：NPC' },
    { name: 'Clique', reg: 'NPC', pos: [1.0, 0], why: '3-CNF-SAT ≤p CLIQUE：NPC（判定版）' },
    { name: 'VC', reg: 'NPC', pos: [2.2, 0], why: 'CLIQUE ≤p VERTEX-COVER（取補圖）：NPC' },
    { name: 'HC', reg: 'NPC', pos: [0.9, 1.25], why: 'VERTEX-COVER ≤p HAM-CYCLE：NPC' },
    { name: 'Subset sum', reg: 'NPC', pos: [2.4, 1.25], why: '3-CNF-SAT ≤p SUBSET-SUM：NPC' },
    { name: 'TSP 最佳化', reg: 'NPH', pos: [4.6, -1.0], why: '求最小成本（不是 YES/NO）：NP-hard，但不是判定問題所以不在 NP' },
    { name: 'Halting', reg: 'NPH', pos: [5.0, 0.9], why: '停機問題不可判定：NP-hard，但連演算法都沒有，不在 NP' },
    { name: '質因數分解', reg: 'NP', pos: [-0.3, -1.6], why: '判定版在 NP（∩ co-NP）；目前不知道在 P，也沒被證明是 NPC' },
  ];
  function drawClasses() {
    const npE = ellipse(-1.2, 0, 4.2, 2.6, C.B, 0.02, 0.22);
    const nphE = ellipse(3.6, 0, 3.2, 2.4, C.R, 0.03, 0.2);
    const pE = ellipse(-2.6, 0, 2.0, 1.6, C.G, 0.05, 0.35);
    const labels = { NP: tag('NP', 'ptr', -1.2, 0.1, -2.95), P: tag('P', 'ptr', -2.6, 0.1, -1.95), NPH: tag('NP-hard', 'ptr alt', 5.1, 0.1, -2.6), NPC: tag('NP-complete = NP ∩ NP-hard', 'ptr alt', 1.7, 0.1, 2.75) };
    return { npE, nphE, pE, labels };
  }
  async function scClassSets(tok) {
    reset([0, 9, 7.8], [0.6, 0, 0.3]);
    const R = drawClasses();
    say('假設 P ≠ NP 時的類別地圖', 'P ⊆ NP；NPC = NP ∩ NP-hard');
    await wait(tok, 3200);
    for (const reg of ['P', 'NPC', 'NPH', 'NP']) {
      const ps = PROBS.filter((p) => p.reg === reg);
      say({ P: 'P：多項式時間可解', NPC: 'NP-complete：在 NP，而且所有 NP 問題都能歸約到它', NPH: 'NP-hard：至少和 NPC 一樣難，但不一定在 NP', NP: 'NP 裡也有「不知道」的問題' }[reg],
        { P: '排序、最短路徑、2-SAT', NPC: 'SAT、3-SAT、Clique、VC、HC、Subset sum（判定版）', NPH: 'TSP 最佳化版、停機問題', NP: '例：質因數分解（判定版）' }[reg]);
      for (const p of ps) { cube(p.name, { P: C.G, NPC: C.O, NPH: C.R, NP: C.B }[reg], [0.5, 0.35, 0.5], p.pos[0], 0.3, p.pos[1], 2.5); await wait(tok, 500); }
      await wait(tok, 2200);
    }
    say('只要任何一個 NPC 問題有多項式解 → P = NP', '反之若 P ≠ NP，NPC 問題都不在 P');
    await wait(tok, 3200);
    say('如果 P = NP：P 撐滿整個 NP', 'NPC 問題全部變成多項式可解');
    const r0 = [2.0, 1.6], c0 = -2.6;
    await anim(tok, 1600, (t) => { R.pE.scale.x = r0[0] + (4.2 - r0[0]) * t; R.pE.scale.z = r0[1] + (2.6 - r0[1]) * t; R.pE.position.x = c0 + (-1.2 - c0) * t; });
    txt(R.labels.P, 'P = NP');
    await wait(tok, 3000);
  }

  // ═════════════════════════ 34.3：Reduction、Cook–Levin ═════════════════════════
  async function scReduction(tok) {
    reset([0, 4.4, 13.5], [0, 2.6, 0]);
    const y = 2.4;
    const bx = cube('A 的實例 α', C.B, [2.2, 0.9, 1], -5.0, y, 0, 3);
    await wait(tok, 600);
    const bf = cube('f：多項式時間', C.Y, [2.2, 0.9, 1], -1.7, y, 0, 3);
    await wait(tok, 600);
    const bb = cube('B 的演算法', C.P, [2.2, 0.9, 1], 1.7, y, 0, 3);
    await wait(tok, 600);
    const out = cube('YES / NO', C.K, [1.8, 0.9, 1], 4.9, y, 0, 3);
    rod(V3(-3.9, y, 0), V3(-2.8, y, 0), C.D, 0.05); rod(V3(-0.6, y, 0), V3(0.6, y, 0), C.D, 0.05); rod(V3(2.8, y, 0), V3(4.0, y, 0), C.D, 0.05);
    tag('β = f(α)：B 的實例', 'idx', 0, y + 1.0);
    say('Reduction：把 A 的輸入「翻譯」成 B 的輸入', 'α 在 A 答 YES ⇔ f(α) 在 B 答 YES');
    await wait(tok, 3200);
    const tokB = cube('α', C.R, [0.5, 0.5, 0.5], -5.0, y + 1.0, 0);
    for (const [x, lbl] of [[-1.7, 'α'], [0, 'β'], [1.7, 'β'], [4.9, 'YES']]) {
      move(tokB, x, y + 1.0, 0); relabel(tokB, lbl);
      await wait(tok, 900);
    }
    glow(out, GREEN); relabel(out, 'YES');
    say('用 B 的答案直接當 A 的答案', 'A ≤p B：B 會在多項式時間解 → A 也會');
    await wait(tok, 3000);
    glow(bx, null); void bf; void bb;
    say('方向：A ≤p B 表示「B 至少和 A 一樣難」', '要證新問題 B 很難：拿已知 NPC 的 A 歸約到 B');
    await wait(tok, 3400);
    say('A 是 NPC、A ≤p B → B 是 NP-hard；再證 B ∈ NP → B 是 NPC', '常見錯誤：方向寫反成 B ≤p A');
    await wait(tok, 3600);
  }
  // 自建小電路：out = (y1 ∨ y2) ∧ ¬(y2 ∧ y3) ∧ (y1 ∨ y3)
  async function scCookLevin(tok) {
    reset([0, 4.4, 14], [0, 3.0, 0]);
    say('Cook–Levin 定理的想法', '任何 NP 問題都有多項式時間的驗證程式 V(x, y)');
    const ver = cube('驗證程式 V(x, y)', C.P, [5, 2.6, 1.2], 0, 3.0, 0, 3);
    await wait(tok, 3000);
    say('多項式時間的計算 → 展開成多項式大小的 boolean circuit', 'x 固定寫死在電路裡，只剩憑證 y 是輸入');
    fly(ver, V3(0, 6, -2));
    await wait(tok, 900);
    const IN = { y1: [-5.2, 5.0], y2: [-5.2, 3.2], y3: [-5.2, 1.4] };
    const GT = { g1: ['OR', -2.4, 5.0, ['y1', 'y2']], g2: ['AND', -2.4, 3.2, ['y2', 'y3']], g3: ['OR', -2.4, 1.4, ['y1', 'y3']], g4: ['NOT', 0.6, 3.2, ['g2']], out: ['AND', 3.6, 3.2, ['g1', 'g4', 'g3']] };
    const M = {};
    for (const k in IN) M[k] = cube(k + '=?', C.K, [1.3, 0.6, 0.7], IN[k][0], IN[k][1], 0, 2);
    for (const k in GT) { const [op, x, y] = GT[k]; M[k] = cube(op, C.K, [1.3, 0.6, 0.7], x, y, 0, 2); }
    const P = (k) => (IN[k] ? IN[k] : [GT[k][1], GT[k][2]]);
    for (const k in GT) for (const s of GT[k][3]) rod(V3(P(s)[0] + 0.65, P(s)[1], 0), V3(P(k)[0] - 0.65, P(k)[1], 0), EDGE, 0.04);
    tag('輸出', 'ptr alt', 5.2, 3.2);
    await wait(tok, 2000);
    say('問：有沒有一組 y 讓輸出 = 1？', '這就是 CIRCUIT-SAT');
    await wait(tok, 2400);
    const val = {};
    const ev = (k) => { const [op, , , src] = GT[k]; const v = src.map((s) => val[s]); return op === 'OR' ? v.some(Boolean) : op === 'AND' ? v.every(Boolean) : !v[0]; };
    for (const a of [[0, 0, 0], [0, 1, 1], [1, 0, 0]]) {
      ['y1', 'y2', 'y3'].forEach((k, i) => { val[k] = !!a[i]; relabel(M[k], k + '=' + a[i]); tint(M[k], a[i] ? C.G : C.D); });
      for (const k of ['g1', 'g2', 'g3', 'g4', 'out']) { val[k] = ev(k); tint(M[k], val[k] ? C.G : C.D); await wait(tok, 350); }
      say('y = ' + a.join('') + ' → 輸出 ' + (val.out ? 1 : 0), val.out ? '找到了：x 的答案是 YES' : '');
      await wait(tok, 1600);
    }
    say('x ∈ L ⇔ 電路可滿足：每個 NP 問題 ≤p CIRCUIT-SAT', 'CIRCUIT-SAT ∈ NP → CIRCUIT-SAT 是 NPC（Cook 1971、Levin）');
    await wait(tok, 3600);
    say('每個邏輯閘再寫成幾個子句 → SAT 也是 NPC', 'CIRCUIT-SAT ≤p SAT');
    await wait(tok, 3000);
  }
  const TREE = [
    ['CIRCUIT-SAT', 0, 7.0, null, 'Cook–Levin：所有 NP 問題都能歸約到它'],
    ['SAT', 0, 5.95, 'CIRCUIT-SAT', '每個閘 → 一小段公式（34.4）'],
    ['3-CNF-SAT', 0, 4.9, 'SAT', '公式轉成每子句恰 3 個文字的 CNF（34.4）'],
    ['CLIQUE', -2.6, 3.85, '3-CNF-SAT', 'k 個子句 → 3k 個頂點，找 k-clique（34.5.1）'],
    ['VERTEX-COVER', -2.6, 2.8, 'CLIQUE', '取補圖：clique k ⇔ cover |V|−k（34.5.2）'],
    ['HAM-CYCLE', -2.6, 1.75, 'VERTEX-COVER', '每條邊做一個 widget（34.5.3）'],
    ['TSP', -2.6, 0.7, 'HAM-CYCLE', '圖上的邊成本 0、其他成本 1，問有沒有成本 0 的環路（34.5.4）'],
    ['SUBSET-SUM', 2.8, 3.85, '3-CNF-SAT', '變數、子句 → 十進位數字（34.5.5）'],
  ];
  function drawTree(drop) {
    const M = {}, E = {};
    for (const [nm, x, y, par] of TREE) {
      M[nm] = cube(nm, C.K, [2.9, 0.55, 0.8], x, y, 0, drop ? 2 : 0);
      if (par) { const p = TREE.find((t) => t[0] === par); E[nm] = rod(V3(p[1], p[2] - 0.3, 0), V3(x, y + 0.3, 0), EDGE, 0.05); }
    }
    return { M, E };
  }
  async function scNpcTree(tok) {
    reset([0, 4.0, 13.5], [0, 3.8, 0]);
    say('NPC 的歸約家族樹（CLRS 圖 34.13）', '箭頭：上面的問題 ≤p 下面的問題');
    const T = { M: {}, E: {} };
    for (const [nm, x, y, par, why] of TREE) {
      T.M[nm] = cube(nm, nm === 'CIRCUIT-SAT' ? C.P : C.O, [2.9, 0.55, 0.8], x, y, 0, 2);
      if (par) { const p = TREE.find((t) => t[0] === par); T.E[nm] = rod(V3(p[1], p[2] - 0.3, 0), V3(x, y + 0.3, 0), C.Y, 0.06); }
      glow(T.M[nm], GOLD);
      say(par ? par + ' ≤p ' + nm : nm + ' 是 NPC', why);
      await wait(tok, 2300);
      glow(T.M[nm], null);
      if (T.E[nm]) T.E[nm].material.color.set(EDGE);
    }
    say('每一個都靠「上一個已知 NPC」歸約過來', '所以全部都是 NP-complete');
    await wait(tok, 3400);
  }
  async function scSat3(tok) {
    reset([0, 4.4, 13.5], [0, 2.8, 0]);
    say('SAT → 3-CNF-SAT：子句太長就切開', '（常見的切子句法；CLRS 用 parse tree＋真值表，結論相同）');
    const L4 = ['x1', 'x2', 'x3', 'x4'].map((s, i) => cube(s, C.B, [0.9, 0.6, 0.7], -2.7 + i * 1.8, 5.0, 0, 2.5));
    tag('(x1 ∨ x2 ∨ x3 ∨ x4)', 'ptr', 0, 6.1);
    await wait(tok, 2600);
    move(L4[0], -5.4, 2.6, 0); move(L4[1], -4.2, 2.6, 0); move(L4[2], 2.6, 2.6, 0); move(L4[3], 3.8, 2.6, 0);
    const y1 = cube('y', C.Y, [0.9, 0.6, 0.7], -3.0, 2.6, 0, 3), y2 = cube('¬y', C.Y, [0.9, 0.6, 0.7], 1.4, 2.6, 0, 3);
    tag('(x1 ∨ x2 ∨ y)', 'ptr alt', -4.2, 3.6); tag('(¬y ∨ x3 ∨ x4)', 'ptr alt', 2.6, 3.6); tag('∧', 'val', -0.8, 2.6);
    say('加一個新變數 y，切成兩個 3 文字子句', '');
    await wait(tok, 3000);
    const cases = [
      ['x1 或 x2 為真', 'y = 0 → 第二個子句靠 ¬y 成立', [0, 1], false],
      ['x3 或 x4 為真', 'y = 1 → 第一個子句靠 y 成立', [2, 3], true],
      ['x1…x4 全假', '不管 y 是多少，總有一個子句不成立', [], null],
    ];
    for (const [cap, f, on, yv] of cases) {
      L4.forEach((m, i) => tint(m, on.includes(i) ? C.G : C.D));
      if (yv === null) { tint(y1, C.R); tint(y2, C.R); } else { tint(y1, yv ? C.G : C.D); tint(y2, yv ? C.D : C.G); }
      say(cap, f);
      await wait(tok, 2800);
    }
    say('原子句可滿足 ⇔ 新的兩個子句可同時滿足', 'k 個文字的子句 → k−2 個 3 文字子句，多項式大小');
    await wait(tok, 3400);
  }
  // CLRS 圖 34.14
  const PHI3 = [[1, -2, -3], [-1, 2, 3], [1, 2, 3]];
  function cliqueLayout(F) {
    const pos = {};
    const slots = [[[-1.6, -2.5], [0, -2.5], [1.6, -2.5]], [[-4.4, -0.6], [-4.4, 0.9], [-4.4, 2.4]], [[4.4, -0.6], [4.4, 0.9], [4.4, 2.4]]];
    F.forEach((c, r) => c.forEach((l, i) => { pos[r + '.' + i] = [slots[r][i][0], 0.3, slots[r][i][1]]; }));
    const edges = [];
    const ids = Object.keys(pos);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const [ra, ia] = ids[a].split('.').map(Number), [rb, ib] = ids[b].split('.').map(Number);
      if (ra !== rb && F[ra][ia] !== -F[rb][ib]) edges.push([ids[a], ids[b]]);
    }
    return { pos, edges };
  }
  async function sc3SatClique(tok) {
    reset([0, 9, 8], [0, 0, 0.2]);
    const L = cliqueLayout(PHI3);
    say('3-CNF-SAT ≤p CLIQUE（CLRS 圖 34.14）', 'φ = ' + cnfStr(PHI3));
    await wait(tok, 2600);
    say('每個子句的每個文字 → 一個頂點', '3 個子句 × 3 = 9 個頂點');
    const g = { N: {}, E: {}, pos: L.pos };
    for (const id in L.pos) {
      const [r, i] = id.split('.').map(Number);
      g.N[id] = cube(lit(PHI3[r][i]), [C.B, C.P, C.PK][r], [0.95, 0.45, 0.65], L.pos[id][0], 0.3, L.pos[id][2], 2.5);
      await wait(tok, 200);
    }
    tag('C1', 'ptr alt', -2.8, 0.3, -2.5); tag('C2', 'ptr alt', -4.4, 0.3, -1.6); tag('C3', 'ptr alt', 4.4, 0.3, -1.6);
    await wait(tok, 1600);
    say('不同子句、而且不互相矛盾（不是 x 和 ¬x）就連一條邊', '同一子句內不連');
    for (const [a, b] of L.edges) { g.E[ek(a, b)] = rod(V3(...L.pos[a]), V3(...L.pos[b]), EDGE, 0.035); await wait(tok, 90); }
    say('共 ' + L.edges.length + ' 條邊；x1–¬x1 這種矛盾的不連', '問：有沒有大小 k = 3（子句數）的 clique？');
    await wait(tok, 3200);
    const asg = [false, false, true];
    say('取一組滿足 φ 的賦值：x2 = 0、x3 = 1（x1 任意）', '');
    await wait(tok, 2200);
    const pick = PHI3.map((c, r) => r + '.' + c.findIndex((l) => litVal(l, asg)));
    for (const id of pick) { tint(g.N[id], C.G); glow(g.N[id], GREEN); move(g.N[id], L.pos[id][0], 0.7, L.pos[id][2]); await wait(tok, 700); }
    say('每個子句挑一個為真的文字：¬x2、x3、x3', '');
    await wait(tok, 2000);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) g.E[ek(pick[i], pick[j])].material.color.set(C.Y);
    say('三個都兩兩相連 → 3-clique', '都為真 → 不可能互相矛盾 → 一定有邊');
    await wait(tok, 3000);
    say('反過來：k-clique 每個子句剛好一個點，把它們設為真就滿足 φ', 'φ 可滿足 ⇔ G 有 k-clique；建圖 O(k²)，多項式');
    await wait(tok, 3800);
  }
  // 自建圖：G 中 {u,v,x,y} 是 clique；補圖中它是 independent set、{w,z} 是 vertex cover
  const CV = { ids: ['u', 'v', 'w', 'x', 'y', 'z'], G: [['u', 'v'], ['u', 'x'], ['u', 'y'], ['v', 'x'], ['v', 'y'], ['x', 'y'], ['v', 'z'], ['w', 'z']] };
  function complementEdges(ids, E) {
    const has = new Set(E.map(([a, b]) => ek(a, b))), out = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!has.has(ek(ids[i], ids[j]))) out.push([ids[i], ids[j]]);
    return out;
  }
  function hexPos(ids, cx, cz, r, y = 0.3) { const P = {}; ids.forEach((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ids.length; P[v] = [cx + r * Math.cos(a), y, cz + r * Math.sin(a) * 0.85]; }); return P; }
  async function scCliqueIsVc(tok) {
    reset([0, 8.5, 8.5], [0, 0, 0.2]);
    const S = ['u', 'v', 'x', 'y'], rest = ['w', 'z'];
    const gL = graph(hexPos(CV.ids, -3.5, 0, 2.3), CV.G, { drop: true, size: [0.6, 0.45, 0.6] });
    tag('G', 'ptr', -3.5, 0.3, -2.9);
    say('G 中 {u, v, x, y} 兩兩相連：大小 4 的 clique', '');
    await wait(tok, 2000);
    S.forEach((v) => tint(gL.N[v], C.G));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) gL.E[ek(S[i], S[j])].material.color.set(C.Y);
    await wait(tok, 2600);
    const CE = complementEdges(CV.ids, CV.G);
    const gR = graph(hexPos(CV.ids, 3.5, 0, 2.3), CE, { drop: true, size: [0.6, 0.45, 0.6] });
    tag('補圖 Ḡ', 'ptr', 3.5, 0.3, -2.9);
    say('補圖 Ḡ：G 沒有的邊才連', '|E(G)| + |E(Ḡ)| = C(6,2) = 15');
    await wait(tok, 3000);
    S.forEach((v) => tint(gR.N[v], C.G));
    say('同一組 {u, v, x, y} 在 Ḡ 裡一條邊都沒有', '→ independent set（獨立集）');
    await wait(tok, 3000);
    rest.forEach((v) => { tint(gR.N[v], C.O); move(gR.N[v], gR.pos[v][0], 0.75, gR.pos[v][2]); });
    for (const [a, b] of CE) { gR.E[ek(a, b)].material.color.set(C.O); await wait(tok, 260); }
    say('剩下的 {w, z} 碰到 Ḡ 的每一條邊', '→ Ḡ 的 vertex cover，大小 6 − 4 = 2');
    await wait(tok, 3000);
    say('G 有 k-clique ⇔ Ḡ 有 k 個點的獨立集 ⇔ Ḡ 有 |V|−k 的 vertex cover', 'CLIQUE ≤p VERTEX-COVER：f(G, k) = (Ḡ, |V| − k)');
    await wait(tok, 4000);
  }
  async function scHamTsp(tok) {
    reset([0, 8.5, 8.5], [0, 0, 0.2]);
    const ids = ['1', '2', '3', '4', '5'];
    const P = hexPos(ids, 0, 0.2, 3.0);
    const GE = [['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['5', '1'], ['1', '3']];
    const g = graph(P, GE, { drop: true });
    say('HAM-CYCLE ≤p TSP（34.5.4）', '給一張圖 G：有沒有 Hamiltonian cycle？');
    await wait(tok, 2800);
    const has = new Set(GE.map(([a, b]) => ek(a, b)));
    const wl = [];
    say('建完全圖：G 有的邊成本 0，沒有的邊成本 1', '');
    for (const [a, b] of GE) wl.push(tag('0', 'ptr', (P[a][0] + P[b][0]) / 2, 0.75, (P[a][2] + P[b][2]) / 2));
    await wait(tok, 1400);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const k = ek(ids[i], ids[j]);
      if (has.has(k)) continue;
      g.E[k] = rod(V3(...P[ids[i]]), V3(...P[ids[j]]), C.R, 0.035);
      wl.push(tag('1', 'ptr alt', (P[ids[i]][0] + P[ids[j]][0]) / 2, 0.75, (P[ids[i]][2] + P[ids[j]][2]) / 2));
      await wait(tok, 600);
    }
    say('問 TSP：有沒有成本 ≤ 0 的環路？', '');
    await wait(tok, 2200);
    const tour = ['1', '2', '3', '4', '5', '1'];
    for (let i = 0; i + 1 < tour.length; i++) { g.E[ek(tour[i], tour[i + 1])].material.color.set(C.G); glow(g.N[tour[i]], GREEN); await wait(tok, 500); }
    say('成本 0 的環路只能走 G 的邊 → 就是 G 的 Hamiltonian cycle', 'G 有 HC ⇔ TSP 有成本 0 的 tour；建圖 O(n²)');
    await wait(tok, 3800);
    say('所以 TSP（判定版）是 NP-complete', 'TSP ∈ NP：憑證是環路本身，加總成本即可驗證');
    await wait(tok, 3200);
  }
  async function scProofSteps(tok) {
    reset([0, 4.6, 13.5], [0, 2.8, 0]);
    const steps = [
      ['① 證 L ∈ NP', '給憑證、多項式時間驗證', 'VC：憑證 V\'，檢查 |V\'| ≤ k、每條邊都被蓋到：O(V + E)', '檢查 V\' 蓋住每條邊'],
      ['② 選已知 NPC 的 L\'', '要從它出發', '選 CLIQUE（已知 NPC）', 'L′ = CLIQUE'],
      ['③ 構造多項式時間的 f', 'L\' 的實例 → L 的實例', 'f(G, k) = (Ḡ, |V| − k)：建補圖 O(V²)', 'f(G,k) = (Ḡ, |V|−k)'],
      ['④ 證 x ∈ L\' ⇔ f(x) ∈ L', '兩個方向都要證', 'G 有 k-clique ⇔ Ḡ 有 |V|−k 的 cover', 'clique ⇔ cover'],
    ];
    say('證明「L 是 NP-complete」的四個步驟', '以 VERTEX-COVER 為例');
    await wait(tok, 2600);
    for (let i = 0; i < steps.length; i++) {
      const [t, s, ex, exS] = steps[i];
      const y = 6.0 - i * 1.5;
      cube(t, [C.B, C.P, C.Y, C.O][i], [4.0, 0.7, 0.9], -3.2, y, 0, 3);
      tag(s, 'idx', -3.2, y - 0.6, 0.5);
      say(t + '：' + s, ex);
      await wait(tok, 600);
      tag(exS, 'ptr alt', 3.2, y);
      await wait(tok, 2800);
    }
    say('①＋②～④ → NP-complete；只做 ②～④ → NP-hard', '方向：已知 NPC ≤p 新問題（不是反過來）');
    await wait(tok, 3800);
  }

  // ═════════════════════════ 互動模式 ═════════════════════════
  // ── 類別地圖 ──
  const cs = {};
  function enterSets() {
    reset([0, 9, 7.8], [0.6, 0, 0.3]);
    cs.R = drawClasses(); cs.placed = new Set(); cs.peq = false;
    controls('<select id="sP">' + PROBS.map((p, i) => '<option value="' + i + '">' + p.name + '</option>').join('') + '</select><button class="primary" id="sPut">放進地圖</button><button id="sAll">全部放</button><button id="sEq">假設 P = NP</button>');
    on('sPut', () => csPut(Number($('sP').value)));
    on('sAll', () => PROBS.forEach((_, i) => csPut(i, true)));
    on('sEq', () => runOp(csToggle));
    log('選一個問題放進類別地圖（假設 P ≠ NP）。綠 = P、藍 = NP、紅 = NP-hard，NP 與 NP-hard 重疊處 = NP-complete。');
    csState();
  }
  function csPut(i, quiet) {
    const p = PROBS[i];
    if (cs.placed.has(i)) { if (!quiet) log(p.name + ' 已經在地圖上了。', true); return; }
    cs.placed.add(i);
    cube(p.name, { P: C.G, NPC: C.O, NPH: C.R, NP: C.B }[p.reg], [0.5, 0.35, 0.5], p.pos[0], 0.3, p.pos[1], 2.5);
    log(p.name + '：' + p.why);
    csState();
  }
  async function csToggle() {
    const to = !cs.peq, pE = cs.R.pE;
    const a = to ? [2.0, 1.6, -2.6] : [4.2, 2.6, -1.2], b = to ? [4.2, 2.6, -1.2] : [2.0, 1.6, -2.6];
    for (let k = 1; k <= 12; k++) { const t = k / 12; pE.scale.x = a[0] + (b[0] - a[0]) * t; pE.scale.z = a[1] + (b[1] - a[1]) * t; pE.position.x = a[2] + (b[2] - a[2]) * t; await wait(undefined, 40); }
    cs.peq = to;
    txt(cs.R.labels.P, to ? 'P = NP' : 'P');
    if ($('sEq')) $('sEq').textContent = to ? '回到 P ≠ NP' : '假設 P = NP';
    log(to ? '若 P = NP：所有 NP 問題（含 NPC）都多項式可解；NP-hard 但不在 NP 的（停機問題）仍然在外面。' : '回到一般相信的情況：P ≠ NP。');
    csState();
  }
  function csState() {
    setState('複雜度類別', [['已放上的問題', cs.placed.size + ' / ' + PROBS.length], ['假設', cs.peq ? 'P = NP' : 'P ≠ NP']],
      'P ⊆ NP；NPC = NP ∩ NP-hard<br>任一 NPC ∈ P ⇒ <span class="ok">P = NP</span>');
  }
  // ── 3-SAT 驗證 vs 窮舉 ──
  const st = {};
  function rand3CNF(n, m) {
    for (;;) {
      const F = Array.from({ length: m }, () => shuffle(Array.from({ length: n }, (_, i) => i + 1)).slice(0, 3).map((v) => (Math.random() < 0.5 ? v : -v)));
      if (allAssign(n).some((a) => F.every((c) => clauseVal(c, a)))) return F;
    }
  }
  function enterSat() {
    reset([0, 4.4, 14.5], [0, 3.2, 0]);
    st.F = st.F || PHI; st.a = [false, false, false, false];
    st.view = sat3View(st.F, 4);
    log('φ = ' + cnfStr(st.F));
    controls([1, 2, 3, 4].map((i) => '<button id="sx' + i + '">翻轉 x' + i + '</button>').join('') + '<button class="primary" id="sBrute">窮舉 2⁴</button><button id="sNew">換一題</button>');
    [1, 2, 3, 4].forEach((i) => on('sx' + i, () => { st.a[i - 1] = !st.a[i - 1]; satShow(); }));
    on('sBrute', () => runOp(async () => {
      let found = 0; const all = allAssign(4);
      for (const a of all) { st.a = a.slice(); if (st.view.show(a)) found++; await wait(undefined, 140); }
      log('窮舉 16 組，共 ' + found + ' 組可滿足。n 個變數就要試 2ⁿ 組。');
      satShow();
    }));
    on('sNew', () => { st.F = rand3CNF(4, 5); clearLog(); enterSat(); });
    log('翻轉 x1–x4 當作一張憑證，紅色子句 = 沒被滿足。驗證只要逐一檢查子句。');
    satShow();
  }
  function satShow() {
    const ok = st.view.show(st.a);
    const bad = st.F.map((c, k) => (clauseVal(c, st.a) ? null : 'C' + (k + 1))).filter(Boolean);
    setState('3-CNF-SAT：驗證一張憑證', [['賦值', st.a.map((v, i) => 'x' + (i + 1) + '=' + (v ? 1 : 0)).join(' ')], ['沒滿足的子句', bad.length ? bad.join('、') : '無'], ['結果', ok ? '滿足 φ' : '不滿足']],
      '驗證：O(公式長度) → <span class="ok">3-SAT ∈ NP</span><br>窮舉：O(2ⁿ · 長度)');
  }
  // ── 3-SAT → Clique ──
  const cq = {};
  function enterClique() {
    reset([0, 9, 8], [0, 0, 0.2]);
    cq.F = cq.F || PHI3; cq.a = [false, false, true];
    const L = cliqueLayout(cq.F); cq.L = L;
    cq.g = { N: {}, E: {} };
    for (const id in L.pos) { const [r, i] = id.split('.').map(Number); cq.g.N[id] = cube(lit(cq.F[r][i]), [C.B, C.P, C.PK][r], [0.95, 0.45, 0.65], L.pos[id][0], 0.3, L.pos[id][2]); }
    for (const [a, b] of L.edges) cq.g.E[ek(a, b)] = rod(V3(...L.pos[a]), V3(...L.pos[b]), EDGE, 0.035);
    log('φ = ' + cnfStr(cq.F));
    controls([1, 2, 3].map((i) => '<button id="cx' + i + '">翻轉 x' + i + '</button>').join('') + '<button class="primary" id="cFind">每子句挑一個真文字</button><button id="cNew">換公式</button>');
    [1, 2, 3].forEach((i) => on('cx' + i, () => { cq.a[i - 1] = !cq.a[i - 1]; cqReset(); cqState(); }));
    on('cFind', cqFind);
    on('cNew', () => { cq.F = rand3CNF(3, 3); clearLog(); enterClique(); });
    log('9 個頂點 = 3 個子句 × 3 個文字；不同子句且不矛盾的文字之間有邊。k = 3。');
    cqState();
  }
  function cqReset() {
    for (const id in cq.g.N) { const [r] = id.split('.').map(Number); tint(cq.g.N[id], [C.B, C.P, C.PK][r]); glow(cq.g.N[id], null); cq.g.N[id].position.y = 0.3; }
    for (const k in cq.g.E) cq.g.E[k].material.color.set(EDGE);
  }
  function cqFind() {
    cqReset();
    const pick = [];
    for (let r = 0; r < cq.F.length; r++) {
      const i = cq.F[r].findIndex((l) => litVal(l, cq.a));
      if (i < 0) { log('C' + (r + 1) + ' ' + '(' + cq.F[r].map(lit).join(' ∨ ') + ') 在這組賦值下全假：挑不出點，這組賦值不滿足 φ。', true); return; }
      pick.push(r + '.' + i);
    }
    pick.forEach((id) => { tint(cq.g.N[id], C.G); glow(cq.g.N[id], GREEN); cq.g.N[id].position.y = 0.7; });
    for (let i = 0; i < pick.length; i++) for (let j = i + 1; j < pick.length; j++) cq.g.E[ek(pick[i], pick[j])].material.color.set(C.Y);
    log('挑到 ' + pick.map((id) => { const [r, i] = id.split('.').map(Number); return lit(cq.F[r][i]) + '（C' + (r + 1) + '）'; }).join('、') + '：兩兩都有邊 → 3-clique。');
  }
  function cqState() {
    const ok = cq.F.every((c) => clauseVal(c, cq.a));
    setState('3-CNF-SAT ≤p CLIQUE', [['賦值', cq.a.map((v, i) => 'x' + (i + 1) + '=' + (v ? 1 : 0)).join(' ')], ['φ', ok ? '滿足' : '不滿足'], ['頂點 / 邊', '9 / ' + cq.L.edges.length], ['找的 clique 大小 k', '3']],
      'φ 可滿足 ⇔ 圖有 k-clique（k = 子句數）');
  }
  // ── Clique / IS / VC ──
  const cv = {};
  function enterCvi() {
    reset([0, 8.5, 8.5], [0, 0, 0.2]);
    const ids = ['1', '2', '3', '4', '5', '6'];
    if (!cv.E) { const all = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) all.push([ids[i], ids[j]]); cv.E = shuffle(all).slice(0, 7 + rnd(3)); }
    cv.ids = ids; cv.S = cv.S || new Set(); cv.comp = !!cv.comp;
    cv.P = hexPos(ids, 0, 0.2, 3.2);
    const E = cv.comp ? complementEdges(ids, cv.E) : cv.E;
    cv.g = graph(cv.P, E);
    tag(cv.comp ? '補圖 Ḡ' : 'G', 'ptr', 0, 0.3, -3.6);
    controls(ids.map((v) => '<button id="v' + v + '">頂點 ' + v + '</button>').join('') + '<button class="primary" id="vComp">切換 G / Ḡ</button><button id="vNew">換圖</button>');
    ids.forEach((v) => on('v' + v, () => { if (cv.S.has(v)) cv.S.delete(v); else cv.S.add(v); cvShow(); }));
    on('vComp', () => { cv.comp = !cv.comp; clearLog(); enterCvi(); });
    on('vNew', () => { cv.E = null; cv.S = new Set(); cv.comp = false; clearLog(); enterCvi(); });
    log('按頂點把它放進 S（紫色）。看 S 在 G 是不是 clique、在 Ḡ 是不是獨立集，以及 V − S 是不是 Ḡ 的 vertex cover。');
    cvShow();
  }
  function cvShow() {
    const S = [...cv.S], R = cv.ids.filter((v) => !cv.S.has(v));
    const hasG = new Set(cv.E.map(([a, b]) => ek(a, b)));
    const shown = cv.comp ? complementEdges(cv.ids, cv.E) : cv.E;
    cv.ids.forEach((v) => { tint(cv.g.N[v], cv.S.has(v) ? C.P : C.K); cv.g.N[v].position.y = cv.S.has(v) ? 0.7 : 0.3; });
    for (const [a, b] of shown) { const inS = cv.S.has(a) && cv.S.has(b); cv.g.E[ek(a, b)].material.color.set(inS ? C.Y : EDGE); }
    let clique = true; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (!hasG.has(ek(S[i], S[j]))) clique = false;
    const compE = complementEdges(cv.ids, cv.E);
    const isG = cv.E.every(([a, b]) => !(cv.S.has(a) && cv.S.has(b)));
    const vcComp = compE.every(([a, b]) => !cv.S.has(a) || !cv.S.has(b));
    const Y = (b) => (b ? '<span class="ok">是</span>' : '<span class="no">否</span>');
    setState('|S| = ' + S.length + '，|V − S| = ' + R.length, [['S 在 G 是 clique', Y(clique)], ['S 在 Ḡ 是獨立集', Y(clique)], ['V − S 是 Ḡ 的 vertex cover', Y(vcComp)], ['S 在 G 是獨立集', Y(isG)]],
      'clique(G) ⇔ 獨立集(Ḡ) ⇔ V − S 是 Ḡ 的 cover<br>大小：k ↔ |V| − k');
  }
  // ── 歸約家族樹 ──
  const rt = {};
  function enterTree() {
    reset([0, 4.0, 13.5], [0, 3.8, 0]);
    rt.T = drawTree(false);
    const links = TREE.filter((t) => t[3]);
    controls('<select id="tL">' + links.map((t, i) => '<option value="' + i + '">' + t[3] + ' ≤p ' + t[0] + '</option>').join('') + '</select><button class="primary" id="tShow">看這條歸約</button>');
    on('tShow', () => {
      const t = links[Number($('tL').value)];
      Object.values(rt.T.M).forEach((m) => { tint(m, C.K); glow(m, null); });
      Object.values(rt.T.E).forEach((e) => e.material.color.set(EDGE));
      tint(rt.T.M[t[3]], C.B); tint(rt.T.M[t[0]], C.O); rt.T.E[t[0]].material.color.set(C.Y);
      log(t[3] + ' ≤p ' + t[0] + '：' + t[4]);
      setState(t[3] + ' ≤p ' + t[0], [['已知 NPC', t[3]], ['新證明的', t[0]]], t[4] + '<br>再加上 ' + t[0] + ' ∈ NP → <span class="ok">NP-complete</span>');
    });
    log('CLRS 圖 34.13：從 CIRCUIT-SAT 一路歸約下來。選一條箭頭看它怎麼做。');
    setState('NPC 歸約家族樹', [['根', 'CIRCUIT-SAT（Cook–Levin）'], ['問題數', String(TREE.length)]], '箭頭方向：已知 NPC ≤p 新問題');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const CLASS_Q = [
    ['排序', 'P'], ['單源最短路徑（無負邊）', 'P'], ['2-SAT', 'P'], ['最小生成樹', 'P'], ['Euler circuit 是否存在', 'P'],
    ['3-SAT', 'NP-complete'], ['CLIQUE（判定版）', 'NP-complete'], ['VERTEX-COVER（判定版）', 'NP-complete'], ['HAM-CYCLE', 'NP-complete'], ['SUBSET-SUM', 'NP-complete'], ['TSP（判定版）', 'NP-complete'], ['圖 3-著色', 'NP-complete'], ['0/1 knapsack（判定版）', 'NP-complete'],
    ['停機問題（Halting problem）', 'NP-hard 但不在 NP'], ['TSP 最佳化版（求最小成本）', 'NP-hard 但不在 NP'],
  ];
  function genQ() {
    const t = rnd(8);
    if (t <= 1) {
      const [p, a] = CLASS_Q[rnd(CLASS_Q.length)];
      return { q: '（假設 P ≠ NP）「' + p + '」屬於哪一類？', opts: ['P', 'NP-complete', 'NP-hard 但不在 NP', '不在 NP 也不是 NP-hard'], ans: a, why: a === 'P' ? '有已知的多項式時間演算法。' : a === 'NP-complete' ? '在 NP，且已有已知 NPC 問題歸約到它。' : '至少和 NPC 一樣難，但不是可在多項式時間驗證的判定問題（或根本不可判定）。' };
    }
    if (t === 2) {
      const [A, B] = shuffle(['3-SAT', 'CLIQUE', 'HAM-CYCLE', 'SUBSET-SUM']).slice(0, 1).concat(['新問題 X']);
      return { q: '已知 ' + A + ' 是 NPC。要證 ' + B + ' 是 NP-hard，應該證明哪一個？', opts: [A + ' ≤p ' + B, B + ' ≤p ' + A, B + ' ∈ P', A + ' ∈ P'], ans: A + ' ≤p ' + B, why: '把已知難的問題歸約到新問題：新問題會解 → 已知 NPC 也會解，所以新問題至少一樣難。方向反了只能證明 X 不比 A 難。' };
    }
    if (t === 3) {
      const k = 3 + rnd(6);
      return { q: '用 CLRS 的方法把有 ' + k + ' 個子句的 3-CNF 公式歸約成 CLIQUE，圖有幾個頂點？要找多大的 clique？', opts: [3 * k + ' 個頂點，找 ' + k + '-clique', k + ' 個頂點，找 3-clique', 3 * k + ' 個頂點，找 3-clique', 2 * k + ' 個頂點，找 ' + k + '-clique'], ans: 3 * k + ' 個頂點，找 ' + k + '-clique', why: '每個子句 3 個文字各一個頂點 → 3k；每個子句恰挑一個真文字 → k-clique。' };
    }
    if (t === 4) {
      const n = 6 + rnd(8), k = 2 + rnd(n - 3);
      return { q: '圖 G 有 ' + n + ' 個頂點，且有大小 ' + k + ' 的 clique。則補圖 Ḡ 一定有多大的 vertex cover？', opts: [String(n - k), String(k), String(n - k + 1), String(2 * k)], ans: String(n - k), why: 'clique V\' 在 Ḡ 是獨立集，Ḡ 的每條邊至少一端在 V − V\'，所以 V − V\' 是大小 |V| − k 的 cover。' };
    }
    if (t === 5) {
      return { q: '如果有人找到某個 NP-complete 問題的多項式時間演算法，可以推出？', opts: ['P = NP', 'P ≠ NP', '只有這個問題在 P', 'NP-hard 問題都可判定'], ans: 'P = NP', why: '所有 NP 問題都能多項式歸約到任一 NPC 問題，所以全部都能多項式時間解。' };
    }
    if (t === 6) {
      const n = 10 + rnd(30);
      return { q: 'SAT 有 ' + n + ' 個變數。給一組賦值當憑證，驗證要多久？不給憑證直接窮舉要試幾組？', opts: ['驗證 O(公式長度)；窮舉 2^' + n + ' 組', '驗證 O(2^' + n + ')；窮舉 ' + n + ' 組', '都是多項式', '驗證 O(' + n + '!)；窮舉 2^' + n + ' 組'], ans: '驗證 O(公式長度)；窮舉 2^' + n + ' 組', why: '代入後逐一檢查子句是線性的；每個變數 0/1 兩種 → 2ⁿ 組。' };
    }
    return { q: '關於 NP 的定義，下列何者正確？', opts: ['YES 的實例有多項式長度的憑證，可在多項式時間驗證', 'NP = Non-Polynomial，不能在多項式時間解', 'NP 問題一定比 P 問題難', 'NP 問題都是 NP-hard'], ans: 'YES 的實例有多項式長度的憑證，可在多項式時間驗證', why: 'NP 是 Nondeterministic Polynomial；P ⊆ NP，所以 NP 裡也有簡單的問題。' };
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

  // ───────────────────────── 場景 ─────────────────────────
  const scenes = {
    'poly-vs-exp': { title: '多項式 vs 指數：n³ 和 2ⁿ 差多少', play: scPolyExp },
    'decision-opt': { title: '判定問題 vs 最佳化問題（Clique）', play: scDecisionOpt },
    'sat-verify': { title: '憑證驗證：3-CNF 公式一次檢查完', play: scSatVerify },
    'certificate-verify': { title: 'HAM-CYCLE 的憑證：驗證很快、找很慢', play: scCertVerify },
    'class-sets': { title: 'P、NP、NP-complete、NP-hard 的關係圖', play: scClassSets },
    'reduction-idea': { title: 'Reduction：把 A 的輸入翻譯成 B 的輸入', play: scReduction },
    'cook-levin': { title: 'Cook–Levin：驗證程式 → 電路 → CIRCUIT-SAT', play: scCookLevin },
    'npc-tree': { title: 'NPC 歸約家族樹（CLRS 圖 34.13）', play: scNpcTree },
    'sat-3sat': { title: 'SAT → 3-CNF-SAT：長子句切開', play: scSat3 },
    '3sat-clique': { title: '3-CNF-SAT → CLIQUE（CLRS 圖 34.14）', play: sc3SatClique },
    'clique-is-vc': { title: 'Clique、獨立集、Vertex cover 的補圖關係', play: scCliqueIsVc },
    'ham-tsp': { title: 'HAM-CYCLE → TSP：邊成本 0／1', play: scHamTsp },
    'npc-proof-steps': { title: '證明 NP-complete 的四個步驟', play: scProofSteps },
  };

  return {
    kicker: '演算法・第 9 章',
    title: 'NP 理論：P、NP、NP-complete、NP-hard',
    color: 'var(--alg)',
    modes: [
      { id: 'sets', name: '類別地圖', enter: enterSets },
      { id: 'sat', name: '驗證 vs 窮舉', enter: enterSat },
      { id: 'clique', name: '3-SAT → Clique', enter: enterClique },
      { id: 'cvi', name: 'Clique / 獨立集 / VC', enter: enterCvi },
      { id: 'tree', name: '歸約家族樹', enter: enterTree },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['poly-vs-exp', 'decision-opt', 'sat-verify', 'certificate-verify', 'class-sets', 'reduction-idea', 'cook-levin', 'npc-tree', 'sat-3sat', '3sat-clique', 'clique-is-vc', 'ham-tsp', 'npc-proof-steps'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
