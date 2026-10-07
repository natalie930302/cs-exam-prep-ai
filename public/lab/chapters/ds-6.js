// 資料結構 第6章：雜湊表 Hash Table（雜湊函數、Chaining、Open Addressing、刪除、Rehashing）。
// 影片「Hashing - Collision Resolution with Linear Probing」的例子直接拿來用：
//   h(x) = x mod 10，10,20,30,40,50（chaining 對照 open addressing）；
//   89,18,49,58,9（linear probing，find 58 = 4 probes、find 19 = 5 probes）；
//   表大小 11：20,30,2,13,25,24,10,9（平均成功搜尋 15/8，看群聚）。
// 探測序列採影片／Weiss 的寫法：h_i(x) = (hash(x) + f(i)) mod m，f(0) = 0。
//   linear f(i) = i；quadratic f(i) = i²；double f(i) = i·hash2(x)，hash2(x) = R − (x mod R)，R 取小於 m 的最大質數。
//   另附 Horowitz 的 ±i² 版本（h, h+1², h−1², h+2², h−2², …；m 為 4j+3 型質數時能走遍整張表）。
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
      say('49→[0]、58→[1]、9→[2]', '58 探測 4 次、9 探測 3 次');
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
      say('m = 11：insert 20, 30, 2, 13, 25, 24, 10, 9', 'hash(x) = x mod 11');
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
      say('double hashing：步長 hash2(x) = 7 − (x mod 7)', '每個 key 跳的距離不同');
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
    sceneOrder: ['chaining-vs-open', 'linear-probing', 'find-probes', 'primary-clustering', 'quadratic-and-double', 'lazy-deletion', 'rehashing', 'folding'],
    stop() { gen++; busy = false; sceneTok = null; },
  };
}
