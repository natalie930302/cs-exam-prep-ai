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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ np1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, arrow, ghostBox, line, GOLD, GREEN, RED } = K;
// ─── PqN0aJeYtuA / 6n8vyWKGsIo（交大江蕙如 Lec22–23）、tIE2lkJv20c（P, NP 5 分鐘）、
//     e2cF8a5aAhE / qZs767KQcvE（Abdul Bari 8 / 8.1）、a_IRpiyBIm0（How to prove NP-Completeness） ───
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

// ════════ PqN0aJeYtuA（江蕙如 Lec22：Beyond Polynomial Running Times 1/2） ════════
// 00:18 兩個族群：有 poly 解的簡單問題 vs 目前沒人找到 poly 解的問題
FRAG.push(['np1-j-two-groups', '兩個族群：有 poly 解 vs 目前看起來很難', async (tok) => {
  fresh([0, 6.5, 12], [0, 1, 0]);
  ellipse(-3.4, 0, 2.9, 2.2, C.G, 0.02, 0.3); ellipse(3.4, 0, 2.9, 2.2, C.R, 0.02, 0.22);
  tag('有 poly 演算法 → efficient', 'ptr', -3.4, 0.2, -2.6);
  tag('目前沒人找到 poly 演算法', 'ptr alt', 3.4, 0.2, -2.6);
  say('1960 年代共識：poly = efficient', '能用 poly time 解 → 算是簡單的問題');
  ['MST', '最短路徑', '排序'].forEach((s, i) => bx(s, C.G, -4.6 + i * 1.2, 0.3, -0.7 + i * 0.9, 1.3, 3, 0.5, 0.7));
  await beat(tok, 3400);
  say('另一群：目前看起來很難', '到現在沒人能用 poly time optimally 解');
  const HP = [[2.2, -0.7], [3.4, 0.2], [4.6, 1.1]];
  const H = ['TSP', 'SAT', 'Knapsack'].map((s, i) => bx(s, C.O, HP[i][0], 0.3, HP[i][1], 1.3, 3, 0.5, 0.7));
  await beat(tok, 3200);
  const q = tag('真的不存在？還沒人知道', 'ptr alt', 3.4, 1.7, 0);
  say('是真的難，還是只是還沒找到？', '證出來 → 千禧年難題、史上留名');
  await beat(tok, 3400); kill(q);
  for (let i = 0; i + 1 < HP.length; i++) rod(V3(HP[i][0], 0.3, HP[i][1]), V3(HP[i + 1][0], 0.3, HP[i + 1][1]), C.Y, 0.05);
  say('這群問題的難度是同等級', '');
  await beat(tok, 2400);
  tint(H[0], C.G); glow(H[0], GREEN);
  say('解掉其中一個 → 整群都能 poly 解', '好處；壞處是目前沒人做到');
  await beat(tok, 1400);
  for (const m of H.slice(1)) { tint(m, C.G); await beat(tok, 600); }
  await beat(tok, 2600);
}]);

// 07:05 MST：optimization 版 vs decision 版（給 bound k）
const MG = { P: { a: [-3.2, 0.3, -1.6], b: [0, 0.3, -2.4], c: [-1.4, 0.3, 0.8], d: [3, 0.3, -0.6], e: [1.8, 0.3, 2.2] },
  E: [['a', 'b', 2], ['a', 'c', 3], ['b', 'c', 1], ['b', 'd', 4], ['c', 'd', 5], ['c', 'e', 6], ['d', 'e', 2]],
  T: [['b', 'c'], ['a', 'b'], ['d', 'e'], ['b', 'd']] };
const mgW = (a, b) => MG.E.find((e) => ek(e[0], e[1]) === ek(a, b))[2];
function mstGraph() { const g = graph(MG.P, MG.E.map((e) => [e[0], e[1]]), { drop: true }); MG.E.forEach(([a, b, w]) => wt(MG.P, a, b, w)); return g; }
FRAG.push(['np1-j-mst-dec', 'MST：最佳化版 vs 判定版（給 bound k）', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  const g = mstGraph();
  say('最佳化版：cost 總和最小的 spanning tree', 'objective function ＋ constraint');
  await beat(tok, 2800);
  const st = tag('', 'ptr alt', 0, 0.3, 3.4);
  let sum = 0;
  for (const [a, b] of MG.T) { eCol(g, a, b, C.G); sum += mgW(a, b); txt(st, 'tree cost = ' + sum); await beat(tok, 800); }
  say('最佳化版的答案：最小 cost = 9', '要找出那棵 tree');
  await beat(tok, 2600);
  gReset(g); txt(st, '');
  say('判定版：只回答 YES / NO', '給 G 和 bound k：有 cost ≤ k 的 spanning tree 嗎？');
  await beat(tok, 3200);
  for (const [k, yes] of [[10, true], [8, false]]) {
    gReset(g);
    if (yes) MG.T.forEach(([a, b]) => eCol(g, a, b, C.Y));
    txt(st, 'k = ' + k + '：' + (yes ? 'YES' : 'NO'));
    say(yes ? 'k = 10：找得到（cost 9）→ YES' : 'k = 8：bound 太小 → NO', '');
    await beat(tok, 2800);
  }
  say('判定版一定要給 bound', '不然沒辦法回答是非題');
  await beat(tok, 2800);
}]);

// 13:10 TSP：最佳化版 vs 判定版（bound B）；params.opt：19:31 的 13509 城市例子
const TC = { P: { A: [-2.6, 0.3, -1.7], B: [2.6, 0.3, -1.7], C: [2.6, 0.3, 1.9], D: [-2.6, 0.3, 1.9] },
  E: [['A', 'B', 3], ['B', 'C', 4], ['C', 'D', 3], ['D', 'A', 4], ['A', 'C', 5], ['B', 'D', 5]] };
const tcW = (a, b) => TC.E.find((e) => ek(e[0], e[1]) === ek(a, b))[2];
const tcCost = (s) => { let c = 0; for (let i = 0; i + 1 < s.length; i++) c += tcW(s[i], s[i + 1]); return c; };
function tspGraph() { const g = graph(TC.P, TC.E.map((e) => [e[0], e[1]]), { drop: true }); TC.E.forEach(([a, b, w]) => wt(TC.P, a, b, w, 'idx', (a === 'A' && b === 'C') || (a === 'B' && b === 'D') ? 0.3 : 0.5)); return g; }
FRAG.push(['np1-j-tsp-dec', 'TSP：最短 tour vs「有沒有 tour ≤ B」', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  const g = tspGraph();
  say('TSP 最佳化版：繞一圈、總長最短', 'start = end、每個 city 恰好拜訪一次');
  await beat(tok, 2800);
  const ct = tag('', 'ptr alt', 0, 0.3, 3.3);
  for (const s of [['A', 'C', 'B', 'D', 'A'], ['A', 'B', 'D', 'C', 'A'], ['A', 'B', 'C', 'D', 'A']]) {
    gReset(g); txt(ct, '');
    for (let i = 0; i + 1 < s.length; i++) eCol(g, s[i], s[i + 1], C.Y);
    const ball = await walk(tok, TC.P, s, 320); kill(ball);
    txt(ct, s.join('→') + '：' + tcCost(s));
    await beat(tok, 1000);
  }
  ['A', 'B', 'C', 'D', 'A'].forEach((v, i, s) => { if (i) eCol(g, s[i - 1], v, C.G); });
  say('最短 tour = 14', '最佳化版要找出這一圈');
  await beat(tok, 2400);
  if (prm().opt) {
    say('真實例子：美國 13509 個城市', '最佳 tour 很難算');
    await beat(tok, 3000);
    say('DP 解 TSP 也要 O(n²·2ⁿ)', '比 n! 好，但還是指數 → 等等證明它是 NPC');
    await beat(tok, 3400);
    return;
  }
  say('判定版：多給一個 bound B', '有 tour ≤ B 嗎？只答 YES / NO');
  await beat(tok, 2800);
  txt(ct, 'B = 15：YES（14 ≤ 15）');
  say('B = 15：找得到 → YES', '');
  await beat(tok, 2400);
  gReset(g); txt(ct, 'B = 13：NO');
  say('B = 13：最短也要 14 → NO', '');
  await beat(tok, 2800);
}]);

// 17:05 用判定版 binary search bound → 最佳值
FRAG.push(['np1-j-bsearch', '只有判定版：二分搜 bound 找最佳值', async (tok) => {
  fresh([0, 7.5, 9.5], [0, 0, 0.2]);
  const X = (v) => -6 + v * 12 / 1000;
  cube('', '#d8c29b', [12.4, 0.08, 0.3], 0, 0.04, 2.6);
  [0, 250, 500, 750, 1000].forEach((v) => tag(String(v), 'idx', X(v), 0.1, 3.2));
  say('手上只有判定版：cost ≤ k 嗎？', '用 binary search 決定 k');
  await beat(tok, 2800);
  const Q = [[1000, 1, '≤ 1000？找得到 → YES'], [500, 1, '砍一半：≤ 500？YES'], [250, 0, '≤ 250？找不到 → NO'], [375, 1, '卡中間：≤ 375？'], [312, 1], [281, 0], [296, 0], [304, 1]];
  for (let i = 0; i < Q.length; i++) {
    const [k, y, cap] = Q[i];
    const c = bx('≤' + k + '?', C.K, X(k), 0.3, -2.3 + i * 0.6, 1.0, 2.5, 0.4, 0.45);
    if (cap) say(cap, ''); else say('繼續問：≤ ' + k + '？', '');
    await beat(tok, i < 4 ? 1100 : 500);
    tint(c, y ? C.G : C.R); relabel(c, k + (y ? ' YES' : ' NO'));
    await beat(tok, i < 4 ? 1500 : 700);
  }
  const fin = bx('300', C.Y, X(300), 0.3, 2.6, 0.7, 3, 0.45, 0.5);
  glow(fin, GOLD);
  say('收斂：小一點找不到、大一點找得到', '那個 bound 就是最佳值（這裡示意為 300）');
  await beat(tok, 3600);
}]);

// 21:30 Cook 證出第一個 NPC，Karp 一次 21 個 → 22 個
FRAG.push(['np1-j-history', 'Cook 第一個 NPC → Karp 一次 21 個', async (tok) => {
  fresh([0, 4.5, 13], [0, 2.8, 0]);
  cube('', '#d8c29b', [12.6, 0.08, 0.3], 0, 0.04, 1.6);
  bx('Stephen Cook', C.P, -4.4, 3.8, 0, 2.6, 3, 0.7); tag('1971', 'idx', -4.4, 0.2, 2.1);
  const sat = bx('SAT', C.O, -4.4, 1.6, 0, 1.4, 3, 0.6);
  const cnt = tag('NPC：1 個', 'ptr alt', 5.0, 4.6);
  say('1970 年代初：Cook 證出第一個 NPC', 'SAT problem');
  glow(sat, GOLD);
  await beat(tok, 3200);
  glow(sat, null);
  bx('Richard Karp', C.B, 1.0, 5.6, 0, 2.6, 3, 0.7); tag('1972', 'idx', 1.0, 0.2, 2.1);
  say('接著 Karp 一次發表 21 個 NPC', '');
  await beat(tok, 900);
  for (let i = 0; i < 21; i++) { bx('', C.O, -0.8 + (i % 7) * 0.6, 4.4 - Math.floor(i / 7) * 0.6, 0, 0.45, 2, 0.45, 0.45); txt(cnt, 'NPC：' + (i + 2) + ' 個'); await beat(tok, 170); }
  say('一開始就有 22 個 NPC 問題', '證明新問題是 NPC 就能寫一篇論文');
  await beat(tok, 3000);
  bx('NPC 問題的字典', C.Y, 4.6, 2.4, 0, 2.8, 3, 0.7);
  say('查到手上的問題是 NPC', '→ 不追求最佳解，改找 heuristic / approximation');
  await beat(tok, 4600);
}]);

// 25:14 Class P（poly time 解，pseudo-poly 不算）與 NP（poly time 驗證）
FRAG.push(['np1-j-p-np', 'Class P（solve）與 NP（verify）', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  const np = ellipse(0.4, 0, 5.0, 2.8, C.B, 0.02, 0.2); np.visible = false;
  ellipse(-2.4, 0, 2.0, 1.6, C.G, 0.05, 0.35);
  tag('P', 'ptr', -2.4, 0.1, -1.9); const nl = tag('NP', 'ptr', 0.4, 0.1, -3.1); showL(nl, false);
  say('P：存在 poly time 演算法「解」它', 'poly 指的是對 problem size');
  ['MST', '排序', '最短路徑'].forEach((s, i) => bx(s, C.G, -3.2 + i * 0.8, 0.3, -0.7 + i * 0.7, 1.2, 2.5, 0.4, 0.5));
  await beat(tok, 3000);
  const kn = bx('Knapsack O(nW)', C.O, 2.4, 0.3, 1.2, 2.0, 2.5, 0.45, 0.6);
  await beat(tok, 900);
  move(kn, -1.2, 0.3, 1.0);
  say('Knapsack、Subset sum 的 DP 不算', 'O(nW) 是 pseudo-polynomial（W 只佔 lg W 個 bit）');
  await beat(tok, 2000); glow(kn, RED);
  await beat(tok, 1400); fly(kn, V3(3, 6, 2));
  np.visible = true; showL(nl, true);
  say('NP = Non-deterministic Polynomial', 'N 不是 non，不是「非 P」');
  await beat(tok, 3200);
  const sol = bx('solution', C.Y, 3.6, 0.3, -0.6, 1.4, 2.5, 0.45, 0.6);
  const chk = bx('verify', C.P, 1.4, 0.3, -0.6, 1.2, 2.5, 0.45, 0.6);
  say('NP：poly time 內能「驗證」一個解', '只 check 對不對，不用自己找');
  await beat(tok, 1400);
  move(sol, 2.3, 0.3, -0.6); await beat(tok, 900); glow(chk, GREEN); relabel(chk, '✓ poly');
  await beat(tok, 1800);
  say('一般相信 P 較小、被 NP 包住', '能解就能驗證：P ⊆ NP；P = NP？未知');
  await beat(tok, 3400);
}]);

// 29:20 NP-complete 的定義：所有 X ∈ NP 都 ≤p Y
FRAG.push(['np1-j-npc-def', 'NPC：NP 裡最難，所有 X ≤p Y', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0, 0, 5.2, 2.9, C.B, 0.02, 0.2); tag('NP', 'ptr', 0, 0.1, -3.2);
  bx('Y（NPC）', C.O, 3.0, 0.4, 0.2, 1.8, 3, 0.6, 0.8);
  say('NP-complete：NP 裡最難的一小撮', '');
  await beat(tok, 2600);
  const Xs = [[-3.6, -1.2], [-3.2, 1.4], [-1.2, -2.0], [-0.6, 1.9], [-1.6, 0.1]];
  say('NP 裡任何一個問題 X', '都能花 poly time 轉成 Y 的 input');
  for (const [x, z] of Xs) { bx('X', C.B, x, 0.3, z, 0.7, 2.5, 0.45, 0.6); await beat(tok, 300); }
  for (const [x, z] of Xs) { arr(x + 0.4, 0.4, z, 2.0, 0.4, 0.2 + (z - 0.2) * 0.15, 0xc08a1f); await beat(tok, 450); }
  say('都能用 Y 的演算法去解', '對所有 X ∈ NP：X ≤p Y');
  await beat(tok, 3000);
  tag('X  ≤p  Y', 'ptr alt', 0, 2.2, 0);
  say('≤：右邊比較難，或一樣難', '下標 p：轉換只花 polynomial time');
  await beat(tok, 3400);
  say('X 的 input 長相不同 → 先轉換', '轉成 Y 的 input，才能用 Y 的演算法');
  await beat(tok, 3200);
}]);

// 33:00 Theorem：NPC 有 poly 解 → P = NP
FRAG.push(['np1-j-pnp-theorem', 'NPC 有 poly 解 → P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0, 0, 5.2, 2.9, C.B, 0.02, 0.2); const pE = ellipse(-2.8, 0, 1.9, 1.5, C.G, 0.05, 0.35);
  const pl = tag('P', 'ptr', -2.8, 0.1, -1.8); tag('NP', 'ptr', 0, 0.1, -3.2);
  const Y = bx('Y（NPC）', C.O, 3.0, 0.4, 0.2, 1.8, 0, 0.6, 0.8);
  const Xs = [[-0.4, -1.6], [0.2, 1.6], [1.2, -0.4], [-0.9, 0.3]].map(([x, z]) => bx('X', C.B, x, 0.3, z, 0.7, 2.5, 0.45, 0.6));
  say('Y 是 NPC：所有 NP 問題都 ≤p Y', '');
  await beat(tok, 2600);
  say('假設有人找到 Y 的 poly 演算法', '那 Y ∈ P');
  tint(Y, C.G); glow(Y, GREEN); move(Y, -2.8, 0.4, 0.4);
  await beat(tok, 2800);
  say('其他 NP 問題都轉成 Y 去解', '轉換 poly ＋ 解 Y poly = poly');
  for (const m of Xs) { tint(m, C.G); await beat(tok, 500); }
  await anim(tok, 1500, (t) => { pE.scale.x = 1.9 + 3.3 * t; pE.scale.z = 1.5 + 1.4 * t; pE.position.x = -2.8 + 2.8 * t; });
  txt(pl, 'P = NP ?');
  say('那 P = NP，整個 NP 都變簡單', '但目前沒人做到，所以打問號');
  await beat(tok, 3000);
  say('多數人傾向相信 P ≠ NP', 'HP 研究員 81 頁證明 P ≠ NP，被找出瑕疵後撤回');
  await beat(tok, 3600);
}]);

// 39:19 驗證演算法 V(instance, certificate)：MST 判定版
FRAG.push(['np1-j-verifier-mst', '驗證演算法 V(instance, certificate)', async (tok) => {
  fresh([0, 7.5, 9.5], [0, 0.6, 0]);
  const g = mstGraph();
  const V = bx('V(⟨G, k=10⟩, T)', C.P, 0, 3.6, -2.6, 3.4, 3, 0.7);
  say('verification 演算法吃兩個 input', '① instance：G 和 bound k ② 一個解 T');
  await beat(tok, 3200);
  const T1 = MG.T;
  T1.forEach(([a, b]) => eCol(g, a, b, C.Y));
  say('隨便給一棵 tree T 當 certificate', 'T = {b–c, a–b, d–e, b–d}');
  await beat(tok, 2600);
  say('檢查 ① 是不是 spanning tree', '4 條邊、連通、沒有環 ✓');
  await beat(tok, 2400);
  say('檢查 ② cost ≤ k？', '1 + 2 + 2 + 4 = 9 ≤ 10 ✓');
  await beat(tok, 2000); tint(V, C.G); relabel(V, 'YES');
  await beat(tok, 1800);
  gReset(g); tint(V, C.P); relabel(V, 'V(⟨G, k=10⟩, T′)');
  [['a', 'b'], ['b', 'c'], ['a', 'c'], ['d', 'e']].forEach(([a, b]) => eCol(g, a, b, C.Y));
  say('換一個 T′ = {a–b, b–c, a–c, d–e}', '有環、而且 d、e 沒接上 ✗');
  await beat(tok, 2400); tint(V, C.R); relabel(V, 'NO');
  await beat(tok, 1600);
  say('只是 check，不用自己找', '這個 check 是 poly time');
  await beat(tok, 2800);
}]);

// 41:00 TSP ∈ NP：猜一個 tour，三個 linear time 檢查
FRAG.push(['np1-j-tsp-verify', 'TSP ∈ NP：猜一個 tour，linear time 檢查', async (tok) => {
  fresh([0, 7, 10], [0, 1, 0]);
  const g = tspGraph();
  const cd = code(['① 起點 = 終點？', '② 每個 city 恰一次？', '③ 總長 ≤ B = 15？'], 0, 5.0, 0.6, -2.6);
  say('要證 TSP ∈ NP：poly time 驗證一個解', '解在這裡叫 certificate');
  await beat(tok, 2800);
  const cert = ['A', 'B', 'C', 'D', 'A'];
  tag('guess：⟨A, B, C, D, A⟩', 'ptr alt', 0, 0.3, 3.4);
  say('先隨便猜一個 tour', '');
  await beat(tok, 2000);
  cd.hl(0); glow(g.N.A, GOLD);
  say('① 看頭尾：都是 A ✓', 'O(1)');
  await beat(tok, 2200);
  cd.hl(1);
  say('② 掃一遍：每個 city 恰好一次 ✓', 'O(n)');
  for (const v of ['A', 'B', 'C', 'D']) { glow(g.N[v], GREEN); await beat(tok, 450); }
  await beat(tok, 800);
  cd.hl(2);
  say('③ 沿著走一圈，把距離加起來', '');
  for (let i = 0; i + 1 < cert.length; i++) eCol(g, cert[i], cert[i + 1], C.Y);
  const ball = await walk(tok, TC.P, cert, 380); kill(ball);
  say('3 + 4 + 3 + 4 = 14 ≤ 15 ✓', 'O(n)');
  await beat(tok, 2400);
  cd.hl(-1);
  say('全部 linear time 檢查完 → TSP ∈ NP', '這是證 NPC 的第一步（作業 5 第 2 題）');
  await beat(tok, 3400);
}]);

// 45:57 CIRCUIT-SAT：史上第一個被證明的 NPC
FRAG.push(['np1-j-circuit-sat', 'CIRCUIT-SAT：給 0/1 讓輸出為 1', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.2, 0]);
  const IN = { x1: [-5, 4.8], x2: [-5, 3.2], x3: [-5, 1.6] };
  const GT = { g1: ['AND ∧', -2, 4.8, ['x1', 'x2']], g3: ['OR ∨', -2, 3.2, ['x2', 'x3']], g2: ['NOT ¬', -2, 1.6, ['x3']], g4: ['OR ∨', 1.2, 4.2, ['g1', 'g2']], out: ['AND ∧', 4.2, 3.0, ['g4', 'g3']] };
  const M = {};
  const P = (k) => (IN[k] ? IN[k] : [GT[k][1], GT[k][2]]);
  for (const k in IN) M[k] = bx(k + '=?', C.K, IN[k][0], IN[k][1], 0, 1.3, 2, 0.6, 0.7);
  for (const k in GT) M[k] = bx(GT[k][0], C.K, GT[k][1], GT[k][2], 0, 1.3, 2, 0.6, 0.7);
  for (const k in GT) for (const s of GT[k][3]) rod(V3(P(s)[0] + 0.65, P(s)[1], 0), V3(P(k)[0] - 0.65, P(k)[1], 0), EDGE, 0.04);
  tag('output', 'ptr alt', 6.1, 3.0);
  say('Combinational circuit：AND、OR、NOT', '∧ = AND、∨ = OR、¬ = NOT');
  await beat(tok, 3200);
  say('能不能把 input 設成 0/1，讓 output = 1？', 'CIRCUIT-SAT');
  await beat(tok, 2800);
  const val = {};
  const ev = (k) => { const [op, , , src] = GT[k]; const v = src.map((s) => val[s]); return op.startsWith('OR') ? v.some(Boolean) : op.startsWith('AND') ? v.every(Boolean) : !v[0]; };
  for (const a of [[0, 0, 0], [0, 1, 0]]) {
    ['x1', 'x2', 'x3'].forEach((k, i) => { val[k] = !!a[i]; relabel(M[k], k + '=' + a[i]); tint(M[k], a[i] ? C.G : C.D); });
    for (const k of ['g1', 'g3', 'g2', 'g4', 'out']) { val[k] = ev(k); tint(M[k], val[k] ? C.G : C.D); await beat(tok, 380); }
    say('input ' + a.join('') + ' → output ' + (val.out ? 1 : 0), val.out ? '找到了：可滿足' : '再換一組');
    await beat(tok, 2000);
  }
  say('史上第一個被證明是 NPC 的問題', '小電路好推；n 個 input 有 2ⁿ 種組合');
  await beat(tok, 3600);
}]);

// 51:00 Reduction 的老例子：bipartite matching → network flow
FRAG.push(['np1-j-bip-flow', 'Bipartite matching 轉成 network flow', async (tok) => {
  fresh([0, 9, 7.5], [0, 0, 0.3]);
  const P = { 1: [-2.2, 0.3, -1.8], 2: [-2.2, 0.3, 0], 3: [-2.2, 0.3, 1.8], a: [2.2, 0.3, -1.8], b: [2.2, 0.3, 0], c: [2.2, 0.3, 1.8] };
  const g = graph(P, [['1', 'a'], ['1', 'b'], ['2', 'a'], ['3', 'c']], { drop: true });
  say('遇到的問題：bipartite matching', '左右配對，每個點最多配一次');
  await beat(tok, 2800);
  say('轉成 network flow 的 input', '加 source s、sink t，capacity 都是 1');
  const s = bx('s', C.P, -5.6, 0.3, 0, 0.8, 2.5, 0.5, 0.8), t = bx('t', C.P, 5.6, 0.3, 0, 0.8, 2.5, 0.5, 0.8);
  await beat(tok, 900);
  const AR = [];
  for (const v of ['1', '2', '3']) { AR.push(arr(-5.2, 0.3, 0, P[v][0] - 0.4, 0.3, P[v][2])); await beat(tok, 250); }
  for (const v of ['a', 'b', 'c']) { AR.push(arr(P[v][0] + 0.4, 0.3, P[v][2], 5.2, 0.3, 0)); await beat(tok, 250); }
  const lt = tag('幾乎照抄＋2 個點：linear time', 'ptr alt', 0, 0.3, 3.0);
  await beat(tok, 2200);
  say('用 Ford-Fulkerson 求 max flow', '');
  for (const [l, r] of [['1', 'b'], ['2', 'a'], ['3', 'c']]) { glow(g.N[l], GREEN); glow(g.N[r], GREEN); eCol(g, l, r, C.G); await beat(tok, 900); }
  say('max flow = 3', '');
  await beat(tok, 1600);
  AR.forEach(kill); kill(lt); fly(s, V3(-3, 6, 0)); fly(t, V3(3, 6, 0));
  say('再翻譯回 matching：有 flow 的邊', '{1–b, 2–a, 3–c}');
  await beat(tok, 3000);
  say('轉過去、解、翻譯回來', '這就是 polynomial time reduction');
  await beat(tok, 2800);
}]);

// 54:42（Lec23 00:15 複習）X ≤p Y：poly 轉換、Y 當 black box、YES ⇔ YES
FRAG.push(['np1-j-reduce-def', 'X ≤p Y：poly 轉換、YES ⇔ YES', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.0, 0]);
  const y = 2.4;
  const [, , by, out] = pipe([['x：X 的 instance', C.B, -5.0, 2.3], ['f：poly time', C.Y, -1.7, 2.2], ['Y 的演算法', C.P, 1.7, 2.2], ['YES / NO', C.K, 4.9, 1.8]], y);
  say('X ≤p Y：把 X 的 input 轉成 Y 的 input', '轉換花的時間要 polynomial');
  await beat(tok, 3200);
  const gb = ghostBox(0x222222, 2.7, 1.5, 1.5); gb.position.set(1.7, y, 0);
  tag('black box', 'idx', 1.7, y + 1.0);
  say('Y 的演算法當 black box', '交給別人做；我們只專心做轉換 f');
  await beat(tok, 2800);
  const tk = cube('x', C.R, [0.5, 0.5, 0.5], -5.0, y + 1.0, 0);
  for (const [x, l] of [[-1.7, 'x'], [0, 'f(x)'], [1.7, 'f(x)'], [4.9, 'YES']]) { move(tk, x, y + 1.0, 0); relabel(tk, l); await beat(tok, 800); }
  glow(out, GREEN); relabel(out, 'YES');
  say('答案還要能翻譯回來', 'x 是 YES ⇔ f(x) 是 YES');
  await beat(tok, 3000);
  void by;
  const L = [['① f 是 poly time', -3.6], ['② X yes ⇒ Y yes', 0], ['③ Y yes ⇒ X yes', 3.6]];
  for (const [s, x] of L) { tag(s, 'ptr alt', x, 5.2); await beat(tok, 500); }
  say('要證的三件事', '可以過去、也可以回來');
  await beat(tok, 3400);
}]);

// ════════ 6n8vyWKGsIo（江蕙如 Lec23：Beyond Polynomial Running Times 2/2） ════════
// 04:16 polynomial time reduction 的三種使用時機（params.k = 0/1/2）
const CASES = [
  { X: 'Bipartite matching', xs: '新遇到的問題', Y: 'Network flow', ys: '已知有演算法', cap: 'Case 1：設計 efficient 演算法', f: '新問題放左邊、已知可解放右邊', concl: '新問題可以 efficient 解（不比 flow 難）' },
  { X: 'CIRCUIT-SAT', xs: '已知很難（NPC）', Y: '新問題', ys: '想證明它很難', cap: 'Case 2：證明 intractability', f: '已知很難放左邊、新問題放右邊', concl: '新問題至少一樣難' },
  { X: 'X', xs: '', Y: 'Y', ys: '', cap: 'Case 3：證明兩個一樣難', f: 'X ≤p Y 而且 Y ≤p X', concl: 'polynomially equivalent' },
];
async function np1Case(tok, k, full) {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const c = CASES[k];
  const bX = bx(c.X, k === 1 ? C.R : C.B, -3.4, 2.6, 0, 3.0, 3, 0.8), bY = bx(c.Y, k === 1 ? C.O : C.G, 3.4, 2.6, 0, 3.0, 3, 0.8);
  if (c.xs) tag(c.xs, 'idx', -3.4, 1.7); if (c.ys) tag(c.ys, 'idx', 3.4, 1.7);
  arr(-1.8, 2.6, 0, 1.8, 2.6, 0, 0xc08a1f); tag('≤p', 'ptr alt', 0, 3.2);
  say(c.cap, c.f);
  await beat(tok, full ? 4200 : 3200);
  if (k === 0) {
    say('用現有的 Ford-Fulkerson 解新問題', '不用從頭設計演算法');
    await beat(tok, 2800);
    if (full) { say('文獻上 matching 有更快的專用演算法', '左邊確實沒有 network flow 那麼難'); await beat(tok, 3400); }
  } else if (k === 1) {
    say('左邊已知很難 → 右邊至少一樣難', '例：HC ≤p TSP');
    await beat(tok, 2800);
    tag(c.concl, 'ptr alt', 0, 4.4);
    await beat(tok, 1400);
    relabel(bX, '新問題'); tint(bX, C.B); relabel(bY, 'CIRCUIT-SAT'); tint(bY, C.R); glow(bX, RED);
    say('方向放反：新問題 ≤p 已知難題', '只知道它「不比難題難」→ 沒有資訊');
    await beat(tok, 3600);
    if (full) { say('有人在學位論文就放反', '證明就完全沒有作用'); await beat(tok, 4200); }
    return;
  } else {
    arr(1.8, 2.0, 0, -1.8, 2.0, 0, 0x2fc092); tag('≤p', 'ptr', 0, 1.4);
    say('互相 reduce 得過去 → 一樣難', '只差 transformation 的時間');
    await beat(tok, 3000);
    if (full) { say('新問題和經典問題只是換句話說', '一體兩面：one-to-one correspondence'); await beat(tok, 3400); }
  }
  tag(c.concl, 'ptr alt', 0, 4.4);
  await beat(tok, full ? 5600 : 2600);
}
FRAG.push(['np1-j-three-cases', 'Reduction 的三種用法', async (tok) => {
  const k = prm().k;
  if (k === undefined) { for (let i = 0; i < 3; i++) await np1Case(tok, i, false); } else await np1Case(tok, k, true);
}]);

// 16:30 Garey & Johnson 的漫畫：找不到 efficient 演算法時怎麼跟老闆說
FRAG.push(['np1-j-comic', '漫畫：找不到 efficient 演算法怎麼辦', async (tok) => {
  fresh([0, 4.2, 12], [0, 2.2, 0]);
  bx('老闆', C.P, 3.8, 0.7, 0, 1.4, 3, 1.4, 1); bx('員工', C.B, -3.8, 0.7, 0, 1.4, 3, 1.4, 1);
  say('老闆：上次的問題解得如何？', '');
  await beat(tok, 2400);
  const bub = tag('', 'ptr', -2.0, 3.4);
  const S = [['「找不到 efficient 演算法，可能我太笨」', '① 怪自己笨', '老闆：那再多花點時間'],
    ['「找不到，因為根本不存在」', '② 說它不存在', '老闆：證得出來嗎？還是只是沒找到？'],
    ['「這些名人也都找不到！」', '③ 大家都找不到', '不是我的問題']];
  for (let i = 0; i < 3; i++) {
    txt(bub, S[i][0]); say(S[i][1], S[i][2]);
    if (i === 2) for (let j = 0; j < 5; j++) { bx('名人', C.Y, -5.6 + j * 1.15, 0.6, -2.4, 0.9, 2.5, 1.2, 0.8); await beat(tok, 250); }
    await beat(tok, 3200);
  }
  say('NPC 領域就是用第 ③ 招', '證明它和大家都解不出的問題一樣難');
  await beat(tok, 3400);
}]);

// 19:23 Hamiltonian cycle：一筆畫（12 面體有、bipartite 圖沒有）
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
  const D = np1Dodeca(-3.4, 0);
  const g = graph(D.P, D.E, { drop: true, size: [0.32, 0.3, 0.32], label: () => '', r: 0.04 });
  say('HC：一筆畫經過每個點、回到起點', 'input 是 undirected graph，只能用給定的邊');
  await beat(tok, 3000);
  const cyc = np1Ham(Object.keys(D.P), D.E);
  say('這張五角形拼成的圖：有 HC', '');
  for (let i = 0; i + 1 < cyc.length; i++) { eCol(g, cyc[i], cyc[i + 1], C.R); glow(g.N[cyc[i]], GOLD); await beat(tok, 170); }
  await beat(tok, 2000);
  const BP = { a1: [2.6, 0.3, -1.0], a2: [2.6, 0.3, 1.0], b1: [5.4, 0.3, -1.8], b2: [5.4, 0.3, 0], b3: [5.4, 0.3, 1.8] };
  const BE = []; for (const a of ['a1', 'a2']) for (const b of ['b1', 'b2', 'b3']) BE.push([a, b]);
  const h = graph(BP, BE, { drop: true, size: [0.5, 0.4, 0.5] });
  say('右邊這張 bipartite graph 呢？', '');
  await beat(tok, 2000);
  const tr = ['a1', 'b1', 'a2', 'b2'];
  for (let i = 0; i + 1 < tr.length; i++) eCol(h, tr[i], tr[i + 1], C.R);
  const ball = await walk(tok, BP, tr, 500); kill(ball);
  glow(h.N.b2, RED); glow(h.N.b3, GOLD);
  say('走到 b2 卡住：b3 還沒走到', '左右必須交替，點數 2 ≠ 3 → 畫不出來');
  await beat(tok, 3200);
  say('HC 已被前人證明是 NP-complete', '也叫 Hamiltonian circuit');
  await beat(tok, 2800);
}]);

// 22:03 起 HC ≤p TSP（params.step = goal / build / fwd / back）
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
    tag('TSP instance：B = 5', 'ptr', 3.7, 0.3, -2.8);
  }
  return { PL, PR, gL, gR };
}
const HC_CYC = ['1', '2', '3', '4', '5', '1'];
FRAG.push(['np1-j-hc-tsp', 'HC ≤p TSP：有邊 cost 1、沒邊 cost 2、B = n', async (tok) => {
  const step = prm().step || 'build';
  fresh([0, 8.5, 8.5], [0, 0, 0.3]);
  if (step === 'goal') {
    np1HcPair(false, true);
    const T = bx('TSP（新問題）', C.O, 3.7, 0.5, 0.2, 2.6, 3, 0.8, 1.2);
    say('TSP 判定版：有 tour ≤ B 嗎？', '每個 city 恰一次、回到起點');
    await beat(tok, 3000);
    arr(-1.2, 0.6, 0.2, 2.2, 0.6, 0.2, 0xc08a1f); tag('≤p', 'ptr alt', 0.5, 1.1, 0.2);
    say('HC 已知 NPC → 放左邊', '目標：HC ≤p TSP → TSP 也很難');
    await beat(tok, 3400);
    glow(T, GOLD);
    const L = ['① f：poly time 轉換', '② HC yes ⇒ TSP yes', '③ TSP yes ⇒ HC yes'];
    for (let i = 0; i < 3; i++) { tag(L[i], 'ptr alt', 0, 2.6 - i * 0.6, -3.0); await beat(tok, 700); }
    say('要完成三件事，缺一不可', '②③ 就是 if and only if');
    await beat(tok, 3600);
    say('先做轉換，再證答案互相對應', '可以過去、也可以回來');
    await beat(tok, 3200);
    return;
  }
  if (step === 'build') {
    const { PR } = np1HcPair(false, true);
    say('把 HC 的 input G 轉成 TSP 的 input', '');
    await beat(tok, 2600);
    say('G 有幾個點，就建幾個 city', 'n = 5');
    const gR = { N: {}, E: {} };
    for (const v of HG5.ids) { gR.N[v] = bx(v, C.K, PR[v][0], 0.3, PR[v][2], 0.6, 2.5, 0.45, 0.6); await beat(tok, 300); }
    await beat(tok, 1200);
    say('G 有的邊：cost 1', '');
    for (const [a, b] of HG5.E) { rod(V3(...PR[a]), V3(...PR[b]), C.G, 0.05); wt(PR, a, b, 1); await beat(tok, 350); }
    await beat(tok, 1000);
    say('G 沒有的邊也要補：cost 2', 'TSP 的圖是 complete graph');
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = HG5.ids[i], b = HG5.ids[j];
      if (hcHas(a, b)) continue;
      rod(V3(...PR[a]), V3(...PR[b]), C.R, 0.035); wt(PR, a, b, 2, 'ptr alt'); await beat(tok, 450);
    }
    await beat(tok, 1200);
    tag('B = n = 5', 'ptr alt', 3.7, 0.3, 3.0);
    say('bound B 設成 n', 'HC 剛好用 n 條 cost 1 的邊');
    await beat(tok, 2800);
    say('建 n 個點、約 n² 條邊', '轉換 O(V²) → polynomial time ✓');
    await beat(tok, 3000);
    return;
  }
  const { PL, PR, gL, gR } = np1HcPair(true, false);
  if (step === 'fwd') {
    say('② 設 G 有 HC：v1 → v2 → … → vn → v1', '');
    for (let i = 0; i + 1 < HC_CYC.length; i++) { eCol(gL, HC_CYC[i], HC_CYC[i + 1], C.Y); await beat(tok, 350); }
    await beat(tok, 1600);
    say('同一圈搬到 TSP 的圖上', '經過每個 city 恰一次、回到起點');
    for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gR, HC_CYC[i], HC_CYC[i + 1], C.Y);
    const ball = await walk(tok, PR, HC_CYC, 450); kill(ball);
    const s = tag('1+1+1+1+1 = 5 ≤ B', 'ptr alt', 3.7, 0.3, 3.0);
    say('走的都是 G 的邊：每條 cost 1', 'n 條 × 1 = n ≤ B → TSP 答 YES');
    await beat(tok, 3400);
    void s; void PL;
    say('HC yes ⇒ TSP yes ✓', '這個方向通常比較直覺');
    await beat(tok, 3000);
    say('設計轉換時就想好了這個方向', '接著要證反方向');
    await beat(tok, 3000);
    return;
  }
  // back：TSP yes ⇒ HC yes
  const st = tag('', 'ptr alt', 3.7, 0.3, 3.0);
  say('③ 反過來：TSP 有 tour ≤ 5', '通常是比較難、會卡關的方向');
  await beat(tok, 2800);
  const bad = ['1', '3', '2', '5', '4', '1'];
  for (let i = 0; i + 1 < bad.length; i++) eCol(gR, bad[i], bad[i + 1], C.Y);
  txt(st, '2+1+1+1+2 = 7 > 5 ✗');
  say('用到 cost 2 的邊 → 一定超過 n', '');
  await beat(tok, 3000);
  gR.E && Object.keys(gR.E).forEach((k) => { const [a, b] = k.split('-'); gR.E[k].material.color.set(hcHas(a, b) ? C.G : C.R); });
  for (let i = 0; i + 1 < HC_CYC.length; i++) eCol(gR, HC_CYC[i], HC_CYC[i + 1], C.Y);
  txt(st, '1+1+1+1+1 = 5 ≤ 5 ✓');
  say('tour 有 n 條邊、總長 ≤ n', 'cost 只有 1 或 2 → 每條都只能是 1');
  await beat(tok, 3400);
  say('cost 1 = G 本來就有的邊', '把這一圈貼回 G');
  for (let i = 0; i + 1 < HC_CYC.length; i++) { eCol(gL, HC_CYC[i], HC_CYC[i + 1], C.Y); glow(gL.N[HC_CYC[i]], GREEN); await beat(tok, 400); }
  void PL;
  say('TSP yes ⇒ HC yes ✓', 'HC ≤p TSP 證完');
  await beat(tok, 4400);
}]);

// 39:54 NPC 的定義：① ∈ NP ② 所有 L′ ∈ NP 都 ≤p L（NP-hard）
FRAG.push(['np1-j-npc-def2', 'NPC 兩個要件：∈ NP ＋ NP-hard', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(-0.5, 0, 4.4, 2.7, C.B, 0.02, 0.2); tag('NP', 'ptr', -0.5, 0.1, -3.0);
  bx('L', C.O, 2.6, 0.4, 0.3, 1.0, 3, 0.6, 0.8);
  say('decision problem L 是 NPC 的兩個要件', '');
  await beat(tok, 2600);
  tag('① L ∈ NP', 'ptr alt', 2.6, 1.3, 0.3);
  say('① L 屬於 NP', 'NP 裡最難的，當然要在 NP 裡');
  await beat(tok, 2800);
  say('② NP 裡每一個 L′ 都 ≤p L', '大家都能轉到 L 身上解 → L 最難');
  const Ls = [[-3.8, -1.2], [-3.4, 1.3], [-1.6, -1.9], [-1.0, 1.8], [-1.9, 0.1]];
  for (const [x, z] of Ls) { bx('L′', C.B, x, 0.3, z, 0.7, 2.5, 0.45, 0.6); await beat(tok, 250); }
  for (const [x, z] of Ls) { arr(x + 0.4, 0.4, z, 2.0, 0.4, 0.3 + (z - 0.3) * 0.15, 0xc08a1f); await beat(tok, 350); }
  await beat(tok, 1400);
  tag('② 這個性質叫 NP-hard', 'ptr alt', 2.6, 0.3, 2.2);
  say('第 ② 個性質叫 NP-hard', '① ＋ ② → NP-complete');
  await beat(tok, 3000);
  say('第一個 NPC 要對「每一個」NP 問題證', 'Cook 用一種通用的表示法一次轉完');
  await beat(tok, 3400);
}]);

// 43:21 P = NP 或 P ≠ NP：NPC 落在 tractable / intractable 哪一邊？
FRAG.push(['np1-j-pnp-cases', 'P = NP？NPC 靠哪一邊', async (tok) => {
  fresh([0, 4.5, 12], [0, 1.6, 0]);
  cube('', C.G, [5.6, 0.08, 1.6], -3.0, 0.04, 0); cube('', C.R, [5.6, 0.08, 1.6], 3.0, 0.04, 0);
  tag('Tractable：poly time 可解', 'ptr', -3.0, 0.2, 1.4); tag('Intractable', 'ptr alt', 3.0, 0.2, 1.4);
  const L = bx('NPC 問題 L', C.O, 0, 0.5, 0, 2.0, 3, 0.7);
  const q = tag('？', 'ptr alt', 0, 1.5);
  say('P 是否等於 NP：只有兩種可能', '');
  await beat(tok, 2800);
  say('有人找到 L 的 poly 演算法', 'L ∈ P，所有 NP 都 ≤p L → P = NP');
  move(L, -3.0, 0.5, 0); txt(q, ''); await beat(tok, 1200); tint(L, C.G);
  tag('P = NP', 'ptr', -3.0, 1.6);
  await beat(tok, 2800);
  say('有人證明 L 不可能有 poly 演算法', '→ P ≠ NP');
  move(L, 3.0, 0.5, 0); tint(L, C.R); await beat(tok, 1200);
  tag('P ≠ NP', 'ptr alt', 3.0, 1.6);
  await beat(tok, 2800);
  move(L, 0, 0.5, 0); tint(L, C.O); txt(q, '？');
  say('NPC 到底靠哪一邊？', '目前沒有人知道');
  await beat(tok, 4400);
}]);

// 45:24 實務上的證法：L ∈ NP ＋ 已知 NPC 的 L′ ≤p L（TSP 為例）
FRAG.push(['np1-j-npc-practical', '實務證 NPC：∈ NP ＋ 已知 NPC ≤p 它', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.0, 0]);
  const def = bx('定義：每個 L′ ∈ NP 都 ≤p L', C.K, 0, 6.2, 0, 6.4, 3, 0.6);
  say('照定義要對所有 NP 問題做 reduction', '太難證了');
  await beat(tok, 2600); glow(def, RED);
  say('實務上用 theorem：只要一個已知 NPC', 'L ∈ NP ＋ 已知 NPC 的 L′ ≤p L');
  await beat(tok, 2600); fly(def, V3(0, 6, -3));
  const S = [['① TSP ∈ NP', '猜 tour，linear time 檢查', C.B], ['② 已知 NPC：HC', 'L′ = Hamiltonian circuit', C.P], ['③ f 是 poly time', '完全圖 cost 1／2、B = n：O(V²)', C.Y], ['④ HC yes ⇔ TSP yes', '兩個方向都證完', C.O]];
  for (let i = 0; i < S.length; i++) {
    const y = 5.4 - i * 1.3;
    bx(S[i][0], S[i][2], -3.0, y, 0, 3.8, 3, 0.7);
    say(S[i][0], S[i][1]);
    await beat(tok, 700);
    tag(S[i][1] + '  ✓', 'ptr alt', 2.8, y);
    await beat(tok, 2200);
  }
  say('TSP is NP-complete', 'HC 當媒介證出來');
  await beat(tok, 3400);
}]);

// ════════ tIE2lkJv20c（Theory of Computation：P, NP, NP-Complete, NP-Hard） ════════
// 00:08 P = DTM poly time；NP = NTM poly time = DTM poly time 可驗證
FRAG.push(['np1-toc-dtm-ntm', 'P 用 DTM、NP 用 NTM（或 poly 驗證）', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.2, 0]);
  const dt = [];
  for (let i = 0; i < 5; i++) { dt.push(bx('', C.B, -3.6, 5.4 - i * 1.0, 0, 0.5, 0, 0.45, 0.5)); if (i) rod(V3(-3.6, 5.4 - (i - 1) * 1.0, 0), V3(-3.6, 5.4 - i * 1.0, 0), EDGE, 0.04); }
  tag('DTM：一條確定的路', 'ptr', -3.6, 6.3); tag('n^O(1) 步', 'idx', -2.4, 3.4);
  say('P：deterministic TM 在 poly time 內決定', 'time = n^O(1)');
  for (const m of dt) { glow(m, GOLD); await beat(tok, 350); }
  await beat(tok, 1800);
  say('NP ≠ Not Polynomial', 'NP = Nondeterministic Polynomial time');
  await beat(tok, 2600);
  const lv = [[3.0], [1.8, 4.2], [1.2, 2.4, 3.6, 4.8], [0.9, 1.5, 2.1, 2.7, 3.3, 3.9, 4.5, 5.1]];
  const N = lv.map((xs, d) => xs.map((x) => bx('', C.K, x, 5.4 - d * 1.2, 0, 0.4, 0, 0.4, 0.4)));
  for (let d = 1; d < 4; d++) N[d].forEach((m, i) => { const p = N[d - 1][i >> 1].position; line(p.x, p.y, m.position.x, m.position.y, 0); });
  tag('NTM：每步可「猜」分支', 'ptr', 3.0, 6.3);
  say('NTM：同時走所有分支', '有一條路接受就答 YES，深度 poly');
  await beat(tok, 1200);
  let k = 5;
  for (let d = 3; d >= 0; d--) { tint(N[d][k], C.G); glow(N[d][k], GREEN); k >>= 1; await beat(tok, 450); }
  await beat(tok, 1400);
  const cert = bx('猜中的路', C.Y, 3.3, 1.0, 1.0, 1.6, 0, 0.45, 0.5);
  say('等價：DTM 在 poly time 內驗證解', '猜中的那條路 = certificate');
  await beat(tok, 900); move(cert, -2.0, 1.0, 1.0); await beat(tok, 1200); glow(dt[4], GREEN); relabel(cert, '驗證 ✓');
  await beat(tok, 2800);
}]);

// 01:08 兩種可能：P ⊊ NP 或 P = NP
FRAG.push(['np1-toc-two-worlds', '兩種可能：P ⊊ NP 或 P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  say('P 的問題 NTM 也能 poly time 決定', '所以 P ⊆ NP');
  await beat(tok, 2600);
  ellipse(-3.4, 0, 3.0, 2.3, C.B, 0.02, 0.22); ellipse(-4.1, 0.3, 1.5, 1.2, C.G, 0.05, 0.38);
  tag('NP', 'ptr', -3.4, 0.1, -2.6); tag('P', 'ptr', -4.1, 0.1, -0.8);
  say('可能一：P 是 NP 的真子集', 'P ⊊ NP');
  await beat(tok, 3000);
  const r = ellipse(3.4, 0, 3.0, 2.3, C.G, 0.03, 0.32);
  tag('P = NP', 'ptr', 3.4, 0.1, -2.6);
  say('可能二：P = NP', '');
  await beat(tok, 2600);
  const m = bx('以為只在 NP', C.B, -2.4, 0.3, 1.2, 1.8, 2.5, 0.45, 0.6);
  say('有些以為不在 P 的問題，後來被證在 P', '');
  await beat(tok, 1200); move(m, -4.1, 0.3, 0.5); tint(m, C.G); relabel(m, '其實在 P');
  await beat(tok, 2600);
  glow(r, GOLD);
  say('哪一種是對的？', 'P vs NP：理論計算機科學的 open problem');
  await beat(tok, 3200);
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
    say('NP-hard：比 NP 裡最難的還難或一樣難', '');
    await beat(tok, 1200); nphE.visible = true; showL(nphL, true);
    await beat(tok, 2200);
    bx('TSP 最佳化', C.R, 4.6, 0.3, -1.2, 1.6, 2.5, 0.4, 0.5); await beat(tok, 600);
    bx('Halting', C.R, 5.0, 0.3, 1.0, 1.3, 2.5, 0.4, 0.5);
    say('這個分類太廣', '沒有 poly verifier、甚至不可判定的也算');
    await beat(tok, 3400);
    say('影片說 NP-hard「不可能在 P」', '更正：要假設 P ≠ NP 才成立');
    await beat(tok, 3400);
    say('只知道 NP-hard，對難度說得很少', '更好的問題：NP 裡有沒有特別難的？');
    await beat(tok, 4600);
    return;
  }
  nphE.visible = true; showL(nphL, true);
  if (st === 'npc') {
    const sat = bx('SAT', C.O, 1.2, 0.3, 0.1, 0.9, 2.5, 0.45, 0.6);
    say('1970 年代初 Cook、Levin：', 'NP 裡有和整個 NP 綁在一起的問題');
    await beat(tok, 2800);
    showL(npcL, true);
    for (const [x, z] of [[-3.6, -0.6], [-2.4, 1.2], [-0.8, -1.6], [-1.2, 1.4]]) { bx('', C.B, x, 0.3, z, 0.5, 2.5, 0.4, 0.5); arr(x + 0.3, 0.4, z, 0.7, 0.4, 0.1 + (z - 0.1) * 0.2, 0xc08a1f); await beat(tok, 450); }
    say('每個 NP 問題都 reduce 到 NPC', '');
    await beat(tok, 2400);
    glow(sat, GOLD);
    say('任一 NPC 給出 poly 解 → 全 NP 都有', '可以贏百萬美元獎金');
    await beat(tok, 3200);
    say('目前最好的確定性方法都是指數時間', '老闆要你即時解 NPC 問題 → 可以據理力爭');
    await beat(tok, 4800);
    return;
  }
  // all：假設 P ≠ NP 的資訊圖
  say('多數人相信 P ≠ NP：照這張圖看', '');
  glow(pE, GREEN); await beat(tok, 2600);
  say('P：有 poly time decider', '');
  await beat(tok, 2200);
  say('NP：poly decider 可能有、可能沒有', '但都能 poly time 驗證');
  await beat(tok, 2800);
  showL(npcL, true); bx('NPC', C.O, 1.2, 0.3, 0.1, 0.9, 2.5, 0.45, 0.6);
  say('NPC：NP 裡最難的特殊類別', '影片說「一定沒有 poly decider」→ 其實未知');
  await beat(tok, 3600);
  say('NP-hard：範圍最廣', '包含 NPC，也包含不在 NP 的問題');
  await beat(tok, 4400);
  void npE;
}]);

// ════════ e2cF8a5aAhE（Abdul Bari 8：NP-Hard and NP-Complete Problems） ════════
// 00:23 polynomial vs exponential 的演算法，研究就是想讓它們更快
FRAG.push(['np1-b-poly-exp', 'Polynomial vs exponential：研究在找更快的', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.2, 0]);
  tag('Polynomial time', 'ptr', -3.4, 6.4); tag('Exponential time', 'ptr alt', 3.4, 6.4);
  const LP = [['Linear search', 'n'], ['Binary search', 'log n'], ['Sorting', 'n²'], ['Merge sort', 'n log n']];
  const RP = ['0/1 Knapsack', 'TSP', 'Sum of subsets', 'Graph coloring', 'Hamiltonian cycle'];
  say('我們學過的演算法分兩類', '');
  const L = LP.map(([s, t], i) => { const m = bx(s + '：' + t, C.G, -3.4, 5.4 - i * 0.95, 0, 3.6, 3, 0.6); return m; });
  await beat(tok, 2200);
  RP.forEach((s, i) => bx(s + '：2ⁿ', C.O, 3.4, 5.4 - i * 0.95, 0, 3.6, 3, 0.6));
  say('右邊寫成 2ⁿ 代表指數', '實際可能是 n·2ⁿ、nⁿ…');
  await beat(tok, 3000);
  say('研究：binary search 能不能 O(1)？', '');
  glow(L[1], GOLD); tag('→ O(1)?', 'ptr alt', -0.6, 4.45); await beat(tok, 2400); glow(L[1], null);
  say('merge sort 能不能 O(n)？', '');
  glow(L[3], GOLD); tag('→ O(n)?', 'ptr alt', -0.6, 2.55); await beat(tok, 2400); glow(L[3], null);
  say('指數時間的能不能變成 polynomial？', 'n¹⁰ 甚至 n¹⁰⁰，n 夠大時都比 2ⁿ 小');
  tag('→ polynomial?', 'ptr alt', 3.4, 0.2);
  await beat(tok, 3400);
  say('做了很久都沒找到', '→ 需要一個研究框架：NP-hard、NP-complete');
  await beat(tok, 3200);
}]);

// 03:41 研究框架兩點：① 把問題關聯起來 ② 寫 non-deterministic poly 演算法
FRAG.push(['np1-b-two-points', '研究框架兩點：關聯問題、ND 演算法', async (tok) => {
  fresh([0, 4.0, 13], [0, 3.0, 0]);
  const xs = [-4.8, -2.4, 0, 2.4, 4.8];
  const M = ['Knapsack', 'TSP', 'Coloring', 'Subsets', 'Ham'].map((s, i) => bx(s, C.O, xs[i], 4.6, 0, 2.0, 3, 0.6));
  say('① 解不出來，至少證明它們相似', '不要每個人各做各的');
  await beat(tok, 2200);
  for (let i = 0; i + 1 < xs.length; i++) { rod(V3(xs[i] + 1.0, 4.6, 0), V3(xs[i + 1] - 1.0, 4.6, 0), C.Y, 0.06); await beat(tok, 400); }
  say('解出其中一個 → 全部都解出來', '');
  tint(M[2], C.G); glow(M[2], GREEN); await beat(tok, 900);
  for (const m of M) { tint(m, C.G); await beat(tok, 300); }
  await beat(tok, 1600);
  const cd = code(['Algorithm A(...)', '{', '  statement 1;', '  ??? 不知道怎麼 poly', '  statement 3;', '}'], 0, 2.9, 0.5);
  say('② 寫不出 deterministic 的 poly 演算法', '就寫 non-deterministic 的 poly 演算法');
  cd.hl(3); await beat(tok, 3400);
  say('先空著那幾行，留給以後的人填', '研究成果就這樣保存下來');
  await beat(tok, 4000);
}]);

// 05:31 Non-deterministic search：choice() 直接給出 index 4
FRAG.push(['np1-b-nd-search', 'Non-deterministic search：choice() 一步到位', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.0, 0]);
  const cd = code(['Algorithm NSearch(A, n, key)', '{', '  j = choice();', '  if (key = A[j]) {', '    write(j); success();', '  }', '  write(0); failure();', '}'], -3.4, 5.6, 0.52);
  const A = [8, 3, 5, 9, 6, 2];
  const M = A.map((v, i) => { tag(String(i + 1), 'idx', 0.9 + i * 1.0, 0.25, 0.6); return bx(v, C.K, 0.9 + i * 1.0, 1.0, 0, 0.85, 2.5, 0.75, 0.8); });
  const kt = tag('key = 9', 'ptr alt', 3.4, 4.6);
  say('在 A[1..n] 裡找 key = 9', '這是 non-deterministic 演算法');
  await beat(tok, 2800);
  cd.hl(2);
  const pj = tag('choice() → j = 4', 'ptr alt', 3.9, 2.8);
  const ar = arr(3.9, 2.5, 0, 3.9, 1.5, 0, 0xc08a1f);
  say('choice() 直接說 key 在 j = 4', '怎麼做到的？不知道 → magic');
  await beat(tok, 3000);
  cd.hl(3); glow(M[3], GOLD);
  say('檢查 A[4] = 9？', '');
  await beat(tok, 1600);
  cd.hl(4); tint(M[3], C.G); glow(M[3], GREEN);
  say('相等 → write(4); success()', '');
  await beat(tok, 2200);
  glow(M[3], null); tint(M[3], C.K); txt(kt, 'key = 7'); txt(pj, 'choice() → j = ?'); kill(ar);
  cd.hl(6);
  say('key = 7 不在陣列裡 → failure()', '不是找不到位置，是 key 真的不存在');
  await beat(tok, 2800);
  cd.hl(-1);
  say('choice / success / failure 都算 O(1)', '整個演算法 O(1)，比 binary search 的 log n 還快');
  await beat(tok, 3200);
  say('今天的 magic，明天可能變成方法', '那時它就變成 deterministic');
  await beat(tok, 3000);
}]);

// 11:05 P ⊆ NP：deterministic poly ⊆ non-deterministic poly（merge sort 的故事）
FRAG.push(['np1-b-p-in-np', 'P ⊆ NP：今天的 deterministic 以前是 ND', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0.6, 0, 5.0, 2.8, C.B, 0.02, 0.2); ellipse(-2.0, 0, 2.6, 2.0, C.G, 0.05, 0.35);
  tag('NP：non-deterministic poly', 'ptr', 0.6, 0.1, -3.1); tag('P：deterministic poly', 'ptr', -2.0, 0.1, -2.3);
  say('P：deterministic、polynomial time', '');
  const PS = ['Linear search', 'Binary search', 'Bubble sort', 'Shortest path', 'MST', 'Huffman'];
  PS.forEach((s, i) => bx(s, C.G, -3.3 + (i % 2) * 2.4, 0.3, -1.2 + Math.floor(i / 2) * 1.1, 2.1, 2.5, 0.4, 0.55));
  await beat(tok, 3000);
  say('NP：non-deterministic、polynomial time', '指數時間的問題，我們想寫的就是這種');
  ['Knapsack', 'TSP'].forEach((s, i) => bx(s, C.O, 3.4, 0.3, -1.0 + i * 1.6, 1.6, 2.5, 0.4, 0.55));
  await beat(tok, 3000);
  const ms = bx('Merge sort', C.B, 1.6, 0.3, 1.3, 1.8, 2.5, 0.45, 0.55);
  say('以前不知道有 n log n 的方法', '那時對我們來說是 non-deterministic');
  await beat(tok, 3000);
  move(ms, -2.0, 0.3, 2.0 - 0.6); tint(ms, C.G);
  say('找到之後變 deterministic → 進入 P', '');
  await beat(tok, 2800);
  say('所以 deterministic ⊆ non-deterministic', 'P ⊆ NP（Bari 的直覺說法；正式定義看「驗證」）');
  await beat(tok, 3400);
}]);

// 13:47 SAT 的 state space tree（params.knap：0/1 knapsack 用同一棵樹）
FRAG.push(['np1-b-sat-tree', 'SAT 的 state space tree（2³ = 8 種）', async (tok) => {
  const knap = !!prm().knap;
  fresh([0, 3.6, 13.5], [0, 3.0, 0]);
  const F = [[1, -2, 3], [-1, 2, -3]];
  const head = tag(knap ? '0/1 knapsack：3 個物品，容量 m = 8' : 'F = (x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ ¬x3)', 'ptr alt', 0, 6.6);
  say(knap ? '解寫成 (x1, x2, x3)，每個是 0 或 1' : 'CNF 公式：子句用 ∨、子句之間用 ∧', knap ? '取或不取：一樣 2³ = 8 種' : 'SAT：哪些 xi 的值讓 F 為真？');
  await beat(tok, 2800);
  const L1 = [-3.2, 3.2], L2 = [-4.8, -1.6, 1.6, 4.8], L3 = [-5.6, -4, -2.4, -0.8, 0.8, 2.4, 4, 5.6];
  const lv = [[0], L1, L2, L3], Y = [5.6, 4.3, 3.0, 1.7];
  ['x1', 'x2', 'x3'].forEach((s, d) => tag(s, 'idx', -6.4, (Y[d] + Y[d + 1]) / 2));
  const N = [[bx('', C.K, 0, Y[0], 0, 0.4, 0, 0.4, 0.4)]];
  for (let d = 1; d <= 3; d++) {
    N[d] = [];
    for (let i = 0; i < lv[d].length; i++) {
      const px = lv[d - 1][i >> 1];
      line(px, Y[d - 1], lv[d][i], Y[d], 0);
      tag(i % 2 ? '0' : '1', 'idx', (px + lv[d][i]) / 2 + (i % 2 ? 0.2 : -0.2), (Y[d - 1] + Y[d]) / 2 + 0.1);
      N[d].push(bx('', C.K, lv[d][i], Y[d], 0, d === 3 ? 0.75 : 0.4, 0, 0.4, 0.4));
    }
    await beat(tok, 700);
  }
  say('root 到 leaf 的路 = 一組 (x1, x2, x3)', '左 = 1、右 = 0；n 個變數 → 2ⁿ 個 leaf');
  const vec = (i) => [(i >> 2) & 1 ? 0 : 1, (i >> 1) & 1 ? 0 : 1, i & 1 ? 0 : 1];
  for (let i = 0; i < 8; i++) relabel(N[3][i], vec(i).join(''));
  await beat(tok, 3000);
  if (!knap) {
    say('逐一代入檢查公式', '010 和 101 讓某個子句為假');
    for (let i = 0; i < 8; i++) {
      const a = vec(i).map(Boolean);
      const ok = F.every((c) => c.some((l) => (l > 0 ? a[l - 1] : !a[-l - 1])));
      glow(N[3][i], GOLD); await beat(tok, 300); glow(N[3][i], null);
      tint(N[3][i], ok ? C.G : C.R); tag(ok ? '✓' : '✗', 'idx', L3[i], 1.0);
      await beat(tok, 250);
    }
    say('試完 2³ = 8 種 → 指數時間', '和 knapsack 等問題同一類');
    await beat(tok, 3200);
  } else {
    say('逐一檢查：不超重、profit 最大', '');
    for (let i = 0; i < 8; i++) { glow(N[3][i], GOLD); await beat(tok, 350); glow(N[3][i], null); }
    txt(head, '');
    say('拿掉題目，這棵樹是誰的？', '兩個都是 → 用同一棵樹把問題關聯起來');
    await beat(tok, 3400);
    say('這棵樹能 poly time 解 → 兩個都能', '');
    await beat(tok, 2800);
  }
}]);

// 20:27 Reduction：SAT ∝ L，poly 轉換，L 也 NP-hard，可遞移（params.clique：Bari 8.1 的 SAT ∝ CDP）
FRAG.push(['np1-b-reduce', 'SAT ∝ L：poly 轉換 → L 也是 NP-hard', async (tok) => {
  const cl = !!prm().clique;
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const L1 = cl ? 'L1：SAT（已知 NP-hard）' : 'Satisfiability（NP-hard）', L2 = cl ? 'L2：CDP' : '0/1 Knapsack';
  const a = bx(L1, C.O, -3.8, 4.4, 0, 3.6, 3, 0.8), b = bx(L2, C.K, 3.8, 4.4, 0, 3.0, 3, 0.8);
  arr(-1.9, 4.4, 0, 2.2, 4.4, 0, 0xc08a1f); tag('∝ reduces to', 'ptr alt', 0.1, 5.0);
  say(cl ? '要證 L2 是 NP-hard：選已知的 L1' : 'SAT ∝ 0/1 knapsack', '證 L1 ∝ L2');
  await beat(tok, 3000);
  const ex = bx(cl ? 'CNF 公式' : '一個 SAT 公式', C.B, -3.8, 2.4, 0, 2.2, 2, 0.6);
  const cv = bx('轉換：poly time', C.Y, 0, 2.4, 0, 2.4, 2, 0.6);
  say('拿 L1 的一個例子，轉成 L2 的例子', '轉換只能花 poly time，不能指數');
  await beat(tok, 1600);
  move(ex, 0, 3.2, 0); await beat(tok, 900); move(ex, 3.8, 2.4, 0); relabel(ex, cl ? '一張圖 G、k' : 'knapsack 例子');
  await beat(tok, 2000);
  void cv;
  say('L2 能 poly time 解 → L1 也能', '同一個演算法解兩個');
  glow(b, GREEN); await beat(tok, 1200); glow(a, GREEN);
  await beat(tok, 2200);
  glow(a, null); glow(b, null); tint(b, C.O);
  say(L2 + ' 也是 NP-hard', '');
  await beat(tok, 2400);
  if (cl) {
    say('本題：SAT ∝ CDP（clique decision）', '從 CNF 公式造出一張圖');
    await beat(tok, 3000);
    return;
  }
  kill(ex); kill(cv);
  say('reduction 可以遞移', '不用每個都直接從 SAT 轉');
  const col = bx('Graph coloring', C.K, 3.8, 1.2, 0, 2.6, 3, 0.6);
  arr(3.8, 3.95, 0, 3.8, 1.6, 0, 0xc08a1f);
  await beat(tok, 900); tint(col, C.O); await beat(tok, 700);
  for (const [s, y] of [['Sum of subsets', 2.0], ['Hamiltonian', 0.5]]) {
    const m = bx(s, C.K, -1.4, y, 0, 2.6, 3, 0.6);
    arr(2.4, 1.2, 0, -0.05, y, 0, 0xc08a1f);
    await beat(tok, 900); tint(m, C.O); await beat(tok, 700);
  }
  say('L1 是 NP-hard、L1 ∝ L2 → L2 也 NP-hard', '');
  await beat(tok, 3000);
}]);

// 25:05 NP-hard ∩ NP（有 ND poly 演算法）= NP-complete
FRAG.push(['np1-b-npc-venn', 'NP-hard ∩ NP = NP-complete', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(-1.8, 0, 3.4, 2.5, C.R, 0.02, 0.2); ellipse(1.8, 0, 3.4, 2.5, C.B, 0.03, 0.2);
  tag('NP-hard', 'ptr alt', -3.0, 0.1, -2.8); tag('NP：有 ND poly 演算法', 'ptr', 3.0, 0.1, -2.8);
  const npcL = tag('NP-complete', 'ptr alt', 0, 0.1, 2.9); showL(npcL, false);
  say('SAT ∝ 它的問題 → 進入 NP-hard', '');
  const sat = bx('SAT', C.O, -3.2, 0.3, -0.8, 1.2, 2.5, 0.45, 0.6);
  const kn = bx('0/1 Knapsack', C.O, -3.6, 0.3, 0.6, 1.8, 2.5, 0.45, 0.6);
  bx('Coloring', C.O, -3.0, 0.3, 1.7, 1.4, 2.5, 0.45, 0.6);
  await beat(tok, 3000);
  say('SAT 有 non-deterministic poly 演算法', '→ 同時在兩邊');
  move(sat, 0, 0.3, -0.6); await beat(tok, 1400); showL(npcL, true); glow(sat, GOLD);
  say('NP-hard ∩ NP = NP-complete', 'SAT 是已知的 NPC');
  await beat(tok, 3000);
  say('研究新問題 L 的兩件事', '① 證 SAT ∝ L（直接或間接）→ NP-hard');
  await beat(tok, 3200);
  say('② 再寫出 ND poly 演算法 → NPC', '基本的研究工作就完成了');
  move(kn, 0, 0.3, 0.7); await beat(tok, 1400); glow(kn, GOLD);
  await beat(tok, 3400);
}]);

// 28:09 P 會越長越大？Cook：SAT ∈ P ⇔ P = NP
FRAG.push(['np1-b-cook', 'P 越長越大？Cook：SAT ∈ P ⇔ P = NP', async (tok) => {
  fresh([0, 8.5, 8], [0, 0, 0.3]);
  ellipse(0, 0, 5.0, 2.8, C.B, 0.02, 0.2); const pE = ellipse(-2.6, 0, 1.6, 1.3, C.G, 0.05, 0.35);
  tag('NP', 'ptr', 0, 0.1, -3.1); const pl = tag('P', 'ptr', -2.6, 0.1, -1.6);
  const sat = bx('SAT', C.O, 2.6, 0.3, 0.4, 1.0, 2.5, 0.45, 0.6);
  say('今天的 ND，明天可能變 deterministic', '我們相信 P 會越長越大');
  await anim(tok, 3000, (t) => { pE.scale.x = 1.6 + 1.6 * t; pE.scale.z = 1.3 + 0.8 * t; pE.position.x = -2.6 + 1.2 * t; });
  await beat(tok, 1200);
  say('要是長不到 NP 那麼大呢？', '研究就白做了 → 要證明 P = NP');
  await beat(tok, 3200);
  say('P = NP：解法其實存在，只是還沒發現', '');
  await beat(tok, 2800);
  glow(sat, GOLD);
  say('Cook：SAT ∈ P ⇔ P = NP', '他沒證出來，只說誰證出 SAT ∈ P 就成立');
  await beat(tok, 3000);
  move(sat, -1.4, 0.3, 0.2); tint(sat, C.G); txt(pl, 'P = NP ?');
  await anim(tok, 1400, (t) => { pE.scale.x = 3.2 + 1.8 * t; pE.scale.z = 2.1 + 0.7 * t; pE.position.x = -1.4 + 1.4 * t; });
  say('SAT 進 P → P 撐滿整個 NP', '至今沒人做到');
  await beat(tok, 3000);
}]);

// ════════ a_IRpiyBIm0（How to prove NP-Completeness - The Steps） ════════
// 01:05 decision vs optimization：最短路徑 vs「有沒有長度 ≤ k 的路」
const PH = { P: { s: [-4.6, 0.3, 0], a: [-1.6, 0.3, -1.9], b: [-1.6, 0.3, 1.9], c: [1.6, 0.3, 0], t: [4.6, 0.3, 0] },
  E: [['s', 'a', 2], ['s', 'b', 4], ['a', 'b', 1], ['a', 'c', 5], ['b', 'c', 2], ['c', 't', 3]] };
FRAG.push(['np1-h-dec-path', '最短路徑 vs「有長度 ≤ k 的路嗎」', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  const g = graph(PH.P, PH.E.map((e) => [e[0], e[1]]), { drop: true });
  PH.E.forEach(([a, b, w]) => wt(PH.P, a, b, w));
  const st = tag('', 'ptr alt', 0, 0.3, 3.3);
  say('Optimization：s 到 t 的最短路徑', '');
  await beat(tok, 2600);
  const sp = ['s', 'a', 'b', 'c', 't'];
  for (let i = 0; i + 1 < sp.length; i++) eCol(g, sp[i], sp[i + 1], C.G);
  const ball = await walk(tok, PH.P, sp, 450); kill(ball);
  txt(st, '最短 = 2+1+2+3 = 8');
  await beat(tok, 2200);
  gReset(g);
  say('Decision：有沒有長度 ≤ k 的路？', '答案只有 YES / NO');
  await beat(tok, 2800);
  for (let i = 0; i + 1 < sp.length; i++) eCol(g, sp[i], sp[i + 1], C.Y);
  txt(st, 'k = 9：YES（8 ≤ 9）'); say('k = 9 → YES', ''); await beat(tok, 2200);
  gReset(g); txt(st, 'k = 7：NO'); say('k = 7 → NO', ''); await beat(tok, 2200);
  say('decision 版比較簡單', 'optimization 至少和 decision 一樣難');
  await beat(tok, 3000);
  say('decision 都很難 → optimization 更難', '所以證 NPC 一律用 decision 版');
  await beat(tok, 3000);
}]);

// 04:38 reduction 用來解題：α →(poly) β → B 的 poly 演算法
FRAG.push(['np1-h-reduce-solve', 'Reduction：A 轉成 B，用 B 的演算法', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.0, 0]);
  const y = 2.4;
  const [, , bB, out] = pipe([['α：A 的 instance', C.B, -5.1, 2.2], ['reduction（poly）', C.Y, -1.7, 2.4], ['B 的演算法（poly）', C.P, 1.8, 2.6], ['yes / no', C.K, 5.1, 1.6]], y);
  say('想 poly time 解 decision problem A', 'B 已經會 poly time 解');
  await beat(tok, 3000);
  const tk = cube('α', C.R, [0.5, 0.5, 0.5], -5.1, y + 1.0, 0);
  say('把 A 的 instance α 轉成 B 的 instance β', 'polynomial time reduction');
  for (const [x, l] of [[-1.7, 'α'], [0, 'β'], [1.8, 'β']]) { move(tk, x, y + 1.0, 0); relabel(tk, l); await beat(tok, 1000); }
  say('再用 B 的 poly 演算法', '');
  glow(bB, GOLD); await beat(tok, 1400); glow(bB, null);
  move(tk, 5.1, y + 1.0, 0); relabel(tk, 'yes'); glow(out, GREEN);
  await beat(tok, 1400);
  say('yes 要對應 yes、no 對應 no', '不然解不出 A');
  tag('α yes ⇔ β yes', 'ptr alt', 0, 4.6);
  await beat(tok, 3000);
  say('poly ＋ poly = poly', '→ A 也能 poly time 解');
  await beat(tok, 3800);
}]);

// 08:10 反證：A 沒有 poly 解、A ≤p B → B 也沒有 poly 解
FRAG.push(['np1-h-contra', '反證：A 沒 poly 解 → B 也沒有', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.6, 0]);
  const A = bx('A：已知沒有 poly 解', C.R, -3.6, 2.6, 0, 3.2, 3, 0.8), B = bx('B：想證明它很難', C.K, 3.6, 2.6, 0, 3.0, 3, 0.8);
  arr(-1.9, 2.6, 0, 2.0, 2.6, 0, 0xc08a1f); tag('poly reduction', 'ptr alt', 0, 3.2);
  say('現在的焦點換成 B', '用 reduction 證明 B 沒有 poly 解');
  await beat(tok, 3000);
  say('已知 A 沒有 poly 解，且 A ≤p B', '用反證法');
  await beat(tok, 2800);
  const as = tag('假設：B 有 poly 解', 'ptr', 3.6, 4.0);
  tint(B, C.G);
  say('假設 B 有 poly time 解', '');
  await beat(tok, 2400);
  say('A 先 poly 轉成 B，再用 B 解', '→ A 有 poly 解？');
  tint(A, C.G); await beat(tok, 2600);
  glow(A, RED); tint(A, C.R); const x = tag('✗ 矛盾', 'ptr alt', -3.6, 4.0);
  say('和「A 沒有 poly 解」矛盾', '');
  await beat(tok, 2600);
  kill(as); kill(x); tint(B, C.R); relabel(B, 'B：沒有 poly 解');
  say('所以 B 不可能有 poly 解', '');
  await beat(tok, 3000);
}]);

// 12:45 第一個 NPC：Cook–Levin 從 first principles 證 SAT；之後一個接一個加進 bucket
FRAG.push(['np1-h-bucket', 'NP-complete bucket：從 SAT 一個接一個', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.4, 0]);
  const bk = ghostBox(0xdd8238, 8.0, 2.4, 2.2); bk.position.set(0, 1.2, 0);
  tag('NP-complete bucket', 'ptr alt', 0, 2.9, 1.2);
  say('反證法需要一個已知很難的 A', '一定要有「第一個」NPC');
  await beat(tok, 2800);
  const S = bx('SAT', C.P, -3.0, 0.5, 0, 1.4, 4, 0.6);
  say('Cook–Levin：從 first principles 證明', 'Boolean satisfiability 是 NPC');
  await beat(tok, 3000);
  const ms = [S];
  for (const [n, x] of [['L₂', -1.0], ['L₃', 1.0], ['L₄', 3.0]]) {
    const m = bx(n, C.O, x, 0.5, 0, 1.2, 4, 0.6); ms.push(m);
    const from = ms[ms.length - 2].position;
    arr(from.x + 0.6, 1.1, 0, x - 0.6, 1.1, 0, 0xc08a1f);
    say('從 bucket 裡任一個 reduce 過來', n + ' 也加進 bucket');
    await beat(tok, 1800);
  }
  say('任一個有 poly 解 → 全部都有', '它們全部綁在一起');
  tint(ms[2], C.G); glow(ms[2], GREEN); await beat(tok, 1000);
  for (const m of ms) { tint(m, C.G); await beat(tok, 350); }
  await beat(tok, 2400);
}]);

// 14:45 總結步驟：① L ∈ NP ② L′ ≤p L（不是 L ≤p L′）
FRAG.push(['np1-h-steps', '證 NPC：L ∈ NP，且 L′ ≤p L（方向別反）', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.6, 0]);
  const L = bx('L：想證 NPC', C.K, 3.6, 2.6, 0, 2.8, 3, 0.8), Lp = bx("L′：已知 NPC", C.O, -3.6, 2.6, 0, 2.8, 3, 0.8);
  tag('都是 decision 版', 'idx', 0, 1.4);
  say('L、L′ 都是 decision 版本', '不是 optimization');
  await beat(tok, 2800);
  const s1 = tag('① L ∈ NP', 'ptr alt', 3.6, 3.7);
  say('第一步：證明 L ∈ NP', '');
  await beat(tok, 2600);
  const a1 = arr(-2.1, 2.6, 0, 2.1, 2.6, 0, 0x2fc092); const t1 = tag('② L′ ≤p L ✓', 'ptr', 0, 3.2);
  say('第二步：把已知 NPC 的 L′ reduce 到 L', 'L 能解 → L′ 也能解 → L 很難');
  await beat(tok, 3400);
  kill(a1); kill(t1); void s1;
  arr(2.1, 2.2, 0, -2.1, 2.2, 0, 0xd64545); const t2 = tag('L ≤p L′ ✗', 'ptr alt', 0, 1.8);
  glow(L, RED);
  say('常見錯誤：把 L reduce 到 L′', '只是把自己的題目變難，不代表沒有簡單解');
  await beat(tok, 3600);
  kill(t2); glow(L, null);
  arr(-2.1, 3.0, 0, 2.1, 3.0, 0, 0x2fc092); tag('L′ ≤p L', 'ptr', 0, 3.6);
  tint(L, C.O); relabel(L, 'L：NP-complete');
  say('① ＋ ② → L 是 NP-complete', '方向：已知 NPC → 新問題');
  await beat(tok, 3200);
}]);

// ════════ qZs767KQcvE（Abdul Bari 8.1：Clique Decision Problem） ════════
// 00:37 complete graph（n(n−1)/2 條邊）與 clique
FRAG.push(['np1-c-complete', 'Complete graph 與 clique', async (tok) => {
  fresh([0, 8.5, 8.5], [0, 0, 0.3]);
  const K4 = graph({ 1: [-5.4, 0.3, -2.4], 2: [-3.6, 0.3, -2.4], 3: [-3.6, 0.3, -0.6], 4: [-5.4, 0.3, -0.6] }, [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]], { drop: true, size: [0.5, 0.4, 0.5] });
  const K3 = graph({ 1: [-0.9, 0.3, -2.4], 2: [0.9, 0.3, -2.4], 3: [0, 0.3, -0.8] }, [[1, 2], [2, 3], [1, 3]], { drop: true, size: [0.5, 0.4, 0.5] });
  const K2 = graph({ 1: [3.6, 0.3, -1.5], 2: [5.4, 0.3, -1.5] }, [[1, 2]], { drop: true, size: [0.5, 0.4, 0.5] });
  void K4; void K3; void K2;
  say('每個點都和其他所有點相連', '→ complete graph');
  await beat(tok, 2600);
  tag('n=4：6 條', 'ptr alt', -4.5, 0.3, 0.2); tag('n=3：3 條', 'ptr alt', 0, 0.3, 0.2); tag('n=2：1 條', 'ptr alt', 4.5, 0.3, 0.2);
  say('n 個點的 complete graph', '邊數 = n(n−1)/2');
  await beat(tok, 3200);
  const P = { 1: [-2.2, 0.3, 1.4], 2: [0, 0.3, 1.4], 3: [0, 0.3, 3.2], 4: [-2.2, 0.3, 3.2], 5: [2.4, 0.3, 2.3] };
  const g = graph(P, [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [5, 3], [5, 2]], { drop: true, size: [0.5, 0.4, 0.5] });
  say('加一個點 5，只連到兩個點', '整張圖不再是 complete graph');
  glow(g.N[5], RED);
  await beat(tok, 3000);
  glow(g.N[5], null);
  for (const v of [1, 2, 3, 4]) tint(g.N[v], C.G);
  for (const [a, b] of [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]) eCol(g, a, b, C.Y);
  say('但 {1, 2, 3, 4} 這個 subgraph 是 complete', '');
  await beat(tok, 2800);
  say('本身是 complete graph 的 subgraph', '→ clique（這裡是 size 4）');
  await beat(tok, 3800);
}]);

// 03:16 在 6 個點的圖上找 clique（params.dec：decision vs optimization）
const CG6 = { P: { 1: [-4.2, 0.3, -1.5], 2: [-4.2, 0.3, 1.5], 3: [-1.2, 0.3, -1.5], 4: [-1.2, 0.3, 1.5], 5: [1.8, 0.3, 0], 6: [4.8, 0.3, 0] },
  E: [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 6]] };
function hiClique(g, S, col) { gReset(g); S.forEach((v) => tint(g.N[v], C.G)); for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) eCol(g, S[i], S[j], col); }
FRAG.push(['np1-c-cliques', '找 clique：size 4、3、2；最大是 4', async (tok) => {
  const dec = !!prm().dec;
  fresh([0, 8.5, 8.5], [0, 0, 0.2]);
  const g = graph(CG6.P, CG6.E, { drop: true });
  const st = tag('', 'ptr alt', 0, 0.3, 3.0);
  if (!dec) {
    say('圖 G 有 6 個點：找出 clique', '');
    await beat(tok, 2400);
    for (const [S, cap] of [[[1, 2, 3, 4], 'size 4：{1, 2, 3, 4}'], [[3, 4, 5], 'size 3：{3, 4, 5}'], [[1, 2, 3], 'size 3：{1, 2, 3} 也是'], [[5, 6], 'size 2：一條邊 5–6']]) {
      hiClique(g, S, C.Y); txt(st, cap); say('clique ' + cap, ''); await beat(tok, 2600);
    }
    hiClique(g, [1, 2, 3, 4], C.Y); txt(st, 'max clique = 4');
    say('最大的 clique 是 size 4', '');
    await beat(tok, 3000);
    return;
  }
  say('Decision problem：只答 YES / NO', '');
  await beat(tok, 2200);
  for (const [k, S] of [[3, [3, 4, 5]], [2, [5, 6]], [4, [1, 2, 3, 4]]]) {
    hiClique(g, S, C.Y); txt(st, 'size ' + k + ' 的 clique？YES');
    say('有 size ' + k + ' 的 clique 嗎？→ YES', ''); await beat(tok, 2400);
  }
  gReset(g); txt(st, 'size 5？NO');
  say('size 5？→ NO', '4 以上就沒有了'); await beat(tok, 2200);
  hiClique(g, [1, 2, 3, 4], C.G); txt(st, '最大 clique = 4');
  say('Optimization：最大的 clique 多大？', '答案 4');
  await beat(tok, 2600);
  say('CDP：G 有沒有 size k 的 clique', '是 decision 版；兩個版本都是 NP-hard');
  await beat(tok, 3200);
}]);

// 08:35 SAT ∝ CDP：F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)（params.step = vert / edge / clique）
const CF = [[1, 2], [-1, -2], [1, 3]];
const CPOS = { '0.0': [-1.1, 0.3, -2.5], '0.1': [1.1, 0.3, -2.5], '1.0': [-4.4, 0.3, 0.1], '1.1': [-4.4, 0.3, 2.0], '2.0': [4.4, 0.3, 0.1], '2.1': [4.4, 0.3, 2.0] };
const cLit = (id) => { const [r, i] = id.split('.').map(Number); return CF[r][i]; };
const litS = (l) => (l > 0 ? 'x' + l : '¬x' + -l);
function cdpEdges() { const ids = Object.keys(CPOS), out = [], bad = []; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { if (ids[a][0] === ids[b][0]) continue; (cLit(ids[a]) === -cLit(ids[b]) ? bad : out).push([ids[a], ids[b]]); } return { out, bad }; }
function cdpBase(drop) {
  tag('F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)', 'ptr', 0, 0.3, 3.4);
  const N = {};
  for (const id in CPOS) { const r = +id[0]; N[id] = bx(litS(cLit(id)), [C.B, C.P, C.PK][r], CPOS[id][0], 0.3, CPOS[id][2], 0.95, drop ? 2.5 : 0, 0.45, 0.65); }
  tag('C1', 'ptr alt', 0, 0.3, -3.3); tag('C2', 'ptr alt', -5.6, 0.3, 1.05); tag('C3', 'ptr alt', 5.6, 0.3, 1.05);
  return N;
}
FRAG.push(['np1-c-sat-cdp', 'SAT ∝ CDP：公式 → 圖，k 個子句 → k-clique', async (tok) => {
  const step = prm().step || 'vert';
  fresh([0, 9, 8], [0, 0, 0.4]);
  const { out, bad } = cdpEdges();
  if (step === 'vert') {
    say('3 個變數、3 個子句的 CNF 公式', 'k = 3 個子句 → 要找 size 3 的 clique');
    tag('F = (x1 ∨ x2) ∧ (¬x1 ∨ ¬x2) ∧ (x1 ∨ x3)', 'ptr', 0, 0.3, 3.4);
    await beat(tok, 3200);
    for (let r = 0; r < 3; r++) {
      for (const id in CPOS) if (+id[0] === r) bx(litS(cLit(id)), [C.B, C.P, C.PK][r], CPOS[id][0], 0.3, CPOS[id][2], 0.95, 2.5, 0.45, 0.65);
      tag('C' + (r + 1), 'ptr alt', [0, -5.6, 5.6][r], 0.3, [-3.3, 1.05, 1.05][r]);
      say('C' + (r + 1) + ' 的每個 literal → 一個頂點', '各子句分開放，不混在一起');
      await beat(tok, 2800);
    }
    say('頂點 = ⟨a, i⟩', 'a 是 literal、i 是它所在的子句 Ci');
    await beat(tok, 4000);
    return;
  }
  const N = cdpBase(false);
  if (step === 'edge') {
    say('規則 ①：同一個子句的頂點不連', 'i ≠ j');
    const r1 = rod(V3(...CPOS['0.0']), V3(...CPOS['0.1']), C.R, 0.05); glow(N['0.0'], RED); glow(N['0.1'], RED);
    await beat(tok, 3400); kill(r1); glow(N['0.0'], null); glow(N['0.1'], null);
    say('規則 ②：不能連到自己的 negation', 'b ≠ ā（x1 和 ¬x1 不連）');
    for (const [a, b] of bad) { const r = rod(V3(...CPOS[a]), V3(...CPOS[b]), C.R, 0.05); glow(N[a], RED); glow(N[b], RED); await beat(tok, 900); kill(r); glow(N[a], null); glow(N[b], null); }
    await beat(tok, 800);
    say('其他不同子句的頂點都連起來', '');
    for (const [a, b] of out) { rod(V3(...CPOS[a]), V3(...CPOS[b]), EDGE, 0.035); await beat(tok, 600); }
    say('共 ' + out.length + ' 條邊：這就是 CDP 的例子', '建圖是 poly time');
    await beat(tok, 3800);
    return;
  }
  // clique
  const E = {};
  for (const [a, b] of out) E[ek(a, b)] = rod(V3(...CPOS[a]), V3(...CPOS[b]), EDGE, 0.035);
  say('k = 3：圖裡有 size 3 的 clique 嗎？', '');
  await beat(tok, 2400);
  const pick = ['0.1', '1.0', '2.1'];
  for (const id of pick) { tint(N[id], C.G); glow(N[id], GREEN); }
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) E[ek(pick[i], pick[j])].material.color.set(C.Y);
  say('有：x2、¬x1、x3（還有別的三角形）', '找不到 size 4');
  await beat(tok, 3000);
  const vt = tag('x1 = 0, x2 = 1, x3 = 1', 'ptr alt', 0, 0.3, 0.6);
  say('把選到的 literal 設成 true', 'x2 = 1、¬x1 真 → x1 = 0、x3 = 1');
  await beat(tok, 3000);
  void vt;
  for (const [c, s] of [['C1', '0 ∨ 1 = 1'], ['C2', '1 ∨ 0 = 1'], ['C3', '0 ∨ 1 = 1']]) { say(c + '：' + s, ''); await beat(tok, 1300); }
  say('F = 1 ∧ 1 ∧ 1 = 1：公式成立', 'k-clique ⇒ 可滿足；換別的三角形也一樣');
  await beat(tok, 3000);
  say('SAT ∝ CDP → CDP 是 NP-hard', '再寫出 ND poly 演算法 → NP-complete');
  await beat(tok, 3200);
}]);
  }

  // ═══ np2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, showL, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── MIT 6.006 Fall 2011：L23 moPtwq_cVH8（Erik Demaine）、Rec23 t5Wxk96QjUk ───
// 老師的「難度軸」：左邊簡單、右邊困難，刻度 P、NP、EXP、R（示意圖，不是精確的集合圖）
const NC = { P: '#2fc092', NP: '#4b9ee2', EXP: '#e0b23c', R: '#9b7ef4', BAD: '#d64545', N: '#cfc4b0', O: '#dd8238', K: '#6e5f49' };
const NX = { P: -3.8, NP: -0.8, EXP: 2.0, R: 4.6 };
function npNotch(n, x = NX[n]) { const l = line(x, -0.3, x, 0.3, 0, '#3a3024'); const t = tag(n, 'ptr', x, -0.75); return { l, t, x }; }
function npAxis(names = []) {
  line(-6.3, 0, 6.2, 0, 0, NC.K); arrow(V3(6.0, 0, 0), V3(6.9, 0, 0));
  tag('easy', 'idx', -6.1, -0.6); tag('hard', 'idx', 6.3, -0.6);
  const ns = {}; for (const n of names) ns[n] = npNotch(n); return ns;
}
// 從最左邊延伸到刻度 x 的一條半透明帶子（類別 = 刻度左邊全部）
function npBand(n, y, x = NX[n], color = NC[n], from = -6.3) {
  const w = Math.max(0.1, x - from), m = ghostBox(color, w, 0.34, 0.9); m.position.set(from + w / 2, y, 0);
  const t = tag(n, 'idx', from + 0.45, y + 0.02, 0.5); return { m, t, kill() { kill(m); kill(t); } };
}
const npCard = (t, c, x, y, z = 0, drop = 0, w = 1.5) => cube(t, c, [w, 0.6, 0.8], x, y, z, drop);
const hold = (tok, ms = 2600) => beat(tok, ms);

// ════════ moPtwq_cVH8（MIT 6.006 L23：Computational Complexity） ════════
// 01:09 P、EXP、R 三個類別（Rec23 00:22 從右往左講：Halting、R、chess）
FRAG.push(['np2-axis', '難度軸：P、EXP、R 與無解問題', async (tok) => {
  const rec = !!(ctx.params || {}).rec;
  fresh([0, 4.6, 12.5], [0.2, 1.3, 0]);
  npAxis([]);
  say('一條難度軸：左邊簡單、右邊難', 'computational difficulty（示意圖）');
  await beat(tok, 2400);
  if (!rec) {
    npNotch('P'); npBand('P', 0.55);
    say('P：多項式時間可解的問題', 'P = { 決策問題 | 有 O(n^c) 演算法 }'); await beat(tok, 2800);
    npNotch('EXP'); npBand('EXP', 1.1);
    say('EXP：指數時間可解', '時間 2^(n^c)：2ⁿ、2^(n²)、2^(n³) 都算'); await beat(tok, 2800);
    say('P 的問題當然也在 EXP', 'P ⊆ EXP'); await beat(tok, 2200);
    npNotch('R'); npBand('R', 1.65);
    say('R：有限時間內可解', 'R = recursive ＝ computable（可計算）'); await beat(tok, 2800);
    const q = npCard('無解', NC.BAD, 5.9, 0.6, 0, 3, 1.1);
    say('R 之外：根本解不了的問題', '而且「大部分」問題都在這裡'); await beat(tok, 2400);
    glow(q, RED); await beat(tok, 1200);
    tag('?', 'ptr alt', NX.NP, 0.45);
    say('中間之後還要補一個刻度', '就是 NP'); await hold(tok, 2800);
  } else {
    const h = npCard('Halting', NC.BAD, 5.9, 0.6, 0, 4, 1.3);
    say('最難的：Halting problem', '輸入一個程式，判斷它會不會停'); await beat(tok, 2800);
    glow(h, RED);
    say('多少時間、電腦、錢都解不了', 'undecidable（不可判定），已被證明'); await beat(tok, 2800);
    const c = code(['while True:', '    pass   # 沒有 break'], -3.2, 3.6);
    say('有些特例很好判斷', '但「對所有程式都對」的演算法不存在'); await beat(tok, 2600);
    c.kill();
    npNotch('R'); npBand('R', 1.65);
    say('R：decidable，有限時間一定算完', 'R 來自 recursive（1930–40 年代用語）'); await beat(tok, 3000);
    npNotch('EXP');
    const ch = npCard('Chess', NC.EXP, NX.EXP - 0.1, 0.6, 0, 3, 1.2);
    say('chess 還在 R 裡面', '能算完，只是要指數時間'); await beat(tok, 2600);
    glow(ch, GOLD);
    say('我們在乎的問題幾乎都在 R 裡', '接著往左看：EXP、NP、P'); await hold(tok, 2800);
  }
}]);

// 05:27 例子：負權環、n×n chess、Go、Tetris、Halting
FRAG.push(['np2-examples', '把問題放上難度軸', async (tok) => {
  fresh([0, 4.6, 12.5], [0.2, 1.3, 0]);
  npAxis(['P', 'EXP', 'R']); npBand('P', 0.45); npBand('EXP', 0.95); npBand('R', 1.45);
  say('先看幾個例子放在哪裡', '都是 YES／NO 的決策問題'); await beat(tok, 2000);
  const nc = npCard('負權環', NC.P, -5.0, 2.3, 0, 3, 1.3);
  say('負權環偵測：在 P', 'Bellman-Ford，O(VE)'); await beat(tok, 2600);
  say('在 P 就一定也在 EXP', '多項式時間 ≤ 指數時間'); await beat(tok, 2000);
  const ch = npCard('n×n Chess', NC.EXP, NX.EXP - 0.3, 2.3, 0, 3, 1.6);
  say('n×n 西洋棋：現在這盤誰會贏？', '窮舉所有走法 → 在 EXP'); await beat(tok, 2600);
  glow(ch, RED);
  say('已證明：chess 不在 P', '沒有多項式時間演算法'); await beat(tok, 2400);
  npCard('Go', NC.EXP, NX.EXP - 0.3, 3.1, 0, 3, 0.9);
  say('圍棋（Go）也一樣', '在 EXP，不在 P'); await beat(tok, 2000);
  const tt = npCard('Tetris', NC.NP, NX.NP, 2.3, 0, 3, 1.3);
  const tq = tag('在 P 嗎？不知道', 'ptr alt', NX.NP, 3.1);
  say('Tetris：事先告訴你所有方塊', '在 EXP；在不在 P 還不知道'); await beat(tok, 3000);
  const hp = npCard('Halting', NC.BAD, 5.9, 2.3, 0, 3, 1.3);
  glow(hp, RED);
  say('Halting problem：程式會停嗎？', '不在 R：沒有演算法能對所有程式判斷'); await beat(tok, 3000);
  say('直接執行要等無限久', '有限時間內無解'); await hold(tok, 2600);
}]);

// 11:02 決策問題；程式 = 有限 bit 串 = 自然數
FRAG.push(['np2-programs-n', '程式 = 有限 bit 串 = 自然數', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  say('決策問題：答案只有 YES / NO', '負權環？白棋贏？Tetris 活得下？會停？');
  const y = npCard('YES', NC.P, -1.2, 3.6, 0, 3, 1.1), n = npCard('NO', NC.BAD, 1.2, 3.6, 0, 3, 1.1);
  await beat(tok, 3000);
  say('最佳化問題都能改寫成決策問題', '難度基本上一樣'); await beat(tok, 2400);
  kill(y); kill(n);
  const c = code(['def solve(x):', '    ...', '    return yes_or_no'], -3.6, 3.8);
  say('一支程式：就是一串字元', '存到電腦裡 → binary string'); await beat(tok, 2600);
  const bits = ['1', '0', '1', '1', '0'], bs = [];
  for (let i = 0; i < bits.length; i++) { bs.push(cube(bits[i], '#c9b48e', [0.7, 0.7, 0.7], 0.6 + i * 0.85, 1.0, 0, 3)); await beat(tok, 300); }
  arrow(V3(-1.2, 2.6, 0), V3(0.3, 1.4, 0));
  await beat(tok, 1600);
  say('binary string 也是一個二進位數', '10110₂ = 22');
  tag('= 22 ∈ ℕ', 'ptr alt', 5.6, 1.0); await beat(tok, 2600);
  say('所以每支程式 ↔ 一個自然數', 'programs ⊂ ℕ = {0, 1, 2, 3, …}'); await hold(tok, 3000);
  c.kill();
}]);

// 14:02 決策問題 = 無限 bit 串 = 實數；ℕ 可數、ℝ 不可數
FRAG.push(['np2-problems-r', '決策問題 = 無限 bit 串 = 實數', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 1.8, 0]);
  say('決策問題 = 函數：輸入 → {0, 1}', '輸入也是 binary string → 自然數');
  await beat(tok, 2600);
  const outs = ['0', '0', '1', '0', '1', '1'], X = (i) => -4.6 + i * 1.3, cs = [];
  for (let i = 0; i < outs.length; i++) {
    tag('輸入 ' + i, 'idx', X(i), 3.3);
    cs.push(cube(outs[i], outs[i] === '1' ? NC.P : '#c9b48e', [0.9, 0.7, 0.7], X(i), 2.4, 0, 3)); await beat(tok, 450);
  }
  tag('…', 'ptr', X(6), 2.4);
  say('把所有答案列成一張表', '每個輸入都要有答案 → 無限長的 bit 串'); await beat(tok, 2800);
  const pt = tag('.', 'ptr alt', X(0) - 0.75, 2.2);
  say('前面加一個 binary point', '.001011…₂ = 0 到 1 之間的實數'); await beat(tok, 2800);
  const pr = cube('programs：ℕ', '#c9b48e', [2.2, 0.6, 0.9], -3.6, 0.5, 0, 2);
  const pb = cube('problems：ℝ', NC.BAD, [4.6, 0.6, 0.9], 2.4, 0.5, 0, 2);
  say('程式是有限 bit 串；問題是無限 bit 串', 'ℕ 可數（countable），ℝ 不可數（uncountable）'); await beat(tok, 3200);
  say('每支程式只解一個問題', '程式根本不夠分'); glow(pb, RED); await beat(tok, 2600);
  say('幾乎所有決策問題都不可計算', '大部分問題都在 R 外面'); await hold(tok, 3000);
}]);

// 19:13 NP 定義一：lucky（nondeterministic）演算法
FRAG.push(['np2-lucky', 'NP：會「猜對」的 lucky 演算法', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 3.0, 0]);
  say('NP 不是 Not Polynomial', 'NP = Nondeterministic Polynomial'); await beat(tok, 2600);
  const C = '#c9b48e';
  const root = cube('開始', C, [1.0, 0.6, 0.6], 0, 5.4, 0);
  const L1 = [-3, 3].map((x) => cube('猜', C, [0.7, 0.6, 0.6], x, 4.0, 0)); L1.forEach((m) => line(0, 5.4, m.position.x, 4.0));
  const L2 = [-4.5, -1.5, 1.5, 4.5].map((x, i) => { line(L1[i >> 1].position.x, 4.0, x, 2.6); return cube('猜', C, [0.7, 0.6, 0.6], x, 2.6, 0); });
  say('每遇到岔路就「猜」一個選擇', '不是丟硬幣，是 nondeterministic 的猜'); await beat(tok, 2800);
  const vals = ['NO', 'NO', 'NO', 'YES', 'NO', 'YES', 'NO', 'NO'];
  const LV = vals.map((v, i) => { const x = -5.25 + i * 1.5; line(L2[i >> 1].position.x, 2.6, x, 1.1); return cube(v, v === 'YES' ? NC.P : NC.BAD, [0.9, 0.55, 0.6], x, 1.1, 0, 2); });
  say('最後輸出 YES 或 NO', '有些路通到 YES，有些通到 NO'); await beat(tok, 2600);
  for (const m of [...L1, ...L2]) glow(m, GOLD);
  say('DP 的猜：每個選項都試一遍', 'lucky 演算法只走一條路'); await beat(tok, 2600);
  for (const m of [...L1, ...L2]) glow(m, null);
  const cur = tag('▼ lucky', 'ptr alt', 0, 6.2);
  const path = [[0, 5.4], [-3, 4.0], [-1.5, 2.6], [-0.75, 1.1]];
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1], [bx, by] = path[k];
    await anim(tok, 900, (t) => cur.position.set(ax + (bx - ax) * t, ay + 0.8 + (by - ay) * t, 0));
  }
  glow(LV[3], GREEN);
  say('只要有 YES，猜測保證走到 YES', '這就是「lucky」'); await beat(tok, 2800);
  LV.forEach((m) => relabel(m, 'NO')); tint(LV[3], NC.BAD); tint(LV[5], NC.BAD); glow(LV[3], null);
  say('全部都是 NO：怎麼猜都輸出 NO', '不會亂說 YES'); await beat(tok, 2600);
  say('NP：lucky 演算法多項式時間可解', '不是真實電腦，是理論上的計算模型'); await hold(tok, 2800);
}]);

// 23:50 Tetris ∈ NP：每一步放哪、怎麼轉，都用猜的
FRAG.push(['np2-tetris-guess', 'Tetris 在 NP：每個方塊都用猜的', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.8, 0]);
  const CX = (c) => -2.5 + c, RY = (r) => 0.5 + r, S = [0.95, 0.95, 0.95];
  line(-3, 0, 3, 0, 0, NC.K); line(-3, 0, -3, 6.2, 0, NC.K); line(3, 0, 3, 6.2, 0, NC.K);
  line(-3, 6, 3, 6, 0, NC.BAD); tag('頂端', 'idx', 3.8, 6);
  const row0 = [0, 1, 2, 3].map((c) => cube(null, GRAY, S, CX(c), RY(0)));
  say('問題：給定盤面和之後所有方塊', '能不能活下來？（YES／NO）'); await beat(tok, 2800);
  const gh = [0, 2, 4].map((c) => { const g = ghostBox(NC.O, 1.9, 1.9, 0.95); g.position.set(CX(c) + 0.5, RY(4) + 0.5, 0); return g; });
  const qs = [0, 2, 4].map((c) => tag('?', 'ptr', CX(c) + 0.5, RY(5) + 0.4));
  say('O 方塊放哪一欄？不知道 → 猜', '位置 × 旋轉，選項有限'); await beat(tok, 2600);
  gh.forEach(kill); qs.forEach(kill);
  const O = [[4, 0], [5, 0], [4, 1], [5, 1]].map(([c, r]) => cube(null, NC.O, S, CX(c), RY(r), 0, 4));
  say('猜到右邊兩欄', '照 Tetris 規則讓它掉下來'); await beat(tok, 2200);
  const full = [...row0, O[0], O[1]]; full.forEach((m) => glow(m, GREEN));
  say('第 0 列滿了 → 消掉', '規則很好實作'); await beat(tok, 1800);
  full.forEach((m) => fly(m, V3(0, 9, 4))); move(O[2], CX(4), RY(0)); move(O[3], CX(5), RY(0));
  await beat(tok, 1600);
  const I = [0, 1, 2, 3].map((c) => cube(null, NC.NP, S, CX(c), RY(0), 0, 5));
  say('I 方塊也用猜的：橫放在左邊', '每個方塊只要猜多項式個選擇'); await beat(tok, 2400);
  [...I, O[2], O[3]].forEach((m) => glow(m, GREEN)); await beat(tok, 900);
  [...I, O[2], O[3]].forEach((m) => fly(m, V3(0, 9, 4)));
  say('最後檢查：有沒有超過頂端？', '沒有 → 活下來 → YES'); await beat(tok, 2600);
  say('所以「能不能活下來」∈ NP', '多項式個猜測 + 多項式時間模擬'); await beat(tok, 2600);
  say('若改問「會不會死」就不對了', 'lucky 會去找死法；YES 的方向要設對'); await hold(tok, 3000);
}]);

// 25:56 NP 定義二：YES 時有證明，驗證是多項式時間
FRAG.push(['np2-tetris-check', 'NP：證明可以在多項式時間檢查', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.4, 0]);
  say('NP 的另一種說法', '答案是 YES 時能寫出證明，且證明可在多項式時間檢查'); await beat(tok, 3000);
  const pv = npCard('Prover', NC.O, -4.8, 1.0, 0, 3, 1.6), vf = npCard('Verifier', NC.NP, 4.6, 1.0, 0, 3, 1.6);
  tag('證明者', 'idx', -4.8, 0.2); tag('檢查者（多項式時間）', 'idx', 4.6, 0.2);
  say('想成兩個人的遊戲', '一個想說服，一個要被說服'); await beat(tok, 2600);
  const em = tag('“I am NP-complete”', 'ptr', -4.6, 2.6);
  say('有人寄信給老師：', '「I am NP-complete」—— 這句話沒有意義'); await beat(tok, 2800);
  txt(em, '“I am lucky”');
  say('他想說的其實是：I am lucky', '那要怎麼證明？'); await beat(tok, 2600);
  const mv = ['O → 第 4 欄', 'I → 第 0 欄', '…'].map((t, i) => cube(t, '#c9b48e', [1.7, 0.5, 0.7], -4.8, 1.9 + i * 0.6, 0, 2));
  say('證明 = 一串移動', '每個方塊放哪、怎麼轉'); await beat(tok, 2400);
  mv.forEach((m, i) => move(m, -0.6, 3.6 - i * 0.6));
  await beat(tok, 1600);
  const c = code(['for move in proof:', '  照規則掉落、消行', '  if 超過頂端: NO', 'return YES'], 2.4, 4.6, 0.5);
  for (let i = 0; i < 4; i++) { c.hl(i); await beat(tok, 700); }
  glow(vf, GREEN);
  say('檢查者只要實作 Tetris 規則', '規則簡單；難的是知道怎麼走'); await beat(tok, 2600);
  say('找證明可以花任意久', '只有「檢查」必須是多項式時間'); await hold(tok, 3000);
  c.kill();
}]);

// 30:46 P ⊆ NP，P = NP？
FRAG.push(['np2-p-vs-np', 'P ⊆ NP，P = NP 嗎？', async (tok) => {
  fresh([0, 4.0, 12], [0, 2.0, 0]);
  say('能解就能檢查：P ⊆ NP', '自己解一遍，看答案一不一樣'); await beat(tok, 2600);
  const a = ghostBox(NC.NP, 3.4, 2.4, 0.3); a.position.set(-3.6, 2.2, 0);
  const a2 = ghostBox(NC.P, 3.4, 2.4, 0.32); a2.position.set(-3.6, 2.2, 0);
  tag('P = NP ？', 'ptr', -3.6, 2.2);
  const b = ghostBox(NC.NP, 4.4, 3.0, 0.3); b.position.set(3.2, 2.2, 0);
  const b2 = ghostBox(NC.P, 1.8, 1.6, 0.34); b2.position.set(2.0, 2.0, 0);
  tag('NP', 'ptr', 4.6, 3.3); tag('P', 'ptr', 2.0, 2.0);
  say('大問題：P = NP？', 'Millennium Prize：一百萬美元'); await beat(tok, 3000);
  const t = npCard('NP − P', NC.BAD, 4.2, 1.6, 0, 3, 1.4);
  say('大多數人相信 P ≠ NP', '有些問題在 NP 但不在 P'); await beat(tok, 2800);
  say('NP 是魔法電腦：每次都猜對', '直覺上比 P 強，但沒人證得出來'); await beat(tok, 2800);
  say('老師的說法一：運氣造不出來', 'P ≠ NP ⇔ you can\'t engineer luck'); await beat(tok, 2800);
  say('說法二：解題比檢查難', '產生證明可能比檢查證明難'); await beat(tok, 2800);
  say('證定理要靈感 = 運氣 = 猜', '檢查證明只要逐步核對'); await hold(tok, 3000);
  glow(t, RED);
}]);

// 34:48 NP-hard、NP-complete：Tetris 落在 NP 刻度上
FRAG.push(['np2-hard-complete', 'NP-hard 與 NP-complete：Tetris 的位置', async (tok) => {
  fresh([0, 4.6, 12.5], [0.2, 1.4, 0]);
  const ns = npAxis(['P', 'NP', 'EXP', 'R']); const bp = npBand('P', 0.45); const bn = npBand('NP', 0.95);
  const tt = npCard('Tetris', NC.NP, NX.NP + 1.0, 2.6, 0, 3, 1.3);
  say('猜：Tetris ∈ NP − P', '但 NP − P 也可能是空集合'); await beat(tok, 2800);
  say('NP − P 若非空，Tetris 一定在裡面', '因為 Tetris 是 NP-hard'); await beat(tok, 2800);
  const hw = 6.2 - NX.NP, hard = ghostBox(NC.BAD, hw, 0.34, 0.9); hard.position.set(NX.NP + hw / 2, 1.5, 0);
  tag('NP-hard →', 'idx', NX.NP + 1.2, 1.5, 0.5);
  say('NP-hard：至少和 NP 每個問題一樣難', '從 NP 刻度往右都是（不是嚴格「更難」）'); await beat(tok, 3200);
  move(tt, NX.NP, 2.0); glow(tt, GOLD);
  const nc = tag('NP-complete', 'ptr alt', NX.NP, 2.8);
  say('NP-complete = NP ∩ NP-hard', 'Tetris ∈ NP 又 NP-hard → 剛好在刻度上'); await beat(tok, 3200);
  await anim(tok, 1200, (t) => { ns.P.l.position.x = (NX.NP - NX.P) * t; ns.P.t.position.x = NX.P + (NX.NP - NX.P) * t; });
  say('情況一：P = NP', 'Tetris 仍在最右端，但也在 P 裡'); await beat(tok, 2800);
  await anim(tok, 1200, (t) => { ns.P.l.position.x = (NX.NP - NX.P) * (1 - t); ns.P.t.position.x = NX.NP - (NX.NP - NX.P) * t; });
  glow(tt, RED);
  say('情況二：P ≠ NP', '最右端在 P 外 → Tetris ∉ P'); await beat(tok, 2800);
  say('complete：知道它在軸上的確切位置', 'X-complete = X ∩ X-hard'); await hold(tok, 2800);
}]);

// 39:13 EXP-complete：chess
FRAG.push(['np2-exp-chess', 'Chess 是 EXP-complete', async (tok) => {
  fresh([0, 4.6, 12.5], [0.2, 1.4, 0]);
  npAxis(['P', 'NP', 'EXP', 'R']); npBand('P', 0.45); npBand('NP', 0.95); npBand('EXP', 1.45);
  say('同樣的想法用在 EXP', 'EXP-complete = EXP ∩ EXP-hard'); await beat(tok, 2600);
  const hw = 6.2 - NX.EXP, hard = ghostBox(NC.BAD, hw, 0.34, 0.9); hard.position.set(NX.EXP + hw / 2, 1.95, 0);
  tag('EXP-hard →', 'idx', NX.EXP + 1.3, 1.95, 0.5);
  say('EXP-hard：從 EXP 刻度往右', '至少和 EXP 每個問題一樣難'); await beat(tok, 2600);
  const ch = npCard('Chess', NC.EXP, NX.EXP, 2.8, 0, 3, 1.2);
  say('chess 剛好在 EXP 刻度上', 'n×n chess 是 EXP-complete'); await beat(tok, 2800);
  const ne = tag('P ≠ EXP（已證明）', 'ptr', (NX.P + NX.EXP) / 2, 3.6);
  say('P ≠ EXP 很容易證明', '所以 EXP 最右端一定不在 P'); await beat(tok, 2800);
  glow(ch, RED);
  say('chess 在 EXP 最右端 → chess ∉ P', '這是目前證明它不在 P 的唯一方法'); await beat(tok, 3000);
  const q = tag('NP = EXP ？', 'ptr alt', (NX.NP + NX.EXP) / 2, 2.6);
  say('P = NP？NP = EXP？都還不知道', '只有 P 和 EXP 確定不同'); await hold(tok, 3000);
}]);

// 40:35 Reduction：把 A 轉成會解的 B（params.part 0：定義 + 無權重；1：更多例子）
FRAG.push(['np2-reduce', 'Reduction：把問題 A 轉成會解的 B', async (tok) => {
  const part = ((ctx.params || {}).part) | 0;
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  const A = npCard('問題 A', NC.O, -4.6, 1.2, 0, 3, 2.2), B = npCard('問題 B', NC.P, 0.6, 1.2, 0, 3, 2.2);
  const S = npCard('已知演算法', NC.NP, 4.9, 1.2, 0, 3, 1.9);
  arrow(V3(-3.4, 1.2, 0), V3(-0.6, 1.2, 0)); arrow(V3(1.8, 1.2, 0), V3(3.9, 1.2, 0));
  const f = tag('轉換', 'ptr alt', -2.0, 2.0);
  const sets = part === 1
    ? [['最小化權重乘積', '取 log：乘積 → 和', '最短路徑（和）', 'Dijkstra／Bellman-Ford', 'Pset 6：不用改 relax 的程式'],
      ['最長路徑', '權重全部取負號', '最短路徑', 'Bellman-Ford', 'Quiz 2 的是非題'],
      ['依序拜訪幾個點', '把圖複製成多層', '一次最短路徑查詢', 'Dijkstra', 'graph replication'],
      ['漏油的油箱', '把油量放進圖的狀態', '最短路徑', 'Dijkstra', '改一下圖就好']]
    : [['無權重最短路徑', '每條邊權重設 1', '有權重最短路徑', 'Dijkstra', '手上只有 Dijkstra 的程式碼']];
  if (part === 0) {
    say('Reduction：把 A 轉成已經會解的 B', '解 B → 就解了 A'); await beat(tok, 3000);
    say('這是最常用的設計演算法技巧', '重用以前寫好的演算法'); await beat(tok, 2600);
  } else { say('更多我們已經做過的 reduction', '本課 graph reduction 用得最多'); await beat(tok, 2400); }
  for (const [a, t, b, s, note] of sets) {
    relabel(A, a); txt(f, t); relabel(B, b); relabel(S, s);
    glow(A, GOLD); say(a + ' → ' + b, t + '（' + note + '）'); await beat(tok, 1600);
    glow(A, null); glow(B, GREEN); await beat(tok, 1600); glow(B, null);
    glow(S, GREEN); await beat(tok, 1000); glow(S, null);
  }
  if (part === 0) {
    txt(f, '權重設 0？');
    say('權重設 0 不行', '所有路徑都變 0，分不出長短'); glow(B, RED); await beat(tok, 2600);
    glow(B, null); txt(f, '權重設 2 也可以');
    say('設 1、設 2 都可以，只要全部一致', '都是 reduction'); await hold(tok, 2800);
  } else {
    say('reduction 也能證明「某問題很難」', '例如 Tetris 是 NP-hard'); await hold(tok, 2800);
  }
}]);

// 46:28 3-Partition ≤ Tetris：B 至少和 A 一樣難
FRAG.push(['np2-3partition', '3-Partition → Tetris：證明 Tetris 很難', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.0, 0]);
  const nums = [2, 3, 7, 4, 4, 4, 1, 5, 6], X = (i) => -5.2 + i * 1.3;
  const cs = nums.map((v, i) => cube(v, '#c9b48e', [0.8, 0.8, 0.8], X(i), 3.8, 0, 3));
  say('3-Partition：n 個數分成 n/3 組三個', '每組和都相等（例子是自建的）'); await beat(tok, 3000);
  say('9 個數，總和 36', '分 3 組，每組要等於 12'); await beat(tok, 2400);
  const groups = [[0, 1, 2], [3, 4, 5], [6, 7, 8]], col = [NC.P, NC.NP, NC.O];
  for (let g = 0; g < 3; g++) {
    groups[g].forEach((i, k) => { tint(cs[i], col[g]); move(cs[i], -4.2 + g * 4.2 + (k - 1) * 0.95, 2.4); });
    tag('= 12', 'ptr', -4.2 + g * 4.2, 1.6);
    say('第 ' + (g + 1) + ' 組：' + groups[g].map((i) => nums[i]).join(' + ') + ' = 12', 'YES 的證明就是這個分組');
    await beat(tok, 1500);
  }
  say('Karp 早就證明它是 NP-complete', '站在巨人的肩膀上'); await beat(tok, 2600);
  const A = npCard('3-Partition', NC.O, -3.0, 0.5, 2, 2, 2.0), B = npCard('Tetris', NC.NP, 3.0, 0.5, 2, 2, 1.6);
  arrow(V3(-1.8, 0.5, 2), V3(2.0, 0.5, 2)); tag('reduce', 'ptr alt', 0, 1.1, 2);
  say('把 3-Partition 歸約成 Tetris', 'A 能歸約到 B ⇒ B 至少和 A 一樣難'); await beat(tok, 3200);
  say('若 Tetris ∈ P，3-Partition 也 ∈ P', '先轉換，再用 Tetris 的解法'); glow(B, GOLD); await beat(tok, 3000);
  say('證 NP-hard：拿已知 NPC 歸約過來', '方向：已知難的 → 你的問題'); glow(A, RED); await hold(tok, 3000);
}]);

// 49:12 更多 NP-complete 問題
FRAG.push(['np2-npc-zoo', '更多 NP-complete 問題', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 2.2, 0]);
  say('再看幾個 NP-complete 問題', '都能互相歸約'); await beat(tok, 2000);
  const items = [
    ['TSP', '拜訪所有頂點的最短路線', '不是只到一個點'],
    ['n 個字串的 LCS', '兩個字串是 DP 多項式', 'n 個字串就是 NPC'],
    ['Minesweeper / Sudoku', '有趣的謎題大多 NPC', ''],
    ['SAT', '有沒有賦值讓布林式為真', '例：x ∨ y ∧ ¬x；第一個被證明的 NPC'],
    ['3-Coloring', '圖能不能用 3 色著色', ''],
    ['3D 最短路徑', '2D 平面是多項式', '3D 空間（會飛）就 NPC'],
    ['Knapsack', '只有 pseudo-polynomial 解', '除非 P = NP，否則沒辦法更好'],
  ];
  const pos = (i) => [-4.5 + (i % 4) * 3.0, i < 4 ? 3.6 : 1.6];
  for (let i = 0; i < items.length; i++) {
    const [n, a, b] = items[i], [x, y] = pos(i);
    const m = npCard(n, i === 3 ? NC.O : NC.BAD, x, y, 0, 3, 2.6);
    glow(m, GOLD); say(n + ' 是 NP-complete', a + (b ? '；' + b : '')); await beat(tok, 2500); glow(m, null);
  }
  say('這就是 50 分鐘的計算複雜度', 'P ⊆ NP ⊆ EXP ⊆ R'); await hold(tok, 2800);
}]);

// ════════ t5Wxk96QjUk（MIT 6.006 Rec23：Computational Complexity） ════════
// 04:10 EXP 與 P：輸入加倍時的差別
FRAG.push(['np2-doubling', '輸入加倍：多項式乘常數，指數變平方', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  say('EXP：T(n) = O(2^(n^c))', '已經指數了，前面是 n 還是 n¹⁰⁰ 沒差'); await beat(tok, 3000);
  say('NP = Nondeterministic Polynomial', '等一下再解釋'); await beat(tok, 2200);
  say('P：T(n) = O(n^c)', '這學期幾乎都是（knapsack 例外）'); await beat(tok, 2600);
  line(-6, 0, 6, 0, 0, NC.K); tag('高度 = log₁₀(步數)', 'idx', 4.4, 6.6);
  const bar = (v, h, c, x) => cube(v, c, [1.2, h, 0.8], x, h / 2, 0, 0);
  bar('1000', 3.0, NC.P, -4.6); tag('n³, n=10', 'idx', -4.6, -0.5);
  await beat(tok, 900);
  const b2 = bar('8000', 3.9, NC.P, -2.6); tag('n³, n=20', 'idx', -2.6, -0.5);
  say('多項式：n 加倍，時間只乘 2^c', 'n³：1000 → 8000（× 2³ = 8）'); await beat(tok, 3000);
  bar('1024', 3.0, NC.BAD, 2.2); tag('2ⁿ, n=10', 'idx', 2.2, -0.5);
  await beat(tok, 900);
  const b4 = bar('1048576', 6.0, NC.BAD, 4.4); tag('2ⁿ, n=20', 'idx', 4.4, -0.5);
  glow(b4, RED);
  say('指數：n 加倍，時間變平方', '2ⁿ：1024 → 1024² = 1048576'); await beat(tok, 3200);
  say('所以我們喜歡多項式', '加倍只多常數倍'); await hold(tok, 2600);
}]);

// 07:33 NP：有多項式時間的 verifier
FRAG.push(['np2-verifier', 'NP：多項式時間的 verifier', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  const x = npCard('輸入 x', NC.O, -4.8, 2.6, 0, 3, 1.6), y = npCard('解 / proof', '#c9b48e', -4.8, 0.8, 0, 3, 1.6);
  const V = cube('Verifier', NC.NP, [2.0, 1.4, 1.0], 0, 1.7, 0, 3);
  arrow(V3(-3.9, 2.5, 0), V3(-1.1, 2.0, 0)); arrow(V3(-3.9, 0.9, 0), V3(-1.1, 1.4, 0));
  say('NP：能寫出一個 verifier', '輸入 + 解 → 對／錯'); await beat(tok, 2800);
  tag('∈ P', 'ptr alt', 0, 2.9);
  say('而且 verifier 是多項式時間', 'V(x, y) ∈ P'); await beat(tok, 2600);
  relabel(x, '3SAT 公式');
  say('例：3SAT，說「YES」沒有意義', '要拿出東西說服 verifier'); await beat(tok, 2800);
  relabel(y, 'x1=1 x2=0 …'); move(y, -2.0, 1.2);
  say('給出變數賦值', 'verifier 代進去，多項式時間檢查'); await beat(tok, 2600);
  move(y, 0, 1.7); await beat(tok, 900); kill(y);
  const ok = npCard('✓ 正確', NC.P, 4.6, 1.7, 0, 0, 1.4); arrow(V3(1.1, 1.7, 0), V3(3.8, 1.7, 0));
  glow(V, GREEN);
  say('verifier 收的不只是 YES 一個 bit', '而是一份解（proof）'); await beat(tok, 2800);
  say('解的大小也必須是多項式', '不然 verifier 讀都讀不完'); await hold(tok, 3000);
}]);

// 10:50 nondeterministic = 丟硬幣永遠丟對
FRAG.push(['np2-coin-proof', '丟硬幣產生 proof：永遠丟對的機器', async (tok) => {
  fresh([0, 4.2, 12], [0, 2.0, 0]);
  const V = cube('Verifier', NC.NP, [2.0, 1.2, 1.0], 4.6, 1.6, 0);
  say('proof 長度是多項式', '那就用丟硬幣把每個 bit 丟出來'); await beat(tok, 2800);
  const tries = [['1', '0', '0', '1', '1', '0'], ['0', '1', '1', '0', '0', '0'], ['1', '1', '0', '1', '0', '1']];
  const X = (i) => -5.2 + i * 1.0;
  const cs = tries[0].map((b, i) => cube('?', '#c9b48e', [0.75, 0.75, 0.75], X(i), 1.6, 0, 3));
  for (let k = 0; k < tries.length; k++) {
    for (let s = 0; s < 4; s++) { cs.forEach((m) => relabel(m, Math.random() < 0.5 ? '0' : '1')); await beat(tok, 150); }
    cs.forEach((m, i) => relabel(m, tries[k][i]));
    const good = k === 2;
    glow(V, good ? GREEN : RED);
    say(good ? '幸運：剛好丟出正確的 proof' : '第 ' + (k + 1) + ' 次：verifier 不接受', good ? 'verifier 接受 → YES' : '機率幾乎是 0');
    await beat(tok, 2200); glow(V, null);
  }
  glow(V, GREEN);
  say('魔法機器：丟硬幣永遠丟對', '多項式時間就產生 proof'); await beat(tok, 2800);
  say('這就是 Nondeterministic Polynomial', '真實電腦做不到，是概念上的機器'); await hold(tok, 2800);
}]);

// 11:57 P vs NP 未解；常識論證：RSA 的金鑰（toy 數字 61 × 53 = 3233 是補充的例子）
FRAG.push(['np2-rsa-key', 'RSA：公開 N = p × q，p、q 是祕密', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  say('P = NP？沒人能證明', '證出任一邊都值一百萬美元'); await beat(tok, 2600);
  say('常識論證：如果你能冒充銀行……', '銀行之間用網路轉帳'); await beat(tok, 2600);
  const bank = npCard('銀行', NC.NP, -4.6, 1.0, 0, 3, 1.4);
  const lock = ghostBox(NC.BAD, 3.2, 1.6, 1.2); lock.position.set(-1.0, 1.0, 0); tag('私鑰（祕密）', 'idx', -1.0, 2.1);
  const p = cube('p = 61', NC.O, [1.3, 0.6, 0.8], -1.8, 0.8, 0, 3), q = cube('q = 53', NC.O, [1.3, 0.6, 0.8], -0.2, 0.8, 0, 3);
  say('RSA：私鑰是兩個大質數 p、q', '每個都是 n bits（這裡用小數字示範）'); await beat(tok, 3000);
  const N = cube('N = 3233', NC.P, [1.8, 0.7, 0.9], 4.0, 1.0, 0, 3);
  arrow(V3(0.7, 1.0, 0), V3(3.0, 1.0, 0)); tag('p × q', 'ptr', 1.8, 1.6);
  say('公開金鑰：N = p × q', '全世界都看得到，別人才能加密給你'); await beat(tok, 3000);
  glow(p, GOLD); glow(q, GOLD);
  say('知道 p、q 就能解密', '→ 冒充銀行'); await beat(tok, 2600);
  say('問題：只看 N，找得出 p 嗎？', '這叫 factoring（因數分解）'); await hold(tok, 3000);
}]);

// 15:06 Verifier：N mod p_guess == 0
FRAG.push(['np2-rsa-verify', 'Factoring 的 verifier：N mod p = 0？', async (tok) => {
  fresh([0, 4.2, 12], [0, 1.8, 0]);
  const N = cube('N = 3233', NC.P, [1.8, 0.7, 0.9], -4.6, 2.6, 0, 3);
  const V = cube('N mod p_guess', NC.NP, [2.4, 1.0, 1.0], 0.6, 1.6, 0, 3);
  const out = tag('', 'ptr alt', 4.6, 2.6);
  say('Verifier：輸入 N 和猜的 p', '做長除法：多項式時間'); await beat(tok, 2800);
  const gs = [[47, 37], [59, 47], [53, 0]];
  for (const [g, r] of gs) {
    const c = cube('p = ' + g, '#c9b48e', [1.3, 0.6, 0.8], -4.6, 1.0, 0, 3);
    await beat(tok, 700); move(c, -1.6, 1.6); await beat(tok, 900);
    txt(out, '3233 mod ' + g + ' = ' + r);
    glow(V, r === 0 ? GREEN : RED);
    say(r === 0 ? '餘數 0：verifier 開心！' : '餘數 ' + r + '：再猜', r === 0 ? '3233 = 53 × 61 → 拿到私鑰' : 'tough luck, try again');
    await beat(tok, 2000); glow(V, null);
    if (r !== 0) fly(c, V3(0, 8, 4));
  }
  say('真實 RSA：p、N 大約 1024 bits', '亂猜成功機率 1 / 2¹⁰²⁴'); await beat(tok, 3000);
  say('能讓 verifier 開心的演算法 → 致富', '也會讓全世界金融系統崩潰'); await beat(tok, 2800);
  say('世界還在正常運作', '→ 沒人能多項式時間解 NP 問題（常識，非證明）'); await beat(tok, 3000);
  say('量子電腦會打破這個假設', '這裡假設一般 Turing machine'); await hold(tok, 2600);
}]);

// 18:13 factoring 不是最難的；NP-complete = NP 裡最難、彼此可歸約
FRAG.push(['np2-npc-hub', 'NP-complete：最難的 NP 問題互相歸約', async (tok) => {
  fresh([0, 4.4, 12], [0, 1.8, 0]);
  const np = ghostBox(NC.NP, 12.4, 4.4, 0.3); np.position.set(0, 2.2, -0.4); tag('NP', 'ptr', -5.8, 4.2);
  const pp = ghostBox(NC.P, 3.2, 3.4, 0.34); pp.position.set(-4.4, 2.0, -0.3); tag('P', 'ptr', -4.4, 3.4);
  const fx = npCard('Factoring', NC.O, -1.2, 2.2, 0, 3, 1.6);
  say('Factoring 在 NP', '但不是最難的那一種'); await beat(tok, 2800);
  say('剛才只是常識論證，不是數學證明', '40 多年證不出 P ≠ NP'); await beat(tok, 2800);
  const names = ['3SAT', 'Knapsack', 'Clique', 'TSP', 'Ham-Cycle', '3-Color'];
  const cx = 3.4, cy = 2.2, R = 1.6;
  const at = (i) => [cx + R * Math.cos(i * Math.PI / 3), cy + R * 0.85 * Math.sin(i * Math.PI / 3)];
  const ns = names.map((n, i) => { const [x, y] = at(i); return cube(n, NC.BAD, [1.3, 0.5, 0.6], x, y, 0, 3); });
  tag('NP-complete', 'ptr alt', cx, 4.2);
  say('找出最難的 NP 問題：NP-complete', '有好幾百個，很多有實際用途'); await beat(tok, 3000);
  const ars = [];
  for (let i = 0; i < names.length; i++) {
    const [ax, ay] = at(i), [bx, by] = at((i + 1) % names.length);
    ars.push(arrow(V3(ax + (bx - ax) * 0.25, ay + (by - ay) * 0.25, 0.4), V3(ax + (bx - ax) * 0.75, ay + (by - ay) * 0.75, 0.4)));
    await beat(tok, 350);
  }
  say('它們全部互相關聯', '透過 reduction 互相轉換'); await beat(tok, 2600);
  glow(ns[0], GREEN);
  say('如果解出其中一個……', '其他全部轉過來用同一個解法'); await beat(tok, 2200);
  ns.forEach((m) => glow(m, GREEN));
  say('解一個 = 解全部', '沒人解出任何一個 → 它們應該真的很難'); await hold(tok, 3000);
}]);

// 22:40 chess：指數在什麼上？
FRAG.push(['np2-rec-chess', 'Chess：指數時間，改進常數也沒用', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 3.0, 0]);
  say('Chess：給一個盤面，能不能贏？', '有這個演算法，每步都走到「能贏」的盤面'); await beat(tok, 3000);
  say('在 EXP：指數在盤面配置的數量', '配置太多，電腦跑不完'); await beat(tok, 2800);
  const d = tag('Deep Blue：只搜約 15 層', 'ptr', -3.2, 5.6);
  say('Deep Blue 只往下搜十幾層', '能跟人比，但不保證贏'); await beat(tok, 2600);
  line(-6, 0, 6, 0, 0, NC.K); line(-6, 5.0, 6, 5.0, 0, NC.BAD); tag('世界末日之前', 'idx', 4.8, 5.3);
  const rows = [['2^(n)', 1.0, NC.BAD], ['2^(n/2)', 0.5, NC.O], ['2^(n/4)', 0.25, NC.EXP]];
  const bars = rows.map(([t, c, col], i) => cube(t, col, [1.4, 0.1, 0.8], -3.6 + i * 3.6, 0.05, 0));
  say('聰明的演算法只把 c 變小', 'T(n) = 2^(cn)');
  await anim(tok, 2200, (t) => bars.forEach((b, i) => { const h = 0.1 + Math.min(6.4, 9 * rows[i][1] * t + 0.2); b.scale.y = h / 0.1; b.position.y = h / 2; }));
  say('n 一變大，全部都衝過那條線', '只是延後一點，擺脫不了 2ⁿ'); await beat(tok, 3000);
  say('只有 P 以內才算「scale 得起來」', '小 n 能跑，大 n 就撞牆'); await hold(tok, 2800);
}]);

// 27:03 NP-complete 在實務上：reduction 的地圖與地雷
FRAG.push(['np2-landmines', '解題地圖：笑臉終點與 NPC 地雷', async (tok) => {
  fresh([0, 11.5, 6.5], [0, 0, 0.3]);
  const P = { S: [-6, 0], A1: [-3, -3], A2: [-3, 0], A3: [-3, 3], B1: [0, -1.5], B2: [0, 1.5], C1: [0.4, 4.4],
    D1: [5, -4.4], D2: [5, -2.2], D3: [5, 0], D4: [5, 2.2], L: [3, 4.4] };
  const nd = {};
  const mk = (k, t, c, w = 1.2) => { const [x, z] = P[k]; nd[k] = cube(t, c, [w, 0.5, 0.8], x, 0.3, z, 2); };
  mk('S', '你的題目', NC.O, 1.6);
  say('考試／面試：從你的題目出發', '把所有問題想成一張圖'); await beat(tok, 2600);
  mk('D1', '☺ Merge sort', NC.P, 1.8); mk('D2', '☺ BFS / DFS', NC.P, 1.8); mk('D3', '☺ 最短路徑', NC.P, 1.8); mk('D4', '☺ DP', NC.P, 1.8);
  say('笑臉：已經會解的問題', 'sorting、graph search、最短路徑、DP…'); await beat(tok, 2800);
  ['A1', 'A2', 'A3'].forEach((k) => mk(k, '?', '#c9b48e', 0.8));
  const ar = (a, b) => { const [ax, az] = P[a], [bx, bz] = P[b]; const d = Math.hypot(bx - ax, bz - az); return arrow(V3(ax + (bx - ax) * 0.7 / d, 0.4, az + (bz - az) * 0.7 / d), V3(bx - (bx - ax) * 0.9 / d, 0.4, bz - (bz - az) * 0.9 / d), 0x6a4a00); };
  ['A1', 'A2', 'A3'].forEach((k) => ar('S', k));
  say('看到三種可能的 reduction', '沒時間全試，先挑看起來最簡單的'); await beat(tok, 2800);
  glow(nd.A2, GOLD); mk('B1', '?', '#c9b48e', 0.8); mk('B2', '?', '#c9b48e', 0.8); ar('A2', 'B1'); ar('A2', 'B2');
  say('又能再轉成幾個問題', '挑一個有希望的'); await beat(tok, 2400);
  glow(nd.B1, GOLD); ar('B1', 'D3'); glow(nd.D3, GREEN);
  say('reduction、reduction、reduction', '到達笑臉 → 寫下來，交卷'); await beat(tok, 2800);
  glow(nd.A2, null); glow(nd.B1, null); glow(nd.D3, null);
  glow(nd.A3, GOLD); mk('C1', '?', '#c9b48e', 0.8); ar('A3', 'C1');
  say('另一條路：越走離笑臉越遠', '最後時間用完'); await beat(tok, 2600);
  mk('L', '✗ Knapsack', NC.BAD, 1.8); ar('C1', 'L'); glow(nd.L, RED);
  say('走到 NP-complete 問題 = 地雷', '「多項式時間解 knapsack」→ 立刻回頭'); await beat(tok, 3000);
  say('讀 CLRS 的 NPC 章：記住問題敘述', '知道哪裡不要去，搜尋範圍就小很多'); await hold(tok, 3000);
}]);

// 32:18 SAT、CNF、2SAT vs 3SAT（老師板書的式子）
FRAG.push(['np2-cnf', 'CNF 與 k-SAT：老師的例子', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.0, 0]);
  const F = [[1, -2], [1, 4], [-1, 4], [-3, 4], [2, 4]];
  const lit = (l) => (l > 0 ? 'x' + l : '¬x' + -l);
  const FS = F.map((c) => '(' + c.map(lit).join(' ∨ ') + ')').join(' ∧ ');
  say('SAT：找變數值讓式子為真', 'satisfiability'); await beat(tok, 2400);
  const CXp = (j) => -4.8 + j * 2.4, cubes = [];
  for (let j = 0; j < F.length; j++) {
    cubes.push(F[j].map((l, k) => cube(lit(l), '#c9b48e', [0.95, 0.6, 0.7], CXp(j) - 0.5 + k * 1.0, 2.6, 0, 3)));
    tag('子句 ' + (j + 1), 'idx', CXp(j), 1.9);
    if (j < F.length - 1) tag('∧', 'ptr', CXp(j) + 1.2, 2.6);
    await beat(tok, 450);
  }
  say('CNF：子句之間用 AND', '子句裡只有 OR 和 ¬　' + FS); await beat(tok, 3200);
  say('每個子句至少要有一個為真', '所有子句都要真'); await beat(tok, 2400);
  const vs = [1, 2, 3, 4].map((v, i) => cube('x' + v + ' = ?', NC.N, [1.4, 0.55, 0.7], -3.3 + i * 2.2, 0.5, 0));
  relabel(vs[3], 'x4 = T'); tint(vs[3], NC.P);
  F.forEach((c, j) => c.forEach((l, k) => { if (l === 4) glow(cubes[j][k], GREEN); }));
  say('令 x4 = T', '子句 2、3、4、5 都滿足了'); await beat(tok, 2800);
  relabel(vs[0], 'x1 = T'); tint(vs[0], NC.P); glow(cubes[0][0], GREEN);
  say('再令 x1 = T', '子句 1 (x1 ∨ ¬x2) 也滿足 → 整式為真'); await beat(tok, 2800);
  say('k = 每個子句最多幾個變數', '問題就叫 k-SAT'); await beat(tok, 2400);
  say('這例子每子句 2 個：2SAT', '2SAT 是多項式（線性時間）'); await beat(tok, 2600);
  say('3SAT：NP-complete', '任何 nSAT 都能歸約成 3SAT，大小不爆炸'); await hold(tok, 3000);
}]);

// 36:25 3SAT 是 NPC 的三分鐘證明：verifier → circuit → 布林式 → 3CNF
FRAG.push(['np2-verifier-circuit', 'Verifier → 電路 → 3CNF → 3SAT', async (tok) => {
  fresh([0, 4.4, 12.5], [0, 2.0, 0]);
  const st = [['Verifier', NC.NP], ['電路', NC.O], ['布林式', NC.EXP], ['3CNF', NC.R], ['3SAT', NC.BAD]];
  const X = (i) => -5.2 + i * 2.6, bs = [];
  say('3 分鐘證明：3SAT 是 NP-complete', '任何 NP 問題都有多項式時間的 verifier'); await beat(tok, 2800);
  const caps = [
    ['把 verifier 寫成電路', '電路大小 = 多項式（因為 verifier 是多項式時間）'],
    ['輸入寫死，proof bits 當電路輸入', '例：N 寫死在電路裡，p 的 bits 是輸入'],
    ['AND、OR、NOT 閘 → 布林式', '輸入 bit → 布林變數'],
    ['再把布林式轉成 3CNF', '每個子句 3 個文字'],
    ['丟給 3SAT', '能滿足 ⇔ 有讓 verifier 接受的 proof'],
  ];
  for (let i = 0; i < st.length; i++) {
    bs.push(cube(st[i][0], st[i][1], [1.8, 0.7, 0.9], X(i), 2.6, 0, 3));
    if (i) arrow(V3(X(i - 1) + 0.95, 2.6, 0), V3(X(i) - 0.95, 2.6, 0));
    if (i === 1) { const g = code(['N = 3233（寫死）', 'p bits → 輸入'], X(1), 1.6, 0.45); }
    say(caps[i][0], caps[i][1]); await beat(tok, 2600);
  }
  const ans = cube('賦值 = proof bits', NC.P, [2.6, 0.6, 0.9], 2.6, 0.3, 0, 3);
  arrow(V3(X(4), 2.1, 0), V3(3.6, 0.7, 0));
  say('3SAT 給出變數值 = proof 的 bits', '餵回 verifier → 接受 → 問題解決'); await beat(tok, 3000);
  relabel(ans, 'p 的 bits = 53'); glow(ans, GREEN);
  say('Factoring：解出的 bits 就是因數 p', '3SAT 夠快 → 能因數分解 N'); await hold(tok, 3000);
}]);

// 41:08 暴力 2ⁿ；2SAT vs 3SAT 天差地遠；SAT solver
FRAG.push(['np2-2sat-3sat', '2SAT 在 P、3SAT 是 NPC', async (tok) => {
  fresh([0, 4.6, 12.5], [0.2, 1.6, 0]);
  npAxis(['P', 'NP']); npBand('P', 0.45); npBand('NP', 0.95);
  say('暴力法：所有變數都試 T / F', 'n 個變數 → 2ⁿ 組，不是多項式'); await beat(tok, 2800);
  const a = npCard('2SAT', NC.P, NX.P - 1.0, 2.0, 0, 3, 1.2);
  say('2SAT：線性時間', '在 P 的很左邊'); await beat(tok, 2400);
  const b = npCard('3SAT', NC.BAD, NX.NP, 2.0, 0, 3, 1.2); glow(b, RED);
  say('3SAT：NP 最右端（NP-complete）', '子句只差一個變數，難度天差地遠'); await beat(tok, 3000);
  const t1 = tag('暴力：約 20 個變數就跑不動', 'ptr', 2.6, 3.4);
  say('暴力法大約 20 個變數就卡住', '2²⁰ ≈ 10⁶ 還行，再大就爆'); await beat(tok, 2800);
  const t2 = tag('SAT solver：1000–10000 個變數、幾小時', 'ptr alt', 2.6, 2.6);
  say('SAT solver：推論 + 聰明地搜尋', '可處理 1000–10000 個變數（幾小時）'); await beat(tok, 3000);
  say('但仍不是多項式', '1000-bit factoring 也還沒被破解'); await hold(tok, 2800);
}]);

// 45:25 graph transformation = reduction；小心輸入大小爆炸
FRAG.push(['np2-blowup', 'Reduction 不能讓輸入爆炸', async (tok) => {
  fresh([0, 5.0, 12.5], [0, 2.0, 0]);
  const A = npCard('原問題', NC.O, -4.8, 3.8, 0, 3, 1.6), G = npCard('建一張圖', NC.NP, -1.6, 3.8, 0, 3, 1.6);
  const D = npCard('最短路徑', NC.P, 1.6, 3.8, 0, 3, 1.6), S = npCard('原問題的解', NC.P, 4.8, 3.8, 0, 3, 1.6);
  [[-4.8, -1.6], [-1.6, 1.6], [1.6, 4.8]].forEach(([a, b]) => arrow(V3(a + 0.85, 3.8, 0), V3(b - 0.85, 3.8, 0)));
  say('graph transformation 就是 reduction', '建圖 → 跑最短路徑 → 轉回原問題的解'); await beat(tok, 3000);
  say('任何笑臉都可以當終點', '不一定要是最短路徑'); await beat(tok, 2400);
  relabel(A, '3CNF（n 子句）'); relabel(G, '3ⁿ 個頂點'); relabel(D, 'Dijkstra');
  say('但要小心輸入大小', '例：3CNF → 有 3ⁿ 個頂點的圖'); await beat(tok, 2600);
  const cs = []; let shown = 0;
  for (const n of [1, 2, 3]) {
    const cnt = 3 ** n;
    for (; shown < cnt; shown++) cs.push(cube(null, NC.BAD, [0.42, 0.42, 0.42], -4.8 + (shown % 9) * 1.2, 0.3 + Math.floor(shown / 9) * 0.6, 1.5, 2));
    say('n = ' + n + '：3^' + n + ' = ' + cnt + ' 個頂點', '每多一個子句 ×3'); await beat(tok, 1800);
  }
  glow(D, RED);
  say('Dijkstra 至少 3ⁿ：不是多項式', 'reduction 本身也要多項式大小'); await beat(tok, 3000);
  say('複雜度理論：解不出來的好理由', 'P、NP、NPC、reduction'); await hold(tok, 2600);
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
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['poly-vs-exp', 'decision-opt', 'sat-verify', 'certificate-verify', 'class-sets', 'reduction-idea', 'cook-levin', 'npc-tree', 'sat-3sat', '3sat-clique', 'clique-is-vc', 'ham-tsp', 'npc-proof-steps'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
