// 作業系統 第11章：虛擬化與安全（Type 1 / Type 2 hypervisor、trap-and-emulate、protection rings、access matrix、安全威脅）。
// Chapter module for lab-shell.js — see public/lab/README-labs.md.
// 本章影片（Hypervisor Type 1 vs Type 2）尚無字幕，場景全部依恐龍書 Ch.16–18 製作。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#5a1010';
  const C = { hw: '#8a7a60', vmm: '#c08a1f', host: '#31aab0', guest: '#4b9ee2', app: '#2fc092', red: '#d64545', purple: '#9b7ef4', orange: '#dd8238', gray: '#c9bba3', pink: '#e55a9b' };
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
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { if (m) m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { if (m) m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  function seg(a, b, color = '#8a7a60') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  async function anim(tok, ms, fn) { const steps = 12; for (let k = 1; k <= steps; k++) { fn(k / steps); if (tok !== undefined) await beat(tok, ms / steps); else await sleep(ms / steps); } }
  const wait = (tok, ms) => (tok !== undefined ? beat(tok, ms) : sleep(ms));
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  // a small token that travels along a list of points
  async function travel(m, pts, tok, ms = 500) {
    for (const p of pts) { const a = m.position.clone(); await anim(tok, ms, (t) => m.position.lerpVectors(a, p, t)); }
  }

  // ───────────────────────── 模式 1：Type 1 vs Type 2 ─────────────────────────
  const VM = { type: 1 };
  function buildStack(type, n = 3) {
    const L = {};
    L.hw = cube('Hardware（CPU、memory、I/O）', C.hw, [11, 0.6, 2], 0, 0.3, 0);
    if (type === 1) {
      L.vmm = cube('VMM / Hypervisor（kernel mode）', C.vmm, [11, 0.6, 2], 0, 0.95, 0);
      L.g = []; L.a = [];
      for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 3.7; L.g.push(cube('guest OS ' + (i + 1), C.guest, [3.4, 0.6, 2], x, 1.6, 0)); L.a.push(cube('apps', C.app, [3.4, 0.5, 2], x, 2.2, 0)); }
    } else {
      L.host = cube('Host OS（Windows / Linux / macOS）', C.host, [11, 0.6, 2], 0, 0.95, 0);
      L.ha = cube('host apps', C.app, [3.2, 0.6, 2], -3.9, 1.6, 0);
      L.vmm = cube('VMM（一個 process）', C.vmm, [7.4, 0.6, 2], 1.8, 1.6, 0);
      L.g = []; L.a = [];
      for (let i = 0; i < Math.min(n, 2); i++) { const x = 0 + i * 3.7; L.g.push(cube('guest OS ' + (i + 1), C.guest, [3.4, 0.6, 2], x, 2.25, 0)); L.a.push(cube('apps', C.app, [3.4, 0.5, 2], x, 2.85, 0)); }
    }
    return L;
  }
  async function ioPath(type, L, tok) {
    const top = L.a[0].position.y;
    const x = L.a[0].position.x;
    const ball = cube('I/O', C.red, [0.7, 0.4, 0.4], x, top + 0.6, 1.3);
    const ys = type === 1 ? [[L.g[0], 'guest OS 的 driver 下指令'], [L.vmm, 'privileged → trap 到 VMM'], [L.hw, 'VMM 直接操作硬體']] : [[L.g[0], 'guest OS 的 driver 下指令'], [L.vmm, 'trap 到 VMM（只是一個 process）'], [L.host, 'VMM 再呼叫 host OS 的 system call'], [L.hw, 'host OS 的 driver 才碰到硬體']];
    for (const [m, cap] of ys) {
      await travel(ball, [V3(x, m.position.y, 1.3)], tok, 450);
      glow(m, GOLD); say(cap, (type === 1 ? 'Type 1' : 'Type 2') + '：經過 ' + (ys.indexOf(ys.find((y) => y[0] === m)) + 1) + ' 層');
      await wait(tok, 1100); glow(m, null);
    }
    kill(ball);
    return ys.length;
  }
  function enterVmm() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 4.5, 12], [0, 1.6, 0]);
    controls('<select id="vT"><option value="1">Type 1（bare-metal）</option><option value="2">Type 2（hosted）</option></select><button class="primary" id="vIO">guest 做一次 I/O</button><button id="vAdd">再開一台 VM</button>');
    $('vT').value = String(VM.type);
    $('vT').onchange = (e) => { VM.type = Number(e.target.value); clearLog(); enterVmm(); };
    VM.n = VM.n || 2;
    const L = buildStack(VM.type, VM.n);
    on('vIO', async () => { if (busy) return; busy = true; try { const k = await ioPath(VM.type, L); log((VM.type === 1 ? 'Type 1' : 'Type 2') + '：I/O 經過 ' + k + ' 層才到硬體。'); } finally { busy = false; } });
    on('vAdd', () => {
      const max = VM.type === 1 ? 3 : 2;
      if (VM.n >= max) { log('畫面只放得下 ' + max + ' 台 guest。', true); return; }
      VM.n++; clearLog(); enterVmm(); log('多開一台：VMM 幫每台 VM 提供一份虛擬的 CPU、memory、I/O。');
    });
    log(VM.type === 1 ? 'Type 1：VMM 直接跑在硬體上（VMware ESX、Xen、Hyper-V）。' : 'Type 2：VMM 是 host OS 上的一個應用程式（VirtualBox、VMware Workstation、Parallels）。');
    setState(VM.type === 1 ? 'Type 1 hypervisor（bare-metal）' : 'Type 2 hypervisor（hosted）', [
      ['VMM 跑在', VM.type === 1 ? '硬體上，kernel mode' : 'host OS 上，user mode'], ['效能', VM.type === 1 ? '較好（少一層）' : '較差（多經過 host OS）'], ['安裝', VM.type === 1 ? '要專用機器' : '裝在一般電腦上就能用'], ['常見用途', VM.type === 1 ? '資料中心、雲端' : '個人開發、測試'],
    ], '共同點：每台 VM 以為自己獨佔硬體<br>VMM 負責隔離（一台當掉不影響其他）');
  }

  // ───────────────────────── 模式 2：Trap-and-emulate ─────────────────────────
  const TE = { ins: 'priv', fix: 'none' };
  const INS = {
    norm: { name: 'add r1, r2（一般指令）', short: '一般指令 add', kind: 'normal' },
    priv: { name: 'cli / 設定 timer / I/O（privileged）', short: 'privileged 指令', kind: 'priv' },
    popf: { name: 'popf（x86 sensitive 但非 privileged）', short: 'popf', kind: 'sens' },
  };
  function buildTE() {
    const P = {};
    tag('physical user mode', 'idx', -4.2, 0.1, -2.6);
    tag('physical kernel mode', 'idx', 3.6, 0.1, -2.6);
    P.ga = cube('guest apps（virtual user）', C.app, [4.2, 0.5, 1.6], -3.6, 2.6, 0);
    P.gk = cube('guest kernel（virtual kernel）', C.guest, [4.2, 0.5, 1.6], -3.6, 1.9, 0);
    P.vmm = cube('VMM', C.vmm, [3.2, 0.6, 1.6], 3.6, 1.9, 0);
    P.cpu = cube('CPU', C.hw, [3, 0.6, 1.6], 0, 0.3, 0);
    return P;
  }
  async function runTE(ins, fix, P, tok) {
    const I = INS[ins];
    const t = cube(ins, C.red, [1.1, 0.4, 0.4], -3.6, 1.9, 1.2);
    say('guest kernel 執行' + I.short, I.name + '；guest 以為在 kernel mode，其實是 user mode');
    await wait(tok, 1500);
    await travel(t, [V3(0, 0.9, 1.2)], tok, 600);
    let ok = true, path;
    if (I.kind === 'normal') { glow(P.cpu, GREEN); say('一般指令：直接在 CPU 上跑', '原生速度，VMM 不介入'); path = '直接執行'; await wait(tok, 1800); }
    else if (I.kind === 'priv') {
      glow(P.cpu, RED); say('user mode 跑 privileged → trap', ''); await wait(tok, 1300);
      await travel(t, [V3(3.6, 1.9, 1.2)], tok, 600); glow(P.vmm, GOLD);
      say('VMM 檢查並 emulate：改這台 VM 的虛擬狀態', '例：只關掉這台 VM 的虛擬 interrupt'); await wait(tok, 2000);
      await travel(t, [V3(-3.6, 1.9, 1.2)], tok, 700);
      say('回到 guest，從下一個指令繼續', 'trap-and-emulate'); path = 'trap → VMM emulate → 回 guest'; await wait(tok, 1500);
    } else {
      if (fix === 'none') {
        glow(P.cpu, RED); ok = false;
        say('popf 不 trap，IF 旗標被忽略', '沒有 trap，VMM 根本不知道 → 行為錯誤'); path = '沒 trap，結果錯誤'; await wait(tok, 2600);
      } else if (fix === 'bt') {
        await travel(t, [V3(3.6, 1.9, 1.2)], tok, 600); glow(P.vmm, GOLD);
        say('Binary translation：先改寫 popf', 'VMM 把 guest kernel 的問題指令換成安全的指令序列'); path = 'binary translation'; await wait(tok, 2600);
      } else {
        glow(P.cpu, GOLD);
        say('硬體輔助：guest mode 下會 trap', 'Intel VT-x / AMD-V：VMM 可設定哪些指令要攔'); path = 'hardware assist'; await wait(tok, 2600);
      }
    }
    kill(t); glow(P.cpu, null); glow(P.vmm, null);
    return { ok, path };
  }
  function enterTrap() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 5, 11], [0, 1.4, 0]);
    controls('<select id="tI"><option value="norm">一般指令 add</option><option value="priv">privileged 指令</option><option value="popf">popf（x86 問題指令）</option></select>'
      + '<select id="tF"><option value="none">純 trap-and-emulate</option><option value="bt">binary translation</option><option value="hw">硬體輔助 VT-x</option></select><button class="primary" id="tGo">執行</button>');
    $('tI').value = TE.ins; $('tF').value = TE.fix;
    $('tI').onchange = (e) => { TE.ins = e.target.value; }; $('tF').onchange = (e) => { TE.fix = e.target.value; };
    const P = buildTE();
    on('tGo', async () => {
      if (busy) return; busy = true;
      try { const r = await runTE(TE.ins, TE.fix, P); log(INS[TE.ins].name + '：' + r.path, !r.ok); teState(r); } finally { busy = false; }
    });
    log('guest kernel 其實跑在 user mode（virtual kernel mode）；VMM 才在真正的 kernel mode。');
    teState(null);
  }
  function teState(r) {
    setState('Trap-and-emulate', [['指令', INS[TE.ins].name], ['補救方式', { none: '無', bt: 'binary translation', hw: 'VT-x / AMD-V' }[TE.fix]], ['結果', r ? (r.ok ? '<span class="ok">' + r.path + '</span>' : '<span class="no">' + r.path + '</span>') : '—']],
      '一般指令：直接跑<br>privileged：trap → VMM emulate → 返回（較慢）<br>x86 有 sensitive 卻不 trap 的指令 → 需要 BT 或硬體輔助');
  }

  // ───────────────────────── 模式 3：Protection rings ─────────────────────────
  const RG = { cpl: 3, act: 'priv', tgt: 0 };
  const RING_R = [1.2, 2.2, 3.2, 4.2];
  function buildRings() {
    const M = [];
    for (let r = 3; r >= 0; r--) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(RING_R[r], RING_R[r], 0.3, 48), new THREE.MeshStandardMaterial({ color: ['#c0392b', '#dd8238', '#c08a1f', '#4b9ee2'][r], roughness: 0.6 }));
      m.position.set(0, 0.15 + (3 - r) * 0.3, 0); m.castShadow = true; lab.world.add(m); M[r] = m;
      tag('ring ' + r, r === 0 ? 'ptr alt' : 'ptr', 0, 0.35 + (3 - r) * 0.3, RING_R[r] - 0.5);
    }
    tag('kernel', 'idx', 0, 1.6, 0); tag('user apps', 'idx', -3.7, 0.4, 0);
    return M;
  }
  function ringPos(r) { return V3(-(RING_R[r] - 0.5), 0.5 + (3 - r) * 0.3, 0); }
  function ringRule(cpl, act, tgt) {
    if (act === 'priv') return cpl === 0 ? [true, '只有 ring 0 能執行 privileged 指令'] : [false, 'ring ' + cpl + ' 執行 privileged 指令 → general protection fault（trap 給 OS）'];
    if (act === 'data') return tgt >= cpl ? [true, '可存取同層或權限更低（號碼更大）的資料'] : [false, 'ring ' + cpl + ' 不能直接碰 ring ' + tgt + ' 的資料'];
    if (act === 'gate') return [true, '透過 gate（system call / interrupt）進入 ring ' + Math.min(tgt, cpl) + '，入口由 OS 決定'];
    if (tgt === cpl) return [true, '同一個 ring 內的 jump 可以'];
    return tgt < cpl ? [false, '不能直接 jump 進更高權限的 code，要經 gate'] : [false, 'x86 也不能直接 jump 到較低權限的 code（只能 return / iret 回去）'];
  }
  function enterRings() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7, 9], [0, 0.6, 0]);
    controls('<label>程式在 ring <select id="gC"><option>0</option><option>1</option><option>2</option><option>3</option></select></label>'
      + '<select id="gA"><option value="priv">執行 privileged 指令</option><option value="data">讀 ring k 的資料</option><option value="jump">直接 jump 到 ring k 的 code</option><option value="gate">經 gate 呼叫 ring k</option></select>'
      + '<label>k = <select id="gT"><option>0</option><option>1</option><option>2</option><option>3</option></select></label><button class="primary" id="gGo">試試看</button>');
    $('gC').value = String(RG.cpl); $('gA').value = RG.act; $('gT').value = String(RG.tgt);
    $('gC').onchange = (e) => { RG.cpl = Number(e.target.value); }; $('gA').onchange = (e) => { RG.act = e.target.value; }; $('gT').onchange = (e) => { RG.tgt = Number(e.target.value); };
    const M = buildRings();
    on('gGo', async () => {
      if (busy) return; busy = true;
      try {
        const [ok, why] = ringRule(RG.cpl, RG.act, RG.tgt);
        const p = ringPos(RG.cpl);
        const t = cube('CPL ' + RG.cpl, ok ? C.app : C.red, [0.9, 0.4, 0.6], p.x, p.y + 0.3, 0);
        const tgtR = RG.act === 'priv' ? 0 : RG.tgt;
        const q = ringPos(tgtR);
        await sleep(300);
        if (ok) { await travel(t, [V3(q.x + 0.4, q.y + 0.4, 0.8)], undefined, 700); glow(M[tgtR], GREEN); }
        else { await travel(t, [V3((p.x + q.x) / 2, p.y + 0.6, 0.8)], undefined, 500); glow(M[tgtR], RED); fly(t); }
        say(ok ? '允許' : '拒絕：trap', why);
        log(why, !ok);
        await sleep(1200); glow(M[tgtR], null); if (ok) kill(t);
      } finally { busy = false; }
    });
    setState('Protection rings（Intel x86）', [['ring 0', 'kernel'], ['ring 3', 'user'], ['ring 1、2', '一般 OS 不用'], ['VT-x', 'VMM 用更底層的模式（俗稱 ring −1）']], '號碼越小權限越大<br>CPL ≤ 目標層級才能直接存取；往內只能經 gate');
    log('選程式所在的 ring 和動作，看 CPU 允不允許。');
  }

  // ───────────────────────── 模式 4：Access matrix ─────────────────────────
  // 恐龍書 Fig.：D1–D4 × F1、F2、F3、printer
  const DOM = ['D1', 'D2', 'D3', 'D4'], OBJ = ['F1', 'F2', 'F3', 'printer'];
  const AM = [
    ['read', '', 'read', ''],
    ['', '', '', 'print'],
    ['', 'read', 'execute', ''],
    ['read write', '', 'read write', ''],
  ];
  const MX = { d: 0, o: 0, op: 'read', view: 'none' };
  const cellP = (d, o) => V3(-3.3 + o * 2.4, 0.2, -2.1 + d * 1.4);
  function buildMatrix(tok) {
    const M = [];
    OBJ.forEach((o, j) => tag(o, 'ptr', -3.3 + j * 2.4, 0.2, -3.2));
    DOM.forEach((d, i) => tag(d, 'ptr', -5.6, 0.2, -2.1 + i * 1.4));
    for (let i = 0; i < 4; i++) { M[i] = []; for (let j = 0; j < 4; j++) { const p = cellP(i, j); M[i][j] = cube(AM[i][j] || '—', AM[i][j] ? C.guest : C.gray, [2.2, AM[i][j] ? 0.4 : 0.15, 1.2], p.x, AM[i][j] ? 0.2 : 0.08, p.z); } }
    return M;
  }
  function enterMatrix() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 9, 7.5], [0, 0, 0]);
    controls('<select id="mD">' + DOM.map((d, i) => '<option value="' + i + '">' + d + '</option>').join('') + '</select>'
      + '<select id="mO">' + OBJ.map((o, i) => '<option value="' + i + '">' + o + '</option>').join('') + '</select>'
      + '<select id="mP"><option>read</option><option>write</option><option>execute</option><option>print</option></select><button class="primary" id="mGo">可以嗎？</button>'
      + '<button id="mAcl">看 ACL（直行）</button><button id="mCap">看 capability（橫列）</button>');
    $('mD').value = String(MX.d); $('mO').value = String(MX.o); $('mP').value = MX.op;
    $('mD').onchange = (e) => { MX.d = Number(e.target.value); }; $('mO').onchange = (e) => { MX.o = Number(e.target.value); }; $('mP').onchange = (e) => { MX.op = e.target.value; };
    const M = buildMatrix();
    const reset = () => M.forEach((r) => r.forEach((m) => glow(m, null)));
    on('mGo', async () => {
      reset();
      const rights = AM[MX.d][MX.o].split(' ').filter(Boolean);
      const ok = rights.includes(MX.op);
      glow(M[MX.d][MX.o], ok ? GREEN : RED);
      const msg = DOM[MX.d] + ' 對 ' + OBJ[MX.o] + ' 做 ' + MX.op + '：' + (ok ? '允許' : '拒絕（格子裡沒有這個權限）');
      say(ok ? '允許' : '拒絕', 'access(' + DOM[MX.d] + ', ' + OBJ[MX.o] + ') = {' + rights.join(', ') + '}');
      log(msg, !ok);
    });
    on('mAcl', () => {
      reset(); for (let i = 0; i < 4; i++) glow(M[i][MX.o], GOLD);
      const list = DOM.map((d, i) => (AM[i][MX.o] ? '<' + d + ', {' + AM[i][MX.o].replace(' ', ', ') + '}>' : null)).filter(Boolean);
      say(OBJ[MX.o] + ' 的 ACL：一直行', list.join(' '));
      log('ACL（存在物件旁）：' + OBJ[MX.o] + ' → ' + list.join(' ') + '；空格不存。');
    });
    on('mCap', () => {
      reset(); for (let j = 0; j < 4; j++) glow(M[MX.d][j], GOLD);
      const list = OBJ.map((o, j) => (AM[MX.d][j] ? o + ':{' + AM[MX.d][j].replace(' ', ', ') + '}' : null)).filter(Boolean);
      say(DOM[MX.d] + ' 的 capability list：一橫列', list.join('  '));
      log('Capability list（domain 持有，像通行證）：' + DOM[MX.d] + ' → ' + list.join('  '));
    });
    setState('Access matrix', [['列（row）', 'domain：一組（object, rights）'], ['行（column）', 'object'], ['格子', 'access(i, j)：Di 能對 Oj 做的操作']],
      '依行存 → <b>ACL</b>：查「誰能用這個檔案」快，撤銷容易<br>依列存 → <b>capability list</b>：查「我能用什麼」快，撤銷困難');
    log('矩陣大多是空格，所以實作上不存整張表，而是存 ACL 或 capability list。');
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  function genQ() {
    const t = Math.random();
    if (t < 0.25) {
      const d = Math.floor(Math.random() * 4), o = Math.floor(Math.random() * 4), op = pickOne(['read', 'write', 'execute', 'print']);
      const ok = AM[d][o].split(' ').includes(op);
      return { q: '依恐龍書的 access matrix（D1: F1 read, F3 read；D2: printer print；D3: F2 read, F3 execute；D4: F1 rw, F3 rw），' + DOM[d] + ' 能對 ' + OBJ[o] + ' 做 ' + op + ' 嗎？', opts: ['可以', '不行'], ans: ok ? '可以' : '不行', why: 'access(' + DOM[d] + ', ' + OBJ[o] + ') = {' + (AM[d][o] || '空') + '}。' };
    }
    if (t < 0.45) {
      const cpl = Math.floor(Math.random() * 4), act = pickOne(['priv', 'data', 'jump']), tgt = Math.floor(Math.random() * 4);
      const [ok, why] = ringRule(cpl, act, tgt);
      const a = { priv: '執行 privileged 指令', data: '直接讀 ring ' + tgt + ' 的資料', jump: '直接 jump 到 ring ' + tgt + ' 的 code' }[act];
      return { q: '在 ring ' + cpl + ' 的程式' + a + '，CPU 會允許嗎？', opts: ['允許', '拒絕（產生 trap）'], ans: ok ? '允許' : '拒絕（產生 trap）', why };
    }
    const qset = [
      { q: 'VirtualBox 安裝在 Windows 上跑 Linux，屬於哪一型 hypervisor？', opts: ['Type 2（hosted）', 'Type 1（bare-metal）', 'Paravirtualization', 'Container'], ans: 'Type 2（hosted）', why: 'VMM 是 host OS 上的一個應用程式。' },
      { q: 'VMware ESX / Xen 直接安裝在伺服器硬體上，屬於？', opts: ['Type 1（bare-metal）', 'Type 2（hosted）', 'Emulator', 'Container'], ans: 'Type 1（bare-metal）', why: 'VMM 直接跑在硬體上，沒有 host OS。' },
      { q: 'Type 1 相對 Type 2 hypervisor 的主要優點？', opts: ['少經過 host OS，效能較好', '安裝最簡單', '不需要 VMM', '可以不用硬體'], ans: '少經過 host OS，效能較好', why: 'Type 2 的 I/O 還要經過 host OS。' },
      { q: 'Trap-and-emulate 中，guest kernel 實際上跑在哪個 mode？', opts: ['physical user mode', 'physical kernel mode', 'ring −1', 'SMM'], ans: 'physical user mode', why: '它是 virtual kernel mode，只有 VMM 在真正的 kernel mode。' },
      { q: 'guest kernel 執行 privileged 指令時會發生什麼？', opts: ['trap 給 VMM，由 VMM emulate', '直接在硬體上執行', '整台機器當機', '被忽略'], ans: 'trap 給 VMM，由 VMM emulate', why: 'user mode 執行 privileged 指令會 trap。' },
      { q: '為什麼早期 x86 不能只靠 trap-and-emulate？', opts: ['有 sensitive 但不 trap 的指令（如 popf）', 'x86 沒有 user mode', 'x86 沒有 interrupt', 'VMM 不能跑在 ring 0'], ans: '有 sensitive 但不 trap 的指令（如 popf）', why: '解法：binary translation 或硬體輔助（VT-x / AMD-V）。' },
      { q: '依 access matrix 的「行（column）」儲存，稱為？', opts: ['Access control list', 'Capability list', 'Global table', 'Lock-key'], ans: 'Access control list', why: '每個 object 一串 <domain, rights>。' },
      { q: 'Capability list 的主要缺點？', opts: ['撤銷（revocation）權限困難', '查詢「我能用什麼」很慢', '不能表示 execute', '只能用在檔案'], ans: '撤銷（revocation）權限困難', why: 'capability 散在各 domain 手上，要收回得一一找出來。' },
      { q: '程式偷偷做了使用者不知道的壞事（偽裝成有用軟體），稱為？', opts: ['Trojan horse', 'Trap door', 'Logic bomb', 'Worm'], ans: 'Trojan horse', why: 'trap door 是作者留的後門；logic bomb 條件成立才發作；worm 自我複製透過網路散播。' },
      { q: 'Buffer overflow 攻擊通常覆蓋 stack 上的什麼，以跳到攻擊碼？', opts: ['return address', 'page table', 'interrupt vector', 'file descriptor'], ans: 'return address', why: '超長輸入蓋過 local buffer、saved frame pointer，再蓋 return address。' },
      { q: '在 x86 上，OS kernel 通常跑在哪一個 ring？', opts: ['ring 0', 'ring 1', 'ring 2', 'ring 3'], ans: 'ring 0', why: 'user 程式在 ring 3，號碼越小權限越大。' },
    ];
    return pickOne(qset);
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

  // ───────────────────────── 場景（全部依恐龍書） ─────────────────────────
  async function scVmIdea(tok) {
    fresh([0, 4.5, 12], [0, 1.6, 0]);
    const hw = cube('一台實體機器', C.hw, [11, 0.6, 2], 0, 0.3, 0, 2);
    say('課本：虛擬機器的想法', '一台硬體，同時跑好幾個 OS');
    await beat(tok, 2400);
    const v = cube('VMM：提供虛擬的 CPU、memory、I/O', C.vmm, [11, 0.6, 2], 0, 0.95, 0, 3);
    await beat(tok, 1600);
    const g = ['Windows', 'Linux', 'FreeBSD'].map((n, i) => cube(n, C.guest, [3.4, 0.6, 2], (i - 1) * 3.7, 1.6, 0, 3));
    say('每個 guest 以為自己獨佔整台機器', 'VMM 把硬體「複製」成多份');
    await beat(tok, 2600);
    glow(g[1], RED); fly(g[1]);
    say('一台 guest 當掉不影響其他', '好處：隔離、整合伺服器、測試開發、遷移');
    await beat(tok, 3200);
  }
  async function scType(type, tok) {
    fresh([0, 4.5, 12], [0, 1.8, 0]);
    say(type === 1 ? '課本：Type 1（bare-metal）' : '課本：Type 2（hosted）', type === 1 ? 'VMM 直接跑在硬體上' : 'VMM 是 host OS 上的應用程式');
    const L = buildStack(type, type === 1 ? 3 : 2);
    await beat(tok, 2600);
    say(type === 1 ? '例：VMware ESX、Xen' : '例：VirtualBox', type === 1 ? '資料中心、雲端常用' : '個人電腦上就能裝');
    await beat(tok, 2400);
    await ioPath(type, L, tok);
    say(type === 1 ? '少一層 → 效能較好' : '多經過 host OS → 較慢', type === 1 ? '但要專用機器' : '安裝方便、適合開發測試');
    await beat(tok, 3000);
  }
  async function scTrapEmulate(tok) {
    fresh([0, 5, 11], [0, 1.4, 0]);
    const P = buildTE();
    say('課本：trap-and-emulate', 'guest kernel 跑在 virtual kernel mode（實為 user）');
    await beat(tok, 2600);
    await runTE('norm', 'none', P, tok);
    await runTE('priv', 'none', P, tok);
    say('privileged 指令都要繞一圈 VMM', '所以虛擬化後 kernel 操作變慢');
    await beat(tok, 3000);
  }
  async function scBinTrans(tok) {
    fresh([0, 5, 11], [0, 1.4, 0]);
    const P = buildTE();
    say('課本：x86 的問題指令 popf', 'user mode 執行時不 trap，只是忽略部分旗標');
    await beat(tok, 2400);
    await runTE('popf', 'none', P, tok);
    await runTE('popf', 'bt', P, tok);
    await runTE('popf', 'hw', P, tok);
    say('現代 CPU 有硬體輔助，VMM 容易得多', 'Intel VT-x、AMD-V');
    await beat(tok, 3000);
  }
  async function scRings(tok) {
    fresh([0, 7, 9], [0, 0.6, 0]);
    const M = buildRings();
    say('課本：protection rings', '號碼越小權限越大；kernel ring 0、user ring 3');
    await beat(tok, 2800);
    const cases = [[3, 'priv', 0], [3, 'data', 0], [3, 'gate', 0], [0, 'data', 3]];
    for (const [cpl, act, tgt] of cases) {
      const [ok, why] = ringRule(cpl, act, tgt);
      const p = ringPos(cpl), tr = act === 'priv' ? 0 : tgt, q = ringPos(tr);
      const t = cube('ring ' + cpl, ok ? C.app : C.red, [0.9, 0.4, 0.6], p.x, p.y + 0.3, 0);
      say({ priv: 'ring 3 執行 privileged 指令？', data: 'ring ' + cpl + ' 讀 ring ' + tgt + ' 的資料？', gate: 'ring 3 經 system call 進 kernel？' }[act], '');
      await beat(tok, 1300);
      if (ok) { await travel(t, [V3(q.x + 0.4, q.y + 0.4, 0.8)], tok, 700); glow(M[tr], GREEN); } else { await travel(t, [V3((p.x + q.x) / 2, p.y + 0.6, 0.8)], tok, 500); glow(M[tr], RED); fly(t); }
      say(ok ? '允許' : '拒絕 → trap', why);
      await beat(tok, 2200); glow(M[tr], null); if (ok) kill(t);
    }
    say('VT-x 再多一層給 VMM（ring −1）', 'guest kernel 就能真的待在 ring 0');
    await beat(tok, 3000);
  }
  async function scAccessMatrix(tok) {
    fresh([0, 9, 7.5], [0, 0, 0]);
    say('課本：access matrix', 'row = domain、column = object');
    const M = buildMatrix();
    await beat(tok, 2800);
    for (const [d, o, op] of [[3, 0, 'write'], [0, 0, 'write'], [1, 3, 'print']]) {
      const ok = AM[d][o].split(' ').includes(op);
      glow(M[d][o], ok ? GREEN : RED);
      say(DOM[d] + ' 對 ' + OBJ[o] + ' 做 ' + op + '？' + (ok ? '可以' : '不行'), 'access(' + DOM[d] + ', ' + OBJ[o] + ') = {' + (AM[d][o] || '空') + '}');
      await beat(tok, 2200); glow(M[d][o], null);
    }
    say('大部分格子是空的', '實作上存成 ACL 或 capability list');
    await beat(tok, 2800);
  }
  async function scAclCap(tok) {
    fresh([0, 9, 7.5], [0, 0, 0]);
    const M = buildMatrix();
    say('ACL：沿著直行切', '每個 object 存 <domain, rights>');
    for (let i = 0; i < 4; i++) { glow(M[i][2], GOLD); await beat(tok, 400); }
    tag('F3 的 ACL：<D1,read> <D3,execute> <D4,read write>', 'ptr alt', -0.9, 1.0, 3.4);
    await beat(tok, 2600);
    say('查「誰能用 F3」很快，撤銷也容易', 'UNIX 的 rwx 就是簡化的 ACL');
    await beat(tok, 2400);
    M.forEach((r) => r.forEach((m) => glow(m, null)));
    say('Capability list：沿著橫列切', '每個 domain 拿一串（object, rights）');
    for (let j = 0; j < 4; j++) { glow(M[3][j], GOLD); await beat(tok, 400); }
    tag('D4 的 capability：F1:{read,write}  F3:{read,write}', 'ptr', -0.9, 1.0, 2.6);
    await beat(tok, 2600);
    say('像通行證：出示就能用', '缺點：權限散在各處，撤銷困難');
    await beat(tok, 3000);
  }
  async function scThreatProgram(tok) {
    fresh([0, 5, 11], [0, 1.2, 0]);
    say('課本：program threats', '');
    const items = [
      ['Trojan horse', C.orange, '看似有用的程式，偷偷做壞事（例：假登入畫面偷密碼）'],
      ['Trap door', C.purple, '作者留下的後門：特定帳號／輸入可繞過檢查'],
      ['Logic bomb', C.red, '條件成立才發作（例：某日期、某人被刪帳號）'],
      ['Virus', C.pink, '附在其他程式上，執行時感染別的程式'],
    ];
    for (let i = 0; i < items.length; i++) {
      const [n, c, d] = items[i];
      const m = cube(n, c, [2.6, 0.7, 1.4], -4.5 + i * 3, 0.35, 0, 3);
      say(n, d);
      await beat(tok, 2600);
    }
    await beat(tok, 1500);
  }
  async function scBufferOverflow(tok) {
    fresh([0, 4.5, 11], [0, 2.2, 0]);
    say('課本：buffer overflow', 'stack smashing：C 的 strcpy 不檢查長度');
    const frame = [['buffer[8]', C.guest, 0.3], ['saved frame pointer', C.gray, 1.0], ['return address', C.app, 1.7], ['caller frame', C.gray, 2.4]];
    const F = frame.map(([n, c, y]) => cube(n, c, [4, 0.6, 1.4], -2.5, y, 0));
    tag('stack 往高位址 ↑', 'idx', -5.6, 2.8, 0);
    await beat(tok, 2600);
    const pay = [];
    for (let k = 0; k < 3; k++) {
      pay.push(cube(k === 2 ? '→ 攻擊碼位址' : 'AAAA…', C.red, [3.6, 0.5, 1.2], 3, 0.3 + k * 0.7, 0, 2));
      await beat(tok, 500);
    }
    say('輸入比 buffer 長，一路往上蓋', '');
    for (let k = 0; k < 3; k++) { move(pay[k], -2.5, 0.3 + k * 0.7, 0.8); await beat(tok, 700); glow(F[k], RED); }
    say('return address 被改成攻擊碼', '函式 return 時就跳去執行它');
    await beat(tok, 3000);
    say('防護：檢查長度、stack 不可執行（NX）', '還有 canary、ASLR');
    await beat(tok, 3000);
  }
  async function scThreatNet(tok) {
    fresh([0, 5, 11], [0, 1, 0]);
    say('課本：system / network threats', '');
    const hosts = []; for (let i = 0; i < 5; i++) hosts.push(cube('host', C.guest, [1.4, 0.6, 1], -5 + i * 2.5, 0.3, -1));
    say('Worm：自己複製，透過網路散播', '不需要附在其他程式上');
    for (let i = 0; i < 5; i++) { tint(hosts[i], C.red); await beat(tok, 500); }
    await beat(tok, 1600);
    hosts.forEach((h) => tint(h, C.guest));
    const srv = cube('server', C.vmm, [2, 0.9, 1.2], 0, 0.45, 2);
    say('Denial of service：大量請求塞爆服務', 'DDoS：很多台一起來');
    for (let k = 0; k < 8; k++) { const r = cube('', C.red, [0.3, 0.3, 0.3], -5 + (k % 5) * 2.5, 1, -1); move(r, (Math.random() - 0.5) * 1.5, 1.2 + Math.random(), 2); await beat(tok, 200); }
    glow(srv, RED);
    await beat(tok, 2400);
    say('Port scanning：先找出有漏洞的服務', '常是攻擊的前置動作');
    await beat(tok, 3000);
  }

  const scenes = {
    'vm-idea': { title: '課本：虛擬機器的想法', play: scVmIdea },
    'type1': { title: '課本：Type 1（bare-metal）hypervisor', play: (tok) => scType(1, tok) },
    'type2': { title: '課本：Type 2（hosted）hypervisor', play: (tok) => scType(2, tok) },
    'trap-emulate': { title: '課本：trap-and-emulate', play: scTrapEmulate },
    'binary-translation': { title: '課本：popf 問題、binary translation、VT-x', play: scBinTrans },
    'prot-rings': { title: '課本：protection rings', play: scRings },
    'access-matrix': { title: '課本：access matrix', play: scAccessMatrix },
    'acl-vs-cap': { title: '課本：ACL vs capability list', play: scAclCap },
    'threat-program': { title: '課本：Trojan horse、trap door、logic bomb、virus', play: scThreatProgram },
    'buffer-overflow': { title: '課本：buffer overflow 蓋掉 return address', play: scBufferOverflow },
    'threat-network': { title: '課本：worm、DoS、port scanning', play: scThreatNet },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ hv.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, relabel } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 11 章 Virtualization：What is a Hypervisor? Type 1 vs Type 2（英文短片）— cued scenes ───
// 一句一步：每一步等影片講到那句才動，動作很短，不重播。影片沒給數字，畫面上的 VM 數量是示意。
const wt = (tok, ms) => ctx.beat(tok, ms);
const cap = (a, b = '') => say(a, b);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z);
const MC = { hw: '#8a7a60', vmm: '#c08a1f', host: '#31aab0', guest: '#4b9ee2', app: '#2fc092', red: '#d64545', purple: '#9b7ef4', orange: '#dd8238', gray: '#c9bba3', pink: '#e55a9b' };
const HL = '#6a4a00', OKG = '#0f5a3a', NG = '#5a1010';
const gone = (...os) => os.forEach((o) => { if (!o) return; if (Array.isArray(o)) return gone(...o); if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
function scene(id, title, cam, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 4.4, 14.5], [0, 2.8, 0]];
// 一台 VM：guest OS + app，疊在 (x, y)
function vm(name, x, y, c = MC.guest) {
  const os = bx(name + ' OS', c, x, y, 0, 2.2, 0.6, 1.0);
  const ap = bx('app', MC.app, x, y + 0.65, 0, 1.6, 0.5, 0.8);
  return [os, ap];
}

// ════════ pS-QM22YXmU（What is a Hypervisor? Type 1 vs Type 2） ════════
scene('hv-what', 'Hypervisor 是什麼', CAM, [
  async (tok, S) => {                                   // 0 建立、管理 VM 的軟體
    S.hw = bx('physical computer（hardware）', MC.hw, 0, 0.4, 0, 9, 0.8, 1.4);
    S.hv = bx('hypervisor', MC.vmm, 0, 1.25, 0, 9, 0.6, 1.2);
    cap('hypervisor：一個軟體', '專門建立和管理 virtual machine（VM）');
  },
  async (tok, S) => {                                   // 5 也叫 VMM
    hot('= VMM（virtual machine monitor）', 0, 2.2, 0.8);
    cap('又叫 virtual machine monitor', '簡稱 VMM');
  },
  async (tok, S) => {                                   // 10 一台 host 跑好幾台 guest
    relabel(S.hw, 'host（實體電腦）');
    S.vms = [-3, 0, 3].map((x, i) => vm('guest ' + (i + 1), x, 2.9));
    sm('（VM 數量為示意）', 4.6, 4.6);
    cap('讓一台實體電腦（host）', '同時執行好幾台虛擬電腦（guest）');
  },
  async (tok, S) => {                                   // 16 切分 memory 與 processing
    S.parts = [-3, 0, 3].map((x) => bx('CPU / RAM 一份', MC.gray, x, -0.45, 0.6, 2.6, 0.4, 0.6));
    cap('做法：把 memory 和 processing', '切成好幾份分給各 VM');
  },
  async (tok, S) => {                                   // 22 每一份都像獨立電腦
    S.vms.forEach(([o]) => glow(o, OKG));
    good('每個 VM 都像一台獨立的電腦', 0, 5.0);
    cap('虛擬化後，每一份都像', '一台分開、獨立的電腦：靠 hypervisor 做到');
  },
  async (tok, S) => {                                   // 38 為什麼需要：充分利用、彈性
    S.vms.forEach(([o]) => glow(o, null));
    note('充分利用一台電腦的能力；管理 IT 更有彈性', -3.6, 6.0);
    cap('為什麼需要 hypervisor？', '充分利用電腦的能力，管理上更有彈性');
  },
  async (tok, S) => {                                   // 48 VM 跟硬體無關 → 可搬到別台 server
    S.h2 = bx('另一台 server', MC.hw, 6.0, 0.4, -2.6, 2.6, 0.8, 1.2);
    const [o, a] = S.vms[2]; await anim(tok, 1200, (u) => { o.position.set(3 + 3 * u, 2.9 - 1.8 * u, -2.6 * u); a.position.set(3 + 3 * u, 3.55 - 1.8 * u, -2.6 * u); });
    cap('VM 不綁定底下的硬體', '所以可以很容易地搬（migrate）到別台 server');
  },
]);

scene('hv-types', 'Type 1（bare metal） vs Type 2（hosted）', CAM, [
  async (tok, S) => {                                   // 54 兩種類型，原理一樣
    hd('Type 1', -3.4, 6.4); hd('Type 2', 3.4, 6.4);
    cap('cloud computing 用的 hypervisor 分兩種', '不管哪一種，原理都一樣');
  },
  async (tok, S) => {                                   // 65 VM 可以建在各種 hypervisor 上
    note('VM 可以建立在各種 hypervisor 上', 0, 5.7);
    cap('VM 可以建立在很多種 hypervisor 上', '');
  },
  async (tok, S) => {                                   // 71 Type 1：直接在硬體上
    S.h1 = bx('hardware', MC.hw, -3.4, 0.4, 0, 5.0, 0.7, 1.2);
    S.v1 = bx('Type 1 hypervisor', MC.vmm, -3.4, 1.15, 0, 5.0, 0.6, 1.1);
    S.g1 = [-4.6, -2.2].map((x, i) => vm('guest ' + (i + 1), x, 1.9));
    cap('Type 1：直接跑在硬體上', '中間沒有別的作業系統');
  },
  async (tok, S) => {                                   // 75 bare metal
    hot('bare-metal hypervisor', -3.4, 3.6);
    cap('所以也叫 bare-metal hypervisor', 'bare metal = 「裸機」');
  },
  async (tok, S) => {                                   // 80 hypervisor 就是 host 的 OS
    glow(S.v1, HL); good('hypervisor 本身就當 host 的作業系統', -3.4, 4.3);
    cap('在實體 server 上', 'hypervisor 本身就扮演 host 的作業系統');
  },
  async (tok, S) => {                                   // 84 Type 2：hosted
    glow(S.v1, null);
    S.h2 = bx('hardware', MC.hw, 3.4, 0.4, 0, 5.0, 0.7, 1.2);
    hot('hosted hypervisor', 3.4, 4.3);
    cap('Type 2：hosted hypervisor', '');
  },
  async (tok, S) => {                                   // 90 跑在已安裝的 OS 上
    S.os2 = bx('host OS（Windows / macOS / Linux）', MC.host, 3.4, 1.15, 0, 5.0, 0.6, 1.1);
    S.v2 = bx('Type 2 hypervisor', MC.vmm, 2.2, 1.8, 0, 2.5, 0.6, 1.0); bx('一般 app', MC.app, 4.7, 1.8, 0, 2.2, 0.6, 1.0);
    S.g2 = vm('guest', 2.2, 2.45);
    cap('跑在一個已經裝好的作業系統上面', '就像一般的應用程式');
  },
  async (tok, S) => {                                   // 96 先裝 host OS
    glow(S.os2, HL); note('用 Type 2 之前：host 要先裝好作業系統', 3.4, 5.1);
    cap('用 Type 2 之前', 'host 一定要先裝好作業系統');
  },
]);

scene('hv-pros', 'Hypervisor 的優缺點', CAM, [
  async (tok, S) => {                                   // 100 優點一：快
    S.hw = bx('server', MC.hw, -3.4, 0.4, 0, 5.0, 0.7, 1.2); S.hv = bx('hypervisor', MC.vmm, -3.4, 1.15, 0, 5.0, 0.6, 1.1);
    S.g = [];
    for (let i = 0; i < 3; i++) { S.g.push(vm('VM' + (i + 1), -5.0 + i * 1.6, 1.9 + 0 * i)); await wt(tok, 250); }
    S.g.forEach(([o, a], i) => { o.scale.x = 0.65; a.scale.x = 0.8; });
    good('① quickness：VM 很快就能開好', -3.4, 3.6);
    cap('優點一：quickness', '開一台 VM 比準備一台實體 server 快很多');
  },
  async (tok, S) => {                                   // 113 優點二：效率
    good('② efficiency：一台 server 跑多台 VM，硬體不閒置', -3.4, 4.3);
    cap('優點二：efficiency', '一台 server 同時跑多台 VM，硬體用得更充分');
  },
  async (tok, S) => {                                   // 123 缺點一：要外部管理介面
    S.adm = prop('monitor', 3.4, 2.2, -1.0, 0.8, '外部管理機');
    bad('① 要另一台機器 / 介面來管理 hypervisor', 3.4, 4.6);
    cap('缺點一：需要外部的管理介面', '要控制 hypervisor，得靠另一台系統');
  },
  async (tok, S) => {                                   // 135 缺點二：較不安全（依賴 host OS）
    S.os = bx('host OS', MC.host, 3.4, 0.4, 1.2, 4.4, 0.6, 1.0);
    bad('② 依賴 host OS → host 有漏洞，VM 也跟著曝險', 3.4, 5.3);
    cap('缺點二：比較不安全', 'hypervisor 依賴 host OS 時，整個系統就暴露在風險中');
  },
  async (tok, S) => {                                   // 143 缺點三：host OS 壞了全倒
    tint(S.os, MC.red); bad('③ host OS 掛掉 → hypervisor 和上面的 VM 全部掛', 3.4, 6.0);
    cap('缺點三：比較不可靠', 'host OS 一掛，上面的 hypervisor 和 VM 全掛');
  },
  async (tok, S) => {                                   // 150 缺點四：資源受限
    tint(S.os, MC.host); sm('④ 要跟 host OS 分 CPU、storage → 拿不到全部資源', 3.4, -0.4, 1.6);
    cap('缺點四：資源受限', '要跟 host OS 共用 CPU、storage，拿不到完全控制');
  },
  async (tok, S) => {                                   // 164 缺點五：不是給個人電腦用（影片說法）
    sm('⑤ 影片說：hypervisor 不是設計給個人桌機跑 VM', 3.4, -1.0, 1.6);
    cap('缺點五（影片的說法）', '不是設計來在個人桌機上跑 VM');
  },
  async (tok, S) => {                                   // 171 也有不需要 hypervisor 的工具；結論
    note('也有不需要 hypervisor 的虛擬化工具（例如 container）', 0, 6.8);
    cap('也有一些不需要 hypervisor 的虛擬化工具', '結論：介紹了 hypervisor 和它的分類');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '作業系統・第 11 章',
    title: '虛擬化與安全',
    color: 'var(--os)',
    modes: [
      { id: 'vmm', name: 'Type 1 / Type 2', enter: () => { clearLog(); enterVmm(); } },
      { id: 'trap', name: 'Trap-and-emulate', enter: () => { clearLog(); enterTrap(); } },
      { id: 'rings', name: 'Protection rings', enter: () => { clearLog(); enterRings(); } },
      { id: 'matrix', name: 'Access matrix', enter: () => { clearLog(); enterMatrix(); } },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: ['vm-idea', 'type1', 'type2', 'trap-emulate', 'binary-translation', 'prot-rings', 'access-matrix', 'acl-vs-cap', 'threat-program', 'buffer-overflow', 'threat-network'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); busy = false; },
  };
}
