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
      clearMarks(); slideTo(s, 1.1);
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
      { q: 'KMP 為什麼比對階段只要 O(n)？', a: 'text 的指標 i 從不倒退，每次比較不是 i 前進就是 pattern 右移', d: ['因為 failure function 是 O(1) 查表', '因為只比較 pattern 的最後一個字元', '因為每次都右移 m 格'] },
      { q: 'Rolling hash 為什麼不建議用 2^w 當模數？（MIT 6.006 Rec 9b）', a: '輸入有規律（例如字元編碼都是偶數）時 hash 也有同樣規律，分布不均勻', d: ['2^w 不能算 mod', '2^w 會讓 hash 溢位', '2^w 沒有乘法反元素所以一定錯'] },
      { q: 'Rabin-Karp 的 hash 值相同時要做什麼？', a: '逐字比較確認，因為可能是 collision（假警報）', d: ['直接回報找到', '換一個模數重算', '跳過這個位置'] },
      { q: 'Boyer-Moore 在什麼情況下特別快？', a: '字母表大、pattern 長，壞字元常常不在 pattern 裡', d: ['字母表只有 0 和 1', 'text 和 pattern 幾乎全部相同', 'pattern 只有 1 個字元'] },
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
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── V5-7GzOfADQ（Abdul Bari：KMP）、-DwGrJ8JxDc（MIT 6.006 Rec 9b）、qQ8vS2btsxI（Abdul Bari：Rabin-Karp） ───
const smC = (c) => colorFor(String(c).charCodeAt(0));
const smSup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
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

// ════════ V5-7GzOfADQ（Abdul Bari：KMP） ════════
// 00:00 問題定義＋暴力法例一：abcdefgh 找 def
FRAG.push(['strm-naive-def', '暴力法例一：abcdefgh 找 def', async (tok) => {
  fresh([0, 7.5, 10], [0, 0.2, 0.3]);
  const t = 'abcdefgh', p = 'def';
  const T = smRow(t, -1.2, { base: 1, cw: 1.1 });
  tag('string', 'ptr', T.at(0) - 1.4, 0.3, -1.2);
  say('pattern 在 string 裡嗎？在哪？', 'string 長 n、pattern 長 m');
  await beat(tok, 2600);
  const P = smPat(T, p, 1.0);
  tag('pattern', 'ptr alt', T.at(0) - 1.5, 0.3, 1.0);
  say('暴力法：從第一個字母開始比', 'pattern = def');
  await beat(tok, 2200);
  for (let s = 0; s <= 3; s++) {
    if (s) { smOff(T.cs, P.cs); P.slide(s); await beat(tok, 900); }
    for (let j = 0; j < 3; j++) {
      const ok = t[s + j] === p[j];
      glow(T.cs[s + j], ok ? GREEN : RED); glow(P.cs[j], ok ? GREEN : RED);
      say(ok ? t[s + j] + ' = ' + p[j] + '：比下一個' : t[s + j] + ' ≠ ' + p[j] + '：右移一格', '對齊 string 第 ' + (s + 1) + ' 個字母');
      await beat(tok, ok ? 1000 : 1400);
      if (!ok) break;
    }
  }
  say('找到了：在 index 4 到 6', 'def = string[4..6]（index 從 1 開始）');
  await beat(tok, 3000);
}]);

// 01:46 暴力法例二：abcdabcabcdf 找 abcdf，i 被拉回
FRAG.push(['strm-naive-backtrack', '暴力法例二：i 一直倒退', async (tok) => {
  fresh([0, 8, 10.5], [0, 0.2, 0.2]);
  const t = 'abcdabcabcdf', p = 'abcdf';
  const T = smRow(t, -1.4, { base: 1, cw: 1.0 });
  const P = smPat(T, p, 1.2);
  const ip = tag('i', 'ptr', T.at(0), 1.1, -1.4), jp = tag('j', 'ptr alt', T.at(0), -0.1, 2.2);
  say('string 用 i、pattern 用 j', 'pattern = abcdf');
  await beat(tok, 2600);
  let cmp = 0, far = null;
  for (let s = 0; s + p.length <= t.length; s++) {
    if (s) { smOff(T.cs, P.cs); P.slide(s); await beat(tok, 700); }
    let j = 0;
    for (; j < p.length; j++) {
      const i = s + j, ok = t[i] === p[j]; cmp++;
      ip.position.set(T.at(i), 1.1, -1.4); txt(ip, 'i = ' + (i + 1));
      jp.position.set(T.at(i), -0.1, 2.2); txt(jp, 'j = ' + (j + 1));
      glow(T.cs[i], ok ? GREEN : RED); glow(P.cs[j], ok ? GREEN : RED);
      say(ok ? t[i] + ' = ' + p[j] + '：i、j 都往前' : t[i] + ' ≠ ' + p[j] + '：mismatch', '比較次數 ' + cmp);
      await beat(tok, ok ? 650 : 1200);
      if (!ok) break;
    }
    if (j === p.length) break;
    if (j > 0) {
      if (far) kill(far);
      far = tag('i 曾到 ' + (s + j + 1), 'idx', T.at(s + j), 1.7, -1.4);
      ip.position.set(T.at(s + 1), 1.1, -1.4); txt(ip, 'i = ' + (s + 2));
      say('i 退回 ' + (s + 2) + '：比過的又要重比', 'j 回到 1，pattern 右移 1 格');
      await beat(tok, 1900);
    }
  }
  if (far) kill(far);
  say('找到：string[8..12]', '共比較 ' + cmp + ' 次；i 被拉回 2 次');
  await beat(tok, 3000);
}]);

// 05:07 暴力法最壞情況：aaaaaaaaab 找 aaab → m(n − m + 1)
FRAG.push(['strm-naive-worst', '暴力法最壞情況：O(mn)', async (tok) => {
  fresh([0, 7.5, 10], [0, 0.2, 0.2]);
  const t = 'aaaaaaaaab', p = 'aaab';
  const T = smRow(t, -1.3, { base: 1, cw: 1.1 });
  const P = smPat(T, p, 1.2);
  const cnt = tag('比較 0 次', 'ptr', 4.6, 1.3, 2.4);
  say('最壞情況：string 幾乎全是 a', 'n = 10、m = 4');
  await beat(tok, 2600);
  let cmp = 0;
  for (let s = 0; s <= t.length - p.length; s++) {
    const slow = s < 2;
    if (s) { smOff(T.cs, P.cs); P.slide(s); await beat(tok, slow ? 800 : 350); }
    if (s === 2) say('每次只右移一格、從頭再比', '每個位置最多比 m 次');
    for (let j = 0; j < p.length; j++) {
      const ok = t[s + j] === p[j]; cmp++; txt(cnt, '比較 ' + cmp + ' 次');
      glow(T.cs[s + j], ok ? GREEN : RED); glow(P.cs[j], ok ? GREEN : RED);
      if (slow) { say(ok ? 'a = a：繼續' : 'a ≠ b：j 回開頭、i 回去', '對齊位置 ' + (s + 1)); await beat(tok, ok ? 600 : 1100); }
      else await beat(tok, ok ? 130 : 260);
      if (!ok) break;
    }
    if (s === 1) {
      smOff(P.cs); for (let k = 0; k < 3; k++) glow(P.cs[k], GOLD);
      say('前面的 a 剛剛才比過', 'KMP：只要看下一個是不是 b');
      await beat(tok, 2600);
    }
  }
  say('共 ' + cmp + ' 次 = m(n − m + 1)', '4 × 7 = 28 → O(mn)');
  await beat(tok, 3200);
}]);

// 07:32 prefix / suffix：abcdabc，abc 既是前綴也是後綴
FRAG.push(['strm-prefix-suffix', 'Prefix 與 suffix：abcdabc', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0.3]);
  const p = 'abcdabc';
  const T = smRow(p, -2.8, { base: 1, cw: 0.95 });
  say('KMP 先研究 pattern 本身', 'pattern = abcdabc');
  await beat(tok, 2400);
  const cw = 0.62, pre = [], suf = [];
  tag('prefix', 'ptr', -5.3, 0.3, -1.6); tag('suffix', 'ptr alt', 5.3, 0.3, -1.6);
  for (let L = 1; L <= 4; L++) {
    const z = -0.9 + (L - 1) * 1.05, row = [];
    for (let k = 0; k < L; k++) row.push(cube(p[k], smC(p[k]), [cw - 0.06, 0.4, 0.6], -6.2 + k * cw, 0.2, z, 2));
    for (let k = 0; k < L; k++) glow(T.cs[k], GOLD);
    pre.push(row);
    say('prefix：從開頭取 ' + L + ' 個', p.slice(0, L));
    await beat(tok, 1100);
    smOff(T.cs);
  }
  for (let L = 1; L <= 4; L++) {
    const z = -0.9 + (L - 1) * 1.05, s = p.slice(p.length - L), row = [];
    for (let k = 0; k < L; k++) row.push(cube(s[k], smC(s[k]), [cw - 0.06, 0.4, 0.6], 6.2 - (L - 1 - k) * cw, 0.2, z, 2));
    for (let k = p.length - L; k < p.length; k++) glow(T.cs[k], GREEN);
    suf.push(row);
    say('suffix：從尾端取 ' + L + ' 個', s);
    await beat(tok, 1100);
    smOff(T.cs);
  }
  say('有沒有 prefix = suffix？', 'a？ab？abc？');
  await beat(tok, 2000);
  pre[2].forEach((c) => glow(c, GREEN)); suf[2].forEach((c) => glow(c, GREEN));
  for (let k = 0; k < 3; k++) { glow(T.cs[k], GOLD); glow(T.cs[4 + k], GREEN); }
  tag('abc', 'ptr alt', 0, 0.3, 0.6);
  say('abc 既是 prefix 也是 suffix', '開頭那段在後面又出現');
  await beat(tok, 3000);
  say('記成 π 表（LPS）', 'Longest Prefix that is also Suffix');
  await beat(tok, 3000);
}]);

// 10:03 四個 pattern 的 π 表（index 從 1、值 = 相同前後綴長度）
FRAG.push(['strm-pi-tables', '四個 pattern 的 π 表', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const pats = ['abcdabeabf', 'abcdeabfabc', 'aabcadaabe', 'aaaabaacd'];
  say('π：開頭那段在後面再出現幾個', '沒有就是 0；index 從 1 開始');
  await beat(tok, 2600);
  for (let r = 0; r < pats.length; r++) {
    const p = pats[r], f = smLps(p), z = -3.3 + r * 1.95, cw = 0.85, x0 = -4.0;
    const cs = [...p].map((c, k) => cube(c, smC(c), [cw - 0.08, 0.45, 0.7], x0 + k * cw, 0.22, z, 2));
    tag('P' + (r + 1), 'ptr alt', x0 - 1.1, 0.25, z);
    tag('π', 'ptr', x0 - 1.1, 0.1, z + 0.75);
    say('pattern ' + (r + 1) + '：' + p, '找開頭那段在後面的重複');
    await beat(tok, 1400);
    for (let j = 0; j < p.length; j++) {
      const v = f[j];
      tag(String(v), v ? 'ptr alt' : 'idx', x0 + j * cw, 0.05, z + 0.75);
      if (v) {
        for (let k = 0; k < v; k++) { glow(cs[k], GOLD); glow(cs[j - v + 1 + k], GREEN); }
        await beat(tok, 650);
        cs.forEach((c) => glow(c, null));
      } else await beat(tok, 180);
    }
    say('π = ' + f.join(' '), r === 2 ? 'aab 重複出現：最後到 3' : '數字 = 重複那段的長度');
    await beat(tok, 1500);
  }
  say('π 表建好，比對就簡單了', '也叫 LPS / prefix table');
  await beat(tok, 2400);
}]);

// 12:03 / 15:58 KMP 追蹤：string ababcabcabababd、pattern ababd、π = 0 0 1 2 0；比 s[i] 與 p[j+1]
FRAG.push(['strm-kmp-trace', 'KMP 追蹤：ababcabcabababd 找 ababd', async (tok) => {
  const part = (ctx.params || {}).part === 2 ? 2 : 1;
  fresh([0, 8.5, 10.5], [0, 0, 0.2]);
  const t = 'ababcabcabababd', p = 'ababd', pi = [0, 0, 0, 1, 2, 0];
  const T = smRow(t, -2.4, { base: 1, cw: 0.85 });
  const cw = 0.85, px = (k) => -2.1 + k * cw;
  const pc = [cube('', GRAY, [cw - 0.08, 0.3, 0.85], px(0), 0.15, 1.0)];
  for (let k = 1; k <= 5; k++) pc.push(cube(p[k - 1], smC(p[k - 1]), [cw - 0.08, 0.5, 0.85], px(k), 0.25, 1.0, part === 1 ? 2 : 0));
  for (let k = 0; k <= 5; k++) tag(String(k), 'idx', px(k), 0, 0.3);
  const piL = [null];
  for (let k = 1; k <= 5; k++) piL.push(tag(part === 2 ? String(pi[k]) : '', 'ptr alt', px(k), 0.05, 1.85));
  tag('π', 'ptr', px(0) - 1.0, 0.05, 1.85); tag('pattern', 'ptr', px(0) - 1.5, 0.3, 1.0);
  const ip = tag('i', 'ptr', 0, 1.05, -2.4), jp = tag('j', 'ptr alt', 0, 1.05, 1.0);
  const setI = (i) => { ip.position.set(T.at(Math.min(i, 15) - 1), 1.05, -2.4); txt(ip, 'i = ' + i); };
  const setJ = (j) => { jp.position.set(px(j), 1.05, 1.0); txt(jp, 'j = ' + j); };
  let i, j = 0;
  if (part === 1) {
    say('先建 π 表（prefix table）', 'pattern = ababd');
    await beat(tok, 1800);
    for (let k = 1; k <= 5; k++) {
      txt(piL[k], String(pi[k]));
      if (pi[k]) { glow(pc[k], GREEN); glow(pc[pi[k]], GOLD); }
      await beat(tok, 600);
      pc.forEach((c) => glow(c, null));
    }
    say('ab 出現兩次 → π = 0 0 1 2 0', '多一格 index 0 當起點');
    await beat(tok, 2400);
    i = 1;
  } else {
    for (let k = 0; k < 8; k++) tint(T.cs[k], GRAY);
    say('接著從 i = 9、j = 0 繼續', 'i 到現在都沒有倒退過');
    await beat(tok, 2400);
    i = 9;
  }
  setI(i); setJ(j);
  say('比 string[i] 和 pattern[j+1]', 'j 從 0 開始');
  await beat(tok, 1800);
  const stop = part === 1 ? 9 : 16;
  let found = false;
  while (i < stop) {
    const a = t[i - 1], b = p[j], ok = a === b;
    glow(T.cs[i - 1], ok ? GREEN : RED); glow(pc[j + 1], ok ? GREEN : RED);
    if (ok) {
      say('s[' + i + '] = p[' + (j + 1) + '] = ' + a, 'match → i++、j++');
      await beat(tok, 900);
      glow(pc[j + 1], null); j++; i++;
      setJ(j);
      if (j === 5) { found = true; break; }
      setI(i);
    } else if (j > 0) {
      say('s[' + i + '] ≠ p[' + (j + 1) + ']：j = π[' + j + '] = ' + pi[j], 'i 不動，只有 j 往回');
      await beat(tok, 1600);
      glow(pc[j + 1], null); glow(T.cs[i - 1], null); j = pi[j]; setJ(j);
      await beat(tok, 600);
    } else {
      say('s[' + i + '] ≠ p[1]，j 已經是 0', '只能 i++');
      await beat(tok, 1300);
      glow(pc[1], null); glow(T.cs[i - 1], null); i++; setI(i);
    }
  }
  if (found) {
    say('j = 5 = m：找到 pattern！', 'string[11..15] = ababd');
    await beat(tok, 3000);
  } else {
    say('i 一路往前，從不退回', '暴力法這裡會把 i 拉回去');
    await beat(tok, 2800);
  }
}]);

// 17:46 KMP 總結：i 不回頭；建表 m + 搜尋 n
FRAG.push(['strm-kmp-cost', 'KMP 時間：建表 m + 搜尋 n', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const T = smRow('ababcabcabababd', -2.2, { base: 1, cw: 0.85 });
  const P = smRow('ababd', 1.4, { base: 1, cw: 0.85, x0: -1.7 });
  say('開頭那段重複出現，就不再重比', 'i 只往前，不回頭');
  await beat(tok, 2600);
  const cur = tag('i', 'ptr', T.at(0), 1.05, -2.2);
  say('搜尋：string 只掃過一次', '每個字元一次 → n');
  for (let k = 0; k < 15; k++) { cur.position.set(T.at(k), 1.05, -2.2); glow(T.cs[k], GOLD); await beat(tok, 200); }
  tag('n = 15', 'ptr alt', 5.6, 0.3, -1.2);
  await beat(tok, 900);
  const c2 = tag('建表', 'ptr', P.at(0), 1.05, 1.4);
  say('建 π 表：pattern 掃一次', '→ m');
  for (let k = 0; k < 5; k++) { c2.position.set(P.at(k), 1.05, 1.4); glow(P.cs[k], GREEN); await beat(tok, 380); }
  tag('m = 5', 'ptr alt', 3.2, 0.3, 1.4);
  await beat(tok, 900);
  cube('m', '#2fc092', [2.0, 0.4, 0.6], -4.0, 0.2, 3.2, 2);
  cube('n', '#c08a1f', [6.0, 0.4, 0.6], 0.0, 0.2, 3.2, 2);
  say('總時間 O(m + n)', '暴力法是 O(mn)');
  await beat(tok, 3200);
  say('pattern matching 很快的一種', '建表 O(m)＋搜尋 O(n)');
  await beat(tok, 2600);
}]);

// ════════ qQ8vS2btsxI（Abdul Bari：Rabin-Karp） ════════
const rkV = (c) => c.charCodeAt(0) - 96;
function rkCodes(z) { const R = smRow('abcdefghij', z, { base: 1, cw: 0.8, d: 0.6 }); tag('code', 'ptr', R.at(0) - 1.0, 0.25, z); return R; }
const rkSum = (w) => [...w].reduce((a, c) => a + rkV(c), 0);

// 00:00 基本想法：codes a=1…j=10，hash = 加總；aaaaab 找 aab
FRAG.push(['strm-rk-sum-aab', 'Rabin-Karp 基本想法：aaaaab 找 aab', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  say('Rabin-Karp：不逐字比，改比一個數', 'text 裡找 pattern');
  rkCodes(-3.4);
  await beat(tok, 2400);
  say('自訂 code：a = 1、b = 2 … j = 10', '也可以用 ASCII（a = 97）');
  await beat(tok, 2600);
  const t = 'aaaaab', p = 'aab';
  const T = smRow(t, -0.9, { base: 1, cw: 1.1 });
  const P = smRow(p, 2.0, { cw: 1.1, x0: -5.6, idx: false });
  tag('pattern', 'ptr alt', -4.5, 0.3, 2.9);
  tag('h = 4', 'ptr alt', -4.5, 1.1, 2.0);
  say('hash(aab) = 1 + 1 + 2 = 4', 'hash function：pattern → 一個數');
  await beat(tok, 2800);
  const W = ghostBox('#c08a1f', 3 * 1.1, 0.9, 1.2);
  const hw = tag('', 'ptr', 0, 1.3, -0.9);
  for (let s = 0; s <= 3; s++) {
    const xc = T.at(s + 1), w = t.slice(s, s + 3), h = rkSum(w);
    W.position.set(xc, 0.45, -0.9); hw.position.set(xc, 1.3, -0.9); txt(hw, 'h = ' + h);
    if (h !== 4) { say((s ? '滑到下一組 ' : '前 3 個 ') + w + ' = ' + h, h + ' ≠ 4 → 字元不用比'); await beat(tok, 1900); }
    else { say(w + ' = ' + h + '：和 pattern 一樣', 'hash 相同 → 再確認字元'); await beat(tok, 1800); }
  }
  for (let k = 0; k < 3; k++) { glow(T.cs[3 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 500); }
  say('真的相同：在 index 4–6 找到', '一路滑過去 = rolling hash');
  await beat(tok, 3000);
}]);

// 04:47 rolling：abcdabce 找 bce，減掉離開的、加上進來的
FRAG.push(['strm-rk-sum-bce', 'Rolling hash：abcdabce 找 bce', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  rkCodes(-3.4);
  const t = 'abcdabce', p = 'bce', hp = rkSum(p);
  const T = smRow(t, -0.9, { base: 1, cw: 1.0 });
  const P = smRow(p, 2.1, { cw: 1.0, x0: -5.6, idx: false });
  tag('h = ' + hp, 'ptr alt', -4.6, 1.1, 2.1);
  say('hash(bce) = 2 + 3 + 5 = 10', '先算 pattern');
  await beat(tok, 2600);
  const W = ghostBox('#c08a1f', 3.0, 0.9, 1.2), hw = tag('', 'ptr', 0, 1.3, -0.9);
  let h = 0;
  for (let s = 0; s + 3 <= t.length; s++) {
    smOff(T.cs);
    W.position.set(T.at(s + 1), 0.45, -0.9); hw.position.set(T.at(s + 1), 1.3, -0.9);
    if (s === 0) { h = rkSum(t.slice(0, 3)); txt(hw, 'h = ' + h); say('第一組 abc = 1 + 2 + 3 = 6', '6 ≠ 10'); await beat(tok, 2200); continue; }
    const o = rkV(t[s - 1]), n = rkV(t[s + 2]), prev = h;
    h = prev - o + n; txt(hw, 'h = ' + h);
    glow(T.cs[s - 1], RED); glow(T.cs[s + 2], GREEN);
    say('去掉 ' + t[s - 1] + '、加上 ' + t[s + 2], prev + ' − ' + o + ' + ' + n + ' = ' + h + (h === hp ? '' : ' ≠ 10'));
    await beat(tok, s < 3 ? 2100 : 1500);
  }
  smOff(T.cs);
  say('10 = 10：可能是 pattern', '逐字確認');
  await beat(tok, 1400);
  for (let k = 0; k < 3; k++) { glow(T.cs[5 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 500); }
  say('b、c、e 都相同：找到！', '每次滑動 O(1)：一減一加');
  await beat(tok, 3000);
}]);

// 07:19 最壞情況：ccaccaaedba 找 dba，加總 hash → spurious hits
FRAG.push(['strm-rk-spurious', 'Spurious hit：ccaccaaedba 找 dba', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'ccaccaaedba', p = 'dba', hp = rkSum(p);
  const T = smRow(t, -1.4, { base: 1, cw: 1.05 });
  const P = smRow(p, 2.0, { cw: 1.05, x0: -5.8, idx: false });
  tag('h = ' + hp, 'ptr alt', -4.8, 1.1, 2.0);
  const cnt = tag('spurious 0', 'ptr', 4.6, 0.3, 2.0);
  say('平均：string 只掃一次', 'Θ(n − m + 1)');
  await beat(tok, 2400);
  say('最壞情況：n = 11、m = 3', 'hash(dba) = 4 + 2 + 1 = 7');
  await beat(tok, 2400);
  const W = ghostBox('#c08a1f', 3.15, 0.9, 1.2), hw = tag('', 'ptr', 0, 1.3, -1.4);
  let sp = 0;
  for (let s = 0; s + 3 <= t.length; s++) {
    const w = t.slice(s, s + 3), h = rkSum(w), slow = s < 2;
    smOff(T.cs, P.cs);
    W.position.set(T.at(s + 1), 0.45, -1.4); hw.position.set(T.at(s + 1), 1.3, -1.4); txt(hw, 'h = ' + h);
    if (h !== hp) { say(w + ' = ' + h, h + ' ≠ 7：跳過'); await beat(tok, 1100); continue; }
    say(w + ' = ' + h + '：hash 相同', '逐字比對');
    await beat(tok, slow ? 1400 : 800);
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const e = w[k] === p[k];
      glow(T.cs[s + k], e ? GREEN : RED); glow(P.cs[k], e ? GREEN : RED);
      await beat(tok, 450);
      if (!e) { ok = false; break; }
    }
    if (!ok) { sp++; txt(cnt, 'spurious ' + sp); say(w + ' 不是 dba：spurious hit', 'hash 相同、字串不同'); await beat(tok, slow ? 1700 : 1100); }
    else { say('dba 是真的：在 index 9–11', '共 ' + sp + ' 次 spurious hit'); await beat(tok, 2200); }
  }
  say('hash 太簡單 → 很多假命中', '最壞 Θ(mn)');
  await beat(tok, 3000);
}]);

// 11:02 Rabin-Karp 的 hash：dba = 4·10² + 2·10 + 1 = 421
FRAG.push(['strm-rk-base10', 'Rabin-Karp hash：dba = 421', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  say('換一個強一點的 hash function', 'Rabin-Karp 建議的寫法');
  await beat(tok, 2200);
  const xs = [-3.2, -1.2, 0.8], w = 'dba';
  const terms = [];
  for (let k = 0; k < 3; k++) {
    cube(w[k], smC(w[k]), [1.0, 0.5, 0.85], xs[k], 0.25, -2.4, 2);
    tag('code ' + rkV(w[k]), 'idx', xs[k], 0, -1.6);
  }
  await beat(tok, 800);
  for (let k = 0; k < 3; k++) {
    const pw = 2 - k, term = rkV(w[k]) * 10 ** pw;
    tag('× 10' + smSup(pw), 'ptr', xs[k], 0.3, -0.9);
    terms.push(cube(term, '#e8dcc4', [1.3, 0.5, 0.85], xs[k], 0.25, 0.6, 2.5));
    say(w[k] + '：' + rkV(w[k]) + ' × 10' + smSup(pw) + ' = ' + term, '第 ' + (k + 1) + ' 個字母，次方 ' + pw);
    await beat(tok, 1600);
  }
  arrow(V3(1.8, 0.3, 0.6), V3(3.4, 0.3, 0.6));
  cube(421, '#c08a1f', [1.6, 0.6, 1.0], 4.6, 0.3, 0.6, 3);
  say('hash(dba) = 400 + 20 + 1 = 421', 'p₁·10^(m−1) + p₂·10^(m−2) + … + p_m');
  await beat(tok, 3000);
  const C = smRow('cca', 2.9, { cw: 1.0, x0: -3.2, idx: false });
  cube(331, '#cbbd9f', [1.6, 0.6, 1.0], 4.6, 0.3, 2.9, 3);
  C.cs.forEach((c) => glow(c, RED));
  say('cca = 300 + 30 + 1 = 331', '331 ≠ 421：不再是假命中');
  await beat(tok, 3000);
  say('base = 字母個數：這裡 10', '26 個字母用 26，字元全用就更大');
  await beat(tok, 3000);
}]);

// 14:51 rolling：(h − 首字·10²)·10 + 新字；331 → 313 → 133 → 331 → 311 … → 421
FRAG.push(['strm-rk-rolling', 'Rolling hash：331 → 313 → 133 …', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const t = 'ccaccaaedba', hp = 421;
  const T = smRow(t, -2.4, { base: 1, cw: 1.05 });
  const P = smRow('dba', 2.8, { cw: 1.0, x0: -5.8, idx: false });
  tag('h = 421', 'ptr alt', -4.8, 1.1, 2.8);
  const W = ghostBox('#c08a1f', 3.15, 0.9, 1.2);
  const H = cube(331, '#cbbd9f', [1.8, 0.6, 1.0], 1.5, 0.3, 1.2, 2.5);
  tag('目前 hash', 'idx', 1.5, 0, 2.0);
  W.position.set(T.at(1), 0.45, -2.4);
  say('第一組 cca = 331', '331 ≠ 421');
  tag('331', 'ptr', T.at(1), 0.2, -0.9);
  await beat(tok, 2400);
  let h = 331;
  for (let s = 1; s + 3 <= t.length; s++) {
    const o = rkV(t[s - 1]), n = rkV(t[s + 2]), prev = h;
    h = (prev - o * 100) * 10 + n;
    smOff(T.cs);
    W.position.set(T.at(s + 1), 0.45, -2.4);
    glow(T.cs[s - 1], RED);
    if (s <= 3) {
      relabel(H, prev - o * 100);
      say('去掉 ' + t[s - 1] + '：' + prev + ' − ' + o + '·10² = ' + (prev - o * 100), '先減掉最高位那一項');
      await beat(tok, 1400);
      relabel(H, (prev - o * 100) * 10);
      say('其餘 ×10 = ' + (prev - o * 100) * 10, '每個字母升一級次方');
      await beat(tok, 1300);
      relabel(H, h); glow(T.cs[s + 2], GREEN);
      say('加上 ' + t[s + 2] + '：+ ' + n + ' = ' + h, h === hp ? '命中！' : h + ' ≠ 421');
      await beat(tok, 1400);
    } else {
      relabel(H, h); glow(T.cs[s + 2], GREEN);
      say('(' + prev + ' − ' + o * 100 + ')·10 + ' + n + ' = ' + h, t.slice(s, s + 3) + (h === hp ? '：421 命中！' : ' ≠ 421'));
      await beat(tok, 1300);
    }
    tag(String(h), h === hp ? 'ptr alt' : 'ptr', T.at(s + 1), 0.2, s % 2 ? -0.4 : -0.9);
  }
  smOff(T.cs);
  for (let k = 0; k < 3; k++) { glow(T.cs[8 + k], GREEN); glow(P.cs[k], GREEN); await beat(tok, 450); }
  say('421 = 421：逐字確認 → 找到', '減、乘、加：每次 O(1)');
  await beat(tok, 3000);
}]);

// 20:27 總結＋溢位：mod 讓值留在範圍內，但 spurious hit 又會回來（mod 11 只是示範）
FRAG.push(['strm-rk-mod', 'Rabin fingerprint 與 mod', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const ws = ['cca', 'cac', 'acc', 'cca', 'caa', 'aae', 'aed', 'edb', 'dba'];
  const hv = ws.map((w) => rkV(w[0]) * 100 + rkV(w[1]) * 10 + rkV(w[2]));
  const cs = ws.map((w, k) => { tag(w, 'idx', -6 + k * 1.5, 0, -0.6); return cube(hv[k], k === 8 ? '#c08a1f' : '#cbbd9f', [1.3, 0.5, 0.8], -6 + k * 1.5, 0.25, -1.4, 2); });
  say('Rabin fingerprint：base 次方 + rolling', '平均 Θ(n − m + 1)');
  await beat(tok, 2600);
  say('仍可能撞：最壞還是 O(mn)', 'hash 相同 ≠ 字串相同');
  await beat(tok, 2400);
  say('m 大時 10^(m−1) 會溢位', '32-bit int：mod 2³¹（無號 2³²）');
  await beat(tok, 2800);
  say('取 mod 讓值留在範圍內', '示範用小模數：mod 11');
  await beat(tok, 2000);
  for (let k = 0; k < cs.length; k++) { relabel(cs[k], hv[k] + '→' + (hv[k] % 11)); move(cs[k], -6 + k * 1.5, 0.25, 1.4); await beat(tok, 420); }
  const target = hv[8] % 11;
  cs.forEach((c, k) => { if (hv[k] % 11 === target) glow(c, k === 8 ? GREEN : RED); });
  say('caa、edb 也變成 3：假命中回來了', '311、542、421 mod 11 都是 3');
  await beat(tok, 3200);
  say('核心：hash 相同才逐字比', '懂資料就能自己設計 hash');
  await beat(tok, 2600);
}]);

// ════════ -DwGrJ8JxDc（MIT 6.006 Rec 9b） ════════
// 00:57 p = 2^w 可以嗎？extended Euclid：b 與 p 互質 → 乘法反元素存在（數字為示範）
FRAG.push(['strm-mit-inverse', 'mod 2^w 的乘法反元素', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0]);
  const at = (k) => [Math.sin(k * Math.PI / 4) * 3, -Math.cos(k * Math.PI / 4) * 3];
  const ring = [];
  for (let k = 0; k < 8; k++) { const [x, z] = at(k); ring.push(cube(k, '#e8dcc4', [0.8, 0.4, 0.8], x, 0.2, z, 2)); }
  tag('mod 8', 'ptr', 0, 0.3, 0);
  say('rolling hash：h = K mod p', '上次說 p 取質數最好');
  await beat(tok, 2400);
  say('那 p = 2^w 可以嗎？', '示範：p = 2³ = 8');
  await beat(tok, 2400);
  const mk = cube('3·1', '#c08a1f', [0.6, 0.45, 0.6], 0, 1.0, -3);
  for (let x = 1; x <= 3; x++) {
    const k = (3 * x) % 8, [px, pz] = at(k);
    move(mk, px, 1.0, pz); relabel(mk, '3·' + x);
    if (x === 3) glow(ring[1], GREEN);
    say('3 × ' + x + ' mod 8 = ' + k, x === 3 ? '回到 1：反元素找到了' : 'b = 3 與 8 互質');
    await beat(tok, 1400);
  }
  say('extended Euclid：xb + yp = 1', '3·3 + (−1)·8 = 1 → xb ≡ 1 (mod p)');
  await beat(tok, 3000);
  glow(ring[1], null);
  for (let x = 1; x <= 4; x++) {
    const k = (2 * x) % 8, [px, pz] = at(k);
    move(mk, px, 1.0, pz); relabel(mk, '2·' + x); glow(ring[k], RED);
    say('若 b = 2：2 × ' + x + ' mod 8 = ' + k, 'gcd(2, 8) = 2：永遠到不了 1');
    await beat(tok, 1000);
  }
  say('b 與 2^w 互質，反元素就存在', '問題出在別的地方');
  await beat(tok, 2800);
}]);

// 03:03 好的 hash function：inputs ≫ outputs；h = 0 很糟；要「distribute」
FRAG.push(['strm-mit-goodhash', '好的 hash function：要分散', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  ['d₁', 'd₂', 'd₃', '…', 'd_L'].forEach((d, i) => cube(d, '#9b7ef4', [1.0, 0.5, 0.8], -2.8 + i * 1.4, 0.25, -3.0, 2));
  tag('K（base b = 2⁸）', 'ptr', -5.3, 0.3, -3.0);
  say('K 是 base b 的大數字', 'K = d₁ d₂ … d_L，b = 2⁸');
  await beat(tok, 2600);
  const xs = (k) => -3.5 + k * 1.0;
  for (let k = 0; k < 8; k++) { cube('', GRAY, [0.85, 0.1, 0.9], xs(k), 0.05, 1.6); tag(String(k), 'idx', xs(k), 0, 2.4); }
  tag('outputs（示意 8 格）', 'ptr alt', 0, 0.3, 3.2);
  say('h = K mod 2^w：outputs 只有 2^w 種', '一百萬字元 → 2^(8·10⁶) 種輸入');
  await beat(tok, 2800);
  say('inputs ≫ outputs', '一定會有 collision');
  await beat(tok, 2000);
  const HC = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
  const bad = [];
  for (let k = 0; k < 8; k++) { bad.push(cube('', HC[k], [0.6, 0.3, 0.6], xs(0), 0.3 + k * 0.32, 1.6, 3)); await beat(tok, 220); }
  say('h(K) = 0：全部擠在同一格', '搜尋、substring matching 都變慢');
  await beat(tok, 2600);
  bad.forEach((c) => fly(c));
  await beat(tok, 600);
  const order = [5, 2, 7, 0, 3, 6, 1, 4];
  for (let k = 0; k < 8; k++) { cube('', HC[k], [0.6, 0.3, 0.6], xs(order[k]), 0.3, 1.6, 3); await beat(tok, 300); }
  say('理想：看起來隨機、同輸入同輸出', '關鍵字：distribute（分散）');
  await beat(tok, 3200);
}]);

// 07:26 digit 全是偶數：base 10 類比 → base 256 → K mod 2^w 全偶數
FRAG.push(['strm-mit-evendigits', 'digit 全偶數 → hash 全偶數', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const d10 = ['3', '7', '4'].map((d, i) => cube(d, '#e8dcc4', [0.8, 0.5, 0.8], -5.6 + i * 0.95, 0.25, -3.0, 2));
  tag('base 10', 'ptr', -4.65, 0.3, -2.0);
  say('類比：base 10，而 10 是偶數', '例：374');
  await beat(tok, 2200);
  glow(d10[2], GREEN);
  say('末位偶數 → 整個數是偶數', '374 = 37·10 + 4');
  await beat(tok, 2600);
  const d256 = ['12', '200', '6', '34'].map((d, i) => cube(d, '#9b7ef4', [1.0, 0.5, 0.8], 0.6 + i * 1.3, 0.25, -3.0, 2));
  tag('base 256', 'ptr', 2.55, 0.3, -2.0);
  say('base 256 也是偶數，digit 全偶', 'd ≡ 0 (mod 2)（示範數字）');
  await beat(tok, 2600);
  glow(d256[3], GREEN);
  say('K = …·256 + 34 → K 是偶數', 'K mod 2³² 也是偶數');
  await beat(tok, 2800);
  const xs = (k) => -6 + k * 0.8, slots = [];
  for (let k = 0; k < 16; k++) { slots.push(cube('', k % 2 ? '#ead2c8' : GRAY, [0.7, 0.1, 0.9], xs(k), 0.05, 1.4)); tag(String(k), 'idx', xs(k), 0, 2.2); }
  tag('outputs（示意 16 格）', 'ptr alt', 0, 0.3, 3.0);
  const cnt = Array(16).fill(0);
  for (const v of [2, 10, 6, 14, 0, 8, 4, 12, 6, 2]) { cube('', '#4b9ee2', [0.55, 0.28, 0.6], xs(v), 0.25 + cnt[v] * 0.3, 1.4, 3); cnt[v]++; await beat(tok, 260); }
  say('hash 只會落在偶數格', 'outputs 的一半');
  await beat(tok, 2400);
  slots.forEach((s, k) => { if (k % 2) glow(s, RED); });
  say('奇數那一半：absolutely no love', '永遠沒有 hash 落進去');
  await beat(tok, 3000);
}]);

// 11:35 真實資料不隨機：低位元相同；mod 2^w = 截掉高位，快但差（數字為示範）
FRAG.push(['strm-mit-lowbits', 'mod 2^w 只看低位元', async (tok) => {
  fresh([0, 9, 9.5], [0, 0, 0.3]);
  const vals = [180, 100, 220], rows = [];
  vals.forEach((v, r) => {
    const bits = v.toString(2).padStart(8, '0'), z = -3.0 + r * 1.0;
    rows.push([...bits].map((b, k) => cube(b, b === '1' ? '#4b9ee2' : '#e8dcc4', [0.52, 0.4, 0.7], -6 + k * 0.6, 0.2, z, 2)));
    tag(String(v), 'ptr', -6.8, 0.3, z);
  });
  say('真實資料不隨機：例如相機像素', '雜訊讓最後幾個 bit 都一樣');
  await beat(tok, 2600);
  rows.forEach((row) => row.slice(5).forEach((c) => glow(c, GOLD)));
  say('三個值的低 3 bit 都是 100', '180、100、220（示範數字）');
  await beat(tok, 2800);
  rows.forEach((row) => row.slice(0, 5).forEach((c) => tint(c, GRAY)));
  say('mod 2³ = 只留低 3 bit', '截掉高位：算起來很快');
  await beat(tok, 2400);
  const xs = (k) => 1.0 + k * 0.75;
  for (let k = 0; k < 8; k++) { cube('', GRAY, [0.65, 0.1, 0.8], xs(k), 0.05, -2.0); tag(String(k), 'idx', xs(k), 0, -1.35); }
  tag('mod 8', 'ptr alt', 3.6, 0.3, -3.0);
  for (let r = 0; r < 3; r++) { cube(vals[r], '#dd8238', [0.62, 0.3, 0.6], xs(4), 0.25 + r * 0.32, -2.0, 3); await beat(tok, 400); }
  say('三個全進第 4 格：collision', '輸入的規律原封不動留在 output');
  await beat(tok, 2600);
  for (let k = 0; k < 7; k++) { cube('', GRAY, [0.65, 0.1, 0.8], xs(k), 0.05, 1.5); tag(String(k), 'idx', xs(k), 0, 2.15); }
  tag('mod 7（質數）', 'ptr alt', 3.6, 0.3, 2.9);
  for (let r = 0; r < 3; r++) { cube(vals[r], '#2fc092', [0.62, 0.3, 0.6], xs(vals[r] % 7), 0.25, 1.5, 3); await beat(tok, 400); }
  say('改 mod 質數 7：分散開了', '180→5、100→2、220→3');
  await beat(tok, 2600);
  say('mod 2^w 較快，但 hash 較差', '實務上好的 hash 整體更快（cache）');
  await beat(tok, 3000);
}]);

// 13:41 PSet：dnaseq.py 要自己寫；rolling hash 的 append / skip / slide（A,C,G,T = 0,2,4,6、base 8、mod 13 沿用本章慣例）
FRAG.push(['strm-mit-slide', 'Rolling hash API：append、skip、slide', async (tok) => {
  fresh([0, 8, 10], [0, 0, 0]);
  const s = 'GATTACAG', D = { A: 0, C: 2, G: 4, T: 6 }, b = 8, q = 13, bk = (b * b) % q;
  const T = smRow(s, -1.8, { cw: 1.1 });
  tag('dnaseq.py：唯一要交的檔', 'ptr alt', 0, 0.3, -3.3);
  const W = ghostBox('#c08a1f', 1.1, 0.9, 1.2);
  const H = cube('h = 0', '#cbbd9f', [2.4, 0.6, 1.0], 0, 0.3, 1.6, 2.5);
  say('subsequence_hashes 都靠 rolling hash', 'A, C, G, T = 0, 2, 4, 6；b = 8、mod 13');
  await beat(tok, 2800);
  let h = 0;
  const show = (lo, len) => { W.scale.x = len; W.position.set(T.at(lo) + (len - 1) * 1.1 / 2, 0.45, -1.8); };
  for (let k = 0; k < 3; k++) {
    h = (h * b + D[s[k]]) % q; show(0, k + 1); relabel(H, 'h = ' + h); glow(T.cs[k], GREEN);
    say('append(' + s[k] + ')：右邊加一個字元', 'h = (h·b + ' + D[s[k]] + ') mod 13 = ' + h);
    await beat(tok, 1500);
  }
  smOff(T.cs);
  h = ((h - D[s[0]] * bk) % q + q) % q; show(1, 2); relabel(H, 'h = ' + h); glow(T.cs[0], RED);
  say('skip(G)：去掉最左邊', 'h = (h − 4·b²) mod 13 = ' + h);
  await beat(tok, 1800);
  h = (h * b + D[s[3]]) % q; show(1, 3); relabel(H, 'h = ' + h); glow(T.cs[3], GREEN);
  say('append(T)：又回到長度 3', 'h = ' + h);
  await beat(tok, 1600);
  smOff(T.cs);
  say('這次 PSet 只要 slide(old, new)', 'slide = skip(old) + append(new)');
  await beat(tok, 2600);
  for (let lo = 2; lo + 3 <= s.length; lo++) {
    const o = s[lo - 1], n = s[lo + 2];
    h = ((((h - D[o] * bk) % q + q) % q) * b + D[n]) % q;
    smOff(T.cs); show(lo, 3); relabel(H, 'h = ' + h); glow(T.cs[lo - 1], RED); glow(T.cs[lo + 2], GREEN);
    say('slide(' + o + ', ' + n + ')', 'h = ' + h + '：一步 O(1)');
    await beat(tok, 1300);
  }
  smOff(T.cs);
  say('slide 就是上次拆開前的那份程式', '不用再推導一次');
  await beat(tok, 2600);
}]);

// 16:06 kfasta.py：不把整個檔案讀成 list，用 iterator；next / StopIteration / iter / for-in
FRAG.push(['strm-mit-iterator', 'Iterator：一次給一個', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const f = 'GATTACAGGT';
  const F = smRow(f, -3.0, { cw: 0.9, idx: false });
  tag('FASTA 檔', 'ptr', -5.6, 0.3, -3.0);
  const mem = ghostBox('#4b9ee2', 3.2, 1.4, 1.8); mem.position.set(-3.5, 0.7, 1.2);
  tag('記憶體', 'idx', -3.5, 0, 2.4);
  say('docdist 的作法：整個檔案讀進 list', 'L = 檔案全部內容');
  await beat(tok, 2200);
  const copies = [];
  for (let k = 0; k < f.length; k++) {
    const c = cube(f[k], smC(f[k]), [0.5, 0.4, 0.5], F.at(k), 0.25, -3.0); copies.push(c);
    const x = k < 6 ? -4.6 + (k % 3) * 1.0 : -1.2 + (k - 6) * 0.6, z = k < 6 ? 0.8 + Math.floor(k / 3) * 0.8 : 0.6 + (k % 2) * 0.9;
    move(c, x, 0.3, z);
    if (k === 6) tint(mem, '#c84a4a');
    await beat(tok, 260);
  }
  say('大檔案：記憶體放不下 → crash', 'DNA 序列非常大');
  await beat(tok, 2600);
  copies.forEach((c) => fly(c)); tint(mem, '#4b9ee2');
  await beat(tok, 600);
  tag('使用端', 'ptr alt', 3.6, 0.3, 2.3);
  const cur = tag('next()', 'ptr', F.at(0), 1.0, -3.0);
  say('改用 iterator：要一個才給一個', 'next()：回傳下一個元素');
  await beat(tok, 2000);
  for (let k = 0; k < 4; k++) {
    cur.position.set(F.at(k), 1.0, -3.0);
    const c = cube(f[k], smC(f[k]), [0.5, 0.4, 0.5], F.at(k), 0.25, -3.0);
    move(c, 3.6, 0.3, 1.2);
    say('next() → ' + f[k], '記憶體只放 O(1) 個');
    await beat(tok, 900);
    fly(c);
  }
  cur.position.set(F.at(9) + 0.9, 1.0, -3.0);
  tag('StopIteration', 'ptr alt', 3.6, 1.2, 1.2);
  say('到結尾：raise StopIteration', '表示沒有下一個了');
  await beat(tok, 2400);
  say('for x in L：先 iter(L)、再一直 next()', 'for 自動接住 StopIteration');
  await beat(tok, 3000);
}]);

// 20:59 reverse iterator：[1, 2, 3, 4] → 4, 3, 2, 1，只記 index（O(1) 記憶體）
FRAG.push(['strm-mit-reverse', 'Reverse iterator：O(1) 記憶體', async (tok) => {
  fresh([0, 8, 9.5], [0, 0, 0]);
  const xs = (k) => -2.25 + k * 1.5;
  const L = [1, 2, 3, 4].map((v, k) => { tag('[' + k + ']', 'idx', xs(k), 0, -0.8); return cube(v, colorFor(v), [1.0, 0.6, 0.9], xs(k), 0.3, -1.6, 2); });
  tag('L', 'ptr', -4.0, 0.3, -1.6); tag('next() 輸出', 'ptr alt', -4.4, 0.3, 1.8);
  say('reverse：L = [1, 2, 3, 4]', '要 4, 3, 2, 1，但不建新 list');
  await beat(tok, 2600);
  const ip = tag('i = 3', 'ptr', xs(3), 1.2, -1.6);
  for (let r = 0; r < 4; r++) {
    const k = 3 - r;
    ip.position.set(xs(k), 1.2, -1.6); txt(ip, 'i = ' + k);
    glow(L[k], GOLD);
    const c = cube(k + 1, colorFor(k + 1), [1.0, 0.6, 0.9], xs(k), 0.3, -1.6);
    move(c, xs(r), 0.3, 1.8);
    say('next() → L[' + k + '] = ' + (k + 1), '只記住 index i：O(1)');
    await beat(tok, 1800);
    glow(L[k], null);
  }
  ip.position.set(xs(0) - 1.4, 1.2, -1.6); txt(ip, 'i = −1');
  say('i < 0：StopIteration', '另建反轉 list 要 O(n) 記憶體');
  await beat(tok, 2600);
  say('iterator 只能往前', '要重來：再呼叫一次 iter()');
  await beat(tok, 2800);
}]);

// 23:00 generator：list 版（L.append、return L）→ 改成 yield，記憶體 O(1)
FRAG.push(['strm-mit-genlist', 'List 版 vs generator 版', async (tok) => {
  fresh([0, 8.5, 10], [0.5, 0.8, 0]);
  const A = code(['def subseq_hashes(seq, k):', '    L = []', '    for h in rolling(seq, k):', '        L.append(h)', '    return L'], -3.3, 3.0, 0.56, -1.0);
  say('list 版：每個 hash 都存起來', '第 2 好的寫法（最差是暴力法）');
  A.hl(1);
  await beat(tok, 2200);
  const items = [];
  for (let k = 0; k < 8; k++) {
    A.hl(k % 2 ? 3 : 2);
    items.push(cube('h' + '₀₁₂₃₄₅₆₇'[k], '#4b9ee2', [0.52, 0.45, 0.6], 1.2 + k * 0.6, 0.25, -1.0, 2));
    await beat(tok, 330);
  }
  A.hl(4);
  say('序列很長 → list 巨大', 'return L：記憶體 O(n)');
  await beat(tok, 2600);
  A.kill(); items.forEach((c) => fly(c));
  const B = code(['def subseq_hashes(seq, k):', '    for h in rolling(seq, k):', '        yield h'], -3.3, 3.0, 0.56, -1.0);
  say('拿掉 L，append 換成 yield', '就變成 generator');
  B.hl(2);
  await beat(tok, 2600);
  tag('使用端', 'ptr alt', 5.0, 0.3, 1.8);
  for (let k = 0; k < 4; k++) {
    B.hl(1); await beat(tok, 300); B.hl(2);
    const c = cube('h' + '₀₁₂₃'[k], '#2fc092', [0.52, 0.45, 0.6], 1.2, 0.25, 1.0, 2);
    move(c, 5.0, 0.25, 1.0);
    say('yield h：一次交出一個', '記憶體 O(1)');
    await beat(tok, 900);
    fly(c);
  }
  say('用法不變：for h in subseq_hashes(…)', '只要你要的是 iterator');
  await beat(tok, 2800);
}]);

// 26:06 yield 怎麼運作：函式「凍結」在盒子裡，next() 解凍跑到下一個 yield
FRAG.push(['strm-mit-yield', 'yield：凍結與解凍', async (tok) => {
  fresh([0, 8.5, 10], [0, 1.0, 0]);
  const C = code(['def gen(seq):', '    for e in seq:', '        yield e', '    # 結束 → StopIteration'], -3.2, 2.8, 0.56, -2.0);
  const box = ghostBox('#4b9ee2', 4.6, 2.6, 0.8); box.position.set(-3.2, 1.9, -2.0);
  const st = tag('凍結中', 'ptr', -3.2, 3.5, -2.0);
  tag('呼叫端', 'ptr alt', 3.6, 0.3, 2.2);
  say('it = gen(seq)：函式還沒開始跑', '回傳一個 iterator');
  await beat(tok, 2600);
  const vals = ['e₀', 'e₁'];
  for (let k = 0; k < 2; k++) {
    tint(box, '#2fc092'); txt(st, '執行中');
    C.hl(1);
    say('next(it)：解凍，往下跑', k ? '從上次 yield 的下一行繼續' : '跑到第一個 yield');
    await beat(tok, 1300);
    C.hl(2);
    const c = cube(vals[k], '#dd8238', [0.8, 0.5, 0.7], -1.5, 1.7, -2.0);
    move(c, 3.6 - k * 1.0, 0.3, 1.2);
    tint(box, '#4b9ee2'); txt(st, '凍結中');
    say('yield ' + vals[k] + '：交出去，再凍住', 'next() 的回傳值 = ' + vals[k]);
    await beat(tok, 1900);
  }
  say('狀態全部保留', '迴圈跑到哪、變數多少都記得');
  await beat(tok, 2200);
  tint(box, '#2fc092'); txt(st, '執行中'); C.hl(3);
  await beat(tok, 900);
  tint(box, '#c84a4a'); txt(st, '結束');
  tag('StopIteration', 'ptr alt', 3.6, 1.2, 2.2);
  say('迴圈結束、函式 return', '再 next() → raise StopIteration');
  await beat(tok, 2600);
  say('yield 就像「print 到 iterator」', '不用自己寫 __next__、__iter__');
  await beat(tok, 2800);
}]);

// 32:13 generator 問答：generator 套 generator；無限序列（Fibonacci）沒有 len
FRAG.push(['strm-mit-geninf', 'Generator 串接與無限序列', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  tag('fib()', 'ptr', -6.2, 0.3, -1.8); tag('evens(fib())', 'ptr alt', -5.6, 0.3, 1.6);
  say('generator 也可以吃 generator', 'evens(fib())：一層包一層');
  await beat(tok, 2600);
  const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34];
  let out = 0;
  for (let k = 0; k < fib.length; k++) {
    const v = fib[k], x = -4.6 + k * 1.2;
    const c = cube(v, colorFor(v), [0.9, 0.5, 0.8], x, 0.25, -1.8, 2.5);
    if (v % 2) { say('外層要一個 → 內層給 ' + v, '奇數：再拉下一個'); await beat(tok, 750); continue; }
    glow(c, GREEN);
    const o = cube(v, colorFor(v), [0.9, 0.5, 0.8], x, 0.25, -1.8);
    move(o, -2.6 + out * 2.0, 0.25, 1.6); out++;
    say('外層 next() → ' + v, '偶數：交出去');
    await beat(tok, 1300);
  }
  tag('…', 'ptr', 6.2, 0.3, -1.8);
  say('fib() 永遠不會結束', '無限序列：沒有 len()');
  await beat(tok, 2600);
  say('想知道幾個？只能一直 next()', 'for 迴圈接住 StopIteration 才停');
  await beat(tok, 2800);
}]);

// 37:43 subsequence_hashes / interval 版（step）；回傳 (i₁, i₂) tuple（序列為示範）
FRAG.push(['strm-mit-subseq', 'Subsequence hashes 與 (i₁, i₂)', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const s1 = 'GATTACA', s2 = 'TACAGAT', k = 3;
  const A = smRow(s1, -2.6, { cw: 1.0 }), B = smRow(s2, 0.4, { cw: 1.0 });
  tag('seq 1', 'ptr', -4.8, 0.3, -2.6); tag('seq 2', 'ptr alt', -4.8, 0.3, 0.4);
  say('每個長度 k 的子序列算 hash', 'k = 3（示範序列）');
  await beat(tok, 2200);
  const W1 = ghostBox('#c08a1f', 3.0, 0.9, 1.2), W2 = ghostBox('#4b9ee2', 3.0, 0.9, 1.2);
  W2.visible = false;
  const table = {};
  for (let i = 0; i + k <= s1.length; i++) {
    W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6); table[s1.slice(i, i + k)] = i;
    say(s1.slice(i, i + k) + ' @ ' + i, 'rolling hash 一格一格滑');
    await beat(tok, 650);
  }
  W1.visible = false;
  say('seq 2 的每個視窗去查', 'hash 相同 → 記下 (i₁, i₂)');
  await beat(tok, 2000);
  let n = 0;
  for (let j = 0; j + k <= s2.length; j++) {
    const w = s2.slice(j, j + k), i = table[w];
    W2.visible = true; W2.position.set(B.at(j + 1), 0.45, 0.4);
    if (i === undefined) { say(w + '：seq 1 沒有', '跳過'); await beat(tok, 900); continue; }
    W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6);
    for (let d = 0; d < k; d++) { glow(A.cs[i + d], GREEN); glow(B.cs[j + d], GREEN); }
    cube('(' + i + ', ' + j + ')', '#c08a1f', [1.7, 0.45, 0.7], -3.0 + n * 2.3, 0.25, 2.9, 2.5); n++;
    say(w + '：seq 1 的 ' + i + '、seq 2 的 ' + j, '(' + i + ', ' + j + ')');
    await beat(tok, 1500);
    smOff(A.cs, B.cs); W1.visible = false;
  }
  W2.visible = false;
  say('結果：一串 (i₁, i₂) tuple', '同一段可配到多個位置');
  await beat(tok, 2200);
  for (const i of [0, 2, 4]) {
    W1.visible = true; W1.position.set(A.at(i + 1), 0.45, -2.6);
    say('interval 版：range 加 step', 'step = 2 → 位置 0, 2, 4');
    await beat(tok, 750);
  }
  say('別整段複製貼上：保持 DRY', 'Don’t Repeat Yourself');
  await beat(tok, 2800);
}]);

// 41:01 比對結果畫成圖：每個 (i₁, i₂) 一個點；相同序列 → 對角線（示範用 k = 2）
FRAG.push(['strm-mit-dotplot', '比對圖：對角線＝共同子序列', async (tok) => {
  fresh([0, 10, 7], [0, 0, 0.3]);
  const win = (s) => [...Array(s.length - 1)].map((_, i) => s.slice(i, i + 2));
  const r1 = win('GATTACA');
  const X = (c) => -2.5 + c * 1.0, Z = (r) => -2.5 + r * 1.0;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', GRAY, [0.9, 0.08, 0.9], X(c), 0.04, Z(r));
  r1.forEach((w, r) => tag(w, 'idx', -3.6, 0, Z(r)));
  const colL = r1.map((w, c) => tag(w, 'idx', X(c), 0, -3.5));
  tag('seq 1', 'ptr', -4.9, 0.3, 0); const cl = tag('seq 1（自己）', 'ptr alt', 0, 0.3, -4.3);
  say('每個 (i₁, i₂) 畫成一個點', '示範：k = 2 的子序列');
  await beat(tok, 2400);
  let dots = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (r1[r] === r1[c]) { dots.push(cube('', '#3a2f10', [0.55, 0.3, 0.55], X(c), 0.25, Z(r), 2)); await beat(tok, 300); }
  say('同一條序列和自己比', '一條完整的對角線');
  await beat(tok, 3200);
  dots.forEach((d) => kill(d)); dots = [];
  const r2 = win('TACAGA');
  colL.forEach((l, c) => txt(l, r2[c] || ''));
  txt(cl, 'seq 2 = TACAGA');
  say('換成另一條序列', 'seq 2 = TACAGA');
  await beat(tok, 1800);
  for (let r = 0; r < 6; r++) for (let c = 0; c < r2.length; c++) if (r1[r] === r2[c]) { dots.push(cube('', '#3a2f10', [0.55, 0.3, 0.55], X(c), 0.25, Z(r), 2)); await beat(tok, 400); }
  [[3, 0], [4, 1], [5, 2]].forEach(([r, c]) => dots.forEach((d) => { if (d.position.x === X(c) && d.position.z === Z(r)) glow(d, GREEN); }));
  say('斜線段 = 一段共同子序列', 'TACA：(3,0) (4,1) (5,2)');
  await beat(tok, 3200);
  say('另一點 (0, 4)：GA 單獨配到', '越長的斜線 = 越長的共同片段');
  await beat(tok, 2600);
}]);

// 43:58 amortized：list 是 array（index O(1)）；append 滿了就開 2 倍、複製舊元素
FRAG.push(['strm-mit-append', 'Append：滿了就加倍', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const xs = (i) => -6 + i * 0.8;
  const mk = (n, z) => [...Array(n)].map((_, i) => cube('', GRAY, [0.72, 0.12, 0.9], xs(i), 0.06, z));
  let rowZ = -1.5, cap = 1, slots = mk(1, rowZ);
  const els = [];
  const capT = tag('size 1', 'ptr', 0, 0.3, -3.2);
  say('Python list 存成 array', 'L[i] 直接算位置：O(1)；linked list 要 O(i)');
  await beat(tok, 2600);
  say('append：放到最後一格', '滿了怎麼辦？');
  await beat(tok, 2000);
  for (let k = 1; k <= 9; k++) {
    let grew = false;
    if (els.length === cap) {
      const nz = rowZ < 0 ? 1.3 : -1.5, ns = mk(cap * 2, nz);
      say('滿了：開一個 2 倍大的新 array', 'size ' + cap + ' → ' + cap * 2);
      await beat(tok, 1300);
      els.forEach((c, i) => move(c, xs(i), 0.4, nz));
      say('複製 ' + cap + ' 個舊元素', '這一步 O(n)');
      await beat(tok, 1400);
      slots.forEach(kill); slots = ns; rowZ = nz; cap *= 2; txt(capT, 'size ' + cap); grew = true;
    }
    els.push(cube(k, colorFor(k), [0.62, 0.5, 0.75], xs(els.length), 0.4, rowZ, 2.5));
    say('append(' + k + ')', grew ? '放進去：O(1)' : '有空位：O(1)');
    await beat(tok, 900);
  }
  say('配置記憶體假設 O(1)，複製才貴', '最壞一次 append：O(n)');
  await beat(tok, 3000);
}]);

// 49:50 逐行分析 O(n²)（正確但不緊）vs amortized O(1)／次
const amCost = (k) => (k > 1 && ((k - 1) & (k - 2)) === 0 ? k : 1);
FRAG.push(['strm-mit-linebyline', '逐行分析 O(n²) vs amortized', async (tok) => {
  fresh([0, 7, 11], [0, 1.5, 0]);
  const xs = (i) => -6 + i * 0.8, n = 16;
  for (let i = 0; i < n; i++) tag(String(i + 1), 'idx', xs(i), 0, 0.7);
  say('n 次 append 的總成本？', 'for i in 1..n: L.append(i)');
  await beat(tok, 2400);
  const gs = [];
  for (let i = 0; i < n; i++) { const g = ghostBox('#c84a4a', 0.62, n * 0.3, 0.62); g.position.set(xs(i), n * 0.15, 0); gs.push(g); await beat(tok, 110); }
  say('逐行分析：一次最壞 O(n)', 'n 次 × O(n) = O(n²)');
  await beat(tok, 2800);
  say('O(n²) 沒錯，但不是 tight bound', '題目通常要最緊的界');
  await beat(tok, 2600);
  for (let i = 0; i < n; i++) { const c = amCost(i + 1); cube(c, c > 1 ? '#dd8238' : '#4b9ee2', [0.6, c * 0.3, 0.6], xs(i), c * 0.15, 0, 1.5); await beat(tok, 150); }
  say('實際：大多數 append 只花 1', '只有擴充那幾次大');
  await beat(tok, 2600);
  gs.forEach(kill);
  say('amortized：每次 O(1)', 'n 次 append 共 O(n)');
  await beat(tok, 3000);
}]);

// 53:56 aggregate analysis：插入 n + 複製 1 + 2 + 4 + 8 … → O(n)
FRAG.push(['strm-mit-aggregate', 'Aggregate analysis：加總成本', async (tok) => {
  fresh([0, 8, 10.5], [0, 0.6, 0]);
  const xs = (i) => -6 + i * 0.8, n = 16, ins = [], cps = [];
  for (let i = 0; i < n; i++) tag(String(i + 1), 'idx', xs(i), 0, 0.7);
  say('aggregate：把 n 次成本加起來', 'n = 16，size 1, 2, 4, 8, 16');
  await beat(tok, 2400);
  for (let i = 0; i < n; i++) {
    const c = amCost(i + 1);
    ins.push(cube('', '#4b9ee2', [0.55, 0.3, 0.55], xs(i), 0.17, 0, 1.5));
    for (let u = 1; u < c; u++) cps.push(cube('', '#dd8238', [0.55, 0.3, 0.55], xs(i), 0.17 + u * 0.34, 0));
    await beat(tok, 150);
  }
  cps.forEach((c) => glow(c, GOLD));
  say('只有 size 用完時才複製', '倍增：1, 2, 4, 8 個');
  await beat(tok, 2600);
  ins.forEach((c, k) => move(c, -6 + (k % 8) * 0.62, 0.17, 2.0 + Math.floor(k / 8) * 0.62));
  cps.forEach((c, k) => move(c, 1.0 + (k % 8) * 0.62, 0.17, 2.0 + Math.floor(k / 8) * 0.62));
  tag('插入 16', 'ptr', -3.8, 0.3, 3.6); tag('複製 15', 'ptr alt', 3.2, 0.3, 3.6);
  say('插入 n = 16，複製 1+2+4+8 = 15', '複製總和 < 2n');
  await beat(tok, 2800);
  say('總和 31 < 3n → O(n)', '每次 append：amortized O(1)');
  await beat(tok, 3000);
  say('另一種：accounting method', 'CLRS amortized analysis 那章');
  await beat(tok, 2600);
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
