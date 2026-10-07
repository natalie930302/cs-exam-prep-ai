// 資料結構 第2章：陣列、Linked List、Stack、Queue。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
export default function (ctx) {
  const { THREE, lab, colorFor, sleep, $, log, clearLog, setState, controls, on, say, beat } = ctx;
  let nextVal = 1;
  let busy = false; // block clicks while a traversal animation runs

function valueBlock(v, size) {
  const m = lab.box(colorFor(v), size);
  const l = lab.label(String(v), 'val');
  m.add(l);
  return m;
}
function slotTile(pos, w = 1.7, d = 1.7) {
  const t = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, d),
    new THREE.MeshStandardMaterial({ color: '#e9dcc4', roughness: 1 })
  );
  t.position.copy(pos);
  t.receiveShadow = true;
  lab.world.add(t);
  return t;
}

// ───────────────────────── Stack ─────────────────────────
const stack = { items: [], cap: 8, impl: 'array' };
const STACK_H = 0.95;
function stackPos(i) { return new THREE.Vector3(0, 0.5 + i * STACK_H, 0); }
let topLabel;

function enterStack() {
  lab.clear();
  stack.items = [];
  lab.frameCamera([7, 6.5, 13], [0, 3.6, 0]);
  // ghost column = the array's fixed capacity
  for (let i = 0; i < stack.cap; i++) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.9, 1.7),
      new THREE.MeshBasicMaterial({ color: '#c9b48e', wireframe: true, transparent: true, opacity: stack.impl === 'array' ? 0.35 : 0 })
    );
    g.position.copy(stackPos(i));
    lab.world.add(g);
    const idx = lab.label('[' + i + ']', 'idx');
    idx.position.set(-1.6, stackPos(i).y, 0);
    lab.world.add(idx);
    if (stack.impl !== 'array') idx.element.style.display = 'none';
  }
  topLabel = lab.label('top = -1', 'ptr');
  topLabel.position.set(2.4, 0.2, 0);
  lab.world.add(topLabel);
  controls(
    '<button class="primary" id="sPush">push</button>'
    + '<button id="sPop">pop</button><button id="sPeek">peek</button>'
    + '<select id="sImpl"><option value="array">陣列實作</option><option value="list">鏈結實作</option></select>'
    + '<button id="sReset">清空</button><span class="hint">拖曳畫面可旋轉視角</span>'
  );
  document.getElementById('sImpl').value = stack.impl;
  on('sPush', stackPush); on('sPop', stackPop); on('sPeek', stackPeek);
  on('sReset', () => { clearLog(); enterStack(); });
  document.getElementById('sImpl').onchange = (e) => { stack.impl = e.target.value; clearLog(); enterStack(); };
  clearLog();
  log(stack.impl === 'array'
    ? '陣列實作：先開好固定大小 ' + stack.cap + ' 的陣列，top 從 -1 開始。'
    : '鏈結實作：每次 push 動態配置一個節點接在最上面，沒有容量上限（只受記憶體限制）。');
  renderStackState();
}
function renderStackState() {
  const top = stack.items.length - 1;
  topLabel.element.textContent = stack.impl === 'array' ? 'top = ' + top : 'top → ' + (top >= 0 ? stack.items[top].v : 'NULL');
  topLabel.position.set(2.4, top >= 0 ? stackPos(top).y : 0.2, 0);
  const full = stack.impl === 'array' && top === stack.cap - 1;
  setState('Stack 狀態（LIFO：後進先出）', [
    ['實作方式', stack.impl === 'array' ? '陣列' : 'Linked List'],
    ['top', stack.impl === 'array' ? String(top) : (top >= 0 ? '指向 ' + stack.items[top].v : 'NULL')],
    ['元素個數', String(stack.items.length) + (stack.impl === 'array' ? ' / ' + stack.cap : '')],
    ['push / pop', 'O(1)'],
  ], stack.impl === 'array'
    ? 'isEmpty: top == -1 → <span class="' + (top === -1 ? 'ok' : 'no') + '">' + (top === -1) + '</span><br>'
      + 'isFull:  top == MAX-1 → <span class="' + (full ? 'ok' : 'no') + '">' + full + '</span>'
    : 'isEmpty: top == NULL → <span class="' + (top === -1 ? 'ok' : 'no') + '">' + (top === -1) + '</span><br>鏈結實作沒有 isFull（除非 malloc 失敗）');
}
function stackPush() {
  const top = stack.items.length - 1;
  if (stack.impl === 'array' && top === stack.cap - 1) {
    log('Stack Full！top 已經是 MAX-1 = ' + (stack.cap - 1) + '，陣列實作不能再 push。', true);
    return;
  }
  const v = nextVal++;
  const m = valueBlock(v);
  m.position.set(0, 12, 0);
  const b = lab.addBody(m);
  b.v = v;
  stack.items.push(b);
  lab.dropTo(b, stackPos(stack.items.length - 1));
  log(stack.impl === 'array'
    ? 'push(' + v + ')：top++ → ' + (top + 1) + '，stack[' + (top + 1) + '] = ' + v
    : 'push(' + v + ')：新節點的 link 指向舊的 top，再讓 top 指向新節點');
  renderStackState();
}
function stackPop() {
  if (!stack.items.length) { log('Stack Empty！top == -1，沒有東西可以 pop。', true); return; }
  const b = stack.items.pop();
  lab.flyAway(b, new THREE.Vector3(5, 10, 2));
  log('pop() 回傳 ' + b.v + '：' + (stack.impl === 'array' ? '取出 stack[top] 後 top--' : '暫存 top 節點，top 改指向下一個，再 free 掉舊節點'));
  renderStackState();
}
function stackPeek() {
  if (!stack.items.length) { log('Stack 是空的，peek 沒有東西。', true); return; }
  const b = stack.items[stack.items.length - 1];
  b.obj.scale.set(1.15, 1.15, 1.15);
  setTimeout(() => b.obj.scale.set(1, 1, 1), 400);
  log('peek() = ' + b.v + '（只看不拿，top 不變）');
}

// ───────────────────── Circular Queue ─────────────────────
// 採洪逸／Horowitz 課本慣例：front 指向「第一個元素的前一格」，rear 指向最後一個元素。
// 空：front == rear；滿：(rear+1) % n == front（故意空一格，才分得出空與滿）。
const queue = { n: 8, front: 0, rear: 0, slots: [], kind: 'circular' };
function qPos(i) {
  if (queue.kind === 'linear') return new THREE.Vector3((i - (queue.n - 1) / 2) * 2, 0.5, 0);
  const a = Math.PI / 2 - (i / queue.n) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * 4.2, 0.5, -Math.sin(a) * 4.2);
}
function qPtrPos(i, out) {
  const p = qPos(i);
  if (queue.kind === 'linear') return new THREE.Vector3(p.x, out ? 2.2 : -0.2, out ? 0 : 1.9);
  const r = out ? 1.55 : 1.0;
  return new THREE.Vector3(p.x * r * 1.0, out ? 1.9 : 0.15, p.z * r);
}
let frontLbl, rearLbl;
function enterQueue() {
  lab.clear();
  queue.front = 0; queue.rear = 0; queue.slots = new Array(queue.n).fill(null);
  if (queue.kind === 'linear') lab.frameCamera([0, 9, 12], [0, 0.5, 0]);
  else lab.frameCamera([0, 15, 12], [0, 0, 0.6]);
  for (let i = 0; i < queue.n; i++) {
    const p = qPos(i);
    slotTile(new THREE.Vector3(p.x, 0.02, p.z));
    const idx = lab.label('[' + i + ']', 'idx');
    const ip = queue.kind === 'linear' ? new THREE.Vector3(p.x, 0.1, -1.4) : new THREE.Vector3(p.x * 1.33, 0.1, p.z * 1.33);
    idx.position.copy(ip);
    lab.world.add(idx);
  }
  frontLbl = lab.label('front', 'ptr');
  rearLbl = lab.label('rear', 'ptr alt');
  lab.world.add(frontLbl, rearLbl);
  controls(
    '<button class="primary" id="qAdd">enqueue</button><button id="qDel">dequeue</button>'
    + '<select id="qKind"><option value="circular">環狀 Queue</option><option value="linear">線性 Queue（看假溢位）</option></select>'
    + '<label>n = <input id="qN" type="number" min="4" max="10" value="' + queue.n + '"></label>'
    + '<button id="qReset">重設</button>'
  );
  document.getElementById('qKind').value = queue.kind;
  on('qAdd', qAdd); on('qDel', qDel);
  on('qReset', () => { clearLog(); enterQueue(); });
  document.getElementById('qKind').onchange = (e) => { queue.kind = e.target.value; clearLog(); enterQueue(); };
  document.getElementById('qN').onchange = (e) => {
    queue.n = Math.max(4, Math.min(10, Number(e.target.value) || 8)); clearLog(); enterQueue();
  };
  clearLog();
  log(queue.kind === 'circular'
    ? '環狀 Queue：front = rear = 0。front 指向第一個元素的「前一格」，rear 指向最後一個元素。'
    : '線性 Queue：front = rear = -1，rear 只能一路往右，走到底就不能再放。');
  if (queue.kind === 'linear') { queue.front = -1; queue.rear = -1; }
  renderQueueState();
}
function placePtr(lbl, i, out) {
  if (i < 0) { lbl.position.copy(qPtrPos(0, out)).add(new THREE.Vector3(queue.kind === 'linear' ? -2 : 0, 0, 0)); return; }
  lbl.position.copy(qPtrPos(i, out));
}
function qCount() {
  if (queue.kind === 'linear') return queue.rear - queue.front;
  return (queue.rear - queue.front + queue.n) % queue.n;
}
function renderQueueState() {
  const n = queue.n, f = queue.front, r = queue.rear;
  frontLbl.element.textContent = 'front = ' + f;
  rearLbl.element.textContent = 'rear = ' + r;
  placePtr(frontLbl, f, false);
  placePtr(rearLbl, r, true);
  if (queue.kind === 'linear') {
    const full = r === n - 1;
    setState('線性 Queue 狀態', [
      ['front / rear', f + ' / ' + r], ['元素個數', String(qCount())], ['可用空格', String(n - 1 - r) + '（只算 rear 右邊）'],
    ], 'isEmpty: front == rear → <span class="' + (f === r ? 'ok' : 'no') + '">' + (f === r) + '</span><br>'
      + 'isFull:  rear == n-1 → <span class="' + (full ? 'ok' : 'no') + '">' + full + '</span>'
      + (full && qCount() < n ? '<br><span class="no">假溢位：前面明明有空格，卻判定為滿</span>' : ''));
    return;
  }
  const full = (r + 1) % n === f;
  setState('環狀 Queue 狀態（FIFO：先進先出）', [
    ['n（陣列大小）', String(n)], ['front / rear', f + ' / ' + r],
    ['元素個數', qCount() + ' / 最多 ' + (n - 1)], ['enqueue / dequeue', 'O(1)'],
  ], '個數 = (rear − front + n) % n = (' + r + ' − ' + f + ' + ' + n + ') % ' + n + ' = ' + qCount() + '<br>'
    + 'isEmpty: front == rear → <span class="' + (f === r ? 'ok' : 'no') + '">' + (f === r) + '</span><br>'
    + 'isFull:  (rear+1) % n == front → (' + r + '+1) % ' + n + ' = ' + ((r + 1) % n) + ' → <span class="' + (full ? 'ok' : 'no') + '">' + full + '</span>');
}
function qAdd() {
  const n = queue.n;
  if (queue.kind === 'linear') {
    if (queue.rear === n - 1) {
      log('Queue Full：rear 已經到 n-1。' + (queue.front >= 0 ? '前面還有 ' + (queue.front + 1) + ' 格空著，這就是「假溢位」，環狀 Queue 用 % 繞回來解決。' : ''), true);
      return;
    }
    queue.rear += 1;
  } else {
    const nr = (queue.rear + 1) % n;
    if (nr === queue.front) {
      log('Queue Full：(rear+1) % n = ' + nr + ' == front。故意留一格空著，否則滿和空都會是 front == rear，分不出來。', true);
      return;
    }
    queue.rear = nr;
  }
  const v = nextVal++;
  const m = valueBlock(v, [1.3, 0.8, 1.3]);
  m.position.copy(qPos(queue.rear)).add(new THREE.Vector3(0, 9, 0));
  const b = lab.addBody(m); b.v = v;
  queue.slots[queue.rear] = b;
  lab.dropTo(b, qPos(queue.rear));
  log('enqueue(' + v + ')：rear = ' + (queue.kind === 'linear' ? 'rear + 1' : '(rear+1) % n') + ' = ' + queue.rear + '，q[' + queue.rear + '] = ' + v);
  renderQueueState();
}
function qDel() {
  if (queue.front === queue.rear) { log('Queue Empty：front == rear，沒有元素可以 dequeue。', true); return; }
  queue.front = queue.kind === 'linear' ? queue.front + 1 : (queue.front + 1) % queue.n;
  const b = queue.slots[queue.front];
  queue.slots[queue.front] = null;
  if (b) lab.flyAway(b, new THREE.Vector3(0, 9, 5));
  log('dequeue() 回傳 ' + (b ? b.v : '?') + '：front = ' + (queue.kind === 'linear' ? 'front + 1' : '(front+1) % n') + ' = ' + queue.front + '，取出 q[' + queue.front + ']');
  renderQueueState();
}

// ───────────────────── Linked List ─────────────────────
const list = { nodes: [] };
const GAP = 2.7;
let cursor, headLbl;
function nodePos(i) { return new THREE.Vector3((i - (list.nodes.length - 1) / 2) * GAP, 0.5, 0); }
function makeNode(v) {
  const g = new THREE.Group();
  const data = lab.box(colorFor(v), [1.2, 0.8, 1.2]);
  const link = lab.box('#d8c29b', [0.5, 0.8, 1.2]);
  link.position.x = 0.85;
  g.add(data, link);
  data.add(lab.label(String(v), 'val'));
  return g;
}
const arrows = [];
function redrawArrows() {
  arrows.forEach((a) => lab.world.remove(a));
  arrows.length = 0;
  list.nodes.forEach((b, i) => {
    const from = b.target.clone().add(new THREE.Vector3(1.1, 0, 0));
    const to = i + 1 < list.nodes.length ? list.nodes[i + 1].target.clone().add(new THREE.Vector3(-0.62, 0, 0)) : null;
    if (to) {
      const dir = to.clone().sub(from);
      const a = new THREE.ArrowHelper(dir.clone().normalize(), from, dir.length(), 0x6e5f49, 0.3, 0.2);
      lab.world.add(a); arrows.push(a);
    } else {
      const nl = lab.label('NULL', 'idx');
      nl.position.copy(from).add(new THREE.Vector3(0.7, 0, 0));
      lab.world.add(nl); arrows.push(nl);
    }
  });
  headLbl.position.copy(list.nodes.length ? list.nodes[0].target.clone().add(new THREE.Vector3(0, 1.4, 0)) : new THREE.Vector3(0, 1.4, 0));
  headLbl.element.textContent = list.nodes.length ? 'head' : 'head = NULL';
}
function layoutList() {
  list.nodes.forEach((b, i) => lab.springTo(b, nodePos(i)));
  list.nodes.forEach((b, i) => b.target.copy(nodePos(i)));
  redrawArrows();
}
function enterList() {
  lab.clear();
  arrows.length = 0;
  list.nodes = [];
  lab.frameCamera([0, 7, 14], [0, 0.5, 0]);
  headLbl = lab.label('head', 'ptr');
  lab.world.add(headLbl);
  cursor = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 12, 48), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  cursor.rotation.x = Math.PI / 2;
  cursor.visible = false;
  lab.world.add(cursor);
  for (const v of [3, 7, 1, 9]) {
    const b = lab.addBody(makeNode(v)); b.v = v; list.nodes.push(b);
  }
  list.nodes.forEach((b, i) => b.obj.position.copy(nodePos(i)));
  layoutList();
  controls(
    '<label>位置 k = <input id="lK" type="number" min="0" value="2"></label>'
    + '<button class="primary" id="lHead">插入到開頭</button><button id="lAt">插入到第 k 個</button>'
    + '<button id="lDel">刪除第 k 個</button><button id="lReset">重設</button>'
  );
  on('lHead', () => listInsert(0)); on('lAt', () => listInsert(kVal())); on('lDel', () => listDelete(kVal()));
  on('lReset', () => { clearLog(); enterList(); });
  clearLog();
  log('Singly Linked List：每個節點 = data + link。只能從 head 往後走，沒有索引可以直接跳。');
  renderListState(0);
}
function kVal() { return Math.max(0, Number(document.getElementById('lK').value) || 0); }
function renderListState(steps, op = '') {
  setState('Linked List 狀態', [
    ['節點數', String(list.nodes.length)],
    ['剛才的操作', op || '—'],
    ['走訪步數', String(steps)],
  ], '插入／刪除「已知位置的節點」本身是 O(1)：只改 link<br>但要先從 head 走到第 k 個 → O(k)，最壞 O(n)<br>對照陣列：插入要把後面全部往後搬 → O(n)');
}
async function walkTo(k) {
  cursor.visible = true;
  let steps = 0;
  for (let i = 0; i < k && i < list.nodes.length; i++) {
    cursor.position.copy(list.nodes[i].target).setY(0.05);
    log('  走訪：p 在節點 ' + list.nodes[i].v + '（第 ' + i + ' 個）');
    steps++;
    await sleep(450);
  }
  return steps;
}
async function listInsert(k) {
  if (busy) return; busy = true;
  k = Math.min(k, list.nodes.length);
  const v = nextVal++ + 10;
  log('插入 ' + v + ' 到位置 ' + k + (k === 0 ? '（開頭，不用走訪）' : '，先從 head 走 ' + k + ' 步找到前一個節點'));
  const steps = k === 0 ? 0 : await walkTo(k);
  cursor.visible = false;
  const b = lab.addBody(makeNode(v)); b.v = v;
  b.obj.position.copy(nodePos(Math.max(0, k))).add(new THREE.Vector3(0, 6, 0));
  list.nodes.splice(k, 0, b);
  layoutList();
  b.obj.position.y = 6;
  lab.dropTo(b, nodePos(k));
  log(k === 0 ? '新節點.link = head；head = 新節點（2 個指標操作）' : '新節點.link = p.link；p.link = 新節點（順序不能反，否則後半段會斷掉）');
  renderListState(steps, '插入 ' + v + (k === 0 ? '（O(1)）' : '（走訪 O(k)）'));
  busy = false;
}
async function listDelete(k) {
  if (busy) return;
  if (!list.nodes.length) { log('串列是空的，沒有節點可以刪。', true); return; }
  busy = true;
  k = Math.min(k, list.nodes.length - 1);
  log('刪除位置 ' + k + (k === 0 ? '（開頭）' : '，先走 ' + k + ' 步找到前一個節點'));
  const steps = k === 0 ? 0 : await walkTo(k);
  cursor.visible = false;
  const [b] = list.nodes.splice(k, 1);
  lab.flyAway(b, new THREE.Vector3(0, 8, 5));
  layoutList();
  log(k === 0 ? 'head = head.link；free(舊 head)' : '前一個.link = 被刪節點.link；free(被刪節點)');
  renderListState(steps, '刪除 ' + b.v);
  busy = false;
}

// ───────────────── Postfix（對應林軒田 Stack/Queue 課 35:00–104:00） ─────────────────
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
function tokenize(s) {
  return (s.replace(/\s+/g, '').match(/\d+(?:\.\d+)?|[A-Za-z]\w*|[-+*/^()]/g) || []);
}
// 產生轉換步驟：每一步記錄 stack 與 output 的快照，以及套用了哪條規則。
function infixSteps(tokens) {
  const st = [], out = [], steps = [];
  const snap = (tok, why) => steps.push({ tok, why, stack: [...st], out: [...out] });
  for (const t of tokens) {
    if (/^[\d.]+$|^[A-Za-z]/.test(t)) { out.push(t); snap(t, '運算元直接輸出'); continue; }
    if (t === '(') { st.push(t); snap(t, '左括號直接 push（在 stack 外優先權最高）'); continue; }
    if (t === ')') {
      while (st.length && st[st.length - 1] !== '(') { out.push(st.pop()); snap(t, '遇到右括號：一直 pop 到左括號為止'); }
      st.pop(); snap(t, '丟掉左括號（括號不會出現在 postfix）'); continue;
    }
    const rightAssoc = t === '^';
    while (st.length && st[st.length - 1] !== '(' &&
      (rightAssoc ? PREC[st[st.length - 1]] > PREC[t] : PREC[st[st.length - 1]] >= PREC[t])) {
      const top = st[st.length - 1];
      out.push(st.pop());
      snap(t, 'stack 頂端 ' + top + ' 的優先權 ' + (rightAssoc ? '>' : '≥') + ' ' + t + '，先 pop 輸出');
    }
    st.push(t);
    snap(t, 'push ' + t + (st.length > 1 && st[st.length - 2] === '(' ? '（左括號在 stack 內優先權最低，不會被比下去）' : ''));
  }
  while (st.length) { out.push(st.pop()); snap('結束', '算式讀完：把 stack 剩下的全部 pop 輸出'); }
  return steps;
}
function evalSteps(post) {
  const st = [], steps = [];
  for (const t of post) {
    if (!PREC[t]) { st.push(Number(t)); steps.push({ tok: t, why: '運算元 push', stack: [...st] }); continue; }
    const b = st.pop(), a = st.pop();
    const r = t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : Math.pow(a, b);
    st.push(+r.toFixed(6));
    steps.push({ tok: t, why: 'pop 出 ' + b + '（右）和 ' + a + '（左），算 ' + a + ' ' + t + ' ' + b + ' = ' + (+r.toFixed(6)) + ' 再 push', stack: [...st] });
  }
  return steps;
}
const pf = { steps: [], i: -1, kind: 'convert', blocks: [], timer: null };
function enterPostfix() {
  lab.clear();
  pf.blocks = [];
  lab.frameCamera([6, 6, 13], [0, 3.2, 0]);
  controls(
    '<input id="pfExpr" style="width:200px" value="3/4-5+6*7-8*9">'
    + '<button class="primary" id="pfConv">Infix → Postfix</button><button id="pfEval">計算 Postfix</button>'
    + '<button id="pfNext">下一步</button><button id="pfAuto">自動播放</button>'
  );
  on('pfConv', () => startPf('convert'));
  on('pfEval', () => startPf('eval'));
  on('pfNext', pfStep);
  on('pfAuto', () => {
    clearInterval(pf.timer);
    pf.timer = setInterval(() => { if (!pfStep()) clearInterval(pf.timer); }, 900);
  });
  clearLog();
  log('這是老師課堂上的例子（約 39:00）：3/4−5+6*7−8*9，答案 −34.25。可以換成自己的算式，支援 + − * / ^ 和括號。');
  startPf('convert');
}
function startPf(kind) {
  clearInterval(pf.timer);
  const toks = tokenize(document.getElementById('pfExpr').value);
  const conv = infixSteps(toks);
  const post = conv.length ? conv[conv.length - 1].out : [];
  if (kind === 'eval' && post.some((t) => /^[A-Za-z]/.test(t))) { log('算式裡有變數，只能轉換，不能直接計算。', true); kind = 'convert'; }
  pf.kind = kind;
  pf.post = post;
  pf.steps = kind === 'convert' ? conv : evalSteps(post);
  pf.i = -1;
  syncPfStack([]);
  clearLog();
  log(kind === 'convert'
    ? '轉換規則：運算元直接輸出；運算子進 stack 前，先把頂端「優先權 ≥ 自己」的都 pop 出來（同級要 pop，才能維持左結合）。'
    : '計算規則：從左到右讀 postfix，運算元 push；遇到運算子就 pop 兩個，先 pop 出來的是右邊那個。');
  renderPfState();
}
function syncPfStack(items) {
  // 讓 3D stack 與快照一致：共同前綴保留，多的飛走，少的掉下來
  let k = 0;
  while (k < pf.blocks.length && k < items.length && pf.blocks[k].tok === String(items[k])) k++;
  while (pf.blocks.length > k) lab.flyAway(pf.blocks.pop(), new THREE.Vector3(5, 9, 2));
  for (let i = k; i < items.length; i++) {
    const t = String(items[i]);
    const isOp = PREC[t] || t === '(';
    const m = lab.box(isOp ? '#c08a1f' : '#2fc092', [2.2, 0.9, 1.6]);
    m.add(lab.label(t, 'val'));
    m.position.set(0, 12, 0);
    const b = lab.addBody(m); b.tok = t;
    pf.blocks.push(b);
    lab.dropTo(b, stackPos(i));
  }
}
function pfStep() {
  if (pf.i >= pf.steps.length - 1) { log('已經是最後一步了。'); return false; }
  pf.i++;
  const s = pf.steps[pf.i];
  syncPfStack(s.stack);
  log('讀到 ' + s.tok + '：' + s.why);
  renderPfState();
  return true;
}
function renderPfState() {
  const s = pf.steps[pf.i];
  const done = pf.i === pf.steps.length - 1;
  if (pf.kind === 'convert') {
    setState('Infix → Postfix（operator stack）', [
      ['第幾步', (pf.i + 1) + ' / ' + pf.steps.length],
      ['目前讀到', s ? s.tok : '—'],
      ['stack（底→頂）', s && s.stack.length ? s.stack.join(' ') : '空'],
    ], 'output：' + (s ? s.out.join(' ') : '') + (done ? '<br><span class="ok">完成</span>' : ''));
  } else {
    setState('計算 Postfix（operand stack）', [
      ['postfix', pf.post.join(' ')],
      ['第幾步', (pf.i + 1) + ' / ' + pf.steps.length],
      ['stack（底→頂）', s && s.stack.length ? s.stack.join('，') : '空'],
    ], done && s ? '答案 = <span class="ok">' + s.stack[0] + '</span>' : '每個運算子都是：pop 右、pop 左、算完 push 回去');
  }
}

// ───────────────── 迷宮：Stack → DFS，Queue → BFS（對應課程 110:00–174:00） ─────────────────
const MAZE = [
  '#########',
  '#S..#...#',
  '#.#.#.#.#',
  '#.#...#.#',
  '#.###.#.#',
  '#...#.#.#',
  '###.#.#.#',
  '#.....#G#',
  '#########',
];
const mz = { kind: 'stack', tiles: {}, container: [], parent: {}, marked: new Set(), cur: null, done: false, popped: 0, timer: null };
function cellPos(r, c) { return new THREE.Vector3((c - 4) * 1.1, 0, (r - 4) * 1.1); }
function enterMaze() {
  lab.clear();
  lab.frameCamera([0, 13, 9], [0, 0, 0.5]);
  mz.tiles = {};
  MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
    const p = cellPos(r, c);
    if (ch === '#') {
      const w = lab.box('#b9a582', [1.05, 0.9, 1.05]); w.position.copy(p).setY(0.45); lab.world.add(w);
    } else {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: '#f3ead9' }));
      t.position.copy(p).setY(0.05); t.receiveShadow = true; lab.world.add(t);
      mz.tiles[r + ',' + c] = t;
      if (ch === 'S' || ch === 'G') { const l = lab.label(ch === 'S' ? '起點' : '終點', 'ptr'); l.position.copy(p).setY(1); lab.world.add(l); }
    }
  }));
  controls(
    '<select id="mzKind"><option value="stack">用 Stack（DFS）</option><option value="queue">用 Queue（BFS）</option></select>'
    + '<button class="primary" id="mzStep">下一步</button><button id="mzAuto">自動播放</button><button id="mzReset">重來</button>'
  );
  document.getElementById('mzKind').value = mz.kind;
  document.getElementById('mzKind').onchange = (e) => { mz.kind = e.target.value; enterMaze(); };
  on('mzStep', mazeStep);
  on('mzAuto', () => { clearInterval(mz.timer); mz.timer = setInterval(() => { if (!mazeStep()) clearInterval(mz.timer); }, 220); });
  on('mzReset', enterMaze);
  clearInterval(mz.timer);
  const s = findCell('S');
  mz.container = [s]; mz.parent = { [s]: null }; mz.marked = new Set([s]); mz.cur = null; mz.done = false; mz.popped = 0;
  paint(s, '#f2c46d');
  clearLog();
  log('老師的版本：放進容器時就先做 to-do 標記，同一格不會被放兩次（約 121:46）。');
  log(mz.kind === 'stack' ? '容器是 Stack：每次拿「最後放進去」的格子 → 一路往深處走（DFS）。' : '容器是 Queue：每次拿「最早放進去」的格子 → 一圈一圈往外擴（BFS）。');
  renderMazeState();
}
function findCell(ch) { for (let r = 0; r < MAZE.length; r++) { const c = MAZE[r].indexOf(ch); if (c >= 0) return r + ',' + c; } }
function paint(key, color) { const t = mz.tiles[key]; if (t) t.material.color.set(color); }
function mazeStep() {
  if (mz.done) return false;
  if (!mz.container.length) { log('容器空了，走不到終點。', true); mz.done = true; return false; }
  if (mz.cur) paint(mz.cur, '#cfe8dc');
  const key = mz.kind === 'stack' ? mz.container.pop() : mz.container.shift();
  mz.cur = key; mz.popped++;
  paint(key, '#2fc092');
  const [r, c] = key.split(',').map(Number);
  if (MAZE[r][c] === 'G') {
    mz.done = true;
    let len = 0;
    for (let k = key; k; k = mz.parent[k]) { paint(k, '#c08a1f'); len++; }
    log('到終點！共從容器取出 ' + mz.popped + ' 次，找到的路徑長 ' + (len - 1) + ' 步。'
      + (mz.kind === 'queue' ? 'BFS 找到的一定是步數最少的路。' : 'DFS 找到的路不保證最短，換成 Queue 比比看。'));
    renderMazeState();
    return false;
  }
  for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const k2 = (r + dr) + ',' + (c + dc);
    if (MAZE[r + dr][c + dc] !== '#' && !mz.marked.has(k2)) {
      mz.marked.add(k2); mz.parent[k2] = key; mz.container.push(k2); paint(k2, '#f2c46d');
    }
  }
  renderMazeState();
  return true;
}
function renderMazeState() {
  setState(mz.kind === 'stack' ? '迷宮：Stack → DFS' : '迷宮：Queue → BFS', [
    ['容器', mz.kind === 'stack' ? 'Stack（後進先出）' : 'Queue（先進先出）'],
    ['已取出', String(mz.popped) + ' 次'],
    ['容器內待走', String(mz.container.length) + ' 格'],
  ], '綠色＝正在走的格子，黃色＝已放進容器（to-do），淺綠＝走過，橘色＝最後找到的路<br>'
    + '同一個演算法，只是把容器從 Stack 換成 Queue，行為就從 DFS 變成 BFS。');
}


function renderCmp(pageEl) {
  const rows = [
    ['存取第 i 個', 'O(1)', 'O(n)', 'O(n)', '—', '—'],
    ['在開頭插入', 'O(n)', 'O(1)', 'O(1)', 'push O(1)', '—'],
    ['在尾端插入', 'O(1)＊', 'O(n)（有 tail 指標則 O(1)）', 'O(1)（有 tail）', '—', 'enqueue O(1)'],
    ['在中間插入（已知位置）', 'O(n)', 'O(1)', 'O(1)', '—', '—'],
    ['刪除開頭', 'O(n)', 'O(1)', 'O(1)', 'pop O(1)', 'dequeue O(1)'],
    ['刪除已知節點', 'O(n)', 'O(n)（要找前一個）', 'O(1)', '—', '—'],
    ['搜尋某個值', 'O(n)；排序後二分 O(log n)', 'O(n)', 'O(n)', '—', '—'],
  ];
  const cls = (t) => (/^O\(1\)/.test(t) || /O\(1\)$/.test(t) ? 'o1' : /O\(n\)/.test(t) ? 'on' : '');
  pageEl.innerHTML = '<h2>各結構的時間複雜度</h2>'
    + '<p>考試最常考的是「為什麼」：陣列靠連續記憶體所以能 O(1) 存取，但插入要搬資料；Linked List 改 link 就好，但只能從頭走。</p>'
    + '<table class="lab-table"><thead><tr><th>操作</th><th>Array</th><th>Singly LL</th><th>Doubly LL</th><th>Stack</th><th>Queue（環狀）</th></tr></thead><tbody>'
    + rows.map((r) => '<tr>' + r.map((c, i) => i ? '<td class="' + cls(c) + '">' + c + '</td>' : '<th>' + c + '</th>').join('') + '</tr>').join('')
    + '</tbody></table><p class="src">＊陣列尾端插入：空間夠時 O(1)；動態陣列需要擴充時那一次是 O(n)，攤銷後 O(1)。</p>'
    + '<h3>容易搞混的地方</h3>'
    + '<div class="lab-trap">Singly LL「刪除已知節點」不是 O(1)：要改前一個節點的 link，得先從 head 找到前一個。Doubly LL 有 prev 指標才是 O(1)。</div>'
    + '<div class="lab-trap">「在中間插入 O(1)」的前提是已經拿到那個位置的指標；如果題目只給索引 k，要先走訪，總共是 O(k)。</div>'
    + '<div class="lab-trap">環狀 Queue 用 n 格陣列最多只能放 n−1 個元素（故意空一格）。如果另外記一個 count 變數，就能放滿 n 個。</div>';
}
let quizState = { score: 0, total: 0 };
function genQueueQ() {
  const n = 5 + Math.floor(Math.random() * 6);
  const f = Math.floor(Math.random() * n), r = Math.floor(Math.random() * n);
  const kind = Math.random() < 0.5 ? 'count' : 'full';
  if (kind === 'count') {
    const ans = (r - f + n) % n;
    const opts = [...new Set([ans, (f - r + n) % n, Math.abs(r - f), (ans + 1) % n])];
    return { q: '環狀 Queue 陣列大小 n = ' + n + '，front = ' + f + '，rear = ' + r + '（front 指向第一個元素的前一格）。目前有幾個元素？',
      opts: opts.map(String), ans: String(ans), why: '(rear − front + n) % n = (' + r + ' − ' + f + ' + ' + n + ') % ' + n + ' = ' + ans };
  }
  const full = (r + 1) % n === f;
  return { q: '環狀 Queue n = ' + n + '，front = ' + f + '，rear = ' + r + '。這時候能再 enqueue 嗎？',
    opts: ['可以', '不行，已經滿了'], ans: full ? '不行，已經滿了' : '可以',
    why: '(rear+1) % n = ' + ((r + 1) % n) + (full ? ' == front，所以滿了' : ' ≠ front，所以還沒滿') };
}
function renderQuiz(pageEl) {
  const pool = genQueueQ();
  const opts = [...pool.opts].sort(() => Math.random() - 0.5);
  pageEl.innerHTML = '<h2>小測驗</h2><div class="lab-quiz-score">答對 ' + quizState.score + ' / ' + quizState.total + '</div>'
    + '<div class="lab-quiz-q">' + pool.q + '</div><div class="lab-quiz-opts">'
    + opts.map((o) => '<button data-o="' + encodeURIComponent(o) + '">' + o + '</button>').join('') + '</div><div id="qx"></div>';
  pageEl.querySelectorAll('.lab-quiz-opts button').forEach((btn) => {
    btn.onclick = () => {
      if (pageEl.querySelector('.right')) return;
      const pick = decodeURIComponent(btn.dataset.o);
      quizState.total++;
      if (pick === pool.ans) quizState.score++;
      pageEl.querySelectorAll('.lab-quiz-opts button').forEach((b) => {
        const o = decodeURIComponent(b.dataset.o);
        if (o === pool.ans) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
      });
      document.getElementById('qx').innerHTML = '<div class="lab-quiz-explain">' + (pick === pool.ans ? '答對了。' : '答錯了。') + pool.why + '</div><button class="lab-next" id="qNext">下一題</button>';
      document.getElementById('qNext').onclick = () => renderQuiz(pageEl);
    };
  });
}


const DEMOS = {
  'stack-lifo': async (tok) => {
    stack.impl = 'array'; enterStack(); say('Stack：只能從最上面放、從最上面拿', '');
    await beat(tok, 1200);
    for (let i = 0; i < 4; i++) { stackPush(); say('push：疊到最上面，top + 1', 'top = ' + (stack.items.length - 1)); await beat(tok, 1100); }
    for (let i = 0; i < 3; i++) { stackPop(); say('pop：最後放進去的最先拿出來（LIFO）', 'top = ' + (stack.items.length - 1)); await beat(tok, 1300); }
    await beat(tok, 1500);
  },
  'queue-fifo': async (tok) => {
    queue.kind = 'linear'; queue.n = 7; enterQueue(); say('Queue：從 rear 進、從 front 出', '');
    await beat(tok, 1200);
    for (let i = 0; i < 4; i++) { qAdd(); say('enqueue：放在 rear 後面', 'rear = ' + queue.rear); await beat(tok, 1000); }
    for (let i = 0; i < 2; i++) { qDel(); say('dequeue：最早進來的先出去（FIFO）', 'front = ' + queue.front); await beat(tok, 1300); }
    await beat(tok, 1500);
  },
  'queue-false-full': async (tok) => {
    queue.kind = 'linear'; queue.n = 6; enterQueue(); say('線性 Queue：rear 只能一路往右', '');
    await beat(tok, 1000);
    for (let i = 0; i < 6; i++) { qAdd(); await beat(tok, 650); }
    say('rear 走到底：判定為滿', 'rear == n − 1');
    await beat(tok, 1400);
    qDel(); await beat(tok, 700); qDel();
    say('前面空出兩格……', 'front = ' + queue.front);
    await beat(tok, 1500);
    qAdd();
    say('還是不能放！這就是「假滿」', '<span class="no">rear == n − 1 → 滿</span>，但前面明明有空位');
    await beat(tok, 3200);
  },
  'circular-queue': async (tok) => {
    queue.kind = 'circular'; queue.n = 6; enterQueue(); say('環狀 Queue：陣列頭尾接起來', 'front = rear = 0');
    await beat(tok, 1300);
    for (let i = 0; i < 5; i++) { qAdd(); say('enqueue：rear = (rear + 1) % n', 'rear = ' + queue.rear); await beat(tok, 800); }
    qAdd();
    say('只放了 n − 1 個就滿了：故意空一格', '<span class="ok">(rear + 1) % n == front</span> → 滿');
    await beat(tok, 2600);
    qDel(); await beat(tok, 700); qDel();
    say('dequeue：front = (front + 1) % n', 'front = ' + queue.front);
    await beat(tok, 1500);
    qAdd(); say('rear 繞回 0，繼續用前面的空位', 'rear = (5 + 1) % 6 = 0');
    await beat(tok, 2000);
    while (queue.front !== queue.rear) { qDel(); await beat(tok, 600); }
    say('全部取完', '<span class="ok">front == rear</span> → 空');
    await beat(tok, 2600);
  },
  'list-insert': async (tok) => {
    enterList(); say('Linked List：節點用指標串起來', '');
    await beat(tok, 1200);
    say('插入第 2 個位置：先從 head 走過去', 'O(k) 走訪 + O(1) 改指標');
    await listInsert(2); await beat(tok, 1400);
    say('插在開頭：不用走訪', 'O(1)');
    await listInsert(0); await beat(tok, 1400);
    say('刪除第 3 個：一樣先走到前一個', '前一個.link = 被刪.link');
    await listDelete(3); await beat(tok, 2200);
  },
  'postfix-eval': async (tok) => {
    enterPostfix();
    document.getElementById('pfExpr').value = (ctx.params || {}).expr || '3/4-5+6*7-8*9';
    startPf('eval');
    say('Postfix 求值：數字 push，遇到運算子就 pop 兩個來算', pf.post.join(' '));
    await beat(tok, 1600);
    while (pf.i < pf.steps.length - 1) {
      pfStep();
      const s = pf.steps[pf.i];
      say(PREC[s.tok] ? 'pop 兩個、計算、push 回去' : '數字：直接 push', s.why);
      await beat(tok, 1300);
    }
    say('最後 stack 裡剩下的就是答案', '= <span class="ok">' + pf.steps[pf.steps.length - 1].stack[0] + '</span>');
    await beat(tok, 3000);
  },
  'infix-to-postfix': async (tok) => {
    enterPostfix();
    document.getElementById('pfExpr').value = (ctx.params || {}).expr || '3/4-5+6*7-8*9';
    startPf('convert');
    say('Infix → Postfix：運算元直接輸出，運算子進 stack 排隊', '');
    await beat(tok, 1600);
    while (pf.i < pf.steps.length - 1) {
      pfStep();
      const s = pf.steps[pf.i];
      say(s.why, 'output：' + s.out.join(' '));
      await beat(tok, 1300);
    }
    await beat(tok, 3000);
  },
  'maze-dfs': async (tok) => {
    mz.kind = 'stack'; enterMaze(); say('用 Stack 走迷宮：一路往深處走，走不通再退回', '');
    await beat(tok, 1300);
    while (mazeStep()) await beat(tok, 260);
    say('Stack → DFS：找得到路，但不一定最短', '取出 ' + mz.popped + ' 次');
    await beat(tok, 3200);
  },
  'maze-compare': async (tok) => {
    for (const kind of ['stack', 'queue']) {
      mz.kind = kind; enterMaze();
      say(kind === 'stack' ? '容器用 Stack → DFS' : '同一個演算法，容器換成 Queue → BFS', '');
      await beat(tok, 1300);
      while (mazeStep()) await beat(tok, 200);
      const m = ($('log').lastChild.textContent.match(/路徑長 (\d+)/) || [])[1];
      say(kind === 'stack' ? 'DFS 找到的路' : 'BFS 一圈一圈往外：找到的一定最短', '路徑長 ' + (m || '?') + ' 步');
      await beat(tok, 2800);
    }
  },
};

  const TITLES = {"stack-lifo": "Stack：後進先出", "queue-fifo": "Queue：先進先出", "queue-false-full": "線性 Queue 的假滿", "circular-queue": "環狀 Queue", "list-insert": "Linked List 插入與刪除", "postfix-eval": "Postfix 求值", "infix-to-postfix": "Infix 轉 Postfix", "maze-dfs": "Stack 走迷宮（DFS）", "maze-compare": "DFS 與 BFS"};
  const scenes = {};
  Object.keys(DEMOS).forEach((id) => { scenes[id] = { title: TITLES[id] || id, play: DEMOS[id] }; });

  return {
    kicker: '資料結構・第 2 章',
    title: '陣列、Linked List、Stack、Queue',
    color: 'var(--ds)',
    modes: [
      { id: 'stack', name: 'Stack', enter: enterStack },
      { id: 'queue', name: 'Circular Queue', enter: enterQueue },
      { id: 'list', name: 'Linked List', enter: enterList },
      { id: 'postfix', name: 'Postfix', enter: enterPostfix },
      { id: 'maze', name: '迷宮 DFS／BFS', enter: enterMaze },
    ],
    pages: [
      { id: 'cmp', name: '複雜度對照', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['stack-lifo', 'queue-fifo', 'queue-false-full', 'circular-queue', 'list-insert', 'postfix-eval', 'infix-to-postfix', 'maze-dfs', 'maze-compare'],
    stop() { clearInterval(pf.timer); clearInterval(mz.timer); },
  };
}
