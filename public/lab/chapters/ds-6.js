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
      '移位：各段直接相加<br>邊界：偶數段（第 2、4…段）反轉後相加<br>課本例：移位 699、邊界 897');
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
    const opts = [...p.opts].sort(() => Math.random() - 0.5);
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
      say('群聚越大，越容易被撞到、又越長越大', 'linear：失敗 ≈ ½[1 + 1/(1−α)²]，λ 要 < 0.5');
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
  const FRAG = [];
  // ═══ hasha.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, code, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── MfhjkfocRR0（Paul：What is a HashTable）、CwM-Cxilk4g（Linear Probing）、mFY0J5W8Udk（Abdul Bari：Hashing Technique） ───
const HA = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const haCol = (k) => HA[(typeof k === 'number' ? k : [...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0)) % HA.length];
const haSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
// a row of m empty slots centred on x = 0 at depth z
function haRow(m, dx, z) {
  const x0 = -(m - 1) * dx / 2, xs = [], slots = [];
  for (let i = 0; i < m; i++) { const x = x0 + i * dx; xs.push(x); slots.push(cube('', GRAY, [dx * 0.9, 0.12, 1.2], x, 0.06, z)); tag(String(i), 'idx', x, 0, z + 1.0); }
  return { m, dx, z, xs, slots, keys: new Array(m).fill(null), vals: new Array(m).fill(null), ks: Math.min(0.9, dx * 0.8) };
}
function haPlace(T, i, k, drop) { const c = cube(k, haCol(k), [T.ks, 0.7, 0.9], T.xs[i], 0.47, T.z, drop ? 3 : 0); T.keys[i] = c; T.vals[i] = k; return c; }
const haLin = (i) => i, haQuad = (i) => i * i;
const haF = (f, i) => (f === haQuad ? i + '²' : String(i));
// open-addressing insert with a moving probe cursor; one caption per probe
async function haInsert(tok, T, k, f, cur, ms = 1000) {
  const h = k % T.m;
  for (let i = 0; i < T.m; i++) {
    const j = (h + f(i)) % T.m;
    cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'h' + haSub(i));
    const fm = 'h' + haSub(i) + '(' + k + ') = (' + h + ' + ' + haF(f, i) + ') mod ' + T.m + ' = ' + j;
    if (T.keys[j] === null) {
      haPlace(T, j, k, true);
      say('insert ' + k + '：放進 [' + j + ']', fm);
      await beat(tok, ms);
      return i + 1;
    }
    glow(T.keys[j], RED);
    say('insert ' + k + '：[' + j + '] 已被 ' + T.vals[j] + ' 佔', fm + '　collision');
    await beat(tok, ms);
    glow(T.keys[j], null);
  }
  return -1;
}
// open-addressing find: same probe sequence, stops at the key or an empty slot
async function haFind(tok, T, k, f, cur, ms = 1000) {
  const h = k % T.m;
  for (let i = 0; i < T.m; i++) {
    const j = (h + f(i)) % T.m;
    cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'h' + haSub(i));
    const fm = 'h' + haSub(i) + '(' + k + ') = (' + h + ' + ' + haF(f, i) + ') mod ' + T.m + ' = ' + j;
    if (T.keys[j] === null) {
      glow(T.slots[j], RED);
      say('find ' + k + '：[' + j + '] 是空格 → 不在表裡', fm + '　共 ' + (i + 1) + ' 次 probe');
      await beat(tok, ms + 600); glow(T.slots[j], null);
      return -(i + 1);
    }
    if (T.vals[j] === k) {
      glow(T.keys[j], GREEN);
      say('find ' + k + '：在 [' + j + '] 找到', fm + '　共 ' + (i + 1) + ' 次 probe');
      await beat(tok, ms + 600); glow(T.keys[j], null);
      return i + 1;
    }
    glow(T.keys[j], GOLD);
    say('find ' + k + '：[' + j + '] 是 ' + T.vals[j] + '，不是', fm);
    await beat(tok, ms);
    glow(T.keys[j], null);
  }
  return 0;
}

// ════════ MfhjkfocRR0（Paul） ════════
// 00:00 key / value 與底層陣列
FRAG.push(['hasha-kv', 'Hash table：key 對應 value', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  cube('Paul', HA[0], [1.8, 0.7, 1.0], -3.5, 0.35, -2.5, 3); tag('key', 'idx', -3.5, 0, -1.6);
  say('Hash table：用來存資料', '每筆資料 = (key, value)');
  await beat(tok, 3200);
  cube('電話號碼', HA[1], [1.8, 0.7, 1.0], 3.5, 0.35, -2.5, 3); tag('value / record', 'idx', 3.5, 0, -1.6);
  arrow(V3(-2.5, 0.4, -2.5), V3(2.5, 0.4, -2.5));
  say('例：key = 名字、value = 電話', 'Paul → Paul 的電話號碼');
  await beat(tok, 2800);
  say('實作 associative array 的方法', '把 key 對應（map）到 value');
  await beat(tok, 2600);
  haRow(5, 1.7, 1.6);
  tag('array', 'ptr', -5.2, 0.8, 1.6);
  say('核心：一個陣列', 'index 0、1、2、3、4');
  await beat(tok, 3400);
  say('真正實作時表會大很多', '5 格只是為了畫在白板上');
  await beat(tok, 3000);
}]);

// 01:27 hash function：key → index（Paul → 3、其他人 → 1、2、4）
async function haHashTo(tok, T, label, idx, color, cap, fm) {
  const c = cube(label, color, [1.4, 0.7, 0.9], -5.5, 0.35, -2.6, 3);
  await beat(tok, 600);
  move(c, 0, 0.5, -2.6);
  await beat(tok, 900);
  const o = tag('index ' + idx, 'ptr alt', 1.9, 1.5, -2.6);
  say(cap, fm);
  await beat(tok, 1300);
  move(c, T.xs[idx], 0.47, T.z); kill(o);
  T.keys[idx] = c; T.vals[idx] = label;
  await beat(tok, 1300);
  return c;
}
FRAG.push(['hasha-paul', 'Hash function：hash(Paul) = 3', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  const T = haRow(5, 1.7, 1.6);
  const hb = ghostBox('#c08a1f', 2.2, 1.4, 1.6); hb.position.set(0, 0.7, -2.6);
  tag('hash( )', 'ptr', 0, 1.9, -2.6);
  say('hash function：吃 key、吐 index', 'hash(key) → index');
  await beat(tok, 2600);
  await haHashTo(tok, T, '● Paul', 3, HA[0], 'hash(Paul) = 3：存到 index 3', 'hash("Paul") = 3');
  const again = cube('● Paul', HA[0], [1.4, 0.7, 0.9], -5.5, 0.35, -2.6, 3);
  await beat(tok, 500); move(again, 0, 0.5, -2.6); await beat(tok, 900);
  const o = tag('index 3', 'ptr alt', 1.9, 1.5, -2.6); glow(T.keys[3], GOLD);
  say('同一個 key，每次都得到同一個 index', '再算一次 hash("Paul") 還是 3');
  await beat(tok, 2600);
  kill(again); kill(o); glow(T.keys[3], null);
  await haHashTo(tok, T, '■ 某人', 1, HA[1], '另一個人：hash 得 1', 'hash(某人) = 1');
  await haHashTo(tok, T, '▲ 某人', 2, HA[2], '再一個：index 2', 'hash(某人) = 2');
  await haHashTo(tok, T, '◆ 某人', 4, HA[3], '菱形那位：index 4', 'hash(某人) = 4');
  say('每個圖形 = 一筆名字＋電話', '位置全由 hash function 決定');
  await beat(tok, 3000);
}]);

// 03:24 collision：又一個人 hash 到 3 → chaining
FRAG.push(['hasha-chain3', 'Collision 與 chaining：index 3', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const T = haRow(5, 1.7, -1.8);
  [['■ 某人', 1, HA[1]], ['▲ 某人', 2, HA[2]], ['● Paul', 3, HA[0]], ['◆ 某人', 4, HA[3]]].forEach(([l, i, c]) => { T.keys[i] = cube(l, c, [1.4, 0.7, 0.9], T.xs[i], 0.47, T.z); });
  say('再加一個人：hash 結果也是 3', 'hash(〰 某人) = 3');
  const n1 = cube('〰 某人', HA[4], [1.4, 0.7, 0.9], -5.5, 0.4, 1.6, 3);
  await beat(tok, 2400);
  glow(T.keys[3], RED); move(n1, T.xs[3] - 2.6, 0.4, 0.6);
  say('index 3 已經有人了：collision', 'Paul 已經占住 [3]');
  await beat(tok, 2800);
  glow(T.keys[3], null);
  say('解法很多；這裡用 chaining', '從 index 3 拉出一條 linked list');
  await beat(tok, 2200);
  move(n1, T.xs[3], 0.4, 0.4);
  arrow(V3(T.xs[3], 0.5, -1.15), V3(T.xs[3], 0.5, -0.05));
  await beat(tok, 1200);
  say('〰 接在 [3] 的串列上', '[3]：Paul → 〰');
  await beat(tok, 2400);
  const n2 = cube('≀ 某人', HA[5], [1.4, 0.7, 0.9], -5.5, 0.4, 2.6, 3);
  say('又一個 hash 到 3：繼續往後接', 'hash(≀ 某人) = 3');
  await beat(tok, 1600);
  move(n2, T.xs[3], 0.4, 2.2);
  arrow(V3(T.xs[3], 0.5, 0.85), V3(T.xs[3], 0.5, 1.75));
  await beat(tok, 1200);
  say('這就叫 chaining', '[3]：Paul → 〰 → ≀，都屬於 index 3');
  await beat(tok, 3000);
}]);

// 05:03 查詢：hash(某人) = 1，只看 index 1 的串列
FRAG.push(['hasha-lookup', '查詢：hash 直接告訴你去哪一格', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.4, 0.6]);
  const T = haRow(5, 1.7, -2.6);
  ['▲', '■', '◆', '●', '♣'].forEach((l, i) => { T.keys[i] = cube(l, HA[i], [1.2, 0.7, 0.9], T.xs[i], 0.47, T.z); });
  const ch = [['甲', HA[5]], ['乙', HA[6]], ['★ 要找的人', HA[4]]].map(([l, c], r) => {
    arrow(V3(T.xs[1], 0.5, T.z + 0.5 + r * 1.6), V3(T.xs[1], 0.5, T.z + 1.3 + r * 1.6));
    return cube(l, c, [1.5, 0.6, 0.8], T.xs[1], 0.35, T.z + 1.75 + r * 1.6);
  });
  say('存了一大堆人之後，想查某人的電話', '已知 key（名字），要找 value');
  await beat(tok, 2800);
  const k = cube('★', HA[4], [0.9, 0.7, 0.9], -5.6, 0.4, 3.2, 3);
  say('把 key 丟進 hash function', 'hash(★) = 1');
  await beat(tok, 2200);
  const cur = tag('hash → 1', 'ptr alt', T.xs[1], 1.9, T.z);
  const skip = [0, 2, 3, 4].map((i) => tag('不用看', 'idx', T.xs[i], 1.5, T.z));
  say('直接去 index 1，其他格都不用看', '就算表有一百萬格也一樣');
  await beat(tok, 3000);
  skip.forEach(kill);
  for (let r = 0; r < ch.length; r++) {
    const c = ch[r];
    cur.position.set(T.xs[1] + 1.6, 1.0, T.z + 1.75 + r * 1.6); txt(cur, '比對');
    glow(c, r === 2 ? GREEN : GOLD);
    say(r === 2 ? '找到了，取出他的電話' : '沿著 chain 往下找', r === 2 ? '只走了 index 1 的串列' : '第 ' + (r + 1) + ' 個節點：不是');
    await beat(tok, 1600);
    if (r < 2) glow(c, null);
  }
  move(k, T.xs[1] - 1.9, 0.4, T.z + 1.75 + 2 * 1.6);
  say('做得好的話，每條 chain 都很短', 'collision 時才用 linked list 接起來');
  await beat(tok, 3000);
}]);

// ════════ CwM-Cxilk4g（Linear Probing） ════════
// 03:36 把空格用起來：10, 20, 30, 40 往下一格放
FRAG.push(['hasha-lp-idea', 'Linear probing：撞了就放下一格', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[0], 1.8, T.z);
  say('同樣 h(x) = x mod 10，表有 10 格', '想把空著的格子用起來');
  await beat(tok, 2400);
  for (const k of [10, 20, 30, 40]) await haInsert(tok, T, k, haLin, cur, 1050);
  say('一般式：h_i(x) = (hash(x) + f(i)) mod 10', 'linear probing：f(i) = i');
  await beat(tok, 2800);
  say('第一次 f(0) = 0，就是原本的 hash(x)', '撞了再 +1、+2、+3… 直到不撞');
  await beat(tok, 3000);
}]);

// 06:01 正式定義：h₀, h₁, h₂… 依序嘗試、wrap around
FRAG.push(['hasha-probe-def', 'Probe sequence：h_i(x) = (hash(x) + f(i)) mod m', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, -0.4]);
  const cd = code(['h_i(x) = (hash(x) + f(i)) mod TableSize', 'f(0) = 0', 'linear     f(i) = i', 'quadratic  f(i) = i²', 'double     f(i) = i·hash₂(x)'], 0, 5.4, 0.5, -3.2);
  const T = haRow(10, 1.15, 1.4);
  cd.hl(0);
  say('h₀、h₁、h₂… 依序嘗試', 'h_i(x) = (hash(x) + f(i)) mod TableSize');
  await beat(tok, 2800);
  cd.hl(1);
  say('f(0) = 0：第一格就是 hash(x)', 'hash(x) = x mod 10');
  await beat(tok, 2200);
  cd.hl(2);
  say('三種常見：linear、quadratic、double', '這一講用 linear：f(i) = i');
  await beat(tok, 2600);
  haPlace(T, 0, 10, true);
  await beat(tok, 700);
  const cur = tag('h₀', 'ptr alt', T.xs[0], 1.8, T.z);
  await haInsert(tok, T, 20, haLin, cur, 1300);
  say('20 第一次撞 → f(1) = 1 → 下一格', '依序掃描，找到空格為止');
  await beat(tok, 2400);
  cur.position.set(T.xs[9], 1.8, T.z); txt(cur, '[9]');
  await beat(tok, 900);
  arrow(V3(T.xs[9], 1.2, T.z - 0.9), V3(T.xs[0], 1.2, T.z - 0.9), 0xc08a1f);
  cur.position.set(T.xs[0], 1.8, T.z - 0.2); txt(cur, '→ [0]');
  say('走到最後一格就 wrap around 回 [0]', '(9 + 1) mod 10 = 0');
  await beat(tok, 3000);
}]);

// 07:30 依序 insert 89, 18, 49, 58, 9
FRAG.push(['hasha-lp-89', 'Linear probing：insert 89, 18, 49, 58, 9', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[9], 1.8, T.z);
  say('表大小 10，hash(x) = x mod 10', '依序 insert 89, 18, 49, 58, 9');
  await beat(tok, 2400);
  const cnt = [];
  for (const k of [89, 18, 49, 58, 9]) cnt.push([k, await haInsert(tok, T, k, haLin, cur, 1000)]);
  say('49→[0]、58→[1]、9→[2]', cnt.map(([k, n]) => k + '：' + n + ' 次').join('　'));
  await beat(tok, 3200);
}]);

// 13:19 表大小 11：成功搜尋平均 15/8、失敗搜尋要走到空格
FRAG.push(['hasha-avg11', '平均 probe 次數：表大小 11', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = haRow(11, 1.05, 0.6);
  [[0, 9], [2, 2], [3, 13], [4, 25], [5, 24], [8, 30], [9, 20], [10, 10]].forEach(([i, k]) => haPlace(T, i, k));
  say('表大小 11，已放 8 個 key', 'hash(x) = x mod 11');
  await beat(tok, 2600);
  const cur = tag('h₀', 'ptr alt', T.xs[9], 1.8, T.z);
  for (const k of [20, 30, 2, 13, 25]) {
    const n = await haFind(tok, T, k, haLin, cur, 700);
    tag(n + ' 次', 'idx', T.xs[T.vals.indexOf(k)], 1.2, T.z - 0.7);
  }
  tag('4 次', 'idx', T.xs[5], 1.2, T.z - 0.7); tag('1 次', 'idx', T.xs[10], 1.2, T.z - 0.7); tag('3 次', 'idx', T.xs[0], 1.2, T.z - 0.7);
  say('8 個 key 的 probe 次數加起來 = 15', '成功搜尋平均 = 15/8 ≈ 1.88 < 2');
  await beat(tok, 3200);
  await haFind(tok, T, 0, haLin, cur, 1000);
  await haFind(tok, T, 4, haLin, cur, 1000);
  say('失敗搜尋要走到空格才能停', '<span class="no">失敗搜尋比成功搜尋貴</span>');
  await beat(tok, 3000);
}]);

// ════════ mFY0J5W8Udk（Abdul Bari） ════════
const BARI = [8, 3, 13, 6, 4, 10];
// 00:01 linear search O(n) vs binary search O(log n)
FRAG.push(['hasha-search-cmp', 'Linear search O(n) vs Binary search O(log n)', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const xs = BARI.map((_, i) => -3.75 + i * 1.5);
  const top = BARI.map((v, i) => cube(v, haCol(v), [1.1, 0.7, 1.0], xs[i], 0.35, -2.2, 3));
  const srt = [...BARI].sort((a, b) => a - b);
  tag('任意順序', 'ptr', -5.8, 0.9, -2.2);
  say('Linear search：元素任意排列', '從左到右一個一個找 → O(n)');
  await beat(tok, 2200);
  const cur = tag('▼', 'ptr alt', xs[0], 1.6, -2.2);
  for (let i = 0; i < top.length; i++) {
    cur.position.set(xs[i], 1.6, -2.2); glow(top[i], BARI[i] === 10 ? GREEN : GOLD);
    say('找 10：比對 ' + BARI[i], BARI[i] === 10 ? '比了 ' + (i + 1) + ' 次才找到' : '不是，往右');
    await beat(tok, 800);
    if (BARI[i] !== 10) glow(top[i], null);
  }
  await beat(tok, 1000);
  const bot = srt.map((v, i) => cube(v, haCol(v), [1.1, 0.7, 1.0], xs[i], 0.35, 1.8, 3));
  srt.forEach((_, i) => tag(String(i), 'idx', xs[i], 0, 2.8));
  tag('已排序', 'ptr', -5.8, 0.9, 1.8);
  say('Binary search：必須先排好序', '每次看中間，砍掉一半 → O(log n)');
  await beat(tok, 2400);
  cur.position.set(xs[2], 1.6, 1.8); glow(bot[2], GOLD);
  say('mid = 2：6 < 10 → 往右半邊', 'low = 0, high = 5, mid = 2');
  await beat(tok, 2000);
  for (let i = 0; i <= 2; i++) tint(bot[i], GRAY);
  cur.position.set(xs[4], 1.6, 1.8); glow(bot[4], GREEN);
  say('mid = 4：找到 10', '只比了 2 次（但要先花時間排序）');
  await beat(tok, 2400);
  say('想要更快：O(n) → O(log n) → O(1)', '這就是 hashing 的目標');
  await beat(tok, 3000);
}]);

// 01:55 直接拿值當 index
FRAG.push(['hasha-direct', '直接拿 key 當 index：O(1) 但浪費空間', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = haRow(14, 0.92, 0.6);
  say('最簡單的 hashing：值是多少就放第幾格', '8 放 [8]、3 放 [3]…');
  await beat(tok, 2200);
  for (const k of BARI) { haPlace(T, k, k, true); await beat(tok, 650); }
  await beat(tok, 900);
  const cur = tag('▼', 'ptr alt', T.xs[10], 1.8, T.z);
  glow(T.keys[10], GREEN);
  say('search 10：直接看 [10] → 找到', 'O(1)');
  await beat(tok, 2400);
  glow(T.keys[10], null);
  cur.position.set(T.xs[12], 1.8, T.z); glow(T.slots[12], RED);
  say('search 12：[12] 是空的 → not found', '一步就知道，還是 O(1)');
  await beat(tok, 2400);
  glow(T.slots[12], null); kill(cur);
  cube(50, haCol(50), [0.8, 0.7, 0.9], 5.6, 0.4, -2.4, 3);
  tag('要 index 50？', 'ptr', 5.6, 1.6, -2.4);
  say('再來一個 50：表得開到 index 50', '<span class="no">只存 7 個數，卻要 51 格</span>');
  await beat(tok, 2800);
  for (let i = 0; i < T.m; i++) if (T.keys[i] === null) glow(T.slots[i], RED);
  say('為了省時間，浪費大量空格', '大部分格子都空著');
  await beat(tok, 3000);
}]);

// 03:34 數學模型：key space → hash table，h(x) = x
FRAG.push(['hasha-model', 'Key space → Hash table：h(x) = x', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0]);
  const ks = ghostBox('#9b7ef4', 9.6, 1.2, 1.6); ks.position.set(0, 0.6, -3.2);
  tag('key space', 'ptr', -5.6, 1.2, -3.2);
  const kx = BARI.map((_, i) => -3.75 + i * 1.5);
  BARI.forEach((v, i) => cube(v, haCol(v), [0.9, 0.7, 0.9], kx[i], 0.4, -3.2, 3));
  const T = haRow(14, 0.92, 1.8);
  tag('hash table', 'ptr', -6.3, 1.0, 1.8);
  say('key space：手上的這些 key', 'hash table：存放的地方');
  await beat(tok, 2600);
  const arr = [];
  for (let i = 0; i < BARI.length; i++) {
    const k = BARI[i];
    arr.push(arrow(V3(kx[i], 0.5, -2.35), V3(T.xs[k], 0.6, T.z - 0.65), 0x9b7ef4));
    haPlace(T, k, k, true);
    say('h(' + k + ') = ' + k, 'hash function 把 key 映射到 table');
    await beat(tok, 900);
  }
  say('h(x) = x：理想的 hash function', '<span class="ok">one-to-one</span>：每個 key 一格');
  await beat(tok, 3000);
  say('但 key = 50 就要 index 50', '表還是太長、太浪費');
  await beat(tok, 2600);
  arr.forEach(kill);
  say('函數分兩種：one-to-one、many-to-one', '其他 hash function 多半是 many-to-one');
  await beat(tok, 2800);
  say('要改函數，把空間用得更有效率', '下一步：h(x) = x mod size');
  await beat(tok, 3000);
}]);

// 05:59 h(x) = x mod 10：13 撞 3 → collision
FRAG.push(['hasha-mod10', 'h(x) = x mod 10：13 與 3 撞在一起', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  const T = haRow(10, 1.15, 1.2);
  say('改用 h(x) = x mod size', 'size = 10 → 只要 10 格');
  await beat(tok, 3200);
  const cur = tag('h₀', 'ptr alt', T.xs[8], 1.8, T.z);
  for (const k of [8, 3]) {
    cur.position.set(T.xs[k % 10], 1.8, T.z); txt(cur, 'h(' + k + ')');
    haPlace(T, k % 10, k, true);
    say(k + ' mod 10 = ' + (k % 10), '放進 [' + (k % 10) + ']');
    await beat(tok, 1500);
  }
  const c13 = cube(13, haCol(13), [0.9, 0.7, 0.9], T.xs[3], 1.9, T.z, 0);
  cur.position.set(T.xs[3], 2.8, T.z); txt(cur, 'h(13)');
  glow(T.keys[3], RED); glow(c13, RED);
  say('13 mod 10 = 3：[3] 已經有 3 了', '<span class="no">collision</span>');
  await beat(tok, 3400);
  say('兩個以上 key 對到同一個 index', '這就叫 collision，必須處理');
  await beat(tok, 2400);
  tag('open hashing → chaining', 'ptr', -2.8, 1.0, -2.8);
  tag('closed hashing → linear / quadratic probing', 'ptr', 2.0, 1.0, -4.2);
  say('解法：open hashing 與 closed hashing', 'chaining｜linear probing、quadratic probing');
  await beat(tok, 3200);
}]);

// 07:41 chaining：8, 3, 13, 6, 4, 10；search 13
FRAG.push(['hasha-bari-chain', 'Chaining：8, 3, 13, 6, 4, 10', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.2]);
  const T = haRow(10, 1.15, -2.6);
  const len = new Array(10).fill(0), nodes = {};
  say('chaining：元素不放在表本身', '每個 index 掛一條 chain（linked list）');
  await beat(tok, 2400);
  for (const k of BARI) {
    const j = k % 10, z = T.z + 1.75 + len[j] * 1.6;
    arrow(V3(T.xs[j], 0.5, z - 1.25), V3(T.xs[j], 0.5, z - 0.45));
    nodes[k] = cube(k, haCol(k), [0.9, 0.6, 0.8], T.xs[j], 0.35, z, 3);
    len[j]++;
    say('insert ' + k + '：' + k + ' mod 10 = ' + j, len[j] > 1 ? 'collision → 接在 [' + j + '] 的 chain 後面' : '在 [' + j + '] 加一個節點');
    await beat(tok, k === 13 ? 2400 : 1300);
  }
  const cur = tag('h(13) = 3', 'ptr alt', T.xs[3], 1.8, T.z);
  say('search 13：13 mod 10 = 3', '到 index 3 的 chain 裡找');
  await beat(tok, 2200);
  glow(nodes[3], GOLD); cur.position.set(T.xs[3] + 1.4, 1.0, nodes[3].position.z); txt(cur, '比對');
  say('第一個是 3，不是', '同一條 chain 可能有好幾個');
  await beat(tok, 1800);
  glow(nodes[3], null); glow(nodes[13], GREEN); cur.position.set(T.xs[3] + 1.4, 1.0, nodes[13].position.z);
  say('下一個是 13：找到', '要搜整條 linked list');
  await beat(tok, 2200);
  say('不是 O(1)，但比 O(log n) 快', '時間取決於 chain 長度');
  await beat(tok, 3000);
}]);

// 09:44 linear probing：8, 3, 13, 6, 4, 10；search 4、24；clustering
FRAG.push(['hasha-bari-lp', 'Linear probing：search 4 與 24', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[8], 1.8, T.z);
  say('同一個 h(x) = x mod 10', 'h\'(x) = (h(x) + f(i)) mod 10，f(i) = i');
  await beat(tok, 2600);
  for (const k of BARI) await haInsert(tok, T, k, haLin, cur, k === 13 || k === 4 ? 1300 : 900);
  say('13 → [4]、4 → [5]、10 → [0]', '撞了就找下一個空位');
  await beat(tok, 2400);
  await haFind(tok, T, 4, haLin, cur, 1100);
  await haFind(tok, T, 24, haLin, cur, 900);
  say('search：找到或遇到空格才停', '從 h(x) 開始往後連續找');
  await beat(tok, 2200);
  for (const i of [3, 4, 5, 6]) glow(T.keys[i], GOLD);
  tag('cluster', 'ptr', T.xs[4] + 0.6, 1.4, T.z - 1.3);
  say('問題：元素擠在連續的一塊', '<span class="no">clustering → 搜尋變慢</span>');
  await beat(tok, 3000);
}]);

// 14:00 quadratic probing：f(i) = i²，23 跳到 [7]
FRAG.push(['hasha-bari-qp', 'Quadratic probing：23 跳到 [7]', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[8], 1.8, T.z);
  say('quadratic probing：避免 clustering', 'h\'(x) = (h(x) + f(i)) mod 10，f(i) = i²');
  await beat(tok, 2800);
  for (const k of [8, 3, 13]) await haInsert(tok, T, k, haQuad, cur, 1000);
  say('13：3 撞 → 3 + 1² = 4', '和 linear 一樣放在 [4]');
  await beat(tok, 2200);
  await haInsert(tok, T, 23, haQuad, cur, 1600);
  arrow(V3(T.xs[3], 1.3, T.z - 0.9), V3(T.xs[7], 1.3, T.z - 0.9), 0xc08a1f);
  say('23 被放到離衝突處遠一點的 [7]', '中間留空格 → 不容易擠成一團');
  await beat(tok, 3200);
}]);

// 12:44 clustering：89,18,49,58,9 擠成 [8]～[2] 一大塊
FRAG.push(['hasha-cluster', 'Clustering：撞進群聚就要走到底', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = haRow(10, 1.15, 0.6);
  [[9, 89], [8, 18], [0, 49], [1, 58], [2, 9]].forEach(([i, k]) => haPlace(T, i, k));
  say('剛才的表：89, 18, 49, 58, 9', '表夠大，空格一定找得到');
  await beat(tok, 3200);
  for (const i of [8, 9, 0, 1, 2]) glow(T.keys[i], GOLD);
  tag('cluster', 'ptr', T.xs[0] + 0.6, 1.4, T.z - 1.3);
  say('連續被占的一大塊 = cluster', '[8] [9] [0] [1] [2]');
  await beat(tok, 3200);
  const cur = tag('h₀', 'ptr alt', T.xs[8], 1.8, T.z);
  const seq = [8, 9, 0, 1, 2, 3];
  for (let i = 0; i < seq.length; i++) {
    cur.position.set(T.xs[seq[i]], 1.8, T.z); txt(cur, 'h' + haSub(i));
    const last = i === seq.length - 1;
    if (last) glow(T.slots[3], GREEN);
    say(last ? '第 6 次才到空格 [3]' : 'hash 到 8：一路往下走', 'probe ' + (i + 1) + '：[' + seq[i] + ']');
    await beat(tok, last ? 1600 : 800);
  }
  say('cluster 越大，找的時間越長', 'primary clustering → 要讓 λ < 0.5');
  await beat(tok, 3000);
}]);
  }

  // ═══ hashlin1.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, lnode, tnode, GOLD, GREEN, RED, GRAY } = K;
// ─── SBQLkYIDAZI（台大林軒田 DSA：binomial heap → map → hash function 入門） ───
const HL = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f'];
const hlOrd = (k) => HL[k % HL.length];
const hlSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const hlBin = (n) => n.toString(2);
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
// forest as array F[k] = tree of order k or null; drawn highest order on the left like binary digits
const fSum = (F) => F.reduce((a, t, k) => a + (t ? 1 << k : 0), 0);
function fList(F) { const r = []; for (let k = F.length - 1; k >= 0; k--) if (F[k]) r.push(F[k]); return r; }
function fShow(st, F, carry, o, drop) {
  if (st.v) st.v.kill();
  const ts = fList(F); if (carry) ts.push(carry);
  st.v = bnForest(ts, Object.assign({}, o, { drop, tagOf: (t) => (t === carry ? '新 ' : '') + 'B' + hlSub(t.kids.length) }));
}
// binomial-heap insert = binary +1: a new B0, then carries (root fights) while that order is taken
async function bnInsert(tok, F, v, st, o = {}) {
  const ms = o.ms || 1500, n0 = fSum(F);
  let c = BN(v), k = 0;
  fShow(st, F, c, o, new Set([c]));
  say('insert ' + v + '：自己是一棵 B₀', hlBin(n0) + '₂ + 1 = ' + hlBin(n0 + 1) + '₂');
  await beat(tok, ms);
  while (F[k]) {
    const a = F[k];
    glow(a.m, GOLD); glow(c.m, GOLD);
    say('兩棵 B' + hlSub(k) + '：' + a.v + ' 和 ' + c.v + ' 打一架', '只比兩個 root（老大）');
    await beat(tok, ms);
    const { w, l } = bnLink(a, c);
    F[k] = null; k++; c = w;
    fShow(st, F, c, o, new Set(bnAll(l)));
    say(w.v + ' 贏放上面，' + l.v + ' 掛下面', '進位：變成一棵 B' + hlSub(k));
    await beat(tok, ms);
  }
  F[k] = c; fShow(st, F, null, o);
  return k;
}
// array-heap slot i → (x, y) in a complete binary tree layout
function hpPos(i, cx, top, W, dy) { const d = Math.floor(Math.log2(i + 1)), p = i + 1 - (1 << d); return [cx + (p + 0.5) * W / (1 << d) - W / 2, top - d * dy]; }

// ════════ SBQLkYIDAZI（林軒田 DSA） ════════
// 08:07 heap 與 max tree 的差別：complete 保證高度
FRAG.push(['hashlin1-maxtree-vs-heap', 'Max tree 與 heap：差在 complete', async (tok) => {
  fresh([0, 5.2, 12.5], [0, 2.4, 0]);
  const vals = [9, 7, 5, 3, 1];
  tag('只滿足 max tree', 'ptr', -4.6, 6.0);
  say('max tree：root 最大、subtree root 也最大', '其他什麼都不保證');
  let par = null; const L = [];
  for (let i = 0; i < 5; i++) { par = tnode(vals[i], -5.6 + i * 0.55, 4.9 - i * 1.1, 0, par); L.push(par); await beat(tok, 380); }
  await beat(tok, 1000);
  say('可能退化成一條 linked list', '高度沒保證：worst case O(n)');
  const cur = tag('走到 leaf', 'ptr alt', 0, 0, 0);
  for (const m of L) { cur.position.set(m.position.x + 1.3, m.position.y, 0); glow(m, GOLD); await beat(tok, 420); glow(m, null); }
  await beat(tok, 900);
  tag('heap = complete + max tree', 'ptr', 3.0, 6.0);
  const H = [];
  for (let i = 0; i < 5; i++) { const [x, y] = hpPos(i, 3.0, 4.9, 5.2, 1.6); H.push(tnode(vals[i], x, y, 0, i ? H[(i - 1) >> 1] : null)); await beat(tok, 380); }
  say('complete binary tree：高度最小', 'n 個 node → 高度 ⌊log₂n⌋');
  await beat(tok, 2600);
  for (const i of [0, 1, 3]) { cur.position.set(H[i].position.x + 1.3, H[i].position.y, 0); glow(H[i], GOLD); await beat(tok, 420); glow(H[i], null); }
  say('heap 的操作都跟樹高有關', 'insert / remove 都只要 O(log n)');
  await beat(tok, 3400);
}]);

// 27:17 回顧：priority queue 與 max heap 的 insert / removeMax
FRAG.push(['hashlin1-heap-recap', '回顧 max heap：insert 往上打、remove 往下沉', async (tok) => {
  fresh([0, 5, 11.5], [0, 2.2, 0]);
  const pos = (i) => hpPos(i, 0, 4.4, 7.2, 1.45);
  const V = [9, 7, 5, 3, 1], M = [];
  for (let i = 0; i < 5; i++) { const [x, y] = pos(i); if (i) { const [px, py] = pos((i - 1) >> 1); line(px, py, x, y); } M.push(cube(V[i], colorFor(V[i]), [0.8, 0.8, 0.8], x, y, 0)); }
  say('priority queue：最緊急的先做', 'max heap = complete binary tree + max tree');
  await beat(tok, 2600);
  const swap = async (i, j) => {
    const [xi, yi] = pos(i), [xj, yj] = pos(j);
    move(M[i], xj, yj); move(M[j], xi, yi);
    [M[i], M[j]] = [M[j], M[i]]; [V[i], V[j]] = [V[j], V[i]];
    await beat(tok, 900);
  };
  const [x5, y5] = pos(5), [x2, y2] = pos(2);
  const e5 = line(x2, y2, x5, y5);
  M.push(cube(8, colorFor(8), [0.8, 0.8, 0.8], x5, y5, 0, 3)); V.push(8);
  say('insert 8：先放在最後面', 'heap[5] = 8，維持 complete');
  await beat(tok, 1800);
  glow(M[5], GOLD); glow(M[2], GOLD);
  say('跟 parent 5 打一架：8 > 5', '往上浮（sift up）');
  await beat(tok, 1300);
  await swap(5, 2); glow(M[5], null);
  glow(M[0], GOLD);
  say('再跟 9 打：8 < 9，停', '最多爬 ⌊log₂n⌋ 層 → O(log n)');
  await beat(tok, 2200);
  glow(M[0], null); glow(M[2], null);
  fly(M[0]);
  say('removeMax：拿走 root 9', '群龍無首，最後一個先上來補位');
  await beat(tok, 1500);
  const [x0, y0] = pos(0);
  move(M[5], x0, y0); M[0] = M[5]; V[0] = V[5]; M.pop(); V.pop(); kill(e5);
  await beat(tok, 1200);
  glow(M[0], GOLD); glow(M[1], GOLD); glow(M[2], GOLD);
  say('5 跟小孩比：較大的 8 上來', '往下沉（sift down）');
  await beat(tok, 1500);
  glow(M[1], null);
  await swap(0, 2);
  glow(M[0], null); glow(M[2], null);
  say('remove 也是 O(log n)', 'heap = [8, 7, 5, 3, 1]');
  await beat(tok, 2800);
}]);

// 30:07 能不能 insert 只花 constant？亂放很快，但找 max 變慢
FRAG.push(['hashlin1-o1-insert', 'Insert 只花 constant？', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const vals = [4, 9, 2, 7, 5, 8, 1, 6], M = [];
  say('目標：insert 只花 constant', '跟資料量 n 無關');
  await beat(tok, 2200);
  for (let i = 0; i < vals.length; i++) {
    M.push(cube(vals[i], colorFor(vals[i]), [0.8, 0.8, 0.8], -4.6 + i * 1.3, 0.4, ((i * 5) % 3 - 1) * 1.5, 3));
    say('insert ' + vals[i] + '：隨手一放', '每次 1 步');
    await beat(tok, 550);
  }
  await beat(tok, 700);
  const cur = tag('看', 'ptr alt', 0, 0, 0);
  let best = 0;
  say('可是 getMax 要整堆找一遍', '完全不整理 → O(n)');
  for (let i = 0; i < M.length; i++) { cur.position.set(M[i].position.x, 1.5, M[i].position.z); glow(M[i], GOLD); if (vals[i] > vals[best]) best = i; await beat(tok, 380); glow(M[i], null); }
  glow(M[best], GREEN); kill(cur);
  await beat(tok, 1200);
  say('想找得快，放進去時就要整理', '每次只准 10 步？像亂房間整理不完');
  await beat(tok, 3000);
  say('退一步：amortized constant', '有時多花、有時少花，平均固定');
  await beat(tok, 3000);
}]);

// 33:20 amortized：extendable array 一次長兩倍
FRAG.push(['hashlin1-doubling', 'Amortized：extendable array 長兩倍', async (tok) => {
  fresh([0, 6.5, 11], [0, 0.4, 0]);
  const dx = 0.95, x0 = -3.3;
  let cap = 1, rowZ = -1.3, row = [], items = [], cost = 0;
  const mkRow = (c, z) => Array.from({ length: c }, (_, i) => cube('', GRAY, [0.85, 0.1, 0.9], x0 + i * dx, 0.05, z));
  row = mkRow(cap, rowZ);
  const cnt = tag('總共 0 步', 'ptr alt', 0, 3.6, -2.5);
  say('Extendable array：滿了才變大', '一次長成兩倍');
  await beat(tok, 2000);
  for (let v = 1; v <= 8; v++) {
    if (items.length === cap) {
      cap *= 2; const nz = -rowZ, nr = mkRow(cap, nz);
      say('滿了！開 ' + cap + ' 格、全部搬家', '搬 ' + items.length + ' 個 = ' + items.length + ' 步');
      items.forEach((m, i) => move(m, x0 + i * dx, 0.45, nz));
      cost += items.length; txt(cnt, '總共 ' + cost + ' 步');
      await beat(tok, 1400);
      row.forEach(kill); row = nr; rowZ = nz;
    }
    items.push(cube(v, colorFor(v), [0.7, 0.7, 0.7], x0 + (items.length) * dx, 0.45, rowZ, 2.5));
    cost += 1; txt(cnt, '總共 ' + cost + ' 步');
    say('insert ' + v + '：有空位，1 步', 'capacity = ' + cap);
    await beat(tok, 800);
  }
  say('搬家很貴，但很少發生', '8 次 insert：8 + (1 + 2 + 4) = 15 步');
  await beat(tok, 3000);
  say('均攤下來每次不到 2 步', 'amortized O(1)');
  await beat(tok, 2800);
}]);

// 36:45 cheap insertion 常常做：插進小樹；很多棵樹 = forest
FRAG.push(['hashlin1-small-trees', '小樹插入便宜：改用很多棵樹', async (tok) => {
  fresh([0, 5.4, 12], [0, 2.1, 0]);
  const draw = (n, cx, W, top, dy, col) => {
    const ms = [];
    for (let i = 0; i < n; i++) { const [x, y] = hpPos(i, cx, top, W, dy); if (i) { const [px, py] = hpPos((i - 1) >> 1, cx, top, W, dy); line(px, py, x, y); } ms.push(cube('', col, [0.55, 0.55, 0.55], x, y, 0)); }
    return ms;
  };
  const big = draw(14, -2.6, 7, 4.2, 1.15, '#4b9ee2');
  const small = draw(5, 4.6, 3.2, 2.6, 1.0, '#2fc092');
  tag('大樹', 'ptr', -2.6, 5.2); tag('小樹', 'ptr', 4.6, 3.6);
  say('cheap insertion 常常做', 'expensive 偶爾做，平均起來便宜');
  await beat(tok, 2600);
  const climb = async (cx, W, top, dy, from, steps, ms) => {
    const [x, y] = hpPos(from, cx, top, W, dy); const [px, py] = hpPos((from - 1) >> 1, cx, top, W, dy);
    line(px, py, x, y);
    const nw = cube('新', '#dd8238', [0.6, 0.6, 0.6], x, y, 0, 2.5);
    await beat(tok, 900);
    let i = from;
    for (let s = 0; s < steps; s++) { const p = (i - 1) >> 1; const [qx, qy] = hpPos(p, cx, top, W, dy); move(nw, qx, qy + 0.6); i = p; await beat(tok, ms); }
    return nw;
  };
  say('大樹：264 個 node 放第 265 個', '最多往上打 ⌊log₂265⌋ = 8 層');
  await climb(-2.6, 7, 4.2, 1.15, 14, 3, 800);
  await beat(tok, 900);
  say('小樹：只有 5 個 node', '最多打 2 層就到頂');
  await climb(4.6, 3.2, 2.6, 1.0, 5, 2, 800);
  await beat(tok, 900);
  say('把大樹拆成很多棵小樹', '通常插進小樹，小樹滿了才插大樹');
  await beat(tok, 3000);
  say('很多棵樹的資料結構 = forest', '森林：有小樹也有大樹');
  await beat(tok, 2800);
}]);

// 39:46 binomial tree B0..B3、|B_k| = 2^k、B_k = 兩棵 B_{k-1}
FRAG.push(['hashlin1-binomial-trees', 'Binomial tree：B₀、B₁、B₂、B₃', async (tok) => {
  fresh([0, 4.6, 11.5], [0, 1.6, 0]);
  const sp = 0.85, gap = 1.3, ts = [0, 1, 2, 3].map(bnMake);
  const W = ts.reduce((a, t) => a + bnW(t) * sp, 0) + gap * 3;
  let x = -W / 2; const cxs = ts.map((t) => { const c = x + bnW(t) * sp / 2; x += bnW(t) * sp + gap; return c; });
  const msgs = [['B₀：只有一個 node', '|B₀| = 1'], ['B₁：root 下面接一棵 B₀', '|B₁| = 2'], ['B₂：root 下面接 B₀ 和 B₁', '|B₂| = 4'], ['B₃：root 下面接 B₀、B₁、B₂', '|B₃| = 8']];
  for (let k = 0; k < 4; k++) {
    bnForest([ts[k]], { cx: cxs[k], sp, dy: 1.0, col: () => hlOrd(k) });
    tag((1 << k) + ' 個 node', 'idx', cxs[k], 0, 1.1);
    say(msgs[k][0], msgs[k][1]);
    await beat(tok, 2600);
  }
  say('B_k 有 2ᵏ 個 node', '1、2、4、8 …');
  await beat(tok, 2400);
  const t3 = ts[3], half = bnAll(t3.kids[2]);
  bnAll(t3).forEach((n) => glow(n.m, half.includes(n) ? GOLD : GREEN));
  say('B₃ = 兩棵 B₂ 接起來', '小樹 + 小樹 → 大樹');
  await beat(tok, 2800);
  const t2 = ts[2], h2 = bnAll(t2.kids[1]);
  bnAll(t2).forEach((n) => glow(n.m, h2.includes(n) ? GOLD : GREEN));
  say('B₂ = 兩棵 B₁、B₁ = 兩棵 B₀', 'B_k = 兩棵 B_{k−1}');
  await beat(tok, 2600);
  say('用它造森林、每棵放 max tree', '→ 有小 heap 也有大 heap');
  await beat(tok, 3000);
}]);

// 62:28 B3 的正確長相（multi-way）與 left-child right-sibling
FRAG.push(['hashlin1-lcrs', 'B₃ 是 general tree：left child, right sibling', async (tok) => {
  fresh([0, 4.6, 10.5], [0, 2.2, 0]);
  const t = bnMake(3); let c = 0;
  bnAll(t).forEach((n) => { n.v = 'abcdefgh'[c++]; });
  bnForest([t], { sp: 1.3, dy: 1.3, col: () => '#9b7ef4' });
  say('B₃：root 下面串 B₀、B₁、B₂', '也可看成兩棵 B₂ 合起來');
  await beat(tok, 2800);
  say('root 有 3 個小孩', '是 general tree，不是 binary tree');
  glow(t.m, GOLD); t.kids.forEach((k) => glow(k.m, GOLD));
  await beat(tok, 2600);
  bnAll(t).forEach((n) => { glow(n.m, null); if (n.edge) kill(n.edge); });
  for (const n of bnAll(t)) if (n.kids.length) { const f = n.kids[0]; arrow(V3(n.x, n.y - 0.32, 0), V3(f.x, f.y + 0.32, 0), 0x0f5a3a); glow(n.m, GREEN); await beat(tok, 450); glow(n.m, null); }
  say('left child：往左下走到第一個小孩', '一張小紙條指第一個小孩');
  await beat(tok, 2400);
  for (const n of bnAll(t)) for (let i = 0; i + 1 < n.kids.length; i++) { const a = n.kids[i], b = n.kids[i + 1]; arrow(V3(a.x + 0.32, a.y, 0), V3(b.x - 0.32, b.y, 0), 0xc08a1f); glow(a.m, GOLD); await beat(tok, 450); glow(a.m, null); }
  say('right sibling：往右串下一個兄弟', '另一張小紙條指兄弟');
  await beat(tok, 2400);
  say('每個 node 兩張小紙條', '就能用 binary tree 實作 general tree');
  await beat(tok, 3000);
}]);

// 65:53 node 數不是 2^k？用 forest：9 = 8 + 1
FRAG.push(['hashlin1-forest-9', '任意 n 個 node：9 = 8 + 1', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.8, 0]);
  say('full binary tree 只能 1、3、7、15 個', '所以 heap 改用 complete tree');
  await beat(tok, 2800);
  say('binomial tree 也只有 1、2、4、8 個', '任意 n 怎麼辦？用 forest');
  await beat(tok, 2800);
  const place = [8, 4, 2, 1], bits = [1, 0, 0, 1];
  const bl = place.map((p, i) => { tag(String(p), 'idx', -2.4 + i * 1.6, 5.6, -1.5); return tag('·', 'ptr', -2.4 + i * 1.6, 5.0, -1.5); });
  for (let i = 0; i < 4; i++) { txt(bl[i], String(bits[i])); await beat(tok, 450); }
  say('9 = 8 + 1 = 1001₂', '十進位轉二進位');
  await beat(tok, 2400);
  const ts = [bnMake(3), bnMake(0)];
  bnForest(ts, { sp: 0.9, gap: 2.2, col: (n, t) => hlOrd(t.kids.length) });
  say('一棵 B₃（8 個）＋一棵 B₀（1 個）', 'size 1 的樹是 B₀（不是 B₁）');
  await beat(tok, 3000);
  say('1 的位置 ↔ 要哪一棵 B_k', '1001₂ → B₃ + B₀');
  await beat(tok, 2600);
}]);

// 69:25 binomial tree 加上 max (multi-way) tree 性質
FRAG.push(['hashlin1-max-binomial', 'Max binomial tree：root 比整棵子樹大', async (tok) => {
  fresh([0, 4.6, 10.5], [0, 2.0, 0]);
  const t = BN(30, BN(12), BN(20, BN(8)), BN(25, BN(10), BN(18, BN(3))));
  bnForest([t], { sp: 1.3, dy: 1.25 });
  say('B₃ 是 multi-way tree', 'root 有 3 棵 subtree');
  await beat(tok, 2400);
  say('變成 heap：加上 max tree 性質', '要 min heap 就加 min tree 性質');
  await beat(tok, 2600);
  glow(t.m, GREEN);
  for (const c of t.kids) {
    bnAll(c).forEach((n) => glow(n.m, GOLD));
    say('root 30 比這棵 subtree 都大', '30 > ' + bnAll(c).map((n) => n.v).join('、'));
    await beat(tok, 1500);
    bnAll(c).forEach((n) => glow(n.m, null));
  }
  for (const s of [t.kids[1], t.kids[2], t.kids[2].kids[1]]) {
    glow(s.m, GREEN); s.kids.forEach((k) => glow(k.m, GOLD));
    say('subtree 裡 subroot ' + s.v + ' 也最大', s.v + ' > ' + s.kids.map((k) => k.v).join('、'));
    await beat(tok, 1400);
    glow(s.m, null); s.kids.forEach((k) => glow(k.m, null));
  }
  say('每一層都滿足 max tree', '= 一棵 max binomial tree');
  await beat(tok, 2800);
}]);

// 71:37 binomial forest：每種 B_k 最多一棵；10 = 8 + 2、17 = 16 + 1
FRAG.push(['hashlin1-forest-10-17', 'Binomial forest：10 與 17 個 node', async (tok) => {
  fresh([0, 5, 12], [0, 2.0, 0]);
  const o = { sp: 0.72, dy: 0.95, gap: 1.6, col: (n, t) => hlOrd(t.kids.length) };
  say('binomial forest：每種 B_k 最多一棵', '0 棵或 1 棵 ↔ 二進位的 0 / 1');
  await beat(tok, 2800);
  let v = bnForest([bnMake(3), bnMake(1)], o);
  say('10 = 8 + 2 = 1010₂', '一棵 B₃ ＋ 一棵 B₁');
  await beat(tok, 3000);
  v.kill();
  v = bnForest([bnMake(4), bnMake(0)], o);
  say('17 = 16 + 1 = 10001₂', '一棵 B₄ ＋ 一棵 B₀');
  await beat(tok, 3000);
  say('n 決定有哪些樹，是固定的', '樹裡的內容才會變');
  await beat(tok, 2600);
  say('binomial forest ＋ 一堆 max tree', '= binomial heap');
  await beat(tok, 3600);
}]);

// 75:10 從空的 binomial heap 依序 insert 5, 7, 3, 2（params.from = 2：只演 3 與 2 的進位）
FRAG.push(['hashlin1-insert-5732', 'Binomial heap：依序 insert 5, 7, 3, 2', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const F = new Array(6).fill(null), st = {}, o = { sp: 1.0, dy: 1.1, gap: 1.4 };
  let seq = [5, 7, 3, 2];
  if (P.from === 2) { F[1] = BN(7, BN(5)); seq = [3, 2]; fShow(st, F, null, o); say('已有 7、5 組成的 B₁', 'n = 2 = 10₂'); await beat(tok, 2200); }
  else { say('max binomial heap，一開始是空的', 'n = 0'); await beat(tok, 1800); }
  for (const v of seq) {
    const m = await bnInsert(tok, F, v, st, o);
    say(m ? '合併了 ' + m + ' 次' : '沒有進位，自己當 B₀', 'n = ' + fSum(F) + ' = ' + hlBin(fSum(F)) + '₂');
    await beat(tok, 1800);
  }
  say('最後一棵 B₂：root 7 最大', '3、2 掛在 7 下面，仍是 max tree');
  await beat(tok, 2800);
}]);

// 83:00 n 次 insert：merge 次數 n/2 + n/4 + … → amortized O(1)
FRAG.push(['hashlin1-amortized-counter', 'Insert 的 amortized O(1)：二進位 +1', async (tok) => {
  fresh([0, 5.2, 11.5], [0, 1.2, 0]);
  const X = (k) => 5 - k * 2.0, S = (k) => 0.55 + 0.16 * k;
  const B = new Array(7).fill(null), bits = [];
  for (let k = 0; k < 6; k++) { cube('', GRAY, [1.6, 0.1, 1.6], X(k), 0.05, 0); tag('B' + hlSub(k), 'idx', X(k), 0, 1.2); bits.push(tag('0', 'ptr', X(k), 3.0, 0)); }
  const cnt = tag('insert 0 次、merge 0 次', 'ptr alt', 0, 4.4, -1.5);
  let ins = 0, mg = 0;
  const mk = (k, z, drop) => cube('B' + hlSub(k), hlOrd(k), [S(k), S(k), S(k)], X(k), S(k) / 2, z, drop);
  async function inc(ms, talk) {
    const n0 = B.reduce((a, b, k) => a + (b ? 1 << k : 0), 0); ins++;
    let c = mk(0, 2.2, 2.5), k = 0;
    if (talk) say('insert：放進一棵 B₀', hlBin(n0) + '₂ + 1 = ' + hlBin(n0 + 1) + '₂');
    await beat(tok, ms);
    while (B[k]) {
      glow(B[k], GOLD); glow(c, GOLD);
      move(B[k], X(k), S(k) / 2, 2.2); await beat(tok, ms * 0.5);
      kill(B[k]); kill(c); B[k] = null; txt(bits[k], '0'); k++; mg++;
      c = mk(k, 2.2, 0);
      if (talk) say('兩棵 B' + hlSub(k - 1) + ' 合成 B' + hlSub(k), '進位一次 = merge 一次');
      txt(cnt, 'insert ' + ins + ' 次、merge ' + mg + ' 次');
      await beat(tok, ms * 0.6);
    }
    move(c, X(k), S(k) / 2, 0); B[k] = c; txt(bits[k], '1');
    txt(cnt, 'insert ' + ins + ' 次、merge ' + mg + ' 次');
    await beat(tok, ms * 0.5);
  }
  say('每次 insert 都塞一棵 B₀', '像二進位計數器 +1');
  await beat(tok, 1800);
  for (let i = 0; i < 8; i++) await inc(700, i < 4);
  say('每 2 次合 B₀、每 4 次合 B₁、每 8 次合 B₂', 'merge 共 n/2 + n/4 + n/8 + … < n');
  await beat(tok, 3000);
  for (let k = 0; k < 6; k++) { if (B[k]) kill(B[k]); B[k] = k < 5 ? mk(k, 0, 0) : null; txt(bits[k], k < 5 ? '1' : '0'); }
  say('偶爾很貴：B₀～B₄ 全都有', '11111₂ + 1：連續進位 5 次');
  await beat(tok, 1800);
  await inc(650, false);
  say('平均起來：insert amortized O(1)', 'O(n) insert + O(n) merge');
  await beat(tok, 2600);
  say('merge 只要兩個老大比一次', '輸的插到小孩串列的 head：O(1)');
  await beat(tok, 2800);
}]);

// 89:00 兩個 binomial heap 合併 = 兩個二進位數相加
FRAG.push(['hashlin1-meld-binary', '合併兩個 binomial heap = 二進位加法', async (tok) => {
  fresh([0, 4.8, 11.5], [0, 1.6, 0]);
  const o = { sp: 0.75, dy: 1.0, gap: 0.8, D: 3 };
  let A = [BN(9, BN(6, BN(2)), BN(4)), BN(8)], Bq = [BN(7, BN(5)), BN(1)], C = [];
  const vs = {};
  const show = (drop) => { for (const k in vs) vs[k].kill(); vs.a = bnForest(A, { ...o, cx: -4.3, drop }); vs.b = bnForest(Bq, { ...o, cx: 4.3, drop }); vs.c = bnForest(C, { ...o, cx: 0, drop, tagOf: (t) => '結果 B' + hlSub(t.kids.length) }); };
  show();
  tag('學校 to-do：n = 101₂', 'ptr', -4.3, 5.3); tag('約會 to-do：n = 011₂', 'ptr', 4.3, 5.3);
  say('兩個 priority queue 要合併', '各是一個 binomial heap');
  await beat(tok, 2600);
  say('合併 = 101₂ + 011₂', '從最低位 B₀ 開始加');
  await beat(tok, 2200);
  const steps = [
    () => [A[1], Bq[1], 'B₀：8 和 1 打一架', '8 贏 → 進位成 B₁'],
    () => [C[0], Bq[0], 'B₁：進位的 8 和 7 打一架', '8 贏 → 再進位成 B₂'],
    () => [A[0], C[0], 'B₂：9 和 8 打一架', '9 贏 → 一棵 B₃'],
  ];
  for (let s = 0; s < 3; s++) {
    const [a, b, cap, fm] = steps[s]();
    glow(a.m, GOLD); glow(b.m, GOLD);
    say(cap, fm);
    await beat(tok, 2000);
    const { w, l } = bnLink(a, b);
    A = A.filter((t) => t !== a && t !== b); Bq = Bq.filter((t) => t !== a && t !== b); C = [w];
    show(new Set(bnAll(l)));
    await beat(tok, 1600);
  }
  say('101₂ + 011₂ = 1000₂', '8 個 node，只剩一棵 B₃');
  await beat(tok, 3000);
}]);

// 90:48 getMax：問每棵樹的老大；removeMax：拆出小樹再 merge
FRAG.push(['hashlin1-getmax-remove', 'getMax 只看 root；removeMax 拆樹再合併', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const o = { sp: 0.95, dy: 1.05, gap: 1.4 };
  const t2 = BN(8, BN(5, BN(1)), BN(3)), t1 = BN(9, BN(2)), t0 = BN(6);
  let v = bnForest([t2, t1, t0], o);
  say('7 個 node = 111₂：三棵 max tree', '每棵都有自己的老大（root）');
  await beat(tok, 2600);
  const cur = tag('問老大', 'ptr alt', 0, 0, 0); let best = null;
  for (const t of [t2, t1, t0]) {
    cur.position.set(t.x, t.y + 1.5, 0); glow(t.m, GOLD); if (!best || t.v > best.v) best = t;
    say('老大 ' + t.v + '，目前最大 ' + best.v, 'sequential search，只看 root');
    await beat(tok, 1300); glow(t.m, null);
  }
  kill(cur); glow(t1.m, GREEN);
  say('getMax = 9：只問了 3 個老大', '樹最多 ⌊log₂n⌋ + 1 棵 → O(log n)');
  await beat(tok, 2800);
  fly(t1.m);
  say('removeMax：拿走 9，這棵樹拆開', '剩下的小孩 2 自成一棵 B₀');
  await beat(tok, 1800);
  v.kill();
  const c = t1.kids[0];
  v = bnForest([t2, t0], { ...o, cx: -1.4 });
  let w2 = bnForest([c], { ...o, cx: 4.4, tagOf: () => '拆出來的 B₀' });
  say('拆出來的是新 forest，跟原 forest merge', '111₂ − 010₂ = 101₂，再 + 001₂');
  await beat(tok, 2600);
  glow(t0.m, GOLD); glow(c.m, GOLD);
  say('B₀：6 和 2 打一架', '6 贏 → B₁');
  await beat(tok, 1800);
  const { w, l } = bnLink(t0, c);
  v.kill(); w2.kill();
  v = bnForest([t2, w], { ...o, drop: new Set([l]) });
  say('剩 B₂ + B₁ = 6 個 node', '101₂ + 001₂ = 110₂，O(log n)');
  await beat(tok, 3000);
}]);

// 98:35 為什麼最多 log n 棵：n = 15、14、8
FRAG.push(['hashlin1-tree-count', '樹的棵數 = 二進位裡 1 的個數', async (tok) => {
  fresh([0, 4.6, 11], [0, 1.6, 0]);
  const o = { sp: 0.8, dy: 1.0, gap: 1.1, col: (n, t) => hlOrd(t.kids.length) };
  let v = null;
  for (const n of [15, 14, 8]) {
    if (v) v.kill();
    const ts = []; for (let k = 3; k >= 0; k--) if ((n >> k) & 1) ts.push(bnMake(k));
    v = bnForest(ts, o);
    say('n = ' + n + ' = ' + hlBin(n).padStart(4, '0') + '₂', ts.length + ' 棵：' + ts.map((t) => 'B' + hlSub(t.kids.length)).join(' + '));
    await beat(tok, 2000);
    for (let i = 0; i < ts.length; i++) { glow(ts[i].m, GOLD); say('問第 ' + (i + 1) + ' 個老大', '1 的個數 = 要問幾個老大'); await beat(tok, 650); }
    await beat(tok, 900);
  }
  say('n = 15 到 8，最大一棵都是 B₃', '最大一棵 = B⌊log₂n⌋');
  await beat(tok, 2600);
  say('最糟像 7、15、63：每棵都有', '最多 ⌊log₂n⌋ + 1 棵 → O(log n)');
  await beat(tok, 2800);
}]);

// 103:00 removeMax 例子：14 個 node（1110₂），max 在 B2 的 root
FRAG.push(['hashlin1-removemax-14', 'removeMax：14 個 node 拿掉 B₂ 的老大', async (tok) => {
  fresh([0, 4.8, 11.5], [0, 1.6, 0]);
  const o = { sp: 0.75, dy: 1.0, gap: 1.0 };
  const t3 = BN(45, BN(42, BN(38, BN(11)), BN(36)), BN(33, BN(22)), BN(15));
  const t2 = BN(50, BN(40, BN(30)), BN(35));
  const t1 = BN(25, BN(5));
  let v = bnForest([t3, t2, t1], { ...o, cx: -1 });
  say('14 個 node = 1110₂', 'B₃ + B₂ + B₁');
  await beat(tok, 2400);
  const cur = tag('問老大', 'ptr alt', 0, 0, 0);
  for (const t of [t3, t2, t1]) { cur.position.set(t.x, t.y + 1.5, 0); glow(t.m, GOLD); say('老大 ' + t.v, '找老大中的老大'); await beat(tok, 1000); glow(t.m, null); }
  kill(cur); glow(t2.m, GREEN);
  say('max = 50，在 B₂ 的 root', '先把整棵 B₂ 拿掉：1110₂ − 0100₂ = 1010₂');
  await beat(tok, 2600);
  fly(t2.m);
  await beat(tok, 1000);
  v.kill();
  const [p1, p0] = t2.kids;
  v = bnForest([t3, t1], { ...o, cx: -2.2 });
  let w2 = bnForest([p1, p0], { ...o, cx: 4.6, gap: 0.9 });
  say('老大走了，留下 B₁、B₀ 一幫小嘍囉', '2² − 1 = 3 個 = 0011₂');
  await beat(tok, 2800);
  glow(p0.m, GOLD);
  say('從低位加：B₀ 只有 35，直接放', '1010₂ + 0011₂');
  await beat(tok, 2000);
  glow(p0.m, null); glow(t1.m, GOLD); glow(p1.m, GOLD);
  say('B₁：25 和 40 打一架', '40 贏 → 進位成 B₂');
  await beat(tok, 2200);
  const { w, l } = bnLink(t1, p1);
  v.kill(); w2.kill();
  v = bnForest([t3, w, p0], { ...o, drop: new Set(bnAll(l)) });
  say('B₂ 原本空了，放進來；B₃ 不動', '1010₂ + 0011₂ = 1101₂ = 13');
  await beat(tok, 2800);
  say('removeMax：減掉 2ᵏ、再加回 2ᵏ − 1', '都是二進位加減法，O(log n)');
  await beat(tok, 2800);
}]);

// 118:17 兩個老大一樣大時怎麼合併
FRAG.push(['hashlin1-tie', '老大一樣大：誰在上面都可以', async (tok) => {
  fresh([0, 4.2, 10], [0, 1.4, 0]);
  const a = BN(7, BN(3)), b = BN(7, BN(5));
  const va = bnForest([a], { cx: -2.6, sp: 1, dy: 1.2, tagOf: () => '原本的 B₁' });
  const vb = bnForest([b], { cx: 2.6, sp: 1, dy: 1.2, tagOf: () => '併進來的 B₁' });
  say('兩棵 B₁ 要合併', '兩個老大都是 7');
  await beat(tok, 2600);
  glow(a.m, GOLD); glow(b.m, GOLD);
  say('只要 max tree：誰在上面都對', '7 ≥ 7，兩種都合法');
  await beat(tok, 3000);
  say('約定一種：併進來的放下面', '實作上決定一種方式就好');
  await beat(tok, 2400);
  const { l } = bnLink(a, b);
  va.kill(); vb.kill();
  bnForest([a], { sp: 1, dy: 1.2, drop: new Set(bnAll(l)) });
  await beat(tok, 2200);
  say('再比小弟？多花成本、edge case 更多', '兩棵也可能長得一模一樣');
  await beat(tok, 3000);
  say('一般 priority queue 不需要', '選最簡單的 solution');
  await beat(tok, 2800);
}]);

// 121:55 性質（ADT）與 implementation 分開
FRAG.push(['hashlin1-adt-impl', '性質 vs implementation', async (tok) => {
  fresh([0, 5.5, 11.5], [0, 2.0, 0]);
  tag('性質：要做到什麼', 'idx', -3.8, 5.3); tag('implementation：怎麼做', 'idx', 3.4, 5.3);
  const pq = cube('Priority Queue', '#9b7ef4', [3.2, 0.8, 1.1], -3.8, 4.3, 0);
  say('priority queue 是一種性質', 'container A 要支援的操作');
  await beat(tok, 2400);
  const cd = code(['insert(key, data)：要快', 'retrieve / remove max：要快'], -3.8, 3.2, 0.5, 0);
  cd.hl(1);
  say('remove / retrieve max 要快', '拿出最大的那個');
  await beat(tok, 2200);
  cd.hl(0);
  say('insert 也要快', 'key 和對應的 data 塞進去');
  await beat(tok, 2200);
  const imps = ['heap', 'binomial heap', 'ordered array'];
  for (let i = 0; i < 3; i++) {
    cube(imps[i], hlOrd(i + 2), [2.6, 0.7, 1.0], 3.4, 4.5 - i * 1.25, 0, 2.5);
    arrow(V3(-2.1, 4.3, 0), V3(2.0, 4.5 - i * 1.25, 0));
    say('實作方式之一：' + imps[i], '快不快各有差別');
    await beat(tok, 1500);
  }
  glow(pq, null);
  const st = cube('Stack', '#4b9ee2', [2.2, 0.7, 1.0], -3.8, 0.35, 1.8);
  cube('array', '#c08a1f', [2.2, 0.7, 1.0], 3.4, 0.35, 1.8, 2.5); arrow(V3(-2.6, 0.35, 1.8), V3(2.2, 0.35, 1.8));
  say('Stack 是性質，可用 array 實作', '');
  await beat(tok, 2000);
  cube('Queue', '#31aab0', [2.2, 0.7, 1.0], -3.8, 0.35, 3.4);
  cube('circular array', '#e55a9b', [2.6, 0.7, 1.0], 3.4, 0.35, 3.4, 2.5); arrow(V3(-2.6, 0.35, 3.4), V3(2.0, 0.35, 3.4));
  say('Queue 可用 circular array 實作', '性質 ≠ implementation');
  glow(st, null);
  await beat(tok, 3000);
}]);

// 124:00 Map：依 key 拿東西；Dictionary：一個 key 多個 value
FRAG.push(['hashlin1-map-dict', 'Map 與 Dictionary', async (tok) => {
  fresh([0, 6.2, 11], [0, 1.0, 0]);
  tag('Map：一對一', 'ptr', -3.8, 2.6, -3.2); tag('Dictionary：一對多', 'ptr', 3.0, 2.6, -3.2);
  say('不再只拿最大的', '依照 key 去 get / remove');
  await beat(tok, 2600);
  const zs = [-1.8, 0, 1.8];
  for (let i = 0; i < 3; i++) {
    const k = cube('key' + hlSub(i + 1), '#4b9ee2', [1.3, 0.7, 1.0], -5.4, 0.35, zs[i], 2.5);
    await beat(tok, 500);
    arrow(V3(-4.6, 0.4, zs[i]), V3(-3.2, 0.4, zs[i]));
    cube('value' + hlSub(i + 1), '#2fc092', [1.5, 0.7, 1.0], -2.3, 0.35, zs[i], 2.5);
    say('key' + hlSub(i + 1) + ' → value' + hlSub(i + 1), '這樣的結構叫 map');
    await beat(tok, 1100);
    glow(k, null);
  }
  say('像看地圖：用地名找到東西', '一個 key 查到一個結果');
  await beat(tok, 2400);
  const k1 = cube('key₁', '#4b9ee2', [1.2, 0.7, 1.0], 0.3, 0.35, 0, 2.5);
  await beat(tok, 700);
  arrow(V3(1.0, 0.4, 0), V3(1.6, 0.4, 0));
  const vs = ['v₁₁', 'v₁₂', 'v₁₃'];
  for (let i = 0; i < 3; i++) {
    lnode(vs[i], 2.2 + i * 1.75, 0.35, 0, '#2fc092');
    if (i) arrow(V3(2.2 + (i - 1) * 1.75 + 0.95, 0.4, 0), V3(2.2 + i * 1.75 - 0.52, 0.4, 0));
    say('key₁ 對到 ' + vs.slice(0, i + 1).join('、'), 'dictionary：一個 key 多個 value');
    await beat(tok, 1100);
  }
  glow(k1, GOLD);
  say('像英文字典：一個字很多解釋', 'value 換成一個 set（例如 linked list）');
  await beat(tok, 3000);
}]);

// 128:35 ordered map vs unordered map
FRAG.push(['hashlin1-ordered-keys', 'Ordered 與 unordered 的 key', async (tok) => {
  fresh([0, 6, 11], [0, 1.0, 0]);
  tag('ordered：key 可以比大小', 'ptr', -3.4, 2.4, -3.2); tag('unordered：只要是 key', 'ptr', 3.8, 2.4, -3.2);
  const ints = [3, 12, 27, 41];
  for (let i = 0; i < 4; i++) { cube(ints[i], colorFor(ints[i]), [0.8, 0.7, 0.8], -5.8 + i * 1.6, 0.35, -1.2, 2.5); if (i) tag('<', 'idx', -6.6 + i * 1.6, 0.5, -1.2); await beat(tok, 400); }
  say('integer key：有大小關係', '3 < 12 < 27 < 41');
  await beat(tok, 2200);
  const strs = ['apple', 'melon', 'zebra'];
  for (let i = 0; i < 3; i++) { cube(strs[i], hlOrd(i), [1.3, 0.7, 0.9], -5.6 + i * 2.1, 0.35, 1.4, 2.5); if (i) tag('<', 'idx', -6.65 + i * 2.1, 0.5, 1.4); await beat(tok, 400); }
  say('string key：字典順序', 'A 開頭排前面、Z 開頭排後面');
  await beat(tok, 2400);
  say('ordered map：用順序幫忙找得快', '對 key 是比較強的假設');
  await beat(tok, 2600);
  const un = [['Paul', 2.0, -1.4], ['#A7', 5.0, -0.6], ['(2,5)', 3.0, 1.2], ['img01', 5.6, 1.9]];
  for (const [s, x, z] of un) { cube(s, '#9b7ef4', [1.2, 0.7, 0.9], x, 0.35, z, 2.5); await beat(tok, 400); }
  say('unordered：不假設 key 能比較', '只要是 key 就能放進去');
  await beat(tok, 2600);
  say('弱假設下，還有哪些招能做得快？', '→ 接下來的 hash');
  await beat(tok, 2800);
}]);

// 131:46 用 linked list / array 實作 map 的代價
FRAG.push(['hashlin1-list-array-map', '用 list / array 實作 map', async (tok) => {
  fresh([0, 6.6, 12], [0, 2.0, 0]);
  const cd = code(['                insert   get', 'unsorted list   O(1)     O(n)', 'sorted list     O(n)     O(n)', 'unsorted array  O(1)     O(n)', 'sorted array    O(n)     O(log n)'], 0, 6.2, 0.5, -3.4);
  say('已經會的：把 (key, value) 打包放進去', '先試 linked list 和 array');
  await beat(tok, 2400);
  cd.hl(1);
  const objs = [], nodes = [], keys = [12, 5, 30, 8];
  for (let i = 0; i < 4; i++) { nodes.push(lnode(keys[i], -3.6 + i * 2.0, 0.35, 1.2)); objs.push(nodes[i]); if (i) objs.push(arrow(V3(-3.6 + (i - 1) * 2.0 + 0.95, 0.4, 1.2), V3(-3.6 + i * 2.0 - 0.52, 0.4, 1.2))); }
  const g = lnode(20, -5.6, 3.0, 1.2, '#dd8238'); objs.push(g);
  await anim(tok, 700, (t) => { g.position.y = 3.0 - 2.65 * t; });
  objs.push(arrow(V3(-5.6 + 0.95, 0.4, 1.2), V3(-3.6 - 0.52, 0.4, 1.2)));
  say('unsorted list：insert 在 head', '不花力氣，O(1)');
  await beat(tok, 2000);
  const cur = tag('get 8', 'ptr alt', 0, 0, 0); objs.push(cur);
  const all = [g].concat(nodes);
  for (let i = 0; i < all.length; i++) { cur.position.set(all[i].position.x, 1.5, 1.2); glow(all[i].userData.data, i === all.length - 1 ? GREEN : GOLD); await beat(tok, 450); }
  say('get：整串掃過', 'O(n)');
  await beat(tok, 1600);
  cd.hl(2);
  say('排好序的 list 也沒有 binary search', 'insert、get 都 O(n)');
  await beat(tok, 2400);
  objs.forEach(kill);
  cd.hl(4);
  const A = [2, 5, 8, 12, 16, 23, 38], ax = (i) => -4.2 + i * 1.4, M = [];
  for (let i = 0; i < 7; i++) { cube('', GRAY, [1.25, 0.1, 1.2], ax(i), 0.05, 1.2); tag(String(i), 'idx', ax(i), 0, 2.2); M.push(cube(A[i], colorFor(A[i]), [0.9, 0.7, 0.9], ax(i), 0.45, 1.2)); }
  const c2 = tag('mid', 'ptr alt', 0, 0, 0);
  for (const [mi, ok] of [[3, false], [5, true]]) { c2.position.set(ax(mi), 1.6, 1.2); glow(M[mi], ok ? GREEN : GOLD); say(ok ? 'get 23：第 2 次就找到' : 'get 23：mid = 12 < 23，往右', 'sorted array 可以 binary search'); await beat(tok, 1500); glow(M[mi], null); }
  kill(c2);
  say('sorted array：get O(log n)', '');
  await beat(tok, 1400);
  for (let i = 6; i >= 3; i--) { move(M[i], ax(i + 1), 0.45, 1.2); await beat(tok, 300); }
  cube(10, colorFor(10), [0.9, 0.7, 0.9], ax(3), 0.45, 1.2, 2.5);
  say('insert 10：後面全部往後擠', 'O(n)；remove 也要補位');
  await beat(tok, 2200);
  cd.hl(3);
  say('n 是慢的，log n 勉強算快', '256 筆只要 8 步');
  await beat(tok, 2800);
}]);

// 136:40 integer key 直接當 array index
FRAG.push(['hashlin1-direct-address', 'Key 是小整數：直接當 index', async (tok) => {
  fresh([0, 6, 11], [0, 0.8, 0]);
  const sx = (i) => -5.4 + i * 1.2, slots = [];
  for (let i = 0; i < 10; i++) { slots.push(cube('', GRAY, [1.05, 0.1, 1.2], sx(i), 0.05, 0.6)); tag(String(i), 'idx', sx(i), 0, 1.6); }
  tag('array A（櫃子號碼 = key）', 'ptr', 0, 2.4, -1.2);
  say('key 是 small integer', '直接把 key 當櫃子號碼');
  await beat(tok, 2400);
  const cur = tag('', 'ptr alt', 0, 0, 0);
  const vals = {};
  for (const k of [3, 7]) {
    cur.position.set(sx(k), 1.8, 0.6); txt(cur, 'A[' + k + ']');
    vals[k] = cube('v' + hlSub(k), '#2fc092', [0.9, 0.7, 0.9], sx(k), 0.45, 0.6, 2.5);
    say('insert(' + k + ', v' + hlSub(k) + ')：A[' + k + '] = v' + hlSub(k), '一次 assignment，O(1)');
    await beat(tok, 1900);
  }
  cur.position.set(sx(7), 1.8, 0.6); txt(cur, 'get 7');
  glow(vals[7], GREEN);
  say('get(7)：直接打開 7 號櫃子', 'v = A[7]，O(1)');
  await beat(tok, 2400);
  glow(vals[7], null);
  const gb = ghostBox('#9b7ef4', 13, 0.4, 1.0); gb.position.set(0, 0.25, -2.6);
  tag('key 到 10000 → 要 10001 格', 'ptr', 0, 1.2, -2.6);
  say('key 不小：需要 super big array', '大部分格子都空著');
  await beat(tok, 2800);
  say('用空間換時間', 'space-time trade-off');
  await beat(tok, 3600);
}]);

// 139:30 不要超大 array：convert（→ integer）＋ compress（→ small integer）
FRAG.push(['hashlin1-convert-compress', 'Convert 再 compress', async (tok) => {
  fresh([0, 5.6, 11], [0, 1.4, 0]);
  const X = [-5.2, -1.8, 1.6, 5.0];
  tag('key', 'idx', X[0], 2.0, -1.2); tag('integer', 'idx', X[1], 2.0, -1.2); tag('small integer', 'idx', X[2], 2.0, -1.2); tag('A[0..99]', 'idx', X[3], 2.0, -1.2);
  const arr = []; for (let i = 0; i < 5; i++) arr.push(cube(i === 4 ? '…' : '', GRAY, [0.4, 0.1, 1.0], X[3] - 1.0 + i * 0.5, 0.05, 0));
  say('不想要超大 array → 縮小', '只有 100 格，key 範圍卻有 1 萬');
  await beat(tok, 2800);
  const k1 = cube(4567, '#4b9ee2', [1.2, 0.7, 0.9], X[1], 0.35, 0, 2.5);
  await beat(tok, 900);
  arrow(V3(X[1] + 0.7, 0.4, 0), V3(X[2] - 0.7, 0.4, 0)); tag('compress', 'ptr alt', (X[1] + X[2]) / 2, 1.2, 0);
  const s1 = cube(67, '#2fc092', [1.0, 0.7, 0.9], X[2], 0.35, 0, 2.5);
  say('事情一：大整數壓縮成小整數', '例：4567 mod 100 = 67');
  await beat(tok, 2600);
  kill(k1); kill(s1);
  const k0 = cube('apple', '#e55a9b', [1.3, 0.7, 0.9], X[0], 0.35, 0, 2.5);
  say('事情二：key 根本不是 integer？', '例如 string "apple"');
  await beat(tok, 2200);
  arrow(V3(X[0] + 0.75, 0.4, 0), V3(X[1] - 0.7, 0.4, 0)); tag('convert', 'ptr alt', (X[0] + X[1]) / 2, 1.2, 0);
  cube(530, '#4b9ee2', [1.2, 0.7, 0.9], X[1], 0.35, 0, 2.5);
  say('先 convert 成 integer', '示意：字元碼加總 = 530');
  await beat(tok, 2400);
  const s2 = cube(30, '#2fc092', [1.0, 0.7, 0.9], X[2], 0.35, 0, 2.5);
  say('再 compress 成 small integer', '530 mod 100 = 30');
  await beat(tok, 2200);
  arrow(V3(X[2] + 0.6, 0.4, 0), V3(X[3] - 1.3, 0.4, 0));
  glow(k0, GOLD); glow(s2, GREEN);
  say('convert、compress、array 都快', '→ 快速的 map');
  await beat(tok, 3000);
}]);

// 146:05 h = hash code + compress；A[h(key)]；bucket array
FRAG.push(['hashlin1-h-pipeline', 'h(key)：hash code ＋ compress，放進 bucket array', async (tok) => {
  fresh([0, 6.4, 11.5], [0, 1.6, 0]);
  const cd = code(['h(key) = compress( hashcode(key) )', 'insert:  A[h(key)] = value', 'get:     v = A[h(key)]'], 0, 5.6, 0.55, -3.0);
  const sx = (i) => -5.4 + i * 1.2;
  for (let i = 0; i < 10; i++) { cube('', GRAY, [1.05, 0.1, 1.2], sx(i), 0.05, 0.8); tag(String(i), 'idx', sx(i), 0, 1.8); }
  tag('bucket array A（示意 10 格）', 'ptr', 0, 0, 2.8);
  cd.hl(0);
  say('key → integer：hash code', 'integer → small integer：compress');
  await beat(tok, 2800);
  say('合起來叫 hash function h', '示意：字元碼加總 mod 10');
  await beat(tok, 2400);
  cd.hl(1);
  const cur = tag('', 'ptr alt', 0, 0, 0);
  cur.position.set(sx(0), 2.0, 0.8); txt(cur, 'h = 0');
  const ap = cube('apple', '#e55a9b', [1.0, 0.6, 0.9], sx(0), 0.4, 0.8, 2.5);
  say('insert apple：h = 530 mod 10 = 0', 'A[0] = apple 的 value');
  await beat(tok, 2400);
  cd.hl(2);
  glow(ap, GREEN);
  say('get apple：再算一次 h，直接拿', 'v = A[h(apple)]');
  await beat(tok, 2200);
  glow(ap, null);
  cd.hl(1);
  cur.position.set(sx(2), 2.0, 0.8); txt(cur, 'h = 2');
  cube('act', '#4b9ee2', [1.0, 0.6, 0.9], sx(2), 0.4, 0.8, 2.5);
  say('act：312 mod 10 = 2', '放進 A[2]');
  await beat(tok, 1800);
  const ct = cube('cat', '#9b7ef4', [1.0, 0.6, 0.9], sx(2), 1.05, 0.8, 2.5);
  glow(ct, RED);
  say('cat 也是 312 → 也要放 A[2]', '一個櫃子可能要放好幾筆');
  await beat(tok, 2400);
  say('所以叫 bucket（一桶一桶）', 'h 決定 key 用哪個櫃子');
  await beat(tok, 2800);
}]);

// 149:45 perfect hashing、鴿籠原理、collision
FRAG.push(['hashlin1-pigeonhole', 'Perfect hashing 與鴿籠原理', async (tok) => {
  fresh([0, 6, 11], [0, 1.2, 0]);
  const top = [];
  for (let i = 0; i < 5; i++) { cube('', GRAY, [1.05, 0.1, 1.1], -3.2 + i * 1.6, 0.05, -2.2); tag(String(i), 'idx', -3.2 + i * 1.6, 0, -1.3); }
  for (let i = 0; i < 5; i++) { top.push(cube('k' + hlSub(i), hlOrd(i), [0.8, 0.6, 0.8], -3.2 + ((i * 3) % 5) * 1.6, 0.4, -2.2, 2.5)); await beat(tok, 350); }
  say('最完美：100 個 key 剛好對 100 格', 'perfect hashing（示意 5 ↔ 5）');
  await beat(tok, 2600);
  say('大部分時候 key 比格子多', 'key 範圍 0～1 萬，只有 100 格');
  await beat(tok, 2600);
  const cx = (i) => -2.4 + i * 2.4, cnt = [0, 0, 0];
  for (let i = 0; i < 3; i++) { cube('', '#c9b48a', [1.6, 0.1, 1.4], cx(i), 0.05, 2.0); tag('籠 ' + (i + 1), 'idx', cx(i), 0, 3.0); }
  say('鴿籠原理：3 個籠子、5 隻鴿子', '');
  await beat(tok, 1600);
  for (let i = 0; i < 5; i++) {
    const c = i % 3, m = cube('鴿' + (i + 1), '#e5e0d5', [0.7, 0.6, 0.7], cx(c), 0.35 + cnt[c] * 0.65, 2.0, 2.5); cnt[c]++;
    if (cnt[c] > 1) { glow(m, RED); say('鴿' + (i + 1) + ' 只能擠進籠 ' + (c + 1), '至少兩隻擠同一籠'); }
    await beat(tok, 900);
  }
  say('只有 4 隻也一樣會擠', '');
  await beat(tok, 2000);
  say('兩個 key 的 h 值一樣 = collision', 'h(k₁) = h(k₂)，k₁ ≠ k₂');
  await beat(tok, 2600);
  say('兩個難題：好的 h、處理 collision', '任何 h 都可能撞');
  await beat(tok, 2800);
}]);

// 154:41 string 的 hash code：第一個字母 vs 全部加總、mod 100
FRAG.push(['hashlin1-string-hash', 'String 的 hash code：apple 與 act', async (tok) => {
  fresh([0, 6, 11], [0, 1.0, 0]);
  const sx = (i) => -6 + i * 0.48;
  for (let i = 0; i < 26; i++) { cube('', GRAY, [0.42, 0.1, 1.1], sx(i), 0.05, 0); tag('abcdefghijklmnopqrstuvwxyz'[i], 'idx', sx(i), 0, 0.9); }
  tag('26 格 array', 'ptr', 0, 0, 2.0);
  say('key 是 string，例如 apple', 'hashcode = 第一個字母 → 0～25');
  await beat(tok, 2600);
  cube('apple', '#e55a9b', [0.45, 0.55, 0.9], sx(0), 0.35, 0, 2.5);
  tag('apple', 'ptr alt', sx(0) + 0.9, 0.6, -1.2);
  say('apple → a → [0]', 'hashcode(apple) = 0');
  await beat(tok, 2000);
  const act = cube('act', '#4b9ee2', [0.45, 0.55, 0.9], sx(0), 0.95, 0, 2.5);
  tag('act', 'ptr alt', sx(0) + 0.9, 1.3, -1.2);
  glow(act, RED);
  say('act 也是 a 開頭 → 也到 [0]', 'collision：要共用同一格');
  await beat(tok, 2600);
  say('改成每個字通通加起來', 'apple：97+112+112+108+101 = 530');
  await beat(tok, 2800);
  say('act 加起來', '97+99+116 = 312');
  await beat(tok, 2200);
  say('加總可能超級大 → 要 compress', '只有 100 格：mod 100');
  await beat(tok, 2400);
  tag('apple → 530 mod 100 = 30', 'ptr', -2.6, 3.0, -2.2); tag('act → 312 mod 100 = 12', 'ptr', 2.8, 3.0, -2.2);
  glow(act, null);
  say('得到 0～99 之間的數字', '不一定要這樣算，只是示範');
  await beat(tok, 3000);
}]);

// 159:20 壞的 hash function：永遠回傳 0；好的要分散用滿 k 格
FRAG.push(['hashlin1-bad-hash', '壞 hash：什麼都回傳 0', async (tok) => {
  fresh([0, 6.2, 11.5], [0, 1.8, 0]);
  const sx = (i) => -4.9 + i * 1.4, slots = [];
  for (let i = 0; i < 8; i++) { slots.push(cube('', GRAY, [1.2, 0.1, 1.2], sx(i), 0.05, 0)); tag(String(i), 'idx', sx(i), 0, 1.0); }
  say('壞例子：不管什麼 key 都回傳 0', 'h(key) = 0');
  await beat(tok, 2400);
  const L = 'ABCDEFGH', ms = [];
  for (let i = 0; i < 8; i++) { ms.push(cube(L[i], hlOrd(i), [0.8, 0.62, 0.8], sx(0), 0.36 + i * 0.66, 0, 2.5)); await beat(tok, 380); }
  say('全部擠在 [0]，其他格沒人用', '一直在處理 collision');
  for (let i = 1; i < 8; i++) glow(slots[i], RED);
  await beat(tok, 2800);
  slots.forEach((s) => glow(s, null));
  const to = [3, 0, 6, 1, 7, 4, 2, 5];
  for (let i = 0; i < 8; i++) { move(ms[i], sx(to[i]), 0.36, 0); await beat(tok, 300); }
  say('好的 h：分散、把 k 格都用到', '少撞，空間用得最平均');
  await beat(tok, 3000);
  say('下一步：設計好 h、處理 collision', '→ hash table');
  await beat(tok, 2800);
}]);

// 164:39 array of pointers：櫃子放小紙條指向 linked list
FRAG.push(['hashlin1-chain-preview', '櫃子放小紙條：linked list 接住 collision', async (tok) => {
  fresh([0, 6.4, 11], [0, 0.6, 0]);
  const sx = (i) => -4.4 + i * 2.2, sz = -2.8;
  for (let i = 0; i < 5; i++) { cube('', GRAY, [1.8, 0.1, 1.2], sx(i), 0.05, sz); tag(String(i), 'idx', sx(i), 0, sz - 1.0); }
  say('array 的櫃子大小固定', '撞了就放不下第二筆');
  await beat(tok, 2400);
  say('改放一張小紙條（pointer）', '指到一條 linked list');
  await beat(tok, 2200);
  const len = [0, 0, 0, 0, 0];
  const add = async (w, b) => {
    const z = -1.3 + len[b] * 1.6;
    const prevZ = len[b] ? z - 1.6 : sz;
    arrow(V3(sx(b), 0.4, prevZ + 0.6), V3(sx(b), 0.4, z - 0.55));
    const g = lnode(w, sx(b), 3.0, z, hlOrd(len[b] + b)); len[b]++;
    await anim(tok, 500, (t) => { g.position.y = 3.0 - 2.65 * t; });
    say(w + ' → bucket ' + b, len[b] > 1 ? 'collision：接在串列後面' : '紙條指向第一個 node');
    await beat(tok, 1300);
  };
  await add('apple', 0); await add('act', 0); await add('bat', 1); await add('cat', 2); await add('fig', 0);
  say('linked list 可以自由變長', '一格放得下任意多筆');
  await beat(tok, 2600);
  say('collision handling 一定要有', '丟掉、linked list、vector 長大…');
  await beat(tok, 2800);
}]);
  }

  // ═══ hashlin2.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── WX-z52QweUs（台大林軒田 DSA：Hash Table — hash code、compress、collision handling、open addressing、extendable hash table） ───
const C8 = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const SUB = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const kc = (k) => C8[(typeof k === 'number' ? k : [...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0)) % 8];
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
// open-addressing insert along an arbitrary probe sequence (home + f(i)) mod m
async function hlIns(tok, T, k, home, f, ft, cur, ms = 1000) {
  for (let i = 0; i < T.m; i++) {
    const j = ((home + f(i)) % T.m + T.m) % T.m;
    cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'h' + SUB(i));
    const fm = 'h' + SUB(i) + '(' + k + ') = (' + home + ' + ' + ft(i) + ') mod ' + T.m + ' = ' + j;
    if (T.keys[j] === null) { hlPut(T, j, k, null, true); say('insert ' + k + '：放進 [' + j + ']', fm); await beat(tok, ms); return i + 1; }
    glow(T.keys[j], RED); say('insert ' + k + '：[' + j + '] 已有 ' + T.vals[j], fm + '　collision');
    await beat(tok, ms); glow(T.keys[j], null);
  }
  say('insert ' + k + '：繞完一圈都滿', 'declare failure'); await beat(tok, ms); return -1;
}
// a labelled translucent "machine" box
function hlBox(label, color, x, z, w = 2.2) { const b = ghostBox(color, w, 1.3, 1.5); b.position.set(x, 0.65, z); tag(label, 'ptr', x, 1.8, z); return b; }

// ════════ WX-z52QweUs（林軒田 Hash Table） ════════
// 20:51 回顧 map：key → value；key 不需 order、可長可短
FRAG.push(['hashlin2-map', 'Map：key 不需 order、可長可短', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  tag('key', 'ptr', -3.5, 2.0, -3.4); tag('value', 'ptr', 3.8, 2.0, -3.4);
  say('Map：存 key 與 value 的關係', 'map：key → value');
  await beat(tok, 2600);
  const W = [['a', 0.9], ['hash', 1.8], ['dictionary', 3.0]];
  const ks = W.map(([w, len], r) => cube(w, C8[r], [len, 0.7, 0.9], -3.5, 0.35, -1.8 + r * 1.8, 3));
  say('key 不需要 order', '不比大小，只問是不是同一個 key');
  await beat(tok, 3000);
  ks.forEach((k) => glow(k, GOLD));
  say('key 可長可短：variable length', '不像 32-bit 整數有固定位數');
  await beat(tok, 3000);
  ks.forEach((k) => glow(k, null));
  ['一個', '雜湊', '字典'].forEach((v, r) => cube(v, C8[r + 3], [1.6, 0.7, 0.9], 3.8, 0.35, -1.8 + r * 1.8, 3));
  W.forEach(([, len], r) => arrow(V3(-3.4 + len / 2, 0.4, -1.8 + r * 1.8), V3(2.9, 0.4, -1.8 + r * 1.8)));
  say('像英文字典：單字 → 解釋', 'key = 單字、value = 解釋');
  await beat(tok, 3200);
  say('Hash table 就是這種 map', '下一步：把 key 變成整數');
  await beat(tok, 3000);
}]);

// 23:20 key → small integer（hash code）→ array index → value
FRAG.push(['hashlin2-pipeline', 'Key → 小整數 → array index', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  const k = cube('"hash"', C8[1], [1.6, 0.7, 0.9], -5.2, 0.35, -2.8, 3);
  hlBox('轉成 integer', '#4b9ee2', -1.4, -2.8);
  say('把 key 轉成 integer', 'key → integer');
  await beat(tok, 2600);
  move(k, -1.4, 0.5, -2.8); await beat(tok, 1000);
  kill(k); const n = cube('1126', C8[6], [1.3, 0.7, 0.9], -1.4, 0.5, -2.8); move(n, 2.4, 0.4, -2.8);
  say('而且要是 small integer', '太大的話 array 放不下');
  await beat(tok, 2800);
  const T = hlRow(8, 1.45, 1.4, ['0', '1', '2', '…', '1126', '…', '9998', '9999']);
  say('範圍 0～9999 → 開 10000 格', 'array 大小 = integer 的範圍');
  await beat(tok, 3000);
  txt(T.idx[6], '5565'); txt(T.idx[7], '5566');
  say('範圍 0～5566 → 開 5567 格', 'small range 就放得進 array');
  await beat(tok, 2800);
  move(n, T.xs[4], 0.47, T.z); glow(T.slots[4], GOLD);
  say('這個整數叫 hash code', '拿 hash code 當 array index');
  await beat(tok, 2600);
  cube('value', C8[3], [1.2, 0.5, 0.8], T.xs[4], 1.1, T.z, 3);
  say('那一格放 value', 'array[hash code] = value');
  await beat(tok, 2400);
  say('Hash table = array 延伸來做 map', 'key → hash code → index → value');
  await beat(tok, 3000);
}]);

// 26:29 h 拆兩步：hash code（可以很大）＋ compress（取餘數）
FRAG.push(['hashlin2-two-step', 'h = compress(hashcode(key))', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.4]);
  hlBox('hash code', '#4b9ee2', -2.4, -2.6); hlBox('compress', '#dd8238', 2.4, -2.6);
  say('h 拆成兩步', 'h(key) = compress(hashcode(key))');
  await beat(tok, 2600);
  const k = cube('"ABC"', C8[0], [1.3, 0.7, 0.9], -5.8, 0.35, -2.6, 3);
  await beat(tok, 700); move(k, -2.4, 0.5, -2.6); await beat(tok, 900);
  kill(k); const big = cube('18273', C8[6], [1.4, 0.7, 0.9], -2.4, 0.5, -2.6); move(big, 0, 0.4, -2.6);
  say('第一步：先算出一個整數', 'hashcode("ABC") = 18273（不必小）');
  await beat(tok, 3000);
  const T = hlRow(8, 1.45, 1.6, ['0', '1', '2', '…', '73', '…', '98', '99']);
  move(big, 2.4, 0.5, -2.6); await beat(tok, 900);
  kill(big); const sm = cube('73', C8[2], [1.0, 0.7, 0.9], 2.4, 0.5, -2.6);
  say('第二步：壓縮到 0～99', '18273 mod 100 = 73');
  await beat(tok, 2800);
  move(sm, T.xs[4], 0.47, T.z); glow(T.slots[4], GOLD);
  say('最簡單：除法取餘數', 'compress(x) = x mod k ∈ [0, k−1]');
  await beat(tok, 3000);
  say('複雜的計算都塞進 hash code', '真正做 compress 的只有 division');
  await beat(tok, 3000);
}]);

// 28:39 Summation hash code：ABC 與 ACB 一樣
FRAG.push(['hashlin2-sum', 'Summation：ABC 與 ACB 撞在一起', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const rows = [['A', 'B', 'C'], ['A', 'C', 'B']];
  const cs = rows.map((w, r) => w.map((ch, i) => { const c = cube(ch, C8[ch.charCodeAt(0) % 8], [0.9, 0.7, 0.9], -4.6 + i * 1.5, 0.35, -1.6 + r * 3.0, 3); return c; }));
  say('Summation：每個位置加起來', 'hashcode = Σ key[i]');
  await beat(tok, 2600);
  rows.forEach((w, r) => w.forEach((ch, i) => tag(String(ch.charCodeAt(0)), 'idx', -4.6 + i * 1.5, 1.1, -1.6 + r * 3.0)));
  say('每個字元用 ASCII 碼', 'A = 65、B = 66、C = 67');
  await beat(tok, 2600);
  const r1 = cube('198', C8[6], [1.3, 0.7, 0.9], 3.6, 0.35, -1.6, 3);
  arrow(V3(-0.6, 0.4, -1.6), V3(2.8, 0.4, -1.6));
  say('"ABC"：65 + 66 + 67', '= 198');
  await beat(tok, 2600);
  const r2 = cube('198', C8[6], [1.3, 0.7, 0.9], 3.6, 0.35, 1.4, 3);
  arrow(V3(-0.6, 0.4, 1.4), V3(2.8, 0.4, 1.4));
  say('"ACB"：65 + 67 + 66', '= 198，一模一樣');
  await beat(tok, 2600);
  glow(r1, RED); glow(r2, RED); [cs[0][1], cs[0][2], cs[1][1], cs[1][2]].forEach((c) => glow(c, GOLD));
  say('對位置不敏感', 'sum("ABC") = sum("ACB")');
  await beat(tok, 3000);
  say('好處：算起來很快', '缺點：打錯位置的字常撞在一起');
  await beat(tok, 3200);
}]);

// 31:16 Polynomial hash code：第 i 個位置乘 16^i；乘 16 = 左移 4 bit
FRAG.push(['hashlin2-poly', 'Polynomial hash code：Σ key[i]·16ⁱ', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  const rows = [['A', 'B', 'C'], ['A', 'C', 'B']];
  rows.forEach((w, r) => w.forEach((ch, i) => cube(ch, C8[ch.charCodeAt(0) % 8], [0.9, 0.7, 0.9], -4.8 + i * 1.6, 0.35, -2.4 + r * 2.6, 3)));
  [0, 1, 2].forEach((i) => tag('×16' + ['⁰', '¹', '²'][i], 'ptr alt', -4.8 + i * 1.6, 1.3, -3.4));
  say('Polynomial：第 i 個位置乘 16ⁱ', 'hashcode = Σ key[i]·16ⁱ');
  await beat(tok, 3000);
  arrow(V3(-0.8, 0.4, -2.4), V3(2.6, 0.4, -2.4));
  const r1 = cube('18273', C8[6], [1.5, 0.7, 0.9], 3.6, 0.35, -2.4, 3);
  say('"ABC" = 65 + 66·16 + 67·256', '= 65 + 1056 + 17152 = 18273');
  await beat(tok, 3200);
  arrow(V3(-0.8, 0.4, 0.2), V3(2.6, 0.4, 0.2));
  const r2 = cube('18033', C8[2], [1.5, 0.7, 0.9], 3.6, 0.35, 0.2, 3);
  say('"ACB" = 65 + 67·16 + 66·256', '= 65 + 1072 + 16896 = 18033');
  await beat(tok, 3200);
  glow(r1, GREEN); glow(r2, GREEN);
  say('B、C 換位置，hash code 就不同', '18273 ≠ 18033');
  await beat(tok, 2800);
  glow(r1, null); glow(r2, null);
  say('16 可換成任意 a（5、9…）', 'Σ key[i]·aⁱ：把 key 當多項式係數');
  await beat(tok, 3000);
  const cd = code(['66      = 0000 0100 0010', '66 << 4 = 0100 0010 0000 = 1056'], 0, 0.9, 0.5, 2.8);
  cd.hl(1);
  say('選 16 的好處：乘 16 = 左移 4 bit', 'x·16 = x << 4，用 shift 算很快');
  await beat(tok, 3400);
}]);

// 34:00 Cyclic shift：左移時超出的 bit 補回右邊
FRAG.push(['hashlin2-cyclic', 'Cyclic shift：移出去的 bit 補回來', async (tok) => {
  fresh([0, 7, 11], [0, 0.6, 0]);
  const B = '10110011', bx = (i) => -2.8 + i * 0.8;
  const mk = (z) => [...B].map((b, i) => cube(b, b === '1' ? C8[0] : GRAY, [0.7, 0.6, 0.7], bx(i), 0.3, z, 3));
  tag('shift', 'ptr', -5.2, 0.9, -1.8); tag('cyclic shift', 'ptr', -5.2, 0.9, 1.8);
  const s = mk(-1.8), c = mk(1.8);
  say('課本第三種：cyclic shift', '這裡用 8 bit 示意（實際常是 32 bit）');
  await beat(tok, 3000);
  say('往左移 4 bit：左邊 4 個超出範圍', '10110011 << 4');
  [0, 1, 2, 3].forEach((i) => { glow(s[i], GOLD); glow(c[i], GOLD); });
  await beat(tok, 2600);
  [0, 1, 2, 3].forEach((i) => fly(s[i], V3(-6, 4, -1)));
  [4, 5, 6, 7].forEach((i) => move(s[i], bx(i - 4), 0.3, -1.8));
  await beat(tok, 900);
  [4, 5, 6, 7].forEach((i) => cube('0', GRAY, [0.7, 0.6, 0.7], bx(i), 0.3, -1.8, 2));
  say('shift：超出的丟掉，右邊補 0', '10110011 → 00110000');
  await beat(tok, 3000);
  [4, 5, 6, 7].forEach((i) => move(c[i], bx(i - 4), 0.3, 1.8));
  [0, 1, 2, 3].forEach((i) => move(c[i], bx(i + 4), 1.3, 1.8));
  await beat(tok, 900);
  [0, 1, 2, 3].forEach((i) => move(c[i], bx(i + 4), 0.3, 1.8));
  arrow(V3(bx(0), 1.4, 0.9), V3(bx(7), 1.4, 0.9), 0xc08a1f);
  say('cyclic：超出的補回低位', '10110011 → 00111011');
  await beat(tok, 3200);
  say('再加上下一個字元，循環算下去', 'sum → polynomial → cyclic：越來越複雜');
  await beat(tok, 3000);
}]);

// 35:35 越複雜越難猜誰會撞；one-way：拿到 1126 推不回 key
FRAG.push(['hashlin2-oneway', '難以回推：hash code = 1126，key = ?', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const k = cube('小秘密', C8[4], [1.6, 0.7, 0.9], -4.4, 0.35, -1.2, 3);
  hlBox('hash', '#9b7ef4', 0, -1.2, 2.0);
  say('sum：一眼看出 ABC 撞 ACB', 'cyclic：很難猜誰會撞');
  await beat(tok, 3000);
  const a = arrow(V3(-3.4, 0.4, -1.2), V3(-1.1, 0.4, -1.2), 0x0f5a3a);
  const h = cube('1126', C8[6], [1.3, 0.7, 0.9], 4.2, 0.35, -1.2, 3);
  arrow(V3(1.1, 0.4, -1.2), V3(3.4, 0.4, -1.2), 0x0f5a3a);
  say('key → hash code：算過去很快', 'hash(小秘密) = 1126');
  await beat(tok, 3000);
  const q = cube('?', RED, [1.0, 0.7, 0.9], -4.4, 0.35, 2.0, 3);
  arrow(V3(3.4, 0.4, 2.0), V3(-3.6, 0.4, 2.0), 0x7a1010);
  glow(h, GOLD);
  say('拿到 1126，原本的 key 是？', '推不回來：one-way');
  await beat(tok, 3200);
  const q2 = cube('另一個 key?', RED, [2.0, 0.7, 0.9], 0, 0.35, 3.6, 3);
  say('也很難找另一個 key 撞 1126', '密碼學、驗證都靠這種性質');
  await beat(tok, 3200);
  say('課堂應用：polynomial、cyclic 常夠用', '常撞在一起才需要換更好的');
  await beat(tok, 3000);
}]);

// 39:01 hash code + compression → small range integer → bucket array
FRAG.push(['hashlin2-bucket', 'Bucket array：一桶一桶', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  hlBox('hash code（sum）', '#4b9ee2', -3.4, -2.8); hlBox('mod 8', '#dd8238', 1.2, -2.8, 1.8);
  const T = hlRow(8, 1.45, 1.4);
  tag('bucket array', 'ptr', -6.2, 0.9, 1.4);
  say('hash code function + compression', '這裡用 sum，再 mod 8');
  await beat(tok, 2800);
  const W = [['cat', 312, 0], ['dog', 314, 2], ['egg', 307, 3]];
  const placed = [];
  for (const [w, hc, b] of W) {
    const c = cube(w, kc(w), [1.0, 0.6, 0.8], -6.0, 0.35, -2.8, 3);
    await beat(tok, 500); move(c, -3.4, 0.5, -2.8); await beat(tok, 700);
    relabel(c, hc); move(c, 1.2, 0.5, -2.8); await beat(tok, 700);
    relabel(c, w); move(c, T.xs[b], 0.45, T.z + 1.1 + 0 * 0.8); placed.push(c);
    say(w + '：' + hc + ' mod 8 = ' + b, 'small range：0～7');
    await beat(tok, 1500);
  }
  say('這個 array 叫 bucket array', 'index = 桶號，東西往那一桶丟');
  await beat(tok, 2800);
  const g = cube('god', kc('god'), [1.0, 0.6, 0.8], -6.0, 0.35, -2.8, 3);
  await beat(tok, 600); move(g, T.xs[2], 0.45, T.z + 2.0); glow(placed[1], RED); glow(g, RED);
  say('god 也是 314 → 也丟進 [2]', '很多東西共用同一桶怎麼辦？');
  await beat(tok, 3200);
}]);

// 42:53 問：polynomial 會 overflow？→ 邊算邊 mod 2³²
FRAG.push(['hashlin2-overflow', '算 hash code 時邊算邊 mod 2³²', async (tok) => {
  fresh([0, 7, 11], [0, 0.8, -0.4]);
  const cd = code(['h = 0', 'h = (h + key[i]·16ⁱ) mod 2³²', '（每一步都留在 32 bit）'], 0, 4.6, 0.55, -3.2);
  cd.hl(1);
  say('問：polynomial 很容易 overflow？', '16ⁱ 長得非常快');
  await beat(tok, 3000);
  const h = cube('0', C8[6], [1.6, 0.8, 1.0], 0, 0.4, 0.6, 3);
  const box = ghostBox('#9b7ef4', 5.6, 1.6, 2.0); box.position.set(0, 0.8, 0.6);
  tag('32-bit 整數（4 byte）', 'ptr', 0, 2.0, 0.6);
  say('一直把 h 保持在 32 bit 內', '每一步先 mod 2³²');
  await beat(tok, 2600);
  const steps = [['A', 65, '0 + 65·1'], ['B', 1121, '65 + 66·16'], ['C', 18273, '1121 + 67·256']];
  for (const [ch, v, f] of steps) {
    const c = cube(ch, C8[ch.charCodeAt(0) % 8], [0.8, 0.6, 0.8], -5.5, 0.3, 0.6, 3);
    await beat(tok, 500); move(c, -1.4, 0.4, 0.6); await beat(tok, 700); kill(c);
    relabel(h, v); glow(h, GOLD);
    say('加入 ' + ch + '：h = ' + v, 'h = (' + f + ') mod 2³²');
    await beat(tok, 1700); glow(h, null);
  }
  say('永遠不會 overflow', '也有人接受 256 bit 的 hash code');
  await beat(tok, 3000);
  say('最後再做 compress', 'index = h mod k');
  await beat(tok, 2600);
}]);

// 44:30 division 後會重複嗎？會：鴿籠原理；目標是分散
FRAG.push(['hashlin2-pigeon', 'Collision 一定會發生：要的是分散', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(4, 1.8, -2.4);
  say('問：division 之後會不會又重複？', '會');
  await beat(tok, 2400);
  const ks = [];
  for (let i = 0; i < 5; i++) {
    const b = [0, 1, 2, 3, 1][i]; const n = ks.filter((x) => x.b === b).length;
    ks.push({ b, c: cube('k' + SUB(i + 1), C8[i], [1.0, 0.6, 0.7], T.xs[b], 0.33, T.z + 1.05 + n * 0.85, 3) });
    await beat(tok, 500);
  }
  glow(ks[1].c, RED); glow(ks[4].c, RED);
  say('key 比格子多 → 一定有兩個同格', '100 個 key、99 格 → 必撞（鴿籠原理）');
  await beat(tok, 3200);
  say('這叫 collision：一定會發生', '能做的是：盡量減少');
  await beat(tok, 2600);
  ks.forEach((x) => kill(x.c));
  const U = hlRow(8, 1.45, 1.6);
  const bad = [];
  for (let i = 0; i < 4; i++) bad.push(cube('k' + SUB(i + 1), C8[i], [1.0, 0.5, 0.7], U.xs[0], 0.3 + i * 0.55, U.z, 3));
  say('最壞的 hash：全部丟 [0]', 'h(x) = 0：碰來碰去，其他格浪費');
  await beat(tok, 3200);
  bad.forEach((c, i) => move(c, U.xs[i * 2 + 1], 0.3, U.z));
  say('好的 hash：平均分散到每一格', 'hash code 要的是「分散」');
  await beat(tok, 3200);
}]);

// 46:57 口罩實名制：身分證尾數單雙號 = 只有兩格的 hash
FRAG.push(['hashlin2-mask', '口罩分流：只有兩格的 hash', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0]);
  const T = hlRow(2, 5.0, 1.6, ['奇數 1、3、5', '偶數 2、4、6']);
  say('口罩實名制：依身分證尾數分流', '最簡單的 hash：只有兩格');
  await beat(tok, 3000);
  const ids = ['…3', '…8', '…5', '…2', '…7', '…4'];
  const cnt = [0, 0];
  for (const id of ids) {
    const d = +id.slice(-1), b = d % 2 === 1 ? 0 : 1;
    const c = cube(id, C8[d % 8], [1.1, 0.6, 0.8], 0, 0.35, -3.0, 3);
    await beat(tok, 500);
    move(c, T.xs[b] - 1.3 + (cnt[b] % 3) * 1.3, 0.45, T.z - 0.1);
    cnt[b]++;
    say('尾數 ' + d + ' → ' + (b === 0 ? '奇數那天' : '偶數那天'), d + ' mod 2 = ' + (d % 2));
    await beat(tok, 900);
  }
  say('compress：division by 2', '尾數 mod 2 決定哪一格');
  await beat(tok, 2600);
  say('尾數是檢查碼：像 polynomial', '由前面的英文、數字算出來');
  await beat(tok, 3000);
  say('目的：分散，別把藥局塞爆', 'hash table 也是一樣的概念');
  await beat(tok, 3000);
}]);

// 60:40 Collision：h(k₁) = h(k₂) 但 k₁ ≠ k₂（hash code 撞、或 compress 後撞）
FRAG.push(['hashlin2-collision', 'Collision：h(k₁) = h(k₂)，k₁ ≠ k₂', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, -0.3]);
  const T = hlRow(10, 1.15, 2.0);
  say('Collision：h(k₁) = h(k₂)', '但 k₁ ≠ k₂');
  await beat(tok, 2600);
  const b1 = hlBox('sum', '#4b9ee2', -2.6, -2.6, 1.6);
  const a = cube('ABC', C8[0], [1.0, 0.6, 0.8], -5.6, 0.35, -3.0, 3), b = cube('ACB', C8[1], [1.0, 0.6, 0.8], -5.6, 0.35, -1.9, 3);
  await beat(tok, 700); move(a, -2.6, 0.5, -3.0); move(b, -2.6, 0.5, -2.0); await beat(tok, 800);
  relabel(a, 198); relabel(b, 198); move(a, 0.6, 0.35, -3.0); move(b, 0.6, 0.35, -1.9); glow(a, RED); glow(b, RED);
  say('情況 1：hash code 就一樣', 'sum：ABC、ACB 都是 198');
  await beat(tok, 3000);
  move(a, T.xs[8], 0.45, T.z); move(b, T.xs[8], 1.15, T.z);
  say('→ 一定落在同一格', '198 mod 10 = 8');
  await beat(tok, 2400);
  glow(a, null); glow(b, null);
  const c = cube('18273', C8[6], [1.3, 0.6, 0.8], 3.2, 0.35, -3.0, 3), d = cube('18033', C8[2], [1.3, 0.6, 0.8], 3.2, 0.35, -1.9, 3);
  tag('polynomial', 'ptr', 3.2, 1.3, -3.6);
  say('情況 2：hash code 不同', 'polynomial：18273 ≠ 18033');
  await beat(tok, 2800);
  move(c, T.xs[3], 0.45, T.z); move(d, T.xs[3], 1.15, T.z); glow(c, RED); glow(d, RED);
  say('compress 後還是撞', '18273 mod 10 = 18033 mod 10 = 3');
  await beat(tok, 3000);
  say('撞了怎麼辦：collision handling', '');
  await beat(tok, 2400);
}]);

// 62:21 方法 0：不理他（丟掉舊的或不插入）— tolerate some errors
FRAG.push(['hashlin2-dontcare', '方法 0：不理他', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(5, 1.8, 0.4);
  const old = cube('舊', C8[0], [1.2, 0.7, 0.9], T.xs[3], 0.47, T.z);
  say('方法 0：不理他', '櫃子打開，裡面已經有東西');
  await beat(tok, 2600);
  const nw = cube('新', C8[4], [1.2, 0.7, 0.9], -5.8, 0.4, -2.6, 3);
  await beat(tok, 600); move(nw, T.xs[3], 0.45, -1.6); glow(old, RED);
  say('新的也 hash 到 [3]', 'collision');
  await beat(tok, 2400);
  fly(old, V3(4, 6, -3)); await beat(tok, 500); move(nw, T.xs[3], 0.47, T.z);
  say('選擇 1：丟掉舊的，放新的', '只要保留最新的就好');
  await beat(tok, 3000);
  const nw2 = cube('新2', C8[5], [1.2, 0.7, 0.9], -5.8, 0.4, -2.6, 3);
  await beat(tok, 600); move(nw2, T.xs[3], 0.45, -1.6); glow(nw, GOLD);
  await beat(tok, 900); fly(nw2, V3(-5, 6, -3));
  say('選擇 2：don\'t insert', '新的直接不放');
  await beat(tok, 2800);
  glow(nw, null);
  say('不是 standard，但碰撞少時可行', '每格只放固定一樣東西');
  await beat(tok, 2800);
  say('思維：tolerate some errors', '錯誤 = 丟掉了不該丟的');
  await beat(tok, 3000);
}]);

// 65:32 用 hash 做 Set：bit bucket array（沒存 key，只存 0/1）
FRAG.push(['hashlin2-bitset', 'Set 用 bit bucket array 表示', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 0.8);
  const bits = T.xs.map((x) => cube('0', GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z));
  say('用 hash table 做 Set', 'Set：key → true / false');
  await beat(tok, 2800);
  say('bit bucket array：預設全是 0', 'A[i] ∈ {0, 1}');
  await beat(tok, 2400);
  for (const [k, h] of [['k₁', 2], ['k₂', 5], ['k₃', 7]]) {
    const c = cube(k, C8[h], [0.9, 0.6, 0.8], -5.8, 0.35, -2.6, 3);
    await beat(tok, 500); move(c, T.xs[h], 0.35, -1.4);
    relabel(bits[h], 1); tint(bits[h], C8[h]); glow(bits[h], GOLD);
    say('放入 ' + k + '：A[h(' + k + ')] = 1', 'h(' + k + ') = ' + h);
    await beat(tok, 1500); glow(bits[h], null); kill(c);
  }
  say('key 本身沒有存下來', '只在 hash 的位置存 1 bit');
  await beat(tok, 2800);
  say('所以 size 非常非常小', 'p 個元素 → 一個小 bit array');
  await beat(tok, 2800);
}]);

// 68:45 查詢：0 → 一定不在；1 → 有 collision 時可能錯
FRAG.push(['hashlin2-query', 'Set 查詢：0 一定不在、1 可能錯', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 0.8);
  const bits = T.xs.map((x, i) => { const on = [2, 5, 7].includes(i); return cube(on ? '1' : '0', on ? C8[i] : GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z); });
  const cur = tag('h', 'ptr alt', T.xs[4], 1.6, T.z);
  say('查詢 kᵢ：先算 h(kᵢ)', '再看 A[h(kᵢ)] 是 0 還是 1');
  await beat(tok, 2600);
  const q = cube('kᵢ', C8[4], [0.9, 0.6, 0.8], -5.8, 0.35, -2.6, 3);
  await beat(tok, 500); move(q, T.xs[4], 0.35, -1.4); glow(bits[4], RED);
  say('h(kᵢ) = 4：A[4] = 0', '一定不在 set（no error）');
  await beat(tok, 3000);
  glow(bits[4], null); kill(q);
  const q2 = cube('k₂', C8[5], [0.9, 0.6, 0.8], -5.8, 0.35, -2.6, 3);
  await beat(tok, 500); move(q2, T.xs[5], 0.35, -1.4); cur.position.set(T.xs[5], 1.6, T.z); glow(bits[5], GREEN);
  say('A[5] = 1：沒 collision 就真的在', 'k₂ 確實放進過 set');
  await beat(tok, 2800);
  glow(bits[5], null); kill(q2);
  const q3 = cube('kⱼ', C8[1], [0.9, 0.6, 0.8], -5.8, 0.35, -2.6, 3);
  await beat(tok, 500); move(q3, T.xs[5], 0.35, -1.4); glow(bits[5], GOLD); glow(q3, RED);
  say('kⱼ 沒放過，但 h(kⱼ) = 5', 'A[5] = 1 是 k₂ 設的');
  await beat(tok, 3000);
  say('說「在」可能錯：有一點錯誤可能', '說「不在」一定對');
  await beat(tok, 3000);
}]);

// 72:10 Bloom filter：多個 hash function，全部是 1 才說「在」
FRAG.push(['hashlin2-bloom', 'Bloom filter：多個 hash function', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 0.8);
  const bits = T.xs.map((x) => cube('0', GRAY, [0.8, 0.5, 0.8], x, 0.37, T.z));
  say('Bloom filter：用好幾個 hash function', 'h₁、h₂、h₃');
  await beat(tok, 2800);
  const set1 = async (k, hs, col) => {
    const c = cube(k, col, [0.9, 0.6, 0.8], -5.8, 0.35, -2.6, 3);
    await beat(tok, 500); move(c, 0, 0.35, -2.4);
    const ar = hs.map((h) => arrow(V3(0, 0.4, -1.9), V3(T.xs[h], 0.6, T.z - 0.5), 0xc08a1f));
    hs.forEach((h) => { relabel(bits[h], 1); tint(bits[h], col); });
    say('insert ' + k + '：三格都設成 1', hs.map((h, i) => 'h' + SUB(i + 1) + '=' + h).join('、'));
    await beat(tok, 2200); ar.forEach(kill); kill(c);
  };
  await set1('x', [1, 4, 8], C8[0]);
  await set1('y', [2, 4, 6], C8[2]);
  const q = cube('z', C8[4], [0.9, 0.6, 0.8], 0, 0.35, -2.4, 3);
  [1, 6, 7].forEach((h) => glow(bits[h], h === 7 ? RED : GREEN));
  say('查 z：h = 1、6、7', 'A[7] = 0 → z 一定不在');
  await beat(tok, 3000);
  [1, 6, 7].forEach((h) => glow(bits[h], null)); kill(q);
  const w = cube('w', C8[5], [0.9, 0.6, 0.8], 0, 0.35, -2.4, 3);
  [2, 4, 8].forEach((h) => glow(bits[h], GOLD));
  say('查 w：2、4、8 全是 1 → 說「在」', 'w 沒放過也可能全 1：小機率錯');
  await beat(tok, 3200);
  say('hash 越多且獨立，錯誤率越低', '「不在」一定對，「在」大多對');
  await beat(tok, 3000);
}]);

// 73:30 應用：廣告系統判斷使用者是否在 1532 人名單
FRAG.push(['hashlin2-ads', 'Bloom filter 應用：1532 人看紅色廣告', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  hlBox('Bloom filter（1532 人）', '#e55a9b', 0, -1.0, 3.0);
  const red = cube('紅色廣告', '#c0392b', [1.8, 0.6, 1.0], 4.6, 0.3, 2.2), oth = cube('其他廣告', GRAY, [1.8, 0.6, 1.0], -4.6, 0.3, 2.2);
  say('一群人對紅色廣告特別有反應', '名單：1532 人');
  await beat(tok, 3000);
  say('一個一個比對 1532 人？', '比完廣告機會都不見了');
  await beat(tok, 2800);
  const users = [['u₁', true], ['u₂', false], ['u₃', true]];
  for (const [u, inSet] of users) {
    const c = cube(u, C8[u.length + (inSet ? 1 : 4)], [0.9, 0.6, 0.8], 0, 0.35, -4.2, 3);
    await beat(tok, 500); move(c, 0, 0.5, -1.0); await beat(tok, 800);
    move(c, inSet ? 4.6 : -4.6, 1.0, 2.2); glow(inSet ? red : oth, GOLD);
    say(u + '：' + (inSet ? '在 → 紅色廣告' : '不在 → 其他廣告'), '幾次 hash 就判斷完');
    await beat(tok, 1600); glow(red, null); glow(oth, null); kill(c);
  }
  say('「在」偶爾錯：多秀給幾人也沒關係', '保證 1532 人都看到紅色廣告');
  await beat(tok, 3200);
}]);

// 77:09 方法 1：fixed array per bucket（一個櫃子切成小櫃子）
FRAG.push(['hashlin2-fixed', '方法 1：每個 bucket 一個固定 array', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(5, 2.2, -2.6, null, -0.85);
  T.xs.forEach((x) => { for (let j = 0; j < 4; j++) cube('', '#e8dfcc', [1.6, 0.08, 0.7], x, 0.05, T.z + 1.05 + j * 0.85); });
  say('方法 1：fixed array per bucket', '一個櫃子切成 4 個小櫃子');
  await beat(tok, 3000);
  const ks = [];
  for (let j = 0; j < 4; j++) {
    const [x, y, z] = cpos(T, 3, j);
    ks.push(cube('k' + SUB(j + 1), C8[j], [1.3, 0.6, 0.65], x, y, z, 3));
    say('k' + SUB(j + 1) + ' → bucket 3 的第 ' + (j + 1) + ' 小格', 'h(k' + SUB(j + 1) + ') = 3');
    await beat(tok, 1100);
  }
  const k5 = cube('k₅', C8[4], [1.3, 0.6, 0.65], T.xs[3], 1.4, T.z + 4.8, 3);
  glow(k5, RED);
  say('第 5 個也到 bucket 3：overflow', 'hash 不夠好、資料分布特別都會發生');
  await beat(tok, 3200);
  say('不常發生的話，這是簡單的方法', '缺點：固定大小、不夠動態');
  await beat(tok, 3000);
}]);

// 78:09 方法 2：chaining（linked list）— 希望 chain 短，時間 ∝ 那格的長度
FRAG.push(['hashlin2-chain', '方法 2：chaining，chain 要短', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  const T = hlRow(5, 2.2, -2.8, null, -0.85);
  say('方法 2：linked list，叫 chaining', '要串多長就串多長');
  await beat(tok, 2600);
  for (const k of [10, 7, 12, 4]) { hlChain(T, k % 5, k, null, true); await beat(tok, 500); }
  say('hash 那部分很快', 'hash code + compress → 直接到某一格');
  await beat(tok, 2800);
  say('insert / get 的時間 = 那格的長度', 'h(x) = x mod 5');
  await beat(tok, 2600);
  for (const k of [3, 8, 13, 18, 23]) { hlChain(T, 3, k, null, true); say('insert ' + k + '：' + k + ' mod 5 = 3', '[3] 的 chain 長度 ' + T.ch[3].length); await beat(tok, 800); }
  const cur = tag('get 23', 'ptr alt', T.xs[3] + 1.4, 1.2, T.z + 1.05);
  for (let j = 0; j < 5; j++) { const [, , z] = cpos(T, 3, j); cur.position.set(T.xs[3] + 1.5, 1.2, z); glow(T.ch[3][j], j === 4 ? GREEN : GOLD); await beat(tok, 600); glow(T.ch[3][j], null); }
  say('大家擠同一格 = 排很長的隊', '<span class="no">get 23 要走 5 個節點</span>');
  await beat(tok, 3000);
}]);

// 79:47 方法 3：other container（secondary data structure），例如第二層再 hash
FRAG.push(['hashlin2-secondary', '方法 3：secondary 的 container', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.2]);
  const T = hlRow(4, 3.0, -2.8, ['1萬人', '1萬人', '1萬人', '…']);
  T.xs.forEach((x, i) => cube(i < 3 ? '1萬' : '…', C8[i], [1.6, 0.6, 0.8], x, 0.4, T.z, 3));
  say('100 萬人分流：每桶 1 萬人', 'hash 只是先分成小包');
  await beat(tok, 3000);
  say('每次在 1 萬人裡找來找去還是太多', 'array、linked list 都要掃');
  await beat(tok, 2800);
  const sub = hlRow(5, 1.1, 1.6, ['0', '1', '2', '3', '4']);
  sub.xs.forEach((x, i) => { sub.slots[i].position.x = x + T.xs[0] + 2.2; sub.idx[i].position.x = x + T.xs[0] + 2.2; });
  arrow(V3(T.xs[0], 0.4, T.z + 0.5), V3(T.xs[0] + 2.2 - 2.2, 0.3, 1.0), 0xc08a1f);
  tag('第二層 hash', 'ptr alt', T.xs[0] + 2.2, 1.4, 1.6);
  say('bucket 裡放任何動態 container', '例：第二層再用一個 hash');
  await beat(tok, 3200);
  for (let i = 0; i < 5; i++) { cube('', C8[(i + 3) % 8], [0.8, 0.5, 0.7], sub.slots[i].position.x, 0.35, 1.6, 2); }
  await beat(tok, 1000);
  say('這種叫 secondary data structure', '也可以是更小的 map');
  await beat(tok, 2800);
  say('array、linked list 是基本款', '進階款更合用，但更複雜、難 maintain');
  await beat(tok, 3000);
}]);

// 81:22 Open addressing：回收再利用 bucket array 裡的空格
FRAG.push(['hashlin2-open-idea', 'Open addressing：用表裡的空格', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(8, 1.45, -2.4, null, -0.85);
  for (const k of [10, 18, 26]) hlChain(T, 2, k, null, true);
  hlChain(T, 6, 14, null, true);
  say('方法 1～3：塞的地方再多拉空間', '[2] 串了 10、18、26');
  await beat(tok, 3000);
  [0, 1, 3, 4, 5, 7].forEach((i) => glow(T.slots[i], GREEN));
  say('可是空的地方還是空著', '有些格很塞、有些格很空');
  await beat(tok, 2800);
  say('能不能回收再利用空格？', 'reuse bucket array 的 empty space');
  await beat(tok, 2600);
  const [a, b, c] = T.ch[2];
  move(a, T.xs[2], 0.45, T.z); await beat(tok, 600);
  move(b, T.xs[3], 0.45, T.z); glow(T.slots[3], null); await beat(tok, 600);
  move(c, T.xs[4], 0.45, T.z); glow(T.slots[4], null); move(T.ch[6][0], T.xs[6], 0.45, T.z);
  say('最想要的格有人 → 放到附近另一格', '這叫 Open Addressing');
  await beat(tok, 3200);
  say('不另外安排空間', '所有 key 都住在 bucket array 裡');
  await beat(tok, 2800);
}]);

// 83:26 第三排中間的座位：依序找第一、第二、第三志願
FRAG.push(['hashlin2-seat', '找座位：第一志願被坐走就找第二志願', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, 0]);
  tag('講台', 'ptr', 0, 0.6, -3.8);
  const sx = (c) => -2.4 + c * 1.2, sz = (r) => -2.4 + r * 1.2;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cube('', GRAY, [0.9, 0.12, 0.9], sx(c), 0.06, sz(r));
  const taken = [[2, 2], [2, 3], [0, 1], [4, 0], [1, 4], [3, 2]];
  taken.forEach(([r, c], i) => cube('', C8[i], [0.6, 0.6, 0.6], sx(c), 0.42, sz(r)));
  const pref = [[2, 2], [2, 3], [2, 1], [1, 2]];
  pref.forEach(([r, c], i) => tag('第' + (i + 1), 'idx', sx(c), 1.0, sz(r)));
  say('最愛的位子：第三排中間', '進可攻、退可守');
  await beat(tok, 3000);
  const me = cube('我', C8[4], [0.7, 0.7, 0.7], 5.4, 0.4, 3.2, 3);
  for (let i = 0; i < pref.length; i++) {
    const [r, c] = pref[i];
    move(me, sx(c), 1.2, sz(r) + 0.6);
    const occ = taken.some(([a, b]) => a === r && b === c);
    say(occ ? '第 ' + (i + 1) + ' 志願有人坐了' : '第 ' + (i + 1) + ' 志願空著：坐下', occ ? '就像 hash 算出的 bucket 被占' : 'h' + SUB(i) + ' 是空的 → 放進去');
    await beat(tok, 2000);
    if (!occ) { move(me, sx(c), 0.42, sz(r)); break; }
  }
  await beat(tok, 800);
  say('趕人＝不理他；擠一張椅子＝小格子', '手牽手串一串＝linked list');
  await beat(tok, 3200);
  say('真正會做的：依序找下一個志願', '耐心有限：找完 m 個還沒有就放棄');
  await beat(tok, 3200);
}]);

// 87:23 Open addressing 的 insert / get：h₀, h₁, …, h_{m−1}，全滿 declare failure
FRAG.push(['hashlin2-oa-steps', 'Open addressing：insert 與 get 的步驟', async (tok) => {
  fresh([0, 8, 12], [0, 1.2, -0.4]);
  const cd = code(['insert(key, value):', '  for i = 0 … m−1:', '    hᵢ ← 第 i 順位的格子', '    若 A[hᵢ] 是空的：放入、結束', '  declare failure', 'get(key)：同樣順序 h₀, h₁, …', '  找到 key；全找完 → 不在'], -1.4, 6.0, 0.48, -3.4);
  const T = hlRow(8, 1.45, 1.6);
  hlPut(T, 3, 'A'); hlPut(T, 6, 'B'); hlPut(T, 0, 'C');
  cd.hl(0);
  say('Open addressing 的 insert', 'h₀ = h(key)：最想要的位置');
  await beat(tok, 2800);
  const seq = [3, 6, 1], cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  for (let i = 0; i < seq.length; i++) {
    const j = seq[i]; cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'h' + SUB(i));
    cd.hl(T.keys[j] ? 2 : 3);
    if (T.keys[j]) { glow(T.keys[j], RED); say('h' + SUB(i) + ' = ' + j + '：有人了', '試下一個順位 h' + SUB(i + 1)); await beat(tok, 2000); glow(T.keys[j], null); }
    else { hlPut(T, j, 'key', C8[4], true); say('h' + SUB(i) + ' = ' + j + '：空的 → 放進去', '順序 h₀=3、h₁=6、h₂=1（示意）'); await beat(tok, 2400); }
  }
  cd.hl(4);
  say('最多試 m 次：h₀ … h_{m−1}', '全部有人 → declare failure');
  await beat(tok, 2800);
  cd.hl(5);
  for (let i = 0; i < seq.length; i++) {
    const j = seq[i]; cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'h' + SUB(i));
    glow(T.keys[j], i === 2 ? GREEN : GOLD);
    say(i === 2 ? 'get：在 h₂ 找到' : 'get：照同樣順序找', i === 2 ? 'A[1] 就是這個 key' : 'h' + SUB(i) + ' = ' + j + '：不是');
    await beat(tok, 1400); glow(T.keys[j], null);
  }
  cd.hl(6);
  say('全部找完都沒有 → 不在', '像同學沒來上課');
  await beat(tok, 2800);
}]);

// 93:21 Linear probing：hᵢ = h₀ + i（找隔壁）、clustering
FRAG.push(['hashlin2-linear', 'Linear probing 與 clustering', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(10, 1.15, 0.6);
  const cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  const lin = (i) => i, lt = (i) => String(i);
  say('Linear probing：找隔壁', 'hᵢ = (h₀ + i) mod 10');
  await beat(tok, 2600);
  for (const k of [13, 23, 33]) await hlIns(tok, T, k, k % 10, lin, lt, cur, 750);
  [3, 4, 5].forEach((i) => glow(T.keys[i], GOLD));
  say('[3] 撞得嚴重：3、4、5 擠成一團', '這叫 clustering');
  await beat(tok, 3000);
  [3, 4, 5].forEach((i) => glow(T.keys[i], null));
  await hlIns(tok, T, 14, 4, lin, lt, cur, 750);
  await hlIns(tok, T, 15, 5, lin, lt, cur, 750);
  say('4、5 號自己的反而要借 6、7', '像塞車：拖慢整個 hash');
  await beat(tok, 3000);
  say('最多繞 m − 1 步走完整個 array', '繞圈圈找隔壁');
  await beat(tok, 2600);
}]);

// 96:47 Quadratic probing：隔壁、4 以外、9 以外、16 以外
FRAG.push(['hashlin2-quad', 'Quadratic probing：跳 1、4、9、16', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(17, 0.74, 0.6);
  [[3, 20], [4, 21], [7, 24], [12, 29]].forEach(([i, k]) => hlPut(T, i, k));
  const cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  say('Quadratic：走越多次跳越遠', 'hᵢ = (h₀ + i²) mod 17');
  await beat(tok, 3000);
  const n = await hlIns(tok, T, 37, 37 % 17, (i) => i * i, (i) => i + '²', cur, 1200);
  say('37：試了 ' + n + ' 次才找到 [2]', '偏移 0、1、4、9、16');
  await beat(tok, 2800);
  [5, 6, 8, 9, 10, 11].forEach((i) => glow(T.slots[i], GREEN));
  say('中間留空給本來屬於那裡的 key', '不會大家都擠在 [3] 附近');
  await beat(tok, 3000);
}]);

// 97:38 Double hashing：hᵢ = h₀ + i·another_hash(key)
FRAG.push(['hashlin2-double', 'Double hashing：每個 key 步伐不同', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const T = hlRow(11, 1.1, 0.6);
  hlPut(T, 3, 3);
  const cur = tag('h₀', 'ptr alt', T.xs[3], 1.8, T.z);
  say('hᵢ = h₀ + i·another_hash(key)', '例：h₀ = k mod 11、h₂(k) = 7 − (k mod 7)');
  await beat(tok, 3200);
  for (const k of [14, 25]) {
    const st = 7 - (k % 7);
    say(k + '：h₀ = ' + (k % 11) + '，步伐 = ' + st, 'h₂(' + k + ') = 7 − ' + (k % 7) + ' = ' + st);
    await beat(tok, 1800);
    await hlIns(tok, T, k, k % 11, (i) => i * st, (i) => i + '·' + st, cur, 1200);
  }
  [10, 6].forEach((i) => glow(T.keys[i], GOLD));
  say('同一個 h₀，下一步卻散到不同地方', '14 → [10]、25 → [6]');
  await beat(tok, 3000);
  say('hash = 切碎碎：把位置分散開', '這叫 double hashing');
  await beat(tok, 2800);
}]);

// 99:20 哪一個好？從簡單到複雜的 spectrum
FRAG.push(['hashlin2-spectrum', '從簡單到複雜：看應用選', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const R = [['hash code', ['sum', 'polynomial', 'cyclic shift']], ['collision', ['不理他', 'secondary', 'open addr.']], ['open addr.', ['linear', 'quadratic', 'double']]];
  const cs = [];
  for (let r = 0; r < 3; r++) {
    tag(R[r][0], 'ptr', -5.6, 0.9, -2.4 + r * 2.4);
    cs.push(R[r][1].map((s, i) => cube(s, C8[(r * 3 + i) % 8], [2.2, 0.6, 0.9], -2.4 + i * 3.0, 0.3, -2.4 + r * 2.4, 3)));
    for (let i = 0; i < 2; i++) arrow(V3(-1.2 + i * 3.0, 0.4, -2.4 + r * 2.4), V3(-0.6 + i * 3.0, 0.4, -2.4 + r * 2.4));
    await beat(tok, 700);
  }
  say('哪一個比較好？看應用', '老實說：不知道');
  await beat(tok, 3000);
  glow(cs[2][1], GREEN);
  say('quadratic 往往已經夠好', '不一定要做更複雜的');
  await beat(tok, 2800);
  glow(cs[2][1], null); cs.forEach((row) => glow(row[2], GOLD));
  say('撞得太嚴重 → 往複雜的 design 移', '簡單 → 複雜');
  await beat(tok, 3000);
  cs.forEach((row) => glow(row[2], null));
  say('概念簡單，難在測試與確保效率', '性質的證明留給進階課程');
  await beat(tok, 3000);
}]);

// 120:43 有 collision 時要把 key 和 value 一起存
FRAG.push(['hashlin2-store-key', 'Collision 時 key 要跟 value 一起存', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(5, 2.2, -2.6, null, -0.85);
  T.cw = 1.9;
  const a = hlChain(T, 3, '電話A', C8[0]);
  say('完美世界：沒有 collision', '那格專屬你，只存 value 就好');
  await beat(tok, 3000);
  const b = hlChain(T, 3, '電話B', C8[2], true);
  say('有 collision：[3] 有兩個 value', '要拿哪一個？');
  await beat(tok, 2800);
  const q = cube('get(Bob)', C8[5], [1.6, 0.6, 0.8], -5.4, 0.35, 1.8, 3);
  await beat(tok, 500); move(q, T.xs[3] - 2.4, 0.35, 0.3); glow(a, GOLD); glow(b, GOLD);
  say('h(Bob) = 3，但分不出是誰的', '可能拿到別人的東西');
  await beat(tok, 3000);
  glow(a, null); glow(b, null);
  relabel(a, 'Amy｜電話A'); relabel(b, 'Bob｜電話B');
  say('把 key 跟 value 一起存', '像共用櫃子要貼名字');
  await beat(tok, 2800);
  glow(a, GOLD); await beat(tok, 900); glow(a, null); glow(b, GREEN);
  say('對證件：key 相同才拿走', '找到 Bob 的 value');
  await beat(tok, 3000);
}]);

// 127:03 Load factor n/k：太大、或 hash non-uniform，hash 就不 work
FRAG.push(['hashlin2-load', 'Load factor n/k 與 non-uniform', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, 0]);
  const T = hlRow(10, 1.15, 1.6);
  let bars = [];
  const show = (cnts) => { bars.forEach(kill); bars = cnts.map((n, i) => n ? cube(n, C8[i % 8], [0.8, Math.max(0.2, n * 0.08), 0.8], T.xs[i], Math.max(0.2, n * 0.08) / 2 + 0.12, T.z, 2) : null).filter(Boolean); };
  say('k 格裡放了 n 個 key', 'load factor = n / k');
  await beat(tok, 2600);
  show([1, 0, 1, 0, 1, 1, 0, 0, 1, 0]);
  say('n = 5、k = 10：每格大約 0～1 個', 'n / k = 0.5：越小越不會撞');
  await beat(tok, 3000);
  show(new Array(10).fill(10));
  say('n = 100、k = 10：每格 10 個', 'n / k 太大 → hash won\'t work');
  await beat(tok, 3200);
  show([0, 34, 0, 0, 33, 0, 0, 33, 0, 0]);
  bars.forEach((b) => glow(b, RED));
  say('non-uniform：100 筆只集中 3 格', '每格 30 幾個，碰撞更嚴重');
  await beat(tok, 3200);
  say('兩種都要小心', 'n/k 太大，或 hash 不夠分散');
  await beat(tok, 2600);
}]);

// 130:45 改 hash function、增加格子；K > N：空間換時間
FRAG.push(['hashlin2-space', '格子比 key 多：空間換時間', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  let T = hlRow(4, 2.2, -2.6, null, -0.85);
  const keys = [3, 7, 11, 2, 6, 9];
  keys.forEach((k) => hlChain(T, k % 4, k));
  say('常塞同一格 → 改進 hash function', '讓它更亂、更分散');
  await beat(tok, 3000);
  say('東西太多、格子太少', '6 個 key、4 格：chain 變長');
  await beat(tok, 2800);
  const U = hlRow(16, 0.78, 2.2);
  keys.forEach((k) => { const c = T.ch[k % 4].shift(); move(c, U.xs[k], 0.45, U.z); });
  say('只能增加格子：k = 16', 'x mod 16：一人一格');
  await beat(tok, 3000);
  say('K 比 N 大：幾乎沒有 collision', '有的格子沒人住，就讓它空著');
  await beat(tok, 3000);
  say('用空間換取時間', '跟 integer array 一樣方便');
  await beat(tok, 2800);
}]);

// 132:55 Hash table 要長大：n/k 太大 → k 變兩倍，range 改成 0～2k−1，再 rebuild
FRAG.push(['hashlin2-grow', 'Load 太大：table 長大兩倍', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.2, -3.0, null, -0.85);
  const st = tag('n = 0, k = 4', 'ptr alt', 5.2, 1.4, -3.0);
  say('資料越來越多：n/k 跟著變大', '像 vector 塞到滿了');
  await beat(tok, 2600);
  const keys = [5, 9, 2, 12, 7, 14];
  for (let i = 0; i < keys.length; i++) { hlChain(T, keys[i] % 4, keys[i], null, true); txt(st, 'n = ' + (i + 1) + ', k = 4'); await beat(tok, 600); }
  glow(T.slots[1], RED); glow(T.slots[2], RED);
  say('n/k = 1.5：太滿了', 'load factor too big → increase k');
  await beat(tok, 3000);
  const U = hlRow(8, 1.45, 1.4, null, -0.85);
  txt(st, 'k：4 → 8');
  say('學 vector：一次長兩倍', 'k_new = 2 · k_old');
  await beat(tok, 2800);
  say('h 的 range 改成 0 ～ 2k − 1', 'h(x) = x mod 8');
  await beat(tok, 2600);
  for (const k of keys) { const c = T.ch[k % 4].shift(); hlRelayout(T, k % 4); U.ch[k % 8].push(c); const [x, y, z] = cpos(U, k % 8, U.ch[k % 8].length - 1); move(c, x, y, z); await beat(tok, 450); }
  glow(T.slots[1], null); glow(T.slots[2], null);
  say('再 rebuild：舊的一個個塞進新表', 'n/k = 6/8 = 0.75');
  await beat(tok, 3000);
}]);

// 135:56 Full rebuild：n 筆 × O(1) = O(n)，使用者要 long waiting
FRAG.push(['hashlin2-full-cost', 'Full rebuild：O(n) 與 long waiting', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.2, -3.0, null, -0.85), U = hlRow(8, 1.45, 1.4, null, -0.85);
  const keys = [5, 9, 2, 12, 7, 14, 3, 8];
  keys.forEach((k) => hlChain(T, k % 4, k));
  const cnt = tag('搬了 0 筆', 'ptr alt', 5.6, 1.4, -3.0);
  say('full rebuild：每一筆都拿出來', '用新的 hash 重新 insert');
  await beat(tok, 2800);
  let n = 0;
  for (const k of keys) {
    const c = T.ch[k % 4].shift(); hlRelayout(T, k % 4); U.ch[k % 8].push(c);
    const [x, y, z] = cpos(U, k % 8, U.ch[k % 8].length - 1); move(c, x, y, z); n++;
    txt(cnt, '搬了 ' + n + ' 筆'); say('insert ' + k + ' → [' + (k % 8) + ']', '每筆 insert ≈ O(1)');
    await beat(tok, 700);
  }
  say('n 筆 × O(1) = O(n)', 'hash 夠平均：insert 跟資料量幾乎無關');
  await beat(tok, 3000);
  const shut = tag('整理中，請稍候', 'ptr', 0, 2.6, -0.6);
  say('缺點：long waiting', '像店面關門整理完才開店');
  await beat(tok, 3200);
  kill(shut);
  say('能不能只 rebuild 一部分？', '下一步：partial rebuild');
  await beat(tok, 2400);
}]);

// 138:37 Partial rebuild 的關鍵：mod k → mod 2k，只差一個 bit
FRAG.push(['hashlin2-mod2k', 'mod k 換成 mod 2k：一半不用動', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.3]);
  const T = hlRow(4, 2.0, -3.0, null, -0.85), U = hlRow(8, 1.45, 1.4, null, -0.85);
  tag('mod 4', 'ptr', -5.8, 0.9, -3.0); tag('mod 8', 'ptr', -6.4, 0.9, 1.4);
  const codes = [8, 13, 6, 3, 12, 5, 10, 15];
  codes.forEach((k) => hlChain(T, k % 4, k));
  say('partial：只改有問題的地方', '新舊 hash function 要有關係');
  await beat(tok, 3000);
  say('h = hash code mod k', 'k → 2k：只差一個 bit');
  await beat(tok, 2800);
  for (const k of codes) {
    const c = T.ch[k % 4].shift(); hlRelayout(T, k % 4); U.ch[k % 8].push(c);
    const [x, y, z] = cpos(U, k % 8, U.ch[k % 8].length - 1); move(c, x, y, z);
    const same = k % 8 === k % 4; glow(c, same ? GREEN : GOLD);
    say(k + '：mod 4 = ' + (k % 4) + '，mod 8 = ' + (k % 8), same ? '位置不變' : '搬到 ' + (k % 4) + ' + 4');
    await beat(tok, 1100);
  }
  say('結果在 0～k−1 的：位置跟原來一致', '綠色不動');
  await beat(tok, 2800);
  say('只有 k～2k−1 那邊會變', 'x mod 2k ∈ {x mod k, x mod k + k}');
  await beat(tok, 3000);
}]);

// 141:25 例子：4 格 chain table，hash code = key[0] − 'a'；insert egg → [0] 太滿
const WD = [['at', 0], ['eat', 4], ['bird', 1], ['good', 6], ['cat', 2], ['dog', 3]];
const wcol = (w) => C8[(w.charCodeAt(0) - 97) % 8];
FRAG.push(['hashlin2-words', '例子：hash code = key[0] − \'a\'，mod 4', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.6]);
  const T = hlRow(4, 2.6, -2.8, null, -0.85);
  T.cw = 1.5;
  say('hash table 4 格，用 chain', 'hash code = key[0] − \'a\'');
  await beat(tok, 2800);
  for (const [w, hc] of WD) {
    hlChain(T, hc % 4, w, wcol(w), true);
    say(w + '：hash code ' + hc + '，mod 4 = ' + (hc % 4), w[0] + ' 開頭');
    await beat(tok, 1100);
  }
  say('[0]：a、e 開頭；[2]：c、g 開頭', 'at、eat｜bird｜good、cat｜dog');
  await beat(tok, 3000);
  const e = hlChain(T, 0, 'egg', wcol('egg'), true);
  say('insert egg：e 開頭 → [0]', '4 mod 4 = 0');
  await beat(tok, 2200);
  T.ch[0].forEach((c) => glow(c, RED));
  say('[0] 這條 chain 長度變 3', '太滿了 → 想要 rebuild');
  await beat(tok, 3000);
}]);

// 143:46 Full rebuild 成 8 格：拜訪每個 key；eat、egg → [4]、good → [6]
FRAG.push(['hashlin2-full8', 'Full rebuild：mod 4 → mod 8', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  const T = hlRow(4, 2.0, -3.2, null, -0.85), U = hlRow(8, 1.5, 1.0, null, -0.85);
  T.cw = 1.4; U.cw = 1.2;
  const all = [...WD.slice(0, 2), ['egg', 4], ...WD.slice(2)];
  all.forEach(([w, hc]) => hlChain(T, hc % 4, w, wcol(w)));
  say('表長兩倍：多了 4、5、6、7', '紅色 mod 4 → 現在 mod 8');
  await beat(tok, 3000);
  let n = 0;
  for (const [w, hc] of all) {
    const i = T.ch[hc % 4].findIndex((c) => c.userData.v === w); const c = T.ch[hc % 4].splice(i, 1)[0];
    hlRelayout(T, hc % 4); U.ch[hc % 8].push(c); const [x, y, z] = cpos(U, hc % 8, U.ch[hc % 8].length - 1); move(c, x, y, z); n++;
    glow(c, hc < 4 ? GREEN : GOLD);
    say(w + '：' + hc + ' mod 8 = ' + hc % 8, hc < 4 ? '留在原來的位置' : '需要移動');
    await beat(tok, 1000);
  }
  say('a、b、c、d 開頭留在原位', 'eat、egg → [4]、good → [6]');
  await beat(tok, 3000);
  say('但每一個都拜訪過了', 'full rebuild：O(n)');
  await beat(tok, 2600);
}]);

// 145:21 Partial rebuild：只拆 overflow 的 [0] → [0]、[4]；5、6、7 先指回原 chain
FRAG.push(['hashlin2-partial', 'Partial rebuild：只拆滿出來的那條', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  const U = hlRow(8, 1.5, -2.6, null, -0.85);
  U.cw = 1.25;
  [['at', 0], ['eat', 0], ['egg', 0], ['bird', 1], ['good', 2], ['cat', 2], ['dog', 3]].forEach(([w, i]) => hlChain(U, i, w, wcol(w)));
  [4, 5, 6, 7].forEach((i) => glow(U.slots[i], GOLD));
  say('也長成 8 格，但先不全部搬', 'good 那條還沒滿：留在原處');
  await beat(tok, 3000);
  U.ch[0].forEach((c) => glow(c, RED));
  say('滿出來的是 [0]：長度 3', '只把這條拆開');
  await beat(tok, 2600);
  for (const w of ['eat', 'egg']) {
    const i = U.ch[0].findIndex((c) => c.userData.v === w); const c = U.ch[0].splice(i, 1)[0];
    U.ch[4].push(c); const [x, y, z] = cpos(U, 4, U.ch[4].length - 1); move(c, x, y, z); glow(c, GOLD);
    await beat(tok, 700);
  }
  hlRelayout(U, 0); U.ch[0].forEach((c) => glow(c, null));
  say('[0] 拆成 [0]、[4] 兩條', 'at 留在 [0]；eat、egg → [4]');
  await beat(tok, 3000);
  [5, 6, 7].forEach((j) => arrow(V3(U.xs[j], 0.35, U.z + 0.6), V3(U.xs[j - 4] + 0.7, 0.45, U.z + 1.0), 0xc08a1f));
  say('5、6、7 的小紙條先指回 1、2、3', '還沒分家：共用原來的 chain');
  await beat(tok, 3200);
  const cur = tag('get(good)', 'ptr alt', U.xs[6], 1.8, U.z);
  say('找 good：hash code 6 → [6]', '[6] 的紙條指到 [2] 的 chain');
  await beat(tok, 2400);
  cur.position.set(U.xs[2] + 0.4, 1.4, U.z + 1.05); glow(U.ch[2][0], GREEN);
  say('在原來的 chain 找到 good', '只有 overflow 的地方才分家');
  await beat(tok, 3000);
}]);

// 147:01 成本：k + n/k vs n；extendable hash table
FRAG.push(['hashlin2-cost', 'Partial rebuild：k + n/k 比 n 小', async (tok) => {
  fresh([0, 7, 12], [0, 1.4, 0]);
  say('partial rebuild 要花多少力氣？', '');
  await beat(tok, 2000);
  const p1 = cube('k', C8[0], [1.4, 0.6, 1.2], 1.2, 0.3, 0, 3); tag('連小紙條', 'idx', 1.2, 1.1, 1.2);
  say('k：把新格子連到舊 chain', '紙條 k 張');
  await beat(tok, 2600);
  const p2 = cube('n/k', C8[2], [1.4, 0.6, 1.2], 1.2, 0.9, 0, 3); tag('拆 overflow 的那條', 'idx', 1.2, 1.7, 1.2);
  say('n/k：拆開 overflow 的那一條', '一條大約 n/k 個');
  await beat(tok, 2600);
  const f = cube('n', C8[4], [1.4, 5.0, 1.2], -2.6, 2.5, 0, 0); tag('full rebuild', 'ptr', -2.6, 5.6, 0); tag('partial', 'ptr', 1.2, 2.2, 0);
  say('例：n = 10000、k = 100', 'full：10000；partial：100 + 100 = 200');
  await beat(tok, 3400);
  say('n 不少時，k + n/k 比 n 小很多', '等待時間變短');
  await beat(tok, 2800);
  say('這就是 extendable hash table', '分析跟 extendable array 一樣：長兩倍');
  await beat(tok, 3000);
  say('代價：要多寫程式記住誰還沒分家', 'full 簡單但 slow；partial 需要巧思');
  await beat(tok, 3000);
}]);

// 153:38 / 157:45 / 163:33 總結：藍 hash code、橘 compress、紅 collision handling、綠 open addressing、桃紅 extendable
FRAG.push(['hashlin2-recap', 'Hash table 總整理', async (tok) => {
  const part = (ctx.params || {}).part || 0;
  fresh([0, 8, 12], [0, 0.6, 0.2]);
  const key = cube('key', C8[1], [1.0, 0.6, 0.9], -6.2, 0.3, -3.0, 3);
  const hc = cube('HashCode', '#4b9ee2', [2.2, 0.7, 1.0], -3.9, 0.35, -3.0, 3);
  const cp = cube('Compress', '#dd8238', [2.2, 0.7, 1.0], -1.0, 0.35, -3.0, 3);
  const co = cube('Collision', '#c0392b', [2.2, 0.7, 1.0], 2.1, 0.35, -3.0, 3);
  const ex = cube('Extendable', '#e55a9b', [2.2, 0.7, 1.0], 5.2, 0.35, -3.0, 3);
  [[-5.6, -5.1], [-2.7, -2.2], [0.2, 0.9], [3.3, 4.0]].forEach(([a, b]) => arrow(V3(a, 0.4, -3.0), V3(b, 0.4, -3.0)));
  tag('sum／poly／cyclic', 'idx', -3.9, 1.1, -3.0); tag('mod k', 'idx', -1.0, 1.1, -3.0); tag('full → partial', 'idx', 5.2, 1.1, -3.0);
  const opts = [['0 不理他', -0.2], ['1–3 secondary', 2.1], ['4 open addr.', 4.4]].map(([s, x], i) => cube(s, i === 2 ? '#2fc092' : C8[i + 5], [2.0, 0.6, 0.9], x, 0.3, -0.6, 3));
  opts.forEach((o) => arrow(V3(2.1, 0.3, -2.4), V3(o.position.x, 0.4, -1.1), 0x7a1010));
  const oa = [['linear', 2.6], ['quadratic', 4.4], ['double', 6.1]].map(([s, x]) => cube(s, '#0f8a5a', [1.6, 0.5, 0.8], x, 0.25, 1.8, 3));
  await beat(tok, 1200);
  const H = (arr, c) => arr.forEach((m) => glow(m, c));
  const p1 = async () => {
    H([key, hc], GOLD);
    say('出發點：key 不是 integer、沒 order', '先轉成 hash code');
    await beat(tok, 3000);
    H([key], null); H([cp], GOLD);
    say('再 compress 到 0～k−1', 'h(key) = hashcode(key) mod k');
    await beat(tok, 3000);
    say('hash code 的目的：分散', 'sum → polynomial → cyclic');
    await beat(tok, 3000); H([hc, cp], null);
  };
  const p2 = async () => {
    H([co], GOLD);
    say('insert 時格子有人：collision', '怎麼處理會影響 get / search');
    await beat(tok, 3000);
    H([opts[0]], GOLD);
    say('不理他：容許一點 error', 'data structure 不一定 error free');
    await beat(tok, 2800); H([opts[0]], null); H([opts[1]], GOLD);
    say('secondary：array、list、container', 'hierarchical 的設計');
    await beat(tok, 2800); H([opts[1]], null); H([opts[2], ...oa], GOLD);
    say('open addressing：reuse 現有空間', 'linear → quadratic → double');
    await beat(tok, 3000); H([co, opts[2], ...oa], null);
  };
  const p3 = async () => {
    H([ex], GOLD);
    say('越來越滿：讓 table 長大', '另一種 collision handling');
    await beat(tok, 3000);
    say('naive：full rebuild', 'partial：只 rebuild overflow 的地方');
    await beat(tok, 3000);
    say('複習 double the table 這招', '靜態 hash table → 動態長大');
    await beat(tok, 3000); H([ex], null);
  };
  if (part === 1) await p1(); else if (part === 2) await p2(); else if (part === 3) await p3();
  else { await p1(); await p2(); await p3(); }
  say('設計 hash table 要想這幾件事', 'hash code、compress、collision、策略');
  await beat(tok, 2800);
}]);
  }

  // ═══ hashpeng.js ═══
  {
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, code, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;
// ─── bULIs7AVDNk（交大彭文志 Lec23 Hashing，洪逸／Horowitz 第 8 章 ＋ 第 10 章開頭） ───
const PP = ['#4b9ee2', '#9b7ef4', '#dd8238', '#31aab0', '#e55a9b', '#2fc092', '#c08a1f', '#5c7a4a'];
const ppCol = (k) => PP[[...String(k)].reduce((a, c) => a + c.charCodeAt(0), 0) % PP.length];
const ppSub = (i) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');
const ppLet = (k) => k.charCodeAt(0) - 65; // h(x) = 第一個字母的順序（A = 0）
// a row of m one-slot buckets centred on x = 0 (only the first `show` drawn)
function ppRow(m, dx, z, show = m) {
  const x0 = -(show - 1) * dx / 2, xs = [], slots = [];
  for (let i = 0; i < show; i++) { const x = x0 + i * dx; xs.push(x); slots.push(cube('', GRAY, [dx * 0.9, 0.12, 1.2], x, 0.06, z)); tag(String(i), 'idx', x, 0, z + 1.0); }
  return { m, dx, z, xs, slots, keys: new Array(m).fill(null), vals: new Array(m).fill(null), ks: Math.min(0.9, dx * 0.85) };
}
function ppPut(T, i, k, drop) { const c = cube(k, ppCol(k), [T.ks, 0.7, 0.9], T.xs[i], 0.47, T.z, drop ? 3 : 0); T.keys[i] = c; T.vals[i] = k; return c; }
// open-addressing insert: H_i(k) = (h(k) + f(i)) mod m, cursor shows i
async function ppIns(tok, T, k, h, f, fs, cur, ms = 1100) {
  for (let i = 0; i < T.m; i++) {
    const j = (h + f(i)) % T.m;
    cur.position.set(T.xs[j], 1.8, T.z); txt(cur, 'i = ' + i);
    const fm = 'H' + ppSub(i) + '(' + k + ') = (' + h + ' + ' + fs(i) + ') mod ' + T.m + ' = ' + j;
    if (T.keys[j] === null) { ppPut(T, j, k, true); say('insert ' + k + '：放進 [' + j + ']', fm); await beat(tok, ms); return i; }
    glow(T.keys[j], RED); say(k + '：[' + j + '] 已被 ' + T.vals[j] + ' 佔', fm + '　滿了，i + 1');
    await beat(tok, ms); glow(T.keys[j], null);
  }
  return -1;
}
const ppLin = [(i) => i, (i) => String(i)], ppQuad = [(i) => i * i, (i) => i + '²'];

// ════════ 00:00 symbol table：retrieve / insert / delete ════════
FRAG.push(['hashpeng-symtab', 'Symbol table：查表、insert、delete', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const bx = [-4.5, -1.5, 1.5, 4.5];
  ['00', '01', '10', '11'].forEach((b, i) => { cube('', GRAY, [2.4, 0.12, 1.4], bx[i], 0.06, -2.5); tag('bucket ' + b, 'idx', bx[i], 0, -1.5); });
  say('Bucket sort：看數字的幾個 bit 分桶', '這就是 hash 的概念');
  await beat(tok, 2600);
  const nums = [[5, '101'], [8, '1000'], [6, '110'], [3, '11']], cs = [];
  for (const [n, b] of nums) {
    const i = parseInt(b.slice(-2), 2);
    cs.push(cube(n, ppCol(n), [0.8, 0.7, 0.8], bx[i], 0.47, -2.5, 3));
    say(n + ' = ' + b + '₂ → 看最後兩個 bit', '丟進 bucket ' + b.slice(-2));
    await beat(tok, 1200);
  }
  await beat(tok, 800);
  cs.forEach((c) => fly(c));
  const rows = [['INT', 'machine code'], ['LOOP', 'address'], ['SUM', 'address']];
  tag('symbol', 'ptr', -2.2, 0.9, 0.4); tag('attribute', 'ptr', 2.2, 0.9, 0.4);
  const R = rows.map(([s, a], i) => [cube(s, PP[i], [2.2, 0.6, 0.8], -2.2, 0.3, 1.5 + i * 1.1, 3), cube(a, GRAY, [3.0, 0.6, 0.8], 2.2, 0.3, 1.5 + i * 1.1, 3)]);
  say('Assembler 的 symbol table', '左邊字串、右邊對應的 attribute');
  await beat(tok, 3200);
  glow(R[0][0], GOLD); glow(R[0][1], GREEN);
  say('看到 INT → 查表拿 machine code', 'retrieve：找 key 對應的 attribute');
  await beat(tok, 3000);
  glow(R[0][0], null); glow(R[0][1], null);
  const n1 = cube('NEW', PP[5], [2.2, 0.6, 0.8], -2.2, 0.3, 4.8, 4), n2 = cube('…', GRAY, [3.0, 0.6, 0.8], 2.2, 0.3, 4.8, 4);
  say('修改 table：insert 一筆', 'insert');
  await beat(tok, 2200);
  fly(R[2][0]); fly(R[2][1]);
  say('也可以 delete 一筆', 'delete');
  await beat(tok, 2200);
  say('通訊錄、database 也都是這種 table', '最頻繁的運算：search');
  glow(n1, null); glow(n2, null);
  await beat(tok, 3000);
}]);

// ════════ 04:25 search：O(n)、binary search、hash ════════
FRAG.push(['hashpeng-search-cost', 'Search：O(n)、O(log n)、hash 的 O(1)', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const K8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], xs = K8.map((_, i) => -5.25 + i * 1.5);
  const cs = K8.map((k, i) => cube(k, ppCol(k), [1.2, 0.7, 1.0], xs[i], 0.35, -1.5));
  const cur = tag('', 'ptr', xs[0], 1.6, -1.5);
  say('最笨：每一筆都看過', 'search G：worst case O(n)');
  for (let i = 0; i <= 6; i++) { cur.position.set(xs[i], 1.6, -1.5); txt(cur, '第 ' + (i + 1) + ' 次'); glow(cs[i], i === 6 ? GREEN : GOLD); await beat(tok, 600); glow(cs[i], null); }
  await beat(tok, 1200);
  say('先排序，再用 binary search', 'O(log n)：每次砍一半');
  let lo = 0, hi = 7, step = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; step++;
    cur.position.set(xs[mid], 1.6, -1.5); txt(cur, '第 ' + step + ' 次'); glow(cs[mid], mid === 6 ? GREEN : GOLD);
    await beat(tok, 1100); glow(cs[mid], null);
    if (mid === 6) break; if (mid < 6) lo = mid + 1; else hi = mid - 1;
  }
  say('還是不夠快 → hash', '兩個關鍵：key 與 hash function');
  await beat(tok, 2600);
  const bk = [0, 1, 2, 3].map((i) => { cube('', GRAY, [1.6, 0.12, 1.2], -2.4 + i * 1.6, 0.06, 2.6); tag('bucket ' + i, 'idx', -2.4 + i * 1.6, 0, 3.6); return -2.4 + i * 1.6; });
  const k = cube('G', ppCol('G'), [1.0, 0.7, 0.9], -5.6, 0.35, 2.6, 3);
  await beat(tok, 900);
  arrow(V3(-5.0, 0.6, 2.6), V3(bk[2] - 0.6, 0.6, 2.6), 0x0f5a3a);
  move(k, bk[2], 0.47, 2.6); glow(k, GREEN);
  say('算一次 h(key) 就知道在哪個 bucket', 'insert / delete / search：constant time');
  await beat(tok, 3200);
}]);

// ════════ 06:41 static vs dynamic hashing ════════
FRAG.push(['hashpeng-static-dynamic', 'Static hashing 與 dynamic hashing', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  tag('static', 'ptr', -3.6, 3.4, -1); tag('dynamic', 'ptr alt', 3.6, 3.4, -1);
  const sx = [-5.4, -4.2, -3.0, -1.8];
  sx.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  say('Static：h 一旦決定就不變', '不管資料怎麼分佈都一樣');
  await beat(tok, 2600);
  for (let n = 0; n < 4; n++) { cube('', PP[n], [0.8, 0.5, 0.8], sx[1], 0.37 + n * 0.55, 0, 3); await beat(tok, 500); }
  say('資料偏向某一格也照樣丟進去', 'h(x) 固定');
  await beat(tok, 2400);
  const b = cube('', GRAY, [2.2, 0.12, 1.2], 3.6, 0.06, 0);
  const d = [];
  for (let n = 0; n < 3; n++) { d.push(cube('', PP[n + 4], [0.6, 0.5, 0.8], 2.9 + n * 0.7, 0.37, 0, 3)); await beat(tok, 500); }
  say('Dynamic：依資料的 distribution', '自動調整 hash function');
  await beat(tok, 2400);
  kill(b);
  cube('', GRAY, [1.4, 0.12, 1.2], 2.6, 0.06, 0); cube('', GRAY, [1.4, 0.12, 1.2], 4.6, 0.06, 0);
  move(d[0], 2.3, 0.37, 0); move(d[1], 2.9, 0.37, 0); move(d[2], 4.6, 0.37, 0);
  say('滿了就分裂，bucket 跟著資料長', 'database 常用 dynamic hashing');
  await beat(tok, 3000);
  say('本章先講 static，再講 dynamic', 'dynamic：trie、directory、directoryless');
  await beat(tok, 3000);
}]);

// ════════ 09:04 h(x)、b 個 bucket、s 個 slot、兩種 density ════════
FRAG.push(['hashpeng-density', 'b 個 bucket、每個 s 格：identifier density 與 loading density', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.8, 0]);
  const b = 6, s = 2, xs = [...Array(b)].map((_, i) => -3.75 + i * 1.5);
  xs.forEach((x, i) => { for (let j = 0; j < s; j++) cube('', GRAY, [1.2, 0.1, 0.9], x, 0.05, -0.6 + j * 1.1); tag(String(i), 'idx', x, 0, 1.4); });
  tag('slot 1', 'idx', -5.6, 0, -0.6); tag('slot 2', 'idx', -5.6, 0, 0.5);
  say('Hash table：b 個 bucket，編號 0 ～ b−1', '這裡 b = 6，每個 bucket 放 s = 2 筆');
  await beat(tok, 3000);
  const put = [['x₁', 4, 0], ['x₂', 1, 0], ['x₃', 4, 1], ['x₄', 0, 0]];
  const fx = tag('', 'ptr', 0, 2.4, -0.2);
  for (const [k, h, j] of put) {
    txt(fx, 'h(' + k + ') = ' + h);
    cube(k, ppCol(k), [0.9, 0.6, 0.8], xs[h], 0.4, -0.6 + j * 1.1, 3);
    say('資料 ' + k + ' 放進 bucket h(' + k + ')', '放的時候算 h，找的時候也算 h');
    await beat(tok, 1500);
  }
  say('identifier density = n / T', 'T = 所有可能的 key 個數；n = 4 筆在表裡');
  await beat(tok, 3400);
  say('loading density α = n / (s·b)', 'α = 4 / (2·6) = 1/3');
  await beat(tok, 3400);
}]);

// ════════ 12:52 collision vs overflow（83:33 Q&A 也用） ════════
FRAG.push(['hashpeng-collide-overflow', 'Collision 與 overflow：s = 1 時同時發生', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  tag('s = 2', 'ptr', -3.2, 3.2, -1); tag('s = 1', 'ptr alt', 3.2, 3.2, -1);
  [-4.4, -3.2, -2.0].forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  const a = cube('i₁', PP[0], [0.8, 0.5, 0.9], -3.2, 0.37, 0, 3);
  say('h(i₁) = h(i₂) = 1', '兩個 key 撞同一個 bucket');
  await beat(tok, 2200);
  const b = cube('i₂', PP[1], [0.8, 0.5, 0.9], -3.2, 0.92, 0, 3);
  glow(a, GOLD); glow(b, GOLD);
  say('這叫 collision', 'bucket 還有空位 → 放得下，沒問題');
  await beat(tok, 4100);
  const c = cube('i₃', PP[2], [0.8, 0.5, 0.9], -3.2, 2.6, 0);
  glow(c, RED);
  say('第三個再撞進來：bucket 滿了', '放不下 → overflow');
  await beat(tok, 3500);
  fly(c, V3(-2, 6, 3));
  [2.0, 3.2, 4.4].forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  cube('i₁', PP[0], [0.8, 0.5, 0.9], 3.2, 0.37, 0, 3);
  await beat(tok, 900);
  const d = cube('i₂', PP[1], [0.8, 0.5, 0.9], 3.2, 1.6, 0); glow(d, RED);
  say('bucket size s = 1：只能放一個', 'collision 一發生就 overflow');
  await beat(tok, 4100);
  say('collision 必然；overflow 看滿沒滿', 's = 1 時兩者同時發生');
  await beat(tok, 4100);
}]);

// ════════ 15:26 26 個 bucket、s = 2：GA, D, A, G, L, A2, A1, A3, A4 ════════
FRAG.push(['hashpeng-letters26', '26 個 bucket、s = 2：A1 開始 overflow', async (tok) => {
  fresh([0, 10, 10.5], [0, 0.3, 0.4]);
  const X = (i) => -6.3 + (i % 13) * 1.05, Z = (i) => (i < 13 ? -1.4 : 2.2);
  for (let i = 0; i < 26; i++) { cube('', GRAY, [0.95, 0.1, 1.0], X(i), 0.05, Z(i)); tag(String(i), 'idx', X(i), 0, Z(i) + 0.9); }
  say('h(x) = 第一個字母的順序', 'A → 0、B → 1 … Z → 25；s = 2');
  await beat(tok, 3000);
  const cnt = new Array(26).fill(0), cubes = {};
  for (const k of ['GA', 'D', 'A', 'G', 'L', 'A2', 'A1', 'A3', 'A4']) {
    const h = ppLet(k);
    if (cnt[h] < 2) {
      cubes[k] = cube(k, ppCol(k), [0.85, 0.5, 0.85], X(h), 0.35 + cnt[h] * 0.55, Z(h), 3); cnt[h]++;
      say(k + '：h = ' + h + '，放進 bucket ' + h, 'bucket ' + h + '：' + cnt[h] + ' / 2');
      await beat(tok, 1100);
    } else {
      const c = cube(k, RED, [0.85, 0.5, 0.85], X(h), 1.9, Z(h)); glow(c, RED);
      say(k + '：bucket 0 已經滿了', '<span class="no">overflow</span>');
      await beat(tok, 1300); fly(c, V3(-3, 6, -3));
    }
  }
  say('A1、A3、A4 都 overflow', '資料不能丟 → 要有 overflow 處理方法');
  await beat(tok, 3200);
}]);

// ════════ 17:57 uniform hash function ════════
FRAG.push(['hashpeng-uniform', 'Uniform hash function：每格機率 1/b', async (tok) => {
  fresh([0, 7, 12], [0, 1, 0]);
  const xa = [-5.4, -4.2, -3.0, -1.8], xb = [1.8, 3.0, 4.2, 5.4];
  tag('skewed', 'ptr', -3.6, 4.6, -1); tag('uniform', 'ptr alt', 3.6, 4.6, -1);
  xa.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  xb.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  say('設計不好：每筆都丟到 bucket 0', '其他 bucket 閒著，很快 overflow');
  for (let n = 0; n < 6; n++) { const c = cube('', PP[n], [0.8, 0.45, 0.8], xa[0], 0.35 + n * 0.5, 0, 3); if (n >= 2) glow(c, RED); await beat(tok, 450); }
  await beat(tok, 2400);
  say('Uniform：丟到每個 bucket 機率一樣', 'P(h(x) = i) = 1/b');
  for (let n = 0; n < 8; n++) { cube('', PP[n], [0.8, 0.45, 0.8], xb[n % 4], 0.35 + Math.floor(n / 4) * 0.5, 0, 3); await beat(tok, 450); }
  await beat(tok, 2400);
  say('目標：collision 少、每格平均', '1/b 是理想，實際只能接近');
  await beat(tok, 4100);
}]);

// ════════ 20:14 mid-square 與 division（M = 2^i 不好） ════════
FRAG.push(['hashpeng-midsq-div', 'Mid-square 與 division：除以 2ⁱ 只看最後 i 個 bit', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0]);
  const bits = '10101001', bx = (i) => -2.8 + i * 0.8;
  cube('13', PP[0], [1.0, 0.7, 0.9], -5.4, 0.35, -2.2, 3); tag('x', 'idx', -5.4, 0, -1.3);
  say('Mid-square：key 化成二進位後平方', '例：x = 13，x² = 169 = 10101001₂');
  const bs = [...bits].map((b, i) => cube(b, GRAY, [0.7, 0.6, 0.8], bx(i), 0.3, -2.2, 3));
  await beat(tok, 3000);
  [3, 4].forEach((i) => glow(bs[i], GOLD));
  say('取中間幾個 bit 當 bucket 編號', '取 2 bit：01₂ → bucket 1（取幾個不限定）');
  await beat(tok, 3200);
  const keys = [['A1', '100001'], ['B1', '101001'], ['C1', '110001']];
  say('Division：h(x) = x mod M', 'M = 2ⁱ 的話只剩最後 i 個 bit');
  const rows = keys.map(([k, b], r) => {
    cube(k, ppCol(k), [0.9, 0.6, 0.8], -5.4, 0.3, 0.6 + r * 1.1, 3);
    return [...b].map((c, i) => cube(c, GRAY, [0.6, 0.5, 0.8], -3.6 + i * 0.7, 0.25, 0.6 + r * 1.1, 3));
  });
  await beat(tok, 3000);
  rows.forEach((r) => glow(r[5], RED));
  const bk = cube('', GRAY, [1.6, 0.12, 1.2], 3.6, 0.06, 1.7); tag('bucket 1', 'idx', 3.6, 0, 2.8);
  arrow(V3(1.0, 0.5, 1.7), V3(2.6, 0.5, 1.7), 0x7a1010);
  say('A1、B1、C1 最後一個 bit 都是 1', 'x mod 2 = 1 → 全擠在 bucket 1');
  await beat(tok, 3400);
  say('M = 2 只有兩個 bucket，很快就滿', 'M 不一定要 2 的倍數，例如 10、15');
  await beat(tok, 3200);
}]);

// ════════ 27:17 overflow 的兩種處理 ════════
FRAG.push(['hashpeng-two-ways', 'Overflow 處理：open addressing 與 chaining', async (tok) => {
  fresh([0, 7, 12], [0, 1, 0]);
  tag('open addressing', 'ptr', -3.6, 3.8, -1); tag('chaining', 'ptr alt', 3.6, 3.8, -1);
  const xa = [-5.4, -4.2, -3.0, -1.8];
  xa.forEach((x, i) => { cube('', GRAY, [1.0, 0.12, 1.2], x, 0.06, 0); tag(String(i), 'idx', x, 0, 1); });
  cube('A', PP[0], [0.85, 0.6, 0.9], xa[0], 0.42, 0, 3);
  const n = cube('A2', PP[1], [0.85, 0.6, 0.9], xa[0], 2.2, 0); glow(n, RED);
  say('bucket 0 滿了，A2 要放哪？', 'overflow');
  await beat(tok, 3200);
  move(n, xa[1], 0.42, 0); glow(n, null);
  say('Open addressing：開放別的 bucket', '去附近找空的 bucket 放');
  await beat(tok, 4100);
  const hx = 3.0;
  cube('[0]', GRAY, [1.0, 0.6, 1.0], hx, 0.3, -1.2);
  lnodeP('A', hx, 0.3, 0.4);
  await beat(tok, 1000);
  arrow(V3(hx, 0.4, -0.7), V3(hx, 0.4, -0.15));
  const c = lnodeP('A2', hx, 0.3, 2.0);
  arrow(V3(hx, 0.4, 0.95), V3(hx, 0.4, 1.45));
  say('Chaining：不佔別人的 bucket', '同一個 bucket 用 linked list 串起來排隊');
  await beat(tok, 4300);
  say('兩種策略', 'open addressing ／ chaining');
  await beat(tok, 3200);
  function lnodeP(v, x, y, z) { const m = cube(v, ppCol(v), [1.0, 0.6, 1.0], x, y, z, 3); return m; }
}]);

// ════════ 28:38 linear open addressing：GA, D, A, G, L, A2, A1（s = 1） ════════
FRAG.push(['hashpeng-lp-letters', 'Linear open addressing：G 放到 7、A1 放到 2', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  const T = ppRow(26, 1.0, 0, 13);
  tag('（26 格，只畫 0～12）', 'idx', 4.8, 2.6, -1.2);
  const cur = tag('', 'ptr', 0, 1.8, 0);
  say('同一個例子，改成 s = 1', 'h(x) = 第一個字母的順序');
  await beat(tok, 2200);
  for (const k of ['GA', 'D', 'A', 'G', 'L', 'A2', 'A1']) {
    let j = ppLet(k), tries = 0;
    while (T.keys[j] !== null) {
      cur.position.set(T.xs[j], 1.8, 0); txt(cur, '[' + j + '] 滿');
      glow(T.keys[j], RED); say(k + '：bucket ' + j + ' 被 ' + T.vals[j] + ' 佔了', '往下一個 bucket 找');
      await beat(tok, 1000); glow(T.keys[j], null); j = (j + 1) % 26; tries++;
    }
    cur.position.set(T.xs[j], 1.8, 0); txt(cur, '[' + j + ']');
    ppPut(T, j, k, true);
    say(k + '：放進 bucket ' + j, tries ? 'h(' + k + ') = ' + ppLet(k) + '，往下 ' + tries + ' 格' : 'h(' + k + ') = ' + j);
    await beat(tok, 1000);
  }
  say('search G：h(G) = 6', '');
  cur.position.set(T.xs[6], 1.8, 0); txt(cur, '[6]'); glow(T.keys[6], GOLD);
  say('bucket 6 是 GA，不是 G', '不能馬上說「G 不在表裡」');
  await beat(tok, 2600); glow(T.keys[6], null);
  cur.position.set(T.xs[7], 1.8, 0); txt(cur, '[7]'); glow(T.keys[7], GREEN);
  say('往下一格找：bucket 7 找到 G', '可能 overflow 了，要多走幾步');
  await beat(tok, 3000);
}]);

// ════════ 32:53 general form：H_i(k) = (h(k) + f(i)) mod ts ════════
FRAG.push(['hashpeng-probe-forms', 'H_i(k) = (h(k) + f(i)) mod ts：linear、quadratic、double', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  const T = ppRow(10, 1.2, 0);
  const cur = tag('', 'ptr', 0, 1.8, 0);
  say('一般式：H_i(k) = (h(k) + f(i)) mod ts', 'h = 原本的 hash function，ts = bucket 數');
  await beat(tok, 3400);
  ppPut(T, 0, 'A', false);
  say('第 i 次 probe 多跳 f(i) 格', 'i = 0 就是原本的 h(k)');
  await beat(tok, 2600);
  for (const [name, f, fs] of [['linear：f(i) = i', (i) => i, (i) => String(i)], ['quadratic：f(i) = i²', (i) => i * i, (i) => i + '²']]) {
    for (let i = 0; i < 4; i++) {
      const j = f(i) % 10; cur.position.set(T.xs[j], 1.8, 0); txt(cur, 'i = ' + i);
      glow(T.slots[j], GOLD);
      say(name, 'H' + ppSub(i) + ' = (0 + ' + fs(i) + ') mod 10 = ' + j);
      await beat(tok, 1000); glow(T.slots[j], null);
    }
  }
  say('quadratic 跳得比較遠', '不會全擠在 A 旁邊');
  await beat(tok, 2600);
  say('double hash：改用另一個 hash', 'probe：問鄰居「有沒有人住？」');
  await beat(tok, 3000);
}]);

// ════════ 36:16 linear probing：89, 18, 49, 58（mod 10） ════════
FRAG.push(['hashpeng-lp-89', 'Linear probing：89, 18, 49, 58 → 49 在 [0]、58 在 [1]', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const T = ppRow(10, 1.2, -1.2);
  const cur = tag('', 'ptr', 0, 1.8, -1.2);
  say('H_i(k) = (k mod 10 + i) mod 10', 'linear：f(i) = i，i 從 0 開始');
  await beat(tok, 2800);
  for (const k of [89, 18, 49, 58]) await ppIns(tok, T, k, k % 10, ppLin[0], ppLin[1], cur, 1200);
  say('58 試了 i = 0,1,2,3 才放進 [1]', '8 → 9 → 0 → 1');
  await beat(tok, 2600);
  const P = code(['for (i = 0; ; i++) {', '  b = (h(k) + i) % 10;', '  if (bucket[b] 空) break;', '}', 'bucket[b] = k;'], -1.2, 0.6, 0.5, 2.6);
  for (const l of [0, 1, 2, 4]) { P.hl(l); say('寫程式：一個 for 迴圈套公式', '找到空 bucket 就跳出來'); await beat(tok, 900); }
  await beat(tok, 2000);
}]);

// ════════ 41:56 primary clustering ════════
FRAG.push(['hashpeng-primary', 'Primary clustering：8、9、0、1 連成一坨', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const T = ppRow(10, 1.2, -0.6);
  [89, 18, 49, 58].forEach((k) => { let j = k % 10; while (T.keys[j] !== null) j = (j + 1) % 10; ppPut(T, j, k, false); });
  say('linear probing 插完 89, 18, 49, 58', '8, 9, 0, 1 全被佔');
  await beat(tok, 2600);
  [8, 9, 0, 1].forEach((j) => glow(T.keys[j], GOLD));
  say('hash 到同一區的資料越多', '就佔用別人的空間，聚成一坨');
  await beat(tok, 3000);
  const cur = tag('', 'ptr', 0, 1.8, -0.6);
  say('之後撞進來的要一格一格試', 'i 變大 = 要 hash 好多次');
  for (const j of [9, 0, 1, 2]) { cur.position.set(T.xs[j], 1.8, -0.6); txt(cur, j === 2 ? '空' : '滿'); await beat(tok, 800); }
  say('例：69 用 linear 要 9 → 0 → 1 → 2', 'i = 3 才找到空位');
  await beat(tok, 2600);
  say('改進：一次跳遠一點', 'f(i) = i² → quadratic probing');
  await beat(tok, 2800);
}]);

// ════════ 43:25 quadratic probing：89, 18, 49, 58, 69 ════════
FRAG.push(['hashpeng-qp-89', 'Quadratic probing：58 → [2]、69 → [3]', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0]);
  const T = ppRow(10, 1.2, -0.6);
  const cur = tag('', 'ptr', 0, 1.8, -0.6);
  say('H_i(k) = (k mod 10 + i²) mod 10', '指數從 1 變 2 → quadratic');
  await beat(tok, 2800);
  for (const k of [89, 18, 49, 58, 69]) await ppIns(tok, T, k, k % 10, ppQuad[0], ppQuad[1], cur, 1100);
  say('58 跳過 0、1 直接到 [2]', '不像 linear 一格一格擠');
  await beat(tok, 2600);
  say('前面也可乘常數：3i²、4i²', 'f(i) = c·i²');
  await beat(tok, 2600);
}]);

// ════════ 46:53 rehash：h₁, h₂, …, h_m ════════
FRAG.push(['hashpeng-rehash-hm', 'Rehash：滿了就換下一個 hash function', async (tok) => {
  fresh([0, 8, 11], [0, 0.4, 0]);
  const T = ppRow(10, 1.2, 0);
  [3, 7].forEach((j) => ppPut(T, j, j === 3 ? 'p' : 'q', false));
  const k = cube('x', PP[4], [0.9, 0.7, 0.9], -5.6, 0.47, 2.6, 3);
  const cur = tag('', 'ptr', 0, 1.8, 0);
  say('準備 m 個 hash function h₁ … h_m', '例：h₁(x) = 3、h₂(x) = 7、h₃(x) = 1');
  await beat(tok, 4100);
  for (const [i, j] of [[1, 3], [2, 7], [3, 1]]) {
    cur.position.set(T.xs[j], 1.8, 0); txt(cur, 'h' + ppSub(i));
    if (T.keys[j]) { glow(T.keys[j], RED); say('i = ' + i + '：用 h' + ppSub(i) + ' → bucket ' + j + ' 滿了', '換下一個 hash function'); await beat(tok, 2400); glow(T.keys[j], null); }
    else { move(k, T.xs[j], 0.47, 0); glow(k, GREEN); say('i = ' + i + '：h' + ppSub(i) + ' → bucket ' + j + ' 空的', '放進去'); await beat(tok, 3000); }
  }
  say('最多試到 h_m', '考古題常考（課本的 rehashing）');
  await beat(tok, 3800);
}]);

// ════════ 48:08 chaining：12 個 identifier，平均搜尋長度 2 ════════
FRAG.push(['hashpeng-chain12', 'Chaining：12 個 identifier，平均 24/12 = 2', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const B = [0, 3, 4, 6, 11, 25], X = (h) => -5.5 + B.indexOf(h) * 2.2, Y = (d) => 5.8 - d * 1.05;
  B.forEach((h) => { cube('[' + h + ']', GRAY, [1.2, 0.6, 0.8], X(h), 6.9, 0); });
  tag('其他 bucket 是空的', 'idx', 0, 7.9, 0);
  say('bucket = linked list 的頭', 'h(x) = 第一個字母的順序');
  await beat(tok, 2400);
  const L = {}; B.forEach((h) => { L[h] = []; });
  for (const k of ['GA', 'D', 'A', 'G', 'L', 'A2', 'A1', 'A3', 'A4', 'Z', 'ZA', 'E']) {
    const h = ppLet(k), ch = L[h];
    ch.forEach((c, d) => move(c, X(h), Y(d + 1), 0));
    const c = cube(k, ppCol(k), [1.0, 0.6, 0.8], X(h), Y(0), 0, 3); ch.unshift(c);
    say(k + '：接到 bucket ' + h + ' 的串列', '建新 node 接上去，不佔別人的 bucket');
    await beat(tok, 750);
  }
  await beat(tok, 900);
  say('找 A3：從 bucket 0 開頭走', 'A4 → A3：比 2 次');
  glow(L[0][0], GOLD); await beat(tok, 1000); glow(L[0][1], GREEN); await beat(tok, 1600);
  glow(L[0][0], null); glow(L[0][1], null);
  const tags = [];
  B.forEach((h) => L[h].forEach((c, d) => tags.push(tag(String(d + 1), 'ptr alt', X(h) + 0.8, Y(d) + 0.2, 0))));
  say('每個 key 要比幾次？', '6×1 + 3×2 + 1×3 + 1×4 + 1×5 = 24');
  await beat(tok, 3400);
  say('平均搜尋長度 = 24 / 12 = 2', 'A 最慘，要比 5 次');
  glow(L[0][4], RED);
  await beat(tok, 3000);
  say('hash 選不好：全掛在同一串', 'worst case O(n)');
  await beat(tok, 2800);
}]);

// ════════ 52:40 hash index（database 的 table） ════════
FRAG.push(['hashpeng-hash-index', 'Hash index：用 name 找 Chris', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const cols = ['sid', 'name', 'login', 'age', 'gpa'], cx = (i) => 0.6 + i * 1.35;
  cols.forEach((c, i) => tag(c, 'ptr', cx(i), 0.9, -2.4));
  const names = ['Jones', 'Smith', 'Chris'], rows = names.map((n, r) => cols.map((c, i) => cube(i === 1 ? n : '…', i === 1 ? ppCol(n) : GRAY, [1.25, 0.5, 0.8], cx(i), 0.25, -1.2 + r * 1.0, 3)));
  say('Database 的 table：每列一筆資料', 'degree = 5 個 attribute、cardinality = 3 列');
  await beat(tok, 3200);
  say('資料多了，怎麼快速找到 Chris？', '對 name 建 hash index');
  await beat(tok, 2600);
  const bk = [[2, 'Chris', 2], [9, 'Jones', 0], [18, 'Smith', 1]], ix = -5.0;
  const bks = bk.map(([h, n, r], i) => { const z = -1.2 + i * 1.6; cube('[' + h + ']', GRAY, [0.9, 0.5, 0.8], ix, 0.25, z); const c = cube(n, ppCol(n), [1.2, 0.5, 0.8], ix + 1.2, 0.25, z, 3); return { c, z, r }; });
  tag('hash index', 'ptr alt', ix + 0.6, 1.0, -2.4);
  say('h = 第一個字母：C→2、J→9、S→18', '書架上 D 開頭那一區 = 一個 bucket');
  await beat(tok, 3000);
  const t = bks[0];
  glow(t.c, GOLD);
  say('找 Chris：h(C) = 2 → bucket 2', '在 bucket 2 的串列找到 Chris');
  await beat(tok, 2600);
  arrow(V3(ix + 1.9, 0.4, t.z), V3(cx(1) - 0.7, 0.4, -1.2 + t.r * 1.0), 0x0f5a3a);
  rows[t.r].forEach((c) => glow(c, GREEN));
  say('再經 pointer 拿其他 attribute', 'login、age、gpa');
  await beat(tok, 3200);
  say('有 index：查詢從幾分鐘變一瞬間', 'index 影響 database 效能');
  await beat(tok, 2800);
}]);

// ════════ 59:28 另一種 index：binary search tree ════════
FRAG.push(['hashpeng-bst-index', '另一種 search structure：對 name 建 BST', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  const root = cube('Jones', ppCol('Jones'), [1.3, 0.7, 0.8], -2.5, 3.6, 0, 3);
  say('依字母順序對 name 建 BST', '小的放左邊、大的放右邊');
  await beat(tok, 2400);
  line(-2.5, 3.6, -4.3, 1.8); const c = cube('Chris', ppCol('Chris'), [1.3, 0.7, 0.8], -4.3, 1.8, 0, 3);
  say('Chris < Jones → 左邊', '');
  await beat(tok, 2200);
  line(-2.5, 3.6, -0.7, 1.8); const s = cube('Smith', ppCol('Smith'), [1.3, 0.7, 0.8], -0.7, 1.8, 0, 3);
  say('Smith > Jones → 右邊', '');
  await beat(tok, 2200);
  const rx = 4.4;
  [['Jones', 3.6], ['Smith', 2.6], ['Chris', 1.6]].forEach(([n, y]) => { cube(n + ' 的資料', GRAY, [2.6, 0.6, 0.8], rx, y, 0); });
  tag('disk / memory', 'idx', rx, 4.4, 0);
  arrow(V3(-1.8, 3.6, 0.5), V3(rx - 1.4, 3.6, 0.5)); arrow(V3(0, 1.8, 0.5), V3(rx - 1.4, 2.6, 0.5)); arrow(V3(-3.6, 1.6, 0.5), V3(rx - 1.4, 1.6, 0.5));
  say('每個 node 都要帶 pointer', '指到真正的其他欄位');
  await beat(tok, 4300);
  glow(root, GOLD); await beat(tok, 900); glow(c, GREEN);
  say('找 Chris：Jones → 左 → Chris', '第十章：BST、AVL tree、B+ tree');
  await beat(tok, 4300);
}]);

// ════════ dynamic hashing：Horowitz 的 6-bit 表示（A = 100、B = 101、C = 110） ════════
const PBITS = { A0: '100000', A1: '100001', B0: '101000', B1: '101001', C0: '110000', C1: '110001', C2: '110010', C3: '110011', C5: '110101' };
const prevBit = (k, d) => PBITS[k][5 - d]; // d-th bit from the right (d = 0 is the least significant)

FRAG.push(['hashpeng-bits', 'Dynamic hashing：key 化成二進位，看最右邊的 bit', async (tok) => {
  fresh([0, 5, 13], [0, 3.4, 0]);
  const ks = Object.keys(PBITS), Y = (r) => 7.0 - r * 0.8;
  say('A0, A1, B0, B1, C0, C1, C2, C3, C5', '每個 key 化成 6 bit 二進位');
  const B = ks.map((k, r) => {
    cube(k, ppCol(k), [0.9, 0.55, 0.6], -4.0, Y(r), 0);
    return [...PBITS[k]].map((b, i) => cube(b, GRAY, [0.55, 0.55, 0.6], -2.6 + i * 0.65 + (i >= 3 ? 0.3 : 0), Y(r), 0));
  });
  tag('字母', 'idx', -1.3, 7.8, 0); tag('數字', 'idx', 1.0, 7.8, 0);
  await beat(tok, 4300);
  say('A = 100、B = 101、C = 110', '後 3 bit 是數字：0 = 000、5 = 101');
  await beat(tok, 4300);
  B.forEach((r) => glow(r[5], GOLD));
  say('注意最右邊的 bit（LSB）', '從右往左讀來決定 bucket');
  await beat(tok, 4100);
  B.forEach((r) => glow(r[4], GOLD));
  say('跟 bucket sort 很像', '看最右邊幾個 bit 就能分桶');
  await beat(tok, 4100);
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
// walk a key down the trie with a cursor; returns the leaf suffix reached
async function ppWalk(tok, Tr, k, cur) {
  let p = '';
  cur.position.set(Tr.pos[''][0], Tr.pos[''][1] + 0.6, 0); txt(cur, k);
  await beat(tok, 900);
  for (let d = 0; d < 6; d++) {
    const b = prevBit(k, d); p += b;
    if (!Tr.pos[p]) break;
    cur.position.set(Tr.pos[p][0], Tr.pos[p][1] + 0.6, 0);
    say(k + '：右數第 ' + (d + 1) + ' 個 bit = ' + b, b === '0' ? '0 往上走' : '1 往下走');
    await beat(tok, 1100);
    if (Tr.bkt[p]) return p;
  }
  return p;
}
async function ppTrieInsert(tok, before, after, k, splitBit) {
  let Tr = ppTrie(before);
  const cur = tag('', 'ptr', 0, 0, 0);
  say('insert ' + k + ' = ' + PBITS[k], '從 root 開始，從右往左讀 bit');
  await beat(tok, 2200);
  const s = await ppWalk(tok, Tr, k, cur);
  const B = Tr.bkt[s];
  glow(B.box, RED);
  const n = cube(k, RED, [0.95, 0.6, 0.6], 3.6, B.y + 1.0, 0.1); glow(n, RED);
  say('bucket 已經有 ' + B.cs.length + ' 個（最多 2）', '<span class="no">overflow</span>');
  await beat(tok, 2400);
  kill(n); Tr.kill(); kill(cur);
  Tr = ppTrie(after);
  const ch = after.filter(([x]) => x.length === s.length + 1 && x.startsWith(s));
  ch.forEach(([x]) => glow(Tr.bkt[x].box, GOLD));
  say('Split：這個 bucket 再分岔成 0 / 1', '依右數第 ' + splitBit + ' 個 bit 重新分配');
  await beat(tok, 3200);
  return { Tr, ch };
}

// 64:30 trie：A0, B0, A1, B1, C2, C3（bucket 最多 2 個）
FRAG.push(['hashpeng-trie6', 'Trie：6 個 key，0 往上、1 往下', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  const Tr = ppTrie(TRIE_A);
  say('Insert A0, B0, A1, B1, C2, C3 之後', '每個 bucket 最多放 2 個');
  await beat(tok, 3000);
  say('這棵 trie 就是 hash function', '從 root 出發，從最右邊的 bit 讀起');
  await beat(tok, 2800);
  const cur = tag('', 'ptr', 0, 0, 0);
  for (const k of ['A0', 'B0']) {
    say('找 ' + k + ' = ' + PBITS[k], '最後兩個 bit 是 00');
    await beat(tok, 1600);
    const s = await ppWalk(tok, Tr, k, cur);
    const c = Tr.bkt[s].cs.find((x) => x.userData.lbl.element.textContent === k);
    glow(c, GREEN); say(k + ' 在 …00 這個 bucket', 'A0、B0 最右兩個 bit 一樣才放一起');
    await beat(tok, 2200); glow(c, null);
  }
  await beat(tok, 1200);
}]);

// 67:31 insert C5 → split
FRAG.push(['hashpeng-trie-c5', 'Trie：insert C5 → overflow → split', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  const { Tr } = await ppTrieInsert(tok, TRIE_A, TRIE_B, 'C5', 3);
  say('A1、B1 是 …001，C5 是 …101', 'C5 放進新的 bucket');
  glow(Tr.bkt['101'].cs[0], GREEN);
  await beat(tok, 3200);
  say('兩個重點：overflow 就 split', 'split 完依 bit 重新調整資料');
  await beat(tok, 2800);
}]);

// 69:44 insert C1 → split；trie 的缺點
FRAG.push(['hashpeng-trie-c1', 'Trie：insert C1 → A1、C1 同一桶', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 4.4, 0]);
  const { Tr } = await ppTrieInsert(tok, TRIE_B, TRIE_C, 'C1', 4);
  Tr.bkt['1000'].cs.forEach((c) => glow(c, GREEN));
  say('A1、C1 右數四個 bit 都是 0001', 'B1 是 1001 → 分到另一桶');
  await beat(tok, 3400);
  say('hash function 隨資料長大', '資料減少時也可以 merge 縮回去');
  await beat(tok, 3000);
  say('缺點：要 traverse 整棵 trie', 'access time 跟樹高有關，還可能 skew');
  await beat(tok, 3200);
}]);

// 73:30 extendible hashing：把 trie 變成 directory
FRAG.push(['hashpeng-directory', 'Directory：global depth 4，直接查表找 bucket', async (tok) => {
  fresh([0, 4.4, 13], [0, 4.2, 0]);
  const bks = [['00', ['A0', 'B0']], ['01', ['C2']], ['11', ['C3']], ['101', ['C5']], ['1000', ['A1', 'C1']], ['1001', ['B1']]];
  const bucketOf = (e) => bks.find(([s]) => [...s].every((b, i) => e[3 - i] === b)); // e is written b3 b2 b1 b0
  const BX = 3.6, BY = (i) => 7.4 - i * 1.35;
  say('Extendible hashing：不 traverse trie', '把 trie 攤平成一個 directory');
  await beat(tok, 2600);
  const B = bks.map(([s, ks], i) => {
    cube('', '#e8d9a8', [2.4, 0.8, 0.5], BX, BY(i), -0.3);
    const cs = ks.map((k, j) => cube(k, ppCol(k), [0.95, 0.6, 0.6], BX - 0.55 + j * 1.1, BY(i), 0.1));
    tag('local ' + s.length, 'idx', BX + 2.0, BY(i), 0);
    return cs;
  });
  const ents = [...Array(16)].map((_, n) => n.toString(2).padStart(4, '0'));
  const EY = (n) => 8.1 - n * 0.5, EX = -4.6;
  const E = ents.map((e, n) => cube(e, '#d8c29b', [1.3, 0.42, 0.5], EX, EY(n), 0));
  tag('global depth = 4', 'ptr alt', EX, 8.85, 0);
  await beat(tok, 1200);
  ents.forEach((e, n) => { const i = bks.indexOf(bucketOf(e)); arrow(V3(EX + 0.7, EY(n), 0), V3(BX - 1.25, BY(i), 0), 0x9a8a70); });
  say('用最右 4 個 bit 當 entry 編號', '16 個 entry，每個存一個 pointer');
  await beat(tok, 3600);
  [0, 4, 8, 12].forEach((n) => glow(E[n], GOLD));
  say('…00 的 bucket 被 4 個 entry 指到', 'local depth 2 < global depth 4');
  await beat(tok, 3400);
  [0, 4, 8, 12].forEach((n) => glow(E[n], null));
  glow(E[1], GREEN);
  say('找 C1：最右 4 bit = 0001', '查 directory 一次 → 跟 pointer 到 bucket');
  await beat(tok, 3000);
  B[4].forEach((c) => glow(c, GREEN));
  say('兩次 access 就到，不用走樹', 'directory 記 global depth，bucket 記 local depth');
  await beat(tok, 3400);
}]);

// 79:50 directoryless dynamic hashing
FRAG.push(['hashpeng-dirless', 'Directoryless：位址直接當 bucket，overflow 用 chain', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const ad = ['00', '01', '10', '11'], xs = [-4.5, -1.5, 1.5, 4.5];
  const keys = { '00': ['A0', 'B0'], '01': ['A1', 'B1'], '10': ['C2'], '11': ['C3'] };
  xs.forEach((x, i) => { cube('', '#e8d9a8', [2.6, 0.12, 1.4], x, 0.06, -1.5); tag('address …' + ad[i], 'idx', x, 0, -0.4); });
  say('連 pointer 都不要', 'bucket 直接放在連續的 memory address');
  await beat(tok, 3500);
  ad.forEach((a, i) => keys[a].forEach((k, j) => cube(k, ppCol(k), [1.0, 0.6, 0.9], xs[i] - 0.55 + j * 1.1, 0.4, -1.5, 3)));
  say('最右兩個 bit 就是 memory address', 'A0、B0 → …00；A1、B1 → …01');
  await beat(tok, 4100);
  const n = cube('C5', RED, [1.0, 0.6, 0.9], xs[1], 2.2, -1.5); glow(n, RED);
  say('insert C5：…01 滿了', '<span class="no">overflow</span>');
  await beat(tok, 3200);
  glow(n, null); tint(n, ppCol('C5'));
  move(n, xs[1], 0.4, 1.6);
  arrow(V3(xs[1], 0.4, -0.7), V3(xs[1], 0.4, 1.0));
  tag('overflow chain', 'ptr alt', xs[1] + 2.0, 0.6, 1.6);
  say('overflow 就用 linked list 串起來', '= 用 chaining 解決');
  await beat(tok, 4600);
}]);

// 81:41 本章重點回顧
FRAG.push(['hashpeng-recap', '第八章重點：static 與 dynamic hashing', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const rowA = [['hash table', -4.8], ['hash function', -1.6], ['collision', 1.6], ['overflow', 4.8]];
  const rowB = [['mid-square', -4.0], ['division', -1.6], ['folding', 0.8], ['open addr.', 3.2], ['chaining', 5.6]];
  const rowC = [['trie', -3.2], ['directory', 0], ['directoryless', 3.2]];
  tag('static hashing', 'ptr', -6, 0.9, -3.2);
  say('Static hashing：先有 hash table', '決定 hash function');
  for (const [t, x] of rowA) { cube(t, PP[0], [2.8, 0.5, 0.9], x, 0.25, -2.2, 3); await beat(tok, 500); }
  await beat(tok, 2200);
  say('3 種 hash function、2 種處理', 'collision 免不了，怕的是 overflow');
  for (const [t, x] of rowB) { cube(t, PP[2], [2.2, 0.5, 0.9], x, 0.25, 0, 3); await beat(tok, 500); }
  await beat(tok, 2400);
  tag('dynamic hashing', 'ptr alt', -6, 0.9, 1.4);
  say('Dynamic：hash function 隨資料改變', 'trie 要 traverse → 建目錄 → 連目錄都不要');
  for (const [t, x] of rowC) { cube(t, PP[5], [2.6, 0.5, 0.9], x, 0.25, 2.4, 3); await beat(tok, 700); }
  arrow(V3(-1.8, 0.3, 2.4), V3(-1.4, 0.3, 2.4)); arrow(V3(1.4, 0.3, 2.4), V3(1.8, 0.3, 2.4));
  await beat(tok, 4100);
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
  keys.forEach((k) => { N[k].bf = h(N[k].l) - h(N[k].r); });
  return { N, root, maxD, sum: keys.reduce((a, k) => a + N[k].d, 0) };
}
async function ppBuild(tok, keys, ms) {
  const T = ppBST(keys);
  for (const k of keys) {
    const n = T.N[k];
    if (n.p) n.edge = line(n.p.x, n.p.y, n.x, n.y);
    n.c = cube(k, ppCol(k), [0.95, 0.6, 0.6], n.x, n.y, 0, 2.5);
    await beat(tok, ms);
  }
  return T;
}
FRAG.push(['hashpeng-bst-months', 'BST 的形狀看輸入順序：平均 3.5、3.1、6.5', async (tok) => {
  const P = ctx.params || {}, orders = P.orders || [0, 1, 2];
  const ms = orders.length > 2 ? 420 : 700;
  for (const o of orders) {
    fresh([0, 4.6, 14], [0, 4.6, 0]);
    const keys = MONTH_ORDERS[o];
    say(o === 0 ? '依 JAN, FEB, MAR … 的順序 insert' : o === 1 ? '換個順序：JULY 先進來' : '照字母順序 APR, AUG, DEC …', '比字母大小：小的往左、大的往右');
    const T = await ppBuild(tok, keys, ms);
    if (o === 0) {
      const cur = tag('', 'ptr', 0, 0, 0); let n = T.root, c = 0;
      while (n) { c++; cur.position.set(n.x, n.y + 0.7, 0); txt(cur, '第 ' + c + ' 次'); glow(n.c, n.k === 'NOV' ? GREEN : GOLD); say('找 NOV：最深的 node', '比 ' + c + ' 次'); await beat(tok, ms + 300); if (n.k === 'NOV') break; glow(n.c, null); n = 'NOV' < n.k ? n.l : n.r; }
      await beat(tok, 900); kill(cur);
    }
    keys.forEach((k) => tag(String(T.N[k].d), 'ptr alt', T.N[k].x + 0.55, T.N[k].y + 0.45, 0));
    const avg = (T.sum / 12).toFixed(1);
    say(o === 2 ? 'Skewed：根本就是 linked list' : o === 1 ? '這次蠻 balanced' : '每個 node 要比幾次 = 它的深度', '最多 ' + T.maxD + ' 次，平均 ' + T.sum + '/12 ≈ ' + avg);
    await beat(tok, 3000);
  }
  say('BST 好不好看 input 的順序', '要讓樹 balance → AVL tree');
  await beat(tok, 2600);
}]);

// 91:50 AVL tree 的定義與 balance factor
FRAG.push(['hashpeng-avl-def', 'AVL tree：|h_L − h_R| ≤ 1，BF ∈ {−1, 0, 1}', async (tok) => {
  for (const o of [1, 0]) {
    fresh([0, 4.6, 14], [0, 4.6, 0]);
    const keys = MONTH_ORDERS[o], T = ppBST(keys);
    keys.forEach((k) => { const n = T.N[k]; if (n.p) line(n.p.x, n.p.y, n.x, n.y); n.c = cube(k, ppCol(k), [0.95, 0.6, 0.6], n.x, n.y, 0); });
    say(o === 1 ? 'AVL：height-balanced binary tree' : '第一棵（JAN 先進來）呢？', o === 1 ? 'T_L、T_R 都 balanced，且 |h_L − h_R| ≤ 1' : 'BF = h_L − h_R');
    await beat(tok, 3000);
    const bad = [];
    for (const k of [...keys].sort((a, b) => T.N[a].d - T.N[b].d)) {
      const n = T.N[k]; tag('BF ' + (n.bf > 0 ? '+' : '') + n.bf, Math.abs(n.bf) > 1 ? 'ptr' : 'idx', n.x, n.y - 0.55, 0);
      if (Math.abs(n.bf) > 1) { glow(n.c, RED); bad.push(k); }
    }
    say(o === 1 ? '每個 node 的 BF 都是 −1、0、1' : 'FEB 的 BF = 3、超過 1', o === 1 ? 'BF = 左子樹高 − 右子樹高' : '<span class="no">不是 AVL tree：' + bad.join('、') + ' 不 balance</span>');
    await beat(tok, 3600);
  }
  say('下週：insert 時怎麼調整 AVL', 'BF 超出 ±1 就要旋轉');
  await beat(tok, 2600);
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
