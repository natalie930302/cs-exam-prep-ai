// 資料結構 第4章：BST、AVL Tree、Red-Black Tree。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自本章影片：
//   MIT 6.006 L5（BST）：依序插入 49, 79, 46, 41；跑道預約的 k = 3 分鐘檢查（42、45 被拒）；
//     子樹大小 augmentation 與 rank(79) = 5；刪除 79 時 83 補上來；依序插入 43, 46, 48, 49… 退化成 list。
//   MIT 6.006 L6（AVL）：41 / 20 / 65 / 11 / 29 / 50 / 26 那棵樹，插入 23（右旋 29）、插入 55（兩次旋轉）。
// 課本慣例（洪逸／Horowitz）：高度以層數計（root 在 level 1）、bf = h(左) − h(右)、
//   旋轉以「從失衡點 A 往新節點走的方向」命名 LL / RR / LR / RL；紅黑樹插入分 XYr（變色）與 XYb（旋轉）。
export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat, block } = ctx;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (n) => Math.floor(Math.random() * n);
  let timer = null, epoch = 0, busy = false;
  const stopTimer = () => { clearInterval(timer); timer = null; };
  function fresh() { stopTimer(); epoch++; busy = false; lab.clear(); }
  async function wait(tok, ms) {
    const e = epoch;
    if (tok !== undefined) await beat(tok, ms); else await sleep(ms);
    if (e !== epoch) throw new Error('mode changed');
  }
  function runOp(fn) {
    if (busy) { log('上一個動作還在播，等它做完。', true); return; }
    busy = true;
    const e = epoch;
    fn().catch((err) => { if (!/changed/.test(err.message)) console.error(err); })
      .finally(() => { if (e === epoch) busy = false; });
  }
  const RED = '#d64545', BLACK = '#2b2b2b';
  const fmt = (k) => String(+Number(k).toFixed(1));

  // ───────────────────────── 樹的資料結構（含 parent 指標，與畫面無關） ─────────────────────────
  const mk = (key) => ({ key, left: null, right: null, parent: null, color: 'R', body: null });
  const height = (n) => (n ? 1 + Math.max(height(n.left), height(n.right)) : 0); // 層數（Horowitz）
  const bf = (n) => height(n.left) - height(n.right);
  const size = (n) => (n ? 1 + size(n.left) + size(n.right) : 0);
  const inorder = (n, o = []) => { if (n) { inorder(n.left, o); o.push(n); inorder(n.right, o); } return o; };
  const preorder = (n, o = []) => { if (n) { o.push(n); preorder(n.left, o); preorder(n.right, o); } return o; };
  const postorder = (n, o = []) => { if (n) { postorder(n.left, o); postorder(n.right, o); o.push(n); } return o; };
  const keys = (arr) => arr.map((n) => fmt(n.key)).join(' ');
  function attach(t, z) {
    let y = null, x = t.root;
    while (x) { y = x; x = z.key < x.key ? x.left : x.right; }
    z.parent = y;
    if (!y) t.root = z; else if (z.key < y.key) y.left = z; else y.right = z;
    return z;
  }
  function rotL(t, x) {
    const y = x.right;
    x.right = y.left; if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if (!x.parent) t.root = y; else if (x === x.parent.left) x.parent.left = y; else x.parent.right = y;
    y.left = x; x.parent = y;
  }
  function rotR(t, x) {
    const y = x.left;
    x.left = y.right; if (y.right) y.right.parent = x;
    y.parent = x.parent;
    if (!x.parent) t.root = y; else if (x === x.parent.right) x.parent.right = y; else x.parent.left = y;
    y.right = x; x.parent = y;
  }
  function transplant(t, u, v) {
    if (!u.parent) t.root = v; else if (u === u.parent.left) u.parent.left = v; else u.parent.right = v;
    if (v) v.parent = u.parent;
  }
  const minNode = (x) => { while (x.left) x = x.left; return x; };
  const maxNode = (x) => { while (x.right) x = x.right; return x; };
  function bstFromSeq(seq) { const t = { root: null }; seq.forEach((k) => attach(t, mk(k))); return t; }

  // AVL：x 的 |bf| = 2 時判斷型別。A = 失衡點、B = 往新節點方向的子、C = 再下一個（雙旋才用到）
  function avlCase(x) {
    if (bf(x) > 1) { const B = x.left; return bf(B) >= 0 ? { type: 'LL', A: x, B } : { type: 'LR', A: x, B, C: B.right }; }
    const B = x.right; return bf(B) <= 0 ? { type: 'RR', A: x, B } : { type: 'RL', A: x, B, C: B.left };
  }
  function applyAvl(t, c, stage) { // stage：undefined = 整個做完；1 = 雙旋的第一步；2 = 第二步
    if (c.type === 'LL') rotR(t, c.A);
    else if (c.type === 'RR') rotL(t, c.A);
    else if (c.type === 'LR') { if (stage !== 2) rotL(t, c.B); if (stage !== 1) rotR(t, c.A); }
    else { if (stage !== 2) rotR(t, c.B); if (stage !== 1) rotL(t, c.A); }
  }
  const ROT_DESC = {
    LL: '對 A 右旋：B 升上來，A 變成 B 的右子',
    RR: '對 A 左旋：B 升上來，A 變成 B 的左子',
    LR: '先對 B 左旋、再對 A 右旋：C 升上來當根',
    RL: '先對 B 右旋、再對 A 左旋：C 升上來當根',
  };
  function avlInsertRaw(t, key) {
    const z = attach(t, mk(key)); const fixes = [];
    for (let x = z.parent; x; x = x.parent) {
      if (Math.abs(bf(x)) <= 1) continue;
      const c = avlCase(x); applyAvl(t, c); fixes.push(c.type);
      x = c.C || c.B;
    }
    return fixes;
  }

  // 紅黑樹插入修正（Horowitz 命名）：X = p 在 g 的哪邊、Y = z 在 p 的哪邊、r/b = 叔叔 u 的顏色
  function rbNext(t, z) {
    if (!z) return null;
    const p = z.parent;
    if (!p) return z.color === 'R' ? { kind: 'root', z } : null;
    if (z.color !== 'R' || p.color !== 'R') return t.root && t.root.color === 'R' ? { kind: 'root', z: t.root } : null;
    const g = p.parent;
    const pl = p === g.left, zl = z === p.left;
    const u = pl ? g.right : g.left;
    const xy = (pl ? 'L' : 'R') + (zl ? 'L' : 'R');
    const red = !!(u && u.color === 'R');
    return { kind: xy + (red ? 'r' : 'b'), xy, red, z, p, g, u };
  }
  function rbApply(t, d, stage) { // 回傳下一輪要檢查的節點
    if (d.kind === 'root') { d.z.color = 'B'; return null; }
    if (d.red) { d.p.color = 'B'; d.u.color = 'B'; d.g.color = 'R'; return d.g; }
    const { g, p, z, xy } = d;
    if (xy === 'LL') { rotR(t, g); p.color = 'B'; g.color = 'R'; return p; }
    if (xy === 'RR') { rotL(t, g); p.color = 'B'; g.color = 'R'; return p; }
    if (xy === 'LR') { if (stage !== 2) rotL(t, p); if (stage !== 1) { rotR(t, g); z.color = 'B'; g.color = 'R'; } return z; }
    if (stage !== 2) rotR(t, p); if (stage !== 1) { rotL(t, g); z.color = 'B'; g.color = 'R'; } return z;
  }
  function rbInsertRaw(t, key) {
    let z = attach(t, mk(key)); const cases = []; let d, guard = 0;
    while ((d = rbNext(t, z)) && guard++ < 40) { cases.push(d.kind); z = rbApply(t, d); }
    return cases;
  }
  function rbCheck(t) {
    let redRed = null, bh = null, bhOk = true;
    (function w(n, black) {
      if (!n) { if (bh === null) bh = black; else if (bh !== black) bhOk = false; return; }
      const b = black + (n.color === 'B' ? 1 : 0);
      if (n.color === 'R' && ((n.left && n.left.color === 'R') || (n.right && n.right.color === 'R'))) redRed = redRed || n;
      w(n.left, b); w(n.right, b);
    })(t.root, 0);
    return { rootBlack: !t.root || t.root.color === 'B', redRed, bhOk, bh: bh || 0 };
  }

  // ───────────────────────── 畫面：版面、連線、游標、標記 ─────────────────────────
  function makeView(o) {
    const t = { root: null, marks: [], o: Object.assign({ cx: 0, width: 12, topY: 6.6, minY: 1.0, maxStep: 1.35, maxSp: 1.25, size: [0.8, 0.6, 0.8], tag: 'none', kind: 'bst' }, o) };
    edgeLines(t);
    return t;
  }
  function nodeMesh(t, n) {
    const color = t.o.kind === 'rb' ? (n.color === 'R' ? RED : BLACK) : colorFor(Math.round(n.key));
    const m = block(fmt(n.key), t.o.size, color);
    n.tag = lab.label('', 'idx');
    n.tag.position.set(0, t.o.size[1] / 2 + 0.3, 0);
    m.add(n.tag);
    return m;
  }
  // x = 中序位置（排序後的順序），y = 深度：BST 的「左小右大」直接變成畫面的左右。
  function layout(t, instant) {
    const order = inorder(t.root), depth = new Map(); let maxD = 0;
    (function w(n, d) { if (!n) return; depth.set(n, d); if (d > maxD) maxD = d; w(n.left, d + 1); w(n.right, d + 1); })(t.root, 0);
    const o = t.o, cnt = order.length;
    const sp = cnt > 1 ? Math.min(o.maxSp, o.width / (cnt - 1)) : 0;
    const step = maxD ? Math.min(o.maxStep, (o.topY - o.minY) / maxD) : 0;
    order.forEach((n, i) => {
      n.pos = V(o.cx + (i - (cnt - 1) / 2) * sp, o.topY - depth.get(n) * step, 0);
      if (!n.body) { n.body = lab.addBody(nodeMesh(t, n)); n.body.obj.position.copy(n.pos); }
      if (instant) { n.body.obj.position.copy(n.pos); n.body.target.copy(n.pos); n.body.vel.set(0, 0, 0); n.body.mode = 'rest'; }
      else lab.springTo(n.body, n.pos.clone());
    });
    refresh(t);
  }
  function dropIn(n) { n.body.obj.position.copy(n.pos).add(V(0, 5, 0)); lab.dropTo(n.body, n.pos.clone()); }
  function refresh(t) {
    inorder(t.root).forEach((n) => {
      if (t.o.kind === 'rb') n.body.obj.material.color.set(n.color === 'R' ? RED : BLACK);
      let txt = '', cls = 'idx';
      if (t.o.tag === 'bf') { const b = bf(n); txt = (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b); if (Math.abs(b) > 1) cls = 'ptr alt'; }
      else if (t.o.tag === 'size') txt = 'size ' + size(n);
      n.tag.element.textContent = txt;
      n.tag.element.className = 'lab-label ' + cls;
      n.tag.element.style.display = txt ? '' : 'none';
    });
  }
  function edgeLines(t) {
    const MAX = 48;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3));
    const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#7a6a52' }));
    ls.frustumCulled = false;
    const hh = t.o.size[1] / 2;
    ls.onBeforeRender = () => {
      const a = geo.attributes.position.array; let k = 0;
      for (const n of inorder(t.root)) {
        if (!n.body) continue;
        for (const c of [n.left, n.right]) {
          if (!c || !c.body || k >= MAX * 6) continue;
          const P = n.body.obj.position, C = c.body.obj.position;
          a[k++] = P.x; a[k++] = P.y - hh; a[k++] = P.z; a[k++] = C.x; a[k++] = C.y + hh; a[k++] = C.z;
        }
      }
      geo.setDrawRange(0, k / 3);
      geo.attributes.position.needsUpdate = true;
    };
    lab.world.add(ls);
  }
  function makeCursor() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
    m.rotation.x = Math.PI / 2; m.visible = false;
    return lab.addBody(m);
  }
  function cursorTo(cur, pos) {
    if (!cur.obj.visible) { cur.obj.position.copy(pos); cur.obj.visible = true; }
    lab.springTo(cur, pos.clone());
  }
  const hideCursor = (cur) => { cur.obj.visible = false; };
  function glow(n, color) { if (n && n.body) n.body.obj.material.emissive.set(color); }
  function mark(t, n, text, cls = 'ptr alt') {
    if (!n || !n.body) return;
    const l = lab.label(text, cls);
    l.position.set(0, -(t.o.size[1] / 2 + 0.32), 0);
    n.body.obj.add(l);
    t.marks.push({ n, l });
  }
  function clearMarks(t) { t.marks.forEach(({ n, l }) => n.body && n.body.obj.remove(l)); t.marks = []; }
  function count(t) { return size(t.root); }
  function readKey(id) {
    const v = Number($(id).value);
    if ($(id).value === '' || !isFinite(v) || v < 0 || v > 999) { log('請輸入 0..999 的數字。', true); return null; }
    return Math.round(v * 10) / 10;
  }

  // 沿搜尋路徑移動游標；kcheck = MIT L5 跑道預約的 k 分鐘檢查
  async function walkPath(t, cur, key, tok, kcheck, k = 3) {
    let x = t.root, depth = 0, parent = null;
    while (x) {
      cursorTo(cur, x.pos); depth++;
      await wait(tok, 480);
      if (kcheck && Math.abs(key - x.key) < k) return { reject: x, depth };
      if (key === x.key) return { found: x, depth };
      log('  ' + fmt(key) + (key < x.key ? ' < ' : ' > ') + fmt(x.key) + (kcheck ? '（差 ' + fmt(Math.abs(key - x.key)) + ' ≥ ' + k + '）' : '') + ' → 往' + (key < x.key ? '左' : '右'));
      parent = x; x = key < x.key ? x.left : x.right;
    }
    return { parent, depth };
  }

  // ───────────────────────── BST：insert / search / delete / rank ─────────────────────────
  const BST_PRESETS = {
    rank: { name: 'L5 範例樹（49,46,43,79,64,83）', seq: [49, 46, 43, 79, 64, 83] },
    lec: { name: 'L5 依序插入 49,79,46,41', seq: [49, 79, 46, 41] },
    big: { name: '較大的樹（10 個）', seq: [50, 30, 70, 20, 40, 60, 80, 35, 45, 65] },
    empty: { name: '空樹', seq: [] },
  };
  const bst = { preset: 'rank', t: null, cur: null, kcheck: false, k: 3, showSize: false, del: 'succ' };
  function enterBst(seqOverride) {
    fresh();
    lab.frameCamera([0, 4.6, 13.5], [0, 3.7, 0]);
    bst.t = makeView({ tag: bst.showSize ? 'size' : 'none' });
    (Array.isArray(seqOverride) ? seqOverride : BST_PRESETS[bst.preset].seq).forEach((k) => attach(bst.t, mk(k)));
    layout(bst.t, true);
    bst.cur = makeCursor();
    controls(
      '<input id="bV" type="number" step="0.1" value="45">'
      + '<button class="primary" id="bIns">insert</button><button id="bFind">search</button><button id="bDel">delete</button><button id="bRank">rank(t)</button>'
      + '<select id="bDelMode"><option value="succ">刪除用 successor</option><option value="pred">刪除用 predecessor</option></select>'
      + '<label><input type="checkbox" id="bK"> k = 3 分鐘檢查</label><label><input type="checkbox" id="bSz"> 子樹大小</label>'
      + '<select id="bPre">' + Object.keys(BST_PRESETS).map((k) => '<option value="' + k + '">' + BST_PRESETS[k].name + '</option>').join('') + '</select>'
    );
    $('bPre').value = bst.preset; $('bDelMode').value = bst.del; $('bK').checked = bst.kcheck; $('bSz').checked = bst.showSize;
    $('bPre').onchange = (e) => { bst.preset = e.target.value; clearLog(); enterBst(); };
    $('bDelMode').onchange = (e) => { bst.del = e.target.value; };
    $('bK').onchange = (e) => { bst.kcheck = e.target.checked; log(bst.kcheck ? '跑道預約（MIT L5）：新時間 t 和路徑上每個節點差距要 ≥ 3 分鐘，否則拒絕。' : '關掉 k 分鐘檢查。'); };
    $('bSz').onchange = (e) => { bst.showSize = e.target.checked; bst.t.o.tag = bst.showSize ? 'size' : 'none'; refresh(bst.t); };
    on('bIns', () => { const k = readKey('bV'); if (k !== null) runOp(() => bstInsert(k)); });
    on('bFind', () => { const k = readKey('bV'); if (k !== null) runOp(() => bstSearch(k)); });
    on('bDel', () => { const k = readKey('bV'); if (k !== null) runOp(() => bstDelete(k)); });
    on('bRank', () => { const k = readKey('bV'); if (k !== null) runOp(() => bstRank(k)); });
    log('BST 性質：每個節點 x，左子樹所有 key < x.key < 右子樹所有 key（本實驗不放重複 key）。');
    log('畫面的左右位置就是排序後的順序（inorder）。');
    renderBst('—');
  }
  function renderBst(op) {
    const t = bst.t, n = count(t);
    setState('Binary Search Tree', [
      ['節點數 n', String(n)], ['高度 h（層數）', String(height(t.root))],
      ['Inorder（排好序）', n ? keys(inorder(t.root)) : '空'], ['剛才的操作', op],
    ], 'search / insert / delete / min / max / rank 都是 <span class="ok">O(h)</span><br>平衡時 h ≈ log₂ n；依序插入會退化成 h = n');
  }
  async function bstInsert(key, tok) {
    const t = bst.t;
    if (count(t) >= 15) { log('節點太多畫面放不下（上限 15），先刪幾個或重設。', true); return false; }
    log('insert(' + fmt(key) + ')' + (bst.kcheck ? '，同時做 k = 3 分鐘檢查' : ''));
    const r = await walkPath(t, bst.cur, key, tok, bst.kcheck);
    if (r.reject) {
      glow(r.reject, '#5a1010');
      log('|' + fmt(key) + ' − ' + fmt(r.reject.key) + '| = ' + fmt(Math.abs(key - r.reject.key)) + ' < 3 → 太近，拒絕這個預約（不插入）', true);
      say('離 ' + fmt(r.reject.key) + ' 不到 3 分鐘 → 拒絕', '|' + fmt(key) + ' − ' + fmt(r.reject.key) + '| < k = 3');
      await wait(tok, 1100); glow(r.reject, '#000'); renderBst('拒絕 ' + fmt(key));
      return false;
    }
    if (r.found) { glow(r.found, '#5a1010'); log('BST 裡已經有 ' + fmt(key) + '，不重複插入。', true); await wait(tok, 700); glow(r.found, '#000'); return false; }
    if (r.depth + 1 > 8) { log('新節點會在第 ' + (r.depth + 1) + ' 層，畫面放不下，換個值或重設。', true); return false; }
    const z = attach(t, mk(key));
    layout(t); dropIn(z);
    log('走到 NULL → 接成 ' + (r.parent ? fmt(r.parent.key) + ' 的' + (z === r.parent.left ? '左' : '右') + '子' : 'root') + '（比較了 ' + r.depth + ' 次，O(h)）');
    if (t.o.tag === 'size') log('  augmentation：沿路經過的節點 size 都 +1，新節點 size = 1');
    renderBst('insert ' + fmt(key));
    await wait(tok, 600);
    hideCursor(bst.cur);
    return true;
  }
  async function bstSearch(key, tok) {
    const t = bst.t;
    log('search(' + fmt(key) + ')');
    const r = await walkPath(t, bst.cur, key, tok, false);
    if (r.found) { glow(r.found, '#163a2a'); log('找到 ' + fmt(key) + '（比較 ' + r.depth + ' 次）'); await wait(tok, 1200); glow(r.found, '#000'); }
    else log('走到 NULL：沒有 ' + fmt(key) + '（比較 ' + r.depth + ' 次）', true);
    hideCursor(bst.cur);
    renderBst('search ' + fmt(key));
    return r.found || null;
  }
  async function bstDelete(key, tok) {
    const t = bst.t;
    log('delete(' + fmt(key) + ')');
    const r = await walkPath(t, bst.cur, key, tok, false);
    if (!r.found) { log('找不到 ' + fmt(key) + '，沒有東西可以刪。', true); hideCursor(bst.cur); return false; }
    const x = r.found;
    glow(x, '#5a1010');
    if (!x.left && !x.right) {
      log('情況 1：' + fmt(key) + ' 是 leaf → 直接拿掉，parent 的指標設成 NULL');
      say('情況 1：葉節點，直接刪', '');
      await wait(tok, 700);
      transplant(t, x, null);
    } else if (!x.left || !x.right) {
      const c = x.left || x.right;
      log('情況 2：只有一個子節點 → 讓子節點 ' + fmt(c.key) + '（連同它的子樹）頂上來');
      say('情況 2：只有一個子，子樹整個接上來', '');
      mark(t, c, '頂上來');
      await wait(tok, 900);
      transplant(t, x, c);
    } else {
      const succ = bst.del === 'succ';
      const name = succ ? 'successor（右子樹最小）' : 'predecessor（左子樹最大）';
      log('情況 3：有兩個子節點 → 找 inorder ' + name + ' 來取代');
      say('情況 3：兩個子 → 找 ' + (succ ? '右子樹最小' : '左子樹最大'), succ ? '先往右一步，再一直往左' : '先往左一步，再一直往右');
      let s = succ ? x.right : x.left;
      cursorTo(bst.cur, s.pos); await wait(tok, 600);
      while (succ ? s.left : s.right) { s = succ ? s.left : s.right; cursorTo(bst.cur, s.pos); await wait(tok, 600); }
      mark(t, s, succ ? 'successor' : 'predecessor');
      glow(s, '#4a3600');
      log('  ' + name + ' = ' + fmt(s.key) + '，搬到 ' + fmt(key) + ' 的位置' + ((succ ? s.right : s.left) ? '；它的' + (succ ? '右' : '左') + '子先接回它原本的 parent' : ''));
      await wait(tok, 1200);
      if (succ) {
        if (s.parent !== x) { transplant(t, s, s.right); s.right = x.right; s.right.parent = s; }
        transplant(t, x, s); s.left = x.left; s.left.parent = s;
      } else {
        if (s.parent !== x) { transplant(t, s, s.left); s.left = x.left; s.left.parent = s; }
        transplant(t, x, s); s.right = x.right; s.right.parent = s;
      }
      glow(s, '#000');
    }
    clearMarks(t);
    lab.flyAway(x.body, V(0, 8, 5));
    hideCursor(bst.cur);
    layout(t);
    renderBst('delete ' + fmt(key));
    await wait(tok, 900);
    return true;
  }
  async function bstRank(tv, tok) {
    const t = bst.t;
    bst.showSize = true; t.o.tag = 'size'; refresh(t); if ($('bSz')) $('bSz').checked = true;
    log('rank(' + fmt(tv) + ') = 有幾個 key ≤ ' + fmt(tv) + '：沿搜尋路徑走，往右走時把「自己 + 左子樹 size」加進來');
    let x = t.root, r = 0;
    while (x) {
      cursorTo(bst.cur, x.pos);
      await wait(tok, 700);
      if (x.key <= tv) {
        const s = size(x.left); r += 1 + s;
        log('  ' + fmt(x.key) + ' ≤ ' + fmt(tv) + '：加 1（自己）' + (s ? '+ ' + s + '（左子樹 size）' : '') + ' → ' + r);
        say(fmt(x.key) + ' ≤ ' + fmt(tv) + '：加自己和左子樹', 'rank = ' + r);
        if (x.left) glow(x.left, '#163a2a');
        x = x.right;
      } else {
        log('  ' + fmt(tv) + ' < ' + fmt(x.key) + '：往左，不加');
        say(fmt(tv) + ' < ' + fmt(x.key) + '：往左，不加', 'rank = ' + r);
        x = x.left;
      }
    }
    await wait(tok, 700);
    inorder(t.root).forEach((n) => glow(n, '#000'));
    hideCursor(bst.cur);
    log('rank(' + fmt(tv) + ') = ' + r + '（O(h)）');
    renderBst('rank(' + fmt(tv) + ') = ' + r);
    return r;
  }

  // ───────────────────────── AVL：insert + 四種旋轉 ─────────────────────────
  const AVL_PRESETS = {
    mit: { name: 'L6 範例樹（之後插入 23、55）', seq: [41, 20, 65, 11, 29, 50, 26], demo: [23, 55] },
    LL: { name: 'LL：依序插入 30, 20, 10', seq: [], demo: [30, 20, 10] },
    RR: { name: 'RR：依序插入 10, 20, 30', seq: [], demo: [10, 20, 30] },
    LR: { name: 'LR：依序插入 30, 10, 20', seq: [], demo: [30, 10, 20] },
    RL: { name: 'RL：依序插入 10, 30, 20', seq: [], demo: [10, 30, 20] },
    empty: { name: '空樹', seq: [], demo: [] },
  };
  const avl = { preset: 'mit', t: null, cur: null };
  function enterAvl() {
    fresh();
    lab.frameCamera([0, 4.6, 13.5], [0, 3.7, 0]);
    avl.t = makeView({ tag: 'bf', kind: 'avl' });
    AVL_PRESETS[avl.preset].seq.forEach((k) => avlInsertRaw(avl.t, k));
    layout(avl.t, true);
    avl.cur = makeCursor();
    const P = AVL_PRESETS[avl.preset];
    controls(
      '<input id="aV" type="number" step="1" value="' + (P.demo[0] || 23) + '">'
      + '<button class="primary" id="aIns">insert</button><button id="aRand">隨機插入</button>'
      + '<select id="aPre">' + Object.keys(AVL_PRESETS).map((k) => '<option value="' + k + '">' + AVL_PRESETS[k].name + '</option>').join('') + '</select>'
      + '<button id="aDemo">播放示範</button><button id="aReset">重設</button>'
    );
    $('aPre').value = avl.preset;
    $('aPre').onchange = (e) => { avl.preset = e.target.value; clearLog(); enterAvl(); };
    on('aIns', () => { const k = readKey('aV'); if (k !== null) runOp(() => avlInsert(k)); });
    on('aRand', () => { let k; let g = 0; do { k = 1 + rnd(99); } while (findKey(avl.t, k) && g++ < 50); $('aV').value = k; runOp(() => avlInsert(k)); });
    on('aDemo', () => runOp(async () => { for (const k of AVL_PRESETS[avl.preset].demo) { $('aV').value = k; await avlInsert(k); } }));
    on('aReset', () => { clearLog(); enterAvl(); });
    log('每個節點上方的數字是 bf = h(左子樹) − h(右子樹)。AVL 要求每個節點 |bf| ≤ 1。');
    log('MIT L6 用箭頭表示同一件事：往左下的箭頭 = 左重（+1）、往右下 = 右重（−1）、橫線 = 平衡（0）。');
    if (P.demo.length) log('按「播放示範」會依序插入 ' + P.demo.join('、') + '。');
    renderAvl('—');
  }
  function findKey(t, k) { let x = t.root; while (x && x.key !== k) x = k < x.key ? x.left : x.right; return x; }
  function renderAvl(op, cur) {
    const t = avl.t, n = count(t);
    setState('AVL Tree', [
      ['節點數 n', String(n)], ['高度 h（層數）', String(height(t.root))],
      ['Inorder', n ? keys(inorder(t.root)) : '空'], ['剛才的操作', op],
    ], (cur ? '<span class="no">' + fmt(cur.A.key) + ' 的 bf = ' + (bf(cur.A) > 0 ? '+' : '') + bf(cur.A) + '</span> → ' + cur.type + ' 型：' + ROT_DESC[cur.type] + '<br>' : '')
      + 'bf = h(左) − h(右)，每個節點 |bf| ≤ 1<br>插入後從新節點往上找第一個 |bf| = 2 的 A，旋轉一次（單旋或雙旋）就平衡<br>高度 h &lt; 1.44 log₂ n → 所有操作 O(log n)');
  }
  async function avlInsert(key, tok) {
    const t = avl.t;
    if (count(t) >= 15) { log('節點太多畫面放不下（上限 15），按重設。', true); return false; }
    if (findKey(t, key)) { log('已經有 ' + fmt(key) + '，不重複插入。', true); return false; }
    log('insert(' + fmt(key) + ')：先照一般 BST 插入');
    const r = await walkPath(t, avl.cur, key, tok, false);
    const z = attach(t, mk(key));
    layout(t); dropIn(z);
    hideCursor(avl.cur);
    renderAvl('insert ' + fmt(key));
    await wait(tok, 900);
    let fixed = false;
    for (let x = z.parent; x; x = x.parent) {
      if (Math.abs(bf(x)) <= 1) continue;
      const c = avlCase(x);
      fixed = true;
      mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); if (c.C) mark(t, c.C, 'C', 'ptr');
      glow(c.A, '#5a1010');
      log('往上找到第一個失衡點 A = ' + fmt(c.A.key) + '（bf = ' + (bf(c.A) > 0 ? '+' : '') + bf(c.A) + '）。從 A 往新節點走：' + c.type.split('').map((d) => (d === 'L' ? '左' : '右')).join('、') + ' → ' + c.type + ' 型');
      say(fmt(c.A.key) + ' 失衡（bf = ' + (bf(c.A) > 0 ? '+' : '') + bf(c.A) + '）→ ' + c.type + ' 型', ROT_DESC[c.type]);
      renderAvl('insert ' + fmt(key), c);
      await wait(tok, 1900);
      if (c.C) {
        applyAvl(t, c, 1); layout(t);
        log('  第 1 步：對 B = ' + fmt(c.B.key) + (c.type === 'LR' ? ' 左旋' : ' 右旋') + ' → 變成 ' + (c.type === 'LR' ? 'LL' : 'RR') + ' 的樣子');
        say('第 1 步：對 B 做' + (c.type === 'LR' ? '左旋' : '右旋'), '變成一直線（' + (c.type === 'LR' ? 'LL' : 'RR') + ' 型）');
        await wait(tok, 1500);
        applyAvl(t, c, 2); layout(t);
        log('  第 2 步：對 A = ' + fmt(c.A.key) + (c.type === 'LR' ? ' 右旋' : ' 左旋') + '，C = ' + fmt(c.C.key) + ' 升上來');
        say('第 2 步：對 A 做' + (c.type === 'LR' ? '右旋' : '左旋'), 'C = ' + fmt(c.C.key) + ' 升上來，兩邊等高');
      } else {
        applyAvl(t, c); layout(t);
        log('  ' + ROT_DESC[c.type].replace('A', 'A = ' + fmt(c.A.key)).replace('B 升', 'B = ' + fmt(c.B.key) + ' 升'));
        say(c.type === 'LL' ? '對 ' + fmt(c.A.key) + ' 右旋' : '對 ' + fmt(c.A.key) + ' 左旋', fmt(c.B.key) + ' 升上來，中序順序不變');
      }
      glow(c.A, '#000');
      renderAvl(c.type + ' 旋轉完成');
      await wait(tok, 1500);
      clearMarks(t);
      x = c.C || c.B;
    }
    if (!fixed) log('  所有節點 |bf| ≤ 1，不用旋轉。');
    renderAvl(fixed ? 'insert ' + fmt(key) + '（已旋轉）' : 'insert ' + fmt(key));
    return true;
  }

  // ───────────────────────── 退化 BST vs AVL ─────────────────────────
  const CMP_ORDERS = {
    lec: { name: 'L5 例子：43, 46, 48, 49 … 依序', seq: [43, 46, 48, 49, 52, 56, 61, 64, 79, 83] },
    asc: { name: '1 到 n 遞增', seq: null },
    desc: { name: 'n 到 1 遞減', seq: null },
    rand: { name: '隨機順序', seq: null },
  };
  const cmp = { order: 'lec', n: 10, seq: [], i: 0, l: null, r: null, ll: null, rl: null };
  function enterCmp() {
    fresh();
    lab.frameCamera([0, 4.3, 13.5], [0, 3.8, 0]);
    const small = { size: [0.55, 0.42, 0.55], width: 5.8, maxSp: 0.9, topY: 6.5, minY: 0.6, maxStep: 1.3 };
    cmp.l = makeView(Object.assign({ cx: -3.5 }, small));
    cmp.r = makeView(Object.assign({ cx: 3.5, kind: 'avl' }, small));
    const n = cmp.n;
    cmp.seq = CMP_ORDERS[cmp.order].seq ? CMP_ORDERS[cmp.order].seq.slice(0, n)
      : cmp.order === 'asc' ? Array.from({ length: n }, (_, k) => k + 1)
      : cmp.order === 'desc' ? Array.from({ length: n }, (_, k) => n - k)
      : Array.from({ length: n }, (_, k) => k + 1).sort(() => Math.random() - 0.5);
    cmp.i = 0;
    cmp.ll = lab.label('BST', 'ptr'); cmp.ll.position.set(-3.5, 7.5, 0);
    cmp.rl = lab.label('AVL', 'ptr alt'); cmp.rl.position.set(3.5, 7.5, 0);
    lab.world.add(cmp.ll, cmp.rl);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 7, 0.05), new THREE.MeshBasicMaterial({ color: '#d8c29b' }));
    wall.position.set(0, 3.6, 0); lab.world.add(wall);
    controls(
      '<select id="cOrd">' + Object.keys(CMP_ORDERS).map((k) => '<option value="' + k + '">' + CMP_ORDERS[k].name + '</option>').join('') + '</select>'
      + '<label>n = <input id="cN" type="number" min="3" max="10" value="' + n + '"></label>'
      + '<button class="primary" id="cNext">插入下一個</button><button id="cAuto">自動播放</button><button id="cReset">重來</button>'
    );
    $('cOrd').value = cmp.order;
    $('cOrd').onchange = (e) => { cmp.order = e.target.value; clearLog(); enterCmp(); };
    $('cN').onchange = (e) => { cmp.n = Math.max(3, Math.min(10, Number(e.target.value) || 10)); clearLog(); enterCmp(); };
    on('cNext', () => { stopTimer(); if (!cmpStep()) log('全部插完了，按「重來」或換順序。'); });
    on('cAuto', () => { stopTimer(); timer = setInterval(() => { if (!cmpStep()) stopTimer(); }, 900); });
    on('cReset', () => { clearLog(); enterCmp(); });
    log('同一串 key 同時插進一般 BST（左）和 AVL（右）。插入順序：' + cmp.seq.join(', '));
    renderCmp();
  }
  function cmpStep() {
    if (cmp.i >= cmp.seq.length) return false;
    const k = cmp.seq[cmp.i++];
    const a = attach(cmp.l, mk(k)); layout(cmp.l); dropIn(a);
    const fixes = avlInsertRaw(cmp.r, k); layout(cmp.r);
    const b = findKey(cmp.r, k); if (b) dropIn(b);
    log('insert ' + k + '：BST 高度 ' + height(cmp.l.root) + '，AVL 高度 ' + height(cmp.r.root) + (fixes.length ? '（AVL 做了 ' + fixes.join('、') + ' 旋轉）' : ''));
    renderCmp();
    return true;
  }
  function renderCmp() {
    const hl = height(cmp.l.root), hr = height(cmp.r.root), n = cmp.i;
    cmp.ll.element.textContent = 'BST　h = ' + hl;
    cmp.rl.element.textContent = 'AVL　h = ' + hr;
    setState('退化的 BST vs AVL', [
      ['已插入', n + ' / ' + cmp.seq.length], ['BST 高度', String(hl)], ['AVL 高度', String(hr)],
      ['找最大值要比較', 'BST ' + hl + ' 次，AVL ' + hr + ' 次'],
    ], (hl === n && n > 2 ? '<span class="no">BST 退化成 linked list：h = n → O(n)</span><br>' : '')
      + 'AVL 保證 h &lt; 1.44 log₂ n → <span class="ok">O(log n)</span><br>log₂(' + Math.max(n, 1) + ' + 1) ≈ ' + Math.log2(n + 1).toFixed(2));
  }

  // ───────────────────────── Red-Black Tree：insert + 性質檢查 ─────────────────────────
  const RB_DEMO = [10, 20, 30, 15, 25, 5, 1, 3];
  const rbs = { t: null, cur: null };
  function enterRb() {
    fresh();
    lab.frameCamera([0, 4.6, 13.5], [0, 3.7, 0]);
    rbs.t = makeView({ kind: 'rb' });
    rbs.cur = makeCursor();
    controls(
      '<input id="rV" type="number" step="1" value="10">'
      + '<button class="primary" id="rIns">insert</button><button id="rRand">隨機插入</button>'
      + '<button id="rDemo">播放示範（' + RB_DEMO.join(',') + '）</button><button id="rReset">清空</button>'
    );
    on('rIns', () => { const k = readKey('rV'); if (k !== null) runOp(() => rbInsert(k)); });
    on('rRand', () => { let k; let g = 0; do { k = 1 + rnd(99); } while (findKey(rbs.t, k) && g++ < 50); $('rV').value = k; runOp(() => rbInsert(k)); });
    on('rDemo', () => { clearLog(); enterRb(); runOp(async () => { for (const k of RB_DEMO) { $('rV').value = k; await rbInsert(k); } }); });
    on('rReset', () => { clearLog(); enterRb(); });
    log('新節點一律塗紅色插入；出現「紅-紅相連」才要修。看叔叔 u（g 的另一個子）：');
    log('u 紅 → XYr：變色（p、u 變黑，g 變紅，問題往上丟給 g）；u 黑或 NIL → XYb：旋轉＋變色，一次結束。');
    renderRb('—');
  }
  function renderRb(op) {
    const t = rbs.t, c = rbCheck(t);
    const ok = (b) => '<span class="' + (b ? 'ok' : 'no') + '">' + (b ? '✓' : '✗') + '</span>';
    setState('Red-Black Tree', [
      ['節點數 n', String(count(t))], ['高度（層數）', String(height(t.root))],
      ['root→NIL 黑節點數', c.bhOk ? String(c.bh) : '不一致'], ['剛才的操作', op],
    ], ok(true) + ' 1. 每個節點非紅即黑<br>'
      + ok(c.rootBlack) + ' 2. root 是黑色<br>'
      + ok(true) + ' 3. NIL（外部節點）都是黑色<br>'
      + ok(!c.redRed) + ' 4. 紅色節點的子節點必為黑（不能紅-紅）' + (c.redRed ? '：' + fmt(c.redRed.key) + ' 下面' : '') + '<br>'
      + ok(c.bhOk) + ' 5. 每條 root→NIL 路徑黑節點數相同<br>'
      + '→ 高度 ≤ 2 log₂(n+1)');
  }
  async function rbInsert(key, tok) {
    const t = rbs.t;
    if (count(t) >= 15) { log('節點太多畫面放不下（上限 15），按清空。', true); return false; }
    if (findKey(t, key)) { log('已經有 ' + fmt(key) + '，不重複插入。', true); return false; }
    log('insert(' + fmt(key) + ')：照 BST 插入，塗紅色');
    if (t.root) await walkPath(t, rbs.cur, key, tok, false);
    let z = attach(t, mk(key));
    layout(t); dropIn(z);
    hideCursor(rbs.cur);
    renderRb('insert ' + fmt(key));
    await wait(tok, 900);
    let d, guard = 0;
    while ((d = rbNext(t, z)) && guard++ < 20) {
      if (d.kind === 'root') {
        mark(t, d.z, 'root');
        log('  root 是紅色 → 塗黑（性質 2；黑節點數每條路徑都 +1，性質 5 不受影響）');
        say('root 是紅色 → 直接塗黑', '這一步最常被忘記');
        await wait(tok, 1300);
        rbApply(t, d); refresh(t); clearMarks(t); renderRb('root 塗黑');
        await wait(tok, 900);
        break;
      }
      mark(t, d.z, 'z'); mark(t, d.p, 'p', 'ptr'); mark(t, d.g, 'g', 'ptr'); if (d.u) mark(t, d.u, 'u', 'ptr');
      const xyTxt = 'p 是 g 的' + (d.xy[0] === 'L' ? '左' : '右') + '子、z 是 p 的' + (d.xy[1] === 'L' ? '左' : '右') + '子';
      renderRb('紅-紅：' + d.kind);
      if (d.red) {
        log('  ' + fmt(d.p.key) + '、' + fmt(d.z.key) + ' 紅-紅相連；' + xyTxt + '，叔叔 u = ' + fmt(d.u.key) + ' 是紅色 → ' + d.kind + '：變色');
        say(d.kind + '：叔叔是紅色 → 變色', 'p、u 變黑，g 變紅，再檢查 g');
        await wait(tok, 1900);
        z = rbApply(t, d); refresh(t); clearMarks(t);
        renderRb(d.kind + ' 變色');
        await wait(tok, 1100);
      } else {
        log('  紅-紅相連；' + xyTxt + '，叔叔 ' + (d.u ? fmt(d.u.key) + ' 是黑色' : '是 NIL（黑色）') + ' → ' + d.kind + '：旋轉');
        const dbl = d.xy === 'LR' || d.xy === 'RL';
        say(d.kind + '：叔叔是黑色 → ' + (dbl ? '兩次旋轉' : '一次旋轉'), dbl ? '轉完 z 當子樹根塗黑，g 塗紅' : '轉完 p 當子樹根塗黑，g 塗紅');
        await wait(tok, 1900);
        if (dbl) {
          rbApply(t, d, 1); layout(t);
          log('  第 1 步：對 p 做' + (d.xy === 'LR' ? '左旋' : '右旋') + ' → 變成一直線');
          await wait(tok, 1300);
          z = rbApply(t, d, 2);
        } else z = rbApply(t, d);
        layout(t); clearMarks(t);
        log('  旋轉完成，新的子樹根 ' + fmt(z.key) + ' 塗黑、' + fmt(d.g.key) + ' 塗紅');
        renderRb(d.kind + ' 旋轉');
        await wait(tok, 1300);
      }
    }
    renderRb('insert ' + fmt(key) + ' 完成');
    return true;
  }

  // ───────────────────────── 文字頁 ─────────────────────────
  function renderTable(el) {
    const rows = [
      ['search / insert / delete（平均）', 'O(log n)', 'O(log n)', 'O(log n)'],
      ['search / insert / delete（最壞）', 'O(n)', 'O(log n)', 'O(log n)'],
      ['高度上限', 'n（退化成 list）', '&lt; 1.44 log₂ n', '≤ 2 log₂(n+1)'],
      ['insert 最多旋轉', '—', '1 次（單旋或雙旋）', '2 次'],
      ['平衡靠什麼', '不保證', '|bf| ≤ 1', '紅黑 5 性質'],
    ];
    el.innerHTML = '<h2>BST、AVL、紅黑樹比較</h2>'
      + '<table class="lab-table"><thead><tr><th>項目</th><th>BST</th><th>AVL</th><th>Red-Black</th></tr></thead><tbody>'
      + rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td class="' + (/log/.test(c) && !/1\.44|2 log/.test(c) ? 'o1' : /O\(n\)/.test(c) ? 'on' : '') + '">' + c + '</td>' : '<th>' + c + '</th>')).join('') + '</tr>').join('')
      + '</tbody></table>'
      + '<h3>容易搞混的地方</h3>'
      + '<div class="lab-trap">BST 刪除有兩個子節點時，用 inorder successor（右子樹最小）或 predecessor（左子樹最大）取代都對；題目沒指定時要看課本慣例或寫清楚用哪個。</div>'
      + '<div class="lab-trap">AVL 的 LL／LR 是看「從失衡點 A 往新節點走的方向」，不是看旋轉方向：LL 型要做的是右旋。</div>'
      + '<div class="lab-trap">AVL 最少節點數：N(h) = N(h−1) + N(h−2) + 1（高度以層數計，N(1) = 1、N(2) = 2），像 Fibonacci → h = O(log n)。</div>'
      + '<div class="lab-trap">紅黑樹插入、變色做完後一定要把 root 塗黑（同儕筆記標的地雷）。</div>'
      + '<p class="src">例子出處：MIT 6.006 L5（BST：49, 79, 46, 41、k 分鐘檢查、rank）、L6（AVL：插入 23、55）；紅黑樹插入分類依洪逸／Horowitz。</p>';
  }
  function fill(opts, ans, extra) {
    const set = [...new Set([ans, ...opts])];
    for (const e of extra) { if (set.length >= 4) break; if (!set.includes(e)) set.push(e); }
    return set.slice(0, 4);
  }
  function randKeys(n, lo = 10, hi = 99) { const s = new Set(); while (s.size < n) s.add(lo + rnd(hi - lo + 1)); return [...s]; }
  function genQ() {
    const kind = rnd(7);
    if (kind === 0) {
      const seq = randKeys(6 + rnd(2)), t = bstFromSeq(seq);
      const ans = keys(preorder(t.root));
      return { q: '依序插入 ' + seq.join(', ') + ' 建成 BST，它的 Preorder 是？', ans,
        opts: fill([keys(inorder(t.root)), keys(postorder(t.root)), seq.join(' ')], ans, [seq.slice().reverse().join(' ')]),
        why: '先畫出樹（第一個 ' + seq[0] + ' 是 root，之後每個都從 root 比大小往下找空位），再照 V L R 走。Inorder 一定是排序結果，不是答案。' };
    }
    if (kind === 1) {
      let seq, t, x, g = 0;
      do { seq = randKeys(8); t = bstFromSeq(seq); x = inorder(t.root).find((n) => n.left && n.right && n !== t.root); } while (!x && g++ < 50);
      if (!x) x = t.root;
      const s = minNode(x.right), p = maxNode(x.left);
      return { q: '依序插入 ' + seq.join(', ') + ' 建成 BST。刪除 ' + x.key + '（有兩個子節點，用 inorder successor 取代），誰會補到它的位置？', ans: String(s.key),
        opts: fill([String(p.key), String(x.right.key), String(x.left.key)], String(s.key), [String(x.parent ? x.parent.key : t.root.key)]),
        why: 'successor = 右子樹的最小值：先往右到 ' + x.right.key + '，再一直往左 → ' + s.key + '。（若用 predecessor 則是左子樹最大 ' + p.key + '）' };
    }
    if (kind === 2) {
      const [a, b, c] = randKeys(3).sort((u, v) => u - v);
      const types = { LL: [c, b, a], RR: [a, b, c], LR: [c, a, b], RL: [a, c, b] };
      const ty = ['LL', 'RR', 'LR', 'RL'][rnd(4)];
      const how = { LL: '一次右旋', RR: '一次左旋', LR: '先左旋再右旋', RL: '先右旋再左旋' };
      return { q: '空的 AVL 依序插入 ' + types[ty].join(', ') + '，插入最後一個後要做哪種旋轉？', ans: ty + '（' + how[ty] + '）',
        opts: ['LL', 'RR', 'LR', 'RL'].map((k) => k + '（' + how[k] + '）'),
        why: '失衡點是 ' + types[ty][0] + '，從它往新節點 ' + types[ty][2] + ' 走：' + ty.split('').map((d) => (d === 'L' ? '左' : '右')).join('、') + ' → ' + ty + ' 型。轉完 ' + b + ' 當根。' };
    }
    if (kind === 3) {
      let seq, t, fixes, g = 0;
      do { seq = randKeys(6 + rnd(2)); t = { root: null }; fixes = []; seq.forEach((k) => fixes.push(...avlInsertRaw(t, k))); } while (!fixes.length && g++ < 50);
      const ans = String(t.root.key);
      const sorted = seq.slice().sort((a, b) => a - b);
      return { q: '空的 AVL 依序插入 ' + seq.join(', ') + '，最後 root 是誰？', ans,
        opts: fill([String(seq[0]), String(sorted[Math.floor(sorted.length / 2)]), String(sorted[Math.floor((sorted.length - 1) / 2)])], ans, seq.map(String)),
        why: '過程中做了 ' + fixes.join('、') + ' 旋轉。一般 BST 的 root 會是第一個 ' + seq[0] + '；AVL 旋轉會換根。最後 preorder：' + keys(preorder(t.root)) + '。' };
    }
    if (kind === 4) {
      const h = 3 + rnd(5); const N = [0, 1, 2]; for (let i = 3; i <= h; i++) N[i] = N[i - 1] + N[i - 2] + 1;
      return { q: '高度 h = ' + h + '（以層數計，root 那層算 1）的 AVL Tree 最少有幾個節點？', ans: String(N[h]),
        opts: fill([String((1 << h) - 1), String(1 << (h - 1)), String(N[h - 1] + N[h - 2])], String(N[h]), [String(h)]),
        why: 'N(h) = N(h−1) + N(h−2) + 1，N(1) = 1、N(2) = 2 → ' + N.slice(1, h + 1).join(', ') + '。（MIT L6 的推導：像 Fibonacci，所以 h < 1.44 log₂ n）' };
    }
    if (kind === 5) {
      const pl = rnd(2) === 0, zl = rnd(2) === 0, red = rnd(2) === 0;
      const xy = (pl ? 'L' : 'R') + (zl ? 'L' : 'R');
      const name = (k, r) => k + (r ? 'r：變色（p、u 變黑，g 變紅）' : 'b：' + (k === 'LL' || k === 'RR' ? '一次旋轉' : '兩次旋轉') + '＋變色');
      const flip = { L: 'R', R: 'L' };
      const ans = name(xy, red);
      return { q: '紅黑樹插入新節點 z（紅），它的 parent p 是 g 的' + (pl ? '左' : '右') + '子、z 是 p 的' + (zl ? '左' : '右') + '子，p 是紅色，叔叔 u ' + (red ? '是紅色' : '是 NIL（黑）') + '。屬於哪一種、怎麼修？', ans,
        opts: fill([name(xy, !red), name(xy[0] + flip[xy[1]], red), name(flip[xy[0]] + xy[1], !red)], ans, []),
        why: '第 1、2 個字母看 p 在 g 的哪邊、z 在 p 的哪邊；r/b 看叔叔顏色。叔叔紅 → 只變色、問題往上丟；叔叔黑 → 旋轉後結束。' };
    }
    let seq, t;
    seq = randKeys(7); t = bstFromSeq(seq);
    const sorted = seq.slice().sort((a, b) => a - b);
    const tv = sorted[2 + rnd(4)];
    const ans = sorted.filter((k) => k <= tv).length;
    return { q: '依序插入 ' + seq.join(', ') + ' 建成 BST，每個節點記錄子樹大小 size。用 MIT L5 的方法算 rank(' + tv + ')（有幾個 key ≤ ' + tv + '）：', ans: String(ans),
      opts: fill([String(ans - 1), String(ans + 1), String(size(t.root))], String(ans), [String(ans + 2)]),
      why: '沿搜尋路徑走：遇到 key ≤ t 的節點就加「1 + 左子樹 size」再往右，否則往左不加。結果 = 排序後 ≤ ' + tv + ' 的個數 = ' + ans + '。' };
  }
  const qs = { score: 0, total: 0 };
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

  // ───────────────────────── 舞台場景（跟著影片） ─────────────────────────
  const scenes = {
    'bst-insert': { title: 'BST 插入：49, 79, 46, 41（MIT L5）', play: async (tok) => {
      bst.preset = 'empty'; bst.kcheck = false; bst.showSize = false; enterBst();
      say('BST：左子樹都比我小，右子樹都比我大', 'key(左) < key(x) < key(右)');
      await beat(tok, 2000);
      for (const k of [49, 79, 46, 41]) {
        say('insert ' + k + '：從 root 一路比大小，走到空位', '');
        await bstInsert(k, tok);
        await beat(tok, 700);
      }
      say('插入只走一條路徑', '<span class="ok">O(h)</span>，h = 樹高');
      await beat(tok, 1800);
      cursorTo(bst.cur, minNode(bst.t.root).pos); say('find min：一直往左', 'min = 41');
      await beat(tok, 1600);
      cursorTo(bst.cur, maxNode(bst.t.root).pos); say('find max：一直往右', 'max = 79，也是 O(h)');
      await beat(tok, 2400);
    } },
    'runway-k-check': { title: '跑道預約：插入時順便做 k 分鐘檢查（MIT L5）', play: async (tok) => {
      bst.preset = 'lec'; bst.kcheck = true; bst.showSize = false; enterBst();
      say('已排定 41、46、49、79；k = 3 分鐘', '新時間 t 跟沿路每個節點差距都要 ≥ 3');
      await beat(tok, 2600);
      say('要求 42：49 差 7、46 差 4……', '');
      await bstInsert(42, tok);
      await beat(tok, 1600);
      say('要求 45：49 差 4 OK，46 只差 1', '');
      await bstInsert(45, tok);
      await beat(tok, 1600);
      say('要求 53：沿路都夠遠 → 接受', '');
      await bstInsert(53, tok);
      say('檢查和插入走同一條路徑', '<span class="ok">一次 O(h) 做完</span>');
      await beat(tok, 2800);
      bst.kcheck = false;
    } },
    'subtree-size-rank': { title: 'Augmentation：子樹大小與 rank(t)（MIT L5）', play: async (tok) => {
      bst.preset = 'rank'; bst.showSize = true; bst.kcheck = false;
      enterBst([49, 46, 79, 64, 83]);
      say('每個節點多記一個數：子樹大小 size', 'size(x) = size(左) + size(右) + 1');
      await beat(tok, 2600);
      say('insert 43：沿路的 49、46 各 +1', '');
      await bstInsert(43, tok);
      await beat(tok, 1600);
      say('rank(79)：有幾個 key ≤ 79？', '往右走時加「自己 + 左子樹 size」');
      await beat(tok, 2000);
      const r = await bstRank(79, tok);
      say('1 + 2 + 1 + 1 = ' + r, '<span class="ok">rank(79) = ' + r + '</span>，O(h)');
      await beat(tok, 3000);
    } },
    'bst-delete': { title: 'BST 刪除三種情況：刪 79 時 83 補上來', play: async (tok) => {
      bst.preset = 'rank'; bst.showSize = false; bst.kcheck = false; bst.del = 'succ'; enterBst();
      say('刪除要看被刪節點有幾個子節點', '');
      await beat(tok, 1800);
      await bstDelete(79, tok);
      say('79 有兩個子：右子樹最小的 83 補上來，64 接在左邊', 'successor = 右子樹最小');
      await beat(tok, 2600);
      await bstDelete(46, tok);
      say('46 只有一個子：43 直接接上來', '');
      await beat(tok, 2200);
      await bstDelete(64, tok);
      say('64 是 leaf：直接拿掉', '三種情況都是 <span class="ok">O(h)</span>');
      await beat(tok, 2800);
    } },
    'degenerate-path': { title: '依序插入會退化成 list：BST vs AVL', play: async (tok) => {
      cmp.order = 'lec'; cmp.n = 10; enterCmp();
      say('依序插入 43, 46, 48, 49 …（MIT L5 結尾的例子）', '左：一般 BST　右：AVL');
      await beat(tok, 2400);
      while (cmpStep()) {
        say('insert ' + cmp.seq[cmp.i - 1], 'BST h = ' + height(cmp.l.root) + '，AVL h = ' + height(cmp.r.root));
        await beat(tok, 1000);
      }
      say('BST 長成一條 linked list：h = n', '<span class="no">O(n)</span> vs AVL <span class="ok">O(log n)</span>');
      await beat(tok, 3200);
    } },
    'avl-rotation': { title: 'AVL：插入 23 單旋、插入 55 雙旋（MIT L6）', play: async (tok) => {
      avl.preset = 'mit'; enterAvl();
      say('每個節點標 bf = h(左) − h(右)', 'AVL：每個節點 |bf| ≤ 1');
      await beat(tok, 2600);
      say('insert 23：41 → 20 → 29 → 26 的左邊', '');
      await avlInsert(23, tok);
      await beat(tok, 1200);
      say('insert 55：41 → 65 → 50 的右邊', '');
      await avlInsert(55, tok);
      say('兩次旋轉＝雙旋，結果 55 當子樹根', '旋轉不改變 inorder：' + keys(inorder(avl.t.root)));
      await beat(tok, 3000);
    } },
    'avl-rr-rl': { title: 'AVL 對稱情況：RR 與 RL', play: async (tok) => {
      for (const p of ['RR', 'RL']) {
        avl.preset = p; enterAvl();
        say(p + ' 型：依序插入 ' + AVL_PRESETS[p].demo.join(', '), ROT_DESC[p]);
        await beat(tok, 1800);
        for (const k of AVL_PRESETS[p].demo) await avlInsert(k, tok);
        await beat(tok, 2000);
      }
      say('四種型別：LL、RR 單旋；LR、RL 雙旋', '看「從 A 往新節點走的兩步方向」');
      await beat(tok, 2800);
    } },
    'rb-insert': { title: '紅黑樹插入：變色（XYr）與旋轉（XYb）', play: async (tok) => {
      enterRb();
      say('紅黑樹：新節點塗紅插入，紅-紅相連才修', '看叔叔 u 的顏色決定變色或旋轉');
      await beat(tok, 2400);
      for (const k of RB_DEMO) {
        $('rV').value = k;
        await rbInsert(k, tok);
        const c = rbCheck(rbs.t);
        say('insert ' + k + ' 完成：5 個性質都成立', 'root→NIL 黑節點數 = ' + c.bh);
        await beat(tok, 700);
      }
      say('不需要完全平衡，只保證高度 ≤ 2 log₂(n+1)', '<span class="ok">insert 最多 2 次旋轉</span>');
      await beat(tok, 3000);
    } },
  };

  return {
    kicker: '資料結構・第 4 章',
    title: 'BST、AVL Tree、Red-Black Tree',
    color: 'var(--ds)',
    modes: [
      { id: 'bst', name: 'BST 插入／刪除／rank', enter: enterBst },
      { id: 'avl', name: 'AVL 旋轉', enter: enterAvl },
      { id: 'cmp', name: '退化 BST vs AVL', enter: enterCmp },
      { id: 'rb', name: 'Red-Black Tree', enter: enterRb },
    ],
    pages: [
      { id: 'table', name: '比較表', render: renderTable },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['bst-insert', 'runway-k-check', 'subtree-size-rank', 'bst-delete', 'degenerate-path', 'avl-rotation', 'avl-rr-rl', 'rb-insert'],
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
