// 資料結構 第11章：字串處理（暴力法、KMP、Boyer-Moore、Rolling Hash）。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
//
// 慣例：
//  • Failure function 採洪逸／Horowitz 的定義（索引從 0 開始）：
//      f(j) = 最大的 i < j 使得 p0…pi = p(j−i)…pj；不存在時 f(j) = −1。
//    另一種常見寫法是「最長相同前後綴的長度」π(j) = f(j) + 1（畫面上用灰字一起標出）。
//  • KMP 比對（Horowitz pmatch）：t[i] ≠ p[j] 時，j = 0 → i++；否則 j = f(j−1) + 1，i 不動。
//    這裡找出「全部」出現位置：完全比中後令 j = f(m−1) + 1 繼續。
//  • Boyer-Moore：由右往左比；壞字元 shift = max(1, j − last(c))，last(c) 是 c 在 pattern
//    最後出現的位置（沒有則 −1）；好後綴用標準（strong）good-suffix 表，兩者取大。
//  • Rolling hash 的例子取自 MIT 6.006 Recitation 9b（DNA 序列比對）：A, C, G, T 編成 0, 2, 4, 6，
//    base 是 2 的次方；模數取 2^w 時所有 hash 都是偶數，hash table 有一半永遠用不到。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let timer = null;
  let epoch = 0;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const GREEN = '#1f7a45', RED = '#8a1414', GOLD = '#6a5000';
  const charColor = (c) => colorFor(c.charCodeAt(0));

  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function txt(text, cls, pos) { const l = lab.label(text, cls); l.position.copy(pos); lab.world.add(l); return l; }
  function glow(obj, color) { obj.traverse((o) => { if (o.material && o.material.emissive) o.material.emissive.set(color || '#000000'); }); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ───────────────────────── 演算法本體（純函式，測驗也用） ─────────────────────────
  function failure(p) {
    const f = [-1];
    for (let j = 1; j < p.length; j++) {
      let i = f[j - 1];
      while (p[j] !== p[i + 1] && i >= 0) i = f[i];
      f[j] = p[j] === p[i + 1] ? i + 1 : -1;
    }
    return f;
  }
  function naiveCount(t, p) {
    let c = 0;
    for (let s = 0; s + p.length <= t.length; s++) for (let j = 0; j < p.length; j++) { c++; if (t[s + j] !== p[j]) break; }
    return c;
  }
  function kmpCount(t, p) {
    const f = failure(p);
    let i = 0, j = 0, c = 0;
    while (i < t.length) {
      c++;
      if (t[i] === p[j]) { i++; j++; if (j === p.length) j = f[p.length - 1] + 1; }
      else if (j === 0) i++;
      else j = f[j - 1] + 1;
    }
    return c;
  }
  function lastOcc(p) { const L = {}; for (let j = 0; j < p.length; j++) L[p[j]] = j; return L; }
  function goodSuffix(p) {
    const m = p.length, shift = Array(m + 1).fill(0), bpos = Array(m + 1).fill(0);
    let i = m, j = m + 1;
    bpos[i] = j;
    while (i > 0) {
      while (j <= m && p[i - 1] !== p[j - 1]) { if (shift[j] === 0) shift[j] = j - i; j = bpos[j]; }
      i--; j--; bpos[i] = j;
    }
    j = bpos[0];
    for (i = 0; i <= m; i++) { if (shift[i] === 0) shift[i] = j; if (i === j) j = bpos[j]; }
    return shift; // mismatch at j → shift[j + 1]; full match → shift[0]
  }
  function bmCount(t, p, useGS) {
    const L = lastOcc(p), gs = goodSuffix(p), m = p.length;
    let s = 0, c = 0;
    while (s + m <= t.length) {
      let j = m - 1;
      for (;;) { c++; if (t[s + j] !== p[j]) break; if (j === 0) { j = -1; break; } j--; }
      if (j < 0) s += useGS ? gs[0] : 1;
      else { const bc = j - (L[t[s + j]] ?? -1); s += useGS ? Math.max(bc, gs[j + 1]) : Math.max(1, bc); }
    }
    return c;
  }

  // ───────────────────────── 舞台：text 一排、pattern 一排 ─────────────────────────
  const ST = { text: '', pat: '', cw: 0.8, tB: [], pB: [], s: 0, cmp: 0, iPtr: null, jPtr: null, found: [] };
  const TZ = -0.75, PZ = 0.75;
  const tx = (i) => (i - (ST.text.length - 1) / 2) * ST.cw;
  function setupRows(text, pat, cam) {
    epoch++;
    clearTimeout(timer);
    lab.clear();
    ST.text = text; ST.pat = pat; ST.s = 0; ST.cmp = 0; ST.found = [];
    ST.cw = Math.min(0.92, 13.4 / Math.max(text.length, 8));
    lab.frameCamera(cam || [0, 7.2, 10.5], [0, 0.2, 0.2]);
    const w = ST.cw - 0.07;
    ST.tB = [...text].map((c, i) => {
      const m = lab.box(charColor(c), [w, 0.55, 0.95]);
      m.add(lab.label(c, 'val'));
      m.position.set(tx(i), 0.3, TZ);
      lab.world.add(m);
      txt(String(i), 'idx', V(tx(i), 0.05, TZ - 0.85));
      return m;
    });
    ST.pB = [...pat].map((c, j) => {
      const m = lab.box(charColor(c), [w, 0.55, 0.95]);
      m.add(lab.label(c, 'val'));
      m.position.set(tx(j), 4, PZ);
      const b = lab.addBody(m);
      lab.dropTo(b, V(tx(j), 0.3, PZ));
      return b;
    });
    ST.iPtr = txt('i', 'ptr', V(0, 1.15, TZ));
    ST.jPtr = txt('j', 'ptr alt', V(0, -0.35, PZ + 0.9));
    ST.iPtr.element.style.display = 'none';
    ST.jPtr.element.style.display = 'none';
  }
  function slideTo(s, lift = 0) {
    ST.s = s;
    ST.pB.forEach((b, j) => lab.springTo(b, V(tx(s + j), 0.3 + lift, PZ)));
  }
  function clearMarks() {
    ST.tB.forEach((m, i) => glow(m, ST.found.some((s) => i >= s && i < s + ST.pat.length) ? '#0d3a22' : null));
    ST.pB.forEach((b) => glow(b.obj));
  }
  function mark(i, j, ok) {
    glow(ST.tB[i], ok ? GREEN : RED);
    glow(ST.pB[j].obj, ok ? GREEN : RED);
    ST.cmp++;
  }
  function pointers(i, j) {
    if (i === null) ST.iPtr.element.style.display = 'none';
    else { ST.iPtr.element.style.display = ''; ST.iPtr.element.textContent = 'i = ' + i; ST.iPtr.position.set(tx(i), 1.15, TZ); }
    if (j === null) ST.jPtr.element.style.display = 'none';
    else { ST.jPtr.element.style.display = ''; ST.jPtr.element.textContent = 'j = ' + j; ST.jPtr.position.set(tx(ST.s + j), -0.35, PZ + 0.9); }
  }

  // 步進框架：每個演算法是 generator，先改畫面再 yield {cap, f, ms}
  const RUN = { gen: null, done: false, onState: null };
  function show(st) {
    if (st.cap) { say(st.cap, st.f || ''); log(st.cap + (st.f ? '（' + String(st.f).replace(/<[^>]+>/g, '') + '）' : ''), !!st.warn); }
    if (RUN.onState) RUN.onState(st);
  }
  function step() {
    if (!RUN.gen || RUN.done) return null;
    const r = RUN.gen.next();
    if (r.done) { RUN.done = true; return null; }
    show(r.value);
    return r.value;
  }
  function autoPlay() {
    clearTimeout(timer);
    const e = epoch;
    const tick = () => { if (e !== epoch) return; const st = step(); if (st) timer = setTimeout(tick, Math.max(260, (st.ms || 900) * 0.8)); };
    tick();
  }
  async function playGen(tok, speed = 1) { for (;;) { const st = step(); if (!st) break; await wait(tok, (st.ms || 900) * speed); } }
  function clean(s, max) { return String(s || '').replace(/\s+/g, '_').slice(0, max); }
  function rowControls(extra, tDef, pDef) {
    controls('<label>text <input id="sT" value="' + tDef + '" style="width:190px" maxlength="22"></label>'
      + '<label>pattern <input id="sP" value="' + pDef + '" style="width:90px" maxlength="8"></label>' + (extra || '')
      + '<button class="primary" id="sStep">下一步</button><button id="sAuto">自動播放</button><button id="sReset">套用／重來</button>');
    on('sStep', () => { clearTimeout(timer); if (!step()) log('已經結束了，按「套用／重來」再跑一次。'); });
    on('sAuto', autoPlay);
  }
  function readInputs(defT, defP) {
    const t = clean($('sT') ? $('sT').value : defT, 22) || defT;
    const p = clean($('sP') ? $('sP').value : defP, 8) || defP;
    if (p.length > t.length) { log('pattern 不能比 text 長。', true); return [defT, defP]; }
    return [t, p];
  }

  // ───────────────────────── 暴力法 ─────────────────────────
  const NV = { t: 'abcabcabdabcabd', p: 'abcabd' };
  function* naive() {
    const t = ST.text, p = ST.pat, n = t.length, m = p.length;
    for (let s = 0; s <= n - m; s++) {
      clearMarks(); slideTo(s);
      pointers(null, null);
      yield { cap: '對齊在位置 ' + s, f: '從 pattern 第 0 個字元開始比', ms: 550 };
      let j = 0;
      for (; j < m; j++) {
        const ok = t[s + j] === p[j];
        mark(s + j, j, ok);
        pointers(s + j, j);
        yield { cap: ok ? t[s + j] + ' = ' + p[j] : t[s + j] + ' ≠ ' + p[j] + ' → pattern 右移 1 格', f: '比較次數 ' + ST.cmp, ms: ok ? 420 : 750 };
        if (!ok) break;
      }
      if (j === m) { ST.found.push(s); clearMarks(); yield { cap: '在位置 ' + s + ' 找到！', f: '<span class="ok">繼續往右找下一個</span>', ms: 1400 }; }
    }
    pointers(null, null);
    yield { cap: '暴力法結束：比了 ' + ST.cmp + ' 次', f: '最壞 m(n − m + 1) = ' + m * (n - m + 1) + '，O(nm)', ms: 2600, done: true };
  }
  function naiveState() {
    const n = ST.text.length, m = ST.pat.length;
    setState('暴力法（Brute Force）', [['n / m', n + ' / ' + m], ['目前對齊 s', String(ST.s)], ['比較次數', String(ST.cmp)], ['找到位置', ST.found.join(', ') || '—']],
      '每次失敗只右移 1 格，之前比對過的資訊全部丟掉<br>最壞情況：m(n − m + 1) 次 → O(nm)');
  }
  function enterNaive() {
    rowControls('', NV.t, NV.p);
    const [t, p] = [NV.t, NV.p];
    setupRows(t, p);
    $('sT').value = t; $('sP').value = p;
    on('sReset', () => { [NV.t, NV.p] = readInputs(NV.t, NV.p); clearLog(); enterNaive(); });
    RUN.gen = naive(); RUN.done = false; RUN.onState = naiveState;
    log('暴力法：pattern 對齊 text 的每一個位置，從左往右一個字元一個字元比；一失敗就右移 1 格重來。');
    naiveState();
  }

  // ───────────────────────── Failure function ─────────────────────────
  const FF = { p: 'abcabcacab', fLbl: [], piLbl: [] };
  function* buildFailure() {
    const p = ST.pat, m = p.length, f = Array(m).fill(null);
    FF.cur = f;
    // 上排 = pattern（看 j），下排 = 同一個 pattern 的副本（看 i+1），副本往右滑讓 p[i+1] 對齊 p[j]
    const setF = (j) => {
      FF.fLbl[j].element.textContent = String(f[j]);
      FF.piLbl[j].element.textContent = 'π ' + (f[j] + 1);
      FF.fLbl[j].element.className = 'lab-label ' + (f[j] >= 0 ? 'ptr' : 'idx');
    };
    const align = (j, i) => { slideTo(j - (i + 1)); };
    const marksOff = () => { ST.tB.forEach((m) => glow(m)); ST.pB.forEach((b) => glow(b.obj)); };
    f[0] = -1; setF(0);
    slideTo(1); ST.pB.forEach((b) => (b.obj.visible = true));
    yield { cap: 'f(0) = −1：只有一個字元，沒有「真」前後綴', f: 'f(j) = 最大的 i < j，使 p₀…pᵢ = p_(j−i)…p_j；沒有就 −1', ms: 2200 };
    for (let j = 1; j < m; j++) {
      let i = f[j - 1];
      marksOff();
      align(j, i);
      yield { cap: '算 f(' + j + ')：從 i = f(' + (j - 1) + ') = ' + i + ' 開始', f: '比 p[' + j + '] 和 p[i+1] = p[' + (i + 1) + ']', ms: 1000 };
      while (p[j] !== p[i + 1] && i >= 0) {
        glow(ST.tB[j], RED); glow(ST.pB[i + 1].obj, RED);
        yield { cap: 'p[' + j + '] = ' + p[j] + ' ≠ p[' + (i + 1) + '] = ' + p[i + 1] + ' → 退回 i = f(' + i + ') = ' + f[i], f: '用之前算好的 f 往回跳，不用從頭比', ms: 1300, warn: true };
        i = f[i];
        marksOff();
        align(j, i);
        yield { cap: '副本往右滑：改比 p[' + (i + 1) + ']', f: 'i = ' + i, ms: 800 };
      }
      if (p[j] === p[i + 1]) {
        f[j] = i + 1;
        for (let k = 0; k <= f[j]; k++) { glow(ST.pB[k].obj, GREEN); glow(ST.tB[j - f[j] + k], GREEN); }
        setF(j);
        yield { cap: 'p[' + j + '] = p[' + (i + 1) + '] = ' + p[j] + ' → f(' + j + ') = ' + f[j], f: '前綴「' + p.slice(0, f[j] + 1) + '」= 以 p[' + j + '] 結尾的後綴', ms: 1500 };
      } else {
        f[j] = -1;
        glow(ST.tB[j], RED); glow(ST.pB[0].obj, RED);
        setF(j);
        yield { cap: 'p[' + j + '] = ' + p[j] + ' ≠ p[0] = ' + p[0] + ' → f(' + j + ') = −1', f: '沒有任何前綴等於後綴', ms: 1400 };
      }
    }
    marksOff();
    yield { cap: 'Failure function 完成', f: 'f = ' + f.join(' ') + '　（π = f + 1：' + f.map((x) => x + 1).join(' ') + '）', ms: 3000, done: true, f_: f };
  }
  function ffState() {
    const f = FF.cur || [];
    const show = (g) => [...ST.pat].map((_, j) => (f[j] === null || f[j] === undefined ? '·' : g(f[j]))).join(' ');
    setState('Failure function（Horowitz：f(0) = −1）', [['pattern', [...ST.pat].join(' ')], ['f', show((x) => x)], ['π = f + 1（前綴長度版）', show((x) => x + 1)]],
      'f(j) = max{ i &lt; j | p₀…pᵢ = p_(j−i)…p_j }，不存在 → −1<br>建表 O(m)：i 每次退回都至少少 1，總退回次數 ≤ 總前進次數');
  }
  function enterFailure() {
    controls('<label>pattern <input id="fP" value="' + FF.p + '" style="width:130px" maxlength="12"></label>'
      + '<button class="primary" id="sStep">下一步</button><button id="sAuto">自動播放</button><button id="sReset">套用／重來</button>');
    on('sStep', () => { clearTimeout(timer); if (!step()) log('已經結束了。'); });
    on('sAuto', autoPlay);
    on('sReset', () => { const v = clean($('fP').value, 12); if (v.length >= 2) FF.p = v; else log('pattern 至少 2 個字元。', true); clearLog(); enterFailure(); });
    // 上排用 text 列畫 pattern 本身；下排是可滑動的副本
    setupRows(FF.p + ' '.repeat(Math.max(0, FF.p.length - 1)), FF.p, [0, 7.5, 10]);
    // 把多出來的空白格藏起來（只是為了讓副本有地方滑）
    ST.tB.forEach((m, i) => { if (i >= FF.p.length) m.visible = false; });
    lab.world.children.forEach((o) => { if (o.element && /^\d+$/.test(o.element.textContent) && Number(o.element.textContent) >= FF.p.length) o.element.style.display = 'none'; });
    ST.pat = FF.p;
    FF.fLbl = []; FF.piLbl = []; FF.cur = [];
    for (let j = 0; j < FF.p.length; j++) {
      FF.fLbl.push(txt('', 'idx', V(tx(j), 1.25, TZ)));
      FF.piLbl.push(txt('', 'idx', V(tx(j), 1.75, TZ - 0.2)));
    }
    txt('f', 'ptr', V(tx(0) - ST.cw - 0.3, 1.25, TZ));
    txt('j', 'idx', V(tx(0) - ST.cw - 0.3, 0.05, TZ - 0.85));
    txt('副本', 'idx', V(tx(0) - ST.cw - 0.4, 0.3, PZ));
    RUN.gen = buildFailure(); RUN.done = false; RUN.onState = ffState;
    log('上排：pattern 本身（看 p[j]）。下排：同一個 pattern 的副本，滑到讓 p[i+1] 對齊 p[j]。');
    log('綠色重疊的部分 = 「前綴 = 後綴」，它的最後一個索引就是 f(j)。');
    ffState();
  }

  // ───────────────────────── KMP 比對 ─────────────────────────
  const KM = { t: 'abcabcabdabcabd', p: 'abcabd' };
  function* kmp() {
    const t = ST.text, p = ST.pat, n = t.length, m = p.length, f = failure(p);
    let i = 0, j = 0;
    slideTo(0);
    yield { cap: '先建 failure function', f: 'f = ' + f.join(' '), ms: 1600 };
    while (i < n) {
      if (ST.s !== i - j) { clearMarks(); slideTo(i - j); }
      const ok = t[i] === p[j];
      mark(i, j, ok);
      pointers(i, j);
      if (ok) {
        yield { cap: 't[' + i + '] = p[' + j + '] = ' + t[i] + ' → i++, j++', f: '比較次數 ' + ST.cmp, ms: 420 };
        i++; j++;
        if (j === m) {
          ST.found.push(i - m); clearMarks();
          yield { cap: '在位置 ' + (i - m) + ' 找到！', f: '繼續找：j = f(m−1) + 1 = ' + (f[m - 1] + 1), ms: 1500 };
          j = f[m - 1] + 1;
        }
      } else if (j === 0) {
        yield { cap: 't[' + i + '] ≠ p[0] → 只能 i++', f: 'j 已經是 0，沒有前綴可以利用', ms: 650, warn: true };
        i++;
      } else {
        const nj = f[j - 1] + 1;
        yield { cap: 't[' + i + '] ≠ p[' + j + '] → j = f(' + (j - 1) + ') + 1 = ' + nj, f: 'i 不倒退；pattern 一次右移 ' + (j - nj) + ' 格', ms: 1300, warn: true };
        j = nj;
        clearMarks();
        slideTo(i - j);
        for (let k = 0; k < j; k++) { glow(ST.pB[k].obj, GOLD); }
        pointers(i, j);
        yield { cap: '前 ' + j + ' 個字元已知相同，不用再比', f: '金色 = 靠 failure function 省下的比較', ms: 1100 };
      }
    }
    pointers(null, null);
    const nc = naiveCount(t, p);
    yield { cap: 'KMP 結束：比了 ' + ST.cmp + ' 次（暴力法 ' + nc + ' 次）', f: '<span class="ok">i 從不倒退 → O(n + m)</span>', ms: 3000, done: true };
  }
  function kmpState() {
    const f = failure(ST.pat);
    setState('KMP（Horowitz pmatch）', [['pattern / f', ST.pat + ' / ' + f.join(' ')], ['比較次數', String(ST.cmp)], ['同一題暴力法', naiveCount(ST.text, ST.pat) + ' 次'], ['找到位置', ST.found.join(', ') || '—']],
      '失敗時：j = 0 → i++；否則 j = f(j−1) + 1（i 不動）<br>i 只會往前 → 比對 O(n)，加上建表 O(m)');
  }
  function enterKMP() {
    rowControls('', KM.t, KM.p);
    setupRows(KM.t, KM.p);
    $('sT').value = KM.t; $('sP').value = KM.p;
    on('sReset', () => { [KM.t, KM.p] = readInputs(KM.t, KM.p); clearLog(); enterKMP(); });
    RUN.gen = kmp(); RUN.done = false; RUN.onState = kmpState;
    log('KMP：比對失敗時，text 的指標 i 不倒退；pattern 依 failure function 一次跳好幾格。');
    kmpState();
  }

  // ───────────────────────── Boyer-Moore ─────────────────────────
  const BM = { t: 'TRUSTHARDTOOTHBRUSHES', p: 'TOOTH', gs: false };
  function* boyerMoore() {
    const t = ST.text, p = ST.pat, n = t.length, m = p.length, L = lastOcc(p), gs = goodSuffix(p);
    let s = 0;
    yield { cap: '由右往左比；先建 last(c) 表', f: Object.keys(L).map((c) => 'last(' + c + ')=' + L[c]).join('  ') + '，其他 = −1', ms: 2000 };
    while (s + m <= n) {
      clearMarks(); slideTo(s);
      let j = m - 1;
      for (;;) {
        const ok = t[s + j] === p[j];
        mark(s + j, j, ok);
        pointers(s + j, j);
        if (!ok) break;
        yield { cap: t[s + j] + ' = ' + p[j] + '，往左', f: '比較次數 ' + ST.cmp, ms: 420 };
        if (j === 0) { j = -1; break; }
        j--;
      }
      if (j < 0) {
        ST.found.push(s); clearMarks();
        const sh = BM.gs ? gs[0] : 1;
        yield { cap: '在位置 ' + s + ' 找到！', f: '右移 ' + sh + (BM.gs ? '（好後綴表 shift[0]）' : ''), ms: 1500 };
        s += sh;
        continue;
      }
      const c = t[s + j];
      const lc = L[c] ?? -1;
      const bc = j - lc;
      const g = gs[j + 1];
      const sh = BM.gs ? Math.max(bc, g) : Math.max(1, bc);
      yield { cap: '壞字元 ' + c + '：' + (lc < 0 ? 'pattern 裡沒有 ' + c : 'pattern 最後的 ' + c + ' 在 ' + lc),
        f: '壞字元 shift = j − last(' + c + ') = ' + j + ' − (' + lc + ') = ' + bc + (BM.gs ? '，好後綴 shift = ' + g + ' → 取 ' + sh : bc < 1 ? ' → 至少移 1' : ''), ms: 1700, warn: true };
      if (lc >= 0 && lc < j) { glow(ST.pB[lc].obj, GOLD); }
      s += sh;
      if (s + m <= n) {
        slideTo(s, 0);
        yield { cap: '一次右移 ' + sh + ' 格' + (lc >= 0 && sh === bc ? '：讓 pattern 的 ' + c + ' 對齊 text 的 ' + c : lc < 0 ? '：整個 pattern 跳過 ' + c : ''), f: '比較次數 ' + ST.cmp, ms: 1300 };
      }
    }
    pointers(null, null);
    yield { cap: 'Boyer-Moore 結束：比了 ' + ST.cmp + ' 次', f: '暴力法 ' + naiveCount(t, p) + ' 次、KMP ' + kmpCount(t, p) + ' 次', ms: 3000, done: true };
  }
  function bmState() {
    const L = lastOcc(ST.pat);
    setState('Boyer-Moore', [['last(c)', Object.keys(L).map((c) => c + ':' + L[c]).join(' ') + '，其他 −1'], ['規則', BM.gs ? '壞字元 + 好後綴（取大）' : '只用壞字元'],
      ['比較次數', String(ST.cmp)], ['找到位置', ST.found.join(', ') || '—']],
      '從 pattern 右端往左比<br>壞字元：shift = max(1, j − last(c))<br>字母表大、pattern 長時常常一次跳 m 格 → 次線性');
  }
  function enterBM() {
    rowControls('<label><input type="checkbox" id="bmGS"> 加上好後綴</label>', BM.t, BM.p);
    setupRows(BM.t, BM.p);
    $('sT').value = BM.t; $('sP').value = BM.p;
    $('bmGS').checked = BM.gs;
    $('bmGS').onchange = (e) => { BM.gs = !!e.target.checked; clearLog(); enterBM(); };
    on('sReset', () => { [BM.t, BM.p] = readInputs(BM.t, BM.p); clearLog(); enterBM(); });
    RUN.gen = boyerMoore(); RUN.done = false; RUN.onState = bmState;
    log('Boyer-Moore：pattern 由右往左比。失敗時看 text 上那個「壞字元」在 pattern 哪裡，直接把它對齊。');
    bmState();
  }

  // ───────────────────────── Rolling hash（MIT 6.006 Rec 9b） ─────────────────────────
  const RK = { t: 'GATTACAGACTGATCAG', p: 'GAT', q: 13, base: 8, bars: [], buckets: [] };
  const DIG = { A: 0, C: 2, G: 4, T: 6 };
  function* rabinKarp() {
    const t = ST.text, p = ST.pat, n = t.length, m = p.length, q = RK.q, b = RK.base;
    const d = (c) => DIG[c] ?? 0;
    let bm = 1;
    for (let k = 0; k < m - 1; k++) bm = (bm * b) % q;
    let hp = 0, h = 0;
    for (let k = 0; k < m; k++) { hp = (hp * b + d(p[k])) % q; h = (h * b + d(t[k])) % q; }
    // 直方圖：q 個桶
    const bw = Math.min(0.78, 12.6 / q);
    RK.buckets = [];
    for (let v = 0; v < q; v++) {
      const x = (v - (q - 1) / 2) * bw;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.06, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: v % 2 ? '#f3e1c4' : '#e8dcc4' }));
      tile.position.set(x, 0.03, -3.9);
      lab.world.add(tile);
      txt(String(v), 'idx', V(x, 0.1, -3.3));
      RK.buckets.push({ x, n: 0, cubes: [] });
    }
    const addToBucket = (v) => {
      const B = RK.buckets[v];
      const m3 = lab.box(v % 2 ? '#dd8238' : '#4b9ee2', [bw - 0.12, 0.3, 0.5]);
      m3.position.set(B.x, 4, -3.9);
      const body = lab.addBody(m3);
      lab.dropTo(body, V(B.x, 0.2 + B.n * 0.32, -3.9));
      B.n++;
    };
    // 每個視窗的 hash 值放在視窗起點正後方
    txt('hash', 'idx', V(tx(0) - ST.cw - 0.2, 0.2, -2.25));
    const hashBlock = (s, v, hit) => {
      const m3 = lab.box(hit ? '#c08a1f' : '#cbbd9f', [ST.cw - 0.1, 0.35, 0.6]);
      m3.add(lab.label(String(v), 'val'));
      m3.position.set(tx(s), 3, -2.25);
      const body = lab.addBody(m3);
      lab.dropTo(body, V(tx(s), 0.2, -2.25));
    };
    yield { cap: 'ACGT → 0,2,4,6；b = ' + b + '，mod ' + q, f: 'hash(「' + p + '」) = ' + hp, ms: 2400 };
    let hits = 0, spur = 0;
    for (let s = 0; s + m <= n; s++) {
      if (s > 0) {
        const out = d(t[s - 1]), inn = d(t[s + m - 1]);
        h = ((((h - out * bm) % q) + q) % q * b + inn) % q;
      }
      clearMarks(); slideTo(s);   // no lift: lifted, the pattern row lands right on top of the text row on screen
      ST.pB.forEach((bd) => bd.obj.traverse((o) => { if (o.material && o.material.transparent === false) { o.material.transparent = true; o.material.opacity = 0.35; } }));
      for (let k = 0; k < m; k++) glow(ST.tB[s + k], '#3a2f10');
      hashBlock(s, h, h === hp);
      addToBucket(h);
      yield s === 0
        ? { cap: '第一個視窗直接算 hash', f: 'h = ' + h, ms: 1100 }
        : { cap: '視窗右移：去掉 ' + t[s - 1] + '、加進 ' + t[s + m - 1], f: 'h = ((h − ' + d(t[s - 1]) + '·b^' + (m - 1) + ')·b + ' + d(t[s + m - 1]) + ') mod ' + q + ' = ' + h + '，O(1)', ms: 900 };
      if (h === hp) {
        hits++;
        let ok = true;
        for (let k = 0; k < m; k++) { const e = t[s + k] === p[k]; mark(s + k, k, e); if (!e) { ok = false; break; } }
        if (ok) { ST.found.push(s); yield { cap: 'hash 相同，逐字確認：真的相同！', f: '<span class="ok">在位置 ' + s + ' 找到</span>', ms: 1500 }; }
        else { spur++; yield { cap: 'hash 相同，但字元不同：假警報（collision）', f: '<span class="no">hash 相同 ≠ 字串相同，一定要再逐字確認</span>', ms: 1700, warn: true }; }
      }
    }
    const used = RK.buckets.filter((B) => B.n).length;
    const odd = RK.buckets.filter((B, v) => v % 2 && B.n).length;
    yield { cap: '共 ' + (n - m + 1) + ' 個視窗，hash 命中 ' + hits + ' 次（假警報 ' + spur + '）', f: '用到 ' + used + ' / ' + q + ' 個桶' + (q % 2 === 0 ? '，<span class="no">奇數桶 ' + odd + ' 個：全是偶數 hash</span>' : ''), ms: 3200, done: true };
  }
  function rkState() {
    setState('Rolling hash（Rabin-Karp）', [['編碼', 'A=0 C=2 G=4 T=6'], ['base / mod', RK.base + ' / ' + RK.q + (RK.q === 16 ? '（= 2⁴，2 的次方）' : '（質數）')], ['找到位置', ST.found.join(', ') || '—']],
      'h(s+1) = (h(s) − d_out·b^(m−1))·b + d_in　mod q<br>每次滑動 O(1)；hash 相同才逐字比 → 期望 O(n + m)<br>'
      + (RK.q === 16 ? '<span class="no">mod 2^w：數字都是偶數 → hash 也都是偶數</span>' : '質數模數讓 hash 分散得比較均勻'));
  }
  function enterRK() {
    controls('<label>text <input id="sT" value="' + RK.t + '" style="width:190px" maxlength="20"></label>'
      + '<label>pattern <input id="sP" value="' + RK.p + '" style="width:70px" maxlength="5"></label>'
      + '<label>mod <select id="rkQ"><option value="13">13（質數）</option><option value="16">16 = 2⁴</option></select></label>'
      + '<button class="primary" id="sStep">下一步</button><button id="sAuto">自動播放</button><button id="sReset">套用／重來</button>');
    $('rkQ').value = String(RK.q);
    $('rkQ').onchange = (e) => { RK.q = Number(e.target.value); clearLog(); enterRK(); };
    on('sStep', () => { clearTimeout(timer); if (!step()) log('已經結束了。'); });
    on('sAuto', autoPlay);
    on('sReset', () => {
      const t = String($('sT').value || '').toUpperCase().replace(/[^ACGT]/g, '').slice(0, 20);
      const p = String($('sP').value || '').toUpperCase().replace(/[^ACGT]/g, '').slice(0, 5);
      if (t.length < 4 || p.length < 2 || p.length > t.length) log('只能用 A、C、G、T；text 至少 4 個、pattern 2～5 個。', true);
      else { RK.t = t; RK.p = p; }
      clearLog(); enterRK();
    });
    setupRows(RK.t, RK.p, [0, 8.5, 10]);
    RUN.gen = rabinKarp(); RUN.done = false; RUN.onState = rkState;
    log('MIT 6.006 Recitation 9b：把 DNA 字串看成 base b 的大數字，對 q 取餘數當 hash；視窗每右移一格只要 O(1) 更新。');
    log('最後一排是 hash 值的分布（每個桶 = 一個 hash table 的格子）。');
    rkState();
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    el.innerHTML = '<h2>字串比對演算法對照</h2>'
      + '<table class="lab-table"><thead><tr><th>演算法</th><th>前處理</th><th>比對（最壞）</th><th>重點</th></tr></thead><tbody>'
      + '<tr><th>暴力法</th><td>無</td><td class="on">O(nm)</td><td>每次失敗右移 1 格，資訊全丟</td></tr>'
      + '<tr><th>KMP</th><td class="o1">O(m) 建 failure function</td><td class="o1">O(n)</td><td>text 指標 i 不倒退；總共 O(n + m)</td></tr>'
      + '<tr><th>Boyer-Moore</th><td>O(m + |Σ|)</td><td class="on">O(nm)（加好後綴等改良可到 O(n)）</td><td>由右往左比，實務上常常一次跳 m 格</td></tr>'
      + '<tr><th>Rabin-Karp</th><td>O(m)</td><td class="on">期望 O(n + m)，最壞 O(nm)</td><td>rolling hash，hash 相同還要逐字確認</td></tr>'
      + '</tbody></table>'
      + '<h3>Failure function 的兩種寫法</h3>'
      + '<table class="lab-table"><thead><tr><th>pattern</th><th>a</th><th>b</th><th>c</th><th>a</th><th>b</th><th>c</th><th>a</th><th>c</th><th>a</th><th>b</th></tr></thead><tbody>'
      + '<tr><th>Horowitz f(j)</th>' + failure('abcabcacab').map((x) => '<td>' + x + '</td>').join('') + '</tr>'
      + '<tr><th>前綴長度 π(j) = f(j) + 1</th>' + failure('abcabcacab').map((x) => '<td>' + (x + 1) + '</td>').join('') + '</tr>'
      + '</tbody></table>'
      + '<p class="src">本實驗一律用 Horowitz 的 f（從 −1 開始）。考卷若寫 next[]、π[] 或從 1 開始編號，先確認它的定義再換算。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">KMP 失敗時是改 j，不是改 i：j = f(j−1) + 1。只有在 j = 0 時才 i++。</div>'
      + '<div class="lab-trap">壞字元 shift = j − last(c) 可能是 0 或負數（c 最後出現在 j 的右邊），這時至少要移 1 格；加上好後綴規則就不會發生。</div>'
      + '<div class="lab-trap">Rolling hash 的模數不要用 2 的次方：輸入有規律（例如全是偶數編碼）時，輸出也會有同樣的規律，hash table 有一半格子永遠用不到（MIT 6.006 Rec 9b）。</div>';
  }

  let qs = { score: 0, total: 0 };
  function randPat(len, alpha) {
    for (;;) {
      const p = [...Array(len)].map(() => alpha[Math.floor(Math.random() * alpha.length)]).join('');
      if (failure(p).some((x) => x >= 0)) return p;
    }
  }
  function genQ() {
    const t = Math.floor(Math.random() * 6);
    if (t <= 1) {
      const p = randPat(6 + Math.floor(Math.random() * 3), 'abc'.slice(0, 2 + Math.floor(Math.random() * 2)));
      const f = failure(p);
      const ans = f.join(' ');
      const pi = f.map((x) => x + 1).join(' ');
      const shifted = [-1, ...f.slice(0, -1)].join(' ');
      const k = 1 + Math.floor(Math.random() * (f.length - 1));
      const pert = f.map((x, i) => (i === k ? (x >= 0 ? x - 1 : 0) : x)).join(' ');
      const opts = [...new Set([ans, pi, shifted, pert])];
      return { q: 'pattern = ' + p + '，依 Horowitz 定義（f(0) = −1，沒有相同前後綴時為 −1），failure function f(0..' + (p.length - 1) + ') 是？', opts, ans,
        why: '逐一看 p₀…pⱼ 最長的「真前綴 = 後綴」，f 記它的最後索引。' + (opts.includes(pi) ? '「' + pi + '」是前綴長度版 π = f + 1，定義不同。' : '') };
    }
    if (t === 2) {
      const n = 8 + Math.floor(Math.random() * 20), m = 2 + Math.floor(Math.random() * 5);
      const a = m * (n - m + 1);
      const opts = [...new Set([a, n * m, n - m + 1, n + m])].map(String);
      return { q: 'text 長 n = ' + n + '、pattern 長 m = ' + m + '，暴力法最壞要比較幾次字元？', opts, ans: String(a), why: '有 n − m + 1 個對齊位置，每個最多比 m 次：' + m + ' × ' + (n - m + 1) + ' = ' + a + '（例如 text = aaa…a、pattern = aa…ab）。' };
    }
    if (t === 3) {
      const p = randPat(6, 'ab');
      const f = failure(p);
      const j = 1 + Math.floor(Math.random() * (p.length - 1));
      const a = f[j - 1] + 1;
      const opts = [...new Set([a, j - 1, 0, f[j] + 1, j, a + 1].filter((x) => x >= 0))].slice(0, 4).map(String);
      return { q: 'pattern = ' + p + '（f = ' + f.join(' ') + '）。KMP 比到 p[' + j + '] 時失敗，下一步 j 變成？（i 不動）', opts, ans: String(a),
        why: 'j = f(j − 1) + 1 = f(' + (j - 1) + ') + 1 = ' + f[j - 1] + ' + 1 = ' + a + '：p₀…p' + (a - 1 >= 0 ? (a - 1) : '₋₁') + ' 已經知道和 text 相同，不用重比。' };
    }
    if (t === 4) {
      const pats = ['EXAMPLE', 'TOOTH', 'NEEDLE', 'BANANA', 'ABRACAD'];
      const p = pats[Math.floor(Math.random() * pats.length)];
      const L = lastOcc(p);
      const j = Math.floor(Math.random() * p.length);
      const pool = [...'ABCDEHLMNOPTXZ'].filter((c) => c !== p[j]);
      const c = pool[Math.floor(Math.random() * pool.length)];
      const lc = L[c] ?? -1;
      const a = Math.max(1, j - lc);
      const opts = [...new Set([a, j + 1, p.length, Math.max(1, p.length - 1 - lc), 1, a - 1, j].filter((x) => x >= 1))].slice(0, 4).map(String);
      return { q: 'Boyer-Moore（只用壞字元規則）：pattern = ' + p + '，由右往左比到 p[' + j + '] 時，text 的字元是 ' + c + '（不相同）。pattern 要右移幾格？', opts, ans: String(a),
        why: 'last(' + c + ') = ' + lc + '，shift = max(1, j − last(c)) = max(1, ' + j + ' − (' + lc + ')) = ' + a + '。' };
    }
    const bank = [
      { q: 'KMP 字串比對（含建 failure function）的時間複雜度？', a: 'O(n + m)', d: ['O(nm)', 'O(n log m)', 'O(m²)'] },
      { q: 'KMP 為什麼比對階段只要 O(n)？', a: 'text 的指標 i 從不倒退，每次比較後 i 前進或 pattern 右移', d: ['failure function 可以 O(1) 查表，所以每個字元只要比一次', '只比較 pattern 的最後一個字元，其餘字元直接跳過', '每次 mismatch 都把 pattern 右移 m 格，跳過已比過的部分'] },
      { q: 'Rolling hash 為什麼不建議用 2^w 當模數？（MIT 6.006 Rec 9b）', a: '輸入有規律（如編碼全是偶數）時 hash 也有同樣規律，分布不均', d: ['2^w 不是質數，在 mod 2^w 下完全不能做減法和乘法', '2^w 太小，任何長度的字串算出來的 hash 都會溢位', '2^w 下 base 一定沒有乘法反元素，rolling 更新會算錯'] },
      { q: 'Rabin-Karp 的 hash 值相同時要做什麼？', a: '逐字比較確認，因為可能是 collision（假警報）', d: ['直接回報找到，hash 相同就代表字串一定相同', '換一個模數重新計算 hash，直到兩者不同', '跳過這個位置，hash 相同多半只是 collision'] },
      { q: 'Boyer-Moore 在什麼情況下特別快？', a: '字母表大、pattern 長，壞字元常常不在 pattern 裡', d: ['字母表只有 0 和 1，壞字元幾乎都在 pattern 裡', 'text 和 pattern 幾乎全部相同，每次都比到最左邊', 'pattern 只有 1 個字元，每個位置都只比一次'] },
    ];
    const b = bank[Math.floor(Math.random() * bank.length)];
    return { q: b.q, opts: [b.a, ...b.d], ans: b.a, why: '答案：' + b.a + '。' };
  }
  function renderQuiz(el) {
    const p = genQ();
    const opts = shuffle([...p.opts]);
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

  // ───────────────────────── 舞台場景 ─────────────────────────
  const scenes = {
    'naive-slide': { title: '暴力法：一次右移一格', play: async (tok) => {
      NV.t = 'abcabcabdabcabd'; NV.p = 'abcabd'; enterNaive();
      say('暴力法：每個位置都從頭比', 'text 長 n、pattern 長 m');
      await beat(tok, 1800);
      await playGen(tok, 0.55);
    } },
    'failure-function': { title: 'Failure function 建表（Horowitz 例 abcabcacab）', play: async (tok) => {
      FF.p = 'abcabcacab'; enterFailure();
      await beat(tok, 1600);
      await playGen(tok, 0.6);
    } },
    'kmp-jump': { title: 'KMP：失敗時 j = f(j−1) + 1，i 不倒退', play: async (tok) => {
      KM.t = 'abcabcabdabcabd'; KM.p = 'abcabd'; enterKMP();
      say('同一題改用 KMP', 'f(abcabd) = ' + failure('abcabd').join(' '));
      await beat(tok, 2000);
      await playGen(tok, 0.6);
    } },
    'kmp-vs-naive': { title: '最壞情況：暴力 O(nm) vs KMP O(n + m)', play: async (tok) => {
      const t = 'aaaaaaaaaaaaab', p = 'aaaab';
      KM.t = t; KM.p = p; enterKMP();
      say('text = a…ab、pattern = aaaab：暴力法的最壞情況', '暴力法要 ' + naiveCount(t, p) + ' 次比較');
      await beat(tok, 2600);
      await playGen(tok, 0.4);
      say('KMP ' + kmpCount(t, p) + ' 次 vs 暴力 ' + naiveCount(t, p) + ' 次', '<span class="ok">O(n + m)</span> vs <span class="no">O(nm)</span>');
      await beat(tok, 2600);
    } },
    'bm-bad-character': { title: 'Boyer-Moore 壞字元：一次跳很多格', play: async (tok) => {
      BM.t = 'TRUSTHARDTOOTHBRUSHES'; BM.p = 'TOOTH'; BM.gs = false; enterBM();
      say('由右往左比，看 text 上「壞字元」', 'shift = max(1, j − last(c))');
      await beat(tok, 2000);
      await playGen(tok, 0.6);
    } },
    'bm-good-suffix': { title: 'Boyer-Moore 好後綴：比壞字元跳更遠', play: async (tok) => {
      BM.t = 'ABAABABACBBABAB'; BM.p = 'BABAB'; BM.gs = true; enterBM();
      say('好後綴：已比中的後綴，在 pattern 裡下次出現在哪', 'shift = max(壞字元, 好後綴)');
      await beat(tok, 2200);
      await playGen(tok, 0.6);
    } },
    'rolling-hash': { title: 'Rolling hash：視窗滑動 O(1) 更新（MIT Rec 9b）', play: async (tok) => {
      RK.q = 13; enterRK();
      await beat(tok, 1200);
      await playGen(tok, 0.7);
    } },
    'mod-2w-even-hash': { title: 'mod 2^w 的問題：hash 全是偶數（MIT Rec 9b）', play: async (tok) => {
      RK.q = 16; enterRK();
      say('同樣的 DNA，模數改成 2⁴ = 16', '編碼 0, 2, 4, 6 都是偶數，base 8 也是偶數');
      await beat(tok, 2400);
      await playGen(tok, 0.45);
      say('奇數的桶一個都沒有：一半的 hash table 浪費了', '<span class="no">輸入的規律原封不動留在 hash 裡</span>');
      await beat(tok, 3000);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ strm.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, arrow, ghostBox, travel, remove, buddy, prop, bob, lnode, step, GOLD, GREEN, RED, GRAY } = K;
// ─── V5-7GzOfADQ（Abdul Bari：KMP）、-DwGrJ8JxDc（MIT 6.006 Rec 9b）、qQ8vS2btsxI（Abdul Bari：Rabin-Karp） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (see the notes' "cues");
// beats are motion only. A little helper (pal) in the corner reacts to what happens.
const smC = (c) => colorFor(String(c).charCodeAt(0));
const smSup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const pal = (x = -6.2, z = 2.8, s = 0.6) => buddy('', '', '#ffc56b', x, 0, z, s);
// a row of letter cubes centred on x = 0 (or starting at o.x0); idx tags start at o.base
function smRow(s, z, o = {}) {
  const n = s.length, cw = o.cw || Math.min(0.95, 12.4 / Math.max(n, 8));
  const x0 = o.x0 !== undefined ? o.x0 : -(n - 1) * cw / 2;
  const R = { s, n, cw, z, cs: [], at: (i) => x0 + i * cw };
  for (let i = 0; i < n; i++) {
    R.cs.push(cube(s[i], o.color || smC(s[i]), [cw - 0.08, 0.5, o.d || 0.85], R.at(i), 0.25, z, o.drop || 0));
    if (o.idx !== false) tag(String(i + (o.base || 0)), 'idx', R.at(i), 0, z + (o.idz || 0.75));
  }
  return R;
}
// a pattern row that slides under text row T (cube k sits under text index s + k)
function smPat(T, p, z, drop = 2.5) {
  const P = { p, m: p.length, s: 0, z, cs: [] };
  for (let k = 0; k < p.length; k++) P.cs.push(cube(p[k], smC(p[k]), [T.cw - 0.08, 0.5, 0.85], T.at(k), 0.25, z, drop));
  P.slide = (s) => { P.s = s; P.cs.forEach((c, k) => move(c, T.at(s + k), 0.25, z)); };
  return P;
}
const smOff = (...arrs) => arrs.forEach((a) => a.forEach((c) => glow(c, null)));
// longest proper prefix that is also a suffix (Abdul Bari's π / LPS, values = lengths)
function smLps(p) { const f = [0]; let k = 0; for (let i = 1; i < p.length; i++) { while (k && p[i] !== p[k]) k = f[k - 1]; if (p[i] === p[k]) k++; f.push(k); } return f; }
// naive matcher on rows T / P with i, j pointers above / below (indices shown 1-based)
function smNaive(tok, T, P, zi, zj) {
  const N = { cmp: 0, i: 0, j: 0 };
  N.ip = tag('i = 1', 'ptr', T.at(0), 1.1, zi); N.jp = tag('j = 1', 'ptr alt', T.at(0), -0.1, zj);
  N.put = (i, j) => { N.i = i; N.j = j; N.ip.position.set(T.at(i), 1.1, zi); txt(N.ip, 'i = ' + (i + 1)); N.jp.position.set(T.at(i), -0.1, zj); txt(N.jp, 'j = ' + (j + 1)); };
  // compare text[s + j] with pattern[j]
  N.look = (s, j) => {
    const i = s + j, ok = T.s[i] === P.p[j]; N.cmp++; N.put(i, j);
    glow(T.cs[i], ok ? GREEN : RED); glow(P.cs[j], ok ? GREEN : RED);
    return ok;
  };
  N.align = (s) => { smOff(T.cs, P.cs); P.slide(s); N.put(s, 0); };
  return N;
}

// ════════ V5-7GzOfADQ（Abdul Bari：KMP） ════════
// 00:00 問題定義＋暴力法例一：abcdefgh 找 def（11 steps）
FRAG.push(['strm-naive-def', '暴力法例一：abcdefgh 找 def', async (tok) => {
  fresh([0, 7.5, 10], [0, 0.2, 0.3]);
  const t = 'abcdefgh', p = 'def';
  const G = pal(-6.0, 2.8);
  await step(tok);                                   // 0:00 KMP is used for pattern matching
  const T = smRow(t, -1.2, { base: 1, cw: 1.1, drop: 1.5 });
  tag('string', 'ptr', T.at(0) - 1.4, 0.3, -1.2);
  say('KMP：一種 pattern matching 演算法', '在一個 string 裡找 pattern');
  await step(tok);                                   // 0:08 is this pattern inside the string?
  const P = smPat(T, p, 1.0);
  tag('pattern', 'ptr alt', T.at(0) - 1.5, 0.3, 1.0);
  const q = bubble('def 在 string 裡嗎？', 3.4, 1.3, 1.0);
  say('pattern 有沒有出現在 string 裡？', 'pattern = def');
  await step(tok);                                   // 0:15 if it is there, find its index
  txt(q, '在的話：在第幾個？');
  G.mood('wow');
  say('有的話，還要找出它的 index', 'index 從 1 開始數');
  await step(tok);                                   // 0:23 many algorithms; first the naive one
  txt(q, '先看暴力法，再看 KMP');
  pkt('naive（暴力法）', -2.2, 1.6, -3.0); pkt('KMP', 2.2, 1.6, -3.0);
  say('解法很多：先看最基本的暴力法', '看懂它的缺點，才知道 KMP 好在哪');
  await step(tok);                                   // 0:46 start from the first letter of the string
  remove(q); G.mood('calm');
  const go = pkt('從第 1 個字母開始', T.at(0), 1.4, 1.0);
  await travel(tok, go, V3(T.at(0) - 2, 1.4, 1.0), V3(T.at(1), 1.4, 1.0), 700);
  say('暴力法：pattern 對齊 string 開頭', '一個一個字母比');
  await step(tok);                                   // 0:56 a vs d: not matching
  remove(go);
  glow(T.cs[0], RED); glow(P.cs[0], RED);
  say('a ≠ d：不相同', '第一個字母就不一樣');
  await step(tok);                                   // 1:05 shift right by one; b vs d: no
  smOff(T.cs, P.cs); P.slide(1); await beat(tok, 700);
  glow(T.cs[1], RED); glow(P.cs[0], RED);
  say('pattern 右移一格：b ≠ d', '不相同 → 再右移');
  await step(tok);                                   // 1:15 shift again; c vs d: no
  smOff(T.cs, P.cs); P.slide(2); await beat(tok, 700);
  glow(T.cs[2], RED); glow(P.cs[0], RED);
  say('再右移一格：c ≠ d', '還是不相同');
  await step(tok);                                   // 1:23 shift; d = d, e = e: matching
  smOff(T.cs, P.cs); P.slide(3); await beat(tok, 700);
  for (let k = 0; k < 2; k++) { glow(T.cs[3 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 600); }
  say('d = d、e = e：相同就不用移', '繼續比下一個字母');
  await step(tok);                                   // 1:33 f = f: the pattern is found
  glow(T.cs[5], GREEN); glow(P.cs[2], GREEN);
  G.mood('happy'); await G.hop(tok);
  say('f = f：三個都相同 → 找到了！', 'pattern 在 string 裡');
  await step(tok);                                   // 1:40 at index 4 to 6
  good('index 4 ～ 6', T.at(4), 1.3, -1.2);
  say('找到：在 index 4 到 6', 'def = string[4..6]');
}]);

// 01:57 暴力法例二：abcdabcabcdf 找 abcdf，i 一直倒退（18 steps）
FRAG.push(['strm-naive-backtrack', '暴力法例二：i 一直倒退', async (tok) => {
  fresh([0, 8, 10.5], [0, 0.2, 0.2]);
  const t = 'abcdabcabcdf', p = 'abcdf';
  const T = smRow(t, -1.4, { base: 1, cw: 1.0 });
  const P = smPat(T, p, 1.2, 0);
  tag('pattern', 'ptr alt', T.at(0) - 1.5, 0.3, 1.2);
  const G = pal(-6.2, 3.2);
  let N, far = null, mark = null;
  await step(tok);                                   // 1:57 use index i (string) and j (pattern)
  N = smNaive(tok, T, P, -1.4, 2.2);
  say('不畫移動了：改用兩個 index', 'string 用 i、pattern 用 j');
  await step(tok);                                   // 2:03 a = a: move j and i
  N.look(0, 0);
  say('a = a：相同 → i、j 都往前', '比較 1 次');
  await step(tok);                                   // 2:15 b, c match too
  N.look(0, 1); await beat(tok, 600); N.look(0, 2);
  say('b = b、c = c：繼續往前', 'i、j 一起走');
  await step(tok);                                   // 2:27 d matches; then a mismatch
  N.look(0, 3); await beat(tok, 700); N.look(0, 4);
  G.mood('wow');
  say('d = d，但 a ≠ f：mismatch', '比到第 5 個才不一樣');
  await step(tok);                                   // 2:35 we started this pattern from here
  mark = pkt('這次從 index 1 開始', T.at(0), 1.8, -1.4);
  say('這一輪是從 string 第 1 個開始比的', 'mismatch → pattern 右移一格');
  await step(tok);                                   // 2:47 j back to the start, i back to index 2
  far = bad('i 曾走到 5', T.at(4), 1.9, -1.4);
  N.align(1);
  await travel(tok, N.ip, V3(T.at(4), 1.1, -1.4), V3(T.at(1), 1.1, -1.4), 900);
  remove(mark);
  say('j 回 pattern 開頭，i 退回 index 2', '從 b 重新開始');
  await step(tok);                                   // 3:01 this is the problem: i shifted back
  G.mood('sad');
  const w = bubble('走到 5 又退回 2：白做工', -5.0, 1.6, 3.2);
  say('這就是暴力法的問題：i 倒退了', '比過的字母又要重比 → 浪費時間');
  await step(tok);                                   // 3:18 start again here: b vs a mismatch
  remove(w); remove(far); G.mood('calm');
  N.look(1, 0);
  say('b ≠ a：mismatch', 'pattern 再右移一格');
  await step(tok);                                   // 3:30 c vs a: mismatch
  N.align(2); await beat(tok, 500); N.look(2, 0);
  say('c ≠ a：mismatch', '再右移');
  await step(tok);                                   // 3:35 d vs a: mismatch, move i
  N.align(3); await beat(tok, 500); N.look(3, 0);
  say('d ≠ a：mismatch', 'i 往下一個');
  await step(tok);                                   // 3:43 a = a, b = b
  N.align(4); await beat(tok, 500); N.look(4, 0); await beat(tok, 600); N.look(4, 1);
  say('a = a、b = b：相同 → 一起往前', '從 index 5 開始的這一輪');
  await step(tok);                                   // 3:54 c = c, then a ≠ d
  N.look(4, 2); await beat(tok, 700); N.look(4, 3);
  say('c = c，但 a ≠ d：mismatch', 'j 回開頭，i 又要退回');
  await step(tok);                                   // 4:04 bring i back: it had checked three letters
  far = bad('i 曾走到 8', T.at(7), 1.9, -1.4);
  N.align(5);
  await travel(tok, N.ip, V3(T.at(7), 1.1, -1.4), V3(T.at(5), 1.1, -1.4), 900);
  say('i 從 8 退回 6', '這一輪比過 3 個字母，又要退回去重比');
  await step(tok);                                   // 4:19 we are checking them again: the drawback
  for (let k = 5; k <= 6; k++) glow(T.cs[k], GOLD);
  G.mood('sad');
  say('b、c 剛剛才比過，又要再比一次', '暴力法的缺點：重複比較');
  await step(tok);                                   // 4:29 mismatch, i moves; mismatch, i moves
  remove(far); G.mood('calm');
  N.look(5, 0); await beat(tok, 700); N.align(6); await beat(tok, 400); N.look(6, 0);
  say('b ≠ a、c ≠ a：都 mismatch', 'pattern 一格一格右移');
  await step(tok);                                   // 4:36 now a = a
  N.align(7); await beat(tok, 500); N.look(7, 0);
  say('a = a：相同', '從 index 8 開始這一輪');
  await step(tok);                                   // 4:44 every character matches: found
  for (let k = 1; k < 5; k++) { N.look(7, k); await beat(tok, 450); }
  G.mood('happy');
  good('找到：index 8 ～ 12', T.at(9), 1.9, -1.4);
  say('b、c、d、f 都相同 → 找到！', 'string[8..12] = abcdf');
  await step(tok);                                   // 4:50 lesson: i backtracks; we want to avoid it
  bad('暴力法：mismatch 時 i 會倒退（backtrack）', 0, 1.6, 3.4);
  say('結論：暴力法會把 i 拉回去', 'KMP 要做的：讓 i 不倒退');
}]);

// 05:07 暴力法最壞情況：aaaaaaaaab 找 aaab → O(mn)（12 steps）
FRAG.push(['strm-naive-worst', '暴力法最壞情況：O(mn)', async (tok) => {
  fresh([0, 7.5, 10], [0, 0.2, 0.2]);
  const t = 'aaaaaaaaab', p = 'aaab';
  const G = pal(-6.2, 3.0);
  let T, P, N, cnt;
  const bump = () => txt(cnt, '比較 ' + N.cmp + ' 次');
  await step(tok);                                   // 5:07 a worst case of the naive algorithm
  T = smRow(t, -1.3, { base: 1, cw: 1.1, drop: 1.5 });
  P = smPat(T, p, 1.2);
  say('暴力法的最壞情況', 'string 幾乎全是 a，pattern = aaab');
  await step(tok);                                   // 5:24 i and j start: a = a
  N = smNaive(tok, T, P, -1.3, 2.2);
  cnt = tag('比較 0 次', 'ptr', 4.6, 1.3, 2.6);
  N.look(0, 0); bump();
  say('a = a：相同 → i、j 都往前', '從 string 第 1 個開始');
  await step(tok);                                   // 5:39 match again
  N.look(0, 1); bump();
  say('a = a：繼續', '比較 2 次');
  await step(tok);                                   // 5:44 match, then a ≠ b
  N.look(0, 2); bump(); await beat(tok, 700); N.look(0, 3); bump();
  say('第 3 個也相同，第 4 個 a ≠ b', '比到最後一個才 mismatch');
  await step(tok);                                   // 5:54 j to the beginning, i to the second position
  N.align(1);
  await travel(tok, N.ip, V3(T.at(3), 1.1, -1.3), V3(T.at(1), 1.1, -1.3), 800);
  say('j 回開頭，i 回到第 2 個', 'pattern 右移一格，從頭再比');
  await step(tok);                                   // 6:09 matching, matching, matching
  for (let k = 0; k < 3; k++) { N.look(1, k); bump(); await beat(tok, 450); }
  say('a、a、a 又全部相同', '這些 a 剛剛其實比過了');
  await step(tok);                                   // 6:23 a vs b not matching: back again
  N.look(1, 3); bump(); await beat(tok, 700);
  N.align(2);
  say('a ≠ b：j 回開頭、i 回到第 3 個', '又從頭比一次');
  await step(tok);                                   // 6:30 the problem: a a a is repeating
  for (let k = 0; k < 3; k++) glow(P.cs[k], GOLD);
  G.mood('wow');
  say('問題：pattern 前面是一串重複的 a', '比過的 a 又在重比');
  await step(tok);                                   // 6:38 just check whether the next letter is b
  glow(P.cs[3], GREEN);
  const tip = bubble('前面都是 a，只要看下一個是不是 b！', 1.0, 1.6, 3.3);
  say('其實只要檢查下一個是不是 b', '不必退回去從頭比');
  await step(tok);                                   // 6:51 the naive algorithm doesn't study the pattern
  remove(tip); G.mood('sad');
  for (let s = 2; s <= t.length - p.length; s++) {
    N.align(s); await beat(tok, 120);
    for (let j = 0; j < p.length; j++) { const ok = N.look(s, j); bump(); await beat(tok, 70); if (!ok) break; }
  }
  say('暴力法不研究 pattern，盲目右移一格', '每個位置都從頭比到底');
  await step(tok);                                   // 7:10 string size n, pattern size m
  note('n = 10（string）', -3.0, 1.4, -2.6); note('m = 4（pattern）', 1.6, 1.4, -2.6);
  say('string 長 n、pattern 長 m', '每個位置最多比 m 次');
  await step(tok);                                   // 7:17 m into n: O(mn)
  bad('共 ' + N.cmp + ' 次 = 4 × 7 → O(mn)', 0, 1.6, 3.5);
  say('時間 O(mn)', '共 m(n − m + 1) = ' + N.cmp + ' 次比較');
}]);

// 07:32 prefix / suffix：abcdabc，abc 既是前綴也是後綴（12 steps）
FRAG.push(['strm-prefix-suffix', 'Prefix 與 suffix：abcdabc', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0.3]);
  const p = 'abcdabc', cw = 0.62, pre = [], suf = [];
  const G = pal(-6.3, 3.4, 0.55);
  let T;
  const preRow = (L) => { const z = -0.9 + (L - 1) * 1.05, row = []; for (let k = 0; k < L; k++) row.push(cube(p[k], smC(p[k]), [cw - 0.06, 0.4, 0.6], -6.2 + k * cw, 0.2, z, 2)); smOff(T.cs); for (let k = 0; k < L; k++) glow(T.cs[k], GOLD); pre.push(row); };
  const sufRow = (L) => { const z = -0.9 + (L - 1) * 1.05, s = p.slice(p.length - L), row = []; for (let k = 0; k < L; k++) row.push(cube(s[k], smC(s[k]), [cw - 0.06, 0.4, 0.6], 6.2 - (L - 1 - k) * cw, 0.2, z, 2)); smOff(T.cs); for (let k = p.length - L; k < p.length; k++) glow(T.cs[k], GREEN); suf.push(row); };
  await step(tok);                                   // 7:32 can we study the pattern? the idea of KMP
  T = smRow(p, -2.8, { base: 1, cw: 0.95, drop: 1.5 });
  say('KMP 的想法：先研究 pattern 本身', 'pattern = abcdabc');
  await step(tok);                                   // 7:42 terminology: prefix and suffix
  tag('prefix', 'ptr', -5.3, 0.3, -1.6); tag('suffix', 'ptr alt', 5.3, 0.3, -1.6);
  say('兩個名詞：prefix、suffix', 'prefix = 前綴、suffix = 後綴');
  await step(tok);                                   // 7:53 prefix: must start from the beginning
  const arrowL = pkt('→ 從開頭取', T.at(0), 1.2, -2.8);
  say('prefix：一定從開頭開始取', '要取幾個都可以');
  await step(tok);                                   // 8:05 a, then ab
  preRow(1); await beat(tok, 600); preRow(2);
  say('a 是 prefix、ab 也是', '從開頭取 1 個、2 個');
  await step(tok);                                   // 8:11 abc, abcd
  preRow(3); await beat(tok, 600); preRow(4);
  say('abc、abcd 也都是 prefix', '從開頭取 3 個、4 個');
  await step(tok);                                   // 8:20 suffix: start from the right-hand side
  remove(arrowL); smOff(T.cs);
  pkt('從尾端取 ←', T.at(6), 1.2, -2.8);
  say('suffix：一定從尾端往回取', '要取幾個都可以');
  await step(tok);                                   // 8:34 c, bc, abc
  for (let L = 1; L <= 3; L++) { sufRow(L); await beat(tok, 500); }
  say('c、bc、abc 都是 suffix', '從尾端取 1、2、3 個');
  await step(tok);                                   // 8:43 dabc
  sufRow(4);
  say('dabc 也是 suffix', '先取到這裡就好');
  await step(tok);                                   // 8:55 any prefix same as a suffix? a: no, ab: no
  smOff(T.cs);
  [0, 1].forEach((L) => { pre[L].forEach((c) => glow(c, RED)); suf[L].forEach((c) => glow(c, RED)); });
  say('有沒有 prefix 和 suffix 一樣？', 'a 對 c：不同；ab 對 bc：不同');
  await step(tok);                                   // 9:03 abc: yes, it's there
  pre[2].forEach((c) => glow(c, GREEN)); suf[2].forEach((c) => glow(c, GREEN));
  for (let k = 0; k < 3; k++) { glow(T.cs[k], GOLD); glow(T.cs[4 + k], GREEN); }
  good('abc', 0, 0.3, 1.2);
  G.mood('happy');
  say('abc 既是 prefix 也是 suffix！', '這就是 KMP 要觀察的');
  await step(tok);                                   // 9:26 simply: does the beginning appear again?
  arrow(V3(T.at(1), 0.7, -3.4), V3(T.at(5), 0.7, -3.4), 0xa8730f);
  say('簡單講：開頭那段，後面有沒有再出現', 'abc……abc');
  await step(tok);                                   // 9:39 KMP builds a π table (LPS)
  pkt('π 表 = LPS', 0, 1.6, 2.6);
  say('KMP 會為 pattern 建一張 π 表', 'LPS：Longest Prefix that is also Suffix');
}]);

// 10:03 四個 pattern 的 π 表（index 從 1、值 = 相同前後綴長度）（11 steps）
FRAG.push(['strm-pi-tables', '四個 pattern 的 π 表', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const pats = ['abcdabeabf', 'abcdeabfabc', 'aabcadaabe', 'aaaabaacd'], R = [];
  const cw = 0.85, x0 = -4.0;
  const G = pal(-6.4, -2.4, 0.5);
  const row = (r) => {
    const p = pats[r], z = -3.3 + r * 1.95;
    const cs = [...p].map((c, k) => cube(c, smC(c), [cw - 0.08, 0.45, 0.7], x0 + k * cw, 0.22, z, 2));
    tag('P' + (r + 1), 'ptr alt', x0 - 1.1, 0.25, z); tag('π', 'ptr', x0 - 1.1, 0.1, z + 0.75);
    R[r] = { p, z, cs, f: smLps(p), n: 0 };
  };
  // write π values up to (not including) index `to`, briefly lighting each repeat
  const fill = async (r, to, ms = 160) => {
    const W = R[r];
    for (; W.n < to; W.n++) {
      const j = W.n, v = W.f[j];
      tag(String(v), v ? 'ptr alt' : 'idx', x0 + j * cw, 0.05, W.z + 0.75);
      if (v) { for (let k = 0; k < v; k++) { glow(W.cs[k], GOLD); glow(W.cs[j - v + 1 + k], GREEN); } await beat(tok, ms); W.cs.forEach((c) => glow(c, null)); }
    }
  };
  await step(tok);                                   // 10:04 first pattern: a, ab appear again
  row(0);
  [0, 1].forEach((k) => glow(R[0].cs[k], GOLD)); [4, 5, 7, 8].forEach((k) => glow(R[0].cs[k], GREEN));
  say('pattern 1：開頭的 ab 後面又出現兩次', 'abcd ab e ab f');
  await step(tok);                                   // 10:18 prepare the table: 0 0 0 0
  R[0].cs.forEach((c) => glow(c, null));
  await fill(0, 4);
  say('先寫 0 0 0 0', 'a、b、c、d 前面沒有重複');
  await step(tok);                                   // 10:24 ab matches with 1 and 2
  await fill(0, 10, 450);
  say('π = 0 0 0 0 1 2 0 1 2 0', '數字 = 和開頭相同的那段有多長');
  await step(tok);                                   // 10:37 I'm not tracing the algorithm
  note('建表有演算法，這裡先用眼睛看', 3.4, 1.2, -3.3);
  say('建表的程式先不追蹤', '用眼睛找重複；照程式追也是一樣的答案');
  await step(tok);                                   // 10:49 pattern 2: ab → 1 2
  row(1); await fill(1, 8, 350);
  say('pattern 2：ab 又出現 → 1 2', 'abcde ab f……');
  await step(tok);                                   // 11:01 abc appears too → 1 2 3
  await fill(1, 11, 400);
  G.mood('happy');
  say('最後 abc 也出現 → 1 2 3', 'π = 0 0 0 0 0 1 2 0 1 2 3');
  await step(tok);                                   // 11:14 pattern 3: the second a itself → 1
  G.mood('calm');
  row(2); await fill(2, 2, 500);
  say('pattern 3：第 2 個 a 自己就配到開頭', 'π = 0 1 …');
  await step(tok);                                   // 11:21 a, then the next one too → 2
  await fill(2, 10, 300);
  bad('影片說其餘是 0；其實 aab 也重複 → 1 2 3', 3.0, 1.2, 0.6 + 0.75);
  say('π = 0 1 0 0 1 0 1 2 3 0', '注意：最後的 aab 也有重複');
  await step(tok);                                   // 11:27 pattern 4: a, aa, aaa → 1 2 3
  row(3); await fill(3, 4, 400);
  say('pattern 4：a 連續出現 → 0 1 2 3', '開頭的 a、aa、aaa 一直重複');
  await step(tok);                                   // 11:44 aa after b → 1 2, rest 0
  await fill(3, 9, 400);
  say('b 後面的 aa → 1 2，其餘 0', 'π = 0 1 2 3 0 1 2 0 0');
  await step(tok);                                   // 11:49 the table is the base of KMP
  G.mood('happy');
  say('π 表是 KMP 的基礎', '表建好，比對就簡單了');
}]);

// 12:03 / 15:58 KMP 追蹤：string ababcabcabababd、pattern ababd、π = 0 0 1 2 0；比 s[i] 與 p[j+1]
//   part 1：21 steps（12:03–15:58）；part 2：9 steps（15:58–17:46）
FRAG.push(['strm-kmp-trace', 'KMP 追蹤：ababcabcabababd 找 ababd', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 8.5, 10.5], [0, 0, 0.2]);
  const t = 'ababcabcabababd', p = 'ababd', pi = [0, 0, 0, 1, 2, 0];
  const cw = 0.85, px = (k) => -2.1 + k * cw;
  const G = pal(-6.3, 3.0, 0.55);
  let T = null, ip = null, jp = null, i = part === 1 ? 1 : 9, j = 0, last = false;
  const pc = [null], piL = [null];
  const iPos = (v) => V3(T.at(Math.min(v, 15) - 1), 1.05, -2.4), jPos = (v) => V3(px(v), 1.05, 1.0);
  const mkT = () => { T = smRow(t, -2.4, { base: 1, cw, drop: part === 1 ? 1.5 : 0 }); };
  const mkP = (drop) => { for (let k = 1; k <= 5; k++) pc.push(cube(p[k - 1], smC(p[k - 1]), [cw - 0.08, 0.5, 0.85], px(k), 0.25, 1.0, drop)); tag('pattern', 'ptr', px(0) - 1.5, 0.3, 1.0); };
  const mkPi = (k) => { piL[k] = tag(String(pi[k]), pi[k] ? 'ptr alt' : 'idx', px(k), 0.05, 1.85); };
  const mkIdx = () => { pc[0] = cube('', GRAY, [cw - 0.08, 0.3, 0.85], px(0), 0.15, 1.0); for (let k = 0; k <= 5; k++) tag(String(k), 'idx', px(k), 0, 0.3); tag('π', 'ptr', px(0) - 1.0, 0.05, 1.85); };
  const mkPtr = () => { ip = tag('i = ' + i, 'ptr', 0, 1.05, -2.4); jp = tag('j = ' + j, 'ptr alt', 0, 1.05, 1.0); ip.position.copy(iPos(i)); jp.position.copy(jPos(j)); };
  // one comparison: string[i] vs pattern[j + 1]
  const cmp = () => {
    const a = t[i - 1], b = p[j]; last = a === b;
    glow(T.cs[i - 1], last ? GREEN : RED); glow(pc[j + 1], last ? GREEN : RED);
    say('string[' + i + '] = ' + a + (last ? ' = ' : ' ≠ ') + 'pattern[' + (j + 1) + '] = ' + b, last ? 'match' : 'mismatch');
  };
  // what that comparison causes
  const act = async () => {
    const oi = i, oj = j;
    glow(pc[j + 1], null);
    if (last) { i++; j++; say('match → i、j 都往前', 'i = ' + i + '、j = ' + j); }
    else {
      glow(T.cs[i - 1], null);
      if (j > 0) { j = pi[j]; say('mismatch → j = π[' + oj + '] = ' + j, 'i 不動，只有 j 往回'); }
      else { i++; say('j 已經是 0，不能再退 → i 往前', 'i = ' + i); }
    }
    txt(ip, 'i = ' + i); txt(jp, 'j = ' + j);
    if (i !== oi) await travel(tok, ip, iPos(oi), iPos(i), 400);
    if (j !== oj) await travel(tok, jp, jPos(oj), jPos(j), 400);
  };
  const both = async () => { cmp(); await beat(tok, 650); await act(); };
  if (part === 1) {
    await step(tok);                                 // 12:03 the working of KMP
    mkT();
    say('KMP 怎麼跑：一步一步追蹤', 'string = ababcabcabababd');
    await step(tok);                                 // 12:08 we will not backtrack in the main string
    pkt('string 的 i：只往前，絕不倒退', 0, 1.0, -3.6);
    G.mood('wow');
    say('先記住：string 這邊不倒退', '暴力法的 i 會倒退，KMP 不會');
    await step(tok);                                 // 12:15 this is the pattern
    G.mood('calm');
    mkP(2);
    say('pattern = ababd', '比對之前，先建 π 表');
    await step(tok);                                 // 12:21 a appears again → 1
    for (let k = 1; k <= 3; k++) mkPi(k);
    glow(pc[1], GOLD); glow(pc[3], GREEN); await beat(tok, 900); glow(pc[1], null); glow(pc[3], null);
    say('第 3 個 a 和開頭的 a 一樣 → 1', 'π = 0 0 1 …');
    await step(tok);                                 // 12:30 b too → 2; d does not → 0
    mkPi(4); mkPi(5);
    [1, 2].forEach((k) => glow(pc[k], GOLD)); [3, 4].forEach((k) => glow(pc[k], GREEN));
    await beat(tok, 900); pc.slice(1).forEach((c) => glow(c, null));
    say('b 也一樣 → 2；d 沒有 → 0', 'π = 0 0 1 2 0');
    await step(tok);                                 // 12:44 indices 1..5 and an extra index 0
    mkIdx();
    say('pattern 標上 index 1 ～ 5', '多放一格 index 0 當起點');
    await step(tok);                                 // 12:57 i on the first letter, j on 0
    mkPtr();
    say('i 從 string 第 1 個開始', 'j 放在 0（不是 1）');
    await step(tok);                                 // 13:17 compare string[i] with pattern[j+1]
    cmp();
    await step(tok);                                 // 13:25 they match: move j and i
    await act();
    await step(tok);                                 // 13:32 again compare string[i] with pattern[j+1]
    cmp();
    await step(tok);                                 // 13:44 b matches: j and i move on
    await act();
    await step(tok);                                 // 13:51 j+1 matches: move
    await both();
    await step(tok);                                 // 14:01 b and b match: move
    await both();
    await step(tok);                                 // 14:14 now a mismatch
    cmp();
    G.mood('wow');
    await step(tok);                                 // 14:24 move j to π: ab came two times
    await act();
    [2, 3].forEach((k) => glow(T.cs[k], GOLD)); [1, 2].forEach((k) => glow(pc[k], GOLD));
    const ab = note('ab 已經比過：不用重比', px(1.5), 1.9, 1.0);
    await beat(tok, 1200);
    [2, 3].forEach((k) => glow(T.cs[k], null)); [1, 2].forEach((k) => glow(pc[k], null));
    await step(tok);                                 // 14:47 still a mismatch: move j again
    remove(ab); G.mood('calm');
    await both();
    await step(tok);                                 // 14:55 j is on 0: so move i
    await both();
    await step(tok);                                 // 15:04 only j moves; i never backtracks
    good('mismatch 時只有 j 在動', 3.6, 1.6, 2.4);
    G.mood('happy'); await G.hop(tok);
    say('i 只往前、從不倒退', '退的是 j，靠 π 表');
    await step(tok);                                 // 15:21 a matches, b matches
    await both(); await both();
    await step(tok);                                 // 15:38 c vs a: mismatch, j to 0, still mismatch
    await both(); cmp();
    await step(tok);                                 // 15:49 j is at zero: just move i
    await act();
  } else {
    mkT(); mkP(0); for (let k = 1; k <= 5; k++) mkPi(k); mkIdx(); mkPtr();
    for (let k = 0; k < 8; k++) tint(T.cs[k], GRAY);
    say('接著從 i = 9、j = 0 繼續', 'i 到現在都沒有倒退過');
    await step(tok);                                 // 15:58 a matches: move j, move i
    await both();
    await step(tok);                                 // 16:10 b matches, a matches
    await both(); await both();
    await step(tok);                                 // 16:19 b matches
    await both();
    await step(tok);                                 // 16:32 j+1 is d but this is a: mismatch
    cmp();
    G.mood('wow');
    await step(tok);                                 // 16:40 j to 2, then a = a matches
    await act(); await beat(tok, 300); await both();
    await step(tok);                                 // 16:55 ab is already there: no need to compare
    [10, 11].forEach((k) => glow(T.cs[k], GOLD)); [1, 2].forEach((k) => glow(pc[k], GOLD));
    note('ab 出現兩次：跳過第一次', px(1.5), 1.9, 1.0);
    G.mood('happy');
    say('前面的 ab 已知相同，不用重比', '從 pattern[3] 接著比');
    await step(tok);                                 // 17:12 j+1 matches: move
    [10, 11].forEach((k) => glow(T.cs[k], GREEN)); [1, 2].forEach((k) => glow(pc[k], null));
    await both();
    await step(tok);                                 // 17:20 d and d: match
    await both();
    await step(tok);                                 // 17:30 the end of the pattern: found
    for (let k = 10; k < 15; k++) glow(T.cs[k], GREEN);
    good('找到：string[11..15]', T.at(12), 1.9, -2.4);
    await G.hop(tok);
    say('j = 5 = m：找到 pattern！', 'string[11..15] = ababd');
  }
}]);

// 17:46 KMP 總結：i 不回頭；建表 m + 搜尋 n（6 steps）
FRAG.push(['strm-kmp-cost', 'KMP 時間：建表 m + 搜尋 n', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const T = smRow('ababcabcabababd', -2.2, { base: 1, cw: 0.85 });
  const P = smRow('ababd', 1.4, { base: 1, cw: 0.85, x0: -1.7 });
  const G = pal(-6.3, 3.2, 0.55);
  await step(tok);                                   // 17:46 if the beginning repeats, don't compare again
  [0, 1].forEach((k) => glow(P.cs[k], GOLD)); [2, 3].forEach((k) => glow(P.cs[k], GREEN));
  say('開頭那段在後面再出現，就不再重比', '這是 KMP 的核心');
  await step(tok);                                   // 17:58 never move i back
  smOff(P.cs);
  const cur = tag('i', 'ptr', T.at(0), 1.05, -2.2);
  for (let k = 0; k < 15; k++) { cur.position.set(T.at(k), 1.05, -2.2); glow(T.cs[k], GOLD); await beat(tok, 120); }
  say('i 只往前走，從不倒退', '暴力法才會把 i 拉回去');
  await step(tok);                                   // 18:10 time: string n, pattern m
  note('n = 15（string）', 5.4, 0.3, -1.2); note('m = 5（pattern）', 3.2, 0.3, 1.4);
  smOff(T.cs);
  say('時間複雜度？string 長 n、pattern 長 m', '分兩部分算');
  await step(tok);                                   // 18:18 we went through the string once: n
  for (let k = 0; k < 15; k++) { glow(T.cs[k], GREEN); await beat(tok, 90); }
  cube('n', '#c08a1f', [6.0, 0.4, 0.6], 0.0, 0.2, 3.2, 2);
  say('搜尋：string 只走過一次 → n', '每個字元一次');
  await step(tok);                                   // 18:26 preparing the table: m
  const c2 = tag('建表', 'ptr', P.at(0), 1.05, 1.4);
  for (let k = 0; k < 5; k++) { c2.position.set(P.at(k), 1.05, 1.4); glow(P.cs[k], GREEN); await beat(tok, 250); }
  cube('m', '#2fc092', [2.0, 0.4, 0.6], -4.0, 0.2, 3.2, 2);
  say('建 π 表：pattern 走過一次 → m', '');
  await step(tok);                                   // 18:41 total m + n: one of the faster algorithms
  good('O(m + n)', 0, 1.2, 3.2);
  G.mood('happy'); await G.hop(tok);
  say('總時間 O(m + n)', '暴力法是 O(mn)：KMP 快很多');
}]);

// ════════ qQ8vS2btsxI（Abdul Bari：Rabin-Karp） ════════
const rkV = (c) => c.charCodeAt(0) - 96;
function rkCodes(z) { const R = smRow('abcdefghij', z, { base: 1, cw: 0.8, d: 0.6, drop: 1.5 }); tag('code', 'ptr', R.at(0) - 1.0, 0.25, z); return R; }
const rkSum = (w) => [...w].reduce((a, c) => a + rkV(c), 0);
const rk10 = (w) => rkV(w[0]) * 100 + rkV(w[1]) * 10 + rkV(w[2]);
// a 3-letter window over row T with its hash label
function rkWin(T, z, w = 3) {
  const W = { box: ghostBox('#c08a1f', w * T.cw, 0.9, 1.2), h: tag('', 'ptr', 0, 1.3, z), s: -1 };
  W.box.visible = false;
  W.at = (s, h) => { W.s = s; W.box.visible = true; const xc = T.at(s + (w - 1) / 2); W.box.position.set(xc, 0.45, z); W.h.position.set(xc, 1.3, z); txt(W.h, 'h = ' + h); };
  return W;
}

// 00:00 基本想法：codes a=1…j=10，hash = 加總；aaaaab 找 aab（19 steps）
FRAG.push(['strm-rk-sum-aab', 'Rabin-Karp 基本想法：aaaaab 找 aab', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'aaaaab', p = 'aab';
  const G = pal(-6.3, 3.4, 0.55);
  let T, P, W, hp, codes;
  await step(tok);                                   // 0:00 Rabin-Karp: a string matching algorithm
  say('Rabin-Karp：字串比對（string matching）演算法', '');
  await step(tok);                                   // 0:08 a text and a pattern: is it present?
  T = smRow(t, -0.9, { base: 1, cw: 1.1, drop: 1.5 });
  tag('text', 'ptr', T.at(0) - 1.3, 0.3, -0.9);
  P = smRow(p, 2.0, { cw: 1.1, x0: -5.6, idx: false, drop: 2 });
  tag('pattern', 'ptr alt', -4.5, 0.3, 2.9);
  say('text 裡有沒有這個 pattern？', 'text = aaaaab、pattern = aab');
  await step(tok);                                   // 0:29 basic idea → worst case → improve → actual algorithm
  const road = ['基本想法', 'worst case', '怎麼改進', '真正的演算法'].map((s, k) => pkt((k + 1) + '. ' + s, -4.5 + k * 3.0, 1.4, -3.6));
  say('今天的路線', '基本想法 → 最壞情況 → 改進 → 真正的演算法');
  await step(tok);                                   // 0:43 aab is here inside the text
  road.forEach(remove);
  for (let k = 3; k < 6; k++) glow(T.cs[k], GOLD);
  say('看得出來 aab 在 text 裡', '問題是：電腦怎麼檢查？');
  await step(tok);                                   // 0:53 the naive way compares letters; we don't want that
  smOff(T.cs);
  const nb = bubble('不想一個一個字母比', 2.0, 1.6, 2.0);
  say('暴力法：一個一個字母比', 'Rabin-Karp 不想這樣做');
  await step(tok);                                   // 1:02 make the three letters one single value
  txt(nb, '3 個字母 → 變成 1 個數？');
  G.mood('wow');
  say('把 pattern 變成一個數值', '比一個數，比比 3 個字母快');
  await step(tok);                                   // 1:15 ASCII codes: a is 97
  note('ASCII：a = 97、b = 98 …', 3.5, 1.2, -3.4);
  say('字母本來就有 ASCII code', '小寫 a = 97');
  await step(tok);                                   // 1:38 my own codes: a = 1, b = 2 … j = 10
  remove(nb); G.mood('calm');
  codes = rkCodes(-3.4);
  say('數字太大，改用自己的 code', 'a = 1、b = 2 … j = 10');
  await step(tok);                                   // 2:05 aab → 1 + 1 + 2 = 4
  P.cs.forEach((c, k) => tag(String(rkV(p[k])), 'idx', -5.6 + k * 1.1, 0, 2.75));
  hp = tag('h = 4', 'ptr alt', -4.5, 1.1, 2.0);
  say('aab = 1 + 1 + 2 = 4', '把 code 加起來（要乘也可以）');
  await step(tok);                                   // 2:21 call it the hash code; the hash function
  note('4 = hash code；算它的方法 = hash function', 1.8, 0.3, 2.9);
  say('這個值叫 hash code', '算出它的 function 叫 hash function');
  await step(tok);                                   // 2:54 m = 3, n = 6
  note('m = 3', -4.5, 1.9, 2.0); note('n = 6', 4.4, 0.3, -0.9);
  say('pattern 長 m = 3、text 長 n = 6', '');
  await step(tok);                                   // 3:11 take three letters: 1 + 1 + 1 = 3
  W = rkWin(T, -0.9); W.at(0, 3);
  say('text 前 3 個：1 + 1 + 1 = 3', '一次取 m = 3 個字母');
  await step(tok);                                   // 3:26 3 ≠ 4: no need to check characters
  bad('3 ≠ 4', T.at(1), 2.0, -0.9);
  say('3 ≠ 4：不用比字元', '比兩個數只要常數時間');
  await step(tok);                                   // 3:38 slide to the next three: 3 again
  W.at(1, 3);
  say('滑到下一組 aaa = 3', '3 ≠ 4');
  await step(tok);                                   // 3:52 slide next: again 3
  W.at(2, 3);
  say('再滑：aaa = 3', '還是不相符');
  await step(tok);                                   // 4:07 sliding = rolling hash function
  pkt('滑動 = rolling hash', 3.6, 1.8, -0.9);
  say('從目前的值得到下一個值', '這叫 rolling hash function');
  await step(tok);                                   // 4:15 include b: 4 — they match
  W.at(3, 4); tint(W.box, '#2fc092');
  G.mood('wow');
  say('aab = 1 + 1 + 2 = 4', '和 pattern 的 4 相同！');
  await step(tok);                                   // 4:28 confirm: check the letters
  for (let k = 0; k < 3; k++) { glow(T.cs[3 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 450); }
  say('hash 相同 → 再逐字確認', 'a = a、a = a、b = b');
  await step(tok);                                   // 4:35 found at index 4 to 6
  good('找到：index 4 ～ 6', T.at(4), 2.0, -0.9);
  G.mood('happy'); await G.hop(tok);
  say('pattern 在 index 4 到 6', '這就是 Rabin-Karp 的基本想法');
}]);

// 05:00 rolling：abcdabce 找 bce，減掉離開的、加上進來的（12 steps）
FRAG.push(['strm-rk-sum-bce', 'Rolling hash：abcdabce 找 bce', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'abcdabce', p = 'bce';
  const G = pal(-6.3, 3.4, 0.55);
  let T, P, W, h = 6;
  // slide from window s − 1 to s: drop the old letter, add the new one
  const roll = async (s) => {
    const o = rkV(t[s - 1]), n = rkV(t[s + 2]), prev = h;
    smOff(T.cs); glow(T.cs[s - 1], RED); glow(T.cs[s + 2], GREEN);
    h = prev - o + n; W.at(s, h); await beat(tok, 500);
    say('去掉 ' + t[s - 1] + '、加上 ' + t[s + 2] + '：' + prev + ' − ' + o + ' + ' + n + ' = ' + h, h === 10 ? '10 = 10：可能是 pattern！' : h + ' ≠ 10');
  };
  await step(tok);                                   // 5:01 first the hash of the pattern
  rkCodes(-3.4);
  T = smRow(t, -0.9, { base: 1, cw: 1.0, drop: 1.5 });
  P = smRow(p, 2.1, { cw: 1.0, x0: -5.6, idx: false, drop: 2 });
  tag('pattern', 'ptr alt', -4.6, 0.3, 3.0);
  say('另一個例子：text abcdabce、pattern bce', '先算 pattern 的 hash');
  await step(tok);                                   // 5:11 b + c + e = 2 + 3 + 5 = 10
  tag('h = 10', 'ptr alt', -4.6, 1.1, 2.1);
  note('這裡只是基本想法，還不是真正的演算法', 2.4, 0.3, 3.0);
  say('bce = 2 + 3 + 5 = 10', '');
  await step(tok);                                   // 5:26 first three letters: 1 + 2 + 3 = 6
  W = rkWin(T, -0.9); W.at(0, 6);
  say('前 3 個 abc = 1 + 2 + 3 = 6', '6 ≠ 10');
  await step(tok);                                   // 5:39 slide: from 6 subtract a's 1 → 5
  glow(T.cs[0], RED);
  W.at(1, 5);
  say('往右滑：先減掉離開的 a', '6 − 1 = 5');
  await step(tok);                                   // 5:58 add d's 4 → 9
  glow(T.cs[3], GREEN); h = 9; W.at(1, 9);
  say('再加上進來的 d', '5 + 4 = 9');
  await step(tok);                                   // 6:05 subtract the leaving code, add the new one: constant time
  pkt('一減一加：O(1)', 3.6, 1.8, -0.9);
  G.mood('happy');
  say('減掉離開的、加上進來的', '常數時間就得到下一組的值');
  await step(tok);                                   // 6:26 9 ≠ 10; take out b, add a → 8
  G.mood('calm');
  await roll(2);
  await step(tok);                                   // 6:33 take out c, add b → 7
  await roll(3);
  await step(tok);                                   // 6:43 take out d, include c → 6
  await roll(4);
  await step(tok);                                   // 6:52 subtract 1, add 5 → 10: matching
  await roll(5); tint(W.box, '#2fc092');
  G.mood('wow');
  await step(tok);                                   // 7:08 verify: b b, c c, e e
  for (let k = 0; k < 3; k++) { glow(T.cs[5 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 450); }
  say('逐字確認：b、c、e 都相同', 'hash 相同只是「可能」，一定要確認');
  await step(tok);                                   // 7:13 the pattern is there
  good('找到：index 6 ～ 8', T.at(6), 2.0, -0.9);
  G.mood('happy'); await G.hop(tok);
  say('找到 pattern！', '每次滑動只要一減一加');
}]);

// 07:25 最壞情況：ccaccaaedba 找 dba，加總 hash → spurious hits（16 steps）
FRAG.push(['strm-rk-spurious', 'Spurious hit：ccaccaaedba 找 dba', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'ccaccaaedba', p = 'dba';
  const G = pal(-6.3, 3.4, 0.55);
  let T, P, W, cnt, sp = 0;
  // window s: show its sum; if it equals 7, compare letters until the first difference
  const win = async (s) => {
    const w = t.slice(s, s + 3), h = rkSum(w);
    smOff(T.cs, P.cs); W.at(s, h);
    if (h !== 7) { tint(W.box, '#c08a1f'); say(w + ' = ' + h, h + ' ≠ 7：跳過'); return; }
    tint(W.box, '#c84a4a');
    await beat(tok, 500);
    for (let k = 0; k < 3; k++) { const e = w[k] === p[k]; glow(T.cs[s + k], e ? GREEN : RED); glow(P.cs[k], e ? GREEN : RED); await beat(tok, 350); if (!e) break; }
    sp++; txt(cnt, 'spurious hit：' + sp);
    say(w + ' = ' + h + '：hash 相同，字串卻不同', '第 ' + sp + ' 次白比');
  };
  await step(tok);                                   // 7:25 the previous examples scanned the string once
  say('前兩個例子：text 只掃過一次', 'pattern 也只確認了一次');
  await step(tok);                                   // 7:37 time n − m + 1: the average time
  note('平均時間：Θ(n − m + 1)', 0, 1.2, -3.4);
  say('平均時間 Θ(n − m + 1)', '有 n − m + 1 個位置，每個 O(1)');
  await step(tok);                                   // 7:53 a worst-case example: n = 11, m = 3
  T = smRow(t, -1.4, { base: 1, cw: 1.05, drop: 1.5 });
  P = smRow(p, 2.0, { cw: 1.05, x0: -5.8, idx: false, drop: 2 });
  tag('pattern', 'ptr alt', -4.8, 0.3, 2.9);
  cnt = tag('spurious hit：0', 'ptr', 4.6, 0.3, 2.0);
  say('最壞情況的例子：n = 11、m = 3', 'text = ccaccaaedba、pattern = dba');
  await step(tok);                                   // 7:59 hash of dba = 4 + 2 + 1 = 7
  tag('h = 7', 'ptr alt', -4.8, 1.1, 2.0);
  say('dba = 4 + 2 + 1 = 7', '同樣用加總當 hash');
  await step(tok);                                   // 8:18 cca = 3 + 3 + 1 = 7: matching!
  W = rkWin(T, -1.4); W.at(0, 7); tint(W.box, '#c84a4a');
  G.mood('wow');
  say('cca = 3 + 3 + 1 = 7', '和 7 相同 → 要逐字比');
  await step(tok);                                   // 8:28 compare: d? no — the string doesn't match
  glow(T.cs[0], RED); glow(P.cs[0], RED);
  sp = 1; txt(cnt, 'spurious hit：1');
  G.mood('sad');
  say('c ≠ d：不是 pattern', 'hash 相同，字串卻不同');
  await step(tok);                                   // 8:37 next three: cac = 7, a match again
  G.mood('calm'); smOff(T.cs, P.cs);
  W.at(1, 7);
  say('下一組 cac = 3 + 1 + 3 = 7', '又相同');
  await step(tok);                                   // 8:56 compare c and d: not a pattern
  glow(T.cs[1], RED); glow(P.cs[0], RED);
  sp = 2; txt(cnt, 'spurious hit：2');
  say('c ≠ d：又不是', '白比一次');
  await step(tok);                                   // 9:02 acc = 7 again, not a pattern
  await win(2);
  await step(tok);                                   // 9:11 three matchings so far, none a pattern
  G.mood('sad');
  bubble('hash 一直撞，卻都不是！', -4.0, 1.6, -3.4);
  say('已經 3 次 hash 相同，卻都不是 pattern', '每次都要逐字比');
  await step(tok);                                   // 9:31 continue: (cca) … caa = 5, not matching
  await win(3); await beat(tok, 700); await win(4);
  await step(tok);                                   // 9:44 aae = 7 matching again, but no pattern
  await win(5);
  await step(tok);                                   // 9:56 every time the hash matches: the drawback
  note('hash 太簡單 → 很多不同子字串撞在一起（collision）', 1.6, 1.2, 3.5);
  say('缺點：hash function 太簡單', '不同子字串很容易得到同一個值');
  await step(tok);                                   // 10:20 these are called spurious hits
  bad('spurious hit：hash 相同、但不是 pattern', 0, 1.9, -0.2);
  say('這種假命中叫 spurious hit', 'hash 對上了，字串卻不是');
  await step(tok);                                   // 10:38 the maximum time: Θ(mn)
  note('最壞：Θ(mn)', 4.6, 1.2, 1.2);
  say('spurious hit 很多時：最壞 Θ(mn)', '每個位置都要比 m 個字母');
  await step(tok);                                   // 10:55 we expect n − m + 1 if there are no spurious hits
  G.mood('calm');
  say('沒有 spurious hit 才是 n − m + 1', '下一步：換一個更好的 hash');
}]);

// 11:02 Rabin-Karp 的 hash：dba = 4·10² + 2·10 + 1 = 421（14 steps）
FRAG.push(['strm-rk-base10', 'Rabin-Karp hash：dba = 421', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const xs = [-3.2, -1.2, 0.8], w = 'dba', pw = [];
  const G = pal(-6.3, 3.4, 0.55);
  let terms = [];
  await step(tok);                                   // 11:02 how to avoid spurious hits?
  bubble('spurious hit 怎麼避免？', -4.0, 1.6, -3.4);
  say('怎麼避免 spurious hit？', '問題出在 hash function 太簡單');
  await step(tok);                                   // 11:13 we need a strong hash function: Rabin-Karp's idea
  pkt('Rabin-Karp 的 hash function', 3.0, 1.6, -3.4);
  say('要換一個「強」的 hash function', 'Rabin 和 Karp 提出的');
  await step(tok);                                   // 11:35 codes: d = 4, b = 2, a = 1
  for (let k = 0; k < 3; k++) { cube(w[k], smC(w[k]), [1.0, 0.5, 0.85], xs[k], 0.25, -2.4, 2); tag('code ' + rkV(w[k]), 'idx', xs[k], 0, -1.6); }
  say('同一個例子：dba', 'code：d = 4、b = 2、a = 1');
  await step(tok);                                   // 11:41 4 × 10² + 2 × 10¹ + 1 × 10⁰
  for (let k = 0; k < 3; k++) {
    const e = 2 - k, term = rkV(w[k]) * 10 ** e;
    pw.push(tag('× 10' + smSup(e), 'ptr', xs[k], 0.3, -0.9));
    terms.push(cube(term, '#e8dcc4', [1.3, 0.5, 0.85], xs[k], 0.25, 0.6, 2.5));
    await beat(tok, 450);
  }
  say('4 × 10² + 2 × 10¹ + 1 × 10⁰', '每個 code 乘上 10 的次方');
  await step(tok);                                   // 11:56 why powers 2, 1, 0? three letters
  pw.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('為什麼是 2、1、0 次方？', 'pattern 有 3 個字母：最高 3 − 1 = 2');
  await step(tok);                                   // 12:12 m letters: p₁·10^(m−1) + p₂·10^(m−2) + …
  note('p₁·10^(m−1) + p₂·10^(m−2) + … + p_m·10⁰', 0, 1.2, 2.6);
  say('m 個字母的公式', '第 k 個字母乘 10^(m−k)');
  await step(tok);                                   // 12:44 10 is the base: I use 10 letters
  pkt('base = 10：只用了 a～j 10 個字母', 4.6, 1.6, -1.4);
  say('10 是 base（基底）', '因為只用了 10 個字母');
  await step(tok);                                   // 12:59 you can define your own hash function
  say('懂 hashing，也可以自己設計 hash function', '字串的話，他們建議用這種寫法');
  await step(tok);                                   // 13:10 26 letters → 26; all ASCII → 127
  note('base 26（英文字母）；全部 ASCII：127（嚴格說 128）', 1.2, 0.3, -4.6);
  say('字母多，base 就跟著變大', '26 個字母用 26，全部字元用 127');
  await step(tok);                                   // 13:41 400 + 20 + 1 = 421
  arrow(V3(1.8, 0.3, 0.6), V3(3.4, 0.3, 0.6));
  cube(421, '#c08a1f', [1.6, 0.6, 1.0], 4.6, 0.3, 0.6, 3);
  say('hash(dba) = 400 + 20 + 1 = 421', '');
  await step(tok);                                   // 13:53 now use it on the same worst-case example
  note('回到剛才的最壞例子：ccaccaaedba', 0, 0.3, 3.6);
  say('用新的 hash 再跑一次剛才的例子', '剛才那裡全是 spurious hit');
  await step(tok);                                   // 14:14 cca = 3 × 10² + 3 × 10 + 1 × 10⁰
  const C = smRow('cca', 2.9, { cw: 1.0, x0: -3.2, idx: false, drop: 2 });
  say('cca = 3 × 10² + 3 × 10 + 1 × 10⁰', '');
  await step(tok);                                   // 14:28 300 + 30 + 1 = 331 ≠ 421
  cube(331, '#cbbd9f', [1.6, 0.6, 1.0], 4.6, 0.3, 2.9, 3);
  C.cs.forEach((c) => glow(c, RED));
  say('cca = 300 + 30 + 1 = 331', '331 ≠ 421');
  await step(tok);                                   // 14:43 not a spurious hit any more
  good('換了 hash：不再是 spurious hit', 2.2, 1.4, 3.6);
  G.mood('happy'); await G.hop(tok);
  say('以前 cca 會撞，現在不會了', 'hash function 變強了');
}]);

// 14:56 rolling：(h − 首字·10²)·10 + 新字；331 → 313 → 133 → 331 → 311 … → 421（20 steps）
FRAG.push(['strm-rk-rolling', 'Rolling hash：331 → 313 → 133 …', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'ccaccaaedba';
  const G = pal(-6.3, 3.4, 0.55);
  let T, P, W, H, h = 331, rule = null;
  const show = (v, s) => { relabel(H, v); if (s !== undefined) W.at(s, v); };
  const sub = (s) => { const o = rkV(t[s - 1]); smOff(T.cs); glow(T.cs[s - 1], RED); W.at(s, '?'); h = h - o * 100; relabel(H, h); return o; };
  const mul = () => { h *= 10; relabel(H, h); };
  const add = (s) => { const n = rkV(t[s + 2]); glow(T.cs[s + 2], GREEN); h += n; show(h, s); return n; };
  const mark = (s) => tag(String(h), h === 421 ? 'good' : 'idx', T.at(s + 1), 0.2, s % 2 ? -0.4 : -0.9);
  await step(tok);                                   // 14:56 rolling: so many powers — how to get the next one?
  T = smRow(t, -2.4, { base: 1, cw: 1.05 });
  P = smRow('dba', 2.8, { cw: 1.0, x0: -5.8, idx: false });
  tag('h = 421', 'ptr alt', -4.8, 1.1, 2.8);
  W = { box: ghostBox('#c08a1f', 3.15, 0.9, 1.2), lbl: tag('', 'ptr', 0, 1.3, -2.4), at(s, v) { const xc = T.at(s + 1); this.box.position.set(xc, 0.45, -2.4); this.lbl.position.set(xc, 1.3, -2.4); txt(this.lbl, 'h = ' + v); } };
  W.at(0, 331);
  H = cube(331, '#cbbd9f', [1.8, 0.6, 1.0], 1.5, 0.3, 1.2, 2.5);
  tag('目前 hash', 'idx', 1.5, 0, 2.0);
  say('cca = 331；下一組怎麼算？', '不想把次方全部重算');
  await step(tok);                                   // 15:09 the next three should be 3·10² + 1·10 + 3
  const nx = note('下一組 cac = 3·10² + 1·10¹ + 3·10⁰', 4.0, 1.4, 1.2);
  say('下一組 cac 應該是 3·10² + 1·10 + 3', 'c、a 的次方都要升一級');
  await step(tok);                                   // 15:17 so these two get multiplied by 10
  say('留下的 c、a 都要乘 10', '從 10¹、10⁰ 升成 10²、10¹');
  await step(tok);                                   // 15:41 331 = 3·10² + 3·10 + 1: subtract 3·10²
  relabel(H, '331 − 300'); glow(T.cs[0], RED);
  say('先減掉最前面那項 3·10²', '離開的 c 不要了');
  await step(tok);                                   // 16:07 multiply the rest by 10
  relabel(H, '(331 − 300)·10');
  say('剩下的整個乘 10', '每個字母升一級次方');
  await step(tok);                                   // 16:14 then add c: 3·10⁰
  relabel(H, '(331 − 300)·10 + 3'); glow(T.cs[3], GREEN);
  say('再加上新的 c：3·10⁰', '');
  await step(tok);                                   // 16:22 subtract the first term, multiply by 10, add the next
  remove(nx);
  rule = pkt('減掉首項 → ×10 → 加新項', 4.0, 1.6, 1.2);
  G.mood('wow');
  say('規則：減掉第一項、乘 base、加上新的一項', '');
  await step(tok);                                   // 17:05 331 − 300 = 31
  G.mood('calm'); smOff(T.cs);
  sub(1);
  say('331 − 3·10² = 31', '');
  await step(tok);                                   // 17:25 31 × 10 = 310
  mul();
  say('31 × 10 = 310', '');
  await step(tok);                                   // 17:35 + 3 → 313
  add(1); mark(1);
  say('310 + 3 = 313', 'cac = 313');
  await step(tok);                                   // 17:52 rolling: subtract, multiply, add
  say('一個值算出來，後面都靠減、乘、加', '這就是 rolling hash function');
  await step(tok);                                   // 17:59 313 ≠ 421: no spurious hit
  bad('313 ≠ 421', 4.0, 0.3, 2.3);
  say('313 ≠ 421', '也沒有 spurious hit');
  await step(tok);                                   // 18:21 subtract 300 → 13
  sub(2);
  say('下一組：313 − 300 = 13', '');
  await step(tok);                                   // 18:28 × 10 → 130
  mul();
  say('13 × 10 = 130', '');
  await step(tok);                                   // 18:47 + 3 → 133 ≠ 421
  add(2); mark(2);
  say('130 + 3 = 133', 'acc = 133 ≠ 421');
  await step(tok);                                   // 19:16 subtract 1·10² → 33
  sub(3);
  say('下一組：133 − 1·10² = 33', '');
  await step(tok);                                   // 19:29 × 10 → 330
  mul();
  say('33 × 10 = 330', '');
  await step(tok);                                   // 19:37 + 1 → 331 ≠ 421
  add(3); mark(3);
  say('330 + 1 = 331', 'cca = 331 ≠ 421');
  await step(tok);                                   // 19:50 331 − 300 = 31, ×10, +1 → 311
  sub(4); await beat(tok, 500); mul(); await beat(tok, 500); add(4); mark(4);
  say('(331 − 300)·10 + 1 = 311', 'caa = 311 ≠ 421');
  await step(tok);                                   // 20:21 continue: dba gives 421 — then compare
  for (let s = 5; s <= 8; s++) { sub(s); mul(); add(s); mark(s); await beat(tok, 350); }
  for (let k = 0; k < 3; k++) { glow(T.cs[8 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 300); }
  G.mood('happy'); await G.hop(tok);
  say('一路滑到 dba = 421：hash 相同', '再逐字確認 → 找到');
}]);

// 20:38 總結＋溢位：mod 讓值留在範圍內，但 spurious hit 又會回來（mod 11 只是示範）（12 steps）
FRAG.push(['strm-rk-mod', 'Rabin fingerprint 與 mod', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const ws = ['cca', 'cac', 'acc', 'cca', 'caa', 'aae', 'aed', 'edb', 'dba'];
  const hv = ws.map(rk10);
  const G = pal(-6.3, 3.4, 0.55);
  let cs = [];
  await step(tok);                                   // 20:38 basic idea → drawback → better function
  ['基本想法', '缺點：hash 太簡單', 'Rabin-Karp 的 hash'].forEach((s, k) => pkt(s, -4.2 + k * 4.2, 1.4, -3.6));
  say('回顧：基本想法 → 缺點 → 更好的 hash', '');
  await step(tok);                                   // 20:58 base powers + rolling = Rabin fingerprint
  good('Rabin fingerprint', 0, 1.6, -2.4);
  say('base 次方 + rolling：Rabin fingerprint', '');
  await step(tok);                                   // 21:05 average Θ(n − m + 1)
  note('平均：Θ(n − m + 1)', -3.0, 1.2, -1.2);
  say('平均時間 Θ(n − m + 1)', '');
  await step(tok);                                   // 21:14 still possible spurious hits: worst mn
  note('最壞：還是 O(mn)', 3.0, 1.2, -1.2);
  say('還是可能撞：最壞仍是 O(mn)', '只是機率變小');
  await step(tok);                                   // 21:36 powers give very large values
  ['m = 3：10² = 100', 'm = 10：10⁹', 'm = 20：10¹⁹ !!'].forEach((s, k) => tag(s, k === 2 ? 'bad' : 'idx', -4.0 + k * 4.0, 0.3, 0.4));
  G.mood('wow');
  say('次方會讓值變得非常大', 'pattern 越長，10^(m−1) 越大');
  await step(tok);                                   // 21:55 four-byte int: the number will overflow
  bubble('int 只有 4 bytes：overflow！', 2.4, 1.6, 1.4);
  say('超過資料型態的容量就 overflow', '例：4 bytes 的 int');
  await step(tok);                                   // 21:59 avoid overflow: take mod
  G.mood('calm');
  pkt('取 mod：值留在範圍內', -3.4, 1.6, 1.4);
  say('解法：對值取 mod', '');
  await step(tok);                                   // 22:18 32-bit: mod 2³¹ (only positive: 2³²)
  note('32-bit：mod 2³¹（只用正數：2³²）', 0, 0.3, 2.4);
  say('32-bit 有號：mod 2³¹', '只用正數：mod 2³²');
  await step(tok);                                   // 22:52 rolling with mod too (small mod 11 as a demo)
  cs = ws.map((w, k) => { tag(w, 'idx', -6 + k * 1.5, 0, 3.0); return cube(hv[k] + '→' + (hv[k] % 11), k === 8 ? '#c08a1f' : '#cbbd9f', [1.3, 0.5, 0.8], -6 + k * 1.5, 0.25, 3.7, 2); });
  note('示範用小模數：mod 11', 4.8, 1.0, 3.7);
  say('rolling 時也可以取 mod', '示範：每個 hash mod 11');
  await step(tok);                                   // 23:04 with mod, spurious hits come back
  const target = hv[8] % 11;
  cs.forEach((c, k) => { if (hv[k] % 11 === target) glow(c, k === 8 ? GREEN : RED); });
  G.mood('sad');
  say('caa、edb 也變成 3：spurious hit 回來了', '又可能走向 O(mn)');
  await step(tok);                                   // 23:11 know your data, design your own hash function
  G.mood('calm');
  say('了解資料，就能自己設計 hash function', '');
  await step(tok);                                   // 23:36 core idea: compare codes, check only on a match
  good('核心：先比 hash code，相同才逐字比', 0, 1.9, 0.4);
  G.mood('happy'); await G.hop(tok);
  say('Rabin-Karp 的核心', '用 hash code 避免逐字比；相同才檢查');
}]);

// ════════ -DwGrJ8JxDc（MIT 6.006 Rec 9b） ════════
// 01:04 p = 2^w 可以嗎？extended Euclid：b 與 p 互質 → 乘法反元素存在（p = 8、b = 3 為示範）（11 steps）
FRAG.push(['strm-mit-inverse', 'mod 2^w 的乘法反元素', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0]);
  const at = (k) => [Math.sin(k * Math.PI / 4) * 3, -Math.cos(k * Math.PI / 4) * 3];
  const G = pal(-6.0, 3.0, 0.6);
  let ring = [], mk, lab;
  await step(tok);                                   // 1:04 rolling hashes look like K mod p
  say('rolling hash：h = K mod p', 'K 是一個很大的數');
  lab = tag('h = K mod p', 'ptr', 0, 0.3, 0);
  await step(tok);                                   // 1:16 nice if p is a prime
  note('上次說：p 取質數最好', 4.6, 0.3, -3.2);
  say('上次的結論：p 最好是質數', '');
  await step(tok);                                   // 1:21 what if p = 2^w, base co-prime with p?
  for (let k = 0; k < 8; k++) { const [x, z] = at(k); ring.push(cube(k, '#e8dcc4', [0.8, 0.4, 0.8], x, 0.2, z, 2)); }
  txt(lab, 'mod 8 = 2³');
  G.mood('wow');
  say('那 p = 2^w（不是質數）可以嗎？', '條件：base b 和 p 互質（示範 p = 8、b = 3）');
  await step(tok);                                   // 1:42 the answer is yes, it works
  good('可以！', -4.6, 1.4, -2.0);
  G.mood('happy');
  say('答案：可以', '要用到乘法反元素');
  await step(tok);                                   // 1:45 multiplicative inverse via extended Euclid
  G.mood('calm');
  mk = cube('3·1', '#c08a1f', [0.6, 0.45, 0.6], 0, 1.0, -3);
  for (let x = 1; x <= 3; x++) { const k = (3 * x) % 8, [px, pz] = at(k); move(mk, px, 1.0, pz); relabel(mk, '3·' + x); await beat(tok, 600); }
  say('乘法反元素：找 x 讓 3·x ≡ 1 (mod 8)', '3·1 = 3、3·2 = 6、3·3 = 9 ≡ 1');
  await step(tok);                                   // 2:03 b and p: their GCD
  note('gcd(3, 8) = 1', 4.6, 0.3, 0.4);
  say('先看 b 和 p 的 GCD（最大公因數）', 'gcd(3, 8) = 1：互質');
  await step(tok);                                   // 2:25 extended Euclid: xb + yp = gcd(b, p)
  note('extended Euclid：x·b + y·p = gcd(b, p)', 0, 0.3, 3.4);
  say('extended Euclid 算出 x、y', 'x·b + y·p = gcd(b, p)');
  await step(tok);                                   // 2:40 gcd is 1: xb + yp = 1
  note('3·3 + (−1)·8 = 1', 4.6, 0.3, 1.4);
  say('gcd = 1 時：x·b + y·p = 1', '例：3·3 + (−1)·8 = 1');
  await step(tok);                                   // 2:48 modulo p: xb ≡ 1 — the inverse
  glow(ring[1], GREEN);
  good('x = 3 就是 3 的反元素', 0, 1.6, 0);
  say('mod p 來看：x·b ≡ 1', 'x 就是 b 的乘法反元素');
  await step(tok);                                   // 2:59 nice math, but why aren't we using it?
  G.mood('wow');
  bubble('數學 OK，那為什麼不用 2^w？', -3.6, 1.6, 3.2);
  say('數學上沒問題', '那為什麼實務上不用 2^w？');
  await step(tok);                                   // 3:09 something else is wrong: a good hash function?
  pkt('問題是：它是好的 hash function 嗎？', 3.0, 1.6, -3.8);
  say('2^w 有別的毛病', '它給得出好的 hash function 嗎？');
}]);

// 03:24 好的 hash function：inputs ≫ outputs；h = 0 很糟；要「distribute」（14 steps）
FRAG.push(['strm-mit-goodhash', '好的 hash function：要分散', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const xs = (k) => -3.5 + k * 1.0;
  const HC = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
  const G = pal(-6.3, 3.2, 0.55);
  let bad0 = [], spread = [];
  await step(tok);                                   // 3:24 h = K mod 2^w
  tag('h = K mod 2^w', 'ptr', 0, 0.3, -4.0);
  say('令 h = K mod 2^w', '');
  await step(tok);                                   // 3:34 K is digits in base b
  ['d₁', 'd₂', 'd₃', '…', 'd_L'].forEach((d, i) => cube(d, '#9b7ef4', [1.0, 0.5, 0.8], -2.8 + i * 1.4, 0.25, -3.0, 2));
  say('K 是 base b 的 digits 組成的大數字', 'K = d₁ d₂ … d_L');
  await step(tok);                                   // 3:56 b = 2⁸ (ASCII, colors)
  note('b = 2⁸：一個 byte（ASCII、顏色）', 4.2, 0.3, -2.2);
  say('base b = 2⁸', 'ASCII 字元、顏色剛好一個 byte');
  await step(tok);                                   // 4:24 lots of inputs → a small set of outputs
  for (let k = 0; k < 8; k++) { cube('', GRAY, [0.85, 0.1, 0.9], xs(k), 0.05, 1.6); tag(String(k), 'idx', xs(k), 0, 2.4); }
  tag('outputs（示意 8 格）', 'ptr alt', 0, 0.3, 3.2);
  say('hash：很多 inputs → 比較少的 outputs', '');
  await step(tok);                                   // 4:41 collisions no matter what
  note('inputs ≫ outputs → 一定有 collision', 4.6, 0.3, 0.4);
  say('不管怎麼設計，collision 一定會發生', 'inputs 遠多於 outputs');
  await step(tok);                                   // 4:47 a million characters: 2^(8·10⁶) strings vs 2³²
  note('一百萬字元 → 2^(8·10⁶) 種字串', -4.0, 0.3, 0.4);
  note('outputs：2³² 種', 0, 0.3, 3.9);
  say('一百萬字元的字串有 2^(8·10⁶) 種', 'word size 的 output 只有 2³² 種');
  await step(tok);                                   // 5:05 no way to avoid collisions
  for (const k of [3, 3]) { bad0.push(cube('', HC[bad0.length], [0.6, 0.3, 0.6], xs(k), 0.3 + bad0.length * 0.32, 1.6, 3)); await beat(tok, 400); }
  say('不可能完全沒有 collision', '兩個 input 掉進同一格');
  await step(tok);                                   // 5:11 what makes a good hash function?
  bad0.forEach((c) => fly(c)); bad0 = [];
  bubble('怎樣才是好的 hash function？', -3.6, 1.6, -1.0);
  say('那什麼是好的 hash function？', '');
  await step(tok);                                   // 5:21 hash = 0 for all K: good?
  for (let k = 0; k < 8; k++) { bad0.push(cube('', HC[k], [0.6, 0.3, 0.6], xs(0), 0.3 + k * 0.32, 1.6, 3)); await beat(tok, 150); }
  say('如果所有 K 都 hash 到 0 呢？', '全部擠在同一格');
  await step(tok);                                   // 5:36 searching takes a long time — horrible
  G.mood('sad');
  say('搜尋要很久，substring matching 也是', '很糟的 hash function');
  await step(tok);                                   // 5:53 something that looks random, but consistent
  bad0.forEach((c) => fly(c));
  const order = [5, 2, 7, 0, 3, 6, 1, 4];
  for (let k = 0; k < 8; k++) { spread.push(cube('', HC[k], [0.6, 0.3, 0.6], xs(order[k]), 0.3, 1.6, 3)); await beat(tok, 200); }
  G.mood('happy');
  say('理想：看起來隨機', '而且同一個 input 永遠給同一個 output');
  await step(tok);                                   // 6:10 distribute is the keyword
  good('關鍵字：distribute（分散）', 0, 1.6, 1.6);
  say('關鍵字：distribute', 'output 要均勻分散');
  await step(tok);                                   // 6:43 L much bigger than w is fine
  G.mood('calm');
  note('L ≫ w 沒關係：這正是 substring matching 快的原因', 0, 0.3, -1.0);
  say('K 很長（L 很大）本身不是問題', '只要結果分散得均勻就好');
  await step(tok);                                   // 7:08 some simple real-life values make it behave badly
  G.mood('wow');
  bubble('有些很普通的 input 會讓它很糟', -3.6, 1.6, 3.4);
  say('問題：有些簡單的 input 會讓它表現很差', '而且真實世界真的會遇到');
}]);

// 07:26 digit 全偶數：base 256 → base 10 類比 → K mod 2³² 全偶數（12 steps）
FRAG.push(['strm-mit-evendigits', 'digit 全偶數 → hash 全偶數', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  const xs = (k) => -6 + k * 0.8;
  let d256 = [], d10 = [], slots = [];
  await step(tok);                                   // 7:26 what if all the digits are even?
  d256 = ['12', '200', '6', '34'].map((d, i) => cube(d, '#9b7ef4', [1.0, 0.5, 0.8], 0.6 + i * 1.3, 0.25, -3.0, 2));
  tag('K 的 digits（示範）', 'ptr', 2.55, 0.3, -2.1);
  say('如果每個 digit 都是偶數呢？', 'd ≡ 0 (mod 2)');
  await step(tok);                                   // 7:50 the modulo is 2^w, say 2³²
  note('mod 2³²', 6.0, 0.3, -3.0);
  say('模數還是 2^w，例如 2³²', '');
  await step(tok);                                   // 7:55 base 2⁸: digits 0 to 255
  note('base 2⁸：digit 是 0～255', 2.55, 0.3, -4.0);
  say('base 2⁸：每個 digit 在 0～255', '');
  await step(tok);                                   // 8:14 substring matching: all characters even
  d256.forEach((c) => glow(c, GOLD));
  say('例如 substring 裡的字元碼全是偶數', '');
  await step(tok);                                   // 8:44 like base 10: 10 is divisible by 2
  d256.forEach((c) => glow(c, null));
  d10 = ['3', '7', '4'].map((d, i) => cube(d, '#e8dcc4', [0.8, 0.5, 0.8], -5.6 + i * 0.95, 0.25, -3.0, 2));
  tag('base 10', 'ptr', -4.65, 0.3, -2.1);
  say('類比 base 10：10 可以被 2 整除', '例：374');
  await step(tok);                                   // 8:50 last digit even → the whole number even
  glow(d10[2], GREEN);
  say('末位是偶數 → 整個數是偶數', '374 = 37 × 10 + 4');
  await step(tok);                                   // 9:03 base 256 also divisible by 2
  glow(d256[3], GREEN);
  say('base 256 也能被 2 整除', '末位 34 偶數 → K 是偶數');
  await step(tok);                                   // 9:13 K mod 2³² is also divisible by 2
  good('K mod 2³² 也是偶數', 2.55, 1.3, -3.0);
  say('K mod 2³² 也一定是偶數', '因為 2³² 也是偶數');
  await step(tok);                                   // 9:35 this is supposed to be my universe of outputs
  for (let k = 0; k < 16; k++) { slots.push(cube('', k % 2 ? '#ead2c8' : GRAY, [0.7, 0.1, 0.9], xs(k), 0.05, 1.4)); tag(String(k), 'idx', xs(k), 0, 2.2); }
  tag('所有 outputs（示意 16 格）', 'ptr alt', 0, 0.3, 3.0);
  say('outputs 本來應該用到整個範圍', '');
  await step(tok);                                   // 9:46 the hash always puts outputs in this half
  const cnt = Array(16).fill(0);
  for (const v of [2, 10, 6, 14, 0, 8, 4, 12]) { cube('', '#4b9ee2', [0.55, 0.28, 0.6], xs(v), 0.25 + cnt[v] * 0.3, 1.4, 3); cnt[v]++; await beat(tok, 200); }
  say('hash 只會落在一半', '分布不均勻');
  await step(tok);                                   // 10:01 these are even, these are odd
  slots.forEach((s, k) => glow(s, k % 2 ? null : GREEN));
  note('偶數格', -2.4, 0.3, 0.4); note('奇數格', 2.4, 0.3, 0.4);
  say('落進去的全是偶數格', '奇數格一個都沒有');
  await step(tok);                                   // 10:10 this area gets no love
  slots.forEach((s, k) => { if (k % 2) glow(s, RED); });
  G.mood('sad');
  say('奇數那一半：absolutely no love', '沒有任何值會 hash 到那裡');
}]);

// 10:16 全奇數也一樣；DNA 編碼 0, 2, 4, 6 → mod 16 只用到偶數桶（cued copy of the built-in mod-2w-even-hash）（7 steps）
FRAG.push(['strm-mit-even16', '全奇數也一樣；DNA 0, 2, 4, 6 → 一半的桶浪費', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  const xs = (k) => -6 + k * 0.8, D = { A: 0, C: 2, G: 4, T: 6 };
  let dna, slots = [];
  await step(tok);                                   // 10:16 what about all odd digits?
  const odd = ['13', '201', '7', '35'].map((d, i) => cube(d, '#dd8238', [1.0, 0.5, 0.8], -2.0 + i * 1.3, 0.25, -3.4, 2));
  tag('全奇數 digits（示範）', 'ptr', -0.05, 0.3, -2.5);
  say('同學問：digit 全是奇數呢？', '');
  await step(tok);                                   // 10:31 last digit odd → result odd
  glow(odd[3], GREEN);
  note('末位奇數 → K 奇數 → hash 奇數', 4.6, 0.3, -2.5);
  say('末位奇數 → 結果一定是奇數', '');
  await step(tok);                                   // 10:44 always odd: not an even distribution
  for (let k = 0; k < 16; k++) { slots.push(cube('', k % 2 ? '#ead2c8' : GRAY, [0.7, 0.1, 0.9], xs(k), 0.05, 2.6)); tag(String(k), 'idx', xs(k), 0, 3.4); }
  for (const v of [5, 13, 1, 9]) { cube('', '#dd8238', [0.55, 0.28, 0.6], xs(v), 0.25, 2.6, 3); await beat(tok, 200); }
  say('hash 永遠是奇數：一樣不均勻', '只是換成另一半');
  await step(tok);                                   // 11:02 nucleotides A, C, G, T
  dna = smRow('GATTACAG', -1.0, { cw: 0.9, idx: false, drop: 2 });
  tag('DNA', 'ptr', dna.at(0) - 1.2, 0.3, -1.0);
  say('實例：DNA 的 nucleotides', 'A、C、G、T');
  await step(tok);                                   // 11:15 encoded as 0, 2, 4, 6 — all even
  [...'GATTACAG'].forEach((c, k) => tag(String(D[c]), 'idx', dna.at(k), 0, -0.25));
  say('若編成 A, C, G, T = 0, 2, 4, 6', '全是偶數');
  await step(tok);                                   // 11:24 the hash is always even: wasting the last bit
  note('二進位最後一個 bit 永遠是 0', 4.6, 0.3, -0.2);
  say('hash 永遠是偶數', '最後一個 bit 白白浪費');
  await step(tok);                                   // 11:29 a hash table: half the entries wasted
  const s = 'GATTACAGACTGATCAG', cnt = Array(16).fill(0);
  for (let k = 0; k + 3 <= s.length; k++) {
    const h = (D[s[k]] * 64 + D[s[k + 1]] * 8 + D[s[k + 2]]) % 16;
    if (cnt[h] < 5) cube('', '#4b9ee2', [0.55, 0.22, 0.6], xs(h), 0.22 + cnt[h] * 0.24, 2.6, 2.5);
    cnt[h]++; await beat(tok, 120);
  }
  slots.forEach((c, k) => { if (k % 2) glow(c, RED); });
  G.mood('sad');
  say('做成 hash table：一半的格子永遠空著', '只是在浪費記憶體（mod 16、base 8 示範）');
}]);

// 11:44 真實資料不隨機：低位元相同；mod 2^w = 截掉高位，快但差（數字為示範）（9 steps）
FRAG.push(['strm-mit-lowbits', 'mod 2^w 只看低位元', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.3]);
  const vals = [180, 100, 220], rows = [];
  const xs = (k) => 1.0 + k * 0.75;
  const G = pal(-6.3, 3.4, 0.55);
  let rnd = [];
  await step(tok);                                   // 11:44 random inputs: most hash functions do fine
  for (let k = 0; k < 8; k++) { cube('', GRAY, [0.65, 0.1, 0.8], xs(k), 0.05, -2.0); tag(String(k), 'idx', xs(k), 0, -1.35); }
  tag('mod 8', 'ptr alt', 3.6, 0.3, -3.0);
  for (const v of [3, 6, 1, 4, 7, 0, 5, 2]) { rnd.push(cube('', '#9b7ef4', [0.62, 0.3, 0.6], xs(v), 0.25, -2.0, 3)); await beat(tok, 150); }
  say('input 是隨機的：大多數 hash 都分得很好', '');
  await step(tok);                                   // 11:50 real-life inputs are not random
  rnd.forEach((c) => fly(c));
  G.mood('wow');
  bubble('真實資料不隨機！', -4.0, 1.6, -3.0);
  say('問題是：真實資料不隨機', '');
  await step(tok);                                   // 11:55 camera pixels: the last few bits are the same
  vals.forEach((v, r) => {
    const bits = v.toString(2).padStart(8, '0'), z = -3.0 + r * 1.0;
    rows.push([...bits].map((b, k) => cube(b, b === '1' ? '#4b9ee2' : '#e8dcc4', [0.52, 0.4, 0.7], -6 + k * 0.6, 0.2, z + 3.0, 2)));
    tag(String(v), 'ptr', -6.8, 0.3, z + 3.0);
  });
  rows.forEach((row) => row.slice(5).forEach((c) => glow(c, GOLD)));
  say('例：相機像素因為雜訊，最後幾個 bit 都一樣', '180、100、220 的低 3 bit 都是 100（示範）');
  await step(tok);                                   // 12:09 Knuth's book: many real sequences look like that
  G.mood('calm');
  note('Knuth 的書：真實世界很多序列長這樣', -3.4, 0.3, 3.4);
  say('真實世界很多序列都有這種規律', '');
  await step(tok);                                   // 12:26 a non-random property reflected in the output: bad
  rows.forEach((row) => row.slice(0, 5).forEach((c) => tint(c, GRAY)));
  for (let r = 0; r < 3; r++) { cube(vals[r], '#dd8238', [0.62, 0.55, 0.6], xs(4), 0.38 + r * 0.6, -2.0, 3); await beat(tok, 300); }
  G.mood('sad');
  say('mod 8 只看低 3 bit：三個全進第 4 格', 'input 的規律原封不動留在 output：壞 hash');
  await step(tok);                                   // 12:39 mod 2^n: just truncate the bits on the left
  note('mod 2^n = 直接截掉左邊的 bit', 3.6, 0.3, -3.8);
  say('mod 2^n 很快：截掉高位就好', '');
  await step(tok);                                   // 12:54 faster — but the hash function is bad
  say('快是快，但換來很差的 hash', '');
  await step(tok);                                   // 13:00 in practice nicer hash functions are better overall
  for (let k = 0; k < 7; k++) { cube('', GRAY, [0.65, 0.1, 0.8], xs(k), 0.05, 1.5); tag(String(k), 'idx', xs(k), 0, 2.15); }
  tag('mod 7（質數）', 'ptr alt', 3.6, 0.3, 2.9);
  for (let r = 0; r < 3; r++) { cube(vals[r], '#2fc092', [0.62, 0.3, 0.6], xs(vals[r] % 7), 0.25, 1.5, 3); await beat(tok, 300); }
  G.mood('happy');
  say('好一點的 hash（例如 mod 質數）分得開', '實務上整體反而更快（cache）');
  await step(tok);                                   // 13:21 that's why we don't use 2^w
  good('所以不用 2^w 當模數', 0, 1.6, 0.0);
  say('這才是不用 2^w 的原因', '不是因為反元素');
}]);

// 13:41 PSet：dnaseq.py 要自己寫；rolling hash 的 append / skip / slide（A,C,G,T = 0,2,4,6、base 8、mod 13 沿用本章慣例）（9 steps）
FRAG.push(['strm-mit-slide', 'Rolling hash API：append、skip、slide', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const s = 'GATTACAG', D = { A: 0, C: 2, G: 4, T: 6 }, b = 8, q = 13, bk = (b * b) % q;
  const G = pal(-6.3, 3.4, 0.55);
  let files = {}, T, W, H, h = 0;
  const show = (lo, len) => { W.scale.x = len; W.position.set(T.at(lo) + (len - 1) * 1.1 / 2, 0.45, -1.0); };
  await step(tok);                                   // 13:41 look at the code: this time we have modules
  ['dnaseq.py', 'rolling.py', 'kfasta.py', 'main.py'].forEach((n, k) => { files[n] = prop('file', -4.5 + k * 3.0, 0, -3.8, 0.8, n); });
  say('這次的程式分成好幾個 module', '不是一個大檔案');
  await step(tok);                                   // 14:01 subsequence hashes, interval subsequence hashes
  pkt('subsequence_hashes、interval_subsequence_hashes', -2.0, 2.0, -2.6);
  say('要自己寫的：subsequence_hashes', '還有 interval_subsequence_hashes');
  await step(tok);                                   // 14:16 dnaseq: the only file you upload and modify
  bob(files['dnaseq.py'], 0.08);
  good('唯一要改、要上傳的檔案', -4.5, 1.9, -2.6);
  G.mood('wow');
  say('它們都在 dnaseq.py', '這是唯一要修改、要上傳的檔案');
  await step(tok);                                   // 14:35 where is the rolling hash?
  G.mood('calm');
  bob(files['rolling.py'], 0.08);
  T = smRow(s, -1.0, { cw: 1.1, drop: 2 });
  W = ghostBox('#c08a1f', 1.1, 0.9, 1.2); W.visible = false;
  H = cube('h = 0', '#cbbd9f', [2.4, 0.6, 1.0], 0, 0.3, 1.6, 2.5);
  note('A, C, G, T = 0, 2, 4, 6；b = 8、mod 13（示範）', 0, 0.3, 2.7);
  say('rolling hash 在另一個 module', '');
  await step(tok);                                   // 14:55 last time's API: append …
  W.visible = true;
  for (let k = 0; k < 3; k++) { h = (h * b + D[s[k]]) % q; show(0, k + 1); relabel(H, 'h = ' + h); glow(T.cs[k], GREEN); await beat(tok, 600); }
  say('上次的 API：append 從右邊加一個字元', 'h = (h·b + d) mod 13');
  await step(tok);                                   // 15:14 … and skip
  smOff(T.cs);
  h = ((h - D[s[0]] * bk) % q + q) % q; show(1, 2); relabel(H, 'h = ' + h); glow(T.cs[0], RED);
  await beat(tok, 700);
  h = (h * b + D[s[3]]) % q; show(1, 3); relabel(H, 'h = ' + h); glow(T.cs[3], GREEN);
  say('skip 從左邊去掉一個；再 append', '上次就是拆成 append 和 skip');
  await step(tok);                                   // 15:28 for this PSet we can get away with slide
  for (let lo = 2; lo + 3 <= s.length; lo++) {
    const o = s[lo - 1], n = s[lo + 2];
    h = ((((h - D[o] * bk) % q + q) % q) * b + D[n]) % q;
    smOff(T.cs); show(lo, 3); relabel(H, 'h = ' + h); glow(T.cs[lo - 1], RED); glow(T.cs[lo + 2], GREEN);
    await beat(tok, 500);
  }
  say('這次只要 slide(old, new)', '一步完成「去掉舊的、加上新的」');
  await step(tok);                                   // 15:35 slide is the code we had before breaking it up
  pkt('slide = skip(old) + append(new)', 3.6, 1.8, 1.6);
  say('slide 就是上次拆開之前的那份程式', '不用再講一次');
  await step(tok);                                   // 15:43 this is the rolling hash; it is good
  G.mood('happy'); await G.hop(tok);
  say('rolling hash 準備好了', '');
}]);

// 16:10 kfasta.py：不把整個檔案讀成 list，用 iterator；next / StopIteration / iter / for-in（14 steps）
FRAG.push(['strm-mit-iterator', 'Iterator：一次給一個', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const f = 'GATTACAGGT';
  const G = pal(-6.3, 3.4, 0.55);
  let F, mem, copies = [], cur, out = [];
  await step(tok);                                   // 16:10 kfasta.py
  prop('file', -6.0, 0, -3.0, 0.8, 'kfasta.py');
  F = smRow(f, -3.0, { cw: 0.9, idx: false, drop: 2 });
  say('值得看的檔案：kfasta.py', '從檔案讀 DNA 序列');
  await step(tok);                                   // 16:21 a FASTA sequence class reads from a file
  note('FASTA sequence class：讀檔案、回傳東西', 0, 0.3, -1.9);
  say('FASTA sequence class 從檔案讀資料', '');
  await step(tok);                                   // 16:26 the important thing: it doesn't return a list
  bubble('重點：它不回傳 list！', 3.6, 1.6, -1.0);
  G.mood('wow');
  say('重點：它不回傳 list', '');
  await step(tok);                                   // 16:35 docdist read the whole input into a list
  G.mood('calm');
  mem = ghostBox('#4b9ee2', 3.2, 1.4, 1.8); mem.position.set(-3.5, 0.7, 1.2);
  tag('記憶體', 'idx', -3.5, 0, 2.4);
  for (let k = 0; k < f.length; k++) {
    const c = cube(f[k], smC(f[k]), [0.5, 0.4, 0.5], F.at(k), 0.25, -3.0); copies.push(c);
    const x = k < 6 ? -4.6 + (k % 3) * 1.0 : -1.2 + (k - 6) * 0.6, z = k < 6 ? 0.8 + Math.floor(k / 3) * 0.8 : 0.6 + (k % 2) * 0.9;
    move(c, x, 0.3, z); await beat(tok, 150);
  }
  say('docdist 的作法：整個檔案讀進 list', '寫起來只要 5 行');
  await step(tok);                                   // 16:51 less memory: it wouldn't fit, it would crash
  tint(mem, '#c84a4a');
  bad('放不下 → crash', -3.5, 2.0, 1.2);
  G.mood('sad');
  say('檔案太大：記憶體放不下，程式 crash', '所以寧願寫 20 行');
  await step(tok);                                   // 17:11 this thing is called an iterator
  copies.forEach((c) => fly(c)); tint(mem, '#4b9ee2');
  G.mood('calm');
  good('iterator', 3.6, 1.6, -3.0);
  say('改用的東西叫 iterator', '');
  await step(tok);                                   // 17:58 how does an iterator work? what to implement
  note('要實作：__next__、__iter__', 3.6, 0.3, 2.6);
  tag('使用端', 'ptr alt', 3.6, 0.3, 1.9);
  say('自己寫 iterator 要實作什麼？', 'next 和 iter');
  await step(tok);                                   // 18:26 next gives you the next character
  cur = tag('next()', 'ptr', F.at(0), 1.0, -3.0);
  for (let k = 0; k < 3; k++) {
    cur.position.set(F.at(k), 1.0, -3.0);
    const c = cube(f[k], smC(f[k]), [0.5, 0.4, 0.5], F.at(k), 0.25, -3.0); move(c, 2.4 + k * 0.7, 0.3, 1.2); out.push(c);
    await beat(tok, 500);
  }
  say('next()：給你下一個元素', '要一個才給一個');
  await step(tok);                                   // 18:42 at the end? it raises an exception
  cur.position.set(F.at(9) + 0.9, 1.0, -3.0);
  bad('StopIteration', F.at(9) + 0.9, 1.7, -3.0);
  say('走到結尾：raise 一個 exception', 'StopIteration');
  await step(tok);                                   // 18:55 next returns an element, or raises StopIteration
  say('next：回傳下一個元素，或 raise StopIteration', '');
  await step(tok);                                   // 19:13 iter: returns itself
  pkt('__iter__ → 回傳自己', 3.6, 1.0, -1.6);
  say('另一個方法 iter：iterator 回傳自己', '');
  await step(tok);                                   // 19:59 a list 1, 2, 3, 4: iter gives an iterator for it
  out.forEach((c) => fly(c));
  [1, 2, 3, 4].forEach((v, k) => cube(v, colorFor(v), [0.6, 0.45, 0.6], -2.0 + k * 0.7, 0.25, 3.6, 2));
  note('iter([1, 2, 3, 4]) → iterator', 2.4, 0.3, 3.6);
  say('任何物件有 iter，就能拿到 iterator', '例：list [1, 2, 3, 4]');
  await step(tok);                                   // 20:10 for i in: iter, then next until StopIteration
  const loop = pkt('for i in L：iter(L) → next → next → … → StopIteration', 0, 1.8, 1.0);
  say('for … in 背後：先 iter，再一直 next', '直到 StopIteration');
  await step(tok);                                   // 20:31 behaves almost like a list, much less memory
  G.mood('happy'); await G.hop(tok);
  say('用起來幾乎像 list', '但每次 next 才算下一個 → 記憶體少很多');
}]);

// 21:05 reverse iterator：[1, 2, 3, 4] → 4, 3, 2, 1，只記 index（O(1) 記憶體）（9 steps）
FRAG.push(['strm-mit-reverse', 'Reverse iterator：O(1) 記憶體', async (tok) => {
  fresh([0, 8, 9.5], [0, 0, 0]);
  const xs = (k) => -2.25 + k * 1.5;
  const G = pal(-6.3, 3.2, 0.55);
  let L = [], ip, r = 0;
  const pull = async () => {
    const k = 3 - r;
    ip.position.set(xs(k), 1.2, -1.6); txt(ip, 'i = ' + k);
    glow(L[k], GOLD);
    const c = cube(k + 1, colorFor(k + 1), [1.0, 0.6, 0.9], xs(k), 0.3, -1.6);
    move(c, xs(r), 0.3, 1.8); r++;
    await beat(tok, 600); glow(L[k], null);
  };
  await step(tok);                                   // 21:08 an iterator that computes the reverse of a list
  L = [1, 2, 3, 4].map((v, k) => { tag('[' + k + ']', 'idx', xs(k), 0, -0.8); return cube(v, colorFor(v), [1.0, 0.6, 0.9], xs(k), 0.3, -1.6, 2); });
  tag('L', 'ptr', -4.0, 0.3, -1.6); tag('next() 輸出', 'ptr alt', -4.4, 0.3, 1.8);
  say('講義最後一頁：reverse iterator', '給一個 list，產生反轉的順序');
  await step(tok);                                   // 21:13 it does not keep a reversed list; magic with indexes
  ip = tag('i = 3', 'ptr', xs(3), 1.2, -1.6);
  say('不建一個反轉的新 list', '只記住一個 index i');
  await step(tok);                                   // 21:20 every time you call next …
  await pull(); await pull();
  say('每次 next()：回傳 L[i]，i 減 1', 'L[3] = 4、L[2] = 3');
  await step(tok);                                   // 21:28 reverse without producing a new list
  await pull(); await pull();
  ip.position.set(xs(0) - 1.4, 1.2, -1.6); txt(ip, 'i = −1');
  bad('StopIteration', xs(0) - 1.4, 1.9, -1.6);
  say('i < 0 就結束', '從頭到尾沒有建新 list');
  await step(tok);                                   // 21:37 a new list: O(n) memory; this: O(1)
  note('新 list：O(n) 記憶體', 4.6, 0.3, -2.6); good('reverse iterator：O(1)', 4.6, 0.3, -0.6);
  say('建新 list 要 O(n) 記憶體', '這個 iterator 只要 O(1)；時間一樣');
  await step(tok);                                   // 22:03 give 1, 2, 3, 4, get back 4, 3, 2, 1
  say('給 1, 2, 3, 4 → 得到 4, 3, 2, 1', '但回傳的不是 list');
  await step(tok);                                   // 22:29 iterators only go forward
  G.mood('wow');
  bubble('可以倒帶嗎？不行，只能往前', -4.0, 1.6, -3.4);
  say('Python iterator 只能往前', '不能倒帶（rewind）');
  await step(tok);                                   // 22:36 good for streams: file, network
  G.mood('calm');
  note('好處：可以包裝檔案、網路串流', 0, 0.3, 3.4);
  say('所以能拿來包裝串流資料', '檔案、網路都可以');
  await step(tok);                                   // 22:54 to rewind, get another iterator
  pkt('想重來：再呼叫一次 iter()', 3.6, 1.6, 1.8);
  say('想重來：再拿一個新的 iterator', '');
}]);

// 23:03 generator：list 版（L.append、return L）→ 改成 yield，記憶體 O(1)（13 steps）
FRAG.push(['strm-mit-genlist', 'List 版 vs generator 版', async (tok) => {
  fresh([0, 8.5, 10], [0.5, 0.8, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  let A, B, items = [];
  await step(tok);                                   // 23:03 Python magic: generators
  say('Python 的魔法：generator', '');
  await step(tok);                                   // 23:15 12 lines of Python into 3 lines
  const cmpT = pkt('iterator 類別 12 行 → generator 3 行', 0, 2.4, -3.0);
  say('12 行的 iterator 變成 3 行', '做的事完全一樣');
  await step(tok);                                   // 23:48 what does yield do?
  remove(cmpT);
  bubble('yield 是什麼？', -3.6, 1.6, -3.0);
  G.mood('wow');
  say('問題：yield 到底做什麼？', '');
  await step(tok);                                   // 24:10 a yield sign: you pause
  pkt('yield = 讓路標誌：暫停一下', 2.0, 1.6, -3.0);
  say('像路上的 yield（讓路）標誌', '關鍵字：pause（暫停）');
  await step(tok);                                   // 24:48 the worst way: brute force
  G.mood('calm');
  note('最差：暴力法，不用 rolling hash', 3.6, 0.3, 3.2);
  say('以 subsequence_hashes 為例', '最差的寫法：暴力法');
  await step(tok);                                   // 24:54 the next best way: make a list, start empty
  A = code(['def subseq_hashes(seq, k):', '    L = []', '    for h in rolling(seq, k):', '        L.append(h)', '    return L'], -3.3, 3.0, 0.56, -1.0);
  A.hl(1);
  say('次好：先建一個空 list', '');
  await step(tok);                                   // 25:01 use the rolling hash in some way
  A.hl(2);
  say('用 rolling hash 一個一個算', '');
  await step(tok);                                   // 25:09 in the loop: list.append
  for (let k = 0; k < 6; k++) { A.hl(3); items.push(cube('h' + '₀₁₂₃₄₅'[k], '#4b9ee2', [0.52, 0.45, 0.6], 1.2 + k * 0.6, 0.25, -1.0, 2)); await beat(tok, 300); }
  say('迴圈裡 append 進 list', '');
  await step(tok);                                   // 25:16 then return the list
  A.hl(4);
  say('最後 return 整個 list', '');
  await step(tok);                                   // 25:23 the problem: a huge list
  for (let k = 6; k < 10; k++) { items.push(cube('h', '#c84a4a', [0.52, 0.45, 0.6], 1.2 + k * 0.6, 0.25, -1.0, 2)); await beat(tok, 150); }
  G.mood('sad');
  say('問題：list 會非常大', '記憶體 O(n)');
  await step(tok);                                   // 25:30 remove this, replace with yield, remove this
  A.kill(); items.forEach((c) => fly(c));
  B = code(['def subseq_hashes(seq, k):', '    for h in rolling(seq, k):', '        yield h'], -3.3, 3.0, 0.56, -1.0);
  B.hl(2); G.mood('calm');
  say('拿掉 L、append 換成 yield、拿掉 return', '');
  await step(tok);                                   // 25:46 now it's a generator: constant memory
  tag('使用端', 'ptr alt', 5.0, 0.3, 1.8);
  for (let k = 0; k < 3; k++) {
    B.hl(1); await beat(tok, 250); B.hl(2);
    const c = cube('h' + '₀₁₂'[k], '#2fc092', [0.52, 0.45, 0.6], 1.2, 0.25, 1.0, 2);
    move(c, 5.0, 0.25, 1.0); await beat(tok, 450); fly(c);
  }
  say('變成 generator：一次交出一個', '記憶體 O(1)');
  await step(tok);                                   // 25:54 as long as you want an iterator, it still works
  G.mood('happy'); await G.hop(tok);
  say('只要你要的是 iterator', '程式行為完全一樣');
}]);

// 26:12 yield 怎麼運作：函式「凍結」在盒子裡，next() 解凍跑到下一個 yield（14 steps）
FRAG.push(['strm-mit-yield', 'yield：凍結與解凍', async (tok) => {
  fresh([0, 8.5, 10], [0, 1.0, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  let C, box, st, it, e = 0;
  const vals = ['e₀', 'e₁'];
  await step(tok);                                   // 26:12 this returns an iterator
  C = code(['def gen(seq):', '    for e in seq:', '        yield e', '    # 結束'], -3.2, 2.8, 0.56, -2.0);
  say('第一個提示：這個函式會回傳 iterator', '');
  await step(tok);                                   // 26:38 the execution pauses — what happens?
  C.hl(2);
  bubble('跑到 yield：暫停，然後呢？', 3.0, 1.6, -3.4);
  say('執行到 yield 就暫停', '然後發生什麼事？');
  await step(tok);                                   // 27:31 the closest thing to a list: an iterator
  it = good('iterator', 3.6, 0.3, 2.2);
  say('要能當 list 用 → 回傳 iterator', '最接近 list 的東西');
  await step(tok);                                   // 27:34 grab information, put it in a nice box
  box = ghostBox('#4b9ee2', 4.6, 2.6, 0.8); box.position.set(-3.2, 1.9, -2.0);
  st = tag('盒子', 'ptr', -3.2, 3.5, -2.0);
  say('把資訊收進一個盒子', '盒子表現得像 iterator');
  await step(tok);                                   // 27:48 put e away: next will spit it out
  const ec = cube('e', '#dd8238', [0.7, 0.45, 0.6], -1.5, 1.7, -2.0, 1);
  say('先把 e 收起來', 'next() 時再交出去');
  await step(tok);                                   // 28:26 the code here is in a frozen state
  tint(box, '#4b9ee2'); txt(st, '凍結中');
  say('函式停在這裡：凍結狀態', '');
  await step(tok);                                   // 28:39 the whole function, frozen, in a box
  G.mood('wow');
  say('整個函式被凍結、放進盒子', '回傳一個能用這個盒子的 iterator');
  await step(tok);                                   // 28:55 next gives e; unfreeze, run until yield again
  G.mood('calm');
  move(ec, 3.6, 0.3, 1.2);
  tint(box, '#2fc092'); txt(st, '執行中'); C.hl(1);
  await beat(tok, 700); C.hl(2);
  say('next()：交出 e，函式解凍', '一直跑到下一個 yield');
  await step(tok);                                   // 29:31 yield again with a new element
  const e1 = cube(vals[1], '#dd8238', [0.7, 0.45, 0.6], -1.5, 1.7, -2.0, 1);
  say('又遇到 yield：新的元素放進盒子', '');
  await step(tok);                                   // 29:47 and then it's frozen again
  tint(box, '#4b9ee2'); txt(st, '凍結中');
  say('然後又凍住', '等下一次 next()');
  await step(tok);                                   // 30:17 all your state is saved
  note('迴圈跑到哪、變數多少：全部保留', -3.2, 0.3, 0.2);
  say('所有狀態都保存下來', '');
  await step(tok);                                   // 31:05 you don't implement next or iter: yield is like print
  pkt('yield ≈ 「print 到 iterator」', 3.6, 1.6, -1.0);
  say('不用自己寫 next、iter', '把 yield 想成「印出」要給的東西');
  await step(tok);                                   // 31:20 when the loop is done, we return
  move(e1, 4.4, 0.3, 1.2);
  tint(box, '#2fc092'); txt(st, '執行中'); C.hl(3);
  await beat(tok, 700);
  tint(box, '#c84a4a'); txt(st, '結束');
  say('迴圈結束，函式 return', '');
  await step(tok);                                   // 32:01 next again: raise StopIteration
  bad('StopIteration', 3.6, 1.2, 2.2);
  G.mood('happy');
  say('之後再 next()：raise StopIteration', '');
}]);

// 33:13 generator 問答：generator 套 generator；無限序列（Fibonacci）沒有 len（13 steps）
FRAG.push(['strm-mit-geninf', 'Generator 串接與無限序列', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  let k = 0, out = 0;
  const pullTo = async (n) => {
    for (; k < n && k < fib.length; k++) {
      const v = fib[k], x = -4.6 + k * 1.2;
      const c = cube(v, colorFor(v), [0.9, 0.5, 0.8], x, 0.25, -1.8, 2.5);
      if (v % 2) { await beat(tok, 250); continue; }
      glow(c, GREEN);
      const o = cube(v, colorFor(v), [0.9, 0.5, 0.8], x, 0.25, -1.8); move(o, -2.6 + out * 2.0, 0.25, 1.6); out++;
      await beat(tok, 400);
    }
  };
  await step(tok);                                   // 33:13 the argument can be a list or an iterator
  note('參數：list 或 iterator 都可以（for … in）', 0, 0.3, -3.6);
  say('參數可以是 list，也可以是 iterator', '用 for … in 走訪就好');
  await step(tok);                                   // 33:20 nested generators: a chain of next
  tag('fib()', 'ptr', -6.2, 0.3, -1.8); tag('evens(fib())（示範）', 'ptr alt', -5.6, 0.3, 1.6);
  await pullTo(4);
  say('generator 裡用另一個 generator', '外層 next → 內層 next → 一整串');
  await step(tok);                                   // 33:32 a generator returns an iterator
  say('generator 回傳的是 iterator', 'next 時才解凍、往下跑');
  await step(tok);                                   // 33:50 an iterator is just next and iter
  pkt('iterator = next + iter', 4.0, 1.6, -3.0);
  say('iterator 就只有 next 和 iter', '有這兩個方法就是 iterator');
  await step(tok);                                   // 34:02 a generator: magic for shorter iterators
  pkt('generator = 寫短一點的 iterator', 4.0, 1.6, 3.2);
  say('generator：用更短的程式寫 iterator', '3 行對 12 行');
  await step(tok);                                   // 34:56 do I have len? no
  bubble('有幾個？沒有 len！', -4.0, 1.6, 3.2);
  G.mood('wow');
  say('iterator 沒有 len', '只能一直走訪才知道有幾個');
  await step(tok);                                   // 35:09 some iterators never return
  await pullTo(7);
  say('有些 iterator 永遠不會結束', '例如網路串流');
  await step(tok);                                   // 35:18 Fibonacci: an infinite sequence
  await pullTo(9);
  tag('…（無限）', 'ptr', 6.2, 0.3, -1.8);
  say('Fibonacci 數列：無限序列', 'len 根本沒有定義');
  await step(tok);                                   // 35:35 no has-next: the exception is just raised
  G.mood('calm');
  bad('沒有 has_next：直接 raise StopIteration', 0, 1.6, 3.4);
  say('沒有 has_next 這種方法', 'Python 直接 raise exception');
  await step(tok);                                   // 36:13 for-in catches it for you
  good('for … in 會幫你接住', 4.0, 0.3, 3.6);
  say('for … in 自動接住 StopIteration', '不用自己 catch');
  await step(tok);                                   // 36:37 constant memory instead of O(n)
  note('記憶體 O(1)，不是 O(n)', -4.0, 0.3, 0.2);
  say('像 list 一樣用，記憶體卻是常數', '');
  await step(tok);                                   // 37:20 take in an iterator and yield its next
  pkt('def same(it): for x in it: yield x', 0, 1.0, 0.2);
  say('收一個 iterator、把它的值再 yield 出去', '');
  await step(tok);                                   // 37:31 no delay
  good('不會延遲一格', 4.4, 1.6, 0.2);
  G.mood('happy');
  say('結果完全一樣，不會延遲一格', '');
}]);

// 37:48 subsequence_hashes / interval 版（step）；DRY；回傳 (i₁, i₂) tuple（序列為示範）（12 steps）
FRAG.push(['strm-mit-subseq', 'Subsequence hashes 與 (i₁, i₂)', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const s1 = 'GATTACA', s2 = 'TACAGATAC', k = 3;
  const G = pal(-6.4, 3.6, 0.5);
  let A, B, W1, W2, table = {}, cps = [], n = 0;
  const pair = (i, j) => {
    W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6);
    W2.visible = true; W2.position.set(B.at(j + 1), 0.45, 0.2);
    smOff(A.cs, B.cs); for (let d = 0; d < k; d++) { glow(A.cs[i + d], GREEN); glow(B.cs[j + d], GREEN); }
    cube('(' + i + ', ' + j + ')', '#c08a1f', [1.7, 0.45, 0.7], -3.6 + n * 2.3, 0.25, 2.6, 2.5); n++;
  };
  await step(tok);                                   // 37:48 subsequence hashes: build it as if a list…
  A = smRow(s1, -2.6, { cw: 1.0, drop: 2 });
  tag('seq 1', 'ptr', -5.0, 0.3, -2.6);
  W1 = ghostBox('#c08a1f', 3.0, 0.9, 1.2); W1.visible = false;
  say('dnaseq：subsequence_hashes', '每個長度 k 的子序列算一個 hash（k = 3）');
  await step(tok);                                   // 38:04 …then use yield: less memory
  for (let i = 0; i + k <= s1.length; i++) { W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6); table[s1.slice(i, i + k)] = i; await beat(tok, 350); }
  W1.visible = false;
  say('像建 list 一樣寫，再改成 yield', '更省記憶體');
  await step(tok);                                   // 38:09 interval subsequence hashes
  say('下一個：interval_subsequence_hashes', '');
  await step(tok);                                   // 38:23 like a step in your range
  for (const i of [0, 2, 4]) { W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6); await beat(tok, 500); }
  W1.visible = false;
  say('就像 range 加上 step', 'step = 2 → 位置 0, 2, 4');
  await step(tok);                                   // 38:57 copy and paste the code?
  for (let c = 0; c < 2; c++) cps.push(prop('file', 3.0 + c * 1.4, 0, -4.0, 0.6, c ? '複製版' : '原版'));
  say('一種作法：把程式碼複製貼上', '');
  await step(tok);                                   // 39:01 then you're not DRY
  bad('不 DRY', 3.7, 1.8, -4.0);
  say('這樣就不 DRY', 'DRY = Don’t Repeat Yourself');
  await step(tok);                                   // 39:10 find a bug later, fix it in one copy
  glow(cps[0].children[0], GREEN);
  G.mood('sad');
  say('之後發現 bug，只修了其中一份', '另一份還有 bug');
  await step(tok);                                   // 39:24 call subsequence hashes from interval: DRY
  G.mood('happy');
  good('interval 版呼叫原本的函式：DRY', 0, 1.6, -4.0);
  say('另一種：從 interval 版呼叫原本的函式', '這樣才 DRY');
  await step(tok);                                   // 39:40 20 copies: 5 fixed, 15 not
  G.mood('calm');
  for (let c = 0; c < 20; c++) cube('', c < 5 ? '#2fc092' : '#c84a4a', [0.28, 0.28, 0.28], 3.2 + (c % 10) * 0.32, 0.15, -1.2 + Math.floor(c / 10) * 0.35);
  note('20 份副本：5 份修好、15 份忘了', 4.6, 0.3, -0.2);
  say('大專案：20 份副本，只修好 5 份', '盡量保持 DRY');
  await step(tok);                                   // 40:00 the result: a list of tuples
  B = smRow(s2, 0.2, { cw: 1.0, x0: -4.0, drop: 2 });
  tag('seq 2', 'ptr', -5.4, 0.3, 0.2);
  W2 = ghostBox('#4b9ee2', 3.0, 0.9, 1.2); W2.visible = false;
  say('比對結果：一串 tuple', '');
  await step(tok);                                   // 40:16 two indexes: i₁ in the first, i₂ in the second
  pair(3, 0); await beat(tok, 700); pair(4, 1);
  say('tuple = (i₁, i₂)', 'seq 1 的位置、seq 2 的位置');
  await step(tok);                                   // 40:33 the same subsequence matches more things
  pair(0, 4); await beat(tok, 700); pair(3, 6);
  say('同一段配到 seq 2 好幾個位置', 'TAC：(3, 0) 和 (3, 6)');
}]);

// 41:03 比對結果畫成圖：每個 (i₁, i₂) 一個點；相同序列 → 對角線（示範用 k = 2）（6 steps）
FRAG.push(['strm-mit-dotplot', '比對圖：對角線＝共同子序列', async (tok) => {
  fresh([0, 10, 7], [0, 0, 0.3]);
  const win = (s) => [...Array(s.length - 1)].map((_, i) => s.slice(i, i + 2));
  const r1 = win('GATTACA');
  const X = (c) => -2.5 + c * 1.0, Z = (r) => -2.5 + r * 1.0;
  const G = pal(-5.6, 3.2, 0.5);
  let dots = [], colL, cl;
  await step(tok);                                   // 41:03 how do they make the image from tuples?
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', GRAY, [0.9, 0.08, 0.9], X(c), 0.04, Z(r));
  r1.forEach((w, r) => tag(w, 'idx', -3.6, 0, Z(r)));
  colL = r1.map((w, c) => tag(w, 'idx', X(c), 0, -3.5));
  tag('seq 1', 'ptr', -4.9, 0.3, 0); cl = tag('seq 1（自己）', 'ptr alt', 0, 0.3, -4.3);
  G.mood('wow');
  say('同學問：tuple 怎麼變成圖片？', '');
  await step(tok);                                   // 41:18 we yield the tuples …
  say('每個 (i₁, i₂) 畫成一個點', '示範：k = 2 的子序列');
  await step(tok);                                   // 41:29 two exact same DNA: a diagonal line
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (r1[r] === r1[c]) { dots.push(cube('', '#3a2f10', [0.55, 0.3, 0.55], X(c), 0.25, Z(r), 2)); await beat(tok, 200); }
  say('兩條完全相同的 DNA', '應該是一條對角線');
  await step(tok);                                   // 41:57 a match gives a big diagonal line
  G.mood('happy');
  [0, 1, 2, 3, 4, 5].forEach((r) => dots.forEach((d) => { if (d.position.x === X(r) && d.position.z === Z(r)) glow(d, GREEN); }));
  say('完全相符 → 一條很明顯的對角線', '比其他地方都強');
  await step(tok);                                   // 42:36 two that shouldn't match
  G.mood('calm');
  dots.forEach((d) => kill(d)); dots = [];
  const r2 = win('TACAGA');
  colL.forEach((l, c) => txt(l, r2[c] || '')); txt(cl, 'seq 2 = TACAGA（示範）');
  for (let r = 0; r < 6; r++) for (let c = 0; c < r2.length; c++) if (r1[r] === r2[c]) { dots.push(cube('', '#3a2f10', [0.55, 0.3, 0.55], X(c), 0.25, Z(r), 2)); await beat(tok, 250); }
  say('換成不一樣的序列', '只剩零散的點和短斜線');
  await step(tok);                                   // 42:51 how dark = how long / how many
  note('顏色深淺：子序列長度或數量（程式裡算像素強度）', 0, 0.3, 3.4);
  say('深淺可能代表子序列多長或多少個', '助教當場也不確定');
}]);

// 44:06 amortized：list 是 array（index O(1)）；append 滿了就開 2 倍、複製舊元素（16 steps）
FRAG.push(['strm-mit-append', 'Append：滿了就加倍', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const G = pal(-6.3, 3.4, 0.55);
  const ax = (i) => -4.2 + i * 1.0, sx = (i) => -2.0 + i * 1.0;
  let arr = [], ip, nodes = [], slots = [], els = [], ns = [], capT;
  const slotRow = (n, z) => [...Array(n)].map((_, i) => cube('', GRAY, [0.9, 0.12, 0.9], sx(i), 0.06, z));
  await step(tok);                                   // 44:06 list expansion: the list is stored as an array
  arr = [3, 1, 4, 1, 5, 9, 2, 6].map((v, i) => { tag(String(i), 'idx', ax(i), 0, -2.6); return cube(v, colorFor(v), [0.9, 0.5, 0.8], ax(i), 0.25, -3.4, 2); });
  tag('list = array', 'ptr', -5.9, 0.3, -3.4);
  say('Python 的 list 存成 array', '');
  await step(tok);                                   // 44:19 indexing in constant time
  ip = tag('L[0]', 'ptr alt', ax(0), 1.1, -3.4);
  await beat(tok, 500); ip.position.set(ax(7), 1.1, -3.4); txt(ip, 'L[7]');
  say('第 1 個、第一百萬個：都是 O(1)', '直接算出位置');
  await step(tok);                                   // 44:30 not true for a linked list
  for (let i = 0; i < 4; i++) nodes.push(lnode(i + 1, -4.2 + i * 2.0, 0.35, -1.2));
  const hand = pkt('一個一個走', -4.2, 1.3, -1.2);
  await travel(tok, hand, V3(-4.2, 1.3, -1.2), V3(1.8, 1.3, -1.2), 1500);
  say('linked list：第一百萬個要走一百萬步', 'O(i)');
  await step(tok);                                   // 44:54 append puts an element at the end
  arr.forEach(kill); nodes.forEach(kill); remove(hand); remove(ip);
  slots = slotRow(2, 0.8);
  els.push(cube(1, colorFor(1), [0.7, 0.5, 0.75], sx(0), 0.4, 0.8, 2));
  capT = tag('size 2', 'ptr', 0, 0.3, -0.4);
  say('append：把元素放到 list 最後面', '');
  await step(tok);                                   // 45:07 a count variable: if length > count
  const cntT = note('count = 1 < size 2：有空位', 3.4, 0.3, 0.8);
  say('記一個 count（已經放了幾個）', '如果 size > count：還有空位');
  await step(tok);                                   // 45:29 then directly insert: constant time
  els.push(cube(2, colorFor(2), [0.7, 0.5, 0.75], sx(1), 0.4, 0.8, 2.5));
  txt(cntT, 'count = 2 = size 2：滿了');
  say('有空位：直接放進去', 'O(1)');
  await step(tok);                                   // 45:51 otherwise not enough room: make it bigger
  const nx = cube(3, colorFor(3), [0.7, 0.5, 0.75], sx(2), 1.4, 0.8);
  bad('沒位置了！', sx(2), 2.2, 0.8);
  G.mood('wow');
  say('append(3)：沒有空位了', '要把 array 變大');
  await step(tok);                                   // 46:05 a new array of size 2 × count
  ns = slotRow(4, 2.8);
  txt(capT, 'size 2 → 4');
  say('開一個新 array，大小 2 × count', 'size 2 → 4');
  await step(tok);                                   // 46:23 copy everything from array to array 2
  els.forEach((c, i) => { move(c, sx(i), 0.4, 2.8); glow(c, GOLD); });
  await beat(tok, 600);
  say('把舊元素全部複製過去', '這一步：O(n)');
  await step(tok);                                   // 46:35 array 2 becomes the array
  slots.forEach(kill); slots = ns;
  move(nx, sx(2), 0.4, 2.8); els.push(nx);
  G.mood('calm');
  say('新 array 取代舊的，再放進 3', '');
  await step(tok);                                   // 46:57 still room: constant
  els.push(cube(4, colorFor(4), [0.7, 0.5, 0.75], sx(3), 0.4, 2.8, 2.5));
  say('還有空位的 append：O(1)', '');
  await step(tok);                                   // 47:10 if I have to resize, what's the cost?
  bad('要擴充的那次：O(n)', 4.0, 0.3, 2.8);
  say('要擴充的那一次呢？', '要複製 n 個 → O(n)');
  await step(tok);                                   // 48:49 the only cost is copying
  els.slice(0, 2).forEach((c) => glow(c, GOLD));
  say('真正花時間的是「複製」', '');
  await step(tok);                                   // 48:55 we assume allocating the space is constant
  note('配置新空間：假設 O(1)', -4.0, 0.3, 1.6);
  say('配置新空間：假設是 O(1)', '');
  await step(tok);                                   // 49:00 allocation O(1), copying O(n), insertion O(1)
  pkt('配置 O(1)＋複製 O(n)＋插入 O(1)', 0, 1.6, -1.2);
  say('配置 O(1)、複製 O(n)、插入 O(1)', '');
  await step(tok);                                   // 49:26 even an O(n) allocation would be absorbed
  note('就算配置是 O(n)，也會被複製的 O(n) 吸收', 0, 0.3, 4.0);
  say('就算配置要 O(n) 也沒關係', '會被複製的 O(n) 吸收');
}]);

// 49:53 逐行分析 O(n²)（正確但不緊）vs amortized O(1)／次（11 steps）
const amCost = (k) => (k > 1 && ((k - 1) & (k - 2)) === 0 ? k : 1);
FRAG.push(['strm-mit-linebyline', '逐行分析 O(n²) vs amortized', async (tok) => {
  fresh([0, 7, 11], [0, 1.5, 0]);
  const xs = (i) => -6 + i * 0.8, n = 16;
  const G = pal(-6.3, 3.4, 0.55);
  let C, gs = [], bars = [];
  await step(tok);                                   // 49:53 copying makes one append O(n) worst case
  for (let i = 0; i < n; i++) tag(String(i + 1), 'idx', xs(i), 0, 0.7);
  say('複製讓一次 append 最壞要 O(n)', '');
  await step(tok);                                   // 50:04 for 1..n: L.append; L is an empty list
  C = code(['L = []', 'for i in 1..n:', '    L.append(i)'], 2.5, 4.6, 0.5, -2.5);
  say('n 次 append 的總成本？', 'L = []，然後 append n 次');
  await step(tok);                                   // 50:27 line-by-line analysis: making a new list is constant
  C.hl(0);
  say('逐行分析：建立空 list O(1)', '第一堂課教的方法');
  await step(tok);                                   // 50:43 the cost of one append?
  C.hl(2);
  say('一次 append 要多少？', '要看最壞情況');
  await step(tok);                                   // 51:19 worst case: full → O(n)
  const g0 = ghostBox('#c84a4a', 0.62, n * 0.3, 0.62); g0.position.set(xs(0), n * 0.15, 0); gs.push(g0);
  say('最壞：array 滿了、要開新的', '一次 append：O(n)');
  await step(tok);                                   // 51:37 how many calls? the total?
  for (let i = 1; i < n; i++) { const g = ghostBox('#c84a4a', 0.62, n * 0.3, 0.62); g.position.set(xs(i), n * 0.15, 0); gs.push(g); await beat(tok, 80); }
  say('呼叫 n 次，每次都當最壞', 'n × O(n)');
  await step(tok);                                   // 51:56 O(n²): correct, but not the tight bound
  bad('O(n²)：沒錯，但不緊', 4.0, 4.4, 0);
  say('O(n²) 沒錯（不會超過）', '但不是 tight bound');
  await step(tok);                                   // 52:04 multiple choice: we ask for the tightest bound
  G.mood('sad');
  note('選擇題選 O(n²)：沒分', 4.0, 3.6, 0);
  say('考試問的通常是最緊的界', '選 O(n²) 會沒分');
  await step(tok);                                   // 52:37 amortized: O(1) amortized
  G.mood('calm');
  for (let i = 0; i < n; i++) { const c = amCost(i + 1); bars.push(cube(c, c > 1 ? '#dd8238' : '#4b9ee2', [0.6, c * 0.3, 0.6], xs(i), c * 0.15, 0, 1.5)); await beat(tok, 90); }
  say('實際上：大多數 append 只花 1', '只有擴充那幾次比較貴');
  await step(tok);                                   // 53:03 order 1 amortized → order n total
  gs.forEach(kill);
  good('每次 O(1) amortized → n 次共 O(n)', 0, 4.4, -1.6);
  G.mood('happy');
  say('amortized：每次 O(1)', 'n 次 append 共 O(n)');
  await step(tok);                                   // 53:46 amortized = averaged over multiple operations
  bars.forEach((b) => tint(b, '#9b7ef4'));
  pkt('amortized = 平均到多次操作上', 0, 3.4, 1.4);
  say('amortized：把成本平均到很多次操作', '');
}]);

// 54:03 aggregate analysis：插入 n + 複製 1 + 2 + 4 + 8 … → O(n)（10 steps）
FRAG.push(['strm-mit-aggregate', 'Aggregate analysis：加總成本', async (tok) => {
  fresh([0, 8, 10.5], [0, 0.6, 0]);
  const xs = (i) => -6 + i * 0.8, n = 16, ins = [], cps = [];
  const G = pal(-6.3, 3.6, 0.5);
  for (let i = 0; i < n; i++) tag(String(i + 1), 'idx', xs(i), 0, 0.7);
  await step(tok);                                   // 54:03 two useful methods in CLRS: aggregate analysis …
  pkt('1. aggregate analysis', -3.4, 1.6, -2.6); pkt('2. accounting（cost-based）', 3.0, 1.6, -2.6);
  say('CLRS 裡常用的兩種方法', 'aggregate analysis、accounting');
  await step(tok);                                   // 54:19 order 1 a lot of times
  for (let i = 0; i < n; i++) { ins.push(cube('', '#4b9ee2', [0.55, 0.3, 0.55], xs(i), 0.17, 0, 1.5)); await beat(tok, 80); }
  say('大部分的 append：O(1)', '');
  await step(tok);                                   // 54:31 order n only for a power of 2
  for (let i = 0; i < n; i++) { const c = amCost(i + 1); for (let u = 1; u < c; u++) cps.push(cube('', '#dd8238', [0.55, 0.3, 0.55], xs(i), 0.17 + u * 0.34, 0, 1)); }
  say('只有在 2 的次方附近要擴充：O(k)', '');
  await step(tok);                                   // 55:01 sum: n × O(1) + Σ O(2^i)
  cps.forEach((c) => glow(c, GOLD));
  note('總成本 = n·O(1) + Σ O(2ⁱ)（i 到 log n）', 0, 0.3, 2.0);
  say('全部加起來', 'n 個 O(1) ＋ 2 的次方的總和');
  await step(tok);                                   // 55:20 clearly order n — this also order n
  ins.forEach((c, k) => move(c, -6 + (k % 8) * 0.62, 0.17, 3.0 + Math.floor(k / 8) * 0.62));
  cps.forEach((c, k) => move(c, 1.0 + (k % 8) * 0.62, 0.17, 3.0 + Math.floor(k / 8) * 0.62));
  tag('插入 16', 'ptr', -3.8, 0.3, 4.4); tag('複製 15', 'ptr alt', 3.2, 0.3, 4.4);
  say('前半 O(n)，後半也是 O(n)', '插入 16 個、複製 1 + 2 + 4 + 8 = 15 個');
  await step(tok);                                   // 55:40 increase to 2 times, start with size 1
  ['size 1', '2', '4', '8', '16'].forEach((s, k) => tag(s, 'note', -5.4 + k * 2.6, 0.3, -1.4));
  say('關鍵：每次擴充都變 2 倍', '大小從 1 開始：1, 2, 4, 8, 16 …');
  await step(tok);                                   // 56:07 first, second, fourth, eighth: resize
  G.mood('wow');
  say('第 1、2、4、8 …… 次附近要擴充', '越來越稀疏');
  await step(tok);                                   // 56:30 few and far out
  G.mood('calm');
  say('O(n) 的那幾次很少、間隔很遠', '');
  await step(tok);                                   // 56:37 aggregate: add up n operations → O(n)
  good('總和 31 < 3n → O(n)；每次 amortized O(1)', 0, 1.6, 1.2);
  G.mood('happy'); await G.hop(tok);
  say('aggregate：n 次操作的成本加總 → O(n)', '平均每次 O(1)');
  await step(tok);                                   // 56:48 look at the cost (accounting) method in CLRS
  note('另一種：accounting method，請看 CLRS', 3.0, 0.3, -3.6);
  say('另一種方法：accounting method', 'CLRS amortized analysis 那章');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 11 章',
    title: '字串處理：KMP、Boyer-Moore',
    color: 'var(--ds)',
    modes: [
      { id: 'naive', name: '暴力法', enter: enterNaive },
      { id: 'failure', name: 'Failure Function', enter: enterFailure },
      { id: 'kmp', name: 'KMP 比對', enter: enterKMP },
      { id: 'bm', name: 'Boyer-Moore', enter: enterBM },
      { id: 'rk', name: 'Rolling Hash', enter: enterRK },
    ],
    pages: [
      { id: 'cmp', name: '演算法對照', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['naive-slide', 'failure-function', 'kmp-jump', 'kmp-vs-naive', 'bm-bad-character', 'bm-good-suffix', 'rolling-hash', 'mod-2w-even-hash'].concat(FRAG.map((f) => f[0])),
    stop() { clearTimeout(timer); epoch++; },
  };
}
