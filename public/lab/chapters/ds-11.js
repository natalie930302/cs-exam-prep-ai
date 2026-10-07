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
    yield { cap: 'A, C, G, T 編成 0, 2, 4, 6；base b = ' + b + '，mod ' + q, f: 'hash(pattern「' + p + '」) = ' + hp, ms: 2400 };
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
    sceneOrder: ['naive-slide', 'failure-function', 'kmp-jump', 'kmp-vs-naive', 'bm-bad-character', 'bm-good-suffix', 'rolling-hash', 'mod-2w-even-hash'],
    stop() { clearTimeout(timer); epoch++; },
  };
}
