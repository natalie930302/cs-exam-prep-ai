// 作業系統 第5章：同步與互斥（race condition、critical section、Peterson、Bakery、TAS/CAS、semaphore、經典問題、monitor）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自清大周志遠 18C/19A/20D 講與 Semaphores 影片；尚未轉錄的 18D/19B/20B/20C/21A/21B 以恐龍書補上。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600', lineHeight: '1.15' };
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
    const panels = P.map((p, i) => code(p.lines.map((l) => l.t), i ? 4.4 : -4.4, 6.2, 0.5, -3.4));
    P.forEach((p, i) => tag(p.name, i ? 'ptr alt' : 'ptr', i ? 4.4 : -4.4, 6.75, -3.4));
    const room = ghostBox('#2fc092', 2.6, 1.4, 2.0, 0, 0.7, 0.2, 0.16);
    tag('critical section', 'idx', 0, 1.6, 0.2);
    tag('remainder', 'idx', -5.0, 0, 3.9); tag('remainder', 'idx', 5.0, 0, 3.9);
    const toks = P.map((p, i) => cube(p.name, PCOL[i], [0.9, 0.7, 0.9], (i ? 1 : -1) * REG.rem[0], 0.35, REG.rem[1]));
    const vs = A.vars(S).map(([k], n, all) => { const x = (n - (all.length - 1) / 2) * 2.2; const m = cube('', '#c9b48e', [1.3, 0.6, 0.9], x, 0.3, -2.4); tag(k, 'idx', x, 0, -1.6); return m; });
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
    const semC = ['mutex', 'empty', 'full'].map((k, j) => { const m = cube(k + ' = ' + S[k], '#c9b48e', [1.9, 0.6, 0.9], -2.4 + j * 2.4, 0.3, -2.8); return [k, m]; });
    const pin = tag('in', 'ptr', -2.4, 1.0, 0.8), pout = tag('out', 'ptr alt', -2.4, 0, 2.5);
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
      move(ps[k], 3.4 + k * 1.1, 0.3, 2.4); glow(ps[k], null);
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
    move(c, 5.5, 0.3, 1.6); glow(c, null);
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
    const room = ghostBox('#2fc092', 4, 1.2, 1.6, 0, 0.6, 2.2, 0.15); tag('檔案', 'idx', -2.6, 1.0, 2.2);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ syn.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
// (kit has no beat: short waits use ctx.beat)
// code lines: tighter line box so adjacent lines don't print over each other
const code = (...a) => { const c = P.code(...a); c.ls.forEach((l) => { l.element.style.lineHeight = '1.15'; }); return c; };
// ─── 第 5 章 Process Synchronization：清大周志遠 18C–21B、Semaphores、Critical Section — cued scenes ───
// Every `await step(tok)` waits until the lecturer says that sentence (notes "cues");
// between steps only short moves (≤ ~2.5 s); nothing loops or replays.
// 課堂的例子照影片；動畫自己補的數字一律標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const idx = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.9, drop = 0) => cube(t, c, [w, h, d], x, y, z, drop);
const arr = (x1, y1, x2, y2, c = '#8a7a5c', z = 0, z2 = z) => arrow(V3(x1, y1, z), V3(x2, y2, z2), c);
const tx = (l, t) => P.txt(l, t);
const rl = (m, t) => P.relabel(m, t);
async function slide(tok, o, x, y, z = 0, ms = 700) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
const pal = (name, v, color, x, y = 0, z = 0, s = 0.8) => buddy(name, v, color, x, y, z, s);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.ls) o.kill(); else kill(o); });
const room = (x, y, z, w, h, d, c = '#2fc092') => { const m = P.ghostBox(c, w, h, d); m.position.set(x, y, z); return m; };
const PCS = ['#4b9ee2', '#dd8238', '#2fc092', '#9b7ef4', '#e55a9b', '#31aab0'];
const SC = { mem: '#c9b48e', cs: '#2fc092', entry: '#9b7ef4', rem: '#d8cfc0', bad: '#d64545', gold: '#c08a1f', paper: '#fffaf0', os: '#7d6bd6' };
const DIM = '#3a2a00', OKG = '#0f5a3a', NOR = '#7a1010';
const sleepy = (b, on = true) => { b.mood(on ? 'sad' : 'calm'); if (b.zz) { remove(b.zz); b.zz = null; } if (on) { b.zz = tag('zZ', 'idx', 0.5, 1.2, 0); b.g.add(b.zz); } };

// ── counter++ / counter-- at instruction level with two buddies (registers on their bellies) ──
function raceStage(init = 5, o = {}) {
  const X = o.x || 4.3;
  const st = { c: init, r: [null, null], pc: [0, 0] };
  const mem = bx('counter = ' + init, SC.mem, 0, 0.45, 0.4, 2.8, 0.9, 1.3);
  idx('shared memory', 0, 0, 1.4);
  const who = [pal('Producer', 'reg1 = ?', PCS[0], -X, 0, 1.0, 0.9), pal('Consumer', 'reg2 = ?', PCS[1], X, 0, 1.0, 0.9)];
  const L = [['reg1 = counter;', 'reg1 = reg1 + 1;', 'counter = reg1;'], ['reg2 = counter;', 'reg2 = reg2 - 1;', 'counter = reg2;']];
  const cd = [code(L[0], -X, 4.4, 0.55, -2.4), code(L[1], X, 4.4, 0.55, -2.4)];
  hd('counter++', -X, 5.1, -2.4); hot('counter--', X, 5.1, -2.4);
  async function go(tok, i, ms = 700) {
    const k = st.pc[i]; if (k > 2) return;
    cd[i].hl(k); cd[1 - i].hl(-1);
    const bxX = i ? X : -X, r = 'reg' + (i + 1);
    if (k === 0) {
      st.r[i] = st.c; glow(mem, '#3a2a00');
      const p = pkt(String(st.c), 0, 1.3, 0.9); await travel(tok, p, V3(0, 1.3, 0.9), V3(bxX, 2.3, 1.0), ms); remove(p);
      who[i].set(r + ' = ' + st.r[i]); glow(mem, null);
    } else if (k === 1) {
      st.r[i] += i ? -1 : 1; await who[i].hop(tok); who[i].set(r + ' = ' + st.r[i]);
    } else {
      st.c = st.r[i];
      const p = pkt(String(st.c), bxX, 2.3, 1.0); await travel(tok, p, V3(bxX, 2.3, 1.0), V3(0, 1.3, 0.9), ms); remove(p);
      rl(mem, 'counter = ' + st.c); glow(mem, '#3a2a00');
    }
    st.pc[i]++;
  }
  return { st, mem, who, cd, go };
}

// ── timeline helper: horizontal bars on rows ──
function timeline(x0, sx, rows) {
  rows.forEach(([name, z]) => hd(name, x0 - 0.9, 0.3, z));
  return (a, b, z, c, lbl = '', drop = 1.5) => bx(lbl, c, x0 + ((a + b) / 2) * sx, 0.25, z, Math.max(0.06, (b - a) * sx - 0.04), 0.5, 0.75, drop);
}

// ════════ CNO_I8jhX3I（第 18C 講）：active/expired array、synchronization 的來源、counter race、critical section、三個條件 ════════
FRAG.push(['syn-18c-linux', 'Active / expired array：H（quantum 10）與 L（quantum 200）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.2, 0]);
  const x0 = -4.2, sx = 0.022;
  await step(tok);                                   // 17 兩個 process：H 高 priority、quantum 10；L 低、200
  const H = pal('H', 'q = 10', PCS[0], -6.4, 0, -4.6, 0.7), L = pal('L', 'q = 200', PCS[1], -4.6, 0, -4.6, 0.7);
  H.mood('happy'); idx('priority 高', -6.4, 1.6, -4.6); idx('priority 低', -4.6, 1.6, -4.6);
  cap('H：priority 高、quantum 10', 'L：priority 低、quantum 200，同時進系統');
  const seg = timeline(x0, sx, [['沒有 active array', -1.4], ['有 active array', 1.8]]);
  await step(tok);                                   // 43 沒有 active array：H 先做 10
  seg(0, 10, -1.4, PCS[0], '');
  idx('H 10', x0 + 0.1, 0, -0.6);
  cap('沒有 active array：priority 高的 H 先做', '做完 10 就結束這個 burst');
  await step(tok);                                   // 52 L 給 200，只做 100 就結束
  seg(10, 110, -1.4, PCS[1], 'L 做 100');
  const left = seg(110, 210, -1.4, '#eee4d2', '還有 100', 0);
  cap('L 給它 200，但只做了 100 就結束', '這個 CPU burst 先做完了');
  await step(tok);                                   // 57 第二個 burst：H 又先做，L 的 100 浪費
  kill(left);
  seg(120, 130, -1.4, PCS[0], '');
  seg(130, 230, -1.4, PCS[1], 'L');
  bad('剩下的 100 浪費掉', x0 + 160 * sx, 0, -0.5);
  L.mood('sad');
  cap('第二個 burst 來了：H 又先做', 'L 剛才剩下的 100 就浪費掉');
  await step(tok);                                   // 76 有 active array：第一個 burst 一樣
  seg(0, 10, 1.8, PCS[0], ''); seg(10, 110, 1.8, PCS[1], 'L 做 100');
  const act = zone('active array', 3.6, 0.02, 1.2, 3.2, 1.4, '#d6efe0');
  const exp = zone('expired array', 3.6, 0.02, 3.4, 3.2, 1.4, '#e8e1d6');
  act.userData.name.position.set(5.4, 0.07, 1.2); exp.userData.name.position.set(5.4, 0.07, 3.4);   // names beside the zones
  cap('有 active array：第一個 burst 跟剛才一樣', 'H 先、L 後');
  await step(tok);                                   // 87 H 把 quantum 用完 → expired
  await slide(tok, H.g, 4.4, 0, 3.4, 900);
  cap('H 把 quantum 用完了', '→ 放進 expired array');
  await step(tok);                                   // 92 L 只用 100 → 留在 active
  await slide(tok, L.g, 2.6, 0, 1.2, 900); L.set('剩 100'); L.mood('calm');
  cap('L 只用了 100，還剩 100', '沒用完 → 留在 active array');
  await step(tok);                                   // 103 第二個 burst：先從 active 選 → L 先
  seg(120, 220, 1.8, PCS[1], 'L 先做'); seg(220, 230, 1.8, PCS[0], '');
  glow(L.body, OKG); L.mood('happy');
  cap('scheduler 一定先從 active array 選', '所以這次 priority 低的 L 反而先做');
  await step(tok);                                   // 145 最大好處：保護 quantum 長、priority 低的程式
  note('不只看 priority，也看 quantum 還剩多少', 0, 4.4, 0);
  cap('好處：保護 quantum 長、priority 低的程式', '輪到它時，讓它把 quantum 用完');
  await step(tok);                                   // 184 solution：比較 fair
  good('比較 fair', 3.6, 2.6, 1.2);
  cap('引入 active array 的概念', '對 low priority 的程式比較公平');
  void act; void exp;
}]);

FRAG.push(['syn-18c-why', '為什麼會有 synchronization 問題', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  await step(tok);                                   // 210 進入第六章：synchronization
  hd('Synchronization（同步）', 0, 5.2);
  cap('進入新的一章：Synchronization', '最重要、也很麻煩的一章');
  await step(tok);                                   // 224 shared memory / multi-thread programming
  const mem = bx('shared data', SC.mem, 0, 0.45, 0, 2.4, 0.9, 1.2, 2);
  const A = pal('thread 1', '', PCS[0], -4, 0, 0.6), B = pal('thread 2', '', PCS[1], 4, 0, 0.6);
  cap('shared memory、multi-thread programming', '它們最大的缺點：synchronization 問題');
  await step(tok);                                   // 236 preemptive scheduling 比較好，但也會造成問題
  const cpu = prop('cpu', -5.6, 0, -2.6, 0.8, 'preemptive');
  note('preemptive：比較好，但會造成 synchronization 問題', 0, 3.6, -1);
  cap('preemptive scheduling 比較好', '但它又會造成 synchronization 問題');
  await step(tok);                                   // 254 這章的路線
  const road = ['critical section', 'hardware support', 'semaphore', 'monitor'].map((t, k) => bx(t, [SC.cs, SC.os, PCS[0], PCS[3]][k], -4.8 + k * 3.2, 0.3, -3.2, 2.8, 0.5, 0.8, 1.5));
  cap('這章的 solution：critical section → hardware', '再到 semaphore、monitor 這些 tool');
  await step(tok);                                   // 291 原因：有一份 shared data
  gone(...road);
  glow(mem, DIM);
  cap('原因：有一份 shared data', 'data 就是一個 memory address 的 content');
  await step(tok);                                   // 305 兩個以上執行序 concurrent read/write → inconsistency
  const a1 = arr(-3.4, 1.0, -1.3, 0.8, PCS[0], 0.6), a2 = arr(3.4, 1.0, 1.3, 0.8, PCS[1], 0.6);
  A.mood('wow'); B.mood('wow');
  const incon = bad('data inconsistency（不一致）', 0, 2.2, 0.6);
  cap('兩個以上的執行序同時讀寫它', '→ data inconsistency');
  await step(tok);                                   // 339 同樣的程式，有時 A 有時 B
  const ra = bx('這次跑出 A', '#e3f3ea', -2.2, 0.3, 2.8, 2.2, 0.5, 0.8, 1.5), rb = bx('下次跑出 B', '#fde8e6', 2.2, 0.3, 2.8, 2.2, 0.5, 0.8, 1.5);
  cap('執行同樣的程式，有時候是 A、有時候是 B', '程式就出錯了');
  await step(tok);                                   // 356 值取決於執行順序
  note('結果取決於執行的順序（ordering）', 0, 4.4, 0);
  cap('最大原因：執行的順序不同', 'concurrent → 兩個人都會影響它的值');
  await step(tok);                                   // 379 solution：確保 ordering，彼此 cooperate
  gone(a1, a2, ra, rb, incon);
  A.mood('happy'); B.mood('happy');
  await slide(tok, A.g, -2.4, 0, 1.4, 700);
  good('cooperate：讓執行順序一樣', 0, 2.4, 1.4);
  cap('solution：讓 process 之間 cooperate', '確保它們的執行順序一致');
  await step(tok);                                   // 418 programmer 要負責控制順序
  hot('programmer：在程式裡控制順序', 0, 6.0);
  cap('programmer 的責任：想辦法控制順序', '能控制順序，就解掉 synchronization 問題');
  void cpu;
}]);

FRAG.push(['syn-18c-counter', 'Producer–consumer 用 counter：counter 也變成 shared data', async (tok) => {
  fresh([0, 6, 13], [0, 1.2, 0]);
  const N = 8, xs = Array.from({ length: N }, (_, k) => -4.2 + k * 1.2);
  let its = [];
  await step(tok);                                   // 435 之前的 producer-consumer：shared buffer
  xs.forEach((x, k) => { ctx.tile(V3(x, 0.04, 0), 1.05, 1.05); idx('[' + k + ']', x, 0, 0.8); });
  const pr = pal('Producer', '', PCS[0], -6.2, 0, 2.4, 0.7), co = pal('Consumer', '', PCS[1], 6.2, 0, 2.4, 0.7);
  cap('之前介紹過的 producer–consumer', '共用一個 memory buffer 做 input、output');
  await step(tok);                                   // 449 之前的解法：浪費一格
  for (let k = 0; k < N - 1; k++) its.push(bx(k + 1, '#2fc092', xs[k], 0.35, 0, 0.85, 0.6, 0.85, 2));
  const w = bad('永遠空一格', xs[N - 1], 1.3, 0);
  cap('之前的解法沒有 synchronization 問題', '但永遠浪費一格 buffer');
  await step(tok);                                   // 461 想用滿 → 用一個 counter
  remove(w); its.push(bx(N, '#2fc092', xs[N - 1], 0.35, 0, 0.85, 0.6, 0.85, 2));
  const c = bx('counter = 8', SC.mem, 0, 0.45, -2.6, 2.4, 0.8, 1.2, 2);
  cap('想把整個 buffer 用完：加一個 counter', 'shared counter，兩個 process 都看得見');
  await step(tok);                                   // 477 producer ++、consumer --
  bub('放一個：counter++', -4.6, 2.2, 2.4); bub('拿一個：counter--', 4.6, 2.2, 2.4);
  cap('producer 放一個就 counter++', 'consumer 拿一個就 counter--');
  await step(tok);                                   // 481 看 counter 就知道滿或空
  good('counter = 8 → 滿；= 0 → 空', 0, 1.6, -2.6);
  pr.mood('happy'); co.mood('happy');
  cap('看 counter 就知道 buffer 滿了還是空了', '又簡單又好懂，好像很美好');
  await step(tok);                                   // 495 但 counter 本身又是 shared memory
  glow(c, NOR); pr.mood('wow'); co.mood('wow');
  cap('問題：counter 本身又變成 shared memory', '');
  await step(tok);                                   // 510 兩個人都 modify 它
  arr(-5.4, 1.0, -1.3, 0.8, PCS[0], 2.0, -2.4); arr(5.4, 1.0, 1.3, 0.8, PCS[1], 2.0, -2.4);
  bad('兩邊都要「改寫」它', 0, 2.8, -2.6);
  cap('而且兩個人不只讀，還都要改寫它', '一個 ++、一個 -- → synchronization 問題');
}]);

FRAG.push(['syn-18c-race', 'counter++ / counter-- 在指令層交錯：5 變 4', async (tok) => {
  fresh([0, 6, 13], [0, 2, 0]);
  let R;
  await step(tok);                                   // 534 counter++ 只是 language level 的一行
  R = raceStage(5);
  R.cd.forEach((c) => c.ls.forEach((l) => P.showL(l, false)));
  cap('counter++ 只是 language level 的一行', '到了 CPU 會被拆成好幾個 instruction');
  await step(tok);                                   // 542 拆成三個：load、加、寫回
  R.cd[0].ls.forEach((l) => P.showL(l, true));
  cap('拆成三個：從 memory 搬到 register', '加 1，再搬回 memory');
  await step(tok);                                   // 550 counter-- 一樣；register 不同，memory 共用
  R.cd[1].ls.forEach((l) => P.showL(l, true));
  glow(R.mem, DIM);
  cap('counter-- 一樣三個指令', 'register 各自的，counter 的 memory 兩邊共用');
  await step(tok);                                   // 578 從 producer 開始；preemptive → 不保證一次做完
  glow(R.mem, null);
  await R.go(tok, 0);
  cap('先從 producer 開始：reg1 = counter = 5', 'preemptive：不保證三個一次做完');
  await step(tok);                                   // 594 只做前兩個就 context switch
  await R.go(tok, 0);
  R.who[0].mood('sad');
  note('context switch！', 0, 3.4, 0.6);
  cap('reg1 加成 6，還沒寫回', 'context switch 就發生了');
  await step(tok);                                   // 609 consumer 前兩個：load 5、減 1
  await R.go(tok, 1, 600); await R.go(tok, 1);
  cap('換 consumer：reg2 = counter，讀到的還是 5', '減 1 → reg2 = 4（也還沒寫回）');
  await step(tok);                                   // 620 回 producer 做最後一個：寫回 6
  await R.go(tok, 0);
  cap('再切回 producer 做最後一個', 'counter = reg1 = 6');
  await step(tok);                                   // 639 consumer 做最後一行：寫回 4
  await R.go(tok, 1);
  glow(R.mem, NOR); R.who[1].mood('happy');
  cap('consumer 做最後一行：counter = reg2 = 4', '把 6 蓋掉了');
  await step(tok);                                   // 653 5 → 6 → 4
  idx('counter：5 → 6 → 4', 0, 2.2, 0.4);
  cap('counter 從 5 被改成 6，又被改成 4', '');
  await step(tok);                                   // 664 一次 ++ 一次 --，答案應該是 5
  bad('答案應該是 5，這個順序卻得到 4', 0, 2.9, 0.6);
  cap('一次 ++、一次 --，答案應該是 5', '這個 ordering 卻得到 4');
}]);

FRAG.push(['syn-18c-outcomes', 'Race 的結果可能是 4、5、6', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  const card = (x, v, c, why) => { const m = bx('counter = ' + v, c, x, 0.45, 0, 2.6, 0.9, 1.2, 2.5); idx(why, x, 0, 1.2); return m; };
  let m4, m6, m5;
  await step(tok);                                   // 685 倒過來：最後寫的是 producer → 6
  m4 = card(-4.2, 4, '#f2c4bd', 'C 最後寫回（剛才）');
  m6 = card(0, 6, '#f2c4bd', 'P 最後寫回');
  code(['C: reg2 = counter  (5)', 'C: reg2 = reg2 - 1 (4)', 'P: reg1 = counter  (5)', 'P: reg1 = reg1 + 1 (6)', 'C: counter = reg2  (4)', 'P: counter = reg1  (6)'], 0, 4.8, 0.45, -2.6);
  cap('把順序倒過來：最後寫回的是 producer', '答案是 6，也不對');
  await step(tok);                                   // 699 一邊全部做完再做另一邊 → 5
  m5 = card(4.2, 5, '#bfe6cf', '一邊全部做完再做另一邊');
  cap('一次把一邊全部做完再做另一邊', '答案才是 5');
  await step(tok);                                   // 705 三種答案，只有 5 對
  glow(m5, OKG); glow(m4, NOR); glow(m6, NOR);
  hot('同一段程式：4、5、6 都可能', 0, 2.2, 0.6);
  cap('同一段程式跑出三種答案：4、5、6', '只有 5 是正確的');
  await step(tok);                                   // 720 data 不一致，跟 ordering 有關
  note('值跟執行的 ordering 有關', 0, 0, 2.6);
  cap('data 的值不一致', '原因是執行的 ordering 不同');
  await step(tok);                                   // 728 先決條件一：shared memory content
  good('條件 ①：有 shared memory content（counter）', -4.4, 5.8, -2.6);
  cap('先決條件 ①：有 shared memory content', '沒有共用就不可能發生');
  await step(tok);                                   // 756 條件二：preemptive scheduler
  good('條件 ②：preemptive scheduling', 4.6, 5.8, -2.6);
  const cpu = prop('cpu', 6.2, 0, 2.6, 0.7, 'preemptive');
  cap('另一個條件：一定要 preemptive scheduling', '執行到一半會被 context switch');
  await step(tok);                                   // 780 non-preemptive 不會有問題
  note('non-preemptive：CPU burst 一次做完，load → 算 → 寫回才換人', 0, 0, 4.0);
  cap('non-preemptive 就沒有這個問題', 'memory 的操作不會做到一半被人改掉');
  await step(tok);                                   // 809 OS kernel：disable interrupt
  bad('kernel：disable interrupt → 變 non-preemptive', 0, 6.6, -2.6);
  cap('所以 OS 在 kernel 裡的作法', '把 interrupt disable，換成 non-preemptive');
  void cpu;
}]);

FRAG.push(['syn-18c-racedef', 'Race condition 的定義與解法方向', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  await step(tok);                                   // 830 synchronization 指的就是剛才的問題
  hd('Synchronization 問題 = 剛才 counter 的例子', 0, 5.6);
  cap('synchronization 指的就是剛才這個問題', '');
  await step(tok);                                   // 841 race condition
  const mem = bx('counter', SC.mem, 0, 0.45, 0, 2.2, 0.9, 1.2, 2);
  const A = pal('P', '6', PCS[0], -4.2, 0, 1.2), B = pal('C', '4', PCS[1], 4.2, 0, 1.2);
  hot('race condition', 0, 4.6);
  cap('非常相關的專有名詞：race condition', '最後的值取決於最後修改它的人');
  await step(tok);                                   // 858 last 完成的人決定值
  const p1 = pkt('6', -3.4, 1.4, 1.2); await travel(tok, p1, V3(-3.4, 1.4, 1.2), V3(0, 1.0, 0.7), 600); remove(p1); rl(mem, 'counter = 6');
  const p2 = pkt('4', 3.4, 1.4, 1.2); await travel(tok, p2, V3(3.4, 1.4, 1.2), V3(0, 1.0, 0.7), 600); remove(p2); rl(mem, 'counter = 4');
  B.mood('happy'); A.mood('sad');
  const last = note('最後一個寫的人「贏」', 0, 2.2, 0.6);
  cap('像在競爭：finish last 的人', 'determine 最後的 value');
  await step(tok);                                   // 866 synchronization 廣義；race condition 特指這種
  gone(A, B, mem, last);
  const z1 = zone('synchronization 問題（廣義）', 0, 0.02, -2.6, 9.0, 2.0, '#efe6d6');
  z1.userData.name.position.z = -1.35;
  bx('race condition', SC.bad, 1.6, 0.3, -2.9, 2.8, 0.5, 0.9, 1.5);
  cap('synchronization 廣義有很多狀況', 'race condition 特指「最後值看誰最後執行」');
  await step(tok);                                   // 901 prevent → synchronize 這些 process
  good('prevent race condition → synchronize processes', 0, 6.4);
  cap('要 prevent race condition', '就要 synchronize 這些 process');
  await step(tok);                                   // 910 暴力解：disable interrupt
  const cpu = prop('cpu', -5.8, 0, 3.4, 0.7, 'interrupt off');
  note('暴力解：disable interrupt → non-preemptive', -2.6, 1.6, 3.4);
  cap('第一種很暴力的方式', 'disable scheduler 的 interrupt，切成 non-preemptive');
  await step(tok);                                   // 919 使用者程式絕對不行
  bad('user program：不行！影響整個系統', 3.2, 0.9, 3.4);
  cap('有些 OS 會這麼做，使用者程式絕對不行', '影響整個系統、也影響別的使用者');
  await step(tok);                                   // 938 OS 可以：kernel code 短、priority 高
  good('OS kernel：code 短、priority 高 → 可以', 3.2, 0.1, 3.4);
  cap('OS 可以選擇這樣做', 'kernel code 通常很短、priority 本來就高');
  await step(tok);                                   // 962 一般程式：critical section problem
  hot('一般程式的標準作法：critical section problem', 0, 7.0, -1);
  cap('一般程式的 standardized 作法', '定義成 critical section 問題');
  void z1; void cpu;
}]);

FRAG.push(['syn-18c-csstruct', 'Critical section 的架構：entry / CS / exit / remainder', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let parts = [];
  await step(tok);                                   // 977 critical section 其實是一個 protocol
  hd('critical section = 一套 protocol', 0, 6.2);
  cap('critical section 其實是一個 protocol', '');
  await step(tok);                                   // 986 cooperate：大家 follow 同一套機制
  const ps = [0, 1, 2].map((k) => pal('P' + k, '', PCS[k], -5.2 + k * 1.2, 0, 3.0, 0.6));
  ps.forEach((b) => b.mood('happy'));
  note('大家都 follow 同一套 protocol → ordering 受控制', 0, 0, 4.6);
  cap('要 cooperate，大家都 follow 同樣的機制', '只要都遵守，ordering 就受到 control');
  await step(tok);                                   // 1013 定義：N 個 processes
  idx('N 個 processes', -4.0, 1.9, 3.0);
  cap('問題的定義：N 個 processes', '才有 concurrent access');
  await step(tok);                                   // 1022 加上一份 shared data
  const sd = bx('shared data', SC.mem, 4.6, 0.4, 3.0, 2.0, 0.8, 1.1, 2);
  cap('再加上一份 shared data', '被 N 個 process concurrently access');
  await step(tok);                                   // 1042 程式切成 section：shared 那段 = critical section
  const rows = [['entry section', SC.entry], ['critical section', SC.cs], ['exit section', SC.entry], ['remainder section', SC.rem]];
  parts.push(bx(rows[1][0], rows[1][1], 0, 2.9, -1.8, 4.2, 0.7, 1.2, 2));
  idx('會造成 race condition 的那段 code', 4.6, 2.9, -1.8);
  cap('程式切成不同 section', '會造成 race condition 的那段 code → critical section');
  await step(tok);                                   // 1070 進去前、出來後各加一段 protocol
  parts.push(bx(rows[0][0], rows[0][1], 0, 3.9, -1.8, 4.2, 0.7, 1.2, 2));
  parts.push(bx(rows[2][0], rows[2][1], 0, 1.9, -1.8, 4.2, 0.7, 1.2, 2));
  cap('找到 critical section 後', '在進入前、離開後各加一段程式（protocol）');
  await step(tok);                                   // 1085 mutual exclusion：一次只有一個人
  hot('mutual exclusion：一次只有一個人在裡面', 0, 5.4);
  cap('目的：mutual exclusion', '一次只有一個人可以在裡面執行');
  await step(tok);                                   // 1102 有人在裡面，其他人都不能進
  await slide(tok, ps[0].g, -2.8, 2.55, -1.4, 900); glow(ps[0].body, OKG);
  ps[1].mood('wow'); ps[2].mood('wow');
  cap('有一個程式在 critical section 裡', '其他程式都不可以進去 → 拿掉 concurrent access');
  await step(tok);                                   // 1131 do-while、remainder section
  parts.push(bx(rows[3][0], rows[3][1], 0, 0.9, -1.8, 4.2, 0.7, 1.2, 2));
  hd('do {', -2.9, 4.6, -1.8); hd('} while (true);', -2.6, 0.2, -1.8);
  cap('通常寫成 do { … } while', '其他程式碼就是 remainder section');
  await step(tok);                                   // 1155 要寫的：entry 與 exit section
  glow(parts[1], null); glow(parts[2], DIM);
  note('我們要寫的：entry、exit', 4.2, 3.9, -1.8);
  cap('各位要寫的就是 entry 和 exit section', '進去前一定先執行 entry，離開時一定執行 exit');
  await step(tok);                                   // 1190 接下來都在討論 entry / exit 怎麼寫
  await slide(tok, ps[0].g, -5.2, 0, 3.0, 800); glow(ps[0].body, null);
  await slide(tok, ps[1].g, -2.8, 2.55, -1.4, 800); glow(ps[1].body, OKG);
  cap('接下來的 solution 都在討論', 'entry、exit 怎麼寫，才能確保 mutual exclusion');
  void sd;
}]);

FRAG.push(['syn-18c-csreq', '三個條件：mutual exclusion、progress、bounded waiting（廁所比喻）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.2, 0]);
  const wc = room(0, 0.8, -1.6, 2.4, 1.6, 2.0);
  idx('廁所（critical section）', 0, 1.9, -1.6);
  const list = [];
  const req = (k, t, c) => { const l = tag(t, c, -4.6, 5.8 - k * 0.7, -2.4); list.push(l); return l; };
  await step(tok);                                   // 1205 第一個：mutual exclusion
  req(0, '① mutual exclusion', 'ptr');
  cap('第一個條件：mutual exclusion', '解決 synchronization 的基本要件');
  await step(tok);                                   // 1226 完整的 solution 還要更多
  idx('以 programmer 的角度，還有其他條件', -4.6, 6.4, -2.4);
  cap('完整的 critical section solution', '只有 mutual exclusion 還不夠');
  await step(tok);                                   // 1246 第二個：progress；廁所例子
  req(1, '② progress', 'ptr');
  const A = pal('A', '', PCS[0], -3.0, 0, 1.6, 0.6), B = pal('B', '', PCS[1], -1.8, 0, 1.6, 0.6);
  cap('第二個叫 progress', '老師最愛用的例子：上廁所');
  await step(tok);                                   // 1260 mutual exclusion：絕對不跟別人共用
  await slide(tok, A.g, 0, 0, -1.6, 700); glow(A.body, OKG);
  B.mood('wow');
  cap('上廁所絕對不跟別人共用', '這就是 mutual exclusion');
  await step(tok);                                   // 1269 progress：空的就要能進去，不能「維修中」
  await slide(tok, A.g, 4.2, 0, 1.6, 700); glow(A.body, null);
  const sign = bx('維修中', SC.bad, 0, 1.4, -0.4, 1.4, 0.5, 0.3, 1.2);
  B.mood('sad');
  bad('裡面空著卻進不去 ✗', -2.2, 2.6, 1.6);
  cap('progress：裡面空的，想進的人就要能進去', '不能被反鎖在外面說在維修');
  await step(tok);                                   // 1288 程式要能繼續運作
  kill(sign);
  await slide(tok, B.g, 0, 0, -1.6, 700); glow(B.body, OKG); B.mood('happy');
  cap('不會 race，但程式也不能不會動', '空著時，要進去的人一定進得去');
  await step(tok);                                   // 1323 第三個：bounded waiting，最容易搞混
  req(2, '③ bounded waiting', 'ptr alt');
  const D = pal('D', '', PCS[3], -1.4, 0, 1.2, 0.6);
  cap('第三個 bounded waiting', '大家最容易搞混的一個');
  await step(tok);                                   // 1331 廁所一直有人用，但不能讓人無止境地等
  await slide(tok, B.g, 4.6, 0, 2.6, 600); glow(B.body, null);
  for (let k = 0; k < 2; k++) {
    const x = pal('X' + k, '', '#c8b8f0', -5.4, 0, 2.6, 0.5);
    await slide(tok, x.g, 0, 0, -1.6, 500); kill(x.g);
  }
  D.mood('sad'); glow(D.body, NOR);
  cap('廁所一直有人在用', '但不能讓想上廁所的人無止境地等');
  await step(tok);                                   // 1342 progress vs bounded waiting
  note('progress：空著能進　bounded waiting：等待有上限', 0, 3.6, -1.6);
  cap('progress 只管「空著時有人進得去」', 'bounded waiting：很多人要用時，等待要有期限');
  await step(tok);                                   // 1372 first come first serve 排隊
  await slide(tok, D.g, 0, 0, -1.6, 700); glow(D.body, OKG); D.mood('happy');
  good('排隊：first come, first serve', 3.6, 1.6, 0);
  cap('原則很簡單：first come, first serve', '大家排隊使用，就滿足 bounded waiting');
  await step(tok);                                   // 1401 否則 starvation
  bad('等待沒有上限 → starvation', -4.0, 0.9, 3.4);
  cap('等待沒有 bound 的話', '就會 starvation：有人永遠執行不到');
  await step(tok);                                   // 1409 三個條件都要滿足
  list.forEach((l) => { l.element.className = 'lab-label good'; });
  cap('正確的 solution：三個條件都要滿足', '要記清楚，也要能分辨差別');
  void wc;
}]);

// ════════ 6LWj3CuOCPs（第 19A 講）：Peterson 回顧、寫法注意、證明三條件、Bakery、choosing、P1/P4 例子 ════════
const csCam = () => fresh([0, 7, 12.5], [0, 2.2, 0]);
// run several interpreter lines of a csView with short pauses (each ≤ ~0.5 s)
async function runCS(tok, V, seq, ms = 450) { for (const i of seq) { V.step(i); await wt(tok, ms); } }

FRAG.push(['syn-19a-peterson', "Peterson's solution 回顧：turn（token）＋ flag（ready）", async (tok) => {
  csCam();
  let V;
  await step(tok);                                   // 14 recap：兩個 process 的 Peterson
  V = csView('peterson', { startPc: [0, 5] });
  cap("回顧：兩個 process 的 Peterson's solution", '不用背，記住它的概念');
  await step(tok);                                   // 18 turn 是 token，只有 0 或 1
  const tk = hot('turn = token（0 或 1）', 3.2, 1.4, -2.4);
  cap('第一點：turn 就是 token', '值只會是 0 或 1，是一個 boolean');
  await step(tok);                                   // 20 0 → P0 可以進；1 → P1
  const n3 = note('turn = 0 → P0 可以進　turn = 1 → P1 可以進', 0, 3.4, 0);
  cap('turn = 0：P0 可以進去', 'turn = 1：P1 可以進去');
  await step(tok);                                   // 44 進去前 / 出來後把 token 交給對方
  const t = pkt('token', -2.2, 2.0, 1.6);
  await travel(tok, t, V3(-2.2, 2.0, 1.6), V3(2.2, 2.0, 1.6), 900);
  cap('進去前（或出來後）要把 token 交給對方', '交換 token 才有輪流的作用');
  await step(tok);                                   // 64 只輪流 → progress 問題
  remove(n3);
  const b5 = bad('只用 turn：P0 把 token 給 P1，P1 卻不想進 → P0 進不去', 0, 4.2, 0.6);
  cap('只靠輪流會有 progress 的問題', 'P1 不想進去，P0 就再也進不去');
  await step(tok);                                   // 83 多加一個 flag：是不是 ready
  remove(t);
  hot('flag[i] = 我 ready、想進去', -3.2, 1.4, -2.4);
  cap('為了解決它，多加一個 condition：flag', '表示這個 process 是不是 ready、想進去');
  await step(tok);                                   // 90 只有「對方有 token 而且對方要進」才等
  V.P[0].pc = 2; V.update();
  remove(b5);
  const n7 = note('while 後面是分號：條件成立就一直卡在這行', 0, 4.2, 0.6);
  cap('只有「對方有 token 而且對方要進去」', '才會卡在 while（後面是分號）');
  await step(tok);                                   // 109 兩個條件都要成立 → 沒有 progress 問題
  V.P[0].pc = 0; V.update();
  remove(n7);
  await runCS(tok, V, [0, 0, 0], 500);
  good('P1 不想進（flag[1] = F）→ P0 照樣進去', 0, 4.2, 1.8);
  cap('兩個條件都成立才會被擋住', 'P1 沒有要進，P0 就進得去 → 沒有 progress 問題');
  await step(tok);                                   // 117 輪流交換 token → bounded waiting
  good('輪流交換 token → bounded waiting', 0, 3.6, 1.8);
  cap('又因為輪流交換 token', '所以也符合 bounded waiting');
}]);

FRAG.push(['syn-19a-wrong', 'Peterson 寫法要注意：flag 的位置、token 一定要交給對方', async (tok) => {
  csCam();
  let V = csView('peterson');
  await step(tok);                                   // 127 這只是一種 solution，不一定要一模一樣
  cap('這只是一個 solution', '不一定要寫得一模一樣');
  await step(tok);                                   // 134 flag[0] = true 要寫在進 CS 之前
  V.P[0].pc = 0; V.update();
  note('flag[i] = true：緊貼在進去之前', 0, 4.2, 0.6);
  cap('flag[0] = true 要寫在進 critical section 之前', '它的意思是「我要進去了」');
  await step(tok);                                   // 150 太早設 → 擋住對方 → 違反 progress
  const early = bad('太早設成 true（例如放在 remainder）→ 擋住對方 → 違反 progress', 0, 3.6, 1.8);
  cap('很早就設成 true，自己又沒要進', '就會擋住對方 → 不滿足 progress');
  await step(tok);                                   // 171 turn = 1 只是交 token：前後無所謂
  V.P[0].pc = 1; V.update();
  note('turn = j：寫在前面或後面都可以', 0, 0.4, 3.4);
  cap('turn = 1 只是把 token 交給對方', '寫在前面或後面倒是無所謂');
  await step(tok);                                   // 190 之前只保證 ME 的範例：交換擺在後面
  remove(early);
  idx('之前只有 mutual exclusion 的範例：exit 時才交換', 0, 3.6, 1.8);
  cap('之前那個只保持 mutual exclusion 的範例', '就是把 token 交換擺在後面');
  await step(tok);                                   // 203 一定要交換；turn = 自己 → 錯
  csCam();
  V = csView('wrong');
  bad('turn = 自己（把 token 搶過來）→ 一定錯', 0, 4.2, 0.6);
  cap('但一定要交換！寫成 turn = 0 搶 token', '這個 solution 一定是錯的');
  await step(tok);                                   // 217 trace：P0 設 turn = 0 → break while → 進去
  await runCS(tok, V, [0, 0, 0], 500);
  cap('trace：P0 設 turn = 0', '檢查 while 一定能 break → 進去');
  await step(tok);                                   // 227 換 P1：把 token 搶走 → 也進去
  await runCS(tok, V, [1, 1, 1], 500);
  cap('換 P1：又寫 turn = 1 把 token 搶走', '檢查 while 也能 break → 兩個都在 critical section！');
  await step(tok);                                   // 241 重點：token 一定要交換、flag 要設
  good('token 一定要交給對方；flag 要設成 ready', 0, 3.4, 2.4);
  cap('重點：進去前或出來後一定要交換 token', '還要把 flag 設起來，才滿足 progress');
}]);

FRAG.push(['syn-19a-proof', 'Peterson 證明三個條件（含 bounded waiting 的陷阱）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.8, 0]);
  let V;
  await step(tok);                                   // 255 三個證明；ME 用反證法
  hd('① mutual exclusion：反證法', -3.6, 6.0, -2.4);
  const tc = bx('turn = 0', SC.mem, -3.6, 0.4, 0, 2.0, 0.8, 1.1, 2);
  cap('三個證明，概念上來看', '第一個 mutual exclusion 靠反證法');
  await step(tok);                                   // 262 turn 是 boolean，不可能同時是 0 又是 1
  note('turn 不可能同時是 0 又是 1 → 不可能兩人都 break while', -3.6, 2.0, 0);
  cap('turn 只是一個 boolean 值', '不可能同時是 0 又是 1 → ME 成立');
  await step(tok);                                   // 274 progress：一人想進 / 兩人都想進
  hd('② progress：兩種情況', 3.4, 6.0, -2.4);
  const a = pal('想進', '', PCS[0], 1.8, 0, 0.4, 0.55), b = pal('不想進', '', PCS[1], 3.4, 0, 0.4, 0.55);
  b.mood('calm'); a.mood('wow');
  cap('progress：一個人要進去，另一個人不要', '或者兩個人都要進去');
  await step(tok);                                   // 286 看 condition：有一個人進得去就好
  good('想進的人進得去 ✓', 2.6, 1.8, 0.4);
  cap('檢查 condition：有一個人進得去就好', '就代表 progress 符合');
  await step(tok);                                   // 293 兩個都不想進：不用 evaluate
  idx('兩個都不想進 → 沒人進去，本來就對', 3.4, 4.6, -1);
  cap('兩個都不想進去當然不用看', '那不是 progress 要管的');
  await step(tok);                                   // 305 這是任何 solution 證 progress 的方法
  note('任何 solution 證 progress 都這樣檢查', 3.4, 5.3, -1.6);
  cap('這個證明方式不限於 Peterson', '任何 synchronization solution 都這樣證');
  await step(tok);                                   // 318 很多人同時想進：其中一個會被選中
  b.mood('wow');
  good('同時想進 → 剛好選中一個（不會多個，否則 ME 已經錯）', 2.6, 3.0, 1.6);
  cap('很多人同時想進：其中一個會被選中', '不可能多個，否則 ME 就已經不成立');
  await step(tok);                                   // 346 bounded waiting：一人在等，另一人剛離開
  csCam();
  V = csView('peterson');
  for (const i of [1, 1, 1, 0, 0, 0]) V.step(i);
  hd('③ bounded waiting（比較 tricky）', 0, 7.3, -3.4);
  cap('bounded waiting：P1 在 critical section', 'P0 在 while 裡等（紅色 = 卡住）');
  await step(tok);                                   // 377 直覺：剛出來的人在 remainder，P0 可以進
  await runCS(tok, V, [1, 1], 500);
  cap('P1 剛離開 critical section', '直覺：它在 remainder，P0 應該可以進去');
  await step(tok);                                   // 391 常忘記：沒被 context switch，又想進去
  await runCS(tok, V, [1, 1], 500);
  note('P1 沒被 context switch，又繞回來想進去！', 3.0, 4.6, 1.2);
  cap('常被忘記的情況：P1 沒有被 context switch', '繼續下一個 loop，又想進去');
  await step(tok);                                   // 420 有 token 的關係 → 它進去前先把 token 交出去
  await runCS(tok, V, [1], 500);
  cap('它進去之前一定先把 token 交給別人', 'turn = 0：P0 有 priority');
  await step(tok);                                   // 441 P0 一直在等 → flag[0] 是 true → P1 被擋住
  V.step(1);
  cap('P0 本來就在等，flag[0] 一定是 true', '沒有 token、對方又 ready → P1 一定被擋住');
  await step(tok);                                   // 458 卡在 while loop 一直檢查
  await runCS(tok, V, [1, 1], 600);
  cap('擋住的意思：雖然很快跑到這裡', '卻在 while loop 裡一直檢查，進不了 critical section');
  await step(tok);                                   // 473 直到 context switch → P0 break while
  V.step(0);
  cap('直到 OS 做了 context switch 回到 P0', 'P0 滿足條件、break while → 進去：一定輪流');
  await step(tok);                                   // 494 context switch 不是一人一行
  note('不是一人一行：可以跑任意多個指令，但就是卡在 entry section', 0, 5.2, 0.4);
  cap('context switch 不是一人執行一行', '可能跑任意數目的指令，但就是卡在 entry section');
  await step(tok);                                   // 515 critical section 越小越好
  good('critical section 越小越好（選錯可能 deadlock）', 0, 4.4, 1.8);
  cap('coding 上的注意：critical section 越小越好', '選錯有時會產生 deadlock（下一章）');
  void tc;
}]);

// a bakery code panel (choosing lines can be hidden at first)
function bakeryCode(x, yTop, z, withChoosing) {
  const L = ['choosing[i] = true;', 'num[i] = max(num[0..n-1]) + 1;', 'choosing[i] = false;', 'for (j = 0; j < n; j++) {', '  while (choosing[j]) ;', '  while (num[j] != 0 &&', '         (num[j], j) < (num[i], i)) ;', '}', '  critical section', 'num[i] = 0;', '  remainder section'];
  const c = code(L, x, yTop, 0.46, z);
  if (!withChoosing) [0, 2, 4].forEach((k) => P.showL(c.ls[k], false));
  return c;
}
FRAG.push(['syn-19a-bakery', 'N 個 process：Bakery algorithm（抽號碼牌）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let two = [], ppl = [], cd, nums = [];
  await step(tok);                                   // 529 為什麼只能兩個：turn 只有 0、1
  two = [pal('P0', '', PCS[0], -1.4, 0, 1.8, 0.7), pal('P1', '', PCS[1], 1.4, 0, 1.8, 0.7)];
  const tk = pkt('turn: 0 ↔ 1', 0, 2.2, 1.8);
  cap('Peterson 只能兩個 process', 'turn 只能是 0 跟 1，交換很明確');
  await step(tok);                                   // 540 N 個人：token 要交給誰？誰手上有？
  remove(tk); gone(...two);
  ppl = [1, 2, 3, 4, 5].map((k, i) => pal('P' + k, '', PCS[i], -5 + i * 2.5, 0, 2.6, 0.6));
  ppl.forEach((b) => b.mood('wow'));
  const ask = bub('token 交給誰？誰手上有 token？', 0, 2.6, 2.6);
  cap('N 個 process：token 要設成多少、交給誰？', '誰手上有 token 也不知道');
  await step(tok);                                   // 555 不能用傳 token 的概念
  const noTok = bad('傳遞 token 的作法不適用', 0, 4.0, 0);
  cap('N 個 process 時', '不能用剛剛傳遞 token 的簡單概念');
  await step(tok);                                   // 564 排隊：像郵局抽號碼牌
  const t0 = [1, 2, 3, 3, 4];
  remove(ask);
  ppl.forEach((b, i) => b.mood('happy'));
  nums = ppl.map((b, i) => bx('#' + t0[i], '#f3e6c8', -5 + i * 2.5, 1.55, 2.6, 0.8, 0.4, 0.4, 1.5));
  idx('號碼為示意', 5.6, 0.2, 3.6);
  cap('概念就是排隊：像去郵局抽號碼牌', '號碼小的先進去');
  await step(tok);                                   // 578 抽號碼本身好幾個 instruction → 可能一樣
  glow(nums[2], NOR); glow(nums[3], NOR);
  const same3 = note('P3、P4 都抽到 3（示意）', 1.2, 2.8, 2.6);
  cap('抽號碼牌本身有好幾個 instruction', '所以有可能抽到相同的數字');
  await step(tok);                                   // 595 tie breaker：unique 的 PID
  const byPid = good('一樣就比 PID（unique）：P3 先於 P4', 1.2, 3.5, 2.6);
  cap('tie breaker：用 PID', '每個 process / thread 的 ID 都是 unique');
  await step(tok);                                   // 628 solution 拆開看：num[i] 陣列
  gone(...ppl, ...nums, noTok, same3, byPid);
  cd = bakeryCode(-3.4, 6.4, -3.0, false);
  nums = [0, 1, 2, 3, 4].map((k) => { const m = bx('0', SC.mem, 0.6 + k * 1.3, 0.35, -0.6, 1.1, 0.7, 0.9); idx('num[' + k + ']', 0.6 + k * 1.3, 0, 0.3); return m; });
  cap('看似很長，拆開來看：num 是一個 array', '每格記錄第 i 個 process 抽到的號碼');
  await step(tok);                                   // 659 shared，但只有 Pi 寫 num[i]
  glow(nums[2], DIM);
  note('num[i] 只有 Pi 自己寫，其他人只讀 → 沒有 race', 3.2, 1.8, -0.6);
  cap('num 是 shared variable', '但 num[i] 只有 Pi 會寫，其他人只讀');
  await step(tok);                                   // 686 跟 flag 一樣，只有一個 writer
  idx('（Peterson 的 flag[i] 也是同樣道理）', 3.2, 2.5, -0.6);
  cap('就像剛剛的 flag[i]', '只有一個人 overwrite，其他人 read only');
  await step(tok);                                   // 696 抽號碼：max + 1
  cd.hl(1); glow(nums[2], null);
  [3, 5].forEach((v, k) => rl(nums[k], v));
  rl(nums[2], 6); glow(nums[2], OKG);
  idx('示意：P2 看到最大是 5 → 抽 6', 3.2, 3.2, -0.6);
  cap('抽號碼：看目前最大的號碼', '再加 1 → num[i] = max + 1');
  await step(tok);                                   // 714 max 看似一行，其實好幾個 instruction
  note('max 其實是一堆 if-else 比較 → 可能抽到一樣', -3.4, 1.0, -1.2);
  cap('max 看似一個 statement', '其實好幾個 instruction → 可能抽到一樣的號碼');
  await step(tok);                                   // 757 for loop 跟每個人比；0 = 沒抽 → 跳過
  cd.hl(3);
  glow(nums[3], DIM); glow(nums[4], DIM);
  idx('num = 0：沒抽，跳過', 5.8, 1.2, -0.6);
  cap('進去前用 for loop 跟每個人比', 'num 是 0 代表沒抽，直接跳過');
  await step(tok);                                   // 792 不是 0：先比號碼，再比 PID
  cd.hl(6);
  cap('不是 0 才比：先比號碼，再比 PID', '(num[j], j) < (num[i], i)');
  await step(tok);                                   // 819 對方比你小 → 卡在 while
  glow(nums[0], NOR); glow(nums[2], NOR);
  bad('P0 的 3 < P2 的 6 → P2 卡在 while（示意）', 3.2, 4.0, -0.6);
  cap('有人的 (號碼, PID) 比你小', '你就卡在這個 while loop');
  await step(tok);                                   // 848 first come first serve：小的先
  good('號碼越抽越大 → 小的先抽、先進：first come, first serve', 0, 7.0, -3.0);
  cap('號碼越小代表越早抽', '所以越先進去：first come, first serve');
  await step(tok);                                   // 896 break 所有 while → 進去；離開設 0
  cd.hl(9); rl(nums[2], 0); glow(nums[2], null); glow(nums[0], null);
  cap('break 所有人的 while 才能進去', '離開時 num[i] = 0：表示不要進去了');
}]);

FRAG.push(['syn-19a-choosing', 'Bakery 為什麼需要 choosing', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  const cd = bakeryCode(-3.4, 6.4, -3.0, false);
  const pi = pal('Pi', 'num 6', PCS[0], 1.4, 0, 1.2, 0.75), pj = pal('Pj', 'num 0', PCS[1], 4.6, 0, 1.2, 0.75);
  let sign;
  await step(tok);                                   // 930 多加了三行：choosing
  [0, 2, 4].forEach((k) => P.showL(cd.ls[k], true));
  cd.hl(0);
  cap('基本抽號碼牌之外', '又多加了三行：choosing');
  await step(tok);                                   // 934 像一個 lock：Pi 是不是在抽號碼
  hot('choosing[i]：像一個 lock', 3.0, 5.1, 1.2);
  cap('choosing 就像一個 lock', '告訴大家：process i 現在是不是在抽號碼牌');
  await step(tok);                                   // 944 抽之前 true、抽之後 false
  cd.hl(2);
  sign = note('我在抽號碼！', 4.6, 2.3, 1.2);
  cap('抽之前設成 true，抽之後設成 false', 'true 代表「我正在抽」');
  await step(tok);                                   // 956 比較之前，先檢查對方是不是在抽
  cd.hl(4);
  cap('跟任何一個 process 比較之前', '要先檢查他是不是正在抽號碼牌');
  await step(tok);                                   // 970 在抽 → 數字正在改變（現在 0，抽完不是）
  pj.set('num 0 → ?');
  cap('他在抽的話，數字正在改變', '現在或許是 0，抽完就不是 0 了');
  await step(tok);                                   // 988 太快比 → 他抽完跟你一樣（雖然比較晚抽）
  pj.set('num 6'); pj.mood('wow');
  bad('太早比：Pj 晚抽，卻抽到一樣的 6', 3.0, 3.0, 1.2);
  cap('你太快跟他比的話', '他雖然比你晚抽，可能抽到相同的數字');
  await step(tok);                                   // 1004 晚抽 + 一樣 + PID 比你小 → 完蛋
  bad('而且 PID 比你小 → 其實他該先進！', 3.0, 3.7, 1.2);
  cap('晚抽、數字一樣、PID 又比你小', '其實他才該先執行 → 你就完蛋了');
  await step(tok);                                   // 1023 等他抽完、數字穩定才比
  good('等他抽完、數字 stable 了才比', 3.0, 4.4, 1.2);
  cap('choosing 的目的：他正在抽時就等', '等數字穩定了才跟他比');
  await step(tok);                                   // 1048 while loop 等 choosing[j] 變 false
  remove(sign); cd.hl(6); pj.mood('calm');
  cap('用一個 while loop 等 Pj 抽完', '它設回 false，就能跟它真正的數字比');
  await step(tok);                                   // 1084 正確性：mutual exclusion
  hd('ME：一次只有 (num, PID) 最小的人進去', 0, 7.2, -3.0);
  cap('證明：一定符合 mutual exclusion', '號碼加上 PID 是 unique，最小的只有一個');
  await step(tok);                                   // 1102 bounded waiting：first come first serve
  hd('BW：first come, first serve', -2.6, 0.2, 3.4);
  cap('也符合 bounded waiting', 'first come, first serve 的演算法一定符合');
  await step(tok);                                   // 1112 progress：最小的人一定能 break
  hd('progress：最小的人一定能 break', 2.8, 0.2, 3.4);
  pi.mood('happy'); glow(pi.body, OKG);
  cap('progress 也沒問題', '目前最小的那個人一定能 break 兩個 while loop');
}]);

FRAG.push(['syn-19a-p1p4', '例子：沒有 choosing → P1、P4 都抽到 6 都進去', async (tok) => {
  csCam();
  let V;
  await step(tok);                                   // 1132 為什麼一定要 choosing：具體例子
  V = csView('bakeryNo');
  hd('沒有 choosing（錯誤版）', 0, 7.4, -3.4);
  cap('具體的例子：為什麼一定要 choosing', '先看沒有 choosing 的版本');
  await step(tok);                                   // 1143 目前最大的號碼是 5
  const max5 = note('目前最大的 number = 5', 0, 3.4, 2.4);
  cap('假設現在最大的號碼是 5', '');
  await step(tok);                                   // 1153 P1、P4 要進 CS；PID 小的 P1 優先
  cap('P1、P4 正要進 critical section', 'PID 1 比較小 → P1 有比較高的 priority');
  await step(tok);                                   // 1169 抽之前都是 0；P1 先讀到 max = 5
  V.step(0);
  idx('P1 讀到 max = 5，還沒寫回就被切走', -4.4, 3.6, 0.8);
  cap('抽之前兩個都是 0', 'P1 讀了 max = 5，還沒寫回就被 context switch');
  await step(tok);                                   // 1174 P4 先抽完：6
  await runCS(tok, V, [1, 1], 600);
  cap('P4 先把號碼抽完', 'num[4] = 6');
  await step(tok);                                   // 1181 P4 檢查：P1 是 0 → 不管它 → 進去
  V.step(1);
  cap('P4 進 while 檢查：P1 的值是 0', '當作沒抽，不管它 → 進 critical section');
  await step(tok);                                   // 1191 P1 這時才抽完：也是 6
  V.step(0);
  cap('P1 這時才把號碼抽完', '一抽完：我也是 6！');
  await step(tok);                                   // 1198 6 跟 6，P1 的 PID 小 → 也進去
  V.step(0);
  cap('兩個都是 6，用 PID 當 tie breaker', 'P1 的 PID 比較小 → P1 也進 critical section');
  await step(tok);                                   // 1209 mutual exclusion 被 violate
  remove(max5);
  bad('兩個都在 critical section → ME 被 violate', 0, 3.4, 1.2);
  cap('mutual exclusion 被 violate', '兩個人都進去了');
  await step(tok);                                   // 1223 synchronization 難寫、難驗證
  note('每個 instruction 都可能 context switch；N 個人的組合無止境', 0, 4.4, 1.2);
  cap('synchronization 不好寫、不好驗證', '每個 instruction 都可能被切，組合無止境');
  await step(tok);                                   // 1246 有 locking：P4 會被擋住
  csCam();
  V = csView('bakery');
  hd('有 choosing（正確版）', 0, 7.4, -3.4);
  await runCS(tok, V, [0, 0, 1, 1, 1, 1, 1], 300);
  cap('有 choosing：P1 抽到一半被切走', 'P4 抽完 6，卻卡在 while (choosing[1])');
  await step(tok);                                   // 1251 P4 等 P1 抽完：都是 6 → P4 被擋
  await runCS(tok, V, [0, 0, 1, 1], 450);
  cap('P1 抽完也是 6、choosing 放下', 'P4 比較：(6,1) < (6,4) → P4 被擋住');
  await step(tok);                                   // 1258 P1 才是正確的選擇
  await runCS(tok, V, [0, 0], 500);
  good('P1 先進去：正確！', 0, 3.4, 1.2);
  cap('P1 比較後 break while → 進去', 'PID 小的 P1 先，這才是正確的演算法');
}]);

// ════════ 48K3qS2531o（第 20D 講）：classical problems、bounded buffer、readers-writers、dining philosophers、monitor 概念 ════════
FRAG.push(['syn-20d-classic', 'Classical synchronization problems：三個經典問題', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let tools = [];
  await step(tok);                                   // 2 介紹完 critical section、semaphore
  tools = ['critical section', 'semaphore'].map((t, k) => bx(t, [SC.cs, PCS[0]][k], -4.6 + k * 3.0, 0.3, -3.0, 2.6, 0.5, 0.8, 1.5));
  cap('介紹完 critical section、semaphore', '');
  await step(tok);                                   // 21 最後一個：monitor，更 high level
  tools.push(bx('monitor', PCS[3], 1.4, 0.3, -3.0, 2.6, 0.5, 0.8, 1.5));
  const hiL = idx('更 high level', 1.4, 1.0, -3.0);
  cap('最後一個工具叫 monitor', '更 high level；介紹前先看一些經典問題');
  await step(tok);                                   // 46 各式各樣的 synchronization 問題 → classical problems
  hd('classical synchronization problems', 0, 6.0);
  cap('synchronization 的問題各式各樣', '於是定義了一些 classical problems');
  await step(tok);                                   // 64 系統裡的問題都可以 reduce 成這幾個
  note('電腦系統裡的問題，都可以 reduce 成這幾個', 0, 5.2);
  cap('非常著名：系統裡的問題', '都可以 reduce 成這幾個問題');
  await step(tok);                                   // 91 目的：驗證你的 synchronization 是否正確
  const chk = good('用它們檢驗：你的 solution 真的對嗎？', 2.4, 2.6, -3.0);
  cap('最主要的目的：驗證你寫的 synchronization', '能不能解決這些常見的問題');
  await step(tok);                                   // 111 最常見三個：bounded buffer
  gone(...tools, hiL, chk);
  zone('① bounded buffer', -4.6, 0.02, 0.6, 3.6, 3.0, '#f3e6c8');
  [0, 1, 2].forEach((k) => bx(k + 1, '#2fc092', -5.6 + k * 1.0, 0.3, 0.6, 0.8, 0.5, 0.8, 1.5));
  cap('最常見的三個：第一個 bounded buffer', '就是之前的 producer–consumer');
  await step(tok);                                   // 136 reader-writer：檔案操作
  zone('② readers-writers', 0, 0.02, 0.6, 3.6, 3.0, '#d6e6f6');
  prop('file', 0, 0, 0.2, 1.0);
  const r = pal('R', '', PCS[2], -1.0, 0, 1.6, 0.5), w = pal('W', '', PCS[1], 1.0, 0, 1.6, 0.5);
  cap('第二個 readers-writers', '檔案操作常碰到：read 或 write');
  await step(tok);                                   // 159 兩個人同時 write → 不行
  bad('兩個 writer 同時寫 ✗', 0, 2.4, 0.6);
  cap('兩個人同時 write 一個檔案', '不知道結果是什麼 → 不可以');
  await step(tok);                                   // 176 reader 可以同時開
  good('reader 可以同時讀 ✓', 0, 3.0, 0.6);
  r.mood('happy');
  cap('read only 的話大家都可以同時開', '內容不會改，data 是一致的');
  await step(tok);                                   // 196 dining philosophers
  zone('③ dining philosophers', 4.6, 0.02, 0.6, 3.6, 3.0, '#d8e6cf');
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 28), new THREE.MeshStandardMaterial({ color: '#e3d3b6' })); tb.position.set(4.6, 0.1, 0.6); lab.world.add(tb);
  cap('最後一個更有趣：dining philosophers', '會用 monitor 的 solution 去解');
  await step(tok);                                   // 216 五個人、五根筷子放在人與人之間
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, b = ((k + 0.5) / 5) * Math.PI * 2; bx('', PCS[k], 4.6 + Math.sin(a) * 1.4, 0.25, 0.6 + Math.cos(a) * 1.4, 0.4, 0.5, 0.4); const c = bx('', '#8a5a2b', 4.6 + Math.sin(b) * 0.8, 0.3, 0.6 + Math.cos(b) * 0.8, 0.1, 0.1, 0.6); c.rotation.y = b; }
  cap('五個人只給五根筷子', '放在人跟人之間；左右兩支都拿到才能吃');
  await step(tok);                                   // 227 大家只拿左邊 → 都不能吃
  bad('大家都只拿左邊 → 都不能吃', 4.6, 2.6, 0.6);
  cap('如果大家都只拿起左手邊的筷子', '其實大家都不能用餐');
  await step(tok);                                   // 237 怎麼模擬才不會卡住（deadlock）
  note('怎麼拿才不會 deadlock？→ monitor', 4.6, 3.4, 0.6);
  cap('每個人要用什麼方式拿', '才不會卡住、不會 deadlock');
  void w;
}]);

FRAG.push(['syn-20d-bb', 'Bounded-buffer：大小固定的 producer–consumer', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const N = 5, xs = Array.from({ length: N }, (_, k) => -2.4 + k * 1.2);
  let pr, co, its = [];
  await step(tok);                                   // 253 之前講過
  xs.forEach((x, k) => { ctx.tile(V3(x, 0.04, 0), 1.05, 1.05); idx('[' + k + ']', x, 0, 0.8); });
  pr = pal('producer', '', PCS[0], -5.4, 0, 0.4, 0.7); co = pal('consumer', '', PCS[1], 5.4, 0, 0.4, 0.7);
  cap('之前講過的 bounded buffer', '大家應該很熟');
  await step(tok);                                   // 260 buffer size 固定、limited
  hd('buffer size 固定（limited）', 0, 2.4);
  idx('5 格為示意', 0, 0, 1.6);
  cap('有一個固定大小的 buffer', 'size 是 limited');
  await step(tok);                                   // 267 空的時候 consumer 要等
  co.mood('sad'); bad('空 → consumer 等', 5.4, 2.2, 0.4);
  cap('一個 producer、一個 consumer', '空的時候 consumer 要等');
  await step(tok);                                   // 271 滿的時候 producer 要等
  for (let k = 0; k < N; k++) its.push(bx(k + 1, '#2fc092', xs[k], 0.35, 0, 0.85, 0.6, 0.85, 2));
  co.mood('calm'); pr.mood('sad');
  bad('滿 → producer 等', -5.4, 2.2, 0.4);
  cap('滿的時候 producer 要等', '這就是 bounded buffer problem');
  await step(tok);                                   // 277 檢視 critical section 的好例子
  good('檢視 critical section 怎麼運作的好例子', 0, 3.2);
  cap('很好的例子', '可以檢視 critical section 到底該怎麼運作');
  await step(tok);                                   // 283 真實系統：compiler → linker → loader
  gone(...its);
  const st = ['compiler', 'linker', 'loader'].map((t, k) => bx(t, [PCS[0], PCS[3], PCS[2]][k], -4.4 + k * 4.4, 0.35, -2.6, 2.2, 0.6, 0.9, 1.5));
  arr(-3.2, 0.5, -1.2, 0.5, '#8a7a5c', -2.6); arr(1.2, 0.5, 3.2, 0.5, '#8a7a5c', -2.6);
  idx('buffer', -2.2, 1.0, -2.6); idx('buffer', 2.2, 1.0, -2.6);
  cap('真實系統很多：compiler 的 output 給 linker', 'linker 再給 loader，中間都有 buffer');
  await step(tok);                                   // 298 I/O 系統每層之間都有 buffer
  note('I/O 系統：每個 layer 之間都有 I/O buffer', 0, 4.0, -1);
  cap('整個 I/O 系統也是', '每一個 layer 之間都有 buffer 在做 buffering');
  void st;
}]);

FRAG.push(['syn-20d-rw', 'Readers-writers 問題：first / second 的要求', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const F = prop('file', 0, 0, -0.6, 1.3);
  let rs = [], ws = [], seg;
  await step(tok);                                   // 309 第二個：reader writer
  hd('Readers-writers problem', 0, 6.2);
  cap('第二個經典問題：readers-writers', '');
  await step(tok);                                   // 315 data access：reader process、writer process
  rs = [0, 1].map((k) => pal('R' + (k + 1), '', PCS[2 + k], -5.2 + k * 1.3, 0, 1.6, 0.6));
  ws = [0, 1].map((k) => pal('W' + (k + 1), '', PCS[k ? 4 : 1], 4.0 + k * 1.3, 0, 1.6, 0.6));
  idx('read only', -4.6, 1.5, 1.6); idx('update content', 4.6, 1.5, 1.6);
  cap('file system、storage system 都會碰到', 'reader 只讀；writer 會 update content');
  await step(tok);                                   // 332 writer 一次只能一個
  await slide(tok, ws[0].g, 0.9, 0, 0.6, 700); glow(ws[0].body, OKG);
  cap('為了資料一致', 'writer 一次只能一個去操作這個 file');
  await step(tok);                                   // 340 writer 在寫時，其他人都不能碰
  ws[1].mood('sad'); rs.forEach((r) => r.mood('sad'));
  const wOnly = bad('writer 在寫：其他 reader、writer 都不能碰', 0, 2.6, 0.6);
  cap('一個 writer 在 access 時', '其他 reader、writer 都不能 touch 這個 file');
  await step(tok);                                   // 353 全部是 reader 可以同時讀
  remove(wOnly);
  await slide(tok, ws[0].g, 4.0, 0, 1.6, 600); glow(ws[0].body, null);
  await slide(tok, rs[0].g, -1.0, 0, 0.6, 500); await slide(tok, rs[1].g, -1.0, 0, -1.8, 500);
  rs.forEach((r) => { r.mood('happy'); glow(r.body, OKG); });
  good('全部都是 reader → 可以同時 access', -3.6, 2.6, 0.6);
  cap('全部都是 reader 的話', 'read only，可以同時 access');
  await step(tok);                                   // 365 又分成好幾個 version
  const vers = ['first RW', 'second RW', 'third RW'].map((t, k) => bx(t, ['#d6e6f6', '#c8d8f0', '#b9cae6'][k], 0.6 + k * 2.4, 0.3, -3.4, 2.0, 0.5, 0.7));
  cap('readers-writers 又分好幾個 version', '從最簡單到要求最高、最複雜');
  await step(tok);                                   // 378 first RW：minimum，writer exclusive 就好
  glow(vers[0], DIM);
  const n1 = note('first：只要保證 writer 有 exclusive access', 0.6, 1.2, -3.4);
  cap('最簡單的 first readers-writers', '要求很單純：writer 用的時候有 exclusive access');
  await step(tok);                                   // 407 不在乎 reader 等多久
  const i1 = idx('reader 等多久？不管', 0.6, 1.8, -3.4);
  cap('不 care reader 要等多久', '只要 writer 有 exclusive write 就好');
  await step(tok);                                   // 419 second RW：比較符合真實需求
  glow(vers[0], null); glow(vers[1], DIM); remove(n1); remove(i1);
  cap('複雜一點、比較符合使用情境的', 'second readers-writers');
  await step(tok);                                   // 430 老師先說「reader priority 要高」
  const slip = bub('「reader 不能 starvation」？', 3.0, 1.4, -3.4);
  cap('它多一個條件……', '老師這裡先講成 reader，馬上更正');
  await step(tok);                                   // 464 更正：writer 要比較高的 priority
  tx(slip, '更正：writer 要比較高的 priority');
  slip.element.className = 'lab-label good';
  cap('「我講反了，對不起」', 'second RW：writer 要比較高的 priority');
  await step(tok);                                   // 470 第一個 solution：reader 把 lock 傳給下一個 reader
  gone(...vers, slip);
  rs.forEach((r) => glow(r.body, null));
  await slide(tok, rs[1].g, -5.2 + 1.3, 0, 1.6, 500);
  const x0 = -5.2, sx = 0.38;
  seg = timeline(x0, sx, [['R', -3.0], ['W', -2.0]]);
  seg(0, 10, -3.0, PCS[2], 'R1 讀 10 秒');
  cap('first RW 的 solution：reader 可以同時讀', '拿到 lock 的 reader 可以把 lock pass 給下一個 reader');
  await step(tok);                                   // 498 writer 很早就來（第 2 秒）
  const wt2 = bx('W 第 2 秒到', '#fde8e6', x0 + 2 * sx + 0.6, 0.3, -2.0, 1.6, 0.5, 0.7, 1.2);
  idx('（課堂例子：10 秒、第 2 秒、第 8 秒）', 0, 4.8, -3.0);
  cap('writer 其實很早就來了（第 2 秒）', '只比第一個 reader 慢');
  await step(tok);                                   // 517 第 8 秒第二個 reader 來 → token 給它，又 hold 10 秒
  seg(8, 18, -3.0, PCS[3], 'R2：第 8 秒來，讀 10 秒');
  cap('第 8 秒第二個 reader 來了', 'lock 交給它，它又 hold 10 秒，一直傳下去');
  await step(tok);                                   // 524 writer 永遠拿不到 lock → starvation
  kill(wt2); seg(2, 18, -2.0, '#d64545', 'W 一直等…');
  ws[0].mood('sad'); glow(ws[0].body, NOR);
  bad('writer starvation', 4.0, 2.6, 1.6);
  cap('第 2 秒來的 writer', '可能永遠拿不到 lock → starvation');
  await step(tok);                                   // 535 second RW：writer ready 後，第一個 reader 做完就換 writer
  hd('second RW：writer ready 了 → 下一個就換它', 0, 6.9);
  cap('second RW：writer ready 了', '第一個 reader 做完就要換 writer');
  await step(tok);                                   // 549 比 writer 晚來的 reader 不能優先
  note('比 writer 晚來的 reader 不能插隊', 0, 4.4, -1.2);
  cap('比 writer 晚來的 reader', '不能優先執行，不然 writer 被插隊 → starvation');
  await step(tok);                                   // 568 還有 third RW
  idx('還有 third RW，要求更多（可自己 Google）', 0, 5.4, -1.2);
  cap('其實還有 third readers-writers', '要求更多，有興趣自己查');
  void F;
}]);

FRAG.push(['syn-20d-rwsol', 'First readers-writers 的 semaphore 解法', async (tok) => {
  fresh([0, 7, 13], [0, 2.4, 0]);
  const RL = ['wait(mutex);', 'readcount++;', 'if (readcount == 1) wait(wrt);', 'signal(mutex);', '  … reading …', 'wait(mutex);', 'readcount--;', 'if (readcount == 0) signal(wrt);', 'signal(mutex);'];
  let rd, wr, vals = { wrt: 1, readcount: 0, mutex: 1 }, vc = {}, rs = [], W;
  const upd = () => Object.keys(vc).forEach((k) => rl(vc[k], k + ' = ' + vals[k]));
  const mk = (k, x) => { vc[k] = bx(k + ' = ' + vals[k], SC.mem, x, 0.3, -0.4, 2.4, 0.6, 1.0, 1.5); };
  await step(tok);                                   // 583 看 first RW 的 solution
  hd('First readers-writers（semaphore 版）', 0, 7.3, -3);
  cap('課堂上看 first readers-writers 的 solution', 'second 的強烈建議自己去看');
  await step(tok);                                   // 602 用 counting：數有多少 reader
  mk('readcount', 0);
  cap('用 semaphore、counting 的概念', '要數到底有多少 reader 正在 access');
  await step(tok);                                   // 614 有 reader 就代表 lock 在 reader 這邊
  note('readcount ≥ 1 → lock 在 reader 這邊', 0, 1.3, -0.4);
  cap('只要還有 reader', 'lock 就還在 reader 這邊');
  await step(tok);                                   // 628 沒有 reader 時 lock 才能 release
  idx('readcount = 0 才能 release lock', 0, 1.9, -0.4);
  cap('只有在沒有 reader 的時候', 'lock 才可以被 release');
  await step(tok);                                   // 645 writer：exclusive access
  wr = code(['wait(wrt);', '  … writing …', 'signal(wrt);'], 4.6, 6.2, 0.5, -3); hot('writer', 4.6, 6.8, -3);
  cap('先看 writer', 'writer 是 exclusive 的 access');
  await step(tok);                                   // 661 wrt：binary semaphore，像 mutex
  mk('wrt', 3.2);
  cap('有一個 write lock：wrt', 'binary semaphore（0 跟 1），當 mutex 用');
  await step(tok);                                   // 682 access 前 wait、之後 signal
  wr.hl(0);
  cap('access 之前 wait、之後 signal', '包成一個 critical section');
  await step(tok);                                   // 692 reader：可以 share 這個 lock
  rd = code(RL, -3.8, 6.2, 0.5, -3); hd('reader', -3.8, 6.8, -3); wr.hl(-1);
  [0, 3, 5, 8].forEach((k) => P.showL(rd.ls[k], false));
  cap('reader 類似，但不一樣', 'reader 可以 share 這個 lock');
  await step(tok);                                   // 706 readcount++
  rd.hl(1); vals.readcount = 1; upd();
  rs.push(pal('R1', '', PCS[2], -1.6, 0, 2.6, 0.6));
  cap('reader 想讀的時候：readcount++', '知道目前有幾個人在讀');
  await step(tok);                                   // 715 readcount == 1 → 第一個 reader → wait(wrt)
  rd.hl(2); vals.wrt = 0; upd(); glow(rs[0].body, OKG);
  cap('readcount == 1：你是第一個 reader', '要去跟 writer 競爭 write lock：wait(wrt)');
  await step(tok);                                   // 736 ≠ 1 → 跳過（有人幫你拿了 lock）
  rs.push(pal('R2', '', PCS[3], -0.4, 0, 2.6, 0.6)); vals.readcount = 2; upd(); glow(rs[1].body, OKG);
  rd.hl(2);
  const rc2 = note('readcount = 2 ≠ 1 → 不再 wait（lock 已經有人拿了）', 0, 0, 3.8);
  cap('R2：readcount 不等於 1', '已經有 reader 拿到 lock，不要再 wait');
  await step(tok);                                   // 766 讀完 readcount--
  rd.hl(6); vals.readcount = 1; upd(); kill(rs[0].g); remove(rc2);
  cap('讀完之後回來：readcount--', 'R1 離開，readcount = 1');
  await step(tok);                                   // 773 == 0 → 最後一個 → signal(wrt)
  rd.hl(7); vals.readcount = 0; vals.wrt = 1; upd(); kill(rs[1].g);
  W = pal('W', '', PCS[1], 3.0, 0, 2.6, 0.6); W.mood('happy');
  cap('R2 離開：readcount 減成 0 → 最後一個', 'signal(wrt) release lock，writer 才有機會');
  await step(tok);                                   // 783 不是最後一個 → 不用 signal
  idx('（R1 離開時 readcount = 1，不是最後一個 → 跳過）', -1.4, 0.2, 3.6);
  cap('不是最後一個就不用 signal', 'lock 要保留在 reader 這一群裡');
  await step(tok);                                   // 799 by group：第一個拿、最後一個放
  good('第一個 reader 拿 lock、最後一個 reader 放 lock（by group）', 0, 1.2, 3.6);
  cap('只要數：是不是第一個 reader', '是不是最後一個離開的 → by group');
  await step(tok);                                   // 811 還沒完全正確：readcount 本身是 shared
  glow(vc.readcount, NOR);
  bad('readcount 本身也是 shared variable！', 0, 1.3, -0.4);
  cap('程式還沒完全正確', 'readcount 是 readers 之間共享的 variable');
  await step(tok);                                   // 830 再用一個 semaphore（mutex）保護
  mk('mutex', -3.2);
  cap('所有 reader 都可能同時 readcount++', '再用一個 semaphore（叫 mutex）保護它');
  await step(tok);                                   // 861 包起來：readcount++ 連同 if
  [0, 3, 5, 8].forEach((k) => P.showL(rd.ls[k], true));
  rd.hl(0); glow(vc.readcount, null);
  cap('把 readcount++ 包起來', '連 if 一起包：操作完要立刻檢查');
  await step(tok);                                   // 889 檢查哪裡會 race；不相關的用不同 lock
  note('有關聯的 data 用同一個 lock；沒關聯的用不同的 lock', 0, 4.0, -1.6);
  cap('有了框架再檢查哪裡會 race', '不是只能用一個 mutex，看 data 有沒有關聯');
  await step(tok);                                   // 925 shared data 與 readcount 不同 → 不同 lock
  glow(vc.wrt, DIM); glow(vc.mutex, DIM);
  idx('wrt 保護檔案；mutex 保護 readcount', 0, 0, 0.8);
  cap('writer 的 shared data 跟 readcount 不同', '所以用不同的 lock；全寫在一起會錯或沒效率');
  await step(tok);                                   // 963 writer exclusive、reader sharing
  rd.hl(-1); glow(vc.wrt, null); glow(vc.mutex, null);
  good('writer：exclusive　reader：sharing', 3.6, 1.2, 3.6);
  cap('這就是 first RW 的 solution', 'writer 有 exclusive right，reader 可以 sharing');
  await step(tok);                                   // 975 問題：writer starvation
  W.mood('sad'); glow(W.body, NOR);
  bad('reader 一直把 lock 傳下去 → writer starvation', 0, 2.0, 3.6);
  cap('問題：writer 會 starvation', '後來的 reader 一直插隊');
  await step(tok);                                   // 997 second RW 的 solution 自己查
  note('second RW 的 solution 更短：自己 Google、想想為什麼對', 0, 4.8, -1.6);
  cap('要解 starvation → second RW 的 solution', '強力建議自己查，想想為什麼它是對的');
}]);

FRAG.push(['syn-20d-dining', 'Dining philosophers：大家先拿左邊 → deadlock', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0]);
  let V;
  await step(tok);                                   // 1026 最後一個：dining philosophers
  V = dpView();
  cap('最後一個 classic 問題：dining philosophers', '用餐、用筷子的問題');
  await step(tok);                                   // 1040 筷子數量跟人一樣，放在人之間
  cap('筷子的數量跟人一樣多', '每根筷子放在兩個人之間');
  await step(tok);                                   // 1049 要拿左右兩支才能吃
  dpAct(V, 0, 'naive'); dpAct(V, 0, 'naive'); V.update();
  cap('用餐時要把左邊跟右邊的筷子都拿起來', '哲0 拿到兩支，開始吃');
  await step(tok);                                   // 1055 吃完放回去
  dpAct(V, 0, 'naive'); V.update();
  cap('吃完之後把筷子放回去', '');
  await step(tok);                                   // 1060 每支筷子是獨立的 resource
  cap('每支筷子都是獨立的 resource', '一次只能拿一支');
  await step(tok);                                   // 1069 不能 magically 一次拿兩支
  const magic = bub('不能 magically 一次拿兩支', 0, 0, 4.4);
  cap('不能寫一個 function', 'magically 一次把左右兩支一起拿起來');
  await step(tok);                                   // 1078 需要 multiple resource 很常見
  cap('實際上很常需要 multiple resource', '又要左邊、又要右邊 → 就像這個問題');
  await step(tok);                                   // 1094 寫不好 → deadlock：大家先拿左邊
  for (let i = 0; i < DPN; i++) dpAct(V, i, 'naive');
  V.update();
  cap('寫得不好就會 deadlock', '所有人都先拿左邊的筷子');
  await step(tok);                                   // 1101 再拿右邊 → 全部卡住
  for (let i = 0; i < DPN; i++) dpAct(V, i, 'naive');
  V.update();
  cap('再拿右邊時：全部卡住', '每個人都拿著一支、等下一支');
  await step(tok);                                   // 1106 deadlock 再造成 starvation
  bad('deadlock → starvation', 0, 0, -4.4);
  cap('deadlock 再造成 starvation', '使用者就會認為這是錯誤的程式');
  await step(tok);                                   // 1122 solution 要靠 monitor
  remove(magic);
  note('解法：monitor（下次再講）', 0, 0, 4.4);
  cap('solution 複雜一些', '要透過 monitor 的機制');
}]);

FRAG.push(['syn-20d-monitor', 'Monitor 的概念：一次只有一個 thread 在裡面', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  let box, vars, ms = [], th = [];
  await step(tok);                                   // 1142 為什麼要 monitor
  hd('為什麼要 monitor？', 0, 6.2);
  cap('為什麼要 monitor？', '');
  await step(tok);                                   // 1144 semaphore / mutex / CS：自己 call wait、signal
  const sl = code(['wait(S);', 'wait(Q);', '  …', 'signal(Q);', 'signal(S);'], -4.2, 5.0, 0.5, -2.4);
  cap('用 semaphore、mutex lock、critical section', '都要自己在那邊 call signal 跟 wait');
  await step(tok);                                   // 1154 順序寫錯 → deadlock
  sl.hl(1);
  bad('順序不小心寫錯 → deadlock', -4.2, 2.0, -2.4);
  cap('一堆 signal 跟 wait', '順序不小心寫錯，就 deadlock 了');
  await step(tok);                                   // 1159 很 low level 的工具
  idx('low-level tool', -4.2, 5.7, -2.4);
  cap('它們是非常 low level 的 synchronization tool', '很容易因為 programming 的問題卡住');
  await step(tok);                                   // 1170 monitor：high-level language construct，OO 的概念
  sl.kill();
  box = room(1.0, 1.1, -0.6, 6.2, 2.2, 3.2, '#9b7ef4');
  tag('monitor', 'ptr', 1.0, 2.6, -0.6);
  cap('monitor：high-level language 的 construct', '說真的，就是 OO 的概念');
  await step(tok);                                   // 1181 把 resource 想成 OO：class、object
  idx('class → object', 1.0, 3.2, -0.6);
  cap('把要保護的 resource 想成 OO', '分 class、object');
  await step(tok);                                   // 1195 monitor = 特殊 class 產生的 object
  note('monitor = 特殊的 class 產生的 object', 1.0, 4.0, -0.6);
  cap('一個 monitor', '就是一個特殊的 class 所產生的 object');
  await step(tok);                                   // 1200 要保護的變數 = local variable
  vars = bx('local variable（會 race 的變數）', SC.mem, -1.2, 0.3, -1.6, 2.6, 0.6, 1.0, 2);
  cap('要保護的、會 race condition 的變數', '就是這個 object 裡面的 local variable');
  await step(tok);                                   // 1208 操作它的是 method；外面只能透過 method
  ms = ['method A()', 'method B()', 'method C()'].map((n, k) => bx(n, '#4b9ee2', 3.0, 0.25, -1.6 + k * 1.0, 1.8, 0.5, 0.8, 2));
  cap('操作這些變數的就是 class 的 method', '要 touch 它，一定要 go through 這些 method');
  await step(tok);                                   // 1222 跟一般 OO 差在哪？
  cap('跟一般的 OO 差在哪？', '很小、但很重要的一點');
  await step(tok);                                   // 1229 一般 OO：很多 thread 同時 call → 同時執行
  th = [0, 1, 2].map((k) => pal('T' + k, '', PCS[k], -5.6 + k * 1.1, 0, 2.6, 0.55));
  th.forEach((t) => t.mood('wow'));
  bad('一般 OO：同時執行 → race condition', -4.4, 2.2, 2.6);
  cap('一般 OO 的 method 可以很多 thread 同時 call', '同時執行就會 race condition');
  await step(tok);                                   // 1241 monitor：一次只有一個 method 執行
  await slide(tok, th[0].g, 1.0, 0, 0.4, 800); glow(th[0].body, OKG); th[0].mood('happy');
  [1, 2].forEach((k) => glow(th[k].body, '#6a4a00'));
  hot('一次只有一個 method 可以執行', 1.0, 5.0, -0.6);
  cap('monitor 的 method 多一個條件', '一次只有一個 method 可以執行');
  await step(tok);                                   // 1252 language level 保護 → mutual exclusion
  kill(th[0].g); await slide(tok, th[1].g, 1.0, 0, 0.4, 700); glow(th[1].body, OKG); th[1].mood('happy');
  cap('很多 thread 同時 call 也沒關係', 'language level 保證一次只有一個在執行：mutual exclusion');
  await step(tok);                                   // 1272 為什麼容易：只要定義 behavior
  good('只要定義：保護哪些變數、有哪些操作', 1.0, 4.4, 2.4);
  cap('為什麼容易得多？', '只要想哪些變數要保護、有哪些操作');
  await step(tok);                                   // 1289 by default method 不能同時執行 → 不會有 CS 問題
  idx('by default 不能同時執行 → 永遠不會有 critical section 問題', 1.0, 3.6, 2.4);
  cap('by default，method 之間不能同時執行', '所以永遠不會產生 critical section 的問題');
  await step(tok);                                   // 1304 thread 呼叫 method 操作 program state
  kill(th[1].g); await slide(tok, th[2].g, 1.0, 0, 0.4, 700); glow(th[2].body, OKG); th[2].mood('happy');
  cap('那些 thread 去 call 這些 method', '操作整個 program 的 state，就不會有問題');
  void box; void vars; void ms;
}]);

// ════════ HUA_cVBdLw0（Semaphores in Operating Systems）：wait / signal、counting、排順序、block / wakeup ════════
// a semaphore stage: S on a pedestal, a critical-section room on the right, a waiting row in front
function semStage(init, waitName, o = {}) {
  const st = { S: init, cs: [], wait: [] };
  const sc = bx((o.name || 'S') + ' = ' + init, SC.mem, o.sx ?? -0.6, 0.45, -2.4, 2.2, 0.9, 1.2);
  room(3.8, 0.8, -0.2, 3.8, 1.6, 2.2); idx('critical section', 3.8, 1.8, -0.2);
  const wz = zone(waitName, -3.2, 0.02, 2.8, 6.4, 1.6, o.block ? '#dfe3f3' : '#f6e2d6');
  wz.userData.name.position.z = 2.8 + 0.8 + 0.35;   // name in front of the row, not behind the buddies' names
  const setS = (v) => { st.S = v; rl(sc, (o.name || 'S') + ' = ' + v); glow(sc, v < 0 ? NOR : DIM); };
  const csPos = (k) => [2.6 + k * 1.15, 0, -0.2];
  const wPos = (k) => [-5.6 + k * 1.15, 0, 2.8];
  async function toCS(tok, b, ms = 700) {
    const used = new Set(st.cs.map((c) => c.slot)); let k = 0; while (used.has(k)) k++; b.slot = k; st.cs.push(b);
    const [x, y, z] = csPos(k);
    await slide(tok, b.g, x, y, z + 1.3, ms * 0.65); await slide(tok, b.g, x, y, z, ms * 0.35);   // pass in front of the others
    glow(b.body, OKG); b.mood('happy');
  }
  async function toWait(tok, b, ms = 700) { const k = st.wait.length; st.wait.push(b); const [x, y, z] = wPos(k); await slide(tok, b.g, x, y, z, ms); glow(b.body, o.block ? '#1a2a5a' : NOR); b.mood(o.block ? 'calm' : 'wow'); if (o.block) sleepy(b, true); }
  async function out(tok, b, ms = 700) { st.cs = st.cs.filter((x) => x !== b); glow(b.body, null); b.mood('calm'); await slide(tok, b.g, 6.4, 0, 2.8, ms); kill(b.g); }
  async function fromWait(tok, b, ms = 700) { st.wait = st.wait.filter((x) => x !== b); if (o.block) sleepy(b, false); await toCS(tok, b, ms); }
  return { st, sc, setS, toCS, toWait, out, fromWait };
}
// waiting buddies "spin": a little shake that shows they are busy doing nothing
async function spin(tok, bs, ms = 900) { const x0 = bs.map((b) => b.g.position.x); await anim(tok, ms, (u) => bs.forEach((b, i) => { b.g.rotation.y = Math.sin(u * Math.PI * 4) * 0.5; b.g.position.x = x0[i]; })); bs.forEach((b) => { b.g.rotation.y = 0; }); }

FRAG.push(['syn-sem-intro', 'Semaphore：wait / signal（busy waiting 版）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M, cd, p1, p2;
  await step(tok);                                   // 0 另一個 tool：semaphore
  hd('Semaphore：另一個 synchronization tool', 0, 6.4);
  cap('另一個工具：semaphore', '');
  await step(tok);                                   // 3 名字來自鐵路的號誌
  const sig = bx('', '#d64545', -5.6, 1.8, -2.6, 0.5, 0.5, 0.5); bx('', '#6b5a45', -5.6, 0.8, -2.6, 0.15, 1.6, 0.15);
  const rwy = idx('railway semaphore（號誌）', -5.6, 2.5, -2.6);
  cap('名字來自鐵路的號誌（signal）', '借用到我們這裡');
  await step(tok);                                   // 11 兩個 function call：wait、signal
  remove(rwy);
  cd = code(['wait(S) {', '  while (S <= 0) ;  // 等', '  S--;', '}', 'signal(S) {', '  S++;', '}'], -3.6, 5.4, 0.5, -2.8);
  cap('semaphore 用兩個 function call', '一個叫 wait，一個叫 signal');
  await step(tok);                                   // 16 wait 在 entry、signal 在 exit；也叫 P、V
  const pv = idx('entry section → wait　　exit section → signal（又叫 P、V）', 0, 1.6, -3.4);
  cap('wait 用在 entry section', 'signal 用在 exit section；也叫 P 和 V');
  await step(tok);                                   // 26 不用 lock，定義一個變數 S（資源數）
  M = semStage(1, '等待（在 while 迴圈裡一直轉）', { sx: 1.4 });
  cap('不用 lock，改定義一個變數 S', '初值可以不同：例如 1，代表資源的數量');
  await step(tok);                                   // 46 wait(S)：S ≤ 0 就等
  cd.hl(1);
  p1 = pal('P1', '', PCS[0], -6.0, 0, 0.6, 0.6);
  cap('想進 critical section 就 call wait(S)', '檢查 S 是不是 ≤ 0：是就等');
  await step(tok);                                   // 63 S = 1：第一個不等，S-- → 0，進去
  cd.hl(2); M.setS(0); await M.toCS(tok, p1);
  cap('S 初值 1：第一個 process 不用等', 'while 被 break，S 減成 0 → 進 critical section');
  await step(tok);                                   // 85 出來時 signal：S 加回 1
  cd.hl(5);
  remove(pv);
  note('出來時 signal(S)：S 加回 1', 3.8, 2.6, -0.2);
  cap('出來的時候對同一個變數 signal', '把值加回 1');
  await step(tok);                                   // 97 它在裡面時（S = 0）第二個 process call wait → 等
  cd.hl(1);
  p2 = pal('P2', '', PCS[1], -6.0, 0, 0.6, 0.6);
  await M.toWait(tok, p2, 600);
  cap('可是 P1 還在裡面、S = 0 時', 'P2 call wait → S 是 0 → 在迴圈裡一直轉');
  await step(tok);                                   // 122 所以叫 wait：等第一個做完
  await spin(tok, [p2], 700);
  await M.out(tok, p1, 600); M.setS(1); cd.hl(5);
  M.st.wait = []; M.setS(0); cd.hl(2); await M.toCS(tok, p2, 600);
  cap('這就是為什麼叫 wait', 'P1 出來 signal → S = 1，P2 才 break 迴圈、S-- 進去');
}]);

FRAG.push(['syn-sem-count', 'Counting semaphore：S = 3，P4 要等', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M; const B = {};
  const mk = (n, k) => (B[n] = pal(n, '', PCS[k % 6], -6.6 + k * 0.0, 0, -0.6 + 0, 0.6));
  await step(tok);                                   // 131 也能管多個資源：S 初值 3
  M = semStage(3, '等待（while 迴圈裡轉）');
  idx('3 個相同的 resource', -0.6, 1.3, -2.4);
  cap('semaphore 也適合管多個 resource', '例如 S 初值設成 3');
  await step(tok);                                   // 148 P1：值是正的 → 不用等，S = 2
  mk('P1', 0); M.setS(2); await M.toCS(tok, B.P1);
  cap('P1 call wait：S 是正的，不用等', '減 1 → S = 2，進 critical section');
  await step(tok);                                   // 168 P2：S = 2 → 進去，S = 1
  mk('P2', 1); M.setS(1); await M.toCS(tok, B.P2);
  cap('P2 來檢查：S = 2，不用等', '進去，S 變 1');
  await step(tok);                                   // 179 P3：S = 1 → 進去，S = 0
  mk('P3', 2); M.setS(0); await M.toCS(tok, B.P3);
  cap('P3 來：S = 1 > 0 → 進去', '進去前先減 1 → S = 0');
  await step(tok);                                   // 195 P4：看到 0 → 等
  mk('P4', 3); await M.toWait(tok, B.P4);
  cap('P4 來了：看到 S = 0', 'P4 要等');
  await step(tok);                                   // 201 P5、P6 也都要等
  mk('P5', 4); await M.toWait(tok, B.P5, 500); mk('P6', 5); await M.toWait(tok, B.P6, 500);
  cap('P5、P6 或其他 process 也一樣', '都要等，直到有人出來');
  await step(tok);                                   // 211 P2 出來：S 從 0 變 1
  await M.out(tok, B.P2, 600); M.setS(1);
  cap('P2 離開 critical section', 'S 從 0 加成 1，空出一個位置');
  await step(tok);                                   // 222 P4 的 wait 結束，進去
  M.st.wait = M.st.wait.filter((b) => b !== B.P4); M.setS(0);
  await M.toCS(tok, B.P4, 700);
  cap('P4 的等待結束了', '進 critical section（S 又變 0）');
  await step(tok);                                   // 236 這叫 counting semaphore
  hd('counting semaphore', -3.4, 5.6);
  cap('這種叫 counting semaphore', '');
  await step(tok);                                   // 238 初值 1 → binary semaphore，像 mutex lock
  hot('binary semaphore：像 mutex lock（一次一個）', 2.6, 5.6);
  cap('另外還有 binary semaphore', '影片說：初值 1 叫 binary，就像 mutex lock');
  await step(tok);                                   // 248 初值 > 1 → counting：多個資源、多個 process 同時進
  good('初值 > 1（這裡 3）→ 多個 process 可同時進', -3.4, 4.8);
  cap('初值大於 1（像這裡的 3）叫 counting', '有多個資源、想讓多個 process 同時進去時用');
}]);

FRAG.push(['syn-sem-order', '用 semaphore 排順序：S1 一定在 S2 之前', async (tok) => {
  fresh([0, 6, 13], [0, 1.2, 0]);
  const x0 = -5.0, sx = 0.42;
  const ax = (t, z) => idx(String(t), x0 + t * sx, 0, z + 0.55);
  let sy, wseg;
  await step(tok);                                   // 263 另一個例子：兩個 process 互相 synchronize
  hd('用 semaphore 讓兩個 process 同步', 0, 6.0);
  cap('另一個例子', '兩個 process 用 semaphore 互相 synchronize');
  await step(tok);                                   // 272 P1、P2
  hd('P1', -6.2, 0.3, -2.4); hot('P2', -6.2, 0.3, -0.6);
  cap('兩個 process：P1 和 P2', '');
  await step(tok);                                   // 279 S1 在 P1、S2 在 P2；要求 S1 先
  note('要求：S1 一定要在 S2 之前執行', 0, 4.8);
  cap('P1 有一行 S1、P2 有一行 S2', '要求：S1 要在 S2 之前執行');
  await step(tok);                                   // 296 時間軸：S1 在 10、S2 在 11 → 開心
  const a1 = bx('S1', PCS[0], x0 + 10 * sx, 0.3, -2.4, 0.8, 0.5, 0.7, 1.2), a2 = bx('S2', PCS[1], x0 + 11 * sx, 0.3, -0.6, 0.8, 0.5, 0.7, 1.2);
  const t10 = ax(10, -2.4), t11 = ax(11, -0.6);
  const ok1 = good('S1 在 10、S2 在 11 → OK', 2.4, 1.2, -1.4);
  cap('時間軸上：S1 在第 10、S2 在第 11', 'S1 在前，符合要求');
  await step(tok);                                   // 310 另一種情況：S2 在 10、S1 在 20 → 不行
  gone(a1, a2, ok1, t10, t11);
  bx('S1', PCS[0], x0 + 20 * sx, 0.3, -2.4, 0.8, 0.5, 0.7, 1.2); ax(20, -2.4);
  const bad2 = bx('S2', PCS[1], x0 + 10 * sx, 0.3, -0.6, 0.8, 0.5, 0.7, 1.2);
  const nb = bad('S2 在 10、S1 在 20 → 不符合', 2.4, 1.2, 0.6);
  cap('另一種情況：S1 跑在 S2 後面', 'S2 在第 10、S1 在第 20 → 不符合');
  await step(tok);                                   // 340 定義 semaphore sync = 0
  sy = bx('sync = 0', SC.mem, 3.6, 0.45, 2.4, 2.2, 0.9, 1.1, 2);
  cap('定義一個 semaphore：sync', '初值設成 0');
  await step(tok);                                   // 352 S1 後面寫 signal(sync)
  hd('S1; signal(sync);', -2.0, 2.0, -2.4);
  cap('在 P1 的 S1 後面', '寫 signal(sync)');
  await step(tok);                                   // 365 S2 前面寫 wait(sync)
  hot('wait(sync); S2;', -2.0, 2.0, -0.6);
  cap('在 P2 的 S2 前面', '寫 wait(sync)');
  await step(tok);                                   // 375 S2 先到、sync = 0 → P2 被迫等
  remove(nb); kill(bad2);
  wseg = bx('wait…', '#d64545', x0 + 15.5 * sx, 0.25, -0.6, 11 * sx, 0.5, 0.7, 1.2);
  cap('如果 S2 先到，sync = 0', 'wait 會強迫 P2 停在這一行等');
  await step(tok);                                   // 397 等到什麼時候？第 20 秒 P1 signal → sync = 1
  rl(sy, 'sync = 1'); glow(sy, DIM);
  const pk = pkt('signal', x0 + 20 * sx, 1.8, -2.4); await travel(tok, pk, V3(x0 + 20 * sx, 1.8, -2.4), V3(3.6, 1.8, 2.4), 900); remove(pk);
  cap('等到什麼時候？第 20 秒 P1 做完 S1', 'signal 把 sync 加到 1');
  await step(tok);                                   // 417 第 21 秒 P2 看到 1 → 出來，執行 S2
  rl(sy, 'sync = 0');
  bx('S2', PCS[1], x0 + 21.5 * sx, 0.3, -0.6, 0.8, 0.5, 0.7, 1.2); ax(21, -0.6);
  cap('第 21 秒 P2 看到 sync = 1', '離開等待，執行 S2（sync 又被減回 0）');
  await step(tok);                                   // 449 P2 變長：這段是它的 waiting time
  glow(wseg, '#3a0a0a');
  note('紅色這段 = P2 多花的 waiting time', -1.0, 1.4, 0.6);
  cap('P2 在時間軸上變長了', '紅色這段就是 P2 的 waiting time');
}]);

FRAG.push(['syn-sem-block', 'Busy waiting vs block / wakeup', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M, cd, ps = [];
  await step(tok);                                   // 465 semaphore 也可以換一種實作
  M = semStage(0, '等待（while 迴圈裡轉）', { sx: 1.4 });
  cd = code(['wait(S) {', '  while (S <= 0) ;', '  S--;', '}'], -3.6, 5.6, 0.5, -2.8);
  ps = [pal('P1', '', PCS[0], 2.6, 0, -0.2, 0.6)]; glow(ps[0].body, OKG); ps[0].slot = 0; M.st.cs.push(ps[0]);
  cap('semaphore 可以用稍微不一樣的方式實作', '先看原本的 wait');
  await step(tok);                                   // 472 原本：在等的 process 一直在迴圈裡轉
  cd.hl(1);
  const w = [pal('P2', '', PCS[1], -6.0, 0, 0.6, 0.6)];
  await M.toWait(tok, w[0], 600);
  await spin(tok, w, 800);
  cap('只要 S 還不是正的', '在等的 process 就在這個迴圈裡一直轉');
  await step(tok);                                   // 496 本身的問題：可能好幾個一起轉
  w.push(pal('P3', '', PCS[2], -6.0, 0, 0.6, 0.6)); await M.toWait(tok, w[1], 500);
  w.push(pal('P4', '', PCS[3], -6.0, 0, 0.6, 0.6)); await M.toWait(tok, w[2], 500);
  await spin(tok, w, 700);
  cap('semaphore 有一個 inherent problem', '可能一個、兩個、好多個 process 一起在轉');
  await step(tok);                                   // 517 每次 OS 給它 CPU，它只跑什麼都不做的迴圈
  const cpu = prop('cpu', -0.6, 0, 0.4, 0.8, 'CPU');
  await spin(tok, w, 800);
  const spinBad = bad('上了 CPU 也只是在空轉：浪費 CPU cycle', -3.2, 1.8, 2.8);
  cap('每次 OS 給它機會上 CPU', '它只是執行這個什麼都不做的迴圈');
  await step(tok);                                   // 551 OS 提供兩個 system call：block、wakeup
  gone(cpu, spinBad);
  hd('OS 的 system call：block()、wakeup()', 2.6, 6.4);
  cap('改用 OS 提供的兩個 system call', '一個叫 block，另一個叫 wakeup');
  await step(tok);                                   // 559 像 I/O：睡著時不吃 CPU
  note('像等 I/O：進入 sleep，不使用 CPU cycle', 2.6, 5.6);
  cap('還記得等 I/O 時', 'process 進入類似睡覺的狀態，不浪費 CPU cycle');
  await step(tok);                                   // 581 這次是 process 自己說：我要去睡
  w.forEach((b) => sleepy(b, true)); w.forEach((b) => glow(b.body, '#1a2a5a'));
  cap('不同的是：這次是 process 自己說', '「我在等 critical section，讓我去睡」');
  await step(tok);                                   // 598 自己宣告 waiting：call block
  idx('block()：把自己推進 waiting state', -3.2, 1.8, 2.8);
  cap('process 宣告自己在等', '用 block system call 把自己推進 waiting state');
  await step(tok);                                   // 610 出來的人 wakeup 另一個
  idx('出來的人：wakeup() 叫醒另一個', 3.8, 2.6, -0.2);
  cap('有 process 離開 critical section 時', '就 wakeup 另一個想進去的 process');
  await step(tok);                                   // 631 不用浪費 CPU：OS 不會把它送上 CPU
  good('睡著的 process：OS 不會把它送上 CPU', -3.2, 3.6, 2.8);
  cap('不管幾個在等，都不用浪費 CPU cycle', 'OS 不會把睡著的 process 送進 CPU');
  await step(tok);                                   // 644 新的 wait：先把 S 減 1
  gone(...w, ...ps, cd); M.st.cs = []; M.st.wait = [];
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  M = semStage(1, 'S 的 waiting list（block，睡著）', { block: true, sx: 1.4 });
  cd = code(['wait(S) {', '  S--;', '  if (S < 0) {', '    add P to S.list;', '    block();', '  }', '}', 'signal(S) {', '  S++;', '  if (S <= 0) {', '    remove P from S.list;', '    wakeup(P);', '  }', '}'], -4.2, 6.6, 0.42, -3.2);
  const p1 = pal('P1', '', PCS[0], -6.4, 0, 0.6, 0.6);
  cd.hl(1); M.setS(0); await M.toCS(tok, p1, 700);
  cap('新的 wait：一進來就先把 S 減 1', 'P1：S 從 1 減成 0，進去');
  await step(tok);                                   // 653 S < 0 → 加進 waiting list
  const p2 = pal('P2', '', PCS[1], -6.4, 0, 0.6, 0.6);
  cd.hl(3); M.setS(-1);
  await slide(tok, p2.g, -5.6, 0, 2.8, 700); M.st.wait.push(p2);
  cap('P2 來：S 減成 −1，是負的', '把自己加進這個 semaphore 的 waiting list');
  await step(tok);                                   // 668 block：自己進入 blocked state
  cd.hl(4); sleepy(p2, true); glow(p2.body, '#1a2a5a');
  const p3 = pal('P3', '', PCS[2], -6.4, 0, 0.6, 0.6); M.setS(-2); await M.toWait(tok, p3, 600);
  const s2 = note('S = −2：|S| = 2 個在等', 3.8, 2.6, -0.2);
  cap('再 block()：我不要浪費 CPU cycle', 'P3 也一樣，S = −2（|S| = 在等的人數）');
  await step(tok);                                   // 700 signal：離開的人先把 S 加 1
  cd.hl(8); M.setS(-1);
  await M.out(tok, p1, 600);
  cap('離開 critical section 的 process', '先把 S 加 1：−2 → −1');
  await step(tok);                                   // 707 再檢查：還有人在等嗎？
  cd.hl(9);
  remove(s2);
  note('課本：S ≤ 0 → 還有人在等（影片說成「0 或大於 0」）', 3.0, 2.8, -0.2);
  cap('再檢查 S', '課本的條件：加完 S ≤ 0 代表 list 裡還有人');
  await step(tok);                                   // 729 從 list 拿出一個 process，wakeup
  cd.hl(11);
  M.st.wait = M.st.wait.filter((b) => b !== p2);
  await M.fromWait(tok, p2, 800);
  cap('從 list 移出一個 process P', '用 wakeup system call 叫醒它 → P2 進去');
  await step(tok);                                   // 751 no busy waiting / no spinlock
  cd.hl(-1);
  good('沒有 busy waiting（no spinlock）的 semaphore', 0, 7.0, -3.2);
  cap('這就是沒有 busy waiting 的實作', '也叫 no spinlock：等的人不吃 CPU');
  void ps;
}]);

// ════════ IOx8vtDzGO0（第 18D 講）：解法路線、只用 turn、Peterson、三條件證明、critical section 範圍、Bakery 預告 ════════
FRAG.push(['syn-18d-plan', '接下來的路線：software → hardware → high-level tools', async (tok) => {
  fresh([0, 6, 13], [0, 1.6, 0]);
  await step(tok);                                   // 1 這堂課：entry / exit 怎麼設計，滿足三個 requirement
  hd('怎麼設計 entry / exit section，滿足三個 requirements？', 0, 5.6);
  cap('接下來都在講 entry、exit section 怎麼設計', '去滿足剛剛的三個 requirements');
  await step(tok);                                   // 26 第一個：software solution
  bx('① software solution', PCS[0], -4.2, 0.35, 0, 3.0, 0.7, 1.0, 2);
  idx('programmer 寫 multi-thread program 時改程式', -4.2, 1.2, 0);
  cap('先看 software solution', '全部從 coding、programmer 的角度改程式');
  await step(tok);                                   // 41 hardware：特殊的 instruction
  bx('② hardware support', SC.os, 0, 0.35, 0, 3.0, 0.7, 1.0, 2);
  idx('特殊的 instruction', 0, 1.2, 0);
  cap('之後還有 hardware 的解法', 'computer system 提供特殊的 instruction 來解');
  await step(tok);                                   // 58 high-level tools：call API
  bx('③ high-level tools', PCS[3], 4.2, 0.35, 0, 3.0, 0.7, 1.0, 2);
  idx('Java 等語言提供，call API 就好', 4.2, 1.2, 0);
  cap('最後是比較 high level 的 tools', 'Java 或平行程式裡都有提供，call API 就好');
}]);

FRAG.push(['syn-18d-turn', '解法一：只用 turn 輪流（違反 progress）', async (tok) => {
  csCam();
  let V;
  await step(tok);                                   // 78 先從兩個 process：P0、P1
  V = csView('turn', { startPc: [3, 3] });
  cap('先從只有兩個 process 開始', 'P0 跟 P1');
  await step(tok);                                   // 93 do-while：兩邊不斷想進 critical section
  const n2 = note('do { … } while：兩邊都不斷想進 critical section', 0, 4.2, 0.6);
  cap('do-while 代表它們會不斷地', '想進到 critical section 做 data access');
  await step(tok);                                   // 116 第一個 solution：一個像 key 的 token：turn
  hot('turn：shared 的 token（key）', 3.2, 1.4, -2.4);
  cap('第一個 solution：用一個像 key 的概念', '一個 shared 的 token，叫 turn');
  await step(tok);                                   // 129 值就是 0 或 1
  cap('turn 的值就是 0 或 1', '');
  await step(tok);                                   // 165 turn = 0 → P0 進；= 1 → P1 進：輪流
  idx('turn = 0 → P0 進　turn = 1 → P1 進', -3.2, 1.4, -2.4);
  cap('turn 是 0 就 P0 進去，是 1 就 P1 進去', '看 turn 的值來控制：輪流');
  await step(tok);                                   // 181 只有一個人能執行 → mutual exclusion 沒問題
  const me = good('turn 只有一個值 → 一次只有一個人：ME ✓', 0, 3.6, 1.8);
  cap('turn 要嘛 0 要嘛 1', '只有一個人可以執行 → mutual exclusion 沒問題');
  await step(tok);                                   // 191 P0 做完把 turn 換成 1
  V.P[0].pc = 0; V.update();
  await runCS(tok, V, [0, 0, 0], 500);
  cap('為了輪流：P0 進去做完之後', '把 turn 換成 1，讓 P1 去做');
  await step(tok);                                   // 201 P1 做完把 turn 寫成 0
  await runCS(tok, V, [1, 1, 1, 1], 450);
  cap('P1 同樣做完要換別人', '把 turn 寫成 0');
  await step(tok);                                   // 209 entry section / exit section
  idx('while (turn != i) ; ← entry section', -4.4, 7.4, -3.4); idx('turn = j; ← exit section', 4.4, 7.4, -3.4);
  cap('while 這段就是 entry section', 'turn = j 這段是 exit section');
  await step(tok);                                   // 222 不完美：一個一個檢查，ME 沒問題
  cap('這個 solution 並不完美', '一個一個檢查：mutual exclusion 沒問題');
  await step(tok);                                   // 240 progress：可能不符合
  bad('progress？', 0, 5.6, 0.4);
  cap('第二個條件 progress', '空著時，另一個要能進來：這個程式可能不符合');
  await step(tok);                                   // 258 不是一人一行：P0 可能做很多次 P1 才做一次
  remove(n2);
  const n12 = note('不是你一行、我一行：CPU scheduling 是 run time 決定', 0, 4.2, 0.6);
  cap('注意：沒有人說兩個程式你一行我一行', 'P0 可能執行很多次，P1 才執行一次');
  await step(tok);                                   // 289 P0 先進去、出來；P1 還沒進去
  await runCS(tok, V, [0, 0, 0, 0], 450);
  cap('假設 P0 進去、出來了', 'P1 還沒有進去');
  await step(tok);                                   // 293 P0 立刻又想進 → turn 是 1 → 卡住
  await runCS(tok, V, [0, 0], 500);
  cap('P0 立刻又執行到 while', 'turn 的值是 1 → P0 卡在這裡進不去');
  await step(tok);                                   // 307 P1 不急，還沒執行到 → 沒有 progress
  remove(n12);
  bad('裡面空著，P0 卻進不去 → 沒有 progress', 0, 4.2, 0.6);
  cap('P1 可能不急，還沒執行到這行', '裡面明明是空的 → 沒有 progress');
  await step(tok);                                   // 312 一定要輪流；但實際上 P0 可能連做兩次
  cap('這個 solution 一定要你做完換我', '實際上 P0 很可能要連續做兩次，手上卻沒有 key');
  await step(tok);                                   // 338 bounded waiting 一定符合：輪流
  remove(me);
  good('bounded waiting ✓：你一個、我一個，最多等 1 次', 0, 3.6, 1.8);
  cap('bounded waiting 一定符合', '你一個我一個，waiting 最多一次');
  await step(tok);                                   // 352 符合 BW、ME，不符合 progress
  hd('ME ✓　progress ✗　bounded waiting ✓', 0, 8.0, -3.4);
  cap('三個裡面只符合兩個', 'mutual exclusion、bounded waiting 有，progress 沒有');
}]);

FRAG.push(['syn-18d-peterson', "解法二：Peterson's solution（turn + flag）", async (tok) => {
  csCam();
  let V;
  await step(tok);                                   // 376 第二個 solution：Peterson，正確的解法
  V = csView('peterson', { startPc: [5, 5] });
  cap("第二個 solution：Peterson's solution", '這個才是正確的解法');
  await step(tok);                                   // 387 延伸：turn = i → Pi 可以進
  hot('turn = i → Pi 有 key', 3.2, 1.4, -2.4);
  cap('延伸剛剛的想法：用 turn 表示輪流', 'turn 等於 i 時，Pi 可以進入 critical section');
  await step(tok);                                   // 398 多加一個 flag：想不想進
  hd('flag[i]：Pi 想不想進', -3.2, 1.4, -2.4);
  cap('為了解決 progress，多加一個 flag', '表示這個 process 到底想不想進去');
  await step(tok);                                   // 412 剛剛的問題：不知道大家想不想進
  const prob = note('剛才的問題：只會輪流，不知道對方想不想進', 0, 4.0, 0.8);
  cap('剛剛的問題：我們只是輪流', '不知道大家想不想進去');
  await step(tok);                                   // 426 flag[0]、flag[1]：true / false
  cap('flag[0] 是 P0 想不想進、flag[1] 是 P1', '簡單的 true、false');
  await step(tok);                                   // 447 除了 token，還知道對方想不想進
  cap('除了知道 token 在誰手上', '還可以知道對方到底想不想進去');
  await step(tok);                                   // 465 entry：while (turn == j) → 對方有 key 我就等（分號）
  V.P[0].pc = 2; V.update();
  cap('entry section：while 的條件', 'turn == j：對方有鑰匙我就等（注意分號）');
  await step(tok);                                   // 490 還多一個：flag[j] 也要是 true 才卡住
  cap('多了一個：flag[j] 也要是 true', '對方真的想進、而且有鑰匙，我才等');
  await step(tok);                                   // 505 我有 key 就進；對方有 key 卻不想進 → 我也能進
  V.P[0].pc = 0; V.update();
  remove(prob);
  await runCS(tok, V, [0, 0, 0], 450);
  good('對方有 key 但不想進 → 我照樣進去（progress）', 0, 4.0, 1.8);
  cap('對方有鑰匙卻不想進去', '我也可以進去 → 滿足 progress');
  await step(tok);                                   // 527 進去前 flag 設 true、出來設 false
  await runCS(tok, V, [0, 0, 0], 450);
  cap('進去之前把自己的 flag 設成 true', '出來的時候設成 false');
  await step(tok);                                   // 545 key 還是要輪流：turn = j
  csCam(); V = csView('peterson');
  await runCS(tok, V, [0, 1], 450);
  cap('key 的部分一樣要輪流：turn = j', '進去之前先把 key 交給別人');
  await step(tok);                                   // 562 為什麼先給別人？讓對方先檢查
  await runCS(tok, V, [0, 1], 450);
  cap('為什麼要寫在檢查前面、先把 key 給別人？', '兩人都想進時，最後寫 turn 的那個人讓步');
  await step(tok);                                   // 617 對方也想進就不會還你 key
  await runCS(tok, V, [0, 1], 450);
  cap('讓對方先判斷要不要進：turn = 0，P0 進去', '對方想進的話，key 就不會還你 → P1 等');
  await step(tok);                                   // 641 所以一定寫在檢查前面
  good('turn = j 寫在 while 之前：先給別人一次檢查的機會', 0, 4.4, 1.8);
  cap('所以 turn = j 一定寫在檢查的前面', '先給別人一次檢查的機會');
}]);

FRAG.push(['syn-18d-proof', "Peterson 為什麼滿足三個 requirements", async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let V;
  await step(tok);                                   // 652 為什麼保證三個條件：先看 ME
  hd('① mutual exclusion：反證法', 0, 6.4);
  cap('為什麼保證三個 requirements？', '第一個 mutual exclusion');
  await step(tok);                                   // 673 反證：假設兩個都已經在裡面
  const a = pal('P0', '', PCS[0], -1.2, 0, 0, 0.7), b = pal('P1', '', PCS[1], 1.2, 0, 0, 0.7);
  room(0, 0.8, 0, 4.0, 1.6, 2.4); idx('critical section（假設兩個都在）', 0, 1.9, 0);
  cap('用反證法：假設兩個都已經在', 'critical section 裡面了');
  await step(tok);                                   // 685 能在裡面的條件：對方 flag 是 false，或 turn 是自己
  note('P0 在裡面：flag[1] == false 或 turn == 0', -3.6, 3.2, 0);
  note('P1 在裡面：flag[0] == false 或 turn == 1', 3.6, 3.2, 0);
  cap('能在裡面的條件：對方的 flag 是 false', '或者 turn 剛好是自己');
  await step(tok);                                   // 706 兩個都要進 → flag 都是 true
  idx('兩人都要進 → flag[0] = flag[1] = true', 0, 4.2, 0);
  cap('兩個都要進去，自己的 flag 一定是 true', '所以「對方 flag 是 false」不可能發生');
  await step(tok);                                   // 723 false 那個條件不會發生 → 只剩 turn
  hot('只剩 turn 的條件', 0, 4.9, 0);
  cap('false 的那個 condition 不會幫任何人進去', '所以只剩 turn 的值');
  await step(tok);                                   // 745 turn 用 assign：一定是 0 或 1
  const tc = bx('turn = 0', SC.mem, 0, 0.4, 2.6, 1.8, 0.8, 1.0, 2);
  cap('turn 是用 assign 的，不是 ++ 或 --', '所以一定是 0 或 1，不可能又是 0 又是 1');
  await step(tok);                                   // 755 turn = 0 → P0 能在裡面、P1 不可能
  glow(b.body, NOR); b.mood('sad'); glow(a.body, OKG);
  cap('turn 是 0：P0 可以在裡面', 'P1 的兩個條件都不成立 → 不可能在裡面');
  await step(tok);                                   // 793 反證：兩個條件永遠不能同時發生
  good('兩人都在裡面的條件永遠不能同時成立 → ME ✓', 0, 5.6, 0);
  cap('反過來 turn 是 1 也一樣', '兩個條件永遠不可能同時發生 → 反證完成');
  await step(tok);                                   // 804 第二個：progress
  csCam(); V = csView('peterson', { startPc: [0, 5] });
  hd('② progress', 0, 7.4, -3.4);
  cap('第二個是 progress', '');
  await step(tok);                                   // 823 P0 想進；P1 在 remainder 或 while 之前
  cap('假設 P0 想要進去', 'P1 在 remainder，或在 while 之前：反正不在 critical section');
  await step(tok);                                   // 846 要證：P0 一定能 break while
  await runCS(tok, V, [0, 0], 450);
  cap('要證明的是：P0 執行到 while', '一定能 break 進到 critical section');
  await step(tok);                                   // 858 case 1：P1 剛離開，flag[1] = false → P0 break
  V.step(0);
  cap('case 1：P1 已經離開、不要進去', 'flag[1] 一定被設成 false → P0 break while 進去');
  await step(tok);                                   // 893 case 2：P1 沒 context switch，繞一圈又想進
  csCam(); V = csView('peterson');
  await runCS(tok, V, [0, 0, 1, 1], 400);
  cap('case 2：P1 執行完沒有 context switch', '同一個 CPU burst 裡又繞一圈，也想進去');
  await step(tok);                                   // 912 兩人都 ready，turn 不是 0 就是 1 → 一定有人進
  await runCS(tok, V, [0, 1], 500);
  cap('兩人的 flag 都是 true、都 ready', 'turn 是 0 → P0 進去；一定有一個人進得去');
  await step(tok);                                   // 951 critical section 不會空在那裡
  good('critical section 不會空著 → progress ✓', 0, 4.2, 1.8);
  cap('兩種情況都有人能進去', 'critical section 不會空在那裡');
  await step(tok);                                   // 976 最後一個：bounded waiting
  csCam(); V = csView('peterson');
  for (const i of [1, 1, 1, 0, 0, 0]) V.step(i);
  hd('③ bounded waiting', 0, 7.4, -3.4);
  cap('最後一個 bounded waiting', 'P1 在 critical section、P0 在等');
  await step(tok);                                   // 990 P1 剛執行完，要確定一定讓給 P0
  cap('跟 progress 像，但更嚴謹', 'P1 剛執行完，要確定接下來一定是 P0');
  await step(tok);                                   // 1011 P1 設 flag false；context switch → P0 進
  await runCS(tok, V, [1, 1], 450); V.step(0);
  cap('P1 出來把 flag 設成 false，若這時 context switch', 'P0 檢查 flag[1] 是 false → 不管 turn 是多少都能進');
  await step(tok);                                   // 1058 不一樣的情況：P1 沒被 context switch
  csCam(); V = csView('peterson');
  for (const i of [1, 1, 1, 0, 0, 0, 1, 1]) V.step(i);
  await runCS(tok, V, [1, 1], 450);
  cap('如果 P1 執行完沒有被 context switch', '它又繞回來、又想進來（flag[1] = true）');
  await step(tok);                                   // 1074 turn 寫在前面：強迫 P1 把權力讓給 P0
  V.step(1);
  cap('這就是 turn 要寫在前面的原因', 'turn = 0：P1 下一輪之前一定要把 key 讓給 P0');
  await step(tok);                                   // 1089 P1 沒有 turn、P0 的 flag 又是 true → P1 卡住
  V.step(1);
  cap('P1 的 flag 是 true，但 turn 在 P0 那邊', 'P0 也一直在等（flag[0] = true）→ P1 卡住');
  await step(tok);                                   // 1112 P1 在 while 裡空轉，直到 CPU burst 用完 → 換 P0
  await runCS(tok, V, [1, 1], 450); V.step(0);
  cap('P1 在 while 裡一直檢查，直到 burst 用完', 'OS 做 context switch 換到 P0 → P0 馬上進去');
  await step(tok);                                   // 1141 兩人都 ready 時 key 交給另一個 → 不能重複
  good('剛執行完的人不能立刻再進：等的人一定先拿到 key → BW ✓', 0, 4.4, 1.8);
  cap('兩個都 ready 時 key 會交給另一個人', '剛執行完的人沒辦法立刻重複執行');
  await step(tok);                                   // 1168 把 key 交給別人 vs 設給自己的差別
  note('turn = j（交給別人），不是 turn = i', 0, 5.2, 1.8);
  cap('這就是 key 交給別人、而不是設給自己的差別', '');
  void tc;
}]);

FRAG.push(['syn-18d-csrange', 'Critical section 要定義在哪：越小越好', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  const N = 4, xs = Array.from({ length: N }, (_, k) => -1.8 + k * 1.2);
  let pr, co, big;
  await step(tok);                                   // 1183 寫 critical section 要注意：定義在哪
  hd('critical section 要定義在哪裡？', 0, 6.4);
  cap('寫 critical section 第一個要注意', '到底在哪邊定義你的 critical section');
  await step(tok);                                   // 1198 consumer–producer：全部 code 都放進去？
  xs.forEach((x) => ctx.tile(V3(x, 0.04, 0.4), 1.05, 1.05));
  pr = pal('producer', '', PCS[0], -5.4, 0, 2.6, 0.65); co = pal('consumer', '', PCS[1], 5.4, 0, 2.6, 0.65);
  big = room(0, 1.0, 0.4, 6.0, 2.0, 2.6, '#9b7ef4');
  const whole = idx('整段 code 都包成 critical section（示意）', 0, 2.3, 0.4);
  cap('用 consumer–producer 的例子', '很直覺：把所有 code 都放進 critical section？');
  await step(tok);                                   // 1210 答案是錯的 → deadlock
  const dl = bad('這樣定義會 deadlock', 0, 3.1, 0.4);
  cap('什麼都保護應該比較好？答案是錯的', '會產生 deadlock，程式卡住');
  await step(tok);                                   // 1224 buffer 空的；consumer 先被 call，進去
  await slide(tok, co.g, 1.2, 0, 1.0, 800); glow(co.body, OKG);
  cap('一開始 buffer 是空的', 'consumer 先被 call，它是第一個，進 critical section');
  await step(tok);                                   // 1238 buffer 空 → 在裡面 loop 等
  co.mood('sad'); await spin(tok, [co], 700);
  cap('它發現 buffer 是空的', '就在 critical section 裡面 loop 等');
  await step(tok);                                   // 1248 producer 被 entry section 擋住
  await slide(tok, pr.g, -3.6, 0, 1.0, 700); glow(pr.body, NOR); pr.mood('sad');
  cap('producer 這時才被 call', '被 entry section 擋在外面，永遠進不去');
  await step(tok);                                   // 1262 互相等 → deadlock
  arr(-3.0, 1.2, 0.6, 1.2, '#d64545', 1.4); arr(0.6, 0.8, -3.0, 0.8, '#d64545', 1.4);
  const dl2 = bad('consumer 等 producer 產生資料；producer 等 consumer 離開 → deadlock', 0, 4.0, 1.0);
  cap('consumer 在等 producer 產生資料', 'producer 在等 consumer 離開 → 互相等：deadlock');
  await step(tok);                                   // 1290 第二種：正確但不太好
  gone(pr, co, big, whole, dl, dl2);
  const cd = code(['do {', '  compute();      // 無關的計算', '  counter++;     // 會 race', '  compute();', '} while (true);'], -3.4, 5.4, 0.5, -2.4);
  const box = room(-3.4, 4.4, -2.5, 6.0, 2.6, 0.4, '#9b7ef4');
  cap('第二種是正確、但不太好的', '重點是 critical section 的範圍');
  await step(tok);                                   // 1309 把獨立的 computation 也包進去
  cd.hl(1);
  cap('假設包進了一些 independent 的 computation', '真正會 race 的只有 counter++');
  await step(tok);                                   // 1330 缺點：做到一半 context switch，另一個卡在 entry
  const A = pal('A', '', PCS[0], 2.0, 0, 0.6, 0.6), B = pal('B', '', PCS[1], 4.4, 0, 0.6, 0.6);
  glow(A.body, OKG); glow(B.body, NOR); B.mood('sad');
  note('A 在裡面做到一半被 context switch → B 輪到了卻卡在 entry', 3.2, 2.2, 0.6);
  cap('它有 mutual exclusion', '做到一半被 context switch，換過去的人卡在 entry section');
  await step(tok);                                   // 1363 compute 本來誰被 schedule 都能做；拉長了 CS
  idx('compute() 本來誰被 schedule 到都能做', 3.2, 3.0, 0.6);
  cap('compute 本來誰被 schedule 到就能執行', '包進去反而延長了 critical section 的時間');
  await step(tok);                                   // 1384 CPU 效率變差：沒有意義的 waiting
  await spin(tok, [B], 700);
  bad('輪到你卻在 entry 做沒有意義的 waiting → 效率差', 3.2, 3.8, 0.6);
  cap('整個 CPU 的效率變差', '輪到你執行卻卡在 entry section 空等');
  await step(tok);                                   // 1399 原則：越小越好，只包會 race 的
  cd.hl(2);
  box.scale.set(1, 0.25, 1); box.position.set(-3.4, 4.4 - 0.5, -2.5);
  good('原則：越小越好，只包會 race condition 的程式', -3.0, 1.6, -2.4);
  cap('原則：包得越小越好', '只包跟 race condition 有關的程式');
}]);

FRAG.push(['syn-18d-bakery', 'N 個 process：Bakery algorithm 的概念', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let ppl = [], tk = [];
  await step(tok);                                   // 1419 剛剛是兩個 process 的 solution
  const two = [pal('P0', '', PCS[0], -1.0, 0, 1.4, 0.65), pal('P1', '', PCS[1], 1.0, 0, 1.4, 0.65)];
  cap('剛剛介紹的是兩個 process 的 solution', '');
  await step(tok);                                   // 1429 大部分問題都是 N 個
  gone(...two);
  ppl = [0, 1, 2, 3, 4].map((k) => pal('P' + k, '', PCS[k], -5 + k * 2.5, 0, 2.2, 0.6));
  cap('但大部分的問題都不是兩個', '而是 N 個 processes 之間的 synchronization');
  await step(tok);                                   // 1438 Bakery algorithm：N 個都適用
  hd('Bakery algorithm：N 個 process 都適用', 0, 6.0);
  cap('解法：Bakery algorithm', '可以 apply 到 N 個 processes');
  await step(tok);                                   // 1460 像去郵局、買麵包
  const cash = prop('parcel', 0, 0, -2.4, 0.9, '結帳櫃台');
  cap('概念就像去郵局、去麵包店', '只有一個人幫你結帳');
  await step(tok);                                   // 1477 抽號碼牌 → 一次一個
  tk = ppl.map((b, i) => bx('#' + (i + 1), '#f3e6c8', -5 + i * 2.5, 1.45, 2.2, 0.8, 0.4, 0.4, 1.5));
  await slide(tok, ppl[0].g, 0, 0, -0.6, 700); glow(ppl[0].body, OKG);
  cap('大家抽號碼牌', '就能確保一次只有一個人在結帳');
  await step(tok);                                   // 1490 first come first serve → bounded waiting
  good('first come, first serve → bounded waiting', -3.6, 4.6);
  cap('抽了號碼牌就是 first come, first serve', '滿足 bounded waiting');
  await step(tok);                                   // 1500 知道下一個是誰 → progress
  good('知道下一個是誰 → progress', 3.6, 4.6);
  cap('只要有人抽，就知道下一個要服務誰', '滿足 progress');
  await step(tok);                                   // 1521 進去前抽號碼，小的先
  note('進 critical section 前抽號碼，號碼小的先', 0, 5.3);
  cap('每個人進 critical section 之前抽號碼', '號碼越小越先執行');
  await step(tok);                                   // 1535 程式裡抽號碼好幾行 → 可能相同
  [1, 2, 3, 4].forEach((k) => { kill(tk[k]); });
  [3, 3, 5, 5].forEach((v, k) => { tk[k + 1] = bx('#' + v, '#f3e6c8', -2.5 + k * 2.5, 1.45, 2.2, 0.8, 0.4, 0.4, 1.5); });
  glow(tk[1], NOR); glow(tk[2], NOR);
  bad('程式裡抽號碼是好幾行 → 可能相同（3、3、5、5）', 0, 3.6, 2.2);
  cap('程式裡抽號碼是好幾行程式', '兩個人同時抽可能相同，只保證 non-decreasing');
  await step(tok);                                   // 1566 tie breaker：PID 小的先
  glow(tk[1], OKG);
  good('相同時比 PID：PID 小的先', 0, 0, 4.2);
  cap('tie breaker：用 process ID', '號碼相同就比 PID，越小越先');
  await step(tok);                                   // 1595 程式比較 (a, b) < (c, d)
  const cd = code(['(a, b) < (c, d)  if  a < c', '              or  a == c && b < d', 'a, c：號碼　b, d：PID'], -4.2, 1.4, 0.48, -2.0);
  cap('之後的程式碼比較時', '不只比號碼，號碼相同再比 process ID');
  await step(tok);                                   // 1608 完整的 solution（下次講解）
  note('完整 solution 比較複雜：下次一行一行講', 0, 6.8, -2.0);
  cap('這是完整的 solution，看起來比較複雜', '下次再一行一行講解');
  void cash; void cd;
}]);

// ════════ nNcqTc-00WA（第 19B 講）：Pthread mutex、condition variable、hardware support、test-and-set、swap ════════
const sphere = (c, x, y, z, r = 0.26) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); m.position.set(x, y, z); lab.world.add(m); return m; };

FRAG.push(['syn-19b-mutex', 'Pthread 的 mutex：lock / unlock 包住 critical section', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let cd, L;
  await step(tok);                                   // 15 software 講完；實際上不會自己寫，用 tool
  hd('實務上：不自己寫 Peterson，用現成的 tool', 0, 6.4);
  cap('講完 software solution', '自己寫程式時真的會寫那些嗎？大部分不會');
  await step(tok);                                   // 19 Pthread library 提供的 API：mutex
  hot('Pthread library → mutex', 0, 5.6);
  cap('之前教過 Pthread', '它提供的 synchronization tool 就是 mutex');
  await step(tok);                                   // 45 已定義好的 special variable / token：mutex
  L = prop('lock', 4.6, 0, 0.6, 1.4, 'mutex');
  cap('Pthread 裡已經定義好的特殊 variable（token）', '叫 mutex = mutual exclusion 的簡寫');
  await step(tok);                                   // 59 用法很簡單：declare、initialize
  cd = code(['pthread_mutex_t m;', 'pthread_mutex_init(&m, NULL);', 'pthread_mutex_lock(&m);    // entry', '  … critical section …', 'pthread_mutex_unlock(&m);  // exit', 'pthread_mutex_destroy(&m);'], -2.6, 4.6, 0.55, -2.4);
  cd.hl(1);
  cap('用法很簡單：它就是一個 lock', '先 declare，再 initialize（它是個 data structure）');
  await step(tok);                                   // 75 entry = lock、exit = unlock
  cd.hl(2);
  cap('還記得 critical section 有 entry、exit', 'entry 就是 lock，exit 就是 unlock');
  await step(tok);                                   // 87 裡面就是剛才的 software / hardware solution
  note('lock / unlock 裡面 = 剛才那些 solution（software 或 hardware）', -2.6, 1.0, -0.6);
  cap('這兩個 function 裡面是什麼？', '就是剛才的 solution，Pthread 把它包起來');
  await step(tok);                                   // 110 會 race 的地方都要 call，用同一個 mutex
  const ts = [0, 1].map((k) => pal('T' + k, '', PCS[k], 2.4 + k * 1.6, 0, 2.6, 0.6));
  cap('所有可能造成 race condition 的地方', '都要 call lock / unlock，而且用相同的 mutex');
  await step(tok);                                   // 128 mutex 是 shared variable：同一把鎖
  arr(2.4, 1.2, 4.2, 0.9, PCS[0], 2.6, 0.8); arr(4.0, 1.2, 4.6, 0.9, PCS[1], 2.6, 0.8);
  cap('mutex token 是一個 shared variable', '大家必須用同一把 lock');
  await step(tok);                                   // 134 不同的 data → declare 其他 mutex
  const L2 = prop('lock', 6.4, 0, -1.4, 1.1, 'mutex2');
  cap('如果要保護的是不同的 variable', '可以 declare 其他的 mutex：不同的 key');
  await step(tok);                                   // 147 同一個 token 的 critical section 之間互斥
  good('同一個 mutex 的 critical section 之間：mutual exclusion', 0, 0.6, 3.8);
  cap('相同 token 的 critical section', '彼此之間就有 mutual exclusion 的作用');
  await step(tok);                                   // 162 用完要 destroy；Pthread 很常用
  cd.hl(5);
  cap('用完要 destroy', 'Pthread 裡常用 mutex 實作 critical section');
  void ts; void L2;
}]);

const CVL = ['pthread_mutex_lock(&m);', 'if (x != 0)', '  pthread_cond_wait(&c, &m);', 'take_action();', 'pthread_mutex_unlock(&m);'];
const CVR = ['pthread_mutex_lock(&m);', 'x--;          // 改 x', 'if (x == 0)', '  pthread_cond_signal(&c);', 'pthread_mutex_unlock(&m);'];
FRAG.push(['syn-19b-cond', 'Condition variable：wait / signal / broadcast', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let th = [], cl, cr;
  await step(tok);                                   // 185 Pthread 另一個 tool：condition variable
  hd('Pthread：condition variable', 0, 6.4);
  cap('Pthread 除了 mutex', '還有另一個跟 synchronization 有關的：condition variable');
  await step(tok);                                   // 197 用 event 去 trigger 其他 thread
  th = [0, 1, 2].map((k) => pal('T' + k, '', PCS[k + 1], -1.2 + k * 1.6, 0, 1.6, 0.6));
  const ev = bx('condition（event）', '#f3d36b', -5.0, 0.4, 1.6, 2.4, 0.7, 0.9, 2);
  cap('程式同時執行時，常常需要一個 event', '去 trigger 其他 thread 開始做事');
  await step(tok);                                   // 227 notify：某個 condition 發生了
  for (const t of th) t.mood('wow');
  arr(-3.6, 1.0, -1.8, 1.0, '#c08a1f', 1.6);
  cap('這個 variable 可以 notify 其他 thread', '告訴它們某個 condition 發生了');
  await step(tok);                                   // 237 例子：一個 thread 載資料，載完叫大家處理
  const ld = pal('loader', '', PCS[0], -5.0, 0, -1.2, 0.6);
  prop('file', -3.6, 0, -1.6, 0.7);
  const ldN = note('loader 把 data 載完 → 通知所有 thread 開始處理（示意）', 0, 3.6, 0);
  cap('例子：一個 thread 專門把 data 載進來', '載完就 notify 所有 thread 一起處理');
  await step(tok);                                   // 269 wait：等某個 condition，沒人 signal 就卡住
  th.forEach((t) => sleepy(t, true));
  cap('用法：wait on 某個 condition variable', '沒人 signal 它，thread 就 block 在那裡');
  await step(tok);                                   // 292 signal：叫醒其中一個（通常第一個）
  sleepy(th[0], false); th[0].mood('happy'); glow(th[0].body, OKG);
  cap('signal：這個 event 發生了', '在上面等的 thread 其中一個被叫起來（看 library 實作）');
  await step(tok);                                   // 310 broadcast：全部叫起來
  th.forEach((t) => { sleepy(t, false); t.mood('happy'); glow(t.body, OKG); });
  cap('要叫醒所有在等的 thread', '就 call broadcast');
  await step(tok);                                   // 320 簡單的同步機制
  const ordG = good('控制 thread 之間做事的順序', 0, 3.0, 1.6);
  cap('簡單的 synchronization 機制', '執行時間點不一定，但能同步大家的動作');
  await step(tok);                                   // 343 API：wait、signal、broadcast；init、destroy
  gone(...th, ld, ev, ldN, ordG);
  code(['pthread_cond_wait(&c, &m);', 'pthread_cond_signal(&c);', 'pthread_cond_broadcast(&c);', '（也要 init、destroy）'], 0, 5.4, 0.5, -1.2);
  cap('Pthread 的 API', 'cond_wait、cond_signal、cond_broadcast');
  await step(tok);                                   // 364 wait 還需要一個 mutex lock
  hot('cond_wait 還要一個 mutex → 兩個一起用', 0, 3.0, -1.2);
  cap('你會發現 wait 的時候', '還需要一個 mutex lock：兩個必須一起用');
  await step(tok);                                   // 380 例子：counter 改 x；action 等 x == 0
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  cl = code(CVL, -3.8, 5.6, 0.5, -2.4); cr = code(CVR, 3.8, 5.6, 0.5, -2.4);
  hd('action thread', -3.8, 6.2, -2.4); hot('counter thread', 3.8, 6.2, -2.4);
  const X = bx('x = 2（示意）', SC.mem, 0, 0.45, 0.4, 2.2, 0.9, 1.1, 2);
  cap('例子：兩個 thread', 'counter 在改 x；action 要等 x 等於 0 才能做事');
  await step(tok);                                   // 402 不等於 0 就 wait；別人發現是 0 就 signal
  cl.hl(2); cr.hl(3);
  cap('x 不是 0 就 wait on 某個 condition', '別人發現 x 是 0 就 signal → 它被叫起來 take action');
  await step(tok);                                   // 418 必須結合 mutex：包在 critical section
  cl.hl(0); cr.hl(0);
  cap('這裡必須結合 mutex', '把程式碼包在 critical section 裡，為什麼？');
  await step(tok);                                   // 451 原因一：x 是 shared，很多人 ++ / --
  glow(X, NOR);
  bad('① x 是 shared variable，很多人在 ++ / --', 0, 2.0, 0.4);
  cap('原因一：condition 的變數 x 通常是 shared', '很多人同時 ++ / --，所以要保護 x');
  await step(tok);                                   // 475 原因二：檢查完才 signal，中間可能被改
  cr.hl(2);
  bad('② 檢查 x == 0 與 signal 中間可能被 context switch、x 被改', 0, 2.8, 0.4);
  cap('原因二：檢查之後才 signal，是好幾行', 'signal 的瞬間 x 未必還是 0 → 要一次做完');
  await step(tok);                                   // 518 signal 那邊一定在 CS；wait 的也要在 CS
  cr.hl(-1); cl.hl(-1);
  room(-3.8, 4.6, -2.6, 6.2, 2.6, 0.3, '#2fc092'); room(3.8, 4.6, -2.6, 6.2, 2.6, 0.3, '#2fc092');
  cap('所以 signal 的那邊一定包在 critical section', '要 wait 的那邊也必須在 critical section');
  await step(tok);                                   // 542 design pattern：兩邊都在 CS，cond_wait 需要 mutex
  good('design pattern：兩邊都在 critical section；cond_wait 要傳 mutex', 0, 1.6, 2.6);
  cap('這是一個 design pattern', '兩邊都在 critical section；cond_wait 本身需要 mutex');
}]);

FRAG.push(['syn-19b-hw', 'Hardware support：atomic instruction', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  await step(tok);                                   // 572 下一個：hardware support
  hd('Hardware support', 0, 6.2);
  cap('講完 software solution', '下一個是 hardware support');
  await step(tok);                                   // 578 software：只是程式碼，可以驗證正確性
  bx('software：只寫程式碼', PCS[0], -4.0, 0.35, -1.6, 3.2, 0.7, 1.0, 2);
  cap('software 就是完全寫程式碼', '我們可以去驗證它的正確性');
  await step(tok);                                   // 583 hardware：special instruction，一次做完、不被 interrupt
  const hw = bx('hardware：special instruction', SC.os, 2.0, 0.35, -1.6, 3.8, 0.7, 1.0, 2);
  const cpu = prop('cpu', 5.6, 0, 1.0, 0.8, 'CPU');
  cap('hardware 提供一些 special instruction', '一次把很多事做完，保證中間不被 interrupt');
  await step(tok);                                   // 599 一次做完 → 沒有 synchronization issue
  good('一次做完、不會被打斷 → 沒有 synchronization issue', 2.0, 1.4, -1.6);
  cap('一次做完就不會有 synchronization 的 issue', 'hardware 實作的不會被打斷');
  await step(tok);                                   // 612 簡化：call 這些 hardware function
  note('寫 solution 時 call 這些 function → 程式碼變簡單', 0, 4.8, -1);
  cap('為了簡化 synchronization solution', '直接 call hardware 提供的 function');
  await step(tok);                                   // 624 原因是 interrupt；software 可能 disable interrupt（不好）
  bad('disable interrupt：會影響其他程式 ✗', -4.0, 2.2, -1.6);
  cap('synchronization 的問題來自 interrupt', 'disable interrupt 不好：會影響到其他程式');
  await step(tok);                                   // 639 hardware 一次執行完：atomic
  glow(hw, DIM);
  hot('atomic instruction', 2.0, 2.9, -1.6);
  cap('另一個方式就是用 hardware', '一次執行完的 instruction，叫做 atomic');
  await step(tok);                                   // 648 雖然好幾步，但不會被打斷
  [0, 1, 2].forEach((k) => bx('步驟 ' + (k + 1), '#e0d6f5', 0.8 + k * 1.2, 0.25, 0.8, 1.0, 0.4, 0.6, 1.2));
  room(2.0, 0.3, 0.8, 4.0, 0.7, 1.0, '#9b7ef4');
  cap('雖然一次有好幾個動作', '但不會被打斷，不管 function 寫得多複雜');
  await step(tok);                                   // 664 兩個例子：test-and-set、swap
  bx('TestAndSet()', PCS[3], -2.4, 0.3, 3.0, 2.6, 0.5, 0.8, 1.5); bx('Swap()', PCS[2], 2.4, 0.3, 3.0, 2.6, 0.5, 0.8, 1.5);
  cap('用兩個例子：test-and-set 和 swap', '怎麼 call 它們來實作 entry、exit section');
  await step(tok);                                   // 689 真實系統都有提供，速度快
  good('真實的 computer system 都有提供：快、又安全', 0, 0.4, 4.4);
  cap('真實的 computer system 都有提供', '用 hardware 很快，又確保沒有 synchronization issue');
  void cpu;
}]);

FRAG.push(['syn-19b-tas', 'TestAndSet：讀出舊值並上鎖（atomic）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let cd, lk, V, P0b;
  await step(tok);                                   // 711 第一個：TestAndSet，有一個 lock
  lk = bx('lock = false', SC.mem, 3.6, 0.45, 0.4, 2.4, 0.9, 1.1, 2);
  hd('TestAndSet', 0, 6.4);
  cap('第一個：test-and-set', '跟剛才一樣有一個 lock，就是一個 token 的值');
  await step(tok);                                   // 723 call 它：告訴你 lock 現在的值，並設成 true
  cd = code(['boolean TestAndSet(boolean *target) {', '  boolean rv = *target;', '  *target = true;', '  return rv;', '}'], -3.0, 5.2, 0.5, -2.4);
  P0b = pal('P0', '?', PCS[0], 0.4, 0, 2.2, 0.65);
  cap('任何 process call 它', '它告訴你 lock 目前的值，並把 lock 設成 true');
  await step(tok);                                   // 741 test：先記下原來的值，return 它
  cd.hl(1);
  const p = pkt('false', 3.6, 1.3, 1.0); await travel(tok, p, V3(3.6, 1.3, 1.0), V3(0.4, 1.4, 2.4), 800); remove(p);
  P0b.set('rv = false');
  cap('test：先把 lock 原來的值存起來', '最後 return 它：原來是多少');
  await step(tok);                                   // 766 過程中一定設成 true（override）
  cd.hl(2); rl(lk, 'lock = true'); glow(lk, DIM);
  cap('過程中一定把 lock 設成 true', '把原本的值 override 掉');
  await step(tok);                                   // 771 像是看看有沒有鎖，但不管結果都把門鎖起來
  bub('看看有沒有鎖…不管怎樣，先把門鎖上！', 0.4, 2.6, 2.2);
  cap('有點像：我去看現在有沒有鎖', '不管結果如何，就把門鎖起來');
  await step(tok);                                   // 784 三行，但 hardware 支援 → 不會 race，一個一個做
  cd.hl(-1);
  room(-3.0, 4.2, -2.5, 7.4, 2.6, 0.3, '#9b7ef4');
  good('hardware：整個 function 是 atomic，很多人 call 也會被 serialize', -3.0, 1.8, -1.6);
  cap('這其實是三行程式', '但它是 hardware 的 function：一定一個人一個人做（serialize）');
  await step(tok);                                   // 814 用它寫 CS：lock 初值 false
  fresh([0, 7, 12.5], [0, 2.2, 0]);
  V = csView('tas');
  cap('有了它，critical section 就變得很簡單', 'lock 一開始 initialize 成 false（unlock）');
  await step(tok);                                   // 829 第一個 call 的人拿到 false → break while
  V.step(0);
  cap('第一個 call TestAndSet 的人一定拿到 false', 'false 就能 break while → 進 critical section');
  await step(tok);                                   // 856 被 call 後就上鎖；後面的人拿到 true → 卡住
  await runCS(tok, V, [1, 1], 500);
  cap('一被 call 就 set 成 true', '後面的人拿到的都是 true → while 繼續，被卡住');
  await step(tok);                                   // 883 unlock：離開時 lock = false
  await runCS(tok, V, [0, 0], 500);
  cap('怎麼 unlock？', '離開時把 lock 設成 false');
  await step(tok);                                   // 892 下一個 call 的人就能 break
  V.step(1);
  cap('unlock 之後，下一個 call TestAndSet 的人', '就可以 break 它的 while loop');
  await step(tok);                                   // 912 ME：atomic → 不可能兩個人同時拿到 false
  good('ME ✓：atomic → 不可能兩人同時拿到 false', 0, 4.2, 1.8);
  cap('mutual exclusion：TestAndSet 是 atomic 的', '第一個拿到 false 的人就把它變 true');
  await step(tok);                                   // 942 progress：沒人在裡面時第一個 call 的人進得去（N 個也可以）
  good('progress ✓：lock 是 false 時，第一個 call 的人一定進得去（N 個 process 都適用）', 0, 3.5, 1.8);
  cap('progress 也沒問題，而且可用在 N 個 process', '沒人在裡面時 lock 是 false，第一個 call 的人進去');
  await step(tok);                                   // 973 bounded waiting：不符合，沒有排隊
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const lk2 = bx('lock', SC.mem, 0, 0.45, -1.6, 1.6, 0.9, 1.1);
  const crowd = [0, 1, 2, 3, 4, 5].map((k) => pal('P' + k, '', PCS[k], -5 + k * 2, 0, 2.2, 0.55));
  bad('bounded waiting ✗：沒有排隊', 0, 6.0);
  cap('最後 bounded waiting：不符合', '想想看：它沒有 first come, first serve');
  await step(tok);                                   // 989 100 個 process 一直 call；沒有輪流 → 用搶的
  idx('（課堂說 100 個 process，這裡畫 6 個示意）', 0, 0.2, 3.6);
  for (let r = 0; r < 2; r++) { const k = [3, 1][r]; await slide(tok, crowd[k].g, 0, 0, 0.2, 500); glow(crowd[k].body, OKG); await wt(tok, 200); await slide(tok, crowd[k].g, -5 + k * 2, 0, 2.2, 400); glow(crowd[k].body, null); }
  cap('很多 process 一直在 while 裡 call', 'scheduling 不一定輪流：先 call 的人拿到 lock → 用搶的');
  await step(tok);                                   // 1021 搶 → 沒有任何保證
  crowd[0].mood('sad'); glow(crowd[0].body, NOR);
  bad('P0 可能一直搶不到 → 沒有保證', -5, 1.6, 2.2);
  cap('搶的結果沒有任何保證', '所以不符合 bounded waiting');
  await step(tok);                                   // 1025 很多 solution 只解前兩個；電腦卡住常因為這樣
  note('全部符合成本太高 → 很多只解前兩個（電腦卡住常卡在這種地方）', 0, 4.8, -1.0);
  cap('很多時候全部符合的 effort 太大', '至少解掉前兩個；電腦卡住常常就是這種問題');
  void lk2;
}]);

FRAG.push(['syn-19b-swap', 'Swap：交換紅球（lock）與藍球（key）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const RED = '#e04545', BLUE = '#3f7fe0';
  let me, ps = [], balls = [], lockBall, cd;
  const handPos = (k) => V3(-4.4 + k * 2.6 + 0.55, 1.0, 2.2);
  await step(tok);                                   // 1052 第二個例子：swap，把兩個 variable 的值對調
  hd('Swap(&a, &b)：把兩個值對調', 0, 6.4);
  const a = bx('a', SC.mem, -1.2, 0.4, -1.4, 1.0, 0.8, 0.8), b = bx('b', SC.mem, 1.2, 0.4, -1.4, 1.0, 0.8, 0.8);
  const pa = pkt('1', -1.2, 1.2, -1.0), pb = pkt('2', 1.2, 1.2, -1.0);
  await anim(tok, 900, (u) => { pa.position.x = -1.2 + 2.4 * u; pb.position.x = 1.2 - 2.4 * u; });
  cap('第二個例子：swap', '給它兩個 variable，它把值對調（hardware 實作）');
  await step(tok);                                   // 1076 每個人手上一顆球：都是藍色，除了我（管理者）手上是紅色
  gone(a, b, pa, pb);
  me = pal('lock（管理者）', '', '#c9b48e', 0, 0, -1.8, 0.8);
  lockBall = sphere(RED, 0.75, 1.0, -1.4);
  ps = [0, 1, 2].map((k) => pal('P' + k, '', PCS[k], -4.4 + k * 2.6, 0, 2.2, 0.65));
  balls = ps.map((p, k) => sphere(BLUE, handPos(k).x, 1.0, 2.2));
  cap('想像每個 process 手上都有一顆球', '全部是藍色，只有我（lock）手上是紅色');
  await step(tok);                                   // 1093 我代表沒人在執行；大家搶紅球
  room(4.6, 0.8, -1.4, 2.4, 1.6, 2.0); idx('critical section', 4.6, 1.8, -1.4);
  cap('拿到紅球的人可以進去執行', '我不進 critical section，大家要搶這顆紅球');
  await step(tok);                                   // 1102 swap 就是交換（大風吹）；只有一顆紅球
  note('swap = 大風吹：換球；全場只有一顆紅球', 0, 4.2, 0);
  cap('swap 的意思就是大家來交換：大風吹', '整個裡面只有一顆紅色的球');
  await step(tok);                                   // 1115 進去前 call swap 跟我換；換到紅球就進去
  cap('進去之前就 call swap 跟我換球', '換到紅球的人就可以進去');
  await step(tok);                                   // 1123 紅 = false（lock）、藍 = true（key）
  idx('紅球 = false　藍球 = true', 0.75, 2.4, -1.4);
  cap('紅球就是 lock 的值 false', '其他 process 手上都是 true（藍球）');
  await step(tok);                                   // 1151 程式：key = true; while (key) Swap(&lock, &key);
  cd = code(['key = true;', 'while (key == true)', '  Swap(&lock, &key);', '  … critical section …', 'lock = false;'], -4.6, 6.0, 0.5, -2.4);
  cd.hl(0);
  cap('進去之前 key = true（手上是藍球）', '然後一直跟 lock 交換手上的球');
  await step(tok);                                   // 1180 一開始 lock 是 false：第一個換的人拿到 false → break
  cd.hl(2);
  { const r0 = lockBall.position.clone(), b0 = balls[0].position.clone();
    await anim(tok, 900, (u) => { lockBall.position.lerpVectors(r0, b0, u); balls[0].position.lerpVectors(b0, r0, u); });
    const t = lockBall; lockBall = balls[0]; balls[0] = t; }
  await slide(tok, ps[0].g, 4.6, 0, -1.4, 700); glow(ps[0].body, OKG);
  balls[0].position.set(5.15, 1.0, -1.4);
  cap('一開始 lock 是 false：P0 第一個換', '拿到 false（紅球）→ break while（注意分號）→ 進去');
  await step(tok);                                   // 1206 出來時 lock = false：把紅球還給我
  cd.hl(4);
  await slide(tok, ps[0].g, -4.4, 0, 2.2, 700); glow(ps[0].body, null);
  { const r0 = balls[0].position.clone(), l0 = lockBall.position.clone(), h0 = handPos(0);
    await anim(tok, 700, (u) => { balls[0].position.lerpVectors(r0, V3(0.75, 1.0, -1.4), u); lockBall.position.lerpVectors(l0, h0, u); });
    const t = lockBall; lockBall = balls[0]; balls[0] = t; }
  cap('出來的時候把 lock 設回 false', '就像把紅球還到我手上');
  await step(tok);                                   // 1214 N 個 process 都適用：程式碼完全一樣
  cap('P0、P1……可以 apply 到 N 個 process', '大家的程式碼長得完全一樣，沒有區分');
  await step(tok);                                   // 1228 搶到的人把 lock 變 true 擋住別人；出來再變 false
  { const r0 = lockBall.position.clone(), b0 = balls[1].position.clone();
    await anim(tok, 800, (u) => { lockBall.position.lerpVectors(r0, b0, u); balls[1].position.lerpVectors(b0, r0, u); });
    const t = lockBall; lockBall = balls[1]; balls[1] = t; }
  await slide(tok, ps[1].g, 4.6, 0, -1.4, 600); glow(ps[1].body, OKG);
  balls[1].position.set(5.15, 1.0, -1.4);
  ps[2].mood('sad'); glow(ps[2].body, NOR);
  cap('搶到的人（P1）讓 lock 變成 true', '擋住其他人：P2 換來換去都是藍球');
  await step(tok);                                   // 1252 跟 test-and-set 完全一樣：先 call 的進去
  good('跟 TestAndSet 一樣：lock 是 false 時，第一個 call swap 的人進去', 0, 4.9, 0);
  cap('原則跟 test-and-set 完全一樣', 'lock 是 false 時，第一個去 call swap 的人進去');
  await step(tok);                                   // 1289 ME：所有 key、lock 裡只有一個 false
  hd('ME ✓：全場只有一個 false（一顆紅球）', -2.6, 0.2, 3.8);
  cap('mutual exclusion 會滿足', '所有 key 和 lock 裡，同時只可能有一個是 false');
  await step(tok);                                   // 1314 progress 沒問題
  hd('progress ✓', 2.4, 0.2, 3.8);
  cap('progress 也沒問題', 'lock 是 false 時，第一個 call 的人可以 break');
  await step(tok);                                   // 1321 bounded waiting 不滿足：先 call 先進
  bad('bounded waiting ✗：沒有規則，先 call 先進', 4.2, 0.9, 3.8);
  cap('bounded waiting 一樣不滿足', '沒有規則，先 call 的人先進去');
  await step(tok);                                   // 1328 要 BW 就要排隊 → Bakery；不在乎就很 efficient
  note('要 bounded waiting → 排隊（Bakery，較複雜）；不在乎就很 efficient', 0, 5.6, -1.0);
  cap('很多 process 要滿足 bounded waiting 就要排隊', '像 Bakery 那樣比較複雜；不 care 的話很 efficient');
  void me;
}]);

FRAG.push(['syn-19b-condwait', 'cond_wait 為什麼要傳 mutex：一步一步看', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  const cl = code(CVL, -4.0, 6.0, 0.5, -2.6), cr = code(CVR, 4.0, 6.0, 0.5, -2.6);
  hd('action', -4.0, 6.6, -2.6); hot('counter', 4.0, 6.6, -2.6);
  room(0, 0.8, 0.2, 3.0, 1.6, 2.2); idx('critical section（mutex m）', 0, 1.8, 0.2);
  const X = bx('x = 1（示意）', SC.mem, 0, 0.35, -2.8, 2.0, 0.7, 0.9);
  const A = pal('A', '', PCS[0], -4.6, 0, 1.8, 0.65), C = pal('C', '', PCS[1], 4.6, 0, 1.8, 0.65);
  let L;
  await step(tok);                                   // 1357 一步一步看，為什麼兩邊都要在 mutex 裡
  cap('一步一步看', '為什麼兩邊都要在 mutex（critical section）裡');
  await step(tok);                                   // 1368 右邊一定在 CS：保護 x
  cr.hl(1);
  cap('右邊（counter）一定要在 critical section', '因為要保護 x');
  await step(tok);                                   // 1376 左邊也要配對在 CS，並把 mutex 交給 cond_wait
  cl.hl(2);
  cap('左邊也一定要配對在 critical section', '而且要把 mutex 這個 token 交給 cond_wait');
  await step(tok);                                   // 1390 假設 action 先進 CS：lock 住 mutex
  cl.hl(0);
  L = prop('lock', -4.6, 1.2, 1.8, 0.6);
  await slide(tok, A.g, -0.6, 0, 0.2, 700); glow(A.body, OKG);
  L.position.set(-0.6, 1.2, 0.8);
  cap('假如 action 先進 critical section', '它先把 mutex 給 lock 住');
  await step(tok);                                   // 1406 它做 wait；counter 拿不到 lock，進不去
  cl.hl(2); cr.hl(0);
  await slide(tok, C.g, 2.4, 0, 1.8, 600); glow(C.body, NOR); C.mood('sad');
  cap('x 不是 0：它做 wait 的動作', 'counter 這時拿不到 lock，進不了 critical section');
  await step(tok);                                   // 1422 waiting → put to sleep
  sleepy(A, true); glow(A.body, '#1a2a5a');
  cap('進到 waiting', '它被 put to sleep，不可能再被執行');
  await step(tok);                                   // 1429 counter 要進 CS 才能 signal → cond_wait 幫你 release lock
  await travel(tok, L, L.position.clone(), V3(0, 1.8, 2.2), 700);
  note('cond_wait 裡面會幫你 release mutex', -2.4, 2.8, 1.0);
  cap('counter 必須進 critical section 才能 signal', '你沒 call unlock，但 cond_wait 會幫你把 lock 放掉');
  await step(tok);                                   // 1448 counter 進去，x 變 0，signal
  await slide(tok, C.g, 0.8, 0, 0.2, 600); glow(C.body, OKG); C.mood('happy');
  await travel(tok, L, L.position.clone(), V3(0.8, 1.2, 0.8), 500);
  cr.hl(3); rl(X, 'x = 0');
  cap('counter 這才進到 critical section', 'x 減到 0，達成 condition → signal');
  await step(tok);                                   // 1465 叫醒 action，但它手上沒有 lock → 還卡在這行
  sleepy(A, false); A.mood('wow'); glow(A.body, '#6a4a00');
  cap('signal 把左邊叫起來', '但它手上沒有 lock：還是卡在 cond_wait 這一行');
  await step(tok);                                   // 1497 counter 離開後，action 重新取得 lock，執行
  cr.hl(4);
  await slide(tok, C.g, 4.6, 0, 1.8, 600); glow(C.body, null);
  await travel(tok, L, L.position.clone(), V3(-0.6, 1.2, 0.8), 500);
  cl.hl(3); glow(A.body, OKG); A.mood('happy');
  cap('等 counter 離開 critical section', 'action 重新取得 lock，才執行裡面的程式');
  await step(tok);                                   // 1526 看似兩人都在 CS：cond_wait 先 release、return 前 reacquire
  good('cond_wait：進去時 release mutex，醒來 return 前 reacquire', 0, 3.2, 1.6);
  cap('看似兩人都在 critical section：一個在等、一個在執行', 'cond_wait 先 release lock，醒來第一件事 reacquire');
  await step(tok);                                   // 1563 兩邊都要在 CS：API 把這個寫死
  note('Pthread 的 API 規定：兩邊都在 mutex 裡（避免錯誤）', 0, 4.0, 1.6);
  cap('所以兩邊都必須有 mutex', 'API 就把它寫死，避免一些 error');
  await step(tok);                                   // 1603 以後寫 Pthread 再留意
  cl.hl(-1); cr.hl(-1);
  cap('大家現在沒機會練習', '以後寫 Pthread 可以再留意這個運作機制');
}]);

// ════════ jJZ8egWNiWo（第 20A 講）：期中考檢討（各題的觀念與計算）、synchronization 回顧 ════════
const card = (t, c, x, y, z, w = 3.0) => bx(t, c, x, y, z, w, 0.6, 0.9, 1.5);
FRAG.push(['syn-20a-terms', '期中考第 1 題：名詞解釋的 keyword', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  await step(tok);                                   // 15 第一題名詞解釋：一定要有 keyword
  hd('第 1 題：名詞解釋 → 一定要提到 keyword', 0, 6.2);
  cap('第一題：名詞解釋', '評分標準：一定要提到那些 keyword');
  await step(tok);                                   // 20 system call：OS 的 interface，call OS 的 service
  card('system call', PCS[0], -4.4, 0.3, -2.4); idx('OS 的 interface：呼叫 OS 的 service', -4.4, 1.1, -1.6);
  cap('system call：OS 的 interface', '用來 call OS 的 service，不只是一般的 function call');
  await step(tok);                                   // 49 context switch：交換執行的 process
  card('context switch', PCS[1], 0, 0.3, -2.4); idx('process 執行時做交換', 0, 1.8, -1.6);
  cap('context switch', 'process 執行的時候做交換的動作');
  await step(tok);                                   // 56 microkernel：modularized，切成很多 component
  card('microkernel', PCS[3], 4.4, 0.3, -2.4);
  const k = zone('kernel space', 4.4, 0.02, 0.6, 3.6, 1.6, '#e0d6f5');
  k.userData.name.position.set(6.4, 0.07, 0.6);   // name beside the zone, clear of A/B/C
  ['A', 'B', 'C'].forEach((n, i) => bx(n, PCS[3], 3.4 + i * 1.0, 0.25, 0.6, 0.7, 0.5, 0.7, 1.2));
  cap('microkernel OS：第一，它是 modularized', '把 OS 切成很多 component');
  await step(tok);                                   // 73 不重要的 component 移到 user space，用 message passing 溝通
  const us = zone('user space', 4.4, 0.02, 3.0, 3.6, 1.6, '#d8e6cf');
  us.userData.name.position.set(6.4, 0.07, 3.0);
  bx('B', PCS[3], 4.4, 0.25, 3.0, 0.7, 0.5, 0.7, 1.2); bx('C', PCS[3], 5.4, 0.25, 3.0, 0.7, 0.5, 0.7, 1.2);
  idx('message passing', 4.4, 1.3, 1.8);
  cap('更重要：不重要的 component 移到 user space', '再透過 message passing 溝通（漏掉會扣分）');
  await step(tok);                                   // 106 time sharing：分享 CPU；timer → context switch
  card('time sharing', PCS[2], -4.4, 0.3, 1.4); idx('分享 CPU：timer 定期觸發 context switch', -4.4, 1.1, 2.2);
  cap('time sharing：讓 CPU 的資源做分享', '詳細一點：timer 機制，定期做 context switch');
  await step(tok);                                   // 122 privileged instruction：只有 kernel mode 能執行
  card('privileged instruction', PCS[4], -4.4, 0.3, 3.6); idx('只有 kernel mode 才能執行', -4.4, 0, 4.5);
  cap('privileged instruction', '只有在 kernel mode 才可以執行的 instruction');
  void k;
}]);

FRAG.push(['syn-20a-segpage', '第 3 題：為什麼 segmentation 在上、paging 在下', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let seg, pg;
  await step(tok);                                   // 161 第三題非常重要
  hd('第 3 題：segmentation + paging 的順序', 0, 6.2);
  cap('第三題非常重要', '上課還特別提醒過');
  await step(tok);                                   // 171 segmentation 在上（靠近 user），paging 在下
  seg = zone('segmentation（靠近 user）', 0, 2.6, -1.0, 9.0, 1.6, '#d6e6f6');
  pg = zone('paging（管 physical memory）', 0, 0.02, 1.4, 9.0, 1.8, '#f3e6c8');
  seg.userData.name.position.z = 0.0;   // seg name on its front edge, clear of the segment blocks
  cap('為什麼一般設計是 segmentation 在上面', '靠近 user；paging 在下面');
  await step(tok);                                   // 182 segmentation 符合程式的 organization：大小不一
  [['code', 1.6, PCS[0]], ['heap', 2.4, PCS[1]], ['stack（local）', 1.2, PCS[3]]].forEach(([n, w, c], i) => bx(n, c, -3.0 + i * 3.0, 2.9, -1.0, w, 0.5, 0.8, 1.2));
  cap('segmentation 比較符合程式碼的 organization', 'code、heap、local variable 各一個 segment，大小不一定');
  await step(tok);                                   // 205 OS 管 physical memory 時希望固定大小 → page table
  for (let i = 0; i < 7; i++) bx('', '#e8c98c', -3.6 + i * 1.2, 0.3, 1.4, 1.0, 0.5, 1.0, 1.2);
  idx('固定大小的 frame（示意）', 0, 0.9, 2.6);
  cap('OS 管理 physical memory 時希望大小固定', '用簡單的 page table mapping 管理');
  await step(tok);                                   // 220 很快找到空間、沒有 external fragmentation
  good('很快找到空位、沒有 external fragmentation', 0, 0, 3.6);
  cap('很快可以找到哪裡有空間', '也不會有 external fragmentation');
  await step(tok);                                   // 225 效能 → 底層處理；靠近使用者的方便 compiler
  note('下層：效能（paging）　上層：方便 compiler（segmentation）', 0, 4.6, -1.0);
  cap('效能的考量交給底層的 paging', '靠近使用者的方便 compiler 放程式：segmentation');
  await step(tok);                                   // 245 要明確講出為什麼這樣排
  hot('答題要明確講出「為什麼」這樣排', 0, 5.4, -1.0);
  cap('答案必須明確講出為什麼是這個 ordering', '各三分');
  void seg; void pg;
}]);

FRAG.push(['syn-20a-q456', '第 4–6 題：TLB、dynamic loading / linking、memory-mapped file', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  await step(tok);                                   // 272 Q4：TLB = page table 的 cache；為什麼要 flush
  const q4 = card('TLB = page table 的 cache', PCS[0], -4.2, 0.3, -2.4, 3.4);
  const i4 = idx('page table 很多個、TLB 只有一個 → context switch 要 flush', -4.2, 1.3, -1.6);
  cap('第四題 TLB：就是 page table 的 caching', '為什麼要 flush？page table 很多、TLB 只有一個');
  await step(tok);                                   // 288 Q5：dynamic loading vs linking，不要搞反
  hd('第 5 題：dynamic loading vs dynamic linking（別搞反）', 0, 6.2);
  cap('第五題：dynamic loading、dynamic linking', '答案有點長，重點是不要搞反');
  await step(tok);                                   // 299 loading：減少單一 process 的 memory 使用
  const q5a = card('dynamic loading', PCS[1], 0, 0.3, -2.4);
  const i5a = idx('單一 process：用到才載入，不用一次全部載進 memory', 0, 2.0, -1.6);
  cap('dynamic loading：減少單一 process 的 memory 使用', '不用一次全部 load 進去');
  await step(tok);                                   // 314 linking：process 之間 share library，runtime 才 link
  const q5b = card('dynamic linking', PCS[3], 4.2, 0.3, -2.4);
  const i5b = idx('process 間共用 library：runtime 才 link；別人載過就不用重複', 4.2, 2.7, -1.6);
  cap('dynamic linking：process 之間 share library', 'runtime 才 link；別人已經載進 memory 就不用重做');
  await step(tok);                                   // 342 Q6：memory-mapped file
  gone(q4, i4, q5a, i5a, q5b, i5b);
  hd('第 6 題：memory-mapped file', 0, 5.4);
  prop('file', -4.6, 0, 1.6, 1.0); const mm = bx('memory', SC.mem, -1.6, 0.4, 1.6, 2.0, 0.8, 1.0, 1.5);
  arr(-4.0, 0.7, -2.6, 0.7, '#8a7a5c', 1.6);
  cap('第六題：memory-mapped file', '把 file 對應到 memory 來操作');
  await step(tok);                                   // 358 好處：快；壞處：不 reliable（一停電就沒了）
  good('好處：快', -1.6, 1.4, 1.6); bad('壞處：不 reliable，停電就沒了', -1.6, 2.0, 1.6);
  cap('好處：放在 memory 比較快', '壞處：不太 reliable，一停電 memory 的東西全沒了');
  await step(tok);                                   // 370 很多人改 → synchronization；file system 會保護
  note('很多人同時改 → 又是 synchronization 問題；file system 會幫你保護、能 recover', 0, 4.6, -1.0);
  cap('content 可能很多人同時改：synchronization issue', '透過 file system 會幫你保護、斷電也能復原');
  await step(tok);                                   // 404 實際應用：I/O device 都透過 memory-mapped file
  prop('monitor', 3.6, 0, 1.4, 0.9);
  idx('Linux：每個 I/O device 都有對應的 file（其實是 device 的 memory）', 2.0, 0, 3.8);
  cap('實際應用：大部分 I/O device', '在 Linux 都有對應的 file，用 memory-mapped 的方式做 I/O');
  await step(tok);                                   // 440 適合大量資料傳輸
  good('適合大量資料傳輸', 3.6, 3.1, 2.8);
  cap('主要適合大量資料的傳輸', '一次把整塊 data 寫出去');
  void mm;
}]);

FRAG.push(['syn-20a-pagetable', '第 7 題：三種 page table 適合哪種系統', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const xs = [-4.4, 0, 4.4];
  let cs = [];
  await step(tok);                                   // 462 Q7：三個 use case
  hd('第 7 題：三個 use case 各適合哪種 page table', 0, 6.2);
  cap('第七題：給了三個 use case', '解釋各適合什麼樣的 page table');
  await step(tok);                                   // 476 要知道 inverted / one-level / hashed 的優缺點
  cs = ['one-level', 'hashed', 'inverted'].map((t, i) => card(t, [PCS[0], PCS[2], PCS[3]][i], xs[i], 0.3, -2.4, 2.6));
  cap('最主要：知道 inverted page table 的優缺點', '還有一般 one-level、hashed page table 的優缺點');
  await step(tok);                                   // 497 case 1：很 scattered 的 user memory
  idx('case 1：user memory 很 scattered（用到的 frame 不多、page 很分散）', 0, 4.8, -2.4);
  cap('第一個系統：很 scattered 的 user memory', '真的用到的 frame 不多，但 page 非常分散');
  await step(tok);                                   // 522 小題：為什麼 page table 要拆：不想要連續的 physical memory
  bad('page table 很大 → 要一大塊連續 physical memory ✗', 0, 3.8, 0);
  cap('小題：為什麼 page table 要用不同形式存', '不希望 allocate 一塊連續的 physical memory');
  await step(tok);                                   // 538 拆成小塊用 pointer 串起來，每塊 fit 一個 frame（4KB）
  [0, 1, 2].forEach((i) => bx('', '#e8c98c', -1.2 + i * 1.2, 0.3, 1.2, 1.0, 0.5, 1.0, 1.2));
  idx('拆成小塊、用 pointer 串：每塊放得進一個 frame（通常 4KB）', 0, 1.0, 2.2);
  cap('所以 break down 成很多小 piece，用 pointer 串起來', '每塊 fit in 一個 frame（通常 4KB）');
  await step(tok);                                   // 553 case 1 → hashed：每個 bucket 的 item 很少
  glow(cs[1], DIM); good('case 1 → hashed', xs[1], 1.1, -2.4);
  cap('case 1 很 scattered → hash', '範圍大但用到的少，每個 bucket 的 item 很少，查得快');
  await step(tok);                                   // 586 case 2：很快的 memory → one-level 最快
  glow(cs[0], DIM); good('case 2 → one-level（只查一次）', xs[0], 1.1, -2.4);
  cap('第二個：很快的 memory', 'one-level 只查一次 page table，最快、最直接');
  await step(tok);                                   // 600 case 3：大量 process → inverted
  glow(cs[2], DIM); good('case 3 → inverted（一張表）', xs[2], 1.1, -2.4);
  cap('第三個：large number of processes', '每個都有 page table 太浪費；又不用考慮 page sharing → inverted');
}]);

FRAG.push(['syn-20a-belady', "第 8 題：Belady's anomaly 與 LRU", async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  await step(tok);                                   // 639 Belady's anomaly：frame 增加，page fault 反而增加
  hd("第 8 題：Belady's anomaly", 0, 6.2);
  const f3 = bx('3 frames', '#e8c98c', -3.0, 0.3, -1.0, 2.0, 0.5, 0.9, 1.2), f4 = bx('4 frames', '#e8c98c', 1.4, 0.3, -1.0, 2.6, 0.5, 0.9, 1.2);
  bad('frame 變多 → page fault 反而增加', 0, 1.4, -1.0);
  cap('增加 memory frame 的數量', 'page fault 不但沒減少，反而增加（持平也不算）');
  await step(tok);                                   // 663 為什麼重要：管理者沒辦法 tune
  const ad = pal('管理者', '', PCS[0], 4.6, 0, 1.6, 0.7); ad.mood('wow');
  const tune = bub('給更多 resource，到底會變好還是變壞？', 3.6, 3.0, 1.6);
  cap('有 anomaly，系統管理者就很難管理', '不知道給 resource 是變好還是變壞，沒辦法 tune');
  await step(tok);                                   // 699 LRU 沒有 anomaly：frame 多就 cover 更多最近的 page
  remove(tune);
  const st = [3, 4].map((n, j) => [...Array(n)].map((_, i) => bx('', j ? '#bfe6cf' : '#d6e6f6', -3.4 + j * 3.4, 0.3 + i * 0.55, 2.4, 1.4, 0.5, 0.8)));
  idx('3 frames 的內容 ⊆ 4 frames 的內容（最近用過的 page）', -1.7, 0.2, 3.6);
  good('LRU：往過去看，frame 越多 cover 越多最近的 page', 0, 3.2, 2.4);
  cap('LRU 為什麼沒有這個 anomaly？', '它往過去 history 看：給越多 frame，就 include 越多最近的 page');
  await step(tok);                                   // 733 不要求嚴謹數學，概念講出來就好
  note('不需要嚴謹證明，概念說得出來就可以', 0, 4.6, 2.4);
  cap('這題不要求數學或很嚴謹的解釋', '把概念說出來就可以');
  void f3; void f4; void st;
}]);

FRAG.push(['syn-20a-faults', '第 10 題：算 page fault 次數（答案 7）', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const fr = [0, 1, 2].map((i) => { const m = bx('', '#f3e6c8', -1.6 + i * 1.6, 0.35, -1.6, 1.3, 0.7, 1.0); idx('frame ' + i, -1.6 + i * 1.6, 0, -0.8); return m; });
  let faults = 0; const fl = tag('page fault：0', 'ptr alt', 4.6, 2.4, -1.6);
  const F = (n = 1) => { faults += n; tx(fl, 'page fault：' + faults); };
  const seq = [];
  await step(tok);                                   // 828 程式只用一個 page 放 code
  hd('第 10 題：3 個 frame，算 page fault', 0, 6.2);
  cap('第十題，錯比較多但概念很單純', '這個程式的 code 只用到一個 page');
  await step(tok);                                   // 837 每執行一個指令都 access code page → 一直佔第一個 frame
  rl(fr[0], 'code'); glow(fr[0], DIM); F();
  cap('每執行一個 instruction 都會 access code 的 page', 'load program 時第一個 page fault，之後一直佔住第一個 frame');
  await step(tok);                                   // 888 array A：每個 element 4 byte、page 1000 byte → 250 個 → 4 個 page
  const A = [1, 2, 3, 4].map((k) => bx('A 的 page ' + k, PCS[k - 1], -4.6 + (k - 1) * 3.0, 0.3, 2.6, 2.6, 0.5, 0.8, 1.2));
  idx('每個 element 4 bytes、每個 page 1000 bytes → 一頁放 250 個 → 共 4 個 page', 0, 1.0, 3.6);
  cap('A：element 4 byte、page 1000 byte', '每頁放 250 個 → 需要 4 個 page');
  await step(tok);                                   // 914 依序讀這 4 個 page → 第一次全部 page fault
  const t = tag('access：', 'idx', 0, 4.8, -1.6);
  for (const p of [1, 2, 3, 4]) { seq.push(p); tx(t, 'access：' + seq.join(' ')); F(); rl(fr[1 + ((p - 1) % 2)], 'A' + p); await wt(tok, 350); }
  cap('第一次依序讀這 4 個 page', '全部都是 page fault（code 1 + 4 = 5 次）');
  await step(tok);                                   // 925 存取順序 1 2 3 4 4 3 2 1；只剩 2 個 frame 給 data
  idx('順序：1 2 3 4 4 3 2 1　（code 佔 1 個 → data 只剩 2 個 frame）', 0, 5.5, -1.6);
  cap('page 的存取順序是 1 2 3 4 4 3 2 1', '三個 frame，第一個被 code 佔了，只剩兩個');
  await step(tok);                                   // 938 1234 之後 frame 裡是 3、4 → 讀回來 4、3 是 hit
  for (const p of [4, 3]) { seq.push(p); tx(t, 'access：' + seq.join(' ')); glow(fr[1 + ((p - 1) % 2)], OKG); await wt(tok, 450); }
  cap('1 2 3 4 讀完，frame 裡剩 3、4', '讀回來的 4、3 都是 hit，不會 page fault');
  await step(tok);                                   // 962 2、1 又 page fault
  fr.forEach((m, i) => i && glow(m, null));
  seq.push(2); tx(t, 'access：' + seq.join(' ')); rl(fr[2], 'A2'); F(); glow(fr[2], NOR); await wt(tok, 450);
  seq.push(1); tx(t, 'access：' + seq.join(' ')); rl(fr[1], 'A1'); F(); glow(fr[1], NOR);
  cap('2、1 很不幸又會產生 page fault', 'LRU 或其他演算法結果都一樣');
  await step(tok);                                   // 976 一共 7 次
  good('code 1 + 第一次 4 + 回程 2 = 7', 4.6, 3.2, -1.6);
  cap('一共 7 次', 'code 1 次、第一次掃過 4 次、回來 2 次');
  await step(tok);                                   // 985 data layout 很重要：I/O bound、大資料
  note('分析程式的 page access pattern：資料塞不進 memory 就會一直 page fault', 0, 4.2, 1.0);
  cap('這就是為什麼 memory / data 的 layout 很重要', '大資料塞不進 memory，就在讀資料時卡住');
  await step(tok);                                   // 1025 code 佔一個；切資料用 4KB 對齊 page
  hot('切資料用 4KB：match page size → 減少 page fault', 0, 7.0, -1.6);
  cap('code 會佔掉一個 frame', '很多程式切資料用 4KB：match page，減少 page fault');
  void A;
}]);

FRAG.push(['syn-20a-addr', '最後幾題：address bits、page table 大小、TLB、位址轉換', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let addr;
  await step(tok);                                   // 1079 最後一題：address 的 bit
  hd('address bits：從題目的敘述找答案', 0, 6.2);
  cap('最後一題看似複雜，其實不複雜', '問 memory address 的 bit，從題目裡找答案');
  await step(tok);                                   // 1094 offset bit = page size：1KB → 10 bits
  addr = [bx('page #', PCS[0], -3.0, 0.4, -1.6, 1.6, 0.8, 1.0, 1.5), bx('offset：10 bits', PCS[2], -0.4, 0.4, -1.6, 3.4, 0.8, 1.0, 1.5)];
  idx('page size = 1KB = 2^10 → offset 10 bits', -1.6, 1.3, -1.6);
  cap('offset 的 bit 數由 page size 決定', 'page size 1KB → 10 個 bit');
  await step(tok);                                   // 1126 page table 大小 = entry 數 × 每個 entry 的 byte
  note('page table 大小 = entry 數 × 每個 entry 幾 byte', 0, 4.6, -1.6);
  cap('整個 page table 要多少 memory？', '先知道幾個 entry，再乘上一個 entry 要幾個 byte');
  await step(tok);                                   // 1142 logical address 12 bits − 10 = 2 → 4 entry × 4 byte
  rl(addr[0], 'page #：2 bits');
  idx('logical address 12 bits − offset 10 = 2 bits → 2² = 4 個 entry', 0, 3.6, -0.4);
  good('4 entries × 4 bytes = 16 bytes', 0, 2.8, -0.4);
  cap('logical address 12 bit，用了 10 個 → 剩 2 bit', '4 個 entry × 每個 4 byte');
  await step(tok);                                   // 1167 access time：TLB 有幾個 hit
  const tlb = bx('TLB（2 entries）', PCS[3], 3.8, 0.4, 1.6, 2.8, 0.8, 1.0, 1.5);
  cap('算 memory access time 的題目', '重點：TLB 到底有幾個 hit');
  await step(tok);                                   // 1183 看每個 access 是不是同一個 page；第一次 access 的會 miss
  idx('同一個 page → 可能 hit；第一次 access 的 page → miss', 3.8, 1.4, 2.6);
  cap('看每個 access 是不是在同一個 page', 'TLB 只有兩個 entry；第一次 access 的會 miss');
  await step(tok);                                   // 1222 公式：hit = TLB + memory；miss 多一次 page table（100）
  const hitN = note('hit：TLB + 1 次 memory　miss：再多一次 page table（題目的 100）', 0, 0.2, 4.4);
  cap('知道 hit / miss 再套公式', 'miss 多一個 100：要多 access 一次 page table');
  await step(tok);                                   // 1257 給 logical 和 physical address：找 entry 與 frame number
  gone(tlb, hitN);
  idx('logical → physical：page number 查 page table 得到 frame number', 0, 0.2, 3.4);
  cap('最後：logical、physical address 都給了', '問 access 的是 page table 第幾個 entry、frame number 多少');
  await step(tok);                                   // 1280 page number 0 → 第 0 個 entry；frame bits 11 → 第 3 個 frame
  bx('page 0 → entry 0', PCS[0], -2.4, 0.3, 2.4, 2.6, 0.5, 0.8, 1.2); bx('frame bits 11 → frame 3', PCS[2], 2.4, 0.3, 2.4, 3.2, 0.5, 0.8, 1.2);
  arr(-1.0, 0.5, 0.6, 0.5, '#8a7a5c', 2.4);
  cap('轉成 bit 後看前面的 page number、frame number', 'page number 0 → 第 0 個 entry；frame 是 11 → 3');
}]);

FRAG.push(['syn-20a-review', 'Synchronization 回顧：mutex lock 與 condition variable', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const ts = [0, 1, 2].map((k) => pal('T' + k, '', PCS[k], -4.6 + k * 1.3, 0, 2.2, 0.6));
  await step(tok);                                   // 1361 上次卡在一半，再完整 review，並補充
  hd('回顧：上次講到一半的 synchronization', 0, 6.2);
  cap('上次卡在一半', '先完整 review，再補充一些內容');
  await step(tok);                                   // 1380 Pthread 這種 shared memory 平行程式要處理 synchronization
  const mem = bx('shared memory', SC.mem, 0, 0.45, -1.6, 2.6, 0.9, 1.1, 2);
  cap('寫 Pthread 這種 shared memory 的平行程式', '就要處理 synchronization 的 issue');
  await step(tok);                                   // 1398 synchronization：控制執行序的順序或時間點
  note('synchronization = 控制執行的順序、時間點', 0, 4.6, -1.0);
  cap('synchronization 指的是', '控制這些執行序的順序，或執行的時間點');
  await step(tok);                                   // 1410 目的一：解決 race condition（結果無法預測）
  bad('目的 ①：解決 race condition（結果無法預測）', -3.0, 3.6, -1.0);
  cap('目的一：解決 race condition', '結果沒辦法預測，programmer 不要的');
  await step(tok);                                   // 1425 工具：Pthread 的 mutex lock，不用自己寫 entry / exit
  const L = prop('lock', 2.2, 0, -1.4, 1.0, 'mutex');
  cap('工具：Pthread 提供的 mutex lock', '不用自己寫 entry、exit，包成一個 function call');
  await step(tok);                                   // 1446 課堂要看 lock / unlock 的實作方式
  idx('課堂重點：lock / unlock 是怎麼實作的', 2.2, 1.8, -1.4);
  cap('課堂更想介紹的是', 'lock 跟 unlock 的實作方式有哪些');
  await step(tok);                                   // 1456 目的二：condition variable 控制觸發的時機
  hot('目的 ②：condition variable 控制「什麼時候」執行', 3.0, 3.6, -1.0);
  cap('第二類用法：condition variable', '控制或觸發這些執行序執行的時機點');
  await step(tok);                                   // 1476 像一個 event waiting queue：wait、signal、broadcast
  ts.forEach((t) => sleepy(t, true));
  const evq = zone('event waiting queue', -3.3, 0.02, 2.2, 4.4, 1.4, '#dfe3f3');
  evq.userData.name.position.z = 2.2 + 0.7 + 0.35;   // name in front of the sleeping threads
  cap('condition variable 像 event waiting queue', 'wait 就 block；signal 叫醒一個、broadcast 叫醒全部');
  await step(tok);                                   // 1517 很多語言都有，實作不同、概念相同
  idx('各語言、library 的實作不同，概念相同', 2.6, 0.2, 3.4);
  cap('很多平行程式語言都有 condition variable', '實作方式不同，但概念完全相同');
  await step(tok);                                   // 1550 Pthread：wait、signal、broadcast；wait 要丟一個 mutex
  code(['pthread_cond_wait(&c, &m);', 'pthread_cond_signal(&c);', 'pthread_cond_broadcast(&c);'], 3.0, 2.4, 0.45, 1.6);
  cap('Pthread 的 wait、signal、broadcast', '特別的是 wait 還要丟一個 mutex lock 給它');
  await step(tok);                                   // 1587 原因：觸發 condition 的變數（x）要被保護
  sleepy(ts[0], false); ts[0].mood('happy');
  bad('觸發 condition 的變數（例如 x）要被 critical section 保護', 0, 5.4, -1.0);
  cap('觸發條件的不是 condition variable 本身', '而是像 x 這種變數，它需要被 critical section 保護');
  await step(tok);                                   // 1616 Pthread 規定的 coding style；C++ 不一樣
  note('這是 Pthread 規定的 coding style；C++ 等其他 library 寫法可能不同', 0, 0.9, 3.4);
  cap('這是 Pthread 認為好的 coding style', '其他 library（例如 C++）寫法可以不一樣');
  void mem; void L;
}]);

// ════════ k0XaqQzTW_I（第 20B 講）：cond_wait 釋放 lock、thread pool、hardware 回顧、semaphore 概念與 spinlock、POSIX API ════════
// the action / counter picture for condition variables (shared with 19B's code)
function cvStage() {
  const cl = code(CVL, -4.0, 6.0, 0.5, -2.6), cr = code(CVR, 4.0, 6.0, 0.5, -2.6);
  hd('action', -4.0, 6.6, -2.6); hot('counter', 4.0, 6.6, -2.6);
  room(0, 0.8, 0.2, 3.0, 1.6, 2.2); idx('critical section（mutex m）', 0, 1.8, 0.2);
  const X = bx('x = 1（示意）', SC.mem, 0, 0.35, -2.8, 2.0, 0.7, 0.9);
  const A = pal('A', '', PCS[0], -4.6, 0, 1.8, 0.65), C = pal('C', '', PCS[1], 4.6, 0, 1.8, 0.65);
  const L = prop('lock', -2.4, 0, 3.2, 0.6);
  return { cl, cr, X, A, C, L };
}
FRAG.push(['syn-20b-cvwait', 'cond_wait 會先 release lock、醒來再 reacquire', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  const S = cvStage();
  const lockTo = (x, y, z) => travel(tok, S.L, S.L.position.clone(), V3(x, y, z), 600);
  await step(tok);                                   // 15 兩個都在 CS：action 在裡面 wait 不就出不來？→ deadlock？
  await slide(tok, S.A.g, -0.6, 0, 0.2, 600); glow(S.A.body, OKG); await lockTo(-0.6, 1.2, 0.8);
  S.cl.hl(2); sleepy(S.A, true); glow(S.C.body, NOR); S.C.mood('sad');
  const dlq = bub('action 在裡面睡 → counter 進不來 → deadlock？', 0, 3.2, 1.6);
  cap('兩個都在 critical section：action 在裡面 wait', '它出不來、signal 的人又進不來 → 不就 deadlock？');
  await step(tok);                                   // 47 原因：call wait 時把 lock release 掉
  await lockTo(0, 1.8, 2.4);
  cap('所以 call wait 的同時', '會把 lock 給 release 掉，讓 signal 的 thread 也能進來');
  await step(tok);                                   // 67 thread 被放進 waiting queue 睡覺 → inactive
  remove(dlq);
  const slp = note('在 waiting queue 裡 put to sleep：inactive', -2.6, 2.6, 0.2);
  cap('它被放進 waiting queue、put to sleep', '就算在 critical section 裡，它也不 active');
  await step(tok);                                   // 80 lock 放掉 → 別人進來 signal → 不會 deadlock
  S.cr.hl(0); await slide(tok, S.C.g, 0.8, 0, 0.2, 600); glow(S.C.body, OKG); S.C.mood('happy'); await lockTo(0.8, 1.2, 0.8);
  S.cr.hl(3); rl(S.X, 'x = 0');
  cap('lock 放掉，其他人才有機會進 critical section', '進去後 signal 把它叫起來 → 不會 deadlock');
  await step(tok);                                   // 92 被叫醒後也不會兩個同時執行：要先 acquire lock
  sleepy(S.A, false); S.A.mood('wow'); glow(S.A.body, '#6a4a00');
  cap('被叫起來後，也不用擔心兩個同時執行', '它要先 acquire lock，才能從 function return');
  await step(tok);                                   // 116 等 counter 離開、release lock 才能 reacquire
  S.cr.hl(4); await slide(tok, S.C.g, 4.6, 0, 1.8, 600); glow(S.C.body, null);
  await lockTo(-0.6, 1.2, 0.8); S.cl.hl(3); glow(S.A.body, OKG); S.A.mood('happy');
  cap('醒了、active 了，但要等 counter 離開', 'release lock 之後才重新 acquire，繼續執行');
  await step(tok);                                   // 136 為什麼 cond_wait 要傳 mutex：library 要知道是哪一把
  S.cl.hl(2);
  remove(slp);
  good('library 幫你 release、再 reacquire → 要知道是哪一把 lock（同一個 object）', 0, 3.0, 1.6);
  cap('這就是 call cond_wait 還要給 mutex 的原因', 'library 幫你 release、reacquire，要知道是哪一把');
  await step(tok);                                   // 179 這樣寫，自然會記得放在 critical section 裡
  idx('不放在 critical section 裡，連 mutex 都不知道要傳什麼 → 相輔相成', 0, 0.2, 3.6);
  cap('這樣你寫 cond_wait 時', '一定會放在 critical section 裡：相輔相成');
  await step(tok);                                   // 208 step by step：action 先 acquire lock，wait 時 release
  S.cl.hl(0);
  cap('step by step：action 先 acquire lock', '到 wait 時，function 裡面幫你 call unlock');
  await step(tok);                                   // 235 counter 才能進 CS，做 signal
  S.cr.hl(3);
  cap('只有這樣，旁邊的 counter 才能進 critical section', '然後做 signal');
  await step(tok);                                   // 242 被 wake up，但沒有 lock → 卡在 reacquire
  S.cl.hl(2);
  cap('signal 後 action 立刻被 wake up', '但手上沒有 lock，會卡在 reacquire');
  await step(tok);                                   // 268 counter 離開後 action 才 acquire lock、繼續
  S.cl.hl(3); S.cr.hl(-1);
  cap('等 counter 結束、離開之後', 'action 才 acquire lock，繼續執行');
  await step(tok);                                   // 285 Java、C++ 等也有 condition variable，寫法不同
  S.cl.hl(-1);
  note('Java、C++ 等也有 condition variable，寫法依 library 而不同', 0, 4.0, 1.6);
  cap('Java、C++ 等語言也支援 condition variable', '但 coding、實作方式可能不一樣');
}]);

FRAG.push(['syn-20b-pool', 'Thread pool：用 condition variable 實作', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const W = [0, 1, 2, 3].map((k) => pal('T' + k, '', PCS[k + 1], -1.8 + k * 1.3, 0, -1.6, 0.6));
  let M, job, q;
  const work = (k, x = 3.2, z = 2.4) => slide(tok, W[k].g, x, 0, z, 600);
  await step(tok);                                   // 314 補充：thread pool
  const tp = zone('thread pool', 0.2, 0.02, -1.6, 6.0, 1.6, '#e0d6f5');
  tp.userData.name.center.set(1, 0.5); tp.userData.name.position.set(-3.0, 0.07, -1.6);   // name left of the pool, clear of T0–T3
  cap('補充：之前教過的 thread pool', 'multi-thread programming 很好用的 technique');
  await step(tok);                                   // 329 先 create thread 放著，有工作才給它做，做完不 terminate
  await work(0); glow(W[0].body, OKG); await wt(tok, 300); await work(0, -1.8, -1.6); glow(W[0].body, null);
  cap('先 create 好 thread 放在那裡', '有工作就讓它做，做完不 terminate，留著等下一件');
  await step(tok);                                   // 344 不用一直 create / delete；控制 thread 的數量
  note('不用一直 create / delete；可以控制 thread 總數', 0.2, 2.2, -1.6);
  cap('重點：thread 不用一直 delete、create', '更重要的是能控制系統裡用了多少 thread');
  await step(tok);                                   // 356 request 一多就 create 一堆 → context switch、變慢
  bad('request 一多就開一堆 thread → 一堆 context switch，大家都慢', 0.2, 3.0, -1.6);
  cap('不然 request 一多就 create 一堆 thread', 'CPU 資源有限 → 一堆 context switch，整體更糟');
  await step(tok);                                   // 373 控制 pool 大小 → 效能最佳化
  good('控制 pool 的大小 → 整體效能最佳化', 0.2, 3.8, -1.6);
  cap('控制 thread pool 的大小', '來控制整個系統的效能，達到最佳化');
  await step(tok);                                   // 381 一種實作：condition variable
  hot('實作方式：condition variable', 0.2, 4.6, -1.6);
  cap('今天要提的是 thread pool 的一種實作方式', '透過 condition variable');
  await step(tok);                                   // 392 給 thread 一個 function pointer + argument
  job = bx('function ptr + argument', '#f3d36b', -4.6, 0.4, 2.4, 3.2, 0.7, 0.9, 1.5);
  cap('怎麼讓 thread 執行不同的工作？', '塞給它一個 function pointer 和 argument');
  await step(tok);                                   // 415 thread 的 function：while loop 等被叫醒→執行→再等
  W.forEach((t) => sleepy(t, true));
  q = code(['while (true) {', '  lock(&m);', '  cond_wait(&c, &m);', '  f = job.func; a = job.arg;', '  unlock(&m);', '  f(a);', '}'], 4.6, 6.0, 0.48, -2.6);
  cap('thread 執行的 function 是一個 while loop', '等著被叫醒 → 執行 data structure 裡的 function → 再等');
  await step(tok);                                   // 435 大家 wait 在同一個 condition variable
  q.hl(2);
  cap('怎麼知道什麼時候被叫起來？', '所有 thread 都 wait 在同一個 condition variable 上');
  await step(tok);                                   // 453 master 收到 request → 填好 data → signal 一個
  M = pal('master', '', '#c9b48e', -5.6, 0, 0.0, 0.75);
  const r = pkt('request', -6.4, 1.4, 1.2); await travel(tok, r, V3(-6.4, 1.4, 1.2), V3(-4.6, 1.4, 2.4), 600); remove(r);
  cap('前面有一個 master server：接到 request', '把 function pointer、argument 填好，再 signal 叫醒一個');
  await step(tok);                                   // 475 實作：data structure、pool、CV 與 mutex 共用
  idx('pool 共用：condition variable c ＋ mutex m', 0.2, 0.9, -0.6);
  cap('實作上：定義 data structure、thread pool', '最重要：整個 pool 共用的 condition variable 和 mutex');
  await step(tok);                                   // 513 事先 create；記錄 thread count、多少 active
  idx('thread count：知道幾個 active、幾個 available', -5.6, 0, 1.2);
  cap('事先 create 好 thread pool', '記錄 thread count，master 就知道什麼時候能 signal');
  await step(tok);                                   // 548 signal 不在乎是誰：waiting queue 的第一個
  sleepy(W[0], false); W[0].mood('happy');
  cap('condition variable 的 signal 不 care 是誰', 'waiting queue 的第一個來做就對了，一次一個');
  await step(tok);                                   // 568 create 後什麼都不做：cond_wait → put to sleep
  q.hl(2);
  cap('thread 被 create 之後其實什麼都不做', '在 cond_wait 上 put to sleep，在 waiting queue 等');
  await step(tok);                                   // 604 被 signal 叫醒 → 照 data structure 執行
  q.hl(5);
  await work(0); glow(W[0].body, OKG);
  const pj = job.position.clone(); await travel(tok, job, pj, V3(3.2, 1.5, 2.4), 600);
  cap('被 signal 叫起來後', '照 data structure 裡的 function 和 argument 去執行');
  await step(tok);                                   // 632 做完回到 cond_wait 等下一個工作，不會被 terminate
  kill(job); await work(0, -1.8, -1.6); glow(W[0].body, null); sleepy(W[0], true); q.hl(2);
  cap('處理完，loop 回去又 condition wait', '等著接下一個工作；thread 不會被 terminate');
  await step(tok);                                   // 662 lock → cond_wait → unlock：一次只一人操作 data structure
  q.hl(1);
  good('lock → cond_wait → unlock：一次只有一個人碰 data structure', 0.2, 5.4, -1.6);
  cap('一樣是 Pthread 的流程：lock、cond_wait、unlock', '一次只有一個人操作 data structure，不會亂掉');
  await step(tok);                                   // 688 condition variable 很好用；thread pool 是例子
  q.hl(-1);
  cap('condition variable 其實非常好用', 'thread pool 就是透過它控制 thread 做不同事情的例子');
  await step(tok);                                   // 702 同步的兩個層面：race condition、控制順序
  hd('同步的兩個層面：① 解決 race condition　② 控制執行的順序', 0, 7.0, -2.6);
  cap('同步其實有兩個層面', '解決 race condition，以及控制執行的順序（正確的 behavior）');
  void M;
}]);

FRAG.push(['syn-20b-hwrecap', 'Hardware support 回顧：為什麼要燒成一個 instruction', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let tas, sw;
  await step(tok);                                   // 727 接回上次：hardware
  hd('回到 hardware support', 0, 6.4);
  cap('接回上次：software 講完', '我們介紹了 hardware');
  await step(tok);                                   // 736 TestAndSet、Swap 其實是好幾行程式
  tas = code(['boolean TestAndSet(boolean *target) {', '  boolean rv = *target;', '  *target = true;', '  return rv;', '}'], -3.4, 5.4, 0.5, -2.4);
  cap('最重要的一點：TestAndSet、Swap', '大家都知道它們是好幾行程式碼');
  await step(tok);                                   // 757 四行：兩個 thread 同時 call 本身就會 race
  const swRace = bad('如果是 software 的 function：兩個 thread 同時 call 本身就有 race condition', -3.4, 2.2, -2.4);
  cap('TestAndSet 有四行：兩個 thread 同時 call', '它本身就有 race condition，會錯');
  await step(tok);                                   // 767 hardware：用線路燒死，沒有 context switch
  const chip = prop('cpu', 3.6, 0, 0.4, 1.0, '線路');
  cap('hardware support：用 logic、用線路把它燒死', '線路裡根本沒有 context switch → 不會 race');
  await step(tok);                                   // 787 用 FPGA 等把四行做成 single instruction
  const one = bx('TestAndSet：single instruction', SC.os, 3.6, 0.35, 2.6, 3.4, 0.7, 1.0, 1.5);
  cap('概念：這四行在 hardware 做成 logic（例如 FPGA）', '變成一個 single instruction，不是 function call');
  await step(tok);                                   // 811 用這個 instruction 實作 entry section
  note('用 hardware support instruction 寫 entry section', 3.6, 1.6, 2.6);
  cap('這就是 hardware support instruction', '用它實作 entry section，解 critical section 問題');
  await step(tok);                                   // 821 好處：軟體簡化；而且快
  good('好處：軟體簡化、速度快', 0, 0.2, 4.2);
  cap('好處：軟體這邊可以簡化', '更重要的是快：hardware 永遠比 software 快');
  await step(tok);                                   // 837 software 的 entry 七、八行以上 → 慢
  idx('software 的 entry section 七、八行以上 → 慢', -3.4, 1.4, -1.0);
  cap('前面 software 的例子有七、八行甚至更多', '指令越多就越慢、浪費時間');
  await step(tok);                                   // 859 swap 也是三、四行；自己寫 → 兩個人都可能拿到 false
  tas.kill();
  sw = code(['P0: temp0 = lock;   // false', 'P1: temp1 = lock;   // false', 'P0: lock = key0; key0 = temp0;', 'P1: lock = key1; key1 = temp1;'], -3.4, 5.4, 0.5, -2.4);
  for (let i = 0; i < 4; i++) { sw.hl(i); await wt(tok, 450); }
  remove(swRace);
  bad('自己寫的 swap：key0、key1 都拿到 false → 兩人都進去！', -3.4, 2.4, -2.4);
  cap('swap 至少也有三、四行，還有變數的操作', '自己寫的話，兩個人同時 call 可能都拿到 false');
  await step(tok);                                   // 884 hardware 的 swap 是對的：不可能被 context switch
  sw.hl(-1);
  good('hardware 的 Swap：不可能被 context switch → 正確', -3.4, 1.6, -2.4);
  cap('如果 swap 是 hardware support 的 instruction', '它不可能被 context switch，答案就是對的');
  await step(tok);                                   // 901 都不是 perfect（沒有 bounded waiting），但看出為什麼用 hardware
  note('兩個例子都沒有 bounded waiting，但說明了為什麼要 hardware support', 0, 6.9, -2.4);
  cap('這兩個例子都不是 perfect solution', '都沒有 bounded waiting，但看得出為什麼要 hardware support');
  void chip; void one;
}]);

FRAG.push(['syn-20b-sem', 'Semaphore：一個管理資源數量的 counter', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let S, res = [];
  await step(tok);                                   // 922 介紹另一個很好用的 tool：semaphore
  hd('Semaphore', 0, 6.4);
  cap('critical section 的 solution 介紹完', '接下來是另一個非常好用的 tool：semaphore');
  await step(tok);                                   // 932 有點像 condition variable + mutex 的結合
  bx('condition variable', PCS[2], -3.0, 0.3, -2.6, 2.8, 0.5, 0.8, 1.5); idx('＋', 0, 0.4, -2.6); bx('mutex', PCS[0], 2.4, 0.3, -2.6, 2.0, 0.5, 0.8, 1.5);
  cap('它有一點像 condition variable', '加上 mutex 的結合');
  await step(tok);                                   // 954 定義出來簡化程式、控制執行順序的工具
  cap('同步、控制執行序順序時常用的 tool', '定義出來幫我們簡化程式的複雜度');
  await step(tok);                                   // 968 它其實是一個 counter：integer
  S = bx('S = 3', SC.mem, 0, 0.45, 0.4, 2.0, 0.9, 1.2, 2);
  cap('semaphore 首先是一個 counter', '對應到一個 integer 的數字');
  await step(tok);                                   // 980 數字代表它管理的 resource 的數量
  res = [0, 1, 2].map((k) => prop('parcel', 2.6 + k * 1.3, 0, 0.4, 0.7));
  idx('3 份相同的 resource（示意）', 3.9, 1.3, 0.4);
  cap('每個 semaphore 在管理某樣 resource', '數字代表這個 resource 的數量');
  await step(tok);                                   // 1005 數量是 1：一次一人 → binary semaphore，像 mutex lock
  rl(S, 'S = 1'); kill(res[1]); kill(res[2]);
  hot('S 只在 0、1 之間 → binary semaphore（像 mutex lock）', 0, 2.2, 0.4);
  cap('如果數量設成 1：一次只有一個人', '只在 0 跟 1 之間變動 → binary semaphore，像 mutex lock');
  await step(tok);                                   // 1032 mutex：把 critical section 想成一種 resource
  note('critical section 也是一種 resource：很多人想進，一次只能一個', 0, 3.0, 0.4);
  cap('mutex lock 的概念：把 critical section', '想成一種 resource，很多人想進、只能讓一個人');
  await step(tok);                                   // 1054 semaphore 更 powerful：generalized
  cap('但 semaphore 比它更 powerful', '需要比較 generalized 的應用時就會用到它');
  await step(tok);                                   // 1073 counting：thread pool 有 10 個 → init 10
  rl(S, 'S = 10');
  idx('thread pool 有 10 個 thread → 初值 10：10 個以內都能用', 0, 1.6, 2.0);
  cap('之所以要 semaphore，是因為 counting', '像 thread pool 有 10 個 thread：initialize 成 10');
  await step(tok);                                   // 1124 初值 > 1 → counting semaphore：數有沒有足夠資源
  good('初值 > 1 → counting semaphore：數資源夠不夠', 0, 3.8, 0.4);
  cap('初值大於 1 的叫 counting semaphore', '電腦裡的資源常常是一個「量」，不只 true / false');
  await step(tok);                                   // 1156 操作：initialize；用之前 wait
  const cd = code(['S = 資源數量;   // initialize', 'wait(S);         // 要用之前', '  … 使用 resource …', 'signal(S);       // 用完'], -3.8, 5.6, 0.5, -2.6);
  cd.hl(0);
  cap('怎麼操作：先 initialize 成資源的數量', '要使用資源之前，先 call wait');
  await step(tok);                                   // 1172 不要跟 condition variable 的 wait / signal 混在一起
  bad('跟 condition variable 的 wait / signal 不一樣！', -3.8, 3.4, -2.6);
  cap('這裡也有 wait 和 signal', '但不要跟前面的 condition variable 混在一起，定義不同');
  await step(tok);                                   // 1196 wait：我需要一個 resource；signal：用完 free
  cd.hl(1);
  cap('wait：我需要一個 resource', 'signal：用完了，把 resource free 掉');
  await step(tok);                                   // 1212 wait 完成 → 值減 1；signal → 加 1；值 = available 數
  rl(S, 'S = 9'); cd.hl(3); await wt(tok, 600); rl(S, 'S = 10');
  cap('離開 wait 代表拿到 resource：值減 1', 'signal 就加 1；數字代表目前 available 的數量');
  await step(tok);                                   // 1237 值是 0 → 沒剩 → wait 卡住，直到大於 0
  rl(S, 'S = 0'); glow(S, NOR); cd.hl(1);
  const P1 = pal('P', '', PCS[1], -3.4, 0, 2.6, 0.6); P1.mood('sad'); glow(P1.body, NOR);
  cap('值是 0 代表沒有剩下的', '就真的卡在 wait，直到數字大於 0 才繼續');
}]);

FRAG.push(['syn-20b-semimpl', 'Semaphore 的簡單實作：spinlock', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let cd, M, b1, b2;
  await step(tok);                                   // 1253 簡單的實作：wait、signal
  cd = code(['wait(S) {', '  while (S <= 0) ;', '  S--;', '}', 'signal(S) {', '  S++;', '}'], -3.8, 5.6, 0.5, -2.6);
  M = semStage(0, '在 while 裡一直轉', { sx: 1.6 });
  b1 = pal('P1', '', PCS[0], 2.6, 0, -0.2, 0.6); glow(b1.body, OKG); M.st.cs.push(b1);
  cap('簡單的實作：semaphore 裡存一個數字', '代表還有多少 available');
  await step(tok);                                   // 1268 wait：≤ 0 就卡住（分號）
  cd.hl(1);
  b2 = pal('P2', '', PCS[1], -6.0, 0, 0.6, 0.6); await M.toWait(tok, b2, 600);
  cap('wait：如果小於等於 0，這裡有分號', '就卡在這裡等著');
  await step(tok);                                   // 1275 大於 0 → 離開 loop，S-- 拿走一個
  await M.out(tok, b1, 600); M.setS(1);
  M.st.wait = []; cd.hl(2); M.setS(0); await M.toCS(tok, b2, 600);
  cap('大於 0 就代表有 available 的 resource', '離開 while，S-- 拿走一個，執行接下來的事');
  await step(tok);                                   // 1300 signal：S++ → 等的人有機會 break
  cd.hl(5);
  cap('signal 很單純，就是 ++', '把 resource free 出來，等的 thread 就有機會 break while');
  await step(tok);                                   // 1322 很重要：wait、signal 是 atomic
  cd.hl(-1);
  hot('wait、signal 必須是 atomic', -3.8, 2.0, -2.6);
  cap('很重要的第一點', 'wait 跟 signal 是 atomic 的：要一次做完');
  await step(tok);                                   // 1333 任何 technique：hardware、software CS、kernel disable interrupt
  note('做法不限：hardware 指令、software critical section、kernel 關 interrupt', -3.8, 1.2, -1.6);
  cap('用 hardware、software、任何 technique 都可以', '例如包成 critical section，或 kernel 先 disable interrupt');
  await step(tok);                                   // 1375 為什麼：S 是 shared，++ / -- 會 race
  glow(M.sc, NOR);
  bad('S 是 shared variable：一個 ++、一個 -- → 就像 counter 會 race', 1.6, 2.2, -2.4);
  cap('為什麼要 atomic？S 是 shared variable', '一個加加、一個減減，跟最早的 counter 例子一樣');
  await step(tok);                                   // 1404 第二點：這種實作叫 spinlock
  glow(M.sc, DIM);
  const b3 = pal('P3', '', PCS[2], -6.0, 0, 0.6, 0.6); await M.toWait(tok, b3, 600);
  hd('spinlock', -3.2, 2.0, 2.8);
  cap('第二點：這個實作叫 spinlock', '因為有個 while loop，一直在那邊 spinning');
  await step(tok);                                   // 1423 使用者覺得沒在做事，CPU 卻一直跑相同的 instruction
  await spin(tok, [b3], 900);
  cap('對使用者來說你沒在做事', '對 CPU 卻做了一大堆：一直執行相同的 instruction');
  await step(tok);                                   // 1441 壞處：CPU 100% 很忙，程式卻沒在動
  const cpu = prop('cpu', -0.6, 0, 0.4, 0.8, 'CPU 100%');
  await spin(tok, [b3], 700);
  bad('CPU 100% 好忙，程式卻都沒在動', -3.2, 2.8, 2.8);
  cap('壞處：浪費 CPU 的資源', 'CPU 百分之百很忙，程式卻沒在動');
  await step(tok);                                   // 1458 好處：比較容易 implement
  good('好處：容易 implement（一個 while loop）', -3.8, 0.4, -1.6);
  cap('但它比較容易 implement', '直接一個 while loop 就可以了');
  void cpu;
}]);

FRAG.push(['syn-20b-posix', 'POSIX semaphore 的 API', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let cd;
  await step(tok);                                   // 1475 實際上怎麼用：OS 提供
  hd('實際上：OS 提供 semaphore', 0, 6.4);
  cap('實作上要怎麼用 semaphore？', '哪裡有這個 library？');
  await step(tok);                                   // 1485 kernel 自己就需要 → part of API；POSIX（Linux）
  const k = zone('OS kernel', 3.8, 0.02, 0.4, 4.0, 2.2, '#e0d6f5'); bx('semaphore', SC.os, 3.8, 0.35, 0.4, 2.4, 0.6, 0.9, 1.5);
  cap('semaphore 是由 OS 來 support 的', 'kernel 自己很多地方要用，就做成 API 的一部分（POSIX）');
  await step(tok);                                   // 1514 include semaphore.h；像 mutex，但 init 可以給任意 integer
  cd = code(['#include <semaphore.h>', 'sem_t sem;', 'sem_init(&sem, 0, 10);  // 初值可自訂', 'sem_wait(&sem);', '  …', 'sem_post(&sem);         // = signal', 'sem_getvalue(&sem, &v);', 'sem_destroy(&sem);'], -3.4, 5.8, 0.5, -2.4);
  cd.hl(2);
  cap('include semaphore.h，用法跟 mutex 非常像', '差別在 init 時可以塞入不同的 integer');
  await step(tok);                                   // 1546 get value：知道它的 state
  cd.hl(6);
  cap('還有 get value 這類 function', '讓你知道 semaphore 目前的 state');
  await step(tok);                                   // 1553 不屬於 Pthread：process 之間也能用
  const p1 = pal('process A', '', PCS[0], 2.4, 0, 3.0, 0.6), p2 = pal('process B', '', PCS[1], 5.2, 0, 3.0, 0.6);
  arr(2.6, 1.0, 3.4, 0.8, '#8a7a5c', 2.6, 1.0); arr(5.0, 1.0, 4.2, 0.8, '#8a7a5c', 2.6, 1.0);
  cap('它不屬於 Pthread', '不只 thread 之間，很多時候在 process 之間使用（OS level）');
  await step(tok);                                   // 1578 跟 mutex 比：初值設 1 → wait / signal 就像 lock / unlock
  cd.hl(3);
  note('初值設 1：wait / signal ≈ lock / unlock', -3.4, 1.0, -1.0);
  cap('跟 mutex 比：initialize 成 1', 'wait、signal 就像當初的 lock、unlock，也能解 critical section');
  await step(tok);                                   // 1593 semaphore 更 powerful；只是 binary 就用 mutex
  good('只是 binary 的問題 → 用 mutex lock（實作較簡單）；要 counting 才用 semaphore', 0, 0.2, 4.2);
  cap('semaphore 更 powerful，mutex 實作比較簡單', '只是 binary 的問題建議用 lock，需要 counting 才用 semaphore');
  await step(tok);                                   // 1612 休息；下一段：不用 spinlock，put to sleep
  cd.hl(-1);
  idx('下一段：不用 spinlock，改成 put to sleep 的實作', 0, 7.0);
  cap('休息十分鐘', '回來介紹不用 spinlock、把它 put to sleep 的實作');
  void k; void p1; void p2;
}]);

// ════════ r0h26ioGeG0（第 20C 講）：non-busy waiting semaphore、何時用 spinlock、atomic 的實作、排順序與 data flow、deadlock / starvation ════════
FRAG.push(['syn-20c-q7', '期中考第 7 題補充：hierarchical 不一定只有一層', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  const xs = [-4.4, 0, 4.4];
  let cs = [], lv = [];
  await step(tok);                                   // 22 第 7 題的選項：inverted、hash、hierarchical
  hd('第 7 題：哪種情境用哪種 page table？', 0, 6.2);
  cs = ['inverted', 'hash', 'hierarchical'].map((t, i) => card(t, [PCS[3], PCS[2], PCS[0]][i], xs[i], 0.3, -2.4, 2.6));
  cap('第七題的選項：inverted、hash、hierarchical', '題目原本想的是一般的 one-level page table');
  await step(tok);                                   // 38 hierarchical 不一定是 one-level → multi-level 會慢
  lv = [0, 1, 2].map((i) => bx('', '#e8c98c', xs[2] - 1.0 + i * 1.0, 0.3 + i * 0.7, -0.6, 0.8, 0.5, 0.8, 1.2));
  idx('hierarchical 可能是 multi-level：查好幾層才找到 frame', 2.4, 3.0, -0.6);
  bad('層數多 → 每次 access 要多查幾次 → 慢', 2.4, 3.7, -0.6);
  cap('但 hierarchical 沒說一定是 one-level', '如果是 multi-level，就要查好幾層，會比較慢');
  await step(tok);                                   // 54 要快的情境 → 選 hash 也合理
  glow(cs[1], DIM); good('要快 → hash：平均查一次就找到', xs[1], 1.2, -2.4);
  cap('所以「要快」的情境選 hash 也可以', 'hash 平均（in average）一次 access 就找到');
  await step(tok);                                   // 89 很分散的情境 → hierarchical：沒用到的 leaf table 不建
  glow(cs[2], DIM); lv.slice(1).forEach((m) => P.tint(m, '#d8cfc0'));
  good('很分散 → hierarchical：沒用到的 leaf page table 不用建，省空間', 0, 4.6, 1.6);
  cap('page 很分散、要省空間 → hierarchical', '用不到的 leaf level page table 根本不用 create');
  await step(tok);                                   // 109 解釋合理就給分
  note('沒有標準答案：理由合理、符合系統實際運作就給分', 0, 5.4, 1.6);
  cap('這題沒有標準答案', '只要解釋合理，就可以拿到分數');
}]);
const SEMW = ['wait(S) {', '  S.value--;', '  if (S.value < 0) {', '    add P to S.list;', '    sleep();   // block', '  }', '}', 'signal(S) {', '  S.value++;', '  if (S.value <= 0) {', '    remove P from S.list;', '    wakeup(P);', '  }', '}'];
FRAG.push(['syn-20c-sleep', 'Non-busy waiting：semaphore 帶一個 waiting queue', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M, cd, B = {};
  await step(tok);                                   // 181 之前：busy waiting / spinlock，浪費 CPU
  const old = code(['wait(S) {', '  while (S <= 0) ;', '  S--;', '}'], -4.2, 5.8, 0.5, -2.6);
  old.hl(1); bad('busy waiting（spinlock）→ 浪費 CPU', -4.2, 3.2, -2.6);
  cap('之前的 wait、signal：用 while loop', 'busy waiting，也叫 spinlock，很浪費 CPU');
  await step(tok);                                   // 195 另一種：non-busy waiting，put to sleep
  good('另一種：non-busy waiting → put to sleep', 3.6, 6.2);
  cap('另一種實作：non-busy waiting', '把等的人 put to sleep，放進 sleeping queue');
  await step(tok);                                   // 210 structure：value + queue（像 condition variable）
  old.kill();
  M = semStage(1, 'S.list：waiting queue（睡覺）', { block: true, name: 'S.value', sx: 1.4 });
  cd = code(SEMW, -4.4, 6.6, 0.42, -3.2);
  cap('semaphore 的 structure 變複雜了', '除了 value，還有一個 waiting queue（有點像 condition variable）');
  await step(tok);                                   // 232 queue 裡放被卡住的 process：put to sleep、移出 ready queue
  B.P1 = pal('P1', '', PCS[0], -6.4, 0, 0.6, 0.6); M.setS(0); await M.toCS(tok, B.P1, 600);
  B.P2 = pal('P2', '', PCS[1], -6.4, 0, 0.6, 0.6); M.setS(-1); await M.toWait(tok, B.P2, 600);
  cap('queue 裡放的是 call 了 wait 被卡住的 process', 'put to sleep：從 ready queue 移出，真的在睡');
  await step(tok);                                   // 264 value 的意義：負值 = queue 的長度
  B.P3 = pal('P3', '', PCS[2], -6.4, 0, 0.6, 0.6); M.setS(-2); await M.toWait(tok, B.P3, 600);
  note('value 是負的 → |value| = 在 queue 裡等的數量', -0.6, 1.6, -2.4);
  cap('這個實作裡 value 對應 queue 的長度', '負的時候，絕對值就是有多少個在 waiting');
  await step(tok);                                   // 298 用 block、wakeup 兩個 system call 實作
  hd('system call：block（sleep）、wakeup', 3.8, 6.4);
  cap('怎麼 implement wait 跟 signal？', '透過 block、wakeup 兩個 system call');
  await step(tok);                                   // 313 block：放進 waiting queue；wakeup：拿出來放回 ready queue
  idx('block：放進 waiting queue　wakeup：移到 ready queue 等 schedule', 3.8, 5.8);
  cap('一個把 process 放到 waiting queue', '另一個從 waiting queue 拿出來放到 ready queue');
  await step(tok);                                   // 343 S.value < 0 → queue 有東西；−3 = 三個人在等
  cd.hl(2);
  B.P4 = pal('P4', '', PCS[3], -6.4, 0, 0.6, 0.6); M.setS(-3); await M.toWait(tok, B.P4, 600);
  cap('S.value 小於 0 代表 queue 裡有人', '−3 就是有三個人在等；0 代表沒人在等');
  await step(tok);                                   // 368 初值 > 0：counting，減到 0 之前不會睡
  idx('初值 > 0（counting）：減到 0 之前都不會 put to sleep', -0.6, 2.3, -2.4);
  cap('一開始 initialize 成大於 0', '就是 counting semaphore：減到 0 之前都不會睡');
  await step(tok);                                   // 380 value < 0 → 沒資源 → 放進 queue、call sleep
  cd.hl(3);
  cap('value 小於 0 代表目前沒有 resource', '把這個 process 放到 queue 裡，然後 call sleep');
  await step(tok);                                   // 411 沒辦法執行、不用 CPU → non-busy waiting
  cd.hl(4);
  good('睡著：不會執行、不用 CPU', -3.2, 1.7, 2.8);
  cap('它被放到 waiting queue，沒辦法執行', '也不用 CPU：這就是 non-busy waiting');
  await step(tok);                                   // 418 sleep 之前要先減；所以條件是 < 0 不是 = 0
  cd.hl(1);
  note('先 value--，再判斷 < 0（睡了就沒機會再減）', -0.6, 3.0, -2.4);
  cap('sleep 之前要先把 counter 減 1', '一 call sleep 就沒機會執行了；所以判斷是 < 0，不是 = 0');
  await step(tok);                                   // 461 signal：++，若 ≤ 0 → 從 queue 拿一個、wakeup
  cd.hl(8); M.setS(-2);
  await M.out(tok, B.P1, 600);
  cd.hl(11); M.st.wait = M.st.wait.filter((b) => b !== B.P2);
  await M.fromWait(tok, B.P2, 700);
  cap('signal 倒過來：先 ++，若 ≤ 0 代表 queue 裡有人', 'remove 一個出來，wakeup 叫醒它 → 它進去執行');
  await step(tok);                                   // 499 沒有 while loop → 不浪費 CPU
  cd.hl(-1);
  good('程式碼裡沒有任何 while loop → CPU 不會被浪費', 0, 7.2, -3.2);
  cap('這就是 non-busy waiting', '程式碼裡沒有任何 while loop，CPU 不會被浪費');
}]);

FRAG.push(['syn-20c-choose', 'Spinlock 還是 sleep？看等待時間長短', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  await step(tok);                                   // 516 考試常問：總是用第二種嗎？看情形
  hd('spinlock vs non-busy waiting：哪個好？', 0, 6.2);
  bx('spinlock', '#f6e2d6', -3.6, 0.35, -1.6, 3.0, 0.7, 1.0, 2); bx('sleep / wakeup', '#dfe3f3', 3.6, 0.35, -1.6, 3.0, 0.7, 1.0, 2);
  cap('考試常問：有兩種實作，是不是都用第二種？', '答案是：看情形');
  await step(tok);                                   // 539 sleep 很棒但要 call system call → 慢
  bad('sleep / wakeup 是 system call：很慢（幾十個 instruction 以上）', 3.6, 1.4, -1.6);
  cap('第二種沒有浪費 CPU cycle，但有一個問題', '它 call 了 system call：比 S-- 慢很多，可能幾十個 instruction 以上');
  await step(tok);                                   // 559 等待時間很短 → busy waiting
  const t1 = bx('等一下下', '#bfe6cf', -3.6, 0.3, 1.2, 1.4, 0.5, 0.8, 1.2);
  good('等待時間短 → spinlock：轉兩三圈就 break', -3.6, 1.4, 1.2);
  cap('如果等待時間很短，用 busy waiting', 'while loop 檢查兩三次就 break，反而比較快');
  await step(tok);                                   // 584 等待很久（例如 5 秒）→ non-busy
  const t2 = bx('平均等 5 秒（課堂例子）', '#c8d8f0', 3.6, 0.3, 1.2, 5.0 * 0.6, 0.5, 0.8, 1.2);
  good('等待時間長 → put to sleep，把 CPU 讓出來', 3.6, 1.4, 1.2);
  cap('如果 waiting 時間很久，例如平均 5 秒', '對 CPU 很漫長：不如 put to sleep，讓別人用 CPU');
  await step(tok);                                   // 613 system call 雖然久，也只是幾個 millisecond
  idx('system call 的成本：幾個 millisecond（比 5 秒小得多）', 3.6, 0.2, 2.6);
  cap('system call 雖然比較久', '也只是幾個 millisecond');
  await step(tok);                                   // 619 depends on waiting time
  hot('短 → spinlock　長 → non-busy waiting', 0, 5.2);
  cap('所以 depends on waiting 時間的長短', '短的用 spinlock，長的用 non-busy waiting');
  await step(tok);                                   // 635 sleep / wakeup 代價高：context switch、rescheduling
  note('sleep / wakeup：context switch、rescheduling，不知道何時輪到你', 3.6, 4.2, -1.6);
  cap('sleep、wakeup 是 system call，代價很高', '要 context switch、rescheduling，也不知道多久才輪到你');
  await step(tok);                                   // 650 多核心：另一個 thread 同時在跑，可能很快就 release
  const c1 = prop('cpu', -5.0, 0, 3.4, 0.6, 'core 0'), c2 = prop('cpu', -2.4, 0, 3.4, 0.6, 'core 1');
  idx('multi-core：對方在另一個 core 上，很快就放掉 → 不用 context switch', -3.6, 1.6, 3.6);
  cap('現在電腦多半是多核心、多個 thread 一起跑', 'busy waiting 時對方可能很快放掉，你根本沒被 context switch 就 break');
  void t1; void t2; void c1; void c2;
}]);

FRAG.push(['syn-20c-atomic', 'wait / signal 怎麼做到 atomic', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let cd;
  await step(tok);                                   // 680 不管哪種實作，都必須 atomic
  hd('wait、signal 必須是 atomic', 0, 6.4);
  cap('不管第一種還是第二種實作', '很重要的條件：必須是 atomic');
  await step(tok);                                   // 694 值有 ++ / --，還有 queue 的 insert / delete
  const v = bx('S.value ++ / --', SC.mem, -3.6, 0.4, -1.6, 2.8, 0.8, 1.0, 2), q = bx('S.list insert / delete', '#dfe3f3', 0.0, 0.4, -1.6, 3.2, 0.8, 1.0, 2);
  cap('之前的值會加加減減', '這裡還有 queue 的 insertion、deletion，更不能同時執行');
  await step(tok);                                   // 708 最暴力：OS kernel disable interrupt
  const c = prop('cpu', 4.4, 0, -1.6, 0.8, 'interrupt off');
  cap('怎麼保證 atomic？', '最暴力的：OS kernel 做的 disable interrupt');
  await step(tok);                                   // 715 multi-processor：要 suspend 整台電腦 → 很沒效率
  prop('cpu', 6.0, 0, 0.2, 0.6, 'CPU 2'); prop('cpu', 4.4, 0, 0.6, 0.6, 'CPU 3');
  bad('multi-processor：只關一顆 CPU 不夠，要整台 suspend → 很沒效率', 3.4, 2.4, -0.4);
  cap('有 multi-processor 時，關一個 CPU 還不夠', '要整台電腦都 suspend，非常不 efficient');
  await step(tok);                                   // 732 第二種：hardware support 或 pure software，包成 critical section
  good('hardware support 或 software 的 entry / exit → 包成 critical section', -2.0, 2.4, -1.6);
  cap('第二種作法：才剛教完的 hardware support', '或 pure software 寫 entry、exit：把它變成 critical section');
  await step(tok);                                   // 752 用 critical section 保護 wait 的內容；if-else → 兩個 exit
  gone(v, q);
  cd = code(['wait(S) {', '  entry();', '  S.value--;', '  if (S.value < 0) {', '    add P to S.list;', '    exit();', '    sleep();', '  } else', '    exit();', '}'], -3.6, 6.2, 0.46, -3.0);
  cd.hl(5);
  cap('軟體寫：wait、signal 包成 critical section', '因為有 if-else，兩種 case 各要一個 exit section');
  await step(tok);                                   // 775 千萬不要把 sleep / wakeup 包進去
  cd.hl(6);
  bad('sleep 不能包在 critical section 裡：睡在裡面，別人就進不來', 2.6, 3.8, -1.0);
  cap('千萬不要把 sleep、wakeup 包進去', '一包進去它就睡在裡面，沒有人進得了 critical section');
  await step(tok);                                   // 791 它只是 system call，不會像 condition variable 幫你 reacquire
  idx('sleep 只是 system call：不會像 cond_wait 幫你放掉 / 拿回 lock', 2.6, 3.1, -1.0);
  cap('這裡就是單純的 system call', '不像 condition variable 會幫你 reacquire lock');
  await step(tok);                                   // 795 很多人同時 call sleep / wakeup 不用擔心：OS 保證
  good('sleep / wakeup 是 OS 的 system call：OS 自己保證它們沒有 race', 2.6, 2.3, -1.0);
  cap('反而不用擔心很多人同時 call sleep、wakeup', 'OS 提供的 system call，會保證它們是 atomic');
  await step(tok);                                   // 827 這樣就達到 atomic 的要求
  cd.hl(-1);
  cap('用這樣就可以達到 atomic 的要求', '兩種實作就看等待時間是長還是短');
  void c;
}]);

FRAG.push(['syn-20c-order', '用 semaphore 控制執行順序：S1 → S2、data flow', async (tok) => {
  fresh([0, 7, 13], [0, 1.6, 0]);
  const N = {};
  const node = (n, x, z) => { N[n] = pal(n, '', PCS[(+n.slice(1) - 1) % 6], x, 0, z, 0.6); return N[n]; };
  const edge = (a, b, lbl) => { const A = N[a].g.position, Bp = N[b].g.position; const ar = arrow(V3(A.x + 0.4, 0.5, A.z), V3(Bp.x - 0.4, 0.5, Bp.z), 0x8a7a5c); idx(lbl, (A.x + Bp.x) / 2, 0.9, (A.z + Bp.z) / 2); return ar; };
  let c1, c2;
  await step(tok);                                   // 851 同步的目的：race / counting，以及控制時機、順序
  hd('同步的另一個目的：控制執行的時機與順序', 0, 6.6);
  cap('同步的目的：解決 race condition、做 counting', '另一個就是控制執行的時機點與順序');
  await step(tok);                                   // 863 semaphore 也常拿來 fine-grained 控制順序
  cap('semaphore 很多時候也拿來做這件事', '很 fine-grained 地調整程式執行的順序');
  await step(tok);                                   // 876 例子：P2 的 S2 一定要在 P1 的 S1 之後
  node('P1', -4.6, -1.0); node('P2', -4.6, 2.2);
  note('要求：S1 執行完，S2 才可以執行', -1.0, 2.6, 0.6);
  cap('例子：兩個 process', 'P1 的 statement S1 執行完之後，P2 的 S2 才可以執行');
  await step(tok);                                   // 900 sync 是 semaphore：P1 做 S1 再 signal；P2 先 wait
  c1 = code(['S1;', 'signal(sync);'], -1.6, 0.9, 0.45, -1.0); c2 = code(['wait(sync);', 'S2;'], -1.6, 0.9, 0.45, 2.2);
  const sy = bx('sync = 0', SC.mem, 2.4, 0.4, 0.6, 1.8, 0.8, 1.0, 1.5);
  cap('用一個 semaphore 叫 sync', 'S1 做完 signal(sync)；S2 之前先 wait(sync)');
  await step(tok);                                   // 918 sync 初值 0 → wait 一定卡住，直到 P1 signal
  c2.hl(0); glow(N.P2.body, NOR); N.P2.mood('sad');
  cap('sync 一開始設成 0', 'P2 去 wait 一定被卡住，直到 P1 call signal');
  await step(tok);                                   // 932 就算同時跑，一定是 S1 先
  c1.hl(1); rl(sy, 'sync = 1'); await wt(tok, 500); c2.hl(1); rl(sy, 'sync = 0'); glow(N.P2.body, OKG); N.P2.mood('happy');
  cap('兩個程式就算同時跑下去', '一定是 S1 先執行完、signal，P2 才能 break：沒有其他可能');
  await step(tok);                                   // 954 複雜的例子：data flow
  c1.kill(); c2.kill(); kill(sy); gone(N.P1, N.P2);
  node('P1', -5.6, 0.6); node('P2', -2.8, -1.6); node('P3', -2.8, 2.8); node('P4', 0.0, -1.6); node('P5', 2.8, -2.6); node('P6', 2.8, 1.4); node('P7', 5.6, 1.4);
  idx('（graph 為示意，邊的名字照課堂：a、b、c、d、f、h）', 0, 0.2, 4.2);
  cap('複雜一點的例子：一大堆 process 組成的 data flow', '一個的 output 給另一個，有的要等兩個人的 output');
  await step(tok);                                   // 985 每一條 edge 一個 semaphore（初值 0）
  edge('P1', 'P2', 'a'); edge('P1', 'P3', 'b'); edge('P2', 'P4', 'c'); edge('P4', 'P6', 'd'); edge('P4', 'P5', 'e'); edge('P3', 'P6', 'f'); edge('P6', 'P7', 'h');
  cap('照剛才的原則：每一條 edge', '就當成剛才 P1、P2 的例子，create 一個 semaphore');
  await step(tok);                                   // 1016 P1 先執行：S1，再 signal(a)、signal(b)
  const k1 = code(['S1;', 'signal(a); signal(b);'], -5.6, 4.6, 0.42, -3.0);
  glow(N.P1.body, OKG);
  cap('全部一開始都是 0：P1 先執行 S1', '然後 signal(a)、signal(b)，trigger 下一個 process');
  await step(tok);                                   // 1039 P2：incoming edge → wait；outgoing → signal
  const k2 = code(['wait(a);', 'S2;', 'signal(c);'], -2.4, 4.6, 0.42, -3.0);
  glow(N.P2.body, OKG);
  cap('規則：有 incoming edge 就 call wait', '有 outgoing edge 就 call signal，中間是 statement');
  await step(tok);                                   // 1073 P4：wait(c)，後面兩個 → 兩個 signal
  const k4 = code(['wait(c);', 'S4;', 'signal(d); signal(e);'], 0.8, 4.6, 0.42, -3.0);
  glow(N.P4.body, OKG);
  cap('隨便挑 P4：wait(c)，等 P2', '後面有兩條，所以 signal 兩個');
  await step(tok);                                   // 1081 P6：wait(f)、wait(d) 都等到才執行，再 signal(h)
  const k6 = code(['wait(f); wait(d);', 'S6;', 'signal(h);'], 4.4, 4.6, 0.42, -3.0);
  glow(N.P6.body, OKG);
  cap('P6 要 wait(f) 跟 wait(d)', '兩個都被 signal 之後才執行，執行完 signal(h)，以此類推');
  await step(tok);                                   // 1095 很容易控制 data flow；常常跨 process
  good('semaphore：輕鬆控制整個 data flow（常常是跨 process 的）', 0, 6.0, -1.0);
  cap('用 semaphore 很容易做同步', '控制整個 data flow；而且常常是跨 process 使用');
  void k1; void k2; void k4; void k6;
}]);

FRAG.push(['syn-20c-deadlock', 'wait / signal 順序寫錯：deadlock 與 starvation', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let s, q, p0, p1, c0, c1;
  await step(tok);                                   // 1120 tool 好用，但程式變複雜，順序都由 programmer 控制
  hd('一堆 wait、signal：都要 programmer 自己控制', 0, 6.4);
  cap('synchronization tool 很好用', '但程式碼常變得複雜，一堆 wait、signal 都由 programmer 控制');
  await step(tok);                                   // 1136 順序寫不好 → 互相等待、無法前進
  cap('很容易發生的問題：wait、signal 順序寫得不好', '造成 process 之間互相等待，沒辦法前進');
  await step(tok);                                   // 1148 例子：S、Q 兩個 semaphore，順序相反
  s = bx('S = 1', SC.mem, -1.6, 0.4, -1.6, 1.6, 0.8, 1.1, 2); q = bx('Q = 1', SC.mem, 1.6, 0.4, -1.6, 1.6, 0.8, 1.1, 2);
  p0 = pal('P0', '', PCS[0], -4.6, 0, 1.6, 0.7); p1 = pal('P1', '', PCS[1], 4.6, 0, 1.6, 0.7);
  c0 = code(['wait(S);', 'wait(Q);', '  …', 'signal(S);', 'signal(Q);'], -4.6, 5.4, 0.45, -2.6); c1 = code(['wait(Q);', 'wait(S);', '  …', 'signal(Q);', 'signal(S);'], 4.6, 5.4, 0.45, -2.6);
  cap('例子：S 跟 Q 兩個 semaphore', 'P0 先 wait(S) 再 Q；P1 先 wait(Q) 再 S');
  await step(tok);                                   // 1168 就算初值都是 1：P0 拿到 S、P1 拿到 Q
  c0.hl(0); rl(s, 'S = 0'); arr(-3.8, 1.0, -2.2, 0.9, '#2fc092', 1.4, -1.2); await wt(tok, 400);
  c1.hl(0); rl(q, 'Q = 0'); arr(3.8, 1.0, 2.2, 0.9, '#2fc092', 1.4, -1.2);
  cap('就算 S、Q 一開始都是 1', 'P0 拿走 S，P1 拿走 Q');
  await step(tok);                                   // 1182 P0 卡在 Q、P1 卡在 S
  c0.hl(1); c1.hl(1);
  arr(-3.8, 1.3, 1.2, 1.2, '#d64545', 1.4, -1.2); arr(3.8, 1.3, -1.2, 1.2, '#d64545', 1.4, -1.2);
  glow(p0.body, NOR); glow(p1.body, NOR); p0.mood('sad'); p1.mood('sad');
  cap('P0 卡在 wait(Q)：Q 被 P1 拿走', 'P1 卡在 wait(S)：S 被 P0 拿走');
  await step(tok);                                   // 1200 初值是 0 的話，第一行就卡住
  idx('（若初值是 0，第一行就卡住了）', 0, 0.2, 3.2);
  cap('如果一開始是 0', '連第一行就卡住了');
  await step(tok);                                   // 1205 互相等待 → deadlock（下一章）
  bad('互相等待 → deadlock（下一章）', 0, 2.8, 0.4);
  cap('互相等待、沒辦法前進：deadlock', '下一章會教');
  await step(tok);                                   // 1217 結果是 starvation：相關但不一樣
  note('starvation：某個程式永遠沒機會執行', 0, 3.6, 0.4);
  cap('deadlock 造成的結果是 starvation', '相關但不一樣：starvation 指單一程式永遠沒機會執行');
  await step(tok);                                   // 1229 starvation 的原因：deadlock、priority scheduling…
  idx('starvation 的原因：deadlock，或 priority 太低（scheduling）…', 0, 4.3, 0.4);
  cap('沒辦法執行的原因很多', 'deadlock 是一個；priority scheduling 裡 priority 太低也會');
  await step(tok);                                   // 1245 synchronization 時 programmer 的錯誤 → deadlock → starvation
  c0.hl(-1); c1.hl(-1);
  hot('programmer 寫錯 → deadlock → starvation', 0, 5.0, 0.4);
  cap('同步的過程很容易因為 programmer 的錯誤', '產生 deadlock，最後變成 starvation');
}]);

// ════════ akXZHPecIh4（第 21A 講）：monitor（只有一個 active）、condition variable vs semaphore、dining philosophers 的 monitor 解法 ════════
// a monitor box: entry queue on the left, the object in the middle, condition queues in front
function monStage() {
  room(0.6, 1.1, -0.8, 5.6, 2.2, 3.0, '#9b7ef4');
  tag('monitor（object）', 'ptr', 0.6, 2.6, -0.8);
  const sd = bx('shared data（private）', SC.mem, -0.8, 0.3, -1.6, 2.4, 0.6, 1.0);
  const ms = ['method A()', 'method B()'].map((n, k) => bx(n, '#4b9ee2', 2.4, 0.25, -1.6 + k * 1.1, 1.8, 0.5, 0.8));
  zone('entry queue', -5.0, 0.02, -0.8, 3.0, 1.6, '#f6e2d6');
  return { sd, ms };
}
FRAG.push(['syn-21a-monitor', 'Monitor：一次只有一個 active 的 thread', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M, th = [];
  await step(tok);                                   // 2 今天重點：monitor，high-level language construct
  hd('Monitor：high-level language construct', 0, 6.4);
  cap('今天的重點：monitor', '最後一個 synchronization tool，更 high level、更方便 programming');
  await step(tok);                                   // 8 有點像 OO 的 class
  M = monStage();
  cap('它是從 OO 的概念衍生出來的 tool', '可以先想成一般 OO 裡的 class');
  await step(tok);                                   // 44 class：private variable + method
  glow(M.sd, DIM);
  cap('一個 class 有 private variable', '還有 method，拿來操作、修改這些 variable');
  await step(tok);                                   // 72 誰 access、做什麼都 well-defined
  idx('誰會 access、做什麼動作 → 都 well-defined', 0.6, 3.2, -0.8);
  cap('誰會 access 這些 variable、做什麼動作', '用 class 都能 well define 出來，很清楚');
  await step(tok);                                   // 85 monitor：解決透過 method 存取 shared variable 的同步
  cap('monitor 就是在 OO 的概念下再衍生', '解決大家透過 method 存取 shared variable 的同步問題');
  await step(tok);                                   // 103 回到最簡單：mutual exclusion，method 一次只有一個執行
  hot('method 一次只有一個被執行（mutual exclusion）', 0.6, 4.0, -0.8);
  cap('解法回到最簡單的 mutual exclusion', '這個 class 的 method 一次只有一個被執行');
  await step(tok);                                   // 118 很多 thread call → queue 住，一次一個 → 沒有 race
  th = [0, 1, 2].map((k) => pal('T' + k, '', PCS[k], -5.8 + k * 0.9, 0, -0.8, 0.5));
  await slide(tok, th[0].g, 0.4, 0, 0.4, 700); glow(th[0].body, OKG);
  cap('很多 thread 同時 call 也沒關係', '它們會被 queue 住、排隊，一次一個進來 → 沒有 race condition');
  await step(tok);                                   // 141 常被忽略：不是一次只有一個人 call，而是只有一個 active
  bad('不是「只有一個 thread 在裡面」', 0.6, 4.8, -0.8);
  cap('大家常忽略的細節', '不是一次只有一個人在 call，而是只有一個 active 的 thread');
  await step(tok);                                   // 161 像 Pthread 的例子：進去後 wait → inactive
  sleepy(th[0], true); glow(th[0].body, '#1a2a5a');
  await slide(tok, th[0].g, 0.4, 0, 2.6, 600);
  cap('像 Pthread condition variable 的例子', '進到 critical section 後做 wait：被 put to sleep → inactive');
  await step(tok);                                   // 190 suspend 的時候，其他 thread 可以進來
  await slide(tok, th[1].g, 0.4, 0, 0.4, 700); glow(th[1].body, OKG);
  cap('它暫時被 suspend 了', '這時其他 thread 可以進來繼續用：只要維持一個 active 就好');
  await step(tok);                                   // 206 active = 可以執行裡面的 statement
  good('保證：monitor 裡只有一個 active（正在執行 statement）的 thread', 0.6, 4.8, -0.8);
  cap('active 的意思是可以執行裡面的 statement', 'monitor 保證只有一個 process 是 active');
  await step(tok);                                   // 233 跟 mutex、CV 一樣是概念，各語言形式不同（Java…）
  idx('Java 等物件導向、平行語言都支援，形式有些不同', 0.6, 0.2, 3.6);
  cap('它跟 mutex、condition variable 一樣是一個概念', '大部分平行語言、Java 都 support，形式不太一樣');
  await step(tok);                                   // 282 high level：融入語言設計的 specialized class
  hd('specialized class：融入語言設計 → high level', 0, 7.2);
  cap('用物件、method 來做 synchronization', '已經融入語言設計：它是一個 specialized class');
}]);

FRAG.push(['syn-21a-cv', 'Monitor ＋ condition variable；CV 和 semaphore 的 wait / signal 差在哪', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let M, th = [], cq, semV, cvQ;
  await step(tok);                                   // 291 monitor class 產生的 object 處理同步
  M = monStage();
  cap('右邊這個圖就是 monitor', 'monitor class 產生的 object，負責處理 synchronization');
  await step(tok);                                   // 308 shared data = private variable，只能透過 method
  glow(M.sd, DIM);
  cap('shared data 對應到 class 的 private variable', '只有透過 method 才能操作，不受外面干擾');
  await step(tok);                                   // 348 special class：call method 的都被 queue 住，一次一個
  th = [0, 1, 2].map((k) => pal('T' + k, '', PCS[k], -5.8 + k * 0.9, 0, -0.8, 0.5));
  await slide(tok, th[0].g, 0.4, 0, 0.4, 700); glow(th[0].body, OKG);
  cap('language 知道它是 monitor', '把 call method 的 thread queue 住，一次只有一個進來');
  await step(tok);                                   // 373 比 semaphore、mutex、CV 更 high level
  const lo = code(['wait(S);', 'lock(&m);', '  …', 'unlock(&m);', 'signal(S);'], -4.6, 5.6, 0.45, -2.8);
  cap('不像 semaphore、mutex、condition variable', '要自己寫 signal、wait、lock、unlock，順序都自己 figure out');
  await step(tok);                                   // 394 往前移一行、往後移一行答案就不同 → deadlock / race
  bad('往前或往後移一行：可能 deadlock，或還是 race', -4.6, 3.0, -2.8);
  cap('往前移一行、往後移一行答案就不一樣', '有時 deadlock、有時還是 race：比較 low level，容易出錯');
  await step(tok);                                   // 417 monitor 也結合 condition variable
  lo.kill();
  hot('monitor ＋ condition variable', -3.6, 5.2);
  cap('monitor 裡面也結合了 condition variable', '它不是解 race condition，但同步非常常用');
  await step(tok);                                   // 439 method 裡可以 call CV 的 wait（像 thread pool）
  cq = zone('condition x 的 waiting queue', 0.6, 0.02, 3.0, 4.0, 1.4, '#dfe3f3');
  cap('在 monitor 定義的 method 裡', '還可以 call condition variable 的 wait（例如 thread pool）');
  await step(tok);                                   // 467 每個 CV 是一個 event waiting queue
  idx('一個 condition variable = 一個 event waiting queue', 0.6, 0.9, 3.8);
  cap('每個 condition variable 代表一個 waiting queue', '等 resource 就 call wait，叫醒人就 call signal');
  await step(tok);                                   // 500 wait = suspend → inactive，外面的可以進來
  sleepy(th[0], true); glow(th[0].body, '#1a2a5a'); await slide(tok, th[0].g, -0.4, 0, 3.0, 600);
  await slide(tok, th[1].g, 0.4, 0, 0.4, 600); glow(th[1].body, OKG);
  cap('wait 的意思是 suspend：變成 inactive', '雖然還在 monitor 裡，外面的 thread 可以進來了');
  await step(tok);                                   // 527 signal：list 裡有人就叫起來
  sleepy(th[0], false); th[0].mood('happy');
  cap('signal 就去看這個 variable 的 waiting list', '有人的話就把它叫起來');
  await step(tok);                                   // 549 和 semaphore 的差別：semaphore wait 一定 −1、signal 一定 +1
  semV = bx('semaphore：S = 0', SC.mem, -4.6, 0.4, 2.6, 2.6, 0.7, 1.0, 1.5);
  cap('提醒：semaphore 也有 wait、signal', 'semaphore 的 wait 一定減 1、signal 一定加 1');
  await step(tok);                                   // 588 CV 不是 counter，是 waiting queue：wait = enqueue，signal = dequeue
  cvQ = bx('CV：queue = [ ]', '#dfe3f3', -4.6, 0.4, 4.0, 2.6, 0.7, 1.0, 1.5);
  cap('CV 不是 counter，是一個 waiting queue', 'wait 是 enqueue（suspend），signal 是 dequeue');
  await step(tok);                                   // 620 queue 空的時候 signal：什麼都沒發生
  const sg = pkt('signal', -6.4, 1.4, 4.0); await travel(tok, sg, V3(-6.4, 1.4, 4.0), V3(-4.6, 1.2, 4.0), 600); remove(sg);
  good('queue 是空的 → signal 什麼都沒發生（沒有 −1 這種東西）', -2.2, 1.6, 4.0);
  cap('queue 是空的時候 signal：nothing happens', '沒有人被叫起來，queue 還是空的');
  await step(tok);                                   // 644 semaphore 的值永遠會被修改
  const sg2 = pkt('signal', -6.4, 1.4, 2.6); await travel(tok, sg2, V3(-6.4, 1.4, 2.6), V3(-4.6, 1.2, 2.6), 600); remove(sg2);
  rl(semV, 'semaphore：S = 1');
  bad('semaphore：值一定被修改（可正可負）', -2.2, 1.6, 2.6);
  cap('semaphore 就算值是 0，signal 還是加 1', '值永遠會被修改：一個是 queue、一個是 counter');
  await step(tok);                                   // 683 結合後：在 CV queue 的 thread 是 inactive，別人進來 signal
  await slide(tok, th[2].g, -5.0, 0, -0.8, 400);
  cap('monitor ＋ CV 的 structure', '進 queue 的 thread inactive，別的 thread 才能進來 signal 它');
  await step(tok);                                   // 723 monitor 裡可以有很多 thread，但 active 的只有一個
  good('monitor 裡可以有很多 thread，但 active 的只有一個', 0.6, 4.8, -0.8);
  bad('「monitor 只能有一個 thread」→ 錯', 0.6, 4.1, -0.8);
  cap('重點：monitor 裡可以同時有很多 thread', '但 active 的只有一個；「只能有一個 thread」是錯的');
  void cq;
}]);

const DPC = ['monitor DP {', '  enum {THINKING, HUNGRY, EATING} state[5];', '  condition self[5];', '  void pickup(int i) {', '    state[i] = HUNGRY;', '    test(i);', '    if (state[i] != EATING) self[i].wait();', '  }', '  void putdown(int i) {', '    state[i] = THINKING;', '    test((i + 4) % 5);  test((i + 1) % 5);', '  }', '  void test(int k) {', '    if (state[(k+4)%5] != EATING && state[k] == HUNGRY', '        && state[(k+1)%5] != EATING) {', '      state[k] = EATING;  self[k].signal();', '    }', '  }', '  init: state[i] = THINKING;', '}'];
FRAG.push(['syn-21a-dining', 'Dining philosophers 的 monitor 解法', async (tok) => {
  fresh([2.2, 10, 10], [2.2, 1.0, 0]);
  let V, cd;
  const dpUp = () => V.update();
  await step(tok);                                   // 750 用 monitor 解 dining philosophers
  V = dpView();
  cap('接下來用 monitor', '來解 dining philosophers 的問題');
  await step(tok);                                   // 755 N 個人、筷子在中間；同時拿左邊 → deadlock
  cap('N 個人用餐要兩根筷子，筷子放在每兩人中間', '沒有同步，大家同時拿左邊就 deadlock');
  await step(tok);                                   // 786 用 monitor：把 method 定義出來
  cd = code(DPC, 7.2, 7.2, 0.36, -3.6);
  cap('只用 monitor：OO 的概念把 method 定義出來', '就不用去想什麼會造成 race condition');
  await step(tok);                                   // 804 state 陣列：記錄每個人的狀態
  cd.hl(1);
  cap('monitor 裡的變數：state', '這個例子五個人，array 記錄每個人目前的狀態');
  await step(tok);                                   // 823 thinking / hungry / eating
  cap('thinking：沒要吃；hungry：想吃但還沒拿到筷子', 'eating：左邊跟右邊的筷子都在他手上');
  await step(tok);                                   // 850 不能憑空多出筷子
  bad('筷子就是 5 根：不能憑空變出 10 根', 0, 1.2, 0);
  cap('解法不能憑空多出筷子', '寫錯的同步跑一跑「大家都吃到了」，卻用了十根，不行');
  await step(tok);                                   // 877 global shared state 看得到別人 → 比較好解（分散式更難）
  idx('補充：看得到別人的 state 已經是很大的 assumption；fully distributed 更難', 0, 0.2, 4.4);
  cap('用 global shared variable 讓大家看到彼此的狀態', '這樣比較好解；看不到別人 state 的分散式問題更難');
  await step(tok);                                   // 945 state 本身不能 race：誰會寫它？
  note('state 是 shared 的：要確認它本身不會 race（monitor 裡一次只有一個 active）', 0, 2.0, 0);
  cap('要 check 這個 shared state 本身會不會 race', '只有一個人會寫、其他人 read only 就不會');
  await step(tok);                                   // 985 self[i]：condition variable，拿不到筷子就等
  cd.hl(2);
  cap('接著是 self：condition variable', '想吃（hungry）卻拿不到筷子時，就在自己的 queue 裡等');
  await step(tok);                                   // 1032 動作：pickup、putdown，再加一個 test
  cd.hl(3);
  cap('動作切成 pickup(i)、putdown(i)', '再多加一個 test：吃之前試試看左右筷子是不是都沒人用');
  await step(tok);                                   // 1079 initialization：大家都是 thinking
  cd.hl(18);
  cap('最後 initialization', '一開始大家都是 thinking');
  await step(tok);                                   // 1107 pickup：state = HUNGRY → test(i) → 失敗就 wait
  cd.hl(5);
  dpAct(V, 0, 'monitor'); dpUp();
  cap('pickup(i)：i 要吃了 → state 設成 hungry', '先 test：哲0 左右都沒人在吃 → eating');
  await step(tok);                                   // 1168 test 失敗 → self[i].wait()，等鄰居叫
  cd.hl(6);
  dpAct(V, 1, 'monitor'); dpUp();
  cap('test 失敗（不是 eating）：哲1 的鄰居哲0 在吃', '就 self[1].wait()：把自己 suspend，等鄰居放下筷子叫他');
  await step(tok);                                   // 1213 putdown：thinking，test 左右鄰居
  cd.hl(10);
  dpAct(V, 0, 'monitor'); dpUp();
  cap('putdown(i)：放下筷子，state 變 thinking', '然後 test 左邊 (i+4)%5 和右邊 (i+1)%5 的人');
  await step(tok);                                   // 1288 test(k)：被測試的不一定是 call 的人
  cd.hl(12);
  cap('test 測的那個人', '不一定是 call 這個 function 的人：可能是之前被 suspend 的鄰居');
  await step(tok);                                   // 1332 條件：左右都不在吃
  cd.hl(13);
  cap('怎麼樣可以吃？左邊的人不在吃、右邊的人也不在吃', '代表兩邊的筷子都沒被拿起來');
  await step(tok);                                   // 1390 還要自己是 hungry（可能在幫別人測）
  cap('還要加上：自己是 hungry', '因為可能在幫別人測試，有筷子也不代表他想吃');
  await step(tok);                                   // 1424 → state = EATING，self[k].signal() 叫醒鄰居
  cd.hl(15);
  dpAct(V, 1, 'monitor'); dpUp();
  cap('三個條件都成立 → state 換成 eating', '再 self[k].signal()：把在等的鄰居叫起來，完成 pickup');
  await step(tok);                                   // 1473 queue 是空的也沒關係
  cap('鄰居可能根本沒在等，queue 是空的', 'signal 空的 queue 沒有任何負面影響');
  await step(tok);                                   // 1552 三個 function 描述行為 → 問題解掉
  cd.hl(-1);
  good('pickup、putdown、test：照行為描述出來就解掉了', 0, 1.2, 0);
  cap('把這三個 function 按照行為描述出來', '整個問題就解掉了');
}]);

// ════════ SNwNax1Wz7k（第 21B 講）：dining philosophers 跑一次、Java synchronized、atomic transaction ════════
FRAG.push(['syn-21b-trace', 'Monitor 解法跑一次：P1 吃、P2 等、P1 放下叫醒 P2', async (tok) => {
  fresh([2.2, 10, 10], [2.2, 1.0, 0]);
  let V, cd;
  await step(tok);                                   // 2 跟 low level 想 race 的方式完全不同
  V = dpView();
  cd = code(DPC, 7.2, 7.2, 0.36, -3.6);
  cap('跟之前想哪些 variable 會 race 完全不同', '從 method、programming 的角度解：好寫、會對');
  await step(tok);                                   // 44 monitor 保證一次一個人 call，最後都輪得到
  cap('monitor 本身保證一次一個人去 call', 'eventually 都會 call 到');
  await step(tok);                                   // 64 實際用法：吃之前 pickup、吃完 putdown
  note('哲 i：DP.pickup(i); 吃; DP.putdown(i);', 0, 1.2, 0);
  cap('整個 program：每個 process / thread', '吃之前 call pickup、吃完 call putdown');
  await step(tok);                                   // 97 左右鄰居不能同時吃
  cap('重點：左邊、右邊的人不能同時吃', 'pickup 完成才能開始吃，吃完 putdown');
  await step(tok);                                   // 116 一開始大家都是 thinking
  cd.hl(18);
  cap('一開始就像我們說的', '全部都是 thinking');
  await step(tok);                                   // 120 P1 先來：變 hungry，test
  cd.hl(4);
  cap('假設 P1 先來，他要吃', 'state 變成 hungry，然後 test 是不是可以吃');
  await step(tok);                                   // 130 第一個人一定成功：左右都 thinking → eating
  cd.hl(15); dpAct(V, 1, 'monitor'); V.update();
  cap('第一個人測試一定成功：左右都在 thinking', 'state 改成 eating，也不用 wait → 去吃');
  await step(tok);                                   // 163 P1 還沒 putdown，P2 來 pickup：test 失敗
  cd.hl(6); dpAct(V, 2, 'monitor'); V.update();
  cap('P1 還在吃，P2 就進來 pickup', '變成 hungry，test 失敗（鄰居 P1 在吃）→ 放進 waiting list');
  await step(tok);                                   // 186 P2 在 monitor 裡卡住，直到有人 signal
  bad('P2 卡在 self[2].wait()', 0, 1.2, 0);
  cap('P2 在 monitor 裡被卡住', '一直到有人 signal、把它叫起來');
  await step(tok);                                   // 202 P1 putdown：thinking，先測左邊 P0
  cd.hl(10); dpAct(V, 1, 'monitor'); V.update();
  cap('什麼時候叫起來？等 P1 call putdown', '自己改回 thinking，幫左邊 P0 測：P0 沒 hungry，沒事');
  await step(tok);                                   // 224 測 P2：條件都符合 → eating + signal
  cd.hl(15); dpAct(V, 2, 'monitor'); V.update();
  cap('再測右邊 P2：所有條件都符合', 'test 裡做兩件事：state 改成 eating、signal P2');
  await step(tok);                                   // 253 P2 進去吃
  cd.hl(-1);
  good('P1 putdown 結束後，P2 開始吃', 0, 1.8, 0);
  cap('P1 的 putdown 結束後', 'P2 就可以進到 eat：大家同步了');
  await step(tok);                                   // 265 只有 DP object 是 monitor；P1、P2 是 application
  idx('只有 DiningPhilosophers 這個 object 是 monitor；P1、P2 只是使用它的 application', 0, 0.2, 4.4);
  cap('只有 DP 這個 object 是 monitor', 'P1、P2 只是 application，用 class 的 method 解問題');
}]);

FRAG.push(['syn-21b-java', 'Java：synchronized method 與 synchronized statement', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.8, 0]);
  let cm, cs;
  await step(tok);                                   // 288 真實語言都包裝好了：Java 的 synchronized method
  hd('Java 怎麼支援 monitor？', 0, 6.4);
  cap('真實的 language 都包裝得非常好用', '像 Java 有 synchronized method');
  await step(tok);                                   // 306 用法跟 monitor 一樣，但更 fine-grained
  cm = code(['class Account {', '  private int balance;', '  public synchronized void deposit(int x) { … }', '  public synchronized void withdraw(int x) { … }', '  public int id() { … }   // 沒加', '}'], -3.0, 5.4, 0.5, -2.4);
  idx('（類別名稱、method 為示意）', -3.0, 2.0, -2.4);
  cap('用法跟 monitor 一樣', '但更 fine-grained 一點');
  await step(tok);                                   // 311 不是整個 class 是 monitor，而是任何一個 method 可以加 synchronized
  cm.hl(2);
  cap('它不是把整個 class 當成 monitor', 'class 裡任何一個 method，前面都可以加 synchronized');
  await step(tok);                                   // 323 告訴 compiler：這些 method 有 race，不能同時執行
  cm.hl(3);
  cap('告訴 compiler：這些 method 會 race', '它們不能同時執行');
  await step(tok);                                   // 335 很有彈性：programmer 決定哪些要 synchronize
  cm.hl(4);
  good('programmer 決定哪些 method 要 synchronized', 3.6, 1.2, 0.4);
  cap('很有彈性：一個 class 可能有 10 個 method', 'programmer 可以控制哪些要 synchronize、哪些不要');
  await step(tok);                                   // 347 貼上 synchronized 的全部互斥，不能分組
  bad('有標的全部互斥，不能像多把 mutex 那樣分組', 3.6, 2.0, 0.4);
  cap('只要貼上 synchronized，這些就要 mutual exclusive', '不能像不同的 mutex lock 那樣分成不同組');
  await step(tok);                                   // 369 Java 這樣支援；概念就是 monitor
  cm.hl(-1);
  cap('這就是 Java 支援的方式，很容易用', '概念就是 monitor，只是更有彈性');
  await step(tok);                                   // 391 另一種：statement level，比較接近 mutex lock
  cs = code(['synchronized (obj) {', '  balance = balance + x;', '}'], 3.4, 5.4, 0.5, -2.4);
  hot('statement level（比較像 mutex lock）', 3.4, 6.0, -2.4);
  cap('Java 還支援另一種：statement level', '這個比較接近 mutex lock');
  await step(tok);                                   // 412 把一段 statement 框起來，前面寫 synchronized(變數)
  cs.hl(0);
  cap('把一段 statement 框起來', '前面寫 synchronized 和一個 variable：它是會 race 的 shared variable');
  await step(tok);                                   // 432 compile 時自動加 lock / unlock
  const lk = prop('lock', 6.0, 0, 0.4, 0.8, 'lock / unlock');
  cap('compile 成最後的 code 之前', '它自己幫你在前面加 lock、後面加 unlock');
  await step(tok);                                   // 448 幫助 programmer：程式比較乾淨
  good('程式比較乾淨、容易懂', 3.4, 2.4, -2.4);
  cap('用 mutex lock 也可以', '但這樣比較簡單，程式比較乾淨、容易懂');
  await step(tok);                                   // 475 statement level、比較 fine-grained
  cs.hl(1);
  cap('它是比較 fine-grained', 'statement-level 的 synchronization tool');
  await step(tok);                                   // 492 每個語言不同：Java 兩種；Pthread 有 mutex、CV 的 API
  cs.hl(-1);
  note('Java：synchronized method / block　Pthread：mutex、condition variable 的 API', 0, 1.0, 1.6);
  cap('每個 language 都不太一樣', 'Java 主要這兩種；Pthread 是 mutex lock、condition variable 的 API');
  await step(tok);                                   // 515 classic problems：用來驗證 tool；軟體裡很常見
  idx('classic problems：拿來驗證 synchronization tool 好不好用；真實軟體裡到處都是', 0, 0.2, 3.4);
  cap('這就是 classic synchronization problems', '用它們驗證 tool；它們在一般軟體裡非常常見');
  void lk;
}]);

FRAG.push(['syn-21b-atomic', 'Atomic transaction：all or nothing、commit / rollback、log、checkpoint', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let log = [], logZ;
  await step(tok);                                   // 548 最後：atomic transaction
  hd('Atomic transaction', 0, 6.4);
  cap('這章最後提到的', 'atomic transaction');
  await step(tok);                                   // 565 atomic = 不可分割；可以形容各種執行單位
  ['instruction', 'function（wait / signal）', 'transaction'].forEach((t, k) => bx(t, ['#e0d6f5', '#c8b8f0', '#9b7ef4'][k], -4.4 + k * 4.4, 0.3, -2.6, 3.4, 0.6, 0.9, 1.5));
  cap('atomic 就是不可分割，是一個形容詞', '可以形容 instruction、function，也可以形容 transaction');
  await step(tok);                                   // 602 transaction：database，像 ATM 交易
  const atm = prop('monitor', -4.4, 0, 0.6, 0.9);
  idx('ATM 交易 = transaction', -4.4, 2.2, 0.6);
  cap('transaction 最常聽到的是 database', '像 ATM 提款這些交易，都叫 transaction');
  await step(tok);                                   // 628 transaction：一整個流程（跨銀行轉帳）
  const b1 = prop('warehouse', 0.6, 0, 0.6, 0.8, '銀行 A'), b2 = prop('warehouse', 4.6, 0, 0.6, 0.8, '銀行 B');
  arr(1.8, 0.8, 3.4, 0.8, '#8a7a5c', 0.6);
  cap('transaction 更複雜：是一整個流程', '轉帳還 involve 兩個銀行的業務操作');
  await step(tok);                                   // 655 database 類系統：atomic transaction
  cap('在 database 這類 system', '就會聽到 atomic transaction');
  await step(tok);                                   // 670 跟同步有關：兩人同時轉帳 → 錢可能不對
  bad('兩人同時轉帳、一存一領 → 餘額可能出錯', 2.6, 2.6, 0.6);
  cap('它跟 synchronization 有關', '兩人同時轉帳、一存一領，沒解好錢可能變不對');
  await step(tok);                                   // 699 transaction = collection of instructions，一種 logic
  note('transaction：一連串 instruction / function 組成的完整邏輯', 0, 4.4, -1.0);
  cap('transaction：collection of instructions', '甚至是 function：把整件事做完的一段邏輯');
  await step(tok);                                   // 717 atomic：要嘛全做完、要嘛不做；做一半 state unstable
  good('all or nothing：要嘛全做、要嘛不做', -2.6, 5.2, -1.0); bad('做一半 → state unstable', 3.0, 5.2, -1.0);
  cap('atomic：整個動作要嘛一次做完，要嘛不做', '不能做到一半：state unstable，不知道結果、也接不下去');
  await step(tok);                                   // 743 存錢 fail → 金額沒動
  idx('存錢失敗 → 金額沒動（不會莫名多 500）', -2.6, 0.2, 2.4);
  cap('存錢失敗就是金額沒動', 'all or nothing：這就是 atomic 的定義');
  await step(tok);                                   // 763 不只 database：file system、OS 重開機檢查
  prop('disk', 4.6, 0, 3.0, 0.8, 'file system');
  cap('不只 database，也可以想成整個 file system', '跳電重開機變慢，就是在檢查 file system 的 state');
  await step(tok);                                   // 812 一般作法：commit / abort（two-phase）
  logZ = zone('stable storage：log', 0, 0.02, 3.6, 6.0, 1.2, '#e8e1d6');
  cap('保證 atomic transaction 的傳統作法', '透過 commit / abort（two-phase 的動作）');
  await step(tok);                                   // 842 最後一定要 commit；沒 commit 就 rollback（像 git commit）
  const cm = bx('commit', SC.cs, -1.6, 0.3, 1.6, 1.8, 0.5, 0.8, 1.2), ab = bx('abort → rollback', SC.bad, 1.6, 0.3, 1.6, 2.6, 0.5, 0.8, 1.2);
  cap('執行很多動作後，最後一定要再做 commit', '沒有 commit，前面的都不承認，全部 rollback（像 GitHub 的 commit）');
  await step(tok);                                   // 883 保證 atomic = 要有能力 rollback（none 比較難）
  hot('難的是 none：做到一半要能回到原本的 state', 0, 2.4, 1.6);
  cap('要保證 atomic，就要有能力 rollback', 'all 簡單，難的是 none：做一半要回復原本的 state');
  await step(tok);                                   // 920 rollback 靠 logging，存在 stable storage
  for (let k = 0; k < 3; k++) { log.push(bx('log ' + (k + 1), '#fffaf0', -2.0 + k * 2.0, 0.25, 3.6, 1.6, 0.4, 0.7, 1.2)); await wt(tok, 250); }
  cap('怎麼 rollback？做 logging', '把 transaction 的每個步驟記在 stable storage：系統可以 crash，log 不能掉');
  await step(tok);                                   // 969 log 什麼：名稱、時間、動作、data 的舊值 / 新值
  note('log：transaction 名稱、時間、動作、data 的舊值 / 新值', 0, 1.6, 4.6);
  cap('log 不外乎：transaction 的名稱（第幾筆）、時間、動作', '最重要的是 data：舊值、新值，才能 reconstruct 或改回去');
  await step(tok);                                   // 1004 log 太多變慢、太少重建不了
  idx('log 太多 → 系統變慢；太少 → 沒辦法重建', 0, 0.2, 5.2);
  cap('log 哪些都是設計過的', 'log 太多系統變慢，太少沒辦法重建');
  await step(tok);                                   // 1027 checkpoint：log 沒有時間觀念，不能從十年前重來
  cap('另一個方式：checkpoint', 'log 沒時間觀念：server 跑了十年，總不能從頭重建');
  await step(tok);                                   // 1056 checkpoint = 系統還原點，從那裡開始
  const ck = bx('checkpoint', PCS[2], 0, 1.0, 3.6, 0.3, 1.4, 1.0, 1.0);
  idx('從最近的 checkpoint 開始，接著 log 往下做', 0, 2.0, 3.6);
  cap('checkpoint 就是系統還原點：記下完整 stable 的 state', '壞掉時從 checkpoint 開始，不用從頭');
  await step(tok);                                   // 1098 一般做法：長時間的 application 都會用
  good('很多跑很久的 application（例如三個月的大氣模擬）都用 checkpoint / rollback / commit', 0, 0.2, -2.0);
  cap('這是 file system、database 等很 general 的作法', '跑很久的 application 也會做，加快 recovery');
  void atm; void b1; void b2; void cm; void ab; void ck; void logZ;
}]);

// ════════ sEVfeXqWY-s（Process Synchronisation | Critical Section Problem）：independent / cooperative、劇場比喻、entry / exit ════════
FRAG.push(['syn-csneso-coop', 'Independent process vs cooperative process', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let L, R;
  await step(tok);                                   // 0 process synchronization
  hd('Process synchronization', 0, 6.4);
  cap('新主題：process synchronization', 'OS 裡的 process 怎麼同步');
  await step(tok);                                   // 12 依同步分成兩種：independent、cooperative
  L = zone('independent process', -3.6, 0.02, 0.4, 5.6, 3.6, '#d8e6cf'); R = zone('cooperative process', 3.6, 0.02, 0.4, 5.6, 3.6, '#f6e2d6');
  cap('從 synchronization 的角度', 'process 分成兩種：independent 和 cooperative');
  await step(tok);                                   // 51 independent：彼此沒有關係
  const a = pal('P1', '', PCS[0], -5.0, 0, 0.4, 0.6), b = pal('P2', '', PCS[1], -2.2, 0, 0.4, 0.6);
  cap('independent：彼此沒有 dependency', '一個 process 跟另一個沒有關係');
  await step(tok);                                   // 67 cooperative：一個依賴另一個
  const c = pal('P3', '', PCS[2], 2.4, 0, 0.4, 0.6), d = pal('P4', '', PCS[3], 4.8, 0, 0.4, 0.6);
  arr(3.0, 0.9, 4.2, 0.9, '#c08a1f', 0.4);
  cap('cooperative：一個 process 依賴另一個', '彼此之間要有互相的 understanding');
  await step(tok);                                   // 113 一個的執行會影響另一個
  idx('一個的執行 → 會影響另一個的執行', 3.6, 2.2, 0.4); idx('一個的執行 → 不影響其他人', -3.6, 2.2, 0.4);
  cap('independent：執行不影響其他 process', 'cooperative：一個的執行會影響另一個');
  await step(tok);                                   // 151 synchronization 問題只出現在 cooperative
  hot('synchronization 問題只出現在 cooperative process', 0, 5.4);
  cap('process synchronization 的問題', '只會出現在 cooperative process');
  await step(tok);                                   // 158 independent：各有自己的 resource，沒問題
  good('各用自己的 resource → 沒問題', -3.6, 3.0, 0.4);
  cap('independent 沒有 dependency', '不共用 resource，各有自己的 → 沒有同步問題');
  await step(tok);                                   // 184 cooperative：resource 是共用的
  bx('shared resource', SC.mem, 3.6, 0.35, 1.6, 2.4, 0.6, 0.9, 1.5);
  bad('resource 是共用的', 3.6, 3.0, 0.4);
  cap('cooperative process 會有同步問題', '因為 resource 是共用的');
  await step(tok);                                   // 196 例子：社區大家一起在劇場看電影
  prop('monitor', 3.6, 0, -1.0, 0.9, '社區劇場（一台）');
  cap('生活的例子：社區的人一起在劇場看電影', '');
  await step(tok);                                   // 221 同一部電影 → 要協調；各人想看的不同
  bub('我想看 A！', 2.4, 2.4, 0.4); bub('我想看 B！', 4.8, 2.6, 0.4);
  cap('大家一起看同一個螢幕，就要彼此合作', '有人想看這部、有人想看那部 → 同步問題');
  await step(tok);                                   // 257 在自己家看：自己的 TV，沒問題
  prop('monitor', -3.6, 0, -1.0, 0.8, '自己家的 TV');
  cap('如果你自己在家看', '用自己的 TV，就沒有問題');
  await step(tok);                                   // 270 總結
  cap('總結：independent process 沒有同步問題', '同步問題只發生在共用 resource 的 cooperative process');
  void L; void R; void a; void b; void c; void d;
}]);

FRAG.push(['syn-csneso-cs', 'Critical section problem：劇場比喻', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let th, ps = [];
  await step(tok);                                   // 287 critical section problem
  hd('Critical section problem', 0, 6.4);
  cap('接著說明 critical section problem', '');
  await step(tok);                                   // 317 critical section 就是一段 code segment
  const cs = bx('critical section（code segment）', SC.cs, 0, 0.35, -2.4, 4.4, 0.7, 1.0, 1.5);
  cap('critical section 其實就是', '一段 code segment（程式碼片段）');
  await step(tok);                                   // 326 同一時間只能有一個 process 執行
  note('同一時間只能有一個 process 執行它', 0, 1.5, -2.4);
  cap('這段 code segment', '同一時間只能被一個 process 存取、執行');
  await step(tok);                                   // 340 裡面有 shared variable，要同步才能保持一致
  idx('裡面有 shared variable → 要同步，資料才會 consistent', 0, 2.2, -2.4);
  cap('它包含 shared variable', '需要同步，才能維持資料的一致性');
  await step(tok);                                   // 357 劇場比喻：大家都要用的就是 shared variable
  th = room(0, 0.8, 0.6, 3.0, 1.6, 2.2, '#9b7ef4'); idx('劇場 = shared variable', 0, 1.8, 0.6);
  cap('用劇場來比喻', '大家都要用的劇場，就是 shared variable');
  await step(tok);                                   // 387 P1 想看 A、P2 想看 B、P3 想看 C
  ps = [['P1', 'A'], ['P2', 'B'], ['P3', 'C']].map(([n, m], k) => { const p = pal(n + '（' + m + '）', '', PCS[k], -5.4 + k * 1.3, 0, 2.6, 0.6); return p; });
  cap('P1 這群人想看電影 A、P2 想看 B、P3 想看 C', '但只有一個劇場可以放');
  await step(tok);                                   // 422 想看 A 的人先預約劇場 → 執行 critical section；其他人等
  await slide(tok, ps[0].g, 0, 0, 0.6, 700); glow(ps[0].body, OKG);
  ps[1].mood('sad'); ps[2].mood('sad');
  cap('想看 A 的人先預約劇場', '這就是在執行 critical section；其他人要等');
  await step(tok);                                   // 446 輪到下一個再看
  await slide(tok, ps[0].g, 5.0, 0, 2.6, 600); glow(ps[0].body, null);
  await slide(tok, ps[1].g, 0, 0, 0.6, 600); glow(ps[1].body, OKG); ps[1].mood('happy');
  cap('A 看完，下一群人進來看', '再下一群……一個接一個');
  await step(tok);                                   // 455 互相的 understanding；用不同的 solution 解
  good('mutual understanding：一個一個輪流用', 0, 3.2, 0.6);
  cap('這就是彼此之間的 mutual understanding', 'critical section problem 可以用不同的 solution 解');
  await step(tok);                                   // 512 大家同時要用 → 互相干擾 = critical section problem
  await slide(tok, ps[2].g, 0.8, 0, 0.6, 500);
  glow(ps[1].body, NOR); glow(ps[2].body, NOR);
  bad('同時都要用 → 互相干擾，電影放不成', 0, 4.0, 0.6);
  cap('如果所有 process 同時都要用 shared variable', '就會互相干擾：這就是 critical section problem');
  void cs; void th;
}]);

FRAG.push(['syn-csneso-struct', 'Entry section 上鎖、exit section 解鎖', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.6, 0]);
  let cd, ps, L;
  await step(tok);                                   // 540 寫出 critical section 的範例
  cd = code(['do {', '  entry section', '    critical section', '  exit section', '    remainder section', '} while (true);'], -3.8, 5.6, 0.55, -2.4);
  cap('寫一段範例程式', 'critical section：一次只能一個 process 存取的 code segment');
  await step(tok);                                   // 558 entry、critical、exit、remainder，while(true)
  cd.hl(1);
  cap('do：entry section → critical section', '→ exit section → remainder section，while (true) 一直重複');
  await step(tok);                                   // 591 P1、P2、P3 想用同一個 shared resource
  room(3.0, 0.8, -0.6, 3.0, 1.6, 2.2); idx('critical section', 3.0, 1.8, -0.6);
  ps = [0, 1, 2].map((k) => pal('P' + (k + 1), '', PCS[k], -0.8 + k * 1.2, 0, 2.6, 0.6));
  L = prop('lock', 5.4, 0, -1.6, 0.7);
  cap('P1、P2、P3 都想用', '同一個 shared resource');
  await step(tok);                                   // 609 P1 進 entry，條件成立 → 進 critical section
  cd.hl(2);
  await slide(tok, ps[0].g, 3.0, 0, -0.6, 700); glow(ps[0].body, OKG);
  await travel(tok, L, L.position.clone(), V3(3.0, 1.3, 0.4), 500);
  cap('P1 先進 entry section', '條件成立，進到 critical section');
  await step(tok);                                   // 618 它到 exit 之前，沒有其他 process 能進
  ps[1].mood('sad'); ps[2].mood('sad');
  cap('在 P1 進到 exit section 之前', '其他 process 都不能進 critical section');
  await step(tok);                                   // 627 P1 做完 → exit → remainder（獨立的）
  cd.hl(4);
  await slide(tok, ps[0].g, 6.0, 0, 2.6, 700); glow(ps[0].body, null);
  cap('P1 的工作做完（電影看完）', '經過 exit section，去做 remainder section：不影響別人');
  await step(tok);                                   // 655 不用 shared variable 的可以直接做 remainder
  idx('不用 shared variable 的 process → 直接做 remainder section', -1.0, 0.2, 3.8);
  cap('如果 P2 不需要 shared variable', '就直接執行 remainder section');
  await step(tok);                                   // 660 exit 通知別人 CS 空了：entry 上鎖、exit 解鎖
  cd.hl(3);
  note('entry section 上鎖、exit section 解鎖', -3.8, 1.6, -2.4);
  cap('exit 通知別人：critical section 空了', 'entry section 上鎖，exit section 解鎖');
  await step(tok);                                   // 686 entry 控制進入，並拿到 resource 的 lock
  cd.hl(1);
  cap('entry section 控制進入 critical section', '並拿到所需 resource 的 lock');
  await step(tok);                                   // 734 exit 解鎖，讓別人知道結束了
  cd.hl(3);
  await travel(tok, L, L.position.clone(), V3(5.4, 0.3, -1.6), 500);
  cap('工作結束，exit section 把 resource 的 lock 解開', '讓其他人知道 critical section 結束了');
  await step(tok);                                   // 753 P2 知道 CS 空了 → 進去
  await slide(tok, ps[1].g, 3.0, 0, -0.6, 700); glow(ps[1].body, OKG); ps[1].mood('happy');
  await travel(tok, L, L.position.clone(), V3(3.0, 1.3, 0.4), 400);
  cap('lock 一解開，P2 就知道可以進去了', '它用 shared variable 時，別人在它 exit 之前都不能用');
  await step(tok);                                   // 785 P1、P2、P3 同時要進 → 選誰？下集的 solution
  cd.hl(-1);
  bad('同時到達時要讓誰進？→ 下一集的 solution', 0, 4.4, 0.4);
  cap('如果大家同時要進，要選哪一個？', '這就是 critical section problem，下一集講解法');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
