// 演算法 第9章：NP 理論（P、NP、NP-complete、NP-hard、Reduction）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 本章影片目前都沒有逐字稿，所有場景依 CLRS 第 34 章：
//   34.1 多項式時間與判定問題、34.2 憑證驗證（HAM-CYCLE、SAT）與 NP、34.3 reduction 與 NPC 定義、
//   Cook–Levin（CIRCUIT-SAT 是 NPC）、圖 34.13 的歸約家族樹、
//   圖 34.14 的 3-CNF-SAT → CLIQUE 例子：φ = (x1 ∨ ¬x2 ∨ ¬x3) ∧ (¬x1 ∨ x2 ∨ x3) ∧ (x1 ∨ x2 ∨ x3)、
//   34.5.2 CLIQUE ↔ VERTEX-COVER（補圖）、34.5.4 HAM-CYCLE → TSP。
// 圖、電路與公式除了圖 34.14 以外都是自建的小例子（場景標題不標「CLRS 圖」）。
import kit from './_kit.js';

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
    say('取一組滿足 φ 的賦值：' + asg.map((v, i) => 'x' + (i + 1) + ' = ' + (v ? 1 : 0)).join('、'), '');
    await wait(tok, 2200);
    const pick = PHI3.map((c, r) => r + '.' + c.findIndex((l) => litVal(l, asg)));
    for (const id of pick) { tint(g.N[id], C.G); glow(g.N[id], GREEN); move(g.N[id], L.pos[id][0], 0.7, L.pos[id][2]); await wait(tok, 700); }
    say('每個子句挑一個為真的文字：' + pick.map((id) => { const [r, i] = id.split('.').map(Number); return lit(PHI3[r][i]); }).join('、'), '');
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
      const o4 = [...new Set([n - k, k, n - k + 1, 2 * k, n - k - 1, n].map(String))].slice(0, 4);
      return { q: '圖 G 有 ' + n + ' 個頂點，且有大小 ' + k + ' 的 clique。則補圖 Ḡ 一定有多大的 vertex cover？', opts: o4, ans: String(n - k), why: 'clique V\' 在 Ḡ 是獨立集，Ḡ 的每條邊至少一端在 V − V\'，所以 V − V\' 是大小 |V| − k 的 cover。' };
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ np1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, arrow, ghostBox, line, GOLD, GREEN, RED, step, buddy, prop, bob, travel } = K;
// ─── PqN0aJeYtuA / 6n8vyWKGsIo（交大江蕙如 Lec22–23）、tIE2lkJv20c（P, NP 5 分鐘）、
//     e2cF8a5aAhE / qZs767KQcvE（Abdul Bari 8 / 8.1）、a_IRpiyBIm0（How to prove NP-Completeness） ───
// Cued scenes: every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s), nothing loops or replays.
// 老師投影片上的圖（MST、TSP、HC、bipartite）逐字稿沒有給數字，這裡用自建小例子；
// Bari 的 SAT 公式、CDP 公式、搜尋 key = 9 在 index 4、江老師的 1000/500/250/375 二分搜、cost 1/2 + B = n 都照影片。
const prm = () => ctx.params || {};
const bx = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z, drop);
function at(P, a, b, t = 0.5, dy = 0.45) { const p = P[a], q = P[b]; return [p[0] + (q[0] - p[0]) * t, p[1] + dy, p[2] + (q[2] - p[2]) * t]; }
function wt(P, a, b, w, cls = 'idx', t = 0.5) { const m = at(P, a, b, t); return tag(String(w), cls, m[0], m[1], m[2]); }
const arr = (x1, y1, z1, x2, y2, z2, col = 0x6e5f49) => arrow(V3(x1, y1, z1), V3(x2, y2, z2), col);
const eCol = (g, a, b, col) => { const e = g.E[ek(a, b)]; if (e) e.material.color.set(col); };
function gReset(g, col = C.K) { Object.values(g.N).forEach((m) => { tint(m, col); glow(m, null); }); Object.values(g.E).forEach((e) => e.material.color.set(EDGE)); }
function ring(ids, cx, cz, r, y = 0.3) { const P = {}; ids.forEach((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ids.length; P[v] = [cx + r * Math.cos(a), y, cz + r * Math.sin(a)]; }); return P; }
async function walk(tok, P, seq, ms, y = 0.95, col = C.R) {
  const ball = cube('', col, [0.32, 0.32, 0.32], P[seq[0]][0], y, P[seq[0]][2]);
  for (let i = 0; i + 1 < seq.length; i++) {
    const a = P[seq[i]], b = P[seq[i + 1]];
    await anim(tok, ms, (t) => ball.position.set(a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t));
  }
  return ball;
}
// 一排方塊（pipeline）＋中間的連桿
function pipe(items, y) {
  const ms = items.map(([t, c, x, w]) => bx(t, c, x, y, 0, w, 3, 0.9));
  for (let i = 0; i + 1 < items.length; i++) rod(V3(items[i][2] + items[i][3] / 2, y, 0), V3(items[i + 1][2] - items[i + 1][3] / 2, y, 0), C.D, 0.05);
  return ms;
}
// friendly pictures: speech bubbles, sticky notes, travelling packets, ✓ / ✗ chips
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// slide any object (label, buddy group, plain mesh) to a point
async function slide(tok, o, x, y, z = 0, ms = 800) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a character standing on the floor; b.g is its group
const pal = (name, v, color, x, z = 0, s = 0.8) => buddy(name, v, color, x, 0, z, s);
const gone = (...os) => os.forEach((o) => { if (o) kill(o.g || o); });

// ════════ tIE2lkJv20c（Theory of Computation：P, NP, NP-Complete, NP-Hard） ════════
// 00:08 P = DTM poly time；NP = NTM poly time = DTM poly time 可驗證
FRAG.push(['np1-toc-dtm-ntm', 'P 用 DTM、NP 用 NTM（或 poly 驗證）', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.6, 0]);
  await step(tok);                                   // 0:08 the class of P
  const q = pal('decision problem', '?', '#7cb8ee', -5.2, 0.6);
  const hd = tag('Class P', 'ptr', -3.0, 4.6);
  bub('只要回答 YES / NO', -5.2, 2.2, 0.6);
  say('Class P', '先看 P 這一類');
  await step(tok);                                   // 0:09 solvable in poly time on a deterministic TM
  const dt = [];
  for (let i = 0; i < 5; i++) { dt.push(bx('', C.B, -3.6 + i * 0.75, 0.3, 0.6, 0.5, 0, 0.45, 0.5)); if (i) rod(V3(-3.6 + (i - 1) * 0.75, 0.3, 0.6), V3(-3.6 + i * 0.75, 0.3, 0.6), EDGE, 0.04); }
  tag('DTM：每一步都確定', 'idx', -2.1, 1.2, 0.6);
  for (const m of dt) { glow(m, GOLD); await beat(tok, 260); }
  q.set('YES'); q.mood('happy');
  say('DTM 一步一步、確定地算', 'poly time 內答出 YES / NO → 屬於 P');
  await step(tok);                                   // 0:20 n = input size, time n^O(1)
  note('n = input 的大小', -2.1, 2.2, 0.6);
  note('時間 = n^O(1)', -2.1, 3.0, 0.6);
  say('時間 = n^O(1)', '指數 O(1) 是常數 → n 的多項式');
  await step(tok);                                   // 0:31 now the class of NP
  tag('Class NP', 'ptr', 3.0, 4.6);
  say('Class NP');
  await step(tok);                                   // 0:32 misconception: not polynomial time
  const wrong = bad('NP = Not Polynomial？ ✗', 3.0, 3.8);
  say('最常見的誤解：NP = Not Polynomial', '錯！');
  await step(tok);                                   // 0:43 nope: nondeterministic polynomial time
  kill(wrong);
  good('NP = Nondeterministic Polynomial', 3.0, 3.8);
  say('NP = Nondeterministic Polynomial time', 'N 是 nondeterministic，不是 not');
  await step(tok);                                   // 0:51 decided on a NTM in poly time
  const lv = [[3.0], [1.8, 4.2], [1.2, 2.4, 3.6, 4.8], [0.9, 1.5, 2.1, 2.7, 3.3, 3.9, 4.5, 5.1]];
  const N = lv.map((xs, d) => xs.map((x) => bx('', C.K, x, 3.0 - d * 0.85, 0, 0.4, 0, 0.35, 0.4)));
  for (let d = 1; d < 4; d++) N[d].forEach((m, i) => { const p = N[d - 1][i >> 1].position; line(p.x, p.y, m.position.x, m.position.y, 0); });
  tag('NTM：每一步可以「猜」分支', 'idx', 3.0, 0.0, 1.0);
  let k = 5; const path = [];
  for (let d = 3; d >= 0; d--) { path.unshift(N[d][k]); k >>= 1; }
  for (const m of path) { tint(m, C.G); glow(m, GREEN); await beat(tok, 300); }
  say('NTM 同時試所有分支', '只要有一條路說 YES 就 YES；深度是 poly');
  await step(tok);                                   // 0:58 solutions verified in poly time on a DTM
  const cert = pkt('猜中的那條路 = 一個解', 3.3, 0.4, 1.0);
  await slide(tok, cert, -2.1, 0.9, 1.4, 1200);
  dt.forEach((m) => { tint(m, C.G); glow(m, GREEN); });
  good('DTM poly time 驗證 ✓', -2.1, -0.1, 1.6);
  say('等價說法：解可以被 DTM 在 poly time 內驗證', '「找」可能很難，「檢查」很快');
}]);

// 01:08 兩種可能：P ⊊ NP 或 P = NP
FRAG.push(['np1-toc-two-worlds', '兩種可能：P ⊊ NP 或 P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 1:08 two possibilities
  const l1 = tag('可能一', 'ptr', -3.4, 0.1, -2.9), l2 = tag('可能二', 'ptr', 3.4, 0.1, -2.9);
  const q1 = note('？', -3.4, 0.3, 0), q2 = note('？', 3.4, 0.3, 0);
  say('依定義有兩種可能');
  await step(tok);                                   // 1:13 all problems in P are also in NP
  kill(q1);
  ellipse(-3.4, 0, 3.0, 2.3, C.B, 0.02, 0.22); tag('NP', 'ptr', -1.6, 0.1, -1.6);
  const pE = ellipse(-3.4, 0, 1.5, 1.2, C.G, 0.05, 0.38); const pl = tag('P', 'ptr', -3.4, 0.1, 0.4);
  await anim(tok, 1000, (t) => { pE.position.x = -3.4 - 0.9 * t; pl.position.x = -3.4 - 0.9 * t; });
  say('P 的問題，NTM 也能 poly time 決定', '所以 P ⊆ NP');
  await step(tok);                                   // 1:25 P is a proper subset of NP
  txt(l1, '可能一：P ⊊ NP');
  note('NP 裡有 P 以外的問題', -2.3, 0.3, 1.4);
  say('可能一：P 是 NP 的真子集', 'P ⊊ NP');
  await step(tok);                                   // 1:28 the other possibility: P = NP
  kill(q2);
  const r = ellipse(3.4, 0, 3.0, 2.3, C.G, 0.03, 0.32);
  txt(l2, '可能二：P = NP');
  say('可能二：P = NP', '兩個圈完全一樣');
  await step(tok);                                   // 1:36 problems believed in NP turned out in P
  const m = pal('某問題', '?', '#f4a56a', -2.0, 1.2, 0.55);
  bub('以為只在 NP…', -2.0, 1.6, 1.2);
  await slide(tok, m.g, -4.2, 0, 0.6, 1000);
  m.set('P!'); m.mood('happy');
  say('有些以為不在 P 的問題，後來被證明在 P');
  await step(tok);                                   // 1:43 open problem
  glow(r, GOLD);
  note('哪一個才對？還沒人知道', 0, 0.4, 2.6);
  say('P vs NP：理論計算機科學的 open problem');
}]);

// 01:47 起 類別地圖（params.stage = nph / npc / all）
FRAG.push(['np1-toc-map', 'P、NP、NP-hard、NPC 地圖', async (tok) => {
  const st = prm().stage || 'all';
  fresh([0, 9, 7.8], [0.4, 0, 0.3]);
  const npE = ellipse(-1.4, 0, 3.8, 2.5, C.B, 0.02, 0.22), pE = ellipse(-2.9, 0, 1.8, 1.4, C.G, 0.05, 0.36);
  tag('NP', 'ptr', -1.6, 0.1, -2.8); tag('P', 'ptr', -2.9, 0.1, -1.6);
  const nphE = ellipse(3.3, 0, 3.2, 2.5, C.R, 0.03, 0.2); nphE.visible = false;
  const nphL = tag('NP-hard', 'ptr alt', 4.4, 0.1, -2.8); showL(nphL, false);
  const npcL = tag('NPC = NP ∩ NP-hard', 'ptr alt', 1.2, 0.1, 2.9); showL(npcL, false);
  if (st === 'nph') {
    await step(tok);                                 // 1:47 intrinsically harder → NP-hard
    nphE.visible = true; showL(nphL, true);
    say('NP-hard：本質上比 NP 的問題更難（或一樣難）');
    await step(tok);                                 // 2:01 "can never be in P"
    bad('影片：「永遠不可能在 P」', 4.4, 0.3, -1.6);
    note('更正：要先假設 P ≠ NP', 4.4, 0.3, -0.8);
    say('影片說 NP-hard 不可能在 P', '更正：要假設 P ≠ NP 才成立');
    await step(tok);                                 // 2:09 too broad: no poly verifiers
    bx('沒有 poly verifier 的', C.R, 4.7, 0.3, 0.4, 2.4, 2.5, 0.4, 0.5);
    say('這個分類太廣', '連沒有 poly time verifier 的問題都算');
    await step(tok);                                 // 2:15 not even decidable
    bx('Halting（不可判定）', C.R, 4.7, 0.3, 1.4, 2.4, 2.5, 0.4, 0.5);
    say('甚至包含不可判定的問題', '例如停機問題');
    await step(tok);                                 // 2:24 talks very little about complexity
    const sh = pal('', '?', '#cfc4b0', 0.9, -1.0, 0.5); sh.mood('wow');
    say('說它 NP-hard，對難度說得很少', '只知道「至少和 NP 一樣難」');
    await step(tok);                                 // 2:27 many important problems are in NP
    for (const [s, x, z] of [['TSP 判定版', -0.8, 0.9], ['SAT', -1.2, -1.0]]) { bx(s, C.O, x, 0.3, z, 1.5, 2.5, 0.4, 0.5); await beat(tok, 300); }
    say('很多實際重要的問題都在 NP 裡', '→ 下一段問：NP 裡有沒有特別難的？');
    return;
  }
  nphE.visible = true; showL(nphL, true);
  if (st === 'npc') {
    await step(tok);                                 // 2:32 problems in NP not known to be poly?
    const qq = note('NP 裡有沒有「不知道能否 poly」的？', -1.4, 0.3, 1.9);
    say('更好的問題：NP 裡有沒有特別難的？');
    await step(tok);                                 // 2:44 turns out there are
    kill(qq);
    const sat = bx('SAT', C.O, 1.2, 0.3, 0.1, 0.9, 2.5, 0.45, 0.6);
    say('答案：有');
    await step(tok);                                 // 2:46 Cook and Levin, early 1970s
    const ck = pal('Cook', '', '#9b7ef4', -5.2, 1.6, 0.5), lv = pal('Levin', '', '#7cb8ee', -4.2, 2.2, 0.5);
    ck.mood('happy'); lv.mood('happy');
    say('1970 年代初：Cook 和 Levin');
    await step(tok);                                 // 2:51 complexity related to the entire class
    const xs = [[-3.6, -0.6], [-2.4, 1.2], [-0.8, -1.6], [-1.2, 1.4]];
    for (const [x, z] of xs) { bx('', C.B, x, 0.3, z, 0.5, 0, 0.4, 0.5); rod(V3(x, 0.4, z), V3(1.2, 0.4, 0.1), C.Y, 0.03); await beat(tok, 250); }
    say('某些 NP 問題的難度和整個 NP 綁在一起');
    await step(tok);                                 // 2:56 poly algorithm for any of these → all NP poly
    tint(sat, C.G); glow(sat, GREEN);
    say('只要其中一個有 poly 演算法', '→ 所有 NP 問題都能 poly time 解');
    await step(tok);                                 // 3:08 every problem in NP reduces to NPC
    showL(npcL, true);
    for (const [x, z] of xs) { arr(x + 0.3, 0.6, z, 0.8, 0.6, 0.1 + (z - 0.1) * 0.2, 0xc08a1f); await beat(tok, 250); }
    tint(sat, C.O); glow(sat, GOLD);
    say('每個 NP 問題都 reduce 到這一類', '叫做 NP-complete');
    await step(tok);                                 // 3:21 win a million dollars
    note('解出任一 NPC → $1,000,000', 1.2, 0.4, -1.3);
    say('挑一題 NPC 給出 poly 演算法', '就能贏百萬美元');
    await step(tok);                                 // 3:36 practical: an ambitious real-time app
    const me = pal('你', '', '#f4a56a', 4.6, 1.6, 0.55);
    bub('老闆：即時解這個問題！', 4.6, 1.6, 0.4);
    me.mood('wow');
    say('被指派做一個「即時」解問題的 app', '結果它是 NPC…');
    await step(tok);                                 // 3:55 argue: best methods are exponential
    bub('目前最好的方法都是指數時間', 4.6, 1.2, 2.6);
    me.mood('happy');
    say('可以有根據地跟主管說明', '目前最好的 deterministic 方法都要指數時間');
    void ck; void lv;
    return;
  }
  // all：假設 P ≠ NP 的資訊圖
  const all = [npE, pE, nphE];
  all.forEach((e) => { e.material.opacity = 0.08; });
  await step(tok);                                   // 4:08 summarize with this infographic
  say('用一張圖總結四個類別');
  await step(tok);                                   // 4:13 most believe P ≠ NP
  note('假設 P ≠ NP（多數人相信）', 0, 0.4, -3.4);
  say('多數學者相信 P ≠ NP', '就以這種情況來看');
  await step(tok);                                   // 4:19 first P
  pE.material.opacity = 0.4; glow(pE, GREEN);
  say('P：有 poly time decider');
  await step(tok);                                   // 4:22 NP: poly deciders may or may not exist
  npE.material.opacity = 0.24;
  say('NP：poly decider 可能有、可能沒有', '但都能 poly time 驗證');
  await step(tok);                                   // 4:34 the special class: NP-complete
  showL(npcL, true); bx('NPC', C.O, 1.2, 0.3, 0.1, 0.9, 2.5, 0.45, 0.6);
  note('影片說「一定沒有」→ 其實未證明', 1.2, 0.3, 1.9);
  say('NPC：NP 裡最難的特殊類別', '影片說「一定沒有 poly decider」→ 其實還不知道');
  await step(tok);                                   // 4:47 NP-hard is too broad
  nphE.material.opacity = 0.22;
  say('NP-hard：範圍最廣', '包含 NPC，也包含不在 NP 的問題');
  await step(tok);                                   // 4:52 all problems with no poly deciders?
  bad('不是「所有沒有 poly decider 的問題」', 4.0, 0.3, 1.0);
  note('看的是：所有 NP 都能 reduce 到它', 4.0, 0.3, 1.8);
  say('影片說成「沒有 poly decider 的全部」', '更正：NP-hard = 所有 NP 問題都 ≤p 它');
}]);

// ════════ a_IRpiyBIm0（How to prove NP-Completeness - The Steps） ════════
// 01:12 decision vs optimization：最短路徑 vs「有沒有長度 ≤ k 的路」
const PH = { P: { s: [-4.6, 0.3, 0.6], a: [-1.6, 0.3, -1.3], b: [-1.6, 0.3, 2.5], c: [1.6, 0.3, 0.6], t: [4.6, 0.3, 0.6] },
  E: [['s', 'a', 2], ['s', 'b', 4], ['a', 'b', 1], ['a', 'c', 5], ['b', 'c', 2], ['c', 't', 3]] };
FRAG.push(['np1-h-dec-path', '最短路徑 vs「有長度 ≤ k 的路嗎」', async (tok) => {
  fresh([0, 8.5, 9], [0, 0, 0.2]);
  await step(tok);                                   // 1:12 decision vs optimization
  const O = bx('Optimization：找最好的', C.P, -3.2, 0.4, -3.4, 3.6, 2.5, 0.6, 0.8), D = bx('Decision：YES / NO', C.B, 3.2, 0.4, -3.4, 3.2, 2.5, 0.6, 0.8);
  say('第一件事：decision vs optimization');
  await step(tok);                                   // 1:18 NPC focuses on decision problems
  glow(D, GOLD); note('證 NPC：只看 decision 版', 3.2, 1.2, -3.4);
  say('證明 NP-completeness 時', '主要看 decision problem');
  await step(tok);                                   // 1:27 optimization: shortest path between two nodes
  glow(D, null); glow(O, GOLD);
  const g = graph(PH.P, PH.E.map((e) => [e[0], e[1]]), { drop: true });
  PH.E.forEach(([a, b, w]) => wt(PH.P, a, b, w));
  const sp = ['s', 'a', 'b', 'c', 't'];
  for (let i = 0; i + 1 < sp.length; i++) eCol(g, sp[i], sp[i + 1], C.G);
  const ball = await walk(tok, PH.P, sp, 350); kill(ball);
  const st = tag('最短 = 2+1+2+3 = 8', 'ptr alt', 0, 0.3, 3.6);
  say('Optimization 例子：s 到 t 的最短路徑');
  await step(tok);                                   // 1:44 decision version: a path of length k?
  glow(O, null); glow(D, GOLD); gReset(g); txt(st, '');
  const qb = bub('s 到 t 有長度 ≤ k 的路嗎？', 0, 1.6, -1.6);
  say('Decision 版：有沒有長度 k 的路？');
  await step(tok);                                   // 2:00 the answer is yes or no
  const yn = [good('YES', -1.0, 2.4, -1.6), bad('NO', 1.0, 2.4, -1.6)];
  say('答案只有 yes 或 no');
  await step(tok);                                   // 2:01 a much simpler problem
  note('比較簡單：只問一個問題', 3.2, 1.2, -2.6);
  say('比 optimization 簡單得多');
  await step(tok);                                   // 2:10 equal to k or less than k
  yn.forEach(kill);
  for (let i = 0; i + 1 < sp.length; i++) eCol(g, sp[i], sp[i + 1], C.Y);
  txt(st, 'k = 9：有 8 ≤ 9 的路 → YES');
  say('問「長度 = k 或 < k 的路」', '例如 k = 9 → YES');
  await step(tok);                                   // 2:20 decision versions are easier
  kill(qb);
  const cmp = tag('難度：decision ≤ optimization', 'ptr alt', 0, 1.4, -3.4);
  say('decision 版比 optimization 版簡單');
  await step(tok);                                   // 2:55 why focus on decision?
  const me = pal('', '?', '#f4a56a', 5.8, 2.6, 0.5); me.mood('wow');
  say('為什麼證明時只看 decision 版？');
  await step(tok);                                   // 3:17 decision is NPC → no efficient algorithm
  bad('連 decision 都沒有 efficient 演算法', 3.2, 1.2, -2.0);
  tint(D, C.R);
  say('如果證明 decision 版是 NPC', '→ 設計不出 efficient 演算法');
  await step(tok);                                   // 3:36 optimization is harder
  tint(O, C.R); bad('optimization 更不可能 ✗', -3.2, 1.2, -2.0);
  say('optimization 要找出最短、最小', '比 decision 更難 → 也沒有 efficient 演算法');
  await step(tok);                                   // 4:04 at least as hard
  txt(cmp, 'optimization 至少和 decision 一樣難');
  me.mood('happy');
  say('optimization 至少和 decision 一樣難');
  await step(tok);                                   // 4:19 first step: find the decision version
  note('第一步：先寫出 decision 版', 0, 0.4, -1.4);
  say('所以證 NPC 的第一步', '先把問題寫成 decision 版');
}]);

// 04:38 reduction 用來解題：α →(poly) β → B 的 poly 演算法
FRAG.push(['np1-h-reduce-solve', 'Reduction：A 轉成 B，用 B 的演算法', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  await step(tok);                                   // 4:38 the most important step: reduction
  tag('Reduction', 'ptr', 0, 5.2);
  say('最重要的一步：reduction');
  await step(tok);                                   // 5:10 decision problem A, want poly time
  const A = pal('A', '?', '#7cb8ee', -5.4, 0.8, 0.8); A.mood('wow');
  bub('想在 poly time 內解 A', -5.4, 2.6, 0.8);
  say('有一個 decision problem A', '想用 poly time 解它');
  await step(tok);                                   // 5:28 an instance of the problem
  const tk = pkt('α（A 的 instance）', -5.4, 0.4, 2.0);
  say('A 的一個具體輸入，叫 instance α');
  await step(tok);                                   // 5:39 another problem B already solved in poly
  const B = pal('B', 'poly ✓', '#2fc092', 1.8, 0.8, 0.8); B.mood('happy');
  say('另一個問題 B', '已經知道能 poly time 解');
  await step(tok);                                   // 5:58 take the help of B
  A.look(1);
  say('借 B 的力量來解 A');
  await step(tok);                                   // 6:12 transform instance of A to B in poly time
  const R = bx('reduction（poly time）', C.Y, -1.8, 0.4, 2.0, 2.6, 2.5, 0.6, 0.8);
  await slide(tok, tk, -1.8, 1.2, 2.0, 900);
  txt(tk, 'β（B 的 instance）');
  say('把 α 在 poly time 內轉成 B 的 instance β', '不會解 → 轉成會解的問題');
  await step(tok);                                   // 6:45 this figure
  await slide(tok, tk, 1.8, 1.6, 2.0, 800);
  arr(-0.4, 0.4, 2.0, 1.2, 0.4, 2.0, 0xc08a1f);
  say('圖：α →(poly 轉換)→ β → B');
  await step(tok);                                   // 7:09 a poly time algorithm solves B
  B.glow(GOLD); await B.hop(tok); B.glow(null);
  const out = pkt('答案：yes', 5.2, 1.6, 2.0);
  say('B 用它的 poly 演算法解 β');
  await step(tok);                                   // 7:15 two polynomials → polynomial for A
  A.set('poly ✓'); A.mood('happy');
  note('poly ＋ poly = poly', -1.8, 2.4, 2.0);
  say('poly 轉換 ＋ poly 解 = poly', '→ A 也能 poly time 解');
  await step(tok);                                   // 7:26 yes must map to yes, no to no
  good('α 是 yes ⇔ β 是 yes', 0, 3.6, 0);
  good('α 是 no ⇔ β 是 no', 0, 3.0, 0);
  say('最重要：yes 要對應 yes、no 對應 no', '不然 B 的答案沒辦法當 A 的答案');
  await step(tok);                                   // 7:51 recap: reduction
  void R; void out;
  say('Reduction：轉成會解的問題，再借它的演算法');
}]);

// 08:10 反證：A 沒 poly 解、A ≤p B → B 也沒有 poly 解
FRAG.push(['np1-h-contra', '反證：A 沒 poly 解 → B 也沒有', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const A = pal('A', '', '#7cb8ee', -4.6, 0.8, 0.9), B = pal('B', '', '#cfc4b0', 4.0, 0.8, 0.9);
  await step(tok);                                   // 8:10 apply reduction to prove hardness
  say('把 reduction 拿來證明「很難」');
  await step(tok);                                   // 8:26 NPC is all about showing a problem is hard
  note('NPC：證明它很難，不是證明它簡單', 0, 4.4);
  say('NP-completeness 是在證明問題很難');
  await step(tok);                                   // 8:39 focus on B
  B.glow(GOLD); B.look(-1);
  say('焦點換到 B');
  await step(tok);                                   // 9:12 show no poly solution exists for B
  const goal = note('目標：B 沒有 poly 解', 4.0, 2.9, 0.9);
  say('要證明：B 沒有 polynomial time 解');
  await step(tok);                                   // 9:19 suppose no poly solution for A
  A.set('沒有 poly 解'); A.mood('sad'); tint(A.body, C.R);
  say('已知：A 沒有 poly time 解');
  await step(tok);                                   // 9:32 a poly time reduction A → B
  const R = bx('poly reduction', C.Y, -0.3, 0.4, 0.9, 2.2, 2.5, 0.5, 0.7);
  arr(-3.6, 0.6, 0.9, 3.0, 0.6, 0.9, 0xc08a1f);
  say('而且有 A → B 的 poly time reduction');
  await step(tok);                                   // 10:02 use contradiction
  const way = tag('反證法', 'ptr alt', 0, 4.0);
  say('用反證法');
  await step(tok);                                   // 10:28 assume poly solution exists for B
  B.set('poly ✓'); B.mood('happy'); tint(B.body, C.G);
  const ass = bub('假設：B 有 poly 解', 4.0, 2.2, 0.9);
  say('先假設 B 有 poly time 解');
  await step(tok);                                   // 10:46 A → B → A solved in poly time
  const tk = pkt('A 的 instance', -4.6, 2.0, 0.9);
  await slide(tok, tk, 4.0, 2.0, 0.9, 1400);
  A.set('poly？'); tint(A.body, C.G); A.mood('wow');
  say('A 先 poly 轉成 B，再用 B 解', '→ A 也能 poly time 解？');
  await step(tok);                                   // 11:30 but no poly solution for A
  kill(tk); tint(A.body, C.R); A.set('沒有 poly 解'); A.mood('sad');
  bad('✗ 矛盾', -1.6, 2.6, 0.9);
  say('和「A 沒有 poly 解」矛盾');
  await step(tok);                                   // 11:42 cannot have a poly solution for B
  kill(ass); tint(B.body, C.R); B.set('沒有 poly 解'); B.mood('sad'); B.glow(null);
  txt(goal, 'B 沒有 poly 解 ✓');
  say('所以 B 不可能有 poly time 解');
  await step(tok);                                   // 11:54 recap
  void R; void way;
  note('① 看 decision 版　② reduction　③ 反證：B 很難', 0, 3.4, 2.6);
  say('回顧：decision 版、reduction、用反證證明 B 很難');
}]);

// 12:39 第一個 NPC：Cook–Levin 從 first principles 證 SAT；之後一個接一個加進 bucket
FRAG.push(['np1-h-bucket', 'NP-complete bucket：從 SAT 一個接一個', async (tok) => {
  fresh([0, 5.0, 12.5], [0, 1.6, 0]);
  const bk = ghostBox(0xdd8238, 8.0, 1.6, 2.2); bk.position.set(0.6, 0.8, 0);
  tag('NP-complete bucket', 'ptr alt', 0.6, 2.0, 1.2);
  await step(tok);                                   // 12:39 need a problem A known not poly
  const A = pal('A', '?', '#cfc4b0', -5.6, 1.2, 0.7); A.mood('wow');
  say('這套邏輯需要一個「已知很難」的 A');
  await step(tok);                                   // 13:03 there has to be a first NPC
  note('一定要有「第一個」NP-complete 問題', 0.6, 3.0);
  say('所以一定要有第一個 NP-complete 問題');
  await step(tok);                                   // 13:17 Cook's / Cook–Levin theorem
  const ck = pal('Cook', '', '#9b7ef4', -5.8, -1.6, 0.6), lv = pal('Levin', '', '#7cb8ee', -4.4, -1.6, 0.6);
  ck.mood('happy'); lv.mood('happy');
  say("Cook's theorem（Cook–Levin）");
  await step(tok);                                   // 13:22 from first principles: SAT is NPC
  const S = bx('SAT', C.P, -5.0, 2.6, 0, 1.4, 0, 0.6);
  glow(S, GOLD);
  say('從 first principles 直接證明', 'Boolean satisfiability 是 NP-complete');
  await step(tok);                                   // 13:42 added one problem into the bucket
  move(S, -2.6, 0.5, 0); glow(S, null);
  kill(A.g);
  say('把第一個問題放進 bucket');
  await step(tok);                                   // 13:47 others used reduction for the next problem
  const L2 = bx('L₂', C.O, 0.6, 3.2, 0, 1.2, 0, 0.6); arr(-1.9, 1.1, 0, 0.0, 2.9, 0, 0xc08a1f);
  await beat(tok, 600); move(L2, 0, 0.5, 0);
  say('其他人用 reduction 證下一個', '把它也加進 bucket');
  await step(tok);                                   // 13:58 a third: reduce from any one of the two
  const L3 = bx('L₃', C.O, 3.4, 3.2, 0, 1.2, 0, 0.6);
  arr(0.6, 1.1, 0, 3.0, 2.9, 0, 0xc08a1f); arr(-2.0, 1.1, 0.3, 2.8, 2.9, 0.3, 0x2fc092);
  await beat(tok, 600); move(L3, 2.6, 0.5, 0);
  say('第三個：從 bucket 裡任一個 reduce 過來都行');
  await step(tok);                                   // 14:09 any one poly → all poly
  for (const m of [L2, S, L3]) { tint(m, C.G); glow(m, GREEN); await beat(tok, 350); }
  say('bucket 裡任一個有 poly 解', '→ 全部都有 poly 解');
  await step(tok);                                   // 14:37 one is linked to the other
  rod(V3(-2.6, 0.5, 0), V3(0, 0.5, 0), C.Y, 0.06); rod(V3(0, 0.5, 0), V3(2.6, 0.5, 0), C.Y, 0.06);
  say('它們全部綁在一起', '解一個 = 解全部');
}]);

// 14:47 總結步驟：① L ∈ NP ② L′ ≤p L（不是 L ≤p L′）
FRAG.push(['np1-h-steps', '證 NPC：L ∈ NP，且 L′ ≤p L（方向別反）', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  await step(tok);                                   // 14:47 L: the problem you want to show NPC
  const L = pal('L', '想證 NPC', '#cfc4b0', 4.0, 0.8, 0.9);
  say('L：你想證明是 NP-complete 的問題');
  await step(tok);                                   // 15:04 L′: a well-known NPC problem
  const Lp = pal("L′", '已知 NPC', '#dd8238', -4.0, 0.8, 0.9); Lp.mood('happy');
  say("L′：一個大家都知道的 NP-complete 問題");
  await step(tok);                                   // 15:13 first: show L ∈ NP
  good('① L ∈ NP', 4.0, 3.0, 0.9);
  say('第一步：證明 L ∈ NP');
  await step(tok);                                   // 15:23 both are decision versions
  note("L、L′ 都是 decision 版", 0, 3.8);
  say("L 和 L′ 都是 decision 版", '不是 optimization 版');
  await step(tok);                                   // 15:42 second step: very important
  const warn = note('第二步：很多學生在這裡出錯！', 0, 3.1);
  say('第二步很重要', '很多學生在這裡犯錯');
  await step(tok);                                   // 15:47 reduce L′ to L
  arr(-3.0, 0.8, 0.9, 3.0, 0.8, 0.9, 0x2fc092); const ok2 = good("② L′ ≤p L ✓", 0, 1.4, 0.9);
  say("把已知 NPC 的 L′ reduce 到 L");
  await step(tok);                                   // 15:59 not the other way around
  arr(3.0, 0.3, 1.6, -3.0, 0.3, 1.6, 0xd64545); const no2 = bad("L ≤p L′ ✗", 0, 0.4, 2.2);
  L.mood('wow');
  say("不是反過來", "不要把 L reduce 到 L′");
  await step(tok);                                   // 16:10 why it doesn't make sense
  bub('只是把自己的路變難', 4.0, 2.2, 0.9);
  say("把 L 轉成難題 L′", '只代表「走這條路很難」，不代表沒有簡單解');
  await step(tok);                                   // 16:36 L′ → L: L solved ⇒ L′ solved
  kill(no2); kill(warn);
  L.set('poly?'); L.glow(GOLD); await beat(tok, 500); Lp.set('也解掉了?!'); Lp.mood('wow');
  say("L′ ≤p L：L 一旦能解", "大家都知道很難的 L′ 也能解 → L 很難");
  await step(tok);                                   // 17:07 remember: both decision problems
  L.glow(null); L.set('NP-complete'); L.mood('happy'); tint(L.body, C.O); Lp.set('已知 NPC'); Lp.mood('happy');
  void ok2;
  say('① L ∈ NP ＋ ② L′ ≤p L → L 是 NPC', '而且兩個都是 decision problem');
}]);

// ════════ e2cF8a5aAhE（Abdul Bari 8：NP-Hard and NP-Complete Problems） ════════
// 00:26 polynomial vs exponential 的演算法，研究就是想讓它們更快
FRAG.push(['np1-b-poly-exp', 'Polynomial vs exponential：研究在找更快的', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.0, 0]);
  await step(tok);                                   // 0:26 this topic is a research topic
  const R = pal('研究者', '', '#f4a56a', 0, 0, 0.7); R.g.position.set(0, 0, 2.2);
  say('這個主題和「研究」有關');
  await step(tok);                                   // 0:41 algorithms we know: polynomial / exponential
  tag('Polynomial time', 'ptr', -3.4, 6.4); tag('Exponential time', 'ptr alt', 3.4, 6.4);
  say('學過的演算法分兩類', '左：polynomial time　右：exponential time');
  await step(tok);                                   // 0:58 searching: linear n, binary log n
  const L = [];
  for (const s of ['Linear search：n', 'Binary search：log n']) { L.push(bx(s, C.G, -3.4, 5.4 - L.length * 0.95, 0, 3.6, 3, 0.6)); await beat(tok, 300); }
  say('Searching：linear n、binary log n');
  await step(tok);                                   // 1:07 sorting n², merge sort n log n
  for (const s of ['Sorting：n²', 'Merge sort：n log n']) { L.push(bx(s, C.G, -3.4, 5.4 - L.length * 0.95, 0, 3.6, 3, 0.6)); await beat(tok, 300); }
  say('Sorting：n²；merge sort 更快：n log n');
  await step(tok);                                   // 1:11 0/1 knapsack 2ⁿ, TSP 2ⁿ …
  const RP = ['0/1 Knapsack：2ⁿ', 'Traveling salesperson：2ⁿ', 'Sum of subsets：2ⁿ', 'Graph coloring：2ⁿ', 'Hamiltonian cycle：2ⁿ'];
  for (let i = 0; i < RP.length; i++) { bx(RP[i], C.O, 3.4, 5.4 - i * 0.95, 0, 3.8, 3, 0.6); await beat(tok, 250); }
  say('0/1 knapsack、TSP… 都要 2ⁿ');
  await step(tok);                                   // 1:20 could be n·2ⁿ, nⁿ — written as 2ⁿ
  note('實際可能是 n·2ⁿ、nⁿ… 統一寫 2ⁿ = 指數', 3.4, 0.3, 0.6);
  say('有的是 n·2ⁿ、有的是 nⁿ', '統一寫成 2ⁿ，表示都是指數');
  await step(tok);                                   // 1:48 want O(1) searching
  glow(L[1], GOLD); tag('→ O(1)?', 'ptr alt', -0.8, 4.45);
  R.look(-1);
  say('研究：有沒有比 binary search 更快的 O(1) 搜尋？');
  await step(tok);                                   // 2:07 want O(n) sorting
  glow(L[1], null); glow(L[3], GOLD); tag('→ O(n)?', 'ptr alt', -0.8, 2.55);
  say('有沒有比 merge sort 更快的 O(n) 排序？');
  await step(tok);                                   // 2:19 polynomial time for exponential problems
  glow(L[3], null); R.look(1);
  tag('→ polynomial?', 'ptr alt', 3.4, 0.9);
  say('指數時間的問題：想要 polynomial time 演算法');
  await step(tok);                                   // 2:39 even n¹⁰ < 2ⁿ for large n
  note('n 夠大時：n¹⁰、甚至 n¹⁰⁰ 都 < 2ⁿ', 0, 0.9, 1.2);
  say('n 夠大時，n¹⁰ 甚至 n¹⁰⁰ 都比 2ⁿ 小', '所以指數時間非常耗時');
  await step(tok);                                   // 3:13 no solutions found so far
  R.mood('sad'); R.set('…');
  say('大家研究了很久', '還是沒找到 polynomial time 的解法');
  await step(tok);                                   // 3:35 framework: NP-hard and NP-complete
  R.mood('happy'); R.set('');
  good('研究框架：NP-hard、NP-complete', 0, 1.7, 2.2);
  say('研究白做也要有用 → 建立一套研究框架', '就是 NP-hard 和 NP-complete');
}]);

// 03:55 研究框架兩點：① 把問題關聯起來 ② 寫 non-deterministic poly 演算法
FRAG.push(['np1-b-two-points', '研究框架兩點：關聯問題、ND 演算法', async (tok) => {
  fresh([0, 4.4, 13], [0, 2.6, 0]);
  await step(tok);                                   // 3:55 two points
  tag('整個主題建立在兩點上', 'ptr', 0, 6.4);
  say('整個主題就建立在兩點上');
  await step(tok);                                   // 4:05 first: show similarities so one solved → all solved
  const xs = [-4.8, -2.4, 0, 2.4, 4.8];
  const M = ['Knapsack', 'TSP', 'Coloring', 'Subsets', 'Hamiltonian'].map((s, i) => bx(s, C.O, xs[i], 4.6, 0, 2.0, 3, 0.6));
  note('① 解不出來 → 至少證明它們很像', -2.6, 5.6);
  say('第一點：解不出來，至少證明它們之間很像', '解出一個，其他也跟著解出來');
  await step(tok);                                   // 4:26 not individually: I knapsack, you coloring
  const me = pal('我', '', '#f4a56a', -4.8, 0.6, 0.6), you = pal('你', '', '#7cb8ee', 0, 0.6, 0.6);
  bub('我做 knapsack', -4.8, 2.2, 0.6); bub('我做 coloring', 0, 2.2, 0.6);
  say('不要各做各的', '我做 knapsack、你做 graph coloring');
  await step(tok);                                   // 4:34 combine them collectively
  for (let i = 0; i + 1 < xs.length; i++) { rod(V3(xs[i] + 1.0, 4.6, 0), V3(xs[i + 1] - 1.0, 4.6, 0), C.Y, 0.06); await beat(tok, 250); }
  me.look(1); you.look(-1);
  say('一起努力：找出它們之間的關係');
  await step(tok);                                   // 4:39 if one is solved, all are solved
  tint(M[2], C.G); glow(M[2], GREEN); await beat(tok, 500);
  for (const m of M) { tint(m, C.G); await beat(tok, 200); }
  me.mood('happy'); you.mood('happy');
  say('解出一個 → 全部都解出來');
  await step(tok);                                   // 5:01 second: write non-deterministic algorithms
  const cd = code(['Algorithm A(...)', '{', '  statement 1;', '  ??? 不知道怎麼 poly', '  statement 3;', '}'], 2.6, 2.9, 0.5);
  cd.hl(3);
  note('② 寫不出 deterministic → 寫 non-deterministic', 2.6, 3.6);
  say('第二點：寫不出 deterministic 演算法', '就寫 non-deterministic 演算法');
  await step(tok);                                   // 5:12 polynomial time non-deterministic
  good('polynomial time 的 non-deterministic 演算法', 2.6, -0.1, 0.6);
  say('寫出 polynomial time 的 ND 演算法', 'ND = non-deterministic');
}]);

// 05:35 Non-deterministic search：choice() 一步到位
FRAG.push(['np1-b-nd-search', 'Non-deterministic search：choice() 一步到位', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  await step(tok);                                   // 5:35 algorithms we write are deterministic
  let cd = code(['Algorithm Knapsack(...)', '{', '  statement 1;  ✓', '  statement 2;  ✓', '  statement 3;  ✓', '}'], -3.4, 5.6, 0.52);
  say('平常寫的都是 deterministic 演算法', '每一行怎麼運作，我們都清楚');
  await step(tok);                                   // 5:50 non-deterministic: we don't know how
  const qn = note('non-deterministic：有些行「不知道怎麼做」', -3.4, 6.4);
  say('也可以寫 non-deterministic 演算法', '意思是：有些地方我們還不知道怎麼運作');
  await step(tok);                                   // 6:02 0/1 knapsack in poly: leave blanks
  txt(cd.ls[3], '  ??? 留白;      '); cd.hl(3);
  say('想寫 0/1 knapsack 的 poly 演算法', '大部分會寫，少數幾行不知道怎麼變 poly → 先留白');
  await step(tok);                                   // 6:36 preserve research work for the future
  const fut = pal('未來的人', '', '#7cb8ee', 3.6, 1.2, 0.6);
  bub('我來把它填好！', 3.6, 2.2, 1.2);
  say('研究成果就保存下來', '將來別人可以把留白變成 deterministic');
  await step(tok);                                   // 6:50 spent 10–12 years
  const me = pal('我', '花了 10 年', '#f4a56a', 1.2, 1.2, 0.6); me.mood('sad');
  say('就算花了十幾年沒解出來', '做過的工作也要用某種形式保存');
  await step(tok);                                   // 7:04 example: non-deterministic search
  gone(fut, me); kill(qn); cd.kill();
  cd = code(['Algorithm NSearch(A, n, key)', '{', '  j = choice();', '  if (key = A[j]) {', '    write(j); success();', '  }', '  write(0); failure();', '}'], -3.4, 5.6, 0.52);
  const A = [8, 3, 5, 9, 6, 2];
  const M = A.map((v, i) => { tag(String(i + 1), 'idx', 0.9 + i * 1.0, 0.25, 0.6); return bx(v, C.K, 0.9 + i * 1.0, 1.0, 0, 0.85, 2.5, 0.75, 0.8); });
  say('例子：non-deterministic search', '在大小 n 的陣列裡找 key');
  await step(tok);                                   // 7:14 choice, success, failure: O(1) each
  note('choice / success / failure：各算 1 個單位時間', 3.4, 5.4);
  say('choice、success、failure 是 ND 敘述', '假設每個都只花 O(1)');
  await step(tok);                                   // 7:43 looks O(1): faster than binary search
  note('整個演算法 O(1) < binary search 的 log n', 3.4, 4.6);
  say('整個演算法看起來是 O(1)', '比 binary search 的 log n 還快！');
  await step(tok);                                   // 8:14 choice gives index j
  cd.hl(2);
  const pj = tag('choice() → j', 'ptr alt', 3.4, 3.1);
  say('先呼叫 choice()', '它直接給出 key 所在的 index j');
  await step(tok);                                   // 8:31 key at j → success
  cd.hl(4);
  say('檢查 A[j] 是不是 key', '是 → write(j)、success');
  await step(tok);                                   // 8:39 not there → key not present → failure
  cd.hl(6);
  say('不是 → failure', '不是找不到，而是 key 根本不在陣列裡');
  await step(tok);                                   // 8:58 how did choice know? non-deterministic
  cd.hl(2);
  const why = bub('choice 怎麼知道在 j？', 3.4, 2.3, 1.2);
  say('choice 怎麼知道 key 在第 j 格？', '不知道 → 這就是 non-deterministic');
  await step(tok);                                   // 9:26 key = 9 → choice gives index 4
  kill(why);
  const kt = pkt('key = 9', -0.6, 1.0, 0);
  txt(pj, 'choice() → j = 4');
  const ar = arr(3.9, 2.7, 0, 3.9, 1.5, 0, 0xc08a1f);
  glow(M[3], GOLD); await beat(tok, 500); tint(M[3], C.G); cd.hl(4);
  say('key = 9：choice 直接說在 index 4', '沒有任何搜尋邏輯，一步到位');
  await step(tok);                                   // 9:50 today unknown, tomorrow a method
  note('今天不知道 → 明天可能找到方法', 3.4, 0.0, 1.2);
  say('今天不知道怎麼做', '明天也許有人找到方法');
  await step(tok);                                   // 10:15 magic → technique
  txt(cd.ls[2], '  j = magic();     ');
  await beat(tok, 900);
  txt(cd.ls[2], '  j = technique(); ');
  say('不知道怎麼運作 = magic', '知道之後就變成 technique（deterministic）');
  await step(tok);                                   // 10:40 write ND poly algorithms for exponential problems
  void kt; void ar;
  good('目標：替指數時間的問題寫 ND 的 poly 演算法', 0, 6.6);
  say('就這樣替指數時間的問題', '寫 polynomial time 的 non-deterministic 演算法');
}]);

// 11:10 P ⊆ NP：deterministic poly ⊆ non-deterministic poly（merge sort 的故事）
FRAG.push(['np1-b-p-in-np', 'P ⊆ NP：今天的 deterministic 以前是 ND', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 11:10 P: deterministic, polynomial time
  const pE = ellipse(-3.2, 0, 2.6, 2.0, C.G, 0.05, 0.35);
  const pl = tag('P：deterministic poly', 'ptr', -3.2, 0.1, -2.3);
  const PS = ['Linear search', 'Binary search', 'Bubble sort', 'Shortest path', 'MST', 'Huffman'];
  const PM = PS.map((s, i) => bx(s, C.G, -4.4 + (i % 2) * 2.4, 0.3, -1.2 + Math.floor(i / 2) * 1.1, 2.1, 2.5, 0.4, 0.55));
  say('P：deterministic、polynomial time 的演算法', 'search、sort、最短路徑、MST、Huffman…');
  await step(tok);                                   // 11:43 NP: non-deterministic, polynomial time
  const nE = ellipse(3.4, 0, 2.6, 2.0, C.B, 0.02, 0.2);
  const nl = tag('NP：non-deterministic poly', 'ptr', 3.4, 0.1, -2.3);
  say('NP：non-deterministic 的 poly 演算法');
  await step(tok);                                   // 11:56 we try to write these for exponential problems
  const KT = ['Knapsack', 'TSP'].map((s, i) => bx(s, C.O, 3.4, 0.3, -0.6 + i * 1.4, 1.6, 2.5, 0.4, 0.55));
  say('我們想替指數時間的問題寫這種演算法', '不知道怎麼做的地方就留成 non-deterministic');
  await step(tok);                                   // 12:17 famous diagram: P ⊂ NP
  await anim(tok, 1600, (t) => { nE.position.x = 3.4 - 2.8 * t; nE.scale.x = 2.6 + 2.8 * t; nE.scale.z = 2.0 + 0.9 * t; nl.position.x = 3.4 - 0.6 * t; nl.position.z = -2.3 - 0.8 * t; });
  say('著名的圖：P 是 NP 的子集');
  await step(tok);                                   // 12:33 merge sort: once unknown → non-deterministic
  const ms = bx('Merge sort', C.B, 1.4, 0.3, 1.6, 1.8, 2.5, 0.45, 0.55);
  bub('以前沒人知道 n log n 的方法', 1.4, 1.0, 2.4);
  say('例：merge sort 以前沒人知道', '那時它對我們是 non-deterministic');
  await step(tok);                                   // 12:51 found recently → deterministic
  move(ms, -3.2, 0.3, 1.9); tint(ms, C.G);
  say('找到 n log n 的方法之後', '它就變成 deterministic → 進入 P');
  await step(tok);                                   // 13:24 today's deterministic was yesterday's ND
  note('今天的 deterministic，昨天是 ND；今天的 ND，明天可能變 deterministic', 0, 0.4, 3.0);
  say('今天 deterministic 的，昨天是 non-deterministic', '今天 ND 的，明天可能變 deterministic');
  await step(tok);                                   // 13:35 deterministic ⊆ non-deterministic
  txt(pl, 'P ⊆ NP');
  say('所以 deterministic ⊆ non-deterministic', 'P ⊆ NP（Bari 的直覺說法）');
  await step(tok);                                   // 13:39 Cook's theorem later
  note("之後講 Cook's theorem：P = NP？", 3.6, 0.4, -3.2);
  say("Cook's theorem 想證明 P = NP 的事", '等一下再講');
  void pE; void PM; void KT;
}]);

// state space tree：root 到 leaf 的路 = (x1, x2, x3)；左 = 1、右 = 0
function stTree(Y) {
  const W = 12.8, lv = [], N = [];
  for (let d = 0; d <= 3; d++) { lv.push([]); for (let i = 0; i < (1 << d); i++) lv[d].push(-W / 2 + (i + 0.5) * W / (1 << d)); }
  return { lv, N, Y, async draw(tok, ms = 350) {
    N.push([bx('', C.K, 0, Y[0], 0, 0.4, 0, 0.4, 0.4)]);
    ['x1', 'x2', 'x3'].forEach((s, d) => tag(s, 'idx', -6.6, (Y[d] + Y[d + 1]) / 2));
    for (let d = 1; d <= 3; d++) {
      N[d] = [];
      for (let i = 0; i < lv[d].length; i++) {
        const px = lv[d - 1][i >> 1];
        line(px, Y[d - 1], lv[d][i], Y[d], 0);
        tag(i % 2 ? '0' : '1', 'idx', (px + lv[d][i]) / 2 + (i % 2 ? 0.2 : -0.2), (Y[d - 1] + Y[d]) / 2 + 0.1);
        N[d].push(bx('', C.K, lv[d][i], Y[d], 0, d === 3 ? 0.75 : 0.4, 0, 0.4, 0.4));
      }
      await beat(tok, ms);
    }
  } };
}
const vec3 = (i) => [(i >> 2) & 1 ? 0 : 1, (i >> 1) & 1 ? 0 : 1, i & 1 ? 0 : 1];

// 13:46 SAT 的 state space tree（2³ = 8 種）
FRAG.push(['np1-b-sat-tree', 'SAT：CNF 公式與 state space tree（2³ = 8 種）', async (tok) => {
  fresh([0, 3.6, 13.5], [0, 3.0, 0]);
  const F = [[1, -2, 3], [-1, 2, -3]];
  await step(tok);                                   // 13:46 second part: relate problems
  note('② 把問題關聯起來', 0, 6.6);
  say('接著第二部分：把問題關聯起來');
  await step(tok);                                   // 14:24 need a base problem
  const base = pal('base problem', '?', '#9b7ef4', -5.4, 0, 0.6);
  say('需要一個問題當「base problem」');
  await step(tok);                                   // 14:34 satisfiability: CNF formula
  base.set('SAT'); base.mood('happy');
  say('base problem 是 satisfiability（SAT）', '用 CNF 公式表示');
  await step(tok);                                   // 14:47 boolean variables x1, x2, x3
  const vs = ['x1', 'x2', 'x3'].map((s, i) => bx(s, C.B, -1.2 + i * 1.2, 0.4, 0, 0.9, 2.5, 0.5, 0.6));
  say('用 boolean 變數 x1、x2、x3', '每個只能是 0 或 1');
  await step(tok);                                   // 14:58 example formula
  const head = tag('F = (x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ ¬x3)', 'ptr alt', 0, 6.0);
  say('F = (x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ ¬x3)');
  await step(tok);                                   // 15:17 clauses C1, C2: ∨ inside, ∧ between
  tag('C1', 'idx', -1.8, 5.5); tag('C2', 'idx', 1.9, 5.5);
  say('子句 C1、C2：子句裡用 ∨（or）', '子句之間用 ∧（and）連起來');
  await step(tok);                                   // 15:28 SAT: for what values is F true?
  say('Satisfiability：xi 取什麼值，F 會是真的？');
  base.look(1);
  await step(tok);                                   // 15:46 each 0 or 1 → 8 possibilities
  vs.forEach(kill);
  const T = stTree([5.0, 3.9, 2.8, 1.7]);
  const C8 = [];
  for (let i = 0; i < 8; i++) { C8.push(note(vec3(i).join(''), T.lv[3][i], 0.9, 0)); await beat(tok, 150); }
  say('每個變數 0 或 1', '000、001、…、111：共 8 種');
  await step(tok);                                   // 15:58 try all eight and check
  for (let i = 0; i < 8; i++) {
    const a = vec3(i).map(Boolean);
    const ok = F.every((c) => c.some((l) => (l > 0 ? a[l - 1] : !a[-l - 1])));
    txt(C8[i], vec3(i).join('') + (ok ? ' ✓' : ' ✗')); C8[i].element.className = 'lab-label ' + (ok ? 'good' : 'bad');
    await beat(tok, 220);
  }
  say('8 種都代入檢查', '010 和 101 讓 F 為假，其餘為真');
  await step(tok);                                   // 16:18 8 = 2³ → n variables 2ⁿ: exponential
  note('3 個變數：2³ = 8　n 個變數：2ⁿ → 指數時間', 3.4, 0.2, 1.2);
  say('3 個變數 2³ = 8 種，n 個變數 2ⁿ 種', '→ 和 knapsack 一樣是指數時間');
  await step(tok);                                   // 16:44 state space tree
  await T.draw(tok, 400);
  say('這些值可以畫成一棵 state space tree', '左邊 = 1、右邊 = 0');
  await step(tok);                                   // 17:08 path root → leaf = one solution
  const path = [T.N[0][0], T.N[1][0], T.N[2][1], T.N[3][2]];
  for (const m of path) { tint(m, C.Y); glow(m, GOLD); await beat(tok, 250); }
  relabel(T.N[3][2], '101');
  say('root 到 leaf 的一條路 = 一組 (x1, x2, x3)', '例如 1 → 0 → 1');
  await step(tok);                                   // 17:49 relate: SAT poly → all poly
  head.element.className = 'lab-label ptr';
  note('這棵樹能 poly 解 → SAT 和其他問題都能', 0, 0.2, 2.2);
  say('要證明它們很像', 'SAT 能 poly 解 → 其他問題也都能');
  void base;
}]);

// 18:24 0/1 knapsack 用同一棵樹
FRAG.push(['np1-b-knap-tree', '0/1 knapsack 也是這棵樹', async (tok) => {
  fresh([0, 3.6, 13.5], [0, 3.0, 0]);
  await step(tok);                                   // 18:24 0/1 knapsack: 3 objects, capacity 8
  const bag = prop('parcel', -5.6, 4.7, 0, 1.1, '容量 m = 8'); bob(bag, 0.05);
  const it = ['物品 1', '物品 2', '物品 3'].map((s, i) => bx(s, [C.B, C.P, C.PK][i], -3.6 + i * 1.5, 5.1, 0, 1.3, 2.5, 0.5, 0.6));
  say('例：0/1 knapsack', '3 個物品，各有 profit 和 weight；背包容量 8');
  await step(tok);                                   // 18:36 maximize profit, don't exceed capacity
  bub('profit 最大、不能超重', -5.6, 6.6);
  say('把物品放進背包', 'profit 越大越好，不能超過容量');
  await step(tok);                                   // 18:42 solution (x1, x2, x3), each 0 or 1
  const sv = tag('解 = (x1, x2, x3)，xi = 1 放、0 不放', 'ptr alt', 2.6, 6.2);
  say('解寫成 (x1, x2, x3)', '每個是 0（不放）或 1（放）');
  await step(tok);                                   // 19:02 2³ possibilities → 2ⁿ
  const T = stTree([5.0, 3.9, 2.8, 1.7]);
  await T.draw(tok, 300);
  T.N[3].forEach((m, i) => relabel(m, vec3(i).join('')));
  say('一樣 2³ = 8 種', 'n 個物品 → 2ⁿ 種');
  await step(tok);                                   // 19:12 like SAT: try each, check profit
  for (let i = 0; i < 8; i++) { glow(T.N[3][i], GOLD); await beat(tok, 220); glow(T.N[3][i], null); }
  say('和 SAT 一樣逐一嘗試', 'SAT 看公式是否為真；knapsack 看 profit 是否最大');
  await step(tok);                                   // 19:39 removed both problems: whose tree?
  kill(bag); it.forEach(kill); kill(sv);
  const q = bub('這棵樹是誰的？', 0, 6.4);
  say('把兩個題目都拿掉', '這棵 state space tree 是誰的？');
  await step(tok);                                   // 19:51 both!
  txt(q, 'SAT 的，也是 knapsack 的！');
  pal('SAT', '', '#9b7ef4', -5.6, 1.6, 0.5); pal('Knapsack', '', '#dd8238', 5.6, 1.6, 0.5);
  say('兩個都是', '用同一棵樹把它們關聯起來');
  await step(tok);                                   // 20:05 tree solved in poly → both poly
  T.N.flat().forEach((m) => tint(m, C.G));
  good('這棵樹 poly 解 → 兩個都 poly 解', 0, 0.6, 1.0);
  say('這棵樹能 polynomial time 解', '兩個問題就都能 polynomial time 解');
}]);

// 20:23 Reduction：SAT ∝ L，poly 轉換，L 也是 NP-hard，可遞移
FRAG.push(['np1-b-reduce', 'SAT ∝ L：poly 轉換 → L 也是 NP-hard', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const names = ['0/1 Knapsack', 'TSP', 'Sum of subsets', 'Graph coloring', 'Hamiltonian'];
  const H = names.map((s, i) => bx(s, C.K, -4.0 + i * 2.0, 6.0, -1.0, 1.9, 0, 0.5, 0.6));
  await step(tok);                                   // 20:23 add SAT to the exponential list
  const S = bx('Satisfiability', C.K, -6.0, 6.0, -1.0, 1.9, 2.5, 0.5, 0.6);
  say('把 SAT 也加進指數時間的問題');
  await step(tok);                                   // 20:32 coin a term: hard problems
  H.forEach((m) => tint(m, C.O)); tag('hard problems', 'idx', 0, 6.7, -1.0);
  say('先把它們叫做 hard problems');
  await step(tok);                                   // 20:47 SAT is the base → NP-hard
  tint(S, C.R); glow(S, GOLD); tag('NP-hard', 'ptr alt', -6.0, 6.7, -1.0);
  say('SAT 是 base problem → 叫它 NP-hard');
  await step(tok);                                   // 21:11 the procedure is reduction
  tag('怎麼關聯？→ reduction', 'ptr', 0, 5.2);
  say('要證明它們和 SAT 有關係', '方法是 reduction');
  await step(tok);                                   // 21:28 SAT reduces to 0/1 knapsack
  glow(S, null);
  const a = bx('Satisfiability', C.R, -3.8, 3.2, 0, 3.0, 0, 0.8), b = bx('0/1 Knapsack', C.O, 3.8, 3.2, 0, 3.0, 0, 0.8);
  arr(-2.2, 3.2, 0, 2.2, 3.2, 0, 0xc08a1f); const sym = tag('SAT ∝ 0/1 knapsack', 'ptr alt', 0, 3.8);
  say('Satisfiability reduces to 0/1 knapsack', '符號 ∝');
  await step(tok);                                   // 21:39 SAT instance (formula) → knapsack instance
  const ex = pkt('一個 SAT 公式', -3.8, 2.2, 0.6);
  await slide(tok, ex, 3.8, 2.2, 0.6, 1300);
  txt(ex, '一個 knapsack 例子');
  say('拿 SAT 的一個公式（instance）', '把它轉成 0/1 knapsack 的 instance');
  await step(tok);                                   // 21:59 knapsack poly → same algorithm solves SAT
  glow(b, GREEN); await beat(tok, 700); glow(a, GREEN);
  say('如果 knapsack 能 poly time 解', '同一個演算法也能 poly time 解 SAT');
  await step(tok);                                   // 22:24 whoever is solved first: both
  note('任一個解出來 → 另一個自動解出來', 0, 1.2, 0.6);
  say('誰先被解出來不重要', '任一個解出來，另一個也自動解出來');
  await step(tok);                                   // 22:39 conversion only polynomial time
  good('轉換：polynomial time ✓', -2.2, 4.6); bad('轉換花 exponential：沒用 ✗', 2.6, 4.6);
  say('轉換本身只能花 polynomial time', '花 exponential time 轉換就沒有用了');
  await step(tok);                                   // 22:59 SAT NP-hard → knapsack NP-hard
  glow(a, null); glow(b, null); tint(b, C.R); relabel(b, '0/1 Knapsack：NP-hard'); tint(H[0], C.R);
  say('SAT 是 NP-hard、SAT ∝ 0/1 knapsack', '→ 0/1 knapsack 也是 NP-hard');
  await step(tok);                                   // 23:45 reduction is transitive
  txt(sym, 'SAT ∝ L1、L1 ∝ L2 → L2 也 NP-hard');
  say('reduction 有遞移性', 'SAT ∝ L1、L1 ∝ L2 → L2 也是 NP-hard');
  await step(tok);                                   // 24:02 0/1 → coloring → subsets / Hamiltonian
  const col = bx('Graph coloring', C.K, 3.8, 1.2, 0, 2.6, 2.5, 0.6);
  arr(3.8, 2.75, 0, 3.8, 1.6, 0, 0xc08a1f); await beat(tok, 500); tint(col, C.R); tint(H[3], C.R);
  for (const [s, y, k] of [['Sum of subsets', 1.6, 2], ['Hamiltonian', 0.4, 4]]) {
    const m = bx(s, C.K, -1.4, y, 0, 2.6, 2.5, 0.6);
    arr(2.4, 1.2, 0, 0.0, y, 0, 0xc08a1f);
    await beat(tok, 500); tint(m, C.R); tint(H[k], C.R);
  }
  say('0/1 knapsack → graph coloring', '→ sum of subsets、Hamiltonian：不用每個都從 SAT 轉');
  await step(tok);                                   // 24:29 any problem SAT reduces to → NP-hard
  tint(H[1], C.R);
  say('SAT（直接或間接）reduce 得到的問題', '全部都是 NP-hard');
}]);

// 24:47 NP-hard ∩ NP（有 ND poly 演算法）= NP-complete
FRAG.push(['np1-b-npc-venn', 'NP-hard ∩ NP = NP-complete', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  const hE = ellipse(-1.8, 0, 3.4, 2.5, C.R, 0.02, 0.2); tag('NP-hard', 'ptr alt', -3.0, 0.1, -2.8);
  const sat = bx('SAT', C.O, -3.2, 0.3, -0.8, 1.2, 0, 0.45, 0.6);
  const kn = bx('0/1 Knapsack', C.O, -3.6, 0.3, 0.6, 1.8, 0, 0.45, 0.6);
  const co = bx('Coloring', C.O, -3.0, 0.3, 1.7, 1.4, 0, 0.45, 0.6);
  await step(tok);                                   // 24:47 do we have ND algorithms for any?
  const q = bub('有 non-deterministic poly 演算法嗎？', -1.8, 1.4, -2.0);
  say('這些問題，有沒有寫出 non-deterministic 演算法？');
  await step(tok);                                   // 24:59 SAT has one
  kill(q); note('ND poly ✓', -3.2, 1.0, -0.8);
  say('有：SAT 有 ND poly time 演算法');
  await step(tok);                                   // 25:11 SAT is NP-hard and NP-complete
  const nE = ellipse(1.8, 0, 3.4, 2.5, C.B, 0.03, 0.2); tag('NP：有 ND poly 演算法', 'ptr', 3.0, 0.1, -2.8);
  move(sat, 0, 0.3, -0.6);
  const npcL = tag('NP-complete', 'ptr alt', 0, 0.1, 2.9);
  say('SAT 是 NP-hard，又有 ND poly 演算法', '→ NP-complete');
  await step(tok);                                   // 25:33 your problem reduced by SAT → NP-hard
  const you = pal('你的問題', '', '#7cb8ee', -4.4, -1.4, 0.45);
  say('你的問題：證明 SAT ∝ 它', '→ 它是 NP-hard');
  await step(tok);                                   // 25:44 write ND poly → NP-complete
  await slide(tok, you.g, 0.2, 0, 0.9, 1000); you.mood('happy');
  say('再替它寫出 ND poly 演算法', '→ 它也是 NP-complete');
  await step(tok);                                   // 26:01 research: two things
  note('研究兩件事：① SAT ∝ L（直接或間接）② ND poly 演算法', 0, 0.4, -3.4);
  say('研究一個新問題要做兩件事', '① 證明 SAT ∝ 它　② 寫出 ND poly 演算法');
  await step(tok);                                   // 26:49 diagram: the set of NP-hard problems
  hE.material.opacity = 0.35; [kn, co].forEach((m) => glow(m, GOLD));
  say('著名的圖：NP-hard 集合', 'SAT、0/1 knapsack、graph coloring…');
  await step(tok);                                   // 27:31 second part: ND algorithms → NP
  hE.material.opacity = 0.2; [kn, co].forEach((m) => glow(m, null)); nE.material.opacity = 0.35;
  say('第二部分：有 ND poly 演算法的 → NP');
  await step(tok);                                   // 27:41 SAT: in the intersection
  nE.material.opacity = 0.2; glow(sat, GOLD);
  say('SAT 兩個都符合', '在交集裡');
  await step(tok);                                   // 27:58 intersection = NP-complete
  txt(npcL, 'NP-hard ∩ NP = NP-complete');
  say('NP-hard 和 NP 的交集', '叫做 NP-complete');
}]);

// 28:15 P 會越長越大？Cook：SAT ∈ P ⇔ P = NP
FRAG.push(['np1-b-cook', 'P 越長越大？Cook：SAT ∈ P ⇔ P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  const nE = ellipse(0, 0, 5.0, 2.8, C.B, 0.02, 0.2); tag('NP', 'ptr', 0, 0.1, -3.1);
  const sat = bx('SAT', C.O, 2.8, 0.3, 0.4, 1.0, 0, 0.45, 0.6);
  await step(tok);                                   // 28:15 P: what's deterministic today
  const pE = ellipse(-2.6, 0, 1.6, 1.3, C.G, 0.05, 0.35); const pl = tag('P', 'ptr', -2.6, 0.1, -1.6);
  say('P：今天已經會的 deterministic');
  await step(tok);                                   // 28:27 P keeps growing
  await anim(tok, 2000, (t) => { pE.scale.x = 1.6 + 1.6 * t; pE.scale.z = 1.3 + 0.8 * t; pE.position.x = -2.6 + 1.2 * t; pl.position.x = -2.6 + 1.2 * t; });
  say('今天的 ND，明天可能變 deterministic', '我們相信 P 會越長越大');
  await step(tok);                                   // 28:56 at some stage equal to NP
  const gh = ellipse(0, 0, 5.0, 2.8, C.G, 0.06, 0.1);
  say('總有一天長到和 NP 一樣大？');
  await step(tok);                                   // 29:07 is it really going to work?
  const me = pal('', '?', '#f4a56a', 5.6, 2.6, 0.5); me.mood('wow');
  say('這個想法真的行得通嗎？');
  await step(tok);                                   // 29:23 if it fails, all research is waste
  bad('如果永遠變不成 → 研究白做', 3.6, 0.4, 2.4); me.mood('sad');
  say('如果 ND 永遠變不成 deterministic', '所有研究就白做了');
  await step(tok);                                   // 29:43 prove P = NP
  txt(pl, 'P = NP ?');
  say('所以要證明 P = NP');
  await step(tok);                                   // 30:17 means the solution exists, just discover it
  note('P = NP：解法早就存在，只是還沒被發現', -2.0, 0.4, 2.4);
  say('P = NP 代表：解法已經存在', '只是還沒被發現');
  await step(tok);                                   // 30:45 Cook's theorem
  const ck = pal('Cook', '', '#9b7ef4', -5.6, 2.4, 0.5); ck.mood('happy');
  glow(sat, GOLD);
  say("Cook's theorem");
  await step(tok);                                   // 31:04 SAT ∈ P ⇔ P = NP
  move(sat, -1.0, 0.3, 0.2); tint(sat, C.G);
  await anim(tok, 1500, (t) => { pE.scale.x = 3.2 + 1.8 * t; pE.scale.z = 2.1 + 0.7 * t; pE.position.x = -1.4 + 1.4 * t; pl.position.x = -1.4 + 1.4 * t; });
  tag('SAT ∈ P ⇔ P = NP', 'ptr alt', 0, 0.1, 3.3);
  say('SAT ∈ P ⇔ P = NP', 'SAT 進了 P → P 撐滿整個 NP');
  await step(tok);                                   // 31:19 he did not prove it
  bub('我沒證出來，誰證出 SAT ∈ P 就成立', -5.6, 1.6, 2.4);
  say('Cook 自己沒有證出 SAT ∈ P', '只說：誰證出來，我們的工作就是對的');
  void nE; void gh;
}]);

// ════════ qZs767KQcvE（Abdul Bari 8.1：Clique Decision Problem） ════════
// 00:41 complete graph（n(n−1)/2 條邊）與 clique
FRAG.push(['np1-c-complete', 'Complete graph 與 clique', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.3]);
  await step(tok);                                   // 0:41 a graph with 4 vertices
  const P4 = { 1: [-6.0, 0.3, -2.6], 2: [-4.2, 0.3, -2.6], 3: [-4.2, 0.3, -0.8], 4: [-6.0, 0.3, -0.8] };
  const g4 = graph(P4, [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]], { drop: true, size: [0.5, 0.4, 0.5] });
  say('這張圖有 4 個頂點');
  await step(tok);                                   // 0:48 every vertex connected to all others
  Object.values(g4.E).forEach((e) => e.material.color.set(C.Y));
  const l4 = tag('complete graph', 'ptr alt', -5.1, 0.3, 0.2);
  say('每個點都和其他所有點相連', '→ complete graph');
  await step(tok);                                   // 1:00 n(n−1)/2 edges
  note('邊數 = n(n−1)/2 = 4·3/2 = 6', -5.1, 0.3, 1.0);
  say('n 個頂點的 complete graph', '有 n(n−1)/2 條邊');
  await step(tok);                                   // 1:18 complete graph of three vertices
  const P3 = { 1: [-0.9, 0.3, -2.6], 2: [0.9, 0.3, -2.6], 3: [0, 0.3, -1.0] };
  const g3 = graph(P3, [[1, 2], [2, 3], [1, 3]], { drop: true, size: [0.5, 0.4, 0.5] });
  tag('n=3：3 條', 'ptr alt', 0, 0.3, -3.4);
  say('3 個頂點的 complete graph');
  await step(tok);                                   // 1:22 complete graph of just two vertices
  graph({ 1: [4.4, 0.3, -2.6], 2: [6.2, 0.3, -2.6] }, [[1, 2]], { drop: true, size: [0.5, 0.4, 0.5] });
  tag('n=2：1 條', 'ptr alt', 5.3, 0.3, -3.4);
  say('2 個頂點也是 complete graph');
  await step(tok);                                   // 1:34 add vertex 5 with a few edges
  P4[5] = [-2.4, 0.3, 0.6];
  const v5 = bx('5', C.K, -2.4, 0.3, 0.6, 0.5, 2.5, 0.4, 0.5);
  const e53 = rod(V3(...P4[5]), V3(...P4[3]), EDGE, 0.05), e54 = rod(V3(...P4[5]), V3(...P4[4]), EDGE, 0.05);
  say('在 4 個點的圖上加頂點 5', '只連幾條邊');
  await step(tok);                                   // 1:45 not complete: 5 only to 4 and 3
  glow(v5, RED); bad('5 只連到 3、4 → 不是 complete graph', -3.2, 0.3, 1.6);
  txt(l4, '');
  say('5 只連到 4 和 3，沒連到 1、2', '→ 整張圖不是 complete graph');
  await step(tok);                                   // 1:54 but a subgraph of it …
  glow(v5, null); Object.values(g4.N).forEach((m) => tint(m, C.G));
  say('但它的 subgraph {1, 2, 3, 4}…');
  await step(tok);                                   // 2:06 a complete subgraph is a clique
  txt(l4, 'clique（size 4）');
  say('subgraph 本身是 complete graph', '→ 叫做 clique');
  await step(tok);                                   // 2:16 another example: add 4 and 5
  const v4 = bx('4', C.K, 1.8, 0.3, -0.4, 0.5, 2.5, 0.4, 0.5), w5 = bx('5', C.K, 2.6, 0.3, 1.0, 0.5, 2.5, 0.4, 0.5);
  rod(V3(1.8, 0.3, -0.4), V3(...P3[2]), EDGE, 0.05); rod(V3(1.8, 0.3, -0.4), V3(...P3[3]), EDGE, 0.05); rod(V3(1.8, 0.3, -0.4), V3(2.6, 0.3, 1.0), EDGE, 0.05);
  say('另一個例子：3 個點的 complete graph', '再加上頂點 4、5');
  await step(tok);                                   // 2:43 size 4? no. size 3? yes
  Object.values(g3.N).forEach((m) => tint(m, C.G)); Object.values(g3.E).forEach((e) => e.material.color.set(C.Y));
  note('size 4 ✗　size 3 ✓', 1.4, 0.3, 1.8);
  say('有 4 個點的 complete subgraph 嗎？沒有', '3 個點的？有');
  await step(tok);                                   // 2:56 a clique of this graph
  tag('clique（size 3）', 'ptr alt', 0, 0.3, -3.9);
  say('這就是這張圖的一個 clique');
  await step(tok);                                   // 3:01 cliques of 2, 3, 4 … n vertices
  good('clique 可以是 2、3、4…n 個頂點', 0, 0.3, 3.0);
  say('clique 可以是 2 個、3 個、4 個…n 個頂點');
  void e53; void e54; void v4; void w5;
}]);

// 03:16 在 6 個點的圖上找 clique（params.dec：decision vs optimization）
const CG6 = { P: { 1: [-4.2, 0.3, -1.5], 2: [-4.2, 0.3, 1.5], 3: [-1.2, 0.3, -1.5], 4: [-1.2, 0.3, 1.5], 5: [1.8, 0.3, 0], 6: [4.8, 0.3, 0] },
  E: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 6]] };
function hiClique(g, S, col) { gReset(g); S.forEach((v) => tint(g.N[v], C.G)); for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) eCol(g, S[i], S[j], col); }
FRAG.push(['np1-c-cliques', '找 clique：size 4、3、2；最大是 4', async (tok) => {
  const dec = !!prm().dec;
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  if (!dec) {
    await step(tok);                                 // 3:16 graph G with 6 vertices
    const g = graph(CG6.P, CG6.E, { drop: true });
    const st = tag('', 'ptr alt', 0, 0.3, 3.0);
    say('圖 G 有 6 個頂點');
    await step(tok);                                 // 3:28 any subgraph forming a complete graph?
    const q = bub('哪些 subgraph 是 complete graph？', 0, 1.4, -2.6);
    say('找找看：哪些 subgraph 是 complete graph？');
    await step(tok);                                 // 3:34 four vertices → size 4
    kill(q); hiClique(g, [1, 2, 3, 4], C.Y); txt(st, 'size 4：{1, 2, 3, 4}');
    say('這 4 個頂點形成 complete graph', '→ size 4 的 clique');
    await step(tok);                                 // 3:37 three vertices → size 3
    hiClique(g, [3, 4, 5], C.Y); txt(st, 'size 3：{3, 4, 5}');
    say('這 3 個頂點 → size 3 的 clique');
    await step(tok);                                 // 3:43 another one is size 3 too
    hiClique(g, [1, 2, 3], C.Y); txt(st, 'size 3：{1, 2, 3} 也是');
    say('換這 3 個也是 size 3');
    await step(tok);                                 // 3:50 5 and 6: one edge → size 2
    hiClique(g, [5, 6], C.Y); txt(st, 'size 2：一條邊 5–6');
    say('只有 5、6 一條邊', '→ size 2 的 clique（最小的）');
    await step(tok);                                 // 3:58 maximum clique is size 4
    hiClique(g, [1, 2, 3, 4], C.G); txt(st, '最大的 clique：size 4');
    say('最大的 clique 是 size 4');
    return;
  }
  const g = graph(CG6.P, CG6.E, { drop: true });
  const st = tag('', 'ptr alt', 0, 0.3, 3.0);
  await step(tok);                                   // 4:10 decision vs optimization from this example
  const Dc = bx('Decision', C.B, -3.0, 0.4, -3.2, 2.2, 2.5, 0.5, 0.7), Oc = bx('Optimization', C.P, 3.0, 0.4, -3.2, 2.4, 2.5, 0.5, 0.7);
  say('用這個例子看 decision 和 optimization');
  await step(tok);                                   // 4:21 clique of size 3? yes
  hiClique(g, [3, 4, 5], C.Y); txt(st, 'size 3 的 clique？YES');
  say('有 size 3 的 clique 嗎？yes');
  await step(tok);                                   // 4:26 size 2? yes
  hiClique(g, [5, 6], C.Y); txt(st, 'size 2 的 clique？YES');
  say('size 2 呢？yes');
  await step(tok);                                   // 4:29 yes/no → decision problem
  glow(Dc, GOLD); note('答 YES / NO = decision problem', -3.0, 1.2, -3.2);
  say('只要回答 yes / no 的', '→ decision problem');
  await step(tok);                                   // 4:45 size 4? yes
  hiClique(g, [1, 2, 3, 4], C.Y); txt(st, 'size 4 的 clique？YES');
  say('有 size 4 的 clique 嗎？yes');
  await step(tok);                                   // 4:58 optimization: maximum clique size?
  glow(Dc, null); glow(Oc, GOLD); hiClique(g, [1, 2, 3, 4], C.G); txt(st, '最大 clique = 4（4 以上沒有）');
  say('Optimization：最大的 clique 多大？', '2、3、4…4 以上沒有 → 答案 4');
  await step(tok);                                   // 5:13 max/min → optimization; size k → decision
  note('求最大 / 最小 = optimization', 3.0, 1.2, -3.2);
  say('求最大或最小 → optimization', '問「有沒有 size k 的 clique」→ decision');
  await step(tok);                                   // 5:29 CDP: does G have a clique of size k?
  glow(Oc, null); glow(Dc, GOLD); gReset(g); txt(st, 'CDP：G 有沒有 size k 的 clique？');
  say('Clique decision problem（CDP）', 'G 有沒有 size k 的 clique？k 可以是任何數');
  await step(tok);                                   // 6:11 CDP is a graph problem, prove NP-hard
  tag('graph problem → 要證 NP-hard', 'ptr', 0, 0.3, 3.7);
  say('CDP 是一個 graph problem', '我們要證明它是 NP-hard');
  await step(tok);                                   // 6:19 decision NP-hard → optimization NP-hard
  tint(Dc, C.R); await beat(tok, 500); tint(Oc, C.R);
  say('decision 版是 NP-hard', '→ optimization 版也是 NP-hard');
}]);

// 06:35 證明 NP-hard 的程序：選已知 NP-hard 的 L1，證 L1 ∝ L2（CDP 版本）
FRAG.push(['np1-c-reduce', '證 NP-hard：已知 L1 ∝ L2；本題 SAT ∝ CDP', async (tok) => {
  fresh([0, 5.0, 13], [0, 1.8, 0]);
  await step(tok);                                   // 6:35 procedure for proving NP-hard
  tag('怎麼證明一個問題是 NP-hard？', 'ptr', 0, 5.0);
  say('證明一個 graph problem 是 NP-hard 的程序');
  await step(tok);                                   // 6:51 our problem L2
  const L2 = pal('L2', '要證 NP-hard', '#cfc4b0', 4.0, 0.6, 0.9);
  say('我們的問題叫 L2', '要證明它是 NP-hard');
  await step(tok);                                   // 7:01 select L1 already known NP-hard
  const L1 = pal('L1', '已知 NP-hard', '#d64545', -4.0, 0.6, 0.9); L1.mood('happy');
  say('選一個已知是 NP-hard 的問題 L1');
  await step(tok);                                   // 7:04 show L1 reduces to L2
  arr(-2.8, 0.8, 0.6, 2.8, 0.8, 0.6, 0xc08a1f); tag('L1 ∝ L2', 'ptr alt', 0, 1.4, 0.6);
  say('證明 L1 reduces to L2（L1 ∝ L2）');
  await step(tok);                                   // 7:18 from L1's example prepare L2's example
  const ex = pkt('L1 的例子', -4.0, 2.4, 0.6);
  await slide(tok, ex, 4.0, 2.4, 0.6, 1300); txt(ex, 'L2 的例子');
  say('拿 L1 的一個例子', '從它造出 L2 的例子');
  await step(tok);                                   // 7:26 L2 solved in poly → L1 solved
  L2.glow(GREEN); await beat(tok, 600); L1.glow(GREEN);
  say('L2 能 poly time 解', '→ L1 也能 poly time 解');
  await step(tok);                                   // 7:40 conversion in polynomial time
  good('轉換：polynomial time', 0, 0.3, 2.0);
  say('從 L1 轉到 L2 的轉換', '要在 polynomial time 內完成');
  await step(tok);                                   // 7:46 our problem: CDP; known: SAT
  L1.glow(null); L2.glow(null);
  L1.set('SAT'); L2.set('CDP');
  say('本題：L2 = CDP', '已知 NP-hard 的 L1 = satisfiability');
  await step(tok);                                   // 7:59 SAT ∝ CDP: CNF formula → graph with clique
  txt(ex, '一張有 clique 的圖');
  const f = pkt('CNF 公式', -4.0, 3.4, 0.6);
  await slide(tok, f, 4.0, 3.4, 0.6, 1200); txt(f, '圖 G');
  say('證明 SAT ∝ CDP', '從 CNF 公式造出一張有 clique 的圖');
}]);

// 08:44 SAT ∝ CDP：F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)（params.step = vert / edge / clique）
const CF = [[1, 2], [-1, -2], [1, 3]];
const CPOS = { '0.0': [-1.1, 0.3, -2.5], '0.1': [1.1, 0.3, -2.5], '1.0': [-4.4, 0.3, 0.1], '1.1': [-4.4, 0.3, 2.0], '2.0': [4.4, 0.3, 0.1], '2.1': [4.4, 0.3, 2.0] };
const cLit = (id) => { const [r, i] = id.split('.').map(Number); return CF[r][i]; };
const litS = (l) => (l > 0 ? 'x' + l : '¬x' + -l);
function cdpEdges() { const ids = Object.keys(CPOS), out = [], bad = []; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { if (ids[a][0] === ids[b][0]) continue; (cLit(ids[a]) === -cLit(ids[b]) ? bad : out).push([ids[a], ids[b]]); } return { out, bad }; }
const FSTR = 'F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)';
function cdpVert(id, drop) { const r = +id[0]; return bx(litS(cLit(id)), [C.B, C.P, C.PK][r], CPOS[id][0], 0.3, CPOS[id][2], 0.95, drop ? 2.5 : 0, 0.45, 0.65); }
function cdpBase() {
  tag(FSTR, 'ptr', 0, 0.3, 3.4);
  const N = {};
  for (const id in CPOS) N[id] = cdpVert(id, false);
  tag('C1', 'ptr alt', 0, 0.3, -3.3); tag('C2', 'ptr alt', -5.6, 0.3, 1.05); tag('C3', 'ptr alt', 5.6, 0.3, 1.05);
  return N;
}
FRAG.push(['np1-c-sat-cdp', 'SAT ∝ CDP：公式 → 圖，k 個子句 → k-clique', async (tok) => {
  const stp = prm().step || 'vert';
  fresh([0, 9, 8], [0, 0, 0.4]);
  const { out, bad: neg } = cdpEdges();
  if (stp === 'vert') {
    await step(tok);                                 // 8:44 example formula with x1, x2, x3
    const vs = ['x1', 'x2', 'x3'].map((s, i) => bx(s, C.K, -1.2 + i * 1.2, 0.3, 0.8, 0.9, 2.5, 0.45, 0.6));
    say('先用例子：3 個變數 x1、x2、x3');
    await step(tok);                                 // 8:54 F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)
    const ft = tag(FSTR, 'ptr', 0, 0.3, 3.4);
    say(FSTR);
    await step(tok);                                 // 9:13 not every clause has all three
    note('每個子句不一定三個變數都有', 0, 0.3, 2.6);
    say('不是每個子句都含三個變數');
    await step(tok);                                 // 9:18 three clauses C1, C2, C3
    vs.forEach(kill);
    const cl = [['C1 = (x1 ∨ x2)', -3.2], ['C2 = (¬x1 ∨ ¬x2)', 0], ['C3 = (x1 ∨ x3)', 3.2]].map(([s, x]) => note(s, x, 0.3, 1.4));
    say('三個子句 C1、C2、C3');
    await step(tok);                                 // 9:25 clauses ANDed; k clauses in general
    tag('一般：k 個子句用 ∧ 連起來', 'idx', 0, 0.3, 2.2);
    say('子句用 ∧ 連起來', '一般有 k 個子句');
    await step(tok);                                 // 9:40 build a graph with a clique of size k = 3
    cl.forEach(kill);
    good('目標：造一張圖，裡面有 size k = 3 的 clique', 0, 0.3, 0.9);
    say('要從公式造出一張圖', '裡面有 size k 的 clique；這裡 k = 3');
    await step(tok);                                 // 9:53 C1's literals become vertices
    cdpVert('0.0', true); cdpVert('0.1', true);
    say('把每個 literal 變成一個頂點', 'C1 的 x1、x2');
    await step(tok);                                 // 10:01 C2 separately
    cdpVert('1.0', true); cdpVert('1.1', true);
    say('C2 的 ¬x1、¬x2 另外放', '不和 C1 混在一起');
    await step(tok);                                 // 10:16 C3 separately
    cdpVert('2.0', true); cdpVert('2.1', true);
    say('C3 的 x1、x3 也分開放');
    await step(tok);                                 // 10:25 mark which clause each belongs to
    for (let r = 0; r < 3; r++) { tag('C' + (r + 1), 'ptr alt', [0, -5.6, 5.6][r], 0.3, [-3.3, 1.05, 1.05][r]); await beat(tok, 300); }
    say('標出每個頂點屬於哪個子句');
    await step(tok);                                 // 10:46 a vertex is ⟨a, i⟩
    note('頂點 = ⟨a, i⟩：a 是 literal，i 是它所在的子句 Ci', 0, 0.3, -1.2);
    say('頂點寫成 ⟨a, i⟩', 'a 是 literal、i 是它所在的子句');
    void ft;
    return;
  }
  const N = cdpBase();
  const lit = (a, b, col, r = 0.05) => rod(V3(...CPOS[a]), V3(...CPOS[b]), col, r);
  if (stp === 'edge') {
    await step(tok);                                 // 11:13 rule 1: not the same clause (C1)
    const r1 = lit('0.0', '0.1', C.R); glow(N['0.0'], RED); glow(N['0.1'], RED);
    const x1 = bad('規則 ①：同一個子句的頂點不連', 0, 0.3, -1.6);
    say('規則 ①：同一個子句的頂點不能相連');
    await step(tok);                                 // 11:20 C2 also not
    glow(N['0.0'], null); glow(N['0.1'], null); kill(r1);
    const r2 = lit('1.0', '1.1', C.R); glow(N['1.0'], RED); glow(N['1.1'], RED);
    say('C2 的兩個頂點也不連');
    await step(tok);                                 // 11:24 connect vertices of different clauses
    glow(N['1.0'], null); glow(N['1.1'], null); kill(r2); kill(x1);
    good('不同子句的頂點可以連', 0, 0.3, -1.6);
    say('不同子句的頂點才可以相連');
    await step(tok);                                 // 11:31 draw x1 → ¬x1? also wrong
    const r3 = lit('0.0', '1.0', C.R); glow(N['0.0'], RED); glow(N['1.0'], RED);
    say('畫 x1 → ¬x1 這條？', '這條也不行');
    await step(tok);                                 // 11:39 rule 2: not to its negation
    bad('規則 ②：不能連到自己的 negation', 0, 0.3, 0.6);
    say('規則 ②：不能連到自己的 negation', 'x1 和 ¬x1 不連');
    await step(tok);                                 // 11:56 x1 → ¬x2 allowed
    kill(r3); glow(N['0.0'], null); glow(N['1.0'], null);
    lit('0.0', '1.1', EDGE, 0.035);
    say('x1 → ¬x2：可以');
    await step(tok);                                 // 11:59 x2 → ¬x1 allowed
    lit('0.1', '1.0', EDGE, 0.035);
    say('x2 → ¬x1：可以');
    await step(tok);                                 // 12:01 x2 → ¬x2 not allowed
    const r4 = lit('0.1', '1.1', C.R); glow(N['0.1'], RED); glow(N['1.1'], RED);
    await beat(tok, 1200); kill(r4); glow(N['0.1'], null); glow(N['1.1'], null);
    say('x2 → ¬x2：是 negation，不行');
    await step(tok);                                 // 12:09 formally: i ≠ j and b ≠ ā
    note('邊 ⟨a, i⟩–⟨b, j⟩：i ≠ j 而且 b ≠ ā', 0, 0.3, 2.6);
    say('正式寫法：⟨a, i⟩ 連 ⟨b, j⟩', '要 i ≠ j（不同子句）而且 b ≠ ā（不是 negation）');
    await step(tok);                                 // 12:47 C1 – C3 edges
    for (const [a, b] of out.filter(([a, b]) => a[0] === '0' && b[0] === '2')) { lit(a, b, EDGE, 0.035); await beat(tok, 300); }
    say('C1 和 C3 之間：都可以連');
    await step(tok);                                 // 13:07 C2 – C3: ¬x1–x1 no, the rest yes
    for (const [a, b] of out.filter(([a, b]) => a[0] === '1' && b[0] === '2')) { lit(a, b, EDGE, 0.035); await beat(tok, 300); }
    const r5 = lit('1.0', '2.0', C.R); await beat(tok, 900); kill(r5);
    say('C2 和 C3：¬x1 – x1 不連，其他都連');
    await step(tok);                                 // 13:26 this graph is the CDP example
    tag('共 ' + out.length + ' 條邊：CDP 的例子（poly time 造好）', 'ptr alt', 0, 0.3, -1.0);
    say('從公式得到的這張圖', '就是 CDP 的一個例子');
    void neg;
    return;
  }
  // clique
  const E = {};
  for (const [a, b] of out) E[ek(a, b)] = lit(a, b, EDGE, 0.035);
  const pick = ['0.1', '1.0', '2.1'];
  await step(tok);                                   // 13:43 k = number of clauses = 3
  note('k = 子句數 = 3', -5.6, 0.3, -2.4);
  say('公式有 k = 3 個子句');
  await step(tok);                                   // 13:49 do we have a clique here?
  const st = tag('有 size 3 的 clique 嗎？', 'ptr alt', 0, 0.3, -1.0);
  say('圖裡有沒有 clique？');
  await step(tok);                                   // 13:59 a clique of two: single edge
  E[ek('0.0', '2.1')].material.color.set(C.Y);
  say('有：兩個頂點（一條邊）的 clique');
  await step(tok);                                   // 14:04 clique of size three
  E[ek('0.0', '2.1')].material.color.set(EDGE);
  for (const id of pick) { tint(N[id], C.G); glow(N[id], GREEN); }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) E[ek(pick[i], pick[j])].material.color.set(C.Y);
  txt(st, 'size 3：x2、¬x1、x3');
  say('也有 size 3 的 clique', 'x2、¬x1、x3 兩兩相連');
  await step(tok);                                   // 14:11 size four? no
  bad('size 4？沒有', 0, 0.3, 0.6);
  say('有 size 4 的嗎？沒有');
  await step(tok);                                   // 14:21 more triangles; pick this one
  E[ek('0.0', '1.1')].material.color.set(C.PK); E[ek('1.1', '2.0')].material.color.set(C.PK); E[ek('0.0', '2.0')].material.color.set(C.PK);
  note('還有別的三角形（粉紅），選一個就好', 0, 0.3, 1.4);
  say('還有其他三角形', '挑其中一個就好');
  await step(tok);                                   // 14:39 k clauses → a k-size clique
  good('k 個子句 → 圖裡有 size k 的 clique', 0, 0.3, -1.6);
  say('公式有 k 個子句', '圖裡就會有 size k 的 clique');
  await step(tok);                                   // 15:03 mark selected vertices true: x2 = 1
  const vt = tag('x2 = 1', 'ptr alt', -5.6, 0.3, 3.0);
  glow(N['0.1'], GOLD);
  say('把選到的頂點設成 true', 'x2 為真 → x2 = 1');
  await step(tok);                                   // 15:17 ¬x1 true → x1 = 0
  txt(vt, 'x2 = 1，x1 = 0'); glow(N['1.0'], GOLD);
  say('¬x1 為真 → x1 = 0');
  await step(tok);                                   // 15:22 x3 true → x3 = 1
  txt(vt, 'x1 = 0，x2 = 1，x3 = 1'); glow(N['2.1'], GOLD);
  say('x3 為真 → x3 = 1');
  await step(tok);                                   // 15:31 C1 = 0 ∨ 1 = 1
  const R = [];
  R.push(good('C1 = 0 ∨ 1 = 1', -3.8, 0.3, -1.4));
  say('代入 C1 = (x1 ∨ x2) = 0 ∨ 1 = 1');
  await step(tok);                                   // 15:42 C2 = 1 ∨ 0 = 1
  R.push(good('C2 = 1 ∨ 0 = 1', -5.2, 0.3, 2.9));
  say('C2 = (¬x1 ∨ ¬x2) = 1 ∨ 0 = 1');
  await step(tok);                                   // 15:59 C3 = 0 ∨ 1 = 1
  R.push(good('C3 = 0 ∨ 1 = 1', 5.2, 0.3, 2.9));
  say('C3 = (x1 ∨ x3) = 0 ∨ 1 = 1');
  await step(tok);                                   // 16:06 F = 1 ∧ 1 ∧ 1 = 1
  txt(st, 'F = 1 ∧ 1 ∧ 1 = 1：公式成立 ✓');
  say('F = 1 ∧ 1 ∧ 1 = 1', '這組值讓公式成立');
  await step(tok);                                   // 16:23 any other clique works too
  note('選別的 clique 照做，公式也成立', 3.8, 0.3, -1.6);
  say('換別的 clique 照做', '公式一樣會成立');
  await step(tok);                                   // 16:35 SAT NP-hard → CDP NP-hard
  tag('SAT ∝ CDP → CDP 是 NP-hard', 'ptr', 0, 0.3, 4.1);
  say('CDP 能解 → SAT 也能解', 'SAT 是 NP-hard → CDP 也是 NP-hard');
  await step(tok);                                   // 16:50 not NPC yet: write an ND poly algorithm
  note('要 NPC：再寫 ND poly 演算法（CDP 其實已知是 NPC）', 0, 0.3, -3.9);
  say('注意：這只證到 NP-hard', '再寫出 ND poly 演算法 → NP-complete');
}]);

// ════════ PqN0aJeYtuA（江蕙如 Lec22：Beyond Polynomial Running Times 1/2） ════════
// 00:18 兩個族群：有 poly 解的簡單問題 vs 目前沒人找到 poly 解的問題
FRAG.push(['np1-j-two-groups', '兩個族群：有 poly 解 vs 目前看起來很難', async (tok) => {
  fresh([0, 6.5, 12], [0, 1, 0]);
  await step(tok);                                   // 0:18 problems that need more than poly time?
  const pb = pal('問題', '?', '#cfc4b0', 0, 1.6, 0.7); pb.mood('wow');
  bub('poly time 做得完嗎？', 0, 2.0, 1.6);
  say('有沒有問題需要比 polynomial 更久的時間？');
  await step(tok);                                   // 0:32 many problems look hard
  const HP = [[2.2, -0.7], [3.4, 0.2], [4.6, 1.1]];
  const H = ['TSP', 'SAT', 'Knapsack'].map((s, i) => bx(s, C.O, HP[i][0], 0.3, HP[i][1], 1.3, 3, 0.5, 0.7));
  say('現在有很多問題', '目前看起來很困難');
  await step(tok);                                   // 0:46 nobody found a poly algorithm to solve them optimally
  const nob = note('到現在沒人找到 poly 演算法（optimally）', 3.4, 0.3, 2.2);
  say('到目前為止，沒人找到 polynomial 演算法', '能 optimally 解這些問題');
  await step(tok);                                   // 1:02 two things: reduction & NP-completeness
  gone(pb);
  tag('① polynomial time reduction', 'ptr alt', -2.6, 3.2, -1.2); tag('② NP-completeness', 'ptr alt', 2.6, 3.2, -1.2);
  say('本單元兩個重點', '① polynomial time reduction ② NP-completeness');
  await step(tok);                                   // 1:47 1960s consensus
  ellipse(-3.4, 0, 2.9, 2.2, C.G, 0.02, 0.3);
  tag('1960 年代的共識', 'ptr', -3.4, 0.2, -2.6);
  say('1960 年代就有共識');
  await step(tok);                                   // 1:58 poly algorithm = efficient = easy
  ['MST', '最短路徑', '排序'].forEach((s, i) => bx(s, C.G, -4.6 + i * 1.2, 0.3, -0.7 + i * 0.9, 1.3, 3, 0.5, 0.7));
  good('有 poly 演算法 → efficient、簡單', -3.4, 0.3, 2.2);
  say('找得到 poly time 演算法 → efficient', '這個問題也算容易解');
  await step(tok);                                   // 2:39 split into two groups
  ellipse(3.4, 0, 2.9, 2.2, C.R, 0.02, 0.22);
  const ht = tag('不存在 poly 演算法 → 難？', 'ptr alt', 3.4, 0.2, -2.6);
  say('想把問題分成兩群', '簡單的 vs 不存在 poly 演算法的');
  await step(tok);                                   // 3:01 but nobody can answer that
  txt(ht, '真的不存在？還不知道');
  kill(nob); const q = note('？', 3.4, 1.4, 0);
  say('但其實不知道', '這些問題是真的沒有 poly 解，還是只是還沒找到');
  await step(tok);                                   // 3:51 prove it → famous, millennium problem
  kill(q); note('證明出來 → 千禧年大獎、史上留名', 3.4, 1.4, 0);
  say('證明出來就能史上留名', '千禧年大獎難題之一');
  await step(tok);                                   // 5:08 what we learned is only a few
  note('課本裡能 poly 解的，只是少數', -3.4, 1.4, 0);
  say('這學期學的都能 poly time 解', '但那只是少數');
  await step(tok);                                   // 6:16 same level of difficulty
  for (let i = 0; i + 1 < HP.length; i++) rod(V3(HP[i][0], 0.3, HP[i][1]), V3(HP[i + 1][0], 0.3, HP[i + 1][1]), C.Y, 0.06);
  say('這群問題有共同性', '難度是同等級的');
  await step(tok);                                   // 6:29 the good side: solve one …
  tint(H[0], C.G); glow(H[0], GREEN);
  say('好處：用 poly 演算法解掉其中一個…');
  await step(tok);                                   // 6:42 … the whole class is solved
  for (const m of H.slice(1)) { tint(m, C.G); glow(m, GREEN); await beat(tok, 400); }
  say('…整個 class 都能用 poly time 解');
  await step(tok);                                   // 6:57 the bad side: nobody found one
  H.forEach((m) => { tint(m, C.O); glow(m, null); });
  bad('壞處：目前沒人找到', 3.4, 0.3, 2.4);
  say('壞處：到現在沒有人找到', '所以目前看起來是難的');
}]);

// 07:15 MST：optimization 版 vs decision 版（給 bound k）
const MG = { P: { a: [-3.2, 0.3, -1.6], b: [0, 0.3, -2.4], c: [-1.4, 0.3, 0.8], d: [3, 0.3, -0.6], e: [1.8, 0.3, 2.2] },
  E: [['a', 'b', 2], ['a', 'c', 3], ['b', 'c', 1], ['b', 'd', 4], ['c', 'd', 5], ['c', 'e', 6], ['d', 'e', 2]],
  T: [['b', 'c'], ['a', 'b'], ['d', 'e'], ['b', 'd']] };
const mgW = (a, b) => MG.E.find((e) => ek(e[0], e[1]) === ek(a, b))[2];
function mstGraph(drop = true) { const g = graph(MG.P, MG.E.map((e) => [e[0], e[1]]), { drop }); MG.E.forEach(([a, b, w]) => wt(MG.P, a, b, w)); return g; }
FRAG.push(['np1-j-mst-dec', 'MST：最佳化版 vs 判定版（給 bound k）', async (tok) => {
  fresh([0, 8.5, 9], [0, 0, 0.2]);
  await step(tok);                                   // 7:15 two forms: decision / optimization
  const D = bx('Decision problem', C.B, -3.4, 0.4, -3.6, 3.0, 2.5, 0.5, 0.7), O = bx('Optimization problem', C.P, 3.4, 0.4, -3.6, 3.2, 2.5, 0.5, 0.7);
  say('問題有兩種定義方式', 'decision problem 和 optimization problem');
  await step(tok);                                   // 7:48 optimization: find a solution with min/max cost
  glow(O, GOLD);
  const g = mstGraph();
  say('Optimization：input instance 進來', '找一個 solution，讓 cost 最小或最大');
  await step(tok);                                   // 8:07 objective function + constraint
  note('objective function：cost 越小越好', 3.4, 1.0, -2.8); note('constraint：規定解要長什麼樣', 3.4, 1.0, -2.1);
  say('formulation 有兩部分', 'objective function ＋ constraint');
  await step(tok);                                   // 8:46 decision: only yes / no
  glow(O, null); glow(D, GOLD);
  good('YES = 1', -4.2, 1.0, -2.8); bad('NO = 0', -2.6, 1.0, -2.8);
  say('Decision problem 只問 yes / no', '也常寫成 1 / 0');
  await step(tok);                                   // 9:28 example: MST
  glow(D, null);
  const st = tag('MST：edge 上有 cost 的 graph', 'ptr alt', 0, 0.3, 3.6);
  say('例子：minimum spanning tree（MST）', '給一張 edge 上有 cost 的 graph');
  await step(tok);                                   // 10:01 optimization: spanning tree with lowest total cost
  glow(O, GOLD);
  let sum = 0;
  for (const [a, b] of MG.T) { eCol(g, a, b, C.G); sum += mgW(a, b); txt(st, 'tree cost = ' + sum); await beat(tok, 450); }
  txt(st, '最小 cost = 1 + 2 + 2 + 4 = 9');
  say('建一棵 spanning tree 連起所有點', 'cost 總和越低越好 → 最小 = 9');
  await step(tok);                                   // 10:34 decision can't ask for the minimum
  glow(O, null); glow(D, GOLD); gReset(g); txt(st, '');
  bad('decision 版不能問「最小的是哪個」', -3.4, 1.0, -2.0);
  say('decision 版沒辦法問最小 cost 的解');
  await step(tok);                                   // 11:20 give a bound k
  txt(st, '多給一個 bound k');
  say('要多給一個參考的 bound k');
  await step(tok);                                   // 11:38 is there a spanning tree with cost ≤ k?
  bub('有 cost ≤ k 的 spanning tree 嗎？', 0, 1.4, 3.0);
  say('問：是否存在 cost 最多 k 的 spanning tree？');
  await step(tok);                                   // 12:03 yes: found one
  MG.T.forEach(([a, b]) => eCol(g, a, b, C.Y));
  txt(st, 'k = 10：找得到（cost 9）→ YES');
  say('回答 yes：對這個 instance 找得到');
  await step(tok);                                   // 12:10 or: bound too small, can't find
  gReset(g); txt(st, 'k = 8：bound 太小，找不到 → NO');
  say('或回答：你給的 bound 太小，找不到');
  await step(tok);                                   // 12:45 a decision problem must give a bound
  note('decision 版一定要給 bound！', 0, 1.0, -2.0);
  say('描述 decision problem 一定要給 bound', '不然沒辦法回答 yes / no');
}]);

// 13:11 TSP：最佳化版 vs 判定版（bound B）
const TC = { P: { A: [-2.6, 0.3, -1.7], B: [2.6, 0.3, -1.7], C: [2.6, 0.3, 1.9], D: [-2.6, 0.3, 1.9] },
  E: [['A', 'B', 3], ['B', 'C', 4], ['C', 'D', 3], ['D', 'A', 4], ['A', 'C', 5], ['B', 'D', 5]] };
const tcW = (a, b) => TC.E.find((e) => ek(e[0], e[1]) === ek(a, b))[2];
const tcCost = (s) => { let c = 0; for (let i = 0; i + 1 < s.length; i++) c += tcW(s[i], s[i + 1]); return c; };
function tspGraph(drop = true) { const g = graph(TC.P, TC.E.map((e) => [e[0], e[1]]), { drop }); TC.E.forEach(([a, b, w]) => wt(TC.P, a, b, w, 'idx', (a === 'A' && b === 'C') || (a === 'B' && b === 'D') ? 0.3 : 0.5)); return g; }
FRAG.push(['np1-j-tsp-dec', 'TSP：最短 tour vs「有沒有 tour ≤ B」', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  await step(tok);                                   // 13:11 another example: TSP
  const g = tspGraph();
  const ct = tag('', 'ptr alt', 0, 0.3, 3.3);
  say('另一個例子：traveling salesman problem');
  await step(tok);                                   // 13:24 a salesman visits clients
  const sm = pal('salesman', '', '#f4a56a', -4.4, -1.7, 0.55); sm.mood('happy');
  say('一位業務員要去拜訪他的客戶');
  await step(tok);                                   // 13:39 visit everyone and come back; shortest
  const tour = ['A', 'B', 'C', 'D', 'A'];
  for (let i = 0; i + 1 < tour.length; i++) eCol(g, tour[i], tour[i + 1], C.Y);
  const ball = await walk(tok, TC.P, tour, 400); kill(ball);
  say('從所在城市出發，拜訪一圈再回來', '路線總長越小越好');
  await step(tok);                                   // 14:08 cities + distance between any two
  gReset(g);
  txt(ct, '給定：city、任兩 city 的距離');
  say('給定一些 city', '和任兩個 city 之間的距離');
  await step(tok);                                   // 14:39 start = end
  glow(g.N.A, GOLD); note('start = end', -2.6, 1.2, -1.7);
  say('條件：起點和終點在同一個 city');
  await step(tok);                                   // 14:48 each city exactly once
  for (const v of ['B', 'C', 'D']) { glow(g.N[v], GREEN); await beat(tok, 300); }
  note('每個 city 剛好一次', 2.6, 1.2, 1.9);
  say('每個客戶剛好拜訪一次', '不要來回散步');
  await step(tok);                                   // 15:06 minimize the total route
  for (const s of [['A', 'C', 'B', 'D', 'A'], ['A', 'B', 'D', 'C', 'A'], ['A', 'B', 'C', 'D', 'A']]) {
    gReset(g); for (let i = 0; i + 1 < s.length; i++) eCol(g, s[i], s[i + 1], C.Y);
    txt(ct, s.join('→') + '：' + tcCost(s)); await beat(tok, 700);
  }
  tour.forEach((v, i, s) => { if (i) eCol(g, s[i - 1], v, C.G); });
  txt(ct, '最短 tour = 3 + 4 + 3 + 4 = 14');
  say('Optimization：minimize 總長', '最短的這一圈 = 14');
  await step(tok);                                   // 15:36 decision: one more input, bound B
  gReset(g); txt(ct, '多一個 input：bound B');
  say('Decision 版：額外多給一個 input', 'bound B');
  await step(tok);                                   // 16:08 is there a route ≤ B?
  tour.forEach((v, i, s) => { if (i) eCol(g, s[i - 1], v, C.Y); });
  txt(ct, '有 ≤ B 的 route 嗎？B = 15 → YES（14 ≤ 15）');
  say('問：有沒有起訖同城、每城一次', '總長不超過 B 的 route？');
  await step(tok);                                   // 16:36 this unit: decision form
  note('本單元討論的都是 decision 形式', 0, 1.2, 0);
  say('本單元探討的都是 decision problem 的形式');
  void sm;
}]);

// 17:15 用判定版 binary search bound → 最佳值
FRAG.push(['np1-j-bsearch', '只有判定版：二分搜 bound 找最佳值', async (tok) => {
  fresh([0, 7.5, 9.5], [0, 0, 0.2]);
  const X = (v) => -6 + v * 12 / 1000;
  cube('', '#d8c29b', [12.4, 0.08, 0.3], 0, 0.04, 2.6);
  [0, 250, 500, 750, 1000].forEach((v) => tag(String(v), 'idx', X(v), 0.1, 3.2));
  await step(tok);                                   // 17:15 decision only says "not over the bound"
  const box = pal('decision 版', '', '#4b9ee2', -5.4, -2.6, 0.6);
  bub('YES：沒超過 bound', -5.4, 1.8, -2.6);
  note('但這個 bound 是不是最佳值？不知道', 1.2, 0.4, -3.2);
  say('decision 只說「沒超過 bound」', '不知道這個 bound 是不是剛好最佳');
  await step(tok);                                   // 18:02 use binary search for the bound
  tag('binary search 找 bound', 'ptr alt', 1.2, 0.4, -2.4);
  say('手上只有 decision 版', '用 binary search 決定 bound 設多少');
  const Q = [];
  const ask = (k, i) => { const c = bx('≤' + k + '?', C.K, X(k), 0.3, -1.6 + i * 0.55, 1.0, 2.5, 0.4, 0.45); Q.push(c); return c; };
  const ans = (c, k, y) => { tint(c, y ? C.G : C.R); relabel(c, k + (y ? ' YES' : ' NO')); };
  await step(tok);                                   // 18:17 ≤ 1000? yes
  let c = ask(1000, 0); await beat(tok, 600); ans(c, 1000, 1); box.mood('happy');
  say('有 cost 不超過 1000 的 spanning tree 嗎？', '找得到 → YES');
  await step(tok);                                   // 18:31 cut in half: 500? yes
  c = ask(500, 1); await beat(tok, 600); ans(c, 500, 1);
  say('砍一半：500 找得到嗎？', '也 YES');
  await step(tok);                                   // 18:45 250?
  c = ask(250, 2);
  say('再問 250');
  await step(tok);                                   // 18:47 250 not found
  ans(c, 250, 0); box.mood('sad');
  say('250 找不到 → NO');
  await step(tok);                                   // 18:53 middle: 375
  c = ask(375, 3); await beat(tok, 600); ans(c, 375, 1); box.mood('happy');
  say('卡中間：問 375');
  await step(tok);                                   // 19:00 after a few times it converges
  for (const [k, y] of [[312, 1], [281, 0], [296, 0], [304, 1]]) { const d = ask(k, Q.length); await beat(tok, 250); ans(d, k, y); await beat(tok, 250); }
  say('這樣問幾次之後', '會收斂到某一個值');
  await step(tok);                                   // 19:05 a bit smaller: no; a bit bigger: yes
  const fin = bx('≈300', C.Y, X(300) + 1.7, 0.3, 1.97, 0.7, 3, 0.45, 0.5); glow(fin, GOLD); // beside the 296 / 304 pair it sits between
  say('小一點點就找不到', '大一點點一定找得到');
  await step(tok);                                   // 19:13 that bound is the optimum value
  good('那個 bound = 最佳解的值（示意 ≈ 300）', 0, 0.4, 3.9);
  say('那個 bound 剛好就是最佳解的值');
  await step(tok);                                   // 19:19 decision ⇄ optimization
  tag('decision ⇄ optimization 可以互相轉換', 'ptr', 1.2, 0.4, -3.9);
  say('decision 和 optimization 可以互相轉換');
}]);

// 19:35 實例：13509 個城市的 TSP
FRAG.push(['np1-j-tsp-big', '13509 個城市的 TSP：真的很難', async (tok) => {
  fresh([0, 3.4, 13], [0, 3.0, 0]);
  await step(tok);                                   // 19:35 a map of the USA
  const map = cube('', '#e9dcc4', [11.5, 6.0, 0.1], 0, 3.2, -0.2);
  tag('美國地圖（示意）', 'ptr', -4.6, 6.6);
  say('例子：美國地圖');
  await step(tok);                                   // 19:51 13509 cities highlighted
  let s = 7; const rnd01 = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pts = [];
  for (let i = 0; i < 90; i++) pts.push([-5.2 + rnd01() * 10.4, 0.6 + rnd01() * 5.0]);
  for (let i = 0; i < pts.length; i += 15) { pts.slice(i, i + 15).forEach(([x, y]) => cube('', C.R, [0.12, 0.12, 0.12], x, y, 0)); await beat(tok, 150); }
  note('13509 個城市（這裡只畫一小部分）', 3.4, 6.6);
  say('標出 13509 個城市', '任兩個城市的距離都算得出來');
  await step(tok);                                   // 20:07 compute the minimum TSP route
  const order = [pts[0]], left = pts.slice(1);
  while (left.length) { const p = order[order.length - 1]; let bi = 0, bd = 1e9; left.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); order.push(left.splice(bi, 1)[0]); }
  order.push(order[0]);
  for (let i = 0; i + 1 < order.length; i++) { line(order[i][0], order[i][1], order[i + 1][0], order[i + 1][1], 0.1, '#a8730f'); if (i % 10 === 9) await beat(tok, 120); }
  say('算這些城市的 TSP minimum route');
  await step(tok);                                   // 20:13 a TSP competition every year
  note('每年都有 TSP 競賽，隨時有新 instance', -3.0, 0.2, 0.4);
  say('每年都有 TSP 競賽', '網站上隨時有新的 instance 可以測');
  await step(tok);                                   // 20:35 the optimal route shown is very hard to get
  bub('這是最佳解的樣子，難度很高', 3.4, 0.0, 0.4);
  say('這個例子的最佳解', '要算出來難度很高');
  await step(tok);                                   // 20:45 DP for TSP
  const bars = [['n!', 6.0, C.R], ['DP：n²·2ⁿ', 4.2, C.O], ['poly：n³', 0.8, C.G]];
  const B = bars.map(([t, h, col], i) => { const m = cube('', col, [0.9, 1, 0.9], 4.2 + (i - 1) * 1.2, 0.01, 1.4); tag(t, 'idx', 4.2 + (i - 1) * 1.2, -0.3, 2.0); return [m, h]; });
  await anim(tok, 1200, (t) => B.forEach(([m, h]) => { m.scale.y = 0.01 + h * 0.5 * t; m.position.y = m.scale.y / 2; }));
  say('之前用 dynamic programming 解過 TSP');
  await step(tok);                                   // 20:58 still very high, just not factorial
  glow(B[1][0], GOLD);
  say('DP 的複雜度還是很高', '只是沒有高到階乘 n!');
  await step(tok);                                   // 21:18 TSP is NP-complete
  good('TSP：NP-complete 等級', 0, 6.6);
  say('本單元後面要說明', 'TSP 的確很難：NP-complete 等級');
  void map;
}]);

// 21:36 Cook 證出第一個 NPC，Karp 一次 21 個 → 22 個
FRAG.push(['np1-j-history', 'Cook 第一個 NPC → Karp 一次 21 個', async (tok) => {
  fresh([0, 4.5, 13], [0, 2.8, 0]);
  await step(tok);                                   // 21:36 the story starts in the early 1970s
  cube('', '#d8c29b', [12.6, 0.08, 0.3], 0, 0.04, 1.6);
  tag('1970 年代初期', 'ptr', -3.0, 0.2, 2.2);
  say('複雜度分級的故事', '要追溯到 1970 年代初期');
  await step(tok);                                   // 21:46 Stephen Cook
  const ck = pal('Stephen Cook', '', '#9b7ef4', -4.6, 0, 0.8); ck.mood('happy');
  say('Stephen Cook');
  await step(tok);                                   // 21:50 Richard Karp
  const kp = pal('Richard Karp', '', '#4b9ee2', 0.6, 0, 0.8); kp.mood('happy');
  say('Richard Karp', '兩位打下基礎，後人站在巨人肩膀上');
  await step(tok);                                   // 22:17 Cook proved the first NPC: SAT
  const sat = bx('SAT', C.O, -4.6, 2.6, 0, 1.4, 3, 0.6); glow(sat, GOLD);
  const cnt = tag('NPC：1 個', 'ptr alt', 5.0, 4.6);
  say('Cook 證明出史上第一個 NP-complete 問題', 'SAT problem');
  await step(tok);                                   // 22:35 Karp: 21 NPC problems at once
  glow(sat, null);
  for (let i = 0; i < 21; i++) { bx('', C.O, -0.9 + (i % 7) * 0.6, 4.2 - Math.floor(i / 7) * 0.6, 0, 0.45, 2, 0.45, 0.45); txt(cnt, 'NPC：' + (i + 2) + ' 個'); await beat(tok, 90); }
  kp.mood('wow');
  say('接著 Karp 一次發表 21 個', '不是一個，是 21 個');
  await step(tok);                                   // 22:50 22 NPC problems from the start
  txt(cnt, 'NPC：22 個');
  say('一開始就有 22 個 NP-complete 問題');
  await step(tok);                                   // 22:58 prove a new one NPC → a paper
  const pp = prop('file', 3.4, 2.4, 0, 1.0, '新的 NPC → 一篇論文'); bob(pp, 0.05);
  say('那個年代：證明新問題是 NPC', '就可以寫一篇論文');
  await step(tok);                                   // 23:10 a famous little book: NPC dictionary
  const bk = bx('NPC 字典（Garey & Johnson）', C.Y, 4.4, 0.6, 0.6, 3.2, 3, 0.7);
  say('1970 年代有一本很有名的小書', '等於是 NP-complete 問題的字典');
  await step(tok);                                   // 23:34 look up: is my problem NPC?
  const me = pal('你', '?', '#f4a56a', 6.2, 1.4, 0.5);
  bub('我的問題在字典裡嗎？', 6.0, 1.8, 1.4);
  say('翻一翻：手上的問題是不是 NPC？');
  await step(tok);                                   // 23:47 yes → heuristic / approximation
  me.set('NPC'); me.mood('happy');
  note('不追求最佳解 → heuristic / approximation', 3.2, 5.6);
  say('是的話：不追求 efficient 的最佳解', '退而求其次，找 heuristic 或 approximation');
  await step(tok);                                   // 24:53 everyone named things their own way
  for (const [t, x] of [['NPC', -2.6], ['NP-complete', -1.0], ['universal', 0.8], ['…', 2.2]]) { note(t, x, 6.2); await beat(tok, 200); }
  say('當時大家各做各的', '同樣意思常用不同的名詞（terminology）');
  void bk;
}]);

// 25:28 Class P（poly time 解，pseudo-poly 不算）與 NP（poly time 驗證）
FRAG.push(['np1-j-p-np', 'Class P（solve）與 NP（verify）', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 25:28 not mutually exclusive classes
  note('這些 class 不是完全互斥，只是分類方法不同', 0, 0.3, 3.1);
  say('這些 class 不是完全互斥的', '只是分類的方法不一樣');
  await step(tok);                                   // 25:40 class P
  const pE = ellipse(-3.0, 0, 2.0, 1.6, C.G, 0.05, 0.35); const pl = tag('P', 'ptr', -3.0, 0.1, -1.9);
  say('第一類：class P');
  await step(tok);                                   // 25:55 a poly time algorithm solves it
  const PM = ['MST', '排序', '最短路徑'].map((s, i) => bx(s, C.G, -3.8 + i * 0.8, 0.3, -0.7 + i * 0.7, 1.2, 2.5, 0.4, 0.5));
  say('存在 polynomial time algorithm 去 solve 它');
  await step(tok);                                   // 26:08 poly in the problem size
  note('poly 是對 problem size 而言', -3.0, 0.3, 2.0);
  say('poly 一定要是 problem size 的 polynomial');
  await step(tok);                                   // 26:16 pseudo-polynomial doesn't count
  const kn = bx('Knapsack DP：O(nW)', C.O, 0.4, 0.3, 1.0, 2.2, 2.5, 0.45, 0.6);
  await beat(tok, 700); move(kn, -2.6, 0.3, 0.9);
  bad('pseudo-polynomial 不算', -0.6, 0.3, 1.6);
  say('pseudo-polynomial 不算', 'O(nW)：W 是數值，只佔 log W 個 bit');
  await step(tok);                                   // 26:34 they're among Karp's 21 NPC
  glow(kn, RED); await beat(tok, 600); move(kn, 3.2, 0.3, 1.8);
  say('subset sum、knapsack 都是 Karp 的 NPC', '難度其實很高');
  await step(tok);                                   // 27:02 P: really solve it
  good('P：真的「解決」、得到解', -3.0, 0.3, -2.6);
  say('注意：P 講的是 solve', '真的得到解');
  await step(tok);                                   // 27:13 NP = non-deterministic polynomial
  const np = ellipse(0.6, 0, 5.0, 2.8, C.B, 0.02, 0.2); np.visible = false;
  const nE = ellipse(3.2, 0, 2.4, 2.0, C.B, 0.03, 0.25);
  const nl = tag('NP = Non-deterministic Polynomial', 'ptr', 3.2, 0.1, -2.3);
  say('第二類：NP', 'N = non-deterministic、P = polynomial');
  await step(tok);                                   // 27:26 N is not "non"
  bad('NP ≠「非 P」', 3.2, 0.3, -1.6);
  say('N 不是 non 的意思', '屬於 NP 不代表不屬於 P');
  await step(tok);                                   // 27:54 verified in poly time
  const sol = pkt('一個 solution', 5.6, 0.6, 0.4);
  const chk = bx('verify', C.P, 2.6, 0.3, 0.4, 1.2, 2.5, 0.45, 0.6);
  await slide(tok, sol, 3.4, 0.6, 0.4, 900);
  glow(chk, GREEN); relabel(chk, '✓ poly');
  say('NP：能在 polynomial time 內「驗證」', '一個 solution 是不是合法的');
  await step(tok);                                   // 28:10 only check, not solve
  note('只是 check，不用自己找', 3.2, 0.3, 1.8);
  say('只是 check 它，不是 solve 它', '不用自己找出解');
  await step(tok);                                   // 28:49 most think P is smaller, inside NP
  nE.visible = false; kill(nl); np.visible = true; tag('NP', 'ptr', 0.6, 0.1, -3.1);
  await anim(tok, 1000, (t) => { pE.position.x = -3.0 + 0.6 * t; pl.position.x = -3.0 + 0.6 * t; });
  say('大部分人認為 P 比較小', '被 NP 包在裡面');
  await step(tok);                                   // 29:13 even easy problems fit NP
  PM.forEach((m) => glow(m, GREEN));
  say('很簡單的問題，也符合 NP 的定義', '能 poly time 解，當然能 poly time 驗證');
  void chk;
}]);

// 29:22 NP-complete 的定義：所有 X ∈ NP 都 ≤p Y
FRAG.push(['np1-j-npc-def', 'NPC：NP 裡最難，所有 X ≤p Y', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0, 0, 5.2, 2.9, C.B, 0.02, 0.2); tag('NP', 'ptr', 0, 0.1, -3.2);
  await step(tok);                                   // 29:22 what is hard? NP-complete
  say('什麼叫難？', '本單元要探討 NP-complete');
  await step(tok);                                   // 29:37 the hardest few in NP
  const Y = pal('Y', 'NPC', '#dd8238', 3.0, 0.2, 0.75); Y.mood('happy');
  say('NP-complete：NP 這個 class 裡', '最難的一小撮問題');
  await step(tok);                                   // 30:08 suppose Y ∈ NP and NPC
  note('Y ∈ NP，而且是 NPC', 3.0, 0.3, 1.4);
  say('假設 problem Y 在 NP 裡，而且是 NPC');
  await step(tok);                                   // 30:18 any problem X in NP
  const Xs = [[-3.6, -1.2], [-3.2, 1.4], [-1.2, -2.0], [-0.6, 1.9], [-1.6, 0.1]];
  for (const [x, z] of Xs) { bx('X', C.B, x, 0.3, z, 0.7, 2.5, 0.45, 0.6); await beat(tok, 200); }
  say('NP 裡任何一個問題 X');
  await step(tok);                                   // 30:26 all reduce to Y
  for (const [x, z] of Xs) { arr(x + 0.4, 0.4, z, 2.4, 0.4, 0.2 + (z - 0.2) * 0.15, 0xc08a1f); await beat(tok, 250); }
  say('都可以 reduce 到 Y 上面', '用 Y 的演算法去解');
  await step(tok);                                   // 30:44 Y is the hardest
  Y.glow(GOLD); await Y.hop(tok);
  say('所有 NP 問題都能用 Y 的演算法解', '所以 Y 最難');
  await step(tok);                                   // 31:03 the symbol: X ≤p Y
  Y.glow(null);
  const sym = tag('X  ≤p  Y', 'ptr alt', 0, 2.4, 0);
  say('符號：polynomial time reduction', 'X ≤p Y');
  await step(tok);                                   // 31:07 ≤: right side harder (or equal)
  txt(sym, 'X  ≤  Y：右邊比較難（或一樣難）');
  say('≤ 暗示 complexity 的高低', '右邊比較難，左邊比較簡單，或一樣難');
  await step(tok);                                   // 31:25 subscript p: poly transformation
  txt(sym, 'X ≤p Y：p = 轉換只花 polynomial time');
  say('下標 p：額外做的轉換', '只要 polynomial time');
  await step(tok);                                   // 31:42 why transform: X's input looks different
  const tk = pkt('X 的 input', -3.6, 1.0, -1.2);
  await slide(tok, tk, 3.0, 1.2, 0.2, 1300); txt(tk, '變成 Y 的 input');
  say('X 的 input 和 Y 長得不一樣', '要先轉成 Y 的 input，才能用 Y 的演算法');
  await step(tok);                                   // 32:14 only poly time for the transformation
  good('轉換：poly time 就能做完', 0, 0.3, 3.4);
  say('轉換只要花 polynomial time', '接著 X 就能用 Y 的演算法解');
  await step(tok);                                   // 32:33 by definition: NPC is the hardest in NP
  txt(sym, 'NPC：NP 裡所有問題都 ≤p 它 → 最難');
  say('根據定義：NP 裡所有問題', '都能花 poly time 轉成它去解 → 它最難');
}]);

// 33:20 Theorem：NPC 有 poly 解 → P = NP
FRAG.push(['np1-j-pnp-theorem', 'NPC 有 poly 解 → P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0, 0, 5.2, 2.9, C.B, 0.02, 0.2); const pE = ellipse(-2.8, 0, 1.9, 1.5, C.G, 0.05, 0.35);
  const pl = tag('P', 'ptr', -2.8, 0.1, -1.8); tag('NP', 'ptr', 0, 0.1, -3.2);
  const Y = bx('Y（NPC）', C.O, 3.0, 0.4, 0.2, 1.8, 0, 0.6, 0.8);
  const Xs = [[-0.4, -1.6], [0.2, 1.6], [1.2, -0.4], [-0.9, 0.3]].map(([x, z]) => bx('X', C.B, x, 0.3, z, 0.7, 0, 0.45, 0.6));
  await step(tok);                                   // 33:20 Y NPC and someone solves it in poly
  const who = pal('某人', '', '#f4a56a', 5.4, 1.6, 0.5);
  bub('我能 poly time 解 Y！', 5.4, 1.6, 0.4);
  say('定理：Y 是 NPC', '如果有一天有人能 poly time 解 Y…');
  await step(tok);                                   // 33:36 then Y ∈ P
  tint(Y, C.G); move(Y, -2.8, 0.4, 0.4);
  say('那 Y 就屬於 P');
  await step(tok);                                   // 33:45 the rest of NP also in P
  for (const m of Xs) { tint(m, C.G); await beat(tok, 300); }
  await anim(tok, 1200, (t) => { pE.scale.x = 1.9 + 3.3 * t; pE.scale.z = 1.5 + 1.4 * t; pE.position.x = -2.8 + 2.8 * t; });
  say('其他 NP 問題都能轉成 Y 的 input 去解', '→ 也都屬於 P');
  await step(tok);                                   // 34:24 is P = NP? unknown → ?
  txt(pl, 'P = NP ?');
  say('所以 P = NP 嗎？', '目前不知道 → 打一個問號');
  await step(tok);                                   // 34:36 decades, no progress
  gone(who);
  note('1970 年代到現在：沒人做到', 3.6, 0.3, 2.6);
  say('從 1970 年代到現在', '都沒人能 poly time 解一個 NPC 問題');
  await step(tok);                                   // 34:57 most lean toward P ≠ NP
  txt(pl, 'P ≠ NP ?（多數人傾向）');
  say('大部分人傾向相信', '等號不成立：P ≠ NP');
  await step(tok);                                   // 35:15 an HP scientist
  const hp = pal('HP 的 scientist', '', '#7cb8ee', -5.4, 1.8, 0.55); hp.mood('happy');
  say('幾年前一位 HP 的 scientist', '想證明 P ≠ NP');
  await step(tok);                                   // 35:30 an 81-page proof
  const pf = prop('file', -3.6, 0.3, 2.2, 1.0, '81 頁的證明');
  say('提出一份 81 頁的證明');
  await step(tok);                                   // 35:44 posted online for everyone to debug
  const rv = [];
  for (let i = 0; i < 4; i++) { const r = pal('', '', ['#9b7ef4', '#2fc092', '#f4a56a', '#e55a9b'][i], -1.8 + i * 1.0, 2.6, 0.35); r.look(-1); rv.push(r); await beat(tok, 200); }
  say('放上網讓大家幫忙 debug', '引起廣泛討論');
  await step(tok);                                   // 35:58 flaws found
  bad('發現瑕疵 ✗', -3.6, 1.6, 2.2); hp.mood('sad');
  say('後來發現證明有瑕疵');
  await step(tok);                                   // 36:13 withdrawn after a few months
  kill(pf); gone(...rv);
  say('幾個月後，證明就撤下來了', '到現在還是沒人解決');
  await step(tok);                                   // 37:16 recap: P = poly time solve
  gone(hp);
  note('P：poly time 能 solve', -4.6, 0.3, -3.6);
  say('整理：P = polynomial time 能 solve');
  await step(tok);                                   // 37:27 NP = poly time verify
  note('NP：poly time 能 verify', 0, 0.3, -3.6);
  say('NP = non-deterministic polynomial', 'polynomial time 能 verify（不是 non-polynomial）');
  await step(tok);                                   // 37:55 NPC = hardest in NP
  note('NPC：NP 裡最難', 4.6, 0.3, -3.6);
  say('NP-complete：NP 裡最難的', '所有 NP 問題都 poly reduce 到它');
  await step(tok);                                   // 38:48 someone solves an NPC in poly → one world
  glow(pE, GREEN); txt(pl, 'P、NP 合而為一');
  say('有一天有人 poly time 解一個 NPC 問題', '→ P、NP 合而為一，「世界大同」');
}]);

// 39:25 驗證演算法 V(instance, certificate)：MST 判定版
FRAG.push(['np1-j-verifier-mst', '驗證演算法 V(instance, solution)', async (tok) => {
  fresh([0, 7.5, 9.5], [0, 0.6, 0]);
  await step(tok);                                   // 39:25 NP: verify time is polynomial
  say('NP 探討的是：驗證的時間是 polynomial');
  await step(tok);                                   // 39:35 a verification algorithm answers yes / no
  const V = pal('verification 演算法', '', '#9b7ef4', -5.0, -3.0, 0.9); // left of the graph: its answer never sits on node b
  say('驗證也要交給一個演算法', '它會回答 yes / no');
  await step(tok);                                   // 39:46 it takes two arguments
  const s1 = note('① ?', -2.0, 2.4, -3.0), s2 = note('② ?', 2.0, 2.4, -3.0);
  say('它是一個 two-argument 的演算法', '吃兩個 input');
  await step(tok);                                   // 39:55 1st: the instance (graph + bound)
  const g = mstGraph();
  txt(s1, '① instance：G 和 bound k = 10');
  say('第一個 input：討論的 instance', '例如 MST decision 版：graph 和 bound');
  await step(tok);                                   // 40:15 2nd: some solution — any tree
  MG.T.forEach(([a, b]) => eCol(g, a, b, C.Y));
  txt(s2, '② 隨便一棵 tree T');
  say('第二個 input：某一個 solution', '白話：隨便拿一棵 tree 丟給它');
  await step(tok);                                   // 40:28 check: is it a spanning tree?
  const ok1 = good('spanning tree？4 條邊、連通、沒有環 ✓', 0, 0.3, 3.4);
  V.look(0);
  say('它檢查：這棵 tree 是不是 spanning tree');
  await step(tok);                                   // 40:39 check: cost ≤ bound?
  good('cost = 1 + 2 + 2 + 4 = 9 ≤ 10 ✓', 0, 0.3, 4.0);
  V.set('YES'); V.mood('happy'); await V.hop(tok);
  say('cost 有沒有超過給定的 bound？', '9 ≤ 10 → yes');
  void ok1;
}]);

// 41:16 TSP ∈ NP：猜一個 tour，三個 linear time 檢查
FRAG.push(['np1-j-tsp-verify', 'TSP ∈ NP：猜一個 tour，linear time 檢查', async (tok) => {
  fresh([0, 7, 10], [0, 1, 0]);
  await step(tok);                                   // 41:15 TSP input: n cities, distances
  const g = tspGraph();
  say('TSP 的 input：n 個 city', '兩兩之間的距離');
  await step(tok);                                   // 41:24 plus a bound
  const bt = note('bound B = 15', 4.4, 0.4, -1.7);
  say('還要給一個 bound', '用來判斷有沒有超過');
  await step(tok);                                   // 41:42 decision: is there a route ≤ bound?
  bub('有起訖同城、每城一次、≤ B 的 route 嗎？', 0, 1.4, -2.9);
  say('decision 版：是否存在符合條件', '而且總長 ≤ bound 的 route？');
  await step(tok);                                   // 42:15 is TSP in NP?
  const q = tag('TSP ∈ NP ?', 'ptr alt', -4.6, 0.4, 2.6);
  say('TSP 是不是屬於 NP？');
  await step(tok);                                   // 42:31 can we verify a solution in poly time?
  const cd = code(['① 起點 = 終點？', '② 每個 city 恰一次？', '③ 總長 ≤ B？'], 0, 5.0, 0.6, -2.6);
  say('看能不能在 polynomial time 內', 'verify 一個 solution');
  await step(tok);                                   // 42:39 the solution is called a certificate
  note('certificate = 拿來驗證的那個 solution', -4.6, 0.4, 3.3);
  say('這個 solution 有個特別的名字', 'certificate');
  await step(tok);                                   // 43:11 first, just guess a tour
  const cert = ['A', 'B', 'C', 'D', 'A'];
  const gs = pkt('guess：⟨A, B, C, D, A⟩', 4.6, 0.4, 3.0);
  await slide(tok, gs, 0, 0.4, 3.3, 900);
  say('第一件事：先隨便猜一個 tour');
  await step(tok);                                   // 43:42 check 1: start = end
  cd.hl(0); glow(g.N.A, GOLD);
  say('① 起點和終點是不是同一個城市？', '抓頭尾就知道：都是 A ✓');
  await step(tok);                                   // 43:57 check 2: each city exactly once
  cd.hl(1);
  for (const v of ['A', 'B', 'C', 'D']) { glow(g.N[v], GREEN); await beat(tok, 300); }
  say('② 是否每個 city 剛好一次？', '掃一遍就知道 ✓');
  await step(tok);                                   // 44:18 check 3: walk the tour, sum ≤ bound
  cd.hl(2);
  for (let i = 0; i + 1 < cert.length; i++) eCol(g, cert[i], cert[i + 1], C.Y);
  const ball = await walk(tok, TC.P, cert, 380); kill(ball);
  txt(bt, '3 + 4 + 3 + 4 = 14 ≤ 15 ✓');
  say('③ 順著走一圈把距離加起來', '和 bound 比大小：14 ≤ 15 ✓');
  await step(tok);                                   // 44:53 all linear time → TSP ∈ NP
  cd.hl(-1); txt(q, 'TSP ∈ NP ✓'); q.element.className = 'lab-label good';
  say('檢查都是 linear time', '→ polynomial time 驗證完 → TSP ∈ NP');
  await step(tok);                                   // 45:21 homework 5, problem 2: step one
  note('作業 5 第 2 題：先證 ∈ NP，再證 NPC', -4.6, 0.4, -2.6);
  say('這一步簡單但很重要', '作業 5 第 2 題的第一步就是它');
}]);

// 45:57 CIRCUIT-SAT：史上第一個被證明的 NPC
FRAG.push(['np1-j-circuit-sat', 'CIRCUIT-SAT：給 0/1 讓輸出為 1', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.2, 0]);
  const IN = { x1: [-5, 4.8], x2: [-5, 3.2], x3: [-5, 1.6] };
  const GT = { g1: ['AND ∧', -2, 4.8, ['x1', 'x2']], g3: ['OR ∨', -2, 3.2, ['x2', 'x3']], g2: ['NOT ¬', -2, 1.6, ['x3']], g4: ['OR ∨', 1.2, 4.2, ['g1', 'g2']], out: ['AND ∧', 4.2, 3.0, ['g4', 'g3']] };
  const M = {};
  const P = (k) => (IN[k] ? IN[k] : [GT[k][1], GT[k][2]]);
  await step(tok);                                   // 45:57 the first problem proven NPC
  const hd = tag('史上第一個被證明是 NPC 的問題', 'ptr', 0, 6.6);
  say('史上第一個被證明是 NP-complete 的問題', '不講證明，但題目一定要記');
  await step(tok);                                   // 46:15 circuit satisfiability
  txt(hd, 'Circuit satisfiability（CIRCUIT-SAT）');
  say('它是 circuit satisfiability', '大一邏輯設計就做過很多遍');
  await step(tok);                                   // 46:32 a combinational circuit
  for (const k in IN) M[k] = bx(k + '=?', C.K, IN[k][0], IN[k][1], 0, 1.3, 2, 0.6, 0.7);
  for (const k in GT) M[k] = bx(GT[k][0], C.K, GT[k][1], GT[k][2], 0, 1.3, 2, 0.6, 0.7);
  for (const k in GT) for (const s of GT[k][3]) rod(V3(P(s)[0] + 0.65, P(s)[1], 0), V3(P(k)[0] - 0.65, P(k)[1], 0), EDGE, 0.04);
  tag('output', 'ptr alt', 6.1, 3.0);
  say('給一個 combinational circuit');
  await step(tok);                                   // 46:39 only AND, OR, NOT gates
  say('只由 AND、OR、NOT 三種 gate 組成');
  await step(tok);                                   // 47:02 ∧ is AND
  const hlG = (op) => { for (const k in GT) glow(M[k], GT[k][0].startsWith(op) ? GOLD : null); };
  hlG('AND');
  say('倒 V（∧）是 AND');
  await step(tok);                                   // 47:06 ∨ is OR
  hlG('OR');
  say('正 V（∨）是 OR');
  await step(tok);                                   // 47:14 ¬ is NOT
  hlG('NOT');
  say('勾勾（¬）是 NOT（negation）');
  await step(tok);                                   // 47:45 assign 0/1 so that output = 1?
  hlG('-');
  for (const k in IN) glow(M[k], GOLD);
  bub('能不能把 input 設成 0/1，讓 output = 1？', 0, 0.4);
  say('問：能不能適當地把 input 設成 0 或 1', '使得 output 為 1？');
  const val = {};
  const ev = (k) => { const [op, , , src] = GT[k]; const v = src.map((s) => val[s]); return op.startsWith('OR') ? v.some(Boolean) : op.startsWith('AND') ? v.every(Boolean) : !v[0]; };
  const run = async (a) => {
    ['x1', 'x2', 'x3'].forEach((k, i) => { val[k] = !!a[i]; relabel(M[k], k + '=' + a[i]); tint(M[k], a[i] ? C.G : C.D); glow(M[k], null); });
    for (const k of ['g1', 'g3', 'g2', 'g4', 'out']) { val[k] = ev(k); tint(M[k], val[k] ? C.G : C.D); await beat(tok, 300); }
  };
  await step(tok);                                   // 48:13 easy to try by hand
  await run([0, 0, 0]);
  say('大一做過很多遍：推推看', 'input 000 → output 0');
  await step(tok);                                   // 48:28 set it right → output 1
  await run([0, 1, 0]);
  glow(M.out, GREEN);
  say('適當地設一下：input 010', '→ output 1：可滿足');
  await step(tok);                                   // 48:32 this is the first NPC
  txt(hd, 'CIRCUIT-SAT：史上第一個 NPC');
  note('小電路好推；n 個 input 有 2ⁿ 種組合', 0, 0.9);
  say('這就是史上第一個被證明', '是 NP-complete 等級的問題');
}]);

// 48:50 NPC 問題才是主流
FRAG.push(['np1-j-mainstream', 'NPC 問題才是主流', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 48:50 there are lots of NPC problems
  const pile = [];
  for (let i = 0; i < 24; i++) pile.push(bx('', C.O, 0.6 + (i % 6) * 0.8, 0.3 + Math.floor(i / 6) * 0.65, (i % 2) * 0.4, 0.7, 2.5, 0.55, 0.7));
  tag('NP-complete 問題', 'ptr alt', 2.6, 3.4);
  say('NP-complete 問題非常多', '各個領域都有');
  await step(tok);                                   // 49:03 EE: VLSI layout
  const ee = pal('電機（EE）', '', '#7cb8ee', -4.6, 0.6, 0.65);
  note('VLSI layout', -4.6, 2.4, 0.6);
  say('電機領域：VLSI layout');
  await step(tok);                                   // 49:09 RTL → netlist
  note('RTL → netlist', -4.6, 2.9, 0.6);
  say('RTL 轉成 netlist 也有很多困難的問題');
  await step(tok);                                   // 49:15 verification
  note('驗證（verification）', -4.6, 3.4, 0.6); ee.mood('wow');
  say('還有很多驗證的問題');
  await step(tok);                                   // 49:30 NPC is the mainstream
  pile.forEach((m) => glow(m, GOLD));
  say('NP-complete 問題才是主流');
  await step(tok);                                   // 49:43 99.9999% of what you meet
  pile.forEach((m) => glow(m, null));
  note('你遇到的問題：99.9999% 是 NPC 或更難', 2.6, 4.4);
  say('手上遇到的問題', '大概 99.9999% 都是 NPC，甚至更難');
  await step(tok);                                   // 50:04 the thick textbook is a tiny subset
  const tiny = bx('課本', C.G, -2.0, 0.3, 1.6, 0.6, 2.5, 0.45, 0.5); glow(tiny, GREEN);
  tag('能 poly optimally 解的：很小的 subset', 'ptr', -2.0, 1.0, 2.2);
  say('課本雖然很厚', '寫的只是能 poly time 最佳解的很小 subset');
}]);

// 51:07 Reduction 的老例子：bipartite matching → network flow
FRAG.push(['np1-j-bip-flow', 'Bipartite matching 轉成 network flow', async (tok) => {
  fresh([0, 9, 7.5], [0, 0, 0.3]);
  await step(tok);                                   // 51:07 polynomial time reduction
  tag('polynomial time reduction', 'ptr', 0, 0.3, -3.6);
  say('本單元非常重要的概念', 'polynomial time reduction');
  await step(tok);                                   // 51:37 why: a new problem shows up
  const me = pal('新問題', '?', '#f4a56a', -5.6, 2.6, 0.55); me.mood('wow');
  say('為什麼要這樣做？', '我們總會遇到新的問題');
  await step(tok);                                   // 51:58 reuse an existing algorithm
  bub('不想發展新演算法，用現有的', -5.0, 1.8, 1.6);
  say('不想發展新的演算法', '想用現有的演算法解它');
  await step(tok);                                   // 52:08 network flow solved bipartite matching
  const P = { 1: [-2.2, 0.3, -1.8], 2: [-2.2, 0.3, 0], 3: [-2.2, 0.3, 1.8], a: [2.2, 0.3, -1.8], b: [2.2, 0.3, 0], c: [2.2, 0.3, 1.8] };
  const g = graph(P, [['1', 'a'], ['1', 'b'], ['2', 'a'], ['3', 'c']], { drop: true });
  me.set('matching');
  say('例：之前用 network flow', '解 bipartite matching');
  await step(tok);                                   // 52:32 transform into network flow's input
  const s = bx('s', C.P, -5.0, 0.3, 0, 0.8, 2.5, 0.5, 0.8), t = bx('t', C.P, 5.0, 0.3, 0, 0.8, 2.5, 0.5, 0.8);
  const AR = [];
  for (const v of ['1', '2', '3']) AR.push(arr(-4.6, 0.3, 0, P[v][0] - 0.4, 0.3, P[v][2]));
  for (const v of ['a', 'b', 'c']) AR.push(arr(P[v][0] + 0.4, 0.3, P[v][2], 4.6, 0.3, 0));
  say('把 bipartite matching transform 成', 'network flow 的 input（flow network）');
  await step(tok);                                   // 52:37 run the network flow algorithm
  for (const [l, r] of [['1', 'b'], ['2', 'a'], ['3', 'c']]) { glow(g.N[l], GREEN); glow(g.N[r], GREEN); eCol(g, l, r, C.G); await beat(tok, 500); }
  say('用 network flow 的演算法（Ford-Fulkerson）解', 'max flow = 3');
  await step(tok);                                   // 52:41 translate back to a matching
  const res = note('matching = {1–b, 2–a, 3–c}', 0, 0.4, 3.0);
  say('得到解之後，翻譯回', '原來 bipartite matching 的 solution');
  await step(tok);                                   // 52:59 linear time: copy + source & sink
  glow(s, GOLD); glow(t, GOLD);
  good('轉換：幾乎照抄 ＋ 加 s、t → linear time', 0, 0.4, 2.3);
  say('轉換幾乎完全照抄', '再多加 source、sink 和邊 → linear time');
  await step(tok);                                   // 53:58 must be poly; exponential is useless
  bad('轉換花 exponential time → 白搭', 0, 0.4, -2.8);
  say('轉換一定要 polynomial time', '花 exponential time 去轉就白搭了');
  await step(tok);                                   // 54:25 this unit: the other direction
  AR.forEach(kill); kill(res);
  const hard = bx('很難的問題', C.R, 4.6, 0.4, 2.6, 2.0, 2.5, 0.5, 0.7);
  arr(-1.0, 0.6, 2.6, 3.4, 0.6, 2.6, 0xc08a1f);
  say('這個單元換一個方向用', '證明 NP 的問題都能 reduce 到很難的問題上');
  void hard;
}]);

// 54:51 X ≤p Y：poly 轉換、Y 當 black box、YES ⇔ YES
async function np1ReduceDef(tok, cues) {
  fresh([0, 4.6, 13.5], [0, 3.0, 0]);
  const y = 2.4;
  let tk = null, sym = null, X = null, Y = null, f = null, out = null; const extra = [];
  for (const c of cues) {
    await step(tok);
    if (c === 'weapon') {
      Y = pal('Y', 'poly ✓', '#2fc092', 2.6, 0, 0.8); Y.mood('happy');
      for (let i = 0; i < 3; i++) extra.push(pal('', '?', '#cfc4b0', -5.4 + i * 1.2, 1.2, 0.5));
      say('Reduction 是很強的武器', '能 poly time 解 Y 時，還有多少問題能跟著解？');
    } else if (c === 'topic') {
      tag('Polynomial time reduction', 'ptr', 0, 6.2);
      say('今天的重點：polynomial time reduction');
    } else if (c === 'between') {
      X = pal('X', '', '#7cb8ee', -4.0, 0, 0.8); Y = pal('Y', '', '#dd8238', 4.0, 0, 0.8);
      say('探討兩個問題之間', '能不能做轉換');
    } else if (c === 'symbol') {
      sym = tag('X  ≤p  Y', 'ptr alt', 0, 5.4);
      say('符號：X ≤p Y');
    } else if (c === 'leq') {
      txt(sym, 'X ≤ Y：右邊比較難（頂多一樣難）');
      if (Y) { Y.g.scale.setScalar(1.25); }
      say('≤ 隱含 complexity 的高低', '右邊比較難，左邊比較簡單，或頂多一樣');
    } else if (c === 'p') {
      txt(sym, 'X ≤p Y：p = 轉換花 polynomial time');
      say('下標 p：把左邊的 input 轉成右邊的 input', '所需時間是 polynomial');
    } else if (c === 'pipe') {
      const ms = pipe([['X 的 instance x', C.B, -5.0, 2.3], ['f：poly time', C.Y, -1.7, 2.2], ['Y 的演算法', C.P, 1.7, 2.2], ['YES / NO', C.K, 4.9, 1.8]], y);
      f = ms[1]; out = ms[3];
      if (X) { gone(X); X = null; } if (Y) { gone(Y); Y = null; } gone(...extra);
      say('X ≤p Y', 'X 的 input 轉成 Y 的 input、用 Y 的演算法解');
    } else if (c === 'any') {
      tk = pkt('x', -5.0, y + 1.0, 0);
      await slide(tok, tk, -1.7, y + 1.0, 0, 700); txt(tk, 'f(x)'); await slide(tok, tk, 1.7, y + 1.0, 0, 700);
      say('對 X 的任何一個 instance x', '都能在 poly time 內建構出對應的 Y input f(x)');
    } else if (c === 'back') {
      await slide(tok, tk, 4.9, y + 1.0, 0, 600); txt(tk, 'YES'); glow(out, GREEN);
      const bk = pkt('翻譯回 X 的答案', 4.9, y - 1.2, 0); await slide(tok, bk, -5.0, y - 1.2, 0, 1200);
      say('用 Y 的演算法解完', '答案還要能翻譯回 X');
    } else if (c === 'iff1') {
      good('x 回答 YES ⇒ f(x) 也 YES', -2.6, 4.6);
      say('if and only if：左邊回答 yes', '右邊也要回答 yes');
    } else if (c === 'iff2') {
      good('f(x) 回答 YES ⇒ x 也 YES', 2.6, 4.6);
      say('反過來：右邊 yes', '左邊也要 yes');
    } else if (c === 'one2one') {
      note('一對一對應：可去可回', 0, 5.4);
      say('要 one-to-one 的 correspondence', '可以過去、也可以回來');
    } else if (c === 'three') {
      const L = [['① f 是 poly time', -3.6], ['② X yes ⇒ Y yes', 0], ['③ Y yes ⇒ X yes', 3.6]];
      for (const [s, x] of L) { tag(s, 'ptr alt', x, 6.2); await beat(tok, 300); }
      say('要證明三件事', 'poly 轉換、X yes ⇒ Y yes、Y yes ⇒ X yes');
    } else if (c === 'blackbox') {
      const gb = ghostBox(0x222222, 2.7, 1.5, 1.5); gb.position.set(1.7, y, 0);
      tag('black box', 'idx', 1.7, y + 1.0);
      say('Y 的演算法當成 black box', '交給別人做，相信他會做好');
    } else if (c === 'focus') {
      glow(f, GOLD);
      say('我們的重點放在轉換 f', '只要它能 polynomial time 完成');
    }
  }
}
// PqN0aJeYtuA 58:11 起（Lec22 最後一段）
FRAG.push(['np1-j-reduce-def', 'X ≤p Y：poly 轉換、YES ⇔ YES', (tok) => np1ReduceDef(tok, ['weapon', 'symbol', 'leq', 'p', 'pipe', 'any', 'back', 'iff1', 'iff2', 'one2one', 'three', 'blackbox', 'focus'])]);
// 6n8vyWKGsIo 00:15 起（Lec23 開頭複習）
FRAG.push(['np1-j-reduce-review', '複習 X ≤p Y：可去可回', (tok) => np1ReduceDef(tok, ['topic', 'between', 'symbol', 'leq', 'p', 'pipe', 'any', 'iff1', 'iff2', 'back', 'blackbox', 'focus'])]);

// ════════ 6n8vyWKGsIo（江蕙如 Lec23：Beyond Polynomial Running Times 2/2） ════════
// 04:20 polynomial time reduction 的三種使用時機（params.k = 0/1/2）
FRAG.push(['np1-j-three-cases', 'Reduction 的三種用法', async (tok) => {
  const k = prm().k || 0;
  fresh([0, 5.0, 12.5], [0, 2.0, 0]);
  const bX = bx('X', C.B, -3.4, 2.6, 0, 3.0, 0, 0.8), bY = bx('Y', C.K, 3.4, 2.6, 0, 3.0, 0, 0.8);
  const ar = arr(-1.8, 2.6, 0, 1.8, 2.6, 0, 0xc08a1f); const sym = tag('≤p', 'ptr alt', 0, 3.2);
  const subX = tag('', 'idx', -3.4, 1.7), subY = tag('', 'idx', 3.4, 1.7);
  if (k === 0) {
    await step(tok);                                 // 4:20 why use polynomial time reduction
    say('這頁非常重要', '為什麼要用 polynomial time reduction？');
    await step(tok);                                 // 4:59 three occasions
    ['Case 1', 'Case 2', 'Case 3'].forEach((s, i) => tag(s, 'ptr', -3.6 + i * 3.6, 5.6));
    say('使用時機分成三種');
    await step(tok);                                 // 5:06 wrong direction → proof useless
    const w = bad('方向弄錯 → 證明沒有作用', 0, 4.8);
    say('請稍微區分', '方向弄錯的話，證明就沒有作用');
    await step(tok);                                 // 5:16 case 1: efficient algorithm for a new problem
    kill(w);
    const me = pal('新問題', '?', '#f4a56a', -5.8, -1.2, 0.55); me.mood('wow');
    tag('Case 1：設計 efficient algorithm', 'ptr alt', -3.6, 6.2);
    say('Case 1：遇到新的問題', '想替它設計 efficient algorithm');
    await step(tok);                                 // 5:44 use an existing algorithm
    bub('不想從頭設計，用現有的', -5.8, 1.6, -1.2);
    say('不真的設計全新的', '用手邊已經知道的 existing algorithm');
    await step(tok);                                 // 6:08 new problem = X (left), known = Y (right)
    relabel(bX, '新問題'); relabel(bY, '已知有演算法'); tint(bY, C.G);
    say('新問題放左邊（X）', '已知有演算法的放右邊（Y）');
    await step(tok);                                 // 6:29 example: bipartite matching ≤p network flow
    relabel(bX, 'Bipartite matching'); relabel(bY, 'Network flow');
    say('例：bipartite matching ≤p network flow');
    await step(tok);                                 // 7:05 transform into a flow network
    const tk = pkt('bipartite graph', -3.4, 1.0, 0.8);
    await slide(tok, tk, 3.4, 1.0, 0.8, 1100); txt(tk, 'flow network');
    say('把 bipartite graph 轉成', 'network flow 吃的 input：flow network');
    await step(tok);                                 // 7:18 Ford-Fulkerson finds the answer
    glow(bY, GOLD); txt(tk, 'max flow');
    say('用 Ford-Fulkerson 找到解');
    await step(tok);                                 // 7:27 translate back to a matching
    glow(bY, null);
    await slide(tok, tk, -3.4, 1.0, 0.8, 1100); txt(tk, 'matching');
    me.set('解出來了'); me.mood('happy');
    say('再把解翻譯回 bipartite matching 的樣子');
    await step(tok);                                 // 7:47 the new problem can be solved efficiently
    good('新問題可以 efficient 解', -3.4, 4.0);
    say('代表新問題可以被 efficient 解');
    await step(tok);                                 // 8:06 and it's no harder than network flow
    bY.scale.set(1.25, 1.25, 1.25);
    note('左邊不比 network flow 難', 0, 4.6);
    say('也隱含：新問題不比 network flow 難', '頂多一樣難');
    await step(tok);                                 // 8:46 literature: a dedicated faster algorithm
    note('文獻：matching 有自己更快的演算法', -3.4, 0.2, 2.0);
    say('文獻上 matching 有自己的演算法', '複雜度比 network flow 再低一些');
    void ar; void sym; void subX; void subY;
    return;
  }
  if (k === 1) {
    await step(tok);                                 // 9:06 case 2: a new problem looks hard
    const me = pal('新問題', '很難?', '#f4a56a', 0, -1.4, 0.6); me.mood('sad');
    tag('Case 2：證明很難', 'ptr alt', 0, 6.2);
    say('Case 2：遇到一個新問題，覺得很難', '要說服大家它真的很難');
    await step(tok);                                 // 9:30 intractability
    note('intractable：看不到 poly time 的解法', 0, 5.4);
    say('這叫 intractability', '目前看不到 polynomial time 的解法');
    await step(tok);                                 // 9:57 X ≤p Y: where does the new one go?
    bub('新問題要放 X 還是 Y？', 0, 1.8, -1.4);
    say('X ≤p Y：新的難問題', '要放左邊還是右邊？');
    await step(tok);                                 // 10:14 the new problem goes to Y
    await slide(tok, me.g, 3.4, 0, -1.4, 900); relabel(bY, '新問題'); tint(bY, C.O);
    say('新的難問題要放在 Y（右邊）');
    await step(tok);                                 // 10:25 a known-hard problem as X
    relabel(bX, '已知很難'); tint(bX, C.R);
    say('找一個已經知道很難的問題當 X', '字典裡很多');
    await step(tok);                                 // 10:42 e.g. circuit satisfiability
    relabel(bX, 'CIRCUIT-SAT（NPC）');
    say('例如 circuit satisfiability');
    await step(tok);                                 // 10:59 done → the new one is truly hard
    tint(bY, C.R); good('右邊比已知難題更難或一樣難 → 真的很難', 0, 4.6);
    me.set('真的很難'); me.mood('wow');
    say('做成之後：左邊已經是 NPC', '右邊比它更難或一樣難 → 新問題真的很難');
    await step(tok);                                 // 11:48 swapped roles → wasted work
    bad('X、Y 放錯 → 白做工', 0, 5.4);
    say('方向弄錯，角色互換', '就是白做工');
    await step(tok);                                 // 12:09 known-hard in Y, new in X
    relabel(bX, '新問題（難度未知）'); tint(bX, C.K); relabel(bY, 'CIRCUIT-SAT（NPC）'); tint(bY, C.R);
    await slide(tok, me.g, -3.4, 0, -1.4, 900);
    say('如果把已知難題放 Y', '新問題放 X…');
    await step(tok);                                 // 12:42 new ≤ hard: no information
    me.set('???'); me.mood('calm');
    note('只知道：新問題 ≤ 難題 → 沒有資訊', -3.4, 1.0, 1.4);
    say('只知道新問題比難題簡單或一樣難', '這沒有帶給大家任何資訊');
    await step(tok);                                 // 13:01 any easy problem is ≤ a hard one
    const sortB = bx('排序', C.G, -5.6, 0.4, 1.0, 1.2, 2.5, 0.5, 0.6);
    arr(-4.9, 0.6, 1.0, 2.0, 2.3, 0, 0x2fc092);
    say('任何簡單的問題都比難的問題簡單', '例：排序 ≤p CIRCUIT-SAT 也成立');
    await step(tok);                                 // 13:18 when to use: X is known to be hard
    kill(sortB);
    relabel(bX, '已知很難（X）'); tint(bX, C.R); relabel(bY, '新問題（Y）'); tint(bY, C.O);
    await slide(tok, me.g, 3.4, 0, -1.4, 900); me.set('很難!'); me.mood('wow');
    say('正確時機：已知 X 很難、沒人找到 poly 解', '新問題放 Y → 才能說 Y 很難');
    await step(tok);                                 // 13:50 next: HC ≤p TSP
    relabel(bX, 'Hamiltonian cycle'); relabel(bY, 'TSP');
    say('等一下用 Hamiltonian cycle ≤p TSP', '示範這個 Case 2');
    void ar; void sym; void subX; void subY;
    return;
  }
  // k === 2
  await step(tok);                                   // 14:21 case 3: equivalence
  tag('Case 3：兩個一樣難（equivalence）', 'ptr alt', 0, 6.2);
  say('Case 3：建構 equivalence', '兩個問題一樣難');
  await step(tok);                                   // 14:39 X ≤p Y and Y ≤p X
  arr(1.8, 2.0, 0, -1.8, 2.0, 0, 0x2fc092); tag('≤p', 'ptr', 0, 1.4);
  say('X ≤p Y，而且 Y ≤p X');
  await step(tok);                                   // 14:51 polynomially equivalent
  tint(bX, C.P); tint(bY, C.P);
  good('polynomially equivalent', 0, 4.4);
  say('兩者難度 polynomially equivalent');
  await step(tok);                                   // 15:08 a new problem just like a classic one
  relabel(bX, '新問題'); relabel(bY, '經典問題');
  bub('其實只是換句話說', 0, 0.8, 1.2);
  say('常見：新問題和經典問題很像', '一體兩面，只是換句話說');
  await step(tok);                                   // 15:27 one-to-one correspondence
  note('one-to-one correspondence', 0, 5.2);
  say('像是 one-to-one 的 correspondence');
  await step(tok);                                   // 15:34 only the transformation time
  note('多花的只有 transformation 的時間', 0, 0.2, 2.4);
  say('要花的功夫只剩', 'transformation 所需的時間');
  await step(tok);                                   // 15:58 case 2 is where most mistakes happen
  relabel(bX, 'Case 2 最常出錯'); tint(bX, C.R);
  say('同學最常在 Case 2 出錯');
  await step(tok);                                   // 16:18 even a thesis put X and Y backwards
  const th = prop('file', -5.4, 0.6, 1.0, 1.0, '學位論文：X、Y 放錯'); bob(th, 0.05);
  bad('證明完全沒有作用', -5.4, 0.4, 2.2);
  say('甚至有學位論文把 X、Y 放錯', '證明就變得沒有作用');
  void sym; void subX; void subY;
}]);

// 16:49 Garey & Johnson 的漫畫：找不到 efficient 演算法時怎麼跟老闆說
FRAG.push(['np1-j-comic', '漫畫：找不到 efficient 演算法怎麼辦', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.6, 0]);
  const boss = pal('老闆', '', '#9b7ef4', 3.8, 0, 1.1), emp = pal('員工', '', '#7cb8ee', -3.8, 0, 1.1);
  let bb = null, eb = null;
  const bSay = (t) => { if (bb) kill(bb); bb = bub(t, 3.8, 2.4); }, eSay = (t) => { if (eb) kill(eb); eb = bub(t, -3.8, 2.4); };
  await step(tok);                                   // 16:49 the boss assigns a task
  const task = pkt('task', 3.8, 1.2, 0.6);
  await slide(tok, task, -3.8, 1.2, 0.6, 1000);
  say('公司裡：老闆 assign 一個 task 給員工');
  await step(tok);                                   // 17:01 a week later: how's progress?
  bSay('上次的問題解得如何？');
  say('過幾天，老闆來問 progress');
  await step(tok);                                   // 17:13 can't find an efficient algorithm
  eSay('我找不到 efficient 演算法…');
  say('員工老實說：找不到 efficient 演算法');
  await step(tok);                                   // 17:29 maybe I'm too dumb
  eSay('…可能是我太笨了'); emp.mood('sad');
  say('「可能是我太笨了」');
  await step(tok);                                   // 17:44 boss: spend more time
  bSay('那再多花點時間吧');
  say('老闆：沒關係，再多花點時間 study');
  await step(tok);                                   // 17:59 another week: it doesn't exist
  emp.mood('calm'); eSay('找不到，因為根本不存在！');
  say('又過一週，員工理直氣壯', '「找不到，因為根本不存在」');
  await step(tok);                                   // 18:24 boss: you didn't look carefully enough
  bSay('也許只是你找得不夠仔細');
  say('老闆：可能只是你找得不夠仔細', '找不到不代表不存在');
  await step(tok);                                   // 18:35 another week, very confident
  emp.mood('happy');
  say('再過一週，員工很有自信地去找老闆');
  await step(tok);                                   // 18:53 these famous people can't either
  eSay('這些名人、天才也都找不到！');
  for (let j = 0; j < 5; j++) { const f = pal('名人', '', '#e0b23c', -5.6 + j * 1.1, -2.4, 0.5); f.mood('wow'); await beat(tok, 200); }
  boss.mood('wow');
  say('「不是只有我，這些名人也都找不到」');
  await step(tok);                                   // 19:02 NPC uses this argument
  good('NPC：和大家都解不出來的問題一樣難', 0, 4.2);
  say('NP-complete 領域就是用這一招', '沒人找得到 efficient 演算法 → 認為它很難');
}]);

// 19:29 Hamiltonian cycle：一筆畫（12 面體有、bipartite 圖沒有）
function np1Dodeca(cx, cz) {
  const P = {}, E = [];
  const pt = (r, a) => [cx + r * Math.cos(a), 0.3, cz - r * Math.sin(a) * 0.85];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + i * 2 * Math.PI / 5;
    P['o' + i] = pt(2.8, a); P['m' + 2 * i] = pt(1.85, a); P['m' + (2 * i + 1)] = pt(1.85, a + Math.PI / 5); P['i' + i] = pt(0.95, a + Math.PI / 5);
  }
  for (let i = 0; i < 5; i++) E.push(['o' + i, 'o' + (i + 1) % 5], ['o' + i, 'm' + 2 * i], ['i' + i, 'i' + (i + 1) % 5], ['i' + i, 'm' + (2 * i + 1)]);
  for (let j = 0; j < 10; j++) E.push(['m' + j, 'm' + (j + 1) % 10]);
  return { P, E };
}
function np1Ham(ids, E) {
  const adj = {}; ids.forEach((v) => { adj[v] = []; }); E.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
  const path = [ids[0]], used = new Set(path);
  const go = () => {
    const last = path[path.length - 1];
    if (path.length === ids.length) return adj[last].includes(ids[0]);
    for (const w of adj[last]) if (!used.has(w)) { used.add(w); path.push(w); if (go()) return true; path.pop(); used.delete(w); }
    return false;
  };
  return go() ? path.concat([ids[0]]) : null;
}
FRAG.push(['np1-j-hc-def', 'Hamiltonian cycle：一筆畫走過每個點', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 19:29 demo: HC ≤p TSP
  tag('示範：Hamiltonian cycle ≤p TSP', 'ptr', 0, 0.3, -3.6);
  say('最後一塊：用 HC ≤p TSP', '示範完整的 polynomial time reduction');
  await step(tok);                                   // 19:58 accept HC is hard; aka Hamiltonian circuit
  note('先接受：HC 很難（也叫 Hamiltonian circuit）', 0, 0.3, 3.4);
  say('先接受一件事：Hamiltonian cycle 很難', '也有人叫它 Hamiltonian circuit');
  await step(tok);                                   // 20:19 input: an undirected graph
  const D = np1Dodeca(-3.4, 0);
  const g = graph(D.P, D.E, { drop: true, size: [0.32, 0.3, 0.32], label: () => '', r: 0.04 });
  say('Input 是一張沒有方向性的圖', 'undirected graph');
  await step(tok);                                   // 20:28 a pen: draw through every vertex, back to start
  const cyc = np1Ham(Object.keys(D.P), D.E);
  const pen = await walk(tok, D.P, cyc.slice(0, 7), 220, 0.8, C.Y);
  say('拿一支筆，從任一點出發', '一筆畫經過所有點，最後回到起點');
  await step(tok);                                   // 20:47 never lift the pen: only given edges
  kill(pen);
  note('不離開紙 = 只能走圖上給的 edge', -3.4, 0.3, 2.6);
  say('不離開紙：只能用 input 給的 edge', '完成這個 cycle');
  await step(tok);                                   // 21:13 this pentagon graph has an HC
  for (let i = 0; i + 1 < cyc.length; i++) { eCol(g, cyc[i], cyc[i + 1], C.R); glow(g.N[cyc[i]], GOLD); await beat(tok, 100); }
  say('這張五角形拼成的圖是特別做的', '它存在 Hamiltonian cycle');
  await step(tok);                                   // 21:27 a bipartite graph on the right
  const BP = { a1: [2.6, 0.3, -1.0], a2: [2.6, 0.3, 1.0], b1: [5.4, 0.3, -1.8], b2: [5.4, 0.3, 0], b3: [5.4, 0.3, 1.8] };
  const BE = []; for (const a of ['a1', 'a2']) for (const b of ['b1', 'b2', 'b3']) BE.push([a, b]);
  const h = graph(BP, BE, { drop: true, size: [0.5, 0.4, 0.5] });
  say('右邊這張是 bipartite graph');
  await step(tok);                                   // 21:35 can't draw it
  const tr = ['a1', 'b1', 'a2', 'b2'];
  for (let i = 0; i + 1 < tr.length; i++) eCol(h, tr[i], tr[i + 1], C.R);
  const ball = await walk(tok, BP, tr, 450); kill(ball);
  glow(h.N.b2, RED); glow(h.N.b3, GOLD);
  bad('卡住：b3 走不到', 4.0, 0.3, 2.8);
  say('這張就畫不出來', '左右必須交替走，2 個點配不了 3 個點');
  await step(tok);                                   // 21:51 HC has been proven NPC
  good('HC 已被證明是 NP-complete', 0, 0.3, 3.4);
  say('前人已經證明', 'Hamiltonian circuit problem 是 NP-complete');
}]);

// 22:07 起 HC ≤p TSP（params.step = goal / build / fwd / back）
const HG5 = { ids: ['1', '2', '3', '4', '5'], E: [['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['5', '1'], ['2', '5']] };
const hcHas = (a, b) => HG5.E.some((e) => ek(e[0], e[1]) === ek(a, b));
function np1HcPair(withRight, drop) {
  const PL = ring(HG5.ids, -3.7, 0.2, 2.2), PR = ring(HG5.ids, 3.7, 0.2, 2.2);
  const gL = graph(PL, HG5.E, { drop, size: [0.6, 0.45, 0.6] });
  tag('G（HC 的 input）', 'ptr', -3.7, 0.3, -2.8);
  let gR = null;
  if (withRight) {
    const all = []; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) all.push([HG5.ids[i], HG5.ids[j]]);
    gR = graph(PR, all, { size: [0.6, 0.45, 0.6] });
    all.forEach(([a, b]) => { const w = hcHas(a, b) ? 1 : 2; eCol(gR, a, b, w === 1 ? C.G : C.R); wt(PR, a, b, w, w === 1 ? 'idx' : 'ptr alt'); });
    tag('TSP instance：B = n = 5', 'ptr', 3.7, 0.3, -2.8);
  }
  return { PL, PR, gL, gR };
}
const HC_CYC = ['1', '2', '3', '4', '5', '1'];
FRAG.push(['np1-j-hc-tsp', 'HC ≤p TSP：有邊 cost 1、沒邊 cost 2、B = n', async (tok) => {
  const stp = prm().step || 'build';
  fresh([0, 8.5, 8.5], [0, 0, 0.3]);
  if (stp === 'goal') {
    const hc = bx('HC（已知 NPC）', C.R, -3.7, 0.5, 0.2, 2.6, 0, 0.8, 1.2);
    await step(tok);                                 // 22:07 TSP
    const T = bx('TSP（新問題）', C.O, 3.7, 0.5, 0.2, 2.6, 2.5, 0.8, 1.2);
    say('現在要處理的是 traveling salesman problem');
    await step(tok);                                 // 22:20 n cities and distances
    const t1 = note('給 n 個 city ＋ 兩兩距離', 3.7, 0.4, 1.4);
    say('給定 n 個 city', '和任兩個 city 之間的距離');
    await step(tok);                                 // 22:38 a route through every city once, back to start
    const t2 = note('每個 city 恰好一次、回到起點', 3.7, 0.4, 2.0);
    say('找一條 route：每個 city exactly 一次', '最後回到出發的 city');
    await step(tok);                                 // 23:08 total ≤ a given bound
    const t3 = note('總長 ≤ 給定的 bound？', 3.7, 0.4, 2.6);
    say('而且總長 ≤ 給定的 bound');
    await step(tok);                                 // 23:17 we want: TSP is hard too
    glow(T, GOLD);
    say('想建構的是：TSP 也很難');
    await step(tok);                                 // 23:25 a reduction HC ≤p TSP
    arr(-2.2, 0.6, 0.2, 2.2, 0.6, 0.2, 0xc08a1f); tag('≤p', 'ptr alt', 0, 1.1, 0.2);
    say('做法：從 Hamiltonian circuit', 'polynomial time reduce 到 TSP');
    await step(tok);                                 // 23:50 HC is known hard → TSP is hard
    tint(T, C.R);
    say('HC 已知很難；成功 reduce 過去', '→ 代表 TSP 也很難（Case 2）');
    await step(tok);                                 // 24:19 first block: the transformation
    [t1, t2, t3].forEach(kill);
    const L = ['① 轉換 f：poly time', '② HC yes ⇒ TSP yes', '③ TSP yes ⇒ HC yes'];
    tag(L[0], 'ptr alt', 0, 0.4, -2.4);
    say('第一塊：建構 input 的 transformation', '把左邊的 input 轉成右邊的 input');
    await step(tok);                                 // 25:04 check it's poly time
    note('要 check：轉換是 polynomial time', 0, 0.4, -1.7);
    say('而且要 check 這個轉換', '能在 polynomial time 內做完');
    await step(tok);                                 // 25:13 second block: if and only if
    tag(L[1], 'ptr alt', -3.0, 0.4, 2.6); tag(L[2], 'ptr alt', 3.0, 0.4, 2.6);
    say('第二塊：if and only if', '左邊 yes 右邊也 yes，右邊 yes 也能轉回左邊 yes');
    await step(tok);                                 // 26:09 HC instance has a cycle ⇒ TSP route ≤ bound
    glow(hc, GREEN); await beat(tok, 500); glow(T, GREEN);
    say('要證：HC 找得到 cycle', '⇒ 轉出來的 TSP 有 route ≤ bound');
    await step(tok);                                 // 26:41 and the reverse
    glow(hc, null); glow(T, GOLD); await beat(tok, 500); glow(hc, GREEN);
    say('反過來也要證：TSP 找到 route ≤ bound', '⇒ 能轉回 HC 的 cycle');
    return;
  }
  if (stp === 'build') {
    const { PR } = np1HcPair(false, true);
    await step(tok);                                 // 27:24 the transformation is a mapping function f
    const f = bx('f', C.Y, 0, 0.5, 0.2, 0.9, 2.5, 0.7, 0.9);
    say('Transformation 就是一個 mapping', '要建構一個 function f');
    await step(tok);                                 // 27:42 HC's input: an undirected graph
    say('左邊 HC 的 input：undirected graph', '一些點，彼此之間有一些連線');
    await step(tok);                                 // 28:02 as many cities as G has vertices
    const gR = { N: {} };
    for (const v of HG5.ids) { gR.N[v] = bx(v, C.K, PR[v][0], 0.3, PR[v][2], 0.6, 2.5, 0.45, 0.6); await beat(tok, 200); }
    say('TSP 的 input 是 n 個 city', '左邊有幾個點，右邊就建幾個 city');
    await step(tok);                                 // 28:10 distances between every two cities
    note('還要：兩兩 city 之間的距離', 3.7, 0.4, 3.0);
    say('TSP 還需要兩兩 city 之間的距離', '所以要把左邊的 edge 轉成右邊的 edge');
    await step(tok);                                 // 28:25 TSP's graph is a complete graph
    note('complete graph：任兩點都要有 edge', 3.7, 0.4, 3.6);
    say('TSP 的圖是 complete graph', '原本沒有 edge 的地方，也要建一條並給 weight');
    await step(tok);                                 // 29:05 G's edges → cost 1
    for (const [a, b] of HG5.E) { rod(V3(...PR[a]), V3(...PR[b]), C.G, 0.05); wt(PR, a, b, 1); await beat(tok, 250); }
    say('原圖有 edge 的地方', '給一個單位的 weight：cost 1');
    await step(tok);                                 // 29:20 missing edges → cost 2
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = HG5.ids[i], b = HG5.ids[j];
      if (hcHas(a, b)) continue;
      rod(V3(...PR[a]), V3(...PR[b]), C.R, 0.035); wt(PR, a, b, 2, 'ptr alt'); await beat(tok, 300);
    }
    say('原圖沒有 edge 的地方也建一條', 'cost 給貴一點：2');
    await step(tok);                                 // 29:41 expensive → TSP avoids them
    bub('cost 2 比較貴，不想走', 5.6, 1.4, 0.2);
    say('cost 比較高', '走 TSP 時就不傾向使用它');
    await step(tok);                                 // 29:57 what bound?
    say('bound 要設多少？');
    await step(tok);                                 // 30:23 bound = n
    tag('B = n = 5', 'ptr alt', 3.7, 0.3, -3.4);
    say('bound 設為 n', 'cycle 要經過 n 個點');
    await step(tok);                                 // 30:46 only G's edges: n × 1 = n
    note('只走原圖的 edge：n 條 × cost 1 = n', -3.7, 0.4, 3.0);
    say('只用原圖給的 edge 就走得完的話', 'n 條 edge、每條 cost 1 → 總和 n');
    await step(tok);                                 // 31:28 time: n vertices O(n)
    glow(f, GOLD);
    note('建 n 個點：O(n)', 0, 1.4, -1.0);
    say('這個 transformation 要花多少時間？', '建 n 個點：O(n)');
    await step(tok);                                 // 31:39 ~n² edges → O(V²): polynomial
    good('約 n² 條邊 → O(V²)：polynomial time ✓', 0, 1.4, -0.3);
    say('complete graph 約 n² 條邊', '→ O(V²)，是 polynomial time ✓');
    return;
  }
  const { PR, gL, gR } = np1HcPair(true, false);
  const st = tag('', 'ptr alt', 3.7, 0.3, 3.0);
  if (stp === 'fwd') {
    await step(tok);                                 // 32:21 the relation between solutions
    say('接著建構 solution 之間的關係');
    await step(tok);                                 // 32:35 step 2: left yes ⇒ right yes
    tag('② HC yes ⇒ TSP yes', 'ptr', 0, 0.4, -3.6);
    say('第二步：左邊 yes ⇒ 右邊 yes');
    await step(tok);                                 // 32:56 suppose G has a Hamiltonian circuit
    for (let i = 0; i + 1 < HC_CYC.length; i++) { eCol(gL, HC_CYC[i], HC_CYC[i + 1], C.Y); await beat(tok, 300); }
    say('假設 HC 的 input G', '找得到一個 Hamiltonian circuit');
    await step(tok);                                 // 33:57 write it as v1, v2, …, vn, v1
    note('v1 → v2 → … → vn → v1', -3.7, 0.4, 3.0);
    say('把它寫成 v1, v2, …, vn', '再回到 v1');
    await step(tok);                                 // 34:10 move the same circuit onto TSP's graph
    for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gR, HC_CYC[i], HC_CYC[i + 1], C.Y);
    const ball = await walk(tok, PR, HC_CYC, 400); kill(ball);
    say('同一個 circuit 搬到 TSP 的圖上', '也是經過所有點恰一次、回到起點的 route');
    await step(tok);                                 // 34:34 n edges, all from G → cost 1 each
    txt(st, 'n 條 edge，每條都是原圖的 → cost 1');
    say('它經過 n 條 edge', '都是原圖的 edge，每條 cost 1');
    await step(tok);                                 // 35:02 total n ≤ bound n → yes
    txt(st, '1+1+1+1+1 = 5 ≤ B = 5 → YES');
    say('總長 = n × 1 = n ≤ bound', '→ TSP 回答 yes');
    await step(tok);                                 // 35:41 left has a solution ⇒ right has one
    good('HC yes ⇒ TSP yes ✓', 0, 0.4, 3.6);
    say('左邊有解，右邊就找得到解 ✓');
    return;
  }
  // back：TSP yes ⇒ HC yes
  await step(tok);                                   // 35:45 step 3: someone finds a TSP solution
  tag('③ TSP yes ⇒ HC yes', 'ptr', 0, 0.4, -3.6);
  say('第三步：假設右邊有人找到一個解');
  await step(tok);                                   // 36:00 the way back is usually the harder one
  note('一般 reduction：回來的方向常常比較難', 0, 0.4, 3.6);
  say('一般證明裡，回來的方向通常比較難', '常是卡關的地方');
  await step(tok);                                   // 36:34 this one is intuitive
  say('這題比較直覺', '所以相對簡單');
  await step(tok);                                   // 37:08 a TSP tour of total ≤ n
  for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gR, HC_CYC[i], HC_CYC[i + 1], C.Y);
  txt(st, '找到一個 tour：總長 ≤ n');
  say('設 TSP 的圖上找到一個 tour', '總長 ≤ n');
  await step(tok);                                   // 37:45 through every vertex once, back to start
  const ball = await walk(tok, PR, HC_CYC, 400); kill(ball);
  say('它經過所有點、每點一次', '再回到原點：像一個 cycle');
  await step(tok);                                   // 38:10 n edges, total ≤ n
  txt(st, 'n 條 edge，總長 ≤ n');
  say('所以它經過 n 條 edge', 'total distance ≤ n');
  await step(tok);                                   // 38:28 n shared by n edges → each at most 1
  note('n ÷ n 條 = 平均每條最多 1', 3.7, 0.4, 3.6);
  say('總長 n 平均分攤給 n 條 edge', '每條最多只能 cost 1');
  await step(tok);                                   // 38:54 costs are only 1 or 2 → all are 1
  const bad5 = ['1', '3', '2', '5', '4', '1'];
  gR && Object.keys(gR.E).forEach((k) => { const [a, b] = k.split('-'); gR.E[k].material.color.set(hcHas(a, b) ? C.G : C.R); });
  for (let i = 0; i + 1 < bad5.length; i++) eCol(gR, bad5[i], bad5[i + 1], C.PK);
  txt(st, '用到 cost 2：2+1+1+1+2 = 7 > 5 ✗');
  await beat(tok, 1600);
  Object.keys(gR.E).forEach((k) => { const [a, b] = k.split('-'); gR.E[k].material.color.set(hcHas(a, b) ? C.G : C.R); });
  for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gR, HC_CYC[i], HC_CYC[i + 1], C.Y);
  txt(st, '每條都只能是 cost 1');
  say('cost 只有 1 或 2，沒有 0.5', '→ 每條一定都是 cost 1');
  await step(tok);                                   // 39:25 cost-1 edges exist in G
  for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gL, HC_CYC[i], HC_CYC[i + 1], C.G);
  say('cost 1 的 edge', '在原圖上都存在');
  await step(tok);                                   // 39:40 paste back → a Hamiltonian circuit
  for (let i = 0; i + 1 < HC_CYC.length; i++) { eCol(gL, HC_CYC[i], HC_CYC[i + 1], C.Y); glow(gL.N[HC_CYC[i]], GREEN); await beat(tok, 300); }
  say('直接貼回左邊', '就形成一個 Hamiltonian circuit');
  await step(tok);                                   // 40:04 HC ≤p TSP done
  good('HC ≤p TSP 證完 ✓', 0, 0.4, 3.0);
  say('完成：Hamiltonian circuit ≤p TSP');
}]);

// 40:19 NPC 的定義：① ∈ NP ② 所有 L′ ∈ NP 都 ≤p L（NP-hard）
FRAG.push(['np1-j-npc-def2', 'NPC 兩個要件：∈ NP ＋ NP-hard', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  await step(tok);                                   // 40:19 HC is NPC → TSP is hard too
  const pr = bx('HC（NPC）→ TSP 也很難', C.O, 0, 0.4, -3.4, 4.2, 2.5, 0.6, 0.8);
  say('HC 已知是 NP-complete', '所以這裡建構出 TSP 也很難');
  await step(tok);                                   // 40:45 definition: the hardest in NP
  kill(pr);
  ellipse(-0.5, 0, 4.4, 2.7, C.B, 0.02, 0.2); tag('NP', 'ptr', -0.5, 0.1, -3.0);
  const L = pal('L', '', '#dd8238', 2.6, 0.3, 0.7);
  say('最後給定義：NP-complete', 'NP 這個 class 裡最難的問題');
  await step(tok);                                   // 41:03 a decision problem L is NPC if …
  say('一個 decision problem L 是 NP-complete', '代表兩件事');
  await step(tok);                                   // 41:11 ① L ∈ NP
  good('① L ∈ NP', 2.6, 0.3, 1.5);
  say('① L 一定屬於 NP', 'NP 裡最難的，當然要在 NP 裡；缺一不可');
  await step(tok);                                   // 41:26 ② every L′ in NP ≤p L
  const Ls = [[-3.8, -1.2], [-3.4, 1.3], [-1.6, -1.9], [-1.0, 1.8], [-1.9, 0.1]];
  for (const [x, z] of Ls) { bx('L′', C.B, x, 0.3, z, 0.7, 2.5, 0.45, 0.6); await beat(tok, 150); }
  for (const [x, z] of Ls) { arr(x + 0.4, 0.4, z, 2.0, 0.4, 0.3 + (z - 0.3) * 0.15, 0xc08a1f); await beat(tok, 200); }
  say('② NP 裡其他任何一個 L′', '都能 polynomial reduce 到 L');
  await step(tok);                                   // 41:55 so L is the hardest
  L.mood('happy'); await L.hop(tok);
  say('所有人都能 reduce 到我身上', '→ L 最厲害、最難');
  await step(tok);                                   // 42:11 property ② is called NP-hard
  tag('② 這個性質叫 NP-hard', 'ptr alt', 2.6, 0.3, 2.3);
  say('第二個性質另外有一個名字', 'NP-hard');
  await step(tok);                                   // 42:39 the first NPC was proven by the definition
  const ck = pal('Cook', '', '#9b7ef4', 5.6, -2.0, 0.5);
  say('史上第一個 NPC 就是照這個定義證的', '這很難證');
  await step(tok);                                   // 42:49 must show EVERY NP problem converts
  note('for each：每一個 NP 問題都要轉得過來！', -0.5, 0.3, 3.2);
  ck.mood('wow');
  say('因為要證明「每一個」NP 問題', '都能 poly reduce 過來');
  await step(tok);                                   // 43:09 Cook: a general representation
  ck.mood('happy');
  good('Cook：用一種通用表示法一次轉完', 3.0, 0.3, -3.2);
  say('Cook 的方法比較 tricky', '用 general representation 表示所有問題，再證它轉得過來');
}]);

// 43:36 P = NP 或 P ≠ NP：NPC 落在 tractable / intractable 哪一邊？
FRAG.push(['np1-j-pnp-cases', 'P = NP？NPC 靠哪一邊', async (tok) => {
  fresh([0, 4.5, 12], [0, 1.6, 0]);
  const L = bx('NPC 問題 L', C.O, 0, 0.5, 0, 2.0, 0, 0.7);
  await step(tok);                                   // 43:36 P = NP? nobody can answer
  const q = tag('P = NP ?', 'ptr alt', 0, 1.6);
  say('最有名的問題：P 是否等於 NP？', '目前沒有人能回答');
  await step(tok);                                   // 43:48 only two cases
  cube('', C.G, [5.6, 0.08, 1.6], -3.0, 0.04, 0); cube('', C.R, [5.6, 0.08, 1.6], 3.0, 0.04, 0);
  tag('情況一：P = NP', 'ptr', -3.0, 0.2, 1.4); tag('情況二：P ≠ NP', 'ptr alt', 3.0, 0.2, 1.4);
  say('只有等於、不等於兩種情況');
  await step(tok);                                   // 44:01 someone finds a poly algorithm for an NPC
  const who = pal('某人', '', '#f4a56a', -5.6, -1.2, 0.5); who.mood('happy');
  move(L, -3.0, 0.5, 0); tint(L, C.G); txt(q, '');
  say('如果有人對一個 NPC 問題', '找到 polynomial time 演算法');
  await step(tok);                                   // 44:17 everyone reduces to it → P = NP
  for (let i = 0; i < 3; i++) arr(-5.6 + i * 1.0, 1.4, 1.0, -3.4, 0.9, 0.2, 0xc08a1f);
  good('所有 NP 都 reduce 過來 → P = NP', -3.0, 2.6);
  say('所有人都 reduce 到它，它又能 poly 解', '→ P = NP');
  await step(tok);                                   // 44:33 someone proves no poly algorithm exists
  move(L, 3.0, 0.5, 0); tint(L, C.R);
  bad('證明 NPC 不可能有 poly 演算法 → P ≠ NP', 3.0, 2.6);
  say('如果有人證明 NPC 問題', '不可能有 polynomial time 演算法 → P ≠ NP');
  await step(tok);                                   // 45:08 tractable / intractable
  tag('Tractable：poly time 可解', 'idx', -3.0, 0.2, 2.1); tag('Intractable：相反', 'idx', 3.0, 0.2, 2.1);
  say('Tractable = polynomial time solvable', 'intractable 就是相反');
  await step(tok);                                   // 45:17 which side? nobody knows
  move(L, 0, 0.5, 0); tint(L, C.O); txt(q, '？');
  say('NP-complete 到底比較靠哪一邊？', '目前沒有人知道');
  void who;
}]);

// 45:28 實務上的證法：L ∈ NP ＋ 已知 NPC 的 L′ ≤p L（TSP 為例）
FRAG.push(['np1-j-npc-practical', '實務證 NPC：∈ NP ＋ 已知 NPC ≤p 它', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.0, 0]);
  await step(tok);                                   // 45:28 summary: how to prove NPC
  tag('遇到一個問題，怎麼證明它是 NPC？', 'ptr', 0, 6.8);
  say('總結：怎麼證明一個問題是 NP-complete');
  await step(tok);                                   // 45:35 definition: ∈ NP and all NP ≤p it
  const def = bx('定義：① ∈ NP　② 每個 NP 問題都 ≤p L', C.K, 0, 6.0, 0, 7.0, 3, 0.6);
  say('照定義：① 屬於 NP', '② 所有 NP 問題都 poly reduce 過來');
  await step(tok);                                   // 45:58 too hard in practice
  glow(def, RED); bad('實用上太難證', 4.6, 5.3);
  say('實用上太難證', '很難對所有 NP 問題都做 reduction');
  await step(tok);                                   // 46:09 practical: use the theorem
  fly(def, V3(0, 6, -3));
  const th = tag('Theorem（實務上用這個）', 'ptr alt', 0, 6.0);
  say('實務上不用定義', '用 theorem 來證');
  await step(tok);                                   // 46:28 condition 1 unchanged: L ∈ NP
  const S = [];
  S.push(bx('① L ∈ NP', C.B, -3.6, 5.0, 0, 3.6, 3, 0.6));
  say('第一個條件不變：L 屬於 NP');
  await step(tok);                                   // 46:35 condition 2: find a known NPC L′
  S.push(bx("② 找已知 NPC 的 L′", C.P, -3.6, 4.1, 0, 3.6, 3, 0.6));
  say("第二個條件：先找一個已知 NPC 的問題 L′");
  await step(tok);                                   // 46:51 L′ ≤p L
  S.push(bx("③ 建構 L′ ≤p L", C.Y, -3.6, 3.2, 0, 3.6, 3, 0.6));
  say("建構 L′ polynomial reduce 到 L", '就能證明 L 也很難');
  await step(tok);                                   // 47:19 this unit proved: TSP is NPC
  const T = pal('TSP', '', '#dd8238', 4.0, 0.6, 0.8);
  say('這個單元其實已經證完了', 'traveling salesman problem is NP-complete');
  await step(tok);                                   // 47:26 ① TSP ∈ NP (guess a tour, check)
  tag('猜 tour，poly time 檢查 ✓', 'ptr alt', 1.4, 5.0);
  say('① 前面猜一個 tour', '在 polynomial time 內檢查 → TSP ∈ NP');
  await step(tok);                                   // 47:58 ② known NPC: Hamiltonian circuit
  tag('L′ = Hamiltonian circuit ✓', 'ptr alt', 1.4, 4.1);
  say('② 已知 NPC 的 L′', '選 Hamiltonian circuit');
  await step(tok);                                   // 48:16 a reduction function f in poly time
  tag('f：cost 1／2、B = n，O(V²) ✓', 'ptr alt', 1.4, 3.2);
  say('建構 reduction function f', '而且 polynomial time 做得完');
  await step(tok);                                   // 48:51 HC yes ⇔ TSP yes
  S.push(bx('④ yes ⇔ yes', C.O, -3.6, 2.3, 0, 3.6, 3, 0.6));
  tag('兩個方向都證完 ✓', 'ptr alt', 1.4, 2.3);
  say('最後：左邊 yes ⇔ 右邊 yes', '兩個方向都證完');
  await step(tok);                                   // 49:37 HC as the medium → TSP is NPC
  T.set('NPC'); T.mood('happy'); await T.hop(tok);
  say('透過 Hamiltonian circuit 當媒介', '證明 TSP 是 NP-complete');
  void th;
}]);
  }

  // ═══ np2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel } = K;
// ─── MIT 6.006 Fall 2011：L23 moPtwq_cVH8（Erik Demaine）、Rec23 t5Wxk96QjUk ───
// Cued scenes: every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s), nothing loops or replays.
// 老師的「難度軸」：左邊簡單、右邊困難，刻度 P、NP、EXP、R（示意圖，不是精確的集合圖）。
// 逐字稿沒給數字的例子（負權環小圖、10110₂、3-Partition 的 9 個數、RSA 的 61 × 53、n³／2ⁿ 的長條、
// 3ⁿ 個頂點）都是自建的小例子，畫面上會標「示意」。老師板書的 CNF 式子照影片。
const NC = { P: '#2fc092', NP: '#4b9ee2', EXP: '#e0b23c', R: '#9b7ef4', BAD: '#d64545', N: '#cfc4b0', O: '#dd8238', K: '#6e5f49', S: '#c9b48e' };
const NX = { P: -3.8, NP: -0.8, EXP: 1.6, R: 3.9 };
const AX_CAM = () => fresh([0, 4.6, 13], [0.2, 1.8, 0]);
function npNotch(n, x = NX[n]) { const l = line(x, -0.3, x, 0.3, 0, '#3a3024'); const t = tag(n, 'ptr', x, -0.75); return { l, t, x }; }
function npAxis(names = []) {
  line(-6.3, 0, 6.2, 0, 0, NC.K); arrow(V3(6.0, 0, 0), V3(6.9, 0, 0));
  tag('easy', 'idx', -6.1, -0.6); tag('hard', 'idx', 6.3, -0.6);
  const ns = {}; for (const n of names) ns[n] = npNotch(n); return ns;
}
// 從最左邊延伸到刻度 x 的一條半透明帶子（類別 = 刻度左邊全部）
function npBand(n, y, x = NX[n], color = NC[n], from = -6.3) {
  const w = Math.max(0.1, x - from), m = ghostBox(color, w, 0.34, 0.9); m.position.set(from + w / 2, y, 0);
  const t = tag(n, 'idx', from + 0.45, y + 0.02); return { m, t, kill() { kill(m); kill(t); } };
}
// 從刻度往右延伸的帶子（X-hard）
function hardBand(x, y, label) {
  const w = 6.2 - x, m = ghostBox(NC.BAD, w, 0.34, 0.9); m.position.set(x + w / 2, y, 0);
  const t = tag(label, 'idx', x + 1.1, y + 0.02); return { m, t, kill() { kill(m); kill(t); } };
}
const card = (t, c, x, y, w = 1.5, drop = 0, z = 0) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
// friendly pictures: speech bubbles, sticky notes, travelling packets, ✓ / ✗ chips
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a character (problem / machine / person); b.g is its group
const pal = (name, v, color, x, y = 0, z = 0, s = 0.7) => buddy(name, v, color, x, y, z, s);
async function slide(tok, o, x, y, z = 0, ms = 800) { const g = o.g || o; const a = g.position.clone(); await travel(tok, g, a, V3(x, y, z), ms); }
function gone(...os) {
  for (const o of os.flat()) {
    if (!o) continue;
    if (o.isObject3D) kill(o); else if (o.g) kill(o.g); else if (o.kill) o.kill();
  }
}
// a tiny graph in the x-y plane: nodes {id: [x, y]}, edges [a, b, w]
function miniG(nodes, edges, col = NC.N, s = 0.5) {
  const N = {}, E = [], W = [];
  for (const [k, [x, y]] of Object.entries(nodes)) N[k] = cube(k, col, [s, s, s], x, y, 0);
  for (const [a, b, w] of edges) {
    const [ax, ay] = nodes[a], [bx, by] = nodes[b];
    E.push(line(ax, ay, bx, by, 0, '#8a7a5c'));
    W.push(w == null ? null : note(String(w), (ax + bx) / 2, (ay + by) / 2 + 0.22));
  }
  return { N, E, W, setW(ws) { ws.forEach((w, i) => { if (W[i]) txt(W[i], String(w)); }); }, kill() { Object.values(N).forEach(kill); E.forEach(kill); W.forEach((w) => w && kill(w)); } };
}

// ════════ moPtwq_cVH8（MIT 6.006 L23：Computational Complexity） ════════
// 01:09 P、EXP、R 三個類別 → 畫成難度軸
FRAG.push(['np2-axis', '難度軸：P、EXP、R 與無解問題', async (tok) => {
  AX_CAM();
  await step(tok);                                   // 68.5 three complexity classes: P, EXP, R
  [['P', NC.P], ['EXP', NC.EXP], ['R', NC.R]].forEach(([n, c], i) => cube(n, c, [1.3, 0.7, 0.8], -2.4 + i * 2.4, 5.2, 0, 3));
  say('三個複雜度類別', 'P、EXP、R');
  await step(tok);                                   // 81.1 P = all problems solvable in polynomial time
  const bP = ghostBox(NC.P, 3.6, 2.4, 0.3); bP.position.set(-3.2, 2.0, 0);
  tag('P：多項式時間能解', 'ptr', -3.2, 3.5);
  say('P：多項式時間能解的問題', '時間是 n 的固定次方，例如 n²、n³');
  await step(tok);                                   // 98.0 almost every problem in this class is in P (one exception)
  const kids = [['排序', -4.3], ['最短路徑', -2.1]].map(([n, x]) => pal(n, '✓', NC.P, x, 1.6, 0, 0.5));
  kids.forEach((k) => k.mood('happy'));
  const ex = note('只有一個例外（猜猜看？）', -3.2, 0.45);
  say('這學期的問題幾乎都在 P', '只有一個例外');
  await step(tok);                                   // 121.5 EXP = solvable in exponential time
  const bE = ghostBox(NC.EXP, 8.8, 3.4, 0.25); bE.position.set(-0.6, 2.2, -0.1);
  tag('EXP：指數時間能解', 'ptr', 2.0, 4.15);
  say('EXP：指數時間能解的問題', 'P 整個包在 EXP 裡面');
  await step(tok);                                   // 142.2 formally 2^(n^c): 2^n, 2^(n²), 2^(n³)
  const fs = ['2ⁿ', '2^(n²)', '2^(n³)'].map((t, i) => note(t, 0.6 + i * 1.3, 3.2 - (i % 2) * 0.5));
  say('指數 = 2 的「多項式」次方', '2ⁿ、2^(n²)、2^(n³) 都算');
  await step(tok);                                   // 164.8 this class: things obviously in EXP, shown to be in P
  gone(ex);
  const q = pal('新問題', '?', NC.EXP, 2.3, 0.7, 0, 0.5); q.mood('wow');
  await slide(tok, q, -3.2, 0.95, 0, 1400);
  q.set('✓'); q.mood('happy');
  good('本課的工作：證明它其實在 P', -1.0, 0.2);
  say('這門課一直在做：把問題拉進 P', '看起來要指數時間 → 找到多項式解法');
  await step(tok);                                   // 194.7 draw it as a horizontal axis: computational difficulty
  AX_CAM();
  npAxis([]);
  tag('computational difficulty（計算難度）', 'ptr alt', 0, 4.6);
  note('示意圖：不是精確的圖', 0, 3.8);
  say('改畫成一條橫軸', '左邊簡單、右邊困難');
  await step(tok);                                   // 233.8 over here the easy problems: P
  npNotch('P'); npBand('P', 0.55);
  bub('簡單的問題', -5.2, 1.4);
  say('最左邊：P');
  await step(tok);                                   // 240.5 then EXP; something will be filled in the middle
  npNotch('EXP'); npBand('EXP', 1.1);
  const mid = tag('?', 'ptr alt', NX.NP, 0.6);
  note('中間之後還要補一個刻度', NX.NP, 2.2);
  say('再往右：EXP', '中間之後還會補一個');
  await step(tok);                                   // 248.8 and then this is something called R
  npNotch('R');
  say('再往右：R');
  await step(tok);                                   // 276.3 R = problems solvable in finite time
  npBand('R', 1.65);
  note('R：有限時間內能解', NX.R - 1.2, 2.7);
  say('R：有限時間內能解的問題');
  await step(tok);                                   // 289.8 R stands for recursive (= computable)
  note('R = recursive = 可計算（computable）', NX.R - 1.2, 3.3);
  say('R 來自 recursive', '意思是「可計算」');
  await step(tok);                                   // 307.8 the arrow keeps going: there are unsolvable problems
  const u = card('無解', NC.BAD, 5.1, 1.0, 1.1, 3);
  bad('根本解不了', 5.1, 1.9);
  say('R 的右邊還有問題', '根本解不了的問題');
  await step(tok);                                   // 316.8 in fact most problems are unsolvable (we'll prove it)
  glow(u, RED);
  for (let i = 0; i < 6; i++) cube(null, NC.BAD, [0.3, 0.3, 0.3], 4.4 + (i % 3) * 0.6, 2.6 + Math.floor(i / 3) * 0.5, 0, 2);
  note('其實「大部分」問題都在這裡', 5.0, 3.9);
  say('大部分問題都解不了', '等一下會證明');
}]);

// Rec23 00:22 從最右邊講起：Halting、R
FRAG.push(['np2-axis-rec', '難度軸最右端：Halting problem 與 R', async (tok) => {
  AX_CAM();
  await step(tok);                                   // 22.1 complexity = how hard is a problem
  const e = pal('簡單的問題', '', NC.P, -5.0, 1.2, 0, 0.6); e.mood('happy');
  const h = pal('困難的問題', '', NC.BAD, 5.0, 1.2, 0, 0.6); h.mood('sad');
  say('計算複雜度：問題有多難？', '有的很簡單，有的很難');
  await step(tok);                                   // 32.0 Erik's line: easy on the left, hard on the right
  npAxis([]);
  bub('Erik 畫的線：左邊簡單、右邊困難', 0, 4.4);
  say('沿用 Erik 的難度軸');
  await step(tok);                                   // 39.3 what's the hardest problem we can have?
  gone(e, h);
  const qm = tag('最難的是？', 'ptr alt', 5.4, 2.4);
  say('最難的問題是什麼？');
  await step(tok);                                   // 48.0 chess? no — something beyond chess
  const ch = card('Chess', NC.EXP, NX.EXP, 1.0, 1.2, 3);
  note('chess？還有更難的', NX.EXP, 1.9);
  say('chess 嗎？', '不，還有比 chess 更難的');
  await step(tok);                                   // 54.3 the halting problem is somewhere here
  gone(qm);
  const hp = card('Halting', NC.BAD, 5.4, 1.0, 1.4, 3);
  say('Halting problem 在最右邊');
  await step(tok);                                   // 76.0 there is no solution, no matter how much time/computers/money
  glow(hp, RED);
  bad('多少時間、電腦、錢都解不了', 4.6, 1.9);
  say('Halting problem 沒有解', '不管給多少時間、電腦、錢');
  await step(tok);                                   // 86.7 it's undecidable
  tag('undecidable（不可判定）', 'ptr', 4.8, 2.6);
  say('這叫 undecidable', '最糟的那一種問題');
  await step(tok);                                   // 93.0 given a program in any representation: does it terminate?
  const f = prop('file', -4.6, 2.6, 0, 1, '任何程式');
  bub('它會停下來嗎？', -2.4, 3.6);
  say('Halting：給一支程式', '判斷它會不會停（終止）');
  await step(tok);                                   // 107.8 there's a proof that it's impossible to solve
  bad('已證明：不可能寫出這種演算法', -2.0, 4.4);
  say('聽起來很簡單', '但已經證明：不可能解');
  await step(tok);                                   // 115.0 some programs: while true with no break
  const cd = code(['while True:', '    pass  # 沒有 break'], -1.4, 5.6, 0.5);
  say('有些程式一眼就看得出來', '例如沒有 break 的 while True');
  await step(tok);                                   // 130.5 some instances easy, the general case proven impossible
  good('特例：很好判斷', 1.6, 5.4);
  bad('一般情況：沒人做得到', 1.6, 4.8);
  say('有些特例很好判斷', '但「對所有程式都對」的演算法不存在');
  await step(tok);                                   // 154.0 on an interview: safe to laugh — "you show me how"
  bub('面試考這題？笑著反問：你示範看看？', -2.6, 1.6);
  say('面試遇到 Halting problem', '可以放心說：這題沒人解得了');
  await step(tok);                                   // 173.1 chess is still here (inside)
  gone(cd, f);
  tint(ch, NC.EXP); glow(ch, GOLD);
  good('chess：能算完', NX.EXP, 2.5);
  say('chess 還在左邊這裡', '比 Halting 好一點');
  await step(tok);                                   // 190.1 this is the boundary for R; this whole thing is R
  npNotch('R'); npBand('R', 0.55);
  say('這條線是 R 的邊界', '左邊整段都是 R');
  await step(tok);                                   // 198.0 R = decidable: finite amount of time
  note('R = decidable：有限時間一定算完', -3.0, 1.3);
  say('R = decidable（可判定）', '寫得出有限時間內算完的演算法');
  await step(tok);                                   // 209.0 will the world end first? maybe — but finite
  bub('世界末日前算得完？不一定，但一定會停', -3.0, 2.1);
  say('可能要很久', '但時間是有限的');
  await step(tok);                                   // 226.8 R comes from "recursive" (old 1940 term)
  note('R 來自 recursive（1940 年代的用語）', -3.0, 2.9);
  say('R 其實是 recursive 的縮寫', '記住：R 就是 decidable');
  await step(tok);                                   // 251.7 all the problems we care about are in R
  [-5.4, -4.4, -3.4, -2.4].forEach((x) => { const b = pal('', '✓', NC.R, x, 3.6, 0, 0.42); b.mood('happy'); });
  say('我們在乎的問題都在 R 裡', '接著往左看：EXP、NP、P');
}]);

// 05:43 例子：負權環、n×n chess、Go、Tetris、Halting
FRAG.push(['np2-examples', '把問題放上難度軸', async (tok) => {
  AX_CAM();
  npAxis(['P', 'EXP', 'R']); npBand('P', 0.45); const bE = npBand('EXP', 0.95); npBand('R', 1.45);
  await step(tok);                                   // 343.3 negative-weight cycle detection
  const nc = pal('負權環偵測', '?', NC.P, -5.0, 3.6, 0, 0.55); nc.mood('wow');
  say('例一：負權環偵測', '前面學過的問題');
  await step(tok);                                   // 352.3 given a weighted graph: any negative-weight cycle?
  const G = miniG({ a: [0.4, 5.6], b: [3.0, 5.6], c: [1.7, 3.8] }, [['a', 'b', 2], ['b', 'c', -4], ['c', 'a', 1]]);
  note('示意：2 + (−4) + 1 = −1 < 0', 4.8, 4.4);
  say('給一張有權重的圖', '有沒有總和是負的環？');
  await step(tok);                                   // 359.8 P: Bellman-Ford, VE time
  await slide(tok, nc, -5.0, 1.0, 0, 1000);
  nc.set('✓'); nc.mood('happy');
  good('P：Bellman-Ford O(VE)', -4.8, 2.4);
  say('答案：在 P', 'Bellman-Ford，O(VE) 時間');
  await step(tok);                                   // 368.8 add a source reaching everything with weight 0
  const s = cube('s', NC.O, [0.5, 0.5, 0.5], -1.4, 4.7, 0);
  const sl = [[0.4, 5.6], [3.0, 5.6], [1.7, 3.8]].map(([x, y]) => line(-1.4, 4.7, x, y, 0, NC.O));
  note('0', -0.6, 5.4);
  say('加一個源點 s，連到每個點', '權重都是 0 → 整張圖都檢查得到');
  await step(tok);                                   // 377.8 also in EXP: everything in P is in EXP
  good('P 裡的問題也在 EXP', -1.8, 2.0);
  say('它也在 EXP', '多項式時間 ≤ 指數時間');
  await step(tok);                                   // 397.5 n × n chess
  G.kill(); gone(s, sl);
  const brd = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) brd.push(cube(null, (r + c) % 2 ? '#6e5f49' : '#efe3c8', [0.42, 0.42, 0.12], 1.6 + c * 0.44, 3.9 + r * 0.44, 0));
  note('n × n 棋盤（畫 4 × 4 示意）', 2.3, 3.4);
  const chs = pal('n×n chess', '?', NC.EXP, -1.4, 3.6, 0, 0.55);
  say('例二：n × n 的西洋棋');
  await step(tok);                                   // 405.3 does white win from here?
  bub('白棋從這裡會贏嗎？', 2.3, 6.0);
  say('給一個盤面', '白棋會不會贏？');
  await step(tok);                                   // 414.9 solvable in exponential time: play out all strategies
  await slide(tok, chs, 0.6, 2.2, 0, 1000);
  note('試遍所有走法 → EXP', 0.6, 3.6);
  say('可以在指數時間解', '把所有走法都下下看');
  await step(tok);                                   // 424.9 and it's not in P
  chs.mood('sad');
  bad('不在 P（已證明）', -0.6, 4.3);
  say('而且它不在 P', '沒有多項式時間的演算法');
  await step(tok);                                   // 442.9 order of growth: analyze n×n, not 8×8
  note('看 n 變大時怎麼成長：8×8 是固定大小', 2.4, 6.6);
  say('複雜度看的是「成長」', '所以分析 n×n，不是 8×8');
  await step(tok);                                   // 451.8 Go is also in EXP but not in P
  const go = pal('Go', '', NC.EXP, 1.3, 1.0, 0, 0.5); go.mood('sad');
  say('圍棋（Go）也一樣', '在 EXP，不在 P');
  await step(tok);                                   // 469.8 Tetris
  gone(brd);
  const tt = pal('Tetris', '?', NC.NP, -2.6, 4.6, 0, 0.55);
  say('例三：Tetris', '照真正的 Tetris 規則');
  await step(tok);                                   // 481.8 the catch: all pieces are told in advance
  const pcs = [NC.O, NC.NP, NC.P, NC.R, NC.EXP].map((c, i) => cube(null, c, [0.4, 0.4, 0.4], -0.6 + i * 0.55, 5.2, 0, 1));
  note('事先告訴你所有方塊', 0.5, 4.6);
  say('唯一的條件', '之後會來的方塊全部先告訴你');
  await step(tok);                                   // 497.8 can I survive from this board?
  bub('能活下來嗎？', -2.6, 6.1);
  say('問題：能不能活下來？', 'YES / NO');
  await step(tok);                                   // 504.7 also solvable in exponential time: try all possibilities
  await slide(tok, tt, -1.6, 2.0, 0, 900);
  say('也能在指數時間解', '把所有可能都試一遍');
  await step(tok);                                   // 512.4 we don't know if it's in P; pretty sure not
  const tq = tag('在 P 嗎？不知道', 'ptr alt', -1.6, 3.3);
  say('在不在 P？還不知道', '但很相信不在');
  await step(tok);                                   // 534.6 Tetris is actually right here (not defined yet)
  gone(pcs);
  await slide(tok, tt, NX.NP, 2.0, 0, 800);
  txt(tq, '其實在這裡（之後解釋）'); tq.position.x = NX.NP;
  say('Tetris 其實在這個位置', '這個刻度之後才定義');
  await step(tok);                                   // 545.8 next: the halting problem
  const hp = pal('Halting', '?', NC.BAD, 3.0, 4.6, 0, 0.55);
  say('例四：Halting problem');
  await step(tok);                                   // 568.8 given a program: does it ever halt?
  const f = prop('file', 5.2, 3.9, 0, 0.8, '一支程式');
  bub('它會停嗎？', 3.0, 6.1);
  say('給一支程式', '它最後會不會停下來？');
  await step(tok);                                   // 593.8 ran 5 hours: infinite loop bug, or just slow?
  hp.mood('sad');
  note('跑 5 小時了：無窮迴圈？還是只是慢？', 0.2, 6.6);
  say('很實用：程式跑了 5 小時', '是有 bug 卡住，還是只是慢？');
  await step(tok);                                   // 612.8 not in R: no correct algorithm
  gone(f);
  await slide(tok, hp, 5.2, 1.4, 0, 900);
  bad('不在 R：沒有正確的演算法', 4.6, 3.0);
  say('Halting 不在 R', '沒有演算法能對所有程式判斷');
  await step(tok);                                   // 625.5 special cases (empty program) are easy
  good('空程式：看得出會停', 4.6, 3.7);
  say('特例可以判斷', '但沒有對「所有程式」都對的方法');
  await step(tok);                                   // 642.1 infinite time works: just run it
  note('給無限時間：直接跑就知道；有限時間：不行', 2.2, 4.5);
  say('無限時間可以：直接執行', '有限時間內沒辦法');
}]);

// 11:02 決策問題；程式 = 有限 bit 串 = 自然數
FRAG.push(['np2-programs-n', '程式 = 有限 bit 串 = 自然數', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 661.8 easier result: almost every problem is not in R
  const claim = tag('要證明：幾乎所有問題都不在 R', 'ptr alt', 0, 6.0);
  say('先證一件比較簡單的事', '幾乎所有問題都不在 R');
  await step(tok);                                   // 689.6 decision problems: answer is yes or no
  const y = card('YES', NC.P, -1.2, 4.6, 1.1, 3), n = card('NO', NC.BAD, 1.2, 4.6, 1.1, 3);
  say('decision problem（決策問題）', '答案只有 YES 或 NO');
  await step(tok);                                   // 697.3 negative cycle? white wins? survive Tetris? halts?
  const ex = [['負權環?', 'YES'], ['白棋贏?', 'NO'], ['Tetris 活?', 'YES'], ['會停?', 'NO']].map(([t, v], i) => {
    const b = pal(t, v, v === 'YES' ? NC.P : NC.BAD, -4.5 + i * 3.0, 1.6, 0, 0.6); b.mood(v === 'YES' ? 'happy' : 'calm'); return b;
  });
  say('剛才的例子都是這種', '負權環？白棋贏？活得下來？會停？');
  await step(tok);                                   // 708.1 complexity theory focuses on decision problems
  note('整個複雜度理論只看決策問題', 0, 3.5);
  say('複雜度理論只研究決策問題', '比較方便');
  await step(tok);                                   // 724.8 any problem converts to a decision problem; about as hard
  gone(ex, y, n);
  const a = card('最短路徑有多長？', NC.O, -3.2, 2.2, 2.8, 2), b = card('有長度 ≤ k 的路嗎？', NC.P, 3.2, 2.2, 3.0, 2);
  arrow(V3(-1.7, 2.2, 0), V3(1.6, 2.2, 0));
  note('示意：最佳化問題 → 決策問題', 0, 1.2);
  say('別的問題都能改成決策問題', '難度差不多');
  await step(tok);                                   // 740.3 claim: most decision problems are uncomputable
  gone(a, b);
  txt(claim, '主張：大部分決策問題都無法計算');
  say('主張：大部分都不可計算', '用一點集合論就能證');
  await step(tok);                                   // 755.0 problems on one hand, programs on the other
  const zP = ghostBox(NC.BAD, 4.6, 3.6, 0.3); zP.position.set(-3.6, 2.6, -0.2); tag('問題（problems）', 'ptr', -3.6, 4.7);
  const zG = ghostBox(NC.NP, 5.6, 3.6, 0.3); zG.position.set(3.0, 2.6, -0.2); tag('程式（programs）', 'ptr', 3.0, 4.7);
  say('一邊是問題，一邊是程式', '用程式比「演算法」更精確');
  await step(tok);                                   // 773.0 code: throw it into Python, works or not
  const cd = code(['def solve(x):', '    ...', '    return yes_or_no'], 3.0, 4.0, 0.5);
  say('程式很明確', '丟進 Python，能跑就是能跑');
  await step(tok);                                   // 788.5 in the end a program is a binary string
  const bits = ['1', '0', '1', '1', '0'].map((v, i) => cube(v, NC.S, [0.6, 0.6, 0.6], 1.3 + i * 0.75, 1.7, 0, 2));
  say('程式最後都存成 0 和 1', '一個 binary string');
  await step(tok);                                   // 804.3 a binary string is a number in binary
  note('10110₂ = 22（示意）', 3.0, 0.8);
  say('binary string 也能看成二進位數', '例如 10110₂ = 22');
  await step(tok);                                   // 821.6 math bold N: every program is an integer
  cd.kill();
  tag('ℕ = {0, 1, 2, 3, …}', 'ptr alt', 3.0, 3.6);
  good('每支程式 ↔ 一個自然數', 3.0, 2.8);
  say('每支程式 = 一個自然數', '很大的整數，但還是整數');
}]);

// 14:06 決策問題 = 無限 bit 串 = 實數；ℕ 可數、ℝ 不可數
FRAG.push(['np2-problems-r', '決策問題 = 無限 bit 串 = 實數', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.2, 0]);
  await step(tok);                                   // 845.8 a decision problem is a function: input → yes/no
  const fn = pal('決策問題', 'f', NC.R, -4.6, 3.9, 0, 0.7);
  note('輸入 → YES / NO', -4.6, 3.3);
  say('決策問題 = 一個函數', '輸入 → YES 或 NO');
  await step(tok);                                   // 874.0 output 1/0; input is a binary string → natural number
  note('YES / NO 寫成 1 / 0；輸入也是 bit 串 → 自然數', -1.0, 5.6);
  say('YES / NO 寫成 1 / 0', '輸入也是 binary string → 自然數');
  await step(tok);                                   // 898.0 write it as a table of all answers
  const outs = ['0', '0', '1', '0', '1', '1'], X = (i) => -2.2 + i * 1.2;
  const cs = [];
  for (let i = 0; i < outs.length; i++) {
    tag('輸入 ' + i, 'idx', X(i), 4.0);
    cs.push(cube(outs[i], outs[i] === '1' ? NC.P : NC.S, [0.9, 0.7, 0.7], X(i), 3.2, 0, 2));
    await anim(tok, 180, () => {});
  }
  say('把所有輸入的答案列成一張表', '輸入 0 → 0、1 → 0、2 → 1……');
  await step(tok);                                   // 928.0 an infinite string of bits
  tag('…', 'ptr', X(6), 3.2);
  note('每個輸入都要有答案 → 無限長', X(3), 2.3);
  say('這是一條無限長的 bit 串', '任何一條都代表一個決策問題');
  await step(tok);                                   // 942.4 decision problem = infinite bits; program = finite bits
  const pg = ['1', '0', '1', '1', '0'].map((v, i) => cube(v, NC.NP, [0.6, 0.6, 0.6], -5.4 + i * 0.7, 1.0, 0, 2));
  tag('程式：有限長', 'ptr', -4.0, 0.3);
  tag('問題：無限長', 'ptr alt', 1.0, 4.7);
  say('問題 = 無限 bit 串', '程式 = 有限 bit 串');
  await step(tok);                                   // 951.6 put a binary point in front: a real number in [0, 1)
  tag('.', 'ptr alt', X(0) - 0.75, 3.0);
  note('.001011…₂ = 0 到 1 之間的實數', X(3), 5.3);
  say('前面加一個 binary point', '就變成 0 到 1 之間的實數');
  await step(tok);                                   // 980.0 problems ~ ℝ, programs ~ ℕ
  const pr = card('programs ∈ ℕ', NC.NP, -4.0, -0.4, 2.4, 2), pb = card('problems ∈ ℝ', NC.BAD, 2.6, -0.4, 4.2, 2);
  say('問題 ↔ 實數 ℝ', '程式 ↔ 自然數 ℕ');
  await step(tok);                                   // 999.0 reals are uncountable, integers countable
  note('ℕ：可數（countable）', -4.0, -1.2);
  note('ℝ：不可數（uncountable），多太多了', 2.6, -1.2);
  say('ℝ 比 ℕ 大得多', 'uncountable vs. countable');
  await step(tok);                                   // 1021.1 bad news: way more problems than programs
  glow(pb, RED);
  bad('問題遠比程式多', 2.6, 0.4);
  say('壞消息：問題比程式多太多', '幾乎每個問題都沒有程式能解');
  await step(tok);                                   // 1060.8 every program only solves one problem
  gone(cs, pg, fn);
  const progs = [0, 1, 2].map((i) => { const b = pal('程式 ' + (i + 1), '', NC.NP, -5.0, 1.6 + i * 1.5, 0, 0.5); b.mood('happy'); return b; });
  const probs = [];
  for (let i = 0; i < 12; i++) probs.push(cube(null, i % 4 === 0 ? NC.P : NC.BAD, [0.4, 0.4, 0.4], -0.4 + (i % 6) * 0.9, 2.0 + Math.floor(i / 6) * 1.6, 0, 2));
  [0, 4, 8].forEach((k, i) => { const p = K.land(probs[k]); arrow(V3(-4.4, 1.9 + i * 1.5, 0), V3(p.x - 0.3, p.y, 0)); });
  note('每支程式只解一個問題；剩下的沒人解', 1.8, 4.6);
  say('每支程式只解一個問題', '程式根本不夠分');
  await step(tok);                                   // 1085.2 yet most problems we think about are computable?
  bub('可是我們想到的問題，大多解得出來？', 1.8, 5.5);
  say('奇怪的是', '我們平常想到的問題大多可計算');
  await step(tok);                                   // 1115.7 problems we think of are usually in EXP → computable
  good('我們會描述的問題，多半在 EXP → 可計算', 1.8, 0.8);
  say('我們描述問題的方式很像演算法', '所以多半在 EXP 裡，算得出來');
  await step(tok);                                   // 1138.0 infinite line; the small solvable portion is what we care about
  gone(progs, probs, pr, pb);
  line(-6.2, -0.6, 6.2, -0.6, 0, NC.K);
  const seg = ghostBox(NC.P, 2.6, 0.4, 0.6); seg.position.set(-4.9, -0.6, 0);
  note('我們在乎的：能解的這一小段', -4.4, 0.2);
  note('其餘：Halting 和大部分問題', 2.6, 0.2);
  say('能解的只是一小段', '但演算法要研究的就是這一段');
}]);

// 19:13 NP 定義一：lucky（nondeterministic）演算法
FRAG.push(['np2-lucky', 'NP：會「猜對」的 lucky 演算法', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 3.0, 0]);
  await step(tok);                                   // 1153.3 this notch: NP
  tag('NP', 'ptr alt', -4.4, 6.2);
  say('補上中間那個刻度：NP');
  await step(tok);                                   // 1174.8 closely related to DP's guessing
  note('跟 DP 的「猜」很有關係', -4.4, 5.5);
  say('NP 跟 DP 的「猜」很像');
  await step(tok);                                   // 1201.8 not "not polynomial" — nondeterministic polynomial
  bad('Not Polynomial ✗', -4.4, 4.8);
  good('Nondeterministic Polynomial ✓', -4.4, 4.2);
  say('NP 不是 Not Polynomial', 'NP = Nondeterministic Polynomial');
  await step(tok);                                   // 1212.1 same first line: decision problems solvable in poly time
  note('決策問題、多項式時間能解（跟 P 一樣）', 2.0, 6.2);
  say('前半句跟 P 一樣', '多項式時間能解的決策問題');
  await step(tok);                                   // 1219.0 ...via a lucky algorithm
  const lk = pal('lucky 演算法', '', NC.O, 2.0, 4.2, 0, 0.7); lk.mood('happy');
  note('……用「幸運演算法」', 2.0, 5.6);
  say('差別在後半句', '用一個 lucky（幸運的）演算法');
  await step(tok);                                   // 1240.5 DP tries all guesses; lucky tries one — always right
  const dp = pal('DP', '', NC.NP, -1.2, 1.2, 0, 0.6);
  const opts = ['A', 'B', 'C'].map((t, i) => cube(t, NC.S, [0.6, 0.6, 0.6], 1.4 + i * 1.4, 1.6, 0));
  const hand = pkt('DP 每個都試', -1.2, 2.6);
  for (const o of opts) await travel(tok, hand, hand.position.clone(), V3(o.position.x, 2.4, 0), 450);
  glow(opts[1], GREEN);
  good('lucky：只試一個，而且一定猜對', 2.8, 0.7);
  say('DP：每個選項都試', 'lucky：只試一個，每次都猜對');
  await step(tok);                                   // 1256.1 not a realistic model: the nondeterministic model
  note('不是真實的計算模型：nondeterministic model', 2.0, 3.2);
  say('這不是真實的計算方式', '叫 nondeterministic model');
  await step(tok);                                   // 1274.2 can't build it on a real computer, but gets at the core
  const cpu = prop('cpu', -4.4, 1.6, 0, 0.9, '真的電腦');
  bad('造不出來', -4.4, 3.4);
  good('但抓到「能解什麼」的核心', -1.6, 3.4);
  say('真的電腦做不出來', '但它抓到「什麼能解」的本質');
  await step(tok);                                   // 1299.5 it makes guesses: this way or that way?
  fresh([0, 4.2, 12.5], [0, 3.0, 0]);
  const T = { root: [1.5, 5.4], L1: [[-0.5, 4.0], [3.5, 4.0]], L2: [[-1.5, 2.6], [0.5, 2.6], [2.5, 2.6], [4.5, 2.6]] };
  const root = cube('開始', NC.S, [1.0, 0.55, 0.6], ...T.root, 0);
  const L1 = T.L1.map(([x, y]) => { line(T.root[0], T.root[1], x, y); return cube('猜', NC.S, [0.7, 0.55, 0.6], x, y, 0); });
  const lk2 = pal('lucky', '', NC.O, -4.6, 3.8, 0, 0.6); lk2.mood('calm');
  bub('走這條還是那條？', -4.4, 5.6);
  say('遇到岔路：該走哪邊？', '它就「猜」一個');
  await step(tok);                                   // 1305.8 doesn't flip a coin; not random
  bad('不是丟硬幣、不是隨機', -4.4, 2.6);
  say('不是丟硬幣，也不是隨機', '是一種「魔法」選擇');
  await step(tok);                                   // 1316.1 another fork in the road: guess again
  const L2 = T.L2.map(([x, y], j) => { line(T.L1[j >> 1][0], T.L1[j >> 1][1], x, y); return cube('猜', NC.S, [0.7, 0.55, 0.6], x, y, 0); });
  say('又遇到岔路', '再猜一次');
  await step(tok);                                   // 1337.6 at the end the algorithm says yes or no
  const vals = ['NO', 'NO', 'NO', 'YES', 'NO', 'YES', 'NO', 'NO'];
  const LV = vals.map((v, i) => { const x = -2.0 + i * 1.0; line(T.L2[i >> 1][0], T.L2[i >> 1][1], x, 1.2); return cube(v, v === 'YES' ? NC.P : NC.BAD, [0.85, 0.5, 0.6], x, 1.2, 0, 2); });
  say('最後輸出 YES 或 NO', '有的路通到 YES，有的通到 NO');
  await step(tok);                                   // 1348.1 guesses are guaranteed to lead to yes, if possible
  const cur = pkt('lucky', T.root[0], T.root[1] + 0.8);
  const path = [T.root, T.L1[0], T.L2[1], [-2.0 + 3 * 1.0, 1.2]];
  for (let k = 1; k < path.length; k++) await travel(tok, cur, V3(path[k - 1][0], path[k - 1][1] + 0.8, 0), V3(path[k][0], path[k][1] + 0.8, 0), 550);
  glow(LV[3], GREEN); lk2.mood('happy');
  good('只要有 YES，猜測保證走到 YES', -4.4, 1.6);
  say('魔法：只要可能，就會走到 YES', '這就是「lucky」');
  await step(tok);                                   // 1393.0 if all answers are no, it outputs no
  LV.forEach((m) => { relabel(m, 'NO'); tint(m, NC.BAD); glow(m, null); }); lk2.mood('calm');
  txt(cur, '輸出 NO');
  say('如果全部都是 NO', '怎麼猜都輸出 NO，不會亂說 YES');
  await step(tok);                                   // 1417.0 NP = poly time by a really lucky algorithm
  tag('NP = lucky 演算法多項式時間能解的問題', 'ptr alt', 1.5, 6.4);
  say('NP：幸運演算法能在多項式時間解');
}]);

// 23:53 Tetris ∈ NP：每一步放哪、怎麼轉，都用猜的
FRAG.push(['np2-tetris-guess', 'Tetris 在 NP：每個方塊都用猜的', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const CX = (c) => -2.5 + c, RY = (r) => 0.5 + r, S = [0.95, 0.95, 0.95];
  await step(tok);                                   // 1433.2 Tetris, I claim, is in NP
  line(-3, 0, 3, 0, 0, NC.K); line(-3, 0, -3, 6.2, 0, NC.K); line(3, 0, 3, 6.2, 0, NC.K);
  const top = line(-3, 6, 3, 6, 0, NC.BAD); tag('頂端', 'idx', 3.7, 6);
  const row0 = [0, 1, 2, 3].map((c) => cube(null, GRAY, S, CX(c), RY(0)));
  const tb = pal('Tetris', '?', NC.NP, -5.2, 3.0, 0, 0.6);
  say('主張：Tetris 在 NP');
  await step(tok);                                   // 1439.9 exponential: try all — but no need
  note('可以試所有可能（EXP），但不需要', -5.0, 5.4);
  say('試遍所有可能 → 指數時間', '但其實不用全部試');
  await step(tok);                                   // 1450.9 drop here, here, here? rotated? — guess
  const gh = [0, 2, 4].map((c) => { const g = ghostBox(NC.O, 1.9, 1.9, 0.95); g.position.set(CX(c) + 0.5, RY(4) + 0.5, 0); return g; });
  const qs = [0, 2, 4].map((c) => tag('?', 'ptr', CX(c) + 0.5, RY(5) + 0.4));
  say('方塊放哪一欄？怎麼轉？', '不知道 → 用猜的');
  await step(tok);                                   // 1462.4 place that piece
  gone(gh, qs);
  const O = [[4, 0], [5, 0], [4, 1], [5, 1]].map(([c, r]) => cube(null, NC.O, S, CX(c), RY(r), 0, 4));
  say('猜到最右邊兩欄', '放下去');
  await step(tok);                                   // 1466.9 implement the rules: a full line clears
  const full = [...row0, O[0], O[1]]; full.forEach((m) => glow(m, GREEN));
  await anim(tok, 500, () => {});
  full.forEach((m) => fly(m, V3(0, 9, 4))); move(O[2], CX(4), RY(0)); move(O[3], CX(5), RY(0));
  say('照 Tetris 規則：滿一列就消掉', '規則很好實作');
  await step(tok);                                   // 1474.7 rotate at the last second? guess again
  const gv = ghostBox(NC.NP, 0.95, 3.8, 0.95); gv.position.set(CX(0), RY(4), 0);
  await anim(tok, 600, () => {});
  kill(gv);
  const I = [0, 1, 2, 3].map((c) => cube(null, NC.NP, S, CX(c), RY(0), 0, 5));
  await anim(tok, 700, () => {});
  [...I, O[2], O[3]].forEach((m) => glow(m, GREEN));
  await anim(tok, 400, () => {});
  [...I, O[2], O[3]].forEach((m) => fly(m, V3(0, 9, 4)));
  say('下一個方塊：最後一刻要不要轉？', '也用猜的：橫放在左邊');
  await step(tok);                                   // 1485.0 only polynomially many guesses → still poly time
  note('只猜多項式次 → 仍是多項式時間', -5.0, 4.7);
  say('每個方塊只要猜幾個選擇', '總共多項式次 → 還是多項式時間');
  await step(tok);                                   // 1494.0 at the end: did I survive?
  top.material.color.set('#c0392b');
  bub('最後檢查：有沒有活下來？', 0, 6.7);
  say('最後判斷：活下來了嗎？');
  await step(tok);                                   // 1507.0 easy: did I ever go above the top row?
  tb.set('YES'); tb.mood('happy');
  good('沒超過頂端 → YES', 0, 3.2);
  say('只要看有沒有超過頂端', '很好算');
  await step(tok);                                   // 1511.0 any way to survive → guesses find it → Tetris ∈ NP
  good('Tetris ∈ NP', -5.2, 1.8);
  say('只要有活法，猜測就會找到', '所以 Tetris ∈ NP');
  await step(tok);                                   // 1524.6 if instead "did I die?" — is there any way to die?
  bub('改問「會死嗎？」→ 幾乎一定找得到死法', 0, 5.5);
  tb.set('?'); tb.mood('wow');
  say('如果改問「會不會死」', 'lucky 會去找「有沒有死法」');
  await step(tok);                                   // 1535.8 important to set up yes vs no correctly
  note('YES / NO 的方向要設對', -5.0, 4.0);
  say('YES 跟 NO 的方向很重要');
  await step(tok);                                   // 1542.8 "can I die" should not be in NP — but we don't know
  bad('「會死嗎」應該不在 NP（沒人知道）', 0, 4.5);
  say('「能活嗎」在 NP', '「會死嗎」應該不在 NP，但沒人確定');
}]);

// 26:53 NP 定義二：YES 時有證明，驗證是多項式時間
FRAG.push(['np2-tetris-check', 'NP：證明可以在多項式時間檢查', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 1613.3 think about algorithms for checking a solution
  const vf = pal('檢查者', '', NC.NP, 4.6, 0.6, 0, 0.8);
  say('NP 的另一種看法', '不想怎麼解，只想怎麼「檢查」');
  await step(tok);                                   // 1627.2 checking your work is easier than solving
  note('檢查答案，通常比自己解容易', 0, 5.6);
  say('檢查作業通常比寫作業簡單');
  await step(tok);                                   // 1646.6 whenever the answer is yes: a proof, checked in poly time
  const pf = prop('file', 0, 2.0, 0, 1, 'YES 的證明');
  note('答案是 YES → 寫得出證明，多項式時間檢查得完', 0, 4.8);
  say('答案是 YES 時，能寫出證明', '而且證明能在多項式時間檢查');
  await step(tok);                                   // 1688.0 a two-player game
  kill(pf);
  const pv = pal('玩家（我）', '', NC.O, -4.6, 0.6, 0, 0.8); pv.mood('happy');
  bub('兩人遊戲：一個想說服、一個要被說服', 0, 3.9);
  say('想成兩個人的遊戲', '我很會玩 Tetris，你要被我說服');
  await step(tok);                                   // 1712.0 an email on my door: "I am NP-complete"
  const em = bub('“I am NP-complete”', -4.6, 2.6);
  say('老師門上貼著一封信', '寫著：I am NP-complete');
  await step(tok);                                   // 1733.0 a meaningless statement
  const bx = bad('這句話沒有意義', -4.6, 3.3);
  pv.mood('wow');
  say('這句話其實沒有意義', '等下學了 NP-complete 會更好笑');
  await step(tok);                                   // 1758.0 what he meant to say: I am lucky
  kill(bx); txt(em, '“I am lucky”'); pv.mood('happy');
  say('他真正想說的是：I am lucky', '那要怎麼證明？');
  await step(tok);                                   // 1773.0 a hard Tetris level — "yes I can survive"
  bub('這關活得下來嗎？', 4.6, 2.6);
  txt(em, 'YES，我活得下來！');
  say('給他一關很難的 Tetris', '他說：YES，我活得下來');
  await step(tok);                                   // 1781.3 he just plays it: proof = sequence of moves
  const mv = ['O → 第 4 欄', 'I → 第 0 欄', '……'].map((t, i) => cube(t, NC.S, [1.7, 0.5, 0.7], -4.6, 4.2 + i * 0.6, 0, 2));
  say('怎麼證明？直接玩給你看', '證明 = 一串移動');
  await step(tok);                                   // 1793.4 easy to convince: show the sequence
  await Promise.all(mv.map((m, i) => travel(tok, m, m.position.clone(), V3(1.4, 5.2 - i * 0.6, 0), 1000)));
  say('把每一步移動交給檢查者', '很容易說服人');
  await step(tok);                                   // 1803.5 I, a mere poly-time algorithm, implement the rules and check
  const c = code(['for move in proof:', '  照規則掉落、消行', '  if 超過頂端: NO', 'return YES'], 4.0, 5.4, 0.5);
  for (let i = 0; i < 4; i++) { c.hl(i); await anim(tok, 350, () => {}); }
  vf.mood('happy'); vf.set('✓');
  say('檢查者照 Tetris 規則跑一遍', '多項式時間就確認了');
  await step(tok);                                   // 1812.0 rules easy to implement; knowing what to do is hard
  note('規則好寫；難的是知道怎麼走', 0, 1.2);
  say('規則很好寫', '難的是「知道該怎麼走」');
  await step(tok);                                   // 1829.0 proving can take arbitrary time; check must be poly
  note('找證明：花多久都行｜檢查：要多項式時間', 0, 0.4);
  say('找證明可以花任意久', '只有「檢查」必須是多項式時間');
}]);

// 30:46 P ⊆ NP，P = NP？
FRAG.push(['np2-p-vs-np', 'P ⊆ NP，P = NP 嗎？', async (tok) => {
  fresh([0, 4.0, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 1846.2 if you can solve it, you can check it: solve and compare
  const pb = pal('P 的問題', '', NC.P, -4.4, 0.6, 0, 0.7); pb.mood('happy');
  bub('自己解一遍，對答案就好', -4.4, 2.4);
  say('能解就能檢查', '自己解一次，看答案一不一樣');
  await step(tok);                                   // 1855.9 so P is inside NP
  const a = ghostBox(NC.NP, 4.6, 3.2, 0.3); a.position.set(-3.6, 4.4, -0.2);
  const a2 = ghostBox(NC.P, 2.0, 1.6, 0.34); a2.position.set(-4.4, 4.2, -0.1);
  tag('NP', 'ptr', -2.0, 5.6); tag('P', 'ptr', -4.4, 4.2);
  say('所以 P ⊆ NP');
  await step(tok);                                   // 1857.9 the big question: P = NP?
  const q = tag('P = NP ？', 'ptr alt', 1.8, 5.8);
  say('大問題：P = NP 嗎？');
  await step(tok);                                   // 1864.7 most people think no
  note('大多數人認為：P ≠ NP', 1.8, 5.1);
  say('大多數人相信 P ≠ NP');
  await step(tok);                                   // 1874.2 a Millennium Prize problem: one million dollars
  const money = prop('parcel', 4.8, 3.6, 0, 0.9, '$1,000,000'); bob(money, 0.06);
  say('Millennium Prize 問題', '證出來有一百萬美元');
  await step(tok);                                   // 1912.9 P ≠ NP: problems in NP but not in P
  const t = card('NP − P', NC.BAD, -2.4, 4.6, 1.2, 2);
  say('P ≠ NP 的意思', '有問題在 NP 裡，卻不在 P 裡');
  await step(tok);                                   // 1922.2 P: a real computer; NP: a magical fairy computer
  const cpu = prop('cpu', -0.4, 0.6, 0, 0.9, '真的電腦 = P');
  const fairy = pal('魔法電腦 = NP', '✨', NC.O, 2.6, 0.6, 0, 0.7); fairy.mood('happy');
  say('P：真的電腦能解', 'NP：每次都猜對的魔法電腦');
  await step(tok);                                   // 1951.8 obviously more powerful — except we can't prove it
  note('直覺上 NP 更強，但沒人證得出來', 1.2, 2.6);
  say('魔法電腦顯然比較強', '可是沒人證得出來');
  await step(tok);                                   // 1970.2 "you can't engineer luck"
  bub('You can’t engineer luck：運氣造不出來', 1.2, 3.3);
  say('老師的說法一', 'P ≠ NP ⇔ 運氣造不出來');
  await step(tok);                                   // 1993.3 solving problems is harder than checking solutions
  gone(cpu, fairy);
  bad('解題：產生證明（難）', -1.0, 1.0);
  good('檢查：核對證明（易）', 3.6, 1.0);
  say('說法二：解題比檢查難', '產生證明可能比檢查證明難');
  await step(tok);                                   // 2024.7 harder to generate a proof of a theorem than check it
  note('證定理很難；檢查證明只要一步步核對', 1.2, 0.2);
  say('證明定理很難', '檢查證明只要逐步核對');
  await step(tok);                                   // 2040.1 you need inspiration = luck = guessing
  glow(t, RED);
  tag('靈感 = 運氣 = 猜', 'ptr alt', 1.2, 1.9);
  say('證明需要靈感', '靈感 = 運氣 = 猜');
}]);

// 34:57 NP-hard、NP-complete：Tetris 落在 NP 刻度上
FRAG.push(['np2-hard-complete', 'NP-hard 與 NP-complete：Tetris 的位置', async (tok) => {
  AX_CAM();
  const ns = npAxis(['P', 'NP', 'EXP', 'R']); npBand('P', 0.45); npBand('NP', 0.95);
  const MID = (NX.P + NX.NP) / 2;
  await step(tok);                                   // 2096.8 pretty sure Tetris is in NP − P
  const tt = card('Tetris', NC.NP, MID, 2.4, 1.3, 3);
  tag('NP − P ？', 'ptr alt', MID, 3.3);
  say('很相信：Tetris 在 NP − P', '在 NP 裡、不在 P 裡');
  await step(tok);                                   // 2110.7 we don't know: could be the empty set
  note('但 NP − P 也可能是空的', MID, 4.0);
  say('但我們不確定', 'NP − P 可能根本是空集合');
  await step(tok);                                   // 2120.0 if anything is in NP − P, Tetris is one of them
  glow(tt, GOLD);
  good('只要 NP − P 有東西，Tetris 一定在裡面', -0.6, 4.7);
  say('已經知道的是', '只要 NP − P 非空，Tetris 就在裡面');
  await step(tok);                                   // 2140.0 hardest in NP; lots of problems at that notch
  ['3-Partition', 'SAT', '……'].forEach((t, i) => card(t, NC.N, 0.6 + i * 1.6, 2.4, 1.4, 2));
  say('Tetris 是 NP 裡最難的之一', '這個刻度上還有很多問題');
  await step(tok);                                   // 2159.0 if you believe P ≠ NP: Tetris is not in P
  note('相信 P ≠ NP → Tetris ∉ P', 3.6, 3.3);
  say('只要相信 P ≠ NP', '就能證明 Tetris 不在 P');
  await step(tok);                                   // 2195.8 because Tetris is NP-hard
  const hd = tag('NP-hard', 'ptr', MID, 1.7);
  say('為什麼？因為 Tetris 是 NP-hard');
  await step(tok);                                   // 2208.0 as hard as every problem in NP (non-strict) → far right
  await slide(tok, tt, NX.NP, 2.4, 0, 900);
  hd.position.x = NX.NP;
  note('NP-hard：至少和 NP 每個問題一樣難（≥，不是 >）', -2.4, 5.4);
  say('NP-hard：至少和 NP 每個問題一樣難', '所以畫在 NP 的最右端');
  await step(tok);                                   // 2243.0 either P = NP: picture like this
  await anim(tok, 1200, (t) => { ns.P.l.position.x = (NX.NP - NX.P) * t; ns.P.t.position.x = NX.P + (NX.NP - NX.P) * t; });
  note('情況一 P = NP：Tetris 也在 P（不有趣）', -3.2, 6.1);
  say('情況一：P = NP', 'Tetris 還在最右端，也在 P 裡');
  await step(tok);                                   // 2255.2 or NP strictly bigger: Tetris is outside P
  await anim(tok, 1200, (t) => { ns.P.l.position.x = (NX.NP - NX.P) * (1 - t); ns.P.t.position.x = NX.NP - (NX.NP - NX.P) * t; });
  glow(tt, RED);
  bad('情況二 P ≠ NP：最右端在 P 外 → Tetris ∉ P', 2.6, 6.1);
  say('情況二：NP 比 P 大', '最右端在 P 外 → Tetris ∉ P');
  await step(tok);                                   // 2278.6 Tetris is NP-complete: NP-hard and in NP
  glow(tt, GOLD);
  tag('NP-complete = NP ∩ NP-hard', 'ptr alt', NX.NP, 3.2);
  say('Tetris 是 NP-complete', '= NP-hard，而且在 NP 裡');
  await step(tok);                                   // 2318.4 NP-hard: everything from here to the right
  hardBand(NX.NP, 1.5, 'NP-hard →');
  say('NP-hard：從這個刻度往右全部', '可能剛好在線上，也可能更右');
  await step(tok);                                   // 2332.1 Tetris is in NP too → both ranges → right here
  tag('▼ 兩段重疊：剛好在這裡', 'ptr', NX.NP, 0.2 + 1.8);
  say('Tetris 也在 NP 裡', '兩段的交集 → 剛好在刻度上');
  await step(tok);                                   // 2343.4 completeness tells you exactly where it falls
  note('X-complete：知道它在軸上的確切位置', 2.8, 2.6);
  say('complete 的好處', '知道它在難度軸上的確切位置');
}]);

// 39:13 EXP-complete：chess
FRAG.push(['np2-exp-chess', 'Chess 是 EXP-complete', async (tok) => {
  AX_CAM();
  npAxis(['P', 'NP', 'EXP', 'R']); npBand('P', 0.45); npBand('NP', 0.95);
  await step(tok);                                   // 2353.1 NP-complete here; EXP-complete here
  tag('NP-complete', 'ptr alt', NX.NP, 2.0);
  tag('EXP-complete', 'ptr alt', NX.EXP, 2.0);
  say('NP-complete 在 NP 刻度上', 'EXP-complete 在 EXP 刻度上');
  await step(tok);                                   // 2358.2 chess is EXP-complete
  const ch = card('Chess', NC.EXP, NX.EXP, 2.8, 1.2, 3);
  say('chess 是 EXP-complete');
  await step(tok);                                   // 2361.3 EXP-hard: from here over
  hardBand(NX.EXP, 1.95, 'EXP-hard →');
  say('EXP-hard：從 EXP 刻度往右', '至少和 EXP 每個問題一樣難');
  await step(tok);                                   // 2367.4 EXP: everything from here over this way
  npBand('EXP', 1.45);
  say('EXP：從刻度往左全部', 'chess 剛好在兩段的交界');
  await step(tok);                                   // 2373.7 the only way we know to prove it's not in P
  note('這是證明 chess ∉ P 唯一知道的方法', -2.6, 4.4);
  say('它是 EXP 裡最難的', '這也是證明它不在 P 的唯一方法');
  await step(tok);                                   // 2378.1 easy to show EXP is bigger than P
  tag('P ≠ EXP（已證明）', 'ptr', (NX.P + NX.EXP) / 2 - 0.6, 3.4);
  say('P ≠ EXP 很容易證明');
  await step(tok);                                   // 2380.7 chess is farthest right in EXP → not in P
  glow(ch, RED);
  bad('chess ∉ P', NX.EXP, 3.7);
  say('chess 在 EXP 最右端', '→ chess 不在 P');
  await step(tok);                                   // 2398.4 does NP = EXP? also open
  tag('NP = EXP ？', 'ptr alt', (NX.NP + NX.EXP) / 2, 5.2);
  say('NP = EXP 嗎？也不知道', '沒有獎金，但一樣是大問題');
}]);

// 40:35 Reduction：把 A 轉成會解的 B；無權重最短路徑
FRAG.push(['np2-reduce', 'Reduction：把問題 A 轉成會解的 B', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 2435.6 the last thing: reductions
  tag('Reduction（歸約）', 'ptr alt', 0, 6.2);
  say('最後一個主題：reduction');
  await step(tok);                                   // 2443.5 how to prove it? what does "as hard as" mean?
  bub('「一樣難」到底是什麼意思？', 0, 5.4);
  say('「至少一樣難」要怎麼定義？', '其實是學過的東西');
  await step(tok);                                   // 2478.3 a design technique we've used implicitly: graph reduction
  note('其實一直在用：graph reduction', 0, 4.7);
  say('reduction 本來是設計演算法的技巧', 'recitation 講過 graph reduction');
  await step(tok);                                   // 2489.7 convert to a graph problem, call the graph algorithm
  const A = card('你的問題', NC.O, -4.6, 3.6, 2.2, 3), B = card('圖的問題', NC.P, 0.4, 3.6, 2.2, 3), S = card('圖演算法', NC.NP, 4.8, 3.6, 1.9, 3);
  arrow(V3(-3.4, 3.6, 0), V3(-0.8, 3.6, 0)); arrow(V3(1.6, 3.6, 0), V3(3.8, 3.6, 0));
  say('把問題轉成圖的問題', '呼叫圖演算法就做完了');
  await step(tok);                                   // 2497.4 problem A → problem B you already know how to solve
  relabel(A, '問題 A'); relabel(B, '會解的 B'); relabel(S, 'B 的演算法');
  const f = tag('轉換', 'ptr alt', -2.1, 4.3);
  say('一般說法：要解 A', '把 A 轉成已經會解的 B');
  await step(tok);                                   // 2510.0 new problem at your job: first ask, can I convert it?
  const me = pal('你', '', NC.O, -5.4, 0.6, 0, 0.6); me.mood('wow');
  bub('遇到新問題：能轉成我會的嗎？', -2.8, 2.0);
  say('遇到不會的問題', '第一步：能不能轉成我會解的？');
  await step(tok);                                   // 2522.5 maybe not the best way, but a way (likely poly)
  me.mood('happy');
  note('不一定最好，但至少能解（多半是多項式）', 1.8, 1.3);
  say('不一定最好', '但至少有一個解法');
  await step(tok);                                   // 2572.3 unweighted shortest paths: BFS
  gone(me); fresh([0, 4.2, 12.5], [0, 2.4, 0]);
  const G = miniG({ s: [-3.6, 2.0], a: [-1.4, 3.6], b: [-1.4, 0.4], t: [0.8, 2.0] }, [['s', 'a', null], ['s', 'b', null], ['a', 't', null], ['b', 't', null], ['a', 'b', null]], NC.N, 0.55);
  const W = [[-2.5, 3.0], [-2.5, 1.0], [-0.3, 3.0], [-0.3, 1.0], [-1.0, 2.0]].map(([x, y]) => note('', x, y));
  W.forEach((w) => { w.visible = false; });
  tag('無權重最短路徑：s → t', 'ptr', -1.4, 4.6);
  good('BFS：線性時間', -1.4, -0.5);
  say('無權重最短路徑怎麼解？', 'BFS，線性時間');
  await step(tok);                                   // 2591.0 suppose someone gave you Dijkstra code
  const dj = prop('file', 4.2, 2.0, 0, 1.1, 'Dijkstra 程式碼'); bob(dj, 0.05);
  say('假設手上只有 Dijkstra 的程式碼', '什麼都不用寫');
  await step(tok);                                   // 2598.7 Dijkstra needs weights; I have none
  bub('Dijkstra 要權重……可是沒有權重', 4.2, 4.6);
  say('Dijkstra 解的是有權重的', '可是這張圖沒有權重');
  await step(tok);                                   // 2603.9 set the weights to one
  W.forEach((w) => { w.visible = true; txt(w, '1'); });
  good('每條邊權重設 1 → 交給 Dijkstra', 2.0, 0.2);
  say('把權重都設成 1', '這就是一個 reduction');
  await step(tok);                                   // 2623.8 weights of 0 would not work
  W.forEach((w) => txt(w, '0'));
  Object.values(G.N).forEach((m) => glow(m, RED));
  bad('設 0：每條路都是 0，分不出長短', 2.0, -0.5);
  say('權重設 0 不行', '每條路長度都變 0');
  await step(tok);                                   // 2627.6 weights of 2 also work — be consistent
  W.forEach((w) => txt(w, '2'));
  Object.values(G.N).forEach((m) => glow(m, GREEN));
  good('設 2 也可以：只要全部一樣', 2.0, -1.2);
  say('設 2 也可以', '只要每條邊都一樣');
}]);

// 43:53 更多 reduction：取 log、取負號、複製圖、漏油油箱
FRAG.push(['np2-reduce-more', '更多 reduction：log、取負號、改圖', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.4, 0]);
  const A = card('', NC.O, -4.6, 5.0, 2.6, 0), B = card('', NC.P, 0.6, 5.0, 2.6, 0), S = card('', NC.NP, 4.9, 5.0, 2.0, 0);
  arrow(V3(-3.2, 5.0, 0), V3(-0.8, 5.0, 0)); arrow(V3(2.0, 5.0, 0), V3(3.8, 5.0, 0));
  const f = tag('', 'ptr alt', -2.0, 5.7);
  const set = (a, t, b, s) => { relabel(A, a); txt(f, t); relabel(B, b); relabel(S, s); };
  const path = (ws) => {
    const xs = [-4.8, -2.4, 0, 2.4, 4.8], ms = xs.map((x) => cube(null, NC.N, [0.45, 0.45, 0.45], x, 2.2, 0));
    const ls = xs.slice(1).map((x, i) => line(xs[i], 2.2, x, 2.2, 0, '#8a7a5c'));
    const W = ws.map((w, i) => note(String(w), (xs[i] + xs[i + 1]) / 2, 2.6));
    return { W, kill() { gone(ms, ls, W); } };
  };
  await step(tok);                                   // 2633.2 more interesting ones: problem set 6 ("I can has more friends")
  set('Pset 6：交朋友', '', '?', '?');
  say('更有趣的例子', 'Pset 6 的交朋友問題');
  await step(tok);                                   // 2648.9 find paths minimizing the product of weights
  set('最小化權重的乘積', '', '?', '?');
  let P = path([2, 4, 0.5, 8]);
  note('示意：路徑權重 2 × 4 × 0.5 × 8', 0, 1.3);
  say('要找「權重乘積」最小的路徑');
  await step(tok);                                   // 2657.7 in class we only covered the sum of weights
  bub('上課只教過「權重的和」……', 0, 3.6);
  say('可是上課只教過', '權重「加起來」最小');
  await step(tok);                                   // 2664.6 logs: they convert products into sums
  P.W.forEach((w, i) => txt(w, 'log ' + [2, 4, 0.5, 8][i]));
  set('最小化權重的乘積', '每個權重取 log', '最短路徑（和）', 'Dijkstra');
  good('log(a × b) = log a + log b', 0, 0.6);
  say('一個字：取 log', '乘積就變成和');
  await step(tok);                                   // 2671.8 could change all relaxation steps — more work, reprove
  bad('改 relax 去算乘積：也行，但要重證、難寫', -2.6, 4.2);
  say('也可以改 relax 去算乘積', '但要重新證明，寫起來也麻煩');
  await step(tok);                                   // 2694.3 a reduction reuses exactly the code you had
  glow(S, GREEN);
  good('reduction：原本的程式直接用', 2.6, 4.2);
  say('用 reduction', '原本的程式一行都不用改');
  await step(tok);                                   // 2702.9 the most common design technique: reuse algorithms
  note('最常用的設計技巧：重用學過的演算法', 0, -0.2);
  say('reduction 是最常用的設計技巧', '因為能重用以前的演算法');
  await step(tok);                                   // 2716.5 Quiz 2: longest path → shortest path
  P.kill(); glow(S, null);
  fresh([0, 4.2, 12.5], [0, 2.4, 0]);
  const A2 = card('最長路徑（Quiz 2）', NC.O, -4.6, 5.0, 2.6, 0), B2 = card('?', NC.P, 0.6, 5.0, 2.6, 0), S2 = card('?', NC.NP, 4.9, 5.0, 2.0, 0);
  arrow(V3(-3.2, 5.0, 0), V3(-0.8, 5.0, 0)); arrow(V3(2.0, 5.0, 0), V3(3.8, 5.0, 0));
  const f2 = tag('', 'ptr alt', -2.0, 5.7);
  P = path([3, 5, 2, 4]);
  note('示意的權重', 0, 1.3);
  say('Quiz 2 的是非題', '能用 Bellman-Ford 求最長路徑嗎？');
  await step(tok);                                   // 2730.7 yes: negate all the weights
  P.W.forEach((w, i) => txt(w, String(-[3, 5, 2, 4][i])));
  txt(f2, '權重全部取負號'); relabel(B2, '最短路徑'); relabel(S2, 'Bellman-Ford');
  say('可以：把權重全部取負號', '最長路徑就變成最短路徑');
  await step(tok);                                   // 2746.4 visiting sites in order → graph replication → one query
  P.kill();
  relabel(A2, '依序拜訪景點'); txt(f2, '把圖複製成好幾層'); relabel(B2, '一次最短路徑'); relabel(S2, 'Dijkstra');
  for (let k = 0; k < 3; k++) {
    const g = ghostBox(NC.NP, 7.0, 0.9, 0.3); g.position.set(0, 3.3 - k * 1.1, -0.2);
    tag('第 ' + (k + 1) + ' 層', 'idx', -4.0, 3.3 - k * 1.1);
    if (k) arrow(V3(1.0 + k, 3.3 - (k - 1) * 1.1, 0), V3(1.0 + k, 3.3 - k * 1.1 + 0.3, 0));
  }
  say('依指定順序拜訪景點', '把圖複製成多層 → 一次最短路徑查詢');
  await step(tok);                                   // 2769.8 leaky tank: change the graph a little
  relabel(A2, '漏油的油箱'); txt(f2, '油量放進圖的狀態'); relabel(B2, '最短路徑');
  prop('disk', 5.4, 0.4, 0, 0.8, '油箱');
  say('漏油油箱問題', '把油量放進頂點，改一下圖就好');
  await step(tok);                                   // 2780.8 we see it mostly in graph reductions; applies everywhere
  note('本課多是 graph reduction，但到處都能用', 0, -0.4);
  say('這門課多半是 graph reduction', '其實到處都用得上');
}]);

// 46:26 3-Partition → Tetris：B 至少和 A 一樣難
FRAG.push(['np2-3partition', '3-Partition → Tetris：證明 Tetris 很難', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.4, 0]);
  await step(tok);                                   // 2786.3 reductions also prove things like Tetris is NP-hard
  const tb = pal('Tetris', '', NC.NP, 4.6, 0.3, 0, 0.7); tb.mood('wow');
  bub('reduction 也能證明「很難」', 4.6, 2.0);
  say('reduction 不只能設計演算法', '也能證明 Tetris 是 NP-hard');
  await step(tok);                                   // 2798.1 we proved 3-Partition reduces to Tetris
  const pa = pal('3-Partition', '', NC.O, -4.6, 0.3, 0, 0.7);
  arrow(V3(-3.6, 0.8, 0), V3(3.6, 0.8, 0)); tag('reduce', 'ptr alt', 0, 1.3);
  say('老師的團隊證明了', '3-Partition 可以歸約到 Tetris');
  await step(tok);                                   // 2817.8 3-Partition: n numbers → triples with equal sums
  const nums = [2, 3, 7, 4, 4, 4, 1, 5, 6], X = (i) => -5.2 + i * 1.3;
  const cs = nums.map((v, i) => cube(v, NC.S, [0.8, 0.8, 0.8], X(i), 5.2, 0, 3));
  note('自建例子：9 個數，總和 36', 0, 6.1);
  say('3-Partition：給 n 個數', '能不能分成三個三個、每組和相等？');
  await step(tok);                                   // 2826.2 n/3 groups of three, each sum equal
  const groups = [[0, 1, 2], [3, 4, 5], [6, 7, 8]], col = [NC.P, NC.NP, NC.O];
  for (let g = 0; g < 3; g++) {
    groups[g].forEach((i, k) => { tint(cs[i], col[g]); move(cs[i], -4.2 + g * 4.2 + (k - 1) * 0.95, 3.8); });
    tag('= 12', 'ptr', -4.2 + g * 4.2, 3.0);
    await anim(tok, 500, () => {});
  }
  say('分成 n/3 組，每組三個', '這裡每組都 = 12');
  await step(tok);                                   // 2834.1 sounds easy, but NP-complete (Karp)
  tag('NP-complete（Garey & Johnson 1975）', 'ptr', -4.6, 2.2);
  say('聽起來簡單，其實是 NP-complete', '老師說是 Karp，其實是 Garey & Johnson 證的');
  await step(tok);                                   // 2856.7 just show Tetris is harder than 3-Partition
  pa.mood('sad');
  bub('只要證明：Tetris 比 3-Partition 難', 0, 2.2);
  say('站在巨人的肩膀上', '只要證明 Tetris 比它難');
  await step(tok);                                   // 2865.0 A reduces to B → B is at least as hard as A
  tag('A 歸約到 B ⇒ B 至少和 A 一樣難', 'ptr alt', 0, -0.5);
  say('A 能歸約到 B', '⇒ B 至少和 A 一樣難');
  await step(tok);                                   // 2880.6 because I can solve A by solving B
  const tk = pkt('A 的題目', -4.6, 1.8);
  await travel(tok, tk, V3(-4.6, 1.8, 0), V3(4.6, 1.8, 0), 1300);
  txt(tk, '用 B 的解法 → A 也解了');
  say('因為解 B 就能解 A', '先轉換，再用 B 的解法');
  await step(tok);                                   // 2891.0 no good algorithm for 3-Partition → Tetris better not be in P
  tb.mood('sad');
  bad('若 Tetris ∈ P，3-Partition 也 ∈ P', 2.6, 2.7);
  say('3-Partition 應該很難', '所以 Tetris 最好也不在 P');
  await step(tok);                                   // 2910.7 all NP-complete problems reduce to each other
  note('所有 NP-complete 問題都能互相歸約', 0, -1.2);
  say('所有 NP-complete 問題', '都能互相歸約');
  await step(tok);                                   // 2916.1 to show NP-complete: reduce a known NPC problem to yours
  glow(pa.body, RED);
  good('方向：已知很難的 → 你的問題', -3.0, -1.9);
  say('要證 NP-complete', '拿已知的 NPC 問題歸約到你的問題');
  await step(tok);                                   // 2926.8 reductions: new algorithms and negative results
  note('reduction：設計演算法，也能證明「很難」', 2.6, -1.9);
  say('reduction 兩用', '正面：新演算法；反面：證明很難');
}]);

// 49:15 更多 NP-complete 問題
FRAG.push(['np2-npc-zoo', '更多 NP-complete 問題', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.6, 0]);
  const pos = (i) => [-4.8 + (i % 4) * 3.2, i < 4 ? 5.2 : 2.6];
  const mk = (i, n, c = NC.BAD) => { const [x, y] = pos(i); return card(n, c, x, y, 2.6, 2); };
  await step(tok);                                   // 2954.8 traveling salesman: shortest route visiting all vertices
  const tsp = mk(0, 'TSP');
  note('走過「所有」頂點的最短路線', pos(0)[0], 4.4);
  say('TSP：旅行推銷員', '找走過所有頂點的最短路線');
  await step(tok);                                   // 2967.8 LCS of n strings
  mk(1, 'n 個字串的 LCS');
  note('2 個字串：DP；n 個：NPC', pos(1)[0], 4.4);
  say('LCS：兩個字串用 DP 就好', 'n 個字串就是 NP-complete');
  await step(tok);                                   // 2976.3 Minesweeper, Sudoku: most interesting puzzles
  mk(2, '踩地雷・數獨');
  say('踩地雷、數獨', '有趣的謎題大多是 NP-complete');
  await step(tok);                                   // 2982.3 SAT: a Boolean formula like x ∨ y ∧ ¬x
  const sat = mk(3, 'SAT', NC.O);
  note('例：x ∨ y ∧ ¬x', pos(3)[0], 4.4);
  say('SAT：給一個布林式', '例如 x ∨ y ∧ ¬x');
  await step(tok);                                   // 2994.7 is there a setting of variables making it true?
  bub('有沒有一組 T/F 讓它為真？', pos(3)[0] - 0.4, 6.3);
  say('有沒有一組變數值', '讓整個式子為真？');
  await step(tok);                                   // 3001.8 the first problem shown NP-complete
  glow(sat, GOLD);
  tag('★ 第一個被證明的 NPC', 'ptr alt', pos(3)[0] - 0.4, 3.7);
  say('SAT 是第一個被證明的 NPC', '歸約總要有個起點');
  await step(tok);                                   // 3022.5 3-coloring a graph
  mk(4, '3-Coloring');
  note('圖能不能用 3 色著色', pos(4)[0], 1.8);
  say('圖的 3 著色');
  await step(tok);                                   // 3024.3 shortest paths in 3D (you can fly)
  mk(5, '3D 最短路徑');
  note('會飛的話：到天花板那點', pos(5)[0], 1.8);
  say('3D 空間的最短路徑', '如果你會飛 → NP-complete');
  await step(tok);                                   // 3041.5 in 2D it is polynomial
  good('2D 平面：多項式', pos(5)[0], 1.1);
  say('2D 平面上是多項式', '還好我們走在地上');
  await step(tok);                                   // 3052.8 knapsack: pseudo-polynomial is the best unless P = NP
  mk(6, 'Knapsack');
  note('只有 pseudo-polynomial；除非 P = NP', pos(6)[0], 1.8);
  say('Knapsack 也是 NP-complete', '除非 P = NP，不會比 pseudo-poly 更好');
  await step(tok);                                   // 3067.9 computational complexity in 50 minutes
  glow(tsp, GOLD);
  tag('P ⊆ NP ⊆ EXP ⊆ R', 'ptr alt', 0, 0.4);
  say('50 分鐘的計算複雜度', 'P ⊆ NP ⊆ EXP ⊆ R');
}]);

// ════════ t5Wxk96QjUk（MIT 6.006 Rec23：Computational Complexity） ════════
// 04:26 EXP 與 P：輸入加倍時的差別
FRAG.push(['np2-doubling', '輸入加倍：多項式乘常數，指數變平方', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  await step(tok);                                   // 266.6 better than R: exponential
  const ex = card('EXP', NC.EXP, -4.6, 6.0, 1.4, 2);
  say('比 R 好一點：EXP', '指數時間');
  await step(tok);                                   // 288.2 T(n) = 2^(n^c); n or n^100 — don't care
  const n1 = note('T(n) = O(2^(n^c))', -1.6, 6.0);
  const n2 = note('已經指數了：前面是 n 還是 n¹⁰⁰ 都沒差', 2.4, 5.3);
  say('EXP：時間是 2 的多項式次方', '已經指數了，n 或 n¹⁰⁰ 都沒差');
  await step(tok);                                   // 304.0 not before the world ends
  const n3 = bub('世界末日前算不完', 3.2, 6.2);
  say('算得出來', '但多半在世界末日之前算不完');
  await step(tok);                                   // 339.2 NP = nondeterministic polynomial (later)
  const n4 = tag('NP = Nondeterministic Polynomial（等等講）', 'ptr', 0, 4.4);
  say('NP 是什麼的縮寫？', 'Nondeterministic Polynomial，等等再講');
  await step(tok);                                   // 364.2 the entire term was polynomial (except knapsack)
  const ks = [['排序', NC.P], ['BFS', NC.P], ['最短路徑', NC.P], ['knapsack', NC.EXP]].map(([t, c], i) => { const b = pal(t, '', c, -4.5 + i * 3.0, 1.6, 0, 0.6); b.mood(c === NC.P ? 'happy' : 'wow'); return b; });
  note('除了 knapsack，整學期都是多項式', 0, 3.4);
  say('這學期講的幾乎都是多項式', '只有 knapsack 例外');
  await step(tok);                                   // 380.0 polynomial: T(n) = O(n^c)
  gone(ks, n1, n2, n3, n4, ex);
  tag('P：T(n) = O(n^c)', 'ptr alt', -2.6, 6.2);
  say('P：T(n) = O(n^c)', '時間是輸入大小的多項式');
  line(-6, 0, 6, 0, 0, NC.K); tag('高度 = log₁₀(步數)（示意）', 'idx', 3.6, 6.6);
  const bar = (v, h, c, x) => cube(v, c, [1.2, h, 0.8], x, h / 2, 0, 0);
  await step(tok);                                   // 399.7 double the input: time becomes 2^c · n^c
  bar('1000', 3.0, NC.P, -4.6); tag('n³, n=10', 'idx', -4.6, -0.5);
  await anim(tok, 500, () => {});
  bar('8000', 3.9, NC.P, -2.6); tag('n³, n=20', 'idx', -2.6, -0.5);
  say('輸入加倍：時間變 2^c · n^c', '例：n³，n 從 10 → 20');
  await step(tok);                                   // 412.0 every doubling: a constant factor
  note('× 2³ = 8：只乘一個常數', -3.6, 4.6);
  say('每次加倍，只乘一個常數', 'n³ 就是 × 8');
  await step(tok);                                   // 420.2 exponential: doubling squares the time
  bar('1024', 3.0, NC.BAD, 2.2); tag('2ⁿ, n=10', 'idx', 2.2, -0.5);
  await anim(tok, 500, () => {});
  const b4 = bar('1048576', 6.0, NC.BAD, 4.4); tag('2ⁿ, n=20', 'idx', 4.4, -0.5);
  glow(b4, RED);
  bad('1024 → 1024²', 2.2, 4.0);
  say('指數：輸入加倍，時間變平方', '2ⁿ：1024 → 1048576');
  await step(tok);                                   // 440.6 that's why we like polynomial problems
  good('所以我們喜歡多項式', -3.6, 5.4);
  say('所以我們喜歡多項式', '多項式問題才是「好解」的');
}]);

// 07:46 NP：有多項式時間的 verifier
FRAG.push(['np2-verifier', 'NP：多項式時間的 verifier', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.2, 0]);
  await step(tok);                                   // 466.1 NP means we can write a verifier
  const V = pal('Verifier', '', NC.NP, 0.4, 0.8, 0, 1.0);
  say('NP 的實用定義', '能寫出一個 verifier（檢查程式）');
  await step(tok);                                   // 476.2 it takes a solution to the problem
  const y = card('解', NC.S, -4.8, 1.2, 1.6, 2);
  arrow(V3(-3.9, 1.2, 0), V3(-0.4, 1.2, 0));
  say('verifier 吃一個「解」');
  await step(tok);                                   // 484.2 and of course the input to the problem
  const x = card('題目輸入', NC.O, -4.8, 2.8, 1.6, 2);
  arrow(V3(-3.9, 2.8, 0), V3(-0.4, 1.8, 0));
  say('當然也要吃題目的輸入');
  await step(tok);                                   // 490.4 tells us: correct or not correct
  const out = good('✓ 對', 4.4, 1.8); bad('✗ 錯', 4.4, 1.0);
  arrow(V3(1.2, 1.3, 0), V3(3.6, 1.4, 0));
  say('輸出：這個解對不對');
  await step(tok);                                   // 493.3 the verifier is in P
  tag('verifier ∈ P', 'ptr alt', 0.4, 2.6);
  say('而且 verifier 是多項式時間', 'verifier ∈ P');
  await step(tok);                                   // 510.5 what's the solution size? just 0 or 1?
  bub('解的大小？只有 0 或 1？', 0.4, 4.4);
  say('問題：解有多大？', '只是 0 或 1 嗎？');
  await step(tok);                                   // 530.9 the solver must output a string that convinces the verifier
  const sv = pal('解題者', '', NC.O, -4.8, 3.9, 0, 0.6); sv.mood('happy');
  note('要交出能說服 verifier 的字串', -2.2, 5.6);
  say('解題的人不能只說答案', '要交出能說服 verifier 的東西');
  await step(tok);                                   // 558.3 e.g. 3SAT: assign variables to make the expression true
  relabel(x, '3SAT 公式');
  say('例：3SAT', '能不能給變數值讓式子為真？');
  await step(tok);                                   // 570.8 if I just say "yes" — that means nothing
  relabel(y, 'YES');
  bad('只說 YES：沒有意義', -4.8, 0.3);
  say('只說「可以」沒有意義', '怎麼讓人相信？');
  await step(tok);                                   // 576.9 give the assignment; verify in polynomial time
  relabel(y, 'x1=1 x2=0 …');
  await slide(tok, y, -1.2, 1.2, 0, 800);
  V.mood('happy'); V.set('✓');
  say('交出變數的賦值', 'verifier 代進去，多項式時間檢查');
  await step(tok);                                   // 586.3 the input to the verifier is not just a yes/no bit
  note('verifier 吃的不是一個 YES/NO bit，而是一份解', 0.4, -0.6);
  say('所以 verifier 收到的', '不只是 YES / NO 一個 bit');
  await step(tok);                                   // 612.2 they must be polynomial in size
  note('解的大小也要是多項式', 3.6, 3.4);
  say('解的大小必須是多項式', '不然 verifier 讀都讀不完');
  await step(tok);                                   // 631.1 the solution polynomial in the input size as well
  const sz1 = cube(null, NC.O, [1.2, 0.3, 0.6], 4.4, 4.4, 0), sz2 = cube(null, NC.S, [2.0, 0.3, 0.6], 4.4, 5.0, 0);
  tag('輸入 n', 'idx', 2.8, 4.4); tag('解 ≤ n^c', 'idx', 2.8, 5.0);
  say('輸入大小本來就算在裡面', '解也要是輸入大小的多項式');
  await step(tok);                                   // 650.1 for decision problems, call it a proof
  relabel(y, 'proof');
  tag('這份解 = proof（證明）', 'ptr alt', -1.2, 2.0);
  say('對決策問題', '這份解更嚴謹地叫 proof');
}]);

// 11:04 nondeterministic = 丟硬幣永遠丟對
FRAG.push(['np2-coin-proof', '丟硬幣產生 proof：永遠丟對的機器', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.0, 0]);
  const V = pal('Verifier', '', NC.NP, 4.6, 0.8, 0, 0.9);
  const X = (i) => -5.2 + i * 1.0;
  await step(tok);                                   // 664.5 proof is polynomial in size → if I'm really lucky…
  const tag6 = note('proof 長度：多項式', -2.7, 3.0);
  say('proof 只有多項式長', '如果我運氣超好……');
  await step(tok);                                   // 673.8 flip coins and use the results as bits to make a proof
  const cs = ['1', '0', '0', '1', '1', '0'].map((b, i) => cube(b, NC.S, [0.75, 0.75, 0.75], X(i), 1.6, 0, 3));
  await anim(tok, 400, () => {});
  V.mood('sad');
  bad('verifier：不對', 4.6, 2.6);
  say('丟硬幣，一次丟出一個 bit', '拼成一份 proof');
  await step(tok);                                   // 682.1 if really lucky I'll get the right proof
  ['1', '1', '0', '1', '0', '1'].forEach((b, i) => relabel(cs[i], b));
  cs.forEach((m) => glow(m, GREEN));
  say('運氣超好的話', '剛好丟出正確的 proof');
  await step(tok);                                   // 686.9 chances of that: almost zero
  note('真的丟中的機率：幾乎是 0', -2.7, 3.7);
  say('實際上機率幾乎是 0');
  await step(tok);                                   // 693.1 this is what nondeterministic polynomial means
  tag('Nondeterministic Polynomial', 'ptr alt', 0, 5.0);
  say('這就是 Nondeterministic Polynomial');
  await step(tok);                                   // 697.4 a magical machine whose coin is always lucky: proof in poly time
  const m = pal('魔法機器', '🪙', NC.O, -2.4, 3.6, 0, 0.6); m.mood('happy');
  V.mood('happy'); V.set('✓');
  good('丟硬幣永遠丟對 → 多項式時間產生 proof', 0.8, 0.2);
  say('魔法機器：硬幣永遠丟對', '多項式時間就產生 proof');
}]);

// 11:55 P vs NP 未解；常識論證：RSA 的金鑰（61 × 53 = 3233 是補充的小例子）
FRAG.push(['np2-rsa-key', 'RSA：公開 N = p × q，p、q 是祕密', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.0, 0]);
  await step(tok);                                   // 715.1 use it to build a common-sense proof that P ≠ NP
  tag('常識論證：P ≠ NP', 'ptr alt', 0, 6.0);
  say('用這個模型做一個常識論證', '為什麼大家相信 P ≠ NP');
  await step(tok);                                   // 728.5 no rigorous proof either way — $1 million
  note('P = NP？P ≠ NP？都沒有數學證明（一百萬美元）', 0, 5.3);
  say('P = NP 還是 P ≠ NP', '都沒人證得出來');
  await step(tok);                                   // 766.6 solve NP problems in poly time → make a lot of money
  const money = prop('parcel', 5.2, 3.6, 0, 0.8, '賺翻'); bob(money, 0.05);
  say('能快速解 NP 問題的人', '能賺的遠超過一百萬');
  await step(tok);                                   // 794.8 suppose you want to impersonate a bank
  const b1 = prop('warehouse', -4.8, 0, 0, 0.8, '銀行 A'), b2 = prop('warehouse', 4.8, 0, 0, 0.8, '銀行 B');
  const bad1 = pal('壞人', '', '#8a8f9a', 0, 0.2, 1.4, 0.6); bad1.mood('wow');
  say('假設你想冒充一家銀行', '（壞事，只是舉例）');
  await step(tok);                                   // 808.0 transfers happen over the internet, secure connection
  const tx = pkt('轉帳 10 億', -3.8, 1.6);
  await travel(tok, tx, V3(-3.8, 1.6, 0), V3(3.8, 1.6, 0), 1200);
  say('銀行之間用網路轉帳', '連線是加密的');
  await step(tok);                                   // 839.8 encryption algorithm: RSA
  const lk = prop('lock', 0, 1.6, 0, 1.2); bob(lk, 0.05);
  tag('RSA 加密', 'ptr', 0, 2.8);
  say('加密用的是 RSA');
  await step(tok);                                   // 850.3 secret key: two big n-bit primes p, q
  const p = cube('p = 61', NC.O, [1.3, 0.6, 0.8], -5.4, 3.4, 0, 2), q = cube('q = 53', NC.O, [1.3, 0.6, 0.8], -3.9, 3.4, 0, 2);
  note('私鑰（祕密）：兩個大質數，這裡用小數字示意', -4.6, 4.4);
  say('每家銀行的私鑰', '兩個 n bits 的大質數 p、q');
  await step(tok);                                   // 868.3 public key N = p × q, announced to the world
  const N = cube('N = 3233', NC.P, [1.8, 0.7, 0.9], 2.6, 4.6, 0, 2);
  arrow(V3(-3.1, 3.6, 0), V3(1.6, 4.5, 0)); tag('p × q', 'ptr', -0.6, 4.6);
  say('公開金鑰：N = p × q', '全世界都看得到');
  await step(tok);                                   // 886.3 announce it so others can encrypt for you
  const m2 = pkt('用 N 加密的訊息', 3.8, 5.6);
  await travel(tok, m2, V3(3.8, 5.6, 0), V3(-3.8, 5.6, 0), 1000);
  say('公開 N，別人才能加密訊息給你');
  await step(tok);                                   // 899.6 knowing p and q decrypts → pretend you're the bank
  glow(p, GOLD); glow(q, GOLD); bad1.mood('happy');
  bad('偷到 p、q → 能解密 → 冒充銀行', 0, 0.6, 1.4);
  say('知道 p、q 就能解密', '也就能冒充銀行');
}]);

// 15:11 Verifier：N mod p_guess == 0
FRAG.push(['np2-rsa-verify', 'Factoring 的 verifier：N mod p = 0？', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 2.0, 0]);
  const V = pal('N mod p_guess', '', NC.NP, 0.6, 0.6, 0, 1.0);
  await step(tok);                                   // 911.3 a verifier that does long division; input N and a guess
  cube('N = 3233', NC.P, [1.8, 0.7, 0.9], -4.6, 3.2, 0, 2);
  const g = cube('p_guess', NC.S, [1.5, 0.6, 0.8], -4.6, 1.6, 0, 2);
  say('verifier 做長除法', '輸入 N 和猜的 p');
  await step(tok);                                   // 926.4 compute N mod p
  const out = tag('N mod p = ?', 'ptr alt', 0.6, 2.4);
  say('它計算 N mod p', '餘數是多少？');
  await step(tok);                                   // 932.9 if 0: happy — "you're rich"
  relabel(g, 'p = 53');
  await slide(tok, g, -1.6, 1.0, 0, 700);
  txt(out, '3233 mod 53 = 0（示意）');
  V.mood('happy'); V.set('😀');
  good('餘數 0：發大財！', 3.8, 2.6);
  say('餘數是 0', 'verifier 開心：你發財了');
  await step(tok);                                   // 941.0 if not 0: tough luck, try again
  relabel(g, 'p = 47');
  txt(out, '3233 mod 47 = 37');
  V.mood('sad'); V.set('');
  bad('不是 0：再猜一次', 3.8, 1.8);
  say('不是 0', '運氣不好，再猜');
  await step(tok);                                   // 949.0 make the verifier happy → get p → impersonate the bank
  relabel(g, 'p = 53'); txt(out, '3233 = 53 × 61'); V.mood('happy');
  say('讓 verifier 開心，就拿到 p', '公開資訊 → 私密資訊');
  await step(tok);                                   // 963.4 this is called the factoring problem
  tag('factoring（因數分解）', 'ptr', -4.6, 4.4);
  say('這叫 factoring 問題', '因數分解');
  await step(tok);                                   // 974.4 p, N ~1024 bits: chance 1 / 2^1024
  note('真實 RSA：1024 bits，亂猜中機率 1 / 2¹⁰²⁴', 0.6, 4.8);
  say('真實的 p、N 大約 1024 bits', '丟硬幣猜中：1 / 2¹⁰²⁴');
  await step(tok);                                   // 1004.5 an algorithm producing happy inputs → rich; economy in trouble
  prop('warehouse', 5.0, 0, 0, 0.7, '銀行');
  bad('全世界金融系統大亂', 5.0, 2.6);
  say('如果有演算法能產生讓它開心的輸入', '就能冒充銀行，經濟大亂');
  await step(tok);                                   // 1042.6 the economic system still functions → nobody did it
  good('金融系統還在運作 → 沒人做到', -2.6, 5.6);
  say('可是金融系統還好好的', '所以沒人做得到');
  await step(tok);                                   // 1059.6 assumes regular Turing machines; quantum breaks it
  note('假設一般 Turing machine；夠大的量子電腦會破解 RSA', 0.6, -0.6);
  say('這裡假設一般的電腦', '量子電腦是另一回事');
  await step(tok);                                   // 1082.8 e-commerce works → nobody solves NP in poly time
  tag('沒人能多項式時間解 NP 問題（常識，非證明）', 'ptr alt', 0, 6.4);
  say('電子商務還能運作', '→ 沒人能多項式時間解 NP 問題');
}]);

// 18:13 factoring 不是最難的；NP-complete = NP 裡最難、彼此可歸約
FRAG.push(['np2-npc-hub', 'NP-complete：最難的 NP 問題互相歸約', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.2, 0]);
  const np = ghostBox(NC.NP, 12.4, 4.4, 0.3); np.position.set(0, 2.2, -0.4); tag('NP', 'ptr', -5.8, 4.2);
  const pp = ghostBox(NC.P, 3.0, 3.4, 0.34); pp.position.set(-4.4, 2.0, -0.3); tag('P', 'ptr', -4.4, 3.4);
  await step(tok);                                   // 1093.5 factoring is not the hardest NP problem; it's here
  const fx = card('Factoring', NC.O, -1.4, 2.2, 1.6, 3);
  say('Factoring 在這裡', '不是最難的那一種 NP 問題');
  await step(tok);                                   // 1119.3 (correction) factoring IS in NP, just not the hardest
  note('更正：factoring 在 NP，只是不是最難的', -1.4, 3.1);
  say('（老師口誤更正）', 'factoring 在 NP，只是不是最難的');
  await step(tok);                                   // 1125.4 a common-sense proof, not a math proof
  note('剛才是常識論證，不是數學證明', -1.4, 5.0);
  say('剛才是常識論證', '不是數學證明');
  await step(tok);                                   // 1140.7 poly-size solution, poly verifier — why no poly solver?
  const boss = pal('老闆', '?', '#8a8f9a', 5.0, -0.4, 1.2, 0.6); boss.mood('wow');
  bub('能驗證，為什麼寫不出解題程式？', 3.4, 1.3, 1.2);
  say('解是多項式大小，verifier 也快', '那為什麼寫不出快的解題程式？');
  await step(tok);                                   // 1165.4 theory people have thought about it 40+ years
  note('理論學者想了 40 多年', 3.0, 5.0);
  say('理論學者已經想了 40 多年');
  await step(tok);                                   // 1177.1 try to prove it's impossible — fail too
  bad('想不出演算法，也證不出 P ≠ NP', 3.0, 4.4);
  say('想不出解法，就想證明不可能', '可是也證不出來');
  await step(tok);                                   // 1204.3 halting: proven nobody can; here we can't prove it
  note('Halting：證明了沒人能解；這裡：證不出來', 3.0, 5.6);
  say('Halting 能證明「沒人解得了」', 'P vs NP 還證不出來');
  await step(tok);                                   // 1220.3 next best: find the hardest NP problems → NP-complete
  const names = ['3SAT', 'Knapsack', 'Clique', 'TSP', 'Ham-Cycle', '3-Color'];
  const cx = 3.0, cy = 2.2, R = 1.6;
  const at = (i) => [cx + R * Math.cos(i * Math.PI / 3), cy + R * 0.85 * Math.sin(i * Math.PI / 3)];
  const ns = names.map((n, i) => { const [x, y] = at(i); return cube(n, NC.BAD, [1.3, 0.5, 0.6], x, y, 0, 3); });
  tag('NP-complete', 'ptr alt', cx, 3.9);
  say('退而求其次：找出最難的 NP 問題', '叫做 NP-complete');
  await step(tok);                                   // 1248.3 factoring is not one of them — "not with the cool kids"
  glow(fx, null);
  bad('Factoring 不在這群', -1.4, 1.3);
  say('Factoring 不在這群裡', '雖然它能讓你發財');
  await step(tok);                                   // 1258.7 a few hundred, with practical implications
  note('NP-complete 問題有好幾百個，很多很實用', cx, 0.0);
  say('NP-complete 問題有好幾百個', '很多能幫公司省大錢');
  await step(tok);                                   // 1276.3 all interrelated: solve one → solve all (reductions)
  for (let i = 0; i < names.length; i++) {
    const [ax, ay] = at(i), [bx, by] = at((i + 1) % names.length);
    arrow(V3(ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25, 0.4), V3(ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75, 0.4));
    await anim(tok, 200, () => {});
  }
  say('它們全部互相關聯', '透過 reduction：解一個 = 解全部');
  await step(tok);                                   // 1310.9 nobody solved any → they must be really hard
  boss.mood('sad');
  bad('沒人解出任何一個 → 應該真的很難', cx, -0.6);
  say('沒人解出其中任何一個', '所以它們應該真的很難');
  await step(tok);                                   // 1327.2 a solution to one: transform the others into it
  glow(ns[0], GREEN);
  await anim(tok, 500, () => {});
  ns.forEach((m) => glow(m, GREEN));
  note('如果：3SAT 有快的解法 → 其他都轉過來用', cx, 4.6);
  say('如果解出其中一個', '其他都轉過來，跟圖的轉換一樣');
}]);

// 22:41 chess：指數在什麼上？
FRAG.push(['np2-rec-chess', 'Chess：指數時間，改進常數也沒用', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  await step(tok);                                   // 1368.3 chess is here (EXP), different from NP-complete
  const ch = pal('Chess', '', NC.EXP, -4.6, 3.6, 0, 0.7);
  tag('EXP', 'ptr', -4.6, 5.2);
  say('chess 在這裡：EXP', '跟 NP-complete 不一樣');
  await step(tok);                                   // 1390.0 chess: given a board, can I win from it?
  const brd = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) brd.push(cube(null, (r + c) % 2 ? '#6e5f49' : '#efe3c8', [0.42, 0.42, 0.12], -1.4 + c * 0.44, 4.0 + r * 0.44, 0));
  bub('從這個盤面能贏嗎？', -0.7, 6.3);
  say('chess 問題：給一個盤面', '我能不能贏？');
  await step(tok);                                   // 1400.0 for every move, check the resulting board — keep winning
  const nx = [1.6, 3.2, 4.8].map((x, i) => card(i === 1 ? '能贏 ✓' : '不能贏', i === 1 ? NC.P : NC.BAD, x, 4.6, 1.3, 2));
  [1.6, 3.2, 4.8].forEach((x) => arrow(V3(0.5, 4.6, 0), V3(x - 0.7, 4.6, 0)));
  say('每一步都看下一個盤面能不能贏', '一直走到「能贏」的盤面');
  await step(tok);                                   // 1422.1 we don't have it — chess is unsolved
  ch.mood('sad');
  bad('沒有這個演算法：chess 還沒被解', 3.2, 5.6);
  say('可惜我們沒有', 'chess 還沒被解');
  await step(tok);                                   // 1432.7 exponential in what? 2^n with n = 10 is fine
  gone(nx, brd);
  note('2ⁿ、n = 10：沒問題', -1.0, 5.4);
  say('指數，是對什麼的指數？', '2ⁿ 如果 n = 10 還好');
  await step(tok);                                   // 1442.6 for chess: exponential in board configurations
  for (let i = 0; i < 10; i++) cube(null, NC.EXP, [0.3, 0.3, 0.3], 1.0 + (i % 5) * 0.5, 4.8 + Math.floor(i / 5) * 0.5, 0, 2);
  note('盤面配置多到算不完', 2.0, 4.2);
  say('chess 是對「盤面配置」的指數', '配置太多，電腦跑不完');
  await step(tok);                                   // 1451.7 Deep Blue: depth ~15, not guaranteed to win
  tag('Deep Blue：只搜約 15 層', 'ptr', -1.0, 6.4);
  say('Deep Blue 大約搜 15 層', '能跟人比，但不保證贏');
  await step(tok);                                   // 1468.3 only below P is reasonably fast; how algorithms scale
  line(-6, 0, 6, 0, 0, NC.K);
  const wall = line(-6, 3.4, 6, 3.4, 0, NC.BAD); tag('世界末日之前', 'idx', 4.8, 3.7);
  say('只有 P 以內才算得快', '這門課在乎：演算法 scale 得起來嗎？');
  await step(tok);                                   // 1481.1 small sizes work; bigger → dead end
  const b0 = cube('2ⁿ', NC.BAD, [1.2, 0.1, 0.8], -4.0, 0.05, 0);
  await anim(tok, 1600, (t) => { const h = 0.1 + 3.9 * t; b0.scale.y = h / 0.1; b0.position.y = h / 2; });
  say('n = 8、10 這種小的還能跑', 'n 一大就撞牆');
  await step(tok);                                   // 1509.8 smart algorithms only reduce c, can't escape 2^n
  const rows = [['2^(n/2)', 0.5, NC.O], ['2^(n/4)', 0.25, NC.EXP]];
  const bars = rows.map(([t, , c], i) => cube(t, c, [1.2, 0.1, 0.8], -1.0 + i * 3.0, 0.05, 0));
  await anim(tok, 2000, (t) => bars.forEach((b, i) => { const h = 0.1 + Math.min(4.0, 8 * rows[i][1] * t + 0.2); b.scale.y = h / 0.1; b.position.y = h / 2; }));
  note('T(n) = 2^(cn)：c 變小，還是會撞牆', 3.4, 2.2);
  say('聰明的演算法只把 c 變小', '擺脫不了 2ⁿ');
  await step(tok);                                   // 1555.1 Tetris is here (NP)
  card('Tetris', NC.NP, -4.6, 1.2, 1.3, 2);
  tag('NP', 'ptr', -4.6, 2.0);
  say('Tetris 在 NP 那裡');
  await step(tok);                                   // 1585.0 machine learning problems are usually hard → don't scale
  card('機器學習', NC.BAD, 4.6, 5.6, 1.6, 2);
  note('很多問題很難 → 不好 scale', 4.6, 4.9);
  say('機器學習的很多問題也很難', '所以不好 scale');
}]);

// 27:03 NP-complete 在實務上：reduction 的地圖與地雷
FRAG.push(['np2-landmines', '解題地圖：笑臉終點與 NPC 地雷', async (tok) => {
  fresh([0, 12, 7], [0, 0, 0.6]);
  const P = { S: [-6, 0], A1: [-3, -3], A2: [-3, 0], A3: [-3, 3], B1: [0, -2.2], B2: [0, 0], B3: [0, 2.2], C1: [-0.6, 5.0],
    D1: [5, -4.4], D2: [5, -2.2], D3: [5, 0], D4: [5, 2.2], D5: [5, 4.4], L: [2.4, 6.2], L2: [2.2, -5.4], L3: [2.6, 3.4] };
  const nd = {};
  const mk = (k, t, c, w = 1.2) => { const [x, z] = P[k]; nd[k] = cube(t, c, [w, 0.5, 0.8], x, 0.3, z, 2); return nd[k]; };
  const ar = (a, b, col = 0x6a4a00) => { const [ax, az] = P[a], [bx, bz] = P[b]; const d = Math.hypot(bx - ax, bz - az); return arrow(V3(ax + (bx - ax) * 0.7 / d, 0.4, az + (bz - az) * 0.7 / d), V3(bx - (bx - ax) * 0.9 / d, 0.4, bz - (bz - az) * 0.9 / d), col); };
  await step(tok);                                   // 1622.7 what does NP mean to us, in practical terms?
  bub('NP-complete 對我們有什麼用？', 0, 0.8, -5.6);
  say('NP-complete 在實務上有什麼用？');
  await step(tok);                                   // 1631.6 on an exam or interview, you start with a problem
  mk('S', '你的題目', NC.O, 1.6);
  say('考試或面試：從一個題目出發');
  await step(tok);                                   // 1633.7 all possible problems form a graph
  note('把所有問題想成一張圖', -6, 0.8, -1.2);
  say('把所有可能的問題', '想成一張圖');
  await step(tok);                                   // 1645.0 destination: merge sort
  mk('D1', '☺ Merge sort', NC.P, 1.9);
  say('終點（笑臉）：merge sort', '轉得過去就能寫答案');
  await step(tok);                                   // 1659.4 graph search: BFS / DFS
  mk('D2', '☺ BFS / DFS', NC.P, 1.9);
  say('轉成 graph search', 'BFS／DFS → 搞定');
  await step(tok);                                   // 1664.9 shortest paths
  mk('D3', '☺ 最短路徑', NC.P, 1.9);
  say('轉成最短路徑 → 搞定');
  await step(tok);                                   // 1671.4 dynamic programming
  mk('D4', '☺ DP', NC.P, 1.9);
  say('轉成學過的 DP → 搞定');
  await step(tok);                                   // 1676.3 hashing, divide and conquer
  mk('D5', '☺ Hashing / D&C', NC.P, 2.1);
  say('hashing、divide and conquer', '也都是笑臉');
  await step(tok);                                   // 1686.2 goal: get there via reductions
  note('目標：靠 reduction 走到任何一個笑臉', 1.4, 0.8, -6.4);
  say('目標：從起點靠 reduction', '走到任何一個笑臉');
  await step(tok);                                   // 1695.2 three possible reductions — pick the middle (easiest)
  ['A1', 'A2', 'A3'].forEach((k) => { mk(k, '?', NC.S, 0.8); ar('S', k); });
  glow(nd.A2, GOLD);
  say('看到三種可能的 reduction', '沒時間全試：挑中間看起來最簡單的');
  await step(tok);                                   // 1718.2 it turns into three more; this one looks promising
  ['B1', 'B2', 'B3'].forEach((k) => { mk(k, '?', NC.S, 0.8); ar('A2', k); });
  glow(nd.B1, GOLD);
  say('又能轉成三個問題', '挑一個有希望的');
  await step(tok);                                   // 1729.4 reduce to a happy problem: reduction × 3 → write it up
  ar('B1', 'D2', 0x0f5a3a); glow(nd.D2, GREEN);
  good('reduction ×3 → 寫下來，交卷！', 2.6, 0.8, -3.4);
  say('reduction、reduction、reduction', '走到笑臉，寫完交卷');
  await step(tok);                                   // 1744.0 what if the path goes far away from known problems?
  glow(nd.A2, null); glow(nd.B1, null);
  glow(nd.A3, GOLD); mk('C1', '?', NC.S, 0.8); ar('A3', 'C1');
  say('如果走上另一條路', '越轉離會解的問題越遠');
  await step(tok);                                   // 1761.0 you run out of time
  bub('時間到！考卷收回囉', -3.2, 0.8, 6.4);
  say('一直試，最後時間用完', '這是壞結局');
  await step(tok);                                   // 1785.0 NP-complete problems are landmines
  mk('L', '✗ Knapsack', NC.BAD, 1.8); ar('C1', 'L', 0x7a1010); glow(nd.L, RED);
  say('NP-complete 問題 = 地雷', '已經知道它們很難');
  await step(tok);                                   // 1806.0 "solve knapsack in polynomial time" → stop right there
  bad('「多項式時間解 knapsack」→ 立刻回頭', 2.4, 0.8, 7.0);
  say('轉到「多項式時間解 knapsack」', '立刻停，換條路');
  await step(tok);                                   // 1838.3 read the CLRS NPC chapter: more sad faces
  mk('L2', '✗ 3SAT', NC.BAD, 1.4); mk('L3', '✗ TSP', NC.BAD, 1.3);
  note('讀 CLRS 的 NP-complete 章 → 認得更多地雷', -2.0, 0.8, -6.4);
  say('讀 CLRS 的 NP-complete 章', '你會認得更多地雷');
  await step(tok);                                   // 1851.3 the search space is more bounded → better chances
  good('知道哪裡不要去 → 搜尋範圍小很多', 2.6, 0.8, -1.2);
  say('知道哪裡不能去', '更容易找到好的路');
  await step(tok);                                   // 1888.3 read the problem statements; don't worry about proofs
  note('記住問題敘述就好，證明不用管', -2.0, 0.8, 7.0);
  say('記住問題的敘述就好', '證明可以不用管');
}]);

// 32:21 SAT、CNF、2SAT vs 3SAT（老師板書的式子）
FRAG.push(['np2-cnf', 'CNF 與 k-SAT：老師的例子', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.2, 0]);
  const F = [[1, -2], [1, 4], [-1, 4], [-3, 4], [2, 4]];
  const lit = (l) => (l > 0 ? 'x' + l : '¬x' + -l);
  const CXp = (j) => -4.8 + j * 2.4, cubes = [];
  await step(tok);                                   // 1940.8 an important NP-complete problem: SAT
  tag('SAT（satisfiability）', 'ptr alt', 0, 6.2);
  say('一個很重要的 NP-complete 問題', 'SAT（satisfiability）');
  await step(tok);                                   // 1956.2 given a logical expression, find values that make it true
  note('給一個邏輯式，找變數值讓它為真', 0, 5.5);
  say('給一個邏輯式', '找變數的值讓它為真');
  await step(tok);                                   // 1970.6 terms separated by AND
  for (let j = 0; j < F.length; j++) {
    tag('子句 ' + (j + 1), 'idx', CXp(j), 1.9);
    if (j < F.length - 1) tag('∧', 'ptr', CXp(j) + 1.2, 2.6);
    cubes.push([cube('', NC.S, [0.95, 0.6, 0.7], CXp(j) - 0.5, 2.6, 0), cube('', NC.S, [0.95, 0.6, 0.7], CXp(j) + 0.5, 2.6, 0)]);
  }
  say('式子是一堆子句（term）', '子句之間用 AND 連起來');
  await step(tok);                                   // 2001.5 inside a term: variables (maybe negated) joined by OR
  note('子句裡：變數或 ¬變數，用 OR 連', 0, 4.7);
  say('子句裡面只有變數（或加 ¬）', '用 OR 連起來');
  await step(tok);                                   // 2009.5 x1 ∨ ¬x2, x1 ∨ x4, ¬x1 ∨ x4, ¬x3 ∨ x4, x2 ∨ x4
  for (let j = 0; j < F.length; j++) { F[j].forEach((l, k) => relabel(cubes[j][k], lit(l))); await anim(tok, 250, () => {}); }
  say('老師板書的例子', '(x1∨¬x2)∧(x1∨x4)∧(¬x1∨x4)∧(¬x3∨x4)∧(x2∨x4)');
  await step(tok);                                   // 2029.7 this is conjunctive normal form (CNF)
  tag('CNF（conjunctive normal form）', 'ptr', 0, 3.6);
  say('這種形式叫 CNF');
  await step(tok);                                   // 2048.2 all joined by AND → every term must be true
  note('AND：每個子句都要為真', -3.0, 1.2);
  say('子句用 AND 連', '所以每個子句都要為真');
  await step(tok);                                   // 2056.8 OR inside → at least one thing per term is true
  note('OR：每個子句至少一個為真', 3.0, 1.2);
  say('子句裡用 OR 連', '每個子句至少一個為真');
  await step(tok);                                   // 2066.0 n terms, at most k variables in a term
  tag('n 個子句，每個最多 k 個變數', 'idx', 0, 0.5);
  say('n 個子句', '每個子句最多 k 個變數');
  await step(tok);                                   // 2091.0 the problem is called k-SAT
  const ks = tag('k-SAT', 'ptr alt', 0, -0.3);
  say('k 重要到放進名字', '叫做 k-SAT');
  await step(tok);                                   // 2098.0 two important values: 2SAT and 3SAT
  txt(ks, '2SAT 與 3SAT');
  say('兩個重要的 k', '2SAT 和 3SAT');
  await step(tok);                                   // 2102.3 2SAT is polynomial: O(n)
  good('2SAT：多項式，O(n)', -3.0, -1.0);
  say('2SAT 是多項式', '甚至 O(n)');
  await step(tok);                                   // 2123.0 come up with values for x1..x4 to make it true
  const vs = [1, 2, 3, 4].map((v, i) => cube('x' + v + ' = ?', NC.N, [1.4, 0.55, 0.7], -3.3 + i * 2.2, 4.2, 0));
  relabel(vs[3], 'x4 = T'); tint(vs[3], NC.P);
  F.forEach((c, j) => c.forEach((l, k) => { if (l === 4) glow(cubes[j][k], GREEN); }));
  await anim(tok, 700, () => {});
  relabel(vs[0], 'x1 = T'); tint(vs[0], NC.P); glow(cubes[0][0], GREEN);
  say('要想出 x1～x4 的值', '例如 x4 = T、x1 = T 就全部滿足');
  await step(tok);                                   // 2148.5 3SAT is NP-complete
  bad('3SAT：NP-complete', 3.0, -1.0);
  say('3SAT 是 NP-complete', '解出來能拿圖靈獎');
  await step(tok);                                   // 2165.5 any nSAT reduces to 3SAT; size won't explode
  note('任何 nSAT 都能歸約成 3SAT，大小不爆炸', 0, -1.8);
  say('n > 3 的 nSAT 都能轉成 3SAT', '輸入大小不會爆炸');
}]);

// 36:27 3SAT 是 NPC 的三分鐘證明：verifier → circuit → 布林式 → 3CNF
FRAG.push(['np2-verifier-circuit', 'Verifier → 電路 → 3CNF → 3SAT', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.2, 0]);
  const st = [['Verifier', NC.NP], ['電路', NC.O], ['布林式', NC.EXP], ['3CNF', NC.R], ['3SAT', NC.BAD]];
  const X = (i) => -5.2 + i * 2.6, bs = [];
  const add = (i) => { bs[i] = cube(st[i][0], st[i][1], [1.8, 0.7, 0.9], X(i), 3.6, 0, 3); if (i) arrow(V3(X(i - 1) + 0.95, 3.6, 0), V3(X(i) - 0.95, 3.6, 0)); };
  await step(tok);                                   // 2187.0 3SAT is NP-complete: a three-minute proof
  tag('3 分鐘證明：3SAT 是 NP-complete', 'ptr alt', 0, 6.0);
  say('三分鐘證明', '3SAT 是 NP-complete');
  await step(tok);                                   // 2198.5 take the verifier: it wants the input and the proof
  add(0);
  const inp = card('輸入', NC.O, X(0) - 0.5, 1.8, 1.0, 2), pf = card('proof', NC.S, X(0) + 0.7, 1.8, 1.1, 2);
  say('拿任何 NP 問題的 verifier', '它要吃「輸入」和「proof」');
  await step(tok);                                   // 2205.6 write the verifier as a circuit; input & proof bits go in
  add(1);
  const gates = ['AND', 'OR', 'NOT'].map((g, i) => cube(g, '#f1dcc0', [0.7, 0.4, 0.5], X(1) - 0.8 + i * 0.8, 2.6, 0));
  say('把 verifier 寫成電路', '輸入和 proof 都變成一串 bits');
  await step(tok);                                   // 2215.0 the circuit evaluates to true or false
  note('電路輸出：true / false', X(1), 4.6);
  say('電路最後算出 true 或 false');
  await step(tok);                                   // 2222.0 AND/OR gates → ANDs and ORs: a logic expression
  add(2);
  say('AND 閘、OR 閘', '直接變成邏輯式的 AND、OR');
  await step(tok);                                   // 2235.0 solve 3SAT → values for the proof bits. Bam.
  add(3); add(4);
  good('3SAT 解出來 → 得到 proof 的 bits', X(4), 4.6);
  say('再轉成 3SAT 解', '解出來就得到 proof 的 bits');
  await step(tok);                                   // 2280.0 poly-time verifier → poly-size circuit (proof poly too)
  note('verifier 多項式時間 → 電路也是多項式大小', -1.2, 0.6);
  say('verifier 是多項式時間', '所以電路也是多項式大小');
  await step(tok);                                   // 2310.6 input bits → Boolean variables; gates → Boolean functions
  tag('bits → 布林變數', 'idx', X(2), 2.8);
  say('輸入的 bits 變成布林變數', '閘變成 AND、OR、NOT');
  await step(tok);                                   // 2330.0 reduce the expression to 3CNF, then run 3SAT
  tag('每個子句 3 個文字', 'idx', X(3), 2.8);
  say('把布林式轉成 3CNF', '再丟給 3SAT');
  await step(tok);                                   // 2365.3 correction: the problem input is hard-coded in the circuit
  relabel(inp, '寫死'); tint(inp, NC.N);
  note('更正：題目輸入寫死在電路裡；只有 proof bits 是變數', -1.2, -0.2);
  say('（老師更正）題目輸入寫死在電路裡', '只有 proof 的 bits 是變數');
  await step(tok);                                   // 2396.1 3SAT's satisfying assignment = the proof bits
  const ans = cube('賦值 = proof bits', NC.P, [2.6, 0.6, 0.9], 2.6, 1.6, 0, 3);
  arrow(V3(X(4), 3.1, 0), V3(3.4, 2.0, 0));
  say('3SAT 給出能滿足的賦值', '那就是 proof 的 bits');
  await step(tok);                                   // 2408.0 feed the proof to the verifier → happy → solved
  const back = pkt('proof', 2.6, 2.3);
  await travel(tok, back, V3(2.6, 2.3, 0), V3(X(0), 2.7, 0), 1200);
  glow(bs[0], GREEN);
  say('把 proof 餵回 verifier', '它開心 → 問題解決');
  await step(tok);                                   // 2415.4 true for any NP problem: it has a poly-time verifier
  note('任何 NP 問題都有多項式時間的 verifier → 都能這樣做', 0, 5.3);
  say('任何 NP 問題都能這樣做', '因為它一定有多項式 verifier');
  await step(tok);                                   // 2424.7 factoring: the mod algorithm as a circuit; bits of p are inputs
  relabel(bs[0], 'N mod p'); relabel(pf, 'p 的 bits');
  say('例：factoring', 'mod 演算法寫成電路，p 的 bits 是輸入');
  await step(tok);                                   // 2440.5 the satisfying values are the bits of p → N factored
  relabel(ans, 'p 的 bits = 53'); glow(ans, GREEN);
  say('解出來的 bits 就是 p', '3SAT 夠快 → N 就被分解了');
}]);

// 41:08 暴力 2ⁿ；2SAT vs 3SAT 天差地遠；SAT solver
FRAG.push(['np2-2sat-3sat', '2SAT 在 P、3SAT 是 NPC', async (tok) => {
  AX_CAM();
  await step(tok);                                   // 2468.0 trying every assignment of x1, x2, … is exponential
  const vs = ['x1', 'x2', 'x3', '…'].map((v, i) => cube(v, NC.N, [0.8, 0.5, 0.6], -5.4 + i * 1.0, 5.4, 0));
  bub('每個變數都試 T / F？', -2.8, 6.4);
  say('學生問：全部試一遍呢？', '每個變數都試 T、F');
  await step(tok);                                   // 2479.5 that's 2^n, n = number of variables
  note('n 個變數 → 2ⁿ 種組合', -3.6, 4.6);
  say('那是 2ⁿ', 'n 是變數個數');
  await step(tok);                                   // 2491.6 not polynomial — reassuring
  good('不是多項式：這反而讓人放心', -3.6, 3.9);
  say('不是多項式', '反而讓人放心：大家沒有白忙');
  await step(tok);                                   // 2509.5 don't attempt this on exam or interview time
  bad('考試、面試別想現場解它', 2.6, 5.6);
  say('考試、面試時', '別想當場解這題');
  await step(tok);                                   // 2526.6 solve 3SAT → solved any NP-complete problem
  note('解出 3SAT = 解出所有 NP-complete', 2.6, 4.9);
  say('解出 3SAT', '就解出所有 NP-complete 問題');
  await step(tok);                                   // 2540.5 2SAT is polynomial
  gone(vs);
  npAxis(['P', 'NP']); npBand('P', 0.45); npBand('NP', 0.95);
  say('2SAT 是多項式');
  await step(tok);                                   // 2546.1 a tiny difference: easy problem vs hardest in NP
  bub('只差子句裡多一個變數……', -1.0, 3.4);
  say('子句裡多允許一個變數', '看起來只是常數差別');
  await step(tok);                                   // 2562.3 2SAT is O(n): somewhere here
  const a = card('2SAT', NC.P, NX.P - 1.2, 2.0, 1.2, 3);
  good('O(n)', NX.P - 1.2, 2.8);
  say('2SAT：O(n)', '在 P 的很左邊');
  await step(tok);                                   // 2567.1 3SAT is all the way here
  const b = card('3SAT', NC.BAD, NX.NP, 2.0, 1.2, 3); glow(b, RED);
  say('3SAT：一路到 NP 最右端', 'NP 裡最難的');
  await step(tok);                                   // 2582.3 two or three — all the difference in the world
  const ar = arrow(V3(NX.P - 0.5, 2.0, 0), V3(NX.NP - 0.7, 2.0, 0), 0x7a1010);
  tag('2 → 3：天差地遠', 'ptr alt', (NX.P + NX.NP) / 2 - 0.6, 2.6);
  say('2 個還是 3 個', '差別大到天差地遠');
  await step(tok);                                   // 2600.0 research: 3SAT in 2^(0.0001 n) — still exponential
  note('研究：2^(0.0001·n) 也還是指數', 3.0, 4.0);
  say('有人研究把 3SAT 做快一點', '2 的 0.0001n 次方也還是指數');
  await step(tok);                                   // 2643.2 brute force dies at about 20 variables
  tag('暴力：約 20 個變數就跑不動', 'ptr', 3.0, 3.3);
  say('暴力法大約 20 個變數就卡住');
  await step(tok);                                   // 2649.5 state of the art: 1,000–10,000 variables in a few hours
  tag('SAT solver：1000–10000 個變數、幾小時', 'ptr alt', 3.0, 2.6);
  say('最好的 SAT solver', '幾小時能處理 1000–10000 個變數');
  await step(tok);                                   // 2664.0 inferences, explore the configurations smartly
  note('推論 + 聰明地搜尋', 3.0, 1.9);
  say('靠推論、聰明地搜尋', '有進步，但還不是多項式');
  await step(tok);                                   // 2700.5 they didn't solve 1000-bit factoring
  bad('1000-bit factoring 還沒被破解', 3.0, 5.2);
  say('1000-bit 的 factoring', '也還沒被破解');
}]);

// 45:25 graph transformation = reduction；小心輸入大小爆炸
FRAG.push(['np2-blowup', 'Reduction 不能讓輸入爆炸', async (tok) => {
  fresh([0, 5.0, 12.5], [0, 2.2, 0]);
  const xs = [-4.8, -1.6, 1.6, 4.8];
  let A, G, D, S;
  await step(tok);                                   // 2725.1 why solving one NPC solves all: reductions
  tag('解一個 NPC = 解全部：靠 reduction', 'ptr alt', 0, 6.2);
  say('再強調一次 reduction', '解一個 NPC 就解全部，靠的就是它');
  await step(tok);                                   // 2739.4 we did lots of graph transformations
  note('這學期：好多 graph transformation（recitation、考題、作業）', 0, 5.4);
  say('這學期做了很多圖的轉換', 'recitation、考試、作業都有');
  await step(tok);                                   // 2750.1 graph transformations are reductions: build a graph, run shortest paths
  A = card('原問題', NC.O, xs[0], 3.8, 1.6, 3); G = card('建一張圖', NC.NP, xs[1], 3.8, 1.6, 3); D = card('最短路徑', NC.P, xs[2], 3.8, 1.6, 3);
  [[xs[0], xs[1]], [xs[1], xs[2]]].forEach(([a, b]) => arrow(V3(a + 0.85, 3.8, 0), V3(b - 0.85, 3.8, 0)));
  say('圖的轉換就是 reduction', '建圖 → 跑最短路徑');
  await step(tok);                                   // 2761.2 turn the output back into a solution of the original
  S = card('原問題的解', NC.P, xs[3], 3.8, 1.6, 3); arrow(V3(xs[2] + 0.85, 3.8, 0), V3(xs[3] - 0.85, 3.8, 0));
  say('再把結果轉回原問題的解');
  await step(tok);                                   // 2772.2 don't have to reduce to shortest path: any problem you can solve
  relabel(D, '任何會解的');
  say('不一定要轉成最短路徑', '任何會解的問題都可以');
  await step(tok);                                   // 2784.7 shortest path is just one smiley; any smiley is fine
  ['☺ 最短路徑', '☺ DP', '☺ 排序'].forEach((t, i) => card(t, NC.P, -4.0 + i * 4.0, 2.4, 1.8, 2));
  say('最短路徑只是其中一個笑臉', '走到任何笑臉都好');
  await step(tok);                                   // 2790.4 careful: the problem size must not explode
  bad('小心：轉換時輸入大小不能爆炸', 0, 1.4);
  say('但要小心', '轉換過程中輸入大小不能爆炸');
  await step(tok);                                   // 2801.5 e.g. a 3CNF → a graph with 3^n vertices
  relabel(A, '3CNF（n 子句）'); relabel(G, '3ⁿ 個頂點'); relabel(D, 'Dijkstra');
  const cs = []; let shown = 0;
  for (const n of [1, 2, 3]) {
    for (; shown < 3 ** n; shown++) cs.push(cube(null, NC.BAD, [0.38, 0.38, 0.38], -4.8 + (shown % 9) * 1.2, 0.2 + Math.floor(shown / 9) * 0.5, 1.5, 1));
    await anim(tok, 400, () => {});
  }
  note('示意：n = 1, 2, 3 → 3, 9, 27 個頂點', 0, -0.3, 1.5);
  say('例：3CNF 轉成有 3ⁿ 個頂點的圖', '每多一個子句 ×3');
  await step(tok);                                   // 2812.0 run Dijkstra: 3^n — not polynomial
  glow(D, RED);
  tag('Dijkstra 至少 3ⁿ：不是多項式', 'ptr alt', xs[2], 4.6);
  say('跑 Dijkstra 要多久？', '至少 3ⁿ，不是多項式');
  await step(tok);                                   // 2816.3 be careful what happens to the input size
  note('reduction 本身也要是多項式大小', 3.2, 1.4);
  say('做 reduction 時', '要注意輸入大小變成多少');
  await step(tok);                                   // 2824.8 complexity theory: one big excuse
  note('複雜度理論：解不出來的「好理由」', 0, 6.8);
  say('複雜度理論', '一個「為什麼解不出來」的大理由');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    quiz: genQ,
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['poly-vs-exp', 'decision-opt', 'sat-verify', 'certificate-verify', 'class-sets', 'reduction-idea', 'cook-levin', 'npc-tree', 'sat-3sat', '3sat-clique', 'clique-is-vc', 'ham-tsp', 'npc-proof-steps'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
