// 作業系統 第4章：CPU 排程（FCFS、SJF/SRTF、Priority + aging、RR、MLQ/MLFQ、多處理器、Real-time）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自清大周志遠 16C/17A/17B/18A 講（與恐龍書相同的例子）；16D 講尚未轉錄的部分以恐龍書例題補上。
import kit from './_kit.js';

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
    const tickX = [];
    function tickAt(b) {
      if (opt.noTicks || ticks.has(b) || !shown.has(b)) return; ticks.add(b);
      const x = x0 + b * sx, near = tickX.some((p) => p.row === 0 && Math.abs(p.x - x) < 0.6); tickX.push({ x, row: near ? 1 : 0 });
      tag(fmt(b * unit), 'idx', x, y - 0.25, z + d / 2 + 0.3 + (near ? 0.5 : 0));
    }
    let cursor = null, cl = null;
    if (!opt.noCursor) {
      cursor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
      cursor.position.set(x0, y + 0.4, z - d / 2 - 0.05); lab.world.add(cursor);
      cl = tag('', 'idx', x0, y - 0.25, z + d / 2 + 1.25);
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
    tag('Ready queue →', 'ptr', -5.0, 0.1, -2.9);
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
          else if (f) { const k = f.ready.indexOf(p.id); move(m, -5.3 + Math.max(k, 0) * 1.45, 0.3, -1.3); glow(m, null); }
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
    ctx.tile(V3(5.2, 0.04, -2.1), 1.6, 1.4, '#c9b48e'); tag('CPU', 'ptr alt', 6.4, 0.1, -2.1);
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
      'CPU 使用率 U = ' + fmt(U) + '<br>RM 保證可排的上界 n(2^(1/n) − 1) =' + fmt(bound) + '；EDF 只要 U ≤ 1' + (res.misses.length ? '<br><span class="no">有 ' + res.misses.length + ' 次 miss</span>' : '<br><span class="ok">全部趕上 deadline</span>'));
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
      { q: 'MLFQ（Q0 RR 8、Q1 RR 16、Q2 FCFS）中，process 什麼時候會被降到下一層？', opts: ['把該層 quantum 全部用完', '做了一次 I/O', '等太久', '一進系統就降'], ans: '把該層 quantum 全部用完', why: '用完 8 ms 還沒做完 → 判定 CPU burst 長 → 往下踢；等太久則是 aging 往上提。' },
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
    glow(ps[1], GOLD); move(ps[1], -1, 0.3, -4.2); tag('waiting（做 I/O）', 'idx', 1.5, 0.3, -4.2);
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
    // at: where the arrow's label sits (beside the arrow, so labels never share a spot)
    const ar = (a, b, lab2, at) => { const [x1, z1] = N[a], [x2, z2] = N[b]; const l = line(x1, 0.7, z1, x2, 0.7, z2, '#8a7a5c'); const t = tag(lab2, 'idx', at ? at[0] : (x1 + x2) / 2, 0.9, at ? at[1] : (z1 + z2) / 2); return { l, t }; };
    const E = {
      admit: ar('new', 'ready', 'admitted'),
      dispatch: ar('ready', 'running', 'scheduler dispatch', [0, 1.2]),
      e1: ar('running', 'waiting', '① I/O 或 event wait', [2.7, -1.4]),
      e2: { t: tag('② interrupt（timer）', 'idx', 0, 0.9, 0.05) },
      e3: ar('waiting', 'ready', '③ I/O 完成', [-2.5, -1.4]),
      e4: ar('running', 'term', '④ exit', [4.9, -0.2]),
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
    const G1 = gantt(a.segs, 10, { color: col, z: -2.3, title: 'non-preemptive', maxTicks: 8 });
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
    glow(p2, null); glow(p1, GOLD); relabel(mem, 'count = 6'); glow(mem, RED);
    say('P1 回來把自己算的 6 寫回：加了兩次卻只有 6', 'synchronization 問題（下一章）；kernel 自己的程式也會被打斷');
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
    say('多處理器：OS 要把 ready 的 process 分給好幾顆 CPU', '兩種做法：asymmetric 與 symmetric（SMP）');
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
    tag('快（local）', 'idx', -5.4, 0.5, -0.2); tag('慢（remote）', 'idx', 0, 1.3, 0);
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
    tag('thread 0', 'ptr', -6.4, 1.0, -1.5);
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
      cube('e=4', '#4b9ee2', [4 * sx, 0.5, 0.8], x0 + (r + 2) * sx, 0.25, 0.4, 2);
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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ sch.js ═══
  {
const P = K; const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob, fresh } = P;
const { txt, tint, line } = P;
// (kit has no beat: short waits use ctx.beat)
// ─── 作業系統 第 4 章 CPU Scheduling（清大 周志遠 16C、16D、17A、17B、18A、18B 講 + Gate Smashers SJF）— cued scenes ───
// Every scene is a list of steps; each step waits for the lecturer's sentence (notes "cues"), then makes one short move.
// Nothing loops or replays. 老師的例子照原數字（24/3/3、7/4/1/4、53/17/68/24、(4,1)(5,2)(20,5)…）；老師沒給的數字標「示意」。
const wt = (tok, ms) => ctx.beat(tok, ms);
const sayc = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const hd = (t, x, y, z = 0) => tag(t, 'ptr', x, y, z);
const hot = (t, x, y, z = 0) => tag(t, 'ptr alt', x, y, z);
const sm = (t, x, y, z = 0) => tag(t, 'idx', x, y, z);
const bx = (t, c, x, y, z = 0, w = 2.4, drop = 0, h = 0.6, d = 0.9) => cube(t, c, [w, h, d], x, y, z, drop);
const pal = (name, v, color, x, z = 0, s = 0.8) => buddy(name, v, color, x, 0, z, s);
const gone = (...os) => os.forEach((o) => { if (!o) return; if (o.g) kill(o.g); else if (o.element) remove(o); else kill(o); });
const CPUC = '#4b9ee2', IOC = '#dd8238', WAITC = '#e3d3b6';
const PC = { P1: '#4b9ee2', P2: '#dd8238', P3: '#2fc092', P4: '#9b7ef4', P5: '#e55a9b', T1: '#d64545', T2: '#dd8238', T3: '#2fc092' };
// walk a buddy (or any object with .g / .position) to (x, z) on the floor
async function walk(tok, b, x, z, ms = 650) {
  const o = b.g || b; const a = o.position.clone(), e = V3(x, a.y, z);
  await anim(tok, ms, (u) => o.position.lerpVectors(a, e, u));
}
async function slide(tok, o, x, y, z = 0, ms = 600) { const a = o.position.clone(); await travel(tok, o, a, V3(x, y, z), ms); }
// a label that flies from a to b, then disappears unless keep
async function flyL(tok, kind, text, a, b, ms = 800, keep = false) {
  const l = tag(text, kind, a.x, a.y, a.z); await travel(tok, l, a, b, ms); if (!keep) remove(l); return l;
}
// a horizontal block that grows from x0 to x1 (bursts, timelines)
async function grow(tok, x0, x1, y, z, color, text, ms = 700, h = 0.5, d = 0.8) {
  const m = lab.box(color, [1, h, d]); m.scale.x = 0.001; m.position.set(x0, y, z); lab.world.add(m);
  if (text) { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
  await anim(tok, ms, (u) => { const w = Math.max(0.001, (x1 - x0) * u); m.scale.x = w; m.position.x = x0 + w / 2; });
  return m;
}
// a vertical bar that grows to height hgt
async function rise(tok, x, z, hgt, color, ms = 500, w = 0.55, d = 0.55) {
  const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m);
  await anim(tok, ms, (u) => { const v = Math.max(0.001, hgt * u); m.scale.y = v; m.position.y = v / 2; });
  return m;
}
// Gantt chart that grows one block per call: c.add(tok, id, s, e)
function chart(T, o = {}) {
  const W = o.w || 11, x0 = o.x0 === undefined ? -W / 2 : o.x0, z = o.z === undefined ? 1.8 : o.z, y = o.y === undefined ? 0.3 : o.y;
  const sx = W / T, col = o.color || ((id) => PC[id] || '#bfb3a0'), unit = o.unit || 1;
  const ticks = new Set(); const blocks = []; const parts = [];
  const fmtT = (t) => String(Math.round(t * unit * 100) / 100);
  const tickX = [];
  const tick = (t) => {
    if (ticks.has(t) || o.noTicks) return; ticks.add(t);
    const x = x0 + t * sx, near = tickX.some((p) => p.row === 0 && Math.abs(p.x - x) < 0.6); tickX.push({ x, row: near ? 1 : 0 });
    const l = sm(fmtT(t), x, y - 0.3, z + 0.7 + (near ? 0.5 : 0)); parts.push(l); return l;
  };
  if (o.title) parts.push(hd(o.title, x0 - 0.1, y + 0.1, z - 0.85));
  tick(0);
  return {
    sx, x0, z, y, blocks, xAt: (t) => x0 + t * sx, tick,
    async add(tok, id, s, e, ms = 650, color) {
      const m = await grow(tok, x0 + s * sx, x0 + e * sx, y, z, color || (id === null ? '#d8cfc0' : col(id)), (e - s) * sx > 0.42 ? (id === null ? 'idle' : id) : '', ms, 0.55, 0.85);
      tick(s); tick(e); blocks.push({ id, s, e, m }); return m;
    },
    // take the whole chart off the stage (blocks, ticks, title)
    clear() { blocks.forEach((b) => kill(b.m)); blocks.length = 0; parts.forEach((l) => remove(l)); parts.length = 0; },
  };
}
// FRAG scene from a list of steps: each step waits for its cue, then runs fn(tok, S)
function scene(id, title, cam, setup, steps) {
  FRAG.push([id, title, async (tok) => {
    fresh(cam[0], cam[1]);
    const S = setup ? setup() : {};
    for (const f of steps) { await step(tok); await f(tok, S); }
  }]);
}
const CAM = [[0, 6, 13], [0, 1.2, 0]];
const CAMG = [[0, 7, 12.5], [0, 1.2, 0.2]];
// A scheduling board: ready queue (buddies), a CPU, a Gantt chart below.
//   B.arrive(id, v) puts a buddy at the end of the queue; await B.run(tok, id, s, e) walks it to the CPU and grows its block;
//   await B.back(tok, id) returns it to the queue end; await B.done(tok, id) sends it off; B.set(id, v) changes its belly number.
function board(T, o = {}) {
  { const l = zone(o.qname || 'ready queue', -2.4, 0, -2.6, 7.6, 1.5).userData.name; l.center.set(1, 0.5); l.position.set(-6.35, 0.3, -2.6); }   // name just left of the queue's head, level with the buddies (never under their names or bars)
  const cpu = prop('cpu', 5.3, 0, -2.6, 0.9, 'CPU');
  const B = { G: chart(T, { z: o.gz === undefined ? 2.0 : o.gz, w: o.w || 11.4, x0: o.x0, title: o.title }), b: {}, q: [], cur: null, cpu };
  const qx = (k) => -5.6 + k * 1.2;
  B.arrive = (id, v = '', color) => { const b = pal(id, v, color || PC[id] || '#bfb3a0', qx(B.q.length), -2.6, 0.55); B.b[id] = b; B.q.push(id); return b; };
  B.layout = async (tok) => { for (let k = 0; k < B.q.length; k++) { const g = B.b[B.q[k]].g; if (Math.abs(g.position.x - qx(k)) > 0.01 || Math.abs(g.position.z + 2.6) > 0.01) await walk(tok, B.b[B.q[k]], qx(k), -2.6, 220); } };
  B.toCPU = async (tok, id) => { B.q = B.q.filter((x) => x !== id); B.cur = id; const b = B.b[id]; b.mood('happy'); b.glow('#3a2a00'); await walk(tok, b, b.g.position.x, -1.0, 180); await walk(tok, b, 5.3, -1.0, 420); b.glow(null); await B.layout(tok); };   // steps out of the queue first, so it never walks over the others' names
  B.run = async (tok, id, s, e, ms = 650) => { if (B.cur !== id) await B.toCPU(tok, id); return B.G.add(tok, id, s, e, ms); };
  B.back = async (tok, id) => { const b = B.b[id]; b.mood('sad'); B.q.push(id); B.cur = null; await walk(tok, b, qx(B.q.length - 1), -2.6, 450); };
  B.done = async (tok, id) => { const b = B.b[id]; if (!b) return; b.mood('happy'); await b.hop(tok); kill(b.g); delete B.b[id]; if (B.cur === id) B.cur = null; B.q = B.q.filter((x) => x !== id); };
  B.set = (id, v) => { if (B.b[id]) B.b[id].set(v); };
  return B;
}
// a small table panel (monospace) that can be rewritten row by row
function table(lines, x, y, z = -3.8, dy = 0.6) { const c = code(lines, x, y, dy, z); c.set = (i, s) => { if (c.ls[i]) txt(c.ls[i], s.padEnd(Math.max(...lines.map((l) => l.length)), ' ')); }; return c; }

// ════════ EpZgvKBf5eo（第 16C 講 Basic Concepts） ════════
scene('sch-16c-intro', '本章談什麼：CPU scheduling', CAM, () => ({}), [
  async (tok, S) => {                                   // 27 thread / process 都一樣：CPU 上的指令來自誰
    S.th = pal('thread', '', '#9b7ef4', -4.2, -1.2); S.pr = pal('process', '', '#2fc092', -1.8, -1.2);
    S.cpu = prop('cpu', 3.6, 0, -1.2, 1.2, 'CPU');
    bub('CPU 上的指令，要來自誰？', 0.2, 3.2);
    sayc('process scheduling', '決定 CPU 上的指令來自哪一個執行單位（thread 或 process）');
  },
  async (tok, S) => {                                   // 73 OS 有很多 scheduler：只談 CPU scheduler
    S.js = bx('job scheduler', '#d8cfc0', -4, 0.3, 2.0, 2.6); S.cs = bx('CPU scheduler', '#c9e3f6', 0, 0.3, 2.0, 2.6); S.ms = bx('midterm scheduler', '#d8cfc0', 4, 0.3, 2.0, 2.8);
    await wt(tok, 300); glow(S.cs, '#6a4a00'); hot('本章只談這個', 0, 1.2, 2.0);
    sayc('OS 有好幾種 scheduler', '這章只 focus 在 CPU scheduler');
  },
  async (tok, S) => {                                   // 96 所有演算法都分 preemptive / non-preemptive
    good('preemptive：可以中途打斷', -3, 0.4, 3.6); note('non-preemptive：不打斷', 3, 0.4, 3.6);
    sayc('每個演算法都分兩種', 'preemptive（能打斷）vs non-preemptive（不打斷）');
  },
  async (tok, S) => {                                   // 115 走過好幾個演算法；作業三在 Nachos 實作
    ['FCFS', 'SJF', 'Priority', 'RR', 'MLQ'].forEach((a, i) => sm(a, -4.8 + i * 2.4, 4.4, -2.4));
    sayc('接著會 go through 好幾個 scheduling algorithm', '作業三要在 Nachos 裡實作');
  },
  async (tok, S) => {                                   // 131 Linux、Solaris：真實 OS 混搭多種概念
    bub('Linux、Solaris：真實 OS 把好幾種演算法的概念混在一起', 0, 5.2, -2.4);
    sayc('最後看真實 OS', 'Linux、Solaris 的設計是把多種概念拼在一起');
  },
]);

scene('sch-16c-burst', 'CPU burst 與 I/O burst', CAM, () => ({}), [
  async (tok, S) => {                                   // 167 為什麼要 CPU scheduler？
    bub('為什麼需要 CPU scheduler？', 0, 3.6);
    sayc('為什麼要有 scheduler？', '');
  },
  async (tok, S) => {                                   // 177 multiprogramming：memory 裡塞很多 process
    zone('memory', -2.6, 0, -1.6, 7.0, 2.0).userData.name.position.set(1.1, 0.05, -1.6);   // name to the right of the zone, clear of the buddies' names
    S.ps = ['P1', 'P2', 'P3', 'P4', 'P5'].map((n, i) => pal(n, '', PC[n], -5.4 + i * 1.4, -1.6, 0.6));
    for (const p of S.ps) p.mood('happy');
    sayc('multiprogramming', '很多 process 同時放在 memory 裡，大家都 ready');
  },
  async (tok, S) => {                                   // 186 CPU core 有限
    S.cpu = prop('cpu', 4.6, 0, -1.6, 1.1, 'CPU（core 有限）');
    S.ps.forEach((p) => p.look(1));
    sayc('可是 CPU 的 core 是有限的', '一次只能有一個在上面跑');
  },
  async (tok, S) => {                                   // 189 scheduler 讓 CPU 不斷執行指令，提高使用率
    await walk(tok, S.ps[0], -5.4, -3.0, 200); await walk(tok, S.ps[0], 3.4, -3.0, 450); await walk(tok, S.ps[0], 4.6, -1.0, 250); S.ps[0].mood('wow');   // round the back of the line, not through the other names
    good('CPU 一直有事做 → 使用率高', 4.4, 2.6, -1.6);
    sayc('scheduler 的目的', '讓 CPU 不斷執行 instruction，增加使用率');
  },
  async (tok, S) => {                                   // 199 程式只有兩種行為：計算或做 I/O
    hd('程式只做兩件事：', -5.6, 0.3, 1.2); sm('計算（CPU）', -2.8, 0.3, 1.2); sm('做 I/O', -0.8, 0.3, 1.2);
    sayc('從 process 的角度', '它不是在做 I/O，就是在做計算');
  },
  async (tok, S) => {                                   // 224 CPU burst：一連串都在用 CPU cycle 的指令
    S.x = -5.8; await grow(tok, S.x, S.x + 2.0, 0.3, 2.6, CPUC, 'CPU burst', 700); S.x += 2.06;
    sayc('CPU burst', '一連串的 instruction 全部都在使用 CPU cycle');
  },
  async (tok, S) => {                                   // 236 I/O burst：一連串都在做 I/O
    await grow(tok, S.x, S.x + 1.6, 0.3, 2.6, IOC, 'I/O burst', 600); S.x += 1.66;
    sayc('I/O burst', '一連串的 instruction 都在做 I/O');
  },
  async (tok, S) => {                                   // 242 程式就在兩種 burst 之間交替
    for (const [w, c] of [[0.8, CPUC], [1.4, IOC], [1.5, CPUC], [1.1, IOC]]) { await grow(tok, S.x, S.x + w, 0.3, 2.6, c, '', 300); S.x += w + 0.06; }
    sayc('一下 CPU、一下 I/O', '整個程式就是 CPU burst 與 I/O burst 交替');
  },
  async (tok, S) => {                                   // 269 連續做 CPU 的指令合成一個 burst
    note('連續的 CPU 指令 = 同一個 burst → CPU 後面一定接 I/O', 0, 0.3, 3.8);
    sayc('CPU burst 之後一定接 I/O burst', '只要一直在用 CPU，就串成一個 single burst');
  },
  async (tok, S) => {                                   // 281 scheduler 只在乎 CPU burst；做 I/O 的去 waiting queue
    S.wq = zone('waiting queue（做 I/O）', -2.2, 0, -4.2, 4.0, 1.2, WAITC).userData.name; S.wq.center.set(1, 0.5); S.wq.position.set(-4.4, 0.05, -4.2);   // name left of the zone
    await walk(tok, S.ps[2], -2.2, -4.2, 700); S.ps[2].mood('calm');
    sayc('CPU scheduler care 的是 CPU burst', '在做 I/O burst 的 process 會被放到 waiting queue');
  },
  async (tok, S) => {                                   // 296 scheduler 看不見做 I/O 的程式
    S.ps[2].glow('#555555'); bad('scheduler 看不見它', -2.2, 1.6, -4.2);
    good('看得見：ready、等著開始 CPU burst 的', -2.6, 0.05, -0.3);
    sayc('scheduler 根本看不見在做 I/O 的程式', '只決定 ready 的人誰先開始 CPU burst');
  },
]);

scene('sch-16c-bound', 'CPU-bound vs I/O-bound 與 burst 分佈', [[0, 6.5, 13], [0, 1.4, 0]], () => ({}), [
  async (tok, S) => {                                   // 317 管理者要知道程式吃 CPU 還是吃 I/O
    S.admin = pal('管理者', '', '#c08a1f', -5.4, -2.6, 0.7);
    S.q = bub('這支程式吃 CPU 還是吃 I/O？', -3.2, 2.6, -2.6);
    sayc('tune 系統效能時', '都想知道程式是 CPU-bound 還是 I/O-bound');
  },
  async (tok, S) => {                                   // 346 卡在 CPU cycle 不夠，還是 disk / memory 太慢
    S.pc = prop('cpu', -0.6, 0, -2.6, 0.8, 'CPU 不夠快？'); S.pd = prop('disk', 3.4, 0, -2.6, 0.9, 'disk 太慢？');
    sayc('效能卡在哪裡？', 'CPU cycle 不夠，還是 disk、memory 這些 I/O 太慢');
  },
  async (tok, S) => {                                   // 365 CPU-bound：非常長的 CPU burst（for 迴圈 1 到 1 萬）
    hd('CPU-bound', -6.2, 0.2, -0.2);
    await grow(tok, -4.6, 3.4, 0.3, -0.2, CPUC, 'for (i=1; i<=10000; i++) i++;', 900);
    sayc('CPU-bound', '有非常非常長的 CPU burst：例如迴圈從 1 跑到 1 萬');
  },
  async (tok, S) => {                                   // 389 I/O-bound：沒有那種很長的 CPU burst
    hd('I/O-bound', -6.2, 0.2, 1.4);
    sayc('I/O-bound', '反過來，它沒有那種非常長的 CPU burst');
  },
  async (tok, S) => {                                   // 400 CPU 遠快於 I/O
    note('CPU 執行速度 ≫ I/O', 4.8, 0.3, -0.2);
    sayc('因為 CPU 遠比 I/O 快', '');
  },
  async (tok, S) => {                                   // 421 i++ 之後 fread、write：很短的 CPU burst
    let x = -4.6;
    for (let k = 0; k < 3; k++) { await grow(tok, x, x + 0.25, 0.3, 1.4, CPUC, '', 150); x += 0.3; await grow(tok, x, x + 1.9, 0.3, 1.4, IOC, k === 0 ? 'fread' : k === 1 ? 'write' : '', 250); x += 1.95; }
    sayc('例：i++ 後就 fread、再 write', 'CPU 的部分非常短，時間花在等 I/O');
  },
  async (tok, S) => {                                   // 476 例子：load / access memory、加減乘除 = CPU；wait for I/O = I/O
    sm('CPU：load、access memory、加減乘除', -2.4, 0.2, 3.0); sm('I/O：wait for I/O', 3.4, 0.2, 3.0);
    sayc('哪些是 CPU、哪些是 I/O', 'load memory、加減乘除是 CPU；等 I/O 是 I/O');
  },
  async (tok, S) => {                                   // 499 CPU burst 長度的 histogram
    gone(S.admin, S.q, S.pc, S.pd);
    S.Hb = []; const H = [4.2, 3.0, 1.9, 1.1, 0.7, 0.45, 0.3, 0.2, 0.15, 0.12];
    for (let k = 0; k < H.length; k++) S.Hb.push(await rise(tok, -4.2 + k * 0.6, -3.4, H[k] * 0.55, '#9b7ef4', 110, 0.45, 0.45));
    sm('burst 長度（ms）→（示意）', -1.4, 0, -2.7); sm('次數', -5.0, 2.6, -3.4);
    sayc('CPU burst 長度分佈（histogram）', '橫軸 burst 長度（ms），縱軸佔多少百分比');
  },
  async (tok, S) => {                                   // 526 幾乎所有 CPU burst 都非常短
    S.Hb.slice(0, 3).forEach((b) => glow(b, '#6a4a00'));
    sayc('幾乎所有 CPU burst 都非常非常短', '執行三四個指令就去做 I/O 了');
  },
  async (tok, S) => {                                   // 549 少數很長 → CPU-bound 程式
    S.Hb.slice(6).forEach((b) => glow(b, '#7a1010')); sm('少數很長 → CPU-bound', 1.6, 0.9, -3.4);
    sayc('只有少數很長的 burst', '有這種長 burst 的就是 CPU-bound 程式');
  },
  async (tok, S) => {                                   // 562 CPU 很快 → 大部分程式 bound 在 I/O → OS 載入很多程式
    good('大部分程式卡在 I/O → OS 放很多程式進 memory 輪流用 CPU', 0, 4.2, -2.6);
    sayc('現在 CPU 非常快', '大部分程式其實 bound 在 I/O，所以 OS 要載入一大堆程式');
  },
]);

scene('sch-16c-ready', 'CPU scheduler 只看 ready queue', [[0, 8.5, 9.5], [0, 0, -0.8]], () => ({ D: stateDiagram() }), [
  async (tok, S) => {                                   // 588 ready queue 裡誰可以進 running
    S.p = cube('P', '#e55a9b', [0.6, 0.5, 0.6], S.D.N.ready[0], 1.0, S.D.N.ready[1], 2);
    glow(S.D.node.ready, '#6a4a00'); glow(S.D.node.running, '#6a4a00');
    await wt(tok, 500); await slide(tok, S.p, S.D.N.running[0], 1.0, S.D.N.running[1], 700);
    sayc('CPU scheduler 決定', 'ready queue 裡誰可以進到 running state 使用 core');
  },
  async (tok, S) => {                                   // 602 進入 I/O burst：自己換到 waiting
    glow(S.D.node.ready, null); glow(S.D.node.running, null); glow(S.D.node.waiting, '#6a4a00');
    await slide(tok, S.p, S.D.N.waiting[0], 1.0, S.D.N.waiting[1], 700);
    sayc('進入 I/O burst', '它會強制自己換到 waiting state，跟 scheduler 無關');
  },
  async (tok, S) => {                                   // 614 還在做 I/O，不在 ready queue → scheduler 看不到
    S.no = bad('scheduler：看不到我', S.D.N.waiting[0], 1.8, S.D.N.waiting[1]);
    sayc('它還在做 I/O、還沒 ready', 'scheduler 在 ready queue 裡看不到它');
  },
  async (tok, S) => {                                   // 624 做完 I/O 回 ready queue，才會被考慮
    gone(S.no); glow(S.D.node.waiting, null); glow(S.D.node.ready, '#6a4a00');
    await slide(tok, S.p, S.D.N.ready[0], 1.0, S.D.N.ready[1], 700);
    sayc('I/O 做完回到 ready queue', 'scheduler 才會考慮要不要讓它執行');
  },
]);

const litE = (E, k, on = true) => { if (E[k] && E[k].t) E[k].t.element.className = 'lab-label ' + (on ? 'ptr alt' : 'idx'); };
scene('sch-16c-four', '四個 scheduling 時機', [[0, 8.5, 9.5], [0, 0, -0.8]], () => ({ D: stateDiagram() }), [
  async (tok, S) => {                                   // 642 preemptive / non-preemptive：什麼時機可以重新排程
    ['e1', 'e2', 'e3', 'e4'].forEach((k) => litE(S.D.E, k, false));
    bub('什麼時候可以做 rescheduling？', 0, 2.8, -3.6);
    sayc('preemptive / non-preemptive 的關鍵', 'scheduler 在什麼時機點可以重新選人');
  },
  async (tok, S) => {                                   // 657 從狀態轉換看，最多四個點
    sm('從 process 的狀態轉換來看，最多只有四個時機', 0, 0.3, -5.2);
    sayc('從 process 的 life cycle 來看', '可以做 scheduling 的點最多就四個');
  },
  async (tok, S) => {                                   // 670 ① running → waiting：去做 I/O
    S.p = cube('P', '#e55a9b', [0.6, 0.5, 0.6], S.D.N.running[0], 1.0, S.D.N.running[1], 0.4);
    await wt(tok, 300); await slide(tok, S.p, S.D.N.waiting[0], 1.0, S.D.N.waiting[1], 700); litE(S.D.E, 'e1');
    sayc('① running → waiting', '它做 I/O：CPU burst 結束，進入 I/O burst');
  },
  async (tok, S) => {                                   // 687 CPU 空了 → scheduler 被叫起來
    glow(S.D.node.running, '#7a1010'); S.em = bad('CPU 空了！叫 scheduler', S.D.N.running[0], 1.7, S.D.N.running[1]);
    sayc('CPU 空了', 'scheduler 被叫起來，看誰要下一個執行');
  },
  async (tok, S) => {                                   // 699 ② running → ready：time sharing 的 timer
    gone(S.em); glow(S.D.node.running, null); kill(S.p);
    S.p = cube('P', '#e55a9b', [0.6, 0.5, 0.6], S.D.N.running[0], 1.0, S.D.N.running[1], 0.4);
    S.tm = hot('⏰ timer（例如每 100 ms）', S.D.N.running[0], 0.2, S.D.N.running[1] + 1.5);
    await wt(tok, 300); await slide(tok, S.p, S.D.N.ready[0], 1.0, S.D.N.ready[1], 700); litE(S.D.E, 'e2');
    sayc('② running → ready', 'time sharing：timer 一到就把它 kick out 回 ready');
  },
  async (tok, S) => {                                   // 728 OS 重新掌控：可以選同一個人，也可以換人
    gone(S.tm); sm('OS 重新決定：可能選回同一個，也可能換別人', -1.0, 0.2, S.D.N.ready[1] + 1.6);
    sayc('OS 重新拿回掌控權', '可以選同一個人，也可以換別人');
  },
  async (tok, S) => {                                   // 740 ③ waiting → ready：新的 candidate
    kill(S.p); S.p = cube('P2', '#2fc092', [0.6, 0.5, 0.6], S.D.N.waiting[0], 1.0, S.D.N.waiting[1], 0.4);
    await wt(tok, 300); await slide(tok, S.p, S.D.N.ready[0] - 0.9, 1.0, S.D.N.ready[1], 700); litE(S.D.E, 'e3');
    sayc('③ waiting → ready', 'I/O 做完回來，ready queue 有新的 candidate，說不定很重要');
  },
  async (tok, S) => {                                   // 770 ④ running → terminate
    const q = cube('P', '#9b7ef4', [0.6, 0.5, 0.6], S.D.N.running[0], 1.0, S.D.N.running[1], 0.4);
    await wt(tok, 300); await slide(tok, q, S.D.N.term[0], 1.0, S.D.N.term[1], 700); litE(S.D.E, 'e4');
    sayc('④ running → terminate', '執行完了，當然要叫 scheduler 選下一個');
  },
]);

scene('sch-16c-preempt', 'Non-preemptive vs preemptive', CAMG, () => {
  const S = {};
  S.cpu = prop('cpu', 4.6, 0, -2.6, 0.9, 'CPU');
  const zl = zone('ready queue', -2.8, 0, -2.6, 5.2, 1.4).userData.name; zl.center.set(1, 0.5); zl.position.set(-5.5, 0.05, -2.9);   // name left of the zone, clear of the buddies
  S.P1 = pal('P1', '', PC.P1, 4.6, -1.1, 0.7);
  S.list = ['① running→waiting', '② running→ready', '③ waiting→ready', '④ terminate'].map((t, i) => sm(t, -5.2 + i * 3.3, 3.6, -3.8));
  return S;
}, [
  async (tok, S) => {                                   // 787 non-preemptive：不打斷 CPU burst 中間的人
    S.P1.mood('happy'); S.b = bub('我在 CPU burst 中間', 4.6, 2.4, -1.7);
    sayc('non-preemptive', '只要它還在一個 CPU burst 中間，就不要打斷它');
  },
  async (tok, S) => {                                   // 817 ① burst 已經結束 → non-preemptive 也會排程
    S.list[0].element.className = 'lab-label good';
    sayc('① running → waiting', 'CPU burst 已經結束 → non-preemptive 也會做 scheduling');
  },
  async (tok, S) => {                                   // 833 ④ terminate 也一樣
    S.list[3].element.className = 'lab-label good';
    sayc('④ terminate', '整個做完了，當然也會做 scheduling');
  },
  async (tok, S) => {                                   // 843 non-preemptive 只在 ① ④
    note('non-preemptive：只有 ① ④', -3.0, 4.4, -3.8);
    sayc('non-preemptive 只在 ① 和 ④ 兩種情況', '才會做 scheduling');
  },
  async (tok, S) => {                                   // 852 preemptive：①②③④ 全部
    S.list[1].element.className = 'lab-label ptr alt'; S.list[2].element.className = 'lab-label ptr alt';
    hot('preemptive：① ② ③ ④ 全部', 3.0, 4.4, -3.8);
    sayc('preemptive', '只要有可能改變決定的時間點，就重新 scheduling');
  },
  async (tok, S) => {                                   // 868 情況 ②：timer 到，preemptive 可能選別人
    gone(S.b); S.t = hot('⏰ timer', 4.6, 2.6, -2.6);
    S.P3 = pal('P3', '', PC.P3, -2.0, -2.6, 0.6);
    await walk(tok, S.P1, -4.2, -2.6, 650); S.P1.mood('sad'); await walk(tok, S.P3, 4.6, -1.1, 650); S.P3.mood('happy');
    sayc('情況 ②（timer）+ preemptive', 'P1 被 kick out 回 ready queue，換別人跑');
  },
  async (tok, S) => {                                   // 903 non-preemptive：知道它還沒做完，馬上放回 running
    await walk(tok, S.P3, -2.0, -2.6, 500); await walk(tok, S.P1, 4.6, -1.1, 600); S.P1.mood('happy'); gone(S.t);
    sayc('同樣情況換成 non-preemptive', '知道 P1 還沒做完，馬上把它放回 running');
  },
  async (tok, S) => {                                   // 924 情況 ③：P2 從 waiting 回到 ready，priority 更高 → preemptive 打斷 P1
    S.Gp = chart(10, { z: 0.6, title: 'preemptive（示意：P1 burst 7；P2 在 t=3 回來、burst 3）', w: 10, x0: -5 });
    await S.Gp.add(tok, 'P1', 0, 3, 400);
    S.P2 = pal('P2', 'pri 高', PC.P2, -0.4, -2.6, 0.6); S.P2.mood('wow');
    await S.Gp.add(tok, 'P2', 3, 6, 400); await S.Gp.add(tok, 'P1', 6, 10, 400);
    sayc('情況 ③ + preemptive', 'P2 回到 ready 且 priority 較高 → P1 直接讓開');
  },
  async (tok, S) => {                                   // 959 non-preemptive：ignore，等 P1 跑完再說
    S.Gn = chart(10, { z: 4.0, title: 'non-preemptive', w: 10, x0: -5 });
    await S.Gn.add(tok, 'P1', 0, 7, 500); await S.Gn.add(tok, 'P2', 7, 10, 400);
    sayc('情況 ③ + non-preemptive', '雖然來了更重要的人，還是讓 P1 跑完再說');
  },
  async (tok, S) => {                                   // 987 判斷：Gantt 上 CPU burst 畫到一半就換人 → preemptive
    S.Gp.blocks.filter((b) => b.id === 'P1').forEach((b) => glow(b.m, '#7a1010'));
    bad('P1 的 burst 被切成兩段 → preemptive', 4.2, 1.0, 0.6);
    sayc('最好判斷的方法', 'Gantt chart 上 CPU burst 畫到一半就換人 → preemptive');
  },
  async (tok, S) => {                                   // 1011 一定要整段跑完才換 → non-preemptive
    glow(S.Gn.blocks[0].m, '#0f5a3a'); good('每段都剛好是完整的 burst → non-preemptive', 2.7, 0.4, 3.15);
    sayc('一定要把整個 CPU burst run 完才換人', '就是 non-preemptive');
  },
]);

scene('sch-16c-sync', 'Preemptive 的代價：synchronization', CAM, () => ({}), [
  async (tok, S) => {                                   // 1037 preemptive 效能通常比較好
    S.m = bx('count = 5', '#c9b48e', 0, 0.4, -2.6, 2.6, 0, 0.8, 1.2); sm('shared memory（示意）', 0, 1.15, -2.6);
    S.P1 = pal('P1', '', PC.P1, -4.2, 0.6, 0.75); S.P2 = pal('P2', '', PC.P2, 4.2, 0.6, 0.75);
    good('preemptive：效能通常比較好', 0, 3.4, -2.6);
    sayc('preemptive 的效能通常比較好', '因為它比較 dynamic');
  },
  async (tok, S) => {                                   // 1052 時機 4 個 vs 2 個：superset
    sm('可排程時機：4 個 ⊇ 2 個（superset）→ CPU 使用率更高', 0, 2.7, -2.6);
    sayc('可以 schedule 的時間點比較多', '四個 vs 兩個，是 superset');
  },
  async (tok, S) => {                                   // 1074 缺點：burst 執行到一半打斷 → synchronization
    S.r1 = hd('reg = 5', -4.2, 2.0, 0.6); S.P1.glow('#6a4a00');
    await flyL(tok, 'pkt', '讀 5', V3(0, 1.0, -2.2), V3(-4.2, 1.4, 0.6), 500);
    S.P1.glow(null); txt(S.r1, 'reg = 5（被打斷！）'); S.P1.mood('wow');
    await flyL(tok, 'pkt', 'count++', V3(4.2, 1.4, 0.6), V3(0, 1.0, -2.2), 500); txt(S.m.userData.lbl, 'count = 6');
    await wt(tok, 200); await flyL(tok, 'pkt', '寫回 6', V3(-4.2, 1.4, 0.6), V3(0, 1.0, -2.2), 500);
    glow(S.m, '#7a1010'); bad('兩次 ++ 只變 6：結果錯了（第 6 章詳談）', 0, 2.0, -2.6);
    sayc('CPU burst 跑到一半被打斷', '兩邊都改同一塊 data → synchronization 問題');
  },
  async (tok, S) => {                                   // 1104 只有 CPU burst 會碰 memory
    note('只有 CPU burst 會 access memory；burst 做完就不碰了', 0, 0.3, 3.0);
    sayc('synchronization 只發生在 memory', 'CPU burst 整段做完再換人，就不會有這問題');
  },
  async (tok, S) => {                                   // 1128 programmer 要自己去解
    S.P1.mood('sad');
    sayc('CPU burst 中途被打斷', 'programmer 就得自己去解 synchronization，很花時間');
  },
  async (tok, S) => {                                   // 1143 kernel 自己的程式也會被打斷
    S.k = pal('kernel', '', '#5c7a4a', 0, 1.6, 0.75); S.k.mood('wow');
    sayc('不只 user 程式', 'kernel 自己的程式也是 scheduler 排的 process 之一');
  },
  async (tok, S) => {                                   // 1167 解法一：kernel 裡自己 lock / unlock
    prop('lock', -2.4, 0, 1.8, 0.9); sm('解法一：碰 shared data 就 lock / unlock（很囉嗦）', -2.4, 0.2, 4.2);
    sayc('解法一：kernel 程式自己做 lock / unlock', 'OS 會變得很複雜');
  },
  async (tok, S) => {                                   // 1193 解法二（Linux）：跑 kernel 時把 timer interrupt disable
    hot('解法二：跑 kernel 時 disable timer interrupt', 3.0, 1.2, 3.4); S.k.mood('happy');
    sayc('解法二（老師說的常見作法）', '執行 kernel 程式時，把 timer interrupt disable');
  },
  async (tok, S) => {                                   // 1213 kernel 沒有 time sharing → 變成 non-preemptive，一次做完
    S.k.glow('#0f5a3a'); good('kernel 一口氣做完 = non-preemptive', 5.4, 2.7, 1.6);
    sayc('kernel 在跑時就沒有 time sharing', 'scheduler 對它來說變成 non-preemptive');
  },
  async (tok, S) => {                                   // 1255 一般 OS：preemptive + 這個 trick
    sm('一般 OS：preemptive scheduler ＋ kernel 執行時關 timer', 0, 4.4, -2.6);
    sayc('大部分 OS 的 trick', '用 preemptive，但 kernel 執行時不讓它被打斷');
  },
  async (tok, S) => {                                   // 1267 kernel code 要精簡，否則系統變慢
    bad('kernel code 又臭又長 → interrupt 被關太久 → 系統反應變慢', 0, 5.2, -2.6);
    sayc('所以 kernel programming 要寫得精簡', '不然很多 interrupt 被 disable，整個系統變慢');
  },
]);

scene('sch-16c-dispatch', 'Scheduler 選人、dispatcher 換人', CAM, () => {
  const S = {};
  S.sch = bx('scheduler', '#9b7ef4', -4.4, 0.35, -2.2, 2.2, 0, 0.7, 1.1);
  S.cpu = prop('cpu', 4.6, 0, -2.2, 1.0, 'CPU');
  S.P1 = pal('P1', '', PC.P1, 4.6, -1.2, 0.6); S.P2 = pal('P2', '', PC.P2, -4.4, 0.9, 0.6);
  return S;
}, [
  async (tok, S) => {                                   // 1289 scheduler：選下一個要執行的人
    glow(S.sch, '#6a4a00'); S.P2.glow('#6a4a00'); bub('下一個：P2', -4.4, 1.6, -2.2);
    sayc('scheduler 的目的', '選誰要做下一個執行');
  },
  async (tok, S) => {                                   // 1295 還有 dispatcher
    S.dis = bx('dispatcher', '#2fc092', 0, 0.35, -2.2, 2.2, 1.5, 0.7, 1.1);
    sayc('除了 scheduler 之外', 'OS 裡還有一個 dispatcher');
  },
  async (tok, S) => {                                   // 1304 scheduler 把決定告訴 dispatcher，由它換人
    await flyL(tok, 'pkt', '決定：P2', V3(-4.4, 1.2, -2.2), V3(0, 1.2, -2.2), 700); glow(S.sch, null); glow(S.dis, '#6a4a00');
    sayc('scheduler 只負責選', '選好把決定告訴 dispatcher，由它執行換人');
  },
  async (tok, S) => {                                   // 1315 context switch 是 dispatcher 的工作
    bx('PCB1', '#c08a1f', 2.4, 0.2, 1.4, 1.1, 1.5, 0.4, 0.8);
    await walk(tok, S.P1, 2.4, 0.6, 600);
    sayc('之前學的 context switch', '就是 dispatcher 這個 module 底下的動作：先存 P1 的 state');
  },
  async (tok, S) => {                                   // 1328 載入新的 state：PC、page table pointer
    sm('載入 P2 的 state：program counter、page table pointer…', 0, 0.2, 3.0);
    await walk(tok, S.P2, 4.6, -1.2, 800); S.P2.mood('happy'); S.P2.glow(null);
    sayc('換成新的 process', '把它的 program counter、page table pointer 等 state 載入');
  },
  async (tok, S) => {                                   // 1357 dispatcher 也要花時間，主要在 context switch
    await grow(tok, -2.0, 2.0, 0.2, 3.9, '#d64545', 'dispatch latency', 700, 0.3, 0.5);
    sayc('dispatcher 也要花時間', '主要花在 context switch：叫 dispatch latency');
  },
  async (tok, S) => {                                   // 1365 還有 interrupt enable / disable
    sm('＋ interrupt 的 enable / disable', 4.0, 0.2, 3.9);
    sayc('另外還有', 'interrupt 的 enable / disable');
  },
  async (tok, S) => {                                   // 1369 作業三 trace：呼叫 scheduler 前先 disable timer
    S.c = code(['// 作業三 trace code 會看到的順序（示意）', '1. 先 disable timer interrupt', '2. 叫 scheduler 選下一個', '3. dispatch：context switch'], -2.6, 5.4, 0.5, -3.6);
    S.c.hl(1);
    sayc('作業三 trace code', '做 context switch、叫 scheduler 之前，會先把 timer disable');
  },
  async (tok, S) => {                                   // 1389 dispatcher 是比較大的 component：呼叫 scheduler 再 dispatch
    S.c.hl(3); glow(S.sch, '#6a4a00');
    sayc('dispatcher 是比較大的 component', '它會 call scheduler 做 scheduling，再做 dispatch');
  },
]);

// ════════ n2o_WL62D4Q（第 16D 講 Scheduling Algorithms） ════════
scene('sch-16d-metrics', '衡量排程好壞：utilization、throughput、三種時間', CAMG, () => ({}), [
  async (tok, S) => {                                   // 16 介紹演算法前，先問目標是什麼
    S.q = bub('排程的目標是什麼？用什麼來比好壞？', 0, 3.6, -1);
    sayc('介紹演算法之前', '先知道目的：用什麼 performance metric 衡量');
  },
  async (tok, S) => {                                   // 43 幾種 performance metrics
    gone(S.q);
    S.m = ['CPU utilization', 'throughput', 'turnaround time', 'waiting time', 'response time'].map((t, i) => sm(t, -5.2 + i * 2.6, 4.6, -3.6));
    sayc('幾種不同的 performance metrics', '用來衡量 scheduling 好不好');
  },
  async (tok, S) => {                                   // 52 CPU utilization：top / 工作管理員
    S.m[0].element.className = 'lab-label ptr alt';
    S.back = bx('', '#e9e1d2', -3.2, 0.2, -2.0, 5.0, 0, 0.3, 0.5); hd('CPU 使用率', -6.2, 0.3, -2.0);
    S.fill = await grow(tok, -5.7, -4.2, 0.22, -2.0, '#2fc092', '', 600, 0.32, 0.55); S.pct = sm('30%：很低又覺得電腦慢 → OS 管理有問題', -3.2, 0.9, -2.0);
    sayc('CPU utilization', 'Linux 的 top、Windows 的工作管理員都看得到');
  },
  async (tok, S) => {                                   // 84 理論 0～100，一般 40～90
    await anim(tok, 700, (u) => { const w = 1.5 + 3.0 * u; S.fill.scale.x = w; S.fill.position.x = -5.7 + w / 2; });
    txt(S.pct, '一般系統 40%～90%；90% 已經算很高');
    sayc('理論上 0～100%', '大部分系統是 40～90%');
  },
  async (tok, S) => {                                   // 99 throughput：單位時間完成的工作量
    S.m[1].element.className = 'lab-label ptr alt';
    zone('完成區', 4.2, 0, -2.0, 3.2, 1.4, '#d6ead8').userData.name.position.set(5.9, 0.05, -2.0);   // name right of the zone, clear of the boxes
    sayc('throughput', 'CPU 忙不代表在做有意義的事：看每單位時間完成多少工作');
  },
  async (tok, S) => {                                   // 128 例：丟 100 個 process，每秒平均完成幾個
    for (let k = 0; k < 4; k++) { const c = bx('P', PC['P' + (k + 1)], 1.4, 0.3, -2.0, 0.5, 0, 0.4, 0.5); await slide(tok, c, 3.2 + k * 0.6, 0.3, -2.0, 280); }
    S.tp = hd('throughput = 每秒完成幾個 process', 4.2, 1.2, -2.0);
    sayc('例：丟進 100 個 process', '每秒鐘平均能「執行完」幾個 process');
  },
  async (tok, S) => {                                   // 153 跟 workload 有關，只能同輸入互相比
    S.wl = note('process 都很大 → throughput 自然小；只能「同樣輸入」比較不同電腦', 0, 0.3, -0.4);
    sayc('input workload 不同，數值就不同', '沒有像 0～100 的絕對標準，只能拿來比較');
  },
  async (tok, S) => {                                   // 184 三個跟 CPU scheduler 最有關的時間
    gone(S.wl); [2, 3, 4].forEach((i) => { S.m[i].element.className = 'lab-label ptr alt'; });
    S.G = chart(10, { z: 2.4, w: 10, x0: -5, title: '一個 job 的一生（示意）' });
    sayc('接下來三個時間', '跟 CPU scheduler 關係最密切、也最容易計算');
  },
  async (tok, S) => {                                   // 199 turnaround time：submit 到整個做完
    for (const [id, s, e, c] of [['ready', 0, 2, '#d8cfc0'], ['CPU', 2, 4, CPUC], ['I/O', 4, 6, IOC], ['ready', 6, 7, '#d8cfc0'], ['CPU', 7, 9, CPUC]]) await S.G.add(tok, id, s, e, 220, c);
    await grow(tok, S.G.xAt(0), S.G.xAt(9), 1.3, 2.4, '#9b7ef4', 'turnaround = 9', 600, 0.14, 0.14);
    sayc('turnaround time', '從 submit 進去，到整個 process 結束的時間（越短越好）');
  },
  async (tok, S) => {                                   // 233 waiting time：待在 ready queue 的總時間
    S.G.blocks.filter((b) => b.id === 'ready').forEach((b) => glow(b.m, '#7a1010'));
    sm('waiting = 2 + 1 = 3（只算 ready queue，不算 I/O）', 0, 0, 4.3);
    sayc('waiting time', '能做卻因為別人在用 CPU 而在 ready queue 等的時間總和');
  },
  async (tok, S) => {                                   // 291 response time：submit 到第一個 CPU burst 開始
    await grow(tok, S.G.xAt(0), S.G.xAt(2), 1.8, 2.4, '#2fc092', 'response = 2', 500, 0.14, 0.14);
    sayc('response time', '從 submit 到第一個 CPU burst 開始執行（first response）');
  },
  async (tok, S) => {                                   // 318 response 只看第一次；waiting 要把每次等的都加起來
    note('response 只看第一次；waiting 把所有 burst 前等的都加起來 → 兩者不同', 0, 0, 5.4);
    sayc('程式有好幾個 CPU burst', 'response 只看第一次，waiting 算全部在 ready queue 的時間');
  },
  async (tok, S) => {                                   // 358 interactive 最重視 response time
    S.u = pal('使用者', '', '#c08a1f', 5.6, 0.2, 0.6); S.u.mood('happy'); bub('有回應了！', 5.6, 1.5, 0.2);
    sayc('interactive 的系統', '最重視 response time：一有回應就覺得它在動了');
  },
  async (tok, S) => {                                   // 373 waiting time：Shortest Job First 可證明最短
    good('平均 waiting time：Shortest Job First 理論上可證明最小（optimal）', 0, 5.4, -3.6);
    sayc('waiting time 有 optimal 的演算法', 'Shortest Job First 可以理論證明最短');
  },
  async (tok, S) => {                                   // 398 用後面三個來比較演算法
    S.m.slice(0, 2).forEach((m) => { m.element.className = 'lab-label idx'; });
    sayc('比較演算法時', '看 turnaround、waiting、response：這三個是單一 job 的角度');
  },
]);

scene('sch-16d-fcfs', 'FCFS：24、3、3 與 convoy', CAMG, () => {
  const S = {};
  S.t = table(['P    burst', 'P1     24', 'P2      3', 'P3      3', '（都在 0 到達）'], -6.0, 5.4, -3.8);
  return S;
}, [
  async (tok, S) => {                                   // 425 First come first serve：最直覺
    S.B = board(30, { title: 'FCFS Gantt chart' });
    sayc('first come, first serve', '先來的先做，最直覺');
  },
  async (tok, S) => {                                   // 435 input：ready queue 裡的 process 與 burst time
    S.B.arrive('P1', 24); S.B.arrive('P2', 3); S.B.arrive('P3', 3);
    S.t.hl(0);
    sayc('scheduler 的 input', 'ready queue 裡有哪些 process，以及各自這次的 burst time');
  },
  async (tok, S) => {                                   // 465 P1 只寫 24：真實程式有好幾個 burst，這裡只看一個
    S.t.hl(1);
    S.n1 = note('真實程式有好幾個 CPU burst，這裡只模擬「當下這一個」', 0, 0.3, 4.2);
    sayc('P1 只寫 24', '真實程式有很多 burst，這裡簡化成只看一個');
  },
  async (tok, S) => {                                   // 529 P1 先來 → 先執行 0～24
    await S.B.run(tok, 'P1', 0, 24, 1100);
    sayc('雖然都是 0 秒到，P1 稍微早一點', '所以 P1 先執行，到 24');
  },
  async (tok, S) => {                                   // 538 non-preemptive：P1 做完才 P2、P3
    await S.B.done(tok, 'P1'); await S.B.run(tok, 'P2', 24, 27, 400); await S.B.done(tok, 'P2'); await S.B.run(tok, 'P3', 27, 30, 400); await S.B.done(tok, 'P3');
    sayc('P1 執行完，P2 才能執行', '然後才是 P3');
  },
  async (tok, S) => {                                   // 545 FCFS：preemptive 或 non-preemptive 結果一樣
    gone(S.n1); S.n2 = note('FCFS：preemptive / non-preemptive 結果一樣（先來的 priority 不變）', 0, 0.3, 4.2);
    sayc('對 FCFS 來說', '就算可以打斷也不會打斷：先來的永遠先做');
  },
  async (tok, S) => {                                   // 573 waiting time：P1 0、P2 24、P3 27
    S.w = [sm('WT 0', S.B.G.xAt(12), 1.3, 2.0), sm('WT 24', S.B.G.xAt(25.5), 1.3, 2.0), sm('WT 27', S.B.G.xAt(28.5), 1.8, 2.0)];
    S.t.set(0, 'P    burst  WT'); S.t.set(1, 'P1     24   0'); S.t.set(2, 'P2      3  24'); S.t.set(3, 'P3      3  27');
    sayc('waiting time', 'P1 一開始就執行 = 0；P2 = 24；P3 = 27');
  },
  async (tok, S) => {                                   // 589 平均 = 17
    S.avg = hot('平均 WT = (0 + 24 + 27) / 3 = 17', 3.6, 4.6, -3.8);
    sayc('average waiting time', '(0 + 24 + 27) / 3 = 17');
  },
  async (tok, S) => {                                   // 597 response：0、24、27（只有一個 burst 時跟 WT 一樣）
    sm('response time 也是 0、24、27', 3.6, 4.0, -3.8);
    sayc('response time', '這裡也是 0、24、27');
  },
  async (tok, S) => {                                   // 633 若 P1 後面還有 I/O 4 秒再回來：WT 只算 2
    gone(S.n2); S.G2 = chart(34, { z: 5.3, w: 11.4, title: '若 P1 還有第二個 burst（第二段長度示意）' });
    await S.G2.add(tok, 'P1', 0, 24, 400); await S.G2.add(tok, 'I/O 4', 24, 28, 300, IOC); await S.G2.add(tok, '等', 28, 30, 300, '#d64545'); await S.G2.add(tok, 'P1', 30, 33, 300);
    sayc('P1 做完 24 去做 I/O 4 秒，28 回來', '要等到 30 才能跑：等了 30 − 24 − 4 = 2，不是 6');
  },
  async (tok, S) => {                                   // 684 這裡只有一個 burst，所以 WT = RT
    S.n3 = sm('只模擬一個 burst → waiting time 剛好等於 response time', 0, -0.6, 6.0);
    sayc('I/O 的時間不算 waiting', '這例子只有一個 burst，所以 WT 剛好等於 RT');
  },
  async (tok, S) => {                                   // 701 FCFS 很糟：一開始跑大的，後面全部從 24 起跳
    S.B.G.blocks[0] && glow(S.B.G.blocks[0].m, '#7a1010');
    bad('一開始跑大的 → 後面的 wait 都從 24 起跳（convoy effect）', 0, 2.0, 0.4);
    sayc('若要減少 average wait time，FCFS 很糟', '一開始 run 一個很大的 process，後面全部陪著等');
  },
  async (tok, S) => {                                   // 745 換順序 P2、P3、P1 → 平均 3
    S.G2.clear(); gone(S.n3); S.G3 = chart(30, { z: 5.3, w: 11.4, title: '換成 P2、P3、P1 的順序' });
    await S.G3.add(tok, 'P2', 0, 3, 300); await S.G3.add(tok, 'P3', 3, 6, 300); await S.G3.add(tok, 'P1', 6, 30, 700);
    txt(S.avg, '平均 WT：17 → (0 + 3 + 6) / 3 = 3');
    sayc('同樣都是 0 秒來，只是 P2、P3 先進來', '平均 wait time 大幅減少到 3');
  },
  async (tok, S) => {                                   // 769 FCFS 沒有 intelligence，看運氣
    bad('FCFS 沒有 intelligence：表現全看到達順序（運氣）', 3.6, 3.4, -3.8);
    sayc('FCFS 沒有 intelligence', '就看運氣：input 一開始是長的，wait time 就很久');
  },
]);

scene('sch-16d-sjf', 'SJF（non-preemptive）：P1 7、P2 4、P3 1、P4 4', CAMG, () => {
  const S = {};
  S.t = table(['P   arr burst', 'P1   0    7', 'P2   2    4', 'P3   4    1', 'P4   5    4'], -6.2, 5.4, -3.8);
  return S;
}, [
  async (tok, S) => {                                   // 788 要最短 average wait：讓最短的先
    S.a = bx('長 6', '#bfb3a0', -2.6, 0.3, -0.6, 2.4, 0, 0.5, 0.7); S.b = bx('短 2', '#2fc092', 0.6, 0.3, -0.6, 0.8, 0, 0.5, 0.7);
    S.c1 = sm('長的先：短的等 6', -1.0, 0.9, -0.6);
    sayc('要得到最短的 average wait time', '就讓最短的先做');
  },
  async (tok, S) => {                                   // 799 swapping 證明：任何交換只會變大或相同
    await anim(tok, 700, (u) => { S.a.position.x = -2.6 + 1.6 * u; S.b.position.x = 0.6 - 4.0 * u; });
    txt(S.c1, '短的先：長的只等 2 → 總等待變小');
    sayc('可以用 swapping 證明', '把短的換到前面，總等待只會變小或相同');
  },
  async (tok, S) => {                                   // 811 Shortest Job First：理論上 average wait 最小
    gone(S.a, S.b, S.c1);
    good('Shortest Job First：average waiting time 理論上 minimal', 3.8, 4.6, -3.8);
    sayc('shortest job first', '目的就是 minimize wait time，最短的先執行');
  },
  async (tok, S) => {                                   // 835 preemptive 與 non-preemptive 結果可能不同
    note('到達時間不同時，preemptive / non-preemptive 結果會不一樣', 3.8, 4.0, -3.8);
    sayc('SJF 要注意是哪一種', 'process 到達時間不同時，preemptive 跟 non-preemptive 結果不同');
  },
  async (tok, S) => {                                   // 856 各自的 optimum；preemptive 的 ≤ non-preemptive
    sm('preemptive 的最佳平均 WT ≤ non-preemptive 的（機會更多）', 3.8, 3.4, -3.8);
    sayc('optimal 在兩種裡面都成立', 'preemptive 的 optimum 一定 ≤ non-preemptive');
  },
  async (tok, S) => {                                   // 877 例子：到達時間不同，只看一個 burst
    S.t.hl(0);
    S.B = board(16, { title: 'SJF（non-preemptive）' });
    sayc('稍微複雜的例子', '四個 job，到達時間不一樣，一樣只看一個 CPU burst');
  },
  async (tok, S) => {                                   // 894 t=0 只有 P1 → 沒得選，一次做完 7
    S.B.arrive('P1', 7); S.t.hl(1);
    await S.B.run(tok, 'P1', 0, 7, 900);
    S.B.arrive('P2', 4); S.B.arrive('P3', 1); S.B.arrive('P4', 4);
    sayc('一開始只有 P1：雖然 7 最長，也只能執行它', 'non-preemptive：一執行就做完，花到 7');
  },
  async (tok, S) => {                                   // 926 t=7：P2、P3、P4 都在，選最短 P3
    await S.B.done(tok, 'P1'); S.t.hl(3);
    await S.B.run(tok, 'P3', 7, 8, 400);
    sayc('到了 7 才有機會做 scheduling', '這時 2、3、4 都在 ready queue → 選最短的 P3（1）');
  },
  async (tok, S) => {                                   // 941 剩 P2、P4（都是 4）：tie，誰先都可以
    await S.B.done(tok, 'P3'); S.t.hl(2);
    await S.B.run(tok, 'P2', 8, 12, 500); await S.B.done(tok, 'P2'); await S.B.run(tok, 'P4', 12, 16, 500); await S.B.done(tok, 'P4');
    sayc('剩 P2 跟 P4，一樣都是 4', 'tie breaker：誰先都可以（這裡 P2 先）');
  },
  async (tok, S) => {                                   // 958 waiting time：P1 0；P3 = 7 − 4 = 3
    S.t.set(0, 'P   arr burst  WT'); S.t.set(1, 'P1   0    7   0'); S.t.set(3, 'P3   4    1   3  (7−4)');
    sayc('wait time = 在 ready queue 的時間', 'P1 是 0；P3 第 7 秒才開始，但第 4 秒才來 → 3');
  },
  async (tok, S) => {                                   // 1000 平均 = 4：non-preemptive 裡最小
    S.t.set(2, 'P2   2    4   6  (8−2)'); S.t.set(4, 'P4   5    4   7  (12−5)');
    hot('平均 WT = (0 + 6 + 3 + 7) / 4 = 4', 3.8, 2.8, -3.8);
    sayc('平均就是 4', 'CPU 不空等的 non-preemptive 排法裡，沒有比 4 更小的');
  },
  async (tok, S) => {                                   // 1016 不代表最好：可能犧牲 response / turnaround
    note('最小的只是「平均 waiting time」，可能犧牲 response、turnaround', 0, 0.3, 4.2);
    sayc('這不代表這個 algorithm 是最好', '它可能犧牲掉 response time 或 turnaround time');
  },
  async (tok, S) => {                                   // 1039 response：P2 第 8 秒才執行，2 進來 → 6
    sm('response：P1 0、P2 8 − 2 = 6 …', 3.8, 2.2, -3.8);
    sayc('response time', 'P1 是 0；P2 第 8 秒才開始、2 進來 → 等了 6');
  },
  async (tok, S) => {                                   // 1053 看系統需求選演算法
    good('看系統要 minimize 哪個 metric，再選演算法', 0, 0.3, 5.0);
    sayc('有些系統要 minimize response time', '看系統需求選不同的演算法');
  },
]);

scene('sch-16d-srtf', 'Preemptive SJF：平均 WT 3', CAMG, () => {
  const S = {};
  S.t = table(['P   arr burst', 'P1   0    7', 'P2   2    4', 'P3   4    1', 'P4   5    4'], -6.2, 5.4, -3.8);
  S.B = board(16, { title: 'SJF（preemptive，又叫 SRTF）　肚子上的數字 = 剩餘時間' });
  return S;
}, [
  async (tok, S) => {                                   // 1078 再跑一次，這次用 preemptive
    sayc('同一組再跑一次', '這次用 preemptive：可以打斷');
  },
  async (tok, S) => {                                   // 1084 一開始只有 P1
    S.B.arrive('P1', 7);
    await S.B.run(tok, 'P1', 0, 2, 600); S.B.set('P1', 5);
    sayc('一開始一樣是空的', '把 P1 放下去執行');
  },
  async (tok, S) => {                                   // 1091 t=2：P2 來了；4 < P1 剩 5 → preempt
    S.B.arrive('P2', 4); S.t.hl(2);
    S.c = hot('t=2：P2 要 4 < P1 剩 5 → 打斷 P1', 0.6, 1.9, -2.6);
    await S.B.back(tok, 'P1'); await S.B.run(tok, 'P2', 2, 4, 600); S.B.set('P2', 2);
    sayc('第 2 秒 P2 進來', 'P2 只要 4，P1 剩 5 → preemption：P1 的 CPU burst 被砍一半');
  },
  async (tok, S) => {                                   // 1131 P1 剩下 5，不是原來的 7
    S.B.b.P1.mood('calm'); sm('P1 剩 5（不是 7）', -5.6, 1.4, -2.6);
    sayc('不要忘記 P1 只剩下 5', '不是原來的 7');
  },
  async (tok, S) => {                                   // 1137 t=4：P3 只要 1 < P2 剩 2 < P1 剩 5 → 又打斷
    S.B.arrive('P3', 1); S.t.hl(3);
    txt(S.c, 't=4：P3 要 1 < P2 剩 2 < P1 剩 5');
    await S.B.back(tok, 'P2'); await S.B.run(tok, 'P3', 4, 5, 500); await S.B.done(tok, 'P3');
    sayc('第 4 秒 P3 進來，burst 只有 1', '1 < 2 < 5 → 又 preempt，把 P2 打斷');
  },
  async (tok, S) => {                                   // 1169 t=5：P4 來（4）；P3 做完；P2 剩 2 最短 → P2
    S.B.arrive('P4', 4); S.t.hl(4);
    txt(S.c, 't=5：P4 要 4；P2 剩 2 最短 → P2');
    await S.B.run(tok, 'P2', 5, 7, 500); await S.B.done(tok, 'P2');
    sayc('第 5 秒 P4 進來（4），P3 剛好做完', 'P2 只剩兩個 cycle 最短 → P2 先做完');
  },
  async (tok, S) => {                                   // 1192 然後 P4，再 P1
    txt(S.c, 'P4（4）< P1（5）→ P4，最後 P1');
    await S.B.run(tok, 'P4', 7, 11, 500); await S.B.done(tok, 'P4'); await S.B.run(tok, 'P1', 11, 16, 500); await S.B.done(tok, 'P1');
    sayc('P2 做完再 P4', '最後才輪到 P1');
  },
  async (tok, S) => {                                   // 1203 顏色亂掉 = preemption
    S.B.G.blocks.filter((b) => b.id === 'P1' || b.id === 'P2').forEach((b) => glow(b.m, '#7a1010'));
    sayc('Gantt chart 的顏色亂掉了', '同一個人被切成好幾段：這就是 preemption');
  },
  async (tok, S) => {                                   // 1210 平均 WT = 3：比 non-preemptive 的 4 小
    S.t.set(0, 'P   arr burst  CT  WT'); S.t.set(1, 'P1   0    7   16   9'); S.t.set(2, 'P2   2    4    7   1'); S.t.set(3, 'P3   4    1    5   0'); S.t.set(4, 'P4   5    4   11   2');
    hot('平均 WT = (9 + 1 + 0 + 2) / 4 = 3 ≤ 4', 3.8, 4.6, -3.8);
    sayc('average wait time = 3', '一定比 non-preemptive 小或相同，不可能更差');
  },
  async (tok, S) => {                                   // 1224 被打斷時 wait 要小心算：P2 2 進來立刻跑，但 7 才結束
    sm('P2：2 進來立刻跑（response 0），中間被打斷，7 才結束', 3.8, 4.0, -3.8);
    sayc('被打斷時算 wait 比較複雜', 'P2 一進來就執行，但中間被打斷，真正結束是 7');
  },
  async (tok, S) => {                                   // 1252 公式：WT = completion − arrival − burst
    good('WT = 完成 − 到達 − burst：P2 = 7 − 2 − 4 = 1', 3.8, 3.4, -3.8);
    sayc('簡單的公式', 'completion time 減 arrival time，再減 run time');
  },
  async (tok, S) => {                                   // 1259 若有好幾個 burst，還要減掉 I/O 時間
    note('有好幾個 burst 時：還要再減掉 I/O 的時間（I/O 不算 ready queue 的 wait）', 0, 0.3, 4.4);
    sayc('只有一個 burst 才這樣算', '有好幾個 burst 時還要減掉 I/O 的時間');
  },
]);

scene('sch-16d-predict', '預測下一個 CPU burst：exponential average', [[0, 5.5, 13.5], [0, 2.2, 0]], () => ({}), [
  async (tok, S) => {                                   // 1284 SJF 理論 optimal，實際無法實現
    S.t1 = bub('SJF 理論上 optimal……但做得到嗎？', 0, 4.8, -2);
    sayc('shortest job first', '理論上很好，但實務上通常無法實現');
  },
  async (tok, S) => {                                   // 1303 不知道 burst time：排程發生在執行之前
    S.p = pal('P', '?', '#e55a9b', -4.8, -2.0, 0.8); S.p.mood('wow');
    S.unk = sm('排程時還沒開始跑 → 不知道這次 CPU burst 多長', -2.0, 0.3, -0.6);
    sayc('因為我們根本不知道 burst time', 'schedule 發生在執行之前');
  },
  async (tok, S) => {                                   // 1321 approximate SJF：用過去的歷史猜
    gone(S.t1); S.p.set('猜');
    good('approximate SJF：用它過去的 history 猜下一個 burst', 0, 4.8, -2);
    sayc('approximate shortest job first', '用過去的歷史來猜下一個 CPU burst 多長');
  },
  async (tok, S) => {                                   // 1342 burst 長度序列 = time series
    sm('t₁, t₂, t₃, … , tₙ → 猜 tₙ₊₁（time series prediction）', 0, 4.1, -2);
    sayc('每個時間點出現的 burst 長度', '就是一串 time series：要猜下一個');
  },
  async (tok, S) => {                                   // 1385 exponential average
    S.f = hot('τₙ₊₁ = α·tₙ + (1 − α)·τₙ', 0, 3.4, -2);
    sm('t = 實際觀察到的；τ = 預測值；α 決定比較相信哪邊', 0, 2.8, -2);
    sayc('最簡單的：exponential average', '新觀察值和過去的平均，用 α、1−α 加權');
  },
  async (tok, S) => {                                   // 1419 為什麼叫 exponential：越舊影響力越小
    sm('展開：α·tₙ + (1−α)α·tₙ₋₁ + (1−α)²α·tₙ₋₂ + …', 0, 2.2, -2);
    sayc('為什麼叫 exponential', '展開後越久以前的觀察值乘越多次，影響力越來越小（decay）');
  },
  async (tok, S) => {                                   // 1456 作業三要實作這個
    note('作業三：要實作這個預測', 4.6, 0.3, -2);
    sayc('作業三', '就是要去 implement 這個');
  },
  async (tok, S) => {                                   // 1467 圖：真正的 burst vs 預測的線
    gone(S.p, S.unk);
    hd('灰 = 預測 τ　藍 = 實際 t', -5.6, 0.3, 1.6);
    S.x = (k) => -4.6 + k * 2.2;
    sayc('一條是真正的 CPU burst，一條是預測', '不會一模一樣，但 hopefully 會貼近');
  },
  async (tok, S) => {                                   // 1537 一開始不知道，只能隨便猜 10
    await rise(tok, S.x(0) - 0.3, 1.6, 10 * 0.3, '#bfb3a0', 500); sm('τ₀ = 10', S.x(0) - 0.3, 10 * 0.3 + 0.35, 1.6);
    sayc('一開始根本不知道', '只能隨便猜：先猜 10');
  },
  async (tok, S) => {                                   // 1566 跑下去才發現只跑了 6
    await rise(tok, S.x(0) + 0.3, 1.6, 6 * 0.3, CPUC, 500); sm('t₀ = 6', S.x(0) + 0.3, 6 * 0.3 + 0.35, 1.6);
    sayc('schedule 下去跑完', '才發現它居然只跑了 6 個 cycle');
  },
  async (tok, S) => {                                   // 1589 平均一下 → 8；接著實際掉到 4
    await rise(tok, S.x(1) - 0.3, 1.6, 8 * 0.3, '#bfb3a0', 500); sm('τ₁ = (6 + 10)/2 = 8', S.x(1) - 0.3, 8 * 0.3 + 0.35, 1.6);
    await rise(tok, S.x(1) + 0.3, 1.6, 4 * 0.3, CPUC, 500); sm('t₁ = 4', S.x(1) + 0.3, 4 * 0.3 + 0.35, 1.6);
    sayc('平均一下，下一次猜 8', '結果實際又掉到 4');
  },
  async (tok, S) => {                                   // 1610 再修正成 6
    await rise(tok, S.x(2) - 0.3, 1.6, 6 * 0.3, '#bfb3a0', 500); sm('τ₂ = (4 + 8)/2 = 6', S.x(2) - 0.3, 6 * 0.3 + 0.35, 1.6);
    sayc('剛才猜得還不夠低', '再修正：(4 + 8) / 2 = 6');
  },
  async (tok, S) => {                                   // 1621 這裡 α = 0.5
    txt(S.f, 'α = 0.5：τₙ₊₁ = tₙ/2 + τₙ/2');
    sayc('這個簡單例子 α = 0.5', '歷史和上一次觀察各一半，除以 2 就好');
  },
  async (tok, S) => {                                   // 1638 實際 6、猜 6 → 繼續猜 6
    await rise(tok, S.x(2) + 0.3, 1.6, 6 * 0.3, CPUC, 500); sm('t₂ = 6', S.x(2) + 0.3, 6 * 0.3 + 0.35, 1.6);
    await rise(tok, S.x(3) - 0.3, 1.6, 6 * 0.3, '#bfb3a0', 500); sm('τ₃ = 6', S.x(3) - 0.3, 6 * 0.3 + 0.35, 1.6);
    sayc('實際 6、預測 6 剛好一樣', '所以繼續猜 6（之後還可能變化）');
  },
  async (tok, S) => {                                   // 1659 趨勢穩定就會猜中
    good('程式行為有規律 → 預測會越來越貼近', 2.8, 4.8, 1.6);
    sayc('如果趨勢是穩定的', 'eventually 就有機會猜中');
  },
  async (tok, S) => {                                   // 1669 也可以套更複雜的 time series 方法
    sm('也可以換更複雜的 time-series prediction 方法', 2.8, 4.2, 1.6);
    sayc('有很多 time series prediction method', '有 pattern 的話可以猜得更準');
  },
]);

// a priority pillar standing behind a buddy (taller = higher priority)
function pbar(b, h) { const m = lab.box('#c08a1f', [0.25, 1, 0.25]); m.scale.y = h; m.position.set(0.55, h / 2, -0.45); b.g.add(m); return m; }
scene('sch-16d-priority', 'Priority scheduling、starvation 與 aging', CAMG, () => {
  const S = {};
  S.B = board(10, { title: '' });
  return S;
}, [
  async (tok, S) => {                                   // 1695 每個 process 給一個 priority
    S.bars = {}; const L = [['P1', 3.0], ['P2', 1.6], ['P3', 2.2], ['P4', 0.5]];
    for (const [id, h] of L) S.bars[id] = pbar(S.B.arrive(id, ''), h);
    sm('柱子越高 = priority 越高', -2.4, 0.2, -4.4);
    sayc('priority scheduling', '每一個 process 都給它一個 priority');
  },
  async (tok, S) => {                                   // 1705 priority 可以固定，也可以 runtime 改變
    sm('OS 的 process 一建立就最高；使用者的較低；也可能隨行為調整', 0, 0.3, 0.2);
    sayc('priority 可以固定', '也可以根據 run time 的行為增加或減少');
  },
  async (tok, S) => {                                   // 1732 看當下每個人的 priority 來排
    await S.B.run(tok, 'P1', 0, 3, 500);
    sayc('不管會不會變', '就是看當下每個 process 的 priority 來做 scheduling');
  },
  async (tok, S) => {                                   // 1743 一樣有 preemptive / non-preemptive
    S.vip = pal('P9', '', '#d64545', -0.4, 0.6, 0.55); S.vip.mood('wow'); bub('priority 超高的人 join', -0.4, 1.6, 0.6);
    sayc('一樣分 preemptive / non-preemptive', '執行到一半有 priority 非常高的人加入，可能就打斷別人');
  },
  async (tok, S) => {                                   // 1759 SJF 也是 priority scheduling：priority = burst 時間
    gone(S.vip);
    note('SJF = priority scheduling 的一種：priority 由 burst 時間決定（越短越高）', 0, 0.3, 4.2);
    sayc('SJF 也是 priority scheduling 的一種', '只是它用執行時間當 priority，時間越小越高');
  },
  async (tok, S) => {                                   // 1797 真實 OS 全都是 priority scheduling
    good('真實 OS：全部都是 priority scheduling（最 general）', 0, 4.8, -3.6);
    sayc('之後介紹的真實 OS', '全部都是 priority scheduling，因為它最 general');
  },
  async (tok, S) => {                                   // 1805 問題：starvation
    await S.B.done(tok, 'P1');
    S.bars.P5 = pbar(S.B.arrive('P5', ''), 2.6); S.bars.P6 = pbar(S.B.arrive('P6', ''), 2.0);
    S.B.b.P4.mood('sad'); S.B.b.P4.glow('#3a0a0a');
    bad('starvation：priority 低的 P4 一直輪不到', -2.4, 1.8, -2.6);
    sayc('priority scheduling 的問題', 'starvation：priority 很低的人可能一直卡著');
  },
  async (tok, S) => {                                   // 1820 IBM 1967 → 1973：等了六年
    S.ibm = note('真實故事：IBM 大型機 1973 年退役時，發現一個 1967 年送進去的 process 從來沒跑過', 0, 0.3, 4.6);
    sayc('課本的有趣例子', '1967 年送進去的 process，到 1973 年機器退役時都還沒被執行，等了六年');
  },
  async (tok, S) => {                                   // 1854 starvation 的定義
    sm('starvation：想跑卻永遠跑不到（超過某個程度）', 0, 0.3, 5.3);
    sayc('starvation 的定義', '你想跑但永遠跑不到，就會「餓死」');
  },
  async (tok, S) => {                                   // 1866 aging：等越久 priority 越高
    const bar = S.bars.P4;
    await anim(tok, 900, (u) => { const v = 0.5 + 3.2 * u; bar.scale.y = v; bar.position.y = v / 2; });
    S.B.b.P4.glow(null); S.B.b.P4.mood('happy'); good('aging：沒被執行，每過一段時間 priority 就往上加', -2.4, 4.0, -2.6);
    sayc('解法：aging（作業三要實作）', '每過一段時間沒被執行，就把它的 priority 增加，讓它「變老」');
  },
  async (tok, S) => {                                   // 1889 priority scheduling 都會伴隨 aging
    await S.B.run(tok, 'P4', 3, 5, 500); await S.B.done(tok, 'P4');
    sayc('eventually 就不會 starvation', '一般 priority scheduling 都會伴隨 aging 機制');
  },
]);

// ════════ 8RlCb74uFp0（第 17A 講 Process Scheduling） ════════
scene('sch-17a-recap', '回顧：non-preemptive 與 preemptive 的兩種情況', CAM, () => {
  const S = {};
  S.cpu = prop('cpu', 4.6, 0, -2.4, 0.9, 'CPU'); zone('ready queue', -2.6, 0, -2.4, 6.0, 1.4);
  return S;
}, [
  async (tok, S) => {                                   // 15 程式 = CPU burst / I/O burst
    let x = -5.6; for (const [w, c, t] of [[2.0, CPUC, 'CPU'], [1.4, IOC, 'I/O'], [1.6, CPUC, 'CPU'], [1.2, IOC, 'I/O']]) { await grow(tok, x, x + w, 0.3, 2.2, c, t, 260); x += w + 0.06; }
    sm('CPU burst = running state；I/O burst = 做 CPU 以外的事', 0, 0.3, 3.4);
    sayc('先建立觀念', '程式就是 CPU burst（running）與 I/O burst 交替');
  },
  async (tok, S) => {                                   // 19 non-preemptive：進 running 就讓它做完
    S.P1 = pal('P1', '', PC.P1, 4.6, -1.5, 0.65); S.P1.mood('happy');
    note('non-preemptive：一進 running 就讓它做到自己去 I/O 或結束', 0, 3.6, -2.4);
    sayc('non-preemptive', '一旦進 running，就讓它做完，直到它自己去 I/O 或結束');
  },
  async (tok, S) => {                                   // 56 preemptive：CPU burst 做到一半就換掉
    hot('preemptive：CPU burst 做到一半就 context switch 換人', 0, 4.4, -2.4);
    sayc('preemptive 很好判斷', '它還在做 CPU instruction，就被 context switch 換掉');
  },
  async (tok, S) => {                                   // 78 情況一：有新的程式進 ready（剛 create 或從 I/O、sleep 回來）
    S.P2 = pal('P2', '新', PC.P2, -6.0, 0.4, 0.6); S.P2.mood('wow');
    await walk(tok, S.P2, -4.8, -2.4, 700);
    sm('情況一：新 process 進 ready（剛 create／I/O、sleep 回來）', -2.6, 0.2, -0.9);
    sayc('情況一', '有新的程式進到 ready queue：剛 create 的，或做完 I/O、sleep 回來的');
  },
  async (tok, S) => {                                   // 101 情況二：time sharing 的 timer interrupt
    hot('⏰ 情況二：timer interrupt', 4.6, 2.6, -2.4);
    await walk(tok, S.P1, -3.4, -2.4, 700); S.P1.mood('sad');
    sayc('情況二：time sharing', '時間到就有 interrupt，強迫目前的程式回 ready 重新被選一次');
  },
]);

scene('sch-17a-fcfs', 'FCFS 為什麼不好', CAMG, () => ({ B: board(30, { title: 'FCFS（示意：沿用上一講 24、3、3）' }) }), [
  async (tok, S) => {                                   // 142 FCFS
    S.B.arrive('P1', 24); S.B.arrive('P2', 3); S.B.arrive('P3', 3);
    sayc('最基本的 first come, first serve', '先來的先做');
  },
  async (tok, S) => {                                   // 147 先進來的可能是執行很久的
    S.B.b.P1.mood('happy'); bub('我要做很久喔', -5.6, 1.5, -2.6);
    await S.B.run(tok, 'P1', 0, 24, 1100);
    sayc('明顯不好', '一開始排到的先進來的 process，可能執行時間很長');
  },
  async (tok, S) => {                                   // 153 後面的人 wait time 被拉高
    S.B.b.P2.mood('sad'); S.B.b.P3.mood('sad');
    await S.B.done(tok, 'P1'); await S.B.run(tok, 'P2', 24, 27, 300); await S.B.done(tok, 'P2'); await S.B.run(tok, 'P3', 27, 30, 300); await S.B.done(tok, 'P3');
    bad('P2 等 24、P3 等 27', 0, 1.5, 0.6);
    sayc('後面的人', 'wait time 全部被拉高');
  },
  async (tok, S) => {                                   // 160 整個系統的 average wait time 很大
    hot('平均 WT = 17：不是使用者想見到的', 2.6, 4.6, -3.8);
    sayc('從整個系統角度', 'average wait time 很大，不是使用者想看到的');
  },
]);

scene('sch-17a-sjf', 'SJF（non-preemptive）：一段 CPU burst 不打斷', CAMG, () => {
  const S = {};
  S.t = table(['P   arr burst', 'P1   0    7', 'P2   2    4', 'P3   4    1', 'P4   5    4'], -6.2, 5.4, -3.8);
  return S;
}, [
  async (tok, S) => {                                   // 167 要 minimize wait time：SJF
    S.g1 = good('minimize 平均 wait time → shortest job first', 3.8, 4.6, -3.8);
    sayc('想把 wait time minimize', '理論上可以證明就是 shortest job first');
  },
  async (tok, S) => {                                   // 178 ready queue 裡最短的先排
    S.g2 = sm('看「目前 ready queue 裡」最短的', 3.8, 4.0, -3.8);
    sayc('最短的先排就對了', '是目前在 ready queue 裡最短的');
  },
  async (tok, S) => {                                   // 183 preemptive / non-preemptive 結果不一樣
    S.B = board(16, { title: 'SJF（non-preemptive）' });
    sayc('這時 preemptive 跟 non-preemptive', '結果就不一樣了');
  },
  async (tok, S) => {                                   // 189 P1 雖長但先進來、沒得選
    S.B.arrive('P1', 7); S.t.hl(1);
    await S.B.run(tok, 'P1', 0, 7, 900);
    S.B.arrive('P2', 4); S.B.arrive('P3', 1); S.B.arrive('P4', 4);
    sayc('non-preemptive：P1 雖然很長', '但它先進來、沒得選，只好讓它先做');
  },
  async (tok, S) => {                                   // 198 打斷指的是「這一個 CPU burst」，不是整個程式
    glow(S.B.G.blocks[0].m, '#6a4a00'); sm('不能打斷的是「這一個 CPU burst」', S.B.G.xAt(3.5), 1.3, 2.0);
    sayc('一旦做下去就沒辦法打斷', '打斷不是指整個程式，而是這一個 CPU burst');
  },
  async (tok, S) => {                                   // 208 for loop：i++ 是 CPU burst，print 是 I/O burst
    gone(S.g1, S.g2); S.c = code(['for (…) {', '  i++;        // CPU burst', '  print(i);   // I/O burst', '}'], 3.6, 5.4, 0.6, -3.8);
    sayc('P1 這個程式其實有很多 burst', '像 for loop 裡 i++ 是 CPU burst、print i 是 I/O burst');
  },
  async (tok, S) => {                                   // 223 考題：第一個 burst 7、第二個 burst 4、中間隔多久
    S.G2 = chart(20, { z: 5.3, w: 11.4, title: '真實的 P1（考題會這樣出；中間間隔示意）' });
    await S.G2.add(tok, 'P1', 0, 7, 400); await S.G2.add(tok, 'I/O', 7, 13, 300, IOC); await S.G2.add(tok, 'P1', 13, 17, 300);
    sayc('考試可能這樣出', '第一個 burst 7、第二個 burst 4，中間過了多少時間');
  },
  async (tok, S) => {                                   // 250 下一個 burst 來時，要加進 ready queue
    note('第二個 burst 來時 → 再加進 ready queue 重新排', 0, -0.6, 6.0);
    sayc('CPU burst 來的時候', '你要記得它會重新加入 ready queue');
  },
  async (tok, S) => {                                   // 257 non-preemptive：每段剛好等於 burst 長度
    await S.B.done(tok, 'P1'); await S.B.run(tok, 'P3', 7, 8, 300); await S.B.done(tok, 'P3');
    await S.B.run(tok, 'P2', 8, 12, 400); await S.B.done(tok, 'P2'); await S.B.run(tok, 'P4', 12, 16, 400); await S.B.done(tok, 'P4');
    good('每一段都剛好是它的 burst 長度', 0, 1.5, 2.0);
    sayc('non-preemptive 不會打斷', '畫出來每段一定剛好等於它的 burst 長度');
  },
]);

scene('sch-17a-srtf', 'Preemptive SJF：response 與 waiting 不同', CAMG, () => {
  const S = {};
  S.t = table(['P   arr burst', 'P1   0    7', 'P2   2    4', 'P3   4    1', 'P4   5    4'], -6.2, 5.4, -3.8);
  S.G = chart(16, { title: 'SJF（preemptive）', z: 1.6 });
  return S;
}, [
  async (tok, S) => {                                   // 265 preemptive：隨時判斷有沒有新的人到
    sm('每有人進 ready queue，就重比「剩餘時間」', 3.8, 4.6, -3.8);
    sayc('preemptive 比較複雜', '要隨時判斷有沒有新的人到 ready queue');
  },
  async (tok, S) => {                                   // 276 P1 還是先執行，但被打斷
    for (const [id, s, e] of [['P1', 0, 2], ['P2', 2, 4], ['P3', 4, 5], ['P2', 5, 7], ['P4', 7, 11], ['P1', 11, 16]]) await S.G.add(tok, id, s, e, 260);
    S.G.blocks.filter((b) => b.id === 'P1').forEach((b) => glow(b.m, '#7a1010'));
    sayc('剛剛的 P1 還是先執行', '但它被打斷了：CPU burst 被切開');
  },
  async (tok, S) => {                                   // 295 P1：response 很快，wait 卻很久
    await grow(tok, S.G.xAt(2), S.G.xAt(11), 1.3, 1.6, '#d64545', 'P1 在 ready queue 等 9', 700, 0.14, 0.14);
    sm('P1 response = 0（一來就跑）', S.G.xAt(1), 1.8, 1.6);
    sayc('P1 一進來就 response', '但中間一直在 ready queue 等，wait time 還是很久');
  },
  async (tok, S) => {                                   // 318 response 與 wait 是兩個不同的 metric
    note('preemptive 時 response time ≠ waiting time：兩個不同的 metric', 0, -0.3, 3.6);
    sayc('preemptive 時', 'response time 跟 wait time 很容易不一樣');
  },
  async (tok, S) => {                                   // 333 preemptive 比 non-preemptive 好
    good('平均 WT：preemptive 3 ≤ non-preemptive 4', 3.8, 4.0, -3.8);
    sayc('整體來說 preemptive 比 non-preemptive 好', '（這個例子平均 WT 3 vs 4）');
  },
  async (tok, S) => {                                   // 338 但 burst 中途 context switch → synchronization
    bad('代價：burst 中途 context switch → synchronization（下一章）', 0, -0.6, 4.4);
    sayc('只是在 CPU burst 中間做 context switch', '下一章會教：會有 synchronization 的問題');
  },
]);

scene('sch-17a-predict', '預測 burst：exponential decay', [[0, 5.5, 13.5], [0, 2.2, 0]], () => ({}), [
  async (tok, S) => {                                   // 350 SJF 不知道 burst time
    S.p = pal('P', '?', '#e55a9b', -4.8, -2.0, 0.8); S.p.mood('wow');
    bub('不知道 burst time，怎麼知道誰最短？', -2.0, 2.4, -2.0);
    sayc('SJF 理論很好，但實際做不到', '根本不知道 burst time，怎麼知道誰最小');
  },
  async (tok, S) => {                                   // 364 approximate：time series
    S.f = hot('approximate：用過去的 burst（time series）預測', 1.6, 4.4, -2.0);
    sayc('所以用 approximate', 'burst 長度就是一串 time series 的數字');
  },
  async (tok, S) => {                                   // 376 exponential decay 的 function 預測
    sm('τₙ₊₁ = α·tₙ + (1 − α)·τₙ（越舊的影響越小）', 1.6, 3.8, -2.0);
    sayc('用 exponential decay 的 function', '去做預測');
  },
  async (tok, S) => {                                   // 380 一開始可能很不準
    gone(S.p);
    const T = [6, 4, 6, 4, 13, 13, 13]; S.tau = [10]; for (const t of T) S.tau.push(S.tau[S.tau.length - 1] / 2 + t / 2);
    S.T = T; S.x = (k) => -5.4 + k * 1.6; hd('灰 = 預測　藍 = 實際（恐龍書例子，α = 1/2）', 0, 0.3, 2.2);
    for (let k = 0; k < 3; k++) { await rise(tok, S.x(k) - 0.28, 1.4, S.tau[k] * 0.3, '#bfb3a0', 180, 0.5, 0.5); await rise(tok, S.x(k) + 0.28, 1.4, T[k] * 0.3, CPUC, 180, 0.5, 0.5); }
    sm('一開始亂猜（10）', S.x(0), 3.4, 1.4);
    sayc('一開始當然可能很不準', '你猜的是隨便猜的');
  },
  async (tok, S) => {                                   // 388 程式有規律（for loop）→ burst 很穩定
    for (let k = 3; k < S.T.length; k++) { await rise(tok, S.x(k) - 0.28, 1.4, S.tau[k] * 0.3, '#bfb3a0', 160, 0.5, 0.5); await rise(tok, S.x(k) + 0.28, 1.4, S.T[k] * 0.3, CPUC, 160, 0.5, 0.5); }
    sm('實際 4 之後跳到 13 並穩定 → 預測 5、9、11（下一個 12）一路追上', S.x(5), 4.6, 1.4);
    sayc('程式通常有規律', '像 for loop 每次做的事都一樣，burst time 很穩定');
  },
  async (tok, S) => {                                   // 407 逼近之後，猜中的就是最小的 job
    good('預測對了 → 挑到的就是真正最短的 job', 1.6, 5.4, -2.0);
    sayc('用這種逼近的方式', '預測對了，挑中的就是最小的 job');
  },
  async (tok, S) => {                                   // 419 真實 OS 用比較直覺的作法
    note('真實 OS（最後一節）：用直覺的作法，同樣讓 CPU burst 短的先做', 1.6, 0.3, 4.0);
    sayc('最後會介紹真實 OS', '概念一樣：讓 CPU burst 越短的人越先，但不一定用數學');
  },
]);

scene('sch-17a-priority', 'Priority scheduling 與 aging', CAMG, () => ({ B: board(10, { title: '' }) }), [
  async (tok, S) => {                                   // 449 priority 是最 general 的
    S.bars = {}; for (const [id, h] of [['P1', 2.6], ['P2', 1.4], ['P3', 2.0], ['P4', 0.5]]) S.bars[id] = pbar(S.B.arrive(id, ''), h);
    sm('柱子越高 = priority 越高', -2.4, 0.2, -4.4);
    sayc('priority scheduling', '其實是最 general 的 case');
  },
  async (tok, S) => {                                   // 454 SJF 也可以看成 priority：值 = CPU burst time
    note('SJF：priority 的值 = CPU burst time，最短的 priority 最高', 0, 0.3, 0.6);
    sayc('SJF 也可以視為 priority scheduling', 'priority 的值就是 CPU burst time');
  },
  async (tok, S) => {                                   // 480 真實 OS 都是 based on priority
    good('真實 OS 都是 based on priority scheduling', 0, 4.6, -3.8);
    sayc('事實上的 OS', '都是 based on priority scheduling');
  },
  async (tok, S) => {                                   // 486 priority 的決定摻雜很多規則與經驗
    sm('決定 priority 時摻雜很多 rules、經驗', 0, 4.0, -3.8);
    await S.B.run(tok, 'P1', 0, 3, 500); await S.B.done(tok, 'P1');
    sayc('只是決定 priority 的方式', '摻雜很多其他的 rules 或經驗');
  },
  async (tok, S) => {                                   // 500 最大的問題：starvation
    S.bars.P5 = pbar(S.B.arrive('P5', ''), 2.4);
    S.B.b.P4.mood('sad'); S.B.b.P4.glow('#3a0a0a'); bad('starvation：P4 永遠輪不到', -2.4, 1.8, -2.6);
    sayc('最大必須解決的問題', 'starvation：priority 低的人可能永遠都輪不到');
  },
  async (tok, S) => {                                   // 508 就像貧富不均
    bub('貧窮的人沒辦法翻身', -1.2, 2.6, -2.6);
    sayc('就像貧富不均', '貧窮的人沒有辦法翻身，最後就餓死了');
  },
  async (tok, S) => {                                   // 522 課本的真實例子
    note('課本：真的發生過（等了六年的 process）', 0, 0.3, 0.6);
    sayc('課本也提到', '現實生活中真的有這種例子');
  },
  async (tok, S) => {                                   // 530 solution：aging
    good('aging：沒被執行的，每過一段時間 priority 增加', -2.4, 4.0, -2.6);
    sayc('solution：aging', '每過一段時間，沒被執行的 process 就增加它的 priority');
  },
  async (tok, S) => {                                   // 544 遲早升到最高被執行
    await anim(tok, 900, (u) => { const v = 0.5 + 2.6 * u; S.bars.P4.scale.y = v; S.bars.P4.position.y = v / 2; });
    S.B.b.P4.glow(null); S.B.b.P4.mood('happy'); await S.B.run(tok, 'P4', 3, 5, 400); await S.B.done(tok, 'P4');
    sayc('一直沒被執行的人', 'priority 遲早升到最高，就會被執行到');
  },
  async (tok, S) => {                                   // 552 多久加、加多少：policy
    sm('多久加一次、每次加多少 → 只是 policy（看怎麼 tune）', 0, 0.3, 4.4);
    sayc('多久增加、每次增加多少', '那只是 policy，看你怎麼 tune');
  },
  async (tok, S) => {                                   // 568 作業三：實作基本的 aging
    note('作業三：implement 一個基本的 aging', 0, 0.3, 5.2);
    sayc('作業三會有機會實作', '一個基本的 aging，確保 priority scheduling 不出問題');
  },
]);

scene('sch-17a-rr', 'Round-Robin 與 time quantum', CAMG, () => ({}), [
  async (tok, S) => {                                   // 581 Round Robin
    S.B = board(12, { title: 'RR，q = 2（示意：P1 5、P2 3、P3 4，都在 0 到）', gz: 1.5 });
    S.B.arrive('P1', 5); S.B.arrive('P2', 3); S.B.arrive('P3', 4);
    sayc('Round Robin', '大家可能都聽過這個詞');
  },
  async (tok, S) => {                                   // 589 輪流做，supposedly 最 fair
    for (const id of ['P1', 'P2', 'P3']) S.B.b[id].mood('happy');
    sayc('就是大家輪流做', 'supposedly 是最 fair 的方式');
  },
  async (tok, S) => {                                   // 597 每次輪到可以做多久：time quantum
    S.q = hot('time quantum：每次輪到最多做多久', 5.3, 2.4, -2.6);
    sayc('控制的東西', '每次輪到可以執行多久：time quantum');
  },
  async (tok, S) => {                                   // 610 例：100 ms 或 10 ms
    sm('例：每次 100 ms，或設小一點每次 10 ms', 5.3, 1.8, -2.6);
    sayc('可能每次做 100 ms', '或把 quantum 設小一點，每次只能做 10 ms');
  },
  async (tok, S) => {                                   // 621 固定值 → 像 preemptive：時間到就讓出
    await S.B.run(tok, 'P1', 0, 2, 500); S.B.set('P1', 3);
    S.tu = bad('⏰ 時間到！', 5.3, 3.0, -2.6);
    sayc('因為是固定的值', '不管 CPU burst 多長，quantum 一到就要讓出來 → 像 preemptive');
  },
  async (tok, S) => {                                   // 645 剛做完的人放到 ready queue 最後面
    gone(S.tu); await S.B.back(tok, 'P1');
    const R = async (id, s, e, left) => { await S.B.run(tok, id, s, e, 200); S.B.set(id, left); if (left) await S.B.back(tok, id); else await S.B.done(tok, id); };
    await R('P2', 2, 4, 1); await R('P3', 4, 6, 2); await R('P1', 6, 8, 1); await R('P2', 8, 9, 0); await R('P3', 9, 11, 0); await R('P1', 11, 12, 0);
    sayc('剛做完的人', '放到 ready queue 的最後面重新排隊');
  },
  async (tok, S) => {                                   // 654 quantum 非常大 → FCFS
    S.G1 = chart(12, { z: 3.4, w: 11.4, title: 'q 很大（≥ 5）→ 就是 FCFS' });
    await S.G1.add(tok, 'P1', 0, 5, 300); await S.G1.add(tok, 'P2', 5, 8, 300); await S.G1.add(tok, 'P3', 8, 12, 300);
    sayc('quantum 非常非常大', '遠超過所有 CPU burst → 就變成 FIFO / FCFS');
  },
  async (tok, S) => {                                   // 677 quantum 非常小 → 非常 fair
    S.G2 = chart(12, { z: 5.0, w: 11.4, title: 'q = 1：非常 fair' });
    const seq = ['P1', 'P2', 'P3', 'P1', 'P2', 'P3', 'P1', 'P2', 'P3', 'P1', 'P3', 'P1'];
    for (let k = 0; k < seq.length; k++) await S.G2.add(tok, seq[k], k, k + 1, 90);
    sayc('quantum 非常非常小', '當然非常非常 fair');
  },
  async (tok, S) => {                                   // 682 但 context switch 次數很多
    bad('context switch：q 大 2 次、q = 2 6 次、q = 1 11 次', 0, 0.3, 6.1);
    sayc('但要注意 context switch', '每次都要換人，次數一定很多，overhead 很大');
  },
  async (tok, S) => {                                   // 697 一般系統不設太大也不設太小
    good('一般系統：quantum 不會設非常大，也不會設非常小', 0, 4.6, -3.8);
    sayc('所以 time quantum', '一般系統不會設得非常大，也不會設得非常小');
  },
]);

scene('sch-17a-rr20', 'RR 例子：q = 20，53、17、68、24', CAMG, () => {
  const S = {};
  S.t = table(['P   burst', 'P1   53', 'P2   17', 'P3   68', 'P4   24'], -6.0, 5.4, -3.8);
  S.B = board(162, { title: 'RR，time quantum = 20', gz: 1.8 });
  for (const [id, b] of [['P1', 53], ['P2', 17], ['P3', 68], ['P4', 24]]) S.B.arrive(id, b);
  return S;
}, [
  async (tok, S) => {                                   // 704 例子：q = 20，比較規律好模擬
    hot('q = 20', 5.3, 2.4, -2.6);
    sayc('round robin 的例子', 'time quantum = 20，模擬起來比較規律');
  },
  async (tok, S) => {                                   // 718 每 20 單位強迫換人；P1 53 也只能做 20
    await S.B.run(tok, 'P1', 0, 20, 700); S.B.set('P1', 33); await S.B.back(tok, 'P1');
    sayc('每 20 個單位就強迫換人', '雖然 P1 是 53，做 20 就得換人（剩 33）');
  },
  async (tok, S) => {                                   // 727 P2 只要 17，提早結束
    await S.B.run(tok, 'P2', 20, 37, 600); S.B.set('P2', 0);
    sayc('P2 只要 17', '所以會提早結束，不會做滿 20');
  },
  async (tok, S) => {                                   // 740 37 時 P2 做完，換 P3
    await S.B.done(tok, 'P2'); S.B.G.tick(37);
    sm('t = 37：P2 做完', S.B.G.xAt(37), 1.8, 1.8);
    sayc('到了 37 P2 就做完了', '做完之後換下一個人 P3');
  },
  async (tok, S) => {                                   // 745 P3 超過 20 也只做 20，以此類推到大家做完
    const R = async (id, s, e, left) => { await S.B.run(tok, id, s, e, 220); S.B.set(id, left); if (left) await S.B.back(tok, id); else await S.B.done(tok, id); };
    await R('P3', 37, 57, 48); await R('P4', 57, 77, 4); await R('P1', 77, 97, 13); await R('P3', 97, 117, 28); await R('P4', 117, 121, 0); await R('P1', 121, 134, 0); await R('P3', 134, 162, 0);
    sayc('P3 超過 20，也只能做 20', '再換下一個，以此類推，直到大家做完');
  },
  async (tok, S) => {                                   // 755 標準 RR；quantum 可大可小
    S.t.set(0, 'P   burst  CT  WT'); S.t.set(1, 'P1   53   134  81'); S.t.set(2, 'P2   17    37  20'); S.t.set(3, 'P3   68   162  94'); S.t.set(4, 'P4   24   121  97');
    sm('補充：平均 WT = (81 + 20 + 94 + 97) / 4 = 73', 3.2, 4.6, -3.8);
    sayc('這就是標準的 round robin', 'quantum 可大可小（補充：平均 WT = 73）');
  },
]);

scene('sch-17a-rrtrade', 'RR：turnaround 較長、response 較好', [[0, 6, 13], [0, 2.2, 0]], () => ({}), [
  async (tok, S) => {                                   // 765 經驗上：RR 的平均 turnaround 比較高
    hd('平均 turnaround', -3.0, 0, 1.6); hd('平均 response', 3.0, 0, 1.6); sm('藍 = RR（q = 20）　橘 = SJF（同一組 53、17、68、24，補充計算）', 0, 6.4, 0);
    S.b1 = await rise(tok, -3.8, 0, 113.5 * 0.045, CPUC, 600, 1.2, 1.0); sm('113.5', -3.8, 113.5 * 0.045 + 0.35, 0);
    sayc('經驗上（不能證明）', 'RR 的 average turnaround time 通常比較高');
  },
  async (tok, S) => {                                   // 787 metrics：wait、response、turnaround
    sm('三個 metric：waiting、response、turnaround', 0, 5.8, 0);
    sayc('衡量的 metrics', 'wait time、response time，還有 turnaround time');
  },
  async (tok, S) => {                                   // 794 RR 很 fair → 大家都慢
    S.b2 = await rise(tok, -2.2, 0, 78.5 * 0.045, IOC, 600, 1.2, 1.0); sm('78.5', -2.2, 78.5 * 0.045 + 0.35, 0);
    sayc('RR 很 fair', 'fair 的結果就是大家都很慢');
  },
  async (tok, S) => {                                   // 800 像貧富不均：平均被少數拉高
    note('貧富不均時：1% 的人有 50% 的財富 → 平均看起來很高', -3.0, 0.3, 3.0);
    sayc('就像算平均財富', '少數人很有錢，平均就被拉高；benefit 少數人平均才會降');
  },
  async (tok, S) => {                                   // 819 完全 fair：大家執行時間都被拉長
    sm('RR：沒有人特別短 → 平均 turnaround 降不下來', -3.0, 0.3, 3.7);
    sayc('完全 fair', '大家的執行時間都被拉長，沒有人特別短');
  },
  async (tok, S) => {                                   // 836 但 response time 非常好
    await rise(tok, 2.2, 0, 28.5 * 0.045, CPUC, 600, 1.2, 1.0); sm('28.5', 2.2, 28.5 * 0.045 + 0.35, 0);
    await rise(tok, 3.8, 0, 38 * 0.045, IOC, 600, 1.2, 1.0); sm('38', 3.8, 38 * 0.045 + 0.35, 0);
    sayc('相反地，response time', 'RR 就會非常好');
  },
  async (tok, S) => {                                   // 847 最多等 process 數 × quantum
    good('最多等 (n − 1) × q 就輪到你（這裡 3 × 20 = 60）', 3.0, 3.6, 0);
    sayc('RR 保證輪流', '最多等（process 數 − 1）× quantum 就輪到你');
  },
  async (tok, S) => {                                   // 867 演算法沒有好壞，看使用者需求
    hot('沒有最好的演算法：看系統要的 metric', 0, 5.2, 0);
    sayc('algorithm 沒有好壞', '只看系統使用者的需求、要的 metric 是什麼');
  },
  async (tok, S) => {                                   // 888 要 response 好 → RR；要平均 wait 最小 → SJF
    good('response 好 → RR　｜　average wait 最小 → SJF', 0, 4.6, 0);
    sayc('要 response time 好', '用 round robin；想讓 average wait time 最小，用 SJF');
  },
]);

scene('sch-17a-mlq', 'Multilevel queue：依權重挑 queue', [[0, 7, 12], [0, 0.6, -0.4]], () => ({}), [
  async (tok, S) => {                                   // 910 基本演算法；實際系統會 mix
    bub('實際系統：把各種做法兜在一起', 0, 3.8, -2);
    sayc('前面都是最基本的做法', '實際系統會 mix 在一起，根據需求調整');
  },
  async (tok, S) => {                                   // 923 第一種：ready queue 不只一個
    S.Q = [['system process', 'Priority', 50], ['interactive', 'RR', 20], ['interactive editing', 'RR', 10], ['batch', 'FCFS', 10], ['student', 'FCFS', 10]];
    S.L = S.Q.map(([nm], k) => { const z = -3.6 + k * 1.15; ctx.tile(V3(-0.8, 0.03, z), 7.4, 0.85, '#e9dcc4'); return { z, toks: [0, 1, 2].map((j) => cube('', PCOL[k], [0.6, 0.5, 0.6], -2.6 + j * 0.75, 0.25, z, 1.5)) }; });
    ctx.tile(V3(5.6, 0.04, -1.3), 1.4, 1.4, '#c9b48e'); hd('CPU', 5.6, 0.1, -0.4);
    sayc('第一種兜法', 'ready queue 不是只有一個，而是很多個');
  },
  async (tok, S) => {                                   // 932 multilevel queue
    hot('Multilevel Queue', 0, 4.4, -3.8);
    sayc('這叫 multilevel queue', '又分兩種，先介紹比較單純的第一種');
  },
  async (tok, S) => {                                   // 943 每個 queue 放不同型別的工作
    S.nm = S.Q.map(([nm], k) => hd(nm, -6.1, 0.1, S.L[k].z));
    sayc('每個 queue 放不同型別的工作', '重要性不同，管理的方式也不同');
  },
  async (tok, S) => {                                   // 960 interactive → RR（response 好）
    S.nm[1].element.textContent = 'interactive（RR）'; S.nm[2].element.textContent = 'interactive editing（RR）';
    sayc('interactive 的工作', 'response time 要好 → 用 round robin');
  },
  async (tok, S) => {                                   // 970 system process → priority
    S.nm[0].element.textContent = 'system process（Priority）'; S.nm[3].element.textContent = 'batch（FCFS）'; S.nm[4].element.textContent = 'student（FCFS，示意）';
    sayc('system process 非常重要', '用 priority scheduling，最重要的 kernel 程式一定先執行');
  },
  async (tok, S) => {                                   // 999 每次還是只能選一個人
    bub('五個 queue，這一刻要從哪個拿？', 5.6, 1.6, -1.3);
    sayc('問題是最後還是只能選一個', '雖然有五個 queue，不能五個一起執行');
  },
  async (tok, S) => {                                   // 1024 用 weight：random 挑 queue
    S.Q.forEach(([, , w], k) => hot(w + '%', 3.5, 0.1, S.L[k].z));
    sayc('通常的做法：weighted', 'randomly 依比例決定這次從哪一個 queue 挑 job');
  },
  async (tok, S) => {                                   // 1040 50% system，剩下 20、10、10、10
    for (const k of [0, 1, 0, 3]) { const m = S.L[k].toks.shift(); if (!m) continue; glow(m, '#6a4a00'); move(m, 5.6, 0.4, -1.3); await wt(tok, 420); kill(m); }
    sayc('50% 的機會從 system process 挑', '剩下 50% 分成 20、10、10、10，照機率來');
  },
  async (tok, S) => {                                   // 1065 queue 空了就重選
    S.L[4].toks.forEach((m) => kill(m)); S.L[4].toks = []; bad('空了 → 重抽', 1.2, 0.1, S.L[4].z);
    sayc('某個 queue 可能空掉', '空掉就重新選一次而已');
  },
  async (tok, S) => {                                   // 1073 上下沒有意義，純粹是機率
    note('MLQ 的上下沒有意義：純粹看機率，加起來 100% 就好；process 不會換 queue', 0, 0.3, 2.6);
    sayc('雖然畫成上下五層', 'multilevel queue 的上下沒有意義，純粹是機率');
  },
  async (tok, S) => {                                   // 1096 combine 不同演算法，符合系統需求
    good('combine 不同 scheduling algorithm → 更符合系統需求', 0, 0.3, 3.4);
    sayc('combine 不同的 scheduling algorithm', 'OS 知道程式的特性（hint），就能管理得更好');
  },
]);

// MLFQ board: three lanes (Q0 top … Q2 bottom), buddies sit in a lane
function mlfqBoard(names) {
  const LZ = [-3.4, -2.0, -0.6];
  names.forEach((s, k) => { ctx.tile(V3(-1.4, 0.03, LZ[k]), 7.6, 1.1, k === 0 ? '#e9dcc4' : k === 1 ? '#e3d3b6' : '#dccaa8'); hd(s, -6.4, 0.2, LZ[k]); });
  prop('cpu', 5.3, 0, -2.0, 0.9, 'CPU');
  const M = { LZ, lane: [[], [], []], b: {} };
  M.add = (id, lv, color) => { const b = pal(id, '', color || PC[id] || '#bfb3a0', -3.6 + M.lane[lv].length * 1.2, LZ[lv], 0.5); M.b[id] = b; M.lane[lv].push(id); return b; };
  M.to = async (tok, id, lv) => { for (const L of M.lane) { const i = L.indexOf(id); if (i >= 0) L.splice(i, 1); } M.lane[lv].push(id); await walk(tok, M.b[id], -3.6 + (M.lane[lv].length - 1) * 1.2, LZ[lv], 600); };
  return M;
}
scene('sch-17a-mlfq', 'Multilevel feedback queue：在 queue 之間移動', [[0, 7, 12], [0, 0.6, -0.8]], () => ({}), [
  async (tok, S) => {                                   // 1120 MLFQ：多個 queue + feedback
    S.M = mlfqBoard(['Q0（最上層）', 'Q1', 'Q2（最下層）']);
    hot('Multilevel Feedback Queue', 0, 3.6, -4.2);
    sayc('另一個比較複雜的做法', 'multilevel feedback queue：不只多個 queue，還會 feedback');
  },
  async (tok, S) => {                                   // 1134 上下有意義：第一個 queue 空了才去第二個
    S.M.add('P1', 0); S.M.add('P2', 1); S.M.add('P3', 1);
    S.ar = arrow(V3(5.0, 1.4, -4.2), V3(5.0, 1.4, -0.2), 0xc08a1f); sm('上面的一定先做', 5.6, 2.0, -2.0);
    sayc('這裡的上下有意義', '上面的一定先做；第一個 queue 做空了才去第二個拿 job');
  },
  async (tok, S) => {                                   // 1161 process 可以在 queue 之間移動
    await S.M.to(tok, 'P3', 2);
    sayc('相對地', '放進這些 queue 的 process 可以在 queue 之間移動');
  },
  async (tok, S) => {                                   // 1180 run time 觀察行為，再決定在第幾層
    S.eye = bub('觀察它在 run time 的 behavior', -1.2, 1.4, -0.6);
    sayc('feedback 的意思', 'run time 去觀察它的行為，才判斷它應該在第幾層');
  },
  async (tok, S) => {                                   // 1197 OS 每次選最上面 queue 的 process
    gone(S.eye); S.M.b.P1.glow('#6a4a00'); await walk(tok, S.M.b.P1, 5.3, -1.2, 600);
    sayc('OS 每次都選最上面 queue 的 process', '跟 MLQ 看起來很像，選 queue 的方式卻完全不同');
  },
  async (tok, S) => {                                   // 1219 很多事 run time 才知道；沒有 hint
    S.u = pal('user 程式', '?', '#9b7ef4', -5.4, 1.4, 0.55);
    sm('80% 是使用者的程式：有的一直 I/O、有的一直算，事先不知道', -1.4, 0.2, 2.2);
    sayc('為什麼要 feedback', '很多事要 run time 才知道，使用者也不會給 OS hint');
  },
  async (tok, S) => {                                   // 1260 執行後就知道它的 burst 與 system call
    S.u.set('看過了'); sm('執行過後：知道 CPU burst、I/O burst 多長、call 了哪些 system call', -1.4, 0.2, 2.8);
    sayc('執行之後 OS 就知道', '它過去 CPU burst、I/O burst 多長，call 了哪些 system call');
  },
  async (tok, S) => {                                   // 1287 上層通常放 I/O-bound
    good('上層：I/O-bound 的程式', 2.4, 0.9, -3.4);
    sayc('上層的人', '通常是 I/O-bound 的程式（最先執行的）');
  },
  async (tok, S) => {                                   // 1297 I/O-bound = CPU burst 短 = SJF
    sm('I/O-bound = CPU burst 很短 → 先做它 ≈ SJF', 2.4, 1.5, -3.4);
    sayc('對 CPU 來說剛好倒過來', 'I/O-bound 的 CPU burst 很短：就是 shortest job first');
  },
  async (tok, S) => {                                   // 1313 call I/O、burst 短 → 往上提
    S.M.add('P4', 1, '#e55a9b'); await wt(tok, 300); await S.M.to(tok, 'P4', 0); S.M.b.P4.mood('happy');
    sayc('call I/O system call，或 CPU burst 真的比較短', '就把它往上提到上面的 level');
  },
  async (tok, S) => {                                   // 1346 quantum 用完還沒做完 → CPU-bound → 往下踢
    await S.M.to(tok, 'P1', 1); S.M.b.P1.glow(null); S.M.b.P1.mood('sad');
    sayc('給你的 quantum 你用完還做不完', '代表你是 CPU-bound → 把你往下踢');
  },
  async (tok, S) => {                                   // 1375 aging：最上層先做 = priority，最下層可能 starvation
    S.M.b.P3.mood('sad'); bad('一直卡在最下層 → starvation', 1.0, 0.9, -0.6);
    sayc('只從最上層開始執行，等於 priority scheduling', '一直卡在最下層的 process 就會 starvation');
  },
  async (tok, S) => {                                   // 1403 等太久往上提
    await S.M.to(tok, 'P3', 1); S.M.b.P3.mood('happy'); good('aging：等太久就往上提一層', 1.0, 1.5, -2.0);
    sayc('所以一定也有 aging 機制', '程式等太久，就把它往上提升到上一個 queue');
  },
]);

scene('sch-17a-mlfq-ex', 'MLFQ 例子：Q0 RR 8、Q1 RR 16、Q2 FCFS', [[0, 7, 12], [0, 0.8, -0.6]], () => {
  const S = {};
  S.procs = [{ id: 'P1', arr: 0, burst: 30 }, { id: 'P2', arr: 1, burst: 6 }, { id: 'P3', arr: 2, burst: 14 }, { id: 'P4', arr: 20, burst: 3 }];
  S.res = simMLFQ(S.procs);
  S.t = 0;
  return S;
}, [
  async (tok, S) => {                                   // 1424 例子：queue 串在一起，job 會移動
    S.St = mlfqStage(S.procs, S.res); S.St.frame(0);
    sm('process 示意：P1 30、P2 6（t=1）、P3 14（t=2）、P4 3（t=20）', 0, 3.4, -3.6);
    sayc('例子：這次 queue 串在一起', '裡面的 job 會在 queue 之間移動');
  },
  async (tok, S) => {                                   // 1441 前兩層 RR：比較不會 starvation
    hot('前兩層都是 RR', -2.6, 1.0, -2.7);
    sayc('前兩層都是 round robin', '比較容易避免 starvation');
  },
  async (tok, S) => {                                   // 1451 quantum：上面 8 小、下面 16 大
    sm('Q0 只能做 8 → 很短就換人；Q1 可以做 16', -2.6, 1.6, -2.7);
    sayc('上面 quantum 小（8），下面大（16）', '8 的意思：一次只能執行 8 ms');
  },
  async (tok, S) => {                                   // 1468 8 ms 全用完 → 往下移
    const go = async (to) => { while (S.t < to) { S.t++; S.St.frame(S.t); await wt(tok, 45); } };
    S.go = go; await go(8);
    bad('P1 用完 8 還沒做完 → 降到 Q1', 0, 1.6, -1.0);
    sayc('把 8 ms 全部用完的話', '它的 CPU burst 一定超過 8 → 往下移');
  },
  async (tok, S) => {                                   // 1480 小於 8 的留在第一層：shorter job
    await S.go(14);
    good('P2 只要 6 < 8：留在 Q0（shorter than 8）', 0, 2.2, -1.0);
    sayc('CPU burst 小於 8 的程式', '才可以留在第一個 level：比較短的 job');
  },
  async (tok, S) => {                                   // 1499 16 以內：留在第二層
    await S.go(22);
    sm('P3 用完 8 → 降到 Q1；P4 剛到 → Q0（16 以內的就留在 Q1）', 0, 2.8, -1.0);
    sayc('中等長度的', '16 ms 以內就保留在第二層，還是比較快被執行');
  },
  async (tok, S) => {                                   // 1509 沒有短 job 時，第一層空了就換第二層
    await S.go(41);
    sm('Q0 空了 → Q1 的 P1 做 16，還沒完 → 沉到 Q2', 0, 3.4, -1.0);
    sayc('系統裡沒有 8 ms 以內的人時', '第一個空了，就開始找第二個 queue');
  },
  async (tok, S) => {                                   // 1522 兩層都空 → 全是 CPU-bound → 最下層
    await S.go(47);
    sm('P3 在 Q1 做完；只剩 CPU-bound 的 P1 在最下層', 0, 4.0, -1.0);
    sayc('兩層都空了', '代表都是 CPU-bound 的，每次 burst 都超過 16 → 丟到最下層');
  },
  async (tok, S) => {                                   // 1540 最下層 FCFS：不會 starvation
    await S.go(S.res.T);
    good('最下層 FCFS：先來的先 schedule 到，不容易 starvation', 0, 4.6, -1.0);
    sayc('最下層用 FCFS', '先來的就先 schedule 到，比較不會 starvation');
  },
  async (tok, S) => {                                   // 1567 自動貼近 SJF，比較不會 starvation
    hot('run time 自動貼近 shortest job first', 0, 5.2, -3.6);
    sayc('這樣拼的好處', 'run time 自動貼近 SJF，而且比較不會 starvation');
  },
  async (tok, S) => {                                   // 1589 拼法反過來 → 效能很差
    bad('反過來拼（大 quantum 在上）→ average wait 等指標會很差', 0, 0.3, 3.6);
    sayc('如果拼的方式剛好反過來', '整個系統的效能可能就會非常差');
  },
  async (tok, S) => {                                   // 1616 問答：下次回到 ready 時留在原本那層
    S.qa = pal('同學', '?', '#c08a1f', -5.6, 2.4, 0.5);
    bub('做完 burst 去 I/O 會離開 queue；下次回來 → 回到它原本那一層', -1.6, 1.6, 2.4);
    sayc('同學問：「保留在第一層」是什麼意思？', 'burst 做完去 I/O 會離開；下次進 ready queue 時留在原本那層');
  },
  async (tok, S) => {                                   // 1653 這些資訊記在 PCB 裡
    bx('PCB：scheduling info（在第幾層…）', '#c08a1f', 2.6, 0.2, 2.4, 3.8, 1.5, 0.4, 0.7);
    sayc('不用怕資訊遺失', '這些都記在 PCB（裡面有 scheduling 的資訊）；作業三也這樣做');
  },
  async (tok, S) => {                                   // 1685 最下層也有機會被執行
    sm('最下層也有機會：只要上面全空', 3.4, 0.2, -0.2);
    sayc('不要忘記', '最下層只要前面的 queue 全空，也會被執行');
  },
  async (tok, S) => {                                   // 1715 要設計：queue 數、演算法、何時升、何時降
    S.c = code(['MLFQ 要設計：', '· 幾個 queue', '· 每個 queue 的演算法', '· 何時 upgrade（往上）', '· 何時 downgrade（往下）'], 3.6, 5.6, 0.42, -3.8);
    sayc('MLFQ 要設計的 decision 又多了一點', 'queue 數量、各自演算法、何時往上、何時往下');
  },
  async (tok, S) => {                                   // 1744 MLFQ vs MLQ：名字像但完全不同；大部分系統用 feedback
    hot('MLQ：固定在一個 queue、照機率挑　｜　MLFQ：會移動、從最上層開始', 0, 0.3, 4.4);
    sayc('MLFQ 跟 MLQ 名字很像但完全不同', '大部分系統都用 feedback queue：run time 決定，不靠複雜數學');
  },
]);

scene('sch-17a-eval', '怎麼評估排程演算法', [[0, 6, 13], [0, 1.8, 0]], () => ({}), [
  async (tok, S) => {                                   // 1787 scheduling 是任何電腦系統的核心機制
    bub('scheduling：任何電腦系統的核心機制', 0, 5.6, -1);
    sayc('不只是作業系統', '任何電腦系統，scheduling 都是非常 fundamental 的機制');
  },
  async (tok, S) => {                                   // 1798 先定義 performance metric
    hd('① 先定義 metric：minimize response？wait？turnaround？', 0, 4.9, -1);
    sayc('怎麼 evaluate', '第一步：定義你的 performance metric');
  },
  async (tok, S) => {                                   // 1815 propose 一堆演算法
    sm('② propose 一堆演算法（有些理論上 optimal）→ 到底多好？', 0, 4.3, -1);
    sayc('第二步', 'propose 一堆演算法，再去 evaluate 新的到底多好');
  },
  async (tok, S) => {                                   // 1834 deterministic modeling：輸入全部給定，手動模擬
    S.x = (k) => -4.8 + k * 3.2;
    await rise(tok, S.x(0), 0, 0.8, PCOL[0], 500, 1.6, 1.4); hd('Deterministic', S.x(0), 1.3, 0); sm('輸入全給定，照例子走一遍', S.x(0), 0, 1.3);
    sayc('deterministic modeling', 'input 全部給你，像投影片例子一樣模擬一遍');
  },
  async (tok, S) => {                                   // 1860 問題：不 general
    bad('不 general：FCFS 先短後長很好，先長後短最糟', S.x(0) + 1.2, 2.2, 0);
    sayc('最大的問題：不 generalize', 'input 一改，結果就完全不同（FCFS 就是例子）');
  },
  async (tok, S) => {                                   // 1897 queueing model（理論）
    await rise(tok, S.x(1), 0, 1.7, PCOL[1], 500, 1.6, 1.4); hd('Queueing model', S.x(1), 2.2, 0); sm('scheduling 本來就是 queue', S.x(1), 0, 1.3);
    sayc('比較嚴謹：theoretical model', 'scheduling 就是 queue，可以 map 到 queueing theory');
  },
  async (tok, S) => {                                   // 1931 用機率分析
    sm('結果：有多少機率 wait time 是多少', S.x(1), 2.8, 0);
    sayc('用機率的方式分析', '得到百分之多少的機會，wait time、response time 是多少');
  },
  async (tok, S) => {                                   // 1956 限制：找不到完全吻合的 model
    note('限制：model 的 assumption 跟真實有落差', S.x(1), 0.3, 2.2);
    sayc('但它是 theory', '常找不到 exactly match 的 model，assumption 會有落差');
  },
  async (tok, S) => {                                   // 1974 simulation
    await rise(tok, S.x(2), 0, 2.6, PCOL[2], 500, 1.6, 1.4); hd('Simulation', S.x(2), 3.1, 0); sm('寫程式模擬', S.x(2), 0, 1.3);
    sayc('再來是 simulation', '寫一個程式，把演算法 implement 進去模擬');
  },
  async (tok, S) => {                                   // 1999 workload：real system log
    sm('workload：real system 的 log', S.x(2), 3.7, 0);
    sayc('收集非常多 workload', '例如真實系統的 log：什麼時候有哪些 job、burst 行為');
  },
  async (tok, S) => {                                   // 2029 implementation
    await rise(tok, S.x(3), 0, 3.5, PCOL[3], 500, 1.6, 1.4); hd('Implementation', S.x(3), 4.0, 0); sm('真的放進系統', S.x(3), 0, 1.3);
    sayc('simulate 覺得不錯', '就真的 implement 進系統');
  },
  async (tok, S) => {                                   // 2040 真實 overhead：context switch → quantum 不能太小
    bad('看得到真實 overhead：context switch（quantum 太小的壞處）', S.x(3) - 1.0, 4.7, 0);
    sayc('加入現實的 overhead', '像 context switch：simulation 不 care，實作才發現 quantum 不能太小');
  },
  async (tok, S) => {                                   // 2068 課堂用 deterministic；作業三像 simulator
    good('課堂：deterministic　作業三：OS simulator', 0, 0.3, 2.6);
    sayc('課堂裡大概只用第一種', '作業三的 Nachos 比較像 simulator，可用 real trace 更嚴謹');
  },
]);

scene('sch-17a-sum', '本章重點', CAM, () => ({}), [
  async (tok, S) => {                                   // 2116 演算法：preemptive / non-preemptive 怎麼模擬
    hd('① 各演算法：preemptive / non-preemptive 怎麼模擬（畫 Gantt chart）', 0, 3.6, -1.6);
    sayc('這一塊最重要', '這些演算法，尤其 preemptive / non-preemptive 怎麼模擬');
  },
  async (tok, S) => {                                   // 2124 MLFQ 與 MLQ 要區分
    hd('② multilevel feedback queue 和 multilevel queue 要分清楚', 0, 2.8, -1.6);
    sayc('還有', 'feedback queue 跟 multilevel queue 要區分出來');
  },
  async (tok, S) => {                                   // 2133 metrics 定義一定要記清楚
    hot('③ waiting / response / turnaround 的定義：記錯就算錯', 0, 2.0, -1.6);
    sayc('performance metrics 的定義', '一定要記清楚，記錯了算出來就是錯的');
  },
]);

// ════════ G4v9HUllv-Q（第 17B 講 Special Scheduling Issues） ════════
scene('sch-17b-layers', '軟體排程與硬體排程：兩層', CAM, () => ({}), [
  async (tok, S) => {                                   // 18 前面談的都是 software level 的 ready queue
    zone('software：OS 的 ready queue', 0, 0, -3.0, 12.0, 1.4).userData.name.position.set(0.0, 0.9, -3.0); // name right of the queue (raised), clear of the buddies and the cores' labels
    S.q = ['P1', 'P2', 'P3', 'P4'].map((n, i) => pal(n, '', PC[n], -4.6 + i * 1.3, -3.0, 0.5));
    sayc('剛剛談的 scheduling', '都在 software level：OS 的 ready queue');
  },
  async (tok, S) => {                                   // 21 下面還有 hardware
    zone('hardware', 0, 0, 0.6, 12.0, 3.2, '#e3d3b6').userData.name.position.set(6.1, 0.05, 0.6); // at the right end: the cores' thread labels fill the middle
    sayc('不要忘記', '下面還有真正的 computer hardware');
  },
  async (tok, S) => {                                   // 45 multiprocessor：主機板兩個 CPU 插槽
    S.cpu = [-3.2, 3.2].map((x) => bx('CPU', '#5d6b7a', x, 0.2, 0.6, 5.2, 1.5, 0.3, 2.6));
    sayc('multiprocessor', '不只一顆 CPU：主機板上有兩個 CPU 插槽');
  },
  async (tok, S) => {                                   // 62 一顆 CPU 裡又是 multicore（手機八核心）
    S.cores = []; for (const cx of [-3.2, 3.2]) for (let k = 0; k < 4; k++) S.cores.push(bx('core', '#4b9ee2', cx - 1.8 + k * 1.2, 0.55, 0.6, 1.0, 1.2, 0.4, 1.0));
    sayc('買來的一顆 CPU 裡', '又是 multicore：手機八核心、四核心');
  },
  async (tok, S) => {                                   // 73 一個 core 跑兩個 thread（hyper-threading）；GPU 更多
    S.cores.forEach((c) => { sm('×2', c.position.x, 1.1, 0.6); }); // 2 threads per core (short: the cores are close together)
    note('Intel hyper-threading：一個 physical core 跑 2 個 thread；GPU 一個 core 十幾、二十幾個', 0, 0.3, 2.6);
    sayc('甚至一個 core 可以跑兩個 thread', 'Intel hyper-threading；GPU 一個 core 的 thread 更多');
  },
  async (tok, S) => {                                   // 95 hardware 這邊也是一層一層抽象
    sm('CPU → core → hardware thread：一層一層', 0, 0.3, 3.4);
    sayc('hardware 的 core 數', '也是一層一層抽象，可能非常多');
  },
  async (tok, S) => {                                   // 103 OS 只排順序；hardware 說有空位，OS 給一個
    S.slot = bub('有 slot 空了，給我一個 process', 3.2, 2.2, 0.6);
    await walk(tok, S.q[0], 3.2, -0.6, 800);
    sayc('OS 這邊只是排順序', 'hardware 說有 slot 空了，OS 就選一個 process 給它');
  },
  async (tok, S) => {                                   // 120 跑在哪個 CPU、哪個 core、跟誰共用：hardware 決定
    gone(S.slot); hot('core 裡的 hardware thread 誰在跑：hardware 決定', 0, 3.2, 0.6);
    sayc('老師：跑在哪、跟誰共用 core，由 hardware 決定', '課本：OS 把 thread 放到 logical CPU；core 再決定跑哪個 hardware thread');
  },
  async (tok, S) => {                                   // 135 兩層 scheduling
    good('兩層 scheduling：OS（software）＋ CPU（hardware）', 0, 4.0, -3.0);
    sayc('所以其實是兩層的 scheduling', '剛才提的都只是 OS 那一層');
  },
  async (tok, S) => {                                   // 156 之後：real-time scheduling 要 meet deadline
    note('預告：real-time scheduling：設計不好就 miss deadline', 0, 4.8, -3.0);
    sayc('最後會講 real-time scheduling', '要能 meet deadline，演算法要很特殊、很嚴謹');
  },
]);

scene('sch-17b-smp', 'Asymmetric vs symmetric multiprocessing', [[0, 7, 12.5], [0, 0.8, 0]], () => ({}), [
  async (tok, S) => {                                   // 195 OS 看到的就是幾顆 CPU
    S.os = bx('OS 選好的 process', '#c9b48e', 0, 0.3, -3.6, 3.6, 0, 0.5, 0.9);
    sayc('一台機器好幾顆 CPU', 'OS 看到的就是：有幾顆 CPU、什麼時候丟 process 給它');
  },
  async (tok, S) => {                                   // 208 分 asymmetric 與 symmetric
    hd('Asymmetric', -3.6, 0.2, -2.6); hot('Symmetric（SMP）', 3.6, 0.2, -2.6);
    sayc('分成兩種', 'asymmetric（角色不同）與 symmetric（所有 CPU 角色相同）');
  },
  async (tok, S) => {                                   // 220 asymmetric：一顆 master 管所有 process、再分配
    S.master = pal('master', '', '#9b7ef4', -3.6, -1.4, 0.7);
    S.sl = [0, 1, 2].map((k) => bx('CPU' + (k + 1), CPUC, -5.2 + k * 1.6, 0.3, 0.8, 1.2, 0, 0.6, 0.9));
    for (let k = 0; k < 3; k++) await flyL(tok, 'pkt', 'P', V3(-3.6, 1.2, -1.4), V3(-5.2 + k * 1.6, 0.9, 0.8), 380);
    sayc('asymmetric：其中一顆是 master', 'OS 選中的全交給 master，再由它分配到哪顆 processor');
  },
  async (tok, S) => {                                   // 249 symmetric：沒有 master，大家搶同一個 queue
    S.q = [0, 1, 2, 3].map((k) => bx('P' + (k + 1), PCOL[k], 2.1 + k * 1.05, 0.25, -1.4, 0.6, 0, 0.5, 0.6)); // spaced so the names don't touch
    S.cp = [0, 1, 2].map((k) => pal('CPU' + (k + 1), '', CPUC, 2.0 + k * 1.6, 0.8, 0.5));
    sm('同一個 ready queue，不屬於任何人', 3.6, 0, -0.6);
    sayc('symmetric：沒有 master', '所有 CPU 去競爭同一個 queue');
  },
  async (tok, S) => {                                   // 265 dequeue 要 synchronization
    S.lock = prop('lock', 3.6, 0.6, -1.4, 0.7);
    for (let k = 0; k < 3; k++) { S.cp[k].mood('wow'); await slide(tok, S.q[k], 2.0 + k * 1.6, 1.9, 0.8, 420); S.cp[k].mood('happy'); } // each P is held up above its CPU, clear of the queue behind
    sayc('一個 process 不能同時跑在兩顆 CPU', 'dequeue 時要確保只有一個人拿到 → synchronization');
  },
  async (tok, S) => {                                   // 288 所以稍微慢一點點
    sm('要搶 lock → 稍微慢一點點', 3.6, 2.2, -1.4);
    sayc('誰搶得到要透過 synchronization', '所以會慢那麼一點點（真的很小）');
  },
  async (tok, S) => {                                   // 298 master 不跑一般程式 → 使用率低 → 一般電腦是 SMP
    S.master.mood('sad'); bad('master 不跑一般程式 → 使用率可能很低', -3.6, 1.6, -1.4);
    good('一般電腦：SMP', 3.6, 3.0, -1.4);
    sayc('asymmetric 的壞處', 'master 不執行一般程式，使用率可能很低 → 一般電腦都是 SMP');
  },
]);

scene('sch-17b-affinity', 'Processor affinity：cache reuse，soft / hard', [[0, 6.5, 12], [0, 1, 0]], () => {
  const S = {};
  S.core = [-3, 3].map((x, k) => { bx('core ' + k, CPUC, x, 0.35, -1.2, 2.2, 0, 0.7, 1.4); sm('L1 cache', x, 0, 0.6); return x; });
  S.cache = [[], []];
  S.fill = async (tok, k, n, c) => { for (let j = 0; j < n; j++) { S.cache[k].push(bx('', c, S.core[k] - 0.9 + (S.cache[k].length % 5) * 0.45, 0.15, 1.3 + Math.floor(S.cache[k].length / 5) * 0.45, 0.42, 1.5, 0.3, 0.42)); await wt(tok, 110); } };
  return S;
}, [
  async (tok, S) => {                                   // 317 hardware level：affinity 跟 scheduling 息息相關
    hot('affinity：跟 scheduler 關係很大', 0, 3.4, -1.2);
    sayc('另一個跟 scheduling 息息相關的', 'affinity（一開始就點到過）');
  },
  async (tok, S) => {                                   // 335 綁在指定的 core；被佔走就等
    S.p = pal('P', '', '#e55a9b', S.core[0], -2.4, 0.6); await walk(tok, S.p, S.core[0], -1.2, 400);
    sm('P 綁在 core 0：core 0 被佔走就等', S.core[0], 2.0, -1.2);
    sayc('affinity：把程式綁在指定的 CPU core', '一定要 run 那個 core；被別人佔走就要等');
  },
  async (tok, S) => {                                   // 348 好處：cache reuse（L1 各 core 分開）
    await S.fill(tok, 0, 8, '#e55a9b');
    good('cache 裡都是 P 的資料 → reuse，跑更快', S.core[0], 2.6, -1.2);
    sayc('好處：cache 可以 reuse', '最靠近 core 的 L1 cache 各 core 分開，所以跑得更快');
  },
  async (tok, S) => {                                   // 361 很講求效能、process 數可控 → 大家都用
    S.u = pal('使用者', '', '#c08a1f', 0, 1.2, 0.5); bub('下指令：把 P 綁在 core 0', 0, 1.9, 2.4);
    sayc('很講求效能、process 數量可控時', '大家都會用 affinity：下指令給 OS，OS 再跟 hardware 講');
  },
  async (tok, S) => {                                   // 377 affinity 等於 scheduling 上的限制
    note('affinity = 對 scheduler 的限制：只能把 P 排在這個 core', 0, 0.3, 3.4);
    sayc('這等於是 scheduling 上的限制', 'affinity 是透過 scheduler 來控制的');
  },
  async (tok, S) => {                                   // 388 soft：太忙或等太久就排到別的 core
    await walk(tok, S.p, S.core[1], -1.2, 700); S.cache[0].forEach((m) => tint(m, '#d8cfc0')); await S.fill(tok, 1, 5, '#e55a9b');
    sm('soft affinity：core 太忙／等太久 → 搬到別的 core（cache 要重抓）', 0, 0.3, 4.1);
    sayc('soft affinity', '那個 core loading 太重或等太久，就排到別的 core');
  },
  async (tok, S) => {                                   // 398 hard：無論如何都不換，寧可等
    await walk(tok, S.p, S.core[0], -1.2, 700); S.cache[0].forEach((m) => tint(m, '#e55a9b'));
    hot('hard affinity：無論如何都在這裡，寧可等', 0, 0.3, 4.8);
    sayc('hard affinity', '無論如何都不排到別的地方，寧可等');
  },
]);

// ════════ 0NRkuhnupzs（第 18A 講 Special Scheduling Issues） ════════
scene('sch-18a-affinity', '回顧：兩層排程與 affinity', [[0, 6.5, 12], [0, 1, 0]], () => ({}), [
  async (tok, S) => {                                   // 3 前半段：software level 的 scheduling
    zone('software（OS）：SJF、priority…', 0, 0, -3.2, 12.0, 1.2);
    sayc('這一章前半段', '都在講 software / OS level 的 scheduling');
  },
  async (tok, S) => {                                   // 7 hardware level 也有 scheduling decision：兩層
    zone('hardware：也有 scheduling decision', 0, 0, 0.4, 12.0, 3.4, '#e3d3b6');
    sayc('不要忘記 hardware level', 'CPU、主機板運作時也有 scheduling decision：分兩層');
  },
  async (tok, S) => {                                   // 53 processor 的 scheduling 跟 memory access、cache 有關
    S.core = [-3, 3].map((x, k) => { bx('processor ' + k, CPUC, x, 0.35, -0.4, 2.4, 0, 0.7, 1.2); return x; });
    S.c = [-3, 3].map((x) => bx('cache', '#c9e3f6', x, 0.2, 1.1, 2.0, 0, 0.3, 0.8));
    sayc('scheduling 的問題不只是 CPU', '還跟 memory access、cache 的運作有很大關聯');
  },
  async (tok, S) => {                                   // 73 affinity：把 process / thread pin 在特定 processor / core
    S.p = pal('P', '', '#e55a9b', -3, -2.0, 0.55); await walk(tok, S.p, -3, -1.0, 500);
    S.pin = hot('📌 pin / bind 在 processor 0', -3, 2.0, -0.4);
    sayc('affinity 的定義', '把 process、thread pin（bind）在特定的 processor 或 core');
  },
  async (tok, S) => {                                   // 86 為了 reuse cache、增加 hit rate
    glow(S.c[0], '#0f5a3a'); good('cache hit rate ↑', -3, 0.9, 2.0);
    sayc('最主要的原因', '可以 reuse cache，增加 cache 的 hit rate');
  },
  async (tok, S) => {                                   // 93 不同 processor 的 cache 通常不共用
    bad('不共用', 0, 0.6, 1.1); glow(S.c[1], '#555555');
    sayc('因為不同 processor', '它們的 cache 通常是不 share 的');
  },
  async (tok, S) => {                                   // 104 目的：cache line reuse → 跑更快
    sm('cache 比 main memory 快 → 跑得更快（但會影響 scheduling 的選擇）', 0, 0.3, 3.2);
    sayc('它會影響 scheduling decision', '目的是增加 cache line 的 reuse，cache 比 memory 快');
  },
]);

scene('sch-18a-numa', 'NUMA：排在資料所在的 CPU', [[0, 7, 12], [0, 0.8, 0]], () => ({}), [
  async (tok, S) => {                                   // 121 memory architecture：UMA vs NUMA
    hd('UMA：每顆 CPU 到 memory 一樣快　NUMA：不一樣快', 0, 3.6, -2);
    sayc('另一個跟 memory access 相關的', 'memory architecture 分 UMA 與 NUMA');
  },
  async (tok, S) => {                                   // 139 比較大、processor 多的系統：NUMA
    S.cpu = [-3.5, 3.5].map((x, k) => { bx('CPU ' + k, CPUC, x, 0.4, -2, 2.6, 1.5, 0.8, 1.4); return x; });
    S.mem = [-3.5, 3.5].map((x, k) => { bx('memory ' + k, '#c9b48e', x, 0.3, 1.4, 2.6, 1.5, 0.6, 1.2); return x; });
    sayc('scale 比較大、processor 比較多', '通常採用 NUMA（Non-Uniform），memory 也有 hierarchy');
  },
  async (tok, S) => {                                   // 160 不同 CPU access 不同 chip 上的 memory，速度不一樣
    arrow(V3(-3.5, 0.9, -1.2), V3(-3.5, 0.9, 0.7), 0x2fc092); arrow(V3(-2.2, 0.9, -1.6), V3(2.4, 0.9, 1.0), 0xd64545);
    good('local：快', -3.5, 1.4, -0.2); bad('remote：慢', 0, 1.4, 0.4);
    sayc('不同的 CPU 去 access', 'memory 放在哪一個 chip 上，速度就不一樣');
  },
  async (tok, S) => {                                   // 171 排程時希望放在跟 memory 同一個位置
    S.p = pal('P', '', '#e55a9b', -3.5, -0.4, 0.5); S.d = bx('P 的資料', '#e55a9b', -3.5, 0.9, 1.4, 1.2, 1.5, 0.4, 0.8);
    sayc('schedule process 的時候', '希望放在跟它的 memory 同一個位置，access time 才短');
  },
  async (tok, S) => {                                   // 183 資料建立後就在那裡；搬資料（memory copy）很貴
    sm('資料一 create 就在那裡；搬資料 = memory copy，很花時間', 0, 0.3, 3.0);
    sayc('memory 一旦被 create', '就在那個地方；要 migrate data 是 memory copy，cost 很高');
  },
  async (tok, S) => {                                   // 197 每次 reschedule：希望放回同一個 processor
    await walk(tok, S.p, 3.5, -0.4, 700); S.p.mood('sad'); S.p.glow('#3a0a0a');
    await wt(tok, 300); await walk(tok, S.p, -3.5, -0.4, 700); S.p.mood('happy'); S.p.glow(null);
    sayc('OS 可以定期 rescheduling', '被排到 CPU 1 就每次都要跨過去；希望放回同一個 processor');
  },
  async (tok, S) => {                                   // 225 thread programming：用 flag 給 OS hint
    S.c = code(['// thread programming（示意）', 'flag：memory 要 local', 'flag：綁在同一顆 CPU（affinity）'], 0, 5.4, 0.46, -3.6);
    sayc('寫 thread programming 時', '可以透過 flag 給 OS hint：要求 local memory 或綁在同一顆 CPU');
  },
  async (tok, S) => {                                   // 249 NUMA 以 CPU 為單位：同一顆 CPU 上哪個 core 都可以
    for (let k = 0; k < 3; k++) sm('core', -4.5 + k, 1.1, -2.6);
    sm('同一顆 CPU 上哪個 core 都可以（同一個 memory bank）', -3.5, 1.6, -2.6);
    sayc('NUMA 是以 CPU 為單位', 'CPU 上好幾個 core，run 在哪一個無所謂');
  },
  async (tok, S) => {                                   // 263 會嚴重影響執行效能
    hot('NUMA placement 會嚴重影響執行效能', 0, 4.4, -2);
    sayc('所以 NUMA', '對 process scheduling 的影響也存在，會嚴重影響效能');
  },
]);

scene('sch-18a-lb', 'Locality vs load balancing：push 與 pull', [[0, 6.5, 12.5], [0, 1.5, 0]], () => ({}), [
  async (tok, S) => {                                   // 277 locality → 綁在某 processor；trade-off：load balancing
    S.cols = [0, 1, 2, 3].map((k) => { const x = -4.5 + k * 3; hd('core ' + k, x, 0, 1.2); return { x, st: [] }; });
    S.put = (k, c) => { const C = S.cols[k]; const m = bx('', c || PCOL[k], C.x, 0.23 + C.st.length * 0.5, 0, 1.0, 0, 0.45, 0.9); C.st.push(m); return m; };
    sayc('因為 data 的 locality', '使用者想指定在某個 processor 上，但 trade-off 是 load balancing');
  },
  async (tok, S) => {                                   // 293 一開始隨機放，跑了之後有 data、cache → 想綁著
    for (let k = 0; k < 4; k++) { S.put(k); await wt(tok, 150); }
    sm('一開始在哪個 core 可能是 random；跑了就有 data、cache → 想綁著', 0, 0.3, 2.4);
    sayc('一開始放在哪顆可能是 random', '但一旦在那裡 run，就 create 了 data、有了 cache');
  },
  async (tok, S) => {                                   // 312 那顆的 loading 變多 → wait time 變久
    for (let j = 0; j < 4; j++) { S.put(0, PCOL[0]); await wt(tok, 120); } S.put(2); S.put(2);
    bad('core 0 很忙、core 3 很閒 → 不 balance', -1.5, 3.4, 0);
    sayc('結果那顆 CPU 的 loading', '或想在上面執行的 process 比別人多，wait time 就久');
  },
  async (tok, S) => {                                   // 324 locality vs load balancing：trade-off
    hot('locality ⟷ load balancing：trade-off', 0, 4.2, 0);
    sayc('locality data access', '跟整體系統的 load balancing 往往是 trade-off');
  },
  async (tok, S) => {                                   // 336 hardware 內部通常有 load balancing
    sm('load balancing：讓每個 core 的工作量差不多（課本：SMP 的 OS scheduler 做）', 0, 0.3, 3.1);
    sayc('老師：CPU 內部通常會 implement load balancing', '課本把它放在 SMP 的 OS 排程裡講（例如 Linux）');
  },
  async (tok, S) => {                                   // 356 分成 push 與 pull
    sayc('怎麼做 load balancing', '通常分成 push 跟 pull 兩種');
  },
  async (tok, S) => {                                   // 363 push：loading 重的推給輕的
    const m = S.cols[0].st.pop(); glow(m, '#6a4a00'); S.cols[3].st.push(m); move(m, S.cols[3].x, 0.23, 0);
    S.pu = good('push：忙的 core 0 主動把工作推給閒的', -1.5, 5.0, 0);
    await wt(tok, 600);
    sayc('push', '從 loading 比較重的，主動把工作 push 給 loading 比較輕的');
  },
  async (tok, S) => {                                   // 394 migration 有 source、destination：誰先 initiate
    sm('migration：一個 source、一個 destination → 看誰先 initiate', 0, 0.3, 3.8);
    sayc('migration 一定有 source 和 destination', '兩個人誰先 initiate，就分成這兩種 model');
  },
  async (tok, S) => {                                   // 414 pull：queue 空了（甚至 idle）的去拉
    const m = S.cols[0].st.pop(); S.cols[1].st.push(m); move(m, S.cols[1].x, 0.23 + (S.cols[1].st.length - 1) * 0.5, 0);
    good('pull：閒的 core 1 主動把工作拉過來', 1.5, 5.6, 0);
    await wt(tok, 600);
    sayc('pull 反過來', 'loading 低的（queue 空了、甚至 idle）主動把工作拉過來');
  },
  async (tok, S) => {                                   // 432 結果一樣，差在誰先發起
    sm('結果一樣，只差在誰發起（implementation / design 上的差別）', 0, 0.3, 4.5);
    sayc('兩個結果其實一樣', '差別只在誰先 initiate migration');
  },
  async (tok, S) => {                                   // 451 怎麼選：看整個系統 loading 高還是低
    bub('push 還是 pull？看整個系統的 loading', 0, 6.2, 0);
    sayc('實際怎麼選', '看整個系統的 loading 是高還是低');
  },
  async (tok, S) => {                                   // 461 migration 要兩人都同意；每次詢問都浪費時間
    sm('每次詢問都是 overhead → 希望發起的人越少越好', 0, 0.3, 5.2);
    sayc('migration 要一個高一個低才成立', '每次詢問都浪費時間：initiate 的人不要太多');
  },
  async (tok, S) => {                                   // 490 loading 高 → 閒的人少 → pull
    hot('系統很忙（閒的人少）→ 用 pull', -3, 3.0, 2.6);
    sayc('整個系統 loading 都很高', '代表很少人 loading 低 → 用 pull，由少數閒的人發起');
  },
  async (tok, S) => {                                   // 531 loading 低 → push
    hot('系統很閒（忙的人少）→ 用 push', 3, 3.0, 2.6);
    sayc('整個系統 loading 很低', '大部分人沒什麼工作 → 用 push，只有少數忙的人發起');
  },
  async (tok, S) => {                                   // 576 重點：affinity 與 load balancing 的 trade-off
    good('重點：affinity（綁定）越緊 → load balancing 越差', 0, 0.3, 6.0);
    sayc('比較重要的還是 affinity', '為什麼要綁在特定位置，以及它跟 load balancing 的 trade-off');
  },
]);

scene('sch-18a-stall', 'Multicore 與 memory stall', [[0, 6, 12.5], [0, 1.2, 0]], () => ({}), [
  async (tok, S) => {                                   // 593 更深入：單一顆 CPU 有多個 core
    S.cpu = bx('一顆 CPU', '#5d6b7a', 0, 0.15, -3.0, 6.0, 0, 0.3, 1.6);
    S.cpu.userData.lbl.center.set(0, 0.5); S.cpu.userData.lbl.position.set(3.2, 0, 0); // the chip's name at its right end: cores on top, timelines in front
    [-2, 0, 2].forEach((x) => bx('core', CPUC, x, 0.5, -3.0, 1.4, 1.2, 0.4, 1.0));
    sayc('再深入一點，單一顆 CPU', '現在基本上都是多核心');
  },
  async (tok, S) => {                                   // 621 更 low level：memory stall
    hot('更 low level 的問題：memory stall', 0, 1.6, -3.0);
    sayc('一個 core 要執行很多 thread 時', '還要考慮 memory stall');
  },
  async (tok, S) => {                                   // 631 一個指令分好幾個 cycle，其中一個是 access memory
    hd('thread 0', -6.4, 0.2, -1.2);
    S.x = -5.6; for (const [k, w] of [['C', 1], ['M', 2.0]]) { await grow(tok, S.x, S.x + w, 0.25, -1.2, k === 'C' ? CPUC : '#d8cfc0', k === 'C' ? 'compute' : 'memory', 400); S.x += w + 0.05; }
    sayc('一個 instruction 執行分好幾個 cycle', '其中很重要的一個是 access memory');
  },
  async (tok, S) => {                                   // 648 memory bus 共用 → 撞到 → stall
    S.st = bad('memory bus 共用 → collision → stall', -2.6, 1.0, -1.2);
    sayc('memory bus 是 shared', '不同 instruction 的 memory cycle 可能撞到 → stall');
  },
  async (tok, S) => {                                   // 665 stall 時 CPU 沒在執行指令
    for (const [k, w] of [['C', 1], ['M', 2.0], ['C', 1]]) { await grow(tok, S.x, S.x + w, 0.25, -1.2, k === 'C' ? CPUC : '#d8cfc0', k === 'C' ? 'compute' : 'stall', 300); S.x += w + 0.05; }
    sm('灰色：CPU 沒在跑指令，卡在等 memory', 0, 0.2, -0.4);
    sayc('memory stall 時', 'CPU 其實沒有在執行 instruction，卡在 memory 這一塊');
  },
  async (tok, S) => {                                   // 679 hyper-threading、GPU：一個 core 好幾個 hardware thread
    note('Intel hyper-threading、GPU：一個 core 有好幾個 hardware thread（10 個以上）', 0, 0.3, 3.6);
    sayc('所以有 hyper-threading 這類技術', 'GPU 一個 core 甚至有 10 個以上的 hardware thread');
  },
  async (tok, S) => {                                   // 697 為什麼速度不變慢：利用 stall 的空檔
    hd('thread 1', -6.4, 0.2, 0.6);
    let x = -5.6 + 1.05; for (let j = 0; j < 2; j++) { await grow(tok, x, x + 1.0, 0.25, 0.6, IOC, 'compute', 400); x += 3.1; }
    sayc('為什麼一個 core 跑很多 thread 卻不變慢', '因為利用了 memory stall 的空檔');
  },
  async (tok, S) => {                                   // 715 怎麼利用 stall 塞另一個 thread：hardware level scheduling
    good('stall 空檔塞另一個 thread → hardware level 的 scheduling', 0, 2.2, 0.6);
    sayc('怎麼在 memory stall 的空間 schedule 另一個 thread', '也是 hardware level 的 scheduling');
  },
  async (tok, S) => {                                   // 725 overlap 執行與 memory cycle；加 register 塞更多
    sm('overlap：一個在算、另一個在等 memory；加 register 還能塞更多（GPU）', 0, 0.3, 2.4);
    sayc('把執行跟 memory cycle overlap', '就能塞進兩個 thread；加 register 還能塞更多');
  },
  async (tok, S) => {                                   // 754 這是 hardware pipeline 的層次
    S.pipe = [0, 1, 2, 3, 4].map((k) => bx(['IF', 'ID', 'EX', 'MEM', 'WB'][k], '#e9dcc4', -3 + k * 1.5, 0.25, 4.0, 1.3, 1.2, 0.4, 0.8));
    sm('hardware 的 instruction pipeline（換 thread 時要處理裡面的狀態）', 0, 0.9, 4.0);
    sayc('這已經是 hardware 的 pipeline', '換 thread 時，要處理 pipeline 裡的東西');
  },
  async (tok, S) => {                                   // 796 coarse-grained：把整個 pipeline flush 掉
    for (const m of S.pipe) { tint(m, '#d8cfc0'); await wt(tok, 90); }
    bad('coarse-grained：flush 整個 pipeline 再換人', -3.4, 1.6, 4.0);
    sayc('coarse-grained', '把整個 pipeline flush 掉，再換另一個 thread');
  },
  async (tok, S) => {                                   // 807 fine-grained：用額外 hardware register 保留 pipeline state
    for (const m of S.pipe) tint(m, '#2fc092');
    good('fine-grained：多加 hardware register 保留 state，直接切換', 3.4, 1.6, 4.0);
    sayc('fine-grained', '增加 hardware register 保留 pipeline 的 state，直接換另一個執行');
  },
  async (tok, S) => {                                   // 841 簡單講：coarse flush；fine 保留 state 跑沒 stall 的 thread
    sm('coarse：flush　｜　fine：保留 state，跑沒有 stall 的 thread', 0, 0.3, 5.2);
    sayc('簡單講', 'coarse 會 flush pipeline；fine 保留 state，去跑沒有 memory stall 的 thread');
  },
  async (tok, S) => {                                   // 861 這些都是 hardware level；OS 管 ready queue 的順序
    hd('OS（software）：管 ready queue 的順序', 0, 4.4, -3.0);
    sayc('這些都比較在 hardware level', 'OS 這邊管的是 process 的順序（ready queue）');
  },
  async (tok, S) => {                                   // 895 OS 只在乎有幾個可執行的位置、順序是什麼
    sm('hardware 告訴 OS：有幾個可執行的位置 → OS 給順序', 0, 3.8, -3.0);
    sayc('hardware scheduling 已經做進 CPU 裡', 'OS 只在乎現在有幾個能執行的位置、順序是什麼');
  },
]);

scene('sch-18a-rt', 'Real-time：deadline 與 (period, execution)', [[0, 6.5, 12.5], [0, 0.6, 0]], () => ({}), [
  async (tok, S) => {                                   // 913 real-time scheduling
    hot('Real-time scheduling', 0, 3.6, -2.4);
    sayc('最後，比較重要的', 'real-time 的 scheduling');
  },
  async (tok, S) => {                                   // 924 之前都是看 wait time 或系統角度
    sm('之前：看 wait time、整個系統的效能', 0, 3.0, -2.4);
    sayc('之前介紹的 OS scheduling', '都是用 wait time 或整個系統的角度');
  },
  async (tok, S) => {                                   // 940 real-time：必須在 deadline 前完成，不是越快越好
    good('real-time：在 deadline 之前完成（不是越快越好）', 0, 2.4, -2.4);
    sayc('real-time 的定義', '必須在 deadline 之前完成那件事，重點不是越快越好');
  },
  async (tok, S) => {                                   // 952 一般 scheduling 不知道 deadline；real-time 會給
    sm('一般 scheduling 不知道 deadline；real-time 一定會給 deadline', 0, 1.8, -2.4);
    sayc('跟一般 scheduling 不同', '一般不會知道 deadline，real-time 一定會給你 deadline');
  },
  async (tok, S) => {                                   // 964 soft vs hard
    hd('soft：盡量避免 miss', -3.2, 0.3, 0); hd('hard：必須 guarantee 不 miss', 3.2, 0.3, 0);
    sayc('分成 soft 跟 hard', 'soft 盡量避免 miss deadline；hard 要有演算法可以保證');
  },
  async (tok, S) => {                                   // 988 media streaming：soft
    prop('monitor', -3.2, 0, -1.0, 0.7); sm('media streaming：偶爾不清楚沒關係', -3.2, 0, 1.0);
    sayc('一般的 media streaming', '有時影像清楚、有時不太清楚，沒差：soft');
  },
  async (tok, S) => {                                   // 1001 hard：control system（汽車、武器、核電廠）
    sm('control system：汽車、武器、核電廠 → miss = 車禍、偏離目標', 3.2, 0, 1.0); bad('miss 一次就很嚴重', 3.2, 1.4, -1.0);
    sayc('hard 的應用非常廣', '大部分 control system：汽車、武器、核電廠；miss 就出大事');
  },
  async (tok, S) => {                                   // 1030 用一個 tuple 描述
    S.c = code(['real-time task = ( ready time, execution, period )'], 0, 5.0, 0.5, -3.6);
    sayc('這類問題有很 general 的描述方式', '用三個 parameter 的 tuple');
  },
  async (tok, S) => {                                   // 1050 ready time：什麼時候開始進系統
    sm('ready time：什麼時候進系統（跟一般工作一樣）', -2.4, 4.4, -3.6);
    sayc('第一個：ready time', '這個 process 什麼時候進系統開始執行');
  },
  async (tok, S) => {                                   // 1061 execution：每次 CPU burst 的長度
    sm('execution：每次 CPU burst 多長', -2.4, 3.9, -3.6);
    sayc('第二個：execution', '就像 CPU burst：每次要執行多久');
  },
  async (tok, S) => {                                   // 1076 period：多久來一次（≈ deadline）
    sm('period：多久來下一個 CPU burst（也可以想成 deadline）', -2.4, 3.4, -3.6);
    sayc('第三個 real-time 才特別用：period', '多久會產生下一次 CPU burst，也可以想成 deadline');
  },
  async (tok, S) => {                                   // 1088 要保證 deadline，job 必須很有規律
    note('沒有規律就沒辦法保證：預測錯就 miss', 3.6, 2.6, -2.4);
    sayc('要保證 meet the deadline', '這種 job 必須很有規律，不然預測錯就 miss 了');
  },
  async (tok, S) => {                                   // 1115 例：每 10 個 time unit 來一次，要做 4
    S.sx = 12 / 30; S.x0 = -6;
    for (let r = 0; r < 30; r += 10) { const pin = lab.box('#c08a1f', [0.06, 1.2, 0.06]); pin.position.set(S.x0 + r * S.sx, 0.6, 3.0); lab.world.add(pin); sm('到 ' + r, S.x0 + r * S.sx, 1.4, 3.0); }
    for (let r = 0; r < 30; r += 10) await grow(tok, S.x0 + r * S.sx, S.x0 + (r + 4) * S.sx, 0.25, 3.8, CPUC, 'e=4', 300);
    sayc('例：period 10', '每 10 個 time unit 來一個 burst，每次要執行 4 個 unit');
  },
  async (tok, S) => {                                   // 1128 要在下一次 burst 來之前做完
    for (let r = 10; r <= 30; r += 10) sm('deadline ' + r, S.x0 + r * S.sx - 0.4, 0.2, 4.7);
    sayc('每一次都必須', '在下一次 burst 來之前把它做完');
  },
  async (tok, S) => {                                   // 1157 這裡介紹的兩個用在 soft real-time
    hot('接下來兩個基本演算法：RM 與 EDF', 0, 5.6, -3.6);
    sayc('老師說這兩個用在 soft real-time', '課本：使用率夠低時它們能保證趕上 deadline（hard 也用）');
  },
]);

scene('sch-18a-rmedf', 'Rate-Monotonic（static）與 EDF（dynamic）', CAM, () => ({}), [
  async (tok, S) => {                                   // 1166 第一個：rate monotonic
    hd('① Rate-Monotonic', -3.4, 3.6, -2.0);
    sayc('第一個', 'rate monotonic');
  },
  async (tok, S) => {                                   // 1174 static priority scheduling：依 period 固定順序
    sm('static priority：依 period 固定每個 process 的順序', -3.4, 3.0, -2.0);
    sayc('它就是一個 static 的 priority scheduling', '固定每個 process 的順序，based on period');
  },
  async (tok, S) => {                                   // 1191 period 越短越急 → 先做
    S.t = [['T 4', 4], ['T 5', 5], ['T 20', 20]].map(([n, p], k) => { const b = pal(n, 'p=' + p, ['#d64545', '#dd8238', '#2fc092'][k], -5.2 + k * 1.5, -0.4, 0.55); return b; });
    S.t[0].mood('wow'); sm('period 短 = 比較趕 → priority 高', -3.7, 0.2, 0.9);
    sayc('period 越短的越急', '就像寫作業：越趕的先做');
  },
  async (tok, S) => {                                   // 1206 period 是常數 → run time 不變
    sm('period 是 given constant → priority run time 不會變', -3.4, 2.4, -2.0);
    sayc('period 是 given constant', '所以 priority 在 run time 不會變動');
  },
  async (tok, S) => {                                   // 1219 名字：rate = period，monotonic = 單調排序
    sm('rate = 出現頻率（1 / period）；monotonic = 單調：rate 越高 priority 越高', -3.4, 1.8, -2.0);
    sayc('名字的意思', 'rate 是出現的頻率（1/period）；priority 隨 rate 單調排序');
  },
  async (tok, S) => {                                   // 1231 EDF：dynamic
    hot('② EDF（Earliest Deadline First）：dynamic', 3.4, 3.6, -2.0);
    sayc('另一個更常用的', 'dynamic 的 earliest deadline first（EDF）');
  },
  async (tok, S) => {                                   // 1243 像寫作業：deadline 最近的先做
    S.hw = [['作業 A', '剩 3 天'], ['作業 B', '剩 10 天']].map(([n, d], k) => { const b = pal(n, d, k ? '#9b7ef4' : '#e55a9b', 2.4 + k * 2.2, -0.4, 0.55); return b; });
    S.hw[0].mood('wow'); good('剩 3 天的先做！', 2.4, 1.4, -0.4);
    sayc('大家寫作業都用這個 algorithm', '看 deadline：剩三天的趕快先做');
  },
  async (tok, S) => {                                   // 1261 period 長不代表 deadline 遠
    sm('period 長 ≠ deadline 遠：很早 announce 的作業放到只剩兩天', 3.4, 0.2, 1.2);
    sayc('period 很長不代表 deadline 最遠', '很早 announce 的作業，放著放著也會只剩兩天');
  },
  async (tok, S) => {                                   // 1288 dynamic priority algorithm
    sm('誰 deadline 最近，看「當下」→ priority 一直在變', 3.4, 3.0, -2.0);
    sayc('所以 EDF 是 dynamic priority', 'deadline depends on 目前的狀態');
  },
  async (tok, S) => {                                   // 1295 可證明 miss rate 的上界；不錯但不保證不 miss
    note('課本：CPU 使用率 ≤ 100%（不計 overhead）時，EDF 理論上全部趕上；超載才會 miss', 0, 0.3, 2.6);
    sayc('老師：EDF 可以證明 miss rate 的上界', '課本：使用率 ≤ 1 就排得完，超載才會 miss');
  },
]);

// real-time chart: one CPU row + arrival pins per task (unit = 1)
function rtChart(T, tasks, o = {}) {
  const G = chart(T, { z: 2.0, w: 11.4, title: o.title || 'CPU', color: (id) => PC[id], unit: o.unit || 1 });
  tasks.forEach(([id, p], k) => {
    const z = -0.2 - k * 0.8; hd(id + '（p=' + Math.round(p * (o.unit || 1) * 10) / 10 + '）', G.x0 - 0.2, 0.2, z);
    for (let r = 0; r < T; r += p) { const pin = lab.box(PC[id], [0.07, 0.6, 0.07]); pin.position.set(G.xAt(r), 0.3, z); lab.world.add(pin); }
  });
  return G;
}
scene('sch-18a-rm', 'Rate-Monotonic 例子：(4,1) (5,2) (20,5)', CAMG, () => ({}), [
  async (tok, S) => {                                   // 1335 RM：fixed priority
    hot('Rate-Monotonic：fixed priority', 0, 4.6, -3.6);
    sayc('rate monotonic', '重點：它是 fixed priority 的演算法');
  },
  async (tok, S) => {                                   // 1346 arrival 都是 0；這裡先寫 period 再寫 execution
    S.c = code(['task  (period, execution)', 'T1    (4, 1)', 'T2    (5, 2)', 'T3    (20, 5)'], -3.6, 3.8, 0.46, -3.6);
    sm('注意：這題先寫 period 再寫 execution', 2.6, 3.8, -3.6);
    sayc('arrival time 都從 0 開始', '注意 tuple 的順序：這裡先寫 period、再寫 execution');
  },
  async (tok, S) => {                                   // 1365 period 一定比 execution 長
    sm('execution > period → 一定 miss，沒有意義', 2.6, 3.2, -3.6);
    sayc('period 一定比 execution 長', '不然一定 miss deadline，沒有意義');
  },
  async (tok, S) => {                                   // 1372 T1 每 4 來一次做 1；T2 每 5 做 2；T3 (20, 5)
    S.G = rtChart(20, [['T1', 4], ['T2', 5], ['T3', 20]], { title: 'CPU（RM，preemptive）' });
    sayc('T1 每 4 個 time unit 來一次，做 1', 'T2 每 5 來一次做 2；T3 是 (20, 5)。柱子 = 到達時間');
  },
  async (tok, S) => {                                   // 1389 依 period：T1 > T2 > T3
    S.c.hl(1); hot('priority：T1 > T2 > T3（period 4 < 5 < 20）', 2.6, 2.6, -3.6);
    sayc('priority based on period', '4、5、20 越短越先 → T1 > T2 > T3');
  },
  async (tok, S) => {                                   // 1404 跟 priority scheduling 一樣：T1 先做 1
    await S.G.add(tok, 'T1', 0, 1, 400);
    sayc('決定 priority 後就跟 priority scheduling 完全相同', 'T1 priority 最高，只要一個單位');
  },
  async (tok, S) => {                                   // 1422 下一個 T2：兩個單位
    S.c.hl(2); await S.G.add(tok, 'T2', 1, 3, 500);
    sayc('T1 做完，4 之前不會再出現', '下一個 T2，做兩個單位');
  },
  async (tok, S) => {                                   // 1451 然後 T3
    S.c.hl(3); await S.G.add(tok, 'T3', 3, 4, 400);
    sayc('然後只剩 T3', '輪到 T3 執行');
  },
  async (tok, S) => {                                   // 1461 preemptive：t=4 T1 又來，T3 才做 1 就被打斷
    S.c.hl(1); await S.G.add(tok, 'T1', 4, 5, 400);
    bad('t=4：T1 又來 → T3 才做 1 就被打斷', S.G.xAt(4), 1.4, 2.0);
    sayc('這個例子是 preemptive', '在 4 的時候 T3 才做一個 unit，T1 又出現 → 打斷 T3');
  },
  async (tok, S) => {                                   // 1483 T1 做完，T2 剛好又來（5），比 T3 高 → 做 2
    S.c.hl(2); await S.G.add(tok, 'T2', 5, 7, 500);
    sayc('T1 做完後，T2 剛好也出現了', 'T2 priority 仍比 T3 高 → 再做兩個 unit');
  },
  async (tok, S) => {                                   // 1495 有一個空位 → T3
    S.c.hl(3); await S.G.add(tok, 'T3', 7, 8, 400);
    sayc('剛好有一個空位', '所以 T3 去做');
  },
  async (tok, S) => {                                   // 1504 回到 T1（8）；T2 還沒來 → T3 再做一個
    S.c.hl(1); await S.G.add(tok, 'T1', 8, 9, 400); S.c.hl(3); await S.G.add(tok, 'T3', 9, 10, 400);
    sayc('又回到 T1（第 8 秒）', 'T1 做完、T2 還沒來（10）→ 剛好又有空位給 T3');
  },
  async (tok, S) => {                                   // 1522 只有 T1、T2 都不做時才輪到 T3
    await S.G.add(tok, 'T2', 10, 12, 300); await S.G.add(tok, 'T1', 12, 13, 250); await S.G.add(tok, 'T3', 13, 15, 300);
    good('T3 在 15 做滿 5 個單位，趕上 deadline 20', S.G.xAt(14), 1.4, 2.0);
    sayc('只有 T1、T2 都不做的時候', '才可以做 T3；模擬時要小心交錯');
  },
  async (tok, S) => {                                   // 1551 只看 period，不看 execution：T3 改 19 還是最低
    await S.G.add(tok, 'T2', 15, 16, 200); await S.G.add(tok, 'T1', 16, 17, 200); await S.G.add(tok, 'T2', 17, 18, 200);
    sm('只看 period：T3 的 execution 改成 19，priority 還是最低', 2.6, 2.0, -3.6);
    sayc('它不管 execution time', '把 T3 改成 19，它還是 priority 最低：只看 period');
  },
  async (tok, S) => {                                   // 1567 static → 結果不一定特別好
    note('static priority：結果不一定特別好', 2.6, 1.4, -3.6);
    sayc('重點是它是 static 的', '所以有很多壞處，結果不一定特別好');
  },
]);

scene('sch-18a-edf', 'EDF 例子：(2, 0.9) (5, 2.3)', CAMG, () => ({}), [
  async (tok, S) => {                                   // 1576 EDF：dynamic，但比較好想像
    hot('EDF：dynamic，一直在變，但很好想像', 0, 4.6, -3.6);
    sayc('EDF 是 dynamic 的', '可能一直在變換，但大家比較容易想像它的過程');
  },
  async (tok, S) => {                                   // 1585 兩個 task：長的是 period、短的是 execution
    S.c = code(['task  (period, execution)', 'T1    (2, 0.9)', 'T2    (5, 2.3)'], -3.6, 3.8, 0.46, -3.6);
    S.G = rtChart(50, [['T1', 20], ['T2', 50]], { title: 'CPU（EDF）', unit: 0.1 });
    sayc('只有兩個 task', '長的是 period、短的是 execution：T1 (2, 0.9)、T2 (5, 2.3)');
  },
  async (tok, S) => {                                   // 1602 不看 period，看 deadline
    sm('不看 period，只看「下一個 deadline」', 2.6, 3.8, -3.6);
    sayc('t = 0 先做誰？', '並不看 period，看的是 deadline');
  },
  async (tok, S) => {                                   // 1609 T1 deadline 2 比 5 近 → 先做 T1
    S.c.hl(1); S.d = hd('deadline：T1 = 2、T2 = 5', 2.6, 3.2, -3.6);
    await S.G.add(tok, 'T1', 0, 9, 500);
    sayc('T1 的下一個 deadline 是 2，T2 是 5', '2 比較近 → 先做紅色 T1');
  },
  async (tok, S) => {                                   // 1617 剩下的時間做 T2
    S.c.hl(2); await S.G.add(tok, 'T2', 9, 20, 600);
    sayc('剩下的時間', '就去做橘色 T2（做到 2，做了 1.1）');
  },
  async (tok, S) => {                                   // 1627 t=2 新的 T1：deadline 4 < 5 → T1 先
    txt(S.d, 't=2：新 T1 deadline 2 + 2 = 4 < T2 的 5'); S.c.hl(1);
    await S.G.add(tok, 'T1', 20, 29, 500);
    sayc('t = 2 新的紅色進來', 'deadline 4；T2 是同一個 task，deadline 還是 5 → 4 < 5，T1 先');
  },
  async (tok, S) => {                                   // 1655 紅色做完就做橘色
    S.c.hl(2); await S.G.add(tok, 'T2', 29, 40, 600);
    sayc('紅色做完', '就可以去做橘色（到 4，又做了 1.1）');
  },
  async (tok, S) => {                                   // 1661 t=4：新 T1 deadline 6 > T2 的 5 → T2 繼續
    txt(S.d, 't=4：新 T1 deadline 6 > T2 的 5 → T2 優先！');
    sayc('在 4 這個時間點，decision 倒過來', '紅色 deadline 是 6，橘色是 5 → 橘色比較 earliest');
  },
  async (tok, S) => {                                   // 1684 橘色繼續做完剩下的
    await S.G.add(tok, 'T2', 40, 41, 400); S.c.hl(1); await S.G.add(tok, 'T1', 41, 50, 400);
    sm('T2 共 2.3 = 1.1 + 1.1 + 0.1 → 做到 4.1 才結束', 2.6, 2.6, -3.6);
    sayc('橘色超過 4 繼續做', '做完剩下的（2.3 − 1.1 − 1.1 = 0.1），再換紅色');
  },
  async (tok, S) => {                                   // 1699 dynamic priority：前一刻紅色高，下一刻橘色高
    good('同一個 T1：t=2 時比 T2 優先，t=4 時卻比 T2 低 → dynamic', 0, 0.3, 3.6);
    sayc('這就是 dynamic priority', '前一個時間點紅色高，下一個時間點變成橘色');
  },
  async (tok, S) => {                                   // 1716 考試時要小心長度
    note('考試：時間長度要算仔細', 2.6, 2.0, -3.6);
    sayc('後面大家自己 go through', '考試時要非常小心算的長度');
  },
  async (tok, S) => {                                   // 1739 每次重新決定；一個 period 只做 execution 那麼多
    sm('一個 period 內只做 execution 那麼多（0.9 做完就離開 ready queue）', 0, 0.3, 4.3);
    sayc('每次都要重新決定誰 priority 高', '一個 period 裡只要做 execution time；0.9 做完就離開 ready queue');
  },
  async (tok, S) => {                                   // 1755 新 task 進 ready queue → 重新決定
    sm('有新 task 進 ready queue（下一個 period 到）→ 重新決定 priority', 0, 0.3, 5.0);
    sayc('只要有新 task 進 ready queue', '下一個 period 到了，就要重新決定一次');
  },
]);

// ════════ XYreyOCoBuk（第 18B 講 Operating System Examples） ════════
// a vertical priority ruler: lo..hi mapped to y 0..H at x
function ruler(x, z, lo, hi, H = 5.2) { const m = lab.box('#e9e1d2', [0.25, H, 0.25]); m.position.set(x, H / 2, z); lab.world.add(m); return { yAt: (v) => (v - lo) / (hi - lo) * H, x, z }; }
function band(R, a, b, color, text, dx = 1.0) { const y0 = R.yAt(a), y1 = R.yAt(b + 1); const m = lab.box(color, [1.2, Math.max(0.05, y1 - y0), 0.4]); m.position.set(R.x + dx, (y0 + y1) / 2, R.z); lab.world.add(m); if (text) sm(text, R.x + dx + 2.0, (y0 + y1) / 2, R.z); return m; }
scene('sch-18b-solaris', 'Solaris：0～169 的 priority 與六個 class', [[0, 4.2, 13], [0, 2.6, 0]], () => ({}), [
  async (tok, S) => {                                   // 16 case study：真實 OS 用的 scheduling
    bub('case study：真實 OS 怎麼排程？', 0, 5.4, -1);
    sayc('最後介紹一些 case study', '真實 OS 實作上採用的 scheduling algorithm');
  },
  async (tok, S) => {                                   // 49 大部分都是 based on priority
    good('大部分都是 based on priority（最 general）', 0, 4.8, -1);
    sayc('你會發現', '其實大部分都是 based on priority，因為它最 general');
  },
  async (tok, S) => {                                   // 56 Solaris：很早的 workstation OS
    hot('Solaris', -4.8, 4.2, -1);
    sayc('第一個是 Solaris', '比較早期的 workstation OS');
  },
  async (tok, S) => {                                   // 69 每個 process 都有 priority（top 看得到 nice）
    S.c = code(['$ top', '  PID  PRI  NI  COMMAND', ' 1234   20   0  firefox'], 2.6, 4.2, 0.42, -1);
    sayc('所有 process 一建立就有 priority', '在 Linux 打 top，就會看到 priority 或 nice 值');
  },
  async (tok, S) => {                                   // 87 0～169，169 最高（數字越大越好）
    S.R = ruler(-5.2, -1, 0, 169); sm('169', -5.2, 5.5, -1); sm('0', -5.2, -0.2, -1); sm('數字越大越優先', -5.2, 6.0, -1);
    sayc('Solaris 的 priority 從 0 到 169', '169 最高：數字越大越好（不同系統定義完全不同）');
  },
  async (tok, S) => {                                   // 103 切成六大 class
    gone(...S.c.ls);
    sayc('它把 process 切成六大類', '六個 priority class');
  },
  async (tok, S) => {                                   // 113 interrupt 最重要，priority 最高
    S.b1 = band(S.R, 160, 169, '#d64545', 'interrupt：160～169');
    sayc('第一個當然是 interrupt', 'interrupt 最重要，所以 priority 最高');
  },
  async (tok, S) => {                                   // 121 create 時由 OS policy 決定 class，之後不變
    note('class 在 create 時由 OS 的 policy／hint 決定，之後一直維持', 3.0, 0.3, -1);
    sayc('不是任何 process 都能放任何 class', 'create 時 OS 用 policy 決定，之後就一直待在那');
  },
  async (tok, S) => {                                   // 139 real-time 100～159、system 60～99
    band(S.R, 100, 159, '#dd8238', 'real time：100～159'); band(S.R, 60, 99, '#9b7ef4', 'system：60～99');
    sayc('real-time 是 100～159', '再來是 system（60～99）');
  },
  async (tok, S) => {                                   // 157 其餘四類都在 0～59
    ['fair share', 'fixed priority', 'time sharing', 'interactive'].forEach((t, k) => band(S.R, 0, 59, ['#2fc092', '#31aab0', '#4b9ee2', '#6a7fd0'][k], k === 0 ? '其餘四類（含 time sharing、interactive）：都在 0～59' : '', 1.0 + k * 0.35));
    sayc('後面四類', '全部都在 0～59：不同 class 可能有相同 priority');
  },
  async (tok, S) => {                                   // 169 每個 class 對應一段 range；process 不會在 class 之間跳
    sm('class → 對應一段 priority range；process 不會換 class', 3.0, 1.0, -1);
    sayc('每個 class 對應整個 range 的某一塊', '一個 process 只屬於一個 class，不會在 class 之間跳');
  },
  async (tok, S) => {                                   // 191 每個 class 有自己的演算法：像 multilevel queue
    sm('每個 class 有自己的 scheduling algorithm → 像 multilevel queue', 3.0, 1.6, -1);
    sayc('每個 class 有自己的 scheduling algorithm', '有點像 multilevel queue');
  },
  async (tok, S) => {                                   // 205 演算法的結果：在 range 裡升或降
    S.p = pal('P', '30', '#4b9ee2', -2.2, -1, 0.45);
    await anim(tok, 700, (u) => { S.p.g.position.y = S.R.yAt(30 + 15 * Math.sin(u * Math.PI)); });
    sayc('不管什麼演算法', '轉換出來的就是它在自己 range 裡的 priority 上升或下降');
  },
  async (tok, S) => {                                   // 216 OS 看 global priority：上面的 class 做完才輪到下面
    hot('OS 只看 global priority：數字最大的先', 3.0, 2.2, -1);
    sayc('對整個 OS 而言', 'care 的是 global priority：最上面的做完，才可能做下面的');
  },
]);

scene('sch-18b-soltable', 'Solaris 的 dispatch table：quantum 用完往下、睡醒往上', [[0, 6.5, 12.5], [0, 1.6, 0]], () => ({}), [
  async (tok, S) => {                                   // 237 60 以上的 system level：priority 固定
    sm('60 以上的 system level：一 create 就固定，不太變動', 0, 5.6, -3.4);
    sayc('system level 的（60 以上）', '一 create 之後 priority 就固定，不太變動');
  },
  async (tok, S) => {                                   // 253 使用者的難以預測 → 建一張表
    S.t = table(['priority  quantum  用完後  睡醒後', '   0        200       0      50', '  20        120      10      52', '  30         80      20      53', '  59         20      49      59'], 0, 5.0, -3.4);
    sm('（恐龍書 Solaris dispatch table 節錄）', 0, 2.6, -3.4);
    sayc('使用者的 process 比較難預測', '所以它建了一張表（dispatch table）');
  },
  async (tok, S) => {                                   // 271 每個 priority 對應一個 time quantum
    S.t.hl(3);
    sayc('每一個 priority', '首先對應到一個 time quantum');
  },
  async (tok, S) => {                                   // 280 同一個 priority 的多個 process：RR
    S.Q = ['A', 'B', 'C'].map((n, k) => pal(n, '30', ['#4b9ee2', '#2fc092', '#9b7ef4'][k], -4.6 + k * 1.3, 0.6, 0.5));
    sm('priority 30 的 queue：大家用 round robin', -3.3, 0.2, 1.6);
    sayc('很多 process 都屬於同一個 priority', '它們之間再用 round robin 更 fine-grained 地排');
  },
  async (tok, S) => {                                   // 296 priority 30：每個 CPU burst 只能做 80
    prop('cpu', 4.6, 0, 0.6, 0.8, 'CPU'); await walk(tok, S.Q[0], 4.6, 1.4, 600);
    hot('priority 30：每次只能做 80', 4.6, 2.2, 0.6);
    sayc('例如 priority 30 裡有好幾個 process', '每個執行 CPU burst 只能做 80，做完就換別人');
  },
  async (tok, S) => {                                   // 311 priority 越高，time quantum 反而越小
    S.t.hl(4);
    sayc('你會發現', 'priority 越高的，time quantum 反而越小');
  },
  async (tok, S) => {                                   // 321 supposedly 是 shortest job：priority 高但只能做 20 ms
    sm('高 priority ≈ 短 job：59 只給 20 ms', 0, 2.0, -3.4);
    sayc('因為它 supposedly 應該是 shortest job', 'priority 很高，但只能做 20 ms 就要換人');
  },
  async (tok, S) => {                                   // 335 超過 quantum → 不夠短 → priority 降低（59 → 49）
    S.x = pal('X', '59', '#e55a9b', -4.6, -1.4, 0.5); S.x.mood('sad');
    await wt(tok, 300); S.x.set('49'); bad('超過 20 ms → 降到 49', -4.6, 1.2, -1.4);
    sayc('如果超過這個 time quantum', '就認為你不夠短，priority 降低：59 → 49');
  },
  async (tok, S) => {                                   // 356 往下降：比較少被執行，但 quantum 變長（CPU-bound）
    sm('往下沉：較少被選到，但每次可以做比較久（給 CPU-bound）', -2.4, 0.2, -2.4);
    sayc('只要超過 quantum 就往下降', '壞處是比較少被執行，好處是輪到時 quantum 比較長');
  },
  async (tok, S) => {                                   // 374 從 sleep / waiting 回到 ready → priority 提高
    S.y = pal('Y', '20', '#c08a1f', 2.0, -1.4, 0.5);
    sm('從 sleep / waiting 回到 ready → priority 提高', 2.0, 1.2, -1.4);
    sayc('另一個 system engineering 的結果', '從 sleep 或 waiting queue 重新回到 ready，priority 會增加');
  },
  async (tok, S) => {                                   // 391 在 waiting = 不用 CPU = 可能是 I/O-bound（直覺）
    sm('在 waiting queue = 沒在用 CPU → 可能是 I/O-bound（純粹直覺）', 2.0, 0.2, -2.4);
    sayc('為什麼', '在 waiting queue 代表沒在用 CPU，可能是 I/O-bound（純粹是 intuition）');
  },
  async (tok, S) => {                                   // 414 例：20 call sleep 回來 → 52
    S.t.hl(2); S.y.set('52'); S.y.mood('happy'); await S.y.hop(tok);
    sayc('例如原來是 20', 'call 了 sleep 回來之後，就升到 52，讓它先做');
  },
  async (tok, S) => {                                   // 435 CPU-bound 慢慢沉下去，I/O-bound 慢慢升上來
    good('CPU-bound 慢慢沉下去；I/O-bound（CPU burst 短）慢慢升上去', 0, 0.3, 3.0);
    sayc('Solaris 調整 priority 的方式', '超過 quantum → 降；call I/O system call → 升');
  },
  async (tok, S) => {                                   // 471 priority 越高 quantum 越小：跟 MLFQ 例子很像
    note('跟課堂的 MLFQ 例子（上層 8、下層 16）非常像', 0, 0.3, 3.7);
    sayc('priority 越高，quantum 越小', '之前課堂的 feedback queue 例子跟 Solaris 非常像');
  },
]);

scene('sch-18b-winxp', 'Windows XP：0～31、class × relative priority', [[0, 4.2, 13], [0, 2.6, 0]], () => ({}), [
  async (tok, S) => {                                   // 488 跟 Solaris 很像
    hot('Windows XP：跟 Solaris 很像', -1.6, 5.6, -1);
    sayc('下一個是 Windows XP', '跟 Solaris 很像，只是定義上有些差別');
  },
  async (tok, S) => {                                   // 500 0～31，數字越高越優先
    S.R = ruler(-5.2, -1, 0, 31); sm('31', -5.2, 5.5, -1); sm('0', -5.2, -0.2, -1); sm('數字越大越優先', -5.2, 6.0, -1);
    sayc('priority level 比較少：0～31', '一樣是數字越高 priority 越高');
  },
  async (tok, S) => {                                   // 522 6 個 class × 7 個 relative priority
    S.g = code(['            real-time  high  above  normal  below  idle', 'time-crit       31      15     15      15     15    15', 'highest         26      15     12      10      8     6', 'normal          24      13     10       8      6     4', 'idle            16       1      1       1      1     1'], 1.4, 4.4, 0.42, -1);
    sm('（恐龍書表格節錄：6 個 class × 7 個 relative priority）', 1.4, 2.0, -1);
    sayc('也分成 class', '6 個 class，每個 class 裡又分 7 個 relative priority');
  },
  async (tok, S) => {                                   // 533 依 running 情況：CPU 多 → 往下；I/O 多 → 往上
    S.p = pal('P', '10', '#4b9ee2', -2.6, 0.8, 0.45);
    await anim(tok, 900, (u) => { S.p.g.position.y = S.R.yAt(10 - 4 * Math.sin(u * Math.PI)); }); S.p.set('8');
    sayc('根據它的 running state', 'CPU 用比較多就往下降，I/O 比較多就往上升');
  },
  async (tok, S) => {                                   // 554 每個 class 只在這 7 個數字間跳；real-time 不動
    sm('每個 class 只在自己 7 個數字之間跳動', 1.4, 1.4, -1);
    sayc('每個 class', '只在這七個數字之間跳動；唯一不會跳動的是 real-time');
  },
  async (tok, S) => {                                   // 565 real-time job：static priority，最低也有 16
    band(S.R, 16, 31, '#dd8238', '', 1.0); hot('real-time：16～31，static', -2.6, 4.2, -1);
    sayc('認定是 real-time job', 'priority 是 static 不會動，最低也有 16');
  },
  async (tok, S) => {                                   // 584 Solaris 跟 XP 非常像，只是 range 不同
    sm('Solaris ≈ Windows XP：只是切割的數字 range 不同', 1.4, 0.8, -1);
    sayc('Solaris 跟 Windows XP 非常像', '只是切割 priority 的數字 range 有些不同');
  },
  async (tok, S) => {                                   // 596 highest priority 先；同 priority 同一個 queue 用 RR
    good('看 global priority，最高的先；同 priority 同一個 queue → RR', 1.4, 0.3, 1.0);
    sayc('一樣 highest priority 先', '同 priority 的放同一個 queue，用 round robin');
  },
  async (tok, S) => {                                   // 614 這裡沒特別講 quantum 不同
    note('這裡沒特別說 quantum 會隨 priority 不同', 1.4, 0.3, 1.8);
    sayc('跟剛才不同的', 'time quantum 這邊沒有特別講會不一樣，但原則一樣');
  },
]);

scene('sch-18b-linux', 'Linux：0～140、active / expired array', [[0, 6.2, 12.5], [0, 1.8, 0]], () => ({}), [
  async (tok, S) => {                                   // 626 最後一個例子：Linux
    hot('Linux（2.6 版的 O(1) scheduler）', 0, 5.6, -3.6);
    sayc('最後一個例子 Linux', '它比較特別一點');
  },
  async (tok, S) => {                                   // 638 0～140，數字越小 priority 越高
    sm('priority 0～140：數字越小越優先（跟 Solaris、XP 相反）', 0, 5.0, -3.6);
    sayc('range 是 0 到 140', '數字越小，priority 越高');
  },
  async (tok, S) => {                                   // 652 每個 priority 對應一個 time quantum
    S.t = table(['priority   用途              quantum', '0 ~ 99     real-time task    長（最高 200 ms）', '100 ~ 140  other（user）      短（最低 10 ms）'], 0, 4.3, -3.6);
    S.dino = sm('恐龍書：Linux 給高 priority 較「長」的 quantum（跟 Solaris 相反）', 0, 2.8, -3.6);
    sayc('每個 priority 對應一個 time quantum', '恐龍書：priority 越高的 quantum 越長（200 ms），最低 10 ms');
  },
  async (tok, S) => {                                   // 676 0～99：real-time / system，priority 固定
    S.t.hl(1);
    sayc('0 到 99', 'real-time 或 system 的 task，priority 是固定的');
  },
  async (tok, S) => {                                   // 688 priority 低的（user）run time 可以調整
    S.t.hl(2);
    sayc('priority 比較低的是 user process', 'run time 依 quantum 有沒有 expire、有沒有 call I/O 去調整');
  },
  async (tok, S) => {                                   // 713 特點：active 與 expired 兩個 array
    gone(...S.t.ls, S.dino);                            // the quantum table is done: the two arrays and their tasks take the stage
    S.A = zone('active array', -3.0, 0, 0, 5.4, 1.6); S.E = zone('expired array', 3.4, 0, 0, 4.6, 1.6, '#e3d3b6');
    S.T = ['T1', 'T2', 'T3'].map((n, k) => pal(n, '200', PC['P' + (k + 1)], -5.0 + k * 1.6, 0, 0.5));   // 1.6 apart: T1's '100 → 40' needs the room
    sayc('Linux 的特點', '把所有 process 放在兩個 list：active array 與 expired array');
  },
  async (tok, S) => {                                   // 732 每個 task 有 priority 與 quantum（例如 200）
    S.each = sm('每個 task：一個 priority ＋ 一個 time quantum（例：200）', -1.4, 0.2, 1.4);
    sayc('每個 task 有一個 priority', '和一個 time quantum，比如說 200');
  },
  async (tok, S) => {                                   // 750 其他 OS：burst 短於 quantum 就浪費掉，回隊尾
    bub('別的 OS：200 只用 100 → 剩下的浪費掉，回隊尾', -3.0, 2.2, 0);
    sayc('前面的 OS', '給你 200、你的 burst 只做 100 就結束：剩下的浪費，回到 queue 最尾巴');
  },
  async (tok, S) => {                                   // 769 Linux：讓你把 200 用完；沒用完就留在 active
    S.T[0].set('100'); S.T[0].mood('happy');
    good('Linux：沒用完的 budget 還留著 → 留在 active array', -3.0, 2.8, 0);
    sayc('Linux 認為那樣不公平', '給你 200 就讓你好好用完：沒用完就留在 active array 還能執行');
  },
  async (tok, S) => {                                   // 793 用完就放到 expired array
    S.T[1].set('0'); S.T[1].mood('sad'); await walk(tok, S.T[1], 2.4, 0, 700);
    sayc('如果你用完了', '就把你放到 expired array');
  },
  async (tok, S) => {                                   // 801 執行時間 weighted by quantum
    gone(S.each); sm('每輪都真的用滿自己的 quantum → 執行時間依 quantum 加權', -1.4, 0.2, 1.4);
    sayc('每次輪到都真的可以用 200', '執行時間等於是 weighted by 它的 time quantum');
  },
  async (tok, S) => {                                   // 838 priority 只在「一個 burst 就超過 quantum」才降
    note('老師：一個 CPU burst 就超過 quantum 才降 priority（課本：移到 expired 時依互動程度重算 priority）', 0, 0.3, 2.8);
    sayc('老師：priority 要一個 CPU burst 就超過 quantum 才降', '課本：task 移到 expired array 時，依 sleep 時間（互動程度）重算 priority');
  },
  async (tok, S) => {                                   // 864 每次只從 200 扣掉，剩下的繼續在 active
    S.T[0].set('100 → 40');
    sayc('每次用完只從 200 裡扣掉', '看還剩多少，繼續放在 active queue');
  },
  async (tok, S) => {                                   // 889 active 空了 → 交換兩個 array 的 pointer
    S.T[0].set('0'); await walk(tok, S.T[0], 3.6, 0, 500); S.T[2].set('0'); await walk(tok, S.T[2], 4.8, 0, 500);
    await wt(tok, 200); txt(S.A.userData.name, 'expired array（空了）'); txt(S.E.userData.name, 'active array ← pointer 交換');
    S.T.forEach((b) => { b.set('200'); b.mood('happy'); });
    sayc('implementation 很容易', 'active 全空了，就把兩個 array 的 pointer 交換，繼續下一輪');
  },
  async (tok, S) => {                                   // 928 Linux：不是做完一個 cycle 就換人，而是用完 quantum
    good('Linux：不是跑完一個 burst 就換人，而是讓你用完整個 quantum', 0, 0.3, 3.6);
    sayc('這就是 Linux 不一樣的地方', '不是執行完一個 cycle 就換人，而是讓你把 quantum 用完');
  },
]);

// ════════ VCIVXPoiLpU（Gate Smashers：Shortest Job First） ════════
scene('sch-gs-gantt', 'SJF 例題：一步一步畫 Gantt chart', CAMG, () => {
  const S = {};
  S.t = table(['P   AT  BT', 'P1   1   3', 'P2   2   4', 'P3   1   2', 'P4   4   4'], -6.2, 5.4, -3.8);
  return S;
}, [
  async (tok, S) => {                                   // 1 SJF 例題：4 個 process，給 arrival time 與 burst time
    sayc('Shortest Job First 的數值例題', '四個 process，給 arrival time（AT）和 burst time（BT）');
  },
  async (tok, S) => {                                   // 15 要求 CT、TAT、WT、RT
    sm('要求：completion、turnaround、waiting、response time', 3.8, 4.6, -3.8);
    sayc('要算的', 'completion time、turnaround time、waiting time、response time');
  },
  async (tok, S) => {                                   // 27 criteria：burst time
    hot('選人的 criteria：burst time', 3.8, 4.0, -3.8);
    sayc('SJF 的 criteria', '看 burst time');
  },
  async (tok, S) => {                                   // 32 burst time 最小的先上 CPU
    sm('burst time 最小的 → 先上 CPU', 3.8, 3.4, -3.8);
    sayc('shortest job', 'burst time 最小的 process，先讓它在 CPU 上跑');
  },
  async (tok, S) => {                                   // 45 mode：non-preemptive，一給 CPU 就跑完
    note('mode：non-preemptive → 一給 CPU 就整個跑完，中間不打斷', 3.8, 2.8, -3.8);
    sayc('mode 是 non-preemptive', '給了 CPU 就完整執行，中間不會被 interrupt');
  },
  async (tok, S) => {                                   // 57 用 Gantt chart，時間從 0 開始
    S.B = board(14, { title: 'Gantt chart（時間一定從 0 開始）' });
    sayc('用 Gantt chart 來做', '時間一定從 0 開始');
  },
  async (tok, S) => {                                   // 71 t=0：有誰到了？沒有
    S.c = hd('t = 0：有誰 arrive？', 5.3, 2.6, -2.6);
    sayc('先檢查 t = 0', '有沒有 process 在 0 到達？沒有');
  },
  async (tok, S) => {                                   // 82 0～1 CPU idle
    await S.B.G.add(tok, null, 0, 1, 500);
    sayc('考試也會出這種題目', '0 到 1 沒有 process → CPU idle');
  },
  async (tok, S) => {                                   // 98 t=1：P1、P3 都到了
    txt(S.c, 't = 1：P1、P3 到了');
    S.B.arrive('P1', 3); S.B.arrive('P3', 2); S.t.hl(1);
    sayc('站在 t = 1', '先查誰到了（burst 之後再比）：P1、P3 都在 1 到達');
  },
  async (tok, S) => {                                   // 126 比 burst：P1 3、P3 2 → P3
    txt(S.c, 'P1 = 3 vs P3 = 2 → 選 P3'); S.t.hl(3);
    S.B.b.P3.mood('wow');
    sayc('用 burst time 比', 'P1 是 3，P3 是 2 → P3 比較短，先選 P3');
  },
  async (tok, S) => {                                   // 149 non-preemptive：P3 完整跑 2 → 1～3
    await S.B.run(tok, 'P3', 1, 3, 700); await S.B.done(tok, 'P3');
    sayc('non-preemptive：P3 整個跑完', '1 + 2 = 3，P3 在 3 完成');
  },
  async (tok, S) => {                                   // 168 t=3：P1 早就在；P2 在 2 到了
    txt(S.c, 't = 3：ready queue = P1、P2'); S.B.arrive('P2', 4); S.t.hl(2);
    sayc('現在站在 t = 3', 'P1 在 1 就到了還沒跑；P2 在 2 也到了');
  },
  async (tok, S) => {                                   // 243 P1 3 vs P2 4 → P1，3～6
    txt(S.c, 'P1 = 3 vs P2 = 4 → 選 P1'); S.t.hl(1);
    await S.B.run(tok, 'P1', 3, 6, 700); await S.B.done(tok, 'P1');
    sayc('P1 的 burst 3、P2 的 burst 4', 'P1 比較短 → 跑 3 個單位，到 6');
  },
  async (tok, S) => {                                   // 267 t=6：P2、P4 都在
    txt(S.c, 't = 6：ready queue = P2、P4'); S.B.arrive('P4', 4); S.t.hl(4);
    sayc('先看時間 6', '這時 P2、P4 都到了（P4 在 4 到）');
  },
  async (tok, S) => {                                   // 294 burst 都是 4：平手
    txt(S.c, 'P2 = 4、P4 = 4：平手！'); S.B.b.P2.mood('wow'); S.B.b.P4.mood('wow');
    sayc('一樣用 burst time 比', 'P2 是 4、P4 也是 4：一樣長');
  },
  async (tok, S) => {                                   // 321 tie → 退一步看 arrival time：P2 先到
    txt(S.c, '平手 → 比 arrival：P2（2）< P4（4）→ P2');
    sayc('遇到這種 conflict', '退一步看 arrival time：誰先來 → P2 比較早到');
  },
  async (tok, S) => {                                   // 347 arrival 也一樣 → 看 process id 小的
    sm('如果 arrival 也一樣 → 選 process id 小的', 5.3, 2.0, -2.6);
    sayc('假設 arrival time 也一樣', '那就選 process id 比較小的');
  },
  async (tok, S) => {                                   // 359 P2 跑 6～10
    await S.B.run(tok, 'P2', 6, 10, 700); await S.B.done(tok, 'P2');
    sayc('所以先選 P2', '跑 4 個單位：6 + 4 = 10');
  },
  async (tok, S) => {                                   // 373 只剩 P4：10～14
    txt(S.c, '只剩 P4');
    await S.B.run(tok, 'P4', 10, 14, 700); await S.B.done(tok, 'P4');
    sayc('剩下 P4 一個，沒問題', '也要 4 個單位：10 + 4 = 14');
  },
]);

scene('sch-gs-calc', 'SJF 例題：CT、TAT、WT、RT 與平均', CAMG, () => {
  const S = {};
  S.t = table(['P   AT  BT   CT  TAT  WT  RT', 'P1   1   3    ·    ·   ·   ·', 'P2   2   4    ·    ·   ·   ·', 'P3   1   2    ·    ·   ·   ·', 'P4   4   4    ·    ·   ·   ·'], -2.6, 5.4, -3.8);
  S.G = chart(14, { title: 'Gantt chart', z: 1.6 });
  return S;
}, [
  async (tok, S) => {                                   // 381 completion time：看 Gantt chart 每塊右邊
    for (const [id, s, e] of [[null, 0, 1], ['P3', 1, 3], ['P1', 3, 6], ['P2', 6, 10], ['P4', 10, 14]]) await S.G.add(tok, id, s, e, 200);
    S.t.set(1, 'P1   1   3    6    ·   ·   ·'); S.t.set(2, 'P2   2   4   10    ·   ·   ·'); S.t.set(3, 'P3   1   2    3    ·   ·   ·'); S.t.set(4, 'P4   4   4   14    ·   ·   ·');
    sayc('completion time', '看 Gantt chart 上每個 process 的右邊：P1 6、P2 10、P3 3、P4 14');
  },
  async (tok, S) => {                                   // 407 TAT = CT − AT：5、8、2、10
    S.t.set(1, 'P1   1   3    6    5   ·   ·'); S.t.set(2, 'P2   2   4   10    8   ·   ·'); S.t.set(3, 'P3   1   2    3    2   ·   ·'); S.t.set(4, 'P4   4   4   14   10   ·   ·');
    hd('TAT = CT − AT', 4.2, 5.0, -3.8);
    sayc('turnaround time = CT − AT', '6−1 = 5、10−2 = 8、3−1 = 2、14−4 = 10');
  },
  async (tok, S) => {                                   // 426 WT = TAT − BT：2、4、0、6
    S.t.set(1, 'P1   1   3    6    5   2   ·'); S.t.set(2, 'P2   2   4   10    8   4   ·'); S.t.set(3, 'P3   1   2    3    2   0   ·'); S.t.set(4, 'P4   4   4   14   10   6   ·');
    hd('WT = TAT − BT', 4.2, 4.4, -3.8);
    sayc('waiting time = TAT − BT', '5−3 = 2、8−4 = 4、2−2 = 0、10−4 = 6');
  },
  async (tok, S) => {                                   // 445 non-preemptive：RT 等於 WT
    note('non-preemptive：RT 一定等於 WT', 4.2, 3.8, -3.8);
    sayc('response time', 'non-preemptive 時不用另外算，它會等於 waiting time');
  },
  async (tok, S) => {                                   // 458 RT = 第一次拿到 CPU 的時間 − AT：P3 = 1 − 1 = 0
    S.t.set(1, 'P1   1   3    6    5   2   2'); S.t.set(2, 'P2   2   4   10    8   4   4'); S.t.set(3, 'P3   1   2    3    2   0   0'); S.t.set(4, 'P4   4   4   14   10   6   6');
    hd('RT = 第一次拿到 CPU − AT', 4.2, 3.2, -3.8);
    sayc('真的要算的話', '第一次拿到 CPU 的時間 − AT：P3 是 1 − 1 = 0');
  },
  async (tok, S) => {                                   // 484 preemptive 才會不同：可能第二、三次才拿到 CPU
    sm('preemptive 時才不同：process 可能被切開，之後才再拿到 CPU', 0, 0.3, 3.0);
    sayc('只有 preemptive 時才不一樣', 'CPU 會切換，process 可能之後才又輪到');
  },
  async (tok, S) => {                                   // 518 平均 TAT = 25 / 4 = 6.25
    hot('平均 TAT = (5 + 8 + 2 + 10) / 4 = 25 / 4 = 6.25', 0, 0.3, 3.8);
    sayc('average turnaround time', '加起來 25，除以 4 個 process = 6.25');
  },
  async (tok, S) => {                                   // 534 平均 WT = 12 / 4 = 3
    hot('平均 WT = (2 + 4 + 0 + 6) / 4 = 12 / 4 = 3', 0, 0.3, 4.6);
    sayc('average waiting time', '加起來 12，除以 4 = 3');
  },
]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    quiz: genQ,
    pages: [{ id: 'quiz', name: '小測驗', render: renderQuiz }],
    scenes,
    sceneOrder: [
      'burst-cycle', 'cpu-io-bound', 'ready-queue-only', 'four-points', 'preempt-vs-non', 'preempt-sync', 'dispatcher',
      'metrics', 'fcfs-convoy', 'sjf-nonpre', 'srtf', 'sjf-predict', 'priority-aging', 'rr-q20', 'rr-quantum', 'rr-tradeoff',
      'mlq', 'mlfq', 'eval-methods',
      'smp', 'affinity', 'numa', 'load-balance', 'memory-stall', 'rt-periodic', 'rate-monotonic', 'edf',
    ].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); },
  };
}
