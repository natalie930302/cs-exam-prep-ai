// 作業系統 第6章：死鎖 Deadlock（四個必要條件、Resource-allocation graph、prevention、Banker's algorithm、detection、recovery）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 模式與補充場景的 Banker 例題取自 Gate Smashers「Banker Algorithm」影片（P1–P5；跟恐龍書 P0–P4 那題只差 P4、P5 的 Max）；
// 清大周志遠 22A–22D 講的場景在下方 FRAG（用恐龍書原題）。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, beat } = ctx;
  // 字幕裡的向量寫緊一點：(7, 5, 3) → (7,5,3)
  const say = (c, f) => ctx.say(String(c).replace(/(\d), (?=\d)/g, '$1,'), f);
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010', GRAY = '#d8cfc0';
  const PCOL = ['#4b9ee2', '#dd8238', '#2fc092', '#9b7ef4', '#e55a9b', '#31aab0'];
  const RCOL = ['#c08a1f', '#5c7a4a', '#6a7fd0', '#b0566a'];
  function fresh(pos, look) { stopTimer(); lab.clear(); controls(''); lab.frameCamera(pos, look); }
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
  function arrow(a, b, color = '#8a7a5c', shrink = 0.55) {
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
    const dir = d.clone().normalize();
    const s = a.clone().addScaledVector(dir, shrink), e = b.clone().addScaledVector(dir, -shrink);
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color });
    const L = Math.max(0.05, e.distanceTo(s) - 0.3);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, L, 8), mat);
    shaft.position.copy(s.clone().addScaledVector(dir, L / 2));
    shaft.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), mat);
    head.position.copy(e.clone().addScaledVector(dir, -0.16));
    head.quaternion.setFromUnitVectors(V3(0, 1, 0), dir);
    g.add(shaft, head); lab.world.add(g);
    g.userData.mat = mat; g.userData.len = len;
    return g;
  }
  const setArrowColor = (g, c) => g.userData.mat.color.set(c);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  const vec = (v) => '(' + v.join(', ') + ')';
  const le = (a, b) => a.every((x, k) => x <= b[k]);
  const add = (a, b) => a.map((x, k) => x + b[k]);
  const sub = (a, b) => a.map((x, k) => x - b[k]);

  // ───────────────────────── Banker 演算法核心 ─────────────────────────
  // 影片例子（P1–P5，A/B/C 共 10/5/7）：仿恐龍書 P0–P4 的經典題，但 P4、P5 的 Max 不同
  const VIDEO = {
    names: ['P1', 'P2', 'P3', 'P4', 'P5'], res: ['A', 'B', 'C'], total: [10, 5, 7],
    alloc: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]],
    max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [4, 2, 2], [5, 3, 3]],
  };
  const avail0 = (S) => sub(S.total, S.alloc.reduce((s, r) => add(s, r), S.res.map(() => 0)));
  const needOf = (S) => S.max.map((m, i) => sub(m, S.alloc[i]));
  // 安全檢查：回傳每一步（掃描的 process、是否通過、Work 前後）。scan：'cyclic' 接著往下找（影片），'restart' 每次從頭找
  function safety(alloc, need, avail, scan = 'cyclic') {
    const n = alloc.length; const finish = Array(n).fill(false); let work = avail.slice(); const steps = []; const seq = [];
    let i = 0, sinceProgress = 0;
    while (seq.length < n && sinceProgress < n) {
      if (!finish[i]) {
        const ok = le(need[i], work);
        steps.push({ i, ok, work: work.slice(), need: need[i].slice() });
        if (ok) { work = add(work, alloc[i]); finish[i] = true; seq.push(i); steps[steps.length - 1].after = work.slice(); sinceProgress = 0; if (scan === 'restart') { i = 0; continue; } }
        else sinceProgress++;
      } else sinceProgress++;
      i = (i + 1) % n;
    }
    return { safe: seq.length === n, seq, steps, finish, work };
  }

  // 一張 3D 表：左邊 Allocation、Max（或 Request）、Need，右邊 Finish 與 Work 紀錄
  function board(S, opt = {}) {
    const n = S.alloc.length, m = S.res.length;
    const CW = 0.72, rowY = (r) => 4.5 - r * 0.78;
    const groups = opt.groups || [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4'], ['Need', needOf(S), '#dd8238']];
    const g0 = -5.1, gGap = m * CW + 0.5;
    const cells = {};
    groups.forEach(([name, M, col], g) => {
      const xg = g0 + g * gGap;
      tag(name, 'ptr', xg + (m - 1) * CW / 2, rowY(-1) + 0.15, 0);
      S.res.forEach((r, k) => tag(r, 'idx', xg + k * CW, rowY(-0.45), 0));
      cells[name] = M.map((row, i) => row.map((v, k) => cube(v, col, [0.62, 0.56, 0.4], xg + k * CW, rowY(i), 0)));
    });
    S.names.forEach((p, i) => tag(p, 'ptr', g0 - 0.9, rowY(i), 0));
    const xf = g0 + groups.length * gGap - 0.1;
    tag('Finish', 'ptr', xf, rowY(-1) + 0.15, 0);
    const fin = S.names.map((_, i) => cube('F', '#d8cfc0', [0.62, 0.56, 0.4], xf, rowY(i), 0));
    const xw = xf + 1.0;
    tag(opt.workName || 'Work', 'ptr alt', xw + (m - 1) * 0.66 / 2, rowY(-1) + 0.15, 0);
    const workRows = [];
    function pushWork(w, note) {
      const r = workRows.length;
      const y = rowY(r);
      const row = w.map((v, k) => cube(v, '#2fc092', [0.56, 0.5, 0.36], xw + k * 0.66, y, 0, 1.2));
      if (note) row.push(tag(note, 'idx', xw + (m - 1) * 0.66 + 0.5 + String(note).length * 0.1, y, 0));
      workRows.push(row);
      return row;
    }
    const B = {
      cells, fin, workRows, pushWork, groups, rowY, xw,
      cellsOf: (name) => cells[name],
      hlRow(name, i, c) { (cells[name][i] || []).forEach((m2) => glow(m2, c)); },
      clearHl() { Object.values(cells).forEach((M) => M.forEach((row) => row.forEach((m2) => glow(m2, null)))); },
      setFinish(i, ok) { relabel(fin[i], ok ? 'T' : 'F'); tint(fin[i], ok ? '#2fc092' : '#d8cfc0'); },
      lastWork: () => workRows[workRows.length - 1],
      // Allocation 那一列飛到 Work：Work = Work + Allocation[i]
      async release(tok, i, newW, note, ms = 900) {
        const src = cells[groups[0][0]][i];
        const ghosts = src.map((c) => { const gm = cube(c.userData.lbl ? c.userData.lbl.element.textContent : '', '#4b9ee2', [0.5, 0.45, 0.3], c.position.x, c.position.y, 0.5); return gm; });
        const last = B.lastWork();
        ghosts.forEach((gm, k) => move(gm, last[k].position.x, last[k].position.y + 0.1, 0.5));
        if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
        ghosts.forEach(kill);
        pushWork(newW, note);
      },
    };
    return B;
  }
  async function wait(tok, ms) { if (tok !== undefined) await beat(tok, ms); else await sleep(ms); }
  // 動畫：一步安全檢查
  async function animStep(tok, B, S, st, alloc, ms = 1100) {
    B.clearHl();
    const needName = B.groups[B.groups.length - 1][0];
    B.hlRow(needName, st.i, GOLD); B.lastWork().slice(0, S.res.length).forEach((c) => glow(c, GOLD));
    await wait(tok, ms * 0.6);
    st.need.forEach((v, k) => glow(B.cellsOf(needName)[st.i][k], v <= st.work[k] ? GREEN : RED));
    await wait(tok, ms * 0.7);
    if (st.ok) {
      B.setFinish(st.i, true);
      await B.release(tok, st.i, st.after, '+' + S.names[st.i], ms * 0.7);
    }
    B.lastWork().slice(0, S.res.length).forEach((c) => glow(c, null));
  }

  // ───────────────────────── 模式 1：Resource-allocation graph ─────────────────────────
  const RAGS = {
    noCycle: { name: '課本：沒有 cycle（不會 deadlock）', P: ['P1', 'P2', 'P3'], R: [['R1', 1], ['R2', 2], ['R3', 1], ['R4', 3]], E: 'P1->R1, P2->R3, R1->P2, R2->P2, R2->P1, R3->P3' },
    dead: { name: '課本：加上 P3->R2 → deadlock', P: ['P1', 'P2', 'P3'], R: [['R1', 1], ['R2', 2], ['R3', 1], ['R4', 3]], E: 'P1->R1, P2->R3, R1->P2, R2->P2, R2->P1, R3->P3, P3->R2' },
    cycleOk: { name: '課本：有 cycle 但沒有 deadlock', P: ['P1', 'P2', 'P3', 'P4'], R: [['R1', 2], ['R2', 2]], E: 'P1->R1, P3->R2, R1->P2, R1->P3, R2->P1, R2->P4' },
    two: { name: '兩個 process 互等（單一 instance）', P: ['P1', 'P2'], R: [['R1', 1], ['R2', 1]], E: 'R1->P1, R2->P2, P1->R2, P2->R1' },
  };
  const rg = { key: 'dead', E: RAGS.dead.E };
  function parseEdges(str, P, R) {
    const out = []; const bad = [];
    String(str).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => {
      const m = s.match(/^(\w+)\s*-+>\s*(\w+)$/);
      if (!m) { bad.push(s); return; }
      const [, a, b] = m;
      if (P.includes(a) && R.some((r) => r[0] === b)) out.push({ from: a, to: b, kind: 'req' });
      else if (R.some((r) => r[0] === a) && P.includes(b)) out.push({ from: a, to: b, kind: 'asg' });
      else bad.push(s);
    });
    return { out, bad };
  }
  // 圖化簡：可用 instance 能滿足某 process 的所有 request 就讓它做完並歸還
  function reduceRAG(P, R, E) {
    const cnt = Object.fromEntries(R.map(([r, k]) => [r, k]));
    const held = Object.fromEntries(P.map((p) => [p, {}])); const reqs = Object.fromEntries(P.map((p) => [p, {}]));
    E.forEach((e) => { if (e.kind === 'asg') { held[e.to][e.from] = (held[e.to][e.from] || 0) + 1; cnt[e.from]--; } else reqs[e.from][e.to] = (reqs[e.from][e.to] || 0) + 1; });
    const done = new Set(); const order = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (const p of P) {
        if (done.has(p)) continue;
        if (Object.entries(reqs[p]).every(([r, k]) => cnt[r] >= k)) { done.add(p); order.push(p); Object.entries(held[p]).forEach(([r, k]) => { cnt[r] += k; }); progress = true; }
      }
    }
    return { order, dead: P.filter((p) => !done.has(p)), overAlloc: Object.values(cnt).some((v) => v < 0) };
  }
  function findCycle(P, R, E) {
    const adj = {}; [...P, ...R.map((r) => r[0])].forEach((v) => { adj[v] = []; });
    E.forEach((e) => adj[e.from].push(e.to));
    const color = {}; const stack = []; let cyc = null;
    function dfs(u) { color[u] = 1; stack.push(u); for (const v of adj[u]) { if (cyc) return; if (color[v] === 1) { cyc = stack.slice(stack.indexOf(v)).concat(v); return; } if (!color[v]) dfs(v); } stack.pop(); color[u] = 2; }
    for (const v of Object.keys(adj)) { if (!color[v] && !cyc) dfs(v); }
    return cyc;
  }
  function ragView(G, E) {
    const pPos = {}, rPos = {};
    G.P.forEach((p, k) => { pPos[p] = V3(-4.5 + k * (9 / Math.max(1, G.P.length - 1)), 0.5, -1.8); });
    G.R.forEach(([r], k) => { rPos[r] = V3(-4.5 + k * (9 / Math.max(1, G.R.length - 1)), 0.5, 2.0); });
    const nodes = {};
    G.P.forEach((p, k) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 24), new THREE.MeshStandardMaterial({ color: PCOL[k % PCOL.length] })); m.position.copy(pPos[p]); lab.world.add(m); m.userData.lbl = lab.label(p, 'val'); m.add(m.userData.lbl); nodes[p] = m; });
    G.R.forEach(([r, k], j) => {
      const m = cube('', RCOL[j % RCOL.length], [1.4, 0.5, 1.0], rPos[r].x, 0.25, rPos[r].z); nodes[r] = m;
      tag(r, 'ptr', rPos[r].x, 0.2, rPos[r].z + 0.9);
      for (let d = 0; d < k; d++) cube('', '#fbf7f0', [0.18, 0.18, 0.18], rPos[r].x - (k - 1) * 0.15 + d * 0.3, 0.55, rPos[r].z);
    });
    const arrows = E.map((e) => {
      const a = (pPos[e.from] || rPos[e.from]).clone(), b = (pPos[e.to] || rPos[e.to]).clone();
      a.y = b.y = 0.7;
      const g = arrow(a, b, e.kind === 'req' ? '#8a7a5c' : '#2f8a5f', 0.75);
      return { e, g };
    });
    return { nodes, arrows, pPos, rPos };
  }
  function enterRAG() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 9, 9.5], [0, 0, 0.2]);
    controls('<select id="gK">' + Object.keys(RAGS).map((k) => '<option value="' + k + '">' + RAGS[k].name + '</option>').join('') + '</select>'
      + '<input id="gE" style="width:340px" value="' + rg.E + '" title="P->R = request edge；R->P = assignment edge"><button id="gApply">套用邊</button><button class="primary" id="gDet">偵測 deadlock</button>');
    $('gK').value = rg.key;
    $('gK').onchange = (e) => { rg.key = e.target.value; rg.E = RAGS[rg.key].E; clearLog(); enterRAG(); };
    const G = RAGS[rg.key];
    const { out: E, bad } = parseEdges(rg.E, G.P, G.R);
    if (bad.length) log('看不懂的邊：' + bad.join('、') + '（格式 P1->R1 或 R1->P1，名稱要在圖裡）', true);
    const V = ragView(G, E);
    on('gApply', () => { rg.E = $('gE').value; clearLog(); enterRAG(); });
    on('gDet', () => {
      const red = reduceRAG(G.P, G.R, E);
      if (red.overAlloc) { log('assignment edge 比資源的 instance 數還多，這張圖不合法。', true); return; }
      const cyc = findCycle(G.P, G.R, E);
      V.arrows.forEach(({ g }) => setArrowColor(g, '#8a7a5c'));
      if (cyc) { for (let k = 0; k + 1 < cyc.length; k++) V.arrows.filter(({ e }) => e.from === cyc[k] && e.to === cyc[k + 1]).forEach(({ g }) => setArrowColor(g, '#d64545')); log('找到 cycle：' + cyc.join(' → ')); }
      else log('沒有 cycle → 一定沒有 deadlock。');
      G.P.forEach((p) => glow(V.nodes[p], red.dead.includes(p) ? RED : GREEN));
      if (red.dead.length) log('化簡後卡住的 process：' + red.dead.join('、') + ' → deadlock' + (G.R.every(([, k]) => k === 1) ? '（每種資源只有 1 個：有 cycle 就是 deadlock）' : ''), true);
      else log('化簡順序：' + red.order.join(' → ') + '，全部能做完 → 沒有 deadlock' + (cyc ? '（有 cycle 但每種資源有多個 instance，不一定 deadlock）' : ''));
      ragState(G, E, cyc, red);
    });
    log('灰箭頭 P → R：request edge（在等）；綠箭頭 R → P：assignment edge（已拿到）。白點 = instance 數。');
    ragState(G, E, null, null);
  }
  function ragState(G, E, cyc, red) {
    setState('Resource-allocation graph', [['process', G.P.join(' ')], ['resource（instance）', G.R.map(([r, k]) => r + '×' + k).join(' ')], ['request edge', String(E.filter((e) => e.kind === 'req').length)], ['assignment edge', String(E.filter((e) => e.kind === 'asg').length)]]
      .concat(red ? [['cycle', cyc ? cyc.join('→') : '沒有'], ['結果', red.dead.length ? 'deadlock：' + red.dead.join(' ') : '沒有 deadlock']] : []),
      '沒有 cycle → 沒有 deadlock<br>有 cycle：每種資源只有 1 個 → 一定 deadlock；有多個 → 可能');
  }

  // ───────────────────────── 模式 2：Banker 安全檢查 ─────────────────────────
  const bk = { S: null, scan: 'cyclic', res: null, k: 0, B: null };
  const cloneS = (S) => JSON.parse(JSON.stringify(S));
  function parseMat(s, n, m) { const rows = String(s).split(/[;\n|]+/).map((r) => r.trim().split(/[\s,]+/).filter(Boolean).map(Number)); return rows.length === n && rows.every((r) => r.length === m && r.every((x) => Number.isInteger(x) && x >= 0)) ? rows : null; }
  function randomBanker() {
    for (let t = 0; t < 200; t++) {
      const n = 5, m = 3; const total = [rnd(6, 10), rnd(4, 8), rnd(5, 9)];
      const alloc = [], max = []; let left = total.slice();
      for (let i = 0; i < n; i++) { const a = left.map((x) => rnd(0, Math.min(3, x))); left = sub(left, a); alloc.push(a); max.push(a.map((x, k) => Math.min(total[k], x + rnd(0, 5)))); }
      const S = { names: ['P0', 'P1', 'P2', 'P3', 'P4'], res: ['A', 'B', 'C'], total, alloc, max };
      const r = safety(alloc, needOf(S), avail0(S));
      if (Math.random() < 0.7 ? r.safe : !r.safe) return S;
    }
    return cloneS(VIDEO);
  }
  function enterBanker() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.2, 14], [0, 2.4, 0]);
    if (!bk.S) bk.S = cloneS(VIDEO);
    const S = bk.S;
    controls('<select id="kEx"><option value="">換題目…</option><option value="video">影片例子（10, 5, 7）</option><option value="rand">隨機出一題</option></select>'
      + '<select id="kScan"><option value="cyclic">掃描：接著往下找（影片）</option><option value="restart">掃描：每次從頭找</option></select>'
      + '<button class="primary" id="kStep">下一步</button><button id="kAll">全部跑完</button><button id="kReset">重來</button><br>'
      + '<label>Total <input id="kT" style="width:70px" value="' + S.total.join(' ') + '"></label>'
      + '<label>Allocation <input id="kA" style="width:150px" value="' + S.alloc.map((r) => r.join(' ')).join('; ') + '"></label>'
      + '<label>Max <input id="kM" style="width:150px" value="' + S.max.map((r) => r.join(' ')).join('; ') + '"></label><button id="kSet">套用</button>');
    $('kScan').value = bk.scan;
    $('kScan').onchange = (e) => { bk.scan = e.target.value; clearLog(); enterBanker(); };
    $('kEx').onchange = (e) => { if (e.target.value === 'video') bk.S = cloneS(VIDEO); if (e.target.value === 'rand') bk.S = randomBanker(); clearLog(); enterBanker(); };
    on('kSet', () => {
      const T = $('kT').value.trim().split(/[\s,]+/).map(Number), m = T.length;
      const n = $('kA').value.split(/[;\n|]+/).filter((r) => r.trim()).length;
      const A = parseMat($('kA').value, n, m), M = parseMat($('kM').value, n, m);
      if (!T.every((x) => Number.isInteger(x) && x >= 0) || m < 1 || m > 4) { log('Total 要寫 1～4 個非負整數，例如 10 5 7。', true); return; }
      if (!A || !M || n < 2 || n > 6) { log('Allocation 與 Max 都要有相同列數（2～6 個 process），每列 ' + m + ' 個非負整數，用 ; 分隔。', true); return; }
      if (A.some((r, i) => !le(r, M[i]))) { log('有 process 的 Allocation 大於 Max：拿到的不可能比宣告的最大需求還多。', true); return; }
      const SA = A.reduce((s, r) => add(s, r), T.map(() => 0));
      if (!le(SA, T)) { log('Allocation 加總 ' + vec(SA) + ' 超過 Total ' + vec(T) + '。', true); return; }
      if (M.some((r) => !le(r, T))) { log('Max 不能超過系統的 Total。', true); return; }
      bk.S = { names: Array.from({ length: n }, (_, i) => 'P' + (i + 1)), res: ['A', 'B', 'C', 'D'].slice(0, m), total: T, alloc: A, max: M };
      clearLog(); enterBanker();
    });
    bk.B = board(S); bk.k = 0;
    const av = avail0(S);
    bk.B.pushWork(av, 'Available');
    bk.res = safety(S.alloc, needOf(S), av, bk.scan);
    const go = async () => {
      if (bk.k >= bk.res.steps.length) { log(bk.res.safe ? '安全序列：' + bk.res.seq.map((i) => S.names[i]).join(' → ') + '（Work 最後回到 Total ' + vec(bk.res.work) + '）' : '剩下的 process 都找不到 Need ≤ Work → unsafe', !bk.res.safe); bkState(); return false; }
      const st = bk.res.steps[bk.k++];
      log(S.names[st.i] + '：Need ' + vec(st.need) + (st.ok ? ' ≤ ' : ' ≰ ') + 'Work ' + vec(st.work) + (st.ok ? ' → 做完並歸還 Allocation，Work = ' + vec(st.after) : ' → 先跳過'));
      await animStep(undefined, bk.B, S, st, S.alloc, 700);
      bkState();
      return true;
    };
    let busy = false;
    on('kStep', async () => { if (busy) return; busy = true; try { await go(); } finally { busy = false; } });
    on('kAll', async () => { if (busy) return; busy = true; try { while (await go()); } finally { busy = false; } });
    on('kReset', () => { clearLog(); enterBanker(); });
    log('Available = Total − ΣAllocation = ' + vec(S.total) + ' − ' + vec(sub(S.total, av)) + ' = ' + vec(av));
    log('Need = Max − Allocation。按「下一步」：找一個 Need ≤ Work 的 process。');
    bkState();
  }
  function bkState() {
    const S = bk.S, r = bk.res, done = bk.k >= r.steps.length;
    setState("Banker's safety algorithm", [['Total', vec(S.total)], ['Available', vec(avail0(S))], ['已完成', r.steps.slice(0, bk.k).filter((s) => s.ok).map((s) => S.names[s.i]).join(' → ') || '—']],
      done ? (r.safe ? '<span class="ok">safe</span>：' + r.seq.map((i) => S.names[i]).join(' → ') : '<span class="no">unsafe</span>（不等於已經 deadlock）') : 'Need ≤ Work（每一種資源都要）→ Work += Allocation、Finish = true');
  }

  // ───────────────────────── 模式 3：Resource-request ─────────────────────────
  const rq = { S: null };
  function enterRequest() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.2, 14], [0, 2.4, 0]);
    if (!rq.S) rq.S = cloneS(VIDEO);
    const S = rq.S;
    controls('<label>請求：<select id="qP">' + S.names.map((p, i) => '<option value="' + i + '">' + p + '</option>').join('') + '</select>'
      + ' Request <input id="qV" style="width:80px" value="1 0 2"></label><button class="primary" id="qGo">提出請求</button><button id="qReset">回到影片例子</button>');
    $('qP').value = '1';
    const B = board(S); const av = avail0(S); B.pushWork(av, 'Available');
    on('qReset', () => { rq.S = cloneS(VIDEO); clearLog(); enterRequest(); });
    let busy = false;
    on('qGo', async () => {
      if (busy) return;
      const i = Number($('qP').value), R = $('qV').value.trim().split(/[\s,]+/).map(Number);
      if (R.length !== S.res.length || !R.every((x) => Number.isInteger(x) && x >= 0)) { log('Request 要寫 ' + S.res.length + ' 個非負整數。', true); return; }
      const need = needOf(S)[i], A = avail0(S);
      log(S.names[i] + ' 請求 ' + vec(R) + '：');
      if (!le(R, need)) { log('① Request ' + vec(R) + ' > Need ' + vec(need) + ' → 錯誤：超過它當初宣告的最大需求（raise error）', true); return; }
      log('① Request ≤ Need ' + vec(need) + ' ✓');
      if (!le(R, A)) { log('② Request > Available ' + vec(A) + ' → 資源不夠，' + S.names[i] + ' 必須等', true); return; }
      log('② Request ≤ Available ' + vec(A) + ' ✓');
      busy = true;
      try {
        const T = cloneS(S); T.alloc[i] = add(T.alloc[i], R);
        log('③ 假裝配給它：Available = ' + vec(sub(A, R)) + '，Allocation[' + S.names[i] + '] = ' + vec(T.alloc[i]) + '，Need = ' + vec(sub(need, R)));
        lab.clear();
        const B2 = board(T); B2.pushWork(avail0(T), 'Available');
        B2.hlRow('Allocation', i, GOLD); B2.hlRow('Need', i, GOLD);
        await sleep(900);
        const r = safety(T.alloc, needOf(T), avail0(T), 'cyclic');
        for (const st of r.steps) await animStep(undefined, B2, T, st, T.alloc, 500);
        if (r.safe) { log('④ 跑 safety：safe（' + r.seq.map((k) => T.names[k]).join(' → ') + '）→ 正式配給 ' + S.names[i]); rq.S = T; }
        else { log('④ 跑 safety：unsafe → 不給，' + S.names[i] + ' 等待，狀態還原', true); }
        setState('Resource-request：' + S.names[i] + ' 要 ' + vec(R), [['Request ≤ Need', '✓'], ['Request ≤ Available', '✓'], ['假設配給後', r.safe ? 'safe' : 'unsafe']], r.safe ? '<span class="ok">配給</span>' : '<span class="no">不配給，等待</span>');
      } finally { busy = false; }
    });
    log('仿課本三題：P2 要 (1,0,2) → 給；接著 P5 要 (3,3,0) → 不夠；P1 要 (0,2,0) → unsafe 不給。（這裡用影片 P1–P5 的數字；跟課本 P0–P4 那題只差 P4、P5 的 Max）');
    setState('Resource-request algorithm', [['Available', vec(av)]], '① Request ≤ Need？② Request ≤ Available？③ 假裝配給 ④ safety 檢查');
  }

  // ───────────────────────── 模式 4：Deadlock detection ─────────────────────────
  const DET = { names: ['P0', 'P1', 'P2', 'P3', 'P4'], res: ['A', 'B', 'C'], total: [7, 2, 6],
    alloc: [[0, 1, 0], [2, 0, 0], [3, 0, 3], [2, 1, 1], [0, 0, 2]], req: [[0, 0, 0], [2, 0, 2], [0, 0, 0], [1, 0, 0], [0, 0, 2]] };
  const dt = { extra: false };
  function detState0() { const S = cloneS(DET); if (dt.extra) S.req[2] = [0, 0, 1]; return S; }
  function detect(S) {
    const av = avail0(S); const n = S.alloc.length;
    const finish = S.alloc.map((a) => a.every((x) => x === 0));
    const steps = []; let work = av.slice(); const seq = [];
    let changed = true;
    while (changed) { changed = false; for (let i = 0; i < n; i++) if (!finish[i]) { const ok = le(S.req[i], work); steps.push({ i, ok, work: work.slice(), need: S.req[i].slice() }); if (ok) { work = add(work, S.alloc[i]); finish[i] = true; seq.push(i); steps[steps.length - 1].after = work.slice(); changed = true; } } }
    return { steps, seq, dead: finish.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0) };
  }
  function enterDetect() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 3.2, 14], [0, 2.4, 0]);
    controls('<label><input type="checkbox" id="dX"' + (dt.extra ? ' checked' : '') + '> P2 再多要 1 個 C</label><button class="primary" id="dRun">跑 detection</button><button id="dReset">重來</button>');
    $('dX').onchange = (e) => { dt.extra = !!e.target.checked; clearLog(); enterDetect(); };
    const S = detState0();
    const B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Request', S.req, '#dd8238']] });
    B.pushWork(avail0(S), 'Available');
    let busy = false;
    on('dRun', async () => {
      if (busy) return; busy = true;
      try {
        const r = detect(S);
        for (const st of r.steps) { log(S.names[st.i] + '：Request ' + vec(st.need) + (st.ok ? ' ≤ ' : ' ≰ ') + 'Work ' + vec(st.work)); await animStep(undefined, B, S, st, S.alloc, 450); }
        if (r.dead.length) { log('Finish 仍為 false 的 ' + r.dead.map((i) => S.names[i]).join('、') + ' → 已經 deadlock', true); r.dead.forEach((i) => B.hlRow('Allocation', i, RED)); }
        else log('全部 Finish = true（順序 ' + r.seq.map((i) => S.names[i]).join(' → ') + '）→ 目前沒有 deadlock');
        setState('Deadlock detection', [['Available', vec(avail0(S))], ['結果', r.dead.length ? 'deadlock：' + r.dead.map((i) => S.names[i]).join(' ') : '沒有 deadlock']], '跟 Banker 一樣的掃法，但比的是「現在的 Request」，不是 Need = Max − Allocation');
      } finally { busy = false; }
    });
    on('dReset', () => { clearLog(); enterDetect(); });
    log('例子：A、B、C 共 7、2、6，Available = (0, 0, 0)。detection 不需要事先知道 Max。');
    setState('Deadlock detection', [['Available', vec(avail0(S))]], 'Request ≤ Work → 假設它會做完，Work += Allocation');
  }

  // ───────────────────────── 模式 5：四個條件與 prevention ─────────────────────────
  const pv = { brk: 'none' };
  const PREV = {
    none: '四個條件都成立',
    me: '破壞 mutual exclusion（資源可共用）',
    hw: '破壞 hold and wait（一次要齊全部）',
    np: '破壞 no preemption（等不到就放掉手上的）',
    cw: '破壞 circular wait（依編號由小到大要）',
  };
  function enterPrevent() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 9, 8.5], [0, 0, 0]);
    controls('<select id="vB">' + Object.keys(PREV).map((k) => '<option value="' + k + '">' + PREV[k] + '</option>').join('') + '</select><button class="primary" id="vRun">四個 process 同時開始</button><button id="vReset">重設</button>');
    $('vB').value = pv.brk;
    $('vB').onchange = (e) => { pv.brk = e.target.value; clearLog(); enterPrevent(); };
    on('vReset', () => { clearLog(); enterPrevent(); });
    const N = 4, Rr = 3.2;
    const pp = (k, r = Rr) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
    const P = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k); return cube('P' + (k + 1), PCOL[k], [1.0, 0.8, 1.0], x, 0.4, z); });
    const RH = Array.from({ length: N }, (_, k) => pp(k + 0.5, 1.9));
    const R = RH.map(([x, z], k) => cube('R' + (k + 1), RCOL[k], [0.8, 0.5, 0.8], x, 0.25, z));
    // P(k+1) 需要 R(k) 與 R(k+1 mod N)：先拿左邊再拿右邊（R 編號）
    let busy = false;
    on('vRun', async () => {
      if (busy) return; busy = true;
      try {
        const holder = Array(N).fill(-1);
        const firstOf = (k) => (pv.brk === 'cw' ? Math.min(k, (k + N - 1) % N) : k);
        const secondOf = (k) => (pv.brk === 'cw' ? Math.max(k, (k + N - 1) % N) : (k + N - 1) % N);
        const grab = (k, r) => { holder[r] = k; const [x, z] = pp(k, Rr - 1.0); move(R[r], x + (r === k ? 0.35 : -0.35), 0.9, z); glow(R[r], GOLD); };
        const drop = (r) => { holder[r] = -1; const [x, z] = RH[r]; move(R[r], x, 0.25, z); glow(R[r], null); };
        if (pv.brk === 'me') { log('資源可以共用（例如 read-only 檔案）就不需要等 → 不會 deadlock。但印表機這類資源本質上不能共用，這招通常不可行。'); P.forEach((m) => glow(m, GREEN)); vState('全部順利完成'); return; }
        if (pv.brk === 'hw') {
          for (let k = 0; k < N; k++) {
            const a = k, b = (k + N - 1) % N;
            if (holder[a] < 0 && holder[b] < 0) { grab(k, a); grab(k, b); glow(P[k], GREEN); log('P' + (k + 1) + ' 一次拿齊 R' + (a + 1) + '、R' + (b + 1)); }
            else { glow(P[k], GOLD); log('P' + (k + 1) + ' 拿不齊 → 一個都不拿，先等（資源利用率低、可能 starvation）'); }
            await sleep(500);
          }
          vState('沒有人「拿著一個等另一個」→ 不會 deadlock'); return;
        }
        for (let k = 0; k < N; k++) { const r = firstOf(k); if (holder[r] < 0) { grab(k, r); log('P' + (k + 1) + ' 拿到 R' + (r + 1)); } else log('P' + (k + 1) + ' 要 R' + (r + 1) + '，被 P' + (holder[r] + 1) + ' 拿著 → 等'); await sleep(450); }
        await sleep(400);
        let stuck = 0;
        for (let k = 0; k < N; k++) {
          const r1 = firstOf(k), r2 = secondOf(k);
          if (holder[r1] !== k) { glow(P[k], GOLD); continue; }
          if (holder[r2] < 0) { grab(k, r2); glow(P[k], GREEN); log('P' + (k + 1) + ' 也拿到 R' + (r2 + 1) + ' → 可以執行'); }
          else if (pv.brk === 'np') { drop(r1); glow(P[k], GOLD); log('P' + (k + 1) + ' 要 R' + (r2 + 1) + ' 拿不到 → 把手上的 R' + (r1 + 1) + ' 放掉（被 preempt），之後重來'); }
          else { glow(P[k], RED); stuck++; log('P' + (k + 1) + ' 拿著 R' + (r1 + 1) + '，等 R' + (r2 + 1) + '（被 P' + (holder[r2] + 1) + ' 拿著）'); }
          await sleep(500);
        }
        if (stuck === N) { log('四個人都拿著一個、等下一個：mutual exclusion + hold and wait + no preemption + circular wait → deadlock', true); vState('deadlock'); }
        else vState(pv.brk === 'cw' ? '依編號要資源，不可能繞成一圈 → 不會 deadlock' : pv.brk === 'np' ? '有人釋放 → 打破僵局（可能 livelock / 重做成本）' : '這次沒卡死');
      } finally { busy = false; }
    });
    log('P1～P4 圍成一圈，每人都要左右兩個資源。選擇要破壞哪個條件，再按開始。');
    vState('—');
  }
  function vState(res) {
    setState('Deadlock 四個必要條件', [['Mutual exclusion', pv.brk === 'me' ? '破壞' : '成立'], ['Hold and wait', pv.brk === 'hw' ? '破壞' : '成立'], ['No preemption', pv.brk === 'np' ? '破壞' : '成立'], ['Circular wait', pv.brk === 'cw' ? '破壞' : '成立'], ['結果', res]],
      '四個條件要<b>同時</b>成立才會 deadlock；prevention = 讓其中一個不成立');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const r = Math.random();
    if (r < 0.4) {
      const S = randomBanker(); const need = needOf(S), av = avail0(S); const res = safety(S.alloc, need, av, 'restart');
      const body = 'Total ' + vec(S.total) + '\n' + S.names.map((p, i) => p + '：Allocation ' + vec(S.alloc[i]) + '　Max ' + vec(S.max[i])).join('\n');
      if (Math.random() < 0.5) {
        const i = rnd(0, 4); const ans = vec(need[i]);
        return { q: '以下狀態中，' + S.names[i] + ' 的 Need 是？\n' + body, opts: [ans, vec(S.max[i]), vec(add(S.max[i], S.alloc[i])), vec(av)].filter((v, k, a) => a.indexOf(v) === k).concat([vec(need[(i + 1) % 5])]).filter((v, k, a) => a.indexOf(v) === k).slice(0, 4), ans, why: 'Need = Max − Allocation = ' + vec(S.max[i]) + ' − ' + vec(S.alloc[i]) + ' = ' + ans + '。' };
      }
      const ans = res.safe ? 'safe，例如 ' + res.seq.map((i) => S.names[i]).join(' → ') : 'unsafe';
      // a distractor sequence must really fail the safety check, or the question would have two right answers
      const seqOk = (ord) => { let w = av.slice(); for (const i of ord) { if (!le(need[i], w)) return false; w = add(w, S.alloc[i]); } return true; };
      const cands = [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [2, 0, 4, 1, 3], [3, 4, 0, 2, 1], [1, 0, 3, 2, 4], [0, 2, 4, 3, 1]];
      const wrong = cands.filter((o) => !res.safe || !seqOk(o)).slice(0, 2).map((o) => 'safe，例如 ' + o.map((i) => S.names[i]).join(' → '));
      return { q: '用 Banker\'s safety algorithm 判斷：\n' + body + '\n（Available = Total − ΣAllocation）', opts: [ans, res.safe ? 'unsafe' : wrong.shift(), '一定已經 deadlock'].concat(wrong).filter((v, k, a) => v && a.indexOf(v) === k).slice(0, 4), ans,
        why: 'Available = ' + vec(av) + '；' + res.steps.filter((s) => s.ok).map((s) => S.names[s.i] + ' 做完 → Work ' + vec(s.after)).join('；') + (res.safe ? '。' : '；之後沒有人的 Need ≤ Work → unsafe。') };
    }
    if (r < 0.5) {
      const i = rnd(0, 4); const need = needOf(VIDEO)[i];
      return { q: '影片例子（Total 10, 5, 7）中，Available 是多少？', opts: ['(3, 3, 2)', '(7, 2, 5)', '(10, 5, 7)', '(2, 3, 0)'], ans: '(3, 3, 2)', why: 'ΣAllocation = (7, 2, 5)，Available = (10, 5, 7) − (7, 2, 5) = (3, 3, 2)。另外 ' + VIDEO.names[i] + ' 的 Need = ' + vec(need) + '。' };
    }
    const C = [
      { q: "Banker's algorithm 屬於哪一類處理 deadlock 的方法？", opts: ['deadlock avoidance', 'deadlock detection', 'deadlock prevention', 'deadlock recovery'], ans: 'deadlock avoidance', why: '要事先知道每個 process 的 Max，配置前檢查會不會進入 unsafe state。影片說它也是 "detection"，那是錯誤用語；detection 演算法比的是 Request、不需要 Max。' },
      { q: 'Unsafe state 代表？', opts: ['有可能發生 deadlock，但不一定已經 deadlock', '一定已經 deadlock', '一定不會 deadlock', '有 process 超過 Max'], ans: '有可能發生 deadlock，但不一定已經 deadlock', why: 'deadlock ⊂ unsafe；影片把 unsafe 直接說成 deadlock 是簡化說法。' },
      { q: 'Deadlock 的四個必要條件是？', opts: ['mutual exclusion、hold and wait、no preemption、circular wait', 'mutual exclusion、progress、bounded waiting、circular wait', 'hold and wait、starvation、aging、preemption', 'race condition、hold and wait、no preemption、circular wait'], ans: 'mutual exclusion、hold and wait、no preemption、circular wait', why: '四個要同時成立；缺一個就不會 deadlock。' },
      { q: 'RAG 有 cycle，而且每種資源都只有 1 個 instance，則？', opts: ['一定 deadlock', '一定沒有 deadlock', '可能 deadlock', '要跑 Banker 才知道'], ans: '一定 deadlock', why: '單一 instance 時 cycle ⇔ deadlock；多 instance 時 cycle 只是必要條件。' },
      { q: 'RAG 沒有 cycle，則？', opts: ['一定沒有 deadlock', '一定 deadlock', '可能 deadlock', '要看 instance 數'], ans: '一定沒有 deadlock', why: 'circular wait 不成立。' },
      { q: '要求 process 依資源編號由小到大申請，破壞的是？', opts: ['circular wait', 'hold and wait', 'no preemption', 'mutual exclusion'], ans: 'circular wait', why: '依同一個全序拿資源，不可能繞成一圈。' },
      { q: '要求 process 開始前一次申請到所有資源，破壞的是？', opts: ['hold and wait', 'circular wait', 'no preemption', 'mutual exclusion'], ans: 'hold and wait', why: '代價：資源利用率低、可能 starvation。' },
      { q: 'Banker 判斷某 process 能不能做完的條件？', opts: ['Need ≤ Work（每一種資源都要）', 'Max ≤ Work', 'Allocation ≤ Work', '至少一種資源 Need ≤ Work'], ans: 'Need ≤ Work（每一種資源都要）', why: '影片強調：所有種類要同時滿足，只滿足 C 一種不算。' },
      { q: 'Process 做完後 Work 怎麼更新？', opts: ['Work = Work + Allocation', 'Work = Work + Need', 'Work = Work + Max', 'Work = Work − Need'], ans: 'Work = Work + Allocation', why: '它拿到剩下的 Need 後做完，連同原本持有的全部歸還，淨增加 = Allocation。' },
      { q: 'Resource-request 中 Request > Need 時？', opts: ['錯誤：超過宣告的最大需求', 'process 等待', '直接配給', '跑 detection'], ans: '錯誤：超過宣告的最大需求', why: 'Request > Available 才是「等待」；Request > Need 是違規。' },
      { q: 'Wait-for graph 適用於？', opts: ['每種資源只有一個 instance 的 deadlock detection', 'Banker 的 safety 檢查', '多 instance 的 avoidance', 'prevention'], ans: '每種資源只有一個 instance 的 deadlock detection', why: '把 RAG 的資源節點收掉，Pi → Pj 代表 Pi 在等 Pj；有 cycle 就是 deadlock。' },
      { q: 'Deadlock recovery 選 victim 時要避免什麼？', opts: ['同一個 process 一直被選中（starvation）', 'context switch', 'race condition', 'aging'], ans: '同一個 process 一直被選中（starvation）', why: '把 rollback 次數算進 cost。' },
    ];
    return pickOne(C);
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

  // ───────────────────────── 場景：課本補充 ─────────────────────────
  async function scIntro(tok) {
    fresh([0, 7, 11], [0, 0.6, 0]);
    say('使用資源三步驟：request → use → release（補充：課本）', '要不到就等');
    const p1 = cube('P1', PCOL[0], [1, 0.8, 1], -3.5, 0.4, 1.4), p2 = cube('P2', PCOL[1], [1, 0.8, 1], 3.5, 0.4, 1.4);
    const r1 = cube('R1 印表機', RCOL[0], [1.8, 0.6, 1], -1.8, 0.3, -2), r2 = cube('R2 磁碟', RCOL[1], [1.8, 0.6, 1], 1.8, 0.3, -2);
    await beat(tok, 2800);
    move(r1, -3.5, 1.2, 1.4); say('P1 拿到 R1', ''); await beat(tok, 1400);
    move(r2, 3.5, 1.2, 1.4); say('P2 拿到 R2', ''); await beat(tok, 1400);
    const a1 = arrow(V3(-3.5, 0.8, 1.0), V3(3.0, 1.0, 1.2), '#d64545', 0.7); glow(p1, RED);
    say('P1 還要 R2 → 等 P2 放', ''); await beat(tok, 1800);
    const a2 = arrow(V3(3.5, 0.6, 1.8), V3(-3.0, 0.8, 1.8), '#d64545', 0.7); glow(p2, RED);
    say('P2 還要 R1 → 等 P1 放', '互相等，永遠等不到 → deadlock');
    await beat(tok, 3200);
    say('deadlock：一組 process 都在等組內另一個才能觸發的事件', '');
    await beat(tok, 2800);
    kill(a1); kill(a2);
  }
  async function scFour(tok) {
    fresh([0, 9, 8.5], [0, 0, 0]);
    const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
    const P = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 3.2); return cube('P' + (k + 1), PCOL[k], [1, 0.8, 1], x, 0.4, z); });
    const R = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k + 0.5, 1.9); return cube('R' + (k + 1), RCOL[k], [0.8, 0.5, 0.8], x, 0.25, z); });
    const C = [
      ['① Mutual exclusion', '資源一次只能一個人用', () => R.forEach((m) => glow(m, GOLD))],
      ['② Hold and wait', '拿著一個，還在等別的', () => R.forEach((m, k) => { const [x, z] = pp(k, 2.3); move(m, x + 0.9, 0.9, z); })],
      ['③ No preemption', '資源只能自己放，不能被搶', () => P.forEach((m) => glow(m, GOLD))],
      ['④ Circular wait', 'P1 等 P2、P2 等 P3 … P4 等 P1', () => { for (let k = 0; k < N; k++) { const [x1, z1] = pp(k, 3.2), [x2, z2] = pp(k + 1, 3.2); arrow(V3(x1, 1.0, z1), V3(x2, 1.0, z2), '#d64545', 0.8); } P.forEach((m) => glow(m, RED)); }],
    ];
    say('Deadlock 的四個必要條件（補充：課本）', '要「同時」成立才會 deadlock');
    await beat(tok, 2600);
    for (const [t, f, act] of C) { act(); say(t, f); await beat(tok, 2800); }
    say('缺一不可 → prevention 就是破壞其中一個', 'circular wait 隱含 hold and wait');
    await beat(tok, 3000);
  }
  async function scRAG(tok) {
    fresh([0, 9, 9.5], [0, 0, 0.2]);
    const G = RAGS.noCycle;
    const { out: E } = parseEdges(G.E, G.P, G.R);
    const V = ragView(G, E);
    say('Resource-allocation graph（補充：課本）', '圓 = process；方塊 = 資源，白點 = instance');
    await beat(tok, 3000);
    say('P → R：request edge（在等）', 'R → P：assignment edge（已配給）');
    await beat(tok, 2800);
    say('沒有 cycle → 不會 deadlock', 'P3 做完放 R3 → P2 做完 → P1 拿到 R1');
    G.P.forEach((p) => glow(V.nodes[p], GREEN));
    await beat(tok, 3000);
    lab.clear();
    const G2 = RAGS.dead; const { out: E2 } = parseEdges(G2.E, G2.P, G2.R); const V2 = ragView(G2, E2);
    const last = V2.arrows[V2.arrows.length - 1]; setArrowColor(last.g, '#c08a1f');
    say('再加一條 P3 → R2', '');
    await beat(tok, 2000);
    const cyc1 = ['P1', 'R1', 'P2', 'R3', 'P3', 'R2', 'P1'];
    for (let k = 0; k + 1 < cyc1.length; k++) { V2.arrows.filter(({ e }) => e.from === cyc1[k] && e.to === cyc1[k + 1]).forEach(({ g }) => setArrowColor(g, '#d64545')); await beat(tok, 450); }
    say('cycle：P1→R1→P2→R3→P3→R2→P1', '還有 P2→R3→P3→R2→P2');
    G2.P.forEach((p) => glow(V2.nodes[p], RED));
    await beat(tok, 3000);
    say('R2 的兩個都被拿走，三人互等 → deadlock', '');
    await beat(tok, 2600);
  }
  async function scRAGCycleOk(tok) {
    fresh([0, 9, 9.5], [0, 0, 0.2]);
    const G = RAGS.cycleOk; const { out: E } = parseEdges(G.E, G.P, G.R); const V = ragView(G, E);
    say('有 cycle 一定 deadlock 嗎？（補充：課本）', 'R1、R2 各有 2 個 instance');
    await beat(tok, 2600);
    const cyc = ['P1', 'R1', 'P3', 'R2', 'P1'];
    for (let k = 0; k + 1 < cyc.length; k++) { V.arrows.filter(({ e }) => e.from === cyc[k] && e.to === cyc[k + 1]).forEach(({ g }) => setArrowColor(g, '#d64545')); await beat(tok, 500); }
    say('cycle：P1 → R1 → P3 → R2 → P1', '');
    await beat(tok, 2200);
    glow(V.nodes.P4, GREEN);
    say('但 P4 不在 cycle 裡，做完會放掉一個 R2', '');
    await beat(tok, 2200);
    V.arrows.filter(({ e }) => e.from === 'R2' && e.to === 'P4').forEach(({ g }) => kill(g));
    V.arrows.filter(({ e }) => e.from === 'P3' && e.to === 'R2').forEach(({ g }) => setArrowColor(g, '#2f8a5f'));
    glow(V.nodes.P3, GREEN);
    say('P3 拿到 R2 → cycle 斷了', '沒有 deadlock');
    await beat(tok, 2800);
    say('單一 instance：cycle ⇔ deadlock', '多個 instance：有 cycle 只是「可能」');
    await beat(tok, 3000);
  }
  async function scMethods(tok) {
    fresh([0, 6, 12.5], [0, 1.6, 0]);
    const M = [['Prevention', '破壞四條件之一'], ['Avoidance', '事先知道 Max，只走 safe state（Banker）'], ['Detection + recovery', '允許發生，再偵測、解除'], ['忽略', '假裝不會發生（多數 OS 的作法）']];
    say('處理 deadlock 的方法（補充：課本）', '');
    await beat(tok, 2000);
    for (let k = 0; k < 4; k++) {
      const x = -4.8 + k * 3.2;
      cube(M[k][0], PCOL[k], [2.8, 0.8, 1.2], x, 0.4, 0, 3);
      tag(M[k][1], 'idx', x, 0, 1.1 + (k % 2) * 0.9);
      say(M[k][0], M[k][1]);
      await beat(tok, 2400);
    }
    say('Banker 是 avoidance：配置之前先檢查', 'detection 是事後：已經卡住了才去找');
    await beat(tok, 3200);
  }
  async function scPrevention(tok) {
    fresh([0, 9, 8.5], [0, 0, 0]);
    const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
    const P = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 3.2); return cube('P' + (k + 1), PCOL[k], [1, 0.8, 1], x, 0.4, z); });
    const R = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k + 0.5, 1.9); return cube('R' + (k + 1), RCOL[k], [0.8, 0.5, 0.8], x, 0.25, z); });
    const C = [
      ['Mutual exclusion：讓資源可共用', 'read-only 檔案可以；印表機不行 → 通常做不到'],
      ['Hold and wait：一次要齊全部才開始', '缺點：資源利用率低、可能 starvation'],
      ['No preemption：要不到就放掉手上的', '適合 CPU register、memory 這種能存回的資源'],
      ['Circular wait：依編號由小到大要', '最實用：P4 要 R3、R4 時先要 R3'],
    ];
    say('Prevention：讓四個條件之一不成立（補充：課本）', '');
    await beat(tok, 2400);
    for (let k = 0; k < 4; k++) { P.forEach((m, j) => glow(m, j === k ? GOLD : null)); say(C[k][0], C[k][1]); await beat(tok, 3200); }
    P.forEach((m) => glow(m, null));
    const [x, z] = pp(3, 2.4); move(R[2], x - 0.3, 0.9, z); glow(P[3], GOLD);
    say('例：P4 先拿 R3（編號小）再拿 R4', '沒有人會「拿大的等小的」→ 不可能繞成一圈');
    await beat(tok, 3200);
  }
  async function scSafeUnsafe(tok) {
    fresh([0, 6, 12.5], [0, 2, 0]);
    say('Safe state：存在一個順序讓大家都做得完（補充：課本）', '12 台 tape drive；P0 max 10、P1 max 4、P2 max 9');
    const rows = [['P0', 10, 5], ['P1', 4, 2], ['P2', 9, 2]];
    const bars = rows.map(([p, mx, h], k) => {
      const z = -1.6 + k * 1.6;
      tag(p + '（max ' + mx + '）', 'ptr', -5.6, 0.2, z);
      for (let j = 0; j < mx; j++) ctx.tile(V3(-3.6 + j * 0.62, 0.03, z), 0.55, 0.9, '#efe5d2');
      return Array.from({ length: h }, (_, j) => cube('', PCOL[k], [0.55, 0.5, 0.9], -3.6 + j * 0.62, 0.25, z, 2));
    });
    const av = tag('Available = 3', 'ptr alt', 4.6, 0.3, -2.6);
    await beat(tok, 3200);
    say('P1 還要 2 ≤ 3 → 先給 P1，做完歸還 4', 'Available 3 → 5');
    for (let j = 2; j < 4; j++) bars[1].push(cube('', PCOL[1], [0.55, 0.5, 0.9], -3.6 + j * 0.62, 0.25, 0, 2));
    await beat(tok, 1400); bars[1].splice(0).forEach((m) => fly(m)); txt(av, 'Available = 5'); await beat(tok, 1600);
    say('P0 還要 5 ≤ 5 → 做完歸還 10', 'Available 5 → 10');
    await beat(tok, 1600); bars[0].splice(0).forEach((m) => fly(m)); txt(av, 'Available = 10'); await beat(tok, 1400);
    say('P2 還要 7 ≤ 10 → 也能做完', '<P1, P0, P2> 是安全序列 → safe');
    await beat(tok, 3000);
    say('如果剛才多給 P2 一台（Available 剩 2）…', '只剩 P1 做得完，之後 Available = 4');
    await beat(tok, 3000);
    say('P0 要 5、P2 要 6 都 > 4 → unsafe', 'unsafe 不等於 deadlock，只是「可能」走到 deadlock');
    await beat(tok, 3600);
  }
  // ───────────────────────── 場景：Banker（影片 7gMLNiEz3nw） ─────────────────────────
  async function scBankerAvoid(tok) {
    fresh([0, 6, 12.5], [0, 1.6, 0]);
    say("Banker's algorithm = deadlock avoidance", '每個 process 事先宣告最多要多少（Max）');
    const P = VIDEO.names.map((p, k) => cube(p, PCOL[k], [0.9, 0.7, 0.9], -4.4 + k * 2.2, 0.35, 1.8));
    await beat(tok, 2800);
    P.forEach((m, k) => tag('Max ' + vec(VIDEO.max[k]), 'idx', -4.4 + k * 2.2, 1.2, 1.8));
    say('OS 根據這些資訊，決定給誰、讓誰等', '像銀行：不借出會讓自己周轉不靈的錢');
    await beat(tok, 3200);
    const w = cube('影片：「也用來 detection」', '#d64545', [5.2, 0.6, 1.0], 0, 0.3, -1.8, 2);
    say('影片說 Banker 也叫 detection algorithm：錯', 'Banker 只用在 avoidance');
    await beat(tok, 3400);
    relabel(w, 'detection：比 Request，事後找');
    tint(w, '#9b7ef4');
    say('detection 是另一個演算法：比較目前的 Request', '不需要 Max；在 deadlock 發生後找出誰卡住');
    await beat(tok, 3400);
    say('缺點：真實程式很難事先知道 Max', '需求是動態的，所以多半只是理論基礎');
    await beat(tok, 3000);
  }
  async function scBankerTables(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    say('5 個 process、3 種資源 A、B、C', '系統共有 A 10、B 5、C 7 個 instance');
    const B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4']] });
    await beat(tok, 3000);
    B.hlRow('Allocation', 0, GOLD);
    say('Allocation：已經配給的。P1 有 (0, 1, 0)', 'P1 還沒拿到任何 A');
    await beat(tok, 2800);
    B.clearHl(); B.hlRow('Max', 2, GOLD);
    say('Max：最多需要多少。P3 是 (9, 0, 2)', '「給我這麼多，我就能做完並結束」');
    await beat(tok, 3000);
    B.clearHl();
    say('影片的 P1–P5 很像課本 P0–P4 那題', '但 P4、P5 的 Max 不同（課本 P3 (2,2,2)、P4 (4,3,3)），答案也不同');
    await beat(tok, 2800);
  }
  async function scBankerAvailable(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    const B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4']], workName: 'Available' });
    say('Available = Total − 已配出去的', '');
    await beat(tok, 2000);
    const col = ['A', 'B', 'C'];
    const sum = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      B.cellsOf('Allocation').forEach((row) => glow(row[k], GOLD));
      sum[k] = S.alloc.reduce((s, r) => s + r[k], 0);
      say(col[k] + ' 已配出：' + S.alloc.map((r) => r[k]).join(' + ') + ' = ' + sum[k], 'Total ' + S.total[k] + ' − ' + sum[k] + ' = ' + (S.total[k] - sum[k]));
      await beat(tok, 2400);
      B.cellsOf('Allocation').forEach((row) => glow(row[k], null));
    }
    B.pushWork(avail0(S), 'Available');
    say('Available = (10, 5, 7) − (7, 2, 5) = (3, 3, 2)', '這是「此刻」的狀態，不是從 0 開始');
    await beat(tok, 3400);
  }
  async function scBankerNeed(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    const need = needOf(S);
    const B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4'], ['Need', S.alloc.map(() => [0, 0, 0]), '#dd8238']] });
    B.cellsOf('Need').forEach((row) => row.forEach((c) => relabel(c, '?')));
    say('Need = Max − Allocation：還要多少', '像小孩要 10 顆蘋果、已給 3 顆 → 還要 7 顆');
    await beat(tok, 3200);
    for (let i = 0; i < 5; i++) {
      B.clearHl(); B.hlRow('Max', i, GOLD); B.hlRow('Allocation', i, GOLD);
      need[i].forEach((v, k) => relabel(B.cellsOf('Need')[i][k], v));
      B.hlRow('Need', i, GREEN);
      say(S.names[i] + '：' + vec(S.max[i]) + ' − ' + vec(S.alloc[i]) + ' = ' + vec(need[i]), i === 2 ? 'A 對 A、B 對 B、C 對 C，逐欄相減' : '');
      await beat(tok, i === 0 ? 2600 : 1900);
    }
    B.clearHl();
    say('Need：P1 (7,4,3)、P2 (1,2,2)、P3 (6,0,0)', 'P4 (2,1,1)、P5 (5,3,1)');
    await beat(tok, 3200);
  }
  async function scBankerSafety(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    const B = board(S); const av = avail0(S); B.pushWork(av, 'Available');
    const r = safety(S.alloc, needOf(S), av, 'cyclic');
    say('找一個 Need ≤ Work 的 process（Work 一開始 = Available）', 'Work = (3, 3, 2)');
    await beat(tok, 3000);
    const cap = {
      P1: ['P1 要 (7, 4, 3)：A 只有 3 → 不行', ''],
      P2: ['P2 要 (1, 2, 2) ≤ (3, 3, 2) → 可以做完', '做完歸還 Allocation (2, 0, 0)：Work = (5, 3, 2)'],
      P3: ['P3 要 (6, 0, 0)：B、C 夠，但 A 只有 5 → 不行', '三種資源要「同時」都夠'],
      P4: ['P4 要 (2, 1, 1) ≤ (5, 3, 2) → 可以', 'Work + (2, 1, 1) = (7, 4, 3)'],
      P5: ['P5 要 (5, 3, 1) ≤ (7, 4, 3) → 可以', 'Work + (0, 0, 2) = (7, 4, 5)'],
    };
    const seen = {};
    for (const st of r.steps) {
      const nm = S.names[st.i];
      if (!seen[nm]) say(cap[nm][0], cap[nm][1]);
      else if (st.ok) say(nm + ' 再檢查：' + vec(st.need) + ' ≤ ' + vec(st.work) + ' → 可以', 'Work = ' + vec(st.after));
      seen[nm] = true;
      await animStep(tok, B, S, st, S.alloc, 1500);
      await beat(tok, 900);
    }
    say('安全序列 P2 → P4 → P5 → P1 → P3', 'Work 最後 = (10, 5, 7) = Total：可以拿來驗算');
    await beat(tok, 3600);
  }
  async function scBankerNonunique(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    const B = board(S); const av = avail0(S); B.pushWork(av, 'Available');
    const r = safety(S.alloc, needOf(S), av, 'restart');
    say('安全序列不唯一：換一種掃法', '每次做完都從 P1 重新找');
    await beat(tok, 2600);
    for (const st of r.steps) { await animStep(tok, B, S, st, S.alloc, 700); }
    say('得到 P2 → P4 → P1 → P3 → P5，也是 safe', '影片得到 P2 → P4 → P5 → P1 → P3；課本是 <P1, P3, P4, P2, P0>');
    await beat(tok, 3800);
    say('考題可能問「哪一個是安全序列」→ 逐一驗算', '要每一步都找得到 Need ≤ Work 才算 safe');
    await beat(tok, 3400);
  }
  async function scBankerRequest(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    const S = cloneS(VIDEO);
    say('Resource-request（補充：課本）：P2 請求 (1, 0, 2)', '課本是 P1 提出同一個 request；這裡用影片的數字');
    let B = board(S); B.pushWork(avail0(S), 'Available');
    B.hlRow('Need', 1, GOLD);
    await beat(tok, 3000);
    say('① Request ≤ Need (1, 2, 2) ✓　② ≤ Available (3, 3, 2) ✓', '');
    await beat(tok, 2800);
    const T = cloneS(S); T.alloc[1] = add(T.alloc[1], [1, 0, 2]);
    lab.clear(); B = board(T); B.pushWork(avail0(T), 'Available'); B.hlRow('Allocation', 1, GOLD); B.hlRow('Need', 1, GOLD);
    say('③ 假裝配給：Available (2, 3, 0)、P2 Allocation (3, 0, 2)', 'Need 變 (0, 2, 0)');
    await beat(tok, 3200);
    const r = safety(T.alloc, needOf(T), avail0(T), 'cyclic');
    say('④ 跑 safety', '');
    for (const st of r.steps) await animStep(tok, B, T, st, T.alloc, 650);
    say('safe（P2 → P4 → P5 → P1 → P3）→ 正式配給', '');
    await beat(tok, 3000);
    say('接著 P5 要 (3, 3, 0)：> Available (2, 3, 0) → 等', 'P1 要 (0, 2, 0)：夠，但配了會 unsafe → 也不給');
    await beat(tok, 4000);
  }
  async function scWaitFor(tok) {
    fresh([0, 9, 9.5], [0, 0, 0.2]);
    const G = { P: ['P1', 'P2', 'P3'], R: [['R1', 1], ['R3', 1]] };
    say('Wait-for graph（補充：課本）', '每種資源只有一個 instance 時用');
    const V = ragView(G, parseEdges('P1->R1, R1->P2, P2->R3, R3->P3', G.P, G.R).out);
    await beat(tok, 3000);
    say('把資源節點收掉：P1 → R1 → P2 變成 P1 → P2', 'Pi → Pj：Pi 在等 Pj 放資源');
    await beat(tok, 2600);
    const p = V.pPos;
    lab.clear();
    G.P.forEach((n, k) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 24), new THREE.MeshStandardMaterial({ color: PCOL[k] })); m.position.copy(p[n]); m.add(lab.label(n, 'val')); lab.world.add(m); });
    arrow(p.P1.clone().setY(0.7), p.P2.clone().setY(0.7), '#d64545', 0.75);
    await beat(tok, 900);
    arrow(p.P2.clone().setY(0.7), p.P3.clone().setY(0.7), '#d64545', 0.75);
    say('得到 P1 → P2 → P3', '定期找 cycle：有 cycle 就是 deadlock（O(n²)）');
    await beat(tok, 2600);
    arrow(p.P3.clone().setY(0.9).setZ(-0.6), p.P1.clone().setY(0.9).setZ(-0.6), '#c08a1f', 0.75);
    say('若 P3 也在等 P1 → cycle → deadlock', '多 instance 時 wait-for graph 不夠用，要用 detection 演算法');
    await beat(tok, 3400);
  }
  async function scDetection(tok) {
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    let S = cloneS(DET);
    say('多 instance 的 detection（補充：課本）', 'A 7、B 2、C 6；Available = (0, 0, 0)');
    let B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Request', S.req, '#dd8238']] }); B.pushWork(avail0(S), 'Available');
    await beat(tok, 3000);
    say('跟 Banker 很像，但比的是「目前的 Request」', 'Request ≤ Work → 假設它做得完');
    let r = detect(S);
    for (const st of r.steps) await animStep(tok, B, S, st, S.alloc, 650);
    say('全部 Finish = true → 目前沒有 deadlock', '這次順序 P0 → P2 → P3 → P4 → P1（課本寫 <P0, P2, P3, P1, P4>，都對）');
    await beat(tok, 3000);
    fresh([0, 3.2, 14], [0, 2.4, 0]);
    S = cloneS(DET); S.req[2] = [0, 0, 1];
    B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Request', S.req, '#dd8238']] }); B.pushWork(avail0(S), 'Available');
    say('如果 P2 再多要一個 C', 'Request[P2] = (0, 0, 1)');
    await beat(tok, 2400);
    r = detect(S);
    for (const st of r.steps) await animStep(tok, B, S, st, S.alloc, 650);
    r.dead.forEach((i) => B.hlRow('Allocation', i, RED));
    say('只有 P0 能做完，P1–P4 卡住 → deadlock', 'Finish 仍為 false 的就是 deadlocked process');
    await beat(tok, 3600);
  }
  async function scRecovery(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    say('偵測到 deadlock 後怎麼解？（補充：課本）', '');
    const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
    const P = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 2.6); return cube('P' + (k + 1), PCOL[k], [1, 0.8, 1], x, 0.4, z); });
    P.forEach((m) => glow(m, RED));
    await beat(tok, 2200);
    say('① Process termination：全部 abort，或一次 abort 一個', '一個一個殺：每殺一個就要重跑 detection');
    await beat(tok, 2600);
    fly(P[2], V3(2, 7, -2));
    P.forEach((m, k) => { if (k !== 2) glow(m, GREEN); });
    say('選 victim：priority、跑多久、用了多少資源…', 'cost 最小的先犧牲');
    await beat(tok, 3000);
    say('② Resource preemption：搶走資源給別人', 'rollback 到安全的點再重來（最簡單：total rollback）');
    await beat(tok, 3200);
    say('小心 starvation：同一個 victim 一直被選', '把 rollback 次數算進 cost');
    await beat(tok, 3000);
  }

  const scenes = {
    'deadlock-intro': { title: 'System model：request、use、release（課本）', play: scIntro },
    'four-conditions': { title: 'Deadlock 四個必要條件（課本）', play: scFour },
    'rag-basic': { title: 'Resource-allocation graph：有沒有 cycle（課本）', play: scRAG },
    'rag-cycle-ok': { title: '有 cycle 但沒有 deadlock：多個 instance（課本）', play: scRAGCycleOk },
    'handling-methods': { title: '處理 deadlock 的四種方式（課本）', play: scMethods },
    'prevention': { title: 'Deadlock prevention：破壞四條件之一（課本）', play: scPrevention },
    'safe-unsafe': { title: 'Safe / unsafe state：12 台 tape drive（課本）', play: scSafeUnsafe },
    'banker-avoid': { title: "Banker's 是 avoidance（影片誤稱 detection）", play: scBankerAvoid },
    'banker-tables': { title: 'Banker 例題：Total、Allocation、Max', play: scBankerTables },
    'banker-available': { title: 'Available = Total − ΣAllocation = (3, 3, 2)', play: scBankerAvailable },
    'banker-need': { title: 'Need = Max − Allocation', play: scBankerNeed },
    'banker-safety': { title: 'Safety algorithm：P2 → P4 → P5 → P1 → P3', play: scBankerSafety },
    'banker-nonunique': { title: '安全序列不唯一', play: scBankerNonunique },
    'banker-request': { title: 'Resource-request algorithm：P2 要 (1, 0, 2)（課本）', play: scBankerRequest },
    'wait-for': { title: 'Wait-for graph（課本）', play: scWaitFor },
    'detection': { title: 'Deadlock detection：Allocation + Request（課本）', play: scDetection },
    'recovery': { title: 'Recovery：termination 與 resource preemption（課本）', play: scRecovery },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ dl.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { GOLD, GREEN, RED } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 6 章 Deadlock（清大周志遠 22A–22D、Necessary Conditions 影片、Gate Smashers Banker）— cued scenes ───
// 每個 `await step(tok)` 等老師講到那一句才動（notes 的 cues；註解 @秒數 就是 cue）。步與步之間只有短動作（≤ ~2.5 s），
// 不重播、不循環。數字一律照老師的例子：清大用恐龍書的圖與表（P0–P4，A/B/C 10/5/7、12 台 tape drive、
// detection 的 7/2/6），Gate Smashers 用 P1–P5 版（P4 Max 4,2,2、P5 Max 5,3,3）。老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const tx = (l, t) => P.txt(l, t);
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.9, drop = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const pal = (name, color, x, y = 0, z = 0, s = 0.7) => buddy(name, '', color, x, y, z, s);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.kill) o.kill(); else kill(o); });
const put = (o, x, y, z = 0) => P.move(o, x, y, z);
async function slide(tok, o, x, y, z = 0, ms = 700) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a thick arrow (cylinder + cone); dashed for claim edges; paint() recolours it
function pipe(a, b, color = '#8a7a5c', sa = 0.55, sb = 0.55, r = 0.045, dashed = false) {
  const dir = b.clone().sub(a).normalize();
  const s = a.clone().addScaledVector(dir, sa), e = b.clone().addScaledVector(dir, -sb);
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color });
  const L = Math.max(0.05, e.distanceTo(s) - 0.3);
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
  if (!dashed) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 8), mat);
    sh.position.copy(s.clone().addScaledVector(dir, L / 2)); sh.quaternion.copy(q); g.add(sh);
  } else {
    for (let u = 0; u + 0.22 <= L; u += 0.4) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 6), mat);
      sh.position.copy(s.clone().addScaledVector(dir, u + 0.11)); sh.quaternion.copy(q); g.add(sh);
    }
  }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), mat);
  head.position.copy(e.clone().addScaledVector(dir, -0.16)); head.quaternion.copy(q); g.add(head);
  lab.world.add(g); g.userData.mat = mat; return g;
}
const paint = (g, c) => g.userData.mat.color.set(c);
const ECOL = { req: '#8a7a5c', asg: '#2f8a5f', claim: '#9b7ef4', hot: '#d64545', wait: '#d64545' };
// resource-allocation graph: processes are buddies, resources are boxes with one white dot per instance
function rag(spec) {
  const pos = {}, node = {}, E = [];
  Object.entries(spec.P || {}).forEach(([n, [x, z]], k) => { pos[n] = V3(x, 0.5, z); node[n] = pal(n, PCOL[(spec.pc || 0) + k % PCOL.length], x, 0, z, 0.62); });
  Object.entries(spec.R || {}).forEach(([n, [x, z, cnt]], k) => {
    pos[n] = V3(x, 0.5, z);
    const m = bx('', RCOL[k % RCOL.length], x, 0.25, z, 1.3, 0.5, 1.0);
    const dots = []; for (let d = 0; d < cnt; d++) dots.push(bx('', '#fbf7f0', x - (cnt - 1) * 0.15 + d * 0.3, 0.56, z, 0.18, 0.12, 0.18));
    const l = hd(n, x, 0.3, z + 0.85);
    node[n] = { m, dots, l, kill() { kill(m); dots.forEach(kill); kill(l); } };
  });
  const G = {
    pos, node, E,
    add(a, b, kind = 'req') { const g = pipe(pos[a], pos[b], ECOL[kind], 0.72, 0.72, kind === 'claim' ? 0.032 : 0.05, kind === 'claim'); const e = { a, b, kind, g }; E.push(e); return e; },
    find(a, b) { return E.find((e) => e.a === a && e.b === b); },
    paint(a, b, c) { const e = G.find(a, b); if (e) paint(e.g, c); },
    cut(a, b) { const i = E.findIndex((e) => e.a === a && e.b === b); if (i >= 0) { kill(E[i].g); E.splice(i, 1); } },
    retype(a, b, kind, flip = false) { G.cut(a, b); return flip ? G.add(b, a, kind) : G.add(a, b, kind); },
    path(names, c = ECOL.hot) { for (let k = 0; k + 1 < names.length; k++) G.paint(names[k], names[k + 1], c); },
    kill() { E.forEach((e) => kill(e.g)); E.length = 0; Object.values(node).forEach((n) => gone(n)); },
  };
  return G;
}
// the same table drawn by os-6's board(), but the cells start blank ('?' or ' ') so they can be filled one by one
function blankRows(B, name, rows, mark = ' ') { rows.forEach((i) => B.cellsOf(name)[i].forEach((c) => P.relabel(c, mark))); }
function fillRow(B, name, i, vals) { vals.forEach((v, k) => P.relabel(B.cellsOf(name)[i][k], v)); }
function workGlow(B, c) { B.lastWork().slice(0, 3).forEach((m) => glow(m, c)); }
// one comparison: Need[i] (or Request[i]) against the current Work, each column green / red
function judge(B, name, i, need, work) { B.clearHl(); B.hlRow(name, i, GOLD); need.forEach((v, k) => glow(B.cellsOf(name)[i][k], v <= work[k] ? GREEN : RED)); workGlow(B, GOLD); return need.every((v, k) => v <= work[k]); }
const TB = { names: ['P0', 'P1', 'P2', 'P3', 'P4'], res: ['A', 'B', 'C'], total: [10, 5, 7],
  alloc: [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]], max: [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]] };

// ════════ efH4nuwUalA（第 22A 講 System Model & Deadlock Characterization） ════════
FRAG.push(['dl-a-intro', '第七章：lock 用不好就會 deadlock', async (tok) => {
  fresh([0, 5, 13], [0, 1.6, 0]);
  await step(tok); // @14.2 第七章 deadlock，接著第六章 synchronization
  hd('第七章：Deadlock', 0, 4.8);
  const a = pal('P1', PCOL[0], -3, 0, 0.8), b = pal('P2', PCOL[1], 3, 0, 0.8);
  cap('第七章：deadlock', '接著第六章的 synchronization');
  await step(tok); // @17.1 用 lock 保證一次一個程式
  const lk = prop('lock', 0, 0, -0.6, 1.3);
  hd('lock', 0, 1.4, -0.6);
  put(lk, -3, 1.0, 0.8); a.mood('happy'); b.look(-1);
  cap('為了 critical section，引入 lock', '保證一次只有一個程式使用這個 resource');
  await step(tok); // @49.1 寫得不好 → 你等我、我等你
  const lk2 = prop('lock', 3, 1.0, 0.8, 1.3);
  const w1 = pipe(V3(-2.4, 0.9, 0.8), V3(2.4, 0.9, 0.8), '#d64545', 0.1, 0.1);
  const w2 = pipe(V3(2.4, 0.4, 0.8), V3(-2.4, 0.4, 0.8), '#d64545', 0.1, 0.1);
  bub('等你放手', -3, 2.4, 0.8); bub('等你放手', 3, 2.4, 0.8);
  cap('lock 用得不好，就會 deadlock', '你等我、我等你');
  await step(tok); // @53.3 所有 process 都沒辦法繼續執行
  a.mood('sad'); b.mood('sad'); a.glow(RED); b.glow(RED);
  cap('process 互相在等，全部都不能繼續執行', '這就是 deadlock');
  await step(tok); // @76.3 prevention：系統設計時就讓它不會發生
  gone(a, b, lk, lk2, w1, w2);
  const pv = bx('Prevention', PCOL[2], -3, 0.4, 0.5, 3.4, 0.8, 1.2, 2);
  idx('事先定 rule，把可能性 eliminate', -3, 1.4, 0.5);
  cap('Prevention：以系統設計的角度', '不管使用者怎麼寫程式，都不會有 deadlock');
  await step(tok); // @98.0 avoidance：執行過程中動態偵測
  bx('Avoidance', PCOL[3], 3, 0.4, 0.5, 3.4, 0.8, 1.2, 2);
  idx('run time 看系統狀態再決定', 3, 1.4, 0.5);
  cap('Avoidance：執行過程中動態看系統狀態', '在 run time 偵測，然後避開');
  await step(tok); // @123.5 本章：兩種方法＋基本定義
  glow(pv, GOLD);
  hot('本章：定義 → prevention → avoidance', 0, 3.2);
  cap('本章重點：deadlock 的定義', '再講 prevention 與 avoidance 各有哪些方法');
}]);

FRAG.push(['dl-a-what', '什麼是 deadlock：hold 著資源又在等', async (tok) => {
  fresh([0, 5, 13], [0, 1.6, 0]);
  await step(tok); // @137.5 什麼是 deadlock（high level）
  hd('什麼是 deadlock？', 0, 4.8);
  const a = pal('P1', PCOL[0], -3.2, 0, 1), b = pal('P2', PCOL[1], 3.2, 0, 1);
  cap('什麼是 deadlock？', '先從 concept 的角度描述');
  await step(tok); // @152.0 process 執行需要 resource（很抽象）
  const r1 = bx('R1', RCOL[0], -1.2, 0.3, -1.6, 1.2, 0.6, 0.9), r2 = bx('R2', RCOL[1], 1.2, 0.3, -1.6, 1.2, 0.6, 0.9);
  const rsT = idx('一段程式、memory content、CPU core 的 slot…', 0, 1.3, -1.6);
  cap('process 執行時需要 resource', 'resource 很抽象：佔有它才能繼續執行的東西');
  await step(tok); // @188.3 資源有限，被搶走就要等
  put(r1, -4.7, 0.3, 1); a.mood('happy');
  cap('資源是有限的', '被別人拿走時，你只能在那邊等');
  await step(tok); // @197.3 需要很多 resource → 各自掌握部分 → 互相等待
  put(r2, 4.7, 0.3, 1); b.mood('happy');
  const w1 = pipe(V3(-2.6, 0.9, 1), V3(2.6, 0.9, 1), '#d64545', 0.1, 0.1);
  const w2 = pipe(V3(2.6, 0.45, 1), V3(-2.6, 0.45, 1), '#d64545', 0.1, 0.1);
  cap('要用很多 resource 時', '各自掌握一部分，然後互相等待 → 卡住');
  await step(tok); // @219.3 hold 著又 wait，等不到也不放
  a.mood('sad'); b.mood('sad');
  const hw1 = bub('hold R1，wait R2', -3.2, 2.2, 1), hw2 = bub('hold R2，wait R1', 3.2, 2.2, 1);
  cap('hold 著 resource，同時又在 wait', '等不到下一個，手上的又不願意放 → 卡住');
  await step(tok); // @238.9 例：兩個 tape drive
  gone(a, b, r1, r2, w1, w2, hw1, hw2, rsT);
  const c = pal('P1', PCOL[0], -3.2, 0, 1), d = pal('P2', PCOL[1], 3.2, 0, 1);
  const t1 = prop('disk', -1.2, 0, -1.6, 0.9, 'drive 1'), t2 = prop('disk', 1.2, 0, -1.6, 0.9, 'drive 2');
  cap('例：兩個 tape drive', '一個 drive 一次只能給一個程式用；程式要同時寫到兩個');
  await step(tok); // @270.2 兩個 process 各 hold 一個再等另一個
  put(t1, -4.8, 0, 1); put(t2, 4.8, 0, 1);
  pipe(V3(-2.6, 0.7, 1), V3(2.6, 0.7, 1), '#d64545', 0.1, 0.1); pipe(V3(2.6, 0.3, 1.3), V3(-2.6, 0.3, 1.3), '#d64545', 0.1, 0.1);
  c.mood('sad'); d.mood('sad');
  cap('剛好兩個 process 各拿到一個，再等另一個', '兩個都不退讓 → 永遠卡在那裡');
  await step(tok); // @313.0 例：A、B 兩個 semaphore
  gone(c, d, t1, t2); lab.world.children.filter((o) => o.userData && o.userData.mat).forEach((o) => kill(o));
  const e = pal('P0', PCOL[2], -3.2, 0, 1), f = pal('P1', PCOL[3], 3.2, 0, 1);
  const cA = P.code(['wait(A);', 'wait(B);', '…', 'signal(A);', 'signal(B);'], -3.2, 4.2, 0.45, -1);
  const cB = P.code(['wait(B);', 'wait(A);', '…', 'signal(B);', 'signal(A);'], 3.2, 4.2, 0.45, -1);
  cap('另一個例子：A、B 兩個 semaphore', '兩邊都要拿到 A 和 B 才做事');
  await step(tok); // @324.5 順序不好：兩邊各先 grab 一個
  cA.hl(0); cB.hl(0);
  const sA = bx('A', '#c08a1f', -4.4, 0.25, 1, 0.6, 0.4, 0.6), sB = bx('B', '#6a7fd0', 4.4, 0.25, 1, 0.6, 0.4, 0.6);
  await wt(tok, 500);
  cA.hl(1); cB.hl(1); e.mood('sad'); f.mood('sad');
  bub('等 B', -3.2, 1.75, 1); bub('等 A', 3.2, 1.75, 1);
  cap('call 的順序不好：兩邊都先 grab 了一個', '要兩個都有才肯放 → 一樣 deadlock');
  await step(tok); // @355.0 需要 acquire multiple 資源又被搶 → deadlock
  glow(sA, RED); glow(sB, RED);
  hot('需要 multiple resource ＋ 被別人拿走 → deadlock', 0, -0.5, 2.6);
  cap('只要一個程式需要 acquire 多個資源', '而這些資源又被別人搶走，就可能 deadlock');
}]);

FRAG.push(['dl-a-four', 'Deadlock 四個必要條件', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.2, 0]);
  const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
  await step(tok); // @373.6 formally：四個條件
  const B = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 3.0); return pal('P' + (k + 1), PCOL[k], x, 0, z, 0.6); });
  const R = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k + 0.5, 1.7); return bx('R' + (k + 1), RCOL[k], x, 0.25, z, 0.8, 0.5, 0.8); });
  const list = ['① Mutual exclusion', '② Hold and wait', '③ No preemption', '④ Circular wait'].map((t, k) => tag(t, 'idx', -5.6, 4.4 - k * 0.6, -1));
  cap('formally：deadlock 有四個條件', '而且是 necessary（必要條件）');
  await step(tok); // @387.6 同時成立，缺一個就不會 deadlock
  hot('四個要「同時」成立', 3.2, 4.4, -1);
  cap('四個條件要同時發生才會 deadlock', '缺任何一個，就不會有 deadlock');
  await step(tok); // @393.0 ① mutual exclusion：一次只有一個人用
  list[0].element.className = 'lab-label ptr alt';
  R.forEach((m) => glow(m, GOLD));
  cap('① Mutual exclusion', '一個 resource 一次只能有一個人使用');
  await step(tok); // @404.3 可以 share 就不會 waiting
  const sh = good('可以 share → 不用等 → 不可能 deadlock', 0, 3.2, 0);
  cap('如果很多人可以同時使用（resource 可以 share）', '就不會有 waiting，也就不可能 deadlock');
  await step(tok); // @418.2 解 critical section 一定要這條件
  gone(sh);
  note('解 critical section 就需要 mutual exclusion', 0, 3.2, 0);
  cap('這個條件很常發生', '解 critical section 本來就需要它');
  await step(tok); // @438.0 ② hold and wait
  list[0].element.className = 'lab-label idx'; list[1].element.className = 'lab-label ptr alt';
  R.forEach((m, k) => { glow(m, null); const [x, z] = pp(k, 2.1); put(m, x + 0.35, 0.9, z); });
  cap('② Hold and wait', '已經取得一個，還少一個，就把第一個一直 hold 著等');
  await step(tok); // @467.2 不 hold：拿不到就全部放棄
  const hw = good('拿不到就全部放掉、重新來過 → 不會 deadlock', 0, 3.2, 0);
  cap('反過來：要嘛全部拿到，要嘛全部放掉', '沒有 hold，就不會 deadlock');
  await step(tok); // @499.5 ③ no preemption
  gone(hw);
  list[1].element.className = 'lab-label idx'; list[2].element.className = 'lab-label ptr alt';
  B.forEach((b) => b.glow(GOLD));
  cap('③ No preemption', '程式不能被別人強迫把 resource 放掉，只能自願 release');
  await step(tok); // @518.7 可以 preempt（kill 掉）就不會有人等
  const np = good('可以強迫放掉（例如 kill）→ 沒有人會等', 0, 3.2, 0);
  cap('如果可以 preemption', '你等的那個人可以被強迫放掉 resource，就沒人會等');
  await step(tok); // @546.6 printer 印到一半不能 preempt
  gone(np);
  const pr = prop('printer', 0, 0, 0, 0.8, '印到一半？');
  cap('但很多時候沒辦法 preempt：例如 printer 印到一半', 'state 記不下來，或記下來 resume 的 cost 很大');
  await step(tok); // @583.6 ④ circular wait
  gone(pr);
  list[2].element.className = 'lab-label idx'; list[3].element.className = 'lab-label ptr alt';
  B.forEach((b) => b.glow(null));
  const W = [];
  for (let k = 0; k < N; k++) { const [x1, z1] = pp(k, 3.0), [x2, z2] = pp(k + 1, 3.0); W.push(pipe(V3(x1, 0.9, z1), V3(x2, 0.9, z2), '#d64545', 0.7, 0.7)); await wt(tok, 250); }
  B.forEach((b) => { b.glow(RED); b.mood('sad'); });
  cap('④ Circular wait：互相等，繞成一圈', '有點像 hold and wait 延伸到多個程式');
  await step(tok); // @600.0 單純你等我、我沒等你 → 最終會解開
  kill(W[3]); B[3].glow(GREEN); B[3].mood('happy');
  const one = note('沒繞成圈：最後一個做完放手，大家依序解開', 0, 3.2, 0);
  cap('如果只是你等我、我沒有等你，沒有變成 circle', 'eventually 會解開（只是等很久）→ 不叫 deadlock');
  await step(tok); // @622.4 deadlock 一定找得到 circular wait
  gone(one);
  W[3] = pipe(V3(pp(3, 3.0)[0], 0.9, pp(3, 3.0)[1]), V3(pp(0, 3.0)[0], 0.9, pp(0, 3.0)[1]), '#d64545', 0.7, 0.7);
  B[3].glow(RED); B[3].mood('sad');
  cap('deadlock 發生時，一定找得到一個 circular wait', 'process 互相等，繞回原點');
}]);

FRAG.push(['dl-a-traffic', '交通的例子：四台車卡在路口', async (tok) => {
  fresh([0, 9, 8], [0, 0, 0]);
  const cars = [], C = [[-1.1, -0.6, 'E'], [0.6, -1.1, 'S'], [1.1, 0.6, 'W'], [-0.6, 1.1, 'N']];
  await step(tok); // @633.0 交通的例子
  ctx.tile(V3(0, 0.02, 0), 14, 2.6, '#cfc6b6'); ctx.tile(V3(0, 0.03, 0), 2.6, 12, '#cfc6b6');
  const cells = [[-0.65, -0.65], [0.65, -0.65], [0.65, 0.65], [-0.65, 0.65]].map(([x, z]) => ctx.tile(V3(x, 0.05, z), 1.2, 1.2, '#efe5d2'));
  C.forEach(([x, z], k) => { const dx = Math.sign(x) * (Math.abs(x) > 1 ? 1 : 0), dz = Math.sign(z) * (Math.abs(z) > 1 ? 1 : 0); cars.push(bx('🚗', PCOL[k], x + dx * 0.0, 0.3, z + dz * 0.0, Math.abs(x) > 1 ? 1.0 : 0.6, 0.5, Math.abs(z) > 1 ? 1.0 : 0.6)); });
  [[-3.5, -0.6], [0.6, -3.5], [3.5, 0.6], [-0.6, 3.5]].forEach(([x, z], k) => bx('', PCOL[k], x, 0.3, z, Math.abs(x) > 1 ? 1.0 : 0.6, 0.5, Math.abs(z) > 1 ? 1.0 : 0.6));
  cap('一個幫大家記住的例子：交通', '四個方向的車剛好全部卡在路口，沒有一台能動');
  await step(tok); // @660.4 mutual exclusion：路口一塊空間一次一台
  cells.forEach((c) => { c.material.color.set('#f3d36b'); });
  hd('路口每一格 = resource', 0, 1.6, -2.4);
  cap('Mutual exclusion：路口每一塊空間 = 資源', '一次只能有一台車，不能兩台撞在一起');
  await step(tok); // @683.0 hold and wait
  cars.forEach((c) => glow(c, GOLD));
  bub('hold 這格，wait 前面那格', 4.7, 1.4, -2.4);
  cap('Hold and wait：車停在這一格（hold）', '在等前面那一格（wait）');
  await step(tok); // @700.0 黃線：不能停在路口
  note('路口畫黃線：不准停 → 不准 hold and wait', -4.3, 0.6, 3.0);
  cap('所以路口會畫黃線，不能停在那裡', '一停就有 hold and wait');
  await step(tok); // @716.3 no preemption：一般車不能叫前面讓開
  bub('一般車不能叫前面的讓開', -4.7, 1.4, -2.6);
  cap('No preemption：一般車子不能強迫前面的人讓開', '只有消防車、救護車才有權 preempt');
  await step(tok); // @737.5 circular wait：互相等
  for (let k = 0; k < 4; k++) { const [x1, z1] = C[k], [x2, z2] = C[(k + 1) % 4]; pipe(V3(x1, 0.8, z1), V3(x2, 0.8, z2), '#d64545', 0.3, 0.3, 0.04); }
  cars.forEach((c) => glow(c, RED));
  cap('Circular wait：四台車互相等待', '路口如果沒被 hold 住，最後大家都過得去');
  await step(tok); // @753.0 電腦裡同理
  hot('電腦裡：路口 = lock、shared memory、physical resource', 0, 1.8, 3.4);
  cap('電腦裡是一樣的道理', '路口換成 lock、shared memory 空間或 physical resource');
  await step(tok); // @778.3 necessary：解掉任一個就不會 deadlock
  good('解掉其中一個 → 不會 deadlock', 0, 1.8, -3.4);
  cap('necessary：四個同時存在才 deadlock；解掉任何一個就沒有', '但這四個都是電腦運作常需要的');
}]);

FRAG.push(['dl-a-model', 'System model：resource type、instance、request → use → release', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @800.7 用數學模型描述
  hd('System model', 0, 4.8);
  cap('知道定義後，用數學模型來描述', '之後才能用圖、用演算法去解');
  await step(tok); // @822.0 resource type
  const T = [['CPU', 4], ['memory', 1], ['disk', 2], ['lock', 1]];
  const cols = T.map(([n], k) => { const x = -4.5 + k * 3; return { x, box: bx(n, RCOL[k], x, 0.35, 0, 2.2, 0.7, 1.4, 2) }; });
  cap('Resource type：CPU、memory、device、lock…', '注意這只是「type」');
  await step(tok); // @845.5 每個 type 有多個 instance
  T.forEach(([, n], k) => { for (let d = 0; d < n; d++) bx('', '#fbf7f0', cols[k].x - (n - 1) * 0.25 + d * 0.5, 0.82, 0, 0.3, 0.22, 0.3); idx(n + ' 個 instance' + (k === 0 || k === 2 ? '' : '（示意）'), cols[k].x, 1.4, 0.8); });
  cap('每種 type 可以有多個 instance', '例：multi-core 有 4 個 CPU、hard drive 有 2 個');
  await step(tok); // @868.5 像 counting semaphore
  note('像 counting semaphore：是一個數量，不一定只有 0 或 1', 0, 2.5, 0);
  cap('就像 counting semaphore', 'instance 是可以數的數量');
  await step(tok); // @886.0 程式需要哪些 resource、各幾個
  const p = pal('Pi', PCOL[0], -4.5, 0, 3.0, 0.65);
  bub('要 CPU ×1、disk ×2', -2.0, 0.5, 4.2);
  cap('程式的執行可以描述成', '需要哪些 resource，每一種要幾個 instance');
  await step(tok); // @905.2 request → use → release
  const steps = ['request', 'use', 'release'].map((t, k) => bx(t, ['#dd8238', '#2fc092', '#4b9ee2'][k], 0.4 + k * 2.4, 0.3, 3.0, 2.0, 0.5, 0.8));
  glow(steps[0], GOLD); await wt(tok, 500); glow(steps[0], null); glow(steps[1], GOLD); await wt(tok, 500); glow(steps[1], null); glow(steps[2], GOLD);
  cap('使用過程一直重複：request → use → release', '用完之後才放掉');
  await step(tok); // @917.0 使用中被佔住 → dependency → deadlock
  glow(steps[2], null); glow(steps[1], RED); p.mood('wow');
  cap('使用中 resource 被這個 process 佔住，別人不能用', 'process 之間因此有 dependency，就可能 deadlock');
}]);

FRAG.push(['dl-a-rag', 'Resource-allocation graph：request edge 與 assignment edge', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.2]);
  let G = null;
  await step(tok); // @940.0 把 symbol 畫成圖
  hd('用 graph 看 process 之間的關係', 0, 2.6, -4.2);
  cap('用剛才的 symbol 畫成一張圖', '關係這件事，最好用 graph 去理解');
  await step(tok); // @963.4 resource allocation graph
  const ragT = hot('Resource-allocation graph', 0, 2.0, -4.2);
  cap('這張圖叫 resource-allocation graph', '用它描述系統目前的狀態');
  await step(tok); // @974.0 process：圓圈，三個
  G = rag({ P: { P1: [-3.5, 0], P2: [0, 0], P3: [3.5, 0] } });
  cap('process 通常畫成圓圈（這裡是小人）', '假設有三個 process：P1、P2、P3');
  await step(tok); // @983.0 resource：方塊，點 = instance
  const R = rag({ R: { R1: [-1.75, -2.6, 1], R3: [1.75, -2.6, 1], R2: [-1.75, 2.6, 2], R4: [1.75, 2.6, 3] } });
  Object.assign(G.pos, R.pos); Object.assign(G.node, R.node);
  cap('resource 畫成方塊，裡面每個點是一個 instance', 'R1、R3 各 1 個，R2 有 2 個，R4 有 3 個');
  await step(tok); // @1005.7 request edge：P → R
  G.add('P1', 'R1', 'req'); await wt(tok, 400); G.add('P2', 'R3', 'req');
  cap('process 需要 resource：畫一條有方向的 edge P → R', '叫 request edge：P1 要 R1、P2 要 R3');
  await step(tok); // @1037.6 像進 critical section 要等 lock
  G.node.P1.mood('wow');
  bub('等到拿到為止', -3.5, 1.7, 0);
  cap('就像進 critical section 需要某一個 lock', '要等在那裡，直到取得為止');
  await step(tok); // @1050.5 assignment edge：R → P
  for (const [a, b] of [['R1', 'P2'], ['R2', 'P2'], ['R2', 'P1'], ['R3', 'P3']]) { G.add(a, b, 'asg'); await wt(tok, 350); }
  cap('已經拿到：畫 assignment edge，方向 R → P', 'R1、R2 給 P2；另一個 R2 給 P1；R3 給 P3');
  await step(tok); // @1064.6 顏色不重要，方向才重要
  note('灰：request（P → R）　綠：assignment（R → P）', 0, 0.1, 5.4);
  cap('顏色不重要，重點是方向', 'R → P：這個 instance 已經 assign 給 process、正在使用');
  await step(tok); // @1101.0 hold and wait：P1 hold R2、wait R1
  G.paint('R2', 'P1', GOLD); G.paint('P1', 'R1', GOLD); G.node.P1.glow(GOLD);
  cap('從圖上就看得到 hold and wait', 'P1 hold 一個 R2 的 instance，又在 wait R1');
  await step(tok); // @1125.5 從圖看有沒有 circular waiting
  G.paint('R2', 'P1', ECOL.asg); G.paint('P1', 'R1', ECOL.req); G.node.P1.glow(null);
  cap('也可以從圖上看有沒有 circular waiting', '用圖學的 algorithm 來解');
  await step(tok); // @1141.1 用它判斷 deadlock、request 能不能給
  tx(ragT, '之後：用這張圖判斷有沒有 deadlock、request 能不能給');
  cap('用這張圖描述系統狀態', '判斷現在有沒有 deadlock，或答應 request 未來會不會危險');
}]);

FRAG.push(['dl-a-cycle', '有 cycle 一定 deadlock 嗎？兩個例子', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.2]);
  let G = null;
  const L1 = { P: { P1: [-3.5, 0], P2: [0, 0], P3: [3.5, 0] }, R: { R1: [-1.75, -2.6, 1], R3: [1.75, -2.6, 1], R2: [-1.75, 2.6, 2], R4: [1.75, 2.6, 3] } };
  await step(tok); // @1174.1 circular wait 是四條件之一
  G = rag(L1);
  [['P1', 'R1', 'req'], ['P2', 'R3', 'req'], ['R1', 'P2', 'asg'], ['R2', 'P2', 'asg'], ['R2', 'P1', 'asg'], ['R3', 'P3', 'asg']].forEach(([a, b, k]) => G.add(a, b, k));
  cap('circular wait 是四個條件之一', '所以先看圖上有沒有 circle');
  await step(tok); // @1184.0 沒有 circle → 一定沒有 deadlock
  ['P1', 'P2', 'P3'].forEach((p) => G.node[p].glow(GREEN));
  good('沒有 circle → 一定沒有 deadlock', 0, 2.2, -4.4);
  cap('畫出系統狀態，找不到任何 circle', '少了一個必要條件 → 一定沒有 deadlock');
  await step(tok); // @1200.1 有 circle 不一定 deadlock
  cap('那有 circle，是不是就證明有 deadlock？', '不一定 —— 看兩個例子');
  await step(tok); // @1222.2 例一：P1 等 P2（R1 只有一個，在 P2 手上）
  ['P1', 'P2', 'P3'].forEach((p) => G.node[p].glow(null));
  G.path(['P1', 'R1', 'P2']); G.node.P1.mood('sad');
  cap('例一：P1 要 R1，R1 只有一個、在 P2 手上', '所以 P1 在 waiting for P2');
  await step(tok); // @1241.6 P2 也在等 P3
  G.path(['P2', 'R3', 'P3']); G.node.P2.mood('sad');
  cap('同樣道理，P2 要 R3，R3 在 P3 手上', 'P2 在等 P3');
  await step(tok); // @1253.4 P3 是不是在等 P1？（多一條 P3 → R2）
  G.add('P3', 'R2', 'req'); G.paint('P3', 'R2', GOLD);
  cap('最後：P3 是不是也在等 P1？', '這次 P3 多要一個 R2');
  await step(tok); // @1280.0 R2 兩個 instance 一個給 P2、一個給 P1
  G.paint('R2', 'P1', '#d64545'); G.paint('R2', 'P2', '#d64545'); G.paint('P3', 'R2', '#d64545');
  cap('R2 有兩個 instance：一個被 P2 拿走、一個被 P1 拿走', 'P3 既在等 P1，也在等 P2 → 找到 circular wait');
  await step(tok); // @1299.0 1 等 2、2 等 3、3 等 1 → deadlock
  ['P1', 'P2', 'P3'].forEach((p) => { G.node[p].glow(RED); G.node[p].mood('sad'); });
  bad('deadlock：1 等 2、2 等 3、3 等 1', 0, 2.2, -4.4);
  cap('三個 process 互相等對方 → deadlock', 'P1→R1→P2→R3→P3→R2→P1');
  await step(tok); // @1321.4 例二：一樣找得到 circle
  G.kill(); lab.clear();
  G = rag({ P: { P1: [-3.6, 0], P2: [2.6, -3.4], P3: [2.6, 0], P4: [2.6, 3.4] }, R: { R1: [-0.6, -2.0, 2], R2: [-0.6, 2.0, 2] } });
  [['P1', 'R1', 'req'], ['R1', 'P2', 'asg'], ['R1', 'P3', 'asg'], ['P3', 'R2', 'req'], ['R2', 'P1', 'asg'], ['R2', 'P4', 'asg']].forEach(([a, b, k]) => G.add(a, b, k));
  G.path(['P1', 'R1', 'P3', 'R2', 'P1']);
  cap('例二：一樣找得到一個 circle', 'P1 → R1 → P3 → R2 → P1');
  await step(tok); // @1334.3 P1 有 R2，要 R1；R1 在 P2 或 P3 手上
  G.node.P1.glow(GOLD);
  cap('P1 已經有 R2，它要的是 R1', 'R1 的兩個 instance 在 P2、P3 手上');
  await step(tok); // @1361.6 P2 沒在等 → 做完 free R1 → P1 拿到
  G.node.P2.glow(GREEN); G.node.P2.mood('happy');
  await wt(tok, 500);
  G.cut('R1', 'P2'); G.retype('P1', 'R1', 'asg', true); G.node.P1.glow(GREEN); G.node.P1.mood('happy');
  cap('P2 沒有在等任何人 → eventually 做完，放掉 R1', 'P1 就拿到 R1，也能結束');
  await step(tok); // @1383.5 P3 等 R2（在 P1 或 P4）；P4 沒被擋
  G.node.P4.glow(GREEN); G.node.P3.glow(GREEN);
  cap('P3 也一樣：它等的 R2 在 P1 或 P4 手上', 'P4 沒被任何人擋住 → eventually 會 free');
  await step(tok); // @1404.7 有 circle 但沒有 deadlock
  good('有 circle，但沒有 deadlock', 0, 2.2, -4.6);
  cap('這張圖同樣有 circle', '但是沒有 deadlock');
  await step(tok); // @1425.0 結論一：沒 circle → safe
  G.kill(); lab.clear();
  hd('結論', 0, 3.6, -3.4);
  good('沒有 circle → 一定沒有 deadlock', 0, 2.8, -2.4);
  cap('簡單結論：畫成 graph，沒有 circle 你就 safe', '沒有 circle 一定沒有 deadlock');
  await step(tok); // @1436.4 有 circle：看 single 還是 multiple instance
  note('有 circle → 看每種 resource 有幾個 instance', 0, 2.2, -1.2);
  cap('有 circle 的話', '要考慮是 single instance 還是 multiple instance');
  await step(tok); // @1447.3 單一 instance：有 circle 就 deadlock
  const s1 = bx('', RCOL[0], -3, 0.25, 1.4, 1.3, 0.5, 1.0); bx('', '#fbf7f0', -3, 0.56, 1.4, 0.18, 0.12, 0.18);
  bad('每種只有 1 個：circle ⇔ deadlock', -3, 1.4, 2.8);
  cap('每一種 type 都只有一個 instance', '有 circle 就是 deadlock（沒有別的 instance 可以繞過去）');
  await step(tok); // @1462.0 multiple instance：不一定
  bx('', RCOL[1], 3, 0.25, 1.4, 1.3, 0.5, 1.0); [-0.15, 0.15].forEach((d) => bx('', '#fbf7f0', 3 + d, 0.56, 1.4, 0.18, 0.12, 0.18));
  note('有多個 instance：circle 只是「可能」', 3, 1.4, 2.8);
  glow(s1, null);
  cap('兩種結果：因為每種 resource 有多個 instance', '把 R1、R2 改成只有一個，鐵定 deadlock');
  await step(tok); // @1490.1 之後用 algorithm 正確判斷
  hot('circle detection：complexity 高，但判斷正確', 0, 3.0, 4.4);
  cap('之後用 circle detection 的 algorithm', 'complexity 蠻高，但可以正確判斷');
}]);

FRAG.push(['dl-a-methods', '處理 deadlock：prevention、avoidance、detection + recovery、ignore', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  const M = [['Prevention', '拿掉四條件之一'], ['Avoidance', 'run time monitor 再決定'], ['Detection + Recovery', '發生了再解決'], ['Ignore', '算了吧（reboot）']];
  const xs = [-4.8, -1.6, 1.6, 4.8];
  const box = [];
  const show = (k) => { box[k] = bx(M[k][0], PCOL[k], xs[k], 0.4, 0, 2.9, 0.8, 1.2, 3); idx(M[k][1], xs[k], 0, 1.1); };
  await step(tok); // @1519.0 怎麼避免 deadlock：兩種角度
  hd('怎麼不要讓 deadlock 發生？', 0, 4.4);
  cap('進到本章主題：怎麼避免 deadlock', '基本上有兩種角度');
  await step(tok); // @1533.6 prevention
  show(0);
  cap('第一種 Prevention：never enter deadlock', '管理系統資源時，事先把四個條件之一拿掉');
  await step(tok); // @1558.1 avoidance
  show(1);
  cap('第二種 Avoidance：run time 一直 monitor', '看目前資源分配、process 之間的關聯，判斷能不能 assign');
  await step(tok); // @1593.2 記住兩者的區隔
  glow(box[0], GOLD); glow(box[1], GOLD);
  const pa = note('prevention = 事前拿掉條件；avoidance = run time 判斷', 0, 2.6);
  cap('記一下：prevention 是把條件拿掉', 'avoidance 是 run time 的時候判斷、避開（常搞混）');
  await step(tok); // @1634.6 讓它發生再解決
  glow(box[0], null); glow(box[1], null);
  show(2);
  cap('另一種：不 detect 了，讓系統隨便跑', '等 deadlock 發生了再 recovery（比較消極）');
  await step(tok); // @1660.2 要能 detect，還要知道怎麼 recover
  gone(pa); bub('① 偵測到已發生　② 要 kill 哪一個？', 1.6, 2.6, 0);
  cap('這樣要解兩件事：能 detect deadlock 已經發生', '偵測到後怎麼 recover —— 例如要 kill 哪個 process');
  await step(tok); // @1701.0 ignore
  show(3);
  cap('最後：ignore', '以系統角度最消極的做法 —— 卡住就卡住');
  await step(tok); // @1717.0 detection、avoidance 代價高 → commercial 系統選 ignore
  glow(box[3], GOLD);
  cap('detection、avoidance 要不斷 monitor，代價很高', '很多 commercial 系統乾脆選 ignore，免得浪費 CPU');
  await step(tok); // @1736.0 deadlock 不常發生 → reboot
  const kb = prop('keyboard', 4.8, 0, 2.6, 0.9, 'Ctrl-Alt-Del');
  cap('deadlock 本來就不該常發生', '真的發生了，就讓使用者 reboot');
  await step(tok); // @1789.6 重要系統不能這樣
  gone(kb);
  bad('武器控制、核電廠 → 不能叫你 reboot', 3.2, 2.6, 1.6);
  cap('不重要的系統可以這樣做', '重要系統（武器、核電廠）就得用前兩種');
  await step(tok); // @1810.2 本章重點
  glow(box[3], null); glow(box[0], GREEN); glow(box[1], GREEN);
  cap('本章重點：prevention 與 avoidance', 'detection 做法跟 avoidance 很像；recovery 是 case by case，不多講');
}]);

// ════════ n6YiasR-3uc（第 22B 講 Deadlock Prevention） ════════
FRAG.push(['dl-b-me', 'Prevention ①：拿掉 mutual exclusion', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const L = ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait'];
  await step(tok); // @16.8 prevention：一開始就讓系統不會發生
  hd('Prevention：從根本讓 deadlock 不會發生', 0, 4.8);
  cap('先從 prevention 開始', '不用隨著系統狀態去偵測，一開始就讓它不會發生');
  await step(tok); // @46.3 四個條件逐一拿掉
  const C = L.map((t, k) => bx(t, PCOL[k], -4.8 + k * 3.2, 0.35, -1.8, 2.9, 0.7, 1.0, 2));
  cap('deadlock 有四個條件', '一個一個討論每個條件要怎麼拿掉');
  await step(tok); // @54.2 拿掉 mutual exclusion：把 lock 機制抽掉
  glow(C[0], GOLD);
  const lk = prop('lock', 0, 0, 1.2, 1.3); await wt(tok, 500); P.fly(lk);
  cap('拿掉 mutual exclusion', '就是把 synchronization 的 lock 機制抽掉');
  await step(tok); // @70.7 read-only memory：大家同時 access
  const mem = bx('memory（read-only）', '#7fc6a4', 0, 0.3, 1.4, 3.4, 0.6, 1.0);
  const rs = [-3.6, -1.6, 1.6, 3.6].map((x, k) => pal('T' + (k + 1), PCOL[k], x, 0, 3.4, 0.5));
  rs.forEach((b) => b.mood('happy'));
  const rd = good('大家同時讀，不用 lock → 不會因此 deadlock', 0, 1.1, 2.6);
  cap('例：memory 的 access 如果都是 read-only', '大家同時 access 也沒問題，不需要 lock');
  await step(tok); // @101.3 但很多資源一定要 mutual exclusion
  gone(...rs, rd);
  const pr = prop('printer', 4.6, 0, 1.6, 0.8, 'printer');
  bad('printer、critical section：一定要 mutual exclusion', 0, 1.9, 1.4);
  cap('但不可能什麼都用這招', 'printer、critical section 一定要 mutual exclusion');
  await step(tok); // @125.7 資源分類：可 share 的就不要 lock
  glow(mem, GREEN);
  note('先把資源分類：能 share 的就不要 lock', 0, -0.1, 3.8);
  cap('所以先把資源做分類，用不同方式管理', '本來就能 share 的，就不要去 lock 它');
}]);

FRAG.push(['dl-b-hw', 'Prevention ②：拿掉 hold and wait（all or nothing）', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const p = pal('P', PCOL[0], -4.2, 0, 1.2, 0.8);
  const R = ['R1', 'R2', 'R3'].map((n, k) => bx(n, RCOL[k], -0.5 + k * 2.2, 0.3, -1.4, 1.4, 0.6, 0.9));
  await step(tok); // @159.4 hold and wait：hold 一個再等
  put(R[0], -4.2, 0.3, 2.8); bub('hold R1，等 R2、R3', -4.2, 2.6, 1.2);
  cap('② Hold and wait', 'hold 一個，然後再去等');
  await step(tok); // @168.0 一次 acquire 全部才往下做
  put(R[0], -0.5, 0.3, -1.4);
  lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  const rule = hot('規則：一次把全部 resource 都 acquire 到，才做下一步', 0, 4.4);
  cap('拿掉它：程式寫法要改', '要用多個資源時，一次就要把所有 resource 都 acquire 到');
  await step(tok); // @182.2 拿不到一個 → 全部 release 從頭來
  put(R[0], -4.2, 0.3, 2.8); await wt(tok, 500); glow(R[1], RED);
  bub('R2 拿不到 → 全部放掉', -4.2, 2.6, 1.2); await wt(tok, 500); put(R[0], -0.5, 0.3, -1.4);
  cap('只要有一個拿不到（fail 或 waiting）', '就把已經拿到的全部 release，從頭來過 → 沒有 hold and wait');
  await step(tok); // @220.4 缺點：資源使用率很低
  glow(R[1], null);
  bad('缺點：resource 使用率很低', 3.0, 2.6, 1.2);
  cap('缺點：資源的使用率會非常低', '要「同時」全部拿到的機會比較低');
  await step(tok); // @236.0 機率相乘（示意）
  const pb = note('示意：每個拿到的機率 1/2 → 三個同時拿到 = 1/2 × 1/2 × 1/2 = 1/8', 0, 3.6);
  cap('機率是相乘的（示意）', '每個 1/2，三個同時拿到只剩 1/8');
  await step(tok); // @254.7 不斷 acquire / release 卻無法執行
  gone(pb);
  for (let k = 0; k < 2; k++) { R.forEach((m, j) => put(m, -4.2 + (j - 1) * 1.5, 0.3, 2.8)); await wt(tok, 450); R.forEach((m, j) => put(m, -0.5 + j * 2.2, 0.3, -1.4)); await wt(tok, 450); }
  p.mood('sad');
  cap('很多 process 不斷 acquire、release，真的執行不了', '資源也常常沒人在用 → 電腦效能變低');
  await step(tok); // @276.9 CPU 這種重要資源不適合
  const cpu = prop('cpu', 4.6, 0, 2.6, 0.9, 'CPU：不適合');
  cap('像 CPU 這麼重要的資源，就不適合這種做法', '使用率太低，會大大影響執行時間');
  await step(tok); // @295.7 本來就慢的 IO device 可以
  prop('printer', 2.0, 0, 3.2, 0.7, 'IO device：可以');
  cap('但有些 IO device 本來就慢', '可以選擇用這種方式');
  await step(tok); // @304.0 總結：all or nothing
  tx(rule, 'Hold and wait 的解法：all or nothing');
  cap('hold and wait 的 solution', '把 acquire resource 的方式改成 all or nothing');
}]);

FRAG.push(['dl-b-np', 'Prevention ③：允許 preemption（記下 state）', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @314.5 能 preempt：把 state 記下來
  hd('③ 拿掉 No preemption = 允許 preemption', 0, 4.8);
  const a = pal('P1', PCOL[0], -3.6, 0, 1, 0.8), b = pal('P2', PCOL[1], 3.6, 0, 1, 0.8);
  const r = bx('resource', RCOL[0], -3.6, 2.1, 1, 1.4, 0.5, 0.9);
  cap('拿掉 no preemption：要能做 preemption', '條件：能把這個資源的 state 記下來');
  await step(tok); // @331.0 隨時打斷、別人用完再從停的地方繼續
  const st = bx('state 存起來', '#e9dcc4', -3.6, 0.25, 3.0, 2.4, 0.5, 0.9);
  put(r, 3.6, 2.1, 1); a.mood('calm'); b.mood('happy');
  await wt(tok, 900);
  put(r, -3.6, 2.1, 1); b.mood('calm'); a.mood('happy'); glow(st, GREEN);
  cap('任何時候都可以打斷：停，先讓別人用', '別人用完再還你，你從剛剛停的地方繼續');
  await step(tok); // @349.0 CPU 就是：context switch
  gone(a, b, r, st);
  const cpu = prop('cpu', 0, 0, 0, 1.2, 'CPU');
  const T = [pal('P1', PCOL[0], -3.6, 0, 1.4, 0.7), pal('P2', PCOL[1], 3.6, 0, 1.4, 0.7)];
  cap('這個 solution 用在哪？CPU 就是標準例子', '所以 CPU 有 context switch');
  await step(tok); // @362.1 CPU 使用率高，重要 process 可以先用
  T[1].glow(GOLD); T[1].mood('happy'); bub('比較重要 → 先讓給我', 3.6, 2.4, 1.4);
  cap('CPU 可以 preempt，使用率就很高', '比較重要的 process 來了，可以趕快把 CPU 讓給它');
  await step(tok); // @371.4 代價：存 state（memory、register）
  const regs = ['PC', 'R1', 'R2', 'SP'].map((n, k) => bx(n, '#e55a9b', -2.4 + k * 1.6, 0.25, -2.2, 1.2, 0.4, 0.6, 1.5));
  cap('代價：要存這些 state', '多用一些 memory、hardware register');
  await step(tok); // @388.0 不是都能 preempt：printer
  gone(cpu, ...T, ...regs); lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  prop('printer', 0, 0, 0, 1.1, '印到一半？');
  bad('state 記不下來 → 不能 preempt', 0, 2.6, 1.2);
  cap('不是所有東西都能 preempt', 'printer 印到一半，state 沒辦法記錄');
  await step(tok); // @403.4 CPU、memory 適合；IO device 不行
  good('CPU、memory、pipeline：適合', -3.6, 3.6); bad('IO device：不行', 3.6, 3.6);
  cap('CPU、memory 這種 program 的狀態很適合', '一些 IO device 就沒辦法 —— 看是哪一種 resource');
}]);

FRAG.push(['dl-b-cw', 'Prevention ④：total order 拿掉 circular wait', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
  let B = [], W = [];
  await step(tok); // @420.7 circular wait
  B = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 2.8); return pal('P' + (k + 1), PCOL[k], x, 0, z, 0.6); });
  for (let k = 0; k < N; k++) { const [x1, z1] = pp(k, 2.8), [x2, z2] = pp(k + 1, 2.8); W.push(pipe(V3(x1, 0.8, z1), V3(x2, 0.8, z2), '#d64545', 0.7, 0.7)); }
  cap('最後一個：④ circular wait', 'process 之間的等待繞成一圈');
  await step(tok); // @437.4 變成 total order
  hot('把 resource 排成 total order', 0, 4.4);
  cap('拿掉的方法：把它變成一個 total order', '（全序：每個都有先後）');
  await step(tok); // @445.1 會有 circle 是因為 priority 繞一圈
  W[3].userData.mat.color.set(GOLD);
  cap('會有 circular wait，是因為順序可能繞一圈', '最後面的人在等最前面的人，才形成 circle');
  await step(tok); // @458.1 調整 policy：只有一個方向 → 沒有 circle
  kill(W[3]); B[3].glow(GREEN);
  cap('把分配 resource 的 policy 調整成 total order', '只有一個方向，後面的人不會去等最前面的 → 沒有 circle');
  await step(tok); // @513.2 規則：要 Rk，就要先放掉所有比 k 大的
  B.forEach((b) => gone(b)); W.forEach((w) => kill(w)); lab.clear();
  const xs = (i) => -5.2 + i * 1.75;
  const RR = [0, 1, 2, 3, 4, 5].map((i) => bx('R' + i, RCOL[i % 4], xs(i), 0.3, -1.6, 1.2, 0.5, 0.8));
  const arrowRow = pipe(V3(-5.6, 0.2, -2.8), V3(5.6, 0.2, -2.8), '#8a7a5c', 0, 0);
  idx('order 由小到大', 0, 0.5, -3.2);
  hot('要 Rk 時：手上比 k 大的 resource 都要先 release', 0, 4.4);
  cap('policy 例子：assign resource 時多一個條件', 'process 要 Rk，必須先放掉所有編號比 k 大、已經拿到的');
  await step(tok); // @540.2 例：有 R0、R5，要 R3 → 先放 R5
  const p = pal('P', PCOL[0], 0, 0, 2.0, 0.8);
  put(RR[0], -0.6, 1.25, 2.0); put(RR[5], 0.6, 1.25, 2.0);
  await wt(tok, 700);
  bub('想要 R3', 0, 2.6, 2.0); glow(RR[3], GOLD);
  await wt(tok, 600);
  put(RR[5], xs(5), 0.3, -1.6); glow(RR[5], RED);
  cap('例：已經有 R0、R5，想再要 R3', '要先把 R5 放掉：先拿 R3 才輪得到 R5，一步一步來');
  await step(tok); // @582.5 若要 R0：全部放掉從 R0 重來
  glow(RR[5], null); glow(RR[3], null);
  lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  put(RR[0], xs(0), 0.3, -1.6); glow(RR[0], GOLD);
  bub('手上都有卻要 R0 → 全部放掉，從 R0 開始', 0, 2.6, 2.0);
  cap('如果你偏偏要的是 R0', '對不起，全部先放掉，從 R0 開始一步一步往前');
  await step(tok); // @608.9 例：tape drive 1、disk 5、printer 12
  gone(p, ...RR, arrowRow); lab.world.children.filter((o) => o.element).forEach((o) => kill(o));
  hot('依編號由小到大取得', 0, 4.4);
  const dv = [['disk', 'tape drive = 1', -4], ['disk', 'disk = 5', 0], ['printer', 'printer = 12', 4]].map(([k, l, x]) => prop(k, x, 0, -1, 0.9, l));
  const q = pal('P', PCOL[1], -4, 0, 2.2, 0.7);
  for (const x of [-4, 0, 4]) { await slide(tok, q.g, x, 0, 2.2, 450); }
  cap('例：tape drive 1、disk 5、printer 12', '要這三個 resource，必須依序取得，不能亂跳');
  await step(tok); // @634.3 證明：circle 由 hold and wait 組成
  gone(q, ...dv); lab.world.children.filter((o) => o.element).forEach((o) => kill(o));
  hd('證明：為什麼 total order 沒有 circular wait', 0, 4.6);
  const chain = ['P0 hold R0，wait R1', 'P1 hold R1，wait R2', '……', 'Pn hold Rn，wait R0 ？'].map((t, k) => tag(t, 'idx', -2.0, 3.6 - k * 0.75, 0));
  chain[3].element.style.visibility = 'hidden';
  cap('circle 一定是由 hold and wait 組成的', 'P0 hold R0、wait R1；R1 被某個 process 拿著……');
  await step(tok); // @689.0 要成 circle，最後一條：hold 高 index、要 R0
  chain[3].element.style.visibility = '';
  chain[3].element.className = 'lab-label ptr alt';
  cap('要繞成 circle，最後一定有這一條', '某個 process 拿著 Rn，要的卻是 R0');
  await step(tok); // @712.3 hold 高要低 → 被擋掉，不存在
  chain[3].element.className = 'lab-label bad';
  bad('✗ hold 編號高的、去要編號低的 → 規則不允許', 2.6, 1.0, 0);
  cap('hold 一個比較高的、去要一個比較低的 → 會被擋掉', '這條式子不存在 → 沒有 circular wait');
  await step(tok); // @764.2 不能 hold order 高的去 wait order 低的
  good('resource 有 ordering：不能 hold 高的去 wait 低的', 0, 0.2, 1.4);
  cap('所以叫 total ordering', '不能 hold 一個 order 高的，再去 wait 一個 order 低的');
  await step(tok); // @780.7 缺點：越後面的 resource 越難拿
  lab.world.children.filter((o) => o.element).forEach((o) => kill(o));
  const bars = [0, 1, 2, 3, 4, 5].map((i) => bx('R' + i, RCOL[i % 4], -4.4 + i * 1.75, 0.2 + i * 0.25, 0, 1.2, 0.4 + i * 0.5, 0.8));
  idx('等待時間（示意）', 4.4, 3.8, 0);
  bad('缺點：越後面的 resource 越難拿到、等越久', 0, 4.6, 0);
  cap('缺點跟拿掉 hold and wait 有點像', '越後面的 resource 越難拿到，等待時間比較久');
  await step(tok); // @807.0 不 enforce：順序看運氣可能更快，但有 deadlock 危險
  note('不規定順序：R5 先 available 就先拿，可能更快 —— 但有 deadlock 危險', 0, 3.4, 1.4);
  cap('不 enforce 的話，順序看運氣，也許更快拿齊', '但也因此有 deadlock 的危險');
}]);

FRAG.push(['dl-b-next', '接下來：avoidance 分 single / multiple instance', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @847.4 avoidance 分兩塊
  hd('Avoidance：分兩大塊', 0, 4.6);
  cap('剛剛是 prevention，接下來介紹 avoidance', '切成兩大塊來討論');
  await step(tok); // @857.4 single instance：用圖看有沒有 circle
  const s = bx('Single instance', PCOL[0], -3.2, 0.4, 0, 4.2, 0.8, 1.4, 2);
  idx('用 graph 看有沒有 circle', -3.2, 1.5, 0);
  cap('第一塊：single instance', '用圖看就好 —— 跑 graph algorithm 看有沒有 circle');
  await step(tok); // @871.2 multiple instances：Banker's algorithm
  bx("Banker's algorithm", PCOL[3], 3.2, 0.4, 0, 4.2, 0.8, 1.4, 2);
  idx('multiple instances：generalize', 3.2, 1.5, 0);
  cap("第二塊 multiple instances：Banker's", '每個 type 可以有多個 instance，follow 一個簡單的 algorithm');
}]);

// ════════ HvXHTgLys1g（第 22C 講 Deadlock Prevention & Avoidance（續）） ════════
FRAG.push(['dl-c-memcpu', 'Prevention 實例：memory 拿掉互斥、CPU 允許 preemption', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @15.8 用 CPU、memory 當例子
  const mem = bx('Memory', '#7fc6a4', -3.4, 0.4, -0.6, 3.2, 0.8, 1.4, 2);
  const cpu = prop('cpu', 3.4, 0, -0.6, 1.3, 'CPU');
  cap('再用大家熟悉的 CPU 跟 memory 當例子', '看 prevention 實際怎麼做');
  await step(tok); // @18.4 memory 可以 share access（global memory）
  const T = [-5.2, -3.4, -1.6].map((x, k) => pal('T' + (k + 1), PCOL[k], x, 0, 2.2, 0.5));
  T.forEach((t) => t.mood('happy'));
  idx('multi-thread：global memory 大家 free to access', -3.4, 1.5, -0.6);
  cap('memory：系統讓你 share access', '例：multi-thread 程式的 global memory，大家可以同時 access');
  await step(tok); // @44.6 系統拿掉 mutual exclusion → 不會因 memory 而 deadlock
  glow(mem, GREEN);
  good('拿掉 mutual exclusion', -3.4, 2.3, -0.6);
  cap('以系統角度：memory 把 mutual exclusion 拿掉', '所以 memory access 本身不會造成 deadlock');
  await step(tok); // @57.0 第六章的 deadlock 是 programmer 自己造成
  note('第六章的 deadlock：programmer 自己加了 critical section', -3.4, 3.1, -0.6);
  cap('那第六章的 deadlock 哪來的？', 'programmer 為了解 race condition，自己加了 critical section');
  await step(tok); // @91.0 CPU 不能 share
  bad('instruction、pipeline 不能混在一起 → 不能 share', 3.4, 2.3, -0.6);
  cap('反過來，CPU 不能被 share', '兩個 instruction 不能混在 pipeline 裡一起執行');
  await step(tok); // @113.5 所以 OS 用 preemption（context switch 存 register）
  const q = [pal('P1', PCOL[3], 2.2, 0, 2.2, 0.55), pal('P2', PCOL[4], 4.6, 0, 2.2, 0.55)];
  const rg = bx('registers 存到 memory', '#e55a9b', 3.4, 0.25, 3.8, 2.8, 0.4, 0.7, 1.5);
  q[0].glow(GOLD); await wt(tok, 600); q[0].glow(null); q[1].glow(GOLD);
  good('允許 preemption', 3.4, 3.1, -0.6);
  cap('所以 OS 用 preemption', '用 context switch 把 register 存起來，讓 CPU 可以被 preempt');
  await step(tok); // @131.0 兩個反過來的例子：CPU 不可能造成 deadlock
  glow(cpu.children[0], GREEN);
  cap('剛好是兩個反過來的例子', 'CPU 可以被 preempt，所以 CPU 這個資源不可能造成 deadlock');
  await step(tok); // @160.0 programmer 層自己解決
  hot('系統：memory 拿掉互斥、CPU 允許搶 → 剩下的由 programmer 自己處理', 0, 4.6);
  cap('programmer 這層往往還要加 critical section', '那是 programmer 自己要解決的，系統不出力');
}]);

FRAG.push(['dl-c-worst', 'Avoidance：考慮 worst case', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @185.0 第二塊：avoidance
  hd('Avoidance', 0, 4.8);
  cap('接下來第二塊：avoidance', '');
  await step(tok); // @192.0 run time 根據目前狀態及時避免
  const s = bx('目前系統狀態', '#e9dcc4', -3.6, 0.3, 0, 3.0, 0.6, 1.2);
  cap('假設四個條件都可能發生', 'run time 根據目前系統狀態，及時避免 deadlock');
  await step(tok); // @207.6 分 single / multiple instance，概念一樣
  idx('single instance／multiple instance：概念一樣', -3.6, 1.2, 0);
  cap('分成 single instance 跟 multiple instance', 'solution 的概念都一樣');
  await step(tok); // @218.1 deadlock 是因為做了某個 resource 動作
  const p = pal('P', PCOL[0], 0, 0, 1.6, 0.7);
  bub('我要 R', 0, 1.9, 1.6);
  cap('deadlock 都是程式做了某個 resource 的動作', '之後才造成的');
  await step(tok); // @234.0 考慮 worst case：最糟情況也不會 deadlock
  const f = bx('未來最糟的情況', '#d64545', 3.8, 0.3, 0, 3.0, 0.6, 1.2);
  pipe(V3(-2, 0.4, 0), V3(2.2, 0.4, 0), '#8a7a5c', 0.1, 0.1);
  cap('事先避免 → 要考慮 worst case', '未來所有情況下最糟的狀況發生，也不會 deadlock 嗎？');
  await step(tok); // @253.5 只有這種情況才允許
  good('worst case 也沒有 deadlock → 才允許這個 assignment', 0, 3.0, 0);
  p.mood('happy');
  cap('只有在這種情況下，系統才允許做這個 resource assignment', '不管其他 process 未來做什麼，都不會 deadlock');
}]);

const CLAIM = { P: { P1: [-3.2, 0], P2: [3.2, 0] }, R: { R1: [0, -2.4, 1], R2: [0, 2.4, 1] } };
FRAG.push(['dl-c-claim', 'Single instance：claim edge 畫出未來可能的 request', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.2]);
  let G = null;
  await step(tok); // @280.4 single instance → 回到 RAG
  G = rag(CLAIM);
  cap('worst case？single instance 回到 RAG', '它最能描述整個系統狀態');
  await step(tok); // @297.6 request edge、assignment edge：已經發生的
  G.add('R1', 'P1', 'asg'); await wt(tok, 400); G.add('P2', 'R1', 'req');
  cap('symbol 一樣：request edge、assignment edge', '代表已經發生的事：R1 已經 assign 給 P1');
  await step(tok); // @314.7 worst case：考慮未來可能發生的事
  const wc = hot('worst case：還要考慮「未來可能」', 0, 1.8, -4.2);
  cap('worst case：系統必須考慮未來還可能發生的事', '');
  await step(tok); // @324.3 多一種 edge：claim edge
  G.add('P1', 'R2', 'claim');
  note('claim edge：trace process 的 code，知道它未來「may」要 R2', 0, 0.1, 5.2);
  cap('所以多加一種 edge：claim edge', 'trace process 的 code，知道它未來「有可能」要哪些 resource');
  await step(tok); // @355.0 方向同 request（P → R），不同顏色
  G.add('P2', 'R2', 'claim');
  cap('claim edge 也是 P → R，跟 request 同方向', '用不同顏色（虛線），代表還沒發生、不一定會發生');
  await step(tok); // @379.1 worst case 它真的發生 → 變 request edge
  G.retype('P1', 'R2', 'req'); await wt(tok, 900); G.retype('P1', 'R2', 'claim');
  cap('為什麼要標出來？worst case 下它真的發生了', '如果 resource 又被人拿走，它就變成真的 request edge');
  await step(tok); // @411.4 edge 多 → 更有機會 circular wait
  cap('edge 變多，代表更有機會出現 circular wait', '未來的事假設都發生 → 這就是 worst case');
  await step(tok); // @428.7 claim edge 都是 P → R，加上去不會造成 circle
  gone(wc); good('claim edge 只是 P → R：單純加上去不會造成 circle', 0, 1.8, -4.2);
  cap('但 claim edge 都是從 process 指到 resource', '單純畫上去不會造成 circular wait');
  await step(tok); // @440.2 變 request 只是變顏色，方向一樣
  G.retype('P2', 'R2', 'req'); await wt(tok, 900); G.retype('P2', 'R2', 'claim');
  cap('claim edge 真的變成 request edge', '只是變顏色，方向一樣，還好');
}]);

FRAG.push(['dl-c-decide', 'Request 來了：變成 assignment 會不會有 cycle？', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.2]);
  const G = rag(CLAIM);
  G.add('R1', 'P1', 'asg'); G.add('P2', 'R1', 'req'); G.add('P1', 'R2', 'claim'); G.add('P2', 'R2', 'claim');
  await step(tok); // @461.6 真正怕的是變成 assignment edge
  const fear = hot('真正怕的：變成 assignment edge', 0, 1.8, -4.2);
  cap('我們真正怕的，是它變成 assignment edge', '');
  await step(tok); // @471.2 claim edge 真的發生；現在沒人用 R2
  glow(G.node.R2.m, GOLD);
  cap('假設有一條 claim edge 真的發生了', '現在沒有人在使用 R2');
  await step(tok); // @482.0 要不要把 R2 給 P1 → 給了就變綠
  G.retype('P1', 'R2', 'req');
  cap('系統要做 decision：應不應該把 R2 給 P1？', '給它的話，這條 edge 就變成綠色的 assignment edge');
  await step(tok); // @497.6 不同意 → 維持 request
  bub('不同意 → 維持 request，等著', -3.2, 1.8, 0);
  cap('如果不同意，它就維持 request 的方向', '系統有權做這個決定');
  await step(tok); // @505.0 把所有可能畫出來 → 判斷變綠會不會有 circle
  lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  cap('avoid 的意思：把所有可能性都畫出來', '判斷變成綠色的 assignment edge 之後，會不會造成 circle');
  await step(tok); // @531.5 P1 要 R2：變 assign 沒有 circle
  G.retype('P1', 'R2', 'asg', true);
  G.node.P1.glow(GREEN);
  good('P1 要 R2 → 給它：沒有 circle', -3.2, 2.0, 2.6);
  cap('例：P1 要 R2，把它變成 assign', '很明顯沒有 circle');
  await step(tok); // @541.2 P2 要 R2 → 變綠 → circle
  G.retype('R2', 'P1', 'claim', true); G.node.P1.glow(null);
  lab.world.children.filter((o) => o.element && o.element.className.includes('good')).forEach((o) => kill(o));
  G.retype('P2', 'R2', 'asg', true);
  await wt(tok, 500);
  G.path(['P1', 'R2', 'P2', 'R1', 'P1']); G.paint('P1', 'R2', '#d64545');
  cap('可是萬一是 P2 來要 R2', '把它變成綠色、方向一改 → 變成一個 circle');
  await step(tok); // @552.0 雖然還沒發生，worst case 下一秒就發生
  G.node.P1.glow(RED); G.node.P2.glow(RED);
  const nx = bad('P1 → R2 那條還只是 claim，但下一秒可能成真', 0, 0.1, 5.2);
  cap('雖然 P1 → R2 現在還沒發生', 'worst case：它下一秒就可能發生（unpredictable）→ 可能 deadlock');
  await step(tok); // @584.3 所以 P2 要 R2 → 不答應；P1 要 → 同意
  G.retype('R2', 'P2', 'req', true); G.path(['P2', 'R1', 'P1'], ECOL.req); G.paint('R1', 'P1', ECOL.asg); G.paint('P1', 'R2', ECOL.claim);
  G.node.P1.glow(null); G.node.P2.glow(GOLD);
  cap('為了 avoid 任何可能性：P2 要 R2，系統不答應', '同樣狀態下，P1 要 R2 就會同意');
  await step(tok); // @612.3 avoidance：claim → request 時決定，即使 available 也可擋
  cap('avoidance：先把所有可能都畫上去', 'claim 變 request 時決定要不要變 assignment —— resource available 也可以擋');
  await step(tok); // @637.0 depend on 系統狀態：若 P1 沒有 R1 → 不會有 circle
  G.paint('R1', 'P1', '#cfc6b6');
  gone(nx); note('如果 P1 沒有拿著 R1（只是 claim），給 P2 也不會有 circle', 0, 0.1, 5.2);
  cap('這個決定 depend on 目前系統狀態', '如果 P1 根本沒拿著 R1，就算給 P2 也不會有 circle');
  await step(tok); // @659.0 擋掉 → 維持 request；同意 → 下一秒可能 deadlock
  G.paint('R1', 'P1', ECOL.asg);
  cap('問題是：紫色變紅色之後，要不要再變綠色', '擋掉就只是紅線；同意變綠又有 circle → 下一秒可能 deadlock');
  await step(tok); // @684.2 做法：假設同意 → 跑 circle detection → 有就擋
  tx(fear, '假設同意 → 跑 circle detection → 有 circle 就擋，等狀態改變');
  cap('實作：假設同意，跑 circle detection algorithm', '有 circle 就擋掉、等在那裡，直到狀態改變才允許 assign');
}]);

FRAG.push(['dl-c-cost', 'Avoidance 的代價：n²', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @720.7 complexity 都不低
  hd('Avoidance 的代價', 0, 4.8);
  cap('detection、avoidance 的 complexity 都不低', '');
  await step(tok); // @726.0 resource type 很多、process 幾千
  for (let i = 0; i < 18; i++) bx('', i % 3 ? PCOL[i % 6] : RCOL[i % 4], -5 + (i % 9) * 1.25, 0.25, -1.2 + Math.floor(i / 9) * 1.4, 0.6, 0.5, 0.6);
  idx('resource type、process 數量都很多（幾千個）', 0, 1.2, 2.0);
  cap('程式系統拆下來，resource type 遠比你想像的多', 'process 數量動輒幾千 → n 不會很小');
  await step(tok); // @744.2 最好的 detection algorithm 也要 n²
  const n2 = hot('最好的 algorithm 也要 O(n²)', 0, 3.4);
  cap('跑一次 detection，最好的 algorithm 也要 n²', '時間會花很多');
  await step(tok); // @750.9 除非很怕 deadlock，否則不一定願意付代價
  const pay = note('除非真的很怕 deadlock，否則不一定願意付這個代價', 0, 2.6);
  cap('所以除非真的很怕 deadlock', '不然不一定願意付這個代價');
  await step(tok); // @760.0 總結 algorithm
  gone(pay, n2); P.code(['1. 把 claim edge 畫上去', '2. claim edge 變成 request', '3. 假設變成 assignment，跑 circle detection', '4. 有 circle → 維持 request；沒有 → grant'], -2.6, 4.2, 0.5, 3.4).hl(3);
  cap('algorithm 總結：claim edge → request 時跑一次', '變成 assignment 會有 circle 就維持 request，不會才 grant');
}]);

FRAG.push(['dl-c-safe', 'Safe、unsafe 與 deadlock', async (tok) => {
  fresh([0, 8, 9], [0, 0, 0.4]);
  await step(tok); // @800.5 Banker's：multiple instance
  hd("Banker's algorithm：multiple instance", 0, 2.4, -4);
  cap("Banker's algorithm：multiple instance", '');
  await step(tok); // @807.7 難用圖，但有簡單 algorithm（n²）
  idx('不好畫成圖，但有簡單的 algorithm（一樣約 n²）', 0, 1.6, -4);
  cap('multiple instance 比較難用圖表示', '但有一個簡單的 algorithm，complexity 還是 n²');
  await step(tok); // @825.0 系統狀態分 safe / unsafe
  const zs = zone('safe', -2.6, 0.02, 0.6, 4.6, 5.0, '#cfe8d6');
  const zu = zone('unsafe', 2.6, 0.02, 0.6, 4.6, 5.0, '#f3dcc0');
  cap('概念跟剛才一樣：把系統狀態分成 safe 跟 unsafe', '');
  await step(tok); // @836.2 safe：絕對沒有 deadlock
  good('絕對不可能 deadlock', -2.6, 0.8, 0.6);
  cap('safe：絕對不可能有 deadlock 發生', '');
  await step(tok); // @842.4 unsafe：worst case 有可能；裡面才有 deadlock
  const zd = zone('deadlock', 3.0, 0.06, 1.4, 2.6, 2.4, '#f2b8b0');
  idx('worst case 下「有可能」', 3.8, 0.5, -1.0);
  cap('unsafe：worst case 下有可能 deadlock', 'unsafe 裡面才有真的 deadlock 的狀況');
  await step(tok); // @858.0 avoidance = 維持在 safe，擋掉 safe → unsafe
  const dot = bx('', '#4b9ee2', -2.6, 0.35, 1.4, 0.5, 0.5, 0.5);
  pipe(V3(-2.2, 0.4, 1.4), V3(1.4, 0.4, 1.4), '#d64545', 0.1, 0.1);
  bad('✗ 擋掉', -0.4, 1.0, 1.4);
  cap('avoidance：一直維持在 safe state', '會讓系統從 safe 移到 unsafe 的動作，就擋掉');
  await step(tok); // @896.0 Banker's：找一個順序讓 process 依序執行完畢
  const seq = ['P?', 'P?', 'P?'].map((t, k) => bx(t, PCOL[k], -3.8 + k * 1.2, 0.3, -1.0, 0.9, 0.5, 0.7));
  cap("Banker's 的檢查：找一個 sequence", '讓 process 有一個順序，可以依序執行完畢');
  await step(tok); // @928.4 找得到 → safe；找不到 → unsafe
  glow(zs, GREEN);
  cap('找得到 sequence → safe，不可能 deadlock', '找不到 → 已經進到 unsafe state，有可能 deadlock');
  await step(tok); // @959.3 同意 assignment 後若找不到 → 擋掉 / hold
  glow(dot, GOLD);
  cap('avoidance：先假設同意某個 assignment', '同意後找不到 sequence → 擋掉或 hold 住，等狀態改變再說');
}]);

// 12 台 tape drive（恐龍書）：一排一個 process，灰格 = Max，彩色方塊 = 目前持有
function tapeRig(rows) {
  const X = (j) => -3.6 + j * 0.62;
  const R = rows.map(([p, max, hold], k) => {
    const z = -1.8 + k * 1.8;
    const nm = hd(p, -5.5, 0.2, z);
    const tiles = [], held = [];
    for (let j = 0; j < hold; j++) held.push(bx('', PCOL[k], X(j), 0.25, z, 0.55, 0.5, 0.9, 2));
    return { p, max, z, nm, tiles, held, k, showMax() { for (let j = 0; j < max; j++) tiles.push(ctx.tile(V3(X(j), 0.03, z), 0.55, 0.9, '#efe5d2')); } };
  });
  return { R, X,
    give(k, n) { const r = R[k]; for (let j = 0; j < n; j++) r.held.push(bx('', PCOL[k], X(r.held.length), 0.25, r.z, 0.55, 0.5, 0.9, 2)); },
    free(k) { const r = R[k]; r.held.splice(0).forEach((m) => P.fly(m)); r.tiles.forEach((t) => t.material.color.set('#cfe8d6')); },
  };
}
FRAG.push(['dl-c-tape', 'Safe sequence：12 台 tape drive', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.2, 0]);
  let T = null, av = null, need = [];
  await step(tok); // @1000.3 什麼叫 safe sequence
  const ssT = hd('Safe sequence', 0, 4.6);
  cap('來看什麼叫做 safe sequence', '在 safe state 裡找到的順序');
  await step(tok); // @1011.3 一種 type，12 個 instance
  const tdT = idx('一種 resource type：12 台 tape drive', 0, 3.8);
  cap('用一個表描述，只考慮一種 resource type', '重點是它有 12 個 instance');
  await step(tok); // @1045.5 三個 process：P0 5、P1 2、P2 2
  T = tapeRig([['P0', 10, 5], ['P1', 4, 2], ['P2', 9, 2]]);
  cap('系統有三個 process，這是目前狀態', 'P0 用了 5 個、P1 用 2 個、P2 用 2 個');
  await step(tok); // @1064.1 worst case = maximal need（P0 最多 10）
  T.R.forEach((r) => r.showMax());
  T.R.forEach((r) => idx('Max ' + r.max, 2.9, 0.3, r.z));
  T.R[0].nm.element.className = 'lab-label ptr alt';
  cap('worst case：profile 程式，最多同時用幾個 instance', 'P0 現在只用 5 個，但最多會到 10 個 → 下一秒可能再要 5 個');
  await step(tok); // @1105.6 Max 是 given；是同一時間最多需要
  T.R[0].nm.element.className = 'lab-label ptr';
  gone(tdT); note('Max：compiler 或 programmer 給的；「同一時間」最多要幾個，不是總共用了幾個', 0, 3.8);
  cap('這就是 maximal need，在題目裡是 given', '注意：是某一步同時最多需要多少，不是總共用多少');
  await step(tok); // @1133.0 safe sequence <P1, P0, P2>
  gone(ssT); hot('safe sequence：< P1, P0, P2 >', 0, 4.6);
  cap('這個例子可以找到 safe sequence：P1、P0、P2', '一步一步看為什麼');
  await step(tok); // @1159.7 total 12，用了 9，剩 3
  av = hot('Available = 12 − 9 = 3', 4.8, 2.6, 2.6);
  cap('total 是 12 個，用了 5 + 2 + 2 = 9 個', '剩下 3 個');
  await step(tok); // @1166.0 worst case：還要 5、2、7
  need = T.R.map((r) => idx('還要 ' + (r.max - r.held.length), 4.4, 0.3, r.z));
  cap('worst case 發生：下一秒大家都要到 Max', 'P0 還要 5、P1 還要 2、P2 還要 7 才能動');
  await step(tok); // @1183.7 剩 3、P1 只要 2 → 給 P1 → 做完放掉 → 5
  T.give(1, 2); T.R[1].nm.element.className = 'lab-label good';
  await wt(tok, 700);
  T.free(1); tx(need[1], '做完 ✓'); tx(av, 'Available = 3 − 2 + 4 = 5');
  cap('剩 3 個，P1 只要再 2 個 → 給 P1，它就能跑完', '跑完之後手上的全部 free 出來 → 剩 5 個');
  await step(tok); // @1217.7 5 個 → P0 也可以 → 10
  T.give(0, 5); T.R[0].nm.element.className = 'lab-label good';
  await wt(tok, 700);
  T.free(0); tx(need[0], '做完 ✓'); tx(av, 'Available = 5 − 5 + 10 = 10');
  cap('有 5 個，P0 剛好要 5 個 → 也能做完', '做完把手上的加回去 → 10 個');
  await step(tok); // @1236.0 10 個，P2 只要 7
  T.give(2, 7); T.R[2].nm.element.className = 'lab-label good';
  await wt(tok, 700);
  T.free(2); tx(need[2], '做完 ✓'); tx(av, 'Available = 12');
  cap('有 10 個，P2 只要 7 個 → 可以', '');
  await step(tok); // @1242.7 P1 → P0 → P2：safe
  good('照 P1 → P0 → P2 的順序，大家都能做完 → safe', 0, 3.8, 2.8);
  cap('safe sequence 就是 P1、P0、P2', '強迫這個順序，大家都能順利執行完畢 → 這個狀態是 safe');
}]);

FRAG.push(['dl-c-unsafe', '找不到 safe sequence：unsafe（但還不是 deadlock）', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.2, 0]);
  let T = null, av = null, need = [];
  await step(tok); // @1296.0 另一個例子：找不到 safe sequence
  T = tapeRig([['P0', 10, 5], ['P1', 4, 2], ['P2', 9, 2]]); T.R.forEach((r) => { r.showMax(); idx('Max ' + r.max, 2.9, 0.3, r.z); });
  cap('另一個例子：找不到 safe sequence', '這當然是有可能的');
  await step(tok); // @1303.0 P2 從 2 改成 3
  T.give(2, 1); T.R[2].nm.element.className = 'lab-label ptr alt';
  av = hot('Available = 12 − 10 = 2', 4.8, 2.6, 2.6);
  need = T.R.map((r) => idx('還要 ' + (r.max - r.held.length), 4.4, 0.3, r.z));
  cap('小改一下：P2 從 2 個改成 3 個', '只是多拿了一個 resource → 剩 2 個');
  await step(tok); // @1317.3 掃描順序無所謂，free resource 只會增加
  const scan = note('找 sequence：從上到下掃、順序無所謂 —— free resource 只會越來越多', 0, 3.8, -2.8);
  cap('找 sequence 不用擔心 ordering', '每次只是 incrementally 增加 free resource，掃過這個表就好');
  await step(tok); // @1342.2 剩 2：P1 OK → free → 4
  T.R[2].nm.element.className = 'lab-label ptr';
  T.give(1, 2); await wt(tok, 700); T.free(1); tx(need[1], '做完 ✓'); tx(av, 'Available = 2 − 2 + 4 = 4');
  cap('剩 2 個：P1 要 2 個，OK', 'free 掉之後：原來的 2 個加上它放出來的 2 個 = 4 個');
  await step(tok); // @1363.1 P0 要 5、P2 要 6 → 都不行
  T.R[0].nm.element.className = 'lab-label bad'; T.R[2].nm.element.className = 'lab-label bad';
  tx(need[0], '還要 5 > 4 ✗'); tx(need[2], '還要 6 > 4 ✗');
  cap('4 個：P0 要 5 個不行，P2 要 6 個也不行', '卡在那裡，找不到 safe sequence');
  await step(tok); // @1373.0 → unsafe state
  bad('unsafe state', 0, 3.8, 2.8);
  cap('所以系統進入這個狀態，就是進到 unsafe state', '');
  await step(tok); // @1380.2 有 deadlock 嗎？沒有
  note('現在沒有 deadlock：要 worst case 真的發生（大家真的要到 Max）才會卡死', 0, 4.6, 2.8);
  cap('那它有沒有 deadlock？目前沒有', '要 worst case 真的發生、大家下一秒都要到 Max，才進入真正的 deadlock');
  await step(tok); // @1404.3 avoidance 事前看 worst case 會不會進 unsafe
  cap('avoidance：事前看 worst case 會不會 unsafe', '沒有 safe sequence → 這個 state 是 unsafe → 必須擋掉');
  await step(tok); // @1437.5 注意：做完加回去的是目前 hold 的，不是 Max
  T.R.forEach((r) => r.held.forEach((m) => glow(m, GOLD)));
  gone(scan); hot('做完 free 的 = 目前 hold 的數量（不是 Max）', 0, 3.8, -2.8);
  cap('大家每次都搞混：Max 是最多會用的量', '做完 free 掉時，加回去的是「目前 hold」的數量，不是 Max');
}]);

FRAG.push(['dl-c-banker', "Banker's algorithm 的概念：先假裝給，再檢查 safe", async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const stepsBx = [];
  const sbx = (t, c, x) => { const m = bx(t, c, x, 0.35, 0, 2.6, 0.7, 1.1, 2); stepsBx.push(m); return m; };
  await step(tok); // @1467.3 Banker's algorithm
  hd("Banker's algorithm", 0, 4.6);
  const p = pal('P', PCOL[0], -5.2, 0, 2.2, 0.6); bub('我要 request', -5.2, 1.6, 2.2);
  cap("有了 safe sequence，來看 Banker's", '');
  await step(tok); // @1478.4 predetermine：先修改 current holding，但不真的 assign
  const a = sbx('① 假裝給：改 Allocation', '#dd8238', -4.0);
  cap('predetermine：先改 current holding 的數字', '但沒有真的 assign');
  await step(tok); // @1497.2 假設允許後是否仍 safe；不是 → 不允許
  const b = sbx('② 還找得到 safe sequence？', '#9b7ef4', 0);
  cap('假設允許了，看看是不是仍然 safe', '如果不是，就不能允許這個 assignment');
  await step(tok); // @1517.0 步驟：記 Max（worst case），看是否 safe
  bx('Max（worst case）', '#9b7ef4', 0, 0.3, -2.0, 2.6, 0.5, 0.8);
  cap('整個 algorithm：先 assume worst case', '把每個 process 最多使用的量（Max）記下來，看目前是不是 safe');
  await step(tok); // @1529.5 滿足的 process free 掉，依序找 safe sequence
  glow(b, GOLD);
  for (let k = 0; k < 3; k++) { bx('P' + (k + 1) + ' 做完', PCOL[k + 1], -1.2 + k * 1.2, 0.25, 2.0, 1.1, 0.4, 0.7, 1.2); await wt(tok, 300); }
  cap('能滿足需求的 process 就讓它做完、把 resource 拿出來', '給其他 process 用，依序找出一個 safe sequence');
  await step(tok); // @1552.7 找得到才真的 approve
  const c = sbx('③ 找得到 → 真的 approve', '#2fc092', 4.0); glow(c, GREEN); p.mood('happy');
  cap('只要找得到，這個 assignment 就沒問題', '檢查完了，才真的 approve resource assignment');
}]);

// 恐龍書 P0–P4、A/B/C = 10/5/7 的表（清大老師用的就是這張）
function tbBoard(S, blankNeed) {
  const B = board(S);
  if (blankNeed) blankRows(B, 'Need', [0, 1, 2, 3, 4], '?');
  return B;
}
async function relWork(tok, B, S, i, w, ms = 650) { B.setFinish(i, true); const nw = add(w, S.alloc[i]); await B.release(tok, i, nw, '+' + S.names[i], ms); return nw; }
FRAG.push(['dl-c-multi', '多種資源 A、B、C：Need、Available、safe sequence <P1, P3, P4, P2, P0>', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(TB), need = needOf(S);
  let B = null, w = null;
  await step(tok); // @1565.5 延伸到 multiple resource type：A、B、C
  B = tbBoard(S, true);
  cap('延伸到 multiple resource type：A、B、C', '演算法完全一樣，只是數字多一點');
  await step(tok); // @1585.5 Max 與 current allocation
  B.cellsOf('Max').forEach((r, i) => B.hlRow('Max', i, GOLD)); await wt(tok, 700); B.clearHl();
  B.cellsOf('Allocation').forEach((r, i) => B.hlRow('Allocation', i, GOLD));
  cap('有 Max，也有 current allocation', 'Allocation 這一欄指的就是 current holding');
  await step(tok); // @1594.0 相減 = Need
  B.clearHl();
  for (let i = 0; i < 5; i++) { fillRow(B, 'Need', i, need[i]); B.hlRow('Need', i, GREEN); await wt(tok, 300); }
  cap('Need = Max − Allocation：還需要多少', 'P0 (7,4,3)、P1 (1,2,2)、P2 (6,0,0)、P3 (0,1,1)、P4 (4,3,1)');
  await step(tok); // @1598.2 Available = Total − current holding
  B.clearHl();
  const tt = hot('Total = (10, 5, 7)', 4.4, 6.1);
  cap('根據這個 state 算出目前 Available', 'Available = Total − current holding');
  await step(tok); // @1614.0 A：0+2+3+2+0 = 7 → 剩 3；以此類推
  B.cellsOf('Allocation').forEach((r) => glow(r[0], GOLD));
  await wt(tok, 600);
  B.pushWork([3, 3, 2], 'Available');
  tx(tt, 'ΣAlloc = (7, 2, 5) → Available = (3, 3, 2)');
  cap('A：0 + 2 + 3 + 2 + 0 = 7，10 個所以 A 還剩 3', '以此類推：Available = (10,5,7) − (7,2,5) = (3,3,2)');
  await step(tok); // @1622.2 是 total 減這一欄，不是其他欄
  B.clearHl(); B.cellsOf('Allocation').forEach((r, i) => B.hlRow('Allocation', i, GOLD));
  cap('不要忘記：是 Total 減掉 Allocation 這一欄', '不是減 Max 或 Need');
  await step(tok); // @1626.1 scan through；多維度要同時符合
  B.clearHl(); w = [3, 3, 2];
  cap('剩下的就像剛才一樣 scan through', '多種 resource：三個維度要「同時」符合才可以');
  await step(tok); // @1644.0 例：(7,4,3) 對 (3,3,2) 不符合
  judge(B, 'Need', 0, need[0], w);
  cap('拿 Need 跟 (3,3,2) 一欄一欄比', 'P0 要 (7,4,3)：A、B、C 都不夠 → 就算全給它也跑不完');
  await step(tok); // @1662.4 (0,1,1) 也可以；給誰無所謂
  judge(B, 'Need', 3, need[3], w); B.hlRow('Need', 1, GREEN);
  cap('P1 (1,2,2)、P3 (0,1,1) 這兩個都可以', '要先給誰無所謂，不會影響最後找不找得到');
  await step(tok); // @1676.5 safe sequence 可以有多個
  note('safe sequence 不只一個，找到任何一個就好', -1.5, 0.5, 1.2);
  cap('safe sequence 的可能性不只一個', '只要找到任何一個都可以');
  await step(tok); // @1689.5 P1 (1,2,2) 可以 → free → Available 更新
  judge(B, 'Need', 1, need[1], w);
  w = await relWork(tok, B, S, 1, w);
  cap('P1 的 (1,2,2) 可以 → 讓它做完、free 掉', 'Available 加上它的 Allocation (2,0,0) → (5,3,2)');
  await step(tok); // @1699.0 以此類推：P3、P4
  judge(B, 'Need', 3, need[3], w); w = await relWork(tok, B, S, 3, w, 500);
  judge(B, 'Need', 4, need[4], w); w = await relWork(tok, B, S, 4, w, 500);
  cap('以此類推：P3 (0,1,1) ≤ (5,3,2) → (7,4,3)', 'P4 (4,3,1) ≤ (7,4,3) → (7,4,5)');
  await step(tok); // @1702.9 1 3 4 2 0
  judge(B, 'Need', 2, need[2], w); w = await relWork(tok, B, S, 2, w, 500);
  judge(B, 'Need', 0, need[0], w); w = await relWork(tok, B, S, 0, w, 500);
  B.clearHl();
  hot('< P1, P3, P4, P2, P0 >', 4.4, 6.1);
  cap('P2 → (10,4,7)；P0 → (10,5,7)', '找到了：P1、P3、P4、P2、P0');
  await step(tok); // @1708.7 目前是 safe state
  B.fin.forEach((f) => glow(f, GREEN));
  cap('所以目前是一個 safe 的 state', 'Work 最後回到 Total (10,5,7)，可以驗算');
}]);

FRAG.push(['dl-c-req1', 'Request：P1 再要 (1, 0, 2) → 假設給，仍然 safe', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(TB);
  let B = null, w = null, T = null;
  await step(tok); // @1728.6 先確認原來的狀態是 safe
  B = board(S); B.pushWork([3, 3, 2], 'Available');
  good('原狀態：safe（< P1, P3, P4, P2, P0 >）', 4.4, 6.1);
  cap('avoidance：先檢查過原來的系統狀態', '剛才知道它是 safe');
  await step(tok); // @1737.5 request：P1 多要 1 個 A、2 個 C
  B.hlRow('Allocation', 1, GOLD);
  const rq = hot('Request[P1] = (1, 0, 2)', -3.6, 6.1);
  cap('假設 request 進來：P1 說它要多 1 個 A、2 個 C', '才能執行下一段程式（像 malloc、create object）');
  await step(tok); // @1766.4 OS 要決定允不允許
  cap('OS 要決定：允不允許它做', '');
  await step(tok); // @1771.0 假設同意：把值加上去
  note('先「假設同意」：把 request 加到 Allocation 上', -1.5, 0.5, 1.2);
  cap('常搞混的地方：先假設同意', '把這些值加到 Allocation 上（不是真的給）');
  await step(tok); // @1789.4 P1：(2,0,0) → (3,0,2)
  T = cloneS(S); T.alloc[1] = add(T.alloc[1], [1, 0, 2]);
  lab.clear(); B = board(T); B.pushWork(avail0(T), 'Available'); B.hlRow('Allocation', 1, GOLD); B.hlRow('Need', 1, GOLD);
  hot('P1：Allocation (3,0,2)、Need (0,2,0)；Available (2,3,0)', 0, 6.1);
  cap('P1 原來是 (2,0,0)，加上去變成 (3,0,2)', 'Need 變 (0,2,0)，Available 變 (2,3,0)');
  await step(tok); // @1804.4 再跑一次 safe sequence algorithm
  B.clearHl(); w = avail0(T);
  cap('改成 (3,0,2) 後，再跑一次 safety', '看找不找得到');
  await step(tok); // @1812.6 找不到 → 不能同意
  const no1 = bad('找不到 → 不能同意（可能 deadlock）', -3.6, 0.3, 1.2);
  cap('如果找不到 safe sequence', '這個 assignment 就不能同意，因為有可能 deadlock');
  await step(tok); // @1820.5 這例找得到：P1、P3
  const nT = needOf(T);
  judge(B, 'Need', 1, nT[1], w); w = await relWork(tok, B, T, 1, w, 500);
  judge(B, 'Need', 3, nT[3], w); w = await relWork(tok, B, T, 3, w, 500);
  cap('這個例子找得到：P1 (0,2,0) ≤ (2,3,0) → (5,3,2)', 'P3 (0,1,1) → (7,4,3)');
  await step(tok); // @1825.1 P4、P0、P2
  judge(B, 'Need', 4, nT[4], w); w = await relWork(tok, B, T, 4, w, 450);
  judge(B, 'Need', 0, nT[0], w); w = await relWork(tok, B, T, 0, w, 450);
  judge(B, 'Need', 2, nT[2], w); w = await relWork(tok, B, T, 2, w, 450);
  B.clearHl();
  cap('P4 → (7,4,5)、P0 → (7,5,5)、P2 → (10,5,7)', 'safe sequence < P1, P3, P4, P0, P2 >');
  await step(tok); // @1834.6 可以 accept
  B.fin.forEach((f) => glow(f, GREEN));
  gone(no1); good('✓ 同意 P1 的 request', -3.6, 0.3, 1.2);
  cap('所以這個 assignment 可以 accept', '同意之後，未來任何狀況發生都還有解，不會 deadlock');
}]);

FRAG.push(['dl-c-req2', 'Request：P4 要 (3, 3, 0) → 假設給就 unsafe → 擋掉', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(TB);
  let B = null, T = null;
  await step(tok); // @1851.5 同樣原來狀態，P4 要 3 個 A、3 個 B
  B = board(S); B.pushWork([3, 3, 2], 'Available');
  B.hlRow('Allocation', 4, GOLD);
  hot('Request[P4] = (3, 3, 0)', -3.6, 6.1);
  cap('另一個例子：同樣是原來的狀態', '這次 P4 說它要 3 個 A、3 個 B 才能繼續');
  await step(tok); // @1863.7 本來 002 → 加上去 332
  T = cloneS(S); T.alloc[4] = add(T.alloc[4], [3, 3, 0]);
  lab.clear(); B = board(T); B.pushWork(avail0(T), 'Available'); B.hlRow('Allocation', 4, GOLD); B.hlRow('Need', 4, GOLD);
  hot('P4：Allocation (3,3,2)、Need (1,0,1)；Available (0,0,2)', 0, 6.1);
  cap('檢查方式一樣：P4 本來 (0,0,2)，加上去變 (3,3,2)', 'Available 只剩 (0,0,2)，P4 的 Need 變 (1,0,1)');
  await step(tok); // @1877.3 從原本狀態出發（P1 那個沒發生）
  note('從原來狀態出發：P1 的 request 沒發生', -3.6, 0.3, 1.2);
  cap('注意：是從原來的狀態出發', 'P1 那個 request 沒有發生，只有這個來了');
  await step(tok); // @1885.1 假設同意 → 找不到 safe sequence
  const w = avail0(T), nT = needOf(T);
  for (let i = 0; i < 5; i++) { judge(B, 'Need', i, nT[i], w); await wt(tok, 420); }
  B.clearHl();
  B.cellsOf('Need').forEach((r, i) => r.forEach((c, k) => glow(c, nT[i][k] <= w[k] ? null : RED)));
  cap('假設同意，跑一次：Work = (0,0,2)', '五個 process 的 Need 都有一欄超過 → 找不到 safe sequence');
  await step(tok); // @1892.0 hold 住或 reject
  bad('unsafe → hold 住或 reject，P4 等待', -3.6, 0.3, 1.2);
  cap('找不到，系統就把這個 allocation hold 住', '甚至直接 reject → 不會進入 unsafe state');
  await step(tok); // @1913.6 總結
  lab.clear(); B = board(S); B.pushWork([3, 3, 2], 'Available');
  hot("Banker's：request 來 → 假設發生、改 Allocation → 跑一遍 safety", 0, 6.1);
  cap("Banker's algorithm 就是這樣", '每個 request 來，先改 Allocation 假設發生，跑一遍：unsafe 就 reject／hold，safe 才 approve');
  await step(tok); // @1940.4 Max 永遠不會變
  B.cellsOf('Max').forEach((r, i) => B.hlRow('Max', i, GOLD));
  cap('欄位千萬別搞錯：Max 永遠不會變', '它是程式的 worst case，是 given 的 constraint');
  await step(tok); // @1958.6 Allocation 記錄目前狀態，會因 assignment 改變
  B.clearHl(); B.cellsOf('Allocation').forEach((r, i) => B.hlRow('Allocation', i, GREEN));
  cap('Allocation 才是記錄目前程式執行的狀態', '它會因為 assignment 而改變；你要檢查的是改變之後會不會出問題');
}]);

// ════════ b2lHjRiLeFE（第 22D 講 Ch7: Deadlocks — detection、recovery） ════════
FRAG.push(['dl-d-intro', 'Detection：同一套演算法，只看現在', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  await step(tok); // @15.8 detection、recovery
  hd('Deadlock detection ＋ recovery', 0, 4.6);
  cap('最後是 detection 跟 recovery', '');
  await step(tok); // @16.7 拿 avoidance 的演算法當 detection
  const a = bx('avoidance 的演算法', PCOL[3], -3, 0.4, 0, 3.6, 0.8, 1.2, 2);
  const d = bx('detection', PCOL[2], 3, 0.4, 0, 3.6, 0.8, 1.2, 2);
  pipe(V3(-1.0, 0.5, 0), V3(1.0, 0.5, 0), '#8a7a5c', 0.1, 0.1);
  cap('會做 avoidance，就拿同樣的演算法來做 detection', '');
  await step(tok); // @19.0 差別：不管未來，只管現在 → 更簡單
  idx('不管未來（沒有 claim / Max）', -3, 1.5, 0); good('只管現在的狀態 → 更簡單、沒有 decision', 3, 1.5, 0);
  cap('差別：不管未來，只管現在的狀態', '更簡單：沒有 decision，只判斷現在有沒有問題');
}]);

FRAG.push(['dl-d-single', 'Single instance：找 cycle，可簡化成 wait-for graph', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.2]);
  const N = 3, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r, Math.cos(k / N * Math.PI * 2) * r];
  const spec = { P: {}, R: {} };
  for (let k = 0; k < N; k++) { spec.P['P' + (k + 1)] = pp(k, 3.0); const [x, z] = pp(k + 0.5, 3.0); spec.R['R' + (k + 1)] = [x, z, 1]; }
  let G = null;
  await step(tok); // @43.7 single instance：回到 graph
  hd('Single instance（示意圖）', 0, 2.4, -4.4);
  G = rag({ P: spec.P });
  cap('第一個：single instance', '一樣回到 graph 的做法');
  await step(tok); // @53.1 process 和 resource（一個 box）
  const R = rag({ R: spec.R }); Object.assign(G.pos, R.pos); Object.assign(G.node, R.node);
  cap('有 process，有 resource 的 instance', '都是 single instance，所以一個 box 就好');
  await step(tok); // @64.2 avoidance 有 claim edge；這裡不用
  bad('不用 claim edge：不管未來', 0, 1.6, -4.4);
  cap('之前 avoidance 有 claim edge', '這裡不用了 —— 只管現在的系統狀態');
  await step(tok); // @72.4 記下目前狀態：request、assignment
  for (const [a, b, k] of [['P1', 'R1', 'req'], ['R1', 'P2', 'asg'], ['P2', 'R2', 'req'], ['R2', 'P3', 'asg'], ['P3', 'R3', 'req'], ['R3', 'P1', 'asg']]) { G.add(a, b, k); await wt(tok, 250); }
  cap('系統狀態一改變就記下來', '畫出 process 跟 resource 的關聯：request、assignment');
  await step(tok); // @93.7 跑 circle detection
  G.path(['P1', 'R1', 'P2', 'R2', 'P3', 'R3', 'P1']);
  ['P1', 'P2', 'P3'].forEach((p) => { G.node[p].glow(RED); G.node[p].mood('sad'); });
  cap('跑 circle detection', '有 circle 就是 deadlock；沒有就沒問題');
  await step(tok); // @100.0 兩個圖：右邊是簡化圖
  cap('投影片上有兩個圖', '右邊只是簡化圖');
  await step(tok); // @117.2 拿掉 resource，直接畫 process 之間
  for (let k = 0; k < N; k++) { const r = 'R' + (k + 1); G.E.filter((e) => e.a === r || e.b === r).forEach((e) => kill(e.g)); gone(G.node[r]); }
  G.E.length = 0;
  for (let k = 0; k < N; k++) { const a = 'P' + (k + 1), b = 'P' + ((k + 1) % N + 1); G.add(a, b, 'hot'); await wt(tok, 300); }
  hot('wait-for graph：Pi → Pj ＝ Pi 在等 Pj', 0, 1.6, 4.4);
  cap('process 之間一定透過某個 resource 產生關聯', 'single instance 可以把 resource 拿掉，直接畫 process 之間 → wait-for graph');
  await step(tok); // @131.6 不影響結果；找 circle
  cap('拿掉不影響結果：只看 process 之間的 dependency', '一樣找 circle，找到就代表偵測到 deadlock');
}]);

FRAG.push(['dl-d-multi', 'Multiple instance：detection algorithm（Allocation ＋ Request）', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(DET);
  let B = null, w = null;
  await step(tok); // @153.8 multiple instance：跑 safe sequence 的演算法
  hd('Multiple instance', 0, 6.1);
  cap('multiple instance：跑 safe sequence 演算法', '拿來做 detection');
  await step(tok); // @160.2 single instance 有 circle → 100% deadlock
  good('single instance：有 circle → 100% deadlock', -3.4, 4.6);
  cap('single instance：有 circle 就 100% deadlock', '');
  await step(tok); // @172.1 老師：這裡只是 check safe / unsafe
  note('老師：找不到 safe sequence 不代表一定 deadlock（課本：detection 找不到就是 deadlock，見易錯點）', 0, 3.6);
  cap('老師：這裡只是 check safe／unsafe', '理論複雜度差不多，實際跑會快一點');
  await step(tok); // @206.8 套用同樣做法；不用管 Max
  lab.clear();
  hot('不用 Max：只看目前的 Allocation 與 Request', 0, 6.1);
  cap('套用同樣的做法', '這裡不用管 Max 了，只看目前系統狀態');
  await step(tok); // @212.0 Allocation 與目前的 Request（恐龍書例）
  B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Request', S.req, '#dd8238']] });
  B.pushWork(avail0(S), 'Available');
  cap('只要目前的 Allocation 與 Request', '恐龍書例：A、B、C 共 7、2、6 → Available (0,0,0)');
  await step(tok); // @228.3 P1 卡著：還要 2 個 A、2 個 C
  B.hlRow('Request', 1, GOLD);
  cap('例如 P1 已經卡在那裡', '它還要 2 個 A、2 個 C 才能執行');
  await step(tok); // @238.5 剩下的 resource 能不能滿足
  B.clearHl(); workGlow(B, GOLD); w = avail0(S);
  cap('一樣看剩下的 resource（Available）是多少', '能不能滿足它的 Request');
  await step(tok); // @245.4 能滿足 → free Allocation → Available 增加
  judge(B, 'Request', 0, S.req[0], w); w = await relWork(tok, B, S, 0, w);
  cap('能滿足的，就讓它把 Allocation 的 resource free 掉', 'P0 要 (0,0,0) → 做完，Available 變 (0,1,0)');
  await step(tok); // @253.5 不需要 Max 的原因
  B.clearHl();
  const nm = note('Need = Max − Allocation 是「假設」最多要多少；Request 是「已經 given」的', -1.5, 0.5, 1.2);
  cap('為什麼不用 Max？Need 只是假設最多要多少', '這裡的 Request 是 given：現在就是要這麼多才能執行');
  await step(tok); // @271.3 直接用 Available 檢查 Request
  judge(B, 'Request', 1, S.req[1], w); await wt(tok, 350);
  judge(B, 'Request', 2, S.req[2], w); w = await relWork(tok, B, S, 2, w, 500);
  judge(B, 'Request', 3, S.req[3], w); w = await relWork(tok, B, S, 3, w, 500);
  cap('用 Available 檢查 Request：P1 不夠 → 等', 'P2 (0,0,0) → (3,1,3)；P3 (1,0,0) → (5,2,4)');
  await step(tok); // @275.8 達到就 free，沒達到就等
  judge(B, 'Request', 4, S.req[4], w); w = await relWork(tok, B, S, 4, w, 500);
  judge(B, 'Request', 1, S.req[1], w); w = await relWork(tok, B, S, 1, w, 500);
  B.clearHl();
  cap('有達到就 free，沒達到就等在那裡', 'P4 (0,0,2) → (5,2,6)；回頭 P1 (2,0,2) → (7,2,6)');
  await step(tok); // @280.7 找到 → 沒有 deadlock
  B.fin.forEach((f) => glow(f, GREEN));
  gone(nm); good('全部 Finish = true → 現在沒有 deadlock', -3.4, 0.3, 1.2);
  cap('全部都能做完 → 目前不可能有 deadlock', '找不到的話，就代表偵測到了 → 看怎麼做 recovery');
}]);

FRAG.push(['dl-d-more', 'P2 再多要一個 C → 系統已經 deadlock', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(DET);
  let B = null;
  await step(tok); // @297.5 原來的例子 OK
  B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Request', S.req, '#dd8238']] }); B.pushWork(avail0(S), 'Available');
  const ok0 = good('原來的例子：沒有 deadlock', 0, 6.1);
  cap('一樣的例子：原來是 OK 的', '');
  await step(tok); // @302.3 P2 的 Request 多一個
  S.req[2] = [0, 0, 1];
  fillRow(B, 'Request', 2, S.req[2]); B.hlRow('Request', 2, GOLD);
  cap('假設 P2 要的 resource 又多一個', 'Request[P2] = (0, 0, 1)：多要一個 C');
  await step(tok); // @309.8 沒有 avoidance → 系統就同意；跑 detection
  const r = detect(S); let w = avail0(S);
  for (const st of r.steps.slice(0, 5)) { judge(B, 'Request', st.i, st.need, w); if (st.ok) w = await relWork(tok, B, S, st.i, w, 450); else await wt(tok, 300); }
  B.clearHl();
  cap('沒有 avoidance 的機制 → 程式要，系統就同意', '跑 detection：P0 做完 → (0,1,0)，剩下的 Request 都不夠');
  await step(tok); // @318.0 已呈現 deadlock
  r.dead.forEach((i) => { B.hlRow('Allocation', i, RED); B.hlRow('Request', i, RED); });
  gone(ok0); bad('P1、P2、P3、P4 → deadlock', 0, 6.1);
  cap('改了之後，系統已經呈現 deadlock 的狀態', 'Finish 仍是 false 的 P1～P4 就是卡住的 process');
  await step(tok); // @327.3 OS 要 detect：卡住的是 user program
  note('OS 還能跑：它要知道程式不跑的原因 → counting、checking', -1.5, 0.5, 1.2);
  cap('OS 需要 detect：卡住的是 user program', 'OS 要知道程式不跑的原因，才做這些 counting、checking');
}]);

FRAG.push(['dl-d-recover', 'Recovery：kill process、選 victim、rollback、starvation', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.4, 0]);
  const N = 4, pp = (k, r) => [Math.sin(k / N * Math.PI * 2) * r - 1.6, Math.cos(k / N * Math.PI * 2) * r];
  let B = [], O = [];
  await step(tok); // @350.7 recovery 才是麻煩的地方
  B = Array.from({ length: N }, (_, k) => { const [x, z] = pp(k, 2.2); return pal('P' + (k + 1), PCOL[k], x, 0, z, 0.6); });
  O = [pal('P5', PCOL[4], 4.4, 0, -1.4, 0.6), pal('P6', PCOL[5], 4.4, 0, 1.4, 0.6)];
  for (let k = 0; k < N; k++) { const [x1, z1] = pp(k, 2.2), [x2, z2] = pp(k + 1, 2.2); pipe(V3(x1, 0.8, z1), V3(x2, 0.8, z2), '#d64545', 0.6, 0.6); }
  B.forEach((b) => { b.glow(RED); b.mood('sad'); });
  const dd = hd('偵測到 deadlock（示意：P1～P4 繞成圈）', 0, 4.4);
  cap('知道怎麼 detect 之後，麻煩的是 recovery', '有幾種 solution');
  await step(tok); // @360.6 最暴力：全部 kill（= reboot）
  const all = bad('① 全部 kill 掉 ＝ reboot', 0, 3.6);
  [...B, ...O].forEach((b) => b.g.scale.setScalar(0.6));
  cap('第一種最暴力：全部 kill 掉', '等於 reboot —— 電腦沒回應，有時就是 deadlock');
  await step(tok); // @376.6 好一點：只砍 involve circle 的
  [...B, ...O].forEach((b) => b.g.scale.setScalar(1)); O.forEach((b) => { b.glow(GREEN); b.mood('happy'); });
  tx(all, '② 只 kill 在 circle 裡的 process');
  cap('稍微好一點：只把 involve 那個 circle 的 process 砍掉', 'P5、P6 不受影響');
  await step(tok); // @398.3 one at a time
  tx(all, '③ one at a time：砍一個，再 detect 一次');
  cap('不要那麼暴力：one at a time', '先砍一個，看能不能解套；不行再繼續砍');
  await step(tok); // @420.3 誰先砍？priority 最低不一定能解
  B[2].g.scale.setScalar(0.75);
  const lowP = bub('priority 最低（示意）', pp(2, 2.2)[0], 1.7, pp(2, 2.2)[1]);
  cap('問題：到底誰要先被砍？', '砍 priority 最低的不一定能解 —— 它拿的 resource 可能很少');
  await step(tok); // @437.0 砍到最後反而砍更多 → case by case
  gone(lowP); note('從 priority 低的一路砍，最後可能砍得更多 → 需要 user program 的資訊，case by case', 0, 3.6, 2.6);
  cap('從 priority 低的一直砍，最後砍掉的反而更多', '怎麼做最好要很多 user program 的資訊，case by case');
  await step(tok); // @466.0 選 victim；preemption + rollback（checkpoint）
  lab.world.children.filter((o) => o.element && (o.element.className.includes('note') || o.element.className.includes('say'))).forEach((o) => kill(o));
  B[2].g.scale.setScalar(1);
  const v = bx('victim', '#d64545', pp(2, 2.2)[0], 1.6, pp(2, 2.2)[1], 1.2, 0.4, 0.6);
  const cp = bx('checkpoint', '#e9dcc4', -1.6, 0.25, 3.4, 2.4, 0.4, 0.8);
  cap('要找一個 victim 犧牲', '若有 preemption 與 rollback 機制（例如 checkpoint），可以回復');
  await step(tok); // @484.5 partial 還是整個重來
  idx('partial rollback？還是 total rollback 整個重來？', -1.6, 0.8, 3.4);
  cap('但要 support：partially 回復，還是整個重來', '沒有 support 就只能整個重來');
  await step(tok); // @495.5 一直砍同一個 → starvation
  for (let k = 0; k < 3; k++) { B[2].g.scale.setScalar(0.5); await wt(tok, 300); B[2].g.scale.setScalar(1); await wt(tok, 300); }
  B[2].mood('sad'); bad('同一個一直被砍 → starvation', 2.6, 3.0, 2.6);
  cap('會不會老是砍同一個？很有可能', '那個程式就永遠跑不完 → starvation');
  await step(tok); // @518.3 不 cover 太多：avoid / prevent 或 ignore
  gone(dd); hot('多半：avoid 或 prevent，不然就 ignore', 0, 4.4);
  cap('recovery 很多是 case by case，這裡不多講', '要嘛 avoid、prevent，要嘛 ignore 讓使用者自己解決');
}]);

// ════════ XpKrBUZqfGI（Deadlock | Necessary Conditions | Resource Allocation Graph） ════════
FRAG.push(['dl-e-def', 'Deadlock 的定義', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  let B = [];
  await step(tok); // @37.7 一組 process 在等別的 process 也在等的 resource
  hd('Deadlock', 0, 4.6);
  B = [-3.6, 0, 3.6].map((x, k) => pal('P' + (k + 1), PCOL[k], x, 0, 0.6, 0.7));
  B.forEach((b, k) => pipe(V3(-3.6 + k * 3.6 + 0.5, 0.6, 0.6), V3(-3.6 + ((k + 1) % 3) * 3.6 - 0.5, 0.6, 0.6), '#d64545', 0.05, 0.05));
  cap('deadlock：一組 process 在等 resource', '而這些 resource 也是其他 process 在等的');
  await step(tok); // @48.4 每個都在等「只有組內另一個」才能觸發的事件
  B.forEach((b) => b.mood('sad'));
  hot('每個都在等「只有組內另一個 process」才能觸發的事件', 0, 3.4);
  cap('每個 process 都在等一個事件', '而這個事件只有同一組裡的另一個 process 才能觸發');
  await step(tok); // @66.1 等一個永遠不會發生的事件
  B.forEach((b) => b.glow(RED));
  bad('等一個永遠不會發生的事件', 0, 2.6);
  cap('也可以說：兩個以上的 process', '在等一個永遠不會發生的事件');
}]);

FRAG.push(['dl-e-bridge', '單線橋：兩台車誰都不退', async (tok) => {
  fresh([0, 7, 10], [0, 0, 0]);
  let a = null, b = null;
  await step(tok); // @77.0 單線橋，一次只能過一台車
  ctx.tile(V3(0, 0.05, 0), 9, 1.4, '#c9b48f'); ctx.tile(V3(-6, 0.02, 0), 3, 3, '#cfe8d6'); ctx.tile(V3(6, 0.02, 0), 3, 3, '#cfe8d6');
  hd('single lane bridge：一次一台', 0, 1.6, -1.6);
  cap('經典例子：一座單線橋', '一次只能讓一台車通過');
  await step(tok); // @92.0 兩邊各來一台，在中間遇到
  a = bx('🚗 →', PCOL[0], -6, 0.35, 0, 1.4, 0.6, 1.0); b = bx('← 🚗', PCOL[1], 6, 0.35, 0, 1.4, 0.6, 1.0);
  await wt(tok, 200); put(a, -0.9, 0.35, 0); put(b, 0.9, 0.35, 0);
  cap('兩邊各來一台，在橋中間遇到', '');
  await step(tok); // @104.3 只有一台退後另一台才能過；兩台都不退
  glow(a, RED); glow(b, RED);
  bub('我不退', -2.2, 1.6, 0); bub('我也不退', 2.2, 1.6, 0);
  cap('只有一台退後，另一台才能過', '如果兩台都決定不退 → deadlock，誰都過不去');
  await step(tok); // @126.7 一個 resource、兩個 process 都在要
  hot('橋 = resource；兩台車 = 兩個 process', 0, 0.2, 2.4);
  cap('對應回 OS：橋是一個 resource', '兩個 process 都在 request 它 → deadlock 的情境');
}]);

FRAG.push(['dl-e-two', 'OS 的例子：P1、P2 各拿一個、等另一個', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.2]);
  let G = null;
  await step(tok); // @137.0 OS 觀點：P1、P2、R1、R2
  G = rag({ P: { P1: [-3.2, 0], P2: [3.2, 0] }, R: { R1: [0, -2.4, 1], R2: [0, 2.4, 1] } });
  cap('從 OS 的角度：兩個 process P1、P2', '兩個 resource R1、R2');
  await step(tok); // @166.0 P1 需要 R1、R2 才能完成
  bub('我要 R1 和 R2 才能做完', -3.2, 1.6, 0);
  cap('P1 要 R1 和 R2 兩個都拿到，才能執行完', '');
  await step(tok); // @183.6 P2 也需要 R1、R2
  bub('我也要 R1 和 R2', 3.2, 1.6, 0);
  cap('P2 也一樣，需要 R1 和 R2', '');
  await step(tok); // @203.0 time 0：R1 free → 給 P1
  lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  G.add('R1', 'P1', 'asg');
  cap('time 0：R1 是 free 的 → allocate 給 P1', '');
  await step(tok); // @239.7 同時 R2 free → 給 P2
  G.add('R2', 'P2', 'asg');
  cap('同一時間：R2 也是 free 的 → allocate 給 P2', '');
  await step(tok); // @250.4 P1 還要 R2 → request
  G.add('P1', 'R2', 'req');
  cap('P1 執行還需要 R2', '所以 P1 對 R2 發出 request');
  await step(tok); // @264.4 P2 要 R1 → request
  G.add('P2', 'R1', 'req');
  cap('P2 需要 R1', '也發出 request');
  await step(tok); // @270.7 拿不到就不放
  G.node.P1.mood('sad'); G.node.P2.mood('sad');
  cap('問題：P1 拿不到 R2，就不會放掉 R1', 'P2 拿不到 R1，也不會放掉 R2');
  await step(tok); // @287.3 這就是 deadlock
  G.path(['P1', 'R2', 'P2', 'R1', 'P1']); G.node.P1.glow(RED); G.node.P2.glow(RED);
  bad('deadlock', 0, 1.6, -4.0);
  cap('這就是 deadlock', '每個 process 都在等組內另一個 process 才能觸發的事件');
  await step(tok); // @308.1 P1 等 P2 放 R2，P2 等 P1 放 R1
  bub('等 P2 放 R2', -3.2, 1.7, 0); bub('等 P1 放 R1', 3.2, 1.7, 0);
  cap('P1 在等 P2 放掉 R2', 'P2 在等 P1 放掉 R1 —— 完全符合定義');
}]);

FRAG.push(['dl-e-four', '四個必要條件（同時成立）', async (tok) => {
  fresh([0, 6, 11.5], [0, 1.2, 0]);
  const list = ['① Mutual exclusion', '② Hold and wait', '③ No preemption', '④ Circular wait'].map((t, k) => tag(t, 'idx', -5.4, 4.2 - k * 0.6, -1));
  const on = (k) => list.forEach((l, j) => { l.element.className = 'lab-label ' + (j === k ? 'ptr alt' : 'idx'); });
  let a = null, b = null, r1 = null, r2 = null, ring = [];
  await step(tok); // @325.0 必要條件：四個同時成立才會 deadlock
  hot('四個條件同時成立 → 才可能 deadlock', 2.2, 4.4, -1);
  cap('deadlock 的 necessary conditions', '四個條件同時成立，才可能發生 deadlock');
  await step(tok); // @345.7 mutual exclusion：一次一個 process
  on(0);
  a = pal('P1', PCOL[0], -2.6, 0, 1.2, 0.7); b = pal('P2', PCOL[1], 2.6, 0, 1.2, 0.7);
  r1 = bx('R', RCOL[0], 0, 0.3, -0.6, 1.0, 0.6, 0.8); put(r1, -4.0, 0.3, 1.2); b.mood('sad');
  cap('① Mutual exclusion', '一次只有一個 process 能使用這個 resource');
  await step(tok); // @365.6 不能 shared mode
  bub('不能 share：只能等', 2.6, 1.8, 1.2);
  cap('也就是 resource 不能以 shared mode 使用', '有 mutual exclusion，就可能 deadlock');
  await step(tok); // @378.2 hold and wait
  on(1);
  lab.world.children.filter((o) => o.element && o.element.className.includes('say')).forEach((o) => kill(o));
  r2 = bx('R2', RCOL[1], 4.0, 0.3, 1.2, 1.0, 0.6, 0.8); P.relabel(r1, 'R1');
  pipe(V3(-2.0, 0.6, 1.2), V3(2.0, 0.6, 1.2), '#d64545', 0.1, 0.1);
  bub('hold R1，wait R2', -2.6, 2.2, 1.2);
  cap('② Hold and wait', 'process 至少 hold 一個 resource，同時在等另一個');
  await step(tok); // @428.0 no preemption：只能自願釋放
  on(2);
  glow(r1, GOLD); glow(r2, GOLD);
  cap('③ No preemption', 'resource 只能由持有的 process 自願釋放，不能被搶走');
  await step(tok); // @466.6 若能強制釋放
  note('如果能強制 free 那個 resource，就可以解開', 0, 3.0, 1.2);
  cap('反過來，如果可以強制把 resource free 掉', '那就不會卡死');
  await step(tok); // @473.3 circular wait：P0 等 P1 … Pn 等 P0
  on(3);
  gone(a, b, r1, r2); lab.world.children.filter((o) => (o.userData && o.userData.mat) || (o.element && !o.element.className.includes('idx') && !o.element.className.includes('ptr'))).forEach((o) => kill(o));
  const N = 5, pp = (k) => [Math.sin(k / N * Math.PI * 2) * 2.6 + 1.2, Math.cos(k / N * Math.PI * 2) * 2.6 + 0.6];
  const nm = ['P0', 'P1', 'P2', '…', 'Pn'];
  ring = nm.map((n, k) => pal(n, PCOL[k], pp(k)[0], 0, pp(k)[1], 0.5));
  for (let k = 0; k < N; k++) { const [x1, z1] = pp(k), [x2, z2] = pp(k + 1); pipe(V3(x1, 0.6, z1), V3(x2, 0.6, z2), '#d64545', 0.55, 0.55); await wt(tok, 200); }
  cap('④ Circular wait：P0 等 P1、P1 等 P2……', '一直到 Pn，最後一個又在等第一個 P0');
  await step(tok); // @513.1 四個必須同時成立
  list.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  ring.forEach((r) => r.glow(RED));
  cap('這四個條件要同時成立，deadlock 才會發生', 'mutual exclusion、hold and wait、no preemption、circular wait');
}]);

FRAG.push(['dl-e-rag', 'Resource allocation graph：vertex 與 edge', async (tok) => {
  fresh([0, 8, 9.5], [0, 0, 0.2]);
  let p = null, r1 = null, r4 = null;
  await step(tok); // @535.0 RAG：G = (V, E)
  hd('Resource allocation graph  G = (V, E)', 0, 2.4, -4.2);
  cap('resource allocation graph 用 G 表示', '由一組 vertex（點）和 edge（邊）組成');
  await step(tok); // @553.5 vertex 兩種：process、resource
  idx('vertex：process ○、resource □', -3, 1.6, -3.2);
  cap('vertex 有兩種：process 和 resource', 'edge 也有兩種');
  await step(tok); // @581.1 assign edge、request edge
  idx('edge：assign edge、request edge', 3, 1.6, -3.2);
  cap('edge 兩種：assign edge 和 request edge', '');
  await step(tok); // @606.4 process：Pi
  p = pal('Pi', PCOL[0], -3.6, 0, 0.6, 0.7);
  cap('process 寫成 Pi（i = 0, 1, 2, 3…）', '');
  await step(tok); // @619.0 resource：single / multiple instance
  cap('resource 再分兩種', 'single instance 和 multiple instance（例如很多份 media player）');
  await step(tok); // @651.0 方塊裡一個點／多個點
  r1 = rag({ R: { Ra: [1.0, -1.2, 1] } }); r4 = rag({ R: { Rb: [1.0, 2.2, 4] } });
  idx('single instance：一個點', 3.6, 0.4, -1.2); idx('multiple instance：4 個點', 3.6, 0.4, 2.2);
  cap('single instance：方塊裡一個點', 'multiple instance：點的數量 = instance 數（這裡 4 個）');
  await step(tok); // @672.7 assign edge：resource → process
  pipe(V3(1.0, 0.5, -1.2), V3(-3.6, 0.5, 0.6), ECOL.asg, 0.75, 0.6, 0.05);
  idx('assign：resource → process', -1.2, 1.2, -1.2);
  cap('assign edge：把 resource 配給 process', '方向是 resource → process');
  await step(tok); // @700.2 request edge：process → resource
  pipe(V3(-3.6, 0.5, 0.6), V3(1.0, 0.5, 2.2), ECOL.req, 0.6, 0.75, 0.05);
  idx('request：process → resource', -1.2, 1.2, 2.4);
  cap('request edge：方向是 process → resource', '');
}]);

const GAL = { P: { P1: [-3.5, 0], P2: [0, 0], P3: [3.5, 0] }, R: { R1: [-1.75, -2.6, 1], R3: [1.75, -2.6, 1], R2: [-1.75, 2.6, 2] } };
FRAG.push(['dl-e-ex1', 'Galvin 的例子：P3 → P2 → P1 依序做完，沒有 deadlock', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.2]);
  let G = null;
  await step(tok); // @721.1 從圖判斷會不會 deadlock
  hd('從 graph 判斷有沒有 deadlock', 0, 2.4, -4.4);
  cap('用一個很經典的例子', '從 graph 判斷 deadlock 會不會發生');
  await step(tok); // @739.0 Galvin 書上的經典例
  G = rag(GAL);
  cap('包括 Galvin（恐龍書）在內，多數課本都有這個例子', '');
  await step(tok); // @745.2 P1；R1 已配給 P2
  G.add('P1', 'R1', 'req'); await wt(tok, 300); G.add('R1', 'P2', 'asg');
  cap('P1 要 R1，而 R1 已經 allocate 給 P2', '');
  await step(tok); // @757.0 R2 配給 P1
  G.add('R2', 'P1', 'asg');
  cap('R2 有一個 instance 配給 P1', '');
  await step(tok); // @770.3 R2 有兩個 instance，另一個給 P2
  G.add('R2', 'P2', 'asg');
  cap('R2 其實有兩個 instance', '另一個也 allocate 給了 P2');
  await step(tok); // @777.5 P2 要 R3，R3 在 P3 手上
  G.add('P2', 'R3', 'req'); await wt(tok, 300); G.add('R3', 'P3', 'asg');
  cap('P2 在 request R3', 'R3 的 instance 配給了 P3');
  await step(tok); // @794.0 有沒有 deadlock？
  cap('這就是目前的狀況', '要判斷有沒有 deadlock');
  await step(tok); // @800.8 P3 不再要別的 → 做完 → 放 R3
  G.node.P3.glow(GREEN); G.node.P3.mood('happy');
  await wt(tok, 600);
  G.cut('R3', 'P3');
  cap('先看 P3：它沒有再 request 別的 resource', '只需要 R3 → 做完後 release R3');
  await step(tok); // @842.4 R3 free → 給 P2 → P2 做完
  G.retype('P2', 'R3', 'asg', true); G.node.P2.glow(GREEN); G.node.P2.mood('happy');
  cap('R3 free 了 → P2 的 request 變成 allocation', 'P2 也可以一路執行到完成');
  await step(tok); // @879.6 P2 做完放掉 R1、R2 → P1 拿到 R1
  G.cut('R3', 'P2'); G.cut('R2', 'P2'); G.cut('R1', 'P2');
  await wt(tok, 500);
  G.retype('P1', 'R1', 'asg', true); G.node.P1.glow(GREEN); G.node.P1.mood('happy');
  cap('P2 做完，放掉 R1、R2（還有 R3）', 'P1 只差 R1 → R1 free 了，P1 也能完成');
  await step(tok); // @911.6 沒有 deadlock
  good('沒有 deadlock：P3 → P2 → P1 依序做完', 0, 2.4, 4.4);
  cap('所以這張圖目前沒有 deadlock', 'P3 做完，其他人就跟著做完');
}]);

FRAG.push(['dl-e-ex2', 'P3 也要 R2：互相依賴 → deadlock', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.2]);
  let G = null;
  await step(tok); // @929.6 如果 P3 也要 R2
  G = rag(GAL);
  [['P1', 'R1', 'req'], ['R1', 'P2', 'asg'], ['R2', 'P1', 'asg'], ['R2', 'P2', 'asg'], ['P2', 'R3', 'req'], ['R3', 'P3', 'asg']].forEach(([a, b, k]) => G.add(a, b, k));
  G.add('P3', 'R2', 'req'); G.paint('P3', 'R2', GOLD);
  cap('同一張圖，只差一個地方', '如果 P3 也在 request R2 呢？');
  await step(tok); // @968.6 R2 在 P1、P2 手上 → P3 要等 P1 或 P2
  G.paint('R2', 'P1', '#d64545'); G.paint('R2', 'P2', '#d64545'); G.node.P3.mood('sad');
  cap('R2 在誰手上？P1 和 P2', 'P3 要等 P1 或 P2 做完才能完成');
  await step(tok); // @983.6 P2 要 R3，R3 在 P3 → P2 做不完
  G.paint('P2', 'R3', '#d64545'); G.paint('R3', 'P3', '#d64545'); G.node.P2.mood('sad');
  cap('P2 需要 R3，而 R3 現在在 P3 手上', '所以 P2 也做不完');
  await step(tok); // @993.2 P1 要 R1，R1 在 P2；P2 要等 P3
  G.paint('P1', 'R1', '#d64545'); G.paint('R1', 'P2', '#d64545'); G.node.P1.mood('sad');
  cap('P1 需要 R1，R1 在 P2 手上', 'P2 什麼時候做完？要等 P3 之後');
  await step(tok); // @1000.1 互相依賴 → deadlock
  ['P1', 'P2', 'P3'].forEach((p) => G.node[p].glow(RED));
  bad('每個 process 都依賴另一個 → deadlock', 0, 2.4, 4.4);
  cap('每個 process 都依賴另一個 process', '這時就是 deadlock');
  await step(tok); // @1011.1 RAG 可用來偵測 deadlock
  hot('resource allocation graph：可以拿來偵測 deadlock', 0, 2.4, -4.4);
  cap('這就是 resource allocation graph 的用途', '用它偵測系統裡有沒有 deadlock');
}]);

// ════════ 7gMLNiEz3nw（Gate Smashers：Banker Algorithm；P1–P5，Total 10/5/7） ════════
FRAG.push(['dl-f-avoid', "Banker's 是 deadlock avoidance（影片誤稱 detection）", async (tok) => {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  const S = cloneS(VIDEO);
  let Pp = [];
  await step(tok); // @0.3 Banker's algorithm = deadlock avoidance
  hd("Banker's algorithm", 0, 4.6);
  Pp = S.names.map((p, k) => pal(p, PCOL[k], -4.4 + k * 2.2, 0, 1.8, 0.6));
  cap("Banker's algorithm", '也叫 deadlock avoidance algorithm');
  await step(tok); // @9.4 事先告訴 OS：哪些 process、要哪些 resource、要多少
  S.names.forEach((p, k) => idx('Max ' + vec(S.max[k]), -4.4 + k * 2.2, 1.3, 1.8));
  const os = prop('monitor', 0, 0, -1.8, 1.0, 'OS');
  cap('avoidance：要事先告訴 OS', '有哪些 process、會要哪些 resource、要多少');
  await step(tok); // @27.1 系統依此決定誰執行、誰 wait
  Pp[1].mood('happy'); Pp[0].mood('sad');
  bub('先執行', -2.2, 2.3, 1.8); bub('先 wait', -4.4, 2.3, 1.8);
  cap('系統依這些資訊決定', '哪個 process 先執行、哪個要 wait');
  await step(tok); // @36.3 prevention 還是 avoidance？→ avoidance
  good('Banker = deadlock avoidance', 0, 3.6, -1.8);
  cap('常考：它是 prevention 還是 avoidance？', '答案：deadlock avoidance');
  await step(tok); // @57.1 影片說也用於 detection → 錯
  const w = bx('影片：「也用於 detection」✗', '#d64545', 3.6, 0.3, -1.8, 4.4, 0.6, 1.0, 2);
  cap('影片接著說它也用於 deadlock detection', '這是錯誤用語：Banker 只用在 avoidance');
  await step(tok); // @66.6 detection 是另一個演算法
  P.relabel(w, 'detection：比 Request、事後找'); P.tint(w, '#9b7ef4');
  cap('detection 是另一個演算法：比較目前的 Request', '不需要 Max，用在 deadlock 發生之後');
}]);

FRAG.push(['dl-f-tables', '題目：5 個 process、A/B/C、Allocation、Max', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(VIDEO);
  let B = null;
  await step(tok); // @73.6 GATE 常考：給一個 scenario
  hd('GATE 常考：給 scenario，問會不會 deadlock', 0, 6.1);
  cap('這題在 GATE 等考試常出現', '題目會給一個 scenario');
  await step(tok); // @80.8 5 個 process、A、B、C 三種 resource
  B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4']] });
  blankRows(B, 'Allocation', [0, 1, 2, 3, 4]); blankRows(B, 'Max', [0, 1, 2, 3, 4]);
  cap('5 個 process：P1～P5', '3 種 resource：A、B、C');
  await step(tok); // @155.8 A 像 CPU、B 像 memory、C 像 printer
  const ty = idx('A = CPU、B = memory、C = printer（instance = 個數）', -1.5, 0.5, 1.2);
  cap('3 種不同 type 的 resource', 'A 可以想成 CPU、B 是 memory、C 是 printer');
  await step(tok); // @178.1 A 10、B 5、C 7
  hot('Total：A 10、B 5、C 7', 3.6, 6.8);
  cap('系統裡 A 有 10 個、B 5 個、C 7 個', '10 個 CPU、5 個 memory、7 個 printer');
  await step(tok); // @195.7 Allocation：已經配給的
  B.cellsOf('Allocation').forEach((r, i) => B.hlRow('Allocation', i, GOLD));
  cap('Allocation：系統已經配給每個 process 多少', '');
  await step(tok); // @235.9 P1：A 0、B 1、C 0
  B.clearHl(); fillRow(B, 'Allocation', 0, S.alloc[0]); B.hlRow('Allocation', 0, GOLD);
  cap('P1 有 A 0 個（一個 CPU 都還沒給）', 'B 1 個、C 0 個 → (0,1,0)');
  await step(tok); // @251.8 P2 200、P3 302、P4 211、P5 002
  B.clearHl();
  for (let i = 1; i < 5; i++) { fillRow(B, 'Allocation', i, S.alloc[i]); B.hlRow('Allocation', i, GOLD); await wt(tok, 350); }
  cap('P2 (2,0,0)、P3 (3,0,2)、P4 (2,1,1)', 'P5 (0,0,2)：C 有 2 個 instance');
  await step(tok); // @272.7 Maximum need
  B.clearHl(); B.cellsOf('Max').forEach((r, i) => B.hlRow('Max', i, GOLD));
  cap('Maximum need：每個 process 總共需要多少', '');
  await step(tok); // @281.2 main point：事先告知 → avoidance
  note('事先告訴系統 → 所以叫 avoidance', -1.5, -0.2, 1.2);
  cap('這是重點：正因為事先告訴系統', '所以它叫 deadlock avoidance');
  await step(tok); // @290.5 P1 Max (7,5,3)
  B.clearHl(); fillRow(B, 'Max', 0, S.max[0]); B.hlRow('Max', 0, GOLD);
  cap('P1 事先說：我要 A 7 個、B 5 個、C 3 個', '給我這些，我就能成功執行完');
  await step(tok); // @318.4 P3 Max (9,0,2)
  B.clearHl(); fillRow(B, 'Max', 1, S.max[1]); fillRow(B, 'Max', 2, S.max[2]); B.hlRow('Max', 2, GOLD);
  cap('P3 的 maximum need 是 (9,0,2)', 'A 9 個、B 不需要、C 2 個');
  await step(tok); // @340.6 P4、P5 也都給了 Max
  B.clearHl(); fillRow(B, 'Max', 3, S.max[3]); fillRow(B, 'Max', 4, S.max[4]); B.hlRow('Max', 3, GOLD); B.hlRow('Max', 4, GOLD);
  gone(ty);
  cap('P4 (4,2,2)、P5 (5,3,3)', '五個 process 都給了自己的 maximum need');
}]);

FRAG.push(['dl-f-safe', 'Safe 與 unsafe（影片的簡化說法）', async (tok) => {
  fresh([0, 8, 9], [0, 0, 0.4]);
  await step(tok); // @346.5 主問題：有沒有 deadlock
  hd('問題：會不會 deadlock？', 0, 2.4, -4);
  cap('主要問題：這個 scenario 會不會 deadlock？', '');
  await step(tok); // @357.6 safe = 不會；unsafe = 會（簡化）
  zone('safe', -2.6, 0.02, 0.6, 4.6, 5.0, '#cfe8d6'); zone('unsafe', 2.6, 0.02, 0.6, 4.6, 5.0, '#f3dcc0');
  zone('deadlock', 3.0, 0.06, 1.4, 2.6, 2.4, '#f2b8b0');
  good('safe：不會 deadlock', -2.6, 0.8, 0.6); note('影片：unsafe = 會 deadlock（其實是「可能」）', 3.6, 0.6, 2.4);
  cap('用 safe / unsafe 回答：safe 不會 deadlock', '影片說 unsafe 會 deadlock —— 精確說是「可能」');
  await step(tok); // @377.6 不會 deadlock → 寫 safe sequence
  ['P?', 'P?', 'P?', 'P?', 'P?'].forEach((t, k) => bx(t, PCOL[k], -4.4 + k * 1.0, 0.3, -1.2, 0.8, 0.5, 0.7));
  cap('如果不會 deadlock，要寫出 safe sequence', 'process 依什麼順序拿資源、做完，才不會 deadlock');
}]);

FRAG.push(['dl-f-avail', 'Available = Total − ΣAllocation = (3, 3, 2)', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(VIDEO);
  let B = null, lab1 = null;
  await step(tok); // @399.4 第三個：Available
  B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4']], workName: 'Available' });
  cap('第三樣東西：Available', '');
  await step(tok); // @407.4 total 10 5 7
  lab1 = hot('Total = (10, 5, 7)', 0, 6.1);
  cap('總共有 (10, 5, 7)', '');
  await step(tok); // @414.7 已經配出去一部分（不是從 0 開始）
  B.cellsOf('Allocation').forEach((r, i) => B.hlRow('Allocation', i, GOLD));
  cap('但系統已經配出去一些了', '我們不是從時間 0 開始，而是某個時間點');
  await step(tok); // @435.6 A：0+2+3+2+0 = 7
  B.clearHl(); B.cellsOf('Allocation').forEach((r) => glow(r[0], GOLD));
  tx(lab1, 'A 已配出：0 + 2 + 3 + 2 + 0 = 7');
  cap('Allocation 加總：A 是 0 + 2 + 3 + 2 + 0', '= 7 個已經配出去');
  await step(tok); // @451.3 B：1+1 = 2；C：2+1+2 = 5
  B.cellsOf('Allocation').forEach((r) => { glow(r[0], null); glow(r[1], GOLD); glow(r[2], GOLD); });
  tx(lab1, 'B：1 + 1 = 2　C：2 + 1 + 2 = 5');
  cap('B：1 + 1 = 2；C：2 + 1 + 2 = 5', '已配出 (7, 2, 5)');
  await step(tok); // @470.8 A：10 − 7 = 3
  B.clearHl(); B.cellsOf('Allocation').forEach((r) => r.forEach((c) => glow(c, null)));
  tx(lab1, 'A：10 − 7 = 3');
  cap('A 總共 10 個，已經給了 7 個', '剩 10 − 7 = 3');
  await step(tok); // @487.0 3、3、2
  tx(lab1, '(10, 5, 7) − (7, 2, 5) = (3, 3, 2)');
  B.pushWork(avail0(S), 'Available');
  cap('B：5 − 2 = 3；C：7 − 5 = 2', 'Available = (3, 3, 2)');
  await step(tok); // @498.5 current availability
  workGlow(B, GOLD);
  cap('這就是目前（current）的 availability', '(3, 3, 2)');
}]);

FRAG.push(['dl-f-need', 'Remaining need = Max − Allocation', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(VIDEO), need = needOf(S);
  let B = null;
  const cell = (i, k) => B.cellsOf('Need')[i][k];
  await step(tok); // @509.4 remaining need
  B = board(S, { groups: [['Allocation', S.alloc, '#4b9ee2'], ['Max', S.max, '#9b7ef4'], ['Need', S.alloc.map(() => [0, 0, 0]), '#dd8238']] });
  blankRows(B, 'Need', [0, 1, 2, 3, 4], '?');
  cap('下一個：remaining need（還需要多少）', '');
  await step(tok); // @544.5 蘋果：要 10、給了 3 → 再給 7
  const ap = note('要 10 顆蘋果、已經給 3 顆 → 還要給 7 顆', -1.5, 0.5, 1.2);
  cap('像小時候的數學題：小孩要 10 顆蘋果', '已經給了 3 顆，還要再給 7 顆');
  await step(tok); // @579.8 Max − Allocation
  gone(ap);
  hot('Need = Max − Allocation', 0, 6.1);
  cap('remaining need = Max − Allocation', '');
  await step(tok); // @584.6 P1 A：7 − 0 = 7
  B.hlRow('Max', 0, GOLD); B.hlRow('Allocation', 0, GOLD);
  P.relabel(cell(0, 0), need[0][0]); glow(cell(0, 0), GREEN);
  cap('P1 的 A：最多要 7 個，已經給 0 個', '還要 7 個');
  await step(tok); // @596.5 B：5 − 1 = 4
  P.relabel(cell(0, 1), need[0][1]); glow(cell(0, 1), GREEN);
  cap('B：要 5 個，已經給 1 個', '5 − 1 = 4');
  await step(tok); // @605.1 C：3 − 0 = 3
  P.relabel(cell(0, 2), need[0][2]); glow(cell(0, 2), GREEN);
  cap('C：要 3 個，一個都還沒給', '還是 3 → P1 Need (7, 4, 3)');
  await step(tok); // @613.8 P2：(3,2,2) − (2,0,0) = (1,2,2)
  B.clearHl(); fillRow(B, 'Need', 1, need[1]); B.hlRow('Max', 1, GOLD); B.hlRow('Allocation', 1, GOLD); B.hlRow('Need', 1, GREEN);
  cap('P2：A 要 3、已給 2 → 還要 1；B 要 2 → 2；C → 2', '(3,2,2) − (2,0,0) = (1,2,2)');
  await step(tok); // @637.7 P3：(9,0,2) − (3,0,2) = (6,0,0)
  B.clearHl(); fillRow(B, 'Need', 2, need[2]); B.hlRow('Max', 2, GOLD); B.hlRow('Allocation', 2, GOLD); B.hlRow('Need', 2, GREEN);
  cap('P3：9 − 3 = 6、0 − 0 = 0、2 − 2 = 0', '(6, 0, 0)');
  await step(tok); // @645.8 A 對 A、B 對 B、C 對 C
  note('A 減 A、B 減 B、C 減 C，別錯欄', -1.5, 0.5, 1.2);
  cap('算的時候小心：A 減 A、B 減 B、C 減 C', '不然常在這裡算錯');
  await step(tok); // @656.7 P4：(4,2,2) − (2,1,1) = (2,1,1)
  B.clearHl(); fillRow(B, 'Need', 3, need[3]); B.hlRow('Max', 3, GOLD); B.hlRow('Allocation', 3, GOLD); B.hlRow('Need', 3, GREEN);
  cap('P4：4 − 2 = 2、2 − 1 = 1、2 − 1 = 1', '(2, 1, 1)');
  await step(tok); // @665.0 P5：(5,3,3) − (0,0,2) = (5,3,1)
  B.clearHl(); fillRow(B, 'Need', 4, need[4]); B.hlRow('Max', 4, GOLD); B.hlRow('Allocation', 4, GOLD); B.hlRow('Need', 4, GREEN);
  cap('P5：C 要 3、已給 2 → 只剩 1', '(5,3,3) − (0,0,2) = (5,3,1)');
  await step(tok); // @678.6 全部 remaining need
  B.clearHl(); B.cellsOf('Need').forEach((r, i) => B.hlRow('Need', i, GREEN));
  cap('五個 process 的 remaining need 都算好了', '(7,4,3)、(1,2,2)、(6,0,0)、(2,1,1)、(5,3,1)');
}]);

FRAG.push(['dl-f-safety', 'Safety check：P2 → P4 → P5 → P1 → P3', async (tok) => {
  fresh([0, 3.2, 14], [0, 2.4, 0]);
  const S = cloneS(VIDEO), need = needOf(S);
  const B = board(S); B.pushWork(avail0(S), 'Available');
  let w = avail0(S);
  const cell = (i, k) => B.cellsOf('Need')[i][k];
  await step(tok); // @705.6 availability (3,3,2)
  workGlow(B, GOLD);
  cap('現在系統 available：A 3、B 3、C 2', '');
  await step(tok); // @716.1 能不能滿足某人的 remaining need
  cap('檢查：依目前的 availability', '能不能 fulfill 某個 process 的 remaining need');
  await step(tok); // @724.2 P1：7 > 3、4 > 3、3 > 2 → 不行
  judge(B, 'Need', 0, need[0], w);
  cap('P1 要 A 7 個，只有 3；B 要 4，只有 3；C 要 3，只有 2', '不能 fulfill → P1 先不放進 sequence');
  await step(tok); // @749.9 下一個 P2；若全部都不行 → deadlock
  B.clearHl();
  const allNo = note('如果所有 process 都 fulfill 不了 → unsafe（可能 deadlock）', -1.5, 0.5, 1.2);
  cap('接著檢查 P2', '如果每個 process 的 need 都無法 fulfill → unsafe（影片說會 deadlock，精確說是「可能」）');
  await step(tok); // @765.2 P2：1 ≤ 3、2 ≤ 3、2 ≤ 2 → 可以
  judge(B, 'Need', 1, need[1], w);
  cap('P2：A 要 1 有 3、B 要 2 有 3、C 要 2 有 2', '可以 fulfill P2 的 remaining need');
  await step(tok); // @782.3 示意：若 A 是 4 → 只夠 C 也不行
  P.relabel(cell(1, 0), '4'); judge(B, 'Need', 1, [4, 2, 2], w);
  cap('示意：如果這裡不是 1 而是 4 呢？', '只夠 B、C 也不行 —— 三種資源要同時 ≤ available');
  await step(tok); // @844.0 P3：6 > 3 → 不行（B、C 雖然夠）
  P.relabel(cell(1, 0), need[1][0]);
  judge(B, 'Need', 2, need[2], w);
  cap('P3 要 (6,0,0)：B、C 不需要，看起來可以', '但 A 要 6 個，只有 3 → 不行');
  await step(tok); // @875.1 回到 P2：(1,2,2) ≤ (3,3,2) → 第一個
  judge(B, 'Need', 1, need[1], w);
  const seq = hot('sequence：P2', 0, 6.1);
  cap('回到 P2：(1,2,2) ≤ (3,3,2)，輕鬆 fulfill', '所以 sequence 第一個是 P2');
  await step(tok); // @909.0 P2 拿到後做完 → 釋放原本的 Allocation
  B.setFinish(1, true); B.clearHl(); B.hlRow('Allocation', 1, GOLD);
  cap('P2 拿到需要的 resource，成功執行並 terminate', '它原本 allocation 拿著的 (2,0,0) 也一起釋放');
  await step(tok); // @944.9 Available + (2,0,0) = (5,3,2)
  B.clearHl(); w = add(w, S.alloc[1]); await B.release(tok, 1, w, '+P2', 800);
  cap('把 (2,0,0) 加回 available', '(3,3,2) + (2,0,0) = (5,3,2)');
  await step(tok); // @985.3 P3：6 > 5 → 還是不行
  judge(B, 'Need', 2, need[2], w);
  cap('再看 P3：要 6 個 A，新的 available 只有 5', '還是不夠 → 三種都要 ≤ 才行');
  await step(tok); // @1009.2 P4：2 ≤ 5、1 ≤ 3、1 ≤ 2 → 可以
  judge(B, 'Need', 3, need[3], w);
  tx(seq, 'sequence：P2 → P4');
  cap('P4：A 要 2 有 5、B 要 1 有 3、C 要 1 有 2', 'yes → 下一個成功執行的是 P4');
  await step(tok); // @1040.4 規則：remaining need ≤ current availability（每一種）
  B.clearHl();
  gone(allNo); note('規則：每一種 resource 都要 remaining need ≤ current availability', -1.5, 0.5, 1.2);
  cap('規則：need ≤ current availability', '對所有 resource 都成立，才能 provide');
  await step(tok); // @1083.5 P4 terminate → +(2,1,1) = (7,4,3)
  B.setFinish(3, true); w = add(w, S.alloc[3]); await B.release(tok, 3, w, '+P4', 800);
  cap('P4 terminate，釋放它拿著的 A 2、B 1、C 1', '(5,3,2) + (2,1,1) = (7,4,3)');
  await step(tok); // @1120.0 P5：(5,3,1) ≤ (7,4,3) → 可以
  judge(B, 'Need', 4, need[4], w);
  tx(seq, 'sequence：P2 → P4 → P5');
  cap('current availability (7,4,3)，接著往下看 P5', 'P5 要 (5,3,1) ≤ (7,4,3) → 可以');
  await step(tok); // @1162.1 P5 釋放 (0,0,2) → (7,4,5)
  B.setFinish(4, true); w = add(w, S.alloc[4]); await B.release(tok, 4, w, '+P5', 800);
  cap('P5 執行完，釋放 (0,0,2)', '(7,4,3) + (0,0,2) = (7,4,5)');
  await step(tok); // @1199.5 回頭 P1：(7,4,3) ≤ (7,4,5) → 可以
  judge(B, 'Need', 0, need[0], w);
  tx(seq, 'sequence：P2 → P4 → P5 → P1');
  cap('回頭再檢查 P1：(7,4,3) ≤ (7,4,5)', '可以 → 給它 7、4、3，成功執行');
  await step(tok); // @1232.3 P1 釋放 (0,1,0) → (7,5,5)
  B.setFinish(0, true); w = add(w, S.alloc[0]); await B.release(tok, 0, w, '+P1', 800);
  cap('P1 拿著的 (0,1,0) 收回來', '(7,4,5) + (0,1,0) = (7,5,5)');
  await step(tok); // @1243.0 只剩 P3：(6,0,0) ≤ (7,5,5) → 可以
  judge(B, 'Need', 2, need[2], w);
  tx(seq, 'sequence：P2 → P4 → P5 → P1 → P3');
  cap('只剩 P3：要 6 個 A，現在有 7 個', 'B 不需要、C 也夠 → fulfill');
  await step(tok); // @1268.6 P3 釋放 (3,0,2) → (10,5,7)
  B.setFinish(2, true); w = add(w, S.alloc[2]); await B.release(tok, 2, w, '+P3', 800);
  B.clearHl();
  cap('P3 terminate，釋放 (3,0,2)', '(7,5,5) + (3,0,2) = (10,5,7)');
  await step(tok); // @1283.1 最後 = Total (10,5,7)：驗算
  workGlow(B, GREEN);
  hot('最後 (10,5,7) = Total → 算對了', 4.4, 0.0, 1.2);
  cap('最後拿到 (10,5,7)，跟一開始的 Total 一樣', '可以拿來驗算自己有沒有算錯');
  await step(tok); // @1310.9 safe sequence
  B.fin.forEach((f) => glow(f, GREEN));
  cap('沒有 deadlock，這就是 safe sequence', 'P2 → P4 → P5 → P1 → P3');
}]);

FRAG.push(['dl-f-limits', 'Safe sequence 不唯一；Banker 的限制', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 1.4, 0]);
  const order = ['P2', 'P4', 'P5', 'P1', 'P3'];
  let row = [];
  await step(tok); // @1319.0 不唯一：P3 也可以更早
  row = order.map((p, k) => bx(p, PCOL[Number(p[1]) - 1], -4.4 + k * 2.2, 0.35, -1.2, 1.6, 0.6, 0.9));
  const alt = ['P2', 'P4', 'P3', 'P5', 'P1'].map((p, k) => bx(p, PCOL[Number(p[1]) - 1], -4.4 + k * 2.2, 0.35, 1.0, 1.6, 0.6, 0.9));   // no drop: falling from above, its names crossed the first row's
  glow(alt[2], GOLD);
  idx('也可以：P2 → P4 → P3 → …（P4 之後 Work (7,4,3) ≥ P3 的 (6,0,0)）', 0, -0.4, 2.2);
  cap('第一：safe sequence 不是唯一的', '例如 P3 也可以排更前面');
  await step(tok); // @1329.0 考題可能問某個 sequence
  note('考題可能給一個 sequence 問你對不對 → 每一步都驗算', 0, 3.4);
  cap('考題可能問：哪一個是 safe sequence', '要小心設計、逐步驗算');
  await step(tok); // @1340.3 只有沒有任何人能 fulfill 時才 deadlock
  bad('某一步沒有任何 process 能 fulfill → unsafe（可能 deadlock）', 0, 4.2);
  cap('某一步沒有人的 need 能 fulfill → unsafe（可能 deadlock）', '只要有一個可以，它就排進 sequence');
  await step(tok); // @1352.5 avoidance：事先 feed Max
  [...row, ...alt].forEach(kill); lab.world.children.filter((o) => o.element).forEach((o) => kill(o));
  hd('Deadlock avoidance：事先 feed Max', 0, 4.6);
  const v = cloneS(VIDEO).names.map((p, k) => pal(p, PCOL[k], -4.4 + k * 2.2, 0, 0.6, 0.6));
  cap('deadlock avoidance：要事先把資訊 feed 給系統', '有幾個 process、幾個 resource、各要多少（maximum need）');
  await step(tok); // @1371.2 real life：need 是 dynamic → 難實作
  v.forEach((b) => b.mood('wow'));
  bub('Max 會變！', -4.4, 1.6, 0.6); bub('run time 才知道', 2.2, 1.6, 0.6);
  cap('real life 呢？process 很少事先說出固定的 need', 'need 是 dynamic 的，run time 會增減 → 很難真的使用');
  await step(tok); // @1408.8 但很重要：考試常考、是理論基礎
  good('仍是重要的理論基礎；GATE 等考試常考', 0, 3.4);
  cap('但它是實作的 base，很重要', 'GATE 和其他考試常考，要仔細算');
  await step(tok); // @1416.2 影片又稱 detection（錯）
  bad('影片又稱它 detection ✗ → Banker 是 avoidance', 0, 4.2);
  cap('影片最後又把它叫 deadlock detection', '別被誤導：Banker 是 avoidance；detection 是另一個演算法');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 6 章',
    title: '死鎖 Deadlock',
    color: 'var(--os)',
    modes: [
      { id: 'rag', name: 'Resource-allocation graph', enter: enterRAG },
      { id: 'banker', name: 'Banker 安全檢查', enter: enterBanker },
      { id: 'request', name: '資源請求', enter: enterRequest },
      { id: 'detect', name: 'Deadlock detection', enter: enterDetect },
      { id: 'prevent', name: '四條件與 prevention', enter: enterPrevent },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'deadlock-intro', 'four-conditions', 'rag-basic', 'rag-cycle-ok', 'handling-methods', 'prevention',
      'safe-unsafe', 'banker-avoid', 'banker-tables', 'banker-available', 'banker-need', 'banker-safety', 'banker-nonunique', 'banker-request',
      'wait-for', 'detection', 'recovery',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
