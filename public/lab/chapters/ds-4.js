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
      : Array.from({ length: n }, (_, k) => k + 1).map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
        opts: fill([String(p.key), String(x.right.key), String(x.left.key)], String(s.key), [String(x.parent ? x.parent.key : t.root.key), ...seq.map(String)]),
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
        opts: fill([String((1 << h) - 1), String(1 << (h - 1)), String(N[h - 1] + N[h - 2])], String(N[h]), [String(h), String(N[h] + 1), String(N[h] - 1)]),
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
// ─── cH8nH0Enjhw：台大林軒田 DSA AVL Tree（RL）/ 2-3-4 Tree / Red-Black Tree — cued: each step(tok) waits for its sentence ───
// 例子取自影片：RR 複習 1、2、3；RL 特例 3、5、4；RL 通例 A、B、C、AL、BR、CL、CR；
// 網路 demo 依序插入 1、2、3、15、14、13，再刪 1、2、15 與非 leaf 的 13；
// 2-3-4 樹 5 16 / 3 | 7 11 14 | 18 21（插 2、20、13、23）；依序插入 1…10；
// 紅黑樹對應 2 5 / 1 | 3 4 | 6 7 8（插 1.5、4.5、1.8、9）。
// 高度以層數計，bf = hL − hR；紅黑樹：黑 = 一家的代表，紅 = 跟班。
// Little helpers make it lively: a 'pkt' tag walks the search path, 'say' bubbles let nodes talk,
// buddies (同學 / AVL / 紅黑樹 / 組長…) react with moods.
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, showL, anim, line, arrow, ghostBox, code, step, buddy, prop, bob, travel, remove, GOLD, GREEN, RED } = K;
const RBR = '#d64545', RBB = '#2b2b2b', RBN = '#9aa3ad';
const NO = (s) => '<span class="no">' + s + '</span>', OK = (s) => '<span class="ok">' + s + '</span>';
const pkt = (t, x, y, z = 0.5) => tag(t, 'pkt', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0.4) => tag(t, 'say', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
// walk a label through a list of points (each hop is short, so a step's motion stays ≤ ~2 s)
async function walk(tok, l, pts, ms = 380) { l.position.copy(pts[0]); for (let i = 1; i < pts.length; i++) await travel(tok, l, pts[i - 1], pts[i], ms); }
const asker = (x, z = 2.2, s = 0.65) => { const b = buddy('同學', '?', '#f4c27a', x, 0, z, s); b.mood('wow'); return b; };

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
  let x = t.root, bd = null;
  while (x) { if (Math.abs(hgt(x.l) - hgt(x.r)) > 1) bd = x; if (k === x.k) break; x = k < x.k ? x.l : x.r; }
  return bd;
}
function anyBad(n) { if (!n) return null; return anyBad(n.l) || anyBad(n.r) || (Math.abs(hgt(n.l) - hgt(n.r)) > 1 ? n : null); }
function delLeaf(t, k) { const n = findN(t, k), p = parOf(t, n); if (!p) t.root = null; else if (p.l === n) p.l = null; else p.r = null; }
function TV(t, o = {}) {
  const dx = o.dx || 1.25, dy = o.dy || 1.45, top = o.top || 5.4, cx = o.cx || 0, sz = o.sz || 0.85;
  const cubes = new Map(), labs = new Map(); let edges = [], labsOn = o.labs !== false;
  const v = { t, cubes, P: new Map() };
  const colOf = (n) => (o.rb ? (n.c === 'R' ? RBR : n.c === 'B' ? RBB : RBN) : colorFor(n.k));
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
        glow(m, labsOn && Math.abs(b) > 1 ? RED : null);
      }
    }
  };
  v.c = (k) => cubes.get(k);
  v.at = (k, dy = 0.85) => { const p = v.P.get(k); return V3(p.x, p.y + dy, 0.5); };
  v.showLabs = (on) => { labsOn = on; labs.forEach((l) => showL(l, on)); };
  return v;
}
const BF = (n) => { const b = hgt(n.l) - hgt(n.r); return 'bf ' + (b > 0 ? '+' + b : b); };
const HT = (n) => 'h ' + hgt(n);
// BST insertion with a little packet walking down the search path first
async function walkIns(tok, tv, t, k, c) {
  const ks = []; let x = t.root; while (x) { ks.push(x.k); x = k < x.k ? x.l : x.r; }
  if (ks.length) { const p = pkt(String(k), 0, 0); await walk(tok, p, ks.map((q) => tv.at(q)), 360); remove(p); }
  bstIns(t, k, c); tv.sync(k);
}
// AVL：找到失衡點後修正（單旋或雙旋，雙旋中間停一下）
async function avlFix(t, tv, bd, tok) {
  const b = hgt(bd.l) - hgt(bd.r);
  if (b < -1) { const B = bd.r; if (hgt(B.l) > hgt(B.r)) { rotUp(t, B, 'R'); tv.sync(); await beat(tok, 1100); } rotUp(t, bd, 'L'); }
  else { const B = bd.l; if (hgt(B.r) > hgt(B.l)) { rotUp(t, B, 'L'); tv.sync(); await beat(tok, 1100); } rotUp(t, bd, 'R'); }
  tv.sync();
}
function rbTree(spec) { const t = { root: null }; spec.forEach(([k, c]) => bstIns(t, k, c)); return t; }
const RB_EX = [[2, 'B'], [1, 'B'], [5, 'R'], [4, 'B'], [3, 'R'], [7, 'B'], [6, 'R'], [8, 'R']]; // 2 5 / 1 | 3 4 | 6 7 8

// ── 2-3-4 樹：node = { ks, ch }；leaf 畫出「蟑螂腳」 ──
const N4 = (ks, ch = []) => ({ ks, ch });
function T4(o = {}) {
  const kw = o.kw || 0.82, gap = o.gap || 0.55, dy = o.dy || 1.5, top = o.top || 5.4;
  const cubes = new Map(); let deco = [];
  const v = { root: null, cubes, legs: o.legs !== false, cx: o.cx || 0 };
  v.sync = (newK) => {
    deco.forEach(kill); deco = [];
    if (!v.root) return;
    let cur = 0;
    (function lay(n, d) {
      n._d = d;
      if (!n.ch.length) { const w = n.ks.length * kw; n._x = cur + w / 2; cur += w + gap; return; }
      n.ch.forEach((c) => lay(c, d + 1));
      n._x = (n.ch[0]._x + n.ch[n.ch.length - 1]._x) / 2;
    })(v.root, 0);
    const sh = -(cur - gap) / 2 + v.cx;
    const seen = new Set();
    (function draw(n) {
      const x0 = n._x + sh, y = top - n._d * dy, w = n.ks.length * kw, L = x0 - w / 2;
      n._px = x0; n._py = y; n._L = L;
      const g = ghostBox(n.ks.length > 3 ? '#d64545' : '#a99470', w + 0.16, 0.92, 1.0); g.position.set(x0, y, 0); deco.push(g);
      n.ks.forEach((k, i) => {
        seen.add(k);
        const x = L + kw * (i + 0.5);
        if (!cubes.has(k)) cubes.set(k, cube(k, colorFor(k), [kw - 0.08, 0.7, 0.8], x, y, 0, (k === newK || (Array.isArray(newK) && newK.includes(k))) ? 3 : 0));
        else move(cubes.get(k), x, y, 0);
      });
      if (n.ch.length) n.ch.forEach((c, j) => { deco.push(line(L + kw * j, y - 0.4, c._x + sh, top - c._d * dy + 0.4, 0)); draw(c); });
      else if (v.legs) for (let j = 0; j <= n.ks.length; j++) {
        const lx = L + kw * j, ex = lx + (j - n.ks.length / 2) * 0.14;
        deco.push(line(lx, y - 0.4, ex, y - 0.95, 0, '#3a3024'), cube('', '#3a3024', [0.13, 0.13, 0.13], ex, y - 0.98, 0));
      }
    })(v.root);
    for (const [k, m] of [...cubes]) if (!seen.has(k)) { kill(m); cubes.delete(k); }
  };
  v.clear = () => { deco.forEach(kill); deco = []; cubes.forEach(kill); cubes.clear(); v.root = null; };
  v.c = (k) => cubes.get(k);
  v.node = (k) => { const f = (n) => (n.ks.includes(k) ? n : n.ch.map(f).find(Boolean)); return f(v.root); };
  v.glowN = (n, c) => n.ks.forEach((k) => glow(cubes.get(k), c));
  v.leaves = () => { const out = []; (function f(n) { if (!n.ch.length) out.push(n); else n.ch.forEach(f); })(v.root); return out; };
  return v;
}
// a packet walking the multi-way search path of key k (returns the packet; caller removes it)
async function walk4(tok, tv, k) {
  const pts = []; let n = tv.root;
  for (;;) { pts.push(V3(n._px, n._py + 0.95, 0.5)); if (!n.ch.length) break; let i = 0; while (i < n.ks.length && k > n.ks[i]) i++; n = n.ch[i]; }
  const p = pkt(String(k), 0, 0); await walk(tok, p, pts, 450); return p;
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

// ═════════ 1. Q&A：為什麼 AVL 插入後的修正是 O(1)（8 steps）═════════
FRAG.push(['avllin-maint-cost', '維護的力氣：AVL O(1)、heap 上浮 O(log n)、complete BST 整棵動', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const mini = (cx, name) => {
    const P = [[0, 5.2], [-1, 4.0], [1, 4.0], [-1.5, 2.8], [-0.5, 2.8], [0.5, 2.8], [1.5, 2.8]];
    const cs = P.map(([x, y]) => cube('', '#c9b48a', [0.5, 0.5, 0.5], cx + x, y, 0));
    [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => line(cx + P[a][0], P[a][1], cx + P[b][0], P[b][1], 0));
    tag(name, 'ptr', cx, 6.1, 0);
    return cs;
  };
  const avl = mini(-4.3, 'AVL'), heap = mini(0, 'heap'), cbt = mini(4.3, 'complete BST');
  const cost = [tag('', 'ptr alt', -4.3, 1.9, 0), tag('', 'ptr alt', 0, 1.9, 0), tag('', 'ptr alt', 4.3, 1.9, 0)];
  const q = asker(-6.5, 2.4);
  await step(tok);                                   // 8:31 插入就是先 binary search…為什麼 O(1)
  const qb = bubble('insert 不是也要 O(log n)？', -5.6, 1.6, 2.4);
  say('問：插入要先 search，就 O(log n) 了', '為什麼說 AVL 修正是 O(1)？');
  await step(tok);                                   // 8:44 在原本 log n 之外還要花多少力氣
  kill(qb);
  for (const T of [avl, heap, cbt]) for (const i of [0, 2, 5]) glow(T[i], GOLD);
  const hand = pkt('search 往下走', -4.3, 6.0);
  await walk(tok, hand, [V3(-4.3, 5.9, 0.5), V3(-3.3, 4.7, 0.5), V3(-3.8, 3.5, 0.5)], 500);
  say('往下找的 O(log n) 本來就要花', '問的是：之後「調整」還要多花多少');
  await step(tok);                                   // 9:11 RR rotation：local 修正一次
  remove(hand); for (const T of [avl, heap, cbt]) for (const i of [0, 2, 5]) glow(T[i], null);
  glow(avl[2], GREEN); txt(cost[0], '修正 O(1)');
  const fx = bubble('只修我這裡', -3.0, 4.7, 0.4);
  say('AVL 的 RR：只在那一個點 rotate', '那裡修好，其他地方也都滿足 AVL');
  await step(tok);                                   // 9:42 heap：放最後再一路浮上來
  kill(fx);
  const up = pkt('上浮', 0.5, 3.4);
  for (const i of [5, 2, 0]) glow(heap[i], GOLD);
  await walk(tok, up, [V3(0.5, 3.4, 0.5), V3(1, 4.6, 0.5), V3(0, 5.8, 0.5)], 600);
  txt(cost[1], '上浮 O(log n)');
  say('heap insert：放最後，再一路浮上來', '可能浮很多層 → O(log n)');
  await step(tok);                                   // 10:03 maintenance 的力氣
  remove(up);
  note('maintenance：insert 完之後的「維護」', 0, 0.9, 1.4);
  say('這叫 maintenance 的力氣', 'AVL 額外的力氣是 constant');
  await step(tok);                                   // 10:24 跟 h 有關也還好
  txt(cost[1], 'O(h)，h ≤ O(log n)');
  say('如果跟樹高 h 有關，也還好', '因為 h 被限制在 O(log n)');
  await step(tok);                                   // 10:45 complete binary tree 整棵都動
  cbt.forEach((m) => glow(m, RED)); txt(cost[2], '整棵都要動');
  q.mood('sad');
  say('用 complete BST 當 BST：', '插入後這邊動、那邊動 → ' + NO('不太好'));
  await step(tok);                                   // 11:09 RR 一個地方修正，高枕無憂
  q.mood('happy'); await q.hop(tok);
  say('AVL 的 RR：一個地方修完', OK('就高枕無憂'));
}]);

// ═════════ 2. 複習 RR：1、2、3（13 steps）═════════
FRAG.push(['avllin-rr-123', '複習 RR：插入 1、2、3，把 2 拉上來', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.6, dy: 1.5, top: 5.6, lab: BF, labs: false });
  await step(tok);                                   // 19:31 AVL tree 就是一棵 BST
  note('AVL tree = BST + 平衡的規定', -4.4, 6.5, 0);
  say('AVL tree：先是一棵 binary search tree', '再加一條「平衡」的規定');
  await step(tok);                                   // 19:53 左右 subtree 高度相差在 1 以內
  const rule = tag('|左高 − 右高| ≤ 1', 'ptr alt', 4.2, 6.5, 0);
  say('每一棵 subtree：左高和右高', '相差要在 1 以內');
  await step(tok);                                   // 20:07 balance factor
  txt(rule, 'bf = 左高 − 右高 ∈ {+1, 0, −1}');
  say('左高減右高 = balance factor（bf）', '只能是 +1、0、−1');
  await step(tok);                                   // 20:22 先 follow BST insertion
  bstIns(t, 1); tv.sync(1); await beat(tok, 600);
  await walkIns(tok, tv, t, 2);
  say('insertion：先照 BST 的規則往下塞', '塞到 leaf 之後，再檢查平衡');
  await step(tok);                                   // 20:48 一路塞到右邊的右邊
  await walkIns(tok, tv, t, 3);
  say('insert 3：比 1 大往右、比 2 大再往右', '塞到「右邊的右邊」');
  await step(tok);                                   // 21:18 追蹤回來看 bf
  tv.showLabs(true); tv.sync();
  const back = pkt('往回檢查 bf', 0, 0);
  await walk(tok, back, [tv.at(3), tv.at(2), tv.at(1)], 600);
  say('塞完沿路往回走，看每個 bf', '中間可能一串都沒問題');
  await step(tok);                                   // 21:45 bf 變成 −2
  remove(back);
  const ow = bubble('我的 bf = −2！', -2.4, 6.6);
  say('走到 1：左邊空、右邊高 2', '1 的 bf = 0 − 2 = ' + NO('−2'));
  await step(tok);                                   // 22:58 把 2 拉上來當新的 root
  kill(ow); rotUp(t, t.root, 'L'); tv.sync();
  say('把中間的 2 拉上來當新 root', '1 降下來當小弟；3 還在 2 的右邊');
  await step(tok);                                   // 23:34 只改兩個 node 的關係，逆時針
  const blue = line(0, 5.6, -1.6, 4.1, 0, '#2f6fd6');
  const rot = bubble('逆時針扭回來 ↺', 2.2, 6.6);
  say('看似複雜，其實只改 1 和 2 的關係', '像把方向盤往回扭：逆時針旋轉');
  await step(tok);                                   // 24:16 另一條 link：2 的左子樹
  kill(rot);
  const sub = ghostBox('#dd8238', 1.0, 0.8, 1.0); sub.position.set(-0.8, 2.6, 0); sub.add(lab.label('2 原本的左子樹', 'idx'));
  line(-1.6, 4.1, -0.8, 3.0, 0, '#dd8238');
  say('還有一條 link：2 原本的左子樹', '比 1 大、比 2 小 → 改接到 1 的右邊');
  await step(tok);                                   // 25:04 放進去、找回來、修一次
  kill(blue);
  const up = pkt('往回找：最多 O(log n)', 0, 0);
  await walk(tok, up, [V3(1.6, 3.2, 0.5), V3(1.6, 4.9, 0.5), V3(0, 6.4, 0.5)], 600);
  say('放進去、往回找、在某個地方修一次', '往回找最多花 O(log n)');
  await step(tok);                                   // 25:44 修正本身只是幾行
  remove(up);
  good('修正本身：兩三行程式', 3.6, 5.6, 0);
  say('找到地方以後，修正本身只有幾行', '修完就不用再往上找');
  await step(tok);                                   // 26:09 對稱：左邊的左邊
  note('LL（左邊的左邊）：鏡像，一樣修', 3.6, 1.6, 0);
  say('對稱：塞很小的東西 → 左邊的左邊', 'LL 用鏡像的方式修');
}]);

// ═════════ 3. RL 特例：3、5、4（15 steps）═════════
FRAG.push(['avllin-rl-354', 'RL 特例：插入 3、5、4，兩次 rotate 讓 4 當頭', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.6, dy: 1.5, top: 5.6, lab: BF, labs: false });
  let roles = [];
  await step(tok);                                   // 26:54 插入 3、5、4：先放 3
  bstIns(t, 3); tv.sync(3);
  say('新的情形：依序插入 3、5、4', '先放 3：只有一個 node，當然平衡');
  await step(tok);                                   // 27:18 放 5
  await walkIns(tok, tv, t, 5);
  say('放 5：比 3 大 → 3 的右邊', 'bf 都合法，還是 AVL');
  await step(tok);                                   // 27:32 把 4 塞進去
  await walkIns(tok, tv, t, 4);
  say('麻煩的是 4：比 3 大、比 5 小', '→ 3 的右邊、5 的左邊');
  await step(tok);                                   // 27:49 bf：4 是 0、5 是 +1、3 是 −2
  tv.showLabs(true); tv.sync();
  say('bf：4 是 0、5 是 +1、3 是 −2', NO('這不是合法的 AVL tree'));
  await step(tok);                                   // 28:40 1、2、3 的理想：中間的當頭
  const ideal = note('1、2、3 的理想：中間的 2 當頭', 4.4, 6.5, 0);
  say('回想 1、2、3：把中間的 2 抓起來當頭', '1、3 在兩邊，就平衡了');
  await step(tok);                                   // 29:02 3、5 都是極值
  glow(tv.c(3), GOLD); glow(tv.c(5), GOLD);
  const x3 = bad('極值 ✗', -2.6, 6.3), x5 = bad('極值 ✗', 2.6, 4.8);
  say('3、5 都是極值', '抓起來當頭都不行');
  await step(tok);                                   // 29:28 想要 4 當頭
  kill(x3); kill(x5); glow(tv.c(3), null); glow(tv.c(5), null); kill(ideal);
  const goal = tag('目標：4 當頭，3、5 在兩邊', 'ptr alt', 4.4, 6.5, 0);
  say('想要：4 當頭、3 在左、5 在右', '只有三個點時，這幾乎是唯一的平衡方式');
  await step(tok);                                   // 30:28 3 是爺爺、5 是爸爸、4 是小孩
  roles = [bubble('阿公', -2.4, 6.3), bubble('爸爸', 2.6, 4.8), bubble('孫子：我想當頭', 1.4, 2.0)];
  say('3 是阿公、5 是爸爸、4 是孫子', '孫子要當頭，離得有點遠');
  await step(tok);                                   // 31:20 先處理跟爸爸的關係
  txt(roles[2], '先處理跟爸爸的關係');
  say('孫子想篡位：不能一下子挑戰阿公', '先處理他跟爸爸的關係');
  await step(tok);                                   // 32:15 先 rotate 4 跟 5
  roles.forEach(kill); roles = [];
  rotUp(t, findN(t, 5), 'R'); tv.sync();
  say('第一步：rotate(4, 5)', '4 上來，5 變成 4 的右小孩；3 渾然不知');
  await step(tok);                                   // 32:33 bf：5 是 0、4 是 −1、3 是 −2
  say('bf：5 是 0、4 是 −1、3 還是 −2', NO('還沒處理完'));
  await step(tok);                                   // 32:52 再 rotate 4 跟 3
  rotUp(t, t.root, 'L'); tv.sync();
  say('第二步：rotate(4, 3)', '4 再跟阿公交換');
  await step(tok);                                   // 33:53 孫子登上寶座
  kill(goal); glow(tv.c(4), GREEN);
  bubble('我當上 root 了！', 0, 6.6);
  say('孫子終於當上這棵 subtree 的 root', OK('bf 全部是 0，恢復平衡'));
  await step(tok);                                   // 34:21 插入點在阿公的右邊的左邊
  glow(tv.c(4), null);
  tag('RL：阿公的「右邊的左邊」', 'ptr alt', -4.2, 2.2, 0);
  say('插入點在出問題的阿公的右邊的左邊', '這叫 RL 的情形');
  await step(tok);                                   // 34:47 連跳兩級 → 兩次跳一級
  note('rotate 一次 = 跳一級；要跳兩級 → 兩次', 3.6, 1.4, 0);
  say('要連跳兩級不好做', '→ 用兩次「跳一級」的 rotate');
}]);

// ═════════ 4–5. RL 通例：A、B、C、AL、BR、CL、CR ═════════
// parts are created lazily (g.add) so the picture can grow sentence by sentence
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
  const g = { Y, POS, st: state, bfL: {}, has: new Set() };
  const subPos = (n, st) => { const [x, d] = POS[st][n]; return V3(x, Y(d) + 0.3 - hOf(KS[n]) / 2, 0); };
  const mk = (n) => {
    if (g.has.has(n)) return; g.has.add(n);
    const st = g.st, drop = opt.drop ? 2.2 : 0;
    if (NODES.includes(n)) { const [x, d] = POS[st][n]; g[n] = cube(n, n === 'A' ? '#4b9ee2' : n === 'B' ? '#2f8f6a' : '#b0457a', [0.8, 0.8, 0.8], x, Y(d), 0, drop); }
    else if (n === 'I') { const [x, d] = POS[st].I; g.I = cube('新', '#d64545', [0.55, 0.55, 0.55], x, Y(d), 0, drop); }
    else { const m = ghostBox(COL[n], 1.2, hOf(KS[n]), 1.0); m.position.copy(subPos(n, st)); const l = lab.label(n, 'idx'); m.add(l); m.userData.l = l; g[n] = m; }
  };
  let es = [];
  const pt = (n, st) => { const [x, d] = POS[st][n]; return NODES.includes(n) ? V3(x, Y(d), 0) : V3(x, Y(d) + 0.3, 0); };
  g.edges = (st) => {
    es.forEach(kill); es = [];
    for (const [a, b] of EDG[st]) if (g.has.has(a) && g.has.has(b)) { const p = pt(a, st), q = pt(b, st); es.push(line(p.x, p.y, q.x, q.y, 0)); }
    if (g.has.has('I') && g.has.has('CR')) { const [x, d] = POS[st].CR, q = POS[st].I; es.push(line(x, Y(d) - 0.3, q[0], Y(q[1]) + 0.28, 0, '#d64545')); }
  };
  g.add = (...ns) => { ns.forEach(mk); g.edges(g.st); };
  g.go = (st) => {
    es.forEach(kill); es = []; g.st = st;
    NODES.forEach((k) => { if (g[k]) move(g[k], POS[st][k][0], Y(POS[st][k][1]), 0); });
    SUBS.forEach((n) => { if (g[n]) { const p = subPos(n, st); move(g[n], p.x, p.y, 0); } });
    if (g.I) move(g.I, POS[st].I[0], Y(POS[st].I[1]), 0);
    NODES.forEach((k) => { if (g.bfL[k]) g.bfL[k].position.set(POS[st][k][0] + 0.75, Y(POS[st][k][1]) + 0.5, 0); });
  };
  g.bf = (vals) => {
    for (const k of NODES) {
      if (!g[k]) continue;
      if (!g.bfL[k]) g.bfL[k] = tag('', 'idx', 0, 0, 0);
      const l = g.bfL[k]; l.position.set(POS[g.st][k][0] + 0.75, Y(POS[g.st][k][1]) + 0.5, 0);
      const v = vals[k]; txt(l, v === undefined ? '' : 'bf ' + v);
      l.element.className = 'lab-label ' + (/2/.test(String(v)) ? 'ptr' : 'idx');
      glow(g[k], /2/.test(String(v)) ? RED : null);
    }
  };
  if (opt.all !== false) g.add(...NODES, ...SUBS, ...(opt.ins === false ? [] : ['I']));
  return g;
}
// 15 steps
FRAG.push(['avllin-rl-general-1', 'RL 通例（一）：A、B、C 三代，先 rotate(C, B)', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(0, { all: false, drop: true });
  await step(tok);                                   // 35:43 插入點在某棵 subtree 的最底層
  g.add('CL', 'CR', 'I');
  say('一般情形：新 node 插在最底層', '旁邊有兩棵完整的 subtree：CL、CR');
  await step(tok);                                   // 36:32 govern 它們的 root 叫 C
  g.add('C');
  say('管著 CL、CR 的 root 叫 C', '注意：紅色的「新」是插入的 node，不是 C');
  await step(tok);                                   // 37:00 C 有一點點不平衡
  g.bf({ C: '−1' });
  say('插入後 C 有一點點不平衡', 'bf(C) = −1：右邊高一點，還合法');
  await step(tok);                                   // 37:31 爸爸 B，另一顆 BR
  g.add('B', 'BR');
  say('C 的爸爸叫 B，另一邊是 BR', '原本 C 這棵和 BR 差不多高');
  await step(tok);                                   // 38:01 bf(B) = +1
  g.bf({ C: '−1', B: '+1' });
  say('C 這邊多了一層', 'bf(B) = +1，也還合法');
  await step(tok);                                   // 38:19 真正出問題的老爺爺 A
  g.add('A'); g.bf({ C: '−1', B: '+1' });
  say('再往上：真正出問題的老爺爺叫 A', '');
  await step(tok);                                   // 38:50 AL 跟 inserted 差兩層
  g.add('AL'); g.bf({ C: '−1', B: '+1', A: '−2' });
  say('A 的左邊是 AL', 'AL 的底和新 node 差兩層 → ' + NO('bf(A) = −2'));
  await step(tok);                                   // 39:30 對照 3、5、4
  const map = [bubble('= 3', -2.2, 6.6), bubble('= 5', 2.8, 5.6), bubble('= 4（也是新 node）', -0.4, 3.0)];
  say('對照 3、5、4：A = 3、B = 5', '4 同時是 C，也是新插入的 node');
  await step(tok);                                   // 40:38 restructure 的是 ABC；新 node 是導火線
  map.forEach(kill);
  g.bf({}); ['A', 'B', 'C'].forEach((k) => glow(g[k], GOLD));
  const fuse = bad('只是導火線', 2.6, 2.2);
  say('要 restructure 的是 A、B、C 三代', 'RL 指 ABC 的關係；新 node 只是導火線');
  await step(tok);                                   // 41:41 第一次：扭轉 C 跟 B
  kill(fuse); ['A', 'B', 'C'].forEach((k) => glow(g[k], null));
  g.go(1); await beat(tok, 1200); g.edges(1);
  say('第一次 rotate：扭轉 C 跟 B', 'C 上來，B 轉下去當 C 的小孩；A 看起來沒變');
  await step(tok);                                   // 42:27 BR 往下一層
  glow(g.BR, GOLD);
  say('B 降一層，BR 也跟著降一層', '現在和新 node 那層切齊');
  await step(tok);                                   // 42:49 CL 往上一層，跟 AL 切齊
  glow(g.BR, null); glow(g.CL, GOLD);
  say('C 升一層，CL 也跟著升一層', '和 AL 切齊');
  await step(tok);                                   // 43:08 CR 掛到 B 的左邊
  glow(g.CL, null); glow(g.CR, GOLD);
  say('CR 改掛到 B 的左邊', 'B 在 C 原本那層，所以 CR 高度不變');
  await step(tok);                                   // 43:55 B 平衡，C、A 差兩層
  glow(g.CR, null);
  g.bf({ A: '−2', C: '−2', B: '0' });
  say('B 平衡了', 'C、A 卻都差兩層：看起來更不平衡？');
  await step(tok);                                   // 44:15 只是暫時的狀態
  note('暫時的狀態 → 還有第二步', -4.0, 1.3, 0);
  say('沒錯，但這只是暫時的狀態', '下一步再把 C 轉上來');
}]);
// 13 steps
FRAG.push(['avllin-rl-general-2', 'RL 通例（二）：再 rotate(C, A)，樹高維持 h + 2', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(1);
  g.bf({ A: '−2', C: '−2', B: '0' });
  await step(tok);                                   // 44:36 最終：再把 C rotate 上來
  say('第一次 rotate 之後的樣子', '最終目標：再把 C rotate 上來');
  await step(tok);                                   // 44:57 rotate A 跟 C，C 成為新的霸主
  g.bf({}); g.go(2); await beat(tok, 1200); g.edges(2);
  const boss = bubble('新的霸主', 0, 7.0);
  say('第二次：rotate A 跟 C', 'C 成為這一群新的霸主');
  await step(tok);                                   // 45:10 B 跟著上一層，BR、CR、新 node 都上去
  kill(boss);
  [g.B, g.BR, g.CR, g.I].forEach((m) => glow(m, GOLD));
  say('從 B 的角度沒變：跟著 C 上一層', 'BR、CR、新 node 也都上去一層');
  await step(tok);                                   // 46:05 A 變成 C 的新小孩
  [g.B, g.BR, g.CR, g.I].forEach((m) => glow(m, null)); glow(g.A, GOLD);
  say('A 變成 C 的新左小孩', '');
  await step(tok);                                   // 46:27 AL 跟著降一級
  glow(g.A, null); glow(g.AL, GOLD);
  say('A 降一級，AL 也跟著降一級', '');
  await step(tok);                                   // 46:50 CL 上升一級，是 A 的新小孩
  glow(g.AL, null); glow(g.CL, GOLD);
  say('C 升一級，CL 也跟著上去', '但 CL 不接在 C 下面：它是 A 的新右小孩');
  await step(tok);                                   // 47:30 B 的 bf 是 0
  glow(g.CL, null); g.bf({ B: '0' });
  say('只看 A、B、C：B 的 bf 是 0', 'B 在第一次 rotate 就處理好了');
  await step(tok);                                   // 47:49 A：AL 跟 CL 只差 1
  g.bf({ B: '0', A: '+1' });
  say('A：AL 和 CL 只差 1', 'A 平衡');
  await step(tok);                                   // 47:59 C 也平衡，任務達成
  g.bf({ B: '0', A: '+1', C: '0' });
  say('C：左右兩邊最底端切齊', OK('C 也平衡，任務達成'));
  await step(tok);                                   // 48:41 以 BR 為基準，原本高 h + 2
  const hB = tag('BR 高 h', 'idx', 4.4, 3.6, 0);
  const hT = tag('插入前：A 這棵高 h + 2', 'ptr alt', -3.6, 6.8, 0);
  say('要不要再往上檢查？先算樹高', '以 BR 的高度 h 為基準：原本 h + 2');
  await step(tok);                                   // 49:01 做完以後還是 h + 2
  txt(hT, '調整後：C 這棵還是 h + 2'); glow(g.C, GREEN);
  say('調整完再算一次', '還是 h + 2');
  await step(tok);                                   // 49:13 高度沒變 → 上面的 bf 都不變
  good('上面的 node：什麼都沒變', 3.6, 6.8, 0);
  say('樹高沒變 → 上面所有 node 的 bf 都不變', '所以只要修這一次');
  await step(tok);                                   // 49:43 RL 修正；對稱 LR
  glow(g.C, null); kill(hB);
  note('RL ⇄ LR：鏡像', -4.0, 1.3, 0);
  say('這叫 RL 修正', '對稱的情形叫 LR 修正');
}]);

// ═════════ 6. 小結：兩招走天下（5 steps）═════════
FRAG.push(['avllin-cases-summary', 'AVL 兩招走天下：RR/LL 一次、RL/LR 兩次 rotation', async (tok) => {
  fresh([0, 4.6, 13], [0, 3.2, 0]);
  const Y0 = 5.4, D = 1.2;
  const mk = (cx, keys, chain, name, n) => {
    const P = {}; chain.forEach(([k, dx, d]) => { P[k] = [cx + dx, Y0 - d * D]; });
    const cs = {}; keys.forEach((k) => { cs[k] = cube(k, colorFor(k), [0.7, 0.7, 0.7], P[k][0], P[k][1], 0); });
    let es = [];
    const ed = (pairs, Q) => { es.forEach(kill); es = pairs.map(([a, b]) => line(Q[a][0], Q[a][1], Q[b][0], Q[b][1], 0)); };
    ed([[chain[0][0], chain[1][0]], [chain[1][0], chain[2][0]]], P);
    tag(name, 'ptr', cx, 0.9, 0); tag(n, 'idx', cx, 0.3, 0);
    return {
      cs,
      to(Q, pairs) { es.forEach(kill); es = []; for (const k of keys) move(cs[k], Q[k][0], Q[k][1], 0); return () => ed(pairs, Q); },
      Q: (spec) => { const Q = {}; spec.forEach(([k, dx, d]) => { Q[k] = [cx + dx, Y0 - d * D]; }); return Q; },
    };
  };
  const RR = mk(-4.8, [1, 2, 3], [[1, -0.6, 0], [2, 0, 1], [3, 0.6, 2]], 'RR', 'one rotation');
  const LL = mk(-1.6, [1, 2, 3], [[3, 0.6, 0], [2, 0, 1], [1, -0.6, 2]], 'LL', 'one rotation');
  const RL = mk(1.6, [3, 4, 5], [[3, -0.6, 0], [5, 0.6, 1], [4, 0, 2]], 'RL', 'two rotations');
  const LR = mk(4.8, [3, 4, 5], [[5, 0.6, 0], [3, -0.6, 1], [4, 0, 2]], 'LR', 'two rotations');
  const bal = (o, a, m, b) => o.Q([[m, 0, 0], [a, -0.75, 1], [b, 0.75, 1]]);
  await step(tok);                                   // 50:15 兩招走天下；RR、LL one rotation
  say('AVL 兩招走天下', 'RR、LL：在出問題的地方 one rotation');
  let f1 = RR.to(bal(RR, 1, 2, 3), [[2, 1], [2, 3]]), f2 = LL.to(bal(LL, 1, 2, 3), [[2, 1], [2, 3]]);
  await beat(tok, 1100); f1(); f2();
  await step(tok);                                   // 50:27 RL、LR：two rotations
  say('RL、LR：two rotations', '先跟爸爸換……');
  f1 = RL.to(RL.Q([[3, -0.6, 0], [4, 0.2, 1], [5, 0.8, 2]]), [[3, 4], [4, 5]]);
  f2 = LR.to(LR.Q([[5, 0.6, 0], [4, -0.2, 1], [3, -0.8, 2]]), [[5, 4], [4, 3]]);
  await beat(tok, 1100); f1(); f2();
  await step(tok);                                   // 50:33 第二代轉上來當新的 root
  f1 = RL.to(bal(RL, 3, 4, 5), [[4, 3], [4, 5]]); f2 = LR.to(bal(LR, 3, 4, 5), [[4, 3], [4, 5]]);
  await beat(tok, 1100); f1(); f2();
  say('……再跟阿公換：第二代當新的 root', OK('那棵 subtree 平衡了'));
  await step(tok);                                   // 50:54 所有修正都一樣
  tag('插入 → 往回走 → 第一個問題點 → 修正 → 結束', 'pkt', 0, 6.5, 0);
  say('所有修正都一樣', '插入、往回走、找第一個出問題的點，修完就沒了');
  await step(tok);                                   // 51:12 網路上有很多 demo
  const mon = prop('monitor', 6.4, 0, 2.2, 0.7, 'AVL demo'); bob(mon, 0.04);
  say('網路上有很多 AVL demo', '等一下直接開一個來看');
}]);

// ═════════ 7. Q&A：為什麼 CL、CR 一樣高（6 steps）═════════
FRAG.push(['avllin-rl-why-heights', 'Q&A：為什麼一開始 CL = CR？', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.6, 0]);
  const g = RLG(0, { ins: false });
  const Y = g.Y;
  const setK = (m, k, d) => { const h = (k - 1) * 0.95 + 0.6; m.scale.y = h / 0.6; m.position.y = Y(d) + 0.3 - h / 2; };
  g.bf({ A: '−1', B: '0', C: '0' });
  const q = asker(-6.3, 2.2);
  await step(tok);                                   // 52:03 一開始只能是 CL = CR？
  const qb = bubble('高度一定要這樣嗎？', -5.4, 1.6, 2.2);
  say('問：示意圖一開始的高度一定要這樣？', '插入前：CL = CR，A 的 bf = −1');
  await step(tok);                                   // 52:34 插在 CL 或 CR 都一樣
  kill(qb);
  const ins = cube('新', '#d64545', [0.55, 0.55, 0.55], -0.6, Y(4), 0, 2.5);
  await beat(tok, 900); move(ins, 1.4, Y(4), 0);
  say('插在 CL 或 CR 都一樣', '重點是 C 帶頭的這棵變高了');
  await step(tok);                                   // 53:06 CL、CR 不一樣高 → C 自己出問題
  kill(ins); g.CL.visible = false; showL(g.CL.userData.l, false);
  const ins2 = cube('新', '#d64545', [0.55, 0.55, 0.55], 1.4, Y(4), 0, 2.5);
  g.bf({ C: '−2' });
  say('如果 CL 比 CR 矮（例如空的）？', '插完 C 自己就 bf = −2 → 出問題的是 C');
  await step(tok);                                   // 53:27 CL 本來就高一層 → A 早就違反
  kill(ins2); g.CL.visible = true; showL(g.CL.userData.l, true);
  setK(g.CL, 2, 3); glow(g.CL, GOLD);
  g.bf({ A: '−2?', B: '+1', C: '+1' });
  say('如果 CL 本來就高一層？', 'AL 和 CL 差太多 → A 在插入前就壞了');
  await step(tok);                                   // 54:04 CL 不能太高、不能太矮
  setK(g.CL, 1, 3); glow(g.CL, null);
  g.bf({ A: '−1', B: '0', C: '0' });
  say('CL 不能太高，也不能太矮', '');
  await step(tok);                                   // 54:19 A 是第一個出問題的點
  glow(g.A, GOLD); q.mood('happy'); await q.hop(tok);
  say('因為 A 是「第一個」出問題的點', '各棵 subtree 的高度就被限制住了');
}]);

// ═════════ 8. Demo：依序插入 1, 2, 3, 15, 14, 13（13 steps）═════════
FRAG.push(['avllin-demo-insert', 'AVL demo：插入 1、2、3、15、14、13', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { dx: 1.35, dy: 1.45, top: 5.6, lab: HT });
  const mon = prop('monitor', -6.3, 0, 2.0, 0.7, '網路 demo'); bob(mon, 0.04);
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 1:03:03 網路上找的 AVL demo
  say('網路上隨便找的 AVL demo', '看看 AVL tree 實際怎麼運作');
  await step(tok);                                   // 1:03:28 1、2 塞進去；旁邊的數字是高度
  bstIns(t, 1); tv.sync(1); await beat(tok, 600);
  await walkIns(tok, tv, t, 2);
  say('塞 1、塞 2：node 旁邊多了數字', '那是這棵 subtree 的高度 h');
  await step(tok);                                   // 1:03:41 實作通常存高度
  tmp.push(note('存高度；要 bf 時再「左高 − 右高」', 3.6, 6.6, 0));
  say('實作通常存每棵 subtree 的高度', '需要 bf 時再拿高度相減');
  await step(tok);                                   // 1:03:58 塞 3：比 1 右、比 2 右
  clr(); await walkIns(tok, tv, t, 3);
  say('塞 3：比 1 大、比 2 大 → 2 的右邊', '往回更新每棵 subtree 的高度');
  await step(tok);                                   // 1:04:15 把中間的 2 拉上來
  await avlFix(t, tv, firstBad(t, 3), tok);
  say('有一棵不對：把中間的 2 拉上來', '上次講的 RR rotation');
  await step(tok);                                   // 1:04:32 塞 15：不需要 rotation
  await walkIns(tok, tv, t, 15);
  say('塞 15：更新上面的高度', OK('不需要任何 rotation'));
  await step(tok);                                   // 1:04:46 RL：塞 14
  await walkIns(tok, tv, t, 14);
  say('塞 14：2 右、3 右、15 左', '今天講的 RL 什麼時候發生？');
  await step(tok);                                   // 1:05:04 在 3 產生不平衡
  tmp.push(bubble('右邊太高了！', tv.P.get(3).x - 0.4, tv.P.get(3).y + 1.0));
  say('在 3 產生了不平衡', '3 的右邊比左邊高 2');
  await step(tok);                                   // 1:05:25 發生問題做調整
  clr(); await avlFix(t, tv, firstBad(t, 14), tok);
  say('做調整：14 拉上來', '3、15 在兩邊，更平衡了');
  await step(tok);                                   // 1:05:55 再塞 13
  await walkIns(tok, tv, t, 13);
  say('再塞 13：比 2 大、比 14 小、比 3 大', '塞在 3 的右邊');
  await step(tok);                                   // 1:06:13 14 還平衡，回到 2 才不平衡
  tmp.push(bubble('我還平衡', tv.P.get(14).x + 0.6, tv.P.get(14).y + 1.0));
  say('出問題的不是 13，也不是 14', '回到 2 才不平衡');
  await step(tok);                                   // 1:06:20 兩次 rotation：2、14、3 重新洗牌
  clr(); await avlFix(t, tv, firstBad(t, 13), tok);
  say('兩次 rotation：2、14、3 重新洗牌', '3 被拉上去');
  await step(tok);                                   // 1:06:54 最終達成比較平衡的 tree
  glow(tv.c(3), GREEN);
  say('最後得到一棵比較平衡的 tree', OK('這就是 AVL 的 insertion'));
}]);

// ═════════ 9. Demo：刪除 1、2、15，與非 leaf 的 13（14 steps）═════════
FRAG.push(['avllin-demo-delete', 'AVL removal demo：刪 1、2、15，刪 13 找人補位', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const t = { root: null }; [3, 2, 14, 1, 13, 15].forEach((k) => bstIns(t, k));
  const tv = TV(t, { dx: 1.35, dy: 1.45, top: 5.6, lab: HT }); tv.sync();
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  const rm = async (k) => { glow(tv.c(k), GOLD); await beat(tok, 600); delLeaf(t, k); tv.sync(); };
  await step(tok);                                   // 1:07:14 removal 原理一樣
  say('removal 的原理一樣', '移掉 → 往回找 → 不平衡就調整');
  await step(tok);                                   // 1:07:31 移掉 1，沒有不平衡
  await rm(1);
  say('remove 1：找到它、移掉', OK('往回看高度：沒有不平衡，繼續'));
  await step(tok);                                   // 1:07:51 移掉 2，不平衡了
  await rm(2);
  say('remove 2：移掉以後', NO('3 不平衡了'));
  await step(tok);                                   // 1:08:00 重新旋轉
  await avlFix(t, tv, anyBad(t.root), tok);
  say('旋轉一次：14 拉上來', '重新平衡');
  await step(tok);                                   // 1:08:11 移掉 15，又不平衡
  await rm(15);
  say('remove 15：又不平衡了', NO('14 的左邊太高'));
  await step(tok);                                   // 1:08:19 轉一轉，看要把哪一個拉上來
  await avlFix(t, tv, anyBad(t.root), tok);
  say('再轉一轉：這次兩次 rotation', '13 被拉上來');
  await step(tok);                                   // 1:09:02 要 remove 的是 non-leaf？
  glow(tv.c(13), RED);
  say('剛才移的都是 leaf', '如果要 remove 的不是 leaf，例如 13？');
  await step(tok);                                   // 1:09:44 找另一個 node 來補位
  tmp.push(bad('直接挖空 → 整棵要重排', 0, 6.7));
  say('直接挖空，整個結構都要重新調整', '所以：找另一個 node 來補位');
  await step(tok);                                   // 1:10:12 再插一個 node（5）
  clr(); await walkIns(tok, tv, t, 5);
  say('再插一個 5，比較看得出來', '');
  await step(tok);                                   // 1:10:30 把 5 叫上來補位
  const n13 = findN(t, 13); delLeaf(t, 5); n13.k = 5; tv.sync(); glow(tv.c(5), GOLD);
  say('remove 13：把 5 叫上來補位', '樹的結構不用大改');
  await step(tok);                                   // 1:10:36 像 heap：抓小弟上來頂著
  tmp.push(note('像 heap：先抓一個小弟上來頂著', -3.8, 1.3, 0));
  say('就像以前的 heap', '移掉的位置先抓個小弟頂著，再慢慢調整');
  await step(tok);                                   // 1:11:13 左子樹最右邊 = 最大
  clr();
  tmp.push(bubble('左子樹裡最大的（最右邊）', tv.P.get(5).x, tv.P.get(5).y + 1.0));
  say('去哪找？左子樹裡最右邊的 node', '= 左子樹最大的：數字上最接近 13（這裡剛好是 leaf）');
  await step(tok);                                   // 1:11:43 幾乎只是移除一個 leaf
  clr(); glow(tv.c(5), null);
  say('補位後，改成刪掉那個最大 node', '它最多只有一個左小孩：是 leaf 就拿掉，否則把小孩接上；再檢查 subtree 高度');
  await step(tok);                                   // 1:12:18 不是 leaf → 抓 leaf 補位
  good('兩個小孩 → 左子樹最大（或右子樹最小）來補位', 0, 6.7);
  say('BST 的 removal：移掉 leaf 最容易；一個小孩就讓小孩頂上', '兩個小孩 → 左子樹最大（或右子樹最小）補位，再刪掉它');
}]);
// Q&A：一定要往左邊抓嗎？（6 steps）
FRAG.push(['avllin-pick-side', 'Q&A：補位一定要往左邊抓嗎？左子樹最大或右子樹最小', async (tok) => {
  fresh([0, 5, 12.5], [0, 3, 0]);
  const t = { root: null }; [13, 3, 14, 5].forEach((k) => bstIns(t, k));
  const tv = TV(t, { dx: 1.5, dy: 1.45, top: 5.6, lab: HT }); tv.sync();
  const q = asker(-6.0, 2.2);
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 1:13:21 一定是往左邊抓小弟嗎
  glow(tv.c(13), RED);
  tmp.push(bubble('一定要往左邊抓嗎？', -5.0, 1.6, 2.2));
  say('問：remove 13，補位一定要往左邊抓嗎？', '');
  await step(tok);                                   // 1:13:27 可以往左也可以往右
  clr();
  say('往左、往右都可以', '只要抓「數字最接近」的那個');
  await step(tok);                                   // 1:13:42 左子樹裡最大的
  glow(tv.c(5), GOLD);
  const pl = pkt('往左一步，再一路往右', 0, 0);
  await walk(tok, pl, [tv.at(13), tv.at(3), tv.at(5)], 500);
  txt(pl, '左子樹最大：5');
  say('可以抓左子樹裡最大的：5', '');
  await step(tok);                                   // 1:13:47 右子樹裡最小的
  glow(tv.c(14), GOLD);
  const pr = pkt('往右一步，再一路往左', 0, 0);
  await walk(tok, pr, [tv.at(13), tv.at(14)], 500);
  txt(pr, '右子樹最小：14');
  say('也可以抓右子樹裡最小的：14', '');
  await step(tok);                                   // 1:13:54 先往左，左邊空才往右
  say('常見做法：先往左邊抓', '左邊那棵是空的，才往右邊抓');
  await step(tok);                                   // 1:14:02 抓一個上來 → remove a leaf
  remove(pl); remove(pr); glow(tv.c(14), null); glow(tv.c(13), null);
  const n13 = findN(t, 13); delLeaf(t, 5); n13.k = 5; tv.sync(); glow(tv.c(5), GREEN);
  q.mood('happy'); await q.hop(tok);
  say('抓一個上來以後', '問題就變成刪掉補位的那個 node（最多一個小孩；這裡 5 是 leaf）');
}]);

// ═════════ 10. AVL vs 紅黑樹（12 steps）═════════
const RB8 = [[5, 'B'], [2, 'R'], [1, 'B'], [4, 'B'], [3, 'R'], [7, 'B'], [6, 'R'], [8, 'R']];
FRAG.push(['avllin-avl-vs-rb', 'AVL vs 紅黑樹：矮一點好 search，鬆一點好更新', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const ta = { root: null }; [4, 2, 6, 1, 3, 5, 7].forEach((k) => bstIns(ta, k));
  const va = TV(ta, { cx: -3.5, dx: 0.72, dy: 1.3, top: 5.2, sz: 0.62 }); va.sync();
  const tb = rbTree(RB8); const vb = TV(tb, { rb: true, cx: 3.3, dx: 0.72, dy: 1.3, top: 5.2, sz: 0.62 }); vb.sync();
  tag('AVL', 'ptr', -3.5, 6.3, 0); tag('紅黑樹', 'ptr', 3.3, 6.3, 0);
  const ba = buddy('AVL', '', '#7cb8ee', -3.5, 0, 2.4, 0.7), bb = buddy('紅黑樹', '', '#e98b8b', 3.3, 0, 2.4, 0.7);
  await step(tok);                                   // 1:14:38 AVL 比較好教
  ba.mood('happy');
  say('AVL：比較好教的 balanced BST', '');
  await step(tok);                                   // 1:14:51 四個 case 其實兩個
  ba.set('2 招');
  say('insertion 四個 case，其實只有兩種', 'one rotation／two rotations');
  await step(tok);                                   // 1:15:08 缺點：多存 subtree 高度
  const hs = [];
  for (const [k, p] of va.P) hs.push(tag('h' + hgt(findN(ta, k)), 'idx', p.x + 0.42, p.y + 0.4, 0));
  say('缺點：每個 node 要多存 subtree 高度', '');
  await step(tok);                                   // 1:15:24 int 4 bytes 或 short
  ba.set('+4 bytes'); ba.mood('sad');
  say('一個 int 約 4 bytes（或用 short）', '這就是 memory overhead');
  await step(tok);                                   // 1:15:39 樹高比較矮 → 適合 search
  va.cubes.forEach((m) => glow(m, GREEN)); ba.mood('happy');
  say('優點：樹高比較矮', '樹越矮越適合 search');
  await step(tok);                                   // 1:16:03 維持矮要多花力氣
  note('trade-off：越嚴格，維護越費力', -3.5, 1.5, 0);
  say('為了維持矮，維護要多花一些力氣', '越嚴格的 data structure，維護越費力');
  await step(tok);                                   // 1:16:20 還是 log n，但常數大
  say('insertion、removal 還是 O(log n)', '只是 log n 前面的常數大一些');
  await step(tok);                                   // 1:16:33 紅黑樹相反：寬鬆一點
  va.cubes.forEach((m) => glow(m, null)); vb.cubes.forEach((m) => glow(m, GOLD)); bb.mood('happy');
  say('紅黑樹剛好相反：寬鬆一點', 'search 可能多花一點點時間');
  await step(tok);                                   // 1:16:47 動態環境比較好
  say('但 insertion、removal 比較有效率', '在變動很多的動態環境比較好');
  await step(tok);                                   // 1:17:07 每個 node 塗顏色，1 bit
  vb.cubes.forEach((m) => glow(m, null)); bb.set('1 bit');
  say('每個 node 只要記一個顏色', '紅或黑：1 bit 就夠，不用存高度');
  await step(tok);                                   // 1:17:43 唯一缺點：難教
  bb.mood('sad');
  say('紅黑樹唯一的缺點：難教', '');
  await step(tok);                                   // 1:17:59 像念咒語
  hs.forEach(kill); bb.mood('wow');
  bubble('插紅色 → 看爸爸 → 看叔叔…', 3.3, 1.8, 2.4);
  say('直接教就像在念咒語', '插紅色、看爸爸是不是紅、再看叔叔……');
}]);

// ═════════ 11. 紅黑樹的規則（咒語）→ 先教 2-3-4 樹（7 steps）═════════
FRAG.push(['avllin-rb-rules', '紅黑樹的「咒語」：三條規則', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = rbTree(RB8); const tv = TV(t, { rb: true, dx: 1.1, dy: 1.4, top: 5.6 }); tv.sync();
  await step(tok);                                   // 1:18:58 root 是黑色
  glow(tv.c(5), GOLD);
  say('紅黑樹的咒語，規則一：root 是黑色', '');
  await step(tok);                                   // 1:19:06 紅 node 的小孩一定黑
  glow(tv.c(5), null);
  for (const k of [2, 1, 4]) glow(tv.c(k), GOLD);
  say('規則二：紅色 node 的小孩一定是黑色', '例：2 是紅 → 1、4 都是黑');
  await step(tok);                                   // 1:19:13 root 到每個 leaf 黑色一樣多
  for (const k of [2, 1, 4]) glow(tv.c(k), null);
  const cnt = tag('', 'ptr alt', 4.6, 6.6, 0);
  for (const path of [[5, 2, 1], [5, 2, 4, 3], [5, 7, 8]]) {
    path.forEach((k) => glow(tv.c(k), GREEN));
    txt(cnt, path.join('→') + '：黑 ' + path.filter((k) => findN(t, k).c === 'B').length + ' 個');
    await beat(tok, 700);
    path.forEach((k) => glow(tv.c(k), null));
  }
  say('規則三：root 到每個 leaf', '經過的黑色 node 一樣多');
  await step(tok);                                   // 1:19:23 這咒語怎麼想出來的
  const w = asker(-6.0, 2.2);
  bubble('這咒語怎麼想出來的？', -5.0, 1.6, 2.2);
  say('這咒語是怎麼想出來的？', '直接背很難懂');
  await step(tok);                                   // 1:19:29 有一個相對應、好懂但不實用的樹
  say('紅黑樹有一個相對應的資料結構', '非常好懂，但一點也不實用');
  await step(tok);                                   // 1:19:52 先教那棵樹，再教紅黑樹
  w.mood('happy');
  say('先教那棵樹', '再對照著教紅黑樹，會好懂很多');
  await step(tok);                                   // 1:20:36 新的樹叫做……
  tag('2-3-4 tree', 'ptr alt', 0, 0.6, 1.5);
  say('這棵新的樹叫做……', '2-3-4 tree');
}]);

// ═════════ 12. 2-3-4 樹的三種 node（12 steps）═════════
FRAG.push(['avllin-234-nodes', '2-3-4 樹：2-node、3-node、4-node', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3, 0]);
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
  let av, tw, tmp = [];
  await step(tok);                                   // 1:20:53 新的樹：2-3-4 tree
  tag('2-3-4 tree（也寫成 2-4 tree）', 'ptr alt', 0, 6.4, 0);
  say('新的樹：2-3-4 tree', '最後會對應到紅黑樹');
  await step(tok);                                   // 1:21:15 AVL：路見不平，立刻 rebalance
  av = buddy('AVL', '', '#7cb8ee', -6.3, 0, 2.4, 0.65); av.mood('wow');
  tmp.push(bubble('不平衡？馬上修！', -5.6, 1.6, 2.4));
  say('AVL：路見不平', '幾乎立刻 rebalance，什麼都要完美');
  await step(tok);                                   // 1:22:09 2-3-4 樹寬鬆一點
  tmp.forEach(kill); tmp = [];
  tw = buddy('2-3-4', '', '#2fc092', 6.3, 0, 2.4, 0.65); tw.mood('happy');
  say('2-3-4 樹走寬鬆一點的路', '用別的方式維持平衡');
  await step(tok);                                   // 1:22:32 暫存：先放在這邊
  tmp.push(bubble('先暫時放這邊吧', 5.6, 1.6, 2.4));
  say('用「暫存」：找到位置就先放著', '有一點不平衡也沒關係');
  await step(tok);                                   // 1:22:51 BST 每個 node 只能放一個
  tmp.forEach(kill); tmp = [];
  tmp.push(bubble('一個 node 只能放一個！', -5.6, 1.6, 2.4));
  say('BST 每個 node 只能放一個東西', '');
  await step(tok);                                   // 1:23:09 node 可以放很多東西、很多小孩
  tmp.forEach(kill); tmp = [];
  say('2-3-4 樹：一個 node 可以放好幾個 element', '也就有好幾個小孩');
  await step(tok);                                   // 1:23:29 2-node
  node(-4.4, ['a'], ['< a', '> a']); tag('2-node', 'ptr', -4.4, 5.6, 0);
  say('2-node：1 個 element、2 個小孩', '左邊全部 < a，右邊全部 > a');
  await step(tok);                                   // 1:23:49 3-node
  node(-0.6, ['a', 'b'], ['< a', 'a~b', '> b']); tag('3-node', 'ptr', -0.6, 5.6, 0);
  say('3-node：a < b，3 個小孩', '< a ｜ a 到 b 之間 ｜ > b');
  await step(tok);                                   // 1:24:14 4-node
  node(4.0, ['a', 'b', 'c'], ['< a', 'a~b', 'b~c', '> c']); tag('4-node', 'ptr', 4.0, 5.6, 0);
  say('4-node：a < b < c，4 個小孩', '');
  await step(tok);                                   // 1:24:55 沒滿的 node 可以再擠一下
  const nb = pkt('b', -4.4, 6.6);
  await travel(tok, nb, V3(-4.4, 6.6, 0.5), V3(-3.6, 4.6, 0.6), 900);
  tw.mood('happy'); await tw.hop(tok);
  say('彈性：沒滿的 node 可以再擠一下', '每個 node 在滿之前都是暫存區');
  await step(tok);                                   // 1:25:42 也可以 2-3-4-5、2-3
  remove(nb);
  say('也可以做 2-3-4-5、2-3……', '為了紅黑樹，只講 2-3-4');
  await step(tok);                                   // 1:26:11 好懂但不容易 implement
  tw.mood('sad');
  say('2-3-4 樹很好懂', '但很不容易 implement，不太實用');
}]);

// ═════════ 13. 典型的 2-3-4 樹與兩條規則（9 steps）═════════
FRAG.push(['avllin-234-rules', '2-3-4 樹：橫向寬鬆、縱向嚴格（leaf 同高）', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0, legs: false });
  let tmp = [];
  await step(tok);                                   // 1:26:44 root 可以放一筆、兩筆或三筆
  say('一棵典型的 2-3-4 樹', 'root 可以是 2-、3- 或 4-node');
  await step(tok);                                   // 1:26:54 root 放 5 跟 16
  tv.root = N4([5, 16]); tv.sync([5, 16]);
  say('例如 root 放 5 和 16', '一個 3-node');
  await step(tok);                                   // 1:27:02 3（2-node）、7 11 14（4-node）
  tv.root.ch = [N4([3]), N4([7, 11, 14])]; tv.sync([3, 7, 11, 14]);
  say('小孩：3 是 2-node', '7 11 14 是 4-node');
  await step(tok);                                   // 1:27:14 18 21（3-node）
  tv.root.ch.push(N4([18, 21])); tv.sync([18, 21]);
  say('18 21 是 3-node', '這就是 2-3-4 樹的長相');
  await step(tok);                                   // 1:27:48 限制一：橫向彈性
  tmp.push(note('橫向：一個 node 可以裝 1～3 筆', 0, 6.5, 0));
  say('規定一：每個 node 是 2-、3- 或 4-node', '橫向很有彈性');
  await step(tok);                                   // 1:28:08 限制二：所有 leaf 同高
  tmp.forEach(kill); tmp = [];
  tv.leaves().forEach((n) => tv.glowN(n, GREEN));
  tmp.push(tag('所有 leaf 都在同一層', 'ptr alt', 0, 2.3, 1.2));
  say('規定二：所有 leaf 在同一個高度', '縱向比 BST 更嚴格');
  await step(tok);                                   // 1:28:58 嚴格說是空的腳要同高
  tmp.forEach(kill); tmp = [];
  tv.leaves().forEach((n) => tv.glowN(n, null));
  tv.legs = true; tv.sync();
  tmp.push(note('空腳（之後會長東西的位置）都同高', 0, 0.5, 1.2));
  say('嚴格說：leaf 往下長出的「空腳」要同高', '這些黑黑的點都在同一層');
  await step(tok);                                   // 1:29:29 所以高度是 log n
  say('所以樹高是 O(log n)', '跟 balanced BST 一樣有保證');
  await step(tok);                                   // 1:29:44 兩個極端
  tmp.forEach(kill); tmp = [];
  note('每個都裝 3 筆 → 最矮', -4.0, 6.6, 0); note('每個只裝 1 筆 → 像 BST', 4.0, 6.6, 0);
  say('兩個極端：每個 node 都裝滿 3 筆', '或每個只裝 1 筆；高度都是 log n 等級');
}]);

// ═════════ 14. 有空房間就住：insert 2、20、13（11 steps）═════════
FRAG.push(['avllin-234-easy-insert', '2-3-4 插入：有空房就住（2、20），13 碰到滿房', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0 }); tv.root = EX234(); tv.sync();
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  const under = (n, t) => { const g = ghostBox('#d64545', 0.9, 0.9, 1.0); g.position.set(n._px - 0.4, n._py - 2.0, 0); tmp.push(g, bad(t, n._px - 0.4, n._py - 2.9)); };
  await step(tok);                                   // 1:30:27 塞 2：5 的左邊、3 的左邊
  let p = await walk4(tok, tv, 2);
  say('insert 2：比 5 小 → 往 3 那邊', '3 是 leaf，已經到底了');
  await step(tok);                                   // 1:30:46 不要再往下長一個
  under(tv.node(3), '往下長一層 ✗');
  say('不要再往下長一個新 node', '那樣它的腳就和別人不同高');
  await step(tok);                                   // 1:30:55 3 還沒滿 → 2 放這裡
  clr(); remove(p); await ins4(tv, 2);
  say('3 還沒滿：2 直接住進 3 的房間', OK('leaf 上沒滿的房間都能自由塞'));
  await step(tok);                                   // 1:31:20 塞 20：比 16 大
  p = await walk4(tok, tv, 20);
  say('insert 20：比 16 大 → 18 21', '');
  await step(tok);                                   // 1:31:33 還有一間空房間
  remove(p); await ins4(tv, 20);
  say('還有一間空房間 → 18 20 21', OK('一點也不難'));
  await step(tok);                                   // 1:31:55 困難只有：塞 13
  p = await walk4(tok, tv, 13);
  say('困難只有一種：insert 13', '比 5 大、比 16 小 → 走到 7 11 14');
  await step(tok);                                   // 1:32:16 房間滿了
  const n = tv.node(11); tv.glowN(n, RED); txt(p, '13 住不下？');
  say('糟了：房間滿了', '7 11 14 已經是 4-node');
  await step(tok);                                   // 1:32:25 不能往下塞
  under(n, '13 往下塞 ✗');
  say('也不能往下塞', '13 長出的蟑螂腳會和其他人不同層');
  await step(tok);                                   // 1:32:59 仍有 search 性質：multi-way search
  clr(); tv.glowN(n, null); remove(p);
  p = await walk4(tok, tv, 14); txt(p, '找 14：看 key 決定走哪棵');
  say('2-3-4 樹仍有 search（order）性質', 'multi-way search：看 key 決定走哪棵 subtree');
  await step(tok);                                   // 1:34:11 multi-way + 高度保證 → log n
  remove(p);
  say('multi-way search + 高度保證', '在 O(log n) 內找到東西');
  await step(tok);                                   // 1:34:42 有空房間容易；沒空房間才是問題
  say('有空房間：insert 很容易', '沒空房間：接下來要探討的問題');
}]);

// ═════════ 15. Overflow → 分家：insert 13（11 steps）═════════
FRAG.push(['avllin-234-split-13', 'Overflow 分家：7 11 14 插入 13，11 往上', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const tv = T4({ top: 5.4, dy: 2.0 }); tv.root = EX234(); tv.sync();
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 1:37:10 insert 13 會發生什麼
  const p = await walk4(tok, tv, 13);
  say('insert 13 會發生什麼事？', '一路找到 7 11 14');
  await step(tok);                                   // 1:37:29 房間滿了 = overflow
  remove(p);
  await ins4(tv, 13, {
    placed: async () => { say('7 11 13 14：房間滿了', '2-3-4 樹的專有名詞：' + NO('overflow')); },
    over: async () => {
      await step(tok);                               // 1:37:48 滿了就分家
      say('房間滿了就分家', '家裡小孩太多，住不下');
      await step(tok);                               // 1:38:20 一定要有人留在這一層
      tmp.push(note('有人留在這層 → leaf 高度不變', 0, 6.8, 0));
      say('一定要有一些人留在這一層', '這樣 leaf 的高度才不變');
      await step(tok);                               // 1:38:47 把中間的抓起來：11 或 13
      clr(); glow(tv.c(11), GOLD); glow(tv.c(13), GOLD);
      say('把中間的抓起來', '11 或 13 都可以（跟 AVL 抓中間一樣）');
      await step(tok);                               // 1:39:14 不能抓 7
      glow(tv.c(11), null); glow(tv.c(13), null); glow(tv.c(7), GOLD);
      tmp.push(bubble('抓我上去？', -1.6, 4.4));
      say('為什麼不抓 7？', '7 會一邊有小孩、一邊沒有 → 那邊沒有 leaf');
      await step(tok);                               // 1:39:40 7、13 14 留下，11 高一層
      clr(); glow(tv.c(7), null); glow(tv.c(11), GOLD);
      say('7 跟 13 14 留在原來那層', '11 要比他們高一層');
      await step(tok);                               // 1:39:59 11 往上 insert，split
      say('11 往上一層 insert', '7 和 13 14 split 成兩個 node');
    },
    split: async () => {
      await step(tok);                               // 1:41:15 11 塞到上面 → 5 11 16
      say('11 擠進上一層：5 11 16', '上面還有空房間，住得下');
      await step(tok);                               // 1:41:25 7 在 5、11 之間；13 14 在 11、16 之間
      for (const k of [7, 13, 14]) glow(tv.c(k), GOLD);
      say('7：比 11 小、比 5 大', '13 14：在 11 和 16 中間');
    },
  });
  await step(tok);                                   // 1:41:52 一次插入 = 一次分家
  for (const k of [7, 13, 14]) glow(tv.c(k), null);
  say('插到 4-node：一次插入 = 一次分家', '分家後往上 insert，上面沒滿就住下');
}]);

// ═════════ 16. 連續分家：insert 23（10 steps）═════════
FRAG.push(['avllin-234-cascade-23', '連續分家：18 20 21 插入 23，樹高才 +1', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  tv.root = N4([5, 11, 16], [N4([3]), N4([7]), N4([13, 14]), N4([18, 20, 21])]); tv.sync();
  await step(tok);                                   // 1:42:21 假設 18 20 21 都在這邊
  for (const k of [18, 20, 21]) glow(tv.c(k), GOLD);
  say('假設 18 20 21 都在同一個 node', '現在要 insert 23');
  await step(tok);                                   // 1:42:35 23 插進去：滿了
  for (const k of [18, 20, 21]) glow(tv.c(k), null);
  const p = await walk4(tok, tv, 23); remove(p);
  await ins4(tv, 23, {
    placed: async () => { say('23 放進去', NO('滿了')); },
    over: async (n, mid, lvl) => {
      if (lvl === 0) {
        await step(tok);                             // 1:42:47 中間抓起來：20 上去取暖
        say('中間抓一個上去：20（或 21）', '20 上去取暖；18 一家、21 23 一家');
      } else {
        await step(tok);                             // 1:43:07 5 11 16 20 也滿了
        say('上面變成 5 11 16 20', NO('也滿了！'));
        await step(tok);                             // 1:43:17 11 被抓上去，分左右兩邊
        say('再分家：抓 11（也可以抓 16）上去', '左邊一家、右邊一家');
      }
    },
    split: async (mid, par, lvl) => {
      if (lvl === 1) {
        await step(tok);                             // 1:43:26 高度才真正多一層
        say('11 變成新的 root', OK('這時高度才真正多一層'));
      }
    },
  });
  await step(tok);                                   // 1:43:37 整條路每一代都滿才長高
  say('整條路上每一代都塞滿了', '才會往上長出新的一層');
  await step(tok);                                   // 1:43:52 所有 leaf 依然同一層
  tv.leaves().forEach((n) => tv.glowN(n, GREEN));
  say('所有 leaf 依然在同一層', '這個性質一直被維持住');
  await step(tok);                                   // 1:44:03 有空房間就直接住
  tv.leaves().forEach((n) => tv.glowN(n, null));
  say('過程中只要有空房間', '就直接進去住');
  await step(tok);                                   // 1:44:28 只有兩件事
  note('① 空的 → 進去住　② 滿的 → 分家，往上 insert', 0, 7.0, 0);
  say('insertion 只有兩件事', '空的進去住；滿的分家，再往上 insert');
}]);

// ═════════ Q&A：為什麼從 2 開始、抓哪個、7 跟 13 14 要合起來嗎（9 steps）═════════
FRAG.push(['avllin-234-qa', 'Q&A：為什麼是 2-3-4、中間選哪個、分家後要合起來嗎', async (tok) => {
  fresh([0, 4.6, 13], [0, 3.2, 0]);
  const tl = T4({ cx: -4.2, top: 5.0, dy: 1.9 });
  const tr = T4({ cx: 2.4, top: 5.6, dy: 1.9 });
  const q = asker(-6.3, 2.4);
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 1:55:55 為什麼不能 3-4-5
  tmp.push(bubble('3-4-5 不行嗎？', -5.4, 1.6, 2.4));
  say('問：為什麼是 2-3-4？', '3-4-5 不行嗎？');
  await step(tok);                                   // 1:56:05 要能 cover 只有一筆資料
  clr(); tl.root = N4([1]); tl.sync(1);
  tmp.push(note('只有 1 筆資料 → 需要 2-node', -4.2, 6.4, 0));
  say('一定要從 2 開始', '要能 cover 只有一筆資料的 node');
  await step(tok);                                   // 1:56:16 2-3、2-3-4、2-3-4-5；2 = binary tree
  clr();
  say('可以是 2-3、2-3-4、2-3-4-5……', '只有 2 的話，就是 binary tree');
  await step(tok);                                   // 1:56:40 中間選兩個會影響嗎
  tr.root = N4([7, 11, 13, 14]); tr.sync([7, 11, 13, 14]);
  glow(tr.c(11), GOLD); glow(tr.c(13), GOLD);
  say('問：中間有兩個選擇', '選哪一個會影響之後嗎？');
  await step(tok);                                   // 1:57:03 不知道未來的話兩個一樣好
  say('不知道未來會 insert／remove 什麼', '兩個一樣好，通常隨便拿一個');
  await step(tok);                                   // 1:57:25 7 跟 13 14 要合起來嗎
  glow(tr.c(11), null); glow(tr.c(13), null);
  tr.root = N4([11], [N4([7]), N4([13, 14])]); tr.sync();
  say('問：分家後 7 跟 13 14 要合起來嗎？', NO('不用'));
  await step(tok);                                   // 1:57:43 它們是 11 兩邊的小孩
  for (const k of [7, 13, 14]) glow(tr.c(k), GOLD);
  say('它們各自是 11 兩邊的小孩', '每筆資料兩邊都有小孩，跟 BST 一樣');
  await step(tok);                                   // 1:58:05 一家變兩家，11 當聯絡人
  for (const k of [7, 13, 14]) glow(tr.c(k), null);
  tmp.push(bubble('我是兩家的聯絡人', 2.4, 6.6));
  say('一房變兩房', '11 升到上面當家族聯絡人');
  await step(tok);                                   // 1:58:35 11 再往上也不用合
  clr(); tl.clear(); tr.clear(); tr.cx = 0;
  tr.root = N4([11], [N4([5], [N4([3]), N4([7])]), N4([16, 20], [N4([13, 14]), N4([18]), N4([21, 23])])]); tr.sync();
  for (const k of [7, 13, 14]) glow(tr.c(k), GOLD);
  q.mood('happy');
  say('11 再往上移也不用合', '7 仍是 5 的右小孩，13 14 仍是 16 的左小孩');
}]);

// ═════════ 17. 依序插入 1 … 10（19 steps）═════════
FRAG.push(['avllin-234-seq-1to10', '2-3-4 樹依序插入 1 … 10：從基層做起', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  const full = (k) => async () => { say(k + ' 進來', NO('房間滿了')); };
  await step(tok);                                   // 1:59:49 先把 1 放進去
  tv.root = N4([1]); tv.sync(1);
  say('依序插入 1、2、3……會怎樣？', '先放 1');
  await step(tok);                                   // 1:59:55 兩隻腳（蟑螂腳）
  tmp.push(bubble('我的兩隻蟑螂腳要同高', 0, 6.7));
  say('1 是唯一的 node：畫出它的兩隻腳', '之後所有蟑螂腳都要在同一個高度');
  await step(tok);                                   // 2:00:27 2 進來
  clr(); await ins4(tv, 2);
  say('2 進來：還有空間，直接住', '只是多一隻蟑螂腳');
  await step(tok);                                   // 2:00:35 3 進來
  await ins4(tv, 3);
  say('3 進來：也還有空間', '');
  await step(tok);                                   // 2:00:45 4 進來：滿了
  await ins4(tv, 4, { placed: full(4), over: async () => {
    await step(tok);                                 // 2:00:53 把 2 趕上去
    say('分家：把 2 趕上去', '2 的左小孩 1、右小孩 3 4');
  } });
  await step(tok);                                   // 2:01:18 5
  await ins4(tv, 5);
  say('5：還有空房間', '蟑螂腳還在同一層');
  await step(tok);                                   // 2:01:38 6：滿了
  await ins4(tv, 6, { placed: full(6), over: async () => {
    await step(tok);                                 // 2:01:45 選 4 上去
    say('選 4 上去（也可以選 5）', '2 4 中間是 3，4 的右邊是 5 6');
  } });
  await step(tok);                                   // 2:02:24 7
  await ins4(tv, 7);
  say('7：多一個房間而已', '');
  await step(tok);                                   // 2:02:31 8：滿了
  await ins4(tv, 8, { placed: full(8), over: async () => {
    await step(tok);                                 // 2:02:42 6 上去，上面還有房間
    say('6 上去：上面還有房間', '4 6 中間是 5，6 的右邊是 7 8');
  } });
  await step(tok);                                   // 2:03:09 9、10 進來
  await ins4(tv, 9);
  say('9 進來：沒問題', '');
  await beat(tok, 900);
  await ins4(tv, 10, {
    placed: async () => { say('10 進來', NO('又滿了：overflow')); },
    over: async (n, mid, lvl) => {
      if (lvl === 0) {
        await step(tok);                             // 2:03:18 找 8 上去
        say('找 8 上去', '6 8 中間是 7，8 的右邊是 9 10');
      } else {
        await step(tok);                             // 2:03:34 2 4 6 8 也滿了
        say('8 上去後：2 4 6 8 也滿了', NO('再分家'));
        await step(tok);                             // 2:03:44 再選 4 往上
        say('選 4 往上', '4 的左邊 2，右邊 6 8；樹這時才長高');
      }
    },
  });
  await step(tok);                                   // 2:04:10 大部分地方還有空房間
  tv.leaves().forEach((n) => { if (n.ks.length < 3) tv.glowN(n, GREEN); });
  say('大部分的地方都還有空房間', '就算是很極端的依序插入');
  await step(tok);                                   // 2:04:27 像公司的階層化管理
  tv.leaves().forEach((n) => tv.glowN(n, null));
  const boss = buddy('大組長', '4', '#e8cf8a', 6.0, 0, 2.2, 0.6); boss.mood('happy');
  tmp.push(note('組員 → 小組長 → 大組長', 0, 7.0, 0));
  say('像公司的階層化管理', '人多了才分出小組長、大組長');
  await step(tok);                                   // 2:05:08 從基層做起
  await boss.hop(tok);
  say('從基層做起的演算法', '每個人都從 leaf 開始，滿了才往上長');
}]);

// ═════════ 18. 蟑螂腳：真正的定義（8 steps）═════════
FRAG.push(['avllin-234-legs', '嚴格定義：蟑螂腳（空的位置）要同高', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const tv = T4({ top: 5.6, dy: 1.9 });
  const n3 = N4([3]);
  tv.root = N4([4], [N4([2], [N4([1]), n3]), N4([6, 8], [N4([5]), N4([7]), N4([9, 10])])]); tv.sync();
  const two = tv.root.ch[0];
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 2:06:08 一路往上長，不會變 linked list
  say('一路從底下往上長', '所以不會長成歪斜的 linked list');
  await step(tok);                                   // 2:06:16 蟑螂腳管住高度與資料量
  tmp.push(note('蟑螂腳：管住「樹高 ↔ 資料量」', 0, 7.0, 0));
  say('蟑螂腳管的是：樹高和資料量的關係', '它的用途就是確認高度');
  await step(tok);                                   // 2:06:41 嚴格定義：蟑螂腳同高
  clr();
  say('嚴格的定義：', '所有蟑螂腳在同一個高度');
  await step(tok);                                   // 2:07:10 把 3 這個 node 拿掉呢
  two.ch = [two.ch[0]]; tv.sync();
  say('如果把 3 這個 node 拿掉呢？', '還是合法的 2-3-4 樹嗎？');
  await step(tok);                                   // 2:07:19 剩下的 leaf 都在高度 3
  for (const k of [1, 5, 7, 9, 10]) glow(tv.c(k), GREEN);
  say('剩下的 leaf：1、5、7、9 10', '都還在高度 3');
  await step(tok);                                   // 2:07:33 有一隻蟑螂腳不合群
  for (const k of [1, 5, 7, 9, 10]) glow(tv.c(k), null);
  const x = two._L + 0.82, y = two._py;
  tmp.push(line(x, y - 0.4, x + 0.3, y - 0.95, 0, '#d64545'), cube('', '#d64545', [0.18, 0.18, 0.18], x + 0.3, y - 0.98, 0));
  tmp.push(bad('這隻腳在第 2 層', x + 0.6, y - 1.5));
  say('但 2 的右邊這隻蟑螂腳不合群', NO('它在高度 2'));
  await step(tok);                                   // 2:08:20 不能有空的 leaf
  clr(); two.ch.push(n3); tv.sync();
  say('不能有空的 leaf', '真正的定義：腳同高（leaf 同高是好懂的說法）');
  await step(tok);                                   // 2:08:58 往根部長的樹
  const up = pkt('往上長 ↑', 4.6, 2.0);
  await travel(tok, up, V3(4.6, 2.0, 0.5), V3(4.6, 6.4, 0.5), 1200);
  say('它是往根部長的樹', '從基層做起，從底層往上長');
}]);

// ═════════ 19a. 為什麼要紅黑樹：2-3-4 樹難寫（6 steps）═════════
FRAG.push(['avllin-rb-why', '2-3-4 樹難寫 → 想要好寫的 binary tree', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const box = ghostBox('#a99470', 2.62, 0.92, 1.0); box.position.set(-3.6, 5.0, 0);
  [7, 11, 14].forEach((k, i) => cube(k, '#4b9ee2', [0.77, 0.7, 0.8], -3.6 + (i - 1) * 0.85, 5.0, 0, 2.5));
  tag('2-3-4 node', 'ptr', -3.6, 6.0, 0);
  const st = buddy('同學', '', '#f4c27a', -6.2, 0, 2.2, 0.65); st.mood('sad');
  await step(tok);                                   // 2:09:38 程式很複雜很痛苦
  bubble('寫起來好痛苦…', -5.4, 1.6, 2.2);
  say('2-3-4 樹的程式很複雜、很痛苦', '所以沒有出成作業');
  await step(tok);                                   // 2:09:54 想要簡單的操作方式
  say('真正想寫的：一個簡單的操作方式', '而且它能幫助了解紅黑樹');
  await step(tok);                                   // 2:10:57 2-3-4 樹和紅黑樹的關係
  tag('2-3-4 樹 ⇄ 紅黑樹', 'ptr alt', 0, 6.8, 0);
  say('2-3-4 樹和紅黑樹是什麼關係？', '');
  await step(tok);                                   // 2:11:11 binary tree 好寫
  const bn = buddy('binary node', 'k', '#7cb8ee', 3.6, 3.6, 0, 0.8); bn.mood('happy');
  const nl = note('左', 2.6, 2.6, 0.6), nr = note('右', 4.6, 2.6, 0.6);
  line(3.3, 3.6, 2.6, 2.9, 0); line(3.9, 3.6, 4.6, 2.9, 0);
  say('想要 binary tree：超好寫', '一個 node 只要管兩張小紙條（左、右）');
  await step(tok);                                   // 2:11:22 三個排序好的 element，if-then-else 半天
  const cd = code(['if (k < a) …', 'else if (k < b) …', 'else if (k < c) …', 'else …'], -3.6, 3.8, 0.55, 0.4);
  for (let i = 0; i < 4; i++) { cd.hl(i); await beat(tok, 380); }
  say('2-3-4 的 node：三個排好序的 element', '每次都要 if-then-else 半天，很容易寫錯');
  await step(tok);                                   // 2:11:52 每一種 node 對應到 BST
  cd.hl(-1);
  arrow(V3(-1.9, 5.0, 0), V3(2.4, 4.2, 0));
  st.mood('happy');
  say('辦法：把 2-3-4 樹的每一種 node', '都對應到 BST 裡的一小塊');
}]);

// ═════════ 19b. 2-3-4 node ↔ 紅黑樹（11 steps）═════════
FRAG.push(['avllin-rb-mapping', '2-3-4 node 換成 binary node：黑 = 代表，紅 = 跟班', async (tok) => {
  fresh([0, 4.4, 13], [0, 3.0, 0]);
  const box = (cx, y, ks) => {
    const w = ks.length * 0.8; const g = ghostBox('#a99470', w + 0.16, 0.86, 1.0); g.position.set(cx, y, 0);
    ks.forEach((k, i) => cube(k, '#4b9ee2', [0.72, 0.66, 0.8], cx - w / 2 + 0.8 * (i + 0.5), y, 0));
  };
  const rb = (k, c, x, y) => cube(k, c === 'R' ? RBR : c === 'B' ? RBB : RBN, [0.7, 0.7, 0.7], x, y, 0, 2.5);
  let tmp = [];
  await step(tok);                                   // 2:12:25 2-node → BST 的一個 node
  box(-4.4, 5.4, ['a']); arrow(V3(-3.6, 5.4, 0), V3(-2.4, 5.4, 0));
  const a2 = rb('a', 'N', -1.2, 5.4);
  say('2-node → 換成 BST 的一個 node', '');
  await step(tok);                                   // 2:12:46 塗成黑色：代表一個 2-3-4 node
  tint(a2, RBB);
  say('把它塗成黑色', '黑色 = 代表一個 2-3-4 node');
  await step(tok);                                   // 2:13:11 像 final project 的組長
  const cap = buddy('組長', '★', '#5b5b66', 5.8, 0, 2.0, 0.65); cap.mood('happy');
  tmp.push(bubble('一組只能有一個代表', 5.0, 1.6, 2.0));
  say('像 final project：1～3 人一組', '但只能有一個登記的代表（組長）');
  await step(tok);                                   // 2:13:30 2-node 一個人住
  tmp.forEach(kill); tmp = [];
  say('2-node 只有一個人住', '自己就是代表 → 黑色');
  await step(tok);                                   // 2:13:44 3-node 兩人住，等一下再說
  say('3-node 兩人住：誰當代表？', '等一下再說，先看三個人住的');
  await step(tok);                                   // 2:14:02 三人住：中間的抓在上面
  box(-4.4, 3.6, ['a', 'b', 'c']); arrow(V3(-3.0, 3.6, 0), V3(-2.4, 3.6, 0));
  const b4 = rb('b', 'N', -1.0, 3.9), a4 = rb('a', 'N', -1.8, 2.9), c4 = rb('c', 'N', -0.2, 2.9);
  line(-1.0, 3.9, -1.8, 2.9, 0); line(-1.0, 3.9, -0.2, 2.9, 0);
  say('4-node 三人住：BST 越平衡越好', '中間的 b 抓到上面');
  await step(tok);                                   // 2:14:41 不是代表的漆成紅色
  tint(b4, RBB); tint(a4, RBR); tint(c4, RBR);
  say('中間的 b 當代表（黑）', '不是代表的，就漆成討厭的紅色');
  await step(tok);                                   // 2:15:09 3-node：小的當代表
  box(-4.4, 1.4, ['a', 'b']); arrow(V3(-3.4, 1.4, 0), V3(-2.4, 1.4, 0));
  rb('a', 'B', -1.4, 1.7); rb('b', 'R', -0.6, 0.7); line(-1.4, 1.7, -0.6, 0.7, 0);
  say('3-node：小的當代表', '大的當紅色跟班，在右下');
  await step(tok);                                   // 2:15:45 也可以大的當代表
  tag('或', 'idx', 0.9, 1.3, 0);
  rb('b', 'B', 3.0, 1.7); rb('a', 'R', 2.2, 0.7); line(3.0, 1.7, 2.2, 0.7, 0);
  say('也可以大的當代表', '小的紅色跟班在左下：兩種都行');
  await step(tok);                                   // 2:16:20 這樣的 BST 就叫紅黑樹
  tag('紅黑樹', 'ptr alt', 2.2, 5.4, 0);
  say('整棵 2-3-4 樹都這樣換', '得到的 BST 就叫紅黑樹');
  await step(tok);                                   // 2:16:29 黑 + 相鄰的紅 = 一個 2-3-4 node
  const fam = ghostBox('#e0b84a', 2.4, 2.0, 1.2); fam.position.set(-1.0, 3.4, 0);
  say('黑色 + 相鄰的紅色', '= 2-3-4 樹裡的一個 node');
}]);

// ═════════ 20. 例子：2 5 / 1 | 3 4 | 6 7 8 → 紅黑樹（10 steps）═════════
FRAG.push(['avllin-rb-example', '2-3-4 樹 2 5 / 1｜3 4｜6 7 8 換成紅黑樹', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.2, 0]);
  const t4 = T4({ cx: -3.6, top: 5.6, dy: 1.6, kw: 0.68, gap: 0.42 });
  const t = { root: null }; const tv = TV(t, { rb: true, cx: 3.0, dx: 0.74, dy: 1.25, top: 5.6, sz: 0.62 });
  await step(tok);                                   // 2:17:11 2-node、3-node、4-node 都有
  tag('2-3-4 樹', 'ptr', -3.6, 6.6, 0);
  say('畫一棵 2-node、3-node、4-node 都有的樹', '');
  await step(tok);                                   // 2:17:36 填數字
  t4.root = N4([2, 5], [N4([1]), N4([3, 4]), N4([6, 7, 8])]); t4.sync([2, 5, 1, 3, 4, 6, 7, 8]);
  say('填上數字：root 2 5', '小孩 1 ｜ 3 4 ｜ 6 7 8');
  await step(tok);                                   // 2:17:48 對應到好幾棵紅黑樹
  tag('紅黑樹', 'ptr', 3.0, 6.6, 0);
  say('它可以對應到好幾棵紅黑樹', '2-node、4-node 換法固定；3-node 有兩種');
  const steps = [
    [[[2, 'B'], [5, 'R']], [2, 5], '2 5：小的 2 放上面當代表（黑）', '5 在下面當紅色跟班'],
    [[[7, 'B'], [6, 'R'], [8, 'R']], [6, 7, 8], '5 的右小孩：6 7 8', '7 當代表，6、8 是紅色小跟班'],
    [[[4, 'B'], [3, 'R']], [3, 4], '2、5 中間的 3 4 → 5 的左邊', '這次讓 4 當代表，3 是紅色'],
    [[[1, 'B']], [1], '2 的左小孩：1 自己住', '自己當代表（黑）'],
  ];
  let prev = null;
  for (const [ins, keys, a, b] of steps) {
    await step(tok);                                 // 2:18:16 / 2:18:43 / 2:19:07 / 2:19:27
    if (prev) { t4.glowN(t4.node(prev[0]), null); prev.forEach((k) => glow(tv.c(k), null)); }
    ins.forEach(([k, c]) => bstIns(t, k, c)); tv.sync(keys);
    t4.glowN(t4.node(keys[0]), GOLD); keys.forEach((k) => glow(tv.c(k), GOLD));
    say(a, b); prev = keys;
  }
  await step(tok);                                   // 2:19:47 反過來：黑色 + 附近的紅色集合
  t4.glowN(t4.node(prev[0]), null); prev.forEach((k) => glow(tv.c(k), null));
  const fam = [[2, 5], [1], [3, 4], [6, 7, 8]], cols = ['#4b9ee2', '#2fc092', '#dd8238', '#9b7ef4'];
  fam.forEach((ks, i) => {
    const ps = ks.map((k) => tv.P.get(k)); const x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x));
    const y0 = Math.min(...ps.map((p) => p.y)), y1 = Math.max(...ps.map((p) => p.y));
    const g = ghostBox(cols[i], x1 - x0 + 0.9, y1 - y0 + 0.9, 1.1); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  });
  say('反過來猜：找出所有黑色', '把黑色和附近的紅色集合起來 = 原本的 node');
  await step(tok);                                   // 2:20:19 一條線、兩條線、三條線
  note('2-3-4 的連線結構，紅黑樹裡也都有', 0, 0.5, 1.2);
  say('2-3-4 樹裡一條線、兩條線、三條線的結構', '在紅黑樹裡也都有');
  await step(tok);                                   // 2:20:50 用 insertion 示範
  say('接下來用 insertion 示範', '2-3-4 樹插入時，紅黑樹會發生什麼？');
}]);

// ═════════ 21. 紅黑樹插入：1.5、4.5、1.8（11 steps）═════════
FRAG.push(['avllin-rb-insert-easy', '紅黑樹插入：1.5、4.5 標紅就好，1.8 紅接紅', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 0.88, dy: 1.25, top: 5.8, sz: 0.72 }); tv.sync();
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 2:21:44 2-3-4 樹：1.5 放在 1 跟 2 中間
  tmp.push(note('2-3-4：1.5 住進 1 那間房 → 1 1.5', -3.6, 7.0, 0));
  say('例子一：insert 1.5', '在 2-3-4 樹裡，1.5 放進 1 的那間房');
  await step(tok);                                   // 2:21:54 紅黑樹：1 這邊長出 1.5
  await walkIns(tok, tv, t, 1.5, 'N');
  say('紅黑樹：2 的左邊 → 1 的右邊', '長出 1.5——它該塗什麼顏色？');
  await step(tok);                                   // 2:22:13 1 已經是代表 → 1.5 紅
  findN(t, 1.5).c = 'R'; tv.sync();
  say('1 這一家已經有 1 當代表', '所以 1.5 是紅色跟班');
  await step(tok);                                   // 2:22:46 對應空房間 → 標紅就好
  clr();
  say('對應 2-3-4 樹的空房間', OK('塞進去、標紅色，什麼都不用做'));
  await step(tok);                                   // 2:23:09 insert 4.5
  await walkIns(tok, tv, t, 4.5, 'N');
  say('insert 4.5：2 右 → 5 左 → 4 右', '');
  await step(tok);                                   // 2:23:42 4 是家長，3 是小跟班 → 4.5 紅
  findN(t, 4.5).c = 'R'; tv.sync();
  say('4 是家長、3 是小跟班', '4.5 也當跟班 → 紅色，一點也不難');
  await step(tok);                                   // 2:24:28 insert 1.8
  await walkIns(tok, tv, t, 1.8, 'R');
  say('insert 1.8：比 2 小、比 1 大、比 1.5 大', '照規則塞進去、標紅');
  await step(tok);                                   // 2:24:59 1、1.5、1.8 看起來怪怪的
  glow(tv.c(1.5), RED); glow(tv.c(1.8), RED);
  say('1、1.5、1.8 歪成一串', '看起來怪怪的');
  await step(tok);                                   // 2:25:15 應該是 1.5 在上
  tmp.push(bubble('應該 1.5 在上，1、1.8 在兩邊', -3.4, 2.0));
  say('這間房子不該長這樣', '應該 1.5 在上、1 和 1.8 在兩邊');
  await step(tok);                                   // 2:25:33 就是 AVL 的 RR
  tmp.push(tag('= AVL 的 RR', 'ptr alt', -3.4, 1.2, 0));
  say('這就是 AVL 出問題的 RR 情形', '');
  await step(tok);                                   // 2:26:01 1.8 的爸爸應該是黑色代表
  clr();
  tmp.push(bad('紅接紅 ✗', tv.P.get(1.8).x + 0.4, tv.P.get(1.8).y - 0.9));
  say('1.8 的爸爸應該是黑色的代表', NO('接在紅色後面就不對'));
}]);

// ═════════ 22. 新生先為紅，紅父不能容（10 steps）═════════
FRAG.push(['avllin-rb-two-problems', '新生先為紅、紅父不能容：插 9 進 6 7 8', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 1.0, dy: 1.3, top: 5.6, sz: 0.75 }); tv.sync();
  const baby = buddy('新 node', '', '#e98b8b', -6.0, 0, 2.2, 0.65);
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  await step(tok);                                   // 2:26:35 新生先為紅
  tag('① 新生先為紅', 'ptr alt', -4.6, 6.6, 0); baby.mood('happy');
  say('第一句詩：新生先為紅', '新插入的 node，先塗成紅色');
  await step(tok);                                   // 2:26:49 紅父不能容
  tag('② 紅父不能容', 'ptr alt', -4.6, 5.9, 0);
  say('第二句：紅父不能容', '如果爸爸是紅色，就有問題');
  await step(tok);                                   // 2:27:10 小弟頭上要有大哥
  tmp.push(bubble('小弟頭上要有大哥', -5.2, 1.6, 2.2));
  say('紅色是小弟', '小弟頭上要有大哥：這家的黑色代表');
  await step(tok);                                   // 2:27:36 6 7 8 塞 9
  clr(); for (const k of [6, 7, 8]) glow(tv.c(k), GOLD);
  say('另一個情形：6 7 8 這家', '如果再塞個 9 進去？');
  await step(tok);                                   // 2:27:53 2-3-4：要分家，7 拱上去
  tmp.push(note('2-3-4：要分家，把 7 拱上去', 3.4, 6.8, 0));
  say('對應 2-3-4 樹：要分家', '把 7 拱上去');
  await step(tok);                                   // 2:28:00 9 一開始標紅
  for (const k of [6, 7, 8]) glow(tv.c(k), null);
  await walkIns(tok, tv, t, 9, 'R');
  say('紅黑樹裡：9 塞在 8 的右邊', '一開始標成紅色');
  await step(tok);                                   // 2:28:09 紅色有紅色的爸爸
  glow(tv.c(8), RED); glow(tv.c(9), RED); baby.mood('sad');
  say('9 的爸爸 8 也是紅色', NO('紅父不能容'));
  await step(tok);                                   // 2:28:28 爸爸是黑色 → 沒問題
  clr(); glow(tv.c(8), null); glow(tv.c(9), null);
  say('插入後檢查：爸爸是黑色嗎？', OK('是黑色 → 有空房間，沒問題'));
  await step(tok);                                   // 2:28:46 爸爸不是黑：這家歪掉或滿了
  tmp.push(note('紅父的原因：這家歪掉（1.8）／這家滿了（9）', 0, 0.5, 1.4));
  say('爸爸是紅色，有兩種原因', '這家沒拿中間當頭（1.8），或已經滿了（9）');
  await step(tok);                                   // 2:29:26 1. 標紅 2. 檢查爸爸
  baby.mood('calm');
  say('insertion：1. 新 node 標紅', '2. 檢查爸爸是不是黑色，不是就要調整');
}]);

// ═════════ 23. 黑叔逼爺退：rotation（11 steps）═════════
FRAG.push(['avllin-rb-black-uncle', '黑叔逼爺退：3-node 歪掉 → 旋轉＋變色', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.2, 0]);
  const t1 = rbTree([[1, 'B'], [1.5, 'R'], [1.8, 'R']]);
  const vl = TV(t1, { rb: true, cx: -3.4, dx: 1.2, dy: 1.4, top: 5.6, sz: 0.75 });
  const t2 = rbTree([[7, 'B'], [6, 'R'], [8, 'R'], [9, 'R']]);
  const vr = TV(t2, { rb: true, cx: 3.4, dx: 1.2, dy: 1.4, top: 5.6, sz: 0.75 });
  let tmp = [], nil, nilE, nilL;
  const clr = () => { tmp.forEach(kill); tmp = []; };
  const placeNil = () => {
    const p = vl.P.get(1), nx = p.x - 0.8, ny = p.y - 1.1;
    if (!nil) { nil = cube('', RBB, [0.3, 0.3, 0.3], nx, ny, 0); nilL = tag('nil', 'idx', nx - 0.5, ny, 0); }
    else { move(nil, nx, ny, 0); nilL.position.set(nx - 0.5, ny, 0); }
    if (nilE) kill(nilE); nilE = line(p.x, p.y, nx, ny, 0);
  };
  await step(tok);                                   // 2:33:58 情形 1：3-node 不正確那邊又塞一個
  vl.sync([1, 1.5, 1.8]); placeNil();
  tag('情形 1', 'ptr', -3.4, 6.7, 0);
  say('情形 1：原本是 3-node（1 1.5）', '在不正確的那一邊又塞了一個（1.8）');
  await step(tok);                                   // 2:34:05 情形 2：4-node 又塞一個
  vr.sync([6, 7, 8, 9]);
  tag('情形 2', 'ptr', 3.4, 6.7, 0);
  say('情形 2：原本是 4-node（6 7 8），又塞 9', '這是原本就要分家的情形');
  await step(tok);                                   // 2:34:31 情形 1 只是弄錯了
  say('情形 1 只是弄錯了：沒拿中間當頭', '只要一點點 restructure');
  await step(tok);                                   // 2:34:45 怎麼區分？
  tmp.push(bubble('叔叔？', vl.P.get(1).x - 1.4, vl.P.get(1).y - 0.4), bubble('叔叔？', vr.P.get(6).x - 0.2, vr.P.get(6).y + 0.9));
  say('這兩種情形怎麼分辨？', '看「叔叔」：爸爸的兄弟');
  await step(tok);                                   // 2:35:36 3-node 接黑色代表（或 nil）；4-node 接紅色
  clr(); glow(nil, GOLD); glow(vr.c(6), GOLD);
  tmp.push(bubble('黑叔（另一家／nil）', vl.P.get(1).x - 1.2, vl.P.get(1).y - 0.3), bubble('紅叔（還是同一家）', vr.P.get(6).x, vr.P.get(6).y + 0.9));
  say('3-node 旁邊接的是另一家的黑色代表或 nil', '4-node 旁邊接紅色：還是同一家');
  await step(tok);                                   // 2:36:13 像 AVL：rotate(A, B)
  clr(); glow(nil, null); glow(vr.c(6), null);
  rotUp(t1, findN(t1, 1), 'L'); vl.sync(); placeNil();
  say('情形 1 就像 AVL：rotate(A, B)', 'A = 1、B = 1.5，轉一轉就解決');
  await step(tok);                                   // 2:36:36 B 漆黑、A 漆紅、C 維持紅
  findN(t1, 1.5).c = 'B'; findN(t1, 1).c = 'R'; vl.sync();
  say('B（1.5）漆成黑、A（1）漆成紅', 'C（1.8）維持紅色 → 一個好好的 4-node');
  await step(tok);                                   // 2:36:55 其他 link 都沒變
  say('其他 link 都沒有變', '跟 AVL 的 rotation 一樣');
  await step(tok);                                   // 2:37:05 標紅 → 爸爸紅 → 看叔叔
  tmp.push(tag('C 標紅 → 爸爸紅？ → 看叔叔：黑 → rotation', 'pkt', 0, 0.6, 1.2));
  say('流程：放進 C 標紅 → 爸爸是紅 → 看叔叔', '叔叔是黑色 → 走 rotation');
  await step(tok);                                   // 2:37:32 把蟑螂腳當成黑色的空 node
  clr(); glow(nil, GOLD); txt(nilL, 'nil = 黑色的空 node');
  say('實作技巧：把蟑螂腳（nil）當成黑色空 node', 'if 只要問「叔叔是不是黑色」');
  await step(tok);                                   // 2:38:48 黑叔逼爺退
  glow(nil, null);
  tag('③ 黑叔逼爺退', 'ptr alt', -3.4, 1.0, 0);
  bubble('我退位…', vl.P.get(1).x - 0.2, vl.P.get(1).y - 1.0);
  say('第三句詩：黑叔逼爺退', '黑色叔叔 → 爺爺被轉下來');
}]);

// ═════════ 24. 紅叔：變色往上傳（10 steps）═════════
FRAG.push(['avllin-rb-red-uncle', '紅叔叔 = 滿房分家：插入 9，變色一路往上', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const t = rbTree(RB_EX); const tv = TV(t, { rb: true, dx: 1.0, dy: 1.3, top: 5.6, sz: 0.75 });
  bstIns(t, 9, 'R'); tv.sync();
  glow(tv.c(8), RED); glow(tv.c(9), RED);
  let tmp = [];
  const clr = () => { tmp.forEach(kill); tmp = []; };
  const fam = (ks, col) => { const ps = ks.map((k) => tv.P.get(k)); const x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x)), y0 = Math.min(...ps.map((p) => p.y)), y1 = Math.max(...ps.map((p) => p.y)); const g = ghostBox(col, x1 - x0 + 0.95, y1 - y0 + 0.95, 1.1); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); tmp.push(g); };
  await step(tok);                                   // 2:39:17 4-node 要分家
  glow(tv.c(6), GOLD);
  say('情形 2：紅叔叔 = 4-node 又塞一個', '4-node 就是要分家');
  await step(tok);                                   // 2:39:35 不改結構：兩個一邊的一家、一個的一家
  glow(tv.c(6), null); glow(tv.c(8), null); glow(tv.c(9), null);
  fam([6], '#2fc092'); fam([8, 9], '#dd8238');
  say('不改變 binary tree 的結構來分家', '6 自己一家；8 9 一家');
  await step(tok);                                   // 2:39:59 原本在上面的當頭
  glow(tv.c(8), GOLD);
  say('8 9 這家：原本在上面的 8 當頭', '6 那家只有自己，自己當頭');
  await step(tok);                                   // 2:40:22 紅爸爸、紅叔叔改黑
  glow(tv.c(8), null);
  findN(t, 6).c = 'B'; findN(t, 8).c = 'B'; tv.sync();
  say('把紅爸爸 8、紅叔叔 6 改成黑色', OK('分家完成'));
  await step(tok);                                   // 2:40:42 爺爺往上插入 → 改紅
  clr(); findN(t, 7).c = 'R'; tv.sync(); glow(tv.c(7), GOLD);
  say('爺爺 7 要往上插入，加入新的一家', '新成員一律先塗紅');
  await step(tok);                                   // 2:41:02 看爺爺上面接誰
  const pk = pkt('看上面接誰？', 0, 0);
  await travel(tok, pk, tv.at(7), tv.at(5), 800);
  say('就像剛塞進一個紅 node：看 7 的爸爸', '爸爸是黑色就停');
  await step(tok);                                   // 2:41:14 紅色 → 再選情形 1 或 2
  remove(pk); glow(tv.c(7), RED); glow(tv.c(5), RED);
  say('7 的爸爸 5 也是紅：又是紅紅問題', '叔叔 1 是黑色 → 套情形 1：旋轉');
  await beat(tok, 1200);
  glow(tv.c(7), null); glow(tv.c(5), null);
  rotUp(t, t.root, 'L'); findN(t, 5).c = 'B'; findN(t, 2).c = 'R'; tv.sync();
  await step(tok);                                   // 2:41:34 症狀：紅爸爸、紅叔叔 → 變色
  say('紅叔叔的症狀：紅爸爸、紅叔叔', '這一家都是紅的 → 要變色');
  await step(tok);                                   // 2:41:56 變色一路往上傳
  tag('④ 紅叔：變色龍，一路往上', 'ptr alt', -3.6, 6.8, 0);
  say('爸爸、叔叔、爺爺都要變色', '爺爺往上插入，可能一路傳上去');
  await step(tok);                                   // 2:42:18 四句詩
  note('新生先為紅、紅父不能容、黑叔逼爺退、紅叔變色龍', 0, 0.5, 1.4);
  say('整個 insertion 就是四句詩', '一直在維持 2-3-4 樹 ↔ 紅黑樹的對應');
}]);

// ═════════ 25. 代價：旋轉 vs 變色（11 steps）═════════
FRAG.push(['avllin-rb-cost', '紅黑樹的代價：旋轉偶爾、變色便宜', async (tok) => {
  fresh([0, 4.6, 12.5], [0, 3.2, 0]);
  const hdr = [tag('紅黑樹', 'ptr', -1.2, 6.4, 0), tag('2-3-4 樹', 'ptr', 2.8, 6.4, 0)];
  const r1 = [tag('黑叔：旋轉（restructure）', 'idx', -1.2, 5.6, 0), tag('3-node 擠一下：easy', 'idx', 2.8, 5.6, 0)];
  const r2 = [tag('紅叔：變色（recolor）', 'idx', -1.2, 4.9, 0), tag('split 分家：hard', 'idx', 2.8, 4.9, 0)];
  showL(r1[1], false); showL(r2[0], false); showL(r2[1], false);
  const hi = (l, on) => { l.element.className = 'lab-label ' + (on ? 'ptr alt' : 'idx'); };
  let t, tv;
  await step(tok);                                   // 2:43:34 情形 1 要旋轉：小紙條換來換去
  hi(r1[0], true);
  say('情形 1（黑叔）要旋轉：restructure', '幾張小紙條要換來換去');
  await step(tok);                                   // 2:43:42 情形 2：很多步但只改顏色
  hi(r1[0], false); showL(r2[0], true); hi(r2[0], true);
  say('情形 2（紅叔）可能很多步', '但只改顏色，樹的結構都沒變 → easy');
  await step(tok);                                   // 2:44:04 2-3-4 樹裡是 split：hard
  showL(r1[1], true); showL(r2[1], true); hi(r2[1], true);
  say('對應到 2-3-4 樹，情形 2 是 split 分家', '要蓋新房子、做新的小紙條 → hard');
  await step(tok);                                   // 2:44:39 改一堆 1-bit：簡單又快
  hi(r2[0], false); hi(r2[1], false);
  say('換成紅黑樹，只是改一堆 1-bit 的顏色', OK('簡單又快'));
  await step(tok);                                   // 2:44:46 有時要 restructure，但不一定
  hi(r1[0], true);
  say('付出的小代價：有時要 restructure', '但不一定會做');
  await step(tok);                                   // 2:44:53 例：3 黑、5 紅
  hi(r1[0], false);
  t = rbTree([[3, 'B'], [5, 'R']]); tv = TV(t, { rb: true, dx: 1.5, dy: 1.4, top: 3.4 }); tv.sync([3, 5]);
  say('例：3 黑、5 紅（一個 3-node）', '插入 2');
  await step(tok);                                   // 2:45:03 插 2：沒有 restructure
  await walkIns(tok, tv, t, 2, 'R');
  say('2 接在黑色的 3 下面', OK('還有空房間，不用 restructure'));
  await step(tok);                                   // 2:45:22 就算 restructure 也只一個 local rotation
  say('就算要 restructure', '也只是一個很 local 的 rotation');
  await step(tok);                                   // 2:46:21 靠爸爸的顏色就能決定
  glow(tv.c(3), GOLD);
  bubble('看我就知道', tv.P.get(3).x + 0.8, tv.P.get(3).y + 0.9);
  say('看爸爸的顏色就能當場決定', '要不要在這裡調整');
  await step(tok);                                   // 2:46:28 AVL：從插入點一路往上才發現
  glow(tv.c(3), null);
  const up = pkt('AVL：一路往上找失衡點…', -5.0, 0.8);
  await travel(tok, up, V3(-5.0, 0.8, 0.5), V3(-5.0, 4.2, 0.5), 1600);
  say('AVL 可能要從插入點往上找好幾代', '紅黑樹在插入的地方看爸爸就知道');
  await step(tok);                                   // 2:46:59 紅黑樹可能比 AVL 更有效率
  say('所以紅黑樹在很多情況下', '可能比 AVL 更有效率');
}]);

// ═════════ 26. 紅黑樹的高度也有保證（5 steps）═════════
FRAG.push(['avllin-rb-height', '紅黑樹高度 ≤ 2 倍 2-3-4 樹高度', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const t4 = T4({ cx: -3.6, top: 5.8, dy: 1.7, kw: 0.6, gap: 0.36 });
  const t = rbTree([[4, 'B'], [2, 'B'], [1, 'B'], [3, 'B'], [6, 'B'], [5, 'B'], [8, 'R'], [7, 'B'], [9, 'B'], [10, 'R']]);
  const tv = TV(t, { rb: true, cx: 3.3, dx: 0.56, dy: 1.05, top: 6.0, sz: 0.5 }); tv.sync();
  const hr = tag('紅黑樹', 'ptr', 3.3, 6.9, 0);
  const q = asker(-6.4, 2.4, 0.6);
  await step(tok);                                   // 2:50:59 紅黑樹的高度也有保證嗎
  bubble('高度也有保證嗎？', -5.6, 1.6, 2.4);
  say('問：紅黑樹的高度也是 bounded 的嗎？', '');
  await step(tok);                                   // 2:51:01 每棵紅黑樹對應一棵 2-3-4 樹
  t4.root = N4([4], [N4([2], [N4([1]), N4([3])]), N4([6, 8], [N4([5]), N4([7]), N4([9, 10])])]); t4.sync([4, 2, 1, 3, 6, 8, 5, 7, 9, 10]);
  tag('2-3-4：高 3', 'ptr', -3.6, 6.9, 0);
  say('每棵紅黑樹都對應一棵 2-3-4 樹', '2-3-4 樹的高度有保證，紅黑樹也是');
  await step(tok);                                   // 2:51:16 最多是 2 倍
  for (const k of [4, 6, 8, 9, 10]) { glow(tv.c(k), GREEN); await beat(tok, 300); }
  txt(hr, '紅黑樹：最長 5 層 ≤ 2 × 3');
  say('紅黑樹的高度最多是 2-3-4 樹的 2 倍', '最長路徑 4→6→8→9→10');
  await step(tok);                                   // 2:51:27 每個 node 最多拆成兩層
  for (const k of [4, 6, 8, 9, 10]) glow(tv.c(k), null);
  t4.glowN(t4.node(8), GOLD); for (const k of [6, 8]) glow(tv.c(k), GOLD);
  say('因為每個 2-3-4 node', '最多被拆成兩層（黑 + 紅）');
  await step(tok);                                   // 2:51:34 log n 與 2 log n 只差常數
  t4.glowN(t4.node(8), null); for (const k of [6, 8]) glow(tv.c(k), null);
  q.mood('happy'); await q.hop(tok);
  say('log n 和 2 log n 只差常數', OK('紅黑樹的高度一樣有保證'));
}]);
  }

  // ═══ bst63.js ═══
  {
// ─── 63Dp2MjLlUo：交大彭文志 Lec25 Search Structures (2/3) ───
// Optimal BST（Horowitz 的 do/if/while、do/if/return/while 例子）→ m-way / B-tree → 2-3 tree insert / delete
// Cued scenes: every `await step(tok)` waits for the sentence it shows; motion between steps is short.
// The word being searched is a little orange character (buddy) that hops from node to node.
const { V3, fresh, tag, cube, move, fly, kill, glow, txt, relabel, line, ghostBox, GOLD, GREEN, RED, GRAY, MONO, step, buddy, travel, anim, remove } = K;
const say = (a, b = '') => ctx.say(a, b);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const okT = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const B63 = '#4b9ee2', F63 = '#b9ad98', O63 = '#dd8238';

// the searcher: an orange buddy holding the word it looks for
const seeker = (v, x, y, s = 0.5, nm = '要找') => buddy(nm, v, O63, x, y, 0.45, s);
async function hop63(tok, b, x, y, ms = 600) {
  const a = b.g.position.clone();
  await anim(tok, ms, (u) => b.g.position.set(a.x + (x - a.x) * u, a.y + (y - a.y) * u + Math.sin(u * Math.PI) * 0.45, a.z));
}
const hopOver = (tok, b, m, ms = 600, dy = 0.42) => hop63(tok, b, m.position.x, m.position.y + dy, ms);
async function tour(tok, b, ms, ...ms_) { for (const m of ms_) await hopOver(tok, b, m, ms); }

// extended BST：spec = [key, left, right]，null = fail node（方塊）。依 inorder 排 x。
function ext63(spec, o) {
  const R = { nodes: {}, fails: [], flines: [], all: [] };
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
    if (px !== undefined) { const ln = line(px, py, x, y); R.all.push(ln); if (t.fail) R.flines.push(ln); }
    if (t.fail) { const m = cube('', F63, [fs, fs * 0.5, fs], x, y); m.userData.lv = t.d + 1; R.fails.push(m); R.all.push(m); return; }
    const m = cube(t.key, o.col || B63, [sz, sz * 0.75, sz], x, y); m.userData.lv = t.d + 1; R.nodes[t.key] = m; R.all.push(m);
    draw(t.L, x, y); draw(t.R, x, y);
  };
  draw(root);
  R.showFails = (on) => { R.fails.concat(R.flines).forEach((m) => { m.visible = on; }); };
  return R;
}
// cost = Σ p·level(a) + Σ q·(level(E) − 1)，P、Q 依 inorder
function cost63(spec, P, Q) {
  let ki = 0, fi = 0, c = 0;
  const w = (s, d) => { if (!s) { c += Q[fi++] * d; return; } w(s[1], d + 1); c += P[ki++] * (d + 1); w(s[2], d + 1); };
  w(spec, 0); return c;
}
const glowAll = (T, c) => T.all.forEach((m) => { if (m.material && m.material.emissive) glow(m, c); });

// Horowitz Fig 10.1：左 = for/do/while/return/if，右 = 平衡的那棵
const FIG1L = ['for', ['do', null, null], ['while', ['return', ['if', null, null], null], null]];
const FIG1R = ['for', ['do', null, null], ['return', ['if', null, null], ['while', null, null]]];

// 0:00 用什麼標準評估「最佳」
FRAG.push(['bst63-worst-compare', 'Optimal BST：用什麼標準評估', async (tok) => {
  fresh([0, 3.2, 13], [0, 2.8, 0]);
  await step(tok);                                    // 0:00 什麼叫 optimal BST
  const L = ext63(FIG1L, { x: -3.6, y: 5.4, sx: 1.05, dy: 1.4, noFail: true });
  const R = ext63(FIG1R, { x: 3.6, y: 5.4, sx: 1.15, dy: 1.7, noFail: true });
  tag('tree 1', 'idx', -3.6, 6.4); tag('tree 2', 'idx', 3.6, 6.4);
  bub('哪一棵才叫「最佳」？', 0, 7.4);
  say('optimal BST：先講清楚用什麼標準說它「最佳」', '同樣 5 個字，可以排成不同的 BST');
  await step(tok);                                    // 1:13 cost = 從 root 開始比較幾次
  const s = seeker('?', -6.2, 4.6);
  say('最簡單的 cost：從 root 開始搜尋', '找到那個 node 要比較幾次（comparison）');
  await step(tok);                                    // 1:45 反映在 level 上
  for (const m of Object.values(L.nodes)) tag('L' + m.userData.lv, 'idx', m.position.x + 0.62, m.position.y + 0.3);
  say('比較次數 = 那個 node 的 level', 'root 是 level 1，往下一層 +1');
  await step(tok);                                    // 2:14 最笨的：看最壞情況
  bub('標準一：最壞情況要比幾次？', 0, 7.4);
  say('一種最簡單的標準：worst case', '最壞的情況下要比較幾次');
  await step(tok);                                    // 2:32 左樹找 if：4 次
  s.set('if');
  await tour(tok, s, 520, L.nodes.for, L.nodes.while, L.nodes.return, L.nodes.if);
  glow(L.nodes.if, GREEN); s.mood('wow');
  pkt('找 if：4 次', -3.6, 0.1);
  say('tree 1 找 if：for → while → return → if', '比較 4 次');
  await step(tok);                                    // 2:55 右樹找 if：3 次
  await tour(tok, s, 600, R.nodes.for, R.nodes.return, R.nodes.if);
  glow(R.nodes.if, GREEN); s.mood('happy');
  pkt('找 if：3 次', 3.6, 0.1);
  say('tree 2 找 if：for → return → if', '只要 3 次');
  await step(tok);                                    // 3:21 worst case = 樹高
  glowAll(R, GREEN);
  okT('樹高 3：worst case 較好', 3.6, -0.6); note('樹高 4', -3.6, -0.6);
  say('用 worst case 評估：看樹的高度', 'tree 2 比較矮 → 比較好');
  await step(tok);                                    // 3:25 但 worst case 不一定常發生
  glowAll(R, null);
  note('最壞情況不見得常發生', 0, 1.4);
  say('但最壞的情況不見得常常發生', '只看它，不一定公平');
  await step(tok);                                    // 3:43 cost 跟搜尋頻率有關
  bub('標準二：考慮每個字被搜尋的頻率', 0, 7.4);
  say('更好的 cost：跟每個字被搜尋的頻率有關', '');
  await step(tok);                                    // 3:51 大部分人都在查 for
  const q = pkt('大家都在查 for！', -6.4, 7.0);
  await travel(tok, q, V3(-6.4, 7.0, 0), V3(-4.65, 6.2, 0.3), 900);
  glow(L.nodes.for, GOLD); glow(R.nodes.for, GOLD);
  say('例：大部分人都在搜尋 for', 'for 被搜尋的 probability 就很高');
  await step(tok);                                    // 4:06 每個字都有 probability
  for (const T of [L, R]) for (const m of Object.values(T.nodes)) tag('p', 'note', m.position.x - 0.6, m.position.y + 0.3);
  say('每個字都有自己被搜尋的 probability', '有了它，就能 model 整棵樹的 search cost');
  await step(tok);                                    // 4:46 只看樹高不大好
  noT('只看樹高（worst case）✗', 0, 0.6);
  s.mood('sad');
  say('用最差情況評估 BST 的 cost，不大好', '接下來把機率放進 cost');
}]);

// 4:57 internal / external path
FRAG.push(['bst63-ext-path', 'Internal / External path 與 fail node', async (tok) => {
  fresh([0, 3, 13.5], [0, 2.8, 0]);
  const T = ext63(FIG1L, { x: 0, y: 5.8, sx: 1.05, dy: 1.3, sz: 0.85, fs: 0.6 });
  T.showFails(false);
  await step(tok);                                    // 4:57 兩種 path
  bub('external path 與 internal path', 0, 7.3);
  say('推導 cost 之前：先分兩種 path', 'external path、internal path');
  await step(tok);                                    // 5:04 external：要找的字不在樹裡
  note('要找的字不在樹裡 → 走到底都找不到', 0, 0.2);
  say('external path：要找的字不在這棵樹裡', '一路找到樹的最下面都沒找到');
  await step(tok);                                    // 5:33 fail node
  T.showFails(true); T.fails.forEach((f) => glow(f, GOLD));
  say('為了 model 失敗的搜尋：加上 fail node', '方塊 = fail node（實際上不存在）');
  await step(tok);                                    // 5:39 internal：字都在樹上
  T.fails.forEach((f) => glow(f, null));
  Object.values(T.nodes).forEach((m) => glow(m, GREEN));
  say('internal path：要找的字就在樹上', '走到那個字的 node 就停');
  await step(tok);                                    // 6:10 例：找 cc
  Object.values(T.nodes).forEach((m) => glow(m, null));
  const s = seeker('cc', -6.2, 5.2);
  say('例：找 cc（寄 email 時的副本）', 'cc 不在這棵樹裡');
  await step(tok);                                    // 6:23 cc < for → 往左
  await hopOver(tok, s, T.nodes.for, 700); glow(T.nodes.for, GOLD);
  say('cc 跟 for 比：cc 比較小', '→ 往左走');
  await step(tok);                                    // 6:33 cc < do → 找不到
  await hopOver(tok, s, T.nodes.do, 700); glow(T.nodes.do, GOLD);
  say('cc 跟 do 比：還是比較小', 'do 左邊已經沒有字了 → 找不到');
  await step(tok);                                    // 6:42 落到 do 左邊的方塊
  await hopOver(tok, s, T.fails[0], 700, 0.3); glow(T.fails[0], RED); s.mood('sad');
  say('落到 do 左下方的方塊', '這就是 fail node');
  await step(tok);                                    // 7:02 path 長度 2
  pkt('external path = 2', T.fails[0].position.x + 0.4, T.fails[0].position.y - 0.7);
  say('從 root 到這個方塊走了 2 條 edge', '這條 external path 長度 = 2');
  await step(tok);                                    // 7:18 I、E
  kill(s.g); Object.values(T.nodes).forEach((m) => glow(m, null)); glow(T.fails[0], null);
  bub('I = internal path 總和　E = external path 總和', 0, 7.3);
  say('I：所有 internal path 加起來', 'E：所有 external path 加起來');
  await step(tok);                                    // 7:35 算 hop，不是 comparison
  T.all.forEach((m) => { if (m.isLine) m.material.color.set('#c08a1f'); });
  say('path 長度算的是跨過幾條 edge（hop）', '不是算 comparison 次數');
  await step(tok);                                    // 7:53 for 是 root：0
  T.all.forEach((m) => { if (m.isLine) m.material.color.set('#a99470'); });
  const lv = (k) => { const m = T.nodes[k]; glow(m, GREEN); return tag(String(m.userData.lv - 1), 'ptr', m.position.x + 0.55, m.position.y + 0.5); };
  lv('for');
  say('for 是 root：起點，不用走', 'path = 0');
  await step(tok);                                    // 8:09 do、while：1
  lv('do'); lv('while');
  say('do、while：從 for 走一條 edge', 'path = 1');
  await step(tok);                                    // 8:28 return 2、if 3 → I = 7
  lv('return'); lv('if');
  pkt('I = 0 + 1 + 1 + 2 + 3 = 7', -4.2, 0.2);
  say('return = 2、if = 3', 'I = 0 + 1 + 1 + 2 + 3 = 7');
  await step(tok);                                    // 8:41 E：root 到每個方塊
  let E = 0; const et = [];
  const eT = pkt('E = ', 3.6, 0.2);
  await anim(tok, 1800, (u) => {
    const k = Math.min(T.fails.length, Math.round(u * T.fails.length));
    while (et.length < k) { const f = T.fails[et.length], d = f.userData.lv - 1; E += d; et.push(d); glow(f, RED); tag(String(d), 'idx', f.position.x, f.position.y - 0.5); }
    txt(eT, 'E = ' + et.join(' + ') + (k === T.fails.length ? ' = ' + E : ''));
  });
  say('E：從 root 走到每個方塊，經過幾條 edge', 'E = ' + E);
  await step(tok);                                    // 9:20 skewed / complete 的 path
  note('skewed tree：I = Σ i（i = 0 … n−1）', -3.4, -0.6); note('complete tree：I = Σ ⌊log₂ i⌋', 3.4, -0.6);
  say('推導：skewed 與 complete binary tree 的 I', '補充：一定有 E = I + 2n（17 = 7 + 2×5）');
}]);

// Horowitz Fig 10.12：do < if < while 的 5 棵 BST
const TA63 = ['while', ['if', ['do', null, null], null], null];
const FIVE63 = [['a', TA63], ['b', ['if', ['do', null, null], ['while', null, null]]], ['c', ['do', null, ['if', null, ['while', null, null]]]],
  ['d', ['while', ['do', null, ['if', null, null]], null]], ['e', ['do', null, ['while', ['if', null, null], null]]]];

// 9:37 加入機率的 cost 公式
FRAG.push(['bst63-cost-terms', 'BST cost：Σ p·level + Σ q·(level − 1)', async (tok) => {
  fresh([0, 3, 12], [0, 3, 0]);
  const T = ext63(TA63, { x: 0, y: 5.8, sx: 1.3, dy: 1.35 });
  T.showFails(false);
  await step(tok);                                    // 9:37 hop 數不是真正的 cost
  note('只算 hop：沒考慮誰常被搜尋', 0, 0.2);
  say('只算經過幾個 hop，還不是真正的 cost', '因為沒考慮每個字被搜尋的機率');
  await step(tok);                                    // 10:21 a1 < a2 < … < an
  const AN = { do: 'a1', if: 'a2', while: 'a3' };
  for (const [k, a] of Object.entries(AN)) tag(a + ' = ' + k, 'idx', T.nodes[k].position.x - 1.3, T.nodes[k].position.y);
  say('樹裡的字（identifier）a1 < a2 < … < an', '依字母順序排好：do < if < while');
  await step(tok);                                    // 10:34 機率 pi
  for (const [k, a] of Object.entries(AN)) tag('p' + a.slice(1), 'note', T.nodes[k].position.x, T.nodes[k].position.y + 0.65);
  say('搜尋 ai 這個字的機率叫 pi', '例：搜尋 a1 的機率是 p1');
  await step(tok);                                    // 10:55 Σ pi × level(ai)
  for (const k of ['while', 'if', 'do']) { const m = T.nodes[k]; tag('p × ' + m.userData.lv, 'ptr', m.position.x + 1.25, m.position.y + 0.15); glow(m, GREEN); }
  bub('成功：Σ pi × level(ai)', 0, 7.4);
  say('成功搜尋的 cost：每個字的機率 × 它的 level', '全部加起來：Σ pi × level(ai)');
  await step(tok);                                    // 11:31 常被搜尋 → 放靠近 root
  const up = pkt('常被搜尋 → 往上放！', T.nodes.do.position.x + 1.6, T.nodes.do.position.y);
  await travel(tok, up, up.position.clone(), V3(T.nodes.while.position.x + 2.3, T.nodes.while.position.y + 0.6, 0), 1000);
  say('pi 越大，越希望放在靠近 root 的地方', 'level 小 → 乘出來的 cost 就小');
  await step(tok);                                    // 12:23 也可能搜尋不在樹上的字
  remove(up);
  Object.values(T.nodes).forEach((m) => glow(m, null));
  say('但不一定每次都搜尋樹上的字', '有時候會搜尋一個樹裡沒有的字');
  await step(tok);                                    // 12:36 落到 fail node
  T.showFails(true); T.fails.forEach((f) => glow(f, GOLD));
  say('不存在的字 → 搜尋失敗，落在方塊（fail node）裡', '');
  await step(tok);                                    // 12:51 fail node 的機率 qi
  T.fails.forEach((f, i) => tag('q' + i, 'note', f.position.x, f.position.y + 0.45));
  say('落到每個 fail node Ei 也有機率：qi', '例：100 次搜尋有 50 次落在這裡 → 50%');
  await step(tok);                                    // 13:10 fail node 的 level
  T.fails.forEach((f) => glow(f, null));
  T.fails.forEach((f) => tag('L' + f.userData.lv, 'idx', f.position.x + 0.55, f.position.y - 0.1));
  say('fail node 也有 level', '它在 leaf 再往下一層');
  await step(tok);                                    // 13:32 cost 只算到 leaf
  const s = seeker('cc', -5.4, 5.6);
  await tour(tok, s, 550, T.nodes.while, T.nodes.if, T.nodes.do);
  glow(T.fails[0], RED); s.mood('sad');
  say('找 cc：到 leaf do 就知道沒有了', '不會真的走進方塊：比 3 次就停');
  await step(tok);                                    // 14:05 level(Ei) − 1
  T.fails.forEach((f) => tag('q × ' + (f.userData.lv - 1), 'ptr', f.position.x, f.position.y - 0.6));
  bub('失敗：Σ qi × (level(Ei) − 1)', 0, 7.4);
  say('所以失敗那一項用 level(Ei) − 1', '到 leaf 就 stop，不必再往下走');
  await step(tok);                                    // 14:44 兩大項加起來
  okT('cost = Σ pi·level(ai) + Σ qi·(level(Ei) − 1)', 0, 0.2);
  say('整棵 BST 的 cost = 成功 + 失敗 兩大項', 'Σ pi·level(ai) + Σ qi·(level(Ei) − 1)');
}]);

// 五棵樹（小）：回傳 [{nm, s, x, T}]
function five63() {
  return FIVE63.map(([nm, s], i) => {
    const x = -5.6 + i * 2.8; tag('(' + nm + ')', 'idx', x, 6.3);
    return { nm, s, x, T: ext63(s, { x, y: 5.4, sx: 0.36, dy: 1.15, sz: 0.48, fs: 0.3 }) };
  });
}

// 15:30 do / if / while 五棵 BST，uniform
FRAG.push(['bst63-five-uniform', 'do / if / while 五棵 BST：p = q = 1/7', async (tok) => {
  fresh([0, 3, 13.5], [0, 2.6, 0]);
  await step(tok);                                    // 15:30 三個字
  const ws = ['do', 'if', 'while'].map((w, i) => buddy(null, w, B63, -2.4 + i * 2.4, 2.4, 0, 0.9));
  say('給你三個字：do、if、while', '照字母順序 do < if < while');
  await step(tok);                                    // 15:46 可以排出 5 棵
  ws.forEach((b) => kill(b.g));
  const Ts = five63(); Ts.forEach((t) => t.T.showFails(false));
  say('這三個字可以排出 5 棵不同的 BST', '(a) ～ (e)');
  await step(tok);                                    // 15:55 哪一棵 optimal？
  bub('哪一棵最 optimal？', 0, 7.4);
  say('要回答：這五棵哪一棵最 optimal', '');
  await step(tok);                                    // 16:03 先要知道機率
  note('p：字被搜尋的機率　q：落到 fail node 的機率', 0, 0.3);
  say('cost 跟機率有關：先要知道 pi 和 qi', 'node 被搜尋、落到 fail node 的機率');
  await step(tok);                                    // 16:23 uniform 1/7
  pkt('pi = qi = 1/7', 0, -0.4);
  say('最簡單：假設 uniform', '每一種都是 1/7');
  await step(tok);                                    // 16:31 3 個字 + 4 個 fail node
  Ts.forEach((t) => { t.T.showFails(true); t.T.fails.forEach((f) => glow(f, GOLD)); });
  say('為什麼是 7？3 個字 + 4 個 fail node', '一共 7 種結果，各 1/7');
  await step(tok);                                    // 16:50 tree a 的 cost
  Ts.forEach((t) => t.T.fails.forEach((f) => glow(f, null)));
  const A = Ts[0].T; glowAll(A, GOLD);
  const f = pkt('cost(a) = ', -5.6, 1.1);
  say('來算 tree a 的 cost', '前面成功、後面（紅字）失敗');
  await step(tok);                                    // 17:12 while level 1
  glowAll(A, null); glow(A.nodes.while, GREEN);
  txt(f, 'cost(a) = 1·1/7');
  say('搜尋 while：機率 1/7 × level 1', '');
  await step(tok);                                    // 17:20 if level 2
  glow(A.nodes.if, GREEN); txt(f, 'cost(a) = (1 + 2)/7');
  say('搜尋 if：1/7 × level 2', '');
  await step(tok);                                    // 17:27 do level 3
  glow(A.nodes.do, GREEN); txt(f, 'cost(a) = (1 + 2 + 3)/7 + …');
  say('搜尋 do：1/7 × level 3', '成功部分 = (1 + 2 + 3)/7');
  await step(tok);                                    // 17:41 再算方塊
  A.fails.forEach((m) => glow(m, RED));
  say('再算每個方塊（fail node）的 cost', '每個方塊的機率也是 1/7');
  await step(tok);                                    // 18:15 level 4 但只走到 do → 3
  tag('4 − 1 = 3', 'note', A.fails[0].position.x - 0.3, A.fails[0].position.y - 0.5);
  say('最下面的方塊在 level 4', '但只走到 leaf do 就停 → 算 4 − 1 = 3');
  await step(tok);                                    // 18:45 3 + 3 + 2 + 1
  txt(f, '(1+2+3)/7 + (3+3+2+1)/7');
  say('四個方塊：3 + 3 + 2 + 1', '失敗部分 = (3 + 3 + 2 + 1)/7');
  await step(tok);                                    // 18:55 = 15/7
  txt(f, 'cost(a) = 15/7');
  say('加起來：tree a 的 cost = 15/7', '');
  await step(tok);                                    // 19:01 b、c、d、e 依此類推
  glowAll(A, null);
  for (const t of Ts) { t.c = cost63(t.s, [1, 1, 1], [1, 1, 1, 1]); if (t !== Ts[0]) tag('cost = ' + t.c + '/7', 'ptr', t.x, 1.1); }
  say('b、c、d、e 依此類推', '每一棵都算出 cost');
  await step(tok);                                    // 19:18 最小的是 b
  glowAll(Ts[1].T, GREEN);
  okT('tree b 最小 → optimal', 0, -0.4);
  say('cost 最小的是 tree b（13/7）', '在 p = q = 1/7 的條件下，b 是 optimal');
}]);

// 19:37 非 uniform 與 static set
FRAG.push(['bst63-five-nonuniform', '機率不 uniform：tree c 變成最佳', async (tok) => {
  fresh([0, 3, 13.5], [0, 2.6, 0]);
  const Ts = five63();
  const P = [0.5, 0.1, 0.05], Q = [0.15, 0.1, 0.05, 0.05];
  await step(tok);                                    // 19:41 p 不 uniform
  pkt('p1 = 0.5　p2 = 0.1　p3 = 0.05', 0, 0.5);
  say('第二組：機率不是 uniform', '搜尋 do 的機率 0.5、if 0.1、while 0.05');
  await step(tok);                                    // 19:57 q 也不同
  pkt('q0 = 0.15　q1 = 0.1　q2 = q3 = 0.05', 0, -0.3);
  Ts.forEach((t) => t.T.fails.forEach((m) => glow(m, GOLD)));
  say('落到各個 fail node 的機率也不一樣', 'q0 ～ q3');
  await step(tok);                                    // 20:05 每棵算 cost
  Ts.forEach((t) => t.T.fails.forEach((m) => glow(m, null)));
  let best = null;
  await anim(tok, 1500, (u) => {
    const k = Math.min(5, Math.round(u * 5));
    for (const t of Ts.slice(0, k)) if (t.c === undefined) { t.c = cost63(t.s, P, Q); tag('cost = ' + (+t.c.toFixed(2)), 'ptr', t.x, 1.1); if (!best || t.c < best.c - 1e-9) best = t; }
  });
  say('用同樣的公式算每棵樹的 cost', '');
  await step(tok);                                    // 20:12 最小 1.5：tree c
  glowAll(best.T, GREEN);
  okT('tree ' + best.nm + '：cost 1.5 最小', best.x, 0.3, 1);
  say('最小的 cost 是 1.5：tree ' + best.nm + ' 是最佳解', 'do 最常被搜尋 → 放在 root');
  await step(tok);                                    // 20:49 static set
  Ts.forEach((t) => t.T.all.forEach(kill));
  fresh([0, 3, 12], [0, 2.4, 0]);
  const ws = [['do', 0.5], ['if', 0.1], ['while', 0.05]].map(([w, p], i) => buddy(w, p, B63, -3 + i * 3, 1.2, 0, 1));
  bub('static set：字和機率都先給定', 0, 5.6);
  say('optimal BST 解的是 static set 的問題', '給你一堆字，和它們被搜尋的機率');
  await step(tok);                                    // 21:16 機率不隨時間改變
  note('機率固定，不會隨時間改變', 0, 4.4);
  say('機率是 static：不隨時間改變', '在這個條件下，幫你建出 optimal BST');
  await step(tok);                                    // 21:39 搜尋引擎：每個月不一樣
  const mon = pkt('這個月', -5.6, 3.4);
  const seq = [[0.5, 0.1, 0.05], [0.2, 0.4, 0.05], [0.05, 0.1, 0.6]];
  await anim(tok, 2200, (u) => {
    const k = Math.min(2, Math.floor(u * 3));
    txt(mon, ['這個月', '下個月', '再下個月'][k]);
    ws.forEach((b, i) => b.set(seq[k][i]));
  });
  ws.forEach((b) => b.mood('wow'));
  say('真實的搜尋引擎：這個月和上個月搜尋的字不一樣', '那是 dynamic set');
  await step(tok);                                    // 22:24 dynamic set 的 cost 怎麼定？
  bub('dynamic set 的 optimal BST，cost 怎麼定？', 0, 5.6);
  say('思考題：dynamic set 的 optimal BST', '它的 cost 要怎麼定義？');
  await step(tok);                                    // 22:42 期末考不考
  note('想想看就好：期末考不考', 0, -0.6);
  ws.forEach((b) => b.mood('happy'));
  say('太難了沒關係：期末考不會出', '但可以自己想想看');
}]);

// 23:22 暴力法
FRAG.push(['bst63-brute-force', '暴力法：列出所有 BST 再算 cost', async (tok) => {
  fresh([0, 3, 13], [0, 2.8, 0]);
  await step(tok);                                    // 23:22 回到 static set
  bub('回到 static set', 0, 7.2);
  say('回到 static set：機率都給定', '問哪一棵 BST 最 optimal');
  await step(tok);                                    // 23:46 給 n 個字
  const ws = [];
  for (let i = 0; i < 5; i++) ws.push(buddy(i < 4 ? 'p' + (i + 1) : 'pn', i < 4 ? 'a' + (i + 1) : 'an', B63, -4.8 + i * 2.4, 1.5, 0, 0.8));
  note('… 還有每個 fail node 的 q', 0, 0.7, 1);
  say('進階：給 n 個字、每個字的 pi、fail node 的 qi', '哪一棵 BST 最佳？你會怎麼做');
  await step(tok);                                    // 24:33 最笨：全部產生
  ws.forEach((b) => kill(b.g));
  const minis = FIVE63.map(([nm, s], i) => ({ nm, s, x: -5.6 + i * 2.8 }));
  const drawMini = (t) => { t.T = ext63(t.s, { x: t.x, y: 6, sx: 0.55, dy: 0.8, sz: 0.45, noFail: true }); };
  drawMini(minis[0]);
  say('最笨的方法：把 n 個 node 能組成的 BST 全部產生出來', '');
  await step(tok);                                    // 24:49 三個字就是這五棵
  await anim(tok, 1200, (u) => { const k = Math.min(5, 1 + Math.round(u * 4)); for (const t of minis.slice(0, k)) if (!t.T) drawMini(t); });
  say('例如 3 個字：就是這 5 棵', '');
  await step(tok);                                    // 25:17 每棵算 cost，選最小
  const cl = minis.map((t) => tag(cost63(t.s, [1, 1, 1], [1, 1, 1, 1]) + '/7', 'ptr', t.x, 3.5));
  glowAll(minis[1].T, GREEN);
  say('每一棵都算出 cost，排序，選最小', '最小的就是 optimal');
  await step(tok);                                    // 25:27 光第一步就很難
  for (const t of minis) t.T.all.forEach(kill);
  cl.forEach(kill);
  const cat = [1, 2, 5, 14, 42, 132, 429];
  let nb = 0;
  await anim(tok, 1800, (u) => {
    const k = Math.min(cat.length, Math.round(u * cat.length));
    while (nb < k) { const i = nb++; const c = cat[i], h = 0.4 + Math.log2(c) * 0.42, x = -4.5 + i * 1.5; cube(c, i === 2 ? GREEN : O63, [0.9, h, 0.9], x, h / 2, 0); tag('n=' + (i + 1), 'idx', x, -0.4); }
  });
  noT('暴力法：光是第一步就做不完', 0, 5.6);
  say('這是暴力法：光是「產生所有 BST」就很難', '補充：n 個字有 C(n) = (2n)!/(n!(n+1)!) 棵，n = 10 → 16796');
  await step(tok);                                    // 25:46 有比較有效率的方法
  bub('有更有效率的方法！', 0, 7.2);
  say('接下來看比較有效率的方法', '演算法課也會講到');
  await step(tok);                                    // 25:58 DP
  okT('dynamic programming', 0, 6.4);
  say('它是 dynamic programming 的方法', '用小 subtree 的最佳解，組出大樹');
}]);

// 26:03 DP 符號
FRAG.push(['bst63-tij-def', 'DP 符號：Tij、wij、cij、rij', async (tok) => {
  fresh([0, 2.6, 12], [0, 1.8, 0]);
  const A = [], Qs = [];
  await step(tok);                                    // 26:03 符號定義
  for (let i = 0; i <= 4; i++) {
    Qs.push(cube('q' + i, F63, [0.8, 0.4, 0.8], -4 + i * 2, 0.3, 0, 2));
    if (i < 4) A.push(cube('a' + (i + 1), B63, [1, 0.8, 1], -3 + i * 2, 2.2, 0, 2));
  }
  say('先定義一些符號', 'a1 < a2 < … < an 排好，fail node q0 … qn 夾在中間');
  await step(tok);                                    // 26:12 Tij
  let box = ghostBox('#c58a10', 5, 3.2, 1.6); box.position.set(0, 1.3, 0);
  let bt = tag('T13', 'ptr alt', 0, 3.3);
  [A[1], A[2]].forEach((m) => glow(m, GOLD));
  say('Tij：用 a(i+1) … aj 這些字建出的 optimal BST', '例：T13 含 a2、a3（i 不含、j 含）');
  await step(tok);                                    // 26:50 cij
  const ct = note('c13 = T13 的 cost', -4.6, 4.2);
  say('cij：Tij 這棵樹的 cost', '');
  await step(tok);                                    // 26:59 rij
  const rt = note('r13 = T13 的 root', 4.6, 4.2);
  say('rij：Tij 這棵樹的 root', '');
  await step(tok);                                    // 27:07 wij
  const wt = pkt('w13 = p2 + p3 + …', 0, 4.6);
  const sum = [A[1], A[2]].map((m) => pkt('p', m.position.x, m.position.y + 0.6));
  await anim(tok, 900, (u) => sum.forEach((s, i) => s.position.set(A[i + 1].position.x * (1 - u), A[i + 1].position.y + 0.6 + (4.0 - A[i + 1].position.y - 0.6) * u, 0)));
  sum.forEach(remove);
  say('wij（weight）：裡面所有字的 p 加總', '再加上 fail node 的 q');
  await step(tok);                                    // 28:04 最左邊的 fail node qi 也算
  [Qs[1], Qs[2], Qs[3]].forEach((m) => glow(m, GOLD)); glow(Qs[1], RED);
  txt(wt, 'w13 = p2 + p3 + q1 + q2 + q3');
  say('fail node 從 qi 算到 qj：最左邊的 q1 也要算', 'w13 = p2 + p3 + q1 + q2 + q3');
  await step(tok);                                    // 28:42 weight ≠ cost
  glow(Qs[1], GOLD);
  note('weight：只把機率加起來', -3.6, -0.6); note('cost：機率 × level 再加', 3.6, -0.6);
  say('weight 和 cost 不一樣', 'weight 只加機率；cost 還要乘上 level');
  await step(tok);                                    // 29:28 Tii
  A.concat(Qs).forEach((m) => glow(m, null)); [ct, rt].forEach(remove);
  kill(box); kill(bt);
  box = ghostBox('#c58a10', 1.4, 1.2, 1.4); box.position.set(0, 0.3, 0); bt = tag('T22', 'ptr alt', 0, 1.2);
  glow(Qs[2], GOLD);
  txt(wt, 'T22：w22 = q2，c22 = 0，r22 = 0');
  say('初始條件 Tii：沒有字，只有一個 fail node qi', 'wii = qi，cii = 0，rii = 0');
  await step(tok);                                    // 29:40 目標 T0n
  glow(Qs[2], null); kill(box); kill(bt);
  box = ghostBox('#0f5a3a', 9.4, 3.4, 1.8); box.position.set(0, 1.3, 0); bt = tag('T04', 'ptr alt', 0, 3.4);
  A.concat(Qs).forEach((m) => glow(m, GREEN));
  txt(wt, '要找：T0n（這裡 n = 4）');
  say('要找的是 T0n：全部 n 個字的 optimal BST', 'cost c0n、weight w0n、root r0n');
  await step(tok);                                    // 30:06 拆成 subtree
  const l = ghostBox('#4b9ee2', 3.6, 2.8, 1.5); l.position.set(-2.6, 1.3, 0);
  const r = ghostBox('#dd8238', 3.6, 2.8, 1.5); r.position.set(2.6, 1.3, 0);
  tag('subtree 最佳', 'idx', -2.6, -0.4); tag('subtree 最佳', 'idx', 2.6, -0.4);
  say('做法：拆成很多 subtree', '每棵 subtree 都 optimal → 組出來的 T0n 也 optimal');
}]);

// 30:48 遞迴式
FRAG.push(['bst63-recurrence', '遞迴式：選 ak 當 root，試每個 k', async (tok) => {
  fresh([0, 3, 12.5], [0, 2.8, 0]);
  const A = [1, 2, 3, 4].map((k) => cube('a' + k, B63, [1, 0.8, 1], -4.5 + k * 1.8, 1, 0));
  const deco = [];
  const clear = () => { deco.splice(0).forEach(kill); };
  function split(k) {
    clear();
    A.forEach((m, idx) => {
      const kk = idx + 1;
      if (kk === k) { move(m, 0, 5.2, 0); glow(m, GOLD); return; }
      glow(m, null);
      if (kk < k) move(m, -4.6 + idx * 1.2, 2.4, 0); else move(m, 2.2 + (kk - k - 1) * 1.2, 2.4, 0);
    });
    const lb = ghostBox('#4b9ee2', 4, 1.6, 1.4); lb.position.set(-3.4, 2.4, 0);
    const rb = ghostBox('#4b9ee2', 4, 1.6, 1.4); rb.position.set(3.4, 2.4, 0);
    deco.push(lb, rb, line(0, 5.2, -3.4, 3.2), line(0, 5.2, 3.4, 3.2));
  }
  const fT = pkt('', 0, -0.5);
  await step(tok);                                    // 30:49 root 是 ak
  glow(A[1], GOLD); move(A[1], A[1].position.x, 2.4, 0);
  tag('T04：a1 … a4', 'idx', -5.6, 6.2);
  say('假設 Tij 的 root 是 ak', 'i < k ≤ j（從 a(i+1) … aj 挑一個字）');
  await step(tok);                                    // 31:35 長出兩棵 subtree
  split(2);
  say('ak 當 root：一定長出兩棵 subtree', 'left subtree、right subtree');
  await step(tok);                                    // 31:40 左 a(i+1)…a(k−1)、右 a(k+1)…aj
  deco.push(tag('L：a(i+1) … a(k−1)', 'ptr', -3.4, 1.1), tag('R：a(k+1) … aj', 'ptr', 3.4, 1.1));
  say('左邊：a(i+1) … a(k−1)', '右邊：a(k+1) … aj');
  await step(tok);                                    // 32:01 cij = pk + cL + cR + wL + wR
  txt(fT, 'cij = pk + cost(L) + cost(R) + w(L) + w(R)');
  await anim(tok, 700, (u) => deco.forEach((d) => { if (d.isMesh) d.position.y = 2.4 - 0.5 * u; }));
  A.forEach((m, i) => { if (i !== 1) move(m, m.position.x, 1.9, 0); });
  say('cij = pk + cL + cR + w(L) + w(R)', '掛到 ak 下面：subtree 每個點都多一層 → 再加一次 weight');
  await step(tok);                                    // 32:31 cost(L)、cost(R) 再遞迴算
  bub('cost(L)、cost(R) 再 recursive 下去算', 0, 7.0);
  say('cost(L)、cost(R) 會再 recursive 下去算', '先當它們已經算好');
  await step(tok);                                    // 32:52 cost(L) = c(i,k−1)、cost(R) = c(k,j)
  deco.push(tag('c(i, k−1)', 'note', -3.4, 3.5), tag('c(k, j)', 'note', 3.4, 3.5));
  say('cost(L) 寫成 c(i, k−1)', 'cost(R) 寫成 c(k, j)');
  await step(tok);                                    // 33:13 pk + wL + wR = wij
  txt(fT, 'pk + w(i,k−1) + w(k,j) = wij');
  glow(A[1], GREEN);
  say('w(L) + w(R) 再加 pk', '剛好就是整棵樹的 wij');
  await step(tok);                                    // 33:42 cij = wij + c(i,k−1) + c(k,j)
  txt(fT, 'cij = wij + c(i, k−1) + c(k, j)');
  say('所以 cij = wij + c(i, k−1) + c(k, j)', '整棵樹的 weight + 左右 subtree 的 cost');
  await step(tok);                                    // 34:20 要讓 cost 最小
  bub('Tij 要 optimal → 讓 cij 最小', 0, 7.0);
  say('希望 Tij 是 optimal', '就要讓這個 cost 最小');
  await step(tok);                                    // 34:37 k 是誰不知道
  relabel(A[1], 'a?');
  say('可是 root 要選哪一個字？', '其實你不知道 k 是多少');
  await step(tok);                                    // 35:02 每個 k 都試
  relabel(A[1], 'a2');
  for (const k of [1, 2, 3, 4]) { split(k); txt(fT, 'k = ' + k + '：c(i,' + (k - 1) + ') + c(' + k + ',j)'); await beat(tok, 450); }
  say('k 從 i+1 試到 j', '看哪一個讓 c(i, k−1) + c(k, j) 最小');
  await step(tok);                                    // 35:41 wij 跟 k 無關
  txt(fT, 'cij = wij + min{ c(i, k−1) + c(k, j) }');
  okT('wij 不管選哪個 k 都一樣', 0, 7.0);
  say('wij 跟選哪個 k 無關', 'cij = wij + min{ c(i, k−1) + c(k, j) }');
}]);

// 36:10 例：T02 以 a2 為 root
FRAG.push(['bst63-t02-verify', 'T02 以 a2 為 root：驗證 cost 公式', async (tok) => {
  fresh([0, 3, 12], [0, 2.6, 0]);
  const f = pkt('', 2.6, 0.2);
  await step(tok);                                    // 36:11 T02 含 a1、a2、q0、q1、q2
  const ws = ['a1', 'a2'].map((w, i) => buddy(null, w, B63, -3 + i * 2, 4.6, 0, 0.7));
  const qs = [0, 1, 2].map((i) => cube('q' + i, F63, [0.7, 0.35, 0.7], -4 + i * 2, 3.5, 0));
  say('例子：T02', '含兩個字 a1、a2，三個 fail node q0、q1、q2');
  await step(tok);                                    // 36:48 a2 當 root
  ws.forEach((b) => kill(b.g)); qs.forEach(kill);
  const T = ext63(['a2', ['a1', null, null], null], { x: -1.5, y: 5.4, sx: 1.6, dy: 1.6 });
  T.fails.forEach((m, i) => tag('q' + i, 'idx', m.position.x, m.position.y - 0.55));
  say('假設 root 是 a2', 'a1 在左邊，q2 在右邊');
  await step(tok);                                    // 37:23 cost = p2 + cL + cR + wL + wR
  const lb = ghostBox('#4b9ee2', 3.8, 2.8, 1.4); lb.position.set(-3.1, 3.0, 0);
  const rb = ghostBox('#dd8238', 1.2, 1.2, 1.2); rb.position.set(1.7, 3.8, 0);
  txt(f, 'cost(T02) = p2 + cost(L) + cost(R) + wL + wR');
  say('照公式：cost(T02) = p2 + cL + cR + wL + wR', 'L = 大三角形、R = 小三角形');
  await step(tok);                                    // 38:12 cost(L) = T01、cost(R) = T22
  tag('L = T01', 'ptr', -3.1, 1.1); tag('R = T22', 'ptr', 1.7, 2.8);
  say('大三角形就是 T01，小三角形就是 T22', 'cost(L) = cost(T01)，cost(R) = cost(T22)');
  await step(tok);                                    // 38:31 wL、wR
  note('wL = q0 + p1 + q1', -3.1, 0.4); note('wR = q2', 1.7, 2.2);
  say('wL = q0 + p1 + q1', 'wR = q2');
  await step(tok);                                    // 39:07 cost(T01) = p1 + q0 + q1
  note('cost(T01) = p1 + q0 + q1，cost(T22) = 0', -1.4, -0.4);
  say('cost(T01) 再照公式算：p1 + q0 + q1', 'T22 沒有字：cost = 0');
  await step(tok);                                    // 39:17 代進去
  txt(f, 'cost(T02) = 2p1 + p2 + 2q0 + 2q1 + q2');
  say('全部代進去', 'cost(T02) = 2p1 + p2 + 2q0 + 2q1 + q2');
  await step(tok);                                    // 39:57 不看公式，直接算
  kill(lb); kill(rb);
  bub('不用公式：直接看 level 算？', 0, 7.0);
  say('換個問法：不看公式，這棵樹的 cost 怎麼算？', '直接用 level 算');
  await step(tok);                                    // 40:24 a1 level 2
  const m1 = T.nodes.a1; tag('level 2 → p1·2', 'ptr alt', m1.position.x - 0.2, m1.position.y + 0.75); glow(m1, GOLD);
  say('a1 在 level 2', 'p1 × 2');
  await step(tok);                                    // 40:43 a2 level 1，q0、q1、q2
  const m2 = T.nodes.a2; tag('level 1 → p2', 'ptr alt', m2.position.x + 1.6, m2.position.y + 0.3); glow(m2, GOLD);
  for (const q of T.fails) { tag('×' + (q.userData.lv - 1), 'ptr alt', q.position.x + 0.6, q.position.y + 0.3); glow(q, GOLD); }
  say('a2 在 level 1；q0、q1 × 2，q2 × 1', 'p1·2 + p2·1 + q0·2 + q1·2 + q2·1');
  await step(tok);                                    // 42:07 一模一樣
  glowAll(T, GREEN);
  okT('兩種算法一模一樣 ✓', 2.6, 1.0);
  say('跟遞迴公式算出來的完全一樣', '');
  await step(tok);                                    // 42:27 公式裡沒有 level
  note('公式裡沒有 level：weight 一層層加，就乘進去了', 0, -1.0);
  say('遞迴公式裡根本沒算 level', 'weight 一層層累加，自然把 level 乘進去');
  await step(tok);                                    // 43:52 第二個訊息：recursive
  bub('第二件事：cost 可以從 subtree recursive 算出來', 0, 7.0);
  say('這頁的第二個訊息', '找 optimal 就是一直往 subtree recursive 下去算');
  await step(tok);                                    // 44:20 誰當 root？
  txt(f, '下一個問題：到底誰當 root ak？');
  say('cost function 確認無誤', '接下來回答：到底誰當 root？');
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
  const m = cube('', col || '#efe4cf', [2.3, 0.95, 0.25], TX63(i), TY63(j - i), 0, drop ? 2 : 0);
  const l = lab.label('T' + i + j + ' w=' + DP63.w[i][j] + '\nc=' + DP63.c[i][j] + ' r=' + DP63.r[i][j], '');
  Object.assign(l.element.style, MONO); l.position.set(0, 0, 0.2); m.add(l); return m;
}
const HDR63 = 'a = do if return while　p = 3 3 1 1　q = 2 3 1 1 1';
function axes63() {
  return { rows: [0, 1, 2, 3, 4].map((d) => tag(d + ' 字', 'idx', -6.4, TY63(d))), cols: [0, 1, 2, 3, 4].map((i) => tag('i=' + i, 'idx', TX63(i), 5.65)) };
}
function table63(rows) {
  tag(HDR63, 'ptr', 0, 6.3); axes63();
  for (let d = 0; d <= rows; d++) for (let i = 0; i + d <= 4; i++) cell63(i, i + d, false);
}
const candTxt63 = (i, j) => DP63.cand[i][j].map(([k, a, b]) => 'k=' + k + '：' + a + '+' + b).join('，');
const hot63 = (ls, on) => ls.forEach((l) => { l.element.className = 'lab-label ' + (on ? 'ptr alt' : 'idx'); });

// 44:46 DP 表：第 0、1 列
FRAG.push(['bst63-obst-row1', 'Optimal BST 表：第 0、1 列', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  const hd = tag('', 'ptr', 0, 6.3);
  await step(tok);                                    // 44:46 四個字
  const ws = N63.map((w, i) => buddy('a' + (i + 1), w, B63, -4.5 + i * 3, 2.2, 0, 0.9));
  txt(hd, 'a = do if return while');
  say('例子：4 個字 a1 … a4', 'do、if、return、while（已照字母排好）');
  await step(tok);                                    // 44:59 p = 3 3 1 1
  ws.forEach((b, i) => tag('p' + (i + 1) + ' = ' + P63[i + 1], 'note', b.g.position.x, 1.6));
  txt(hd, 'a = do if return while　p = 3 3 1 1');
  say('被搜尋的次數 p1 … p4 = 3、3、1、1', '還沒 normalize 成機率，用次數就好');
  await step(tok);                                    // 45:08 q = 2 3 1 1 1
  txt(hd, HDR63);
  say('落到 fail node 的次數 q0 … q4 = 2、3、1、1、1', '');
  await step(tok);                                    // 45:26 重點是這張表
  ws.forEach((b) => kill(b.g));
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  tag(HDR63, 'ptr', 0, 6.3);
  const fr = ghostBox('#c58a10', 12.6, 5.6, 0.2); fr.position.set(0.4, 2.6, -0.3);
  say('重點是這張表', '一格一格從上往下推');
  await step(tok);                                    // 45:45 橫軸
  const cols = [0, 1, 2, 3, 4].map((i) => tag('i=' + i, 'ptr alt', TX63(i), 5.65));
  say('橫軸 i：從第幾個字開始', '');
  await step(tok);                                    // 45:56 縱軸
  hot63(cols, false);
  const rows = [0, 1, 2, 3, 4].map((d) => tag(d + ' 字', 'ptr alt', -6.4, TY63(d)));
  say('縱軸：這棵樹裡包含幾個字', '');
  await step(tok);                                    // 46:07 第 0 列
  hot63(rows, false);
  for (let i = 0; i <= 4; i++) cell63(i, i, true);
  say('第 0 列：沒有任何字，只剩 fail node', 'w00 = q0 = 2，c00 = 0，r00 = 0');
  await step(tok);                                    // 47:26 Tij 含哪些字
  const rem = note('Tij：字 a(i+1) … aj，fail node qi … qj', 0.4, -0.4);
  say('再提醒一次：Tij 包含 a(i+1) … aj', 'fail node 則是 qi … qj');
  await step(tok);                                    // 49:21 要找這組的 optimal BST
  remove(rem);
  const qn = bub('這組字的 optimal BST 長什麼樣？', 0.4, 7.2);
  say('問題：給定這些 p、q', '最佳的 BST 到底長什麼樣子？');
  await step(tok);                                    // 49:57 每一列的意義
  hot63(rows, true);
  say('每一列：樹裡有 0、1、2、3、4 個字', '從上往下，字越來越多');
  await step(tok);                                    // 50:51 一個字：4 種
  hot63(rows, false); hot63([rows[1]], true);
  const g1 = ghostBox('#4b9ee2', 10.2, 1.1, 0.4); g1.position.set(TX63(1.5), TY63(1), 0);
  say('只含一個字的樹：只有 4 種', 'a1、a2、a3、a4 各自一棵');
  await step(tok);                                    // 51:23 T01
  kill(g1); remove(qn);
  const mt = ext63(['a1', null, null], { x: 4.8, y: 2.7, sx: 0.8, dy: 1.0, sz: 0.6, fs: 0.4 });
  mt.fails.forEach((m, i) => tag('q' + i, 'idx', m.position.x, m.position.y - 0.4));
  tag('T01', 'ptr alt', 4.8, 3.5);
  say('T01：a1 當 root', '左右兩邊是 q0、q1');
  await step(tok);                                    // 51:53 w01 = 8
  const wt = pkt('w01 = 2 + 3 + 3 = 8', 4.4, 0.6);
  say('w01 = q0 + p1 + q1', '= 2 + 3 + 3 = 8');
  await step(tok);                                    // 52:25 c01 = 8
  txt(wt, 'c01 = 8 + c00 + c11 = 8');
  say('c01 = w01 + c00 + c11', '左右都是空的（fail node）→ 8 + 0 + 0 = 8');
  await step(tok);                                    // 52:46 r01 = 1
  cell63(0, 1, true, '#f6d9a8');
  txt(wt, 'r01 = 1（a1 = do）');
  say('只有一個字：root 自然就是 a1', 'r01 = 1');
  await step(tok);                                    // 53:00 T12
  mt.all.forEach(kill);
  cell63(1, 2, true, '#f6d9a8');
  txt(wt, 'T12：只有 a2（if）');
  say('T12：只含 a2 這一個字', 'w12 = 3 + 3 + 1 = 7，c12 = 7');
  await step(tok);                                    // 53:22 T23、T34
  cell63(2, 3, true, '#f6d9a8'); cell63(3, 4, true, '#f6d9a8');
  txt(wt, 'T23、T34 依此類推');
  say('a3、a4 也一樣', '只含一個字的情況就是這 4 種');
}]);

// 53:45 DP 表：第 2 列
FRAG.push(['bst63-obst-row2', 'Optimal BST 表：第 2 列（T02 取最小）', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  table63(1);
  const f = pkt('', 0.4, -0.5);
  let t1 = null, t2 = null, l1 = null, l2 = null;
  await step(tok);                                    // 53:45 兩個字
  const g2 = ghostBox('#4b9ee2', 7.7, 1.1, 0.4); g2.position.set(TX63(1), TY63(2), 0);
  say('第 2 列：樹裡包含兩個字', '');
  await step(tok);                                    // 54:01 T02 = a1、a2
  kill(g2);
  const gb = ghostBox('#c58a10', 2.3, 1.0, 0.4); gb.position.set(TX63(0), TY63(2), 0);
  say('第一個組合：a1 和 a2', '這棵樹就是 T02');
  await step(tok);                                    // 54:19 w02 = 12
  txt(f, 'w02 = 3 + 3 + 2 + 3 + 1 = 12');
  say('w02 = p1 + p2 + q0 + q1 + q2', '= 12');
  await step(tok);                                    // 54:30 c02 = w + 左右
  txt(f, 'c02 = 12 + min{ 左 + 右 }');
  say('c02 = weight + 左右 subtree 的 cost', '左右怎麼組？');
  await step(tok);                                    // 54:55 藍：0 + 7
  t1 = ext63(['do', null, ['if', null, null]], { x: -2.2, y: 2.0, sx: 0.9, dy: 0.9, sz: 0.55, noFail: true });
  l1 = tag('k=1：c00 + c12 = 0 + 7', 'ptr', -2.2, 0.2);
  say('第一種：a1 當 root', '左 c00 = 0，右 c12 = 7 → 0 + 7');
  await step(tok);                                    // 55:18 綠：8 + 0
  t2 = ext63(['if', ['do', null, null], null], { x: 2.8, y: 2.0, sx: 0.9, dy: 0.9, sz: 0.55, noFail: true });
  l2 = tag('k=2：c01 + c22 = 8 + 0', 'ptr', 2.8, 0.2);
  say('第二種：a2 當 root', '左 c01 = 8，右 c22 = 0 → 8 + 0');
  await step(tok);                                    // 55:37 最小 7 → c02 = 19
  l1.element.className = 'lab-label ptr alt';
  txt(f, 'c02 = 12 + 7 = 19');
  say('7 比 8 小 → 選第一種', 'c02 = 12 + 7 = 19');
  await step(tok);                                    // 55:47 長這樣：do 當 root
  glowAll(t1, GREEN);
  say('它的樹長這樣：a1（do）當 root', '左邊來自 c00，右邊來自 c12');
  await step(tok);                                    // 56:23 綠色：a2 往上拉
  glowAll(t2, GOLD);
  say('8 + 0 那種：a2 往上拉當 root，a1 變左子', '也是一棵 BST，只是 cost 比較大');
  await step(tok);                                    // 56:50 選小的
  glowAll(t2, null);
  kill(gb);
  cell63(0, 2, true, '#bfe3cf');
  txt(f, 'T02：c = 19，r = 1');
  say('選小的：c02 = 19，r02 = 1', '');
  await step(tok);                                    // 57:01 T13
  t1.all.concat(t2.all).forEach(kill); kill(l1); kill(l2);
  cell63(1, 3, true, '#f6d9a8');
  txt(f, 'T13：' + candTxt63(1, 3) + ' → c13 = ' + DP63.c[1][3]);
  say('T13 依此類推：含 a2、a3', '每個 k 都試，取最小');
  await step(tok);                                    // 57:12 一直推
  cell63(2, 4, true, '#f6d9a8');
  txt(f, 'T24：' + candTxt63(2, 4) + ' → c24 = ' + DP63.c[2][4]);
  say('一直往下推：T24 也一樣', '');
}]);

// 57:23 DP 表：T04 與最後的樹
FRAG.push(['bst63-obst-final', 'Optimal BST 表：T04 與最後的樹', async (tok) => {
  fresh([0, 3, 12.5], [0, 3.1, 0]);
  table63(2);
  const f = pkt('', 0.4, -0.5);
  await step(tok);                                    // 57:23 三個字
  cell63(0, 3, true, '#f6d9a8'); cell63(1, 4, true, '#f6d9a8');
  say('第 3 列：樹裡有三個字', 'T03 含 a1、a2、a3；T14 含 a2、a3、a4');
  await step(tok);                                    // 57:36 c03 = 25
  txt(f, 'c03 = w03 + 11 = 14 + 11 = 25');
  say('c03 = w03 + 11 = 25', '11 怎麼來？回去推（k = 2：8 + 3）');
  await step(tok);                                    // 57:58 答案在 T04
  const gb = ghostBox('#0f5a3a', 2.4, 1.1, 0.5); gb.position.set(TX63(0), TY63(4), 0);
  say('答案一定在最下面那格：T04', '它包含 a1 … a4 全部四個字');
  await step(tok);                                    // 58:27 套公式
  txt(f, 'c04 = w04 + min{ c(0,k−1) + c(k,4) }，w04 = 16');
  say('套公式：c04 = w04 + min{ c(0,k−1) + c(k,4) }', 'k 從 1 試到 4');
  const cs = DP63.cand[0][4], ls = [];
  let bi = 0; cs.forEach((c, n) => { if (c[3] < cs[bi][3]) bi = n; });
  const show = (n) => { const [k, a, b, v] = cs[n]; ls.push(tag('k=' + k + '：' + a + ' + ' + b + ' = ' + v, 'ptr', 4.2, 2.6 - n * 0.6)); };
  await step(tok);                                    // 58:50 k = 1
  show(0);
  say('k = 1：c00 + c14', '= 0 + 19');
  await step(tok);                                    // 58:57 k = 2
  show(1);
  say('k = 2：c01 + c24', '= 8 + 8');
  await step(tok);                                    // 59:09 全部算出來
  show(2); show(3);
  say('k = 3、k = 4 也全部算出來', '');
  await step(tok);                                    // 59:18 最小 16 在 k = 2
  ls[bi].element.className = 'lab-label ptr alt';
  kill(gb); cell63(0, 4, true, '#bfe3cf');
  txt(f, 'c04 = 16 + 16 = 32，r04 = 2');
  say('19、16、22、25 → 最小的是 16（k = 2）', 'root 是 a2：r04 = 2');
  await step(tok);                                    // 59:55 從上往下推，最後的樹
  fresh([0, 3, 11], [0, 3, 0]);
  const pos = { if: [0, 5.4], do: [-2.4, 3.6], return: [2.4, 3.6], while: [4.2, 1.8] };
  const par = { do: 'if', return: 'if', while: 'return' };
  const rt = [['if', 'r04 = 2'], ['do', 'r01 = 1'], ['return', 'r24 = 3'], ['while', 'r34 = 4']];
  let n = 0;
  await anim(tok, 2000, (u) => {
    const k = Math.min(4, Math.round(u * 4));
    while (n < k) { const [w, r] = rt[n++]; const [x, y] = pos[w]; if (par[w]) line(pos[par[w]][0], pos[par[w]][1], x, y); cube(w, B63, [1.1, 0.8, 1], x, y, 0); tag(r, 'idx', x, y + 0.75); }
  });
  say('從表裡讀出整棵樹', 'if 當 root → 左 T01（do），右 T24（return → while）');
  await step(tok);                                    // 60:17 DP
  okT('最佳解來自之前算好的結果 = Dynamic Programming', 0, 0.4);
  say('最佳解來自之前慢慢算好的小表', '這就是 Dynamic Programming');
  await step(tok);                                    // 60:29 要先排序
  note('a1 … a4 一定要先排序', 0, -0.4);
  say('注意：a1 … a4 一定要先排序過', 'optimal cost = 32');
}]);

// 60:44 回顧：cost 與 weight
FRAG.push(['bst63-review', '回顧：cost 與 weight、DP 的意義', async (tok) => {
  fresh([0, 3, 12], [0, 2.6, 0]);
  let wb, cb, T, qn;
  await step(tok);                                    // 60:53 cost 和 weight 分開看
  wb = buddy('weight', 'Σ 機率', '#9ad0b4', -4.6, 3.4, 0, 1.0);
  cb = buddy('cost', 'Σ 機率×level', '#f4a56a', 4.6, 3.4, 0, 1.0);
  say('老師說：cost 和 weight 要分開來看', '當年也是修了演算法才搞懂');
  await step(tok);                                    // 61:03 樹已知 → cost 會算
  T = ext63(['if', ['do', null, null], ['return', null, null]], { x: 0, y: 5.0, sx: 0.8, dy: 1.2, sz: 0.7, noFail: true });
  cb.mood('happy');
  okT('樹給你了 → cost 一定會算', 0, 1.4);
  say('如果樹已經給你：cost 一定會算', '用 Σ p·level + Σ q·(level − 1)');
  await step(tok);                                    // 61:31 但不知道樹長什麼樣
  T.all.forEach(kill);
  qn = cube('?', GRAY, [1.1, 0.9, 1], 0, 5.0, 0, 2);
  cb.mood('wow');
  say('但現在不知道樹長什麼樣子', '還要讓 cost 最小');
  await step(tok);                                    // 61:56 weight 加總 + recursive
  const lb = ghostBox('#4b9ee2', 2.4, 1.6, 1.2); lb.position.set(-1.6, 2.6, 0);
  const rb = ghostBox('#dd8238', 2.4, 1.6, 1.2); rb.position.set(1.6, 2.6, 0);
  line(0, 4.6, -1.6, 3.4); line(0, 4.6, 1.6, 3.4);
  tag('left 最佳', 'idx', -1.6, 1.5); tag('right 最佳', 'idx', 1.6, 1.5);
  wb.mood('happy');
  say('做法：weight 加總 + recursive', '讓 left、right subtree 都是最佳解');
  await step(tok);                                    // 62:10 cij 沒說 root 是誰
  const rt = note('root = ?', 0, 6.2);
  say('cij 這個式子沒告訴你 root 是誰', '它只說 cij 等於這個東西');
  await step(tok);                                    // 62:29 k 全部試
  for (const k of [1, 2, 3, 4]) { relabel(qn, 'a' + k); await beat(tok, 400); }
  relabel(qn, 'min');
  txt(rt, 'k 從 i+1 試到 j，選最小');
  say('決定 k 的方法其實很笨', 'k 從 i+1 到 j 全部試過，選最小的');
  await step(tok);                                    // 62:50 意義一
  okT('① T02：公式算的 = level 算的', -4.6, 6.2);
  say('這頁的意義一：cost(T02) 怎麼算', '用公式和用 level，答案一樣');
  await step(tok);                                    // 63:09 意義二
  const up = pkt('cost(L) + cost(R) + weight', 0, 1.0);
  await travel(tok, up, V3(0, 1.0, 0), V3(0, 4.0, 0.5), 900);
  okT('② cost 可以由 subtree recursive 加出來', 4.4, 6.2);
  say('意義二：cost 由左右 subtree 的 cost 加起來', 'recursive 一路推上去');
  await step(tok);                                    // 63:41 DP
  remove(up); relabel(qn, 'if'); glow(qn, GREEN);
  wb.mood('happy'); cb.mood('happy');
  bub('這就是 dynamic programming', 0, 7.2);
  say('這就是 dynamic programming 的概念', '回去再自己推一次');
}]);

// 63:49 m-way search tree
FRAG.push(['bst63-mway', 'm-way search tree：一個 node 多個 key', async (tok) => {
  fresh([0, 3, 12], [0, 3, 0]);
  await step(tok);                                    // 63:49 前面都是 binary
  const bn = [cube('key', B63, [1.2, 0.8, 1], 0, 5.2, 0)];
  bn.push(line(-0.3, 4.8, -1.6, 2.6), line(0.3, 4.8, 1.6, 2.6));
  bn.push(tag('< key', 'idx', -1.6, 2.2), tag('> key', 'idx', 1.6, 2.2));
  bub('BST、AVL、optimal BST：都是 binary', 0, 7.0);
  say('前面的 BST、AVL、optimal BST', '都是 binary：一個 node 只有兩個 child');
  await step(tok);                                    // 64:05 m-way
  bn.forEach(kill);
  const Ks = ['K1', 'K2', 'K3'].map((k, i) => cube(k, B63, [1.3, 0.8, 1], -1.5 + i * 1.5, 5.2, 0, 2));
  say('m-way search tree：不只兩個方向', '最多可以有 m 個 child');
  await step(tok);                                    // 64:28 m 個 pointer
  const sx = [-4.6, -1.55, 1.55, 4.6], rng = ['< K1', 'K1 ~ K2', 'K2 ~ K3', '> K3'];
  sx.forEach((x, i) => {
    const px = -2.25 + i * 1.5;
    line(px, 4.7, x, 2.3);
    const g = ghostBox('#4b9ee2', 2.4, 1.4, 1.4); g.position.set(x, 1.6, 0);
  });
  say('root 最多 m 個 subtree', '也就是有 m 個 pointer 連出去');
  await step(tok);                                    // 64:40 key 與 pointer 的順序
  sx.forEach((x, i) => { tag('A' + i, 'idx', -2.25 + i * 1.5, 4.45); tag(rng[i], 'idx', x, 1.6); });
  say('node 裡有 key：K1 < K2 < … < Kn', 'pointer A0 … An 夾在 key 之間（n < m）');
  await step(tok);                                    // 65:26 比 BST 更強
  note('BST：一個 key，只比「大或小」', 0, 0.2);
  say('BST 只有一個 key、兩個 pointer', 'm-way 有很多 key、很多 pointer');
  await step(tok);                                    // 65:49 搜尋 x
  const s = seeker('x', 0, 6.8, 0.55, '要找');
  say('搜尋一個值 x：從 root 開始', '要決定往哪個 pointer 走');
  await step(tok);                                    // 66:00 有沒有 key 等於 x
  for (const m of Ks) { glow(m, GOLD); await hopOver(tok, s, m, 500, 0.5); glow(m, null); }
  say('先看 root 裡有沒有 key 等於 x', '有就直接回報');
  await step(tok);                                    // 66:10 落在哪個區間
  glow(Ks[1], GOLD); glow(Ks[2], GOLD);
  await hop63(tok, s, 0.75, 6.0, 600);
  say('沒有相等：看 x 落在哪個區間', '例：K2 < x < K3');
  await step(tok);                                    // 66:43 走那個 pointer
  glow(Ks[1], null); glow(Ks[2], null);
  await hop63(tok, s, 1.55, 1.9, 900); s.mood('happy');
  say('Ki < x < Ki+1 → 走 Ai 往下', '這裡走 A2');
  await step(tok);                                    // 66:57 高度與 node 數
  note('高度 h：最多 Σ m^i = (m^h − 1)/(m − 1) 個 node', 0, -0.6);
  say('推導：高度 h 的 m-way search tree', 'node 最多 Σ m^i 個');
}]);

// order 4 的 B-tree（投影片例子；只畫到搜尋 30 會經過的部分）
function btree63() {
  const R = { keys: {}, ptrs: [] };
  const node = (keys, cx, y, col) => keys.map((k, i) => { const m = cube(k, col || B63, [1, 0.7, 0.9], cx + (i - (keys.length - 1) / 2) * 1.1, y, 0); R.keys[k] = m; return m; });
  R.root = node([21, 48, 72], 0, 5.8);
  R.lv2 = [node(['…'], -5.2, 3.8, GRAY), node([25, 31, 41], -1.8, 3.8), node(['…'], 1.9, 3.8, GRAY), node(['…'], 5.2, 3.8, GRAY)];
  [-5.2, -1.8, 1.9, 5.2].forEach((x, i) => { R.ptrs.push([-1.65 + i * 1.1, 5.45]); line(-1.65 + i * 1.1, 5.45, x, 4.15); });
  R.leaf = node([26, '…'], -2.7, 1.8, '#9b7ef4');
  [-4.4, -2.7, -1.0, 0.5].forEach((x, i) => { line(-3.45 + i * 1.1, 3.45, x, 2.15); if (i !== 1) cube('…', GRAY, [0.8, 0.6, 0.8], x, 1.8, 0); });
  R.strip = ghostBox('#7a1010', 13, 0.4, 1.2); R.strip.position.set(0, 0.4, 0);
  tag('fail nodes', 'idx', 5.4, 0.9);
  return R;
}
// 67:25 B-tree 的定義
FRAG.push(['bst63-btree-def', 'B-tree 的定義（order m）', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const B = btree63();
  const f = pkt('', 0, -0.5);
  await step(tok);                                    // 67:25 B-tree
  bub('B-tree：很重要的 m-way search tree', 0, 7.2);
  say('m-way search tree 裡很重要的一種：B-tree', 'B-tree 就是 m-way search tree，再加幾個條件');
  await step(tok);                                    // 68:00 root ≥ 2
  B.root.forEach((m) => glow(m, GOLD));
  txt(f, '① root 至少 2 個 pointer');
  say('條件一：root 至少要有 2 個 pointer（child）', '');
  await step(tok);                                    // 68:15 其他 node（leaf 以外）
  B.root.forEach((m) => glow(m, null)); B.lv2[1].forEach((m) => glow(m, GOLD));
  txt(f, '② root、leaf 以外的 node……');
  say('條件二：除了 root 和最下面的 node', '其他 node 也要符合一個下限');
  await step(tok);                                    // 68:30 至少 ⌈m/2⌉
  txt(f, '② 其他 node 至少 ⌈m/2⌉ 個 child（m = order）');
  say('至少要有 ⌈m/2⌉ 個 child', 'm 叫做 order（一個 node 最多幾個 child）');
  await step(tok);                                    // 68:41 order 3 的例子
  const o3 = note('order 3：root ≥ 2，其他 ≥ ⌈3/2⌉ = 2', -3.6, 7.0);
  say('例：order 3 → m = 3', 'root 至少 2 個；其他 node 至少 ⌈3/2⌉ = 2 個 child');
  await step(tok);                                    // 69:15 fail node 同一層
  B.lv2[1].forEach((m) => glow(m, null));
  B.strip.material.opacity = 0.4;
  txt(f, '③ 所有 fail node 都在同一個 level');
  say('條件三：所有 fail node 都在同一個 level', '樹永遠是平的');
  await step(tok);                                    // 69:31 看這個例子
  B.strip.material.opacity = 0.16; remove(o3);
  txt(f, '這棵 B-tree 的 order 是多少？');
  say('來看這個 B-tree 的例子', '它的 order 是多少？');
  await step(tok);                                    // 70:05 pointer 1 2 3 4 → order 4
  B.ptrs.forEach(([x, y], i) => tag(String(i + 1), 'ptr alt', x - 0.25, y - 0.45));
  txt(f, 'root 有 4 個 pointer → order 4');
  say('數 pointer：1、2、3、4', 'order 是 4');
  await step(tok);                                    // 70:15 最下面一層
  B.leaf.forEach((m) => glow(m, GOLD));
  say('最下面這些 node（leaf）', 'fail node 都在同一個 level');
  await step(tok);                                    // 70:21 其他 node ≥ 2
  B.leaf.forEach((m) => glow(m, null)); B.lv2[1].forEach((m) => glow(m, GREEN));
  txt(f, '其他 node 至少 ⌈4/2⌉ = 2 個 pointer');
  say('其他 node 至少 ⌈4/2⌉ = 2 個 pointer', '中間這一層都符合');
}]);

// 70:37 B-tree 搜尋 30
FRAG.push(['bst63-btree-search30', 'B-tree 搜尋 30', async (tok) => {
  fresh([0, 3.2, 13], [0, 3, 0]);
  const B = btree63();
  await step(tok);                                    // 70:37 搜尋 30
  const s = seeker(30, 3.6, 6.4, 0.5);
  say('在這棵 order 4 的 B-tree 搜尋 30', '它存不存在？');
  await step(tok);                                    // 71:00 root：21、48、72 都不是
  for (const k of [21, 48, 72]) { glow(B.keys[k], GOLD); await hopOver(tok, s, B.keys[k], 450, 0.45); glow(B.keys[k], null); }
  say('從 root 開始：21、48、72', '沒有一個是 30');
  await step(tok);                                    // 71:11 落在 21 ~ 48
  glow(B.keys[21], GOLD); glow(B.keys[48], GOLD);
  await hop63(tok, s, -0.55, 6.25, 500);
  await hop63(tok, s, -1.8, 4.25, 800);
  glow(B.keys[21], null); glow(B.keys[48], null);
  say('30 落在 21 和 48 之間', '往中間那個 pointer 走下去');
  await step(tok);                                    // 71:24 25、31、41
  for (const k of [25, 31, 41]) { glow(B.keys[k], GOLD); await hopOver(tok, s, B.keys[k], 450, 0.45); glow(B.keys[k], null); }
  say('到了 25、31、41 這個 node', '先看有沒有相同的');
  await step(tok);                                    // 71:32 落在 25 ~ 31
  glow(B.keys[25], GOLD); glow(B.keys[31], GOLD);
  await hop63(tok, s, -2.35, 4.25, 500);
  await hop63(tok, s, -2.7, 2.25, 800);
  glow(B.keys[25], null); glow(B.keys[31], null);
  say('沒有相同：30 落在 25 和 31 之間', '往下走');
  await step(tok);                                    // 71:39 找不到
  glow(B.leaf[0], RED); s.mood('sad');
  await hop63(tok, s, -2.7, 0.75, 700);
  noT('找不到 30', -2.7, -0.4);
  say('這個 node 只有 26：30 不在', '再往下就是 fail node → 回報找不到');
}]);

// 71:55 為什麼用 B-tree
FRAG.push(['bst63-btree-fat', '為什麼用 B-tree：矮胖＝少讀 disk', async (tok) => {
  fresh([0, 3, 13], [0, 3, 0]);
  const chain = [];
  await step(tok);                                    // 71:56 binary tree 太高
  await anim(tok, 1400, (u) => {
    const k = Math.min(7, Math.round(u * 7));
    while (chain.length < k) { const d = chain.length, x = -5 + (d % 2) * 1.2, y = 6 - d * 0.95; if (d) line(-5 + ((d - 1) % 2) * 1.2, y + 0.95, x, y); chain.push(cube('', B63, [0.6, 0.5, 0.6], x, y, 0)); }
  });
  tag('⋮', 'ptr', -4.4, -0.4);
  say('只用 binary tree：每個 node 只有 2 個 child', '數字一多，樹就很高');
  await step(tok);                                    // 72:10 AVL 也一樣
  note('AVL：balanced，但還是很高', -4.4, 6.9);
  say('AVL 雖然 balanced', '數字太多時，高度還是很高 → 影響 performance');
  await step(tok);                                    // 72:27 長胖
  const root = [21, 48, 72].map((k, i) => cube(k, B63, [1, 0.7, 0.9], 2.6 + (i - 1) * 1.1, 5.6, 0, 2));
  [-0.6, 1.6, 3.6, 5.8].forEach((x) => { line(2.6, 5.2, x, 3.4); cube('', '#9b7ef4', [1.8, 0.6, 0.9], x, 3.0, 0, 2); });
  say('與其又高又瘦，不如讓樹長胖', 'm-way / B-tree：又矮又胖');
  await step(tok);                                    // 72:51 disk 檔案結構
  const dk = buddy('disk', '', '#8a94a6', 5.6, 0.0, 0.6, 0.8);
  okT('很快就到 leaf', 2.6, 1.6);
  say('disk 的 file structure 常用 B-tree、B+ tree', '因為很快就能到達 leaf node');
  await step(tok);                                    // 73:16 每個 node = 一個 disk block
  const rg = ghostBox('#c58a10', 3.8, 1.1, 1.3); rg.position.set(2.6, 5.6, 0);
  const pg = pkt('一個 page', 5.6, 1.2);
  await travel(tok, pg, V3(5.6, 1.2, 0.6), V3(2.6, 6.5, 0.6), 1200);
  dk.mood('happy');
  say('每個 node 就是一個 disk block（page）', '每次抓一整個 page 到 memory');
  await step(tok);                                    // 73:36 node 內要比的變多
  remove(pg);
  dk.mood('wow');
  note('代價：一個 node 裡要比的 key 變多', 2.6, 7.2);
  say('問題：樹雖然矮了', '每個 node 裡要比較的數字變多');
  await step(tok);                                    // 74:21 用 binary search
  const x = buddy(null, 30, O63, 2.6, 6.4, 0.6, 0.5);
  say('所以 node 內不是一個一個比', '是用 binary search 比');
  await step(tok);                                    // 74:30 先跟中間比
  glow(root[1], GOLD);
  say('binary search：先拿中間的 48 比', '30 < 48');
  await step(tok);                                    // 74:35 決定 range
  glow(root[1], null); glow(root[0], GOLD);
  await hop63(tok, x, 2.05, 6.0, 700);
  say('再跟 21 比：30 > 21', '決定落在 21 ~ 48 這個 range');
  await step(tok);                                    // 74:45 search 回顧
  glow(root[0], null);
  await hop63(tok, x, 1.6, 3.5, 800); x.mood('happy');
  say('B-tree search：從 root 一路往下', '直到找到，或到 leaf 回報 fail');
}]);

// 75:09 B-tree insert / delete 概念
FRAG.push(['bst63-btree-split-merge', 'B-tree insert 溢位 split、delete 不足 merge', async (tok) => {
  fresh([0, 3, 12], [0, 2.8, 0]);
  const ks = {};
  const place = (keys, cx, y) => keys.forEach((k, i) => { const x = cx + (i - (keys.length - 1) / 2) * 1.05; if (ks[k]) move(ks[k], x, y, 0); else ks[k] = cube(k, B63, [0.95, 0.7, 0.9], x, y, 0); });
  place([10, 20, 40, 50], 0, 2);
  tag('（示意）一個 node 最多 5 個 key', 'idx', 0, 0.8);
  let s = null;
  await step(tok);                                    // 75:09 insert：先 find
  s = seeker(30, 0, 5.6, 0.55, 'insert');
  say('B-tree insert：前面跟 BST 一樣', '先 find：看這個數字存不存在');
  await step(tok);                                    // 75:28 找到該放的 node
  await hop63(tok, s, 0.5, 2.5, 900);
  say('不存在 → 找到它該放的 leaf', '放到對的位置');
  await step(tok);                                    // 76:00 沒滿就放
  kill(s.g);
  ks[30] = cube(30, O63, [0.95, 0.7, 0.9], 0, 2, 0, 2);
  place([10, 20, 30, 40, 50], 0, 2);
  say('leaf 還沒滿：直接放上去', '');
  await step(tok);                                    // 76:08 已經滿了，塞第 6 個
  ks[35] = cube(35, O63, [0.95, 0.7, 0.9], 0, 4.4, 0);
  await beat(tok, 500);
  place([10, 20, 30, 35, 40, 50], 0, 2);
  [10, 20, 30, 35, 40, 50].forEach((k) => glow(ks[k], RED));
  say('滿了怎麼辦？最多 5 個，又塞第 6 個', 'overflow！');
  await step(tok);                                    // 76:14 split
  [10, 20, 30, 35, 40, 50].forEach((k) => glow(ks[k], null));
  place([30], 0, 4.8); place([10, 20], -3, 2); place([35, 40, 50], 2.5, 2);
  const l1 = line(-0.3, 4.45, -3, 2.35), l2 = line(0.3, 4.45, 2.5, 2.35);
  say('split：拆成兩個 node', '中間的 key 推到上一層');
  await step(tok);                                    // 76:22 上層 index 調整
  glow(ks[30], GOLD);
  say('上面的 index 也要跟著調整', '');
  await step(tok);                                    // 76:27 delete：先 find
  glow(ks[30], null);
  fly(ks[20]); delete ks[20];
  say('delete：一樣先找這個數字在不在', '找到就殺掉它（刪 20）');
  await step(tok);                                    // 76:55 檢查 ⌈m/2⌉
  glow(ks[10], RED);
  say('刪完要檢查 B-tree 的性質', '至少要有 ⌈m/2⌉ 個 child → 太少了（underflow）');
  await step(tok);                                    // 77:10 merge
  glow(ks[10], null); kill(l1); kill(l2);
  place([10, 30, 35, 40, 50], 0, 2);
  say('不符合 → 跟別人合併（merge）', '');
  await step(tok);                                    // 77:27 overflow / 太少
  okT('insert 太多 → split', -3.2, 4.6); okT('delete 太少 → merge', 3.2, 4.6);
  say('insert 可能 overflow → split', 'delete 可能太少 → merge；細節用 2-3 tree 例子講');
  await step(tok);                                    // 77:43 complexity ≈ 樹高
  note('時間 ≈ 樹的高度', 0, 6.2);
  say('這些操作的 complexity', '大致跟樹的高度差不多');
  await step(tok);                                    // 77:51 m 32～256
  note('disk 上 m 通常 32 ～ 256', 0, 5.5);
  say('實作在 disk 上', 'm 通常介於 32 到 256');
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
  st.at = {};
  for (const o of lay63(spec)) {
    st.at[o.n] = o;
    o.k.forEach((v, i) => {
      const x = o.x + (i - (o.k.length - 1) / 2) * 1.0; seen.add(v);
      if (st.cubes[v]) move(st.cubes[v], x, o.y, 0); else st.cubes[v] = cube(v, B63, [0.9, 0.7, 0.9], x, o.y, 0, drop ? 2 : 0);
    });
    if (!o.k.length) st.deco.push(cube('', GRAY, [0.9, 0.2, 0.9], o.x, o.y, 0));
    st.deco.push(tag(o.n, 'idx', o.x - Math.max(1, o.k.length) * 0.5 - 0.4, o.y + 0.1));
    if (o.par) st.deco.push(line(o.par.x, o.par.y - 0.35, o.x, o.y + 0.35));
  }
  for (const v of Object.keys(st.cubes)) if (!seen.has(+v)) { fly(st.cubes[v]); delete st.cubes[v]; }
}
const glowK63 = (st, ks, c) => ks.forEach((k) => { if (st.cubes[k]) glow(st.cubes[k], c); });
// the seeker stands a little above the node, so the number it carries never prints over the node's keys
const toNode = (tok, b, st, n, ms = 700) => hop63(tok, b, st.at[n].x, st.at[n].y + 0.7, ms);
const DEL0 = { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60, 70] }, { n: 'D', k: [90, 95] }] };

// 78:17 2-3 tree 與 search
FRAG.push(['bst63-23-search', '2-3 tree：B-tree order 3 與三向搜尋', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  await step(tok);                                    // 78:17 order 4 / order 3
  note('order 4 → 2-3-4 tree', -3.4, 6.8); note('order 3 → 2-3 tree', 3.4, 6.8);
  say('B-tree order 4 叫 2-3-4 tree', 'order 3 叫 2-3 tree');
  await step(tok);                                    // 78:36 都是 B-tree
  okT('兩個都是 B-tree', 0, 7.5);
  say('2-3 tree 和 2-3-4 tree 都是 B-tree', 'B-tree 是很 general 的名字');
  await step(tok);                                    // 78:49 2-3 tree 例子
  show63(st, DEL0, true);
  say('這是一棵 2-3 tree（m = 3）', '');
  await step(tok);                                    // 78:57 root 有兩個以上 child
  glowK63(st, [50, 80], GOLD);
  say('檢查：root 至少兩個 child', '有，它有三個');
  await step(tok);                                    // 79:04 每個 node ≥ 2 pointer
  glowK63(st, [50, 80], null); glowK63(st, [10, 20, 60, 70, 90, 95], GOLD);
  say('其他 node 至少 ⌈3/2⌉ = 2 個 pointer', '每個都符合');
  await step(tok);                                    // 79:22 高度
  glowK63(st, [10, 20, 60, 70, 90, 95], null);
  note('n 個 key：log₃(n+1) ≤ h ≤ log₂(n+1)', 0, -0.2);
  say('n 個 key 的 2-3 tree 高度', '介於 log₃(n+1) 和 log₂(n+1) 之間');
  await step(tok);                                    // 79:38 怎麼搜尋
  const s = seeker(15, -6.2, 5.4, 0.5);
  say('2-3 tree 怎麼搜尋？很簡單', 'node 裡只有兩個 key，跟它們比');
  await step(tok);                                    // 79:56 比第一個小 → 左
  await toNode(tok, s, st, 'A', 600); glowK63(st, [50], GOLD);
  await toNode(tok, s, st, 'B', 700);
  say('x 比第一個 key 小：走最左邊的 pointer', '例：15 < 50 → 往左');
  await step(tok);                                    // 80:05 中間 → 中間
  glowK63(st, [50], null); s.set(70);
  await toNode(tok, s, st, 'A', 600); glowK63(st, [50, 80], GOLD);
  await toNode(tok, s, st, 'C', 700);
  say('x 介於兩個 key 之間：走中間', '例：50 < 70 < 80 → 中間');
  await step(tok);                                    // 80:10 大於第二個 → 右
  glowK63(st, [50, 80], null); s.set(95);
  await toNode(tok, s, st, 'A', 600); glowK63(st, [80], GOLD);
  await toNode(tok, s, st, 'D', 700);
  say('x 比第二個 key 大：走右邊', '例：95 > 80 → 往右（投影片把 x 打成 X）');
  await step(tok);                                    // 80:40 三個 case + 相同
  glowK63(st, [80], null); glowK63(st, [95], GREEN); s.mood('happy');
  okT('相同 → 找到', 4.0, 2.4);
  say('search function：左、中、右三個 case', '再加上相同時回報找到');
}]);

const INS0 = { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [80] }] };
const INS3 = { n: 'A', k: [20, 40], c: [{ n: 'B', k: [10] }, { n: 'D', k: [30] }, { n: 'C', k: [70, 80] }] };
// 81:11 2-3 tree insert 70、30
FRAG.push(['bst63-23-insert-70-30', '2-3 tree insert 70、insert 30（split）', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, INS0, false);
  const rule = [];
  let s = null;
  await step(tok);                                    // 81:11 先找位置
  s = seeker('x', -6.2, 5.4, 0.5, 'insert');
  say('insert：先用 search function 找位置', '');
  await step(tok);                                    // 81:25 已存在就不用插
  note('已經在樹裡 → 不用 insert', 0, 7.4);
  say('如果 key 已經在樹裡', '根本不用 insert');
  await step(tok);                                    // 81:49 leaf 叫 u
  const u = tag('u', 'ptr alt', st.at.C.x + 1.0, st.at.C.y + 0.6);
  say('要插入的數字會落在某個 leaf', '這個 leaf node 叫 u');
  await step(tok);                                    // 82:06 case 1
  rule.push(note('u 只有 1 個 key → 直接塞進去', -3.6, -0.4));
  say('情況一：u 只有 1 個 key', '把值塞進去就結束');
  await step(tok);                                    // 82:24 case 2
  rule.push(note('u 已有 2 個 → 滿了 → split', 3.4, -0.4));
  say('情況二：u 已經有 2 個 key', '再塞就滿了 → split');
  await step(tok);                                    // 82:43 新 node 放最大
  rule.push(pkt('最大 → 新 node', -4.0, -1.2));
  say('split 規則：產生一個新 node', '放三個數字裡最大的');
  await step(tok);                                    // 83:02 中間 → parent
  rule.push(pkt('中間 → parent', 0, -1.2));
  say('中間那個 key（middle key）', '推到 u 的 parent');
  await step(tok);                                    // 83:09 最小留在 u
  rule.push(pkt('最小 → 留在 u', 4.0, -1.2));
  say('最小的', '留在原來的 node u');
  await step(tok);                                    // 83:21 insert 70
  remove(u); rule.forEach(remove);
  s.set(70);
  await toNode(tok, s, st, 'A', 600); glowK63(st, [40], GOLD);
  await toNode(tok, s, st, 'C', 700);
  say('insert 70：70 > 40', '往 C 走');
  await step(tok);                                    // 83:31 直接放
  glowK63(st, [40], null); kill(s.g);
  show63(st, { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [70, 80] }] }, true);
  say('C 只有 80，還有一個空位', '70 直接放進去');
  await step(tok);                                    // 83:50 insert 30
  s = seeker(30, -6.2, 5.4, 0.5, 'insert');
  await toNode(tok, s, st, 'A', 600); glowK63(st, [40], GOLD);
  await toNode(tok, s, st, 'B', 700);
  say('insert 30：30 < 40', '從 A 走到 B');
  await step(tok);                                    // 84:02 B 已滿
  glowK63(st, [40], null); glowK63(st, [10, 20], RED);
  say('B 已經放了 10、20', '滿了');
  await step(tok);                                    // 84:21 split，新 node D
  kill(s.g);
  show63(st, { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20, 30] }, { n: 'C', k: [70, 80] }] }, true);
  glowK63(st, [10, 20, 30], RED);
  say('30 放不進去 → B 要 split', '會產生一個新 node，叫 D');
  await step(tok);                                    // 84:38 最大 30 → D
  glowK63(st, [10, 20, 30], null);
  show63(st, { n: 'A', k: [40], c: [{ n: 'B', k: [10, 20] }, { n: 'D', k: [30] }, { n: 'C', k: [70, 80] }] }, false);
  glowK63(st, [30], GOLD);
  say('10、20、30 裡最大的 30', '放進新 node D');
  await step(tok);                                    // 84:48 中位數 20 → parent
  glowK63(st, [30], null);
  show63(st, INS3, false); glowK63(st, [20], GOLD);
  say('中位數 20', '推到 parent A：A = 20, 40');
  await step(tok);                                    // 84:55 10 留在 B
  glowK63(st, [20], null); glowK63(st, [10], GOLD);
  say('最小的 10', '留在原來的 node B');
  await step(tok);                                    // 85:09 結果
  glowK63(st, [10], null);
  okT('只多了一個 node D', 0, 7.4);
  say('結果長這樣', '只是多了一個 node D：滿了就 split');
}]);

// 85:33 insert 60：連鎖 split
FRAG.push(['bst63-23-insert-60', '2-3 tree insert 60：連鎖 split', async (tok) => {
  fresh([0, 3, 12.5], [0, 2.8, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, INS3, false);
  const B = { n: 'B', k: [10] }, D = { n: 'D', k: [30] };
  await step(tok);                                    // 85:33 insert 60 → C
  const s = seeker(60, -6.2, 5.4, 0.5, 'insert');
  await toNode(tok, s, st, 'A', 600); glowK63(st, [40], GOLD);
  await toNode(tok, s, st, 'C', 700);
  say('insert 60：從 A 往 40 的右邊走', '到 C');
  await step(tok);                                    // 85:42 C 滿了
  glowK63(st, [40], null); kill(s.g);
  show63(st, { n: 'A', k: [20, 40], c: [B, D, { n: 'C', k: [60, 70, 80] }] }, true);
  glowK63(st, [60, 70, 80], RED);
  say('C 是 70、80：塞 60 進去就滿了', '要 split');
  await step(tok);                                    // 86:04 80 → 新 node E
  glowK63(st, [60, 70, 80], null);
  show63(st, { n: 'A', k: [20, 40], c: [B, D, { n: 'C', k: [60, 70] }, { n: 'E', k: [80] }] }, false);
  glowK63(st, [80], GOLD);
  say('split C：最大的 80 → 新 node E', '60 留在 C');
  await step(tok);                                    // 86:16 70 往上
  glowK63(st, [80], null);
  show63(st, { n: 'A', k: [20, 40, 70], c: [B, D, { n: 'C', k: [60] }, { n: 'E', k: [80] }] }, false);
  glowK63(st, [70], GOLD);
  say('中間的 70 往上送', '送進 A（20、40）');
  await step(tok);                                    // 86:25 A 又爆了
  glowK63(st, [70], null); glowK63(st, [20, 40, 70], RED);
  say('A 變成 20、40、70', 'A 又爆了！');
  await step(tok);                                    // 86:34 再 split
  glowK63(st, [20, 40, 70], null);
  glowK63(st, [20], '#17396a'); glowK63(st, [40], GOLD); glowK63(st, [70], O63);
  say('只好再 split 一次', '20 留下、40 往上、70 到新 node');
  await step(tok);                                    // 86:44 F 是新 node
  glowK63(st, [20, 40, 70], null);
  show63(st, { n: 'G', k: [40], c: [{ n: 'A', k: [20], c: [B, D] }, { n: 'F', k: [70], c: [{ n: 'C', k: [60] }, { n: 'E', k: [80] }] }] }, false);
  glowK63(st, [70], GOLD);
  say('70 到新 node F', 'A 是舊的 node，只剩 20');
  await step(tok);                                    // 86:52 40 拉到新 root G
  glowK63(st, [70], null); glowK63(st, [40], GOLD);
  say('40 被拉到更新的 node：G', 'G 成為新的 root，樹長高一層');
  await step(tok);                                    // 87:02 連鎖反應
  okT('兩次 split：連鎖反應', 0, 7.5);
  say('兩次 split：連鎖反應', '往上推，上面又滿，就再 split');
  await step(tok);                                    // 87:19 E、F、G
  glowK63(st, [40], null);
  ['E', 'F', 'G'].forEach((n, i) => { const o = st.at[n]; st.deco.push(tag((i + 1) + '', 'ptr alt', o.x + 0.9, o.y + 0.6)); });
  say('split 產生的新 node 依序是 E、F、G', '2-3 tree 是往上長的');
}]);

// 87:29 2-3 tree delete
FRAG.push(['bst63-23-delete', '2-3 tree delete：rotate 與 combine', async (tok) => {
  fresh([0, 3, 12], [0, 3.2, 0]);
  const st = { cubes: {}, deco: [] };
  show63(st, DEL0, false);
  let s = null;
  await step(tok);                                    // 87:29 delete
  say('2-3 tree 的 deletion', '一樣先找到要刪的 key');
  await step(tok);                                    // 87:39 delete 70
  s = seeker(70, -6.2, 5.4, 0.5, 'delete');
  say('例：delete 70', '');
  await step(tok);                                    // 87:47 落在 50 ~ 80 → C，刪掉
  await toNode(tok, s, st, 'A', 600); glowK63(st, [50, 80], GOLD);
  await toNode(tok, s, st, 'C', 700);
  glowK63(st, [50, 80], null); kill(s.g);
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60] }, { n: 'D', k: [90, 95] }] }, false);
  say('70 落在 50 和 80 之間 → 走到 C', '找到 70，殺掉它');
  await step(tok);                                    // 87:59 再 delete 90
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [60] }, { n: 'D', k: [95] }] }, false);
  say('接著 delete 90', '（回去自己推一次）');
  await step(tok);                                    // 88:06 沒事
  okT('D 還有 95：沒事', st.at.D.x, st.at.D.y - 0.9);
  say('D 還剩 95', '沒事');
  await step(tok);                                    // 88:18 delete 60
  show63(st, { n: 'A', k: [50, 80], c: [{ n: 'B', k: [10, 20] }, { n: 'C', k: [] }, { n: 'D', k: [95] }] }, false);
  say('接下來 delete 60', '');
  await step(tok);                                    // 88:48 C 空了
  const em = noT('C 空了！', st.at.C.x, st.at.C.y - 0.8);
  say('60 刪掉後，C 這個 node 空了', '要做調整');
  await step(tok);                                    // 88:57 rotate
  remove(em);
  bub('rotate：旋轉一下', 0, 7.4);
  glowK63(st, [10, 20], GOLD);
  say('左兄弟 B 有兩個 key → 可以 rotate', '旋轉一下');
  await step(tok);                                    // 89:09 50 下來、20 上去
  glowK63(st, [10, 20], null);
  show63(st, { n: 'A', k: [20, 80], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50] }, { n: 'D', k: [95] }] }, false);
  glowK63(st, [50, 20], GOLD);
  say('像搓湯圓：parent 的 50 搓下來給 C', '兄弟的 20 丟上去給 parent');
  await step(tok);                                    // 89:35 不動 pointer
  glowK63(st, [50, 20], null);
  note('只讓 key 在 node 之間轉，pointer 不動', 0, -0.4);
  say('重點：盡量不去動 pointer', '只讓 key 在 node 間旋轉，維持 2-3 tree 的性質');
  await step(tok);                                    // 89:51 也會有 combine
  say('delete 也會遇到 combine', '');
  await step(tok);                                    // 90:01 delete 95 → D 空了
  show63(st, { n: 'A', k: [20, 80], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50] }, { n: 'D', k: [] }] }, false);
  say('例：把 95 delete 掉', 'D 空了，兄弟 C 只有一個 key → 不能 rotate');
  await step(tok);                                    // 90:12 combine
  show63(st, { n: 'A', k: [20], c: [{ n: 'B', k: [10] }, { n: 'C', k: [50, 80] }] }, false);
  glowK63(st, [80], GOLD);
  say('combine：80 拉下來跟 C 合併', 'D 被拿掉，A 只剩 20');
}]);
  }

  // ═══ bsta.js ═══
  {
// ─── cvooTtquDlQ（BST 定義與 size 9 / depth 3 範例）＋ 9Jry5-82I68（MIT 6.006 L5：BST、跑道預約、augmentation） ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; beats are motion only.
const { V3, fresh, tag, cube, move, fly, kill, glow, relabel, txt, code, line, arrow, ghostBox, lnode, icon, travel, remove, buddy, prop, bob, anim, step, GOLD, GREEN, RED, GRAY } = K;
const BLUE = '#17396a', PTR = '#d8c29b', NS = [0.9, 0.9, 0.9];
const cap = (a, b = '') => say(a, b);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const cls = (l, c) => { l.element.className = 'lab-label ' + c; };
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

// ── the module's own BST drawing (inorder x, depth y), driven one sentence at a time ──
function bsv(seq, o = {}) {
  fresh([0, 4.6, 13.5], [0, 3.7, 0]);
  const t = makeView(Object.assign({ tag: 'none' }, o));
  seq.forEach((k) => attach(t, mk(k)));
  layout(t, true);
  bst.t = t; bst.cur = makeCursor();
  return t;
}
const nd = (t, k) => findKey(t, k);
const ng = (n, c) => { if (n && n.body) glow(n.body.obj, c); };
const ringN = (t, k) => cursorTo(bst.cur, nd(t, k).pos);
function grow(t, k) { const z = attach(t, mk(k)); layout(t); dropIn(z); return z; }
const above = (n, dy = 0.95) => n.pos.clone().add(V3(0, dy, 0.5));
async function hover(tok, l, n, ms = 500) { await travel(tok, l, l.position.clone(), above(n), ms); }
// subtree-size numbers written next to the nodes (only the ones the lecturer has said so far)
function paint(t, SZ) {
  for (const n of inorder(t.root)) {
    const s = SZ.get(n.key);
    n.tag.element.textContent = s === undefined ? '' : String(s);
    n.tag.element.className = 'lab-label ' + (s === undefined ? 'idx' : 'note');
    n.tag.element.style.display = s === undefined ? 'none' : '';
  }
}

// ══════════ cvooTtquDlQ ══════════
// 00:00 node 的三個欄位
FRAG.push(['bsta-node-struct', 'BST 的 node：value + left + right', async (tok) => {
  fresh([0, 5, 12], [0, 2.4, 0]);
  await step(tok);                                   // 0:00 composed of zero or more nodes
  const pile = [];
  for (let i = 0; i < 4; i++) pile.push(cube('', colorFor(i + 1), [0.7, 0.5, 0.7], -5.4 + i * 0.95, 5.6, 0, 2));
  const pl = bub('BST：0 個或更多個 node', -4, 6.8);
  cap('BST 是由 node 組成的', '0 個或更多個');
  await step(tok);                                   // 0:36 each node contains a value
  pile.forEach(kill); kill(pl);
  const A = buddy('node A', '', colorFor(1), 0, 3.0, 0, 1);
  const vt = tag('value', 'idx', 0, 2.75, 0.8);
  cap('每個 node 第一格：value', '');
  await step(tok);                                   // 0:47 value = any sort of data item
  const d = pkt('A', -5, 1.4, 0.6);
  bub('數字、文字…什麼資料都可以', -4.6, 2.4);
  await travel(tok, d, V3(-5, 1.4, 0.6), V3(0, 3.3, 0.6), 900);
  remove(d); A.set('A'); A.mood('happy');
  cap('value：存任何一種資料', 'node A 的 value = A');
  await step(tok);                                   // 0:53 a pointer to the left child
  const L = cube('left', PTR, [1.1, 0.7, 0.9], -1.5, 3.35, 0, 2);
  A.look(-1);
  cap('第二格：指向左子的指標', 'left');
  await step(tok);                                   // 1:01 may be NULL
  const n1 = note('NULL', -3.2, 1.8);
  const a1 = arrow(V3(-1.8, 3.0, 0), V3(-3.0, 2.1, 0), 0x9a3a2a);
  cap('左子可以是 NULL', 'NULL = 沒有指向任何 node');
  await step(tok);                                   // 1:15 a pointer to the right child
  const R = cube('right', PTR, [1.1, 0.7, 0.9], 1.5, 3.35, 0, 2);
  A.look(1);
  cap('第三格：指向右子的指標', 'right');
  await step(tok);                                   // 1:22 may be NULL too
  const n2 = note('NULL', 3.2, 1.8);
  const a2 = arrow(V3(1.8, 3.0, 0), V3(3.0, 2.1, 0), 0x9a3a2a);
  cap('右子也可以是 NULL', '');
  await step(tok);                                   // 1:33 A is a node
  A.look(0); A.mood('wow');
  const g = ghostBox(GOLD, 4.4, 1.6, 1.4); g.position.set(0, 3.5, 0);
  bub('一個 node = left ｜ value ｜ right', 0, 5.0);
  cap('node A：三個欄位一組', 'left + value + right');
  await step(tok);                                   // 1:42 left pointer → left child
  kill(n1); kill(a1); glow(L, GOLD);
  const B = buddy('B', 'B', colorFor(2), -3.6, -0.2, 0, 0.7);
  arrow(V3(-1.8, 3.0, 0), V3(-3.3, 0.9, 0));
  cap('left 指向左子 B', 'B 自己也是一個 node');
  await step(tok);                                   // 1:50 right pointer → right child
  glow(L, null); glow(R, GOLD); kill(n2); kill(a2);
  const C = buddy('C', 'C', colorFor(3), 3.6, -0.2, 0, 0.7);
  const a3 = arrow(V3(1.8, 3.0, 0), V3(3.3, 0.9, 0));
  cap('right 指向右子 C', '');
  await step(tok);                                   // 2:01 the child may or may not have a value
  glow(R, null);
  await travel(tok, C.g, C.g.position.clone(), V3(6.5, 4.5, 0), 700);
  kill(C.g); kill(a3);
  note('NULL', 3.2, 1.8); arrow(V3(1.8, 3.0, 0), V3(3.0, 2.1, 0), 0x9a3a2a);
  B.mood('happy'); A.mood('calm');
  cap('子節點可能有，也可能沒有', '左邊有 B，右邊是 NULL');
}]);

// 02:07 空樹、root、唯一路徑、leaf
FRAG.push(['bsta-root-leaf', 'root、唯一路徑與 leaf node', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 2:08 a binary tree may be empty
  const e = ghostBox(GRAY, 3, 1.6, 2); e.position.set(0, 4, 0);
  const el = bub('空樹：0 個 node', 0, 5.4);
  cap('binary tree 可以是空的', '0 個 node 也算一棵樹');
  await step(tok);                                   // 2:35 if non-empty it has some nodes
  kill(e); kill(el);
  const { N, P } = bsTree(T9, 3);
  cap('不是空的，就有一些 node', '');
  await step(tok);                                   // 2:42 the starting node is the root
  tag('root', 'ptr alt', 0, 7.3);
  glow(N[8], GOLD);
  cap('最上面的起點叫 root', 'root = 8');
  await step(tok);                                   // 3:00 every node reachable by a unique path
  const r = bsRing();
  for (const v of [8, 3, 6, 7]) { ringTo(r, P[v]); glow(N[v], GOLD); await beat(tok, 350); }
  cap('從 root 到 7 只有一條路', '8 → 3 → 6 → 7');
  await step(tok);                                   // 3:14 whatever node you take
  for (const v of [3, 6, 7]) glow(N[v], null);
  for (const v of [8, 10, 14, 13]) { ringTo(r, P[v]); glow(N[v], GOLD); await beat(tok, 350); }
  cap('任何 node 都一樣：路徑唯一', '8 → 10 → 14 → 13');
  await step(tok);                                   // 3:22 neither left nor right child → leaf
  r.visible = false;
  for (const v of [8, 10, 14, 13]) glow(N[v], null);
  bub('leaf：沒有左子、也沒有右子', 4.2, 7.0);
  cap('兩個子都沒有的 node 叫 leaf', '');
  await step(tok);                                   // 3:58 here no left, no right → leaf
  for (const v of [1, 4]) { glow(N[v], GREEN); tag('leaf', 'good', P[v][0], P[v][1] - 0.9); }
  cap('1、4 底下什麼都沒有 → leaf', '');
  await step(tok);                                   // 4:03 these are also leaf nodes
  for (const v of [7, 13]) { glow(N[v], GREEN); tag('leaf', 'good', P[v][0], P[v][1] - 0.9); }
  cap('7、13 也是 leaf', 'leaf：1、4、7、13');
  await step(tok);                                   // 4:09 and this is a root node
  glow(N[8], GOLD);
  cap('最上面是 root，最下面是 leaf', 'root = 8');
}]);

// 04:37 BST 性質：左子樹 < x < 右子樹
FRAG.push(['bsta-property', 'BST 性質：左小右大（整棵子樹）', async (tok) => {
  fresh([0, 5, 13.5], [0, 3.6, 0]);
  await step(tok);                                   // 4:37 for all nodes x and y
  const { N, P } = bsTree(T9);
  const xt = tag('x', 'ptr alt', 0, 7.2);
  cap('性質：對所有 node x、y 都要成立', '');
  await step(tok);                                   // 4:43 y belongs to the left subtree of x
  const gl = ghostBox(GREEN, 5.4, 5.6, 1.4); gl.position.set(-2.9, 3.5, 0);
  const yt = tag('y', 'ptr', -1.4, 3.9);
  cap('y 在 x 的左子樹裡', '左子樹 = 左邊整串');
  await step(tok);                                   // 5:08 key(y) < key(x)
  for (const v of [3, 1, 6, 4, 7]) { glow(N[v], GREEN); await beat(tok, 250); }
  const n1 = note('6 < 8', -1.4, 2.1, 0.6);
  cap('y 的 key 一定比 x 小', 'y ∈ left(x) ⇒ key(y) < key(x)');
  await step(tok);                                   // 5:44 less value left side, greater right side
  const s = pkt('5', 0, 8.2), b = pkt('12', 0, 8.2);
  await Promise.all([travel(tok, s, V3(0, 8.2, 0), V3(-4.6, 6.6, 0), 900), travel(tok, b, V3(0, 8.2, 0), V3(4.6, 6.6, 0), 900)]);
  bub('小的 ← 左　右 → 大的', 0, 8.3);
  cap('小的放左邊，大的放右邊', '');
  await step(tok);                                   // 6:06 if y belongs to the right subtree
  remove(s); remove(b); kill(n1);
  const gr = ghostBox(BLUE, 3.4, 4.0, 1.4); gr.position.set(3.7, 3.0, 0);
  yt.position.set(4.6, 3.9, 0);
  cap('換 y 在 x 的右子樹裡', '');
  await step(tok);                                   // 6:15 key(y) > key(x)
  for (const v of [10, 14, 13]) { glow(N[v], BLUE); await beat(tok, 250); }
  note('14 > 8', 4.6, 2.1, 0.6);
  cap('y 的 key 一定比 x 大', 'y ∈ right(x) ⇒ key(y) > key(x)');
  await step(tok);                                   // 6:35 these two properties must hold (every node)
  kill(gl); kill(gr); remove(yt);
  Object.values(N).forEach((m) => glow(m, null));
  xt.position.set(-3, 5.6, 0);
  glow(N[3], GOLD); glow(N[1], GREEN);
  for (const v of [6, 4, 7]) glow(N[v], BLUE);
  bub('x = 3：1 < 3 < 4、6、7', -3, 7.6);
  cap('每個 node 都要遵守這兩條', '換 x = 3 也成立');
  await step(tok);                                   // 7:00 nodes less than root go left
  Object.values(N).forEach((m) => glow(m, null));
  const p = pkt('5', 0, 7.2);
  for (const [v, w] of [[8, '5 < 8 → 左'], [3, '5 > 3 → 右'], [6, '5 < 6 → 左']]) {
    await travel(tok, p, p.position.clone(), V3(P[v][0] + 0.9, P[v][1] + 0.5, 0.5), 500);
    glow(N[v], GOLD);
  }
  cap('插入時：比它小往左、比它大往右', '5：8 左 → 3 右 → 6 左');
}]);

// 07:21 範例：size 9、depth 3、root 8、leaves 1, 4, 7, 13
FRAG.push(['bsta-size9', '造一棵 size 9、depth 3 的 BST', async (tok) => {
  fresh([0, 5, 14], [0, 3.8, 0]);
  const P = {}, N = {};
  let cd;
  const put = async (v, w) => {
    const [, x, y, p] = T9.find((s) => s[0] === v);
    const k = pkt(String(v), -5.2, 8.2, 0.4);
    await travel(tok, k, V3(-5.2, 8.2, 0.4), V3(x, y + 0.9, 0.4), 700);
    remove(k);
    if (p !== undefined) line(P[p][0], P[p][1], x, y);
    N[v] = cube(v, colorFor(v), NS, x, y, 0, 1.5); P[v] = [x, y];
    cap('放 ' + v, w);
  };
  await step(tok);                                   // 7:21 a BST of size 9
  cd = code(['size = 9', 'depth = 3', 'root = 8', 'leaves = 1, 4, 7, 13'], -5.2, 8.6, 0.5);
  cd.ls.forEach((l, i) => { if (i) l.element.style.visibility = 'hidden'; });
  cd.hl(0);
  cap('題目：造一棵 size 9 的 BST', '還有幾個條件');
  await step(tok);                                   // 7:38 depth 3, root 8
  cd.ls[1].element.style.visibility = ''; cd.ls[2].element.style.visibility = '';
  cd.hl(2);
  cap('depth 3、root 是 8', '');
  await step(tok);                                   // 7:46 leaves are 1, 4, 7, 13
  cd.ls[3].element.style.visibility = '';
  cd.hl(3);
  cap('leaf 必須是 1、4、7、13', '');
  await step(tok);                                   // 8:00 size 9 = total 9 nodes
  cd.hl(0);
  const dots = [];
  for (let i = 0; i < 9; i++) dots.push(cube('', GRAY, [0.4, 0.4, 0.4], -3.2 + i * 0.8, 0.0, 1.2, 1.5 + i * 0.2));
  cap('size 9 = 一共 9 個 node', '');
  await step(tok);                                   // 8:05 depth 3: levels 0, 1, 2, 3
  dots.forEach(kill);
  cd.hl(1);
  [0, 1, 2, 3].forEach((d) => tag('depth ' + d, 'idx', 6.3, 6.2 - d * 1.6));
  cap('depth 3：層數 0、1、2、3', '');
  await step(tok);                                   // 8:21 leaves have no left and right child
  cd.hl(3);
  cap('1、4、7、13 不能有左右子', '');
  await step(tok);                                   // 8:29 8 is the root
  cd.hl(2);
  await put(8, 'root = 8');
  await step(tok);                                   // 8:34 left must be less than 8 → 3
  cd.hl(-1);
  await put(3, '3 < 8 → 左');
  await step(tok);                                   // 8:44 right greater → 10
  await put(10, '10 > 8 → 右');
  await step(tok);                                   // 8:53 1 is less than 3 → left
  await put(1, '1 < 3 → 3 的左邊');
  await step(tok);                                   // 9:01 right side 6
  await put(6, '6 > 3 → 3 的右邊');
  await step(tok);                                   // 9:09 1 is a leaf: don't extend
  glow(N[1], GREEN); tag('leaf', 'good', P[1][0], P[1][1] - 0.9);
  cap('1 是 leaf：不再往下長', '');
  await step(tok);                                   // 9:15 4 < 6 → left
  await put(4, '4 < 6 → 6 的左邊（leaf）');
  await step(tok);                                   // 9:24 7 > 6 → right ; 1, 4, 7 are leaves
  await put(7, '7 > 6 → 6 的右邊（leaf）');
  for (const v of [4, 7]) { glow(N[v], GREEN); tag('leaf', 'good', P[v][0], P[v][1] - 0.9); }
  await step(tok);                                   // 9:32 14 > 10
  await put(14, '14 > 10 → 10 的右邊');
  await step(tok);                                   // 9:40 13 < 14
  await put(13, '13 < 14 → 14 的左邊（leaf）');
  glow(N[13], GREEN); tag('leaf', 'good', P[13][0], P[13][1] - 0.9);
  await step(tok);                                   // 9:51 level 0, 1, 2, 3
  for (const lv of [[8], [3, 10], [1, 6, 14], [4, 7, 13]]) { lv.forEach((v) => glow(N[v], GOLD)); await beat(tok, 450); lv.forEach((v) => glow(N[v], [1, 4, 7, 13].includes(v) ? GREEN : null)); }
  cap('第 0 層 → 第 3 層', '8 在第 0 層，13 在第 3 層');
  await step(tok);                                   // 9:58 depth = distance from the root
  cd.hl(1);
  const r = bsRing();
  const cnt = note('0 步', 5.6, 7.4);
  let k = 0;
  for (const v of [8, 10, 14, 13]) { ringTo(r, P[v]); txt(cnt, k++ + ' 步'); await beat(tok, 450); }
  cap('depth = 離 root 的距離', '8 → 13 走 3 步 → depth 3');
  await step(tok);                                   // 10:15 size = number of nodes
  r.visible = false; cd.hl(0);
  let c = 0;
  const sc = note('size = 0', -5.4, 3.8);
  for (const [v] of T9) { c++; glow(N[v], GOLD); txt(sc, 'size = ' + c); await beat(tok, 180); }
  cap('size = node 的個數', '1、2、…、9');
  await step(tok);                                   // 10:32 the size is 9
  for (const [v] of T9) glow(N[v], [1, 4, 7, 13].includes(v) ? GREEN : null);
  cls(sc, 'good');
  cap('size = 9 ✓', '四個條件都滿足');
  await step(tok);                                   // 10:39 the property you follow
  cd.hl(-1);
  bub('一路照「左小右大」放下去', 0, 8.1);
  cap('建 BST：一直遵守左小右大', '');
}]);

// ══════════ 9Jry5-82I68（MIT 6.006 L5） ══════════
const tx = (t) => (t - 46) * 0.55;
function timeline() {
  line(-6.8, 0, 6.6, 0, 0, '#7a6a52');
  for (const t of [36, 40, 44, 48, 52, 56]) { line(tx(t), -0.15, tx(t), 0.15); tag(String(t), 'idx', tx(t), -0.5, 0.6); }
}
const RSZ = [0.62, 0.62, 0.62];
// 00:22 BST 與跑道預約問題
FRAG.push(['bsta-runway-def', '跑道預約系統：要做什麼', async (tok) => {
  fresh([0, 4.2, 11], [0, 1.2, 0]);
  await step(tok);                                   // 0:22 today: binary search tree
  const t1 = bub('今天：Binary Search Tree（BST）', 0, 3.6);
  cap('今天的主角：BST', 'binary search tree');
  await step(tok);                                   // 0:34 binary search: divide and conquer
  const row = [3, 8, 12, 20, 31, 40, 52].map((v, i) => cube(v, colorFor(v), [0.8, 0.6, 0.8], -3.6 + i * 1.2, 1.4));
  glow(row[3], GOLD);
  const t2 = note('binary search：每次看中間、砍一半', 0, 0.4, 0.6);
  cap('binary search：分而治之', 'BST 就是它的資料結構版');
  await step(tok);                                   // 1:04 runway reservation system
  kill(t1); kill(t2); row.forEach(kill);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(13.4, 0.05, 1.1), new THREE.MeshStandardMaterial({ color: '#cfcac0', roughness: 1 }));
  rw.position.set(-0.1, -0.05, -0.9); lab.world.add(rw);
  const plane = icon('✈️', '', -6.2, 3.2, -0.9, 'sm');
  bub('跑道預約系統', -3.6, 3.6);
  cap('用一個問題帶出 BST：跑道預約', '');
  await step(tok);                                   // 1:53 an airport with a single runway
  tag('只有一條跑道', 'zone', 3.8, 0.1, -1.6);
  cap('機場只有一條跑道', '');
  await step(tok);                                   // 2:04 Logan has six runways, weather → one
  const lg = note('Logan 有 6 條；天氣一差只剩 1 條', 2.6, 2.6);
  cap('就算有很多條，天氣差也只剩一條', '');
  await step(tok);                                   // 2:15 safety: constraints to obey
  kill(lg);
  const p2 = icon('✈️', '', -4.6, 3.0, -0.9, 'sm');
  const dz = bad('兩架太近 → 危險！', -5.2, 2.0);
  cap('安全：兩架飛機不能太靠近', '要把限制寫進資料結構');
  await step(tok);                                   // 2:43 reservations for future landings, time
  kill(p2); kill(dz);
  timeline();
  tag('time →', 'idx', 6.2, 0.6);
  cap('預約的是「未來」的降落時間', '');
  await step(tok);                                   // 2:50 time is continuous (a real number)
  const rn = note('時間是實數：41.2 也可以', 3.4, 2.4);
  cap('時間是連續的實數', '');
  await step(tok);                                   // 3:20 each request specifies a landing time t
  kill(rn);
  const q = cube('t', GRAY, RSZ, tx(53), 2.4, 0, 0);
  cap('每個請求：一個降落時間 t', '');
  await step(tok);                                   // 3:26 add t to R if none within k minutes
  const R = {};
  for (const t of [41.2, 49, 56.3]) R[t] = cube(t, colorFor(Math.round(t)), RSZ, tx(t), 0.35, 0, 3);
  tag('R', 'ptr', tx(49), 1.3);
  const w = ghostBox(GOLD, 6 * 0.55, 1.4, 1.2); w.position.set(tx(53), 0.7, 0);
  cap('前後 k 分鐘內沒別班 → 加進 R', 'R = 已排定的降落時間');
  await step(tok);                                   // 3:52 k is a parameter (3, or 4, weather)
  await anim(tok, 900, (u) => { w.scale.x = 1 + (8 / 6 - 1) * Math.sin(u * Math.PI); });
  cap('k 是參數：3 或 4，看天氣調', '');
  await step(tok);                                   // 4:16 today k = 3
  tag('k = 3', 'ptr alt', tx(53), 2.0 + 1.2);
  cap('今天的例子都用 k = 3 分鐘', '');
  await step(tok);                                   // 4:28 an insert with a constraint
  kill(w); move(q, tx(53), 0.35, 0); glow(q, GREEN);
  cap('檢查通過 → insert(t)', '');
  await step(tok);                                   // 4:34 violated → don't insert
  const q2 = cube(50, GRAY, RSZ, tx(50), 2.4, 0); glow(q2, RED);
  bad('離 49 太近 ✗', tx(50), 3.2);
  cap('違反限制 → 不插入', '50 離 49 不到 3');
  await step(tok);                                   // 4:49 current notion of time
  fly(q2);
  const now = tag('now', 'ptr alt', tx(37), 1.3);
  cap('系統裡有「現在時間」', '');
  await step(tok);                                   // 4:58 plane landed → remove from R
  await travel(tok, plane, plane.position.clone(), V3(tx(41.2), 0.9, -0.9), 900);
  fly(R[41.2]);
  bub('delete(41.2)', tx(41.2), 2.6);
  cap('飛機降落了 → 從 R 刪掉', 'delete');
  await step(tok);                                   // 5:23 as time increments, check
  await travel(tok, now, now.position.clone(), V3(tx(42.5), 1.3, 0), 800);
  cap('時間往前走，定期檢查 R', '');
  await step(tok);                                   // 5:38 all operations O(log n)
  good('insert / delete：都要 O(log n)', 0, 3.8);
  cap('目標：每個操作都 O(log n)', '');
  await step(tok);                                   // 5:59 n = size of the set
  note('n = |R|（R 裡有幾個）', 0, 2.9);
  cap('n 是集合 R 的大小', '');
}]);

// 06:16 例子：now = 37，R = {41.2, 49, 56.3}
FRAG.push(['bsta-runway-ex', '例子：53 可以、44 不行、20 不行', async (tok) => {
  fresh([0, 4.2, 11], [0, 1.2, 0]);
  await step(tok);                                   // 6:16 a straightforward example
  timeline();
  cap('來看一個例子', '');
  await step(tok);                                   // 6:32 right now we are at time 37
  const now = tag('now = 37', 'ptr alt', tx(37), 1.4);
  cap('現在時間 37', '');
  await step(tok);                                   // 6:37 R has 41.2, 49 and 53
  const R = {};
  for (const t of [41.2, 49, 53]) R[t] = cube(t, colorFor(Math.round(t)), RSZ, tx(t), 0.35, 0, 3);
  cap('R = {41.2, 49, 53}…', '');
  await step(tok);                                   // 6:55 I want to call this 56.3
  R[56.3] = R[53];
  relabel(R[56.3], 56.3); move(R[56.3], tx(56.3), 0.35, 0);
  note('口誤更正：53 → 56.3', tx(56.3) - 0.8, 2.0);
  cap('更正：R = {41.2, 49, 56.3}', '');
  await step(tok);                                   // 7:01 request 53, now is 37 → future
  const a = cube(53, GRAY, RSZ, tx(53), 2.8, 0);
  cap('要求 53：在 37 之後 → 是未來 ✓', '');
  await step(tok);                                   // 7:11 k = 3
  const w = ghostBox(GOLD, 6 * 0.55, 1.4, 1.2); w.position.set(tx(53), 0.7, 0);
  cap('k = 3：53 前後 3 分鐘', '50 ~ 56');
  await step(tok);                                   // 7:15 4 ahead of 49, 3.3 before 56.3 → OK
  glow(R[49], GOLD); glow(R[56.3], GOLD);
  note('差 4', tx(51), 1.9); note('差 3.3', tx(54.6), 1.9);
  move(a, tx(53), 0.35, 0); kill(w);
  await beat(tok, 500);
  glow(a, GREEN); glow(R[49], null); glow(R[56.3], null);
  cap('53：離 49 差 4、離 56.3 差 3.3', '都 ≥ 3 → 接受');
  await step(tok);                                   // 7:24 44 too close to 41.2
  const b = cube(44, GRAY, RSZ, tx(44), 2.8, 0);
  const w2 = ghostBox(RED, 6 * 0.55, 1.4, 1.2); w2.position.set(tx(44), 0.7, 0);
  glow(R[41.2], RED); glow(b, RED);
  bad('離 41.2 只差 2.8 ✗', tx(44), 3.6);
  cap('44：離 41.2 只差 2.8', '< 3 → 拒絕');
  await step(tok);                                   // 7:38 20 not allowed: it's passed
  fly(b); kill(w2); glow(R[41.2], null);
  const c = cube(20, GRAY, RSZ, -6.4, 2.8, 0); glow(c, RED);
  bad('20 < now ✗', -6.0, 3.6);
  cap('20：已經過去了，不能排', '');
  await step(tok);                                   // 7:46 time is monotonically increasing
  fly(c);
  arrow(V3(-5.6, -1.1, 0), V3(6.0, -1.1, 0), 0xa8730f);
  note('時間只會往前（用 64-bit 數字）', 0, -1.6);
  cap('假設時間只增不減', '');
}]);

// 08:12 unsorted array
FRAG.push(['bsta-unsorted', 'Unsorted array：插入 O(1)、檢查 O(n)', async (tok) => {
  fresh([0, 5, 11], [0, 1, 0]);
  const vals = [49, 56.3, 41.2], M = [];
  let cand;
  await step(tok);                                   // 8:12 shoot down each known data structure
  cand = ['unsorted array', 'sorted array', 'sorted list', 'heap'].map((s, i) => bub(s, -4.8 + i * 3.2, 4.2));
  cap('把學過的資料結構一個一個試', '看它們哪裡不夠快');
  await step(tok);                                   // 8:41 an unsorted list or array for R
  cls(cand[0], 'ptr alt');
  vals.forEach((v, i) => { M.push(cube(v, colorFor(Math.round(v)), [1.4, 0.8, 1.2], -3 + i * 1.6, 0.4, 0, 2)); tag('[' + (i + 1) + ']', 'idx', -3 + i * 1.6, -0.4, 0.9); });
  note('數字為示意', -3, 1.7);
  cap('R 存成沒排序的 array', '');
  await step(tok);                                   // 8:55 everything is linear
  const st = buddy('同學', '', '#9fc5e8', 5.0, 0, 0, 0.7); st.mood('wow');
  bub('幾乎都是線性時間！', 5.0, 2.0);
  cap('同學：幾乎每件事都是線性', '');
  await step(tok);                                   // 9:08 you can insert: just add to it
  const n = cube(53, GRAY, [1.4, 0.8, 1.2], 1.8, 0.4, 0, 3); tag('[4]', 'idx', 1.8, -0.4, 0.9);
  good('insert：接在最後 O(1)', 1.8, 2.2);
  cap('insert：直接接在最後', '這步是常數時間');
  await step(tok);                                   // 9:20 unsorted: no idea where they are
  glow(n, GOLD);
  for (let i = 0; i < M.length; i++) { glow(M[i], GOLD); await beat(tok, 350); glow(M[i], null); }
  cap('k 分鐘檢查：不知道誰離 53 近', '只能整個掃一遍');
  await step(tok);                                   // 9:39 order n
  glow(n, null);
  bad('k 檢查：O(n)', -1.4, 2.2);
  cap('掃整個 array → O(n)', '');
  await step(tok);                                   // 9:54 sadly the check takes order n
  cand[0].element.textContent = 'unsorted array ✗'; cls(cand[0], 'bad');
  st.mood('happy');
  cap('insert O(1) 沒用：檢查要 O(n)', '淘汰');
}]);

// 10:15 sorted array：binary search + shift
FRAG.push(['bsta-sorted-array', 'Sorted array：找位置 O(log n)、插入要 shift', async (tok) => {
  fresh([0, 5, 12], [0, 1.4, 0]);
  const A = [4, 20, 32, 37, 45], X = (i) => -5 + i * 2.2, M = [];
  let t, rows = [];
  const row = (i, s, c = 'say') => { if (rows[i]) kill(rows[i]); rows[i] = tag(s, c, -3.2, 5.0 - i * 0.7); };
  await step(tok);                                   // 10:15 sorted array
  bub('候選二：sorted array', 3.6, 5.0);
  cap('換 sorted array 試試', '');
  await step(tok);                                   // 10:33 binary search
  const st = buddy('同學', '', '#9fc5e8', 5.6, 2.2, 0, 0.6); st.mood('wow');
  bub('用 binary search！', 5.6, 3.6);
  cap('同學：可以 binary search', '');
  await step(tok);                                   // 10:47 4, 20, 32, 37, 45
  A.forEach((v, i) => { M.push(cube(v, colorFor(v), [1.4, 0.8, 1.2], X(i), 0.4, 0, 2)); tag(String(i + 1), 'idx', X(i), -0.4, 0.9); });
  cap('sorted array：4, 20, 32, 37, 45', '由小到大');
  await step(tok);                                   // 11:02 time t = 34
  t = cube(34, GRAY, [1.2, 0.8, 1.0], X(2), 2.6);
  cap('新的時間 t = 34', '');
  await step(tok);                                   // 11:07 go to the midpoint: 34 > 32
  glow(M[2], GOLD);
  note('34 > 32', X(2), 1.5, 0.7);
  cap('先看中間 32：34 比較大', '');
  await step(tok);                                   // 11:26 move to the right
  for (const i of [0, 1, 2]) glow(M[i], '#333333');
  move(t, X(3.5), 2.6);
  cap('所以往右半邊找', '左半邊直接不看');
  await step(tok);                                   // 11:31 the insertion point
  for (const i of [0, 1, 2]) glow(M[i], null);
  move(t, (X(2) + X(3)) / 2, 2.6);
  arrow(V3((X(2) + X(3)) / 2, 2.0, 0), V3((X(2) + X(3)) / 2, 1.0, 0), 0xa8730f);
  cap('找到插入點：32 和 37 之間', 'log n 步就找到');
  await step(tok);                                   // 11:44 look left and right: k-minute check
  glow(M[2], GOLD); glow(M[3], GOLD);
  cap('看左右鄰居 32、37 做 k 檢查', '');
  await step(tok);                                   // 12:08 log n for the search
  glow(M[2], null); glow(M[3], null);
  row(0, '找位置：O(log n)');
  cap('同學：找位置 O(log n)', '');
  await step(tok);                                   // 12:13 constant for the comparison
  row(1, '比鄰居：O(1)');
  cap('比較左右鄰居 O(1)', '');
  await step(tok);                                   // 12:20 insertion is constant?
  row(2, '插入：O(1)？');
  cap('插入也是 O(1)？', '老師：大家同意嗎？');
  await step(tok);                                   // 12:51 you have to shift every element over
  move(M[4], X(5), 0.4); await beat(tok, 450);
  move(M[3], X(4), 0.4); await beat(tok, 450);
  move(t, X(3), 0.4);
  tag('6', 'idx', X(5), -0.4, 0.9);
  st.mood('happy');
  cap('不對：要把後面的全部往右搬', '37、45 都得移一格');
  await step(tok);                                   // 13:25 smallest i with R[i] ≥ t, O(log n)
  row(0, '找最小的 i 使 R[i] ≥ t：O(log n)', 'good');
  cap('精確說：找最小的 i，R[i] ≥ t', 'binary search，O(log n)');
  await step(tok);                                   // 13:49 compare R[i], R[i−1] in O(1)
  row(1, '比 R[i−1]、R[i]：O(1)', 'good');
  cap('比較 R[i−1] 和 R[i]：O(1)', '');
  await step(tok);                                   // 14:10 the actual insertion: shifting O(n)
  row(2, '插入要 shift：O(n)', 'bad');
  cap('真正插入要 shift：最壞 O(n)', '差一點點就成功');
}]);

// 14:38 sorted list
FRAG.push(['bsta-sorted-list', 'Sorted list：插入 O(1)、但不能 binary search', async (tok) => {
  fresh([0, 5.5, 11], [0, 0.6, 0.6]);
  const A = [4, 20, 32, 37, 45], X = (i) => -5.6 + i * 2.5, G = [], AR = [];
  await step(tok);                                   // 14:38 a sorted list
  bub('候選三：sorted list', 0, 3.6);
  cap('那 sorted list 呢？', '');
  await step(tok);                                   // 14:50 a bunch of pointers
  A.forEach((v, i) => { G.push(lnode(v, X(i), 0.35)); if (i) AR.push(arrow(V3(X(i - 1) + 0.95, 0.35, 0), V3(X(i) - 0.5, 0.35, 0))); });
  cap('list：一格一格用指標串起來', '4 → 20 → 32 → 37 → 45');
  await step(tok);                                   // 15:05 insert by moving pointers in O(1)
  lnode(34, (X(2) + X(3)) / 2, 0.35, 2.4, GRAY);
  kill(AR[1]);
  arrow(V3(X(2) + 0.95, 0.35, 0.3), V3((X(2) + X(3)) / 2 - 0.5, 0.35, 2.1));
  arrow(V3((X(2) + X(3)) / 2 + 0.95, 0.35, 2.1), V3(X(3) - 0.5, 0.35, 0.3));
  good('找到位置後：改兩個指標 O(1)', 0, 2.6, 1.2);
  cap('找到位置後，改指標就插好', 'O(1)');
  await step(tok);                                   // 15:18 what's the problem?
  const st = buddy('同學', '', '#9fc5e8', 5.6, 1.6, -1.6, 0.6); st.mood('wow');
  cap('那問題在哪？', '');
  await step(tok);                                   // 15:21 you can't do binary search
  const p = pkt('找 34', X(0), 1.6, 0);
  for (let i = 1; i <= 2; i++) await travel(tok, p, p.position.clone(), V3(X(i), 1.6, 0), 500);
  cap('不能 binary search', '只能從頭一格一格走');
  await step(tok);                                   // 15:26 no random access to index n/2
  bad('不能直接跳到第 n/2 格', -2.5, 3.0);
  cap('list 沒有 random access', '跳不到中間 → 找位置要 O(n)');
  await step(tok);                                   // 15:36 the list does one thing right
  note('list：插入 ✓　搜尋 ✗', -3.6, -1.0, 1.0);
  cap('list 只做對一半：會插入', '');
  await step(tok);                                   // 15:41 the array does the other thing right
  note('array：搜尋 ✓　插入 ✗', 2.6, -1.0, 1.0);
  cap('array 做對另一半：會搜尋', '');
  await step(tok);                                   // 15:48 motivate the BST
  st.mood('happy');
  bub('BST：兩件事都要做到', 0, 4.4);
  cap('這就是 BST 要解決的事', '');
}]);

// 16:02 heap 的 invariant 太弱
FRAG.push(['bsta-heap', 'Min-heap：插入 25 不會檢查到 23 那邊', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.0, 0]);
  const P = { a: [0, 5.6], b: [-2.6, 4], c: [2.6, 4], d: [-3.9, 2.4], e: [-1.3, 2.4], f: [1.3, 2.4] };
  let N, n, arr;
  await step(tok);                                   // 16:03 heaps: talked about last time
  line(...P.a, ...P.b); line(...P.a, ...P.c); line(...P.b, ...P.d); line(...P.b, ...P.e);
  N = { 21: cube(21, colorFor(21), NS, ...P.a, 0, 2), 23: cube(23, colorFor(23), NS, ...P.b, 0, 2), 30: cube(30, colorFor(30), NS, ...P.c, 0, 2),
    24: cube(24, colorFor(24), NS, ...P.d, 0, 2), 28: cube(28, colorFor(28), NS, ...P.e, 0, 2) };
  tag('24、28 為示意', 'idx', -2.6, 1.4);
  cap('候選四：heap（上一講）', '');
  await step(tok);                                   // 16:12 heaps are arrays, seen as trees
  arr = [21, 23, 30, 24, 28].map((v, i) => cube(v, colorFor(v), [0.7, 0.5, 0.7], -3 + i * 0.8, 0.2, 0.8));
  tag('其實是 array', 'idx', -4.4, 0.2, 0.8);
  cap('heap 其實是 array，只是畫成樹', '');
  await step(tok);                                   // 16:37 a fairly weak invariant
  bub('規則很弱：只管 parent ≤ children', 3.6, 6.8);
  cap('heap 的 invariant 很弱', '');
  await step(tok);                                   // 17:04 the min element has to be the root
  glow(N[21], GOLD);
  good('min 在 root：O(1)', 0, 6.7);
  cap('只保證最小值在 root', '拿 min 很快');
  await step(tok);                                   // 17:18 k-minute check → O(n)
  glow(N[21], null);
  bad('找 t 附近 k 以內的：O(n)', 4.0, 2.4);
  cap('但 k 分鐘檢查要 O(n)', '');
  await step(tok);                                   // 17:46 dictionaries: same problem
  note('dictionary（hash table）也一樣，下週講', 3.4, 1.4);
  cap('dictionary 也有同樣問題', '');
  await step(tok);                                   // 18:47 min heap: 21 < 23 and 30
  for (const v of [21, 23, 30]) glow(N[v], GOLD);
  cap('min-heap：21 ≤ 23、21 ≤ 30', '一層一層往下都一樣');
  await step(tok);                                   // 19:07 insert 25
  for (const v of [21, 23, 30]) glow(N[v], null);
  const p = pkt('insert 25', 5.4, 5.6);
  cap('同學問：為什麼要 O(n)？', '老師：insert 25 看看');
  await step(tok);                                   // 19:23 adds to the end
  remove(p);
  line(...P.c, ...P.f);
  n = cube(25, GRAY, NS, ...P.f, 0, 3);
  arr.push(cube(25, GRAY, [0.7, 0.5, 0.7], 1.0, 0.2, 0.8, 2));
  cap('先接在最後一格', '');
  await step(tok);                                   // 19:34 start flipping
  glow(n, GOLD); glow(N[30], GOLD);
  move(n, ...P.c); move(N[30], ...P.f);
  move(arr[5], -1.4, 0.2, 0.8); move(arr[2], 1.0, 0.2, 0.8);   // the array view swaps too: 21 23 25 24 28 30
  cap('25 < 30 → 往上交換', '');
  await step(tok);                                   // 19:48 a legitimate min heap
  glow(N[30], null); glow(N[21], GREEN);
  cap('21 ≤ 25 → 停，仍是 min-heap', '');
  await step(tok);                                   // 19:52 never check the left part, 23
  glow(N[21], null); glow(n, null);
  for (const v of [23, 24, 28]) glow(N[v], RED);
  bad('|25 − 24| < 3，卻沒被看到', -2.6, 6.6);
  cap('23 那一邊從頭到尾沒看過', '插入時沒辦法順便檢查');
  await step(tok);                                   // 20:20 would require O(n)
  bad('要檢查只能全部掃：O(n)', 4.0, 1.4);
  cap('想檢查只能另外掃全部', 'O(n)');
  await step(tok);                                   // 20:35 we're stuck
  for (const v of [23, 24, 28]) glow(N[v], null);
  bub('目前沒有誰能全部 O(log n)', 0, 7.6);
  cap('卡住了：沒有一個全都 O(log n)', '');
  await step(tok);                                   // 20:52 fast insertion into a sorted array
  good('sorted array + 快速插入 = BST', 0, 0.9, 1.5);
  cap('sorted array 最接近', '只差「插入要快」');
}]);

// 21:17 BST 的結構與 invariant
FRAG.push(['bsta-invariant-30', 'BST invariant：30 的左右子樹', async (tok) => {
  fresh([0, 5, 12.5], [0, 3.4, 0]);
  let N, P, xt;
  await step(tok);                                   // 21:17 BSTs enable binary search + fast insertion
  const b1 = bub('BST：能 binary search，也能快速插入', 0, 7.4);
  cap('BST：sorted array 做不到的它可以', '');
  await step(tok);                                   // 21:31 a nice invariant
  const b2 = note('invariant = 永遠要成立的規則', -3.6, 6.6);
  cap('BST 也有一條 invariant', '');
  await step(tok);                                   // 21:43 stronger than the heap invariant
  const b3 = note('比 heap 的規則強', 3.6, 6.6);
  cap('它比 heap 的規則更強', '');
  await step(tok);                                   // 21:49 different, for this problem better
  cap('不一定處處更好，但這題更好', '');
  await step(tok);                                   // 22:02 one example of a BST
  kill(b1); kill(b2); kill(b3);
  ({ N, P } = bsTree([[30, 0, 5.8], [17, -2.6, 4.2, 30], [40, 2.6, 4.2, 30], [14, -3.9, 2.4, 17], [20, -1.3, 2.4, 17]], 3));
  note('40 為示意', 2.6, 3.2);
  cap('一棵 BST 的例子', 'root 30');
  await step(tok);                                   // 22:19 each node has a key
  glow(N[30], GOLD); glow(N[17], GOLD);
  tag('key', 'idx', 0.9, 6.5); tag('key', 'idx', -1.7, 4.9);
  cap('每個 node 有一個 key', '30、17 都是 key');
  await step(tok);                                   // 22:36 a tree that has pointers, unlike a heap
  glow(N[30], null); glow(N[17], null);
  note('heap = array　BST = 真的用指標串', 3.8, 1.6);
  cap('BST 是真的用指標連的樹', 'heap 只是 array 畫成樹');
  await step(tok);                                   // 22:55 the pointers: parent of x
  glow(N[17], GOLD);
  arrow(V3(-2.2, 4.7, 0.5), V3(-0.5, 5.5, 0.5), 0x6a4a00);
  tag('parent', 'idx', -1.6, 5.6, 0.5);
  cap('17 有一個指標指回 parent 30', '');
  await step(tok);                                   // 23:14 parent, left child, right child
  arrow(V3(-2.9, 3.7, 0.5), V3(-3.7, 2.9, 0.5)); arrow(V3(-2.3, 3.7, 0.5), V3(-1.5, 2.9, 0.5));
  tag('left', 'idx', -4.0, 3.4, 0.5); tag('right', 'idx', -1.1, 3.4, 0.5);
  cap('每個 node 三個指標', 'parent、left、right');
  await step(tok);                                   // 23:53 for all x: y in the left subtree
  glow(N[17], null);
  xt = tag('x', 'ptr alt', 0, 6.9);
  const gl = ghostBox(GREEN, 4.2, 3.2, 1.4); gl.position.set(-2.6, 3.4, 0);
  cap('對每個 x：看它的左子樹', '');
  await step(tok);                                   // 24:18 key(y) ≤ key(x)
  for (const v of [17, 14, 20]) { glow(N[v], GREEN); await beat(tok, 250); }
  cap('左子樹的 key 都 ≤ x', 'y ∈ left(x) ⇒ key(y) ≤ key(x)');
  await step(tok);                                   // 24:28 y in the right subtree: ≥
  glow(N[40], BLUE);
  cap('右子樹的 key 都 ≥ x', 'y ∈ right(x) ⇒ key(y) ≥ key(x)');
  await step(tok);                                   // 24:42 subtrees: everything underneath
  note('看整棵子樹（heap 只看 children）', -3.4, 0.9);
  cap('是「整棵子樹」，不只子節點', '這就是比 heap 強的地方');
  await step(tok);                                   // 24:58 look right: only greater than 30
  kill(gl);
  Object.values(N).forEach((m) => glow(m, null));
  glow(N[40], BLUE);
  const e1 = pkt('看右邊 → 都 > 30', 2.6, 5.4);
  cap('從 30 往右看：都比 30 大', '');
  await step(tok);                                   // 25:04 look left: only less than 30
  for (const v of [17, 14, 20]) { glow(N[v], GREEN); await beat(tok, 250); }
  const e2 = pkt('← 看左邊都 < 30', -2.6, 5.4);
  cap('往左看，整棵都比 30 小', '');
  await step(tok);                                   // 25:13 true for any intermediate node: 17
  remove(e1); remove(e2);
  Object.values(N).forEach((m) => glow(m, null));
  xt.position.set(-2.6, 5.3, 0);
  glow(N[17], GOLD); glow(N[14], GREEN); glow(N[20], BLUE);
  note('14 < 17 < 20', -2.6, 1.4);
  cap('中間的 17 也要成立', '14 < 17 < 20');
  await step(tok);                                   // 25:29 that's the BST
  good('這就是 BST ✓', 3.2, 6.6);
  cap('這就是 BST 和它的 invariant', '');
}]);

// 25:35 BST insert：49, 79, 46, 41（cued copy of the module's bst-insert）
FRAG.push(['bsta-insert', 'BST 插入：49, 79, 46, 41', async (tok) => {
  let t, p;
  await step(tok);                                   // 25:35 why BSTs could solve it: insert
  t = bsv([]);
  bub('用 BST 來做跑道預約', 0, 7.4);
  cap('看看 BST 怎麼插入', '');
  await step(tok);                                   // 25:55 start with an empty R
  const em = note('R = 空的', 0, 6.0);
  cap('從空的 R 開始', '');
  await step(tok);                                   // 26:08 insert 49: a node with key 49
  kill(em);
  grow(t, 49);
  cap('insert 49：直接當 root', '');
  await step(tok);                                   // 26:19 insert 79: look at 49
  p = pkt('79', 5, 7.6);
  ringN(t, 49);
  await hover(tok, p, nd(t, 49));
  cap('insert 79：先跟 49 比', '');
  await step(tok);                                   // 26:32 79 > 49 → right child
  remove(p); grow(t, 79);
  cap('79 > 49 → 接在右邊', '');
  await step(tok);                                   // 26:37 then insert 46
  p = pkt('46', 5, 7.6);
  hideCursor(bst.cur);
  cap('接著 insert 46', '');
  await step(tok);                                   // 26:49 compare 49 and 46: less → left
  ringN(t, 49);
  await hover(tok, p, nd(t, 49));
  remove(p); grow(t, 46);
  cap('46 < 49 → 接在左邊', '');
  await step(tok);                                   // 26:59 next insert 41
  p = pkt('41', 5, 7.6);
  hideCursor(bst.cur);
  cap('再 insert 41', '');
  await step(tok);                                   // 27:04 k-minute checks: in a second
  note('k 分鐘檢查：等一下再講', 4.6, 3.0);
  cap('先不管 k 分鐘檢查', '等一下講');
  await step(tok);                                   // 27:20 41 < 49 → left
  ringN(t, 49);
  await hover(tok, p, nd(t, 49));
  cap('41 < 49 → 往左', '');
  await step(tok);                                   // 27:25 41 < 46 → left child
  ringN(t, 46);
  await hover(tok, p, nd(t, 46));
  remove(p); grow(t, 41);
  cap('41 < 46 → 接成 46 的左子', '只走一條路徑');
}]);

// 27:31 插入時順便做 k 分鐘檢查（cued copy of the module's runway-k-check）
FRAG.push(['bsta-kcheck', '跑道預約：插入時順便做 k 分鐘檢查', async (tok) => {
  let t, p, gh;
  await step(tok);                                   // 27:31 now the k-minute check
  t = bsv([49, 79, 46, 41]);
  bub('現在加上 k 分鐘檢查', 0, 7.6);
  cap('來看 k 分鐘檢查', '');
  await step(tok);                                   // 27:41 k = 3
  note('k = 3', 4.8, 6.6);
  cap('k = 3', '');
  await step(tok);                                   // 27:47 checks while doing binary search
  bub('一邊找位置、一邊檢查', -4.2, 6.6);
  cap('一邊 binary search，一邊檢查', '');
  await step(tok);                                   // 27:53 compare 42
  p = pkt('42', 5, 7.6);
  cap('要求 42', '');
  await step(tok);                                   // 27:58 with 49: 7 apart → OK
  ringN(t, 49);
  await hover(tok, p, nd(t, 49));
  good('|42 − 49| = 7 ✓', 2.0, 7.0);
  cap('42 vs 49：差 7 ≥ 3 → OK', '');
  await step(tok);                                   // 28:05 less than 49 → left, compare with 46
  ringN(t, 46);
  await hover(tok, p, nd(t, 46));
  cap('42 < 49 → 往左，跟 46 比', '');
  await step(tok);                                   // 28:12 more than 3 away from 46 → OK
  good('|42 − 46| = 4 ✓', -1.2, 6.2);
  cap('42 vs 46：差 4 ≥ 3 → OK', '');
  await step(tok);                                   // 28:18 go left, get to 41
  ringN(t, 41);
  await hover(tok, p, nd(t, 41));
  cap('再往左，遇到 41', '');
  await step(tok);                                   // 28:25 greater, but not k more
  ng(nd(t, 41), RED);
  bad('|42 − 41| = 1 ✗', -3.2, 5.4);
  cap('42 vs 41：只差 1 < 3', '');
  await step(tok);                                   // 28:34 would be putting 42 here
  const a = nd(t, 41).pos;
  gh = ghostBox(RED, 0.8, 0.6, 0.8); gh.position.set(a.x + 0.7, a.y - 1.3, 0);
  tag('42 本來會在這', 'idx', a.x + 0.7, a.y - 2.0);
  cap('沒檢查的話，42 會接在這', '');
  await step(tok);                                   // 28:40 violates the safety → reject
  kill(gh); remove(p);
  bad('拒絕預約 42', 0, 1.0, 1.0);
  cap('違反安全條件 → 不插入', '');
  await step(tok);                                   // 28:50 a sorted array plus pointers
  ng(nd(t, 41), null); hideCursor(bst.cur);
  note('由左到右讀：41 46 49 79（排好序）', 0, 0.2, 1.0);
  cap('BST ≈ 排好序的 array + 指標', '介於 sorted list 和 array 之間');
  await step(tok);                                   // 29:09 attaching the new node to a pointer
  bub('找到位置後：接上指標就好', 4.2, 1.6);
  cap('找到位置，只要接一個指標', '不用搬其他元素');
  await step(tok);                                   // 29:19 h = height of the tree
  tag('h = 樹高 = 3', 'ptr alt', -5.6, 4.6);
  arrow(V3(-6.3, 6.6, 0), V3(-6.3, 3.8, 0), 0xa8730f);
  cap('h = 樹的高度', '');
  await step(tok);                                   // 29:38 with or without the check: O(h)
  good('insert（有沒有檢查）= O(h)', -4.4, 7.4);
  cap('有沒有檢查，insert 都是 O(h)', '');
  await step(tok);                                   // 31:25 the beauty: checks while finding the place
  cap('BST 的好處：找位置時順便檢查', '');
  await step(tok);                                   // 31:33 what about 45?
  p = pkt('45', 5, 7.6);
  cap('同學問：那 45 呢？', '');
  await step(tok);                                   // 31:45 45 < 49, more than 3 away → pass
  ringN(t, 49);
  await hover(tok, p, nd(t, 49));
  cap('45 vs 49：差 4 → 通過，往左', '');
  await step(tok);                                   // 31:58 45 vs 46 → fail right here
  ringN(t, 46);
  await hover(tok, p, nd(t, 46));
  ng(nd(t, 46), RED);
  bad('|45 − 46| = 1 ✗', 1.2, 5.0);
  cap('45 vs 46：只差 1 → 失敗', '');
  await step(tok);                                   // 32:16 just following a path: O(h)
  remove(p); ng(nd(t, 46), null);
  for (const k of [49, 46]) ng(nd(t, k), GOLD);
  cap('只沿一條路徑走 → O(h)', '');
}]);

// 32:46 find 回傳指標、重複 key、平衡問題
FRAG.push(['bsta-find-46', 'find(46)：回傳指向那筆資料的指標', async (tok) => {
  let t, rec, n46;
  await step(tok);                                   // 32:46 vanilla BST: find or insert
  t = bsv([49, 79, 46, 41]);
  bub('一般的 BST：find 或 insert', 0, 7.6);
  cap('一般 BST 做的就是 find、insert', '');
  await step(tok);                                   // 32:58 return the pointer
  note('find → 回傳一個指標', 4.4, 6.6);
  cap('找到了：回傳指向它的指標', '');
  await step(tok);                                   // 33:00 find 46
  ringN(t, 49); await beat(tok, 500); ringN(t, 46);
  n46 = nd(t, 46); ng(n46, GREEN);
  cap('find 46：49 → 往左 → 46', '');
  await step(tok);                                   // 33:08 a record associated with it
  rec = prop('file', -4.6, 1.6, 1.0, 1.0, 'record：46 的資料');
  cap('46 只是 key，背後掛著一筆資料', '');
  await step(tok);                                   // 33:10 a pointer to that record
  arrow(V3(n46.pos.x - 0.4, n46.pos.y - 0.3, 0.5), V3(-4.2, 2.6, 1.0), 0xa8730f);
  note('指標', -2.4, 2.6, 1.0);
  cap('拿到一個指向那筆資料的指標', '');
  await step(tok);                                   // 33:14 you can override
  rec.userData.label.element.textContent = 'record：覆蓋成新資料';
  cap('可以直接覆蓋那筆資料', '');
  await step(tok);                                   // 33:17 duplicates: a multiset
  const d2 = cube(46, colorFor(46), [0.8, 0.6, 0.8], n46.pos.x + 1.1, n46.pos.y, 1.2, 2);
  cap('也可以允許重複：multiset', '同一個 key 出現兩次');
  await step(tok);                                   // 33:26 differentiate 46a, 46b
  tag('46a', 'ptr', n46.pos.x, n46.pos.y + 0.8, 0.5); tag('46b', 'ptr', n46.pos.x + 1.1, n46.pos.y + 0.8, 1.2);
  cap('要能分辨：46a、46b', '');
  await step(tok);                                   // 33:44 not balanced → a problem?
  const st = buddy('同學', '', '#9fc5e8', 5.4, 0.4, 0, 0.7); st.mood('wow');
  bub('樹不平衡怎麼辦？', 5.4, 2.0);
  cap('同學問：樹不平衡會怎樣？', '老師：好問題，先留著');
  await step(tok);                                   // 34:11 I said O(h) — not quite what we want
  bad('目前只有 O(h)，還不是 O(log n)', 0, 0.4, 1.2);
  cap('目前只說了 O(h)', '還不是想要的 O(log n)');
}]);

// 35:05 find min / max / next-larger
FRAG.push(['bsta-minmax-next', 'find min、find max、next-larger(46)', async (tok) => {
  let t;
  await step(tok);                                   // 35:05 many operations in O(h)
  t = bsv([49, 79, 46, 41]);
  bub('很多操作都是 O(h)', 0, 7.6);
  cap('BST 很多操作都是 O(h)', '有些甚至 O(1)');
  await step(tok);                                   // 35:16 min-heap: min is the root, O(1)
  note('min-heap：min 就是 root，O(1)', 4.0, 6.6);
  cap('對照：min-heap 找 min 是 O(1)', '');
  await step(tok);                                   // 35:26 how do you find the min in a BST?
  cap('那 BST 怎麼找 min？', '');
  await step(tok);                                   // 35:34 keep going to the left
  for (const k of [49, 46, 41]) { ringN(t, k); ng(nd(t, k), GOLD); await beat(tok, 450); }
  ng(nd(t, 41), GREEN);
  cap('一直往左走', 'min = 41');
  await step(tok);                                   // 35:39 max: keep going to the right
  for (const k of [49, 46, 41]) ng(nd(t, k), null);
  for (const k of [49, 79]) { ringN(t, k); ng(nd(t, k), GOLD); await beat(tok, 450); }
  ng(nd(t, 79), GREEN);
  cap('max：一直往右走', 'max = 79');
  await step(tok);                                   // 35:47 it's the height: O(h)
  good('走幾步？最多樹高 → O(h)', -4.0, 6.6);
  cap('複雜度就是樹高 O(h)', '');
  await step(tok);                                   // 35:50 go left until you hit a leaf
  for (const k of [49, 79]) ng(nd(t, k), null);
  ringN(t, 41);
  cap('往左走到底就停', 'max 也一樣');
  await step(tok);                                   // 36:09 next larger x
  hideCursor(bst.cur);
  bub('next-larger(x)：比 x 大的下一個', 0, 0.3, 1.2);
  cap('next-larger(x)', '排序後 x 的下一個');
  await step(tok);                                   // 36:21 46 → what's next larger?
  ringN(t, 46); ng(nd(t, 46), GOLD);
  cap('例：next-larger(46) = ？', '');
  await step(tok);                                   // 36:27 it's 49
  ringN(t, 49); ng(nd(t, 49), GREEN);
  cap('答案是 49', '');
  await step(tok);                                   // 36:35 in general O(h)
  good('一般情況也是 O(h)', 4.0, 1.4);
  cap('一般情況也能 O(h) 做到', '');
}]);

// 36:45 augmentation：rank(t) 需求 + 子樹大小 + insert 43
FRAG.push(['bsta-size-aug', 'Augmentation：每個 node 記子樹大小', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.7, 0]);
  const SZ = new Map();
  let t, boss, p;
  await step(tok);                                   // 36:45 augmented BSTs: more data in a node
  bub('augmented BST：node 裡多存一點資料', 0, 6.4);
  cap('augmentation：替 node 加資料', '');
  await step(tok);                                   // 37:32 the specification changed on us
  boss = buddy('老闆', '', '#f4a56a', 5.2, 0.6, 0, 0.8); boss.mood('wow');
  bub('規格又改了！', 5.2, 2.4);
  cap('需求改了（規格常常會變）', '');
  await step(tok);                                   // 37:50 the new requirement: rank(t)
  note('新需求：rank(t)', -4.2, 5.2);
  cap('新需求：算 rank(t)', '');
  await step(tok);                                   // 38:00 how many planes land at times ≤ t
  bub('rank(t) = 降落時間 ≤ t 的有幾班', -3.2, 4.2);
  cap('rank(t) = 有幾班 ≤ t', '');
  await step(tok);                                   // 38:42 don't change the complexity from O(h)
  bad('不能變慢：還是要 O(h)', 3.4, 4.2);
  boss.mood('calm');
  cap('而且不能讓 O(h) 變差', '');
  await step(tok);                                   // 39:07 add information to the node
  cap('在 node 裡多放一個數字', '');
  await step(tok);                                   // 39:45 49, 46
  t = makeView({ tag: 'none' });
  [49, 46].forEach((k) => attach(t, mk(k)));
  layout(t, true); bst.t = t; bst.cur = makeCursor();
  cap('例子：49，底下 46', '');
  await step(tok);                                   // 39:58 over here 79, 64, 83
  for (const k of [79, 64, 83]) grow(t, k);
  cap('右邊：79，底下 64、83', '');
  await step(tok);                                   // 40:16 a number written outside the node
  for (const n of inorder(t.root)) SZ.set(n.key, '?');
  paint(t, SZ);
  cap('每個 node 旁邊多寫一個數', '');
  await step(tok);                                   // 40:44 these are subtree sizes
  note('size = 子樹的 node 數（含自己）', -3.6, 0.4, 1.0);
  cap('這個數 = 子樹大小', '');
  await step(tok);                                   // 40:57 the subtree size here is 1, 1, 1
  for (const k of [46, 64, 83]) { SZ.set(k, 1); ng(nd(t, k), GREEN); }
  paint(t, SZ);
  cap('葉節點 46、64、83：size 1', '只有自己');
  await step(tok);                                   // 41:31 79 is 3
  for (const k of [46, 64, 83]) ng(nd(t, k), null);
  SZ.set(79, 3); paint(t, SZ);
  for (const k of [79, 64, 83]) ng(nd(t, k), GOLD);
  cap('79 的 size = 3', '79、64、83');
  await step(tok);                                   // 41:39 49 is 5
  for (const k of [79, 64, 83]) ng(nd(t, k), null);
  SZ.set(49, 5); paint(t, SZ);
  for (const n of inorder(t.root)) ng(n, GOLD);
  cap('49 的 size = 5', '整棵樹都算');
  await step(tok);                                   // 42:05 insert 43
  for (const n of inorder(t.root)) ng(n, null);
  p = pkt('insert 43', 5, 7.4);
  cap('insert 43 時，size 怎麼改？', '');
  await step(tok);                                   // 42:15 follow the insertion path, +1
  bub('沿插入路徑：經過的 node 都 +1', -3.6, 7.4);
  cap('沿插入路徑，經過的都 +1', '');
  await step(tok);                                   // 42:28 5 plus 1, because you see 49
  ringN(t, 49); await hover(tok, p, nd(t, 49));
  SZ.set(49, 6); paint(t, SZ); ng(nd(t, 49), GOLD);
  cap('經過 49：5 → 6', '');
  await step(tok);                                   // 42:40 then 46: add 1
  ringN(t, 46); await hover(tok, p, nd(t, 46));
  SZ.set(46, 2); paint(t, SZ); ng(nd(t, 46), GOLD);
  cap('經過 46：1 → 2', '');
  await step(tok);                                   // 42:47 add 43: a leaf, size 1
  remove(p); hideCursor(bst.cur);
  grow(t, 43); SZ.set(43, 1); paint(t, SZ);
  cap('43 是新的 leaf：size 1', '');
  await step(tok);                                   // 43:10 with the k check: run regular insert first
  ng(nd(t, 49), null); ng(nd(t, 46), null);
  note('有 k 檢查：先照常 insert，失敗就結束', 3.0, 0.4, 1.0);
  cap('有 k 檢查時：先做一般 insert', '失敗就什麼都不改');
  await step(tok);                                   // 43:25 if it succeeds, increment: O(h)
  for (const k of [49, 46, 43]) ng(nd(t, k), GREEN);
  good('成功了再沿路 +1 → 仍是 O(h)', 3.0, 7.4);
  boss.mood('happy');
  cap('成功才沿路 +1', '整體仍是 O(h)');
}]);

// 44:12 Q&A：刪除 79
FRAG.push(['bsta-del79', '刪除 79：83 補上來、64 接左邊', async (tok) => {
  let t, x;
  await step(tok);                                   // 44:13 delete 79: rewrite the whole BST?
  t = bsv([49, 46, 43, 79, 64, 83]);
  const st = buddy('同學', '', '#9fc5e8', 5.4, 0.4, 0, 0.7); st.mood('wow');
  bub('刪 79 要整棵重建嗎？', 5.0, 2.0);
  cap('同學問：刪掉 79 要重寫整棵嗎？', '');
  await step(tok);                                   // 44:20 bubble up pointers
  x = nd(t, 79);
  ringN(t, 79); ng(x, RED);
  cap('不用：只要搬指標', '');
  await step(tok);                                   // 44:30 83 would come up
  const s = x.right;
  hideCursor(bst.cur);
  transplant(t, x, s);
  lab.flyAway(x.body, V3(0, 8, 5));
  layout(t);
  cap('79 拿掉，83 升上來', '');
  await step(tok);                                   // 44:36 64 to the left
  s.left = x.left; x.left.parent = s;
  layout(t);
  cap('64 接到 83 的左邊', 'BST 性質仍成立');
  await step(tok);                                   // 44:42 move pointers in the case of delete
  st.mood('happy');
  good('只改了幾個指標', 0, 0.6, 1.2);
  cap('刪除也只是搬指標', 'inorder：' + keys(inorder(t.root)));
}]);

// 45:07 rank(79) = 1 + 2 + 1 + 1 = 5
FRAG.push(['bsta-rank79', 'rank(79)：往右走時加自己與左子樹', async (tok) => {
  fresh([0, 4.6, 13.5], [0, 3.7, 0]);
  const SZ = new Map();
  let t, sum = 0, sl, p;
  const add = (k, why) => { sum += k; txt(sl, 'rank = ' + sum); cap(why, 'rank = ' + sum); };
  await step(tok);                                   // 45:11 how to compute rank(t) from subtree sizes?
  bub('怎麼用子樹大小算 rank(t)？', 0, 7.4);
  cap('最後一步：用 size 算 rank(t)', '');
  await step(tok);                                   // 45:17 subtree size: nodes underneath, count yourself
  note('size = 底下的 node 數（記得算自己）', -3.2, 6.6);
  cap('size：底下有幾個，加上自己', '');
  await step(tok);                                   // 45:23 rank(t) = how many ≤ t
  note('rank(t) = ≤ t 的有幾個', 3.6, 6.6);
  cap('rank(t)：有幾班 ≤ t', '');
  await step(tok);                                   // 45:41 the tree after 43: 49(6), 46(2) …
  t = makeView({ tag: 'none' });
  [49, 46, 43, 79, 64, 83].forEach((k) => attach(t, mk(k)));
  layout(t, true); bst.t = t; bst.cur = makeCursor();
  for (const n of inorder(t.root)) SZ.set(n.key, size(n));
  paint(t, SZ);
  cap('插入 43 之後的樹', '49 是 6、46 是 2');
  await step(tok);                                   // 46:07 what lands before t, in O(h)?
  cap('要在 O(h) 內算出來', '');
  await step(tok);                                   // 46:38 student: first find where to insert
  const st = buddy('同學', '', '#9fc5e8', 5.6, 0.2, 0, 0.6); st.mood('wow');
  bub('先找插入位置…', 5.6, 1.6);
  cap('同學：先找 t 的位置', '');
  await step(tok);                                   // 46:56 student: subtract what's on the right
  bub('…再用總數減掉右邊的', 5.0, 2.4);
  cap('再用總數減掉右邊比較大的', '答案對，老師換個方式');
  await step(tok);                                   // 47:23 add up the things we want
  st.mood('happy');
  cap('老師：改成「加」比較小的', '');
  await step(tok);                                   // 47:38 walk down the tree: it's a search
  cap('沿搜尋 t 的路徑往下走', '');
  await step(tok);                                   // 47:43 add 1 + left subtree sizes
  note('key ≤ t：+1（自己）+ 左子樹 size', -3.4, 0.4, 1.0);
  cap('遇到 key ≤ t：加自己和左子樹', '');
  await step(tok);                                   // 49:00 t = 79
  p = pkt('t = 79', 5.0, 7.4);
  sl = note('rank = 0', -5.6, 4.6);
  cap('例：t = 79', 'rank = 0');
  await step(tok);                                   // 49:10 look at 49
  ringN(t, 49); await hover(tok, p, nd(t, 49));
  cap('先看 49', '');
  await step(tok);                                   // 49:22 49 < 79: add 1
  ng(nd(t, 49), GOLD);
  add(1, '49 ≤ 79：+1（49 自己）');
  await step(tok);                                   // 49:30 move to the right
  arrow(V3(nd(t, 49).pos.x + 0.5, nd(t, 49).pos.y - 0.2, 0.4), V3(nd(t, 79).pos.x - 0.4, nd(t, 79).pos.y + 0.3, 0.4), 0xa8730f);
  cap('79 > 49 → 往右走', '');
  await step(tok);                                   // 49:50 add the subtree sizes to the left: 2
  for (const k of [46, 43]) ng(nd(t, k), GREEN);
  add(2, '左邊 46 子樹全都 < 79：+2');
  await step(tok);                                   // 50:14 move right, see 79
  ringN(t, 79); await hover(tok, p, nd(t, 79));
  cap('往右，看到 79', '');
  await step(tok);                                   // 50:26 79 ≤ 79: add 1
  ng(nd(t, 79), GOLD);
  add(1, '79 ≤ 79：+1（79 自己）');
  await step(tok);                                   // 50:37 subtree to the left of 79: 1
  ng(nd(t, 64), GREEN);
  add(1, '79 左邊 64 子樹：+1');
  await step(tok);                                   // 50:50 found the location: matches 79
  hideCursor(bst.cur);
  cap('找到 79 的位置，結束', '');
  await step(tok);                                   // 51:01 if it was 78: same steps
  note('t = 78：路徑一樣，但 79 不算', 3.6, 1.4, 1.0);
  cap('t = 78：步驟差不多', '');
  await step(tok);                                   // 51:13 1 + 2 + 1 + 1 = 5
  remove(p);
  cls(sl, 'good'); txt(sl, 'rank = 1 + 2 + 1 + 1 = 5');
  cap('1 + 2 + 1 + 1 = 5', 'rank(79) = 5，O(h)');
  await step(tok);                                   // 51:23 the correct answer
  for (const k of [43, 46, 49, 64, 79]) ng(nd(t, k), GREEN);
  ng(nd(t, 83), null);
  cap('數數看：43 46 49 64 79', '5 個 ≤ 79 ✓');
}]);

// 51:28 壞消息：依序插入會退化成 list（cued copy of the module's degenerate-path）
FRAG.push(['bsta-degenerate', '依序插入會退化成 list', async (tok) => {
  fresh([0, 4.3, 13.5], [0, 3.8, 0]);
  const seq = [43, 46, 48, 49, 52, 56, 61, 64];
  const small = { size: [0.55, 0.42, 0.55], width: 5.6, maxSp: 0.8, topY: 6.6, minY: 0.4, maxStep: 1.3 };
  const L = makeView(Object.assign({ cx: -3.0 }, small));
  let hl;
  const ins = (k) => { const z = attach(L, mk(k)); layout(L); dropIn(z); txt(hl, 'BST　h = ' + height(L.root)); };
  await step(tok);                                   // 51:28 the bad news
  bub('壞消息：還沒真的解決', 0, 7.6);
  cap('壞消息：問題還沒解決', '');
  await step(tok);                                   // 51:37 h could be O(n)
  bad('h 可能是 O(n)', 3.6, 6.4);
  cap('樹高 h 可能跟 n 一樣大', '');
  await step(tok);                                   // 51:49 give you a sorted list
  hl = tag('BST　h = 0', 'ptr', -3.0, 7.0);
  note('依序：43, 46, 48, 49, …', -3.0, -0.2, 1.0);
  cap('給你一串排好序的數字', '');
  await step(tok);                                   // 51:54 insert 43, then 46
  ins(43); await beat(tok, 500); ins(46);
  cap('insert 43，再 insert 46', '46 > 43 → 右');
  await step(tok);                                   // 52:02 insert 48, insert 49
  ins(48); await beat(tok, 500); ins(49);
  cap('48、49：每次都接在最右邊', '');
  await step(tok);                                   // 52:07 these could be any numbers
  for (const k of seq.slice(4)) { ins(k); await beat(tok, 450); }
  cap('任何遞增的數字都一樣', '');
  await step(tok);                                   // 52:14 looks like a list
  bad('長得像一條 linked list', -3.0, 1.2);
  cap('不像樹，像一條 list', 'h = n → O(n)');
  await step(tok);                                   // 52:17 good news next week
  cap('好消息下週由 Eric 講', '');
  await step(tok);                                   // 52:23 balanced binary search trees
  const Rv = makeView(Object.assign({ cx: 3.5, kind: 'avl' }, small));
  seq.forEach((k) => avlInsertRaw(Rv, k));
  layout(Rv);
  inorder(Rv.root).forEach(dropIn);
  tag('平衡的 BST　h = ' + height(Rv.root), 'ptr alt', 3.5, 7.0);
  cap('需要 balanced BST', '同樣的數字，高度小很多');
  await step(tok);                                   // 52:32 h = O(log n): then everything works
  good('h = O(log n) → 前面全都成立', 3.5, 0.2, 1.0);
  cap('讓 h = O(log n)', '前面說的才全部成立');
}]);
  }

  // ═══ bstb.js ═══
  {
const { V3, fresh, tag, cube, move, kill, glow, tint, txt, relabel, code, anim, line, arrow, ghostBox, buddy, travel, remove, step, GOLD, GREEN, RED } = K;
// ─── nfDvFjXU2VI 交大彭文志 Lec24（Horowitz 月份 AVL）、FNeL18KsWPc MIT 6.006 AVL ───
// cued：每個 await step(tok) 等老師講到那一句才往下（notes 的 cues 一對一）
// 小樹引擎：x 由「全部 key 的排名」固定（旋轉時 x 不動、只換層 → 正好看出 inorder 不變），y 由深度決定
const BB_PAL = ['#2fc092', '#4b9ee2', '#9b7ef4', '#e55a9b', '#dd8238', '#31aab0', '#c08a1f', '#5c7a4a'];
const bbCol = (k) => typeof k === 'number' ? colorFor(k) : BB_PAL[[...String(k)].reduce((s, c) => s + c.charCodeAt(0), 0) % 8];
const BB_MON = ['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN', 'DEC', 'JUL', 'FEB', 'JUN', 'OCT', 'SEP'];
const BB_MIT = [41, 20, 65, 11, 29, 50, 26];
const PINK = '#e55a9b';
function bbTree(keys, o = {}) {
  const ks = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { root: null, ks, gap: o.gap || 1.3, top: o.top ?? 6.4, dy: o.dy || 1.3, x0: o.x0 || 0, info: o.info || null, edges: [], warn: o.warn !== false, hide: false };
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
    const s = t.info === 'bf' ? 'bf ' + (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b) : t.info === 'h' ? 'h=' + (bbH(n) - 1) : (BB_ARW[b] || (b > 0 ? '↙↙' : '↘↘'));
    if (!n.tg) n.tg = tag(s, 'idx', 0, 0, 0); else txt(n.tg, s);
    n.tg.element.className = 'lab-label ' + (Math.abs(b) >= 2 ? 'ptr alt' : 'idx');
    n.tg.element.style.visibility = t.hide ? 'hidden' : '';
    if (t.warn && !t.hide) glow(n.m, Math.abs(b) >= 2 ? RED : null);
  }
}
function bbEdges(t) {
  t.edges.forEach(kill); t.edges = [];
  for (const n of bbList(t)) {
    const q = K.land(n.m); // landing spots: a node still dropping or moving gets its edge where it will rest
    if (n.p && n.p.m) { const pp = K.land(n.p.m); t.edges.push(line(pp.x, pp.y - 0.4, q.x, q.y + 0.4)); }
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
// 顯示 / 隱藏 bf（「插進去」和「算 bf」分成兩句時用）
function bbShow(t, on) { t.hide = !on; bbInfo(t); bbEdges(t); }
function bbNote(n, s, cls) { if (!n.tg) n.tg = tag(s, cls || 'idx', 0, 0, 0); else txt(n.tg, s); n.tg.element.className = 'lab-label ' + (cls || 'idx'); n.tg.element.style.visibility = ''; }
function bbCursor(n, s) { const p = K.land(n.m); return tag(s || '▼', 'pkt', p.x, p.y + 1.0, 0); }
function bbAt(cur, n) { const p = K.land(n.m); cur.position.set(p.x, p.y + 1.0, 0); }
// 游標沿著節點走（每個節點 ms 毫秒，總長要短）
async function bbRun(tok, cur, nodes, ms = 160, onEach) {
  for (let i = 0; i < nodes.length; i++) { const n = nodes[i]; bbAt(cur, n); glow(n.m, GOLD); if (onEach) onEach(n, i); await beat(tok, ms); glow(n.m, null); }
}
// 在節點旁邊掛一個標籤（A、Y、B、C …）
function bbPin(n, s, cls = 'ptr alt', dx = -0.62) { const p = K.land(n.m); return tag(s, cls, p.x + dx, p.y + 0.98, 0); }
// 把舊樹的方塊搬到新樹（同 key 共用方塊），用來示範「同一群 key 換成另一個形狀」
async function bbMorph(oldT, newT, tok, ms = 900) {
  const byK = new Map(bbList(oldT).map((n) => [n.k, n]));
  oldT.edges.forEach(kill); oldT.edges = [];
  for (const n of bbList(newT)) { const o = byK.get(n.k); if (o) { n.m = o.m; n.tg = o.tg; } }
  await bbLay(newT, tok, ms);
}
// 小幫手：會呼吸眨眼的小方塊＋對話泡泡
function pal(x = 6.1, z = 2.6, color = '#f6c35b', s = 0.55, name = '小A') { const b = buddy(name, '', color, x, 0, z, s); b.x = x; b.z = z; b.s = s; return b; }
function talk(b, text, mood) { if (!b) return; if (b.bub) remove(b.bub); b.bub = text ? tag(text, 'say', b.x, b.s + 1.35, b.z) : null; if (mood) b.mood(mood); }
const note = (s, x, y, z = 0) => tag(s, 'note', x, y, z);

// ═══ nfDvFjXU2VI ═══
const CAMB = [[0, 4.6, 14], [0, 3.8, 0]];
const SEQ_TXT = 'MAR MAY NOV AUG APR JAN DEC JUL FEB JUN OCT SEP';
// 00:00 依字母順序插入月份 → skewed BST，找 SEPT 要比 12 次
FRAG.push(['bstb-skewed-months', '依字母順序插入：skewed BST', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const ord = [...BB_MON].sort();
  const t = bbTree(ord, { gap: 1.0, top: 7.0, dy: 0.52 });
  await step(tok);                                   // 0:00 BST 會受 input sequence 影響
  note('input：APR → AUG → DEC → … → SEP（照字母順序）', -1.2, 0.4, 1.6);
  say('BST 長什麼樣子，要看資料進來的順序', 'input sequence 不好，樹就會長歪');
  talk(g, '順序會影響形狀？', 'wow');
  await step(tok);                                   // 0:22 可能長得像這樣：skewed
  for (const k of ord) { bbPut(t, bbNode(k)); await bbLay(t, tok, 130, 2.5); }
  say('每個新月份都比前面大 → 一路往右下長', 'skewed binary search tree（歪斜的 BST）');
  talk(g, '歪成一條斜線了…', 'sad');
  await step(tok);                                   // 0:36 search SEPT
  const sep = bbFind(t, 'SEP'); glow(sep.m, GOLD);
  const cur = bbCursor(t.root, '找 SEPT');
  say('在這棵樹裡找 SEPT（九月）', '從 root 開始，一個一個比大小');
  talk(g, 'SEPT 在最下面耶');
  await step(tok);                                   // 0:44 要比 12 次
  const cnt = tag('比較 0 次', 'pkt', -4.2, 2.2, 0);
  const path = []; for (let c = t.root; c; c = c.r) path.push(c);
  await bbRun(tok, cur, path, 140, (n, i) => txt(cnt, '比較 ' + (i + 1) + ' 次'));
  glow(sep.m, GREEN);
  say('一路比到最底：比較 12 次', 'max comparisons = 12');
  await step(tok);                                   // 0:52 每一次比大小就是一次 comparison
  note('每比一次大小 = 1 次 comparison', -3.6, 3.2, 0.8);
  say('和一個 node 比一次大小，叫做一次 comparison', '');
  talk(g, '比一次算一次');
  await step(tok);                                   // 0:59 average：每個 node 的比較次數
  remove(cur);
  bbList(t).forEach((n, i) => { bbNote(n, String(i + 1)); });
  bbEdges(t);
  say('平均：找每個 node 各要比幾次？', '第 1 個比 1 次、第 2 個 2 次 … 第 12 個 12 次');
  await step(tok);                                   // 1:13 取平均 = 6.5
  note('(1 + 2 + … + 12) ÷ 12 = 78 ÷ 12 = 6.5', 1.6, 1.2, 1.2);
  say('把 12 個次數加起來再平均', 'average comparisons = 6.5');
  await step(tok);                                   // 1:19 不 balance 就有這種缺點
  talk(g, '太慢了啦…', 'sad');
  say('BST 不 balance，搜尋就會很慢', '最差跟 linked list 一樣，一個一個找');
  await step(tok);                                   // 1:29 希望找到比較 balanced 的 BST
  bbList(t).forEach((n) => { kill(n.tg); n.tg = null; }); remove(cnt);
  const b = bbTree(BB_MON, { gap: 1.0, top: 7.0, dy: 1.2 });
  bbAvlSilent(b, BB_MON);
  await bbMorph(t, b, tok, 1200);
  say('同樣 12 個月份，排成比較矮胖的樣子', '最多只要比 5 次');
  talk(g, '矮多了！', 'happy');
  await step(tok);                                   // 1:33 典型的 balanced BST：AVL tree
  tag('AVL tree', 'ptr alt', 0, 8.0, 0);
  say('典型的 balanced BST：AVL tree', '接下來看它的定義和怎麼維持');
  await g.hop(tok);
}]);

// 01:38 AVL 定義：T_L、T_R height balanced 且 |h_L − h_R| ≤ 1；bf = h_L − h_R
FRAG.push(['bstb-avl-def', 'AVL 定義與 balance factor', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = bbTree(BB_MON, { gap: 1.0, top: 7.0, dy: 1.2, info: 'bf' });
  bbAvlSilent(t, BB_MON);
  t.hide = true;
  await step(tok);                                   // 1:38 AVL tree 有兩個條件
  await bbLay(t, tok, 600, 2.5);
  say('AVL tree 有兩個條件', '隨便選一個 node 來檢查（先看 root）');
  talk(g, '兩個條件？');
  await step(tok);                                   // 1:49 以 root 為例：left / right subtree
  const r = t.root; glow(r.m, GOLD);
  const xs = bbList(t).map((n) => n.m.position.x);
  const lx = (Math.min(...xs) + r.m.position.x - 0.5) / 2, rx = (Math.max(...xs) + r.m.position.x + 0.5) / 2;
  const gl = ghostBox('#4b9ee2', r.m.position.x - Math.min(...xs) - 0.2, 4.4, 1.4); gl.position.set(lx, 4.0, 0);
  const gr = ghostBox(PINK, Math.max(...xs) - r.m.position.x - 0.2, 5.6, 1.4); gr.position.set(rx, 3.4, 0);
  const tl = tag('T_L', 'ptr', lx, 6.6, 0), tr = tag('T_R', 'ptr', rx, 6.6, 0);
  say('root 底下：左子樹 T_L、右子樹 T_R', '');
  await step(tok);                                   // 1:56 條件一：T_L、T_R 都是 height balanced
  const c1 = note('① T_L、T_R 都是 height balanced', -2.6, 0.5, 1.4);
  say('條件 ①：T_L 和 T_R 本身都是 height balanced', '');
  await step(tok);                                   // 2:02 條件二：|h_L − h_R| ≤ 1
  const c2 = note('② |h_L − h_R| ≤ 1', 3.2, 0.5, 1.4);
  say('條件 ②：左右子樹高度相減取絕對值，不超過 1', '');
  await step(tok);                                   // 2:12 h_L、h_R 是左右子樹的高度
  const hl = bbH(r.l), hr = bbH(r.r);
  const hlT = tag('h_L = ' + hl, 'pkt', lx, 1.6, 0), hrT = tag('h_R = ' + hr, 'pkt', rx, 1.0, 0);
  say('h_L = 左子樹的高度（層數），h_R = 右子樹的高度', '這裡 h_L = ' + hl + '、h_R = ' + hr);
  await step(tok);                                   // 2:18 相差在 1 之內
  txt(c2, '② |' + hl + ' − ' + hr + '| = ' + Math.abs(hl - hr) + ' ≤ 1 ✓');
  say('高度相差在 1 之內 → root 這裡過關', '');
  talk(g, '差 1 可以！', 'happy');
  await step(tok);                                   // 2:36 遞迴：T_L 裡任取一個 node 也要符合
  [gl, gr, tl, tr, hlT, hrT].forEach(kill); glow(r.m, null);
  const q = r.l; glow(q.m, GOLD);
  const g2 = ghostBox('#4b9ee2', 1.6, 2.4, 1.2); g2.position.set(q.l.m.position.x, q.l.m.position.y - 0.6, 0);
  const g3 = ghostBox(PINK, 1.6, 2.4, 1.2); g3.position.set(q.r.m.position.x, q.r.m.position.y - 0.6, 0);
  txt(c1, '① 每個 subtree 也要符合（遞迴）');
  say('「height balanced」是遞迴的：', 'T_L 裡任取一個 node，它的左右子樹也要符合 ①②');
  talk(g, '一層一層都要檢查');
  await step(tok);                                   // 3:05 為了達到這個條件：一個指標
  [g2, g3].forEach(kill); glow(q.m, null);
  say('為了方便檢查，每個 node 放一個指標', '叫做 balance factor（BF）');
  talk(g, '每個 node 一個數字');
  await step(tok);                                   // 3:29 BF = h_L − h_R
  bbShow(t, true);
  say('BF = h_L − h_R（左子樹高度 − 右子樹高度）', '每個 node 上方的數字就是它的 BF');
  await step(tok);                                   // 3:39 沒有取絕對值
  const neg = bbList(t).find((n) => bbBf(n) < 0);
  glow(neg.m, GOLD);
  const nn = note('負的 = 右邊比較高', neg.m.position.x, neg.m.position.y - 0.9, 1.0);
  say('BF 不取絕對值：正負號有意義', '+ = 左邊高、− = 右邊高、0 = 一樣高');
  await step(tok);                                   // 3:45 BF 只能是 −1、0、1
  glow(neg.m, null); kill(nn);
  for (const n of bbList(t)) glow(n.m, GREEN);
  txt(c2, '② 每個 node 的 BF ∈ {−1, 0, 1}');
  say('AVL tree：每個 node 的 BF 都只能是 −1、0、1', '');
  talk(g, '全部綠燈 ✓', 'happy');
  await step(tok);                                   // 4:03 insert 時 BF 超出 → 調整
  for (const n of bbList(t)) { kill(n.m); kill(n.tg); } t.edges.forEach(kill); [c1, c2].forEach(kill);
  const s = bbTree(['MAR', 'MAY', 'NOV'], { gap: 1.6, top: 6.4, dy: 1.3, info: 'bf' });
  bbBstSilent(s, ['MAR', 'MAY', 'NOV']); await bbLay(s, tok, 700, 3);
  say('insert 時，如果某個 node 的 BF 變成 2 或 −2', '超出 −1、0、1 → 馬上要調整');
  talk(g, '−2！要修了', 'wow');
  await step(tok);                                   // 5:03 不是做完才調整：一個一個拿進來
  const qs = ['AUG', 'APR', 'JAN', 'DEC'].map((k, i) => cube(k, bbCol(k), [0.9, 0.6, 0.8], -5.6 + i * 1.1, 0.4, 1.6));
  note('進來一個 → 算 BF → 違規就馬上調整', 1.6, 0.5, 1.6);
  say('每 insert 一個 node 就檢查、就調整', '不是全部插完才一次調整');
  await travel(tok, qs[0], qs[0].position.clone(), V3(-3.2, 2.6, 0), 700);
  await step(tok);                                   // 5:44 調整只有四種
  ['LL', 'LR', 'RR', 'RL'].forEach((s2, i) => tag(s2, 'ptr alt', -3 + i * 2, 8.0, 0));
  say('AVL 的調整其實很簡單：只有四種', 'LL、LR、RR、RL');
  talk(g, '才四種！', 'happy');
}]);

// 05:49 四種調整：A = 離 Y 最近的違規點；看 Y 在 A 的哪裡
FRAG.push(['bstb-four-cases', 'LL、LR、RR、RL 四種情況', async (tok) => {
  fresh([0, 4.2, 13.5], [0, 3.4, 0]);
  const g = pal(6.2, 2.8);
  const xs = [-5.1, -1.7, 1.7, 5.1], types = ['LL', 'LR', 'RR', 'RL'];
  const slots = types.map((T, i) => tag('?', 'idx', xs[i], 1.2, 0));
  const draw = (i, withY = true) => {
    const T = types[i], x = xs[i], s1 = T[0] === 'L' ? -1 : 1, s2 = T[1] === 'L' ? -1 : 1;
    const bx = x + s1 * 0.85, yx = bx + s2 * 0.75;
    const A = cube('A', '#dd8238', [0.9, 0.8, 0.9], x, 5.6, 0, 2.5);
    const B = cube('', '#4b9ee2', [0.8, 0.7, 0.9], bx, 4.2, 0, 2.5);
    line(x, 5.2, bx, 4.6);
    let Y = null;
    if (withY) { line(bx, 3.85, yx, 3.2); Y = cube('Y', PINK, [0.8, 0.7, 0.9], yx, 2.8, 0, 2.5); glow(Y, GOLD); glow(A, RED); txt(slots[i], T); slots[i].element.className = 'lab-label ptr alt'; }
    return { A, B, Y, x, bx, yx };
  };
  await step(tok);                                   // 5:49 四種 operation
  say('AVL 的調整只有四種 operation', '先認識兩個角色：Y 和 A');
  talk(g, '哪四種？');
  await step(tok);                                   // 5:54 新 insert 進來的 node 叫 Y
  const Y0 = cube('Y', PINK, [0.8, 0.7, 0.9], xs[0] - 1.6, 2.8, 0, 3); glow(Y0, GOLD);
  say('新 insert 進來的 node，叫做 Y', '');
  await step(tok);                                   // 6:13 有一個 node 叫 A，Y 在它的 left subtree 的 left
  const A0 = cube('A', '#dd8238', [0.9, 0.8, 0.9], xs[0], 5.6, 0, 3);
  const B0 = cube('', '#4b9ee2', [0.8, 0.7, 0.9], xs[0] - 0.85, 4.2, 0, 3);
  line(xs[0], 5.2, xs[0] - 0.85, 4.6); line(xs[0] - 0.85, 3.85, xs[0] - 1.6, 3.2);
  say('樹裡有一個 node 叫 A', '例如 Y 被插在 A 的 left subtree 的 left');
  await step(tok);                                   // 6:42 A 怎麼定義：違反 BF 區間
  glow(A0, RED); const bfT = tag('bf 2', 'ptr alt', xs[0] + 0.7, 6.3, 0);
  say('A 是誰？插入 Y 之後，BF 跑出 −1、0、1 的那個 node', '它就是要被修的地方');
  talk(g, '違規的就是 A', 'wow');
  await step(tok);                                   // 7:10 判斷 Y 在 A 的哪個位置
  const hand = tag('👉', '', xs[0], 6.4, 0);
  await travel(tok, hand, V3(xs[0], 6.4, 0), V3(xs[0] - 1.6, 3.6, 0), 1000);
  say('找到 A 以後：看 Y 在 A 的哪個位置', '從 A 往 Y 走：先往哪邊、再往哪邊');
  await step(tok);                                   // 7:19 第一種：LL
  remove(hand);
  txt(slots[0], 'LL'); slots[0].element.className = 'lab-label ptr alt';
  say('LL：Y 在 A 的 left subtree 的 left', '左、左');
  await step(tok);                                   // 7:42 第二種：LR
  draw(1);
  say('LR：Y 在 A 的 left subtree 的 right', '先左、再右');
  talk(g, '左 → 右');
  await step(tok);                                   // 8:13 英文寫法很繞：記中文
  const en = note('英文課本：in the right subtree of the left subtree of A', -1.7, 0.4, 1.6);
  say('英文寫法繞了一大圈', '記中文就好：A 的 left subtree 的 right');
  talk(g, '英文好繞…', 'sad');
  await step(tok);                                   // 8:21 RR
  kill(en);
  draw(2);
  say('RR：Y 在 A 的 right subtree 的 right', '右、右');
  talk(g, '右 → 右', 'calm');
  await step(tok);                                   // 8:29 RL：跟 LR 剛好顛倒
  draw(3);
  say('RL：跟 LR 剛好顛倒', 'Y 在 A 的 right subtree 的 left');
  await step(tok);                                   // 8:46 先 detect 哪個 node 是 A
  kill(bfT);
  const s1 = note('① 先找出 A', -3.4, 7.3, 0);
  say('做法第一步：detect 哪個 node 是 A', '');
  await step(tok);                                   // 8:55 再看 Y 和 A 的空間關係
  const s2 = note('② 看 Y 和 A 的空間關係', 1.6, 7.3, 0);
  say('第二步：判斷 Y 和 A 在空間上的關係', '');
  await step(tok);                                   // 9:05 一定落入四種之一
  slots.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('不管樹多大，一定落入這四種 case 之一', '');
  talk(g, '一定是其中一種', 'happy');
  await step(tok);                                   // 9:12 根據每一種 case 去調整
  [s1, s2].forEach(kill);
  note('③ 依照 case 做對應的調整', -1.0, 7.3, 0);
  say('第三步：根據是哪一種 case 去做調整', '接下來用月份的例子看');
}]);

// 月份例共用：插入（不算 bf）→ 算 bf → 找 A → 判型別 → 調整，各自是一個 step
function monthTree(pre, o = {}) {
  const t = bbTree(BB_MON, Object.assign({ gap: 1.0, top: 7.0, dy: 1.2, info: 'bf' }, o));
  bbAvlSilent(t, pre);
  return t;
}
async function monthIns(t, k, tok, hide = true) { const n = bbPut(t, bbNode(k)); t.hide = hide; await bbLay(t, tok, 700, 3); glow(n.m, GOLD); return n; }
function pathTo(t, k) { const out = []; let c = t.root; while (c) { out.push(c); if (c.k === k) break; c = k < c.k ? c.l : c.r; } return out; }

// 09:33 MAR、MAY、NOV → RR
FRAG.push(['bstb-month-rr', '月份例：MAR、MAY、NOV → RR', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree([]);
  await step(tok);                                   // 9:33 依 input sequence 一個一個插
  note('input：' + SEQ_TXT, -0.6, 0.4, 1.6);
  say('照 input sequence，一個月份一個月份插進去', '樹一開始是空的');
  talk(g, '從空樹開始');
  await step(tok);                                   // 9:45 MAR 當 root
  const mar = await monthIns(t, 'MAR', tok, false);
  say('第一個 MAR：樹是空的，所以它就是 root', '');
  await step(tok);                                   // 9:52 MAY 跟 MAR 比：第三個字 Y > R
  glow(mar.m, null);
  const cmp = note('MAY vs MAR：M = M、A = A、Y > R', -3.2, 2.0, 1.2);
  say('MAY 和 MAR 照英文字母順序比', '前兩個字一樣，第三個字 Y > R → MAY 比較大');
  await step(tok);                                   // 9:54 MAY 放在 MAR 右邊
  kill(cmp);
  const may = await monthIns(t, 'MAY', tok);
  say('比較大 → 放在 MAR 的右邊', '');
  await step(tok);                                   // 10:02 算 BF：MAR = 0 − 1 = −1
  glow(may.m, null); bbShow(t, true); glow(mar.m, GOLD);
  say('插完就算 BF：MAR 的左子樹高 0、右子樹高 1', 'BF(MAR) = 0 − 1 = −1');
  await step(tok);                                   // 10:19 MAY = 0
  glow(mar.m, null); glow(may.m, GOLD);
  say('MAY 左右都沒有 subtree', 'BF(MAY) = 0 − 0 = 0');
  await step(tok);                                   // 10:28 insert NOV
  glow(may.m, null);
  const nov = await monthIns(t, 'NOV', tok);
  say('insert NOV：比 MAR 大、比 MAY 大', '→ 放在 MAY 的右邊');
  await step(tok);                                   // 10:35 每個 node 重新算 BF
  glow(nov.m, null); t.warn = false; bbShow(t, true);
  say('又要重新計算每個 node 的 BF', 'MAR：0 − 2 = −2');
  await step(tok);                                   // 10:46 root MAR 違反規定
  glow(mar.m, RED);
  say('有人違反規定了：root MAR 的 BF = −2', '');
  talk(g, 'MAR 違規！', 'wow');
  await step(tok);                                   // 10:56 MAR 就是 A
  const a = bbPin(mar, 'A');
  say('違規的 MAR 就是 A', '');
  await step(tok);                                   // 11:05 NOV 就是 Y
  const y = bbPin(nov, 'Y', 'ptr');
  say('剛 insert 進來的 NOV 就是 Y', '');
  await step(tok);                                   // 11:15 Y 在 A 的 right subtree（MAY 那棵）
  glow(may.m, GOLD);
  say('Y 在 A 的 right subtree 裡', 'right subtree 就是 MAY 帶頭的那一棵');
  await step(tok);                                   // 11:34 的右邊 → RR
  glow(nov.m, GOLD);
  const rr = tag('RR', 'ptr alt', 0, 8.0, 0);
  say('而且在那棵的右邊 → right subtree 的 right', '所以是 RR');
  talk(g, '右、右 → RR');
  await step(tok);                                   // 12:09 MAY 拉上來、MAR 壓下去
  [a, y, rr].forEach(kill); [mar, may, nov].forEach((n) => glow(n.m, null));
  bbFix(t, bbDetect(t, nov)); t.hide = true; await bbLay(t, tok, 1000);
  say('調整：MAY 拉上來，MAR 壓到左邊', 'NOV 留在右邊');
  await step(tok);                                   // 12:19 BF 都變 0
  bbShow(t, true); [mar, may, nov].forEach((n) => glow(n.m, GREEN));
  say('三個 node 的 BF 都變成 0', '又符合規定了');
  talk(g, '平衡了！', 'happy');
}]);

// 12:42 AUG、APR → LL（MAR、MAY 都違規，A 取最近的 MAR）
FRAG.push(['bstb-month-ll', '月份例：AUG、APR → LL', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree(['MAR', 'MAY', 'NOV']); t.warn = false;
  await bbLay(t, tok, 0, 0);
  await step(tok);                                   // 12:43 insert AUG
  const aug = await monthIns(t, 'AUG', tok);
  say('insert AUG：比 MAY 小、比 MAR 小', '→ 放在 MAR 的左邊');
  await step(tok);                                   // 12:52 update BF：沒有人違規
  glow(aug.m, null); bbShow(t, true);
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('每 insert 一個，就 update 每個 node 的 BF', '都在 −1、0、1 裡：沒有人違規');
  talk(g, '沒事～', 'happy');
  await step(tok);                                   // 13:00 insert APR
  for (const n of bbList(t)) glow(n.m, null);
  const apr = await monthIns(t, 'APR', tok);
  say('insert APR：一路往左', '→ 放在 AUG 的左邊');
  await step(tok);                                   // 13:08 update BF
  glow(apr.m, null); bbShow(t, true);
  say('insert 完再 update 一次 BF', '');
  await step(tok);                                   // 13:20 違規的有兩個：MAY、MAR
  const may = bbFind(t, 'MAY'), mar = bbFind(t, 'MAR');
  glow(may.m, RED); glow(mar.m, RED);
  say('這次違反規定的有兩個 node：MAY 和 MAR', 'BF 都是 +2');
  talk(g, '兩個都違規？', 'wow');
  await step(tok);                                   // 13:31 新 node 在最下面：APR
  const y = bbPin(apr, 'Y', 'ptr');
  say('剛 insert 進來的是最下面的 APR', '它就是 Y');
  await step(tok);                                   // 13:43 APR 在 A 的 left subtree 的 left → LL
  glow(aug.m, GOLD); glow(apr.m, GOLD);
  const ll = tag('LL', 'ptr alt', 0, 8.0, 0);
  say('APR 在 A 的 left subtree 的 left', '→ 要做 LL 的調整');
  await step(tok);                                   // 13:56 A 是 MAR：離 APR 最近
  glow(may.m, null);
  const a = bbPin(mar, 'A');
  const nt = note('MAY 也違規，但離 APR 最近的是 MAR', 2.4, 1.0, 1.2);
  say('A 是哪一個？離 Y 最近的那個違規 node', 'A = MAR（不是 MAY）');
  talk(g, '選最近的！');
  await step(tok);                                   // 14:16 AUG 提上來、MAR 往下壓
  [y, ll, a, nt].forEach(kill); [aug, apr, mar].forEach((n) => glow(n.m, null));
  bbFix(t, bbDetect(t, apr)); t.hide = true; await bbLay(t, tok, 1000);
  say('LL：把 AUG 提上來，MAR 往下壓', 'AUG 底下：左 APR、右 MAR');
  await step(tok);                                   // 14:37 重新算 BF：MAY = 2 − 1 = 1
  bbShow(t, true); glow(may.m, GOLD);
  say('重新算 BF：MAY 的左子樹高 2、右子樹高 1', 'BF(MAY) = 2 − 1 = 1');
  await step(tok);                                   // 14:57 全部符合規定
  glow(may.m, null); for (const n of bbList(t)) glow(n.m, GREEN);
  say('調整完成：每個 BF 都符合規定', '接著 insert JAN');
  talk(g, '過關 ✓', 'happy');
}]);

// 15:04 JAN → LR（A = MAY、B = AUG、C = MAR），root 換人
FRAG.push(['bstb-month-lr', '月份例：JAN → LR，root 換成 MAR', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree(['MAR', 'MAY', 'NOV', 'AUG', 'APR']); t.warn = false;
  await bbLay(t, tok, 0, 0); bbShow(t, true);
  await step(tok);                                   // 15:04 insert JAN，又有人違規
  const jan = await monthIns(t, 'JAN', tok, false);
  const may = bbFind(t, 'MAY'); glow(may.m, RED);
  say('insert JAN：< MAY、> AUG、< MAR → MAR 的左邊', '算完 BF：MAY 變成 +2，違規');
  talk(g, '又有人違規', 'wow');
  await step(tok);                                   // 15:21 這是 A，這是 Y
  const a = bbPin(may, 'A'), y = bbPin(jan, 'Y', 'ptr');
  say('違規的 MAY 是 A，新來的 JAN 是 Y', '');
  await step(tok);                                   // 15:28 Y 在 A 的 left subtree 的 right → LR
  const aug = bbFind(t, 'AUG'), mar = bbFind(t, 'MAR');
  glow(aug.m, GOLD); glow(mar.m, GOLD);
  const lr = tag('LR', 'ptr alt', 0, 8.0, 0);
  say('JAN 在 A 的 left subtree（AUG 那棵）的 right', '→ 進行 LR 的調整');
  await step(tok);                                   // 15:43 回顧 APR：兩個 node 的 BF 都是 2
  glow(aug.m, null); glow(mar.m, null);
  const flash = note('回顧 APR 那次：MAY、MAR 的 BF 都是 2', -2.6, 1.0, 1.4);
  say('回想剛才 insert APR：有兩個 node 的 BF 都是 2', '還是要確認：哪一個才是 A？');
  await step(tok);                                   // 16:04 A = 離新 node 最近的那一個
  const rule = note('A = 從 Y 往 root 走，第一個違規的 node', 2.6, 2.0, 1.4);
  say('規則：A 是離新 insert 的 node 最近的違規 node', '');
  await step(tok);                                   // 16:12 APR 往 root 走，遇到 MAR
  txt(flash, '回顧 APR 那次：往上走先遇到 MAR → A = MAR');
  say('APR 往 root 走：最先遇到的違規 node 是 MAR', '所以那次 A = MAR');
  await step(tok);                                   // 16:30 這次往 root 走：最近的是 MAY
  kill(a);
  const cur = bbCursor(jan, '▲');
  await bbRun(tok, cur, pathTo(t, 'JAN').reverse(), 380);
  remove(cur); glow(may.m, RED);
  const a2 = bbPin(may, 'A');
  say('這次從 JAN 往上走：MAR、AUG 都沒事，第一個違規的是 MAY', 'A = MAY');
  await step(tok);                                   // 16:40 確認是 LR，進行 LR 調整
  [flash, rule].forEach(kill);
  say('A 和 Y 的關係確認是 LR', '就照 LR 的方法調整（比較複雜，後面細講）');
  await step(tok);                                   // 17:01 四種調整都有固定步驟
  const fx = note('LL、RR、LR、RL：都有現成的調整步驟', -2.4, 0.6, 1.6);
  say('不管 LL、RR、LR、RL，怎麼調整前人都推導好了', '');
  await step(tok);                                   // 17:14 依樣畫葫蘆：照圖表做
  talk(g, '照著圖做就好', 'happy');
  say('你只要「依樣畫葫蘆」', '對照圖表一步一步做');
  await step(tok);                                   // 17:36 調整完的樣子
  [a2, y, lr, fx].forEach(kill); glow(may.m, null); glow(jan.m, null);
  bbFix(t, bbDetect(t, jan)); await bbLay(t, tok, 1100);
  say('調整完：長成這個樣子', '');
  await step(tok);                                   // 17:46 root 換了：MAR 拉上來
  glow(mar.m, GOLD);
  const nr = bbPin(mar, 'new root', 'pkt', 0);
  say('更動很大：連 root 都換了', '本來在下面的 MAR 被拉上來當 root');
  talk(g, 'root 換人了！', 'wow');
  await step(tok);                                   // 18:07 左右的 structure 也改變了
  glow(mar.m, null); kill(nr);
  for (const k of ['AUG', 'MAY']) glow(bbFind(t, k).m, GOLD);
  say('左右兩邊的 subtree 結構也改了', 'AUG、MAY 變成 MAR 的兩個 child');
  await step(tok);                                   // 18:17 一定要符合 BST：左小右大
  for (const k of ['AUG', 'MAY']) glow(bbFind(t, k).m, null);
  const io = bbList(t).map((n, i) => tag(n.k, 'pkt', -3.0 + i * 1.2, 0.4, 1.6));
  say('不管怎麼調整，都要符合 BST 的規則', '左子樹 < parent < 右子樹 → 從左到右排好序');
  await step(tok);                                   // 18:31 大規模調整，仍然是 BST
  io.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('調整幅度很大，結果還是 binary search tree', 'APR < AUG < JAN < MAR < MAY < NOV');
  talk(g, '順序沒亂 ✓', 'happy');
}]);

// 18:45 DEC、JUL、FEB → RL（A = AUG）
FRAG.push(['bstb-month-rl', '月份例：DEC、JUL、FEB → RL', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree(['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN']); t.warn = false;
  await bbLay(t, tok, 0, 0); bbShow(t, true);
  await step(tok);                                   // 18:45 insert DEC：沒有違規
  const dec = await monthIns(t, 'DEC', tok, false);
  say('insert DEC：→ JAN 的左邊', '算 BF：沒有人違規');
  await step(tok);                                   // 18:54 insert JULY：也沒有
  glow(dec.m, null);
  const jul = await monthIns(t, 'JUL', tok, false);
  say('insert JULY：→ JAN 的右邊', '也沒有違規');
  talk(g, '目前都 OK');
  await step(tok);                                   // 19:01 insert FEB，重算 BF
  glow(jul.m, null);
  const feb = await monthIns(t, 'FEB', tok, false);
  say('insert FEB：→ DEC 的右邊', '再算每個 node 的 BF');
  await step(tok);                                   // 19:10 有人違規（不只一個）
  const bad = bbList(t).filter((n) => Math.abs(bbBf(n)) >= 2);
  bad.forEach((n) => glow(n.m, RED));
  say('違規的不只一個：' + bad.map((n) => n.k).join('、'), 'BF 都超過 1');
  talk(g, '一次好幾個…', 'wow');
  await step(tok);                                   // 19:21 A 是 AUG
  const r = bbDetect(t, feb);
  bad.forEach((n) => { if (n !== r.A) glow(n.m, null); });
  const a = bbPin(r.A, 'A'), y = bbPin(feb, 'Y', 'ptr');
  say('從 FEB 往上走，第一個違規的是 AUG', 'A = AUG');
  await step(tok);                                   // 19:30 Y 在 AUG 的 right subtree
  glow(r.B.m, GOLD);
  say('FEB 在 AUG 的 right subtree 裡', '（JAN 帶頭的那一棵）');
  await step(tok);                                   // 19:41 的 left → RL
  glow(r.C.m, GOLD);
  const rl = tag('RL', 'ptr alt', 0, 8.0, 0);
  say('再往 JAN 的 left 走 → right subtree 的 left', '→ RL 調整');
  await step(tok);                                   // 19:48 調整就是四種情況
  talk(g, 'LL、LR、RR、RL 之一', 'happy');
  say('AVL 的調整永遠就這四種情況', '這次是 RL');
  await step(tok);                                   // 20:04 做 RL 的調整
  [a, y, rl].forEach(kill); [r.A, r.B, r.C].forEach((n) => glow(n.m, null));
  bbFix(t, r); await bbLay(t, tok, 1100);
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('RL：DEC 拉上來，AUG 和 JAN 當它的 child', '全部 BF 又回到 −1..1');
}]);

// 20:22 JUNE → LR（A = MAR）；OCT、SEPT 之後的最終樹
FRAG.push(['bstb-month-final', '月份例：JUN → LR，最後的 AVL tree', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree(['MAR', 'MAY', 'NOV', 'AUG', 'APR', 'JAN', 'DEC', 'JUL', 'FEB'], { dy: 1.15 }); t.warn = false;
  await bbLay(t, tok, 0, 0); bbShow(t, true);
  await step(tok);                                   // 20:22 insert JUNE，算 BF
  const jun = await monthIns(t, 'JUN', tok, false);
  const r = bbDetect(t, jun);
  say('insert JUNE：→ JUL 的右邊', '算 BF，把 A 抓出來');
  await step(tok);                                   // 20:32 A = MAR
  glow(r.A.m, RED);
  const a = bbPin(r.A, 'A'), y = bbPin(jun, 'Y', 'ptr');
  say('從 JUNE 往上走，第一個違規的是 MAR', 'A = MAR');
  await step(tok);                                   // 20:44 JUNE 在 MAR 的 left subtree 的 right → LR
  glow(r.B.m, GOLD); glow(r.C.m, GOLD);
  const lr = tag('LR', 'ptr alt', 0, 8.0, 0);
  say('JUNE 在 MAR 的 left subtree 的 right', '→ LR');
  talk(g, '左 → 右 = LR');
  await step(tok);                                   // 20:55 做調整
  [a, y, lr].forEach(kill); [r.A, r.B, r.C].forEach((n) => glow(n.m, null));
  bbFix(t, r); await bbLay(t, tok, 1100);
  say('照 LR 調整：JAN 拉上來當 root', '');
  await step(tok);                                   // 21:07 繼續 insert 到完（OCT、SEPT）
  for (const k of ['OCT', 'SEP']) { const n = bbPut(t, bbNode(k)); const rr = bbDetect(t, n); if (rr) bbFix(t, rr); await bbLay(t, tok, 600); }
  say('再 insert OCT、SEPT（影片直接帶過）', '每插一個一樣檢查、調整');
  await step(tok);                                   // 21:16 最後比較 balanced
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('12 個月插完：每個 node 都符合規定', '高度 ' + bbH(t.root) + '（skewed 那棵是 12）');
  talk(g, '矮又整齊！', 'happy');
  await g.hop(tok);
}]);

// 21:27 實作與流程：pointer 還是 array？insert → 算 bf → 找 A → 判型別 → 調整
FRAG.push(['bstb-avl-algo', 'AVL insert 的流程', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.4, 0]);
  const g = pal(6.2, 2.8);
  const tmp = [];
  await step(tok);                                   // 21:28 看課本的實作
  tmp.push(tag('課本的 AVL 實作', 'ptr', -3.4, 7.2, 0));
  say('來看課本怎麼實作 AVL tree', '如果是你來寫，你會怎麼做？');
  talk(g, '換我寫寫看？');
  await step(tok);                                   // 21:44 用 array 還是 pointer？
  tmp.push(note('用 array？', -5.0, 6.0, 0), note('用 pointer？', -1.8, 6.0, 0));
  say('這棵 tree 要用 array 做，還是用 pointer 做？', '');
  await step(tok);                                   // 21:55 pointer = linked 表示法
  const parts = ['lchild', 'data', 'bf', 'rchild'].map((s, i) => cube(s, i === 2 ? '#dd8238' : '#c9b48e', [1.3, 0.6, 0.8], -5.3 + i * 1.35, 4.6, 0, 2));
  tmp.push(...parts);
  say('tree 可以用 linked list（pointer）表示', '每個 node：lchild | data | bf | rchild');
  await step(tok);                                   // 22:01 或者用 array：想想 heap
  const hp = [90, 70, 80, 30, 60].map((v, i) => cube(v, colorFor(v), [0.8, 0.6, 0.8], -5.3 + i * 0.9, 2.6, 0, 2));
  tmp.push(...hp, tag('heap：直接用 array', 'idx', -3.5, 1.7, 0));
  say('第二種是 array', '想想 heap：我們都用 array 做');
  await step(tok);                                   // 22:18 heap 常常要找 parent、child
  tmp.push(note('parent = i / 2、child = 2i、2i + 1', -3.4, 0.6, 1.2));
  say('heap 常常要找 parent、child', '用 array 算 index 就找到，不用 pointer');
  await step(tok);                                   // 22:36 表示法不只一種：選適合的
  say('同一種資料結構，表示法不只一種', 'AVL 常常要旋轉、搬 subtree → 你覺得哪種好？');
  talk(g, '要看怎麼用', 'calm');
  await step(tok);                                   // 23:01 總結：每 insert 一個 node
  tmp.forEach(kill);
  const cd = code(['1. insert 一個 node（叫 Y）', '2. 沿 Y 往 root 的路徑更新 BF', '3. Y 往 root 走：第一個違規 = A', '4. 判斷 LL / LR / RR / RL', '5. 照圖調整（依樣畫葫蘆）'], -3.6, 6.6, 0.62);
  const t = bbTree(['MAR', 'AUG', 'NOV', 'APR', 'JAN', 'DEC'], { gap: 1.05, top: 6.2, dy: 1.25, x0: 3.0, info: 'bf' });
  bbAvlSilent(t, ['MAR', 'AUG', 'NOV', 'APR', 'JAN']); t.warn = false; await bbLay(t, tok, 0, 0); bbShow(t, true);
  cd.hl(0);
  const n = await monthIns(t, 'DEC', tok);
  say('總結：每 insert 一個 node', '例：insert DEC');
  await step(tok);                                   // 23:09 對整棵樹算 BF
  glow(n.m, null); cd.hl(1); bbShow(t, true);
  say('沿著插入路徑往上更新 BF', '只有這條路上的高度會變（老師說成算整棵樹）');
  await step(tok);                                   // 23:18 判斷是哪一種情況
  say('然後判斷是四種情況的哪一種', '怎麼判斷？靠 Y 和 A');
  await step(tok);                                   // 23:26 新 node 叫 Y
  const y = bbPin(n, 'Y', 'ptr');
  say('先認出 insert 進來的 node：Y', '');
  await step(tok);                                   // 23:34 Y 往 root 走，找第一個違規 = A
  cd.hl(2);
  const cur = bbCursor(n, '▲');
  const up = []; for (let c = n.p; c; c = c.p) { up.push(c); if (Math.abs(bbBf(c)) >= 2) break; }
  await bbRun(tok, cur, up, 400);
  remove(cur);
  const r = bbDetect(t, n); glow(r.A.m, RED);
  const a = bbPin(r.A, 'A');
  say('Y 往 root 走，第一個看到違反 BF 的：' + r.A.k, '它就是 A');
  await step(tok);                                   // 23:46 依空間關係：LL、LR、RR、RL
  cd.hl(3);
  const ty = tag(r.type, 'ptr alt', 3.0, 7.6, 0);
  say('看 Y 和 A 的空間關係', 'DEC 在 MAR 的 left subtree 的 right → ' + r.type);
  await step(tok);                                   // 23:55 照圖調整
  cd.hl(4); [y, a, ty].forEach(kill); glow(r.A.m, null);
  bbFix(t, r); await bbLay(t, tok, 1000);
  say('照 ' + r.type + ' 的圖調整', 'JAN 拉上來，AUG、MAR 當 child');
  await step(tok);                                   // 24:05 調整方法早就有人提出
  cd.hl(-1);
  note('AVL = Adelson-Velsky & Landis（1962 年的論文）', 0, 0.5, 1.4);
  say('這些調整方法早就有人提出', '當年的論文，現在變成教科書的內容');
  talk(g, '站在巨人肩膀上', 'happy');
}]);

// 一般式（子樹畫成方塊）：LL / RR
function rotGenTree(mirror) {
  const specs = mirror
    ? [[1, 'A_L h', 'blk'], [2, 'A'], [3, 'B_L h', 'blk'], [4, 'B'], [5, 'B_R h', 'blk']]
    : [[1, 'B_L h', 'blk'], [2, 'B'], [3, 'B_R h', 'blk'], [4, 'A'], [5, 'A_R h', 'blk']];
  const yk = mirror ? 5.5 : 0.5;
  const t = bbTree([...specs.map((s) => s[0]), yk], { gap: 1.9, top: 6.6, dy: 1.6 });
  const ins = mirror ? [2, 1, 4, 3, 5] : [4, 2, 5, 1, 3];
  for (const k of ins) { const s = specs.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  return { t, yk, A: bbFind(t, mirror ? 2 : 4), B: bbFind(t, mirror ? 4 : 2), BL: bbFind(t, mirror ? 5 : 1), mid: bbFind(t, 3), far: bbFind(t, mirror ? 1 : 5) };
}
async function rotGenY(G, tok) { const y = bbPut(G.t, bbNode(G.yk, 'Y')); y.col = PINK; await bbLay(G.t, tok, 800); return y; }

// 24:24 LL 通式
FRAG.push(['bstb-ll-general', 'LL 通式：B 上提、B_R 給 A', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.2, 2.8);
  const G = rotGenTree(false), t = G.t;
  await step(tok);                                   // 24:24 一般化的示意圖：A、B
  bbList(t); // 算 depth；先只畫 A、B 兩個 node
  for (const n of [G.A, G.B]) { const [x, y] = bbPos(t, n); n.m = cube(n.lab, bbCol(n.k), [0.95, 0.8, 0.9], x, y, 0, 3); }
  { const a = K.land(G.A.m), b = K.land(G.B.m); t.edges.push(line(a.x, a.y - 0.4, b.x, b.y + 0.4)); }
  say('更一般的圖：A、B 是兩個 node', '');
  talk(g, '這次用通式');
  await step(tok);                                   // 24:36 B_L、B_R、A_R 是 subtree
  await bbLay(t, tok, 700, 3);
  say('B_L、B_R、A_R 是三棵 subtree（方塊代表一整棵）', 'B_L、B_R 是 B 的左右子樹，A_R 是 A 的右子樹');
  await step(tok);                                   // 24:51 要 insert 的 node 在 B_L 下面
  const hint = tag('Y 會插在這裡 ↓', 'pkt', G.BL.m.position.x, G.BL.m.position.y + 1.0, 0);
  say('現在要 insert 一個 node', '它會插在 B_L 的下面');
  await step(tok);                                   // 25:01 A_R 的高度是 h
  glow(G.far.m, GOLD);
  say('每塊上面都有高度：A_R 的高度是 h', '');
  await step(tok);                                   // 25:13 B 那邊高 h + 1
  glow(G.far.m, null); glow(G.B.m, GOLD);
  const hb = bbPin(G.B, 'B 這邊 h + 1', 'note', 0);
  say('B 帶頭的那一邊，高度是 h + 1', '（原本 A 是平衡的）');
  await step(tok);                                   // 25:20 扣掉 B 那一層：B_L、B_R 都是 h
  glow(G.B.m, null); kill(hb);
  glow(G.BL.m, GOLD); glow(G.mid.m, GOLD);
  say('扣掉 B 自己那一層', 'B_L 和 B_R 的高度都是 h');
  await step(tok);                                   // 25:42 加一個 node 進來就多一層
  glow(G.BL.m, null); glow(G.mid.m, null); remove(hint);
  await rotGenY(G, tok);
  relabel(G.BL.m, 'B_L h+1');
  say('Y 加進 B_L 底下：多了一層', 'B_L 變成 h + 1');
  await step(tok);                                   // 25:52 再加上 B 這層：h + 2
  glow(G.B.m, GOLD);
  const hb2 = bbPin(G.B, 'B 這邊 h + 2', 'note', 0);
  say('再加上 B 這個 node 那一層', 'A 的 left subtree 高 h + 2');
  await step(tok);                                   // 26:00 h + 2 − h
  glow(G.B.m, null);
  say('A 的 BF：左邊減右邊', '(h + 2) − h');
  await step(tok);                                   // 26:07 BF(A) = 2
  kill(hb2);
  bbNote(G.A, 'bf 2', 'ptr alt'); glow(G.A.m, RED); bbEdges(t);
  say('BF(A) = 2 → A 違規了', '');
  talk(g, 'A 爆掉了', 'wow');
  await step(tok);                                   // 26:45 BF(B) = (h + 1) − h = 1
  bbNote(G.B, 'bf 1'); bbEdges(t);
  say('B 的 BF：B_L 是 h + 1、B_R 是 h', '(h + 1) − h = 1');
  await step(tok);                                   // 26:55 調整：A 往下壓
  say('Y 在 A 的 left subtree 的 left → LL 調整', '先看 A：它要往下壓');
  await step(tok);                                   // 27:30 A 往下壓、B 往上提
  bbRotUp(t, G.B); glow(G.A.m, null);
  await bbLay(t, tok, 1100);
  say('A 往下壓、B 往上提', 'B 變成這一塊的新 root');
  talk(g, 'B 上去了');
  await step(tok);                                   // 27:53 B_R 放到 A 的下面
  glow(G.mid.m, GOLD);
  say('還有一件事：把 B_R 接到 A 的下面', 'B_R 變成 A 的 left subtree');
  await step(tok);                                   // 28:19 B_R 裡的值都比 B 大
  const c1 = note('B_R 的值 > B', G.mid.m.position.x - 1.3, 2.0, 1.0);
  say('可以這樣接嗎？B_R 裡所有的值都比 B 大', '');
  await step(tok);                                   // 28:27 但都比 A 小
  txt(c1, 'B < B_R 的值 < A ✓');
  say('而且都比 A 小', '放在 A 的左邊、B 的右邊下面：仍然是 BST');
  await step(tok);                                   // 28:49 兩邊都是 h：平衡
  glow(G.mid.m, null);
  bbNote(G.A, 'bf 0'); bbNote(G.B, 'bf 0'); bbEdges(t);
  for (const n of [G.A, G.B]) glow(n.m, GREEN);
  say('A 底下兩邊都是 h → BF(A) = 0', 'B 兩邊都是 h + 1 → BF(B) = 0');
  talk(g, '平衡了！', 'happy');
  await step(tok);                                   // 29:01 整理：判斷 LL → 下壓 → 搬 B_R
  note('LL：B 上提、A 下壓、B_R 給 A', 0, 0.4, 1.4);
  say('LL 的做法：判斷是 LL → A 壓下、B 提上 → B_R 搬給 A', '回去再對著圖看一次');
}]);

// 29:28 RR 通式
FRAG.push(['bstb-rr-general', 'RR 通式：LL 的鏡像', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(-6.2, 2.8);
  const G = rotGenTree(true), t = G.t;
  await step(tok);                                   // 29:28 RR 跟 LL 顛倒：鏡像
  await bbLay(t, tok, 700, 3);
  bbNote(G.A, 'bf −1'); bbNote(G.B, 'bf 0'); bbEdges(t);
  say('RR 跟 LL 剛好顛倒，像照鏡子', 'A、B 加上 A_L、B_L、B_R');
  talk(g, '鏡子裡的 LL');
  await step(tok);                                   // 29:38 Y 在 A 的 right subtree 的 right
  await rotGenY(G, tok);
  relabel(G.BL.m, 'B_R h+1');
  bbNote(G.A, 'bf −2', 'ptr alt'); glow(G.A.m, RED); bbEdges(t);
  say('Y 插在 A 的 right subtree 的 right', 'BF(A) = h − (h + 2) = −2');
  await step(tok);                                   // 29:50 B 往上提、A 往左下壓
  bbRotUp(t, G.B); glow(G.A.m, null);
  await bbLay(t, tok, 1100);
  say('B 往上提，A 往左下壓', '');
  await step(tok);                                   // 29:58 B_L 丟給 A 當 right subtree
  glow(G.mid.m, GOLD);
  say('B_L 丟給 A 當 right subtree', 'A < B_L 的值 < B：仍是 BST');
  await step(tok);                                   // 30:11 會 LL 就會 RR
  glow(G.mid.m, null);
  bbNote(G.A, 'bf 0'); bbNote(G.B, 'bf 0'); bbEdges(t);
  say('會 LL 就會 RR', '左右對調而已');
  talk(g, '學一送一', 'happy');
}]);

// LR / RL 通式的樹：B_L、C_L、C_R、A_R 四塊（mirror = RL）
function lrGenTree(mirror, kase, x0) {
  const sp = mirror
    ? [[1, 'A_L', 'blk'], [2, 'A'], [3, 'C_L', 'blk'], [4, 'C'], [5, 'C_R', 'blk'], [6, 'B'], [7, 'B_R', 'blk']]
    : [[1, 'B_L', 'blk'], [2, 'B'], [3, 'C_L', 'blk'], [4, 'C'], [5, 'C_R', 'blk'], [6, 'A'], [7, 'A_R', 'blk']];
  const yk = kase === 'c' ? 4.5 : 2.5;
  const t = bbTree([1, 2, 3, 4, 5, 6, 7, yk], { gap: 1.05, top: 6.6, dy: 1.3, x0 });
  const ins = mirror ? [2, 1, 6, 4, 7, 3, 5] : [6, 2, 7, 1, 4, 3, 5];
  for (const k of ins) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  return { t, yk, A: bbFind(t, mirror ? 2 : 6), B: bbFind(t, mirror ? 6 : 2), C: bbFind(t, 4), blocks: () => bbList(t).filter((n) => n.kind === 'blk') };
}

// 30:26 LR（a）三個 node、LR 通式
FRAG.push(['bstb-lr-general', 'LR 通式：C 拉上來，四塊照順序接', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.3, 2.9);
  const s = bbTree([1, 2, 3], { gap: 1.4, top: 6.4, dy: 1.4, x0: -4.6 });
  for (const [k, l] of [[3, 'A'], [1, 'B'], [2, 'C']]) bbPut(s, bbNode(k, l));
  await step(tok);                                   // 30:28 最單純：只有三個 node
  await bbLay(s, tok, 700, 3);
  glow(bbFind(s, 3).m, RED);
  tag('LR(a)', 'ptr', -4.6, 7.4, 0);
  say('LR 有幾種情況；最單純的 (a)：只有三個 node', 'C 在 A 的 left subtree 的 right');
  talk(g, '先看簡單的');
  await step(tok);                                   // 30:41 把 C 調上來
  bbRotUp(s, bbFind(s, 2)); bbRotUp(s, bbFind(s, 2));
  glow(bbFind(s, 3).m, null);
  await bbLay(s, tok, 1000);
  say('把 C 調上來', '');
  await step(tok);                                   // 30:51 A、B 放在它下面：平衡
  for (const n of bbList(s)) { bbNote(n, 'bf 0'); glow(n.m, GREEN); } bbEdges(s);
  say('B、A 放在 C 的下面', '三個 node 的 BF 都是 0：平衡');
  await step(tok);                                   // 31:06 一般的圖：A、B、C
  const G = lrGenTree(false, 'b', 2.4), t = G.t;
  bbList(t);
  for (const n of [G.A, G.B, G.C]) { const [x, y] = bbPos(t, n); n.m = cube(n.lab, bbCol(n.k), [0.95, 0.8, 0.9], x, y, 0, 3); }
  { const a = K.land(G.A.m), b = K.land(G.B.m), c = K.land(G.C.m); t.edges.push(line(a.x, a.y - 0.4, b.x, b.y + 0.4), line(b.x, b.y - 0.4, c.x, c.y + 0.4)); }
  say('再看一般的圖：三個 node A、B、C', '');
  await step(tok);                                   // 31:18 B_L、C_L、C_R、A_R 四塊 subtree
  await bbLay(t, tok, 700, 3);
  say('加上四塊 subtree：B_L、C_L、C_R、A_R', '');
  await step(tok);                                   // 31:27 insert 一個新 node，A 違規
  const y = bbPut(t, bbNode(G.yk, 'Y')); y.col = PINK; await bbLay(t, tok, 800);
  glow(G.A.m, RED);
  say('insert 一個新 node 進來', '上面的 A 違反規定');
  talk(g, 'A 又違規', 'wow');
  await step(tok);                                   // 31:34 在 A 的 left subtree（B 那棵）
  glow(G.B.m, GOLD);
  say('新 node 在 A 的 left subtree 裡', '就是 B 帶頭的那一棵');
  await step(tok);                                   // 31:43 的 right → LR
  glow(G.C.m, GOLD);
  const lr = tag('LR', 'ptr alt', 2.4, 7.6, 0);
  say('在 B 的右邊 → left subtree 的 right', '符合 LR 的調整');
  await step(tok);                                   // 31:58 調整後會長這樣
  say('LR 調整後長什麼樣？', '只看三個點時一樣：C 會跑到最上面');
  await step(tok);                                   // 32:07 C 拉到 root，A、B 往下壓
  kill(lr); [G.A, G.B, G.C].forEach((n) => glow(n.m, null));
  bbRotUp(t, G.C); bbRotUp(t, G.C);
  await bbLay(t, tok, 1200);
  say('C 拉到 root，A 和 B 往下壓', '');
  talk(g, 'C 上去了');
  await step(tok);                                   // 32:30 四個 block 分給 A、B
  const bl = G.blocks();
  for (const b of bl) glow(b.m, GOLD);
  say('剩下四個 block：B_L、C_L、C_R、A_R', '要分配到 A、B 底下');
  await step(tok);                                   // 32:52 原則：符合 BST
  for (const b of bl) glow(b.m, null);
  say('怎麼放？只要記住一個原則：符合 BST', '左子樹 < parent < 右子樹');
  await step(tok);                                   // 33:23 照順序 B_L, C_L, C_R, A_R
  const tags = bl.map((b, i) => tag(String(i + 1), 'pkt', b.m.position.x, b.m.position.y - 0.75, 0));
  say('照順序：B_L、C_L、C_R、A_R 由左到右', '依序接到 B、A 底下（每個 node 只有 2 個 child）');
  await step(tok);                                   // 33:36 C_L 接在 B 的右邊：C_L 都比 B 大
  tags.forEach(remove);
  const cl = bl[1]; glow(cl.m, GOLD);
  say('C_L 接在 B 的右邊', 'C_L 本來就在 B 的右子樹裡：全部比 B 大 ✓');
  await step(tok);                                   // 33:52 C_R 接在 A 的左邊：比 A 小、比 C 大
  glow(cl.m, null); const cr = bl[2]; glow(cr.m, GOLD);
  say('C_R 接在 A 的左邊', 'C_R 本來就比 A 小、又比 C 大 ✓');
  await step(tok);                                   // 34:16 技巧：ABC → C 上來 → 四塊依序接
  glow(cr.m, null);
  note('ABC 確認 → C 拉上來 → 1 2 3 4 由左到右接', 2.4, 0.4, 1.4);
  say('解題技巧：先確認 A、B、C', 'C 拉上來當 root，四塊由左到右接回去');
  talk(g, '照順序接就對了', 'happy');
}]);

// 34:37 對照月份例：A = MAY、B = AUG、C = MAR
FRAG.push(['bstb-month-lr-map', '對照月份例：A = MAY、B = AUG、C = MAR', async (tok) => {
  fresh(...CAMB);
  const g = pal();
  const t = monthTree(['MAR', 'MAY', 'NOV', 'AUG', 'APR']); t.warn = false;
  const jan = bbPut(t, bbNode('JAN'));
  const pin = [];
  await step(tok);                                   // 34:37 實際的情況
  await bbLay(t, tok, 700, 2.5); bbShow(t, true);
  say('拿實際的例子對照：insert JAN 之後', '');
  talk(g, '對照一下');
  await step(tok);                                   // 34:44 A = MAY、B = AUG、C = MAR
  const A = bbFind(t, 'MAY'), B = bbFind(t, 'AUG'), C = bbFind(t, 'MAR');
  pin.push(bbPin(A, 'A'), bbPin(B, 'B', 'ptr'), bbPin(C, 'C', 'ptr'));
  glow(A.m, RED);
  say('在這個例子裡：A = MAY、B = AUG、C = MAR', '');
  await step(tok);                                   // 34:56 C 提上來，A、B 當 child
  pin.forEach(kill); glow(A.m, null);
  bbRotUp(t, C); bbRotUp(t, C); t.hide = true;
  await bbLay(t, tok, 1100);
  say('C（MAR）被提到最上面', 'B = AUG 在左、A = MAY 在右');
  await step(tok);                                   // 35:06 B_L = APR
  const apr = bbFind(t, 'APR'); glow(apr.m, GOLD);
  const l1 = tag('B_L', 'pkt', apr.m.position.x, apr.m.position.y - 0.8, 0);
  say('下面的 block：B_L 就是 APR', '');
  await step(tok);                                   // 35:14 C_L = JAN（新加進來的）
  glow(apr.m, null); glow(jan.m, GOLD);
  const l2 = tag('C_L', 'pkt', jan.m.position.x, jan.m.position.y - 0.8, 0);
  say('C_L 是我們剛加進來的 JAN', '只有一個 node');
  await step(tok);                                   // 35:16 C 有沒有 right subtree？沒有
  glow(jan.m, null);
  const l3 = note('C_R：空的', 0.6, 2.2, 1.0);
  say('C（MAR）原本有 right subtree 嗎？沒有', 'C_R 是空的');
  await step(tok);                                   // 35:27 A_R = NOV
  const nov = bbFind(t, 'NOV'); glow(nov.m, GOLD);
  const l4 = tag('A_R', 'pkt', nov.m.position.x, nov.m.position.y - 0.8, 0);
  say('A_R 就是 NOV', '');
  await step(tok);                                   // 35:37 看圖說話
  glow(nov.m, null);
  bbShow(t, true); for (const n of bbList(t)) glow(n.m, GREEN);
  say('所以叫「依樣畫葫蘆」：看圖說話', '對應好每一塊是誰，就做完了');
  talk(g, '看圖說話 ✓', 'happy');
  await step(tok);                                   // 35:46 ABC 確認 → C 上來 → block 從左到右
  [l1, l2, l3, l4].forEach(remove);
  note('ABC → C 上來 → block 由左到右接回去', 0, 0.4, 1.6);
  say('不管怎樣：ABC 確認 → 最下面的 C 放上來', 'A、B 往下壓，四個 block 從左到右維持順序接上');
}]);

// 36:12 LR(b)、LR(c)：Y 在 C_L 或 C_R 下
FRAG.push(['bstb-lr-bc', 'LR(b)、LR(c)：Y 在 C_L 或 C_R 下', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(-6.2, 2.8);
  const G = lrGenTree(false, 'c', 0.4), t = G.t;
  await step(tok);                                   // 36:12 相同的情況：LR(c)
  await bbLay(t, tok, 600, 3);
  const y = bbPut(t, bbNode(G.yk, 'Y')); y.col = PINK; await bbLay(t, tok, 700);
  tag('LR(c)', 'ptr', 0.4, 7.6, 0);
  say('另一張圖，一樣是 LR', '這次 Y 插在 C_R 底下');
  await step(tok);                                   // 36:29 Y 在 A 的 left subtree 的 right；ABC 知道了
  glow(G.A.m, RED);
  const pins = [bbPin(G.A, 'A'), bbPin(G.B, 'B', 'ptr'), bbPin(G.C, 'C', 'ptr')];
  say('Y 在 A 的 left subtree 的 right', 'A、B、C 都知道了');
  await step(tok);                                   // 36:40 C 往上拉，B、A 往下壓
  pins.forEach(kill); glow(G.A.m, null);
  bbRotUp(t, G.C); bbRotUp(t, G.C);
  await bbLay(t, tok, 1200);
  say('跟上一頁一樣：C 往上拉，B 和 A 往下壓', '');
  talk(g, '同一招');
  await step(tok);                                   // 36:48 B_L、C_L、C_R、A_R 照順序接
  const bl = G.blocks();
  const nums = bl.map((b, i) => tag(String(i + 1), 'pkt', b.m.position.x, b.m.position.y - 0.75, 0));
  say('B_L、C_L、C_R、A_R 維持順序，從左到右', '接到 B 和 A 底下');
  await step(tok);                                   // 37:07 順序都不會改變
  for (const b of bl) glow(b.m, GOLD);
  say('A、B、C 往上拉、往下壓', '四個 block 的順序從頭到尾都不會變');
  await step(tok);                                   // 37:26 實際 run：誰對應 B_L、C_L、C_R
  for (const b of bl) glow(b.m, null); nums.forEach(remove);
  say('實際做題：看清楚 B_L、C_L、C_R 對應到誰', '就搞定了');
  talk(g, '對應好就好', 'happy');
  await step(tok);                                   // 37:48 LR 分三個 case：(a) 沒有 subtree
  const ca = note('LR(a)：下面沒有 subtree → C 上、B A 下，結束', -2.6, 0.9, 1.4);
  say('LR 其實分三個 case', '(a)：下面沒有任何 subtree，最簡單');
  await step(tok);                                   // 38:08 一般的情況：LR(b)、LR(c)
  const cb = note('LR(b)、LR(c)：四塊照順序接', -2.6, 0.2, 1.4);
  say('一般的情況：LR(b) 或 LR(c)', '');
  await step(tok);                                   // 38:21 差別：Y 在 C_L 下還是 C_R 下
  txt(cb, 'LR(b)：Y 在 C_L 下｜LR(c)：Y 在 C_R 下');
  say('(b) 和 (c) 只差在新 node 插在 C_L 下面還是 C_R 下面', '兩個都是 LR，做法一樣');
  await step(tok);                                   // 38:35 ABC 確認 → C 上拉 → block 接上
  void ca;
  say('簡單吧：ABC 確認 → C 往上拉、B A 往下壓', '底下的 block 照順序決定 parent');
}]);

// 38:47 RL 與「每插一個就調整」
FRAG.push(['bstb-rl-mirror', 'RL 與「每插一個就調整」', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(-6.3, 2.9);
  const G = lrGenTree(true, 'b', 1.2), t = G.t;
  await step(tok);                                   // 38:50 RL：會 LR 就會 RL
  await bbLay(t, tok, 600, 3);
  const y = bbPut(t, bbNode(G.yk, 'Y')); y.col = PINK; await bbLay(t, tok, 700);
  glow(G.A.m, RED);
  tag('RL', 'ptr alt', 1.2, 7.6, 0);
  say('RL：Y 在 A 的 right subtree 的 left', '你會 LR，就會 RL');
  await step(tok);                                   // 38:59 像鏡子一樣
  glow(G.A.m, null);
  bbRotUp(t, G.C); bbRotUp(t, G.C);
  await bbLay(t, tok, 1200);
  say('像照鏡子：C 拉上來，A 在左、B 在右', '四塊 A_L、C_L、C_R、B_R 照順序接');
  talk(g, '鏡子 🪞');
  await step(tok);                                   // 39:08 AVL 其實很簡單
  say('AVL 其實沒有那麼複雜', '厲害的是當初想出怎麼調整的人');
  talk(g, '其實不難嘛', 'happy');
  await step(tok);                                   // 39:18 站在別人的肩膀上
  note('前人寫好的論文，經過歷史驗證', 1.2, 0.5, 1.4);
  say('你是站在別人的肩膀上', '論文早就寫出來，也經過驗證了');
  await step(tok);                                   // 39:30 每增加一個 node 就要調整
  for (const n of bbList(t)) { kill(n.m); } t.edges.forEach(kill);
  const qs = ['K1', 'K2', 'K3', 'K4'].map((k, i) => cube(k, BB_PAL[i], [0.8, 0.6, 0.8], -4.5 + i * 1.0, 0.4, 1.4));
  const tr = cube('AVL', '#2fc092', [1.6, 1.0, 1.0], 2.8, 3.6, 0, 2);
  say('每增加一個 node 進來', '就要做一次計算、一次調整');
  await travel(tok, qs[0], qs[0].position.clone(), V3(2.8, 4.6, 0), 800);
  await step(tok);                                   // 39:50 算完就調整
  kill(qs[0]); glow(tr, GOLD);
  note('進來 → 算 BF → 調整', 2.8, 5.6, 0);
  say('一個進來 → 算 BF → 違規就調整', '下一個再來一次');
  await step(tok);                                   // 39:58 能不能插 k 個再一次調整？
  glow(tr, null);
  note('能不能插 k 個，再一次調整？', -3.0, 2.2, 1.4);
  say('有人問：每次都要算、要調，有沒有更快的方法？', '先 insert k 個，再一次調整多一點？');
  talk(g, '可以嗎？', 'wow');
  await step(tok);                                   // 40:14 回去想想看
  say('回去想一想', '（提示：一次插很多個，A 可能不只一個、情況會變複雜）');
  talk(g, '回去想想 🤔', 'calm');
}]);

// 40:32 各種結構比較：search x、第 k 小；建 AVL 的成本
FRAG.push(['bstb-avl-cost', 'AVL vs sequential list vs linked list', async (tok) => {
  fresh([0, 4.6, 14], [0, 3.6, 0]);
  const g = pal(6.3, 2.8);
  const sorted = [...BB_MON].sort();
  const t = bbTree(BB_MON, { gap: 0.9, top: 3.6, dy: 0.72 });
  bbAvlSilent(t, BB_MON);
  await step(tok);                                   // 40:36 先看 operation：找 x
  await bbLay(t, tok, 600, 2);
  tag('AVL tree', 'ptr', -5.6, 3.8, 0);
  say('建好的 AVL tree 效率怎麼樣？', '第一個 operation：search x（例：找 OCT）');
  await step(tok);                                   // 40:40 AVL：最差就是樹的高度 → log n
  const cur = bbCursor(t.root, '找 OCT');
  await bbRun(tok, cur, pathTo(t, 'OCT'), 350);
  glow(bbFind(t, 'OCT').m, GREEN); remove(cur);
  say('AVL：最差就是走完樹的高度', 'search x：O(log n)');
  await step(tok);                                   // 40:47 sequential list：排序好的
  tag('sequential list', 'ptr', -6.0, 7.2, 0);
  const arr = sorted.map((k, i) => cube(k, bbCol(k), [0.85, 0.6, 0.8], -4.95 + i * 0.9, 6.6, 0, 2));
  say('sequential list：從小排到大（已排序）', '');
  await step(tok);                                   // 41:11 binary search → log n
  const ti = sorted.indexOf('OCT');
  let lo = 0, hi = 11;
  while (lo <= hi) { const m = (lo + hi) >> 1; glow(arr[m], GOLD); await beat(tok, 400); glow(arr[m], null); if (m === ti) { glow(arr[m], GREEN); break; } if (m < ti) lo = m + 1; else hi = m - 1; }
  say('排序過 → binary search：每次比中間那個', 'search x：O(log n)');
  await step(tok);                                   // 41:42 linked list：沒排序
  tag('linked list', 'ptr', -6.0, 5.8, 0);
  const ll = BB_MON.map((k, i) => cube(k, bbCol(k), [0.85, 0.6, 0.8], -4.95 + i * 0.9, 5.2, 0, 2));
  say('linked list：沒有排序，進來就接上去', '（照 insert 的順序）');
  await step(tok);                                   // 41:48 從頭一個一個找 → n
  const li = BB_MON.indexOf('OCT');
  for (let i = 0; i <= li; i++) { glow(ll[i], GOLD); await beat(tok, 130); glow(ll[i], null); }
  glow(ll[li], GREEN);
  say('只能從 list 的頭一個一個檢查', 'search x：O(n)');
  talk(g, '好慢', 'sad');
  await step(tok);                                   // 42:05 第 k 小：sequential O(1)
  arr.forEach((m) => glow(m, null)); ll.forEach((m) => glow(m, null));
  glow(arr[7], GOLD);
  const kk = tag('第 8 小 = A[7]', 'pkt', arr[7].position.x, 7.4, 0);
  say('找第 k 小的 item：sequential list 已排序', '直接看第 k 格 → O(1)');
  await step(tok);                                   // 42:12 AVL 找第 k 小也是 log n？
  say('AVL tree 找第 k 小，為什麼也是 O(log n)？', '想想 BST 那一章學過的欄位');
  talk(g, '為什麼？', 'wow');
  await step(tok);                                   // 42:42 多一個欄位：左邊有幾個 node
  const sz = (n) => (n ? 1 + sz(n.l) + sz(n.r) : 0);
  for (const n of bbList(t)) bbNote(n, String(sz(n.l)));
  bbEdges(t);
  say('每個 node 多存一個欄位：leftSize', '左子樹有幾個 node（不含自己）');
  await step(tok);                                   // 43:31 有 leftSize：只要走樹的高度
  kill(kk);
  let k = 8, c = t.root; const cur2 = bbCursor(c, 'k=8');
  while (c) {
    const L = sz(c.l); bbAt(cur2, c); txt(cur2, 'k=' + k); glow(c.m, GOLD);
    await beat(tok, 450); glow(c.m, null);
    if (k === L + 1) break;
    if (k <= L) c = c.l; else { k -= L + 1; c = c.r; }
  }
  glow(c.m, GREEN);
  say('有 leftSize：每到一個 node 決定往左或往右', '第 8 小 = ' + c.k + '：只走樹高 → O(log n)');
  talk(g, '只走一條路', 'happy');
  await step(tok);                                   // 43:59 表：AVL 幾乎都是 log n
  remove(cur2);
  note('AVL：search、第 k 小、insert、delete 都 O(log n)', 0, 8.2, 0);
  say('整理成表：AVL tree 的操作幾乎都是 log n', '效率很不錯');
  await step(tok);                                   // 44:13 那建 AVL tree 要多少成本？
  note('問題：建一棵 AVL tree 的成本？', -2.4, 1.2, 2.0);
  say('反過來問：建這棵 AVL tree 要花多少？', '沒有白吃的午餐');
  talk(g, '要多久？', 'wow');
  await step(tok);                                   // 45:00 期末考可能考
  say('每個 node 都要 insert、判斷、調整', '期末考可能會問（提示：n 次 × O(log n)）');
  talk(g, '考試會考！', 'calm');
}]);

// ═══ FNeL18KsWPc ═══
const CAMM = [[0, 4.4, 13.5], [0, 3.4, 0]];
const mitTree = (extra = [], o = {}) => bbTree([...BB_MIT, ...extra], Object.assign({ gap: 1.5, top: 6.6, dy: 1.4 }, o));
function ioList(t) { const out = []; (function go(n) { if (!n) return; go(n.l); out.push(n); go(n.r); })(t.root); return out; }
// 00:22 BST 性質與 in-order traversal
FRAG.push(['bstb-mit-inorder', 'In-order traversal：11, 20, 26 … 65', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree();
  await step(tok);                                   // 0:22 BST：動態排序，元素來來去去
  bbBstSilent(t, BB_MIT); await bbLay(t, tok, 900, 3);
  say('BST：一種「動態」的排序', '資料隨時進進出出，還是隨時知道排好的順序');
  talk(g, '今天繼續講 sorting');
  await step(tok);                                   // 0:41 tree、binary、search property 三件事
  const three = note('BST = tree + binary + search property', 0, 0.4, 1.6);
  say('binary search tree 有三件事', '它是 tree、是 binary、有 search property');
  await step(tok);                                   // 0:51 rooted binary tree：root、left / right child
  glow(t.root.m, GOLD); glow(t.root.l.m, '#1a3a5a'); glow(t.root.r.m, '#1a3a5a');
  const rl = bbPin(t.root, 'root', 'pkt', 0);
  say('rooted binary tree：最上面有 root', '每個 node 最多一個 left child、一個 right child');
  await step(tok);                                   // 0:56 有的 node 缺 child；每個 node 存 key
  [t.root, t.root.l, t.root.r].forEach((n) => glow(n.m, null)); kill(rl);
  for (const n of bbList(t)) if (!n.l || !n.r) glow(n.m, '#4a3600');
  say('有些 node 少一個 child、有些兩個都沒有', '每個 node 都存一個 key（方塊上的數字）');
  await step(tok);                                   // 1:05 search property：左 ≤ x ≤ 右
  for (const n of bbList(t)) glow(n.m, null);
  const r = t.root; glow(r.m, GOLD);
  const gl = ghostBox('#4b9ee2', 4.2, 3.6, 1.4); gl.position.set(-2.25, 4.0, 0);
  const gr = ghostBox(PINK, 2.6, 2.2, 1.4); gr.position.set(3.75, 4.6, 0);
  const lt = tag('全部 ≤ 41', 'ptr', -2.25, 1.8, 0), rt = tag('全部 ≥ 41', 'ptr', 3.75, 3.1, 0);
  say('search property：x 的左子樹全部 ≤ x', '右子樹全部 ≥ x');
  await step(tok);                                   // 1:22 不只 child，所有子孫
  glow(bbFind(t, 26).m, GOLD); glow(bbFind(t, 50).m, GOLD);
  say('不只左右 child：底下每一個子孫都要符合', '例如 26 在很深的地方，也一定 ≤ 41');
  talk(g, '子孫通通算', 'wow');
  await step(tok);                                   // 1:30 要知道排序：in-order traversal
  [gl, gr, lt, rt, three].forEach(kill); for (const n of bbList(t)) glow(n.m, null);
  say('想知道排好的順序：做 in-order traversal', '');
  await step(tok);                                   // 1:37 遞迴走左、印 root、遞迴走右
  note('in-order(x)：走左 → 印 x → 走右', 0, 0.4, 1.6);
  say('看一個 node：先遞迴走 left child', '再印自己，最後遞迴走 right child');
  const io = ioList(t), cur = bbCursor(t.root, '▼');
  const out = [];
  const pr = (n, i) => { bbAt(cur, n); glow(n.m, GREEN); out.push(cube(n.k, bbCol(n.k), [0.9, 0.6, 0.8], -4.2 + i * 1.4, 0.3, 2.6, 2.5)); };
  await step(tok);                                   // 1:44 left、left、print 11、print 20
  for (let i = 0; i < 2; i++) { pr(io[i], i); await beat(tok, 450); }
  say('往左、往左：印 11；回來印 20', '');
  await step(tok);                                   // 1:50 26、29、41、50、65
  for (let i = 2; i < io.length; i++) { pr(io[i], i); await beat(tok, 380); }
  remove(cur);
  say('往右、往左：印 26、29；往上印 41', '再往右：印 50、65');
  talk(g, '印完了', 'happy');
  await step(tok);                                   // 1:57 檢查：是排序好的
  out.forEach((m) => glow(m, GREEN));
  say('印出來 11, 20, 26, 29, 41, 50, 65', '正好是排好的順序');
  await step(tok);                                   // 2:10 今天的主題：balance
  for (const n of bbList(t)) glow(n.m, null);
  say('今天的主題：balance（平衡）', '');
  talk(g, '今天講 balance');
}]);

// 02:16 BST 操作 O(h)；balanced h = Θ(log n) vs path h = n
FRAG.push(['bstb-mit-balance', 'O(h)：balanced 是 log n，path 是 n', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree([30], { gap: 1.4 });
  bbBstSilent(t, BB_MIT);
  await step(tok);                                   // 2:16 基本 BST insert：沿著樹往下走
  await bbLay(t, tok, 700, 2.5);
  say('上次學的 BST insert：沿著樹往下走', '找到新 key 該放的位置');
  await step(tok);                                   // 2:26 insert 30：左、右、右
  const cur = bbCursor(t.root, '30');
  await bbRun(tok, cur, [41, 20, 29].map((k) => bbFind(t, k)), 550);
  say('insert 30：比 41 小往左、比 20 大往右、比 29 大往右', '');
  await step(tok);                                   // 2:29 30 放在這裡
  remove(cur);
  const n30 = bbPut(t, bbNode(30)); await bbLay(t, tok, 800); glow(n30.m, GOLD);
  say('走到空位：30 就放在 29 的右邊', '');
  await step(tok);                                   // 2:31 insert、delete、successor、predecessor
  glow(n30.m, null);
  const ops = ['insert', 'delete', 'successor', 'predecessor'].map((s, i) => tag(s, 'pkt', -4.5 + i * 2.6, 0.4, 1.6));
  say('同樣做得到：insert、delete', '找下一個比較大 / 比較小的：successor / predecessor');
  await step(tok);                                   // 2:47 都是 O(h)，h = 高度
  ops.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  note('全部 O(h)，h = 樹的高度', 0, 1.4, 1.6);
  say('這些操作都是 O(h) 時間', 'h 是 BST 的高度');
  talk(g, 'h 是多少？');
  await step(tok);                                   // 3:08 log n？不一定 → balance 的問題
  say('h 是 log n 嗎？如果是就太好了', '可惜不一定 → 這就是 balance 的問題');
  talk(g, '不一定喔', 'calm');
  await step(tok);                                   // 3:22 理想：perfectly balanced
  fresh(...CAMM);
  const g2 = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const L = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 0.8, top: 6.4, dy: 1.3, x0: -3.4 });
  bbBstSilent(L, [4, 2, 6, 1, 3, 5, 7]); await bbLay(L, tok, 700, 3);
  say('理想的世界：perfectly balanced BST', '每一層都排滿');
  talk(g2, '漂亮！', 'happy');
  await step(tok);                                   // 3:32 height ≈ log n
  tag('h ≈ log n', 'ptr alt', -3.4, 1.6, 0);
  say('它的高度大約是 log n', 'Θ(log n)：大約等於');
  await step(tok);                                   // 3:48 也可能是一條 path
  const R = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 0.75, top: 7.0, dy: 0.9, x0: 3.0 });
  bbBstSilent(R, [1, 2, 3, 4, 5, 6, 7]); await bbLay(R, tok, 900, 3);
  say('但上一堂最後看過：也可能非常不平衡', '整棵樹就是一條 path');
  talk(g2, '歪掉了', 'sad');
  await step(tok);                                   // 3:54 height = n
  tag('h = n', 'ptr alt', 4.6, 1.0, 0);
  say('這時高度就是 n', '');
  await step(tok);                                   // 4:10 height = 從 root 往下最長路徑
  const pth = []; for (let c = R.root; c; c = c.r) pth.push(c);
  const c2 = bbCursor(R.root, '▼');
  await bbRun(tok, c2, pth, 180);
  remove(c2);
  say('height 的定義：從 root 一直往下走到 leaf', '最長那條路徑的長度');
  await step(tok);                                   // 4:40 左邊路徑都 log n；右邊有 n、平均 n/2
  say('左邊每條路徑都只有 log n', '右邊有一條長 n，平均也有 n/2：very unbalanced');
  await step(tok);                                   // 5:04 balanced 的正式定義：h = O(log n)
  note('balanced ⇔ height = O(log n)', 0, 0.4, 1.6);
  say('正式定義：高度是 O(log n) 就叫 balanced', '');
  await step(tok);                                   // 5:26 至少 log n → Θ(log n)
  say('n 個 key 放進 binary tree，高度至少 log n', '所以 balanced 的樹高度是 Θ(log n)');
  await step(tok);                                   // 5:36 今天的目標：AVL tree
  tag('今天：AVL tree（1960 年代）', 'ptr', 0, 8.0, 0);
  say('今天的目標：永遠維持 balanced', '工具是 AVL tree：60 年代最早、也最簡單的方法');
  talk(g2, 'AVL 登場', 'happy');
}]);

// 06:20 node 的高度：往下到 leaf 的最長路徑；h = max(h_L, h_R) + 1；null = −1
FRAG.push(['bstb-mit-node-height', 'Node 的高度：max(h_L, h_R) + 1', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree();
  bbBstSilent(t, BB_MIT);
  const H = (k) => bbH(bbFind(t, k)) - 1;
  const hOn = (k, cls = 'ptr alt') => { const n = bbFind(t, k); glow(n.m, GOLD); bbNote(n, 'h=' + H(k), cls); bbEdges(t); return n; };
  const off = (n) => { glow(n.m, null); bbNote(n, 'h=' + H(n.k)); bbEdges(t); };
  await step(tok);                                   // 6:20 node 的 height
  await bbLay(t, tok, 700, 2.5);
  say('除了整棵樹的高度，每個 node 也有自己的 height', '');
  talk(g, 'node 的高度？');
  await step(tok);                                   // 6:51 depth：離 root 多遠（從上往下數）
  const dep = bbList(t).map((n) => tag('d' + n.d, 'idx', n.m.position.x - 0.62, n.m.position.y - 0.1, 0.6));
  say('離 root 多遠，那叫 depth（從上往下數）', 'root 是 0，往下 1、2、3');
  await step(tok);                                   // 6:59 height：往下到 leaf 的最長路徑
  dep.forEach(remove);
  say('height 是反過來：從這個 node 往下走到 leaf', '最長路徑的長度（只能往下走）');
  await step(tok);                                   // 7:55 leaf：height 0
  const a = hOn(26);
  say('26 是 leaf：從 leaf 走到 leaf 要 0 步', 'h(26) = 0');
  await step(tok);                                   // 8:10 有一個 child：1
  off(a); const b = hOn(29);
  say('29 不是 leaf：往下一步就到 leaf', 'h(29) = 1');
  await step(tok);                                   // 8:18 可以走左（1）或走右（2）→ 取 max = 2
  off(b); const c = hOn(20);
  bbNote(bbFind(t, 11), 'h=' + H(11)); bbEdges(t);
  say('20 有兩條路：往左長 1、往右長 2', '取最長的：h(20) = 2');
  await step(tok);                                   // 8:27 這個 1、root 3
  off(c);
  for (const k of [50, 65]) bbNote(bbFind(t, k), 'h=' + H(k));
  const d = hOn(41);
  say('65 的高度是 1；root 41 的高度是 3', '');
  await step(tok);                                   // 8:43 公式：max(children) + 1
  const f = note('h(x) = max(h(左 child), h(右 child)) + 1', 0, 0.4, 1.6);
  say('怎麼算？取兩個 child 高度的最大值再 + 1', 'root：max(2, 1) + 1 = 3');
  talk(g, '看 child 就好', 'happy');
  await step(tok);                                   // 9:18 像上次的 subtree size：augmentation
  off(d);
  say('上次用 data structure augmentation', '在每個 node 多存 subtree 的 size');
  await step(tok);                                   // 9:52 這次每個 node 存 height
  t.info = 'h'; bbInfo(t); bbEdges(t);
  for (const n of bbList(t)) glow(n.m, '#1a3a5a');
  say('這次改存 height 欄位', '');
  await step(tok);                                   // 10:02 只靠 children 的 local formula → O(1)
  for (const n of bbList(t)) glow(n.m, null);
  txt(f, '只看兩個 child → 每次更新 O(1)');
  say('公式只用到左右 child 的高度（local）', '所以每次操作順便更新，只多花常數時間');
  await step(tok);                                   // 10:20 AVL 要用高度：太大就修
  say('AVL 就是靠這些 height', '存著高度，太高了就修');
  talk(g, '太高就修', 'calm');
  await step(tok);                                   // 10:51 null child 的高度定為 −1
  const n11 = bbFind(t, 11);
  const ns = [-1, 1].map((sx) => cube('−1', '#d8cfc0', [0.55, 0.35, 0.5], n11.m.position.x + sx * 0.55, n11.m.position.y - 1.1, 0, 2));
  say('leaf 下面的 null pointer：高度定成 −1', '');
  await step(tok);                                   // 11:25 leaf = max(−1, −1) + 1 = 0
  glow(n11.m, GOLD);
  txt(f, 'leaf：max(−1, −1) + 1 = 0');
  say('這樣 leaf 也能直接套公式', 'max(−1, −1) + 1 = 0，不用寫特例');
  ns.forEach((m) => glow(m, GOLD));
}]);

// 11:49 AVL 性質：每個 node |h_L − h_R| ≤ 1
FRAG.push(['bstb-mit-avl-prop', 'AVL：每個 node |h_L − h_R| ≤ 1', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree([], { info: 'h' });
  bbBstSilent(t, BB_MIT);
  await step(tok);                                   // 11:49 AVL trees
  await bbLay(t, tok, 700, 3);
  tag('AVL trees', 'ptr alt', 0, 8.0, 0);
  say('AVL tree 的想法', '');
  talk(g, 'AVL 怎麼想？');
  await step(tok);                                   // 12:36 目標：height O(log n)
  say('目標：高度維持 O(log n)', '');
  await step(tok);                                   // 12:41 換個想法：左右兩邊差不多
  say('直接想高度比較難', '改成：讓每個 node 的左右兩邊「差不多」');
  await step(tok);                                   // 12:49 比的是高度（也可以比 size）
  say('這裡比的是左右的高度', '（比 subtree size 也行，那是另一種 balanced tree）');
  await step(tok);                                   // 13:03 左右子樹畫成三角形
  const r = t.root; glow(r.m, GOLD);
  const gl = ghostBox('#4b9ee2', 4.2, 3.6, 1.4); gl.position.set(-2.25, 4.0, 0);
  const gr = ghostBox(PINK, 2.6, 2.2, 1.4); gr.position.set(3.75, 4.6, 0);
  say('一個 node 有 left subtree 和 right subtree', '習慣畫成兩個三角形');
  await step(tok);                                   // 13:11 高度 h_L、h_R
  const hl = tag('h_L = ' + (bbH(r.l) - 1), 'pkt', -2.25, 1.6, 0), hr = tag('h_R = ' + (bbH(r.r) - 1), 'pkt', 3.75, 3.0, 0);
  say('subtree 的高度 = 它的 root 的高度', '這裡 h_L = 2、h_R = 1');
  await step(tok);                                   // 13:35 |h_L − h_R| ≤ 1
  const rule = note('|h_L − h_R| ≤ 1', 0, 0.4, 1.6);
  say('希望兩邊差不多：最多差 1', '|h_L − h_R| ≤ 1');
  await step(tok);                                   // 13:48 每一個 node 都要
  [gl, gr, hl, hr].forEach(kill); glow(r.m, null);
  t.info = 'arrow'; for (const n of bbList(t)) { kill(n.tg); n.tg = null; } bbInfo(t); bbEdges(t);
  for (const n of bbList(t)) { glow(n.m, GREEN); await beat(tok, 150); }
  txt(rule, '每個 node x：|h_L − h_R| ≤ 1');
  say('而且是每一個 node 都要成立', '↙ 左邊高 1、↘ 右邊高 1、— 一樣高');
  talk(g, '每個都要', 'happy');
  await step(tok);                                   // 13:58 要求差 0：只能是完美的樹
  for (const n of bbList(t)) glow(n.m, null);
  say('為什麼不要求差 0（完全一樣高）？', '那等於強迫整棵是完美的樹');
  await step(tok);                                   // 14:15 n 不剛好就做不到
  glow(bbFind(t, 29).m, RED);
  say('n 不剛好的時候，最後總會缺一個 child', '那裡就不可能差 0：做不到');
  talk(g, '差 0 太嚴', 'sad');
  await step(tok);                                   // 14:24 差 1 就幾乎一樣好
  glow(bbFind(t, 29).m, null);
  say('允許差 1 就幾乎一樣好', '等一下證明');
  await step(tok);                                   // 14:24 而且 log n 時間就能維持
  say('而且每次 insert 只要 O(log n) 時間就能維持', '');
  talk(g, '來證明吧', 'happy');
}]);

// 14:38 最糟的 AVL：每個 node 右邊比左邊高 1；N_h = 1 + N_{h−1} + N_{h−2}
FRAG.push(['bstb-mit-sparse', '最稀疏的 AVL：Nₕ = 1 + Nₕ₋₁ + Nₕ₋₂', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const claim = note('Claim：AVL tree 是 balanced', 0, 7.6, 0);
  await step(tok);                                   // 14:38 Claim：AVL 是 balanced
  say('第一個 claim：AVL tree 一定是 balanced', '');
  talk(g, '要證明囉');
  await step(tok);                                   // 14:53 height = O(log n)
  txt(claim, 'Claim：AVL tree 的高度 = O(log n)');
  say('balanced 就是：高度永遠是 O(log n)', '先假設 AVL 性質維持得住');
  await step(tok);                                   // 15:16 最糟：n 個 node 疊到最高？
  say('最糟的情況是什麼？', 'n 個 node，怎樣疊得最高？');
  await step(tok);                                   // 15:21 反過來：固定高度，最少幾個 node
  say('反過來想：高度固定是 h', '最少能用幾個 node 蓋出來？（最稀疏的 AVL）');
  talk(g, '越省越歪');
  await step(tok);                                   // 15:55 每個 node：右邊比左邊高 1
  const t = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 1.45, top: 6.8, dy: 1.45, info: 'h', warn: false });
  for (const k of [3, 1, 5, 2, 4, 6, 7]) bbPut(t, bbNode(k, ''));
  await bbLay(t, tok, 900, 3);
  say('答案：每一個 node 都讓右邊比左邊高 1', '（左右對稱，反過來也一樣）');
  await step(tok);                                   // 16:35 右子樹每個都比左子樹高 1
  t.info = 'arrow'; for (const n of bbList(t)) { kill(n.tg); n.tg = null; } bbInfo(t); bbEdges(t);
  say('每個 node 都是 ↘（右重）', '能少一個 node 就少一個');
  await step(tok);                                   // 17:03 像碎形一樣遞迴
  const gl = ghostBox('#4b9ee2', 2.6, 2.4, 1.4); gl.position.set(-3.6, 4.8, 0);
  const gr = ghostBox(PINK, 5.4, 3.8, 1.4); gr.position.set(2.2, 4.0, 0);
  say('它是遞迴長出來的，像碎形（fractal）', '左右兩邊各自也是「最稀疏的 AVL」');
  talk(g, '碎形！', 'wow');
  await step(tok);                                   // 17:56 定義 N_h
  const nh = note('N_h = 高度 h 的 AVL tree 最少的 node 數', 0, 0.4, 1.6);
  say('不畫了，用數學：定義 N_h', 'N_h = 高度 h 的 AVL tree，最少要幾個 node');
  await step(tok);                                   // 18:20 跟我們要的相反，但解得出來就好
  say('我們真正想知道：n 個 node，高度最多多少', '先算反過來的 N_h，再倒推回去');
  await step(tok);                                   // 18:38 很不平衡：高度 n 只要 n 個 node
  say('很不平衡的樹：高度 n 只要 n 個 node', '那就慘了（N_h = h）');
  talk(g, '那樣很慘', 'sad');
  await step(tok);                                   // 18:48 希望高度 h 要塞 2^h 個：指數
  say('希望高度 h 至少要塞 2^h 個 node', '任何「常數^h」都行：倒過來就是 log');
  await step(tok);                                   // 20:45 遞迴式
  say('怎麼算 N_h？寫遞迴式（recurrence）', '');
  await step(tok);                                   // 21:16 N_{h−1} + N_{h−2}
  txt(nh, 'Nₕ = Nₕ₋₁ + Nₕ₋₂ ？');
  say('學生：Nₕ₋₁ + Nₕ₋₂', '');
  await step(tok);                                   // 21:25 再加 1：N_h = 1 + N_{h−1} + N_{h−2}
  txt(nh, 'Nₕ = 1 + Nₕ₋₁ + Nₕ₋₂');
  say('兩個學生的答案合起來', 'Nₕ = 1 + Nₕ₋₁ + Nₕ₋₂');
  talk(g, '合作成功', 'happy');
  await step(tok);                                   // 21:37 為什麼：整棵高度 h
  glow(t.root.m, GOLD);
  say('為什麼？整棵樹高度是 h', '');
  await step(tok);                                   // 21:52 比較高的一邊是 h − 1
  const t2 = tag('h − 1', 'pkt', 2.2, 1.6, 0);
  say('高度是兩邊取 max 再 + 1', '所以比較高的那邊是 h − 1 → Nₕ₋₁ 個 node');
  await step(tok);                                   // 22:06 另一邊少 1：h − 2
  const t1 = tag('h − 2', 'pkt', -3.6, 3.2, 0);
  say('另一邊再少 1：h − 2', '→ Nₕ₋₂ 個 node');
  await step(tok);                                   // 22:17 再加上 root 這一個 node
  void t1; void t2;
  say('最後加上 root 自己這 1 個', '這個 +1 很小，主要影響 base case');
  await step(tok);                                   // 22:47 解遞迴式：希望是指數
  [gl, gr].forEach(kill); glow(t.root.m, null);
  say('N_0 = 1、N_1 = 2、N_2 = 4、N_3 = 7 …', '希望它是指數成長 → 高度就是 log');
  talk(g, '會長多快？');
}]);

// N_h 的長條圖
function nhBars(tok, n, color, vals, dz = 0, w = 0.5, dx = -0.3) {
  const S = 0.11, x0 = -5.6, DX = 1.6, ms = [];
  return (async () => {
    for (let h = 0; h < n; h++) {
      const v = Math.max(0.01, vals(h) * S);
      const m = lab.box(color, [w, 1, 0.6]); m.scale.y = 0.001; m.position.set(x0 + h * DX + dx, 0, dz); lab.world.add(m); ms.push(m);
      await anim(tok, 160, (q) => { m.scale.y = Math.max(0.001, v * q); m.position.y = v * q / 2; });
    }
    return ms;
  })();
}
const NH = [1, 2, 4, 7, 12, 20, 33, 54], FIB = [0, 1, 1, 2, 3, 5, 8, 13];
function nhAxis(withVals) { for (let h = 0; h < 8; h++) { tag('h=' + h, 'idx', -5.6 + h * 1.6, 0, 1.2); if (withVals) tag(String(NH[h]), 'idx', -5.6 + h * 1.6 - 0.3, NH[h] * 0.11 + 0.35, 0); } }

// 23:07 N_h 的下界：Fibonacci → h < 1.44 log n
FRAG.push(['bstb-mit-fib', 'Fibonacci 下界：h < 1.44 log n', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.4, 0]);
  const g = pal(6.2, 2.4, '#9fd3f0', 0.5, 'Erik');
  nhAxis(true);
  await nhBars(tok, 8, '#4b9ee2', (h) => NH[h]);
  const f = note('Nₕ = 1 + Nₕ₋₁ + Nₕ₋₂', -1.6, 7.6, 0);
  await step(tok);                                   // 23:07 像 Fibonacci
  say('這個遞迴式長得像什麼？', '學生：Fibonacci！');
  talk(g, 'Fibonacci！', 'wow');
  await step(tok);                                   // 23:09 拿掉 +1 就是 Fibonacci：N_h 比較大
  await nhBars(tok, 8, '#dd8238', (h) => FIB[h], 0, 0.5, 0.3);
  txt(f, 'N_h > F_h（Fibonacci）');
  say('拿掉 +1 就是 Fibonacci 數列 F_h', '藍色 N_h 每一根都比橘色 F_h 高');
  await step(tok);                                   // 23:22 每層多加 1 → 一定更大
  say('每一層都多加 1', '所以 N_h 一定比 Fibonacci 數大');
  await step(tok);                                   // 23:27 Fibonacci 是指數成長
  say('Fibonacci 是指數成長的', '有一個精確公式');
  await step(tok);                                   // 23:45 F_h = φ^h / √5 取整
  txt(f, 'F_h = φ^h / √5（四捨五入到整數）');
  say('黃金比例 φ 的 h 次方，除以 √5，再四捨五入', '剛好就是第 h 個 Fibonacci 數');
  talk(g, '神奇吧', 'happy');
  await step(tok);                                   // 23:57 φ ≈ 1.618 > 1 → 指數
  say('只要記得 φ > 1（φ ≈ 1.618）', '所以這是指數成長的下界');
  await step(tok);                                   // 24:13 N_h > φ^h / √5，這就是 n
  txt(f, 'n ≥ N_h > φ^h / √5');
  say('高度 h 的 AVL 至少有 N_h 個 node', 'n ≥ N_h > φ^h / √5');
  await step(tok);                                   // 24:29 反過來：φ^h / √5 < n
  say('我們要的是 h 和 n 的關係', '把式子倒過來：φ^h / √5 < n');
  await step(tok);                                   // 24:40 兩邊取 log_φ
  txt(f, 'h − log_φ √5 < log_φ n');
  say('兩邊取以 φ 為底的 log', 'h 減掉一個小常數 < log_φ n');
  await step(tok);                                   // 25:01 ≈ 1.440 log₂ n
  txt(f, 'h < 1.440 log₂ n（大約）');
  say('換成電腦科學愛用的 log₂', 'h 大約 < 1.440 log₂ n');
  talk(g, '1.44 倍而已', 'happy');
  await step(tok);                                   // 25:19 高度永遠小於 1.44 log n
  say('AVL 的高度永遠小於約 1.44 log n', '常數很不錯（最好是 1）');
  await step(tok);                                   // 25:39 不背 Fibonacci：還有更簡單的方法
  say('不熟 Fibonacci？φ^h 像變魔術', '其實有更簡單的分析方法');
  talk(g, '換個方法', 'calm');
}]);

// 25:53 簡單版：N_h > 2 N_{h−2} → h < 2 log n
FRAG.push(['bstb-mit-half', '簡單版：h < 2 log n', async (tok) => {
  fresh([0, 4.0, 13.5], [0, 3.4, 0]);
  const g = pal(6.2, 2.4, '#9fd3f0', 0.5, 'Erik');
  nhAxis(true);
  await nhBars(tok, 8, '#4b9ee2', (h) => NH[h]);
  const f = note('Nₕ = 1 + Nₕ₋₁ + Nₕ₋₂', -1.6, 7.6, 0);
  await step(tok);                                   // 26:09 這個遞迴式
  say('同一個遞迴式，換個解法', '');
  await step(tok);                                   // 26:16 電腦科學家的解法：不管常數
  say('理論電腦科學家的解法：不在乎常數', '只要證明是「某個常數 × log n」');
  talk(g, '不管常數');
  await step(tok);                                   // 26:30 一個 h−1、一個 h−2：不對稱
  say('Nₕ₋₁ 和 Nₕ₋₂ 不一樣，很難算', '想辦法讓它們對稱');
  await step(tok);                                   // 26:39 都換成 h−1，還是 h−2？
  say('兩個都換成 Nₕ₋₁？還是都換成 Nₕ₋₂？', '');
  await step(tok);                                   // 26:47 換成 h−2 才對（要下界）
  say('要換成 Nₕ₋₂', '我們要證「N_h 大於某個東西」，只能換成比較小的');
  await step(tok);                                   // 26:57 ≥ 1 + 2 N_{h−2}
  txt(f, 'Nₕ > 1 + 2 Nₕ₋₂');
  say('Nₕ₋₁ ≥ Nₕ₋₂，所以 Nₕ > 1 + 2 Nₕ₋₂', '');
  await step(tok);                                   // 27:10 高度大 node 就多（歸納法）
  say('為什麼 Nₕ₋₁ ≥ Nₕ₋₂？', '高度越大，需要的 node 越多（歸納法很好證）');
  await step(tok);                                   // 27:15 把 1 丟掉：> 2 N_{h−2}
  txt(f, 'Nₕ > 2 Nₕ₋₂');
  say('丟掉 +1 只會讓右邊變小', 'Nₕ > 2 Nₕ₋₂');
  await step(tok);                                   // 27:23 像 2 的幾次方？2^{h/2}
  await nhBars(tok, 8, '#2fc092', (h) => Math.pow(2, h / 2), 0.6, 0.3, 0);
  txt(f, 'Nₕ = Ω(2^(h/2))（至少這麼多）');
  say('看起來像 2 的某次方：2^(h/2)', '綠色細長條就是 2^(h/2)，藍色一直比它高');
  await step(tok);                                   // 27:35 每兩層翻一倍
  say('h 每增加 2，node 數至少翻一倍', '');
  talk(g, '兩層翻倍', 'happy');
  await step(tok);                                   // 27:42 倒過來：h < 2 log n
  txt(f, 'h < 2 log₂ n');
  say('倒過來取 log', 'h < 2 log₂ n（2 來自每兩層才翻倍）');
  await step(tok);                                   // 27:57 真正是 1.44，但 2 log n 好證
  say('精確的最壞情況是 1.44 log n', '但 2 log n 好證得多');
  await step(tok);                                   // 28:05 作業可以用這招
  say('分析 AVL 的變形（像作業）時', '用這招就能得到「常數 × log n」');
  await step(tok);                                   // 28:20 AVL 是 balanced：維持性質就好
  say('結論：AVL tree 一定 balanced', '只要維持「左右高度差 ≤ 1」就行');
  talk(g, '證完了', 'happy');
  await step(tok);                                   // 28:32 那要怎麼維持？
  say('問題來了：這個性質要怎麼維持？', '');
  talk(g, '怎麼維持？', 'wow');
}]);

const ARW = '每個 node 上方：↙ 左重、↘ 右重、— 一樣高';
// 28:58 insert 23：BST insert → 29 雙重左重
FRAG.push(['bstb-mit-insert23', 'Insert 23：先 BST insert，29 失衡', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  await step(tok);                                   // 28:58 要支援很多操作：insert、delete
  const ops = ['insert', 'delete'].map((s, i) => tag(s, 'pkt', -3 + i * 2.2, 7.6, 0));
  say('AVL tree 要支援很多操作，特別是 insert 和 delete', '');
  await step(tok);                                   // 29:11 今天只講 insert；delete 幾乎一樣
  ops[1].element.className = 'lab-label idx';
  say('今天只講 insert', 'delete 幾乎一樣，可以看課程的程式碼');
  await step(tok);                                   // 29:32 步驟 1：simple BST insert
  const cd = code(['AVL insert(k):', '  1. simple BST insert', '  2. fix AVL property'], -3.6, 6.6, 0.62);
  cd.hl(1);
  say('步驟 1：做我們已經會的 simple BST insert', '');
  await step(tok);                                   // 29:43 往下找位置，放成新的 leaf
  say('往下找 key 該放的地方', '在那裡加一個新的 leaf');
  await step(tok);                                   // 29:49 不保證 AVL → 步驟 2：修
  cd.hl(2);
  say('這樣不保證還是 AVL', '步驟 2：fix AVL property');
  await step(tok);                                   // 30:03 步驟 2 才是重點
  say('描述很簡潔', '怎麼做步驟 2 才是有趣的地方');
  talk(g, '來看例子');
  await step(tok);                                   // 30:22 例子：insert 23
  cd.kill();
  const t = mitTree([23], { gap: 1.4, info: 'arrow', dy: 1.3 });
  bbBstSilent(t, BB_MIT); t.hide = true; await bbLay(t, tok, 800, 2.5);
  tag('insert 23', 'ptr alt', -5, 7.6, 0);
  say('例子：在這棵樹 insert 23', '');
  await step(tok);                                   // 30:36 存高度，但在意的是哪邊比較高
  say('每個 node 存了高度', '其實我們在意的只是：左邊高還是右邊高');
  await step(tok);                                   // 30:44 只存 +1、−1、0 也行
  say('所以只存左右差：+1、−1、0 也可以', '');
  await step(tok);                                   // 30:50 用箭頭標記
  bbShow(t, true);
  note(ARW, 0, 0.4, 1.6);
  say('畫成小箭頭：↙ 左邊比較高、↘ 右邊比較高', '— 兩邊一樣高');
  await step(tok);                                   // 31:04 這裡左重、這裡平衡…
  for (const n of bbList(t)) { glow(n.m, GOLD); await beat(tok, 120); glow(n.m, null); }
  say('一個一個看：左重、平衡、左重 …', '');
  await step(tok);                                   // 31:11 每個 node 只差 1：AVL
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('有箭頭的地方都只重 1', '所以這是一棵 AVL tree');
  talk(g, '是 AVL ✓', 'happy');
  await step(tok);                                   // 31:17 insert 23：< 41、> 20、< 29、< 26
  for (const n of bbList(t)) glow(n.m, null);
  const cur = bbCursor(t.root, '23');
  await bbRun(tok, cur, [41, 20, 29, 26].map((k) => bbFind(t, k)), 420);
  remove(cur);
  say('23 < 41、23 > 20、23 < 29、23 < 26', '一路走到 26 的左邊');
  await step(tok);                                   // 31:24 23 放這裡：新的 node
  const n23 = bbPut(t, bbNode(23)); t.hide = true; t.warn = false; await bbLay(t, tok, 800);
  glow(n23.m, GOLD);
  say('23 放在 26 的左邊：全新的 node', '');
  await step(tok);                                   // 31:31 高度都變了：1、0、2、3、4
  const hs = [26, 29, 20, 41].map((k) => { const n = bbFind(t, k); return tag('h=' + (bbH(n) - 1), 'pkt', n.m.position.x - 0.7, n.m.position.y + 0.95, 0); });
  say('路徑上的高度全部變了', '26 → 1、29 → 2、20 → 3、41 → 4');
  await step(tok);                                   // 31:45 這個平衡、這個左重…
  hs.forEach(remove); bbShow(t, true);
  say('先別管數字，看箭頭', '26 變左重，……');
  await step(tok);                                   // 31:55 29 雙重左重：壞消息
  const x = bbFind(t, 29); glow(x.m, RED);
  say('29 變成雙重左重 ↙↙', '左邊比右邊高 2：不是 AVL 了');
  talk(g, '壞消息', 'sad');
  await step(tok);                                   // 32:03 往上走找壞的：23、26、29 一條 path
  [n23, bbFind(t, 26), x].forEach((n) => glow(n.m, GOLD));
  say('演算法從下往上走，找到第一個壞掉的', '23、26、29 排成一條 path');
  await step(tok);                                   // 32:11 怎麼修？→ rotation
  say('要怎麼修？', '用一個新工具：rotation（旋轉）');
  talk(g, '旋轉！', 'wow');
}]);

// 32:31 rotation：left rotate x ↔ right rotate y，inorder a x b y c 不變
FRAG.push(['bstb-mit-rotate', 'Rotation：O(1) 改指標、inorder 不變', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const sp = [[1, 'a', 'blk'], [2, 'x'], [3, 'b', 'blk'], [4, 'y'], [5, 'c', 'blk']];
  const t = bbTree([1, 2, 3, 4, 5], { gap: 1.9, top: 6.4, dy: 1.6 });
  for (const k of [2, 1, 4, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  const X = bbFind(t, 2), Y = bbFind(t, 4), B = bbFind(t, 3), Aa = bbFind(t, 1), C = bbFind(t, 5);
  await step(tok);                                   // 32:31 rotation
  say('來學 rotation（旋轉）', '超酷的');
  talk(g, '超酷', 'happy');
  await step(tok);                                   // 32:47 它只是個工具
  say('它只是一個工具', '修 AVL 的時候拿來用');
  await step(tok);                                   // 33:12 x 和 y
  bbList(t);
  for (const n of [X, Y]) { const [px, py] = bbPos(t, n); n.m = cube(n.lab, bbCol(n.k), [0.95, 0.8, 0.9], px, py, 0, 3); }
  { const a = K.land(X.m), b = K.land(Y.m); t.edges.push(line(a.x, a.y - 0.4, b.x, b.y + 0.4)); }
  say('兩個 node：x，和它的右 child y', '');
  await step(tok);                                   // 33:21 left rotate(x)
  const lab1 = tag('left rotate(x) →', 'ptr alt', 0, 7.6, 0);
  say('這個動作叫 left rotate(x)', '');
  await step(tok);                                   // 33:37 BST 只需要知道 search 和 rotation
  say('binary search tree 你只需要會兩件事', 'search 和 rotation');
  await step(tok);                                   // 33:46 掛著的 subtree a、b、c
  await bbLay(t, tok, 700, 3);
  say('x、y 底下掛著三棵 subtree：a、b、c', '有的可能是空的，一樣畫成方塊');
  await step(tok);                                   // 33:56 換誰在上面；x 的 parent 變成 y 的 parent
  bbRotUp(t, Y); await bbLay(t, tok, 1100);
  say('把 x、y 誰在上面換過來', 'x 原本的 parent 變成 y 的 parent');
  talk(g, '轉！');
  await step(tok);                                   // 34:05 y 原本的 parent 是 x，現在 x 的 parent 是 y
  glow(X.m, GOLD); glow(Y.m, GOLD);
  say('原本 y 的 parent 是 x', '現在反過來：x 的 parent 是 y');
  await step(tok);                                   // 34:10 a 不變、b 換 parent、c 不變
  glow(X.m, null); glow(Y.m, null); glow(B.m, GOLD);
  say('a 的 parent 還是 x、c 的 parent 還是 y', '只有 b 換了：從 y 換成 x');
  await step(tok);                                   // 34:20 常數個指標 → O(1)
  glow(B.m, null);
  note('只改常數個指標 → O(1)', -2.6, 0.4, 1.6);
  say('只要改常數個指標', 'constant time：O(1)');
  await step(tok);                                   // 34:24 而且維持 BST 順序
  say('更重要的是：它維持 BST 的順序', '');
  await step(tok);                                   // 34:33 in-order：a x b y c
  const io = ['a', 'x', 'b', 'y', 'c'].map((s, i) => tag(s, 'pkt', 0.6 + i * 1.1, 0.4, 1.6));
  say('in-order traversal（左、自己、右）', '得到 a, x, b, y, c');
  await step(tok);                                   // 34:42 轉之前也是 a x b y c → 一樣
  io.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('轉之前做 in-order，也是 a, x, b, y, c', '一模一樣 → 還是 BST');
  talk(g, '順序沒變', 'happy');
  await step(tok);                                   // 34:55 b 的值都在 x、y 之間
  glow(B.m, GOLD);
  say('仔細看：b 裡的值都介於 x 和 y 之間', '轉完它還是夾在 x 和 y 中間');
  await step(tok);                                   // 35:03 root 往左移 → left rotate
  glow(B.m, null);
  txt(lab1, 'left rotate：root 往左下移');
  say('叫 left rotate，因為原本的 root（x）往左移', '');
  await step(tok);                                   // 35:08 right rotate(y) 轉回來
  bbRotUp(t, X); await bbLay(t, tok, 1100);
  txt(lab1, 'right rotate(y)：轉回來');
  say('反過來做 right rotate(y)', '就回到原本的樣子');
  await step(tok);                                   // 35:17 可逆的操作
  say('rotation 是可逆的', '可以用它把樹調來調去');
  talk(g, '轉過去轉回來', 'happy');
}]);

// 35:21 right rotate 29：insert 23 修好
FRAG.push(['bstb-mit-fix23', 'Right rotate(29)：insert 23 修好', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree([23], { gap: 1.4, info: 'arrow', dy: 1.3 });
  bbBstSilent(t, [...BB_MIT, 23]); t.warn = false;
  const x = bbFind(t, 29), y = bbFind(t, 26), a = bbFind(t, 23);
  await step(tok);                                   // 35:21 剛才那個難過的樣子
  await bbLay(t, tok, 700, 2.5); glow(x.m, RED);
  say('回到剛才那棵：29 雙重左重', '');
  talk(g, '好亂', 'sad');
  await step(tok);                                   // 35:27 三個 node 的 path → 想變這樣
  [a, y, x].forEach((n) => glow(n.m, GOLD));
  note('想要：26 在上，23、29 在兩邊', -3.6, 0.4, 1.6);
  say('23、26、29 是三個 node 的 path', '比較想要 26 在中間、兩邊各一個');
  await step(tok);                                   // 35:34 做得到
  say('能做這個轉換就開心了', '做得到！');
  await step(tok);                                   // 35:39 right rotate(29)
  glow(x.m, RED);
  tag('right rotate(29)', 'ptr alt', 0, 8.0, 0);
  say('做法：right rotate(29)', '');
  await step(tok);                                   // 36:14 29 是 x、26 是 y
  const px = bbPin(x, 'x', 'ptr'), py = bbPin(y, 'y', 'ptr');
  say('這次 29 是上面的 x', '26 是下面的 y');
  await step(tok);                                   // 36:20 26 升上來，29 變右 child
  kill(px); kill(py); [a, y, x].forEach((n) => glow(n.m, null));
  bbRotUp(t, y); await bbLay(t, tok, 1100);
  say('轉：26 升上來', '29 變成 26 的右 child');
  talk(g, '轉好了');
  await step(tok);                                   // 36:27 原本的 subtree a = 23
  glow(a.m, GOLD);
  say('原本 y 的左邊那塊（a）跟著 y', '這裡 a 就是 23 這一個 node');
  await step(tok);                                   // 36:39 又是 AVL tree 了
  glow(a.m, null);
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('又是一棵 AVL tree 了', '');
  talk(g, '開心！', 'happy');
  await step(tok);                                   // 36:50 檢查箭頭
  for (const n of bbList(t)) { glow(n.m, GOLD); await beat(tok, 130); glow(n.m, GREEN); }
  say('檢查：平衡、右重、平衡、左重 …', '每個 node 都最多重 1');
  await step(tok);                                   // 37:01 恢復了
  say('AVL 性質恢復了', '再做一個例子');
}]);

// 37:15 insert 55：zigzag，一次旋轉沒用 → left rotate 50、right rotate 65
FRAG.push(['bstb-mit-insert55', 'Insert 55：zigzag 要兩次旋轉', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree([23, 55], { gap: 1.3, info: 'arrow', dy: 1.3 });
  bbBstSilent(t, [41, 20, 65, 11, 26, 50, 23, 29]); t.warn = false;
  await bbLay(t, tok, 0, 0);
  const n65 = bbFind(t, 65), n50 = bbFind(t, 50);
  let n55;
  await step(tok);                                   // 37:15 insert 55
  n55 = bbPut(t, bbNode(55)); await bbLay(t, tok, 800); glow(n55.m, GOLD);
  say('insert 55：放在 50 的右邊', '');
  await step(tok);                                   // 37:29 50 右重、65 雙重左重
  glow(n55.m, null); glow(n65.m, RED);
  say('55 平衡、50 右重、65 雙重左重 ↙↙', '超級難過');
  talk(g, '又壞了', 'sad');
  await step(tok);                                   // 37:47 zigzag path
  [n65, n50, n55].forEach((n) => glow(n.m, GOLD));
  say('65 → 50 → 55：左、右', '這是一條 zigzag path');
  await step(tok);                                   // 37:55 只 right rotate(65)？
  [n65, n50, n55].forEach((n) => glow(n.m, null));
  bbRotUp(t, n50); await bbLay(t, tok, 1000);
  say('試試 right rotate(65)：50 升上來', '55 是夾在中間的 b，跑去當 65 的左 child');
  await step(tok);                                   // 38:06 變成 zag-zig：沒用
  [n50, n65, n55].forEach((n) => glow(n.m, RED));
  say('變成 zag-zig：右、左', '高度一樣，沒有比較好');
  talk(g, '白轉了', 'sad');
  await step(tok);                                   // 38:19 只能用 rotation，怎麼修？
  [n50, n65, n55].forEach((n) => glow(n.m, null));
  bbRotUp(t, n65); await bbLay(t, tok, 900);
  say('轉回去重來', '工具只有 rotation，怎麼修這個 zigzag？');
  await step(tok);                                   // 38:36 學生：先轉 50
  glow(n50.m, GOLD);
  say('學生：轉 50 看看？', '好主意');
  await step(tok);                                   // 38:48 left rotate(50)：55 升上來
  glow(n50.m, null);
  bbRotUp(t, n55); await bbLay(t, tok, 1000);
  tag('① left rotate(50)', 'pkt', -4.6, 7.8, 0);
  say('left rotate(50)：55 升上來、50 變它的左 child', '');
  await step(tok);                                   // 39:08 還是不 AVL，但變一直線
  glow(n65.m, RED);
  say('65 還是雙重左重、55 左重', '但它變成一直線了：剛才 insert 23 的情況');
  await step(tok);                                   // 39:16 再 right rotate(65)
  glow(n65.m, null);
  bbRotUp(t, n55); await bbLay(t, tok, 1000);
  tag('② right rotate(65)', 'pkt', -1.4, 7.8, 0);
  say('再 right rotate(65)', '');
  await step(tok);                                   // 39:27 41 → 55（50、65）
  glow(n55.m, GOLD);
  say('結果：41 的右邊是 55', '55 的左右是 50、65');
  await step(tok);                                   // 39:45 平衡、平衡、平衡；41 仍左重
  glow(n55.m, null);
  for (const n of bbList(t)) glow(n.m, GREEN);
  say('50、55、65 都平衡', '41 還是左重：沒問題');
  talk(g, '修好了', 'happy');
  await step(tok);                                   // 39:51 double rotation = 兩次 rotation
  note('double rotation = 兩次 rotation', 0, 0.4, 1.6);
  say('有人叫它 double rotation', '其實就是做兩次 rotation，不是新操作');
  await step(tok);                                   // 40:07 來看一般情況
  say('兩個例子剛好是演算法的兩種 case', '接著看一般情況，一樣簡單');
}]);

// 40:20 修 AVL：從改到的 node 往上走、更新高度，找最低的違規 x
FRAG.push(['bstb-mit-walkup', '往上走更新高度，找最低的違規 node', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree([23, 55], { gap: 1.3, info: 'h', dy: 1.3 });
  bbBstSilent(t, [41, 20, 65, 11, 26, 50, 23, 29]); t.warn = false;
  await bbLay(t, tok, 0, 0);
  const n = bbPut(t, bbNode(55)); t.hide = true; await bbLay(t, tok, 0, 0);
  const x = bbFind(t, 65);
  const cd = code(['fix AVL(from changed node up):', '  x = 最低的不 AVL node', '  修好 x（delete 才要再往上）'], -3.8, 7.8, 0.55);
  await step(tok);                                   // 40:20 fix AVL property
  cd.hl(0);
  say('一般的 AVL insert：fix AVL property', '');
  await step(tok);                                   // 40:34 從改到的 node 往上
  glow(n.m, GOLD);
  say('從剛剛改到的 node 開始，往上做', '');
  await step(tok);                                   // 40:42 可能要轉不只兩次
  glow(n.m, null);
  say('例子沒呈現的是一般寫法', '程式會從改到的 node 沿路往上檢查');
  await step(tok);                                   // 40:48 修最低的違規
  say('剛才的做法：找到最低的違規點，修好它', '');
  await step(tok);                                   // 40:52 上面可能還有違規（高度都變了）
  for (let c = n; c; c = c.p) glow(c.m, '#4a3600');
  say('加一個 node，整條路徑上的 subtree 高度都可能變', '所以要沿路往上更新高度、找違規點');
  await step(tok);                                   // 41:04 例子裡修一個就好，一般可能好幾個
  for (let c = n; c; c = c.p) glow(c.m, null);
  say('老師說修好後上面可能還有違規', 'insert 修好最低的一個就夠；delete 才可能一路往上');
  talk(g, 'insert 修一次');
  await step(tok);                                   // 41:25 x = 最低的不 AVL node
  cd.hl(1);
  say('令 x = 最低的、不符合 AVL 的 node', '');
  await step(tok);                                   // 41:40 從改到的 node 開始，邊走邊更新高度
  bbShow(t, true);
  const cur = bbCursor(n, '▲');
  const up = []; for (let c = n; c; c = c.p) { up.push(c); if (Math.abs(bbBf(c)) >= 2) break; }
  await bbRun(tok, cur, up.slice(0, -1), 500);
  say('從改到的 node 開始檢查', '往上走，每一步用 max + 1 更新高度');
  await step(tok);                                   // 41:57 直到左右差 2
  bbAt(cur, x); glow(x.m, RED);
  say('一直走到某個 node：一邊比另一邊高 2', '那就是 x');
  await step(tok);                                   // 42:10 修它
  remove(cur);
  cd.hl(2);
  say('找到了就修它', '');
  await step(tok);                                   // 42:27 AVL 看的不是層數
  say('學生問層數的事', 'AVL 性質看的不是層數，是左右 subtree 的高度');
  talk(g, '不是看層數', 'calm');
  await step(tok);                                   // 42:37 65 的左子樹高 1
  const hl = tag('左：h = 1', 'pkt', x.m.position.x - 1.6, x.m.position.y - 0.4, 0);
  say('65 的 left subtree 高度是 1', '從 50 往下最長走 1 步');
  await step(tok);                                   // 42:47 右子樹不存在：−1
  const hr = tag('右：不存在 = −1', 'pkt', x.m.position.x + 1.2, x.m.position.y - 1.2, 0);
  say('65 的 right subtree 不存在', '高度算 −1');
  await step(tok);                                   // 42:50 1 vs −1 → 差 2 → ↙↙
  say('1 對 −1：差 2', '所以畫雙箭頭 ↙↙');
  await step(tok);                                   // 42:56 −1 的用處
  void hl; void hr;
  say('這就是為什麼要把空的定成 −1', 'AVL 性質寫起來就簡單');
  await step(tok);                                   // 43:08 對稱：假設 x 的右邊比較重
  kill(hl); kill(hr); cd.kill(); glow(x.m, null);
  say('接下來假設 x 的右邊比較重', '左邊重的情況對稱，一模一樣');
  talk(g, '左右對稱');
}]);

// x 右重的兩種情況：case 1（y 右重或平衡）一次旋轉；case 2（z 左重）兩次
function caseRig(x0, top = 6.4) {
  const sp = [[1, 'A', 'blk'], [2, 'x'], [3, 'B', 'blk'], [4, 'y'], [5, 'C', 'blk']];
  const t = bbTree([1, 2, 3, 4, 5], { gap: 1.25, top, dy: 1.45, x0 });
  for (const k of [2, 1, 4, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  return { t, x: bbFind(t, 2), y: bbFind(t, 4), A: bbFind(t, 1), B: bbFind(t, 3), C: bbFind(t, 5) };
}
// 43:30 case 1
FRAG.push(['bstb-mit-case1', 'Case 1：y 右重或平衡 → 一次旋轉', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.3, 2.8, '#9fd3f0', 0.5, 'Erik');
  const L = caseRig(-3.3);
  await step(tok);                                   // 43:30 x 的右邊比較重（對稱）
  await bbLay(L.t, tok, 700, 3);
  bbNote(L.x, '↘↘', 'ptr alt'); glow(L.x.m, RED); bbEdges(L.t);
  say('x 是最低的違規 node，右邊比較重', '（左邊重就照鏡子）');
  await step(tok);                                   // 43:57 分兩種 case
  say('分成兩種 case', '看 x 的右 child y 長什麼樣');
  await step(tok);                                   // 44:14 右重 ↘、平衡 —
  note('↘ = right heavy　— = balanced', -3.3, 0.4, 1.6);
  say('用 right heavy（↘）和 balanced（—）來分', '');
  await step(tok);                                   // 44:32 簡單的 case：x、y、a、b、c
  bbNote(L.y, '↘'); bbEdges(L.t);
  say('簡單的 case：y 右重或平衡', 'x、y 兩個 node，A、B、C 三棵 subtree');
  talk(g, '先看簡單的');
  await step(tok);                                   // 44:43 為什麼看右 child：右邊高 2
  glow(L.y.m, GOLD);
  say('為什麼看右 child？因為 x 右邊比較高', '右邊整塊比左邊 A 高 2');
  await step(tok);                                   // 44:55 rotate(x) 的結果
  glow(L.y.m, null);
  const R = caseRig(3.3);
  bbRotUp(R.t, R.y);
  await bbLay(R.t, tok, 800, 3);
  tag('left rotate(x) 之後', 'pkt', 3.3, 7.6, 0);
  say('這種情況：rotate(x)，y 升上來', '（右邊升上來 = left rotate；老師口誤說 right）');
  await step(tok);                                   // 45:09 要檢查它真的有效
  say('不管哪種 case 都畫得出這張圖', '有趣的是：要檢查它真的平衡了');
  await step(tok);                                   // 45:21 y 右重
  say('先看 y 右重的情況', '');
  await step(tok);                                   // 45:43 x 高 k
  bbNote(L.x, 'h=k ↘↘', 'ptr alt'); bbEdges(L.t);
  say('設 x 的高度是 k（任何數都行）', '');
  await step(tok);                                   // 45:48 y 高 k − 1
  bbNote(L.y, 'h=k−1 ↘'); bbEdges(L.t);
  say('x 右重，所以 y 的高度是 k − 1', '');
  await step(tok);                                   // 45:54 C 高 k − 2
  relabel(L.C.m, 'C k−2');
  say('y 右重，所以 C 的高度是 k − 2', '');
  await step(tok);                                   // 46:05 y 是 AVL → A、B 是 k − 3
  relabel(L.B.m, 'B k−3'); relabel(L.A.m, 'A k−3');
  say('x 是最低的違規，所以 y 是 AVL', 'B 是 k − 3；x 差 2 → A 也是 k − 3');
  await step(tok);                                   // 46:27 轉完：A、B、C 不變
  relabel(R.A.m, 'A k−3'); relabel(R.B.m, 'B k−3'); relabel(R.C.m, 'C k−2');
  say('轉完以後：A、B、C 的高度都不變', '它們裡面沒動過（高度只看往下）');
  await step(tok);                                   // 46:38 x 變 k − 2、y 變 k − 1
  bbNote(R.x, 'h=k−2 —'); bbNote(R.y, 'h=k−1 —'); bbEdges(R.t);
  say('x 變成 k − 2、y 變成 k − 1', '');
  await step(tok);                                   // 46:43 兩個都平衡
  glow(R.x.m, GREEN); glow(R.y.m, GREEN);
  say('x：k − 3 對 k − 3；y：k − 2 對 k − 2', '兩個都平衡了');
  talk(g, '平衡 ✓', 'happy');
  await step(tok);                                   // 46:53 y 的 parent 可能壞掉 → 繼續往上
  const up = tag('insert：高度回到 k − 1，停', 'pkt', 2.6, 0.5, 1.6); void up;
  say('這塊的高度變成 k − 1 = insert 前的高度', 'insert 可以停；delete 時高度可能少 1，才往 y 的 parent 檢查');
  await step(tok);                                   // 47:08 y 平衡的情況也成立
  say('y 平衡（—）的情況也一樣成立（請看講義）', '這種情況只會在 delete 出現');
}]);

// 47:18 case 2
FRAG.push(['bstb-mit-case2', 'Case 2：z 左重 → 兩次旋轉', async (tok) => {
  fresh([0, 4.2, 13], [0, 3.6, 0]);
  const g = pal(6.3, 2.8, '#9fd3f0', 0.5, 'Erik');
  const sp = [[1, 'A', 'blk'], [2, 'x'], [3, 'B', 'blk'], [4, 'y'], [5, 'C', 'blk'], [6, 'z'], [7, 'D', 'blk']];
  const t = bbTree([1, 2, 3, 4, 5, 6, 7], { gap: 1.45, top: 6.6, dy: 1.35 });
  for (const k of [2, 1, 6, 4, 7, 3, 5]) { const s = sp.find((q) => q[0] === k); bbPut(t, bbNode(k, s[1], s[2])); }
  const x = bbFind(t, 2), z = bbFind(t, 6), y = bbFind(t, 4);
  await step(tok);                                   // 47:18 另一種 case：兩次旋轉
  await bbLay(t, tok, 700, 3);
  say('另一種 case：要轉兩次', '');
  talk(g, '轉兩次');
  await step(tok);                                   // 47:53 x 雙重右重
  bbNote(x, '↘↘', 'ptr alt'); glow(x.m, RED); bbEdges(t);
  say('一樣：x 雙重右重', '');
  await step(tok);                                   // 47:58 x 的右 child z 左重
  bbNote(z, '↙'); glow(z.m, GOLD); bbEdges(t);
  say('剩下的情況：x 的右 child（叫 z）是左重', 'x → z → y：右、左，zigzag');
  await step(tok);                                   // 48:07 right rotate(z)
  glow(z.m, null);
  bbRotUp(t, y); await bbLay(t, tok, 1000);
  tag('① right rotate(z)', 'pkt', -3.6, 7.8, 0);
  say('跟 insert 55 一樣：先 right rotate(z)', 'y 升上來，變一直線');
  await step(tok);                                   // 48:11 再 left rotate(x)：x、y、z
  bbRotUp(t, y); glow(x.m, null); await bbLay(t, tok, 1000);
  tag('② left rotate(x)', 'pkt', -0.4, 7.8, 0);
  bbNote(x, '—'); bbNote(z, '—'); bbEdges(t);
  say('再 left rotate(x)', '得到漂亮的樣子：y 在上，x、z 在兩邊');
  await step(tok);                                   // 48:18 全部平衡，AVL 恢復
  for (const n of [x, y, z]) glow(n.m, GREEN);
  say('檢查高度：全部平衡', 'AVL 性質恢復；in-order A x B y C z D 也沒變');
  talk(g, '修好了', 'happy');
  await step(tok);                                   // 48:22 細節看講義；看大局
  say('細節請看講義', '最後幾分鐘講 AVL 在大局中的位置');
}]);

// 48:38 AVL sort：n 次 insert（各 O(log n)）+ in-order O(n)
FRAG.push(['bstb-mit-avl-sort', 'AVL sort：O(n log n)', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const t = mitTree();
  await step(tok);                                   // 48:38 拿來 sort：全部 insert
  for (const k of BB_MIT) { const n = bbPut(t, bbNode(k)); const r = bbDetect(t, n); if (r) bbFix(t, r); await bbLay(t, tok, 260); }
  say('AVL tree 可以拿來 sort n 個數', '先把它們全部 insert 進去');
  await step(tok);                                   // 48:48 再做 in-order traversal
  const io = ioList(t);
  for (let i = 0; i < io.length; i++) { glow(io[i].m, GREEN); cube(io[i].k, bbCol(io[i].k), [0.9, 0.6, 0.8], -4.2 + i * 1.4, 0.3, 2.6, 2.5); await beat(tok, 260); }
  say('再做 in-order traversal', '印出來就排好了');
  await step(tok);                                   // 48:58 in-order 是 linear time
  note('in-order：O(n)', -3.6, 1.6, 1.6);
  say('in-order traversal 花 linear time：O(n)', '');
  await step(tok);                                   // 49:08 每次 insert O(h)
  note('每次 insert：O(h)', 0.6, 1.6, 1.6);
  say('每次 insert 花 O(h)', '');
  await step(tok);                                   // 49:12 h = O(log n) → n log n
  note('h = O(log n) → 共 O(n log n)', 0, 8.0, 0);
  say('現在保證 h = O(log n)', 'n 次 insert：O(n log n)');
  talk(g, 'n log n', 'happy');
  await step(tok);                                   // 49:20 又一種 n log n 排序
  say('又一種 n log n 的排序法', '之前看過 heap sort、merge sort');
}]);

// 49:29 ADT vs data structure：priority queue（heap / AVL）；succ/pred 要 balanced BST
FRAG.push(['bstb-mit-adt', 'ADT vs 資料結構：heap 與 AVL', async (tok) => {
  fresh(...CAMM);
  const g = pal(6.2, 2.8, '#9fd3f0', 0.55, 'Erik');
  const oc = [];
  const op = (i) => { const nm = ['insert', 'delete-min', 'succ / pred'][i]; oc[i] = cube(nm, '#9b7ef4', [2.2, 0.6, 0.9], -3.6, 5.6 - i * 1.0, 0, 2.5); return oc[i]; };
  let heap, avl;
  await step(tok);                                   // 49:29 heap：insert、delete-min
  heap = cube('heap', '#dd8238', [1.8, 0.8, 0.9], 2.2, 4.9, 0, 2.5); op(0); op(1);
  glow(heap, GOLD);
  say('heap 支援兩個操作：insert、delete-min', '很多時候這樣就夠了');
  await step(tok);                                   // 49:40 AVL：insert、delete、delete-min
  avl = cube('AVL tree', '#2fc092', [1.8, 0.8, 0.9], 4.6, 4.9, 0, 2.5); glow(avl, GOLD);
  say('AVL tree 也做得到：insert、delete、delete-min', '');
  await step(tok);                                   // 49:51 新操作：successor / predecessor
  op(2); glow(oc[2], GOLD); glow(heap, null);
  say('AVL 多了新操作：找下一個比較大 / 比較小', 'successor / predecessor');
  talk(g, 'heap 做不到');
  await step(tok);                                   // 49:59 abstract data type
  glow(oc[2], null); glow(avl, null);
  tag('ADT（abstract data type）', 'ptr', -3.6, 6.8, 0);
  say('可以想成 abstract data type（抽象資料型別）', '');
  await step(tok);                                   // 50:06 規定要支援哪些操作
  oc.forEach((m) => glow(m, '#2a1a5a'));
  say('ADT：規定「要支援哪些操作」', '');
  await step(tok);                                   // 50:11 Java 叫 interface
  say('寫 Java 的人叫它 interface', '演算法版本的規格書');
  await step(tok);                                   // 50:18 insert、delete、min、succ、pred …
  oc.forEach((m) => glow(m, null));
  say('操作有 insert、delete、find min', '還有 successor、predecessor 等等');
  await step(tok);                                   // 50:37 insert + delete + min = priority queue
  ghostBox('#9b7ef4', 2.8, 2.2, 1.4).position.set(-3.6, 5.1, 0);
  tag('priority queue', 'pkt', -5.9, 4.0, 0);
  say('任選幾個就是一個 ADT', 'insert、delete、min 叫 priority queue');
  await step(tok);                                   // 50:52 資料結構：怎麼真正做到
  tag('資料結構（怎麼做）', 'ptr', 3.4, 6.8, 0);
  say('另一邊：資料結構 = 真正怎麼做到', 'ADT 是規格，資料結構像演算法');
  await step(tok);                                   // 51:01 heap、AVL、sorted array 都行
  glow(heap, GREEN); glow(avl, GREEN);
  tag('（sorted array 也行，但慢）', 'idx', 3.4, 3.8, 0);
  say('要 priority queue：可以用 heap', '也可以用 AVL tree、sorted array …');
  await step(tok);                                   // 51:14 三個都要 → balanced BST
  glow(heap, null); glow(oc[2], GOLD);
  say('三種操作都要（含 succ / pred）', '基本上就需要 balanced binary search tree');
  talk(g, '要 balanced BST');
  await step(tok);                                   // 51:23 一打 balanced tree，全都 log n
  say('balanced search tree 至少有一打', '全都是 log n，差在常數和實務細節');
  await step(tok);                                   // 51:36 heap：in place
  glow(oc[2], null); glow(avl, null); glow(heap, GOLD);
  tag('in place、不多佔空間', 'idx', 2.2, 3.2, 0);
  say('偏好 heap 的主要原因：in place', '不用額外空間');
  await step(tok);                                   // 51:39 AVL：指標到處都是
  glow(heap, null); glow(avl, GOLD);
  tag('指標多：空間多一個常數倍', 'idx', 4.8, 2.6, 0);
  say('AVL 到處都是指標', '空間多花一個常數倍');
  await step(tok);                                   // 51:42 理論上 AVL 全部 log n
  glow(avl, GREEN);
  say('不在意常數的話，AVL 非常好', '目前學過的操作全部 O(log n)');
  talk(g, '全部 log n', 'happy');
}]);
  }

  // ═══ bstc.js ═══
  {
// ─── IWzYoXKaRIc：MIT 6.006 Rec6 AVL Trees ／ jDM6_TnYIqE：Abdul Bari 10.1 AVL Tree ───
// cued：每個 await step(tok) 等老師講到那一句（註解裡的秒數 = notes 的 cue）
const { V3, fresh, tag, cube, move, kill, txt, relabel, code, line, anim, ghostBox, buddy, remove, travel, step, GOLD, GREEN, GRAY } = K;
const KG = (m, c) => K.glow(m, c);
const CAM = [[0, 4.6, 13.5], [0, 3.7, 0]];
const BLUE = '#4b9ee2', PURP = '#9b7ef4', TEAL = '#31aab0', ORNG = '#dd8238', BAD = '#7a1010', PINK = '#e55a9b';
const HOT = '#4a3600', OKG = '#163a2a', REDG = '#5a1010', OFF = '#000';
function pal(x = 6.1, z = 2.6, color = '#9fd3f0', s = 0.55, name = '助教') { const b = buddy(name, '', color, x, 0, z, s); b.x = x; b.z = z; b.s = s; return b; }
function talk(b, text, mood) { if (!b) return; if (b.bub) remove(b.bub); b.bub = text ? tag(text, 'say', b.x, b.s + 1.35, b.z) : null; if (mood) b.mood(mood); }
const note = (s, x, y, z = 0) => tag(s, 'note', x, y, z);
// ── 用本章模組的 BST 畫面（中序位置排版、標籤、游標） ──
function view(o) { return makeView(Object.assign({ tag: 'none' }, o || {})); }
function grow(t, seq, drop = true) { const ns = seq.map((k) => attach(t, mk(k))); layout(t, !drop); if (drop) ns.forEach(dropIn); return ns; }
function stageT(seq, o, cam) { fresh(...(cam || CAM)); const t = view(o); if (seq.length) grow(t, seq, false); return t; }
function put(t, k) { const z = attach(t, mk(k)); layout(t); dropIn(z); return z; }
const nodeOf = (t, k) => findKey(t, k);
// 沿 BST 搜尋路徑移動游標；回傳走過的節點（最後一個是找到的或最後比較的）
async function walk(tok, t, cur, k, ms = 420) {
  const path = []; let x = t.root;
  while (x) { path.push(x); cursorTo(cur, x.pos); glow(x, HOT); await beat(tok, ms); glow(x, OFF); if (k === x.key) break; x = k < x.key ? x.left : x.right; }
  return path;
}
// MIT 的高度：leaf = 0、NULL = −1
const hE = (n) => (n ? 1 + Math.max(hE(n.left), hE(n.right)) : -1);
function setTag(n, s, hot) { n.tag.element.textContent = s; n.tag.element.className = 'lab-label ' + (hot ? 'ptr alt' : 'idx'); n.tag.element.style.display = s ? '' : 'none'; }
function hTags(t, fn) { inorder(t.root).forEach((n) => setTag(n, fn ? fn(n) : 'h ' + hE(n))); }
function bfOn(t, on) { t.o.tag = on ? 'bf' : 'none'; refresh(t); }
// 抽象節點／子樹：位置記在 userData.t，連線依目標位置重畫
function rig() {
  const R = { m: {}, ls: [] };
  R.node = (id, text, x, y, color, size, dropH) => { const m = cube(text, color || BLUE, size || [0.8, 0.6, 0.8], x, y, 0, dropH || 0); m.userData.t = [x, y]; R.m[id] = m; return m; };
  R.sub = (id, text, x, y, dropH) => R.node(id, text, x, y, GRAY, [1.15, 0.45, 0.7], dropH);
  R.go = (id, x, y) => { const m = R.m[id]; m.userData.t = [x, y]; move(m, x, y); };
  R.place = (map) => { for (const id in map) R.go(id, map[id][0], map[id][1]); };
  R.wire = (pairs) => { R.ls.forEach(kill); R.ls = pairs.map(([p, c]) => { const a = R.m[p].userData.t, b = R.m[c].userData.t; return line(a[0], a[1], b[0], b[1], -0.05); }); };
  R.hang = (id, text, cls) => { const l = lab.label(text, cls || 'idx'); l.position.set(0, 0.62, 0); R.m[id].add(l); return l; };
  return R;
}

// ═══ MIT 6.006 Rec6 ═══
FRAG.push(['bstc-search-5', 'BST 搜尋 5：遇 4 往右、遇 7 往左', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const t = view();
  await step(tok);                                   // 61.8 binary：每個 node 最多兩個 child
  grow(t, [4, 2, 7, 1, 3, 5, 9]); await beat(tok, 700);
  say('binary：每個 node 最多兩個 child', '');
  talk(g, '先從 BST 開始');
  await step(tok);                                   // 66.0 為什麼叫 search tree？好搜尋
  say('為什麼叫 search tree？', '因為它很好搜尋');
  await step(tok);                                   // 71.0 比大還是比小，往下走
  say('看要找的數比這個 key 大還是小', '就知道往哪邊走');
  await step(tok);                                   // 79.0 寫成正式的 rep invariant？
  say('寫成正式的 rep invariant（一定成立的規則）', '是什麼？');
  await step(tok);                                   // 92.0 遞迴：右邊整棵都比較大
  const r = t.root; glow(r, HOT);
  const gr = ghostBox(PINK, 3.0, 2.4, 1.4); gr.position.set(nodeOf(t, 7).pos.x, 4.6, 0);
  say('對每個 node：右邊整棵都比它大', '');
  await step(tok);                                   // 104.0 左邊整棵都比較小
  const gl = ghostBox(BLUE, 3.0, 2.4, 1.4); gl.position.set(nodeOf(t, 2).pos.x, 4.6, 0);
  say('左邊整棵都比它小', 'key(左子樹) < key(x) < key(右子樹)');
  await step(tok);                                   // 112.0 所以搜尋很快：找 5
  kill(gl); kill(gr); glow(r, OFF);
  const cur = makeCursor();
  const n5 = nodeOf(t, 5);
  say('所以搜尋很快：例如找 5', '');
  talk(g, '找 5！');
  await step(tok);                                   // 120.0 遇到 4：往右
  cursorTo(cur, r.pos); glow(r, HOT);
  say('遇到 4：5 > 4 → 往右', '');
  await step(tok);                                   // 123.0 遇到 7：往左
  glow(r, OFF); const n7 = nodeOf(t, 7); cursorTo(cur, n7.pos); glow(n7, HOT);
  await beat(tok, 600); glow(n7, OFF); cursorTo(cur, n5.pos); glow(n5, OKG);
  say('遇到 7：5 < 7 → 往左', '找到 5');
  await step(tok);                                   // 127.0 BST 會哪些操作？
  glow(n5, OFF); hideCursor(cur);
  say('BST 上我們會哪些操作？', '');
  await step(tok);                                   // 137.0 min、max
  const mn = minNode(t.root), mx = maxNode(t.root);
  glow(mn, OKG); glow(mx, OKG);
  const l1 = tag('min', 'pkt', mn.pos.x, mn.pos.y - 0.8), l2 = tag('max', 'pkt', mx.pos.x, mx.pos.y - 0.8);
  say('min：一直往左；max：一直往右', 'min = 1、max = 9');
  await step(tok);                                   // 150.0 insert、delete
  glow(mn, OFF); glow(mx, OFF); remove(l1); remove(l2);
  const ops = ['insert', 'delete', 'find'].map((s, i) => tag(s, 'pkt', -2.6 + i * 2.6, 0.4, 1.6));
  ops[2].element.style.visibility = 'hidden';
  say('更新：insert、delete', '');
  await step(tok);                                   // 179.0 find / search
  ops[2].element.style.visibility = '';
  say('BST 的 S：find（或叫 search）', '');
  await step(tok);                                   // 194.0 全部同一個時間：O(h)
  ops.forEach((l) => { l.element.className = 'lab-label ptr alt'; });
  say('全部都是同一個 running time', 'O(h)：好記');
  talk(g, '都是 O(h)', 'happy');
  await step(tok);                                   // 199.0 h 是什麼？高度
  say('h 是什麼？樹的高度', '高度怎麼定義？');
}]);

FRAG.push(['bstc-height', '高度 h = max(h_L, h_R) + 1，NULL 算 −1', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const minis = [];
  const mini = (cx, ks) => { const t = makeView({ tag: 'none', cx, width: 2, topY: 6.4, minY: 3.8, maxStep: 1.2, maxSp: 0.9, size: [0.6, 0.45, 0.6] }); grow(t, ks); minis.push(t); return t; };
  await step(tok);                                   // 206.0 這棵樹的高度？
  const t1 = mini(-4.2, [5]);
  const a1 = tag('h = 0', 'pkt', -4.2, 2.8);
  say('這棵樹的高度是多少？', '只有一個 node：0');
  talk(g, '考考你');
  await step(tok);                                   // 215.0 這棵？這棵？
  mini(0, [5, 3]); mini(4.2, [5, 3, 2]);
  const a2 = tag('h = 1', 'pkt', 0, 2.8), a3 = tag('h = 2', 'pkt', 4.2, 2.8);
  say('這棵？這棵？', '高度 = 往下最長有幾條邊');
  await step(tok);                                   // 232.0 一般情況：h_L、h_R
  for (const m of minis) { for (const n of inorder(m.root)) kill(n.body.obj); m.root = null; }
  [a1, a2, a3].forEach(remove); void t1;
  const t = view(); grow(t, [4, 2, 7, 1, 5, 9, 8]); hTags(t, () => '');
  await beat(tok, 600);
  const gl = ghostBox(BLUE, 2.2, 2.4, 1.4); gl.position.set(nodeOf(t, 2).pos.x - 0.6, 4.6, 0);
  const gr = ghostBox(PINK, 4.4, 3.8, 1.4); gr.position.set(nodeOf(t, 7).pos.x + 0.3, 3.9, 0);
  const tl = tag('h_L', 'pkt', nodeOf(t, 2).pos.x - 0.6, 2.9), tr = tag('h_R', 'pkt', nodeOf(t, 7).pos.x + 0.3, 1.6);
  say('一般情況：左子樹高 h_L、右子樹高 h_R', '');
  await step(tok);                                   // 245.0 h 是多少？
  glow(t.root, HOT);
  say('那整棵的 h 是多少？', '');
  await step(tok);                                   // 256.0 max(h_L, h_R) + 1
  const f = note('h = max(h_L, h_R) + 1', 0, 0.4, 1.6);
  say('h = max(h_L, h_R) + 1', '比較高的那邊，再加上自己這一層');
  await step(tok);                                   // 268.0 程式碼第 1–8 行；7、8 行就是定義
  [gl, gr, tl, tr].forEach((o) => (o.element ? remove(o) : kill(o))); glow(t.root, OFF);
  const cd = code(['def height(node):', '  if node is None:', '    return -1', '  return node.height', '', 'def update_height(node):', '  node.height = max(height(node.left),', '                    height(node.right)) + 1'], -6.4, 7.6, 0.42);
  cd.hl(6);
  say('看講義程式碼第 1–8 行', '第 7、8 行就是剛才的定義');
  await step(tok);                                   // 279.0 每個 node 知道自己子樹的高度
  hTags(t);
  say('Python 實作：每個 node 記著自己這棵子樹的高度', '');
  await step(tok);                                   // 287.0 樹改變時要更新
  say('既然存著，樹一改變（例如 insert）', '就要更新它');
  await step(tok);                                   // 294.0 update_height 用這個公式
  cd.hl(5);
  say('用 update_height 更新', '裡面就是那個公式');
  await step(tok);                                   // 300.0 第 2–5 行有個 hack
  cd.hl(2);
  say('第 2–5 行有一個 hack（小技巧）', '是什麼？');
  talk(g, '什麼技巧？');
  await step(tok);                                   // 335.0 leaf：沒有 child
  const n1 = nodeOf(t, 1); glow(n1, HOT);
  say('看 leaf：沒有任何 child', '');
  await step(tok);                                   // 341.0 h_L、h_R 是多少？
  say('有一個 child 的 node：高度 0 的 child 可以直接用', '可是 leaf 沒有 child，h_L、h_R 是多少？');
  await step(tok);                                   // 352.0 公式要算出 0
  say('leaf 的高度一定要是 0', '所以 h_L、h_R 要設成讓公式算出 0 的值');
  await step(tok);                                   // 364.0 設成 −1：max(−1, −1) + 1 = 0
  const ns = [-1, 1].map((sx) => cube('−1', GRAY, [0.45, 0.3, 0.45], n1.pos.x + sx * 0.45, n1.pos.y - 1.0, 0, 2));
  txt(f, 'leaf：max(−1, −1) + 1 = 0');
  say('設成 −1', 'max(−1, −1) + 1 = 0 ✓');
  talk(g, '−1 剛剛好', 'happy');
  await step(tok);                                   // 377.0 AVL 要馬上知道高度
  glow(n1, OFF); ns.forEach(kill);
  say('AVL 需要「馬上」知道一個 node 的高度', '不能每次都往下走一遍去算');
  await step(tok);                                   // 385.0 每個 node 存高度欄位
  inorder(t.root).forEach((n) => setTag(n, 'h ' + hE(n), true));
  say('所以每個 node 存一個 height 欄位', 'insert、delete 時跟著更新');
  await step(tok);                                   // 398.0 leaf 時：不存在的樹高 −1
  hTags(t);
  say('更新到 leaf 時要用到：不存在的樹高度 = −1', '');
  await step(tok);                                   // 407.0 聰明的 hack，讓程式變短
  say('現實中沒有「不存在的樹」', '這只是讓程式碼變短的聰明 hack');
}]);

FRAG.push(['bstc-avl-invariant', 'AVL 看高度差，不看節點數', async (tok) => {
  const t = stageT([5, 3, 8, 2, 7, 9, 1]);   // only node 3 breaks the rule (root: 2 vs 1)
  const g = pal();
  const n3 = nodeOf(t, 3);
  await step(tok);                                   // 436.0 這是 AVL 嗎？
  say('這棵是 AVL 嗎？', '');
  talk(g, '是嗎？');
  await step(tok);                                   // 447.0 誰覺得不是？為什麼？
  say('誰覺得它「不是」AVL？為什麼？', '');
  await step(tok);                                   // 464.0 這個 node 不平衡
  glow(n3, REDG);
  say('這個 node（3）不平衡', '');
  await step(tok);                                   // 480.0 學生：這邊 2、這邊 0
  const c1 = tag('2 個節點', 'pkt', n3.pos.x - 2.0, n3.pos.y + 0.1), c2 = tag('0 個', 'pkt', n3.pos.x + 0.75, n3.pos.y - 0.9);
  say('學生先說：這邊 2、這邊 0', '');
  await step(tok);                                   // 491.0 高度：這邊 1、這邊 −1
  txt(c1, 'h = 1'); txt(c2, 'h = −1'); hTags(t);
  say('改口看高度：左 1、右 −1', '<span class="no">差 2 → 不是 AVL</span>');
  await step(tok);                                   // 499.0 2 和 0 是節點數
  say('一開始說的 2 和 0 是「節點數」', '');
  await step(tok);                                   // 503.0 AVL 不看節點數，看高度
  say('AVL 不在乎節點數', 'AVL 只在乎高度');
  talk(g, '看高度！', 'wow');
  await step(tok);                                   // 507.0 例如這棵
  remove(c1); remove(c2);
  const t2 = stageT([5, 3, 7, 2, 4]);
  const g2 = pal();
  const rt = t2.root;
  say('例如這棵', '');
  await step(tok);                                   // 516.0 快樂的 AVL：左 3 個、右 1 個
  const d1 = tag('3 個節點', 'pkt', rt.pos.x - 2.4, rt.pos.y - 0.4), d2 = tag('1 個', 'pkt', rt.pos.x + 2.2, rt.pos.y - 0.4);
  glow(rt, OKG);
  say('這是一棵快樂的 AVL', '左邊 3 個節點、右邊 1 個');
  talk(g2, '快樂 AVL', 'happy');
  await step(tok);                                   // 519.0 節點數差 2，高度只差 1
  txt(d1, 'h = 1'); txt(d2, 'h = 0'); hTags(t2);
  say('節點數差 2，但高度只差 1', '');
  await step(tok);                                   // 524.0 AVL 的 rep invariant？
  glow(rt, OFF);
  say('所以 AVL 的 rep invariant 是什麼？', '');
  await step(tok);                                   // 546.0 每個 node：左右高度差 ≤ 1
  const rule = note('每個 node：|h_L − h_R| ≤ 1', 0, 0.4, 1.6);
  for (const n of inorder(t2.root)) glow(n, OKG);
  say('核心：每一個 node 的左右高度最多差 1', '');
  await step(tok);                                   // 563.0 還有：它是 BST
  txt(rule, '每個 node：|h_L − h_R| ≤ 1　＋　它是 BST');
  say('要完全嚴謹，還要加一句：它是 BST', '');
  await step(tok);                                   // 574.0 AVL 繼承 BST 的程式碼
  for (const n of inorder(t2.root)) glow(n, OFF);
  say('AVL 是一種特別的 BST', '程式裡 AVL 繼承（inherit）BST，大量用它的方法');
  await step(tok);                                   // 587.0 為什麼喜歡 AVL？
  say('為什麼我們喜歡 AVL？', '');
  talk(g2, '好在哪？');
  await step(tok);                                   // 605.0 一般 BST 最壞：一條 list
  say('一般的 binary search tree 最壞', '就是一條 list');
}]);

// 固定高度、最少節點的 AVL：右邊 h−1、左邊 h−2
function minT(h) { return h < 0 ? null : { h, l: minT(h - 2), r: minT(h - 1) }; }
function layT(T, cx, topY, sp, stp) {
  const order = [];
  (function w(n, d, p) { if (!n) return; n.d = d; n.p = p; w(n.l, d + 1, n); order.push(n); w(n.r, d + 1, n); })(T, 0, null);
  order.forEach((n, i) => { n.x = cx + (i - (order.length - 1) / 2) * sp; n.y = topY - n.d * stp; });
  return order;
}
function drawT(order, color, dropH, objs) {
  for (const n of order) { n.m = cube(String(n.h), typeof color === 'function' ? color(n) : color, [0.7, 0.55, 0.7], n.x, n.y, 0, dropH || 0); objs.push(n.m); }
  for (const n of order) if (n.p && n.p.m) objs.push(line(n.p.x, n.p.y, n.x, n.y, -0.05));
}
const NMIN = [1, 2, 4, 7, 12];
function minShow(h, cx = 0, objs = []) { drawT(layT(minT(h), cx, 6.2, 1.1, 1.3), (n) => (n.d === 0 ? ORNG : BLUE), 3, objs); return objs; }

FRAG.push(['bstc-min-avl', '高度固定、節點最少的 AVL：h = 0..3', async (tok) => {
  fresh(...CAM);
  const g = pal();
  let objs = [];
  const chain = [];
  for (let i = 0; i < 5; i++) { chain.push(cube('', '#c9b48e', [0.6, 0.45, 0.6], -4 + i * 0.8, 6.4 - i * 0.9, 0, 0)); if (i) chain.push(line(-4 + (i - 1) * 0.8, 6.4 - (i - 1) * 0.9, -4 + i * 0.8, 6.4 - i * 0.9, -0.05)); }
  tag('h = O(n)', 'pkt', -2.4, 1.6);
  await step(tok);                                   // 617.0 list：高度 O(n)；AVL 比較好
  say('歪成 list：高度是 O(n)', 'AVL 比較好');
  talk(g, '好在哪？');
  await step(tok);                                   // 624.0 AVL 的高度是 O(log n)
  say('我們在乎 AVL 的原因：高度是 O(log n)', '');
  await step(tok);                                   // 642.0 為什麼？
  say('上課有聽懂為什麼嗎？', '誰能說明一下？');
  await step(tok);                                   // 670.0 我記的方法：自己蓋樹
  chain.forEach(kill); objs.forEach(kill); objs = [];
  say('助教的記法：自己動手蓋一棵樹', '用它說服你高度是 log n');
  await step(tok);                                   // 680.0 固定高度，節點越少越好
  say('規則：高度固定，用最少的節點蓋', '');
  talk(g, '越省越好？');
  await step(tok);                                   // 688.0 高度大、節點少 = 不平衡
  say('高度大、節點少的樹', '寫成 n 的函數時 h 很糟：這就是不平衡');
  await step(tok);                                   // 705.0 h = 0
  objs = minShow(0);
  say('h = 0：只有一個節點', 'N(0) = 1（方塊上的數字 = 高度）');
  await step(tok);                                   // 721.0 h = 1：兩個節點
  objs.forEach(kill); objs = minShow(1);
  say('h = 1：兩個節點就夠', 'N(1) = 2');
  await step(tok);                                   // 733.0 可以多加一個，但不要
  say('可以在另一邊再加一個', '但我們要最少，所以不加');
  await step(tok);                                   // 741.0 h = 2 最少？
  say('h = 2 呢？用最少的節點', '');
  await step(tok);                                   // 748.0 一條鏈可以嗎？
  objs.forEach(kill); objs = [];
  const bad = [cube('2', BAD, [0.7, 0.55, 0.7], -1, 6.2, 0, 3), cube('1', BAD, [0.7, 0.55, 0.7], 0, 4.9, 0, 3), cube('0', BAD, [0.7, 0.55, 0.7], 1, 3.6, 0, 3)];
  objs.push(...bad, line(-1, 6.2, 0, 4.9, -0.05), line(0, 4.9, 1, 3.6, -0.05));
  say('一條鏈可以嗎？', '');
  await step(tok);                                   // 762.0 不平衡
  say('不行：root 左邊 −1、右邊 1', '<span class="no">差 2，不平衡</span>');
  talk(g, '不行喔', 'sad');
  await step(tok);                                   // 765.0 左右只能差 1
  say('左邊的高度只能是右邊 ± 1', '');
  await step(tok);                                   // 771.0 左邊至少要高 0：用最好的 h0
  objs.forEach(kill); objs = minShow(2);
  say('左邊至少要一棵高度 0 的樹', '最省的 h0 就是一個節點：N(2) = 4');
  await step(tok);                                   // 784.0 h = 3：右 h2、左 h1
  objs.forEach(kill); objs = minShow(3);
  say('h = 3：右邊放 h2、左邊放 h1', 'N(3) = 7');
  await step(tok);                                   // 800.0 h = 4 一樣做法
  say('要 h = 4 也一樣做', '');
  await step(tok);                                   // 809.0 一般：root，右 h−1、左 h−2
  const lab1 = note('root ＋ 右：h−1 最少的 AVL ＋ 左：h−2 最少的 AVL', 0, 0.4, 1.6);
  say('一般：先放 root', '右邊蓋高度 h−1、左邊蓋 h−2，都用最少節點的');
  await step(tok);                                   // 826.0 兩邊最少 → 整棵最少
  say('兩邊都是最少節點', '整棵就是最少節點');
  await step(tok);                                   // 832.0 不要兩邊一樣高：會多節點
  txt(lab1, 'N(h) = N(h−1) + N(h−2) + 1');
  say('不要讓兩邊一樣高：那樣節點更多', '這就是又高又省的蓋法');
  talk(g, '又高又省', 'happy');
}]);

FRAG.push(['bstc-min-avl-h4', 'h = 4：h3 接右、h2 接左，N ≈ φ^h', async (tok) => {
  fresh(...CAM);
  const g = pal();
  let objs = minShow(3);
  const f = note('N(h) = ?', 0, 0.4, 1.6);
  await step(tok);                                   // 844.0 遞迴式：節點數是高度的函數
  say('把最少節點數寫成高度的函數', 'N(h) = ?');
  talk(g, '你們說說看');
  await step(tok);                                   // 861.0 N(h) 是多少？
  say('高度 h、節點最少的樹，有幾個節點？', '');
  await step(tok);                                   // 885.0 N(h−1) 是這棵、N(h−2) 是那棵
  const T = minT(3); const order = layT(T, 0, 6.2, 1.1, 1.3); void order;
  const gr = ghostBox(PINK, 4.4, 3.4, 1.4); gr.position.set(1.65, 4.3, 0);
  const gl = ghostBox(BLUE, 2.4, 2.2, 1.4); gl.position.set(-2.75, 4.9, 0);
  txt(f, 'N(h) = N(h−1) + N(h−2) + ?');
  say('右邊那棵是 N(h−1)、左邊那棵是 N(h−2)', '還有一個常數？');
  await step(tok);                                   // 896.0 常數是 1（root 這個節點）
  txt(f, 'N(h) = N(h−1) + N(h−2) + 1');
  say('學生說 0？數的是節點數，root 也算', '所以 + 1');
  await step(tok);                                   // 912.0 解遞迴式
  kill(gl); kill(gr);
  say('解遞迴式以前學過', '直接告訴你答案的樣子');
  await step(tok);                                   // 920.0 N(h) ≈ φ^h
  txt(f, 'N(h) ≈ φ^h，φ ≈ 1.618');
  say('N(h) 大約是 φ 的 h 次方', 'φ 是上課講的黃金比例');
  talk(g, '神奇數字 φ', 'wow');
  await step(tok);                                   // 934.0 重點：h 的指數
  say('重點是：它是 h 的指數函數', '');
  await step(tok);                                   // 938.0 像 Fibonacci 多了 +1 → 更大
  const row = NMIN.map((v, h) => tag('N(' + h + ') = ' + v, 'idx', -5 + h * 2.5, 0.3, 1.2));
  remove(f);
  say('很像 Fibonacci，只是多了 +1', '所以比 Fibonacci 數還大');
  await step(tok);                                   // 957.0 最少節點數是 h 的指數
  say('高度 h 的 AVL，最少節點數是 h 的指數', '');
  await step(tok);                                   // 965.0 倒過來：n 個節點最高 log n
  row.forEach(remove);
  const f2 = note('n ≥ φ^h → h ≤ log_φ n = O(log n)', 0, 0.4, 1.6);
  say('倒過來：n 個節點的樹最高也只有 log n', '');
  await step(tok);                                   // 982.0 只要 rep invariant 一直成立
  say('只要 rep invariant 一直成立', '高度就一定是對數級的');
  talk(g, '保證 log n', 'happy');
  await step(tok);                                   // 1013.0 h = 4 最少節點怎麼蓋？
  remove(f2); objs.forEach(kill); objs = [];
  const T4 = minT(4), o4 = layT(T4, 0, 6.4, 0.95, 1.3);
  const inR = new Set(), inL = new Set();
  (function w(n, s) { if (!n) return; s.add(n); w(n.l, s); w(n.r, s); })(T4.r, inR);
  (function w(n, s) { if (!n) return; s.add(n); w(n.l, s); w(n.r, s); })(T4.l, inL);
  say('高度 4、節點最少：怎麼蓋？', '');
  await step(tok);                                   // 1022.0 root 至少要一個 h3 的 child
  drawT([T4], ORNG, 3, objs);
  say('root 要高 4，就至少要有一個高度 3 的 child', '');
  await step(tok);                                   // 1034.0 用最省的 h3（7 個）
  drawT(o4.filter((n) => inR.has(n)), BLUE, 3, objs);
  objs.push(line(T4.x, T4.y, T4.r.x, T4.r.y, -0.05));
  const tr = tag('最少的 h3：7 個', 'pkt', 2.6, 1.0);
  say('右邊：用我們知道最省的 h = 3 那棵', 'N(3) = 7');
  await step(tok);                                   // 1051.0 左邊放什麼？高度多少？
  say('左邊也放一棵最省的 AVL', '但高度要多少？');
  talk(g, '2？3？4？');
  await step(tok);                                   // 1078.0 只能差 1：2、3、4
  say('跟右邊（3）只能差 1', '可以是 2、3 或 4');
  await step(tok);                                   // 1083.0 不要 4；2 或 3
  say('4 不要（root 就不是高 4 了）', '剩下 2 或 3');
  await step(tok);                                   // 1088.0 高度 2 節點比較少
  drawT(o4.filter((n) => inL.has(n)), TEAL, 3, objs);
  objs.push(line(T4.x, T4.y, T4.l.x, T4.l.y, -0.05));
  const tl = tag('最少的 h2：4 個', 'pkt', -3.2, 2.2);
  say('高度 2 的節點比較少', '選 h2：N(2) = 4');
  await step(tok);                                   // 1094.0 蓋 h3、蓋 h2、接起來
  void tr; void tl;
  note('N(4) = 7 + 4 + 1 = 12', 0, 0.4, 1.6);
  say('蓋一棵 h3、一棵 h2，用 root 接起來', 'N(4) = 12');
  talk(g, '就這樣', 'happy');
}]);

FRAG.push(['bstc-insert-65', '插入 6.5：路徑上每個節點高度 +1', async (tok) => {
  const t = stageT([4, 2, 5, 1, 3, 6, 7]);
  const g = pal();
  hTags(t, () => '');
  const path = [4, 5, 6, 7].map((k) => nodeOf(t, k));
  const old = new Map(path.map((n) => [n, hE(n)]));
  const cur = makeCursor();
  let z;
  await step(tok);                                   // 1107.0 還記得一般 BST 怎麼 insert？
  say('還記得一般 BST 怎麼 insert 嗎？', '');
  await step(tok);                                   // 1118.0 insert 6.5
  say('在這棵樹 insert 6.5', '');
  talk(g, '6.5 放哪？');
  await step(tok);                                   // 1146.0 比 6 大、比 7 小 → 7 的左邊
  await walk(tok, t, cur, 6.5, 400);
  hideCursor(cur);
  z = put(t, 6.5); setTag(z, '');
  say('6.5 > 4、> 5、> 6，但 < 7', '→ 放在 7 的左邊');
  await step(tok);                                   // 1169.0 節點裡存著高度
  path.forEach((n) => setTag(n, 'h ' + old.get(n)));
  inorder(t.root).filter((n) => !old.has(n) && n !== z).forEach((n) => setTag(n, 'h ' + hE(n)));
  setTag(z, 'h 0');
  say('AVL 的每個節點都存著高度', '（先看存的舊值）');
  await step(tok);                                   // 1180.0 路徑上原本是 0、1、2、3
  path.forEach((n) => setTag(n, 'h ' + old.get(n), true));
  say('路徑 7、6、5、4 原本的高度', '0、1、2、3');
  await step(tok);                                   // 1190.0 加了這個 node：全部 +1
  path.forEach((n) => setTag(n, 'h ' + old.get(n) + '→' + hE(n), true));
  say('加上 6.5 以後：每一個都 +1', '');
  talk(g, '全部 +1', 'wow');
  await step(tok);                                   // 1198.0 沿著 insert 路徑往下、加上去
  for (const n of path) glow(n, HOT);
  say('我們沿著 insert 的路徑往下走', '找到位置再加上去');
  await step(tok);                                   // 1209.0 路徑上的高度都可能變
  say('（例子挑得剛好）一般來說', '路徑上節點的高度都可能改變');
  await step(tok);                                   // 1214.0 AVL：insert 後要更新路徑上的高度
  for (const n of path) glow(n, OFF);
  say('所以 AVL insert 之後', '要把路徑上每個節點的高度更新好');
  await step(tok);                                   // 1223.0 變成 1、2、3、4
  path.forEach((n) => setTag(n, 'h ' + hE(n), true));
  say('更新後是 1、2、3、4', '');
  talk(g, '更新完成', 'happy');
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
FRAG.push(['bstc-rebalance-code', 'AVL insert = BST insert + rebalance', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const cp = code(REB, -2.6, 6.6);
  const R = rig();
  const P = [[4.4, 6.2], [5.4, 4.9], [4.6, 3.6], [5.6, 2.3]];
  P.slice(0, 3).forEach(([x, y], i) => R.node('n' + i, '', x, y, BLUE));
  R.wire([['n0', 'n1'], ['n1', 'n2']]);
  await step(tok);                                   // 1233.0 先做一般的 insert / delete
  cp.hl(1);
  R.node('n3', 'new', P[3][0], P[3][1], ORNG, null, 3);
  R.wire([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
  say('AVL 的寫法：先做一般的 insert、delete', '');
  await step(tok);                                   // 1238.0 原本是 AVL，加了一個可能有點歪
  KG(R.m.n0, HOT);
  say('原本是 AVL，加或刪一個 node 之後', '可能有點歪 → 就不是 AVL 了');
  await step(tok);                                   // 1246.0 所以有 rebalance
  KG(R.m.n0, null); cp.hl(2);
  say('所以有 rebalance 這個程序', '');
  await step(tok);                                   // 1251.0 insert / delete 只有幾行
  say('講義第二頁：insert、delete 只有幾行', '');
  await step(tok);                                   // 1258.0 呼叫舊的程式再呼叫 rebalance
  cp.hl(1);
  say('因為它們只是呼叫舊的 BST 程式', '再呼叫 rebalance');
  await step(tok);                                   // 1264.0 魔法都在 rebalance
  cp.hl(3);
  say('AVL 所有的魔法都在 rebalance', '');
  talk(g, '魔法在這', 'wow');
  await step(tok);                                   // 1271.0 rebalance 有一個 while 迴圈
  cp.hl(4);
  say('rebalance 有一個 while 迴圈', '');
  await step(tok);                                   // 1275.0 迴圈第一件事：update height
  cp.hl(5);
  KG(R.m.n3, HOT);
  say('迴圈裡第一件事：更新高度', '');
  await step(tok);                                   // 1279.0 高度可能剛變：舊值不能用
  say('insert 之後高度可能變了', '拿舊高度做判斷就錯了');
  await step(tok);                                   // 1302.0 它會呼叫 rotate
  KG(R.m.n3, null); cp.hl(6);
  say('先別急著看懂 rebalance', '它做的事：呼叫 left / right rotate');
  await step(tok);                                   // 1307.0 工具：left_rotate、right_rotate
  cp.hl(7);
  say('魔法在 rebalance', '用的工具只有 left_rotate、right_rotate');
  talk(g, '兩個工具', 'happy');
}]);

// Right / Left rotate：圖與 pseudocode
function rotPic(L) {
  const X = (x) => (L ? -4 - x : x);
  const R = rig();
  R.node('E', 'E', X(-4.2), 6.4, GRAY); R.node('A', 'A', X(-2), 5.1, BLUE); R.node('B', 'B', X(-3.4), 3.8, TEAL);
  R.sub('a', 'a', X(-4.4), 2.5); R.sub('c', 'c', X(-2.4), 2.5); R.sub('d', 'd', X(-0.6), 3.8);
  R.wire([['E', 'A'], ['A', 'B'], ['A', 'd'], ['B', 'a'], ['B', 'c']]);
  R.after = () => {
    R.place({ B: [X(-2), 5.1], A: [X(-0.6), 3.8], a: [X(-3.4), 3.8], c: [X(-1.6), 2.5], d: [X(0.4), 2.5] });
    R.wire([['E', 'B'], ['B', 'a'], ['B', 'A'], ['A', 'c'], ['A', 'd']]);
  };
  return R;
}
FRAG.push(['bstc-right-rotate', 'Right rotate：B 升上來，c 換給 A', async (tok) => {
  fresh(...CAM);
  const g = pal(6.3, 2.8);
  const R = rotPic(false);
  const lines = ['right_rotate(A):  B = A.left', 'B.right = A ;  A.parent = B', 'A.left = c ;  c.parent = A', 'B.parent = E', 'if E.right is A: E.right = B', 'else:            E.left  = B'];
  let cp = null;
  const show = (i) => { if (!cp) { cp = code(lines, 3.9, 6.2); } cp.ls.forEach((l, k) => { l.element.style.visibility = k <= i ? '' : 'hidden'; }); cp.hl(i); };
  await step(tok);                                   // 1316.0 rotation 該做什麼
  KG(R.m.A, HOT); KG(R.m.B, HOT);
  say('來看 rotation 應該做什麼', 'A 和它的左 child B');
  talk(g, '來轉轉看');
  await step(tok);                                   // 1326.0 它們的 children：a、c、d
  KG(R.m.A, null); KG(R.m.B, null);
  say('它們底下的子樹：a、c、d', '（灰塊 = 一整棵 subtree）');
  await step(tok);                                   // 1337.0 整塊掛在 E 底下
  KG(R.m.E, HOT);
  say('這整塊掛在某個 node E 底下', '');
  await step(tok);                                   // 1351.0 right rotate 之後長這樣
  KG(R.m.E, null); R.after();
  say('right rotate 之後：B 升上來、A 降下去', '');
  talk(g, '轉好了');
  await step(tok);                                   // 1371.0 c 從 B 搬到 A
  KG(R.m.c, HOT);
  say('注意 c 從 B 搬到了 A 底下', '');
  await step(tok);                                   // 1376.0 仍是 BST：順序一樣
  KG(R.m.c, null);
  const ord = tag('中序：a B c A d（轉前轉後都一樣）', 'pkt', -2, 1.2);
  say('搬法讓整棵仍是 BST', '由左到右的順序不變，search 照樣能用');
  await step(tok);                                   // 1390.0 寫 pseudocode
  say('來寫做到這件事的 pseudocode', '');
  await step(tok);                                   // 1420.0 必須 O(1)：只能改看得到的連結
  remove(ord);
  say('整件事必須是 constant time', '只能改圖上這幾條連結，不能鑽進子樹裡');
  await step(tok);                                   // 1519.0 B 的右邊變成 A
  show(1);
  say('B.right = A', 'A 變成 B 的右 child');
  await step(tok);                                   // 1545.0 A 的左邊 = c；c 的 parent = A
  show(2);
  say('A.left = c，而且 c.parent = A', '');
  await step(tok);                                   // 1563.0 改 child 也要改 parent：成對
  say('改了 child 就要改 parent，兩邊對上', '');
  await step(tok);                                   // 1579.0 一定要成對改
  say('永遠成對改，才不會搞丟', '');
  talk(g, '成對改');
  await step(tok);                                   // 1588.0 B 的 parent 是 E；E 的 child？
  show(3);
  say('B.parent = E', 'E 的 child 要改成誰？');
  await step(tok);                                   // 1604.0 看 A 是 E 的左還是右
  KG(R.m.E, HOT);
  say('圖上 A 在 E 的右邊', '但也可能在左邊：兩種情況都要處理');
  await step(tok);                                   // 1618.0 比 key：B > E？
  say('學生：比 key，B > E 就接右邊', '');
  await step(tok);                                   // 1638.0 比較很貴怎麼辦？
  say('如果比較 key 很貴呢？', '能不能只看樹的結構？');
  await step(tok);                                   // 1663.0 A 原本是右 child → B 也是
  show(4);
  say('A 原本是 E 的右 child → 現在 B 是右 child', '（child 還沒改，所以還看得到）');
  await step(tok);                                   // 1671.0 比指標，不比 key
  show(5);
  say('這是指標比較（E.right is A）', '不是 key 比較');
  await step(tok);                                   // 1691.0 temp 變數、順序：講義處理好了
  KG(R.m.E, null); cp.hl(-1);
  say('temp 變數、指定的順序：講義的 Python 寫好了', '自己寫時：記住從哪張圖變到哪張圖');
  talk(g, '記圖就好', 'happy');
}]);

FRAG.push(['bstc-left-rotate', 'Left rotate 與為什麼要 rebalance', async (tok) => {
  fresh(...CAM);
  const g = pal(6.3, 2.8);
  const R = rotPic(true);
  await step(tok);                                   // 1725.0 left rotate：R、L 對調
  const cp = code(['left_rotate(A):  B = A.right', 'B.left = A ;  A.parent = B', 'A.right = c ;  c.parent = A', 'B.parent = E', 'if E.left is A: E.left = B', 'else:           E.right = B'], 0.6, 6.2);
  R.after();
  say('left rotate？把 R 和 L 對調', '複製、貼上、left ↔ right，完成');
  talk(g, '鏡像而已');
  await step(tok);                                   // 1733.0 為什麼要用 rotation 來 rebalance？
  cp.kill(); for (const id in R.m) kill(R.m[id]); R.ls.forEach(kill);
  say('為什麼需要 rotation 來 rebalance？', '');
  await step(tok);                                   // 1745.0 不然一直變大的 key 會讓程式掛掉
  const chain = [];
  for (let i = 0; i < 7; i++) { chain.push(cube(i + 1, BLUE, [0.6, 0.45, 0.6], -5 + i * 1.1, 6.6 - i * 0.8, 0, 2)); if (i) line(-5 + (i - 1) * 1.1, 6.6 - (i - 1) * 0.8, -5 + i * 1.1, 6.6 - i * 0.8, -0.05); }
  say('如果 key 一個比一個大地進來', '樹變一條長鏈，找東西時程式可能掛掉');
  await step(tok);                                   // 1758.0 遞迴深度超過上限
  chain.forEach((m, i) => KG(m, i > 4 ? BAD : null));
  say('為什麼掛？遞迴深度超過上限', '一路往下走太深了');
  talk(g, '太深了', 'sad');
  await step(tok);                                   // 1764.0 就算不掛也很慢
  say('就算沒有遞迴深度問題', '也會很慢');
  await step(tok);                                   // 1770.0 不 rebalance：AVL 變慢的 BST
  say('從漂亮的 AVL 開始，不 rebalance', '就變成慢慢慢的 BST（測試會過不了）');
}]);

FRAG.push(['bstc-carrot', '依序插入 4,5,3,6,2,7,1：root 平衡但不是 AVL', async (tok) => {
  const t = stageT([]);
  const g = pal();
  await step(tok);                                   // 1787.0 學生：4、5、3、6、2 → 胡蘿蔔
  say('學生的例子：依序 insert', '4, 5, 3, 6, 2, 7, 1（不做 rebalance）');
  talk(g, '會長成什麼？');
  await step(tok);                                   // 1812.0 4、5、3
  for (const k of [4, 5, 3]) { put(t, k); await beat(tok, 450); }
  say('先 4，再 5、再 3', '');
  await step(tok);                                   // 1821.0 6、2、7、1
  for (const k of [6, 2, 7, 1]) { put(t, k); await beat(tok, 420); }
  say('接著 6、2、7、1', '長得像一根胡蘿蔔');
  await step(tok);                                   // 1834.0 這是 AVL 嗎？
  glow(t.root, OKG);
  hTags(t);
  say('學生覺得要轉了；但先問：這是 AVL 嗎？', '');
  await step(tok);                                   // 1839.0 平衡嗎？不，高度不開心
  glow(t.root, OFF);
  say('看起來平衡？不是：高度不開心', '');
  talk(g, '哪裡不開心？', 'wow');
  await step(tok);                                   // 1851.0 這裡高度 1
  const n3 = nodeOf(t, 3);
  glow(n3, REDG); setTag(n3, 'h_L 1', true);
  say('看 3：左邊（2 那棵）高度 1', '');
  await step(tok);                                   // 1856.0 這裡沒東西：−1
  setTag(n3, 'h_L 1、h_R −1', true);
  say('3 的右邊沒東西：高度 −1', '<span class="no">差 2</span>');
  await step(tok);                                   // 1858.0 從 root 看兩邊很平衡
  glow(t.root, OKG);
  say('只看 root：左右都高 2，看起來平衡', '');
  await step(tok);                                   // 1868.0 AVL：每個節點都要成立
  glow(nodeOf(t, 5), REDG); setTag(nodeOf(t, 5), 'h_L −1、h_R 1', true);
  say('AVL 的條件要每個節點都成立', '5 也是左 −1、右 1');
  await step(tok);                                   // 1874.0 一個不平衡，整棵就不平衡
  glow(t.root, OFF);
  say('只要有一個節點不平衡', '整棵就不是 AVL');
  talk(g, '一個都不能少', 'calm');
  await step(tok);                                   // 1885.0 rebalance 要讓全部都平衡
  say('所以 rebalance（AVL 的魔法）', '轉完以後要確定每個節點都平衡');
}]);

FRAG.push(['bstc-complete-avl', '13 個節點的 complete tree 一定是 AVL', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const n = 13, keyOf = {}, pos = {}, ms = {};
  let r = 0;
  (function w(i) { if (i > n) return; w(2 * i); keyOf[i] = ++r; w(2 * i + 1); })(1);
  const hh = (i) => (i > n ? -1 : 1 + Math.max(hh(2 * i), hh(2 * i + 1)));
  const lvl = (lv) => { for (let i = 1 << lv; i < Math.min(n + 1, 2 << lv); i++) { pos[i] = [(keyOf[i] - 7) * 0.9, 6.4 - lv * 1.45]; ms[i] = cube(keyOf[i], colorFor(keyOf[i]), [0.65, 0.5, 0.65], pos[i][0], pos[i][1], 0, 3); if (i > 1) line(pos[i >> 1][0], pos[i >> 1][1], pos[i][0], pos[i][1], -0.05); } };
  await step(tok);                                   // 1907.0 任何個數都能放進 AVL 嗎？
  say('學生問：任何個數的節點都能排成 AVL 嗎？', '');
  talk(g, '好問題');
  await step(tok);                                   // 1918.0 1、2、3 個顯然可以，任何 n 呢？
  say('1、2、3 個顯然可以', '那任意 n 個呢？');
  await step(tok);                                   // 1931.0 一直呼叫 AVL insert 就得到
  say('一個答案：一直呼叫 AVL insert', '就會得到一棵 AVL');
  await step(tok);                                   // 1938.0 13 個？17 個？
  say('學生想問的是：13 個能不能？17 個呢？', '有沒有排不出來的數量？');
  await step(tok);                                   // 1954.0 完美的 BST 長什麼樣？
  say('先想：完美的 binary search tree 長什麼樣？', '');
  await step(tok);                                   // 1967.0 complete tree：一層一層填
  for (let lv = 0; lv < 4; lv++) { lvl(lv); await beat(tok, 380); }
  say('complete tree：一層一層填滿', '最後一層從左邊開始放');
  await step(tok);                                   // 1980.0 heap 就長這樣
  say('在哪裡看過？heap 就長這樣', '');
  await step(tok);                                   // 1988.0 heap 的值不符合 BST
  say('只是 heap 裡的值不符合 BST 規則', '這裡把 1…13 照中序放，它就是 BST');
  await step(tok);                                   // 1997.0 這是 AVL 嗎？
  say('這棵是 AVL 嗎？', '');
  talk(g, '是嗎？', 'wow');
  await step(tok);                                   // 2031.0 這是最好的樣子
  const tags = [];
  for (let i = 1; i <= n; i++) { const d = hh(2 * i) - hh(2 * i + 1); tags.push(tag('差 ' + Math.abs(d), 'idx', pos[i][0], pos[i][1] + 0.6)); }
  say('這是最漂亮、最好的樣子', '它最好符合 AVL 的定義，不然 AVL 就不喜歡完美的樹了');
  await step(tok);                                   // 2043.0 complete tree 一定是 AVL
  for (const i in ms) KG(ms[i], OKG);
  say('好消息：任何 complete tree 都是 AVL', '每個地方都平衡或幾乎平衡');
  talk(g, '一定是 AVL', 'happy');
  await step(tok);                                   // 2053.0 只有最後一層沒滿
  for (const i in ms) KG(ms[i], null);
  for (let i = 8; i <= n; i++) KG(ms[i], GOLD);
  say('唯一沒填滿的是最後一層', '');
  await step(tok);                                   // 2058.0 路徑長 log n 或 log n − 1
  say('root 到最後一層的路徑', '長度是 ⌊log n⌋ 或少 1');
  await step(tok);                                   // 2065.0 比高度：最多差 1
  for (let i = 8; i <= n; i++) KG(ms[i], null);
  say('不管在哪裡比左右高度', '最多差 1');
  await step(tok);                                   // 2071.0 可以一直加節點
  say('還可以一直往後加節點', '所以任何 n 都排得出 AVL');
}]);

FRAG.push(['bstc-qa-devil', 'Q&A：為什麼要「固定高度、最少節點」', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const objs = minShow(3, -2.6);
  await step(tok);                                   // 2081.0 為什麼固定高度要讓節點最少？
  say('學生問：固定高度時，為什麼要讓節點最少？', '');
  talk(g, '好問題');
  await step(tok);                                   // 2086.0 想蓋有效率的樹應該讓高度最小
  const full = []; [[3.4, 6.2], [2.3, 4.9], [4.5, 4.9], [1.75, 3.6], [2.85, 3.6], [3.95, 3.6], [5.05, 3.6]].forEach(([x, y], i) => full.push(cube('', TEAL, [0.6, 0.45, 0.6], x, y, 0, 3)));
  say('要蓋有效率的樹，不是應該讓高度最小、填滿嗎？', '');
  await step(tok);                                   // 2101.0 你想的是怎麼蓋好樹
  say('你想的是：怎麼蓋一棵好樹', '這沒錯');
  await step(tok);                                   // 2104.0 我在證明最大高度
  say('但這裡我在證明一個性質：', 'AVL 的高度「最多」多少');
  await step(tok);                                   // 2113.0 AVL 最壞是什麼樣？
  objs.forEach((m) => { if (m.isMesh) KG(m, HOT); });
  say('所以要問：AVL 最壞的情況長怎樣？', '怎麼讓 AVL 看起來越糟越好');
  talk(g, '扮黑臉', 'wow');
  await step(tok);                                   // 2120.0 平常我們寫程式是好人
  objs.forEach((m) => { if (m.isMesh) KG(m, null); });
  say('平常我們是寫程式的好人', '');
  await step(tok);                                   // 2130.0 想想怎麼把演算法弄壞
  say('寫完以後換個角度：扮演 devil\'s advocate', '我要怎麼弄壞這個演算法？');
  await step(tok);                                   // 2136.0 找到弱點就修；找不到就安心睡
  say('找到弄壞的方法，你大概也知道怎麼修', '找不到，就能安心睡覺、拿滿分');
  talk(g, '安心睡覺', 'happy');
}]);

FRAG.push(['bstc-qa-lopsided', 'Q&A：子樹也是歪的，只有兄弟要差 ≤ 1', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const T4 = minT(4), o4 = layT(T4, -0.6, 6.4, 0.95, 1.3), objs = [];
  drawT(o4, (n) => (n.d === 0 ? ORNG : BLUE), 0, objs);
  const inL = new Set(); (function w(n) { if (!n) return; inL.add(n); w(n.l); w(n.r); })(T4.l);
  await step(tok);                                   // 2149.0 學生：h−1 和 h−2 那兩邊
  say('學生問：板子上左右兩半，一邊 h−1、一邊 h−2', '');
  talk(g, '又一個好問題');
  await step(tok);                                   // 2165.0 h−2 那棵每個 leaf 都要 h−2？
  for (const n of o4) if (inL.has(n)) KG(n.m, HOT);
  say('h−2 那棵：每一片 leaf 都要在同一個深度嗎？', '');
  await step(tok);                                   // 2180.0 只是它的 root 高度要是 h−2
  for (const n of o4) if (inL.has(n)) KG(n.m, null);
  KG(T4.l.m, HOT);
  say('不是：只要那棵的 root 高度是 h−2', '');
  await step(tok);                                   // 2185.0 複製過來的那棵本身也是歪的
  for (const n of o4) if (inL.has(n)) KG(n.m, GOLD);
  say('我們是把之前那棵複製過來', '所以它本身也是歪的');
  await step(tok);                                   // 2190.0 不是每條路徑，只要一條
  for (const n of o4) if (inL.has(n)) KG(n.m, null);
  say('不是每條路徑都要到底', '只要有一條最長的就好');
  await step(tok);                                   // 2208.0 h2 的 AVL 接在這裡還是 h2
  KG(T4.l.m, HOT); KG(T4.r.m, HOT);
  say('高度 2 的 AVL 接在這裡還是高度 2', '旁邊那棵是高度 3');
  await step(tok);                                   // 2221.0 不是同一層都要一樣高，只看兄弟
  say('不是同一層的節點都要一樣高', '只有同一個 parent 的兩個 children 要比');
  await step(tok);                                   // 2227.0 同一層的兩個可以差 1
  say('同一個 parent 的兩個 children：高度可以差 1', '但不能超過 1（老師說成「同一層」，指的是兄弟）');
  await step(tok);                                   // 2234.0 差超過 1 就可能變 linked list
  KG(T4.l.m, null); KG(T4.r.m, null);
  say('如果可以差超過 1', '整棵就可能退化成 linked list');
  talk(g, '差 1 才理智', 'calm');
  await step(tok);                                   // 2260.0 效能保證：常數 × log n
  note('最壞仍是 常數 × log n', 0, 0.4, 1.6);
  say('效能的保證：最壞也是「常數 × log n」', '');
  await step(tok);                                   // 2272.0 常數比 1 大
  say('這個常數比 1 大', '（上課證過：約 1.44）');
  await step(tok);                                   // 2288.0 沒有演算法專門蓋出這種樹
  say('完美的樹只是畫在板子上好看', '沒有演算法能在一連串 insert / delete 中有效率地一直維持它');
}]);

// 一直線：一次旋轉
FRAG.push(['bstc-rebal-straight', 'Rebalance 情況一：一直線，一次左旋', async (tok) => {
  fresh(...CAM);
  const g = pal(6.3, 2.8);
  const R = rig();
  R.node('A', 'A', -1.5, 6.0, BLUE); R.node('B', 'B', 1.0, 4.6, TEAL);
  R.sub('s1', '?', -3.0, 4.6); R.sub('s2', '?', -0.3, 3.2); R.sub('s3', '?', 2.3, 3.2);
  R.wire([['A', 's1'], ['A', 'B'], ['B', 's2'], ['B', 's3']]);
  const hA = R.hang('A', ''), hB = R.hang('B', '');
  await step(tok);                                   // 2473.0 對這個 node 呼叫 rebalance
  KG(R.m.A, HOT);
  say('假設對 A 呼叫 rebalance', '');
  talk(g, '一步一步看');
  await step(tok);                                   // 2487.0 子樹高度：k−1；k−1 或 k；k
  relabel(R.m.s1, 'k−1'); relabel(R.m.s2, 'k−1 或 k'); relabel(R.m.s3, 'k');
  KG(R.m.A, null);
  say('三棵子樹的高度：k−1、k−1 或 k、k', '灰塊上的字 = 子樹高度');
  await step(tok);                                   // 2501.0 B 的高度？k+1
  txt(hB, 'h = k+1');
  say('先看是不是 AVL：B 的高度？', '不管中間那棵是哪個，B 都是 k + 1');
  await step(tok);                                   // 2525.0 checkRI 會失敗
  KG(R.m.A, BAD);
  say('對 A 呼叫 checkRI（檢查 rep invariant）', '<span class="no">會失敗</span>');
  await step(tok);                                   // 2532.0 k−1 vs k+1
  txt(hA, 'k−1 vs k+1'); hA.element.className = 'lab-label ptr alt';
  say('A 的左邊 k−1、右邊 k+1', '<span class="no">差 2，不開心</span>');
  talk(g, '不開心', 'sad');
  await step(tok);                                   // 2550.0 用 rotation 修
  say('怎麼修？當然是 rotation', '花了那麼多時間學旋轉');
  await step(tok);                                   // 2556.0 往這邊轉：標好 node
  for (const id of ['A', 'B', 's3']) KG(R.m[id], id === 'A' ? BAD : HOT);
  say('往這個方向轉（對 A 左旋）', '先把 node 標好');
  await step(tok);                                   // 2565.0 轉完：A 的高度？
  R.place({ B: [0, 6.0], A: [-1.6, 4.6], s1: [-2.9, 3.2], s2: [-0.4, 3.2], s3: [1.6, 4.6] });
  R.wire([['B', 'A'], ['B', 's3'], ['A', 's1'], ['A', 's2']]);
  KG(R.m.A, null); KG(R.m.B, null); KG(R.m.s3, null);
  txt(hA, 'h = ?'); hA.element.className = 'lab-label idx'; txt(hB, '');
  say('轉完：B 在上、A 在左下', 'A 底下是 k−1 和（k−1 或 k）→ A 的高度？');
  await step(tok);                                   // 2590.0 A = k 或 k+1
  txt(hA, 'h = k 或 k+1');
  say('A 的高度是 k 或 k + 1', '');
  await step(tok);                                   // 2606.0 B：k vs k 或 k+1 → 快樂
  txt(hB, 'k(+1) vs k'); KG(R.m.B, OKG); KG(R.m.A, OKG);
  say('B：右邊 k、左邊 k 或 k+1', '<span class="ok">差 ≤ 1 → AVL，開心</span>');
  talk(g, '開心！', 'happy');
  await step(tok);                                   // 2617.0 簡單的：一次旋轉
  say('這是簡單的 rebalance：轉一次就好', '');
  await step(tok);                                   // 2624.0 「k−1 或 k」不是分數
  KG(R.m.A, null); KG(R.m.B, null);
  note('「k−1 / k」= k−1 或 k（不是分數）', 0, 0.4, 1.6);
  say('學生問：k−1 / k 是分數嗎？', '不是，是「k−1 或 k」，沒有分數的高度');
}]);

FRAG.push(['bstc-rebal-zigzag', 'Rebalance 情況二：zigzag，先右旋再左旋', async (tok) => {
  fresh(...CAM);
  const g = pal(6.3, 2.8);
  const R = rig();
  R.node('A', 'a', -2.0, 6.2, BLUE); R.node('B', 'b', 0.8, 4.9, TEAL);
  R.sub('sA', 'k−1', -3.6, 4.9); R.sub('sB', 'k−1', 2.1, 3.6); R.sub('C', 'k', -0.5, 3.6);
  R.wire([['A', 'sA'], ['A', 'B'], ['B', 'C'], ['B', 'sB']]);
  const hA = R.hang('A', ''), hB = R.hang('B', '');
  let hC = null;
  await step(tok);                                   // 2652.0 難的那一種
  say('來看難的那一種', '');
  talk(g, '難的來了');
  await step(tok);                                   // 2687.0 高度？是不是 AVL？
  txt(hB, 'h = k+1');
  say('這裡的高度？b 是 k + 1', '是不是 AVL？');
  await step(tok);                                   // 2698.0 k−1 vs k+1 → 不是
  txt(hA, 'k−1 vs k+1'); hA.element.className = 'lab-label ptr alt'; KG(R.m.A, BAD);
  say('a：左 k−1、右 k+1', '<span class="no">差 2，不是 AVL</span>');
  await step(tok);                                   // 2717.0 學生：右旋，在哪？
  say('學生：做 right rotation', '在哪裡做？把它拆開來看');
  await step(tok);                                   // 2739.0 拆開：c 底下兩棵 k−1
  kill(R.m.C); R.ls.forEach(kill);
  R.node('C', 'c', -0.5, 3.6, PURP); R.sub('c1', 'k−1', -1.5, 2.3); R.sub('c2', 'k−1', 0.5, 2.3);
  R.wire([['A', 'sA'], ['A', 'B'], ['B', 'C'], ['B', 'sB'], ['C', 'c1'], ['C', 'c2']]);
  hC = R.hang('C', 'h = k');
  say('高度 k 那棵拆開：node c 加兩棵 k−1', '三個 node：a、b、c');
  await step(tok);                                   // 2747.0 在 b 右旋：c 取代 b
  KG(R.m.B, HOT); KG(R.m.C, HOT);
  R.place({ C: [0.8, 4.9], B: [2.1, 3.6], c2: [1.3, 2.3], sB: [2.9, 2.3], c1: [-0.5, 3.6] });
  R.wire([['A', 'sA'], ['A', 'C'], ['C', 'c1'], ['C', 'B'], ['B', 'c2'], ['B', 'sB']]);
  say('對 b 右旋：c 升到 b 的位置', 'b 的右子樹不變，左邊換成 c 的一棵 k−1');
  await step(tok);                                   // 2779.0 b、c 的高度？AVL？
  txt(hB, 'h = k'); txt(hC, 'h = k+1');
  say('b 變 k、c 變 k + 1', 'a 還是 k−1 vs k+1：還不是 AVL');
  await step(tok);                                   // 2799.0 沒完成，但現在可以轉了
  KG(R.m.B, null);
  say('還沒完成，但好消息是：', '現在變成一直線，可以轉了');
  talk(g, '變一直線了');
  await step(tok);                                   // 2807.0 一步修好：對 a 左旋
  R.place({ C: [-0.4, 6.2], A: [-2.0, 4.9], sA: [-3.0, 3.6], c1: [-1.0, 3.6], B: [1.2, 4.9], c2: [0.4, 3.6], sB: [2.0, 3.6] });
  R.wire([['C', 'A'], ['C', 'B'], ['A', 'sA'], ['A', 'c1'], ['B', 'c2'], ['B', 'sB']]);
  KG(R.m.A, null); KG(R.m.C, OKG);
  txt(hA, 'h = k'); hA.element.className = 'lab-label idx'; txt(hB, 'h = k'); txt(hC, 'h = k+1');
  say('就是簡單的情況：對 a 左旋，一步修好', 'c 當根，左右都是 k');
  talk(g, '修好了', 'happy');
  await step(tok);                                   // 2826.0 差別在 heavy path
  KG(R.m.C, null);
  say('兩種情況的差別：heavy path（比較重的路徑）', '比較高的那條往下走的方向');
  await step(tok);                                   // 2839.0 一直線 → 一次旋轉
  note('heavy path 一直線 → 轉 1 次', -2.6, 0.6, 1.6);
  say('情況一：k+2、k+1、k 排成一直線', '轉一次就把重量平均分開');
  await step(tok);                                   // 2852.0 zigzag → 兩次
  note('zigzag → 轉 2 次（先拉直）', 2.6, 0.6, 1.6);
  say('情況二：heavy path 是 zigzag', '先轉一次拉成一直線，再轉一次');
  await step(tok);                                   // 2882.0 一般做法：先檢查高度、看重的那邊
  say('一般步驟：在一個 node 先看是否已經平衡', '不平衡：看哪邊重，再看那個 child 哪邊重');
  await step(tok);                                   // 2900.0 一直線或 zigzag → 1 或 2 次
  say('看 heavy path 是一直線還是 zigzag', '決定轉 1 次還是 2 次');
}]);

FRAG.push(['bstc-rot-heights', '旋轉後更新高度：先 A 再 B', async (tok) => {
  fresh(...CAM);
  const g = pal(6.3, 2.8);
  const R = rig();
  R.node('A', 'A', 0, 6.0, BLUE); R.node('B', 'B', -1.6, 4.6, TEAL);
  R.sub('a', 'a h1', -2.6, 3.2); R.sub('c', 'c h0', -0.6, 3.2); R.sub('d', 'd h0', 1.6, 4.6);
  R.wire([['A', 'B'], ['A', 'd'], ['B', 'a'], ['B', 'c']]);
  const hA = R.hang('A', 'h 3'), hB = R.hang('B', 'h 2');
  await step(tok);                                   // 2911.0 高度一直在變
  say('還有一件事：旋轉時高度一直在變', '');
  talk(g, '高度呢？');
  await step(tok);                                   // 2922.0 不更新高度 → 做錯決定
  say('只轉不更新高度', '看起來像 AVL，但記的高度是錯的 → 之後會做錯決定');
  await step(tok);                                   // 2937.0 在哪裡更新？
  say('在哪裡更新高度？', '如果 rotate 自己會更新，就不用擔心了');
  await step(tok);                                   // 2966.0 原本的情況：A、B 加子樹
  R.place({ B: [0, 6.0], A: [1.6, 4.6], a: [-1.6, 4.6], c: [0.6, 3.2], d: [2.6, 3.2] });
  R.wire([['B', 'a'], ['B', 'A'], ['A', 'c'], ['A', 'd']]);
  say('以原本的例子：對 A 右旋', '哪些高度變了？');
  await step(tok);                                   // 2998.0 B 和可能 A
  KG(R.m.A, HOT); KG(R.m.B, HOT);
  say('B 的高度變了，A 也可能變', '不確定就都更新一次');
  await step(tok);                                   // 3006.0 更新 B 再更新 A？
  KG(R.m.A, null);
  txt(hB, 'h 4 ✗'); hB.element.className = 'lab-label ptr alt'; KG(R.m.B, BAD);
  say('先 update B、再 update A，對嗎？', '<span class="no">B = max(a 1, A 舊的 3) + 1 = 4 ✗</span>');
  await step(tok);                                   // 3033.0 子樹 c 呢？沒變
  KG(R.m.c, HOT);
  say('那 c 呢？它底下的 children 沒變', '所以 c 的高度不用管');
  await step(tok);                                   // 3061.0 但真的有問題
  KG(R.m.c, null);
  say('但你感覺到的問題是對的', '問題就在 B 用到了 A 的舊高度');
  talk(g, '順序錯了', 'wow');
  await step(tok);                                   // 3082.0 要先 A 再 B
  KG(R.m.B, null); txt(hB, 'h ?'); hB.element.className = 'lab-label idx';
  KG(R.m.A, HOT); txt(hA, 'h 1');
  say('先更新 A（現在在下面）', 'h(A) = max(c 0, d 0) + 1 = 1');
  await step(tok);                                   // 3087.0 高度從底下開始算
  KG(R.m.A, null); KG(R.m.B, HOT); txt(hB, 'h 2');
  say('高度從底下往上算：0、上一層、再上一層', 'h(B) = max(a 1, A 1) + 1 = 2');
  await step(tok);                                   // 3099.0 update_height 假設 children 正確
  KG(R.m.B, null);
  say('update_height 假設 children 的高度已經正確', '');
  await step(tok);                                   // 3110.0 先算 B 就是假的答案
  say('先算 B 的話，A 可能還沒更新', '得到的答案是假的');
  await step(tok);                                   // 3119.0 所以順序是 A 再 B
  note('由下往上：先 A、再 B', 0, 0.4, 1.6);
  say('所以順序一定是：先 A、再 B', '<span class="ok">由下往上</span>');
  talk(g, '由下往上', 'happy');
}]);

FRAG.push(['bstc-rebal-up', 'rebalance 要一路往上到 root', async (tok) => {
  fresh(...CAM);
  const g = pal();
  const cp = code(REB, -2.6, 6.6);
  const R = rig();
  const P = [[4.4, 6.2], [5.4, 4.9], [4.6, 3.6], [5.6, 2.3]];
  P.forEach(([x, y], i) => R.node('n' + i, '', x, y, i === 3 ? ORNG : BLUE));
  R.wire([['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3']]);
  await step(tok);                                   // 3138.0 剛才只在一個 node rebalance
  KG(R.m.n2, OKG);
  say('剛才講的是在「一個 node」rebalance 子樹', '');
  await step(tok);                                   // 3143.0 少了什麼？
  say('這張圖少了什麼？', '');
  talk(g, '少了什麼？');
  await step(tok);                                   // 3152.0 insert 之後高度一路往上都變
  cp.hl(8);
  say('從這裡往下看起來開心了', '但 insert / delete 讓高度一路往上都變了');
  await step(tok);                                   // 3163.0 要一路往上 rebalance
  for (let i = 1; i >= 0; i--) { KG(R.m['n' + i], HOT); await beat(tok, 450); KG(R.m['n' + i], OKG); }
  cp.hl(4);
  say('所以要一路往上走到 root', '每一層都可能要再 rebalance');
  await step(tok);                                   // 3170.0 這就是 AVL
  cp.hl(-1);
  say('這就是 AVL', '');
  talk(g, '懂了嗎？', 'happy');
}]);

// ═══ Abdul Bari 10.1 AVL Tree ═══
const palB = () => pal(6.2, 2.7, '#f6c35b', 0.55, 'Bari');
// 一次 BST 搜尋的一步：游標到 x，回傳下一個 node
FRAG.push(['bstc-bari-search', 'BST 搜尋 30、60、32：比較次數 ≤ 高度', async (tok) => {
  fresh(...CAM);
  const g = palB();
  const t = view();
  const cur = makeCursor();
  let cnt = null;
  const goto = (x, i) => { cursorTo(cur, x.pos); glow(x, HOT); if (!cnt) cnt = tag('', 'pkt', -5, 6.6); txt(cnt, '比較 ' + i + ' 次'); };
  await step(tok);                                   // 28.8 左邊都比它小
  grow(t, [40, 20, 50, 10, 30, 60]); await beat(tok, 700);
  say('binary search tree：對任何 node', '左邊的元素都比它小');
  talk(g, '左小右大');
  await step(tok);                                   // 36.0 右邊都比它大：整棵子樹
  say('右邊的元素都比它大', '左子樹全部比 key 小、右子樹全部比 key 大');
  await step(tok);                                   // 45.0 例：30 > 20、10 < 20
  const n20 = nodeOf(t, 20); glow(n20, HOT);
  say('例如 20：右邊 30 比它大、左邊 10 比它小', '');
  await step(tok);                                   // 56.1 好搜尋：找 30
  glow(n20, OFF);
  say('為什麼好用？拿來搜尋', '例：找 30');
  await step(tok);                                   // 62.2 從 root 開始：不是 30，比較小 → 左
  goto(t.root, 1);
  say('從 root 開始：是 30 嗎？不是', '30 < 40 → 往左');
  await step(tok);                                   // 74.0 不是 30，比較大 → 右
  glow(t.root, OFF); goto(n20, 2);
  say('是 30 嗎？不是', '30 > 20 → 往右');
  await step(tok);                                   // 79.0 找到：3 次比較
  glow(n20, OFF); const n30 = nodeOf(t, 30); goto(n30, 3); glow(n30, OKG);
  say('是 30：找到了', '總共比較 3 次');
  talk(g, '3 次！', 'happy');
  await step(tok);                                   // 84.0 找 60
  glow(n30, OFF); goto(t.root, 1);
  say('再找 60：60 > 40 → 往右', '');
  await step(tok);                                   // 97.0 60 > 50 → 右 → 找到
  glow(t.root, OFF); const n50 = nodeOf(t, 50); goto(n50, 2); await beat(tok, 500); glow(n50, OFF);
  const n60 = nodeOf(t, 60); goto(n60, 3); glow(n60, OKG);
  say('60 > 50 → 往右：找到', '也是 3 次比較');
  await step(tok);                                   // 108.0 找 32
  glow(n60, OFF);
  say('再找一個：32', '');
  await step(tok);                                   // 116.0 40 → 左、20 → 右、30 → 右：沒東西
  const p = await walk(tok, t, cur, 32, 450);
  txt(cnt, '比較 ' + p.length + ' 次');
  say('32 < 40 往左、32 > 20 往右、32 > 30 往右', '右邊什麼都沒有 → 搜尋失敗');
  talk(g, '找不到', 'sad');
  await step(tok);                                   // 136.5 成功或失敗
  hideCursor(cur);
  say('搜尋有兩種結果：找到（成功）或找不到（失敗）', '');
  await step(tok);                                   // 148.0 失敗也比了 3 次
  say('失敗的時候比了幾次？1、2、3', '一樣 3 次');
  await step(tok);                                   // 154.0 最多比較次數看高度
  say('最多要比較幾次，取決於樹的高度', '所以搜尋時間看高度');
  await step(tok);                                   // 165.0 高度從 1 開始數：3
  const hl = [6.6, 5.25, 3.9].map((y, i) => tag(String(i + 1), 'pkt', -6.3, y - 0.3));
  void hl;
  say('一般高度從 0 數，Bari 從 1 數（數層數）', '這棵高度 = 3');
  await step(tok);                                   // 186.0 左小右大＋時間看高度
  say('BST 的性質：小的在左、大的在右', '搜尋時間取決於高度');
  await step(tok);                                   // 197.0 高度最小 log n、最大 n
  note('高度：最小 log n，最大 n', 0, 0.4, 1.6);
  say('那 binary tree 的高度是多少？', '最小 log n、最大 n：看情況');
}]);

FRAG.push(['bstc-bari-two-orders', '同一組 key：高度 3 或高度 7', async (tok) => {
  fresh([0, 4.3, 13.5], [0, 3.8, 0]);
  const g = palB();
  const small = { size: [0.55, 0.42, 0.55], width: 5.4, maxSp: 0.9, topY: 6.5, minY: 0.6, maxStep: 1.3 };
  const l = view(Object.assign({ cx: -3.5 }, small)), r = view(Object.assign({ cx: 3.5 }, small));
  const A = [30, 40, 10, 50, 20, 5, 35], B = [50, 40, 35, 30, 20, 10, 5];
  let ll = null, rl = null;
  const insL = (k) => put(l, k), insR = (k) => put(r, k);
  await step(tok);                                   // 208.0 同一組 key 可以排出不同的 BST
  say('同一組 key 可以排出不同的 BST', '高度可能長到 n，也可能縮到 log n');
  talk(g, '看順序');
  await step(tok);                                   // 225.0 搜尋最快 log n、最慢 n
  say('所以搜尋時間最少 log n、最多 n', '');
  await step(tok);                                   // 230.8 BST 的問題在哪？來建一棵
  say('BST 的問題在哪？', '來實際建一棵');
  await step(tok);                                   // 242.0 同一組 key、不同順序
  ll = tag(A.join(', '), 'pkt', -3.5, 7.5); rl = tag(B.join(', '), 'pkt', 3.5, 7.5);
  say('左右兩組是同樣的 key', '只是順序不一樣');
  await step(tok);                                   // 256.0 一次 insert 一個：30
  insL(30);
  say('建 BST 的方法：一次 insert 一個', '第一個 30 當 root');
  await step(tok);                                   // 260.0 40 > 30 → 右
  insL(40);
  say('insert 40：40 > 30 → 右邊', '');
  await step(tok);                                   // 266.3 10 < 30 → 左
  insL(10);
  say('insert 10：10 < 30 → 左邊', '');
  await step(tok);                                   // 278.6 50：每個都從 root 比
  insL(50);
  say('insert 50：每次都從 root 開始比', '> 30、> 40 → 40 的右邊');
  await step(tok);                                   // 283.0 20
  insL(20);
  say('insert 20：< 30 往左、> 10 → 10 的右邊', '');
  await step(tok);                                   // 296.0 5
  insL(5);
  say('insert 5：< 30、< 10 → 10 的左邊', '');
  await step(tok);                                   // 303.3 35
  insL(35);
  say('insert 35：> 30、< 40 → 40 的左邊', '');
  await step(tok);                                   // 314.0 再 insert 50：重複不放
  const dup = tag('50 ✗ 已經有了', 'note', -1.4, 2.0, 1.0);
  say('如果又來一個 50：一路比到 50，已經有了', 'BST 不放重複的 key');
  await step(tok);                                   // 332.3 高度？最小：log n
  remove(dup);
  txt(ll, '高度 3 ≈ log n');
  say('這棵的高度：最小的高度 log n', '');
  await step(tok);                                   // 341.3 搜尋時間 log n
  say('搜尋任何 key 的時間：log n', '看高度');
  talk(g, '很快', 'happy');
  await step(tok);                                   // 355.6 同樣的 key，換個順序
  say('同樣的 key，順序不同', '再建一棵');
  await step(tok);                                   // 367.0 50，40 往左
  insR(50); await beat(tok, 350); insR(40);
  say('先 50，40 < 50 → 左邊', '');
  await step(tok);                                   // 373.0 35、30、20、5 全部往左
  for (const k of [35, 30, 20, 10, 5]) { insR(k); await beat(tok, 330); }
  say('35、30、20、10、5：每個都比前面小', '一路往左下長');
  talk(g, '歪掉了', 'sad');
  await step(tok);                                   // 395.3 高度 = n
  txt(rl, '高度 7 = n');
  say('這棵高度是 n', '');
  await step(tok);                                   // 403.7 這就是 BST 的問題
  say('key 的順序剛好讓樹長成高度 n', '這就是 BST 的問題');
  await step(tok);                                   // 419.0 高度不受控制：log n 或 n
  say('方法一樣是一次 insert 一個', '但最後高度不受控制：可能 log n，也可能 n');
  await step(tok);                                   // 443.0 搜尋像 linear search
  say('高度是 n 時，搜尋時間就是 n', '跟 linear search 一樣');
  await step(tok);                                   // 453.0 找 5：比 7 次
  const cur = makeCursor();
  await walk(tok, r, cur, 5, 260);
  say('找 5：每次都更小、往左', '總共比 7 次');
  await step(tok);                                   // 468.0 缺點：看 key 怎麼 insert
  hideCursor(cur);
  note('BST 的缺點：高度取決於 insert 順序', 0, 0.4, 1.6);
  say('BST 的缺點：高度不受控制', '完全看 key 怎麼 insert');
}]);

FRAG.push(['bstc-bari-six-orders', '3 個 key 的 6 種插入順序', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 3.8, 0]);
  const g = palB();
  const XS = { 10: -1, 20: 0, 30: 1 };
  const drawn = [];
  const draw = (o, i) => {
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
    drawn.push([cx, top, height(t.root), seen]);
  };
  await step(tok);                                   // 495.5 30、20、10 → 一條
  draw([30, 20, 10], 0);
  say('3 個 key：照 30、20、10 的順序 insert', '20 在 30 左邊、10 在 20 左邊');
  await step(tok);                                   // 507.0 同樣的 key 可以換順序嗎？
  say('同樣的 key，可以換個順序 insert 嗎？', '可以，順序有很多種');
  talk(g, '換順序');
  await step(tok);                                   // 523.0 30、10、20
  draw([30, 10, 20], 1);
  say('30、10、20：10 在左，20 夾在中間', '又是另一種形狀');
  await step(tok);                                   // 540.0 10、30、20
  draw([10, 30, 20], 2);
  say('10、30、20', '');
  await step(tok);                                   // 560.4 10、20、30
  draw([10, 20, 30], 3);
  say('10、20、30：一路往右', '');
  await step(tok);                                   // 569.0 3! = 6 種
  say('3 個 key 有幾種順序？', '3! = 6 種');
  await step(tok);                                   // 585.0 20、10、30
  draw([20, 10, 30], 4);
  say('20、10、30', '');
  await step(tok);                                   // 595.4 20、30、10
  draw([20, 30, 10], 5);
  say('20、30、10：跟上一棵一樣', '');
  await step(tok);                                   // 610.0 不同順序 → 不同形狀
  say('同一組 key，順序不同', '就得到不同形狀的 BST');
  await step(tok);                                   // 624.0 這些高度 3（最大）
  for (const [cx, top, h] of drawn) tag('h = ' + h, h === 3 ? 'ptr alt' : 'ptr', cx + 1.7, top - 1.0);
  say('這幾棵的高度都是 3', '3 個 key 高度 3：最大的高度');
  await step(tok);                                   // 638.0 這棵高度 2（最小）
  for (const [, , h, ns] of drawn) if (h === 2) ns.forEach((z) => KG(z.m, OKG));
  say('20 先進來的兩棵：高度 2', '最小的高度');
  talk(g, '這個最好', 'happy');
  await step(tok);                                   // 647.1 喜歡高度最小的
  say('同樣的 key 可以長很高、也可以很矮', '我們要的是高度最小的：搜尋才快');
  await step(tok);                                   // 666.0 BST 的缺點
  say('BST 的缺點：同樣的 key 會長出不同形狀', '可能最高、也可能最矮');
  await step(tok);                                   // 685.0 能不能把它們轉成這種？
  say('拿到高的形狀時，能不能把它變成矮的？', '「直接換掉」不行，要有一套方法');
  await step(tok);                                   // 707.3 定義一套程序：rotation
  say('所以定義一套程序來轉換', '叫做 rotation（旋轉）');
  talk(g, '旋轉！', 'wow');
}]);

FRAG.push(['bstc-bari-rot-idea', '用旋轉把高的 BST 拉成平衡', async (tok) => {
  fresh([0, 4.4, 13.5], [0, 4.4, 0]);
  const g = palB();
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
  await step(tok);                                   // 716.0 繞著這個 node 轉：把 30 拉過去
  KG(SH[0].m[30], HOT);
  const nail = tag('📌', '', SH[0].cx + 0.8, 6.9);
  say('繞著 30 這個 node 轉', '把 30 往右邊拉');
  talk(g, '拉線！');
  await step(tok);                                   // 724.0 20 升上來
  draw(SH[0], BAL); KG(SH[0].m[30], null);
  say('20 升上來，30 移到右下', '形狀就變了');
  await step(tok);                                   // 733.9 另一棵：繞著 10 轉
  remove(nail);
  KG(SH[1].m[10], HOT);
  say('另一棵：繞著 10 轉', '');
  await step(tok);                                   // 739.0 10 下來、20 上去
  draw(SH[1], BAL); KG(SH[1].m[10], null);
  say('10 往左下、20 升上來、30 在右邊', '');
  await step(tok);                                   // 743.0 像釘子上的線
  say('想像這裡釘了一根釘子，繞著它掛一條線', '一拉線，20 就升上來');
  talk(g, '📌 拉一拉', 'happy');
  await step(tok);                                   // 752.0 旋轉把高的變矮
  say('用旋轉，把高的 BST 變成矮的', '');
  await step(tok);                                   // 763.0 這就是 AVL 的想法
  tag('AVL 的想法', 'pkt', 0, 8.1);
  say('這就是 AVL tree 的想法', '');
  await step(tok);                                   // 769.0 這種呢？一步不行
  KG(SH[2].m[10], HOT);
  say('那這種 zigzag 呢？', '一步做不到');
  await step(tok);                                   // 774.0 先繞 10 轉：20 上來
  draw(SH[2], SH[2].mid);
  say('先繞著 10 轉：20 升上來', '變成一直線');
  await step(tok);                                   // 779.0 再繞 30 轉
  KG(SH[2].m[10], null); draw(SH[2], BAL);
  say('再繞著 30 轉：30 去右邊、20 升上來', '10 留在左邊');
  await step(tok);                                   // 789.0 這棵也一樣：先 30 再 10
  draw(SH[3], SH[3].mid); await beat(tok, 700); draw(SH[3], BAL);
  say('最後一棵也一樣：先繞 30、再繞 10', '');
  await step(tok);                                   // 794.0 四種旋轉
  say('一共四種旋轉', '把 BST 變成平衡的 BST');
  await step(tok);                                   // 805.0 很多 node 怎麼辦？
  say('你可能會問：只有三個 node 很簡單', '如果樹裡有很多 node 呢？');
  talk(g, '很多 node？');
  await step(tok);                                   // 818.0 旋轉永遠只動三個 node
  note('旋轉永遠只看 3 個 node', 0, 0.4, 1.6);
  say('記住：不管樹多大，旋轉永遠只動三個 node', '');
  await step(tok);                                   // 832.0 整棵樹因此平衡
  say('調整這三個 node', '整棵樹就會平衡、高度最小');
  await step(tok);                                   // 843.0 接下來：AVL 定義、旋轉、建樹
  say('接下來：AVL 的定義 → 旋轉 → 怎麼建 AVL tree', '');
}]);

FRAG.push(['bstc-bari-bf', 'Balance factor = h(左) − h(右)', async (tok) => {
  fresh(...CAM);
  const g = palB();
  // [x, y, bf, parent]
  const T1 = { r: [-4.8, 6.0, 0], L: [-5.6, 4.7, 1, 'r'], LL: [-6.2, 3.4, 0, 'L'], R: [-4.0, 4.7, 1, 'r'], RL: [-4.6, 3.4, 0, 'R'] };
  const T2 = { r: [0.4, 6.0, 2], X: [-0.8, 4.7, -2, 'r'], Y: [0.0, 3.4, 1, 'X'], Z: [-0.6, 2.1, 0, 'Y'], W: [1.6, 4.7, 0, 'r'] };
  const T3 = { r: [4.2, 6.0, -2], L: [3.4, 4.7, 0, 'r'], P: [5.2, 4.7, -1, 'r'], Q: [4.6, 3.4, 0, 'P'], S: [5.8, 3.4, -1, 'P'], U: [6.3, 2.1, 0, 'S'] };
  const ms = {};
  const draw = (T, p) => { for (const k in T) { ms[p + k] = cube(' ', '#c9b48e', [0.6, 0.48, 0.6], T[k][0], T[k][1], 0, 3); if (T[k][3]) { const q = T[T[k][3]]; line(q[0], q[1], T[k][0], T[k][1], -0.05); } } };
  const fill = (p, T, ks) => ks.forEach((k) => { const b = T[k][2], m = ms[p + k]; relabel(m, (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b)); K.tint(m, Math.abs(b) > 1 ? '#d64545' : '#2fc092'); });
  const f = note('bf = h(左子樹) − h(右子樹)', 0, 7.7, 0);
  await step(tok);                                   // 867.5 bf = 左高 − 右高
  say('AVL tree：height balanced 的 BST', '每個 node 算 balance factor：bf = 左子樹高 − 右子樹高');
  talk(g, '算 bf');
  await step(tok);                                   // 875.0 只能 −1、0、1
  txt(f, 'bf = h(左) − h(右) ∈ {−1, 0, 1}');
  say('bf 只能是 −1、0 或 1', '不能大於 1、不能小於 −1');
  await step(tok);                                   // 890.0 超出就是 imbalanced → 旋轉
  say('三個值之一：這個 node 平衡（balanced）', '否則不平衡（imbalanced）→ 要做 rotation');
  await step(tok);                                   // 905.1 |bf| ≤ 1
  txt(f, '|bf| = |h(左) − h(右)| ≤ 1');
  say('另一種寫法：|bf| ≤ 1', '取絕對值後只能是 0 或 1');
  await step(tok);                                   // 918.0 幾棵沒有 key 的樹
  draw(T1, 'a'); draw(T2, 'b'); draw(T3, 'c');
  say('這裡有幾棵 binary tree', '沒寫 key，只看形狀');
  await step(tok);                                   // 929.9 第一棵 root：左 2、右 2 → 0
  fill('a', T1, ['r']);
  say('第一棵的 root：左邊最長走 2 步、右邊也 2 步', '2 − 2 = 0');
  await step(tok);                                   // 951.0 這個：左 1、右 0 → 1
  fill('a', T1, ['L']);
  say('這個 node：左邊 1、右邊沒東西 0', '1 − 0 = 1');
  await step(tok);                                   // 956.0 另一個也是 1
  fill('a', T1, ['R']);
  say('這個：左 1、右 0', '也是 1');
  await step(tok);                                   // 963.0 leaf 都是 0 → 整棵平衡
  fill('a', T1, ['LL', 'RL']);
  say('leaf 的 bf 一定是 0', '0、1、1、0、0 全部在範圍內：這棵平衡');
  talk(g, '第一棵 OK', 'happy');
  await step(tok);                                   // 981.9 第二棵 root：數邊 3 − 1 = 2
  fill('b', T2, ['r']);
  say('第二棵的 root：左邊最長 3 條邊、右邊 1', '數「邊」不數 node：3 − 1 = 2 → 不平衡');
  await step(tok);                                   // 1003.0 這個：0 − 2 = −2
  fill('b', T2, ['X']);
  say('這個 node：左邊 0、右邊 2', '0 − 2 = −2 → 也不平衡');
  await step(tok);                                   // 1011.2 其他：1、0、0
  fill('b', T2, ['Y', 'Z', 'W']);
  say('其他的：1 − 0 = 1，leaf 都是 0', '');
  await step(tok);                                   // 1016.0 第三棵 root：1 − 3 = −2
  fill('c', T3, ['r']);
  say('第三棵的 root：左邊 1、右邊 3', '1 − 3 = −2 → 不平衡');
  await step(tok);                                   // 1029.0 數邊；其他 0、−1、−1
  fill('c', T3, ['L', 'Q', 'U', 'S', 'P']);
  say('再次提醒：高度數邊，不是數 node', 'leaf 0；這個 0 − 1 = −1；這個 1 − 2 = −1');
  await step(tok);                                   // 1043.0 後兩棵不平衡，第一棵完美
  say('後面兩棵有 node 不是 height balanced', '第一棵完全平衡');
  talk(g, '紅的要修', 'calm');
  await step(tok);                                   // 1057.0 不平衡就要旋轉
  say('只要有 node 不平衡', '就要做 rotation 把它平衡回來');
}]);

// ── Bari 的 3 個 key 旋轉（LL / LR / RR / RL）與建 AVL：自己控制每一步 ──
function avlView(seq, o) { fresh(...CAM); const t = view(Object.assign({ kind: 'avl' }, o || {})); if (seq.length) grow(t, seq, false); return t; }
function avlPut(t, k, showBf = false) { const z = attach(t, mk(k)); t.o.tag = showBf ? 'bf' : 'none'; layout(t); dropIn(z); return z; }
function badOf(t) { return inorder(t.root).filter((n) => Math.abs(bf(n)) > 1); }
function firstBad(z) { for (let x = z.parent; x; x = x.parent) if (Math.abs(bf(x)) > 1) return x; return null; }
function rotAll(t, c, stage) { applyAvl(t, c, stage); layout(t); }

FRAG.push(['bstc-bari-ll', 'LL 旋轉：30、20 再插 10', async (tok) => {
  const t = avlView([30, 20]);
  const g = palB();
  let z, c;
  await step(tok);                                   // 1084.0 30、20：bf 1、0 → 平衡
  bfOn(t, true);
  say('一開始：30、20', 'bf 是 1 和 0 → 平衡');
  talk(g, '目前平衡');
  await step(tok);                                   // 1098.5 insert 10：左的左
  z = avlPut(t, 10);
  say('insert 10：< 30 往左、< 20 往左', '');
  await step(tok);                                   // 1110.0 算 bf：0、1、2
  bfOn(t, true);
  say('算 bf：10 是 0、20 是 1、30 是 2', '');
  await step(tok);                                   // 1123.0 30 不平衡
  glow(t.root, REDG);
  say('30 變成 imbalanced', '要做 rotation');
  talk(g, '30 失衡', 'wow');
  await step(tok);                                   // 1135.0 為什麼：插在左的左 → LL
  c = avlCase(t.root); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr');
  say('為什麼失衡？因為插在「左的左」', '叫 LL imbalance');
  await step(tok);                                   // 1158.0 bf 2：左邊重；−2：右邊重
  say('bf = 2：左邊重；bf = −2：右邊重', '');
  await step(tok);                                   // 1172.0 因為是左的左 → 對這個 node 轉
  say('重點：因為插在左的左', '所以對這個 node 做這種旋轉');
  await step(tok);                                   // 1183.6 20 升上來、30 去右邊
  glow(t.root, OFF); clearMarks(t);
  rotAll(t, c);
  say('20 升上來、30 移到右邊', '10 補到 20 原本的位置');
  await step(tok);                                   // 1195.0 完全平衡
  for (const n of inorder(t.root)) glow(n, OKG);
  say('bf 全部 0：完全平衡', '');
  talk(g, '平衡了', 'happy');
  await step(tok);                                   // 1205.1 叫 LL rotation
  tag('LL rotation（單旋）', 'pkt', 0, 7.6);
  say('因為是 LL imbalance', '這個旋轉就叫 LL rotation');
  void z;
}]);

FRAG.push(['bstc-bari-lr', 'LR 旋轉：30、10 再插 20（兩步）', async (tok) => {
  const t = avlView([30, 10], { tag: 'bf' });
  const g = palB();
  let z, c;
  await step(tok);                                   // 1236.3 insert 20：左邊、10 的右邊
  z = avlPut(t, 20);
  say('30、10 之後 insert 20', '< 30 往左、> 10 → 10 的右邊');
  await step(tok);                                   // 1246.8 bf：0、−1、2
  bfOn(t, true);
  say('算 bf：20 是 0、10 是 −1、30 是 2', '');
  await step(tok);                                   // 1254.5 不平衡：先左再右 → LR
  glow(t.root, REDG);
  c = avlCase(t.root); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); mark(t, c.C, 'C', 'ptr');
  say('30 又失衡：這次插在「左的右」', 'LR imbalance');
  talk(g, '左 → 右', 'wow');
  await step(tok);                                   // 1269.3 我們要平衡的那種形狀
  say('三個 node 不管長怎樣', '我們都想把它變成平衡的那一種');
  await step(tok);                                   // 1281.2 這要兩步
  say('這種要做兩步的旋轉', '');
  await step(tok);                                   // 1293.0 第一步：繞 10 轉，20 上來
  glow(t.root, OFF); clearMarks(t);
  rotAll(t, c, 1);
  say('第一步：繞著 10 轉', '20 升上來、10 往左下：變一直線');
  await step(tok);                                   // 1312.0 第二步：20 當 root
  rotAll(t, c, 2);
  say('第二步：繞著 30 轉', '20 當 root，10 在左、30 在右');
  talk(g, '兩步完成', 'happy');
  await step(tok);                                   // 1336.0 兩步但算一個 double rotation
  for (const n of inorder(t.root)) glow(n, OKG);
  say('裡面有兩步', '但算成「一個」旋轉：double rotation');
  await step(tok);                                   // 1353.0 叫 LR rotation
  tag('LR rotation（雙旋）', 'pkt', 0, 7.6);
  say('失衡是 LR 型', '旋轉就叫 LR rotation');
  await step(tok);                                   // 1359.0 目前：LL 單步、LR 兩步
  say('目前學了兩種：LL（一步）', 'LR（兩步）');
  void z;
}]);

FRAG.push(['bstc-bari-rr', 'RR 旋轉：10、20 再插 30', async (tok) => {
  const t = avlView([10, 20], { tag: 'bf' });
  const g = palB();
  let c;
  await step(tok);                                   // 1382.0 insert 30：右的右
  avlPut(t, 30);
  say('一開始 10、20；insert 30', '> 10、> 20 → 20 的右邊');
  await step(tok);                                   // 1387.0 bf：0、−1、−2
  bfOn(t, true); glow(t.root, REDG);
  say('bf：0、−1、−2', '10 失衡');
  talk(g, '右邊重', 'wow');
  await step(tok);                                   // 1397.0 右的右 → RR
  c = avlCase(t.root); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr');
  say('插在「右的右」', 'RR imbalance');
  await step(tok);                                   // 1402.0 繞 10 轉：20 上來
  glow(t.root, OFF); clearMarks(t);
  rotAll(t, c);
  say('繞著 10 轉', '20 升上來');
  await step(tok);                                   // 1415.7 bf 0、0、0
  for (const n of inorder(t.root)) glow(n, OKG);
  say('bf 變成 0、0、0', '');
  talk(g, '平衡', 'happy');
  await step(tok);                                   // 1419.0 叫 RR rotation（單旋）
  tag('RR rotation（單旋）', 'pkt', 0, 7.6);
  say('RR imbalance → RR rotation', '第三種，也是單旋');
}]);

FRAG.push(['bstc-bari-rl', 'RL 旋轉：10、30 再插 20', async (tok) => {
  const t = avlView([10, 30], { tag: 'bf' });
  const g = palB();
  let c;
  await step(tok);                                   // 1441.0 insert 20：10 右邊、30 左邊
  avlPut(t, 20);
  say('一開始 10、30；insert 20', '> 10 往右、< 30 → 30 的左邊');
  await step(tok);                                   // 1447.9 bf：0、1、−2
  bfOn(t, true); glow(t.root, REDG);
  say('bf：0、1、−2', '10 失衡');
  await step(tok);                                   // 1454.0 插在右的左 → RL
  c = avlCase(t.root); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); mark(t, c.C, 'C', 'ptr');
  say('插在「右的左」', 'RL imbalance');
  talk(g, '右 → 左', 'wow');
  await step(tok);                                   // 1460.7 要兩步：double rotation
  say('這個也要兩步', 'double rotation');
  await step(tok);                                   // 1468.0 先繞 30：20 上來
  glow(t.root, OFF); clearMarks(t);
  rotAll(t, c, 1);
  say('先繞著 30 轉', '20 升上來、30 往右下');
  await step(tok);                                   // 1483.0 再繞 10：平衡
  rotAll(t, c, 2);
  for (const n of inorder(t.root)) glow(n, OKG);
  say('再繞著 10 轉', '20 當 root：平衡');
  await step(tok);                                   // 1491.1 叫 RL rotation
  tag('RL rotation（雙旋）', 'pkt', 0, 7.6);
  say('RL imbalance → RL rotation', '');
  talk(g, '四種到齊', 'happy');
  await step(tok);                                   // 1506.0 LL、RR 單旋；LR、RL 雙旋
  note('LL、RR：單旋　LR、RL：雙旋', 0, 0.4, 1.6);
  say('四種旋轉：LL、RR 是單旋', 'LR、RL 是雙旋');
  await step(tok);                                   // 1523.1 接著看大樹裡的特殊情況
  say('接下來看：樹很大的時候', '這些旋轉怎麼做');
}]);

FRAG.push(['bstc-bari-ll-general', 'LL 一般形：B 的右子樹接到 A 的左邊', async (tok) => {
  fresh(...CAM);
  const g = palB();
  const R = rig();
  R.node('A', 'A', 0.6, 6.2, BLUE); R.node('B', 'B', -0.9, 4.9, TEAL); R.node('C', 'C', -2.2, 3.6, PURP);
  R.wire([['A', 'B'], ['B', 'C']]);
  await step(tok);                                   // 1537.9 A、B、C，A 有右 child
  R.sub('AR', 'A_R', 2.2, 4.9, 3);
  R.wire([['A', 'B'], ['A', 'AR'], ['B', 'C']]);
  say('一棵 BST 裡有 A、B、C', 'A 還有右 child（A_R）');
  talk(g, '大一點的樹');
  await step(tok);                                   // 1544.0 B 有右 child，C 有左右 child
  R.sub('BR', 'B_R', 0.2, 3.6, 3); R.sub('CL', 'C_L', -3.0, 2.3, 3); R.sub('CR', 'C_R', -1.4, 2.3, 3);
  R.wire([['A', 'B'], ['A', 'AR'], ['B', 'C'], ['B', 'BR'], ['C', 'CL'], ['C', 'CR']]);
  say('B 也有右 child，C 有左、右 child', '');
  await step(tok);                                   // 1548.0 很大的樹，底下不知道多少 node
  say('其實是一棵很大的樹', '灰塊 = 底下不知道多少個 node 的 subtree');
  await step(tok);                                   // 1561.4 A 失衡：插在左的左
  KG(R.m.A, BAD);
  say('A 因為「左的左」的 insert 而失衡', '');
  await step(tok);                                   // 1573.0 對它做 LL rotation
  say('要對 A 做 LL rotation', '');
  await step(tok);                                   // 1594.0 只看 A、B、C：B 上、C 左、A 右
  R.place({ B: [0.6, 6.2], C: [-0.9, 4.9], A: [2.2, 4.9], CL: [-1.7, 3.6], CR: [-0.1, 3.6], AR: [3.0, 3.6], BR: [0.9, 2.3] });   // B_R steps down, out of C_R's new place
  R.wire([['B', 'C'], ['B', 'A'], ['B', 'BR'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  KG(R.m.A, null);
  say('別的先不看，只看 A、B、C', 'B 升上來，C 在左、A 在右');
  await step(tok);                                   // 1608.0 旋轉永遠只動三個 node
  say('旋轉永遠只在三個 node 之間做', '');
  await step(tok);                                   // 1614.0 C_L、C_R 不變
  KG(R.m.CL, OKG); KG(R.m.CR, OKG);
  say('其他的呢？C_L、C_R 照舊跟著 C', '');
  await step(tok);                                   // 1620.4 A_R 也在原位
  KG(R.m.CL, null); KG(R.m.CR, null); KG(R.m.AR, OKG);
  say('A_R 也待在 A 的右邊', '');
  await step(tok);                                   // 1626.0 少了誰？B 的右子樹
  KG(R.m.AR, null); KG(R.m.BR, HOT);
  say('少了誰？B 的右子樹 B_R', 'B 的右邊已經被 A 佔了');
  talk(g, 'B_R 去哪？', 'wow');
  await step(tok);                                   // 1631.0 剩下的空位：A 的左邊
  R.go('BR', 1.4, 3.6);
  R.wire([['B', 'C'], ['B', 'A'], ['A', 'BR'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  say('剩下的空位只有 A 的左邊', 'B_R 接到 A 的左邊（B < B_R < A）');
  await step(tok);                                   // 1644.3 當公式記
  KG(R.m.BR, null);
  say('可以當公式記', '大樹裡只看這三個 node，其中一個失衡');
  await step(tok);                                   // 1658.6 RR 也類似
  say('RR rotation 也一樣', '只是從另一邊');
  await step(tok);                                   // 1669.0 釘子和線
  const nail = tag('📌', '', 0.6, 6.9);
  say('想像釘子和線：線上掛著東西', '一拉線，掛著的東西就換邊');
  talk(g, '📌 拉一下', 'happy');
  await step(tok);                                   // 1694.0 B 的右 child 掛到 A 的左邊
  remove(nail); KG(R.m.BR, HOT);
  say('A、B、C 也是：B 原本掛著右 child', '拉過去以後，它變成 A 的左邊');
  await step(tok);                                   // 1731.0 這就是 LL；RR 相同
  KG(R.m.BR, null);
  say('這就是 LL', 'RR 做法一樣，左右對調');
}]);

FRAG.push(['bstc-bari-lr-general', 'LR 一步到位：C 升為根，C_L、C_R 分給兩邊', async (tok) => {
  fresh(...CAM);
  const g = palB();
  const S = rig();
  S.node('A', 'A', -3.4, 6.2, BLUE); S.node('B', 'B', -4.6, 4.9, TEAL); S.node('C', 'C', -3.9, 3.6, PURP);
  S.wire([['A', 'B'], ['B', 'C']]);
  await step(tok);                                   // 1748.0 三個 node：A 因 LR 失衡
  KG(S.m.A, BAD);
  say('先看只有三個 node', 'A 因為「左的右」的 insert 而失衡');
  talk(g, 'LR 一步到位？');
  await step(tok);                                   // 1758.0 之前用兩步
  say('之前示範過：LR 要兩步', '');
  await step(tok);                                   // 1767.0 第一步
  S.place({ C: [-4.6, 4.9], B: [-5.3, 3.6] }); S.wire([['A', 'C'], ['C', 'B']]);
  say('第一步：C 升上來、B 往下', '');
  await step(tok);                                   // 1776.4 第二步
  KG(S.m.A, null);
  S.place({ C: [-3.9, 6.2], B: [-5.1, 4.9], A: [-2.7, 4.9] }); S.wire([['C', 'B'], ['C', 'A']]);
  say('第二步：C 到最上面', 'B 在左、A 在右');
  await step(tok);                                   // 1788.2 一步能做到嗎？
  say('能不能一步就畫出來？', '');
  await step(tok);                                   // 1798.0 最下面的拉上來當 root
  KG(S.m.C, OKG);
  say('LR：三個 node 中最下面那個（C）直接拉上來當 root', 'B 在左、A 去右邊');
  talk(g, '一步！', 'happy');
  await step(tok);                                   // 1812.0 只動三個；root 去右邊
  KG(S.m.C, null);
  say('旋轉只在三個 node 裡', '最下面的變 root，原本的 root 去右邊');
  await step(tok);                                   // 1822.0 RL：root 去左邊
  say('RL 則是原本的 root 去左邊', 'LR、RL 是同一招');
  await step(tok);                                   // 1844.0 大樹：A、B、C 帶著子樹
  const R = rig();
  R.node('A', 'A', 3.4, 6.2, BLUE); R.node('B', 'B', 1.2, 4.9, TEAL); R.node('C', 'C', 2.4, 3.6, PURP);
  R.sub('AR', 'A_R', 4.6, 4.9, 3); R.sub('BL', 'B_L', 0.2, 3.6, 3); R.sub('CL', 'C_L', 1.6, 2.3, 3); R.sub('CR', 'C_R', 3.2, 2.3, 3);
  R.wire([['A', 'B'], ['A', 'AR'], ['B', 'BL'], ['B', 'C'], ['C', 'CL'], ['C', 'CR']]);
  say('大一點的樹：A、B、C 各自帶著子樹', '');
  await step(tok);                                   // 1857.0 LR 失衡
  KG(R.m.A, BAD);
  say('A 有右子樹、B 有左子樹、C 有左右子樹', 'A 是 LR 失衡 → 做 LR rotation');
  await step(tok);                                   // 1872.0 C 上去、B 不動、A 去右邊
  R.place({ C: [2.8, 6.2], B: [1.2, 4.9], A: [4.4, 4.9], BL: [0.2, 3.6], AR: [5.4, 3.6] });
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['A', 'AR'], ['C', 'CL'], ['C', 'CR']]);
  KG(R.m.A, null);
  say('一樣只看三個 node：C 升上去', 'B 留在左、A 去右邊');
  await step(tok);                                   // 1884.3 B_L、A_R 不動
  KG(R.m.BL, OKG); KG(R.m.AR, OKG);
  say('B 的左子樹、A 的右子樹：原地不動', '');
  await step(tok);                                   // 1897.7 C_L → B 的右邊
  KG(R.m.BL, null); KG(R.m.AR, null);
  KG(R.m.CL, HOT); R.go('CL', 2.0, 3.6);
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['B', 'CL'], ['A', 'AR'], ['C', 'CR']]);
  say('C 的左子樹還在左邊', '但變成 B 的右 child');
  await step(tok);                                   // 1908.0 C_R → A 的左邊
  KG(R.m.CL, null); KG(R.m.CR, HOT); R.go('CR', 3.6, 3.6);
  R.wire([['C', 'B'], ['C', 'A'], ['B', 'BL'], ['B', 'CL'], ['A', 'CR'], ['A', 'AR']]);
  say('C 的右子樹還在右邊', '變成 A 的左 child');
  await step(tok);                                   // 1919.8 公式：一步完成
  KG(R.m.CR, null);
  note('LR：C 上、B 左、A 右；C_L → B 右、C_R → A 左', 0, 0.4, 1.6);
  say('當公式記：LR、RL 都能一步做完', '其餘的 children 照這個規則排');
  talk(g, '記公式', 'happy');
}]);

// 建 AVL：40, 20, 10, 25, 30, 22, 50
const BUILD = [40, 20, 10, 25, 30, 22, 50];
function buildView(pre) {
  const t = avlView([], { tag: 'bf' });
  pre.forEach((k) => avlInsertRaw(t, k));
  layout(t, true); refresh(t);
  tag('keys：' + BUILD.join(', '), 'pkt', -3.6, 7.8);
  return t;
}
FRAG.push(['bstc-bari-b1', '建 AVL：40, 20, 10（LL），再插 25', async (tok) => {
  const t = buildView([]);
  const g = palB();
  let c;
  await step(tok);                                   // 1949.5 一個一個插、算 bf、失衡就轉
  say('用這些 key 建一棵 AVL tree', '一個一個 insert、算 bf，失衡就做對應的旋轉');
  talk(g, '開始建樹');
  await step(tok);                                   // 1968.0 第一個 40
  avlPut(t, 40, true);
  say('第一個 40：只有一個 node，平衡', '');
  await step(tok);                                   // 1974.4 20：左邊；bf 0、1
  avlPut(t, 20, true);
  say('insert 20：左邊', 'bf 是 0、1：都平衡');
  await step(tok);                                   // 1981.0 10
  avlPut(t, 10);
  say('下一個 10：放到 20 的左邊', '');
  await step(tok);                                   // 1989.4 bf：0、1、2
  bfOn(t, true);
  say('算 bf：0、1、2', '40 的左子樹高 2、右邊沒有 → 2 − 0 = 2');
  await step(tok);                                   // 1999.0 失衡：左的左 → LL
  glow(t.root, REDG); c = avlCase(t.root);
  say('40 失衡；插在左的左', '→ LL rotation');
  talk(g, 'LL！', 'wow');
  await step(tok);                                   // 2010.7 LL：20 上、10 左、40 右
  glow(t.root, OFF); rotAll(t, c);
  say('對 40 做 LL rotation', '20 在上、10 在左、40 在右；bf 全 0');
  await step(tok);                                   // 2028.8 insert 25
  avlPut(t, 25);
  say('insert 25：> 20、< 40', '→ 40 的左邊');
  await step(tok);                                   // 2034.1 bf：0、1、−1 → 平衡
  bfOn(t, true);
  for (const n of inorder(t.root)) glow(n, OKG);
  say('更新 bf：25 是 0、40 是 1、20 是 1 − 2 = −1', '全部平衡');
  talk(g, '完美', 'happy');
}]);

FRAG.push(['bstc-bari-b2', '插入 30：多個節點失衡時轉最近的祖先（LR）', async (tok) => {
  const t = buildView([40, 20, 10, 25]);
  const g = palB();
  let z, A, c;
  await step(tok);                                   // 2046.5 insert 30
  z = avlPut(t, 30);
  say('insert 30：> 20、< 40、> 25', '→ 25 的右邊');
  await step(tok);                                   // 2056.0 bf：0、−1、2、−2
  bfOn(t, true);
  say('更新 bf：30 是 0、25 是 −1', '40 是 2、20 是 −2');
  await step(tok);                                   // 2070.4 兩個 node 失衡
  badOf(t).forEach((n) => glow(n, REDG));
  say('兩個 node 都失衡了：40 和 20', '');
  talk(g, '兩個？', 'wow');
  await step(tok);                                   // 2075.1 轉哪個？從新 node 往上第一個
  A = firstBad(z);
  say('多個 node 失衡時轉哪一個？', '從剛插的 node 往祖先走，第一個失衡的');
  await step(tok);                                   // 2090.0 轉它，上面的自動平衡
  badOf(t).forEach((n) => glow(n, n === A ? REDG : OFF));
  c = avlCase(A); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); mark(t, c.C, 'C', 'ptr');
  say('第一個是 40：只轉它', '上面的 20 會自動跟著平衡');
  await step(tok);                                   // 2100.0 左、右 → LR
  say('從 40 往下：先左（25）再右（30）', '→ LR rotation');
  await step(tok);                                   // 2107.0 30 直接上來、40 去右邊
  glow(A, OFF); clearMarks(t); rotAll(t, c);
  say('LR 不用兩步：30 直接拉上來', '25 在左、40 在右');
  await step(tok);                                   // 2130.5 更新 bf：全部平衡
  for (const n of inorder(t.root)) glow(n, OKG);
  say('更新 bf：每個都在 −1..1', '20 也自動平衡了');
  talk(g, '全平衡', 'happy');
}]);

FRAG.push(['bstc-bari-b3', '插入 22：只看失衡點往下兩步（RL）', async (tok) => {
  const t = buildView([40, 20, 10, 25, 30]);
  const g = palB();
  let z, A, c;
  await step(tok);                                   // 2146.6 insert 22
  z = avlPut(t, 22);
  say('insert 22：> 20、< 30、< 25', '→ 25 的左邊');
  await step(tok);                                   // 2158.0 更新 bf
  bfOn(t, true);
  say('更新 bf', '25 是 1、30 是 1……');
  await step(tok);                                   // 2180.4 root 20 失衡（−2）
  A = firstBad(z); glow(A, REDG);
  say('root 20：左邊 1、右邊 3 → −2', '只有它失衡');
  talk(g, '20 失衡', 'wow');
  await step(tok);                                   // 2194.0 從 20 往下：右、左、左
  say('從 20 往下走到 22：右、左、左', '要看幾步？');
  await step(tok);                                   // 2211.1 只看失衡點往下兩步
  c = avlCase(A); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); mark(t, c.C, 'C', 'ptr');
  say('不管插在哪，只看失衡點往下「兩步」', '也就是三個 node：20、30、25');
  await step(tok);                                   // 2228.7 插 26 也一樣是右左
  say('就算插的是 26（右、左、右）', '前兩步一樣是右、左');
  await step(tok);                                   // 2248.5 兩步：RL rotation
  say('前兩步是右、左', '→ RL rotation');
  await step(tok);                                   // 2260.1 25 上去、20 去左邊
  glow(A, OFF); clearMarks(t); rotAll(t, c);
  say('25 升上去當 root', '20 去左邊、30 在右邊');
  await step(tok);                                   // 2265.0 10 還是 20 的左；30、40 照舊
  glow(nodeOf(t, 10), OKG); glow(nodeOf(t, 40), OKG);
  say('10 還是 20 的左 child', '右邊 30 帶著 40 照舊');
  await step(tok);                                   // 2272.3 22 跟著到 20 的右邊
  glow(nodeOf(t, 10), OFF); glow(nodeOf(t, 40), OFF); glow(nodeOf(t, 22), HOT);
  say('22 原本是 25 的左子樹', '現在接到 20 的右邊（還在 25 的左邊）');
  await step(tok);                                   // 2282.2 RL 完成
  glow(nodeOf(t, 22), OFF);
  for (const n of inorder(t.root)) glow(n, OKG);
  say('RL rotation 完成', '');
  talk(g, '搞定', 'happy');
}]);

FRAG.push(['bstc-bari-b4', '插入 50：RR，失衡就要馬上轉', async (tok) => {
  const t = buildView([40, 20, 10, 25, 30, 22]);
  const g = palB();
  let z, A, c;
  await step(tok);                                   // 2293.0 insert 50
  z = avlPut(t, 50);
  say('最後一個 50：40 的右邊', '');
  await step(tok);                                   // 2298.0 bf：30 是 −2
  bfOn(t, true); A = firstBad(z); glow(A, REDG);
  say('檢查 bf：40 是 −1、30 是 −2', '30 失衡');
  await step(tok);                                   // 2311.0 右的右 → RR
  c = avlCase(A); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr');
  say('對 30 轉；右的右', '→ RR rotation');
  talk(g, 'RR！');
  await step(tok);                                   // 2316.0 25、20、10、22 不動；40 帶 30、50
  glow(A, OFF); clearMarks(t); rotAll(t, c);
  say('25、20、10、22 都不動', '40 升上來，左 30、右 50');
  await step(tok);                                   // 2324.0 完美平衡的 AVL
  for (const n of inorder(t.root)) glow(n, OKG);
  say('得到一棵完美平衡的 BST', '這就是 AVL tree（height balanced）');
  talk(g, '完成！', 'happy');
  await step(tok);                                   // 2338.9 不能讓 bf 超過 ±2
  note('bf 最多到 ±2，不可以出現 ±3', 0, 0.4, 1.6);
  say('要記住：不要讓任何 node 的 bf 超過 ±2', '永遠不該看到 −3 或 3');
  await step(tok);                                   // 2350.0 不能全插完再轉
  say('不能「先全部插完，最後再一起轉」', '那樣行不通');
  talk(g, '不能等', 'calm');
  await step(tok);                                   // 2362.0 一插完失衡就馬上轉
  say('每次 insert 之後，有 node 失衡', '就馬上旋轉、把樹平衡回來');
}]);

FRAG.push(['bstc-bari-42', '大樹插入 42：RL 旋轉，45 升上來', async (tok) => {
  const t = avlView([], { tag: 'bf' });
  const g = palB();
  let z, A, c;
  await step(tok);                                   // 2380.0 一棵比較大的樹
  grow(t, [40, 20, 50, 10, 30, 45, 60, 41, 47, 70]); t.o.tag = 'none'; refresh(t);
  await beat(tok, 700);
  say('最後一個例子：一棵比較大的樹', '它平衡嗎？');
  await step(tok);                                   // 2383.0 leaf 的 bf 都是 0
  bfOn(t, true);
  inorder(t.root).forEach((n) => { if (n.left || n.right) setTag(n, ''); });
  say('leaf 的 bf 都是 0', '');
  await step(tok);                                   // 2387.0 其他 node 也都平衡
  refresh(t);
  for (const n of inorder(t.root)) glow(n, OKG);
  say('其他 node：0、−1、0、0、−1……', '全部平衡：這是一棵 AVL');
  await step(tok);                                   // 2408.0 insert 42
  for (const n of inorder(t.root)) glow(n, OFF);
  z = avlPut(t, 42);
  say('insert 42：> 40、< 50、< 45、> 41', '→ 41 的右邊');
  talk(g, '42 來了');
  await step(tok);                                   // 2422.0 更新 bf
  bfOn(t, true);
  say('更新 bf：41 是 −1、45 是 1、50 是 1……', '');
  await step(tok);                                   // 2440.0 root 40：2 − 4 = −2
  A = firstBad(z); glow(A, REDG);
  say('root 40：左邊 2、右邊 4', '−2 → 失衡');
  talk(g, 'root 失衡', 'wow');
  await step(tok);                                   // 2451.1 右、左、左、右 → 只看前兩步：RL
  c = avlCase(A); mark(t, c.A, 'A'); mark(t, c.B, 'B', 'ptr'); mark(t, c.C, 'C', 'ptr');
  say('從 40 走到 42：右、左、左、右', '只看前兩步：右、左 → RL');
  await step(tok);                                   // 2476.4 45 上來、40 去左
  glow(A, OFF); clearMarks(t); rotAll(t, c);
  say('45 升上來當 root，40 去左邊、50 在右邊', '其他 node 照公式調整');
  await step(tok);                                   // 2487.0 AVL 一直保持平衡
  for (const n of inorder(t.root)) glow(n, OKG);
  say('AVL tree 永遠是 height balanced 的 BST', '');
  talk(g, '平衡！', 'happy');
  await step(tok);                                   // 2505.0 高度最多 1.44 log n
  note('高度 ≤ 1.44 log n', 0, 0.4, 1.6);
  say('高度不會像 BST 一樣長到 n', '最多大約 1.44 × log n');
  await step(tok);                                   // 2521.0 搜尋 O(log n)
  say('不一定剛好 log n，可能多一點', '但都是 log n 的倍數 → 搜尋 O(log n)');
}]);
  }

  // ═══ bstlin.js ═══
  {
// ─── Lzr5-m7ap-8：台大林軒田 DSA Skip List / BST / AVL Tree — cued: each step(tok) waits for the sentence it shows ───
// 例子取自影片：extendible hash 的 cat / good / cool；linked list 2 4 5 9 10 11 15 20（找 10、找 15）；
// 第二個 skip list 2 3 5 8 9 10 13（找 9、找 6、插 6、丟銅板）；skip list → BST（8 / 3,13 / 2,5,10）；
// complete BST 1 2 3 插 4；AVL 插 3 5 8；RR 通例（A、B、AL、BL、BR，高度 10 / 11）；AVL 依序插 1…7。
// 高度以層數計（空樹 0、一個 node 1），bf = hL − hR；RR = 插在失衡點 A 的右邊的右邊。
// 一個小乘客（buddy）在 skip list 上「坐車」找東西；key 用小角色走進樹裡。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, code, anim, line, arrow, ghostBox, step, buddy, travel, prop, bob, GOLD, GREEN, RED, GRAY } = K;
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const okT = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const RIDER = '#f4a56a';
// the key a rider carries floats over its head: on its belly it would print over the node it stands on
const rider = (v, p, size = 0.5) => { const b = buddy(null, v, RIDER, p.x, p.y, p.z || 0, size); b.val.position.set(0, size + 0.25, 0); return b; };
const hopTo = (tok, b, p, ms = 420) => travel(tok, b.g, b.g.position.clone(), p, ms);
async function hops(tok, b, ps, ms = 380) { for (const p of ps) await hopTo(tok, b, p, ms); }
// several objects slide together (one animation, so the step's motion stays short)
async function moveAll(tok, list, ms = 900) {
  const from = list.map(([o]) => o.position.clone());
  await anim(tok, ms, (u) => list.forEach(([o, to], i) => o.position.lerpVectors(from[i], to, u)));
}

// ── skip list 共用：slots 決定 x 位置（可以留空位給之後插入的 key） ──
function SL(slots0, levels, names, o = {}) {
  const slots = [...slots0];
  const dx = o.dx || 1.35, y0 = 0.4, dy = o.dy || 1.35;
  const X = (k) => (slots.indexOf(k) - (slots.length - 1) / 2) * dx;
  const HX = X(slots[0]) - dx * 1.15;
  const Y = (l) => y0 + l * dy;
  const lv = [], heads = [];
  let arrs = [];
  const s = {
    X, Y, HX, lv, slots,
    get: (l, k) => lv[l] && lv[l].get(k),
    // where a rider stands on top of node (l, k); 'H' = the head of level l
    at: (l, k) => V3(k === 'H' ? HX : X(k), Y(l) + (k === 'H' ? 0.2 : l ? 0.25 : 0.33), 0),
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
    arrows: () => arrs,
    // re-order the bottom row (e.g. unordered → ordered): every cube slides to its new slot
    reorder(ns) { slots.splice(0, slots.length, ...ns); lv.forEach((mp, l) => mp.forEach((m, k) => move(m, X(k), Y(l), 0))); },
  };
  levels.forEach((ks, l) => ks.forEach((k) => s.add(l, k, o.drop)));
  if (!o.noLinks) s.links();
  return s;
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
function findN(t, k) { let x = t.root; while (x && x.k !== k) x = k < x.k ? x.l : x.r; return x; }
function pathTo(t, k) { const ks = []; let x = t.root; while (x) { ks.push(x.k); if (k === x.k) break; x = k < x.k ? x.l : x.r; } return ks; }
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
      walk(n.l); walk(n.r);
    })(t.root);
    labs.forEach((l, k) => { const p = v.P.get(k); if (p) l.position.set(p.x + 0.8, p.y + 0.5, 0); });
  };
  // show / refresh the balance factor of some nodes (red when |bf| > 1)
  v.bf = (keys) => {
    for (const k of keys) {
      const n = findN(t, k); if (!n) continue;
      const b = hgt(n.l) - hgt(n.r);
      let l = labs.get(k); if (!l) { l = tag('', 'idx', 0, 0, 0); labs.set(k, l); }
      txt(l, 'bf ' + (b > 0 ? '+' + b : b));
      const p = v.P.get(k); l.position.set(p.x + 0.8, p.y + 0.5, 0);
      l.element.className = 'lab-label ' + (Math.abs(b) > 1 ? 'ptr' : 'idx');
      glow(cubes.get(k), Math.abs(b) > 1 ? RED : null);
    }
  };
  v.hide = () => labs.forEach((l, k) => { txt(l, ""); glow(cubes.get(k), null); });
  v.all = () => [...v.P.keys()];
  v.c = (k) => cubes.get(k);
  v.top = (k) => { const p = v.P.get(k); return V3(p.x, p.y + 0.43, 0); };
  return v;
}

// ═════════ 0. 回顧 extendible hash：滿出來才分家 ═════════
FRAG.push(['bstlin-lazy-split', 'Extendible hash：滿出來才分家', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.4, 0]);
  const BX = (i) => (i - 3.5) * 1.55, BY = (j) => 0.05 + j * 0.62;
  const slot = (i) => { ctx.tile(V3(BX(i), 0.02, 0), 1.35, 1.35); tag('[' + i + ']', 'idx', BX(i), 0.1, 1.25); };
  for (let i = 0; i < 4; i++) slot(i);
  const W = (w, i, j) => buddy(null, w, w === 'good' ? '#7cb8ee' : w === 'cat' ? '#f4a56a' : '#9fd6a8', BX(i), BY(j), 0, 0.55);
  say('上次的 extendible hash，再講一次', '');
  await step(tok);                                   // 17:12 原來的 hash table：每格一串 linked list
  const cat = W('cat', 2, 0), good = W('good', 2, 1);
  const rule = bub('hash：首字母的順序 mod 4', -3.4, 3.0);
  say('每一格掛一串 linked list（chaining）', 'cat：c = 2 → [2]；good：g = 6 → 6 mod 4 = 2');
  await step(tok);                                   // 17:50 mod 4 → mod 8
  for (let i = 4; i < 8; i++) slot(i);
  txt(rule, 'hash：首字母的順序 mod 8');
  say('表格變大：mod 4 改成 mod 8', 'hash function 跟著 extend');
  await step(tok);                                   // 18:15 cat 放 [2]、good 放 [6]
  const gh = pkt('good 照理該去 [6]', BX(2), 1.9);
  await travel(tok, gh, V3(BX(2), 1.9, 0), V3(BX(6), 1.9, 0), 1100);
  say('照 mod 8 重算：cat 留 [2]，good 該去 [6]', '如果每個 key 都這樣重算……');
  await step(tok);                                   // 18:39 重複的力氣
  kill(gh);
  const bad1 = noT('每個都重算 = 花重複的力氣', 0, 3.0); cat.mood('sad'); good.mood('sad');
  say('naive：全部重新 hash', '<span class="no">做很多重複的工</span>');
  await step(tok);                                   // 18:47 lazy：只重做滿出來的地方
  kill(bad1); cat.mood('calm'); good.mood('calm');
  const lazy = okT('lazy：只有滿出來的格子才重分', 0, 3.0);
  say('偷懶的做法', '只在滿出來的地方重做');
  await step(tok);                                   // 19:40 [6] 留小紙條指向 [2]
  const nt = note('要找 [6]？去 [2] 找', BX(6), 2.2);
  const ar = arrow(V3(BX(6) - 0.3, 1.9, 0), V3(BX(2) + 0.75, 1.3, 0), 0xa8730f);
  say('[6] 只留一張小紙條：去 [2] 找', 'cat、good 還沒分家，共用同一串');
  await step(tok);                                   // 19:55 找的時候頂多看 2 個
  const pk = pkt('找 good', BX(6), 3.0);
  await travel(tok, pk, V3(BX(6), 3.0, 0), V3(BX(2), 1.9, 0), 900);
  good.mood('happy');
  say('找東西照樣去 [2]', '這串還很短（最多 2 個），不會花太多時間');
  await step(tok);                                   // 20:08 再塞一個 c 開頭的：cool
  kill(pk); good.mood('calm');
  const cool = W('cool', 2, 2); cool.mood('wow');
  cool.glow(RED);
  say('insert cool（c 開頭）：[2] 變 3 個', '<span class="no">超過上限 → 這時才真的分家</span>');
  await step(tok);                                   // 20:24 拜訪每個人：good 搬去 [6]
  cool.glow(null); kill(ar); kill(nt); kill(lazy);
  await moveAll(tok, [[good.g, V3(BX(6), BY(0), 0)], [cool.g, V3(BX(2), BY(1), 0)]], 1100);
  good.mood('happy'); cool.mood('happy');
  say('分家：good 搬去 [6]，cat、cool 留在 [2]', '要用到的時候才做（lazy）');
  await step(tok);                                   // 20:43 新的一格也放不下，才 extend 整張表
  bub('連新的一格都塞不下 → 才再 extend 表格大小', 0, 3.0);
  say('還是塞不下？', '那才把整個 hash table 再變大');
}]);

// ═════════ 1. Linked list 做 map：只能慢慢找 ═════════
FRAG.push(['bstlin-list-map', 'Linked list 做 map：search 只能一站一站停', async (tok) => {
  fresh([0, 4.5, 12.5], [0, 1.4, 0]);
  const UN = [9, 2, 15, 10, 4, 20, 5, 11];
  say('array 做 map 已經會了（hash）', '那 linked list 呢？');
  await step(tok);                                   // 24:29 直接拿 linked list 來做 map
  const s = SL(UN, [UN], ['head'], { noLinks: true, drop: true });
  bub('linked list 也能當 map 嗎？', 0, 2.6);
  say('直接拿 linked list 來做 map', '每個 node 放一個 key（和它的 value）');
  await step(tok);                                   // 25:04 key 不能比大小 → 串成一串
  s.links();
  say('key 沒辦法比大小：只好串成一串', '這叫 unordered list');
  await step(tok);                                   // 25:18 整條走過去，每個 key 比一下
  const r = rider('10', s.at(0, 'H'));
  for (const k of [9, 2, 15, 10]) { await hopTo(tok, r, s.at(0, k), 380); glow(s.get(0, k), k === 10 ? GREEN : GOLD); }
  r.mood('happy');
  say('search 10：從 head 一個一個比', '比到第 4 個才找到');
  await step(tok);                                   // 25:31 slow search
  for (const k of UN) glow(s.get(0, k), null);
  r.mood('sad');
  const slow = noT('slow search：最差要比 n 次', 0, 2.0);
  say('unordered list：slow search', '沒有 random access，也沒有 hash 幫忙標位置');
  await step(tok);                                   // 25:54 唯一快的：insertion
  kill(slow);
  const nw = cube(7, colorFor(7), [0.8, 0.6, 0.8], s.HX + 0.2, 1.7, 0, 2);
  const na = arrow(V3(s.HX + 0.2, 1.3, 0), V3(s.X(9) - 0.5, 0.75, 0), 0x0f5a3a);
  okT('insert：直接插在最前面，很快', -1, 2.6);
  say('unordered 唯一快的事：insertion', '新 key 插在最前面就好');
  await step(tok);                                   // 26:23 排好序（ordered）呢？
  kill(nw); kill(na);
  r.g.position.copy(s.at(0, 'H')); r.mood('calm');
  s.reorder(LIN8); s.links();
  say('那排好序（ordered）呢？', '2 4 5 9 10 11 15 20');
  await step(tok);                                   // 26:32 還是不能 binary search
  const q = pkt('中點在哪？', (s.X(9) + s.X(10)) / 2, 1.9);
  noT('不能直接跳到中間 → 不能 binary search', 0, 2.8);
  r.mood('sad');
  say('linked list 不能跳著看', '還是 <span class="no">slow search</span>');
  await step(tok);                                   // 26:41 排隊盤查：一個一個查
  kill(q); r.mood('calm');
  for (const k of [2, 4, 5, 9, 10]) { await hopTo(tok, r, s.at(0, k), 340); glow(s.get(0, k), k === 10 ? GREEN : GOLD); }
  say('像排隊盤查：一個一個查', 'search 10 要比 5 次');
  await step(tok);                                   // 27:11 還會 slow insertion
  for (const k of LIN8) glow(s.get(0, k), null);
  const n12 = rider('12', V3(s.HX, 2.2, 0), 0.5); n12.mood('wow');
  r.g.position.copy(s.at(0, 'H'));
  await hops(tok, r, [2, 4, 5, 9, 10, 11].map((k) => s.at(0, k)), 260);
  await hopTo(tok, n12, V3((s.X(11) + s.X(15)) / 2, 1.5, 0), 700);
  say('ordered list 要 insert 12', '<span class="no">先一個一個找位置 → slow insertion</span>');
  await step(tok);                                   // 27:32 不管 ordered 還是 unordered，都有慢的地方
  bub('ordered / unordered：linked list 都有慢的地方', 0, 3.1);
  say('search 一定慢；insertion 快不快看情況', '接下來要解決這些「慢」');
}]);

// ═════════ 2. 在 list 上做 binary search：先存中點 ═════════
FRAG.push(['bstlin-mid-pointer', '多存「中點」：在 linked list 上做 binary search', async (tok) => {
  fresh([0, 4.8, 12.5], [0, 1.6, 0]);
  const s = SL(LIN8, [LIN8], ['head']);
  const r = rider('', s.at(0, 'H'));
  say('為什麼 slow search？', '');
  await step(tok);                                   // 27:53 只能 sequential：像慢車每站都停
  await hops(tok, r, [2, 4, 5].map((k) => s.at(0, k)), 500);
  bub('慢車：每一站都停', s.X(4), 2.2);
  say('只能 sequential search', '像坐慢車：台北到高雄每站都停');
  await step(tok);                                   // 28:46 快車：只停大站，再轉車
  bub('快車：只停大站，到了再轉車去小站', 1.5, 3.0);
  say('有沒有「快車」？', '高鐵、台鐵的快車只停大站');
  await step(tok);                                   // 29:33 binary search 的條件 ①：排好
  r.g.position.copy(s.at(0, 'H'));
  okT('① 東西排好了 ✓', -3.2, 2.4);
  say('能不能在 linked list 上做 binary search？', '條件一：資料要排好（ordered）');
  await step(tok);                                   // 30:06 條件 ②：很快找到中點
  const q = pkt('② 中點在哪？', (s.X(9) + s.X(10)) / 2, 2.0);
  say('條件二：要能很快找到中點', '');
  await step(tok);                                   // 30:39 有心無力
  r.mood('sad');
  const st = bub('我只能從 head 一站一站走……', s.HX + 1.6, 1.6);
  say('一般的 linked list：有心無力', '第一步「找中點」就做不快');
  await step(tok);                                   // 31:13 額外存中點：在 9
  kill(st); kill(q); r.mood('calm');
  const m1 = note('中點', s.X(9), 2.7); arrow(V3(s.X(9), 2.4, 0), V3(s.X(9), 0.9, 0), 0xa8730f);
  say('多花一點空間：存一張「中點」紙條', '8 筆資料，中點在 9');
  await step(tok);                                   // 31:48 search 10：從中點切進去
  r.set('10');
  await hopTo(tok, r, s.at(0, 9), 800);
  glow(s.get(0, 9), GOLD);
  say('search 10：直接從中點 9 切進去', '');
  await step(tok);                                   // 31:55 10 > 9：在 9 的後面
  r.look(1);
  bub('10 > 9 → 在 9 的後面', s.X(9) + 0.8, 1.7);
  say('先跟 9 比：10 比 9 大', '所以在 9 的後面');
  await step(tok);                                   // 32:21 消掉一半：2、4、5 不用找
  for (const k of [2, 4, 5]) tint(s.get(0, k), GRAY);
  say('一次消掉一半的可能', '2、4、5 都不用找了，跟 binary search 一樣');
  await step(tok);                                   // 32:45 9 後面再存「中點 2 號」11
  const m2 = note('中點 2 號', s.X(11), 2.7); arrow(V3(s.X(11), 2.4, 0), V3(s.X(11), 0.9, 0), 0xa8730f);
  say('9 後面沒有中點了 → 再存一個', '像四分位點：中點 2 號在 11');
  await step(tok);                                   // 33:16 跟中點 2 號比：10 < 11
  glow(s.get(0, 9), null);
  await hopTo(tok, r, s.at(0, 11), 600); r.look(-1);
  glow(s.get(0, 11), RED);
  say('跟中點 2 號 11 比', '10 < 11 → 在 11 的前面');
  await step(tok);                                   // 33:31 在 9 和 11 之間慢慢找
  for (const k of [11, 15, 20]) tint(s.get(0, k), GRAY);
  glow(s.get(0, 11), null);
  await hopTo(tok, r, s.at(0, 10), 600);
  glow(s.get(0, 10), GREEN); r.mood('happy');
  say('只剩 9 和 11 之間', '慢慢找 → 找到 10');
  await step(tok);                                   // 33:46 存一堆中點帶路 → 快車
  m1.element.className = 'lab-label pkt'; m2.element.className = 'lab-label pkt';
  bub('中點 1 號、中點 2 號……整理起來？', 0, 3.4);
  say('在一些地方存「中點」紙條', '讓它們帶路，就能快速比較');
}]);

// ═════════ 3. 快車：兩站一停 ═════════
FRAG.push(['bstlin-fast-lane', '快車 linked list：兩站一停', async (tok) => {
  fresh([0, 5, 12.5], [0, 1.4, 0]);
  const s = SL(LIN8, [LIN8], ['普通車', '快車']);
  say('把剛才的中點整理起來', '');
  await step(tok);                                   // 34:13 剛才用到中點 9、11
  for (const k of [9, 11]) s.add(1, k, true);
  say('剛才找 10 用到兩個中點：9、11', '把它們放到上面一層');
  await step(tok);                                   // 34:17 完整的話還需要 4
  s.add(1, 4, true);
  say('完整的話，4 也要有一個', '');
  await step(tok);                                   // 34:29 普通車之外，多一班兩站一停的快車
  s.add(1, 20, true); s.links();
  say('普通車之外，多一班快車', '兩站才停一次');
  await step(tok);                                   // 34:40 head → 4 → 9 → 11 → 20
  const tr = pkt('快車', s.HX, s.Y(1) + 0.6);
  for (const k of [4, 9, 11, 20]) await travel(tok, tr, tr.position.clone(), V3(s.X(k), s.Y(1) + 0.6, 0), 450);
  kill(tr);
  say('快車路線：head → 4 → 9 → 11 → 20', '');
  await step(tok);                                   // 34:53 = 原來的 list 砍一半
  tag('約 n/2 站', 'ptr alt', 6.2, s.Y(1), 0);
  say('快車就是另一條 linked list', '原來那條砍一半：小站不停');
  await step(tok);                                   // 35:26 找 10：先坐快車
  const r = rider('10', s.at(1, 'H'));
  say('search 10：先坐快車', '');
  await step(tok);                                   // 35:34 4 跟 10 比：還在後面
  await hopTo(tok, r, s.at(1, 4)); glow(s.get(1, 4), GOLD);
  say('4 跟 10 比：還在後面', '比較 1 次');
  await step(tok);                                   // 35:37 9 跟 10 比：還在後面
  glow(s.get(1, 4), null);
  await hopTo(tok, r, s.at(1, 9)); glow(s.get(1, 9), GOLD);
  say('9 跟 10 比：還在後面', '比較 2 次');
  await step(tok);                                   // 35:40 11 跟 10 比：過頭了
  await hopTo(tok, r, s.at(1, 11)); glow(s.get(1, 11), RED); r.mood('wow');
  say('11 跟 10 比：過頭了！', '比較 3 次');
  await step(tok);                                   // 35:43 在 9 轉慢車，找到 10
  glow(s.get(1, 11), null);
  await hops(tok, r, [s.at(1, 9), s.at(0, 9), s.at(0, 10)], 450);
  glow(s.get(1, 9), null); glow(s.get(0, 10), GREEN); r.mood('happy');
  say('回到 9 這站轉普通車', '下一站就是 10：找到了');
  await step(tok);                                   // 36:19 原來 10 排第 5：要比 5 次
  LIN8.slice(0, 5).forEach((k, i) => tag(String(i + 1), 'idx', s.X(k), -0.35, 0.6));
  say('原來 10 排第 5 個', '只坐普通車要比 5 次');
  await step(tok);                                   // 36:27 現在 4、9、11 再回頭：3～4 次
  okT('快車：比 4、9、11，再回頭 → 3～4 次', 0, 3.5);
  say('現在比 4、9、11 再回頭', '大約 3～4 次就找到');
  await step(tok);                                   // 36:44 快車 = 最低層的中點
  bub('快車上的站 = 最低一層的「中點」', 0, 4.3);
  say('binary search 是 top-down 想', '快車是 bottom-up：從普通車往上加');
}]);

// ═════════ 4. 特快車、超快車 = Skip List；找 15 ═════════
FRAG.push(['bstlin-skip-15', 'Skip list：特快車 → 快車 → 普通車，找 15', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20]], ['普通車', '快車', '特快車', '超快車']);
  say('同樣的想法可以再往上做', '');
  await step(tok);                                   // 37:01 特快車：在快車上再兩個一數
  for (const k of [9, 20]) s.add(2, k, true);
  s.links();
  say('特快車：在快車上再兩個一數', '9 → 20');
  await step(tok);                                   // 37:23 先坐特快車，接近了換快車、再換普通車
  bub('特快車 → 快車 → 普通車', 4.4, s.Y(2) + 1.0);
  say('要去某個地方：先坐特快車', '接近了換快車，再接近換普通車');
  await step(tok);                                   // 37:38 找 15：特快車到 9，還在後面
  const r = rider('15', s.at(2, 'H'));
  r.val.position.set(0.55, 0.55, 0); // beside its head: above it, the label would sit on the node of the row above
  await hopTo(tok, r, s.at(2, 9), 600); glow(s.get(2, 9), GOLD);
  say('search 15：特快車先到 9', '15 > 9，還在後面');
  await step(tok);                                   // 37:46 跟 20 比：過頭，往下一層
  glow(s.get(2, 20), RED); r.look(1); r.mood('wow');
  say('跟 20 比：過頭了', '在 9 這站往下換快車');
  await step(tok);                                   // 37:51 快車：9 → 11
  glow(s.get(2, 20), null); glow(s.get(2, 9), null); r.mood('calm');
  await hops(tok, r, [s.at(1, 9), s.at(1, 11)], 450); glow(s.get(1, 11), GOLD);
  say('快車：從 9 往前到 11', '11 < 15，可以');
  await step(tok);                                   // 37:56 20 又過頭
  glow(s.get(1, 20), RED); r.mood('wow');
  say('下一站 20 又太後面', '在 11 再往下');
  await step(tok);                                   // 38:01 從 11 走到 15
  glow(s.get(1, 20), null); glow(s.get(1, 11), null);
  await hops(tok, r, [s.at(0, 11), s.at(0, 15)], 450);
  glow(s.get(0, 15), GREEN); r.mood('happy');
  say('普通車：從 11 走到 15', '找到了');
  await step(tok);                                   // 38:06 有效比較：9、11、15（再加兩次 20）
  glow(s.get(2, 9), GOLD); glow(s.get(1, 11), GOLD);
  tag('（再加跟 20 比兩次）', 'idx', s.X(20), s.Y(2) + 0.7, 0);
  say('有效比較的 node 幾乎只有 9、11、15', '加上跟 20 比的兩次');
  await step(tok);                                   // 38:25 超快車：只有一個 node
  glow(s.get(2, 9), null); glow(s.get(1, 11), null); glow(s.get(0, 15), null);
  s.add(3, 9, true); s.links();
  say('再加一條超快車', '裡面只有一個 node：9');
  await step(tok);                                   // 38:44 它就是 binary search 的第一個中點
  const gL = ghostBox('#2fc092', s.X(9) - s.X(2) + 1.0, 0.9, 1.2); gL.position.set((s.X(2) + s.X(9)) / 2 - 0.3, s.Y(0), 0);
  const gR = ghostBox('#4b9ee2', s.X(20) - s.X(10) + 1.0, 0.9, 1.2); gR.position.set((s.X(10) + s.X(20)) / 2, s.Y(0), 0);
  glow(s.get(3, 9), GOLD);
  say('它就是 binary search 的第一個中點', '決定往整條 list 的左半邊還是右半邊找');
  await step(tok);                                   // 39:11 這就叫 Skip List
  kill(gL); kill(gR); glow(s.get(3, 9), null);
  okT('Skip List = ordered linked list + 一堆快車', 0, 6.3);
  say('普通車 + 一堆更快的 linked list', '這個資料結構叫 <span class="ok">Skip List</span>');
  await step(tok);                                   // 40:16 從上往下看：list of mid、list of quad
  tag('list of mid', 'ptr alt', 5.9, s.Y(3), 0); tag('list of quad', 'ptr alt', 5.9, s.Y(2), 0);
  say('從下往上看：車越來越快', '從上往下看：中點的 list、四分位點的 list……');
  await step(tok);                                   // 40:34 search 像 zooming
  const zs = [];
  for (const [a, b, l] of [[9, 20, 2], [11, 20, 1], [15, 15, 0]]) {
    const z = ghostBox('#f5c04a', s.X(b) - s.X(a) + 1.1, 0.8, 1.3); z.position.set((s.X(a) + s.X(b)) / 2, s.Y(l), 0); zs.push(z);
    await anim(tok, 500, () => {});
  }
  say('search 像一路 zoom in', '每比一次就縮小到某一段');
  await step(tok);                                   // 41:39 每層砍一半：約 log N 層
  zs.forEach(kill);
  bub('每層砍掉一半 → 約 log N 層', 0, 6.3);
  say('跟 binary search 一樣：每次砍一半', '約 log N 層，search 約 <span class="ok">O(log N)</span> 次比較');
}]);

// ═════════ 5. Skip list 吃多少記憶體 ═════════
FRAG.push(['bstlin-skip-space', 'Skip list 的空間：n + n/2 + n/4 + … ≈ 2n', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20], [9, 20], [9]], ['普通車', '快車', '特快車', '超快車']);
  const kid = buddy('同學', '?', '#9fd6a8', 5.6, -0.2, 1.2, 0.7);
  say('同學問：skip list 很吃記憶體嗎？', '');
  await step(tok);                                   // 44:10 好問題：比原本多吃多少？
  kid.mood('wow');
  bub('這樣很吃記憶體吧？', 5.6, 1.4, 1.2);
  say('好問題：比原來的 linked list 多吃多少？', '');
  const lab = ['n', 'n/2', 'n/4', 'n/8 …'];
  const shine = (l) => { s.lv.forEach((mp, i) => mp.forEach((m) => glow(m, i === l ? GOLD : null))); tag(lab[l], 'ptr alt', 5.9, s.Y(l), 0); };
  await step(tok);                                   // 44:28 原來的 list：n 個 → O(n)
  shine(0);
  say('底層原本就有 n 個 node', '本來就要 O(n) 的記憶體');
  await step(tok);                                   // 44:38 兩兩一數：一半
  shine(1);
  say('快車：兩兩一數', '大約 n/2 個');
  await step(tok);                                   // 44:53 四個一數：四分之一
  shine(2);
  say('特快車：四個一數', '大約 n/4 個');
  await step(tok);                                   // 45:00 八分之一……
  shine(3);
  say('再上去：n/8、n/16……', '');
  await step(tok);                                   // 45:09 1/2 + 1/4 + … 最多 1
  s.lv.forEach((mp) => mp.forEach((m) => glow(m, null)));
  for (let l = 1; l < 4; l++) s.lv[l].forEach((m) => glow(m, GOLD));
  bub('1/2 + 1/4 + 1/8 + … ≤ 1', 0, 6.0);
  say('上面各層加起來', '最多再一條 list 那麼多');
  await step(tok);                                   // 45:29 大概多花一倍
  okT('總共 ≈ n + n = 2n', 0, 6.7);
  say('所以大約多花一倍記憶體', 'n(1 + 1/2 + 1/4 + …) ≈ <span class="ok">2n</span>');
  await step(tok);                                   // 45:39 有時不行：作業 5 的 DEPQ
  for (let l = 1; l < 4; l++) s.lv[l].forEach((m) => glow(m, null));
  kid.mood('calm');
  bub('作業 5：DEPQ 要塞進同一棵 tree', -3.6, 6.2);
  noT('兩棵 tree = 兩倍記憶體 ✗', -3.6, 5.5);
  say('多花一倍有時不行', '例如作業的 double-ended priority queue');
  await step(tok);                                   // 46:28 skip list：多花一倍換快速 search
  okT('skip list：多一倍空間 → 換到快速 search', 2.6, 5.5);
  say('有時為了目的多用一倍也還好', 'skip list 就是用空間換 faster search');
  await step(tok);                                   // 46:56 還是 O(n)；每個箭頭也是小紙條
  for (const a of s.arrows().slice(0, 4)) note('紙條', a.position.x + 0.3, a.position.y + 0.35, 0.3);
  kid.mood('happy');
  say('每個箭頭也是一張小紙條，要另外算', '會再多一點點');
  await step(tok);                                   // 47:23 不是 n²，還是 n 乘上常數
  okT('還是 O(n)，不會變成 n²', 0, -0.6, 1.0);
  say('多的只是常數倍', '空間仍然是 <span class="ok">O(n)</span>');
}]);

// ═════════ 6. 怎麼存：獨立 list 或一個 node 多個 next；insert 的難題 ═════════
FRAG.push(['bstlin-skip-impl', 'Skip list 怎麼實作，insert 卡在哪', async (tok) => {
  fresh([0, 6, 13], [0, 2.2, 0]);
  const s = SL(LIN8, [LIN8, [4, 9, 11, 20], [9, 20], [9]], ['普通車', '快車', '特快車', '超快車']);
  say('同學問：要在 node 上加 pointer 嗎？', '');
  await step(tok);                                   // 47:41 很多做法
  bub('要在原本的 node 上加指標嗎？', 4.2, 5.6);
  say('實作方法有很多種', '');
  await step(tok);                                   // 48:03 做法一：真的維護好幾條 list
  const vs = [];
  for (let l = 1; l < 4; l++) s.lv[l].forEach((m, k) => vs.push(line(s.X(k), s.Y(l - 1) + 0.3, s.X(k), s.Y(l) - 0.25, 0.5, '#c08a1f')));
  say('做法一：真的維護好幾條 linked list', '再用小紙條（黃線）表示上下是同一個 key');
  await step(tok);                                   // 48:18 做法二：一個 node 存好幾個 next
  vs.forEach(kill);
  for (let l = 0; l < 4; l++) glow(s.get(l, 9), GOLD);
  const ts = ['普通車的下一站', '快車的下一站', '特快車的下一站', '超快車的下一站'].map((x, l) => tag(x, 'note', s.X(9) + 0.4, s.Y(l) + 0.62, 0.4));
  say('做法二：在原本的 node 上標註', '搭每一種車的「下一站」在哪');
  await step(tok);                                   // 48:37 不複製資料，只多存 pointer
  bub('資料只存一份，上層只多存 pointer', -3.2, 6.0);
  say('通常不會複製資料', '連 key 都可能太大 → 只多存 pointer');
  await step(tok);                                   // 49:50 目前只說了：已經有 ordered list 怎麼變快
  ts.forEach(kill); for (let l = 0; l < 4; l++) glow(s.get(l, 9), null);
  say('目前只講了 search', '假設已經有排好的 list，再加上快車');
  await step(tok);                                   // 50:21 從無到有：先排成 ordered list = insertion sort
  noT('亂序資料 → ordered list：本質就是 insertion sort，很花時間', 0, 6.3);
  say('但 map 要「從無到有」建起來', '一個一個 insert 成 ordered list = insertion sort');
  await step(tok);                                   // 50:46 一次 insertion 要改很多條 list
  for (let l = 0; l < 4; l++) s.lv[l].forEach((m) => glow(m, RED));
  say('skip list 的一次 insertion', '<span class="no">可能要在好幾條 list 裡做 → 更慢</span>');
  await step(tok);                                   // 50:55 兩個缺點只解決了一個
  for (let l = 0; l < 4; l++) s.lv[l].forEach((m) => glow(m, null));
  okT('slow search ✓ 用快車解決', -3.2, -0.5, 1.0); noT('slow insertion ✗ 還沒解決', 2.6, -0.5, 1.0);
  say('ordered list 的兩個缺點', 'slow search 解決了，slow insertion 還沒');
}]);

// ═════════ 7. 第二個例子：找 9、找 6 ═════════
const SL2 = [2, 3, 5, 6, 8, 9, 10, 13];
const SL2LV = () => [[2, 3, 5, 8, 9, 10, 13], [3, 8, 13], [8]];
FRAG.push(['bstlin-skip-search-9-6', 'Skip list：找 9（找到）與找 6（找不到）', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.2, 0]);
  say('第二個例子', '');
  await step(tok);                                   // 1:02:59 底層：2 3 5 8 9 10 13
  const s = SL(SL2, [SL2LV()[0]], ['L1', 'L2', 'L3'], { drop: true, dy: 1.85 });   // taller levels: the rider's key over its head stays clear of the level above
  say('底層排好：2 3 5 8 9 10 13', '');
  await step(tok);                                   // 1:03:08 快一點的 list：3 → 8 → 13
  for (const k of [3, 8, 13]) s.add(1, k, true);
  s.links();
  say('上面一條兩兩一走的 list', '3 → 8 → 13');
  await step(tok);                                   // 1:03:31 上下兩個 3 其實是同一個
  const v3 = line(s.X(3), s.Y(0) + 0.3, s.X(3), s.Y(1) - 0.25, 0.5, '#c08a1f');
  glow(s.get(0, 3), GOLD); glow(s.get(1, 3), GOLD);
  say('上下兩層的 3 其實是同一個', '看到 8 要往前或往後時，就回到下一層去決定');
  await step(tok);                                   // 1:03:55 也可以用雙箭頭
  glow(s.get(0, 3), null); glow(s.get(1, 3), null); kill(v3);
  const back = [arrow(V3(s.X(8) - 0.4, s.Y(1) - 0.18, 0), V3(s.X(3) + 0.4, s.Y(1) - 0.18, 0), 0x2f7fc0), arrow(V3(s.X(13) - 0.4, s.Y(1) - 0.18, 0), V3(s.X(8) + 0.4, s.Y(1) - 0.18, 0), 0x2f7fc0)];
  const dbl = bub('雙箭頭：好做，但更吃記憶體', s.X(8), s.Y(1) + 0.8);
  say('圖上畫單箭頭', '也可以用雙箭頭：能走回頭，但多佔記憶體');
  await step(tok);                                   // 1:04:15 四個一跳：最上層只有 8
  back.forEach(kill); kill(dbl);
  s.add(2, 8, true); s.links();
  say('再上去：四個四個跳', '最上層只有 8 → 這就是一個 skip list');
  await step(tok);                                   // 1:04:37 找 9：從 8 進來，右邊沒了
  const r = rider('9', s.at(2, 'H'));
  // going down a level: step off to the node's right, drop, then on to dest (straight down, the key over the rider's head crossed the number above)
  const down = async (lt, k, lb, dest) => { const x = s.X(k) + 0.68; await hopTo(tok, r, V3(x, s.at(lt, k).y, 0), 200); await hopTo(tok, r, V3(x, s.at(lb, k).y, 0), 300); await hopTo(tok, r, dest, 250); };
  await hopTo(tok, r, s.at(2, 8), 600); glow(s.get(2, 8), GOLD); r.look(1);
  const nb = bub('9 > 8 往右……沒路了', s.X(10), s.Y(2) + 0.6);
  say('search 9：從 8 進來', '9 比 8 大要往右，但右邊沒東西 → 下一層');
  await step(tok);                                   // 1:04:47 下一層：往右看
  kill(nb); glow(s.get(2, 8), null);
  await down(2, 8, 1, s.at(1, 8));
  say('到下一層，一樣往右看', '');
  await step(tok);                                   // 1:04:52 13 過頭了
  glow(s.get(1, 13), RED); r.mood('wow');
  say('13 太過頭了', '不用往 13 走');
  await step(tok);                                   // 1:04:56 在 8 再往下 → 找到 9
  glow(s.get(1, 13), null); r.mood('calm');
  await down(1, 8, 0, s.at(0, 9));
  glow(s.get(0, 9), GREEN); r.mood('happy');
  say('在 8 再往下一層', '往右一步就找到 9');
  await step(tok);                                   // 1:05:15 找 6：一樣從 8 進來
  glow(s.get(0, 9), null);
  r.set('6'); r.mood('calm'); r.g.position.copy(s.at(2, 'H'));
  await hopTo(tok, r, s.at(2, 8), 600);
  say('也能找「不在」的東西：search 6', '一樣從 8 進來');
  await step(tok);                                   // 1:05:22 8 已經過頭 → 回到 3
  glow(s.get(2, 8), RED); r.mood('wow');
  await anim(tok, 400, () => {});
  glow(s.get(2, 8), null);
  await hopTo(tok, r, V3(s.X(3), s.Y(2) + 0.2, 0), 420); await hopTo(tok, r, s.at(1, 3), 380); r.mood('calm');   // back along the top level, then down onto 3 (a diagonal hop dragged the 6 across 3's number)
  say('6 < 8：8 已經過頭了', '回到 3 這站');
  await step(tok);                                   // 1:05:33 從 3 找下來：3 → 5
  await down(1, 3, 0, s.at(0, 5)); glow(s.get(0, 5), GOLD);
  say('從 3 往下一層', '往前到 5');
  await step(tok);                                   // 1:05:42 下一個已經是 8：沒有 6
  glow(s.get(0, 8), RED); r.mood('sad');
  const gh = cube('6?', '#d8cfc0', [0.8, 0.5, 0.8], s.X(6), s.Y(0), 0);
  say('下一個已經是 8：沒有 6', '找不到，而且剛好停在 5 和 8 之間');
  await step(tok);                                   // 1:05:55 詳細 pseudocode 課本有
  glow(s.get(0, 5), null); glow(s.get(0, 8), null); kill(gh);
  const bk = prop('file', 5.6, s.Y(2) - 0.6, 0, 1.0, '課本：完整 pseudocode'); bob(bk, 0.05);
  say('整個過程就是：快車 → 慢車', '詳細的 pseudocode 在課本上');
}]);

// ═════════ 8. 插入 6：嚴格兩兩一數會怎樣 ═════════
FRAG.push(['bstlin-skip-strict', 'Insert 6：嚴格規則會讓每層都要改', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const s = SL(SL2, SL2LV(), ['L1', 'L2', 'L3']);
  const r = rider('6', s.at(2, 'H'));
  say('剛才找不到 6', '');
  await step(tok);                                   // 1:06:12 找不到 → 把 6 塞進 map
  r.mood('wow');
  bub('那就把我放進去吧！', s.HX + 0.6, s.Y(2) + 1.1);
  say('map 很常見的操作：找不到就 insert', '把 6 塞進去');
  await step(tok);                                   // 1:06:35 找不到時已經在 5 和 8 中間
  await hopTo(tok, r, V3(s.X(6), s.Y(0) + 0.9, 0), 900); r.mood('calm');
  say('最底層塞進去不是問題', '找不到 6 的時候，已經停在 5 和 8 中間');
  await step(tok);                                   // 1:07:00 改兩張小紙條：5 → 6 → 8
  kill(r.g);
  s.add(0, 6, true); s.links();
  note('改兩張小紙條', s.X(6), -0.5, 0.8);
  say('已經知道位置的 insertion = linked list 的強項', '5 → 6 → 8 連起來了');
  await step(tok);                                   // 1:07:15 可是上面還有好多條 list
  for (let l = 1; l < 3; l++) s.lv[l].forEach((m) => glow(m, GOLD));
  say('問題是：上面還有好多條 list', '如果堅持「嚴格」兩兩一數……');
  await step(tok);                                   // 1:07:34 L2 要變成 3 6 9 …
  for (let l = 1; l < 3; l++) s.lv[l].forEach((m) => glow(m, null));
  bub('L2 應該是：3 6 9 13', 0, s.Y(1) + 0.75);
  say('底層第 2、4、6、8 個：3、6、9、13', '跟原本的 3 8 13 完全不一樣');
  await step(tok);                                   // 1:07:54 8 塗掉，換成 6 和 9
  s.del(1, 8, true);
  await anim(tok, 500, () => {});
  s.add(1, 6, true); s.add(1, 9, true); s.links();
  say('把 8 塗掉，換成 6、9', '');
  await step(tok);                                   // 1:08:02 每一層都要更新
  s.del(2, 8, true);
  await anim(tok, 500, () => {});
  s.add(2, 6, true); s.add(2, 13, true); s.links();
  say('L3（四個一數）也要變：6、13', '幾乎每一層都要更新');
  await step(tok);                                   // 1:08:19 上面加起來 ≈ 底層的 n 個
  tag('上面各層加起來 ≈ n 個', 'ptr alt', 0, s.Y(2) + 0.9, 0);
  say('還記得空間的分析嗎？', '上面各層的 node 加起來 ≈ 底層 n 個');
  await step(tok);                                   // 1:08:45 嚴格規則：2、4、8、16 個一數
  for (let l = 1; l < 3; l++) s.lv[l].forEach((m) => glow(m, RED));
  say('照嚴格規則（2、4、8、16 個一數）', '上面幾乎每個 node 都要換');
  await step(tok);                                   // 1:09:12 insertion = O(n)
  noT('if update all upper lists：insertion O(n)', 0, -0.6, 0.8);
  say('維護成本很高', '一次 insertion 就是 <span class="no">O(n)</span>');
}]);

// ═════════ 9. 偷懶：丟銅板決定 6 要上幾層 ═════════
FRAG.push(['bstlin-skip-coin', 'Randomized：丟銅板決定新 node 的層數', async (tok) => {
  fresh([0, 5.5, 13], [0, 1.8, 0]);
  const s = SL(SL2, SL2LV(), ['L1', 'L2', 'L3']);
  const lazy = buddy('偷懶', 'zz', '#c9b2f2', 5.6, -0.2, 1.4, 0.7);
  say('有沒有偷懶的方法？', '');
  await step(tok);                                   // 1:09:36 所有設計都在偷懶
  lazy.mood('happy');
  bub('能不能少做一點？', 5.6, 1.5, 1.4);
  say('資料結構和演算法的設計', '其實都是在想辦法偷懶');
  await step(tok);                                   // 1:10:07 像 extendible hash：還不用分家就共用
  note('extendible hash：還不用分家，就先共用', -2.6, 5.0);
  say('今天一開始的 extendible hash 也是', '還沒必要分家，就先共用');
  await step(tok);                                   // 1:10:35 力氣花在哪：嚴格規定
  for (let l = 1; l < 3; l++) s.lv[l].forEach((m) => glow(m, RED));
  const strict = noT('嚴格：一定 2 個一數、4 個一數…', 0, 4.4);
  say('力氣從哪來？', '因為嚴格規定兩個一數、四個一數……');
  await step(tok);                                   // 1:11:27 放鬆：「差不多」就好
  for (let l = 1; l < 3; l++) s.lv[l].forEach((m) => glow(m, null));
  kill(strict); okT('放鬆：「差不多」2 個一數就好', 0, 4.4);
  say('能不能放鬆一點？', '「差不多」兩個一數、四個一數就好');
  await step(tok);                                   // 1:11:48 6 已經塞進底層
  s.add(0, 6, true); s.links();
  say('6 已經塞進底層了', '它一定在 L1');
  const coin = cube('', '#c08a1f', [0.9, 0.12, 0.9], 5.6, 4.6, 0); const ct = tag('', 'ptr alt', 5.6, 5.3, 0);
  const flip = async (face) => { txt(ct, '…'); await anim(tok, 900, (f) => { coin.rotation.x = f * Math.PI * 4; }); txt(ct, face); };
  await step(tok);                                   // 1:11:57 丟銅板：正面就上一層也放 6
  await flip('正面');
  s.add(1, 6, true); s.links();
  say('幫 6 丟一個銅板', '正面 → 上一層也留一個 6 的位置');
  await step(tok);                                   // 1:12:06 反面就上不去：機率一半
  tag('機率 1/2', 'ptr alt', s.X(6), s.Y(1) + 0.6, 0);
  say('反面的話，6 就不上去', '所以 6 有一半的機率出現在 L2');
  await step(tok);                                   // 1:12:21 上去了就再丟一次
  await flip('反面');
  const gh = cube('', '#d8cfc0', [0.6, 0.4, 0.6], s.X(6), s.Y(2), 0);
  tag('機率 1/4', 'ptr alt', s.X(6), s.Y(2) + 0.6, 0);
  say('上去了就再丟一次：要不要上 L3？', '反面 → 停。上 L3 的機率 = 1/2 × 1/2 = 1/4');
  await step(tok);                                   // 1:12:38 越往上機率越小
  kill(gh);
  ['一定在', '1/2', '1/4'].forEach((p, l) => tag(p, 'idx', -6.3, s.Y(l) - 0.45, 0));
  say('L1 一定有、L2 機率 1/2、L3 機率 1/4', '越往上，出現的機率越小');
  await step(tok);                                   // 1:12:53 每個 insertion 都這樣：期望值
  ['n', '≈ n/2', '≈ n/4'].forEach((p, l) => tag(p, 'ptr', 6.2, s.Y(l), 0));
  say('每個 key 插進來都這樣丟', '期望值：L2 約 n/2 個、L3 約 n/4 個……');
  await step(tok);                                   // 1:13:23 「大概」兩兩一數，還是能快速 search
  okT('大概兩兩一數 → 一樣能快速 search', 0, 5.1);
  say('從嚴格改成「大概」', '一樣符合快速搜尋的性質');
  await step(tok);                                   // 1:13:48 不用 update 所有上層 list
  note('只改 1 層：1/2　2 層：1/4　3 層：1/8 …', 0, -0.6, 0.8);
  say('insertion 不用 update 所有上層 list', '要改幾層靠機率：通常很少');
  await step(tok);                                   // 1:14:27 每次 update 都是簡單的 linked list insertion
  glow(s.get(0, 6), GOLD); glow(s.get(1, 6), GOLD);
  lazy.mood('happy');
  say('每個 update 只是把 6 插進那一層', '<span class="ok">simple linked list insertion</span>，不牽動別人');
  await step(tok);                                   // 1:14:49 randomized data structure
  glow(s.get(0, 6), null); glow(s.get(1, 6), null);
  bub('randomized data structure', 5.6, 1.5, 1.4);
  say('課程裡少數的 randomized 資料結構', '用隨機性讓它「很大機率」符合需求');
}]);

// ═════════ 10. Skip list 的搜尋路徑 = 一棵 Binary Search Tree ═════════
FRAG.push(['bstlin-skip-to-tree', 'Skip list 的搜尋路徑 = 一棵 Binary Search Tree', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.4, 0]);
  const S6 = [2, 3, 5, 8, 10, 13];
  say('還是同一個問題：map', '');
  await step(tok);                                   // 1:18:07 array → linked list → tree？
  const ic = [['array', '#f3dcc0', -4.2], ['list', '#cfe3d4', -1.4], ['tree?', '#dfe0ee', 1.4]].map(([n, c, x]) => buddy(null, n, c, x, 0.8, 1.0, 0.8));
  ic[2].mood('wow');
  say('map 已經會用 array、linked list 做', '那 tree 呢？跟 skip list 有什麼關係？');
  await step(tok);                                   // 1:18:27 再畫一次 skip list
  ic.forEach((b) => kill(b.g));
  const s = SL(S6, [S6, [3, 8, 13], [8]], ['L1', 'L2', 'L3'], { dx: 1.6, drop: true });
  say('再畫一次 skip list', '2 3 5 8 10 13；上層 3 8 13；最上層 8');
  await step(tok);                                   // 1:19:20 用「龜毛」方式建的，不是隨機
  note('龜毛版：照規則建，不是丟銅板', 0, 4.4);
  say('為了好講，用嚴格規則建的版本', '同學說：這看起來有點像 tree？');
  const r = rider('2', s.at(2, 'H'));
  const red = [];
  await step(tok);                                   // 1:20:01 找 2：8 → 3 → 2
  await hops(tok, r, [s.at(2, 8), s.at(1, 3), s.at(0, 2)], 650);
  glow(s.get(0, 2), GREEN);
  say('search 2：從 8 進來，8 過頭往 3', '3 還是過頭 → 找到 2');
  await step(tok);                                   // 1:20:24 找 5：8 → 3 → 5
  glow(s.get(0, 2), null); r.set('5'); r.g.position.copy(s.at(2, 'H'));
  await hops(tok, r, [s.at(2, 8), s.at(1, 3), s.at(0, 3), s.at(0, 5)], 520);
  glow(s.get(0, 5), GREEN);
  say('search 5：8 過頭回到 3', '從 3 往右下找到 5');
  await step(tok);                                   // 1:20:46 找 10：8 → 13 → 10
  glow(s.get(0, 5), null); r.set('10'); r.g.position.copy(s.at(2, 'H'));
  await hops(tok, r, [s.at(2, 8), s.at(1, 8), s.at(1, 13), s.at(0, 10)], 520);
  glow(s.get(0, 10), GREEN);
  say('search 10：從 8 到 13', '13 過頭 → 往左找到 10');
  await step(tok);                                   // 1:21:14 把比較的關係另外畫出來
  glow(s.get(0, 10), null); kill(r.g);
  const P = (l, k) => V3(s.X(k), s.Y(l), 0.5);
  for (const [a, b] of [[[2, 8], [1, 3]], [[1, 3], [0, 2]], [[1, 3], [0, 5]], [[2, 8], [1, 13]], [[1, 13], [0, 10]]]) {
    const p = P(...a), q = P(...b); red.push(line(p.x, p.y, q.x, q.y, 0.5, '#d64545'));
  }
  say('把找的過程碰到的點和關係畫出來（紅線）', '8 之後比 3 或 13；3 之後是 2 或 5；13 之後是 10');
  await step(tok);                                   // 1:21:42 其他可能：不在資料裡
  const nf = [noT('10~13 之間：沒有', (s.X(10) + s.X(13)) / 2, -0.4, 0.6), noT('5~8 之間：沒有', (s.X(5) + s.X(8)) / 2, -0.4, 0.6)];
  say('其他情況：比 13 小但比 10 大……', '那就是不在資料裡');
  await step(tok);                                   // 1:22:09 每一站只有往左、往右
  nf.forEach(kill); red.forEach(kill);
  for (let l = 1; l < s.lv.length; l++) [...s.lv[l].keys()].forEach((k) => s.del(l, k, true));
  s.links(); s.arrows().forEach(kill);
  const t = { root: null }; [8, 3, 13, 2, 5, 10].forEach((k) => bstIns(t, k));
  const tv = TV(t, { cubes: new Map([...s.lv[0].entries()]), dx: 1.5, top: 5 });
  tv.sync();
  say('每個 node 只有「往左」或「往右」兩種可能', '把紅線拉直……');
  await step(tok);                                   // 1:22:35 就是一棵 binary tree
  glow(tv.c(8), GOLD); tag('root', 'ptr alt', tv.P.get(8).x, tv.P.get(8).y + 0.9, 0);
  say('畫出來就是一棵 binary tree', '從中點 8 進去 → 8 就是 root');
  await step(tok);                                   // 1:22:58 往左都比 8 小，往右都比 8 大
  const gl = ghostBox('#2fc092', 4.0, 2.6, 1.4); gl.position.set(-2.25, 2.85, 0);
  const gr = ghostBox('#4b9ee2', 2.6, 2.6, 1.4); gr.position.set(3.0, 2.85, 0);
  tag('都 < 8', 'ptr', -2.25, 1.2, 0); tag('都 > 8', 'ptr', 3.0, 1.2, 0);
  say('從 8 往左走的都比 8 小', '往右走的都比 8 大');
  await step(tok);                                   // 1:23:09 每棵 subtree 也一樣
  glow(tv.c(8), null); glow(tv.c(3), GOLD); glow(tv.c(13), GOLD);
  note('2 < 3 < 5', tv.P.get(3).x, tv.P.get(3).y + 0.9); note('10 < 13', tv.P.get(13).x, tv.P.get(13).y + 0.9);
  say('看進每棵 subtree 也一樣', '3 的左邊比 3 小、右邊比 3 大；13 也是');
  await step(tok);                                   // 1:23:50 性質：左子樹 < root < 右子樹
  glow(tv.c(3), null); glow(tv.c(13), null);
  bub('左邊 subtree < root < 右邊 subtree（每一棵都成立）', 0, 6.4);
  say('任何一個 node：整棵左 subtree 都比它小', '整棵右 subtree 都比它大，每棵 subtree 都成立');
  await step(tok);                                   // 1:24:56 = Binary Search Tree
  okT('Binary Search Tree', 0, 7.0);
  say('這樣的樹叫做 Binary Search Tree', '像自我複製的結構：每棵 subtree 都有同樣性質');
}]);

// ═════════ 11. BST search 演算法（遞迴）與終止條件 ═════════
FRAG.push(['bstlin-bst-search', 'BST search：跟 root 比，往左或往右', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.6, 0]);
  const t = { root: null }; [8, 3, 13, 2, 5, 10].forEach((k) => bstIns(t, k));
  const tv = TV(t, { cx: 2.6, dx: 1.2, top: 5 }); tv.sync();
  say('Binary Search Tree 怎麼找東西？', '');
  await step(tok);                                   // 1:25:16 跟 root 比：小去左、大去右
  const l1 = pkt('比 root 小 → 左', tv.P.get(3).x - 0.6, 6.0), l2 = pkt('比 root 大 → 右', tv.P.get(13).x + 0.4, 6.0);
  say('跟 root 比', '比 root 小去左 subtree，比 root 大去右 subtree');
  await step(tok);                                   // 1:25:31 subtree 再做同樣的事
  const z = ghostBox('#2fc092', 3.0, 2.4, 1.4); z.position.set(tv.P.get(3).x, 3.0, 0);
  say('進到 subtree 再做同樣的事', '概念上就是 recursive call（zoom in）');
  await step(tok);                                   // 1:25:50 root 是 8，我是 7：去左邊
  kill(z); kill(l1); kill(l2);
  const r = rider('7', V3(tv.P.get(8).x - 1.6, 5.6, 0));
  await hopTo(tok, r, tv.top(8), 500); glow(tv.c(8), GOLD);
  await hopTo(tok, r, tv.top(3), 600);
  say('search 7：7 < 8', '去左邊找');
  await step(tok);                                   // 1:25:57 右邊整個不用考慮
  glow(tv.c(8), null);
  [13, 10].forEach((k) => tint(tv.c(k), GRAY));
  say('右邊的通通不用考慮了', '跟 binary search 一樣的偷吃步');
  await step(tok);                                   // 1:26:07 左邊找不到就是沒有
  bub('7 要嘛在左邊，要嘛根本不在', tv.P.get(3).x - 1.2, 1.0);
  say('左邊找不到，就是沒有', '這樣的資料結構叫 Binary Search Tree');
  await step(tok);                                   // 1:26:37 延伸一：怎麼做出「好的」BST
  bub('延伸一：好的 BST（像 max tree + complete → heap）', -2.6, -0.4, 1.0);
  say('接下來兩週：BST 的延伸', '一：再加條件，做出「好的」BST');
  await step(tok);                                   // 1:27:25 延伸二：multi-way search tree
  bub('延伸二：multi-way search tree（一個 node 放好幾個 key）', -2.2, -1.1, 1.0);
  say('二：一個 node 放好幾個比較基準點', '叫 multi-way search tree');
  await step(tok);                                   // 1:27:56 寫下 BST 的 search algorithm
  const cd = code(['BSTSearch(T, key):', '  if key < T.mid:', '    return BSTSearch(T.left, key)', '  if key > T.mid:', '    return BSTSearch(T.right, key)', '  return T.data   // key == mid'], -3.8, 5.4, 0.56);
  say('把 BST 當 map：寫下 search', '給 key，找出它在樹的哪裡（和它的 value）');
  await step(tok);                                   // 1:28:31 中點其實就是 root
  cd.hl(0); glow(tv.c(8), GOLD);
  say('binary search 要有中點', '中點 mid 就是 root');
  await step(tok);                                   // 1:28:38 key < mid → 去左邊
  glow(tv.c(8), null); cd.hl(2);
  say('key < mid', '→ BSTSearch(T.left, key)：去左邊找');
  await step(tok);                                   // 1:29:01 key > mid → 去右邊
  cd.hl(4);
  say('key > mid', '→ BSTSearch(T.right, key)：去右邊找');
  await step(tok);                                   // 1:29:19 相等：回傳對應的 value
  cd.hl(5);
  say('不大不小 → 等於', '回傳 root 對應的 value（data）');
  await step(tok);                                   // 1:29:48 結構跟 array 上的 binary search 一樣
  cd.hl(-1);
  say('整個演算法的結構', '跟 array 上的 binary search 一模一樣');
  await step(tok);                                   // 1:30:27 沒寫終止條件：找不到不會停
  await hopTo(tok, r, tv.top(5), 500); await hopTo(tok, r, V3(tv.P.get(5).x + 0.7, tv.P.get(5).y - 1.3, 0), 500);
  r.mood('sad'); cd.hl(3);
  say('search 7：7 > 3 → 5，7 > 5 → 右邊是空的', '<span class="no">板書沒寫終止條件：找不到時停不下來</span>');
  await step(tok);                                   // 1:30:46 補上：T 是空的就停
  txt(cd.ls[0], 'BSTSearch(T, key):  if T is empty: NOT FOUND');
  cd.hl(0);
  say('真的要用時要補一行', '<span class="ok">T 是空的 → 找不到，停</span>');
}]);

// ═════════ 12. 花多少力氣：O(h)，最差 O(n)、最好 O(log n) ═════════
FRAG.push(['bstlin-bst-height', 'BST search 是 O(h)：歪斜的樹 vs 矮的樹', async (tok) => {
  fresh([0, 5, 13], [0, 2.8, 0]);
  const b = { root: null }; [5, 3, 8, 2].forEach((k) => bstIns(b, k));
  const vb = TV(b, { cx: 3.4, dx: 1.2, dy: 1.3, top: 5.4 }); vb.sync();
  say('這個 algorithm 要花多少力氣？', '');
  await step(tok);                                   // 1:31:05 找到或宣告找不到要多少力氣
  const kid = buddy(null, '?', '#9fd6a8', -1.0, 0.0, 1.0, 0.7); kid.mood('wow');
  say('找到東西、或宣告找不到', '要花多少力氣？');
  await step(tok);                                   // 1:31:16 從 root 進去，一路往 subtree 走
  const r = rider('2', V3(vb.P.get(5).x - 1.4, 5.8, 0));
  for (const k of [5, 3, 2]) { await hopTo(tok, r, vb.top(k), 450); glow(vb.c(k), k === 2 ? GREEN : GOLD); }
  say('從 root 進去，進到某個 subtree……', '一路走到沒有為止');
  await step(tok);                                   // 1:31:38 = 樹高那麼多力氣：O(h)
  bub('走過的路 = root 到 leaf：最多 h 層', 3.4, 0.4);
  say('路徑最長就是 root 到 leaf', '力氣 = 樹高 h：<span class="ok">O(h)</span>');
  await step(tok);                                   // 1:32:26 h 最糟是多少？
  kid.mood('calm');
  say('那 h 最糟會是多少？', '還記得 binary tree 可以很矮、也可以很高');
  await step(tok);                                   // 1:32:54 很高的樹 = 偽裝的 linked list
  const a = { root: null };
  const va = TV(a, { cx: -3.4, dx: 1.0, dy: 1.3, top: 5.4 });
  for (const k of [8, 5, 3, 2]) { bstIns(a, k); va.sync(k); }
  tag('不好的 BST', 'ptr', -3.4, 0.2, 0);
  say('很高的樹：一個偽裝的 linked list', 'worst case：h = n → <span class="no">O(n)</span>');
  await step(tok);                                   // 1:33:30 8 → 5 → 3 → 2：走 4 個 node
  kill(kid.g);
  const r2 = rider('2', V3(va.P.get(8).x - 1.2, 5.8, 0));
  for (const k of [8, 5, 3, 2]) { await hopTo(tok, r2, va.top(k), 400); glow(va.c(k), k === 2 ? GREEN : GOLD); }
  r2.mood('sad');
  say('8、5、3、2：從 8 要找到 2', '一路走下去，走 4 個 node');
  await step(tok);                                   // 1:33:41 linked list 也是 4 個
  [8, 5, 3, 2].forEach((k, i) => cube(k, colorFor(k), [0.6, 0.45, 0.6], -5.6 + i * 1.0, -0.6, 1.2));
  for (let i = 0; i < 3; i++) arrow(V3(-5.25 + i * 1.0, -0.6, 1.2), V3(-4.95 + i * 1.0, -0.6, 1.2));
  say('linked list 也是 4 個 node 才找到 2', '這棵樹就沒什麼好處');
  await step(tok);                                   // 1:34:00 best：像 complete binary tree，log n
  tag('好的 BST', 'ptr', 3.4, 0.2, 0);
  say('best case：像 complete binary tree', '高度約 log n → <span class="ok">O(log n)</span>');
  await step(tok);                                   // 1:34:17 目前唯一 log n 的 map：skip list
  bub('目前唯一 log n 的 map：skip list（n、n/2、n/4…約 log n 層）', 0, 7.0);
  say('到目前為止，花 log n 力氣的 map', '只有 skip list');
  await step(tok);                                   // 1:34:59 好的 vs 不好的
  [8, 5, 3, 2].forEach((k) => glow(va.c(k), null)); [5, 3, 2].forEach((k) => glow(vb.c(k), null));
  r.mood('happy');
  say('同樣是 BST', '右邊叫「好的」，左邊叫「不好的」');
  await step(tok);                                   // 1:35:10 不要長歪：樹高低一點
  noT('長歪 ✗', -3.4, 6.3); okT('矮一點、還是 BST ✓', 3.4, 6.3);
  say('我們想避免長歪的 BST', '讓樹高低一點，但還維持 binary search 的性質');
  await step(tok);                                   // 1:35:43 像 heap：max tree + complete
  note('heap = max tree + complete（加了條件就變好用）', 0, -1.4, 1.2);
  say('heap 的時候成功過一次', '在 BST 上也加條件，讓樹高變「好」');
}]);

// ═════════ 13. 限制強度的取捨：BST ↔ complete BST（AVL、紅黑樹在中間） ═════════
const XS = { BST: -4.8, RB: -1.5, AVL: 1.5, CBT: 4.8 };
function tradeAxis() {
  line(-6.2, 0.15, 6.2, 0.15, 0, '#6e5f49');
  tag('限制寬鬆', 'idx', -5.6, 0.2, 1.3); tag('限制嚴格', 'idx', 5.6, 0.2, 1.3);
}
const tb = (v, k, color) => buddy(null, v, color, XS[k], 0.2, 0, 0.9);
const tnote = (k, a, y, cls = 'idx') => tag(a, cls, XS[k], y, 0);
FRAG.push(['bstlin-tradeoff', '限制寬鬆 ↔ 嚴格：一般 BST、complete BST、AVL、紅黑樹', async (tok) => {
  fresh([0, 6, 13], [0, 2, 0]);
  say('在 BST 上可以做些什麼？', '');
  await step(tok);                                   // 1:37:24 設計上有很多 trade-off
  tradeAxis();
  say('資料結構的設計有很多 trade-off', '再加一些限制，來確保樹高');
  await step(tok);                                   // 1:38:00 以 insertion 後的維護為例
  bub('比較：insert 後要花多少力氣維護？ vs 最差 search 多快？', 0, 4.4);
  say('以 insertion 為例', '放進去之後要花多少力氣維護（maintenance）');
  await step(tok);                                   // 1:38:11 寬鬆：隨便找位置放
  const bst = tb('BST', 'BST', '#7cb8ee'); bst.mood('happy');
  tnote('BST', '維護 ≈ 0', 1.7);
  say('限制很寬鬆：只要滿足 binary search 性質', 'insert 隨便找個可以放的位置就好');
  await step(tok);                                   // 1:38:38 但樹高顧不住：worst O(n)
  tnote('BST', 'search 最差 O(n)', 2.2, 'bad');
  say('但樹高就顧不住', '最差像 linked list：search <span class="no">O(n)</span>');
  await step(tok);                                   // 1:39:34 = 一般的 arbitrary BST
  tnote('BST', 'arbitrary BST', -0.5, 'ptr');
  say('最寬鬆的一端', '就是一般的（arbitrary）Binary Search Tree');
  await step(tok);                                   // 1:39:58 最嚴格：complete binary tree
  const cb = tb('Complete', 'CBT', '#c9b2f2');
  tnote('CBT', 'complete BST', -0.5, 'ptr');
  say('最嚴格的一端', '要求它是 complete binary tree + BST');
  await step(tok);                                   // 1:40:38 complete = array：一個蘿蔔一個坑
  bub('complete tree = array：一個蘿蔔一個坑', XS.CBT - 0.6, 3.2);
  say('complete binary tree 就是一個 array', '限制強度差不多就是 ordered array');
  await step(tok);                                   // 1:41:24 worst search O(log n)
  tnote('CBT', 'search 最差 O(log n)', 2.2, 'good');
  say('樹高就是 log n', 'worst search <span class="ok">O(log n)</span>');
  await step(tok);                                   // 1:41:46 但要花 n 的力氣排好
  tnote('CBT', '維護 O(n)', 1.7, 'bad'); cb.mood('sad');
  say('可是 insert 後', '要花 <span class="no">n 的力氣</span>才能把蘿蔔排回各自的坑');
  await step(tok);                                   // 1:42:01 heap 只要浮一浮；BST 性質更強
  bub('heap：沿一條 path 浮一浮就好；BST 要「每個人」的位置都對', 0, 5.4);
  say('heap 只要選出領導人，上下浮一浮', 'BST 的性質更強：所有大小關係都要對');
  await step(tok);                                   // 1:42:55 AVL：比 complete 寬鬆一點
  const av = tb('AVL', 'AVL', '#9fd6a8'); av.mood('happy');
  say('中間第一種：AVL tree', '比 complete BST 再寬鬆一點');
  await step(tok);                                   // 1:43:29 維護 constant，search 仍 log n
  tnote('AVL', '維護：常數次調整', 1.7, 'good'); tnote('AVL', 'search 最差 O(log n)', 2.2, 'good');
  say('insert 後只要 constant 的力氣維護', '還是保證 worst search <span class="ok">O(log n)</span>');
  await step(tok);                                   // 1:44:10 紅黑樹：一樣的複雜度
  const rb = tb('紅黑樹', 'RB', '#e88a8a'); rb.mood('happy');
  tnote('RB', '維護：常數次調整', 1.7, 'good'); tnote('RB', 'search 最差 O(log n)', 2.2, 'good');
  say('中間第二種：Red-Black tree', '一樣：constant 維護、O(log n) worst search');
}]);
FRAG.push(['bstlin-avlrb', 'AVL vs 紅黑樹：一個好教，一個實務常用', async (tok) => {
  fresh([0, 6, 13], [0, 2, 0]);
  tradeAxis();
  const bst = tb('BST', 'BST', '#7cb8ee'), cb = tb('Complete', 'CBT', '#c9b2f2'), av = tb('AVL', 'AVL', '#9fd6a8'), rb = tb('紅黑樹', 'RB', '#e88a8a');
  say('複雜度看起來差不多', '但在這條線上的位置不一樣');
  await step(tok);                                   // 1:44:45 越右邊樹越矮
  tag('樹高：越右越矮（complete 最矮）→', 'ptr alt', 0, 3.4, 0);
  say('看樹高：越往右越好', 'complete 已經是最矮的 binary tree');
  await step(tok);                                   // 1:45:01 維護：左邊幾乎不用，右邊很多
  tag('← 維護：越左越省力', 'ptr', 0, 2.8, 0);
  bst.mood('happy'); cb.mood('sad');
  say('看 maintenance：剛好相反', '左邊幾乎不用維護，右邊要很多');
  await step(tok);                                   // 1:45:22 中間其實有十幾二十種選擇
  for (const x of [-3.2, -0.2, 0.4, 3.1]) cube('', '#d8cfc0', [0.3, 0.3, 0.3], x, 0.3, 0);
  say('為什麼選兩種？', '中間其實可能有十種、二十種選擇');
  await step(tok);                                   // 1:45:36 這兩種有代表性又實用
  av.glow('#3a2a00'); rb.glow('#3a2a00');
  say('選這兩種：有代表性', '又好教、又有實用性');
  await step(tok);                                   // 1:45:44 AVL：easy to teach
  av.glow(null); tag('easy to teach', 'good', XS.AVL, 1.7, 0);
  say('AVL：easy to teach', '');
  await step(tok);                                   // 1:45:55 紅黑樹：faster in general（維護快）
  rb.glow(null); tag('faster in general', 'good', XS.RB - 0.6, 1.7, 0);
  await travel(tok, rb.g, rb.g.position.clone(), V3(XS.RB - 0.6, 0.2, 0), 700);
  say('紅黑樹：faster in general', '這個 faster 是指維護比較快：它比較寬鬆，寫在左邊一點');
  await step(tok);                                   // 1:46:24 worst search 稍慢一點點
  tag('search 稍慢一點點', 'bad', XS.RB - 0.6, 2.2, 0);
  say('比較能適應動態調整', '但 worst search 稍微慢一點點（沒有很誇張）');
  await step(tok);                                   // 1:46:36 實務常用紅黑樹，但難教
  tag('實務常用・但難教', 'ptr alt', XS.RB - 0.6, 2.7, 0);
  say('實務上比較常用紅黑樹', '只是它不適合當入門');
  await step(tok);                                   // 1:46:53 先教 AVL，再進紅黑樹
  av.mood('happy');
  bub('今天：AVL → 之後：紅黑樹', XS.AVL, 3.0);
  say('所以先很快講 AVL 的觀念', '再進入紅黑樹（今天只教 AVL）');
  await step(tok);                                   // 1:47:56 重講：complete 太 strict
  noT('太 strict ✗', XS.CBT, 3.0);
  say('重講一次：最右邊 complete 太嚴格', '維護要很大力氣，本質就是 ordered array');
  await step(tok);                                   // 1:48:30 arbitrary 太 loose
  noT('太 loose ✗', XS.BST, 3.0); bst.mood('sad');
  say('最左邊 arbitrary BST 太寬鬆', 'worst search 沒有任何保證');
  await step(tok);                                   // 1:48:37 AVL search 快 insert 慢；紅黑樹相反
  okT('search 稍快・insertion 稍慢', XS.AVL, 3.6); okT('search 稍慢・維護稍快', XS.RB - 0.6, 3.6);
  say('中間兩個：AVL search 稍快、insertion 稍慢', '紅黑樹剛好相反');
}]);

// ═════════ 14. 為什麼 complete BST 的維護是 O(n)：1 2 3 插 4 ═════════
FRAG.push(['bstlin-complete-insert4', 'Complete BST 插入 4：每個元素都換位置', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.4, 0]);
  const kid = buddy('同學', '?', '#9fd6a8', 5.6, 3.4, 0, 0.7);
  say('休息時同學問', '');
  await step(tok);                                   // 1:59:46 strict 那邊為什麼維護很貴？
  kid.mood('wow'); bub('strict 那邊為什麼維護要很大力氣？', 3.6, 5.0);
  say('為什麼 strict 那邊維護很貴？', '用一個例子說明');
  await step(tok);                                   // 2:00:19 complete BST 放 1 2 3
  kill(kid.g);
  const t = { root: null };
  const tv = TV(t, { cx: -3.2, dx: 1.3, top: 5 });
  for (const k of [2, 1, 3]) { bstIns(t, k); tv.sync(k); }
  say('complete binary search tree 裡放 1 2 3', 'root 2，左 1、右 3');
  await step(tok);                                   // 2:00:47 對應的 array：[2, 1, 3]
  const AX = (i) => 1.6 + i * 1.3;
  for (let i = 0; i < 4; i++) { ctx.tile(V3(AX(i), 0.02, 0), 1.15, 1.15); tag('[' + (i + 1) + ']', 'idx', AX(i), 0.1, 1.1); }
  const ac = new Map(); [2, 1, 3].forEach((k, i) => ac.set(k, cube(k, colorFor(k), [0.8, 0.6, 0.8], AX(i), 0.4, 0, 2)));
  say('complete binary tree 就是 array', 'array = [2, 1, 3]');
  await step(tok);                                   // 2:01:08 insert 4
  const four = rider('4', V3(-6.0, 0.3, 0), 0.6); four.mood('wow');
  const g4 = ghostBox('#d64545', 0.85, 0.85, 0.85); g4.position.set(-3.2 - 1.3, 5 - 2 * 1.45, 0);
  say('insert 4：又要 complete、又要 BST', '形狀只能是：多出左下角那一格');
  await step(tok);                                   // 2:01:34 只能長成：3 當 root
  kill(g4); kill(four.g);
  t.root = mkN(3); t.root.l = mkN(2); t.root.l.l = mkN(1); t.root.r = mkN(4);
  tv.sync(4);
  say('仔細想：只能長成這樣', 'root 3；左 2（下面接 1）；右 4');
  await step(tok);                                   // 2:01:41 新的 array：[3, 2, 4, 1]
  [3, 2, 4, 1].forEach((k, i) => tag(String(k), 'ptr alt', AX(i), 1.5, 0));
  say('對應的 array', '[3, 2, 4, 1]');
  await step(tok);                                   // 2:02:24 原本 3 個東西全部換位置
  [3, 2, 4, 1].forEach((k, i) => { if (ac.has(k)) { move(ac.get(k), AX(i), 0.4, 0); glow(ac.get(k), RED); } else ac.set(k, cube(k, colorFor(k), [0.8, 0.6, 0.8], AX(i), 0.4, 0, 3)); });
  say('原本的 3 個全部換位置', '3：第 3 格 → 第 1 格；1：第 2 → 第 4；2：第 1 → 第 2');
  await step(tok);                                   // 2:02:58 像 ordered array 插入：大家都要讓
  bub('像 ordered array 插隊：後面的全部讓開', AX(1.5), 2.4);
  say('就像 ordered array 的 insertion', '擠進去，大家都要讓開');
  await step(tok);                                   // 2:03:26 O(n) 的 effort
  noT('每個都換位置 → O(n)', AX(1.5), 3.2);
  say('每個都要換位置', '就要花跟元素數量差不多的力氣：<span class="no">O(n)</span>');
  await step(tok);                                   // 2:03:41 heap：只修一條 path
  [3, 2, 1].forEach((k) => glow(tv.c(k), GOLD));
  note('heap：只修「最後一格 → root」這條 path', -3.2, 6.2);
  say('heap 為什麼不一樣？', 'insertion 只要修最後一格到 root 那條 path');
  await step(tok);                                   // 2:03:54 BST：修一條 path 不夠
  [3, 2, 1].forEach((k) => glow(tv.c(k), null));
  noT('complete BST：每個東西只有一個固定位置，沒彈性', -2.0, -0.6, 1.0);
  say('BST 的性質更強', '只修一條 path 不夠：每個人都得搬到「一定要在」的位置');
  await step(tok);                                   // 2:04:33 所以 maintenance 是 O(n)
  say('所以 complete BST 的維護', '是 <span class="no">O(n)</span>：我們不想選它');
}]);

// ═════════ 15. AVL 的定義：|hL − hR| ≤ 1 ═════════
FRAG.push(['bstlin-avl-def', 'AVL tree：每個 node 的 bf ∈ {−1, 0, +1}', async (tok) => {
  fresh([0, 5, 12], [0, 2.8, 0]);
  say('什麼是 AVL tree？', '先做名詞解釋');
  await step(tok);                                   // 2:05:14 A、V、L：發明者名字的縮寫
  const who = [['A', 'Adelson-', '#7cb8ee', -2.6], ['V', '-Velsky', '#f4a56a', 0], ['L', 'Landis', '#9fd6a8', 2.6]].map(([v, n, c, x]) => buddy(n, v, c, x, 2.4, 0, 0.9));
  who.forEach((b) => b.mood('happy'));
  say('AVL = 發明者名字的縮寫', 'Adelson-Velsky 和 Landis');
  await step(tok);                                   // 2:05:34 1962 年
  note('1962 年就有了', 0, 4.4);
  say('非常早的資料結構', '1962 年就有');
  await step(tok);                                   // 2:05:40 定義：BST + 一些條件
  who.forEach((b) => fly(b.g, V3(0, 6, 4)));
  const r = cube('root', '#4b9ee2', [1.1, 0.8, 1.1], 0, 5.2, 0, 2);
  const U = 0.85, TOP = 4.4;
  const gL = ghostBox('#2fc092', 1.8, 1, 1.4), gR = ghostBox('#dd8238', 1.8, 1, 1.4);
  const lL = tag('', 'ptr', -2.0, 1, 0), lR = tag('', 'ptr', 2.0, 1, 0), lb = tag('', 'ptr alt', 1.4, 5.9, 0);
  line(0, 5.2, -1.6, TOP, 0); line(0, 5.2, 1.6, TOP, 0);
  let hl = 2, hr = 2, showH = false, showB = false;
  const set = (a, b) => {
    gL.scale.y = a * U; gL.position.set(-1.6, TOP - a * U / 2, 0); gR.scale.y = b * U; gR.position.set(1.6, TOP - b * U / 2, 0);
    txt(lL, showH ? 'hL = ' + Math.round(a) : ''); txt(lR, showH ? 'hR = ' + Math.round(b) : ''); lL.position.y = TOP - a * U - 0.3; lR.position.y = TOP - b * U - 0.3;
    const bf = Math.round(a) - Math.round(b); txt(lb, showB ? 'bf = ' + (bf > 0 ? '+' + bf : bf) : ''); glow(r, Math.abs(bf) > 1 ? RED : null);
  };
  const to = async (a, b) => { const a0 = hl, b0 = hr; await anim(tok, 700, (f) => set(a0 + (a - a0) * f, b0 + (b - b0) * f)); hl = a; hr = b; set(a, b); };
  set(2, 2);
  say('定義：還是一棵 binary search tree', '再加上一點條件（complete 那種太嚴格）');
  await step(tok);                                   // 2:06:00 從任何 root 看：左右要差不多高
  tag('左 subtree', 'idx', -1.6, 4.7, 0.8); tag('右 subtree', 'idx', 1.6, 4.7, 0.8);
  say('從任何一個 root 看下去', '左邊和右邊要長得差不多高，才不會歪一邊');
  await step(tok);                                   // 2:06:35 |左高 − 右高| ≤ 1，每棵 subtree 都要
  bub('|左邊高度 − 右邊高度| ≤ 1', -3.6, 6.0);
  say('左高減右高，取絕對值 ≤ 1', '每一棵 subtree 都要成立；就這一條限制');
  await step(tok);                                   // 2:07:11 像剪頭髮：左右要差不多長
  bub('像理髮：左右兩邊要剪得差不多', 3.6, 6.0);
  say('就像剪頭髮', '左邊和右邊要差不多長，才不會歪一邊');
  await step(tok);                                   // 2:07:37 左高寫 hL、右高寫 hR
  showH = true; set(hl, hr);
  say('每次寫「左邊的高度」太長', '簡寫成 hL、hR');
  await step(tok);                                   // 2:08:04 balance factor：bf = hL − hR
  showB = true; set(hl, hr);
  say('BF 不是 boyfriend', 'balance factor：<span class="ok">bf = hL − hR</span>');
  await step(tok);                                   // 2:08:22 可能一：一樣高 → 0
  say('AVL 裡 bf 只有三種可能', '一樣高：bf = 0');
  await step(tok);                                   // 2:08:27 左邊高一點 → +1
  await to(3, 2);
  say('左邊高一點', 'bf = +1，OK');
  await step(tok);                                   // 2:08:32 右邊高一點 → −1
  await to(2, 3);
  say('右邊高一點', 'bf = −1，OK');
  await step(tok);                                   // 2:08:40 所有維護都在保持這三種值
  await to(1, 3);
  noT('差 2 → 不行，要調整', 2.6, 1.0, 0.8);
  say('一切的維護，都是為了讓 bf 留在 −1、0、+1', '像這樣差 2（bf = −2）就要修');
  await step(tok);                                   // 2:09:00 先講特例，再講通例
  await to(2, 3);
  bub('先看特例 → 再看通例', 0, 0.2, 1.0);
  say('講解的流程', '先看特例，順便熟悉 BST insertion；再講通例');
}]);

// ═════════ 16. 特例：依序插入 3、5、8 ═════════
async function walkIn(tok, tv, t, b, k, firstAt) {
  // the key (a buddy) walks the search path, then becomes a node where the search fails
  const path = pathTo(t, k);
  if (!path.length) await hopTo(tok, b, firstAt, 700);
  for (const x of path) await hopTo(tok, b, tv.top(x), 380);
}
function place(tv, t, b, k) { kill(b.g); bstIns(t, k); tv.sync(k); }
FRAG.push(['bstlin-avl-358', 'AVL 特例：插入 3、5、8 → 把 5 拉起來', async (tok) => {
  fresh([0, 5, 12], [0, 3, 0]);
  const t = { root: null }; const tv = TV(t, { cx: 0.6, dx: 1.6, dy: 1.5, top: 5.6 });
  say('先看一個特例', '');
  await step(tok);                                   // 2:09:44 依序插入 3、5、8
  const q = { 3: '#5b5b5b', 5: '#7cb8ee', 8: '#e57373' };
  const kb = {}; [3, 5, 8].forEach((k, i) => { kb[k] = buddy(null, k, q[k], -5.6 + i * 0.85, 0.2, 1.0, 0.6); });
  say('依序插入 3、5、8', '每插一個，就看看 balance factor');
  await step(tok);                                   // 2:10:24 只有 3：空樹插一個
  await walkIn(tok, tv, t, kb[3], 3, V3(0.6, 6.1, 0)); place(tv, t, kb[3], 3);
  say('insert 3：空的樹插一個', '它就待在 root');
  await step(tok);                                   // 2:10:35 bf(3) = 0 − 0 = 0
  tv.bf([3]);
  note('hL = 0、hR = 0', 2.4, 6.4);
  say('左右都是空的：高度 0 和 0', 'bf(3) = 0 − 0 = 0');
  await step(tok);                                   // 2:10:55 插入 5
  await hopTo(tok, kb[5], tv.top(3), 900);
  say('insert 5', '');
  await step(tok);                                   // 2:11:00 insertion = search：該找到卻找不到的地方
  await hopTo(tok, kb[5], V3(tv.P.get(3).x + 0.9, 5.6 - 1.5 + 0.43, 0), 600);
  bub('3 的右邊找不到 5 → 就放這裡', 3.6, 4.8);
  say('BST 的 insertion 跟 search 是同一回事', '5 > 3 → 去 3 的右邊找 → 找不到');
  await step(tok);                                   // 2:11:21 放在那裡
  place(tv, t, kb[5], 5);
  say('「該找到它卻找不到」的地方', '就是要放它的地方');
  await step(tok);                                   // 2:11:41 bf(5) = 0、bf(3) = −1
  tv.bf([5, 3]);
  say('bf(5) = 0', 'bf(3) = 0 − 1 = −1');
  await step(tok);                                   // 2:12:19 還是 AVL：沒什麼好 maintain
  okT('還是 AVL ✓', -2.6, 6.2);
  say('−1 還是合法的', '大部分時候 AVL 的 insertion 就是 BST 的 insertion');
  await step(tok);                                   // 2:12:31 insert 8：比 3 大、比 5 大
  await walkIn(tok, tv, t, kb[8], 8);
  say('insert 8：比 3 大走右邊', '又比 5 大，再走右邊');
  await step(tok);                                   // 2:12:53 放進去
  place(tv, t, kb[8], 8);
  say('找不到 8 了', '這就是 8 該放的位置');
  await step(tok);                                   // 2:13:02 bf(8) = 0、bf(5) = −1
  tv.bf([8, 5]);
  say('bf(8) = 0（沒有小孩）', 'bf(5)：左邊沒有、右邊有 → −1');
  await step(tok);                                   // 2:13:11 bf(3) = 0 − 2 = −2
  tv.bf([3]);
  say('bf(3)：左邊 0，右邊高度 2', '0 − 2 = <span class="no">−2</span>');
  await step(tok);                                   // 2:13:20 違反 AVL 的規則
  noT('bf 只能是 −1、0、+1 → 違反！', -2.6, 5.4);
  say('出問題了', '違反 AVL tree 的規則，需要調整');
  await step(tok);                                   // 2:13:56 一長串：從中間的 5 拉起來
  glow(tv.c(5), GOLD);
  const hk = pkt('從 5 拎起來（像拎葡萄）', tv.P.get(5).x + 0.4, tv.P.get(5).y + 1.2);
  say('它變成一長串了', '從中間的 5 把它拉起來');
  await step(tok);                                   // 2:14:36 5 當新的 root：左 3、右 8
  kill(hk);
  tv.hide(); glow(tv.c(5), null); rotUp(t, t.root, 'L'); tv.sync();
  say('讓 5 當新的 root', '左邊 3、右邊 8：從 5 進去，左右都只要再比一次');
  await step(tok);                                   // 2:15:10 bf 全部 = 0
  tv.bf([8, 3, 5]);
  okT('全部 bf = 0，恢復 AVL ✓', -2.6, 6.2);
  say('調整後：8、3 的 bf = 0', '5 左右各 1 → bf = 0');
  await step(tok);                                   // 2:15:51 只有 4 種情形，兩兩對稱
  ['RR', 'LL', 'RL', 'LR'].forEach((c, i) => tag(c, i < 2 ? 'ptr alt' : 'ptr', -4.8 + i * 1.0, 1.0, 0.8));
  say('要調整的情形大體上只有 4 種', '而且兩兩對稱 → 學會 2 種就夠');
  await step(tok);                                   // 2:16:19 樹高 log n → search、insert 都 log n
  bub('樹高 = O(log n) → search、insert 都 O(log n)', 1.2, 0.2, 1.0);
  say('每個 node 左右都差不多高', '可以證明樹高是 log n：search / insert 都 <span class="ok">O(log n)</span>');
}]);

// ═════════ 17–19. RR 通例：A、B、AL、BL、BR ═════════
const LVH = 1.2, BS = 0.75;
const RRPOS = {
  before: { A: [-1, 6.0], B: [1.4, 4.8], AL: [-2.6, 5.4], BL: [0.2, 4.2], BR: [2.6, 4.2] },
  after: { B: [0.6, 6.0], A: [-1.4, 4.8], AL: [-2.9, 4.2], BL: [-0.2, 4.2], BR: [2.1, 5.4] },
};
function rrKit(o = {}) {
  const oy = o.oy || 0;
  const k = { state: 'before', es: [] };
  const P = (n, st) => { const [x, y] = RRPOS[st || k.state][n]; return [x, y + oy]; };
  k.nodeAt = (n, st) => { const [x, y] = P(n, st); return V3(x, y - BS / 2, 0); };
  k.subAt = (n, st) => { const [x, top] = P(n, st); return V3(x, top - LVH / 2, 0); };
  k.mk = (n) => {
    if (n === 'A' || n === 'B') { const p = k.nodeAt(n); k[n] = buddy(null, n, n === 'A' ? '#7cb8ee' : '#f4a56a', p.x, p.y, 0, BS); return k[n]; }
    const m = ghostBox({ AL: '#2fc092', BL: '#9b7ef4', BR: '#31aab0' }[n], 1.2, LVH, 1.2); m.position.copy(k.subAt(n));
    const l = lab.label(n, 'idx'); l.position.set(0, 0, 0.7); m.add(l); m.userData.l = l;
    k[n] = m; return m;
  };
  k.name = (n, s, cls = 'idx') => { txt(k[n].userData.l, s); k[n].userData.l.element.className = 'lab-label ' + cls; };
  k.slab = (drop = true) => {
    const p = k.subAt('BR'); const to = V3(p.x, p.y - LVH, 0);
    k.N = cube('新', '#d64545', [1.1, LVH * 0.9, 1.0], to.x, to.y + (drop ? 2.5 : 0), 0);
    return drop ? (tok) => travel(tok, k.N, k.N.position.clone(), to, 600) : null;
  };
  k.cen = (n) => (n === 'A' || n === 'B' ? k[n].g.position.clone().add(V3(0, BS / 2, 0)) : k[n].position.clone().add(V3(0, LVH / 2, 0)));
  k.edges = (hi = []) => {
    k.es.forEach(kill); k.es = [];
    const pairs = k.state === 'before' ? [['A', 'AL'], ['A', 'B'], ['B', 'BL'], ['B', 'BR']] : [['B', 'A'], ['B', 'BR'], ['A', 'AL'], ['A', 'BL']];
    for (const [a, b] of pairs) { if (!k[a] || !k[b]) continue; const p = k.cen(a), q = k.cen(b); k.es.push(line(p.x, p.y, q.x, q.y, -0.1, hi.includes(a + b) ? '#d64545' : '#a99470')); }
  };
  k.bf = (n, v) => {
    let t = k['bf' + n]; if (!t) { t = tag('', 'idx', 0, 0, 0); k['bf' + n] = t; }
    const c = k.cen(n); t.position.set(c.x + 0.8, c.y + 0.45, 0);
    txt(t, 'bf ' + v); t.element.className = 'lab-label ' + (String(v).includes('2') ? 'ptr' : 'idx');
  };
  k.go = async (tok, names, ms = 900) => {
    k.es.forEach(kill); k.es = [];
    const list = names.map((n) => {
      if (n === 'A' || n === 'B') return [k[n].g, k.nodeAt(n, 'after')];
      if (n === 'N') { const p = k.subAt('BR', 'after'); return [k.N, V3(p.x, p.y - LVH, 0)]; }
      return [k[n], k.subAt(n, 'after')];
    });
    await moveAll(tok, list, ms);
  };
  k.all = () => { ['A', 'B', 'AL', 'BL', 'BR'].forEach(k.mk); k.edges(); };
  return k;
}
FRAG.push(['bstlin-rr-general', 'AVL 的 RR：rotate(A, B) 只改兩個 pointer', async (tok) => {
  fresh([0, 5, 13], [0, 3.6, 0]);
  const k = rrKit();
  const mini = [[3, 4.4, 6.6], [5, 5.1, 5.9], [8, 5.8, 5.2]].map(([v, x, y]) => cube(v, colorFor(v), [0.45, 0.45, 0.45], x, y, 0));
  line(4.4, 6.6, 5.1, 5.9, 0); line(5.1, 5.9, 5.8, 5.2, 0);
  say('從 3、5、8 的特例出發', '');
  await step(tok);                                   // 2:18:28 通例：圖要複雜一點
  tag('特例：3 5 8', 'idx', 5.1, 7.1, 0);
  say('來看通例', '剛才的圖複製一份放旁邊對照');
  await step(tok);                                   // 2:19:27 3 的位置叫 A
  k.mk('A'); glow(mini[0], GOLD);
  say('剛才 3 所在的位置', '這個 node 叫 A');
  await step(tok);                                   // 2:19:36 5 的位置叫 B
  k.mk('B'); k.edges(); glow(mini[0], null); glow(mini[1], GOLD);
  say('剛才 5 所在的位置', '這個 node 叫 B');
  await step(tok);                                   // 2:19:52 每個 node 都可能有 subtree
  glow(mini[1], null);
  bub('每個 node 下面都可能掛著一棵 subtree', -3.2, 7.0);
  say('通例不能只畫幾個 node', '每個 node 下面都可能有 subtree');
  await step(tok);                                   // 2:20:13 B 的左 subtree：BL
  k.mk('BL'); k.edges();
  say('B 的左邊 subtree', '叫 BL（B 的 Left）');
  await step(tok);                                   // 2:20:41 B 的右 subtree：BR
  k.mk('BR'); k.edges(); glow(mini[2], GOLD);
  say('剛才 8 的位置在 B 的右邊', '這棵叫 BR');
  await step(tok);                                   // 2:20:50 原來 B 是平衡的
  glow(mini[2], null);
  k.bf('B', 0);
  say('原來 B 是平衡的', 'BL 和 BR 一樣高 → bf(B) = 0');
  await step(tok);                                   // 2:21:19 insert 進 BR：多了一層
  await k.slab()(tok);
  say('insert 進 BR', 'BR 多了一層');
  await step(tok);                                   // 2:21:30 A 的左邊 AL 太矮了
  k.mk('AL'); k.edges();
  say('再看 A 的左邊 subtree：AL', '跟右邊比起來太矮了');
  await step(tok);                                   // 2:21:46 差 2 → bf(A) = −2
  const gap = [line(-3.6, 4.2, -3.6, 1.8, 0.4, '#d64545'), noT('差 2 層', -4.4, 3.0, 0.4)];
  k.bf('A', -2); k.A.mood('sad'); k.A.glow('#5a0000');
  say('AL 的底和 BR（加新的一層）的底', '差了 2 → <span class="no">bf(A) = −2</span>');
  await step(tok);                                   // 2:22:19 bf(B) = −1
  k.bf('B', -1);
  say('B 自己還好', 'BL 和 BR 差 1 → bf(B) = −1');
  await step(tok);                                   // 2:22:35 把 B 放到上面
  gap.forEach(kill);
  const up = pkt('B 拉上來 ↑', 2.4, 5.6); k.B.glow('#3a2a00');
  say('維護：剛才是把 5 拉起來', '通例就是把 B 拉上來');
  await step(tok);                                   // 2:22:55 A 滾下去
  kill(up); k.B.glow(null); k.A.glow(null);
  await k.go(tok, ['A', 'B'], 1000);
  k.bf('A', -2); k.bf('B', -1);
  say('B 拉上來，A 就滾下去', 'B 當 root 比較公正：兩邊高度比較接近');
  await step(tok);                                   // 2:23:48 A 往下一層，AL 跟著往下
  await k.go(tok, ['AL'], 700);
  say('A 往下一層', '它帶的左邊 AL 也跟著往下一層');
  await step(tok);                                   // 2:24:08 BR 跟著 B 往上一層
  await k.go(tok, ['BR', 'N'], 700);
  say('B 往上一層', 'BR（連同新的那一層）也跟著往上');
  await step(tok);                                   // 2:24:55 AL 底和 BR 底切齊了
  const lvl = line(-4.0, 3.0, 3.6, 3.0, 0.7, '#2fc092');
  say('剛才最不平衡的：AL 的底和 BR 的底', '現在切齊了');
  await step(tok);                                   // 2:25:04 BL 要去哪？
  kill(lvl);
  k.name('BL', 'BL 要去哪？', 'ptr alt');
  say('還沒處理的：BL', '它原本是 B 的左小孩，現在 A 佔了那個位置');
  await step(tok);                                   // 2:25:25 BL 比 A 大、比 B 小 → A 的右邊
  await k.go(tok, ['BL'], 900);
  k.state = 'after'; k.edges();
  k.name('BL', 'BL：A < BL < B');
  say('BL 裡的資料：比 A 大、比 B 小', '所以它一定在 A 的右邊');
  await step(tok);                                   // 2:26:27 bf(A) = 0
  k.bf('A', 0); k.A.mood('happy');
  say('重新檢查：只有 A、B 的 bf 會變', 'A：左邊 AL、右邊 BL 切得很齊 → bf(A) = 0');
  await step(tok);                                   // 2:26:36 bf(B) = 0
  k.bf('B', 0); k.B.mood('happy');
  say('B：左右切得很齊', 'bf(B) = 0，跟 3 5 8 的特例一致');
  await step(tok);                                   // 2:26:54 不變的：AL 在 A 左、BR 在 B 右
  k.name('BL', 'BL');
  okT('AL 還在 A 的左邊', -2.9, 2.5); okT('BR 還在 B 的右邊', 2.4, 3.7);
  say('先看不變的', 'AL 還在 A 的左邊、BR 還在 B 的右邊');
  await step(tok);                                   // 2:27:16 變的只有兩個 link
  k.edges(['BA', 'ABL']);
  say('A、B 之間只變了兩個 link（紅線）', '另外原本指向 A 的那張紙條（A 的 parent）要改指向 B');
  await step(tok);                                   // 2:27:39 A.right = B.left
  const cd = code(['A.right = B.left;', 'B.left  = A;'], 4.4, 1.6, 0.56);
  cd.hl(0);
  say('A 的右邊紙條', '換成 B 原來的左邊：A.right = B.left');
  await step(tok);                                   // 2:27:56 B.left = A
  cd.hl(1);
  say('B 的左邊', '變成 A：B.left = A');
  await step(tok);                                   // 2:28:32 rotate(A, B)：B 逆時針轉上去
  cd.hl(-1);
  bub('↺ rotate(A, B)：B 逆時針轉上去當 root', 2.6, 7.0);
  say('這兩行叫 rotate(A, B)', '想像 A 不動，B 逆時針轉上去');
  await step(tok);                                   // 2:29:01 這種情形叫 RR
  tag('RR', 'pkt', -4.6, 6.6, 0);
  say('這種情形叫 <span class="ok">RR</span>', '不平衡發生在 A 的右邊的右邊');
}]);
FRAG.push(['bstlin-rr-once', 'AVL insertion：找到第一個失衡點，轉一次就結束', async (tok) => {
  fresh([0, 5.4, 13.5], [0, 3.6, 0]);
  const k = rrKit({ oy: -0.4 }); k.all();
  const PX = -2.9, PY = 6.6;
  const par = cube('…', '#d8cfc0', [0.6, 0.6, 0.6], PX, PY, 0);
  let pe = line(PX, PY, k.cen('A').x, k.cen('A').y, -0.1);
  k.bf('A', -1); k.bf('B', 0);
  say('真正的 AVL insertion 是這樣做的', '');
  await step(tok);                                   // 2:29:21 先做 BST insertion：找找找
  const r = rider('新', V3(PX - 0.8, PY + 0.2, 0));
  const br = k.subAt('BR');
  await hops(tok, r, [V3(PX, PY + 0.3, 0), k.cen('A').add(V3(0, 0.4, 0)), k.cen('B').add(V3(0, 0.4, 0)), V3(br.x, br.y + 0.7, 0.4), V3(br.x, br.y - LVH + 0.2, 0.6)], 400);
  say('先做 binary search tree 的 insertion', '一路找下去，找到要放的地方');
  await step(tok);                                   // 2:29:26 紅色這裡是 insert 的地方
  kill(r.g);
  await k.slab()(tok);
  say('紅色這一層就是 insert 進來的', '');
  await step(tok);                                   // 2:29:34 這條 path 上的 bf 可能改變
  glow(par, GOLD); k.A.glow('#3a2a00'); k.B.glow('#3a2a00');
  say('insert 之後', '這條 path 上的 balance factor 可能會變');
  await step(tok);                                   // 2:29:39 一個一個往回重算 bf
  glow(par, null); k.A.glow(null); k.B.glow(null);
  const pk = pkt('↑ 重算 bf', br.x + 0.9, br.y);
  await travel(tok, pk, pk.position.clone(), k.cen('B').add(V3(0.9, 0, 0)), 700);
  k.bf('B', -1);
  await travel(tok, pk, pk.position.clone(), k.cen('A').add(V3(0.9, 0, 0)), 700);
  say('從下往上，一個一個重算 bf', 'B 變 −1，還可以……');
  await step(tok);                                   // 2:29:45 A：第一個失衡點
  kill(pk);
  k.bf('A', -2); k.A.mood('sad'); k.A.glow('#5a0000');
  say('算到 A：不平衡了', '<span class="no">bf(A) = −2</span>，A 是第一個失衡點');
  await step(tok);                                   // 2:29:52 插在 A 的右邊的右邊
  const rr = [pkt('R', (k.cen('A').x + k.cen('B').x) / 2 + 0.3, (k.cen('A').y + k.cen('B').y) / 2 + 0.2), pkt('R', (k.cen('B').x + br.x) / 2 + 0.4, (k.cen('B').y + br.y + 0.6) / 2)];
  say('insert 到哪裡了？', '相對 A：往右、再往右的 subtree → RR');
  await step(tok);                                   // 2:30:06 rotate(A, B)
  rr.forEach(kill); k.A.glow(null);
  await k.go(tok, ['A', 'B', 'AL', 'BL', 'BR', 'N'], 1500);
  k.state = 'after'; k.edges();
  kill(pe); pe = line(PX, PY, k.cen('B').x, k.cen('B').y, -0.1);
  k.bf('A', 0); k.bf('B', 0);
  say('需要的調整：rotate(A, B)', '');
  await step(tok);                                   // 2:30:14 A、B 平衡了，其他 subtree 不動
  k.A.mood('happy'); k.B.mood('happy');
  say('轉完：B 平衡了，A 也平衡了', '其他的 subtree 都不動');
  await step(tok);                                   // 2:30:51 上面的 bf 會不會變？
  bub('上面還要再修嗎？', PX - 0.6, PY + 0.8);
  say('理論上還要往上追', '但上面的 bf 其實不會變。為什麼？');
  await step(tok);                                   // 2:31:04 insert 讓這棵多了一層
  const orig = line(-4.6, 3.0 - 0.4, 3.6, 3.0 - 0.4, 0.7, '#2fc092');
  const lab1 = tag('insert 前這棵 subtree 的底', 'idx', -4.4, 2.9 - 0.4, 0.7);
  const ghostLow = line(1.6, 1.8 - 0.4, 3.0, 1.8 - 0.4, 0.7, '#d64545');
  say('insert 進來時', '這棵 subtree 比原來多了一層（紅線）→ 才會不平衡');
  await step(tok);                                   // 2:31:24 調整後高度跟原來一模一樣
  kill(ghostLow);
  okT('轉完：頂端還在原處，底端切齊原本的線 → 高度不變', 0, -0.4, 1.0);
  say('調整完，這棵樹的高度？', '跟 insert 前一模一樣');
  await step(tok);                                   // 2:31:42 上面的 bf 通通不會變：轉一次就結束
  kill(orig); kill(lab1);
  glow(par, GREEN);
  say('高度沒變 → 再往上的 bf 通通不會變', '找到第一個出錯的地方，<span class="ok">調整一次就結束</span>');
  await step(tok);                                   // 2:32:29 RR：insert 在右邊的右邊
  tag('RR：插在失衡點的右邊的右邊', 'pkt', 0, 7.3, 0);
  say('這就是 AVL 的 RR 情形', '只對失衡點做一次調整就解決');
  await step(tok);                                   // 2:32:42 對稱：LL 也一樣
  const mx = 4.6, my = 6.6;
  [[mx, my], [mx - 0.6, my - 0.7], [mx - 1.2, my - 1.4]].forEach(([x, y], i) => cube(['A', 'B', '新'][i], ['#7cb8ee', '#f4a56a', '#d64545'][i], [0.42, 0.42, 0.42], x, y, 0));
  line(mx, my, mx - 1.2, my - 1.4, -0.1);
  tag('LL：左邊的左邊（對稱）', 'idx', mx - 0.6, my + 0.6, 0);
  say('對稱地：插在左邊的左邊（LL）', '一樣一次 rotation 解決');
}]);
FRAG.push(['bstlin-rr-height', 'RR 為什麼一次就夠：高度 10、11 的數字版', async (tok) => {
  fresh([0, 5, 13], [0, 3.6, 0]);
  const k = rrKit(); k.all(); k.slab(false);
  k.bf('A', -2); k.bf('B', -1); k.A.mood('sad');
  const kid = buddy('同學', '?', '#9fd6a8', 5.4, 3.6, 0, 0.7);
  say('同學問了一個好問題', '');
  await step(tok);                                   // 2:34:10 BL 接到 A 的右邊，bf 不會變 2 嗎？
  kid.mood('wow');
  bub('BL 接到 A 的右邊，bf 不會變 2 嗎？', 3.6, 5.2);
  say('BL 接到 A 的右邊', 'A 的 bf 會不會變成 2？');
  await step(tok);                                   // 2:34:17 BL 要跟 AL 比
  k.name('AL', 'AL', 'ptr alt'); k.name('BL', 'BL', 'ptr alt');
  say('BL 接過去後，要比的對象是 AL', '所以要看 AL 和 BL 原本的高度');
  await step(tok);                                   // 2:34:40 之前 A 兩邊最多差 1
  k.name('AL', 'AL'); k.name('BL', 'BL');
  say('insert 前：A 兩邊最多差 1', '不然 A 早在上一輪就不平衡了');
  await step(tok);                                   // 2:34:57 要差到 2，原本就差 1
  k.bf('A', '−1 → −2');
  const d1 = [line(-3.6, 4.2, 0.9, 4.2, 0.7, '#a8730f'), line(-0.6, 3.0, 0.9, 3.0, 0.7, '#a8730f'), noT('差 1', -1.5, 3.6, 0.7)];
  say('A 會差到 2，表示它原本就是 −1', 'AL 的底和 BL 的底，本來就差 1 層');
  await step(tok);                                   // 2:35:16 數字：BL 高 10
  d1.forEach(kill);
  k.name('BL', 'BL  h = 10'); k.name('BR', 'BR  h = 10');
  say('用數字看：BL 高度 10', 'BR 也是 10（B 原本平衡）');
  await step(tok);                                   // 2:35:27 B 這層 11，AL 是 10
  k.name('AL', 'AL  h = 10');
  const hb = tag('B 這棵：11', 'ptr alt', 2.4, 5.6, 0);
  say('B 這一層整棵高 11', 'AL 跟 B 同一級 → AL 高 10（A 原本 bf = 10 − 11 = −1）');
  await step(tok);                                   // 2:35:35 轉完：AL 和 BL 10 對 10
  kill(hb);
  k.name('BR', 'BR + 新 = 11');
  await k.go(tok, ['A', 'B', 'AL', 'BL', 'BR', 'N'], 1500);
  k.state = 'after'; k.edges();
  say('轉完之後', 'A 下面：AL 和 BL 是 10 對 10');
  await step(tok);                                   // 2:35:42 bf(A) = 0；BL 不會原本就比較高
  k.bf('A', 0); k.bf('B', 0); k.A.mood('happy');
  say('bf(A) = 10 − 10 = 0', 'BL 也不會原本就比較高：那之前就違規了');
  await step(tok);                                   // 2:36:14 BL 會不會少一層？
  k.name('BL', 'BL  h = 9 ?', 'ptr alt');
  kid.mood('wow');
  say('那 BL 會不會矮一層（9）？', '');
  await step(tok);                                   // 2:36:22 那 B 自己就先不平衡
  const bad = noT('BL = 9、BR + 新 = 11 → B 自己先 −2', 2.0, 7.0); k.B.mood('sad');
  say('如果 BL 是 9，BR 插完變 11', '那 B 自己就先不平衡，第一個失衡點會是 B，不是 A');
  await step(tok);                                   // 2:36:37 所以 BL 一定是 10，AL = BL
  kill(bad); k.B.mood('happy'); kid.mood('happy');
  k.name('BL', 'BL  h = 10');
  okT('A 是第一個失衡點 → BL 一定 = 10 = AL', -1.2, 1.6, 0.6);
  say('既然第一個失衡點是 A', 'BL 一定跟圖上畫的一樣高：AL、BL 一樣高');
  await step(tok);                                   // 2:37:05 不像 strict 的 array：只轉一次
  okT('其他 subtree 都留在原處', -2.4, 7.1);
  say('不像 complete（strict）那樣', '只轉一次，其他 subtree 都不動：沒有一對一對應 array，有自由度');
  await step(tok);                                   // 2:37:53 一個步驟、兩個 pointer
  k.edges(['BA', 'ABL']);
  say('只需要一個修改步驟', '只改常數張小紙條：兩個 link，加上 parent 指向新的 root');
  await step(tok);                                   // 2:38:18 成本跟樹高有關：從下往上找
  tag('↓ insertion：從上往下', 'ptr', -5.0, 2.6, 0); tag('↑ 維護：從下往上找第一個', 'ptr alt', -5.0, 2.0, 0);
  say('便宜：力氣只花在樹裡上上下下', 'insert 從上往下；維護從下往上，找到第一個要修的地方轉回來');
}]);

// ═════════ 20. 完整例子：依序插入 1 … 7 ═════════
FRAG.push(['bstlin-avl-1to7', 'AVL 依序插入 1, 2, 3, 4, 5, 6, 7', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.8, 0]);
  const t = { root: null }; const tv = TV(t, { cx: 0.8, dx: 1.15, dy: 1.45, top: 5.6 });
  const kb = {}; const tmp = [];
  const clr = () => { tmp.forEach(kill); tmp.length = 0; };
  const ins = async (k) => { clr(); await walkIn(tok, tv, t, kb[k], k, V3(0.8, 6.1, 0)); place(tv, t, kb[k], k); };
  const rrTag = (a) => { const p = tv.P.get(a); tmp.push(pkt('RR', p.x + 0.6, p.y + 1.0)); };
  const rot = (a) => { clr(); rotUp(t, findN(t, a), 'L'); tv.sync(); tv.bf(tv.all()); };
  say('一個完整的例子', '');
  await step(tok);                                   // 2:39:09 依序塞 1 到 7
  for (let k = 1; k <= 7; k++) kb[k] = buddy(null, k, '#f4d7a1', -6.0 + (k - 1) * 0.7, -0.3, 1.2, 0.5);
  say('依序把 1、2、3、4、5、6、7', '塞進 AVL tree');
  await step(tok);                                   // 2:39:26 insert 1
  await ins(1); tv.bf(tv.all());
  say('insert 1', '沒什麼問題');
  await step(tok);                                   // 2:39:33 insert 2：放在 1 的右邊
  await ins(2); tv.bf(tv.all());
  say('insert 2：放在 1 的右邊', '沒有違反 AVL 的性質');
  await step(tok);                                   // 2:39:48 insert 3
  await ins(3);
  say('insert 3：1、2、3', '');
  await step(tok);                                   // 2:39:52 從 3 往上找：1 的 bf = −2
  tv.bf([3, 2, 1]);
  say('從 3 往上找回來', '在 1 這裡：<span class="no">bf = −2</span>');
  await step(tok);                                   // 2:40:08 3 在 1 的右邊的右邊 → RR
  rrTag(1);
  say('3 相對於 1 在哪？', '右邊的右邊 → 啟動 RR 的救援');
  await step(tok);                                   // 2:40:28 1、2 一個上來一個下去
  rot(1);
  say('修正 1 和 2 的關係', '2 上來、1 下去；3 不變 → 世界和平');
  await step(tok);                                   // 2:40:52 insert 4：比 2 大、比 3 大
  await ins(4);
  say('insert 4：比 2 大、比 3 大', '放在 3 的右邊');
  await step(tok);                                   // 2:41:14 往回看：4、3、2 都平衡
  tv.bf(tv.all());
  say('找回來：4 平衡；3 是 0 和 1；2 是 1 和 2', '都沒問題');
  await step(tok);                                   // 2:41:25 insert 5
  await ins(5);
  say('insert 5：2 的右邊到 3、3 的右邊到 4', '4 的右邊沒東西 → 放進來');
  await step(tok);                                   // 2:41:49 5、4 平衡，3 出問題
  tv.bf([5, 4, 3]); rrTag(3);
  say('5 平衡、4 平衡，3 又出了問題', 'bf = −2；5 在 3 的右邊的右邊 → RR');
  await step(tok);                                   // 2:42:15 4 提上來、3 轉下去
  rot(3);
  say('修正 3 和它的右邊', '4 提起來當新的 root，3 轉下去');
  await step(tok);                                   // 2:42:47 subtree 高度不變 → 上面沒影響
  tmp.push(okT('這棵 subtree 高度：插 5 前 2，插完還是 2', 2.2, 1.0, 0.6));
  say('5、4、3 都平衡了', '這棵 subtree 高度沒變 → 2 號、1 號的生活完全沒變');
  await step(tok);                                   // 2:43:46 insert 6
  await ins(6);
  say('insert 6', '');
  await step(tok);                                   // 2:43:55 往上：5、4 沒有不平衡
  tv.bf([6, 5, 4]);
  say('往上找：5 沒有不平衡', '4 也沒有不平衡');
  await step(tok);                                   // 2:44:06 2：左高 1、右高 3
  tv.bf([2, 1, 3]); rrTag(2);
  say('再往上到 2：左邊高 1、右邊高 3', '<span class="no">bf = −2</span>；不平衡在 2 的右邊的右邊');
  await step(tok);                                   // 2:44:33 旋轉 2 和 4
  rot(2);
  say('修正 2 和它的右邊 4', '旋轉：4 在上面、2 在下面');
  await step(tok);                                   // 2:44:56 1、5、6 不變；3 接到 2 的右邊
  glow(tv.c(3), GOLD);
  tmp.push(note('原本 4 的左子樹 3 → 接到 2 的右邊', tv.P.get(3).x, tv.P.get(3).y - 0.9, 0.6));
  say('1 沒變，5、6 也沒變', '變的只有：原本 4 左邊的 3，要接到 2 的右邊');
  await step(tok);                                   // 2:45:23 insert 7
  glow(tv.c(3), null);
  await ins(7);
  say('insert 7：比 4、5、6 都大', '一路往右放');
  await step(tok);                                   // 2:45:55 7、6 沒事，5 不平衡
  tv.bf([7, 6, 5]);
  say('找回去：7、6 沒有不平衡', '5 不平衡了');
  await step(tok);                                   // 2:46:01 不平衡來源：右邊的右邊
  rrTag(5);
  say('不平衡的來源', '右邊的右邊 → RR');
  await step(tok);                                   // 2:46:08 6 上來當 root、5 變小弟
  rot(5);
  say('調整 5 和它的右邊', '6 上來當這棵的 root，5 變成它的小弟');
  await step(tok);                                   // 2:46:25 樹高維持 → 上面不用動
  say('7 沒變；樹高維持', '再往上也不用做任何事');
  await step(tok);                                   // 2:46:42 得到一棵完美的樹
  tmp.push(okT('1~7 → 一棵 full binary tree', 0.8, 0.4, 0.6));
  say('1 到 7 全部放進去', '得到一棵非常完美的 complete（也是 full）binary tree');
  await step(tok);                                   // 2:46:49 過程中沒有堅持 complete
  say('但過程中我們沒有堅持 complete', 'AVL 比 complete 鬆，只是這個例子剛好長得完美');
  await step(tok);                                   // 2:47:12 RR / LL：一次調整就恢復
  bub('RR（右右）、LL（左左）：一次調整就恢復 AVL', 0.8, 7.1);
  say('錯誤發生在右邊的右邊、或左邊的左邊', '一次調整，就能恢復 AVL 的性質');
}]);

// ═════════ 21. 小結：bf 怎麼算得快 ═════════
FRAG.push(['bstlin-avl-height-store', 'AVL 小結：每個 node 存 hL、hR', async (tok) => {
  fresh([0, 5, 12.5], [0, 2.8, 0]);
  const t = { root: null }; [4, 2, 6, 1, 3, 5, 7].forEach((k) => bstIns(t, k));
  const tv = TV(t, { dx: 1.2, dy: 1.45, top: 5.6 }); tv.sync();
  say('最後小結', '');
  await step(tok);                                   // 2:47:54 還差 RL、LR：下次上課
  tag('RR ✓', 'good', -5.2, 6.2); tag('LL ✓', 'good', -5.2, 5.6); tag('RL：下次', 'ptr', -5.2, 5.0); tag('LR：下次', 'ptr', -5.2, 4.4);
  say('還差：插在右邊的左邊、左邊的右邊', 'RL、LR 稍微複雜，下次上課講');
  await step(tok);                                   // 2:48:14 BST search：順著樹做 binary search
  const r = rider('5', V3(-1.4, 6.3, 0));
  for (const k of [4, 6, 5]) { await hopTo(tok, r, tv.top(k), 420); glow(tv.c(k), k === 5 ? GREEN : GOLD); }
  say('BST 的 search', '順著這棵樹做 binary search');
  await step(tok);                                   // 2:48:24 insertion：search 不到的地方放進去；AVL 多一步調整
  [4, 6, 5].forEach((k) => glow(tv.c(k), null));
  r.set('8'); r.mood('wow'); r.g.position.set(-1.4, 6.3, 0);
  for (const k of [4, 6, 7]) await hopTo(tok, r, tv.top(k), 380);
  await hopTo(tok, r, V3(tv.P.get(7).x + 0.6, tv.P.get(7).y - 1.2, 0), 380);
  say('insertion：search 不到的地方就放進去', 'AVL 在 insertion 完多加一步調整');
  await step(tok);                                   // 2:48:39 RR、LL：只牽涉兩個 node
  kill(r.g);
  glow(tv.c(6), GOLD); glow(tv.c(7), GOLD);
  say('RR、LL 的調整', '都只牽涉兩個 node，其他 node 完全不受影響');
  await step(tok);                                   // 2:49:06 同學：它只在乎平衡？其實一直在排序
  glow(tv.c(6), null); glow(tv.c(7), null);
  bub('每次決定往左往右，都在跟 node 比大小 = 排序', 0, 7.0);
  say('同學：這棵樹只在乎平不平衡？', '其實插入和 search 時一直在比大小，就是在排序');
  await step(tok);                                   // 2:49:34 bf 怎麼算得快？
  const kid = buddy('同學', '?', '#9fd6a8', 5.4, 0.2, 1.0, 0.7); kid.mood('wow');
  say('另一個問題', '計算 balance factor 的時間複雜度是多少？');
  await step(tok);                                   // 2:49:42 不是存節點總數，是存兩邊的樹高
  bub('存的是左右兩邊的「高度」（不是 node 數）', 5.0, 1.6, 1.0);
  say('同學說：把左右的 node 總數存起來？', '其實要存的是左右兩邊的樹高');
  await step(tok);                                   // 2:49:59 每個 node 存 (hL, hR)
  kid.mood('happy');
  (function w(n) { if (!n) return; const p = tv.P.get(n.k); tag('(' + hgt(n.l) + ', ' + hgt(n.r) + ')', 'idx', p.x + 0.85, p.y + 0.45, 0); w(n.l); w(n.r); })(t.root);
  say('每個 node 多存 (hL, hR)', 'bf = hL − hR，一減就有：<span class="ok">O(1)</span>');
  await step(tok);                                   // 2:50:11 insertion 只改 root → leaf 那條 path
  const g8 = cube('8', '#d8cfc0', [0.7, 0.7, 0.7], tv.P.get(7).x + 0.6, tv.P.get(7).y - 1.3, 0);
  line(tv.P.get(7).x, tv.P.get(7).y, g8.position.x, g8.position.y, -0.1, '#d64545');
  for (const k of [4, 6, 7]) glow(tv.c(k), GOLD);
  say('insertion 時會變的樹高', '只有 root 到 leaf 那條 path 上的 node');
  await step(tok);                                   // 2:50:25 往回修正時順便更新
  const up = pkt('↑ 順便更新高度', g8.position.x + 0.8, g8.position.y);
  await travel(tok, up, up.position.clone(), V3(tv.P.get(4).x + 1.0, tv.P.get(4).y + 0.9, 0), 1400);
  say('從 leaf 往回找、修正的時候', '順便把高度更新就好');
  await step(tok);                                   // 2:50:31 其實只要 −1、0、+1：可以更省 bit
  for (const k of [4, 6, 7]) glow(tv.c(k), null);
  note('bf 只要 −1、0、+1 → 可以用更少的 bit', 0, -0.6, 1.0);
  say('其實只需要知道 −1、0、+1', '存樹高要比較大的數字；能不能更省 bit？可以，那是實作細節');
}]);
  }

  // ═══ rblin.js ═══
  {
// ─── gqphGLSGyQ4：台大林軒田 DSA 2-3-4 Tree / Red-Black Tree — cued: each step(tok) waits for the sentence it shows ───
// 例子取自影片：234 tree (5 16 | 3 | 7 11 14 | 18 21) ↔ 紅黑樹 5B(3B, 16R(11B(7R,14R), 21B(18R)))；
// insert 15（分家 → 11 往上、5 16 11 restructure）；remove 16（successor 18）；remove 18/7/14 紅 leaf；
// 234 remove 3（transfer：5 下、7 上）、remove 7,14 後 remove 11（16 下、18 上）、remove 21（fuse 18 + 16）；
// RB remove 3 的三種圖（兄弟不同層、5/3/7 11 旋轉、16 為 root 的 recolor）；Case 1/2/3 的 A、B、C 通式；double black。
// 小角色（buddy）會在樹上走：數黑色、找 successor、帶著新 key 走到蟑螂腳；對話框（say）/便利貼（note）講重點。
const { V3, fresh, tag, cube, move, fly, kill, glow, tint, txt, showL, code, line, arrow, ghostBox, step, buddy, travel, prop, bob, GOLD, GREEN, RED } = K;
const RCL = '#d64545', BCL = '#2b2b2b', YCL = '#e0b84a', KCL = '#e3c98f';
const colRB = (c) => (c === 'R' ? RCL : c === 'Y' ? YCL : BCL);
const note = (t, x, y, z = 0.4) => tag(t, 'note', x, y, z);
const bub = (t, x, y, z = 0.4) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0.4) => tag(t, 'pkt', x, y, z);
const okT = (t, x, y, z = 0.4) => tag(t, 'good', x, y, z);
const noT = (t, x, y, z = 0.4) => tag(t, 'bad', x, y, z);
// one speech bubble at a time (the previous one disappears)
function bubbler(mk = bub) { let b = null; return (t, x, y, z) => { if (b) kill(b); b = t ? mk(t, x, y, z) : null; return b; }; }
// a little walker that hops from node to node
const WALK = '#f4a56a';
const walker = (v, p, color = WALK, size = 0.42) => buddy(null, v, color, p.x, p.y + 0.38, 0.5, size);
const hopTo = (tok, b, p, ms = 420) => travel(tok, b.g, b.g.position.clone(), V3(p.x, p.y + 0.38, 0.5), ms);
async function hops(tok, b, ps, ms = 400) { for (const p of ps) await hopTo(tok, b, p, ms); }

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
  v.foot = (k, side) => { const q = v.P.get(k); return V3(q.x + side * 0.3, q.y - 0.72, 0); };
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
const glowAll = (v, ks, c) => ks.forEach((k) => { const m = v.c(k); if (m) glow(m, c); });
const glowFeet = (v, c) => v.deco.forEach((o) => { if (o.isMesh) glow(o, c); });
const above = (p, dy = 0.95, dx = 0) => [p.x + dx, p.y + dy];

const T0L = [[5, 16], [[[3]], [[7, 11, 14]], [[18, 21]]]];
const R0L = [5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R']]]];
const ALLK = [3, 5, 7, 11, 14, 16, 18, 21];

// ═════════ 1. 複習 2-3-4 tree（41:47） ═════════
FRAG.push(['rblin-234-review', '2-3-4 tree 複習：三種 node、蟑螂腳同高', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  const B = bubbler();
  await step(tok);                                   // 41:47 回到 234 與紅黑樹的複習
  L.set(T0L, { drop: ALLK });
  say('複習：2-3-4 tree', '每個 node 像一個「家」，住 1～3 個人');
  await step(tok);                                   // 42:33 2-node
  glowAll(L, [3], GOLD); B('2-node：1 個 key、2 個小孩', ...above(L.K.get(3), 1.0, 0.3));
  say('2-node：只住 1 個人', '3 自己一家，下面接 2 個小孩');
  await step(tok);                                   // 42:41 3-node
  glowAll(L, [3], null); glowAll(L, [5, 16, 18, 21], GOLD);
  B('3-node：2 個 key、3 個小孩', ...above(L.K.get(18), 1.0, 0.4));
  say('3-node：住 2 個人', '5 16、18 21');
  await step(tok);                                   // 42:50 4-node
  glowAll(L, [5, 16, 18, 21], null); glowAll(L, [7, 11, 14], GOLD);
  B('4-node：3 個 key、4 個小孩', ...above(L.K.get(11), 1.0));
  say('4-node：住 3 個人（滿了）', '7 11 14');
  await step(tok);                                   // 42:59 node 內排好序 → multiway search
  glowAll(L, [7, 11, 14], null); B(null);
  const w = walker(9, V3(0, 6.1, 0));
  say('node 裡排好序，小孩夾在中間', 'multiway search：找 9 → 5 < 9 < 16 → 走中間');
  await hopTo(tok, w, V3(0, 5.3, 0), 500);
  await hopTo(tok, w, L.K.get(11), 700);
  B('9 在 7 和 11 之間', ...above(L.K.get(11), 1.6));
  await step(tok);                                   // 43:41 蟑螂腳都在同一高度
  kill(w.g); B(null);
  line(-3.6, 2.22, 3.4, 2.22, 0.3, '#2f8a5a');
  note('所有蟑螂腳（external node）在同一高度', 0, 1.55);
  say('蟑螂腳 = 樹的結尾', '234 規定：全部在同一層 → 樹高受控制');
  await step(tok);                                   // 43:58 insertion 由下往上長
  arrow(V3(-4.2, 2.4, 0), V3(-4.2, 5.4, 0), 0x0f5a3a);
  bub('地基（蟑螂腳）先打好，再往上長', -4.2, 6.0);
  say('所以 insert 是從下面往上長', '像蓋房子：地基先打好');
}]);

// ═════════ 2. 234 → 紅黑樹：代表塗黑、家人塗紅（44:21） ═════════
FRAG.push(['rblin-234-to-rb', '234 轉紅黑樹：每家的代表是黑色', async (tok) => {
  const { L, R } = pairL({ nil: true });
  const col = {}; L.set(T0L);
  const B = bubbler();
  const paint = (ks, c) => { ks.forEach((k) => { col[k] = colRB(c); }); L.set(T0L, { col }); };
  await step(tok);                                   // 44:21 紅黑樹 = 234 上紅黑兩色，變成 binary tree
  say('紅黑樹 = 2-3-4 tree 塗上紅、黑兩色', '再改畫成 binary tree（每個 node 最多 2 個小孩）');
  B('每家先選一個「代表」', -3.4, 7.3);
  await step(tok);                                   // 44:37 3 自己是代表 → 黑
  paint([3], 'B'); glowAll(L, [3], GOLD);
  say('代表 → 塗黑', '3 孤家寡人，自己就是代表');
  await step(tok);                                   // 44:54 4-node 中間的 11 當代表
  glowAll(L, [3], null); paint([11], 'B'); glowAll(L, [11], GOLD);
  say('4-node：中間的 11 當代表', '11 → 黑');
  await step(tok);                                   // 45:01 3-node 兩人都能當：選 5、21
  glowAll(L, [11], null); paint([5, 21], 'B'); glowAll(L, [5, 21], GOLD);
  say('3-node：兩個人都可以當代表', '這裡選 5（5 16）和 21（18 21）');
  await step(tok);                                   // 45:18 代表以外的家人 → 紅
  glowAll(L, [5, 21], null); paint([16, 7, 14, 18], 'R');
  say('不是代表的「其他家人」→ 塗紅', '16、7、14、18');
  await step(tok);                                   // 45:37 代表放上面，家人接在下面
  R.set(R0L, { drop: ALLK });
  say('變成 binary tree：代表在上，家人掛在下面', '4-node：11 帶著 7、14；2-node：3 自己一個');
  await step(tok);                                   // 46:09 3-node 有兩種畫法
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [18, 'B', null, [21, 'R']]]]);
  B('3-node 兩種畫法：左在上（紅往右下）或右在上（紅往左下）', 3.4, 7.3);
  say('18 21 也可以 18 在上、21 掛右下', '兩種畫法都對');
  await beat(tok, 1600);
  R.set(R0L);
  await step(tok);                                   // 46:53 從蟑螂腳往 root 數黑色
  B(null);
  const cnt = pkt('黑 × 0', 6.3, 1.0);
  const w = walker('', R.foot(3, -1));
  say('從一隻蟑螂腳往 root 走，數黑色', '3 下面這隻：碰到 3、5');
  let n = 0;
  for (const k of [3, 5]) { await hopTo(tok, w, R.P.get(k), 450); n++; txt(cnt, '黑 × ' + n); glow(R.c(k), GOLD); }
  await step(tok);                                   // 47:03 另一隻：紅、黑、黑
  glowAll(R, ALLK, null); kill(w.g);
  const w2 = walker('', R.foot(7, -1)); n = 0; txt(cnt, '黑 × 0');
  say('換 7 下面這隻：紅的不算', '7 紅、11 黑、16 紅、5 黑 → 一樣 2 個黑');
  for (const k of [7, 11, 16, 5]) { await hopTo(tok, w2, R.P.get(k), 380); if (k === 11 || k === 5) { n++; txt(cnt, '黑 × ' + n); glow(R.c(k), GOLD); } }
  w2.mood('happy');
  await step(tok);                                   // 47:44 碰到黑 = 碰到一家的代表
  glowAll(R, ALLK, null);
  glowAll(L, [5, 21, 3, 11], GREEN);
  B('碰到一個黑 = 碰到一家的代表', 3.4, 7.3);
  say('每隻蟑螂腳數到的黑色都一樣多', '= 234 tree 的蟑螂腳都在同一高度');
}]);

// ═════════ 3. 紅黑樹的規則從 234 來（48:01） ═════════
function rulesTree() {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.6, dx: 0.95, dy: 1.3, sz: 0.8, nil: true });
  R.set(R0L);
  return R;
}
FRAG.push(['rblin-rb-rules', '紅黑樹規則：紅的爸爸、小孩都是黑', async (tok) => {
  const R = rulesTree();
  const B = bubbler();
  await step(tok);                                   // 48:01 紅色的爸爸一定是黑
  glowAll(R, [7, 14, 18, 16], GOLD);
  B('紅 = 代表以外的「其他家人」', 0, 6.6);
  say('規則：紅色 node 的爸爸一定是黑', '紅色總是跟著某個黑色（代表）走');
  await step(tok);                                   // 48:18 7、14 → 11；18 → 21；16 → 5
  glowAll(R, [11, 21, 5], GREEN);
  say('7、14 的爸爸 11；18 的爸爸 21；16 的爸爸 5', '全都是黑：不會有「紅爸爸生紅小孩」');
  await step(tok);                                   // 48:55 root 一定是黑
  glowAll(R, ALLK, null); glow(R.c(5), GREEN);
  B('代表永遠放上面 → root 是黑', ...above(R.P.get(5), 0.9));
  say('root 一定是黑', '轉換時代表總是放在上面');
  await step(tok);                                   // 49:22 紅色的小孩也一定是黑
  glow(R.c(5), null); glowAll(R, [16], GOLD); glowAll(R, [11, 21], GREEN);
  B('紅的往下接 → 一定是別家（黑）', ...above(R.P.get(16), 0.9));
  say('紅色的小孩一定是黑（含蟑螂腳）', '這家到紅色就結束了，再往下就是別家');
  await step(tok);                                   // 49:39 規則都能從 234 的定義理解
  glowAll(R, [16, 11, 21], null); B(null);
  const t = buddy('234', '', KCL, -4.6, 2.2, 0.5, 0.7); t.mood('happy');
  bub('這些規則都是我變出來的！', -4.6, 3.5);
  say('紅黑樹的規則 ← 從 234 的定義來', '紅不連紅、root 黑、黑色數量一樣');
}]);

// ═════════ 4. insert：新生先塗紅，爸爸黑 = 有空房間（50:12） ═════════
FRAG.push(['rblin-ins-easy', 'Insert 簡單情形：爸爸是黑 → 234 有空房間', async (tok) => {
  const { L, R } = pairL({ nil: true });
  L.set(T0L); R.set(R0L);
  const B = bubbler();
  await step(tok);                                   // 50:12 新生先塗紅，照 BST 插
  const w = walker('新', V3(3.4, 6.4, 0), RCL);
  say('口訣：新生先塗紅', '照一般 BST 的規則往下走');
  await step(tok);                                   // 50:22 一定插在某隻蟑螂腳：例如 3 旁邊
  await hops(tok, w, [R.P.get(5), R.P.get(3), R.foot(3, 1)], 420);
  say('新 node 一定落在某一隻蟑螂腳', '例如 3 旁邊這隻');
  await step(tok);                                   // 50:31 或 21 旁邊
  await hops(tok, w, [R.P.get(5), R.P.get(16), R.P.get(21), R.foot(21, 1)], 380);
  say('也可能在 21 旁邊這隻', '總之：在某隻蟑螂腳的位置');
  await step(tok);                                   // 50:41 爸爸是黑
  glow(R.c(21), GREEN);
  B('爸爸 21 是黑色', ...above(R.P.get(21), 1.4, 0.4));
  say('看爸爸：21 是黑色', '對應 234：這家還有空房間');
  await step(tok);                                   // 50:49 234 有空房間就直接放
  kill(w.g); glow(R.c(21), null); B(null);
  L.set([[5, 16], [[[3]], [[7, 11, 14]], [[18, 21, '新']]]], { drop: '新' });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R'], ['新', 'R']]]], { drop: '新' });
  okT('18 21 有空房 → 直接住', -1.6, 1.2);
  say('有空房間就直接放', '紅黑樹：掛成紅色小孩就好');
  await step(tok);                                   // 50:58 3 旁邊也有空房間
  L.set([[5, 16], [[[3, '新′']], [[7, 11, 14]], [[18, 21, '新']]]], { drop: '新′' });
  R.set([5, 'B', [3, 'B', null, ['新′', 'R']], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B', [18, 'R'], ['新', 'R']]]], { drop: '新′' });
  glow(R.c(3), GREEN);
  say('3 旁邊也有空房間 → 直接放', '爸爸是黑 = 簡單的情形');
}]);

// ═════════ 5. insert 15：紅叔不能容 → 分家（recolor）（51:14） ═════════
const T15L = [[5, 11, 16], [[[3]], [[7]], [[14, 15]], [[18, 21]]]];
const R15L = [5, 'B', [3, 'B'], [16, 'R', [11, 'R', [7, 'B'], [14, 'B', null, [15, 'R']]], [21, 'B', [18, 'R']]]];
FRAG.push(['rblin-ins15-recolor', 'Insert 15：家已滿 → 分家，7、14 塗黑、11 塗紅', async (tok) => {
  const { L, R } = pairL();
  L.set(T0L); R.set(R0L);
  const B = bubbler();
  await step(tok);                                   // 51:14 把 15 放到 14 旁邊
  const w = walker(15, V3(3.4, 6.4, 0), RCL);
  say('insert 15：新生先塗紅', '一路走到 14 的右邊');
  await hops(tok, w, [R.P.get(5), R.P.get(16), R.P.get(11), R.P.get(14)], 360);
  kill(w.g);
  L.set([[5, 16], [[[3]], [[7, 11, 14, 15]], [[18, 21]]]], { drop: 15 });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R', null, [15, 'R']]], [21, 'B', [18, 'R']]]], { drop: 15 });
  await step(tok);                                   // 51:22 紅叔不能容
  glowAll(R, [14, 7], GOLD); glow(L.c(15), RED);
  B('爸爸 14 紅、叔叔 7 也紅', ...above(R.P.get(11), 0.95));
  say('口訣：紅叔不能容', '234 的 7 11 14 已經住滿了');
  await step(tok);                                   // 51:47 沒有空房間 → 分家
  glowAll(R, [14, 7], null);
  noT('住不下了！要分家', -3.4, 2.2);
  say('234：沒有空房間 → 分家', '中間的人要往上搬');
  await step(tok);                                   // 51:56 11 往上推，14 15 重新串
  glow(L.c(15), null); L.set(T15L); glow(L.c(11), GOLD);
  say('中間的 11 往上推', '7 自成一家；14 15 一家');
  await step(tok);                                   // 52:14 7、14 改塗黑（各自當代表）
  glow(L.c(11), null);
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'B'], [14, 'B', null, [15, 'R']]], [21, 'B', [18, 'R']]]]);
  glowAll(R, [7, 14], GREEN);
  say('紅黑樹：7、14 改塗黑', '它們各自當新家的代表');
  await step(tok);                                   // 52:38 11 被插入上一層 → 紅
  glowAll(R, [7, 14], null); R.set(R15L); glow(R.c(11), GOLD);
  say('11 被插進上一層 → 跟新生一樣塗紅', '這就是 recolor（只改顏色）');
  await step(tok);                                   // 53:06 但 11 的爸爸 16 也是紅
  glowAll(R, [11, 16], RED);
  B('11 紅、爸爸 16 也紅 → 還沒完', ...above(R.P.get(16), 0.95));
  say('11 有紅色的爸爸 16', '16 容不下它，還要處理');
}]);

// ═════════ 6. 11 插錯邊 → restructure 5、16、11（53:24） ═════════
FRAG.push(['rblin-ins15-restructure', '11 往上後：叔叔 3 黑 → restructure', async (tok) => {
  const { L, R } = pairL();
  L.set(T15L); R.set(R15L);
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 53:22 插進 3-node，但不在平衡的那一邊
  glowAll(R, [11, 16], RED);
  B('11 插在 16 的左下：不平衡的那一邊', ...above(R.P.get(16), 0.95));
  say('5 16 是 3-node，11 卻插錯邊', '就像 18 21 卻插在 18 左邊');
  await step(tok);                                   // 53:48 要做 restructure（像 AVL）
  N('要做 restructure（跟 AVL 的很像）', 3.4, 0.6);
  say('解法：restructure', '跟 AVL tree 的 restructure 類似');
  await step(tok);                                   // 54:12 上面這層的 5 要重新檢討
  glowAll(R, [11, 16], null); glow(R.c(5), GOLD);
  B('爺爺 5 要重新檢討位置', ...above(R.P.get(5), 0.9));
  say('上面這一層的 5 要重新檢討', '它可能要滑下來');
  await step(tok);                                   // 54:38 5 16 不是滿的：3 是另一家
  glow(R.c(3), GREEN);
  B('3 是另外一家', ...above(R.P.get(3), 0.9));
  say('怎麼知道 5 16 這家沒滿？', '旁邊的 3 是另外一家');
  await step(tok);                                   // 54:52 叔叔 3 是黑色
  N('特徵：叔叔 3 是黑色', 3.4, 0.6);
  say('叔叔 3 是黑色', '→ 5 16 只住兩人，加 11 剛好三人');
  await step(tok);                                   // 55:00 5、16、11 三人重排，爺爺 5 退下來
  glowAll(R, [3, 5], null); B(null);
  R.set([11, 'B', [5, 'R', [3, 'B'], [7, 'B']], [16, 'R', [14, 'B', null, [15, 'R']], [21, 'B', [18, 'R']]]]);
  glowAll(R, [5, 16, 11], GOLD); glowAll(L, [5, 11, 16], GOLD);
  say('5、16、11 三個人重新排', '11 上去當代表（黑）；5、16 變紅掛兩邊');
  await step(tok);                                   // 55:07 對比：7 11 14 放 15 的那次
  glowAll(R, [5, 16, 11], null); glowAll(L, [5, 11, 16], null);
  N('對比：剛才 7 11 14 放 15 那次', 3.4, 0.6);
  say('對比剛才放 15 的情形', '那時候那一家已經滿了');
  await step(tok);                                   // 55:20 7 紅、14 紅 → 紅叔 → 一連串
  N('那次：爸爸 14 紅、叔叔 7 紅 → 紅叔 → recolor', 3.4, 0.6);
  say('紅叔叔 → 家已滿 → recolor 往上', '黑叔叔 → 家沒滿 → restructure');
  await step(tok);                                   // 55:37 用簡單圖示複習對應關係
  okT('234 分家 ↔ recolor；插錯邊 ↔ restructure', 0, 0.0);
  say('insert 的對應關係複習完了', '等一下用同樣的想法講 removal');
}]);

// ═════════ 7. remove：先變成 remove leaf（16 → successor 18）（69:53） ═════════
FRAG.push(['rblin-rm16-succ', 'Remove 16：找 successor 18 補上，改成 remove leaf', async (tok) => {
  const B = bubbler(); const N = bubbler(note);
  let L, R;
  await step(tok);                                   // 69:53 重畫兩棵範例樹
  ({ L, R } = pairL({ nil: true })); L.set(T0L, { drop: ALLK }); R.set(R0L, { drop: ALLK });
  say('重畫範例：一棵 234、一棵紅黑樹', '跟前面一樣的數字');
  await step(tok);                                   // 70:00 蟑螂腳畫成黑色
  glowFeet(R, GOLD);
  N('蟑螂腳畫成黑色', 3.4, 0.4);
  say('紅黑樹的蟑螂腳畫成黑色', '像是「潛在的下一個 node」');
  await step(tok);                                   // 70:33 黑 = 有空間；紅 = 可能滿了
  B('爸爸黑 → 有空間；爸爸紅 → 這家可能滿了', 3.4, 7.3);
  say('黑腳幫我們判斷有沒有空間', '很好用的 edge case 處理');
  await step(tok);                                   // 70:48 BST removal：讓 remove 發生在 leaf
  glowFeet(R, null); B(null);
  N('BST removal：讓 remove 發生在 leaf', 3.4, 0.4);
  say('remove 的重要概念：在 leaf 拿掉', '從中間砍斷再接回去很麻煩');
  await step(tok);                                   // 71:10 想 remove 16
  glow(R.c(16), RED); glow(L.c(16), RED);
  B('想拿掉 16（不是 leaf）', ...above(R.P.get(16), 0.95));
  say('例子：remove 16', '16 在中間，有小孩');
  await step(tok);                                   // 71:20 先往右邊走
  const w = walker('找', R.P.get(16));
  await hopTo(tok, w, R.P.get(21), 500);
  B('先往右走一步', ...above(R.P.get(21), 1.4));
  say('找 16 的「下一個人」', '第一步：往右邊走');
  await step(tok);                                   // 71:30 再一路往左鑽到底
  await hopTo(tok, w, R.P.get(18), 500); glow(R.c(18), GOLD); w.mood('happy');
  B('再一路往左鑽到底 → 18', ...above(R.P.get(18), 1.4));
  say('再一路往左鑽到底', '右子樹最小的 = 18');
  await step(tok);                                   // 71:37 把 18 請上來
  kill(w.g); B(null);
  const p18 = R.P.get(18);
  R.set([5, 'B', [3, 'B'], [18, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B']]], { fly: true });
  glow(R.c(18), GOLD);
  say('把 18 請上來，坐 16 的位置', '顏色跟著位置：這格原本是紅');
  await step(tok);                                   // 71:48 再去 remove 18
  N('真正被拿掉的是原本那個 leaf 18', p18.x, p18.y - 1.0);
  say('接著再去 remove 18（原本的 leaf）', '問題變成「remove leaf」');
  await step(tok);                                   // 72:06 也可選左子樹最大的
  glow(R.c(18), null); glow(R.c(14), GOLD);
  B('也可以找左子樹最大的：14', ...above(R.P.get(14), 0.95));
  say('也可以用左子樹最大的（14）', '通常先固定找一邊');
  await step(tok);                                   // 72:26 兩邊都空 → 本身就是 leaf
  glow(R.c(14), null); B(null);
  N('一邊空找另一邊；兩邊都空 = 自己就是 leaf', 3.4, 0.4);
  say('兩邊都找不到？', '那它本身就是 leaf，直接移掉');
  await step(tok);                                   // 72:52 234 也一樣
  B('234 tree 也一樣', -3.4, 7.3);
  say('2-3-4 tree 的第一步也一樣', '先把問題換成 remove leaf');
  await step(tok);                                   // 73:18 remove 16 → 借 18 上來
  L.set([[5, 18], [[[3]], [[7, 11, 14]], [[21]]]], { fly: true });
  glow(L.c(18), GOLD);
  say('234：remove 16 → 借 18 上來補', '改成 remove 18');
  await step(tok);                                   // 73:34 之後只討論 remove leaf
  glow(L.c(18), null); B(null);
  okT('接下來只討論：remove leaf', 0, 0.4);
  say('第 0 步：一律化成 remove leaf', '接下來專心看拿掉 leaf 會怎樣');
}]);

// ═════════ 8. 簡單的 remove：234 從 3/4-node 移；RB 移紅 leaf（73:51） ═════════
FRAG.push(['rblin-rm-red-leaf', '簡單的 remove：那家還有人 = 拿掉紅色 leaf', async (tok) => {
  const { L, R } = pairL({ nil: true });
  L.set(T0L); R.set(R0L);
  const B = bubbler();
  await step(tok);                                   // 73:57 簡單的：那家還有人
  glow(L.c(18), RED);
  B('移掉 18：還有 21 頂著', ...above(L.K.get(18), 1.0, 0.4));
  say('簡單的 remove：那家還有人在', '例如 234 移掉 18');
  await step(tok);                                   // 74:07 移 14
  glow(L.c(18), null); glow(L.c(14), RED);
  B('移掉 14：還有 7、11', ...above(L.K.get(14), 1.0));
  say('移掉 14 也簡單', '那家還有人頂著');
  await step(tok);                                   // 74:16 移 11
  glow(L.c(14), null); glow(L.c(11), RED);
  B('移掉 11：也還有人', ...above(L.K.get(11), 1.0));
  say('移掉 11 也簡單', '');
  await step(tok);                                   // 74:28 remove from 4-node / 3-node：easy
  glow(L.c(11), null); B(null);
  okT('從 4-node、3-node 移 → easy', -3.4, 1.2);
  say('remove from 4-node、3-node', '都是 easy（trivial）');
  await step(tok);                                   // 75:01 紅黑樹：7 那家還有戶長
  glow(R.c(7), RED); glow(R.c(11), GREEN);
  B('7 是紅的：它家還有戶長 11', ...above(R.P.get(11), 0.95));
  say('紅黑樹：拿掉 7', '它本來就是有戶長的家');
  await step(tok);                                   // 75:19 18、14 也一樣
  glowAll(R, [7, 11], null); glowAll(R, [18, 14], RED);
  B('18、14 也一樣', ...above(R.P.get(16), 0.95));
  say('拿掉 18、14 也沒有問題', '它們都是紅色 leaf');
  await step(tok);                                   // 75:25 remove red leaf → easy
  glowAll(R, [14], null); B(null);
  L.set([[5, 16], [[[3]], [[7, 11, 14]], [[21]]]], { fly: true });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R'], [14, 'R']], [21, 'B']]], { fly: true });
  okT('remove red leaf → easy', 3.4, 0.4);
  say('對應到：remove red leaf', '直接摘掉就好');
  await step(tok);                                   // 75:44 除了接好蟑螂腳什麼都不用做
  glowFeet(R, GREEN);
  B('只要把蟑螂腳接好', ...above(R.P.get(21), 0.95));
  say('除了把蟑螂腳接好', '什麼額外的事都不用做');
  await step(tok);                                   // 76:17 不是每種 234 情形都直接出現
  glowFeet(R, null); B(null);
  say('注意：234 的 easy case', '在紅黑樹不一定「直接」發生');
  await step(tok);                                   // 76:37 11 在紅黑樹不是 leaf
  glow(L.c(11), GOLD); glow(R.c(11), GOLD);
  B('234 可以直接移 11；RB 的 11 不是 leaf', ...above(R.P.get(11), 0.95));
  say('例：234 移掉 11', '紅黑樹的 11 有小孩，不是 leaf');
  await step(tok);                                   // 76:53 先走第 0 步：14 請上去當門神
  B(null);
  R.set([5, 'B', [3, 'B'], [16, 'R', [14, 'B', [7, 'R']], [21, 'B']]], { fly: true });
  L.set([[5, 16], [[[3]], [[7, 14]], [[21]]]], { fly: true });
  glow(R.c(14), GOLD);
  B('14 請上去當門神，再移掉紅 leaf 14', ...above(R.P.get(14), 0.95));
  say('會先走第 0 步：14 上去補位', '再移掉原本的紅 leaf 14');
}]);

// ═════════ 9. 234 remove 3：transfer（77:21） ═════════
FRAG.push(['rblin-234-transfer3', '234 remove 3：隔壁有人可借 → transfer', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set(T0L);
  const B = bubbler();
  const p3 = L.K.get(3);
  await step(tok);                                   // 77:21 難的：remove from 2-node（移 3）
  glow(L.c(3), RED);
  L.set([[5, 16], [[[]], [[7, 11, 14]], [[18, 21]]]], { fly: true });
  say('難的：remove 3（2-node）', '3 走了，這家沒人了');
  await step(tok);                                   // 77:30 直接拆掉 → 違反蟑螂腳同高
  noT('直接拆掉 → 蟑螂腳不同高 ✗', p3.x + 0.4, p3.y - 1.4);
  say('把空房子直接拆掉？', '蟑螂腳就不在同一高度了 ✗');
  await step(tok);                                   // 78:00 找個人來頂著
  B('只要找一個人來頂著這個家', p3.x, p3.y + 1.0);
  say('像把空房子租出去', '只要有一個人來住就好');
  await step(tok);                                   // 78:19 向同輩借：7 11 14 很擠
  glowAll(L, [7, 11, 14], GOLD);
  B('隔壁 7 11 14 住得好擠', ...above(L.K.get(11), 1.0));
  say('跟兄弟那家借人', '3 這家空了，隔壁卻擠了三個人');
  await step(tok);                                   // 78:54 離 3 最近的是爸爸 5 → 下來頂
  glowAll(L, [7, 11, 14], null); B(null);
  move(L.c(5), p3.x, p3.y, 0); glow(L.c(5), GREEN);
  say('離 3 最近的是爸爸 5', '5 先下來頂著空房間');
  await step(tok);                                   // 79:02 從隔壁借 7 上去當爸爸
  L.set([[7, 16], [[[5]], [[11, 14]], [[18, 21]]]]); glow(L.c(7), GREEN);
  say('爸爸的位置空了 → 隔壁的 7 上去', '7 當新的爸爸');
  await step(tok);                                   // 79:24 結構沒有太大改變
  glowAll(L, [5, 7], null);
  say('結構幾乎沒變', '只是借了一個人來這家頂著');
  await step(tok);                                   // 79:39 只動兩個人
  glowAll(L, [5, 7], GOLD);
  B('只動了兩個人：爸爸 5、隔壁的 7', 0, 6.2);
  say('牽涉兩個人', '3 原來的爸爸、隔壁家的 7');
  await step(tok);                                   // 80:05 5 頂著；隔壁剩兩人也沒關係
  glowAll(L, [5, 7], null); B(null);
  okT('5 頂著，爸爸位置有 7 坐鎮', p3.x + 0.6, p3.y - 1.4);
  say('原來的家有人頂著、爸爸位置也有人', '隔壁從 3 人變 2 人，也還好');
  await step(tok);                                   // 80:21 這叫 Transfer
  tag('Transfer', 'idx', 0, 6.5, 0);
  say('這個操作叫 Transfer', '從兄弟家「轉」一個人過來');
  await step(tok);                                   // 80:30 when borrowable
  note('When borrowable：兄弟家有人可借', 0, 0.6);
  say('什麼時候能做？', 'borrowable：隔壁有人可以借');
  await step(tok);                                   // 81:01 兄弟是 3-node 或 4-node
  glowAll(L, [11, 14], GOLD);
  say('兄弟是 3-node 或 4-node（人丁興旺）', '借一個上去當爸爸，爸爸下來顧家');
}]);

// ═════════ 10. 234：移 7、14 後 remove 11 → 向 18 21 借（81:38） ═════════
FRAG.push(['rblin-234-rm11-transfer', '234：remove 7、14，再 remove 11（16 下、18 上）', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  const B = bubbler();
  await step(tok);                                   // 81:38 隔壁人丁單薄怎麼辦？重畫
  L.set(T0L, { drop: ALLK });
  say('如果隔壁人丁單薄呢？', '先重畫原來的圖');
  await step(tok);                                   // 82:38 先移掉 7
  L.set([[5, 16], [[[3]], [[11, 14]], [[18, 21]]]], { fly: true });
  say('先做兩個簡單的 removal', '移掉 7');
  await step(tok);                                   // 82:44 再移掉 14
  L.set([[5, 16], [[[3]], [[11]], [[18, 21]]]], { fly: true });
  say('再移掉 14', '都是簡單的 remove');
  await step(tok);                                   // 82:53 3 孤苦伶仃
  glow(L.c(3), GOLD);
  B('3 一個人住', ...above(L.K.get(3), 1.0));
  say('現在 3 孤苦伶仃', '一個人住');
  await step(tok);                                   // 83:03 11 也一個人
  glow(L.c(3), null); glow(L.c(11), GOLD);
  B('11 也一個人住', ...above(L.K.get(11), 1.0));
  say('11 也只剩一個人', '');
  await step(tok);                                   // 83:12 remove 11：2-node
  const p11 = L.K.get(11);
  glow(L.c(11), RED); B(null);
  L.set([[5, 16], [[[3]], [[]], [[18, 21]]]], { fly: true });
  say('remove 11', '又是 remove from 2-node');
  await step(tok);                                   // 83:22 從 18 21 借
  glowAll(L, [18, 21], GOLD);
  B('隔壁 18 21 有兩個人', ...above(L.K.get(18), 1.0, 0.4));
  say('可以從 18 21 那家借', '');
  await step(tok);                                   // 83:30 16 下來、18 上去
  glowAll(L, [18, 21], null); B(null);
  L.set([[5, 18], [[[3]], [[16]], [[21]]]]); glowAll(L, [16, 18], GREEN);
  say('16 下來頂，18 上去當爸爸', '又是一次 transfer');
  await step(tok);                                   // 83:40 16、21、18 各自一人
  glowAll(L, [16, 18], null);
  okT('16、21、18 都各住一間', p11.x + 1.0, p11.y - 1.4);
  say('現在 16、21、18 都一個人住', '已經很極端了');
  await step(tok);                                   // 83:56 再移一個會怎樣？
  bub('再移一個會怎樣？', 0, 6.4);
  say('那就再移一個吧', '每一家都只剩一個人……');
}]);

// ═════════ 11. 234：remove 21 → 借無可借 → fuse（84:07） ═════════
FRAG.push(['rblin-234-rm21-fuse', '234 remove 21：借無可借 → fuse，爸爸拉下來', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const L = T4Vl({ cx: 0, top: 5.0, dy: 2.0, kw: 0.9, nil: true });
  L.set([[5, 18], [[[3]], [[16]], [[21]]]]);
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 84:07 移掉 21
  glow(L.c(21), RED);
  L.set([[5, 18], [[[3]], [[16]], [[]]]], { fly: true });
  say('remove 21', '21 那家也只有它');
  await step(tok);                                   // 84:18 隔壁 16 也一個人
  glow(L.c(16), GOLD);
  B('16 也一個人住，沒人可借', ...above(L.K.get(16), 1.0));
  say('想從隔壁借？', '16 也只有一個人');
  await step(tok);                                   // 84:26 借無可借
  noT('18 下來、16 上去？那 16 的家就空了 ✗', 0, 0.8);
  say('借無可借', '這一家的人丁實在太單薄');
  await step(tok);                                   // 84:54 不如合在一起取暖
  glow(L.c(16), null); B(null);
  B('與其各自孤單，不如合在一起', 0, 6.4);
  say('不需要那麼多層、那麼多爸爸', '大家合在一起取暖吧');
  await step(tok);                                   // 85:01 把爸爸 18 拉下來跟 16 合一家
  L.set([[5], [[[3]], [[16, 18]]]]); glowAll(L, [16, 18], GREEN);
  say('把爸爸 18 拉下來', '跟兄弟 16 合成一家');
  await step(tok);                                   // 85:37 上面少一個爸爸、少一條連結
  glowAll(L, [16, 18], null);
  N('上一層少一個 key、也少一條連結', 0, 0.8);
  say('上一層少了一個爸爸', '也少了一條連結（空房間不用再指）');
  await step(tok);                                   // 85:52 這叫 fuse
  tag('Fuse', 'idx', 0, 6.9, 0);
  say('這個操作叫 Fuse（合體）', '爸爸 + 被移掉者的兄弟 合成一家');
  await step(tok);                                   // 86:45 上一層是 3-node → easy
  glow(L.c(5), GOLD); B(null);
  B('上一層原本是 5 18（3-node）→ easy', ...above(L.K.get(5), 1.0));
  say('等於在上一層 remove 一個人', '上一層是 3-node → 簡單');
  await step(tok);                                   // 86:59 上一層若也是 2-node → 再往上
  arrow(V3(0.9, 5.2, 0), V3(0.9, 6.6, 0), 0x7a1010);
  N('上一層也是 2-node → 往上一層再做 remove', 0, 0.8);
  say('上一層若也只有一個人', '同樣的事要再往上做');
  await step(tok);                                   // 87:23 fuse = fuse + remove from upper level
  glow(L.c(5), null);
  N('fuse = fuse + remove from upper level', 0, 0.8);
  say('所以 fuse = 合體 + 在上一層 remove', '可能一路往上，直到解決');
  await step(tok);                                   // 87:47 234 removal 總結
  B('remove leaf：有人 → 直接移；沒人 → 借 or 合併', 0, 6.4);
  say('234 remove 總結', '4/3-node 直接移；2-node 先借，借不到就 fuse');
  await step(tok);                                   // 89:34 insert：滿了就分家
  B('insert：放到 leaf，滿了就分家往上推', 0, 6.4);
  say('回頭看 insert', '照 multiway search 放進 leaf，滿了就分家');
  await step(tok);                                   // 90:01 remove：借人或合併
  B('remove：隔壁興旺就借，不然爸爸拉下來合併', 0, 6.4);
  say('remove：沒人撐著家才麻煩', '借人（transfer）或合併（fuse）');
}]);

// ═════════ 12. RB remove 3：兄弟不同層的麻煩情形（90:28） ═════════
FRAG.push(['rblin-rb-rm3-hard', 'RB remove 3：要動 5、16、11、7 四個 node', async (tok) => {
  const B = bubbler(); const N = bubbler(note);
  let L, R;
  await step(tok);                                   // 90:30 萬惡的紅黑樹 removal
  ({ L, R } = pairL());
  L.set([[5, 16], [[[3]], [[11]], [[18, 21]]]]);
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B'], [21, 'B', [18, 'R']]]]);
  say('來看紅黑樹的 removal', '（7、14 剛才已經移掉了）');
  await step(tok);                                   // 91:13 要 remove 的是 3
  glow(R.c(3), RED); glow(L.c(3), RED);
  B('難的都是 remove 2-node：例如 3', ...above(R.P.get(3), 0.95));
  say('難的都是 remove 2-node', '來試 remove 3');
  await step(tok);                                   // 91:28 3 是 leaf
  N('RB 裡 3 是 leaf → 不用先找替身', 3.4, 0.4);
  say('紅黑樹裡 3 是 leaf', '可以直接處理');
  await step(tok);                                   // 91:45 要從隔壁借
  B('要從隔壁借人', ...above(L.K.get(11), 1.0));
  say('234：要從隔壁借一個人', '先畫一個隔壁有人可借的情形');
  await step(tok);                                   // 92:00 把 7 寫回來
  L.set([[5, 16], [[[3]], [[7, 11]], [[18, 21]]]], { drop: 7 });
  R.set([5, 'B', [3, 'B'], [16, 'R', [11, 'B', [7, 'R']], [21, 'B', [18, 'R']]]], { drop: 7 });
  B(null);
  say('把 7 寫回來', '隔壁 7 11 就有人可借');
  await step(tok);                                   // 92:41 5 借下來、7 滾上去
  glowAll(L, [5, 7], GOLD);
  B('5 下去、7 上去', ...above(L.K.get(5), 1.0, -0.4));
  say('照剛才的 transfer', '5 下去、7 滾上去 5 的位置');
  await step(tok);                                   // 92:59 234 最後：5 | 7 16 | 11
  glowAll(L, [5, 7], null); B(null);
  L.set([[7, 16], [[[5]], [[11]], [[18, 21]]]], { fly: true });
  say('234 最後長這樣', '5 ｜ 7 16 ｜ 11');
  await step(tok);                                   // 93:12 紅黑樹：5 下去，有點麻煩
  R.set([5, 'B', null, [16, 'R', [11, 'B', [7, 'R']], [21, 'B', [18, 'R']]]], { fly: true });
  B('紅黑樹：5 要下去……有點麻煩', ...above(R.P.get(5), 0.9));
  say('紅黑樹這邊呢？', '3 拿掉後，5 要下去');
  await step(tok);                                   // 93:53 畫法一：7 在上面
  B(null);
  R.set([7, 'B', [5, 'B'], [16, 'R', [11, 'B'], [21, 'B', [18, 'R']]]]);
  say('一種畫法：7 在上面', '7(黑) 左 5、右 16(紅)，16 下接 11');
  await step(tok);                                   // 94:28 畫法二：16 在上面
  R.set([16, 'B', [7, 'R', [5, 'B'], [11, 'B']], [21, 'B', [18, 'R']]]);
  say('另一種：16 在上面', '7(紅) 下面接 5、11');
  await step(tok);                                   // 95:03 牽扯四個 node
  const xs = [5, 16, 11, 7].map((k) => R.P.get(k));
  const x0 = Math.min(...xs.map((p) => p.x)), x1 = Math.max(...xs.map((p) => p.x));
  const gb = ghostBox('#d64545', x1 - x0 + 1.2, 3.6, 1.2); gb.position.set((x0 + x1) / 2, 4.5, 0);
  N('牽扯 5、16、11、7 四個 node 的 restructure', 3.4, 0.4);
  say('兩種畫法都要動四個 node', '5、16、11、7 一起「家庭倫理大戲」');
  await step(tok);                                   // 95:33 兩個 3-node 疊起來 → 跨四層
  N('兩個 3-node 疊起來 → 跨四層', 3.4, 0.4);
  say('為什麼這麼廣？', '裡面有兩個 3-node，各佔兩層');
  await step(tok);                                   // 96:03 有點難，先擱著
  kill(gb);
  B('這個先擱著，等一下再處理', 3.4, 7.3);
  say('跨代處理有點困難', '先看簡單一點的情形');
}]);

// ═════════ 13. RB remove 3：黑兄弟 7 有紅小孩 11 → rotate（96:52） ═════════
FRAG.push(['rblin-rb-rm3-rotate', 'RB remove 3：黑兄弟有紅小孩 → rotate 5、7', async (tok) => {
  const { L, R } = pairL();
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 96:54 砍掉 16 那一支
  L.set([[5], [[[3]], [[7, 11]]]], { drop: [5, 3, 7, 11] });
  say('簡單一點：把 16 那一支砍掉', '234：5 ｜ 3 ｜ 7 11');
  await step(tok);                                   // 97:27 對應紅黑樹：7 當代表
  R.set([5, 'B', [3, 'B'], [7, 'B', null, [11, 'R']]], { drop: [5, 3, 7, 11] });
  say('對應的紅黑樹', '7 當代表（黑），11 紅');
  await step(tok);                                   // 97:57 一樣 remove 3
  glow(R.c(3), RED); glow(L.c(3), RED);
  say('一樣要 remove 3', '');
  await step(tok);                                   // 98:13 234：transfer → 5 下、7 上
  L.set([[7], [[[5]], [[11]]]], { fly: true });
  B('234：transfer → 5 下來、7 上去', -3.4, 7.3);
  say('234 可以從兄弟借（transfer）', '結果：7 在上，5、11 在下');
  await step(tok);                                   // 98:23 紅黑樹：3 拿掉
  R.set([5, 'B', null, [7, 'B', null, [11, 'R']]], { fly: true });
  B(null);
  say('紅黑樹：3 拿掉沒問題', '接下來要調整成 7 在上面');
  await step(tok);                                   // 98:40 需要 restructure：7 拉上去
  arrow(V3(R.P.get(7).x + 0.5, R.P.get(7).y, 0.3), V3(R.P.get(5).x + 0.5, R.P.get(5).y + 0.4, 0.3), 0x0f5a3a);
  B('7 要被拉上去', ...above(R.P.get(7), 0.95));
  say('最後要的：7 在上面', '這裡需要一次 restructure');
  await step(tok);                                   // 99:24 要移的 node 和兄弟在同一層
  glow(R.c(7), GREEN);
  N('要移的 3 和 234 的兄弟 7，在 RB 同一層', 3.4, 0.4);
  say('特別的是：兄弟在同一層', '從 3 很容易找到 234 的兄弟 7');
  await step(tok);                                   // 99:59 兄弟可借 → 兄弟是黑
  B('兄弟 7 是黑色', ...above(R.P.get(7), 0.95));
  say('兄弟是「黑色」', '黑 = 一家的代表');
  await step(tok);                                   // 100:12 有紅色的侄子／外甥
  glow(R.c(11), GOLD);
  B('紅色的侄子／外甥 11', ...above(R.P.get(11), 0.95));
  say('兄弟有紅色小孩 11', '= 那家有人可以借');
  await step(tok);                                   // 100:50 兄弟家是 3-node 或 4-node
  N('黑兄弟 + 紅外甥 = 234 兄弟家住 2～3 人', 3.4, 0.4);
  say('對應 234：兄弟家是 3-node 或 4-node', '所以可以 transfer');
  await step(tok);                                   // 101:17 rotate 5、7
  B(null);
  R.set([7, 'B', [5, 'B'], [11, 'R']]);
  glowAll(R, [5, 7], GOLD);
  say('Rotate 5 跟 7（跟 AVL 一樣）', '爸爸 5 轉下來頂空位，兄弟 7 轉上去');
  await step(tok);                                   // 101:46 紅外甥塗黑
  glowAll(R, [5, 7], null);
  R.set([7, 'B', [5, 'B'], [11, 'B']]); glow(R.c(11), GREEN);
  okT('借走一個人 → 外甥 11 塗黑，搞定', 3.4, 1.4);
  say('被借走的紅外甥 11 改塗黑', '調整完成');
  await step(tok);                                   // 102:24 對應 transfer（兄弟同層）
  glow(R.c(11), null);
  N('rotate + 紅變黑 ↔ 234 transfer', 3.4, 0.4);
  say('黑兄弟 + 紅小孩 → rotate、變黑', '對應 234 的 transfer（兄弟同一層的那種）');
  await step(tok);                                   // 102:46 前面複雜的是兄弟不同層
  B('剛才麻煩的那種：兄弟在不同層', 0, 7.3);
  say('前面那個複雜的情形', '是兄弟在不同層，要跨代處理');
}]);

// ═════════ 14. RB remove 3：兄弟 7 沒紅小孩 → recolor（103:22） ═════════
FRAG.push(['rblin-rb-rm3-recolor', 'RB remove 3：兄弟沒得借 → fuse = recolor', async (tok) => {
  const { L, R } = pairL();
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 103:26 不能借的長什麼樣子
  L.set([[5], [[[3]], [[7]]]], { drop: [5, 3, 7] });
  say('再看不能借的情形', '兄弟 7 只有一個人');
  await step(tok);                                   // 103:44 16、18 21 放回來
  L.set([[5, 16], [[[3]], [[7]], [[18, 21]]]], { drop: [16, 18, 21] });
  say('把 16、18 21 放回來', '234：5 16 ｜ 3 ｜ 7 ｜ 18 21');
  await step(tok);                                   // 104:05 讓 16 當 root，5 在旁邊
  R.set([16, 'B', [5, 'R']], { drop: [16, 5] });
  B('這次讓 16 當代表（root）', ...above(R.P.get(16), 0.9));
  say('為了好講：讓 16 當 root', '5 是家人（紅）');
  await step(tok);                                   // 104:14 5 下面 3、7；16 下面 18 21
  R.set([16, 'B', [5, 'R', [3, 'B'], [7, 'B']], [18, 'B', null, [21, 'R']]], { drop: [3, 7, 18, 21] });
  B(null);
  say('5 下面接 3、7', '16 右邊接 18 21');
  await step(tok);                                   // 104:42 fuse：移掉 3，5、7 併一家
  glow(R.c(3), RED);
  R.set([16, 'B', [5, 'R', null, [7, 'B']], [18, 'B', null, [21, 'R']]], { fly: true });
  L.set([[16], [[[5, 7]], [[18, 21]]]], { fly: true });
  glowAll(L, [5, 7], GREEN);
  say('移掉 3：兄弟 7 沒得借 → Fuse', '234：5 下來跟 7 合成一家');
  await step(tok);                                   // 105:10 紅的在上、黑的在下 → 顏色不對
  glowAll(L, [5, 7], null); glowAll(R, [5, 7], GOLD);
  noT('紅的壓在上、黑的在下 → 不對', 3.4, 1.0);
  say('紅黑樹：5 和 7 要同一家', '可是現在紅在上、黑在下');
  await step(tok);                                   // 105:18 重新塗顏色 → Recolor
  R.set([16, 'B', [5, 'B', null, [7, 'R']], [18, 'B', null, [21, 'R']]]);
  tag('Recolor', 'idx', 3.4, 7.3, 0);
  say('重新塗顏色就好：Recolor', '5 → 黑、7 → 紅，結構不動');
  await step(tok);                                   // 105:43 5 原本是紅：樂得下來當家長
  glowAll(R, [5, 7], null);
  okT('5 原本是紅（家人）→ 下來當家長，塗黑', 3.4, 0.2);
  say('簡單的情形：5 原本是紅', '它樂得下來當新家的家長');
  await step(tok);                                   // 106:14 fuse 還要 remove from upper level
  N('別忘了：fuse 還要 remove from upper level', -3.4, 0.4);
  say('fuse 不只這一層', '還要處理上面那一層');
  await step(tok);                                   // 107:16 如果 5 原本是黑？
  tint(R.c(5), BCL); glow(R.c(5), RED);
  B('如果 5 原本就是黑的？', ...above(R.P.get(5), 0.9, -0.4));
  say('如果 5 原本是黑色', '要再多圈一個黑');
  await step(tok);                                   // 107:29 黑上加黑 → 還沒完，往上
  B('黑上加黑（double black）', ...above(R.P.get(5), 0.9, -0.4));
  arrow(V3(R.P.get(5).x - 0.6, R.P.get(5).y + 0.3, 0.3), V3(R.P.get(5).x - 0.6, R.P.get(5).y + 1.6, 0.3), 0x7a1010);
  say('黑上加黑 = 還沒處理完', '繼續上一層：等於上一層要移掉一個黑');
  await step(tok);                                   // 107:49 parent 原本紅 → 塗黑，結束
  glow(R.c(5), null); B(null);
  okT('parent 原本紅 → 改塗黑，fuse 完成', 3.4, 7.3);
  say('parent 原本是紅', '改塗黑，事情就結束了');
}]);

// ═════════ 15. remove black 的三種情形（108:21） ═════════
FRAG.push(['rblin-rm-cases', 'Remove 黑色：三種情形', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.0, 0]);
  const caseAt = (cx, spec, lab) => {
    const v = RBVl({ cx, top: 5.0, dx: 0.85, dy: 1.2, sz: 0.62 });
    v.set(spec, { drop: spec[0] });
    tag(lab, 'ptr alt', cx, 1.2, 0);
    glow(v.c('x'), RED); glow(v.c('s'), GOLD);
    return v;
  };
  await step(tok);                                   // 108:30 remove 紅色 → easy
  okT('remove 紅色 leaf → easy', 0, 6.6);
  say('先整理：remove 紅色 leaf', '那只是那家的家人，easy');
  await step(tok);                                   // 108:50 困難都是 remove 黑色
  noT('困難的都是 remove 黑色', 0, 6.0);
  say('所有的困難：remove 黑色', 'x = 要移掉的黑色 leaf');
  await step(tok);                                   // 108:57 a. 兄弟同層、有紅外甥
  caseAt(-4.6, ['p', 'Y', ['x', 'B'], ['s', 'B', ['n', 'R']]], 'a. 兄弟同層、有紅外甥');
  note('可借 → 234 transfer', -4.6, 0.4);
  say('a：兄弟 s 同層，有紅色外甥 n', '可以借 → 對應 transfer');
  await step(tok);                                   // 109:25 black sibling
  note('兄弟 s 是黑：black sibling', -4.6, -0.3);
  say('兄弟同層 = black sibling', 'p 黃色：顏色不一定');
  await step(tok);                                   // 109:39 b. 兄弟同層、只有黑外甥
  caseAt(0, ['p', 'Y', ['x', 'B'], ['s', 'B']], 'b. 兄弟同層、只有黑外甥');
  note('沒得借 → 234 fuse', 0, 0.4);
  say('b：兄弟同層，但只有黑色外甥', '不能借 → 對應 fuse');
  await step(tok);                                   // 110:10 c. 兄弟不同層：red sibling
  caseAt(4.6, ['p', 'B', ['x', 'B'], ['s', 'R', ['y', 'B'], ['z', 'B']]], 'c. 紅兄弟：兄弟不同層');
  note('red sibling（剛才偷偷避開的）', 4.6, 0.4);
  say('c：兄弟不同層 → red sibling', '就是剛才那個麻煩的情形');
  await step(tok);                                   // 110:25 兄弟 = 234 tree 的兄弟
  bub('這裡的「兄弟」= 2-3-4 tree 裡的兄弟', 0, 7.0);
  say('remove 黑色只有這三種', '「兄弟」都是指 2-3-4 tree 裡的兄弟');
}]);

// ═════════ 16. Case 1 通式：A、B、C（111:07） ═════════
FRAG.push(['rblin-case1-restructure', 'Case 1：黑兄弟 B 有紅小孩 C → restructure', async (tok) => {
  const { L, R } = pairL({ dx: 1.05 });
  const B_ = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 111:20 上面某個 node A（黃）
  R.set(['A', 'Y'], { drop: 'A' });
  B_('A：兄弟們的爸爸，顏色不一定（黃）', 3.4, 7.3);
  say('通式：上面有一個 node A', '黃色 = 可能紅、也可能黑');
  await step(tok);                                   // 111:34 234 裡 A 代表上一層
  L.set([['A']], { drop: 'A' });
  say('在 234 裡，A 在上一層', '');
  await step(tok);                                   // 111:41 兄弟同層：兩個黑
  R.set(['A', 'Y', ['x', 'B'], ['B', 'B']], { drop: ['x', 'B'] });
  L.set([['A'], [[['x']], [['B']]]], { drop: ['x', 'B'] });
  say('兄弟同層：下面兩個黑色', 'x 和 B');
  await step(tok);                                   // 111:51 其中一個是要移掉的 leaf
  glow(R.c('x'), RED); glow(L.c('x'), RED);
  B_('x：要移掉的黑色 leaf', ...above(R.P.get('x'), 0.9));
  say('x 是要移掉的 leaf', '');
  await step(tok);                                   // 111:59 兄弟家有小孩可借
  R.set(['A', 'Y', ['x', 'B'], ['B', 'B', ['C', 'R']]], { drop: 'C' });
  L.set([['A'], [[['x']], [['C', 'B']]]], { drop: 'C' });
  glow(R.c('C'), GOLD);
  B_('兄弟 B 有紅小孩 C → 可以借', ...above(R.P.get('B'), 0.9));
  say('兄弟 B 家還有小孩可借', '紅色的 C');
  await step(tok);                                   // 112:18 其他 subtree（灰）
  N('其他 subtree 接在下面，跟著走', 3.4, 0.2);
  say('其他的 subtree 都接在下面', '先只看 A、B、C 的關係');
  await step(tok);                                   // 112:27 做 restructure ↔ 234 transfer
  tag('restructure ↔ 234 transfer', 'idx', 0, 7.6, 0);
  say('這種情形做 restructure', '對應 234 的 transfer');
  await step(tok);                                   // 113:09 爺爺 A 要跑下去
  B_(null);
  R.set(['A', 'Y', null, ['B', 'B', ['C', 'R']]], { fly: true });
  L.set([['A'], [[[]], [['C', 'B']]]], { fly: true });
  glow(R.c('A'), GOLD);
  B_('A 要下來，頂 x 原本的位置', ...above(R.P.get('A'), 0.9));
  say('x 移掉後：爺爺 A 要跑下去', '頂在原來被移掉的位置');
  await step(tok);                                   // 113:42 C 上去，B 在一邊
  B_(null); glow(R.c('A'), null); glow(R.c('C'), null);
  R.set(['C', 'R', ['A', 'Y'], ['B', 'B']]);
  L.set([['C'], [[['A']], [['B']]]]);
  say('兄弟家的 C 上去', 'A 在左、B 在右（先不管顏色）');
  await step(tok);                                   // 114:33 A 塗黑
  R.set(['C', 'R', ['A', 'B'], ['B', 'B']]); glow(R.c('A'), GREEN);
  B_('A：空掉那家的新主人 → 黑', ...above(R.P.get('A'), 0.9));
  say('下來的 A 要塗黑', '它是空掉那個家的新主人');
  await step(tok);                                   // 115:00 B 仍黑
  glow(R.c('B'), GREEN);
  B_('B 本來就是家長 → 仍黑', ...above(R.P.get('B'), 0.9));
  say('B 本來就是一家之主', '還是黑');
  await step(tok);                                   // 115:10 C 繼承 A 原本的顏色
  glowAll(R, ['A', 'B'], null);
  R.set(['C', 'Y', ['A', 'B'], ['B', 'B']]); glow(R.c('C'), GOLD);
  B_('C 坐上爸爸的位置 → 拿 A 原本的顏色', ...above(R.P.get('C'), 0.9));
  say('C 被移到上層、坐原本爸爸的位置', '所以 A 原本什麼色，C 就什麼色');
  await step(tok);                                   // 115:43 接近 AVL 的 restructure
  glow(R.c('C'), null); B_(null);
  okT('三代 A、B、C 重新組合成平衡 → 做完就結束', 0, 0.6);
  say('這就像 AVL 的 restructure', '把三代關係重組成比較平衡的樣子');
}]);

// ═════════ 17. Case 2 通式：recolor，double black 往上（116:13） ═════════
FRAG.push(['rblin-case2-recolor', 'Case 2：兄弟只有黑小孩 → recolor，可能往上傳', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.4, dx: 1.5, dy: 1.6, sz: 0.85 });
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 116:21 兄弟完全沒有小孩可借
  R.set(['A', 'Y', ['x', 'B'], ['B', 'B']], { drop: ['A', 'x', 'B'] });
  say('Case 2：對應 fuse', '兄弟完全沒有小孩可借');
  await step(tok);                                   // 116:38 要移走的 x，兄弟 B 黑
  glow(R.c('x'), RED); glow(R.c('B'), GOLD);
  B('x 要移走；兄弟 B 是黑（同一層）', 0, 6.6);
  say('x 是要移走的 node', '兄弟 B 是黑色');
  await step(tok);                                   // 116:58 沒有任何紅小孩
  N('B 下面沒有任何紅色小孩', 0, 1.4);
  say('B 沒有任何紅色小孩', '下面全是黑的（或沒有）');
  await step(tok);                                   // 117:15 234 fuse ↔ RB re-color
  tag('234 fuse ↔ 紅黑樹 re-color', 'idx', 0, 7.4, 0);
  say('234 要做 fuse', '紅黑樹對應到 re-color');
  await step(tok);                                   // 117:28 移走 x
  glowAll(R, ['x', 'B'], null); B(null);
  R.set(['A', 'Y', null, ['B', 'B']], { fly: true });
  say('大家都沒得借，那就移走吧', '');
  await step(tok);                                   // 117:37 兄弟變附屬 → 紅
  R.set(['A', 'Y', null, ['B', 'R']]); glow(R.c('B'), GOLD);
  B('B 變成附屬的家人 → 塗紅', ...above(R.P.get('B'), 0.9));
  say('第一件事：兄弟 B 塗紅', '它要變成「附屬品」');
  await step(tok);                                   // 117:59 A 被請下來，跟 B 住一家
  glow(R.c('B'), null); glow(R.c('A'), GOLD);
  B('A 被請下來，和 B 住一家', ...above(R.P.get('A'), 0.9));
  say('fuse：A 跟 B 住一家了', 'A 被請下來');
  await step(tok);                                   // 118:06 A 原本紅 → 當家長，塗黑
  R.set(['A', 'B', null, ['B', 'R']]);
  okT('A 原本紅 → 塗黑，結束', 0, 6.6);
  say('A 若原本是紅（家人）', '下來當一家之主，塗黑就好');
  await step(tok);                                   // 118:15 A 原本是黑？
  B('如果 A 本來就是一家之主（黑）？', ...above(R.P.get('A'), 0.9));
  say('如果 A 原本是黑', '它被請下來，上面那家就要煩惱');
  await step(tok);                                   // 118:43 加 black：double black
  glow(R.c('A'), RED);
  const p = R.P.get('A');
  tag('double black', 'ptr', p.x + 1.4, p.y + 0.3, 0.3);
  B('黑上加黑 = 還沒解決的黑', ...above(p, 0.9));
  say('A 要「加 black」', '紅變黑就解決；黑再加黑 → double black');
  await step(tok);                                   // 118:51 再看 A 的兄弟、外甥
  arrow(V3(p.x, p.y + 0.6, 0.3), V3(p.x, p.y + 1.8, 0.3), 0x7a1010);
  N('對 A 再問一次：兄弟黑嗎？有紅小孩嗎？', 0, 1.4);
  say('在上一層重新討論', 'A 的兄弟是誰？有沒有紅色小孩？');
  await step(tok);                                   // 119:18 transfer/fuse ↔ restructure/recolor
  glow(R.c('A'), null); B(null);
  N('transfer ↔ restructure；fuse ↔ recolor', 0, 1.4);
  say('整理：234 的兩招', 'transfer ↔ restructure，fuse ↔ recolor');
  await step(tok);                                   // 119:33 recolor 從底層一路往上
  const w = walker('↑', V3(p.x - 1.5, 1.0, 0));
  say('recolor 不改結構，但可能一路往上', '從底層往上層一層一層塗色');
  await hops(tok, w, [V3(p.x - 1.5, 2.6, 0), V3(p.x - 1.5, 4.2, 0), V3(p.x - 1.5, 5.8, 0)], 450);
  await step(tok);                                   // 119:43 像 AVL 更新高度
  w.mood('happy');
  B('像 AVL 從 insert 的底層往上更新高度', 0, 6.6);
  say('就像 AVL tree 往上更新高度', '確定每個該維護的顏色都對');
}]);

// ═════════ 18. Case 3：紅兄弟 = 假兄弟 → 先轉 3-node（120:08） ═════════
FRAG.push(['rblin-case3-red-sibling', 'Case 3：紅兄弟是假兄弟 → 先 rotate 那個 3-node', async (tok) => {
  const { L, R } = pairL({ dx: 1.05 });
  L.set([['A', 'B'], [[['x']], [['y']], [['z']]]]);
  R.set(['A', 'B', ['x', 'B'], ['B', 'R', ['y', 'B'], ['z', 'B']]]);
  const Bb = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 120:10 兄弟不同層的情形
  say('「老師，兄弟不同層你還沒講」', '');
  await step(tok);                                   // 120:20 要移掉的黑 node，兄弟是紅
  glow(R.c('x'), RED); glow(R.c('B'), GOLD);
  Bb('x 黑、兄弟 B 卻是紅的', ...above(R.P.get('B'), 0.9));
  say('特徵：要移掉的 x 是黑', '它的兄弟 B 是紅色');
  await step(tok);                                   // 120:58 紅色是假兄弟
  noT('假兄弟！', R.P.get('B').x + 1.0, R.P.get('B').y + 0.3);
  glow(R.c('y'), GREEN); glow(L.c('y'), GREEN);
  say('這個紅色 B 是假兄弟', 'x 在 234 的真兄弟是 y');
  await step(tok);                                   // 121:08 它其實是爸爸那一層的
  glowAll(L, ['A', 'B'], GOLD);
  N('A、B 同一家：B 是 234 裡爸爸那一層', -3.4, 0.6);
  say('B 其實是 234 裡「爸爸那一層」的人', 'A B 是同一個 3-node');
  await step(tok);                                   // 121:29 3-node 排法不合預期
  glowAll(L, ['A', 'B'], null);
  Bb('A 在上、B 在下：排法不合預期', ...above(R.P.get('A'), 0.9));
  say('問題出在 3-node 的排法', 'A 在上、B 在下，不是我們要的');
  await step(tok);                                   // 121:39 3-node 有兩種排列
  N('3-node 本來就有兩種畫法', 3.4, 0.4);
  say('3-node 有兩種排列方式', '何必選折磨自己的那種？');
  await step(tok);                                   // 121:49 轉成 B 在上、A 在下
  Bb(null);
  R.set(['B', 'B', ['A', 'R', ['x', 'B'], ['y', 'B']], ['z', 'B']]);
  glowAll(R, ['A', 'B'], GOLD);
  say('先轉一轉：B 上去（塗黑）、A 下來（塗紅）', '234 完全沒變，只是換個畫法');
  await step(tok);                                   // 122:14 真兄弟黑色帶頭
  glowAll(R, ['A', 'B'], null);
  Bb('x 的兄弟變成黑色的 y', ...above(R.P.get('y'), 0.9));
  say('現在 x 的兄弟是 y', '一定是黑色帶頭的真兄弟');
  await step(tok);                                   // 122:30 照前面兩個步驟處理
  okT('→ 回到 Case 1 / Case 2', 3.4, 0.2);
  say('找到真兄弟以後', '照前面兩個步驟（Case 1 或 2）處理');
}]);

// ═════════ 19. 完整的 remove 步驟（122:44） ═════════
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
  C.ls.forEach((l) => showL(l, false));
  const Y = (i) => 6.0 - i * 0.62;
  const show = (i) => { showL(C.ls[i], true); C.hl(i); };
  const map = (i, t) => tag(t, 'ptr alt', 3.8, Y(i), 0);
  await step(tok);                                   // 122:52 try to remove leaf
  showL(C.ls[0], true); show(1);
  say('第一步：try to remove leaf', '先把問題換成移掉 leaf');
  await step(tok);                                   // 123:01 red → easy
  show(2);
  say('移掉的是紅色 → easy', '');
  await step(tok);                                   // 123:13 black → 看情形
  show(3);
  say('移掉的是黑色', '分幾種情形');
  await step(tok);                                   // 123:22 a. red sibling → 先 rotate
  show(4);
  say('a. 兄弟是紅的 → 找不到真兄弟', '先 rotate 那個 3-node，把它轉正');
  await step(tok);                                   // 124:04 真兄弟有紅小孩
  show(5);
  say('b. 真兄弟（一定是黑）有紅小孩？', '');
  await step(tok);                                   // 124:19 → restructure
  show(6);
  say('有 → restructure', '做完就結束');
  await step(tok);                                   // 124:31 沒有 → recolor
  show(7);
  say('c. 真兄弟只有黑小孩 → recolor', '');
  await step(tok);                                   // 124:52 檢查上一層
  show(8);
  say('recolor 完檢查上一層安不安好', '沒安好就繼續，安好才停');
  await step(tok);                                   // 125:10 每一步都對應 234
  C.hl(-1);
  say('每一步都一對一對應 234 的操作', '');
  await step(tok);                                   // 125:32 4/3-node easy
  map(2, '234：remove 4/3-node（easy）');
  say('234：4-node、3-node 移掉 → 簡單', '= 紅黑樹拿掉紅 leaf');
  await step(tok);                                   // 125:45 2-node：先整理真兄弟
  map(4, '額外一步：整理出真兄弟');
  say('234：2-node 要移掉', '先整理好真兄弟在哪（額外的一步）');
  await step(tok);                                   // 125:52 有得借 → restructure
  map(5, '234：transfer（借人）');
  say('有得借就借', '= restructure');
  await step(tok);                                   // 126:00 沒得借 → fuse → recolor
  map(7, '234：fuse（合併）');
  say('沒得借就 fuse', '= recolor');
  await step(tok);                                   // 126:06 recolor 還要處理上一層
  map(8, '= remove from upper level');
  say('recolor 還要往上一層處理', '這是最困難的部分');
}]);

// ═════════ 20. 為什麼還是 O(log n)（129:08） ═════════
FRAG.push(['rblin-rm-logn', 'Remove 為什麼還是 O(log n)', async (tok) => {
  const { L, R } = pairL();
  L.set(T0L); R.set(R0L);
  const B = bubbler(); const N = bubbler(note);
  await step(tok);                                   // 129:45 為什麼只要 log n？
  say('這麼複雜，為什麼還是 O(log n)？', '仔細想想');
  await step(tok);                                   // 129:48 高度都 bound 在 log n
  N('234 tree 的高度 = O(log n)', -3.4, 1.0);
  say('因為高度都被限制在 log n', '234 tree 的高度是 O(log n)');
  await step(tok);                                   // 129:58 一個 234 node 最多兩層 RB
  const xs = [5, 16].map((k) => R.P.get(k));
  const gb = ghostBox('#8a6d3b', Math.abs(xs[1].x - xs[0].x) + 1.1, Math.abs(xs[1].y - xs[0].y) + 1.1, 1.1);
  gb.position.set((xs[0].x + xs[1].x) / 2, (xs[0].y + xs[1].y) / 2, 0);
  glowAll(L, [5, 16], GOLD);
  B('一個 234 node（5 16）→ 最多兩層', 3.4, 7.3);
  say('一個 234 node 最多變成兩層紅黑樹', '所以紅黑樹高度也是 O(log n)');
  await step(tok);                                   // 130:07 只跟樹高有關 → log n
  kill(gb); glowAll(L, [5, 16], null); B(null);
  say('只要每個操作只跟樹高有關', '總時間就在 O(log n) 裡');
  await step(tok);                                   // 130:14 跟高度有關的：recolor
  N('removal 裡跟高度有關的：recolor', 3.4, 0.4);
  say('removal 裡跟高度有關的是 recolor', '');
  await step(tok);                                   // 130:22 一連串 recolor ↔ 一連串 fuse
  const cnt = pkt('recolor × 0', 6.4, 0.9);
  const w = walker('', R.P.get(7), RCL);
  say('一層一層往上 recolor', '對應 234 一連串的 fuse');
  let n = 0;
  for (const k of [11, 16, 5]) { await hopTo(tok, w, R.P.get(k), 420); n++; txt(cnt, 'recolor × ' + n); }
  await step(tok);                                   // 130:39 其他一層就解決：restructure
  kill(w.g); glowAll(R, [16, 11], GREEN);
  N('restructure：從隔壁借完就沒事', 3.4, 0.4);
  say('其他操作幾乎一層就解決', '例如 restructure = 從隔壁借');
  await step(tok);                                   // 130:51 就算 10 層，底層借完就沒事
  B('就算樹有 10 層：底層借到就結束', 3.4, 7.3);
  say('借人不會牽扯到其他層', '在最底層做完 restructure 就沒事');
  await step(tok);                                   // 131:22 紅兄弟：轉一次就好
  glowAll(R, [16, 11], null);
  N('紅兄弟：爸爸跟兄弟轉一次，就有黑兄弟', 3.4, 0.4);
  say('只有紅兄弟？先轉一轉', '轉一次就好');
  await step(tok);                                   // 131:41 唯一重複的只有 recolor
  B('唯一會重複的步驟：recolor', 3.4, 7.3);
  say('操作雖然複雜，但不會重複', '唯一重複的只有 recolor');
  await step(tok);                                   // 132:05 找 node 也是樹高
  const f = walker('找', R.P.get(5));
  say('找要移掉的 node（或替身 leaf）', '從 root 走到 leaf = 樹高');
  await hops(tok, f, [R.P.get(16), R.P.get(11), R.P.get(7)], 420);
  await step(tok);                                   // 132:18 找 = 樹高、維護 = 樹高 → O(log n)
  f.mood('happy'); B(null);
  okT('找 = 樹高、維護 = 樹高 → O(log n)', 0, 0.2);
  say('找到花樹高的時間，維護也是樹高', '所以 remove 還是 O(log n)');
}]);

// ═════════ 21. double black 往上傳的例子（132:26） ═════════
FRAG.push(['rblin-double-black', 'Double black：下層 recolor，上層 restructure', async (tok) => {
  fresh([0, 3.4, 11.5], [0, 3.2, 0]);
  const R = RBVl({ cx: 0, top: 5.8, dx: 0.8, dy: 1.25, sz: 0.66 });
  const T0 = ['P', 'B', ['A', 'B', ['x', 'B'], ['y', 'B']], ['S', 'B', ['f', 'B'], ['C', 'R', ['d', 'B'], ['e', 'B']]]];
  const B = bubbler(); const N = bubbler(note);
  let bb = null;
  await step(tok);                                   // 132:26 black black 怎麼檢查上面
  say('double black 要怎麼往上檢查？', '');
  await step(tok);                                   // 132:36 = 還沒解決的東西
  B('double black = 一個「還沒解決」的記號', 0, 7.0);
  say('它代表：這裡還有沒解決的黑', '');
  await step(tok);                                   // 133:27 多幾層的例子
  B(null);
  R.set(T0, { drop: ['P', 'A', 'x', 'y', 'S', 'f', 'C', 'd', 'e'] });
  say('畫一棵多幾層、node 很少的樹', '（自己設計的具體例子）');
  await step(tok);                                   // 133:40 大部分黑，中間接一個紅
  glow(R.c('C'), GOLD);
  N('幾乎都是黑，只有 C 是紅', 0, 0.2);
  say('大部分是黑色', 'S 下面接一個紅色的 C');
  await step(tok);                                   // 134:31 移掉 x
  glow(R.c('C'), null); glow(R.c('x'), RED);
  B('要移掉 x（黑色 leaf）', ...above(R.P.get('x'), 0.9));
  say('試著移掉 x', '');
  await step(tok);                                   // 134:49 兄弟黑、沒人可借
  R.set(['P', 'B', ['A', 'B', null, ['y', 'B']], ['S', 'B', ['f', 'B'], ['C', 'R', ['d', 'B'], ['e', 'B']]]], { fly: true });
  glow(R.c('y'), GOLD);
  B('兄弟 y 黑、沒有小孩 → 沒人可借', ...above(R.P.get('y'), 0.9));
  say('x 的兄弟 y 是黑色', '沒有紅小孩 → 沒人可借');
  await step(tok);                                   // 134:57 recolor：兄弟先塗紅
  R.set(['P', 'B', ['A', 'B', null, ['y', 'R']], ['S', 'B', ['f', 'B'], ['C', 'R', ['d', 'B'], ['e', 'B']]]]);
  tag('recolor', 'idx', -3.6, 6.8, 0);
  say('做 recolor：兄弟 y 塗紅', 'y 變成另一家的附屬家人');
  await step(tok);                                   // 135:16 A 變 black black
  glow(R.c('y'), null); glow(R.c('A'), RED); B(null);
  const p = R.P.get('A'); bb = tag('BB', 'ptr', p.x - 0.75, p.y + 0.5, 0.3);
  say('A 變成 black black', '意思是：要在上一層 remove A');
  await step(tok);                                   // 135:23 迴圈跑回上一層
  const w = walker('?', R.P.get('y'));
  await hopTo(tok, w, R.P.get('A'), 600);
  B('迴圈跑回上一層：檢查 A', ...above(R.P.get('A'), 1.5));
  say('像迴圈跑回上一層', '檢查 A 有沒有黑兄弟');
  await step(tok);                                   // 135:33 黑兄弟 S 家有人可借
  kill(w.g); glowAll(R, ['S', 'C'], GOLD);
  B('A 的兄弟 S 黑，S 家有紅的 C 可借', ...above(R.P.get('S'), 0.9));
  say('A 有黑兄弟 S', 'S 家有人可借（紅的 C）');
  await step(tok);                                   // 135:50 → restructure
  tag('restructure', 'idx', 3.6, 6.8, 0);
  say('有人可借 → 用借人的機制', '= restructure');
  await step(tok);                                   // 137:12 轉下去、轉上來
  glowAll(R, ['S', 'C', 'A'], null); kill(bb); B(null);
  R.set(['S', 'B', ['P', 'B', ['A', 'B', null, ['y', 'R']], ['f', 'B']], ['C', 'R', ['d', 'B'], ['e', 'B']]]);
  glowAll(R, ['S', 'P'], GOLD);
  say('S 轉上去、P 轉下來', 'S 原來的小孩 f 換給 P');
  await step(tok);                                   // 138:05 restructure 也要 recolor
  glowAll(R, ['S', 'P'], null);
  R.set(['S', 'B', ['P', 'B', ['A', 'B', null, ['y', 'R']], ['f', 'B']], ['C', 'B', ['d', 'B'], ['e', 'B']]]);
  glow(R.c('C'), GREEN);
  N('S 拿 P 原本的顏色；P、C 塗黑', 0, 0.2);
  say('restructure 也要順便改顏色', 'C 塗黑；S 拿 P 原本的顏色');
  await step(tok);                                   // 138:11 restructure 一次性
  glow(R.c('C'), null);
  okT('restructure 是一次性的：做完就解決', 0, 7.0);
  say('restructure 做完就解決', '不用再往上 recolor');
  await step(tok);                                   // 138:30 沒人可借 → recolor，黑再往上
  N('若那層也沒人可借 → recolor，黑繼續往上傳', 0, 0.2);
  say('如果那一層也沒人可借', '就再 recolor，double black 再往上傳');
}]);

// ═════════ 22. 234 操作 ↔ RB 操作 總表（154:53） ═════════
FRAG.push(['rblin-op-table', '234 操作 ↔ 紅黑樹操作 總整理', async (tok) => {
  fresh([0, 3.4, 12.5], [0, 3.2, 0]);
  tag('2-3-4 tree', 'idx', -3.4, 6.7, 0); tag('red-black tree', 'idx', 3.0, 6.7, 0);
  const Y = (i) => 5.9 - i * 0.9;
  const Lt = [], Rt = [];
  const left = (i, t) => { Lt[i] = tag(t, 'ptr', -3.4, Y(i), 0); arrow(V3(-1.0, Y(i), 0), V3(0.4, Y(i), 0)); };
  const right = (i, t, cls = 'ptr alt') => { if (Rt[i]) txt(Rt[i], t); else Rt[i] = tag(t, cls, 3.0, Y(i), 0); };
  const mark = (l, cls) => { l.element.className = 'lab-label ' + cls; };
  await step(tok);                                   // 154:57 234 困難的：insert 到滿的家
  left(2, 'insert 4-node（滿）');
  say('234 裡困難的：insert 到已經滿的家', '（insert 4）');
  await step(tok);                                   // 155:22 insert 4 ↔ recolor
  right(2, 'recolor（可能一連串往上）');
  say('對應紅黑樹：recolor', '甚至一系列的 recolor');
  await step(tok);                                   // 155:53 insert 3：塞一個紅
  left(1, 'insert 3-node'); right(1, '加一個紅 node');
  say('insert 到 3-node', '大部分只是塞一個紅的進去');
  await step(tok);                                   // 156:12 位置不對 → restructure
  right(1, '加紅；位置不對才 restructure');
  say('兩人的相對位置跟插入的不一樣', '才要做 restructure（sometimes）');
  await step(tok);                                   // 156:35 insert 2：加紅就好
  left(0, 'insert 2-node'); right(0, '加一個紅 node');
  say('insert 到 2-node', '太簡單：加紅色就好');
  await step(tok);                                   // 156:46 remove 4：剪紅
  left(3, 'remove from 4-node'); right(3, '剪掉紅色 leaf');
  say('remove 4：一定是剪掉一個紅色的', '');
  await step(tok);                                   // 156:58 remove 3：也是剪紅
  left(4, 'remove from 3-node'); right(4, '剪掉紅色 leaf');
  say('remove 3：也是剪掉紅色', '因為 remove 一律發生在 leaf');
  await step(tok);                                   // 157:20 remove 2
  left(5, 'remove 2-node'); left(6, 'remove 2-node');
  say('remove 2：剛才花最多時間的', '');
  await step(tok);                                   // 157:32 分 transfer 與 fuse
  txt(Lt[5], 'remove 2-node：transfer'); txt(Lt[6], 'remove 2-node：fuse');
  say('234 分兩種：transfer、fuse', '');
  await step(tok);                                   // 157:44 fuse ↔ recolor
  right(6, 'recolor（可能一連串往上）');
  say('fuse ↔ recolor', 'fuse 從上面借人 → 要重新考慮顏色');
  await step(tok);                                   // 157:54 transfer ↔ restructure
  right(5, 'restructure');
  say('transfer ↔ restructure', '');
  await step(tok);                                   // 158:11 可能先 pre-restructure
  right(5, '(pre-restructure +) restructure');
  say('兄弟排法不合適時（上面是 3-node）', '先 pre-restructure，再 restructure');
  await step(tok);                                   // 158:54 234 最複雜：insert 4
  mark(Lt[2], 'bad');
  say('234 最複雜的：insert 4', '一層一層往上，改很多小紙條（指標）');
  await step(tok);                                   // 159:11 還有 fuse
  mark(Lt[6], 'bad');
  say('還有 remove 2 的 fuse', '同樣牽扯上下層的改變');
  await step(tok);                                   // 159:40 紅黑樹：都只是 recolor
  mark(Rt[2], 'good'); mark(Rt[6], 'good');
  note('只改紅/黑那個 bit，不動指標', 3.0, 0.0);
  say('這兩個最複雜的，紅黑樹都用 recolor', '只改 color bit，沒有改小紙條');
  await step(tok);                                   // 159:58 restructure 盡量少發生
  mark(Rt[1], 'note'); mark(Rt[5], 'note');
  say('restructure 只在逼不得已時才做', '插進排錯的 3-node、或 2-node 向人借');
  await step(tok);                                   // 160:25 不像 AVL 每次都檢查
  bub('不像 AVL：每次插入都完整檢查、旋轉', -3.4, 0.0);
  say('紅黑樹的重要特性', '大部分只是插進去、頂多改個顏色');
}]);

// ═════════ 23. 紅黑樹的 official 三條規則（161:00） ═════════
FRAG.push(['rblin-rb-official', '紅黑樹 official 三條規則', async (tok) => {
  const R = rulesTree();
  const B = bubbler();
  await step(tok);                                   // 161:04 書上的三條規則
  tag('書上的紅黑樹定義：三條規則', 'idx', 0, 6.9, 0);
  say('最後用書上的 official 規則做 summary', '大部分課本都寫這三條');
  await step(tok);                                   // 161:11 一、紅色的小孩一定是黑
  glowAll(R, [16], GOLD); glowAll(R, [11, 21], GREEN);
  B('一、紅色 node 的小孩一定是黑', ...above(R.P.get(16), 0.95));
  say('規則一：紅色的小孩一定是黑', '那個小孩就是下一層的 234 node（含蟑螂腳）');
  await step(tok);                                   // 161:43 二、root 是黑
  glowAll(R, [16, 11, 21], null); glow(R.c(5), GREEN);
  B('二、root 是黑', ...above(R.P.get(5), 0.9));
  say('規則二：root 是黑', '= 234 node 的 representative（代表）');
  await step(tok);                                   // 162:07 external node（蟑螂腳）
  glow(R.c(5), null); glowFeet(R, GOLD);
  B('三、看 external node（蟑螂腳）', 0, 0.2);
  say('規則三：看這些 external node', '也就是蟑螂腳');
  await step(tok);                                   // 162:18 往上數到 root：black depth 一樣
  glowFeet(R, null); B(null);
  const cnt = pkt('黑 × 0', 5.4, 1.0);
  const w = walker('', R.foot(3, -1));
  say('從每隻蟑螂腳往上數黑色', '數到 root 的黑色數量都一樣 = black depth');
  let n = 0;
  for (const k of [3, 5]) { await hopTo(tok, w, R.P.get(k), 420); n++; txt(cnt, '黑 × ' + n); }
  await step(tok);                                   // 162:42 black depth = 234 的高度
  w.mood('happy');
  note('black depth = 2-3-4 tree 的高度', 0, 0.2);
  say('black depth 其實就是 234 tree 的高度', '用 234 看就不難懂');
  await step(tok);                                   // 163:14 神奇的維護來自 234
  const t = buddy('234', '', KCL, -4.6, 2.2, 0.5, 0.7); t.mood('happy');
  bub('black depth 的維護，來源就是我', -4.6, 3.5);
  say('最神奇的 black depth 維護', '來源是：紅黑樹從 234 tree 變化而來');
}]);

// ═════════ 24. 樹的家族：BST、AVL、2-3、2-3-4、RB、AA、B-tree（163:44） ═════════
FRAG.push(['rblin-tree-family', '樹的家族：AVL、2-3、2-3-4、紅黑、AA、B-tree', async (tok) => {
  fresh([0, 3.8, 13], [0, 3.6, 0]);
  const box = (t, c, x, y) => cube(t, c, [2.1, 0.75, 0.7], x, y, 0, 3);
  let bst, rb;
  await step(tok);                                   // 163:51 從 BST 出發
  bst = box('BST', '#4b9ee2', 0, 0.8);
  say('從 Binary Search Tree 出發', '整理 BST 與 multiway tree 的關係');
  await step(tok);                                   // 164:02 rigorous balancing → AVL
  box('AVL', '#4b9ee2', -4.4, 3.0); arrow(V3(-0.9, 1.2, 0), V3(-3.8, 2.6, 0));
  say('做嚴格的 balancing → AVL tree', '');
  await step(tok);                                   // 164:10 往 multiway：2-3 tree
  box('2-3', KCL, 1.6, 3.0); arrow(V3(0.4, 1.2, 0), V3(1.3, 2.6, 0));
  say('往 multiway 發展：2-3 tree', '只有 2-node、3-node');
  await step(tok);                                   // 164:22 再到 2-3-4 tree
  box('2-3-4', KCL, 1.6, 5.0); arrow(V3(1.6, 3.4, 0), V3(1.6, 4.6, 0));
  say('再到 2-3-4 tree', '');
  await step(tok);                                   // 164:40 234 的 BST 版本 = 紅黑樹
  rb = box('red-black', BCL, 5.4, 5.0); arrow(V3(2.7, 5.0, 0), V3(4.3, 5.0, 0));
  say('2-3-4 tree 的 binary 版本 = 紅黑樹', '');
  await step(tok);                                   // 164:45 2-3 的版本 = AA tree
  box('AA tree', '#b9ad98', 5.4, 3.0); arrow(V3(2.7, 3.0, 0), V3(4.3, 3.0, 0));
  say('2-3 tree 也有 binary 版本', '叫 AA tree');
  await step(tok);                                   // 165:05 紅黑樹比較 popular
  glow(rb, GOLD); okT('最 popular', 5.4, 6.0);
  say('紅黑樹在需要的性質上取得較好的平衡', '所以比較 popular');
  await step(tok);                                   // 165:23 multiway 再發展 → B-tree
  glow(rb, null);
  const bt = box('B-tree', KCL, 1.6, 7.0); arrow(V3(1.6, 5.4, 0), V3(1.6, 6.6, 0)); glow(bt, GOLD);
  say('multiway 再發展下去', '是一整個 B-tree family');
  await step(tok);                                   // 165:33 一個 node 裝很多資料
  note('一個 node 裝很多資料', -1.6, 7.0);
  say('特性：一個 node 可以裝很多資料', '');
  await step(tok);                                   // 165:49 一次抓一大把，不用拿小紙條到處找
  const hand = pkt('一次抓一大把 ✓', -6.0, 6.0);
  await travel(tok, hand, V3(-6.0, 6.0, 0.4), V3(-1.4, 6.2, 0.4), 900);
  say('一次把一大把資料抓起來', '不用拿著小紙條到處找（像 array 比 linked list 集中）');
  await step(tok);                                   // 167:03 external storage
  const disk = prop('disk', -5.0, -0.6, 1.0, 1.0, 'external storage（硬碟）'); bob(disk, 0.04);
  say('適合用在 external storage', '例如：在硬碟上做資料結構');
  await step(tok);                                   // 167:23 硬碟上的 BST：磁頭轉來轉去
  const head = pkt('磁頭', -5.6, 0.6);
  say('在硬碟上放 binary search tree？', '每拿 4 個 byte 就要轉一次磁頭 → 很慢');
  for (const [x, y] of [[-4.2, 0.9], [-5.4, 0.3], [-4.6, 1.2]]) await travel(tok, head, head.position.clone(), V3(x, y, 1.6), 450);
  await step(tok);                                   // 168:07 multiway：存取一個 node 一把抓
  noT('磁頭轉來轉去 ✗', -5.0, 2.2);
  okT('multiway：一次讀整個 node ✓', -1.6, 7.7);
  say('multiway search tree', '保留搜尋性質，存取一個 node 時一把抓');
  await step(tok);                                   // 168:20 還有 B+ tree 等變化
  note('還有 B+ tree 等許多變化', 4.6, 7.0);
  say('B-tree 還有很多變化', '例如 B+ tree（這門課沒時間講）');
  await step(tok);                                   // 169:05 了解儲存媒介才能設計好的資料結構
  bub('先了解儲存媒介的特性，才能設計好的 data structure', 0, -0.4);
  say('重要的概念', '針對不同的儲存媒介，設計不同的資料結構');
}]);
  }
  // ═══ qa-ds4.js（課堂 Q&A 段落的場景） ═══
  {
const { V3, fresh, tag, cube, kill, fly, move, glow, tint, txt, line, arrow, ghostBox, prop, step, GOLD, GREEN } = K;
const RBR = '#d64545', RBB = '#2b2b2b';
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0.4) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0.5) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const wipe = (arr) => { arr.forEach(kill); arr.length = 0; };
// a multi-key node: keys side by side, returns the key cubes
function knode(keys, x, y, color = '#4b9ee2', w = 0.7) { return keys.map((k, i) => cube(k, color, [w, 0.6, 0.7], x + (i - (keys.length - 1) / 2) * (w + 0.05), y, 0)); }

// ── cH8nH0Enjhw：4-node 為什麼只能放 3 個 ──
FRAG.push(['qa-234-4node', '4-node 只能放 3 個 key（黑 + 兩紅）', async (tok) => {
  fresh([0, 3.6, 12], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // 4-node：4 個小孩、3 個東西
  S.push(...knode([10, 20, 30], -3.4, 3.4));
  for (let i = 0; i < 4; i++) S.push(line(-3.4 - 1.1 + i * 0.75, 3.1, -3.4 - 1.6 + i * 1.05, 2.0));
  S.push(tag('4-node：4 個小孩、裡面 3 個 key', 'ptr', -3.4, 4.4));
  say('4-node 的意思是有 4 個小孩的 node', '裡面只能放 3 個東西');
  await step(tok);                                   // 對應紅黑樹：一黑兩紅
  S.push(arrow(V3(-1.6, 3.4, 0), V3(0.8, 3.4, 0)));
  const b = cube(20, RBB, [0.7, 0.7, 0.7], 3.2, 3.6, 0), r1 = cube(10, RBR, [0.7, 0.7, 0.7], 2.0, 2.3, 0), r2 = cube(30, RBR, [0.7, 0.7, 0.7], 4.4, 2.3, 0);
  S.push(b, r1, r2, line(3.2, 3.25, 2.0, 2.65), line(3.2, 3.25, 4.4, 2.65));
  S.push(tag('紅黑樹：一個黑的帶兩個紅的', 'ptr', 3.2, 5.3));
  say('放了 3 個東西的 4-node', '對應到紅黑樹：一個黑的、兩個紅的已經串好');
  await step(tok);                                   // 再放一個紅的就不行
  const n4 = cube(25, '#f0a8a8', [0.7, 0.6, 0.7], -0.6, 4.6, 0); S.push(n4);
  const r3 = cube(25, RBR, [0.7, 0.7, 0.7], 3.8, 1.0, 0); S.push(r3, line(4.4, 1.95, 3.8, 1.35));
  S.push(bad('第 4 個 key：4-node 放不下', -3.4, 1.0), bad('紅下面再接紅：不行', 3.2, -0.1));
  say('再塞一個紅的進去就不行了', '所以 4-node 要先 split（紅黑樹要先調整）');
}]);

// ── gqphGLSGyQ4：recolor 往上傳遞 = fuse 往上一層做 removal ──
FRAG.push(['qa-rb-recolor-up', 'recolor 往上傳遞 = fuse 後在上一層做 removal', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // 同學問：recolor 向上傳遞怎麼理解
  const root = knode([40], 0, 4.6); const L = knode([20], -2.6, 3.2); const R = knode([60], 2.6, 3.2);
  const LL = knode([10], -3.8, 1.8), LR = knode([30], -1.4, 1.8), RL = knode([50], 1.4, 1.8), RR = knode([70], 3.8, 1.8);
  S.push(...root, ...L, ...R, ...LL, ...LR, ...RL, ...RR);
  [[0, 4.3, -2.6, 3.5], [0, 4.3, 2.6, 3.5], [-2.6, 2.9, -3.8, 2.1], [-2.6, 2.9, -1.4, 2.1], [2.6, 2.9, 1.4, 2.1], [2.6, 2.9, 3.8, 2.1]].forEach(([a, b, c, d]) => S.push(line(a, b, c, d)));
  S.push(bubble('recolor 往上傳遞要怎麼理解？', -3.6, 5.6));
  say('同學問：紅黑樹 removal 的 recolor 往上傳', '要怎麼理解？先看 2-3-4 樹');
  await step(tok);                                   // fuse：這層移完了，從上面請一個下來
  fly(LL[0]);
  await beat(tok, 900);
  move(L[0], -1.75, 1.8); tint(L[0], '#f0a030'); move(LR[0], -1.0, 1.8);
  const gh = ghostBox('#e06666', 0.8, 0.6, 0.7); gh.position.set(-2.6, 3.2, 0); S.push(gh);
  S.push(bad('左邊的 node 空了 → 上一層也要做 removal', 0, 0.7));
  S.push(good('fuse：20 從上面請下來，和 30 合併', 0, 0.0));
  say('刪掉 10，兄弟借不到 → fuse', '從上面請一個 key 下來＝在上面那一層執行 removal');
  await step(tok);                                   // recolor 就是在上一層做同樣的事
  glow(L[0], null);
  S.push(pkt('紅黑樹：double black 往上傳', 1.8, 5.6));
  glow(root[0], GOLD);
  S.push(note('recolor 往上傳 = fuse 後在上一層做 removal', 0, -0.8));
  say('上面那一層要執行 removal', '在紅黑樹裡就是在上面那裡執行 recolor：一模一樣的事');
}]);

// ── IWzYoXKaRIc：題外話 B-tree ──
FRAG.push(['qa-btree-fanout', 'B-tree：分支很多、樹很矮', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // 有一種樹叫 B-tree
  S.push(cube('BST', '#4b9ee2', [0.9, 0.6, 0.7], -4.2, 4.2, 0), line(-4.2, 3.9, -4.9, 2.9), line(-4.2, 3.9, -3.5, 2.9));
  S.push(tag('2 個 children', 'idx', -4.2, 2.4));
  const bn = cube('B-tree node', '#2fc092', [4.6, 0.6, 0.7], 1.6, 4.2, 0); S.push(bn);
  for (let i = 0; i < 12; i++) S.push(line(1.6 - 2.2 + i * 0.4, 3.9, 1.6 - 3.6 + i * 0.65, 2.9));
  S.push(tag('上千個 children，key 保持排序', 'idx', 1.6, 2.4));
  say('每個 node 很多 children 會怎樣？', '真的有這種樹：B-tree');
  await step(tok);                                   // 用在磁碟上的資料庫
  const dk = prop('disk', -4.6, 0, 0.6, 1.0); S.push(dk);
  S.push(arrow(V3(-3.8, 0.8, 0.6), V3(-0.4, 3.6, 0), 0xa8730f));
  S.push(bad('每讀一個 node = 一次很貴的 disk access', 1.4, 1.2));
  say('B-tree 用在磁碟上的資料庫', '每讀一個 node 都要一次 disk access，很貴');
  await step(tok);                                   // 讀幾百 bytes 和幾 KB 差不多
  S.push(good('讀幾 bytes 和讀幾 KB 成本差不多 → node 做大', 1.4, 0.4));
  await K.anim(tok, 900, (u) => bn.scale.set(1 + u * 0.3, 1 + u * 0.4, 1));
  say('既然都要讀一次，node 要多大都可以', '讀幾百 bytes 跟幾 KB 的成本差不多');
  await step(tok);                                   // 仍然是 log n
  wipe(S);
  S.push(line(-5, 0, 1, 0));
  const b2 = cube('', '#4b9ee2', [1.0, 3.0, 0.8], -3.6, 1.5, 0), b1k = cube('', '#2fc092', [1.0, 0.3, 0.8], -1.2, 0.15, 0);
  S.push(b2, b1k, tag('binary：log₂(10⁹) ≈ 30 層', 'idx', -3.6, 3.4), tag('B-tree：log₁₀₀₀(10⁹) = 3 層', 'idx', -1.0, 0.8));
  S.push(note('children 數是常數 → 高度還是 O(log n)', 3.4, 3.0));
  say('只要 children 的數量是常數', '高度一樣是 log n，只是底數大、樹非常矮');
  await step(tok);                                   // 不用旋轉，用別的方法平衡
  S.push(bad('1000 個 children 的旋轉？太複雜', 3.4, 1.8), good('B-tree 用 split / merge 保持平衡', 3.4, 1.0));
  say('B-tree 不用旋轉', '它用別的方法（node 分裂、合併）保持平衡');
}]);

// ── Lzr5-m7ap-8：Open Addressing 要連 key 一起存 ──
FRAG.push(['qa-oa-store-key', 'Open Addressing：table 裡要把 key 一起存', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  const X = (i) => -4.55 + i * 1.3;
  const slots = []; for (let i = 0; i < 8; i++) { slots.push(cube('', '#f6deb0', [1.15, 0.5, 0.9], X(i), 0.6, 0)); S.push(tag(String(i), 'idx', X(i), -0.1)); }
  S.push(...slots);
  await step(tok);                                   // 下次怎麼確定拿到的是自己的？
  const kw = cube('5', '#4b9ee2', [0.9, 0.5, 0.7], X(3), 1.2, 0, 2); S.push(kw);
  const p1 = pkt('h(kiwi) = 3', X(3), 2.5); S.push(p1);
  await beat(tok, 900);
  const ap = cube('7', '#2fc092', [0.9, 0.5, 0.7], X(4), 1.2, 0, 2); S.push(ap);
  const p2 = pkt('h(apple) = 3 → 被占了，放 4', X(4) + 1.2, 3.3); S.push(p2);
  S.push(bubble('下次拿 apple，怎麼知道 4 號是我的？', -1.4, 4.6));
  say('collision 時放到附近的格子', '下次取用，怎麼確定拿到的是自己要的那筆？');
  await step(tok);                                   // 把 key 也存起來
  K.relabel(kw, 'kiwi:5'); K.relabel(ap, 'apple:7');
  S.push(good('table 裡存 (key, value)，不能只存 value', 0, 5.4));
  say('資料可能不在 key 原本對應的位置', '所以一定要把 key 和 value 一起存');
  await step(tok);                                   // 同一格可能放不同 key 的東西
  kill(p1); kill(p2);
  glow(kw, GOLD); const b3 = bad('3 號：kiwi ≠ apple', X(3) - 1.2, 2.3); S.push(b3);
  await beat(tok, 1200);
  glow(kw, null); glow(ap, GREEN); const g4 = good('4 號：apple ✓', X(4) + 1.4, 2.3); S.push(g4);
  say('拿著 key 照順序一格一格找，邊找邊比對 key', '同一格可能放著不同 key 的東西');
  await step(tok);                                   // 想成 implicit linked list
  kill(b3); kill(g4); glow(ap, null);
  S.push(note('就像 array 隱含一棵 complete binary tree：位置串起來，不寫 link', 0, -0.9));
  say('可以把 Open Addressing 想成', '在原來的空間裡串了好多條 implicit linked list');
  await step(tok);                                   // 每個 key 一串
  const hop = (a, b, c) => S.push(arrow(V3(X(a), 1.0, 0.5), V3(X(b), 1.0, 0.5), c));
  hop(1, 3, 0x4b9ee2); hop(3, 7, 0x4b9ee2);
  hop(2, 7, 0x9b7ef4);
  S.push(tag('1 → 3 → 7', 'ptr', X(2), 2.8, 0.5), tag('2 → 7', 'ptr', X(6), 2.8, 0.5));
  say('每個位置有自己要找的順序（一條鏈）', '7 號可能屬於不同的鏈 → 要靠存下來的 key 比對');
}]);

// ── Lzr5-m7ap-8：Skip List 小結 ──
FRAG.push(['qa-skiplist-recap', 'Skip List 小結：快慢車 + randomization', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.0, 0]);
  const S = [];
  const keys = [3, 7, 12, 19, 25, 31, 40, 48];
  const lv = { 7: 1, 19: 2, 31: 1, 48: 2 };
  const X = (i) => -4.2 + i * 1.3, Y = (l) => 0.6 + l * 1.1;
  const cells = {};
  for (let l = 0; l <= 2; l++) {
    S.push(cube(l === 0 ? '−∞' : '', '#6e5f49', [0.8, 0.5, 0.6], -5.6, Y(l), 0));
    let prev = -5.6;
    keys.forEach((k, i) => { if ((lv[k] || 0) >= l) { const c = cube(k, ['#4b9ee2', '#9b7ef4', '#2fc092'][l], [0.8, 0.5, 0.6], X(i), Y(l), 0); cells[l + ':' + k] = c; S.push(c, line(prev + 0.4, Y(l), X(i) - 0.4, Y(l))); prev = X(i); } });
  }
  S.push(tag('快車', 'idx', 6.1, Y(2)), tag('慢車', 'idx', 6.1, Y(0)));
  await step(tok);                                   // search 靠快慢車
  say('search：先坐快車，過頭了就下來換慢車', '像 binary search 一樣跳著找');
  for (const id of ['2:19', '1:19', '0:19', '0:25']) { glow(cells[id], GOLD); await beat(tok, 450); }
  const g25 = good('找 25：19 → 下一層 → 25', 0, 4.4); S.push(g25);
  await step(tok);                                   // insertion 靠 randomization
  Object.values(cells).forEach((c) => glow(c, null)); kill(g25);
  const nw = cube(28, '#f0a030', [0.8, 0.5, 0.6], X(4) + 0.65, -0.5, 0, 0); S.push(nw);
  S.push(pkt('丟銅板：正面 → 再長高一層', X(4) + 0.65, 3.9));
  say('insertion：新的 node 要長幾層', '靠丟銅板決定（randomization）');
  await step(tok);                                   // 很好實作
  S.push(note('有 linked list library 就能寫：約 2 倍記憶體換快速 map', 0, 5.0));
  say('這樣很隨便？其實很好實作', '有 linked list 的 library 就能快速做出一個 map');
  await step(tok);                                   // randomization 之美
  S.push(tag('之後還會看到：QuickSort 也靠 randomization', 'idx', 0, -1.4));
  say('the beauty of randomization', '未來在演算法設計裡是很有用的工具');
  await step(tok);                                   // 畫起來很像一棵 tree
  [['2:19', '1:7'], ['2:19', '1:31'], ['2:48', '1:31']].forEach(([a, b]) => { const p = cells[a].position, q = cells[b].position; S.push(arrow(V3(p.x, p.y - 0.3, 0.4), V3(q.x, q.y + 0.3, 0.4), 0xa8730f)); });
  S.push(bubble('這樣畫很像一棵 tree！', 3.8, 4.2));
  say('同學說：這樣畫很像一棵 tree', '這正是接下來要講的：skip list 跟 tree 的關係');
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
    quiz: genQ,
    pages: [
      { id: 'table', name: '比較表', render: renderTable },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['bst-insert', 'runway-k-check', 'subtree-size-rank', 'bst-delete', 'degenerate-path', 'avl-rotation', 'avl-rr-rl', 'rb-insert'].concat(FRAG.map((f) => f[0])),
    stop() { stopTimer(); epoch++; busy = false; },
  };
}
