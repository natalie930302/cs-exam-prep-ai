// 作業系統 第5章：同步與互斥（race condition、critical section、Peterson、Bakery、TAS/CAS、semaphore、經典問題、monitor）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自清大周志遠 18C/19A/20D 講與 Semaphores 影片；尚未轉錄的 18D/19B/20B/20C/21A/21B 以恐龍書補上。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const PCOL = ['#4b9ee2', '#dd8238', '#2fc092', '#9b7ef4', '#e55a9b', '#31aab0'];
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
  function code(lines, x, yTop, dy = 0.46, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i, cls = 'ptr alt') { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ' + cls : ''); }); } };
  }
  function ghostBox(color, w, h, d, x, y, z, op = 0.14) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.position.set(x, y, z); lab.world.add(m); return m;
  }
  function line(x1, y1, z1, x2, y2, z2, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  // ───────────────────────── 逐行執行的小直譯器 ─────────────────────────
  // 每個 process：{ name, lines:[{ t 文字, f(S,P) → true 前進 / false 卡住 / 數字 跳行, r 區域 rem|entry|cs|exit }], pc }
  function stepProc(P, S) {
    const L = P.lines[P.pc];
    const r = L.f ? L.f(S, P) : true;
    if (r === false) { P.blocked = true; return false; }
    P.blocked = false;
    P.pc = typeof r === 'number' ? r : (P.pc + 1) % P.lines.length;
    return true;
  }
  // 臨界區演算法（兩個 process，i = 自己、j = 對方）
  const CSALG = {
    peterson: { name: "Peterson's solution", names: ['P0', 'P1'], init: () => ({ flag: [0, 0], turn: 0 }),
      vars: (S) => [['flag[0]', S.flag[0] ? 'T' : 'F'], ['flag[1]', S.flag[1] ? 'T' : 'F'], ['turn', S.turn]],
      lines: (i, j) => [
        { t: 'flag[' + i + '] = true;', r: 'entry', f: (S) => { S.flag[i] = 1; return true; } },
        { t: 'turn = ' + j + ';', r: 'entry', f: (S) => { S.turn = j; return true; } },
        { t: 'while (flag[' + j + '] && turn == ' + j + ');', r: 'entry', f: (S) => !(S.flag[j] && S.turn === j) },
        { t: '  critical section', r: 'cs' },
        { t: 'flag[' + i + '] = false;', r: 'exit', f: (S) => { S.flag[i] = 0; return true; } },
        { t: '  remainder section', r: 'rem' },
      ] },
    wrong: { name: 'Peterson 錯誤版（turn = 自己）', names: ['P0', 'P1'], init: () => ({ flag: [0, 0], turn: 0 }),
      vars: (S) => [['flag[0]', S.flag[0] ? 'T' : 'F'], ['flag[1]', S.flag[1] ? 'T' : 'F'], ['turn', S.turn]],
      lines: (i, j) => [
        { t: 'flag[' + i + '] = true;', r: 'entry', f: (S) => { S.flag[i] = 1; return true; } },
        { t: 'turn = ' + i + ';   // 搶 token', r: 'entry', f: (S) => { S.turn = i; return true; } },
        { t: 'while (flag[' + j + '] && turn == ' + j + ');', r: 'entry', f: (S) => !(S.flag[j] && S.turn === j) },
        { t: '  critical section', r: 'cs' },
        { t: 'flag[' + i + '] = false;', r: 'exit', f: (S) => { S.flag[i] = 0; return true; } },
        { t: '  remainder section', r: 'rem' },
      ] },
    turn: { name: '只用 turn（strict alternation）', names: ['P0', 'P1'], init: () => ({ turn: 0 }),
      vars: (S) => [['turn', S.turn]],
      lines: (i, j) => [
        { t: 'while (turn != ' + i + ');', r: 'entry', f: (S) => S.turn === i },
        { t: '  critical section', r: 'cs' },
        { t: 'turn = ' + j + ';', r: 'exit', f: (S) => { S.turn = j; return true; } },
        { t: '  remainder section', r: 'rem' },
      ] },
    tas: { name: 'test_and_set lock', names: ['P0', 'P1'], init: () => ({ lock: 0 }),
      vars: (S) => [['lock', S.lock ? 'true' : 'false']],
      lines: () => [
        { t: 'while (test_and_set(&lock));', r: 'entry', f: (S) => { const old = S.lock; S.lock = 1; return !old; } },
        { t: '  critical section', r: 'cs' },
        { t: 'lock = false;', r: 'exit', f: (S) => { S.lock = 0; return true; } },
        { t: '  remainder section', r: 'rem' },
      ] },
    cas: { name: 'compare_and_swap lock', names: ['P0', 'P1'], init: () => ({ lock: 0 }),
      vars: (S) => [['lock', S.lock]],
      lines: () => [
        { t: 'while (CAS(&lock, 0, 1) != 0);', r: 'entry', f: (S) => { const old = S.lock; if (old === 0) S.lock = 1; return old === 0; } },
        { t: '  critical section', r: 'cs' },
        { t: 'lock = 0;', r: 'exit', f: (S) => { S.lock = 0; return true; } },
        { t: '  remainder section', r: 'rem' },
      ] },
    bakery: { name: 'Bakery（P1、P4；最大號碼已是 5）', names: ['P1', 'P4'], pid: [1, 4], init: () => ({ ch: [0, 0], num: [0, 0], base: 5 }),
      vars: (S) => [['choosing[1]', S.ch[0] ? 'T' : 'F'], ['num[1]', S.num[0]], ['choosing[4]', S.ch[1] ? 'T' : 'F'], ['num[4]', S.num[1]]],
      lines: (i, j) => bakeryLines(i, j, true) },
    bakeryNo: { name: 'Bakery 沒有 choosing（錯）', names: ['P1', 'P4'], pid: [1, 4], init: () => ({ ch: [0, 0], num: [0, 0], base: 5 }),
      vars: (S) => [['num[1]', S.num[0]], ['num[4]', S.num[1]]],
      lines: (i, j) => bakeryLines(i, j, false) },
  };
  function bakeryLines(i, j, withChoosing) {
    const pid = [1, 4], me = pid[i], ot = pid[j];
    const L = [];
    if (withChoosing) L.push({ t: 'choosing[' + me + '] = true;', r: 'entry', f: (S) => { S.ch[i] = 1; return true; } });
    L.push({ t: 'm = max(num[…]);   // 讀', r: 'entry', f: (S, P) => { P.m = Math.max(S.base, ...S.num); return true; } });
    L.push({ t: 'num[' + me + '] = m + 1;', r: 'entry', f: (S, P) => { S.num[i] = P.m + 1; return true; } });
    if (withChoosing) {
      L.push({ t: 'choosing[' + me + '] = false;', r: 'entry', f: (S) => { S.ch[i] = 0; return true; } });
      L.push({ t: 'while (choosing[' + ot + ']);', r: 'entry', f: (S) => !S.ch[j] });
    }
    L.push({ t: 'while (num[' + ot + '] && (num[' + ot + '],' + ot + ') < (num[' + me + '],' + me + '));', r: 'entry', f: (S) => !(S.num[j] !== 0 && (S.num[j] < S.num[i] || (S.num[j] === S.num[i] && ot < me))) });
    L.push({ t: '  critical section', r: 'cs' });
    L.push({ t: 'num[' + me + '] = 0;', r: 'exit', f: (S) => { S.num[i] = 0; return true; } });
    L.push({ t: '  remainder section', r: 'rem' });
    return L;
  }
  // 兩個 process 的畫面：左右程式碼、中間 critical section 房間、上方共享變數
  const REG = { rem: [5.0, 3.0], entry: [3.0, 1.4], cs: [0.6, 0.2], exit: [3.0, -1.2] };
  function csView(algKey, opt = {}) {
    const A = CSALG[algKey];
    const S = A.init();
    const P = [0, 1].map((i) => { const ls = A.lines(i, 1 - i); return { name: A.names[i], lines: ls, pc: opt.startPc === 'rem' ? ls.length - 1 : opt.startPc ? opt.startPc[i] : 0, m: 0 }; });
    const panels = P.map((p, i) => code(p.lines.map((l) => l.t), i ? 4.4 : -4.4, 6.2, 0.42, -3.4));
    P.forEach((p, i) => tag(p.name, i ? 'ptr alt' : 'ptr', i ? 4.4 : -4.4, 6.75, -3.4));
    const room = ghostBox('#2fc092', 2.6, 1.4, 2.0, 0, 0.7, 0.2, 0.16);
    tag('critical section', 'idx', 0, 1.6, 0.2);
    tag('remainder', 'idx', -5.0, 0, 3.9); tag('remainder', 'idx', 5.0, 0, 3.9);
    const toks = P.map((p, i) => cube(p.name, PCOL[i], [0.9, 0.7, 0.9], (i ? 1 : -1) * REG.rem[0], 0.35, REG.rem[1]));
    const vs = A.vars(S).map(([k], n, all) => { const x = (n - (all.length - 1) / 2) * 1.7; const m = cube('', '#c9b48e', [1.3, 0.6, 0.9], x, 0.3, -2.4); tag(k, 'idx', x, 0, -1.6); return m; });
    const V = {
      A, S, P,
      update() {
        A.vars(S).forEach(([, v], n) => relabel(vs[n], v));
        P.forEach((p, i) => {
          const r = p.lines[p.pc].r || 'rem';
          const [x, z] = REG[r];
          move(toks[i], (i ? 1 : -1) * x, 0.35, z);
          glow(toks[i], p.blocked ? RED : r === 'cs' ? GREEN : null);
          panels[i].hl(p.pc, p.blocked ? 'ptr' : 'ptr alt');
        });
        const both = P.every((p) => p.lines[p.pc].r === 'cs');
        room.material.color.set(both ? '#d64545' : '#2fc092'); room.material.opacity = both ? 0.35 : 0.16;
        return both;
      },
      step(i) { const ok = stepProc(P[i], S); const both = V.update(); return { ok, both }; },
      inCS: (i) => P[i].lines[P[i].pc].r === 'cs',
    };
    V.update();
    return V;
  }

  // ───────────────────────── 模式 1：Race condition（counter++ / counter--） ─────────────────────────
  const rc = { V: null };
  function raceProcs() {
    return [
      { name: 'Producer', lines: [
        { t: 'reg1 = counter;', f: (S, P) => { P.reg = S.counter; return true; } },
        { t: 'reg1 = reg1 + 1;', f: (S, P) => { P.reg++; return true; } },
        { t: 'counter = reg1;', f: (S, P) => { S.counter = P.reg; return true; } },
        { t: '（counter++ 做完）', f: () => false }], pc: 0, reg: null },
      { name: 'Consumer', lines: [
        { t: 'reg2 = counter;', f: (S, P) => { P.reg = S.counter; return true; } },
        { t: 'reg2 = reg2 - 1;', f: (S, P) => { P.reg--; return true; } },
        { t: 'counter = reg2;', f: (S, P) => { S.counter = P.reg; return true; } },
        { t: '（counter-- 做完）', f: () => false }], pc: 0, reg: null },
    ];
  }
  function raceView() {
    const S = { counter: 5 }; const P = raceProcs();
    const panels = P.map((p, i) => code(p.lines.map((l) => l.t), i ? 4.2 : -4.2, 4.6, 0.5, -2.6));
    tag('Producer：counter++', 'ptr', -4.2, 5.3, -2.6); tag('Consumer：counter--', 'ptr alt', 4.2, 5.3, -2.6);
    const mem = cube('counter = 5', '#c9b48e', [2.6, 0.9, 1.4], 0, 0.45, 0); tag('shared memory', 'idx', 0, 0, 1.0);
    const regs = P.map((p, i) => cube('reg' + (i + 1) + ' = ?', PCOL[i], [2.0, 0.7, 1.0], i ? 4.2 : -4.2, 0.35, 1.2));
    const V = {
      S, P, mem,
      update() {
        relabel(mem, 'counter = ' + S.counter);
        P.forEach((p, i) => { relabel(regs[i], 'reg' + (i + 1) + ' = ' + (p.reg === null ? '?' : p.reg)); panels[i].hl(p.pc); glow(regs[i], null); });
      },
      step(i) {
        const p = P[i], L = p.lines[p.pc];
        if (p.pc >= 3) return false;
        stepProc(p, S);
        V.update();
        if (/^reg\d = counter/.test(L.t)) { glow(mem, GOLD); glow(regs[i], GOLD); }
        if (/^counter =/.test(L.t)) { glow(mem, GOLD); }
        return L.t;
      },
      done: () => P.every((p) => p.pc >= 3),
    };
    V.update();
    return V;
  }
  function enterRace() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6, 12.5], [0, 2, 0]);
    controls('<button class="primary" id="rP">Producer 下一個指令</button><button class="primary" id="rC">Consumer 下一個指令</button>'
      + '<button id="rRand">隨機交錯跑完</button><button id="rMany">隨機跑 200 次統計</button><button id="rReset">重設（counter = 5）</button>');
    rc.V = raceView();
    const after = (i) => {
      const r = rc.V.step(i);
      if (r === false) { log(rc.V.P[i].name + ' 的三個指令已經做完了。', true); return; }
      log(rc.V.P[i].name + '：' + r + '（counter = ' + rc.V.S.counter + '）');
      if (rc.V.done()) {
        const ok = rc.V.S.counter === 5;
        log('結束：counter = ' + rc.V.S.counter + (ok ? '，剛好正確' : '，錯了！應該是 5（race condition）'), !ok);
      }
      raceState();
    };
    on('rP', () => after(0)); on('rC', () => after(1));
    on('rRand', () => { let g = 0; while (!rc.V.done() && g++ < 20) { const c = rc.V.P.map((p, i) => (p.pc < 3 ? i : -1)).filter((i) => i >= 0); after(pickOne(c)); } });
    on('rMany', () => manyRuns());
    on('rReset', () => { clearLog(); enterRace(); });
    log('counter++ 和 counter-- 在 CPU 上各是 3 個指令。自己決定交錯順序，看結果會不會不是 5。');
    raceState();
  }
  function manyRuns() {
    const cnt = { 4: 0, 5: 0, 6: 0 };
    for (let k = 0; k < 200; k++) {
      const S = { counter: 5 }, P = raceProcs();
      while (P.some((p) => p.pc < 3)) { const c = P.filter((p) => p.pc < 3); stepProc(pickOne(c), S); }
      cnt[S.counter]++;
    }
    (rc.bars || []).forEach(kill); rc.bars = [];
    [4, 5, 6].forEach((v, k) => { const h = 0.2 + cnt[v] / 200 * 5; const m = cube(v, v === 5 ? '#2fc092' : '#d64545', [0.8, 1, 0.8], -1.2 + k * 1.2, 0, 3.4); m.scale.y = h; m.position.y = h / 2; relabel(m, v + '：' + cnt[v]); rc.bars.push(m); });
    log('隨機交錯 200 次：counter = 4 有 ' + cnt[4] + ' 次、5 有 ' + cnt[5] + ' 次、6 有 ' + cnt[6] + ' 次。', true);
  }
  function raceState() {
    const V = rc.V;
    setState('counter++ ∥ counter--', [['counter', String(V.S.counter)], ['reg1（Producer）', V.P[0].reg === null ? '?' : String(V.P[0].reg)], ['reg2（Consumer）', V.P[1].reg === null ? '?' : String(V.P[1].reg)]],
      V.done() ? (V.S.counter === 5 ? '<span class="ok">counter = 5</span>：這次的順序剛好沒出事' : '<span class="no">counter = ' + V.S.counter + '</span>：最後寫回的人決定結果 → race condition') : '可能的結果：4、5、6（只有 5 是對的）');
  }

  // ───────────────────────── 模式 2：Critical section 演算法 ─────────────────────────
  const cs = { alg: 'peterson', V: null, steps: 0 };
  function enterCS() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7, 12.5], [0, 2.2, 0]);
    controls('<select id="cAlg">' + Object.keys(CSALG).map((k) => '<option value="' + k + '">' + CSALG[k].name + '</option>').join('') + '</select>'
      + '<button class="primary" id="c0">左邊走一步</button><button class="primary" id="c1">右邊走一步</button><button id="cRand">隨機交錯 30 步</button><button id="cReset">重設</button>');
    $('cAlg').value = cs.alg;
    $('cAlg').onchange = (e) => { cs.alg = e.target.value; clearLog(); enterCS(); };
    cs.V = csView(cs.alg, { startPc: 'rem' }); cs.steps = 0;
    const go = (i) => {
      const p = cs.V.P[i], t = p.lines[p.pc].t.trim();
      const { ok, both } = cs.V.step(i); cs.steps++;
      if (!ok) log(p.name + ' 卡在「' + t + '」：條件成立就一直 busy wait', true);
      else log(p.name + '：' + t);
      if (both) log('兩個 process 同時在 critical section 裡！mutual exclusion 被破壞。', true);
      csState();
    };
    on('c0', () => go(0)); on('c1', () => go(1));
    on('cRand', () => { for (let k = 0; k < 30; k++) { go(rnd(0, 1)); if (cs.V.P.every((p) => p.lines[p.pc].r === 'cs')) break; } });
    on('cReset', () => { clearLog(); enterCS(); });
    log(CSALG[cs.alg].name + '：兩邊都從 remainder section 開始。紅色 = 卡在 while（busy waiting），綠色 = 在 critical section。');
    if (cs.alg === 'turn') log('提示：讓右邊一直待在 remainder，左邊做完一次後想再進去 → 進不去（違反 progress）。');
    if (cs.alg === 'wrong' || cs.alg === 'bakeryNo') log('提示：試著讓兩邊交錯執行，看能不能讓兩個都進 critical section。');
    csState();
  }
  function csState() {
    const V = cs.V;
    setState(V.A.name, V.A.vars(V.S).map(([k, v]) => [k, String(v)]).concat(V.P.map((p) => [p.name, p.lines[p.pc].t.trim() + (p.blocked ? '（卡住）' : '')])),
      V.P.every((p) => p.lines[p.pc].r === 'cs') ? '<span class="no">兩個都在 critical section</span>' : '三個條件：mutual exclusion、progress、bounded waiting');
  }

  // ───────────────────────── 模式 3：Semaphore ─────────────────────────
  const sm = { init: 1, mode: 'block', S: 1, q: [], inCS: [], spin: [], toks: [], wasted: 0 };
  const SEM_NAMES = ['P1', 'P2', 'P3', 'P4', 'P5'];
  function enterSem() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6.5, 12.5], [0, 1.4, 0]);
    controls('<label>S 初值 <input id="smI" type="number" min="0" max="4" value="' + sm.init + '" style="width:46px"></label>'
      + '<select id="smM"><option value="block">block / wakeup（不 busy wait）</option><option value="busy">busy waiting（spinlock）</option></select>'
      + '<select id="smP">' + SEM_NAMES.map((n) => '<option>' + n + '</option>').join('') + '</select>'
      + '<button class="primary" id="smW">wait(S)</button><button class="primary" id="smS">signal(S)</button><button id="smR">重設</button>');
    $('smM').value = sm.mode;
    $('smI').onchange = (e) => { sm.init = Math.max(0, Math.min(4, Number(e.target.value) || 0)); clearLog(); enterSem(); };
    $('smM').onchange = (e) => { sm.mode = e.target.value; clearLog(); enterSem(); };
    on('smW', () => semWait($('smP').value)); on('smS', () => semSignal($('smP').value));
    on('smR', () => { clearLog(); enterSem(); });
    Object.assign(sm, { S: sm.init, q: [], inCS: [], spin: [], wasted: 0 });
    sm.view = semView();
    log('S = ' + sm.init + (sm.init === 1 ? '（當 mutex 用）' : sm.init === 0 ? '（拿來排順序）' : '（counting：最多 ' + sm.init + ' 個同時進去）') + '。選一個 process 按 wait / signal。');
    semUpdate();
  }
  function semView() {
    const sCube = cube('S = ' + sm.S, '#c9b48e', [1.8, 0.9, 1.3], 0, 0.45, -2.6);
    const room = ghostBox('#2fc092', 4.2, 1.3, 1.8, 3.8, 0.65, -0.2, 0.15); tag('critical section', 'idx', 3.8, 1.5, -0.2);
    tag(sm.mode === 'block' ? 'waiting list（block，不吃 CPU）' : 'busy waiting（一直在轉）', 'idx', -3.6, 0, 2.6);
    tag('remainder', 'idx', -4, 0, -1.4);
    const toks = SEM_NAMES.map((n, k) => cube(n, PCOL[k], [0.8, 0.6, 0.8], -5.6 + k * 1.0, 0.3, -2.2));
    return { sCube, room, toks };
  }
  function semUpdate() {
    const V = sm.view;
    relabel(V.sCube, 'S = ' + sm.S); glow(V.sCube, sm.S < 0 ? RED : null);
    SEM_NAMES.forEach((n, k) => {
      const t = V.toks[k];
      const c = sm.inCS.indexOf(n), qi = sm.q.indexOf(n), si = sm.spin.indexOf(n);
      if (c >= 0) { move(t, 2.6 + c * 1.0, 0.3, -0.2); glow(t, GREEN); }
      else if (qi >= 0) { move(t, -5.4 + qi * 1.0, 0.3, 1.8); glow(t, GOLD); }
      else if (si >= 0) { move(t, -5.4 + si * 1.0, 0.3 + 0.25, 1.8); glow(t, RED); }
      else { move(t, -5.6 + k * 1.0, 0.3, -2.2); glow(t, null); }
    });
    setState('Semaphore（' + (sm.mode === 'block' ? 'block / wakeup' : 'busy waiting') + '）', [['S', String(sm.S)], ['critical section', sm.inCS.join(' ') || '（空）'], [sm.mode === 'block' ? 'waiting list' : '在轉圈', (sm.mode === 'block' ? sm.q : sm.spin).join(' ') || '（無）']]
      .concat(sm.mode === 'busy' ? [['白白浪費的 CPU 迴圈', String(sm.wasted)]] : []),
      sm.mode === 'block' ? 'wait：S--；若 S &lt; 0 → 加入 list、block<br>signal：S++；若 S ≤ 0 → 從 list 取一個 wakeup<br>S 為負時 |S| = 在等的個數' : 'wait：while (S ≤ 0) ; S--<br>signal：S++');
  }
  function semWait(n) {
    if (sm.inCS.includes(n)) { log(n + ' 已經在 critical section 裡了，不需要再 wait。', true); return; }
    if (sm.q.includes(n) || sm.spin.includes(n)) { log(n + ' 已經在等了。', true); return; }
    if (sm.mode === 'block') {
      sm.S--;
      if (sm.S < 0) { sm.q.push(n); log('wait(S)：S 減成 ' + sm.S + ' < 0 → ' + n + ' 加入 waiting list 並 block（讓出 CPU）'); }
      else { sm.inCS.push(n); log('wait(S)：S 減成 ' + sm.S + ' → ' + n + ' 進入'); }
    } else {
      if (sm.S <= 0) { sm.spin.push(n); sm.wasted += 50; log('wait(S)：S = ' + sm.S + ' ≤ 0 → ' + n + ' 在 while 迴圈裡一直轉（busy waiting）'); }
      else { sm.S--; sm.inCS.push(n); log('wait(S)：S > 0 → S 減成 ' + sm.S + '，' + n + ' 進入'); }
    }
    semUpdate();
  }
  function semSignal(n) {
    if (!sm.inCS.includes(n)) log(n + ' 不在 critical section 裡卻呼叫 signal：語法上可以（semaphore 不記得誰持有），但當 mutex 用時這是 bug。', true);
    else sm.inCS.splice(sm.inCS.indexOf(n), 1);
    sm.S++;
    if (sm.mode === 'block') {
      if (sm.S <= 0 && sm.q.length) { const w = sm.q.shift(); sm.inCS.push(w); log('signal(S)：S 加成 ' + sm.S + ' ≤ 0 → 有人在等，wakeup(' + w + ')，它直接進入'); }
      else log('signal(S)：S 加成 ' + sm.S + '，沒人在等');
    } else {
      log('signal(S)：S 加成 ' + sm.S);
      if (sm.spin.length) { sm.wasted += 50 * sm.spin.length; const w = sm.spin.shift(); sm.S--; sm.inCS.push(w); log(w + ' 下一次檢查發現 S > 0，跳出迴圈，S 減成 ' + sm.S + '（誰先搶到不一定）'); }
    }
    semUpdate();
  }

  // ───────────────────────── 模式 4：Bounded buffer（semaphore 版） ─────────────────────────
  const bb = { n: 5, wrong: false };
  function bbProcs(wrong) {
    const W = (s) => (S) => { if (S[s] > 0) { S[s]--; return true; } return false; };
    const G = (s) => (S) => { S[s]++; return true; };
    const prod = [
      { t: 'produce item', f: () => true, r: 'rem' },
      ...(wrong ? [{ t: 'wait(mutex);', f: W('mutex'), r: 'entry' }, { t: 'wait(empty);', f: W('empty'), r: 'entry' }] : [{ t: 'wait(empty);', f: W('empty'), r: 'entry' }, { t: 'wait(mutex);', f: W('mutex'), r: 'entry' }]),
      { t: 'buffer[in] = item;', f: (S) => { S.buf[S.in] = ++S.made; S.in = (S.in + 1) % S.n; return true; }, r: 'cs' },
      { t: 'signal(mutex);', f: G('mutex'), r: 'exit' },
      { t: 'signal(full);', f: G('full'), r: 'exit' },
    ];
    const cons = [
      { t: 'wait(full);', f: W('full'), r: 'entry' },
      { t: 'wait(mutex);', f: W('mutex'), r: 'entry' },
      { t: 'item = buffer[out];', f: (S) => { S.got = S.buf[S.out]; S.buf[S.out] = 0; S.out = (S.out + 1) % S.n; return true; }, r: 'cs' },
      { t: 'signal(mutex);', f: G('mutex'), r: 'exit' },
      { t: 'signal(empty);', f: G('empty'), r: 'exit' },
      { t: 'consume item', f: () => true, r: 'rem' },
    ];
    return [{ name: 'Producer', lines: prod, pc: 0 }, { name: 'Consumer', lines: cons, pc: 0 }];
  }
  function bbView(wrong, n = 5) {
    const S = { mutex: 1, empty: n, full: 0, buf: Array(n).fill(0), in: 0, out: 0, n, made: 0, got: 0 };
    const P = bbProcs(wrong);
    const panels = P.map((p, i) => code(p.lines.map((l) => l.t), i ? 4.6 : -4.6, 6.0, 0.44, -3.4));
    tag('Producer', 'ptr', -4.6, 6.6, -3.4); tag('Consumer', 'ptr alt', 4.6, 6.6, -3.4);
    const slots = S.buf.map((_, k) => { ctx.tile(V3(-2.4 + k * 1.2, 0.04, 0.8), 1.05, 1.05); tag('[' + k + ']', 'idx', -2.4 + k * 1.2, 0, 1.6); return null; });
    const items = Array(n).fill(null);
    const semC = ['mutex', 'empty', 'full'].map((k, j) => { const m = cube(k + ' = ' + S[k], '#c9b48e', [1.9, 0.6, 0.9], -2.4 + j * 2.4, 0.3, -1.6); return [k, m]; });
    const pin = tag('in', 'ptr', -2.4, 1.2, 0.8), pout = tag('out', 'ptr alt', -2.4, 1.6, 0.8);
    const toks = P.map((p, i) => cube(p.name, PCOL[i], [1.5, 0.6, 0.8], i ? 5.0 : -5.0, 0.3, 1.6));
    const V = {
      S, P,
      update() {
        semC.forEach(([k, m]) => { relabel(m, k + ' = ' + S[k]); });
        S.buf.forEach((v, k) => {
          if (v && !items[k]) items[k] = cube(v, '#2fc092', [0.85, 0.6, 0.85], -2.4 + k * 1.2, 0.35, 0.8, 2.5);
          if (!v && items[k]) { fly(items[k], V3(3, 6, 2)); items[k] = null; }
        });
        pin.position.x = -2.4 + S.in * 1.2; pout.position.x = -2.4 + S.out * 1.2;
        P.forEach((p, i) => { panels[i].hl(p.pc, p.blocked ? 'ptr' : 'ptr alt'); glow(toks[i], p.blocked ? RED : null); });
      },
      step(i) { const ok = stepProc(P[i], S); V.update(); return ok; },
      deadlock: () => P.every((p) => p.blocked),
    };
    V.update();
    return V;
  }
  function enterBuffer() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6.5, 12.5], [0, 2.2, 0]);
    controls('<button class="primary" id="bP">Producer 走一步</button><button class="primary" id="bC">Consumer 走一步</button>'
      + '<button id="bPP">Producer 一直跑</button><select id="bW"><option value="0">正確順序：wait(empty) → wait(mutex)</option><option value="1">錯誤順序：wait(mutex) → wait(empty)</option></select><button id="bR">重設</button>');
    $('bW').value = bb.wrong ? '1' : '0';
    $('bW').onchange = (e) => { bb.wrong = e.target.value === '1'; clearLog(); enterBuffer(); };
    bb.V = bbView(bb.wrong);
    const go = (i) => {
      const p = bb.V.P[i], t = p.lines[p.pc].t;
      const ok = bb.V.step(i);
      log(ok ? p.name + '：' + t : p.name + ' 卡在 ' + t + '（值是 0，block）', !ok);
      if (bb.V.deadlock()) log('Producer 和 Consumer 都卡住了 → deadlock！' + (bb.wrong ? 'Producer 拿著 mutex 在等 empty，Consumer 要 mutex 才能放出 empty。' : ''), true);
      bbState();
      return ok;
    };
    on('bP', () => go(0)); on('bC', () => go(1));
    on('bPP', () => { for (let k = 0; k < 40; k++) if (!go(0)) break; });
    on('bR', () => { clearLog(); enterBuffer(); });
    log('buffer 大小 5：mutex = 1、empty = 5、full = 0。按「Producer 一直跑」把 buffer 填滿，再看 Consumer。');
    bbState();
  }
  function bbState() {
    const S = bb.V.S;
    setState('Bounded buffer（n = 5）', [['mutex', String(S.mutex)], ['empty（空格數）', String(S.empty)], ['full（有貨數）', String(S.full)], ['buffer', S.buf.map((v) => v || '·').join(' ')]],
      bb.V.deadlock() ? '<span class="no">deadlock</span>：wait(mutex) 放在 wait(empty) 前面，滿了就互卡' : 'empty + full = n（不在 critical section 時）');
  }

  // ───────────────────────── 模式 5：Dining philosophers ─────────────────────────
  const dp = { strat: 'naive' };
  const DPN = 5;
  function dpView() {
    const R = 3.2, pos = (k, r = R) => [Math.sin(k / DPN * Math.PI * 2) * r, Math.cos(k / DPN * Math.PI * 2) * r];
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 40), new THREE.MeshStandardMaterial({ color: '#e3d3b6' })); table.position.set(0, 0.15, 0); lab.world.add(table);
    const ph = Array.from({ length: DPN }, (_, k) => { const [x, z] = pos(k); return cube('哲' + k, PCOL[k], [0.9, 0.9, 0.9], x, 0.45, z); });
    const chopHome = Array.from({ length: DPN }, (_, k) => { const [x, z] = pos(k + 0.5, 1.7); return [x, z]; });
    const chop = chopHome.map(([x, z], k) => { const m = cube('', '#8a5a2b', [0.18, 0.18, 1.0], x, 0.42, z); m.rotation.y = (k + 0.5) / DPN * Math.PI * 2; tag(String(k), 'idx', x, 0.7, z); return m; });
    const S = { holder: Array(DPN).fill(-1), state: Array(DPN).fill('thinking'), eaten: Array(DPN).fill(0) };
    const left = (i) => i, right = (i) => (i + DPN - 1) % DPN; // 筷子 i 在哲 i 與哲 i+1 之間
    const V = {
      S, left, right, ph,
      update() {
        chop.forEach((m, c) => {
          const h = S.holder[c];
          if (h < 0) { const [x, z] = chopHome[c]; move(m, x, 0.42, z); glow(m, null); }
          else { const [px, pz] = pos(h, R - 0.75); const side = c === left(h) ? 1 : -1; const ang = h / DPN * Math.PI * 2 + Math.PI / 2; move(m, px + Math.sin(ang) * 0.35 * side, 1.05, pz + Math.cos(ang) * 0.35 * side); glow(m, GOLD); }
        });
        ph.forEach((m, i) => { const st = S.state[i]; glow(m, st === 'eating' ? GREEN : st === 'hungry' ? (V.deadlock() ? RED : GOLD) : null); relabel(m, '哲' + i + (st === 'eating' ? ' 吃' : st === 'hungry' ? ' 餓' : '')); });
      },
      take(i, c) { if (S.holder[c] >= 0) return false; S.holder[c] = i; return true; },
      put(i) { [left(i), right(i)].forEach((c) => { if (S.holder[c] === i) S.holder[c] = -1; }); S.state[i] = 'thinking'; },
      holds: (i, c) => S.holder[c] === i,
      deadlock() { return S.state.every((s) => s === 'hungry') && S.holder.every((h, c) => h >= 0) && S.state.every((s, i) => !(V.holds(i, left(i)) && V.holds(i, right(i)))); },
    };
    V.update();
    return V;
  }
  // 一個哲學家「做一步」：依策略決定拿哪支
  function dpAct(V, i, strat) {
    const S = V.S, L = V.left(i), Rr = V.right(i);
    if (S.state[i] === 'eating') { V.put(i); S.eaten[i]++; return '哲' + i + ' 吃完，放下兩支筷子'; }
    if (S.state[i] === 'thinking') S.state[i] = 'hungry';
    if (strat === 'monitor') {
      const nl = (i + 1) % DPN, nr = (i + DPN - 1) % DPN;
      if (S.state[nl] !== 'eating' && S.state[nr] !== 'eating' && S.holder[L] < 0 && S.holder[Rr] < 0) { V.take(i, L); V.take(i, Rr); S.state[i] = 'eating'; return '哲' + i + '：test() 兩邊鄰居都沒在吃 → 一次拿兩支，開始吃'; }
      return '哲' + i + '：鄰居在吃 → self[' + i + '].wait()（不拿任何筷子）';
    }
    const first = strat === 'asym' && i % 2 === 1 ? Rr : L, second = first === L ? Rr : L;
    if (!V.holds(i, first)) return V.take(i, first) ? '哲' + i + ' 拿起筷子 ' + first : '哲' + i + ' 等筷子 ' + first + '（被哲' + S.holder[first] + ' 拿著）';
    if (!V.holds(i, second)) {
      if (V.take(i, second)) { S.state[i] = 'eating'; return '哲' + i + ' 拿到第二支筷子 ' + second + '，開始吃'; }
      return '哲' + i + ' 拿著 ' + first + '，等筷子 ' + second + '（hold and wait）';
    }
    S.state[i] = 'eating'; return '哲' + i + ' 開始吃';
  }
  function enterDining() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 9, 8.5], [0, 0, 0]);
    controls('<select id="dS"><option value="naive">每人先拿左再拿右</option><option value="asym">非對稱：奇數號先拿右</option><option value="monitor">monitor：兩支都空才一起拿</option></select>'
      + '<select id="dP">' + Array.from({ length: DPN }, (_, k) => '<option value="' + k + '">哲' + k + '</option>').join('') + '</select><button class="primary" id="dGo">這位做一步</button>'
      + '<button id="dAll">大家同時拿左邊</button><button id="dAuto">隨機跑</button><button id="dR">重設</button>');
    $('dS').value = dp.strat;
    $('dS').onchange = (e) => { dp.strat = e.target.value; clearLog(); enterDining(); };
    dp.V = dpView();
    const act = (i) => { const m = dpAct(dp.V, i, dp.strat); dp.V.update(); log(m); if (dp.V.deadlock()) log('五個人各拿一支、都在等下一支 → circular wait → deadlock！', true); dpState(); };
    on('dGo', () => act(Number($('dP').value)));
    on('dAll', () => { if (dp.strat === 'monitor') log('monitor 版不會只拿一支；還是讓每個人輪流做一步看看。', true); for (let i = 0; i < DPN; i++) act(i); });
    on('dAuto', () => { stopTimer(); let n = 0; timer = setInterval(() => { act(rnd(0, DPN - 1)); if (dp.V.deadlock() || ++n > 80) stopTimer(); }, 260); });
    on('dR', () => { clearLog(); enterDining(); });
    log('5 位哲學家、5 支筷子，要左右兩支才能吃，一次只能拿一支。');
    dpState();
  }
  function dpState() {
    const S = dp.V.S;
    setState('Dining philosophers（' + { naive: '先左後右', asym: '非對稱', monitor: 'monitor' }[dp.strat] + '）', S.state.map((s, i) => ['哲' + i, { thinking: '思考', hungry: '餓了', eating: '吃飯' }[s] + '（吃過 ' + S.eaten[i] + ' 次）']),
      dp.V.deadlock() ? '<span class="no">deadlock</span>：每人拿著左邊、等右邊' : dp.strat === 'naive' ? '大家同時拿左邊就會卡死' : '<span class="ok">打破 circular wait，不會 deadlock</span>' + (dp.strat === 'monitor' ? '（但仍可能 starvation）' : ''));
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const r = Math.random();
    if (r < 0.25) {
      const init = rnd(0, 3), ops = []; let S = init; const n = rnd(3, 6);
      for (let k = 0; k < n; k++) { const w = Math.random() < 0.6; ops.push(w ? 'wait' : 'signal'); S += w ? -1 : 1; }
      const waiting = Math.max(0, -S);
      return { q: 'counting semaphore（block / wakeup 實作）初值 S = ' + init + '，依序有不同 process 執行：' + ops.join('、') + '。結束時 S 的值？', opts: [String(S), String(S + 1), String(Math.max(0, S)), String(-S)].filter((v, i, a) => a.indexOf(v) === i).concat(['無法判斷']).slice(0, 4), ans: String(S),
        why: '每個 wait 減 1、signal 加 1：' + init + ' → ' + S + '。' + (S < 0 ? '負值的絕對值 ' + waiting + ' = 還在 list 裡等的 process 數。' : '') };
    }
    if (r < 0.4) {
      const c = rnd(3, 9);
      return { q: 'counter = ' + c + '，Producer 執行 counter++、Consumer 執行 counter--，各拆成 load / 運算 / store 三個指令且任意交錯。最後可能的值是？', opts: [(c - 1) + '、' + c + '、' + (c + 1), '只有 ' + c, c + ' 或 ' + (c + 1), (c - 2) + ' 到 ' + (c + 2)], ans: (c - 1) + '、' + c + '、' + (c + 1),
        why: '兩邊都先 load 到 register：最後 store 的人贏。先寫 ++ 再寫 -- 得 ' + (c - 1) + '，反過來得 ' + (c + 1) + '，不交錯才是 ' + c + '。' };
    }
    const C = [
      { q: 'Critical section 解法要滿足哪三個條件？', opts: ['mutual exclusion、progress、bounded waiting', 'mutual exclusion、hold and wait、no preemption', 'atomicity、consistency、isolation', 'progress、aging、fairness'], ans: 'mutual exclusion、progress、bounded waiting', why: '18C：廁所比喻——不共用、空著就要能進、不能無限等。' },
      { q: '「critical section 空著，想進去的人卻進不去」違反了哪個條件？', opts: ['progress', 'mutual exclusion', 'bounded waiting', 'no preemption'], ans: 'progress', why: '例：只用 turn 輪流，對方不想進時自己也進不去。' },
      { q: "Peterson's solution 中，進入前把 turn 設成？", opts: ['對方（turn = j）', '自己（turn = i）', '0', '不用設'], ans: '對方（turn = j）', why: '19A：token 一定要交給對方；寫成 turn = i 會讓兩人都進 critical section。' },
      { q: "Peterson 的 while 條件是？", opts: ['flag[j] && turn == j', 'flag[i] && turn == i', 'flag[j] || turn == j', 'turn != i'], ans: 'flag[j] && turn == j', why: '只有「對方想進 且 token 在對方」時才等。' },
      { q: 'Bakery algorithm 中 choosing[] 的用途？', opts: ['等對方抽完號碼再比較', '記錄誰在 critical section', '當 tie breaker', '計算 max'], ans: '等對方抽完號碼再比較', why: '19A：沒有 choosing，P4 先抽到 6 進去後，P1 也抽到 6 且 PID 較小 → 也進去。' },
      { q: 'Bakery 中兩人抽到相同號碼時怎麼辦？', opts: ['比 PID，小的先', '比 PID，大的先', '重抽', '一起進去'], ans: '比 PID，小的先', why: '(num[j], j) < (num[i], i)：先比號碼，再比 PID。' },
      { q: 'Binary semaphore 與 counting semaphore 的差別？', opts: ['值的範圍：0/1 vs 任意整數', 'binary 不會 busy waiting', 'counting 只能用一次', 'binary 不能用來排順序'], ans: '值的範圍：0/1 vs 任意整數', why: 'binary 的行為像 mutex lock；counting 用來管多個相同資源。' },
      { q: '要保證 P1 的 S1 在 P2 的 S2 之前執行，sync 初值與放法？', opts: ['sync = 0；S1 後 signal(sync)，S2 前 wait(sync)', 'sync = 1；S1 前 wait、S2 後 signal', 'sync = 0；S1 前 wait(sync)', 'sync = 1；兩邊都 wait'], ans: 'sync = 0；S1 後 signal(sync)，S2 前 wait(sync)', why: 'P2 先到 wait 會卡住，直到 P1 做完 S1 發 signal。' },
      { q: 'semaphore 用 block / wakeup 取代 busy waiting 的好處？', opts: ['等待時不浪費 CPU cycle', '保證 bounded waiting', '不需要 atomic', '不會 deadlock'], ans: '等待時不浪費 CPU cycle', why: '在 waiting list 裡睡覺，OS 不會把它送上 CPU；但 wait/signal 本身仍要 atomic。' },
      { q: 'Bounded buffer 的 producer 若把 wait(mutex) 放在 wait(empty) 前面，buffer 滿時？', opts: ['deadlock', '覆蓋舊資料', '正常', 'starvation 但不會卡死'], ans: 'deadlock', why: 'producer 拿著 mutex 等 empty；consumer 要 mutex 才能 signal(empty)。' },
      { q: 'First readers-writers 的解法可能讓誰 starvation？', opts: ['writer', 'reader', '都不會', '第一個 reader'], ans: 'writer', why: '20D：reader 可以把 lock 一路傳給後來的 reader，先來的 writer 一直等。' },
      { q: 'First readers-writers 中，誰要去 wait(wrt)？', opts: ['第一個 reader（readcount == 1）', '每個 reader', '最後一個 reader', '只有 writer'], ans: '第一個 reader（readcount == 1）', why: '第一個 reader 代表整群 reader 搶 lock，最後一個離開的 reader 才 signal(wrt)。' },
      { q: 'readcount 為什麼還要另外用 mutex 保護？', opts: ['readcount 本身是 reader 間共享、會 race', '為了擋 writer', '為了 bounded waiting', '不用保護'], ans: 'readcount 本身是 reader 間共享、會 race', why: '不同的共享資料用不同的 lock 保護。' },
      { q: 'Dining philosophers 每人都先拿左邊筷子，可能發生？', opts: ['deadlock', 'race condition', 'priority inversion', 'convoy effect'], ans: 'deadlock', why: '五人各拿一支、都在等下一支：circular wait。' },
      { q: 'Monitor 最關鍵的保證是？', opts: ['同一時間只有一個 thread 在 monitor 內執行', 'method 不能共用變數', '不會 starvation', '不需要 condition variable'], ans: '同一時間只有一個 thread 在 monitor 內執行', why: '20D：像 OO 的 class，但 language 保證 method 之間互斥。' },
      { q: 'test_and_set 能當 lock 的關鍵？', opts: ['讀舊值與設成 true 是 atomic 的一個指令', '它會 block', '它保證 bounded waiting', '它只能在 single core 用'], ans: '讀舊值與設成 true 是 atomic 的一個指令', why: '硬體保證不可中斷；但簡單版不滿足 bounded waiting。' },
      { q: 'race condition 的定義重點？', opts: ['結果取決於最後是誰寫入（執行順序）', '兩個 process 互等', 'priority 低的一直跑不到', 'CPU 太慢'], ans: '結果取決於最後是誰寫入（執行順序）', why: '18C：last 寫入的人決定值。' },
      { q: 'Priority inversion 的典型解法？', opts: ['priority inheritance', 'aging', '加大 quantum', '關掉 interrupt'], ans: 'priority inheritance', why: '持有資源的低優先 task 暫時繼承高優先，避免被中優先插隊。' },
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

  // ───────────────────────── 場景 ─────────────────────────
  // 18C 開頭：Linux 的 active / expired array（承接第 4 章）
  async function scActiveExpired(tok) {
    fresh([0, 6.5, 12.5], [0, 1, 0]);
    const sx = 0.022, x0 = -5.6;
    const seg = (who, a, b, z, c, lbl) => cube(lbl || '', c, [Math.max(0.05, (b - a) * sx), 0.5, 0.8], x0 + (a + b) / 2 * sx, 0.25, z, 2);
    say('H：priority 高、quantum 10；L：priority 低、quantum 200', '兩個 process 同時進系統');
    tag('沒有 active array', 'ptr', -1, 0.2, -2.6);
    await beat(tok, 2400);
    seg('H', 0, 10, -1.8, PCOL[0]); await beat(tok, 700);
    seg('L', 10, 110, -1.8, PCOL[1], 'L 用 100'); const w = seg('', 110, 210, -1.8, GRAY, '剩 100 浪費');
    say('L 只用了 100 就結束這個 burst', '第二輪 H 又先做：L 剩下的 100 白白浪費');
    await beat(tok, 2200);
    seg('H', 110, 120, -1.8, PCOL[0], ''); kill(w);
    await beat(tok, 1800);
    tag('有 active / expired array', 'ptr alt', -1, 0.2, 0.6);
    seg('H', 0, 10, 1.4, PCOL[0]); seg('L', 10, 110, 1.4, PCOL[1], 'L 用 100');
    const act = cube('active：L（還剩 100）', '#2fc092', [3.4, 0.5, 0.8], 3.2, 0.25, 3.2, 2);
    const exp = cube('expired：H（用完了）', '#d8cfc0', [3.4, 0.5, 0.8], -2.2, 0.25, 3.2, 2);
    say('H 把 quantum 用完 → 放進 expired array', 'L 還有剩 → 留在 active array');
    await beat(tok, 2800);
    seg('L', 110, 210, 1.4, PCOL[1], 'L 先用完剩下 100'); seg('H', 210, 220, 1.4, PCOL[0]);
    glow(act, GREEN);
    say('第二個 burst：先從 active 選 → 低優先的 L 先做', '保護 quantum 長、priority 低的程式');
    await beat(tok, 3200);
    kill(exp);
  }
  async function scCounterBuffer(tok) {
    fresh([0, 6, 12], [0, 1, 0]);
    const N = 8;
    say('Producer–Consumer 共用一個 buffer', '之前的解法：in、out 兩個指標，永遠空一格');
    const slots = Array.from({ length: N }, (_, k) => { ctx.tile(V3(-4.2 + k * 1.2, 0.04, 0), 1.05, 1.05); return -4.2 + k * 1.2; });
    const its = [];
    for (let k = 0; k < N - 1; k++) { its.push(cube(k + 1, '#2fc092', [0.85, 0.6, 0.85], slots[k], 0.35, 0, 2.5)); await beat(tok, 250); }
    tag('空一格（浪費）', 'ptr', slots[N - 1], 1.0, 0);
    await beat(tok, 2200);
    say('想用滿整個 buffer：加一個 counter', 'producer 放一個 counter++；consumer 拿一個 counter--');
    its.push(cube(N, '#2fc092', [0.85, 0.6, 0.85], slots[N - 1], 0.35, 0, 2.5));
    const c = cube('counter = 8', '#c9b48e', [2.4, 0.8, 1.2], 0, 0.4, -2.6);
    const p = cube('Producer', PCOL[0], [1.8, 0.6, 0.9], -4.2, 0.3, 2.6), q = cube('Consumer', PCOL[1], [1.8, 0.6, 0.9], 4.2, 0.3, 2.6);
    await beat(tok, 2400);
    line(-4.2, 0.6, 2.2, -0.6, 0.6, -2.2, '#d64545'); line(4.2, 0.6, 2.2, 0.6, 0.6, -2.2, '#d64545');
    glow(c, RED);
    say('但 counter 本身也變成 shared data', '兩邊都要「改寫」它 → 新的 synchronization 問題');
    await beat(tok, 3200);
    glow(p, null); glow(q, null);
  }
  async function scRaceCounter(tok) {
    fresh([0, 6, 12.5], [0, 2, 0]);
    const V = raceView();
    say('counter++ 在 CPU 上其實是 3 個指令', 'load 到 register → 加 1 → store 回 memory');
    await beat(tok, 2800);
    const order = [[0, 'Producer 先做兩個指令', 'reg1 = 5，再加成 6（還沒寫回）'], [0, '', ''], [1, 'context switch（preemptive）→ Consumer', 'reg2 = counter，讀到的還是 5'], [1, 'Consumer 減成 4', 'reg2 = 4（還沒寫回）'], [0, '切回 Producer：寫回 6', 'counter = 6'], [1, 'Consumer 寫回 4，把 6 蓋掉', 'counter = 4']];
    for (const [i, c1, c2] of order) {
      V.step(i);
      if (c1) say(c1, c2);
      await beat(tok, c1 ? 2300 : 1100);
    }
    glow(V.mem, RED);
    say('一次 ++、一次 --，答案卻是 4', '正確答案應該是 5');
    await beat(tok, 3200);
  }
  async function scRaceOutcomes(tok) {
    fresh([0, 6, 12.5], [0, 1.6, 0]);
    const cases = [['P:ld inc / C:ld dec / P:st / C:st', 4, '#d64545'], ['C:ld dec / P:ld inc / C:st / P:st', 6, '#d64545'], ['P 全做完，再 C 全做完', 5, '#2fc092']];
    say('同一段程式，交錯順序不同，結果不同', '');
    await beat(tok, 2000);
    for (let k = 0; k < 3; k++) {
      const x = -4 + k * 4;
      const m = cube('counter = ' + cases[k][1], cases[k][2], [2.6, 0.9, 1.2], x, 0.45, 0, 3);
      tag(cases[k][0], 'idx', x, 0, 1.3);
      say(k === 0 ? '最後寫的是 Consumer → 4' : k === 1 ? '倒過來，最後寫的是 Producer → 6' : '不交錯（一次做完）→ 5', '');
      await beat(tok, 2200);
    }
    say('race condition：最後寫入的人決定結果', '要先有 shared data，又有 preemptive scheduling');
    await beat(tok, 3200);
    say('non-preemptive 不會這樣：CPU burst 一口氣做完', 'OS kernel 的作法：關掉 interrupt；user 程式不能這樣做');
    await beat(tok, 3200);
    say('標準解法：定義 critical section', '');
    await beat(tok, 2200);
  }
  async function scCSStructure(tok) {
    fresh([0, 6.5, 12.5], [0, 1.6, 0]);
    const parts = [['entry section', '#9b7ef4', '進去前的 protocol'], ['critical section', '#2fc092', '會 race 的那段程式'], ['exit section', '#9b7ef4', '出來後的 protocol'], ['remainder section', '#d8cfc0', '其他程式']];
    tag('do {', 'ptr', -3.2, 4.6, -2); tag('} while (true);', 'ptr', -2.4, 0.2, -2);
    say('n 個 process 共用一份 data', '把會 race 的程式碼標成 critical section');
    for (let k = 0; k < 4; k++) { cube(parts[k][0], parts[k][1], [4.2, 0.7, 1.2], 0, 3.9 - k * 1.0, -2, 2); tag(parts[k][2], 'idx', 3.6, 3.9 - k * 1.0, -2); await beat(tok, 700); }
    await beat(tok, 1600);
    say('大家都遵守同一套 protocol（entry / exit）', '確保一次只有一個人在 critical section：mutual exclusion');
    const ps = [0, 1, 2].map((k) => cube('P' + k, PCOL[k], [0.7, 0.55, 0.7], -2.5 + k * 1.2, 0.3, 2.4));
    await beat(tok, 1200);
    for (let k = 0; k < 3; k++) {
      move(ps[k], 0, 2.9 + 0.2, -0.9); glow(ps[k], GREEN);
      ps.forEach((m, j) => { if (j > k) glow(m, GOLD); });
      say('P' + k + ' 在裡面，其他人在 entry section 等', '');
      await beat(tok, 1700);
      move(ps[k], 4.5, 0.3, 2.4 + k * 0.1); glow(ps[k], null);
      await beat(tok, 500);
    }
    say('我們要寫的就是 entry section 和 exit section', '');
    await beat(tok, 2600);
  }
  async function scCSReq(tok) {
    fresh([0, 6.5, 12], [0, 1, 0]);
    const room = ghostBox('#2fc092', 2.4, 1.6, 2.0, 0, 0.8, -1.6, 0.18); tag('廁所（critical section）', 'idx', 0, 1.9, -1.6);
    const a = cube('A', PCOL[0], [0.7, 0.6, 0.7], -3, 0.3, 1.6), b = cube('B', PCOL[1], [0.7, 0.6, 0.7], -1.8, 0.3, 1.6);
    say('① Mutual exclusion：絕對不跟別人共用', '有人在裡面，其他人都不能進');
    move(a, 0, 0.3, -1.6); glow(a, GREEN); await beat(tok, 1200); move(b, -0.6, 0.3, 0.2); glow(b, GOLD);
    await beat(tok, 2600);
    move(a, 3.5, 0.3, 1.6); glow(a, null); move(b, 0, 0.3, -1.6); glow(b, GREEN);
    await beat(tok, 1200);
    move(b, 4.5, 0.3, 1.6); glow(b, null);
    const lockSign = cube('維修中', '#d64545', [1.4, 0.5, 0.3], 0, 1.4, -0.5, 1.5);
    const c = cube('C', PCOL[2], [0.7, 0.6, 0.7], -3, 0.3, 1.6); move(c, -0.6, 0.3, 0.2); glow(c, RED);
    say('② Progress：裡面空著，想進的人就要能進', '不能被反鎖在外面（程式不能卡死）');
    await beat(tok, 2600);
    kill(lockSign); move(c, 0, 0.3, -1.6); glow(c, GREEN);
    await beat(tok, 1600);
    say('③ Bounded waiting：等待的次數要有上限', '不能一直被插隊 → 否則 starvation');
    const d = cube('D', PCOL[3], [0.7, 0.6, 0.7], -1, 0.3, 1.2);
    glow(d, GOLD);
    for (let k = 0; k < 3; k++) {
      const x = cube('X' + k, '#9b7ef4', [0.6, 0.5, 0.6], -4, 0.3, 2.6, 1);
      await beat(tok, 500); move(x, 0, 0.3, -1.6); await beat(tok, 700); fly(x, V3(3, 5, 2));
    }
    glow(d, RED);
    say('D 一直被插隊：違反 bounded waiting', '解法通常是排隊（first come, first serve）');
    await beat(tok, 2800);
    move(d, 0, 0.3, -1.6); glow(d, GREEN);
    say('三個條件缺一不可', 'progress：空著能進；bounded waiting：等待有上限');
    await beat(tok, 2800);
  }
  // 依腳本跑兩個 process
  async function runScript(tok, V, script, defMs = 1300) {
    for (const s of script) {
      const [i, c1, c2, ms] = s;
      if (i !== null) V.step(i);
      if (c1 !== undefined && c1 !== '') say(c1, c2 || '');
      await beat(tok, ms || defMs);
    }
  }
  async function scStrict(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('turn', { startPc: [0, 3] });
    say('只用一個 turn 輪流（補充：課本的錯誤示範）', 'turn = i 的人才可以進');
    await beat(tok, 2600);
    await runScript(tok, V, [[0, 'turn = 0：P0 進去', ''], [0, 'P0 做完 critical section', ''], [0, 'P0 出來，把 turn 交給 P1', 'turn = 1'], [0, 'P0 跑完 remainder，又想進去', ''], [0, '卡住了：turn 在 P1 手上', 'P1 卻一直待在 remainder，不想進'], [0, '', '', 1600]]);
    say('critical section 空著卻沒人能進 → 違反 progress', 'mutual exclusion 有，progress 沒有');
    await beat(tok, 3200);
  }
  async function scPeterson(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('peterson');
    say("Peterson：turn（token）＋ flag（我想進去）", '只有「對方想進 且 token 在對方」才等');
    await beat(tok, 3000);
    await runScript(tok, V, [
      [0, 'P0：flag[0] = true，我想進去', ''], [1, 'P1：flag[1] = true，我也想', ''],
      [0, 'P0 把 token 交給對方：turn = 1', ''], [1, 'P1 也交給對方：turn = 0', '最後寫的那個 turn 才算數'],
      [0, 'P0 檢查：flag[1] && turn == 1？turn 是 0 → 進去', ''], [1, 'P1 檢查：flag[0] && turn == 0 → 成立，等', 'busy waiting'],
      [1, '', '', 900], [0, 'P0 做完 critical section', ''], [0, 'P0 出來：flag[0] = false', ''], [1, 'P1 的條件不成立了 → 進去', ''], [null, '', '', 1600],
    ], 1700);
    say('兩個都想進時，先交出 token 的人… 反而會被對方讓', 'turn 只能是 0 或 1 → 不可能兩人都進');
    await beat(tok, 3200);
  }
  async function scPetersonWrong(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('wrong');
    say('寫錯：turn = 自己（把 token 搶過來）', 'flag[i] = true 要緊貼著 while 前面');
    await beat(tok, 2800);
    await runScript(tok, V, [
      [0, 'P0：flag[0] = true', ''], [0, 'P0：turn = 0（搶 token）', ''], [0, 'P0 檢查：flag[1] 是 F → 進去', ''],
      [1, 'P1：flag[1] = true', ''], [1, 'P1：turn = 1（又搶回去）', ''], [1, 'P1 檢查：flag[0] && turn == 0？turn 是 1 → 也進去！', ''],
    ], 1700);
    say('兩個都在 critical section → mutual exclusion 被破壞', 'token 一定要「交給對方」，前後位置倒是無所謂');
    await beat(tok, 3400);
  }
  async function scPetersonBW(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('peterson');
    await runScript(tok, V, [[0, '', '', 200], [0, '', '', 200], [0, '', '', 200], [1, '', '', 200], [1, '', '', 200], [1, 'P0 在裡面，P1 在 entry section 等', 'bounded waiting：P0 出來後 P1 一定輪得到嗎？', 2800]]);
    await runScript(tok, V, [
      [0, 'P0 做完 critical section', ''], [0, 'P0 出來：flag[0] = false', ''], [0, '沒被 context switch，P0 跑完 remainder', '又繞回來想進去！'],
      [0, 'flag[0] = true', ''], [0, 'turn = 1：先把 token 交給 P1', ''],
      [0, 'P0 檢查：flag[1] && turn == 1 → 成立，P0 被擋住', '不管它跑多少個指令都卡在 entry'],
      [0, '', '', 900], [1, 'context switch 回 P1：turn == 1 → 進去', '一定輪流 → bounded waiting'],
    ], 1900);
    await beat(tok, 2600);
    say('progress 的證明：一人想進、或兩人都想進時看條件', 'critical section 要選得越小越好');
    await beat(tok, 3000);
  }
  async function scBakery(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    say('n 個 process：token 不知道要交給誰', 'Bakery：像郵局抽號碼牌，號碼小的先');
    const names = [['P3', 3], ['P1', 1], ['P5', 5], ['P2', 2], ['P4', 4]];
    const nums = [1, 2, 3, 3, 4];
    await beat(tok, 2600);
    const ms = names.map(([n], k) => cube(n, PCOL[k], [0.8, 0.6, 0.8], -5 + k * 2.4, 0.3, 2.4, 2));
    for (let k = 0; k < 5; k++) {
      const t = cube('#' + nums[k], '#c9b48e', [0.8, 0.4, 0.5], -5 + k * 2.4, 0.95, 2.4, 1.5);
      ms[k].userData.ticket = t;
      say(names[k][0] + ' 抽號碼：num = max + 1 = ' + nums[k], k === 3 ? 'max 不是一個指令 → 可能抽到一樣的號碼' : '');
      await beat(tok, k === 3 ? 2400 : 1000);
    }
    say('號碼一樣（P5、P2 都是 3）就比 PID', '(num, pid) 比大小：P2 比 P5 先');
    await beat(tok, 2800);
    const order = [0, 1, 3, 2, 4];
    for (const k of order) {
      move(ms[k], 0, 0.3, -2); glow(ms[k], GREEN);
      say(names[k][0] + '（#' + nums[k] + '）進 critical section', '出來時把 num 設回 0');
      await beat(tok, 1200);
      fly(ms[k], V3(4, 6, -2)); kill(ms[k].userData.ticket);
      await beat(tok, 300);
    }
    say('first come, first serve → bounded waiting', 'num = 0 代表沒抽（不想進）');
    await beat(tok, 2800);
  }
  async function scBakeryChoosing(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    let V = csView('bakeryNo');
    say('沒有 choosing 會怎樣？目前最大號碼是 5', 'P1（PID 小，優先）和 P4 都要進去');
    await beat(tok, 2800);
    await runScript(tok, V, [
      [0, 'P1 讀 max = 5……還沒寫回就被切走', 'num[1] 還是 0'],
      [1, 'P4 抽號碼：讀 max = 5', ''], [1, 'num[4] = 6', ''],
      [1, 'P4 比較：num[1] = 0 → 不理它，進去', ''],
      [0, 'P1 寫回：num[1] = 6', ''], [0, 'P1 比較：(6,4) < (6,1)？不是 → P1 也進去！', 'PID 1 < 4，P1 認為自己優先'],
    ], 1900);
    say('兩個都在 critical section：mutual exclusion 被破壞', '');
    await beat(tok, 3000);
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    V = csView('bakery');
    say('加上 choosing：抽號碼時舉牌「我在抽」', '比較前先等對方抽完');
    await beat(tok, 2600);
    await runScript(tok, V, [
      [0, 'P1：choosing[1] = true', ''], [0, 'P1 讀 max = 5……被切走', ''],
      [1, '', '', 500], [1, '', '', 500], [1, '', '', 500], [1, 'P4 拿到 6', ''],
      [1, 'P4：while (choosing[1]) → P1 還在抽，等！', ''], [1, '', '', 800],
      [0, 'P1 寫回 6', ''], [0, 'choosing[1] = false', ''],
      [1, 'P4 繼續：choosing[1] 是 F', ''], [1, 'P4 比較：(6,1) < (6,4) → P4 等', ''],
      [0, '', '', 500], [0, 'P1 比較：(6,4) 不比 (6,1) 小 → P1 進去', '正確：PID 小的 P1 先'],
    ], 1500);
    await beat(tok, 2800);
  }
  async function scTAS(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('tas');
    say('硬體：test_and_set 是 atomic 指令', '補充（課本）：讀出舊值並設成 true，中間不會被打斷');
    await beat(tok, 3000);
    await runScript(tok, V, [
      [0, 'P0：舊值 false，lock 設 true → 進去', ''],
      [1, 'P1：舊值 true → 繼續轉', 'busy waiting（spinlock）'], [1, '', '', 800],
      [0, 'P0 做完 critical section', ''], [0, 'P0 出來：lock = false', ''],
      [1, 'P1：舊值 false → 進去', ''],
    ], 1900);
    say('有 mutual exclusion，沒有 bounded waiting', '課本加 waiting[] 陣列，出來時依序傳給下一個');
    await beat(tok, 3400);
  }
  async function scCAS(tok) {
    fresh([0, 7, 12.5], [0, 2.2, 0]);
    const V = csView('cas');
    say('compare_and_swap(&lock, 0, 1)', '補充（課本）：lock 等於 expected(0) 才換成 1；永遠回傳舊值');
    await beat(tok, 3000);
    await runScript(tok, V, [
      [1, 'P1：lock 是 0 → 換成 1，回傳 0 → 進去', ''],
      [0, 'P0：lock = 1 ≠ 0 → 回傳 1，繼續轉', ''], [0, '', '', 800],
      [1, 'P1 做完 critical section', ''], [1, 'P1 出來：lock = 0', ''],
      [0, 'P0：CAS 成功 → 進去', ''],
    ], 1900);
    say('CAS 也是 atomic；可拿來實作 mutex lock', '一樣是 busy waiting');
    await beat(tok, 3000);
  }
  // semaphore 的畫面（場景用）
  function semScene(init, mode) {
    Object.assign(sm, { init, mode, S: init, q: [], inCS: [], spin: [], wasted: 0 });
    sm.view = semView(); semUpdate();
  }
  async function scSemBinary(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    semScene(1, 'busy');
    say('Semaphore：名字來自鐵路號誌', 'wait 用在 entry section、signal 用在 exit section（P / V）');
    await beat(tok, 3000);
    semWait('P1'); say('P1：wait(S)，S = 1 > 0 → 減成 0，進去', ''); await beat(tok, 2200);
    semWait('P2'); say('P2：wait(S)，S = 0 → 在迴圈裡一直等', 'while (S <= 0) ;'); await beat(tok, 2600);
    semSignal('P1'); say('P1 出來：signal(S)，S 加回 1', 'P2 下次檢查就能進去'); await beat(tok, 2600);
    semSignal('P2');
    say('初值 1：一次只有一個人 → 像 mutex lock', '');
    await beat(tok, 2400);
  }
  async function scSemCounting(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    semScene(3, 'busy');
    say('S = 3：代表有 3 個相同的資源', 'counting semaphore');
    await beat(tok, 2400);
    for (const n of ['P1', 'P2', 'P3']) { semWait(n); say(n + '：wait(S)，S 減成 ' + sm.S, ''); await beat(tok, 1300); }
    semWait('P4'); say('P4：S = 0 → 等', ''); await beat(tok, 2200);
    semSignal('P2'); say('P2 出來：signal(S) → S 變 1', 'P4 可以進去了'); await beat(tok, 2800);
    say('初值 > 1 → counting；只有 0 / 1 → binary', '補充：binary 是指值域只有 0、1，不是「初值等於 1」');
    await beat(tok, 3200);
  }
  async function scSemOrder(tok) {
    fresh([0, 6, 12.5], [0, 1.2, 0]);
    const sx = 0.42, x0 = -5.5;
    tag('P1', 'ptr', -6.3, 0.2, -1.4); tag('P2', 'ptr alt', -6.3, 0.2, 1.4);
    const ax = (t, z) => { tag(String(t), 'idx', x0 + t * sx, 0, z + 0.8); };
    say('要求：P1 的 S1 一定要在 P2 的 S2 之前', 'semaphore sync 初值 0');
    await beat(tok, 2600);
    cube('S1', '#4b9ee2', [0.9, 0.6, 0.8], x0 + 20 * sx, 0.3, -1.4, 2); ax(20, -1.4);
    cube('', '#bfd8f0', [20 * sx - 0.5, 0.3, 0.6], x0 + 10 * sx - 0.25, 0.15, -1.4);
    const sg = tag('signal(sync)', 'ptr', x0 + 21.3 * sx + 0.6, 0.9, -1.4);
    say('P1：S1 做完後 signal(sync)', '');
    await beat(tok, 2000);
    cube('', '#f2d3b5', [10 * sx - 0.2, 0.3, 0.6], x0 + 5 * sx, 0.15, 1.4); ax(10, 1.4);
    const w = cube('wait', '#d64545', [10 * sx, 0.5, 0.8], x0 + 15 * sx, 0.25, 1.4, 2);
    say('P2 在 t = 10 就到了 S2 前：wait(sync)，sync = 0 → 等', '');
    await beat(tok, 2800);
    glow(w, GOLD);
    say('t = 20：P1 做完 S1，signal → sync = 1', '');
    await beat(tok, 2200);
    cube('S2', '#dd8238', [0.9, 0.6, 0.8], x0 + 21.5 * sx, 0.3, 1.4, 2); ax(21, 1.4);
    say('t = 21：P2 才執行 S2', '紅色那段就是 P2 多等的時間');
    await beat(tok, 3000);
    say('先到的一方被擋住，順序一定是 S1 → S2', 'sync = 0；S1 後 signal，S2 前 wait');
    await beat(tok, 2800);
    txt(sg, 'signal(sync)');
  }
  async function scSemBlock(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    semScene(1, 'busy');
    say('busy waiting：等的人上了 CPU 也只是在空轉', '浪費 CPU cycle（spinlock）');
    semWait('P1'); semWait('P2'); semWait('P3');
    await beat(tok, 3000);
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    semScene(1, 'block');
    say('改成 block / wakeup：等的人自己去睡', 'OS 不會再把它送上 CPU');
    await beat(tok, 2600);
    semWait('P1'); say('P1：wait → S = 0，進去', ''); await beat(tok, 1600);
    semWait('P2'); say('P2：wait → S 先減成 −1 < 0', '加入 S 的 waiting list，block()'); await beat(tok, 2400);
    semWait('P3'); say('P3：S = −2，也去 list 睡', '|S| = 2 = 在等的人數'); await beat(tok, 2400);
    semSignal('P1'); say('P1 出來：S++ → −1 ≤ 0，表示還有人在等', '從 list 拿出 P2，wakeup(P2)'); await beat(tok, 3000);
    semSignal('P2'); say('P2 出來：S = 0 ≤ 0 → wakeup(P3)', ''); await beat(tok, 2400);
    semSignal('P3'); say('S 回到 1', '補充：課本條件是 S ≤ 0 才 wakeup'); await beat(tok, 2600);
  }
  async function scSemDeadlock(tok) {
    fresh([0, 6.5, 12.5], [0, 1.6, 0]);
    say('S = Q = 1，兩邊 wait 順序相反', '補充（課本）：P0：wait(S); wait(Q);　P1：wait(Q); wait(S);');
    const s = cube('S = 1', '#c9b48e', [1.6, 0.7, 1.1], -1.6, 0.35, -1.6), q = cube('Q = 1', '#c9b48e', [1.6, 0.7, 1.1], 1.6, 0.35, -1.6);
    const p0 = cube('P0', PCOL[0], [0.9, 0.7, 0.9], -4, 0.35, 1.6), p1 = cube('P1', PCOL[1], [0.9, 0.7, 0.9], 4, 0.35, 1.6);
    await beat(tok, 3000);
    relabel(s, 'S = 0'); line(-4, 0.7, 1.2, -1.6, 0.7, -1.2, '#2fc092'); say('P0：wait(S) 成功', ''); await beat(tok, 1500);
    relabel(q, 'Q = 0'); line(4, 0.7, 1.2, 1.6, 0.7, -1.2, '#2fc092'); say('P1：wait(Q) 成功', ''); await beat(tok, 1500);
    line(-4, 0.9, 1.2, 1.4, 0.9, -1.2, '#d64545'); glow(p0, RED); say('P0：wait(Q) → 等 P1', ''); await beat(tok, 1500);
    line(4, 0.9, 1.2, -1.4, 0.9, -1.2, '#d64545'); glow(p1, RED); say('P1：wait(S) → 等 P0', ''); await beat(tok, 1500);
    say('互相等對方的 signal → deadlock', '下一章：deadlock 的四個條件');
    await beat(tok, 3200);
  }
  async function scPriInv(tok) {
    fresh([0, 6, 12.5], [0, 1.2, 0]);
    const sx = 0.5, x0 = -5.5;
    const seg = (a, b, z, c, l) => cube(l || '', c, [(b - a) * sx - 0.04, 0.5, 0.7], x0 + (a + b) / 2 * sx, 0.25, z, 2);
    ['H（高）', 'M（中）', 'L（低）'].forEach((n, k) => tag(n, 'ptr', -6.4, 0.2, -1.6 + k * 1.2));
    say('Priority inversion（補充：課本）', 'L 拿著資源 R；H 也需要 R');
    seg(0, 3, 0.8, PCOL[2], 'L 鎖 R'); await beat(tok, 2200);
    seg(3, 4, -1.6, PCOL[0], 'H'); say('H 來了，要 R → 只能等 L', ''); await beat(tok, 2000);
    seg(4, 12, -0.4, PCOL[1], 'M 插隊'); say('M（不需要 R）搶佔 L → H 被 M 間接卡住', '高優先等中優先：priority inversion'); await beat(tok, 3000);
    seg(12, 14, 0.8, PCOL[2], 'L'); seg(14, 18, -1.6, PCOL[0], 'H');
    await beat(tok, 1800);
    say('解法：priority inheritance', '持有 R 的 L 暫時繼承 H 的優先權，M 插不進來');
    await beat(tok, 3400);
  }
  async function scBoundedBuffer(tok) {
    fresh([0, 6.5, 12.5], [0, 2.2, 0]);
    let V = bbView(false);
    say('Bounded buffer：大小固定（n = 5）', 'mutex = 1、empty = 5、full = 0（補充：課本解法）');
    await beat(tok, 3000);
    say('滿了 producer 要等、空了 consumer 要等', '');
    for (let k = 0; k < 32; k++) { if (!V.step(0)) break; await beat(tok, 140); }
    say('buffer 滿了：empty = 0，producer 卡在 wait(empty)', '');
    await beat(tok, 2600);
    for (let k = 0; k < 6; k++) { V.step(1); await beat(tok, 300); }
    say('consumer 拿走一個並 signal(empty) → producer 可以繼續', '');
    for (let k = 0; k < 6; k++) { V.step(0); await beat(tok, 260); }
    await beat(tok, 2000);
    fresh([0, 6.5, 12.5], [0, 2.2, 0]);
    V = bbView(true);
    say('如果 producer 先 wait(mutex) 再 wait(empty)…', '');
    for (let k = 0; k < 40; k++) { if (!V.step(0)) break; await beat(tok, 120); }
    say('滿了：producer 拿著 mutex 等 empty', '');
    await beat(tok, 2000);
    V.step(1); V.step(1);
    say('consumer 要 mutex 才能拿東西 → 兩個都卡住', 'deadlock：wait 的順序很重要');
    await beat(tok, 3400);
  }
  async function scRW(tok) {
    fresh([0, 6, 12.5], [0, 1.2, 0]);
    const sx = 0.36, x0 = -5.6;
    const seg = (a, b, z, c, l) => cube(l || '', c, [(b - a) * sx - 0.05, 0.5, 0.7], x0 + (a + b) / 2 * sx, 0.25, z, 2);
    tag('reader：可以一起讀　writer：要 exclusive', 'ptr', 0, 2.6, -2.4);
    say('Readers-writers：檔案的讀與寫', 'writer 在寫時，其他 reader、writer 都不能碰');
    await beat(tok, 2800);
    say('First RW problem：只要求 writer exclusive', 'Second：writer ready 後要盡快寫（不能 starvation）');
    await beat(tok, 3000);
    seg(0, 10, -1.2, PCOL[0], 'R1 讀 10 秒'); say('R1 在 0 秒開始讀 10 秒', ''); await beat(tok, 1600);
    const w = cube('W 等…', '#d64545', [0.5, 0.5, 0.7], x0 + 2 * sx, 0.25, 1.6, 2); tag('W 在第 2 秒就到了', 'idx', x0 + 2 * sx + 1.2, 0, 2.4);
    say('writer 在第 2 秒到 → 等', ''); await beat(tok, 1800);
    seg(8, 18, -0.2, PCOL[1], 'R2'); say('R2 在第 8 秒到：直接加入一起讀', 'lock 從 R1 傳給 R2'); await beat(tok, 2400);
    seg(16, 26, 0.8, PCOL[2], 'R3'); say('R3 又在 R2 讀完前到……', ''); await beat(tok, 1800);
    kill(w); seg(2, 26, 1.6, '#d64545', 'W 一直等……');
    say('reader 一直插隊 → writer starvation', 'First RW 的解法會讓 writer 餓死');
    await beat(tok, 3200);
  }
  async function scRWSolution(tok) {
    fresh([0, 6.5, 12.5], [0, 2.4, 0]);
    const cd = code(['wait(mutex);', 'readcount++;', 'if (readcount == 1) wait(wrt);', 'signal(mutex);', '  … reading …', 'wait(mutex);', 'readcount--;', 'if (readcount == 0) signal(wrt);', 'signal(mutex);'], -3.6, 6.2, 0.46, -3);
    tag('reader', 'ptr', -3.6, 6.75, -3);
    code(['wait(wrt);', '  … writing …', 'signal(wrt);'], 4.2, 6.2, 0.46, -3); tag('writer', 'ptr alt', 4.2, 6.75, -3);
    const vals = { wrt: 1, mutex: 1, readcount: 0 };
    const vc = Object.keys(vals).map((k, j) => [k, cube(k + ' = ' + vals[k], '#c9b48e', [2.2, 0.6, 1.0], -2.6 + j * 2.6, 0.3, -0.6)]);
    const upd = () => vc.forEach(([k, m]) => relabel(m, k + ' = ' + vals[k]));
    const room = ghostBox('#2fc092', 4, 1.2, 1.6, 0, 0.6, 2.2, 0.15); tag('檔案', 'idx', 0, 1.4, 2.2);
    say('wrt：binary semaphore，給 writer 用', 'readcount：現在有幾個 reader 在讀（用 mutex 保護）');
    await beat(tok, 3200);
    const rs = [];
    for (let k = 0; k < 3; k++) {
      cd.hl(1); vals.readcount++; upd(); await beat(tok, 600);
      cd.hl(2);
      if (vals.readcount === 1) { vals.wrt = 0; upd(); say('第一個 reader：wait(wrt)，替整群 reader 拿 lock', ''); }
      else say('R' + (k + 1) + '：readcount = ' + vals.readcount + ' ≠ 1 → 不用再搶 lock', '');
      rs.push(cube('R' + (k + 1), PCOL[k], [0.8, 0.6, 0.8], -1.2 + k * 1.2, 0.3, 2.2, 2));
      await beat(tok, 2000);
    }
    const w = cube('W', '#d64545', [0.8, 0.6, 0.8], 4.6, 0.3, 2.2, 2); glow(w, RED);
    say('writer：wait(wrt) → wrt = 0，等', ''); await beat(tok, 2200);
    for (let k = 0; k < 3; k++) {
      cd.hl(6); vals.readcount--; upd(); fly(rs[k], V3(-3, 6, 2)); await beat(tok, 600);
      cd.hl(7);
      if (vals.readcount === 0) { vals.wrt = 1; upd(); say('最後一個 reader 離開：signal(wrt)', 'writer 終於可以寫'); glow(w, GREEN); move(w, 0, 0.3, 2.2); }
      else say('readcount = ' + vals.readcount + '：還有人在讀，不放 lock', '');
      await beat(tok, 1800);
    }
    cd.hl(-1);
    say('readcount 是 reader 共享的 → 另用 mutex 保護', '不同的共享資料用不同的 lock');
    await beat(tok, 3200);
  }
  async function scDiningDeadlock(tok) {
    fresh([0, 9, 8.5], [0, 0, 0]);
    const V = dpView();
    say('5 位哲學家、5 支筷子放在兩人之間', '要拿起左右兩支才能吃，一次拿一支');
    await beat(tok, 3000);
    for (let i = 0; i < DPN; i++) { dpAct(V, i, 'naive'); V.update(); say('哲' + i + ' 拿起左邊的筷子 ' + i, ''); await beat(tok, 900); }
    for (let i = 0; i < DPN; i++) { dpAct(V, i, 'naive'); }
    V.update();
    say('每個人都在等右邊那支 → 全部卡住', 'deadlock（之後還會 starvation）');
    await beat(tok, 3400);
    say('需要多個資源、一次只拿一個的程式都有這個問題', '用 monitor 寫解法（下一段）');
    await beat(tok, 2800);
  }
  async function scMonitor(tok) {
    fresh([0, 6.5, 12.5], [0, 1.4, 0]);
    say('semaphore 太 low level：wait / signal 順序寫錯就卡死', 'monitor：high-level language construct');
    await beat(tok, 3000);
    const box = ghostBox('#9b7ef4', 6, 2.2, 3, 0.8, 1.1, -0.6, 0.12);
    tag('monitor（像一個 class）', 'ptr', 0.8, 2.6, -0.6);
    cube('shared 變數', '#c9b48e', [2.0, 0.6, 1.0], -0.6, 0.3, -1.4, 2);
    const ms = ['method A()', 'method B()', 'method C()'].map((n, k) => cube(n, '#4b9ee2', [1.6, 0.5, 0.8], 2.6, 0.25, -1.6 + k * 1.0, 2));
    say('要保護的變數 = local variable；操作 = method', '外面只能透過 method 碰它');
    await beat(tok, 3000);
    const th = [0, 1, 2].map((k) => cube('T' + k, PCOL[k], [0.7, 0.6, 0.7], -4.6, 0.3, 2.6 - k * 0.0 + k * 0, 0));
    th.forEach((m, k) => move(m, -5.6 + k * 0.9, 0.3, 2.4));
    say('很多 thread 同時呼叫 method', '');
    await beat(tok, 1800);
    for (let k = 0; k < 3; k++) {
      move(th[k], 1.0, 0.3, -0.4); glow(th[k], GREEN);
      th.forEach((m, j) => { if (j > k) glow(m, GOLD); });
      say('一次只有一個 thread 在 monitor 裡執行', '語言層級自動 mutual exclusion');
      await beat(tok, 1600);
      fly(th[k], V3(4, 6, 2));
      await beat(tok, 400);
    }
    say('只要定義變數與行為，不用自己寫 wait / signal', 'condition 變數 x.wait() / x.signal() 處理「等某個條件」');
    await beat(tok, 3200);
    kill(box); ms.length = 0;
  }
  async function scDiningMonitor(tok) {
    fresh([0, 9, 8.5], [0, 0, 0]);
    const V = dpView();
    say('monitor 解法（補充：課本）', 'state[i]：THINKING / HUNGRY / EATING；test(i)：左右鄰居都沒在吃才能吃');
    await beat(tok, 3200);
    const seq = [0, 1, 2, 3, 0, 2, 4, 1, 3];
    for (const i of seq) { const m = dpAct(V, i, 'monitor'); V.update(); const [a, ...b] = m.split('：'); say(a + (V.S.state[i] === 'eating' ? ' 開始吃' : V.S.state[i] === 'thinking' ? ' 吃完放下' : ' 等待'), b.join('：')); await beat(tok, 1600); }
    say('兩支一起拿 → 不會 hold and wait → 不會 deadlock', '但鄰居輪流吃時，某人仍可能 starvation');
    await beat(tok, 3400);
  }

  const scenes = {
    'linux-active-expired': { title: 'Linux 的 active / expired array：保護低優先的長 quantum', play: scActiveExpired },
    'counter-buffer': { title: 'Producer–consumer 用 counter：counter 也變成 shared data', play: scCounterBuffer },
    'race-counter': { title: 'counter++ / counter-- 在指令層交錯：5 變 4', play: scRaceCounter },
    'race-outcomes': { title: 'Race condition：結果可能是 4、5、6', play: scRaceOutcomes },
    'cs-structure': { title: 'Critical section：entry / exit / remainder', play: scCSStructure },
    'cs-requirements': { title: '三個條件：mutual exclusion、progress、bounded waiting', play: scCSReq },
    'strict-alternation': { title: '只用 turn 輪流：違反 progress（課本）', play: scStrict },
    'peterson': { title: "Peterson's solution：turn + flag", play: scPeterson },
    'peterson-wrong': { title: 'Peterson 寫錯：turn = 自己 → 兩人都進去', play: scPetersonWrong },
    'peterson-bounded': { title: 'Peterson 的 bounded waiting：剛出來的人會被擋住', play: scPetersonBW },
    'bakery': { title: 'Bakery algorithm：抽號碼牌，(num, PID) 小的先', play: scBakery },
    'bakery-choosing': { title: 'Bakery 為什麼要 choosing：P1、P4 都抽到 6', play: scBakeryChoosing },
    'test-and-set': { title: 'test_and_set 鎖（課本）', play: scTAS },
    'compare-and-swap': { title: 'compare_and_swap 鎖（課本）', play: scCAS },
    'sem-binary': { title: 'Semaphore wait / signal：S = 1', play: scSemBinary },
    'sem-counting': { title: 'Counting semaphore：S = 3，P4 要等', play: scSemCounting },
    'sem-order': { title: '用 semaphore 排順序：S1 一定在 S2 之前', play: scSemOrder },
    'sem-block': { title: 'Busy waiting vs block / wakeup', play: scSemBlock },
    'sem-deadlock': { title: 'Semaphore 順序寫反造成 deadlock（課本）', play: scSemDeadlock },
    'priority-inversion': { title: 'Priority inversion 與 priority inheritance（課本）', play: scPriInv },
    'bounded-buffer': { title: 'Bounded buffer：mutex、empty、full', play: scBoundedBuffer },
    'readers-writers': { title: 'Readers-writers：reader 一直插隊，writer 餓死', play: scRW },
    'rw-solution': { title: 'First readers-writers 的 semaphore 解法', play: scRWSolution },
    'dining-deadlock': { title: 'Dining philosophers：大家先拿左邊 → deadlock', play: scDiningDeadlock },
    'monitor': { title: 'Monitor：一次只有一個 thread 在裡面', play: scMonitor },
    'dining-monitor': { title: 'Dining philosophers 的 monitor 解法（課本）', play: scDiningMonitor },
  };

  return {
    kicker: '作業系統・第 5 章',
    title: '同步與互斥',
    color: 'var(--os)',
    modes: [
      { id: 'race', name: 'Race condition', enter: enterRace },
      { id: 'cs', name: 'Critical section 演算法', enter: enterCS },
      { id: 'sem', name: 'Semaphore', enter: enterSem },
      { id: 'buffer', name: 'Bounded buffer', enter: enterBuffer },
      { id: 'dining', name: '哲學家用餐', enter: enterDining },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'linux-active-expired', 'counter-buffer', 'race-counter', 'race-outcomes', 'cs-structure', 'cs-requirements',
      'strict-alternation', 'peterson', 'peterson-wrong', 'peterson-bounded', 'bakery', 'bakery-choosing',
      'test-and-set', 'compare-and-swap',
      'sem-binary', 'sem-counting', 'sem-order', 'sem-block', 'sem-deadlock', 'priority-inversion',
      'bounded-buffer', 'readers-writers', 'rw-solution', 'dining-deadlock', 'monitor', 'dining-monitor',
    ],
    stop() { stopTimer(); },
  };
}
