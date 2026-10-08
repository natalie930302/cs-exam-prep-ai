// 作業系統 第6章：死鎖 Deadlock（四個必要條件、Resource-allocation graph、prevention、Banker's algorithm、detection、recovery）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// Banker 例題取自 Gate Smashers「Banker Algorithm」影片（P1–P5，即恐龍書 P0–P4 的同一題）；
// 清大周志遠 22A–22D 講尚未轉錄，其餘內容以恐龍書補上。
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
  // 影片例子（P1–P5，A/B/C 共 10/5/7）＝恐龍書 P0–P4 的經典題
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
      if (note) row.push(tag(note, 'idx', xw + m * 0.66, y, 0));
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
    log('課本三題：P2 要 (1,0,2) → 給；接著 P5 要 (3,3,0) → 不夠；P1 要 (0,2,0) → unsafe 不給。（影片 P1–P5 = 課本 P0–P4）');
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
      const wrongSeq = 'safe，例如 ' + [0, 1, 2, 3, 4].map((i) => S.names[i]).join(' → ');
      return { q: '用 Banker\'s safety algorithm 判斷：\n' + body + '\n（Available = Total − ΣAllocation）', opts: [ans, res.safe ? 'unsafe' : wrongSeq, '一定已經 deadlock', 'safe，例如 ' + [4, 3, 2, 1, 0].map((i) => S.names[i]).join(' → ')].filter((v, k, a) => a.indexOf(v) === k), ans,
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
      ['② Hold and wait', '拿著一個，還在等別的', () => R.forEach((m, k) => { const [x, z] = pp(k, 2.4); move(m, x + 0.3, 0.9, z); })],
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
      tag(M[k][1], 'idx', x, 0, 1.1);
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
    say('影片的 P1–P5 就是課本的 P0–P4', '同一題，只差編號');
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
    say('Resource-request（補充：課本）：P2 請求 (1, 0, 2)', '課本是 P1，同一題');
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
    ],
    stop() { stopTimer(); },
  };
}
