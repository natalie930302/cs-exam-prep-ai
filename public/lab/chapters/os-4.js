// 作業系統 第4章：CPU 排程（FCFS、SJF/SRTF、Priority + aging、RR、MLQ/MLFQ、多處理器、Real-time）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自清大周志遠 16C/17A/17B/18A 講（與恐龍書相同的例子）；16D 講尚未轉錄的部分以恐龍書例題補上。
export default function (ctx) {
  const { THREE, lab, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  const stopTimer = () => { clearInterval(timer); timer = null; };

  // ───────────────────────── 共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#6a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  const PCOL = ['#4b9ee2', '#dd8238', '#2fc092', '#9b7ef4', '#e55a9b', '#31aab0', '#c08a1f', '#5c7a4a', '#d64545', '#6a7fd0'];
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
  function code(lines, x, yTop, dy = 0.5, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return {
      ls,
      hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); },
      set(i, s) { if (ls[i]) txt(ls[i], s.padEnd(w, ' ')); },
    };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  function bar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = v / 2; }); }
  function setBar(m, h) { const v = Math.max(0.001, h); m.scale.y = v; m.position.y = v / 2; }
  function line(x1, y1, z1, x2, y2, z2, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z1), V3(x2, y2, z2)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  const fmt = (v) => String(Math.round(v * 100) / 100);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(a.length, 1);

  // ───────────────────────── 排程模擬核心 ─────────────────────────
  // procs: [{ id, arr, burst, pri }]；時間以整數單位一格一格模擬。
  // algo: FCFS / SJF（non-preemptive）/ SRTF / PRI（non-preemptive）/ PPRI（preemptive）/ RR
  // o.q：RR 的 time quantum；o.aging：在 ready queue 每等 o.aging 單位，priority 數字減 1（恐龍書：數字越小越優先）
  const ALGO_NAME = { FCFS: 'FCFS', SJF: 'SJF（non-preemptive）', SRTF: 'SRTF（preemptive SJF）', PRI: 'Priority（non-preemptive）', PPRI: 'Priority（preemptive）', RR: 'Round-Robin' };
  function simulate(procs, algo, o = {}) {
    const P = procs.map((p, i) => ({ ...p, i, rem: p.burst, pr: p.pri || 0, age: 0, first: -1, ct: -1 }));
    const n = P.length; const ready = []; const frames = []; const raw = [];
    let t = 0, done = 0, cur = null, slice = 0;
    const key = (p) => algo === 'SJF' ? p.burst : algo === 'SRTF' ? p.rem : (algo === 'PRI' || algo === 'PPRI') ? p.pr : 0;
    const cmp = (a, b) => key(a) - key(b) || a.arr - b.arr || a.i - b.i;
    const q = Math.max(1, o.q || 4);
    while (done < n && t < 1000) {
      P.forEach((p) => { if (p.arr === t) ready.push(p); });
      if (algo === 'RR' && cur && slice >= q) { ready.push(cur); cur = null; }
      if (algo === 'SRTF' || algo === 'PPRI') {
        if (cur) {
          const best = [...ready].sort(cmp)[0];
          if (best && key(best) < key(cur)) { ready.push(cur); cur = null; }
        }
      }
      if (!cur && ready.length) {
        if (algo === 'FCFS' || algo === 'RR') cur = ready.shift();
        else { const best = [...ready].sort(cmp)[0]; ready.splice(ready.indexOf(best), 1); cur = best; }
        slice = 0;
      }
      frames.push({ run: cur ? cur.id : null, ready: ready.map((p) => p.id), pr: Object.fromEntries(P.map((p) => [p.id, p.pr])), rem: Object.fromEntries(P.map((p) => [p.id, p.rem])) });
      raw.push(cur ? cur.id : null);
      if (cur) { if (cur.first < 0) cur.first = t; cur.rem--; slice++; }
      ready.forEach((p) => { p.age++; if (o.aging && p.age >= o.aging) { p.pr = Math.max(0, p.pr - 1); p.age = 0; } });
      t++;
      if (cur && cur.rem === 0) { cur.ct = t; done++; cur = null; slice = 0; }
    }
    const segs = [];
    raw.forEach((id, k) => { const L = segs[segs.length - 1]; if (L && L.id === id) L.e = k + 1; else segs.push({ id, s: k, e: k + 1 }); });
    const stat = {};
    P.forEach((p) => { stat[p.id] = { ct: p.ct, tat: p.ct - p.arr, wt: p.ct - p.arr - p.burst, rt: p.first - p.arr }; });
    const busy = segs.filter((s) => s.id !== null);
    let switches = 0; for (let k = 1; k < busy.length; k++) if (busy[k].id !== busy[k - 1].id) switches++;
    return { segs, frames, stat, T: t, switches,
      avgWT: avg(P.map((p) => stat[p.id].wt)), avgTAT: avg(P.map((p) => stat[p.id].tat)), avgRT: avg(P.map((p) => stat[p.id].rt)) };
  }
  // Multilevel feedback queue：Q0 RR q=8、Q1 RR q=16、Q2 FCFS（恐龍書與 17A 講的例子）
  function simMLFQ(procs, qs = [8, 16, Infinity]) {
    const P = procs.map((p, i) => ({ ...p, i, rem: p.burst, lv: 0, first: -1, ct: -1 }));
    const Q = [[], [], []]; const frames = []; const raw = []; const events = [];
    let t = 0, done = 0, cur = null, slice = 0;
    while (done < P.length && t < 1000) {
      P.forEach((p) => { if (p.arr === t) { Q[0].push(p); events.push({ t, txt: p.id + ' 到達 → 進 Q0' }); } });
      if (cur && slice >= qs[cur.lv]) { const from = cur.lv; cur.lv = Math.min(2, cur.lv + 1); Q[cur.lv].push(cur); events.push({ t, txt: cur.id + ' 用完 Q' + from + ' 的 quantum ' + qs[from] + ' → 降到 Q' + cur.lv }); cur = null; }
      if (cur && Q.slice(0, cur.lv).some((q) => q.length)) { Q[cur.lv].unshift(cur); events.push({ t, txt: '上層有人到 → ' + cur.id + ' 被搶佔，留在 Q' + cur.lv + ' 最前面' }); cur = null; }
      if (!cur) { const lv = Q.findIndex((q) => q.length); if (lv >= 0) { cur = Q[lv].shift(); slice = 0; } }
      frames.push({ run: cur ? cur.id : null, lv: cur ? cur.lv : -1, queues: Q.map((q) => q.map((p) => p.id)) });
      raw.push(cur ? cur.id : null);
      if (cur) { if (cur.first < 0) cur.first = t; cur.rem--; slice++; }
      t++;
      if (cur && cur.rem === 0) { cur.ct = t; done++; events.push({ t, txt: cur.id + ' 做完（在 Q' + cur.lv + '）' }); cur = null; slice = 0; }
    }
    const segs = [];
    raw.forEach((id, k) => { const L = segs[segs.length - 1]; if (L && L.id === id) L.e = k + 1; else segs.push({ id, s: k, e: k + 1 }); });
    const stat = {}; P.forEach((p) => { stat[p.id] = { ct: p.ct, tat: p.ct - p.arr, wt: p.ct - p.arr - p.burst, rt: p.first - p.arr }; });
    return { segs, frames, stat, T: t, events };
  }
  // 週期性 real-time task（單位 0.1）：algo RM（period 越短越優先，static）或 EDF（deadline 越近越優先，dynamic）
  function simRT(tasks, algo, H) {
    const TK = tasks.map((k, i) => ({ id: k.id || 'T' + (i + 1), i, P: Math.round(k.p * 10), E: Math.round(k.e * 10) }));
    const horizon = Math.round(H * 10); const jobs = []; const raw = []; const misses = []; let cur = null;
    for (let t = 0; t < horizon; t++) {
      TK.forEach((k) => { if (t % k.P === 0) jobs.push({ k, rel: t, dl: t + k.P, rem: k.E }); });
      for (const j of [...jobs]) if (j.rem > 0 && t >= j.dl) { misses.push({ id: j.k.id, t: j.dl }); jobs.splice(jobs.indexOf(j), 1); if (cur === j) cur = null; }
      const live = jobs.filter((j) => j.rem > 0);
      const key = (j) => algo === 'RM' ? j.k.P : j.dl;
      live.sort((a, b) => key(a) - key(b) || (a === cur ? -1 : b === cur ? 1 : 0) || a.k.i - b.k.i);
      cur = live[0] || null;
      raw.push(cur ? cur.k.id : null);
      if (cur) { cur.rem--; if (cur.rem === 0) { jobs.splice(jobs.indexOf(cur), 1); cur = null; } }
    }
    const segs = [];
    raw.forEach((id, k) => { const L = segs[segs.length - 1]; if (L && L.id === id) L.e = k + 1; else segs.push({ id, s: k, e: k + 1 }); });
    return { segs, misses, T: horizon, tasks: TK };
  }

  // ───────────────────────── 3D 的 Gantt chart ─────────────────────────
  function gantt(segs, T, opt = {}) {
    const W = opt.w || 12, x0 = opt.x0 === undefined ? -W / 2 : opt.x0, y = opt.y === undefined ? 0.3 : opt.y, z = opt.z === undefined ? 1.6 : opt.z;
    const h = opt.h || 0.6, d = opt.d || 0.9, unit = opt.unit || 1, col = opt.color || (() => '#4b9ee2');
    const sx = W / Math.max(T, 1);
    const ms = [];
    const bnds = [...new Set(segs.flatMap((s) => [s.s, s.e]))].sort((a, b) => a - b);
    const every = Math.max(1, Math.ceil(bnds.length / (opt.maxTicks || 20)));
    const shown = new Set(bnds.filter((b, k) => k % every === 0 || k === bnds.length - 1));
    const ticks = new Set();
    function tickAt(b) { if (opt.noTicks || ticks.has(b) || !shown.has(b)) return; ticks.add(b); tag(fmt(b * unit), 'idx', x0 + b * sx, y - 0.25, z + d / 2 + 0.3); }
    let cursor = null, cl = null;
    if (!opt.noCursor) {
      cursor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
      cursor.position.set(x0, y + 0.4, z - d / 2 - 0.05); lab.world.add(cursor);
      cl = tag('', 'idx', x0, y + 1.25, z - d / 2);
    }
    if (opt.title) tag(opt.title, 'ptr', x0 - 0.2, y + 0.2, z - d / 2 - 0.55);
    tickAt(0);
    function render(t) {
      segs.forEach((sg, k) => {
        if (sg.s >= t || (sg.id === null && opt.skipIdle)) return;
        const e = Math.min(sg.e, t), w = Math.max(0.001, (e - sg.s) * sx);
        if (!ms[k]) { ms[k] = lab.box(sg.id === null ? GRAY : col(sg.id), [1, h, d]); lab.world.add(ms[k]); }
        const m = ms[k];
        m.scale.x = w; m.position.set(x0 + sg.s * sx + w / 2, y, z);
        if (!m.userData.lbl && !opt.noLabels && sg.id !== null && w > 0.42) { m.userData.lbl = lab.label(String(sg.id), 'val'); m.add(m.userData.lbl); }
        if (e === sg.e) { tickAt(sg.s); tickAt(sg.e); }
      });
      if (cursor) { cursor.position.x = x0 + t * sx; cl.position.x = x0 + t * sx; txt(cl, 't = ' + fmt(t * unit)); }
    }
    return { render, sx, x0, z, y, xAt: (t) => x0 + t * sx, meshes: ms };
  }

  // ───────────────────────── 排程畫面（表格 + ready queue + CPU + Gantt） ─────────────────────────
  function tableLines(procs, res, done, opt = {}) {
    const pad = (s, n) => String(s).padStart(n);
    const head = 'P    Arr Burst' + (opt.pri ? ' Pri' : '') + '    CT  TAT   WT   RT';
    return [head].concat(procs.map((p) => {
      const s = res.stat[p.id], f = done && done.has(p.id);
      return pad(p.id, 3) + pad(p.arr, 5) + pad(p.burst, 6) + (opt.pri ? pad(p.pri, 4) : '') + (f ? pad(s.ct, 6) + pad(s.tat, 5) + pad(s.wt, 5) + pad(s.rt, 5) : '     ·    ·    ·    ·');
    }));
  }
  function makeView(procs, res, opt = {}) {
    const colors = {}; procs.forEach((p, i) => { colors[p.id] = PCOL[i % PCOL.length]; });
    const G = gantt(res.segs, res.T, { color: (id) => colors[id], z: 1.7, title: opt.ganttTitle || 'Gantt chart' });
    const tb = opt.noTable ? null : code(tableLines(procs, res, new Set(), opt), 0, 5.4, 0.46, -3.6);
    tag('Ready queue →', 'ptr', -4.6, 0.1, -2.3);
    ctx.tile(V3(5.3, 0.04, -1.3), 1.6, 1.4, '#c9b48e');
    tag('CPU', 'ptr alt', 5.3, 0.1, -0.3);
    const tok = {}; const done = new Set();
    const V = {
      G, colors, done,
      frame(t) {
        G.render(t);
        const f = res.frames[t];
        procs.forEach((p) => {
          if (p.arr > t || done.has(p.id)) return;
          const st = res.stat[p.id];
          if (st.ct <= t) {
            done.add(p.id);
            if (tok[p.id]) { fly(tok[p.id], V3(2, 7, -3)); tok[p.id] = null; }
            if (tb) tableLines(procs, res, done, opt).forEach((ln, k) => tb.set(k, ln));
            if (opt.onDone) opt.onDone(p, st);
            return;
          }
          if (!tok[p.id]) tok[p.id] = cube(p.id, colors[p.id], [0.8, 0.6, 0.8], -5.3, 0.3, -1.3, 3);
          const m = tok[p.id];
          if (f && f.run === p.id) { move(m, 5.3, 0.45, -1.3); glow(m, GOLD); }
          else if (f) { const k = f.ready.indexOf(p.id); move(m, -5.3 + Math.max(k, 0) * 0.95, 0.3, -1.3); glow(m, null); }
          if (opt.showPri && f) relabel(m, p.id + '·' + f.pr[p.id]);
          if (opt.showRem && f) relabel(m, p.id + '·' + f.rem[p.id]);
        });
      },
    };
    return V;
  }
  async function playSched(tok, procs, res, o = {}) {
    const V = makeView(procs, res, o);
    for (let t = 0; t <= res.T; t++) {
      V.frame(t);
      if (o.at && o.at[t]) say(o.at[t][0], o.at[t][1]);
      if (o.onT) o.onT(t, V);
      await beat(tok, (o.slow && o.slow[t]) || o.ms || 320);
    }
    return V;
  }
  function parseTable(s) {
    const out = [];
    String(s).split(/[;\n,]+/).map((x) => x.trim()).filter(Boolean).forEach((row, i) => {
      const f = row.split(/\s+/);
      let id = f[0], nums = f.slice(1);
      if (/^\d/.test(id)) { id = 'P' + (i + 1); nums = f; }
      const [arr, burst, pri] = nums.map(Number);
      if (!(burst > 0) || !(arr >= 0) || !Number.isInteger(arr) || !Number.isInteger(burst)) return;
      out.push({ id: id.slice(0, 4), arr, burst: Math.min(burst, 99), pri: Number.isFinite(pri) ? pri : 0 });
    });
    return out.slice(0, 8);
  }
  const tableText = (procs) => procs.map((p) => p.id + ' ' + p.arr + ' ' + p.burst + ' ' + p.pri).join('; ');

  // 課堂／課本的例子
  const EX = {
    sjf: { name: '17A：P1 7、P2 4、P3 1、P4 4（到達 0,2,4,5）', procs: [{ id: 'P1', arr: 0, burst: 7, pri: 3 }, { id: 'P2', arr: 2, burst: 4, pri: 1 }, { id: 'P3', arr: 4, burst: 1, pri: 4 }, { id: 'P4', arr: 5, burst: 4, pri: 2 }] },
    fcfs: { name: '恐龍書：24、3、3（convoy effect）', procs: [{ id: 'P1', arr: 0, burst: 24, pri: 1 }, { id: 'P2', arr: 0, burst: 3, pri: 2 }, { id: 'P3', arr: 0, burst: 3, pri: 3 }] },
    rr20: { name: '17A：RR q=20：53、17、68、24', procs: [{ id: 'P1', arr: 0, burst: 53, pri: 3 }, { id: 'P2', arr: 0, burst: 17, pri: 1 }, { id: 'P3', arr: 0, burst: 68, pri: 4 }, { id: 'P4', arr: 0, burst: 24, pri: 2 }], q: 20 },
    pri: { name: '恐龍書 Priority：10、1、2、1、5', procs: [{ id: 'P1', arr: 0, burst: 10, pri: 3 }, { id: 'P2', arr: 0, burst: 1, pri: 1 }, { id: 'P3', arr: 0, burst: 2, pri: 4 }, { id: 'P4', arr: 0, burst: 1, pri: 5 }, { id: 'P5', arr: 0, burst: 5, pri: 2 }] },
    starve: { name: '飢餓：低優先 PL 一直被插隊', procs: [{ id: 'P1', arr: 0, burst: 3, pri: 1 }, { id: 'PL', arr: 0, burst: 4, pri: 9 }, { id: 'P2', arr: 3, burst: 3, pri: 1 }, { id: 'P3', arr: 6, burst: 3, pri: 1 }, { id: 'P4', arr: 9, burst: 3, pri: 1 }, { id: 'P5', arr: 12, burst: 3, pri: 1 }, { id: 'P6', arr: 15, burst: 3, pri: 1 }, { id: 'P7', arr: 18, burst: 3, pri: 1 }] },
  };

  // ───────────────────────── 模式 1：排程模擬器 ─────────────────────────
  const sim = { algo: 'SJF', q: 4, aging: 0, procs: EX.sjf.procs.map((p) => ({ ...p })), t: 0, res: null, V: null };
  function enterSim() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7, 12.5], [0, 1.4, 0]);
    controls('<select id="sAlgo">' + Object.keys(ALGO_NAME).map((k) => '<option value="' + k + '">' + ALGO_NAME[k] + '</option>').join('') + '</select>'
      + '<label>q = <input id="sQ" type="number" min="1" max="50" value="' + sim.q + '" style="width:52px"></label>'
      + '<label>aging 每 <input id="sAge" type="number" min="0" max="20" value="' + sim.aging + '" style="width:46px"> 單位</label>'
      + '<select id="sEx"><option value="">載入例子…</option>' + Object.keys(EX).map((k) => '<option value="' + k + '">' + EX[k].name + '</option>').join('') + '</select><br>'
      + '<input id="sTab" style="width:330px" value="' + tableText(sim.procs) + '" title="名稱 到達 burst priority，用 ; 分隔">'
      + '<button id="sLoad">套用表格</button><button class="primary" id="sPlay">播放</button><button id="sStep">下一單位</button><button id="sReset">重設</button>');
    $('sAlgo').value = sim.algo;
    $('sAlgo').onchange = (e) => { sim.algo = e.target.value; clearLog(); enterSim(); };
    $('sQ').onchange = (e) => { sim.q = Math.max(1, Math.min(50, Number(e.target.value) || 4)); clearLog(); enterSim(); };
    $('sAge').onchange = (e) => { sim.aging = Math.max(0, Math.min(20, Number(e.target.value) || 0)); clearLog(); enterSim(); };
    $('sEx').onchange = (e) => { const x = EX[e.target.value]; if (!x) return; sim.procs = x.procs.map((p) => ({ ...p })); if (x.q) { sim.q = x.q; sim.algo = 'RR'; } clearLog(); enterSim(); };
    on('sLoad', () => {
      const ps = parseTable($('sTab').value);
      if (!ps.length) { log('看不懂這個表格：每列寫「名稱 到達 burst priority」，例如 P1 0 7 3; P2 2 4 1（到達、burst 要是整數）。', true); return; }
      if (new Set(ps.map((p) => p.id)).size !== ps.length) { log('process 名稱重複了，每個名稱要不同。', true); return; }
      sim.procs = ps; clearLog(); enterSim();
    });
    on('sPlay', () => { stopTimer(); timer = setInterval(() => { if (!simStep()) stopTimer(); }, sim.res.T > 60 ? 70 : 260); });
    on('sStep', () => { stopTimer(); simStep(); });
    on('sReset', () => { clearLog(); enterSim(); });
    sim.res = simulate(sim.procs, sim.algo, { q: sim.q, aging: sim.aging });
    sim.V = makeView(sim.procs, sim.res, { pri: true, showPri: sim.algo === 'PRI' || sim.algo === 'PPRI', showRem: sim.algo === 'SRTF',
      onDone: (p, st) => log(p.id + ' 在 t = ' + st.ct + ' 完成：TAT = ' + st.ct + ' − ' + p.arr + ' = ' + st.tat + '，WT = ' + st.tat + ' − ' + p.burst + ' = ' + st.wt + '，RT = ' + st.rt) });
    sim.t = 0; sim.V.frame(0);
    log(ALGO_NAME[sim.algo] + (sim.algo === 'RR' ? '，q = ' + sim.q : '') + (sim.aging && sim.algo.includes('PRI') ? '，aging：每等 ' + sim.aging + ' 單位 priority 數字 −1' : '') + '。按「下一單位」一格一格走。');
    if (sim.aging && !sim.algo.includes('PRI')) log('aging 只對 Priority 排程有意義，這個演算法不看 priority。', true);
    simState();
  }
  function simStep() {
    if (sim.t >= sim.res.T) { log('全部做完了。按「重設」重新播放，或換演算法比較平均等待時間。', true); return false; }
    const f = sim.res.frames[sim.t];
    const prev = sim.t > 0 ? sim.res.frames[sim.t - 1].run : null;
    if (f.run !== prev) log('t = ' + sim.t + '：' + (f.run ? f.run + ' 上 CPU' + (prev && sim.res.stat[prev].ct > sim.t ? '（' + prev + ' 被搶佔）' : '') : 'CPU 閒置（ready queue 空）') + (f.ready.length ? '，ready：' + f.ready.join(' ') : ''));
    sim.t++; sim.V.frame(sim.t); simState();
    return true;
  }
  function simState() {
    const r = sim.res, fin = sim.t >= r.T;
    setState(ALGO_NAME[sim.algo] + (sim.algo === 'RR' ? ' q=' + sim.q : '') + '　t = ' + sim.t,
      sim.procs.map((p) => [p.id + '（到 ' + p.arr + '，burst ' + p.burst + (sim.algo.includes('PRI') ? '，pri ' + p.pri : '') + '）', sim.V.done.has(p.id) ? 'WT ' + r.stat[p.id].wt + '・TAT ' + r.stat[p.id].tat + '・RT ' + r.stat[p.id].rt : '…']),
      fin ? '平均 WT = <span class="ok">' + fmt(r.avgWT) + '</span>，平均 TAT = ' + fmt(r.avgTAT) + '，平均 RT = ' + fmt(r.avgRT) + '<br>context switch ' + r.switches + ' 次' : 'TAT = 完成 − 到達；WT = TAT − burst；RT = 第一次上 CPU − 到達');
  }

  // ───────────────────────── 模式 2：演算法比較 ─────────────────────────
  function enterCompare() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6.5, 13.5], [0, 2.2, 0]);
    controls('<input id="cTab" style="width:330px" value="' + tableText(sim.procs) + '"><label>RR q = <input id="cQ" type="number" min="1" max="50" value="' + sim.q + '" style="width:52px"></label><button class="primary" id="cRun">比較</button>');
    on('cRun', () => {
      const ps = parseTable($('cTab').value);
      if (!ps.length) { log('表格格式：名稱 到達 burst priority；例如 P1 0 7 3; P2 2 4 1', true); return; }
      sim.procs = ps; sim.q = Math.max(1, Number($('cQ').value) || 4); drawCompare();
    });
    log('同一張 process 表，六種排程的平均 WT／TAT／RT 一起比。');
    drawCompare();
  }
  function drawCompare() {
    lab.clear();
    const algos = Object.keys(ALGO_NAME);
    const rs = algos.map((a) => simulate(sim.procs, a, { q: sim.q }));
    const mx = Math.max(1, ...rs.flatMap((r) => [r.avgWT, r.avgTAT, r.avgRT]));
    const MET = [['avgWT', '#4b9ee2', 'WT'], ['avgTAT', '#9b7ef4', 'TAT'], ['avgRT', '#2fc092', 'RT']];
    algos.forEach((a, i) => {
      const x = -5.6 + i * 2.25;
      MET.forEach(([k, c], j) => {
        const b = bar(c, 0.55, 0.8, x - 0.6 + j * 0.6, 0); setBar(b, rs[i][k] / mx * 5.5);
        tag(fmt(rs[i][k]), 'idx', x - 0.6 + j * 0.6, rs[i][k] / mx * 5.5 + 0.35, 0);
      });
      tag(a === 'RR' ? 'RR q=' + sim.q : a, 'ptr', x, 0, 1.2);
    });
    tag('藍 = 平均 WT　紫 = 平均 TAT　綠 = 平均 RT', 'idx', 0, 6.6, 0);
    const best = algos[rs.map((r) => r.avgWT).indexOf(Math.min(...rs.map((r) => r.avgWT)))];
    setState('平均時間比較（' + sim.procs.length + ' 個 process）', algos.map((a, i) => [a === 'RR' ? 'RR q=' + sim.q : a, 'WT ' + fmt(rs[i].avgWT) + '・TAT ' + fmt(rs[i].avgTAT) + '・RT ' + fmt(rs[i].avgRT)]),
      '平均 WT 最小：<span class="ok">' + best + '</span>（SRTF/SJF 理論上 average waiting time 最小）<br>RR 的 response time 通常最好');
    log('平均 WT 最小的是 ' + best + '。');
  }

  // ───────────────────────── 模式 3：RR 的 time quantum ─────────────────────────
  const rq = { q: 4, procs: EX.fcfs.procs };
  function enterRRQ() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 6, 12.5], [0, 1.6, 0]);
    controls('<label>time quantum q = <input id="qS" type="range" min="1" max="30" value="' + rq.q + '" style="width:200px"></label> <b id="qV">' + rq.q + '</b>'
      + '<select id="qEx"><option value="fcfs">24、3、3</option><option value="rr20">53、17、68、24</option><option value="sjf">7、4、1、4</option></select>');
    $('qS').oninput = (e) => { rq.q = Number(e.target.value); $('qV').textContent = rq.q; drawRRQ(); };
    $('qEx').onchange = (e) => { rq.procs = EX[e.target.value].procs; $('qS').max = e.target.value === 'rr20' ? 80 : 30; drawRRQ(); };
    log('拖動 q：q 很大 → 就是 FCFS；q 很小 → 很公平，但 context switch 次數暴增。');
    drawRRQ();
  }
  function drawRRQ() {
    lab.clear();
    const r = simulate(rq.procs, 'RR', { q: rq.q }), f = simulate(rq.procs, 'FCFS');
    const colors = {}; rq.procs.forEach((p, i) => { colors[p.id] = PCOL[i]; });
    const G = gantt(r.segs, r.T, { color: (id) => colors[id], z: 0.6, title: 'RR q = ' + rq.q, maxTicks: 16 }); G.render(r.T);
    const G2 = gantt(f.segs, f.T, { color: (id) => colors[id], z: -2.2, title: 'FCFS（對照）', noCursor: true, maxTicks: 10 }); G2.render(f.T);
    const sw = cube(r.switches, '#d64545', [0.9, 0.9, 0.9], 5.6, 0.45, 3.4); tag('context switch', 'idx', 5.6, 0, 4.3);
    sw.scale.y = Math.min(4, 0.3 + r.switches / 6); sw.position.y = sw.scale.y * 0.45;
    const same = r.segs.length === f.segs.length && r.segs.every((s, k) => s.id === f.segs[k].id);
    setState('RR，q = ' + rq.q, [['context switch', String(r.switches)], ['平均 TAT', fmt(r.avgTAT)], ['平均 WT', fmt(r.avgWT)], ['平均 RT', fmt(r.avgRT)]],
      same ? '<span class="ok">q 大於所有 burst → 跟 FCFS 一模一樣</span>' : 'q 越小越公平、response 越快，但切換越多；恐龍書建議約 80% 的 CPU burst 短於 q');
  }

  // ───────────────────────── 模式 4：MLFQ ─────────────────────────
  const mf = { procs: [{ id: 'P1', arr: 0, burst: 30 }, { id: 'P2', arr: 1, burst: 6 }, { id: 'P3', arr: 2, burst: 14 }, { id: 'P4', arr: 20, burst: 3 }], t: 0, res: null };
  const LANE_Z = [-3.2, -2.1, -1.0];
  function mlfqStage(procs, res) {
    const colors = {}; procs.forEach((p, i) => { colors[p.id] = PCOL[i % PCOL.length]; });
    ['Q0　RR q = 8', 'Q1　RR q = 16', 'Q2　FCFS'].forEach((s, k) => { tag(s, k ? 'ptr' : 'ptr alt', -5.6, 0.2, LANE_Z[k]); ctx.tile(V3(-1.2, 0.03, LANE_Z[k]), 6.4, 0.9, k === 0 ? '#e9dcc4' : k === 1 ? '#e3d3b6' : '#dccaa8'); });
    ctx.tile(V3(5.2, 0.04, -2.1), 1.6, 1.4, '#c9b48e'); tag('CPU', 'ptr alt', 5.2, 0.1, -1.1);
    const G = gantt(res.segs, res.T, { color: (id) => colors[id], z: 1.6, maxTicks: 14 });
    const tok = {}; const done = new Set();
    return {
      G, done,
      frame(t) {
        G.render(t);
        const f = res.frames[t];
        procs.forEach((p) => {
          if (p.arr > t || done.has(p.id)) return;
          if (res.stat[p.id].ct <= t) { done.add(p.id); if (tok[p.id]) { fly(tok[p.id], V3(2, 7, -3)); tok[p.id] = null; } return; }
          if (!tok[p.id]) tok[p.id] = cube(p.id, colors[p.id], [0.75, 0.55, 0.75], -3.6, 0.3, LANE_Z[0], 3);
          if (!f) return;
          const m = tok[p.id];
          if (f.run === p.id) { move(m, 5.2, 0.45, -2.1); glow(m, GOLD); return; }
          glow(m, null);
          f.queues.forEach((q, lv) => { const k = q.indexOf(p.id); if (k >= 0) move(m, -3.6 + k * 0.9, 0.3, LANE_Z[lv]); });
        });
      },
    };
  }
  function enterMLFQ() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7, 12], [0, 0.8, -0.6]);
    controls('<label>新 process：到達 <input id="mA" type="number" min="0" max="60" value="5" style="width:46px"> burst <input id="mB" type="number" min="1" max="40" value="5" style="width:46px"></label><button id="mAdd">加入</button>'
      + '<button class="primary" id="mPlay">播放</button><button id="mStep">下一單位</button><button id="mReset">重設成課堂例子</button>');
    on('mAdd', () => {
      const a = Number($('mA').value), b = Number($('mB').value);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 1) { log('到達時間與 burst 要是整數，burst ≥ 1。', true); return; }
      if (mf.procs.length >= 7) { log('最多 7 個 process，畫面才放得下。', true); return; }
      mf.procs = [...mf.procs, { id: 'P' + (mf.procs.length + 1), arr: a, burst: b }]; clearLog(); enterMLFQ();
    });
    on('mPlay', () => { stopTimer(); timer = setInterval(() => { if (!mlfqStep()) stopTimer(); }, 150); });
    on('mStep', () => { stopTimer(); mlfqStep(); });
    on('mReset', () => { mf.procs = [{ id: 'P1', arr: 0, burst: 30 }, { id: 'P2', arr: 1, burst: 6 }, { id: 'P3', arr: 2, burst: 14 }, { id: 'P4', arr: 20, burst: 3 }]; clearLog(); enterMLFQ(); });
    mf.res = simMLFQ(mf.procs); mf.S = mlfqStage(mf.procs, mf.res); mf.t = 0; mf.S.frame(0);
    log('新 process 一律先進 Q0；用完整個 quantum 就降一級；上層有工作，下層就不能跑。');
    mlfqState();
  }
  function mlfqStep() {
    if (mf.t >= mf.res.T) { log('全部做完了。', true); return false; }
    mf.res.events.filter((e) => e.t === mf.t).forEach((e) => log('t = ' + e.t + '：' + e.txt));
    mf.t++; mf.S.frame(mf.t);
    mf.res.events.filter((e) => e.t === mf.t && mf.t === mf.res.T).forEach((e) => log('t = ' + e.t + '：' + e.txt));
    mlfqState(); return true;
  }
  function mlfqState() {
    const f = mf.res.frames[Math.min(mf.t, mf.res.T - 1)];
    setState('MLFQ　t = ' + mf.t, mf.procs.map((p) => [p.id + '（到 ' + p.arr + '，burst ' + p.burst + '）', mf.S.done.has(p.id) ? '完成 ' + mf.res.stat[p.id].ct + '，WT ' + mf.res.stat[p.id].wt : f.queues.findIndex((q) => q.includes(p.id)) >= 0 ? '在 Q' + f.queues.findIndex((q) => q.includes(p.id)) : f.run === p.id ? '執行中（Q' + f.lv + '）' : '未到']),
      '短 burst（I/O-bound）留在上層 → 自動逼近 SJF；長的 CPU-bound 沉到 Q2');
  }

  // ───────────────────────── 模式 5：Real-time ─────────────────────────
  const rt = { algo: 'RM', tasks: [{ p: 4, e: 1 }, { p: 5, e: 2 }, { p: 20, e: 5 }], H: 20 };
  function rtStage(res, opt = {}) {
    const TC = ['#d64545', '#dd8238', '#2fc092', '#4b9ee2', '#9b7ef4'];
    const col = {}; res.tasks.forEach((k, i) => { col[k.id] = TC[i % TC.length]; });
    const G = gantt(res.segs, res.T, { color: (id) => col[id], unit: 0.1, z: 1.8, title: 'CPU', maxTicks: 18 });
    const lanes = res.tasks.map((k, i) => {
      const z = -0.4 - i * 1.0;
      tag(k.id + '（p=' + k.P / 10 + ', e=' + k.E / 10 + '）', 'ptr', -5.9, 0.15, z - 0.4);
      for (let r = 0; r < res.T; r += k.P) { const pin = lab.box('#c08a1f', [0.06, 0.7, 0.06]); pin.position.set(G.xAt(r), 0.35, z - 0.35); lab.world.add(pin); }
      return gantt(res.segs.filter((s) => s.id === k.id), res.T, { color: () => col[k.id], z, h: 0.35, d: 0.5, noTicks: true, noCursor: true, noLabels: true, unit: 0.1 });
    });
    return { G, lanes, render(t) { G.render(t); lanes.forEach((L) => L.render(t)); res.misses.filter((m) => m.t <= t && !m.shown).forEach((m) => { m.shown = true; tag('✗ ' + m.id + ' miss', 'ptr', G.xAt(m.t), 1.2, 0.4); }); } };
  }
  function enterRT() {
    stopTimer(); lab.clear();
    lab.frameCamera([0, 7.5, 11.5], [0, 0.4, -0.4]);
    controls('<select id="rA"><option value="RM">Rate-Monotonic（static）</option><option value="EDF">EDF（dynamic）</option></select>'
      + '<input id="rT" style="width:200px" value="' + rt.tasks.map((k) => k.p + ' ' + k.e).join('; ') + '" title="每個 task：period execution">'
      + '<label>看到 t = <input id="rH" type="number" min="5" max="40" value="' + rt.H + '" style="width:50px"></label><button class="primary" id="rRun">排程</button>'
      + '<select id="rEx"><option value="">例子…</option><option value="rm">18A：(4,1) (5,2) (20,5)</option><option value="edf">18A：(2,0.9) (5,2.3)</option><option value="miss">RM 失敗、EDF 成功：(5,2.5) (7,3)</option></select>');
    $('rA').value = rt.algo;
    $('rA').onchange = (e) => { rt.algo = e.target.value; clearLog(); enterRT(); };
    $('rEx').onchange = (e) => {
      const X = { rm: [[{ p: 4, e: 1 }, { p: 5, e: 2 }, { p: 20, e: 5 }], 20], edf: [[{ p: 2, e: 0.9 }, { p: 5, e: 2.3 }], 10], miss: [[{ p: 5, e: 2.5 }, { p: 7, e: 3 }], 35] }[e.target.value];
      if (!X) return; rt.tasks = X[0]; rt.H = X[1]; clearLog(); enterRT();
    };
    on('rRun', () => {
      const ts = $('rT').value.split(/[;,\n]+/).map((s) => s.trim().split(/\s+/).map(Number)).filter((a) => a.length >= 2 && a[0] > 0 && a[1] > 0).map(([p, e]) => ({ p, e }));
      if (!ts.length || ts.length > 5) { log('每個 task 寫「period execution」，用 ; 分隔，1～5 個。', true); return; }
      if (ts.some((k) => k.e > k.p)) { log('execution 比 period 還長，一定 miss deadline，沒有意義。', true); return; }
      rt.tasks = ts; rt.H = Math.max(5, Math.min(40, Number($('rH').value) || 20)); clearLog(); enterRT();
    });
    const res = simRT(rt.tasks, rt.algo, rt.H);
    const S = rtStage(res); S.render(res.T);
    const U = rt.tasks.reduce((s, k) => s + k.e / k.p, 0), n = rt.tasks.length, bound = n * (Math.pow(2, 1 / n) - 1);
    log(rt.algo === 'RM' ? 'RM：priority 只看 period（越短越高），固定不變。' : 'EDF：每次都挑 absolute deadline 最近的，priority 隨時在變。');
    log(res.misses.length ? 'miss deadline：' + res.misses.map((m) => m.id + '@' + fmt(m.t / 10)).join('、') : '沒有任何 task miss deadline。', !!res.misses.length);
    setState((rt.algo === 'RM' ? 'Rate-Monotonic' : 'EDF') + '（preemptive）', rt.tasks.map((k, i) => ['T' + (i + 1), 'period ' + k.p + '、execution ' + k.e + '、U = ' + fmt(k.e / k.p)]),
      'CPU 使用率 U = ' + fmt(U) + '<br>RM 保證可排的上界 n(2^{1/n} − 1) = ' + fmt(bound) + '；EDF 只要 U ≤ 1' + (res.misses.length ? '<br><span class="no">有 ' + res.misses.length + ' 次 miss</span>' : '<br><span class="ok">全部趕上 deadline</span>'));
  }

  // ───────────────────────── 小測驗 ─────────────────────────
  let qs = { score: 0, total: 0 };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function uniq(ans, cands) { const s = [ans]; for (const c of cands) if (!s.includes(c) && s.length < 4) s.push(c); let k = 1; while (s.length < 4) { const v = String(Number(ans) + k * (k % 2 ? 1 : -1) * 0.5 + (k > 2 ? 1 : 0)); if (!s.includes(v)) s.push(v); k++; } return s; }
  function genQ() {
    const r = Math.random();
    if (r < 0.45) {
      const n = rnd(3, 4);
      const procs = Array.from({ length: n }, (_, i) => ({ id: 'P' + (i + 1), arr: i === 0 ? 0 : rnd(0, 6), burst: rnd(1, 9), pri: rnd(1, 5) }));
      const algo = pick(['FCFS', 'SJF', 'SRTF', 'RR', 'PRI']); const q = rnd(2, 4);
      const res = simulate(procs, algo, { q });
      const alt = ['FCFS', 'SJF', 'SRTF', 'RR', 'PRI'].filter((a) => a !== algo).map((a) => fmt(simulate(procs, a, { q }).avgWT));
      const ans = fmt(res.avgWT);
      return { q: ALGO_NAME[algo] + (algo === 'RR' ? '（q = ' + q + '）' : '') + (algo === 'PRI' ? '（數字小 = 優先）' : '') + '，平均 waiting time？\n' + procs.map((p) => p.id + '：到達 ' + p.arr + '，burst ' + p.burst + (algo === 'PRI' ? '，priority ' + p.pri : '')).join('\n'),
        opts: uniq(ans, [...alt, fmt(res.avgTAT)]), ans, why: 'Gantt：' + res.segs.map((s) => (s.id || 'idle') + '[' + s.s + '–' + s.e + ']').join(' ') + '；WT = 完成 − 到達 − burst，平均 = ' + ans + '。' };
    }
    if (r < 0.6) {
      const procs = Array.from({ length: 3 }, (_, i) => ({ id: 'P' + (i + 1), arr: 0, burst: rnd(3, 25), pri: 0 })); const q = rnd(3, 8);
      const res = simulate(procs, 'RR', { q }); const id = pick(procs).id;
      const ans = String(res.stat[id].ct);
      return { q: 'RR，q = ' + q + '，P1、P2、P3 都在 0 到達，burst ' + procs.map((p) => p.burst).join('、') + '。' + id + ' 何時完成？', opts: uniq(ans, [String(res.stat[id].ct - q), String(res.stat[id].tat + q), String(procs.reduce((s, p) => s + p.burst, 0))]), ans,
        why: 'Gantt：' + res.segs.map((s) => s.id + '[' + s.s + '–' + s.e + ']').join(' ') };
    }
    if (r < 0.7) {
      const a = pick([0.5, 0.25, 0.75]), tau = rnd(6, 12), t = rnd(2, 14);
      const ans = fmt(a * t + (1 - a) * tau);
      return { q: 'SJF 用 exponential averaging 預測下一個 CPU burst：α = ' + a + '，上次預測 τ = ' + tau + '，實際 burst t = ' + t + '。下一次預測 τ\' = ？', opts: uniq(ans, [fmt((1 - a) * t + a * tau), fmt((t + tau) / 2 + 1), String(t)]), ans, why: 'τ\' = α·t + (1 − α)·τ = ' + a + '×' + t + ' + ' + (1 - a) + '×' + tau + ' = ' + ans + '。' };
    }
    const C = [
      { q: 'Non-preemptive 排程只在哪些時機重新選人？', opts: ['running→waiting 與 terminate', '只有 timer interrupt', 'waiting→ready 與 running→ready', '四種時機都會'], ans: 'running→waiting 與 terminate', why: '16C：non-preemptive 只在 CPU burst 自己結束（去做 I/O 或結束）時才換人；2、3 兩種是 preemptive 才會。' },
      { q: '執行 context switch、切換到 user mode、跳到新 process PC 的是？', opts: ['dispatcher', 'scheduler', 'long-term scheduler', 'interrupt handler'], ans: 'dispatcher', why: 'scheduler 只決定「選誰」，dispatcher 負責真的換人；所花時間叫 dispatch latency。' },
      { q: 'Priority scheduling 的 starvation 用什麼解決？', opts: ['aging', '加大 time quantum', '改用 FCFS', 'processor affinity'], ans: 'aging', why: '等越久就把 priority 調高，遲早輪得到。' },
      { q: 'RR 的 time quantum 設得非常大，結果會像？', opts: ['FCFS', 'SJF', 'SRTF', 'Priority'], ans: 'FCFS', why: 'q 大過所有 CPU burst，每個人都一次做完 → 就是 FCFS。' },
      { q: 'MLFQ 與 MLQ 最大的差別是？', opts: ['process 可以在 queue 之間移動', 'MLFQ 只有一個 queue', 'MLQ 不能用 RR', 'MLFQ 不會 starvation 所以不需要 aging'], ans: 'process 可以在 queue 之間移動', why: 'feedback：依 run time 行為升降級；MLQ 的 process 永遠留在分配到的 queue。' },
      { q: '17A 的 MLFQ（Q0 RR 8、Q1 RR 16、Q2 FCFS），什麼時候會被降到下一層？', opts: ['把該層 quantum 全部用完', '做了一次 I/O', '等太久', '一進系統就降'], ans: '把該層 quantum 全部用完', why: '用完 8 ms 還沒做完 → 判定 CPU burst 長 → 往下踢；等太久則是 aging 往上提。' },
      { q: 'FCFS 中短工被一個長工卡在後面的現象叫？', opts: ['convoy effect', 'starvation', 'priority inversion', 'thrashing'], ans: 'convoy effect', why: '24、3、3 依序到：平均 WT 17；短的先做只要 3。' },
      { q: 'Rate-Monotonic 的 priority 依據？', opts: ['period 越短越高（固定）', 'deadline 越近越高（動態）', 'execution time 越短越高', '到達順序'], ans: 'period 越短越高（固定）', why: '18A：RM 是 static priority，只看 period；EDF 才看當下的 deadline。' },
      { q: 'Processor affinity 的主要好處？', opts: ['重用 cache（提高 hit rate）', '讓 load 更平均', '避免 deadlock', '減少 I/O'], ans: '重用 cache（提高 hit rate）', why: '17B/18A：L1 cache 各 core 分開；綁在同一 core 可重用 cache，代價是 load balancing 變差。' },
      { q: '18A：系統整體負載很高時，比較適合哪種 migration？', opts: ['pull（閒的 core 去拉）', 'push（忙的 core 去推）', '兩者都不做', '只用 hard affinity'], ans: 'pull（閒的 core 去拉）', why: '負載高時閒的 core 很少，讓少數閒的人發起，詢問次數最少。' },
      { q: 'SMP（symmetric）共用一個 ready queue 時要注意？', opts: ['dequeue 時要 synchronization', '需要 master CPU', '不能用 affinity', '只能 non-preemptive'], ans: 'dequeue 時要 synchronization', why: '同一個 process 不能同時被兩顆 CPU 拿走。' },
    ];
    return pick(C);
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

  // ───────────────────────── 場景：16C Basic Concepts ─────────────────────────
  async function scBurstCycle(tok) {
    fresh([0, 6, 13], [0, 1.2, 0]);
    say('記憶體裡塞很多 process，CPU core 卻有限', 'scheduler 的目的：讓 CPU 一直有指令可做');
    const ps = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id, i) => cube(id, PCOL[i], [0.8, 0.6, 0.8], -5 + i * 1.0, 0.3, -2.6, 3));
    ctx.tile(V3(4.8, 0.04, -2.6), 1.6, 1.4, '#c9b48e'); tag('CPU', 'ptr alt', 4.8, 0.1, -1.6);
    await beat(tok, 2600);
    say('一個程式 = CPU burst 與 I/O burst 輪流出現', '藍 = CPU burst（算）　橘 = I/O burst（等 I/O）');
    const seq = [[2.2, 1], [1.5, 0], [0.6, 1], [2.0, 0], [0.8, 1], [1.4, 0], [0.5, 1]];
    let x = -5.8;
    for (const [w, cpu] of seq) {
      cube('', cpu ? '#4b9ee2' : '#dd8238', [w, 0.5, 0.9], x + w / 2, 0.25, 1.4, 2.5);
      tag(cpu ? 'CPU' : 'I/O', 'idx', x + w / 2, 0.6, 2.2);
      x += w + 0.06;
      await beat(tok, 700);
    }
    say('連續的 CPU 指令合成一個 burst', 'CPU burst 之後一定接 I/O burst，反之亦然');
    await beat(tok, 2600);
    say('做 I/O 的 process 在 waiting queue', 'CPU scheduler 只管 CPU burst');
    glow(ps[1], GOLD); move(ps[1], -1, 0.3, -4.2); tag('waiting（做 I/O）', 'idx', -1, 0, -4.9);
    await beat(tok, 1600);
    move(ps[0], 4.8, 0.45, -2.6); glow(ps[0], GREEN);
    say('ready 的 process 裡挑一個上 CPU', '提高 CPU 使用率');
    await beat(tok, 2800);
  }
  async function scCpuIoBound(tok) {
    fresh([0, 6.5, 13], [0, 1.2, 0]);
    tag('CPU-bound：for (i = 1; i <= 10000; i++) i++;', 'ptr', -1, 0.2, -2.8);
    tag('I/O-bound：i++; fread(); fwrite(); …', 'ptr alt', -1, 0.2, -0.4);
    say('CPU-bound：有非常非常長的 CPU burst', '例：迴圈從 1 跑到 1 萬');
    cube('', '#4b9ee2', [8.5, 0.5, 0.8], -1.6, 0.25, -2, 3); cube('', '#dd8238', [1.2, 0.5, 0.8], 3.4, 0.25, -2, 3);
    await beat(tok, 2600);
    say('I/O-bound：一堆很短的 CPU burst，時間花在等 I/O', 'CPU 快、I/O 慢 → 效能卡在 I/O');
    let x = -5.8;
    for (let k = 0; k < 5; k++) { cube('', '#4b9ee2', [0.3, 0.5, 0.8], x + 0.15, 0.25, 0.4, 2.5); cube('', '#dd8238', [1.6, 0.5, 0.8], x + 0.38 + 0.8, 0.25, 0.4, 2.5); x += 2.0; await beat(tok, 450); }
    await beat(tok, 1600);
    say('CPU burst 長度的分佈：絕大多數都非常短', '只有少數很長（CPU-bound）');
    const H = [5, 3.6, 2.2, 1.2, 0.7, 0.45, 0.3, 0.2, 0.15, 0.1];
    for (let k = 0; k < H.length; k++) { const b = bar('#9b7ef4', 0.6, 0.6, -4 + k * 0.85, 2.8); await growBar(tok, b, H[k] * 0.55, 160); }
    tag('burst 長度（ms）→', 'idx', 0.5, 0, 3.6); tag('次數', 'idx', -4.9, 2.9, 2.8);
    await beat(tok, 1500);
    say('大部分程式其實卡在 I/O', '所以 OS 要載入很多程式，輪流用 CPU');
    await beat(tok, 2800);
  }
  // process 狀態圖（new / ready / running / waiting / terminated）
  function stateDiagram() {
    const N = { new: [-5.4, -1.8], ready: [-2.2, 0.6], running: [2.2, 0.6], waiting: [0, -2.8], term: [5.4, -1.8] };
    const nm = { new: 'new', ready: 'ready', running: 'running', waiting: 'waiting', term: 'terminated' };
    const node = {};
    for (const k in N) { node[k] = cube(nm[k], k === 'running' ? '#4b9ee2' : k === 'ready' ? '#2fc092' : k === 'waiting' ? '#dd8238' : '#9b7ef4', [2.0, 0.6, 1.0], N[k][0], 0.3, N[k][1]); }
    const ar = (a, b, lab2) => { const [x1, z1] = N[a], [x2, z2] = N[b]; const l = line(x1, 0.7, z1, x2, 0.7, z2, '#8a7a5c'); const t = tag(lab2, 'idx', (x1 + x2) / 2, 0.9, (z1 + z2) / 2); return { l, t }; };
    const E = {
      admit: ar('new', 'ready', 'admitted'),
      dispatch: ar('ready', 'running', 'scheduler dispatch'),
      e1: ar('running', 'waiting', '① I/O 或 event wait'),
      e2: { t: tag('② interrupt（timer）', 'idx', 0, 1.6, 0.25) },
      e3: ar('waiting', 'ready', '③ I/O 完成'),
      e4: ar('running', 'term', '④ exit'),
    };
    line(2.2, 1.0, 0.35, -2.2, 1.0, 0.35, '#8a7a5c');
    return { N, node, E };
  }
  async function scReadyOnly(tok) {
    fresh([0, 8.5, 9.5], [0, 0, -0.8]);
    const D = stateDiagram();
    say('process 的五種狀態', 'CPU scheduler：從 ready queue 挑誰進 running');
    await beat(tok, 2600);
    const p = cube('P', '#e55a9b', [0.6, 0.5, 0.6], D.N.ready[0], 1.0, D.N.ready[1], 2);
    glow(D.node.ready, GOLD); glow(D.node.running, GOLD);
    await beat(tok, 900);
    move(p, D.N.running[0], 1.0, D.N.running[1]);
    say('ready → running：這才是 scheduler 管的', '');
    await beat(tok, 2200);
    glow(D.node.ready, null); glow(D.node.running, null);
    move(p, D.N.waiting[0], 1.0, D.N.waiting[1]); glow(D.node.waiting, GOLD);
    say('進入 I/O burst：自己跑去 waiting', 'scheduler 在 ready queue 裡看不到它');
    await beat(tok, 2800);
    move(p, D.N.ready[0], 1.0, D.N.ready[1]); glow(D.node.waiting, null); glow(D.node.ready, GOLD);
    say('I/O 做完回到 ready，才又成為候選人', '');
    await beat(tok, 2800);
  }
  async function scFourPoints(tok) {
    fresh([0, 8.5, 9.5], [0, 0, -0.8]);
    const D = stateDiagram();
    const steps = [
      ['running', 'waiting', '① running → waiting', '去做 I/O，CPU 空了；non-preemptive 也會選人', 'e1', true],
      ['running', 'ready', '② running → ready', 'timer interrupt（time sharing）；只有 preemptive 會換人', 'e2', false],
      ['waiting', 'ready', '③ waiting → ready', 'ready queue 有新候選人；只有 preemptive 會搶', 'e3', false],
      ['running', 'term', '④ running → terminate', '做完了；non-preemptive 也會選人', 'e4', true],
    ];
    say('scheduler 可能被叫起來的時機只有四個', '');
    await beat(tok, 2200);
    for (const [a, b, cap, f, e, both] of steps) {
      const p = cube('P', '#e55a9b', [0.6, 0.5, 0.6], D.N[a][0], 1.0, D.N[a][1], 1.5);
      await beat(tok, 700);
      move(p, D.N[b][0], 1.0, D.N[b][1]);
      D.E[e].t.element.className = 'lab-label ' + (both ? 'ptr' : 'ptr alt');
      say(cap, f);
      await beat(tok, 2600);
      fly(p);
    }
    say('non-preemptive 只有 ①④，preemptive 全部', '判斷：Gantt 上有沒有 CPU burst 被切一半');
    await beat(tok, 3200);
  }
  async function scPreemptVsNon(tok) {
    fresh([0, 7, 12], [0, 0.8, 0]);
    const procs = [{ id: 'P1', arr: 0, burst: 7, pri: 3 }, { id: 'P2', arr: 3, burst: 3, pri: 1 }];
    const a = simulate(procs, 'PRI'), b = simulate(procs, 'PPRI');
    const col = (id) => (id === 'P1' ? PCOL[0] : PCOL[1]);
    const G1 = gantt(a.segs, 10, { color: col, z: -1.6, title: 'non-preemptive', maxTicks: 8 });
    const G2 = gantt(b.segs, 10, { color: col, z: 1.6, title: 'preemptive', maxTicks: 8 });
    say('P1 正在跑；t = 3 時更重要的 P2 進到 ready', 'P1 burst 7（pri 3）、P2 burst 3（pri 1，數字小 = 優先）');
    for (let t = 0; t <= 10; t++) {
      G1.render(t); G2.render(t);
      if (t === 3) { say('preemptive：立刻把 P1 打斷，讓 P2 先跑', 'non-preemptive：不理它，P1 繼續跑完這個 CPU burst'); await beat(tok, 2800); }
      await beat(tok, 450);
    }
    say('preemptive：P1 的 CPU burst 被切成兩段', 'non-preemptive 畫出來每段都剛好等於 burst 長度');
    await beat(tok, 3200);
  }
  async function scPreemptSync(tok) {
    fresh([0, 6, 12.5], [0, 1.5, 0]);
    const mem = cube('count = 5', '#c9b48e', [2.4, 0.8, 1.2], 0, 0.4, -2.4); tag('shared memory', 'idx', 0, 0, -1.5);
    const p1 = cube('P1', PCOL[0], [1, 0.6, 1], -3.5, 0.3, 1), p2 = cube('P2', PCOL[1], [1, 0.6, 1], 3.5, 0.3, 1);
    say('preemptive 效能較好（時機是 superset）', '代價：CPU burst 中途被打斷');
    await beat(tok, 2600);
    glow(p1, GOLD); const r1 = tag('reg = 5', 'ptr', -3.5, 1.2, 1);
    say('P1 把 count 讀進 register，還沒寫回…', 'CPU burst 才會碰 memory');
    await beat(tok, 2200);
    glow(p1, null); glow(p2, GOLD); txt(r1, 'reg = 5（被打斷）');
    say('timer 響了，換 P2 也去改 count', '兩邊都改同一塊 shared data');
    await beat(tok, 1600);
    relabel(mem, 'count = 6'); await beat(tok, 900);
    glow(p2, null); glow(p1, GOLD); relabel(mem, 'count = 4'); glow(mem, RED);
    say('結果亂掉 → synchronization 問題（第 5 章）', 'kernel 自己的程式也會被打斷');
    await beat(tok, 2800);
    glow(mem, null); relabel(mem, 'count = 5');
    const lock = cube('timer interrupt 關閉', '#5c7a4a', [3.4, 0.4, 0.8], 0, 0.2, 3.3, 2);
    say('解法：跑 kernel 時關掉 timer interrupt', '另一解法：kernel 裡自己加 lock / unlock（很囉嗦）');
    await beat(tok, 3000);
    glow(lock, GREEN);
    say('kernel 變成 non-preemptive，一口氣做完', '所以 kernel code 要寫得精簡，不然整個系統變慢');
    await beat(tok, 3200);
  }
  async function scDispatcher(tok) {
    fresh([0, 6, 12.5], [0, 1.2, 0]);
    const sch = cube('scheduler', '#9b7ef4', [2.2, 0.7, 1.1], -4.2, 0.35, -2.2), dis = cube('dispatcher', '#2fc092', [2.2, 0.7, 1.1], 0, 0.35, -2.2);
    const cpu = ctx.tile(V3(4.4, 0.04, -2.2), 1.8, 1.4, '#c9b48e'); tag('CPU', 'ptr alt', 4.4, 0.1, -1.2);
    const p1 = cube('P1', PCOL[0], [0.8, 0.6, 0.8], 4.4, 0.4, -2.2);
    const p2 = cube('P2', PCOL[1], [0.8, 0.6, 0.8], -4.2, 0.3, 0.6);
    say('scheduler 只負責「選誰」', '選好了告訴 dispatcher');
    glow(sch, GOLD); glow(p2, GOLD); await beat(tok, 2400); glow(sch, null);
    say('dispatcher 負責真的換人', '');
    glow(dis, GOLD); await beat(tok, 1200);
    const pcb1 = cube('PCB1', '#c08a1f', [1.1, 0.4, 0.8], 2.2, 0.2, 1.6, 2); move(p1, 2.2, 0.7, 1.6);
    say('① context switch：把 P1 的 state 存進 PCB1', 'PC、register、page table pointer…');
    await beat(tok, 2200);
    const pcb2 = cube('PCB2', '#c08a1f', [1.1, 0.4, 0.8], -1.5, 0.2, 1.6, 2);
    say('② 從 PCB2 載入 P2 的 state', '');
    await beat(tok, 1600);
    move(p2, 4.4, 0.4, -2.2); fly(pcb2, V3(4, 5, -2));
    say('③ 切回 user mode，跳到 P2 的 PC 繼續', '');
    await beat(tok, 2200);
    glow(dis, null);
    const b = bar('#d64545', 3.2, 0.5, 0, 3.6); await growBar(tok, b, 0.5, 600); tag('dispatch latency', 'idx', 0, 0.9, 3.6);
    say('停一個、啟動另一個要花的時間 = dispatch latency', '主要花在 context switch（期間 interrupt 也會先 disable）');
    await beat(tok, 3200);
    kill(pcb1);
  }

  // ───────────────────────── 場景：17A 排程演算法 ─────────────────────────
  async function scMetrics(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const procs = EX.sjf.procs, res = simulate(procs, 'SRTF');
    say('衡量排程好壞的三個時間（以 SRTF 例子的 P1 為例）', '');
    const V = makeView(procs, res, { noTable: true });
    V.frame(res.T);
    const G = V.G, y = 1.1;
    await beat(tok, 2000);
    const st = res.stat.P1;
    const brk = (a, b, c, label, zz) => { const m = lab.box(c, [Math.max(0.05, (b - a) * G.sx), 0.12, 0.12]); m.position.set(G.xAt((a + b) / 2), y + zz, 1.0); lab.world.add(m); tag(label, 'ptr', G.xAt((a + b) / 2), y + zz + 0.4, 1.0); return m; };
    brk(0, st.ct, '#9b7ef4', 'Turnaround = 完成 − 到達 = 16', 1.4);
    say('Turnaround time：從到達到全部做完', 'TAT = 16 − 0 = 16');
    await beat(tok, 2800);
    brk(2, 11, '#d64545', 'Waiting：在 ready queue 等 = 16 − 7 = 9', 0.6);
    say('Waiting time：待在 ready queue 的總時間', 'WT = TAT − burst = 16 − 7 = 9');
    await beat(tok, 2800);
    tag('Response = 0（一到就上 CPU）', 'ptr alt', G.xAt(0) + 1.2, y + 2.4, 1.0);
    say('Response time：到達 → 第一次上 CPU', 'RT = 0 − 0 = 0：回應很快，卻等了很久');
    await beat(tok, 3400);
  }
  async function scFCFS(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const A = EX.fcfs.procs;
    say('FCFS：先來先做（恐龍書例子：24、3、3）', 'P1 24、P2 3、P3 3 都在 0 到達');
    await beat(tok, 2200);
    const r1 = simulate(A, 'FCFS');
    await playSched(tok, A, r1, { ms: 110, at: { 24: ['兩個短工被長工 P1 卡住 → convoy effect', 'WT：P1 0、P2 24、P3 27'] }, slow: { 24: 2200 } });
    say('平均 waiting time = (0 + 24 + 27) / 3 = 17', '先來的如果很長，後面全部陪著等');
    await beat(tok, 3000);
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const B = [{ id: 'P2', arr: 0, burst: 3, pri: 0 }, { id: 'P3', arr: 0, burst: 3, pri: 0 }, { id: 'P1', arr: 0, burst: 24, pri: 0 }];
    say('同樣三個工作，換成 P2、P3、P1 的順序到', '');
    await playSched(tok, B, simulate(B, 'FCFS'), { ms: 110 });
    say('平均 waiting time = (0 + 3 + 6) / 3 = 3', 'FCFS 的表現完全看到達順序');
    await beat(tok, 3200);
  }
  async function scSJFNon(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const A = EX.sjf.procs;
    say('SJF：ready queue 裡最短的先排', 'P1(0,7) P2(2,4) P3(4,1) P4(5,4)');
    await beat(tok, 2400);
    await playSched(tok, A, simulate(A, 'SJF'), { ms: 420, showRem: false,
      at: { 0: ['P1 雖然很長，但只有它先到，只好讓它先做', 'non-preemptive：一旦開始就做完這個 CPU burst'], 2: ['P2 到了，但不能打斷 P1', ''], 7: ['P1 做完：ready 裡 P3 最短（1）', 'P2、P4 都是 4 → 比到達時間'], 8: ['接著 P2（4），再 P4（4）', ''] }, slow: { 0: 1800, 7: 2000 } });
    say('平均 WT = (0 + 6 + 3 + 7) / 4 = 4', 'SJF 可以證明 average waiting time 最小');
    await beat(tok, 3200);
  }
  async function scSRTF(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const A = EX.sjf.procs;
    say('Preemptive SJF（SRTF）：隨時檢查有沒有更短的進來', '方塊上的數字 = 剩餘時間');
    await beat(tok, 2200);
    await playSched(tok, A, simulate(A, 'SRTF'), { ms: 420, showRem: true,
      at: { 2: ['t=2：P2 要 4 < P1 剩 5 → P1 被打斷', 'P1 的 CPU burst 被切開'], 4: ['t=4：P3 要 1 < P2 剩 2 → 換 P3', ''], 5: ['t=5：P2 剩 2 最短，繼續', 'P4 要 4、P1 剩 5'], 7: ['再來 P4（4），最後才輪到 P1', ''] }, slow: { 2: 2200, 4: 1800, 5: 1800 } });
    say('平均 WT = (9 + 1 + 0 + 2) / 4 = 3', 'P1 response 0，卻等了 9：response ≠ waiting');
    await beat(tok, 3400);
  }
  async function scSJFPredict(tok) {
    fresh([0, 5.5, 13.5], [0, 2.4, 0]);
    const T = [6, 4, 6, 4, 13, 13, 13]; const tau = [10]; for (const t of T) tau.push(tau[tau.length - 1] / 2 + t / 2);
    say('SJF 不知道下一個 CPU burst 多長，只能預測', 'τₙ₊₁ = α·tₙ + (1 − α)·τₙ（α = 1/2，τ₀ = 10）');
    tag('灰 = 預測 τ　藍 = 實際 t', 'idx', 0, 6.4, 0);
    await beat(tok, 2600);
    for (let k = 0; k < T.length; k++) {
      const x = -5.6 + k * 1.6;
      const bp = bar('#bfb3a0', 0.6, 0.6, x - 0.33, 0); await growBar(tok, bp, tau[k] * 0.38, 300); tag(fmt(tau[k]), 'idx', x - 0.33, tau[k] * 0.38 + 0.3, 0);
      const ba = bar('#4b9ee2', 0.6, 0.6, x + 0.33, 0); await growBar(tok, ba, T[k] * 0.38, 300); tag(String(T[k]), 'idx', x + 0.33, T[k] * 0.38 + 0.3, 0);
      say('第 ' + (k + 1) + ' 次：預測 ' + fmt(tau[k]) + '，實際 ' + T[k], '下次預測 = ' + T[k] + '/2 + ' + fmt(tau[k]) + '/2 = ' + fmt(tau[k + 1]));
      await beat(tok, 1300);
    }
    say('一開始亂猜，但程式行為有規律，很快就貼近', 'α = 0：只看歷史；α = 1：只看上一次');
    await beat(tok, 3200);
  }
  async function scPriorityAging(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    say('Priority：數字小 = 優先（恐龍書慣例）', 'SJF 就是 priority = CPU burst 長度的特例');
    const A = EX.pri.procs;
    await beat(tok, 2200);
    await playSched(tok, A, simulate(A, 'PRI'), { ms: 220, pri: true, showPri: true });
    say('順序 P2 P5 P1 P3 P4，平均 WT = 8.2', '');
    await beat(tok, 2600);
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const S = EX.starve.procs;
    say('問題：低優先的 PL 一直被新來的高優先插隊', 'starvation（貧窮的人翻不了身）');
    await playSched(tok, S, simulate(S, 'PRI'), { ms: 160, showPri: true, noTable: true, at: { 21: ['PL 等到 t = 21 才跑', ''] }, slow: { 21: 1600 } });
    await beat(tok, 1400);
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    say('Aging：在 ready queue 每等 1 單位，priority 數字 −1', '方塊上：名稱·目前 priority');
    await playSched(tok, S, simulate(S, 'PRI', { aging: 1 }), { ms: 200, showPri: true, noTable: true, at: { 9: ['PL 的 priority 升到 0，t = 9 就輪到它', '多久升、升多少只是 policy'] }, slow: { 9: 2200 } });
    say('遲早會升到最高 → 不會 starvation', 'aging = 解 starvation 的標準作法');
    await beat(tok, 3000);
  }
  async function scRRq20(tok) {
    fresh([0, 7, 12.5], [0, 1.4, 0]);
    const A = EX.rr20.procs;
    say('Round-Robin，time quantum = 20', 'P1 53、P2 17、P3 68、P4 24，都在 0 到達');
    await beat(tok, 2200);
    await playSched(tok, A, simulate(A, 'RR', { q: 20 }), { ms: 55, showRem: true,
      at: { 20: ['P1 是 53，但做 20 就得換人 → 排到隊尾', ''], 37: ['P2 只要 17，t = 37 就提早結束', '不會硬做滿 20'], 57: ['P3 做 20、P4 做 20，再輪回 P1', ''], 117: ['P4 剩 4、P1 剩 13 依序做完', ''] }, slow: { 20: 1800, 37: 1800, 57: 1500 } });
    say('平均 WT = (81 + 20 + 94 + 97) / 4 = 73', '剛做完的人放到 ready queue 最後面');
    await beat(tok, 3200);
  }
  async function scRRQuantum(tok) {
    fresh([0, 6, 12.5], [0, 1.6, 0]);
    const A = EX.fcfs.procs, colors = { P1: PCOL[0], P2: PCOL[1], P3: PCOL[2] };
    say('time quantum 怎麼選？用 24、3、3 試試', '');
    for (const [q, cap, f] of [[100, 'q = 100：大過所有 burst → 變成 FCFS', ''], [4, 'q = 4：恐龍書例子，平均 WT 5.66', ''], [1, 'q = 1：非常公平，但 context switch 暴增', '每次切換都有 overhead']]) {
      lab.clear();
      const r = simulate(A, 'RR', { q });
      const G = gantt(r.segs, r.T, { color: (id) => colors[id], z: 0.8, title: 'RR q = ' + q, maxTicks: 14 });
      const sw = tag('context switch：0', 'ptr alt', 0, 2.2, 0.8);
      say(cap, f || '平均 WT = ' + fmt(r.avgWT) + '，平均 TAT = ' + fmt(r.avgTAT));
      for (let t = 0; t <= r.T; t++) { G.render(t); const n = r.segs.filter((s) => s.e <= t).length; txt(sw, 'context switch：' + Math.max(0, Math.min(n, r.switches))); await beat(tok, 60); }
      txt(sw, 'context switch：' + r.switches);
      await beat(tok, 2400);
    }
    say('q 不能太大（變 FCFS），也不能太小（切換吃掉 CPU）', '經驗：約 80% 的 CPU burst 短於 q');
    await beat(tok, 3000);
  }
  async function scRRTradeoff(tok) {
    fresh([0, 6, 13], [0, 2.4, 0]);
    const A = EX.rr20.procs;
    const rr = simulate(A, 'RR', { q: 20 }), sj = simulate(A, 'SJF');
    say('同一組工作：RR（q = 20）vs SJF', '比平均 turnaround 和平均 response');
    tag('平均 TAT', 'ptr', -3, 0, 1.6); tag('平均 response', 'ptr', 3, 0, 1.6);
    tag('藍 = RR　橘 = SJF', 'idx', 0, 6.4, 0);
    await beat(tok, 2200);
    const S = 0.045;
    const b1 = bar('#4b9ee2', 1.2, 1, -3.8, 0), b2 = bar('#dd8238', 1.2, 1, -2.2, 0);
    await growBar(tok, b1, rr.avgTAT * S, 700); tag(fmt(rr.avgTAT), 'idx', -3.8, rr.avgTAT * S + 0.35, 0);
    await growBar(tok, b2, sj.avgTAT * S, 700); tag(fmt(sj.avgTAT), 'idx', -2.2, sj.avgTAT * S + 0.35, 0);
    say('RR 很 fair → 大家都被拉長，平均 TAT 比較高', '113.5 vs 78.5');
    await beat(tok, 2800);
    const b3 = bar('#4b9ee2', 1.2, 1, 2.2, 0), b4 = bar('#dd8238', 1.2, 1, 3.8, 0);
    await growBar(tok, b3, rr.avgRT * S, 700); tag(fmt(rr.avgRT), 'idx', 2.2, rr.avgRT * S + 0.35, 0);
    await growBar(tok, b4, sj.avgRT * S, 700); tag(fmt(sj.avgRT), 'idx', 3.8, sj.avgRT * S + 0.35, 0);
    say('但 response time RR 比較好：最多等 (n−1)·q', '28.5 vs 38');
    await beat(tok, 2800);
    say('沒有最好的演算法，只有符合需求的', '要 response 好 → RR；要平均 WT 小 → SJF');
    await beat(tok, 3000);
  }
  async function scMLQ(tok) {
    fresh([0, 7, 12], [0, 0.6, -0.4]);
    const Q = [['system process', 'Priority', 50], ['interactive', 'RR', 20], ['interactive editing', 'RR', 10], ['batch', 'FCFS', 10], ['student', 'FCFS', 10]];
    const lanes = Q.map(([nm, alg, w], k) => {
      const z = -3.6 + k * 1.15;
      ctx.tile(V3(-0.8, 0.03, z), 7.4, 0.85, '#e9dcc4');
      tag(nm + '（' + alg + '）', 'ptr', -6.1, 0.1, z);
      tag(w + '%', 'ptr alt', 3.5, 0.1, z);
      const toks = [0, 1, 2].map((j) => cube('', PCOL[k], [0.6, 0.5, 0.6], -2.6 + j * 0.75, 0.25, z));
      return { z, toks, w };
    });
    ctx.tile(V3(5.6, 0.04, -1.3), 1.4, 1.4, '#c9b48e'); tag('CPU', 'ptr alt', 5.6, 0.1, -0.4);
    say('Multilevel queue：好幾個 ready queue', '不同類型的 process 放不同 queue，各用不同演算法');
    await beat(tok, 3000);
    say('每一刻還是只能選一個 → queue 之間怎麼選？', '17A 講：依權重（50%、20%、10%…）機率挑 queue');
    await beat(tok, 2600);
    const seq = [0, 1, 0, 3, 0, 2, 1, 4];
    for (const k of seq) {
      const L = lanes[k]; const m = L.toks.shift();
      if (!m) continue;
      glow(m, GOLD); move(m, 5.6, 0.4, -1.3);
      say('這次抽中：' + Q[k][0], '機率 ' + Q[k][2] + '%');
      await beat(tok, 900);
      fly(m, V3(2, 6, -2));
      await beat(tok, 300);
    }
    say('process 永遠待在自己的 queue，不會移動', '補充：恐龍書另一種是 queue 間 fixed priority（上層空了才跑下層）');
    await beat(tok, 3400);
  }
  async function scMLFQ(tok) {
    fresh([0, 7, 12], [0, 0.8, -0.6]);
    const procs = [{ id: 'P1', arr: 0, burst: 30 }, { id: 'P2', arr: 1, burst: 6 }, { id: 'P3', arr: 2, burst: 14 }, { id: 'P4', arr: 20, burst: 3 }];
    const res = simMLFQ(procs);
    const S = mlfqStage(procs, res);
    say('MLFQ：Q0 RR 8、Q1 RR 16、Q2 FCFS', '上層 queue 空了才輪到下層；新來的一律進 Q0');
    S.frame(0);
    await beat(tok, 3000);
    const cap = {
      8: ['P1 用完 8 還沒做完 → 降到 Q1', '判定它的 CPU burst 長'],
      14: ['P2 只要 6 < 8：短 job 留在上層', '短 CPU burst = I/O-bound，最先做'],
      22: ['P3 也用完 8 → 降到 Q1；P4 剛到在 Q0', ''],
      25: ['Q0 空了，才輪到 Q1 的 P1（q = 16）', ''],
      41: ['P1 又用完 16 → 沉到 Q2（FCFS）', ''],
      47: ['Q0、Q1 都空，最下層也有機會執行', ''],
    };
    for (let t = 1; t <= res.T; t++) {
      S.frame(t);
      if (cap[t]) { say(cap[t][0], cap[t][1]); await beat(tok, 2200); }
      await beat(tok, 150);
    }
    say('依 run time 行為自動分類 → 逼近 SJF', '等太久的人用 aging 往上提，避免 starvation');
    await beat(tok, 3200);
  }
  async function scEval(tok) {
    fresh([0, 6, 13], [0, 1.8, 0]);
    const M = [['Deterministic modeling', '給定輸入手算'], ['Queueing model', '機率分析'], ['Simulation', '真實 trace 跑模擬器'], ['Implementation', '真的寫進 OS']];
    say('怎麼評估排程演算法？先定義 metric', 'response？waiting？turnaround？');
    await beat(tok, 2400);
    for (let k = 0; k < 4; k++) {
      const x = -4.8 + k * 3.2;
      const b = bar(PCOL[k], 1.6, 1.4, x, 0); await growBar(tok, b, 0.8 + k * 0.9, 500);
      tag(M[k][0], 'ptr', x, 0.9 + k * 0.9 + 0.4, 0); tag(M[k][1], 'idx', x, 0, 1.3);
      say(M[k][0] + '：' + M[k][1], k === 0 ? '就是課堂例子的作法：直觀但不 general' : k === 1 ? '要找到吻合的 queueing model，常有假設落差' : k === 2 ? '收集 real system log 產生 workload' : '才看得到 context switch 等真實 overhead');
      await beat(tok, 2400);
    }
    say('Deterministic 的弱點：輸入一改，結論就變', '例：FCFS 先長後短 WT 17，先短後長只要 3');
    await beat(tok, 3200);
  }

  // ───────────────────────── 場景：17B / 18A 多處理器 ─────────────────────────
  async function scSMP(tok) {
    fresh([0, 7, 12.5], [0, 0.8, 0]);
    say('OS 排順序，放哪顆 CPU 由硬體決定', '軟體 + 硬體：兩層 scheduling');
    await beat(tok, 2800);
    tag('Asymmetric', 'ptr', -3.6, 0.2, -3.6);
    const master = cube('master', '#9b7ef4', [1.6, 0.7, 1.1], -3.6, 0.35, -2.4);
    const sl = [0, 1, 2].map((k) => cube('CPU' + (k + 1), '#4b9ee2', [1.1, 0.6, 0.9], -5.2 + k * 1.6, 0.3, 0.4));
    say('Asymmetric：master CPU 統一分派', 'master 不跑一般程式 → 使用率可能低');
    for (let k = 0; k < 3; k++) { const p = cube('P', PCOL[k + 3], [0.5, 0.4, 0.5], -3.6, 1.2, -2.4, 1); await beat(tok, 500); move(p, -5.2 + k * 1.6, 0.9, 0.4); await beat(tok, 500); }
    await beat(tok, 1600);
    tag('Symmetric（SMP）', 'ptr alt', 3.6, 0.2, -3.6);
    const q = [0, 1, 2, 3].map((k) => cube('P' + (k + 1), PCOL[k], [0.6, 0.5, 0.6], 2.4 + k * 0.8, 0.25, -2.4));
    const cpus = [0, 1, 2].map((k) => cube('CPU' + (k + 1), '#4b9ee2', [1.1, 0.6, 0.9], 2.0 + k * 1.6, 0.3, 0.4));
    say('SMP：大家共用一個 ready queue，自己去拿', '');
    await beat(tok, 1600);
    const lock = cube('lock', '#d64545', [0.7, 0.4, 0.5], 3.6, 1.2, -2.4, 1);
    say('同時 dequeue 要 synchronization', '一個 process 不能同時跑在兩顆 CPU 上');
    for (let k = 0; k < 3; k++) { glow(lock, GOLD); move(q[k], 2.0 + k * 1.6, 0.9, 0.4); await beat(tok, 700); glow(lock, null); await beat(tok, 300); }
    say('稍微慢一點點，但一般電腦都是 SMP', '');
    await beat(tok, 2800);
    kill(master); sl.length = 0; cpus.length = 0;
  }
  async function scAffinity(tok) {
    fresh([0, 6.5, 12], [0, 1, 0]);
    const cores = [-3, 3].map((x, k) => { cube('core ' + k, '#4b9ee2', [2.2, 0.7, 1.4], x, 0.35, -1.2); tag('L1 cache', 'idx', x, 0, 0.6); return x; });
    const cache = [[], []];
    const fill = async (k, n, c) => { for (let j = 0; j < n; j++) { cache[k].push(cube('', c, [0.42, 0.3, 0.42], cores[k] - 0.9 + (cache[k].length % 5) * 0.45, 0.15, 1.3 + Math.floor(cache[k].length / 5) * 0.45, 1.5)); await beat(tok, 160); } };
    const p = cube('P', '#e55a9b', [0.7, 0.5, 0.7], cores[0], 1.0, -1.2, 2);
    say('P 在 core 0 跑，L1 cache 裝滿它的資料', '各 core 的 L1 cache 不共用');
    await fill(0, 8, '#e55a9b');
    await beat(tok, 1200);
    move(p, cores[1], 1.0, -1.2);
    say('換到 core 1：cache 是冷的，全部 miss', '');
    await beat(tok, 900);
    cache[0].forEach((m) => tint(m, GRAY));
    await fill(1, 8, '#e55a9b');
    await beat(tok, 1400);
    move(p, cores[0], 1.0, -1.2);
    say('Processor affinity：把 process 綁在固定 core', 'cache reuse → 跑得更快');
    cache[0].forEach((m) => tint(m, '#e55a9b'));
    await beat(tok, 2600);
    say('soft：太忙或等太久還是可能搬走', 'hard：寧可等，也不換 core');
    await beat(tok, 3000);
  }
  async function scNUMA(tok) {
    fresh([0, 7, 12], [0, 0.8, 0]);
    const cpu = [-3.5, 3.5].map((x, k) => { cube('CPU ' + k, '#4b9ee2', [2.6, 0.8, 1.4], x, 0.4, -2); return x; });
    const mem = [-3.5, 3.5].map((x, k) => { cube('memory ' + k, '#c9b48e', [2.6, 0.6, 1.2], x, 0.3, 1.4); line(x, 0.5, -1.2, x, 0.5, 0.8, '#2fc092'); return x; });
    line(-2.2, 0.5, -1.4, 2.2, 0.5, 1.2, '#d64545');
    tag('快（local）', 'idx', -3.5, 1.2, -0.2); tag('慢（remote）', 'idx', 0, 1.3, 0);
    say('NUMA：每顆 CPU 旁邊有比較近的 memory', 'access local 快、access 別人的慢');
    await beat(tok, 2800);
    const d = cube('P 的資料', '#e55a9b', [1.2, 0.4, 0.8], mem[0], 0.9, 1.4, 2);
    const p = cube('P', '#e55a9b', [0.7, 0.5, 0.7], cpu[0], 1.1, -2, 2);
    say('P 在 CPU 0 建立資料，資料就落在 memory 0', '搬資料（memory copy）很貴');
    await beat(tok, 2600);
    move(p, cpu[1], 1.1, -2); glow(p, RED);
    say('下次被排到 CPU 1：每次 access 都要跨過去', '');
    await beat(tok, 2600);
    move(p, cpu[0], 1.1, -2); glow(p, GREEN);
    say('排程時盡量放回資料所在的 CPU', '同一顆 CPU 上哪個 core 都可以');
    await beat(tok, 3000);
    kill(d);
  }
  async function scLoadBalance(tok) {
    fresh([0, 6.5, 12.5], [0, 1.5, 0]);
    const N = [5, 1, 4, 0];
    const cols = N.map((n, k) => { const x = -4.5 + k * 3; tag('core ' + k, 'ptr', x, 0, 1.2); return { x, st: Array.from({ length: n }, (_, j) => cube('', PCOL[k], [1.0, 0.45, 0.9], x, 0.23 + j * 0.5, 0)) }; });
    say('綁太緊（locality）→ 有的 core 很忙、有的很閒', 'locality vs load balancing：trade-off');
    await beat(tok, 2800);
    const mv = async (a, b) => { const m = cols[a].st.pop(); cols[b].st.push(m); move(m, cols[b].x, 0.23 + (cols[b].st.length - 1) * 0.5, 0); await beat(tok, 900); };
    say('Push：忙的 core 主動把工作推出去', '由 loading 高的人發起 migration');
    glow(cols[0].st[cols[0].st.length - 1], GOLD); await beat(tok, 800); await mv(0, 1);
    await beat(tok, 1200);
    say('Pull：閒的 core（queue 空了）主動去拉', '由 loading 低的人發起');
    await mv(2, 3);
    await beat(tok, 1600);
    say('系統很忙：閒的人少 → 用 pull', '系統很閒：忙的人少 → 用 push（發起的人越少越省）');
    await beat(tok, 3600);
  }
  async function scMemStall(tok) {
    fresh([0, 6, 12.5], [0, 1.2, 0]);
    const pat = [['C', 1], ['M', 2.2], ['C', 1], ['M', 2.2], ['C', 1]];
    say('一個 core 執行時常卡在 memory access', 'memory stall：CPU 沒在跑指令，只是在等');
    let x = -6;
    tag('thread 0', 'ptr', -6.6, 0.2, -1.8);
    for (const [k, w] of pat) { cube(k === 'C' ? 'compute' : 'stall', k === 'C' ? '#4b9ee2' : '#d8cfc0', [w, 0.5, 0.8], x + w / 2, 0.25, -1.2, 2); x += w + 0.04; await beat(tok, 450); }
    await beat(tok, 1800);
    say('趁 stall 換另一個 hardware thread 來算', 'Hyper-threading、GPU 一個 core 好多 thread');
    tag('thread 1', 'ptr alt', -6.6, 0.2, 0.4);
    x = -6 + 1.04;
    for (let j = 0; j < 2; j++) { cube('compute', '#dd8238', [1, 0.5, 0.8], x + 0.6, 0.25, 1.0, 2); x += 3.24; await beat(tok, 700); }
    await beat(tok, 1600);
    say('coarse 要 flush pipeline，fine 保留狀態', 'coarse-grained：長 stall 才切；fine-grained：指令邊界就切，靠額外 register');
    await beat(tok, 3800);
    say('這些是 hardware level 的 scheduling', 'OS 只管有幾個可執行的位置、順序是什麼');
    await beat(tok, 2800);
  }
  async function scRTPeriodic(tok) {
    fresh([0, 6.5, 12.5], [0, 0.6, 0]);
    say('Real-time：重點不是越快越好，而是趕在 deadline 前', 'soft：盡量不 miss；hard：保證不 miss（車、武器、核電廠）');
    await beat(tok, 3200);
    const sx = 12 / 30, x0 = -6;
    tag('一個 periodic task：period p = 10、execution e = 4', 'ptr', 0, 2.2, 0);
    for (let r = 0; r < 30; r += 10) {
      const pin = lab.box('#c08a1f', [0.06, 1.2, 0.06]); pin.position.set(x0 + r * sx, 0.6, -0.6); lab.world.add(pin);
      tag('到達 ' + r, 'idx', x0 + r * sx, 1.4, -0.6);
      say('每 ' + 10 + ' 單位來一個 CPU burst，要做 4', '下一個 burst 到來之前就是 deadline');
      cube('e=4', '#4b9ee2', [4 * sx, 0.5, 0.8], x0 + (r + 1 + 2) * sx, 0.25, 0.4, 2);
      tag('deadline ' + (r + 10), 'idx', x0 + (r + 10) * sx - 0.3, 0, 1.3);
      await beat(tok, 1500);
    }
    say('task 要有規律，才有辦法保證 deadline', '用 (period, execution) 描述；注意題目誰寫前面');
    await beat(tok, 3200);
  }
  async function scRM(tok) {
    fresh([0, 7.5, 11.5], [0, 0.4, -0.4]);
    const res = simRT([{ p: 4, e: 1 }, { p: 5, e: 2 }, { p: 20, e: 5 }], 'RM', 20);
    say('Rate-Monotonic：period 越短 priority 越高（固定）', 'T1 (4,1)、T2 (5,2)、T3 (20,5) → T1 > T2 > T3');
    const S = rtStage(res);
    await beat(tok, 3000);
    const cap = { 10: ['t=0：T1 先做 1，再 T2 做 2，最後 T3', ''], 40: ['t=4：T1 又來 → 打斷 T3（preemptive）', ''], 50: ['t=5：T2 也來了，T2 仍比 T3 優先', ''], 80: ['只有 T1、T2 都不在時才輪到 T3', ''], 160: ['t=16：T1 到達又打斷 T2', ''] };
    for (let t = 0; t <= res.T; t += 2) { S.render(t); if (cap[t]) { say(cap[t][0], cap[t][1]); await beat(tok, 2000); } await beat(tok, 90); }
    S.render(res.T);
    say('T3 在 t = 15 做完 5 單位，全部趕上', 'priority 跟 execution time 無關：T3 改成 19 也一樣最低');
    await beat(tok, 3400);
  }
  async function scEDF(tok) {
    fresh([0, 7.5, 11.5], [0, 0.4, -0.4]);
    const res = simRT([{ p: 2, e: 0.9 }, { p: 5, e: 2.3 }], 'EDF', 10);
    say('EDF：誰的 deadline 最近誰先做（dynamic）', 'T1 (2, 0.9)、T2 (5, 2.3)');
    const S = rtStage(res);
    await beat(tok, 3000);
    const cap = { 9: ['t=0：T1 deadline 2 < 5，先做 T1', ''], 20: ['t=2：新 T1 deadline 4 < T2 的 5 → T1 先', 'T2 剛剛做了 1.1'], 29: ['T1 做完換 T2', ''], 40: ['t=4：新 T1 deadline 6 > T2 的 5 → T2 繼續！', '同一個 task，這次 priority 倒過來'], 41: ['T2 做完剩下的 0.1', ''] };
    for (let t = 0; t <= res.T; t++) { S.render(t); if (cap[t]) { say(cap[t][0], cap[t][1]); await beat(tok, 2400); } await beat(tok, 60); }
    say('EDF 可證明使用率 ≤ 1 就排得完（理論上）', '實際 overhead 仍可能 miss；RM 是 static，EDF 每次重新決定');
    await beat(tok, 3400);
  }

  // ───────────────────────── 場景表 ─────────────────────────
  const scenes = {
    'burst-cycle': { title: 'CPU burst 與 I/O burst 輪流出現', play: scBurstCycle },
    'cpu-io-bound': { title: 'CPU-bound vs I/O-bound 與 burst 分佈', play: scCpuIoBound },
    'ready-queue-only': { title: 'CPU scheduler 只看 ready queue', play: scReadyOnly },
    'four-points': { title: '四個 scheduling 時機：non-preemptive 只有 ①④', play: scFourPoints },
    'preempt-vs-non': { title: 'Preemptive vs non-preemptive：CPU burst 會不會被切開', play: scPreemptVsNon },
    'preempt-sync': { title: 'Preemptive 的代價：synchronization 與關 interrupt', play: scPreemptSync },
    'dispatcher': { title: 'Scheduler 選人、dispatcher 換人：dispatch latency', play: scDispatcher },
    'metrics': { title: 'Waiting / Turnaround / Response time（課本）', play: scMetrics },
    'fcfs-convoy': { title: 'FCFS 與 convoy effect：24、3、3（課本）', play: scFCFS },
    'sjf-nonpre': { title: 'SJF（non-preemptive）：平均 WT 4', play: scSJFNon },
    'srtf': { title: 'SRTF（preemptive SJF）：平均 WT 3', play: scSRTF },
    'sjf-predict': { title: '預測下一個 CPU burst：exponential averaging', play: scSJFPredict },
    'priority-aging': { title: 'Priority scheduling、starvation 與 aging', play: scPriorityAging },
    'rr-q20': { title: 'Round-Robin q = 20：53、17、68、24', play: scRRq20 },
    'rr-quantum': { title: 'Time quantum 太大變 FCFS、太小切換爆量', play: scRRQuantum },
    'rr-tradeoff': { title: 'RR vs SJF：turnaround 較差、response 較好', play: scRRTradeoff },
    'mlq': { title: 'Multilevel queue：依權重挑 queue', play: scMLQ },
    'mlfq': { title: 'Multilevel feedback queue：8 / 16 / FCFS', play: scMLFQ },
    'eval-methods': { title: '評估排程：deterministic、queueing、simulation、implementation', play: scEval },
    'smp': { title: 'Asymmetric vs symmetric multiprocessing', play: scSMP },
    'affinity': { title: 'Processor affinity：cache reuse，soft / hard', play: scAffinity },
    'numa': { title: 'NUMA：排在資料所在的 CPU', play: scNUMA },
    'load-balance': { title: 'Load balancing：push 與 pull', play: scLoadBalance },
    'memory-stall': { title: 'Memory stall 與 hardware thread', play: scMemStall },
    'rt-periodic': { title: 'Real-time task：period 與 execution', play: scRTPeriodic },
    'rate-monotonic': { title: 'Rate-Monotonic：(4,1) (5,2) (20,5)', play: scRM },
    'edf': { title: 'EDF：(2, 0.9) (5, 2.3)', play: scEDF },
  };

  return {
    kicker: '作業系統・第 4 章',
    title: 'CPU 排程',
    color: 'var(--os)',
    modes: [
      { id: 'sim', name: '排程模擬器', enter: enterSim },
      { id: 'compare', name: '演算法比較', enter: enterCompare },
      { id: 'rrq', name: 'RR 的 quantum', enter: enterRRQ },
      { id: 'mlfq', name: 'MLFQ', enter: enterMLFQ },
      { id: 'rt', name: 'Real-time：RM / EDF', enter: enterRT },
    ],
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'burst-cycle', 'cpu-io-bound', 'ready-queue-only', 'four-points', 'preempt-vs-non', 'preempt-sync', 'dispatcher',
      'metrics', 'fcfs-convoy', 'sjf-nonpre', 'srtf', 'sjf-predict', 'priority-aging', 'rr-q20', 'rr-quantum', 'rr-tradeoff',
      'mlq', 'mlfq', 'eval-methods',
      'smp', 'affinity', 'numa', 'load-balance', 'memory-stall', 'rt-periodic', 'rate-monotonic', 'edf',
    ],
    stop() { stopTimer(); },
  };
}
