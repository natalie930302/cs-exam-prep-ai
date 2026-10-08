// 資料結構 第4章：BST、AVL Tree、Red-Black Tree。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
// 例子取自本章影片：
//   MIT 6.006 L5（BST）：依序插入 49, 79, 46, 41；跑道預約的 k = 3 分鐘檢查（42、45 被拒）；
//     子樹大小 augmentation 與 rank(79) = 5；刪除 79 時 83 補上來；依序插入 43, 46, 48, 49… 退化成 list。
//   MIT 6.006 L6（AVL）：41 / 20 / 65 / 11 / 29 / 50 / 26 那棵樹，插入 23（右旋 29）、插入 55（兩次旋轉）。
// 課本慣例（洪逸／Horowitz）：高度以層數計（root 在 level 1）、bf = h(左) − h(右)、
//   旋轉以「從失衡點 A 往新節點走的方向」命名 LL / RR / LR / RL；紅黑樹插入分 XYr（變色）與 XYb（旋轉）。
import kit from './_kit.js';

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


  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const K = kit(ctx);
  const FRAG = [];
  // ═══ avllin.js ═══
  {
// ─── cH8nH0Enjhw：台大林軒田 DSA AVL Tree（RL）/ 2-3-4 Tree / Red-Black Tree ───
// 例子取自影片：RR 複習 1、2、3；RL 特例 3、5、4；RL 通例 A、B、C、AL、BR、CL、CR；
// 網路 demo 依序插入 1、2、3、15、14、13，再刪 1、2、15 與非 leaf 的 13；
// 2-3-4 樹 5 16 / 3 | 7 11 14 | 18 21（插 2、20、13、23）；依序插入 1…10；
// 紅黑樹對應 2 5 / 1 | 3 4 | 6 7 8（插 1.5、4.5、1.8、9）。
// 高度以層數計，bf = hL − hR；紅黑樹：黑 = 一家的代表，紅 = 跟班。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, showL, anim, line, arrow, ghostBox, GOLD, GREEN, RED } = K;
const RBR = '#d64545', RBB = '#2b2b2b';
const NO = (s) => '<span class="no">' + s + '</span>', OK = (s) => '<span class="ok">' + s + '</span>';

// ── BST / AVL / 紅黑樹共用：小 BST + 依 inorder 排版 ──
const mkN = (k, c) => ({ k, l: null, r: null, c: c || 'B' });
function bstIns(t, k, c) {
  const n = mkN(k, c); if (!t.root) { t.root = n; return n; }
  let x = t.root;
  for (;;) { if (k < x.k) { if (!x.l) { x.l = n; break; } x = x.l; } else { if (!x.r) { x.r = n; break; } x = x.r; } }
  return n;
}
const hgt = (n) => (n ? 1 + Math.max(hgt(n.l), hgt(n.r)) : 0);
function parOf(t, n) { let p = null, x = t.root; while (x && x !== n) { p = x; x = n.k < x.k ? x.l : x.r; } return p; }
function findN(t, k) { let x = t.root; while (x && x.k !== k) x = k < x.k ? x.l : x.r; return x; }
function rotUp(t, a, dir) { // 'L'：右小孩拉上來；'R'：左小孩拉上來
  const p = parOf(t, a), b = dir === 'L' ? a.r : a.l;
  if (dir === 'L') { a.r = b.l; b.l = a; } else { a.l = b.r; b.r = a; }
  if (!p) t.root = b; else if (p.l === a) p.l = b; else p.r = b;
  return b;
}
function firstBad(t, k) {
  let x = t.root, bad = null;
  while (x) { if (Math.abs(hgt(x.l) - hgt(x.r)) > 1) bad = x; if (k === x.k) break; x = k < x.k ? x.l : x.r; }
  return bad;
}
function anyBad(n) { if (!n) return null; return anyBad(n.l) || anyBad(n.r) || (Math.abs(hgt(n.l) - hgt(n.r)) > 1 ? n : null); }
function delLeaf(t, k) { const n = findN(t, k), p = parOf(t, n); if (!p) t.root = null; else if (p.l === n) p.l = null; else p.r = null; }
function TV(t, o = {}) {
  const dx = o.dx || 1.25, dy = o.dy || 1.45, top = o.top || 5.4, cx = o.cx || 0, sz = o.sz || 0.85;
  const cubes = new Map(), labs = new Map(); let edges = [], labsOn = true;
  const v = { t, cubes, P: new Map() };
  const colOf = (n) => (o.rb ? (n.c === 'R' ? RBR : RBB) : colorFor(n.k));
  v.sync = (newK) => {
    const arr = [];
    (function io(n, d) { if (!n) return; io(n.l, d + 1); arr.push([n, d]); io(n.r, d + 1); })(t.root, 0);
    v.P = new Map(arr.map(([n, d], i) => [n.k, V3(cx + (i - (arr.length - 1) / 2) * dx, top - d * dy, 0)]));
    for (const [k, m] of [...cubes]) if (!v.P.has(k)) { fly(m, V3(0, 6, 4)); cubes.delete(k); }
    for (const [k, l] of [...labs]) if (!v.P.has(k)) { kill(l); labs.delete(k); }
    edges.forEach(kill); edges = [];
    for (const [n] of arr) {
      const p = v.P.get(n.k);
      let m = cubes.get(n.k);
      if (!m) { m = cube(n.k, colOf(n), [sz, sz, sz], p.x, p.y, 0, (n.k === newK || (Array.isArray(newK) && newK.includes(n.k))) ? 3.5 : 0); cubes.set(n.k, m); }
      else { move(m, p.x, p.y, 0); if (o.rb) tint(m, colOf(n)); }
      for (const c of [n.l, n.r]) if (c) { const q = v.P.get(c.k); edges.push(line(p.x, p.y, q.x, q.y, 0)); }
      if (o.lab) {
        let l = labs.get(n.k); if (!l) { l = tag('', 'idx', 0, 0, 0); labs.set(n.k, l); }
        const b = hgt(n.l) - hgt(n.r);
        txt(l, o.lab(n)); l.position.set(p.x + sz * 0.95, p.y + 0.5, 0);
        l.element.className = 'lab-label ' + (Math.abs(b) > 1 ? 'ptr' : 'idx'); showL(l, labsOn);
        glow(m, Math.abs(b) > 1 ? RED : null);
      }
    }
  };
  v.c = (k) => cubes.get(k);
  v.showLabs = (on) => { labsOn = on; labs.forEach((l) => showL(l, on)); };
  return v;
}
const BF = (n) => { const b = hgt(n.l) - hgt(n.r); return 'bf ' + (b > 0 ? '+' + b : b); };
const HT = (n) => 'h ' + hgt(n);
// AVL：找到失衡點後修正（單旋或雙旋，雙旋中間停一下）
async function avlFix(t, tv, bad, tok) {
  const b = hgt(bad.l) - hgt(bad.r);
  if (b < -1) { const B = bad.r; if (hgt(B.l) > hgt(B.r)) { rotUp(t, B, 'R'); tv.sync(); await beat(tok, 1400); } rotUp(t, bad, 'L'); }
  else { const B = bad.l; if (hgt(B.r) > hgt(B.l)) { rotUp(t, B, 'L'); tv.sync(); await beat(tok, 1400); } rotUp(t, bad, 'R'); }
  tv.sync();
}
function rbTree(spec) { const t = { root: null }; spec.forEach(([k, c]) => bstIns(t, k, c)); return t; }
const RB_EX = [[2, 'B'], [1, 'B'], [5, 'R'], [4, 'B'], [3, 'R'], [7, 'B'], [6, 'R'], [8, 'R']]; // 2 5 / 1 | 3 4 | 6 7 8

// ── 2-3-4 樹：node = { ks, ch }；leaf 畫出「蟑螂腳」 ──
const N4 = (ks, ch = []) => ({ ks, ch });
function T4(o = {}) {
  const kw = o.kw || 0.82, gap = o.gap || 0.55, dy = o.dy || 1.5, top = o.top || 5.4, legs = o.legs !== false;
  const cubes = new Map(); let deco = [];
  const v = { root: null, cubes };
  v.sync = (newK) => {
    deco.forEach(kill); deco = [];
    let cur = 0;
    (function lay(n, d) {
      n._d = d;
      if (!n.ch.length) { const w = n.ks.length * kw; n._x = cur + w / 2; cur += w + gap; return; }
      n.ch.forEach((c) => lay(c, d + 1));
      n._x = (n.ch[0]._x + n.ch[n.ch.length - 1]._x) / 2;
    })(v.root, 0);
    const sh = -(cur - gap) / 2 + (o.cx || 0);
    const seen = new Set();
    (function draw(n) {
      const x0 = n._x + sh, y = top - n._d * dy, w = n.ks.length * kw, L = x0 - w / 2;
      n._px = x0; n._py = y; n._L = L;
      const g = ghostBox(n.ks.length > 3 ? '#d64545' : '#a99470', w + 0.16, 0.92, 1.0); g.position.set(x0, y, 0); deco.push(g);
      n.ks.forEach((k, i) => {
        seen.add(k);
        const x = L + kw * (i + 0.5);
        if (!cubes.has(k)) cubes.set(k, cube(k, colorFor(k), [kw - 0.08, 0.7, 0.8], x, y, 0, k === newK ? 3 : 0));
        else move(cubes.get(k), x, y, 0);
      });
      if (n.ch.length) n.ch.forEach((c, j) => { deco.push(line(L + kw * j, y - 0.4, c._x + sh, top - c._d * dy + 0.4, 0)); draw(c); });
      else if (legs) for (let j = 0; j <= n.ks.length; j++) {
        const lx = L + kw * j, ex = lx + (j - n.ks.length / 2) * 0.14;
        deco.push(line(lx, y - 0.4, ex, y - 0.95, 0, '#3a3024'), cube('', '#3a3024', [0.13, 0.13, 0.13], ex, y - 0.98, 0));
      }
    })(v.root);
    for (const [k, m] of [...cubes]) if (!seen.has(k)) { kill(m); cubes.delete(k); }
  };
  v.c = (k) => cubes.get(k);
  v.node = (k) => { const f = (n) => (n.ks.includes(k) ? n : n.ch.map(f).find(Boolean)); return f(v.root); };
  v.glowN = (n, c) => n.ks.forEach((k) => glow(cubes.get(k), c));
  return v;
}
// 2-3-4 insertion：滿了就把第 2 個（中間偏左）抓上去，和老師的選法一致
async function ins4(tv, k, hooks = {}) {
  const path = []; let n = tv.root;
  while (n.ch.length) { path.push(n); let i = 0; while (i < n.ks.length && k > n.ks[i]) i++; n = n.ch[i]; }
  n.ks.push(k); n.ks.sort((a, b) => a - b); tv.sync(k);
  if (hooks.placed) await hooks.placed(n);
  let lvl = 0;
  while (n.ks.length > 3) {
    const mid = n.ks[1];
    tv.glowN(n, RED);
    if (hooks.over) await hooks.over(n, mid, lvl);
    tv.glowN(n, null);
    const L = N4([n.ks[0]], n.ch.slice(0, 2)), R = N4(n.ks.slice(2), n.ch.slice(2));
    const p = path.pop();
    if (!p) tv.root = N4([mid], [L, R]);
    else { const i = p.ch.indexOf(n); p.ch.splice(i, 1, L, R); p.ks.splice(i, 0, mid); }
    tv.sync(); glow(tv.c(mid), GOLD);
    if (hooks.split) await hooks.split(mid, p, lvl);
    glow(tv.c(mid), null);
    n = p || tv.root; lvl++;
  }
}
const EX234 = () => N4([5, 16], [N4([3]), N4([7, 11, 14]), N4([18, 21])]);

// ═════════ 1. Q&A：為什麼 AVL 插入後的修正是 O(1) ═════════
FRAG.push(['avllin-maint-cost', '維護的力氣：AVL O(1)、heap 上浮 O(log n)、complete BST O(n)', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const mini = (cx, name) => {
    const P = [[0, 5.2], [-1, 4.0], [1, 4.0], [-1.5, 2.8], [-0.5, 2.8], [0.5, 2.8], [1.5, 2.8]];
    const cs = P.map(([x, y]) => cube('', '#c9b48a', [0.5, 0.5, 0.5], cx + x, y, 0));
    [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => line(cx + P[a][0], P[a][1], cx + P[b][0], P[b][1], 0));
    tag(name, 'ptr', cx, 6.1, 0);
    return cs;
  };
  const avl = mini(-4.3, 'AVL'), heap = mini(0, 'heap'), cbt = mini(4.3, 'complete BST');
  const cost = [tag('', 'ptr alt', -4.3, 1.8, 0), tag('', 'ptr alt', 0, 1.8, 0), tag('', 'ptr alt', 4.3, 1.8, 0)];
  say('問：插入 search 就 O(log n)', '那 AVL 插入為什麼說修正 O(1)？');
  await beat(tok, 2600);
  for (const T of [avl, heap, cbt]) for (const i of [0, 2, 5]) glow(T[i], GOLD);
  say('先走到底：search 本來就 O(log n)', '問的是之後「維護」多花多少');
  await beat(tok, 2800);
  for (const T of [avl, heap, cbt]) for (const i of [0, 2, 5]) glow(T[i], null);
  glow(avl[2], GREEN); txt(cost[0], 'O(1)');
  say('AVL：只在一個點 rotate', '修完其他點都不用動');
  await beat(tok, 2800);
  for (const i of [5, 2, 0]) { glow(heap[i], GOLD); await beat(tok, 600); }
  txt(cost[1], 'O(h) = O(log n)');
  say('heap 上浮：可能一路浮到 root', '跟 h 有關也還好，h 被限制在 log n');
  await beat(tok, 2600);
  cbt.forEach((m) => glow(m, RED)); txt(cost[2], 'O(n)');
  say('complete BST：整棵都要動', NO('這就不太好'));
  await beat(tok, 2800);
  say('RR 修一次就高枕無憂', 'insert = O(log n) 找 + O(1) 修');
  await beat(tok, 3000);
}]);

// ═════════ 2. 複習 RR：1、2、3 ═════════
FRAG.push(['avllin-rr-123', '複習 RR：插入 1、2、3，把 2 拉上來', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.6, dy: 1.5, top: 5.6, lab: BF });
  say('AVL：每棵 subtree 左右高度差 ≤ 1', 'bf = hL − hR ∈ {+1, 0, −1}');
  await beat(tok, 2600);
  bstIns(t, 1); tv.sync(1); await beat(tok, 1000);
  bstIns(t, 2); tv.sync(2); await beat(tok, 1200);
  bstIns(t, 3); tv.sync(3);
  say('insert 3：塞到右邊的右邊', '追回去：1 的 bf = 0 − 2 = ' + NO('−2'));
  await beat(tok, 2800);
  tv.showLabs(false);
  const sub = ghostBox('#dd8238', 1.0, 0.8, 1.0); sub.position.set(-0.8, 5.6 - 2 * 1.5, 0); sub.add(lab.label('2 的左子樹', 'idx'));
  let orange = line(0, 5.6 - 1.5, -0.8, 5.6 - 2 * 1.5 + 0.4, 0, '#dd8238');
  say('假如 2 有左子樹', '它比 1 大、比 2 小');
  await beat(tok, 2600);
  say('RR：把中間的 2 拉上來當 root', '1 只好降下來當 2 的小弟');
  rotUp(t, t.root, 'L'); kill(orange); tv.sync();
  await beat(tok, 1500);
  orange = line(-1.6, 5.6 - 1.5, -0.8, 5.6 - 2 * 1.5 + 0.4, 0, '#dd8238');
  const blue = line(0, 5.6, -1.6, 5.6 - 1.5, 0, '#2f6fd6');
  tv.showLabs(true);
  say('只改兩條 link：藍色 2–1、橘色子樹', '子樹改接到 1 的右邊；逆時針旋轉');
  await beat(tok, 3200);
  say('往回找要 O(log n)；修正只要幾行', '修一次就結束；LL 對稱');
  await beat(tok, 3000);
  kill(blue);
}]);

// ═════════ 3. RL 特例：3、5、4 ═════════
FRAG.push(['avllin-rl-354', 'RL 特例：插入 3、5、4，兩次 rotate 讓 4 當頭', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.6, dy: 1.5, top: 5.6, lab: BF });
  say('今天的新情形：依序插入 3、5、4', '');
  await beat(tok, 1800);
  bstIns(t, 3); tv.sync(3); await beat(tok, 1100);
  bstIns(t, 5); tv.sync(5);
  say('5 在 3 的右邊：還是 AVL', 'bf 都合法');
  await beat(tok, 1800);
  bstIns(t, 4); tv.sync(4);
  say('4：3 的右邊、5 的左邊', 'bf：4 = 0，5 = +1，3 = ' + NO('−2'));
  await beat(tok, 3000);
  glow(tv.c(3), GOLD); glow(tv.c(5), GOLD);
  say('3、5 是極值，抓起來當頭都不行', '想要：4 當頭，3、5 在兩邊');
  const goal = tag('目標：4 / 3 5', 'ptr alt', 4.2, 6.2, 0);
  await beat(tok, 3000);
  glow(tv.c(5), null);
  rotUp(t, findN(t, 5), 'R'); tv.sync();
  say('孫子要篡位：先跟爸爸 rotate(4, 5)', 'bf：5 = 0，4 = −1，3 = −2');
  await beat(tok, 3200);
  rotUp(t, t.root, 'L'); tv.sync();
  say('再跟阿公 rotate(4, 3)', OK('4 當頭，bf 全部 0'));
  await beat(tok, 2800);
  kill(goal);
  say('插入點在阿公的右邊的左邊：RL', '一次跳兩級 = 兩次各跳一級');
  await beat(tok, 3000);
}]);

// ═════════ 4–5. RL 通例：A、B、C、AL、BR、CL、CR ═════════
function RLG(state, opt = {}) {
  const Y = (d) => 6.0 - d * 0.95;
  const KS = { AL: 2, BR: 2, CL: 1, CR: 1 }, COL = { AL: '#2fc092', BR: '#31aab0', CL: '#9b7ef4', CR: '#dd8238' };
  const POS = [
    { A: [-1.2, 0], B: [1.8, 1], C: [0.4, 2], AL: [-3.4, 1], BR: [3.6, 2], CL: [-0.6, 3], CR: [1.4, 3], I: [1.4, 4] },
    { A: [-1.2, 0], C: [1.2, 1], B: [2.6, 2], AL: [-3.4, 1], CL: [-0.2, 2], CR: [1.8, 3], I: [1.8, 4], BR: [3.8, 3] },
    { C: [0, 0], A: [-2, 1], B: [2, 1], AL: [-3.3, 2], CL: [-0.9, 2], CR: [1.0, 2], I: [1.0, 3], BR: [3.2, 2] },
  ];
  const EDG = [
    [['A', 'AL'], ['A', 'B'], ['B', 'C'], ['B', 'BR'], ['C', 'CL'], ['C', 'CR']],
    [['A', 'AL'], ['A', 'C'], ['C', 'CL'], ['C', 'B'], ['B', 'CR'], ['B', 'BR']],
    [['C', 'A'], ['C', 'B'], ['A', 'AL'], ['A', 'CL'], ['B', 'CR'], ['B', 'BR']],
  ];
  const NODES = ['A', 'B', 'C'], SUBS = ['AL', 'BR', 'CL', 'CR'];
  const hOf = (k) => (k - 1) * 0.95 + 0.6;
  const g = { Y, POS, st: state, bfL: {} };
  const subPos = (n, st) => { const [x, d] = POS[st][n]; return V3(x, Y(d) + 0.3 - hOf(KS[n]) / 2, 0); };
  NODES.forEach((k) => { const [x, d] = POS[state][k]; g[k] = cube(k, k === 'A' ? '#4b9ee2' : k === 'B' ? '#2f8f6a' : '#b0457a', [0.8, 0.8, 0.8], x, Y(d), 0); });
  SUBS.forEach((n) => { const m = ghostBox(COL[n], 1.2, hOf(KS[n]), 1.0); m.position.copy(subPos(n, state)); const l = lab.label(n, 'idx'); m.add(l); m.userData.l = l; g[n] = m; });
  if (opt.ins !== false) { const [x, d] = POS[state].I; g.I = cube('新', '#d64545', [0.55, 0.55, 0.55], x, Y(d), 0); }
  let es = [];
  const pt = (n, st) => { const [x, d] = POS[st][n]; return NODES.includes(n) ? V3(x, Y(d), 0) : V3(x, Y(d) + 0.3, 0); };
  g.edges = (st) => {
    es.forEach(kill); es = [];
    for (const [a, b] of EDG[st]) { const p = pt(a, st), q = pt(b, st); es.push(line(p.x, p.y, q.x, q.y, 0)); }
    if (g.I) { const [x, d] = POS[st].CR, q = POS[st].I; es.push(line(x, Y(d) - 0.3, q[0], Y(q[1]) + 0.28, 0, '#d64545')); }
  };
  g.go = (st) => {
    es.forEach(kill); es = []; g.st = st;
    NODES.forEach((k) => move(g[k], POS[st][k][0], Y(POS[st][k][1]), 0));
    SUBS.forEach((n) => { const p = subPos(n, st); move(g[n], p.x, p.y, 0); });
    if (g.I) move(g.I, POS[st].I[0], Y(POS[st].I[1]), 0);
    NODES.forEach((k) => { if (g.bfL[k]) g.bfL[k].position.set(POS[st][k][0] + 0.75, Y(POS[st][k][1]) + 0.5, 0); });
  };
  g.bf = (vals) => {
    for (const k of NODES) {
      if (!g.bfL[k]) g.bfL[k] = tag('', 'idx', 0, 0, 0);
      const l = g.bfL[k]; l.position.set(POS[g.st][k][0] + 0.75, Y(POS[g.st][k][1]) + 0.5, 0);
      const v = vals[k]; txt(l, v === undefined ? '' : 'bf ' + v);
      l.element.className = 'lab-label ' + (/2/.test(String(v)) ? 'ptr' : 'idx');
      glow(g[k], /2/.test(String(v)) ? RED : null);
    }
  };
  g.edges(state);
  return g;
}
FRAG.push(['avllin-rl-general-1', 'RL 通例（一）：A、B、C 三代，先 rotate(C, B)', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(0);
  say('插入點在某棵 subtree 的最底層', 'C 帶著 CL、CR；新 node 落在 CR 下面');
  await beat(tok, 3000);
  g.bf({ C: '−1' });
  say('C 有一點點不平衡', 'bf(C) = −1：右邊高一點');
  await beat(tok, 2400);
  g.bf({ C: '−1', B: '+1' });
  say('爸爸 B：另一邊是 BR', 'C 這邊多一層 → bf(B) = +1');
  await beat(tok, 2400);
  g.bf({ C: '−1', B: '+1', A: '−2' });
  say('第一個出問題的是老爺爺 A', 'AL 的底跟新 node 差兩層 → ' + NO('bf(A) = −2'));
  await beat(tok, 3000);
  say('對照 3、5、4：A = 3，B = 5，C = 4', '新 node 只是導火線，要調整的是 ABC');
  await beat(tok, 3200);
  g.bf({});
  g.go(1); await beat(tok, 1200); g.edges(1);
  say('第一次：扭轉 C 跟 B 的關係', 'C 上來，B 轉下去當 C 的小孩');
  await beat(tok, 2800);
  glow(g.BR, GOLD); glow(g.CL, GOLD);
  say('BR 跟著 B 下降一層', 'CL 跟著 C 上升，跟 AL 切齊');
  await beat(tok, 2800);
  glow(g.BR, null); glow(g.CL, null); glow(g.CR, GOLD);
  say('CR 改掛到 B 的左邊', 'B 在 C 原本那層，CR 高度不變');
  await beat(tok, 2600);
  glow(g.CR, null);
  g.bf({ A: '−2', C: '−2', B: '0' });
  say('看起來更不平衡？', '只是暫時的狀態，還有第二步');
  await beat(tok, 3000);
}]);
FRAG.push(['avllin-rl-general-2', 'RL 通例（二）：再 rotate(C, A)，樹高維持 h + 2', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(1);
  const hT = tag('A 這棵（插入前）高 h + 2', 'ptr alt', -3.2, 6.7, 0);
  const hB = tag('BR 高 h', 'idx', 5.4, 2.6, 0);
  g.bf({ A: '−2', C: '−2', B: '0' });
  say('第一次 rotate 之後', 'B 已經平衡；接著處理 A 跟 C');
  await beat(tok, 2800);
  g.bf({});
  g.go(2); await beat(tok, 1200); g.edges(2); hB.position.set(4.6, 3.4, 0);
  say('再把 C rotate 上來', 'C 成為這一群新的霸主');
  await beat(tok, 2800);
  glow(g.B, GOLD); glow(g.BR, GOLD); glow(g.CR, GOLD);
  say('B 那一支跟著上一層', 'CR、新 node、BR 都上去一層');
  await beat(tok, 2600);
  glow(g.B, null); glow(g.BR, null); glow(g.CR, null); glow(g.AL, GOLD);
  say('A 變成 C 的小孩，AL 降一級', '');
  await beat(tok, 2400);
  glow(g.AL, null); glow(g.CL, GOLD);
  say('CL 上升一級，變成 A 的新右小孩', '注意：不是接在 C 下面');
  await beat(tok, 2800);
  glow(g.CL, null);
  g.bf({ A: '+1', B: '0', C: '0' });
  say('B 平衡、A 差 1 平衡、C 也平衡', OK('任務達成'));
  await beat(tok, 2600);
  txt(hT, 'C 這棵（調整後）高 h + 2'); glow(g.C, GREEN);
  say('以 BR = h：前後樹高都是 h + 2', '上面所有 node 的 bf 都不變');
  await beat(tok, 3000);
  say('RL 修一次就結束；對稱的是 LR', '');
  await beat(tok, 2600);
}]);

// ═════════ 6. 小結：兩招走天下 ═════════
FRAG.push(['avllin-cases-summary', 'AVL 兩招走天下：RR/LL 一次、RL/LR 兩次 rotation', async (tok) => {
  fresh([0, 4.6, 13], [0, 3.2, 0]);
  const Y0 = 5.4, D = 1.2;
  const mk = (cx, keys, chain, mid, name, n) => {
    const P = {}; chain.forEach(([k, dx, d]) => { P[k] = [cx + dx, Y0 - d * D]; });
    const cs = {}; keys.forEach((k) => { cs[k] = cube(k, colorFor(k), [0.7, 0.7, 0.7], P[k][0], P[k][1], 0); });
    let es = [];
    const ed = (pairs, Q) => { es.forEach(kill); es = pairs.map(([a, b]) => line(Q[a][0], Q[a][1], Q[b][0], Q[b][1], 0)); };
    const top = chain[0][0];
    ed([[chain[0][0], chain[1][0]], [chain[1][0], chain[2][0]]], P);
    tag(name, 'ptr', cx, 0.9, 0); const nl = tag(n, 'idx', cx, 0.3, 0);
    return {
      cs, top, nl,
      to(Q, pairs) { es.forEach(kill); es = []; for (const k of keys) move(cs[k], Q[k][0], Q[k][1], 0); return () => ed(pairs, Q); },
      Q: (spec) => { const Q = {}; spec.forEach(([k, dx, d]) => { Q[k] = [cx + dx, Y0 - d * D]; }); return Q; },
    };
  };
  const RR = mk(-4.8, [1, 2, 3], [[1, -0.6, 0], [2, 0, 1], [3, 0.6, 2]], 2, 'RR', 'one rotation');
  const LL = mk(-1.6, [1, 2, 3], [[3, 0.6, 0], [2, 0, 1], [1, -0.6, 2]], 2, 'LL', 'one rotation');
  const RL = mk(1.6, [3, 4, 5], [[3, -0.6, 0], [5, 0.6, 1], [4, 0, 2]], 4, 'RL', 'two rotations');
  const LR = mk(4.8, [3, 4, 5], [[5, 0.6, 0], [3, -0.6, 1], [4, 0, 2]], 4, 'LR', 'two rotations');
  say('AVL insertion 只有四種情形', '兩兩對稱');
  await beat(tok, 2600);
  say('RR、LL：中間那個抓上來', OK('one rotation'));
  const bal = (o, a, m, b) => o.Q([[m, 0, 0], [a, -0.75, 1], [b, 0.75, 1]]);
  let f1 = RR.to(bal(RR, 1, 2, 3), [[2, 1], [2, 3]]), f2 = LL.to(bal(LL, 1, 2, 3), [[2, 1], [2, 3]]);
  await beat(tok, 1300); f1(); f2();
  await beat(tok, 2200);
  say('RL、LR：第二代藏在下層', '先跟爸爸換，再跟阿公換');
  f1 = RL.to(RL.Q([[3, -0.6, 0], [4, 0.2, 1], [5, 0.8, 2]]), [[3, 4], [4, 5]]);
  f2 = LR.to(LR.Q([[5, 0.6, 0], [4, -0.2, 1], [3, -0.8, 2]]), [[5, 4], [4, 3]]);
  await beat(tok, 1300); f1(); f2();
  await beat(tok, 1600);
  f1 = RL.to(bal(RL, 3, 4, 5), [[4, 3], [4, 5]]); f2 = LR.to(bal(LR, 3, 4, 5), [[4, 3], [4, 5]]);
  await beat(tok, 1300); f1(); f2();
  say('', OK('two rotations'));
  await beat(tok, 2000);
  say('插入 → 往回走 → 第一個失衡點', '修正完就沒了');
  await beat(tok, 3000);
}]);

// ═════════ 7. Q&A：為什麼 CL、CR 一樣高 ═════════
FRAG.push(['avllin-rl-why-heights', 'Q&A：為什麼一開始 CL = CR？', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(0, { ins: false });
  const Y = g.Y;
  const setK = (m, k, d) => { const h = (k - 1) * 0.95 + 0.6; m.scale.y = h / 0.6; m.position.y = Y(d) + 0.3 - h / 2; };
  g.bf({ A: '−1', B: '0', C: '0' });
  say('問：示意圖的高度一定要這樣嗎？', '插入前：CL = CR，A 的 bf = −1');
  await beat(tok, 3000);
  const ins = cube('新', '#d64545', [0.55, 0.55, 0.55], -0.6, Y(4), 0, 2.5);
  say('插在 CL 或 CR 都一樣', '重點是 C 這棵變高了');
  await beat(tok, 2600);
  kill(ins);
  setK(g.CL, 2, 3); glow(g.CL, GOLD);
  g.bf({ A: '−2?', B: '+1', C: '+1' });
  say('如果 CL 本來就高一層？', 'AL 跟 CL 底差 2 → A 早就壞了');
  await beat(tok, 3200);
  setK(g.CL, 1, 3); g.CL.visible = false; showL(g.CL.userData.l, false); glow(g.CL, null);
  const ins2 = cube('新', '#d64545', [0.55, 0.55, 0.55], 1.4, Y(4), 0, 2.5);
  g.bf({ C: '−2' });
  say('如果 CL 太矮（空的）？', '插入後 C 自己就 bf = −2，失衡點是 C');
  await beat(tok, 3200);
  kill(ins2); g.CL.visible = true; showL(g.CL.userData.l, true);
  g.bf({ A: '−1', B: '0', C: '0' });
  say('A 是「第一個」失衡點', '所以 CL、CR、BR、AL 的高度被限制住');
  await beat(tok, 3200);
}]);

// ═════════ 8. Demo：依序插入 1, 2, 3, 15, 14, 13 ═════════
FRAG.push(['avllin-demo-insert', 'AVL demo：插入 1、2、3、15、14、13', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.35, dy: 1.45, top: 5.6, lab: HT });
  say('網路上的 AVL demo', 'node 旁的數字 = 那棵 subtree 的高度');
  await beat(tok, 2400);
  const cap = {
    3: ['insert 3：1 右 → 2 右', '往回更新高度 → 1 失衡：RR'],
    15: ['insert 15：更新高度', OK('不需要 rotation')],
    14: ['insert 14：2 右 → 3 右 → 15 左', '3 失衡：右邊的左邊 → RL'],
    13: ['insert 13：2 右 → 14 左 → 3 右', '失衡的不是 14，是回到 2 才出事'],
  };
  for (const k of [1, 2, 3, 15, 14, 13]) {
    bstIns(t, k); tv.sync(k);
    const c = cap[k] || ['insert ' + k, ''];
    say(c[0], c[1]);
    await beat(tok, cap[k] ? 2600 : 1400);
    const bad = firstBad(t, k);
    if (bad) {
      await avlFix(t, tv, bad, tok);
      say(k === 3 ? '把中間的 2 拉上來' : k === 14 ? '14 拉上來：3 跟 15 在兩邊' : '2、14、3 重新洗牌：3 拉上去', '高度回到平衡');
      await beat(tok, 2600);
    }
  }
  say('實作通常存每棵 subtree 的高度', '要 bf 時再拿高度相減');
  await beat(tok, 3000);
}]);

// ═════════ 9. Demo：刪除 1、2、15，與非 leaf 的 13 ═════════
FRAG.push(['avllin-demo-delete', 'AVL removal demo：刪 1、2、15，刪 13 找人補位', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const t = { root: null }; [3, 2, 14, 1, 13, 15].forEach((k) => bstIns(t, k));
  const tv = TV(t, { dx: 1.35, dy: 1.45, top: 5.6, lab: HT }); tv.sync();
  say('removal 的原理一樣', '移掉 → 找回來 → 不平衡就旋轉');
  await beat(tok, 2600);
  for (const k of [1, 2, 15]) {
    glow(tv.c(k), GOLD); await beat(tok, 700);
    delLeaf(t, k); tv.sync();
    const bad = anyBad(t.root);
    say('remove ' + k + '：更新高度', bad ? NO(bad.k + ' 不平衡了') : OK('沒有不平衡，繼續'));
    await beat(tok, 2200);
    if (bad) {
      await avlFix(t, tv, bad, tok);
      say(k === 2 ? '14 拉上來（一次 rotation）' : '13 拉上來（兩次 rotation）', '重新平衡');
      await beat(tok, 2200);
    }
  }
  bstIns(t, 5); tv.sync(5);
  say('再插一個 5，比較看得出來', '');
  await beat(tok, 1800);
  glow(tv.c(13), RED);
  say('remove 13：它不是 leaf', '直接挖空，整個結構都要重排');
  await beat(tok, 2600);
  glow(tv.c(5), GOLD);
  say('找左子樹最大的 5 來補位', '數字上最接近 13 的代替品');
  await beat(tok, 2400);
  const n13 = findN(t, 13); delLeaf(t, 5); n13.k = 5; tv.sync(); glow(tv.c(5), null);
  say('問題變成「移掉一個 leaf」', '再沿路檢查高度');
  await beat(tok, 2600);
  say('也可以抓右子樹最小的（14）', '左邊空的就往右邊抓');
  await beat(tok, 2800);
}]);

// ═════════ 10. AVL vs 紅黑樹 ═════════
const RB8 = [[5, 'B'], [2, 'R'], [1, 'B'], [4, 'B'], [3, 'R'], [7, 'B'], [6, 'R'], [8, 'R']];
FRAG.push(['avllin-avl-vs-rb', 'AVL vs 紅黑樹：矮一點好 search，鬆一點好更新', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const ta = { root: null }; [4, 2, 6, 1, 3, 5, 7].forEach((k) => bstIns(ta, k));
  const va = TV(ta, { cx: -3.5, dx: 0.72, dy: 1.3, top: 5.2, sz: 0.62 }); va.sync();
  const tb = rbTree(RB8); const vb = TV(tb, { rb: true, cx: 3.3, dx: 0.72, dy: 1.3, top: 5.2, sz: 0.62 }); vb.sync();
  tag('AVL', 'ptr', -3.5, 6.3, 0); tag('紅黑樹', 'ptr', 3.3, 6.3, 0);
  say('AVL 好教：四種 case、兩種處理', 'one rotation / two rotations');
  await beat(tok, 2800);
  const hs = [];
  for (const [k, p] of va.P) hs.push(tag('h' + hgt(findN(ta, k)), 'idx', p.x + 0.42, p.y + 0.4, 0));
  say('缺點：每個 node 多存高度', '一個 int ≈ 4 bytes（或 short）');
  await beat(tok, 3000);
  va.cubes.forEach((m) => glow(m, GREEN));
  say('樹比較矮 → 適合 search', '越嚴格，維護越費力');
  await beat(tok, 2800);
  say('insert / remove 還是 O(log n)', '但 log n 前面的常數大一些');
  await beat(tok, 2600);
  va.cubes.forEach((m) => glow(m, null)); vb.cubes.forEach((m) => glow(m, GOLD));
  say('紅黑樹：寬鬆一點，search 稍慢', 'insert / remove 比較有效率');
  await beat(tok, 2800);
  vb.cubes.forEach((m) => glow(m, null));
  say('每個 node 只要記顏色', '紅或黑：1 bit，不用存高度');
  await beat(tok, 2600);
  say('缺點：難教，像在念咒語', '插紅色 → 看爸爸 → 看叔叔…');
  await beat(tok, 3000);
  hs.forEach(kill);
}]);

// ═════════ 11. 紅黑樹的規則（咒語）→ 先教 2-3-4 樹 ═════════
FRAG.push(['avllin-rb-rules', '紅黑樹的「咒語」：三條規則', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = rbTree(RB8); const tv = TV(t, { rb: true, dx: 1.1, dy: 1.4, top: 5.6 }); tv.sync();
  say('直接背紅黑樹的規則……', '');
  await beat(tok, 2000);
  glow(tv.c(5), GOLD);
  say('規則一：root 是黑色', '');
  await beat(tok, 2400);
  glow(tv.c(5), null);
  for (const k of [2, 1, 4]) glow(tv.c(k), GOLD);
  say('規則二：紅 node 的小孩一定黑', '2 紅 → 1、4 黑');
  await beat(tok, 2800);
  for (const k of [2, 1, 4]) glow(tv.c(k), null);
  const cnt = tag('', 'ptr alt', 5.2, 6.3, 0);
  for (const path of [[5, 2, 1], [5, 2, 4, 3], [5, 7, 8]]) {
    path.forEach((k) => glow(tv.c(k), GREEN));
    txt(cnt, path.join('→') + '：黑 ' + path.filter((k) => findN(t, k).c === 'B').length + ' 個');
    await beat(tok, 1500);
    path.forEach((k) => glow(tv.c(k), null));
  }
  say('規則三：root 到每個 leaf 黑色一樣多', '這咒語是怎麼想出來的？');
  await beat(tok, 2800);
  say('先教一棵好懂（但不實用）的樹', '2-3-4 樹 → 再對照紅黑樹');
  await beat(tok, 3000);
}]);

// ═════════ 12. 2-3-4 樹的三種 node ═════════
FRAG.push(['avllin-234-nodes', '2-3-4 樹：2-node、3-node、4-node', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3, 0]);
  say('AVL：路見不平，立刻 rebalance', '像處女座，什麼都要完美');
  await beat(tok, 2600);
  say('2-3-4 樹：寬鬆一點，先暫存', 'node 裡可以放好幾個 key');
  await beat(tok, 2600);
  const node = (cx, ks, kids) => {
    const w = ks.length * 0.85;
    const g = ghostBox('#a99470', w + 0.16, 0.92, 1.0); g.position.set(cx, 4.6, 0);
    ks.forEach((k, i) => cube(k, '#4b9ee2', [0.77, 0.7, 0.8], cx - w / 2 + 0.85 * (i + 0.5), 4.6, 0, 2.5));
    kids.forEach((s, j) => {
      const bx = cx + (j - (kids.length - 1) / 2) * 1.05, sx = cx - w / 2 + 0.85 * j;
      line(sx, 4.2, bx, 3.0, 0);
      const m = ghostBox('#2fc092', 0.95, 0.9, 0.9); m.position.set(bx, 2.5, 0); tag(s, 'idx', bx, 1.8, 0);
    });
  };
  node(-4.4, ['a'], ['< a', '> a']); tag('2-node', 'ptr', -4.4, 5.6, 0);
  say('2-node：1 個 key、2 個小孩', '< a ｜ > a');
  await beat(tok, 3000);
  node(-0.6, ['a', 'b'], ['< a', 'a~b', '> b']); tag('3-node', 'ptr', -0.6, 5.6, 0);
  say('3-node：a < b，3 個小孩', '< a ｜ a~b ｜ > b');
  await beat(tok, 3000);
  node(4.0, ['a', 'b', 'c'], ['< a', 'a~b', 'b~c', '> c']); tag('4-node', 'ptr', 4.0, 5.6, 0);
  say('4-node：a < b < c，4 個小孩', '');
  await beat(tok, 3000);
  say('insert 時：沒滿的 node 可以擠一下', '每個 node 都是暫存區');
  await beat(tok, 2800);
  say('也可以 2-3、2-3-4-5……', '為了紅黑樹，只講 2-3-4');
  await beat(tok, 2800);
}]);

// ═════════ 13. 典型的 2-3-4 樹與兩條規則 ═════════
FRAG.push(['avllin-234-rules', '2-3-4 樹：橫向寬鬆、縱向嚴格（leaf 同高）', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0 }); tv.root = EX234(); tv.sync();
  say('一棵典型的 2-3-4 樹', 'root：5 16');
  await beat(tok, 2400);
  const R = tv.root;
  for (const [i, s] of [[0, '3：2-node'], [1, '7 11 14：4-node'], [2, '18 21：3-node']]) {
    tv.glowN(R.ch[i], GOLD); say(s, ''); await beat(tok, 1700); tv.glowN(R.ch[i], null);
  }
  say('規則一（橫向寬鬆）', '每個 node 是 2-、3- 或 4-node');
  await beat(tok, 2600);
  const lg = tag('這些空腳（蟑螂腳）都在同一高度', 'ptr alt', 0, 1.9, 0);
  say('規則二（縱向嚴格）：leaf 都同高', 'all leaves at the same height');
  await beat(tok, 3000);
  kill(lg);
  say('所以高度 = O(log n)', '全滿 ≈ log₄ n，每個只放一筆 ≈ log₂ n');
  await beat(tok, 3000);
  say('還是 multi-way search', '看 key 決定往哪棵 subtree 走');
  await beat(tok, 2600);
}]);

// ═════════ 14. 有空房間就住：insert 2、20、13 ═════════
FRAG.push(['avllin-234-easy-insert', '2-3-4 插入：有空房就住（2、20），13 碰到滿房', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0 }); tv.root = EX234(); tv.sync();
  say('insert 2：比 5 小 → 往 3 那邊', '已經到 leaf 了');
  await beat(tok, 2200);
  await ins4(tv, 2);
  say('不能往下長新的一層（腳會不同高）', OK('3 還沒滿 → 2 住進去'));
  await beat(tok, 2800);
  say('insert 20：比 16 大 → 18 21', '');
  await beat(tok, 1500);
  await ins4(tv, 20);
  say('還有一間空房間 → 18 20 21', OK('一點也不難'));
  await beat(tok, 2600);
  const n = tv.node(11);
  const c13 = cube(13, '#d64545', [0.74, 0.7, 0.8], n._px, n._py + 1.3, 0, 2.5);
  tv.glowN(n, RED);
  say('insert 13：走到 7 11 14', NO('房間滿了！'));
  await beat(tok, 2800);
  say('往下塞？13 長出兩隻腳就不同層', '只能在這裡擠——擠不下怎麼辦？');
  await beat(tok, 3000);
  tv.glowN(n, null); kill(c13);
  say('有空房：insert 容易', '沒空房：等一下要解決的問題');
  await beat(tok, 2600);
}]);

// ═════════ 15. Overflow → 分家：insert 13 ═════════
FRAG.push(['avllin-234-split-13', 'Overflow 分家：7 11 14 插入 13，11 往上', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0 }); tv.root = EX234(); tv.sync();
  say('insert 13：一路找到 7 11 14', '');
  await beat(tok, 2200);
  await ins4(tv, 13, {
    placed: async () => { say('7 11 13 14：四個人', NO('overflow')); await beat(tok, 2400); },
    over: async () => {
      say('房間滿了 → 分家', '一些人留在這層，leaf 高度才不變');
      await beat(tok, 2800);
      glow(tv.c(7), GOLD);
      say('抓 7 上去？一邊沒小孩', NO('那邊就沒有 leaf → 不同高'));
      await beat(tok, 2800);
      glow(tv.c(7), null); glow(tv.c(11), GOLD);
      say('把中間的抓起來：11（或 13）', '跟 AVL 抓中間的概念一樣');
      await beat(tok, 2600);
    },
    split: async () => {
      say('11 往上一層 insert：5 11 16', '7 一家、13 14 一家（split）');
      await beat(tok, 3000);
    },
  });
  say('7：比 11 小、比 5 大', '13 14：在 11 跟 16 中間');
  await beat(tok, 2600);
  say('插到 4-node = 一次分家', '分家後往上 insert，上面沒滿就住下');
  await beat(tok, 2800);
}]);

// ═════════ 16. 連續分家：insert 23 ═════════
FRAG.push(['avllin-234-cascade-23', '連續分家：18 20 21 插入 23，樹高才 +1', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  tv.root = N4([5, 11, 16], [N4([3]), N4([7]), N4([13, 14]), N4([18, 20, 21])]); tv.sync();
  say('假設 18 20 21 都在這邊', '現在 insert 23');
  await beat(tok, 2400);
  await ins4(tv, 23, {
    placed: async () => { say('23 放進 18 20 21', NO('滿了')); await beat(tok, 2000); },
    over: async (n, mid, lvl) => {
      if (lvl === 0) say('中間抓一個上去：20（或 21）', '18 一家、21 23 一家');
      else say('5 11 16 20：上面也滿了！', '再分家：抓 11（或 16）上去');
      await beat(tok, 2800);
    },
    split: async (mid, p, lvl) => {
      if (lvl === 0) say('20 上去取暖', '');
      else say('11 變成新的 root', OK('這時高度才真正多一層'));
      await beat(tok, 2600);
    },
  });
  say('整條路上每一代都滿，才會長高', '所有 leaf 依然在同一層');
  await beat(tok, 2800);
  say('只有兩件事：空的進去住', '滿的分家，再往上 insert');
  await beat(tok, 2800);
}]);

// ═════════ 17. 依序插入 1 … 10 ═════════
FRAG.push(['avllin-234-seq-1to10', '2-3-4 樹依序插入 1 … 10：從基層做起', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  tv.root = N4([1]); tv.sync(1);
  say('Q：依序插入 1、2、3……會怎樣？', '先放 1；蟑螂腳要同高');
  await beat(tok, 2400);
  for (let k = 2; k <= 10; k++) {
    let split = false;
    await ins4(tv, k, {
      placed: async () => { say('insert ' + k, ''); await beat(tok, k % 2 ? 1300 : 1100); },
      over: async (n, mid, lvl) => { say(n.ks.join(' ') + '：滿了', '中間選 ' + mid + ' 上去'); await beat(tok, 1700); },
      split: async (mid) => { split = true; say(mid + ' 上去當家長', ''); await beat(tok, 1500); },
    });
    if (k === 10) { say('2 4 6 8 滿了 → 4 上去', '樹這時才長高一層'); await beat(tok, 1600); }
  }
  say('大部分地方都還有空房間', '像公司：組員 → 小組長 → 大組長');
  await beat(tok, 3000);
  say('從基層做起：滿了才往上長', '不會長成 linked list');
  await beat(tok, 2600);
}]);

// ═════════ 18. 蟑螂腳：真正的定義 ═════════
FRAG.push(['avllin-234-legs', '嚴格定義：蟑螂腳（空的位置）要同高', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  const n3 = N4([3]);
  tv.root = N4([4], [N4([2], [N4([1]), n3]), N4([6, 8], [N4([5]), N4([7]), N4([9, 10])])]); tv.sync();
  say('剛才插完 1…10 的樹', '腳在管樹高跟資料量的關係');
  await beat(tok, 2600);
  say('嚴格定義：所有蟑螂腳同一高度', '「leaf 同高」是好懂的說法');
  await beat(tok, 2800);
  const two = tv.root.ch[0];
  two.ch = [two.ch[0]]; tv.sync();
  say('把 3 這個 node 拿掉呢？', '');
  await beat(tok, 2000);
  for (const k of [1, 5, 7, 9, 10]) glow(tv.c(k), GREEN);
  say('剩下的 leaf 都還在第 3 層', '看起來合法？');
  await beat(tok, 2600);
  const x = two._L + 0.82, y = two._py;
  const bad = line(x, y - 0.4, x + 0.3, y - 0.95, 0, '#d64545'), dot = cube('', '#d64545', [0.18, 0.18, 0.18], x + 0.3, y - 0.98, 0);
  const note = tag('這隻腳在第 2 層', 'ptr', x + 0.6, y - 1.5, 0);
  for (const k of [1, 5, 7, 9, 10]) glow(tv.c(k), null);
  say('但 2 的右腳不合群', NO('不能有空的 leaf'));
  await beat(tok, 3200);
  kill(bad); kill(dot); kill(note);
  two.ch.push(n3); tv.sync();
  say('所以真正的定義：腳同高', '2-3-4 樹是往根部長的樹');
  await beat(tok, 2800);
}]);

// ═════════ 19. 2-3-4 node ↔ 紅黑樹 ═════════
FRAG.push(['avllin-rb-mapping', '2-3-4 node 換成 binary node：黑 = 代表，紅 = 跟班', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  say('2-3-4 樹好懂，但很難寫', 'node 裡要排序、if-then-else 半天');
  await beat(tok, 2800);
  say('想要：binary tree（好寫）', '每種 2-3-4 node 對應一小棵 BST');
  await beat(tok, 2600);
  const box = (cx, y, ks) => {
    const w = ks.length * 0.8; const g = ghostBox('#a99470', w + 0.16, 0.86, 1.0); g.position.set(cx, y, 0);
    ks.forEach((k, i) => cube(k, '#4b9ee2', [0.72, 0.66, 0.8], cx - w / 2 + 0.8 * (i + 0.5), y, 0));
  };
  const rb = (k, c, x, y, d) => cube(k, c === 'R' ? RBR : RBB, [0.7, 0.7, 0.7], x, y, 0, d ? 2.5 : 0);
  // 2-node
  box(-4.4, 5.4, ['a']); arrow(V3(-3.6, 5.4, 0), V3(-2.4, 5.4, 0));
  rb('a', 'B', -1.2, 5.4, true);
  say('2-node → 一個黑色 node', '黑色 = 這一家的代表（像組長）');
  await beat(tok, 3000);
  // 4-node
  box(-4.4, 3.6, ['a', 'b', 'c']); arrow(V3(-3.0, 3.6, 0), V3(-2.4, 3.6, 0));
  rb('b', 'B', -1.0, 3.9, true); await beat(tok, 800);
  rb('a', 'R', -1.8, 2.9, true); rb('c', 'R', -0.2, 2.9, true);
  line(-1.0, 3.9, -1.8, 2.9, 0); line(-1.0, 3.9, -0.2, 2.9, 0);
  say('4-node：中間的 b 當代表（黑）', '左右是跟班（紅）→ 最平衡');
  await beat(tok, 3200);
  // 3-node
  box(-4.4, 1.4, ['a', 'b']); arrow(V3(-3.4, 1.4, 0), V3(-2.4, 1.4, 0));
  rb('a', 'B', -1.4, 1.7, true); rb('b', 'R', -0.6, 0.7, true); line(-1.4, 1.7, -0.6, 0.7, 0);
  say('3-node：小的當代表', '大的是紅色跟班，在右下');
  await beat(tok, 3000);
  tag('或', 'idx', 0.9, 1.3, 0);
  rb('b', 'B', 3.0, 1.7, true); rb('a', 'R', 2.2, 0.7, true); line(3.0, 1.7, 2.2, 0.7, 0);
  say('也可以大的當代表', '小的紅色跟班在左下：兩種都行');
  await beat(tok, 3000);
  say('這樣換出來的 BST 就是紅黑樹', '黑 + 相連的紅 = 一個 2-3-4 node');
  await beat(tok, 3000);
}]);

// ═════════ 20. 例子：2 5 / 1 | 3 4 | 6 7 8 → 紅黑樹 ═════════
FRAG.push(['avllin-rb-example', '2-3-4 樹 2 5 / 1｜3 4｜6 7 8 換成紅黑樹', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.2, 0]);
  const t4 = T4({ cx: -3.6, top: 5.6, dy: 1.6, kw: 0.68, gap: 0.42 });
  t4.root = N4([2, 5], [N4([1]), N4([3, 4]), N4([6, 7, 8])]); t4.sync();
  tag('2-3-4 樹', 'ptr', -3.6, 6.6, 0); tag('紅黑樹', 'ptr', 3.0, 6.6, 0);
  say('2-node、3-node、4-node 都有', '2 5 / 1 ｜ 3 4 ｜ 6 7 8');
  await beat(tok, 2800);
  const t = { root: null }; const tv = TV(t, { rb: true, cx: 3.0, dx: 0.74, dy: 1.25, top: 5.6, sz: 0.62 });
  // 各 node 用固定的 inorder 位置，所以先全部插好再逐步顯示會亂；這裡照步驟一個個長出來
  const steps = [
    [[[2, 'B'], [5, 'R']], [2, 5], '2 5：小的 2 當代表（黑）', '5 是紅色跟班'],
    [[[7, 'B'], [6, 'R'], [8, 'R']], [6, 7, 8], '5 的右邊：6 7 8', '7 當代表，6、8 是紅色跟班'],
    [[[4, 'B'], [3, 'R']], [3, 4], '2、5 中間：3 4', '這次讓 4 當代表，3 是紅'],
    [[[1, 'B']], [1], '2 的左邊：1 自己住', '自己當代表（黑）'],
  ];
  for (const [ins, keys, a, b] of steps) {
    ins.forEach(([k, c]) => bstIns(t, k, c)); tv.sync(keys);
    t4.glowN(t4.node(keys[0]), GOLD); keys.forEach((k) => glow(tv.c(k), GOLD));
    say(a, b); await beat(tok, 2600);
    t4.glowN(t4.node(keys[0]), null); keys.forEach((k) => glow(tv.c(k), null));
  }
  say('3-node 有兩種換法', '一棵 2-3-4 樹 ↔ 好幾棵紅黑樹');
  await beat(tok, 2600);
  const fam = [[2, 5], [1], [3, 4], [6, 7, 8]], cols = ['#4b9ee2', '#2fc092', '#dd8238', '#9b7ef4'];
  fam.forEach((ks, i) => {
    const ps = ks.map((k) => tv.P.get(k)); const x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x));
    const y0 = Math.min(...ps.map((p) => p.y)), y1 = Math.max(...ps.map((p) => p.y));
    const g = ghostBox(cols[i], x1 - x0 + 0.9, y1 - y0 + 0.9, 1.1); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  });
  say('反過來：黑色 + 附近的紅色 = 一家', '一條線、兩條線、三條線也對得上');
  await beat(tok, 3200);
}]);

// ═════════ 21. 紅黑樹插入：1.5、4.5、1.8 ═════════
FRAG.push(['avllin-rb-insert-easy', '紅黑樹插入：1.5、4.5 標紅就好，1.8 紅接紅', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 0.88, dy: 1.25, top: 5.8, sz: 0.72 }); tv.sync();
  say('照 BST insertion 走下去', '新 node 要塗什麼顏色？');
  await beat(tok, 2400);
  bstIns(t, 1.5, 'R'); tv.sync(1.5);
  say('1.5：2 的左 → 1 的右', '1 已經當代表 → 1.5 是紅色跟班');
  await beat(tok, 3000);
  say('對應 2-3-4：有空房間', OK('標成紅色，什麼都不用做'));
  await beat(tok, 2600);
  bstIns(t, 4.5, 'R'); tv.sync(4.5);
  say('4.5：2 右 → 5 左 → 4 右', '4 當家長，4.5 當跟班：' + OK('紅色'));
  await beat(tok, 3000);
  bstIns(t, 1.8, 'R'); tv.sync(1.8);
  glow(tv.c(1.5), RED); glow(tv.c(1.8), RED);
  say('1.8：比 1、1.5 大 → 接在 1.5 右', NO('紅色接在紅色後面'));
  await beat(tok, 3000);
  say('1、1.5、1.8 歪成一串', '應該是 1.5 在上：就是 AVL 的 RR');
  await beat(tok, 3000);
}]);

// ═════════ 22. 新生先為紅，紅父不能容 ═════════
FRAG.push(['avllin-rb-two-problems', '新生先為紅、紅父不能容：插 9 進 6 7 8', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 1.0, dy: 1.3, top: 5.6, sz: 0.75 }); tv.sync();
  const p1 = tag('新生先為紅', 'ptr alt', -4.6, 6.4, 0);
  say('第一句：新插入的一律先塗紅', '新生先為紅');
  await beat(tok, 2600);
  const p2 = tag('紅父不能容', 'ptr alt', -4.6, 5.7, 0);
  say('第二句：爸爸是紅的就不行', '紅父不能容');
  await beat(tok, 2600);
  say('紅色是小弟，小弟頭上要有大哥', '大哥 = 這家的黑色代表');
  await beat(tok, 2800);
  bstIns(t, 9, 'R'); tv.sync(9);
  for (const k of [6, 7, 8]) glow(tv.c(k), GOLD);
  say('insert 9 進 6 7 8 這家', '2-3-4：要分家，7 拱上去');
  await beat(tok, 3000);
  for (const k of [6, 7]) glow(tv.c(k), null);
  glow(tv.c(8), RED); glow(tv.c(9), RED);
  say('紅黑樹：9 紅、爸爸 8 也紅', NO('紅父不能容'));
  await beat(tok, 2800);
  say('紅父兩種原因', '這家沒拿中間當頭（1.8）／這家滿了（9）');
  await beat(tok, 3200);
  say('步驟：插入標紅 → 檢查爸爸', '爸爸黑 = 有空房，結束');
  await beat(tok, 2800);
  kill(p1); kill(p2);
}]);

// ═════════ 23. 黑叔逼爺退：rotation ═════════
FRAG.push(['avllin-rb-black-uncle', '黑叔逼爺退：1、1.5、1.8 旋轉＋變色', async (tok) => {
  fresh([0, 5, 12], [0, 3.2, 0]);
  const t = rbTree([[2, 'B'], [1, 'B'], [1.5, 'R'], [1.8, 'R']]);
  const tv = TV(t, { rb: true, dx: 1.5, dy: 1.4, top: 6.0 }); tv.sync();
  const rest = ghostBox('#a99470', 1.6, 1.2, 1.0); rest.position.set(3.4, 4.6, 0); rest.add(lab.label('5 那邊', 'idx'));
  line(tv.P.get(2).x, 6.0, 3.4, 5.2, 0);
  const nilAt = () => { const p = tv.P.get(1); return [p.x - 0.8, p.y - 1.0]; };
  let [nx, ny] = nilAt();
  const nil = cube('', RBB, [0.3, 0.3, 0.3], nx, ny, 0), nilL = tag('nil', 'idx', nx - 0.5, ny, 0);
  let nilE = line(tv.P.get(1).x, tv.P.get(1).y, nx, ny, 0);
  glow(tv.c(1.5), RED); glow(tv.c(1.8), RED);
  say('insert 1.8：爸爸 1.5 是紅', '紅父不能容 → 看叔叔');
  await beat(tok, 2800);
  glow(nil, GOLD);
  say('叔叔 = 爺爺 1 的另一個小孩', '這裡是 nil（蟑螂腳）');
  await beat(tok, 2600);
  say('把 nil 當成黑色的空 node', 'if 只要判斷「是不是黑」');
  await beat(tok, 2600);
  glow(nil, null);
  say('黑叔叔 = 3-node 歪掉了', '不是滿房，只是沒選中間當頭');
  await beat(tok, 2600);
  glow(tv.c(1.5), null); glow(tv.c(1.8), null);
  kill(nilE); rotUp(t, findN(t, 1), 'L'); tv.sync();
  [nx, ny] = nilAt(); move(nil, nx, ny, 0); nilL.position.set(nx - 0.5, ny, 0);
  say('rotate(A = 1, B = 1.5)', '跟 AVL 的 RR 一樣');
  await beat(tok, 2200);
  nilE = line(tv.P.get(1).x, tv.P.get(1).y, nx, ny, 0);
  findN(t, 1.5).c = 'B'; findN(t, 1).c = 'R'; tv.sync();
  say('1.5 漆成黑、1 漆成紅、1.8 維持紅', OK('= 4-node：1 1.5 1.8'));
  await beat(tok, 3000);
  const poem = tag('黑叔逼爺退', 'ptr alt', -3.8, 6.4, 0);
  say('黑叔逼爺退', '爺爺被轉下去；其他 link 都沒變');
  await beat(tok, 3000);
  kill(poem);
}]);

// ═════════ 24. 紅叔：變色往上傳 ═════════
FRAG.push(['avllin-rb-red-uncle', '紅叔叔 = 滿房分家：插入 9，變色一路往上', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 1.0, dy: 1.3, top: 5.6, sz: 0.75 }); tv.sync();
  bstIns(t, 9, 'R'); tv.sync(9);
  glow(tv.c(8), RED); glow(tv.c(9), RED); glow(tv.c(6), GOLD);
  say('insert 9：爸爸 8 紅、叔叔 6 也紅', '紅叔 = 這家已經滿了 → 分家');
  await beat(tok, 3000);
  glow(tv.c(8), null); glow(tv.c(9), null); glow(tv.c(6), null);
  findN(t, 6).c = 'B'; findN(t, 8).c = 'B'; tv.sync();
  say('爸爸、叔叔改黑：分成兩家', '6 一家；8 9 一家（8 當頭）');
  await beat(tok, 3000);
  findN(t, 7).c = 'R'; tv.sync(); glow(tv.c(7), GOLD);
  say('爺爺 7 往上 insert → 改紅', '加入新的一家，一律先紅');
  await beat(tok, 3000);
  glow(tv.c(5), RED); glow(tv.c(7), RED);
  say('7 的爸爸 5 也紅 → 繼續處理', '叔叔 1 是黑 → 旋轉');
  await beat(tok, 3000);
  glow(tv.c(5), null); glow(tv.c(7), null);
  rotUp(t, t.root, 'L'); findN(t, 5).c = 'B'; findN(t, 2).c = 'R'; tv.sync();
  say('5 拉上來漆黑、2 漆紅', '= 2-3-4 的 root 變成 2 5 7');
  await beat(tok, 3200);
  const poem = tag('紅叔：變色龍，一路往上', 'ptr alt', -3.6, 6.5, 0);
  say('紅叔叔 → 變色，可能一路傳上去', '新生先為紅、紅父不能容、黑叔逼爺退');
  await beat(tok, 3200);
  kill(poem);
}]);

// ═════════ 25. 代價：旋轉 vs 變色 ═════════
FRAG.push(['avllin-rb-cost', '紅黑樹的代價：旋轉偶爾、變色便宜', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const hdr = [tag('紅黑樹', 'ptr', -1.2, 6.4, 0), tag('2-3-4 樹', 'ptr', 2.8, 6.4, 0)];
  const r1 = [tag('黑叔：旋轉（restructure）', 'idx', -1.2, 5.6, 0), tag('3-node 擠一下：easy', 'idx', 2.8, 5.6, 0)];
  const r2 = [tag('紅叔：變色（recolor）', 'idx', -1.2, 4.9, 0), tag('split 分家：hard', 'idx', 2.8, 4.9, 0)];
  say('旋轉要換幾張小紙條', 'restructure：一個 local rotation');
  r1[0].element.className = 'lab-label ptr alt';
  await beat(tok, 3000);
  r1[0].element.className = 'lab-label idx'; r2[0].element.className = 'lab-label ptr alt'; r2[1].element.className = 'lab-label ptr';
  say('變色可能很多步，但只改顏色', '在 2-3-4 樹裡卻是最難的 split');
  await beat(tok, 3200);
  say('改一堆 1-bit 的顏色', OK('簡單又快'));
  await beat(tok, 2600);
  r2[0].element.className = 'lab-label idx'; r2[1].element.className = 'lab-label idx';
  const t = rbTree([[3, 'B'], [5, 'R']]); const tv = TV(t, { rb: true, dx: 1.5, dy: 1.4, top: 3.4 }); tv.sync();
  say('3-node 插入一定要旋轉嗎？', '例：3 黑、5 紅，插入 2');
  await beat(tok, 2600);
  bstIns(t, 2, 'R'); tv.sync(2);
  say('2 接在黑色的 3 下面', OK('還有空房間，不用 restructure'));
  await beat(tok, 2800);
  say('看爸爸顏色就能當場決定', '不必像 AVL 往上找到失衡點才轉');
  await beat(tok, 3000);
  say('所以紅黑樹常比 AVL 有效率', '');
  await beat(tok, 2400);
}]);

// ═════════ 26. 紅黑樹的高度也有保證 ═════════
FRAG.push(['avllin-rb-height', '紅黑樹高度 ≤ 2 倍 2-3-4 樹高度', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t4 = T4({ cx: -3.6, top: 5.8, dy: 1.7, kw: 0.6, gap: 0.36 });
  t4.root = N4([4], [N4([2], [N4([1]), N4([3])]), N4([6, 8], [N4([5]), N4([7]), N4([9, 10])])]); t4.sync();
  const t = rbTree([[4, 'B'], [2, 'B'], [1, 'B'], [3, 'B'], [6, 'B'], [5, 'B'], [8, 'R'], [7, 'B'], [9, 'B'], [10, 'R']]);
  const tv = TV(t, { rb: true, cx: 3.3, dx: 0.56, dy: 1.05, top: 6.0, sz: 0.5 }); tv.sync();
  tag('2-3-4：高 3', 'ptr', -3.6, 6.9, 0); const hr = tag('紅黑樹', 'ptr', 3.3, 6.9, 0);
  say('Q：紅黑樹的高度也有保證嗎？', '');
  await beat(tok, 2400);
  say('每棵紅黑樹都對應一棵 2-3-4 樹', '1…10 那棵（6 8、9 10 讓小的當代表）');
  await beat(tok, 3000);
  t4.glowN(t4.node(8), GOLD); for (const k of [6, 8]) glow(tv.c(k), GOLD);
  say('每個 2-3-4 node 最多拆成兩層', '');
  await beat(tok, 2600);
  t4.glowN(t4.node(8), null); for (const k of [6, 8]) glow(tv.c(k), null);
  for (const k of [4, 6, 8, 9, 10]) { glow(tv.c(k), GREEN); await beat(tok, 450); }
  txt(hr, '紅黑樹：高 5 ≤ 2 × 3');
  say('最長路徑 4→6→8→9→10', 'h(紅黑) ≤ 2 · h(2-3-4)');
  await beat(tok, 3000);
  say('log n 與 2 log n 只差常數', OK('紅黑樹高度一樣有保證'));
  await beat(tok, 3000);
}]);
  }

  // ═══ bst63.js ═══
  {
// ─── 63Dp2MjLlUo：交大彭文志 Lec25 Search Structures (2/3) ───
// Optimal BST（Horowitz 的 do/if/while、do/if/return/while 例子）→ m-way / B-tree → 2-3 tree insert / delete
const { V3, fresh, tag, cube, move, fly, kill, glow, txt, line, ghostBox, GOLD, GREEN, RED, GRAY, MONO } = K;
const B63 = '#4b9ee2', F63 = '#b9ad98', O63 = '#dd8238';

// extended BST：spec = [key, left, right]，null = fail node（方塊）。依 inorder 排 x。
function ext63(spec, o) {
  const R = { nodes: {}, fails: [], all: [] };
  let idx = 0;
  const place = (s, d) => {
    if (!s) return o.noFail ? null : { fail: true, d, i: idx++ };
    const L = place(s[1], d + 1); const me = { key: s[0], d, i: idx++ }; me.L = L; me.R = place(s[2], d + 1); return me;
  };
  const root = place(spec, 0); const n = idx;
  const X = (i) => o.x + (i - (n - 1) / 2) * o.sx, Y = (d) => o.y - d * o.dy;
  const sz = o.sz || 0.9, fs = o.fs || 0.6;
  const draw = (t, px, py) => {
    if (!t) return;
    const x = X(t.i), y = Y(t.d);
    if (px !== undefined) R.all.push(line(px, py, x, y));
    if (t.fail) { const m = cube('', F63, [fs, fs * 0.5, fs], x, y); m.userData.lv = t.d + 1; R.fails.push(m); R.all.push(m); return; }
    const m = cube(t.key, o.col || B63, [sz, sz * 0.75, sz], x, y); m.userData.lv = t.d + 1; R.nodes[t.key] = m; R.all.push(m);
    draw(t.L, x, y); draw(t.R, x, y);
  };
  draw(root); return R;
}
// cost = Σ p·level(a) + Σ q·(level(E) − 1)，P、Q 依 inorder
function cost63(spec, P, Q) {
  let ki = 0, fi = 0, c = 0;
  const w = (s, d) => { if (!s) { c += Q[fi++] * d; return; } w(s[1], d + 1); c += P[ki++] * (d + 1); w(s[2], d + 1); };
  w(spec, 0); return c;
}
const ptr63 = (m, t, cur) => { cur.position.set(m.position.x, m.position.y + 0.85, m.position.z); txt(cur, t); };

// Horowitz Fig 10.1：左 = for/do/while/return/if，右 = 平衡的那棵
const FIG1L = ['for', ['do', null, null], ['while', ['return', ['if', null, null], null], null]];
const FIG1R = ['for', ['do', null, null], ['return', ['if', null, null], ['while', null, null]]];

FRAG.push(['bst63-worst-compare', 'Optimal BST：用 worst case 比較次數評估', async (tok) => {
  fresh([0, 3.2, 13], [0, 2.6, 0]);
  const L = ext63(FIG1L, { x: -3.6, y: 5.4, sx: 1.05, dy: 1.4, noFail: true });
  const R = ext63(FIG1R, { x: 3.6, y: 5.4, sx: 1.15, dy: 1.7, noFail: true });
  tag('tree 1', 'idx', -3.6, 6.6); tag('tree 2', 'idx', 3.6, 6.6);
  const cur = tag('', 'ptr alt', 0, 8);
  say('什麼樣的 BST 才算 optimal？', '先看：最壞情況要幾次 comparison');
  await beat(tok, 2600);
  for (const [T, path, nm] of [[L, ['for', 'while', 'return', 'if'], '左樹'], [R, ['for', 'return', 'if'], '右樹']]) {
    let k = 0;
    for (const key of path) {
      k++; const m = T.nodes[key]; glow(m, key === 'if' ? GREEN : GOLD); ptr63(m, 'if ? ' + key, cur);
      say(nm + ' search if：第 ' + k + ' 次比較', 'if 跟 ' + key + ' 比');
      await beat(tok, 900);
    }
    say(nm + '找 if 要 ' + path.length + ' 次', path.join(' → '));
    await beat(tok, 2000);
  }
  say('右樹較矮：worst case 較好', 'worst case 比較次數 = 樹高');
  await beat(tok, 2400);
  say('但 worst case 不一定常發生', 'cost 要考慮每個字被搜尋的機率');
  await beat(tok, 2800);
}]);

FRAG.push(['bst63-ext-path', 'Internal / External path 與 fail node', async (tok) => {
  fresh([0, 3, 13.5], [0, 2.8, 0]);
  const T = ext63(FIG1L, { x: 0, y: 5.8, sx: 1.05, dy: 1.3, sz: 0.85, fs: 0.6 });
  const cur = tag('', 'ptr alt', 0, 8);
  say('方塊 = fail node：搜尋失敗落在這裡', '實際上不存在，用來 model 失敗的搜尋');
  for (const f of T.fails) glow(f, GOLD);
  await beat(tok, 2600);
  for (const f of T.fails) glow(f, null);
  for (const key of ['for', 'do']) {
    glow(T.nodes[key], GOLD); ptr63(T.nodes[key], 'cc ? ' + key, cur);
    say('找 cc：cc < ' + key + '，往左', '');
    await beat(tok, 1100);
  }
  glow(T.fails[0], RED); ptr63(T.fails[0], 'fail', cur);
  say('落到 do 左邊的 fail node', 'external path 長度 = 2（2 條 edge）');
  await beat(tok, 2400);
  for (const m of Object.values(T.nodes)) glow(m, null); glow(T.fails[0], null); cur.position.set(0, 9, 0);
  let I = 0; const terms = [];
  for (const key of ['for', 'do', 'while', 'return', 'if']) {
    const m = T.nodes[key], d = m.userData.lv - 1; I += d; terms.push(d);
    tag(String(d), 'ptr', m.position.x + 0.6, m.position.y + 0.55); glow(m, GREEN);
    say('I：tree node 到 root 的 edge 數', 'I = ' + terms.join(' + ') + (terms.length === 5 ? ' = ' + I : ''));
    await beat(tok, 800);
  }
  await beat(tok, 1400);
  let E = 0; const et = [];
  for (const f of T.fails) {
    const d = f.userData.lv - 1; E += d; et.push(d);
    tag(String(d), 'idx', f.position.x, f.position.y - 0.55); glow(f, RED);
    say('E：root 到每個 fail node 的 edge 數', 'E = ' + et.join(' + ') + (et.length === T.fails.length ? ' = ' + E : ''));
    await beat(tok, 700);
  }
  await beat(tok, 1600);
  say('補充：extended tree 有 E = I + 2n', E + ' = ' + I + ' + 2 × 5');
  await beat(tok, 3000);
}]);

// Horowitz Fig 10.12：do < if < while 的 5 棵 BST
const TA63 = ['while', ['if', ['do', null, null], null], null];
const FIVE63 = [['a', TA63], ['b', ['if', ['do', null, null], ['while', null, null]]], ['c', ['do', null, ['if', null, ['while', null, null]]]],
  ['d', ['while', ['do', null, ['if', null, null]], null]], ['e', ['do', null, ['while', ['if', null, null], null]]]];

FRAG.push(['bst63-cost-terms', 'BST cost：Σ p·level + Σ q·(level − 1)', async (tok) => {
  fresh([0, 3, 12], [0, 3, 0]);
  const T = ext63(TA63, { x: 0, y: 5.8, sx: 1.3, dy: 1.35 });
  const cur = tag('', 'ptr alt', 0, 9);
  say('每個字 ai 被搜尋的機率是 pi', '成功：Σ pi × level(ai)');
  for (const k of ['while', 'if', 'do']) { const m = T.nodes[k]; tag('p × ' + m.userData.lv, 'ptr', m.position.x + 1.1, m.position.y + 0.2); glow(m, GREEN); await beat(tok, 700); }
  await beat(tok, 1600);
  say('pi 越大，越該放在靠近 root', 'level 小 → cost 低');
  await beat(tok, 2400);
  say('搜尋樹中沒有的字 → 落到 fail node', '機率 qi');
  for (const f of T.fails) glow(f, GOLD);
  await beat(tok, 2200);
  for (const f of T.fails) glow(f, null);
  for (const k of ['while', 'if', 'do']) {
    glow(T.nodes[k], GOLD); ptr63(T.nodes[k], 'cc ? ' + k, cur);
    say('例：找 cc', '跟 ' + k + ' 比');
    await beat(tok, 900);
  }
  glow(T.fails[0], RED);
  say('到 leaf do 就知道失敗，不會走到方塊', '比 3 次 = level(E0) − 1 = 4 − 1');
  await beat(tok, 2800);
  for (const f of T.fails) tag('q × ' + (f.userData.lv - 1), 'idx', f.position.x, f.position.y - 0.55);
  say('失敗那項要減 1', '失敗：Σ qi × (level(Ei) − 1)');
  await beat(tok, 2400);
  say('cost = 成功 + 失敗', 'Σ pi·level(ai) + Σ qi·(level(Ei) − 1)');
  await beat(tok, 3000);
}]);

async function five63(tok, P, Q, fmt, intro, introF) {
  fresh([0, 3, 13.5], [0, 2.6, 0]);
  const Ts = FIVE63.map(([nm, s], i) => { const x = -5.6 + i * 2.8; tag('(' + nm + ')', 'idx', x, 6.3); return { nm, s, x, T: ext63(s, { x, y: 5.4, sx: 0.36, dy: 1.15, sz: 0.48, fs: 0.3 }) }; });
  say(intro, introF);
  await beat(tok, 2800);
  let best = null;
  for (const t of Ts) {
    const c = cost63(t.s, P, Q); t.c = c;
    tag('cost = ' + fmt(c), 'ptr', t.x, 1.1);
    for (const m of t.T.all) if (m.material && m.material.emissive) glow(m, GOLD);
    say('tree ' + t.nm + ' 的 cost', fmt(c));
    await beat(tok, 1100);
    for (const m of t.T.all) if (m.material && m.material.emissive) glow(m, null);
    if (!best || c < best.c - 1e-9) best = t;
  }
  for (const m of Object.values(best.T.nodes)) glow(m, GREEN);
  return best;
}
FRAG.push(['bst63-five-uniform', 'do / if / while 五棵 BST：p = q = 1/7', async (tok) => {
  const best = await five63(tok, [1, 1, 1], [1, 1, 1, 1], (c) => c + '/7', '3 個字可組成 5 棵 BST', 'pi = qi = 1/7（3 個字 + 4 個 fail node）');
  say('tree a 怎麼算？', '成功 (1+2+3)/7 + 失敗 (3+3+2+1)/7 = 15/7');
  await beat(tok, 2800);
  say('最小的是 tree ' + best.nm + '：optimal', 'cost(' + best.nm + ') = 13/7，其餘都是 15/7');
  await beat(tok, 3000);
}]);
FRAG.push(['bst63-five-nonuniform', '機率不 uniform：tree c 變成最佳', async (tok) => {
  const best = await five63(tok, [0.5, 0.1, 0.05], [0.15, 0.1, 0.05, 0.05], (c) => String(+c.toFixed(2)),
    '機率不 uniform：p = 0.5, 0.1, 0.05', 'q = 0.15, 0.1, 0.05, 0.05');
  say('最小 cost 1.5：tree ' + best.nm + ' 是最佳解', 'do 被搜尋最多 → 放 root');
  await beat(tok, 2800);
  say('機率給定、不隨時間變：static set', '真實搜尋的字是 dynamic（思考題）');
  await beat(tok, 3000);
}]);

FRAG.push(['bst63-brute-force', '暴力法：列出所有 BST 再算 cost', async (tok) => {
  fresh([0, 3, 13], [0, 2.8, 0]);
  const minis = [];
  for (const [i, [nm, s]] of FIVE63.entries()) {
    const x = -5.6 + i * 2.8;
    const T = ext63(s, { x, y: 6, sx: 0.55, dy: 0.8, sz: 0.45, noFail: true }); minis.push({ T, s, x, nm });
    say('step 1：產生 n 個字的所有 BST', 'n = 3 → ' + (i + 1) + ' 棵');
    await beat(tok, 600);
  }
  await beat(tok, 1400);
  const cl = [];
  for (const t of minis) { cl.push(tag(cost63(t.s, [1, 1, 1], [1, 1, 1, 1]) + '/7', 'ptr', t.x, 3.5)); }
  say('step 2：每棵都算 cost，選最小', '這就是暴力法');
  await beat(tok, 1600);
  for (const m of Object.values(minis[1].T.nodes)) glow(m, GREEN);
  await beat(tok, 1600);
  for (const t of minis) for (const m of t.T.all) kill(m);
  cl.forEach(kill);
  const cat = [1, 2, 5, 14, 42, 132, 429];
  for (const [i, c] of cat.entries()) {
    const h = 0.4 + Math.log2(c) * 0.42, x = -4.5 + i * 1.5;
    cube(c, i === 2 ? GREEN : O63, [0.9, h, 0.9], x, h / 2, 0, 4);
    tag('n=' + (i + 1), 'idx', x, -0.4);
    say('n 一變大，BST 的數量爆炸', 'n = ' + (i + 1) + '：' + c + ' 棵');
    await beat(tok, 700);
  }
  say('光 step 1 就做不完', '補充：C(n) = (2n)! / (n!(n+1)!)，n = 10 → 16796');
  await beat(tok, 3000);
  say('改用 dynamic programming', '用小 subtree 的最佳解組出大樹');
  await beat(tok, 2800);
}]);

FRAG.push(['bst63-tij-def', 'DP 符號：Tij、wij、cij、rij', async (tok) => {
  fresh([0, 2.6, 12], [0, 1.6, 0]);
  const A = [], Qs = [];
  for (let i = 0; i <= 4; i++) {
    Qs.push(cube('q' + i, F63, [0.8, 0.4, 0.8], -4 + i * 2, 0.3, 0, 3));
    if (i < 4) A.push(cube('a' + (i + 1), B63, [1, 0.8, 1], -3 + i * 2, 2.2, 0, 3));
    await beat(tok, 300);
  }
  say('a1 < a2 < … < an 已排序', 'fail node q0 … qn 夾在它們之間');
  await beat(tok, 2400);
  let box = ghostBox('#c58a10', 5, 3.2, 1.6); box.position.set(0, 1.3, 0);
  let bt = tag('T13', 'ptr alt', 0, 3.3);
  [A[1], A[2], Qs[1], Qs[2], Qs[3]].forEach((m) => glow(m, GOLD));
  say('Tij：含 a(i+1) … aj 的 optimal BST', 'T13 = {a2, a3}，fail node q1、q2、q3');
  await beat(tok, 3000);
  say('wij：裡面所有 p 與 q 加總', 'w13 = p2 + p3 + q1 + q2 + q3');
  await beat(tok, 2800);
  say('cij = Tij 的 cost，rij = Tij 的 root', 'weight 只加機率；cost 還要乘 level');
  await beat(tok, 2800);
  [A[1], A[2], Qs[1], Qs[3]].forEach((m) => glow(m, null));
  kill(box); kill(bt);
  box = ghostBox('#c58a10', 1.4, 1.2, 1.4); box.position.set(0, 0.3, 0); bt = tag('T22', 'ptr alt', 0, 1.2);
  say('Tii：沒有字，只有 fail node qi', 'wii = qi，cii = 0，rii = 0');
  await beat(tok, 2800);
  glow(Qs[2], null); kill(box); kill(bt);
  box = ghostBox('#0f5a3a', 9.4, 3.4, 1.8); box.position.set(0, 1.3, 0); bt = tag('T04', 'ptr alt', 0, 3.4);
  for (const m of A.concat(Qs)) glow(m, GREEN);
  say('目標是 T0n（這裡 n = 4）', 'cost c0n、weight w0n、root r0n');
  await beat(tok, 3000);
}]);

FRAG.push(['bst63-recurrence', '遞迴式：選 ak 當 root，試每個 k', async (tok) => {
  fresh([0, 3, 12.5], [0, 2.4, 0]);
  const A = [1, 2, 3, 4].map((k) => cube('a' + k, B63, [1, 0.8, 1], -4.5 + k * 1.8, 1, 0, 3));
  const deco = [];
  const clear = () => { deco.splice(0).forEach(kill); };
  async function split(k, cap, f, ms) {
    clear();
    A.forEach((m, idx) => {
      const kk = idx + 1;
      if (kk === k) { move(m, 0, 5.2, 0); glow(m, GOLD); return; }
      glow(m, null);
      if (kk < k) move(m, -4.6 + idx * 1.2, 2.4, 0); else move(m, 2.2 + (kk - k - 1) * 1.2, 2.4, 0);
    });
    const lb = ghostBox('#4b9ee2', 4, 1.6, 1.4); lb.position.set(-3.4, 2.4, 0);
    const rb = ghostBox('#4b9ee2', 4, 1.6, 1.4); rb.position.set(3.4, 2.4, 0);
    deco.push(lb, rb, line(0, 5.2, -3.4, 3.2), line(0, 5.2, 3.4, 3.2),
      tag('L = T0,' + (k - 1), 'ptr', -3.4, 1.1), tag('R = T' + k + ',4', 'ptr', 3.4, 1.1));
    say(cap, f);
    await beat(tok, ms);
  }
  say('Tij 的 root 是 ak：i < k ≤ j', '例：T04，n = 4');
  await beat(tok, 2200);
  await split(2, 'ak 當 root，左右各長一棵 subtree', '左 a(i+1)…a(k−1)，右 a(k+1)…aj', 2600);
  say('subtree 每個點都往下多一層', 'cij = pk + cL + cR + wL + wR');
  await beat(tok, 2800);
  say('pk + wL + wR 剛好是 wij', 'cij = wij + c(i,k−1) + c(k,j)');
  await beat(tok, 2800);
  for (const k of [1, 2, 3, 4]) await split(k, 'root 不知道選誰：每個 k 都試', 'k = ' + k + '：c0,' + (k - 1) + ' + c' + k + ',4', 1700);
  say('wij 與 k 無關，取最小的那個 k', 'cij = wij + min(c(i,k−1) + c(k,j))');
  await beat(tok, 3200);
}]);

FRAG.push(['bst63-t02-verify', 'T02 以 a2 為 root：驗證 cost 公式', async (tok) => {
  fresh([0, 3, 12], [0, 2.6, 0]);
  const T = ext63(['a2', ['a1', null, null], null], { x: -1.5, y: 5.4, sx: 1.6, dy: 1.6 });
  T.fails.forEach((f, i) => tag('q' + i, 'idx', f.position.x, f.position.y - 0.55));
  say('T02：a1、a2 與 q0、q1、q2', '假設 root = a2');
  await beat(tok, 2600);
  const lb = ghostBox('#4b9ee2', 3.8, 2.8, 1.4); lb.position.set(-3.1, 3.0, 0);
  const rb = ghostBox('#dd8238', 1.2, 1.2, 1.2); rb.position.set(1.7, 3.8, 0);
  tag('L = T01', 'ptr', -3.1, 1.1); tag('R = T22', 'ptr', 1.7, 2.8);
  say('cost(T02) = p2 + cL + cR + wL + wR', 'wL = q0 + p1 + q1，wR = q2');
  await beat(tok, 3000);
  say('cL = c01 = p1 + q0 + q1，cR = c22 = 0', '');
  await beat(tok, 2600);
  say('代進去整理', 'cost(T02) = 2p1 + p2 + 2q0 + 2q1 + q2');
  await beat(tok, 3000);
  kill(lb); kill(rb);
  for (const [k, m] of Object.entries(T.nodes)) { tag('level ' + m.userData.lv, 'ptr alt', m.position.x + 1.2, m.position.y + 0.3); glow(m, GOLD); }
  for (const f of T.fails) { tag('×' + (f.userData.lv - 1), 'ptr alt', f.position.x + 0.7, f.position.y + 0.3); glow(f, GOLD); }
  say('直接用 level 算一次', 'p1·2 + p2·1 + q0·2 + q1·2 + q2·1');
  await beat(tok, 3000);
  for (const m of T.all) if (m.material && m.material.emissive) glow(m, GREEN);
  say('一模一樣：遞迴把 level 乘進去了', '<span class="ok">公式裡不用出現 level</span>');
  await beat(tok, 3000);
}]);

// Horowitz 例：(a1..a4) = (do, if, return, while)，p = 3 3 1 1，q = 2 3 1 1 1
const P63 = [0, 3, 3, 1, 1], Q63 = [2, 3, 1, 1, 1], N63 = ['do', 'if', 'return', 'while'];
const DP63 = (() => {
  const n = 4, w = [], c = [], r = [], cand = [];
  for (let i = 0; i <= n; i++) { w[i] = []; c[i] = []; r[i] = []; cand[i] = []; w[i][i] = Q63[i]; c[i][i] = 0; r[i][i] = 0; }
  for (let d = 1; d <= n; d++) for (let i = 0; i + d <= n; i++) {
    const j = i + d; w[i][j] = w[i][j - 1] + P63[j] + Q63[j]; let best = Infinity, bk = 0; cand[i][j] = [];
    for (let k = i + 1; k <= j; k++) { const v = c[i][k - 1] + c[k][j]; cand[i][j].push([k, c[i][k - 1], c[k][j], v]); if (v < best) { best = v; bk = k; } }
    c[i][j] = w[i][j] + best; r[i][j] = bk;
  }
  return { w, c, r, cand };
})();
const TX63 = (i) => -4.6 + i * 2.5, TY63 = (d) => 4.9 - d * 1.15;
function cell63(i, j, drop, col) {
  const m = cube('', col || '#efe4cf', [2.3, 0.95, 0.25], TX63(i), TY63(j - i), 0, drop ? 3 : 0);
  const l = lab.label('T' + i + j + ' w=' + DP63.w[i][j] + '\nc=' + DP63.c[i][j] + ' r=' + DP63.r[i][j], '');
  Object.assign(l.element.style, MONO); l.position.set(0, 0, 0.2); m.add(l); return m;
}
function table63(rows) {
  tag('a = do if return while　p = 3 3 1 1　q = 2 3 1 1 1', 'ptr', 0, 6.3);
  for (let d = 0; d <= 4; d++) tag((d) + ' 字', 'idx', -6.4, TY63(d));
  for (let i = 0; i <= 4; i++) tag('i=' + i, 'idx', TX63(i), 5.65);
  const cells = {};
  for (let d = 0; d <= rows; d++) for (let i = 0; i + d <= 4; i++) cells[i + ',' + (i + d)] = cell63(i, i + d, false);
  return cells;
}
const candTxt63 = (i, j) => DP63.cand[i][j].map(([k, a, b]) => 'k=' + k + '：' + a + '+' + b).join('，');

FRAG.push(['bst63-obst-row1', 'Optimal BST 表：第 0、1 列', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  table63(-1);
  say('do、if、return、while 已依字母排序', 'p = 3 3 1 1，q = 2 3 1 1 1（次數）');
  await beat(tok, 2800);
  say('橫軸 i，縱軸 = 樹裡有幾個字', '每格 Tij 記 w、c、r');
  await beat(tok, 2200);
  for (let i = 0; i <= 4; i++) { cell63(i, i, true); await beat(tok, 300); }
  say('第 0 列：沒有字，只剩 fail node', 'wii = qi，cii = 0，rii = 0');
  await beat(tok, 2400);
  for (let i = 0; i < 4; i++) {
    cell63(i, i + 1, true, '#f6d9a8');
    say('T' + i + (i + 1) + '：只有 ' + N63[i] + '，左右是 q' + i + '、q' + (i + 1),
      'w = ' + Q63[i] + '+' + P63[i + 1] + '+' + Q63[i + 1] + ' = ' + DP63.w[i][i + 1] + '，c = w + 0 + 0 = ' + DP63.c[i][i + 1]);
    await beat(tok, 2000);
  }
  say('一個字的樹，root 就是它自己', 'r(i,i+1) = i + 1');
  await beat(tok, 2600);
}]);

FRAG.push(['bst63-obst-row2', 'Optimal BST 表：第 2 列（T02 取最小）', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  table63(1);
  say('第 2 列：樹裡有兩個字', 'T02 = {do, if}，w02 = 3+3 + 2+3+1 = 12');
  await beat(tok, 2800);
  const t1 = ext63(['do', null, ['if', null, null]], { x: -2.2, y: 1.9, sx: 0.9, dy: 0.9, sz: 0.55, noFail: true });
  const t2 = ext63(['if', ['do', null, null], null], { x: 2.8, y: 1.9, sx: 0.9, dy: 0.9, sz: 0.55, noFail: true });
  const l1 = tag('k=1：c00 + c12 = 0 + 7', 'ptr', -2.2, 0.0), l2 = tag('k=2：c01 + c22 = 8 + 0', 'ptr', 2.8, 0.0);
  say('兩種 root：do 或 if', '比較 c(0,k−1) + c(k,2)');
  await beat(tok, 3000);
  for (const m of Object.values(t1.nodes)) glow(m, GREEN);
  say('7 比 8 小：選 do 當 root', 'c02 = 12 + 7 = 19，r02 = 1');
  await beat(tok, 2600);
  cell63(0, 2, true, '#bfe3cf');
  await beat(tok, 1400);
  t1.all.concat(t2.all).forEach(kill); kill(l1); kill(l2);
  for (const [i, j] of [[1, 3], [2, 4]]) {
    cell63(i, j, true, '#f6d9a8');
    say('T' + i + j + '：每個 k 都試，取最小', candTxt63(i, j) + ' → c' + i + j + ' = ' + DP63.w[i][j] + ' + ' + (DP63.c[i][j] - DP63.w[i][j]) + ' = ' + DP63.c[i][j] + '，r' + i + j + ' = ' + DP63.r[i][j]);
    await beat(tok, 2800);
  }
  await beat(tok, 1200);
}]);

FRAG.push(['bst63-obst-final', 'Optimal BST 表：T04 與最後的樹', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  table63(2);
  for (const [i, j] of [[0, 3], [1, 4]]) {
    cell63(i, j, true, '#f6d9a8');
    say('T' + i + j + '：每個 k 都試，取最小', candTxt63(i, j) + ' → c' + i + j + ' = ' + DP63.w[i][j] + ' + ' + (DP63.c[i][j] - DP63.w[i][j]) + ' = ' + DP63.c[i][j] + '，r = ' + DP63.r[i][j]);
    await beat(tok, 2800);
  }
  say('答案在最下面那格 T04', 'c04 = w04 + min(c0,k−1 + ck,4)，w04 = 16');
  await beat(tok, 2600);
  const cs = DP63.cand[0][4], ls = [];
  let bi = 0;
  cs.forEach((c, n) => { if (c[3] < cs[bi][3]) bi = n; });
  for (const [n, [k, a, b, v]] of cs.entries()) {
    ls.push(tag('k=' + k + '：' + a + ' + ' + b + ' = ' + v, 'ptr', 3.0, 2.2 - n * 0.6));
    say('試 k = ' + k, 'c0,' + (k - 1) + ' + c' + k + ',4 = ' + v);
    await beat(tok, 900);
  }
  ls[bi].element.className = 'lab-label ptr alt';
  say('最小 16 在 k = 2', 'c04 = 16 + 16 = 32，r04 = 2');
  cell63(0, 4, true, '#bfe3cf');
  await beat(tok, 2800);
  fresh([0, 3, 11], [0, 3, 0]);
  const pos = { if: [0, 5.4], do: [-2.4, 3.6], return: [2.4, 3.6], while: [4.2, 1.8] };
  const par = { do: 'if', return: 'if', while: 'return' };
  for (const [w, cap, f] of [['if', 'r04 = 2 → if 當 root', '左 T01、右 T24'], ['do', 'r01 = 1 → do', 'T01 只有 do'],
    ['return', 'r24 = 3 → return', '右邊剩 T34'], ['while', 'r34 = 4 → while', '']]) {
    const [x, y] = pos[w];
    if (par[w]) line(pos[par[w]][0], pos[par[w]][1], x, y);
    cube(w, B63, [1.1, 0.8, 1], x, y, 0, 3);
    say(cap, f);
    await beat(tok, 1500);
  }
  say('從小表一路推到大表：Dynamic Programming', '<span class="ok">optimal cost = 32</span>');
  await beat(tok, 3000);
}]);

FRAG.push(['bst63-mway', 'm-way search tree：一個 node 多個 key', async (tok) => {
  fresh([0, 3, 12], [0, 3, 0]);
  const Ks = ['K1', 'K2', 'K3'].map((k, i) => cube(k, B63, [1.3, 0.8, 1], -1.5 + i * 1.5, 5.2, 0));
  const sx = [-4.6, -1.55, 1.55, 4.6], rng = ['< K1', 'K1 ~ K2', 'K2 ~ K3', '> K3'];
  sx.forEach((x, i) => {
    const px = -2.25 + i * 1.5;
    tag('A' + i, 'idx', px, 4.45); line(px, 4.7, x, 2.3);
    const g = ghostBox('#4b9ee2', 2.4, 1.4, 1.4); g.position.set(x, 1.6, 0); tag(rng[i], 'idx', x, 1.6);
  });
  say('m-way：一個 node 最多 m 個 subtree', 'K1 < K2 < … < Kn，pointer A0 … An，n < m');
  await beat(tok, 3000);
  const x = cube('x', O63, [0.8, 0.8, 0.8], 0, 7.2, 0);
  say('搜尋 x：先看 node 內有沒有 key = x', '有就直接回報');
  await beat(tok, 2000);
  for (const [i, m] of Ks.entries()) {
    glow(m, GOLD); move(x, m.position.x, 6.4, 0);
    say('x 跟 ' + ['K1', 'K2', 'K3'][i] + ' 比', i < 2 ? 'x > K' + (i + 1) : 'x < K3');
    await beat(tok, 1100); glow(m, null);
  }
  say('沒有相等：看 x 落在哪個區間', 'K2 < x < K3');
  await beat(tok, 1800);
  move(x, 1.55, 2.6, 0);
  say('往兩個 key 之間的 pointer 走', 'Ki < x < Ki+1 → 走 Ai（這裡是 A2）');
  await beat(tok, 2600);
  say('高度 h 的 m-way search tree', 'node 最多 Σ m^i = (m^h − 1)/(m − 1) 個');
  await beat(tok, 3000);
}]);

// order 4 的 B-tree（投影片例子；只畫到搜尋 30 會經過的部分）
function btree63() {
  const R = { keys: {}, deco: [] };
  const node = (keys, cx, y, col) => keys.map((k, i) => { const m = cube(k, col || B63, [1, 0.7, 0.9], cx + (i - (keys.length - 1) / 2) * 1.1, y, 0); R.keys[k] = m; return m; });
  R.root = node([21, 48, 72], 0, 5.8);
  R.lv2 = [node(['…'], -5.2, 3.8, GRAY), node([25, 31, 41], -1.8, 3.8), node(['…'], 1.9, 3.8, GRAY), node(['…'], 5.2, 3.8, GRAY)];
  [-5.2, -1.8, 1.9, 5.2].forEach((x, i) => line(-1.65 + i * 1.1, 5.45, x, 4.15));
  R.leaf = node([26, '…'], -2.7, 1.8, '#9b7ef4');
  [-4.4, -2.7, -1.0, 0.5].forEach((x, i) => { line(-3.45 + i * 1.1, 3.45, x, 2.15); if (i !== 1) cube('…', GRAY, [0.8, 0.6, 0.8], x, 1.8, 0); });
  R.strip = ghostBox('#7a1010', 13, 0.4, 1.2); R.strip.position.set(0, 0.4, 0);
  tag('fail nodes', 'idx', 5.4, 0.9);
  return R;
}
FRAG.push(['bst63-btree-def', 'B-tree 的定義（order m）', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const B = btree63();
  say('B-tree：特殊的 m-way search tree', 'm = order，這棵是 order 4');
  await beat(tok, 2600);
  B.root.forEach((m) => glow(m, GOLD));
  say('① root 至少 2 個 child', 'root 有 21、48、72 → 4 個 pointer');
  await beat(tok, 2800);
  B.root.forEach((m) => glow(m, null));
  B.lv2[1].forEach((m) => glow(m, GOLD));
  say('② 其他 internal node 至少 ⌈m/2⌉ 個 child', 'order 4 → 至少 ⌈4/2⌉ = 2 個 pointer');
  await beat(tok, 2800);
  B.lv2[1].forEach((m) => glow(m, null));
  say('order 3 就是至少 ⌈3/2⌉ = 2 個 child', '');
  await beat(tok, 2200);
  say('③ 所有 fail node 都在同一個 level', '樹永遠是平的');
  await beat(tok, 3000);
}]);

FRAG.push(['bst63-btree-search30', 'B-tree 搜尋 30', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const B = btree63();
  const x = cube(30, O63, [0.8, 0.8, 0.8], 0, 7.3, 0);
  say('在這棵 order 4 的 B-tree 找 30', '');
  await beat(tok, 2000);
  for (const k of [21, 48, 72]) {
    glow(B.keys[k], GOLD); move(x, B.keys[k].position.x, 6.7, 0);
    say('root：30 跟 ' + k + ' 比', k === 21 ? '30 > 21' : (k === 48 ? '30 < 48' : '30 < 72'));
    await beat(tok, 900); glow(B.keys[k], null);
  }
  say('30 落在 21 和 48 之間', '走第 2 個 pointer');
  move(x, -1.8, 4.7, 0);
  await beat(tok, 2000);
  for (const k of [25, 31, 41]) {
    glow(B.keys[k], GOLD);
    say('30 跟 ' + k + ' 比', k === 25 ? '30 > 25' : '30 < ' + k);
    await beat(tok, 900); glow(B.keys[k], null);
  }
  say('30 落在 25 和 31 之間', '往下走');
  move(x, -2.7, 2.7, 0);
  await beat(tok, 2000);
  glow(B.leaf[0], RED);
  say('這個 node 也沒有 30', '再往下就是 fail node');
  await beat(tok, 1800);
  move(x, -2.7, 0.9, 0); glow(x, RED);
  say('回報：找不到', '每一層只走一個 node');
  await beat(tok, 2800);
}]);

FRAG.push(['bst63-btree-fat', '為什麼用 B-tree：矮胖＝少讀 disk', async (tok) => {
  fresh([0, 3, 13], [0, 3, 0]);
  const chain = [];
  for (let d = 0; d < 7; d++) {
    const x = -5 + (d % 2) * 1.2, y = 6 - d * 0.95;
    if (d) line(-5 + ((d - 1) % 2) * 1.2, y + 0.95, x, y);
    chain.push(cube('', B63, [0.6, 0.5, 0.6], x, y, 0, 2));
    await beat(tok, 250);
  }
  tag('⋮', 'ptr', -4.4, -0.4);
  say('binary tree：每個 node 只有 2 個 child', 'n = 10⁶ → 高度 ≈ log₂ n ≈ 20');
  await beat(tok, 2800);
  say('AVL 雖然 balanced，key 很多時還是很高', '高又瘦 → 走很多層');
  await beat(tok, 2600);
  const root = [21, 48, 72].map((k, i) => cube(k, B63, [1, 0.7, 0.9], 2.6 + (i - 1) * 1.1, 5.6, 0, 3));
  const rg = ghostBox('#c58a10', 3.8, 1.1, 1.3); rg.position.set(2.6, 5.6, 0);
  [-0.6, 1.6, 3.6, 5.8].forEach((x) => {
    line(2.6, 5.2, x, 3.4);
    cube('', '#9b7ef4', [1.8, 0.6, 0.9], x, 3.0, 0, 3);
  });
  tag('disk block（page）', 'idx', 2.6, 6.5);
  say('B-tree：長胖、變矮，很快到 leaf', 'm 通常 32～256 → 只要 3～4 層');
  await beat(tok, 3000);
  say('每個 node = 一個 disk block', '少走一層 = 少讀一次 disk');
  await beat(tok, 2800);
  const x = cube(30, O63, [0.7, 0.7, 0.7], 2.6, 7.2, 0);
  glow(root[1], GOLD);
  say('代價：node 內要比的 key 變多', '用 binary search：先跟中間的 48 比');
  await beat(tok, 2400);
  glow(root[1], null); glow(root[0], GOLD); move(x, 1.5, 6.7, 0);
  say('30 < 48 → 再跟 21 比', '30 > 21 → 落在 21 ~ 48 之間');
  await beat(tok, 2600);
  glow(root[0], null); move(x, 2.05, 6.7, 0);
  await beat(tok, 2000);
}]);

FRAG.push(['bst63-btree-split-merge', 'B-tree insert 溢位 split、delete 不足 merge', async (tok) => {
  fresh([0, 3, 12], [0, 2.8, 0]);
  const ks = {};
  const place = (keys, cx, y) => keys.forEach((k, i) => { const x = cx + (i - (keys.length - 1) / 2) * 1.05; if (ks[k]) move(ks[k], x, y, 0); else ks[k] = cube(k, B63, [0.95, 0.7, 0.9], x, y, 0, 4); });
  place([10, 20, 30, 40, 50], 0, 2);
  say('（示意）order 6：一個 node 最多 5 個 key', 'insert：先像 search 找到該放的 leaf');
  await beat(tok, 2800);
  ks[35] = cube(35, O63, [0.95, 0.7, 0.9], 0, 6, 0);
  place([10, 20, 30, 35, 40, 50], 0, 2);
  [10, 20, 30, 35, 40, 50].forEach((k) => glow(ks[k], RED));
  say('塞第 6 個：overflow', '沒滿就直接放；滿了就要 split');
  await beat(tok, 2600);
  [10, 20, 30, 35, 40, 50].forEach((k) => glow(ks[k], null));
  place([30], 0, 4.8); place([10, 20], -3, 2); place([35, 40, 50], 2.5, 2);
  const l1 = line(-0.3, 4.45, -3, 2.35), l2 = line(0.3, 4.45, 2.5, 2.35);
  glow(ks[30], GOLD);
  say('split：中間的 key 推到上層', '上層的 index 也跟著調整');
  await beat(tok, 3000);
  glow(ks[30], null);
  fly(ks[20]); delete ks[20];
  say('delete 20：先找到再刪掉', '');
  await beat(tok, 1800);
  glow(ks[10], RED);
  say('只剩 1 個 key：child 少於 ⌈m/2⌉', 'underflow → 要合併');
  await beat(tok, 2600);
  glow(ks[10], null); kill(l1); kill(l2);
  place([10, 30, 35, 40, 50], 0, 2);
  say('跟兄弟、parent 的 key 合併（merge）', 'insert 會 split，delete 會 merge');
  await beat(tok, 3000);
}]);

// ─── 2-3 tree：key 方塊依值保存，重新排版時用 move 移過去 ───
function lay63(spec) {
  const out = []; let leaf = 0;
  const go = (s, d, par) => {
    const me = { n: s.n, k: s.k, d, par }; out.push(me);
    if (s.c && s.c.length) { const xs = s.c.map((c) => go(c, d + 1, me)); me.x = (xs[0] + xs[xs.length - 1]) / 2; } else me.x = leaf++ * 3.0;
    return me.x;
  };
  go(spec, 0, null);
  const mid = (leaf - 1) * 1.5; out.forEach((o) => { o.x -= mid; o.y = 5.4 - o.d * 2.2; });
  return out;
}
function show63(st, spec, drop) {
  st.deco.splice(0).forEach(kill);
  const seen = new Set();
  for (const o of lay63(spec)) {
    o.k.forEach((v, i) => {
      const x = o.x + (i - (o.k.length - 1) / 2) * 1.0; seen.add(v);
      if (st.cubes[v]) move(st.cubes[v], x, o.y, 0); else st.cubes[v] = cube(v, B63, [0.9, 0.7, 0.9], x, o.y, 0, drop ? 4 : 0);
    });
    if (!o.k.length) st.deco.push(cube('', GRAY, [0.9, 0.2, 0.9], o.x, o.y, 0));
    st.deco.push(tag(o.n, 'idx', o.x - Math.max(1, o.k.length) * 0.5 - 0.4, o.y + 0.1));
    if (o.par) st.deco.push(line(o.par.x, o.par.y - 0.35, o.x, o.y + 0.35));
  }
  for (const v of Object.keys(st.cubes)) if (!seen.has(+v)) { fly(st.cubes[v]); delete st.cubes[v]; }
}
const glowK63 = (st, ks, c) => ks.forEach((k) => { if (st.cubes[k]) glow(st.cubes[k], c); });
const DEL0 = { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60, 70] }, { n: 'D', k: [90, 95] }] };

FRAG.push(['bst63-23-search', '2-3 tree：B-tree order 3 與三向搜尋', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, DEL0, false);
  say('2-3 tree = order 3 的 B-tree', '2-3-4 tree = order 4，兩者都是 B-tree');
  await beat(tok, 2800);
  glowK63(st, [50, 80], GOLD);
  say('root 有 ≥ 2 個 child；leaf 都在同一層', 'internal node 至少 ⌈3/2⌉ = 2 個 child');
  await beat(tok, 2600);
  glowK63(st, [50, 80], null);
  say('n 個 key 的高度', 'log₃(n+1) ≤ h ≤ log₂(n+1)');
  await beat(tok, 2400);
  const cur = tag('', 'ptr alt', 0, 9);
  const at = (k, t) => { const m = st.cubes[k]; cur.position.set(m.position.x, m.position.y + 0.8, 0); txt(cur, t); };
  at(50, 'x = 70'); glowK63(st, [50, 80], GOLD);
  say('search 70：50 < 70 < 80', '介於兩個 key 之間 → 走中間');
  await beat(tok, 2400);
  glowK63(st, [50, 80], null); at(60, 'x = 70'); glowK63(st, [60], GOLD);
  say('到 C：70 > 60，再比第二個 key', '');
  await beat(tok, 1600);
  glowK63(st, [60], null); glowK63(st, [70], GREEN); at(70, '找到');
  say('x = key：回報找到', '');
  await beat(tok, 2000);
  glowK63(st, [70], null); at(50, 'x = 15'); glowK63(st, [50], GOLD);
  say('search 15：15 < 第一個 key', '→ 走左邊');
  await beat(tok, 2000);
  glowK63(st, [50], null); at(10, 'x = 15'); glowK63(st, [10, 20], GOLD);
  say('B：10 < 15 < 20', '中間沒有 child → <span class="no">search 失敗</span>');
  await beat(tok, 2800);
}]);

const INS0 = { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [80] }] };
const INS3 = { n: 'A', k: [20, 40], c: [{ n: 'B', k: [10] }, { n: 'D', k: [30] }, { n: 'C', k: [70, 80] }] };
FRAG.push(['bst63-23-insert-70-30', '2-3 tree insert 70、insert 30（split）', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, INS0, false);
  say('2-3 tree：A(40)、B(10, 20)、C(80)', 'insert 先用 search 找位置');
  await beat(tok, 2600);
  glowK63(st, [40], GOLD);
  say('insert 70：70 > 40 → 往 C 走', '');
  await beat(tok, 1800);
  glowK63(st, [40], null);
  show63(st, { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [70, 80] }] }, true);
  say('C 只有 1 個 key：直接放進去', 'C = 70, 80');
  await beat(tok, 2400);
  glowK63(st, [40], GOLD);
  say('insert 30：30 < 40 → 往 B 走', 'B 已經有 10、20');
  await beat(tok, 2000);
  glowK63(st, [40], null);
  show63(st, { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20, 30] }, { n: 'C', k: [70, 80] }] }, true);
  glowK63(st, [10, 20, 30], RED);
  say('B 塞不下：split', '最大 → 新 node，中間 → parent，最小留下');
  await beat(tok, 2800);
  glowK63(st, [10, 20, 30], null);
  show63(st, INS3, false);
  glowK63(st, [20], GOLD);
  say('30 到新 node D，20 上 parent', '10 留在 B；A = 20, 40');
  await beat(tok, 3000);
}]);

FRAG.push(['bst63-23-insert-60', '2-3 tree insert 60：連鎖 split', async (tok) => {
  fresh([0, 3, 12.5], [0, 2.8, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, INS3, false);
  glowK63(st, [20, 40], GOLD);
  say('insert 60：60 > 40 → 往 C 走', 'C 是 70, 80');
  await beat(tok, 2400);
  glowK63(st, [20, 40], null);
  show63(st, { n: 'A', k: [20, 40], c: [{ n: 'B', k: [10] }, { n: 'D', k: [30] }, { n: 'C', k: [60, 70, 80] }] }, true);
  glowK63(st, [60, 70, 80], RED);
  say('C 滿了：split', '60 留 C，80 → 新 node E，70 往上推');
  await beat(tok, 2600);
  glowK63(st, [60, 70, 80], null);
  show63(st, { n: 'A', k: [20, 40, 70], c: [{ n: 'B', k: [10] }, { n: 'D', k: [30] }, { n: 'C', k: [60] }, { n: 'E', k: [80] }] }, false);
  await beat(tok, 1400);
  glowK63(st, [20, 40, 70], RED);
  say('70 推進 A：A = 20, 40, 70', '<span class="no">A 又爆了</span>');
  await beat(tok, 2600);
  glowK63(st, [20, 40, 70], null);
  show63(st, { n: 'G', k: [40], c: [{ n: 'A', k: [20], c: [{ n: 'B', k: [10] }, { n: 'D', k: [30] }] },
    { n: 'F', k: [70], c: [{ n: 'C', k: [60] }, { n: 'E', k: [80] }] }] }, false);
  glowK63(st, [40], GOLD);
  say('A 再 split：40 變新 root G', '70 → 新 node F；連鎖 split，樹高 +1');
  await beat(tok, 3000);
  glowK63(st, [40], null);
  say('新 node 依序是 E、F、G', '2-3 tree 是往上長的');
  await beat(tok, 2600);
}]);

FRAG.push(['bst63-23-delete', '2-3 tree delete：rotate 與 combine', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, DEL0, false);
  say('2-3 tree：A(50, 80)、B、C、D', '');
  await beat(tok, 2200);
  glowK63(st, [50, 80], GOLD);
  say('delete 70：50 < 70 < 80 → C', '找到就刪掉');
  await beat(tok, 1800);
  glowK63(st, [50, 80], null);
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60] }, { n: 'D', k: [90, 95] }] }, false);
  await beat(tok, 1600);
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60] }, { n: 'D', k: [95] }] }, false);
  say('delete 90：D 還剩 95', '沒事');
  await beat(tok, 2200);
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [] }, { n: 'D', k: [95] }] }, false);
  say('delete 60：C 空了', '左兄弟 B 有 2 個 key → rotate');
  await beat(tok, 2600);
  show63(st, { n: 'A', k: [20, 80], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50] }, { n: 'D', k: [95] }] }, false);
  glowK63(st, [50, 20], GOLD);
  say('rotate：50 下來、20 上去', '只讓 key 在 node 間轉，不動 pointer');
  await beat(tok, 3000);
  glowK63(st, [50, 20], null);
  show63(st, { n: 'A', k: [20, 80], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50] }, { n: 'D', k: [] }] }, false);
  say('delete 95：D 空了', '兄弟 C 只有 1 個 key → 不能 rotate，要 combine');
  await beat(tok, 2600);
  show63(st, { n: 'A', k: [20], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50, 80] }] }, false);
  glowK63(st, [80], GOLD);
  say('combine：80 下來跟 C 合併', 'D 被拿掉，A = 20');
  await beat(tok, 3000);
}]);
  }

  // ═══ bsta.js ═══
  {
// ─── cvooTtquDlQ（BST 定義與 size 9 / depth 3 範例）＋ 9Jry5-82I68（MIT 6.006 L5：BST、跑道預約、augmentation） ───
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, relabel, code, line, arrow, ghostBox, lnode, GOLD, GREEN, RED, GRAY } = K;
const BLUE = '#17396a', PTR = '#d8c29b', NS = [0.9, 0.9, 0.9];
// draw a tree from [[value, x, y, parentValue]] ; drop > 0 makes nodes fall in
function bsTree(spec, drop = 0) {
  const N = {}, P = {};
  for (const [v, x, y, p] of spec) {
    if (p !== undefined && P[p]) line(P[p][0], P[p][1], x, y);
    N[v] = cube(v, colorFor(v), NS, x, y, 0, drop); P[v] = [x, y];
  }
  return { N, P };
}
function bsRing() {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; m.position.set(0, -50, 0); m.visible = false; lab.world.add(m); return m;
}
function ringTo(r, P) { if (!r.visible) { r.position.set(P[0], P[1], 0); r.visible = true; } move(r, P[0], P[1], 0); }
const T9 = [[8, 0, 6.2], [3, -3, 4.6, 8], [10, 3, 4.6, 8], [1, -4.6, 3, 3], [6, -1.4, 3, 3], [14, 4.6, 3, 10], [4, -2.3, 1.4, 6], [7, -0.5, 1.4, 6], [13, 3.7, 1.4, 14]];
const T4 = [[49, 0, 5.6], [46, -2.6, 4, 49], [79, 2.6, 4, 49], [41, -4, 2.4, 46]];

// ══════════ cvooTtquDlQ ══════════
// 00:00 node 的三個欄位
FRAG.push(['bsta-node-struct', 'BST 的 node：value + left + right', async (tok) => {
  fresh([0, 5, 12], [0, 2.2, 0]);
  const g = ghostBox(GOLD, 4.4, 1.3, 1.5); g.position.set(0, 4.2, 0);
  tag('node A', 'ptr', 0, 5.4);
  const L = cube('left', PTR, [1.2, 0.8, 1.0], -1.4, 4.2, 0, 3);
  const A = cube('A', colorFor(1), [1.2, 0.8, 1.0], 0, 4.2, 0, 3);
  const R = cube('right', PTR, [1.2, 0.8, 1.0], 1.4, 4.2, 0, 3);
  say('每個 node 有三個欄位', 'value + left 指標 + right 指標');
  await beat(tok, 3600);
  glow(A, GOLD);
  say('value：存任何一種資料項目', 'node A 的 value = A');
  await beat(tok, 2600);
  glow(A, null); glow(L, GOLD);
  const B = cube('B', colorFor(2), [1.0, 0.8, 1.0], -3.6, 1.2, 0, 4);
  arrow(V3(-1.6, 3.7, 0), V3(-3.4, 1.7, 0));
  say('left 指向左子', 'left → B');
  await beat(tok, 2600);
  glow(L, null); glow(R, GOLD);
  const n = tag('NULL', 'ptr alt', 3.4, 1.4);
  arrow(V3(1.6, 3.7, 0), V3(3.2, 1.8, 0), 0x9a3a2a);
  say('right 指向右子，可以是 NULL', 'right = NULL（沒有右子）');
  await beat(tok, 2800);
  glow(R, null); glow(B, GREEN);
  say('B 的兩個指標都是 NULL', 'B 自己也是一個 node');
  await beat(tok, 2600);
  glow(B, null);
  say('樹＝用 left / right 串起來的 node', '');
  await beat(tok, 2800);
}]);

// 02:07 空樹、root、唯一路徑、leaf
FRAG.push(['bsta-root-leaf', 'root、唯一路徑與 leaf node', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.6, 0]);
  const e = ghostBox(GRAY, 3, 1.6, 2); e.position.set(0, 4, 0);
  const el = tag('空樹：0 個 node', 'ptr', 0, 5.4);
  say('binary tree 可以是空的', '由 0 個或更多 node 組成');
  await beat(tok, 2600);
  kill(e); kill(el);
  const { N, P } = bsTree(T9, 3);
  tag('root', 'ptr alt', 0, 7.3);
  glow(N[8], GOLD);
  say('非空就有一個 root', 'root = 8（最上面的起點）');
  await beat(tok, 2600);
  const r = bsRing();
  for (const v of [8, 3, 6, 7]) { ringTo(r, P[v]); glow(N[v], GOLD); say('從 root 走到 7 的路只有一條', '8 → 3 → 6 → 7'); await beat(tok, 1100); }
  say('每個 node 都由 root 唯一路徑到達', '');
  await beat(tok, 1800);
  r.visible = false;
  for (const v of [8, 3, 6, 7]) glow(N[v], null);
  for (const v of [1, 4, 7, 13]) { glow(N[v], GREEN); tag('leaf', 'idx', P[v][0], P[v][1] - 0.9); }
  say('沒有左子也沒有右子 → leaf', 'leaf：1、4、7、13');
  await beat(tok, 3000);
  glow(N[8], GOLD);
  say('最上面是 root，最下面是 leaf', 'root = 8');
  await beat(tok, 2600);
}]);

// 04:21 BST 性質：左子樹 < x < 右子樹
FRAG.push(['bsta-property', 'BST 性質：左小右大（整棵子樹）', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.6, 0]);
  const { N } = bsTree(T9);
  const LS = { 8: [3, 1, 6, 4, 7], 3: [1] }, RS = { 8: [10, 14, 13], 3: [6, 4, 7] };
  for (const x of [8, 3]) {
    Object.values(N).forEach((m) => glow(m, null));
    glow(N[x], GOLD);
    say('x = ' + x + '：看它的左子樹', 'y ∈ left(x) ⇒ key(y) < key(x)');
    await beat(tok, 1600);
    for (const v of LS[x]) { glow(N[v], GREEN); await beat(tok, 350); }
    say('左子樹全部都比 ' + x + ' 小', LS[x].join('、') + ' < ' + x);
    await beat(tok, 2200);
    for (const v of RS[x]) { glow(N[v], BLUE); await beat(tok, 350); }
    say('右子樹全部都比 ' + x + ' 大', 'y ∈ right(x) ⇒ key(y) > key(x)');
    await beat(tok, 2400);
  }
  Object.values(N).forEach((m) => glow(m, null));
  say('每個 node 都要成立，不只 root', '小的放左邊，大的放右邊');
  await beat(tok, 3000);
}]);

// 07:12 範例：size 9、depth 3、root 8、leaves 1, 4, 7, 13
FRAG.push(['bsta-size9', '造一棵 size 9、depth 3 的 BST', async (tok) => {
  fresh([0, 5, 14], [0, 3.8, 0]);
  const cd = code(['size = 9', 'depth = 3', 'root = 8', 'leaves = 1, 4, 7, 13'], -5.2, 8.6, 0.5);
  say('題目：size 9、depth 3', 'root = 8，leaves = 1、4、7、13');
  await beat(tok, 2800);
  const P = {}, N = {};
  const why = { 8: 'root = 8', 3: '3 < 8 → 左', 10: '10 > 8 → 右', 1: '1 < 3 → 左（leaf）', 6: '6 > 3 → 右', 4: '4 < 6 → 左（leaf）', 7: '7 > 6 → 右（leaf）', 14: '14 > 10 → 右', 13: '13 < 14 → 左（leaf）' };
  for (const [v, x, y, p] of T9) {
    cd.hl(v === 8 ? 2 : [1, 4, 7, 13].includes(v) ? 3 : -1);
    if (p !== undefined) line(P[p][0], P[p][1], x, y);
    N[v] = cube(v, colorFor(v), NS, x, y, 0, 3); P[v] = [x, y];
    say('放 ' + v, why[v]);
    await beat(tok, 1300);
  }
  cd.hl(1);
  [0, 1, 2, 3].forEach((d) => tag('depth ' + d, 'idx', 6.3, 6.2 - d * 1.6));
  say('depth = 離 root 的距離', '8 在 0，13 在第 3 層 → depth 3');
  await beat(tok, 2800);
  cd.hl(0);
  let c = 0;
  for (const [v] of T9) { c++; glow(N[v], GREEN); say('size = node 的總數', 'size = ' + c); await beat(tok, 380); }
  for (const v of [1, 4, 7, 13]) glow(N[v], GOLD);
  cd.hl(-1);
  say('四個條件都滿足', '1、4、7、13 沒有子 → leaf');
  await beat(tok, 3000);
}]);

// ══════════ 9Jry5-82I68（MIT 6.006 L5） ══════════
const tx = (t) => (t - 46) * 0.55;
function timeline() {
  line(-6.8, 0, 6.6, 0, 0, '#7a6a52');
  for (const t of [36, 40, 44, 48, 52, 56]) { line(tx(t), -0.15, tx(t), 0.15); tag(String(t), 'idx', tx(t), -0.5, 0.6); }
}
const RS = [0.62, 0.62, 0.62];
// 00:51 問題定義
FRAG.push(['bsta-runway-def', '跑道預約系統：要做什麼', async (tok) => {
  fresh([0, 4.2, 11], [0, 1.2, 0]);
  timeline();
  tag('time →', 'idx', 6.2, 0.6);
  const now = tag('now', 'ptr alt', tx(37), 1.3);
  const R = {};
  for (const t of [41.2, 49, 56.3]) R[t] = cube(t, colorFor(Math.round(t)), RS, tx(t), 0.35, 0, 3);
  say('單一跑道：預約未來的降落時間', 'R = 已排定的降落時間集合');
  await beat(tok, 2800);
  const q = cube('t', GRAY, RS, tx(53), 2.6, 0, 0);
  const w = ghostBox(GOLD, 6 * 0.55, 1.4, 1.2); w.position.set(tx(53), 0.7, 0);
  say('要求 t：前後 k 分鐘內不能有別班', 'k = 3 分鐘（可依天氣調整）');
  await beat(tok, 2800);
  move(q, tx(53), 0.35, 0); kill(w);
  say('檢查通過才 insert 到 R', 'insert(t)');
  await beat(tok, 2400);
  now.position.x = tx(41.2);
  fly(R[41.2]);
  say('飛機降落後就從 R 刪掉', 'delete(41.2)');
  await beat(tok, 2400);
  say('目標：每個操作都 O(log n)', 'n = |R|');
  await beat(tok, 3000);
}]);

// 06:17 例子：now = 37，R = {41.2, 49, 56.3}
FRAG.push(['bsta-runway-ex', '例子：53 可以、44 不行、20 不行', async (tok) => {
  fresh([0, 4.2, 11], [0, 1.2, 0]);
  timeline();
  tag('now = 37', 'ptr alt', tx(37), 1.4);
  const R = {};
  for (const t of [41.2, 49, 56.3]) R[t] = cube(t, colorFor(Math.round(t)), RS, tx(t), 0.35, 0, 3);
  say('現在 37，R = {41.2, 49, 56.3}', 'k = 3');
  await beat(tok, 2600);
  const a = cube(53, GRAY, RS, tx(53), 2.8, 0);
  const w = ghostBox(GOLD, 6 * 0.55, 1.4, 1.2); w.position.set(tx(53), 0.7, 0);
  glow(R[49], GOLD); glow(R[56.3], GOLD);
  say('要求 53：離 49 差 4，離 56.3 差 3.3', '都 ≥ 3 → OK');
  await beat(tok, 2600);
  glow(R[49], null); glow(R[56.3], null); kill(w);
  move(a, tx(53), 0.35, 0); glow(a, GREEN);
  await beat(tok, 1400);
  const b = cube(44, GRAY, RS, tx(44), 2.8, 0);
  const w2 = ghostBox(RED, 6 * 0.55, 1.4, 1.2); w2.position.set(tx(44), 0.7, 0);
  glow(R[41.2], RED); glow(b, RED);
  say('要求 44：離 41.2 只差 2.8', '< 3 → 拒絕');
  await beat(tok, 2600);
  fly(b); kill(w2); glow(R[41.2], null);
  await beat(tok, 900);
  tag('≈', 'idx', -6, 0.3);
  const c = cube(20, GRAY, RS, -6.6, 2.8, 0); glow(c, RED);
  say('要求 20：已經過去了', '20 < now = 37 → 拒絕');
  await beat(tok, 2400);
  fly(c);
  say('結果 R = {41.2, 49, 53, 56.3}', '');
  await beat(tok, 2600);
}]);

// 08:12 unsorted array
FRAG.push(['bsta-unsorted', 'Unsorted array：插入 O(1)、檢查 O(n)', async (tok) => {
  fresh([0, 5, 11], [0, 1, 0]);
  const vals = [49, 56.3, 41.2], M = [];
  vals.forEach((v, i) => { M.push(cube(v, colorFor(Math.round(v)), [1.4, 0.8, 1.2], -3 + i * 1.6, 0.4)); tag('[' + (i + 1) + ']', 'idx', -3 + i * 1.6, -0.4, 0.9); });
  say('R 存成沒排序的 array（數字示意）', '');
  await beat(tok, 3000);
  const n = cube(53, GRAY, [1.4, 0.8, 1.2], 1.8, 0.4, 0, 3); tag('[4]', 'idx', 1.8, -0.4, 0.9);
  say('insert 直接接在最後', '<span class="ok">O(1)</span>（沒做檢查的話）');
  await beat(tok, 2400);
  glow(n, GOLD);
  for (let i = 0; i < M.length; i++) {
    glow(M[i], GOLD);
    say('k 分鐘檢查：不知道誰離 53 近', '只能一個一個比 |53 − ' + vals[i] + '|');
    await beat(tok, 1100);
    glow(M[i], null);
  }
  glow(n, null);
  say('檢查要掃整個 array', '<span class="no">O(n)</span>');
  await beat(tok, 2600);
  say('幾乎每件事都是線性時間', 'insert O(1)，但 check O(n)');
  await beat(tok, 3000);
}]);

// 10:09 sorted array：binary search + shift
FRAG.push(['bsta-sorted-array', 'Sorted array：找位置 O(log n)、插入要 shift', async (tok) => {
  fresh([0, 5, 12], [0, 1, 0]);
  const A = [4, 20, 32, 37, 45], X = (i) => -5 + i * 2.2, M = [];
  A.forEach((v, i) => { M.push(cube(v, colorFor(v), [1.4, 0.8, 1.2], X(i), 0.4)); tag(String(i + 1), 'idx', X(i), -0.4, 0.9); });
  tag('6', 'idx', X(5), -0.4, 0.9);
  const t = cube(34, GRAY, [1.2, 0.8, 1.0], 0, 3.2);
  say('sorted array：4, 20, 32, 37, 45', 't = 34');
  await beat(tok, 2400);
  glow(M[2], GOLD);
  say('binary search：中間 32，34 > 32', '→ 往右半邊');
  await beat(tok, 2400);
  glow(M[2], null); glow(M[3], GOLD);
  say('37 ≥ 34：插入點 i = 4', '最小的 i 使 R[i] ≥ t：O(log n)');
  await beat(tok, 2600);
  glow(M[2], GOLD);
  say('只比左右鄰居 R[i−1]、R[i]', 'k 分鐘檢查 <span class="ok">O(1)</span>');
  await beat(tok, 2400);
  glow(M[2], null); glow(M[3], null);
  say('但插入要把後面全部往右搬', '（這裡只看插入的代價）');
  await beat(tok, 1400);
  move(M[4], X(5), 0.4); await beat(tok, 700);
  move(M[3], X(4), 0.4); await beat(tok, 700);
  move(t, X(3), 0.4);
  say('shift 最壞要搬 n 個', '<span class="no">O(n)</span>');
  await beat(tok, 3000);
}]);

// 14:40 sorted list
FRAG.push(['bsta-sorted-list', 'Sorted list：插入 O(1)、但不能 binary search', async (tok) => {
  fresh([0, 5.5, 11], [0, 0.6, 0.6]);
  const A = [4, 20, 32, 37, 45], X = (i) => -5.6 + i * 2.5, G = [], AR = [];
  A.forEach((v, i) => { G.push(lnode(v, X(i), 0.35)); if (i) AR.push(arrow(V3(X(i - 1) + 0.95, 0.35, 0), V3(X(i) - 0.5, 0.35, 0))); });
  say('sorted list：4 → 20 → 32 → 37 → 45', 't = 34');
  await beat(tok, 3000);
  for (let i = 0; i < 3; i++) {
    glow(G[i].userData.data, GOLD);
    say('沒有 random access：不能跳到中間', '只能從頭一個一個走');
    await beat(tok, 1200);
    glow(G[i].userData.data, null);
  }
  glow(G[2].userData.data, GOLD);
  say('找到 32 後面，花了 O(n)', '<span class="no">binary search 用不上</span>');
  await beat(tok, 2400);
  const n = lnode(34, (X(2) + X(3)) / 2, 0.35, 2.4, GRAY);
  kill(AR[1]);
  arrow(V3(X(2) + 0.95, 0.35, 0.3), V3((X(2) + X(3)) / 2 - 0.5, 0.35, 2.1));
  arrow(V3((X(2) + X(3)) / 2 + 0.95, 0.35, 2.1), V3(X(3) - 0.5, 0.35, 0.3));
  say('插入只要改兩個指標', '<span class="ok">O(1)</span>');
  await beat(tok, 2400);
  glow(G[2].userData.data, null);
  say('list 會插入、array 會找：各缺一半', 'BST 要兩個都做到');
  await beat(tok, 3000);
}]);

// 15:59 heap 的 invariant 太弱
FRAG.push(['bsta-heap', 'Min-heap：插入 25 不會檢查到 23 那邊', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.2, 0]);
  const P = { a: [0, 5.6], b: [-2.6, 4], c: [2.6, 4], d: [-3.9, 2.4], e: [-1.3, 2.4], f: [1.3, 2.4] };
  line(...P.a, ...P.b); line(...P.a, ...P.c); line(...P.b, ...P.d); line(...P.b, ...P.e);
  const N = { 21: cube(21, colorFor(21), NS, ...P.a), 23: cube(23, colorFor(23), NS, ...P.b), 30: cube(30, colorFor(30), NS, ...P.c),
    24: cube(24, colorFor(24), NS, ...P.d), 28: cube(28, colorFor(28), NS, ...P.e) };
  tag('24、28 為示意', 'idx', -2.6, 1.4);
  say('min-heap：parent ≤ 兩個 children', '只管父子，invariant 很弱');
  await beat(tok, 2800);
  line(...P.c, ...P.f);
  const n = cube(25, GRAY, NS, ...P.f, 0, 3);
  say('insert 25：先放在最後一格', '再往上跟 parent 比');
  await beat(tok, 2200);
  glow(n, GOLD); glow(N[30], GOLD);
  say('25 < 30 → 交換', '');
  await beat(tok, 1600);
  move(n, ...P.c); move(N[30], ...P.f);
  await beat(tok, 1400);
  glow(N[30], null); glow(N[21], GOLD);
  say('21 ≤ 25 → 停，仍是 min-heap', '');
  await beat(tok, 2000);
  glow(N[21], null); glow(n, null);
  for (const v of [23, 24, 28]) glow(N[v], RED);
  say('23 那邊從沒被看過', '|25 − 24| < 3 卻沒被檢查到');
  await beat(tok, 2800);
  say('heap 做 k 分鐘檢查要掃全部', '<span class="no">O(n)</span>');
  await beat(tok, 3000);
}]);

// 21:14 BST 的結構與 invariant
FRAG.push(['bsta-invariant-30', 'BST invariant：30 的左右子樹', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.4, 0]);
  const { N, P } = bsTree([[30, 0, 5.8], [17, -2.6, 4.2, 30], [40, 2.6, 4.2, 30], [14, -3.9, 2.4, 17], [20, -1.3, 2.4, 17]], 3);
  say('BST：真正用指標串起來的樹', '每個 node：key、parent、left、right');
  await beat(tok, 2600);
  glow(N[17], GOLD);
  const a = [arrow(V3(-2.3, 4.8, 0.5), V3(-0.5, 5.6, 0.5), 0x6a4a00), arrow(V3(-2.9, 3.7, 0.5), V3(-3.7, 2.9, 0.5)), arrow(V3(-2.3, 3.7, 0.5), V3(-1.5, 2.9, 0.5))];
  const l = [tag('parent', 'idx', -1.3, 5.6, 0.5), tag('left', 'idx', -4.0, 3.4, 0.5), tag('right', 'idx', -1.1, 3.4, 0.5)];
  say('17 的三個指標', 'parent = 30、left = 14、right = 20');
  await beat(tok, 2800);
  a.forEach(kill); l.forEach(kill); glow(N[17], null);
  glow(N[30], GOLD);
  for (const v of [17, 14, 20]) glow(N[v], GREEN);
  say('30 的整個左子樹都 ≤ 30', 'y ∈ left(x) ⇒ key(y) ≤ key(x)');
  await beat(tok, 2600);
  glow(N[40], BLUE);
  say('右子樹都 ≥ 30', 'y ∈ right(x) ⇒ key(y) ≥ key(x)');
  await beat(tok, 2400);
  Object.values(N).forEach((m) => glow(m, null));
  glow(N[17], GOLD); glow(N[14], GREEN); glow(N[20], BLUE);
  say('中間的 17 也要成立', '14 ≤ 17 ≤ 20');
  await beat(tok, 2400);
  say('比 heap 強：看整棵子樹', 'heap 只比 parent 和 children');
  await beat(tok, 3000);
}]);

// 32:31 find 回傳指標、重複 key、平衡問題
FRAG.push(['bsta-find-46', 'find(46)：回傳指向那筆資料的指標', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.2, 0]);
  const { N, P } = bsTree(T4);
  const r = bsRing();
  say('find(46)：沿路比大小', '');
  await beat(tok, 1600);
  ringTo(r, P[49]); glow(N[49], GOLD);
  say('46 < 49 → 往左', '');
  await beat(tok, 1600);
  ringTo(r, P[46]); glow(N[46], GREEN); glow(N[49], null);
  say('找到 46', '已經在樹裡 → 不插入');
  await beat(tok, 1800);
  const rec = cube('record', GRAY, [1.8, 0.7, 1.0], -2.6, 1.0, 2.2, 3);
  arrow(V3(-2.6, 3.5, 0.4), V3(-2.6, 1.5, 2));
  say('回傳指向 46 那筆資料的指標', '要覆蓋就改這筆 record');
  await beat(tok, 2600);
  kill(rec); r.visible = false;
  const a = cube('46a', colorFor(46), [1.0, 0.7, 0.8], 4.4, 1.2, 1.5, 3), b = cube('46b', colorFor(46), [1.0, 0.7, 0.8], 5.8, 1.2, 1.5, 3);
  say('允許重複 key = multiset', '要另外區分 46a、46b');
  await beat(tok, 2600);
  kill(a); kill(b); glow(N[46], null);
  say('樹不平衡怎麼辦？之後回答', '目前只保證 O(h)');
  await beat(tok, 3000);
}]);

// 34:58 find min / max / next-larger
FRAG.push(['bsta-minmax-next', 'find min、find max、next-larger(46)', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.2, 0]);
  const { N, P } = bsTree(T4);
  const r = bsRing();
  for (const v of [49, 46, 41]) { ringTo(r, P[v]); glow(N[v], GOLD); say('find min：一直往左', '49 → 46 → 41'); await beat(tok, 900); }
  glow(N[41], GREEN);
  say('走到沒有左子為止', 'min = 41，O(h)');
  await beat(tok, 2200);
  Object.values(N).forEach((m) => glow(m, null));
  for (const v of [49, 79]) { ringTo(r, P[v]); glow(N[v], GOLD); say('find max：一直往右', '49 → 79'); await beat(tok, 900); }
  glow(N[79], GREEN);
  say('max = 79', '一樣 O(h)');
  await beat(tok, 2200);
  Object.values(N).forEach((m) => glow(m, null));
  ringTo(r, P[46]); glow(N[46], GOLD);
  say('next-larger(46)：比 46 大的下一個', '46 沒有右子樹 → 往上找');
  await beat(tok, 2400);
  ringTo(r, P[49]); glow(N[49], GREEN);
  say('第一個「從左邊上來」的祖先', 'next-larger(46) = 49');
  await beat(tok, 2400);
  say('這些操作都只走一條路徑', '<span class="ok">O(h)</span>');
  await beat(tok, 3000);
}]);

// 36:46 augmentation：rank(t) 需求 + 子樹大小 + insert 43
FRAG.push(['bsta-size-aug', 'Augmentation：每個 node 記子樹大小', async (tok) => {
  bst.kcheck = false; bst.showSize = true; bst.del = 'succ';
  enterBst([49, 46, 79, 64, 83]);
  say('新需求：rank(t)', 'rank(t) = 降落時間 ≤ t 的班數');
  await beat(tok, 2600);
  say('每個 node 多記子樹大小', 'size(x) = size(左) + size(右) + 1');
  await beat(tok, 2600);
  say('79 的 size = 3，49 的 size = 5', '葉節點 46、64、83 都是 1');
  await beat(tok, 2600);
  say('insert 43：沿插入路徑走', '');
  await bstInsert(43, tok);
  say('經過的 49、46 各 +1', '49：5 → 6，46：1 → 2，43 = 1');
  await beat(tok, 2600);
  say('有 k 檢查：先檢查成功再更新', '整體仍是 <span class="ok">O(h)</span>');
  await beat(tok, 3000);
}]);

// 44:13 Q&A：刪除 79
FRAG.push(['bsta-del79', '刪除 79：83 補上來、64 接左邊', async (tok) => {
  bst.kcheck = false; bst.showSize = false; bst.del = 'succ';
  enterBst([49, 46, 43, 79, 64, 83]);
  say('問：刪掉 79 要重建整棵樹嗎？', '不用，只要搬指標');
  await beat(tok, 2800);
  say('79 有左子 64、右子 83', '兩個子都在');
  await beat(tok, 2400);
  await bstDelete(79, tok);
  say('83 上來，64 接在 83 左邊', 'BST 性質仍成立');
  await beat(tok, 2800);
  say('只動了幾個指標', 'inorder：' + keys(inorder(bst.t.root)));
  await beat(tok, 3000);
}]);

// 44:58 rank(79) = 1 + 2 + 1 + 1 = 5
FRAG.push(['bsta-rank79', 'rank(79)：往右走時加自己與左子樹', async (tok) => {
  bst.kcheck = false; bst.showSize = true; bst.del = 'succ';
  enterBst([49, 46, 43, 79, 64, 83]);
  say('rank(79)：有幾班 ≤ 79？', '沿搜尋路徑，把比較小的加起來');
  await beat(tok, 2800);
  say('規則：key ≤ t 就加自己', '再加它左子樹的 size');
  await beat(tok, 2600);
  const r = await bstRank(79, tok);
  say('49：+1，46 子樹：+2', '79：+1，64 子樹：+1');
  await beat(tok, 2800);
  say('1 + 2 + 1 + 1 = ' + r, '<span class="ok">rank(79) = ' + r + '</span>，O(h)');
  await beat(tok, 2600);
  say('真的數一下：43 46 49 64 79', '5 個 ≤ 79 ✓');
  await beat(tok, 3000);
}]);
  }

  // ═══ bstb.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, code, anim, line, ghostBox, GOLD, GREEN, RED } = K;
// ─── nfDvFjXU2VI 交大彭文志 Lec24（Horowitz 月份 AVL）、FNeL18KsWPc MIT 6.006 AVL ───
// 小樹引擎：x 由「全部 key 的排名」固定（旋轉時 x 不動、只換層 → 正好看出 inorder 不變），y 由深度決定
const BB_PAL = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
const bbCol = (k) => typeof k === 'number' ? colorFor(k) : BB_PAL[[...String(k)].reduce((s, c) => s + c.charCodeAt(0), 0) % 8];
const BB_MON = ['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN', 'DEC', 'JUL', 'FEB', 'JUN', 'OCT', 'SEP'];
const BB_MIT = [41, 20, 65, 11, 29, 50, 26];
function bbTree(keys, o = {}) {
  const ks = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { root: null, ks, gap: o.gap || 1.3, top: o.top ?? 6.4, dy: o.dy || 1.3, x0: o.x0 || 0, info: o.info || null, edges: [], warn: o.warn !== false };
}
function bbNode(k, lab, kind) { return { k, lab: lab ?? k, l: null, r: null, p: null, m: null, tg: null, kind: kind || 'node' }; }
function bbPut(t, n) {
  if (!t.root) { t.root = n; return n; }
  let c = t.root;
  for (;;) { const d = n.k < c.k ? 'l' : 'r'; if (!c[d]) { c[d] = n; n.p = c; return n; } c = c[d]; }
}
function bbList(t) { const out = []; (function go(n, d) { if (!n) return; go(n.l, d + 1); n.d = d; out.push(n); go(n.r, d + 1); })(t.root, 0); return out; }
const bbH = (n) => (n ? 1 + Math.max(bbH(n.l), bbH(n.r)) : 0); // 層數（Horowitz）；MIT 高度 = bbH − 1
const bbBf = (n) => bbH(n.l) - bbH(n.r);
const bbFind = (t, k) => { let c = t.root; while (c && c.k !== k) c = k < c.k ? c.l : c.r; return c; };
function bbRotUp(t, c) { // 把 c 轉到它父親的位置（c 是左子 = 右旋父親；右子 = 左旋父親）
  const p = c.p, g = p.p;
  if (p.l === c) { p.l = c.r; if (c.r) c.r.p = p; c.r = p; } else { p.r = c.l; if (c.l) c.l.p = p; c.l = p; }
  p.p = c; c.p = g;
  if (!g) t.root = c; else if (g.l === p) g.l = c; else g.r = c;
}
function bbDetect(t, n) { // A = 從新節點往 root 走遇到的第一個 |bf| ≥ 2
  let A = n.p; while (A && Math.abs(bbBf(A)) < 2) A = A.p;
  if (!A) return null;
  const s1 = n.k < A.k ? 'L' : 'R', B = s1 === 'L' ? A.l : A.r, s2 = n.k < B.k ? 'L' : 'R';
  return { A, B, C: s2 === 'L' ? B.l : B.r, type: s1 + s2 };
}
function bbFix(t, r) { if (r.type === 'LL' || r.type === 'RR') bbRotUp(t, r.B); else { bbRotUp(t, r.C); bbRotUp(t, r.C); } }
function bbAvlSilent(t, ks) { for (const k of ks) { const n = bbPut(t, bbNode(k)); const r = bbDetect(t, n); if (r) bbFix(t, r); } }
function bbBstSilent(t, ks) { for (const k of ks) bbPut(t, bbNode(k)); }
function bbPos(t, n) { const i = t.ks.indexOf(n.k); return [t.x0 + (i - (t.ks.length - 1) / 2) * t.gap, t.top - n.d * t.dy]; }
const BB_ARW = { 0: '—', 1: '↙', '-1': '↘', 2: '↙↙', '-2': '↘↘' };
function bbInfo(t) {
  if (!t.info) return;
  for (const n of bbList(t)) {
    if (n.kind !== 'node') continue;
    const b = bbBf(n);
    const s = t.info === 'bf' ? 'bf ' + b : t.info === 'h' ? 'h=' + (bbH(n) - 1) : (BB_ARW[b] || (b > 0 ? '↙↙' : '↘↘'));
    if (!n.tg) n.tg = tag(s, 'idx', 0, 0, 0); else txt(n.tg, s);
    n.tg.element.className = 'lab-label ' + (Math.abs(b) >= 2 ? 'ptr alt' : 'idx');
    if (t.warn) glow(n.m, Math.abs(b) >= 2 ? RED : null);
  }
}
function bbEdges(t) {
  t.edges.forEach(kill); t.edges = [];
  for (const n of bbList(t)) {
    const q = n.m.position;
    if (n.p && n.p.m) { const pp = n.p.m.position; t.edges.push(line(pp.x, pp.y - 0.4, q.x, q.y + 0.4)); }
    if (n.tg) n.tg.position.set(q.x + 0.5, q.y + 0.62, 0);
  }
}
async function bbLay(t, tok, ms = 700, drop = 3) {
  for (const n of bbList(t)) {
    const [x, y] = bbPos(t, n);
    if (!n.m) n.m = n.kind === 'blk' ? cube(n.lab, '#c9b48e', [1.25, 0.6, 0.9], x, y, 0, drop) : cube(n.lab, n.col || bbCol(n.k), [0.95, 0.8, 0.9], x, y, 0, drop);
    else if (Math.abs(n.m.position.x - x) > 1e-3 || Math.abs(n.m.position.y - y) > 1e-3) move(n.m, x, y, 0);
  }
  bbInfo(t);
  if (ms > 0) await anim(tok, ms, () => bbEdges(t)); else bbEdges(t);
}
function bbNote(n, s, cls) { if (!n.tg) n.tg = tag(s, cls || 'idx', 0, 0, 0); else txt(n.tg, s); n.tg.element.className = 'lab-label ' + (cls || 'idx'); }
function bbCursor(n, s) { const c = tag(s || '▼', 'ptr', n.m.position.x, n.m.position.y + 1.0, 0); return c; }
async function bbWalk(tok, cur, n, ms = 500) { cur.position.set(n.m.position.x, n.m.position.y + 1.0, 0); glow(n.m, GOLD); await beat(tok, ms); glow(n.m, null); }
const BB_DESC = { LL: 'B 往上提、A 往下壓到右邊', RR: 'B 往上提、A 往下壓到左邊', LR: 'C 拉到最上面、B 與 A 當它的 child', RL: 'C 拉到最上面、A 與 B 當它的 child' };
// 一次 AVL insert：掉進去 → 算 bf → 找 A → 判型別 → 調整
async function bbAvlStep(t, k, tok, o = {}) {
  const n = bbPut(t, bbNode(k));
  say('insert ' + k, o.why || '依字母順序往下比，放成 leaf');
  await bbLay(t, tok, 800);
  await beat(tok, o.quick ? 500 : 900);
  const r = bbDetect(t, n);
  if (!r) { say('更新每個 node 的 bf：沒有人違規', 'bf ∈ {−1, 0, 1}'); await beat(tok, o.quick ? 700 : 1300); return null; }
  const bad = bbList(t).filter((x) => Math.abs(bbBf(x)) >= 2).map((x) => x.k);
  const a = tag('A', 'ptr alt', r.A.m.position.x - 0.55, r.A.m.position.y + 0.95, 0);
  const y = tag('Y', 'ptr', n.m.position.x - 0.55, n.m.position.y + 0.95, 0);
  say('A = 離 Y 最近的違規 node：' + r.A.k, '違規：' + bad.join('、') + '（bf = ±2）');
  await beat(tok, 2600);
  say('Y 在 A 的 ' + (r.type[0] === 'L' ? 'left' : 'right') + ' subtree 的 ' + (r.type[1] === 'L' ? 'left' : 'right'), '→ ' + r.type + ' 型');
  await beat(tok, 2200);
  kill(a); kill(y);
  bbFix(t, r);
  say(r.type + '：' + BB_DESC[r.type], '仍然是 BST：inorder 順序不變');
  await bbLay(t, tok, 900);
  await beat(tok, 1600);
  say('重新計算 bf：全部回到 −1..1', '');
  await beat(tok, 1400);
  return r;
}

// ═══ nfDvFjXU2VI ═══
// 00:00 依字母順序插入月份 → skewed BST，找 SEPT 要比 12 次
FRAG.push(['bstb-skewed-months', '依字母順序插入：skewed BST', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.8, 0]);
  const ord = [...BB_MON].sort();
  const t = bbTree(ord, { gap: 1.1, top: 7.2, dy: 0.56 });
  say('12 個月份照字母順序插入', 'APR < AUG < DEC < … < SEPT');
  for (const k of ord) { bbPut(t, bbNode(k)); await bbLay(t, tok, 280); }
  say('每個新 key 都比前面大：一路往右長', 'skewed binary search tree');
  await beat(tok, 2400);
  const cur = bbCursor(t.root); const cnt = tag('比較 0 次', 'ptr alt', -5, 1.2, 0);
  say('search SEPT：從 root 一路比大小', '');
  let c = t.root, i = 0;
  while (c) { i++; txt(cnt, '比較 ' + i + ' 次'); await bbWalk(tok, cur, c, 320); if (c.k === 'SEP') break; c = c.r; }
  glow(c.m, GREEN);
  say('找 SEPT 要比較 12 次（最多）', 'max comparisons = 12');
  await beat(tok, 2400);
  say('平均：每個 node 的比較次數取平均', '(1 + 2 + … + 12) / 12 = 78 / 12 = 6.5');
  await beat(tok, 2800);
  say('不 balance 就會這麼慢', '→ 想要 balanced BST：AVL tree');
  await beat(tok, 2800);
}]);

// 01:24 AVL 定義：T_L、T_R height balanced 且 |h_L − h_R| ≤ 1；bf = h_L − h_R
FRAG.push(['bstb-avl-def', 'AVL 定義與 balance factor', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.6, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.2 });
  bbAvlSilent(t, BB_MON);
  await bbLay(t, tok, 600, 0);
  const gl = ghostBox('#4b9ee2', 4.6, 3.4, 1.6); gl.position.set(-4.4, 4.6, 0);
  const gr = ghostBox('#e55a9b', 7.6, 4.6, 1.6); gr.position.set(2.75, 4.0, 0);
  const tl = tag('T_L', 'ptr', -5.6, 6.6, 0), tr = tag('T_R', 'ptr', 5.6, 6.6, 0);
  say('條件 1：T_L、T_R 都是 height balanced', '遞迴：每個 subtree 也要符合');
  await beat(tok, 3000);
  say('條件 2：|h_L − h_R| ≤ 1', 'root：h_L = 3、h_R = 4');
  await beat(tok, 3000);
  [gl, gr, tl, tr].forEach(kill);
  t.info = 'bf'; bbInfo(t); bbEdges(t);
  say('每個 node 算 balance factor', 'bf = h_L − h_R（不取絕對值）');
  await beat(tok, 2800);
  for (const n of bbList(t)) { glow(n.m, GREEN); await beat(tok, 260); }
  say('AVL：每個 node 的 bf 只能是 −1、0、1', '');
  await beat(tok, 2400);
  say('insert 時一發現 bf 超出就馬上調整', '不是全部插完才調整');
  await beat(tok, 3000);
}]);

// 05:51 四種調整：A = 離 Y 最近的違規點；看 Y 在 A 的哪裡
FRAG.push(['bstb-four-cases', 'LL、LR、RR、RL 四種情況', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.2, 0]);
  const xs = [-5.1, -1.7, 1.7, 5.1], types = ['LL', 'LR', 'RR', 'RL'];
  say('新插入的 node 叫 Y', 'A = Y 往 root 走，第一個 bf 違規的 node');
  await beat(tok, 2600);
  for (let i = 0; i < 4; i++) {
    const T = types[i], x = xs[i], s1 = T[0] === 'L' ? -1 : 1, s2 = T[1] === 'L' ? -1 : 1;
    const A = cube('A', '#dd8238', [0.9, 0.8, 0.9], x, 5.6, 0, 3);
    const bx = x + s1 * 0.85, yx = bx + s2 * 0.75;
    cube('', '#4b9ee2', [0.8, 0.7, 0.9], bx, 4.2, 0, 3);
    line(x, 5.2, bx, 4.6); line(bx, 3.85, yx, 3.2);
    await beat(tok, 500);
    const Y = cube('Y', '#e55a9b', [0.8, 0.7, 0.9], yx, 2.8, 0, 3); glow(Y, GOLD); glow(A, RED);
    tag(T, 'ptr alt', x, 1.4, 0);
    tag(i === 0 ? 'bf 2' : i === 1 ? 'bf 2' : 'bf −2', 'idx', x + 0.6, 6.3, 0);
    const word = (T[0] === 'L' ? 'left' : 'right') + ' subtree 的 ' + (T[1] === 'L' ? 'left' : 'right');
    say(T + '：Y 在 A 的 ' + word, '');
    await beat(tok, 2200);
  }
  say('先找出 A，再看 Y 和 A 的空間關係', '一定落入四種 case 之一');
  await beat(tok, 3000);
}]);

// 09:25 MAR、MAY、NOV → RR
FRAG.push(['bstb-month-rr', '月份例：MAR、MAY、NOV → RR', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.8, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.2, info: 'bf' });
  for (const k of ['MAR', 'MAY']) await bbAvlStep(t, k, tok, { quick: true, why: k === 'MAR' ? '空樹：MAR 當 root' : 'MAY > MAR（第三個字 Y > R）→ 右邊' });
  say('MAR：h_L − h_R = 0 − 1', 'bf(MAR) = −1');
  await beat(tok, 2200);
  await bbAvlStep(t, 'NOV', tok, { why: 'NOV > MAR、NOV > MAY → MAY 的右邊' });
  say('MAY 拉上來、MAR 壓到左邊', '三個 node 的 bf 都變 0');
  await beat(tok, 2800);
}]);

// 12:40 AUG、APR → LL（MAR、MAY 都違規，A 取最近的 MAR）
FRAG.push(['bstb-month-ll', '月份例：AUG、APR → LL', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.8, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.2, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'MAY', 'NOV']); await bbLay(t, tok, 300, 0);
  say('接著 RR 調整完的樹', 'MAY(MAR, NOV)');
  await beat(tok, 1600);
  await bbAvlStep(t, 'AUG', tok, { quick: true, why: 'AUG < MAY、AUG < MAR → MAR 的左邊' });
  await bbAvlStep(t, 'APR', tok, { why: 'APR < AUG → AUG 的左邊' });
  say('AUG 提上來、MAR 往下壓', 'MAY：h_L = 2、h_R = 1 → bf = 1');
  await beat(tok, 3000);
}]);

// 15:00 / 34:36 JAN → LR（A = MAY、B = AUG、C = MAR），root 換人
FRAG.push(['bstb-month-lr', '月份例：JAN → LR，root 換成 MAR', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.8, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.2, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'MAY', 'NOV', 'AUG', 'APR']); await bbLay(t, tok, 300, 0);
  say('LL 調整完：MAY(AUG(APR, MAR), NOV)', '');
  await beat(tok, 2000);
  const r = await bbAvlStep(t, 'JAN', tok, { why: 'JAN < MAY、> AUG、< MAR → MAR 的左邊' });
  const lab = (k, s) => { const n = bbFind(t, k); return tag(s, 'ptr', n.m.position.x - 0.6, n.m.position.y + 1.0, 0); };
  lab('MAY', 'A'); lab('AUG', 'B'); lab('MAR', 'C');
  say('對照通式：A = MAY、B = AUG、C = MAR', 'root 換了：MAR 被拉上來');
  await beat(tok, 2800);
  const sub = (k, s) => { const n = bbFind(t, k); return tag(s, 'idx', n.m.position.x, n.m.position.y - 0.75, 0); };
  sub('APR', 'B_L'); sub('JAN', 'C_L'); sub('NOV', 'A_R');
  say('B_L = APR、C_L = JAN、C_R 空、A_R = NOV', '順序 B_L, C_L, C_R, A_R 不變');
  await beat(tok, 3000);
  say('調整幅度很大，但仍符合 BST', r ? 'LR：' + BB_DESC.LR : '');
  await beat(tok, 2600);
}]);

// 18:40 DEC、JULY、FEB → RL（A = AUG）
FRAG.push(['bstb-month-rl', '月份例：DEC、JUL、FEB → RL', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.8, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.2, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN']); await bbLay(t, tok, 300, 0);
  say('LR 調整完：root 是 MAR', '');
  await beat(tok, 1600);
  await bbAvlStep(t, 'DEC', tok, { quick: true, why: 'DEC → JAN 的左邊' });
  await bbAvlStep(t, 'JUL', tok, { quick: true, why: 'JUL → JAN 的右邊' });
  await bbAvlStep(t, 'FEB', tok, { why: 'FEB → DEC 的右邊' });
  say('DEC 拉到最上面：AUG、JAN 當它的 child', '');
  await beat(tok, 2800);
}]);

// 20:20 JUNE → LR（A = MAR）；OCT、SEPT 之後的最終樹
FRAG.push(['bstb-month-final', '月份例：JUN → LR，最後的 AVL tree', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.6, 0]);
  const t = bbTree(BB_MON, { gap: 1.1, top: 7.0, dy: 1.15, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN', 'DEC', 'JUL', 'FEB']); await bbLay(t, tok, 300, 0);
  say('RL 調整完的樹', '');
  await beat(tok, 1400);
  await bbAvlStep(t, 'JUN', tok, { why: 'JUN → JUL 的右邊' });
  await bbAvlStep(t, 'OCT', tok, { quick: true, why: 'OCT → NOV 的右邊' });
  await bbAvlStep(t, 'SEP', tok, { quick: true, why: 'SEPT → OCT 的右邊' });
  say('12 個月插完：每個 node 都符合規定', 'root = JAN，高度 5（skewed 是 12）');
  await beat(tok, 3000);
}]);

// 21:27 實作與流程：pointer 還是 array？insert → 算 bf → 找 A → 判型別 → 調整
FRAG.push(['bstb-avl-algo', 'AVL insert 的流程', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const cd = code(['1. 照 BST 規則 insert Y', '2. 更新路徑上每個 node 的 bf', '3. Y 往 root 走：第一個違規 = A', '4. 判斷 LL / LR / RR / RL', '5. 依圖表調整（照表操課）'], -3.6, 6.4, 0.62);
  const t = bbTree(['MAR', 'AUG', 'NOV', 'APR', 'JAN', 'DEC'], { gap: 1.05, top: 6.2, dy: 1.25, x0: 3.3, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'AUG', 'NOV', 'APR', 'JAN']); await bbLay(t, tok, 300, 0);
  say('教科書用 pointer（link）實作', 'node：lchild | data | bf | rchild');
  await beat(tok, 2600);
  cd.hl(0);
  const n = bbPut(t, bbNode('DEC'));
  say('insert DEC', '');
  await bbLay(t, tok, 800);
  cd.hl(1);
  say('沿路更新 bf', 'bf = h_L − h_R');
  await beat(tok, 2000);
  cd.hl(2);
  const cur = bbCursor(n, 'Y');
  for (let c = n; c; c = c.p) { await bbWalk(tok, cur, c, 600); if (Math.abs(bbBf(c)) >= 2) break; }
  kill(cur);
  say('最近的違規 node：MAR = A', 'bf(MAR) = 2');
  await beat(tok, 2200);
  cd.hl(3);
  say('DEC 在 MAR 的 left subtree 的 right', '→ LR');
  await beat(tok, 2200);
  cd.hl(4);
  bbFix(t, bbDetect(t, n));
  await bbLay(t, tok, 900);
  say('LR：JAN 拉上來，AUG、MAR 當 child', '');
  await beat(tok, 2600);
  cd.hl(-1);
  say('每插一個 node 都要算一次、調一次', '');
  await beat(tok, 2600);
}]);

// 一般式（子樹畫成方塊）：LL / RR
async function bbRotGeneral(tok, mirror) {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const specs = mirror
    ? [[1, 'A_L h', 'blk'], [2, 'A'], [3, 'B_L h', 'blk'], [4, 'B'], [5, 'B_R h', 'blk']]
    : [[1, 'B_L h', 'blk'], [2, 'B'], [3, 'B_R h', 'blk'], [4, 'A'], [5, 'A_R h', 'blk']];
  const yk = mirror ? 5.5 : 0.5;
  const t = bbTree([...specs.map((s) => s[0]), yk], { gap: 1.9, top: 6.6, dy: 1.6 });
  const ins = mirror ? [2, 1, 4, 3, 5] : [4, 2, 5, 1, 3];
  for (const k of ins) { const s = specs.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  await bbLay(t, tok, 500, 0);
  const A = bbFind(t, mirror ? 2 : 4), B = bbFind(t, mirror ? 4 : 2);
  const BL = bbFind(t, mirror ? 5 : 1);
  bbNote(A, 'bf ' + (mirror ? '−1' : '1')); bbNote(B, 'bf 0'); bbEdges(t);
  say('通式：A、B 兩個 node，其他畫成 subtree', mirror ? 'A_L、B_L、B_R 高度都是 h' : 'A_R 高 h；B 那邊高 h + 1，所以 B_L = B_R = h');
  await beat(tok, 3200);
  const y = bbPut(t, bbNode(yk, 'Y'));
  y.col = '#e55a9b';
  await bbLay(t, tok, 800);
  relabel(BL.m, (mirror ? 'B_R' : 'B_L') + ' h+1');
  say('Y 插在 ' + (mirror ? 'B_R' : 'B_L') + ' 下面：多一層', (mirror ? 'B_R' : 'B_L') + ' 變成 h + 1');
  await beat(tok, 2600);
  bbNote(B, 'bf ' + (mirror ? '−1' : '1')); bbNote(A, 'bf ' + (mirror ? '−2' : '2'), 'ptr alt'); glow(A.m, RED); bbEdges(t);
  say(mirror ? 'bf(A) = h − (h + 2) = −2' : 'bf(A) = (h + 2) − h = 2', mirror ? 'Y 在 A 的 right subtree 的 right → RR' : 'Y 在 A 的 left subtree 的 left → LL');
  await beat(tok, 3000);
  bbRotUp(t, B);
  say('B 往上提、A 往下壓', '');
  await bbLay(t, tok, 1000);
  glow(A.m, null);
  const mid = bbFind(t, 3);
  glow(mid.m, GOLD);
  say((mirror ? 'B_L' : 'B_R') + ' 搬去當 A 的 ' + (mirror ? 'right' : 'left') + ' subtree', mirror ? 'A < B_L 的值 < B：仍是 BST' : 'B < B_R 的值 < A：仍是 BST');
  await beat(tok, 3000);
  glow(mid.m, null);
  bbNote(A, 'bf 0'); bbNote(B, 'bf 0'); bbEdges(t);
  say('A、B 的 bf 都回到 0', mirror ? 'RR 就是 LL 的鏡像' : '這就是 LL 調整');
  await beat(tok, 3000);
}
// 24:20 LL 通式
FRAG.push(['bstb-ll-general', 'LL 通式：B 上提、B_R 給 A', async (tok) => { await bbRotGeneral(tok, false); }]);
// 29:24 RR 通式
FRAG.push(['bstb-rr-general', 'RR 通式：LL 的鏡像', async (tok) => { await bbRotGeneral(tok, true); }]);

// 30:23 LR（a）三個 node、LR（b）（c）通式；mirror = RL
FRAG.push(['bstb-lr-general', 'LR 通式：C 拉上來，四塊照順序接', async (tok) => {
  const P = ctx.params || {};
  const mirror = !!P.mirror;
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  // ① 只有三個 node 的 LR(a) / RL(a)
  {
    const ks = mirror ? [1, 2, 3] : [1, 2, 3];
    const t = bbTree(ks, { gap: 1.6, top: 6.4, dy: 1.4, x0: -4.2 });
    const order = mirror ? [[1, 'A'], [3, 'B'], [2, 'C']] : [[3, 'A'], [1, 'B'], [2, 'C']];
    for (const [k, s] of order) bbPut(t, bbNode(k, s));
    await bbLay(t, tok, 600, 0);
    glow(bbFind(t, mirror ? 1 : 3).m, RED);
    say((mirror ? 'RL' : 'LR') + '(a)：只有三個 node', 'C 在 A 的 ' + (mirror ? 'right subtree 的 left' : 'left subtree 的 right'));
    await beat(tok, 2400);
    bbRotUp(t, bbFind(t, 2)); bbRotUp(t, bbFind(t, 2));
    glow(bbFind(t, mirror ? 1 : 3).m, null);
    await bbLay(t, tok, 900);
    say('C 拉上來，B、A 當它的 child', '');
    await beat(tok, 2200);
  }
  // ② 通式：B_L、C_L、C_R、A_R 四塊
  const sp = mirror
    ? [[1, 'A_L h', 'blk'], [2, 'A'], [3, 'C_L', 'blk'], [4, 'C'], [5, 'C_R', 'blk'], [6, 'B'], [7, 'B_R h', 'blk']]
    : [[1, 'B_L h', 'blk'], [2, 'B'], [3, 'C_L', 'blk'], [4, 'C'], [5, 'C_R', 'blk'], [6, 'A'], [7, 'A_R h', 'blk']];
  const kase = P.kase === 'c' ? 'c' : 'b';
  const yk = kase === 'b' ? 2.5 : 4.5;
  const t = bbTree([1, 2, 3, 4, 5, 6, 7, yk], { gap: 1.05, top: 6.6, dy: 1.3, x0: 2.6 });
  const ins = mirror ? [2, 1, 6, 4, 7, 3, 5] : [6, 2, 7, 1, 4, 3, 5];
  for (const k of ins) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  await bbLay(t, tok, 600, 3);
  const y = bbPut(t, bbNode(yk, 'Y')); y.col = '#e55a9b';
  await bbLay(t, tok, 800);
  const A = bbFind(t, mirror ? 2 : 6); glow(A.m, RED);
  say('通式 ' + (mirror ? 'RL' : 'LR') + '(' + kase + ')：Y 在 ' + (kase === 'b' ? 'C_L' : 'C_R') + ' 下面', '(b)、(c) 只差 Y 在 C_L 還是 C_R 下');
  await beat(tok, 3000);
  const C = bbFind(t, 4);
  bbRotUp(t, C); bbRotUp(t, C);
  glow(A.m, null);
  say('C 拉到 root，B、A 往下壓', '');
  await bbLay(t, tok, 1100);
  await beat(tok, 800);
  const blocks = bbList(t).filter((n) => n.kind === 'blk');
  for (const b of blocks) { glow(b.m, GOLD); await beat(tok, 450); }
  say(mirror ? '四塊 A_L, C_L, C_R, B_R 由左到右' : '四塊 B_L, C_L, C_R, A_R 由左到右', '順序不變，依序接到 ' + (mirror ? 'A、B' : 'B、A') + ' 底下');
  await beat(tok, 3000);
  blocks.forEach((b) => glow(b.m, null));
  say(mirror ? 'C_L 的值都比 A 大 → 接在 A 右邊' : 'C_L 的值都比 B 大 → 接在 B 右邊', mirror ? 'C_R 都比 B 小 → 接在 B 左邊' : 'C_R 都比 A 小 → 接在 A 左邊');
  await beat(tok, 3000);
  say(mirror ? '會 LR 就會 RL：鏡子一樣' : 'ABC 確認 → C 上拉 → 四塊照順序接', '照表操課（依樣畫葫蘆）');
  await beat(tok, 2800);
}]);

// 40:27 各種結構比較：search x、第 k 小；建 AVL 的成本
FRAG.push(['bstb-avl-cost', 'AVL vs sequential list vs linked list', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.6, 0]);
  const sorted = [...BB_MON].sort();
  const rows = [['sequential list', 6.6], ['linked list', 5.2]];
  rows.forEach(([s, y]) => tag(s, 'ptr', -6.0, y + 0.6, 0));
  const arr = sorted.map((k, i) => cube(k, bbCol(k), [0.85, 0.6, 0.8], -4.95 + i * 0.9, 6.6, 0, 2));
  const ll = sorted.map((k, i) => cube(k, bbCol(k), [0.85, 0.6, 0.8], -4.95 + i * 0.9, 5.2, 0, 2));
  say('search x：sequential list 已排序', 'binary search → O(log n)');
  await beat(tok, 1400);
  let lo = 0, hi = 11; const target = 'OCT'; const ti = sorted.indexOf(target);
  while (lo <= hi) { const m = (lo + hi) >> 1; glow(arr[m], GOLD); await beat(tok, 600); glow(arr[m], null); if (m === ti) { glow(arr[m], GREEN); break; } if (m < ti) lo = m + 1; else hi = m - 1; }
  say('linked list 沒排序、只能從頭找', 'search x：O(n)');
  for (let i = 0; i <= ti; i++) { glow(ll[i], GOLD); await beat(tok, 220); glow(ll[i], null); }
  glow(ll[ti], GREEN);
  await beat(tok, 1000);
  say('AVL：最多走樹高', 'search x：O(log n)');
  const t = bbTree(BB_MON, { gap: 0.9, top: 3.6, dy: 0.72 });
  bbAvlSilent(t, BB_MON); await bbLay(t, tok, 500, 2);
  const sz = (n) => (n ? 1 + sz(n.l) + sz(n.r) : 0);
  for (const n of bbList(t)) bbNote(n, String(sz(n.l)));
  bbEdges(t);
  say('找第 k 小：每個 node 多存左子樹 node 數', 'sequential O(1)、linked O(k)');
  await beat(tok, 2800);
  let k = 8, c = t.root; const cur = bbCursor(c, 'k=8');
  while (c) {
    const L = sz(c.l);
    cur.position.set(c.m.position.x, c.m.position.y + 0.9, 0); txt(cur, 'k=' + k); glow(c.m, GOLD);
    await beat(tok, 900); glow(c.m, null);
    if (k === L + 1) break;
    if (k <= L) c = c.l; else { k -= L + 1; c = c.r; }
  }
  glow(c.m, GREEN);
  say('第 8 小 = ' + c.k + '：只走樹高', 'AVL：O(log n)');
  await beat(tok, 2600);
  say('問題：建一棵 AVL tree 要多少成本？', '補充：n 次 insert × O(log n) = O(n log n)');
  await beat(tok, 3200);
}]);

// ═══ FNeL18KsWPc ═══
// 00:22 BST 性質與 in-order traversal
FRAG.push(['bstb-mit-inorder', 'In-order traversal：11, 20, 26 … 65', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree(BB_MIT, { gap: 1.5, top: 6.6, dy: 1.4 });
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 600, 3);
  say('BST：左子樹 ≤ x ≤ 右子樹', '不只 child，是所有子孫');
  await beat(tok, 2800);
  say('in-order：先左、印自己、再右', '');
  await beat(tok, 1600);
  const cur = bbCursor(t.root, '▼');
  let i = 0;
  const go = async (n) => { if (!n) return; await bbWalk(tok, cur, n, 260); await go(n.l); cur.position.set(n.m.position.x, n.m.position.y + 1.0, 0); glow(n.m, GREEN);
    cube(n.k, bbCol(n.k), [0.9, 0.6, 0.8], -4.2 + i * 1.4, 0.3, 2.6, 3); i++; say('print ' + n.k, ''); await beat(tok, 650); await go(n.r); };
  await go(t.root);
  kill(cur);
  say('印出來是排序好的', '11, 20, 26, 29, 41, 50, 65');
  await beat(tok, 3000);
}]);

// 02:11 BST 操作 O(h)；balanced h = Θ(log n) vs path h = n
FRAG.push(['bstb-mit-balance', 'O(h)：balanced 是 log n，path 是 n', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree([...BB_MIT, 30], { gap: 1.4, top: 6.6, dy: 1.35 });
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 500, 0);
  say('insert 30：沿著樹往下找位置', '');
  const cur = bbCursor(t.root);
  for (const k of [41, 20, 29]) { await bbWalk(tok, cur, bbFind(t, k), 700); }
  kill(cur);
  bbPut(t, bbNode(30)); await bbLay(t, tok, 800);
  say('左、右、右：30 放在 29 的右邊', 'insert、delete、succ、pred 都是 O(h)');
  await beat(tok, 2800);
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const L = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 0.8, top: 6.4, dy: 1.3, x0: -3.6 });
  bbBstSilent(L, [4, 2, 6, 1, 3, 5, 7]); await bbLay(L, tok, 600, 3);
  tag('h = Θ(log n)', 'ptr alt', -3.6, 1.6, 0);
  say('理想：perfectly balanced', 'height ≈ log n');
  await beat(tok, 2400);
  const R = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 0.75, top: 7.0, dy: 0.9, x0: 3.6 });
  bbBstSilent(R, [1, 2, 3, 4, 5, 6, 7]); await bbLay(R, tok, 600, 3);
  tag('h = n', 'ptr alt', 5.2, 1.0, 0);
  say('最糟：一條 path', 'height = n，平均路徑 n/2');
  await beat(tok, 2600);
  say('balanced 的定義：h = O(log n)', 'height = 從 root 往下最長路徑');
  await beat(tok, 3000);
}]);

// 06:12 node 的高度：往下到 leaf 的最長路徑；h = max(h_L, h_R) + 1；null = −1
FRAG.push(['bstb-mit-node-height', 'Node 的高度：max(h_L, h_R) + 1', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree(BB_MIT, { gap: 1.5, top: 6.6, dy: 1.4 });
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 500, 0);
  say('depth 從上往下算；height 從下往上算', 'height = 往下到 leaf 的最長路徑');
  await beat(tok, 2800);
  for (const k of [11, 26, 29, 20, 50, 65, 41]) {
    const n = bbFind(t, k), h = bbH(n) - 1;
    glow(n.m, GOLD); bbNote(n, 'h=' + h, 'ptr alt'); bbEdges(t);
    const hl = bbH(n.l) - 1, hr = bbH(n.r) - 1;
    say(n.l || n.r ? 'node ' + k + '：max(' + hl + ', ' + hr + ') + 1' : 'leaf ' + k + '：height 0', 'h(' + k + ') = ' + h);
    await beat(tok, 1300);
    glow(n.m, null); bbNote(n, 'h=' + h);
  }
  bbEdges(t);
  const n11 = bbFind(t, 11);
  tag('−1', 'idx', n11.m.position.x - 0.5, n11.m.position.y - 0.9, 0); tag('−1', 'idx', n11.m.position.x + 0.5, n11.m.position.y - 0.9, 0);
  say('空的 child 定成 −1，公式就不用特例', 'leaf：max(−1, −1) + 1 = 0');
  await beat(tok, 2800);
  say('只靠 children 就能算：augmentation', '每個 node 存 height，O(1) 維護');
  await beat(tok, 3000);
}]);

// 11:49 AVL 性質：每個 node |h_L − h_R| ≤ 1
FRAG.push(['bstb-mit-avl-prop', 'AVL：每個 node |h_L − h_R| ≤ 1', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree(BB_MIT, { gap: 1.5, top: 6.6, dy: 1.4, info: 'h' });
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 600, 3);
  say('子樹畫成三角形，看兩邊的高度', '');
  await beat(tok, 2200);
  const r = t.root;
  const gl = ghostBox('#4b9ee2', 5.6, 3.6, 1.4); gl.position.set(-2.25, 3.8, 0);
  const gr = ghostBox('#e55a9b', 2.8, 2.2, 1.4); gr.position.set(3.75, 4.5, 0);
  const hl = tag('h_L = 2', 'ptr', -2.25, 1.6, 0), hr = tag('h_R = 1', 'ptr', 3.75, 3.0, 0);
  glow(r.m, GOLD);
  say('AVL：每個 node 兩邊高度最多差 1', '|h_L − h_R| ≤ 1');
  await beat(tok, 3000);
  [gl, gr, hl, hr].forEach(kill); glow(r.m, null);
  t.info = 'arrow'; for (const n of bbList(t)) { kill(n.tg); n.tg = null; } bbInfo(t); bbEdges(t);
  say('標記：↙ 左重、↘ 右重、— 一樣高', '');
  await beat(tok, 2600);
  for (const n of bbList(t)) { glow(n.m, GREEN); await beat(tok, 300); }
  say('每個 node 都只重 1：是 AVL tree', '');
  await beat(tok, 2200);
  say('要求差 0 不可能維持（n 不剛好時）', '差 1 就幾乎一樣好');
  await beat(tok, 3000);
}]);

// 14:30 最糟的 AVL：每個 node 右邊比左邊高 1；N_h = 1 + N_{h−1} + N_{h−2}
FRAG.push(['bstb-mit-sparse', '最稀疏的 AVL：N_h = 1 + N_{h−1} + N_{h−2}', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  say('高度 h 的 AVL，最少要幾個 node？', 'N_h = 最少 node 數');
  await beat(tok, 2600);
  const t = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 1.45, top: 6.8, dy: 1.45, info: 'h', warn: false });
  const LT = { ...t, root: null, edges: [] }, RT = { ...t, root: null, edges: [] };
  for (const k of [1, 2]) bbPut(LT, bbNode(k, ''));      // 左：N_1（2 個 node）
  for (const k of [5, 4, 6, 7]) bbPut(RT, bbNode(k, '')); // 右：N_2（4 個 node）
  await bbLay(LT, tok, 500, 3); await bbLay(RT, tok, 500, 3);
  const gl = ghostBox('#4b9ee2', 2.6, 2.4, 1.4); gl.position.set(-3.6, 6.1, 0);
  const gr = ghostBox('#e55a9b', 5.4, 3.8, 1.4); gr.position.set(2.2, 5.35, 0);
  const t1 = tag('N_{h−2}', 'ptr', -3.6, 4.4, 0), t2 = tag('N_{h−1}', 'ptr', 2.2, 3.0, 0);
  say('最糟：每個 node 右邊比左邊高 1', '左邊高 h − 2、右邊高 h − 1');
  await beat(tok, 3000);
  [gl, gr, t1, t2, ...LT.edges, ...RT.edges].forEach(kill);
  const root = bbNode(3, ''); t.root = root; root.l = LT.root; root.r = RT.root; LT.root.p = root; RT.root.p = root;
  await bbLay(t, tok, 900, 3);
  glow(root.m, GOLD);
  say('再加一個 root：像碎形一樣遞迴', 'N_h = 1 + N_{h−1} + N_{h−2}');
  await beat(tok, 3000);
  glow(root.m, null);
  say('N_0 = 1、N_1 = 2、N_2 = 4、N_3 = 7', '這棵就是 N_3 = 1 + 4 + 2');
  await beat(tok, 3000);
}]);

// 22:47 / 25:39 N_h 的下界：Fibonacci → h < 1.44 log n；或 N_h > 2N_{h−2} → h < 2 log n
FRAG.push(['bstb-mit-nh-bound', 'N_h 指數成長 → h = O(log n)', async (tok) => {
  const P = ctx.params || {};
  const mode = P.mode || 'both';
  fresh([0, 4.0, 13.5], [0, 3.4, 0]);
  const N = [1, 2, 4, 7, 12, 20, 33, 54], F = [0, 1, 1, 2, 3, 5, 8, 13];
  const S = 0.11, x0 = -5.6, dx = 1.6;
  for (let h = 0; h < 8; h++) tag('h=' + h, 'idx', x0 + h * dx, 0, 1.2);
  say('N_h：1, 2, 4, 7, 12, 20, 33, 54', 'N_h = 1 + N_{h−1} + N_{h−2}');
  for (let h = 0; h < 8; h++) {
    const m = lab.box('#4b9ee2', [0.5, 1, 0.6]); m.scale.y = 0.001; m.position.set(x0 + h * dx - 0.3, 0, 0); lab.world.add(m);
    await anim(tok, 250, (q) => { m.scale.y = Math.max(0.001, N[h] * S * q); m.position.y = N[h] * S * q / 2; });
    tag(String(N[h]), 'idx', x0 + h * dx - 0.3, N[h] * S + 0.35, 0);
  }
  await beat(tok, 1600);
  if (mode !== 'half') {
    say('拿掉 +1 就是 Fibonacci：N_h > F_h', 'F_h = φ^h / √5 取整，φ ≈ 1.618');
    for (let h = 0; h < 8; h++) {
      const v = Math.max(0.01, F[h] * S);
      const m = lab.box('#dd8238', [0.5, 1, 0.6]); m.scale.y = 0.001; m.position.set(x0 + h * dx + 0.3, 0, 0); lab.world.add(m);
      await anim(tok, 200, (q) => { m.scale.y = Math.max(0.001, v * q); m.position.y = v * q / 2; });
    }
    await beat(tok, 2000);
    say('φ^h / √5 < n → 取 log_φ', 'h < log_φ n ≈ 1.440 log₂ n');
    await beat(tok, 3000);
  }
  if (mode !== 'fib') {
    say('簡單版：N_h > 1 + 2 N_{h−2} > 2 N_{h−2}', '每兩層 node 數至少翻倍');
    for (let h = 0; h < 8; h++) {
      const v = Math.pow(2, h / 2) * S;
      const m = lab.box('#2fc092', [0.3, 1, 0.3]); m.scale.y = 0.001; m.position.set(x0 + h * dx, 0, 0.6); lab.world.add(m);
      await anim(tok, 200, (q) => { m.scale.y = Math.max(0.001, v * q); m.position.y = v * q / 2; });
    }
    await beat(tok, 1800);
    say('N_h = Θ(2^{h/2}) → h < 2 log₂ n', '常數不準，但一定是 O(log n)');
    await beat(tok, 3000);
  }
  say('AVL tree 一定 balanced', 'h = O(log n)（實際最糟 ≈ 1.44 log n）');
  await beat(tok, 3000);
}]);

// 28:58 / 30:10 / 35:21 insert 23：BST insert → 29 雙重左重 → 右旋 29
FRAG.push(['bstb-mit-insert23', 'Insert 23：29 失衡 → 右旋 29', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree([...BB_MIT, 23], { gap: 1.4, top: 6.6, dy: 1.3, info: 'arrow' });
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 500, 0);
  say('AVL insert：① 先做一般 BST insert', '② 再修好 AVL 性質');
  await beat(tok, 2600);
  const cur = bbCursor(t.root);
  for (const [k, s] of [[41, '23 < 41'], [20, '23 > 20'], [29, '23 < 29'], [26, '23 < 26']]) { say(s, ''); await bbWalk(tok, cur, bbFind(t, k), 650); }
  kill(cur);
  const n = bbPut(t, bbNode(23)); await bbLay(t, tok, 800);
  say('23 放在 26 的左邊', '沿路高度都 +1');
  await beat(tok, 2200);
  const x = bbFind(t, 29);
  say('29 變成雙重左重 ↙↙：不是 AVL 了', '23、26、29 排成一條 path');
  await beat(tok, 3000);
  if (P.part === 'detect') { say('要怎麼修？→ rotation', ''); await beat(tok, 2600); return; }
  say('right rotate(29)', '26 升上來，29 變成右 child');
  bbRotUp(t, bbFind(t, 26)); await bbLay(t, tok, 1000);
  await beat(tok, 1400);
  void n; void x;
  say('再檢查一次：又是 AVL tree 了', '— ↘ — ↙ … 都只差 1');
  await beat(tok, 3000);
}]);

// 32:32 rotation：left rotate x ↔ right rotate y，inorder a x b y c 不變
FRAG.push(['bstb-mit-rotate', 'Rotation：O(1) 改指標、inorder 不變', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const sp = [[1, 'a', 'blk'], [2, 'x'], [3, 'b', 'blk'], [4, 'y'], [5, 'c', 'blk']];
  const t = bbTree([1, 2, 3, 4, 5], { gap: 1.9, top: 6.4, dy: 1.6 });
  for (const k of [2, 1, 4, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  await bbLay(t, tok, 600, 3);
  const io = ['a', 'x', 'b', 'y', 'c'].map((s, i) => tag(s, 'ptr', -2.4 + i * 1.2, 0.6, 2.4));
  say('兩個 node x、y，三棵 subtree a、b、c', 'inorder：a x b y c');
  await beat(tok, 3000);
  const b = bbFind(t, 3), y = bbFind(t, 4), x = bbFind(t, 2);
  glow(b.m, GOLD);
  say('left rotate(x)：y 升上來、x 降下去', 'b 的 parent 從 y 換成 x');
  bbRotUp(t, y); await bbLay(t, tok, 1100);
  await beat(tok, 2000);
  glow(b.m, null);
  io.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('inorder 還是 a x b y c：仍是 BST', '只改常數個指標 → O(1)');
  await beat(tok, 3000);
  io.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('right rotate(y)：可以轉回來', 'rotation 是可逆的');
  bbRotUp(t, x); await bbLay(t, tok, 1100);
  await beat(tok, 2600);
}]);

// 37:07 insert 55：zigzag，一次旋轉沒用 → left rotate 50、right rotate 65
FRAG.push(['bstb-mit-insert55', 'Insert 55：zigzag 要兩次旋轉', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree([...BB_MIT, 23, 55], { gap: 1.3, top: 6.6, dy: 1.3, info: 'arrow' });
  bbBstSilent(t, [41, 20, 65, 11, 26, 50, 23, 29]); await bbLay(t, tok, 500, 0);
  say('接著 insert 23 修好的樹', '');
  await beat(tok, 1600);
  bbPut(t, bbNode(55)); await bbLay(t, tok, 800);
  say('insert 55：放在 50 的右邊', '65 變成 ↙↙');
  await beat(tok, 2800);
  say('65、50、55 是 zigzag', '只做 right rotate(65)？');
  bbRotUp(t, bbFind(t, 50)); await bbLay(t, tok, 1000);
  await beat(tok, 1200);
  say('變成 zag-zig：高度一樣，沒用', '');
  await beat(tok, 2200);
  bbRotUp(t, bbFind(t, 65)); await bbLay(t, tok, 800);
  say('先 left rotate(50)', '55 升上來，變成一直線');
  bbRotUp(t, bbFind(t, 55)); await bbLay(t, tok, 1000);
  await beat(tok, 2200);
  say('再 right rotate(65)', '55 當子樹的 root');
  bbRotUp(t, bbFind(t, 55)); await bbLay(t, tok, 1000);
  await beat(tok, 2000);
  say('double rotation = 兩次 rotation', '50、55、65 都 —；41 仍 ↙');
  await beat(tok, 3000);
}]);

// 40:18 修 AVL：從改到的 node 往上走、更新高度，找最低的違規 x
FRAG.push(['bstb-mit-walkup', '往上走更新高度，找最低的違規 node', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree([...BB_MIT, 23, 55], { gap: 1.3, top: 6.6, dy: 1.3, info: 'h' });
  bbBstSilent(t, [41, 20, 65, 11, 26, 50, 23, 29]); await bbLay(t, tok, 500, 0);
  const n = bbPut(t, bbNode(55)); t.warn = false; await bbLay(t, tok, 800);
  say('從剛改到的 node 往上走', '每一步：h = max(h_L, h_R) + 1');
  const cur = bbCursor(n, '▼');
  for (let c = n; c; c = c.p) {
    await bbWalk(tok, cur, c, 800);
    if (Math.abs(bbBf(c)) >= 2) break;
  }
  const x = bbFind(t, 65); glow(x.m, RED);
  say('65：h_L = 1、h_R = −1（不存在）', '差 2 → 最低的違規 node x');
  await beat(tok, 3000);
  say('AVL 看左右子樹高度，不是看層數', '');
  await beat(tok, 2400);
  kill(cur);
  bbFix(t, bbDetect(t, n)); glow(x.m, null); await bbLay(t, tok, 1000);
  say('修好 x 後繼續往上檢查', '上面可能還有違規（一般情況）');
  await beat(tok, 3000);
}]);

// 43:08 / 47:18 一般情況：x 右重 2；case 1 y 右重或平衡 → left rotate x；case 2 y 左重 → 兩次旋轉
FRAG.push(['bstb-mit-cases', 'x 右重的兩種情況', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  if (P.kase !== 2) {
    const sp = [[1, 'A k−3', 'blk'], [2, 'x'], [3, 'B k−3', 'blk'], [4, 'y'], [5, 'C k−2', 'blk']];
    const t = bbTree([1, 2, 3, 4, 5], { gap: 1.9, top: 6.4, dy: 1.5 });
    for (const k of [2, 1, 4, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
    await bbLay(t, tok, 600, 3);
    const x = bbFind(t, 2), y = bbFind(t, 4);
    bbNote(x, 'h=k ↘↘', 'ptr alt'); bbNote(y, 'h=k−1 ↘'); glow(x.m, RED); bbEdges(t);
    say('case 1：x 雙重右重，y = x.right 右重', 'x 高 k、y 高 k−1、C 高 k−2');
    await beat(tok, 3200);
    say('y 是 AVL：A、B 都是 k − 3', '');
    await beat(tok, 2400);
    bbRotUp(t, y); glow(x.m, null);
    say('left rotate(x)', 'A、B、C 的高度不變');
    await bbLay(t, tok, 1100);
    bbNote(x, 'h=k−2 —'); bbNote(y, 'h=k−1 —'); bbEdges(t);
    await beat(tok, 1400);
    say('x：k−3 vs k−3；y：k−2 vs k−2', '兩個都平衡了');
    await beat(tok, 3000);
    say('y 平衡（—）時也一樣成立', '之後往 y 的 parent 繼續檢查');
    await beat(tok, 2800);
    if (P.kase === 1) return;
    fresh([0, 4.2, 13], [0, 3.6, 0]);
  }
  const sp = [[1, 'A', 'blk'], [2, 'x'], [3, 'B', 'blk'], [4, 'y'], [5, 'C', 'blk'], [6, 'z'], [7, 'D', 'blk']];
  const t = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 1.45, top: 6.6, dy: 1.35 });
  for (const k of [2, 1, 6, 4, 7, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  await bbLay(t, tok, 600, 3);
  const x = bbFind(t, 2), z = bbFind(t, 6), y = bbFind(t, 4);
  bbNote(x, '↘↘', 'ptr alt'); bbNote(z, '↙'); glow(x.m, RED); bbEdges(t);
  say('case 2：x 的右 child z 是左重', 'x → z → y 是 zigzag');
  await beat(tok, 3000);
  bbRotUp(t, y);
  say('right rotate(z)', '');
  await bbLay(t, tok, 1000);
  await beat(tok, 1400);
  bbRotUp(t, y); glow(x.m, null);
  say('left rotate(x)', 'y 當 root，x、z 是 children');
  await bbLay(t, tok, 1000);
  bbNote(x, '—'); bbNote(z, '—'); bbEdges(t);
  await beat(tok, 1600);
  say('兩次旋轉後恢復 AVL 性質', 'inorder：A x B y C z D 不變');
  await beat(tok, 3000);
}]);

// 48:26 AVL sort：n 次 insert（各 O(log n)）+ in-order O(n)
FRAG.push(['bstb-mit-avl-sort', 'AVL sort：O(n log n)', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t = bbTree(BB_MIT, { gap: 1.5, top: 6.6, dy: 1.4 });
  say('sort n 個數：一個一個 insert 進 AVL', '每次 O(log n) → 共 O(n log n)');
  for (const k of BB_MIT) { const n = bbPut(t, bbNode(k)); const r = bbDetect(t, n); if (r) bbFix(t, r); await bbLay(t, tok, 450); }
  await beat(tok, 1400);
  say('再做 in-order traversal：O(n)', '');
  const out = []; (function go(n) { if (!n) return; go(n.l); out.push(n); go(n.r); })(t.root);
  for (let i = 0; i < out.length; i++) { glow(out[i].m, GREEN); cube(out[i].k, bbCol(out[i].k), [0.9, 0.6, 0.8], -4.2 + i * 1.4, 0.3, 2.6, 3); await beat(tok, 450); }
  say('得到排序：11, 20, 26, 29, 41, 50, 65', 'AVL sort = O(n log n)');
  await beat(tok, 3000);
}]);

// 49:39 ADT vs data structure：priority queue（heap / AVL）；succ/pred 要 balanced BST
FRAG.push(['bstb-mit-adt', 'ADT vs 資料結構：heap 與 AVL', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const ops = ['insert', 'delete-min', 'succ / pred'];
  tag('ADT（介面：要支援什麼）', 'ptr', -3.6, 6.8, 0);
  const oc = ops.map((s, i) => cube(s, '#9b7ef4', [2.2, 0.6, 0.9], -3.6, 5.6 - i * 1.0, 0, 3));
  say('ADT：只規定要支援哪些操作', 'Java 的 interface');
  await beat(tok, 2600);
  tag('資料結構（怎麼做）', 'ptr', 3.4, 6.8, 0);
  const heap = cube('heap', '#dd8238', [1.8, 0.8, 0.9], 2.2, 4.9, 0, 3);
  const avl = cube('AVL tree', '#2fc092', [1.8, 0.8, 0.9], 4.6, 4.9, 0, 3);
  ghostBox('#9b7ef4', 2.8, 2.2, 1.4).position.set(-3.6, 5.1, 0);
  tag('priority queue', 'idx', -5.6, 4.0, 0);
  say('insert + delete-min = priority queue', 'heap 或 AVL 都做得到 O(log n)');
  glow(oc[0], GOLD); glow(oc[1], GOLD); glow(heap, GREEN); glow(avl, GREEN);
  await beat(tok, 3000);
  glow(heap, null); glow(oc[2], GOLD);
  say('要 succ / pred：需要 balanced BST', 'AVL 全部 O(log n)');
  await beat(tok, 3000);
  oc.forEach((m) => glow(m, null));
  tag('in place、不用指標', 'idx', 2.2, 3.8, 0); tag('指標多、常數空間較大', 'idx', 4.6, 3.3, 0);
  say('heap 的好處：in place，不多佔空間', '');
  await beat(tok, 2800);
  say('理論上 AVL 什麼都能 O(log n)', '');
  await beat(tok, 2600);
}]);
  }

  // ═══ bstc.js ═══
  {
// ─── IWzYoXKaRIc：MIT 6.006 Rec6 AVL Trees ／ jDM6_TnYIqE：Abdul Bari 10.1 AVL Tree ───
const { V3, fresh, tag, cube, move, kill, txt, relabel, code, line, GOLD, GREEN, GRAY } = K;
const KG = (m, c) => K.glow(m, c);
const CAM = [[0, 4.6, 13.5], [0, 3.7, 0]];
const BLUE = '#4b9ee2', PURP = '#9b7ef4', TEAL = '#31aab0', ORNG = '#dd8238', BAD = '#7a1010';
// 用本章模組的 BST / AVL 畫面（中序位置排版、bf 標籤、游標）
function bstStage(seq, o) {
  fresh(...CAM);
  bst.kcheck = false; bst.showSize = false;
  bst.t = makeView(Object.assign({ tag: 'none' }, o || {}));
  seq.forEach((k) => attach(bst.t, mk(k)));
  layout(bst.t, true);
  bst.cur = makeCursor();
  return bst.t;
}
function avlStage(seq) {
  fresh(...CAM);
  avl.t = makeView({ tag: 'bf', kind: 'avl' });
  seq.forEach((k) => avlInsertRaw(avl.t, k));
  layout(avl.t, true);
  avl.cur = makeCursor();
  return avl.t;
}
// MIT 的高度：leaf = 0、NULL = −1
const hE = (n) => (n ? 1 + Math.max(hE(n.left), hE(n.right)) : -1);
function setTag(n, s, hot) { n.tag.element.textContent = s; n.tag.element.className = 'lab-label ' + (hot ? 'ptr alt' : 'idx'); n.tag.element.style.display = s ? '' : 'none'; }
function hTags(t, fn) { inorder(t.root).forEach((n) => setTag(n, fn ? fn(n) : 'h ' + hE(n))); }
const nodeOf = (t, k) => findKey(t, k);
// 抽象節點／子樹：位置記在 userData.t，連線依目標位置重畫
function rig() {
  const R = { m: {}, ls: [] };
  R.node = (id, text, x, y, color, size, dropH) => { const m = cube(text, color || BLUE, size || [0.8, 0.6, 0.8], x, y, 0, dropH || 0); m.userData.t = [x, y]; R.m[id] = m; return m; };
  R.sub = (id, text, x, y) => R.node(id, text, x, y, GRAY, [1.15, 0.45, 0.7]);
  R.go = (id, x, y) => { const m = R.m[id]; m.userData.t = [x, y]; move(m, x, y); };
  R.place = (map) => { for (const id in map) R.go(id, map[id][0], map[id][1]); };
  R.wire = (pairs) => { R.ls.forEach(kill); R.ls = pairs.map(([p, c]) => { const a = R.m[p].userData.t, b = R.m[c].userData.t; return line(a[0], a[1], b[0], b[1], -0.05); }); };
  R.hang = (id, text, cls) => { const l = lab.label(text, cls || 'idx'); l.position.set(0, 0.62, 0); R.m[id].add(l); return l; };
  return R;
}

// ═══ MIT 6.006 Rec6 ═══
FRAG.push(['bstc-search-5', 'BST 搜尋 5：遇 4 往右、遇 7 往左', async (tok) => {
  const t = bstStage([4, 2, 7, 1, 3, 5, 9]);
  say('BST：左邊都小、右邊都大', 'key(左子樹) < key(x) < key(右子樹)');
  await beat(tok, 2400);
  const n4 = t.root, n7 = n4.right, n5 = n7.left;
  cursorTo(bst.cur, n4.pos); say('找 5：遇到 4', '5 > 4 → 往右');
  await beat(tok, 1700);
  cursorTo(bst.cur, n7.pos); say('遇到 7', '5 < 7 → 往左');
  await beat(tok, 1700);
  cursorTo(bst.cur, n5.pos); glow(n5, '#163a2a'); say('找到 5', '只走一條 root→節點 的路徑');
  await beat(tok, 2000);
  glow(n5, '#000');
  cursorTo(bst.cur, minNode(t.root).pos); say('min：一直往左', 'min = 1');
  await beat(tok, 1600);
  cursorTo(bst.cur, maxNode(t.root).pos); say('max：一直往右', 'max = 9');
  await beat(tok, 1600);
  hideCursor(bst.cur);
  say('find / insert / delete / min / max', '全部 <span class="ok">O(h)</span>，h = 樹高');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-height', '高度 h = max(h_L, h_R) + 1，NULL 算 −1', async (tok) => {
  const t = bstStage([4, 2, 7, 1, 5, 9, 8]);
  hTags(t, () => '');
  say('高度：往下最長的路徑有幾條邊', 'h = max(h_L, h_R) + 1');
  await beat(tok, 2600);
  const nil = (n, side) => cube('−1', GRAY, [0.45, 0.3, 0.45], n.pos.x + side * 0.45, n.pos.y - 1.0, 0, 2);
  const n1 = nodeOf(t, 1);
  const g = [nil(n1, -1), nil(n1, 1)];
  glow(n1, '#4a3600');
  say('leaf：兩邊都是 NULL，算 −1', 'max(−1, −1) + 1 = 0');
  await beat(tok, 2600);
  for (const k of [1, 5, 8]) setTag(nodeOf(t, k), 'h 0', true);
  glow(n1, '#000');
  say('所有 leaf 的高度都是 0', '這就是「NULL = −1」的小技巧');
  await beat(tok, 2200);
  g.forEach(kill);
  const n2 = nodeOf(t, 2), n9 = nodeOf(t, 9);
  g.push(nil(n2, 1), nil(n9, 1));
  setTag(n2, 'h 1', true); setTag(n9, 'h 1', true);
  say('2、9 只有左子：右邊 NULL = −1', 'max(0, −1) + 1 = 1');
  await beat(tok, 2800);
  g.forEach(kill);
  setTag(nodeOf(t, 7), 'h 2', true);
  say('7：左 5 高 0、右 9 高 1', 'max(0, 1) + 1 = 2');
  await beat(tok, 2400);
  setTag(t.root, 'h 3', true);
  say('root 4：左 1、右 2', 'max(1, 2) + 1 = 3');
  await beat(tok, 2400);
  hTags(t);
  say('每個節點存自己的 height', 'AVL 要 O(1) 讀到高度，不能每次往下算');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-avl-invariant', 'AVL 看高度差，不看節點數', async (tok) => {
  let t = bstStage([5, 3, 7, 2, 1]);
  const n3 = nodeOf(t, 3);
  say('這棵是 AVL 嗎？', '');
  await beat(tok, 2000);
  glow(n3, '#4a3600');
  const c1 = tag('2 個節點', 'ptr', n3.pos.x - 1.6, n3.pos.y - 0.2), c2 = tag('0 個', 'ptr', n3.pos.x + 1.2, n3.pos.y - 0.2);
  say('3 的左邊 2 個節點、右邊 0 個', '差 2 是節點數 → AVL 不看這個');
  await beat(tok, 2800);
  txt(c1, 'h = 1'); txt(c2, 'h = −1');
  hTags(t);
  glow(n3, '#5a1010');
  say('看高度：左 1、右 −1', '<span class="no">差 2 → 不是 AVL</span>');
  await beat(tok, 2800);
  t = bstStage([5, 3, 7, 2, 4]);
  const r = t.root;
  const d1 = tag('3 個節點', 'ptr', r.pos.x - 2.4, r.pos.y - 0.4), d2 = tag('1 個', 'ptr', r.pos.x + 2.2, r.pos.y - 0.4);
  say('左邊 3 個、右邊 1 個', '節點數差 2');
  await beat(tok, 2400);
  txt(d1, 'h = 1'); txt(d2, 'h = 0');
  hTags(t);
  glow(r, '#163a2a');
  say('高度：左 1、右 0', '<span class="ok">差 1 → 快樂的 AVL</span>');
  await beat(tok, 2600);
  say('每個節點 |h_L − h_R| ≤ 1', '而且本身要是 BST（AVL 繼承 BST）');
  await beat(tok, 3000);
}]);

// 固定高度、最少節點的 AVL：右邊 h−1、左邊 h−2
function minT(h) { return h < 0 ? null : { h, l: minT(h - 2), r: minT(h - 1) }; }
function layT(T, cx, topY, sp, step) {
  const order = [];
  (function w(n, d, p) { if (!n) return; n.d = d; n.p = p; w(n.l, d + 1, n); order.push(n); w(n.r, d + 1, n); })(T, 0, null);
  order.forEach((n, i) => { n.x = cx + (i - (order.length - 1) / 2) * sp; n.y = topY - n.d * step; });
  return order;
}
function drawT(order, color, dropH, objs) {
  for (const n of order) { n.m = cube(String(n.h), typeof color === 'function' ? color(n) : color, [0.7, 0.55, 0.7], n.x, n.y, 0, dropH || 0); objs.push(n.m); }
  for (const n of order) if (n.p && n.p.m) objs.push(line(n.p.x, n.p.y, n.x, n.y, -0.05));
}
const NMIN = [1, 2, 4, 7, 12];
FRAG.push(['bstc-min-avl', '高度固定、節點最少的 AVL：h = 0..3', async (tok) => {
  fresh(...CAM);
  say('最壞的 AVL：高度大、節點少', '固定高度 h，用最少的節點蓋');
  await beat(tok, 2400);
  let objs = [];
  const show = (h) => { objs.forEach(kill); objs = []; drawT(layT(minT(h), 0, 6.2, 1.15, 1.35), (n) => (n.d === 0 ? ORNG : BLUE), 3, objs); };
  show(0); say('h = 0：只有一個節點', 'N(0) = 1（方塊上的數字 = 高度）');
  await beat(tok, 2400);
  show(1); say('h = 1：兩個節點就夠', 'N(1) = 2');
  await beat(tok, 2400);
  objs.forEach(kill); objs = [];
  const bad = [cube('2', BAD, [0.7, 0.55, 0.7], -1, 6.2, 0, 3), cube('1', BAD, [0.7, 0.55, 0.7], 0, 4.85, 0, 3), cube('0', BAD, [0.7, 0.55, 0.7], 1, 3.5, 0, 3)];
  objs.push(...bad, line(-1, 6.2, 0, 4.85, -0.05), line(0, 4.85, 1, 3.5, -0.05));
  say('h = 2 用一條鏈？', '<span class="no">root：左 −1、右 1 → 差 2，不行</span>');
  await beat(tok, 2800);
  show(2); say('h = 2：右邊 h1、左邊至少要 h0', 'N(2) = N(1) + N(0) + 1 = 4');
  await beat(tok, 2800);
  show(3); say('h = 3：右邊 h2、左邊 h1', 'N(3) = N(2) + N(1) + 1 = 7');
  await beat(tok, 2800);
  say('一般：右放 h−1、左放 h−2', 'N(h) = N(h−1) + N(h−2) + 1');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-min-avl-h4', 'h = 4：h3 接右、h2 接左，N ≈ φ^h', async (tok) => {
  fresh(...CAM);
  const T = minT(4), order = layT(T, 0, 6.4, 0.95, 1.3), objs = [];
  const inR = new Set(), inL = new Set();
  (function w(n, s) { if (!n) return; s.add(n); w(n.l, s); w(n.r, s); })(T.r, inR);
  (function w(n, s) { if (!n) return; s.add(n); w(n.l, s); w(n.r, s); })(T.l, inL);
  say('要蓋 h = 4：root 下面', '一邊要 h = 3，另一邊 h = 2 或 3');
  await beat(tok, 2600);
  drawT(order.filter((n) => inR.has(n)), BLUE, 3, objs);
  const tr = tag('最少的 h3：7 個', 'ptr', 2.6, 1.0);
  say('右邊：最少節點的 h = 3', 'N(3) = 7');
  await beat(tok, 2400);
  drawT(order.filter((n) => inL.has(n)), TEAL, 3, objs);
  const tl = tag('最少的 h2：4 個', 'ptr', -3.2, 2.2);
  say('左邊選 h = 2（比 h = 3 少）', 'N(2) = 4');
  await beat(tok, 2400);
  drawT([T], ORNG, 3, objs);
  objs.push(line(T.x, T.y, T.l.x, T.l.y, -0.05), line(T.x, T.y, T.r.x, T.r.y, -0.05));
  say('接上 root：h = 4', 'N(4) = 7 + 4 + 1 = 12');
  await beat(tok, 2600);
  kill(tr); kill(tl);
  const row = NMIN.map((v, h) => tag('N(' + h + ') = ' + v, 'idx', -5 + h * 2.5, 0.3));
  say('1, 2, 4, 7, 12：比 Fibonacci 還大', 'N(h) ≈ φ^h，φ ≈ 1.618');
  await beat(tok, 3000);
  say('節點數是 h 的指數 → 反過來', 'n 個節點的 AVL：h = <span class="ok">O(log n)</span>');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-insert-65', '插入 6.5：路徑上每個節點高度 +1', async (tok) => {
  const t = bstStage([4, 2, 5, 1, 3, 6, 7]);
  hTags(t);
  say('每個節點存高度（leaf = 0）', 'h = max(h_L, h_R) + 1');
  await beat(tok, 2400);
  const path = [4, 5, 6, 7].map((k) => nodeOf(t, k));
  const old = new Map(path.map((n) => [n, hE(n)]));
  path.forEach((n) => setTag(n, 'h ' + hE(n), true));
  say('插入路徑 4 → 5 → 6 → 7', '高度 3, 2, 1, 0');
  await beat(tok, 2400);
  say('insert 6.5：> 6、< 7', '接在 7 的左邊');
  await bstInsert(6.5, tok);
  hTags(t, (n) => (old.has(n) ? 'h ' + old.get(n) + '→' + hE(n) : 'h ' + hE(n)));
  path.forEach((n) => setTag(n, 'h ' + old.get(n) + '→' + hE(n), true));
  say('路徑上每個節點高度都 +1', '0, 1, 2, 3 → 1, 2, 3, 4');
  await beat(tok, 3000);
  say('AVL：插入後要沿路更新高度', '只有路徑上的節點可能改變');
  await beat(tok, 2800);
}]);

const REB = [
  'insert(k):',
  '  node = BST.insert(k)',
  '  rebalance(node)',
  'rebalance(node):',
  '  while node is not None:',
  '    update_height(node)',
  '    if h(L) >= h(R)+2: right_rotate…',
  '    elif h(R) >= h(L)+2: left_rotate…',
  '    node = node.parent',
];
FRAG.push(['bstc-rebalance-code', 'AVL insert = BST insert + rebalance 往上走', async (tok) => {
  fresh(...CAM);
  const up = !!(ctx.params || {}).up;
  const cp = code(REB, -2.4, 6.4);
  const R = rig();
  const P = [[4.6, 6.2, '3'], [5.6, 4.9, '2'], [4.8, 3.6, '1'], [5.8, 2.3, '0']];
  P.slice(0, 3).forEach(([x, y, h], i) => R.node('n' + i, 'h' + (Number(h) - 1), x, y, BLUE));
  R.wire([['n0', 'n1'], ['n1', 'n2']]);
  say(up ? '插入／刪除後，高度一路往上都會變' : 'insert 很短：舊的 BST insert', up ? '所以 rebalance 要走到 root' : '再加上 rebalance');
  cp.hl(1);
  await beat(tok, 2200);
  R.node('n3', 'h0', P[3][0], P[3][1], ORNG, null, 3);
  R.wire([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
  cp.hl(2); say('BST.insert 把新節點放到底', '然後從新節點開始 rebalance');
  await beat(tok, 2200);
  for (let i = 3; i >= 0; i--) {
    const m = R.m['n' + i];
    KG(m, '#4a3600');
    cp.hl(5); relabel(m, 'h' + P[i][2]);
    say('先 update_height', '高度可能剛變，舊值不能拿來判斷');
    await beat(tok, 1500);
    cp.hl(6); say('檢查左右高度差', '差 ≥ 2 才用 rotate 修');
    await beat(tok, 1200);
    cp.hl(8); KG(m, null);
    say(i ? 'node = node.parent，往上一層' : '走過 root：結束', i ? '' : '整條路徑都檢查過');
    await beat(tok, 1100);
  }
  cp.hl(-1);
  say('所有的魔法都在 rebalance', '工具只有 left_rotate、right_rotate');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-right-rotate', 'Right rotate：B 升上來，c 換給 A', async (tok) => {
  fresh(...CAM);
  const L = !!(ctx.params || {}).left;
  const X = (x) => (L ? -4 - x : x);
  const R = rig();
  R.node('E', 'E', X(-4.2), 6.4, GRAY); R.node('A', 'A', X(-2), 5.1, BLUE); R.node('B', 'B', X(-3.4), 3.8, TEAL);
  R.sub('a', 'a', X(-4.4), 2.5); R.sub('c', 'c', X(-2.4), 2.5); R.sub('d', 'd', X(-0.6), 3.8);
  R.wire([['E', 'A'], ['A', 'B'], ['A', 'd'], ['B', 'a'], ['B', 'c']]);
  const S = L ? ['left', 'right', 'L', 'R'] : ['right', 'left', 'R', 'L'];
  const cp = code([
    S[0] + '_rotate(A):  B = A.' + S[1],
    'B.' + S[0] + ' = A ;  A.parent = B',
    'A.' + S[1] + ' = c ;  c.parent = A',
    'B.parent = E',
    'if E.right is A: E.right = B',
    'else:            E.left  = B',
  ], 3.9, 6.2);
  cp.hl(0);
  say(L ? 'Left rotate：把 R、L 對調' : 'B 是 A 的左子；c 是 B 的右子樹', L ? '程式碼複製一份，left ↔ right' : 'A 掛在 E 底下');
  await beat(tok, 2800);
  const ord = tag(L ? '中序：d A c B a' : '中序：a B c A d', 'idx', -2, 0.8);
  say('旋轉後中序順序不能變', '才能維持 BST');
  await beat(tok, 2200);
  cp.hl(1);
  R.place({ B: [X(-2), 5.1], A: [X(-0.6), 3.8], a: [X(-3.4), 3.8], d: [X(0.4), 2.5] });
  R.wire([['E', 'B'], ['B', 'a'], ['B', 'A'], ['B', 'c'], ['A', 'd']]);
  say('B.' + S[0] + ' = A：A 降下去', 'B 升到 A 原本的位置');
  await beat(tok, 2400);
  cp.hl(2); KG(R.m.c, '#4a3600');
  R.go('c', X(-1.6), 2.5);
  R.wire([['E', 'B'], ['B', 'a'], ['B', 'A'], ['A', 'c'], ['A', 'd']]);
  say('c 從 B 搬到 A 的' + (L ? '右' : '左') + '邊', '指標成對改：child 和 parent');
  await beat(tok, 2600);
  KG(R.m.c, null);
  cp.hl(3); say('B.parent = E', 'E 原本指向 A，要改指 B');
  await beat(tok, 2000);
  cp.hl(4); KG(R.m.E, '#4a3600');
  say('A 原本是 E 的左子還是右子？', '比指標（E.right is A），不比 key');
  await beat(tok, 2600);
  KG(R.m.E, null); cp.hl(-1);
  say('只改圖上幾個連結：O(1)', '子樹 a、c、d 裡面完全不動');
  await beat(tok, 3000);
  kill(ord);
}]);

FRAG.push(['bstc-carrot', '依序插入 4,5,3,6,2,7,1：root 平衡但不是 AVL', async (tok) => {
  const t = bstStage([]);
  say('學生的例子：依序插入', '4, 5, 3, 6, 2, 7, 1（不做 rebalance）');
  await beat(tok, 2200);
  for (const k of [4, 5, 3, 6, 2, 7, 1]) {
    const z = attach(t, mk(k)); layout(t); dropIn(z);
    say('insert ' + k, '');
    await beat(tok, 900);
  }
  hTags(t);
  glow(t.root, '#163a2a');
  say('像一根胡蘿蔔；root 左右都高 1', 'root 看起來平衡');
  await beat(tok, 2800);
  glow(t.root, '#000');
  const n3 = nodeOf(t, 3), n5 = nodeOf(t, 5);
  glow(n3, '#5a1010');
  setTag(n3, 'h_L 1、h_R −1', true);
  say('但 3：左高 1、右是空的 −1', '<span class="no">差 2</span>');
  await beat(tok, 2600);
  glow(n5, '#5a1010'); setTag(n5, 'h_L −1、h_R 1', true);
  say('5 也一樣：左 −1、右 1', '<span class="no">差 2</span>');
  await beat(tok, 2600);
  say('AVL：每個節點都要成立', '有一個不平衡，整棵就不是 AVL');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-complete-avl', '13 個節點的 complete tree 一定是 AVL', async (tok) => {
  fresh(...CAM);
  const n = 13, keyOf = {}, pos = {};
  let r = 0;
  (function w(i) { if (i > n) return; w(2 * i); keyOf[i] = ++r; w(2 * i + 1); })(1);
  const hh = (i) => (i > n ? -1 : 1 + Math.max(hh(2 * i), hh(2 * i + 1)));
  const ms = {};
  say('任何 n 都能排成 AVL 嗎？例如 13', '像 heap 一樣一層一層填滿');
  await beat(tok, 2400);
  for (let lv = 0; lv < 4; lv++) {
    for (let i = 1 << lv; i < Math.min(n + 1, 2 << lv); i++) {
      pos[i] = [(keyOf[i] - 7) * 0.9, 6.4 - lv * 1.45];
      ms[i] = cube(keyOf[i], colorFor(keyOf[i]), [0.65, 0.5, 0.65], pos[i][0], pos[i][1], 0, 3);
      if (i > 1) line(pos[i >> 1][0], pos[i >> 1][1], pos[i][0], pos[i][1], -0.05);
    }
    say('第 ' + (lv + 1) + ' 層', lv < 3 ? '填滿' : '最後一層從左邊開始放');
    await beat(tok, 1100);
  }
  say('值照中序排：它也是 BST', '1 … 13 從左到右');
  await beat(tok, 2200);
  const tags = [];
  for (let i = 1; i <= n; i++) { const d = hh(2 * i) - hh(2 * i + 1); tags.push(tag('差 ' + Math.abs(d), 'idx', pos[i][0], pos[i][1] + 0.6)); }
  say('只有最後一層沒滿', 'root 到底的路徑：⌊log n⌋ 或少 1');
  await beat(tok, 2600);
  say('每個節點左右高度差 ≤ 1', '<span class="ok">complete tree 一定是 AVL</span>');
  await beat(tok, 3000);
}]);

// 一次旋轉（一直線）：k−1 | (k−1 或 k, k)
FRAG.push(['bstc-rebal-straight', 'Rebalance 情況一：一直線，一次左旋', async (tok) => {
  fresh(...CAM);
  const R = rig();
  R.node('A', 'A', -1.5, 6.0, BLUE); R.node('B', 'B', 1.0, 4.6, TEAL);
  R.sub('s1', 'k−1', -3.0, 4.6); R.sub('s2', 'k−1 或 k', -0.3, 3.2); R.sub('s3', 'k', 2.3, 3.2);
  R.wire([['A', 's1'], ['A', 'B'], ['B', 's2'], ['B', 's3']]);
  const hA = R.hang('A', ''), hB = R.hang('B', '');
  say('rebalance(A)：子樹高度如圖', '灰塊上的字 = 子樹高度');
  await beat(tok, 2600);
  txt(hB, 'h = k+1');
  say('B 的子樹：k−1 或 k，和 k', 'h(B) = k + 1');
  await beat(tok, 2400);
  txt(hA, 'k−1 vs k+1'); hA.element.className = 'lab-label ptr alt'; KG(R.m.A, BAD);
  say('A：左 k−1、右 k+1', '<span class="no">差 2 → check_RI 會失敗</span>');
  await beat(tok, 2600);
  for (const id of ['A', 'B', 's3']) KG(R.m[id], id === 'A' ? BAD : '#4a3600');
  say('heavy path：右 → 右，一直線', '對 A 左旋一次');
  await beat(tok, 2200);
  R.place({ B: [0, 6.0], A: [-1.6, 4.6], s1: [-2.9, 3.2], s2: [-0.4, 3.2], s3: [1.6, 4.6] });
  R.wire([['B', 'A'], ['B', 's3'], ['A', 's1'], ['A', 's2']]);
  KG(R.m.A, null); KG(R.m.B, null); KG(R.m.s3, null);
  txt(hA, 'h = k 或 k+1'); hA.element.className = 'lab-label idx';
  txt(hB, 'k(+1) vs k');
  say('B 升上來，A 降到左邊', 'A：k−1 vs k−1 或 k → h = k 或 k+1');
  await beat(tok, 2800);
  say('B：k 或 k+1 vs k', '<span class="ok">差 ≤ 1 → 平衡，一次旋轉搞定</span>');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-rebal-zigzag', 'Rebalance 情況二：zigzag，先右旋再左旋', async (tok) => {
  fresh(...CAM);
  const R = rig();
  R.node('A', 'a', -2.0, 6.2, BLUE); R.node('B', 'b', 0.8, 4.9, TEAL); R.node('C', 'c', -0.5, 3.6, PURP);
  R.sub('sA', 'k−1', -3.6, 4.9); R.sub('sB', 'k−1', 2.1, 3.6); R.sub('c1', 'k−1', -1.5, 2.3); R.sub('c2', 'k−1', 0.5, 2.3);
  const W1 = [['A', 'sA'], ['A', 'B'], ['B', 'C'], ['B', 'sB'], ['C', 'c1'], ['C', 'c2']];
  R.wire(W1);
  const hA = R.hang('A', 'k−1 vs k+1', 'ptr alt'), hB = R.hang('B', 'h = k+1'), hC = R.hang('C', 'h = k');
  KG(R.m.A, BAD);
  say('a：左 k−1、右 k+1', '<span class="no">不是 AVL</span>');
  await beat(tok, 2600);
  KG(R.m.B, '#4a3600'); KG(R.m.C, '#4a3600');
  say('heavy path：右 → 左，是 zigzag', '直接對 a 左旋修不好');
  await beat(tok, 2800);
  R.place({ C: [0.8, 4.9], B: [2.1, 3.6], c2: [1.3, 2.3], sB: [2.9, 2.3], c1: [-0.5, 3.6] });
  R.wire([['A', 'sA'], ['A', 'C'], ['C', 'c1'], ['C', 'B'], ['B', 'c2'], ['B', 'sB']]);
  txt(hB, 'h = k'); txt(hC, 'h = k+1');
  say('第 1 步：對 b 右旋', 'c 升上來，b 變 k、c 變 k+1');
  await beat(tok, 2800);
  KG(R.m.B, null);
  say('a 還是 k−1 vs k+1', '但 heavy path 變成一直線了');
  await beat(tok, 2400);
  R.place({ C: [-0.4, 6.2], A: [-2.0, 4.9], sA: [-3.0, 3.6], c1: [-1.0, 3.6], B: [1.2, 4.9], c2: [0.4, 3.6], sB: [2.0, 3.6] });
  R.wire([['C', 'A'], ['C', 'B'], ['A', 'sA'], ['A', 'c1'], ['B', 'c2'], ['B', 'sB']]);
  KG(R.m.A, null); KG(R.m.C, null);
  txt(hA, 'h = k'); hA.element.className = 'lab-label idx'; txt(hB, 'h = k'); txt(hC, 'h = k+1');
  say('第 2 步：對 a 左旋', 'c 當根，左右都是 k');
  await beat(tok, 2800);
  say('一直線 → 1 次；zigzag → 2 次', '先看重的那邊的子，哪邊比較高');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-rot-heights', '旋轉後更新高度：先 A 再 B', async (tok) => {
  fresh(...CAM);
  const R = rig();
  R.node('A', 'A', 0, 6.0, BLUE); R.node('B', 'B', -1.6, 4.6, TEAL);
  R.sub('a', 'a h1', -2.6, 3.2); R.sub('c', 'c h0', -0.6, 3.2); R.sub('d', 'd h0', 1.6, 4.6);
  R.wire([['A', 'B'], ['A', 'd'], ['B', 'a'], ['B', 'c']]);
  const hA = R.hang('A', 'h 3'), hB = R.hang('B', 'h 2');
  say('舉例高度：A = 3、B = 2', '對 A 右旋');
  await beat(tok, 2600);
  R.place({ B: [0, 6.0], A: [1.6, 4.6], a: [-1.6, 4.6], c: [0.6, 3.2], d: [2.6, 3.2] });
  R.wire([['B', 'a'], ['B', 'A'], ['A', 'c'], ['A', 'd']]);
  say('旋轉後：子樹 a、c、d 內部都沒變', '只有 A、B 的高度可能變');
  await beat(tok, 2800);
  txt(hB, 'h 4 ✗'); hB.element.className = 'lab-label ptr alt'; KG(R.m.B, BAD);
  say('先算 B？會用到 A 的舊高度 3', '<span class="no">max(1, 3) + 1 = 4 ✗</span>');
  await beat(tok, 2800);
  KG(R.m.B, null); txt(hB, 'h ?'); hB.element.className = 'lab-label idx';
  KG(R.m.A, '#4a3600'); txt(hA, 'h 1');
  say('先算 A（現在在下面）', 'h(A) = max(c 0, d 0) + 1 = 1');
  await beat(tok, 2600);
  KG(R.m.A, null); KG(R.m.B, '#4a3600'); txt(hB, 'h 2');
  say('再算 B', 'h(B) = max(a 1, A 1) + 1 = 2');
  await beat(tok, 2600);
  KG(R.m.B, null);
  say('update_height 假設子節點高度已正確', '<span class="ok">由下往上：先 A、再 B</span>');
  await beat(tok, 3000);
}]);

// ═══ Abdul Bari 10.1 AVL Tree ═══
async function walkSay(t, key, tok) {
  let x = t.root, c = 0;
  while (x) {
    c++; cursorTo(bst.cur, x.pos);
    if (key === x.key) { glow(x, '#163a2a'); say('找 ' + key + '：是 ' + x.key + ' → 找到', '比較 ' + c + ' 次'); await beat(tok, 1800); glow(x, '#000'); return c; }
    say('找 ' + key + '：跟 ' + x.key + ' 比', key < x.key ? key + ' < ' + x.key + ' → 往左' : key + ' > ' + x.key + ' → 往右');
    await beat(tok, 1300);
    x = key < x.key ? x.left : x.right;
  }
  say('那邊是空的 → 搜尋失敗', '<span class="no">還是比較了 ' + c + ' 次</span>');
  await beat(tok, 2000);
  return c;
}
FRAG.push(['bstc-bari-search', 'BST 搜尋 30、60、32：比較次數 ≤ 高度', async (tok) => {
  const t = bstStage([40, 20, 50, 10, 30, 60]);
  say('BST：左子樹都小、右子樹都大', '例：20 的左邊 10、右邊 30');
  await beat(tok, 2400);
  await walkSay(t, 30, tok);
  await walkSay(t, 60, tok);
  await walkSay(t, 32, tok);
  hideCursor(bst.cur);
  say('成功或失敗，最多比較「高度」次', '高度（從 1 數）= 3 → 搜尋時間看 h');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-two-orders', '同一組 key：高度 3 或高度 7', async (tok) => {
  fresh([0, 4.3, 13.5], [0, 3.8, 0]);
  const small = { size: [0.55, 0.42, 0.55], width: 5.4, maxSp: 0.9, topY: 6.5, minY: 0.6, maxStep: 1.3 };
  const l = makeView(Object.assign({ cx: -3.5 }, small)), r = makeView(Object.assign({ cx: 3.5 }, small));
  const A = [30, 40, 10, 50, 20, 5, 35], B = [50, 40, 35, 30, 20, 10, 5];
  const ll = tag(A.join(', '), 'ptr', -3.5, 7.5), rl = tag(B.join(', '), 'ptr alt', 3.5, 7.5);
  say('同一組 7 個 key，兩種插入順序', '每個 key 都從 root 開始比');
  await beat(tok, 2400);
  for (let i = 0; i < 7; i++) {
    const a = attach(l, mk(A[i])); layout(l); dropIn(a);
    const b = attach(r, mk(B[i])); layout(r); dropIn(b);
    say('insert ' + A[i] + ' ／ insert ' + B[i], '左 h = ' + height(l.root) + '，右 h = ' + height(r.root));
    await beat(tok, 1100);
  }
  txt(ll, '高度 3 ≈ log n'); txt(rl, '高度 7 = n');
  say('左邊 h = 3；右邊一路往左長', '<span class="no">右邊 h = n = 7</span>');
  await beat(tok, 2600);
  const cur = makeCursor();
  let x = r.root, c = 0;
  while (x) { c++; cursorTo(cur, x.pos); say('找 5：第 ' + c + ' 次比較', ''); await beat(tok, 500); x = x.left; }
  say('找 5 要比 7 次', '<span class="no">跟 linear search 一樣 O(n)</span>');
  await beat(tok, 2600);
  say('BST 的高度不受控制', '看 key 插入的順序：log n ～ n');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-six-orders', '3 個 key 的 6 種插入順序', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.8, 0]);
  const ORD = [[30, 20, 10], [30, 10, 20], [10, 30, 20], [10, 20, 30], [20, 10, 30], [20, 30, 10]];
  const XS = { 10: -1, 20: 0, 30: 1 };
  say('10, 20, 30 有 3! = 6 種順序', '每一種建一棵 BST');
  await beat(tok, 2200);
  const hs = [];
  for (const [i, o] of ORD.entries()) {
    const cx = (i % 3 - 1) * 4.4, top = i < 3 ? 6.2 : 2.9;
    tag(o.join(', '), 'idx', cx, top + 0.85);
    const t = { root: null }, seen = [];
    for (const k of o) {
      const z = attach(t, mk(k)); let d = 0; for (let p = z.parent; p; p = p.parent) d++;
      const x = cx + XS[k] * 1.0, y = top - d * 0.95;
      z.m = cube(k, colorFor(k), [0.6, 0.48, 0.6], x, y, 0, 3); z.xy = [x, y];
      if (z.parent) line(z.parent.xy[0], z.parent.xy[1], x, y, -0.05);
      seen.push(z);
    }
    hs.push([cx, top, height(t.root), seen]);
    say(o.join(', '), '高度 ' + height(t.root));
    await beat(tok, 1300);
  }
  for (const [cx, top, h, ns] of hs) {
    tag('h = ' + h, h === 3 ? 'ptr alt' : 'ptr', cx + 1.7, top - 1.0);
    if (h === 2) ns.forEach((z) => KG(z.m, '#163a2a'));
  }
  say('4 種長成一條：高度 3', '只有 20 先進來的 2 種：高度 2');
  await beat(tok, 3000);
  say('我們要的是最矮的那種', '高度小 → 搜尋快');
  await beat(tok, 2600);
}]);

FRAG.push(['bstc-bari-rot-idea', '用旋轉把高的 BST 拉成平衡', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 4.4, 0]);
  const SH = [
    { o: [30, 20, 10], cx: -5.1, d: { 30: 0, 20: 1, 10: 2 }, mid: null, n: '30,20,10' },
    { o: [10, 20, 30], cx: -1.7, d: { 10: 0, 20: 1, 30: 2 }, mid: null, n: '10,20,30' },
    { o: [30, 10, 20], cx: 1.7, d: { 30: 0, 10: 1, 20: 2 }, mid: { 30: 0, 20: 1, 10: 2 }, n: '30,10,20' },
    { o: [10, 30, 20], cx: 5.1, d: { 10: 0, 30: 1, 20: 2 }, mid: { 10: 0, 20: 1, 30: 2 }, n: '10,30,20' },
  ];
  const XS = { 10: -0.8, 20: 0, 30: 0.8 }, Y = (d) => 6.4 - d * 1.2;
  const BAL = { 20: 0, 10: 1, 30: 1 };
  const draw = (s, dep) => {
    (s.ls || []).forEach(kill);
    const ks = Object.keys(dep).map(Number).sort((a, b) => dep[a] - dep[b]);
    for (const k of ks) { const x = s.cx + XS[k], y = Y(dep[k]); if (!s.m[k]) s.m[k] = cube(k, colorFor(k), [0.6, 0.48, 0.6], x, y, 0, 3); else move(s.m[k], x, y); }
    const par = (k) => ks.find((j) => dep[j] === dep[k] - 1);
    s.ls = ks.filter((k) => dep[k] > 0).map((k) => { const p = par(k); return line(s.cx + XS[p], Y(dep[p]), s.cx + XS[k], Y(dep[k]), -0.05); });
  };
  for (const s of SH) { s.m = {}; draw(s, s.d); tag(s.n, 'idx', s.cx, 7.3); }
  say('同樣 3 個 key，4 種高的形狀', '想把它們都變成 20 在中間');
  await beat(tok, 2800);
  KG(SH[0].m[30], '#4a3600');
  say('繞著 30 把它往右拉', '20 升上來，30 往右下');
  await beat(tok, 1600);
  draw(SH[0], BAL);
  KG(SH[0].m[30], null);
  await beat(tok, 1400);
  KG(SH[1].m[10], '#4a3600');
  say('另一邊：繞著 10 往左拉', '像釘子上的線，一拉 20 就升上來');
  await beat(tok, 1600);
  draw(SH[1], BAL); KG(SH[1].m[10], null);
  await beat(tok, 1600);
  say('zigzag：一步做不到', '先繞 10 轉，再繞 30 轉');
  await beat(tok, 2000);
  draw(SH[2], SH[2].mid); draw(SH[3], SH[3].mid);
  say('第 1 步：先拉成一直線', '');
  await beat(tok, 1800);
  draw(SH[2], BAL); draw(SH[3], BAL);
  say('第 2 步：再轉一次', '4 種旋轉：2 種單旋、2 種雙旋');
  await beat(tok, 2200);
  say('不管樹多大，旋轉只動 3 個節點', '整棵樹因此變平衡');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-bf', 'Balance factor = h(左) − h(右)', async (tok) => {
  fresh(...CAM);
  const T1 = { r: [-4.0, 6.0, 0], L: [-4.8, 4.7, 1], LL: [-5.6, 3.4, 0], R: [-2.4, 4.7, 1], RL: [-3.2, 3.4, 0] };
  const T2 = { r: [3.9, 6.0, 2], X: [1.4, 4.7, -2], Y: [3.0, 3.4, 1], Z: [2.2, 2.1, 0], W: [5.4, 4.7, 0] };
  const E1 = [['r', 'L'], ['r', 'R'], ['L', 'LL'], ['R', 'RL']], E2 = [['r', 'X'], ['r', 'W'], ['X', 'Y'], ['Y', 'Z']];
  const ms = {};
  for (const [T, E, p] of [[T1, E1, 'a'], [T2, E2, 'b']]) {
    for (const k in T) ms[p + k] = cube(' ', '#c9b48e', [0.7, 0.55, 0.7], T[k][0], T[k][1], 0, 3);
    for (const [u, v] of E) line(T[u][0], T[u][1], T[v][0], T[v][1], -0.05);
  }
  say('bf = h(左子樹) − h(右子樹)', '平衡：bf ∈ {−1, 0, 1}，即 |bf| ≤ 1');
  await beat(tok, 2800);
  const fill = (p, T, ks) => ks.forEach((k) => { const b = T[k][2], m = ms[p + k]; relabel(m, (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b)); K.tint(m, Math.abs(b) > 1 ? '#d64545' : '#2fc092'); });
  fill('a', T1, ['LL', 'RL']);
  say('leaf 的 bf 一定是 0', '');
  await beat(tok, 1600);
  fill('a', T1, ['L', 'R']);
  say('只有左子：1 − 0 = 1', '');
  await beat(tok, 1800);
  fill('a', T1, ['r']);
  say('root：左邊最長 2、右邊 2', '2 − 2 = 0 → 這棵全部平衡');
  await beat(tok, 2600);
  fill('b', T2, ['Z', 'W']);
  fill('b', T2, ['Y']);
  say('右邊這棵：高度數「邊」不數節點', '');
  await beat(tok, 2000);
  fill('b', T2, ['r']);
  say('root：左邊最長 3 條邊、右邊 1', '<span class="no">3 − 1 = 2 → 失衡</span>');
  await beat(tok, 2600);
  fill('b', T2, ['X']);
  say('這個節點：左 0、右 2', '<span class="no">0 − 2 = −2 → 失衡</span>');
  await beat(tok, 2600);
  say('有任何節點失衡，就要旋轉', '');
  await beat(tok, 2400);
}]);

const BARI = { LL: [[30, 20], 10, 'LL：20 升上來', '30 到右邊，10 留在左邊'], LR: [[30, 10], 20, 'LR：兩步算一次旋轉', '20 當根，10 左、30 右'],
  RR: [[10, 20], 30, 'RR：20 升上來', '10 到左邊，30 留在右邊'], RL: [[10, 30], 20, 'RL：也是兩步的雙旋', '20 當根，10 左、30 右'] };
FRAG.push(['bstc-bari-rot', 'LL / LR / RR / RL：3 個 key 的旋轉', async (tok) => {
  const ty = BARI[(ctx.params || {}).type] ? ctx.params.type : 'LL';
  const [pre, k, c1, f1] = BARI[ty];
  avlStage(pre);
  say('先有 ' + pre.join('、') + '：都平衡', '方塊上方 = bf');
  await beat(tok, 2400);
  say('insert ' + k, ty === 'LL' ? '插在左的左' : ty === 'RR' ? '插在右的右' : ty === 'LR' ? '插在左的右' : '插在右的左');
  await avlInsert(k, tok);
  say(c1, f1);
  await beat(tok, 2600);
  say('失衡怎麼來，旋轉就叫什麼', ty + ' 失衡 → ' + ty + ' rotation');
  await beat(tok, 2600);
}]);

FRAG.push(['bstc-bari-ll-general', 'LL 一般形：B 的右子樹接到 A 的左邊', async (tok) => {
  fresh(...CAM);
  const R = rig();
  R.node('A', 'A', 0.6, 6.2, BLUE); R.node('B', 'B', -0.9, 4.9, TEAL); R.node('C', 'C', -2.2, 3.6, PURP);
  R.sub('CL', 'C_L', -3.0, 2.3); R.sub('CR', 'C_R', -1.4, 2.3); R.sub('BR', 'B_R', 0.2, 3.6); R.sub('AR', 'A_R', 2.2, 4.9);
  R.wire([['A', 'B'], ['A', 'AR'], ['B', 'C'], ['B', 'BR'], ['C', 'CL'], ['C', 'CR']]);
  say('大樹裡：A 因為插在左的左而失衡', 'LL 旋轉只看 A、B、C 三個');
  await beat(tok, 2800);
  KG(R.m.A, BAD);
  say('灰塊 = 下面不知道多大的子樹', '它們跟著自己的節點走');
  await beat(tok, 2200);
  R.place({ B: [0.6, 6.2], C: [-0.9, 4.9], A: [2.2, 4.9], CL: [-1.7, 3.6], CR: [-0.1, 3.6], AR: [3.0, 3.6] });
  R.wire([['B', 'C'], ['B', 'A'], ['B', 'BR'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  KG(R.m.A, null);
  say('B 升上來，C 在左、A 在右', 'C_L、C_R、A_R 位置不變');
  await beat(tok, 2600);
  KG(R.m.BR, '#4a3600');
  say('B_R 呢？B 的右邊已經是 A', '只剩 A 的左邊是空的');
  await beat(tok, 2400);
  R.go('BR', 1.4, 3.6);
  R.wire([['B', 'C'], ['B', 'A'], ['A', 'BR'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  say('B_R 接到 A 的左邊', 'B < B_R < A，中序不變');
  await beat(tok, 2600);
  KG(R.m.BR, null);
  say('像繞著釘子拉線：掛著的東西換邊', 'RR 就是左右對調');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-lr-general', 'LR 一步到位：C 升為根，C_L、C_R 分給兩邊', async (tok) => {
  fresh(...CAM);
  const R = rig();
  R.node('A', 'A', 1.2, 6.2, BLUE); R.node('B', 'B', -1.4, 4.9, TEAL); R.node('C', 'C', -0.2, 3.6, PURP);
  R.sub('AR', 'A_R', 2.6, 4.9); R.sub('BL', 'B_L', -2.6, 3.6); R.sub('CL', 'C_L', -1.0, 2.3); R.sub('CR', 'C_R', 0.6, 2.3);
  R.wire([['A', 'B'], ['A', 'AR'], ['B', 'BL'], ['B', 'C'], ['C', 'CL'], ['C', 'CR']]);
  KG(R.m.A, BAD);
  say('A 失衡：插在左的右 → LR', '3 個節點：A、B、C');
  await beat(tok, 2600);
  KG(R.m.C, '#4a3600');
  say('一步到位：最後的 C 直接升成根', 'B 留在左、A 去右邊');
  await beat(tok, 2400);
  R.place({ C: [0, 6.2], B: [-1.6, 4.9], A: [1.6, 4.9], BL: [-2.6, 3.6], AR: [2.6, 3.6] });
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  KG(R.m.A, null);
  say('B_L、A_R 原地不動', '剩下 C 自己的兩棵子樹');
  await beat(tok, 2400);
  KG(R.m.CL, '#4a3600'); R.go('CL', -0.8, 3.6);
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['B', 'CL'], ['A', 'AR'], ['C', 'CR']]);
  say('C_L 還在 C 的左邊', '變成 B 的右子樹');
  await beat(tok, 2400);
  KG(R.m.CL, null); KG(R.m.CR, '#4a3600'); R.go('CR', 0.8, 3.6);
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['B', 'CL'], ['A', 'CR'], ['A', 'AR']]);
  say('C_R 還在 C 的右邊', '變成 A 的左子樹');
  await beat(tok, 2400);
  KG(R.m.CR, null); KG(R.m.C, null);
  say('RL 對稱：C 升上，A 去左邊', '當公式記：中序 B_L B C_L C C_R A A_R');
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-build', '建 AVL：40, 20, 10, 25, 30, 22, 50', async (tok) => {
  const p = ctx.params || {};
  const pre = Array.isArray(p.pre) ? p.pre : [], ins = Array.isArray(p.ins) ? p.ins : [40, 20, 10, 25];
  avlStage(pre);
  say(pre.length ? '目前：依序插入過 ' + pre.join(', ') : '一個一個插入，邊插邊算 bf', '每插一個就檢查，失衡馬上轉');
  await beat(tok, 2400);
  for (const k of ins) {
    say('insert ' + k, '從 root 比大小找位置');
    await avlInsert(k, tok);
    await beat(tok, 800);
  }
  say('所有節點 |bf| ≤ 1', 'root = ' + avl.t.root.key + '，中序 ' + keys(inorder(avl.t.root)));
  await beat(tok, 3000);
}]);

FRAG.push(['bstc-bari-42', '大樹插入 42：RL 旋轉，45 升上來', async (tok) => {
  avlStage([40, 20, 50, 10, 30, 45, 60, 41, 47, 70]);
  say('一棵比較大的 AVL', '每個節點 bf 都在 −1..1');
  await beat(tok, 2600);
  say('insert 42：> 40、< 50、< 45、> 41', '接在 41 的右邊');
  await avlInsert(42, tok);
  say('路徑 R L L R：只看失衡點下兩步', 'RL：45 升上來，40 到左、50 到右');
  await beat(tok, 3000);
  say('AVL 高度最多約 1.44 log₂ n', '搜尋 <span class="ok">O(log n)</span>');
  await beat(tok, 3000);
}]);
  }

  // ═══ bstlin.js ═══
  {
// ─── Lzr5-m7ap-8：台大林軒田 DSA Skip List / BST / AVL Tree ───
// 例子取自影片：extendible hash 的 cat / good / cool；linked list 2 4 5 9 10 11 15 20（找 10、找 15）；
// 第二個 skip list 2 3 5 8 9 10 13（找 9、找 6、插 6、丟銅板）；skip list → BST（8 / 3,13 / 2,5,10）；
// complete BST 1 2 3 插 4；AVL 插 3 5 8；RR 通例（A、B、AL、BL、BR，高度 10 / 11）；AVL 依序插 1…7。
// 高度以層數計（空樹 0、一個 node 1），bf = hL − hR；RR = 插在失衡點 A 的右邊的右邊。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, GOLD, GREEN, RED, GRAY } = K;

// ── skip list 共用：slots 決定 x 位置（可以留空位給之後插入的 key） ──
function SL(slots, levels, names, o = {}) {
  const dx = o.dx || 1.35, y0 = 0.4, dy = o.dy || 1.35;
  const X = (k) => (slots.indexOf(k) - (slots.length - 1) / 2) * dx;
  const HX = X(slots[0]) - dx * 1.15;
  const Y = (l) => y0 + l * dy;
  const lv = [], heads = [];
  let arrs = [];
  const s = {
    X, Y, HX, lv,
    get: (l, k) => lv[l] && lv[l].get(k),
    add(l, k, drop) {
      while (lv.length <= l) lv.push(new Map());
      const sz = l ? [0.72, 0.5, 0.72] : [0.92, 0.66, 0.92];
      lv[l].set(k, cube(k, colorFor(k), sz, X(k), Y(l), 0, drop ? 3 : 0));
      if (!heads[l]) heads[l] = tag(names[l] || ('L' + l), 'idx', HX, Y(l), 0);
    },
    del(l, k, doFly) { const m = lv[l] && lv[l].get(k); if (!m) return; lv[l].delete(k); if (doFly) fly(m, V3(0, 6, 4)); else kill(m); },
    links() {
      arrs.forEach(kill); arrs = [];
      lv.forEach((mp, l) => {
        const ks = slots.filter((k) => mp.has(k)); if (!ks.length) return;
        const w = l ? 0.36 : 0.46;
        let px = HX + 0.55;
        for (const k of ks) { const x = X(k); if (x - w - px > 0.1) arrs.push(arrow(V3(px, Y(l), 0), V3(x - w, Y(l), 0))); px = x + w; }
      });
    },
  };
  levels.forEach((ks, l) => ks.forEach((k) => s.add(l, k)));
  s.links();
  return s;
}
function cursor() {
  const c = tag('▼', 'ptr alt', 0, -5, 0);
  return { c, at(s, l, k) { c.position.set(k === 'H' ? s.HX : s.X(k), s.Y(l) + 0.62, 0); } };
}
const LIN8 = [2, 4, 5, 9, 10, 11, 15, 20];

// ── BST / AVL 共用：小 BST + 依 inorder 排版的畫面 ──
const mkN = (k) => ({ k, l: null, r: null });
function bstIns(t, k) {
  const n = mkN(k); if (!t.root) { t.root = n; return n; }
  let x = t.root;
  for (;;) { if (k < x.k) { if (!x.l) { x.l = n; break; } x = x.l; } else { if (!x.r) { x.r = n; break; } x = x.r; } }
  return n;
}
const hgt = (n) => (n ? 1 + Math.max(hgt(n.l), hgt(n.r)) : 0);
function parOf(t, n) { let p = null, x = t.root; while (x && x !== n) { p = x; x = n.k < x.k ? x.l : x.r; } return p; }
function rotUp(t, a, dir) { // dir 'L'：右小孩拉上來（RR 用）；'R'：左小孩拉上來（LL 用）
  const p = parOf(t, a), b = dir === 'L' ? a.r : a.l;
  if (dir === 'L') { a.r = b.l; b.l = a; } else { a.l = b.r; b.r = a; }
  if (!p) t.root = b; else if (p.l === a) p.l = b; else p.r = b;
  return b;
}
function firstBad(t, k) { // 從 k 往上找回來：第一個（最深的）|bf| > 1
  let x = t.root, bad = null;
  while (x) { if (Math.abs(hgt(x.l) - hgt(x.r)) > 1) bad = x; if (k === x.k) break; x = k < x.k ? x.l : x.r; }
  return bad;
}
function findN(t, k) { let x = t.root; while (x && x.k !== k) x = k < x.k ? x.l : x.r; return x; }
function TV(t, o = {}) {
  const dx = o.dx || 1.25, dy = o.dy || 1.45, top = o.top || 5.2, cx = o.cx || 0;
  const cubes = o.cubes || new Map(), labs = new Map();
  let edges = [];
  const v = { cubes, t, P: new Map() };
  v.sync = (newK) => {
    const arr = [];
    (function io(n, d) { if (!n) return; io(n.l, d + 1); arr.push([n, d]); io(n.r, d + 1); })(t.root, 0);
    v.P = new Map(arr.map(([n, d], i) => [n.k, V3(cx + (i - (arr.length - 1) / 2) * dx, top - d * dy, 0)]));
    edges.forEach(kill); edges = [];
    (function walk(n) {
      if (!n) return;
      const p = v.P.get(n.k);
      if (!cubes.has(n.k)) cubes.set(n.k, cube(n.k, colorFor(n.k), [0.85, 0.85, 0.85], p.x, p.y, 0, n.k === newK ? 3.5 : 0));
      else move(cubes.get(n.k), p.x, p.y, 0);
      for (const c of [n.l, n.r]) if (c) { const q = v.P.get(c.k); edges.push(line(p.x, p.y, q.x, q.y, 0)); }
      if (o.lab) {
        const b = hgt(n.l) - hgt(n.r);
        let l = labs.get(n.k); if (!l) { l = tag('', 'idx', 0, 0, 0); labs.set(n.k, l); }
        txt(l, o.lab(n)); l.position.set(p.x + 0.8, p.y + 0.5, 0);
        l.element.className = 'lab-label ' + (Math.abs(b) > 1 ? 'ptr' : 'idx');
        glow(cubes.get(n.k), Math.abs(b) > 1 ? RED : null);
      }
      walk(n.l); walk(n.r);
    })(t.root);
  };
  v.c = (k) => cubes.get(k);
  return v;
}
const BF = (n) => { const b = hgt(n.l) - hgt(n.r); return 'bf ' + (b > 0 ? '+' + b : b); };

// ═════════ 0. 開場 Q&A：extendible hash 的懶惰分家 ═════════
FRAG.push(['bstlin-lazy-split', 'Extendible hash：滿出來才分家', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.4, 0]);
  const BX = (i) => (i - 3.5) * 1.55, BY = (j) => 0.4 + j * 0.68;
  const slot = (i) => { ctx.tile(V3(BX(i), 0.02, 0), 1.35, 1.35); tag('[' + i + ']', 'idx', BX(i), 0.1, 1.25); };
  for (let i = 0; i < 4; i++) slot(i);
  const W = (w, i, j, d) => cube(w, w === 'good' ? '#4b9ee2' : '#dd8238', [1.25, 0.58, 1.1], BX(i), BY(j), 0, d ? 4 : 0);
  say('hash：看首字母（a=0…）mod 4', 'cat → c = 2；good → g = 6 mod 4 = 2');
  const cat = W('cat', 2, 0, true); await beat(tok, 900);
  const good = W('good', 2, 1, true);
  await beat(tok, 2200);
  say('表格變大：mod 4 → mod 8', 'good：6 mod 8 = 6，應該去 [6]');
  for (let i = 4; i < 8; i++) slot(i);
  await beat(tok, 2400);
  say('笨方法：每個 key 全部重新 hash', '<span class="no">花重複的力氣</span>');
  await beat(tok, 2200);
  const note = tag('找 [6] → 去 [2] 找', 'ptr alt', BX(6), 2.1, 0);
  const ar = arrow(V3(BX(6) - 0.4, 1.7, 0), V3(BX(2) + 0.8, 1.2, 0));
  say('偷懶：[6] 留張紙條指向 [2]', '還沒滿：cat、good 先共用一串（最多 2 個）');
  await beat(tok, 2800);
  const cool = W('cool', 2, 2, true);
  say('insert cool（c 開頭）：[2] 變 3 個', '<span class="no">超過上限 → 這時才分家</span>');
  glow(cool, RED); await beat(tok, 2200);
  glow(cool, null); kill(ar); kill(note);
  move(good, BX(6), BY(0), 0); move(cool, BX(2), BY(1), 0);
  say('分家：good 搬去 [6]，cat、cool 留下', '用到的時候才做（lazy）');
  glow(good, GREEN);
  await beat(tok, 3000);
}]);

// ═════════ 1. Linked list 做 map：只能慢慢找 ═════════
FRAG.push(['bstlin-list-map', 'Linked list 做 map：search 只能一站一站停', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 1.4, 0]);
  const s = SL(LIN8, [LIN8], ['head']);
  const cu = cursor();
  say('unordered list：insert 很快', '但 search 只能從頭一個一個比');
  await beat(tok, 2600);
  say('排好序（ordered）也一樣', '沒有 random access → 找不到中點，不能 binary search');
  await beat(tok, 2800);
  let cnt = 0;
  for (const k of LIN8) {
    cnt++; cu.at(s, 0, k); const m = s.get(0, k); glow(m, GOLD);
    say('search 10：比 ' + k, '比較次數 = ' + cnt);
    await beat(tok, 750);
    if (k === 10) { glow(m, GREEN); break; }
    glow(m, null);
  }
  say('10 排第 5 個：比了 5 次', 'sequential search：<span class="no">O(n)</span>');
  await beat(tok, 2400);
  say('ordered insert 也得先找位置', 'slow search，而且 slow insertion');
  await beat(tok, 2800);
}]);

// ═════════ 2. 在 list 上做 binary search：先存中點 ═════════
FRAG.push(['bstlin-mid-pointer', '多存「中點」：在 linked list 上做 binary search', async (tok) => {
  fresh([0, 4.8, 12.5], [0, 1.6, 0]);
  const s = SL(LIN8, [LIN8], ['head']);
  say('binary search 第一步：找中點', 'list 只能從 head 走 → 有心無力');
  await beat(tok, 2600);
  const m1 = tag('中點', 'ptr alt', s.X(9), 2.6, 0), a1 = arrow(V3(s.X(9), 2.3, 0), V3(s.X(9), 0.9, 0));
  say('額外存一張紙條：中點在 9', '8 筆資料，中點 = 9');
  await beat(tok, 2400);
  glow(s.get(0, 9), GOLD);
  say('search 10：先跟中點 9 比', '10 > 9 → 在 9 的後面');
  await beat(tok, 2200);
  for (const k of [2, 4, 5, 9]) tint(s.get(0, k), GRAY);
  say('一次就消掉一半：2、4、5 不用找', '跟 binary search 一樣砍一半');
  await beat(tok, 2600);
  const m2 = tag('中點 2', 'ptr alt', s.X(11), 2.6, 0), a2 = arrow(V3(s.X(11), 2.3, 0), V3(s.X(11), 0.9, 0));
  glow(s.get(0, 11), GOLD);
  say('9 後面再存一個中點：11', '10 < 11 → 在 9 和 11 之間');
  await beat(tok, 2600);
  for (const k of [11, 15, 20]) tint(s.get(0, k), GRAY);
  glow(s.get(0, 10), GREEN);
  say('找到 10', '要很多「中點」紙條帶路');
  await beat(tok, 2800);
  [m1, a1, m2, a2].forEach(kill);
}]);

// ═════════ 3. 快車：兩站一停 ═════════
FRAG.push(['bstlin-fast-lane', '快車 linked list：兩站一停', async (tok) => {
  fresh([0, 5, 12.5], [0, 1.4, 0]);
  const s = SL(LIN8, [LIN8], ['普通車', '快車']);
  say('原本的 list = 每站都停的普通車', '');
  await beat(tok, 2000);
  for (const k of [4, 9, 11, 20]) { s.add(1, k, true); await beat(tok, 350); }
  s.links();
  say('加一條快車：head → 4 → 9 → 11 → 20', '兩站才停一次');
  await beat(tok, 2600);
  const cu = cursor(); let cnt = 0;
  for (const k of [4, 9, 11]) {
    cnt++; cu.at(s, 1, k); const m = s.get(1, k); glow(m, k === 11 ? RED : GOLD);
    say(k === 11 ? '11 > 10：過頭了' : 'search 10：比 ' + k + '，還在後面', '比較次數 = ' + cnt);
    await beat(tok, 1300);
  }
  cu.at(s, 0, 9); glow(s.get(1, 11), null);
  say('在 9 這站轉普通車', '');
  await beat(tok, 1300);
  cnt++; cu.at(s, 0, 10); glow(s.get(0, 10), GREEN);
  say('普通車下一站就是 10', '4、9、11、10：3～4 次比較');
  await beat(tok, 2400);
  say('原本要比 5 次，現在比較少', '先坐快車，接近了再換慢車');
  await beat(tok, 2600);
}]);

// ═════════ 4. 特快車、超快車 = Skip List；找 15 ═════════
FRAG.push(['bstlin-skip-15', 'Skip list：特快車 → 快車 → 普通車，找 15', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20]], ['普通車', '快車', '特快車', '超快車']);
  say('快車之上再加特快車：9 → 20', '一樣兩個一數');
  for (const k of [9, 20]) { s.add(2, k, true); await beat(tok, 400); }
  s.links(); await beat(tok, 2000);
  const cu = cursor();
  const step = async (l, k, cap, f, col) => { cu.at(s, l, k); const m = s.get(l, k); glow(m, col || GOLD); say(cap, f || ''); await beat(tok, 1500); glow(m, null); };
  await step(2, 9, 'search 15：特快車先到 9', '15 > 9，還在後面');
  await step(2, 20, '跟 20 比：過頭了', '在 9 往下換一層', RED);
  await step(1, 9, '快車：從 9 出發', '');
  await step(1, 11, '11 < 15：往前到 11', '');
  await step(1, 20, '20 又過頭 → 在 11 往下', '', RED);
  await step(0, 11, '普通車：從 11 出發', '');
  cu.at(s, 0, 15); glow(s.get(0, 15), GREEN);
  say('找到 15：有效比較幾乎只有 9、11、15', '（再加兩次跟 20 比）');
  await beat(tok, 2600);
  s.add(3, 9, true); s.links();
  say('最上面的超快車只剩 9：就是中點', '從上往下看：list of mid、list of quad…');
  await beat(tok, 2600);
  say('這就是 Skip List', '每層砍一半：約 log n 層，<span class="ok">O(log n)</span> 次比較');
  await beat(tok, 3000);
}]);

// ═════════ 5. Skip list 吃多少記憶體 ═════════
FRAG.push(['bstlin-skip-space', 'Skip list 的空間：n + n/2 + n/4 + … ≈ 2n', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20], [9, 20], [9]], ['普通車', '快車', '特快車', '超快車']);
  say('問題：skip list 很吃記憶體嗎？', '');
  await beat(tok, 2000);
  const lab = ['n', 'n/2', 'n/4', 'n/8 …'];
  for (let l = 0; l < 4; l++) {
    s.lv[l].forEach((m) => glow(m, GOLD));
    tag(lab[l], 'ptr alt', 5.9, s.Y(l), 0);
    say('第 ' + (l + 1) + ' 層：' + s.lv[l].size + ' 個 node', '約 ' + lab[l]);
    await beat(tok, 1400);
    s.lv[l].forEach((m) => glow(m, null));
  }
  say('上面各層加起來 ≤ 一條 list', 'n(1 + 1/2 + 1/4 + …) ≈ <span class="ok">2n</span>');
  await beat(tok, 2800);
  say('每個箭頭也是一張小紙條，會多一些', '但還是 O(n)，不會變 n²');
  await beat(tok, 2600);
  say('多花約一倍記憶體換快速 search', '有時可以，有時不行（如作業的 DEPQ）');
  await beat(tok, 3000);
}]);

// ═════════ 6. 怎麼存：獨立 list 或一個 node 多個 next；insert 的難題 ═════════
FRAG.push(['bstlin-skip-impl', 'Skip list 怎麼實作，insert 卡在哪', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20], [9, 20], [9]], ['普通車', '快車', '特快車', '超快車']);
  say('寫法一：真的維護好幾條 linked list', '用小紙條表示上下層是同一個 key');
  await beat(tok, 2600);
  for (let l = 0; l < 4; l++) glow(s.get(l, 9), GOLD);
  const ts = ['next[0] 普通車', 'next[1] 快車', 'next[2] 特快車', 'next[3] 超快車'].map((x, l) => tag(x, 'idx', s.X(9) + 0.5, s.Y(l) + 0.55, 0));
  say('寫法二：一個 node 存好幾個 next', '9 這站有 4 種車的「下一站」');
  await beat(tok, 2800);
  say('通常不複製資料，只多存 pointer', '怎麼實作看你的選擇');
  await beat(tok, 2400);
  ts.forEach(kill); for (let l = 0; l < 4; l++) glow(s.get(l, 9), null);
  say('還沒講：這個結構怎麼「從無到有」？', '亂序資料排成 ordered list = insertion sort');
  await beat(tok, 2800);
  for (let l = 0; l < 4; l++) s.lv[l].forEach((m) => glow(m, RED));
  say('一次 insert 可能要改好幾層 list', '目前只解決了 slow search，還有 slow insertion');
  await beat(tok, 3000);
}]);

// ═════════ 7. 第二個例子：找 9、找 6 ═════════
const SL2 = [2, 3, 5, 6, 8, 9, 10, 13];
const SL2LV = () => [[2, 3, 5, 8, 9, 10, 13], [3, 8, 13], [8]];
FRAG.push(['bstlin-skip-search-9-6', 'Skip list：找 9（找到）與找 6（找不到）', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const s = SL(SL2, SL2LV(), ['L1', 'L2', 'L3']);
  say('底層排好：2 3 5 8 9 10 13', '上一層 3 → 8 → 13，最上層 8');
  await beat(tok, 2600);
  const cu = cursor();
  const step = async (l, k, cap, f, col, ms = 1500) => { cu.at(s, l, k); const m = s.get(l, k); glow(m, col || GOLD); say(cap, f || ''); await beat(tok, ms); glow(m, null); };
  await step(2, 8, 'search 9：從 8 進來', '9 > 8 → 往右，右邊沒了 → 下一層');
  await step(1, 8, '第二層從 8 往右看', '');
  await step(1, 13, '13 > 9：過頭了', '在 8 再往下', RED);
  await step(0, 8, '底層從 8 往右', '');
  cu.at(s, 0, 9); glow(s.get(0, 9), GREEN);
  say('找到 9', '快車 → 慢車');
  await beat(tok, 2000); glow(s.get(0, 9), null);
  await step(2, 8, 'search 6：8 已經過頭', '6 < 8', RED);
  await step(1, 3, '回到 3，從 3 找下來', '');
  await step(0, 3, '底層：3 往右', '');
  await step(0, 5, '5 < 6：往前', '');
  await step(0, 8, '下一個是 8：過頭了', '', RED);
  const gh = cube('6?', '#d8cfc0', [0.8, 0.5, 0.8], s.X(6), s.Y(0), 0);
  say('沒有 6：找不到', '而且停在 5 和 8 之間');
  await beat(tok, 2800); kill(gh);
}]);

// ═════════ 8. 插入 6：嚴格兩兩一數會怎樣 ═════════
FRAG.push(['bstlin-skip-strict', 'Insert 6：嚴格規則會讓每層都要改', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const s = SL(SL2, SL2LV(), ['L1', 'L2', 'L3']);
  say('找不到 6 時，已經停在 5 和 8 之間', '');
  await beat(tok, 2000);
  s.add(0, 6, true); s.links();
  say('底層 insert 6：改兩張小紙條', '5 → 6 → 8，linked list 的強項');
  await beat(tok, 2600);
  say('可是上面還有好幾條 list', '嚴格規定：兩兩一數、四四一數…');
  await beat(tok, 2200);
  glow(s.get(1, 8), RED); glow(s.get(2, 8), RED);
  say('L2 該變成 3 6 9 13', '8 要塗掉、換成 6 和 9');
  await beat(tok, 2200);
  s.del(1, 8, true); s.del(2, 8, true);
  await beat(tok, 500);
  s.add(1, 6, true); s.add(1, 9, true); s.add(2, 6, true); s.add(2, 13, true); s.links();
  say('L3 也跟著變：四個一數 → 6、13', '幾乎每一層都要更新');
  await beat(tok, 2600);
  say('上面各層加起來 ≈ n 個 node', '照嚴格規則更新：insert <span class="no">O(n)</span>');
  await beat(tok, 3000);
}]);

// ═════════ 9. 偷懶：丟銅板決定 6 要上幾層 ═════════
FRAG.push(['bstlin-skip-coin', 'Randomized：丟銅板決定新 node 的層數', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const s = SL(SL2, SL2LV(), ['L1', 'L2', 'L3']);
  say('放鬆規則：「大概」兩兩一數就好', '');
  await beat(tok, 2000);
  s.add(0, 6, true); s.links();
  say('6 先放進底層', '一定在 L1');
  await beat(tok, 1600);
  const coin = cube('', '#c08a1f', [0.9, 0.12, 0.9], 5.6, 4.6, 0); const ct = tag('', 'ptr alt', 5.6, 5.3, 0);
  const flip = async (face) => { txt(ct, '…'); await anim(tok, 900, (f) => { coin.rotation.x = f * Math.PI * 4; }); txt(ct, face); };
  say('幫 6 丟一次銅板', '');
  await flip('正面');
  s.add(1, 6, true); s.links();
  say('正面 → 上一層也放 6', 'P(6 在 L2) = 1/2');
  await beat(tok, 2200);
  say('再丟一次', '');
  await flip('反面');
  say('反面 → 停，6 不上 L3', 'P(6 在 L3) = 1/4');
  await beat(tok, 2400);
  say('每個 key 都這樣丟', '期望值：L2 ≈ n/2、L3 ≈ n/4 …');
  await beat(tok, 2600);
  say('只改 6 自己那幾層', '改 1 層機率 1/2、2 層 1/4…：<span class="ok">期望很少</span>');
  await beat(tok, 2800);
  say('randomized data structure', 'search 像 binary search，insert 靠隨機');
  await beat(tok, 2600);
}]);

// ═════════ 10. Skip list 看起來像一棵樹 → BST ═════════
FRAG.push(['bstlin-skip-to-tree', 'Skip list 的搜尋路徑 = 一棵 Binary Search Tree', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.4, 0]);
  const S6 = [2, 3, 5, 8, 10, 13];
  const s = SL(S6, [S6, [3, 8, 13], [8]], ['L1', 'L2', 'L3'], { dx: 1.6 });
  say('龜毛版 skip list：2 3 5 8 10 13', '上層 3 8 13，最上層 8');
  await beat(tok, 2400);
  const cu = cursor();
  for (const [goal, path] of [[2, [[2, 8], [1, 3], [0, 2]]], [5, [[2, 8], [1, 3], [0, 5]]], [10, [[2, 8], [1, 13], [0, 10]]]]) {
    for (const [l, k] of path) {
      cu.at(s, l, k); const m = s.get(l, k); glow(m, k === goal ? GREEN : GOLD);
      say('search ' + goal + '：' + path.map((p) => p[1]).join(' → '), '');
      await beat(tok, 750);
    }
    path.forEach(([l, k]) => glow(s.get(l, k), null));
  }
  say('每一站只有「往左」或「往右」兩種選擇', '把比較的順序畫出來……');
  await beat(tok, 2200);
  for (let l = 1; l < s.lv.length; l++) [...s.lv[l].keys()].forEach((k) => s.del(l, k, true));
  s.links(); kill(cu.c);
  const t = { root: null }; [8, 3, 13, 2, 5, 10].forEach((k) => bstIns(t, k));
  const tv = TV(t, { cubes: new Map([...s.lv[0].entries()]), dx: 1.5, top: 5 });
  await beat(tok, 500);
  tv.sync();
  say('就是一棵 binary tree：root = 8', '');
  await beat(tok, 2200);
  const gl = ghostBox('#2fc092', 4.0, 2.6, 1.4); gl.position.set(-2.25, 2.85, 0);
  const gr = ghostBox('#4b9ee2', 2.6, 2.6, 1.4); gr.position.set(3.0, 2.85, 0);
  tag('都 < 8', 'ptr', -2.25, 1.2, 0); tag('都 > 8', 'ptr', 3.0, 1.2, 0);
  say('左子樹都比 root 小，右子樹都比 root 大', '每一棵 subtree 都成立 → <span class="ok">Binary Search Tree</span>');
  await beat(tok, 3200);
}]);

// ═════════ 11. BST search 演算法（遞迴）與終止條件 ═════════
FRAG.push(['bstlin-bst-search', 'BST search：跟 root 比，往左或往右', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.6, 0]);
  const t = { root: null }; [8, 3, 13, 2, 5, 10].forEach((k) => bstIns(t, k));
  const tv = TV(t, { cx: 2.6, dx: 1.2, top: 5 }); tv.sync();
  const cd = code(['BSTSearch(T, key):', '  if T is empty: NOT FOUND', '  if key < T.mid:', '    return BSTSearch(T.left, key)', '  if key > T.mid:', '    return BSTSearch(T.right, key)', '  return T.data   // key == mid'], -3.6, 5.4, 0.56);
  const cu = tag('▼', 'ptr alt', 0, -5, 0);
  const at = (k) => { const p = tv.P.get(k); cu.position.set(p.x, p.y + 0.75, 0); };
  say('「中點」就是 root', '跟 root 比：小去左、大去右');
  await beat(tok, 2400);
  // search 10
  at(8); cd.hl(4); say('search 10：10 > 8', '去右子樹'); await beat(tok, 1500);
  at(13); cd.hl(2); say('10 < 13', '去左子樹'); await beat(tok, 1500);
  at(10); cd.hl(6); glow(tv.c(10), GREEN); say('10 == 10：找到', '回傳對應的 value'); await beat(tok, 1800);
  glow(tv.c(10), null);
  // search 7
  at(8); cd.hl(2); say('search 7：7 < 8', '去左子樹'); await beat(tok, 1400);
  [13, 10].forEach((k) => tint(tv.c(k), GRAY));
  say('右子樹整個不用考慮了', '跟 binary search 一樣的偷吃步'); await beat(tok, 2200);
  at(3); cd.hl(4); say('7 > 3', '去右子樹'); await beat(tok, 1400);
  at(5); cd.hl(4); say('7 > 5', '去右子樹……是空的'); await beat(tok, 1600);
  cu.position.set(tv.P.get(5).x + 0.7, tv.P.get(5).y - 1.2, 0); cd.hl(1);
  say('老師板書沒寫終止條件', '<span class="no">要補：T 是空的 → 找不到</span>');
  await beat(tok, 3000);
}]);

// ═════════ 12. 花多少力氣：O(h)，最差 O(n)、最好 O(log n) ═════════
FRAG.push(['bstlin-bst-height', 'BST search 是 O(h)：歪斜的樹 vs 矮的樹', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  const a = { root: null }; [8, 5, 3, 2].forEach((k) => bstIns(a, k));
  const b = { root: null }; [5, 3, 8, 2].forEach((k) => bstIns(b, k));
  const va = TV(a, { cx: -3.4, dx: 1.0, dy: 1.3, top: 5.4 }); va.sync();
  const vb = TV(b, { cx: 3.4, dx: 1.2, dy: 1.3, top: 5.4 }); vb.sync();
  tag('不好的 BST', 'ptr', -3.4, 0.4, 0); tag('好的 BST', 'ptr', 3.4, 0.4, 0);
  say('search 從 root 一路走到 leaf', '花的力氣 = 樹高 h：<span class="ok">O(h)</span>');
  await beat(tok, 2600);
  const walk = async (v, ks, side) => { for (const [i, k] of ks.entries()) { glow(v.c(k), k === 2 ? GREEN : GOLD); say(side + ' search 2', '比較 ' + (i + 1) + ' 次'); await beat(tok, 800); } };
  await walk(va, [8, 5, 3, 2], '左：');
  say('8 → 5 → 3 → 2：比 4 次', '最差：偽裝的 linked list，h = n → <span class="no">O(n)</span>');
  await beat(tok, 2600);
  await walk(vb, [5, 3, 2], '右：');
  say('像 complete binary tree 一樣矮', '最好：h ≈ log n → <span class="ok">O(log n)</span>（跟 skip list 一樣）');
  await beat(tok, 2800);
  say('目標：加條件，讓 BST 不要長歪', '就像 max tree 加上 complete → heap');
  await beat(tok, 2800);
}]);

// ═════════ 13. 限制強度的取捨：BST、RB、AVL、Complete ═════════
FRAG.push(['bstlin-tradeoff', '限制寬鬆 ↔ 嚴格：BST、紅黑樹、AVL、complete BST', async (tok) => {
  fresh([0, 6, 13], [0, 2, 0]);
  const part = (ctx.params || {}).part || 0;
  line(-6.2, 0.15, 6.2, 0.15, 0, '#6e5f49');
  tag('限制寬鬆', 'idx', -5.6, 0.2, 1.3); tag('限制嚴格', 'idx', 5.6, 0.2, 1.3);
  const XS = { BST: -4.8, RB: -1.5, AVL: 1.5, CBT: 4.8 };
  const box = (n, k, col) => cube(n, col, [1.9, 0.8, 1.2], XS[k], 0.6, 0, 3);
  const note = (k, a, b) => { tag(a, 'idx', XS[k], 2.0, 0); tag(b, 'idx', XS[k], 1.5, 0); };
  if (part !== 2) {
    say('取捨：insert 後的維護 vs 最差 search', '');
    const bst = box('BST', 'BST', '#31aab0'); await beat(tok, 900);
    note('BST', 'search 最差 O(n)', '維護 ≈ 0');
    say('最寬鬆：一般 BST', '隨便找位置放 → 最差像 linked list');
    await beat(tok, 2600);
    const cb = box('Complete', 'CBT', '#9b7ef4'); await beat(tok, 900);
    note('CBT', 'search O(log n)', '維護 O(n)');
    say('最嚴格：complete BST', '≈ ordered array，一個蘿蔔一個坑');
    await beat(tok, 2800);
    const av = box('AVL', 'AVL', '#2fc092'), rb = box('紅黑樹', 'RB', '#d64545'); await beat(tok, 900);
    note('AVL', 'search O(log n)', '維護 O(1) 次調整'); note('RB', 'search O(log n)', '維護 O(1) 次調整');
    say('中間：AVL tree 與 Red-Black tree', '<span class="ok">worst search O(log n)</span>，維護便宜');
    await beat(tok, 3000);
    if (part === 1) { await beat(tok, 1000); return; }
  } else {
    box('BST', 'BST', '#31aab0'); box('Complete', 'CBT', '#9b7ef4');
    box('AVL', 'AVL', '#2fc092'); box('紅黑樹', 'RB', '#d64545');
    say('AVL 與紅黑樹複雜度看起來差不多', '都是 O(log n)');
    await beat(tok, 2200);
  }
  tag('search 稍快', 'ptr alt', XS.AVL, 3.0, 0); tag('insert 稍慢・好教', 'ptr alt', XS.AVL, 2.5, 0);
  say('AVL：限制較嚴', 'search 稍快、維護稍慢、比較好教');
  await beat(tok, 2600);
  tag('維護稍快', 'ptr', XS.RB, 3.0, 0); tag('search 稍慢・較常用', 'ptr', XS.RB, 2.5, 0);
  say('紅黑樹：寫在 AVL 左邊一點（較寬鬆）', '維護快、較能適應動態調整 → 實務常用');
  await beat(tok, 3000);
  say('今天先教 AVL，再進紅黑樹', '');
  await beat(tok, 2200);
}]);

// ═════════ 14. 為什麼 complete BST 的維護是 O(n)：1 2 3 插 4 ═════════
FRAG.push(['bstlin-complete-insert4', 'Complete BST 插入 4：每個元素都換位置', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.4, 0]);
  const t = { root: null }; [2, 1, 3].forEach((k) => bstIns(t, k));
  const tv = TV(t, { cx: -3.2, dx: 1.3, top: 5 }); tv.sync();
  const AX = (i) => 1.6 + i * 1.3;
  for (let i = 0; i < 4; i++) { ctx.tile(V3(AX(i), 0.02, 0), 1.15, 1.15); tag('[' + (i + 1) + ']', 'idx', AX(i), 0.1, 1.1); }
  const ac = new Map(); [2, 1, 3].forEach((k, i) => ac.set(k, cube(k, colorFor(k), [0.8, 0.6, 0.8], AX(i), 0.4, 0)));
  say('complete BST 存 1 2 3', 'array = [2, 1, 3]');
  await beat(tok, 2600);
  say('insert 4：還要是 complete，還要是 BST', '');
  await beat(tok, 1800);
  t.root = mkN(3); t.root.l = mkN(2); t.root.l.l = mkN(1); t.root.r = mkN(4);
  tv.sync(4);
  say('只有一種長法：3 當 root', '左 2（下面接 1），右 4');
  await beat(tok, 2400);
  [3, 2, 4, 1].forEach((k, i) => { if (ac.has(k)) { move(ac.get(k), AX(i), 0.4, 0); glow(ac.get(k), RED); } else ac.set(k, cube(k, colorFor(k), [0.8, 0.6, 0.8], AX(i), 0.4, 0, 3)); });
  say('array 變 [3, 2, 4, 1]', '原本的 3 個元素全部換位置');
  await beat(tok, 2800);
  say('跟 ordered array 插入一樣：大家都要讓', '維護要 <span class="no">O(n)</span>');
  await beat(tok, 2600);
  say('heap 只要修一條 path', 'BST 性質更強：只修一條 path 不夠');
  await beat(tok, 2800);
}]);

// ═════════ 15. AVL 的定義：|hL − hR| ≤ 1 ═════════
FRAG.push(['bstlin-avl-def', 'AVL tree：每個 node 的 bf ∈ {−1, 0, +1}', async (tok) => {
  fresh([0, 5, 12], [0, 2.8, 0]);
  const r = cube('root', '#4b9ee2', [1.1, 0.8, 1.1], 0, 5.2, 0);
  const U = 0.85, TOP = 4.4;
  const gL = ghostBox('#2fc092', 1.8, 1, 1.4), gR = ghostBox('#dd8238', 1.8, 1, 1.4);
  const lL = tag('', 'ptr', -2.0, 1, 0), lR = tag('', 'ptr', 2.0, 1, 0), lb = tag('', 'ptr alt', 1.4, 5.9, 0);
  line(0, 5.2, -1.6, TOP, 0); line(0, 5.2, 1.6, TOP, 0);
  let hl = 2, hr = 2;
  const set = (a, b) => {
    gL.scale.y = a * U; gL.position.set(-1.6, TOP - a * U / 2, 0); gR.scale.y = b * U; gR.position.set(1.6, TOP - b * U / 2, 0);
    txt(lL, 'hL = ' + Math.round(a)); txt(lR, 'hR = ' + Math.round(b)); lL.position.y = TOP - a * U - 0.3; lR.position.y = TOP - b * U - 0.3;
    const bf = Math.round(a) - Math.round(b); txt(lb, 'bf = ' + (bf > 0 ? '+' + bf : bf)); glow(r, Math.abs(bf) > 1 ? RED : null);
  };
  const to = async (a, b) => { const a0 = hl, b0 = hr; await anim(tok, 700, (f) => set(a0 + (a - a0) * f, b0 + (b - b0) * f)); hl = a; hr = b; set(a, b); };
  set(2, 2);
  say('AVL：Adelson-Velsky 與 Landis（1962）', '就是 BST，再多一條限制');
  await beat(tok, 2600);
  say('從每個 root 看：左右要差不多高', '|hL − hR| ≤ 1，每棵 subtree 都要');
  await beat(tok, 2600);
  say('balance factor：bf = hL − hR', 'hL = hR → bf = 0');
  await beat(tok, 2000);
  await to(2, 3); say('右邊高一點', 'bf = −1，OK'); await beat(tok, 1800);
  await to(3, 2); say('左邊高一點', 'bf = +1，OK'); await beat(tok, 1800);
  await to(1, 3); say('差 2：違反 AVL', '<span class="no">bf = −2 → 要調整</span>');
  await beat(tok, 2400);
  say('所有維護都在把 bf 保持在 −1、0、+1', '可以證明樹高 = O(log n)');
  await beat(tok, 2800);
}]);

// ═════════ 16. 特例：依序插入 3、5、8 ═════════
FRAG.push(['bstlin-avl-358', 'AVL 特例：插入 3、5、8 → 把 5 拉起來', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.6, dy: 1.5, top: 5.6, lab: BF });
  say('依序插入 3、5、8，每次都看 bf', 'bf = hL − hR');
  await beat(tok, 1800);
  bstIns(t, 3); tv.sync(3);
  say('insert 3：左右都空', 'bf(3) = 0 − 0 = 0');
  await beat(tok, 2000);
  bstIns(t, 5); tv.sync(5);
  say('insert 5：5 > 3 → 放 3 的右邊', 'bf(5) = 0，bf(3) = 0 − 1 = −1');
  await beat(tok, 2400);
  bstIns(t, 8); tv.sync(8);
  say('insert 8：比 3 大、比 5 大 → 一路往右', 'bf(3) = 0 − 2 = <span class="no">−2</span>');
  await beat(tok, 2600);
  say('長成一長串：從中間的 5 把它拉起來', '像拎葡萄一樣');
  await beat(tok, 2200);
  rotUp(t, t.root, 'L'); tv.sync();
  say('5 當新 root：左 3、右 8', 'bf 全部 = 0，恢復 AVL');
  await beat(tok, 2600);
  say('大體上只有 4 種情形，兩兩對稱', 'insert / search 都是 <span class="ok">O(log n)</span>');
  await beat(tok, 2600);
}]);

// ═════════ 17–18. RR 通例：A、B、AL、BL、BR ═════════
function rrDiagram(nums) {
  const A = cube('A', '#4b9ee2', [0.9, 0.9, 0.9], -1, 6, 0), B = cube('B', '#dd8238', [0.9, 0.9, 0.9], 1.5, 4.8, 0);
  const gb = (name, c, x, top, h) => { const m = ghostBox(c, 1.3, h, 1.3); m.position.set(x, top - h / 2, 0); const l = lab.label(name, 'idx'); m.add(l); return { m, l, h }; };
  const AL = gb(nums ? 'AL  h = 10' : 'AL', '#2fc092', -3, 5.2, 1.6), BL = gb(nums ? 'BL  h = 10' : 'BL', '#9b7ef4', 0.3, 4.0, 1.6), BR = gb(nums ? 'BR  h = 10' : 'BR', '#31aab0', 2.8, 4.0, 1.6);
  const bA = tag('bf −1', 'idx', -0.2, 6.6, 0), bB = tag('bf 0', 'idx', 2.3, 5.4, 0);
  let es = [];
  const st = { A, B, AL, BL, BR, bA, bB, nw: null };
  const top = (g) => V3(g.m.position.x, g.m.position.y + g.h / 2, 0);
  st.edges = (after) => {
    es.forEach(kill); es = [];
    const pa = after ? V3(-1.8, 4.8, 0) : V3(-1, 6, 0), pb = after ? V3(0.3, 6, 0) : V3(1.5, 4.8, 0);
    const L = (p, q) => es.push(line(p.x, p.y, q.x, q.y, 0));
    if (!after) { L(pa, top(AL)); L(pa, pb); L(pb, top(BL)); L(pb, top(BR)); }
    else { L(pb, pa); L(pb, V3(2.6, 5.2, 0)); L(pa, V3(-3.2, 4.0, 0)); L(pa, V3(-0.5, 4.0, 0)); }
  };
  st.edges(false);
  st.insert = () => { st.nw = cube('新', '#d64545', [0.7, 0.7, 0.7], 2.8, 1.85, 0, 3); };
  st.rotate1 = () => { // B 拉上來、A 滾下去；BL 先留在原地
    es.forEach(kill); es = [];
    move(B, 0.3, 6, 0); move(A, -1.8, 4.8, 0);
    move(AL.m, -3.2, 3.2, 0); move(BR.m, 2.6, 4.4, 0); if (st.nw) move(st.nw, 2.6, 3.05, 0);
    bA.position.set(-2.6, 5.4, 0); bB.position.set(1.1, 6.6, 0);
  };
  st.rotate2 = () => { move(BL.m, -0.5, 3.2, 0); BR.m.position.set(2.6, 4.4, 0); AL.m.position.set(-3.2, 3.2, 0); st.edges(true); };
  return st;
}
FRAG.push(['bstlin-rr-general', 'AVL 的 RR：rotate(A, B) 只改兩個 pointer', async (tok) => {
  fresh([0, 5, 13], [0, 3.6, 0]);
  const d = rrDiagram(false);
  const cd = code(['A.right = B.left;', 'B.left  = A;'], 5.2, 1.6, 0.56);
  say('通例：A 是失衡點，B = A 的右小孩', '每個 node 下面都可能有 subtree');
  await beat(tok, 2800);
  say('原本 B 平衡：BL、BR 一樣高', 'A 原本 bf = −1（右邊高一層）');
  await beat(tok, 2600);
  d.insert(); txt(d.bB, 'bf −1'); txt(d.bA, 'bf −2'); d.bA.element.className = 'lab-label ptr'; glow(d.A, RED);
  say('insert 進 BR，BR 多一層', '<span class="no">bf(A) = −2</span>，bf(B) = −1');
  await beat(tok, 2800);
  say('不平衡在 A 的右邊的右邊：RR', '把 B 拉上來，A 滾下去');
  await beat(tok, 2200);
  d.rotate1(); glow(d.A, null);
  await beat(tok, 1600);
  glow(d.BL.m, GOLD);
  say('BL 要去哪？它比 A 大、比 B 小', '→ 接到 A 的右邊');
  await beat(tok, 2600);
  d.rotate2(); glow(d.BL.m, null);
  txt(d.bA, 'bf 0'); txt(d.bB, 'bf 0'); d.bA.element.className = 'lab-label idx';
  say('AL 底、BL 底、BR 底切齊了', 'bf(A) = 0，bf(B) = 0');
  await beat(tok, 2600);
  cd.hl(0); say('不變：AL 還在 A 左、BR 還在 B 右', '變的只有兩個 link');
  await beat(tok, 2400);
  cd.hl(1); say('兩行程式 = rotate(A, B)', 'B 逆時針轉上去當 root');
  await beat(tok, 3000);
}]);
FRAG.push(['bstlin-rr-height', 'RR 為什麼一次就夠：高度 10、11 的數字版', async (tok) => {
  fresh([0, 5, 13], [0, 3.6, 0]);
  const d = rrDiagram(true);
  const hT = tag('A 這棵 subtree 高 12', 'ptr alt', -4.6, 6.6, 0);
  say('A 是第一個失衡點：之前大家都平衡', 'h(AL) = h(BL) = h(BR) = 10');
  await beat(tok, 2800);
  say('B 那層高 11，A 原本 bf = 10 − 11', '= −1，subtree 高 12');
  await beat(tok, 2600);
  const lBL = d.BL.l; txt(lBL, 'BL  h = 9 ?'); lBL.element.className = 'lab-label ptr';
  say('BL 會不會只有 9？', '那 insert 後 B 自己就 bf = −2，失衡點會是 B');
  await beat(tok, 3000);
  txt(lBL, 'BL  h = 10'); lBL.element.className = 'lab-label idx';
  d.insert(); txt(d.BR.l, 'BR  h = 11'); txt(d.bA, 'bf −2'); txt(d.bB, 'bf −1'); glow(d.A, RED); txt(hT, 'A 這棵 subtree 高 13');
  say('insert 進 BR：BR 變 11', 'bf(A) = 10 − 12 = <span class="no">−2</span>');
  await beat(tok, 2800);
  d.rotate1(); await beat(tok, 900); d.rotate2(); glow(d.A, null);
  txt(d.bA, 'bf 0'); txt(d.bB, 'bf 0');
  say('轉完：A 下面 10 對 10，B 下面 11 對 11', 'bf 全部 0');
  await beat(tok, 2800);
  txt(hT, 'B 這棵 subtree 高 12'); glow(d.B, GREEN);
  say('subtree 高度回到 insert 前的 12', '<span class="ok">上面的 bf 全都不會變</span>');
  await beat(tok, 2800);
  say('從新 node 往上找第一個失衡點', '轉一次就結束；LL 是對稱的');
  await beat(tok, 3000);
}]);

// ═════════ 19. 完整例子：依序插入 1 … 7 ═════════
FRAG.push(['bstlin-avl-1to7', 'AVL 依序插入 1, 2, 3, 4, 5, 6, 7', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.8, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.15, dy: 1.45, top: 5.6, lab: BF });
  const cap = { 1: 'insert 1：沒問題', 2: 'insert 2：放 1 的右邊，還是 AVL', 4: 'insert 4：往回看 4、3、2 都平衡', 6: 'insert 6：往回找到 2' };
  for (let k = 1; k <= 7; k++) {
    bstIns(t, k); tv.sync(k);
    const bad = firstBad(t, k);
    say(cap[k] || ('insert ' + k), bad ? '從 ' + k + ' 往上找回來……' : '');
    await beat(tok, bad ? 1500 : 1700);
    if (bad) {
      const b = bad.r.k;
      say('第一個失衡點 ' + bad.k + '：bf = −2', k + ' 在 ' + bad.k + ' 的右邊的右邊 → <span class="no">RR</span>');
      await beat(tok, 2200);
      rotUp(t, bad, 'L'); tv.sync();
      say(b + ' 拉上來，' + bad.k + ' 轉下去', k === 6 ? '原本 4 的左子樹 3 接到 2 的右邊' : '子樹高度不變，上面不受影響');
      await beat(tok, 2400);
    }
  }
  say('意外得到一棵 full binary tree', '過程中並沒有堅持 complete');
  await beat(tok, 3000);
}]);

// ═════════ 20. 小結：bf 怎麼算得快 ═════════
FRAG.push(['bstlin-avl-height-store', 'AVL 小結：每個 node 存 hL、hR', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.8, 0]);
  const t = { root: null }; [4, 2, 6, 1, 3, 5, 7].forEach((k) => bstIns(t, k));
  const tv = TV(t, { dx: 1.2, dy: 1.45, top: 5.6 }); tv.sync();
  say('insert = search 失敗的地方放進去', 'AVL 再多一步：往上調整');
  await beat(tok, 2400);
  say('RR、LL：一次旋轉、只動兩個 node', 'RL、LR 下次上課');
  await beat(tok, 2600);
  const ls = [];
  (function w(n) { if (!n) return; const p = tv.P.get(n.k); ls.push(tag('(' + hgt(n.l) + ', ' + hgt(n.r) + ')', 'idx', p.x + 0.85, p.y + 0.45, 0)); w(n.l); w(n.r); })(t.root);
  say('bf 怎麼算？每個 node 多存 (hL, hR)', 'bf = hL − hR：<span class="ok">O(1)</span>');
  await beat(tok, 2800);
  for (const k of [4, 6, 7]) { glow(tv.c(k), GOLD); await beat(tok, 500); }
  say('insert 只會改 root → leaf 那條 path 的高度', '往回調整時順便更新');
  await beat(tok, 2800);
  say('只需要 −1、0、+1：可以再省 bit', '實作細節自己取捨');
  await beat(tok, 2800);
}]);
  }

  // ═══ rblin.js ═══
  {
// ─── gqphGLSGyQ4：台大林軒田 DSA 2-3-4 Tree / Red-Black Tree（review insertion + removal） ───
// 例子取自影片：234 tree (5 16 | 3 | 7 11 14 | 18 21) ↔ 紅黑樹 5B(3B, 16R(11B(7R,14R), 21B(18R)))；
// insert 15（分家 → 11 往上、5 16 11 restructure）；remove 16（successor 18）；remove 18/7/14 紅 leaf；
// 234 remove 3（transfer：5 下、7 上）、remove 7,14 後 remove 11（16 下、18 上）、remove 21（fuse 18 + 16）；
// RB remove 3 的三種圖（兄弟不同層、5/3/7 11 旋轉、16 為 root 的 recolor）；Case 1/2/3 的 A、B、C 通式；double black。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, showL, code, line, arrow, ghostBox, GOLD, GREEN, RED } = K;
const RCL = '#d64545', BCL = '#2b2b2b', YCL = '#e0b84a', KCL = '#e3c98f';
const colRB = (c) => (c === 'R' ? RCL : c === 'Y' ? YCL : BCL);

// 紅黑樹：spec = [key, 'R'|'B'|'Y', left, right]；依 inorder 排 x；o.nil 畫蟑螂腳（黑色小方塊）
function RBVl(o) {
  const v = { m: new Map(), deco: [], P: new Map() };
  const dx = o.dx || 0.78, dy = o.dy || 1.15, sz = o.sz || 0.72;
  v.set = (spec, op = {}) => {
    const arr = [];
    (function io(s, d, p) { if (!s) return; io(s[2], d + 1, s); arr.push([s, d, p]); io(s[3], d + 1, s); })(spec, 0, null);
    v.P = new Map(arr.map(([s, d], i) => [s[0], V3(o.cx + (i - (arr.length - 1) / 2) * dx, o.top - d * dy, 0)]));
    v.deco.forEach(kill); v.deco = [];
    const drops = [].concat(op.drop || []);
    for (const [s, , p] of arr) {
      const q = v.P.get(s[0]); let m = v.m.get(s[0]);
      if (!m) { m = cube(s[0], colRB(s[1]), [sz, sz, sz], q.x, q.y, 0, drops.includes(s[0]) ? 3 : 0); v.m.set(s[0], m); }
      else { move(m, q.x, q.y, 0); tint(m, colRB(s[1])); }
      if (p) { const r = v.P.get(p[0]); v.deco.push(line(r.x, r.y, q.x, q.y)); }
      if (o.nil) [[s[2], -1], [s[3], 1]].forEach(([c, sx]) => {
        if (c) return; const nx = q.x + sx * 0.3, ny = q.y - 0.72;
        v.deco.push(line(q.x, q.y, nx, ny), cube('', BCL, [0.2, 0.2, 0.2], nx, ny, 0));
      });
    }
    for (const [k, m] of [...v.m]) if (!v.P.has(k)) { v.m.delete(k); if (op.fly) fly(m); else kill(m); }
  };
  v.c = (k) => v.m.get(k);
  return v;
}
// 2-3-4 tree：spec = [[keys], [child specs]]；keys 空 = 「這家沒人」
function T4Vl(o) {
  const v = { m: new Map(), deco: [], K: new Map() };
  const kw = o.kw || 0.72, dy = o.dy || 1.5;
  const W = (s) => Math.max(Math.max(s[0].length, 1) * kw + 0.3, (s[1] || []).reduce((a, c) => a + W(c), 0));
  v.set = (spec, op = {}) => {
    v.deco.forEach(kill); v.deco = []; v.K = new Map();
    const drops = [].concat(op.drop || []);
    (function place(s, x0, d, par) {
      const w = W(s), cx = x0 + w / 2, y = o.top - d * dy, nk = s[0].length;
      s[0].forEach((k, i) => {
        const x = cx + (i - (nk - 1) / 2) * kw; v.K.set(k, V3(x, y, 0));
        const col = (op.col && op.col[k]) || KCL; let m = v.m.get(k);
        if (!m) { m = cube(k, col, [kw * 0.9, 0.62, 0.7], x, y, 0, drops.includes(k) ? 3 : 0); v.m.set(k, m); }
        else { move(m, x, y, 0); tint(m, col); }
      });
      const b = ghostBox('#8a6d3b', Math.max(nk, 1) * kw + 0.14, 0.8, 0.9); b.position.set(cx, y, 0); v.deco.push(b);
      if (!nk) v.deco.push(tag('空', 'ptr', cx, y, 0));
      if (par) v.deco.push(line(par.x, par.y - 0.4, cx, y + 0.4));
      const kids = s[1] || [];
      if (!kids.length && o.nil) for (let i = 0; i <= nk; i++) {
        const nx = cx + (i - nk / 2) * kw;
        v.deco.push(line(nx, y - 0.4, nx, y - 0.72), cube('', BCL, [0.16, 0.16, 0.16], nx, y - 0.78, 0));
      }
      let xx = cx - kids.reduce((a, c) => a + W(c), 0) / 2;
      for (const c of kids) { place(c, xx, d + 1, V3(cx, y, 0)); xx += W(c); }
    })(spec, o.cx - W(spec) / 2, 0, null);
    for (const [k, m] of [...v.m]) if (!v.K.has(k)) { v.m.delete(k); if (op.fly) fly(m); else kill(m); }
  };
  v.c = (k) => v.m.get(k);
  return v;
}
function pairL(o = {}) {
  fresh([0, 3.8, 13.2], [0, 3.1, 0]);
  tag('2-3-4 tree', 'idx', -3.4, 6.7, 0); tag('red-black tree', 'idx', 3.4, 6.7, 0);
  return { L: T4Vl({ cx: -3.4, top: 5.4, nil: o.nil }), R: RBVl({ cx: 3.4, top: 5.6, nil: o.nil, dx: o.dx }) };
}
function curL() {
  const c = tag('▼', 'ptr alt', 0, 0, 0); showL(c, false);
  return { c, at(p, t) { showL(c, true); c.position.set(p.x, p.y + 0.72, 0); if (t !== undefined) txt(c, t); }, hide() { showL(c, false); } };
}
const glowAll = (v, ks, c) => ks.forEach((k) => { const m = v.c(k); if (m) glow(m, c); });

const T0L = [[5, 16], [[[3]], [[7, 11, 14]], [[18, 21]]]];
const R0L = [5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R']]]];

// ═════════ 1. 複習 2-3-4 tree ═════════
FRAG.push(['rblin-234-review', '2-3-4 tree 複習：三種 node、蟑螂腳同高', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set(T0L);
  say('2-3-4 tree 有三種 node', '2-node、3-node、4-node');
  await beat(tok, 2200);
  for (const [ks, cap, f] of [[[3], '2-node：1 個 key、2 個小孩', '3 自己一家'],
    [[5, 16, 18, 21], '3-node：2 個 key、3 個小孩', '5 16、18 21'],
    [[7, 11, 14], '4-node：3 個 key、4 個小孩', '7 11 14']]) {
    glowAll(L, ks, GOLD); say(cap, f); await beat(tok, 2300); glowAll(L, ks, null);
  }
  say('node 內排好序，小孩夾在中間', 'multiway search：3 < 5 < 7 … 14 < 16 < 18 21');
  await beat(tok, 2800);
  say('蟑螂腳（external）都在同一層', '像地基先打好，樹由下往上長 → 高度受控');
  await beat(tok, 3000);
}]);

// ═════════ 2. 234 → 紅黑樹：代表塗黑、家人塗紅 ═════════
FRAG.push(['rblin-234-to-rb', '234 轉紅黑樹：每家的代表是黑色', async (tok) => {
  const { L, R } = pairL({ nil: true });
  const col = {}; L.set(T0L);
  say('每一家選一個代表 → 黑色', '代表以外的家人 → 紅色');
  await beat(tok, 2200);
  const steps = [
    [5, 'B', '3-node 5 16：選 5 當代表', [5, 'B']],
    [16, 'R', '16 是家人 → 紅，接在 5 右下', [5, 'B', null, [16, 'R']]],
    [3, 'B', '3 孤家寡人 → 黑', [5, 'B', [3, 'B'], [16, 'R']]],
    [11, 'B', '4-node：中間的 11 當代表', [5, 'B', [3, 'B'], [16, 'R', [11, 'B']]]],
    [[7, 14], 'R', '7、14 → 紅，掛在 11 兩邊', [5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']]]]],
    [21, 'B', '18 21：這次選 21 當代表', [5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B']]]],
    [18, 'R', '18 → 紅，掛在 21 左邊', R0L],
  ];
  for (const [k, c, cap, spec] of steps) {
    const ks = [].concat(k); ks.forEach((x) => { col[x] = colRB(c); });
    L.set(T0L, { col }); R.set(spec, { drop: ks });
    say(cap, '3-node 左右都能當代表；4-node 選中間');
    await beat(tok, 1700);
  }
  const cu = curL(); const cnt = tag('', 'ptr alt', 3.4, 0.4, 0);
  for (const [path, nm] of [[[3, 5], '3 下面'], [[7, 11, 16, 5], '7 下面']]) {
    let b = 0;
    for (const k of path) {
      cu.at(R.P.get(k)); if ([3, 5, 11, 21].includes(k)) b++;
      txt(cnt, '從' + nm + '的蟑螂腳往上：黑 × ' + b); glow(R.c(k), GOLD);
      say('蟑螂腳往 root 數黑色', '碰到黑 = 碰到一家的代表');
      await beat(tok, 900); glow(R.c(k), null);
    }
    await beat(tok, 700);
  }
  cu.hide();
  say('每隻蟑螂腳都碰到 2 個黑', '= 234 tree 蟑螂腳都在同一高度');
  await beat(tok, 3000);
}]);

// ═════════ 3. 紅黑樹的規則從 234 來（也用於最後的 official 三條規則） ═════════
FRAG.push(['rblin-rb-rules', '紅黑樹規則：紅的爸爸、小孩都是黑；black depth 相同', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.6, dx: 0.95, dy: 1.3, sz: 0.8, nil: true });
  R.set(R0L);
  const off = (ctx.params || {}).official;
  say(off ? '書上的紅黑樹三條規則' : '從 234 看紅黑樹的規則', '紅 = 一家裡的附屬家人；黑 = 代表');
  await beat(tok, 2400);
  glowAll(R, [7, 14, 18, 16], GOLD); glowAll(R, [11, 21, 5], GREEN);
  say('紅色的爸爸一定是黑', '7、14 → 11；18 → 21；16 → 5');
  await beat(tok, 2800);
  glowAll(R, [7, 14, 18, 16, 11, 21, 5], null);
  glow(R.c(5), GREEN);
  say('root 一定是黑', '代表總是放上面');
  await beat(tok, 2400);
  glow(R.c(5), null); glowAll(R, [16], GOLD); glowAll(R, [11, 21], GREEN);
  say('紅色的小孩一定是黑', '含蟑螂腳：往下接就是別家（下一層）');
  await beat(tok, 2800);
  glowAll(R, [16, 11, 21], null);
  const cu = curL();
  for (const k of [3, 7, 14, 18, 21]) {
    cu.at(R.P.get(k), '黑 × 2'); glow(R.c(k), GOLD);
    say('每隻蟑螂腳往上數：黑一樣多', 'black depth = 234 tree 的高度');
    await beat(tok, 900); glow(R.c(k), null);
  }
  cu.hide();
  say(off ? '三條規則都來自 234 tree' : '規則都能從 234 的定義理解', '紅不連紅、root 黑、black depth 相同');
  await beat(tok, 3000);
}]);

// ═════════ 4. insert：新生先塗紅，爸爸黑 = 有空房間 ═════════
FRAG.push(['rblin-ins-easy', 'Insert 簡單情形：爸爸是黑 → 234 有空房間', async (tok) => {
  const { L, R } = pairL({ nil: true });
  L.set(T0L); R.set(R0L);
  say('insert：照 BST 走到某隻蟑螂腳', '新生先塗紅');
  await beat(tok, 2400);
  L.set([[5, 16], [[[3]], [[7, 11, 14]], [[18, 21, '新']]]], { drop: '新' });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R'], ['新', 'R']]]], { drop: '新' });
  glow(R.c(21), GREEN);
  say('插在 21 旁：爸爸 21 是黑', '234：18 21 還有空房間，直接住進去');
  await beat(tok, 3000);
  glow(R.c(21), null);
  L.set(T0L, { fly: true }); R.set(R0L, { fly: true });
  await beat(tok, 900);
  L.set([[5, 16], [[[3, '新']], [[7, 11, 14]], [[18, 21]]]], { drop: '新' });
  R.set([5, 'B', [3, 'B', null, ['新', 'R']], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R']]]], { drop: '新' });
  glow(R.c(3), GREEN);
  say('插在 3 旁：爸爸 3 也是黑', '234：3 這家有空房間');
  await beat(tok, 2800);
  glow(R.c(3), null);
  say('爸爸黑 → 什麼都不用修', '這是簡單的情形');
  await beat(tok, 2600);
  say('難的是爸爸紅：這家可能已滿', '下一步：insert 15');
  await beat(tok, 2800);
}]);

// ═════════ 5. insert 15：紅叔不能容 → 分家（recolor） ═════════
const T15L = [[5, 11, 16], [[[3]], [[7]], [[14, 15]], [[18, 21]]]];
const R15L = [5, 'B', [3, 'B'], [16, 'R', [11, 'R', [7, 'B'], [14, 'B', null, [15, 'R']]], [21, 'B', [18, 'R']]]];
FRAG.push(['rblin-ins15-recolor', 'Insert 15：家已滿 → 分家，7、14 塗黑、11 塗紅', async (tok) => {
  const { L, R } = pairL();
  L.set(T0L); R.set(R0L);
  say('insert 15：走到 14 的右邊', '15 新生 → 紅');
  await beat(tok, 2000);
  L.set([[5, 16], [[[3]], [[7, 11, 14, 15]], [[18, 21]]]], { drop: 15 });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R', null, [15, 'R']]], [21, 'B', [18, 'R']]]], { drop: 15 });
  await beat(tok, 1200);
  glowAll(R, [14, 7], GOLD); glow(L.c(15), RED);
  say('爸爸 14 紅、叔叔 7 也紅', '紅叔不能容：234 的 7 11 14 已經滿了');
  await beat(tok, 3000);
  glowAll(R, [14, 7], null); glow(L.c(15), null);
  glow(L.c(11), GOLD); L.set(T15L);
  say('沒有空房間 → 分家', '中間的 11 往上推；7 一家、14 15 一家');
  await beat(tok, 2800);
  glow(L.c(11), null);
  R.set(R15L);
  say('RB：7、14 塗黑，11 塗紅', '7、14 各自當代表；11 被插入上一層 = 新生紅');
  await beat(tok, 3000);
  glowAll(R, [11, 16], RED);
  say('11 紅、爸爸 16 也紅 → 還沒完', '要看 11 在上一層（5 16 那家）怎麼住');
  await beat(tok, 3000);
}]);

// ═════════ 6. 11 插錯邊 → restructure 5、16、11 ═════════
FRAG.push(['rblin-ins15-restructure', '11 往上後：叔叔 3 黑 → restructure', async (tok) => {
  const { L, R } = pairL();
  L.set(T15L); R.set(R15L);
  glowAll(R, [11, 16], RED);
  say('11 紅接在紅色 16 下面', '16 容不下它');
  await beat(tok, 2400);
  glow(R.c(3), GREEN);
  say('叔叔 3 是黑：3 是另一家', '5 16 這家沒滿，只是 11 插在不平衡的一邊');
  await beat(tok, 3000);
  glowAll(R, [11, 16, 3], null); glowAll(R, [5, 16, 11], GOLD);
  say('5、16、11 三個人重新排', '像 AVL 的 restructure：爺爺 5 滑下來');
  await beat(tok, 2600);
  R.set([11, 'B', [5, 'R', [3, 'B'], [7, 'B']], [16, 'R', [14, 'B', null, [15, 'R']], [21, 'B', [18, 'R']]]]);
  say('11 上去當代表（黑），5、16 變紅', '7 接到 5 右邊，14 接到 16 左邊');
  await beat(tok, 3200);
  glowAll(R, [5, 16, 11], null); glowAll(L, [5, 11, 16], GOLD);
  say('對應 234：5 11 16 成一家', 'restructure ↔ 插進 3-node 但方向不對');
  await beat(tok, 2800);
  glowAll(L, [5, 11, 16], null);
  say('若叔叔是紅（像 7、14）', '→ 這家滿了：recolor，再往上插');
  await beat(tok, 3000);
}]);

// ═════════ 7. remove：先變成 remove leaf（16 → successor 18） ═════════
FRAG.push(['rblin-rm16-succ', 'Remove 16：找 successor 18 補上，改成 remove leaf', async (tok) => {
  const { L, R } = pairL({ nil: true });
  L.set(T0L); R.set(R0L);
  say('蟑螂腳畫成黑色', '黑 = 潛在的下一個 node（還有空間）');
  await beat(tok, 2600);
  glow(R.c(16), RED); glow(L.c(16), RED);
  say('remove 16：16 不是 leaf', '從中間砍斷再接回去很麻煩');
  await beat(tok, 2400);
  const cu = curL();
  for (const [k, cap] of [[16, '從 16 出發'], [21, '先往右一步'], [18, '再一路往左到底']]) {
    cu.at(R.P.get(k)); glow(R.c(k), k === 16 ? RED : GOLD);
    say(cap, 'successor = 右子樹最小 = 18'); await beat(tok, 1300);
  }
  cu.hide();
  R.set([5, 'B', [3, 'B'], [18, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B']]], { fly: true });
  L.set([[5, 18], [[[3]], [[7, 11, 14]], [[21]]]], { fly: true });
  glow(R.c(18), null); glow(L.c(18), null);
  say('18 請上來補 16 的位置', '真正被拿掉的是 leaf 18');
  await beat(tok, 3000);
  say('也可用左子樹最大（14）', '兩邊都空 → 它本身就是 leaf，直接移掉');
  await beat(tok, 3000);
}]);

// ═════════ 8. 簡單的 remove：234 從 3/4-node 移；RB 移紅 leaf ═════════
FRAG.push(['rblin-rm-red-leaf', '簡單的 remove：那家還有人 = 拿掉紅色 leaf', async (tok) => {
  const { L, R } = pairL({ nil: true });
  L.set(T0L); R.set(R0L);
  say('remove leaf：那家還有人頂著', '234：從 4-node、3-node 移掉 → easy');
  await beat(tok, 2600);
  glow(R.c(18), RED); glow(L.c(18), RED);
  say('remove 18：21 還頂著', 'RB：18 是紅色 leaf');
  await beat(tok, 1600);
  L.set([[5, 16], [[[3]], [[7, 11, 14]], [[21]]]], { fly: true });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B']]], { fly: true });
  await beat(tok, 1600);
  glow(R.c(7), RED); glow(L.c(7), RED);
  say('remove 7：11、14 還在', '紅色 leaf 直接摘掉，接好蟑螂腳就好');
  await beat(tok, 1600);
  L.set([[5, 16], [[[3]], [[11, 14]], [[21]]]], { fly: true });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', null, [14, 'R']], [21, 'B']]], { fly: true });
  await beat(tok, 1800);
  glow(R.c(11), GOLD); glow(L.c(11), GOLD);
  say('remove 11：234 直接移', 'RB 裡 11 不是 leaf → 先走第 0 步');
  await beat(tok, 2600);
  R.set([5, 'B', [3, 'B'], [16, 'R', [14, 'B'], [21, 'B']]], { fly: true });
  L.set([[5, 16], [[[3]], [[14]], [[21]]]], { fly: true });
  say('14 請上去，改成移掉紅 leaf 14', '234 的 easy case 在 RB 一部分被第 0 步吃掉');
  await beat(tok, 3000);
}]);

// ═════════ 9. 234 remove 3：transfer ═════════
FRAG.push(['rblin-234-transfer3', '234 remove 3：隔壁有人可借 → transfer', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set(T0L);
  glow(L.c(3), RED);
  say('remove 3：這家只有它一個', 'remove from 2-node');
  await beat(tok, 2400);
  L.set([[5, 16], [[[]], [[7, 11, 14]], [[18, 21]]]], { fly: true });
  say('3 走了，這家沒人', '直接拆掉 → 蟑螂腳不同高');
  await beat(tok, 2600);
  glowAll(L, [7, 11, 14], GOLD);
  say('隔壁 7 11 14 住得很擠', '找人來頂著這個家');
  await beat(tok, 2400);
  glowAll(L, [7, 11, 14], null); glowAll(L, [5, 7], GREEN);
  L.set([[7, 16], [[[5]], [[11, 14]], [[18, 21]]]]);
  say('爸爸 5 下來頂，7 上去當爸爸', 'Transfer（when borrowable）');
  await beat(tok, 3200);
  glowAll(L, [5, 7], null);
  say('結構不變，隔壁還剩兩人', '只動了兩個人：爸爸、兄弟');
  await beat(tok, 2800);
}]);

// ═════════ 10. 234：移 7、14 後 remove 11 → 向 18 21 借 ═════════
FRAG.push(['rblin-234-rm11-transfer', '234：remove 7、14，再 remove 11（16 下、18 上）', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set(T0L);
  say('先做兩個簡單的 remove', 'remove 7、remove 14');
  await beat(tok, 1800);
  L.set([[5, 16], [[[3]], [[11, 14]], [[18, 21]]]], { fly: true }); await beat(tok, 1000);
  L.set([[5, 16], [[[3]], [[11]], [[18, 21]]]], { fly: true });
  say('現在 3、11 都孤苦伶仃', '各自一個人住');
  await beat(tok, 2200);
  glow(L.c(11), RED);
  say('remove 11：又是 2-node', '');
  await beat(tok, 1600);
  L.set([[5, 16], [[[3]], [[]], [[18, 21]]]], { fly: true });
  glowAll(L, [18, 21], GOLD);
  say('隔壁 18 21 有人可借', '');
  await beat(tok, 2000);
  glowAll(L, [18, 21], null); glowAll(L, [16, 18], GREEN);
  L.set([[5, 18], [[[3]], [[16]], [[21]]]]);
  say('16 下來頂，18 上去', 'transfer：16、21、18 各自一人住');
  await beat(tok, 3000);
  glowAll(L, [16, 18], null);
  say('再移一個會怎樣？', '每家都只剩一個人了');
  await beat(tok, 2400);
}]);

// ═════════ 11. 234：remove 21 → 借無可借 → fuse ═════════
FRAG.push(['rblin-234-rm21-fuse', '234 remove 21：借無可借 → fuse，爸爸拉下來', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set([[5, 18], [[[3]], [[16]], [[21]]]]);
  glow(L.c(21), RED);
  say('remove 21', '21 這家也只有它');
  await beat(tok, 1800);
  L.set([[5, 18], [[[3]], [[16]], [[]]]], { fly: true });
  glow(L.c(16), GOLD);
  say('隔壁 16 也只有一人：借無可借', '18 下來、16 上去也不行');
  await beat(tok, 3000);
  glow(L.c(16), null); glowAll(L, [16, 18], GREEN);
  L.set([[5], [[[3]], [[16, 18]]]]);
  say('爸爸 18 拉下來跟 16 合一家', 'Fuse：上一層少一個 key、少一條連結');
  await beat(tok, 3200);
  glowAll(L, [16, 18], null); glow(L.c(5), GOLD);
  say('上一層 5 18 → 剩 5：還有人', '上一層移掉 3-node 的 key = easy');
  await beat(tok, 2800);
  say('上一層若也是 2-node → 再往上 remove', 'fuse = fuse + remove from upper level');
  await beat(tok, 3000);
  glow(L.c(5), null);
  say('insert 滿了分家；remove 借不到就合併', '234：split ↔ transfer / fuse');
  await beat(tok, 3000);
}]);

// ═════════ 12. RB remove 3：兄弟不同層的麻煩情形 ═════════
FRAG.push(['rblin-rb-rm3-hard', 'RB remove 3：要動 5、16、11、7 四個 node', async (tok) => {
  const { L, R } = pairL();
  L.set([[5, 16], [[[3]], [[7, 11]], [[18, 21]]]]);
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R']], [21, 'B', [18, 'R']]]]);
  glow(R.c(3), RED); glow(L.c(3), RED);
  say('RB remove 3：3 是黑色 leaf', '234：要從隔壁 7 11 借人');
  await beat(tok, 2600);
  L.set([[7, 16], [[[5]], [[11]], [[18, 21]]]], { fly: true });
  R.set([5, 'B', null, [16, 'R', [11, 'B', [7, 'R']], [21, 'B', [18, 'R']]]], { fly: true });
  say('234 最後要變成 5 | 7 16 | 11', '5 下去、7 上去');
  await beat(tok, 2600);
  const xs = [5, 16, 11, 7].map((k) => R.P.get(k));
  const gb = ghostBox('#d64545', Math.max(...xs.map((p) => p.x)) - Math.min(...xs.map((p) => p.x)) + 1.2, 4.6, 1.2);
  gb.position.set((Math.max(...xs.map((p) => p.x)) + Math.min(...xs.map((p) => p.x))) / 2, 3.9, 0);
  say('RB 要動 5、16、11、7', '兩個 3-node 疊起來 → 跨四層');
  await beat(tok, 3000);
  kill(gb);
  R.set([7, 'B', [5, 'B'], [16, 'R', [11, 'B'], [21, 'B', [18, 'R']]]]);
  say('一種畫法：7 在上面', '7(黑) 左 5、右 16(紅)，16 下接 11');
  await beat(tok, 3000);
  R.set([16, 'B', [7, 'R', [5, 'B'], [11, 'B']], [21, 'B', [18, 'R']]]);
  say('另一種：16 在上面', '7(紅) 下接 5、11');
  await beat(tok, 3000);
  say('兄弟不在同一層，先擱著', '先看簡單一點的情形');
  await beat(tok, 2600);
}]);

// ═════════ 13. RB remove 3：黑兄弟 7 有紅小孩 11 → rotate ═════════
FRAG.push(['rblin-rb-rm3-rotate', 'RB remove 3：黑兄弟有紅小孩 → rotate 5、7', async (tok) => {
  const { L, R } = pairL();
  L.set([[5], [[[3]], [[7, 11]]]]);
  R.set([5, 'B', [3, 'B'], [7, 'B', null, [11, 'R']]]);
  say('拿掉 16 那一支：5 | 3 | 7 11', '7 當代表，11 紅');
  await beat(tok, 2600);
  glow(R.c(3), RED); glow(R.c(7), GREEN);
  say('remove 3：兄弟 7 跟它同一層', '234 的兄弟 = RB 裡黑色的兄弟');
  await beat(tok, 2800);
  glow(R.c(11), GOLD);
  say('黑兄弟 7 有紅小孩 11', '紅色外甥 → 234 的 7 11 有人可借');
  await beat(tok, 2800);
  glowAll(R, [7, 11], null);
  L.set([[5], [[[]], [[7, 11]]]], { fly: true });
  R.set([5, 'B', null, [7, 'B', null, [11, 'R']]], { fly: true });
  await beat(tok, 1400);
  R.set([7, 'B', [5, 'B'], [11, 'B']]);
  L.set([[7], [[[5]], [[11]]]]);
  say('rotate 5、7：爸爸 5 轉下來', '紅外甥 11 塗黑 → 完成');
  await beat(tok, 3200);
  say('RB 的 rotate ＝ 234 的 transfer', '兄弟同層 + 紅外甥：轉一次就好');
  await beat(tok, 3000);
}]);

// ═════════ 14. RB remove 3：兄弟 7 沒紅小孩 → recolor ═════════
FRAG.push(['rblin-rb-rm3-recolor', 'RB remove 3：兄弟沒得借 → fuse = recolor', async (tok) => {
  const { L, R } = pairL();
  L.set([[5, 16], [[[3]], [[7]], [[18, 21]]]]);
  R.set([16, 'B', [5, 'R', [3, 'B'], [7, 'B']], [18, 'B', null, [21, 'R']]]);
  say('這次讓 16 當 root', '5 紅：16 的家人；下面 3、7');
  await beat(tok, 2800);
  glow(R.c(3), RED); glow(R.c(7), GOLD);
  say('remove 3：兄弟 7 沒有紅小孩', '借無可借 → 234 做 fuse');
  await beat(tok, 2800);
  glowAll(R, [3, 7], null);
  L.set([[16], [[[5, 7]], [[18, 21]]]], { fly: true });
  R.set([16, 'B', [5, 'R', null, [7, 'B']], [18, 'B', null, [21, 'R']]], { fly: true });
  say('234：5 下來跟 7 合一家', '');
  await beat(tok, 2200);
  R.set([16, 'B', [5, 'B', null, [7, 'R']], [18, 'B', null, [21, 'R']]]);
  glowAll(R, [5, 7], GREEN);
  say('RB 只要重新塗色：5 黑、7 紅', 'Recolor：結構完全不動');
  await beat(tok, 3000);
  glowAll(R, [5, 7], null);
  const p = R.P.get(5); const bb = tag('黑上加黑?', 'ptr', p.x - 1.0, p.y + 0.6, 0);
  say('若 5 原本是黑 → double black', '還沒完：往上一層繼續 remove');
  await beat(tok, 3000);
  kill(bb);
  say('5 原本是紅 → 塗黑就結束', 'fuse 完成');
  await beat(tok, 2600);
}]);

// ═════════ 15. remove black 的三種情形 ═════════
FRAG.push(['rblin-rm-cases', 'Remove 黑色：三種情形', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.0, 0]);
  tag('remove 紅色 = easy；難的是 remove 黑色', 'idx', 0, 6.6, 0);
  const cases = [
    [-4.6, ['p', 'Y', ['x', 'B'], ['s', 'B', ['n', 'R']]], 'a. 兄弟同層、有紅外甥', '→ restructure（234 transfer）'],
    [0, ['p', 'Y', ['x', 'B'], ['s', 'B']], 'b. 兄弟同層、只有黑外甥', '→ recolor（234 fuse）'],
    [4.6, ['p', 'B', ['x', 'B'], ['s', 'R', ['y', 'B'], ['z', 'B']]], 'c. 紅兄弟：兄弟不同層', '→ 先 rotate，找真兄弟'],
  ];
  say('remove 一個黑色 leaf x', '看 x 在 234 的兄弟');
  await beat(tok, 2200);
  for (const [cx, spec, cap, f] of cases) {
    const v = RBVl({ cx, top: 5.2, dx: 0.85, dy: 1.2, sz: 0.62 });
    v.set(spec, { drop: spec[0] });
    tag(cap.slice(0, 2), 'ptr alt', cx, 1.2, 0);
    glow(v.c('x'), RED); glow(v.c('s'), GOLD);
    say(cap, f);
    await beat(tok, 3200);
  }
  say('a、b 都是 black sibling', 'p 黃色 = 顏色不一定');
  await beat(tok, 3400);
}]);

// ═════════ 16. Case 1 通式：A、B、C ═════════
FRAG.push(['rblin-case1-restructure', 'Case 1：黑兄弟 B 有紅小孩 C → restructure', async (tok) => {
  const { L, R } = pairL({ dx: 1.05 });
  L.set([['A'], [[['x']], [['C', 'B']]]]);
  R.set(['A', 'Y', ['x', 'B'], ['B', 'B', ['C', 'R']]]);
  say('爸爸 A：顏色不一定（黃）', '234 裡 A 在上一層');
  await beat(tok, 2400);
  glow(R.c('x'), RED); glow(R.c('B'), GREEN); glow(R.c('C'), GOLD);
  say('x 要移掉；兄弟 B 黑、有紅小孩 C', '234：C B 這家可以借');
  await beat(tok, 3000);
  glowAll(R, ['x', 'B', 'C'], null);
  L.set([['A'], [[[]], [['C', 'B']]]], { fly: true });
  R.set(['A', 'Y', null, ['B', 'B', ['C', 'R']]], { fly: true });
  await beat(tok, 1400);
  R.set(['C', 'Y', ['A', 'B'], ['B', 'B']]);
  L.set([['C'], [[['A']], [['B']]]]);
  say('C 上去，A 下來頂 x 的位置', 'restructure：三代重新組合');
  await beat(tok, 3200);
  glow(R.c('A'), GREEN); glow(R.c('B'), GREEN);
  say('A 變黑、B 仍黑', 'A、B 都是新一家的家長');
  await beat(tok, 2600);
  glowAll(R, ['A', 'B'], null); glow(R.c('C'), GOLD);
  say('C 繼承 A 原本的顏色', '原來紅就紅、原來黑就黑；做完就結束');
  await beat(tok, 3000);
}]);

// ═════════ 17. Case 2 通式：recolor，double black 往上 ═════════
FRAG.push(['rblin-case2-recolor', 'Case 2：兄弟只有黑小孩 → recolor，可能往上傳', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.4, dx: 1.5, dy: 1.6, sz: 0.85 });
  R.set(['A', 'R', ['x', 'B'], ['B', 'B']]);
  glow(R.c('x'), RED); glow(R.c('B'), GOLD);
  say('x 要移掉；兄弟 B 沒有紅小孩', '借無可借 → 234 的 fuse');
  await beat(tok, 2800);
  glowAll(R, ['x', 'B'], null);
  R.set(['A', 'R', null, ['B', 'R']], { fly: true });
  say('兄弟 B 塗紅：變成附屬的家人', 'A 下來跟 B 住一家');
  await beat(tok, 2800);
  R.set(['A', 'B', null, ['B', 'R']]);
  say('A 原本紅 → 塗黑，結束', '本來就是附屬，下來當家長剛好');
  await beat(tok, 2800);
  R.set(['A', 'B', ['x', 'B'], ['B', 'B']], { drop: 'x' });
  say('如果 A 原本是黑？', '');
  await beat(tok, 2000);
  R.set(['A', 'B', null, ['B', 'R']], { fly: true });
  glow(R.c('A'), RED);
  const p = R.P.get('A'); const bb = tag('double black', 'ptr', p.x + 1.5, p.y + 0.3, 0);
  const ar = arrow(V3(p.x, p.y + 0.6, 0), V3(p.x, p.y + 1.6, 0));
  say('A 變 double black', '上一層也要 remove → 再看 A 的兄弟');
  await beat(tok, 3000);
  say('一路 recolor 往上', '像 AVL 從底層往上更新高度');
  await beat(tok, 2800);
  kill(bb); kill(ar);
}]);

// ═════════ 18. Case 3：紅兄弟 = 假兄弟 → 先轉 3-node ═════════
FRAG.push(['rblin-case3-red-sibling', 'Case 3：紅兄弟是假兄弟 → 先 rotate 那個 3-node', async (tok) => {
  const { L, R } = pairL({ dx: 1.05 });
  L.set([['A', 'B'], [[['x']], [['y']], [['z']]]]);
  R.set(['A', 'B', ['x', 'B'], ['B', 'R', ['y', 'B'], ['z', 'B']]]);
  glow(R.c('x'), RED); glow(R.c('B'), GOLD);
  say('x 要移掉，但兄弟 B 是紅的', '紅兄弟 = 兄弟不同層');
  await beat(tok, 2800);
  glow(R.c('B'), null); glow(R.c('y'), GREEN); glow(L.c('y'), GREEN);
  say('x 在 234 的真兄弟是 y', 'A B 是同一個 3-node：B 是爸爸那層的');
  await beat(tok, 3000);
  R.set(['B', 'B', ['A', 'R', ['x', 'B'], ['y', 'B']], ['z', 'B']]);
  say('rotate：B 上去、A 下來', '3-node 換個方向排，234 完全沒變');
  await beat(tok, 3200);
  say('x 的兄弟變成黑色的 y', '→ 回到 Case 1 / Case 2');
  await beat(tok, 2800);
  say('只要轉一次', '轉完一定找得到黑色的真兄弟');
  await beat(tok, 3200);
}]);

// ═════════ 19. 完整的 remove 步驟 ═════════
FRAG.push(['rblin-rm-algo', '紅黑樹 remove 的完整步驟（對照 234）', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  const C = code([
    'remove(k):',
    ' 1. 換成 remove leaf',
    ' 2. leaf 紅 → 直接拿掉',
    ' 3. leaf 黑：',
    '   a. 兄弟紅 → rotate',
    '   b. 真兄弟有紅小孩',
    '      → restructure，結束',
    '   c. 真兄弟全黑 → recolor',
    '      → 上一層沒好就重做',
  ], -2.0, 6.0, 0.62);
  const MAP = { 1: 'successor 補位', 2: '234：remove 4/3-node', 4: '把 3-node 轉正', 5: '234：transfer', 7: '234：fuse' };
  const tags = [];
  for (let i = 1; i < 9; i++) {
    C.hl(i);
    if (MAP[i]) tags.push(tag(MAP[i], 'ptr alt', 3.6, 6.0 - i * 0.62, 0));
    say(i <= 2 ? '先 remove leaf；紅的 easy' : i <= 4 ? '黑的：先找真兄弟' : i <= 6 ? '有得借 → restructure' : '沒得借 → recolor 往上',
      MAP[i] || (i === 3 ? 'double black 要小心' : '一對一對應 234 的操作'));
    await beat(tok, i === 3 ? 1600 : 2200);
  }
  C.hl(-1);
  say('每一步都對應 234 的操作', '4/3-node easy；2-node：借 or 合併');
  await beat(tok, 3000);
}]);

// ═════════ 20. 為什麼還是 O(log n) ═════════
FRAG.push(['rblin-rm-logn', 'Remove 為什麼還是 O(log n)', async (tok) => {
  const { L, R } = pairL();
  L.set(T0L); R.set(R0L);
  const xs = [5, 16].map((k) => R.P.get(k));
  const gb = ghostBox('#8a6d3b', Math.abs(xs[1].x - xs[0].x) + 1.1, Math.abs(xs[1].y - xs[0].y) + 1.1, 1.1);
  gb.position.set((xs[0].x + xs[1].x) / 2, (xs[0].y + xs[1].y) / 2, 0);
  glowAll(L, [5, 16], GOLD);
  say('一個 234 node 最多變兩層 RB', '234 高度 O(log n) → RB 高度也 O(log n)');
  await beat(tok, 3000);
  kill(gb); glowAll(L, [5, 16], null);
  const cu = curL(); let n = 0;
  for (const k of [7, 11, 16, 5]) {
    n++; cu.at(R.P.get(k), 'recolor × ' + n); glow(R.c(k), RED);
    say('只有 recolor 會一層層往上', '對應 234 一連串的 fuse');
    await beat(tok, 1000); glow(R.c(k), null);
  }
  cu.hide();
  say('最多 O(log n) 次 recolor', '每次只改 color bit');
  await beat(tok, 2400);
  glowAll(R, [16, 11], GREEN);
  say('rotate、restructure 只做一次', '234 從隔壁借完就沒事');
  await beat(tok, 2800);
  glowAll(R, [16, 11], null);
  say('找 node + 維護 都是樹高', 'remove = O(log n)');
  await beat(tok, 2600);
}]);

// ═════════ 21. double black 往上傳的例子 ═════════
FRAG.push(['rblin-double-black', 'Double black：下層 recolor，上層 restructure', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.8, dx: 0.8, dy: 1.25, sz: 0.66 });
  R.set(['P', 'B', ['A', 'B', ['x', 'B'], ['y', 'B']], ['S', 'B', ['f', 'B'], ['C', 'R', ['d', 'B'], ['e', 'B']]]]);
  say('多幾層的樹：remove x', '');
  await beat(tok, 2200);
  glow(R.c('x'), RED); glow(R.c('y'), GOLD);
  say('兄弟 y 黑、沒有小孩可借', '→ recolor');
  await beat(tok, 2600);
  glowAll(R, ['x', 'y'], null);
  R.set(['P', 'B', ['A', 'B', null, ['y', 'R']], ['S', 'B', ['f', 'B'], ['C', 'R', ['d', 'B'], ['e', 'B']]]], { fly: true });
  glow(R.c('A'), RED);
  const p = R.P.get('A'); const bb = tag('BB', 'ptr', p.x - 0.75, p.y + 0.5, 0);
  say('y 塗紅；A 變 double black', '迴圈跑回上一層：remove A');
  await beat(tok, 3000);
  glowAll(R, ['S', 'C'], GOLD);
  say('A 的兄弟 S 黑，有紅小孩 C', '上一層有人可借 → restructure');
  await beat(tok, 3000);
  glowAll(R, ['S', 'C', 'A'], null); kill(bb);
  R.set(['S', 'B', ['P', 'B', ['A', 'B', null, ['y', 'R']], ['f', 'B']], ['C', 'B', ['d', 'B'], ['e', 'B']]]);
  say('S 轉上去、P 轉下來', 'f 換給 P；C 塗黑；S 拿 P 的顏色');
  await beat(tok, 3200);
  say('restructure 一次就結束', 'recolor 往上傳 = 234 往上一層做 remove');
  await beat(tok, 3000);
}]);

// ═════════ 22. 234 操作 ↔ RB 操作 總表 ═════════
FRAG.push(['rblin-op-table', '234 操作 ↔ 紅黑樹操作 總整理', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  tag('2-3-4 tree', 'idx', -3.4, 6.6, 0); tag('red-black tree', 'idx', 3.0, 6.6, 0);
  const rows = [
    ['insert 2-node', '加一個紅 node', GREEN],
    ['insert 3-node', '加紅；偶爾 restructure', GOLD],
    ['insert 4-node（滿）', 'recolor，可能一路往上', RED],
    ['remove 4 / 3-node', '拿掉紅色 leaf', GREEN],
    ['remove 2-node：transfer', '(pre-)restructure', GOLD],
    ['remove 2-node：fuse', 'recolor，可能一路往上', RED],
  ];
  const icons = [];
  for (let i = 0; i < rows.length; i++) {
    const [a, b, c] = rows[i]; const y = 5.8 - i * 0.95;
    tag(a, 'ptr', -3.4, y, 0); arrow(V3(-1.0, y, 0), V3(0.4, y, 0));
    tag(b, 'ptr alt', 3.0, y, 0);
    const ic = cube('', c === RED ? RCL : c === GOLD ? YCL : '#3fa36b', [0.4, 0.4, 0.4], 6.2, y, 0, 2); icons.push([ic, c]);
    say(a + ' →', b);
    await beat(tok, 1500);
  }
  icons.forEach(([m, c]) => { if (c === RED) glow(m, RED); });
  say('234 最麻煩的 overflow / fuse', 'RB 只改 color bit，不動指標');
  await beat(tok, 3000);
  icons.forEach(([m, c]) => glow(m, c === GOLD ? GOLD : null));
  say('restructure 只在逼不得已時', '不像 AVL 每次插入都檢查');
  await beat(tok, 3000);
}]);

// ═════════ 23. 樹的家族：BST、AVL、2-3、2-3-4、RB、AA、B-tree ═════════
FRAG.push(['rblin-tree-family', '樹的家族：AVL、2-3、2-3-4、紅黑、AA、B-tree', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.6, 0]);
  const box = (t, c, x, y) => { const m = cube(t, c, [2.1, 0.75, 0.7], x, y, 0, 3); return m; };
  const bst = box('BST', '#4b9ee2', 0, 0.8);
  say('從 Binary Search Tree 出發', '');
  await beat(tok, 1800);
  box('AVL', '#4b9ee2', -4.4, 3.0); arrow(V3(-0.9, 1.2, 0), V3(-3.8, 2.6, 0));
  say('嚴格的 balancing → AVL tree', '');
  await beat(tok, 2200);
  box('2-3', KCL, 1.6, 3.0); arrow(V3(0.4, 1.2, 0), V3(1.3, 2.6, 0));
  say('往 multiway 發展：2-3 tree', '只有 2-node、3-node');
  await beat(tok, 2200);
  box('2-3-4', KCL, 1.6, 5.0); arrow(V3(1.6, 3.4, 0), V3(1.6, 4.6, 0));
  say('再到 2-3-4 tree', '');
  await beat(tok, 1800);
  box('red-black', BCL, 5.4, 5.0); arrow(V3(2.7, 5.0, 0), V3(4.3, 5.0, 0));
  say('2-3-4 的 BST 版本 = 紅黑樹', '在需要的性質上取得較好的平衡，最 popular');
  await beat(tok, 2600);
  box('AA tree', '#b9ad98', 5.4, 3.0); arrow(V3(2.7, 3.0, 0), V3(4.3, 3.0, 0));
  say('2-3 tree 的 BST 版本 = AA tree', '');
  await beat(tok, 2200);
  const bt = box('B-tree', KCL, 1.6, 7.0); arrow(V3(1.6, 5.4, 0), V3(1.6, 6.6, 0));
  glow(bt, GOLD);
  say('multiway 再發展 → B-tree 家族', '一個 node 裝很多資料：一次抓一把');
  await beat(tok, 3000);
  say('適合 external storage（硬碟）', '少拿小紙條到處找；B+ tree 等變化');
  await beat(tok, 3000);
  glow(bst, null);
}]);
  }
  // @@FRAGMENTS@@
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['bst-insert', 'runway-k-check', 'subtree-size-rank', 'bst-delete', 'degenerate-path', 'avl-rotation', 'avl-rr-rl', 'rb-insert'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
