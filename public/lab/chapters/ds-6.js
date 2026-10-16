// 資料結構 第6章：雜湊表 Hash Table（雜湊函數、Chaining、Open Addressing、刪除、Rehashing）。
// 影片「Hashing - Collision Resolution with Linear Probing」的例子直接拿來用：
//   h(x) = x mod 10，10,20,30,40,50（chaining 對照 open addressing）；
//   89,18,49,58,9（linear probing，find 58 = 4 probes、find 19 = 5 probes）；
//   表大小 11：20,30,2,13,25,24,10,9（平均成功搜尋 15/8，看群聚）。
// 探測序列採影片／Weiss 的寫法：h_i(x) = (hash(x) + f(i)) mod m，f(0) = 0。
//   linear f(i) = i；quadratic f(i) = i²；double f(i) = i·hash2(x)，hash2(x) = R − (x mod R)，R 取小於 m 的最大質數。
//   另附 Horowitz 的 ±i² 版本（h, h+1², h−1², h+2², h−2², …；m 為 4j+3 型質數時能走遍整張表）。
import kit from './_kit.js';

export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat, block, tile } = ctx;

  const isPrime = (x) => { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };
  const prevPrime = (x) => { for (let y = x - 1; y >= 2; y--) if (isPrime(y)) return y; return 2; };
  const nextPrime = (x) => { let y = x; while (!isPrime(y)) y++; return y; };
  const EMI = { cur: '#6a5200', bad: '#6a1414', ok: '#0f5a32' };
  const VID_CHAIN = [10, 20, 30, 40, 50];
  const VID_LP = [89, 18, 49, 58, 9];
  const VID_CLUSTER = [20, 30, 2, 13, 25, 24, 10, 9];
  const WEISS_REHASH = [13, 15, 6, 24, 23];

  let gen = 0, sceneTok = null, busy = false;
  async function W(ms) {
    const g = gen;
    if (sceneTok !== null) await beat(sceneTok, ms); else await sleep(ms);
    if (g !== gen) throw new Error('stale');
  }
  function run(fn) {
    return async () => {
      if (busy) { log('動畫還在跑，等它做完再按。', true); return; }
      busy = true;
      const g = gen;
      try { await fn(); } catch (e) { if (e.message !== 'stale') console.error(e); } finally { if (g === gen) busy = false; }
    };
  }
  function fresh(cam, look) { gen++; busy = false; lab.clear(); lab.frameCamera(cam, look); }
  const num = (id) => { const v = Number($(id).value); return Number.isFinite(v) ? Math.floor(v) : NaN; };
  const glow = (b, col) => { if (b && b.obj.material.emissive) b.obj.material.emissive.set(col || '#000000'); };

  // ───────────────────────── 1) 雜湊函數 ─────────────────────────
  const F = { method: 'div', m: 13, stacks: [], key: 4567, r: 2, fkey: '12320324111220', p: 3, fold: 'shift' };
  const DX = 0.68;
  function enterFn() {
    fresh([0, 6, 13], [0, 2.8, 0]);
    const ms = { div: '除法 h(k) = k mod m', mid: '中間平方法', shift: '折疊法：移位折疊', boundary: '折疊法：邊界折疊' };
    let html = '<select id="fM">' + Object.keys(ms).map((k) => '<option value="' + k + '">' + ms[k] + '</option>').join('') + '</select>';
    if (F.method === 'div') {
      html += '<label>k <input id="fK" type="number" min="0" value="23" style="width:70px"></label><label>m <input id="fMm" type="number" min="2" max="13" value="' + F.m + '" style="width:50px"></label>'
        + '<button class="primary" id="fDrop">丟入 k</button><button id="fSeq">丟入 10,20,…,80</button><button id="fClr">清空</button>';
    } else if (F.method === 'mid') {
      html += '<label>k <input id="fK" type="number" min="1" max="99999" value="' + F.key + '" style="width:80px"></label><label>取中間 r 位 <input id="fR" type="number" min="1" max="4" value="' + F.r + '" style="width:44px"></label><button class="primary" id="fGo">計算</button>';
    } else {
      html += '<input id="fK" style="width:150px" value="' + F.fkey + '"><label>每段 <input id="fP" type="number" min="2" max="4" value="' + F.p + '" style="width:44px"> 位</label><button class="primary" id="fGo">折疊</button>';
    }
    controls(html);
    $('fM').value = F.method;
    $('fM').onchange = (e) => { F.method = e.target.value; clearLog(); enterFn(); };
    if (F.method === 'div') {
      buildDivRow();
      on('fDrop', run(async () => { const k = num('fK'); if (!(k >= 0)) { log('k 要是非負整數。', true); return; } await divDrop(k); }));
      on('fSeq', run(async () => { for (let k = 10; k <= 80; k += 10) await divDrop(k, true); log(F.m === 10 ? '全部撞在 [0]！m = 10 只看個位數，key 的規律直接變成碰撞。' : '換成 m = 10 再試一次，比比看。'); }));
      on('fClr', () => { clearLog(); enterFn(); });
      $('fMm').onchange = () => { F.m = Math.max(2, Math.min(13, num('fMm') || 13)); clearLog(); enterFn(); };
      log('除法：h(k) = k mod m。m 最好選質數，不要選 2 或 10 的次方（否則只看到 key 的最後幾位）。');
      divState(null);
    } else if (F.method === 'mid') {
      on('fGo', run(async () => { F.key = Math.max(1, Math.min(99999, num('fK') || 1)); F.r = Math.max(1, Math.min(4, num('fR') || 2)); await midSquare(); }));
      log('中間平方法：把 k 平方，取中間 r 位當位址（表大小 10ʳ）。中間幾位受 k 的每一位影響，分布比較平均。');
      setState('中間平方法', [['k', String(F.key)], ['r', String(F.r)]], '按「計算」');
    } else {
      F.fold = F.method;
      on('fGo', run(async () => {
        const s = String($('fK').value).replace(/\D/g, '').slice(0, 16);
        if (s.length < 2) { log('請輸入至少 2 位數字。', true); return; }
        F.fkey = s; F.p = Math.max(2, Math.min(4, num('fP') || 3)); await folding();
      }));
      log('洪逸／Horowitz 的例子：k = 12320324111220，每 3 位一段：123 | 203 | 241 | 112 | 20。');
      log(F.method === 'shift' ? '移位折疊（shift folding）：各段直接相加。' : '邊界折疊（boundary folding）：每隔一段反轉（像紙沿邊界摺回來），再相加。');
      setState(F.method === 'shift' ? '移位折疊' : '邊界折疊', [['k', F.fkey], ['每段', F.p + ' 位']], '按「折疊」');
    }
  }
  function divX(i) { const sp = Math.min(1.0, 12.5 / F.m); return (i - (F.m - 1) / 2) * sp; }
  function buildDivRow() {
    F.stacks = [];
    const sp = Math.min(1.0, 12.5 / F.m);
    for (let i = 0; i < F.m; i++) {
      tile(new THREE.Vector3(divX(i), 0.02, 0), sp * 0.9, 1.2);
      const l = lab.label('[' + i + ']', 'idx'); l.position.set(divX(i), 0.05, 1.0); lab.world.add(l);
      F.stacks.push([]);
    }
  }
  async function divDrop(k, fast) {
    const r = k % F.m, q = Math.floor(k / F.m);
    const sp = Math.min(1.0, 12.5 / F.m);
    const m = block(k, [sp * 0.85, 0.55, 0.9]);
    m.position.set(0, 7, 0);
    const b = lab.addBody(m);
    const lbl = lab.label(k + ' = ' + q + '·' + F.m + ' + ' + r, 'ptr');
    lbl.position.set(0, 6.2, 0); lab.world.add(lbl);
    lab.springTo(b, new THREE.Vector3(0, 5.2, 0));
    say(fast ? '' : 'h(' + k + ') = ' + k + ' mod ' + F.m + ' = ' + r, k + ' = ' + q + ' × ' + F.m + ' + <span class="ok">' + r + '</span>');
    await W(fast ? 350 : 900);
    lab.world.remove(lbl);
    const coll = F.stacks[r].length > 0;
    lab.dropTo(b, new THREE.Vector3(divX(r), 0.36 + F.stacks[r].length * 0.6, 0));
    F.stacks[r].push(k);
    log('h(' + k + ') = ' + k + ' mod ' + F.m + ' = ' + r + (coll ? '　← 碰撞（collision）：[' + r + '] 已經有 ' + F.stacks[r].slice(0, -1).join(', ') : ''), coll);
    divState(k);
    await W(fast ? 300 : 600);
  }
  function divState(k) {
    const used = F.stacks.filter((s) => s.length).length;
    const n = F.stacks.reduce((s, x) => s + x.length, 0);
    setState('除法 h(k) = k mod ' + F.m, [['m', F.m + (isPrime(F.m) ? '（質數）' : '（不是質數）')], ['已放入', String(n)], ['用到的格子', used + ' / ' + F.m], ['碰撞次數', String(n - used)]],
      (k === null ? '' : 'h(' + k + ') = ' + (k % F.m) + '<br>') + '同一格疊起來 = 碰撞，下一頁的 chaining／open addressing 就是在處理這件事');
  }
  function digitRow(str, y, z = 0, color) {
    const out = [];
    [...str].forEach((d, i) => {
      const m = block(d, [0.56, 0.56, 0.56], color || colorFor(Number(d)));
      const x = (i - (str.length - 1) / 2) * DX;
      m.position.set(x, y + 3, z);
      const b = lab.addBody(m);
      lab.dropTo(b, new THREE.Vector3(x, y, z));
      out.push(b);
    });
    return out;
  }
  async function midSquare() {
    lab.clear();
    const k = F.key, sq = String(k * k), r = Math.min(F.r, sq.length);
    const st = Math.floor((sq.length - r) / 2);
    const mid = sq.slice(st, st + r);
    const l1 = lab.label('k = ' + k, 'ptr'); l1.position.set(-5.6, 5.2, 0); lab.world.add(l1);
    digitRow(String(k), 5.2);
    log('k = ' + k);
    await W(900);
    const l2 = lab.label('k² = ' + sq, 'ptr'); l2.position.set(-5.6, 3.2, 0); lab.world.add(l2);
    const row = digitRow(sq, 3.2);
    log('k² = ' + k + ' × ' + k + ' = ' + sq + '（' + sq.length + ' 位）');
    await W(1100);
    for (let i = st; i < st + r; i++) {
      glow(row[i], '#6a5200');
      lab.springTo(row[i], row[i].target.clone().add(new THREE.Vector3(0, -1.6, 0)));
    }
    const l3 = lab.label('位址 = ' + mid, 'ptr alt'); l3.position.set(0, 0.6, 1.2); lab.world.add(l3);
    log('取中間 ' + r + ' 位（第 ' + (st + 1) + '～' + (st + r) + ' 位）→ 位址 ' + mid + '（表大小 10^' + r + '）');
    setState('中間平方法', [['k', String(k)], ['k²', sq], ['中間 ' + r + ' 位', mid]], 'h(k) = k² 的中間 r 位<br>實作上常用二進位取中間 r 個 bit（表大小 2ʳ），這裡用十進位比較好看');
    say('取 k² 的中間 ' + r + ' 位', k + '² = ' + sq + ' → <span class="ok">' + mid + '</span>');
    await W(1200);
  }
  async function folding() {
    lab.clear();
    const s = F.fkey, p = F.p;
    const parts = [];
    for (let i = 0; i < s.length; i += p) parts.push(s.slice(i, i + p));
    const used = parts.map((x, i) => (F.fold === 'boundary' && i % 2 === 1 ? [...x].reverse().join('') : x));
    const sum = used.reduce((a, x) => a + Number(x), 0);
    const cols = Math.max(p, String(sum).length);
    const colX = (c) => (c - (cols - 1) / 2) * DX + 1.2;
    const lk = lab.label('k', 'ptr'); lk.position.set(-6.2, 6.0, 0); lab.world.add(lk);
    const all = digitRow(s, 6.0);
    log('k = ' + s + '，每 ' + p + ' 位一段：' + parts.join(' | '));
    say((F.fold === 'shift' ? '移位折疊' : '邊界折疊') + '：先切成每 ' + p + ' 位一段', parts.join(' | '));
    await W(1300);
    // 每一段往下排成直式加法（靠右對齊）
    const rowY = (r) => 4.9 - r * 0.8;
    parts.forEach((x, r) => {
      for (let d = 0; d < x.length; d++) {
        const b = all[r * p + d];
        lab.springTo(b, new THREE.Vector3(colX(cols - x.length + d), rowY(r), 0));
      }
    });
    await W(1200);
    if (F.fold === 'boundary') {
      say('邊界折疊：第 2、4、… 段反轉', used.join(' | '));
      parts.forEach((x, r) => {
        if (r % 2 === 0) return;
        for (let d = 0; d < x.length; d++) {
          const b = all[r * p + d];
          glow(b, '#6a5200');
          lab.springTo(b, new THREE.Vector3(colX(cols - x.length + (x.length - 1 - d)), rowY(r), 0.01));
        }
        log('第 ' + (r + 1) + ' 段 ' + x + ' 反轉成 ' + used[r]);
      });
      await W(1400);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(cols * DX + 0.3, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
    bar.position.set(colX((cols - 1) / 2), rowY(parts.length) + 0.4, 0); lab.world.add(bar);
    const plus = lab.label('+', 'ptr'); plus.position.set(colX(-1), rowY(parts.length - 1), 0); lab.world.add(plus);
    const sumStr = String(sum);
    [...sumStr].forEach((d, i) => {
      const m = block(d, [0.56, 0.56, 0.56], '#c08a1f');
      const x = colX(cols - sumStr.length + i);
      m.position.set(x, rowY(parts.length) + 3, 0);
      lab.dropTo(lab.addBody(m), new THREE.Vector3(x, rowY(parts.length) - 0.1, 0));
    });
    log(used.join(' + ') + ' = ' + sum + ' → 位址 ' + sum + '（表比較小時再 mod 表大小）');
    setState(F.fold === 'shift' ? '移位折疊' : '邊界折疊', [['k', s], ['分段', parts.join(' | ')], ['相加', used.join(' + ')], ['位址', String(sum)]],
      '移位：各段直接相加<br>邊界：偶數段（第 2、4…段）反轉後相加<br>例：移位 699、邊界 897');
    say('相加得到位址', used.join(' + ') + ' = <span class="ok">' + sum + '</span>');
    await W(1500);
  }

  // ───────────────────────── 2) Separate Chaining ─────────────────────────
  const C = { m: 10, buckets: [], front: true, arrows: [] };
  let cCursor;
  const cX = (i) => (i - (C.m - 1) / 2) * 1.2;
  const cPos = (i, j) => new THREE.Vector3(cX(i), 0.38, 3.0 - 1.15 * (j + 1));
  function enterChain(m) {
    fresh([0, 10, 10.5], [0, 0, -0.8]);
    if (m) C.m = m;
    C.buckets = Array.from({ length: C.m }, () => []); C.arrows = [];
    for (let i = 0; i < C.m; i++) {
      tile(new THREE.Vector3(cX(i), 0.02, 3.0), 1.0, 0.8, '#d9c7a4');
      const l = lab.label('[' + i + ']', 'idx'); l.position.set(cX(i), 0.05, 3.8); lab.world.add(l);
    }
    cCursor = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    cCursor.rotation.x = Math.PI / 2; cCursor.visible = false; lab.world.add(cCursor);
    controls('<label>k <input id="cK" type="number" min="0" value="60" style="width:70px"></label>'
      + '<button class="primary" id="cIns">insert</button><button id="cFind">search</button><button id="cDel">delete</button>'
      + '<button id="cVid">影片例 10…50</button><button id="cRand">隨機 6 個</button>'
      + '<select id="cWhere"><option value="front">插在串列前端</option><option value="tail">接在串列尾端</option></select>'
      + '<label>m <input id="cM" type="number" min="3" max="11" value="' + C.m + '" style="width:48px"></label>');
    $('cWhere').value = C.front ? 'front' : 'tail';
    $('cWhere').onchange = (e) => { C.front = e.target.value === 'front'; };
    $('cM').onchange = () => { clearLog(); enterChain(Math.max(3, Math.min(11, num('cM') || 10))); };
    on('cIns', run(async () => { const k = num('cK'); if (!(k >= 0)) { log('k 要是非負整數。', true); return; } await chainInsert(k); }));
    on('cFind', run(async () => { await chainSearch(num('cK')); }));
    on('cDel', run(async () => { await chainDelete(num('cK')); }));
    on('cVid', run(async () => { clearLog(); enterChain(10); busy = true; for (const k of VID_CHAIN) await chainInsert(k, true); busy = false; }));
    on('cRand', run(async () => { for (let t = 0; t < 6; t++) await chainInsert(Math.floor(Math.random() * 100), true); }));
    log('Separate chaining（open hashing）：每一格放一條 linked list，撞到同一格就串在一起。');
    log('影片的畫法是插在前端（O(1)），所以 10,20,30,40,50 會變成 50→40→30→20→10。');
    chainState('—');
  }
  function chainArrows(i) {
    C.arrows = C.arrows.filter((a) => { if (a.bucket === i) { lab.world.remove(a); return false; } return true; });
    const bk = C.buckets[i];
    for (let j = 0; j < bk.length; j++) {
      const from = j === 0 ? new THREE.Vector3(cX(i), 0.38, 3.0 - 0.4) : cPos(i, j - 1).add(new THREE.Vector3(0, 0, -0.45));
      const to = cPos(i, j).add(new THREE.Vector3(0, 0, 0.45));
      const dir = to.clone().sub(from);
      const a = new THREE.ArrowHelper(dir.clone().normalize(), from, Math.max(0.05, dir.length()), 0x6e5f49, 0.2, 0.14);
      a.bucket = i; lab.world.add(a); C.arrows.push(a);
    }
  }
  function chainLayout(i) { C.buckets[i].forEach((e, j) => lab.springTo(e.body, cPos(i, j))); chainArrows(i); }
  async function chainInsert(k, fast) {
    const i = k % C.m, bk = C.buckets[i];
    if (bk.some((e) => e.key === k)) { log(k + ' 已經在 [' + i + '] 的串列裡了。', true); return; }
    if (bk.length >= 7) { log('示範畫面放不下更長的串列（[' + i + '] 已有 7 個）。', true); return; }
    const m = block(k, [0.95, 0.56, 0.8]);
    m.position.copy(cPos(i, C.front ? 0 : bk.length)).setY(6);
    const b = lab.addBody(m);
    const e = { key: k, body: b };
    if (C.front) bk.unshift(e); else bk.push(e);
    say('h(' + k + ') = ' + k + ' mod ' + C.m + ' = ' + i, bk.length > 1 ? '碰撞 → 串進 [' + i + '] 的 list（' + (C.front ? '前端' : '尾端') + '）' : '');
    chainLayout(i);
    lab.dropTo(b, cPos(i, C.front ? 0 : bk.length - 1));
    log('insert ' + k + '：h = ' + k + ' mod ' + C.m + ' = ' + i + (bk.length > 1 ? '，碰撞，' + (C.front ? '插在前端' : '接在尾端') + '，串列長 ' + bk.length : ''));
    chainState('insert ' + k);
    await W(fast ? 600 : 900);
  }
  async function chainWalk(k) {
    const i = k % C.m, bk = C.buckets[i];
    let cmp = 0;
    log('search ' + k + '：h = ' + i + '，沿著 [' + i + '] 的串列一個一個比');
    cCursor.visible = true;
    for (let j = 0; j < bk.length; j++) {
      cmp++;
      cCursor.position.copy(cPos(i, j)).setY(0.05);
      glow(bk[j].body, bk[j].key === k ? EMI.ok : EMI.cur);
      await W(550);
      if (bk[j].key === k) { log('  第 ' + cmp + ' 次比較找到 ' + k); return { i, j, cmp }; }
      glow(bk[j].body);
    }
    cCursor.visible = false;
    log('  比了 ' + cmp + ' 次，走到 NULL → 不存在', true);
    return { i, j: -1, cmp };
  }
  async function chainSearch(k) {
    if (!(k >= 0)) { log('k 要是非負整數。', true); return; }
    const r = await chainWalk(k);
    say(r.j >= 0 ? '找到 ' + k + '：比較 ' + r.cmp + ' 次' : '找不到 ' + k + '：比較 ' + r.cmp + ' 次', '成功 ≈ 1 + α/2，失敗 ≈ α');
    chainState('search ' + k + '：比較 ' + r.cmp + ' 次');
    await W(900);
    cCursor.visible = false;
    if (r.j >= 0) glow(C.buckets[r.i][r.j].body);
  }
  async function chainDelete(k) {
    if (!(k >= 0)) { log('k 要是非負整數。', true); return; }
    const r = await chainWalk(k);
    cCursor.visible = false;
    if (r.j < 0) { chainState('delete ' + k + '：不存在'); return; }
    const [e] = C.buckets[r.i].splice(r.j, 1);
    lab.flyAway(e.body, new THREE.Vector3(0, 8, 4));
    chainLayout(r.i);
    log('  前一個的 link 改指向下一個，free 掉 ' + k + '（chaining 可以直接刪，不用墓碑）');
    chainState('delete ' + k);
    await W(700);
  }
  function chainState(op) {
    const n = C.buckets.reduce((s, b) => s + b.length, 0), a = n / C.m;
    const longest = Math.max(0, ...C.buckets.map((b) => b.length));
    setState('Separate Chaining（m = ' + C.m + '）', [['n / m', n + ' / ' + C.m], ['α = n/m', a.toFixed(2) + (a > 1 ? '（可以 > 1）' : '')], ['最長串列', String(longest)], ['剛才', op]],
      '期望比較次數：成功 ≈ 1 + α/2 = <span class="ok">' + (1 + a / 2).toFixed(2) + '</span>，失敗 ≈ α = ' + a.toFixed(2)
      + '<br>最壞：全部撞同一格 → O(n)（影片的 10…50 就是這樣）');
  }

  // ───────────────────────── 3) Open Addressing（含 rehash） ─────────────────────────
  const T = { m: 10, slots: [], method: 'linear', delMode: 'tomb', n: 0, tombs: 0, auto: false, threshold: 0.7, tableObjs: [], clusterObjs: [], tagObjs: [], last: '—', cursor: null };
  const METHOD_NAME = { linear: 'Linear probing', quad: 'Quadratic（+i²）', quadpm: 'Quadratic ±i²（Horowitz）', double: 'Double hashing' };
  const sp = () => Math.min(1.15, 12.5 / T.m);
  const slotPos = (i, y = 0.36) => new THREE.Vector3((i - (T.m - 1) / 2) * sp(), y, 0);
  const R = () => prevPrime(T.m);
  const h2 = (k) => R() - (k % R());
  function probe(k, i) {
    const m = T.m, h = k % m;
    if (T.method === 'linear') return (h + i) % m;
    if (T.method === 'quad') return (h + i * i) % m;
    if (T.method === 'double') return (h + i * h2(k)) % m;
    if (i === 0) return h;
    const j = (i + 1) >> 1;
    return (((i % 2 ? h + j * j : h - j * j) % m) + m) % m;
  }
  function fI(k, i) {
    if (T.method === 'linear') return String(i);
    if (T.method === 'quad') return i + '²';
    if (T.method === 'double') return i + '·' + h2(k);
    if (i === 0) return '0';
    const j = (i + 1) >> 1;
    return (i % 2 ? '+' : '−') + j + '²';
  }
  function buildTable() {
    T.tableObjs.forEach((o) => lab.world.remove(o)); T.tableObjs = [];
    for (let i = 0; i < T.m; i++) {
      const t = tile(new THREE.Vector3(slotPos(i).x, 0.02, 0), sp() * 0.9, 1.1);
      const l = lab.label('[' + i + ']', 'idx'); l.position.set(slotPos(i).x, 0.05, 0.95); lab.world.add(l);
      T.tableObjs.push(t, l);
    }
  }
  function enterOpen(opts = {}) {
    fresh([0, 6.4, 11.5], [0, 0.9, 0]);
    T.m = opts.m || T.m; T.auto = !!opts.auto;
    T.slots = new Array(T.m).fill(null); T.n = 0; T.tombs = 0; T.tableObjs = []; T.clusterObjs = []; T.tagObjs = []; T.last = '—';
    buildTable();
    T.cursor = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 10, 36), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    T.cursor.rotation.x = Math.PI / 2; T.cursor.visible = false; lab.world.add(T.cursor);
    if (T.auto) {
      controls('<label>k <input id="oK" type="number" min="0" value="23" style="width:70px"></label>'
        + '<button class="primary" id="oIns">insert</button><button id="oRand">insert 隨機</button>'
        + '<select id="oTh"><option value="0.5">α &gt; 0.5 就 rehash</option><option value="0.7">α &gt; 0.7 就 rehash</option><option value="0.75">α &gt; 0.75 就 rehash</option></select>'
        + '<button id="oWeiss">課本例 13,15,6,24,23</button><button id="oReset">重設 m = 7</button>');
      $('oTh').value = String(T.threshold);
      $('oTh').onchange = (e) => { T.threshold = Number(e.target.value); oaState(); };
      on('oReset', () => { clearLog(); T.method = 'linear'; enterOpen({ m: 7, auto: true }); });
      on('oWeiss', run(async () => { clearLog(); enterOpen({ m: 7, auto: true }); busy = true; for (const k of WEISS_REHASH) await oaInsert(k, true); busy = false; }));
      log('Rehashing：α 太大時，開一張約兩倍大的新表（取質數），把所有 key 重新 hash 一次。');
      log('影片提醒：open addressing 要讓 λ（= α）保持在 0.5 以下效率才好。這裡可以選門檻。');
    } else {
      controls('<select id="oMeth">' + Object.keys(METHOD_NAME).map((k) => '<option value="' + k + '">' + METHOD_NAME[k] + '</option>').join('') + '</select>'
        + '<label>k <input id="oK" type="number" min="0" value="19" style="width:64px"></label>'
        + '<button class="primary" id="oIns">insert</button><button id="oFind">search</button><button id="oDel">delete</button>'
        + '<select id="oDelM"><option value="tomb">刪除：放墓碑</option><option value="empty">刪除：直接清空（錯誤示範）</option></select>'
        + '<button id="oVid">影片例 89,18,49,58,9</button><button id="oVid2">表 11：20,30,2,13…</button>'
        + '<label>m <input id="oM" type="number" min="5" max="13" value="' + T.m + '" style="width:48px"></label>');
      $('oMeth').value = T.method; $('oDelM').value = T.delMode;
      $('oMeth').onchange = (e) => { T.method = e.target.value; clearLog(); enterOpen(); methodIntro(); };
      $('oDelM').onchange = (e) => { T.delMode = e.target.value; };
      $('oM').onchange = () => { clearLog(); enterOpen({ m: Math.max(5, Math.min(13, num('oM') || 10)) }); methodIntro(); };
      on('oFind', run(async () => { await oaSearch(num('oK')); }));
      on('oDel', run(async () => { await oaDelete(num('oK')); }));
      on('oVid', run(async () => { clearLog(); enterOpen({ m: 10 }); busy = true; for (const k of VID_LP) await oaInsert(k, true); busy = false; }));
      on('oVid2', run(async () => { clearLog(); const keep = T.method; T.method = 'linear'; enterOpen({ m: 11 }); busy = true; for (const k of VID_CLUSTER) await oaInsert(k, true); busy = false; if (keep !== 'linear') log('這組是影片的 linear probing 例子，已切到 linear。'); }));
      methodIntro();
    }
    on('oIns', run(async () => { const k = num('oK'); if (!(k >= 0)) { log('k 要是非負整數。', true); return; } await oaInsert(k); }));
    on('oRand', run(async () => { await oaInsert(Math.floor(Math.random() * 100)); }));
    oaState();
  }
  function methodIntro() {
    const txt = {
      linear: 'Linear probing：h_i(x) = (hash(x) + i) mod m，撞到就看下一格（繞回 0）。缺點：primary clustering。',
      quad: 'Quadratic probing：h_i(x) = (hash(x) + i²) mod m，跳 1、4、9…格，打散群聚；但 α > 1/2 時可能找不到空格。',
      quadpm: 'Horowitz 版二次探測：h, h+1², h−1², h+2², h−2², …（mod m）；m 是 4j+3 型質數（如 7、11、19）時保證走遍整張表。',
      double: 'Double hashing：h_i(x) = (hash(x) + i·hash2(x)) mod m，hash2(x) = ' + R() + ' − (x mod ' + R() + ')，步長因 key 而異。',
    };
    log(txt[T.method]);
  }
  function clearTags() { T.tagObjs.forEach((o) => lab.world.remove(o)); T.tagObjs = []; }
  function tagSlot(s, text) {
    const l = lab.label(text, 'idx');
    l.position.copy(slotPos(s, 1.15)).add(new THREE.Vector3(0, T.tagObjs.filter((o) => o.slot === s).length * 0.35, 0));
    l.slot = s; lab.world.add(l); T.tagObjs.push(l);
  }
  function drawClusters() {
    T.clusterObjs.forEach((o) => lab.world.remove(o)); T.clusterObjs = [];
    const m = T.m, occ = T.slots.map((c) => !!c);
    if (!occ.some((x) => !x)) { addRun(0, m); return; }
    let s = occ.findIndex((x, i) => x && !occ[(i - 1 + m) % m]);
    if (s < 0) return;
    const seen = new Set();
    for (let t = 0; t < m; t++) {
      const i = (s + t) % m;
      if (occ[i] && !occ[(i - 1 + m) % m] && !seen.has(i)) {
        let L = 0;
        while (occ[(i + L) % m] && L < m) { seen.add((i + L) % m); L++; }
        addRun(i, L);
      }
    }
  }
  function addRun(start, L) {
    if (L < 2) return;
    const col = L >= 4 ? '#d64545' : L === 3 ? '#dd8238' : '#e9c46a';
    // 繞回來的群聚分成兩段畫
    const segs = start + L <= T.m ? [[start, L]] : [[start, T.m - start], [0, start + L - T.m]];
    for (const [a, len] of segs) {
      const x0 = slotPos(a).x - sp() / 2, w = len * sp();
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.06, 0.22), new THREE.MeshBasicMaterial({ color: col }));
      bar.position.set(x0 + w / 2, 0.04, -0.85); lab.world.add(bar); T.clusterObjs.push(bar);
    }
    const lbl = lab.label('群聚 ' + L, 'idx');
    lbl.position.set(slotPos(start).x - sp() / 2 + Math.min(L, T.m - start) * sp() / 2, 0.1, -1.3); lab.world.add(lbl); T.clusterObjs.push(lbl);
  }
  function findSilent(k) {
    for (let i = 0; i < T.m; i++) { const s = probe(k, i), c = T.slots[s]; if (!c) return -1; if (!c.tomb && c.key === k) return s; }
    return -1;
  }
  async function oaInsert(k, fast) {
    if (findSilent(k) >= 0) { log(k + ' 已經在表裡了。', true); return; }
    if (T.n >= T.m) { log('表滿了（n = m）。open addressing 的 α 不能超過 1。', true); return; }
    clearTags();
    const hk = k % T.m;
    const m = block(k, [sp() * 0.82, 0.56, 0.8]);
    m.position.copy(slotPos(hk, 6));
    const b = lab.addBody(m);
    lab.springTo(b, slotPos(hk, 2.5));
    log('insert ' + k + '：hash(' + k + ') = ' + k + ' mod ' + T.m + ' = ' + hk + (T.method === 'double' ? '，hash2 = ' + R() + ' − (' + k + ' mod ' + R() + ') = ' + h2(k) : ''));
    T.cursor.visible = true;
    let placed = -1, i = 0;
    for (; i < T.m; i++) {
      const s = probe(k, i);
      lab.springTo(b, slotPos(s, 2.5));
      T.cursor.position.copy(slotPos(s, 0.05));
      tagSlot(s, 'i=' + i);
      const c = T.slots[s];
      const fx = 'h' + i + '(' + k + ') = (' + hk + ' + ' + fI(k, i) + ') mod ' + T.m + ' = ' + s;
      if (!fast) say(c && !c.tomb ? '[' + s + '] 被佔了：碰撞，再探測' : '[' + s + '] 可以放', fx);
      await W(fast ? 420 : 750);
      if (!c || c.tomb) { placed = s; break; }
      glow(c.body, EMI.bad);
      log('  ' + fx + ' → 被 ' + c.key + ' 佔了（碰撞）');
      await W(fast ? 220 : 420);
      glow(c.body);
    }
    T.cursor.visible = false;
    if (placed < 0) {
      lab.flyAway(b, new THREE.Vector3(0, 6, 4));
      log('  探測了 ' + T.m + ' 次都沒找到空位' + (T.method === 'quad' ? '：+i² 只保證「m 是質數且 α ≤ 1/2」時一定找得到。' : '。'), true);
      return;
    }
    const old = T.slots[placed];
    if (old && old.tomb) { lab.removeBody(old.body); T.tombs--; log('  [' + placed + '] 是墓碑，insert 可以重用'); }
    T.slots[placed] = { key: k, body: b };
    T.n++;
    lab.dropTo(b, slotPos(placed));
    T.last = 'insert ' + k + ' → [' + placed + ']，探測 ' + (i + 1) + ' 次';
    log('  ' + k + ' 放進 [' + placed + ']，共探測 ' + (i + 1) + ' 次');
    drawClusters(); oaState();
    if (fast) say('insert ' + k + ' → [' + placed + ']', '探測 ' + (i + 1) + ' 次，α = ' + T.n + '/' + T.m);
    await W(fast ? 450 : 700);
    if (T.auto && T.n / T.m > T.threshold) await rehash();
  }
  async function oaWalk(k, verb) {
    clearTags();
    const hk = k % T.m;
    const g = block('?', [sp() * 0.7, 0.4, 0.7], '#c08a1f');
    g.position.copy(slotPos(hk, 2.6));
    const gb = lab.addBody(g);
    T.cursor.visible = true;
    log(verb + ' ' + k + '：照 insert 的同一條探測序列找，遇到空格才停');
    let res = -1, probes = 0;
    for (let i = 0; i < T.m; i++) {
      const s = probe(k, i);
      probes++;
      lab.springTo(gb, slotPos(s, 2.6));
      T.cursor.position.copy(slotPos(s, 0.05));
      tagSlot(s, 'i=' + i);
      const c = T.slots[s];
      await W(560);
      if (!c) { log('  [' + s + '] 是空的 → 停：' + k + ' 不在表裡（探測 ' + probes + ' 次）'); break; }
      if (c.tomb) { log('  [' + s + '] 是墓碑 → 不能停，繼續找'); continue; }
      if (c.key === k) { res = s; glow(c.body, EMI.ok); log('  [' + s + '] 找到 ' + k + '（探測 ' + probes + ' 次）'); break; }
      glow(c.body, EMI.cur);
      log('  [' + s + '] 是 ' + c.key + '，不是 → 下一個');
      await W(200);
      glow(c.body);
    }
    lab.removeBody(gb);
    T.cursor.visible = false;
    return { res, probes };
  }
  async function oaSearch(k) {
    if (!(k >= 0)) { log('k 要是非負整數。', true); return null; }
    const r = await oaWalk(k, 'search');
    T.last = 'search ' + k + '：' + (r.res >= 0 ? '找到' : '找不到') + '，探測 ' + r.probes + ' 次';
    oaState();
    await W(900);
    if (r.res >= 0) glow(T.slots[r.res].body);
    return r;
  }
  async function oaDelete(k) {
    if (!(k >= 0)) { log('k 要是非負整數。', true); return; }
    const r = await oaWalk(k, 'delete');
    if (r.res < 0) { T.last = 'delete ' + k + '：不存在'; oaState(); return; }
    const c = T.slots[r.res];
    lab.flyAway(c.body, new THREE.Vector3(0, 7, 4));
    T.n--;
    if (T.delMode === 'tomb') {
      const t = lab.box('#bdb3a3', [sp() * 0.78, 0.22, 0.75]);
      t.add(lab.label('已刪', 'idx'));
      t.position.copy(slotPos(r.res, 0.15));
      T.slots[r.res] = { tomb: true, body: lab.addBody(t) };
      T.tombs++;
      log('  [' + r.res + '] 放墓碑（lazy deletion）：search 經過要繼續找，insert 可以重用');
    } else {
      T.slots[r.res] = null;
      log('  [' + r.res + '] 直接清空——之後經過這格的 search 會提早停下，後面的 key 就「找不到」了！', true);
    }
    T.last = 'delete ' + k + '（' + (T.delMode === 'tomb' ? '墓碑' : '清空') + '）';
    drawClusters(); oaState();
    await W(600);
  }
  async function rehash() {
    const newM = nextPrime(2 * T.m);
    if (newM > 17) { log('α 超過門檻，下一張表要 ' + newM + ' 格，畫面放不下，示範到 17 格為止。', true); return; }
    const keys = [];
    T.slots.forEach((c) => { if (!c) return; if (c.tomb) lab.removeBody(c.body); else keys.push(c); });
    log('α = ' + T.n + '/' + T.m + ' = ' + (T.n / T.m).toFixed(2) + ' > ' + T.threshold + ' → rehash：新表 m = 大於 2·' + T.m + ' 的最小質數 = ' + newM);
    say('α 超過 ' + T.threshold + '：rehash 到 m = ' + newM, '新 m = nextPrime(2 × ' + T.m + ') = ' + newM);
    keys.forEach((c) => lab.springTo(c.body, c.body.target.clone().setY(4.2)));
    await W(1100);
    const oldM = T.m;
    T.m = newM; T.slots = new Array(newM).fill(null); T.n = 0; T.tombs = 0;
    buildTable(); drawClusters(); clearTags();
    for (const c of keys) {
      let i = 0, s = probe(c.key, 0);
      while (T.slots[s] && i < newM) { i++; s = probe(c.key, i); }
      T.slots[s] = c; T.n++;
      c.body.obj.scale.set(sp() / Math.min(1.15, 12.5 / oldM), 1, 1);
      lab.springTo(c.body, slotPos(s));
      log('  ' + c.key + ' mod ' + newM + ' = ' + (c.key % newM) + (i ? '，探測後放 [' + s + ']' : ' → [' + s + ']'));
      say('全部重新 hash：' + c.key + ' mod ' + newM + ' = ' + (c.key % newM), '舊表的位置作廢，墓碑也一起清掉');
      await W(500);
    }
    T.last = 'rehash ' + oldM + ' → ' + newM;
    drawClusters(); oaState();
    log('rehash 這一次 O(n)，但很久才發生一次，平均（攤銷）下來每次 insert 仍是 O(1)。');
  }
  function avgSuccess() {
    let tot = 0, cnt = 0;
    T.slots.forEach((c) => { if (!c || c.tomb) return; for (let i = 0; i < T.m; i++) if (probe(c.key, i) === T.slots.indexOf(c)) { tot += i + 1; cnt++; break; } });
    return cnt ? [tot, cnt] : null;
  }
  function avgFailLinear() {
    let tot = 0;
    for (let h = 0; h < T.m; h++) { let p = 1; while (T.slots[(h + p - 1) % T.m] && p <= T.m) p++; tot += p; }
    return [tot, T.m];
  }
  function oaState() {
    const a = T.n / T.m, lin = T.method === 'linear';
    const S = lin ? 0.5 * (1 + 1 / (1 - a)) : (a > 0 ? (1 / a) * Math.log(1 / (1 - a)) : 1);
    const U = lin ? 0.5 * (1 + 1 / ((1 - a) * (1 - a))) : 1 / (1 - a);
    const sv = avgSuccess(), uf = lin ? avgFailLinear() : null;
    const rows = [
      ['方法', METHOD_NAME[T.method] + (T.auto ? '（rehash）' : '')],
      ['m / n / 墓碑', T.m + ' / ' + T.n + ' / ' + T.tombs],
      ['α = n/m', '<span class="' + (a > (T.auto ? T.threshold : 0.5) ? 'no' : 'ok') + '">' + a.toFixed(2) + '</span>'],
      ['剛才', T.last],
    ];
    if (sv) rows.push(['實際平均成功搜尋', sv[0] + '/' + sv[1] + ' = ' + (sv[0] / sv[1]).toFixed(2)]);
    if (uf && T.n) rows.push(['實際平均失敗搜尋', uf[0] + '/' + uf[1] + ' = ' + (uf[0] / uf[1]).toFixed(2)]);
    const fs = a >= 1 ? '表滿了' : lin
      ? '線性探測（Knuth）：成功 ≈ ½[1 + 1/(1−α)] = ' + S.toFixed(2) + '，失敗 ≈ ½[1 + 1/(1−α)²] = ' + U.toFixed(2)
      : '均勻雜湊近似（double hashing 接近）：成功 ≈ (1/α)·ln(1/(1−α)) = ' + S.toFixed(2) + '，失敗 ≈ 1/(1−α) = ' + U.toFixed(2);
    setState('Open Addressing（m = ' + T.m + '）', rows, 'h_i(x) = (hash(x) + f(i)) mod m，f(0) = 0<br>' + fs);
  }

  // ───────────────────────── 4) α 與探測次數 ─────────────────────────
  const AL = { a: 0.5, kind: 'S', marker: null, lbls: [], timer: null };
  const AX = (a) => -6 + (a / 0.95) * 12;
  const AY = (p) => Math.min(p, 10) * 0.62;
  const CURVES = {
    chain: { name: 'Chaining', color: '#2fc092', S: (a) => 1 + a / 2, U: (a) => a },
    linear: { name: 'Linear', color: '#d64545', S: (a) => 0.5 * (1 + 1 / (1 - a)), U: (a) => 0.5 * (1 + 1 / ((1 - a) * (1 - a))) },
    double: { name: 'Double／均勻', color: '#4b9ee2', S: (a) => (a > 0 ? (1 / a) * Math.log(1 / (1 - a)) : 1), U: (a) => 1 / (1 - a) },
  };
  function enterAlpha() {
    fresh([0, 4, 13], [0, 3, 0]);
    const ax = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
    ax.position.set(0, 0, 0); lab.world.add(ax);
    const ay = new THREE.Mesh(new THREE.BoxGeometry(0.04, 6.4, 0.04), new THREE.MeshBasicMaterial({ color: '#6e5f49' }));
    ay.position.set(-6, 3.2, 0); lab.world.add(ay);
    for (const a of [0, 0.25, 0.5, 0.75, 0.9]) { const l = lab.label('α=' + a, 'idx'); l.position.set(AX(a), -0.35, 0); lab.world.add(l); }
    for (const p of [1, 2, 5, 10]) { const l = lab.label(String(p), 'idx'); l.position.set(-6.45, AY(p), 0); lab.world.add(l); }
    for (const id of Object.keys(CURVES)) {
      const c = CURVES[id], pts = [];
      for (let a = 0; a <= 0.95; a += 0.01) pts.push(new THREE.Vector3(AX(a), AY(c[AL.kind](a)), 0));
      lab.world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: c.color })));
      const end = pts[pts.length - 1];
      const l = lab.label(c.name, 'ptr'); l.element.style.background = c.color; l.element.style.borderColor = c.color;
      l.position.set(Math.min(end.x + 0.2, 6.2), Math.min(end.y, 6.2) + 0.35, 0); lab.world.add(l);
    }
    const lim = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: '#c9b48e' }));
    lim.position.set(0, AY(10), -0.1); lab.world.add(lim);
    AL.marker = new THREE.Mesh(new THREE.BoxGeometry(0.05, 6.4, 0.05), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    lab.world.add(AL.marker);
    controls('<label>α = <input id="aA" type="range" min="0" max="0.95" step="0.01" value="' + AL.a + '" style="width:180px"></label> <b id="aAv"></b>'
      + '<select id="aK"><option value="S">成功搜尋</option><option value="U">失敗搜尋／insert</option></select><button class="primary" id="aSim">實測（m = 101）</button>');
    $('aK').value = AL.kind;
    $('aK').onchange = (e) => { AL.kind = e.target.value; clearLog(); enterAlpha(); };
    $('aA').oninput = (e) => setAlpha(Number(e.target.value));
    on('aSim', run(simulate));
    log('期望探測次數 vs. 負載因子 α。Linear probing 在 α 接近 1 時暴增（影片：λ 要保持在 0.5 以下）。');
    log('「實測」會真的建 m = 101 的表、插入隨機 key，畫出量到的平均值（方塊）。');
    setAlpha(AL.a);
  }
  function setAlpha(a) {
    AL.a = a;
    if ($('aA')) { $('aA').value = a; $('aAv').textContent = a.toFixed(2); }
    AL.marker.position.set(AX(a), 3.2, 0.05);
    const rows = Object.values(CURVES).map((c) => [c.name, c[AL.kind](a).toFixed(2) + ' 次']);
    setState((AL.kind === 'S' ? '成功' : '失敗') + '搜尋的期望探測次數（α = ' + a.toFixed(2) + '）', rows,
      'Chaining：S ≈ 1 + α/2，U ≈ α<br>Linear：S ≈ ½[1 + 1/(1−α)]，U ≈ ½[1 + 1/(1−α)²]<br>Double（均勻）：S ≈ (1/α)ln(1/(1−α))，U ≈ 1/(1−α)'
      + (a > 0.5 ? '<br><span class="no">α > 0.5：linear probing 開始明顯變慢</span>' : ''));
  }
  async function simulate() {
    const m = 101, Rr = 97;
    const meas = { chain: [], linear: [], double: [] };
    for (let a = 0.1; a < 0.95; a += 0.1) {
      const n = Math.round(a * m), trials = 6;
      const acc = { chain: 0, linear: 0, double: 0 };
      for (let t = 0; t < trials; t++) {
        const keys = new Set(); while (keys.size < n) keys.add(Math.floor(Math.random() * 1e6));
        const lin = new Array(m).fill(null), dbl = new Array(m).fill(null), ch = Array.from({ length: m }, () => []);
        let sL = 0, sD = 0, sC = 0;
        for (const k of keys) {
          let i = 0; while (lin[(k + i) % m] !== null) i++; lin[(k + i) % m] = k; sL += i + 1;
          const st = Rr - (k % Rr); i = 0; while (dbl[(k + i * st) % m] !== null) i++; dbl[(k + i * st) % m] = k; sD += i + 1;
          ch[k % m].unshift(k); sC += 0;
        }
        if (AL.kind === 'S') {
          for (const b of ch) b.forEach((_, j) => { sC += j + 1; });
          acc.linear += sL / n; acc.double += sD / n; acc.chain += sC / n;
        } else {
          let uL = 0, uD = 0, uC = 0;
          for (let q = 0; q < 200; q++) {
            const k = 1e6 + Math.floor(Math.random() * 1e6);
            let i = 0; while (lin[(k + i) % m] !== null) i++; uL += i + 1;
            const st = Rr - (k % Rr); i = 0; while (dbl[(k + i * st) % m] !== null) i++; uD += i + 1;
            uC += ch[k % m].length;
          }
          acc.linear += uL / 200; acc.double += uD / 200; acc.chain += uC / 200;
        }
      }
      for (const id of Object.keys(acc)) {
        const v = acc[id] / trials;
        meas[id].push([a, v]);
        const mk = lab.box(CURVES[id].color, [0.22, 0.22, 0.22]);
        mk.position.set(AX(a), 9, 0.2);
        lab.dropTo(lab.addBody(mk), new THREE.Vector3(AX(a), AY(v), 0.2));
      }
      await W(260);
    }
    const at = (id, a) => (meas[id].find((x) => Math.abs(x[0] - a) < 0.01) || [0, 0])[1].toFixed(2);
    log('實測（α = 0.5）：chaining ' + at('chain', 0.5) + '、linear ' + at('linear', 0.5) + '、double ' + at('double', 0.5) + ' 次');
    log('實測（α = 0.9）：chaining ' + at('chain', 0.9) + '、linear ' + at('linear', 0.9) + '、double ' + at('double', 0.9) + ' 次——linear 被群聚拖垮。');
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderCmp(el) {
    el.innerHTML = '<h2>碰撞處理方法比較</h2>'
      + '<table class="lab-table"><thead><tr><th></th><th>Chaining</th><th>Linear</th><th>Quadratic</th><th>Double hashing</th></tr></thead><tbody>'
      + '<tr><th>資料放哪</th><td>表外的 linked list</td><td colspan="3">表內（open addressing）</td></tr>'
      + '<tr><th>α 範圍</th><td>可以 &gt; 1</td><td colspan="3">≤ 1，建議 &lt; 0.5（影片）～0.7</td></tr>'
      + '<tr><th>f(i)</th><td>—</td><td>i</td><td>i²（Horowitz：±i²）</td><td>i·hash2(x)</td></tr>'
      + '<tr><th>群聚</th><td>無</td><td class="on">primary clustering</td><td>secondary clustering（同 h 的 key 序列相同）</td><td class="o1">幾乎沒有</td></tr>'
      + '<tr><th>刪除</th><td class="o1">直接從 list 移除</td><td colspan="3" class="on">要用墓碑（lazy deletion）</td></tr>'
      + '<tr><th>最壞情況</th><td class="on">全部同一格 O(n)</td><td colspan="3" class="on">O(n)（探測整張表）</td></tr>'
      + '</tbody></table>'
      + '<h3>期望探測次數（α = n/m）</h3>'
      + '<table class="lab-table"><thead><tr><th></th><th>成功搜尋</th><th>失敗搜尋</th></tr></thead><tbody>'
      + '<tr><th>Chaining</th><td>≈ 1 + α/2</td><td>≈ α（有些書記 1 + α）</td></tr>'
      + '<tr><th>Linear probing</th><td>≈ ½[1 + 1/(1−α)]</td><td>≈ ½[1 + 1/(1−α)²]</td></tr>'
      + '<tr><th>Double hashing（均勻雜湊）</th><td>≈ (1/α)·ln(1/(1−α))</td><td>≈ 1/(1−α)</td></tr>'
      + '</tbody></table>'
      + '<h3>雜湊函數（洪逸 8-3）</h3><p>除法 k mod m（m 取質數）；中間平方法（k² 的中間 r 位）；折疊法：移位折疊（各段相加）、邊界折疊（偶數段反轉再加，課本例 12320324111220 → 移位 699、邊界 897）；位數分析法（挑分布平均的位數）。</p>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">search 遇到「空格」才能停，遇到墓碑要繼續。所以 open addressing 不能直接清空，否則後面的 key 會「消失」。</div>'
      + '<div class="lab-trap">quadratic probing（+i²）只保證 m 是質數且 α ≤ 1/2 時一定找得到空位；表還有空格也可能插不進去。</div>'
      + '<div class="lab-trap">double hashing 的 hash2(x) 不能是 0，而且要和 m 互質（m 取質數最保險），不然走不遍整張表。</div>'
      + '<div class="lab-trap">rehash 要把每個 key 用新的 m 重新算，不能直接把舊陣列複製過去；墓碑在這時一起清掉。</div>'
      + '<p class="src">例子來源：影片 Hashing – Collision Resolution with Linear Probing（89,18,49,58,9；表 11 的 15/8）。quadratic、double、rehash（13,15,6,24,23 → 17）依 Weiss 課本寫法。</p>';
  }
  let qs = { score: 0, total: 0 };
  function simTable(keys, m, method) {
    const old = [T.m, T.method];
    T.m = m; T.method = method;
    const slots = new Array(m).fill(null), probes = {};
    for (const k of keys) {
      for (let i = 0; i < m; i++) { const s = probe(k, i); if (slots[s] === null) { slots[s] = k; probes[k] = i + 1; break; } }
    }
    const res = { slots, probes, h2: method === 'double' ? (k) => h2(k) : null };
    [T.m, T.method] = old;
    return res;
  }
  function uniqKeys(n, max = 100) { const s = new Set(); while (s.size < n) s.add(Math.floor(Math.random() * max)); return [...s]; }
  function genQ() {
    const t = Math.floor(Math.random() * 6);
    const m = [7, 10, 11, 13][Math.floor(Math.random() * 4)];
    if (t <= 2) {
      const method = ['linear', 'quad', 'double'][t];
      let keys, sim, last;
      for (let tries = 0; tries < 50; tries++) {
        keys = uniqKeys(5 + Math.floor(Math.random() * 2));
        sim = simTable(keys, m, method);
        last = keys[keys.length - 1];
        if (sim.probes[last] >= 2) break;
      }
      if (!(sim.probes[last] >= 1)) return genQ();
      const ans = String(sim.slots.indexOf(last));
      const wrongs = [String(last % m), String((last % m + 1) % m), String((last % m + sim.probes[last]) % m), String(simTable(keys, m, 'linear').slots.indexOf(last)), String((ans * 1 + 1) % m), String((ans * 1 + m - 1) % m), String((ans * 1 + 2) % m)];
      const R7 = prevPrime(m);
      const names = { linear: 'linear probing', quad: 'quadratic probing h_i = (h + i²) mod m', double: 'double hashing，hash2(x) = ' + R7 + ' − (x mod ' + R7 + ')' };
      return { q: '表大小 m = ' + m + '，h(x) = x mod ' + m + '，用 ' + names[method] + '。依序 insert ' + keys.join(', ') + '，最後的 ' + last + ' 放在哪一格？',
        opts: mk(ans, wrongs), ans, why: last + ' mod ' + m + ' = ' + (last % m) + '，共探測 ' + sim.probes[last] + ' 次後放進 [' + ans + ']。最終表：' + sim.slots.map((x, i) => '[' + i + ']' + (x === null ? '—' : x)).join(' ') };
    }
    if (t === 3) {
      const keys = uniqKeys(7);
      const b = keys[Math.floor(Math.random() * keys.length)] % m;
      const cnt = keys.filter((k) => k % m === b).length;
      return { q: 'Chaining，m = ' + m + '，h(x) = x mod ' + m + '。insert ' + keys.join(', ') + ' 之後，[' + b + '] 的串列有幾個節點？此時 α = ？',
        opts: mk(cnt + ' 個；α = ' + (7 / m).toFixed(2), [(cnt + 1) + ' 個；α = ' + (7 / m).toFixed(2), cnt + ' 個；α = ' + (m / 7).toFixed(2), Math.max(1, cnt - 1) + ' 個；α = ' + (7 / m).toFixed(2), cnt + ' 個；α = 1.00']),
        ans: cnt + ' 個；α = ' + (7 / m).toFixed(2), why: 'mod ' + m + ' 等於 ' + b + ' 的有：' + keys.filter((k) => k % m === b).join(', ') + '。α = n/m = 7/' + m + '，chaining 的 α 可以大於 1。' };
    }
    if (t === 4) {
      const a = [0.5, 0.75, 0.8, 0.9][Math.floor(Math.random() * 4)];
      const succ = Math.random() < 0.5;
      const v = succ ? 0.5 * (1 + 1 / (1 - a)) : 0.5 * (1 + 1 / ((1 - a) * (1 - a)));
      const alt = succ ? 0.5 * (1 + 1 / ((1 - a) * (1 - a))) : 0.5 * (1 + 1 / (1 - a));
      const ans = v.toFixed(2);
      return { q: 'Linear probing，α = ' + a + '，' + (succ ? '成功' : '失敗') + '搜尋的期望探測次數約為？',
        opts: mk(ans, [alt.toFixed(2), (1 / (1 - a)).toFixed(2), (1 + a / 2).toFixed(2), (a / (1 - a)).toFixed(2)]), ans,
        why: (succ ? '成功 ≈ ½[1 + 1/(1−α)]' : '失敗 ≈ ½[1 + 1/(1−α)²]') + ' = ' + ans + '。α 越接近 1，失敗搜尋爆得越快。' };
    }
    const digits = String(1e11 + Math.floor(Math.random() * 9e11));
    const parts = digits.match(/.{1,3}/g);
    const shift = parts.reduce((s, x) => s + Number(x), 0);
    const bnd = parts.reduce((s, x, i) => s + Number(i % 2 ? [...x].reverse().join('') : x), 0);
    const askB = Math.random() < 0.5;
    const ans = String(askB ? bnd : shift);
    return { q: 'k = ' + digits + '，每 3 位一段做' + (askB ? '邊界折疊（boundary folding）' : '移位折疊（shift folding）') + '，位址是？',
      opts: mk(ans, [String(askB ? shift : bnd), String(Number(ans) + 9), String(parts.reduce((s, x) => s + Number([...x].reverse().join('')), 0))]), ans,
      why: '分段 ' + parts.join(' | ') + '。' + (askB ? '邊界折疊把第 2、4 段反轉：' + parts.map((x, i) => (i % 2 ? [...x].reverse().join('') : x)).join(' + ') : '移位折疊直接相加：' + parts.join(' + ')) + ' = ' + ans };
  }
  function mk(ans, cands) { const s = [ans]; for (const c of cands) if (s.length < 4 && !s.includes(c)) s.push(c); return s; }
  function renderQuiz(el) {
    const p = genQ();
    const opts = [...p.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    el.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + qs.score + ' / ' + qs.total + '</div>'
      + '<div class="lab-quiz-q">' + p.q + '</div><div class="lab-quiz-opts">'
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

  // ───────────────────────── 舞台場景（照影片順序） ─────────────────────────
  const scenes = {
    'chaining-vs-open': { title: 'Separate chaining 對照 open addressing', play: async (tok) => {
      C.front = true; enterChain(10);
      say('h(x) = x mod 10：10,20,30,40,50 全部撞在 [0]', 'separate chaining：串成 linked list');
      await beat(tok, 1500);
      for (const k of VID_CHAIN) await chainInsert(k, true);
      say('串列 50→40→30→20→10，旁邊 9 格全空著', '要額外的 list 記憶體');
      await beat(tok, 2600);
      T.method = 'linear'; enterOpen({ m: 10 });
      say('open addressing：資料全部放在表裡', '撞了就往下一格找');
      await beat(tok, 1400);
      for (const k of VID_CHAIN) await oaInsert(k, true);
      say('10,20,30,40,50 → [0]～[4]', '不用額外記憶體，但表要夠大');
      await beat(tok, 2800);
    } },
    'linear-probing': { title: 'Linear probing：h_i(x) = (hash(x) + i) mod 10', play: async (tok) => {
      T.method = 'linear'; enterOpen({ m: 10 });
      say('影片例：依序 insert 89, 18, 49, 58, 9', 'h_i(x) = (x mod 10 + i) mod 10');
      await beat(tok, 2000);
      for (const k of VID_LP) await oaInsert(k);
      say('49→[0]、58→[1]、9→[2]', '58 探測 4 次、9 探測 4 次');
      await beat(tok, 3000);
    } },
    'find-probes': { title: 'Find：走同一條探測序列（58 要 4 次、19 要 5 次）', play: async (tok) => {
      T.method = 'linear'; enterOpen({ m: 10 });
      for (const k of VID_LP) await oaInsert(k, true);
      say('find 58：8 → 9 → 0 → 1', '和 insert 走同一條序列');
      const r1 = await oaSearch(58);
      say('找到 58：' + r1.probes + ' 次探測', 'h₃(58) = (8 + 3) mod 10 = 1');
      await beat(tok, 2200);
      say('find 19：9 → 0 → 1 → 2 → 3（空）', '遇到空格才知道「不在表裡」');
      const r2 = await oaSearch(19);
      say('19 不存在：' + r2.probes + ' 次探測', '<span class="no">失敗搜尋比成功搜尋貴</span>');
      await beat(tok, 2800);
    } },
    'primary-clustering': { title: 'Primary clustering：表大小 11，平均 15/8 次', play: async (tok) => {
      T.method = 'linear'; enterOpen({ m: 11 });
      say('m = 11：依序 insert 8 個 key', 'hash(x) = x mod 11：20, 30, 2, 13, 25, 24, 10, 9');
      await beat(tok, 1500);
      for (const k of VID_CLUSTER) await oaInsert(k, true);
      const sv = avgSuccess();
      say('[2]～[5] 連成一大塊：群聚', '平均成功搜尋 = ' + sv[0] + '/' + sv[1] + ' ≈ ' + (sv[0] / sv[1]).toFixed(2));
      await beat(tok, 3000);
      say('find 4：4 → 5 → 6（空）', '撞進群聚就要一路走到底');
      await oaSearch(4);
      say('群聚越大，越容易被撞到、又越長越大', 'linear：失敗 ≈ ½[1 + 1/(1−α)²]，λ 最好 < 0.5');
      await beat(tok, 3000);
    } },
    'quadratic-and-double': { title: '換掉 f(i)：quadratic 與 double hashing', play: async (tok) => {
      T.method = 'quad'; enterOpen({ m: 10 });
      say('同一組 89,18,49,58,9，改用 f(i) = i²', '跳 1、4、9 格，不再擠成一團');
      await beat(tok, 1800);
      for (const k of VID_LP) await oaInsert(k, true);
      say('quadratic：58→[2]、9→[3]', 'h_i(x) = (hash(x) + i²) mod 10');
      await beat(tok, 2600);
      T.method = 'double'; enterOpen({ m: 10 });
      say('double hashing：每個 key 步長不同', '步長 hash2(x) = 7 − (x mod 7)');
      await beat(tok, 1800);
      for (const k of VID_LP) await oaInsert(k, true);
      say('49→[6]、58→[3]、9→[4]', 'h_i(x) = (hash(x) + i·hash2(x)) mod 10');
      await beat(tok, 3000);
    } },
    'lazy-deletion': { title: '刪除要放墓碑（lazy deletion）', play: async (tok) => {
      T.method = 'linear'; T.delMode = 'empty'; enterOpen({ m: 10 });
      for (const k of VID_LP) await oaInsert(k, true);
      say('錯誤示範：delete 49 時直接清空 [0]', '');
      await oaDelete(49);
      say('find 58：8 → 9 → 0（空）就停了', '<span class="no">58 明明在 [1]，卻「找不到」</span>');
      await oaSearch(58);
      await beat(tok, 1800);
      T.delMode = 'tomb'; enterOpen({ m: 10 });
      for (const k of VID_LP) await oaInsert(k, true);
      say('正確：delete 49 留下墓碑', '墓碑 = 「這裡曾經有人」');
      await oaDelete(49);
      say('find 58 經過墓碑繼續找', '<span class="ok">找到了</span>，insert 時墓碑可以重用');
      await oaSearch(58);
      await beat(tok, 2600);
      T.delMode = 'tomb';
    } },
    'rehashing': { title: 'Rehashing：α 太大就換兩倍大的表', play: async (tok) => {
      T.method = 'linear'; T.threshold = 0.7; enterOpen({ m: 7, auto: true });
      say('m = 7：insert 13, 15, 6, 24, 23', 'α 超過 0.7 就 rehash');
      await beat(tok, 1600);
      for (const k of WEISS_REHASH) await oaInsert(k, true);
      say('新表 m = 17：全部 key 重新 mod 17', 'α = 5/17 ≈ 0.29，單次 O(n)、攤銷 O(1)');
      await beat(tok, 3200);
    } },
    'folding': { title: '雜湊函數：移位折疊與邊界折疊（洪逸 8-3）', play: async (tok) => {
      F.method = 'shift'; F.fkey = '12320324111220'; F.p = 3; enterFn();
      await folding();
      await beat(tok, 2000);
      F.method = 'boundary'; enterFn();
      await folding();
      say('邊界折疊：203→302、112→211', '123 + 302 + 241 + 211 + 20 = <span class="ok">897</span>');
      await beat(tok, 3000);
    } },
  };


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  // remove() also takes buddy / prop groups here: their name and value labels
  // are nested CSS2D children, so drop every nested element, not just the root
  K.remove = function remove(l) {
    if (!l) return;
    if (l.parent) l.parent.remove(l);
    if (l.traverse) l.traverse((c) => { if (c.element) c.element.remove(); }); else if (l.element) l.element.remove();
    if (l.userData && l.userData.name) remove(l.userData.name);
  };
  const FRAG = [];
  // ═══ hasha.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, code, arrow, ghostBox, step, buddy, travel, remove, prop, bob, GOLD, GREEN, RED, GRAY } = K;
// ─── MfhjkfocRR0（Paul：What is a HashTable）、CwM-Cxilk4g（Linear Probing）、mFY0J5W8Udk（Abdul Bari：Hashing Technique） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; the
// beats after it are only the motion (short), then the picture holds.
// every step replaces both caption lines, so an old formula never lingers
const say = (a, b = '') => ctx.say(a, b);
const HA = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const haCol = (k) => HA[(typeof k === 'number' ? k : [...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0)) % HA.length];
const haSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a row of m empty slots centred on x = 0 at depth z
function haRow(m, dx, z) {
  const x0 = -(m - 1) * dx / 2, xs = [], slots = [], idx = [];
  for (let i = 0; i < m; i++) { const x = x0 + i * dx; xs.push(x); slots.push(cube('', GRAY, [dx * 0.9, 0.12, 1.2], x, 0.06, z)); idx.push(tag(String(i), 'idx', x, 0, z + 1.0)); }
  return { m, dx, z, xs, slots, idx, keys: new Array(m).fill(null), vals: new Array(m).fill(null), ks: Math.min(0.9, dx * 0.8) };
}
function haPlace(T, i, k, drop) { const c = cube(k, haCol(k), [T.ks, 0.7, 0.9], T.xs[i], 0.47, T.z, drop ? 3 : 0); T.keys[i] = c; T.vals[i] = k; return c; }
// a key hovering over slot j (before it is placed): red = that slot is taken
function haHover(T, j, k) { const c = cube(k, haCol(k), [T.ks, 0.7, 0.9], T.xs[j], 1.5, T.z); return c; }
const haLin = (i) => i, haQuad = (i) => i * i;
// one probe: the cursor jumps to slot j; red if taken (returns false), else the key lands (true)
async function haTry(tok, T, k, j, cur, lbl, ms = 700) {
  cur.position.set(T.xs[j], 2.1, T.z); txt(cur, lbl);
  if (T.keys[j] !== null) { glow(T.keys[j], RED); await beat(tok, ms); return false; }
  haPlace(T, j, k, true); await beat(tok, ms); return true;
}
const unglow = (T) => T.keys.forEach((c) => c && glow(c, null));
// a person: a little buddy carrying "name + phone"
const person = (name, color, x, z, size = 0.62) => buddy(name, '☎', color, x, 0, z, size);

// ════════ MfhjkfocRR0（Paul） ════════
// 00:04 key / value 與底層陣列
FRAG.push(['hasha-kv', 'Hash table：key 對應 value', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  await step(tok);                                   // 0:04 a data structure used to store information
  const shelf = prop('warehouse', 0, 0, -3.4, 1.0, 'hash table：存資料的倉庫'); bob(shelf, 0.04);
  say('Hash table：一種用來存資料的資料結構');
  await step(tok);                                   // 0:12 two main components: some sort of key
  const kc = cube('key', HA[0], [1.8, 0.7, 1.0], -3.6, 0.35, -0.8, 3);
  say('每筆資料有兩部分：先是 key');
  await step(tok);                                   // 0:20 and some sort of value or record
  const vc = cube('value', HA[1], [1.8, 0.7, 1.0], 3.6, 0.35, -0.8, 3);
  say('另一部分是 value（也叫 record）');
  await step(tok);                                   // 0:26 key = my name, value = my phone number
  const paul = person('Paul', HA[0], -5.6, 1.2);
  note('key = 名字「Paul」', -3.6, 1.3, -0.8); note('value = Paul 的電話', 3.6, 1.3, -0.8);
  await paul.hop(tok); paul.mood('happy');
  say('例：key 是名字，value 是電話號碼', '可以拿來存一堆人的電話');
  await step(tok);                                   // 0:42 implement an associative array: map key to value
  arrow(V3(-2.5, 0.4, -0.8), V3(2.5, 0.4, -0.8), 0xa8730f);
  bub('map：key → value', 0, 1.0, -0.8);
  say('Hash table 實作 associative array', '把 key 對應（map）到 value');
  await step(tok);                                   // 0:52 at the heart: an array structure
  [kc, vc].forEach((c) => glow(c, null));
  const T = haRow(5, 1.7, 2.4);
  T.idx.forEach((l) => { l.element.style.visibility = 'hidden'; });
  bub('核心：一個陣列', -5.6, 1.0, 2.4);
  say('它的核心，就是一個陣列（array）');
  await step(tok);                                   // 0:57 index 0, 1, 2, 3 and 4
  for (let i = 0; i < 5; i++) { T.idx[i].element.style.visibility = ''; glow(T.slots[i], GOLD); await beat(tok, 250); glow(T.slots[i], null); }
  say('每一格有編號：index 0、1、2、3、4');
  await step(tok);                                   // 1:04 a real table would be much bigger than this
  bub('白板上 5 格只是示意，真的會開大很多 …', 2.6, 1.4, 3.6);
  for (let i = 0; i < 2; i++) { const m = cube('', GRAY, [0.9, 0.12, 1.2], T.xs[4] + 1.3 + i * 1.0, 0.06, T.z); m.material.transparent = true; m.material.opacity = 0.45; }
  tag('…', 'idx', T.xs[4] + 2.9, 0.3, T.z);
  say('真正寫程式時，表會開得大很多');
}]);

// 01:27 hash function：key → index（Paul → 3、其他人 → 1、2、4）
FRAG.push(['hasha-paul', 'Hash function：hash(Paul) = 3', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  const T = haRow(5, 1.7, 1.8);
  const HB = V3(0, 0.7, -2.6);
  await step(tok);                                   // 1:27 we're going to write a hash function
  const hb = ghostBox('#c08a1f', 2.2, 1.4, 1.6); hb.position.copy(HB);
  tag('hash( )', 'ptr', 0, 1.9, -2.6);
  say('要寫一個 hash function');
  await step(tok);                                   // 1:36 look at a key ... spit out an index number
  const kp = tag('key', 'pkt', -5.4, 1.0, -2.6);
  await travel(tok, kp, V3(-5.4, 1.0, -2.6), V3(-0.4, 1.0, -2.6), 800); remove(kp);
  const ip = tag('index', 'pkt', 0.4, 1.0, -2.6);
  await travel(tok, ip, V3(0.4, 1.0, -2.6), V3(4.6, 1.0, -2.6), 800);
  say('吃進一個 key，吐出一個 index', 'index 告訴我們：資料放陣列哪一格');
  await step(tok);                                   // 1:51 takes a key value, gives an index number
  remove(ip);
  bub('hash(key) → index', 4.2, 1.6, -3.6);
  say('寫成式子：hash(key) → index');
  await step(tok);                                   // 2:00 hash, with my name as the argument
  const paul = person('● Paul', HA[0], -5.2, -2.6);
  await travel(tok, paul.g, V3(-5.2, 0, -2.6), V3(-1.6, 0, -2.6), 1000);
  paul.look(1);
  say('把名字 Paul 當 key 丟進去', 'hash("Paul") = ?');
  await step(tok);                                   // 2:07 it said: that should go in index 3
  const o3 = tag('index 3', 'pkt', 1.6, 1.2, -2.6);
  await travel(tok, o3, V3(0.6, 1.2, -2.6), V3(2.6, 1.2, -2.6), 600);
  glow(T.slots[3], GOLD);
  say('算出來：應該放在 index 3', 'hash("Paul") = 3');
  await step(tok);                                   // 2:18 same key → same index every time
  const again = tag('Paul', 'pkt', -5.0, 1.6, -1.6);
  await travel(tok, again, V3(-5.0, 1.6, -1.6), V3(-0.4, 1.0, -2.6), 700); remove(again);
  const o3b = tag('又是 3', 'pkt', 1.6, 1.9, -2.6);
  await travel(tok, o3b, V3(0.6, 1.9, -2.6), V3(2.6, 1.9, -2.6), 500);
  say('同一個 key，每次都得到同一個 index', '再算一次 hash("Paul") 還是 3');
  await step(tok);                                   // 2:32 represent Paul as a circle, put it here
  remove(o3); remove(o3b); glow(T.slots[3], null);
  await travel(tok, paul.g, V3(-1.6, 0, -2.6), V3(T.xs[3], 0.12, T.z), 1100);
  paul.mood('happy'); paul.look(0);
  say('圓圈 = Paul 的名字＋電話，放進 [3]');
  // 2:42 another person → 1；3:05 → 2；3:16 diamond → 4
  async function another(name, color, idx, hashMs) {
    const p = person(name, color, -5.2, -2.6);
    await travel(tok, p.g, V3(-5.2, 0, -2.6), V3(-1.6, 0, -2.6), hashMs);
    return p;
  }
  await step(tok);                                   // 2:42 add some other person: evaluate that person
  const sq = await another('■ 某人', HA[1], 1, 900);
  say('再加一個人：一樣丟進 hash function');
  await step(tok);                                   // 2:52 spits out an index value of one
  const o1 = tag('index 1', 'pkt', 1.6, 1.2, -2.6);
  await travel(tok, o1, V3(0.6, 1.2, -2.6), V3(2.6, 1.2, -2.6), 500); remove(o1);
  await travel(tok, sq.g, V3(-1.6, 0, -2.6), V3(T.xs[1], 0.12, T.z), 1000);
  say('方塊這位：hash 得 1 → 放進 [1]');
  await step(tok);                                   // 3:05 another person's hash value goes in index two
  const tr = await another('▲ 某人', HA[2], 2, 700);
  await travel(tok, tr.g, V3(-1.6, 0, -2.6), V3(T.xs[2], 0.12, T.z), 900);
  say('三角形這位：index 2');
  await step(tok);                                   // 3:16 a diamond ... they go in index 4
  const di = await another('◆ 某人', HA[3], 4, 700);
  await travel(tok, di.g, V3(-1.6, 0, -2.6), V3(T.xs[4], 0.12, T.z), 1100);
  [paul, sq, tr, di].forEach((p) => p.mood('happy'));
  say('菱形這位：index 4', '每個人放哪一格，全由 hash function 決定');
}]);

// 03:27 collision：又一個人 hash 到 3 → chaining
FRAG.push(['hasha-chain3', 'Collision 與 chaining：index 3', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const T = haRow(5, 1.7, -2.4);
  const P = [['■', 1, HA[1]], ['▲', 2, HA[2]], ['● Paul', 3, HA[0]], ['◆', 4, HA[3]]].map(([l, i, c]) => person(l, c, T.xs[i], T.z));
  const paul = P[2];
  await step(tok);                                   // 3:27 we're wanting to add another person
  const sq = person('〰 某人', HA[4], -5.6, 1.8);
  say('再加一個人');
  await step(tok);                                   // 3:40 their hash value ends up being three
  const h3 = tag('hash = 3', 'pkt', -5.6, 1.6, 0.4);
  await travel(tok, sq.g, V3(-5.6, 0, 1.8), V3(T.xs[3] - 1.7, 0, -0.6), 1000);
  await travel(tok, h3, V3(-5.6, 1.6, 0.4), V3(T.xs[3], 1.8, -1.0), 600);
  say('他的 hash 值也是 3');
  await step(tok);                                   // 3:47 uh-oh, there's already someone in index 3
  remove(h3); paul.glow(RED); paul.mood('wow'); sq.mood('wow');
  bad('collision！', T.xs[3], 2.0, T.z);
  say('糟糕，[3] 已經有 Paul 了', '兩個 key 搶同一格 = collision');
  await step(tok);                                   // 3:52 a lot of different ways to go about this
  paul.glow(null);
  bub('處理 collision 的方法有很多種', -4.0, 2.2, -0.6);
  say('解決 collision 的方法很多');
  await step(tok);                                   // 4:02 create a linked list off of each index
  for (let i = 0; i < 5; i++) arrow(V3(T.xs[i], 0.3, T.z + 0.65), V3(T.xs[i], 0.3, T.z + 1.35), 0x9a8a70);
  say('Paul 的做法：每一格往下拉一條 linked list', 'linked list = 一節一節串起來的串列');
  await step(tok);                                   // 4:17 put squiggly line's name and phone in there
  await travel(tok, sq.g, V3(T.xs[3] - 1.7, 0, -0.6), V3(T.xs[3], 0, -0.5), 800);
  sq.mood('happy'); paul.mood('calm');
  say('〰 接在 [3] 的串列上');
  await step(tok);                                   // 4:23 this is called chaining
  good('這叫 chaining', T.xs[3] + 2.1, 1.6, -0.5);
  say('這種做法叫 chaining（串起來）');
  await step(tok);                                   // 4:30 another one in index 3
  const sw = person('≀ 某人', HA[5], -5.6, 2.6);
  say('又有一個人 hash 到 3');
  await step(tok);                                   // 4:34 link that off of squiggly line
  arrow(V3(T.xs[3], 0.3, 0.05), V3(T.xs[3], 0.3, 0.85), 0x9a8a70);
  await travel(tok, sw.g, V3(-5.6, 0, 2.6), V3(T.xs[3], 0, 1.4), 1000);
  sw.mood('happy');
  say('就接在 〰 的後面', '[3]：Paul → 〰 → ≀');
  await step(tok);                                   // 4:54 a collision → link it off of that same element
  [paul, sq, sw].forEach((p) => p.glow(GOLD));
  say('只要 collision，就掛在同一格的串列上');
  await step(tok);                                   // 5:01 each of these people got index 3
  bub('這三位的 index 都是 3', T.xs[3] + 2.6, 0.6, 1.4);
  await Promise.all([paul.hop(tok), sq.hop(tok), sw.hop(tok)]);
  say('他們都屬於 index 3');
}]);

// 05:06 查詢：hash(某人) = 1，只看 index 1 的串列
FRAG.push(['hasha-lookup', '查詢：hash 直接告訴你去哪一格', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.4, 0.6]);
  const T = haRow(5, 1.7, -2.6);
  const HB = V3(-4.6, 0.7, 2.6);
  await step(tok);                                   // 5:06 a whole bunch of names and phone numbers
  ['▲', '■', '◆', '●', '♣'].forEach((l, i) => { T.keys[i] = cube(l, HA[i], [1.2, 0.7, 0.9], T.xs[i], 0.47, T.z, 2); });
  const ch = [['甲', HA[5]], ['乙', HA[6]], ['★', HA[4]]].map(([l, c], r) => {
    arrow(V3(T.xs[1], 0.5, T.z + 0.5 + r * 1.5), V3(T.xs[1], 0.5, T.z + 1.2 + r * 1.5), 0x9a8a70);
    return cube(l, c, [1.2, 0.6, 0.8], T.xs[1], 0.35, T.z + 1.6 + r * 1.5, 2);
  });
  say('表裡已經存了一大堆人的名字和電話');
  await step(tok);                                   // 5:16 you have the name, want the phone number
  const me = person('★ 要找的人', HA[4], -6.2, 0.4);
  note('只知道名字，要查電話', -6.0, 1.6, 0.4);
  say('現在：知道某人的名字，想查他的電話', '已知 key，要找 value');
  await step(tok);                                   // 5:23 enter their key inside the hash function
  const hb = ghostBox('#c08a1f', 1.8, 1.2, 1.4); hb.position.copy(HB);
  tag('hash( )', 'ptr', HB.x, 1.7, HB.z);
  const kp = tag('★', 'pkt', -6.2, 1.2, 0.4);
  await travel(tok, kp, V3(-6.2, 1.2, 0.4), V3(HB.x, 1.0, HB.z), 800); remove(kp);
  say('把 key 丟進同一個 hash function');
  await step(tok);                                   // 5:40 it spits out an index: tells you exactly where
  const out = tag('index ?', 'pkt', HB.x, 1.0, HB.z);
  await travel(tok, out, V3(HB.x, 1.0, HB.z), V3(HB.x + 2.4, 1.0, HB.z - 1.6), 700);
  say('吐出 index：直接告訴你他在哪一格');
  await step(tok);                                   // 5:53 might get a hash value of two
  txt(out, 'index 2？');
  say('老師先說成 2 ……');
  await step(tok);                                   // 6:01 sorry, I meant to say one
  txt(out, 'index 1');
  const cur = tag('hash → 1', 'ptr alt', T.xs[1], 1.9, T.z);
  glow(T.keys[1], GOLD);
  say('更正：hash 結果是 1');
  await step(tok);                                   // 6:04 even a million long: no need to look at 0, 2, 3, 4
  const skip = [0, 2, 3, 4].map((i) => tag('不用看', 'idx', T.xs[i], 1.5, T.z));
  [0, 2, 3, 4].forEach((i) => { T.keys[i].material.transparent = true; T.keys[i].material.opacity = 0.35; });
  say('其他格子都不用看', '就算陣列有一百萬格也一樣');
  await step(tok);                                   // 6:18 if we had chaining, go down the list
  skip.forEach(remove);
  for (let r = 0; r < 2; r++) {
    cur.position.set(T.xs[1] + 1.5, 1.0, T.z + 1.6 + r * 1.5); txt(cur, '不是');
    glow(ch[r], GOLD); await beat(tok, 700); glow(ch[r], null);
  }
  say('沿著 [1] 的串列往下找', '甲不是、乙不是 ……');
  await step(tok);                                   // 6:30 figure out where that person is, grab it
  cur.position.set(T.xs[1] + 1.5, 1.0, T.z + 4.6); txt(cur, '找到！');
  glow(ch[2], GREEN); me.mood('happy'); await me.hop(tok);
  good('拿到他的電話 ☎', T.xs[1] + 2.8, 0.4, T.z + 4.6);
  say('找到了，把他的電話拿出來');
  await step(tok);                                   // 6:35 done right: not many links off one index
  bub('hash function 設計得好 → 每串都很短', 2.4, 2.2, -0.6);
  say('hash function 設計得好，每一串都不會太長');
  await step(tok);                                   // 6:46 collisions → a linked list per index = chaining
  bub('collision → 接成 linked list = chaining', 2.4, 1.4, 0.4);
  say('碰到 collision 就用 linked list 接起來', '這就叫 chaining');
}]);

// ════════ CwM-Cxilk4g（Linear Probing） ════════
// 00:00 open addressing vs separate chaining（10, 20, 30, 40, 50）
FRAG.push(['hasha-cvo', 'Open addressing 對照 separate chaining', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.6]);
  let T = haRow(10, 1.15, -2.4);
  await step(tok);                                   // 0:00 collision resolution strategies
  const t1 = bub('這一講：collision 發生了怎麼辦？', -3.2, 1.8, -3.6);
  say('Collision resolution：撞在一起時怎麼處理');
  await step(tok);                                   // 0:06 in particular: open addressing
  const t2 = tag('open addressing', 'ptr alt', 3.0, 1.8, -3.6);
  say('重點：open addressing');
  await step(tok);                                   // 0:15 all the data go inside the table itself
  const tmp = [2, 5, 7].map((i) => haPlace(T, i, ['a', 'b', 'c'][[2, 5, 7].indexOf(i)], true));
  const g1 = good('資料全部放在表「裡面」', 3.6, 1.0, -0.6);
  say('Open addressing：所有資料都放在 hash table 本身');
  await step(tok);                                   // 0:22 last time: separate chaining (open hashing)
  const old = [];
  for (let r = 0; r < 2; r++) { old.push(arrow(V3(T.xs[2], 0.3, T.z + 0.6 + r * 1.2), V3(T.xs[2], 0.3, T.z + 1.1 + r * 1.2), 0x9a8a70)); old.push(cube('', HA[r + 4], [0.8, 0.5, 0.7], T.xs[2], 0.3, T.z + 1.5 + r * 1.2, 2)); }
  const t3 = bub('上一講：separate chaining = 每格掛 linked list', -3.0, 1.0, 1.4);
  say('上一講的 separate chaining（又叫 open hashing）', '每個 index 掛一條 linked list');
  await step(tok);                                   // 0:36 it grew in size: more than the table cells
  for (let r = 2; r < 5; r++) { old.push(arrow(V3(T.xs[2], 0.3, T.z + 0.6 + r * 1.2), V3(T.xs[2], 0.3, T.z + 1.1 + r * 1.2), 0x9a8a70)); old.push(cube('', HA[r + 1], [0.8, 0.5, 0.7], T.xs[2], 0.3, T.z + 1.5 + r * 1.2, 2)); await beat(tok, 300); }
  say('串列越掛越長，節點數可以比格子數還多');
  await step(tok);                                   // 0:45 don't use anything extra than the table memory
  old.forEach(kill); remove(t3);
  say('今天的方法：不用表以外的任何記憶體');
  await step(tok);                                   // 0:52 requires a bigger table, load factor below 0.5
  bub('代價：表要大一點，load factor λ 越小越快', 0, 2.6, 0.4);
  say('但表要夠大：λ = 資料筆數 ÷ 表的格數，越小越快', '老師說 λ < 0.5；那其實是 quadratic probing 的保證條件');
  await step(tok);                                   // 1:13 like 10, 20, 30, 40, 50 with h(x) = x mod 10
  tmp.forEach(kill); T.keys.fill(null); T.vals.fill(null); remove(g1);
  note('例：10, 20, 30, 40, 50，h(x) = x mod 10 → 全到 [0]', 0, 1.2, 1.6);
  say('上次的例子：10, 20, 30, 40, 50', 'x mod 10 全部是 0');
  await step(tok);                                   // 1:39 linked list also needs memory
  bad('linked list 也要額外記憶體', 0, 0.6, 2.6);
  say('串成 linked list，又要額外的記憶體');
  await step(tok);                                   // 2:14 h(x) = x mod 10 again, cells 0..9
  fresh([0, 8, 12], [0, 0.4, 0.6]);
  T = haRow(10, 1.15, -2.4);
  T.slots.forEach((s) => glow(s, GOLD)); await beat(tok, 500); T.slots.forEach((s) => glow(s, null));
  tag('h(x) = x mod 10', 'ptr', -4.6, 1.8, -3.6);
  say('在白板上再做一次：h(x) = x mod 10', '表有 0～9 共 10 格');
  await step(tok);                                   // 2:33 inputs 10 20 30 40 50
  const ks = [10, 20, 30, 40, 50].map((k, i) => cube(k, haCol(k), [0.9, 0.7, 0.9], 1.0 + i * 1.2, 0.4, 1.4, 3));
  say('輸入：10, 20, 30, 40, 50');
  await step(tok);                                   // 2:42 10 mod 10 is zero, 20 mod 10 is zero …
  const ar = ks.map((c, i) => arrow(V3(1.0 + i * 1.2, 0.8, 0.9), V3(T.xs[0] + 0.3, 0.8, T.z + 0.6), 0x7a1010));
  bad('全部 mod 10 = 0', 3.4, 1.8, 0.4);
  say('每個 mod 10 都是 0', '全部撞在 index 0');
  await step(tok);                                   // 2:53 a linked list like this: 50 40 30 20 10
  ar.forEach(kill);
  [50, 40, 30, 20, 10].forEach((k, r) => {
    arrow(V3(T.xs[0], 0.3, T.z + 0.6 + r * 1.0), V3(T.xs[0], 0.3, T.z + 1.0 + r * 1.0), 0x9a8a70);
    move(ks[[10, 20, 30, 40, 50].indexOf(k)], T.xs[0], 0.35, T.z + 1.35 + r * 1.0);
  });
  await beat(tok, 900);
  say('chaining：在 [0] 串成 50 → 40 → 30 → 20 → 10');
  await step(tok);                                   // 3:10 so many places in the table are free
  for (let i = 1; i < 10; i++) glow(T.slots[i], GREEN);
  good('這 9 格都空著！', 2.4, 1.2, T.z);
  say('可是表裡明明還有很多空格');
  await step(tok);                                   // 3:19 but we are using extra memory in this list
  ks.forEach((c) => glow(c, RED));
  say('卻另外花記憶體去做 linked list');
  await step(tok);                                   // 3:26 we want these memories utilized
  ks.forEach((c) => glow(c, null));
  [20, 30, 40, 50].forEach((k, i) => arrow(V3(T.xs[0] + 0.5, 0.6, T.z + 2.35 + i * 1.0), V3(T.xs[i + 1], 0.6, T.z + 0.55), 0x0f5a3a));
  say('想把這些空格用起來 → open addressing');
}]);

// 03:39 把空格用起來：10, 20, 30, 40 往下一格放
FRAG.push(['hasha-lp-idea', 'Linear probing：撞了就放下一格', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.4);
  const cur = tag('', 'ptr alt', T.xs[0], 2.1, T.z);
  await step(tok);                                   // 3:40 I utilize these places
  T.slots.forEach((s) => glow(s, GREEN)); await beat(tok, 500); T.slots.forEach((s) => glow(s, null));
  say('目標：把表裡的空格用起來', 'h(x) = x mod 10');
  await step(tok);                                   // 3:47 when I inserted 10, 10 came here
  await haTry(tok, T, 10, 0, cur, 'h(10) = 0');
  say('insert 10：10 mod 10 = 0 → 放 [0]');
  await step(tok);                                   // 3:54 20: collision, so it should come here
  await haTry(tok, T, 20, 0, cur, 'h(20) = 0', 600); unglow(T);
  await haTry(tok, T, 20, 1, cur, '下一格');
  say('insert 20：[0] 撞了 → 放下一格 [1]');
  await step(tok);                                   // 4:00 h(30) = 0, already filled
  await haTry(tok, T, 30, 0, cur, 'h(30) = 0');
  say('insert 30：h(30) = 0，但 [0] 已經滿了');
  await step(tok);                                   // 4:11 go to the next place, one: also filled
  unglow(T); await haTry(tok, T, 30, 1, cur, '+1');
  say('去下一格 [1]：也滿了');
  await step(tok);                                   // 4:18 next place … this is known as linear probing
  unglow(T); await haTry(tok, T, 30, 2, cur, '+2');
  tag('linear probing', 'ptr', 3.6, 2.0, -1.0);
  say('再下一格 [2] 是空的 → 放進去', '一格一格往下找：linear probing');
  await step(tok);                                   // 4:42 h(40): 0 not empty, 20, 30 … not empty
  for (const j of [0, 1, 2]) { await haTry(tok, T, 40, j, cur, '+' + j, 500); }
  say('insert 40：[0]、[1]、[2] 都不是空的');
  await step(tok);                                   // 4:54 I will put it here
  unglow(T); await haTry(tok, T, 40, 3, cur, '+3');
  say('40 放進 [3]');
  await step(tok);                                   // 5:01 h(x) becomes (hash(x) + f(i)) mod 10
  bub('h_i(x) = (hash(x) + f(i)) mod 10', 0, 2.8, -2.0);
  say('寫成式子：h_i(x) = (hash(x) + f(i)) mod 10', 'i = 第幾次嘗試（從 0 開始）');
  await step(tok);                                   // 5:14 in linear probing f(i) is nothing but i
  note('linear probing：f(i) = i', 3.6, 1.2, -2.0);
  say('linear probing 的 f(i) 就是 i');
  await step(tok);                                   // 5:25 h₀(x) = hash(x) + f(0) = hash(x)
  cur.position.set(T.xs[0], 2.1, T.z); txt(cur, 'h₀ = hash(x)');
  say('第一次 i = 0：f(0) = 0', 'h₀(x) = hash(x)，就是原本的位置');
  await step(tok);                                   // 5:52 others vary: +1, +2, +3 till resolved
  for (let i = 1; i <= 3; i++) { cur.position.set(T.xs[i], 2.1, T.z); txt(cur, 'h' + haSub(i) + ' = +' + i); await beat(tok, 500); }
  say('撞了就 +1、+2、+3 …… 直到不撞為止');
}]);

// 06:05 正式定義：h₀, h₁, h₂… 依序嘗試、wrap around
FRAG.push(['hasha-probe-def', 'Probe sequence：h_i(x) = (hash(x) + f(i)) mod m', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, -0.4]);
  const T = haRow(10, 1.15, 1.6);
  const cur = tag('', 'ptr alt', T.xs[0], 2.1, T.z);
  const cd = code(['h_i(x) = (hash(x) + f(i)) mod TableSize', 'f(0) = 0', 'linear     f(i) = i', 'quadratic  f(i) = i²', 'double     f(i) = i·hash₂(x)'], 0, 5.4, 0.5, -3.2);
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const show = (i) => { cd.ls[i].element.style.visibility = ''; };
  await step(tok);                                   // 6:06 cells h₀(x), h₁(x), h₂(x) tried in succession
  for (let i = 0; i < 3; i++) { cur.position.set(T.xs[i], 2.1, T.z); txt(cur, 'h' + haSub(i)); await beat(tok, 450); }
  say('h₀(x)、h₁(x)、h₂(x)……依序嘗試');
  await step(tok);                                   // 6:14 h_i(x) = (hash(x) + f(i)) mod TableSize, f(0) = 0
  show(0); show(1); cd.hl(0);
  say('h_i(x) = (hash(x) + f(i)) mod TableSize', '而且 f(0) = 0');
  await step(tok);                                   // 6:22 three common: linear, quadratic, double hashing
  show(2); show(3); show(4); cd.hl(2);
  say('三種常見：linear、quadratic、double hashing', '這一講用 linear probing');
  await step(tok);                                   // 6:38 resolved sequentially scanning, with wrap around
  for (const j of [7, 8, 9]) { cur.position.set(T.xs[j], 2.1, T.z); txt(cur, '[' + j + ']'); await beat(tok, 350); }
  arrow(V3(T.xs[9], 1.3, T.z - 0.9), V3(T.xs[0], 1.3, T.z - 0.9), 0xc08a1f);
  cur.position.set(T.xs[0], 2.1, T.z); txt(cur, '繞回 [0]');
  say('依序往下掃，到底就 wrap around 回到開頭', '直到找到空格');
  await step(tok);                                   // 6:49 h(20) is zero but occupied → next place
  haPlace(T, 0, 10, true); await beat(tok, 400);
  await haTry(tok, T, 20, 0, cur, 'h(20) = 0', 500); unglow(T);
  await haTry(tok, T, 20, 1, cur, '下一格', 500);
  say('就像剛才：20 的 [0] 被 10 佔了 → 放下一格');
  await step(tok);                                   // 7:01 h(30): 0 and 1 occupied, come to [2]
  await haTry(tok, T, 30, 0, cur, '[0]', 400); await haTry(tok, T, 30, 1, cur, '[1]', 400); unglow(T);
  await haTry(tok, T, 30, 2, cur, '[2]', 500);
  say('30：[0]、[1] 都被佔 → 放 [2]');
  await step(tok);                                   // 7:08 f is linear, typically f(i) = i
  cd.hl(2);
  say('f 是線性函數，通常取 f(i) = i');
  await step(tok);                                   // 7:15 h(20) collided: f(1) = 1, moved to next place
  glow(T.keys[1], GOLD);
  arrow(V3(T.xs[0], 1.4, T.z - 0.9), V3(T.xs[1], 1.4, T.z - 0.9), 0xc08a1f);
  say('20 第一次撞 → f(1) = 1，所以 +1 到下一格', 'h₁(20) = (0 + 1) mod 10 = 1');
}]);

// 07:30 依序 insert 89, 18, 49, 58, 9
FRAG.push(['hasha-lp-89', 'Linear probing：insert 89, 18, 49, 58, 9', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  let T;
  const cur = tag('', 'ptr alt', 0, 2.1, 0.4);
  await step(tok);                                   // 7:30 linear probing hash table after each insertion
  T = haRow(10, 1.15, 0.4);
  say('看每次 insert 之後，表長什麼樣子', '表大小 10');
  await step(tok);                                   // 7:47 h_i(x) = (hash(x) + f(i)) mod size, hash(x) = x mod 10
  bub('h_i(x) = (x mod 10 + i) mod 10', 0, 2.9, -1.6);
  say('hash(x) = x mod 10，撞了就 + i', '依序 insert 89, 18, 49, 58, 9');
  await step(tok);                                   // 8:09 89 mod 10 = 9, 9 is free
  await haTry(tok, T, 89, 9, cur, 'h₀ = 9');
  say('89 mod 10 = 9，[9] 空的 → 放 [9]');
  await step(tok);                                   // 8:19 18 mod 10 = 8, cell 8 free
  await haTry(tok, T, 18, 8, cur, 'h₀ = 8');
  say('18 mod 10 = 8 → 放 [8]');
  await step(tok);                                   // 8:35 49 mod 10 = 9: now 9 is filled
  await haTry(tok, T, 49, 9, cur, 'h₀ = 9');
  say('49 mod 10 = 9，但 [9] 已經放了 89', 'collision');
  await step(tok);                                   // 8:56 H₁(49) = (9 + 1) mod 10 = 0 → 49 comes here
  unglow(T); await haTry(tok, T, 49, 0, cur, 'h₁ = 0');
  say('h₁(49) = (9 + 1) mod 10 = 0 → 放 [0]', '不用掛 linked list，表裡還有很多空位');
  await step(tok);                                   // 9:27 58 → h₀ = 8: collision
  await haTry(tok, T, 58, 8, cur, 'h₀ = 8');
  say('58 mod 10 = 8：[8] 被 18 佔了');
  await step(tok);                                   // 9:37 H₁(58) = (8 + 1) mod 10 = 9: again collision
  unglow(T); await haTry(tok, T, 58, 9, cur, 'h₁ = 9');
  say('h₁(58) = (8 + 1) mod 10 = 9：又撞');
  await step(tok);                                   // 9:45 H₂(58) = (8 + 2) mod 10 = 0: collision here also
  unglow(T); await haTry(tok, T, 58, 0, cur, 'h₂ = 0');
  say('h₂(58) = (8 + 2) mod 10 = 0：還是撞');
  await step(tok);                                   // 10:02 H₃(58) = (8 + 3) mod 10 = 1 → 58 comes here
  unglow(T); await haTry(tok, T, 58, 1, cur, 'h₃ = 1');
  say('h₃(58) = (8 + 3) mod 10 = 1 → 放 [1]', '58 一共試了 4 次');
  await step(tok);                                   // 10:23 9: tries to come here, not available
  await haTry(tok, T, 9, 9, cur, 'h₀ = 9');
  say('insert 9：9 mod 10 = 9，[9] 不能放');
  await step(tok);                                   // 10:29 tries plus one: not available
  unglow(T); await haTry(tok, T, 9, 0, cur, 'h₁ = 0');
  say('+1 → [0]：也不能放');
  await step(tok);                                   // 10:43 let's do the last one again: h(9) = 9, filled
  unglow(T); await haTry(tok, T, 9, 9, cur, 'h₀ = 9');
  say('老師用公式再算一次：h₀(9) = 9，滿了');
  await step(tok);                                   // 10:50 H₁(9) = (9 + 1) mod 10 = 0
  unglow(T); await haTry(tok, T, 9, 0, cur, 'h₁ = 0');
  say('h₁(9) = (9 + 1) mod 10 = 0：滿了');
  await step(tok);                                   // 10:59 H₂(9) = 11 mod 10 = 1: cannot go here
  unglow(T); await haTry(tok, T, 9, 1, cur, 'h₂ = 1');
  say('h₂(9) = (9 + 2) mod 10 = 1：還是滿的');
  await step(tok);                                   // 11:10 H₃(9) = 12 mod 10 = 2 → finds its place
  unglow(T); await haTry(tok, T, 9, 2, cur, 'h₃ = 2');
  say('h₃(9) = (9 + 3) mod 10 = 2 → 放 [2]', '9 也試了 4 次');
  await step(tok);                                   // 11:21 each step has a different h_i
  bub('49→[0]、58→[1]、9→[2]：每次撞了就換下一個 h_i', 0, 1.5, 2.8);
  say('每多撞一次，就用下一個 h_i 算');
}]);

// 11:41 Find：走同一條 probe sequence（58：4 次；19：5 次）
FRAG.push(['hasha-find', 'Find：走同一條 probe sequence（58 要 4 次、19 要 5 次）', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, -0.4);
  const cur = tag('', 'ptr alt', 0, 2.1, T.z);
  const look = async (j, k, lbl) => { cur.position.set(T.xs[j], 2.1, T.z); txt(cur, lbl); const c = T.keys[j]; if (!c) { glow(T.slots[j], RED); return 'empty'; } glow(c, T.vals[j] === k ? GREEN : GOLD); return T.vals[j] === k ? 'hit' : 'miss'; };
  await step(tok);                                   // 11:41 find follows the same probe sequence as insert
  [[9, 89], [8, 18], [0, 49], [1, 58], [2, 9]].forEach(([i, k]) => haPlace(T, i, k, true));
  say('Find（搜尋）跟 insert 走同一條 probe sequence');
  await step(tok);                                   // 11:45 to find 58 would involve four probes
  const q = buddy('找 58', 58, haCol(58), -6.2, 0, 2.2, 0.7);
  say('find 58：要 probe 4 次');
  await step(tok);                                   // 11:58 h(58) = 8: 58 is not there
  await look(8, 58, 'h₀ = 8');
  say('h(58) = 8：[8] 是 18，不是');
  await step(tok);                                   // 12:06 H₁(58) = 9: not found
  unglow(T); await look(9, 58, 'h₁ = 9');
  say('h₁(58) = 9：是 89，不是');
  await step(tok);                                   // 12:16 H₂(58) = 0: doesn't find it here
  unglow(T); await look(0, 58, 'h₂ = 0');
  say('h₂(58) = 0：是 49，不是');
  await step(tok);                                   // 12:25 H₃(58) = 1: finds it
  unglow(T); await look(1, 58, 'h₃ = 1');
  q.mood('happy'); await q.hop(tok);
  say('h₃(58) = (8 + 3) mod 10 = 1：找到了！');
  await step(tok);                                   // 12:33 so it requires four probes
  good('find 58：4 次 probe', T.xs[1], 1.2, T.z - 1.0);
  say('所以 find 58 總共 probe 4 次');
  await step(tok);                                   // 12:39 19 would involve five probes
  unglow(T); q.set(19); q.mood('calm');
  for (const [i, j] of [[0, 9], [1, 0], [2, 1], [3, 2]]) { await look(j, 19, 'h' + haSub(i)); await beat(tok, 380); unglow(T); }
  await look(3, 19, 'h₄ = 3');
  q.mood('sad');
  bad('19：遇到空格 → 不在表裡（5 次）', T.xs[3] + 1.2, 1.2, T.z + 1.6);
  say('find 19：9 → 0 → 1 → 2 → 3（空格）', '5 次 probe 才確定「不在表裡」');
}]);

// 12:44 clustering：89,18,49,58,9 擠成 [8]～[2] 一大塊
FRAG.push(['hasha-cluster', 'Clustering：撞進群聚就要走到底', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.4);
  const cur = tag('', 'ptr alt', T.xs[8], 2.1, T.z);
  await step(tok);                                   // 12:44 clustering problem; free cells always found
  [[9, 89], [8, 18], [0, 49], [1, 58], [2, 9]].forEach(([i, k]) => haPlace(T, i, k));
  say('問題：clustering（群聚）', '只要表夠大，空格一定找得到');
  await step(tok);                                   // 12:49 but the time to find will become larger
  for (const j of [8, 9, 0, 1, 2, 3]) { cur.position.set(T.xs[j], 2.1, T.z); txt(cur, '[' + j + ']'); await beat(tok, 300); }
  say('但找的時間會變長');
  await step(tok);                                   // 12:56 called the clustering problem
  for (const i of [8, 9, 0, 1, 2]) glow(T.keys[i], GOLD);
  tag('cluster', 'ptr', T.xs[0] + 0.6, 1.4, T.z - 1.3);
  say('連續被占的一大塊 = cluster', '[8] [9] [0] [1] [2]');
  await step(tok);                                   // 13:02 hit something here → go all the way down
  const seq = [8, 9, 0, 1, 2, 3];
  for (let i = 0; i < seq.length; i++) { cur.position.set(T.xs[seq[i]], 2.1, T.z); txt(cur, 'h' + haSub(i)); await beat(tok, 380); }
  glow(T.slots[3], GREEN);
  say('hash 到這一塊的任何位置，都要一路走到底', '例：hash 到 8 → 第 6 次才到空格 [3]');
  await step(tok);                                   // 13:13 λ should be less than 0.5
  bub('λ 最好 < 0.5：空格夠多，cluster 才不會太長', 0, 1.2, 2.6);
  say('老師：load factor λ 最好小於 0.5', '這是讓 cluster 不太長的經驗值，不是硬性條件');
}]);

// 13:20 表大小 11：成功搜尋平均 15/8、失敗搜尋要走到空格
FRAG.push(['hasha-avg11', '平均 probe 次數：表大小 11', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = haRow(11, 1.05, 0.2);
  const cur = tag('', 'ptr alt', T.xs[9], 2.1, T.z);
  const cnt = (i, n) => tag(n + ' 次', 'idx', T.xs[i], 1.25, T.z - 0.75);
  await step(tok);                                   // 13:20 average probes for successful / unsuccessful search
  [[0, 9], [2, 2], [3, 13], [4, 25], [5, 24], [8, 30], [9, 20], [10, 10]].forEach(([i, k]) => haPlace(T, i, k, true));
  say('平均要 probe 幾次？成功搜尋 vs 失敗搜尋', '表大小 11，hash(x) = x mod 11');
  await step(tok);                                   // 13:30 h(20) = 20 mod 11 = 9: find 20 here
  cur.position.set(T.xs[9], 2.1, T.z); txt(cur, '9'); glow(T.keys[9], GREEN); cnt(9, 1);
  say('find 20：20 mod 11 = 9 → 一次就找到');
  await step(tok);                                   // 13:39 h(30) = 8: just one hit
  glow(T.keys[9], null); cur.position.set(T.xs[8], 2.1, T.z); txt(cur, '8'); glow(T.keys[8], GREEN); cnt(8, 1);
  say('30 mod 11 = 8 → 也是一次');
  await step(tok);                                   // 13:57 2 mod 11 = 2
  glow(T.keys[8], null); cur.position.set(T.xs[2], 2.1, T.z); txt(cur, '2'); glow(T.keys[2], GREEN); cnt(2, 1);
  say('2 mod 11 = 2 → 一次');
  await step(tok);                                   // 14:06 13 mod 11 = 2, not here; +1 → 3, found
  glow(T.keys[2], GOLD); await beat(tok, 600); glow(T.keys[2], null);
  cur.position.set(T.xs[3], 2.1, T.z); txt(cur, '3'); glow(T.keys[3], GREEN); cnt(3, 2);
  say('13 mod 11 = 2 不是 → +1 到 [3] 找到', '2 次');
  await step(tok);                                   // 14:24 25 … (說成 25 mod 11 = 4，其實是 3)
  glow(T.keys[3], GOLD); await beat(tok, 600); glow(T.keys[3], null);
  cur.position.set(T.xs[4], 2.1, T.z); txt(cur, '4'); glow(T.keys[4], GREEN); cnt(4, 2);
  say('25：老師說 25 mod 11 = 4，其實是 3', '[3] 是 13 → +1 到 [4] 找到，2 次');
  await step(tok);                                   // 14:39 average number of probes is 15/8
  glow(T.keys[4], null);
  cnt(5, 4); cnt(10, 1); cnt(0, 3);
  say('8 個 key 的 probe 次數加起來 = 15', '1+1+1+2+2+4+1+3 = 15 → 平均 15/8');
  await step(tok);                                   // 14:49 less than two
  good('成功搜尋平均 15/8 ≈ 1.88 < 2', 0, 2.9, -1.6);
  say('成功搜尋平均不到 2 次');
  await step(tok);                                   // 14:59 unsuccessful search: searching 0
  cur.position.set(T.xs[0], 2.1, T.z); txt(cur, 'find 0'); glow(T.keys[0], GOLD);
  say('失敗搜尋：find 0', '0 mod 11 = 0 → [0] 是 9，不是');
  await step(tok);                                   // 15:22 H₁(0) = 1: empty → stop
  glow(T.keys[0], null); cur.position.set(T.xs[1], 2.1, T.z); txt(cur, '空格 → 停'); glow(T.slots[1], RED);
  say('h₁(0) = 1：遇到空格就停', '0 不在表裡（2 次）');
  await step(tok);                                   // 15:47 find 4: 4 mod 11 = 4, not found
  glow(T.slots[1], null); cur.position.set(T.xs[4], 2.1, T.z); txt(cur, 'find 4'); glow(T.keys[4], GOLD);
  say('find 4：4 mod 11 = 4 → [4] 是 25，不是');
  await step(tok);                                   // 15:53 increment by one: 5, don't find it
  glow(T.keys[4], null); cur.position.set(T.xs[5], 2.1, T.z); txt(cur, '+1'); glow(T.keys[5], GOLD);
  say('+1 → [5] 是 24，也不是');
  await step(tok);                                   // 16:00 increment again: empty cell → not found
  glow(T.keys[5], null); cur.position.set(T.xs[6], 2.1, T.z); txt(cur, '空格'); glow(T.slots[6], RED);
  say('再 +1 → [6] 是空格 → 4 不在表裡', '3 次 probe');
  await step(tok);                                   // 16:05 unsuccessful search requires more comparisons
  bad('失敗搜尋一定要走到空格才能停 → 比較貴', 0, 2.3, 2.6);
  say('失敗搜尋要找到空格才能停', '所以比成功搜尋更花時間');
}]);

// ════════ mFY0J5W8Udk（Abdul Bari） ════════
const BARI = [8, 3, 13, 6, 4, 10];
// 00:01 linear search O(n) vs binary search O(log n)
FRAG.push(['hasha-search-cmp', 'Linear search O(n) vs Binary search O(log n)', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const xs = BARI.map((_, i) => -3.75 + i * 1.5);
  const cur = tag('', 'ptr alt', xs[0], 1.6, -2.2);
  let top, bot;
  await step(tok);                                   // 0:01 hashing technique is useful for searching
  bub('Hashing：為了「搜尋」而設計', 0, 3.0, -4.0);
  say('Hashing 這個技巧是用來做搜尋的');
  await step(tok);                                   // 0:17 linear search: elements in any order
  top = BARI.map((v, i) => cube(v, haCol(v), [1.1, 0.7, 1.0], xs[i], 0.35, -2.2, 3));
  tag('linear search：隨便排', 'ptr', -6.0, 0.9, -2.2);
  say('先複習線性搜尋（linear search）', '元素在陣列裡隨便排');
  await step(tok);                                   // 0:29 time for searching is order of n
  note('O(n)', 5.6, 1.2, -2.2);
  say('搜尋時間 O(n)');
  await step(tok);                                   // 0:38 start from the left toward the right
  for (let i = 0; i < top.length; i++) { cur.position.set(xs[i], 1.6, -2.2); txt(cur, '找 10'); glow(top[i], BARI[i] === 10 ? GREEN : GOLD); await beat(tok, 380); if (BARI[i] !== 10) glow(top[i], null); }
  say('從左邊開始一個一個比，比到 10 才停', '找 10：比了 6 次');
  await step(tok);                                   // 0:52 binary search: elements must be sorted
  const srt = [...BARI].sort((a, b) => a - b);
  bot = srt.map((v, i) => cube(v, haCol(v), [1.1, 0.7, 1.0], xs[i], 0.35, 1.8, 3));
  tag('binary search：要先排序', 'ptr', -6.0, 0.9, 1.8);
  say('二分搜尋（binary search）', '元素必須先由小到大排好');
  await step(tok);                                   // 0:59 look in the middle; larger → right, smaller → left
  cur.position.set(xs[2], 1.6, 1.8); txt(cur, 'mid'); glow(bot[2], GOLD); await beat(tok, 700);
  for (let i = 0; i <= 2; i++) tint(bot[i], GRAY);
  cur.position.set(xs[4], 1.6, 1.8); glow(bot[4], GREEN);
  say('每次看中間：6 < 10 → 往右半邊', '下一個中間就是 10，比 2 次');
  await step(tok);                                   // 1:11 the time for searching is order of log n
  note('O(log n)', 5.6, 1.2, 1.8);
  say('每次砍掉一半 → O(log n)');
  await step(tok);                                   // 1:39 must spend some extra time sorting
  bad('但要先花時間排序', -1.0, 2.6, 0.0);
  say('前提：要先排序，得多花排序的時間');
  await step(tok);                                   // 1:43 we want constant time: n → log n → O(1)
  bub('O(n) → O(log n) → O(1)？', 2.6, 3.2, 0.0);
  say('想要更快：只花常數時間的搜尋', 'O(n) → O(log n) → O(1)');
  await step(tok);                                   // 1:56 this introduces the hashing technique
  good('→ hashing', 5.6, 2.4, 0.0);
  say('這個需求，就引出了 hashing');
}]);

// 02:03 直接拿值當 index
FRAG.push(['hasha-direct', '直接拿 key 當 index：O(1) 但浪費空間', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  let T;
  await step(tok);                                   // 2:03 list of elements and array space given
  T = haRow(14, 0.92, 0.6);
  BARI.forEach((k, i) => tag(String(k), 'pkt', -5.0 + i * 0.9, 2.6, -2.6));
  say('手上有一串元素，和一個陣列');
  await step(tok);                                   // 2:16 take the value itself as the index
  bub('值是多少，就放第幾格', 0, 2.8, -1.2);
  say('最簡單的 hashing：拿元素的值當 index');
  await step(tok);                                   // 2:22 8 is stored at 8
  haPlace(T, 8, 8, true);
  say('8 放在 [8]');
  await step(tok);                                   // 2:27 3 at location 3, and so on
  for (const k of [3, 13, 6, 4, 10]) { haPlace(T, k, k, true); await beat(tok, 300); }
  say('3 放 [3]，其他依此類推');
  await step(tok);                                   // 2:39 search for 10: directly go to index 10
  const cur = tag('search 10', 'ptr alt', T.xs[10], 2.0, T.z);
  glow(T.keys[10], GREEN);
  say('search 10：直接看 [10] → 有');
  await step(tok);                                   // 2:50 search for 12: index 12 → not found
  glow(T.keys[10], null); cur.position.set(T.xs[12], 2.0, T.z); txt(cur, 'search 12'); glow(T.slots[12], RED);
  say('search 12：直接看 [12] → 空的，找不到');
  await step(tok);                                   // 2:56 search time is order of 1
  glow(T.slots[12], null);
  good('O(1)：一步就知道', T.xs[12], 1.3, T.z - 1.0);
  say('不管有沒有，一步就知道 → O(1)');
  await step(tok);                                   // 3:00 one more element 50 → index 50, far away
  const c50 = cube(50, haCol(50), [0.8, 0.7, 0.9], 5.6, 0.4, -2.4, 3);
  arrow(V3(5.6, 0.4, -1.8), V3(7.0, 0.4, 0.6), 0x7a1010);
  bad('要開到 index 50！', 5.4, 1.6, -2.4);
  say('多一個 50：表就得開到 index 50', '可能非常遠');
  await step(tok);                                   // 3:16 a lot of space is wasted; most places vacant
  for (let i = 0; i < T.m; i++) if (T.keys[i] === null) glow(T.slots[i], RED);
  say('為了省時間，浪費大量空間', '只存幾個數，卻要很大的陣列，大部分空著');
}]);

// 03:34 數學模型：key space → hash table，h(x) = x
FRAG.push(['hasha-model', 'Key space → Hash table：h(x) = x', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0]);
  const kx = BARI.map((_, i) => -3.75 + i * 1.5);
  let T, ks;
  await step(tok);                                   // 3:34 a mathematical model based on functions
  bub('用「函數」來描述 hashing', 0, 3.0, -4.6);
  say('為了改進，先用數學（函數）把它寫清楚');
  await step(tok);                                   // 3:47 the list of elements: key space
  ks = ghostBox('#9b7ef4', 9.6, 1.2, 1.6); ks.position.set(0, 0.6, -3.2);
  tag('key space', 'ptr', -5.6, 1.2, -3.2);
  BARI.forEach((v, i) => cube(v, haCol(v), [0.9, 0.7, 0.9], kx[i], 0.4, -3.2, 3));
  say('手上的這些元素，叫 key space');
  await step(tok);                                   // 3:53 the place where we store them: hash table
  T = haRow(14, 0.92, 1.8);
  tag('hash table', 'ptr', -6.3, 1.0, 1.8);
  say('存放它們的地方，叫 hash table');
  await step(tok);                                   // 3:57 some function h(x) = x mapping key space → table
  const hx = bub('h(x) = x', 5.6, 2.2, -1.0);
  say('中間有一個函數 h(x) = x，負責「映射」', '把 key space 的 key 對應到 hash table');
  await step(tok);                                   // 4:04 h(8) = 8 → stored at index 8
  arrow(V3(kx[0], 0.5, -2.35), V3(T.xs[8], 0.6, T.z - 0.65), 0x9b7ef4); haPlace(T, 8, 8, true);
  say('h(8) = 8 → 放 [8]');
  await step(tok);                                   // 4:11 3 stored at 3, h(13) = 13 → index 13
  for (let i = 1; i < BARI.length; i++) { const k = BARI[i]; arrow(V3(kx[i], 0.5, -2.35), V3(T.xs[k], 0.6, T.z - 0.65), 0x9b7ef4); haPlace(T, k, k, true); await beat(tok, 300); }
  say('h(3) = 3、h(13) = 13 ……');
  await step(tok);                                   // 4:38 h(x) = x: an ideal hash function
  good('理想的 hash function', 5.6, 1.4, -1.0);
  say('h(x) = x 是「理想」的 hash function', '每個 key 一格，搜尋 O(1)');
  await step(tok);                                   // 4:54 key 50 → index 50: very lengthy table
  bad('key 50 → 要 index 50', 5.0, 0.6, 3.4);
  say('問題一樣：key 是 50 就要 index 50', '表太長，浪費空間');
  await step(tok);                                   // 5:11 two types: one-to-one and many-to-one
  remove(hx);
  bub('one-to-one：一個 key 一格', -3.6, 2.6, -0.6); bub('many-to-one：好幾個 key 共用一格', 2.6, 2.6, -0.6);
  say('函數有兩種：one-to-one、many-to-one');
  await step(tok);                                   // 5:25 h(x) = x is one-to-one; others mostly many-to-one
  note('h(x) = x 是 one-to-one', -3.6, 1.6, -0.6); note('換別的函數，多半是 many-to-one', 2.6, 1.6, -0.6);
  say('h(x) = x 是 one-to-one', '換成其他函數，多半是 many-to-one');
  await step(tok);                                   // 5:44 modify the function to use the space efficiently
  good('改函數 → 空間用得更有效率', 0, 3.4, 3.2);
  say('h 決定 key 放哪 → 改 h，就能更省空間');
}]);

// 05:59 h(x) = x mod 10：13 撞 3 → collision
FRAG.push(['hasha-mod10', 'h(x) = x mod 10：13 與 3 撞在一起', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  let T;
  const cur = tag('', 'ptr alt', 0, 2.1, 1.2);
  await step(tok);                                   // 5:59 h(x) = x mod size
  bub('h(x) = x mod size', 0, 2.8, -2.6);
  say('改用 h(x) = x mod size', 'size = hash table 的大小；mod = 取餘數');
  await step(tok);                                   // 6:16 take the hash table size as 10
  T = haRow(10, 1.15, 1.2);
  say('例子：size 取 10 → 只要 10 格');
  await step(tok);                                   // 6:38 8 mod 10 gives 8 → stored here
  await haTry(tok, T, 8, 8, cur, 'h(8) = 8');
  say('8 mod 10 = 8 → 放 [8]');
  await step(tok);                                   // 6:46 3 mod 10 = 3 → stored here
  await haTry(tok, T, 3, 3, cur, 'h(3) = 3');
  say('3 mod 10 = 3 → 放 [3]');
  await step(tok);                                   // 6:58 13 mod 10 also 3 → collision
  const c13 = haHover(T, 3, 13); glow(c13, RED); glow(T.keys[3], RED);
  cur.position.set(T.xs[3], 2.6, T.z); txt(cur, 'h(13) = 3');
  bad('collision', T.xs[3] + 1.6, 1.9, T.z);
  say('13 mod 10 也是 3 → 撞了', 'collision');
  await step(tok);                                   // 7:06 two or more elements mapped at the same index
  bub('兩個以上的 key 對到同一個 index = collision', 0, 2.4, -1.4);
  say('換了 hash function，就可能好幾個 key 對到同一格', '這就叫 collision，必須處理');
  await step(tok);                                   // 7:29 open hashing → chaining
  tag('open hashing → chaining', 'ptr', -3.0, 1.0, -3.6);
  say('解法一：open hashing（chaining）');
  await step(tok);                                   // 7:35 closed hashing → linear / quadratic probing
  tag('closed hashing → linear / quadratic probing', 'ptr alt', 2.4, 1.0, -4.4);
  say('解法二：closed hashing', 'linear probing、quadratic probing');
}]);

// 07:45 chaining：8, 3, 13, 6, 4, 10；search 13
FRAG.push(['hasha-bari-chain', 'Chaining：8, 3, 13, 6, 4, 10', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.2]);
  let T;
  const len = new Array(10).fill(0), nodes = {};
  const hang = (k) => {
    const j = k % 10, z = T.z + 1.65 + len[j] * 1.5;
    arrow(V3(T.xs[j], 0.4, z - 1.15), V3(T.xs[j], 0.4, z - 0.45), 0x9a8a70);
    nodes[k] = cube(k, haCol(k), [0.9, 0.6, 0.8], T.xs[j], 0.35, z, 3);
    len[j]++;
  };
  await step(tok);                                   // 7:45 first method: chaining
  T = haRow(10, 1.15, -2.6);
  tag('chaining（open hashing）', 'ptr', -4.6, 1.6, -3.8);
  say('第一種方法：chaining');
  await step(tok);                                   // 7:57 8 mapped at 8: not in the table, add a chain
  hang(8);
  say('8 → index 8：不放在表本身，而是在 [8] 掛一條 chain');
  await step(tok);                                   // 8:08 chain is nothing but a linked list
  note('chain = linked list', T.xs[8] + 0.6, 1.2, T.z + 2.8);
  say('chain 就是 linked list（一節一節串起來）');
  await step(tok);                                   // 8:16 3 mapped here: add a node, insert 3
  hang(3);
  say('3 → index 3：在 [3] 的 chain 加一個節點');
  await step(tok);                                   // 8:25 13 also mapped here: add a new node
  hang(13);
  say('13 也到 index 3 → 再加一個節點存 13');
  await step(tok);                                   // 8:30 on collision: insert at the same index, in a chain
  glow(nodes[3], GOLD); glow(nodes[13], GOLD);
  say('collision 就接在同一個 index 的 chain 上');
  await step(tok);                                   // 8:37 all elements inserted into their chains
  glow(nodes[3], null); glow(nodes[13], null);
  for (const k of [6, 4, 10]) { hang(k); await beat(tok, 350); }
  say('其他元素也照樣放：6、4、10');
  await step(tok);                                   // 9:03 search 13: h(13) = 13 mod 10 = 3
  const cur = tag('h(13) = 3', 'ptr alt', T.xs[3], 2.0, T.z);
  glow(T.slots[3], GOLD);
  say('search 13：h(13) = 13 mod 10 = 3');
  await step(tok);                                   // 9:21 go to index 3, search the chain there
  glow(T.slots[3], null);
  cur.position.set(T.xs[3] + 1.4, 1.0, nodes[3].position.z); txt(cur, '3？不是'); glow(nodes[3], GOLD); await beat(tok, 800);
  glow(nodes[3], null); cur.position.set(T.xs[3] + 1.4, 1.0, nodes[13].position.z); txt(cur, '13 找到'); glow(nodes[13], GREEN);
  say('到 index 3 的 chain 裡一個一個找');
  await step(tok);                                   // 9:27 may be more than one: search the entire list
  bub('chain 上可能不只一個 → 要搜整條', 3.4, 1.6, 0.6);
  say('一條 chain 可能有好幾個，要搜整條 linked list');
  await step(tok);                                   // 9:31 not O(1), but faster than log n
  good('平均 O(1 + α)；最壞全擠一條 O(n)', 3.4, 0.6, 2.2);
  say('老師：不是 O(1)，但比 log n 快', '只在 α 小時的平均成立：O(1 + α)；最壞 O(n)');
}]);

// 09:51 linear probing：8, 3, 13, 6, 4, 10；search 4、24；clustering
FRAG.push(['hasha-bari-lp', 'Linear probing：search 4 與 24', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  let T;
  const cur = tag('', 'ptr alt', 0, 2.1, 0.6);
  await step(tok);                                   // 9:51 next method: linear probing, h(x) = x mod size
  T = haRow(10, 1.15, 0.6);
  tag('linear probing（closed hashing）', 'ptr', -4.0, 2.4, -1.4);
  say('下一個方法：linear probing', '一樣用 h(x) = x mod 10');
  await step(tok);                                   // 9:59 8 mapped at 8, 3 mapped at 3
  haPlace(T, 8, 8, true); haPlace(T, 3, 3, true);
  say('8 → [8]、3 → [3]');
  await step(tok);                                   // 10:10 13 also mapped at the same location: collision
  const c13 = haHover(T, 3, 13); glow(c13, RED); glow(T.keys[3], RED);
  say('13 也對到 [3] → collision');
  await step(tok);                                   // 10:14 store it at the next free space
  kill(c13); unglow(T); await haTry(tok, T, 13, 4, cur, '下一格');
  say('放到下一個空位 [4]');
  await step(tok);                                   // 10:38 h'(x) = (h(x) + f(i)) mod size
  bub("h'(x) = (h(x) + f(i)) mod 10", 0, 3.2, -2.6);
  say("用數學說明：h'(x) = (h(x) + f(i)) mod size");
  await step(tok);                                   // 10:51 f(i) = i, i = 0, 1, 2, …
  note('f(i) = i，i = 0, 1, 2, …', 4.4, 2.4, -1.4);
  say('f(i) = i，i 從 0 開始：0、1、2、……');
  await step(tok);                                   // 11:06 13: i = 0 → 3, collision
  note('i = 0：(3 + 0) mod 10 = 3 ✗', T.xs[3] - 0.6, 1.3, T.z + 1.9);
  glow(T.keys[3], RED);
  say("insert 13：i = 0 → (3 + 0) mod 10 = 3", '撞了');
  await step(tok);                                   // 11:28 next value of i: (3 + 1) mod 10 = 4
  glow(T.keys[3], null); glow(T.keys[4], GREEN);
  note('i = 1：(3 + 1) mod 10 = 4 ✓', T.xs[4] + 0.6, 1.3, T.z + 2.7);
  say("i = 1 → (3 + 1) mod 10 = 4 → 放 [4]", '再撞就再增加 i');
  await step(tok);                                   // 12:01 6 at 6; 4: collision
  glow(T.keys[4], null);
  await haTry(tok, T, 6, 6, cur, 'h(6) = 6', 500);
  await haTry(tok, T, 4, 4, cur, 'h(4) = 4', 500);
  say('6 → [6]；4 → [4] 已經有 13 了');
  await step(tok);                                   // 12:10 store it at the next place; 10 stored here
  unglow(T); await haTry(tok, T, 4, 5, cur, '下一格', 500);
  await haTry(tok, T, 10, 0, cur, 'h(10) = 0', 500);
  say('4 往下放到 [5]；10 → [0]');
  await step(tok);                                   // 12:18 search 4: go to index 4, not present
  cur.position.set(T.xs[4], 2.1, T.z); txt(cur, 'search 4'); glow(T.keys[4], GOLD);
  say('search 4：h(4) = 4 → [4] 是 13，不是');
  await step(tok);                                   // 12:29 look at the next location: found at index 5
  glow(T.keys[4], null); cur.position.set(T.xs[5], 2.1, T.z); txt(cur, '找到'); glow(T.keys[5], GREEN);
  say('看下一格 [5]：找到 4');
  await step(tok);                                   // 12:53 search 24: 24 mod 10 → index 4, not present
  glow(T.keys[5], null); cur.position.set(T.xs[4], 2.1, T.z); txt(cur, 'search 24'); glow(T.keys[4], GOLD);
  say('search 24：24 mod 10 = 4 → [4] 不是');
  await step(tok);                                   // 13:01 next location: not present, not present
  glow(T.keys[4], null);
  for (const j of [5, 6]) { cur.position.set(T.xs[j], 2.1, T.z); glow(T.keys[j], GOLD); await beat(tok, 500); glow(T.keys[j], null); }
  say('[5] 不是、[6] 也不是');
  await step(tok);                                   // 13:06 next location empty: stop, 24 not found
  cur.position.set(T.xs[7], 2.1, T.z); txt(cur, '空格 → 停'); glow(T.slots[7], RED);
  say('[7] 是空格 → 停，24 不在表裡');
  await step(tok);                                   // 13:17 until the element is found or empty space reached
  glow(T.slots[7], null);
  bub('搜尋規則：找到它，或遇到空格才停', 0, 1.2, 2.8);
  say('搜尋：從 h(x) 開始往後找，直到找到或遇到空格');
  await step(tok);                                   // 13:28 not O(1), but better than log n
  good('表不太滿時平均很快；最壞 O(n)', 0, 0.5, 3.6);
  say('老師：不是 O(1)，但通常比 log n 好', '這是表不太滿時的平均情況；最壞可到 O(n)');
  await step(tok);                                   // 13:41 problem: clustering of elements
  for (const i of [3, 4, 5, 6]) glow(T.keys[i], GOLD);
  tag('cluster', 'ptr', T.xs[4] + 0.6, 1.5, T.z - 1.3);
  say('問題：clustering，元素擠在連續的一塊', 'cluster 越長，搜尋越慢');
}]);

// 13:58 quadratic probing：f(i) = i²，23 跳到 [7]
FRAG.push(['hasha-bari-qp', 'Quadratic probing：23 跳到 [7]', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  let T;
  const cur = tag('', 'ptr alt', 0, 2.1, 0.6);
  await step(tok);                                   // 13:58 to avoid clustering: quadratic probing
  T = haRow(10, 1.15, 0.6);
  tag('quadratic probing', 'ptr', -4.6, 2.4, -1.4);
  say('為了避免 clustering → quadratic probing');
  await step(tok);                                   // 14:07 same as linear: h'(x) = (h(x) + f(i)) mod size
  bub("h'(x) = (h(x) + f(i)) mod 10", 0, 3.2, -2.6);
  say('跟 linear probing 一樣的式子');
  await step(tok);                                   // 14:25 but f(i) is i², i = 0, 1, 2, …
  note('f(i) = i²', 4.4, 2.4, -1.4);
  say('只是 f(i) = i²，i = 0、1、2 ……');
  await step(tok);                                   // 14:48 linear: f(i) = i；quadratic: f(i) = i²
  bub('linear：+1, +2, +3 …　quadratic：+1, +4, +9 …', 0, 1.4, 2.8);
  say('linear：f(i) = i；quadratic：f(i) = i²', '跳 1, 2, 3… 對比 跳 1, 4, 9…');
  await step(tok);                                   // 15:08 8 stored here, 3 same place
  haPlace(T, 8, 8, true); haPlace(T, 3, 3, true);
  say('8 → [8]、3 → [3]');
  await step(tok);                                   // 15:18 13: collision, for i = 1 next location
  await haTry(tok, T, 13, 3, cur, 'i = 0', 500); unglow(T);
  await haTry(tok, T, 13, 4, cur, 'i = 1：+1²', 600);
  say('13：[3] 撞了 → i = 1，3 + 1² = 4 → 放 [4]');
  await step(tok);                                   // 15:26 23: h(23) + f(0) = 3, collision
  await haTry(tok, T, 23, 3, cur, 'i = 0：3');
  say('insert 23：i = 0 → (3 + 0²) mod 10 = 3', '撞了');
  await step(tok);                                   // 15:54 i = 1: 3 + 1 = 4, also collision
  unglow(T); await haTry(tok, T, 23, 4, cur, 'i = 1：3 + 1');
  say('i = 1 → (3 + 1²) mod 10 = 4', '也撞了');
  await step(tok);                                   // 16:22 i = 2: 3 + 4 = 7 → stored at index 7
  unglow(T); await haTry(tok, T, 23, 7, cur, 'i = 2：3 + 4');
  say('i = 2 → (3 + 2²) mod 10 = 7 → 放 [7]');
  await step(tok);                                   // 16:33 kept a few locations away: a gap in between
  arrow(V3(T.xs[3], 1.4, T.z - 0.9), V3(T.xs[7], 1.4, T.z - 0.9), 0xc08a1f);
  [5, 6].forEach((j) => glow(T.slots[j], GREEN));
  say('23 被放到離衝突處遠一點的地方', '中間留了空格');
  await step(tok);                                   // 16:49 avoids clustering, improves searching time
  good('不容易擠成一團 → 搜尋比較快', 0, 1.6, 3.6);
  say('元素不擠成一團，搜尋時間就改善了');
}]);
  }

  // ═══ hashlin1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, txt, code, anim, line, arrow, ghostBox, lnode, tnode, step, buddy, prop, bob, travel, GOLD, GREEN, RED, GRAY } = K;
// ─── SBQLkYIDAZI（台大林軒田 DSA：binomial heap → map → hash function 入門） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (// @c = cue seconds).
const HL = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f'];
const hlOrd = (k) => HL[k % HL.length];
const hlSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const hlBin = (n) => n.toString(2);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// binomial-tree nodes: { v, kids }; order of a root = kids.length
const BN = (v, ...kids) => ({ v, kids });
const bnW = (n) => (n.kids.length ? n.kids.reduce((a, c) => a + bnW(c), 0) : 1);
const bnD = (n) => (n.kids.length ? 1 + Math.max(...n.kids.map(bnD)) : 0);
const bnAll = (t) => [t, ...t.kids.flatMap(bnAll)];
// structure-only B_k, lowest-order child on the left (as drawn in the lecture)
const bnMake = (k) => BN(null, ...Array.from({ length: k }, (_, i) => bnMake(i)));
// two roots fight; the loser becomes the winner's new first (left-most) child — O(1) head insert
function bnLink(a, b) { const w = a.v >= b.v ? a : b, l = w === a ? b : a; w.kids.unshift(l); return { w, l }; }
function bnDraw(n, xl, y, z, sp, dy, out, par, col, drop) {
  const x = xl + (bnW(n) - 1) * sp / 2;
  if (par) { n.edge = line(par.x, par.y, x, y, z); out.push(n.edge); }
  const m = cube(n.v === null || n.v === undefined ? '' : n.v, col(n), [0.6, 0.6, 0.6], x, y, z, drop && drop.has(n) ? 1.2 : 0);
  out.push(m); n.m = m; n.x = x; n.y = y;
  let cx = xl;
  for (const c of n.kids) { bnDraw(c, cx, y - dy, z, sp, dy, out, n, col, drop); cx += bnW(c) * sp; }
}
// draw a row of trees centred on o.cx; each tree gets a B_k tag above its root
function bnForest(ts, o = {}) {
  const sp = o.sp || 0.8, dy = o.dy || 1.0, gap = o.gap || 0.9, z = o.z || 0, y0 = 0.45, cx = o.cx || 0;
  ts = ts.filter(Boolean);
  const W = ts.reduce((a, t) => a + bnW(t) * sp, 0) + gap * Math.max(0, ts.length - 1);
  const D = o.D !== undefined ? o.D : Math.max(0, ...ts.map(bnD));
  const yTop = y0 + D * dy, objs = [];
  let x = cx - W / 2 + sp / 2;
  for (const t of ts) {
    const col = (n) => (o.col ? o.col(n, t) : colorFor(n.v));
    bnDraw(t, x, yTop, z, sp, dy, objs, null, col, o.drop);
    if (o.labels !== false) objs.push(tag(o.tagOf ? o.tagOf(t) : 'B' + hlSub(t.kids.length), 'idx', t.x, yTop + 0.75, z));
    x += bnW(t) * sp + gap;
  }
  return { objs, yTop, kill() { objs.forEach(kill); } };
}
// array-heap slot i → (x, y) in a complete binary tree layout
function hpPos(i, cx, top, W, dy) { const d = Math.floor(Math.log2(i + 1)), p = i + 1 - (1 << d); return [cx + (p + 0.5) * W / (1 << d) - W / 2, top - d * dy]; }

// ════════ SBQLkYIDAZI（林軒田 DSA） ════════
// 08:16 heap 與 max tree 的差別：complete 保證高度
FRAG.push(['hashlin1-maxtree-vs-heap', 'Max tree 與 heap：差在 complete', async (tok) => {
  fresh([0, 5.2, 12.5], [0, 2.4, 0]);
  const vals = [9, 7, 5, 3, 1];
  await step(tok); // @c 499.8 max tree：root 最大、subtree root 也最大
  tag('只滿足 max tree', 'ptr', -4.6, 6.0);
  let par = null; const L = [];
  for (let i = 0; i < 5; i++) { par = tnode(vals[i], -5.6 + i * 0.55, 4.9 - i * 1.1, 0, par); L.push(par); await beat(tok, 260); }
  say('max tree：root 最大、subtree 的 root 也最大', '其他什麼都不保證');
  await step(tok); // @c 514.8 樹高沒保證
  bad('樹會多高？沒保證', -1.4, 3.6);
  say('樹會長多高？沒有保證', '');
  await step(tok); // @c 533.8 worst case root 掃到 leaf
  const cur = pkt('一路走到 leaf', 0, 0);
  for (const m of L) { cur.position.set(m.position.x + 1.5, m.position.y, 0); glow(m, GOLD); await beat(tok, 380); glow(m, null); }
  say('worst case：從 root 一路走到 leaf', '時間跟 node 數成正比 → O(n)');
  await step(tok); // @c 548.8 像 linked list
  kill(cur);
  note('其實像一條 linked list', -3.4, 0.6);
  say('退化的樹：看起來像一條 linked list', '');
  await step(tok); // @c 560.8 heap 只用 complete binary tree
  tag('heap = complete + max tree', 'ptr', 3.0, 6.0);
  const H = [];
  for (let i = 0; i < 5; i++) { const [x, y] = hpPos(i, 3.0, 4.9, 5.2, 1.6); H.push(tnode(vals[i], x, y, 0, i ? H[(i - 1) >> 1] : null)); await beat(tok, 260); }
  say('heap 加了嚴格限制：只用 complete binary tree', '');
  await step(tok); // @c 579.8 最小高度
  good('n 個 node 最矮的樹：高度 ⌊log₂n⌋', 3.0, 0.5);
  say('complete binary tree：高度已經最小', 'n 個 node → 高度 ⌊log₂n⌋');
  await step(tok); // @c 587.8 operation 都跟樹高有關
  const c2 = pkt('沿著樹高走', 0, 0);
  for (const i of [0, 1, 3]) { c2.position.set(H[i].position.x + 1.4, H[i].position.y, 0); glow(H[i], GOLD); await beat(tok, 450); glow(H[i], null); }
  say('放進去、拿出來，都只沿著樹高走', '');
  await step(tok); // @c 605.8 insert / remove 都有效率
  kill(c2);
  say('所以 insert / remove 都有效率', 'O(log n)');
}]);

// 27:37 回顧：priority queue 與 max heap 的 insert / removeMax
FRAG.push(['hashlin1-heap-recap', '回顧 max heap：insert 往上打、remove 往下沉', async (tok) => {
  fresh([0, 5, 11.5], [0, 2.2, 0]);
  const pos = (i) => hpPos(i, 0, 4.4, 7.2, 1.45);
  const V = [9, 7, 5, 3, 1], M = [];
  const swap = async (i, j) => {
    const [xi, yi] = pos(i), [xj, yj] = pos(j);
    move(M[i], xj, yj); move(M[j], xi, yi);
    [M[i], M[j]] = [M[j], M[i]]; [V[i], V[j]] = [V[j], V[i]];
    await beat(tok, 900);
  };
  await step(tok); // @c 1657.0 heap 用來做 priority queue
  for (let i = 0; i < 5; i++) { const [x, y] = pos(i); if (i) { const [px, py] = pos((i - 1) >> 1); line(px, py, x, y); } M.push(cube(V[i], colorFor(V[i]), [0.8, 0.8, 0.8], x, y, 0)); }
  say('heap 是用來做 priority queue', 'max heap = complete binary tree + max tree');
  await step(tok); // @c 1675.8 最緊急先做
  const todo = bub('作業 3 要 due 了 → 先做它！', 0, 5.5);
  glow(M[0], GOLD);
  say('priority queue：最緊急的先做', '不是先進先出');
  await step(tok); // @c 1717.8 放進去要整理
  glow(M[0], null); kill(todo);
  const [x5, y5] = pos(5), [x2, y2] = pos(2);
  const e5 = line(x2, y2, x5, y5);
  M.push(cube(8, colorFor(8), [0.8, 0.8, 0.8], x5, y5, 0, 3)); V.push(8);
  say('insert 8：先放在最後面', '整理後兩個性質都要成立');
  await step(tok); // @c 1745.8 跟附近 parent 打架往上浮
  glow(M[5], GOLD); glow(M[2], GOLD);
  await beat(tok, 600);
  await swap(5, 2); glow(M[5], null);
  say('跟 parent 5 打一架：8 > 5，往上浮', 'sift up');
  await step(tok); // @c 1761.8 最多 log n 層
  glow(M[0], GOLD);
  say('再跟 9 比：8 < 9，停', '最多打 ⌊log₂n⌋ 層 → O(log n)');
  await step(tok); // @c 1772.0 remove 最大
  glow(M[0], null); glow(M[2], null);
  fly(M[0]);
  say('removeMax：拿走 root 9', '群龍無首');
  await step(tok); // @c 1782.8 小嘍囉上來補位
  const [x0, y0] = pos(0);
  move(M[5], x0, y0); M[0] = M[5]; V[0] = V[5]; M.pop(); V.pop(); kill(e5);
  say('最後一個（5）先上來補位', '');
  await step(tok); // @c 1790.8 不得人心 → 往下沉
  glow(M[0], GOLD); glow(M[1], GOLD); glow(M[2], GOLD);
  await beat(tok, 600);
  glow(M[1], null);
  await swap(0, 2);
  glow(M[0], null); glow(M[2], null);
  say('5 跟小孩比：較大的 8 上來', '5 往下沉（sift down）');
  await step(tok); // @c 1802.8 remove 也是 log n
  say('remove 也只花 O(log n)', 'heap = [8, 7, 5, 3, 1]');
}]);

// 30:31 能不能 insert 只花 constant？
FRAG.push(['hashlin1-o1-insert', 'Insert 只花 constant？', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const vals = [4, 9, 2, 7, 5, 8, 1, 6], M = [];
  await step(tok); // @c 1830.8 constant 的力氣
  const me = buddy('你', '', '#f4a56a', -5.8, 0, 2.4, 0.8);
  say('目標：insert 只花 constant 的力氣', '跟資料量 n 無關');
  await step(tok); // @c 1837.8 放進去不能花太多力氣
  for (let i = 0; i < vals.length; i++) {
    M.push(cube(vals[i], colorFor(vals[i]), [0.8, 0.8, 0.8], -4.2 + i * 1.2, 0.4, ((i * 5) % 3 - 1) * 1.4, 3));
    await beat(tok, 260);
  }
  me.mood('happy');
  say('放進去：隨手一丟，每次 1 步', '完全不整理');
  await step(tok); // @c 1845.8 拿出來還要很快找到最大
  const cur = pkt('找最大', 0, 0);
  let best = 0;
  for (let i = 0; i < M.length; i++) { cur.position.set(M[i].position.x, 1.5, M[i].position.z); glow(M[i], GOLD); if (vals[i] > vals[best]) best = i; await beat(tok, 280); glow(M[i], null); }
  glow(M[best], GREEN); kill(cur); me.mood('sad');
  say('可是 getMax 要整堆找一遍', '完全不整理 → O(n)');
  await step(tok); // @c 1886.8 結論：很難
  bad('每次都只花 constant？很難', 0, 3.6, -1.5);
  say('先說結論：很難（沒說 impossible）', '');
  await step(tok); // @c 1904.8 要找得快就要整理
  say('想找得快，放進去時就要整理', '整理就要花力氣');
  await step(tok); // @c 1925.9 亂房間
  const msg = bub('房間弄亂的速度 > 整理的速度…', -4.6, 2.6, 2.4);
  me.mood('wow');
  for (let i = 0; i < 3; i++) { M.push(cube('', '#c9b48a', [0.7, 0.5, 0.7], -3 + i * 2.6, 0.3, 2.2, 3)); await beat(tok, 300); }
  say('每次只准整理一點點，就像亂房間', '永遠整理不完');
  await step(tok); // @c 1962.8 只准十步
  kill(msg);
  note('每次只准 10 步', 3.6, 3.0, -1.5);
  say('不管有多少資料，每次只准花 10 步', '那還能很快找到東西嗎？');
  await step(tok); // @c 1985.8 amortized constant
  me.mood('happy'); await me.hop(tok);
  say('可行的方向：amortized constant', '');
  await step(tok); // @c 2000.6 有時多有時少
  M.forEach(kill);
  const cost = [1, 1, 1, 6, 1, 1, 1, 1];
  for (let i = 0; i < cost.length; i++) { cube(cost[i], cost[i] > 1 ? '#e55a9b' : '#2fc092', [0.7, cost[i] * 0.45, 0.7], -3.5 + i * 1.0, cost[i] * 0.225, 0); await beat(tok, 150); }
  good('平均：每次差不多 2 步', 0, 3.4, 0);
  say('有時花多、有時花少', '平均起來是固定的力氣');
}]);

// 33:37 amortized：extendable array 一次長兩倍
FRAG.push(['hashlin1-doubling', 'Amortized：extendable array 長兩倍', async (tok) => {
  fresh([0, 6.5, 11], [0, 0.4, 0]);
  const dx = 0.95, x0 = -3.3;
  const mkRow = (c, z) => Array.from({ length: c }, (_, i) => cube('', GRAY, [0.85, 0.1, 0.9], x0 + i * dx, 0.05, z));
  const it = (v, i, z) => cube(v, colorFor(v), [0.7, 0.7, 0.7], x0 + i * dx, 0.45, z, 2.5);
  let put = 2, mv = 1, rowZ = -1.3, row = [], items = [];
  const cnt = tag('', 'ptr alt', 0, 3.6, -2.5);
  const tally = () => txt(cnt, '放 ' + put + ' 步 ＋ 搬家 ' + mv + ' 步 = ' + (put + mv));
  const grow = async (cap) => {
    const nz = -rowZ, nr = mkRow(cap, nz);
    items.forEach((m, i) => move(m, x0 + i * dx, 0.45, nz));
    mv += items.length; tally();
    await beat(tok, 900);
    row.forEach(kill); row = nr; rowZ = nz;
  };
  txt(cnt, ' ');
  await step(tok); // @c 2016.8 amortize = 均攤
  const nt = note('均攤：把偶爾的大花費，平均分給每一次', 0, 2.6, -2.5);
  say('Amortized = 均攤', '有時多花、有時少花，平均固定');
  await step(tok); // @c 2037.8 extendable array
  kill(nt);
  row = mkRow(2, rowZ); items = [it(1, 0, rowZ), it(2, 1, rowZ)];
  tally();
  say('以前學過：extendable array', '現在 2 格，已經滿了');
  await step(tok); // @c 2052.8 滿了要增加大小
  const n3 = it(3, 2, rowZ); glow(n3, RED);
  say('3 要進來：滿了！', '要把 array 變大');
  await step(tok); // @c 2059.8 一次兩倍
  await grow(4);
  move(n3, x0 + 2 * dx, 0.45, rowZ); glow(n3, null); items.push(n3); put++; tally();
  say('不要只加一格：一次長成兩倍', '開 4 格，舊的 2 個搬過去');
  await step(tok); // @c 2066.8 大部分時候不用增加大小
  items.push(it(4, 3, rowZ)); put++; tally();
  say('insert 4：有空位，1 步就好', '大部分時候都這麼便宜');
  await step(tok); // @c 2082.8 變大時要搬家
  await grow(8);
  items.push(it(5, 4, rowZ)); put++; tally();
  say('insert 5：又滿了 → 開 8 格、全部搬家', '搬 4 個 = 4 步，很貴');
  await step(tok); // @c 2090.8 搬家偶爾發生
  for (const v of [6, 7, 8]) { items.push(it(v, items.length, rowZ)); put++; tally(); await beat(tok, 400); }
  say('搬家很貴，但很少發生', '6、7、8 都只要 1 步');
  await step(tok); // @c 2116.8 分攤到每一輪
  good('15 步 ÷ 8 次 < 2 步', 0, 2.3, -2.5);
  say('8 次 insert：放 8 ＋ 搬 1+2+4 = 15 步', '平均每次不到 2 步 → amortized O(1)');
  await step(tok); // @c 2134.8 用在 priority queue
  say('現在把「均攤」用在設計 priority queue', '');
}]);

// 36:01 cheap insertion 常常做：插進小樹；很多棵樹 = forest
FRAG.push(['hashlin1-small-trees', '小樹插入便宜：改用很多棵樹', async (tok) => {
  fresh([0, 5.4, 12], [0, 2.1, 0]);
  const draw = (n, cx, W, top, dy, col) => {
    const ms = [];
    for (let i = 0; i < n; i++) { const [x, y] = hpPos(i, cx, top, W, dy); if (i) { const [px, py] = hpPos((i - 1) >> 1, cx, top, W, dy); line(px, py, x, y); } ms.push(cube('', col, [0.55, 0.55, 0.55], x, y, 0)); }
    return ms;
  };
  const climb = async (cx, W, top, dy, from, steps, ms) => {
    const [x, y] = hpPos(from, cx, top, W, dy); const [px, py] = hpPos((from - 1) >> 1, cx, top, W, dy);
    line(px, py, x, y);
    const nw = cube('新', '#dd8238', [0.6, 0.6, 0.6], x, y, 0, 2.5);
    await beat(tok, 600);
    let i = from;
    for (let s = 0; s < steps; s++) { const p = (i - 1) >> 1; const [qx, qy] = hpPos(p, cx, top, W, dy); move(nw, qx, qy + 0.6); i = p; await beat(tok, ms); }
    return nw;
  };
  await step(tok); // @c 2160.8 cheap insertion 常常做
  good('cheap insertion：每一輪都做', -3.2, 6.6);
  say('cheap insertion：常常做、每輪都做', '花的力氣越少越好');
  await step(tok); // @c 2183.3 expensive 偶爾做
  bad('expensive insertion：偶爾才做', 3.4, 6.6);
  say('expensive insertion：偶爾才做', '平均起來每一輪都便宜');
  await step(tok); // @c 2222.2 大樹 264 個 node
  draw(14, -2.6, 7, 4.2, 1.15, '#4b9ee2');
  tag('大樹（想像有 264 個 node）', 'ptr', -2.6, 5.4);
  say('heap 很大：已經有 264 個 node', '');
  await step(tok); // @c 2228.8 放第 265 個
  await climb(-2.6, 7, 4.2, 1.15, 14, 3, 600);
  say('放第 265 個：要往上打好幾層', '最多 ⌊log₂265⌋ = 8 層');
  await step(tok); // @c 2236.8 小 heap 只有 5 個
  draw(5, 4.6, 3.2, 2.6, 1.0, '#2fc092');
  tag('小樹（5 個 node）', 'ptr', 4.6, 3.7);
  await climb(4.6, 3.2, 2.6, 1.0, 5, 2, 600);
  say('heap 只有 5 個 node：一下就到頂', '最多打 2 層');
  await step(tok); // @c 2252.8 insertion to small tree usually
  note('insertion to small tree usually', 4.4, 0.0, 1.2);
  say('想法：通常插進小樹', '');
  await step(tok); // @c 2288.8 拆成小樹與大樹
  say('把一棵大樹拆開：有小樹、也有大樹', '');
  await step(tok); // @c 2293.8 通常放小樹，滿了才插大樹
  const pk = pkt('新資料', 0, 0);
  await travel(tok, pk, V3(1.2, 5.6, 0), V3(4.6, 3.1, 0), 1000);
  say('通常放進小樹；小樹都滿了', '才插進大一點的樹');
  await step(tok); // @c 2347.8 很多樹 = 森林
  kill(pk);
  good('很多棵樹 = 森林（forest）', 1.0, -0.2, 2.0);
  say('一個資料結構裡有很多棵樹', '就叫森林（forest）');
}]);

// 40:22 binomial tree B0..B3、|B_k| = 2^k、B_k = 兩棵 B_{k-1}
FRAG.push(['hashlin1-binomial-trees', 'Binomial tree：B₀、B₁、B₂、B₃', async (tok) => {
  fresh([0, 4.6, 11.5], [0, 1.6, 0]);
  const sp = 0.85, gap = 1.3, ts = [0, 1, 2, 3].map(bnMake);
  const W = ts.reduce((a, t) => a + bnW(t) * sp, 0) + gap * 3;
  let x = -W / 2; const cxs = ts.map((t) => { const c = x + bnW(t) * sp / 2; x += bnW(t) * sp + gap; return c; });
  const draw = (k) => bnForest([ts[k]], { cx: cxs[k], sp, dy: 1.0, col: () => hlOrd(k) });
  const msgs = [['B₀：只有一個 node', 'single node tree'], ['B₁：root 下面接一棵 B₀', ''], ['B₂：root 下面接 B₀ 和 B₁', ''], ['B₃：root 下面接 B₀、B₁、B₂', '']];
  await step(tok); // @c 2421.8 binomial = 二項式 / 二進位
  tag('binomial：二項式、二進位', 'ptr', 0, 5.4);
  say('介紹一種特別的樹：binomial tree', '');
  for (let k = 0; k < 4; k++) {
    await step(tok); // @c 2445.8 B0 | 2465.8 B1 | 2505.8 B2 | 2601.8 B3
    draw(k);
    say(msgs[k][0], msgs[k][1]);
  }
  await step(tok); // @c 2663.8 不是 binary tree
  glow(ts[3].m, GREEN); ts[3].kids.forEach((c) => glow(c.m, GOLD));
  const nb = note('root 有 3 個小孩：不是 binary tree', cxs[3], 4.6);
  say('B₃ 的 root 有 3 個小孩', '不是 binary tree');
  await step(tok); // @c 2734.7 1、2、4、8 個 node
  kill(nb); glow(ts[3].m, null); ts[3].kids.forEach((c) => glow(c.m, null));
  for (let k = 0; k < 4; k++) { tag((1 << k) + ' 個 node', 'idx', cxs[k], 0, 1.1); await beat(tok, 300); }
  say('B₀ 有 1 個、B₁ 有 2 個、B₂ 有 4 個、B₃ 有 8 個', '');
  await step(tok); // @c 2751.8 B_k 有 2^k 個
  say('order 是 k 的 B_k 有 2ᵏ 個 node', '1、2、4、8 …');
  await step(tok); // @c 2788.7 B1 = 兩棵 B0、B2 = 兩棵 B1
  for (const k of [1, 2]) { const h = bnAll(ts[k].kids[k - 1]); bnAll(ts[k]).forEach((n) => glow(n.m, h.includes(n) ? GOLD : GREEN)); }
  say('B₁ = 兩棵 B₀，B₂ = 兩棵 B₁', '');
  await step(tok); // @c 2801.8 B3 = 兩棵 B2
  const half = bnAll(ts[3].kids[2]);
  bnAll(ts[3]).forEach((n) => glow(n.m, half.includes(n) ? GOLD : GREEN));
  say('B₃ = 兩棵 B₂ 接起來', '兩棵小樹合起來 → 一棵大樹');
  await step(tok); // @c 2846.8 用它造森林、放 max tree
  good('binomial tree 造森林 ＋ 每棵放 max tree', 0, 5.4, -1.5);
  say('用 binomial tree 造森林，每棵放 max tree', '→ 有小 heap，也有大 heap');
  await step(tok); // @c 2885.8 小 heap 滿了才組大 heap
  const pk = pkt('新資料', 0, 0);
  await travel(tok, pk, V3(cxs[1], 5.0, 0), V3(cxs[0], 1.2, 0), 900);
  say('通常塞進小 heap，小 heap 滿了才組大 heap', '平均起來不花太多時間');
}]);

// 63:08 B3 的正確長相（multi-way）與 left-child right-sibling
FRAG.push(['hashlin1-lcrs', 'B₃ 是 general tree：left child, right sibling', async (tok) => {
  fresh([0, 4.6, 10.5], [0, 2.2, 0]);
  const t = bnMake(3); let c = 0;
  bnAll(t).forEach((n) => { n.v = 'abcdefgh'[c++]; });
  const all = bnAll(t), off = () => all.forEach((n) => glow(n.m, null));
  await step(tok); // @c 3787.8 Wikipedia 的圖
  bnForest([t], { sp: 1.3, dy: 1.3, col: () => '#9b7ef4' });
  say('binomial tree 真正的長相（B₃）', '');
  await step(tok); // @c 3813.8 下面串 B0、B1、B2
  t.kids.forEach((k, i) => bnAll(k).forEach((n) => glow(n.m, [GREEN, GOLD, '#16306a'][i])));
  say('order 3：root 下面串了 B₀、B₁、B₂', '');
  await step(tok); // @c 3821.8 兩棵 B2 合併
  const half = bnAll(t.kids[2]);
  all.forEach((n) => glow(n.m, half.includes(n) ? GOLD : GREEN));
  say('也可以看成兩棵 B₂ 合起來', '');
  await step(tok); // @c 3830.8 general tree
  off(); glow(t.m, GREEN); t.kids.forEach((k) => glow(k.m, GOLD));
  say('root 有 3 個小孩：是 general tree', '不是 binary tree');
  await step(tok); // @c 3842.8 用 binary tree 表現
  off(); all.forEach((n) => { if (n.edge) kill(n.edge); });
  say('general tree 也能用 binary tree 表現', 'left child, right sibling');
  await step(tok); // @c 3851.8 往左走到小孩
  for (const n of all) if (n.kids.length) { const f = n.kids[0]; arrow(V3(n.x, n.y - 0.32, 0), V3(f.x, f.y + 0.32, 0), 0x0f5a3a); await beat(tok, 300); }
  say('往左走：到第一個小孩', '一張小紙條指第一個小孩');
  await step(tok); // @c 3858.8 往右走到 sibling
  for (const n of all) for (let i = 0; i + 1 < n.kids.length; i++) { const a = n.kids[i], b = n.kids[i + 1]; arrow(V3(a.x + 0.32, a.y, 0), V3(b.x - 0.32, b.y, 0), 0xc08a1f); await beat(tok, 300); }
  say('往右走：到一連串的 sibling', '另一張小紙條指下一個兄弟');
  await step(tok); // @c 3867.8 所有小孩用 linked list
  note('所有小孩 = 一條 linked list', 1.2, 0.0, 1.2);
  say('所有小孩用 linked list 串起來', '');
  await step(tok); // @c 3881.8 例：左走看到小孩、右走找 sibling
  const hand = pkt('👆', t.x, t.y + 0.7);
  const path = [t, ...t.kids];
  for (let i = 1; i < path.length; i++) await travel(tok, hand, V3(path[i - 1].x, path[i - 1].y + 0.7, 0), V3(path[i].x, path[i].y + 0.7, 0), 550);
  glow(t.kids[0].m, GREEN);
  say('左走看到第一個小孩，右走找到其他 sibling', '');
  await step(tok); // @c 3933.8 實作要注意細節
  say('示意圖好解釋；真正實作要注意細節', '');
}]);

// 65:56 node 數不是 2^k？用 forest：9 = 8 + 1
FRAG.push(['hashlin1-forest-9', '任意 n 個 node：9 = 8 + 1', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.8, 0]);
  await step(tok); // @c 3955.8 不是 2^k 個？
  const q = buddy('同學', '?', '#7cb8ee', -5.4, 0, 1.6, 0.8); q.mood('wow');
  say('資料不是 2ᵏ 個，還能用 binomial tree 嗎？', '');
  await step(tok); // @c 3971.8 full binary tree 只能 1、3、7、15
  const n1 = note('full binary tree：只能 1、3、7、15 個 …', 0, 5.4, -1.5);
  say('以前：full binary tree 只能有 1、3、7、15 個', '');
  await step(tok); // @c 3997.8 binomial 1、2、4、8、16
  const n2 = note('binomial tree：只能 1、2、4、8、16 個 …', 0, 4.7, -1.5);
  say('binomial tree 也只有 1、2、4、8、16 個', '碰到一樣的問題');
  await step(tok); // @c 4019.8 complete
  const n3 = good('當年的解法：不要 full，只要 complete', 0, 4.0, -1.5);
  say('當年的解法：不要 full，只要 complete', '');
  await step(tok); // @c 4036.8 用 forest
  say('這次的解法：用 forest', '把 1、2、4、8 湊成任意數字');
  await step(tok); // @c 4054.8 十進位轉二進位
  [n1, n2, n3].forEach(kill);
  const place = [8, 4, 2, 1], bits = [1, 0, 0, 1];
  const bl = place.map((p, i) => { tag(String(p), 'idx', -2.4 + i * 1.6, 5.6, -1.5); return tag('·', 'ptr', -2.4 + i * 1.6, 5.0, -1.5); });
  say('其實就是十進位轉二進位', '');
  await step(tok); // @c 4061.8 9 = 8 + 1
  for (let i = 0; i < 4; i++) { txt(bl[i], String(bits[i])); await beat(tok, 300); }
  say('例：9 = 8 + 1 = 1001₂', '');
  await step(tok); // @c 4069.8 size 8 + size 1
  bnForest([bnMake(3), bnMake(0)], { sp: 0.9, gap: 2.2, col: (n, t) => hlOrd(t.kids.length) });
  q.set('!'); q.mood('happy');
  say('一棵 size 8 的樹 ＋ 一棵 size 1 的樹', '');
  await step(tok); // @c 4077.8 口誤：B3 + B0
  note('size 1 的樹是 B₀（影片口誤說 B₁）', 2.2, 4.6, -1.5);
  say('對應：一棵 B₃ ＋ 一棵 B₀', '1001₂ → B₃ + B₀');
}]);

// 69:50 binomial tree 加上 max (multi-way) tree 性質
FRAG.push(['hashlin1-max-binomial', 'Max binomial tree：root 比整棵子樹大', async (tok) => {
  fresh([0, 4.6, 10.5], [0, 2.0, 0]);
  const o = { sp: 1.3, dy: 1.25 };
  const t = BN(30, BN(12), BN(20, BN(8)), BN(25, BN(10), BN(18, BN(3))));
  await step(tok); // @c 4190.1 multi-way tree，root 多長一隻腳
  const s = bnMake(3);
  let v = bnForest([s], { ...o, col: () => '#9b7ef4' });
  glow(s.kids[2].m, GOLD);
  const leg = note('從 root 多長一隻腳', s.kids[2].x + 0.6, s.kids[2].y + 0.9);
  say('B₃ 是 multi-way tree', 'root 直接接 3 棵 subtree');
  await step(tok); // @c 4220.8 加上 max tree 性質
  v.kill(); kill(leg);
  v = bnForest([t], o);
  say('變成 heap：加上 max tree 的性質', '每個 node 放一個數字');
  await step(tok); // @c 4228.5 min heap 加 min tree
  note('要 min heap → 改加 min tree 性質', -3.0, 4.9);
  say('要 min heap 的話，就加 min tree 性質', '');
  await step(tok); // @c 4236.8 max 的 multi-way tree
  say('這裡用的是 max 的 multi-way tree', '不是 binary tree');
  await step(tok); // @c 4256.8 root 有 3 棵 subtree
  for (let i = 0; i < 3; i++) { const c = t.kids[i]; bnAll(c).forEach((n) => glow(n.m, GOLD)); tag('subtree ' + (i + 1), 'idx', c.x, c.y + 0.6, 0.6); await beat(tok, 600); bnAll(c).forEach((n) => glow(n.m, null)); }
  say('root 下面有 3 棵 subtree', '');
  await step(tok); // @c 4263.8 root 比所有人大
  glow(t.m, GREEN); bnAll(t).slice(1).forEach((n) => glow(n.m, GOLD));
  say('root 30 比 3 棵 subtree 裡所有人都大', '30 > 12、20、8、25、10、18、3');
  await step(tok); // @c 4271.8 各 subtree 的 subroot 也最大
  bnAll(t).forEach((n) => glow(n.m, null));
  for (const r of [t.kids[1], t.kids[2], t.kids[2].kids[1]]) {
    glow(r.m, GREEN); r.kids.forEach((k) => glow(k.m, GOLD));
    say('subtree 裡，subroot ' + r.v + ' 也最大', r.v + ' > ' + r.kids.map((k) => k.v).join('、'));
    await beat(tok, 700);
    glow(r.m, null); r.kids.forEach((k) => glow(k.m, null));
  }
  say('每一層都滿足 max tree', '= 一棵 max binomial tree');
}]);

// 72:01 binomial forest：每種 B_k 最多一棵；10 = 8 + 2、17 = 16 + 1
FRAG.push(['hashlin1-forest-10-17', 'Binomial forest：10 與 17 個 node', async (tok) => {
  fresh([0, 5, 12], [0, 2.2, 0]);
  const o = { sp: 0.72, dy: 0.95, gap: 1.6, col: (n, t) => hlOrd(t.kids.length) };
  const place = [16, 8, 4, 2, 1], bl = [];
  const setBits = (n) => place.forEach((p, i) => txt(bl[i], (n & p) ? '1' : '0'));
  let v = null;
  await step(tok); // @c 4322.8 整數 ↔ 二進位一對一
  place.forEach((p, i) => { tag(String(p), 'idx', -3.2 + i * 1.6, 6.4, -3); bl.push(tag('0', 'ptr', -3.2 + i * 1.6, 5.8, -3)); });
  say('任意整數 ↔ 二進位：一對一', '');
  await step(tok); // @c 4343.8 每種 B_k 最多一棵
  say('binomial forest：每種 B_k 最多一棵', '0 棵或 1 棵 ↔ 二進位的 0 / 1');
  await step(tok); // @c 4375.8 可以表示任何 n
  say('這樣的 forest 可以表示任何 n 個 node', '');
  await step(tok); // @c 4388.9 10 = 8 + 2
  setBits(10);
  say('10 = 8 + 2 = 1010₂', '');
  await step(tok); // @c 4398.9 B3 + B1
  v = bnForest([bnMake(3), bnMake(1)], o);
  say('一棵 B₃ ＋ 一棵 B₁', '剛好 10 個 node');
  await step(tok); // @c 4423.8 17 = 16 + 1
  v.kill(); setBits(17);
  say('17 = 16 + 1 = 10001₂', '不能 8 + 9：每種樹最多一棵');
  await step(tok); // @c 4436.4 B4 + B0
  v = bnForest([bnMake(4), bnMake(0)], o);
  say('一棵 B₄ ＋ 一棵 B₀', '');
  await step(tok); // @c 4456.8 哪些樹是固定的
  say('n 決定有哪些樹（固定的）', '樹裡放的內容才會變');
  await step(tok); // @c 4491.8 = binomial heap
  good('binomial forest ＋ 一堆 max tree = binomial heap', 0, 7.0, -3);
  say('binomial forest ＋ 一堆 max tree', '= binomial heap');
}]);

// 75:30 從空的 binomial heap 依序 insert 5, 7, 3, 2
FRAG.push(['hashlin1-insert-5732', 'Binomial heap：依序 insert 5, 7, 3, 2', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const o = { sp: 1.0, dy: 1.1, gap: 1.4, D: 2 };
  let ts = [], v = null;
  const show = (drop, newT) => { if (v) v.kill(); v = bnForest(ts, { ...o, drop, tagOf: (t) => (t === newT ? '新 ' : '') + 'B' + hlSub(t.kids.length) }); };
  const nt = tag('n = 0', 'ptr', 0, 4.9, -1.5);
  await step(tok); // @c 4530.0 從空的開始
  say('從空的 max binomial heap 開始', '一棵樹都沒有');
  await step(tok); // @c 4549.8 insert 5
  const a5 = BN(5); ts = [a5]; show(new Set([a5]), a5);
  say('insert 5', '');
  await step(tok); // @c 4565.8 只有一棵 B0
  show(); txt(nt, 'n = 1 = 1₂');
  say('得到只有一棵 B₀ 的 binomial heap', '這棵 B₀ 就是 5');
  await step(tok); // @c 4613.8 insert 7，大的在上面
  const a7 = BN(7); ts = [a5, a7]; show(new Set([a7]), a7);
  say('insert 7：priority 高的要在上面', '要滿足 max tree');
  await step(tok); // @c 4631.8 只能是一棵 B1
  txt(nt, 'n = 2 = 10₂');
  say('2 個 node → 只能是一棵 B₁', 'binomial forest 沒有別的選擇');
  await step(tok); // @c 4652.8 7 在上 5 在下
  glow(a5.m, GOLD); glow(a7.m, GOLD);
  say('目標長相：7 在上、5 在下', '');
  await step(tok); // @c 4717.3 7 也是一個小 forest
  const b7 = bub('我自己就是一個小 forest', a7.x + 0.4, a7.y + 1.6);
  say('換個看法：新來的 7 也是一個小 forest', '插入 = 兩個 forest 合併');
  await step(tok); // @c 4744.8 B0 跟 B0 打一架
  kill(b7);
  bnLink(a5, a7); ts = [a7]; show(new Set([a5]));
  say('B₀ 跟 B₀ 打一架：7 贏放上面', '5 掛下面 → 一棵 B₁（merge）');
  await step(tok); // @c 4781.8 insert 3
  const a3 = BN(3); ts = [a7, a3]; show(new Set([a3]), a3);
  say('insert 3', '');
  await step(tok); // @c 4803.8 一棵 B1 ＋ 一棵 B0
  show(); txt(nt, 'n = 3 = 11₂');
  say('forest = 一棵 B₁ ＋ 一棵 B₀', '3 自己當 B₀，7、5 留在原地');
  await step(tok); // @c 4822.8 insert 2
  const a2 = BN(2); ts = [a7, a3, a2]; show(new Set([a2]), a2); txt(nt, 'n = 4 = 100₂');
  say('insert 2', '');
  await step(tok); // @c 4851.8 兩棵 B0？
  glow(a3.m, GOLD); glow(a2.m, GOLD);
  say('會有兩棵 B₀ 嗎？不會', '');
  await step(tok); // @c 4859.8 B0+B0 → B1，B1+B1 → B2
  say('兩棵 B₀ 變 B₁，又碰到原本的 B₁', '兩棵 B₁ 再變 B₂ → 連續進位');
  await step(tok); // @c 4867.5 3 和 2 先組成 B1
  bnLink(a3, a2); ts = [a7, a3]; show(new Set([a2]));
  say('先把 3 和 2 組成一棵新 B₁', '3 > 2，3 在上面');
  await step(tok); // @c 4896.8 老大 7 和 3 單挑
  glow(a7.m, GOLD); glow(a3.m, GOLD);
  say('兩棵 B₁：老大 7 和 3 出來單挑', '小嘍囉不用出手');
  await step(tok); // @c 4917.8 3、2 掉到 7 下面
  bnLink(a7, a3); ts = [a7]; show(new Set(bnAll(a3)));
  say('7 贏放上面；3、2 掛在 7 下面', '變成一棵 B₂');
  await step(tok); // @c 4943.8 仍是 max tree
  bnAll(a7).forEach((n) => glow(n.m, GREEN));
  say('仍然是 max tree → 一棵 B₂ 的 binomial heap', '');
}]);

// 97:10 Q&A：insert 3 為何不合併（二進位 2 + 1 沒有進位）
FRAG.push(['hashlin1-insert3-why', 'Insert 3 為何不合併：2 + 1 沒有進位', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const o = { sp: 1.0, dy: 1.1, gap: 1.6, D: 2 };
  const a7 = BN(7, BN(5)), a3 = BN(3);
  let v = null;
  await step(tok); // @c 5829.7 已有 7、5 的 B1
  v = bnForest([a7], o);
  say('insert 3 之前：7、5 已經是一棵 B₁', 'n = 2 = 10₂');
  await step(tok); // @c 5838.8 3 是獨立的 B0
  v.kill(); v = bnForest([a7, a3], { ...o, drop: new Set([a3]) });
  say('3 放進來：自己是一棵獨立的 B₀', 'B₁ ＋ B₀');
  await step(tok); // @c 5846.8 2 + 1 沒進位
  good('10₂ + 1₂ = 11₂：沒有進位', 0, 4.9, -1.5);
  say('就是二進位 2 + 1', '沒有進位 → 不用合併');
  await step(tok); // @c 5853.8 3 + 1 才要進位
  note('11₂ + 1₂ = 100₂：這次才進位', 0, 4.2, -1.5);
  say('3 + 1 才要進位', '所以再 insert 2 時才合併');
}]);

// 83:02 n 次 insert：merge 次數 n/2 + n/4 + … → amortized O(1)
FRAG.push(['hashlin1-amortized-counter', 'Insert 的 amortized O(1)：二進位 +1', async (tok) => {
  fresh([0, 5.2, 11.5], [0, 1.2, 0]);
  const X = (k) => 5 - k * 2.0, S = (k) => 0.55 + 0.16 * k;
  const B = new Array(7).fill(null), bits = [], objs = [];
  for (let k = 0; k < 6; k++) { objs.push(cube('', GRAY, [1.6, 0.1, 1.6], X(k), 0.05, 0), tag('B' + hlSub(k), 'idx', X(k), 0, 1.2)); bits.push(tag('0', 'ptr', X(k), 3.0, 0)); }
  objs.push(...bits);
  const cnt = tag('insert 0 次、merge 0 次', 'ptr alt', 0, 4.4, -1.5); objs.push(cnt);
  let ins = 0, mg = 0;
  const mk = (k, z, drop) => cube('B' + hlSub(k), hlOrd(k), [S(k), S(k), S(k)], X(k), S(k) / 2, z, drop);
  const tally = () => txt(cnt, 'insert ' + ins + ' 次、merge ' + mg + ' 次');
  async function inc(ms) {
    ins++;
    let c = mk(0, 2.2, 2.5), k = 0;
    await beat(tok, ms);
    while (B[k]) {
      glow(B[k], GOLD); glow(c, GOLD);
      move(B[k], X(k), S(k) / 2, 2.2); await beat(tok, ms * 0.5);
      kill(B[k]); kill(c); B[k] = null; txt(bits[k], '0'); k++; mg++;
      c = mk(k, 2.2, 0); tally();
      await beat(tok, ms * 0.6);
    }
    move(c, X(k), S(k) / 2, 0); B[k] = c; txt(bits[k], '1'); tally();
    await beat(tok, ms * 0.5);
  }
  await step(tok); // @c 4981.8 每輪塞一棵 B0
  await inc(400);
  say('每一輪：塞進一棵小 B₀', '0₂ + 1 = 1₂');
  await step(tok); // @c 4998.8 已有 B0 → merge
  await inc(400);
  say('原本就有 B₀ → 要合起來（merge）', '1₂ + 1 = 10₂');
  await step(tok); // @c 5014.8 有時合兩次
  await inc(250); await inc(250);
  say('有時要連續合兩次', '11₂ + 1 = 100₂');
  await step(tok); // @c 5045.2 放 B0 共 N
  const t1 = note('放 B₀：每輪 1 次 → n 輪共 n', -3.2, 5.6, -1.5); objs.push(t1);
  say('N 輪：放 B₀ 共花 N 的力氣', '');
  await step(tok); // @c 5055.0 每兩輪 merge B0
  await inc(250); await inc(250);
  say('每 2 輪就要 merge 一次 B₀ ＋ B₀', '奇數輪不用、偶數輪要');
  await step(tok); // @c 5075.6 每四輪 B1、每八輪 B2
  await inc(250); await inc(250);
  say('每 4 輪合一次 B₁、每 8 輪合一次 B₂', '第 8 輪：連續 3 次 merge');
  await step(tok); // @c 5115.8 insert 力氣 O(n)
  say('insert 的力氣：O(n)', '');
  await step(tok); // @c 5141.8 n/2 + n/4 + n/8
  const t2 = note('merge：n/2 + n/4 + n/8 + … < n', 3.2, 5.6, -1.5); objs.push(t2);
  say('若每次 merge 只花 constant', '總 merge 力氣還是 O(n)');
  await step(tok); // @c 5164.9 amortized O(1)
  const t3 = good('n 次 insert 共 O(n) → 平均每次 O(1)', 0, 5.0, -1.5); objs.push(t3);
  say('N 個 insert 共 O(N)', 'amortized：每次 O(1)');
  await step(tok); // @c 5178.8 B0～B4 都有
  for (let k = 0; k < 6; k++) { if (B[k]) kill(B[k]); B[k] = k < 5 ? mk(k, 0, 0) : null; txt(bits[k], k < 5 ? '1' : '0'); }
  say('假設 B₀～B₄ 通通都有', '11111₂');
  await step(tok); // @c 5188.7 一路連鎖合併
  await inc(220);
  say('再放一棵 B₀：一路進位 5 次', '11111₂ + 1 = 100000₂');
  await step(tok); // @c 5205.8 大多時候不花力氣
  say('大多時候不花力氣，偶爾花很多', '平均起來還是便宜');
  await step(tok); // @c 5229.8 兩個老大打一架
  objs.forEach(kill); B.forEach((b) => b && kill(b));
  const w = buddy('老大', 9, '#4b9ee2', -2.4, 0, 0.6, 0.9), l = buddy('老大', 7, '#9b7ef4', 2.4, 0, 0.6, 0.9);
  w.glow(GOLD); l.glow(GOLD);
  say('兩棵 max binomial tree 合併', '只要兩個老大出來打一架');
  await w.hop(tok); await l.hop(tok);
  await step(tok); // @c 5240.8 輸的掛在下面，其他不變
  w.glow(null); l.glow(null); w.mood('happy'); l.mood('sad');
  if (l.name) l.name.element.textContent = '二老大';
  await travel(tok, w.g, V3(-2.4, 0, 0.6), V3(0, 1.8, 0.6), 700);
  await travel(tok, l.g, V3(2.4, 0, 0.6), V3(-1.8, 0, 0.6), 700);
  line(0, 1.9, -1.8, 1.0, 0.6);
  say('輸的乖乖掛在下面', '其他結構完全不變');
  await step(tok); // @c 5276.8 order 最高的小孩放最左
  const k1 = cube('B₁', hlOrd(1), [0.8, 0.7, 0.8], 0.0, 0.35, 0.6), k0 = cube('B₀', hlOrd(0), [0.7, 0.6, 0.7], 1.5, 0.3, 0.6);
  line(0, 1.9, 0.0, 0.7, 0.6); line(0, 1.9, 1.5, 0.6, 0.6);
  note('小孩照 order 由高到低，最高的放最左', 0, -0.6, 2.2);
  say('把 order 最高的小孩畫在最左邊', '');
  await step(tok); // @c 5291.8 像 linked list insert head
  arrow(V3(-1.2, 0.4, 0.6), V3(-0.45, 0.4, 0.6), 0xc08a1f); arrow(V3(0.45, 0.4, 0.6), V3(1.1, 0.4, 0.6), 0xc08a1f);
  glow(k1, null); glow(k0, null);
  good('輸的插在最前面 = insert at head：O(1)', 0, 3.6, 0);
  say('輸的插在小孩串列最前面', '像 linked list insert at head → O(1)');
  await step(tok); // @c 5328.8 平均 constant time
  w.mood('happy'); l.mood('happy');
  say('merge O(1) → insert 平均只要 constant time', 'amortized O(1)');
}]);

// 89:09 兩個 binomial heap 合併 = 兩個二進位數相加
FRAG.push(['hashlin1-meld-binary', '合併兩個 binomial heap = 二進位加法', async (tok) => {
  fresh([0, 4.8, 11.5], [0, 1.8, 0]);
  const o = { sp: 0.75, dy: 1.0, gap: 0.8, D: 3 };
  let A = [BN(9, BN(6, BN(2)), BN(4)), BN(8)], Bq = [BN(7, BN(5)), BN(1)], C = [];
  const vs = {};
  const show = (drop, withB = true) => { for (const k in vs) vs[k].kill(); vs.a = bnForest(A, { ...o, cx: -4.3, drop }); if (withB) vs.b = bnForest(Bq, { ...o, cx: 4.3, drop }); vs.c = bnForest(C, { ...o, cx: 0, drop, tagOf: (t) => '結果 B' + hlSub(t.kids.length) }); };
  await step(tok); // @c 5352.8 node 總數 ↔ 二進位
  show(null, false);
  tag('n = 5 = 101₂', 'ptr', -4.3, 5.3);
  say('node 總數 ↔ 二進位：5 = 101₂', 'B₂ ＋ B₀');
  await step(tok); // @c 5370.8 merge ≈ 二進位加法
  note('像加法器：+1、+1、+1 …', 0, 5.9, -1.5);
  say('heap 上的 merge，道理上就是二進位加法', '');
  await step(tok); // @c 5391.8 兩個 heap 相加
  show(new Set(bnAll(Bq[0]).concat(bnAll(Bq[1]))));
  tag('n = 3 = 011₂', 'ptr', 4.3, 5.3);
  say('兩個 binomial heap 合起來', '= 兩個二進位數相加：101₂ + 011₂');
  await step(tok); // @c 5411.9 學校 / 約會 to-do
  bub('學校 to-do list', -4.3, -0.4, 1.2); bub('約會 to-do list', 4.3, -0.4, 1.2);
  say('例：學校 to-do ＋ 約會 to-do', '兩個 priority queue 要合併');
  await step(tok); // @c 5427.8 合起來
  const fights = [() => [A[1], Bq[1]], () => [C[0], Bq[0]], () => [A[0], C[0]]];
  for (const f of fights) {
    const [a, b] = f();
    glow(a.m, GOLD); glow(b.m, GOLD);
    await beat(tok, 350);
    const { w, l } = bnLink(a, b);
    A = A.filter((t) => t !== a && t !== b); Bq = Bq.filter((t) => t !== a && t !== b); C = [w];
    show(new Set(bnAll(l)));
    await beat(tok, 550);
  }
  say('從最低位加：8 贏 1、8 贏 7、9 贏 8', '101₂ + 011₂ = 1000₂：一棵 B₃');
  await step(tok); // @c 5441.8 比 complete tree heap 更好
  good('merge：比 complete tree 做的 heap 方便', 0, 5.2, -1.5);
  say('在 merge 上，binomial heap 性質更好', '');
  await step(tok); // @c 5448.8 最大的怎麼拿？
  say('那最大的要怎麼拿出來？', '每棵都是 max tree…');
}]);

// 91:13 getMax：問每棵樹的老大；removeMax：拆出小樹再 merge
FRAG.push(['hashlin1-getmax-remove', 'getMax 只看 root；removeMax 拆樹再合併', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const o = { sp: 0.95, dy: 1.05, gap: 1.4 };
  const t2 = BN(8, BN(5, BN(1)), BN(3)), t1 = BN(9, BN(2)), t0 = BN(6);
  let v = null, w2 = null;
  await step(tok); // @c 5473.8 每棵都有自己的老大
  v = bnForest([t2, t1, t0], o);
  [t2, t1, t0].forEach((t) => glow(t.m, GOLD));
  say('每棵都是 max tree，各有自己的老大', '例：7 個 node = 111₂');
  await step(tok); // @c 5498.8 sequential search
  [t2, t1, t0].forEach((t) => glow(t.m, null));
  const cur = pkt('老大你多大？', 0, 0); let best = null;
  for (const t of [t2, t1, t0]) { cur.position.set(t.x, t.y + 1.4, 0); glow(t.m, GOLD); if (!best || t.v > best.v) best = t; await beat(tok, 600); glow(t.m, null); }
  kill(cur); glow(best.m, GREEN);
  say('sequential search：每個老大都問一次', '只看 root');
  await step(tok); // @c 5514.0 樹最多 log n 棵
  say('要問幾個老大？樹最多 log n 棵', '');
  await step(tok); // @c 5520.8 255 → 8 bit
  note('255 = 11111111₂：只要 8 個 bit', 0, 5.0, -1.5);
  say('就像 255 的二進位只要 8 位', '數字 n 只要 log n 位');
  await step(tok); // @c 5569.8 getMax O(log n)
  say('getMax = 9：O(log n)', '');
  await step(tok); // @c 5582.4 removeMax 拿掉
  fly(t1.m);
  say('removeMax：找到 9，把它拿掉', '');
  await step(tok); // @c 5592.7 那棵樹拆開
  v.kill();
  const c = t1.kids[0];
  v = bnForest([t2, t0], { ...o, cx: -1.4 });
  w2 = bnForest([c], { ...o, cx: 4.4, tagOf: () => '拆出來的 B₀' });
  say('那棵樹分崩離析 → 變成小 binomial tree', '9 的小孩 2 自成一棵 B₀');
  await step(tok); // @c 5609.8 新的 forest
  bub('我們是一個新 forest', 4.4, 2.6);
  say('拆出來的小樹 = 一個新的 forest', '');
  await step(tok); // @c 5616.8 跟原 forest merge
  glow(t0.m, GOLD); glow(c.m, GOLD);
  await beat(tok, 600);
  const { w, l } = bnLink(t0, c);
  v.kill(); w2.kill();
  v = bnForest([t2, w], { ...o, drop: new Set([l]) });
  say('跟原 forest merge：6 和 2 打一架', '101₂ + 001₂ = 110₂，O(log n)');
  await step(tok); // @c 5636.8 二進位加減 + max tree
  say('binomial heap = 二進位的加法、減法', '＋ 用 max tree 管誰是老大');
}]);

// 99:19 為什麼最多 log n 棵：n = 15、14、8
FRAG.push(['hashlin1-tree-count', '樹的棵數 = 二進位裡 1 的個數', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.8, 0]);
  const o = { sp: 0.8, dy: 1.0, gap: 1.1, col: (n, t) => hlOrd(t.kids.length) };
  let v = null;
  const nt = tag(' ', 'ptr', 0, 5.3, -1.5);
  const showN = (n) => {
    if (v) v.kill();
    const ts = []; for (let k = 3; k >= 0; k--) if ((n >> k) & 1) ts.push(bnMake(k));
    v = bnForest(ts, o);
    txt(nt, 'n = ' + n + ' = ' + hlBin(n).padStart(4, '0') + '₂ → ' + ts.length + ' 棵');
    return ts;
  };
  const ask = async (ts, ms) => { for (const t of ts) { glow(t.m, GOLD); await beat(tok, ms); } };
  await step(tok); // @c 5958.8 15 = 1111
  let ts = showN(15);
  say('n = 15 = 1111₂', '最多 4 棵：B₃、B₂、B₁、B₀');
  await step(tok); // @c 5978.3 4 個老大問完
  await ask(ts, 500);
  say('4 個老大都問完，就知道最大在哪', '');
  await step(tok); // @c 5986.7 14 = 1110
  ts = showN(14);
  say('n = 14 = 1110₂', '3 棵：B₃、B₂、B₁');
  await step(tok); // @c 6012.7 15 到 8 最大都是 B3
  ts = showN(8); glow(ts[0].m, GOLD);
  say('n 從 15 一路到 8：最大一棵都是 B₃', '有時問 4 棵、有時 3 棵、2 棵…');
  await step(tok); // @c 6043.8 log2 n
  note('log₂15 ≈ 3.9、log₂8 = 3', -4.6, 6.2, -2);
  say('棵數跟 log₂n 有關', '');
  await step(tok); // @c 6066.8 floor
  note('⌊log₂n⌋ = 3 → 最大一棵是 B₃', 0, 6.2, -2);
  say('取 floor（去掉小數）：最大一棵是 B⌊log₂n⌋', '');
  await step(tok); // @c 6085.8 + 1
  good('最多 ⌊log₂n⌋ + 1 棵', 4.6, 6.2, -2);
  say('再加 1：forest 裡最多的棵數', '還沒進到下一級的樹');
  await step(tok); // @c 6115.3 老大中的老大
  ts = showN(15);
  const hand = pkt('老大你多大？', 0, 0);
  for (let i = 0; i < ts.length; i++) { const a = ts[Math.max(0, i - 1)]; await travel(tok, hand, V3(a.x, a.y + 1.3, 0), V3(ts[i].x, ts[i].y + 1.3, 0), 450); glow(ts[i].m, GOLD); }
  kill(hand);
  say('getMax：找出老大中的老大', '');
  await step(tok); // @c 6124.4 運氣好：8 只問一個
  ts = showN(8); glow(ts[0].m, GREEN);
  say('運氣好：8 個 node 只要問 1 個老大', '');
  await step(tok); // @c 6131.8 最糟：15、7、63
  ts = showN(7); await ask(ts, 400);
  say('最糟：像 7、15、63，每一棵都有', '每個小老大都要問');
  await step(tok); // @c 6153.8 O(log n)
  say('用最糟情況估：getMax 是 O(log n)', '');
}]);

// 103:57 removeMax 例子：14 個 node（1110₂），max 在 B2 的 root
FRAG.push(['hashlin1-removemax-14', 'removeMax：14 個 node 拿掉 B₂ 的老大', async (tok) => {
  fresh([0, 4.8, 11.5], [0, 1.6, 0]);
  const o = { sp: 0.75, dy: 1.0, gap: 1.0 };
  const t3 = BN(45, BN(42, BN(38, BN(11)), BN(36)), BN(33, BN(22)), BN(15));
  const t2 = BN(50, BN(40, BN(30)), BN(35));
  const t1 = BN(25, BN(5));
  let v = null, w2 = null;
  await step(tok); // @c 6236.8 14 個 node
  v = bnForest([t3, t2, t1], { ...o, cx: -1 });
  say('binomial heap 有 14 個 node', '14 = 1110₂ → B₃ + B₂ + B₁');
  await step(tok); // @c 6243.8 找到 max
  const cur = pkt('老大你多大？', 0, 0);
  for (const t of [t3, t2, t1]) { cur.position.set(t.x, t.y + 1.4, 0); glow(t.m, GOLD); await beat(tok, 550); glow(t.m, null); }
  kill(cur); glow(t2.m, GREEN);
  say('找到老大中的老大：max = 50', '在 B₂ 的 root');
  await step(tok); // @c 6255.8 只看這一棵
  bnAll(t2).slice(1).forEach((n) => glow(n.m, GOLD));
  say('只看這一棵：拿掉老大很容易', '');
  await step(tok); // @c 6263.8 派系都分好了
  bnAll(t2.kids[0]).forEach((n) => glow(n.m, '#16306a'));
  glow(t2.kids[1].m, GOLD);
  say('老大下面的派系早就分好了', 'B₂ = 老大 ＋ 一棵 B₁ ＋ 一棵 B₀');
  await step(tok); // @c 6287.8 變成一幫小嘍囉
  fly(t2.m);
  await beat(tok, 700);
  v.kill();
  const [p1, p0] = t2.kids;
  bnAll(t2).forEach((n) => glow(n.m, null));
  v = bnForest([t3, t1], { ...o, cx: -2.2 });
  w2 = bnForest([p1, p0], { ...o, cx: 4.6, gap: 0.9 });
  say('老大拿掉後：剩一幫小嘍囉', '一棵 B₁、一棵 B₀');
  await step(tok); // @c 6309.8 1 變 0，冒出小嘍囉
  note('1110₂ − 0100₂ = 1010₂', -2.2, 5.0, -1.5); note('小嘍囉：0011₂', 4.6, 5.0, -1.5);
  say('B₂ 那一位從 1 變 0', '再把小嘍囉加回來');
  await step(tok); // @c 6336.1 從低位加：B0
  glow(p0.m, GOLD);
  say('二進位加法，從低位加：B₀ 只有 35', '直接放');
  await step(tok); // @c 6344.8 B1 + B1 → B2
  glow(p0.m, null); glow(t1.m, GOLD); glow(p1.m, GOLD);
  await beat(tok, 500);
  const { w, l } = bnLink(t1, p1);
  v.kill(); w2.kill();
  v = bnForest([t3, w, p0], { ...o, drop: new Set(bnAll(l)) });
  say('B₁ ＋ B₁：40 贏 25', '原本空著的地方變出一棵 B₂');
  await step(tok); // @c 6354.8 B3 不動
  bnAll(t3).forEach((n) => glow(n.m, GREEN));
  say('B₃ 保持不動', '1010₂ + 0011₂ = 1101₂ = 13');
  await step(tok); // @c 6366.8 n − 2^k + (2^k − 1)
  bnAll(t3).forEach((n) => glow(n.m, null));
  say('removeMax = 減掉 2ᵏ，再加回 2ᵏ − 1', '都是二進位加減法，O(log n)');
}]);

// 118:45 兩個老大一樣大時怎麼合併
FRAG.push(['hashlin1-tie', '老大一樣大：誰在上面都可以', async (tok) => {
  fresh([0, 4.2, 10], [0, 1.4, 0]);
  const a = BN(7, BN(3)), b = BN(7, BN(5));
  let va = null, vb = null;
  await step(tok); // @c 7125.0 兩個老大一樣大
  va = bnForest([a], { cx: -2.6, sp: 1, dy: 1.2, tagOf: () => '原本的 B₁' });
  vb = bnForest([b], { cx: 2.6, sp: 1, dy: 1.2, tagOf: () => '併進來的 B₁' });
  say('兩個要合併的老大一樣大，怎麼辦？', '兩個老大都是 7');
  await step(tok); // @c 7128.8 誰在上面都可以
  glow(a.m, GOLD); glow(b.m, GOLD);
  const ok = good('7 ≥ 7：兩種都合法', 0, 4.2);
  say('只要 max tree 性質：誰在上面都可以', '');
  await step(tok); // @c 7148.8 併進來的放下面
  kill(ok); glow(a.m, null);
  const { l } = bnLink(a, b);
  va.kill(); vb.kill();
  va = bnForest([a], { sp: 1, dy: 1.2, drop: new Set(bnAll(l)) });
  say('實作上決定一種：併進來的放下面', '');
  await step(tok); // @c 7187.8 再比小弟？
  glow(b.m, GOLD); glow(a.kids[1].m, GOLD);
  bub('老大一樣 → 再比小弟？', 0, 4.4);
  say('能不能更細緻：老大一樣就比小弟？', '技術上可以');
  await step(tok); // @c 7202.8 多花成本、edge case
  bad('多花成本、edge case 更多', -3.4, 3.4);
  say('但要多花成本，edge case 也更多', '');
  await step(tok); // @c 7217.8 一路比下去
  note('小弟也一樣 → 再比小小弟 …', 3.4, 3.4);
  say('一路比下去很累', '還可能碰到兩棵長得一模一樣');
  await step(tok); // @c 7241.8 simplest solution
  glow(b.m, null); glow(a.kids[1].m, null);
  good('選最簡單的 solution', 0, -0.4, 1.2);
  say('一般的 priority queue 不需要', '選最簡單的 solution');
  await step(tok); // @c 7257.6 不浪費空間
  note('兩筆 entry 本來就要存兩筆', 3.6, 0.6, 1.2);
  say('同 priority 合併也不浪費空間', '兩筆資料本來就要存');
}]);

// 122:21 性質（ADT）與 implementation 分開
FRAG.push(['hashlin1-adt-impl', '性質 vs implementation', async (tok) => {
  fresh([0, 5.5, 11.5], [0, 2.0, 0]);
  tag('性質：要做到什麼', 'idx', -3.8, 5.3); tag('implementation：怎麼做', 'idx', 3.4, 5.3);
  const imp = (i) => { cube(['heap', 'binomial heap', 'ordered array'][i], hlOrd(i + 2), [2.6, 0.7, 1.0], 3.4, 4.5 - i * 1.25, 0, 2.5); arrow(V3(-2.1, 4.3, 0), V3(2.0, 4.5 - i * 1.25, 0)); };
  let cd = null;
  await step(tok); // @c 7340.8 priority queue 是一種性質
  cube('Priority Queue', '#9b7ef4', [3.2, 0.8, 1.1], -3.8, 4.3, 0);
  say('priority queue 是一種「性質」', '');
  await step(tok); // @c 7351.8 container A
  cd = code(['container A 要能：', 'remove / retrieve max：要快', 'insert(key, data)：要快'], -3.8, 3.2, 0.5, 0);
  say('有一個 container，叫它 A', '');
  await step(tok); // @c 7360.8 remove / retrieve max fast
  cd.hl(1);
  say('remove 或 retrieve 最大的 key：要快', '');
  await step(tok); // @c 7381.8 insert fast
  cd.hl(2);
  say('insert：把 key 和 data 塞進去也要快', '');
  await step(tok); // @c 7396.8 heap、binomial heap
  cd.hl(-1);
  imp(0); await beat(tok, 500); imp(1);
  say('implementation：heap、binomial heap …', '');
  await step(tok); // @c 7405.8 ordered array
  imp(2);
  say('也可以用 ordered array', '快不快各有差別');
  await step(tok); // @c 7420.8 stack、queue 也是性質
  cube('Stack', '#4b9ee2', [2.2, 0.7, 1.0], -3.8, 0.35, 1.8, 2.5);
  cube('Queue', '#31aab0', [2.2, 0.7, 1.0], -3.8, 0.35, 3.4, 2.5);
  say('stack 和 queue 也是「性質」', '');
  await step(tok); // @c 7425.8 stack 用 array
  cube('array', '#c08a1f', [2.2, 0.7, 1.0], 3.4, 0.35, 1.8, 2.5); arrow(V3(-2.6, 0.35, 1.8), V3(2.2, 0.35, 1.8));
  say('stack 可以用 array 實作', '');
  await step(tok); // @c 7428.2 queue 用 circular array
  cube('circular array', '#e55a9b', [2.6, 0.7, 1.0], 3.4, 0.35, 3.4, 2.5); arrow(V3(-2.6, 0.35, 3.4), V3(2.0, 0.35, 3.4));
  say('queue 可以用 circular array 實作', '性質 ≠ implementation');
}]);

// 124:12 Map：依 key 拿東西；Dictionary：一個 key 多個 value
FRAG.push(['hashlin1-map-dict', 'Map 與 Dictionary', async (tok) => {
  fresh([0, 6.2, 11], [0, 1.0, 0]);
  const zs = [-1.8, 0, 1.8], ks = [], vs = [];
  const pair = (i) => {
    ks.push(cube('key' + hlSub(i + 1), '#4b9ee2', [1.3, 0.7, 1.0], -5.4, 0.35, zs[i], 2.5));
    arrow(V3(-4.6, 0.4, zs[i]), V3(-3.2, 0.4, zs[i]));
    vs.push(cube('value' + hlSub(i + 1), '#2fc092', [1.5, 0.7, 1.0], -2.3, 0.35, zs[i], 2.5));
  };
  const chain = [];
  await step(tok); // @c 7452.2 資料帶 key 放進去
  pair(0);
  say('跟 priority queue 一樣：資料帶著 key 放進去', '');
  await step(tok); // @c 7473.8 依 key 拿
  const hand = pkt('get(key₁)', 0, 0);
  await travel(tok, hand, V3(-5.4, 1.5, zs[0]), V3(-2.3, 1.5, zs[0]), 900);
  glow(vs[0], GREEN);
  say('但拿的時候不再拿最大的', '而是根據 key 去 get / remove');
  await step(tok); // @c 7547.8 叫 map
  kill(hand); glow(vs[0], null);
  tag('Map：一對一', 'ptr', -3.8, 2.6, -3.2);
  say('這樣的資料結構叫做 map', '');
  await step(tok); // @c 7555.7 像地圖
  bub('像看地圖：用地名找到東西', -3.8, 3.4, -3.2);
  say('像看地圖：key 是地圖上的標記', '用它找到要的東西');
  await step(tok); // @c 7578.8 存 key 和 value
  say('map 存的是 key 和 value 的關係', 'data 通常叫 value');
  await step(tok); // @c 7591.1 key1 → value1、key2 → value2
  pair(1); await beat(tok, 500); pair(2);
  say('key₁ → value₁、key₂ → value₂ …', '');
  await step(tok); // @c 7612.3 一個 key 多個 value
  cube('key₁', '#4b9ee2', [1.2, 0.7, 1.0], 0.3, 0.35, 0, 2.5);
  arrow(V3(1.0, 0.4, 0), V3(1.6, 0.4, 0));
  for (let i = 0; i < 3; i++) {
    chain.push(lnode(['v₁₁', 'v₁₂', 'v₁₃'][i], 2.2 + i * 1.75, 0.35, 0, '#2fc092'));
    if (i) arrow(V3(2.2 + (i - 1) * 1.75 + 0.95, 0.4, 0), V3(2.2 + i * 1.75 - 0.52, 0.4, 0));
    await beat(tok, 450);
  }
  say('變形：一個 key 對到好幾個 value', 'key₁ → v₁₁、v₁₂、v₁₃');
  await step(tok); // @c 7641.8 dictionary
  tag('Dictionary：一對多', 'ptr', 3.0, 2.6, -3.2);
  bub('像英文字典：一個字很多解釋', 3.0, 3.4, -3.2);
  say('這叫 dictionary', '就像一個單字有很多個解釋');
  await step(tok); // @c 7662.8 map 一對一
  ks.forEach((k) => glow(k, GOLD));
  say('map：一個 key 只查到一個結果', '');
  await step(tok); // @c 7693.8 value 換成 linked list
  ks.forEach((k) => glow(k, null));
  chain.forEach((g) => glow(g.userData.data, GOLD));
  note('value 換成一個 set（例如 linked list）', 3.9, 1.6, 1.4);
  say('dictionary 也能用 map 做', '把 value 換成一條 linked list');
  await step(tok); // @c 7711.8 這裡談 map
  chain.forEach((g) => glow(g.userData.data, null));
  ks.forEach((k) => glow(k, GREEN));
  say('接下來的重點：map 要怎麼做得快', '');
}]);

// 129:01 ordered map vs unordered map
FRAG.push(['hashlin1-ordered-keys', 'Ordered 與 unordered 的 key', async (tok) => {
  fresh([0, 6, 11], [0, 1.0, 0]);
  await step(tok); // @c 7741.8 key 之間有大小關係
  tag('ordered：key 可以比大小', 'ptr', -3.4, 2.4, -3.2);
  say('有一種 key：彼此有大小關係', '可以排出順序 → ordered');
  await step(tok); // @c 7751.8 integer
  const ints = [3, 12, 27, 41];
  for (let i = 0; i < 4; i++) { cube(ints[i], colorFor(ints[i]), [0.8, 0.7, 0.8], -5.8 + i * 1.6, 0.35, -1.2, 2.5); if (i) tag('<', 'idx', -6.6 + i * 1.6, 0.5, -1.2); await beat(tok, 300); }
  say('integer key：明顯有大小', '3 < 12 < 27 < 41');
  await step(tok); // @c 7765.8 string 字典順序
  const strs = ['apple', 'melon', 'zebra'];
  for (let i = 0; i < 3; i++) { cube(strs[i], hlOrd(i), [1.3, 0.7, 0.9], -5.6 + i * 2.1, 0.35, 1.4, 2.5); if (i) tag('<', 'idx', -6.65 + i * 2.1, 0.5, 1.4); await beat(tok, 300); }
  say('string key：字典順序', 'A 開頭排前面、Z 開頭排後面');
  await step(tok); // @c 7788.8 用順序幫忙
  say('有些 map 會用「順序」來幫忙', '更快 insert、remove、找東西');
  await step(tok); // @c 7817.7 unordered
  tag('unordered：只要是 key', 'ptr', 3.8, 2.4, -3.2);
  say('另一種：unordered', '');
  await step(tok); // @c 7830.8 key 只要是 key 就可以
  const un = [['Paul', 2.0, -1.4], ['#A7', 5.0, -0.6], ['(2,5)', 3.0, 1.2], ['img01', 5.6, 1.9]];
  for (const [s, x, z] of un) { cube(s, '#9b7ef4', [1.2, 0.7, 0.9], x, 0.35, z, 2.5); await beat(tok, 300); }
  say('不考慮能不能排：只要是 key 就能放', '');
  await step(tok); // @c 7837.8 比較有沒有意義
  bub('Paul 和 (2,5) 誰大？有意義嗎？', 3.8, 3.4, -1.0);
  say('硬要排也行，但比較有沒有意義？', '');
  await step(tok); // @c 7871.8 ordered = 強假設
  good('ordered：比較強的假設 → 有機會更快', -3.4, 3.4, -3.2);
  say('ordered：對 key 是比較強的假設', '希望藉此做得更快');
  await step(tok); // @c 7885.8 弱假設下還有哪些招
  say('unordered：比較弱的假設', '這樣還有哪些招能讓 map 很快？');
}]);

// 132:07 用 linked list / array 實作 map 的代價
FRAG.push(['hashlin1-list-array-map', '用 list / array 實作 map', async (tok) => {
  fresh([0, 6.6, 12], [0, 2.0, 0]);
  const cd = code(['                insert   get', 'unsorted list   O(1)     O(n)', 'sorted list     O(n)     O(n)', 'unsorted array  O(1)     O(n)', 'sorted array    O(n)     O(log n)'], 0, 6.2, 0.5, -3.4);
  let objs = [];
  const mkList = (keys, x0) => { const ns = []; keys.forEach((k, i) => { ns.push(lnode(k, x0 + i * 2.0, 0.35, 1.2)); objs.push(ns[i]); if (i) objs.push(arrow(V3(x0 + (i - 1) * 2.0 + 0.95, 0.4, 1.2), V3(x0 + i * 2.0 - 0.52, 0.4, 1.2))); }); return ns; };
  const ax = (i) => -4.9 + i * 1.4;
  const mkArr = (A, n) => { const M = []; for (let i = 0; i < n; i++) { objs.push(cube('', GRAY, [1.25, 0.1, 1.2], ax(i), 0.05, 1.2), tag(String(i), 'idx', ax(i), 0, 2.2)); } A.forEach((v, i) => { M.push(cube(v, colorFor(v), [0.9, 0.7, 0.9], ax(i), 0.45, 1.2)); objs.push(M[i]); }); return M; };
  const cur = pkt('', 0, 0, 0);
  const hide = () => { cur.element.style.visibility = 'hidden'; };
  const at = (x, t) => { cur.element.style.visibility = ''; cur.position.set(x, 1.6, 1.2); txt(cur, t); };
  hide();
  await step(tok); // @c 7934.7 key、value 打包放進 linked list
  let nodes = mkList([12, 5, 30, 8], -3.6);
  say('把 (key, value) 打包當 data', '塞進 linked list');
  await step(tok); // @c 7963.8 亂放 insert head
  cd.hl(1);
  const g = lnode(20, -5.6, 3.0, 1.2, '#dd8238'); objs.push(g);
  await anim(tok, 600, (t) => { g.position.y = 3.0 - 2.65 * t; });
  objs.push(arrow(V3(-5.6 + 0.95, 0.4, 1.2), V3(-3.6 - 0.52, 0.4, 1.2)));
  say('東西亂放：每筆都 insert 在 head', '不用假設 key 有順序');
  await step(tok); // @c 7983.1 不花力氣
  say('insert：完全不花力氣', 'O(1)');
  await step(tok); // @c 8002.8 get 整串掃
  const all = [g].concat(nodes);
  for (let i = 0; i < all.length; i++) { at(all[i].position.x, 'get 8'); glow(all[i].userData.data, i === all.length - 1 ? GREEN : GOLD); await beat(tok, 400); }
  say('get：整串掃過才找到', 'O(n)，n = 資料筆數');
  await step(tok); // @c 8018.1 照 key 排序
  objs.forEach(kill); objs = []; hide();
  cd.hl(2);
  nodes = mkList([5, 8, 12, 20, 30], -4.6);
  say('改成照 key 排好序的 linked list', 'key 必須能比較');
  await step(tok); // @c 8041.8 insert 找適合位置
  for (let i = 0; i < nodes.length; i++) { at(nodes[i].position.x, 'insert 35'); await beat(tok, 350); }
  const n35 = lnode(35, -4.6 + 5 * 2.0, 3.0, 1.2, '#dd8238'); objs.push(n35);
  await anim(tok, 500, (t) => { n35.position.y = 3.0 - 2.65 * t; });
  say('insert：要先走到適合的位置', '剛好在最後面 → O(n)');
  await step(tok); // @c 8057.8 沒有 binary search
  hide();
  objs.push(bad('linked list 沒有 binary search', 0, 2.4, 1.2));
  say('get：linked list 沒有 binary search 可用', '還是 O(n)');
  await step(tok); // @c 8079.9 改用 array
  objs.forEach(kill); objs = [];
  cd.hl(3);
  let M = mkArr([12, 5, 30, 8], 8);
  say('換成 array：data 放進 array 的格子', '');
  await step(tok); // @c 8095.8 塞在最後
  const n20 = cube(20, colorFor(20), [0.9, 0.7, 0.9], ax(4), 0.45, 1.2, 2.5); objs.push(n20); M.push(n20);
  say('unordered key：塞在最後面', 'insert 不花力氣');
  await step(tok); // @c 8103.6 sequential search
  for (let i = 0; i < M.length; i++) { at(ax(i), 'get 20'); glow(M[i], i === 4 ? GREEN : GOLD); await beat(tok, 350); }
  say('get：只能 sequential search', 'O(n)');
  await step(tok); // @c 8111.5 ordered：擠到中間
  objs.forEach(kill); objs = []; hide();
  cd.hl(4);
  M = mkArr([2, 5, 8, 12, 16, 23, 38], 8);
  for (let i = 6; i >= 3; i--) { move(M[i], ax(i + 1), 0.45, 1.2); await beat(tok, 250); }
  const n10 = cube(10, colorFor(10), [0.9, 0.7, 0.9], ax(3), 0.45, 1.2, 2.5); objs.push(n10);
  M.splice(3, 0, n10);
  say('ordered key：insert 要擠進中間', '後面全部往後挪 → O(n)');
  await step(tok); // @c 8125.8 binary search
  for (const [mi, ok] of [[3, false], [5, false], [6, true]]) { at(ax(mi), 'mid'); glow(M[mi], ok ? GREEN : GOLD); await beat(tok, 600); if (!ok) glow(M[mi], null); }
  say('key 能比較 → binary search 找 23', 'get：O(log n)');
  await step(tok); // @c 8132.8 remove 補位
  hide();
  objs.push(note('remove：後面的人要補位 → 額外力氣', 0, 2.6, 1.2));
  say('remove 還要讓後面的人補位', '要花額外的力氣');
  await step(tok); // @c 8165.7 n 是慢的
  say('n 對我們來說是慢的', 'n²、n³ 更慢');
  await step(tok); // @c 8186.9 log n 勉強快
  say('log n 勉強算快', '256 筆只要 8 步');
}]);

// 136:59 integer key 直接當 array index
FRAG.push(['hashlin1-direct-address', 'Key 是小整數：直接當 index', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const sx = (i) => -5.4 + i * 1.2, slots = [];
  const cur = pkt(' ', 0, 1.8, 0.6);
  const vis = (on) => { cur.element.style.visibility = on ? '' : 'hidden'; };
  vis(false);
  const vals = {};
  await step(tok); // @c 8226.8 key 當 array index
  for (let i = 0; i < 10; i++) { slots.push(cube('', GRAY, [1.05, 0.1, 1.2], sx(i), 0.05, 0.6)); tag(String(i), 'idx', sx(i), 0, 1.6); }
  say('key 本來就是 integer', '乾脆把 key 當 array index');
  await step(tok); // @c 8239.8 櫃子號碼
  tag('array A（櫃子號碼 = key）', 'ptr', 0, 2.4, -1.2);
  say('key 就是櫃子的號碼', '');
  await step(tok); // @c 8246.8 small integer
  note('small integer：範圍有限（這裡 0～9）', 0, 3.2, -1.2);
  say('先假設 key 是 small integer', '範圍有限、不太大');
  await step(tok); // @c 8260.8 只放 value
  say('不用把 key 一起塞進去', '櫃子裡只放 value');
  await step(tok); // @c 8279.8 insert = assignment
  vis(true);
  for (const k of [3, 7]) { cur.position.set(sx(k), 1.8, 0.6); txt(cur, 'A[' + k + ']'); vals[k] = cube('v' + hlSub(k), '#2fc092', [0.9, 0.7, 0.9], sx(k), 0.45, 0.6, 2.5); await beat(tok, 700); }
  say('insert：A[key] = value', '一次 assignment → O(1)');
  await step(tok); // @c 8284.8 get
  cur.position.set(sx(7), 1.8, 0.6); txt(cur, 'get 7');
  glow(vals[7], GREEN);
  say('get(7)：打開 7 號櫃子拿出來', 'v = A[7] → O(1)');
  await step(tok); // @c 8299.8 咚！跳過去
  glow(vals[7], null);
  txt(cur, '咚！');
  await travel(tok, cur, V3(sx(0), 1.8, 0.6), V3(sx(3), 1.8, 0.6), 500);
  glow(vals[3], GREEN);
  say('array 的特性：馬上算出櫃子在哪', '咚！跳過去打開就拿到');
  await step(tok); // @c 8318.9 super big array
  glow(vals[3], null); vis(false);
  const gb = ghostBox('#9b7ef4', 13, 0.4, 1.0); gb.position.set(0, 0.25, -2.6);
  tag('key 到 10000 → 要 10001 格', 'ptr', 0, 1.2, -2.6);
  say('key 不小：需要 super big array', '');
  await step(tok); // @c 8333.7 很多地方是空的
  slots.forEach((s, i) => { if (!vals[i]) glow(s, RED); });
  say('大部分格子都空著', '浪費空間');
  await step(tok); // @c 8358.8 空間換時間
  slots.forEach((s) => glow(s, null));
  say('用空間換時間', 'space-time trade-off');
  await step(tok); // @c 8375.8 縮小空間
  say('不想要那麼大的空間？', '→ 把 key 壓縮到小一點的範圍');
}]);

// 139:56 不要超大 array：convert（→ integer）＋ compress（→ small integer）
FRAG.push(['hashlin1-convert-compress', 'Convert 再 compress', async (tok) => {
  fresh([0, 5.6, 11], [0, 1.4, 0]);
  const X = [-5.2, -1.8, 1.6, 5.0];
  let k1 = null, s1 = null, k0 = null, s2 = null;
  await step(tok); // @c 8395.6 只有 100 格、key 範圍 1 萬
  tag('A[0..99]', 'idx', X[3], 2.0, -1.2);
  for (let i = 0; i < 5; i++) cube(i === 4 ? '…' : '', GRAY, [0.4, 0.1, 1.0], X[3] - 1.0 + i * 0.5, 0.05, 0);
  note('key 範圍：0～10000', X[1], 2.6, -1.2);
  say('array 只有 100 格，key 範圍卻有 1 萬', '要把 key 壓進這 100 格');
  await step(tok); // @c 8412.7 事情一：壓縮
  tag('integer', 'idx', X[1], 2.0, -1.2); tag('small integer', 'idx', X[2], 2.0, -1.2);
  k1 = cube(4567, '#4b9ee2', [1.2, 0.7, 0.9], X[1], 0.35, 0, 2.5);
  arrow(V3(X[1] + 0.7, 0.4, 0), V3(X[2] - 0.7, 0.4, 0)); tag('compress', 'ptr alt', (X[1] + X[2]) / 2, 1.2, 0);
  s1 = cube(67, '#2fc092', [1.0, 0.7, 0.9], X[2], 0.35, 0, 2.5);
  say('事情一：大整數壓縮成小整數', '例：4567 mod 100 = 67');
  await step(tok); // @c 8423.4 事情二：不是 integer
  kill(k1); kill(s1);
  tag('key', 'idx', X[0], 2.0, -1.2);
  k0 = cube('apple', '#e55a9b', [1.3, 0.7, 0.9], X[0], 0.35, 0, 2.5);
  say('事情二：key 根本不是 integer？', '例如 string "apple"');
  await step(tok); // @c 8438.8 convert
  arrow(V3(X[0] + 0.75, 0.4, 0), V3(X[1] - 0.7, 0.4, 0)); tag('convert', 'ptr alt', (X[0] + X[1]) / 2, 1.2, 0);
  cube(530, '#4b9ee2', [1.2, 0.7, 0.9], X[1], 0.35, 0, 2.5);
  say('先 convert 成 integer', '示意：字元碼加總 = 530');
  await step(tok); // @c 8447.8 再 compress
  s2 = cube(30, '#2fc092', [1.0, 0.7, 0.9], X[2], 0.35, 0, 2.5);
  say('再 compress 到 array 的範圍', '530 mod 100 = 30');
  await step(tok); // @c 8466.8 三件事都快
  arrow(V3(X[2] + 0.6, 0.4, 0), V3(X[3] - 1.3, 0.4, 0));
  const p = pkt('A[30]', X[2], 1.6, 0);
  await travel(tok, p, V3(X[2], 1.6, 0), V3(X[3] - 0.5, 1.0, 0), 800);
  glow(k0, GOLD); glow(s2, GREEN);
  say('convert 快、compress 快、array 也快', '→ 快速的 map（如意算盤）');
  await step(tok); // @c 8498.8 突破「小」和「integer」
  note('突破「小」→ compress；突破「integer」→ convert', 0, 3.3, -1.2);
  say('array 只適合小的 integer key', '兩件事都做到，就能突破限制');
  await step(tok); // @c 8531.8 key → small integer
  good('任何 key → small integer', 0, 4.1, -1.2);
  say('出發點：把任何 key 轉成 small integer', '');
}]);

// 146:16 h = hash code + compress；A[h(key)]；bucket array
FRAG.push(['hashlin1-h-pipeline', 'h(key)：hash code ＋ compress，放進 bucket array', async (tok) => {
  fresh([0, 6.4, 11.5], [0, 1.6, 0]);
  const cd = code(['h(key) = compress( hashcode(key) )', 'insert:  A[h(key)] = value', 'get:     v = A[h(key)]'], 0, 6.6, 0.55, -3.4);
  const showLine = (i) => { cd.ls[i].element.style.visibility = ''; };
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const sx = (i) => -5.4 + i * 1.2;
  for (let i = 0; i < 10; i++) { cube('', GRAY, [1.05, 0.1, 1.2], sx(i), 0.05, 0.8); tag(String(i), 'idx', sx(i), 0, 1.8); }
  const PX = [-4.6, 0, 4.6], PY = 3.4, PZ = -1.6;
  const cur = pkt(' ', 0, 2.0, 0.8);
  cur.element.style.visibility = 'hidden';
  let ap = null;
  await step(tok); // @c 8785.8 一個函式：key → small integer
  tag('key', 'idx', PX[0], PY, PZ); tag('small integer', 'idx', PX[2], PY, PZ);
  const a0 = arrow(V3(PX[0] + 0.8, PY, PZ), V3(PX[2] - 1.2, PY, PZ));
  say('用一個函式：從 key 算出 small integer', '');
  await step(tok); // @c 8803.9 其實兩步
  kill(a0);
  tag('integer', 'idx', PX[1], PY, PZ);
  arrow(V3(PX[0] + 0.8, PY, PZ), V3(PX[1] - 0.9, PY, PZ)); arrow(V3(PX[1] + 0.9, PY, PZ), V3(PX[2] - 1.2, PY, PZ));
  say('中間其實有兩步', 'key → integer → small integer');
  await step(tok); // @c 8814.4 叫 h
  showLine(0); cd.hl(0);
  say('這個函式通常叫 h', '');
  await step(tok); // @c 8824.8 hash code
  tag('hash code', 'ptr alt', (PX[0] + PX[1]) / 2, PY + 0.6, PZ);
  say('第一步 key → integer：叫 hash code', '依 key 的內容算出一個數字');
  await step(tok); // @c 8852.8 compress
  tag('compress', 'ptr alt', (PX[1] + PX[2]) / 2, PY + 0.6, PZ);
  say('第二步 integer → small integer：compress', '');
  await step(tok); // @c 8875.8 insert A[h(key)] = value
  showLine(1); cd.hl(1);
  cur.element.style.visibility = ''; cur.position.set(sx(0), 2.0, 0.8); txt(cur, 'h = 0');
  ap = cube('apple', '#e55a9b', [1.0, 0.6, 0.9], sx(0), 0.4, 0.8, 2.5);
  say('insert：算出 h(key)，把 value 放進 A[h(key)]', 'apple：530 mod 10 = 0');
  await step(tok); // @c 8901.5 get
  showLine(2); cd.hl(2);
  glow(ap, GREEN);
  say('get：v = A[h(key)]', '再算一次 h，直接打開櫃子');
  await step(tok); // @c 8936.8 bucket array
  glow(ap, null);
  tag('bucket array A（示意 10 格）', 'ptr', 0, 0, 2.8);
  say('放東西的櫃子 A 叫 bucket array', 'bucket = 一桶一桶');
  await step(tok); // @c 8959.8 很多 value 共用一櫃
  cd.hl(1);
  cur.position.set(sx(2), 2.6, 0.8); txt(cur, 'h = 2');
  cube('act', '#4b9ee2', [1.0, 0.6, 0.9], sx(2), 0.4, 0.8, 2.5);
  await beat(tok, 500);
  const ct = cube('cat', '#9b7ef4', [1.0, 0.6, 0.9], sx(2), 1.05, 0.8, 2.5);
  glow(ct, RED);
  say('好幾個 value 可能塞進同一個櫃子', 'act、cat 加總都是 312 → 都到 A[2]');
  await step(tok); // @c 8967.8 h = hash function
  say('h 決定這個 key 用哪個櫃子', 'h 就叫 hash function');
}]);

// 150:02 perfect hashing、鴿籠原理、collision
FRAG.push(['hashlin1-pigeonhole', 'Perfect hashing 與鴿籠原理', async (tok) => {
  fresh([0, 6, 11], [0, 1.2, 0]);
  const cx = (i) => -2.4 + i * 2.4;
  const pig = [];
  await step(tok); // @c 9002.9 100 key 一對一 100 格
  for (let i = 0; i < 5; i++) { cube('', GRAY, [1.05, 0.1, 1.1], -3.2 + i * 1.6, 0.05, -2.2); tag(String(i), 'idx', -3.2 + i * 1.6, 0, -1.3); }
  for (let i = 0; i < 5; i++) { cube('k' + hlSub(i), hlOrd(i), [0.8, 0.6, 0.8], -3.2 + ((i * 3) % 5) * 1.6, 0.4, -2.2, 2.5); await beat(tok, 300); }
  say('最完美：100 個 key 一對一對到 100 格', '示意：5 個 key ↔ 5 格');
  await step(tok); // @c 9061.8 perfect hashing
  good('perfect hashing', 0, 2.2, -2.2);
  say('這叫 perfect hashing', '');
  await step(tok); // @c 9068.8 不會有空櫃子
  say('沒有空櫃子沒人用', '不必開 200 格只用 50 格');
  await step(tok); // @c 9088.8 key 比 K 多
  for (let i = 5; i < 7; i++) { const m = cube('k' + hlSub(i), hlOrd(i), [0.8, 0.6, 0.8], 5.0 + (i - 5) * 1.0, 0.4, -2.2, 2.5); glow(m, RED); await beat(tok, 300); }
  say('大部分時候：key 比櫃子數 K 多', '多出來的放哪？');
  await step(tok); // @c 9118.7 0～1 萬 vs 100 格
  note('key：0～10000，櫃子：只有 100 個', 0, 3.0, -2.2);
  say('例：key 範圍 0～1 萬，只有 100 個櫃子', '做不到 perfect hashing');
  await step(tok); // @c 9144.3 某兩個 key h 值一樣
  say('不管用哪個 h', '一定有兩個 key 算出一樣的 h 值');
  await step(tok); // @c 9155.4 鴿籠原理
  for (let i = 0; i < 3; i++) { cube('', '#c9b48a', [2.0, 0.1, 1.4], cx(i), 0.05, 2.0); tag('籠 ' + (i + 1), 'idx', cx(i), 0, 3.0); }
  const cnt = [0, 0, 0];
  for (let i = 0; i < 5; i++) { const c = i % 3; pig.push(buddy('鴿' + (i + 1), '', '#e5e0d5', cx(c) + (cnt[c] ? 0.5 : -0.5), 0.05, 2.0, 0.55)); cnt[c]++; await beat(tok, 300); }
  pig[3].mood('wow'); pig[0].mood('wow'); pig[4].mood('wow'); pig[1].mood('wow');
  say('鴿籠原理：3 個籠子、5 隻鴿子', '至少兩隻擠同一籠');
  await step(tok); // @c 9171.8 4 隻也一樣
  kill(pig[4].g); pig[1].mood('calm');
  say('只有 4 隻也一樣', '至少兩隻擠在同一籠');
  await step(tok); // @c 9202.8 collision
  bad('collision：h(k₁) = h(k₂)，但 k₁ ≠ k₂', 0, 1.7, 3.6);
  say('兩個 key 擠到同一個櫃子', '= collision（撞在一起）');
  await step(tok); // @c 9235.8 兩個難題
  note('難題一：找好的 hash function', -3.2, 3.8, -2.2); note('難題二：處理 collision', 3.2, 3.8, -2.2);
  say('hash 的難點：好的 hash function', '＋ 處理 collision');
  await step(tok); // @c 9247.8 任何 h 都可能撞
  say('就算 h 很好，還是可能 collision', 'key 一多，數學上躲不掉');
}]);

// 154:59 string 的 hash code：第一個字母 vs 全部加總、mod 100
FRAG.push(['hashlin1-string-hash', 'String 的 hash code：apple 與 act', async (tok) => {
  fresh([0, 6, 11], [0, 1.0, 0]);
  const sx = (i) => -6 + i * 0.48;
  let act = null;
  await step(tok); // @c 9304.8 string → 數字
  say('key 是 string：怎麼變成一個數字？', '先不管比大小');
  await step(tok); // @c 9338.8 apple
  const w = tag('apple', 'pkt', -2.0, 3.4, -1.0);
  say('例如 string "apple"', '');
  await step(tok); // @c 9349.5 看第一個 character
  bub('只看第一個字：string[0] = a', 0.8, 3.4, -1.0);
  say('只看第一個 character', 'string[0]');
  await step(tok); // @c 9364.8 26 個字母 → 0～25
  for (let i = 0; i < 26; i++) { cube('', GRAY, [0.42, 0.1, 1.1], sx(i), 0.05, 0); tag('abcdefghijklmnopqrstuvwxyz'[i], 'idx', sx(i), 0, 0.9); }
  tag('26 格 array', 'ptr', 0, 0, 2.0);
  say('只有 26 個英文字母', 'hashcode = 0～25');
  await step(tok); // @c 9398.8 apple → [0]
  await travel(tok, w, V3(-2.0, 3.4, -1.0), V3(sx(0) + 0.9, 0.6, -1.2), 700);
  cube('apple', '#e55a9b', [0.45, 0.55, 0.9], sx(0), 0.35, 0, 2.5);
  say('apple → a → 放進 [0]', '');
  await step(tok); // @c 9410.2 act 也到 [0]
  act = cube('act', '#4b9ee2', [0.45, 0.55, 0.9], sx(0), 0.95, 0, 2.5);
  tag('act', 'pkt', sx(0) + 0.9, 1.3, -1.2);
  glow(act, RED);
  say('act 也是 a 開頭 → 也到 [0]', '');
  await step(tok); // @c 9424.8 collision
  bad('collision：apple、act 共用 [0]', -3.0, 2.2, 0);
  say('很多 key 擠少數格子 → 總會共用一格', '這就是 collision');
  await step(tok); // @c 9458.8 用上所有字？
  glow(act, null);
  say('只用一個字：簡單但太粗糙', '能不能把每個字都用上？');
  await step(tok); // @c 9476.8 每個字加起來
  note('apple：97+112+112+108+101 = 530', -2.6, 4.6, -2.2); note('act：97+99+116 = 312', 2.8, 4.6, -2.2);
  say('把每個字的字元碼通通加起來', '');
  await step(tok); // @c 9506.8 範圍太大
  say('加起來可能超級大', '範圍太大 → 要 compress');
  await step(tok); // @c 9532.8 mod 100
  good('530 mod 100 = 30', -2.6, 3.8, -2.2); good('312 mod 100 = 12', 2.8, 3.8, -2.2);
  say('只有 100 格：mod 100', '得到 0～99 之間的數字');
  await step(tok); // @c 9552.8 不一定要這樣算
  say('不一定要這樣算、這樣 compress', '只是示範 hash code ＋ compress');
}]);

// 160:12 壞的 hash function：永遠回傳 0；好的要分散用滿 k 格
FRAG.push(['hashlin1-bad-hash', '壞 hash：什麼都回傳 0', async (tok) => {
  fresh([0, 6.2, 11.5], [0, 1.8, 0]);
  const sx = (i) => -4.9 + i * 1.4, slots = [];
  for (let i = 0; i < 8; i++) { slots.push(cube('', GRAY, [1.2, 0.1, 1.2], sx(i), 0.05, 0)); tag(String(i), 'idx', sx(i), 0, 1.0); }
  const L = 'ABCDEFGH', ms = [];
  let h = null, quote = null;
  await step(tok); // @c 9611.8 最難的是 collision
  say('hash 最困難的問題：collision', '撞在一起');
  await step(tok); // @c 9622.8 兩部分
  say('兩件事：撞了怎麼解決？', '能不能一開始就少撞一點？');
  await step(tok); // @c 9628.8 永遠回傳 0
  h = buddy('h', '0', '#f4a56a', 5.8, 0, 2.6, 0.8);
  say('壞例子：不管什麼 key 都回傳 0', 'h(key) = 0');
  await step(tok); // @c 9641.8 記者問什麼都同一句
  quote = bub('不管問什麼：都回答「0」', 5.4, 2.2, 2.6);
  h.mood('happy');
  say('就像不管問什麼，都只回同一句', '');
  await step(tok); // @c 9652.8 通通串在 0
  kill(quote);
  for (let i = 0; i < 8; i++) { ms.push(cube(L[i], hlOrd(i), [0.8, 0.62, 0.8], sx(0), 0.36 + i * 0.66, 0, 2.5)); await beat(tok, 250); }
  say('資料通通擠在 [0]', '');
  await step(tok); // @c 9661.8 其他格沒人用
  for (let i = 1; i < 8; i++) glow(slots[i], RED);
  h.mood('sad');
  say('其他格都沒人用', '一直在 [0] 處理 collision');
  await step(tok); // @c 9675.8 分散一點
  slots.forEach((s) => glow(s, null));
  const to = [3, 0, 6, 1, 7, 4, 2, 5];
  for (let i = 0; i < 8; i++) { move(ms[i], sx(to[i]), 0.36, 0); await beat(tok, 250); }
  h.set('分散'); h.mood('happy');
  say('希望 h 分散一點：k 格都用到', '撞在一起的機會變少');
  await step(tok); // @c 9693.8 空間最平均
  good('空間用得最平均', 0, 2.0, 0);
  say('空間也用得最平均', '');
  await step(tok); // @c 9728.8 hash table 要處理 collision
  say('hash table：設計好 h ＋ 處理 collision', '下一次的重點');
}]);

// 164:40 array of pointers：櫃子放小紙條指向 linked list
FRAG.push(['hashlin1-chain-preview', '櫃子放小紙條：linked list 接住 collision', async (tok) => {
  fresh([0, 6.4, 11], [0, 0.6, 0]);
  const sx = (i) => -4.4 + i * 2.2, sz = -2.8;
  for (let i = 0; i < 5; i++) { cube('', GRAY, [1.8, 0.1, 1.2], sx(i), 0.05, sz); tag(String(i), 'idx', sx(i), 0, sz - 1.0); }
  const len = [0, 0, 0, 0, 0];
  const add = async (w, b) => {
    const z = -1.3 + len[b] * 1.6;
    const prevZ = len[b] ? z - 1.6 : sz;
    arrow(V3(sx(b), 0.4, prevZ + 0.6), V3(sx(b), 0.4, z - 0.55));
    const g = lnode(w, sx(b), 3.0, z, hlOrd(len[b] + b)); len[b]++;
    await anim(tok, 500, (t) => { g.position.y = 3.0 - 2.65 * t; });
  };
  let ap = null, ac = null, paper = null;
  await step(tok); // @c 9879.8 同學：array of pointers
  bub('同學：用 array of pointers 處理 collision？', 0, 2.8, sz);
  say('同學提議：array of pointers', '能不能處理 collision？');
  await step(tok); // @c 9896.8 不放 key，放小紙條
  paper = prop('note', sx(0), 0.12, sz, 1.4); bob(paper, 0.04);
  say('array 裡不放 key，放一張小紙條', '');
  await step(tok); // @c 9903.8 兩筆要放同一格
  ap = cube('apple', '#e55a9b', [1.3, 0.6, 0.9], sx(0) - 0.7, 1.6, sz, 2.5);
  ac = cube('act', '#4b9ee2', [1.3, 0.6, 0.9], sx(0) + 0.7, 1.6, sz, 2.5); glow(ac, RED);
  say('兩筆不同的資料要放同一格', '櫃子得放得下兩張紙條');
  await step(tok); // @c 9919.8 櫃子固定大小
  bad('array 的櫃子：大小固定', 3.0, 1.6, sz);
  say('可是 array 的櫃子大小是固定的', '');
  await step(tok); // @c 9952.8 要變動大小
  say('collision 時，櫃子好像得能變大小', '');
  await step(tok); // @c 9959.8 放 pointer
  kill(ap); kill(ac);
  say('櫃子裡放一個 pointer（一張小紙條）', '');
  await step(tok); // @c 9964.8 指到 linked list
  await add('apple', 0); await add('act', 0); await add('bat', 1);
  say('小紙條指到一條 linked list', 'linked list 很容易變長');
  await step(tok); // @c 9984.8 丟掉也是一種
  note('撞了就丟掉：也算一種處理（不一定好）', -1.2, 3.4, sz);
  say('就算決定把東西丟掉', '也是一種 collision handling');
  await step(tok); // @c 10008.8 vector 長大
  note('或像 vector：array 動態長大', 2.4, 4.1, sz);
  say('或像 vector 一樣讓 array 動態長大', '');
  await step(tok); // @c 10029.8 下次講
  say('好的 hash function 也會 collision', 'collision handling 一定要有 → 下次講');
}]);
  }

  // ═══ hashlin2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, arrow, ghostBox, GOLD, GREEN, RED, GRAY, step, buddy, prop, bob, travel, remove, zone } = K;
// ─── WX-z52QweUs（台大林軒田 DSA：Hash Table — hash code、compress、collision handling、open addressing、extendable hash table） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows (cues in notes/WX-z52QweUs.json);
// the beats in between are only the motion of that step.
const C8 = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const SUB = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const kc = (k) => C8[(typeof k === 'number' ? k : [...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0)) % 8];
// friendly labels: speech bubble, sticky note, travelling packet, good / bad stamp
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const nt = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pk = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// slide a label / prop / buddy group to (x, y, z)
const go = (tok, o, x, y, z, ms = 800) => travel(tok, o, o.position.clone(), V3(x, y, z), ms);
// a key as a little character
const kid = (name, color, x, z, s = 0.6, v = '') => buddy(name, v, color, x, 0, z, s);
// a row of m slots centred on x = 0 at depth z; idx tags at z + idxDz
function hlRow(m, dx, z, labels, idxDz = 0.95) {
  const x0 = -(m - 1) * dx / 2, xs = [], slots = [], idx = [];
  for (let i = 0; i < m; i++) {
    const x = x0 + i * dx; xs.push(x);
    slots.push(cube('', GRAY, [dx * 0.9, 0.12, 1.1], x, 0.06, z));
    idx.push(tag(labels ? labels[i] : String(i), 'idx', x, 0, z + idxDz));
  }
  return { m, dx, z, xs, slots, idx, keys: new Array(m).fill(null), vals: new Array(m).fill(null), ch: Array.from({ length: m }, () => []), cw: Math.min(1.4, dx * 0.85) };
}
function hlPut(T, i, v, color, drop) { const c = cube(v, color || kc(v), [Math.min(0.95, T.dx * 0.8), 0.7, 0.9], T.xs[i], 0.47, T.z, drop ? 3 : 0); T.keys[i] = c; T.vals[i] = v; return c; }
// chain node j of bucket i (chains grow toward the camera)
const cpos = (T, i, j) => [T.xs[i], 0.36, T.z + 1.05 + j * 0.85];
function hlChain(T, i, v, color, drop) { const [x, y, z] = cpos(T, i, T.ch[i].length); const c = cube(v, color || kc(v), [T.cw, 0.6, 0.65], x, y, z, drop ? 3 : 0); c.userData.v = v; T.ch[i].push(c); return c; }
function hlRelayout(T, i) { T.ch[i].forEach((c, j) => { const [x, y, z] = cpos(T, i, j); move(c, x, y, z); }); }
// move chain node c (already taken out of its old chain) to the end of bucket i of table U
function hlMoveTo(U, i, c) { U.ch[i].push(c); const [x, y, z] = cpos(U, i, U.ch[i].length - 1); move(c, x, y, z); }
function hlTake(T, i, v) { const j = T.ch[i].findIndex((c) => c.userData.v === v); const c = T.ch[i].splice(j, 1)[0]; hlRelayout(T, i); return c; }
// walk the probe cursor along a sequence of slots (short hops); occupied slots flash red
async function hlProbe(tok, T, cur, seq, ms = 420) {
  for (let i = 0; i < seq.length; i++) {
    const j = seq[i];
    await go(tok, cur, T.xs[j], 1.8, T.z, ms); txt(cur, 'h' + SUB(i));
    if (T.keys[j]) { glow(T.keys[j], RED); await beat(tok, 200); glow(T.keys[j], null); }
  }
}
// a labelled translucent "machine" box
function hlBox(label, color, x, z, w = 2.2) { const b = ghostBox(color, w, 1.3, 1.5); b.position.set(x, 0.65, z); tag(label, 'ptr', x, 1.8, z); return b; }

// ════════ WX-z52QweUs（林軒田 Hash Table） ════════
// 20:58 回顧 map：key → value；key 不需 order、可長可短
FRAG.push(['hashlin2-map', 'Map：key 不需 order、可長可短', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.2]);
  say('回顧：上次開始講的 Map');
  await step(tok);                                   // 21:00 用某個 key 代表未來要找的東西
  const k = kid('key', C8[0], -4.6, -2.6, 0.75, '密碼');
  bub('key：像置物櫃的密碼', -4.6, 2.0, -2.6);
  say('用一個 key 代表你要找的東西');
  await step(tok);                                   // 21:15 透過 key 找到相對應的 data
  const v = prop('parcel', 4.6, 0, -2.6, 1.0, 'value（資料）'); bob(v, 0.05);
  arrow(V3(-3.8, 0.5, -2.6), V3(3.9, 0.5, -2.6), 0xa8730f);
  const p = pk('照 key 找 →', -3.6, 1.2, -2.6);
  await go(tok, p, 3.4, 1.2, -2.6, 1400); remove(p); k.mood('happy');
  say('透過 key 找到對應的 data（叫 value）');
  await step(tok);                                   // 21:26 儲存 key ↔ value 關係 = map
  tag('map：key → value', 'ptr', 0, 1.5, -2.6);
  say('存 key 與 value 關係的結構 = map');
  await step(tok);                                   // 22:21 key 不需要 order
  const W = [['a', 0.9], ['hash', 1.6], ['dictionary', 2.8]];
  const ks = W.map(([w, len], r) => cube(w, C8[r + 1], [len, 0.6, 0.8], -3.6, 0.3, 0 + r * 1.5, 3));
  no('不比大小', -6.2, 1.0, 1.4);
  say('key 不需要 order', '只問：是不是同一個 key');
  await step(tok);                                   // 22:34 variable length
  ks.forEach((c) => glow(c, GOLD));
  nt('32 bit 整數：位數固定', 0.6, 0.4, 3.9);
  say('key 可長可短：variable length', '不像整數有固定的位數');
  await step(tok);                                   // 23:03 英文字典
  ks.forEach((c) => glow(c, null));
  ['一個', '雜湊', '字典'].forEach((s, r) => cube(s, C8[r + 4], [1.4, 0.6, 0.8], 4.0, 0.3, r * 1.5, 3));
  W.forEach(([, len], r) => arrow(V3(-3.5 + len / 2, 0.35, r * 1.5), V3(3.2, 0.35, r * 1.5)));
  say('像英文字典：單字 → 解釋', 'key = 單字、value = 解釋');
  await step(tok);                                   // 23:17 Hash table
  bub('Hash table 就是這種 map', 0, 2.6, 1.5);
  k.mood('wow'); await k.hop(tok);
  say('今天的主角：Hash table');
}]);

// 23:26 key → small integer（hash code）→ array index → value
FRAG.push(['hashlin2-pipeline', 'Key → 小整數 → array index', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.2]);
  hlBox('轉成 integer', '#4b9ee2', -1.6, -2.8);
  const k = kid('"hash"', C8[1], -5.4, -2.8, 0.6);
  await step(tok);                                   // 23:27 把 key 轉成 integer
  await go(tok, k.g, -1.6, 0, -2.8, 900); remove(k.g);
  const n = cube('1126', C8[6], [1.2, 0.6, 0.8], -1.6, 0.4, -2.8); move(n, 2.4, 0.35, -2.8);
  say('把 key 轉成 integer');
  await step(tok);                                   // 23:42 用 array 做 integer → value
  bub('array 本來就會：integer → value', 4.6, 1.4, -2.8);
  say('有了 integer，就能用 array 做 integer → value');
  await step(tok);                                   // 24:02 而且要 small integer
  nt('要「小」！', 2.4, 1.3, -2.0);
  say('而且要轉成 small integer');
  await step(tok);                                   // 24:10 超級大的 integer：array 放不下
  const big = cube('98237461928374…', RED, [3.6, 0.6, 0.8], 0, 0.3, -0.6, 3);
  no('array 大到放不下', 0, 1.2, -0.6);
  say('integer 超級大的話', 'array 會大到根本放不下');
  await step(tok);                                   // 24:28 1 到 1 萬 → 開 10000 格
  kill(big);
  const T = hlRow(8, 1.45, 1.4, ['0', '1', '2', '…', '1126', '…', '9998', '9999']);
  say('integer 在 0～9999 → 開大小 10000 的 array');
  await step(tok);                                   // 24:40 0～5566 → 5567 格
  txt(T.idx[6], '5565'); txt(T.idx[7], '5566');
  say('integer 在 0～5566 → 開 5567 格就好', 'small range 才放得進 array');
  await step(tok);                                   // 24:55 integer 當 array 的 index，放 value
  move(n, T.xs[4], 0.42, T.z); glow(T.slots[4], GOLD);
  const v = prop('parcel', T.xs[4], 0.8, T.z, 0.6); bob(v, 0.04);
  say('用這個 integer 當 array 的 index', '那一格放進 value');
  await step(tok);                                   // 25:13 這個 integer 叫 hash code
  tag('hash code', 'ptr alt', T.xs[4], 2.2, T.z);
  say('這個 integer 叫 hash code');
  await step(tok);                                   // 25:22 整套動作 = Hash Table
  bub('key → hash code → index → value', 0, 2.8, -0.6);
  say('這一整套動作叫 Hash Table');
  await step(tok);                                   // 25:33 array 的延伸
  say('看成 array 的延伸：拿 array 來做 map');
  await step(tok);                                   // 26:04 第一件事：怎麼產生 hash code
  nt('問題 1：hash code 怎麼算？', -4.2, 1.6, -1.4);
  say('第一件事：hash code 要怎麼產生？');
  await step(tok);                                   // 26:13 第二件事：好多東西佔同一格
  const o = cube('另一個', C8[4], [0.9, 0.5, 0.8], T.xs[4], 2.4, T.z + 1.1, 3);
  glow(o, RED);
  nt('問題 2：好多東西擠同一格？', 4.4, 1.6, 3.2);
  say('第二件事：好多東西要佔同一格怎麼辦？');
}]);

// 26:30 h 拆兩步：hash code（可以很大）＋ compress（取餘數）
FRAG.push(['hashlin2-two-step', 'h = compress(hashcode(key))', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  hlBox('hash code', '#4b9ee2', -2.4, -2.6);
  const k = cube('"ABC"', C8[0], [1.2, 0.6, 0.8], -5.8, 0.3, -2.6);
  await step(tok);                                   // 26:30 key → integer 叫 hash code
  say('從 key 算出 integer：叫 hash code');
  await step(tok);                                   // 26:44 h 拆成兩步
  hlBox('compress', '#dd8238', 2.4, -2.6);
  tag('h(key) = compress(hashcode(key))', 'ptr alt', 0, 2.8, -2.6);
  say('整個 h 通常拆成兩步');
  await step(tok);                                   // 26:59 先算出一個整數，不必小
  move(k, -2.4, 0.4, -2.6); await beat(tok, 700);
  kill(k); const big = cube('18273', C8[6], [1.3, 0.6, 0.8], -2.4, 0.4, -2.6); move(big, 0, 0.35, -2.6);
  say('第一步：先算出一個整數', '這個整數不必小');
  await step(tok);                                   // 27:13 壓縮到夠小的範圍
  move(big, 2.4, 0.4, -2.6);
  say('第二步：把它壓縮到夠小的範圍');
  await step(tok);                                   // 27:27 限制在 0～99
  const T = hlRow(8, 1.45, 1.6, ['0', '1', '2', '…', '73', '…', '98', '99']);
  say('例如要限制在 0～99');
  await step(tok);                                   // 27:35 除法取餘數
  kill(big); const sm = cube('73', C8[2], [0.9, 0.6, 0.8], 2.4, 0.4, -2.6); move(sm, T.xs[4], 0.42, T.z); glow(T.slots[4], GOLD);
  nt('18273 ÷ 100 = 182 餘 73', 4.6, 1.2, -0.6);
  say('最簡單：除法取餘數', '18273 mod 100 = 73');
  await step(tok);                                   // 27:45 一般：0～k−1
  tag('compress(x) = x mod k → 0～k−1', 'ptr', 0, 1.6, 3.4);
  say('一般寫法：x mod k，落在 0～k−1');
  await step(tok);                                   // 28:02 複雜的計算塞進 hash code
  bub('複雜的都放這裡', -2.4, 2.8, -2.6);
  say('比較複雜的方法：等於把計算塞進 hash code');
  await step(tok);                                   // 28:14 真正 compress 的只有 division
  bub('這裡只要 division（除數取質數）', 2.4, 2.8, -2.6);
  say('老師：compress 只要 division 這一步', '課本還有 mid-square、folding 等；mod 的除數最好取質數');
}]);

// 28:45 Summation hash code：ABC 與 ACB 一樣
FRAG.push(['hashlin2-sum', 'Summation：ABC 與 ACB 撞在一起', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const L = (w, z) => [...w].map((ch, i) => cube(ch, C8[ch.charCodeAt(0) % 8], [0.8, 0.6, 0.8], -4.6 + i * 1.3, 0.3, z, 3));
  await step(tok);                                   // 28:45 summation
  tag('Σ summation', 'ptr', -6.0, 1.4, -2.6);
  say('第一種 hash code：summation（加總）');
  await step(tok);                                   // 28:55 key 的每一個位置
  L('ABC', -1.8);
  say('看 key 的每一個位置');
  await step(tok);                                   // 29:10 每個位置是字元碼
  [65, 66, 67].forEach((n, i) => tag(String(n), 'idx', -4.6 + i * 1.3, 1.1, -1.8));
  say('每個字元換成數字（ASCII 碼）', 'A = 65、B = 66、C = 67');
  await step(tok);                                   // 29:18 加起來
  const p = pk('65 + 66 + 67', -3.3, 1.5, -1.8);
  await go(tok, p, 1.6, 1.5, -1.8, 900); remove(p);
  const r1 = cube('198', C8[6], [1.2, 0.6, 0.8], 3.6, 0.3, -1.8, 3);
  say('加起來：65 + 66 + 67 = 198');
  await step(tok);                                   // 29:31 對位置變換不敏感
  L('ACB', 1.2);
  say('缺點：對「位置的變換」不敏感');
  await step(tok);                                   // 29:38 ABC 與 ACB 同樣的 hash
  const r2 = cube('198', C8[6], [1.2, 0.6, 0.8], 3.6, 0.3, 1.2, 3);
  glow(r1, RED); glow(r2, RED); no('一樣！', 5.4, 1.0, -0.3);
  say('ABC 跟 ACB 得到同樣的 hash', '65 + 67 + 66 = 198');
  await step(tok);                                   // 29:54 沒有一定好或不好
  bub('不一定好，也不一定壞', 0, 2.6, -0.3);
  say('這沒有一定好、或一定不好');
  await step(tok);                                   // 30:11 好處：算起來很快
  ok('算起來很快 ✓', -4.6, 1.2, 3.2);
  say('好處：算起來簡單又快');
  await step(tok);                                   // 30:19 打錯的字
  const f1 = cube('form', C8[3], [1.3, 0.6, 0.8], 1.0, 0.3, 3.4, 3), f2 = cube('from', C8[5], [1.3, 0.6, 0.8], 3.6, 0.3, 3.4, 3);
  say('可是應用裡常有打錯的字', '手指一滑：form ↔ from，只差位置');
  await step(tok);                                   // 30:42 這些字常常撞在一起
  glow(f1, RED); glow(f2, RED);
  say('用 sum 時，這些字常撞在一起', '就要一直處理撞在一起的情況');
  await step(tok);                                   // 31:04 先用別的算法分開
  [f1, f2].forEach((c, i) => move(c, -1.0 + i * 5.0, 0.3, 3.4));
  say('能不能換個 hash code 算法，先把它們分開？');
}]);

// 31:24 Polynomial hash code：第 i 個位置乘 16^i；乘 16 = 左移 4 bit
FRAG.push(['hashlin2-poly', 'Polynomial hash code：Σ key[i]·16ⁱ', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  const rows = [['A', 'B', 'C'], ['A', 'C', 'B']];
  rows.forEach((w, r) => w.forEach((ch, i) => cube(ch, C8[ch.charCodeAt(0) % 8], [0.8, 0.6, 0.8], -4.8 + i * 1.6, 0.3, -2.4 + r * 2.6)));
  let mul = [];
  await step(tok);                                   // 31:24 乘上 16 的 i 次方
  mul = [0, 1, 2].map((i) => tag('×16' + ['⁰', '¹', '²'][i], 'ptr alt', -4.8 + i * 1.6, 1.3, -3.4));
  say('每個位置再乘上 16 的 i 次方');
  await step(tok);                                   // 31:36 第 0、1、2 個位置
  arrow(V3(-0.9, 0.4, -2.4), V3(2.6, 0.4, -2.4));
  const r1 = cube('18273', C8[6], [1.4, 0.6, 0.8], 3.6, 0.3, -2.4, 3);
  say('"ABC" = 65·1 + 66·16 + 67·256', '= 65 + 1056 + 17152 = 18273');
  await step(tok);                                   // 31:47 B、C 在不同位置乘不同次方
  arrow(V3(-0.9, 0.4, 0.2), V3(2.6, 0.4, 0.2));
  const r2 = cube('18033', C8[2], [1.4, 0.6, 0.8], 3.6, 0.3, 0.2, 3);
  say('"ACB" = 65·1 + 67·16 + 66·256', '= 65 + 1072 + 16896 = 18033');
  await step(tok);                                   // 31:55 不會得到同樣的 hash code
  glow(r1, GREEN); glow(r2, GREEN); ok('分開了 ✓', 5.6, 1.1, -1.1);
  say('B、C 換位置，hash code 就不同', '18273 ≠ 18033');
  await step(tok);                                   // 31:59 compress 完搞不好還是撞
  nt('compress 之後還是可能撞', 3.6, 1.0, 2.0);
  say('不保證最後不撞：compress 後可能又撞', '但至少 hash code 這一步分開了');
  await step(tok);                                   // 32:15 不一定 16，任意 a
  glow(r1, null); glow(r2, null);
  mul.forEach((l, i) => txt(l, '×a' + ['⁰', '¹', '²'][i]));
  say('16 可以換成任意你喜歡的 a', '例如 5、9');
  await step(tok);                                   // 32:28 統稱 Polynomial hash code
  tag('Polynomial hash code', 'ptr', 0, 2.6, -0.9);
  say('這類方法統稱 Polynomial hash code');
  await step(tok);                                   // 32:41 key 當多項式係數
  tag('key[0] + key[1]·a + key[2]·a² + …', 'ptr alt', 0, 0.6, 2.6);
  say('把 key[i] 當多項式的係數，代 a 進去算');
  await step(tok);                                   // 33:05 可以靠 shift
  say('特地選 16：因為可以靠 shift 來算');
  await step(tok);                                   // 33:17 乘 16 = 往左移 4 bit
  const cd = code(['66      = 0000 0100 0010', '66 << 4 = 0100 0010 0000 = 1056'], 0, 1.4, 0.5, 4.0);
  cd.hl(1);
  say('乘 16 = 把 bit 往左移 4 格', 'x·16 = x << 4');
  await step(tok);                                   // 33:23 乘 8 = 左移 3 bit
  nt('×8 = 左移 3 bit', 5.2, 0.6, 4.0);
  say('乘 8 就是左移 3 個 bit', 'bit 運算算得更快');
  await step(tok);                                   // 33:52 sum、polynomial 兩個基本款
  bub('sum、polynomial：兩個基本款', 0, 3.4, -2.4);
  say('sum 和 polynomial：兩個非常基本的款式');
}]);

// 34:12 Cyclic shift：左移時超出的 bit 補回右邊
FRAG.push(['hashlin2-cyclic', 'Cyclic shift：移出去的 bit 補回來', async (tok) => {
  fresh([0, 7, 11], [0, 0.6, 0]);
  const B = '10110011', bx = (i) => -2.8 + i * 0.8;
  const mk = (z) => [...B].map((b, i) => cube(b, b === '1' ? C8[0] : GRAY, [0.7, 0.6, 0.7], bx(i), 0.3, z, 3));
  let s = null, c = null;
  await step(tok);                                   // 34:12 第三個版本 cyclic shift
  tag('cyclic shift', 'ptr', 0, 2.4, -3.4);
  say('課本給的第三種：cyclic shift');
  await step(tok);                                   // 34:22 shift：往左移、加上去
  tag('shift', 'ptr', -5.4, 0.9, -1.8);
  s = mk(-1.8);
  say('原本的 shift：往左移、加上去、再往左移…', '這裡用 8 bit 示意（實際常是 32 bit）');
  await step(tok);                                   // 34:30 往左移有些 bit 超出 32 bit
  [0, 1, 2, 3].forEach((i) => glow(s[i], GOLD));
  say('往左移時，有些 bit 會超出範圍');
  await step(tok);                                   // 34:37 超出的補回低位
  tag('cyclic', 'ptr alt', -5.4, 0.9, 1.8);
  c = mk(1.8); [0, 1, 2, 3].forEach((i) => glow(c[i], GOLD));
  say('cyclic：把超出的部分補回比較低的位數');
  await step(tok);                                   // 34:47 例：往左移 4 個 bit
  nt('往左移 4 bit', 4.6, 1.0, -1.8);
  say('例子：往左移 4 個 bit');
  await step(tok);                                   // 34:56 往左移以後
  [0, 1, 2, 3].forEach((i) => fly(s[i], V3(-6, 4, -1)));
  [4, 5, 6, 7].forEach((i) => move(s[i], bx(i - 4), 0.3, -1.8));
  say('shift：移出去的 4 個 bit 直接丟掉');
  await step(tok);                                   // 35:10 後面直接補 0
  [4, 5, 6, 7].forEach((i) => cube('0', GRAY, [0.7, 0.6, 0.7], bx(i), 0.3, -1.8, 2));
  say('右邊直接補 0，再加上新的數字', '10110011 → 00110000');
  await step(tok);                                   // 35:19 cyclic：補回來
  [4, 5, 6, 7].forEach((i) => move(c[i], bx(i - 4), 0.3, 1.8));
  [0, 1, 2, 3].forEach((i) => move(c[i], bx(i + 4), 1.3, 1.8));
  await beat(tok, 800);
  [0, 1, 2, 3].forEach((i) => move(c[i], bx(i + 4), 0.3, 1.8));
  arrow(V3(bx(0), 1.4, 0.9), V3(bx(7), 1.4, 0.9), 0xc08a1f);
  say('cyclic shift：移出去的補回右邊', '10110011 → 00111011');
  await step(tok);                                   // 35:24 迴圈計算產生 hash code
  say('同樣的迴圈一直算下去 → 得到 hash code');
  await step(tok);                                   // 35:33 從簡單到複雜
  bub('sum → polynomial → cyclic：越來越複雜', 0, 2.4, 3.6);
  say('1、2、3 的順序：從簡單到複雜');
}]);

// 35:43 越複雜越難猜誰會撞；one-way：拿到 1126 推不回 key
FRAG.push(['hashlin2-oneway', '難以回推：hash code = 1126，key = ?', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const lad = ['sum', 'polynomial', 'cyclic'].map((s, i) => tag(s, 'ptr', -4.4 + i * 4.4, 1.2, -3.4));
  await step(tok);                                   // 35:43 越複雜越難看出何時一樣
  say('越複雜，就越難看出兩個 key 何時同 hash code');
  await step(tok);                                   // 35:51 sum：一眼看出
  ok('ABC = ACB，一眼看出', -4.4, 0.3, -3.4);
  say('sum：很容易說出 ABC 跟 ACB 會一樣');
  await step(tok);                                   // 35:56 polynomial：有時也猜得到
  nt('兩字對調、值差特定數字', 0, 0.3, -3.4);
  say('polynomial：有時也說得出', '例如兩個字對調、值剛好差某些數字');
  await step(tok);                                   // 36:16 cyclic：很難猜
  no('很難猜', 4.4, 0.3, -3.4);
  say('cyclic shift：運算很複雜，很難猜');
  await step(tok);                                   // 36:43 密碼學、驗證
  const lock = prop('lock', 5.6, 0, 0.4, 1.3); bob(lock, 0.05);
  say('這種性質：在密碼學、驗證上很有幫助');
  await step(tok);                                   // 36:52 一個小秘密
  hlBox('hash', '#9b7ef4', 0, 0.4, 2.0);
  const sec = kid('小秘密', C8[4], -4.6, 0.4, 0.7);
  await go(tok, sec.g, -1.0, 0, 0.4, 900); remove(sec.g);
  const h = cube('1126', C8[6], [1.2, 0.6, 0.8], 0, 0.4, 0.4); move(h, 3.2, 0.3, 0.4);
  say('拿一個小秘密，經過 hash code');
  await step(tok);                                   // 37:00 一：很難找另一個小秘密
  const q = cube('另一個?', RED, [1.4, 0.6, 0.8], -4.6, 0.3, 2.6, 3);
  arrow(V3(-3.8, 0.4, 2.6), V3(2.6, 0.4, 0.8), 0x7a1010);
  say('一：別人很難找到另一個小秘密', '算出同樣的 hash code');
  await step(tok);                                   // 37:07 二：很難回推
  arrow(V3(2.6, 0.8, 0.4), V3(-3.6, 0.8, 0.4), 0x7a1010);
  no('推不回來', -1.0, 1.9, 0.4);
  say('二：很難從 hash code 回推原來的 key');
  await step(tok);                                   // 37:33 1126 原來是什麼
  glow(h, GOLD); nt('1126 → key = ?', 3.2, 1.3, 0.4);
  say('我拿到 1126：請問原來的 key 是什麼？', '推不回來：one-way');
  await step(tok);                                   // 37:56 好的 hash code 不容易
  say('好的 hash code：難回推、又要算得快', '這是一個很深入的領域');
  await step(tok);                                   // 38:19 polynomial、cyclic 搞不好夠好
  glow(h, null); lad.slice(1).forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('你現在的應用：polynomial、cyclic 可能就夠好');
  await step(tok);                                   // 38:29 除非常常撞
  say('除非常有兩個 key 的 hash code 一樣', '那就會疲於奔命一直處理');
  await step(tok);                                   // 38:44 更進階的課程
  bub('更多性質與保證：進階課程', 0, 2.8, -1.4);
  say('更複雜、有理論保證的：進階課程會看到');
}]);

// 39:02 hash code + compression → small range integer → bucket array
FRAG.push(['hashlin2-bucket', 'Bucket array：一桶一桶', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  hlBox('hash code（sum）', '#4b9ee2', -3.2, -2.8); const mb = hlBox('mod 8', '#dd8238', 1.4, -2.8, 1.8);
  let T = null;
  const W = [['cat', 312, 0], ['dog', 314, 2], ['egg', 307, 3]];
  const placed = [];
  await step(tok);                                   // 39:02 設計 hash code function
  nt('sum／polynomial／cyclic…', -3.2, 2.5, -2.8);
  say('設計一個 hash code function');
  await step(tok);                                   // 39:13 配合 compression
  tint(mb, '#f0a050');
  say('配合一個 compression（通常就是 division）');
  await step(tok);                                   // 39:19 small range integer
  const c0 = cube('cat', kc('cat'), [1.0, 0.6, 0.8], -6.0, 0.3, -2.8);
  move(c0, -3.2, 0.45, -2.8); await beat(tok, 700);
  relabel(c0, 312); move(c0, 1.4, 0.45, -2.8); await beat(tok, 700);
  relabel(c0, 0);
  say('cat：312 mod 8 = 0', '得到 small range 的 integer：0～7');
  await step(tok);                                   // 39:23 當成 array 的 index
  T = hlRow(8, 1.45, 1.4);
  relabel(c0, 'cat'); move(c0, T.xs[0], 0.4, T.z + 1.1); placed.push(c0);
  say('這個整數拿來當 array 的 index');
  await step(tok);                                   // 39:28 Bucket Array
  tag('bucket array', 'ptr', -6.2, 0.9, 1.4);
  say('這個 array 叫 Bucket Array');
  await step(tok);                                   // 39:38 一桶一桶，往那一桶丟
  for (const [w, hc, b] of W.slice(1)) { const c = cube(w, kc(w), [1.0, 0.6, 0.8], T.xs[b], 0.4, T.z + 1.1, 3); placed.push(c); nt(hc + ' mod 8 = ' + b, T.xs[b], 1.4, T.z + 2.0); }
  say('像一桶一桶：有了 index 就往那一桶丟');
  await step(tok);                                   // 39:52 很多東西都丟同一桶？
  const g = cube('god', kc('god'), [1.0, 0.6, 0.8], T.xs[2], 0.4, T.z + 2.0, 3);
  glow(placed[1], RED); glow(g, RED);
  say('god 也是 314 → 也丟進 [2]', '很多東西共用一桶怎麼辦？下一步再說');
  await step(tok);                                   // 39:59 流程回顧
  bub('key → hash code → compress → 有限範圍的整數', 0, 2.8, -0.8);
  say('先確定這一段懂了', 'variable length 的 key → 整數 → 小範圍');
}]);

// 42:53 問：polynomial 會 overflow？→ 邊算邊 mod 2³²
FRAG.push(['hashlin2-overflow', '算 hash code 時邊算邊 mod 2³²', async (tok) => {
  fresh([0, 7, 11], [0, 0.8, -0.4]);
  const cd = code(['h = 0', 'h = (h + key[i]·16ⁱ) mod 2³²', '（每一步都留在 32 bit）'], 0, 4.6, 0.55, -3.2);
  let h = null, bigT = null;
  const feed = async (ch, v, f) => {
    const c = cube(ch, C8[ch.charCodeAt(0) % 8], [0.7, 0.6, 0.7], -5.4, 0.3, 0.6);
    move(c, -1.6, 0.4, 0.6); await beat(tok, 600); kill(c);
    h.set(v); nt(f, 3.6, 1.2 + (ch.charCodeAt(0) - 65) * 0.55, 0.6);
  };
  await step(tok);                                   // 42:53 很容易 overflow
  bigT = no('16¹⁰ = 1099511627776…', 0, 0.6, -1.4);
  say('問：polynomial 很容易 overflow？', '16ⁱ 長得非常快');
  await step(tok);                                   // 43:09 算的過程中先限縮範圍
  remove(bigT);
  h = buddy('h', '0', C8[6], 0, 0, 0.6, 0.9);
  say('好問題：其實是邊算邊限縮範圍');
  await step(tok);                                   // 43:18 保留在 32 bit integer
  const box = ghostBox('#9b7ef4', 5.6, 1.8, 2.0); box.position.set(0, 0.9, 0.6);
  tag('32-bit 整數（4 byte）', 'ptr', -2.2, 2.0, 0.6);
  say('結果一直保留在 32 bit 的 integer 裡');
  await step(tok);                                   // 43:29 乘 16ⁱ 時先 mod 2³²
  cd.hl(1);
  await feed('A', 65, '+65 → 65');
  say('每乘一次 16ⁱ，就先 mod 2³²');
  await step(tok);                                   // 43:39 一直是 4 byte 的整數
  await feed('B', 1121, '+66·16 → 1121');
  await feed('C', 18273, '+67·256 → 18273');
  h.mood('happy');
  say('一直是 4 byte 的整數 → 不會 overflow', '同學說得對');
  await step(tok);                                   // 43:50 直接算：overflow 或大數
  no('直接算到底：overflow／大數很慢', 0, 3.0, 2.6);
  say('如果直接算破：可能 overflow', '或要存一個大數，算得不 efficient');
  await step(tok);                                   // 44:02 限縮在有限但很大的範圍
  cd.hl(2);
  say('大部分實作：限縮在有限的範圍', '只是那個有限可能很大');
  await step(tok);                                   // 44:14 256 bit 的 hash code
  bub('也有人接受 256 bit 的 hash code', -3.6, 2.6, 2.6);
  say('例如接受 256 bit 的 hash code', '不是一個整數，而是一長串');
  await step(tok);                                   // 44:24 最後再 compress
  cd.hl(-1);
  say('最後再做相對應的 compress', 'index = h mod k');
}]);

// 44:34 division 後會重複嗎？會：鴿籠原理；目標是分散
FRAG.push(['hashlin2-pigeon', 'Collision 一定會發生：要的是分散', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  let T = hlRow(4, 1.8, -2.4), ks = [], U = null, bad = [];
  await step(tok);                                   // 44:35 division 會不會產生新的重複
  say('問：做完 division，會不會產生新的重複？', '會');
  await step(tok);                                   // 44:46 盡量減少
  say('希望 hash code 時不重複', 'division 時會有一些重複，但盡量少');
  await step(tok);                                   // 45:01 鴿籠原理
  for (let i = 0; i < 5; i++) {
    const b = [0, 1, 2, 3, 1][i]; const n = ks.filter((x) => x.b === b).length;
    ks.push({ b, c: cube('k' + SUB(i + 1), C8[i], [1.0, 0.6, 0.7], T.xs[b], 0.33, T.z + 1.05 + n * 0.85, 3) });
  }
  nt('100 個 key、50 格', 4.8, 1.0, -2.4);
  say('鴿籠原理：key 比格子多…', '一定有 key 要住同一格');
  await step(tok);                                   // 45:14 100 個 key、99 格
  glow(ks[1].c, RED); glow(ks[4].c, RED);
  say('100 個 key、99 格也一樣', '一定有兩隻鴿子住同一個籠子');
  await step(tok);                                   // 45:22 Collision
  tag('Collision（碰撞）', 'ptr alt', T.xs[1], 2.4, T.z + 1.4);
  say('這種重複叫碰撞：Collision');
  await step(tok);                                   // 45:31 一定會發生，只能減少
  say('Collision 通常一定會發生', '能做的：用好的 hash code 盡量減少');
  await step(tok);                                   // 45:46 平均分配到每一格
  ks.forEach((x) => kill(x.c));
  U = hlRow(8, 1.45, 1.6);
  for (let i = 0; i < 4; i++) bad.push(cube('k' + SUB(i + 1), C8[i], [1.0, 0.5, 0.7], U.xs[i * 2 + 1], 0.3, U.z, 3));
  say('好的 hash：把 key 平均分配到每一格');
  await step(tok);                                   // 46:03 很壞的 hash：全放同一格
  bad.forEach((c, i) => move(c, U.xs[0], 0.3 + i * 0.55, U.z));
  say('很壞的 hash function：通通放到 [0]', 'h(x) = 0');
  await step(tok);                                   // 46:19 在 0 碰來碰去，其他浪費
  bad.forEach((c) => glow(c, RED));
  for (let i = 1; i < 8; i++) glow(U.slots[i], GOLD);
  no('其他格：浪費', 2.0, 1.2, U.z + 1.4);
  say('大家擠在 0 碰來碰去', '其他空間某種角度就浪費了');
  await step(tok);                                   // 46:33 要的是分散
  bad.forEach((c, i) => { glow(c, null); move(c, U.xs[i * 2 + 1], 0.3, U.z); });
  for (let i = 1; i < 8; i++) glow(U.slots[i], null);
  say('hash code 要的不是「不撞」', '而是「盡量分散」');
}]);

// 47:00 口罩實名制：身分證尾數單雙號 = 只有兩格的 hash
FRAG.push(['hashlin2-mask', '口罩分流：只有兩格的 hash', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const shop = prop('warehouse', 0, 0, -3.4, 1.0, '藥局'); bob(shop, 0.03);
  let T = null;
  await step(tok);                                   // 47:00 分散：口罩分流
  say('hash code 要分散：就像口罩奇偶數分流');
  await step(tok);                                   // 47:13 只有兩格的 hash
  T = hlRow(2, 5.6, 1.4, ['奇數 1、3、5', '偶數 2、4、6']);
  say('它就是最簡單、只有兩格的 hash');
  await step(tok);                                   // 47:22 身分證最後一碼
  const id = cube('A12345678 3', C8[0], [2.6, 0.5, 0.8], 0, 0.25, -1.0, 3);
  glow(id, GOLD); nt('看最後一碼', 2.2, 1.0, -1.0);
  say('政府用身分證的最後一碼來決定');
  await step(tok);                                   // 47:30 135 那格、246 那格
  kill(id);
  const ppl = [['…3', 0], ['…8', 1], ['…5', 0], ['…2', 1]];
  const cnt = [0, 0];
  ppl.forEach(([s, b], i) => { const p = kid(s, C8[i + 2], T.xs[b] - 1.0 + cnt[b] * 2.0, T.z, 0.6); cnt[b]++; p.mood('happy'); });
  say('你是分在 135 那格，還是 246 那格');
  await step(tok);                                   // 47:41 最後一碼怎麼算出來的
  nt('最後一碼 = 檢查碼', -4.6, 1.6, -1.6);
  say('身分證最後一碼是怎麼算出來的？', '跟前面的英文、數字有關');
  await step(tok);                                   // 47:54 幾乎就是 polynomial hash
  bub('前面的碼 → 類似 polynomial → 最後一碼', 0, 2.8, -1.4);
  say('它幾乎就是一個 polynomial hash');
  await step(tok);                                   // 48:07 組合一樣、順序不同
  say('前面的字一樣、只是順序不同', '不見得 hash 成同一個最後數字');
  await step(tok);                                   // 48:32 不是尾數 0 禮拜天…
  no('尾數 0 → 禮拜天、1 → 禮拜一…（沒有這樣分）', 0, 3.4, 3.4);
  say('它不是「尾數 0 禮拜天、1 禮拜一…」');
  await step(tok);                                   // 48:40 division by 2
  tag('尾數 mod 2', 'ptr alt', 0, 1.4, 1.4);
  say('而是做了 division by 2', 'compress 成兩格');
  await step(tok);                                   // 48:53 目的：分散
  say('目的是分散：一半的人 135 領、一半 246 領');
  await step(tok);                                   // 49:02 別把藥局塞爆
  ok('藥局不塞爆 ✓', 2.4, 1.6, -3.4);
  say('盡量不要把藥局塞爆', 'Hash table 也是一樣的意思');
  await step(tok);                                   // 49:09 更大的 array、更複雜的 key
  say('只是我們的 array 不只兩格', 'hash code、key 也更複雜');
  await step(tok);                                   // 49:35 生活中的電腦科學
  bub('生活裡的電腦科學（也來自離散、應用數學）', 0, 3.6, 1.4);
  say('一個影響我們生活的實例');
}]);

// 60:50 Collision：h(k₁) = h(k₂) 但 k₁ ≠ k₂（hash code 撞、或 compress 後撞）
FRAG.push(['hashlin2-collision', 'Collision：h(k₁) = h(k₂)，k₁ ≠ k₂', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  const T = hlRow(10, 1.15, 2.0);
  await step(tok);                                   // 60:50 hash function 把 key 分散
  const ks = [1, 4, 6, 9].map((i) => cube('', C8[i % 8], [0.8, 0.5, 0.8], T.xs[i], 0.35, T.z, 3));
  say('Hash function：把 key 分散到 bucket array 各處');
  await step(tok);                                   // 61:05 還是可能碰到 collision
  say('就算努力分散了', '還是可能碰到 Collision');
  await step(tok);                                   // 61:13 h(k1) = h(k2)
  tag('h(k₁) = h(k₂)，但 k₁ ≠ k₂', 'ptr alt', 0, 2.4, -3.2);
  say('Collision：兩個不同的 key，h 算出來一樣');
  await step(tok);                                   // 61:34 hashcode 造成
  hlBox('sum', '#4b9ee2', -2.6, -1.6, 1.6);
  const a = cube('ABC', C8[0], [1.0, 0.6, 0.8], -5.6, 0.35, -2.0), b = cube('ACB', C8[1], [1.0, 0.6, 0.8], -5.6, 0.35, -1.0);
  move(a, -2.6, 0.5, -2.0); move(b, -2.6, 0.5, -1.0); await beat(tok, 700);
  relabel(a, 198); relabel(b, 198); move(a, T.xs[8], 0.45, T.z); move(b, T.xs[8], 1.15, T.z); glow(a, RED); glow(b, RED);
  say('情況 1：hash code 就算得一樣', 'ABC、ACB 都是 198 → 198 mod 10 = 8');
  await step(tok);                                   // 61:40 compress 後碰在一起
  const c = cube('18273', C8[6], [1.2, 0.6, 0.8], 3.2, 0.35, -2.0, 3), d = cube('18033', C8[2], [1.2, 0.6, 0.8], 3.2, 0.35, -1.0, 3);
  await beat(tok, 600);
  move(c, T.xs[3], 0.45, T.z); move(d, T.xs[3], 1.15, T.z); glow(c, RED); glow(d, RED);
  say('情況 2：hash code 不同，壓縮後剛好碰在一起', '18273 mod 10 = 18033 mod 10 = 3');
  await step(tok);                                   // 61:48 碰在一起以後怎麼辦
  bub('碰在一起以後怎麼辦？', 0, 3.0, 0.6);
  say('那碰在一起以後怎麼辦？');
  await step(tok);                                   // 61:55 Collision Handling
  tag('Collision Handling', 'ptr', 0, 3.8, -1.4);
  say('處理碰撞：Collision Handling');
}]);

// 62:24 方法 0：不理他（丟掉舊的或不插入）— tolerate some errors
FRAG.push(['hashlin2-dontcare', '方法 0：不理他', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(5, 1.8, 0.4);
  let old = null, nw = null;
  await step(tok);                                   // 62:24 第零個方式：不理他
  tag('方法 0：不理他', 'ptr', 0, 2.6, -3.0);
  say('先補充第 0 種方式：不理他');
  await step(tok);                                   // 62:44 Insert 時櫃子已有東西
  old = cube('舊', C8[0], [1.2, 0.7, 0.9], T.xs[3], 0.47, T.z);
  nw = kid('新', C8[4], -5.6, -2.4, 0.6);
  await go(tok, nw.g, T.xs[3], 0, -1.6, 1000);
  glow(old, RED); nw.mood('wow');
  say('insert 時打開櫃子：裡面已經有東西了');
  await step(tok);                                   // 62:58 丟掉原來的，或 don't insert
  fly(old, V3(4, 6, -3)); await go(tok, nw.g, T.xs[3], 0.15, T.z, 600); nw.mood('happy');
  nt('或者：新的不放（don\'t insert）', -4.0, 1.4, 2.4);
  say('不理他：把原來的丟掉', '或者乾脆 don\'t insert');
  await step(tok);                                   // 63:22 每一格最多放一樣東西
  bub('每格最多一樣東西', T.xs[3], 2.4, T.z);
  say('也就是：每一格最多就放一樣東西');
  await step(tok);                                   // 63:33 留最新的
  say('有些應用：無論如何留最新的', '舊的丟掉沒關係，新的一定要放');
  await step(tok);                                   // 63:54 不是 standard
  say('這不是 standard 的處理', '要看你在做的應用是什麼');
  await step(tok);                                   // 64:27 碰撞不常發生
  say('只要碰撞不常發生', '隨便丟掉一個也是一種可能');
  await step(tok);                                   // 64:57 Tolerate some errors
  tag('Tolerate Some Errors', 'ptr alt', 0, 1.6, 3.2);
  say('思維：可以容許一些錯誤發生');
  await step(tok);                                   // 65:09 錯誤 = 丟掉不該丟的
  no('錯誤 = 丟掉了不該丟的東西', 4.0, 1.6, -2.4);
  say('這裡的「錯誤」：把不該丟的東西丟掉');
}]);

// 65:39 用 hash 做 Set：bit bucket array（沒存 key，只存 0/1）
FRAG.push(['hashlin2-bitset', 'Set 用 bit bucket array 表示', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  let T = null, bits = [];
  const S = [['k₁', 2], ['k₂', 5], ['k₃', 7]];
  const bs = [];
  await step(tok);                                   // 65:39 HashTable-based Map 做 Set
  tag('用 hash 做 Set', 'ptr', 0, 2.8, -3.2);
  say('例子：拿 HashTable-based Map 來做 Set');
  await step(tok);                                   // 65:50 Set = 集合
  zone('集合', -2.8, 0, -2.2, 6.0, 1.8, '#e6eef8');
  S.forEach(([k], i) => bs.push(kid(k, C8[i + 1], -4.6 + i * 1.8, -2.2, 0.55)));
  say('Set 就是高中學的集合', '元素 k₁、k₂、…、kₚ');
  await step(tok);                                   // 66:08 快速知道是否屬於
  bub('某個元素在不在裡面？', 3.0, 1.4, -2.2);
  say('想快速知道：某個元素在不在集合裡');
  await step(tok);                                   // 66:18 key → True / False
  say('Set 就是 key → True／False 的 map');
  await step(tok);                                   // 66:39 只要存 key → True
  say('其實只要存 key → True 這部分就好');
  await step(tok);                                   // 66:47 開一個 array
  T = hlRow(10, 1.15, 1.4);
  say('開一個 array');
  await step(tok);                                   // 66:55 塞到 h(k1)、h(k2)… 那格
  for (const [i, [k, h]] of S.entries()) { const b = bs[i]; await go(tok, b.g, T.xs[h], 0, T.z - 1.2, 600); nt('h(' + k + ') = ' + h, T.xs[h], 1.6, T.z - 1.2); }
  say('k₁ 放到 h(k₁) 那格、k₂ 放到 h(k₂)…');
  await step(tok);                                   // 67:15 那格放 1
  S.forEach(([, h], i) => { bits[h] = cube('1', C8[i + 1], [0.8, 0.5, 0.8], T.xs[h], 0.37, T.z, 2); });
  say('那一格放個 1：代表 true');
  await step(tok);                                   // 67:26 沒有的預設 0
  T.xs.forEach((x, i) => { if (!bits[i]) bits[i] = cube('0', GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z); });
  say('沒有的格：array 預設是 0');
  await step(tok);                                   // 67:33 bit bucket array
  tag('bit bucket array', 'ptr alt', -6.0, 0.9, T.z);
  say('用一個 bit 的 bucket array 描述這個 set');
  await step(tok);                                   // 68:03 沒 collision 時存下了在不在
  say('先想沒有 collision 的情況', '這個 array 大致存下了「key 在不在」');
  await step(tok);                                   // 68:09 key 沒有真的存下來
  bs.forEach((b) => remove(b.g));
  no('key 本身沒存', -3.0, 1.0, -0.6);
  say('注意：key 本身沒有存下來', '只在 hash 的位置存 1 或 0');
  await step(tok);                                   // 68:23 size 非常小
  ok('size 非常非常小', 3.0, 1.0, -0.6);
  say('所以這個 bit bucket array 非常非常小');
}]);

// 68:55 查詢：0 → 一定不在；1 → 有 collision 時可能錯
FRAG.push(['hashlin2-query', 'Set 查詢：0 一定不在、1 可能錯', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 1.4);
  const bits = T.xs.map((x, i) => { const on = [2, 5, 7].includes(i); return cube(on ? '1' : '0', on ? C8[i % 8] : GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z); });
  let ki = null, k2 = null, kj = null;
  await step(tok);                                   // 68:55 新的 key ki
  ki = kid('kᵢ', C8[4], -5.6, -2.4, 0.6);
  say('來了一個新的 key kᵢ', '想檢查它在不在 set 裡');
  await step(tok);                                   // 69:02 用 h 算出在哪一格
  await go(tok, ki.g, T.xs[4], 0, T.z - 1.3, 900);
  nt('h(kᵢ) = 4', T.xs[4], 1.7, T.z - 1.3);
  say('先用 h 算出在哪一格', '再看那格是 1 還是 0');
  await step(tok);                                   // 69:12 是 0：一定不在
  glow(bits[4], RED); ki.mood('sad');
  say('A[4] = 0：可以非常肯定 kᵢ 不在');
  await step(tok);                                   // 69:30 放進來過就會是 1
  say('放進 set 過的話，那格就會被設成 1', '它還是 0 → 從來沒放過');
  await step(tok);                                   // 69:36 confirm, no error
  ok('「不在」：no error ✓', T.xs[4], 2.6, T.z - 1.3);
  say('「不在」是 confirm 的答案：no error');
  await step(tok);                                   // 69:48 是 1 的時候？
  glow(bits[4], null); remove(ki.g);
  k2 = kid('k₂', C8[5], -5.6, -2.4, 0.6);
  await go(tok, k2.g, T.xs[5], 0, T.z - 1.3, 900);
  glow(bits[5], GOLD);
  say('那是 1 的時候，能說它在嗎？', '先想沒有任何碰撞的情況');
  await step(tok);                                   // 70:08 被某一步設成 1 → 真的在
  glow(bits[5], GREEN); k2.mood('happy');
  say('那格一定是被某個 key 設成 1', '沒碰撞 → 這個 key 真的在 set 裡');
  await step(tok);                                   // 70:26 1 是對的，如果沒有 collision
  ok('沒 collision：1 是對的', T.xs[5] + 1.6, 2.6, T.z - 1.3);
  say('所以：沒有 collision 時，這個 1 是對的');
  await step(tok);                                   // 70:40 有 collision
  glow(bits[5], null); k2.g.position.x = T.xs[5] - 1.4;
  kj = kid('kⱼ', C8[1], -5.6, -2.4, 0.6);
  await go(tok, kj.g, T.xs[5] + 0.2, 0, T.z - 1.3, 900);
  glow(bits[5], GOLD);
  say('但如果有 collision：', 'kⱼ 從沒放過，h(kⱼ) 卻也是 5');
  await step(tok);                                   // 70:47 不一樣的 key 剛好碰在一起
  arrow(V3(T.xs[5] - 1.4, 0.9, T.z - 1.3), V3(T.xs[5], 0.7, T.z - 0.3), 0x7a1010);
  kj.mood('wow');
  say('那個 1 是 k₂ 設的', 'k₂ 剛好跟 kⱼ 撞在一起');
  await step(tok);                                   // 71:02 一定機率對，一定機率錯
  say('看到 1：有一定機率真的在', '也有一定機率是錯的');
  await step(tok);                                   // 71:10 有一點錯誤可能性
  no('「在」：可能錯', T.xs[5] + 0.8, 2.6, T.z + 1.3);
  say('一個有一點點錯誤可能性的 data structure', '錯誤全來自 collision');
}]);

// 71:32 Bloom filter：多個 hash function，全部是 1 才說「在」
FRAG.push(['hashlin2-bloom', 'Bloom filter：多個 hash function', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 1.2);
  const bits = T.xs.map((x) => cube('0', GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z));
  const set1 = async (k, hs, col) => {
    const c = kid(k, col, -5.6, -2.4, 0.6);
    await go(tok, c.g, 0, 0, -2.4, 700);
    const ar = hs.map((h) => arrow(V3(0, 0.6, -1.9), V3(T.xs[h], 0.7, T.z - 0.5), 0xc08a1f));
    hs.forEach((h) => { relabel(bits[h], 1); tint(bits[h], col); });
    await beat(tok, 700); ar.forEach(kill); remove(c.g);
  };
  await step(tok);                                   // 71:32 非常小，bit array
  tag('bit array（沒存 key）', 'ptr', -6.0, 0.9, T.z);
  say('好處：非常小，就是一個 bit array', '也沒有存 key');
  await step(tok);                                   // 71:43 很多 key，小小 array
  say('好的 hash function：非常非常多的 key', '用一個小小的 array 就表示得出來');
  await step(tok);                                   // 71:57 缺點：會有錯誤
  no('缺點：可能有一點錯誤', 0, 2.6, -2.4);
  say('一點點缺點：有可能會有一些錯誤');
  await step(tok);                                   // 72:23 Bloom Filter
  tag('Bloom Filter', 'ptr alt', 0, 3.4, -2.4);
  say('延伸閱讀：Bloom Filter');
  await step(tok);                                   // 72:39 hash 延伸來做 set
  say('剛才講的，就是 Bloom Filter 最基本的一塊', '把 hash 延伸拿來做 set');
  await step(tok);                                   // 72:45 很多個 hash function
  await set1('x', [1, 4, 8], C8[0]);
  say('真的 Bloom Filter 用很多個 hash function', 'insert x：h₁、h₂、h₃ 三格都設 1');
  await step(tok);                                   // 72:53 獨立 → 錯誤率很低
  await set1('y', [2, 4, 6], C8[2]);
  say('hash 彼此有獨立性 → 錯誤率可以降到很低', 'insert y：2、4、6');
  await step(tok);                                   // 73:08 很快判斷在不在
  const z = kid('z', C8[4], 0, -2.4, 0.6);
  [1, 6, 7].forEach((h) => glow(bits[h], h === 7 ? RED : GREEN)); z.mood('sad');
  say('很快判斷某個 key 在不在 set 裡', '查 z：1、6、7 → A[7] = 0 → 不在');
  await step(tok);                                   // 73:21 不在：肯定；在：小機率錯
  [1, 6, 7].forEach((h) => glow(bits[h], null)); remove(z.g);
  const w = kid('w', C8[5], 0, -2.4, 0.6);
  [2, 4, 8].forEach((h) => glow(bits[h], GOLD)); w.mood('wow');
  say('「不在」是肯定的；「在」有小小機率錯', 'w 沒放過，2、4、8 卻剛好全是 1');
  await step(tok);                                   // 73:28 大部分是對的
  say('但大部分時候是對的', '大資料時代非常有用');
}]);

// 73:34 應用：廣告系統判斷使用者是否在 1532 人名單
FRAG.push(['hashlin2-ads', 'Bloom filter 應用：1532 人看紅色廣告', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  let red = null, oth = null, filt = null;
  const user = async (name, inSet, ci) => {
    const u = kid(name, C8[ci], 0, -4.0, 0.55);
    await go(tok, u.g, 0, 0, -1.0, 700);
    await go(tok, u.g, inSet ? 4.6 : -4.6, 0, 2.6, 800);
    u.mood(inSet ? 'happy' : 'calm'); glow(inSet ? red : oth, GOLD);
    return u;
  };
  await step(tok);                                   // 73:37 廣告系統
  const mon = prop('monitor', 0, 0, -3.8, 0.9, '廣告系統'); bob(mon, 0.03);
  say('例子：線上廣告系統');
  await step(tok);                                   // 73:46 對使用者決定廣告
  say('決定要給哪個使用者看什麼廣告');
  await step(tok);                                   // 74:00 紅色廣告
  red = cube('紅色廣告', '#c0392b', [1.8, 0.6, 1.0], 4.6, 0.3, 3.6); oth = cube('其他廣告', GRAY, [1.8, 0.6, 1.0], -4.6, 0.3, 3.6);
  say('發現一群人對紅色廣告特別有反應');
  await step(tok);                                   // 74:06 1532 人
  zone('名單：1532 人', 4.4, 0, -1.6, 3.6, 2.2, '#f6dede');
  for (let i = 0; i < 4; i++) kid('', C8[i], 3.2 + (i % 2) * 1.6, -2.2 + Math.floor(i / 2) * 1.2, 0.4);
  say('這群使用者有 1532 個人', '只給他們看紅色廣告');
  await step(tok);                                   // 74:24 流量來了：屬於這群嗎
  const u0 = kid('?', C8[6], 0, -1.0, 0.55); u0.mood('wow');
  say('一個廣告流量來了', '他屬不屬於這 1532 人？');
  await step(tok);                                   // 74:33 一個個比對
  const cmp = pk('比對 1', -2.0, 1.4, -1.0);
  for (let i = 2; i <= 4; i++) { await beat(tok, 350); txt(cmp, '比對 ' + i); }
  txt(cmp, '比對 … 1532');
  say('一個一個比對，一路比到 1532？');
  await step(tok);                                   // 74:42 等你比完廣告機會都不見
  remove(cmp); remove(u0.g);
  no('比完，廣告機會都不見了', -2.0, 1.4, -1.0);
  say('等你比完，廣告機會都不見了', '用 Bloom Filter 來算');
  await step(tok);                                   // 74:49 1532 人建 Bloom Filter
  filt = hlBox('Bloom Filter', '#e55a9b', 0, -1.0, 2.6);
  say('先把這 1532 人建成一個 Bloom Filter');
  await step(tok);                                   // 74:56 來一個人很快算
  await user('u₁', true, 1);
  say('有人來時：很快算出他屬不屬於', 'u₁：在 → 紅色廣告');
  await step(tok);                                   // 75:01 不是 → 別的廣告
  glow(red, null);
  await user('u₂', false, 3);
  say('不是：趕快秀給他別的廣告', '是：秀紅色廣告');
  await step(tok);                                   // 75:07 小錯誤沒關係
  glow(oth, null); glow(red, GOLD);
  nt('多秀給 10 個人也沒關係', 4.6, 1.4, 1.6);
  say('「是」有一點點小錯誤也許沒關係', '頂多多秀給十個人紅色廣告');
  await step(tok);                                   // 75:13 1532 人都看到
  ok('1532 人全都看到 ✓', 4.6, 1.6, 4.6);
  say('至少確保你在意的 1532 人都看到');
}]);

// 77:11 方法 1：fixed array per bucket（一個櫃子切成小櫃子）
FRAG.push(['hashlin2-fixed', '方法 1：每個 bucket 一個固定 array', async (tok) => {
  fresh([0, 10, 8], [0, 0.3, 0.6]);   // more from above: the four little drawers of a bucket lie in depth
  const T = hlRow(5, 2.2, -2.6, null, -0.85);
  const ks = [];
  const put = (j) => { const [x, y, z] = cpos(T, 3, j); ks.push(cube('k' + SUB(j + 1), C8[j], [1.3, 0.6, 0.65], x, y, z, 3)); };
  await step(tok);                                   // 77:11 比較標準的處理
  say('除了不理他：比較標準的 collision 處理');
  await step(tok);                                   // 77:18 Fixed Array Per Bucket
  tag('方法 1：Fixed Array Per Bucket', 'ptr', 0, 2.0, -3.6);
  say('第一個：每個 bucket 一個固定大小的 array');
  await step(tok);                                   // 77:29 一個櫃子切成好幾個小櫃子
  T.xs.forEach((x) => { for (let j = 0; j < 4; j++) cube('', '#e8dfcc', [1.6, 0.08, 0.7], x, 0.05, T.z + 1.05 + j * 0.85); });
  say('就是把一個櫃子切成好幾個小櫃子');
  await step(tok);                                   // 77:35 兩個人共用
  put(0); put(1);
  say('兩個人要共用一個櫃子', 'h(k₁) = h(k₂) = 3：各放一小格');
  await step(tok);                                   // 77:39 還是會 overflow
  put(2); put(3);
  say('這樣還是會 overflow');
  await step(tok);                                   // 77:49 hash 不好、分布特別
  say('hash function 設計得不夠好', '或 data 的分布有點特別');
  await step(tok);                                   // 77:55 四個都滿
  const k5 = cube('k₅', C8[4], [1.3, 0.6, 0.65], T.xs[3], 0.35, T.z + 5.4, 3); glow(k5, RED);   // waits in front of the full bucket, clear of k₄
  no('滿了！', T.xs[3] + 1.7, 0.6, T.z + 5.4);
  say('切成 4 個小櫃子，4 個都滿了', '第 5 個放不下');
  await step(tok);                                   // 78:00 發生不多就是簡單方法
  say('如果不常發生：這是一個簡單的方法');
}]);

// 78:16 方法 2：chaining（linked list）— 希望 chain 短，時間 ∝ 那格的長度
FRAG.push(['hashlin2-chain', '方法 2：chaining，chain 要短', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.6]);
  const T = hlRow(5, 2.2, -2.8, null, -0.85);
  await step(tok);                                   // 78:16 linked list
  tag('方法 2：linked list', 'ptr', 0, 2.0, -3.8);
  say('想動態一點：用學過的 linked list');
  await step(tok);                                   // 78:25 要串多少就串多少：chaining
  for (const k of [10, 7, 12, 4]) hlChain(T, k % 5, k, null, true);
  nt('h(x) = x mod 5', 4.8, 1.0, -2.8);
  say('要串多少就串多少', '這叫 chaining');
  await step(tok);                                   // 78:39 每一格串出去
  say('每一格就一條一條串出去');
  await step(tok);                                   // 78:43 希望短的 chain
  ok('chain 短一點最好', -4.4, 1.4, 0.2);
  say('我們希望 chain 短');
  await step(tok);                                   // 78:59 insert、get
  say('map 要做的事：insert（放進去）、get（拿出來）');
  await step(tok);                                   // 79:07 hash 部分很快
  const p = pk('h(x)', -5.6, 1.6, -2.8);
  await go(tok, p, T.xs[2], 1.6, -2.8, 700);
  say('hash 部分很快：算 hash code、compress', '直接就到某一格');
  await step(tok);                                   // 79:20 時間跟那一格放多少有關
  remove(p);
  say('之後花的力氣，跟那一格放了多少東西有關');
  await step(tok);                                   // 79:33 長長的 linked list
  for (const k of [3, 8, 13, 18, 23]) hlChain(T, 3, k, null, true);
  say('大家都擠同一格：長長的 linked list', '3、8、13、18、23 都 mod 5 = 3');
  await step(tok);                                   // 79:38 排很長的隊
  const cur = tag('get 23', 'ptr alt', T.xs[3] + 1.5, 1.2, T.z + 1.05);
  for (let j = 0; j < 5; j++) { const [, , z] = cpos(T, 3, j); cur.position.set(T.xs[3] + 1.5, 1.2, z); glow(T.ch[3][j], j === 4 ? GREEN : GOLD); await beat(tok, 380); glow(T.ch[3][j], null); }
  say('像排很長的隊：不太好', 'get 23 要走過 5 個節點');
}]);

// 79:47 方法 3：other container（secondary data structure），例如第二層再 hash
FRAG.push(['hashlin2-secondary', '方法 3：secondary 的 container', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.2]);
  let T = null, bk = [];
  await step(tok);                                   // 79:47 other container
  tag('方法 3：other container', 'ptr', 0, 2.2, -3.6);
  say('比 array、linked list 更進階：other container');
  await step(tok);                                   // 79:58 任何可動態塞下的
  say('任何能動態塞下一堆碰撞 key 的東西', '都可以放在這裡');
  await step(tok);                                   // 80:10 secondary
  nt('secondary data structure', 4.4, 1.4, -3.0);
  say('這種通常叫 secondary');
  await step(tok);                                   // 80:19 hash 只是分流
  T = hlRow(4, 3.0, -2.6, ['桶 0', '桶 1', '桶 2', '…']);
  bk = T.xs.map((x, i) => cube(i < 3 ? '很多人' : '…', C8[i], [1.8, 0.6, 0.8], x, 0.4, T.z, 3));
  say('原來一堆東西：hash 只是先分流');
  await step(tok);                                   // 80:26 第二層再用 hash
  const sub = hlRow(5, 1.1, 1.6);
  const off = T.xs[0] + 2.0;
  sub.xs.forEach((x, i) => { sub.slots[i].position.x = x + off; sub.idx[i].position.x = x + off; });
  arrow(V3(T.xs[0], 0.4, T.z + 0.5), V3(off - 2.2, 0.3, 1.0), 0xc08a1f);
  tag('第二層 hash', 'ptr alt', off, 1.4, 1.6);
  say('分流後還是很多：第二層要做什麼？', '例如再用另一個 hash');
  await step(tok);                                   // 80:37 100 萬 → 每桶 1 萬
  bk.slice(0, 3).forEach((c) => relabel(c, '1 萬人'));
  nt('100 萬人', -5.8, 1.4, -2.6);
  say('原來 100 萬人', '分成每個 bucket 1 萬人');
  await step(tok);                                   // 80:42 1 萬人找來找去太多
  glow(bk[0], RED);
  say('每次在 1 萬人裡找來找去：還是太多');
  await step(tok);                                   // 80:47 用 hash 或更小的 map
  glow(bk[0], null);
  for (let i = 0; i < 5; i++) cube('', C8[(i + 3) % 8], [0.8, 0.5, 0.7], sub.slots[i].position.x, 0.35, 1.6, 2);
  say('不用 array、不用 linked list', '再用一個 hash，或更小的 map');
  await step(tok);                                   // 80:53 只是更複雜
  say('通通都可以，只是更複雜');
  await step(tok);                                   // 81:01 array、linked list 基本款
  bub('array、linked list：基本款', -3.6, 2.6, 3.4);
  say('array、linked list 是基本款');
  await step(tok);                                   // 81:16 進階款難 maintain
  bub('進階款：更合用，但更難 maintain', 3.0, 2.6, 3.4);
  say('進階款更合你用', '缺點：更複雜、更難 maintain');
}]);

// 81:24 Open addressing：回收再利用 bucket array 裡的空格
FRAG.push(['hashlin2-open-idea', 'Open addressing：用表裡的空格', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(8, 1.45, -2.4, null, -0.85);
  for (const k of [10, 18, 26]) hlChain(T, 2, k);
  hlChain(T, 6, 14);
  await step(tok);                                   // 81:24 回顧前面的方法
  say('講了：不理他、array、linked list、other container');
  await step(tok);                                   // 81:31 reuse 空格
  tag('另一種需求：reuse 空格', 'ptr', 0, 2.0, -3.4);
  say('教科書的另一種：reuse bucket array 的 empty space');
  await step(tok);                                   // 81:53 1、2、3 都另外拉空間
  T.ch[2].forEach((c) => glow(c, GOLD));
  say('1、2、3 都是：碰到了就另外多拉空間');
  await step(tok);                                   // 82:01 有的塞、有的空
  say('Hash table 裡：有些地方塞，有些地方空');
  await step(tok);                                   // 82:21 空的還是空
  T.ch[2].forEach((c) => glow(c, null));
  [0, 1, 3, 4, 5, 7].forEach((i) => glow(T.slots[i], GREEN));
  say('塞的地方多給空間，可是空的地方還是空的');
  await step(tok);                                   // 82:28 回收再利用
  bub('回收再利用？', 0, 2.4, -0.4);
  say('能不能把空的地方回收再利用？');
  await step(tok);                                   // 82:42 不另外安排空間
  say('盡量不另外安排空間', '只用那些比較空的地方');
  await step(tok);                                   // 82:52 Open Addressing
  tag('Open Addressing', 'ptr alt', 0, 3.2, -0.4);
  say('這通常叫 Open Addressing');
  await step(tok);                                   // 83:02 最想放的 bucket
  const [a, b, c] = T.ch[2];
  move(a, T.xs[2], 0.45, T.z); move(T.ch[6][0], T.xs[6], 0.45, T.z);
  say('你有一個最想放入的 bucket');
  await step(tok);                                   // 83:09 已經有人
  move(b, T.xs[2], 1.2, T.z); glow(b, RED);
  say('如果那個 bucket 剛好已經有人');
  await step(tok);                                   // 83:14 放到接近的另一個 bucket
  glow(b, null); move(b, T.xs[3], 0.45, T.z); glow(T.slots[3], null);
  await beat(tok, 500);
  move(c, T.xs[4], 0.45, T.z); glow(T.slots[4], null);
  say('就試著放到接近的另一個 bucket', '18 → [3]、26 → [4]');
}]);

// 83:32 第三排中間的座位：依序找第一、第二、第三志願
FRAG.push(['hashlin2-seat', '找座位：第一志願被坐走就找第二志願', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, 0]);
  tag('講台', 'ptr', 0, 0.6, -3.8);
  const sx = (c) => -2.4 + c * 1.2, sz = (r) => -2.4 + r * 1.2;
  const seats = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) seats.push(cube('', GRAY, [0.9, 0.12, 0.9], sx(c), 0.06, sz(r)));
  const seat = (r, c) => seats[r * 5 + c];
  [[0, 1], [4, 0], [1, 4], [3, 2], [4, 3]].forEach(([r, c], i) => cube('', C8[i], [0.6, 0.6, 0.6], sx(c), 0.42, sz(r)));
  const me = buddy('我', '', C8[4], 5.4, 0, 3.0, 0.6);
  const sitAt = (r, c) => go(tok, me.g, sx(c) + 0.1, 0.3, sz(r) + 0.55, 800);
  await step(tok);                                   // 83:33 最喜歡的位置
  say('以前進教室上課：我有一個最喜歡的位置');
  await step(tok);                                   // 83:44 第三排中間
  glow(seat(2, 2), GOLD); tag('第一志願', 'idx', sx(2), 1.0, sz(2));
  say('那就是：第三排的中間');
  await step(tok);                                   // 83:52 不是來混的
  bub('老師：這同學不是來混的', -4.6, 1.6, 2.4);
  say('老師會覺得：這同學不是來混的');
  await step(tok);                                   // 84:08 第一排壓力大
  for (let c = 0; c < 5; c++) glow(seat(0, c), RED);
  say('坐第一排：老師和學生壓力都很大');
  await step(tok);                                   // 84:18 進可攻退可守
  for (let c = 0; c < 5; c++) glow(seat(0, c), null);
  say('第三排：進可攻、退可守');
  await step(tok);                                   // 84:27 想睡覺也像好認真
  me.mood('calm');
  say('真的想睡，老師還覺得你讀書讀到好累');
  await step(tok);                                   // 84:58 想搶第三排中間
  say('進教室就想：要搶到第三排中間');
  await step(tok);                                   // 85:06 有人坐了
  cube('', C8[6], [0.6, 0.6, 0.6], sx(2), 0.42, sz(2), 2); me.mood('sad');
  say('可是來晚了：那個位置已經有人坐了');
  await step(tok);                                   // 85:13 就像 hash 算出的 bucket 有人
  nt('= hash 算出的 bucket 已經有人', 4.6, 1.4, -1.6);
  say('就像：hash function 算出的 bucket 上已經有人');
  await step(tok);                                   // 85:28 不理他 = 趕人
  bub('不理他 = 把同學趕走？', 4.6, 2.2, 0.4);
  say('不理他：把同學趕走說那是我的位置？');
  await step(tok);                                   // 85:44 小格子 = 擠一張椅子
  bub('小格子 = 擠同一張椅子？', 4.6, 2.2, 1.4);
  say('切小格子：跟同學擠同一張椅子？');
  await step(tok);                                   // 86:00 linked list = 手牽手
  bub('linked list = 手牽手串一串？', 4.6, 2.2, 2.4);
  say('linked list：手牽手串成一串？');
  await step(tok);                                   // 86:19 都不是真正的方式
  say('這些都不是我們真正會做的');
  await step(tok);                                   // 86:23 去第二想要的位置
  tag('第二', 'idx', sx(3), 1.0, sz(2)); cube('', C8[7], [0.6, 0.6, 0.6], sx(3), 0.42, sz(2));
  await sitAt(2, 3);
  say('最想要的被佔了 → 去第二想要的位置', '也有人了');
  await step(tok);                                   // 86:30 第三想要
  tag('第三', 'idx', sx(1), 1.0, sz(2)); cube('', C8[3], [0.6, 0.6, 0.6], sx(1), 0.42, sz(2));
  await sitAt(2, 1);
  say('再去第三想要的位置', '依序找第一、第二、第三、第四…');
  await step(tok);                                   // 86:44 沒人就坐下
  tag('第四', 'idx', sx(2), 1.0, sz(1));
  await sitAt(1, 2); glow(seat(1, 2), GREEN); me.mood('happy');
  say('沒人坐：就坐下來', '有人：就找下一個');
  await step(tok);                                   // 86:50 耐心有限
  say('耐心也有限度', '第一到第十想要都沒得坐的話…');
  await step(tok);                                   // 87:01 兩手一攤
  bub('今天不是我的上課日…', 4.6, 2.2, -0.6);
  say('兩手一攤：今天還是不要上了');
  await step(tok);                                   // 87:11 = Open Addressing
  tag('這種找位方式 = Open Addressing', 'ptr alt', 0, 2.4, -3.4);
  say('這種找位方式，就是 Open Addressing');
}]);

// 87:25 Open addressing 的 insert / get：h₀, h₁, …, h_{m−1}，全滿 declare failure
FRAG.push(['hashlin2-oa-steps', 'Open addressing：insert 與 get 的步驟', async (tok) => {
  fresh([0, 8, 12], [0, 1.2, -0.4]);
  const cd = code(['insert：Array[key] = value', '  for i = 0 … m−1:', '    hᵢ ← 第 i 順位的格子', '    若 A[hᵢ] 是空的：放入、結束', '  declare failure', 'get(key)：同樣順序 h₀, h₁, …', '  找到 key；全找完 → 不在'], -1.4, 6.0, 0.48, -3.4);
  const T = hlRow(8, 1.45, 1.6);
  hlPut(T, 3, 'A'); hlPut(T, 6, 'B'); hlPut(T, 0, 'C');
  let cur = null;
  const at = async (i, j) => { await go(tok, cur, T.xs[j], 1.8, T.z, 500); txt(cur, 'h' + SUB(i)); };
  await step(tok);                                   // 87:25 把步驟寫下來
  say('把 open addressing 的步驟詳細寫下來');
  await step(tok);                                   // 87:33 Array[key] = value
  cd.hl(0);
  say('抽象地寫：Array[key] = value');
  await step(tok);                                   // 87:48 key 透過 hash 到 entry
  say('實際上：key 經過 hash，才到 array 裡的某一格');
  await step(tok);                                   // 88:12 先找最想要的位置
  say('先算一算：最想要的位置是哪裡？');
  await step(tok);                                   // 88:34 H0
  cd.hl(2);
  cur = tag('h₀', 'ptr alt', -5.6, 1.8, T.z);
  say('用原來的 hash function 算出 h₀', 'h₀ = h(key)：最想要的位置');
  await step(tok);                                   // 89:03 例：第 3 個位置
  await at(0, 3);
  say('例如算出來要放第 3 個位置');
  await step(tok);                                   // 89:09 已經有人了
  glow(T.keys[3], RED);
  say('先試試看：第 3 個位置已經有人了');
  await step(tok);                                   // 89:21 h1：第二喜歡
  glow(T.keys[3], null); await at(1, 6); glow(T.keys[6], RED);
  say('改試 h₁：第二喜歡的位置', 'h₁ = 6：也有人');
  await step(tok);                                   // 89:33 h2
  glow(T.keys[6], null); await at(2, 1); cd.hl(3);
  const me = hlPut(T, 1, 'key', C8[4], true);
  say('再不行就試 h₂', 'h₂ = 1：空的 → 放進去');
  await step(tok);                                   // 89:50 耐心只有 m 次
  cd.hl(1);
  say('耐心只有 m 次', '第 0、1、2、…、m−1 順位');
  await step(tok);                                   // 90:06 re-insert 到 h0 … h_{m−1}
  say('依序試 h₀、h₁、…、hₘ₋₁');
  await step(tok);                                   // 90:32 declare failure
  cd.hl(4); no('全部有人 → declare failure', 0, 3.4, T.z);
  say('還是不行：雙手一攤，declare failure');
  await step(tok);                                   // 91:29 get：同學來找我
  cd.hl(5); glow(me, null);
  say('get：拿東西出來，就像同學來找我', '他知道我找位置的順序');
  await step(tok);                                   // 91:40 先看最喜歡的位置
  await at(0, 3); glow(T.keys[3], GOLD);
  say('先看我在不在最喜歡的位置', 'h₀ = 3：不是');
  await step(tok);                                   // 91:48 第二喜歡
  glow(T.keys[3], null); await at(1, 6); glow(T.keys[6], GOLD);
  say('不在的話：看第二喜歡的位置', 'h₁ = 6：不是');
  await step(tok);                                   // 91:58 第三喜歡
  glow(T.keys[6], null); await at(2, 1); glow(me, GREEN);
  say('再看第三喜歡的位置', 'h₂ = 1：找到了！');
  await step(tok);                                   // 92:13 通通找過沒有 → 沒來
  glow(me, null); cd.hl(6);
  bub('全找過都沒有 → 他沒來上課', 0, 3.0, 3.6);
  say('如果通通找過都沒有', '那就是沒來上課：key 不在');
  await step(tok);                                   // 93:08 H0 用原來的 hash
  cd.hl(2);
  say('h₀ 用原來的 hash function 算：這沒問題');
  await step(tok);                                   // 93:15 H1…H(m−1) 怎麼算
  say('那 h₁、h₂、…、hₘ₋₁ 怎麼算？', '文獻裡有幾種方式');
}]);

// 93:28 Linear probing：hᵢ = h₀ + i（找隔壁）、clustering
FRAG.push(['hashlin2-linear', 'Linear probing 與 clustering', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[0], 1.8, T.z);
  const ins = async (k, home, ms = 350) => {
    const seq = []; for (let i = 0; i < T.m; i++) { const j = (home + i) % T.m; seq.push(j); if (!T.keys[j]) break; }
    await hlProbe(tok, T, cur, seq, ms); hlPut(T, seq[seq.length - 1], k, null, true);
  };
  await step(tok);                                   // 93:28 Linear Probing
  tag('Linear Probing', 'ptr', 0, 2.8, -2.6);
  say('第一種：Linear Probing');
  await step(tok);                                   // 93:39 前一個選擇的隔壁
  say('下一個選擇 = 前一個選擇移一點點：隔壁');
  await step(tok);                                   // 93:54 0 號 → 1 號 → 2 號 → 3 號
  for (let i = 1; i <= 3; i++) { await go(tok, cur, T.xs[i], 1.8, T.z, 450); txt(cur, 'h' + SUB(i)); }
  say('第 0 號沒有 → 隔壁 1 號 → 2 號 → 3 號');
  await step(tok);                                   // 94:04 離原位置 i 那麼遠
  tag('hᵢ = (h₀ + i) mod k', 'ptr alt', 0, 2.0, -2.6);
  say('hᵢ 就在離原位置 i 那麼遠的地方');
  await step(tok);                                   // 94:21 繞圈圈找隔壁
  for (const i of [8, 9, 0]) { await go(tok, cur, T.xs[i], 1.8, T.z, 350); }
  arrow(V3(T.xs[9], 1.2, T.z + 1.0), V3(T.xs[0], 1.2, T.z + 1.0), 0xc08a1f);
  say('到底了就繞回 0：繞圈圈找隔壁');
  await step(tok);                                   // 94:33 最多幾次
  say('最多可以做幾次嘗試？');
  await step(tok);                                   // 94:42 整個 array 繞過
  say('整個 array 都繞過、全滿才停', '最多 k − 1 步');
  await step(tok);                                   // 95:02 缺點：collision 特別嚴重
  hlPut(T, 3, 3, null, true); txt(cur, 'h₀'); cur.position.set(T.xs[3], 1.8, T.z);
  say('缺點：某一格的 collision 特別嚴重時');
  await step(tok);                                   // 95:17 3 號撞了 → 4 號
  await ins(13, 3);
  say('3 號撞了 → 原本要放 3 號的塞到 4 號', '13 → [4]');
  await step(tok);                                   // 95:23 3 號附近集中
  await ins(23, 3);
  say('再撞就 5 號：3 號附近擠成一團', '23 → [5]');
  await step(tok);                                   // 95:32 每次都 3、4、5 往後走
  await hlProbe(tok, T, cur, [3, 4, 5], 400);
  say('每次碰到 3 號，都要 3、4、5 一路往後走');
  await step(tok);                                   // 95:41 Clustering
  [3, 4, 5].forEach((i) => glow(T.keys[i], GOLD));
  tag('Clustering', 'ptr alt', T.xs[4], 2.6, T.z);
  say('佔用相鄰 entry 的現象：Clustering');
  await step(tok);                                   // 95:51 塞車
  bub('像塞車一樣', T.xs[4], 3.2, T.z + 1.4);
  say('一堆東西擠在那裡：像塞車');
  await step(tok);                                   // 96:08 4 號自己的放不進去
  [3, 4, 5].forEach((i) => glow(T.keys[i], null));
  const k14 = cube('14', kc(14), [0.9, 0.6, 0.8], T.xs[4], 0.35, T.z - 1.6, 3); glow(k14, RED);
  say('結果：4 號自己的反而放不進去');
  await step(tok);                                   // 96:16 4 號借 6 號、5 號借 7 號
  kill(k14); await ins(14, 4, 280); await ins(15, 5, 280);
  say('4 號要去借 6 號，5 號要去借 7 號', '14 → [6]、15 → [7]');
  await step(tok);                                   // 96:24 拖慢效率
  [3, 4, 5, 6, 7].forEach((i) => glow(T.keys[i], RED));
  say('擠在不該擠的地方：拖慢整個 hash 的效率');
  await step(tok);                                   // 96:32 避免太規律
  [3, 4, 5, 6, 7].forEach((i) => glow(T.keys[i], null));
  say('跟 hash function 一樣：想避免太規律、太簡單');
}]);

// 96:41 Quadratic probing：隔壁、4 以外、9 以外、16 以外
FRAG.push(['hashlin2-quad', 'Quadratic probing：跳 1、4、9、16', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(17, 0.74, 0.6);
  [[3, 20], [4, 21], [7, 24], [12, 29]].forEach(([i, k]) => hlPut(T, i, k));
  const cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  await step(tok);                                   // 96:41 Quadratic
  say('所以大家還做了什麼？像是 Quadratic');
  await step(tok);                                   // 96:53 Quadratic Probing
  tag('Quadratic Probing', 'ptr', 0, 2.8, -2.6);
  say('課本上的 Quadratic Probing');
  await step(tok);                                   // 97:02 走越多格，往越遠找
  say('不要每次都集中在那裡', '走越多格，就往越遠的地方找');
  await step(tok);                                   // 97:10 i 平方
  tag('hᵢ = (h₀ + i²) mod 17', 'ptr alt', 0, 2.0, -2.6);
  say('用 i 平方：+1、+4、+9、+16…', '例：insert 37，h₀ = 37 mod 17 = 3');
  await step(tok);                                   // 97:17 先看隔壁
  await hlProbe(tok, T, cur, [3, 4], 450);
  say('[3] 有人 → 先看隔壁（+1）', '[4] 也有人');
  await step(tok);                                   // 97:24 4、9、16 以外
  await hlProbe(tok, T, cur, [3, 4, 7, 12, 2], 380);
  hlPut(T, 2, 37, null, true);
  say('再到 +4、+9 以外，再到 +16 以外', '3+16 = 19 mod 17 = 2：空的');
  await step(tok);                                   // 97:30 中間留空
  [5, 6, 8, 9, 10, 11].forEach((i) => glow(T.slots[i], GREEN));
  say('中間留一些空，給本來屬於那裡的 key', '不會大家都擠在 [3] 附近');
  await step(tok);                                   // 97:38 簡單版
  [5, 6, 8, 9, 10, 11].forEach((i) => glow(T.slots[i], null));
  say('linear、quadratic：簡單版');
}]);

// 97:50 Double hashing：hᵢ = h₀ + i·another_hash(key)
FRAG.push(['hashlin2-double', 'Double hashing：每個 key 步伐不同', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(11, 1.1, 0.6);
  hlPut(T, 3, 3);
  const cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  const ins = async (k) => { const st = 7 - (k % 7), seq = [k % 11, (k % 11 + st) % 11]; await hlProbe(tok, T, cur, seq, 450); hlPut(T, seq[1], k, null, true); };
  await step(tok);                                   // 97:50 h0 + another hash
  tag('hᵢ = h₀ + i · another_hash(key)', 'ptr', 0, 2.8, -2.6);
  say('複雜版：不希望找的位置太有規律', 'hᵢ = h₀ + i·another_hash(key)');
  await step(tok);                                   // 98:05 拿 key 再算一個東西
  tag('another_hash(k) = 7 − (k mod 7)', 'ptr alt', 0, 2.0, -2.6);
  say('another hash：拿你的 key 再算一個東西');
  await step(tok);                                   // 98:13 每個 key 不同，乘上 i
  say('每個 key 對應不同的步伐，再乘上 i');
  await step(tok);                                   // 98:22 步伐跟複雜函式有關
  say('離原位多遠：跟一個比較複雜的函式有關', '不再是 i 或 i² 這麼簡單');
  await step(tok);                                   // 98:39 再透過 hash 分散
  await ins(14);
  say('14：h₀ = 3 有人，步伐 = 7 − 0 = 7', '3 + 7 = 10 → 放 [10]');
  await step(tok);                                   // 98:47 雜湊 = 切碎碎
  await ins(25);
  say('25：h₀ 也是 3，步伐 = 7 − 4 = 3 → [6]', 'Hash：雜湊，有「切碎碎」的意思');
  await step(tok);                                   // 98:59 原來 hash：分散到 array
  say('原本的 hash：把 key 分散到 array 裡');
  await step(tok);                                   // 99:05 另一個 hash 分散下一個位置
  [10, 6].forEach((i) => glow(T.keys[i], GOLD));
  say('還是擠在一起：再用另一個 hash', '把下一個位置分散開（同樣 h₀，去處不同）');
  await step(tok);                                   // 99:12 Double Hashing
  tag('Double Hashing', 'ptr alt', 0, 3.4, -2.6);
  say('這種機制叫 Double Hashing');
}]);

// 99:20 哪一個好？從簡單到複雜的 spectrum
FRAG.push(['hashlin2-spectrum', '從簡單到複雜：看應用選', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const row = (r, name, items) => {
    tag(name, 'ptr', -5.6, 0.9, -2.4 + r * 2.4);
    const cs = items.map((s, i) => cube(s, C8[(r * 3 + i) % 8], [2.2, 0.6, 0.9], -2.4 + i * 3.0, 0.3, -2.4 + r * 2.4, 3));
    for (let i = 0; i < items.length - 1; i++) arrow(V3(-1.2 + i * 3.0, 0.4, -2.4 + r * 2.4), V3(-0.6 + i * 3.0, 0.4, -2.4 + r * 2.4));
    return cs;
  };
  let oa = null, col = null;
  const thinker = buddy('哪個好？', '', C8[4], 5.8, 0, -3.4, 0.6);
  await step(tok);                                   // 99:20 哪一個比較好？不知道
  thinker.mood('wow');
  say('哪一個比較好？老實說：不知道');
  await step(tok);                                   // 99:29 看應用、看設計的 hash
  say('看你的應用、複雜度', '甚至看你設計得出什麼樣的 hash');
  await step(tok);                                   // 99:36 Quadratic 已經有好處
  oa = row(2, 'open addr.', ['linear', 'quadratic', 'double']);
  glow(oa[1], GREEN);
  say('很多時候 Quadratic Probing 已經有一定的好處', '不見得要做更複雜的');
  await step(tok);                                   // 99:48 碰撞太嚴重 → 往複雜移
  glow(oa[1], null); glow(oa[2], GOLD);
  say('實務上：發現碰撞太嚴重', '才從簡單的 design 移向複雜的');
  await step(tok);                                   // 100:06 hash code 簡單到複雜
  row(0, 'hash code', ['sum', 'polynomial', 'cyclic shift']);
  say('hash code：sum → polynomial → cyclic');
  await step(tok);                                   // 100:17 linear → quadratic → double
  glow(oa[2], null); oa.forEach((c) => glow(c, GOLD));
  say('open addr.：linear → quadratic → double');
  await step(tok);                                   // 100:22 spectrum
  oa.forEach((c) => glow(c, null));
  bub('一整個 Spectrum 的工具', 0, 2.8, -3.6);
  say('給大家一個 Spectrum：可以用的工具');
  await step(tok);                                   // 100:29 測試、確保效率
  thinker.mood('calm');
  say('Hash 概念很簡單', '難在：怎麼測試、怎麼確保效率');
  await step(tok);                                   // 100:48 collision：不理他 → 容錯
  col = row(1, 'collision', ['不理他（容錯）', 'secondary', 'open addr.']);
  glow(col[0], GOLD);
  say('Collision 怎麼解決：不理他 → 往容錯走');
  await step(tok);                                   // 100:55 secondary
  glow(col[0], null); glow(col[1], GOLD);
  say('Secondary 的 data structure／storage', '用 array、linked list 或任何東西');
  await step(tok);                                   // 101:10 reuse：open addressing
  glow(col[1], null); glow(col[2], GOLD);
  say('或 reuse 空下來的空間：Open Addressing');
  await step(tok);                                   // 101:35 證明留給進階課程
  glow(col[2], null);
  nt('性質的證明 → 進階課程', 5.4, 1.2, 3.6);
  say('hash function、probing 性質的證明', '留給進階的課程');
}]);

// 120:40 有 collision 時要把 key 和 value 一起存
FRAG.push(['hashlin2-store-key', 'Collision 時 key 要跟 value 一起存', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(5, 2.2, -2.6, null, -0.85);
  T.cw = 1.9;
  let a = null, b = null, q = null;
  await step(tok);                                   // 120:40 同一格拿哪個值？
  say('問：collision 後用 linked list', '同一格有好幾個值，要拿哪一個？');
  await step(tok);                                   // 121:01 完美世界
  a = hlChain(T, 3, '電話A', C8[0], true);
  say('如果世界很完美：沒有任何 collision');
  await step(tok);                                   // 121:06 不用存 key
  say('存東西時不用存 key', '只要把 value 存進去');
  await step(tok);                                   // 121:12 位置是你專屬的
  bub('這格專屬於你', T.xs[3], 1.6, T.z);
  say('反正那個位置是你專屬的');
  await step(tok);                                   // 121:21 有 collision → 對證件
  b = hlChain(T, 3, '電話B', C8[2], true);
  q = kid('Bob', C8[5], -5.2, 1.8, 0.6);
  await go(tok, q.g, T.xs[3] - 2.6, 0, 0.3, 800);
  glow(a, GOLD); glow(b, GOLD); q.mood('wow');
  say('有 collision 時：要找 Bob 的東西', '兩個 value，像要「對證件」');
  await step(tok);                                   // 121:38 key 跟 value 一起存
  glow(a, null); glow(b, null);
  relabel(a, 'Amy｜電話A'); relabel(b, 'Bob｜電話B');
  say('所以一般會把 key 跟 value 一起存');
  await step(tok);                                   // 121:44 不會拿到別人的
  glow(a, RED); await beat(tok, 500); glow(a, null); glow(b, GREEN); q.mood('happy');
  say('檢查 key：才不會拿到別人的東西', 'Amy 的不是；Bob 的才拿走');
  await step(tok);                                   // 121:52 共用櫃子
  say('比喻：一堆人共用一個櫃子');
  await step(tok);                                   // 121:59 貼名字
  nt('貼名字／學號', T.xs[3] + 1.8, 1.2, T.z);
  say('櫃子上總要貼姓名或學號', '這就是把 key 一起存');
}]);

// 127:06 Load factor n/k：太大、或 hash non-uniform，hash 就不 work
FRAG.push(['hashlin2-load', 'Load factor n/k 與 non-uniform', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, 0]);
  let T = null, bars = [];
  const show = (cnts) => { bars.forEach(kill); bars = cnts.map((n, i) => n ? cube(n, C8[i % 8], [0.8, Math.max(0.2, n * 0.08), 0.8], T.xs[i], Math.max(0.2, n * 0.08) / 2 + 0.12, T.z, 2) : null).filter(Boolean); };
  await step(tok);                                   // 127:06 講完基本 hash、collision handling
  say('講完基本的 hash 與 collision handling');
  await step(tok);                                   // 127:14 什麼時候做得好
  say('回顧：Hash table 什麼時候會做得好？');
  await step(tok);                                   // 127:24 Hash／Hashtable
  nt('Hashtable：table 就是那個 array', -4.0, 2.8, -2.6);
  say('有時叫 Hash，有時叫 Hashtable', 'table 對應到我們的 array');
  await step(tok);                                   // 127:46 K 格
  T = hlRow(10, 1.15, 1.6);
  tag('k 格', 'ptr', -6.6, 0.9, T.z);
  say('Hashtable 有 k 個 entry：k 格');
  await step(tok);                                   // 127:53 放 N 個 key
  show([1, 0, 1, 0, 1, 1, 0, 0, 1, 0]);
  say('在 k 格裡放了 n 個 key', '這裡 n = 5、k = 10');
  await step(tok);                                   // 128:02 n / k
  tag('n / k', 'ptr alt', 0, 2.8, 0);
  say('我們看的是 n 除以 k');
  await step(tok);                                   // 128:11 每格放多少，越小越好
  say('大概是每一格要放多少個 key', '希望越小越好：0.5 不太會撞');
  await step(tok);                                   // 128:24 太大常撞
  say('n/k 太大的話：常常撞在一起', '每種 collision 處理都變得不好做');
  await step(tok);                                   // 128:48 Load Factor
  tag('load factor = n / k', 'ptr', 0, 3.6, 0);
  say('n/k 叫做 Load Factor：表塞得有多滿');
  await step(tok);                                   // 129:01 large → won't work
  show(new Array(10).fill(10));
  no('n/k = 10', 5.6, 1.4, T.z);
  say('n/k 很大：hash won\'t work', 'n = 100、k = 10：每格 10 個');
  await step(tok);                                   // 129:21 口罩例子
  say('回到口罩的例子', '只有 2 格，人又非常多、擠同一天');
  await step(tok);                                   // 129:45 non-uniform
  say('另一種情況：hash 是 non-uniform', '沒有分散開來');
  await step(tok);                                   // 130:10 只集中在少數格
  show([0, 34, 0, 0, 33, 0, 0, 33, 0, 0]);
  say('n 還是那麼多，但只集中在少數幾格');
  await step(tok);                                   // 130:19 100 筆集中 3 格
  bars.forEach((b) => glow(b, RED));
  say('100 筆只集中在 3 格', '每格 30 幾個：碰撞很嚴重');
  await step(tok);                                   // 130:34 另一種不 work
  say('n/k 太大，或 hash 不 uniform', '都是要小心的地方');
}]);

// 131:00 改 hash function、增加格子；K > N：空間換時間
FRAG.push(['hashlin2-space', '格子比 key 多：空間換時間', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.2, -2.6, null, -0.85);
  const keys = [3, 7, 11, 2, 6, 9];
  let U = null;
  await step(tok);                                   // 131:00 常塞同一格？
  keys.forEach((k) => hlChain(T, k % 4, k));
  T.ch[3].forEach((c) => glow(c, RED));
  say('實務上要檢查：hash 是不是常塞同一個地方？');
  await step(tok);                                   // 131:07 改進 hash function
  T.ch[3].forEach((c) => glow(c, null));
  say('是的話：改變或改進 hash function', '讓它更亂、更分散');
  await step(tok);                                   // 131:18 太多、格子太少
  say('又或者：東西太多、格子太少', '6 個 key、4 格：chain 變長');
  await step(tok);                                   // 131:30 只能增加格子
  U = hlRow(16, 0.78, 2.2);
  keys.forEach((k) => { const c = T.ch[k % 4].shift(); move(c, U.xs[k], 0.45, U.z); });
  say('東西就是這麼多：只能把格子增加', 'k = 16：x mod 16');
  await step(tok);                                   // 131:44 不可能 10 格塞 100 萬
  nt('10 格塞不下 100 萬筆', -4.4, 1.4, -0.6);
  say('不可能用 10 格塞下 100 萬筆資料');
  await step(tok);                                   // 132:02 K 比 N 大
  say('甚至希望 k 比 n 大', '浪費一點空間：有的格子沒人放');
  await step(tok);                                   // 132:12 一人一格
  ok('一人一間：幾乎沒有 collision', 0, 1.6, 3.4);
  say('k 比 n 大又夠分散：真的一人一格');
  await step(tok);                                   // 132:27 空間換時間
  tag('用空間換取時間', 'ptr alt', 0, 2.6, 0.4);
  say('這叫用空間換取時間');
  await step(tok);                                   // 132:42 跟 integer array 一樣方便
  say('map 就跟 integer array 一樣方便', '算出 index 就知道放哪、拿哪');
}]);

// 132:58 Hash table 要長大：n/k 太大 → k 變兩倍，range 改成 0～2k−1，再 rebuild
FRAG.push(['hashlin2-grow', 'Load 太大：table 長大兩倍', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.2, -3.0, null, -0.85);
  const st = tag('n = 0, k = 4', 'ptr alt', 5.6, 1.4, -3.0);
  const keys = [5, 9, 2, 12, 7, 14];
  let U = null;
  const add = (from, to) => { for (let i = from; i < to; i++) hlChain(T, keys[i] % 4, keys[i], null, true); txt(st, 'n = ' + to + ', k = 4'); };
  await step(tok);                                   // 132:58 實際系統建了 Hashtable
  const sys = prop('monitor', -5.8, 0, -3.2, 0.8, '系統'); bob(sys, 0.03);
  say('實際的系統裡建了一個 Hashtable');
  await step(tok);                                   // 133:07 一開始還好
  add(0, 2);
  say('一開始資料量不多、客戶不多：還好');
  await step(tok);                                   // 133:14 越來越多 不堪負荷
  add(2, 6);
  say('資料量越來越多：開始不堪負荷');
  await step(tok);                                   // 133:24 像 vector 塞滿
  nt('像 vector 塞到滿了', -4.6, 1.6, 1.0);
  say('很像 vector：塞到滿了還要再塞');
  await step(tok);                                   // 133:31 要長大
  say('就得 request 更多記憶體：要長大');
  await step(tok);                                   // 133:58 n/k 增加
  say('n 增加 → n/k 跟著增加');
  await step(tok);                                   // 134:07 load factor 太大
  glow(T.slots[1], RED); glow(T.slots[2], RED);
  say('load factor 太大', 'n/k = 6/4 = 1.5');
  await step(tok);                                   // 134:16 increase k
  say('那就乾脆 increase k', '更大的空間處理更多資料');
  await step(tok);                                   // 134:35 naive 做法
  say('先想一個 naive 的做法', '從 vector 學到的經驗');
  await step(tok);                                   // 134:50 新 k = 舊 k × 2
  U = hlRow(8, 1.45, 1.4, null, -0.85);
  txt(st, 'k：4 → 8');
  say('不要一次加一點點：新的 k 設成舊 k 的兩倍');
  await step(tok);                                   // 135:07 h 的 range 要改
  say('要漲兩倍：h(key) 的 range 要改');
  await step(tok);                                   // 135:18 0～2k−1
  tag('h(x) = x mod 8 → 0～2k−1', 'ptr', 0, 2.4, 1.4);
  say('從 0～k−1 改成 0～2k−1', 'Change Range');
  await step(tok);                                   // 135:36 rebuild
  say('然後要 rebuild');
  await step(tok);                                   // 135:47 舊的塞進新表
  for (const k of keys) { const c = T.ch[k % 4].shift(); hlRelayout(T, k % 4); hlMoveTo(U, k % 8, c); await beat(tok, 250); }
  glow(T.slots[1], null); glow(T.slots[2], null);
  say('建一個新表格，把舊表格的東西一個個塞進去', 'n/k = 6/8 = 0.75');
}]);

// 136:02 Full rebuild：n 筆 × O(1) = O(n)，使用者要 long waiting
FRAG.push(['hashlin2-full-cost', 'Full rebuild：O(n) 與 long waiting', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.2, -3.0, null, -0.85), U = hlRow(8, 1.45, 1.4, null, -0.85);
  const keys = [5, 9, 2, 12, 7, 14, 3, 8];
  keys.forEach((k) => hlChain(T, k % 4, k));
  const cnt = tag('搬了 0 筆', 'ptr alt', 5.8, 1.4, -3.0);
  let n = 0;
  const mv = async (ks) => { for (const k of ks) { const c = T.ch[k % 4].shift(); hlRelayout(T, k % 4); hlMoveTo(U, k % 8, c); n++; txt(cnt, '搬了 ' + n + ' 筆'); await beat(tok, 260); } };
  await step(tok);                                   // 136:02 每筆用新 hash 塞進去
  await mv(keys.slice(0, 3));
  say('rebuild：舊的東西一個個拿出來', '用新的 hash 塞塞塞塞進去');
  await step(tok);                                   // 136:15 n 筆 × constant
  await mv(keys.slice(3));
  say('有 n 筆資料，每筆 insert 大約 constant', '→ 要 n 的時間');
  await step(tok);                                   // 136:30 hash 夠平均
  say('如果 hash function 夠平均', '每格只 handle 一點點 collision');
  await step(tok);                                   // 136:42 只有算 hash code 的時間
  say('幾乎沒有 collision 的話', '花的時間只有計算 hash code');
  await step(tok);                                   // 136:50 跟 key 長度有關
  say('那跟 key 的長度有關', '但跟資料量幾乎沒有關係');
  await step(tok);                                   // 137:01 每個 insertion constant
  say('每個 insertion 幾乎是 constant 時間');
  await step(tok);                                   // 137:14 rebuild linear
  tag('full rebuild：O(n)', 'ptr', 0, 2.8, -0.6);
  say('整個 rebuild 就是 linear 的時間');
  await step(tok);                                   // 137:30 load 太大 → 兩倍
  say('通常加條件：load 大於某個地步', '太滿就變大兩倍');
  await step(tok);                                   // 137:41 不常做還好
  say('變兩倍要花一些力氣', '如果不太常做，可能是好的');
  await step(tok);                                   // 137:48 缺點
  say('不過這裡也有一個缺點');
  await step(tok);                                   // 137:56 整個搬：linear
  say('整個舊的 Hashtable 搬到新地方', '要花 linear 的力氣');
  await step(tok);                                   // 138:07 Long Waiting
  tag('Long Waiting', 'ptr alt', 0, 3.6, -0.6);
  say('對使用者來說：Long Waiting');
  await step(tok);                                   // 138:17 等很久，系統中斷
  const u = buddy('使用者', '', C8[4], -5.8, 0, 3.4, 0.6); u.mood('sad');
  say('使用者要等很久', '系統要中斷一段時間');
  await step(tok);                                   // 138:29 店面整理
  const shop = prop('warehouse', 5.6, 0, 3.4, 0.9, '整理中，請稍候'); bob(shop, 0.03);
  say('像店面說：等一下，我先關門整理', '整理完才開店');
  await step(tok);                                   // 138:43 整個表重建
  say('因為整個表、整個 array 都重新建', '所有東西都改過');
}]);

// 138:52 Partial rebuild 的關鍵：mod k → mod 2k，只差一個 bit
FRAG.push(['hashlin2-mod2k', 'mod k 換成 mod 2k：一半不用動', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.0, -3.0, null, -0.85), U = hlRow(8, 1.45, 1.4, null, -0.85);
  tag('mod 4', 'ptr', -5.8, 0.9, -3.0); tag('mod 8', 'ptr', -6.4, 0.9, 1.4);
  const codes = [8, 13, 6, 3, 12, 5, 10, 15];
  codes.forEach((k) => hlChain(T, k % 4, k));
  const mv = async (ks, col) => { for (const k of ks) { const c = hlTake(T, k % 4, k); hlMoveTo(U, k % 8, c); glow(c, col); await beat(tok, 300); } };
  await step(tok);                                   // 138:52 解決 long waiting？
  say('能不能稍微解決 long waiting？');
  await step(tok);                                   // 139:00 full rebuild 造成
  say('long waiting 是 full rebuild 造成的', '整個表重建');
  await step(tok);                                   // 139:06 Partial Rebuild
  tag('Partial Rebuild', 'ptr alt', 0, 2.6, -1.0);
  say('想法：Partial Rebuild', '只改一些應該改的地方');
  await step(tok);                                   // 139:26 兩倍大小、換 hash
  say('步驟類似：大小變兩倍、換 hash function');
  await step(tok);                                   // 139:34 只 rebuild 有問題的
  say('但 rebuild 時，只 rebuild 有問題的 entry', '不用整個表重建');
  await step(tok);                                   // 139:50 新舊 hash 有關係
  say('要做到：新、舊 hash function 一定要有關係');
  await step(tok);                                   // 140:07 整個換 → 都得搬
  no('整個換掉 → 什麼都得搬', 4.6, 1.4, -3.0);
  say('如果整個換掉 hash function', '無論如何都得把東西搬來搬去');
  await step(tok);                                   // 140:18 hash code mod k
  say('想像：h = hash code 直接 mod k');
  await step(tok);                                   // 140:41 k → 2k 差一個 bit
  nt('k → 2k：只差一個 bit', 0, 3.4, -1.0);
  say('從 k 換成 2k：基本上只差一個 bit');
  await step(tok);                                   // 141:01 跟原來有關聯
  say('除以 2k 的結果，跟原來除以 k 的結果有關聯', 'x mod 2k ∈ {x mod k, x mod k + k}');
  await step(tok);                                   // 141:10 0～k−1：一致
  await mv(codes.filter((k) => k % 8 < 4), GREEN);
  say('結果在 0～k−1 的：跟原來的 hash value 一致', '綠色：位置不變');
  await step(tok);                                   // 141:18 k～2k−1 才變
  await mv(codes.filter((k) => k % 8 >= 4), GOLD);
  say('只有落在 k～2k−1 的會有變化', '金色：搬到原位置 + 4');
}]);

// 141:34 例子：4 格 chain table，hash code = key[0] − 'a'；insert egg → [0] 太滿
const WD = [['at', 0], ['eat', 4], ['bird', 1], ['good', 6], ['cat', 2], ['dog', 3]];
const wcol = (w) => C8[(w.charCodeAt(0) - 97) % 8];
FRAG.push(['hashlin2-words', '例子：hash code = key[0] − \'a\'，mod 4', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.6]);
  let T = null, egg = null;
  const put = (w, hc) => hlChain(T, hc % 4, w, wcol(w), true);
  await step(tok);                                   // 141:34 4 格 hash table
  T = hlRow(4, 2.6, -2.8, null, -0.85); T.cw = 1.5;
  say('例子：一個 hash table 有 4 格', 'hash value 是 0、1、2、3');
  await step(tok);                                   // 141:53 簡單的 hash code
  say('用一個簡單一點的 hash code');
  await step(tok);                                   // 141:58 key[0] − 'a'
  tag('hash code = key[0] − \'a\'', 'ptr alt', 0, 2.2, -3.6);
  say('拿 key 的第 0 個字元，減掉 \'a\'');
  await step(tok);                                   // 142:07 看開頭字母
  nt('a→0、b→1、c→2、d→3、e→4…', 4.6, 1.0, -1.6);
  say('其實就是看英文字的開頭字母是第幾個');
  await step(tok);                                   // 142:16 at、eat
  put('at', 0); put('eat', 4);
  say('at（a 開頭）、eat（e 開頭）', 'hash code：0 和 4');
  await step(tok);                                   // 142:27 mod 4 → 0
  say('mod 4 之後：都對應到 [0]', '0 mod 4 = 4 mod 4 = 0');
  await step(tok);                                   // 142:32 bird、good、cat
  put('bird', 1); put('good', 6); put('cat', 2);
  say('[1]：bird；[2]：good、cat', 'good：6 mod 4 = 2');
  await step(tok);                                   // 142:44 dog
  put('dog', 3);
  say('[3]：dog', '這是原來的 hash table');
  await step(tok);                                   // 142:55 放新的覺得太滿
  say('放了一個新東西進來', '覺得太滿了，想要 rebuild');
  await step(tok);                                   // 143:17 egg → 0
  egg = kid('egg', wcol('egg'), -5.6, 1.6, 0.55);
  say('insert egg：e 開頭', '一樣要放到 [0]');
  await step(tok);                                   // 143:25 用 linked list 畫
  say('為了簡單：用 linked list 的方式來畫');
  await step(tok);                                   // 143:30 egg 放進來
  remove(egg.g); put('egg', 4);
  say('egg 放到 [0] 這條 chain');
  await step(tok);                                   // 143:38 已經兩個，第三個影響效率
  T.ch[0].forEach((c) => glow(c, RED));
  say('這條 chain 本來已經 2 個', '再放第 3 個可能影響效率：太滿了');
  await step(tok);                                   // 143:46 變大兩倍
  say('那就讓 Hashtable 變大兩倍');
}]);

// 143:54 Full rebuild 成 8 格：拜訪每個 key；eat、egg → [4]、good → [6]
FRAG.push(['hashlin2-full8', 'Full rebuild：mod 4 → mod 8', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  const T = hlRow(4, 2.0, -3.2, null, -0.85);
  T.cw = 1.4;
  const all = [['at', 0], ['eat', 4], ['egg', 4], ['bird', 1], ['good', 6], ['cat', 2], ['dog', 3]];
  all.forEach(([w, hc]) => hlChain(T, hc % 4, w, wcol(w)));
  let U = null;
  const mv = async (ws, col) => { for (const [w, hc] of ws) { const c = hlTake(T, hc % 4, w); hlMoveTo(U, hc % 8, c); glow(c, col); await beat(tok, 300); } };
  await step(tok);                                   // 143:54 多了 4、5、6、7
  U = hlRow(8, 1.5, 1.0, null, -0.85); U.cw = 1.2;
  [4, 5, 6, 7].forEach((i) => glow(U.slots[i], GOLD));
  say('表長兩倍：多了 4、5、6、7');
  await step(tok);                                   // 144:05 Full Rebuild
  [4, 5, 6, 7].forEach((i) => glow(U.slots[i], null));
  say('Full Rebuild：每一個都要重新看');
  await step(tok);                                   // 144:13 mod 4 → mod 8
  tag('mod 4 → mod 8', 'ptr alt', 0, 2.2, -1.2);
  say('原來是 mod 4，現在變成 mod 8');
  await step(tok);                                   // 144:26 a b c d 留在原位
  await mv(all.filter(([, hc]) => hc < 4), GREEN);
  say('a、b、c、d 開頭的：hash code 0～3', '留在原來的位置');
  await step(tok);                                   // 144:32 eat、good 需要移動
  T.ch.flat().forEach((c) => glow(c, GOLD));
  say('哪些要移動？原來的 eat 和 good');
  await step(tok);                                   // 144:46 eat、good 移動
  await mv([['eat', 4], ['good', 6]], GOLD);
  say('整個重算之後：eat → [4]、good → [6]');
  await step(tok);                                   // 144:54 egg 塞進來
  await mv([['egg', 4]], GOLD);
  say('egg 也塞進 [4]');
  await step(tok);                                   // 145:04 拜訪過每一個
  say('拜訪過每一個東西', '才知道哪些要移動、哪些要重建');
  await step(tok);                                   // 145:11 full rebuild 的複雜度
  tag('full rebuild：O(n)', 'ptr', 0, 3.0, -1.2);
  say('這就是 Full Rebuild 面臨的計算複雜度');
}]);

// 145:16 Partial rebuild：只拆 overflow 的 [0] → [0]、[4]；5、6、7 先指回原 chain
FRAG.push(['hashlin2-partial', 'Partial rebuild：只拆滿出來的那條', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  const U = hlRow(8, 1.5, -2.6, null, -0.85);
  U.cw = 1.25;
  [['at', 0], ['eat', 0], ['egg', 0], ['bird', 1], ['good', 2], ['cat', 2], ['dog', 3]].forEach(([w, i]) => hlChain(U, i, w, wcol(w)));
  let cur = null;
  await step(tok);                                   // 145:16 Partial Rebuild
  tag('Partial Rebuild', 'ptr alt', 0, 2.4, -3.6);
  say('如果走的是 Partial Rebuild 呢？');
  await step(tok);                                   // 145:27 繼續用這張圖
  [4, 5, 6, 7].forEach((i) => glow(U.slots[i], GOLD));
  say('一樣長成 8 格，繼續用這張圖');
  await step(tok);                                   // 145:35 good 還沒滿，留原處
  glow(U.ch[2][0], GREEN);
  say('good 這條還沒滿', '先不移動：good 就留在原處');
  await step(tok);                                   // 145:45 滿的是長度 3 的
  glow(U.ch[2][0], null); U.ch[0].forEach((c) => glow(c, RED));
  say('滿的是長度已經 3 的這條', '只重建這一條');
  await step(tok);                                   // 145:52 eat、egg → [4]
  for (const w of ['eat', 'egg']) { const c = hlTake(U, 0, w); hlMoveTo(U, 4, c); glow(c, GOLD); await beat(tok, 450); }
  U.ch[0].forEach((c) => glow(c, null));
  say('把 eat、egg 拿出來，放到 [4]', 'at 留在 [0]');
  await step(tok);                                   // 146:04 good 不用動，那要怎麼找？
  say('good 不用動', '那等一下找 good 時要從哪裡進來？');
  await step(tok);                                   // 146:11 從 6 進來
  cur = tag('get(good)', 'ptr alt', U.xs[6], 1.8, U.z);
  say('good 的 hash code 是 6', '要從 [6] 這邊進來');
  await step(tok);                                   // 146:19 小紙條連過來
  [5, 6, 7].forEach((j) => arrow(V3(U.xs[j], 0.35, U.z + 0.6), V3(U.xs[j - 4] + 0.7, 0.45, U.z + 1.0), 0xc08a1f));
  await go(tok, cur, U.xs[2] + 0.4, 1.4, U.z + 1.05, 900); glow(U.ch[2][0], GREEN);
  say('把 [6] 的小紙條連到 [2]', '[7] 連到 [3]、[5] 連到 [1]');
  await step(tok);                                   // 146:28 還沒分家，共用
  glow(U.ch[2][0], null);
  nt('1、2、3 和 5、6、7：還沒分家', 0, 1.6, 2.6);
  say('1、2、3 和 5、6、7 還沒分家', '繼續用原來已經連好的資料');
  await step(tok);                                   // 146:47 只有 overflow 才分家
  ok('只有 overflow 的 [0] 分家', -3.8, 1.6, 3.4);
  say('只有在 overflow 的地方，才把事情拆開分家');
}]);

// 146:56 成本：k + n/k vs n；extendable hash table
FRAG.push(['hashlin2-cost', 'Partial rebuild：k + n/k 比 n 小', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.4, 0]);
  let mini = null;
  await step(tok);                                   // 146:56 egg 讓 0 滿出來
  mini = hlRow(8, 0.9, -3.4); mini.cw = 0.8;
  ['at', 'eat', 'egg'].forEach((w) => hlChain(mini, 0, w, wcol(w)));
  mini.ch[0].forEach((c) => glow(c, RED));
  say('egg 塞進來：發現 [0] 這條滿出來了');
  await step(tok);                                   // 147:08 拆成 0 跟 4
  for (const w of ['eat', 'egg']) { const c = hlTake(mini, 0, w); glow(c, null); hlMoveTo(mini, 4, c); }
  mini.ch[0].forEach((c) => glow(c, null));
  say('滿出來就分家：[0] 拆成 [0]、[4] 兩條');
  await step(tok);                                   // 147:25 其他共用原來的 chain
  say('其他的先不拆：共用原來的 chain', '用其他 data structure 也能這樣做');
  await step(tok);                                   // 147:32 花多少時間
  say('這樣要花多少時間？');
  await step(tok);                                   // 147:39 k 的力氣：小紙條
  cube('k', C8[0], [1.4, 0.6, 1.2], 2.2, 0.3, 0.6, 3); tag('接小紙條', 'idx', 2.2, 1.1, 1.8);
  say('k 的力氣：接好那些小紙條');
  await step(tok);                                   // 147:49 n/k：分家
  cube('n/k', C8[2], [1.4, 0.6, 1.2], 2.2, 0.9, 0.6, 3); tag('拆 overflow 的那條', 'idx', 2.2, 1.7, 1.8);
  say('n/k 的力氣：把 overflow 的那條分家', '一條大約 n/k 個');
  await step(tok);                                   // 148:02 比 n 小
  cube('n', C8[4], [1.4, 4.0, 1.2], -4.9, 2.0, 0.6, 0); tag('full rebuild', 'ptr', -4.9, 4.6, 0.6); tag('partial', 'ptr', 2.2, 2.2, 0.6);
  nt('例：n = 10000、k = 100 → 10000 vs 200', 0, 0.3, 3.4);
  say('k + n/k 可能比 n 小很多', 'n 不少的時候');
  await step(tok);                                   // 148:09 Extendable Hash Table
  tag('Extendable Hash Table', 'ptr alt', 0, 5.4, 0.6);
  say('只用 Partial Rebuild 就做出', '可以 Extendable 的 Hash Table');
  await step(tok);                                   // 148:23 跟 extendable array 一樣
  say('分析上跟 extendable array 一樣', '表長兩倍');
  await step(tok);                                   // 148:38 怎麼 rebuild
  say('操作上更複雜的是：怎麼 rebuild', '怎麼放到新 table 該放的位置');
  await step(tok);                                   // 148:44 full rebuild 只是 slow
  say('full rebuild：除了 slow、long waiting', '沒什麼一定不好');
  await step(tok);                                   // 148:58 partial 等待短
  say('partial rebuild：等待時間短一些', '空間利用也許好一些');
  await step(tok);                                   // 149:07 要 maintain 還沒分家的
  say('代價：要多寫程式', 'maintain 還沒分家的在哪、要分家的搬去哪');
  await step(tok);                                   // 149:18 一般做法
  say('這就是 extendable hash table 一般的做法');
}]);

// 153:38 / 157:51 / 163:33 總結：藍 hash code、橘 compress、紅 collision handling、綠 open addressing、桃紅 extendable
FRAG.push(['hashlin2-recap', 'Hash table 總整理', async (tok) => {
  const part = (ctx.params || {}).part || 0;
  fresh([0, 8, 12], [0, 0.6, 0.2]);
  const key = cube('key', C8[1], [1.0, 0.6, 0.9], -6.2, 0.3, -3.0, 3);
  const hc = cube('HashCode', '#4b9ee2', [2.2, 0.7, 1.0], -3.9, 0.35, -3.0, 3);
  const cp = cube('Compress', '#dd8238', [2.2, 0.7, 1.0], -1.0, 0.35, -3.0, 3);
  const co = cube('Collision', '#c0392b', [2.2, 0.7, 1.0], 2.1, 0.35, -3.0, 3);
  const ex = cube('Extendable', '#e55a9b', [2.2, 0.7, 1.0], 5.2, 0.35, -3.0, 3);
  [[-5.6, -5.1], [-2.7, -2.2], [0.2, 0.9], [3.3, 4.0]].forEach(([a, b]) => arrow(V3(a, 0.4, -3.0), V3(b, 0.4, -3.0)));
  const opts = [['0 不理他', -0.2], ['1–3 secondary', 2.1], ['4 open addr.', 4.4]].map(([s, x], i) => cube(s, i === 2 ? '#2fc092' : C8[i + 5], [2.0, 0.6, 0.9], x, 0.3, -0.6, 3));
  opts.forEach((o) => arrow(V3(2.1, 0.3, -2.4), V3(o.position.x, 0.4, -1.1), 0x7a1010));
  const oa = [['linear', 2.6], ['quadratic', 4.4], ['double', 6.1]].map(([s, x]) => cube(s, '#0f8a5a', [1.6, 0.5, 0.8], x, 0.25, 1.8, 3));
  const H = (arr, c) => arr.forEach((m) => glow(m, c));
  const p1 = async () => {
    await step(tok);                                 // 153:56 summarize
    say('最後幾分鐘：把整個 Hash table 串起來');
    await step(tok);                                 // 154:33 像 array：index → value
    const T = hlRow(5, 1.2, 3.4); cube('v', C8[3], [0.8, 0.5, 0.8], T.xs[2], 0.35, T.z, 2);
    say('出發點：像 array 一樣', '用 index 把 value 放到對應的格子');
    await step(tok);                                 // 154:56 key 不是 integer、沒 order
    H([key], GOLD);
    say('可是 key 不是 integer、沒有 order', '甚至是 variable length');
    await step(tok);                                 // 155:19 HashCode
    H([hc], GOLD);
    say('解法：先把 key 轉成 integer', '這叫 HashCode（HC）');
    await step(tok);                                 // 155:30 範圍很大
    say('HashCode 範圍很大', '放不進大小合理的 array');
    await step(tok);                                 // 155:44 Compress
    H([key], null); H([cp], GOLD);
    say('再限制到 k 的範圍：Compress');
    await step(tok);                                 // 155:55 HashCode + Compress
    say('Hash table 的 scheme：HashCode + Compress');
    await step(tok);                                 // 156:06 目的：分散
    H([cp], null);
    say('HashCode 最重要的目的：分散', '用上 array 裡的每一個位置');
    await step(tok);                                 // 156:42 sum、polynomial
    say('variable length string：加起來（sum）', '或 polynomial：更注意字的位置');
    await step(tok);                                 // 157:03 cyclic shift
    say('或更複雜的 cyclic shift');
    await step(tok);                                 // 157:11 不同 key → 不同 hashcode
    say('目的：不同的 key 盡量對到不同的 HashCode', '一樣的話就會擠同一格');
    await step(tok);                                 // 157:28 Mode K
    H([hc], null); H([cp], GOLD);
    say('Compress 只講了一種：mod k');
  };
  const p2 = async () => {
    await step(tok);                                 // 157:42 另一個麻煩
    say('但實際上還有另一個麻煩');
    await step(tok);                                 // 157:47 已經有人了
    say('要放進去時，那格已經 occupied');
    await step(tok);                                 // 157:57 Collision
    H([co], GOLD);
    say('這就是 Collision');
    await step(tok);                                 // 158:15 影響 get／search
    say('insert 時怎麼處理', '會影響之後 get、search 怎麼找');
    await step(tok);                                 // 158:35 error tolerant
    H([opts[0]], GOLD);
    say('這次新講的：error tolerant（不理他）', '容許有些資料被丟掉');
    await step(tok);                                 // 159:09 不一定 error free
    say('Data structure 不一定要 error free', '錯誤可控制，在有些應用就有用');
    await step(tok);                                 // 159:23 1 array、2 linked list、3 secondary
    H([opts[0]], null); H([opts[1]], GOLD);
    say('1 array、2 linked list、3 其他 container', '統稱 secondary data structure');
    await step(tok);                                 // 160:06 array 變小紙條
    say('array 變成只是指向 secondary 的小紙條');
    await step(tok);                                 // 160:27 Hierarchical
    say('Hashtable 先分成小包小包', 'Hierarchical 的 data structure design');
    await step(tok);                                 // 160:47 Open Addressing
    H([opts[1]], null); H([opts[2]], GOLD);
    say('花最多力氣的：Open Addressing', '不 create 額外空間，reuse 現有空間');
    await step(tok);                                 // 161:35 get routine 也改
    say('get 也要改', '他可能坐第 0～第 5 順位，都要去找');
    await step(tok);                                 // 162:01 linear、quadratic、double
    H(oa, GOLD);
    say('找下一個位置：linear、quadratic、double', '讓各順位在 array 上四散開');
    await step(tok);                                 // 162:41 藍橘紅綠
    H([opts[2], ...oa], null); H([hc, cp, co, opts[2]], GOLD);
    say('藍 HashCode → 橘 Compress', '→ 紅 Collision Handling → 綠 Open Addressing');
    await step(tok);                                 // 163:11 design 要想這幾件事
    say('設計 hash table 要想：', 'hash code、compress、collision scheme、哪種 open addressing');
  };
  const p3 = async () => {
    await step(tok);                                 // 163:33 Extendable Hashtables
    H([ex], GOLD);
    say('最後補充：Extendable 的 Hashtable');
    await step(tok);                                 // 164:04 另一種 collision handling
    arrow(V3(2.1, 0.8, -2.6), V3(4.6, 0.8, -2.6), 0x7a1010);
    say('可以看成另一種 Collision Handling scheme');
    await step(tok);                                 // 164:15 越來越滿就長大
    say('越來越滿：乾脆把 Hash Table 長大一點', '長大以後 collision 就少一點');
    await step(tok);                                 // 164:32 linked list 例子
    say('例子：用 linked list 當 secondary 的 Hashtable');
    await step(tok);                                 // 164:45 naive／partial
    say('兩種做法：naive 和 partial');
    await step(tok);                                 // 164:59 full rebuild vs 只 rebuild overflow
    nt('naive：Full Rebuild｜partial：只拆 overflow', 3.6, 1.6, 1.0);
    say('naive：Full Rebuild', 'partial：只有滿出來的地方才 rebuild');
    await step(tok);                                 // 165:20 partial 的好處、巧思
    say('partial 有一些好處', '但需要一些巧思：演算法設計');
    await step(tok);                                 // 165:34 double the table
    say('還用到了 double the table', 'extendable array 學過的 trick');
    await step(tok);                                 // 166:15 桃紅色：延伸
    say('桃紅色是延伸：靜態 design 上面就講完了', '實務上 table 會長大');
    await step(tok);                                 // 166:52 bigger picture
    H([key, hc, cp, co], GOLD);
    say('Hash 講到的所有事情，這樣串在一起');
  };
  if (part === 1) await p1(); else if (part === 2) await p2(); else if (part === 3) await p3();
  else { await p1(); await p2(); await p3(); }
}]);
  }

  // ═══ hashpeng.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, code, line, arrow, ghostBox, step, buddy, travel, remove, prop, bob, GOLD, GREEN, RED, GRAY } = K;
// ─── bULIs7AVDNk（交大彭文志 Lec23 Hashing，洪逸／Horowitz 第 8 章 ＋ 第 10 章開頭） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; the
// beats after it are only the motion (short), then the picture holds.
const say = (a, b = '') => ctx.say(a, b);
const PP = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const ppCol = (k) => PP[[...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0) % PP.length];
const ppSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const ppLet = (k) => k.charCodeAt(0) - 65; // h(x) = 第一個字母的順序（A = 0）
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// a row of m one-slot buckets centred on x = 0 (only the first `show` drawn)
function ppRow(m, dx, z, show = m) {
  const x0 = -(show - 1) * dx / 2, xs = [], slots = [];
  for (let i = 0; i < show; i++) { const x = x0 + i * dx; xs.push(x); slots.push(cube('', GRAY, [dx * 0.9, 0.12, 1.2], x, 0.06, z)); tag(String(i), 'idx', x, 0, z + 1.0); }
  return { m, dx, z, xs, slots, keys: new Array(m).fill(null), vals: new Array(m).fill(null), ks: Math.min(0.9, dx * 0.85) };
}
function ppPut(T, i, k, drop) { const c = cube(k, ppCol(k), [T.ks, 0.7, 0.9], T.xs[i], 0.47, T.z, drop ? 3 : 0); T.keys[i] = c; T.vals[i] = k; return c; }
// one probe: cursor to bucket j; taken → red (false), empty → the key lands (true)
async function ppTry(tok, T, k, j, cur, lbl, ms = 650) {
  cur.position.set(T.xs[j], 2.1, T.z); txt(cur, lbl);
  if (T.keys[j] !== null) { glow(T.keys[j], RED); await beat(tok, ms); return false; }
  ppPut(T, j, k, true); await beat(tok, ms); return true;
}
const ppUnglow = (T) => T.keys.forEach((c) => c && glow(c, null));
// a queue of keys waiting to be inserted (little packets); take(k) removes one
function ppQueue(keys, x0, y, z, dx = 1.0) {
  const q = {}; keys.forEach((k, i) => { q[k] = tag(String(k), 'pkt', x0 + i * dx, y, z); });
  return { take(k) { remove(q[k]); delete q[k]; } };
}

// ════════ 00:00 bucket sort → symbol table：retrieve / insert / delete ════════
FRAG.push(['hashpeng-symtab', 'Symbol table：查表、insert、delete', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const bx = [-4.5, -1.5, 1.5, 4.5];
  const nums = [[5, '101'], [8, '1000'], [6, '110'], [3, '11']];
  await step(tok);                                   // 0:00 bucket sort: numbers dropped into buckets
  ['00', '01', '10', '11'].forEach((b, i) => { cube('', GRAY, [2.4, 0.12, 1.4], bx[i], 0.06, -2.0); tag('bucket ' + b, 'idx', bx[i], 0, -1.0); });
  for (const [n, b] of nums) { cube(n, ppCol(n), [0.8, 0.7, 0.8], bx[parseInt(b.slice(-2), 2)], 0.47, -2.0, 3); await beat(tok, 350); }
  say('Bucket sort：一堆 bucket，把數字丟進去');
  await step(tok);                                   // 0:39 decided by the first or last bits
  nums.forEach(([n, b]) => note(n + ' = ' + b + '₂', bx[parseInt(b.slice(-2), 2)], 1.4, -2.0));
  say('丟進哪個 bucket，看數字的最後幾個 bit', '例：看最後兩個 bit');
  await step(tok);                                   // 0:47 that's the concept of hash
  bub('這就是 hash 的概念', 0, 2.6, 0.4);
  say('這其實就是 hash 的概念');
  await step(tok);                                   // 1:47 in an assembler the most important: symbol table
  fresh([0, 7, 12], [0, 0.8, 0]);
  const pg = prop('file', -5.4, 0, -2.4, 1.0, '組合語言程式'); bob(pg, 0.04);
  prop('cpu', 5.4, 0, -2.4, 0.9, 'machine code');
  tag('symbol table', 'ptr', 0, 2.4, -1.6);
  say('寫 assembler 時最重要的資料結構：symbol table', 'assembler：把組合語言翻成機器碼');
  await step(tok);                                   // 2:16 see INT → look up the table → its machine code
  const R = [['INT', 'machine code']].map(([s, a], i) => [cube(s, PP[0], [2.2, 0.6, 0.8], -1.6, 0.3, -0.6, 3), cube(a, GRAY, [3.0, 0.6, 0.8], 2.2, 0.3, -0.6, 3)]);
  const hand = tag('INT？', 'pkt', -5.4, 1.4, -1.4);
  await travel(tok, hand, V3(-5.4, 1.4, -1.4), V3(-1.6, 1.0, -0.6), 800);
  glow(R[0][1], GREEN); remove(hand);
  say('看到 INT，就去查表，知道它對應的 machine code');
  await step(tok);                                   // 2:34 a directory: matching strings, then the thing they map to
  glow(R[0][1], null);
  [['LOOP', 'address 0100'], ['SUM', 'address 0204']].forEach(([s, a], i) => R.push([cube(s, PP[i + 1], [2.2, 0.6, 0.8], -1.6, 0.3, 0.5 + i * 1.1, 3), cube(a, GRAY, [3.0, 0.6, 0.8], 2.2, 0.3, 0.5 + i * 1.1, 3)]));
  tag('symbol（字串）', 'idx', -1.6, 0.9, -1.4); tag('attribute', 'idx', 2.2, 0.9, -1.4);
  say('symbol table 像一個目錄', '左邊是字串（symbol），右邊是對應的 attribute');
  await step(tok);                                   // 3:09 this is called retrieve
  glow(R[0][0], GOLD); glow(R[0][1], GREEN);
  good('retrieve', 4.6, 1.0, -0.6);
  say('用 key 找出對應的 attribute，叫 retrieve');
  await step(tok);                                   // 3:17 a huge table: how to find it fast?
  glow(R[0][0], null); glow(R[0][1], null);
  for (let i = 0; i < 3; i++) { const a = cube('…', GRAY, [2.2, 0.4, 0.6], -1.6, 0.2, 2.8 + i * 0.75); const b = cube('…', GRAY, [3.0, 0.4, 0.6], 2.2, 0.2, 2.8 + i * 0.75); [a, b].forEach((m) => { m.material.transparent = true; m.material.opacity = 0.45; }); }
  bub('筆數很多時，怎麼很快找到？', -5.0, 1.2, 2.8);
  say('表很大、筆數很多時，怎麼很快找到要的那筆？');
  await step(tok);                                   // 3:30 modify: insert or delete
  const n1 = cube('NEW', PP[5], [2.2, 0.6, 0.8], -5.2, 0.3, 0.5, 4); glow(n1, GREEN);
  fly(R[2][0]); fly(R[2][1]);
  say('table 也要能修改：insert 一筆、delete 一筆');
  await step(tok);                                   // 3:49 is a phone book a table? yes
  bub('通訊錄也是 table：名字 → 電話', 4.4, 2.4, 1.6);
  say('通訊錄也是這種 table');
  await step(tok);                                   // 4:04 a database is also a kind of symbol table
  bub('database 也是一種 symbol table', 4.4, 1.6, 2.6);
  say('之後會看到：database 也是一種 symbol table');
  await step(tok);                                   // 4:21 operations: insert, delete, search
  ['insert', 'delete', 'search'].forEach((t, i) => tag(t, i === 2 ? 'ptr alt' : 'idx', -1.6 + i * 2.0, 2.4, -2.8));
  say('這種 table 都要做：insert、delete、search');
}]);

// ════════ 04:35 search：O(n)、binary search、hash ════════
FRAG.push(['hashpeng-search-cost', 'Search：O(n)、O(log n)、hash 的 O(1)', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const K8 = ['D', 'A', 'F', 'C', 'H', 'B', 'G', 'E'], X = (i) => -5.25 + i * 1.5;
  const cs = {}; let cur;
  await step(tok);                                   // 4:35 search; the dumbest way…
  K8.forEach((k, i) => { cs[k] = cube(k, ppCol(k), [1.2, 0.7, 1.0], X(i), 0.35, -2.2, 2); });
  cur = tag('', 'ptr alt', X(0), 1.6, -2.2);
  say('最常做的運算：search', '要找 G');
  await step(tok);                                   // 4:42 worst case: look at every record → O(n)
  for (let i = 0; i <= 6; i++) { cur.position.set(X(i), 1.6, -2.2); txt(cur, '第 ' + (i + 1) + ' 次'); glow(cs[K8[i]], i === 6 ? GREEN : GOLD); await beat(tok, 280); if (i < 6) glow(cs[K8[i]], null); }
  note('worst case O(n)', 5.6, 1.4, -2.2);
  say('最笨的方法：一筆一筆看', '最差要全部看過 → O(n)');
  await step(tok);                                   // 4:52 sort the records first
  glow(cs.G, null);
  [...K8].sort().forEach((k, i) => move(cs[k], X(i), 0.35, -2.2));
  await beat(tok, 900);
  say('先把 table 排序');
  await step(tok);                                   // 5:00 then binary search — still not fast enough
  for (const [i, k, ok] of [[3, 'D', 0], [5, 'F', 0], [6, 'G', 1]]) { cur.position.set(X(i), 1.6, -2.2); txt(cur, ok ? '找到' : '往右'); glow(cs[k], ok ? GREEN : GOLD); await beat(tok, 550); if (!ok) glow(cs[k], null); }
  note('O(log n)', 5.6, 0.7, -2.2);
  say('再用 binary search：O(log n)', '還是不夠快');
  await step(tok);                                   // 5:08 hash: two keys. First: decide the key
  bub('Hash 的兩個關鍵', -4.6, 2.6, 0.2);
  say('另一種方法：hash', '兩個關鍵，第一個：要 hash 的 key 是什麼');
  await step(tok);                                   // 5:18 e.g. a phone book: the name
  const cols = ['名字', '公司', '電話', '地址'];
  const row = cols.map((c, i) => cube(c, i === 0 ? PP[0] : GRAY, [1.5, 0.5, 0.8], -2.4 + i * 1.6, 0.25, 0.4, 2));
  glow(row[0], GOLD); note('key = 名字', -2.4, 1.1, 0.4);
  say('例：通訊錄用「名字」當 key');
  await step(tok);                                   // 5:46 second: decide the hash function
  const hb = ghostBox('#c08a1f', 1.8, 1.2, 1.4); hb.position.set(-4.6, 0.6, 2.8);
  tag('hash function？', 'ptr', -4.6, 1.6, 2.8);
  say('第二個關鍵：用哪一個 hash function');
  await step(tok);                                   // 5:56 different hash functions → different effects
  bub('不同 hash function → 效果不同', 1.6, 1.8, 2.0);
  say('選不同的 hash function，效果會不一樣');
  await step(tok);                                   // 6:09 insert / delete / search: just one function evaluation
  const bk = [0, 1, 2, 3].map((i) => { cube('', GRAY, [1.4, 0.12, 1.2], -0.8 + i * 1.7, 0.06, 3.4); tag('bucket ' + i, 'idx', -0.8 + i * 1.7, 0, 4.4); return -0.8 + i * 1.7; });
  const k = tag('G', 'pkt', -6.6, 1.0, 2.8);
  await travel(tok, k, V3(-6.6, 1.0, 2.8), V3(-4.6, 1.0, 2.8), 600);
  await travel(tok, k, V3(-4.6, 1.0, 2.8), V3(bk[2], 0.8, 3.4), 800);
  say('只要算一次 function，就知道資料在哪個 bucket');
  await step(tok);                                   // 6:27 so it's constant time
  good('insert / delete / search：constant time', 2.0, 1.4, 4.6);
  say('所以 hash 的 insert、delete、search 都是常數時間');
}]);

// ════════ 06:41 static vs dynamic hashing ════════
FRAG.push(['hashpeng-static-dynamic', 'Static hashing 與 dynamic hashing', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const sx = [-5.4, -4.2, -3.0, -1.8];
  let d;
  await step(tok);                                   // 6:41 two kinds: static hash, dynamic hash
  tag('static hashing', 'ptr', -3.6, 3.4, -1); tag('dynamic hashing', 'ptr alt', 3.6, 3.4, -1);
  say('Hash 分兩大類：static 與 dynamic');
  await step(tok);                                   // 6:54 static: once decided, the function stays
  sx.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  note('h(x) 決定後就固定', -3.6, 2.6, -1);
  say('Static：hash function 一旦決定就一成不變');
  await step(tok);                                   // 7:08 no matter how the data are distributed
  for (let n = 0; n < 4; n++) { cube('', PP[n], [0.8, 0.5, 0.8], sx[1], 0.37 + n * 0.55, 0, 3); await beat(tok, 350); }
  say('不管資料怎麼分佈，都照同一個 h 丟', '資料偏向某一格也照樣丟進去');
  await step(tok);                                   // 7:32 dynamic: what is dynamic?
  const b = cube('', GRAY, [2.2, 0.12, 1.2], 3.6, 0.06, 0);
  d = [0, 1, 2].map((n) => cube('', PP[n + 4], [0.6, 0.5, 0.8], 2.9 + n * 0.7, 0.37, 0, 3));
  say('Dynamic：動態的 hash');
  await step(tok);                                   // 7:42 adjusts the hash function to the data distribution
  kill(b);
  cube('', GRAY, [1.4, 0.12, 1.2], 2.6, 0.06, 0); cube('', GRAY, [1.4, 0.12, 1.2], 4.6, 0.06, 0);
  move(d[0], 2.3, 0.37, 0); move(d[1], 2.9, 0.37, 0); move(d[2], 4.6, 0.37, 0);
  await beat(tok, 700);
  say('依資料的分佈，自動調整 hash function', '滿了就分裂，bucket 跟著資料長');
  await step(tok);                                   // 8:04 static part: common hash functions
  bub('常用的 hash function', -3.6, 1.2, 2.4);
  say('Static 部分：介紹常用的 hash function');
  await step(tok);                                   // 8:19 collision / overflow handling
  bub('collision、overflow 怎麼處理', -3.6, 0.4, 3.4);
  say('還有遇到 collision、overflow 時怎麼處理');
  await step(tok);                                   // 8:26 dynamic: a tree called trie
  bub('trie（一種樹）', 3.6, 1.2, 2.4);
  say('Dynamic 部分：trie 這種資料結構');
  await step(tok);                                   // 8:33 directoryless hashing
  bub('directoryless', 3.6, 0.4, 3.4);
  say('以及 directoryless 的做法');
  await step(tok);                                   // 8:42 dynamic hash → database course
  good('database 常用 dynamic hashing', 3.6, 2.4, 1.2);
  say('Database 的 hash 會隨資料改變', '所以常用 dynamic hashing');
}]);

// ════════ 09:04 h(x)、b 個 bucket、s 個 slot、兩種 density ════════
FRAG.push(['hashpeng-density', 'b 個 bucket、每個 s 格：identifier density 與 loading density', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.8, 0]);
  const b = 6, s = 2, xs = [...Array(b)].map((_, i) => -2.75 + i * 1.5), sz = (j) => -0.6 + j * 1.1;
  const slots = [], idx = [];
  const ks = ['x₁', 'x₂', 'x₃', 'x₄'], pk = {};
  await step(tok);                                   // 9:04 identifier = key
  ks.forEach((k, i) => { pk[k] = tag(k, 'pkt', -6.2, 2.6 - i * 0.7, -2.0); });
  note('identifier = key', -6.0, 3.4, -2.0);
  say('identifier（識別子）就是 key');
  await step(tok);                                   // 9:21 which bucket does x go in?
  xs.forEach((x, i) => { for (let j = 0; j < s; j++) slots.push(cube('', GRAY, [1.2, 0.1, 0.9], x, 0.05, sz(j))); idx.push(tag(String(i), 'idx', x, 0, 1.4)); });
  say('資料 x 要放進哪一個 bucket（籃子）？');
  await step(tok);                                   // 9:30 a function h decides: h(x)
  const fx = bub('h(x) 決定放哪個 bucket', 0, 2.6, -2.0);
  say('由一個函數 h 來決定：h(x)');
  await step(tok);                                   // 9:51 data x comes in → put it in bucket h(x)
  const put = [['x₁', 4, 0], ['x₂', 1, 0], ['x₃', 4, 1], ['x₄', 0, 0]], cs = {};
  for (const [k, h, j] of put) { pk[k].element.textContent = k + ' → ' + h; await travel(tok, pk[k], pk[k].position.clone(), V3(xs[h], 0.6, sz(j)), 450); remove(pk[k]); cs[k] = cube(k, ppCol(k), [0.9, 0.6, 0.8], xs[h], 0.4, sz(j)); }
  say('資料 x 就放進 h(x) 算出來的 bucket');
  await step(tok);                                   // 10:09 know how it is placed → know how to search
  bub('怎麼放，就怎麼找', 0, 2.0, -3.0);
  say('知道怎麼放，就知道怎麼找');
  await step(tok);                                   // 10:36 search x: compute h(x), look in that bucket
  const cur = tag('h(x₃) = 4', 'ptr alt', xs[4], 2.0, 0);
  glow(cs['x₃'], GREEN);
  say('找 x₃：一樣算 h(x₃) = 4，到 bucket 4 裡找');
  await step(tok);                                   // 10:56 a bucket holds at most s records
  glow(cs['x₃'], null); remove(cur);
  tag('slot 1', 'idx', -4.6, 0, sz(0)); tag('slot 2', 'idx', -4.6, 0, sz(1));
  note('每個 bucket 最多放 s 筆（s = 2）', -3.0, 1.2, 2.6);
  say('每個 bucket 最多放 s 筆 record', '這裡 s = 2');
  await step(tok);                                   // 11:06 the table has b buckets
  note('共 b 個 bucket（b = 6）', 3.0, 1.2, 2.6);
  say('hash table 有 b 個 bucket', '這裡 b = 6');
  await step(tok);                                   // 11:14 h(x) is always between 0 and b − 1
  idx.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('所以 h(x) 的值一定在 0 ～ b − 1');
  await step(tok);                                   // 11:32 identifier density
  remove(fx);
  bub('identifier density = n / T', 0, 3.0, -2.6);
  say('identifier density = n / T');
  await step(tok);                                   // 11:41 n = keys in the table; T = all possible keys
  note('n = 表裡的 key 數 = 4', -2.6, 2.2, -2.6); note('T = 所有可能的 key 個數', 2.6, 2.2, -2.6);
  say('n：表裡現在有的 key 數；T：所有「可能」的 key 個數');
  await step(tok);                                   // 12:09 loading density / loading factor
  bub('loading density α = n / (s·b)', 0, 3.4, 3.4);
  say('loading density（loading factor）', 'α = n / (s·b)');
  await step(tok);                                   // 12:24 b buckets × s each → can hold s·b records
  slots.forEach((m) => glow(m, GOLD));
  say('表總共能放 s × b = 2 × 6 = 12 筆');
  await step(tok);                                   // 12:32 only n are used: how full the table is
  slots.forEach((m) => glow(m, null));
  good('α = 4 / 12 = 1/3：表佔用了三分之一', 0, 2.6, 4.2);
  say('現在只用了 n = 4 筆', 'α = 4 / 12 = 1/3：表被佔用的比例');
}]);

// ════════ 13:09 collision vs overflow ════════
FRAG.push(['hashpeng-collide-overflow', 'Collision 與 overflow：s = 1 時同時發生', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const L = [-5.6, -3.6, -1.6], R = [1.8, 3.4, 5.0];
  L.forEach((x, i) => { cube('', GRAY, [1.8, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  tag('bucket size s = 2', 'ptr', -3.6, 3.2, -1);
  let i1, i2;
  await step(tok);                                   // 13:09 first situation: two data i₁ and i₂
  i1 = buddy('i₁', '', PP[0], -5.0, 0, -2.6, 0.55); i2 = buddy('i₂', '', PP[1], -2.6, 0, -2.6, 0.55);
  say('兩筆資料：i₁、i₂');
  await step(tok);                                   // 13:19 h(i₁) = h(i₂)
  note('h(i₁) = 1', -5.0, 1.6, -2.6); note('h(i₂) = 1', -2.6, 1.6, -2.6);
  say('hash 的結果一樣：h(i₁) = h(i₂)');
  await step(tok);                                   // 13:40 both grab the same bucket → collision
  await Promise.all([travel(tok, i1.g, V3(-5.0, 0, -2.6), V3(-4.05, 0.12, 0), 900), travel(tok, i2.g, V3(-2.6, 0, -2.6), V3(-3.15, 0.12, 0), 900)]);
  i1.mood('wow'); i2.mood('wow');
  tag('collision', 'ptr alt', -3.6, 2.2, 0);
  say('兩個都要搶 bucket 1 → collision');
  await step(tok);                                   // 13:52 enough space for both → no problem
  i1.mood('happy'); i2.mood('happy');
  good('還有空位 → 沒問題', -3.6, 1.5, 1.4);
  say('bucket 有足夠空間放兩筆 → 沒有問題');
  await step(tok);                                   // 14:08 the bucket is already full → overflow
  const i3 = buddy('i₃', '', PP[2], -3.6, 1.4, 0, 0.55); i3.glow(RED); i3.mood('sad');
  bad('滿了，放不下 → overflow', -3.6, 3.0, 1.0);
  say('要塞進去時 bucket 已經滿了 → overflow');
  await step(tok);                                   // 14:24 collision always happens with hash
  bub('collision：用 hash 就一定會發生', 0, 2.6, -3.4);
  say('collision 和 overflow 不一樣', '用 hash 就一定會有 collision');
  await step(tok);                                   // 14:37 overflow depends on whether the bucket is full
  bub('overflow：要看 bucket 滿了沒', 0, 1.8, -3.4);
  say('overflow 要看 bucket 滿了沒');
  await step(tok);                                   // 14:45 bucket size s = 1
  R.forEach((x, i) => { cube('', GRAY, [1.2, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  tag('bucket size s = 1', 'ptr alt', 3.4, 3.2, -1);
  buddy('j₁', '', PP[3], R[1], 0.12, 0, 0.55);
  say('如果 bucket size s = 1');
  await step(tok);                                   // 14:50 collision ⇒ overflow
  const j2 = buddy('j₂', '', PP[4], R[1] + 2.0, 0, -2.4, 0.55);
  await travel(tok, j2.g, V3(R[1] + 2.0, 0, -2.4), V3(R[1], 1.2, 0), 800);
  j2.glow(RED); j2.mood('sad');
  bad('collision ＝ overflow', R[1], 2.9, 1.0);
  say('一發生 collision 就一定 overflow', 'bucket 只能放一個');
  await step(tok);                                   // 15:19 s = 1: both at the same time
  good('s = 1 時，collision 和 overflow 同時發生', 0, 0.5, 3.4);
  say('bucket size = 1 時，兩者同時發生');
}]);

// ════════ 15:26 26 個 bucket、s = 2：GA, D, A, G, L, A2, A1, A3, A4 ════════
FRAG.push(['hashpeng-letters26', '26 個 bucket、s = 2：A1 開始 overflow', async (tok) => {
  fresh([0, 10, 10.5], [0, 0.3, 0.4]);
  const X = (i) => -6.3 + (i % 13) * 1.05, Z = (i) => (i < 13 ? -1.4 : 2.2);
  const keys = ['GA', 'D', 'A', 'G', 'L', 'A2', 'A1', 'A3', 'A4'];
  const cnt = new Array(26).fill(0), bs = [], cs = {};
  let Q;
  const drop = (k) => { const h = ppLet(k); Q.take(k); cs[k] = cube(k, ppCol(k), [0.85, 0.5, 0.85], X(h), 0.35 + cnt[h] * 0.55, Z(h), 3); cnt[h]++; };
  await step(tok);                                   // 15:26 a very simple hash table
  for (let i = 0; i < 26; i++) { bs.push(cube('', GRAY, [0.95, 0.1, 1.0], X(i), 0.05, Z(i))); }
  say('來看一個很簡單的 hash table');
  await step(tok);                                   // 15:41 hash by alphabet order: A → bucket 0
  glow(bs[0], GOLD); tag('A → 0', 'ptr alt', X(0), 1.2, Z(0));
  say('hash function：照英文字母順序', 'A 是第一個字母 → bucket 0');
  await step(tok);                                   // 15:58 26 letters → buckets 0 … 25
  glow(bs[0], null);
  for (let i = 0; i < 26; i++) tag(String(i), 'idx', X(i), 0, Z(i) + 0.9);
  say('26 個字母 → 26 個 bucket，編號 0 ～ 25', '（字幕把 b = 26 聽成「bucket size 20」）');
  await step(tok);                                   // 16:08 each bucket holds at most two
  note('s = 2：每個 bucket 最多放 2 筆', 3.4, 1.4, -3.4);
  say('每個 bucket 最多只能放兩筆資料');
  await step(tok);                                   // 16:14 data: GA, D, A, G, L, A2, A1, A3, A4
  Q = ppQueue(keys, -6.0, 1.0, -3.4, 0.95);
  say('依序放入：GA, D, A, G, L, A2, A1, A3, A4');
  await step(tok);                                   // 16:24 GA: the 7th letter → bucket 6
  drop('GA');
  say('GA：G 是第 7 個字母 → bucket 6');
  await step(tok);                                   // 16:33 D: the 4th → bucket 3
  drop('D');
  say('D：第 4 個字母 → bucket 3');
  await step(tok);                                   // 16:42 and so on
  for (const k of ['A', 'G', 'L', 'A2']) { drop(k); await beat(tok, 450); }
  say('依此類推：A → 0、G → 6、L → 11、A2 → 0');
  await step(tok);                                   // 16:52 buckets 0 and 6 are full; A1, A3, A4 → bucket 0
  glow(bs[0], RED); glow(bs[6], RED);
  say('bucket 0 和 bucket 6 都塞滿了', '後面的 A1、A3、A4 都要進 bucket 0');
  await step(tok);                                   // 17:02 but it's full → overflow
  for (const k of ['A1', 'A3', 'A4']) { Q.take(k); const c = cube(k, RED, [0.85, 0.5, 0.85], X(0) + 0.3, 1.9, Z(0)); glow(c, RED); await beat(tok, 400); fly(c, V3(-2, 6, -3)); }
  bad('overflow！', X(0) + 1.4, 1.6, Z(0) - 0.9);
  say('bucket 0 已經滿了 → overflow');
  await step(tok);                                   // 17:21 data can't be thrown away → must be handled
  bub('資料不能丟 → 需要處理 overflow 的方法', 0, 2.6, 0.4);
  say('這些資料不能丟掉', '要有處理 overflow 的方法（後面會講）');
}]);

// ════════ 17:59 uniform hash function ════════
FRAG.push(['hashpeng-uniform', 'Uniform hash function：每格機率 1/b', async (tok) => {
  fresh([0, 7, 12], [0, 1, 0]);
  const xa = [-5.4, -4.2, -3.0, -1.8], xb = [1.8, 3.0, 4.2, 5.4];
  xa.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  xb.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  const right = [], left = [];
  await step(tok);                                   // 17:59 a hash function should not be too complex
  bub('hash function 不要太複雜', 0, 4.4, -2.0);
  say('設計 hash function：第一，不要太複雜');
  await step(tok);                                   // 18:06 goal: collision probability as small as possible
  bub('目標①：collision 越少越好', 0, 3.6, -2.0);
  say('目標：發生 collision 的機率越小越好');
  await step(tok);                                   // 18:21 every bucket evenly: no bucket gets much more
  bub('目標②：每個 bucket 平均', 0, 2.8, -2.0);
  say('第二：每個 bucket 的資料要平均', '不要某些 bucket 特別多');
  await step(tok);                                   // 18:49 each record thrown evenly into every bucket
  tag('uniform', 'ptr alt', 3.6, 4.4, 0.4);
  for (let n = 0; n < 8; n++) { right.push(cube('', PP[n], [0.8, 0.45, 0.8], xb[n % 4], 0.35 + Math.floor(n / 4) * 0.5, 0, 3)); await beat(tok, 260); }
  say('希望每筆資料進來，都平均丟到每個 bucket');
  await step(tok);                                   // 19:04 such a function: uniform hash function
  good('uniform hash function', 3.6, 3.0, 1.6);
  say('做得到的話，叫 uniform hash function');
  await step(tok);                                   // 19:18 b buckets: each with probability 1/b
  note('P(丟到第 i 格) = 1/b', 3.6, 2.2, 2.4);
  say('b 個 bucket：丟到每一格的機率都是 1/b');
  await step(tok);                                   // 19:30 skewed extreme: always bucket 0
  tag('skewed（極端）', 'ptr', -3.6, 4.4, 0.4);
  for (let n = 0; n < 6; n++) { left.push(cube('', PP[n], [0.8, 0.45, 0.8], xa[0], 0.35 + n * 0.5, 0, 3)); await beat(tok, 300); }
  say('反例：每一次都丟到 bucket 0', '其他 bucket 都空著');
  await step(tok);                                   // 19:43 bad: overflows easily, others idle
  left.slice(2).forEach((c) => glow(c, RED));
  bad('很快 overflow，其他 bucket 閒著', -3.6, 1.4, 2.0);
  say('這種 hash function 不好：很快就 overflow');
  await step(tok);                                   // 19:50 best: every bucket's space used well
  right.forEach((c) => glow(c, GREEN));
  say('最好：每個 bucket 的空間都被善用');
  await step(tok);                                   // 20:08 probability exactly 1/b — the ideal
  bub('機率剛好 1/b：這是理想', 3.6, 1.2, 3.2);
  say('每格機率剛好 1/b，不過那是理想');
}]);

// ════════ 20:16 mid-square 與 division（M = 2^i 不好） ════════
FRAG.push(['hashpeng-midsq-div', 'Mid-square 與 division：除以 2ⁱ 只看最後 i 個 bit', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const bits = '10101001', bx = (i) => -2.8 + i * 0.8;
  let bs;
  await step(tok);                                   // 20:16 first form: mid-square
  tag('① mid-square', 'ptr', -4.6, 2.2, -2.2);
  cube('13', PP[0], [1.0, 0.7, 0.9], -5.4, 0.35, -2.2, 3); tag('x', 'idx', -5.4, 0, -1.3);
  say('第一種 hash function：mid-square（平方取中）');
  await step(tok);                                   // 20:28 the key written in binary
  note('13 = 1101₂', -5.4, 1.4, -2.2);
  say('key 先用二進位表示', '例：x = 13 = 1101₂');
  await step(tok);                                   // 20:39 take the middle bits
  note('課本：先平方 13² = 169 = 10101001₂', 0.6, 1.5, -3.0);
  bs = [...bits].map((b, i) => cube(b, GRAY, [0.7, 0.6, 0.8], bx(i), 0.3, -2.2, 3));
  await beat(tok, 500);
  [3, 4].forEach((i) => glow(bs[i], GOLD));
  say('取中間的幾個 bit 當 bucket 編號', '取中間 2 個：01₂ → bucket 1');
  await step(tok);                                   // 20:50 how many: not fixed
  [2, 5].forEach((i) => glow(bs[i], GOLD));
  say('取幾個 bit 不限定', '取 4 個：1010₂ → bucket 10（表就要 2⁴ = 16 格）');
  await step(tok);                                   // 20:57 …then square
  bad('老師口述「取中間再平方」；課本是「先平方再取中間」', 1.8, 2.4, -1.0);
  say('注意順序：課本是先平方，再取中間');
  await step(tok);                                   // 21:08 second: division, mod
  tag('② division', 'ptr alt', -4.6, 1.2, 0.2);
  bub('h(x) = x mod M', -1.6, 1.2, 0.2);
  say('第二種：division（除法），h(x) = x mod M', '取除以 M 的餘數');
  await step(tok);                                   // 21:32 M = 2ⁱ, i = 1 → mod 2: only two buckets
  [0, 1].forEach((i) => { cube('', GRAY, [1.6, 0.12, 1.2], 3.0 + i * 2.0, 0.06, 2.0); tag('bucket ' + i, 'idx', 3.0 + i * 2.0, 0, 3.0); });
  say('如果 M = 2ⁱ，例如 i = 1 → M = 2', '只有 bucket 0、bucket 1 兩個');
  await step(tok);                                   // 21:50 A1, B1, C1 all fall into the same bucket
  const keys = [['A1', '100001'], ['B1', '101001'], ['C1', '110001']];
  const rows = keys.map(([k, b], r) => [cube(k, ppCol(k), [0.9, 0.6, 0.8], -6.2, 0.3, 1.0 + r * 1.0, 3), [...b].map((c, i) => cube(c, GRAY, [0.55, 0.5, 0.8], -5.0 + i * 0.62, 0.25, 1.0 + r * 1.0, 3))]);
  await beat(tok, 500);
  rows.forEach((r) => glow(r[1][5], RED));
  say('A1、B1、C1 的最後一個 bit 都是 1');
  await step(tok);                                   // 22:05 the last bit is 1 → result 1
  rows.forEach((r, i) => move(r[0], 5.0, 0.42 + i * 0.6, 2.0));
  await beat(tok, 900);
  say('x mod 2 就是最後一個 bit → 全部落在 bucket 1');
  await step(tok);                                   // 22:21 fills up fast: as if no hash at all
  bad('很快就滿：有用 hash 跟沒用差不多', 4.0, 2.6, 3.4);
  say('M = 2 只有兩個 bucket，很快就滿', '有用 hash 跟沒用差不多');
  await step(tok);                                   // 22:29 M need not be a power of 2: 10, 15 …
  note('老師：M 也可以用 10、15｜課本：M 選質數', 0, 3.4, -0.6);
  say('老師說 M 不必是 2 的次方，也可用 10、15', '但 10、15 有小質因數；課本建議 M 選質數');
}]);

// ════════ 22:58 folding：shift 與 boundary ════════
FRAG.push(['hashpeng-fold', 'Folding：shift 699、boundary 897', async (tok) => {
  fresh([0, 6, 13], [0, 2.8, 0]);
  const s = '12320324111220', segs = ['123', '203', '241', '112', '20'];
  const colX = (c) => 1.8 + (c - 1) * 0.62, rowY = (r) => 4.6 - r * 0.75;
  let D = [], sum = [];
  const digitsOf = (r) => D.slice(r * 3, r * 3 + segs[r].length);
  const place = (r, rev) => { const ds = digitsOf(r), n = segs[r].length; ds.forEach((c, d) => move(c, colX(3 - n + (rev ? n - 1 - d : d)), rowY(r), 0)); };
  const total = (str) => { sum.forEach(kill); sum = [...str].map((d, i) => cube(d, '#c08a1f', [0.5, 0.5, 0.5], colX(i), rowY(5) - 0.1, 0, 3)); };
  await step(tok);                                   // 22:58 third: folding
  tag('③ folding', 'ptr', -5.6, 6.4, 0);
  say('第三種 hash function：folding（折疊）');
  await step(tok);                                   // 23:13 segment first, then operate on the segments
  bub('先切段（segment），再把各段加起來', 0, 6.6, -1.0);
  say('把 key 先切成一段一段，再對各段做運算');
  await step(tok);                                   // 23:21 example: x = 12320324111220
  D = [...s].map((d, i) => cube(d, PP[Math.floor(i / 3) % PP.length], [0.5, 0.5, 0.5], -4.2 + i * 0.62, 5.6, 0, 2));
  tag('x', 'idx', -5.0, 5.6, 0);
  say('例：x = 12320324111220');
  await step(tok);                                   // 23:51 three digits per segment → five segments
  D.forEach((c, i) => move(c, -5.4 + Math.floor(i / 3) * 2.3 + (i % 3) * 0.55, 5.6, 0));
  await beat(tok, 800);
  say('每 3 位一段（也可以 4 位）', '切成 123 | 203 | 241 | 112 | 20 五段');
  await step(tok);                                   // 24:03 add the five segments up
  segs.forEach((_, r) => place(r, false));
  await beat(tok, 900);
  tag('+', 'ptr', colX(-1), rowY(4), 0);
  say('第一種：五段直接相加（像直式加法）');
  await step(tok);                                   // 24:19 shift folding = 699
  total('699');
  good('shift folding = 699', -2.6, 1.0, 0);
  say('shift folding = 699', '123 + 203 + 241 + 112 + 20 = 699');
  await step(tok);                                   // 24:30 second: folding at the boundaries
  bub('像摺紙：沿著邊界對折', -3.6, 3.4, 0);
  say('第二種：folding at the boundaries（邊界折疊）');
  await step(tok);                                   // 25:00 folded over: the digits read backwards
  [1, 3].forEach((r) => { digitsOf(r).forEach((c) => glow(c, GOLD)); place(r, true); });
  await beat(tok, 900);
  say('摺過去的段，數字會顛倒', '203 → 302、112 → 211；241、20 不變');
  await step(tok);                                   // 26:08 123 + 302 + 211 + 241 + 20
  total('897');
  good('boundary folding = 897', -2.6, 0.3, 0);
  say('123 + 302 + 241 + 211 + 20 = 897', '（老師口述時 241／142 一度說反）');
  await step(tok);                                   // 26:38 different from shift folding
  bad('699 ≠ 897：兩種折法結果不同', 4.6, 1.0, 0);
  say('跟 shift folding 的結果不一樣');
  await step(tok);                                   // 27:00 the most used: division (mod)
  bub('三種裡最常用的是 division（mod）', 0, 0.0, 1.6);
  say('三種 hash function 裡，最常用的是 division（mod）');
}]);

// ════════ 27:17 overflow 的兩種處理 ════════
FRAG.push(['hashpeng-two-ways', 'Overflow 處理：open addressing 與 chaining', async (tok) => {
  fresh([0, 7, 12], [0, 1, 0]);
  const xa = [-5.4, -4.2, -3.0, -1.8], hx = 3.6;
  xa.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  const a = buddy('A', '', PP[0], xa[0], 0.12, 0, 0.6);
  let a2;
  await step(tok);                                   // 27:17 does overflow happen in hashing?
  a2 = buddy('A2', '', PP[1], xa[0], 1.3, 0, 0.6); a2.glow(RED); a2.mood('sad');
  say('bucket 0 滿了，A2 要放哪？', 'overflow');
  await step(tok);                                   // 27:24 more data → it will overflow
  bub('資料一多，一定會 overflow', -3.6, 3.2, -1.6);
  say('資料一多，overflow 一定會發生');
  await step(tok);                                   // 27:33 two strategies; first: open addressing
  tag('① open addressing', 'ptr', -3.6, 2.4, -1.0);
  say('處理策略有兩種，第一種：open addressing');
  await step(tok);                                   // 27:41 open up other buckets' space
  await travel(tok, a2.g, V3(xa[0], 1.3, 0), V3(xa[1], 0.12, 0), 900);
  a2.glow(null); a2.mood('happy');
  good('開放別的 bucket 給它用', -3.6, 1.6, 1.8);
  say('開放「其他 bucket」的空間給 overflow 的資料用');
  await step(tok);                                   // 28:00 chaining: string them together
  tag('② chaining', 'ptr alt', hx, 2.4, -1.0);
  cube('[0]', GRAY, [1.0, 0.6, 1.0], hx, 0.3, -1.2);
  cube('A', PP[0], [1.0, 0.6, 1.0], hx, 0.3, 0.4, 3);
  arrow(V3(hx, 0.4, -0.7), V3(hx, 0.4, -0.15));
  say('第二種：chaining，顧名思義「串在一起」');
  await step(tok);                                   // 28:17 chaining doesn't open any other bucket
  const c = cube('A2', PP[1], [1.0, 0.6, 1.0], hx, 0.3, 2.0, 3);
  arrow(V3(hx, 0.4, 0.95), V3(hx, 0.4, 1.45));
  say('chaining 不佔用別人的 bucket', 'A2 還是屬於 bucket 0');
  await step(tok);                                   // 28:26 still in this bucket, but queue up (linked list)
  bub('在自己這一格排隊：linked list', hx + 1.6, 1.4, 2.6);
  say('overflow 的資料就排隊吧：用 linked list 串起來');
  await step(tok);                                   // 28:46 open addressing: use others' buckets
  a2.glow(GOLD);
  say('回到 open addressing：用別人的 bucket 放資料');
}]);

// ════════ 28:60 linear open addressing：GA, D, A, G, L, A2, A1（s = 1） ════════
FRAG.push(['hashpeng-lp-letters', 'Linear open addressing：G 放到 7、A1 放到 2', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  let T;
  const cur = tag('', 'ptr alt', 0, 2.1, 0);
  const hover = (j, k) => { const c = cube(k, RED, [0.8, 0.6, 0.8], T.xs[j], 1.5, 0); glow(c, RED); return c; };
  await step(tok);                                   // 28:60 the bucket is full and overflow happens
  T = ppRow(26, 1.0, 0, 13);
  tag('（26 個 bucket，只畫 0～12）', 'idx', 4.4, 2.8, -1.4);
  say('bucket 滿了，又發生 overflow');
  await step(tok);                                   // 29:08 look for an empty bucket nearby
  bub('附近有空的 bucket，就放進去', -3.6, 2.6, -1.4);
  say('最好的方法：看附近有沒有空的 bucket');
  await step(tok);                                   // 29:15 linear probing / linear open addressing
  tag('linear open addressing', 'ptr', 0, 3.4, -1.4);
  say('這叫 linear open addressing', '也就是 linear probing');
  await step(tok);                                   // 29:30 bucket holds only one data (s = 1)
  note('s = 1：每個 bucket 只放 1 筆', 4.4, 2.0, -1.4);
  say('同一個例子，改成每個 bucket 只放一筆', 'h(x) = 第一個字母的順序');
  await step(tok);                                   // 29:38 GA → bucket 6
  await ppTry(tok, T, 'GA', 6, cur, 'h = 6');
  say('GA → bucket 6');
  await step(tok);                                   // 29:50 D at 3, A at bucket 0
  await ppTry(tok, T, 'D', 3, cur, 'h = 3', 500); await ppTry(tok, T, 'A', 0, cur, 'h = 0', 500);
  say('D → bucket 3、A → bucket 0');
  await step(tok);                                   // 30:00 G should go to 6, but it's full
  const hg = hover(6, 'G'); glow(T.keys[6], RED); cur.position.set(T.xs[6], 2.6, 0); txt(cur, 'h(G) = 6');
  say('G 應該放 bucket 6，但已經被 GA 佔了');
  await step(tok);                                   // 30:08 bucket 7 is empty → G goes there
  kill(hg); ppUnglow(T); await ppTry(tok, T, 'G', 7, cur, '往下 → 7');
  say('往下看，bucket 7 是空的 → G 放 7', '空的 bucket 開放給你用');
  await step(tok);                                   // 30:44 L somewhere; where does A2 go?
  await ppTry(tok, T, 'L', 11, cur, 'h = 11');
  say('L → bucket 11；接下來 A2 放哪？');
  await step(tok);                                   // 30:51 bucket 0 is taken by A → A2 to the next
  await ppTry(tok, T, 'A2', 0, cur, 'h = 0', 500); ppUnglow(T);
  await ppTry(tok, T, 'A2', 1, cur, '下一個', 500);
  say('A2：bucket 0 被 A 佔了 → 放下一個 bucket 1');
  await step(tok);                                   // 31:00 A1 comes: bucket 0
  await ppTry(tok, T, 'A1', 0, cur, 'h = 0');
  say('A1 也要放 bucket 0：滿了');
  await step(tok);                                   // 31:11 bucket 1 is also full
  ppUnglow(T); await ppTry(tok, T, 'A1', 1, cur, '1？');
  say('往下到 bucket 1：也滿了');
  await step(tok);                                   // 31:20 bucket 2 is free → A1 goes in
  ppUnglow(T); await ppTry(tok, T, 'A1', 2, cur, '2 空');
  say('再往下，bucket 2 還沒滿 → A1 放進去');
  await step(tok);                                   // 31:52 now: find G
  const q = buddy('找 G', '', ppCol('G'), -6.0, 0, 2.4, 0.6);
  say('問題：要找 G，G 在哪裡？');
  await step(tok);                                   // 32:05 h(G) = 6, but bucket 6 holds GA
  cur.position.set(T.xs[6], 2.1, 0); txt(cur, 'h(G) = 6'); glow(T.keys[6], GOLD);
  say('h(G) = 6，可是 bucket 6 放的是 GA，不是 G');
  await step(tok);                                   // 32:18 don't answer "not here" right away
  bad('不能馬上說「G 不在」！', T.xs[6], 3.0, 0);
  q.mood('wow');
  say('千萬不要馬上回答「G 不在表裡」', '它可能 overflow 到附近了');
  await step(tok);                                   // 32:36 probe: walk a few more steps
  glow(T.keys[6], null); cur.position.set(T.xs[7], 2.1, 0); txt(cur, '找到'); glow(T.keys[7], GREEN);
  q.mood('happy'); await q.hop(tok);
  say('往下多走一步：bucket 7 找到 G', '這就是 linear open addressing 的搜尋');
}]);

// ════════ 33:19 general form：H_i(k) = (h(k) + f(i)) mod ts ════════
FRAG.push(['hashpeng-probe-forms', 'H_i(k) = (h(k) + f(i)) mod ts：linear、quadratic、double', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  const T = ppRow(10, 1.2, 0.6);
  const cur = tag('', 'ptr alt', T.xs[0], 2.1, T.z);
  const cd = code(['H_i(k) = (h(k) + f(i)) mod ts', 'h    = 原本的 hash function', 'f(i) = 第 i 次多跳幾格（offset）', 'ts   = bucket 的個數'], -1.0, 4.4, 0.5, -3.0);
  cd.ls.forEach((l) => { l.element.style.visibility = 'hidden'; });
  const show = (i) => { cd.ls[i].element.style.visibility = ''; cd.hl(i); };
  await step(tok);                                   // 33:19 open addressing can be written more generally
  show(0);
  say('open addressing 可以寫成更一般的式子');
  await step(tok);                                   // 33:42 lowercase h is the original hash function
  show(1);
  ppPut(T, 0, 'A', true);
  cur.position.set(T.xs[0], 2.1, T.z); txt(cur, 'h(k)');
  say('小寫 h 是原本的 hash function', 'h(k) 算出原本要放的 bucket');
  await step(tok);                                   // 34:11 full → not necessarily the next one: an offset
  bub('滿了不一定放隔壁：可以跳一段 offset', 3.4, 2.2, -1.2);
  say('bucket 滿了，不一定放下一個', '可以給它一個 offset，多跳幾格');
  await step(tok);                                   // 34:21 plus f(i), then mod ts
  show(2);
  say('就是加上 f(i)，再 mod ts');
  await step(tok);                                   // 34:35 ts = number of buckets
  show(3);
  note('這裡 ts = 10', T.xs[9], 1.4, T.z - 1.2);
  say('ts 是 bucket 的個數', 'mod ts 讓位置不會超出表');
  await step(tok);                                   // 34:55 f linear → linear probe
  for (let i = 1; i <= 3; i++) { cur.position.set(T.xs[i], 2.1, T.z); txt(cur, 'i = ' + i + '：+' + i); await beat(tok, 450); }
  say('f 是線性函數（f(i) = i）→ linear probe', '1、2、3：一格一格往下');
  await step(tok);                                   // 35:06 probe = ask the neighbour: anyone living here?
  const nb = buddy('A1', '', ppCol('A1'), T.xs[1], 0.12, T.z + 2.2, 0.55);
  bub('「有人住嗎？」沒人就住進去', T.xs[3], 1.6, T.z + 2.4);
  await nb.hop(tok);
  say('probe（試探）：去問鄰居「有沒有人住？」', '有人住，就再問下一個鄰居');
  await step(tok);                                   // 35:39 f can be quadratic: i², jump farther
  for (const i of [1, 2, 3]) { cur.position.set(T.xs[i * i], 2.1, T.z); txt(cur, 'i = ' + i + '：+' + i + '²'); glow(T.slots[i * i], GOLD); await beat(tok, 500); }
  say('f 也可以是 quadratic：f(i) = i²', '一次跳遠一點：+1、+4、+9');
  await step(tok);                                   // 35:53 A1, A2 can be farther away from A
  bub('A1、A2 不必都擠在 A 旁邊', T.xs[5], 2.8, T.z - 1.6);
  say('這樣 A1、A2 可以離 A 遠一點，不會擠成一團');
  await step(tok);                                   // 36:02 double hash: use another hash function
  bub('double hash：再用另一個 hash function 算 offset', 0, 0.4, 3.6);
  say('double hash：hash 不到，就再用另一個 hash function');
}]);

// ════════ 36:16 linear probing：89, 18, 49, 58（mod 10） ════════
FRAG.push(['hashpeng-lp-89', 'Linear probing：89, 18, 49, 58 → 49 在 [0]、58 在 [1]', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  let T, Q;
  const cur = tag('', 'ptr alt', 0, 2.1, -1.0);
  const hover = (j, k) => { const c = cube(k, RED, [0.9, 0.6, 0.8], T.xs[j], 1.5, T.z); glow(c, RED); return c; };
  await step(tok);                                   // 36:16 linear probing: f(i) = i
  T = ppRow(10, 1.2, -1.0);
  tag('linear probing：f(i) = i', 'ptr', -4.6, 2.8, -2.4);
  say('linear probing：f(i) = i');
  await step(tok);                                   // 36:31 H_i(k) = (h(k) + i) mod 10; 10 buckets
  bub('H_i(k) = (h(k) + i) mod 10', 2.6, 2.8, -2.4);
  say('H_i(k) = (h(k) + i) mod 10', 'i = 第幾次 try；表有 10 個 bucket');
  await step(tok);                                   // 36:46 the numbers: 89, 18, 49, 58, 69
  Q = ppQueue([89, 18, 49, 58, 69], -2.0, 1.0, 1.6);
  say('要放的數字：89、18、49、58、69');
  await step(tok);                                   // 37:07 89 mod 10 = 9; 9 + 0 → bucket 9
  Q.take(89); await ppTry(tok, T, 89, 9, cur, 'i = 0');
  say('89：i = 0，(9 + 0) mod 10 = 9 → bucket 9');
  await step(tok);                                   // 37:28 i = 0 is just the original hash function
  note('i = 0：就是原本的 h(k)', T.xs[9] - 1.2, 1.4, T.z - 1.4);
  say('i = 0 時不用套公式，就是原本的 hash function');
  await step(tok);                                   // 37:40 18 → bucket 8
  Q.take(18); await ppTry(tok, T, 18, 8, cur, 'i = 0');
  say('18 → bucket 8');
  await step(tok);                                   // 38:10 49: i = 0 → bucket 9, full → i = 1
  Q.take(49); const h49 = hover(9, 49); glow(T.keys[9], RED); cur.position.set(T.xs[9], 2.6, T.z); txt(cur, 'i = 0');
  say('49：i = 0 → bucket 9，已經滿了', '所以 i 加 1 → i = 1');
  await step(tok);                                   // 38:49 H₁(49) = (9 + 1) mod 10 = 0 → bucket 0
  kill(h49); ppUnglow(T); await ppTry(tok, T, 49, 0, cur, 'i = 1');
  say('H₁(49) = (9 + 1) mod 10 = 0 → bucket 0');
  await step(tok);                                   // 39:00 uppercase H vs lowercase h
  bub('大寫 H_i：第 i 次 probe 的位置　小寫 h：原本的 hash function', 0, 3.6, 0.8);
  say('大寫 H 和小寫 h 不一樣', 'H_i 是 overflow 後第 i 次 probe 的位置');
  await step(tok);                                   // 39:43 58: i = 0 → 8, full
  Q.take(58); const h58 = hover(8, 58); glow(T.keys[8], RED); cur.position.set(T.xs[8], 2.6, T.z); txt(cur, 'i = 0');
  say('58：i = 0，58 mod 10 = 8 → 滿了');
  await step(tok);                                   // 40:01 i = 1 → 9, full
  kill(h58); ppUnglow(T); await ppTry(tok, T, 58, 9, cur, 'i = 1');
  say('i = 1：(8 + 1) mod 10 = 9 → 也滿了');
  await step(tok);                                   // 40:18 i = 2 → 0, full again
  ppUnglow(T); await ppTry(tok, T, 58, 0, cur, 'i = 2');
  say('i = 2：(8 + 2) mod 10 = 0 → 又滿了');
  await step(tok);                                   // 40:37 i = 3 → 1: 58 in bucket 1
  ppUnglow(T); await ppTry(tok, T, 58, 1, cur, 'i = 3');
  say('i = 3：(8 + 3) mod 10 = 1 → 58 放 bucket 1');
  await step(tok);                                   // 40:57 in a program: a for loop
  const P = code(['for (i = 0; ; i++) {', '  b = (h(k) + i) % 10;', '  if (bucket[b] 是空的) break;', '}', 'bucket[b] = k;'], -1.4, 0.4, 0.5, 2.4);
  P.hl(0);
  say('寫程式時：一個 for 迴圈，i 從 0 開始');
  await step(tok);                                   // 41:04 break when an empty bucket is found
  for (const l of [1, 2, 4]) { P.hl(l); await beat(tok, 600); }
  say('每次套公式算 bucket，找到空的就跳出來');
}]);

// ════════ 42:00 primary clustering ════════
FRAG.push(['hashpeng-primary', 'Primary clustering：8、9、0、1 連成一坨', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const T = ppRow(10, 1.2, -0.6);
  const cur = tag('', 'ptr alt', T.xs[9], 2.1, T.z);
  await step(tok);                                   // 42:00 why "linear": + i
  [[9, 89], [8, 18], [0, 49], [1, 58]].forEach(([j, k]) => ppPut(T, j, k, false));
  note('+ i：i 的一次方 → linear', 0, 2.8, -2.2);
  say('為什麼叫 linear？因為加的是 i（一次方）');
  await step(tok);                                   // 42:19 problem: primary clustering
  tag('primary clustering', 'ptr', -3.6, 2.0, -2.2);
  say('問題：primary clustering（主要群聚）');
  await step(tok);                                   // 42:27 more data hashed to the same bucket …
  bub('hash 到同一區的資料越多……', 3.6, 2.0, -2.2);
  say('hash 到同一區的資料越多……');
  await step(tok);                                   // 42:37 … they occupy others' space: a lump
  [8, 9, 0, 1].forEach((j) => glow(T.keys[j], GOLD));
  say('就會佔用到別人的空間，聚成一坨', '8、9、0、1 連成一塊');
  await step(tok);                                   // 42:57 only checks the next bucket each time
  for (const [i, j] of [[0, 9], [1, 0], [2, 1]]) { cur.position.set(T.xs[j], 2.1, T.z); txt(cur, 'i = ' + i); await beat(tok, 450); }
  ppPut(T, 2, 69, true); cur.position.set(T.xs[2], 2.1, T.z); txt(cur, 'i = 3');
  say('每次只往下一個 bucket 檢查', '例：69 要試 9 → 0 → 1 → 2');
  await step(tok);                                   // 43:10 clustering → i grows → more tries
  note('i 變大 = 要 hash 好多次', T.xs[2], 1.3, T.z + 1.8);
  say('一旦聚集，i 就會變大，要多試好幾次');
  await step(tok);                                   // 43:28 jump farther to find an empty bucket
  bub('改進：一次跳遠一點找空 bucket', 0, 1.0, 3.4);
  say('解法：一次不要只找隔壁，跳遠一點');
}]);

// ════════ 43:37 quadratic probing：89, 18, 49, 58, 69 ════════
FRAG.push(['hashpeng-qp-89', 'Quadratic probing：58 → [2]、69 → [3]', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const T = ppRow(10, 1.2, -0.6);
  const cur = tag('', 'ptr alt', 0, 2.1, T.z);
  const hover = (j, k) => { const c = cube(k, RED, [0.9, 0.6, 0.8], T.xs[j], 1.5, T.z); glow(c, RED); return c; };
  const Q = ppQueue([89, 18, 49, 58, 69], -2.0, 1.0, 2.2);
  let pre = [];
  await step(tok);                                   // 43:37 f(i) = i²
  tag('quadratic probing：f(i) = i²', 'ptr', -3.6, 2.8, -2.2);
  say('一次跳遠一點：f(i) = i²');
  await step(tok);                                   // 43:46 i = 1 same as before; i = 2 jumps 4
  pre = [arrow(V3(T.xs[0], 1.2, T.z - 0.9), V3(T.xs[1], 1.2, T.z - 0.9), 0xc08a1f), arrow(V3(T.xs[0], 1.6, T.z - 1.1), V3(T.xs[4], 1.6, T.z - 1.1), 0xc08a1f), tag('+1²', 'idx', T.xs[1], 1.5, T.z - 1.2), tag('+2² = +4', 'idx', T.xs[4], 1.9, T.z - 1.4)];
  say('i = 1 跟原本一樣跳 1 格；i = 2 一次跳 4 格', '指數從 1 變 2 → quadratic');
  await step(tok);                                   // 44:03 a constant in front: 3i², 4i²
  note('也可乘常數：3i²、4i²', 3.6, 2.8, -2.2);
  say('前面也可以乘常數，例如 3i²、4i²');
  await step(tok);                                   // 44:22 H_i(k) = (h(k) + i²) mod 10; 89 → 9
  pre.forEach((o) => (o.element ? remove(o) : kill(o)));
  Q.take(89); await ppTry(tok, T, 89, 9, cur, 'i = 0');
  say('H_i(k) = (h(k) + i²) mod 10', '89 → bucket 9');
  await step(tok);                                   // 44:31 18 → 8
  Q.take(18); await ppTry(tok, T, 18, 8, cur, 'i = 0');
  say('18 → bucket 8');
  await step(tok);                                   // 44:40 49: 9 is full → i = 1
  Q.take(49); const h49 = hover(9, 49); glow(T.keys[9], RED); cur.position.set(T.xs[9], 2.6, T.z); txt(cur, 'i = 0');
  say('49：bucket 9 被佔滿 → i = 1');
  await step(tok);                                   // 44:48 H₁(49) = (9 + 1²) mod 10 = 0
  kill(h49); ppUnglow(T); await ppTry(tok, T, 49, 0, cur, 'i = 1');
  say('H₁(49) = (9 + 1²) mod 10 = 0', '跟 linear 一樣');
  await step(tok);                                   // 44:59 58: bucket 8, then i = 1 → 9
  Q.take(58); const h58 = hover(8, 58); glow(T.keys[8], RED); cur.position.set(T.xs[8], 2.6, T.z); txt(cur, 'i = 0'); await beat(tok, 600);
  kill(h58); ppUnglow(T); await ppTry(tok, T, 58, 9, cur, 'i = 1：+1');
  say('58：bucket 8 滿 → i = 1', '(8 + 1) mod 10 = 9，也滿');
  await step(tok);                                   // 45:27 i = 2: (8 + 4) mod 10 = 2
  ppUnglow(T); await ppTry(tok, T, 58, 2, cur, 'i = 2：+4');
  say('i = 2 → (8 + 2²) mod 10 = 12 mod 10 = 2', '58 放 bucket 2');
  await step(tok);                                   // 45:35 58 jumps more at once
  arrow(V3(T.xs[8], 1.2, T.z - 0.9), V3(T.xs[2], 1.2, T.z - 0.9), 0xc08a1f);
  bub('一次跳比較多格（linear 要先撞 [0] 才放 [1]）', 0, 2.0, 2.6);
  say('58 一次跳比較遠，不用一格一格擠');
  await step(tok);                                   // 45:48 69: bucket 9 is full
  Q.take(69); const h69 = hover(9, 69); glow(T.keys[9], RED); cur.position.set(T.xs[9], 2.6, T.z); txt(cur, 'i = 0');
  say('69：bucket 9 被佔滿');
  await step(tok);                                   // 45:56 i = 1 → 0 full; i = 2
  kill(h69); ppUnglow(T); await ppTry(tok, T, 69, 0, cur, 'i = 1：+1');
  say('i = 1 → bucket 0（49）也滿 → i = 2');
  await step(tok);                                   // 46:04 (9 + 4) mod 10 = 13 mod 10 = 3
  ppUnglow(T); await ppTry(tok, T, 69, 3, cur, 'i = 2：+4');
  say('i = 2 → (9 + 2²) mod 10 = 13 mod 10 = 3', '69 放 bucket 3');
  await step(tok);                                   // 46:14 jumps farther: quadratic probe
  good('跳得比較遠 → 不容易聚成一坨', 0, 1.2, 3.6);
  say('一次跳得比較遠，這就是 quadratic probe');
}]);

// ════════ 46:53 rehash：h₁, h₂, …, h_m ════════
FRAG.push(['hashpeng-rehash-hm', 'Rehash：滿了就換下一個 hash function', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  const T = ppRow(10, 1.2, 0);
  const cur = tag('', 'ptr alt', 0, 2.1, 0);
  let x;
  await step(tok);                                   // 46:53 rehash: use several hash functions
  [3, 7].forEach((j) => ppPut(T, j, j === 3 ? 'p' : 'q', false));
  x = buddy('x', '', PP[4], -5.8, 0, 2.6, 0.6);
  tag('rehash', 'ptr', -4.0, 2.6, -1.4);
  say('Rehash：顧名思義，多用幾個 hash function');
  await step(tok);                                   // 47:05 m hash functions h₁ … h_m
  bub('h₁, h₂, …, h_m', 0, 2.8, -1.4);
  say('準備 m 個 hash function：h₁ ～ h_m');
  await step(tok);                                   // 47:23 i = 1: use h₁ … bucket full
  cur.position.set(T.xs[3], 2.1, 0); txt(cur, 'h₁(x) = 3'); glow(T.keys[3], RED); x.mood('wow');
  say('i = 1：先用 h₁ → bucket 3 已被佔滿');
  await step(tok);                                   // 47:31 i = 2: use h₂
  glow(T.keys[3], null); cur.position.set(T.xs[7], 2.1, 0); txt(cur, 'h₂(x) = 7'); glow(T.keys[7], RED);
  say('i = 2：改用 h₂ → bucket 7 也滿了');
  await step(tok);                                   // 47:43 i = 3: use h₃
  glow(T.keys[7], null); cur.position.set(T.xs[1], 2.1, 0); txt(cur, 'h₃(x) = 1');
  await travel(tok, x.g, V3(-5.8, 0, 2.6), V3(T.xs[1], 0.12, 0), 900);
  x.mood('happy');
  say('i = 3：用 h₃ → bucket 1 是空的，放進去');
  await step(tok);                                   // 47:52 until h_m; it'll be on the exam
  bub('最多試到 h_m｜考古題常考', 0, 1.2, 2.6);
  say('一直試到 h_m 為止', '考試、考古題都會考');
}]);

// ════════ 48:10 chaining：12 個 identifier，平均搜尋長度 2 ════════
FRAG.push(['hashpeng-chain12', 'Chaining：12 個 identifier，平均 24/12 = 2', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const B = [0, 3, 4, 6, 11, 25], X = (h) => -5.5 + B.indexOf(h) * 2.2, Y = (d) => 5.8 - d * 1.05;
  const L = {}; B.forEach((h) => { L[h] = []; });
  const heads = [];
  const dtag = (h, d) => tag(String(d + 1), 'ptr alt', X(h) + 0.8, Y(d) + 0.2, 0);
  await step(tok);                                   // 48:10 chaining
  B.forEach((h) => heads.push(cube('[' + h + ']', GRAY, [1.2, 0.6, 0.8], X(h), 6.9, 0)));
  tag('chaining（其他 bucket 是空的）', 'ptr', 0, 7.9, 0);
  say('另一種 overflow 處理：chaining');
  await step(tok);                                   // 48:20 i.e. a linked list
  bub('chaining = linked list', 4.6, 7.8, 0);
  say('顧名思義，就是 linked list');
  await step(tok);                                   // 48:44 the bucket becomes the head of a linked list
  heads.forEach((c) => glow(c, GOLD));
  say('bucket 變成 linked list 的頭', 'h(x) 一樣是第一個字母的順序');
  await step(tok);                                   // 49:05 things come in → linked on
  heads.forEach((c) => glow(c, null));
  for (const k of ['GA', 'D', 'A', 'G', 'L', 'A2', 'A1', 'A3', 'A4', 'Z', 'ZA', 'E']) {
    const h = ppLet(k), ch = L[h];
    ch.forEach((c, d) => move(c, X(h), Y(d + 1), 0));
    ch.unshift(cube(k, ppCol(k), [1.0, 0.6, 0.8], X(h), Y(0), 0, 2));
    await beat(tok, 200);
  }
  say('資料進來，就串到自己 bucket 的串列上', '12 個 identifier');
  await step(tok);                                   // 49:15 find A3: bucket 0, traverse from the head
  glow(L[0][0], GOLD); await beat(tok, 600); glow(L[0][1], GREEN);
  say('找 A3：只看 bucket 0，從串列的頭開始走', 'A4 → A3：不會用到別人的 bucket');
  await step(tok);                                   // 49:45 a new node is created and attached
  glow(L[0][0], null); glow(L[0][1], null);
  bub('新資料：create 一個新 node 接上去', 4.6, 7.0, 0);
  say('有東西 hash 到這個 bucket，就建一個新 node 接上去');
  await step(tok);                                   // 50:02 average search length of the 12
  bub('平均搜尋長度 = ？', -3.4, 1.0, 0);
  say('全部 insert 完，來算 12 筆資料的平均搜尋長度');
  await step(tok);                                   // 50:21 6 × 1
  B.forEach((h) => dtag(h, 0));
  say('6 筆只要比 1 次（在串列第一個）', '6 × 1');
  await step(tok);                                   // 50:40 3 of length 2
  [0, 6, 25].forEach((h) => dtag(h, 1));
  say('3 筆要比 2 次', '3 × 2');
  await step(tok);                                   // 50:56 one 3, … the worst: A takes 5
  [2, 3, 4].forEach((d) => dtag(0, d));
  glow(L[0][4], RED);
  say('各 1 筆要 3、4、5 次', '最慘的是 A：比 5 次');
  await step(tok);                                   // 51:05 average = 2
  good('(6×1 + 3×2 + 1×3 + 1×4 + 1×5) / 12 = 24 / 12 = 2', 0, 0.3, 0);
  say('平均搜尋長度 = 24 / 12 = 2');
  await step(tok);                                   // 51:12 no other bucket used, but search slows
  bub('不佔別人的 bucket，但要沿串列搜尋', 3.6, 1.0, 0);
  say('chaining 不用別人的 bucket', '但搜尋效能受串列長度影響');
  await step(tok);                                   // 52:02 the hardest: choosing the hash function
  bub('最難：決定 hash function', -3.6, 7.8, 0);
  say('overflow 處理是瓶頸，但最難的是決定 hash function');
  await step(tok);                                   // 52:29 bad hash: one long chain → worst O(n)
  bad('hash 取不好：全掛一串 → worst case O(n)', 0, -0.4, 0);
  say('hash function 取不好：全部掛在同一串', 'worst case O(n)');
}]);

// ════════ 52:39 hash index（database 的 table） ════════
FRAG.push(['hashpeng-hash-index', 'Hash index：用 name 找 Chris', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const cols = ['sid', 'name', 'login', 'age', 'gpa'], cx = (i) => 0.6 + i * 1.35;
  const names = ['Jones', 'Smith', 'Chris'];
  let rows, q;
  const ix = -5.0;
  await step(tok);                                   // 52:39 back to the symbol table
  bub('回想：symbol table', -3.6, 2.6, -3.2);
  say('之前講過的 symbol table');
  await step(tok);                                   // 53:06 login, age, GPA: a database
  cols.forEach((c, i) => tag(c, 'ptr', cx(i), 0.9, -2.4));
  rows = names.map((n, r) => cols.map((c, i) => cube(i === 1 ? n : '…', i === 1 ? ppCol(n) : GRAY, [1.25, 0.5, 0.8], cx(i), 0.25, -1.2 + r * 1.0, 3)));
  say('工作站的 login、年紀、GPA', 'database 最常見的表示方法');
  await step(tok);                                   // 53:14 it's called a table
  tag('table', 'ptr alt', cx(2), 1.7, -2.4);
  say('這叫 table');
  await step(tok);                                   // 53:31 with lots of data it gets hard
  for (let r = 0; r < 2; r++) cols.forEach((c, i) => { const m = cube('…', GRAY, [1.25, 0.4, 0.7], cx(i), 0.2, 1.8 + r * 0.8); m.material.transparent = true; m.material.opacity = 0.4; });
  say('看起來簡單，但資料很多時就難了');
  await step(tok);                                   // 53:45 find Chris (out of 10,000): sid, login, age, gpa
  q = buddy('找 Chris', '', ppCol('Chris'), -6.0, 0, 2.6, 0.6);
  say('要從一萬筆裡找到 Chris，取出他的 sid、login、age、gpa');
  await step(tok);                                   // 54:28 hash index; an index is like a library
  tag('hash index', 'ptr alt', ix + 0.6, 1.4, -2.6);
  bub('index：像圖書館依書名分書架', ix + 0.4, 2.4, -3.4);
  say('一種跟 hash 有關的做法：hash index', 'index（索引）就像圖書館的書架分類');
  await step(tok);                                   // 54:50 a Database book → the D shelf
  note('找「Database」的書 → D 開頭的書架', ix + 0.4, 3.2, -1.6);
  say('要找 Database 的書，就去 D 開頭的書架');
  await step(tok);                                   // 55:10 the shelf is a bucket
  bub('書架 = bucket', ix + 2.6, 2.4, -1.0);
  say('書架就是一個 bucket');
  await step(tok);                                   // 55:28 a hash index on name: Jones, Smith, Chris
  const bk = [[2, 'Chris', 2], [9, 'Jones', 0], [18, 'Smith', 1]];
  const bks = bk.map(([h, n, r], i) => { const z = -1.2 + i * 1.3; cube('[' + h + ']', GRAY, [0.9, 0.5, 0.8], ix, 0.25, z); const c = cube(n, ppCol(n), [1.2, 0.5, 0.8], ix + 1.2, 0.25, z, 3); return { c, z, r }; });
  say('對 name 欄位建 hash index', 'h = 第一個字母順序：C → 2、J → 9、S → 18');
  await step(tok);                                   // 56:06 Chris starts with C → bucket 2
  glow(bks[0].c, GOLD);
  say('Chris 是 C 開頭 → bucket 2');
  await step(tok);                                   // 56:11 search its linked list: Chris found
  glow(bks[0].c, GREEN); q.mood('happy');
  say('在 bucket 2 的串列找到 Chris');
  await step(tok);                                   // 56:18 then a pointer into the file for the other attributes
  arrow(V3(ix + 1.9, 0.4, bks[0].z), V3(cx(1) - 0.7, 0.4, -1.2 + bks[0].r * 1.0), 0x0f5a3a);
  rows[bks[0].r].forEach((c) => glow(c, GREEN));
  say('通常再透過 pointer 到檔案裡', '抓其他 attribute：login、age、gpa');
  await step(tok);                                   // 56:38 performance: minutes without, instant with
  bad('沒 index：查好幾分鐘', 3.4, 2.6, 2.6); good('有 index：一下就出來', 3.4, 1.8, 3.4);
  say('index 影響 database 的效能', '沒建 index 可能查好幾分鐘');
  await step(tok);                                   // 57:04 cardinality = 3 rows, degree = 5 attributes
  note('cardinality = 3（列數）', cx(4) + 0.4, 0.6, -0.2); note('degree = 5（attribute 數）', cx(2), 1.7, -3.2);
  say('cardinality = 列數 = 3', 'degree = attribute 個數 = 5');
}]);

// ════════ 59:56 另一種 index：binary search tree ════════
FRAG.push(['hashpeng-bst-index', '另一種 search structure：對 name 建 BST', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  let root, c, s;
  const rx = 4.4;
  await step(tok);                                   // 59:56 index the data with hash
  bub('hash：對資料建索引的一種方法', 0, 5.0, -1.4);
  say('hash 是對資料「建索引」的一種方法');
  await step(tok);                                   // 60:07 other ways besides hash
  bub('還有別的方法 → 第十章', 0, 4.2, -1.4);
  say('除了 hash，還有其他建索引的方式');
  await step(tok);                                   // 60:24 build a binary search tree
  root = cube('Jones', ppCol('Jones'), [1.3, 0.7, 0.8], -2.5, 3.0, 0, 3);
  say('對 name 建一棵 binary search tree');
  await step(tok);                                   // 60:30 by alphabetical order
  line(-2.5, 3.0, -4.3, 1.4); c = cube('Chris', ppCol('Chris'), [1.3, 0.7, 0.8], -4.3, 1.4, 0, 3);
  line(-2.5, 3.0, -0.7, 1.4); s = cube('Smith', ppCol('Smith'), [1.3, 0.7, 0.8], -0.7, 1.4, 0, 3);
  say('依英文字母順序：小的放左邊、大的放右邊', 'Chris < Jones < Smith');
  await step(tok);                                   // 60:38 a search structure
  tag('search structure', 'ptr alt', -2.5, 4.2, 0);
  say('這種結構叫 search structure');
  await step(tok);                                   // 61:05 each node needs a pointer to the real fields
  [['Jones', 3.0], ['Smith', 2.0], ['Chris', 1.0]].forEach(([n, y]) => { cube(n + ' 的其他欄位', GRAY, [2.6, 0.6, 0.8], rx, y, 0); });
  tag('disk', 'idx', rx, 3.8, 0);
  arrow(V3(-1.8, 3.0, 0.5), V3(rx - 1.4, 3.0, 0.5)); arrow(V3(0, 1.4, 0.5), V3(rx - 1.4, 2.0, 0.5)); arrow(V3(-3.6, 1.2, 0.5), V3(rx - 1.4, 1.0, 0.5));
  say('每個 node 還是要有 pointer', '指到真正的其他欄位（在 disk 裡）');
  await step(tok);                                   // 61:13 loaded into memory → points into memory
  note('load 到 memory，就指到 memory', rx, 4.6, 0);
  say('如果 load 到 memory，pointer 就直接指到 memory');
  await step(tok);                                   // 61:23 chapter 10: AVL tree, B+ tree
  glow(root, GOLD); glow(c, GOLD); glow(s, GOLD);
  bub('第十章：BST、AVL tree、B+ tree', -2.5, 0.2, 1.6);
  say('第十章會介紹 AVL tree，也會提到 B+ tree');
}]);

// ════════ dynamic hashing：Horowitz 的 6-bit 表示（A = 100、B = 101、C = 110） ════════
const PBITS = { A0: '100000', A1: '100001', B0: '101000', B1: '101001', C0: '110000', C1: '110001', C2: '110010', C3: '110011', C5: '110101' };
const prevBit = (k, d) => PBITS[k][5 - d]; // d-th bit from the right (d = 0 is the least significant)

FRAG.push(['hashpeng-bits', 'Dynamic hashing：key 化成二進位，看最右邊的 bit', async (tok) => {
  fresh([0, 5, 13], [0, 3.4, 0]);
  const ks = Object.keys(PBITS), Y = (r) => 6.6 - r * 0.75;
  let B;
  await step(tok);                                   // 61:44 dynamic hashing
  tag('dynamic hashing', 'ptr alt', -4.4, 7.6, 0);
  say('Dynamic hashing：database 裡更常用');
  await step(tok);                                   // 62:03 choosing a good static hash function is hard
  bub('好的 static hash function 很難選', 3.4, 7.6, 0);
  say('要選一個好的 static hash function 很困難');
  await step(tok);                                   // 62:10 let the data distribution decide the hash
  bub('讓資料的分佈決定 hash', 3.4, 6.8, 0);
  say('乾脆讓資料的分佈來決定 hash', '同時保留 hash 快速擷取的好處');
  await step(tok);                                   // 62:40 A0, A1, B0, B1, C0, C1, C2, C3, C5
  ks.forEach((k, r) => cube(k, ppCol(k), [0.9, 0.55, 0.6], -4.0, Y(r), 0, 2));
  say('例子：A0、A1、B0、B1、C0、C1、C2、C3、C5');
  await step(tok);                                   // 63:07 written in binary
  B = ks.map((k, r) => [...PBITS[k]].map((b, i) => cube(b, GRAY, [0.55, 0.55, 0.6], -2.6 + i * 0.65 + (i >= 3 ? 0.3 : 0), Y(r), 0)));
  tag('字母', 'idx', -1.3, 7.3, 0); tag('數字', 'idx', 1.0, 7.3, 0);
  say('每個 key 表示成二進位', '前 3 bit 是字母、後 3 bit 是數字');
  await step(tok);                                   // 63:15 A0 = 100000
  B[0].forEach((c) => glow(c, GOLD));
  note('A0 = 100 000', 2.8, Y(0), 0);
  say('A = 100、B = 101、C = 110（課本的表示）', 'A0 = 100 000；（老師口述 A 是 16 進位的 10）');
  await step(tok);                                   // 63:47 the rightmost bit
  B[0].forEach((c) => glow(c, null));
  B.forEach((r) => glow(r[5], GOLD));
  say('注意最右邊那個 bit');
  await step(tok);                                   // 64:00 the red "00"
  B.forEach((r) => glow(r[4], GOLD));
  say('再看右邊數來第 2 個 bit', '例：A0、B0 最右兩個 bit 都是 00');
  await step(tok);                                   // 64:13 hash on the least significant bits, like bucket sort
  bub('像 bucket sort：依最右邊的 bit 分桶', 3.4, 0.4, 0);
  say('依 least significant bit 做 hash', '跟 bucket sort 很像');
}]);

// trie drawer: buckets = [[suffix (bit0 first), [keys]]]; returns { objs, pos(prefix), bkt(suffix) }
function ppTrie(buckets) {
  const objs = [], NX = (d) => -6.2 + d * 1.9, BX = 3.6, top = 7.2, dy = 1.35;
  const leaves = buckets.map((b) => b[0]).sort();
  const yOf = {}; leaves.forEach((s, i) => { yOf[s] = top - i * dy; });
  const nodeY = (p) => { const ys = leaves.filter((s) => s.startsWith(p)).map((s) => yOf[s]); return ys.reduce((a, c) => a + c, 0) / ys.length; };
  const pref = new Set(['']); leaves.forEach((s) => { for (let i = 1; i < s.length; i++) pref.add(s.slice(0, i)); });
  const pos = {};
  pref.forEach((p) => { pos[p] = [NX(p.length), nodeY(p)]; objs.push(cube('', '#8a7a62', [0.35, 0.35, 0.35], NX(p.length), nodeY(p), 0)); });
  pref.forEach((p) => { if (!p) return; const q = p.slice(0, -1); objs.push(line(pos[q][0], pos[q][1], pos[p][0], pos[p][1])); objs.push(tag(p.slice(-1), 'idx', (pos[q][0] + pos[p][0]) / 2, (pos[q][1] + pos[p][1]) / 2 + 0.25, 0)); });
  const bkt = {};
  buckets.forEach(([s, ks]) => {
    const q = s.slice(0, -1), y = yOf[s];
    objs.push(line(pos[q][0], pos[q][1], BX - 1.3, y)); objs.push(tag(s.slice(-1), 'idx', (pos[q][0] + BX - 1.3) / 2, (pos[q][1] + y) / 2 + 0.25, 0));
    const box = cube('', '#e8d9a8', [2.4, 0.8, 0.5], BX, y, -0.3); objs.push(box);
    const cs = ks.map((k, i) => { const c = cube(k, ppCol(k), [0.95, 0.6, 0.6], BX - 0.55 + i * 1.1, y, 0.1); objs.push(c); return c; });
    objs.push(tag('…' + [...s].reverse().join(''), 'idx', BX + 2.0, y, 0));
    pos[s] = [BX - 1.3, y]; bkt[s] = { box, cs, y };
  });
  return { objs, pos, bkt, kill() { objs.forEach(kill); } };
}
const TRIE_A = [['00', ['A0', 'B0']], ['01', ['C2']], ['10', ['A1', 'B1']], ['11', ['C3']]]; // suffix strings are bit0-first
const TRIE_B = [['00', ['A0', 'B0']], ['01', ['C2']], ['100', ['A1', 'B1']], ['101', ['C5']], ['11', ['C3']]];
const TRIE_C = [['00', ['A0', 'B0']], ['01', ['C2']], ['1000', ['A1', 'C1']], ['1001', ['B1']], ['101', ['C5']], ['11', ['C3']]];
const ppAt = (Tr, cur, p, t) => { cur.position.set(Tr.pos[p][0], Tr.pos[p][1] + 0.6, 0); if (t !== undefined) txt(cur, t); };
// walk a key down the trie (short motion only); returns the leaf suffix reached
async function ppWalk(tok, Tr, k, cur, ms = 450) {
  let p = '';
  ppAt(Tr, cur, '', k);
  for (let d = 0; d < 6; d++) {
    p += prevBit(k, d);
    if (!Tr.pos[p]) break;
    await beat(tok, ms);
    ppAt(Tr, cur, p, k + '：' + prevBit(k, d) + (prevBit(k, d) === '0' ? ' ↑' : ' ↓'));
    if (Tr.bkt[p]) return p;
  }
  return p;
}
const findKey = (Tr, s, k) => Tr.bkt[s].cs.find((x) => x.userData.lbl.element.textContent === k);

// 64:21 trie：A0, B0, A1, B1, C2, C3（bucket 最多 2 個）
FRAG.push(['hashpeng-trie6', 'Trie：6 個 key，0 往上、1 往下', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  let Tr = null;
  const cur = tag('', 'ptr alt', -6.2, 6.0, 0);
  const redraw = (b) => { if (Tr) Tr.kill(); Tr = ppTrie(b); };
  await step(tok);                                   // 64:21 the hash function is a tree
  const r0 = cube('', '#8a7a62', [0.35, 0.35, 0.35], -6.2, 5.0, 0);
  bub('hash function = 一棵樹', -4.4, 6.4, 0);
  say('這個 hash function 長得像一棵樹');
  await step(tok);                                   // 64:29 called a trie
  tag('trie', 'ptr', -6.2, 5.8, 0);
  say('這種樹特別叫做 trie');
  await step(tok);                                   // 64:40 read the key from right to left
  note('從右往左讀 key 的 bit', -2.0, 1.2, 0);
  say('讀 key 的 bit：從右邊讀到左邊');
  await step(tok);                                   // 64:52 0 goes up, 1 goes down
  note('0 往上、1 往下', 2.0, 1.2, 0);
  say('在這個例子裡：bit 0 往上走、bit 1 往下走');
  await step(tok);                                   // 65:12 A0, B0: first bit 0 → up, into a bucket
  kill(r0); redraw([['0', ['A0', 'B0']]]);
  say('A0、B0：右數第 1 個 bit 是 0 → 往上，放進 bucket');
  await step(tok);                                   // 65:26 A1 goes down: two branches
  redraw([['0', ['A0', 'B0']], ['1', ['A1']]]);
  say('A1：第 1 個 bit 是 1 → 往下，長出兩個分支');
  await step(tok);                                   // 65:44 B1 also goes down
  redraw([['0', ['A0', 'B0']], ['1', ['A1', 'B1']]]);
  say('B0 跟 A0 同一桶；B1 往下，跟 A1 同一桶');
  await step(tok);                                   // 65:51 after inserting the 6 identifiers
  redraw(TRIE_A);
  say('insert 6 個 identifier（再加 C2、C3）後長成這樣', '每個 bucket 滿了就再分岔');
  await step(tok);                                   // 66:08 each bucket holds at most two
  Object.values(Tr.bkt).forEach((b) => glow(b.box, GOLD));
  say('黃色的就是 bucket，每個最多放兩筆');
  await step(tok);                                   // 66:35 is A0 here? A0 = 100000
  Object.values(Tr.bkt).forEach((b) => glow(b.box, null));
  ppAt(Tr, cur, '', 'A0 = 100000');
  say('找 A0 = 100000：從 root 出發');
  await step(tok);                                   // 66:45 last two bits 00: up, up
  await ppWalk(tok, Tr, 'A0', cur);
  say('最後兩個 bit 是 00：往上、再往上');
  await step(tok);                                   // 66:54 reaches a bucket: A0 is here
  glow(findKey(Tr, '00', 'A0'), GREEN);
  say('走到一個 bucket，A0 就在這裡');
  await step(tok);                                   // 67:02 B0: rightmost two bits also 00
  glow(findKey(Tr, '00', 'B0'), GREEN);
  say('B0 最右兩個 bit 也是 00 → 同一個 bucket');
}]);

// 67:30 insert C5 → split
FRAG.push(['hashpeng-trie-c5', 'Trie：insert C5 → overflow → split', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  let Tr = ppTrie(TRIE_A), n;
  const cur = tag('', 'ptr alt', 0, 0, 0);
  await step(tok);                                   // 67:30 insert C5 = 110 101
  ppAt(Tr, cur, '', 'C5 = 110101');
  say('接著 insert C5 = 110 101');
  await step(tok);                                   // 67:55 from the root: first bit from the right is 1
  ppAt(Tr, cur, '1', 'C5：1 ↓');
  say('從 root 開始：右數第 1 個 bit 是 1 → 往下');
  await step(tok);                                   // 68:08 second bit is 0 → up
  ppAt(Tr, cur, '10', 'C5：0 ↑');
  say('右數第 2 個 bit 是 0 → 往上');
  await step(tok);                                   // 68:16 into the A1, B1 bucket
  n = cube('C5', RED, [0.95, 0.6, 0.6], 3.6, Tr.bkt['10'].y + 1.0, 0.1);
  say('C5 要放進 A1、B1 那個 bucket');
  await step(tok);                                   // 68:24 already two in there → overflow
  glow(Tr.bkt['10'].box, RED); glow(n, RED);
  say('可是已經有兩個了 → overflow');
  await step(tok);                                   // 68:30 grow two branches from it (split)
  kill(n); kill(cur); Tr.kill();
  Tr = ppTrie(TRIE_B);
  ['100', '101'].forEach((s) => glow(Tr.bkt[s].box, GOLD));
  say('從這個 bucket 再長出上下兩個分支：split', '往上是 0、往下是 1');
  await step(tok);                                   // 69:07 A1, B1, C5 redistributed by 3 bits from the right
  ['100', '101'].forEach((s) => glow(Tr.bkt[s].box, null));
  Tr.bkt['100'].cs.forEach((c) => glow(c, GOLD)); glow(Tr.bkt['101'].cs[0], GOLD);
  say('A1、B1、C5 依右數 3 個 bit 重新分配', 'A1、B1 是 …001；C5 是 …101');
  await step(tok);                                   // 69:18 C5 is 101 → this bucket
  Tr.bkt['100'].cs.forEach((c) => glow(c, null)); glow(Tr.bkt['101'].cs[0], GREEN);
  say('C5 右數三個 bit 是 101 → 放進新的 bucket');
  await step(tok);                                   // 69:29 two points: overflow → split; then adjust
  bub('① overflow 就 split　② split 完依 bit 調整資料', 0, 0.6, 0);
  say('兩個重點：overflow 就 split', 'split 完要依 bit 重新調整資料');
}]);

// 69:41 insert C1 → split；trie 的缺點
FRAG.push(['hashpeng-trie-c1', 'Trie：insert C1 → A1、C1 同一桶', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  let Tr = ppTrie(TRIE_B);
  const cur = tag('', 'ptr alt', 0, 0, 0);
  await step(tok);                                   // 69:41 insert C1 = 110001
  ppAt(Tr, cur, '', 'C1 = 110001');
  say('再 insert C1 = 110 001');
  await step(tok);                                   // 69:52 from the right: 1, 0, 0 → this bucket
  const s = await ppWalk(tok, Tr, 'C1', cur);
  say('從右邊讀：1 ↓、0 ↑、0 ↑ → A1、B1 那個 bucket');
  await step(tok);                                   // 70:07 full → overflow → split, then adjust
  glow(Tr.bkt[s].box, RED); await beat(tok, 700);
  kill(cur); Tr.kill(); Tr = ppTrie(TRIE_C);
  ['1000', '1001'].forEach((x) => glow(Tr.bkt[x].box, GOLD));
  say('bucket 滿了 → overflow → split 成兩個，再調整資料');
  await step(tok);                                   // 70:21 A1 and C1 together, B1 on its own
  ['1000', '1001'].forEach((x) => glow(Tr.bkt[x].box, null));
  Tr.bkt['1000'].cs.forEach((c) => glow(c, GREEN)); glow(Tr.bkt['1001'].cs[0], GOLD);
  say('A1 和 C1 在一起，B1 分到另一桶');
  await step(tok);                                   // 70:35 their four bits from the right are the same
  note('A1、C1：最右 4 bit 都是 0001｜B1 是 1001', 3.4, 0.4, 0);
  say('因為 A1、C1 最右邊 4 個 bit 一樣（0001）', '（老師從右往左念成 1000）');
  await step(tok);                                   // 71:03 not because they were together last round
  bub('放一起是因為 bit 相同，不是因為上一回合在一起', -2.6, 0.4, 1.4);
  say('放在一起，不是因為上一回合在一起', '而是右數的 bit 相同');
  await step(tok);                                   // 71:31 this tree is the hash function
  Tr.objs.forEach((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.set('#3a2a00'); });
  say('這整棵 trie 就是 hash function');
  await step(tok);                                   // 71:40 it grows with the inserted data
  bub('hash function 隨資料長大', -4.6, 8.2, 0);
  say('它會隨著 insert 進來的資料長大，不是固定的');
  await step(tok);                                   // 72:14 data removed → merge, shrink
  bub('資料減少 → merge 縮回去', -0.6, 8.2, 0);
  say('資料減少時，也可以 merge 縮減');
  await step(tok);                                   // 72:28 drawback: traverse the trie (tree height)
  Tr.objs.forEach((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.set('#000000'); });
  const c2 = tag('C1', 'pkt', -6.2, 5.0, 0); const path = ['', '1', '10', '100', '1000'];
  for (const p of path) { c2.position.set(Tr.pos[p][0], Tr.pos[p][1] + 0.6, 0); await beat(tok, 380); }
  bad('缺點：每次都要 traverse trie，跟樹高有關', -1.6, 0.0, 1.4);
  say('缺點：access 要 traverse 這棵 trie', '時間跟樹的高度有關');
  await step(tok);                                   // 73:11 the tree can be skewed
  bad('資料不好時 trie 會 skew（歪一邊）', -1.6, -0.8, 1.4);
  say('資料長得不好，trie 還會整個 skew（歪斜）');
}]);

// 73:22 extendible hashing：把 trie 變成 directory
FRAG.push(['hashpeng-directory', 'Directory：global depth 4，直接查表找 bucket', async (tok) => {
  fresh([0, 4.4, 13], [0, 4.2, 0]);
  const bks = [['00', ['A0', 'B0']], ['01', ['C2']], ['11', ['C3']], ['101', ['C5']], ['1000', ['A1', 'C1']], ['1001', ['B1']]];
  const bucketOf = (e) => bks.find(([s]) => [...s].every((b, i) => e[3 - i] === b)); // e is written b3 b2 b1 b0
  const BX = 3.6, BY = (i) => 7.4 - i * 1.35;
  const ents = [...Array(16)].map((_, n) => n.toString(2).padStart(4, '0'));
  const EY = (n) => 8.1 - n * 0.5, EX = -4.6;
  let Tr, E, B;
  await step(tok);                                   // 73:22 improvement: extendible hashing
  Tr = ppTrie(TRIE_C);
  tag('extendible hashing', 'ptr alt', -3.0, 8.9, 0);
  say('改進方法：extendible hashing');
  await step(tok);                                   // 73:39 don't traverse the tree
  Tr.objs.forEach((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.2; } if (o.element) o.element.style.opacity = '0.25'; });
  say('既然每次 traverse trie 很慢，能不能不要走樹？');
  await step(tok);                                   // 73:46 build a directory
  Tr.kill();
  E = ents.map((e, n) => cube(e, '#d8c29b', [1.3, 0.42, 0.5], EX, EY(n), 0));
  tag('directory', 'ptr', EX, 8.85, 0);
  say('那就建一個目錄：directory');
  await step(tok);                                   // 74:24 pointers to the buckets
  B = bks.map(([s, ks], i) => { cube('', '#e8d9a8', [2.4, 0.8, 0.5], BX, BY(i), -0.3); return ks.map((k, j) => cube(k, ppCol(k), [0.95, 0.6, 0.6], BX - 0.55 + j * 1.1, BY(i), 0.1)); });
  say('trie 末端的紅線都是 pointer，指到 bucket');
  await step(tok);                                   // 74:44 each number ↔ a pointer
  ents.forEach((e, n) => { const i = bks.indexOf(bucketOf(e)); arrow(V3(EX + 0.7, EY(n), 0), V3(BX - 1.25, BY(i), 0), 0x9a8a70); });
  say('每個編號對應一個 pointer，指到一個 bucket');
  await step(tok);                                   // 75:02 no tree, just a table
  bub('樹不要了，直接用一張 table', 0, 9.2, 0);
  say('整棵樹都不要了，直接用一張 table 表示');
  await step(tok);                                   // 75:21 the trie reaches 4 levels → 4 bits
  tag('global depth = 4', 'ptr alt', EX + 2.2, 8.85, 0);
  say('trie 最多長到 4 層 → 用 4 個 bit 編號', '共 2⁴ = 16 個 entry');
  await step(tok);                                   // 75:45 0000 → the A0, B0 bucket
  glow(E[0], GREEN); B[0].forEach((c) => glow(c, GREEN));
  say('0000 指到 A0、B0 那個 bucket');
  await step(tok);                                   // 76:06 other entries point to the same bucket
  [4, 8, 12].forEach((n) => glow(E[n], GOLD));
  say('0100、1000、1100 也指到同一個 bucket', '這個 bucket 只用到最右 2 bit（local depth 2）');
  await step(tok);                                   // 77:18 global depth and local depth
  bks.forEach(([s], i) => tag('local ' + s.length, 'idx', BX + 2.0, BY(i), 0));
  say('directory 記 global depth', '每個 bucket 記自己的 local depth');
  await step(tok);                                   // 79:00 the basics: be able to draw the trie
  bub('最基本：會把一組 key 畫成 trie', 0, -0.2, 1.4);
  say('最基本要會：把一組 key 畫成 trie', '其他都是從 trie 延伸出來的');
  await step(tok);                                   // 79:29 look up the directory → pointer → bucket
  [0, 4, 8, 12].forEach((n) => glow(E[n], null)); B[0].forEach((c) => glow(c, null));
  glow(E[0], null); glow(E[1], GREEN); B[4].forEach((c) => glow(c, GREEN));
  say('查 directory 就拿到 pointer，直接找到 bucket', '例：C1 → 最右 4 bit 0001 → A1、C1 那桶');
}]);

// 79:49 directoryless dynamic hashing
FRAG.push(['hashpeng-dirless', 'Directoryless：位址直接當 bucket，overflow 用 chain', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const ad = ['00', '01', '10', '11'], xs = [-4.5, -1.5, 1.5, 4.5];
  const keys = { '00': ['A0', 'B0'], '01': ['A1', 'B1'], '10': ['C2'], '11': ['C3'] };
  let dir, n;
  await step(tok);                                   // 79:49 is there something faster?
  dir = [...Array(4)].map((_, i) => cube(ad[i], '#d8c29b', [1.0, 0.4, 0.5], -6.4, 1.85 - i * 0.5, -2.0));   // stacked upright: laid out in depth the four names printed over each other
  say('還有沒有更快的？');
  await step(tok);                                   // 80:00 pointers are troublesome
  bad('pointer 還要記 memory address，好麻煩', -4.4, 1.4, -3.4);
  say('pointer 很麻煩：還要記錄它的 memory address');
  await step(tok);                                   // 80:06 no pointers: directoryless
  dir.forEach(kill);
  tag('directoryless dynamic hashing', 'ptr alt', 0, 2.6, -3.0);
  say('連 pointer 都不要：directoryless');
  await step(tok);                                   // 80:21 not a pointer: a memory address directly
  xs.forEach((x, i) => { cube('', '#e8d9a8', [2.6, 0.12, 1.4], x, 0.06, -1.5); tag('address …' + ad[i], 'idx', x, 0, -0.4); });
  say('對應到的不是 pointer，而是 memory address');
  await step(tok);                                   // 80:46 00 → address 00, 01 → …
  ad.forEach((a, i) => keys[a].forEach((k, j) => cube(k, ppCol(k), [1.0, 0.6, 0.9], xs[i] - 0.55 + j * 1.1, 0.4, -1.5, 3)));
  say('…00 就是 memory address 00；…01、…10 也一樣');
  await step(tok);                                   // 81:00 the 2 bits from the right are the address
  note('最右 2 個 bit = memory address', 0, 1.6, -1.5);
  say('從右邊數過來的兩個 bit，就是它的 memory address');
  await step(tok);                                   // 81:09 overflow may happen
  n = cube('C5', RED, [1.0, 0.6, 0.9], xs[1], 1.9, -1.5); glow(n, RED);
  say('insert C5（…01）：那一格滿了 → overflow');
  await step(tok);                                   // 81:19 linked list: chaining
  glow(n, null); tint(n, ppCol('C5'));
  move(n, xs[1], 0.4, 1.6);
  arrow(V3(xs[1], 0.4, -0.7), V3(xs[1], 0.4, 1.0));
  tag('overflow chain', 'ptr alt', xs[1] + 2.0, 0.6, 1.6);
  say('overflow 就用 linked list 串起來', '= 用 chaining 解決');
}]);

// 81:48 本章重點回顧
FRAG.push(['hashpeng-recap', '第八章重點：static 與 dynamic hashing', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const row = (items, z, col, w) => items.forEach(([t, x]) => cube(t, col, [w, 0.5, 0.9], x, 0.25, z, 3));
  await step(tok);                                   // 81:48 chapter 8 key points
  tag('第八章重點', 'ptr', 0, 2.8, -3.4);
  say('第八章的重點');
  await step(tok);                                   // 81:59 a hash table and a hash function
  tag('static hashing', 'ptr', -6, 0.9, -3.2);
  row([['hash table', -4.8], ['hash function', -1.6]], -2.2, PP[0], 2.8);
  say('要有一個 hash table，並決定 hash function');
  await step(tok);                                   // 82:11 three common hash functions
  row([['mid-square', -4.0], ['division', -1.6], ['folding', 0.8]], 0, PP[2], 2.2);
  say('介紹了三種常用的 hash function');
  await step(tok);                                   // 82:18 collision, overflow
  row([['collision', 1.6], ['overflow', 4.8]], -2.2, PP[0], 2.8);
  say('要注意 collision 與 overflow', 'collision 免不了，怕的是 overflow');
  await step(tok);                                   // 82:38 open addressing and chaining
  row([['open addr.', 3.2], ['chaining', 5.6]], 0, PP[2], 2.2);
  say('overflow 至少有兩種解法', 'open addressing、chaining');
  await step(tok);                                   // 82:46 all of these: static hash
  bub('以上都是 static hash', 2.0, 1.4, -1.0);
  say('以上講的都是 static hash');
  await step(tok);                                   // 82:52 dynamic hash: trie
  tag('dynamic hashing', 'ptr alt', -6, 0.9, 1.4);
  row([['trie', -3.2]], 2.4, PP[5], 2.6);
  say('Dynamic hash：用 trie，hash 到的 bucket 隨資料改變');
  await step(tok);                                   // 83:17 avoid the traverse: build a directory
  row([['directory', 0]], 2.4, PP[5], 2.6);
  arrow(V3(-1.8, 0.3, 2.4), V3(-1.4, 0.3, 2.4));
  say('為了不要 traverse trie → 建目錄（directory）');
  await step(tok);                                   // 83:25 even faster: directoryless
  row([['directoryless', 3.2]], 2.4, PP[5], 2.6);
  arrow(V3(1.4, 0.3, 2.4), V3(1.8, 0.3, 2.4));
  say('還可以更快：連目錄都不要 → directoryless');
}]);

// 83:46 Q&A：collision 與 overflow 的差別
FRAG.push(['hashpeng-qa', 'Q&A：collision 與 overflow 是兩種現象', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const BX = -3.4, SX = 3.6;
  await step(tok);                                   // 83:46 think of them as two phenomena
  tag('現象 ① collision', 'ptr', -3.4, 3.2, -1.6); tag('現象 ② overflow', 'ptr alt', 3.6, 3.2, -1.6);
  say('把 collision 和 overflow 想成兩種現象');
  await step(tok);                                   // 83:59 two data map to the same bucket
  cube('', GRAY, [3.0, 0.12, 1.3], BX, 0.06, 0); tag('bucket（很大，s = 4）', 'idx', BX, 0, 1.0);
  const a = buddy('i₁', '', PP[0], BX - 1.0, 0.12, 0, 0.55), b = buddy('i₂', '', PP[1], BX - 0.3, 0.12, 0, 0.55);
  a.mood('wow'); b.mood('wow');
  say('collision：兩筆資料對到同一個 bucket', '經過 hash function 後撞在一起');
  await step(tok);                                   // 84:16 buckets are limited → collision is inevitable
  const ps = [0, 1, 2, 3].map((i) => tag('x' + ppSub(i + 3), 'pkt', -6.6 + i * 0.6, 2.2, -2.6));
  await Promise.all(ps.map((p, i) => travel(tok, p, p.position.clone(), V3(BX + 0.4 + (i % 2) * 0.6, 1.6, 0), 800)));
  ps.forEach(remove);
  say('bucket 有限、資料很多 → 一定會有 collision');
  await step(tok);                                   // 84:39 collision ≠ overflow: a big bucket just takes more
  buddy('i₃', '', PP[2], BX + 0.4, 0.12, 0, 0.55); buddy('i₄', '', PP[3], BX + 1.1, 0.12, 0, 0.55);
  good('bucket 夠大：多塞幾個，沒有 overflow', BX, 1.8, 1.4);
  say('collision 不代表 overflow', 'bucket 夠大，就多塞幾個進來');
  await step(tok);                                   // 84:58 a small bucket, full → overflow
  cube('', GRAY, [1.2, 0.12, 1.3], SX, 0.06, 0); tag('bucket（很小）', 'idx', SX, 0, 1.0);
  buddy('j₁', '', PP[4], SX, 0.12, 0, 0.55);
  const j2 = buddy('j₂', '', PP[5], SX, 1.3, 0, 0.55); j2.glow(RED); j2.mood('sad');
  bad('滿了還要塞 → overflow', SX, 2.6, 1.0);
  say('bucket 很小、已經滿了還要塞 → overflow');
  await step(tok);                                   // 85:39 (student) bucket space vs a linked list
  bub('bucket：一塊連續的 memory 空間｜linked list：要靠 pointer 串', 0, 0.4, 3.4);
  say('同學問：bucket size 跟 linked list 有什麼不同？', 'bucket 是 memory 空間；linked list 還要 pointer');
  await step(tok);                                   // 86:36 s = 1: a collision is an overflow
  good('bucket size = 1：看到 collision 就等於看到 overflow', 0, 4.0, -0.4);
  say('bucket size = 1 時', '看到 collision 就等於看到 overflow');
}]);

// ════════ 第十章開頭：BST 會受輸入順序影響（月份例子） ════════
const MONTH_ORDERS = [
  ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'],
  ['JULY', 'FEB', 'MAY', 'AUG', 'DEC', 'MAR', 'OCT', 'APR', 'JAN', 'JUNE', 'SEPT', 'NOV'],
  ['APR', 'AUG', 'DEC', 'FEB', 'JAN', 'JULY', 'JUNE', 'MAR', 'MAY', 'NOV', 'OCT', 'SEPT'],
];
function ppBST(keys) {
  const N = {}; let root = null;
  for (const k of keys) {
    const n = { k, l: null, r: null, p: null, d: 1 };
    if (!root) root = n; else { let c = root; for (;;) { const s = k < c.k ? 'l' : 'r'; if (!c[s]) { c[s] = n; n.p = c; n.d = c.d + 1; break; } c = c[s]; } }
    N[k] = n;
  }
  const sorted = [...keys].sort(), maxD = Math.max(...keys.map((k) => N[k].d));
  const dy = maxD > 7 ? 0.68 : 1.25;
  keys.forEach((k) => { N[k].x = -6 + sorted.indexOf(k) * (12 / 11); N[k].y = 8.3 - (N[k].d - 1) * dy; });
  const h = (n) => (n ? 1 + Math.max(h(n.l), h(n.r)) : 0);
  keys.forEach((k) => { N[k].h = h(N[k]); N[k].hl = h(N[k].l); N[k].hr = h(N[k].r); N[k].bf = N[k].hl - N[k].hr; });
  return { N, root, maxD, sum: keys.reduce((a, k) => a + N[k].d, 0) };
}
// draw nodes (optionally a few at a time); returns the tree
function ppDraw(T, keys) { keys.forEach((k) => { const n = T.N[k]; if (n.p) n.edge = line(n.p.x, n.p.y, n.x, n.y); n.c = cube(k, ppCol(k), [0.95, 0.6, 0.6], n.x, n.y, 0, 2.5); }); }
async function ppGrow(tok, T, keys, ms) { for (const k of keys) { ppDraw(T, [k]); await beat(tok, ms); } }
const depthTags = (T, keys) => keys.forEach((k) => tag(String(T.N[k].d), 'ptr alt', T.N[k].x + 0.55, T.N[k].y + 0.45, 0));

// 87:43 BST：JAN, FEB, MAR … 平均 3.5
FRAG.push(['hashpeng-bst-jan', 'BST 的形狀看輸入順序：JAN 先進來，平均 3.5', async (tok) => {
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  const keys = MONTH_ORDERS[0], T = ppBST(keys);
  await step(tok);                                   // 87:43 why isn't a BST balanced?
  bub('為什麼 binary search tree 會不 balance？', 0, 9.6, 0);
  say('Binary search tree 為什麼會不 balance？');
  await step(tok);                                   // 87:56 luck: right order → balanced; wrong → skewed
  note('看輸入順序的運氣：對了 balanced，錯了 skew', 0, 8.9, 0);
  say('要看運氣：輸入順序對，就 balanced；錯了就 skew（歪一邊）');
  await step(tok);                                   // 88:11 smaller left, larger right; JAN first → root
  ppDraw(T, ['JAN']);
  say('依字母比大小：小的放左邊、大的放右邊', '第一個輸入 JAN → 成為 root');
  await step(tok);                                   // 88:27 FEB < JAN → left
  ppDraw(T, ['FEB']);
  say('FEB：F 比 J 小 → 放 JAN 左邊');
  await step(tok);                                   // 88:36 MAR > JAN → right
  ppDraw(T, ['MAR']);
  say('MAR：比 JAN 大 → 放右邊');
  await step(tok);                                   // 88:47 and so on: the tree grows by the input order
  await ppGrow(tok, T, keys.slice(3), 200);
  say('依此類推：樹照輸入順序慢慢長出來');
  await step(tok);                                   // 89:04 search NOV: the deepest
  glow(T.N.NOV.c, GOLD);
  say('找 NOV：它是這棵樹最深的 node');
  await step(tok);                                   // 89:20 NOV vs JAN → right, vs MAR → right …
  const cur = tag('', 'ptr alt', 0, 0, 0);
  let n = T.root, c = 0;
  while (n && c < 4) { c++; cur.position.set(n.x, n.y + 0.7, 0); txt(cur, '第 ' + c + ' 次'); glow(n.c, GOLD); await beat(tok, 400); if (n.k !== 'NOV') glow(n.c, null); n = 'NOV' < n.k ? n.l : n.r; }
  say('NOV 跟 JAN 比 → 比較大往右；跟 MAR 比 → 往右 ……', '1、2、3、4 次');
  await step(tok);                                   // 89:42 5, 6 times: NOV at the bottom
  while (n) { c++; cur.position.set(n.x, n.y + 0.7, 0); txt(cur, '第 ' + c + ' 次'); glow(n.c, n.k === 'NOV' ? GREEN : GOLD); await beat(tok, 400); if (n.k === 'NOV') break; glow(n.c, null); n = 'NOV' < n.k ? n.l : n.r; }
  say('第 5 次、第 6 次：到最底才找到 NOV', '最多要比 6 次');
  await step(tok);                                   // 89:53 comparisons for every node
  kill(cur);
  depthTags(T, keys);
  say('每個 node 的比較次數 = 它在第幾層', 'JAN 是 root：1 次');
  await step(tok);                                   // 90:30 sum / 12 = 3.5
  good('平均 = ' + T.sum + ' / 12 = 3.5', 3.6, 9.4, 0);
  say('全部加起來除以 12：平均 3.5 次');
}]);

// 90:38 JULY 先進來：平均 3.1；skew：平均 6.5
FRAG.push(['hashpeng-bst-two', 'Balanced 與 skewed：平均 3.1 與 6.5', async (tok) => {
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  let T = ppBST(MONTH_ORDERS[1]);
  await step(tok);                                   // 90:38 JULY first: the tree grows by the order
  say('換個順序：JULY 先進來', '樹一樣照輸入順序慢慢長大');
  await ppGrow(tok, T, MONTH_ORDERS[1], 200);
  await step(tok);                                   // 90:59 fairly balanced: at most 4, average 3.1
  depthTags(T, MONTH_ORDERS[1]);
  good('最多 4 次，平均 ' + T.sum + '/12 ≈ 3.1', 3.6, 9.4, 0);
  say('這棵蠻 balanced：最多比 4 次，平均 3.1');
  await step(tok);                                   // 91:08 unlucky: skewed
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  T = ppBST(MONTH_ORDERS[2]);
  say('運氣不好：依字母順序 APR, AUG, DEC … 輸入');
  await ppGrow(tok, T, MONTH_ORDERS[2], 180);
  await step(tok);                                   // 91:20 a linked list: up to 12 comparisons
  bad('整棵 skew = linked list：最多 12 次', 3.0, 9.4, 0);
  say('整棵歪成一條，等於 linked list', '最多要比 12 次');
  await step(tok);                                   // 91:32 average 6.5: BST depends on the input
  good('平均 ' + T.sum + '/12 = 6.5', 3.0, 8.6, 0);
  say('平均 6.5 次', 'BST 的效能受輸入資料的順序影響');
}]);

// 91:55 AVL tree 的定義與 balance factor
FRAG.push(['hashpeng-avl-def', 'AVL tree：|h_L − h_R| ≤ 1，BF ∈ {−1, 0, 1}', async (tok) => {
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  let T = ppBST(MONTH_ORDERS[0]);
  await step(tok);                                   // 91:55 a BST that grows badly searches badly
  ppDraw(T, MONTH_ORDERS[0]);
  say('BST 是搜尋用的 structure', '長得不好，搜尋就慢');
  await step(tok);                                   // 92:16 make the tree balanced
  bub('讓樹 balance 一點 → 輸入時就調整', 0, 9.6, 0);
  say('要增進效能：讓樹 balance 一點', '輸入資料時就對樹做調整');
  await step(tok);                                   // 92:34 AVL tree: a balanced binary tree
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  const keys = MONTH_ORDERS[1]; T = ppBST(keys); ppDraw(T, keys);
  tag('AVL tree = balanced binary tree', 'ptr alt', 0, 9.6, 0);
  say('AVL tree 是一種 balanced binary search tree');
  await step(tok);                                   // 92:52 the root has a left and a right subtree
  const R = T.root, L = keys.filter((k) => k < R.k), Rt = keys.filter((k) => k > R.k);
  const box = (ks, col) => { const xs = ks.map((k) => T.N[k].x), ys = ks.map((k) => T.N[k].y); const g = ghostBox(col, Math.max(...xs) - Math.min(...xs) + 1.4, Math.max(...ys) - Math.min(...ys) + 1.2, 1.0); g.position.set((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, 0); };
  box(L, '#4b9ee2'); box(Rt, '#dd8238');
  tag('T_L', 'ptr', T.N[L[0]].x - 1.4, T.N[L[0]].y + 0.6, 0); tag('T_R', 'ptr', T.N[Rt[0]].x + 1.4, T.N[Rt[0]].y + 0.6, 0);
  say('條件一：root 的左子樹 T_L、右子樹 T_R 也都要 balanced', '（recursive 的定義）');
  await step(tok);                                   // 93:10 |h_L − h_R| ≤ 1
  note('h_L = ' + R.hl + '、h_R = ' + R.hr + '：|' + R.hl + ' − ' + R.hr + '| ≤ 1', R.x, R.y + 0.9, 0);
  say('條件二：左右子樹高度相減取絕對值 ≤ 1', '|h_L − h_R| ≤ 1');
  await step(tok);                                   // 94:03 recursive: every node must satisfy it
  for (const k of keys) { glow(T.N[k].c, GOLD); await beat(tok, 140); glow(T.N[k].c, null); }
  say('條件一是 recursive：每個 node 都要符合條件二');
  await step(tok);                                   // 94:21 balance factor BF
  keys.forEach((k) => { const n = T.N[k]; tag('BF ' + (n.bf > 0 ? '+' : '') + n.bf, 'idx', n.x, n.y - 0.55, 0); });
  say('Balance factor：BF = 左子樹高度 − 右子樹高度');
  await step(tok);                                   // 94:40 BF ∈ {1, 0, −1}
  good('AVL：每個 node 的 BF 只能是 1、0、−1', 3.4, 8.8, 0);
  say('AVL tree 裡每個 node 的 BF 只能是 1、0、−1');
  await step(tok);                                   // 94:50 beyond that → not balanced
  fresh([0, 4.6, 14], [0, 4.6, 0]);
  T = ppBST(MONTH_ORDERS[0]); ppDraw(T, MONTH_ORDERS[0]);
  MONTH_ORDERS[0].forEach((k) => { const n = T.N[k]; tag('BF ' + (n.bf > 0 ? '+' : '') + n.bf, Math.abs(n.bf) > 1 ? 'bad' : 'idx', n.x, n.y - 0.55, 0); if (Math.abs(n.bf) > 1) glow(n.c, RED); });
  say('BF 超過 1 或小於 −1 → 不 balance', '例：JAN 先進來那棵，FEB 的 BF = 3、MAY 的 BF = −3');
}]);
  }
  // ═══ qa-ds6.js（課堂 Q&A 與作業說明段落的場景） ═══
  {
const { V3, fresh, tag, cube, kill, move, glow, tint, line, arrow, ghostBox, code, step, GOLD, GREEN } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0.5) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const wipe = (arr) => { arr.forEach(kill); arr.length = 0; };

// ── CwM-Cxilk4g：結語 quadratic probing、open addressing 不用額外結構 ──
FRAG.push(['qa-oa-quad-wrap', 'quadratic probing 減輕 clustering；open addressing 只用表本身', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.0, 0]);
  const S = [];
  const X = (i) => -5.4 + i * 1.2;
  const cells = []; for (let i = 0; i < 10; i++) { cells.push(cube('', [2, 3, 4, 5].includes(i) ? '#e06666' : '#f6deb0', [1.05, 0.5, 0.9], X(i), 0.6, 0)); S.push(tag(String(i), 'idx', X(i), -0.1)); }
  S.push(...cells);
  await step(tok);                                   // quadratic probing 解決 clustering
  S.push(bad('linear：一格一格往旁邊找 → 擠成一團（clustering）', 0, 3.6));
  const h = 2;
  [1, 4, 9].forEach((d, k) => { const t = (h + d) % 10; S.push(arrow(V3(X(h), 1.0 + k * 0.4, 0.5), V3(X(t), 1.0 + k * 0.4, 0.5), 0x0f5a3a)); S.push(tag('+' + d, 'idx', (X(h) + X(t)) / 2, 1.25 + k * 0.4, 0.5)); });
  glow(cells[(h + 9) % 10], GREEN);
  S.push(good('quadratic：h+1、h+4、h+9… 跳開找', 0, 2.9));
  say('下一個方法 quadratic probing', '跳著找空位，可以減輕 clustering');
  await step(tok);                                   // 用同一塊記憶體，不需要額外結構
  wipe(S); cells.length = 0;
  for (let i = 0; i < 6; i++) S.push(cube(['k1', '', 'k2', 'k3', '', 'k4'][i], '#f6deb0', [1.0, 0.5, 0.9], -5.0 + i * 1.1, 2.4, 0));
  S.push(tag('open addressing：全部放在 table 本身', 'ptr', -2.25, 3.4), good('不用額外記憶體', -2.25, 1.4));
  for (let i = 0; i < 4; i++) S.push(cube('', '#f6deb0', [1.0, 0.5, 0.9], 1.9 + i * 1.1, 3.4, 0));
  [[0, 2], [2, 1]].forEach(([b, n]) => { for (let j = 0; j < n; j++) { S.push(cube('', '#9b7ef4', [0.8, 0.45, 0.7], 1.9 + b * 1.1, 2.5 - j * 0.8, 0)); S.push(line(1.9 + b * 1.1, 3.15 - j * 0.8, 1.9 + b * 1.1, 2.72 - j * 0.8)); } });
  S.push(tag('separate chaining：每格再掛 linked list', 'ptr', 3.55, 4.3), bad('額外的記憶體和資料結構', 3.55, 0.6));
  say('open addressing 用的是同一塊記憶體', '不像 separate chaining 要額外的記憶體和資料結構');
}]);

// ── SBQLkYIDAZI：作業 4 Decision Tree ──
FRAG.push(['qa-decision-tree', 'Decision tree：問題在 non-leaf、決策在 leaf，遞迴切資料建樹', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // non-leaf 是問題、leaf 是決策
  const q1 = cube('多雲？', '#4b9ee2', [1.5, 0.6, 0.7], -3.4, 4.4, 0, 1.5), q2 = cube('有風？', '#4b9ee2', [1.5, 0.6, 0.7], -4.8, 3.0, 0, 1.5);
  const l1 = cube('出門', '#2fc092', [1.3, 0.6, 0.7], -2.0, 3.0, 0, 1.5), l2 = cube('不出門', '#e06666', [1.4, 0.6, 0.7], -5.6, 1.6, 0, 1.5), l3 = cube('出門', '#2fc092', [1.3, 0.6, 0.7], -4.0, 1.6, 0, 1.5);
  S.push(q1, q2, l1, l2, l3, line(-3.4, 4.1, -4.8, 3.3), line(-3.4, 4.1, -2.0, 3.3), line(-4.8, 2.7, -5.6, 1.9), line(-4.8, 2.7, -4.0, 1.9));
  S.push(tag('是', 'idx', -4.4, 3.8), tag('否', 'idx', -2.4, 3.8));
  S.push(tag('non-leaf：問題　leaf：決策', 'ptr', -3.6, 0.7));
  say('作業 4 的主角：機器學習裡的 decision tree', 'non-leaf node 放問題，leaf 放最後的決策');
  await step(tok);                                   // 對應一串 if-then-else
  const c = code(['if (多雲) {', '  if (有風) 不出門;', '  else 出門;', '} else 出門;'], 2.6, 4.4, 0.55); S.push(...c.ls);
  S.push(arrow(V3(-1.2, 3.0, 0), V3(0.6, 3.0, 0)));
  say('一棵 decision tree 就對應一串 if-then-else', '作業要把建好的樹輸出成這段程式');
  await step(tok);                                   // 建樹像切西瓜
  wipe(S); c.kill();
  const pts = [[-4.6, 0.6, 1], [-4.0, 1.6, 1], [-3.4, 0.9, 1], [-2.8, 2.0, 0], [-1.0, 0.7, 0], [-0.4, 1.8, 0], [0.4, 1.1, 0], [-4.4, 2.2, 1]];
  const balls = pts.map(([x, y, yes]) => { const m = cube(yes ? 'Y' : 'N', yes ? '#2fc092' : '#e06666', [0.45, 0.45, 0.45], x, y, 0); S.push(m); return m; });
  S.push(tag('資料：Y = 是，N = 否', 'ptr', -2.0, 3.2));
  await beat(tok, 1200);
  const cut = cube('', '#c08a1f', [0.08, 2.6, 1.0], -3.1, 1.4, 0); S.push(cut);
  S.push(tag('左半 → 遞迴建左 subtree', 'idx', -3.8, -0.3), tag('右半 → 遞迴建右 subtree', 'idx', -0.5, -0.3));
  S.push(note('這一刀 = root', 3.4, 2.6));
  say('建樹像切西瓜：一刀把資料切成兩半', '左右各自遞迴建 subtree，再用 root 連起來');
  await step(tok);                                   // 怎麼切：confusion
  move(cut, -0.7, 1.4);
  await beat(tok, 900);
  const bb = bad('這刀不好：左邊 Y、N 還混在一起', 3.4, 1.8); S.push(bb);
  await beat(tok, 1500);
  move(cut, -3.1, 1.4); kill(bb);
  await beat(tok, 900);
  S.push(good('好的一刀：Y、N 各集中一邊', 3.0, 4.2));
  say('怎麼選那一刀？看 confusion', '希望切完 Y 儘量在一邊、N 儘量在另一邊');
  await step(tok);                                   // terminating condition
  balls.forEach((b, i) => glow(b, pts[i][2] ? GREEN : null));
  S.push(pkt('切不下去（全都是 Y）→ 回傳 leaf', 3.4, 0.5));
  say('遞迴一定要有 terminating condition', '切不下去了，就停下來回傳一個 leaf');
  await step(tok);                                   // top-down recursive；印程式 = traversal
  wipe(S);
  S.push(note('建樹：top-down recursive', -2.8, 3.6), note('印成程式：某一種 tree traversal', 2.8, 2.6));
  S.push(tag('拜訪每個 node，把內容印成 if-then-else', 'idx', 2.8, 1.8));
  say('建樹是 top-down 的遞迴', '把樹印成程式，用的是某一種 tree traversal');
}]);

// ── SBQLkYIDAZI：insert 的成本、ordered array 的 insert 不是 log n ──
FRAG.push(['qa-insert-cost', 'insert 的成本：先 get，ordered array 還要往後推', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.0, 0]);
  const S = [];
  const A = [3, 8, 12, 20, 27, 35];
  const X = (i) => -4.4 + i * 1.1;
  const cs = A.map((v, i) => cube(v, '#4b9ee2', [0.9, 0.55, 0.7], X(i), 1.0, 0)); S.push(...cs);
  for (let i = 6; i < 8; i++) S.push(cube('', '#f6deb0', [0.9, 0.55, 0.7], X(i), 1.0, 0));
  await step(tok);                                   // insert 主要的力氣
  S.push(note('insert 的主要力氣：找位置、把別人擠開', 0, 3.6));
  say('不管有沒有重複，insert 花的力氣差不多', 'array 要把別人擠開；linked list 要找到位置');
  await step(tok);                                   // insert = get 完發現沒有，再放進去
  S.push(tag('insert ≈ 先 get（發現沒有）＋ 再放進去', 'ptr', 0, 2.8));
  say('討論時常把 insert 想成：', '先 get，確認沒有之後再放進去');
  await step(tok);                                   // ordered array 不是 log n
  const nw = cube(15, '#f0a030', [0.9, 0.55, 0.7], -5.6, 2.2, 0); S.push(nw);
  for (const i of [2, 4, 3]) { glow(cs[i], GOLD); await beat(tok, 450); glow(cs[i], null); }
  S.push(good('binary search 找位置：O(log n)', -2.4, -0.2));
  for (let i = 5; i >= 3; i--) { move(cs[i], X(i + 1), 1.0); await beat(tok, 300); }
  move(nw, X(3), 1.0);
  S.push(bad('後面全部往後推：O(n)', 2.6, -0.9));
  say('ordered array 的 insert 不是 log n', 'binary search 找到位置後，還要把後面的推開');
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

  return {
    kicker: '資料結構・第 6 章',
    title: '雜湊表 Hash Table',
    color: 'var(--ds)',
    modes: [
      { id: 'fn', name: '雜湊函數', enter: enterFn },
      { id: 'chain', name: 'Chaining', enter: () => enterChain() },
      { id: 'open', name: 'Open Addressing', enter: () => enterOpen({ m: T.auto ? 10 : T.m }) },
      { id: 'rehash', name: 'Rehashing', enter: () => { T.method = 'linear'; enterOpen({ m: 7, auto: true }); } },
      { id: 'alpha', name: 'α 與探測次數', enter: enterAlpha },
    ],
    pages: [
      { id: 'cmp', name: '方法比較', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes: Object.fromEntries(Object.entries(scenes).map(([id, s]) => [id, { title: s.title, play: async (tok) => { sceneTok = tok; await s.play(tok); } }])),
    sceneOrder: ['chaining-vs-open', 'linear-probing', 'find-probes', 'primary-clustering', 'quadratic-and-double', 'lazy-deletion', 'rehashing', 'folding'].concat(FRAG.map((f) => f[0])),
    stop() { gen++; busy = false; sceneTok = null; },
  };
}
