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
  if (queue.kind === 'linear') return new THREE.Vector3((i - (queue.n - 1) / 2) * 1.75, 0.5, 0);
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
  if (i < 0) { lbl.position.copy(qPtrPos(0, out)).add(new THREE.Vector3(queue.kind === 'linear' ? -1.4 : 0, 0, 0)); return; }
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
function nodePos(i) { const n = list.nodes.length, g = Math.min(GAP, 10 / Math.max(1, n - 1)); return new THREE.Vector3((i - (n - 1) / 2) * g - 0.5, 0.5, 0); }
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

  // ───────────────────────── 跟著影片的場景：共用小工具 ─────────────────────────
  const V3 = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const GOLD = '#6a4a00', GREEN = '#0f5a3a', RED = '#7a1010', GRAY = '#d8cfc0';
  const MONO = { whiteSpace: 'pre', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', fontWeight: '600' };
  function fresh(pos, look) { clearInterval(pf.timer); clearInterval(mz.timer); lab.clear(); arrows.length = 0; controls(''); lab.frameCamera(pos, look); }
  function tag(text, cls, x, y, z = 0) { const l = lab.label(text, cls || ''); l.position.set(x, y, z); lab.world.add(l); return l; }
  // a value cube; dropH > 0 makes it fall into place from that height
  function cube(text, color, size, x, y, z = 0, dropH = 0) {
    const m = lab.box(color, size);
    if (text !== null && text !== undefined && text !== '') { m.userData.lbl = lab.label(String(text), 'val'); m.add(m.userData.lbl); }
    if (dropH > 0) { m.position.set(x, y + dropH, z); lab.dropTo(lab.addBody(m), V3(x, y, z)); }
    else { m.position.set(x, y, z); lab.world.add(m); }
    return m;
  }
  function bodyOf(o) { for (const b of lab.bodies) if (b.obj === o) return b; return lab.addBody(o); }
  const move = (o, x, y, z = 0) => lab.springTo(bodyOf(o), V3(x, y, z));
  const fly = (o, dir) => lab.flyAway(bodyOf(o), dir || V3((Math.random() - 0.5) * 6, 8, 4));
  function kill(o) {
    if (!o) return;
    for (const b of lab.bodies) if (b.obj === o) { lab.removeBody(b); return; }
    lab.world.remove(o); o.traverse((c) => { if (c.element) c.element.remove(); });
  }
  const glow = (m, c) => { m.material.emissive = new THREE.Color(c || '#000000'); };
  const tint = (m, c) => { m.material.color.set(c); };
  const txt = (l, t) => { l.element.textContent = t; };
  const relabel = (m, t) => { if (m.userData.lbl) txt(m.userData.lbl, String(t)); };
  const showL = (l, on) => { l.element.style.visibility = on ? '' : 'hidden'; };
  // a code / pseudocode panel: one monospace label per line, hl(i) lights the current line
  function code(lines, x, yTop, dy = 0.56, z = 0) {
    const w = Math.max(...lines.map((s) => s.length));
    const ls = lines.map((s, i) => { const l = tag(s.padEnd(w, ' '), '', x, yTop - i * dy, z); Object.assign(l.element.style, MONO); return l; });
    return { ls, hl(i) { ls.forEach((l, k) => { l.element.className = 'lab-label' + (k === i ? ' ptr alt' : ''); }); }, kill() { ls.forEach(kill); } };
  }
  async function anim(tok, ms, fn) { const steps = 10; for (let k = 1; k <= steps; k++) { fn(k / steps); await beat(tok, ms / steps); } }
  function line(x1, y1, x2, y2, z = 0, color = '#c9b48e') {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(x1, y1, z), V3(x2, y2, z)]), new THREE.LineBasicMaterial({ color }));
    lab.world.add(l); return l;
  }
  // a pointer arrow from a to b (Vector3s); returns the ArrowHelper (kill() it to remove)
  function arrow(a, b, color = 0x6e5f49) {
    const d = b.clone().sub(a); const len = Math.max(0.05, d.length());
    const h = new THREE.ArrowHelper(d.normalize(), a, len, color, Math.min(0.35, len * 0.4), 0.22);
    lab.world.add(h); return h;
  }
  function ghostBox(color, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false }));
    lab.world.add(m); return m;
  }
  // a linked-list node (data box + link box) as a plain object at (x,y,z); returns the group
  function lnode(v, x, y, z = 0, color) {
    const g = new THREE.Group();
    const d = lab.box(color || colorFor(v), [1.0, 0.7, 1.0]); d.add(lab.label(String(v), 'val'));
    const k = lab.box('#d8c29b', [0.45, 0.7, 1.0]); k.position.x = 0.73;
    g.add(d, k); g.userData.data = d; g.position.set(x, y, z); lab.world.add(g); return g;
  }

  // 每段影片的場景片段（由 sync pass 加入）：每個片段把 [id, 標題, play] 放進 FRAG。
  const FRAG = [];
    // ═══ arrlin.js ═══
  {
// ─── 1yyu70Vy9Zc：林軒田 DSA（C → C++：reference、class、operator overloading、template；Array） ───
const AB = '#4b9ee2', AP = '#9b7ef4', AO = '#dd8238', AT = '#31aab0', AS = '#c9b48e', AG = '#2fc092', AK = '#e55a9b';
const SZ = [1.2, 0.8, 1.2];
function alRing(x, y, z, r) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r || 0.5, 0.05, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; m.position.set(x, y, z); lab.world.add(m); return m;
}
// a complex number object: ghost box + real / imag cubes
function alComplex(name, re, im, x, z, color, drop) {
  const g = ghostBox(color, 2.6, 1.1, 1.4); g.position.set(x, 0.5, z);
  const r = cube(re, color, [1.0, 0.7, 1.0], x - 0.6, 0.35, z, drop ? 3 : 0);
  const i = cube(im, color, [1.0, 0.7, 1.0], x + 0.6, 0.35, z, drop ? 3 : 0);
  tag('real', 'idx', x - 0.6, 0, z + 0.9); tag('imag', 'idx', x + 0.6, 0, z + 0.9);
  const n = tag(name, 'ptr', x, 1.5, z);
  return { g, r, i, n };
}
function alBar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
function alGrow(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = h0 + (h - h0) * t; m.scale.y = v; m.position.y = v / 2; }); }

// 12:31 從 C 到 C++
FRAG.push(['arrlin-c-cpp', 'C++ 是 C 的延伸', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 1, 0]);
  const cz = ghostBox(AB, 6.2, 1.4, 4.2); cz.position.set(-2.7, 0.7, 0);
  tag('C', 'ptr', -5.2, 1.9, -1.6);
  const feats = ['if', 'for', 'while', 'struct', 'pointer', 'function', 'array', 'malloc'];
  feats.forEach((f, i) => cube(f, AB, [1.2, 0.5, 1.0], -4.8 + (i % 4) * 1.4, 0.25, -0.9 + Math.floor(i / 4) * 1.8, 3));
  say('C++：C 的延伸版本', 'C 會的 if、for、struct… C++ 通通都有');
  await beat(tok, 2800);
  const pz = ghostBox(AO, 11.8, 1.8, 4.8); pz.position.set(0.4, 0.9, 0);
  tag('C++', 'ptr alt', 5.4, 2.2, -1.8);
  say('兩者交集約占 C 的九成', '其他很多東西是 C++ 加上去的');
  await beat(tok, 2600);
  const ex = cube('少數例外', RED, [1.3, 0.5, 1.0], -6.3, 0.25, 0, 3); glow(ex, RED);
  say('但不是百分之百相容', '全部用 C 寫，在 C++ 不一定會過');
  await beat(tok, 2600);
  const five = ['reference', 'class', 'operator overloading', 'template', 'STL'];
  for (let k = 0; k < five.length; k++) {
    cube(five[k], AO, [3.2, 0.45, 0.7], 3.4, 0.22, -1.8 + k * 0.9, 3);
    say('只講五個「好用的不一樣」', (k + 1) + '. ' + five[k]);
    await beat(tok, 1200);
  }
  say('不是 C++ 課：只學方便資料結構的部分', '更多差異請看課本第一章');
  await beat(tok, 3000);
}]);

// 15:21 C 的 swap：透過指標
FRAG.push(['arrlin-swap-ptr', 'C 的 swap：透過指標交換', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.8, 0]);
  const cd = code(['void swap(int *pa, int *pb) {', '  int temp = *pa;', '  *pa = *pb;', '  *pb = temp;', '}', 'swap(&x, &y);'], 0, 6.6, 0.52, -2.4);
  tag('x', 'ptr', -4, 1.4, -1); tag('y', 'ptr', 4, 1.4, -1);
  tag('位置 156', 'idx', -4, 0, 0); tag('位置 678', 'idx', 4, 0, 0);
  const X = cube(3, AB, SZ, -4, 0.4, -1, 3), Y = cube(7, AP, SZ, 4, 0.4, -1, 3);
  say('寫一段程式：交換兩個整數變數', 'x = 3、y = 7（數值為示意）');
  await beat(tok, 2600);
  cd.hl(5);
  const pa = cube('156', AS, [1.0, 0.6, 1.0], -2, 0.3, 2.4, 3), pb = cube('678', AS, [1.0, 0.6, 1.0], 2, 0.3, 2.4, 3);
  tag('pa', 'idx', -2, 0, 3.3); tag('pb', 'idx', 2, 0, 3.3);
  arrow(V3(-2.2, 0.7, 1.9), V3(-3.7, 0.7, -0.4)); arrow(V3(2.2, 0.7, 1.9), V3(3.7, 0.7, -0.4));
  say('把 x、y 的「位置」送進去', 'swap(&x, &y)：pa = 156、pb = 678');
  await beat(tok, 2800);
  cd.hl(1);
  const T = cube(3, AB, [1.0, 0.6, 1.0], 0, 0.3, 0.8, 3); tag('temp', 'idx', 0, 0, 1.7);
  glow(X, GOLD);
  say('temp = *pa：到 156 號拿出內容', 'temp = 3');
  await beat(tok, 2400);
  glow(X, null); cd.hl(2); glow(Y, GOLD); relabel(X, 7); tint(X, AP);
  say('*pa = *pb：把 678 號的內容搬到 156 號', 'x = 7');
  await beat(tok, 2400);
  glow(Y, null); cd.hl(3); glow(T, GOLD); relabel(Y, 3); tint(Y, AB);
  say('*pb = temp：把 temp 放進 678 號', 'y = 3');
  await beat(tok, 2400);
  cd.hl(-1); glow(T, null); glow(X, GREEN); glow(Y, GREEN); kill(pa); kill(pb);
  say('換成功了，但全靠位置間接操作', 'pointer：腦袋要轉好幾轉');
  await beat(tok, 3000);
}]);

// 18:46 C++ reference：call by value 的問題 → 暱稱
FRAG.push(['arrlin-swap-ref', 'C++ reference：變數的暱稱', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.8, 0]);
  tag('x', 'ptr', -4, 1.4, -1); tag('y', 'ptr', 4, 1.4, -1);
  const X = cube(3, AB, SZ, -4, 0.4, -1, 3), Y = cube(7, AP, SZ, 4, 0.4, -1, 3);
  let cd = code(['void swap(int a, int b) {', '  int t = a; a = b; b = t;', '}', 'swap(x, y);'], 0, 6.4, 0.52, -2.4);
  say('如果不用指標呢？C 是 call by value', 'void swap(int a, int b)');
  await beat(tok, 2400);
  cd.hl(3);
  const A = cube(3, AB, [1.0, 0.6, 1.0], -2, 0.3, 2.4, 3), B = cube(7, AP, [1.0, 0.6, 1.0], 2, 0.3, 2.4, 3);
  const la = tag('a（影印本）', 'idx', -2, 0, 3.4), lb = tag('b（影印本）', 'idx', 2, 0, 3.4);
  say('x 的值複製給 a、y 的值複製給 b', '像用影印機各印一份');
  await beat(tok, 2600);
  cd.hl(1); move(A, 2, 0.3, 2.4); move(B, -2, 0.3, 2.4);
  say('函式裡交換的是影印本', 'a = 7、b = 3');
  await beat(tok, 2000);
  glow(X, RED); glow(Y, RED);
  say('原稿沒有換到！', 'x 還是 3、y 還是 7');
  await beat(tok, 2600);
  fly(A); fly(B); kill(la); kill(lb); glow(X, null); glow(Y, null); cd.kill();
  cd = code(['void swap(int &a, int &b) {', '  int t = a; a = b; b = t;', '}', 'swap(x, y);'], 0, 6.4, 0.52, -2.4);
  cd.hl(0);
  tag('暱稱 a', 'ptr alt', -4, 2.2, -1); tag('暱稱 b', 'ptr alt', 4, 2.2, -1);
  say('C++：參數加上 &，就是 reference', 'a 不是影印本，而是 x 的暱稱');
  await beat(tok, 2800);
  cd.hl(1); move(X, 4, 0.4, -1); move(Y, -4, 0.4, -1);
  say('交換 a、b 就是交換 x、y 本身', 'x = 7、y = 3');
  await beat(tok, 2600);
  glow(X, GREEN); glow(Y, GREEN); cd.hl(-1);
  tag('背後：&x = 156', 'idx', -4, 0, 0.3); tag('背後：&y = 678', 'idx', 4, 0, 0.3);
  say('compiler 偷偷把暱稱換成對應的指標', 'x 在第 156 張紙、y 在第 678 張紙');
  await beat(tok, 2800);
  say('Reference：比較聰明、比較安全的 pointer', '麻煩交給 compiler（還有型別檢查）');
  await beat(tok, 3000);
}]);

// 27:55 struct：資料綁在一起，函式寫在外面
FRAG.push(['arrlin-struct-func', 'struct：資料綁在一起', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2, 0]);
  const cd = code(['struct Complex { double real, imag; };', '', 'Complex multiply(Complex a, Complex b) {', '  Complex result;', '  result.real = a.real*b.real - a.imag*b.imag;', '  result.imag = a.real*b.imag + a.imag*b.real;', '  return result;', '}'], 0, 7.2, 0.5, -2.6);
  cd.hl(0);
  const A = alComplex('a', 1, 2, -4.5, 1.6, AB, true);
  say('struct：把 real、imag 綁成一個新型態', '複數 a = 1 + 2i（數值為示意）');
  await beat(tok, 2800);
  const B = alComplex('b', 3, 4, -1.2, 1.6, AP, true);
  say('綁在一起，對這組變數的操作比較完整', '不會只改了 real 卻忘了 imag');
  await beat(tok, 2600);
  cd.hl(2);
  tag('函式寫在 struct 之外', 'ptr alt', 3.4, 2.6, 1.6);
  say('C：複數乘法是一段「外面」的函式', 'multiply(a, b)');
  await beat(tok, 2400);
  cd.hl(3);
  const R = alComplex('result', '?', '?', 3.4, 1.6, AO, true);
  await beat(tok, 1400);
  cd.hl(4); [A.r, B.r, A.i, B.i].forEach((m) => glow(m, GOLD)); relabel(R.r, -5);
  say('result.real = 1×3 − 2×4', '= −5');
  await beat(tok, 2600);
  cd.hl(5); relabel(R.i, 10);
  say('result.imag = 1×4 + 2×3', '= 10');
  await beat(tok, 2600);
  [A.r, B.r, A.i, B.i].forEach((m) => glow(m, null)); glow(R.r, GREEN); glow(R.i, GREEN); cd.hl(-1);
  say('資料的藍圖與操作分開寫：比較鬆散', 'a × b = −5 + 10i');
  await beat(tok, 3000);
}]);

// 33:05 class：資料 + 動作綁在一起
FRAG.push(['arrlin-class-method', 'class：資料與動作綁在一起', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.2, 0]);
  const cd = code(['class Complex {', 'public:', '  double real, imag;', '  void multiplyBy(Complex b) {', '    double r = real*b.real - imag*b.imag;', '    imag = real*b.imag + imag*b.real;', '    real = r;', '  }', '};', 'a.multiplyBy(b);'], 0, 7.6, 0.48, -3);
  const g = ghostBox(AB, 4.6, 1.2, 1.6); g.position.set(-2.6, 0.55, 1.6);
  cd.hl(2);
  const r = cube(1, AB, [1.0, 0.7, 1.0], -4.1, 0.35, 1.6, 3), im = cube(2, AB, [1.0, 0.7, 1.0], -2.9, 0.35, 1.6, 3);
  tag('real', 'idx', -4.1, 0, 2.5); tag('imag', 'idx', -2.9, 0, 2.5);
  tag('物件 a', 'ptr', -2.6, 1.6, 1.6);
  say('C++ 的 class：一樣有綁在一起的資料', 'public：所有程式都可以 access');
  await beat(tok, 2600);
  cd.hl(3);
  const act = cube('multiplyBy', AO, [1.7, 0.5, 1.0], -1.2, 0.25, 1.6, 3); tag('動作', 'idx', -1.2, 0, 2.5);
  say('最大差別：可以把程式寫在 class 之內', '動作 multiplyBy 和資料住在一起');
  await beat(tok, 2800);
  const B = alComplex('b', 3, 4, 3.4, 1.6, AP, true);
  await beat(tok, 1200);
  cd.hl(9);
  const msg = cube('b', AP, [0.6, 0.4, 0.6], 3.4, 2.2, 1.6); move(msg, -1.2, 1.1, 1.6);
  say('對已經存在的物件送一個指令', 'a.multiplyBy(b)');
  await beat(tok, 2200);
  kill(msg); glow(act, GOLD);
  cd.hl(5); relabel(im, 10); glow(im, GOLD);
  say('imag = 1×4 + 2×3', '= 10');
  await beat(tok, 2000);
  cd.hl(6); relabel(r, -5); glow(r, GOLD);
  say('real = 1×3 − 2×4', '= −5（先存在 r，免得 real 被先改掉）');
  await beat(tok, 2400);
  cd.hl(-1); glow(act, null); glow(r, GREEN); glow(im, GREEN);
  say('物件自己的內部狀態改變了', 'a = −5 + 10i');
  await beat(tok, 2400);
  for (let k = 0; k < 3; k++) cube('', [AK, AT, AG][k], [1.2, 0.6, 1.2], 6.0, 0.3 + k * 0.62, -0.6, 4);
  say('物件導向：每個物件像一塊樂高積木', '有自己的資料、有自己的動作，再拼成大軟體');
  await beat(tok, 3000);
}]);

// 37:08 operator overloading：c = a + b
FRAG.push(['arrlin-op-overload', 'Operator Overloading', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2, 0]);
  const st = tag('int a, b, c;   c = a + b;', 'ptr alt', 0, 4.4, 0);
  say('int：c = a + b 的語意大家都懂', '+ 是內建的（一條機器指令）');
  await beat(tok, 2600);
  const A = alComplex('a', 1, 2, -4.5, 1.6, AB, true), B = alComplex('b', 3, 4, -1.2, 1.6, AP, true);
  txt(st, 'Complex a, b, c;   c = plus(a, b);');
  const cd = code(['Complex plus(Complex a, Complex b) {', '  c.real = a.real + b.real;', '  c.imag = a.imag + b.imag;', '}'], 0, 7.0, 0.5, -2.6);
  say('如果是複數，在 C 只能寫 c = plus(a, b)', '實部加實部、虛部加虛部（數值為示意）');
  await beat(tok, 3000);
  say('運算符號和函數其實是同一回事', '只是 int 的 + 已經內建好了');
  await beat(tok, 2400);
  txt(st, 'C++：Complex a, b, c;   c = a + b;');
  say('C++：複數也可以直接寫 c = a + b', '');
  await beat(tok, 2200);
  txt(st, 'c = a + b;  →  c = operator+(a, b);');
  txt(cd.ls[0], 'Complex operator+(Complex a, Complex b) {');
  cd.hl(0);
  say('compiler 先把它翻譯成函數呼叫', '名字叫 operator+，你只要把它寫好');
  await beat(tok, 3000);
  const C = alComplex('c', '?', '?', 3.4, 1.6, AO, true);
  await beat(tok, 900);
  cd.hl(1); glow(A.r, GOLD); glow(B.r, GOLD); relabel(C.r, 4);
  say('real：1 + 3', '= 4');
  await beat(tok, 1800);
  glow(A.r, null); glow(B.r, null);
  cd.hl(2); glow(A.i, GOLD); glow(B.i, GOLD); relabel(C.i, 6);
  say('imag：2 + 4', '= 6');
  await beat(tok, 1800);
  glow(A.i, null); glow(B.i, null); cd.hl(-1); glow(C.r, GREEN); glow(C.i, GREEN);
  txt(st, '也可以翻成成員函式：c = a.operator+(b);');
  say('compiler 依型別判斷要呼叫哪段程式', 'c = 4 + 6i');
  await beat(tok, 3000);
}]);

// 43:37 作業一：GCD 從 int 改成大數
FRAG.push(['arrlin-gcd-bigint', '只換型別：int → 大數', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  const L = ['int gcd(int a, int b) {', '  while (b != 0) {', '    int r = a % b;', '    a = b;  b = r;', '  }', '  return a;', '}'];
  const cd = code(L, -2.2, 6.2, 0.56, -1);
  tag('（以輾轉相除示意）', 'idx', -2.2, 6.9, -1);
  say('作業一：最大公因數要寫兩個版本', '正整數版 ＋ 大數版');
  await beat(tok, 2800);
  tag('大數：位數比 int 能存的大很多', 'ptr', 3.6, 5.6, -1);
  say('選擇一：砍掉重練', '每個加減乘除都改成大數函式（一次加法就要跑迴圈）');
  await beat(tok, 3000);
  say('選擇二：只把型別換掉', 'int → BigInt');
  await beat(tok, 1200);
  const L2 = L.map((s) => s.replace(/\bint\b/g, 'BigInt'));
  const w = Math.max(...L2.map((s) => s.length));
  for (let i = 0; i < L.length; i++) {
    if (L2[i] !== L[i]) { cd.hl(i); cd.ls.forEach((l, k) => txt(l, (k <= i ? L2[k] : L[k]).padEnd(w, ' '))); await beat(tok, 900); }
  }
  cd.ls.forEach((l, k) => txt(l, L2[k].padEnd(w, ' ')));
  const ops = [['operator!=', 1], ['operator%', 2], ['operator=', 3]];
  for (let k = 0; k < ops.length; k++) {
    cd.hl(ops[k][1]);
    cube(ops[k][0], AO, [2.6, 0.5, 1.0], 3.8, 0.25, 0.6 + k * 1.2, 3);
    say('把大數需要的運算子定義好', ops[k][0]);
    await beat(tok, 1500);
  }
  cd.hl(-1);
  say('GCD 主程式完全不用改', '要呼叫哪個函數，compiler 幫你處理');
  await beat(tok, 2600);
  say('這就是 Operator Overloading', '同一個運算子，在不同型別上重新定義');
  await beat(tok, 3000);
}]);

// 51:00 跨型態：copy、paste、replace
FRAG.push(['arrlin-copy-paste', 'copy、paste、replace', async (tok) => {
  fresh([0, 7.5, 13], [0, 2.2, 0]);
  const rows = [['int arr[10]', 10, AB], ['double arr[10]', 10, AP], ['Complex arr[4]', 4, AO]];
  for (let r = 0; r < rows.length; r++) {
    const [nm, n, c] = rows[r];
    tag(nm, 'ptr', -5.4, 0.9, 1.0 + r * 1.3);
    for (let k = 0; k < n; k++) cube('', c, [0.6, 0.4, 0.6], -3.6 + k * 0.75, 0.2, 1.0 + r * 1.3, 2);
    await beat(tok, 700);
  }
  say('同樣的 array，只是元素型態不同', '三行的意義都差不多');
  await beat(tok, 2600);
  const A = code(['void intSort(int arr[], int n) {', '  for (int i = 0; i < n; i++) …', '}'], 0, 7.4, 0.5, -2.6);
  say('C：要 sort 一個 int array', '寫一段 intSort');
  await beat(tok, 2400);
  const B = code(['void intSort(int arr[], int n) {', '  for (int i = 0; i < n; i++) …', '}'], 0, 5.3, 0.5, -2.6);
  say('double 也要 sort？偷懶的大絕招', 'copy、paste……');
  await beat(tok, 2200);
  const B2 = ['void doubleSort(double arr[], double n) {', '  for (double i = 0; i < n; i++) …', '}'];
  const w = Math.max(...B2.map((s) => s.length));
  B.ls.forEach((l, k) => txt(l, B2[k].padEnd(w, ' ')));
  say('……replace：看到 int 就換成 double', '正常情況程式照樣會動');
  await beat(tok, 2600);
  B.hl(1); B.ls[1].element.className = 'lab-label ptr';
  say('小心！連迴圈 index 的 int 也被換掉了', 'for (double i …) 不是我們要的');
  await beat(tok, 2800);
  B.hl(-1); A.hl(-1);
  say('每種型態各寫一段：copy-paste-replace', '傳統 reuse 的第一個做法');
  await beat(tok, 3000);
}]);

// 55:22 template 與 STL
FRAG.push(['arrlin-template', 'template：程式碼的範本', async (tok) => {
  fresh([0, 7.5, 13], [0, 2.2, 0]);
  const cd = code(['template <class T>', 'void sort(T arr[], int n) {', '  … if (arr[j] < arr[i]) swap …', '}'], 0, 7.4, 0.5, -2.6);
  cd.hl(0);
  tag('範本 = 空白表格', 'ptr alt', 0, 5.0, -2.6);
  say('template：型別暫時還沒定的程式碼', '未定的型別通常叫 T');
  await beat(tok, 3000);
  cd.hl(-1);
  tag('sort(intArr, 10)', 'ptr', -3.8, 2.8, 0.6);
  say('compiler 看到要 sort 一個 int array', '找不到 int 版本，最接近的是這個範本');
  await beat(tok, 2600);
  cube('sort（T = int）', AB, [3.2, 0.5, 1.2], -3.8, 0.25, 1.6, 4);
  say('把範本印一份，T 全部換成 int', 'compiler 幫你做 copy、paste、replace');
  await beat(tok, 2800);
  tag('sort(cArr, 4)', 'ptr', 3.8, 2.8, 0.6);
  const s2 = cube('sort（T = Complex）', AO, [3.2, 0.5, 1.2], 3.8, 0.25, 1.6, 4);
  say('Complex array 也一樣：T → Complex', '');
  await beat(tok, 2400);
  glow(s2, GOLD); cd.hl(2);
  say('比較大小要用到 Complex 的 operator<', '找不到對應的程式碼，compiler 還是不會過');
  await beat(tok, 2800);
  cd.hl(-1); glow(s2, null);
  ['vector', 'list', 'stack', 'queue', 'sort'].forEach((s, k) => cube(s, AT, [1.6, 0.45, 0.9], -4 + k * 2, 0.22, 4.0, 3));
  tag('STL = Standard Template Library', 'ptr alt', 0, 1.4, 4.0);
  say('集大成的 template：STL', '寫好的資料結構與演算法，任何型別都能用');
  await beat(tok, 3200);
}]);

// 85:30 Array = 有編號的置物櫃
FRAG.push(['arrlin-locker', 'Array：有編號的置物櫃', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const X = (i) => -4.95 + i * 1.1;
  const lk = [];
  say('Array：一群 element 集合起來', 'each identified by one array index');
  for (let i = 0; i < 10; i++) {
    lk.push(cube('', AS, [1.0, 1.6, 0.9], X(i), 0.8, 0, 3));
    tag(String(i), 'idx', X(i), 1.25, 0.5);
    await beat(tok, 200);
  }
  await beat(tok, 1600);
  say('就像系館地下室的置物櫃', '理想世界：每人一個，號碼連續');
  await beat(tok, 2600);
  const it = cube('書', AO, [0.6, 0.5, 0.6], X(3), 4, 1.6);
  glow(lk[3], GOLD);
  say('用編號找到 3 號櫃子', 'arr[3]');
  await beat(tok, 1600);
  move(it, X(3), 0.5, 0.2);
  say('把東西放進去', 'arr[3] = 書');
  await beat(tok, 2200);
  kill(it); glow(lk[3], null);
  await beat(tok, 800);
  glow(lk[3], GOLD);
  const it2 = cube('書', AO, [0.6, 0.5, 0.6], X(3), 0.5, 0.2); move(it2, X(3), 0.5, 2.2);
  say('把東西拿出來', 'x = arr[3]');
  await beat(tok, 2200);
  glow(lk[3], null);
  say('有編號的櫃子 = array', '放進去、拿出來，都靠編號');
  await beat(tok, 3000);
}]);

// 89:59 記憶體是最大的 array；pointer 只是編號
FRAG.push(['arrlin-memory-pointer', '記憶體是最大的 array', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.25 + i * 1.5;
  const cs = [];
  for (let i = 0; i < 8; i++) { cs.push(cube('–', AS, [1.3, 0.6, 1.3], X(i), 0.3, 0, 2)); tag('0' + i, 'idx', X(i), 0, 1.1); }
  tag('…', 'idx', 6.6, 0.3, 0);
  say('電腦裡最大的 array：記憶體', '編號叫 address，就是 array 的 index');
  await beat(tok, 2800);
  relabel(cs[1], '寶'); tint(cs[1], AO);
  tag('b', 'ptr', X(4), 1.4, 0);
  say('宣告變數：劃出一塊位置，取個名字', '變數 b 在 04 號');
  await beat(tok, 2400);
  relabel(cs[4], '01'); tint(cs[4], AB);
  say('b 是 pointer：裡面寫著 01', '一張小紙條：「請到 01 號找」');
  await beat(tok, 2600);
  const rg = alRing(X(4), 0.05, 0, 0.8);
  const ar = arrow(V3(X(4), 1.0, 0), V3(X(1), 1.0, 0), 0xc08a1f);
  await anim(tok, 900, (t) => { rg.position.x = X(4) + (X(1) - X(4)) * t; });
  glow(cs[1], GOLD);
  say('照紙條到 01 號，打開拿出內容', '*b → 01 號的東西');
  await beat(tok, 2600);
  kill(ar); glow(cs[1], null);
  relabel(cs[3], '06'); tint(cs[3], AB); relabel(cs[6], '01'); tint(cs[6], AB);
  say('尋寶遊戲：櫃子裡放下一個櫃子的編號', '03 → 06 → 01');
  rg.position.x = X(3); glow(cs[3], GOLD);
  await beat(tok, 2000);
  await anim(tok, 700, (t) => { rg.position.x = X(3) + (X(6) - X(3)) * t; });
  glow(cs[3], null); glow(cs[6], GOLD);
  say('03 號寫著 06：去 06 號', '06 號寫著 01');
  await beat(tok, 1800);
  await anim(tok, 900, (t) => { rg.position.x = X(6) + (X(1) - X(6)) * t; });
  glow(cs[6], null); glow(cs[1], GREEN);
  say('找到寶物！', 'pointer 只是把 index 存下來');
  await beat(tok, 2400);
  say('address 4 bytes = 32 bits', '編號有 2³² 個：一個超大的 array');
  await beat(tok, 3000);
}]);

// 97:27 array = 一塊連續記憶體：Fast Random Access
FRAG.push(['arrlin-block-address', 'Array 的位置怎麼算', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.85 + i * 0.9;
  const cs = [];
  for (let i = 0; i < 14; i++) { cs.push(cube('–', GRAY, [0.8, 0.5, 0.8], X(i), 0.25, 0, 2)); tag(String(5563 + i), 'idx', X(i), 0, i % 2 ? 1.5 : 0.9); }
  say('記憶體：一大片編好號的田', '5563、5564、5565…');
  await beat(tok, 2400);
  const gb = ghostBox(AB, 9, 0.9, 1.1); gb.position.set(X(7.5), 0.45, 0);
  for (let k = 0; k < 10; k++) { tint(cs[3 + k], AB); tag('[' + k + ']', 'idx', X(3 + k), 1.0, -0.6); }
  say('array = 從中劃出連續的一小段', 'memory block：10 格');
  await beat(tok, 2600);
  tag('arr = 5566', 'ptr', X(3), 1.8, 0);
  say('arr 隱含的是第 0 格的位置', 'arr → 第 5566 號田');
  await beat(tok, 2600);
  const rg = alRing(X(3), 0.05, 0, 0.5);
  await beat(tok, 600);
  rg.position.x = X(6); glow(cs[6], GOLD);
  say('arr[3]：0 號旁邊第 3 格，一步算到', '5566 + 3 = 5569');
  await beat(tok, 2600);
  glow(cs[6], null); rg.position.x = X(12); glow(cs[12], GOLD);
  say('任何 index 都一樣快', 'arr[9]：5566 + 9 = 5575');
  await beat(tok, 2400);
  glow(cs[12], null); rg.position.x = X(6);
  relabel(cs[6], '★'); tint(cs[6], AO); glow(cs[6], GOLD);
  say('update：開櫃子、換掉內容', 'arr[3] = ★');
  await beat(tok, 2400);
  glow(cs[6], null);
  say('一格多大看型別：int 可能 4 bytes', '&arr[i] = arr + i × sizeof(型別)');
  await beat(tok, 3000);
  say('Fast Random Access：random = 任意', '只要有 index 就很快；RAM 也是這個意思');
  await beat(tok, 3000);
}]);

// 103:43 Array ADT：get / update / construct，insert / remove 很吃力
FRAG.push(['arrlin-insert-remove', 'Array 的 insert 與 remove', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.6, 0]);
  const X = (i) => -5.5 + i * 1.1;
  const tiles = [];
  for (let i = 0; i < 10; i++) { const t = cube('', GRAY, [1.0, 0.08, 1.0], X(i), 0.04, 0); tiles.push(t); tag('[' + i + ']', 'idx', X(i), 0, 0.9); }
  const arr = 'abcdefghij'.split('').map((c, i) => cube(c, AB, [0.85, 0.6, 0.85], X(i), 0.38, 0, 2));
  say('把 array 看成 data structure', 'get、update by index：算出位置就好');
  await beat(tok, 2600);
  glow(arr[2], GOLD);
  say('get(2) / update(2)：都很簡單', '再加上 construct：劃一塊記憶體');
  await beat(tok, 2400);
  glow(arr[2], null);
  say('insert by index：要把其他人推開', '先得多一格空間');
  cube('', GRAY, [1.0, 0.08, 1.0], X(10), 0.04, 0, 2); tag('[10]', 'idx', X(10), 0, 0.9);
  await beat(tok, 1800);
  let moves = 0;
  for (let i = 9; i >= 3; i--) {
    move(arr[i], X(i + 1), 0.38, 0); moves++;
    say('insert X 到 [3]：後面全部往後推', '已搬 ' + moves + ' 個');
    await beat(tok, 380);
  }
  const nx = cube('X', AO, [0.85, 0.6, 0.85], X(3), 0.38, 0, 4);
  arr.splice(3, 0, nx);
  await beat(tok, 1600);
  fly(arr[5]); arr.splice(5, 1);
  say('remove [5]：移掉之後要補位', '');
  await beat(tok, 1200);
  moves = 0;
  for (let i = 5; i < arr.length; i++) {
    move(arr[i], X(i), 0.38, 0); moves++;
    say('remove [5]：後面全部往前補', '已搬 ' + moves + ' 個');
    await beat(tok, 380);
  }
  await beat(tok, 1200);
  say('update = 放進去；insert = 塞進去', '塞進去像胖子擠進去：很吃力');
  await beat(tok, 2600);
  say('原生 array 通常只需要支援', 'get、update（頂多再加 construct）');
  await beat(tok, 3000);
}]);

// 107:02 STL vector：會自動長大的 array
FRAG.push(['arrlin-vector-grow', 'STL vector：會長大的 array', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0.4]);
  const XO = (i) => -4.95 + i * 1.1, XN = (i) => -5.7 + i * 0.6;
  const old = [];
  for (let i = 0; i < 10; i++) { old.push(cube('', GRAY, [0.9, 0.08, 0.9], XO(i), 0.04, -1.6)); tag('[' + i + ']', 'idx', XO(i), 0, -0.8); }
  const vs = 'abcdefghij'.split('').map((c, i) => cube(c, AB, [0.5, 0.45, 0.5], XO(i), 0.3, -1.6, 2));
  tag('capacity 10', 'ptr', 0, 1.4, -2.6);
  say('STL vector：get、update 一樣很快', '概念和原生 array 相同');
  await beat(tok, 2600);
  const k = cube('k', AO, [0.5, 0.45, 0.5], 5.6, 2.6, -1.6);
  say('已經滿了，還要塞到最後面', 'push_back(k)');
  await beat(tok, 2400);
  glow(k, RED);
  say('原生 array：沒位置了', '');
  await beat(tok, 1600);
  glow(k, null);
  for (let i = 0; i < 20; i++) cube('', '#e9dcc4', [0.52, 0.08, 0.52], XN(i), 0.04, 1.8);
  tag('capacity 20', 'ptr alt', 0, 1.4, 2.8);
  say('vector：自動配置更大的空間', '例：10 → 20（也可能 15）');
  await beat(tok, 2200);
  for (let i = 0; i < 10; i++) { move(vs[i], XN(i), 0.3, 1.8); await beat(tok, 150); }
  say('舊的元素全部搬過去', '');
  await beat(tok, 1400);
  old.forEach((t) => kill(t));
  move(k, XN(10), 0.3, 1.8);
  say('再把新元素放進來', 'size 11 / capacity 20');
  await beat(tok, 2400);
  say('vector：連 insert、remove 也都實作好了', '把 array 當成 data structure 的完整版');
  await beat(tok, 3000);
}]);

// 112:00 2D array：one block（row-major）
FRAG.push(['arrlin-2d-oneblock', '2D array：one block', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const GX = (j) => -2.4 + j * 1.2, GZ = (i) => -3.0 + i * 1.2, SX = (k) => -5.4 + k * 1.2;
  const L = [['A', 'B', 'C', 'D', 'E'], ['V', 'W', 'X', 'Y', 'Z']];
  const g = [];
  for (let i = 0; i < 2; i++) { tag('row ' + i, 'idx', -3.8, 0.2, GZ(i)); g.push(L[i].map((c, j) => cube(c, i ? AP : AB, [1.0, 0.6, 1.0], GX(j), 0.3, GZ(i), 3))); }
  for (let j = 0; j < 5; j++) tag('col ' + j, 'idx', GX(j), 0.9, -3.9);
  say('2D array：像圖片（例如 1024 × 768）', '這裡用 2 × 5：2 個 row、5 個 column');
  await beat(tok, 3000);
  glow(g[1][3], GOLD);
  say('index 變成一組 (row, column)', '像座標：[1][3]');
  await beat(tok, 2400);
  glow(g[1][3], null);
  for (let k = 0; k < 10; k++) { cube('', '#e9dcc4', [1.0, 0.08, 1.0], SX(k), 0.04, 2.2); tag(String(k), 'idx', SX(k), 0, 3.1); }
  say('實作一：拉成一塊長長的 1D 記憶體', 'row 0 先放，接著放 row 1（row-major）');
  const s = [];
  for (let k = 0; k < 10; k++) {
    const i = Math.floor(k / 5), j = k % 5;
    const m = cube(L[i][j], i ? AP : AB, [1.0, 0.6, 1.0], GX(j), 0.3, GZ(i)); move(m, SX(k), 0.3, 2.2); s.push(m);
    await beat(tok, 300);
  }
  await beat(tok, 1400);
  const rg = alRing(SX(0), 0.05, 2.2, 0.65);
  tag('arr', 'ptr', SX(0), 1.3, 2.2);
  glow(g[1][3], GOLD);
  say('要拿 [1][3]：從 arr 出發', '');
  await beat(tok, 1800);
  await anim(tok, 700, (t) => { rg.position.x = SX(0) + (SX(5) - SX(0)) * t; });
  glow(s[5], GOLD);
  say('先算出 row 1 的起點', 'arr + 1 × 5 = 第 5 格');
  await beat(tok, 2400);
  glow(s[5], null);
  await anim(tok, 700, (t) => { rg.position.x = SX(5) + (SX(8) - SX(8 - 3)) * t; });
  glow(s[8], GREEN);
  say('再往後走 3 步', 'arr[1][3] → arr + (1 × 5 + 3) = 第 8 格');
  await beat(tok, 2800);
  say('一樣靠快速的數學運算', 'construct 留一大塊；get / update 套式子');
  await beat(tok, 3000);
}]);

// 117:30 2D array：array of arrays
FRAG.push(['arrlin-2d-aoa', '2D array：array of arrays', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const RX = (j) => -1.4 + j * 1.2, RZ = [-1.8, 1.8], base = [1126, 5566];
  const L = [['A', 'B', 'C', 'D', 'E'], ['V', 'W', 'X', 'Y', 'Z']];
  const rows = [];
  for (let i = 0; i < 2; i++) {
    tag('row ' + i, 'ptr', RX(2), 1.3, RZ[i]);
    rows.push(L[i].map((c, j) => { tag(String(base[i] + j), 'idx', RX(j), 0, RZ[i] + 0.9); return cube(c, i ? AP : AB, [1.0, 0.6, 1.0], RX(j), 0.3, RZ[i], 3); }));
    await beat(tok, 500);
  }
  say('實作二：每個 row 是一段，分開放', '化整為零：row 0 在 1126、row 1 在 5566');
  await beat(tok, 3000);
  const P = [cube('1126', AS, [1.3, 0.6, 1.0], -5.0, 0.3, -0.55, 3), cube('5566', AS, [1.3, 0.6, 1.0], -5.0, 0.3, 0.55, 3)];
  tag('arr[0]', 'idx', -6.3, 0.3, -0.55); tag('arr[1]', 'idx', -6.3, 0.3, 0.55);
  await beat(tok, 900);
  arrow(V3(-4.3, 0.4, -0.55), V3(RX(0) - 0.6, 0.4, RZ[0])); arrow(V3(-4.3, 0.4, 0.55), V3(RX(0) - 0.6, 0.4, RZ[1]));
  say('把各 row 的位置存下來：兩張小紙條', '這就是傳說中的指標陣列');
  await beat(tok, 3000);
  const rg = alRing(-5.0, 0.05, 0.55, 0.75);
  glow(P[1], GOLD);
  say('arr[1][3]：先看 arr[1] 的紙條', '紙條寫著 5566');
  await beat(tok, 2600);
  glow(P[1], null);
  await anim(tok, 800, (t) => { rg.position.x = -5.0 + (RX(0) + 5.0) * t; rg.position.z = 0.55 + (RZ[1] - 0.55) * t; });
  await anim(tok, 700, (t) => { rg.position.x = RX(0) + (RX(3) - RX(0)) * t; });
  glow(rows[1][3], GREEN);
  say('再從 5566 走 3 步', '5566 + 3 = 5569');
  await beat(tok, 2600);
  say('像大地遊戲跑兩關', '先解開紙條，再找對應位置');
  await beat(tok, 2400);
  say('construct 要分三段', '放紙條的 1 段 ＋ 每個 row 各 1 段（可以四散）');
  await beat(tok, 3000);
}]);

// 122:32 兩種實作的 trade-off
FRAG.push(['arrlin-2d-compare', 'one block vs array of arrays', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0.5]);
  tag('one block', 'ptr', -3.6, 1.5, -2.0); tag('array of arrays', 'ptr alt', 3.4, 1.5, -2.0);
  for (let k = 0; k < 10; k++) cube('', k < 5 ? AB : AP, [0.5, 0.45, 0.5], -6.0 + k * 0.55, 0.22, -0.8, 2);
  const P = [cube('', AS, [0.5, 0.45, 0.5], 1.2, 0.22, -1.2, 2), cube('', AS, [0.5, 0.45, 0.5], 1.2, 0.22, -0.6, 2)];
  for (let k = 0; k < 5; k++) { cube('', AB, [0.5, 0.45, 0.5], 2.6 + k * 0.6, 0.22, -1.5, 2); cube('', AP, [0.5, 0.45, 0.5], 2.6 + k * 0.6, 0.22, 0.0, 2); }
  const lt = [tag('', 'idx', -3.6, 0, 1.0), tag('', 'idx', -3.6, 0, 1.8), tag('', 'idx', -3.6, 0, 2.6)];
  const rt = [tag('', 'idx', 3.4, 0, 1.0), tag('', 'idx', 3.4, 0, 1.8), tag('', 'idx', 3.4, 0, 2.6)];
  say('同一個 2 × 5，兩種實作', '');
  await beat(tok, 2400);
  P.forEach((m) => glow(m, RED));
  txt(lt[0], '空間：10 格'); txt(rt[0], '空間：10 格 ＋ 2 張紙條');
  say('array of arrays 比較花空間', '要多存放小紙條的位置');
  await beat(tok, 2800);
  P.forEach((m) => glow(m, null));
  txt(lt[1], 'construct：allocate 1 次'); txt(rt[1], 'construct：allocate 3 次');
  say('construct 可能多花一點時間', '每個 row 都要分開配置');
  await beat(tok, 2800);
  txt(lt[2], 'get：算 1 次位置'); txt(rt[2], 'get：兩層（紙條 → 位置）');
  say('get 也要多跑一關', '前者比較快，後者稍微慢一些');
  await beat(tok, 2800);
  const ok = tag('比較好寫：兩個維度分開處理', 'ptr alt', 3.4, 2.4, -2.0);
  say('但 array of arrays 常常比較好寫', '不用把位置的數學想得很清楚');
  await beat(tok, 2800);
  say('差距通常不大：重點是 trade-off', '每種選擇都有好處和壞處');
  await beat(tok, 3000);
  showL(ok, true);
}]);

// 125:14 下三角矩陣：只存一半
FRAG.push(['arrlin-lower-tri', '下三角矩陣：只存一半', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, -0.6]);
  const n = 6, GX = (j) => -2.0 + j * 0.8, GZ = (i) => -4.6 + i * 0.7, SX = (k) => -6.0 + k * 0.6;
  const low = [], zeros = [];
  for (let i = 0; i < n; i++) {
    low.push([]);
    for (let j = 0; j < n; j++) {
      if (j <= i) low[i].push(cube('', AB, [0.7, 0.35, 0.6], GX(j), 0.18, GZ(i), 2));
      else zeros.push(cube('0', GRAY, [0.7, 0.35, 0.6], GX(j), 0.18, GZ(i), 2));
    }
    tag('row ' + (i + 1), 'idx', -3.2, 0.1, GZ(i));
  }
  say('下三角矩陣：對角線以上都是 0', 'n × n，這裡 n = 6');
  await beat(tok, 2800);
  zeros.forEach((m) => fly(m, V3((Math.random() - 0.5) * 4, 7, -3)));
  say('0 不需要存', '只存下三角');
  await beat(tok, 2200);
  for (let k = 0; k < 21; k++) cube('', '#e9dcc4', [0.5, 0.06, 0.5], SX(k), 0.03, 2.2);
  const s = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) { move(low[i][j], SX(k), 0.18, 2.2); s.push(low[i][j]); k++; }
    say('row ' + (i + 1) + '：' + (i + 1) + ' 個 element', '目前共 ' + k + ' 格');
    await beat(tok, 750);
  }
  say('一塊連續記憶體只要 n(n+1)/2 格', '6 × 7 / 2 = 21');
  await beat(tok, 2600);
  for (let q = 0; q < 15; q++) glow(s[q], GOLD);
  say('找第 6 row 第 5 個：前面經過多少個？', '1 + 2 + 3 + 4 + 5 = 15');
  await beat(tok, 2800);
  for (let q = 0; q < 15; q++) glow(s[q], null);
  const rg = alRing(SX(15), 0.03, 2.2, 0.36);
  await anim(tok, 900, (t) => { rg.position.x = SX(15) + (SX(19) - SX(15)) * t; });
  glow(s[19], GREEN);
  say('再走到第 5 個 → 第 20 格', '(i−1)i/2 + j = 15 + 5 = 20（1-indexed）');
  await beat(tok, 3000);
  say('對稱矩陣也只要存一半', 'A[i][j] = A[j][i]；或改用 array of arrays：又是 trade-off');
  await beat(tok, 3000);
}]);

// 131:03 row sum vs column sum：走訪順序
FRAG.push(['arrlin-rowcol-sum', 'row sum vs column sum', async (tok) => {
  fresh([0, 8, 11], [0, 0, -0.4]);
  const R = 4, C = 6, GX = (j) => -2.5 + j * 1.0, GZ = (i) => -3.8 + i * 0.9, SX = (k) => -5.75 + k * 0.5;
  const g = [];
  for (let i = 0; i < R; i++) { g.push([]); for (let j = 0; j < C; j++) g[i].push(cube('', AB, [0.8, 0.35, 0.7], GX(j), 0.18, GZ(i), 2)); }
  const s = [];
  for (let k = 0; k < R * C; k++) s.push(cube('', Math.floor(k / C) % 2 ? AP : AB, [0.42, 0.3, 0.42], SX(k), 0.15, 1.8));
  tag('實際的記憶體：one block、row-major', 'idx', 0, 0, 2.7);
  const st = tag('', 'ptr alt', 0, 2.6, -4.4);
  say('兩段程式：把每個 element 加進 result', '哪一個比較快？為什麼？');
  await beat(tok, 2800);
  const rg = alRing(GX(0), 0.02, GZ(0), 0.45);
  const run = async (rowFirst) => {
    for (let a = 0; a < (rowFirst ? R : C); a++) for (let b = 0; b < (rowFirst ? C : R); b++) {
      const i = rowFirst ? a : b, j = rowFirst ? b : a, k = i * C + j;
      rg.position.set(GX(j), 0.02, GZ(i)); glow(g[i][j], GOLD); glow(s[k], GOLD);
      await beat(tok, 230);
    }
  };
  txt(st, 'for (i…) for (j…) result += arr[i][j];');
  say('row sum：由左到右，再由上到下', '記憶體位置 0, 1, 2, 3…：連續');
  await run(true);
  await beat(tok, 1600);
  g.flat().forEach((m) => glow(m, null)); s.forEach((m) => glow(m, null));
  txt(st, 'for (j…) for (i…) result += arr[i][j];');
  say('column sum：由上到下，再往右', '記憶體位置 0, 6, 12, 18, 1, 7…：跳著走');
  await run(false);
  await beat(tok, 1600);
  say('兩段都把每格加一次，結果一樣', '時間呢？（Slido 投票）');
  await beat(tok, 3000);
}]);

// 139:25 實測：column sum 慢約一倍
FRAG.push(['arrlin-rowcol-timing', '實測：row sum vs column sum', async (tok) => {
  fresh([0, 5, 13], [0, 2.4, 0]);
  const poll = [['row 較快', 2.8, AG, '七成以上'], ['差不多', 0.8, GRAY, '一些'], ['column 較快', 0.4, AK, '較少']];
  say('Slido 投票結果', '七成以上同學覺得 row sum 比較快');
  for (let k = 0; k < 3; k++) {
    const x = -5.0 + k * 1.3, b = alBar(poll[k][2], 0.9, 0.9, x, 0);
    tag(poll[k][0], 'idx', x, 0, 1.0 + (k % 2) * 0.6);
    await alGrow(tok, b, poll[k][1], 500);
    tag(poll[k][3], 'idx', x, poll[k][1] + 0.4, 0);
  }
  await beat(tok, 2200);
  say('兩支程式只差兩行：迴圈的順序', 'initialize 都用 row major，各跑 10 次求穩定');
  await beat(tok, 3000);
  const br = alBar(AB, 1.2, 1.2, 1.6, 0), bc = alBar(AO, 1.2, 1.2, 4.2, 0);
  tag('row sum', 'idx', 1.6, 0, 1.2); tag('column sum', 'idx', 4.2, 0, 1.2);
  say('row sum：10 次約 10 秒', '一次大約 1 秒');
  await alGrow(tok, br, 2.5, 900);
  tag('≈ 10 秒', 'ptr', 1.6, 2.9, 0);
  await beat(tok, 2000);
  say('column sum：約 2 倍', '20 秒左右');
  await alGrow(tok, bc, 5.0, 1400);
  tag('≈ 20 秒', 'ptr alt', 4.2, 5.4, 0);
  await beat(tok, 2400);
  say('看似人畜無害的程式，時間差一倍', '為什麼？');
  await beat(tok, 3000);
}]);

// 143:00 原因：cache（水槽）與連續存取
FRAG.push(['arrlin-cache', 'cache：一次打一桶水', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, 0]);
  const cpu = cube('CPU', AT, [1.2, 1.0, 1.2], -5.8, 0.5, 0); tag('CPU', 'ptr', -5.8, 1.5, 0);
  const SXc = (s) => -4.3 + s * 0.6, LZ = [-0.45, 0.45];
  const cg = ghostBox(AB, 2.8, 0.7, 2.0); cg.position.set(-3.4, 0.35, 0);
  tag('cache（家裡的水槽）', 'ptr alt', -3.4, 1.2, -1.4);
  for (const z of LZ) for (let s = 0; s < 4; s++) cube('', '#e9dcc4', [0.5, 0.06, 0.5], SXc(s), 0.03, z);
  const MZ = [-2.7, -0.9, 0.9, 2.7], MX = (c) => 2.0 + c * 0.9;
  const mem = [];
  for (let r = 0; r < 4; r++) {
    tag('row ' + r, 'idx', 0.9, 0.2, MZ[r]); tag('…', 'idx', 5.8, 0.2, MZ[r]);
    mem.push([0, 1, 2, 3].map((c) => { tag(String(r * 1000 + c + 1), 'idx', MX(c), 0, MZ[r] + 0.65); return cube('', r % 2 ? AP : AB, [0.6, 0.4, 0.6], MX(c), 0.2, MZ[r]); }));
  }
  tag('記憶體（遠方的井）', 'ptr', 3.4, 1.4, -3.8);
  const cnt = tag('', 'ptr', -3.4, 0, 2.6);
  say('記憶體離 CPU 很「遙遠」', '每次都去井裡打水太慢了');
  await beat(tok, 2800);
  say('一次用大桶子打一桶，放家裡水槽', '去記憶體時，把附近一小段一起抓回來');
  await beat(tok, 2800);
  let lines = [], miss = 0, hit = 0;
  const rg = alRing(MX(0), 0.02, MZ[0], 0.42);
  function reset() { lines.forEach((l) => l.cubes.forEach((m) => kill(m))); lines = []; miss = 0; hit = 0; txt(cnt, 'miss 0 / hit 0'); }
  async function access(r, c) {
    rg.position.set(MX(c), 0.02, MZ[r]);
    let L = lines.find((l) => l.r === r);
    if (L) {
      hit++; lines = lines.filter((l) => l !== L).concat([L]);
      glow(L.cubes[c], GREEN);
      say('要的資料已經在水槽裡：cache hit', '位置 ' + (r * 1000 + c + 1));
      await beat(tok, 700); glow(L.cubes[c], null);
    } else {
      miss++;
      let slot = 0;
      if (lines.length >= 2) { const old = lines.shift(); slot = old.slot; old.cubes.forEach((m) => fly(m, V3(0, 6, 2))); }
      else slot = lines.length;
      glow(mem[r][c], RED);
      const cubes = [0, 1, 2, 3].map((q) => { const m = cube('', r % 2 ? AP : AB, [0.45, 0.35, 0.45], MX(q), 0.2, MZ[r]); move(m, SXc(q), 0.2, LZ[slot]); return m; });
      lines.push({ r, slot, cubes });
      say('不在水槽：cache miss，跑去井裡抓一段', '位置 ' + (r * 1000 + c + 1) + '（連同附近 4 格）');
      await beat(tok, 1000); glow(mem[r][c], null);
    }
    txt(cnt, 'miss ' + miss + ' / hit ' + hit);
  }
  reset();
  for (let c = 0; c < 4; c++) await access(0, c);
  say('row sum：存取連續，抓回來的都用得到', 'miss 1 / hit 3');
  await beat(tok, 2600);
  reset();
  for (const [r, c] of [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]]) await access(r, c);
  say('column sum：1 → 1001 → 2001 → 3001 → 2…', '每次都不在附近：一直 cache miss');
  await beat(tok, 3000);
  say('（示意：一次抓 4 格、水槽放 2 段）', '懂機器怎麼運作，才寫得出快的程式');
  await beat(tok, 3000);
  glow(cpu, null);
}]);

// 153:29 ordered array：insert 的位置被 order 決定
FRAG.push(['arrlin-ordered-insert', 'Ordered array 的 insert', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.4 + i * 1.2;
  for (let i = 0; i < 10; i++) { cube('', GRAY, [1.0, 0.08, 1.0], X(i), 0.04, 0); tag('[' + i + ']', 'idx', X(i), 0, 0.9); }
  const vals = [3, 7, 9, 10, 25, 27];
  const cs = [];
  for (let i = 0; i < vals.length; i++) { cs.push(cube(vals[i], AB, [0.95, 0.6, 0.95], X(i), 0.35, 0, 3)); await beat(tok, 250); }
  say('Ordered array：從 0 號開始連續放滿', '後面的櫃子是空的');
  await beat(tok, 2600);
  for (let i = 0; i + 1 < cs.length; i++) {
    glow(cs[i], GOLD); glow(cs[i + 1], GOLD);
    say('放的值可以比較，而且由小到大排好', vals[i] + ' ≤ ' + vals[i + 1]);
    await beat(tok, 650);
    glow(cs[i], null); glow(cs[i + 1], null);
  }
  say('需要定義好的「小於等於」', 'arr[0] ≤ arr[1] ≤ … ≤ arr[end]');
  await beat(tok, 2400);
  const v = cube(13, AO, [0.95, 0.6, 0.95], X(0), 2.4, 0);
  glow(v, RED);
  say('insert 13：可以 insert by index 0 嗎？', '13 放在 3 前面 → 破壞 order ✗');
  await beat(tok, 2800);
  glow(v, null);
  move(v, (X(3) + X(4)) / 2, 2.4, 0);
  glow(cs[3], GOLD); glow(cs[4], GOLD);
  say('位置已經固定：一定在 10 和 25 中間', '10 ≤ 13 ≤ 25');
  await beat(tok, 2800);
  glow(cs[3], null); glow(cs[4], null);
  move(cs[5], X(6), 0.35, 0); await beat(tok, 500);
  move(cs[4], X(5), 0.35, 0); await beat(tok, 500);
  move(v, X(4), 0.35, 0);
  say('後面往後推，13 放進 [4]', '3 7 9 10 13 25 27：order 維持住了');
  await beat(tok, 2800);
  say('Ordered array 要有自己的 insert 演算法', '怎麼找位置：下一堂課');
  await beat(tok, 3000);
}]);
  }

  // ═══ arrlllin.js ═══
  {
  // ─── B0ywTK-Lklw：林軒田 DSA — Ordered array、Binary search、Linked list、Sparse vector ───
  const C = { v: '#4b9ee2', pr: '#9b7ef4', ok: '#2fc092', hot: '#dd8238', bad: '#d64545', note: '#d8c29b', dim: '#d8cfc0' };
  const SZ = [1.0, 0.7, 1.0], PS = [1.55, 0.7, 1.0];
  const at = (l, x, y, z = 0) => l.position.set(x, y, z);
  const spread = (n, sp) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * sp);
  function vc(v, x, z = 0, dropH = 0, color = C.v, size = SZ) { const m = cube(v, color, size, x, size[1] / 2, z, dropH); m.userData.v = v; return m; }
  function setV(m, v) { m.userData.v = v; relabel(m, v); }
  function cells(xs, z, opts = {}) {
    const d = opts.d || 1.4, w = opts.w || 1.25;
    xs.forEach((x, i) => {
      slotTile(V3(x, 0.02, z), w, d);
      if (opts.idx !== false) tag(opts.lab ? opts.lab(i) : '[' + i + ']', 'idx', x, 0.05, z + d / 2 + 0.4);
    });
  }
  // singly links between lnode()s placed at xs (all at depth z)
  function slinks(xs, z, old, y = 0.35) {
    (old || []).forEach(kill);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i++) out.push(arrow(V3(xs[i] + 0.96, y, z), V3(xs[i + 1] - 0.52, y, z)));
    return out;
  }
  // a doubly-linked node: [prev | data | next]
  function dnode(text, x, z = 0, color = C.v, dropH = 0) {
    const g = new THREE.Group();
    const d = lab.box(color, [1.0, 0.7, 1.0]); d.add(lab.label(String(text), 'val'));
    const p = lab.box(C.note, [0.4, 0.7, 1.0]); p.position.x = -0.72;
    const n = lab.box(C.note, [0.4, 0.7, 1.0]); n.position.x = 0.72;
    g.add(d, p, n); g.userData.data = d;
    g.position.set(x, 0.35 + dropH, z);
    if (dropH > 0) lab.dropTo(lab.addBody(g), V3(x, 0.35, z)); else lab.world.add(g);
    return g;
  }
  function dlinks(xs, z, old) {
    (old || []).forEach(kill);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      out.push(arrow(V3(xs[i] + 0.94, 0.55, z - 0.25), V3(xs[i + 1] - 0.5, 0.55, z - 0.25)));
      out.push(arrow(V3(xs[i + 1] - 0.94, 0.15, z + 0.25), V3(xs[i] + 0.5, 0.15, z + 0.25), 0xc08a1f));
    }
    return out;
  }
  function book(id, x, z = 0) { const m = cube(id, C.pr, [0.95, 1.7, 0.75], x, 0.85, z); m.userData.v = id; return m; }

  // 17:30 consecutive → ordered
  FRAG.push(['arrlllin-consecutive', 'Consecutive 與 Ordered array', async (tok) => {
    fresh([0, 6.5, 11], [0, 0.4, 0]);
    const xs = spread(7, 1.5); cells(xs, 0);
    say('Array 像一排置物櫃：用編號任意開關', '7 個櫃子 [0] … [6]');
    await beat(tok, 2200);
    const loose = [[1, 4], [4, 9], [6, 2]].map(([i, v]) => vc(v, xs[i], 0, 3));
    say('可以任意放：中間留著空位', '空位散在中間 → 有點浪費');
    await beat(tok, 2600);
    loose.forEach((m) => fly(m));
    await beat(tok, 700);
    const vals = [5, 7, 4, 6], cs = [];
    for (let i = 0; i < 4; i++) {
      cs.push(vc(vals[i], xs[i], 0, 3));
      say('中間不留空：從最前面連續放', '填入 ' + vals.slice(0, i + 1).join(', '));
      await beat(tok, 900);
    }
    const g = ghostBox(C.ok, 4 * 1.5 - 0.2, 0.9, 1.6); g.position.set((xs[0] + xs[3]) / 2, 0.45, 0);
    tag('tail = 3', 'ptr alt', xs[3], 1.4, 0);
    say('Consecutive array：用掉前面連續一段', '[0 … tail] 有資料，後面是連續空位');
    await beat(tok, 2800);
    [2, 0, 3, 1].forEach((k, i) => move(cs[k], xs[i], 0.35, 0));
    say('再要求由小到大排好 → Ordered array', '4 ≤ 5 ≤ 6 ≤ 7');
    await beat(tok, 2600);
    say('Ordered array 一定是 consecutive array', '這裡採由小到大（排行榜則是由大到小）');
    await beat(tok, 2800);
  }]);

  // 21:43 insert into ordered array
  async function shiftInsert(tok, A, data, xs, ms) {
    let i = A.indexOf(null); i = (i < 0 ? A.length : i) - 1;
    const dc = vc(data, xs[i + 1], 0, 0, C.hot); dc.position.y = 2.3;
    say('插入 ' + data + '：從 tail = ' + i + ' 往前比', 'data = ' + data);
    await beat(tok, ms * 1.4);
    while (i >= 0) {
      glow(A[i], GOLD); move(dc, xs[i], 2.3, 0);
      if (A[i].userData.v > data) {
        say(A[i].userData.v + ' > ' + data + '：往後搬一格', 'arr[' + (i + 1) + '] = arr[' + i + ']');
        await beat(tok, ms * 0.6);
        move(A[i], xs[i + 1], 0.35, 0); glow(A[i], null); A[i + 1] = A[i]; A[i] = null;
        await beat(tok, ms); i--;
      } else {
        say(A[i].userData.v + ' ≤ ' + data + '：停，放在它後面', 'arr[' + (i + 1) + '] = ' + data);
        await beat(tok, ms * 0.8); glow(A[i], null); break;
      }
    }
    move(dc, xs[i + 1], 0.35, 0); A[i + 1] = dc;
    await beat(tok, ms);
  }
  FRAG.push(['arrlllin-ordered-insert', 'Ordered array 的插入', async (tok) => {
    fresh([0, 6.5, 11.5], [0, 0.9, 0]);
    const xs = spread(7, 1.5); cells(xs, 0);
    let A = [2, 6, 7, 13].map((v, i) => vc(v, xs[i])); while (A.length < 7) A.push(null);
    const tl = tag('tail = 3', 'ptr', xs[3], 0.05, -1.3);
    say('Ordered array：2, 6, 7, 13', '除了開頭，還要一個變數記 tail');
    await beat(tok, 2600);
    say('插入 10：只能放在 13 現在的位置', '13 往後擠一格，10 插隊進去');
    await beat(tok, 2200);
    await shiftInsert(tok, A, 10, xs, 1000);
    txt(tl, 'tail = 4'); at(tl, xs[4], 0.05, -1.3);
    say('插入完成，tail + 1', '2, 6, 7, 10, 13');
    await beat(tok, 2000);
    A.forEach((m) => m && fly(m));
    await beat(tok, 700);
    A = [2, 6, 7, 13].map((v, i) => vc(v, xs[i], 0, 2)); while (A.length < 7) A.push(null);
    txt(tl, 'tail = 3'); at(tl, xs[3], 0.05, -1.3);
    say('換成插入 4', '從 tail 開始搬家：13、7、6');
    await beat(tok, 1600);
    await shiftInsert(tok, A, 4, xs, 800);
    txt(tl, 'tail = 4'); at(tl, xs[4], 0.05, -1.3);
    say('插得越前面，要搬的越多', '最壞要搬 tail + 1 個 → O(n)');
    await beat(tok, 2800);
  }]);

  // 28:49 the buggy insert code
  FRAG.push(['arrlllin-insert-bugs', '抓 insert 程式的 bug', async (tok) => {
    fresh([0, 5.5, 12.5], [0, 2.4, 0]);
    const xs = spread(6, 1.5), real = xs.slice(0, 5), z = 1.2;
    cells(real, z);
    const cd = code(['for (i = tail; i >= 0; i--) {', '  if (arr[i] > data)', '    arr[i+1] = arr[i];', '  else {', '    arr[i+1] = data; break;', '  }', '}'], 0, 6.4, 0.5, -1.6);
    const dl = tag('data = 10', 'ptr alt', -5.4, 1.6, z);
    const il = tag('i', 'ptr', real[3], 1.5, z);
    let S = [];
    const load = (vals) => { S.forEach((m) => m && kill(m)); S = vals.map((v, i) => vc(v, real[i], z)); while (S.length < 5) S.push(null); };
    const put = (i, v, col) => { if (S[i]) { setV(S[i], v); tint(S[i], col || C.v); } else S[i] = vc(v, real[i], z, 2, col || C.v); };
    load([2, 6, 7, 13]);
    say('老師故意寫一段「似是而非」的 insert', '你看得出哪裡有問題嗎？');
    await beat(tok, 2600);
    cd.hl(0); say('追蹤 data = 10：i 從 tail = 3 開始', 'arr = 2, 6, 7, 13');
    await beat(tok, 1800);
    glow(S[3], GOLD); cd.hl(1); say('arr[3] = 13 > 10', '條件成立');
    await beat(tok, 1300);
    cd.hl(2); put(4, 13, C.hot); glow(S[3], null); tint(S[3], C.dim);
    say('arr[4] = arr[3]：只是 copy', '13 暫時有兩份，舊的等著被蓋掉');
    await beat(tok, 2000);
    at(il, real[2], 1.5, z); glow(S[2], GOLD); cd.hl(1);
    say('i = 2：arr[2] = 7 不比 10 大', '進 else');
    await beat(tok, 1400);
    cd.hl(4); glow(S[2], null); put(3, 10, C.ok); tint(S[4], C.v);
    say('arr[3] = 10，break', '2, 6, 7, 10, 13');
    await beat(tok, 2000);
    load([2, 6, 7, 13]); txt(dl, 'data = 1'); cd.hl(-1);
    say('換成 data = 1（比全部都小）', '再跑一次');
    await beat(tok, 1600);
    for (let i = 3; i >= 0; i--) {
      at(il, real[i], 1.5, z); cd.hl(2); put(i + 1, S[i].userData.v); tint(S[i], C.dim);
      say(S[i].userData.v + ' > 1：往後 copy', 'arr[' + (i + 1) + '] = arr[' + i + ']');
      await beat(tok, 750);
    }
    cd.hl(6); txt(il, 'i = -1'); at(il, real[0] - 1.2, 1.5, z); glow(S[0], RED); tint(S[0], C.bad);
    say('迴圈就結束了：1 根本沒放進去！', 'Bug 1：arr[0] 還是舊的 2');
    await beat(tok, 2600);
    glow(S[0], null); tint(S[0], C.v); txt(il, 'tail = 4'); at(il, real[4], 1.5, z);
    const gb = ghostBox(C.bad, 1.1, 0.7, 1.1); gb.position.set(xs[5], 0.35, z);
    tag('[5]？', 'idx', xs[5], 0.05, z + 1.1);
    say('陣列滿了時，arr[tail+1] 會寫出界', 'Bug 2：沒檢查後面還有沒有空間');
    await beat(tok, 2600);
    say('還有 A 與 ARR 混用的 typo', '寫程式要帶著懷疑檢查，錯了就 debug');
    await beat(tok, 2800);
  }]);

  // 39:41 selection sort / insertion sort on 1 3 7 4 6 5 2
  FRAG.push(['arrlllin-construct', '把亂的 array 排成 ordered', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0]);
    const V0 = [1, 3, 7, 4, 6, 5, 2], xs = spread(7, 1.4); cells(xs, 0);
    let S = V0.map((v, i) => vc(v, xs[i]));
    say('一堆沒排好的資料：1 3 7 4 6 5 2', '怎麼變成 ordered array？');
    await beat(tok, 2200);
    say('Selection sort：用 getMinIndex 找最小的', '跟開頭那格交換');
    await beat(tok, 1600);
    for (let p = 0; p < 6; p++) {
      let m = p; for (let k = p + 1; k < 7; k++) if (S[k].userData.v < S[m].userData.v) m = k;
      glow(S[m], GOLD);
      say('第 ' + (p + 1) + ' 小的是 ' + S[m].userData.v, 'getMinIndex(arr[' + p + ' … 6]) = ' + m);
      await beat(tok, 900);
      if (m !== p) { move(S[m], xs[p], 0.35, 0); move(S[p], xs[m], 0.35, 0); [S[p], S[m]] = [S[m], S[p]]; }
      glow(S[p], null); tint(S[p], C.ok);
      await beat(tok, 700);
    }
    tint(S[6], C.ok);
    say('Selection sort 完成', '1 2 3 4 5 6 7');
    await beat(tok, 1800);
    S.forEach((m) => kill(m));
    S = V0.map((v, i) => vc(v, xs[i]));
    tint(S[0], C.ok);
    say('Insertion sort：像玩撲克牌', '右邊抽一張，插到左手排好的牌裡');
    await beat(tok, 1800);
    for (let k = 1; k < 7; k++) {
      const c = S[k], v = c.userData.v;
      move(c, xs[k], 1.6, 0);
      await beat(tok, 350);
      let j = k - 1;
      while (j >= 0 && S[j].userData.v > v) { move(S[j], xs[j + 1], 0.35, 0); S[j + 1] = S[j]; j--; }
      S[j + 1] = c; move(c, xs[j + 1], 0.35, 0); tint(c, C.ok);
      say('抽出 ' + v + '，插到左邊正確位置', '= 把 ordered array insertion 跑很多次');
      await beat(tok, 800);
    }
    say('兩種都能把散亂的 array 變成 ordered', 'selection sort、insertion sort');
    await beat(tok, 2400);
  }]);

  // 42:50 maintenance cost: update must roll, remove must fill in
  FRAG.push(['arrlllin-maintain', 'Ordered 的維護代價', async (tok) => {
    fresh([0, 6, 11.5], [0, 0.6, 0]);
    const xs = spread(6, 1.5); cells(xs, 0);
    const S = [2, 6, 7, 13].map((v, i) => vc(v, xs[i])); S.push(null, null);
    const tl = tag('tail = 3', 'ptr', xs[3], 0.05, -1.3);
    say('Ordered array 不能隨便 update', '改完要檢查：比前一格大、比後一格小');
    await beat(tok, 2400);
    setV(S[1], 11); glow(S[1], RED);
    say('把 arr[1] 從 6 改成 11', '11 > 後一格的 7：順序亂了');
    await beat(tok, 2200);
    move(S[1], xs[2], 0.35, 0); move(S[2], xs[1], 0.35, 0); [S[1], S[2]] = [S[2], S[1]];
    say('比後面大 → 往後滾', '11 和 7 交換');
    await beat(tok, 1500);
    glow(S[2], null);
    say('11 < 13：停下來', '2, 7, 11, 13 又排好了');
    await beat(tok, 1800);
    glow(S[1], RED);
    say('移除 7', '要維持連續：後面的要補位（fill in）');
    await beat(tok, 1300);
    fly(S[1]); S[1] = null;
    await beat(tok, 600);
    for (let k = 2; k <= 3; k++) { move(S[k], xs[k - 1], 0.35, 0); S[k - 1] = S[k]; S[k] = null; await beat(tok, 600); }
    txt(tl, 'tail = 2'); at(tl, xs[2], 0.05, -1.3);
    say('後面往前補位', 'tail 從 3 變 2');
    await beat(tok, 2000);
    say('加上限制（consecutive、ordered）就要花力氣維護', 'access 和 maintenance 的代價都要算進去');
    await beat(tok, 3000);
  }]);

  // 49:04 sequential search on a shelf
  FRAG.push(['arrlllin-seq-search', 'Sequential search：找書', async (tok) => {
    fresh([0, 5.6, 12.5], [0, 2.4, 0]);
    const IDS = [12, 27, 35, 48, 56, 63, 79, 85], xs = spread(8, 1.3), z = 1.2;
    const B = IDS.map((v, i) => book(v, xs[i], z));
    xs.forEach((x, i) => tag('[' + i + ']', 'idx', x, 0.05, z + 0.9));
    const cd = code(['for (i = 0; i <= tail; i++)', '  if (arr[i].id == toFind)', '    return i;      // 找到了', 'return NOT_FOUND;'], 0, 6.2, 0.52, -1.6);
    const il = tag('i', 'ptr', xs[0], 2.2, z), fl = tag('toFind = 56', 'ptr alt', -5.6, 2.2, z);
    say('圖書館：書照 ID 排在架子上', '已經找到架子，要找出那一本');
    await beat(tok, 2200);
    for (let i = 0; i <= 4; i++) {
      at(il, xs[i], 2.2, z); cd.hl(1); glow(B[i], GOLD);
      say('從左找到右：第 ' + i + ' 本 ID = ' + IDS[i], IDS[i] === 56 ? '相同！' : IDS[i] + ' ≠ 56');
      await beat(tok, 600);
      if (i < 4) glow(B[i], null);
    }
    cd.hl(2); tint(B[4], C.ok); say('找到了', 'return 4');
    await beat(tok, 1800);
    glow(B[4], null); tint(B[4], C.pr); txt(fl, 'toFind = 50');
    say('換成找 ID = 50（不在架上）', '');
    await beat(tok, 1200);
    for (let i = 0; i < 8; i++) { at(il, xs[i], 2.2, z); cd.hl(1); glow(B[i], GOLD); await beat(tok, 380); glow(B[i], null); tint(B[i], C.dim); }
    cd.hl(3); say('最壞情況：整排看完都找不到', 'return NOT_FOUND → 看了 tail + 1 本');
    await beat(tok, 2200);
    say('Sequential search：一本一本看過去', '這個演算法根本沒用到「排好了」');
    await beat(tok, 2600);
  }]);

  // 54:03 sequential search with cut (5566 vs 6000)
  FRAG.push(['arrlllin-seq-cut', 'Sequential search with cut', async (tok) => {
    fresh([0, 5.6, 12.5], [0, 2.4, 0]);
    const IDS = [1, 3, 1234, 2046, 4096, 5000, 6000, 6001, 7000], xs = spread(9, 1.25), z = 1.2;
    const B = IDS.map((v, i) => book(v, xs[i], z));
    const cd = code(['for (i = 0; i <= tail; i++)', '  if (arr[i].id == toFind) return i;', '  else if (arr[i].id > toFind)', '    return NOT_FOUND;  // 偷吃步 cut', 'return NOT_FOUND;'], 0, 6.2, 0.52, -1.6);
    const il = tag('i', 'ptr', xs[0], 2.2, z);
    tag('toFind = 5566', 'ptr alt', -5.6, 2.6, z);
    say('如果書真的照編號排好了呢？', '找 ID = 5566');
    await beat(tok, 2200);
    for (let i = 0; i <= 6; i++) {
      at(il, xs[i], 2.2, z); glow(B[i], GOLD);
      cd.hl(IDS[i] > 5566 ? 2 : 1);
      say(IDS[i] < 5566 ? IDS[i] + ' < 5566：繼續' : IDS[i] + ' > 5566！', i < 6 ? '一本一本往右' : '後面只會更大');
      await beat(tok, i < 6 ? 550 : 1600);
      if (i < 6) glow(B[i], null);
    }
    glow(B[6], RED); cd.hl(3);
    for (let k = 7; k < 9; k++) tint(B[k], C.dim);
    say('6000、6001、7000 … 都不可能是 5566', '直接 return NOT_FOUND：不用看完');
    await beat(tok, 2400);
    say('偷偷用了 ordered 的性質：shortcut（偷吃步）', '找的編號越小，省得越多');
    await beat(tok, 2600);
    say('但還是一本一本找，到中間才能 cut', '能不能更早砍掉一大堆？');
    await beat(tok, 2600);
  }]);

  // 57:13 binary search: compare with the middle, cut half
  const BSA = [1, 4, 6, 7, 9, 15, 25, 27, 30];
  FRAG.push(['arrlllin-binsearch-cut', 'Binary search：跟中間比', async (tok) => {
    fresh([0, 6, 12], [0, 0.6, 0]);
    const xs = spread(9, 1.3); cells(xs, 0, { w: 1.15 });
    const S = BSA.map((v, i) => vc(v, xs[i], 0, 0, C.v, [0.95, 0.7, 0.95]));
    const fl = tag('toFind = 8', 'ptr alt', 0, 2.4, 0), ml = tag('mid', 'ptr', xs[4], 1.4, 0);
    const reset = () => S.forEach((m, k) => { tint(m, C.v); glow(m, null); m.position.y = 0.35; });
    say('9 格排好的資料：先跟最中間的比', 'mid = 4，arr[4] = 9');
    await beat(tok, 2400);
    glow(S[4], GOLD);
    say('9 > 8：mid 和後面全都比 8 大', 'cut mid … tail');
    await beat(tok, 2000);
    for (let k = 4; k < 9; k++) { tint(S[k], C.dim); S[k].position.y = 0.12; }
    say('一次比較就砍掉 5 個', '剩下 [0 … 3]');
    await beat(tok, 2000);
    reset(); txt(fl, 'toFind = 11'); glow(S[4], GOLD);
    say('換成找 11：9 < 11', '9、7、6、4、1 都不可能');
    await beat(tok, 2000);
    for (let k = 0; k <= 4; k++) { tint(S[k], C.dim); S[k].position.y = 0.12; }
    say('另一個方向的 cut', 'cut 0 … mid → 剩 [5 … 8]');
    await beat(tok, 2000);
    reset(); txt(fl, 'toFind = 9'); glow(S[4], GOLD); tint(S[4], C.ok);
    say('相等：找到了', 'arr[mid] == toFind');
    await beat(tok, 1800);
    showL(ml, false);
    say('每比一次：要嘛找到，要嘛砍掉超過一半', 'Binary search');
    await beat(tok, 2800);
  }]);

  // 62:02 the binary search algorithm, traced
  FRAG.push(['arrlllin-binsearch-run', 'Binary search 演算法', async (tok) => {
    fresh([0, 5.6, 13], [0, 2.6, 0]);
    const xs = spread(9, 1.3), z = 1.4; cells(xs, z, { w: 1.15 });
    const S = BSA.map((v, i) => vc(v, xs[i], z, 0, C.v, [0.95, 0.7, 0.95]));
    const cd = code(['begin = 0; end = tail;', 'while (begin <= end) {  // 還有書可找', '  mid = (begin + end) / 2;', '  if (arr[mid] > toFind) end = mid - 1;', '  else if (arr[mid] < toFind) begin = mid + 1;', '  else return mid;', '}', 'return NOT_FOUND;'], 0, 6.7, 0.48, -1.8);
    const rb = ghostBox(C.ok, 1, 0.9, 1.3);
    const bL = tag('begin', 'ptr', xs[0], 0.05, z + 1.6), eL = tag('end', 'ptr', xs[8], 0.05, z + 2.2), mL = tag('mid', 'ptr alt', xs[4], 1.5, z);
    const fl = tag('', 'ptr alt', -5.9, 1.6, z);
    const cl = (i) => xs[Math.max(0, Math.min(8, i))];
    function range(b, e) {
      at(bL, cl(b), 0.05, z + 1.6); at(eL, cl(e), 0.05, z + 2.2);
      rb.visible = b <= e;
      if (b <= e) { rb.scale.x = (e - b) * 1.3 + 1.2; rb.position.set((xs[b] + xs[e]) / 2, 0.45, z); }
      S.forEach((m, k) => tint(m, k >= b && k <= e ? C.v : C.dim));
    }
    async function run(find) {
      S.forEach((m) => glow(m, null)); txt(fl, 'toFind = ' + find); showL(mL, false);
      let b = 0, e = 8; cd.hl(0); range(b, e);
      say('toFind = ' + find + '：begin = 0，end = tail = 8', '搜尋範圍 [0, 8]');
      await beat(tok, 1800);
      while (b <= e) {
        const m = Math.floor((b + e) / 2);
        cd.hl(2); showL(mL, true); at(mL, xs[m], 1.5, z); glow(S[m], GOLD);
        say('mid = (' + b + ' + ' + e + ') / 2 = ' + m, 'arr[' + m + '] = ' + BSA[m]);
        await beat(tok, 1300);
        if (BSA[m] > find) { cd.hl(3); e = m - 1; say(BSA[m] + ' > ' + find + '：end = mid − 1 = ' + e, '砍掉 mid 和右邊'); }
        else if (BSA[m] < find) { cd.hl(4); b = m + 1; say(BSA[m] + ' < ' + find + '：begin = mid + 1 = ' + b, '砍掉 mid 和左邊'); }
        else { cd.hl(5); tint(S[m], C.ok); say('arr[' + m + '] == ' + find + '：找到了', 'return ' + m); await beat(tok, 2200); return; }
        glow(S[m], null); range(b, e);
        await beat(tok, 1400);
      }
      cd.hl(7); showL(mL, false);
      say('begin > end：沒書可找了', 'return NOT_FOUND');
      await beat(tok, 2200);
    }
    await run(8);
    await run(25);
    cd.hl(-1);
    say('O(1) 抓出 arr[mid]：靠 fast random access', '9 → 4 → 2 → 1：每次砍一半');
    await beat(tok, 3000);
  }]);

  // 82:56 correctness: loop invariant + finiteness
  FRAG.push(['arrlllin-bs-invariant', 'Binary search 的正確性', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const xs = spread(9, 1.3); cells(xs, 0, { w: 1.15 });
    const S = BSA.map((v, i) => vc(v, xs[i], 0, 0, C.v, [0.95, 0.7, 0.95]));
    const rb = ghostBox(C.ok, 1, 0.9, 1.3);
    const cnt = tag('', 'ptr alt', 0, 2.4, 0);
    tag('toFind = 8', 'ptr', -5.6, 1.4, 0);
    function range(b, e) {
      rb.visible = b <= e;
      if (b <= e) { rb.scale.x = (e - b) * 1.3 + 1.2; rb.position.set((xs[b] + xs[e]) / 2, 0.45, 0); }
      S.forEach((m, k) => tint(m, k >= b && k <= e ? C.v : C.dim));
      txt(cnt, 'candidate：[' + b + ', ' + e + ']，共 ' + Math.max(0, e - b + 1) + ' 個');
    }
    range(0, 8);
    say('怎麼證明 binary search 是對的？', '有迴圈的演算法：找每輪都維持的性質');
    await beat(tok, 2400);
    say('Loop invariant：toFind 一定在範圍內', '若存在，必在 [begin, end]；一開始是 [0, tail]');
    await beat(tok, 2600);
    glow(S[4], GOLD);
    say('arr[4] = 9 > 8，而 9 ≤ 15 ≤ 25 ≤ 27 ≤ 30', '遞移律：後面全都 > 8 → 可以排除');
    await beat(tok, 2800);
    glow(S[4], null); range(0, 3);
    say('排除之後，性質還成立', '[0, 8] → [0, 3]');
    await beat(tok, 1800);
    for (const [b, e, m] of [[2, 3, 1], [3, 3, 2], [4, 3, 3]]) {
      glow(S[m], GOLD); await beat(tok, 500); glow(S[m], null);
      range(b, e);
      say('每輪 candidate 至少少一半', 'arr[' + m + '] = ' + BSA[m] + ' < 8 → begin = ' + b);
      await beat(tok, 1100);
    }
    say('Finiteness：數量每輪變小，又不會小於 0', '→ 迴圈一定會停');
    await beat(tok, 2600);
    say('作業的 GCD 演算法也是同一套想法', '什麼東西每輪變小？有沒有下限？');
    await beat(tok, 2800);
  }]);

  // 89:12 ternary vs binary with the same number of comparisons
  FRAG.push(['arrlllin-ternary', '分三區會更快嗎？', async (tok) => {
    fresh([0, 7.5, 9.5], [0, 0, 0.2]);
    const xs = spread(36, 0.32);
    const rowB = xs.map((x) => cube('', C.v, [0.27, 0.3, 0.6], x, 0.15, -1.4));
    const rowT = xs.map((x) => cube('', C.pr, [0.27, 0.3, 0.6], x, 0.15, 1.6));
    const lb = tag('Binary：剩 36', 'ptr', 0, 0.9, -2.5), lt = tag('Ternary（分三區）：剩 36', 'ptr alt', 0, 0.9, 2.7);
    const cut = (row, a, b) => { for (let k = a; k < b; k++) { tint(row[k], C.dim); row[k].position.y = 0.05; } };
    say('同學問：分三區會比較快嗎？', '比較次數一樣時，誰砍得多？');
    await beat(tok, 2400);
    glow(rowB[18], GOLD);
    say('Binary：第 1 次比較', '砍一半 → 剩 18');
    await beat(tok, 1000);
    cut(rowB, 18, 36); glow(rowB[18], null); txt(lb, 'Binary：1 次比較，剩 18');
    await beat(tok, 1300);
    glow(rowB[9], GOLD);
    say('Binary：第 2 次比較', '再砍一半 → 剩 9');
    await beat(tok, 1000);
    cut(rowB, 9, 18); glow(rowB[9], null); txt(lb, 'Binary：2 次比較，剩 9（1/4）');
    await beat(tok, 1500);
    glow(rowT[12], GOLD); glow(rowT[24], GOLD);
    say('分三區：要比 2 次才知道落在哪一區', '跟 1/3、2/3 兩個點比');
    await beat(tok, 1800);
    cut(rowT, 12, 36); glow(rowT[12], null); glow(rowT[24], null); txt(lt, 'Ternary：2 次比較，剩 12（1/3）');
    await beat(tok, 1500);
    say('兩次比較：binary 剩 1/4，分三區剩 1/3', 'discrete 搜尋時 binary 較有效率');
    await beat(tok, 2800);
    say('三分搜尋在數值方法求極值時才有好處', '除非硬體能很快做三方比較');
    await beat(tok, 2800);
  }]);

  // 91:57 array recap
  FRAG.push(['arrlllin-array-recap', 'Array 小結', async (tok) => {
    fresh([0, 6, 11.5], [0, 0.8, 0]);
    const xs = spread(7, 1.45); cells(xs, 0);
    xs.forEach((x, i) => tag(String(1000 + 4 * i), 'idx', x, 0.05, -1.25));
    const S = [2, 6, 7, 10, 13].map((v, i) => vc(v, xs[i]));
    const p = tag('arr[0]', 'ptr', xs[0], 1.4, 0);
    say('Array = 一塊連續記憶體', '每格 4 bytes：位址 = 1000 + 4 × i');
    await beat(tok, 2400);
    await beat(tok, 500);
    at(p, xs[3], 1.4, 0); txt(p, 'arr[3]'); glow(S[3], GOLD);
    say('Fast random access：給 index 一步到位', 'arr[3] → 1000 + 4 × 3 = 1012');
    await beat(tok, 2400);
    glow(S[3], null);
    const g = ghostBox(C.ok, 5 * 1.45 - 0.2, 0.9, 1.6); g.position.set((xs[0] + xs[4]) / 2, 0.45, 0);
    tag('tail', 'ptr alt', xs[4], 1.4, 0);
    say('Consecutive：資料連續放，記住 tail', '2 ≤ 6 ≤ 7 ≤ 10 ≤ 13 → Ordered');
    await beat(tok, 2400);
    glow(S[2], GOLD);
    say('Ordered + random access → binary search', '找東西變很快（圖書館找書）');
    await beat(tok, 2400);
    glow(S[2], null);
    say('代價：insert、update、remove 要維護順序', '用 maintenance 換搜尋速度');
    await beat(tok, 2400);
    say('上次：2D array、特殊 array 省空間、架構考量', 'Array 不只是 C 裡的一個宣告');
    await beat(tok, 2800);
  }]);

  // 94:01 polynomial as ordered array of (exp, coef)
  const FP = [[0, 5], [1, 1], [2, -4], [5, 10], [16, 1]];
  const pl = (e, c) => '(' + e + ', ' + c + ')';
  FRAG.push(['arrlllin-poly-array', '多項式存成 pair 的 ordered array', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0.4]);
    const xs = spread(5, 1.9); cells(xs, -0.8, { w: 1.75 });
    say('f(x) = 5 + x + 4x² + 10x⁵ + x¹⁶', '寫科學計算軟體：多項式怎麼存？');
    await beat(tok, 2600);
    say('把 4 改成 −4，比較不枯燥', 'f(x) = 5 + x − 4x² + 10x⁵ + x¹⁶');
    await beat(tok, 2000);
    const fs = [];
    for (let k = 0; k < 5; k++) {
      const [e, c] = FP[k];
      fs.push(vc(pl(e, c), xs[k], -0.8, 3, C.v, PS));
      say('存一個 pair：(指數, 係數)', c + ' · x^' + e + ' → ' + pl(e, c));
      await beat(tok, 900);
    }
    tag('f', 'ptr', xs[0] - 1.5, 0.9, -0.8);
    say('5 個 pair 就表示了 f', '前面是指數，後面是係數');
    await beat(tok, 2000);
    cells([xs[0], xs[1]], 1.6, { w: 1.75, idx: false });
    tag('g', 'ptr alt', xs[0] - 1.5, 0.9, 1.6);
    vc(pl(0, 3), xs[0], 1.6, 3, C.pr, PS); vc(pl(5, 6), xs[1], 1.6, 3, C.pr, PS);
    say('另一個多項式 g(x) = 3 + 6x⁵', '(0, 3)、(5, 6)');
    await beat(tok, 2200);
    for (const m of fs) { glow(m, GOLD); await beat(tok, 350); glow(m, null); }
    say('按指數排好 → ordered array', 'ordered by exponent：0 < 1 < 2 < 5 < 16');
    await beat(tok, 3000);
  }]);

  // 101:20 insert / remove / resize hurt on the ordered array
  FRAG.push(['arrlllin-poly-array-ops', 'Ordered array 存多項式的麻煩', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0]);
    const xs = spread(7, 1.75); cells(xs, 0, { w: 1.6 });
    const S = FP.map(([e, c], i) => vc(pl(e, c), xs[i], 0, 0, C.v, PS)); S.push(null, null);
    async function insertAt(pos, label, ms) {
      const nc = vc(label, xs[Math.min(pos, 6)], 0, 0, C.hot, PS); nc.position.y = 2.3;
      await beat(tok, ms);
      let t = S.indexOf(null) - 1;
      for (; t >= pos; t--) { move(S[t], xs[t + 1], 0.35, 0); S[t + 1] = S[t]; S[t] = null; await beat(tok, ms * 0.6); }
      S[pos] = nc; move(nc, xs[pos], 0.35, 0);
      await beat(tok, ms);
    }
    say('用 ordered array 存 f', 'f = (0,5) (1,1) (2,−4) (5,10) (16,1)');
    await beat(tok, 2000);
    say('f(x) + 6x³：(3, 6) 要插隊到 (2,−4) 後面', 'cut in：後面的往後擠');
    await insertAt(3, pl(3, 6), 700);
    await beat(tok, 900);
    say('f(x) − 4x⁻²：(−2, −4) 要插到最前面', '全部往後搬：不太 flexible');
    await insertAt(0, pl(-2, -4), 500);
    await beat(tok, 1400);
    glow(S[5], RED);
    say('f(x) − 10x⁵：這一項變 0，要拿掉', '');
    await beat(tok, 1400);
    fly(S[5]); S[5] = null;
    await beat(tok, 500);
    move(S[6], xs[5], 0.35, 0); S[5] = S[6]; S[6] = null;
    say('後面的往前補位', '(16, 1) 往前一格');
    await beat(tok, 1600);
    const gb = ghostBox(C.bad, 13.6, 0.9, 1.7); gb.position.set(0, 0.45, 0);
    say('f(x)·(x + 1)：結果變大，要 resize', '要一整塊連續記憶體，不一定拿得到');
    await beat(tok, 2600);
    say('不用 binary search 時', '維持 ordered array 不見得值得');
    await beat(tok, 2600);
  }]);

  // 106:36 memory addresses + next notes → linked list
  FRAG.push(['arrlllin-poly-ll', '小紙條 next 與 head', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.3, -0.8]);
    const AD = [1001, 1002, 1003, 1004, 1005], xs = spread(5, 2.1), z = 0.6;
    cells(xs, z, { w: 1.85 });
    const S = FP.map(([e, c], i) => vc(pl(e, c), xs[i], z, 0, C.v, PS));
    const adL = xs.map((x, i) => { const l = tag(String(AD[i]), 'idx', x, 1.05, z); showL(l, false); return l; });
    say('Array 的 index 其實就是記憶體位址', 'index 0 … 4 ↔ 1001 … 1005');
    await beat(tok, 1400);
    adL.forEach((l) => showL(l, true));
    await beat(tok, 1400);
    const nx = xs.map((x) => tag('', 'ptr alt', x, 0.05, z - 1.2));
    for (let i = 0; i < 5; i++) {
      txt(nx[i], i < 4 ? 'next ' + AD[i + 1] : 'next 無');
      say('每一項多記一張小紙條：下一項在哪', pl(...FP[i]) + ' 的下一項 → ' + (i < 4 ? AD[i + 1] : '沒有'));
      await beat(tok, 650);
    }
    tag('head = 1001', 'ptr', xs[0] - 0.4, 1.7, z);
    say('head：從 1001 進去', '1001 → 1002 → 1003 → 1004 → 1005');
    await beat(tok, 2000);
    const nX = 1.05, nZ = -2.7;
    slotTile(V3(nX, 0.02, nZ), 1.85, 1.4);
    tag('1126', 'idx', nX, 1.05, nZ);
    const N = vc(pl(3, 6), nX, nZ, 3, C.hot, PS);
    const nN = tag('next ?', 'ptr alt', nX, 0.05, nZ - 1.15);
    say('加 6x³：(3, 6) 放在別的地方 1126', '不用跟其他項擠在一起');
    await beat(tok, 2400);
    glow(N, GOLD); txt(nN, 'next 1004');
    say('(3, 6) 的下一項 = 1004', '');
    await beat(tok, 1800);
    glow(N, null); glow(S[2], GOLD); txt(nx[2], 'next 1126');
    say('(2, −4) 的下一項改成 1126', '只改了兩張小紙條');
    await beat(tok, 2000);
    glow(S[2], null);
    arrow(V3(xs[2] + 0.2, 0.8, z - 0.4), V3(nX - 0.2, 0.8, nZ + 0.55), 0xc08a1f);
    arrow(V3(nX + 0.3, 0.8, nZ + 0.55), V3(xs[3] - 0.2, 0.8, z - 0.4), 0xc08a1f);
    const p = tag('p', 'ptr', xs[0], 1.7, z);
    const path = [[xs[0], z], [xs[1], z], [xs[2], z], [nX, nZ], [xs[3], z], [xs[4], z]], nm = [1001, 1002, 1003, 1126, 1004, 1005];
    for (let k = 0; k < 6; k++) {
      at(p, path[k][0], 1.7, path[k][1]);
      say('從 head 順著 next 走', nm.slice(0, k + 1).join(' → '));
      await beat(tok, 650);
    }
    say('Linked list：維護好每張小紙條', '代價：每個抽屜多放一張紙條');
    await beat(tok, 2800);
  }]);

  // 112:51 insert after with the standard drawing
  FRAG.push(['arrlllin-insert-after', 'insert after：改兩張小紙條', async (tok) => {
    fresh([0, 6, 12], [0, 1.2, 0]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(5,10)', '(16,1)'], AD = [1001, 1002, 1003, 1004, 1005];
    const xs = spread(5, 2.3);
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    const adL = AD.map((a, i) => tag(String(a), 'idx', xs[i], 0.05, 1.0));
    let ar = slinks(xs, 0);
    const nul = tag('NULL', 'idx', xs[4] + 1.5, 0.35, 0);
    const hd = tag('head', 'ptr', xs[0], 1.3, 0);
    const cd = code(['newNode = Node(data);      // 放在 1126', 'newNode.next = node.next;  // = 1004', 'node.next = newNode;       // = 1126'], 0, 5.2, 0.52, -1.5);
    say('一般畫法：node = 資料 + next', 'head → (0,5) → … → (16,1) → NULL');
    await beat(tok, 2400);
    glow(G[2].userData.data, GOLD); const nl = tag('node', 'ptr alt', xs[2], 1.3, 0);
    say('insertAfter(node = 1003, (3, 6))', '插在 (2,−4) 後面');
    await beat(tok, 2000);
    const mx = (xs[2] + xs[3]) / 2;
    cd.hl(0); const N = lnode('(3,6)', mx, 2.4, 0, C.hot); const nAd = tag('1126', 'idx', mx, 3.1, 0);
    say('用 data 做出新的 node（在 1126）', 'newNode');
    await beat(tok, 1800);
    cd.hl(1); const a1 = arrow(V3(mx + 0.96, 2.4, 0), V3(xs[3] - 0.3, 0.8, 0), 0xc08a1f);
    say('newNode.next = node.next', '新 node 先指向 1004');
    await beat(tok, 2000);
    cd.hl(2); kill(ar[2]); const a2 = arrow(V3(xs[2] + 0.96, 0.6, 0), V3(mx - 0.52, 2.2, 0), 0xc08a1f);
    say('node.next = newNode', '1003 的小紙條改成 1126');
    await beat(tok, 2200);
    say('兩行程式 = 圖上兩個箭頭', '資料完全不用搬');
    await beat(tok, 1800);
    cd.hl(-1); glow(G[2].userData.data, null);
    const nx = spread(6, 2.1), order = [G[0], G[1], G[2], N, G[3], G[4]], ads = [...adL.slice(0, 3), nAd, ...adL.slice(3)];
    order.forEach((g, i) => move(g, nx[i], 0.35, 0));
    ads.forEach((l, i) => at(l, nx[i], 0.05, 1.0));
    kill(a1); kill(a2); ar.forEach(kill); ar = slinks(nx, 0);
    at(nul, nx[5] + 1.4, 0.35, 0); at(hd, nx[0], 1.3, 0); at(nl, nx[2], 1.3, 0);
    say('Singly linked list：單一方向一個接一個', '… → (2,−4) → (3,6) → (5,10) → …');
    await beat(tok, 3000);
  }]);

  // 121:56 routines: get by walking, insert at head (head is special)
  FRAG.push(['arrlllin-insert-head', 'get 與插在最前面', async (tok) => {
    fresh([0, 6.5, 11.5], [0, 1.0, -0.6]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)'], xs = [-2.4, -0.1, 2.2, 4.5];
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    slinks(xs, 0); tag('NULL', 'idx', xs[3] + 1.4, 0.35, 0);
    const H = cube('head', C.note, [1.0, 0.7, 1.0], -5.3, 0.35, 0);
    let ha = arrow(V3(-4.8, 0.35, 0), V3(xs[0] - 0.52, 0.35, 0), 0xc08a1f);
    const cd = code(['get(node):          return node.data', 'insertAfter(node,d): new.next = node.next; node.next = new', 'insertHead(d):       new.next = head;      head = new'], 0, 5.4, 0.55, -2.2);
    say('Linked list 的 routine：head、next', '沒有 index 可以直接跳');
    await beat(tok, 2400);
    const p = tag('p', 'ptr', -5.3, 1.3, 0);
    for (let k = 0; k < 3; k++) {
      at(p, xs[k], 1.3, 0);
      say(k ? 'p = p.next' : 'p = head', '走了 ' + (k + 1) + ' 步');
      await beat(tok, 750);
    }
    cd.hl(0); glow(G[2].userData.data, GOLD);
    say('走到 node 之後才能 get 內容', 'get = (2,−4)');
    await beat(tok, 2000);
    glow(G[2].userData.data, null); showL(p, false);
    cd.hl(2);
    const N = lnode('(-2,-4)', -4.2, 2.6, -2.4, C.hot);
    move(N, -4.2, 0.35, -2.4);
    tag('1126', 'idx', -4.2, 1.2, -2.4);
    say('低次項 (−2,−4) 要插到最前面', '新 node 放在 1126');
    await beat(tok, 2000);
    arrow(V3(-3.3, 0.35, -2.4), V3(xs[0] - 0.5, 0.35, -0.3), 0xc08a1f);
    say('new.next = head', '新 node 指向原本的第一個');
    await beat(tok, 2000);
    kill(ha); ha = arrow(V3(-5.3, 0.35, -0.5), V3(-4.75, 0.35, -2.0), 0xc08a1f); glow(H, GOLD);
    say('head = new：head 改指 1126', '這張小紙條不在任何 node 裡');
    await beat(tok, 2200);
    glow(H, null);
    say('head 很特別：要另寫一個 routine', '只寫 insertAfter 就插不到最前面（邊緣情形）');
    await beat(tok, 3000);
  }]);

  // 128:05 random access vs sequential access
  FRAG.push(['arrlllin-random-vs-seq', 'Random vs sequential access', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.3, 0]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)', '(5,10)'];
    const ax = spread(5, 1.75), az = -2.0; cells(ax, az, { w: 1.6, d: 1.2 });
    const A = L.map((v, i) => vc(v, ax[i], az, 0, C.v, [1.45, 0.7, 0.9]));
    tag('Array', 'ptr', ax[0] - 1.6, 0.9, az);
    const lx = spread(5, 2.3), lz = 2.0;
    const G = L.map((v, i) => lnode(v, lx[i], 0.35, lz, C.pr));
    slinks(lx, lz);
    tag('Linked list', 'ptr', lx[0] - 0.4, 1.3, lz - 0.9);
    const pa = tag('index 0', 'ptr alt', ax[0], 1.4, az), pl_ = tag('p = head', 'ptr alt', lx[0], 1.3, lz);
    say('要拿第 3 項', 'array 給 index；linked list 只有 head');
    await beat(tok, 2000);
    at(pa, ax[3], 1.4, az); txt(pa, 'index 3'); glow(A[3], GOLD);
    say('Array：一步到位', 'random access：O(1)');
    await beat(tok, 2000);
    for (let k = 1; k <= 3; k++) {
      at(pl_, lx[k], 1.3, lz); txt(pl_, 'p = p.next');
      say('Linked list：照小紙條一關一關跑', '第 ' + k + ' 次 next');
      await beat(tok, 800);
    }
    glow(G[3].userData.data, GOLD);
    say('像大地遊戲：跑到那一關才拿得到', 'sequential access：O(k)');
    await beat(tok, 2400);
    say('一般 linked list：建立、update 都很 trivial', 'node 位址就像一個特別長的 index');
    await beat(tok, 2600);
    say('比較有趣的是 remove', '下一段');
    await beat(tok, 2000);
  }]);

  // 129:44 remove after with a temp
  FRAG.push(['arrlllin-remove-after', 'remove after', async (tok) => {
    fresh([0, 6, 12], [0, 1.4, 0]);
    const L = ['(1,1)', '(2,-4)', '(3,6)', '(5,10)'], AD = ['1002', '1003', '1126', '1234'], xs = spread(4, 2.7);
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    const adL = AD.map((a, i) => tag(a, 'idx', xs[i], 0.05, 1.0));
    let ar = slinks(xs, 0);
    const nl = tag('node', 'ptr', xs[1], 1.3, 0);
    const cd = code(['tmp = node.next;       // 1126，先存起來', 'node.next = tmp.next;  // 1234', 'free(tmp);'], 0, 5.2, 0.55, -1.6);
    glow(G[1].userData.data, GOLD);
    say('removeAfter(node)：移掉 node 的下一個', 'node.next = 1126，1126 的 next = 1234');
    await beat(tok, 2600);
    say('只要把 node 的小紙條換成 1234', '但直接換掉，就找不回中間那個了');
    await beat(tok, 2400);
    cd.hl(0); const tl = tag('tmp', 'ptr alt', xs[2], 1.3, 0); glow(G[2].userData.data, RED);
    say('先用暫存變數記下來', 'tmp = node.next = 1126');
    await beat(tok, 2000);
    cd.hl(1); kill(ar[1]); kill(ar[2]);
    const jump = arrow(V3(xs[1] + 0.9, 0.95, 0), V3(xs[3] - 0.45, 0.95, 0), 0xc08a1f);
    say('node.next = tmp.next', '跳過 1126，直接接到 1234');
    await beat(tok, 2200);
    cd.hl(2); fly(G[2]); kill(tl); kill(adL[2]);
    say('free(tmp)：把中間那塊還回去', '');
    await beat(tok, 1600);
    kill(jump); move(G[3], xs[2], 0.35, 0); at(adL[3], xs[2], 0.05, 1.0);
    ar = slinks([xs[0], xs[1], xs[2]], 0, [ar[0]]);
    cd.hl(-1); glow(G[1].userData.data, null);
    say('一樣只是改小紙條＋free', 'head 和非 head 可能要分開寫');
    await beat(tok, 2800);
  }]);

  // 131:44 dummy head
  FRAG.push(['arrlllin-dummy-head', 'Dummy head', async (tok) => {
    fresh([0, 6, 12], [0, 1.2, 0]);
    let xs = spread(4, 2.5);
    const D = lnode('—', xs[0], 0.35, 0, '#b9a582');
    let G = ['(0,5)', '(1,1)', '(2,-4)'].map((v, i) => lnode(v, xs[i + 1], 0.35, 0, C.v));
    let ar = slinks(xs, 0);
    const hd = tag('head（dummy）', 'ptr', xs[0], 1.3, 0);
    say('Dummy head：最前面放一個不存資料的 node', '用它的 next 當作 head');
    await beat(tok, 2600);
    const mx = (xs[0] + xs[1]) / 2;
    const N = lnode('(-2,-4)', mx, 2.4, 0, C.hot);
    say('插到最前面 = insertAfter(dummy, …)', '跟插在中間是同一份 code');
    await beat(tok, 1800);
    const nx = spread(5, 2.3);
    move(D, nx[0], 0.35, 0); move(N, nx[1], 0.35, 0); G.forEach((g, i) => move(g, nx[i + 2], 0.35, 0));
    ar = slinks(nx, 0, ar); at(hd, nx[0], 1.3, 0);
    G = [N, ...G];
    await beat(tok, 2000);
    glow(G[0].userData.data, RED);
    say('刪掉第一個 = removeAfter(dummy)', '一樣不用特別處理 head');
    await beat(tok, 1600);
    fly(G[0]); G.shift();
    move(D, xs[0], 0.35, 0); G.forEach((g, i) => move(g, xs[i + 1], 0.35, 0));
    ar = slinks(xs, 0, ar); at(hd, xs[0], 1.3, 0);
    await beat(tok, 1800);
    say('只要一份 code：不用分 head／非 head', 'insertAfter、removeAfter 通吃');
    await beat(tok, 2400);
    glow(D.userData.data, GOLD);
    say('代價：多用一個 node 的空間', '用空間換 coding 方便性');
    await beat(tok, 3000);
  }]);

  // 134:43 why a prev pointer
  FRAG.push(['arrlllin-why-prev', '為什麼要 prev', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)'], xs = spread(4, 2.6);
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    slinks(xs, 0); tag('NULL', 'idx', xs[3] + 1.4, 0.35, 0);
    tag('head', 'ptr', xs[0], 1.3, 0);
    tag('node', 'idx', xs[1], 0.05, 1.0); tag('node2', 'idx', xs[2], 0.05, 1.0);
    say('Singly：只能 removeAfter(node)', 'node.next = node.next.next');
    await beat(tok, 2400);
    tint(G[2].userData.data, C.bad);
    say('removeHere(node2)：看到它就想刪掉', '');
    await beat(tok, 1800);
    glow(G[1].userData.data, GOLD);
    say('要更新的是「前一關」的小紙條', '但 node2 不知道前一個是誰');
    await beat(tok, 2400);
    glow(G[1].userData.data, null);
    const p = tag('p', 'ptr alt', xs[0], 1.3, 0);
    for (let k = 0; k < 2; k++) {
      at(p, xs[k], 1.9, 0);
      say('只能從 head 一個一個找', 'p.next == node2 ? ' + (k === 1 ? '是！' : '不是'));
      await beat(tok, 900);
    }
    say('串很長時，每次刪都要從頭找', 'O(n)');
    await beat(tok, 1800);
    showL(p, false);
    for (let i = 3; i >= 1; i--) {
      arrow(V3(xs[i] - 0.55, 0.15, 0.45), V3(xs[i - 1] + 0.55, 0.15, 0.45), 0xc08a1f);
      await beat(tok, 450);
    }
    tag('tail', 'ptr', xs[3], 1.3, 0);
    say('每個 node 再放一張小紙條：prev（前一關）', 'next + prev');
    await beat(tok, 2400);
    say('從 tail 順著 prev 也能走完', '兩條反方向的 list → doubly linked list');
    await beat(tok, 2800);
  }]);

  // 139:14 doubly linked list remove here (1111, 2345, 5566)
  FRAG.push(['arrlllin-dll-remove', 'Doubly linked list：remove here', async (tok) => {
    fresh([0, 6, 11], [0, 1.4, 0]);
    const xs = [-4, 0, 4], AD = ['1111', '2345', '5566'];
    const G = AD.map((a, i) => dnode(a, xs[i], 0, C.v));
    let ar = dlinks(xs, 0);
    const n0 = tag('next 2345', 'ptr alt', xs[0] + 0.72, 1.0, 0);
    const p1 = tag('prev 1111', 'idx', xs[1] - 0.72, 1.0, 0), n1 = tag('next 5566', 'idx', xs[1] + 0.72, 1.45, 0);
    const p2 = tag('prev 2345', 'ptr alt', xs[2] - 0.72, 1.0, 0);
    const cd = code(['node.prev.next = node.next;  // 1111.next = 5566', 'node.next.prev = node.prev;  // 5566.prev = 1111', 'free(node);'], 0, 5.2, 0.55, -1.6);
    say('Doubly linked list：每個 node 有 prev 與 next', '紙條上寫的是位址：1111、2345、5566');
    await beat(tok, 2600);
    glow(G[1].userData.data, RED);
    say('removeHere(2345)：看到 node 就能直接刪', '');
    await beat(tok, 2000);
    cd.hl(0); txt(n0, 'next 5566'); glow(G[0].userData.data, GOLD);
    say('1111 的 next 改成 5566', '前一個 = node.prev，不用從 head 找');
    await beat(tok, 2200);
    glow(G[0].userData.data, null); cd.hl(1); txt(p2, 'prev 1111'); glow(G[2].userData.data, GOLD);
    say('5566 的 prev 改成 1111', '兩張小紙條都更新好');
    await beat(tok, 2200);
    glow(G[2].userData.data, null); cd.hl(2);
    fly(G[1]); kill(p1); kill(n1);
    ar = dlinks([xs[0], xs[2]], 0, ar);
    say('再把中間砍掉：free', 'remove here 完成');
    await beat(tok, 2000);
    cd.hl(-1);
    say('代價：多一張紙條、多幾行 code、稍慢', '換到：看到 node 就能刪（insert 也一樣）');
    await beat(tok, 3000);
  }]);

  // 142:47 traversal pattern → iterator（也用於 151:32 的 Q&A）
  FRAG.push(['arrlllin-iterator', '走訪與 iterator', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.8, -0.4]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)'];
    const ax = spread(4, 1.9), az = -1.6; cells(ax, az, { w: 1.7, d: 1.2, idx: false });
    const A = L.map((v, i) => vc(v, ax[i], az, 0, C.v, [1.5, 0.7, 0.9]));
    ax.forEach((x, i) => tag(String(1001 + i), 'idx', x, 0.05, az + 1.0));
    tag('Array', 'ptr', ax[0] - 1.9, 0.6, az);
    const LA = [1001, 1002, 1003, 1126], lx = spread(4, 2.6), lz = 2.2;
    const G = L.map((v, i) => lnode(v, lx[i], 0.35, lz, C.pr));
    LA.forEach((a, i) => tag(String(a), 'idx', lx[i], 0.05, lz + 1.0));
    slinks(lx, lz);
    tag('List', 'ptr', lx[0] - 1.7, 0.6, lz);
    const cd = code(['for (it = begin(); it != end(); ++it)', '    visit(*it);'], 0, 4.4, 0.55, -3.6);
    const pa = tag('', 'ptr alt', ax[0], 1.4, az), pl2 = tag('', 'ptr alt', lx[0], 1.3, lz);
    say('走訪整個 data structure', 'array：index 0 → tail；list：head → next → …');
    await beat(tok, 2400);
    for (let k = 0; k < 4; k++) {
      cd.hl(0);
      at(pa, ax[k], 1.4, az); txt(pa, 'it = ' + (1001 + k));
      at(pl2, lx[k], 1.3, lz); txt(pl2, 'it = ' + LA[k]);
      glow(A[k], GOLD); glow(G[k].userData.data, GOLD);
      say(k ? '++it：array 位址 +1；list 照 next 走' : 'begin()：開頭', 'array ' + (1001 + k) + '　list ' + LA[k]);
      await beat(tok, 1300);
      cd.hl(1); glow(A[k], null); glow(G[k].userData.data, null);
    }
    at(pa, ax[3] + 1.6, 1.4, az); txt(pa, 'end'); at(pl2, lx[3] + 1.6, 1.3, lz); txt(pl2, 'end = NULL');
    cd.hl(0);
    say('it == end()：結束', 'array：tail 之後；list：NULL');
    await beat(tok, 2200);
    cd.hl(-1);
    say('Iterator：開頭、結尾、下一個 + 用 * 取資料', '像一個「高階指標」');
    await beat(tok, 2600);
    say('同一段 sequential search 兩種容器都能用', '演算法不再綁死在 array 上');
    await beat(tok, 2800);
  }]);

  // 147:44 STL list
  FRAG.push(['arrlllin-stl-list', 'STL list 的 iterator 操作', async (tok) => {
    fresh([0, 6, 11.5], [0, 1.5, 0]);
    let vals = [10, 20, 30, 40], xs = spread(4, 2.6);
    let G = vals.map((v, i) => dnode(v, xs[i], 0, C.v));
    let ar = dlinks(xs, 0);
    const cd = code(['list<int> l = {10, 20, 30, 40};', 'auto it = l.begin();', '++it;', 'cout << *it;       // 20', 'l.insert(it, 15);  // 插在 it 前面', 'l.erase(it);       // 刪掉 20'], 0, 6.0, 0.5, -1.8);
    const it = tag('it', 'ptr alt', xs[0], 1.3, 0); showL(it, false);
    cd.hl(0); say('STL 的 list = doubly linked list', 'l = 10 ⇄ 20 ⇄ 30 ⇄ 40');
    await beat(tok, 2200);
    cd.hl(1); showL(it, true); say('begin()：給一個 iterator', '指到第一個 node');
    await beat(tok, 1600);
    cd.hl(2); at(it, xs[1], 1.3, 0); say('++ 被 overload：往 next 走一格', '不是整數 +1');
    await beat(tok, 1800);
    cd.hl(3); glow(G[1].userData.data, GOLD); say('*it：取出 node 裡的資料', '= 20');
    await beat(tok, 1800);
    glow(G[1].userData.data, null);
    cd.hl(4);
    const nx = spread(5, 2.35);
    const N = dnode(15, nx[1], 0, C.hot, 3);
    const order = [G[0], N, G[1], G[2], G[3]];
    [G[0], G[1], G[2], G[3]].forEach((g, i) => move(g, nx[i === 0 ? 0 : i + 1], 0.35, 0));
    ar = dlinks(nx, 0, ar); at(it, nx[2], 1.3, 0);
    say('insert(it, 15)：插在 it 前面', '只改前後的 prev／next');
    await beat(tok, 2200);
    cd.hl(5); glow(G[1].userData.data, RED);
    await beat(tok, 700);
    fly(G[1]); order.splice(2, 1);
    order.forEach((g, i) => move(g, xs[i], 0.35, 0));
    ar = dlinks(xs, 0, ar); showL(it, false);
    say('erase(it)：remove here', 'doubly 才能這麼容易');
    await beat(tok, 2000);
    cd.hl(-1);
    say('除了考試，很少自己寫 linked list', '但要懂每個操作背後發生什麼');
    await beat(tok, 3000);
  }]);

  // 155:00 list vs vector, push_front / pop_front
  FRAG.push(['arrlllin-list-vs-vector', 'list 與 vector', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.5, 0]);
    const vx = spread(5, 1.5), vz = -2.0; cells(vx, vz, { d: 1.2 });
    let V = [10, 20, 30, 40].map((v, i) => vc(v, vx[i], vz)); V.push(null);
    tag('vector（array）', 'ptr', vx[0] - 0.2, 1.3, vz - 0.8);
    let lx = spread(4, 2.6); const lz = 2.0;
    let G = [10, 20, 30, 40].map((v, i) => dnode(v, lx[i], lz, C.pr));
    let ar = dlinks(lx, lz);
    tag('list（doubly linked list）', 'ptr', lx[0] + 0.6, 1.3, lz - 0.9);
    say('vector：連續記憶體、沒有小紙條', 'list：每個 node 多兩張小紙條');
    await beat(tok, 2400);
    glow(V[2], GOLD);
    say('v[2]：random access 一步到位', 'list 沒有 random access');
    await beat(tok, 2200);
    glow(V[2], null);
    for (let k = 3; k >= 0; k--) { move(V[k], vx[k + 1], 0.35, vz); V[k + 1] = V[k]; }
    V[0] = vc(5, vx[0], vz, 3, C.hot);
    const nx = spread(5, 2.35);
    G.forEach((g, i) => move(g, nx[i + 1], 0.35, lz));
    G = [dnode(5, nx[0], lz, C.hot, 3), ...G];
    ar = dlinks(nx, lz, ar);
    say('push_front(5)：vector 全部往後搬', 'list 只改 head 附近的指標（insert to head）');
    await beat(tok, 2600);
    fly(V[0]); fly(G[0]);
    for (let k = 1; k < 5; k++) { move(V[k], vx[k - 1], 0.35, vz); V[k - 1] = V[k]; } V[4] = null;
    G.shift(); G.forEach((g, i) => move(g, lx[i], 0.35, lz));
    ar = dlinks(lx, lz, ar);
    say('pop_front = remove from head', 'list O(1)；vector 要往前補位');
    await beat(tok, 2400);
    say('Singly 還是 doubly？看應用', '空間吃緊的小系統、即時系統可能選 singly');
    await beat(tok, 2800);
    say('只需要 array 的功能就用 array', 'list 是更有彈性的容器');
    await beat(tok, 2600);
  }]);

  // 159:58 sparse vector (0, 3.5, 0, 0, 7, 4.2, 9)
  FRAG.push(['arrlllin-sparse', 'Sparse vector', async (tok) => {
    fresh([0, 6.5, 11.5], [0, 0.4, 0.4]);
    const V = [0, 3.5, 0, 0, 7, 4.2, 9], xs = spread(7, 1.45), z = -1.2;
    cells(xs, z, { lab: (i) => '第 ' + (i + 1) + ' 維' });
    const S = V.map((v, i) => vc(v, xs[i], z, 0, v ? C.v : C.dim));
    say('7 維向量：(0, 3.5, 0, 0, 7, 4.2, 9)', '最直接：長度 7 的 array（C++ 的 vector）');
    await beat(tok, 2600);
    S.forEach((m, i) => V[i] && glow(m, GOLD));
    say('只有 4 個不是 0', '3.5、7、4.2、9');
    await beat(tok, 2000);
    S.forEach((m) => glow(m, null));
    say('0 乘任何數是 0、加 0 不變', '0 不必存，也不必算');
    await beat(tok, 2200);
    S.forEach((m, i) => { if (!V[i]) fly(m); });
    await beat(tok, 900);
    const px = spread(4, 2.0); let k = 0;
    S.forEach((m, i) => { if (V[i]) { move(m, px[k], 0.35, 1.8); setV(m, '(' + (i + 1) + ', ' + V[i] + ')'); k++; } });
    say('只存 (維度, 值) 的 pair', '(2, 3.5) (5, 7) (6, 4.2) (7, 9)');
    await beat(tok, 2400);
    say('跟多項式的 (指數, 係數) 一模一樣', '→ Sparse vector');
    await beat(tok, 2200);
    tag('dense：number of dimensions = 7 個數', 'idx', 0, 1.6, z);
    tag('sparse：number of non-zero = 4 個 pair', 'ptr alt', 0, 1.5, 1.8);
    say('哪個省空間不一定', '非常稀疏（0 超多）時 sparse 才划算');
    await beat(tok, 3000);
  }]);

  // 166:03 sparse vector applications; dynamic → linked list
  FRAG.push(['arrlllin-sparse-apps', 'Sparse vector 的應用', async (tok) => {
    fresh([0, 7, 11], [0, 0.4, 0]);
    const bar = cube('', C.dim, [11.5, 0.4, 0.8], 0, 0.2, -2.4);
    const bl = tag('1001 維 array：幾乎全是 0', 'idx', 0, 0.9, -2.4);
    const P = [-1.6, 0, 1.6].map((x, i) => vc(['(0, a)', '(…, b)', '(1000, c)'][i], x, -0.6, 3, C.v, [1.45, 0.6, 0.8]));
    say('最高 1000 次、只有 3 項的多項式', 'dense 要 1001 格；sparse 只要 3 個 pair');
    await beat(tok, 2800);
    txt(bl, '十萬首歌（100,000 維）');
    P.forEach((m) => fly(m));
    await beat(tok, 500);
    const songs = spread(10, 0.5).map((x) => cube('', C.hot, [0.35, 0.35, 0.35], x, 0.2, -0.6, 2));
    say('推薦系統：每人只評了 10 首歌', '其他 99,990 個 0 不用存');
    await beat(tok, 2800);
    songs.forEach((m) => fly(m));
    const L = ['(17,5)', '(204,3)', '(9031,4)'];
    let xs = spread(3, 2.6);
    let G = L.map((v, i) => lnode(v, xs[i], 0.35, 1.8, C.pr));
    let ar = slinks(xs, 1.8);
    tag('(歌 ID, 分數)', 'ptr', -5.2, 1.3, 1.8);
    say('資料常變動：多聽一首、刪一首', '');
    await beat(tok, 1800);
    const nx = spread(4, 2.4);
    const N = lnode('(560,5)', nx[2], 2.6, 1.8, C.hot);
    G.forEach((g, i) => move(g, nx[i < 2 ? i : i + 1], 0.35, 1.8));
    move(N, nx[2], 0.35, 1.8);
    G = [G[0], G[1], N, G[2]]; ar = slinks(nx, 1.8, ar);
    say('多聽一首 → 插入', '改指標就好，不用搬');
    await beat(tok, 2200);
    glow(G[1].userData.data, RED);
    await beat(tok, 600);
    fly(G[1]); G.splice(1, 1);
    G.forEach((g, i) => move(g, xs[i], 0.35, 1.8)); ar = slinks(xs, 1.8, ar);
    say('不喜歡了 → 移除', '');
    await beat(tok, 1800);
    say('動態操作多 → sparse vector 用 linked list 存', '靜態就用 pair array');
    await beat(tok, 3000);
  }]);
  }

  // ═══ arrpeng12.js ═══
  {
// ─── 交大彭文志 Lec03 Arrays 1/4 (hPIBv0kO-Zc) + Lec04 Arrays 2/4 (x72xBomc-XE) ───
const P = () => (ctx.params || {});
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
const term = (c, e) => (e === 0 ? String(c) : (c === 1 ? '' : c) + 'x' + (e === 1 ? '' : sup(e)));
const BLUE = '#4b9ee2', ORANGE = '#dd8238', PURPLE = '#9b7ef4', TEAL = '#31aab0', PINK = '#e55a9b', TILE = '#e9dcc4';
function tiles(n, x0, dx, y, z, w, d, color) { const ts = []; for (let i = 0; i < n; i++) ts.push(cube('', color || TILE, [w, 0.1, d], x0 + i * dx, y, z)); return ts; }

// ── Big-O / Omega / Theta：用 f(n) = 3n + 2（或 3n + 3）跟 c·g(n) 逐一比 ──
async function scAsym(tok) {
  const kind = P().kind || 'O';
  fresh([0, 5.5, 15], [0, 3.2, 0]);
  const S = 0.2, N = 8, X = (n) => -5.6 + (n - 1) * 1.6;
  const F = kind === 'Omega' ? (n) => 3 * n + 3 : (n) => 3 * n + 2;
  const fName = kind === 'Omega' ? 'f(n) = 3n + 3' : 'f(n) = 3n + 2';
  const B = kind === 'O' ? [[(n) => 4 * n, '4n', 'up']] : kind === 'Omega' ? [[(n) => 3 * n, '3n', 'low']] : [[(n) => 3 * n, '3n', 'low'], [(n) => 4 * n, '4n', 'up']];
  const head = { O: ['Big-O：f(n) ≤ c·g(n)，n ≥ n₀', '3n + 2 ≤ 4n，n ≥ 2 → 3n + 2 = O(n)'], Omega: ['Omega：f(n) ≥ c·g(n)，n ≥ n₀', '3n + 3 ≥ 3n，n ≥ 1 → 3n + 3 = Ω(n)'], Theta: ['Theta：c₁g(n) ≤ f(n) ≤ c₂g(n)', '3n ≤ 3n + 2 ≤ 4n，n ≥ 2 → Θ(n)'] }[kind];
  say(head[0], fName);
  tag(fName, 'ptr', -3.5, 7.6, 0);
  tag(B.map((b) => 'c·g(n) = ' + b[1]).join('　'), 'ptr alt', 3, 7.6, 0);
  await beat(tok, 2200);
  const bars = [];
  for (let n = 1; n <= N; n++) {
    const h = F(n) * S;
    bars.push(cube('', BLUE, [0.9, h, 0.9], X(n), h / 2, 0, 2.5));
    tag('n=' + n, 'idx', X(n), -0.1, 1.1);
    tag(String(F(n)), 'idx', X(n), h + 0.35, 0);
    say('step count f(n) 隨 n 長大', fName + '，n = ' + n + ' → ' + F(n));
    await beat(tok, 450);
  }
  await beat(tok, 900);
  for (let n = 1; n <= N; n++) {
    let ok = true;
    for (const [g, , side] of B) {
      const v = g(n);
      cube('', side === 'up' ? '#c08a1f' : '#2fc092', [1.2, 0.08, 1.2], X(n), v * S, 0);
      if (side === 'up' && F(n) > v) ok = false;
      if (side === 'low' && F(n) < v) ok = false;
    }
    glow(bars[n - 1], ok ? GREEN : RED);
    const msg = B.map(([g, nm, side]) => (side === 'up' ? F(n) + ' ≤ ' + g(n) : F(n) + ' ≥ ' + g(n)) + '（' + nm + '）').join('，');
    say(ok ? 'n = ' + n + '：成立' : 'n = ' + n + '：不成立，所以要 n ≥ n₀', (ok ? '<span class="ok">' : '<span class="no">') + msg + '</span>');
    await beat(tok, 750);
  }
  const tail = { O: ['3n + 2 ≤ n² 也對，但要「最小」的 upper bound', 'g(n) 取 least upper bound → O(n)'], Omega: ['n、1 都是 lower bound，要取「最大」的', 'g(n) 取 most lower bound → Ω(n)'], Theta: ['上下兩條線把 f(n) 夾住', '既是 upper bound 也是 lower bound → Θ(n)'] }[kind];
  say(tail[0], tail[1]);
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-asym', 'Big-O、Ω、Θ 的定義（3n + 2）', scAsym]);

// ── 組合規則：循序取 max、巢狀相乘；多項式取最高次；log nᵏ = O(log n) ──
async function scRules(tok) {
  fresh([0, 7, 13], [0, 1.2, 0]);
  const n = 4;
  say('程式由 procedure A、B 組成', 'T₁(n) = O(f(n))，T₂(n) = O(g(n))');
  const lA = tag('A：O(n)', 'ptr', -4.6, 2.6, -1), lB = tag('B：O(n²)', 'ptr alt', 1.2, 4.2, -1);
  const a = [], b = [];
  for (let i = 0; i < n; i++) { a.push(cube('', BLUE, [0.7, 0.7, 0.7], -5.7 + i * 0.75, 0.35, -1, 2)); await beat(tok, 200); }
  for (let i = 0; i < n * n; i++) { b.push(cube('', ORANGE, [0.7, 0.7, 0.7], -0.4 + (i % n) * 0.8, 0.35 + Math.floor(i / n) * 0.75, -1, 2)); await beat(tok, 90); }
  await beat(tok, 800);
  say('Rule 1：A 做完再做 B（循序）', 'T₁(n) + T₂(n) = O(max(f(n), g(n)))');
  b.forEach((m) => glow(m, GOLD));
  await beat(tok, 2600);
  say('最慢的那段就是 bottleneck', 'O(n) + O(n²) = <span class="ok">O(n²)</span>');
  await beat(tok, 2200);
  [...a, ...b].forEach((m) => fly(m)); kill(lA); kill(lB);
  await beat(tok, 700);
  say('A 的迴圈裡每一圈都呼叫 B（巢狀）', 'T₁(n) · T₂(n) = O(f(n) · g(n))');
  tag('外圈 i = 0…' + (n - 1) + '，每圈呼叫 B（O(n)）', 'ptr', 0, 5.2, -1);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) cube('', colorFor(i), [0.75, 0.75, 0.75], -2.1 + j * 0.9, 0.4 + i * 0.85, -1, 1.5);
    say('外圈第 ' + (i + 1) + ' 圈：做一次 B', '累計 ' + (i + 1) * n + ' 步');
    await beat(tok, 700);
  }
  say('巢狀：複雜度相乘', 'O(n) · O(n) = <span class="ok">O(n²)</span>');
  await beat(tok, 2200);
  say('Rule 2：k 次多項式只看最高次', 'aₖnᵏ + … + a₀ = O(nᵏ)，例：n³ + 4 = O(n³)');
  await beat(tok, 2800);
  say('Rule 3：對數裡的次方變常數倍', 'log nᵏ = k·log n = O(log n)');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-rules', '複雜度組合規則', scRules]);

// ── 迴圈的 step count：for 3n、雙層 n²、兩個 block、if-else ──
async function scLoops(tok) {
  const ex = P().ex || 'for';
  fresh([0, 7, 13.5], [0, 1.6, 0]);
  const n = 5;
  const step = (x, y, z, c, d = 1.6) => cube('', c, [0.6, 0.6, 0.6], x, y, z, d);
  if (ex === 'for' || ex === 'nested') {
    const cd = code(['for (i = 0; i < n; i++) {', '  x++; y++; z++;', '}'], -3.6, 6.4);
    say('單層 for：每圈 3 個指令，跑 n 圈', 'n = ' + n);
    await beat(tok, 1500);
    for (let i = 0; i < n; i++) {
      cd.hl(1);
      for (let k = 0; k < 3; k++) step(-5.6 + i * 0.75, 0.3 + k * 0.65, 1.5, colorFor(k));
      tag('i=' + i, 'idx', -5.6 + i * 0.75, -0.1, 2.4);
      say('第 ' + (i + 1) + ' 圈：x++、y++、z++', 'step count = ' + 3 * (i + 1));
      await beat(tok, 650);
    }
    say('step count = 3n', '3n → <span class="ok">O(n)</span>');
    await beat(tok, 2000);
    if (ex === 'nested') {
      const c2 = code(['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    x++;'], 3.2, 6.4);
      say('兩層 for：裡面一個指令', '共跑 n × n 次');
      for (let i = 0; i < n; i++) {
        c2.hl(2);
        for (let j = 0; j < n; j++) step(1.2 + j * 0.8, 0.3, -1.6 + i * 0.8, ORANGE, 1.2);
        say('i = ' + i + '：內圈跑 n 次', '累計 ' + (i + 1) * n + ' 次');
        await beat(tok, 600);
      }
      say('nested loop：n² 次', 'n² → <span class="ok">O(n²)</span>');
      await beat(tok, 2200);
      say('考試常改成 j < i/2：要自己算總次數', 'Σ ⌊i/2⌋ 仍是 Θ(n²)');
      await beat(tok, 2600);
    }
  } else if (ex === 'blocks') {
    const cd = code(['for (i = 0; i < n; i++)', '  a[i] = 0;', 'for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    a[i] += a[j] + i + j;'], 0, 6.8);
    say('程式分兩個 block', '第 1 塊初始化 a[i]，第 2 塊兩層 for');
    await beat(tok, 1800);
    const b1 = [];
    cd.hl(1);
    for (let i = 0; i < n; i++) { b1.push(step(-5.4 + i * 0.75, 0.3, 0.5, BLUE)); await beat(tok, 300); }
    tag('block 1：n', 'ptr', -3.9, 1.3, 0.5);
    say('block 1：n 次', 'O(n)');
    await beat(tok, 1300);
    cd.hl(4);
    const b2 = [];
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) b2.push(step(0.8 + j * 0.8, 0.3, -1.6 + i * 0.8, ORANGE, 1.2)); await beat(tok, 450); }
    tag('block 2：n²', 'ptr alt', 2.4, 1.3, 2.8);
    say('block 2：n² 次', 'O(n²)');
    await beat(tok, 1500);
    b2.forEach((m) => glow(m, GOLD));
    say('整體看最慢的 block（bottleneck）', 'O(n) + O(n²) = <span class="ok">O(n²)</span>');
    await beat(tok, 2800);
  } else {
    const cd = code(['if (x > 0) {', '  x++; y++;', '} else {', '  for (i = 0; i < n; i++) x++;', '}'], 0, 6.8);
    say('if-else：兩條路的成本不一樣', '');
    await beat(tok, 1600);
    cd.hl(1);
    tag('if：2 個指令', 'ptr', -3.6, 1.8, 0);
    for (let k = 0; k < 2; k++) { step(-4 + k * 0.8, 0.3, 0, BLUE); await beat(tok, 400); }
    say('if 成立：只做 2 個指令', 'O(1)');
    await beat(tok, 1400);
    cd.hl(3);
    tag('else：for 跑 n 次', 'ptr alt', 2.6, 1.8, 0);
    const e = [];
    for (let i = 0; i < n; i++) { e.push(step(0.8 + i * 0.75, 0.3, 0, ORANGE)); await beat(tok, 350); }
    say('else：for 迴圈 n 次', 'O(n)');
    await beat(tok, 1300);
    e.forEach((m) => glow(m, GOLD));
    say('取比較大的那條路', 'max(O(1), O(n)) = <span class="ok">O(n)</span>');
    await beat(tok, 2800);
  }
}
FRAG.push(['arrpeng12-loops', '算迴圈的 step count', scLoops]);

// ── 遞迴：n! 的 T(n) = T(n−1) + c；Fibonacci 的 T(n) = T(n−1) + T(n−2) + c ──
async function scRecur(tok) {
  const fib = P().fib;
  if (!fib) {
    fresh([0, 6.5, 13], [0, 3, 0]);
    const cd = code(['int f(int n) {', '  if (n <= 1) return 1;', '  return n * f(n - 1);', '}'], -3.6, 7.4);
    say('n 階乘的遞迴', 'T(n) = 執行 f(n) 的 step count');
    await beat(tok, 1800);
    const ms = [];
    for (let k = 5; k >= 1; k--) {
      cd.hl(k > 1 ? 2 : 1);
      const x = 2.6, y = 0.4 + (5 - k) * 1.1;
      ms.push(cube('f(' + k + ')', colorFor(k), [2.0, 0.8, 1.0], x, y, 0, 2));
      tag('+c', 'idx', x + 1.6, y, 0);
      say(k > 1 ? 'f(' + k + ') 呼叫 f(' + (k - 1) + ')' : 'f(1)：boundary condition', k > 1 ? 'T(' + k + ') = T(' + (k - 1) + ') + c' : 'T(1) = c');
      await beat(tok, 900);
    }
    say('每層多花一個常數 c，共 n 層', 'T(n) = T(n−1) + c = n·c');
    await beat(tok, 2400);
    say('解遞迴式（離散／演算法會教）', 'T(n) = <span class="ok">O(n)</span>');
    await beat(tok, 2800);
    return;
  }
  fresh([0, 6, 14], [0, 3.2, 0]);
  say('Fibonacci 數列（FB 不是 Facebook）', 'F(n) = F(n−1) + F(n−2)');
  tag('T(n) = T(n−1) + T(n−2) + c', 'ptr', 0, 8.2, 0);
  await beat(tok, 2000);
  // build fib(5) call tree, x by in-order position
  const nodes = []; let ord = 0;
  (function build(v, d) { const me = { v, d }; if (v > 1) { me.l = build(v - 1, d + 1); } me.x = ord++; if (v > 1) { me.r = build(v - 2, d + 1); } nodes.push(me); return me; })(5, 0);
  const W = 0.82, off = (ord - 1) / 2;
  const pos = (nd) => [(nd.x - off) * W, 7 - nd.d * 1.45];
  const byDepth = [...nodes].sort((a, b) => a.d - b.d);
  let cnt = 0, lastD = -1;
  for (const nd of byDepth) {
    const [x, y] = pos(nd);
    cube(String(nd.v), colorFor(nd.v), [0.7, 0.55, 0.7], x, y, 0, 1.2);
    for (const ch of [nd.l, nd.r]) if (ch) { const [cx, cy] = pos(ch); line(x, y - 0.3, cx, cy + 0.3); }
    cnt++;
    if (nd.d !== lastD) { lastD = nd.d; say('第 ' + nd.d + ' 層的呼叫', '目前共 ' + cnt + ' 次呼叫'); await beat(tok, 700); }
    else await beat(tok, 150);
  }
  say('F(5) 共呼叫 ' + cnt + ' 次，同一個值被重算很多次', 'F(3) 算 2 次、F(2) 算 3 次');
  await beat(tok, 2600);
  say('呼叫次數指數成長', '補充：T(n) = O(φⁿ) ≈ O(1.618ⁿ)，上界 O(2ⁿ)');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-recur', '遞迴函式的 T(n)', scRecur]);

// ── 常見複雜度的大小：1 < log n < log²n < n < n log n < n² < n³ < 2ⁿ ──
async function scGrowth(tok) {
  const quick = P().focus === 'n2logn';
  fresh([0, 5, 15.5], [0, 3.4, 0]);
  const n = 32, L = Math.log2;
  const fs = [['1', 1], ['log n', L(n)], ['log²n', L(n) ** 2], ['n', n], ['n log n', n * L(n)], ['n²', n * n], ['n³', n ** 3], ['2ⁿ', 2 ** n]];
  const X = (i) => -6 + i * 1.6, H = (v) => 0.15 + L(v) * 0.2;
  say('常見的 g(n)：上面最好、下面最差', 'n = 32，高度用 log 尺度');
  await beat(tok, quick ? 600 : 2000);
  const bars = [], nms = [];
  for (let i = 0; i < fs.length; i++) {
    const [nm, v] = fs[i], h = H(v);
    bars.push(cube('', i === 7 ? RED : i === 0 ? GREEN : BLUE, [0.95, h, 0.95], X(i), h / 2, 0, 2));
    nms.push(tag(nm, 'idx', X(i), -0.15, 1.2));
    if (!quick) { say(nm + '（n = 32）', '= ' + (v >= 1e6 ? '≈ ' + v.toExponential(1) : Math.round(v))); await beat(tok, 750); }
  }
  if (!quick) {
    say('constant：n 是 100 萬或 1000 萬都一樣快', 'O(1) 最強');
    await beat(tok, 2200);
    say('2ⁿ 指數成長：n 稍大就往上飄', '2³² ≈ 4.3 × 10⁹');
    glow(bars[7], RED);
    await beat(tok, 2400);
  } else await beat(tok, 800);
  say('n² log n 不在表上，落在哪裡？', 'n² = n² × 1，n² log n = n² × log n');
  await beat(tok, 2400);
  const v = n * n * L(n), h = H(v);
  bars.slice(6).forEach((m, k) => { move(m, X(7 + k), m.position.y, 0); nms[6 + k].position.x = X(7 + k); });
  await beat(tok, 900);
  const nb = cube('', ORANGE, [0.95, h, 0.95], X(6), h / 2, 0, 3);
  tag('n² log n', 'ptr alt', X(6), h + 0.5, 0);
  glow(nb, GOLD);
  say('log n > 1，所以比 n² 大；log n < n，所以比 n³ 小', 'n² < <span class="ok">n² log n</span> < n³');
  await beat(tok, 3200);
}
FRAG.push(['arrpeng12-growth', '常見複雜度的大小順序', scGrowth]);

// ── 量執行時間：time.h ──
async function scTiming(tok) {
  fresh([0, 6, 13], [0, 2, 0]);
  const cd = code(['#include <time.h>', 'start = clock();', '/* 要量的程式 */', 'stop = clock();', 'duration = ((double)(stop - start))', '           / CLOCKS_PER_SEC;'], 0, 7.2);
  say('complexity 跟機器無關；執行時間跟機器有關', '');
  await beat(tok, 2000);
  line(-5.5, 0.3, 5.5, 0.3);
  cd.hl(1);
  const s = cube('start', GREEN, [1.3, 0.6, 0.8], -4.5, 0.6, 0, 2);
  say('程式開始：抓 system time', 'start = clock()');
  await beat(tok, 1500);
  cd.hl(2);
  const run = cube('', BLUE, [0.2, 0.5, 0.6], -3.6, 0.55, 0);
  await anim(tok, 1800, (t) => { run.scale.x = 1 + t * 34; run.position.x = -3.7 + t * 3.4; });
  cd.hl(3);
  cube('stop', RED, [1.3, 0.6, 0.8], 3.6, 0.6, 0, 2);
  say('程式結束：再抓一次', 'stop = clock()');
  await beat(tok, 1500);
  cd.hl(4);
  tag('duration = stop − start', 'ptr alt', 0, 1.8, 0);
  glow(s, GOLD);
  say('相減就是執行時間', '不同平台抓 system time 的方式不同');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-timing', '用 time.h 量執行時間', scTiming]);

// ── Array = <index, value> 的集合；int list[5]；key-value ──
async function scArrayDef(tok) {
  const kv = P().kv;
  fresh([0, 6, 12], [0, 1, 0]);
  say('Array：一組 <index, value> pair', 'int list[5];');
  tag('int list[5];', 'ptr', 0, 4.4, 0);
  await beat(tok, 1600);
  const X = (i) => -4.4 + i * 2.2;
  tiles(5, -4.4, 2.2, 0.05, 0, 1.9, 1.6);
  const ids = [];
  for (let i = 0; i < 5; i++) { ids.push(tag((kv ? 'key ' : '') + i, 'idx', X(i), 0, 1.3)); await beat(tok, 250); }
  say('index 就像門牌：0 到 4', '5 個位置，從 0 開始');
  await beat(tok, 1800);
  const vs = [];
  for (let i = 0; i < 5; i++) { vs.push(cube('list[' + i + ']', colorFor(i), [1.6, 0.8, 1.3], X(i), 0.5, 0, 3)); await beat(tok, 350); }
  say('每個門牌裡放一個 value', '電腦用連續的記憶體空間存它');
  await beat(tok, 2200);
  if (kv) {
    ids.forEach((l, i) => glow(vs[i], GOLD));
    say('Key-value data store（雲端常用）', 'key ≈ index，value ≈ 該位置的值');
    await beat(tok, 2600);
    say('概念上就等同一個 Array', 'MapReduce 也建立在 key-value 上');
    await beat(tok, 2600);
  } else {
    glow(vs[2], GOLD);
    say('給 index 就拿到 value', 'list[2] → 第 3 格');
    await beat(tok, 2600);
  }
}
FRAG.push(['arrpeng12-array-def', 'Array 是 <index, value> 的集合', scArrayDef]);

// ── Array ADT：Create、Retrieve(A, i)、Store(A, i, x) ──
async function scArrayAdt(tok) {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const cd = code(['ADT Array', '  objects: a set of <index, value> pairs', '  Array Create(j, list)', '  Item  Retrieve(A, i)', '  Array Store(A, i, x)'], 0, 7.2);
  say('Array 的 ADT：只說能做什麼，不說怎麼做', '像 C++ class 宣告，但更 general');
  await beat(tok, 2200);
  cd.hl(2);
  const X = (i) => -4 + i * 2;
  tiles(5, -4, 2, 0.05, 0, 1.7, 1.5);
  const vs = ['a', 'b', 'c', 'd', 'e'].map((v, i) => { tag(String(i), 'idx', X(i), 0, 1.2); return cube(v, colorFor(i), [1.4, 0.8, 1.2], X(i), 0.5, 0, 2.5); });
  say('Create：建一個陣列', 'index 0…4');
  await beat(tok, 1800);
  cd.hl(3);
  const cur = tag('i = 2', 'ptr', X(2), 2.2, 0);
  glow(vs[2], GOLD);
  move(vs[2], X(2), 1.6, 0);
  say('Retrieve(A, i)：給 index，回傳 value', 'Retrieve(A, 2) = c');
  await beat(tok, 2400);
  move(vs[2], X(2), 0.5, 0); glow(vs[2], null);
  cd.hl(4);
  cur.position.set(X(3), 2.2, 0); txt(cur, 'i = 3');
  fly(vs[3]);
  await beat(tok, 600);
  vs[3] = cube('x', PINK, [1.4, 0.8, 1.2], X(3), 0.5, 0, 3.5);
  say('Store(A, i, x)：把 x 存到位置 i', 'Store(A, 3, x)');
  await beat(tok, 2600);
}
FRAG.push(['arrpeng12-adt', 'Array ADT：Retrieve 與 Store', scArrayAdt]);

// ── int list[5] vs int *plist[5] ──
async function scPtrArray(tok) {
  fresh([0, 7, 12.5], [0, 1, 0.5]);
  const X = (i) => -4 + i * 2;
  say('兩個都是 array，存的東西不一樣', '');
  tag('int list[5];', 'ptr', -5.8, 0.4, -2.2);
  tiles(5, -4, 2, 0.05, -2.2, 1.6, 1.3);
  for (let i = 0; i < 5; i++) { cube('int', BLUE, [1.3, 0.7, 1.0], X(i), 0.45, -2.2, 2.5); await beat(tok, 220); }
  say('list：5 格，每格存一個 integer', 'list[i] 是 int');
  await beat(tok, 2000);
  tag('int *plist[5];', 'ptr alt', -5.8, 0.4, 0.8);
  tiles(5, -4, 2, 0.05, 0.8, 1.6, 1.3);
  for (let i = 0; i < 5; i++) {
    cube('ptr', '#c08a1f', [1.3, 0.7, 1.0], X(i), 0.45, 0.8, 2.5);
    const t = cube('int', TEAL, [0.9, 0.6, 0.8], X(i) + (i % 2 ? 0.5 : -0.4), 0.3, 3.6, 2);
    arrow(V3(X(i), 0.8, 1.3), V3(t.position.x, 0.6, 3.1));
    await beat(tok, 380);
  }
  say('plist：5 格，每格存一個 pointer', 'plist[i] 是 int *，指向別處的 integer');
  await beat(tok, 2600);
  say('宣告不同，意義也不同', '* 代表存的是記憶體 address');
  await beat(tok, 2600);
}
FRAG.push(['arrpeng12-ptr-array', 'int list[5] 與 int *plist[5]', scPtrArray]);

// ── 一維陣列的 address：list[i] 在 α + i·sizeof(int) ──
async function scAddress(tok) {
  fresh([0, 6, 12.5], [0, 1, 0]);
  say('一維陣列：一塊連續的記憶體', 'int list[5]；list[0] 在 α');
  const X = (i) => -4.4 + i * 2.2;
  const cs = [];
  for (let i = 0; i < 5; i++) { cs.push(cube('list[' + i + ']', colorFor(i), [2.0, 0.8, 1.3], X(i), 0.45, 0, 2)); await beat(tok, 200); }
  await beat(tok, 1200);
  const addr = ['α', 'α + sizeof(int)', 'α + 2·sizeof(int)', 'α + 3·sizeof(int)', 'α + 4·sizeof(int)'];
  const cur = tag('', 'ptr', X(0), 1.6, 0);
  for (let i = 0; i < 5; i++) {
    cur.position.set(X(i), 1.6, 0); txt(cur, 'list[' + i + ']');
    glow(cs[i], GOLD); if (i) glow(cs[i - 1], null);
    tag(addr[i], 'idx', X(i), -0.1, i % 2 ? 1.9 : 1.2);
    say(i === 0 ? 'list[0] 的位置是 α' : '往後 shift ' + i + ' 個 integer 的大小', 'list[' + i + '] 的 address = ' + addr[i]);
    await beat(tok, i < 3 ? 1700 : 1000);
  }
  say('sizeof(int)：一個 integer 佔幾個 byte', 'list[i] 在 <span class="ok">α + i·sizeof(int)</span>');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-address', '一維陣列的記憶體位址', scAddress]);

// ── int *list1 vs int list2[5]；list2+i、*(list2+i) ──
async function scPtrNotation(tok) {
  fresh([0, 7, 12.5], [0, 1, 0.3]);
  const X = (i) => -2.6 + i * 1.8;
  say('int *list1; 和 int list2[5]; 都是 pointer', '差在指到的空間大小');
  cube('list1', '#c08a1f', [1.4, 0.7, 1.0], -5.6, 0.4, -2.2, 2);
  const one = cube('int', TEAL, [1.4, 0.7, 1.0], -2.6, 0.4, -2.2, 2);
  arrow(V3(-4.8, 0.4, -2.2), V3(-3.4, 0.4, -2.2));
  say('list1：只指到一個 integer 的空間', 'int *list1;');
  glow(one, GOLD);
  await beat(tok, 2400);
  cube('list2', '#c08a1f', [1.4, 0.7, 1.0], -5.6, 0.4, 1.2, 2);
  const cs = [];
  for (let i = 0; i < 5; i++) { cs.push(cube('[' + i + ']', colorFor(i), [1.6, 0.7, 1.1], X(i), 0.4, 1.2, 2)); await beat(tok, 200); }
  let ar = arrow(V3(-4.8, 0.4, 1.2), V3(-3.5, 0.4, 1.2));
  say('list2：指到連續 5 個 integer 的空間', 'int list2[5];');
  await beat(tok, 2200);
  const f = tag('list2 ≡ &list2[0]', 'ptr', X(0), 1.8, 1.2);
  glow(cs[0], GOLD);
  say('不寫 index：list2 就是 list2[0] 的位址', 'list2 = &list2[0]');
  await beat(tok, 2400);
  for (const i of [1, 3]) {
    glow(cs[i - (i === 1 ? 1 : 2)], null); glow(cs[i], GOLD);
    kill(ar); ar = arrow(V3(-4.8, 1.0, 1.2), V3(X(i), 0.9, 1.2), 0xc08a1f);
    f.position.set(X(i), 1.8, 1.2); txt(f, 'list2 + ' + i);
    say('pointer + 整數：往後移 i 個 int', 'list2 + ' + i + ' = &list2[' + i + ']');
    await beat(tok, 2200);
  }
  move(cs[3], X(3), 1.3, 1.2);
  txt(f, '*(list2 + 3)');
  f.position.set(X(3), 2.3, 1.2);
  say('前面加 *：取出那格的 value', '*(list2 + i) = list2[i]');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-ptr-notation', 'list2 + i 與 *(list2 + i)', scPtrNotation]);

// ── Program 2.1 print1：one[] = {0,1,2,3,4}，印出 address 與 contents ──
async function scPrint1(tok) {
  fresh([0, 6.5, 13], [0, 2.4, 0]);
  const cd = code(['int one[] = {0, 1, 2, 3, 4};', 'print1(&one[0], 5);', '', 'void print1(int *ptr, int rows) {', '  int i;', '  printf("Address Contents\\n");', '  for (i = 0; i < rows; i++)', '    printf("%8u%5d\\n", ptr + i, *(ptr + i));', '}'], -2.4, 7.6, 0.5);
  say('print1：用 pointer 印出一維陣列', 'one[] = {0, 1, 2, 3, 4}');
  await beat(tok, 2200);
  cd.hl(1);
  const X = (i) => -4.8 + i * 1.6;
  const cs = [];
  for (let i = 0; i < 5; i++) { cs.push(cube(String(i), colorFor(i), [1.4, 0.7, 1.1], X(i), 0.4, 1.6, 2)); await beat(tok, 200); }
  const pt = tag('ptr', 'ptr', X(0), 1.5, 1.6);
  say('傳入 &one[0] 和 rows = 5', 'ptr 指到 one[0]');
  await beat(tok, 1800);
  cd.hl(5);
  tag('Address  Contents', 'ptr alt', 4.6, 3.4, 1.6);
  await beat(tok, 900);
  for (let i = 0; i < 5; i++) {
    cd.hl(7);
    pt.position.set(X(i), 1.5, 1.6); txt(pt, 'ptr + ' + i);
    glow(cs[i], GOLD); if (i) glow(cs[i - 1], null);
    const a = 1228 + 2 * i;
    const l = tag(String(a).padStart(8, ' ') + String(i).padStart(5, ' '), '', 4.6, 2.8 - i * 0.5, 1.6);
    Object.assign(l.element.style, MONO);
    say('%8u 印 address、%5d 印 value', 'ptr + ' + i + ' = ' + a + '，*(ptr + ' + i + ') = ' + i);
    await beat(tok, 1300);
  }
  say('位址每次加 sizeof(int)', '書上的機器 int 佔 2 bytes：1228、1230…');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-print1', 'print1：印出位址與內容', scPrint1]);

// ── struct：person 的三個欄位；typedef struct humanBeing ──
async function scStruct(tok) {
  const td = P().typedef;
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  const lines = td
    ? ['typedef struct {', '  char name[10];', '  int age;', '  float salary;', '} humanBeing;', 'humanBeing person1, person2;']
    : ['struct {', '  char name[10];', '  int age;', '  float salary;', '} person;', 'strcpy(person.name, "james");', 'person.age = 10;', 'person.salary = 35000;'];
  const cd = code(lines, -3.4, 7.4, 0.52);
  say(td ? 'typedef：替 structure 取一個型別名字' : 'structure：自己組一個 data type', td ? 'humanBeing 變成新的 data type' : 'name、age、salary 三個欄位');
  await beat(tok, 2200);
  const mk = (z, nm) => {
    tag(nm, 'ptr', 3, 3.5, z);
    return [['name', BLUE], ['age', ORANGE], ['salary', PURPLE]].map(([f, c], k) => { tag(f, 'idx', 1.0, 2.6 - k * 0.95, z); return cube('', c, [2.4, 0.8, 1.0], 3.3, 2.6 - k * 0.95, z, 2); });
  };
  if (!td) {
    const fs = mk(0, 'person');
    await beat(tok, 1500);
    const vals = ['"james"', '10', '35000'];
    for (let k = 0; k < 3; k++) {
      cd.hl(5 + k);
      relabel(fs[k], vals[k]);
      if (!fs[k].userData.lbl) { fs[k].userData.lbl = lab.label(vals[k], 'val'); fs[k].add(fs[k].userData.lbl); }
      glow(fs[k], GOLD); if (k) glow(fs[k - 1], null);
      say(k === 0 ? 'strcpy：把字串 copy 到 name' : '用「.」存取欄位', lines[5 + k]);
      await beat(tok, 1900);
    }
    say('一個變數，三個不同型別的欄位', 'person.name / person.age / person.salary');
    await beat(tok, 2600);
  } else {
    cd.hl(4);
    mk(-1.4, 'person1');
    await beat(tok, 900);
    cd.hl(5);
    mk(1.4, 'person2');
    say('用 humanBeing 宣告變數', 'humanBeing person1, person2;');
    await beat(tok, 2400);
    say('另一種寫法：typedef struct human_being {…}', 'union、自我參考的 struct 留到 list 再講');
    await beat(tok, 2800);
  }
}
FRAG.push(['arrpeng12-struct', 'struct 與 typedef', scStruct]);

// ── Ordered list：一週 7 天；length、由左到右 read、取第 i 個 ──
async function scOrderedList(tok) {
  fresh([0, 6, 13], [0, 1, 0]);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const X = (i) => -5.4 + i * 1.8;
  say('Ordered list：有順序的一串資料', '例：一週 7 天');
  const cs = [];
  for (let i = 0; i < 7; i++) { tag(String(i), 'idx', X(i), 0, 1.1); cs.push(cube(days[i], colorFor(i), [1.5, 0.7, 1.1], X(i), 0.4, 0, 2.5)); await beat(tok, 220); }
  await beat(tok, 1200);
  say('可以用 array 存：第 i 項放在 index i', '(Sunday, Monday, …, Saturday)');
  await beat(tok, 2000);
  tag('length = 7', 'ptr', 0, 2.2, 0);
  say('問 list 有多長', 'length = 7');
  await beat(tok, 1800);
  const cur = tag('▼', 'ptr alt', X(0), 1.4, 0);
  for (let i = 0; i < 7; i++) { cur.position.set(X(i), 1.4, 0); glow(cs[i], GOLD); if (i) glow(cs[i - 1], null); say('scan：由左到右讀出所有值', days[i]); await beat(tok, 450); }
  glow(cs[6], null);
  cur.position.set(X(3), 1.4, 0); glow(cs[3], GREEN);
  say('取出第 i 個位置的值', 'retrieve(3) = Wed');
  await beat(tok, 2800);
}
FRAG.push(['arrpeng12-ordered-list', 'Ordered list 與它的操作', scOrderedList]);

// ── 多項式：A(x) = 3x²⁰ + 2x⁵ + 4，B(x) = x⁴ + 10x³ + 3x² + 1，A + B ──
async function scPolyIntro(tok) {
  fresh([0, 7, 13], [0, 1, 0]);
  const cols = [20, 5, 4, 3, 2, 0], X = (e) => -5 + cols.indexOf(e) * 2;
  const A = [[3, 20], [2, 5], [4, 0]], B = [[1, 4], [10, 3], [3, 2], [1, 0]];
  say('多項式：係數 × x 的指數', 'A(x) = 3x²⁰ + 2x⁵ + 4');
  tag('A', 'ptr', -6.6, 0.4, -2.4); tag('B', 'ptr alt', -6.6, 0.4, 0);
  const am = A.map(([c, e]) => cube(term(c, e), BLUE, [1.7, 0.7, 1.1], X(e), 0.4, -2.4, 2.5));
  await beat(tok, 1800);
  say('B(x) = x⁴ + 10x³ + 3x² + 1', '');
  const bm = B.map(([c, e]) => cube(term(c, e), ORANGE, [1.7, 0.7, 1.1], X(e), 0.4, 0, 2.5));
  await beat(tok, 1800);
  cols.forEach((e) => tag('x' + sup(e), 'idx', X(e), 0, 3.6));
  say('加法：同指數的係數相加', 'A(x) + B(x) = Σ (aᵢ + bᵢ) xⁱ');
  await beat(tok, 2000);
  for (const e of cols) {
    const a = A.find((t) => t[1] === e), b = B.find((t) => t[1] === e);
    const ma = a ? am[A.indexOf(a)] : null, mb = b ? bm[B.indexOf(b)] : null;
    if (ma) move(ma, X(e), 0.4, 2.4); if (mb) move(mb, X(e), ma ? 1.15 : 0.4, 2.4);
    await beat(tok, 700);
    if (ma && mb) {
      fly(ma); fly(mb);
      cube(term(a[0] + b[0], e), GREEN, [1.7, 0.7, 1.1], X(e), 0.4, 2.4, 2);
      say('指數相同：係數相加', a[0] + ' + ' + b[0] + ' = ' + (a[0] + b[0]));
      await beat(tok, 1800);
    }
  }
  say('A(x) + B(x)', '= 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5');
  await beat(tok, 2400);
  say('ADT 也有 Eval：代入 x 算出值', 'Eval(poly, f)，例如 x = 5');
  await beat(tok, 2600);
}
FRAG.push(['arrpeng12-poly-intro', '多項式與加法', scPolyIntro]);

// ── 表示法 1：coef[MaxDegree + 1]，index = 指數，value = 係數 ──
async function scPolyRep1(tok) {
  const sparse = P().poly === 'sparse';
  fresh([0, 6.5, 13], [0, 1.2, 0]);
  const cd = code(['int degree;', 'float coef[MAX_DEGREE + 1];'], 0, 5.6);
  say('表示法 1：每個多項式一個係數 array', 'index = 指數，value = 係數');
  await beat(tok, 2000);
  if (!sparse) {
    tag('x⁴ + 10x³ + 3x² + 1', 'ptr', 0, 3.8, 0);
    const coef = [1, 0, 3, 10, 1], X = (i) => -4.4 + i * 2.2;
    tiles(5, -4.4, 2.2, 0.05, 0, 1.9, 1.5);
    const cs = [];
    for (let i = 4; i >= 0; i--) {
      tag('[' + i + ']  x' + sup(i), 'idx', X(i), 0, 1.3);
      cs[i] = cube(String(coef[i]), coef[i] ? colorFor(coef[i]) : GRAY, [1.6, 0.75, 1.2], X(i), 0.45, 0, 2.5);
      say(i === 4 ? '位置 4 放 x⁴ 的係數' : coef[i] ? '位置 ' + i + ' 放 x' + sup(i) + ' 的係數' : '沒有 x' + sup(i) + ' 項：係數 0', 'coef[' + i + '] = ' + coef[i]);
      await beat(tok, 1100);
    }
    cd.hl(1);
    say('最高只能到 MAX_DEGREE', '+1 是給常數項（index 0）');
    await beat(tok, 2600);
    say('degree = 4', 'coef = [1, 0, 3, 10, 1]（index 0…4）');
    await beat(tok, 2600);
  } else {
    tag('2x¹⁰⁰⁰ + 1', 'ptr', 0, 3.8, 0);
    const idx = [0, 1, 2, 3, '…', 998, 999, 1000], X = (i) => -5.6 + i * 1.6;
    for (let k = 0; k < idx.length; k++) {
      if (idx[k] === '…') { tag('… 0 …', 'idx', X(k), 0.5, 0); continue; }
      const v = idx[k] === 1000 ? 2 : idx[k] === 0 ? 1 : 0;
      tag(String(idx[k]), 'idx', X(k), 0, 1.2);
      cube(String(v), v ? GREEN : GRAY, [1.3, 0.7, 1.0], X(k), 0.4, 0, 2);
      await beat(tok, 250);
    }
    say('sparse：1001 格只有 2 格不是 0', 'coef[1000] = 2，coef[0] = 1');
    await beat(tok, 2800);
    say('其他 999 格全是 0：浪費空間', '→ 想要只存非 0 項的表示法');
    await beat(tok, 2800);
  }
}
FRAG.push(['arrpeng12-poly-rep1', '多項式表示法 1：係數陣列', scPolyRep1]);

// ── padd 虛擬碼：比 LeadExp，三個 case，Attach + Remove ──
async function scPadd(tok) {
  fresh([0, 7.5, 13.5], [0, 1.8, 0]);
  const cd = code(['D = Zero();', 'while (!IsZero(A) && !IsZero(B))', '  switch COMPARE(LeadExp(A), LeadExp(B)) {', '   case -1: Attach(D, B 的最高項); Remove B 的最高項', '   case  0: sum = 兩係數相加; if (sum) Attach(D, sum)', '            Remove A、B 的最高項', '   case  1: Attach(D, A 的最高項); Remove A 的最高項', '  }'], 0, 7.6, 0.48);
  const A = [[3, 20], [2, 5], [4, 0]], B = [[1, 4], [10, 3], [3, 2], [1, 0]];
  const X = (i) => -4.2 + i * 1.9;
  tag('A', 'ptr', -6, 0.4, -2.2); tag('B', 'ptr alt', -6, 0.4, 0); tag('D', 'ptr', -6, 0.4, 2.4);
  const am = A.map(([c, e], i) => cube(term(c, e), BLUE, [1.6, 0.7, 1.0], X(i), 0.4, -2.2, 2));
  const bm = B.map(([c, e], i) => cube(term(c, e), ORANGE, [1.6, 0.7, 1.0], X(i), 0.4, 0, 2));
  cd.hl(0);
  say('d = a + b：先把 D 清成 0', 'A = 3x²⁰ + 2x⁵ + 4，B = x⁴ + 10x³ + 3x² + 1');
  await beat(tok, 2600);
  let ia = 0, ib = 0, nd = 0;
  const shift = (ms, k) => ms.slice(k).forEach((m, j) => move(m, X(j), 0.4, m.position.z));
  while (ia < A.length && ib < B.length) {
    const ea = A[ia][1], eb = B[ib][1];
    glow(am[ia], GOLD); glow(bm[ib], GOLD);
    cd.hl(2);
    say('LeadExp(A) = ' + ea + '，LeadExp(B) = ' + eb, 'COMPARE(' + ea + ', ' + eb + ') = ' + (ea > eb ? 1 : ea < eb ? -1 : 0));
    await beat(tok, 1500);
    if (ea > eb) {
      cd.hl(6); move(am[ia], X(nd), 0.4, 2.4); glow(am[ia], null); glow(bm[ib], null);
      say('case 1：A 的最高項 copy 到 D，再從 A 刪掉', 'Attach ' + term(...A[ia]));
      ia++; nd++; await beat(tok, 900); shift(am, ia);
    } else if (ea < eb) {
      cd.hl(3); move(bm[ib], X(nd), 0.4, 2.4); glow(am[ia], null); glow(bm[ib], null);
      say('case −1：B 的最高項 copy 到 D，再從 B 刪掉', 'Attach ' + term(...B[ib]));
      ib++; nd++; await beat(tok, 900); shift(bm, ib);
    } else {
      cd.hl(4);
      const s = A[ia][0] + B[ib][0];
      fly(am[ia]); fly(bm[ib]);
      cube(term(s, ea), GREEN, [1.6, 0.7, 1.0], X(nd), 0.4, 2.4, 2);
      say('case 0：指數相同，係數相加', A[ia][0] + ' + ' + B[ib][0] + ' = ' + s);
      ia++; ib++; nd++;
    }
    await beat(tok, 1500);
  }
  cd.hl(-1);
  say('A、B 都處理完；剩下的項再接到 D 後面', 'D = 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-padd', 'padd：多項式加法虛擬碼', scPadd]);

// ── termArray：全部多項式共用一個 global array ──
const TA_A = [[2, 1000], [1, 0]], TA_B = [[1, 4], [10, 3], [3, 2], [1, 0]];
function taCell(i, c, e, X, color, dropH = 2) {
  const m = cube(String(c), color, [X.w, 0.7, 1.0], X(i), 0.45, 0, dropH);
  const ex = cube(String(e), '#d8c29b', [X.w, 0.5, 1.0], X(i), 0.45, 1.05, dropH);
  return [m, ex];
}
function taFrame(n, x0, dx, w) {
  const X = (i) => x0 + i * dx; X.w = w;
  tag('coef', 'idx', x0 - dx * 0.95, 0.45, 0); tag('exp', 'idx', x0 - dx * 0.95, 0.45, 1.05);
  for (let i = 0; i < n; i++) tag(String(i), 'idx', X(i), 0, 2.0);
  return X;
}
async function scTermArray(tok) {
  fresh([0, 7, 12.5], [0, 1.2, 0.5]);
  say('表示法 3：所有多項式放進同一個 array', '只存非 0 項：(coef, exp)');
  tag('A(x) = 2x¹⁰⁰⁰ + 1', 'ptr', -3.4, 4.6, 0); tag('B(x) = x⁴ + 10x³ + 3x² + 1', 'ptr alt', 2.6, 4.6, 0);
  await beat(tok, 2200);
  const X = taFrame(7, -4.8, 1.6, 1.35);
  const all = [...TA_A.map((t) => [t, BLUE]), ...TA_B.map((t) => [t, ORANGE])];
  for (let i = 0; i < all.length; i++) {
    taCell(i, all[i][0][0], all[i][0][1], X, all[i][1]);
    say(i < 2 ? 'A 的第 ' + (i + 1) + ' 項' : 'B 的第 ' + (i - 1) + ' 項', 'index ' + i + '：coef = ' + all[i][0][0] + '，exp = ' + all[i][0][1]);
    await beat(tok, 700);
  }
  tiles(1, X(6), 1, 0.05, 0.5, 1.35, 2.1, '#f6efe2');
  tag('A.start', 'ptr', X(0), 2.2, -0.4); tag('A.finish', 'ptr', X(1), 1.6, -0.4);
  say('A 佔 index 0 … 1', 'A.start = 0，A.finish = 1');
  await beat(tok, 2200);
  tag('B.start', 'ptr alt', X(2), 2.2, -0.4); tag('B.finish', 'ptr alt', X(5), 2.2, -0.4);
  say('B 佔 index 2 … 5', 'B.start = 2，B.finish = 5');
  await beat(tok, 2200);
  tag('free', 'ptr', X(6), 1.6, -0.4);
  say('free：第一個還沒用的位置', 'free = 6，下一個多項式從這裡開始');
  await beat(tok, 2200);
  say('上面的 A.start 等字只是說明，array 不存', '每個多項式要記 start、finish');
  await beat(tok, 2800);
}
FRAG.push(['arrpeng12-term-array', '表示法 3：共用的 termArray', scTermArray]);

// ── class Term / class Polynomial：static termArray、static free ──
async function scPolyClass(tok) {
  fresh([0, 7, 13], [0, 2, 0]);
  const cd = code(['class Term {', '  friend Polynomial;', '  float coef; int exp;', '};', 'class Polynomial {', ' private:', '  static Term termArray[MaxTerms];', '  static int free;', '  int start, finish;', '};'], -3.4, 7.8, 0.5);
  say('class Term：一項 = coef + exp', 'Polynomial 是它的 friend class');
  cd.hl(2);
  await beat(tok, 2600);
  const arr = [];
  for (let i = 0; i < 6; i++) arr.push(cube('', i < 2 ? BLUE : ORANGE, [0.75, 0.6, 0.9], 0.6 + i * 0.85, 0.35, 0, 1.5));
  tag('termArray（只有一份）', 'ptr alt', 2.7, 1.3, 0);
  tag('free = 6', 'idx', 5.9, 0.35, 1.0);
  cd.hl(6);
  say('static Term termArray[MaxTerms]', '全部多項式共用的 global array');
  await beat(tok, 2400);
  cd.hl(8);
  const pa = cube('A', BLUE, [1.2, 0.7, 1.0], 1.3, 0.4, 3.4, 2), pb = cube('B', ORANGE, [1.2, 0.7, 1.0], 4.3, 0.4, 3.4, 2);
  tag('start 0 / finish 1', 'idx', 1.3, 0, 4.3); tag('start 2 / finish 5', 'idx', 4.3, 0, 4.3);
  const a1 = arrow(V3(1.3, 0.8, 2.9), V3(1.0, 0.7, 0.5)), a2 = arrow(V3(4.3, 0.8, 2.9), V3(3.3, 0.7, 0.5));
  say('每個 Polynomial 物件只記自己的 start、finish', 'Polynomial A, B;');
  await beat(tok, 2600);
  say('為什麼要 static？', '');
  await beat(tok, 1800);
  kill(a1); kill(a2);
  const g1 = ghostBox(RED, 4.6, 0.6, 0.9); g1.position.set(1.8, 1.2, 2.2);
  const g2 = ghostBox(RED, 4.6, 0.6, 0.9); g2.position.set(4.0, 1.9, 1.4);
  say('不寫 static：每個多項式都有自己的 termArray', '<span class="no">就做不到「一個 array 存全部」</span>');
  await beat(tok, 2600);
  kill(g1); kill(g2);
  arrow(V3(1.3, 0.8, 2.9), V3(1.0, 0.7, 0.5)); arrow(V3(4.3, 0.8, 2.9), V3(3.3, 0.7, 0.5));
  cd.hl(7);
  say('寫 static：A、B 共用 termArray 和 free', '<span class="ok">class 層級只有一份</span>');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-poly-class', 'Term 與 Polynomial 類別（static）', scPolyClass]);

// ── 用 termArray 做加法：C.start = free，NewTerm 寫在 free 再 free++ ──
async function scPaddGlobal(tok) {
  fresh([0, 7.5, 13], [0, 1.6, 0.6]);
  const cd = code(['C.start = free; a = start; b = B.start;', 'while (a <= finish && b <= B.finish)', '  switch (compare(termArray[a].exp, termArray[b].exp)) {', '   case \'=\': c = 兩 coef 相加; if (c) NewTerm(c, exp); a++; b++;', '   case \'<\': NewTerm(b 的 coef, exp); b++;', '   case \'>\': NewTerm(a 的 coef, exp); a++;', '  }', 'for (; a <= finish; a++) NewTerm(…);', 'for (; b <= B.finish; b++) NewTerm(…);', 'C.finish = free − 1;'], 0, 8.4, 0.44);
  const X = taFrame(11, -5.5, 1.1, 0.95);
  const all = [...TA_A, ...TA_B];
  const cells = all.map(([c, e], i) => taCell(i, c, e, X, i < 2 ? BLUE : ORANGE, 0));
  const fr = tag('free', 'ptr', X(6), 1.6, -0.4);
  const pa = tag('a', 'ptr', X(0), 2.3, -0.4), pb = tag('b', 'ptr alt', X(2), 2.3, -0.4);
  cd.hl(0);
  say('C 從 free 開始放：C.start = 6', 'a = A.start = 0，b = B.start = 2');
  await beat(tok, 2600);
  let a = 0, b = 2, free = 6;
  const newTerm = async (c, e) => {
    taCell(free, c, e, X, GREEN, 2);
    free++; fr.position.set(X(Math.min(free, 10)), 1.6, -0.4); txt(fr, 'free = ' + free);
    await beat(tok, 700);
  };
  while (a <= 1 && b <= 5) {
    const ea = all[a][1], eb = all[b][1];
    cells[a].forEach((m) => glow(m, GOLD)); cells[b].forEach((m) => glow(m, GOLD));
    say('比 termArray[' + a + '].exp 和 termArray[' + b + '].exp', ea + (ea > eb ? ' > ' : ea < eb ? ' < ' : ' = ') + eb);
    cd.hl(ea === eb ? 3 : ea < eb ? 4 : 5);
    await beat(tok, 1400);
    cells[a].forEach((m) => glow(m, null)); cells[b].forEach((m) => glow(m, null));
    if (ea > eb) { say('A 的指數大：NewTerm(' + all[a][0] + ', ' + ea + ')', '寫到 termArray[' + free + ']，free++'); await newTerm(all[a][0], ea); a++; }
    else if (ea < eb) { say('B 的指數大：NewTerm(' + all[b][0] + ', ' + eb + ')', '寫到 termArray[' + free + ']，free++'); await newTerm(all[b][0], eb); b++; }
    else { const c = all[a][0] + all[b][0]; say('指數相同：係數相加 ' + all[a][0] + ' + ' + all[b][0] + ' = ' + c, 'NewTerm(' + c + ', ' + ea + ')，a++、b++'); await newTerm(c, ea); a++; b++; }
    pa.position.set(X(Math.min(a, 10)), 2.3, -0.4); pb.position.set(X(Math.min(b, 10)), 2.3, -0.4);
    await beat(tok, 700);
  }
  cd.hl(7);
  say('其中一個先走完：剩下的項用 for 迴圈 copy', '這個例子 A、B 同時走完，沒有剩');
  await beat(tok, 2400);
  cd.hl(9);
  tag('C：6 … ' + (free - 1), 'ptr', X(8), 2.3, -0.4);
  say('C.finish = free − 1 = ' + (free - 1), 'C(x) = 2x¹⁰⁰⁰ + x⁴ + 10x³ + 3x² + 2');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-padd-global', '在 termArray 上做多項式加法', scPaddGlobal]);

// ── NewTerm：C(x) = x¹⁰⁰ + 1 放到 free = 6 之後 ──
async function scNewTerm(tok) {
  fresh([0, 7, 12.5], [0, 1.4, 0.6]);
  const cd = code(['void Polynomial::NewTerm(float c, int e) {', '  if (free >= MaxTerms) { cerr << "Too many terms"; return; }', '  termArray[free].coef = c;', '  termArray[free].exp = e;', '  free++;', '}'], 0, 7.4, 0.5);
  const X = taFrame(9, -5.2, 1.3, 1.1);
  [...TA_A, ...TA_B].forEach(([c, e], i) => taCell(i, c, e, X, i < 2 ? BLUE : ORANGE, 0));
  let free = 6;
  const fr = tag('free = 6', 'ptr', X(6), 1.7, -0.4);
  say('新的多項式 C(x) = x¹⁰⁰ + 1', 'C.start = free = 6');
  await beat(tok, 2400);
  for (const [c, e] of [[1, 100], [1, 0]]) {
    cd.hl(1);
    say('先檢查 free 有沒有超過 MaxTerms', free + ' < MaxTerms → 放得下');
    await beat(tok, 1600);
    cd.hl(2);
    taCell(free, c, e, X, GREEN, 2);
    say('NewTerm(' + c + ', ' + e + ')：寫進 termArray[' + free + ']', 'coef = ' + c + '，exp = ' + e);
    await beat(tok, 1600);
    cd.hl(4);
    free++; fr.position.set(X(free), 1.7, -0.4); txt(fr, 'free = ' + free);
    say('free++：指到下一個空位', 'free = ' + free);
    await beat(tok, 1400);
  }
  tag('C.start = 6', 'ptr alt', X(6), 2.4, -0.4); tag('C.finish = 7', 'ptr alt', X(7), 3.0, -0.4);
  say('C 佔 index 6 … 7', '超過 MaxTerms 就印 "Too many terms"');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-newterm', 'NewTerm：把新項寫到 free', scNewTerm]);

// ── 加法的時間 O(n + m) 與 storage 分析 ──
async function scPolyCost(tok) {
  const space = P().focus === 'space';
  fresh([0, 7, 13], [0, 1.4, 0]);
  if (!space) {
    const n = 3, m = 4, X = (i) => -4.5 + i * 1.6;
    tag('A：n = ' + n + ' 個非 0 項', 'ptr', -1, 0.4, -2.6); tag('B：m = ' + m + ' 個非 0 項', 'ptr alt', -1, 0.4, -0.6);
    const am = [], bm = [];
    for (let i = 0; i < n; i++) am.push(cube('', BLUE, [1.3, 0.6, 0.9], X(i) + 3.6, 0.35, -2.6, 2));
    for (let i = 0; i < m; i++) bm.push(cube('', ORANGE, [1.3, 0.6, 0.9], X(i) + 3.6, 0.35, -0.6, 2));
    say('兩個指標 a、b 各自往右掃', '每一圈至少有一個指標前進');
    await beat(tok, 2200);
    // A = 3x²⁰ + 2x⁵ + 4, B = x⁴ + 10x³ + 3x² + 1：比 6 次
    const order = ['a', 'a', 'b', 'b', 'b', 'ab'];
    let ia = 0, ib = 0, k = 0;
    const cnt = tag('', 'ptr', 0, 2.4, 1.6);
    for (const o of order) {
      k++;
      if (o.includes('a')) { glow(am[ia], GOLD); move(am[ia], am[ia].position.x, 0.35, 1.6); ia++; }
      if (o.includes('b')) { glow(bm[ib], GOLD); move(bm[ib], bm[ib].position.x, 0.35 + (o === 'ab' ? 0.65 : 0), 1.6); ib++; }
      txt(cnt, '第 ' + k + ' 圈');
      say(o === 'ab' ? '指數相同：a、b 一起前進' : (o === 'a' ? 'a' : 'b') + ' 前進一格', '已掃 a：' + ia + '/' + n + '，b：' + ib + '/' + m);
      await beat(tok, 900);
    }
    say('最多 n + m 圈', '時間 = <span class="ok">O(n + m)</span>');
    await beat(tok, 2400);
    say('n、m 是「非 0」的項數', '係數 0 的項根本不在 termArray 裡');
    await beat(tok, 2800);
  } else {
    say('storage：每個多項式記 start、finish', '加上 2 × (finish − start + 1)');
    tag('2 = coef + exp', 'ptr alt', 0, 4.2, 0);
    await beat(tok, 2400);
    const H = (v) => 0.2 + Math.log10(v + 1) * 1.3;
    const bars = [['sparse 2x¹⁰⁰⁰ + 1', 1001, 2 * 2 + 2], ['dense：x¹⁰⁰⁰ … x⁰ 全非 0', 1001, 2 * 1001 + 2]];
    for (let k = 0; k < 2; k++) {
      const [nm, r1, r3] = bars[k], x = k ? 2.8 : -2.8;
      tag(nm, 'idx', x, 0, 2);
      const b1 = cube('', BLUE, [1.2, H(r1), 1.2], x - 0.8, H(r1) / 2, 0, 1.5);
      tag('表示法 1：' + r1, 'idx', x - 0.8, H(r1) + 0.4, 0);
      await beat(tok, 900);
      const b3 = cube('', ORANGE, [1.2, H(r3), 1.2], x + 0.8, H(r3) / 2, 0, 1.5);
      tag('表示法 3：' + r3, 'idx', x + 0.8, H(r3) + 0.4, 0);
      glow(k ? b1 : b3, GREEN);
      say(k ? 'non-sparse：表示法 3 要多一倍' : 'sparse：表示法 3 省很多', k ? '要存 coef 也要存 exp → 約 2 倍' : '6 個數 vs 1001 格');
      await beat(tok, 2600);
    }
    say('多數多項式是 sparse，表示法 3 還是划算', '高度是 log 尺度');
    await beat(tok, 2800);
  }
}
FRAG.push(['arrpeng12-poly-cost', '多項式加法的時間與空間', scPolyCost]);

// ── free 走到 MaxTerms：回收不用的多項式空間（像記憶體管理、磁碟重組） ──
async function scReuse(tok) {
  fresh([0, 7, 12.5], [0, 1.2, 0.5]);
  const N = 10, X = (i) => -5.4 + i * 1.2;
  for (let i = 0; i < N; i++) tag(String(i), 'idx', X(i), 0, 1.0);
  tag('MaxTerms = ' + N, 'ptr', 5.6, 1.8, 0);
  const owner = ['A', 'A', 'B', 'B', 'B', 'B', 'C', 'C', 'D', 'D'], col = { A: BLUE, B: ORANGE, C: GREEN, D: PURPLE };
  const cs = owner.map((o, i) => cube(o, col[o], [1.0, 0.7, 1.0], X(i), 0.4, 0, 2));
  const fr = tag('free = 10', 'ptr alt', 5.4, 1.2, -1.2);
  say('termArray 已經放滿', 'free = MaxTerms');
  await beat(tok, 2400);
  say('再來一個多項式 E', '<span class="no">free ≥ MaxTerms → Too many terms</span>');
  const e = cube('E', PINK, [1.0, 0.7, 1.0], 6.2, 3.2, 0);
  await beat(tok, 2400);
  say('最懶的做法：直接說「滿了」', '使用者不會滿意');
  await beat(tok, 2000);
  say('A + B 算完就不用了：destructor 把空間還回來', '~Polynomial()');
  for (let i = 0; i < 6; i++) { fly(cs[i]); await beat(tok, 200); }
  tiles(6, X(0), 1.2, 0.05, 0, 1.0, 1.0, '#f6efe2');
  await beat(tok, 1200);
  say('空位在前面，但 free 只會往後走', '<span class="no">光靠一個 free 指標找不到這些洞</span>');
  await beat(tok, 2800);
  say('像磁碟重組：把還在用的往前搬', '補充：或用 free list 記錄所有空洞');
  move(cs[6], X(0), 0.4); move(cs[7], X(1), 0.4); move(cs[8], X(2), 0.4); move(cs[9], X(3), 0.4);
  await beat(tok, 1400);
  fr.position.set(X(4), 1.2, -1.2); txt(fr, 'free = 4');
  say('搬完後 free 回到 4', 'C、D 的 start、finish 也要跟著改');
  await beat(tok, 2000);
  move(e, X(4), 0.4);
  say('新的多項式就放得下了', 'NewTerm 要改寫成能用回收的空間');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-reuse', '回收 termArray 的空間', scReuse]);

// ── Sparse matrix：6 × 6、36 格只有 8 個非 0 ──
const SM = [[0, 0, 15], [0, 3, 22], [0, 5, -15], [1, 1, 11], [1, 2, 3], [2, 3, -6], [4, 0, 91], [5, 2, 28]];
function smGrid(cx, cz, s, h) {
  const ms = {};
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const x = cx + (c - 2.5) * s, z = cz + (r - 2.5) * s;
    const hit = SM.find((t) => t[0] === r && t[1] === c);
    if (hit) ms[r + ',' + c] = cube(String(hit[2]), colorFor(Math.abs(hit[2])), [s * 0.85, h, s * 0.85], x, h / 2, z, 0);
    else cube('0', '#efe6d6', [s * 0.85, 0.12, s * 0.85], x, 0.06, z);
  }
  return ms;
}
async function scSparse2d(tok) {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.3]);
  say('矩陣最直接：n × m 的二維陣列', 'a[6][6]：6 × 6 = 36 格');
  for (let i = 0; i < 6; i++) { tag('row ' + i, 'idx', -4.8, 0, (i - 2.5) * 1.3); tag('col ' + i, 'idx', (i - 2.5) * 1.3, 0, -4.4); }
  const ms = smGrid(0, 0, 1.3, 0.7);
  await beat(tok, 2400);
  say('Sparse matrix：大部分是 0', '36 格只有 8 個非 0');
  Object.values(ms).forEach((m) => glow(m, GOLD));
  await beat(tok, 2600);
  Object.values(ms).forEach((m) => glow(m, null));
  glow(ms['0,0'], GREEN);
  say('15 在第 0 row、第 0 column', '(0, 0) = 15');
  await beat(tok, 2000);
  glow(ms['0,0'], null); glow(ms['0,3'], GREEN);
  say('22 在第 0 row、第 3 column', '(0, 3) = 22');
  await beat(tok, 2000);
  say('用二維陣列存：28 格 0 都在浪費空間', '能不能只存非 0 的元素？');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-sparse-2d', 'Sparse matrix：大部分是 0', scSparse2d]);

// ── SparseMatrix ADT：Transpose、Add、Multiply（先看 transpose 的意思） ──
async function scSparseAdt(tok) {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.3]);
  const cd = code(['class SparseMatrix {', '  SparseMatrix(int r, int c);', '  SparseMatrix Transpose();', '  SparseMatrix Add(SparseMatrix b);', '  SparseMatrix Multiply(SparseMatrix b);', '};'], 0, 5.6, 0.5, -4.2);
  say('SparseMatrix ADT：存 <row, col, value>', 'constructor 給 rows、cols');
  cd.hl(1);
  const ms = smGrid(0, 0.4, 1.2, 0.6);
  await beat(tok, 2400);
  cd.hl(2);
  say('Transpose：row 變 column、column 變 row', '(i, j, v) → (j, i, v)');
  await beat(tok, 1800);
  for (const [r, c] of SM) {
    if (r === c) continue;
    const m = ms[r + ',' + c];
    glow(m, GOLD);
    move(m, (r - 2.5) * 1.2, 0.3, 0.4 + (c - 2.5) * 1.2);
    await beat(tok, 450);
  }
  say('對角線上的（15、11）不動', '其他的沿對角線翻過去');
  await beat(tok, 2400);
  cd.hl(3);
  say('還有 Add、Multiply', '重點：怎麼表示、怎麼 transpose');
  await beat(tok, 2600);
}
FRAG.push(['arrpeng12-sparse-adt', 'SparseMatrix ADT 與 transpose', scSparseAdt]);

// ── triples：<row, col, value>，依 row 再依 col 排序；class MatrixTerm ──
function tripleRow(k, t, z, color, x0 = 1.2, dropH = 0) {
  const ms = t.map((v, j) => cube(String(v), j === 2 ? color : '#d8c29b', [1.0, 0.55, 0.75], x0 + j * 1.15, 0.3, z, dropH));
  return ms;
}
async function scTriples(tok) {
  const cls = P().cls;
  fresh([0.5, 9, 9], [0.5, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  if (cls) {
    const cd = code(['class MatrixTerm {', '  friend SparseMatrix;', '  int row, col, value;', '};', 'class SparseMatrix {', '  int rows, cols, terms, capacity;', '  MatrixTerm *smArray;', '};'], -3.6, 5.6, 0.5, -1);
    say('MatrixTerm：一個非 0 元素', 'row、col、value 三個欄位');
    cd.hl(2);
    await beat(tok, 2400);
    cd.hl(6);
    say('smArray：MatrixTerm 組成的一維 array', 'capacity = 最多能放幾個 term');
    for (let k = 0; k < 8; k++) { tag('smArray[' + k + ']', 'idx', 0, 0.3, Z(k)); tripleRow(k, SM[k], Z(k), colorFor(Math.abs(SM[k][2])), 1.6, 1.5); await beat(tok, 250); }
    await beat(tok, 1600);
    say('名字都不是亂取：MatrixTerm、smArray', 'rows = 6、cols = 6、terms = 8');
    await beat(tok, 3000);
    return;
  }
  say('只記非 0 元素的位置和值', '<row, col, value>');
  tag('row', 'idx', 1.2, 0.3, -4.3); tag('col', 'idx', 2.35, 0.3, -4.3); tag('value', 'idx', 3.5, 0.3, -4.3);
  // small 6×6 grid on the left
  const g = smGrid(-4, 0, 0.62, 0.35);
  await beat(tok, 2000);
  for (let k = 0; k < 8; k++) {
    const [r, c, v] = SM[k];
    glow(g[r + ',' + c], GOLD);
    tag('a[' + k + ']', 'idx', 0, 0.3, Z(k));
    tripleRow(k, SM[k], Z(k), colorFor(Math.abs(v)), 1.2, 1.5);
    say(k === 0 ? '先排 row 小的；同 row 再排 col 小的' : k === 3 ? 'row 0 放完，才放 row 1' : 'a[' + k + '] = (' + r + ', ' + c + ', ' + v + ')', '(' + r + ', ' + c + ', ' + v + ')');
    await beat(tok, k === 0 || k === 3 ? 1900 : 1000);
    glow(g[r + ',' + c], null);
  }
  say('8 個 triple 放在一維 array a[0…7]', '依 row 排序，同 row 依 column 排序');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-triples', '用 <row, col, value> 存 sparse matrix', scTriples]);

// ── transpose 的目標：(0,3,22) → (3,0,22)，結果仍要 row-major 排好 ──
async function scTransposeGoal(tok) {
  fresh([0, 9, 9.5], [0, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  const B = SM.map(([r, c, v]) => [c, r, v]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  tag('A', 'ptr', -4.6, 0.3, -4.3); tag('B = Aᵀ', 'ptr alt', 2.4, 0.3, -4.3);
  const ra = SM.map((t, k) => { tag(String(k), 'idx', -6.4, 0.3, Z(k)); return tripleRow(k, t, Z(k), colorFor(Math.abs(t[2])), -5.6); });
  say('A 的 triple 已經依 row、col 排好', 'transpose：(i, j, v) → (j, i, v)');
  await beat(tok, 2200);
  ra[1].forEach((m) => glow(m, GOLD));
  const one = tripleRow(0, [3, 0, 22], -1.0, colorFor(22), 1.2, 2);
  say('(0, 3, 22) 轉過去', '→ (3, 0, 22)：第 3 row、第 0 column');
  await beat(tok, 2600);
  one.forEach((m) => fly(m)); ra[1].forEach((m) => glow(m, null));
  await beat(tok, 600);
  say('B 也要符合同一個規則', '先依 row、同 row 再依 column');
  for (let k = 0; k < 8; k++) { tag(String(k), 'idx', 0.4, 0.3, Z(k)); tripleRow(k, B[k], Z(k), colorFor(Math.abs(B[k][2])), 1.2, 1.5); await beat(tok, 350); }
  await beat(tok, 1500);
  say('B 的順序跟 A 不一樣', '(0,0,15)、(0,4,91)、(1,1,11)、(2,1,3)…');
  await beat(tok, 3000);
}
FRAG.push(['arrpeng12-transpose-goal', 'Transpose 後仍要排好序', scTransposeGoal]);

// ── 最笨的 transpose：照 A 的順序換 row/col 再放，放錯位置就要往上搬 ──
async function scNaiveTranspose(tok) {
  fresh([0, 9, 9.5], [0, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  tag('A', 'ptr', -4.6, 0.3, -4.3); tag('B（一筆一筆放）', 'ptr alt', 2.4, 0.3, -4.3);
  const ra = SM.map((t, k) => tripleRow(k, t, Z(k), colorFor(Math.abs(t[2])), -5.6));
  say('最直覺：照 A 的順序，row、col 對調', '一行一行來');
  await beat(tok, 2200);
  const b = []; // [triple, meshes]
  let moves = 0;
  for (let k = 0; k < 8; k++) {
    const t = [SM[k][1], SM[k][0], SM[k][2]];
    ra[k].forEach((m) => glow(m, GOLD));
    // where it belongs
    let pos = b.length;
    while (pos > 0 && (b[pos - 1][0][0] > t[0] || (b[pos - 1][0][0] === t[0] && b[pos - 1][0][1] > t[1]))) pos--;
    const ms = tripleRow(b.length, t, Z(b.length), colorFor(Math.abs(t[2])), 1.2, 1.5);
    say('(' + SM[k].join(', ') + ') → (' + t.join(', ') + ')', pos === b.length ? '放在最後：順序 OK' : '');
    await beat(tok, 1200);
    if (pos < b.length) {
      ms.forEach((m) => glow(m, RED));
      say('放在最後不對：row ' + t[0] + ' 要排在前面', '<span class="no">要往上搬到第 ' + pos + ' 格</span>');
      await beat(tok, 1500);
      for (let j = b.length - 1; j >= pos; j--) { b[j][1].forEach((m, q) => move(m, 1.2 + q * 1.15, 0.3, Z(j + 1))); moves++; }
      ms.forEach((m, q) => move(m, 1.2 + q * 1.15, 0.3, Z(pos)));
      await beat(tok, 1100);
      ms.forEach((m) => glow(m, null));
    }
    b.splice(pos, 0, [t, ms]);
    ra[k].forEach((m) => glow(m, null));
    await beat(tok, 400);
  }
  say('結果對了，但一直在搬位置', '共搬了 ' + moves + ' 次：調整太頻繁');
  await beat(tok, 2600);
  say('有沒有更聰明的方法？下次講', '補充：依 column 掃 A → O(cols·terms)；FastTranspose → O(cols + terms)');
  await beat(tok, 3200);
}
FRAG.push(['arrpeng12-naive-transpose', '最笨的 transpose：放錯就要搬', scNaiveTranspose]);
  }

  // ═══ arrpeng34.js ═══
  {
// ─── cgaPEsMJkSc（彭文志 Lec05 Arrays 3/4）＋ 5HBMYNYYGZU（Lec06 Arrays 4/4）───
// Sparse matrix（三元組、transpose、fast transpose）、row/column major、字串、暴力比對、KMP；
// 以及 C++ template、Stack / Queue 的 ADT 與陣列實作。
const SA = [[0, 0, 15], [0, 3, 22], [0, 5, -15], [1, 1, 11], [1, 2, 3], [2, 3, -6], [4, 0, 91], [5, 2, 28]];
const SB = [[0, 0, 15], [0, 4, 91], [1, 1, 11], [2, 1, 3], [2, 5, 28], [3, 0, 22], [3, 2, -6], [5, 0, -15]];
const TRC = ['#4b9ee2', '#9b7ef4', '#2fc092'];
const RZ = (i) => -3.3 + i * 0.95;
const tstr = (t) => '(' + t.join(', ') + ')';
function trip(t, x, z, dropH = 0) {
  const g = new THREE.Group();
  t.forEach((v, k) => { const m = lab.box(TRC[k], [0.8, 0.4, 0.8]); m.position.x = (k - 1) * 0.95; m.add(lab.label(String(v), 'val')); g.add(m); });
  g.userData.cells = g.children.slice(); g.userData.t = t;
  if (dropH > 0) { g.position.set(x, 0.2 + dropH, z); lab.dropTo(lab.addBody(g), V3(x, 0.2, z)); }
  else { g.position.set(x, 0.2, z); lab.world.add(g); }
  return g;
}
const glowT = (g, c) => g.userData.cells.forEach((m) => glow(m, c));
function head(x, name, n) {
  ['row', 'col', 'value'].forEach((h, k) => tag(h, 'idx', x + (k - 1) * 0.95, 0.2, RZ(-1)));
  for (let i = 0; i < n; i++) tag(name + '[' + i + ']', 'idx', x - 1.95, 0.2, RZ(i));
}
// 字串列：每個字元一顆方塊
function strRow(s, x0, z, color, dx = 0.8, dropH = 0) {
  return [...s].map((ch, k) => cube(ch, color, [0.64, 0.45, 0.64], x0 + k * dx, 0.23, z, dropH));
}
const KP = 'ababaca', KF = [0, 0, 0, 1, 2, 3, 0, 1]; // 1-based：KF[q] = f(q)

// ── 1. 三元組表示 ──
FRAG.push(['arrpeng34-triple', 'Sparse matrix 的三元組表示', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  const M = {}; SA.forEach(([r, c, v]) => { M[r + ',' + c] = v; });
  const gx = (c) => -6 + c * 0.75, gz = (r) => -2.2 + r * 0.75;
  const nz = {};
  for (let r = 0; r < 6; r++) {
    tag('r' + r, 'idx', -6.75, 0.1, gz(r));
    for (let c = 0; c < 6; c++) {
      if (r === 0) tag('c' + c, 'idx', gx(c), 0.1, gz(-1));
      const v = M[r + ',' + c];
      if (v !== undefined) nz[r + ',' + c] = cube(v, '#2fc092', [0.6, 0.35, 0.6], gx(c), 0.18, gz(r));
      else cube('', GRAY, [0.6, 0.08, 0.6], gx(c), 0.04, gz(r));
    }
  }
  say('6×6 矩陣只有 8 個非零項', '二維陣列存 36 格，其中 28 格是 0');
  await beat(tok, 2800);
  head(3.2, 'a', 8);
  say('只存非零項：位置 (row, col) + 值', '一維陣列，每格一個 (row, col, value)');
  await beat(tok, 1800);
  for (let i = 0; i < 8; i++) {
    const [r, c, v] = SA[i];
    glow(nz[r + ',' + c], GOLD);
    trip(SA[i], 3.2, RZ(i), 4);
    say('第 ' + r + ' 列、第 ' + c + ' 行的 ' + v, 'a[' + i + '] = ' + tstr(SA[i]));
    await beat(tok, 950);
    glow(nz[r + ',' + c], null);
  }
  say('規則：先依 row 排，row 相同再依 col', 'row 0 的三項：col 0 → 3 → 5');
  [0, 1, 2].forEach((r) => { const m = nz['0,' + [0, 3, 5][r]]; glow(m, GOLD); });
  await beat(tok, 2800);
  say('8 個非零項只佔 8 格', '空間只跟非零個數 terms 有關');
  await beat(tok, 2600);
}]);

// ── 2. 轉置後位置會變：A[1] → B[5] ──
FRAG.push(['arrpeng34-transpose-result', 'Transpose 之後 index 會變', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  head(-3.6, 'A', 8); head(3.6, 'B', 8);
  const A = SA.map((t, i) => trip(t, -3.6, RZ(i)));
  say('Transpose：row 變 col、col 變 row', '(row, col, value) → (col, row, value)');
  await beat(tok, 2400);
  const B = SB.map((t, i) => trip(t, 3.6, RZ(i), 3));
  say('B 也要「先 row 後 col」排好', 'B 一樣是 8 格');
  await beat(tok, 2200);
  glowT(A[1], GOLD);
  say('A[1] = (0, 3, 22)：第 0 列第 3 行', '轉置後變成 (3, 0, 22)');
  await beat(tok, 2400);
  [0, 1, 2, 3, 4].forEach((k) => glowT(B[k], GREEN));
  say('row 0、1、2 的項要排在它前面', 'B[0] … B[4] 的 row 都 < 3');
  await beat(tok, 2600);
  [0, 1, 2, 3, 4].forEach((k) => glowT(B[k], null));
  glowT(B[5], GOLD);
  const ar = arrow(V3(-2.1, 0.45, RZ(1)), V3(2.0, 0.45, RZ(5)), 0xc08a1f);
  say('所以 A[1] 轉過去落在 B[5]', 'A1 → B5：index 改變了');
  await beat(tok, 2800);
  kill(ar); glowT(A[1], null); glowT(B[5], null);
  glowT(A[2], GOLD); glowT(B[7], GOLD);
  const ar2 = arrow(V3(-2.1, 0.45, RZ(2)), V3(2.0, 0.45, RZ(7)), 0xc08a1f);
  say('A[2] = (0, 5, −15) → B[7]', '(5, 0, −15) 是 row 5，排最後');
  await beat(tok, 2600);
  kill(ar2);
  say('轉置不只是交換，還得重新排序', '難處：每一項要放到哪個 index？');
  await beat(tok, 2600);
}]);

// ── 3. 最笨的方法：一項一項轉，插到該在的位置（要搬資料）──
FRAG.push(['arrpeng34-naive-move', '最笨的轉置：一項一項插入', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  head(-3.6, 'A', 8); head(3.6, 'B', 8);
  const A = SA.map((t, i) => trip(t, -3.6, RZ(i)));
  const cnt = tag('搬移 0 次', 'ptr alt', 3.6, 0.2, 4.4);
  const list = []; let moves = 0;
  const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
  say('照 A 的順序一項一項轉過去', 'A[i] = (r, c, v) → (c, r, v)');
  await beat(tok, 2000);
  for (let i = 0; i < 8; i++) {
    const [r, c, v] = SA[i]; const t = [c, r, v];
    glowT(A[i], GOLD);
    let pos = list.findIndex((g) => cmp(g.userData.t, t) > 0); if (pos < 0) pos = list.length;
    const shift = list.length - pos;
    if (shift > 0) {
      for (let k = list.length - 1; k >= pos; k--) move(list[k], 3.6, 0.2, RZ(k + 1));
      moves += shift; txt(cnt, '搬移 ' + moves + ' 次');
      say(tstr(t) + ' 要放 B[' + pos + ']：後面往下搬', '這次搬 ' + shift + ' 項');
      await beat(tok, 1300);
    }
    const g = trip(t, 3.6, RZ(pos), 3); g.userData.t = t; list.splice(pos, 0, g);
    if (!shift) say('A[' + i + '] → ' + tstr(t) + ' 直接接在後面', 'B[' + pos + '] = ' + tstr(t));
    await beat(tok, shift ? 900 : 1100);
    glowT(A[i], null);
  }
  say('每插一項就可能搬一大串資料', '最笨的方法：共搬移 ' + moves + ' 次');
  await beat(tok, 2800);
}]);

// ── 4. 課本的簡單 transpose：for c × for i ──
FRAG.push(['arrpeng34-slow-transpose', '簡單 transpose：兩層迴圈', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.6, 0]);
  head(-4.6, 'a', 8); head(4.6, 'b', 8);
  const A = SA.map((t, i) => trip(t, -4.6, RZ(i)));
  const cd = code(['currentb = 0;', 'for (c = 0; c < cols; c++)', '  for (i = 0; i < terms; i++)', '    if (a[i].col == c) {', '      b[currentb].row = c;', '      b[currentb].col = a[i].row;', '      b[currentb].value = a[i].value;', '      currentb++; }'], 0, 5.6, 0.5, -3.8);
  const cur = ghostBox('#c08a1f', 3.0, 0.7, 0.9); cur.visible = false;
  const cl = tag('c = 0', 'ptr', 0, 0.2, 2.6), ck = tag('檢查 0 次', 'ptr alt', 0, 0.2, 3.5);
  say('外圈跑轉置後的 row（= 原本的 col）', 'for c = 0 … cols−1');
  cd.hl(1);
  await beat(tok, 2200);
  let cb = 0, checks = 0;
  for (let c = 0; c < 6; c++) {
    txt(cl, 'c = ' + c); cd.hl(1);
    say('c = ' + c + '：8 項全部檢查一次', '找 a[i].col == ' + c);
    await beat(tok, 500);
    cur.visible = true;
    for (let i = 0; i < 8; i++) {
      cur.position.set(-4.6, 0.25, RZ(i)); checks++; txt(ck, '檢查 ' + checks + ' 次'); cd.hl(3);
      if (SA[i][1] === c) {
        glowT(A[i], GOLD); cd.hl(4);
        trip([c, SA[i][0], SA[i][2]], 4.6, RZ(cb), 3);
        say('a[' + i + '].col == ' + c + '：copy 到 b[' + cb + ']', 'b[' + cb + '] = ' + tstr([c, SA[i][0], SA[i][2]]) + '，currentb++');
        cb++;
        await beat(tok, 950);
        glowT(A[i], null);
      } else await beat(tok, 140);
    }
  }
  cur.visible = false; cd.hl(-1);
  say('跑完：b 已經照 row 排好', '共檢查 ' + checks + ' 次 = cols × terms');
  await beat(tok, 3000);
}]);

// ── 5. 簡單 transpose 的代價 ──
FRAG.push(['arrpeng34-slow-cost', '簡單 transpose 的複雜度', async (tok) => {
  fresh([0, 10, 10], [0, 0.8, 0]);
  tag('sparse：cols × terms', 'ptr', -4.8, 0.2, 2.4);
  const plate = [];
  say('外圈 cols 次 × 內圈 terms 次', 'O(cols · terms) = 6 × 8 = 48 次檢查');
  for (let c = 0; c < 6; c++) {
    for (let i = 0; i < 8; i++) plate.push(cube('', c % 2 ? '#4b9ee2' : '#31aab0', [0.36, 0.2, 0.36], -6.2 + i * 0.45, 0.1, -1.4 + c * 0.45, 2));
    await beat(tok, 380);
  }
  await beat(tok, 1400);
  say('已經轉好的項，下一輪還要再檢查', '內圈每次都完整掃 terms 項 → 浪費');
  for (let i = 0; i < 8; i++) glow(plate[8 + i], GOLD);
  await beat(tok, 2400);
  for (let i = 0; i < 8; i++) glow(plate[8 + i], null);
  tag('二維陣列直接轉：rows × cols', 'ptr', -0.4, 0.2, 2.4);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', '#9b7ef4', [0.32, 0.2, 0.32], -1.5 + c * 0.4, 0.1, -1.4 + r * 0.4, 2);
  say('用二維陣列轉置：O(rows · cols)', '6 × 6 = 36');
  await beat(tok, 2400);
  tag('不 sparse：terms = rows × cols', 'ptr alt', 3.6, 0.2, 2.4);
  say('若矩陣不 sparse：terms = rows × cols', 'O(cols · terms) = O(cols² · rows)');
  for (let h = 0; h < 6; h++) {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', h % 2 ? '#dd8238' : '#e55a9b', [0.3, 0.3, 0.3], 2.6 + c * 0.38, 0.17 + h * 0.36, -1.4 + r * 0.38);
    await beat(tok, 420);
  }
  say('6 × 6 × 6 = 216，比 36 還糟', '問題：每個 c 都要重掃整個 array');
  await beat(tok, 3000);
}]);

// ── 6. Fast transpose 第一步：rowSize / rowStart ──
FRAG.push(['arrpeng34-rowsize', 'Fast transpose：算 rowSize 與 rowStart', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 11, 9.5], [0.4, 0.6, 0]);
  head(-4.6, 'b', 8);
  const B = SB.map((t, i) => trip(t, -4.6, RZ(i)));
  const X = (k) => 0.9 + k * 1.0;
  tag('rowSize', 'ptr', -0.6, 0.2, -1.0); tag('rowStart', 'ptr alt', -0.6, 0.2, 1.8);
  for (let k = 0; k < 6; k++) tag('[' + k + ']', 'idx', X(k), 0.2, -1.9);
  const rs = [0, 0, 0, 0, 0, 0];
  const sz = rs.map((v, k) => cube(0, '#4b9ee2', [0.75, 0.4, 0.75], X(k), 0.2, -1.0));
  const cd = P.code ? code(['for (i = 0; i < cols; i++) rowSize[i] = 0;', 'for (i = 0; i < terms; i++) rowSize[b[i].col]++;', 'rowStart[0] = 0;', 'for (i = 1; i < cols; i++)', '  rowStart[i] = rowStart[i-1] + rowSize[i-1];'], 2.6, 5.4, 0.5, -4.2) : null;
  const hl = (i) => { if (cd) cd.hl(i); };
  hl(0);
  say('把 B 轉回 A：先數轉置後每一列有幾項', 'rowSize[k] = B 裡 col == k 的個數');
  await beat(tok, 2600);
  const cur = ghostBox('#c08a1f', 3.0, 0.7, 0.9);
  for (let i = 0; i < 8; i++) {
    const col = SB[i][1];
    cur.position.set(-4.6, 0.25, RZ(i)); glow(B[i].userData.cells[1], GOLD); hl(1);
    rs[col]++; relabel(sz[col], rs[col]); glow(sz[col], GOLD);
    say('b[' + i + '].col = ' + col, 'rowSize[' + col + ']++ → ' + rs[col]);
    await beat(tok, 950);
    glow(B[i].userData.cells[1], null); glow(sz[col], null);
  }
  cur.visible = false;
  say('掃一次 terms 就數完', 'rowSize = [' + rs.join(', ') + ']，O(terms)');
  await beat(tok, 2200);
  const st = [0]; hl(2);
  const sc = [cube(0, '#dd8238', [0.75, 0.4, 0.75], X(0), 0.2, 1.8, 3)];
  say('第 0 列從 0 開始放', 'rowStart[0] = 0');
  await beat(tok, 1400);
  for (let k = 1; k < 6; k++) {
    st[k] = st[k - 1] + rs[k - 1]; hl(4);
    glow(sc[k - 1], GOLD); glow(sz[k - 1], GOLD);
    sc.push(cube(st[k], '#dd8238', [0.75, 0.4, 0.75], X(k), 0.2, 1.8, 3));
    say('前一列的起點 + 前一列的項數', 'rowStart[' + k + '] = ' + st[k - 1] + ' + ' + rs[k - 1] + ' = ' + st[k]);
    await beat(tok, 1300);
    glow(sc[k - 1], null); glow(sz[k - 1], null);
  }
  hl(-1);
  say('每一列的第一項該放哪裡，全算好了', 'rowStart = [' + st.join(', ') + ']');
  await beat(tok, 3000);
}]);

// ── 7. Fast transpose 第二步：一個迴圈直接放到位 ──
FRAG.push(['arrpeng34-fast-place', 'Fast transpose：照 rowStart 直接放', async (tok) => {
  const only = (ctx.params || {}).only;
  const focus = only !== undefined && only !== null;
  fresh([0, 11, 9.5], [0, 0.6, 0]);
  head(-4.6, 'b', 8);
  const B = SB.map((t, i) => trip(t, -4.6, RZ(i)));
  for (let j = 0; j < 8; j++) { cube('', GRAY, [2.7, 0.06, 0.8], 4.6, 0.03, RZ(j)); tag('a[' + j + ']', 'idx', 2.65, 0.2, RZ(j)); }
  ['row', 'col', 'value'].forEach((h, k) => tag(h, 'idx', 4.6 + (k - 1) * 0.95, 0.2, RZ(-1)));
  const rs = [0, 3, 5, 6, 6, 7];
  const rc = rs.map((v, k) => { tag('rowStart[' + k + ']', 'idx', -1.1, 0.2, RZ(k)); return cube(v, '#dd8238', [0.7, 0.4, 0.7], 0.5, 0.2, RZ(k)); });
  const cd = code(['for (i = 0; i < terms; i++) {', '  j = rowStart[b[i].col]++;', '  a[j].row = b[i].col;  a[j].col = b[i].row;', '  a[j].value = b[i].value; }'], 0, 5.6, 0.5, -4.4);
  const cur = ghostBox('#c08a1f', 3.0, 0.7, 0.9); cur.visible = false;
  say(focus ? '為什麼 rowStart 要 ++？看 col = 0 的三項' : '只要一個 for：每項掃一次就放到位', focus ? 'b[0]、b[5]、b[7] 的 col 都是 0' : 'rowStart = [0, 3, 5, 6, 6, 7]');
  cd.hl(0);
  await beat(tok, 2600);
  for (let i = 0; i < 8; i++) {
    const [r, c, v] = SB[i];
    if (focus && c !== only) continue;
    cur.visible = true; cur.position.set(-4.6, 0.25, RZ(i)); glowT(B[i], GOLD);
    const j = rs[c]; glow(rc[c], GOLD); cd.hl(1);
    say('b[' + i + '].col = ' + c + ' → 看 rowStart[' + c + ']', 'j = rowStart[' + c + '] = ' + j);
    await beat(tok, focus ? 1500 : 800);
    cd.hl(2);
    const g = trip([c, r, v], 4.6, RZ(j), 3); glowT(g, GREEN);
    rs[c]++; relabel(rc[c], rs[c]);
    say('放進 a[' + j + ']，rowStart[' + c + ']++', 'a[' + j + '] = ' + tstr([c, r, v]) + '，rowStart[' + c + '] = ' + rs[c]);
    await beat(tok, focus ? 1700 : 800);
    glowT(B[i], null); glowT(g, null); glow(rc[c], null);
  }
  cur.visible = false; cd.hl(-1);
  if (focus) {
    say('不 ++ 的話三項都會塞進同一格', 'rowStart 會變；rowSize 不會變');
    await beat(tok, 3200);
  } else {
    say('每項只看一次：O(cols + terms)', '不 sparse 時最壞 O(rows · cols)');
    await beat(tok, 3200);
  }
}]);

// ── 8. 矩陣相乘 ──
FRAG.push(['arrpeng34-matmul', '矩陣相乘 R = A × B', async (tok) => {
  fresh([0, 9, 7.5], [0, 0, 0.2]);
  const a = [], b = [], r = [];
  for (let i = 0; i < 2; i++) { a.push([]); for (let k = 0; k < 3; k++) a[i].push(cube('a' + i + k, '#4b9ee2', [0.75, 0.35, 0.75], -5.2 + k * 0.9, 0.18, -0.45 + i * 0.9)); }
  for (let k = 0; k < 3; k++) { b.push([]); for (let j = 0; j < 2; j++) b[k].push(cube('b' + k + j, '#9b7ef4', [0.75, 0.35, 0.75], -0.9 + j * 0.9, 0.18, -0.9 + k * 0.9)); }
  for (let i = 0; i < 2; i++) { r.push([]); for (let j = 0; j < 2; j++) r[i].push(cube('', GRAY, [0.75, 0.1, 0.75], 3.2 + j * 0.9, 0.05, -0.45 + i * 0.9)); }
  tag('A：m × n', 'ptr', -4.3, 0.2, -1.6); tag('B：n × p', 'ptr', -0.45, 0.2, -2.1); tag('R：m × p', 'ptr alt', 3.65, 0.2, -1.6);
  say('A 是 m×n，B 是 n×p → R 是 m×p', '這裡 m = 2、n = 3、p = 2');
  await beat(tok, 2600);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    for (let k = 0; k < 3; k++) {
      glow(a[i][k], GOLD); glow(b[k][j], GOLD);
      say('R[' + i + '][' + j + '] 加上 a[' + i + '][' + k + ']·b[' + k + '][' + j + ']', 'k = ' + k + '（k 從 0 跑到 n−1）');
      await beat(tok, 520);
      glow(a[i][k], null); glow(b[k][j], null);
    }
    kill(r[i][j]); r[i][j] = cube('R' + i + j, '#2fc092', [0.75, 0.35, 0.75], 3.2 + j * 0.9, 0.18, -0.45 + i * 0.9, 2);
    await beat(tok, 500);
  }
  say('每一格都是一個 for k 的累加', 'R[i][j] = Σ_{k=0}^{n−1} a[i][k] · b[k][j]');
  await beat(tok, 3000);
}]);

// ── 9. Row major / Column major ──
FRAG.push(['arrpeng34-rowmajor', 'Row major 與 Column major', async (tok) => {
  fresh([0, 10, 9], [0, 0, 0.3]);
  const LX = (k) => -5.5 + k;
  const addr = []; for (let k = 0; k < 12; k++) addr.push(tag('α+' + k, 'idx', LX(k), 0.2, -4.1));
  const one = []; for (let k = 0; k < 12; k++) one.push(cube('a[' + k + ']', '#31aab0', [0.85, 0.4, 0.85], LX(k), 0.2, -3.3, 2));
  say('一維陣列：連續的記憶體', 'a[i] 的位址 = α + i');
  await beat(tok, 2600);
  one.forEach((m) => fly(m));
  const U1 = 3, U2 = 4, G = [];
  for (let i = 0; i < U1; i++) { G.push([]); for (let j = 0; j < U2; j++) G[i].push(cube(i + ',' + j, colorFor(i * U2 + j), [0.85, 0.4, 0.85], -1.5 + j * 1.0, 0.2, 0.6 + i * 1.0, 2)); }
  tag('a[u1][u2]，u1 = 3、u2 = 4', 'ptr', 0, 0.2, 3.8);
  say('二維陣列也要攤平成一列', '兩種放法：row major / column major');
  await beat(tok, 2400);
  say('Row major：一列放完再放下一列', '第 i 列前面已經有 i · u2 個');
  for (let i = 0; i < U1; i++) { for (let j = 0; j < U2; j++) move(G[i][j], LX(i * U2 + j), 0.2, -3.3); await beat(tok, 900); }
  glow(G[1][2], GOLD);
  say('a[1][2] 在 α + 1·4 + 2', 'row major：a[i][j] = α + i·u2 + j');
  await beat(tok, 2800);
  glow(G[1][2], null);
  say('Column major：一行放完再放下一行', '第 j 行前面已經有 j · u1 個');
  for (let j = 0; j < U2; j++) { for (let i = 0; i < U1; i++) move(G[i][j], LX(j * U1 + i), 0.2, -3.3); await beat(tok, 900); }
  glow(G[1][2], GOLD);
  say('同一個 a[1][2] 變成 α + 2·3 + 1', 'column major：a[i][j] = α + j·u1 + i');
  await beat(tok, 2800);
  say('存法不同，算出的位址就不同', 'n 維陣列照同樣道理推公式');
  await beat(tok, 2600);
}]);

// ── 10. 字串 = char 陣列；中文斷詞 ──
FRAG.push(['arrpeng34-string', '字串：char 陣列', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.3]);
  const s = [...'hello world', '\\0'];
  const cs = s.map((ch, k) => { tag('[' + k + ']', 'idx', -5.5 + k, 0.2, -2.5); return cube(ch === ' ' ? '␠' : ch, ch === '\\0' ? '#dd8238' : '#4b9ee2', [0.8, 0.4, 0.8], -5.5 + k, 0.2, -1.7, 3); });
  say('字串 = char 陣列', 's[0] = \'h\'、s[1] = \'e\' …');
  await beat(tok, 2400);
  glow(cs[11], GOLD);
  say('最後放一個結束字元', '\'\\0\' 表示字串到這裡為止');
  await beat(tok, 2200);
  glow(cs[11], null); glow(cs[5], GOLD);
  say('英文以單字為單位，中間有空白', 'hello ␠ world → 兩個 word');
  await beat(tok, 2400);
  glow(cs[5], null);
  const zh = [...'我是彭文志老師'].map((ch, k) => cube(ch, '#9b7ef4', [0.8, 0.4, 0.8], -3 + k, 0.2, 1.5, 3));
  say('中文沒有空白：哪幾個字是一個詞？', '我是彭文志老師');
  await beat(tok, 2600);
  const grp = [[0], [1], [2, 3, 4], [5, 6]]; let x = -4.2;
  grp.forEach((g) => { g.forEach((k) => { move(zh[k], x, 0.2, 1.5); x += 1; }); x += 0.9; });
  say('斷詞：我 / 是 / 彭文志 / 老師', '中文要先斷詞 → 資訊檢索（IR）');
  await beat(tok, 3000);
}]);

// ── 11. 字串比對問題 ──
FRAG.push(['arrpeng34-match-def', '字串比對問題', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  tag('常用運算：比較、串接（strcat）、複製（strcpy）、插入、比對', 'idx', 0, 0.2, -3.6);
  say('字串常做：比較、串接、copy、insert、比對', '今天的重點：pattern matching');
  await beat(tok, 2600);
  const T = 'ABABABCCA', X = (k) => -3.4 + k * 0.85;
  T.split('').forEach((ch, k) => tag(String(k), 'idx', X(k), 0.2, -2.0));
  const tc = strRow(T, X(0), -1.2, '#4b9ee2', 0.85, 3);
  tag('T', 'ptr', -4.6, 0.2, -1.2);
  say('T = 原本的文字（像一個檔案）', 'T = ABABABCCA');
  await beat(tok, 2200);
  const pc = strRow('ABABC', X(0), 1.6, '#dd8238', 0.85, 3);
  const pl = tag('P', 'ptr alt', -4.6, 0.2, 1.6);
  say('P = 要查的 pattern（像搜尋關鍵字）', 'P = ABABC');
  await beat(tok, 2200);
  say('問：P 有沒有出現在 T 裡？在哪？', '有 → 回傳起始位置；沒有 → 回傳 −1');
  await beat(tok, 2400);
  pc.forEach((m, k) => move(m, X(2 + k), 0.23, 0.0)); pl.position.set(-4.6, 0.2, 0.0);
  await beat(tok, 800);
  pc.forEach((m, k) => { glow(m, GREEN); glow(tc[2 + k], GREEN); });
  say('ABABC 出現在 T 的 index 2', '回傳 2');
  await beat(tok, 3000);
}]);

// ── 12. 暴力比對：shift 其實是改 T 的起點 ──
FRAG.push(['arrpeng34-naive-match', '暴力字串比對', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const T = 'ABABABCCA', P = 'ABABC', X = (k) => -3.4 + k * 0.85;
  T.split('').forEach((ch, k) => tag(String(k), 'idx', X(k), 0.2, -2.0));
  const tc = strRow(T, X(0), -1.2, '#4b9ee2', 0.85);
  const pc = strRow(P, X(0), 0.2, '#dd8238', 0.85);
  tag('T', 'ptr', -4.6, 0.2, -1.2); tag('P', 'ptr alt', -4.6, 0.2, 0.2);
  const sl = tag('s = 0', 'ptr', X(0), 0.2, -2.8);
  say('從 T[0] 開始，一個字一個字比', 'P[k] 跟 T[s + k] 比');
  await beat(tok, 2000);
  let comps = 0;
  for (let s = 0; s <= T.length - P.length; s++) {
    pc.forEach((m, k) => move(m, X(s + k), 0.23, 0.2)); sl.position.set(X(s), 0.2, -2.8); txt(sl, 's = ' + s);
    await beat(tok, 700);
    let ok = true;
    for (let k = 0; k < P.length; k++) {
      comps++;
      const eq = P[k] === T[s + k];
      glow(pc[k], eq ? GREEN : RED); glow(tc[s + k], eq ? GREEN : RED);
      say(eq ? P[k] + ' = ' + T[s + k] + '，繼續' : P[k] + ' ≠ ' + T[s + k] + '：不 match', 's = ' + s + '，比 P[' + k + '] 和 T[' + (s + k) + ']');
      await beat(tok, eq ? 550 : 1200);
      if (!eq) { ok = false; break; }
    }
    pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null));
    if (ok) {
      for (let k = 0; k < P.length; k++) { glow(pc[k], GREEN); glow(tc[s + k], GREEN); }
      say('全部相同：找到了，在 index ' + s, '共比較 ' + comps + ' 次');
      await beat(tok, 2400);
      break;
    }
    say('shift 一格再從頭比', 's = ' + (s + 1));
    await beat(tok, 700);
  }
  say('P 其實沒動：改的是 T 的起始位置 s', '變數 s 記住「從 T 的哪裡開始比」');
  await beat(tok, 2600);
  say('|P| = m、|T| = n：最壞 O(m · n)', '能不能一次 shift 不只一格？→ KMP');
  await beat(tok, 2800);
}]);

// ── 13. KMP：兩個 phase ──
FRAG.push(['arrpeng34-kmp-phases', 'KMP 的兩個 phase', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const X = (k) => -5.6 + k * 0.8;
  tag('Phase 1：P 自己跟自己比 → fail function', 'ptr', -1.8, 0.2, -3.9);
  const pc = strRow(KP, X(0), -3.0, '#dd8238', 0.8, 3);
  say('Phase 1：只看 pattern 自己', 'P = ababaca');
  await beat(tok, 2200);
  const fc = [];
  for (let q = 1; q <= 7; q++) { fc.push(cube(KF[q], '#9b7ef4', [0.64, 0.3, 0.64], X(q - 1), 0.15, -2.1, 2)); await beat(tok, 260); }
  say('找出 P 裡重複的部分 → fail array', 'f = 0 0 1 2 3 0 1，花 O(m)');
  await beat(tok, 2400);
  tag('Phase 2：用 fail 在 T 上比對', 'ptr alt', -2.6, 0.2, -0.2);
  const tc = strRow('bacbabababacaab', X(0), 0.6, '#4b9ee2', 0.8, 3);
  say('Phase 2：拿 fail 去 T 裡比對', 'T 只從左掃到右一次，花 O(n)');
  await beat(tok, 2400);
  for (let k = 6; k < 13; k++) glow(tc[k], GREEN);
  pc.forEach((m) => glow(m, GREEN));
  say('不 match 時照 fail 一次 shift 多格', '比過的就不用再比');
  await beat(tok, 2400);
  const b1 = cube('', '#e55a9b', [1.2, 1, 1.2], -2.5, 0, 3.0); b1.scale.y = 0.001;
  const b2 = cube('', '#2fc092', [1.2, 1, 1.2], 2.5, 0, 3.0); b2.scale.y = 0.001;
  tag('暴力法 m·n = 7·15 = 105', 'idx', -2.5, 0.2, 4.1); tag('KMP m+n = 7+15 = 22', 'idx', 2.5, 0.2, 4.1);
  await anim(tok, 1200, (t) => { b1.scale.y = 0.001 + 4.2 * t; b1.position.y = b1.scale.y / 2; b2.scale.y = 0.001 + 0.9 * t; b2.position.y = b2.scale.y / 2; });
  say('暴力 O(m·n) → KMP O(m + n)', 'm = |P|，n = |T|');
  await beat(tok, 3000);
}]);

// ── 14. KMP 的直覺：比過的資訊拿來跳（示意字串）──
FRAG.push(['arrpeng34-kmp-idea', 'KMP 直覺：對齊比過的區塊', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const P = 'AGCTTAGC', X = (k) => -4.4 + k * 0.8;
  const ex = [['AGCTTATAGCTT', 6, 1], ['AGCTTAGGCTTA', 7, 2]]; // [T, 失敗位置(0-based), 相同區塊長度]
  for (const [T, mis, k] of ex) {
    lab.clear(); arrows.length = 0;
    T.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.9));
    const tc = strRow(T, X(0), -1.1, '#4b9ee2', 0.8);
    const pc = strRow(P, X(0), 0.4, '#dd8238', 0.8);
    tag('T', 'ptr', -5.4, 0.2, -1.1); tag('P', 'ptr alt', -5.4, 0.2, 0.4);
    for (let i = 0; i < mis; i++) { glow(tc[i], GREEN); glow(pc[i], GREEN); }
    glow(tc[mis], RED); glow(pc[mis], RED);
    say('前 ' + mis + ' 個都一樣，第 ' + (mis + 1) + ' 個不 match', 'T[' + (mis + 1) + '] = ' + T[mis] + ' ≠ P[' + (mis + 1) + '] = ' + P[mis]);
    await beat(tok, 2600);
    for (let i = mis - k; i < mis; i++) { tint(tc[i], '#e55a9b'); tint(pc[i], '#e55a9b'); }
    for (let i = 0; i < k; i++) tint(pc[i], '#c08a1f');
    say('失敗點前面的「' + P.slice(mis - k, mis) + '」也是 P 的開頭', '這段比過了，而且一定相同');
    await beat(tok, 2800);
    pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null));
    const s = mis - k;
    pc.forEach((m, i) => move(m, X(s + i), 0.23, 0.4));
    await beat(tok, 900);
    for (let i = 0; i < k; i++) glow(pc[i], GREEN);
    glow(pc[k], GOLD); glow(tc[mis], GOLD);
    say('直接把 P 的開頭對齊那段，一次跳 ' + s + ' 格', '下一個比 P[' + (k + 1) + '] 和 T[' + (mis + 1) + ']');
    await beat(tok, 3000);
  }
  say('KMP：利用比過的資訊，一次 shift 多格', '關鍵是那段「相同區塊」有多長');
  await beat(tok, 2600);
}]);

// ── 15. fail function 定義 ──
FRAG.push(['arrpeng34-fail-def', 'Fail function 的定義', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const X = (k) => -3.6 + k * 1.0; // 1-based 位置 q → X(q-1)
  for (let q = 1; q <= 7; q++) tag('q=' + q, 'idx', X(q - 1), 0.2, -2.3);
  const pc = strRow(KP, X(0), -1.5, '#dd8238', 1.0);
  tag('P', 'ptr', -4.7, 0.2, -1.5);
  say('f(j)：P[1..j] 裡「尾巴 = 開頭」的最長長度', 'f(j) = 最大的 k < j，使 P[1..k] = P[j−k+1..j]');
  await beat(tok, 3200);
  const j = 5;
  glow(pc[j - 1], GOLD);
  const jl = tag('j = 5', 'ptr alt', X(j - 1), 0.2, -3.1);
  say('以 j = 5 為例：P[1..5] = ababa', '從 j 往左看 k 個，跟開頭 k 個比');
  await beat(tok, 2600);
  let cp = null;
  for (const k of [4, 3]) {
    if (cp) cp.forEach(kill);
    cp = strRow(KP.slice(0, k), X(j - k), 0.0, '#9b7ef4', 1.0, 2);
    await beat(tok, 700);
    let ok = true;
    for (let i = 0; i < k; i++) { const eq = KP[i] === KP[j - k + i]; if (!eq) ok = false; glow(cp[i], eq ? GREEN : RED); }
    for (let i = j - k; i < j; i++) tint(pc[i], ok ? '#e55a9b' : '#dd8238');
    say(ok ? 'k = 3：aba = aba，成立' : 'k = 4：abab ≠ baba，不行', ok ? 'P[1..3] = P[3..5]' : 'P[1..4] ≠ P[2..5]');
    await beat(tok, 2600);
  }
  glow(pc[2], GOLD);
  say('中間的 a 被兩段共用：可以 overlap', '只要 k < j 就好');
  await beat(tok, 2600);
  say('所以 f(5) = 3', '取最長的 k');
  await beat(tok, 2600);
}]);

// ── 16. 算 ababaca 的 fail function ──
FRAG.push(['arrpeng34-fail-calc', '算出 fail = 0012301', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const X = (k) => -3.6 + k * 1.0;
  for (let q = 1; q <= 7; q++) tag('q=' + q, 'idx', X(q - 1), 0.2, -2.2);
  const pc = strRow(KP, X(0), -1.4, '#dd8238', 1.0);
  tag('P', 'ptr', -4.7, 0.2, -1.4); tag('f', 'ptr alt', -4.7, 0.2, 0.4);
  for (let q = 1; q <= 7; q++) cube('', GRAY, [0.7, 0.06, 0.7], X(q - 1), 0.03, 0.4);
  say('P = ababaca：每個位置往前看', '尾巴最長能跟開頭一樣多長？');
  await beat(tok, 2400);
  const why = ['只有一個字，沒得比', 'ab：b ≠ a', 'aba：尾 a = 頭 a', 'abab：尾 ab = 頭 ab', 'ababa：尾 aba = 頭 aba（重疊）', 'ababac：c 開頭的都對不上', 'ababaca：尾 a = 頭 a'];
  for (let q = 1; q <= 7; q++) {
    const k = KF[q];
    glow(pc[q - 1], GOLD);
    for (let i = 0; i < k; i++) tint(pc[i], '#c08a1f');
    for (let i = q - k; i < q; i++) tint(pc[i], '#e55a9b');
    cube(k, k ? '#9b7ef4' : '#b9a582', [0.7, 0.4, 0.7], X(q - 1), 0.2, 0.4, 2.5);
    say(why[q - 1], 'f(' + q + ') = ' + k);
    await beat(tok, q === 5 ? 2400 : 1700);
    pc.forEach((m) => { tint(m, '#dd8238'); glow(m, null); });
  }
  say('fail function = 0 0 1 2 3 0 1', 'pattern 自己跟自己比出來的 array');
  await beat(tok, 3000);
}]);

// ── 17. 失敗時怎麼移：比 P[f(j−1)+1] ──
FRAG.push(['arrpeng34-kmp-shift-rule', '失敗時從 P[f(j−1)+1] 接著比', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const T = 'bacbabababacaab', X = (k) => -5.6 + k * 0.8; // T 的 1-based 位置 i → X(i-1)
  T.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.9));
  const tc = strRow(T, X(0), -1.1, '#4b9ee2', 0.8);
  let s = 4;
  const pc = strRow(KP, X(s), 0.4, '#dd8238', 0.8);
  tag('T', 'ptr', -6.5, 0.2, -1.1); tag('P', 'ptr alt', -6.5, 0.2, 0.4);
  for (let i = 0; i < 5; i++) { glow(pc[i], GREEN); glow(tc[s + i], GREEN); }
  glow(pc[5], RED); glow(tc[9], RED);
  const il = tag('i = 10', 'ptr', X(9), 0.2, -2.7), jl = tag('j = 6', 'ptr alt', X(s + 5), 0.2, 1.3);
  say('在 T 的 i、P 的 j 失敗：x ≠ y', 'T[10] = b ≠ P[6] = c');
  await beat(tok, 2800);
  say('前面 j − 1 = 5 個都已經 match', 'P[1..5] = T[5..9] = ababa');
  await beat(tok, 2400);
  for (let i = 2; i < 5; i++) { tint(pc[i], '#e55a9b'); tint(tc[s + i], '#e55a9b'); }
  say('查 f(j−1) = f(5) = 3', '紅色區塊長 3：aba');
  await beat(tok, 2600);
  pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null));
  s = 6;
  pc.forEach((m, i) => { move(m, X(s + i), 0.23, 0.4); tint(m, i < 3 ? '#e55a9b' : '#dd8238'); });
  jl.position.set(X(s + 3), 0.2, 1.3); txt(jl, 'P[4]');
  await beat(tok, 1000);
  glow(pc[3], GOLD); glow(tc[9], GOLD);
  say('紅色區塊不用再比，T 的 i 不回頭', '下一個比 P[f(j−1)+1] = P[4] 和 T[i]');
  await beat(tok, 3000);
  say('i 只往前走 → Phase 2 是 O(n)', 'j ← f(j−1) + 1');
  await beat(tok, 2600);
}]);

// ── 18. KMP 完整 trace（T = bacbabababacaab, P = ababaca）──
FRAG.push(['arrpeng34-kmp-trace', 'KMP 完整走一遍', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.2]);
  const T = 'bacbabababacaab', n = T.length, m = KP.length, X = (k) => -5.6 + k * 0.8;
  T.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.8));
  const tc = strRow(T, X(0), -1.0, '#4b9ee2', 0.8);
  const pc = strRow(KP, X(0), 0.4, '#dd8238', 0.8);
  tag('T', 'ptr', -6.5, 0.2, -1.0); tag('P', 'ptr alt', -6.5, 0.2, 0.4);
  tag('f = 0 0 1 2 3 0 1', 'ptr', -3.6, 0.2, -3.2);
  const il = tag('i = 1', 'ptr', X(0), 0.2, -2.5);
  say('Phase 1 已算好 f；開始比對', 'T = bacbabababacaab，P = ababaca');
  await beat(tok, 2600);
  const place = (s) => pc.forEach((mm, k) => move(mm, X(s + k), 0.23, 0.4));
  const clearG = () => { pc.forEach((mm) => glow(mm, null)); tc.forEach((mm) => glow(mm, null)); };
  let q = 0, found = -1;
  for (let i = 1; i <= n && found < 0; i++) {
    il.position.set(X(i - 1), 0.2, -2.5); txt(il, 'i = ' + i);
    for (;;) {
      place(i - q - 1);
      for (let k = 0; k < q; k++) { glow(pc[k], GREEN); glow(tc[i - q - 1 + k], GREEN); }
      const eq = KP[q] === T[i - 1];
      glow(pc[q], eq ? GREEN : RED); glow(tc[i - 1], eq ? GREEN : RED);
      if (eq) { say('T[' + i + '] = P[' + (q + 1) + '] = ' + T[i - 1], '已 match ' + (q + 1) + ' 個'); q++; await beat(tok, 650); break; }
      if (q === 0) { say('T[' + i + '] = ' + T[i - 1] + ' ≠ P[1]：只能移一格', 'f 幫不上忙，i 往前'); await beat(tok, 1100); break; }
      say('T[' + i + '] = ' + T[i - 1] + ' ≠ P[' + (q + 1) + '] = ' + KP[q] + '：看 f(' + q + ') = ' + KF[q], '下一個比 P[' + (KF[q] + 1) + ']，T 的 i 不動');
      await beat(tok, 2600);
      clearG(); q = KF[q];
      await beat(tok, 500);
    }
    if (q === m) found = i - m + 1;
    else if (q === 0) clearG();
  }
  for (let k = 0; k < m; k++) { glow(pc[k], GREEN); glow(tc[found - 1 + k], GREEN); }
  say('全部 match：P 出現在 T 的第 ' + found + ' 個位置', 'ababaca = T[7..13]');
  await beat(tok, 3200);
}]);

// ═════════ 5HBMYNYYGZU：template、Stack、Queue ═════════

// ── 19. C++ template ──
FRAG.push(['arrpeng34-template', 'C++ template：同一份 sort', async (tok) => {
  fresh([0, 8, 10], [0, 1.6, 0]);
  const cd = code(['template <class KeyType>', 'void sort(KeyType *a, int n)', '{ … 比較 a[i]、交換 … }', '', 'float farray[100];', 'int intarray[200];', 'sort(farray, 100);', 'sort(intarray, 200);'], -3.2, 5.4, 0.52, -1.5);
  cd.hl(0);
  say('KeyType 是一個「待定」的型態', 'template <class KeyType>');
  await beat(tok, 2600);
  cd.hl(1);
  say('sort 裡完全沒寫 int 還是 float', '只寫 KeyType *a');
  await beat(tok, 2400);
  const box = ghostBox('#c08a1f', 2.2, 1.2, 1.4); box.position.set(2.5, 0.6, 0);
  tag('sort<KeyType>', 'ptr alt', 2.5, 1.6, 0);
  const fv = [3.5, 1.2, 2.7, 0.4], iv = [7, 2, 9, 4];
  cd.hl(4);
  const fc = fv.map((v, k) => cube(v, '#4b9ee2', [0.75, 0.4, 0.75], 0.6 + k * 0.85, 0.2, -2.4, 2));
  tag('float', 'idx', -0.5, 0.2, -2.4);
  say('真正宣告時才決定型態', 'farray：KeyType = float');
  await beat(tok, 2000);
  cd.hl(6);
  [...fv].sort((a, b) => a - b).forEach((v, k) => { const m = fc[fv.indexOf(v)]; move(m, 0.6 + k * 0.85, 0.2, -2.4); });
  say('套進同一份 sort', 'sort(farray, 100)');
  await beat(tok, 1800);
  cd.hl(5);
  const ic = iv.map((v, k) => cube(v, '#9b7ef4', [0.75, 0.4, 0.75], 0.6 + k * 0.85, 0.2, 2.4, 2));
  tag('int', 'idx', -0.5, 0.2, 2.4);
  say('intarray：KeyType = int', 'int intarray[200]');
  await beat(tok, 1800);
  cd.hl(7);
  [...iv].sort((a, b) => a - b).forEach((v, k) => { const m = ic[iv.indexOf(v)]; move(m, 0.6 + k * 0.85, 0.2, 2.4); });
  say('一樣的程式，型態不同照樣能用', 'sort(intarray, 200)');
  await beat(tok, 2200);
  cd.hl(-1);
  say('課本後面章節的資料型態都寫 KeyType', '寫一次，套用到各種型態');
  await beat(tok, 2600);
}]);

// ── 20. Stack：A~E 進、E 先出 ──
FRAG.push(['arrpeng34-stack-abcde', 'Stack：A B C D E 進，E 先出', async (tok) => {
  fresh([6, 6.5, 12], [0, 2.6, 0]);
  const Y = (i) => 0.45 + i * 0.95;
  for (let i = 0; i < 5; i++) { const g = ghostBox('#c9b48e', 1.7, 0.9, 1.7); g.position.set(0, Y(i), 0); }
  const top = tag('top', 'ptr', 2.2, 0.2, 0);
  const st = [];
  say('Stack：只能從最上面放、最上面拿', 'Last In First Out（LIFO）');
  await beat(tok, 2200);
  for (const ch of 'ABCDE') {
    st.push(cube(ch, colorFor(st.length), [1.6, 0.85, 1.6], 0, Y(st.length), 0, 5));
    top.position.set(2.2, Y(st.length - 1), 0);
    say('push ' + ch + '：top 往上移', 'top 永遠指向最上面那個');
    await beat(tok, 1100);
  }
  await beat(tok, 800);
  glow(st[4], GOLD);
  say('pop：拿 top 指的那個 → E', 'E 最後進來，卻最先出去');
  await beat(tok, 1800);
  fly(st.pop(), V3(5, 9, 2));
  top.position.set(2.2, Y(st.length - 1), 0);
  say('拿完 top 減 1，指向 D', 'top − 1');
  await beat(tok, 2600);
}]);

// ── 21. Stack 的應用：function call ──
FRAG.push(['arrpeng34-callstack', 'Stack 的應用：function call', async (tok) => {
  fresh([6, 6, 12], [0, 2.2, 0]);
  const Y = (i) => 0.55 + i * 1.15;
  const top = tag('top', 'ptr', 3.0, 0.2, 0);
  say('main 開始執行', 'system stack 放 main 的資料');
  const f0 = cube('main：local 變數', '#4b9ee2', [3.6, 1.0, 1.8], 0, Y(0), 0, 5);
  top.position.set(3.0, Y(0), 0);
  await beat(tok, 2200);
  say('main 呼叫 A1：先把資料存起來', 'local 變數、return address、pointer');
  const f1 = cube('A1：local 變數 + return address', '#dd8238', [3.6, 1.0, 1.8], 0, Y(1), 0, 5);
  top.position.set(3.0, Y(1), 0);
  await beat(tok, 2800);
  glow(f1, GOLD);
  say('A1 跑完：pop 出來，照 return address 回去', '最後呼叫的最先結束');
  await beat(tok, 2400);
  fly(f1, V3(4, 8, 2));
  top.position.set(3.0, Y(0), 0);
  glow(f0, GOLD);
  say('回到 main 繼續執行', 'LIFO 剛好符合呼叫順序');
  await beat(tok, 2400);
  glow(f0, null);
  say('迷宮老鼠也會用到 Stack', 'try and error：走不通就退回上一步');
  await beat(tok, 2600);
}]);

// ── 22. Stack ADT ──
FRAG.push(['arrpeng34-stack-adt', 'Stack 的 ADT', async (tok) => {
  fresh([2, 7, 12], [0, 2.4, 0]);
  const cd = code(['Stack ADT：a finite ordered list', 'Stack(MaxStackSize = DefaultSize)', 'Boolean IsFull()', 'void Add(const KeyType& item)  // push', 'Boolean IsEmpty()', 'KeyType* Delete(KeyType&)       // pop'], -3.4, 5.4, 0.55, -1);
  const Y = (i) => 0.45 + i * 0.95;
  for (let i = 0; i < 4; i++) { const g = ghostBox('#c9b48e', 1.6, 0.9, 1.6); g.position.set(3.6, Y(i), 0); tag('[' + i + ']', 'idx', 2.3, Y(i), 0); }
  tag('MaxStackSize = 4', 'ptr', 3.6, 4.3, 0);
  cd.hl(0);
  say('finite：Stack 的大小是有限的', '0 個或多個元素的有序串列');
  await beat(tok, 2800);
  cd.hl(1);
  say('建構時給最大容量', 'MaxStackSize = DefaultSize');
  await beat(tok, 2200);
  const st = [];
  cd.hl(3);
  for (const ch of 'ABCD') { st.push(cube(ch, colorFor(st.length), [1.5, 0.85, 1.5], 3.6, Y(st.length), 0, 4)); say('Add = push ' + ch, '元素個數 ' + st.length + ' / 4'); await beat(tok, 800); }
  cd.hl(2);
  say('有限就會滿 → 要有 IsFull', 'IsFull() = true，不能再 push');
  await beat(tok, 2400);
  cd.hl(5);
  while (st.length) { fly(st.pop(), V3(5, 8, 2)); say('Delete = pop', '剩 ' + st.length + ' 個'); await beat(tok, 700); }
  cd.hl(4);
  say('空了再拿也拿不到 → 要有 IsEmpty', 'IsEmpty() = true');
  await beat(tok, 2600);
  cd.hl(-1);
}]);

// ── 23. 用陣列實作 Stack ──
FRAG.push(['arrpeng34-stack-array', '用陣列實作 Stack', async (tok) => {
  fresh([2, 7, 12.5], [0, 2.4, 0]);
  const cd = code(['Stack(int MaxSize) : MaxStackSize(MaxSize)', '{ stack = new KeyType[MaxStackSize]; top = -1; }', 'void Add(const KeyType& x)', '{ if (IsFull()) StackFull(); else stack[++top] = x; }', 'KeyType* Delete(KeyType& x)', '{ if (IsEmpty()) { StackEmpty(); return 0; }', '  x = stack[top--]; return &x; }'], -2.6, 5.6, 0.55, -1.2);
  const Y = (i) => 0.45 + i * 0.95;
  for (let i = 0; i < 4; i++) { const g = ghostBox('#c9b48e', 1.6, 0.9, 1.6); g.position.set(4.2, Y(i), 0); tag('stack[' + i + ']', 'idx', 2.6, Y(i), 0); }
  const top = tag('top = -1', 'ptr', 4.2, 0.2, 1.6);
  cd.hl(0);
  say('冒號後面：初始化 MaxStackSize', 'Stack::Stack 的 :: 表示 member function');
  await beat(tok, 2800);
  cd.hl(1);
  say('開陣列，top = −1 表示空', 'IsEmpty：top == −1');
  await beat(tok, 2400);
  const st = []; cd.hl(3);
  for (const ch of 'AB') {
    const t = st.length;
    say('Add(' + ch + ')：沒滿 → ++top 再放', 'top: ' + (t - 1) + ' → ' + t + '，stack[' + t + '] = ' + ch);
    st.push(cube(ch, colorFor(t), [1.5, 0.85, 1.5], 4.2, Y(t), 0, 4));
    txt(top, 'top = ' + t); top.position.set(4.2, Y(t) + 0.8, 1.6);
    await beat(tok, 2000);
  }
  cd.hl(6);
  glow(st[1], GOLD);
  say('Delete：先回傳 stack[top]，再 top−−', 'x = stack[1] = B，top → 0');
  await beat(tok, 2000);
  fly(st.pop(), V3(5, 8, 2)); txt(top, 'top = 0'); top.position.set(4.2, Y(0) + 0.8, 1.6);
  await beat(tok, 1400);
  cd.hl(3);
  say('IsFull：top == MaxStackSize − 1', 'push 前先檢查滿、pop 前先檢查空');
  await beat(tok, 2800);
  cd.hl(-1);
}]);

// ── 24. Queue：front / rear ──
FRAG.push(['arrpeng34-queue-abcd', 'Queue：A 先進先出', async (tok) => {
  fresh([0, 8, 11], [0, 0.5, 0]);
  const X = (i) => -3.6 + i * 1.8;
  for (let i = 0; i < 5; i++) cube('', GRAY, [1.6, 0.06, 1.6], X(i), 0.03, 0);
  const fl = tag('front', 'ptr', X(0), 0.2, 1.6), rl = tag('rear', 'ptr alt', X(0), 1.6, 0);
  showL(fl, false); showL(rl, false);
  say('Queue：First In First Out', '兩個變數：front 和 rear');
  await beat(tok, 2200);
  const q = [];
  for (const ch of 'ABCD') {
    q.push(cube(ch, colorFor(q.length), [1.5, 0.85, 1.5], X(q.length), 0.45, 0, 5));
    showL(fl, true); showL(rl, true);
    rl.position.set(X(q.length - 1), 1.6, 0);
    say('加入 ' + ch + '：rear 指向尾巴', 'front → A，rear → ' + ch);
    await beat(tok, 1100);
  }
  await beat(tok, 800);
  glow(q[0], GOLD);
  say('取出：front 指的那個 → A', '最早進來的最先出去');
  await beat(tok, 1800);
  fly(q.shift(), V3(-5, 8, 3));
  fl.position.set(X(1), 0.2, 1.6);
  say('front 改指向 B，人數少一個', 'front → B，rear → D');
  await beat(tok, 2600);
}]);

// ── 25. Queue 的應用：job scheduling → priority queue ──
FRAG.push(['arrpeng34-jobq', 'Job scheduling 與 priority queue', async (tok) => {
  fresh([0, 8, 11], [0, 0.6, 0]);
  const cpu = cube('CPU', '#5c7a4a', [1.8, 1.2, 1.8], 5, 0.6, 0);
  const X = (i) => 2.6 - i * 1.7;
  const js = ['J1', 'J2', 'J3'].map((j, i) => cube(j, colorFor(i + 1), [1.3, 0.8, 1.3], X(i), 0.4, 0, 4));
  say('多個 job 等 CPU：誰先來誰先做', 'FIFO 的 job scheduling');
  await beat(tok, 2400);
  for (let k = 0; k < 3; k++) {
    const m = js.shift(); glow(m, GOLD);
    move(m, 5, 1.6, 0);
    js.forEach((o, i) => move(o, X(i), 0.4, 0));
    say('J' + (k + 1) + ' 先進來，先被服務', '先開 Word、PowerPoint、PDF 的順序');
    await beat(tok, 1300);
    fly(m, V3(3, 8, 2));
    await beat(tok, 300);
  }
  kill(cpu);
  const shop = cube('可麗餅', '#c08a1f', [1.8, 1.2, 1.8], 5, 0.6, 0);
  const ppl = [['甲：買 50 個', 1], ['乙：10 分鐘後上課', 3], ['丙：10 分鐘後上課', 3]].map(([t, p], i) => {
    return cube(t, colorFor(i + 4), [1.5, 0.8, 1.3], X(i), 0.4, 0, 4);
  });
  say('但 FIFO 不一定好：甲一次買 50 個', '後面的人可能等不到');
  await beat(tok, 2800);
  move(ppl[0], X(2), 0.4, -1.8); move(ppl[1], X(0), 0.4, 0); move(ppl[2], X(1), 0.4, 0);
  glow(ppl[1], GOLD); glow(ppl[2], GOLD);
  say('依 priority 決定誰先：快上課的先', 'priority queue（後面章節）');
  await beat(tok, 3000);
  kill(shop);
}]);

// ── 26. Queue ADT 跟 Stack ADT 很像 ──
FRAG.push(['arrpeng34-queue-adt', 'Queue ADT 與 Stack ADT', async (tok) => {
  fresh([0, 6, 12], [0, 2.6, 0]);
  const s = code(['Stack', 'IsFull()', 'Add(item)    // push', 'IsEmpty()', 'Delete()     // pop', 'top'], -3.6, 5.2, 0.6, 0);
  const q = code(['Queue', 'IsFull()', 'Add(item)    // 從 rear 進', 'IsEmpty()', 'Delete()     // 從 front 出', 'front、rear'], 2.8, 5.2, 0.6, 0);
  say('兩個看起來都像一個容器', '差別在進出的規則');
  await beat(tok, 2400);
  for (let i = 1; i <= 4; i++) { s.hl(i); q.hl(i); say('兩邊都有 ' + ['', 'IsFull', 'Add', 'IsEmpty', 'Delete'][i], '成員函式幾乎一樣'); await beat(tok, 1300); }
  s.hl(5); q.hl(5);
  say('Queue 多一個變數：front + rear', 'Stack 只要一個 top');
  await beat(tok, 2800);
  s.hl(-1); q.hl(-1);
  say('Stack：LIFO；Queue：FIFO', '實作細節請自己看課本');
  await beat(tok, 2600);
}]);
  }

  // ═══ bariarr.js ═══
  {
// ═══ Abdul Bari：陣列位址、指標（MJZd6uPi88E、868qXWoGS9E、uMGwjNuidZU、OqLt2GfX6jg） ═══
const P = () => (ctx.params || {});
const BLUE = '#4b9ee2', TEAL = '#2fc092', ORANGE = '#dd8238', SKIP = '#cfc6b6';
const ROWC = [BLUE, TEAL, ORANGE];

// 一排記憶體格（地上）：回傳每格的 x、底座、位址標籤、索引標籤
function memRow(n, x0, dx, z, addr0, opts = {}) {
  const step = opts.step || 2, idx0 = opts.idx0 || 0, w = opts.w || Math.min(1.7, dx * 0.9);
  const xs = [], tiles = [], at = [], it = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx; xs.push(x);
    tiles.push(cube('', GRAY, [w, 0.2, 1.2], x, 0.1, z));
    if (addr0 !== null && addr0 !== undefined) at.push(tag(String(addr0 + i * step), 'idx', x, 0, z + 1.0));
    if (opts.noIdx !== true) it.push(tag('[' + (idx0 + i) + ']', 'idx', x, 0, z - 1.0));
  }
  return { xs, tiles, at, it, z };
}
// 指標標記：標籤＋箭頭指到第 i 格；front=true 時從前方指過去
function ptrMark(name, cls, xs, z, i, front) {
  const o = { i, l: tag(name, cls, 0, 0, 0), a: null };
  o.at = (x) => {
    if (o.a) kill(o.a);
    if (!front) { o.l.position.set(x, 2.5, z); o.a = arrow(V3(x, 2.2, z), V3(x, 0.95, z)); }
    else { o.l.position.set(x, 0.3, z + 2.6); o.a = arrow(V3(x, 0.3, z + 2.3), V3(x, 0.3, z + 0.75)); }
  };
  o.place = (j) => { o.i = j; o.at(xs[j]); };
  o.slide = async (tok, j, ms = 700) => { const a = xs[o.i], b = xs[j]; await anim(tok, ms, (t) => o.at(a + (b - a) * t)); o.i = j; };
  o.kill = () => { kill(o.l); if (o.a) kill(o.a); };
  o.place(i); return o;
}

// ─── MJZd6uPi88E：一維陣列的位址公式 ───
async function scAddr1D(tok) {
  fresh([0, 6, 12.5], [0, 1.4, 0]);
  const cd = code(['int A[5];', 'A[2] = 15;'], -4.6, 5.2);
  tag('A', 'ptr', -6.2, 0.2, 0);
  say('宣告 int A[5]：拿到 5 格連續空間', 'C 語言索引 0 … 4');
  const m = memRow(5, -4, 2, 0, 100);
  await beat(tok, 2600);
  const l0 = tag('L0 = 100（base address）', 'ptr alt', -4, 2.4, 0);
  glow(m.tiles[0], GOLD);
  say('第一格的位址叫 base address L0', '執行期才知道 L0，這裡假設 L0 = 100');
  await beat(tok, 2800);
  cd.hl(1);
  say('A[2] = 15：編譯器要 A[2] 的位址', '位址不能寫死，要寫成公式');
  await beat(tok, 2600);
  glow(m.tiles[0]);
  const cur = tag('▼', 'ptr', m.xs[0], 1.3, 0);
  for (let k = 0; k < 2; k++) {
    tint(m.tiles[k], SKIP);
    say('跳過第 ' + (k + 1) + ' 個元素（int 佔 w = 2 bytes）', '100 + ' + (k + 1) + ' × 2 = ' + (100 + (k + 1) * 2));
    await anim(tok, 700, (t) => cur.position.set(m.xs[k] + 2 * t, 1.3, 0));
    await beat(tok, 700);
  }
  glow(m.tiles[2], GOLD);
  const v = cube(15, BLUE, [1.2, 0.7, 1.0], m.xs[2], 0.55, 0, 3);
  say('A[2] 換成位址 104，把 15 存進去', 'Addr(A[2]) = L0 + 2 × 2 = 104');
  await beat(tok, 3000);
  kill(cur); txt(l0, 'Addr(A[i]) = L0 + i × w');
  say('通式：Addr(A[i]) = L0 + i × w', 'w = sizeof：int 2（影片假設）、float 4、char 1');
  await beat(tok, 3600);
  glow(v, GREEN);
  say('程式寫 A[i]，編譯器換成這條公式', 'i 是索引、w 是資料型態大小');
  await beat(tok, 2800);
}

// ─── MJZd6uPi88E：索引從 1 開始、任意下界 ───
async function scLowerBound(tok) {
  fresh([0, 6, 12.5], [0, 1.4, 0]);
  const l0 = tag('A[1 … 5]（C 以前的語言）', 'ptr alt', 0, 4.4, 0);
  let m = memRow(5, -4, 2, 0, 100, { idx0: 1 });
  say('早期語言允許索引從 1 開始', '宣告 A[1 … 5]，第一格還是 L0 = 100');
  await beat(tok, 2800);
  tint(m.tiles[0], SKIP); glow(m.tiles[1], GOLD);
  const v = cube(15, BLUE, [1.2, 0.7, 1.0], m.xs[1], 0.55, 0, 3);
  say('A[2] 前面只有 1 個元素', 'Addr(A[2]) = 100 + (2 − 1) × 2 = 102');
  await beat(tok, 3200);
  txt(l0, 'Addr(A[i]) = L0 + (i − 1) × w');
  say('從 1 開始：多一次「減 1」', '從 0 開始：L0 + i × w，少一次運算');
  await beat(tok, 3200);
  say('所以 C 之後的語言都規定從 0 開始', '每次存取陣列都省一個減法');
  await beat(tok, 2800);
  [...m.tiles, ...m.at, ...m.it].forEach(kill); kill(v);
  m = memRow(9, -5.6, 1.4, 0, 100, { idx0: -3, w: 1.2 });
  txt(l0, 'A[−3 … 5]');
  say('更早的編譯器甚至允許 A[−3 … 5]', '下界 lb = −3，共 9 個元素');
  await beat(tok, 3000);
  for (let k = 0; k < 3; k++) tint(m.tiles[k], SKIP);
  glow(m.tiles[3], GOLD);
  txt(l0, 'Addr(A[i]) = L0 + (i − lb) × w');
  say('一般式：先減掉下界再乘 w', '例：A[0] = 100 + (0 − (−3)) × 2 = 106');
  await beat(tok, 3800);
}

// ─── MJZd6uPi88E：二維陣列 → 一維記憶體 ───
const GX = (c) => -2.4 + c * 1.6, GY = (r) => 4.5 - r * 1.0, GZ = -1.6;
const LX = (k) => -6 + k * 1.09, LY = 0.4, LZ = 1.4;
// order: 'row' | 'col'；base1：用 1 起算的名字；instant：直接擺在一維記憶體
function build2D(order, instant, base1) {
  const cubes = [], tiles = [], at = [];
  for (let k = 0; k < 12; k++) { tiles.push(cube('', GRAY, [0.95, 0.15, 0.9], LX(k), 0.08, LZ)); at.push(tag(String(500 + 2 * k), 'idx', LX(k), 0, LZ + 0.9)); }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const k = order === 'row' ? r * 4 + c : c * 3 + r;
    const nm = base1 ? 'a' + (r + 1) + (c + 1) : 'a' + r + c;
    const m = instant ? cube(nm, ROWC[r], [0.92, 0.5, 0.8], LX(k), LY, LZ) : cube(nm, ROWC[r], [1.3, 0.75, 0.6], GX(c), GY(r), GZ);
    m.userData.k = k; m.userData.r = r; m.userData.c = c; cubes.push(m);
  }
  const heads = [];
  if (!instant) {
    for (let r = 0; r < 3; r++) heads.push(tag('row ' + r, 'idx', -3.9, GY(r), GZ));
    for (let c = 0; c < 4; c++) heads.push(tag('col ' + c, 'idx', GX(c), 5.3, GZ));
  }
  return { cubes, tiles, at, heads, byK: (k) => cubes.find((m) => m.userData.k === k) };
}
async function lay2D(tok, g, order) {
  const groups = order === 'row' ? [0, 1, 2] : [0, 1, 2, 3];
  for (const gi of groups) {
    const ms = g.cubes.filter((m) => (order === 'row' ? m.userData.r : m.userData.c) === gi);
    ms.forEach((m) => glow(m, GOLD));
    say((order === 'row' ? 'row ' : 'col ') + gi + ' 整' + (order === 'row' ? '列' : '行') + '搬進記憶體',
      order === 'row' ? 'a' + gi + '0, a' + gi + '1, a' + gi + '2, a' + gi + '3' : 'a0' + gi + ', a1' + gi + ', a2' + gi);
    await beat(tok, 500);
    for (const m of ms) { m.scale.set(0.72, 0.67, 1.33); move(m, LX(m.userData.k), LY, LZ); await beat(tok, 380); }
    ms.forEach((m) => glow(m));
    const k0 = Math.min(...ms.map((m) => m.userData.k)), k1 = Math.max(...ms.map((m) => m.userData.k));
    tag((order === 'row' ? 'row ' : 'col ') + gi, 'ptr', (LX(k0) + LX(k1)) / 2, 1.3, LZ);
    await beat(tok, 900);
  }
}
async function scRowLayout(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  tag('int A[3][4]', 'ptr alt', -5.2, 5.3, GZ);
  say('A[3][4]：紙上畫成 3 列 4 行', '每格 int 佔 2 bytes，起點 500');
  const g = build2D('row', false);
  await beat(tok, 3000);
  say('但記憶體是線性的，只有一維位址', '實際配置 12 格連續空間：500 … 522');
  await beat(tok, 3000);
  await lay2D(tok, g, 'row');
  say('Row-major：一列一列放', 'row 0 → row 1 → row 2');
  await beat(tok, 3200);
}
async function scRowAddr(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  const g = build2D('row', true);
  for (let r = 0; r < 3; r++) tag('row ' + r, 'ptr', (LX(r * 4) + LX(r * 4 + 3)) / 2, 1.3, LZ);
  const f = tag('Addr(A[i][j]) = L0 + (i × n + j) × w', 'ptr alt', 0, 4.6, 0);
  say('求 A[2][1] 的位址（m × n = 3 × 4）', 'L0 = 500，w = 2');
  await beat(tok, 2800);
  for (let k = 0; k < 8; k++) { tint(g.byK(k), SKIP); if (k % 4 === 3) { say('先跳過 ' + ((k + 1) / 4) + ' 整列', '每列 n = 4 個元素'); await beat(tok, 1300); } else await beat(tok, 200); }
  tint(g.byK(8), SKIP);
  say('到 row 2 開頭，再往後 1 格', '2 × 4 + 1 = 9 個元素');
  await beat(tok, 1800);
  glow(g.byK(9), GOLD);
  say('A[2][1] 在 518', '500 + (2 × 4 + 1) × 2 = 518');
  await beat(tok, 3200);
  say('Row-major 公式（索引從 0）', 'L0 + (i × n + j) × w');
  await beat(tok, 2800);
  g.cubes.forEach((m, i) => { relabel(m, 'a' + (m.userData.r + 1) + (m.userData.c + 1)); tint(m, ROWC[m.userData.r]); });
  txt(f, 'Addr(A[i][j]) = L0 + [(i − 1) × n + (j − 1)] × w');
  say('索引從 1 起算：i、j 都先減 1', '同一格現在叫 A[3][2]');
  await beat(tok, 3000);
  say('A[3][2] = 500 + [(3−1)×4 + (2−1)] × 2', '= 500 + 9 × 2 = 518');
  await beat(tok, 3600);
}
async function scColMajor(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  tag('int A[3][4]（m = 3, n = 4）', 'ptr alt', -4.6, 5.3, GZ);
  const g = build2D('col', false);
  say('Column-major：一行一行放', '同一個 3 × 4 陣列，起點 500');
  await beat(tok, 2600);
  await lay2D(tok, g, 'col');
  g.heads.forEach(kill);
  const f = tag('Addr(A[i][j]) = L0 + (j × m + i) × w', 'ptr alt', 0, 4.6, 0);
  say('求 A[1][2]：先跳過 2 整行', '每行 m = 3 個元素');
  for (let k = 0; k < 6; k++) { tint(g.byK(k), SKIP); await beat(tok, 260); }
  tint(g.byK(6), SKIP);
  say('到 col 2 開頭，再往後 1 格', '2 × 3 + 1 = 7 個元素');
  await beat(tok, 1800);
  glow(g.byK(7), GOLD);
  say('A[1][2] 在 514', '500 + (2 × 3 + 1) × 2 = 514');
  await beat(tok, 3200);
  glow(g.byK(7));
  g.cubes.forEach((m) => { relabel(m, 'a' + (m.userData.r + 1) + (m.userData.c + 1)); tint(m, ROWC[m.userData.r]); });
  txt(f, 'Addr(A[i][j]) = L0 + [(j − 1) × m + (i − 1)] × w');
  for (let k = 0; k < 9; k++) tint(g.byK(k), SKIP);
  glow(g.byK(9), GOLD);
  say('索引從 1：A[1][4]', '500 + [(4−1)×3 + (1−1)] × 2 = 518');
  await beat(tok, 3800);
}
async function scCompare(tok) {
  fresh([0, 5, 13], [0, 2.4, 0]);
  tag('Row-major', 'ptr', -3.5, 4.8, 0); tag('Column-major', 'ptr', 3.5, 4.8, 0);
  tag('L0 + (i × n + j) × w', 'ptr alt', -3.5, 4.0, 0); tag('L0 + (j × m + i) × w', 'ptr alt', 3.5, 4.0, 0);
  say('兩條公式（索引從 0）', '只差 i、j 和 m、n 的位置');
  await beat(tok, 2800);
  const ops = ['+', '+', '×', '×'];
  const cs = [];
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    cs.push(cube(ops[k], k < 2 ? TEAL : ORANGE, [1.0, 0.8, 1.0], side * 3.5 - 1.8 + k * 1.2, 0.45, 0, 3));
    await beat(tok, 350);
  }
  say('各是 2 次加法 + 2 次乘法', '兩者一樣有效率');
  await beat(tok, 3200);
  cs.forEach((m) => glow(m, GREEN));
  say('自己設計編譯器時選哪個都可以', '效率相同，只是慣例不同');
  await beat(tok, 2800);
  const t = tag('C 家族：row-major', 'ptr alt', 0, 2.2, 2);
  say('C／C++／Java 都採用 row-major', '補充：Fortran、MATLAB 採 column-major');
  await beat(tok, 3400);
}

// ─── 868qXWoGS9E：指向一維陣列的指標 ───
async function scPtr1D(tok) {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  const m = memRow(5, -4, 2, 0, 100);
  cube(9, BLUE, [1.2, 0.7, 1.0], m.xs[2], 0.55, 0);
  tag('int A[5]', 'ptr alt', -6, 0.2, 0);
  say('陣列名 A 本身就是 base address', 'A 不是指標變數，是位址 100');
  const ex = tag('', 'ptr alt', 0, 4.6, 0);
  await beat(tok, 2800);
  const rows = [['A', '100', 0], ['&A', '100', 0], ['&A[0]', '100', 0]];
  for (const [e, r, i] of rows) { txt(ex, 'printf(' + e + ') → ' + r); glow(m.tiles[i], GOLD); say(e + ' 印出 ' + r, 'A、&A、&A[0] 都是起始位址'); await beat(tok, 1600); }
  glow(m.tiles[0]);
  txt(ex, 'A[2] → 9　　2[A] → 9');
  glow(m.tiles[2], GOLD);
  say('A[2] 和 2[A] 都取到 9', 'A[i] 就是 *(A + i)，加法可交換');
  await beat(tok, 3000);
  const cur = tag('A + 2', 'ptr', m.xs[0], 1.6, 0);
  await anim(tok, 900, (t) => cur.position.set(m.xs[0] + 4 * t, 1.6, 0));
  txt(ex, 'A + 2 → 104');
  say('A + 2 = 100 + 2 × 2 = 104', '加 2 是跳 2 個 int，不是 2 個 byte');
  await beat(tok, 3000);
  txt(ex, '*(A + 2) → 9');
  say('*(A + 2)：取 104 的值', '= 9');
  await beat(tok, 2400);
  kill(cur); glow(m.tiles[2]);
  const pc = cube(100, TEAL, [1.3, 0.8, 1.0], -4, 0.5, 3.4, 3);
  tag('p', 'ptr', -5.4, 0.5, 3.4); tag('&p = 500', 'idx', -4, 0, 4.5);
  const a = arrow(V3(-4, 0.5, 2.8), V3(-4, 0.5, 0.75));
  txt(ex, 'int *p = A;');
  say('指標 p = A：p 存 100', '假設 p 自己的位址是 500');
  await beat(tok, 3000);
  txt(ex, 'p[2] = 2[p] = *(p+2) → 9　p+2 → 104');
  glow(m.tiles[2], GOLD);
  say('同一套語法也能用在 p 上', 'p → 100，&p → 500');
  await beat(tok, 3600);
}

// ─── 868qXWoGS9E：用 double pointer 在 heap 建 2D 陣列 ───
const HY = (r) => 3.8 - r * 1.25;
const HX = (c) => -1.0 + c * 1.6;
function buildHeap2D(full) {
  const o = {};
  o.p = cube(500, TEAL, [1.2, 0.8, 0.8], -5.6, 2.6, 0); tag('p', 'ptr', -5.6, 3.5, 0); o.pa = tag('&p = 700', 'idx', -5.6, 1.9, 0);
  o.ptr = []; o.rows = [];
  return o;
}
function addPtrArr(o) {
  for (let r = 0; r < 3; r++) { o.ptr.push(cube('', GRAY, [1.2, 0.8, 0.8], -3.3, HY(r), 0)); tag('[' + r + '] ' + (500 + 2 * r), 'idx', -3.3, HY(r) - 0.6, 0); }
  o.pArrow = arrow(V3(-5.0, 2.8, 0), V3(-3.95, HY(0), 0));
}
function addRow(o, r, base) {
  const row = [];
  for (let c = 0; c < 4; c++) { row.push(cube('', GRAY, [1.3, 0.8, 0.8], HX(c), HY(r), 0)); tag(base === null ? '' : String(base + 2 * c), 'idx', HX(c), HY(r) - 0.6, 0); }
  o.rows[r] = row;
  relabel(o.ptr[r], base === null ? '…' : base);
  if (o.ptr[r].userData.lbl === undefined) { o.ptr[r].userData.lbl = lab.label(base === null ? '…' : String(base), 'val'); o.ptr[r].add(o.ptr[r].userData.lbl); }
  arrow(V3(-2.65, HY(r), 0), V3(-1.7, HY(r), 0));
}
async function scHeap2D(tok) {
  fresh([0, 4, 14], [0, 3.0, 0]);
  const cd = code(['int **p;', 'p = new int*[3];', 'p[0] = new int[4];', 'p[1] = new int[4];', 'p[2] = new int[4];'], 4.6, 6.6, 0.5);
  const lv = tag('1D → *　2D → **　3D → ***', 'ptr alt', -3, 6.4, 0);
  say('幾維陣列就要幾層指標', '1D 用 *p，2D 用 **p，3D 用 ***p');
  await beat(tok, 3200);
  kill(lv);
  cd.hl(0);
  const o = buildHeap2D();
  say('不直接宣告 2D 陣列，改在 heap 動態建', 'p 是 double pointer');
  await beat(tok, 2600);
  cd.hl(1); addPtrArr(o);
  say('new int*[3]：一個「指標陣列」', '位址 500、502、504，p = 500');
  await beat(tok, 3000);
  const bases = [550, 600, null];
  for (let r = 0; r < 3; r++) {
    cd.hl(2 + r); addRow(o, r, bases[r]);
    say('p[' + r + '] = new int[4]', bases[r] === null ? '第三列的位址影片沒給' : 'p[' + r + '] 存這列的起點 ' + bases[r]);
    await beat(tok, 2200);
  }
  cd.hl(-1);
  tag('double pointer', 'ptr', -5.6, 0.6, 0); tag('array of pointers', 'ptr', -3.3, 0.6, 0); tag('array of arrays', 'ptr', 1.4, 0.6, 0);
  say('三者合起來就是一個 2D 陣列', '指標陣列 + 每列一個陣列 = array of arrays');
  await beat(tok, 3800);
}

// ─── 868qXWoGS9E：double pointer 的語法 ───
async function scDPtrSyntax(tok) {
  fresh([0, 4, 14], [0, 3.0, 0]);
  const o = buildHeap2D(); addPtrArr(o);
  [550, 600, null].forEach((b, r) => addRow(o, r, b));
  cube(10, BLUE, [1.0, 0.6, 0.6], HX(0), HY(0) + 0.5, 0);
  const ex = tag('', 'ptr alt', 0, 6.3, 0);
  const steps = [
    ['p', '500', () => glow(o.p, GOLD)],
    ['&p', '700', () => glow(o.p, GOLD)],
    ['*p', '550', () => glow(o.ptr[0], GOLD)],
    ['p + 1', '502', () => glow(o.ptr[1], '#3a3a00')],
    ['*(p + 1)', '600', () => glow(o.ptr[1], GOLD)],
    ['*(p + 1) + 2', '604', () => glow(o.rows[1][2], '#3a3a00')],
    ['*(*(p + 1) + 2)', '25', () => cube(25, ORANGE, [1.0, 0.6, 0.6], HX(2), HY(1) + 0.5, 0, 2)],
    ['*(*(p + 1) + 3) = p[1][3]', '位址 606 那格',() => glow(o.rows[1][3], GOLD)],
    ['**p = *(*(p + 0) + 0)', '10', () => glow(o.rows[0][0], GOLD)],
  ];
  const why = ['p 存指標陣列的起點', '假設 p 自己放在 700', '取 500 的內容：row 0 起點', '下一個指標（+2 bytes）', '取 502 的內容：row 1 起點',
    '600 + 2 × 2 = 604', '再取一次值', '*(*(p+i)+j) 就是 p[i][j]', '0 可以省略：**p 是 p[0][0]'];
  say('用 p 存取整個 2D 陣列', '每加一個 * 就往下走一層');
  await beat(tok, 2400);
  for (let i = 0; i < steps.length; i++) {
    const [e, r, fn] = steps[i];
    [o.p, ...o.ptr, ...o.rows.flat()].forEach((m) => glow(m));
    fn(); txt(ex, e + '  →  ' + r);
    say(e + ' → ' + r, why[i]);
    await beat(tok, 2300);
  }
  await beat(tok, 1200);
}

// ─── 868qXWoGS9E：靜態 2D 陣列名用指標語法 ───
async function scArr2DSyntax(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  const g = build2D('row', true);
  const grid = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const k = r * 4 + c;
    grid[k] = cube('a' + r + c, ROWC[r], [1.3, 0.75, 0.6], GX(c), GY(r), GZ);
    tag(String(500 + 2 * k), 'idx', GX(c) + 0.45, GY(r) - 0.48, GZ + 0.4);
  }
  for (let r = 0; r < 3; r++) tag('row ' + r, 'idx', -3.9, GY(r), GZ);
  relabel(g.byK(0), 10); relabel(g.byK(6), 25); relabel(grid[0], 10); relabel(grid[6], 25);
  tag('int A[3][4]', 'ptr alt', -5.2, 5.3, GZ);
  say('直接宣告 A[3][4]，起點 500', '畫成 2D，實際是 12 格連續的 int');
  await beat(tok, 3000);
  const ex = tag('', 'ptr alt', 3.6, 6.2, GZ);
  const all = () => { g.cubes.forEach((m) => glow(m)); grid.forEach((m) => glow(m)); };
  const gl0 = glow;
  const glowK = (k, c) => { gl0(g.byK(k), c); gl0(grid[k], c); };
  const steps = [
    ['A = &A = *A', '500', () => glowK(0, GOLD), '都是起始位址；*A 還是位址'],
    ['A + 1', '508', () => [4, 5, 6, 7].forEach((k) => glowK(k, GOLD)), '跳一整列（4 個 int），不是 502'],
    ['*(A + 1) = A[1]', '508', () => glowK(4, GOLD), '把列「打開」成第 1 列的起點'],
    ['*(A + 1) + 2 = A[1] + 2', '512', () => glowK(6, '#3a3a00'), '508 + 2 × 2 = 512'],
    ['*(*(A + 1) + 2) = A[1][2]', '25', () => glowK(6, GOLD), '再取一次值'],
    ['**A', '10', () => glowK(0, GOLD), '= A[0][0]'],
  ];
  for (const [e, r, fn, w] of steps) { all(); fn(); txt(ex, e + '  →  ' + r); say(e + ' → ' + r, w); await beat(tok, 2800); }
  all();
  say('規則和 double pointer 一樣', '把 A 想成「指標陣列 + 列陣列」');
  await beat(tok, 2800);
}

// ─── uMGwjNuidZU：指標的算術運算 ───
function arithBase() {
  fresh([0, 6, 13], [0, 1.6, 0.6]);
  const m = memRow(5, -4, 2, 0, 100);
  const vals = [5, 8, '', '', ''];
  const vs = vals.map((v, i) => (v === '' ? null : cube(v, BLUE, [1.2, 0.7, 1.0], m.xs[i], 0.55, 0)));
  tag('int A[5]', 'ptr alt', -6, 0.2, 0);
  return { m, vs };
}
async function scPtrArith(tok) {
  const op = P().op || 'incdec';
  const { m, vs } = arithBase();
  const ex = tag('', 'ptr alt', 0, 4.6, 0);
  if (op === 'setup') {
    say('int 陣列，每格 2 bytes', '位址 100、102、104、106、108');
    await beat(tok, 2800);
    txt(ex, 'int *p = &A[0];');
    const p = ptrMark('p = 100', 'ptr', m.xs, 0, 0);
    say('p = &A[0]：p 存 100', '也可寫 p = A');
    await beat(tok, 3000);
    txt(ex, 'int *q = &A[3];');
    const q = ptrMark('q = 106', 'ptr alt', m.xs, 0, 3, true);
    say('q = &A[3]：q 存 106', '100 + 3 × 2 = 106');
    await beat(tok, 3000);
    txt(ex, 'p = &A[0]　p = A　(p = &A)');
    say('三種寫法都得到 100', '補充：&A 型別是 int (*)[5]，要轉型');
    await beat(tok, 3600);
    return;
  }
  const p = ptrMark('p = 100', 'ptr', m.xs, 0, 0);
  const q = ptrMark('q = 106', 'ptr alt', m.xs, 0, 3, true);
  say('p 指 A[0]（100），q 指 A[3]（106）', 'int 每格 2 bytes');
  await beat(tok, 2600);
  if (op === 'incdec') {
    txt(ex, 'p++;');
    say('p++：移到下一個元素', '不是 +1 byte，是 + sizeof(int) = 2');
    await p.slide(tok, 1); txt(p.l, 'p = 102');
    await beat(tok, 2600);
    say('如果 p 是 float*，p++ 會 +4', '移動量 = 指向型態的大小');
    await beat(tok, 2800);
    txt(ex, 'q--;');
    say('q--：移到前一個元素', '106 − 2 = 104');
    await q.slide(tok, 2); txt(q.l, 'q = 104');
    await beat(tok, 3000);
  } else if (op === 'const') {
    txt(ex, 'p = p + 2;');
    say('p + 2：往前走 2 個元素', '100 + 2 × 2 = 104');
    await p.slide(tok, 2, 1000); txt(p.l, 'p = 104');
    await beat(tok, 3000);
    txt(ex, 'q = q − 2;');
    say('q − 2：往回走 2 個元素', '106 − 2 × 2 = 102');
    await q.slide(tok, 1, 1000); txt(q.l, 'q = 102');
    await beat(tok, 3200);
  } else if (op === 'sub') {
    txt(ex, 'q − p');
    say('兩個指標相減', '106 − 100 = 6 bytes？');
    await beat(tok, 2800);
    for (let i = 0; i < 3; i++) { glow(m.tiles[i], GOLD); await beat(tok, 600); }
    txt(ex, 'q − p = (106 − 100) / 2 = 3');
    say('結果是中間隔了幾個元素', '6 bytes ÷ sizeof(int) 2 = 3');
    await beat(tok, 3600);
  } else {
    say('合法：p++、p−−、p ± k、p − q', '每個都有意義：移動或算距離');
    await beat(tok, 3000);
    const bad = ['p + q', 'p × q', 'p × 2'].map((s, i) => cube(s, '#c0504d', [1.6, 0.7, 1.0], -2 + i * 2, 2.6, 2.2, 2));
    say('不合法：兩指標相加、相乘、乘常數', '這些位址沒有意義');
    await beat(tok, 3200);
    for (const b of bad) { fly(b); await beat(tok, 400); }
    say('只有這 5 種算術運算可以用', 'p++、p−−、p + k、p − k、q − p');
    await beat(tok, 3000);
  }
  await beat(tok, 600);
}
async function scPtrUnary(tok) {
  const { m, vs } = arithBase();
  const ex = tag('', 'ptr alt', 0, 4.6, 0);
  const rd = tag('', 'ptr', 4.4, 2.4, 2.4);
  say('一元運算子從右往左讀', 'p 一開始指 100（值 5）');
  const p = ptrMark('p', 'ptr', m.xs, 0, 0);
  await beat(tok, 2600);
  const reset = () => { p.place(0); relabel(vs[0], 5); glow(vs[0]); glow(vs[1]); txt(rd, ''); };
  // *++p
  txt(ex, '*++p');
  say('*++p：先移 p，再取值', '++p → 102');
  await p.slide(tok, 1); await beat(tok, 900);
  glow(vs[1], GOLD); txt(rd, '結果 8');
  say('*++p 得到 8，p 停在 102', '移指標 → 讀資料');
  await beat(tok, 2800);
  reset();
  // ++*p
  txt(ex, '++*p');
  say('++*p：先取值，再把值加 1', '*p = 5');
  glow(vs[0], GOLD); await beat(tok, 1500);
  relabel(vs[0], 6); txt(rd, '結果 6');
  say('5 變成 6，p 不動', '讀資料 → 加資料');
  await beat(tok, 2800);
  reset();
  // *p++
  txt(ex, '*p++');
  say('*p++：後置 ++ 等整個式子結束才做', '先 *p 讀到 5');
  glow(vs[0], GOLD); txt(rd, '結果 5'); await beat(tok, 2000);
  await p.slide(tok, 1);
  say('讀完 5 之後，p 才移到 102', '讀資料 → 移指標');
  await beat(tok, 2800);
  reset();
  // (*p)++
  txt(ex, '(*p)++');
  say('(*p)++：括號讓 ++ 作用在資料', '資料 5 → 6，p 不動');
  glow(vs[0], GOLD); await beat(tok, 1200); relabel(vs[0], 6); txt(rd, '值 5 → 6');
  await beat(tok, 2600);
  txt(ex, '++*p、(*p)++ 改資料；*++p、*p++ 移指標');
  say('記法：* 先碰到誰，++ 就作用在誰', '後置 ++ 在式子結束後才生效');
  await beat(tok, 3200);
}

// ─── OqLt2GfX6jg：為什麼需要指標 ───
function memMap() {
  fresh([0, 6.5, 12.5], [0, 1.2, 0]);
  const secs = [['Code', -4.6, '#e6dccb'], ['Stack', 0, '#d9e7f2'], ['Heap', 4.6, '#e8dcef']];
  secs.forEach(([n, x, c]) => { cube('', c, [4.2, 0.1, 5.2], x, 0.05, 0); tag(n, 'ptr', x, 0.2, -3.1); });
  tag('Main Memory', 'idx', 0, 0.2, 3.2);
}
async function scMemLayout(tok) {
  memMap();
  say('程式要執行，先載入 main memory', '分成 code、stack、heap 三區');
  await beat(tok, 2800);
  const cd = code(['int a, b, c;', '...'], -4.6, 2.4, 0.5);
  say('程式碼放在 code 區，一行一行執行', '第一行宣告變數');
  await beat(tok, 2600);
  cd.hl(0);
  ghostBox('#4b9ee2', 3.6, 1.2, 1.4).position.set(0, 0.7, 0);
  tag('activation record', 'idx', 0, 1.6, 0);
  const vs = ['a', 'b', 'c'].map((n, i) => cube(n, BLUE, [1.0, 0.6, 1.0], -1.2 + i * 1.2, 0.4, 0, 2));
  ['500', '502', '504'].forEach((a, i) => tag(a, 'idx', -1.2 + i * 1.2, 0, 1.0));
  say('變數配置在 stack：activation record', '假設 a、b、c 在 500、502、504');
  await beat(tok, 3000);
  vs.forEach((v) => glow(v, GREEN));
  say('stack 可以直接存取', '程式裡的 a 直接換成位址 500');
  await beat(tok, 3000);
  const h = tag('✗ 不能直接存取', 'ptr', 4.6, 1.2, 0);
  say('stack 以外（例如 heap）不能直接存取', '只能透過指標「間接」存取');
  await beat(tok, 3200);
}
async function scHeapMalloc(tok) {
  memMap();
  const cd = code(['int *p;', 'p = (int *)malloc(10);'], -4.6, 2.4, 0.5);
  cd.hl(0);
  const p = cube('p', TEAL, [1.2, 0.7, 1.0], 0, 0.45, 0, 2);
  say('activation record 只有一個變數 p', 'p 是指標，放在 stack');
  await beat(tok, 2800);
  cd.hl(1);
  const bytes = [];
  for (let i = 0; i < 10; i++) { bytes.push(cube('', '#b98fd0', [0.32, 0.5, 1.0], 3.0 + i * 0.36, 0.3, 0, 2)); await beat(tok, 120); }
  tag('1000', 'idx', 3.0, 0, 1.0); tag('10 bytes', 'idx', 4.6, 0, 1.0);
  say('malloc(10)：在 heap 配 10 bytes', '第一個 byte 位址假設 1000');
  await beat(tok, 2800);
  relabel(p, 1000);
  arrow(V3(0.6, 0.45, 0), V3(2.8, 0.45, 0));
  say('位址 1000 存進 p，p 指向 heap', 'p = 1000');
  await beat(tok, 2800);
  glow(p, GREEN); bytes.forEach((b) => glow(b, GOLD));
  say('程式直接讀 p，再透過 p 間接存取 heap', '用途一：存取 heap 記憶體');
  await beat(tok, 3400);
}
async function scSwap(tok) {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  tag('Stack', 'ptr', -5.5, 0.2, 0);
  const cd = code(['void swap(int x, int y) {', '  int t = x; x = y; y = t;', '}', 'main: swap(a, b);'], 3.4, 5.6, 0.48);
  tag('main', 'idx', -4.4, 0.2, 2.0);
  const a = cube(10, BLUE, [1.3, 0.8, 1.0], -2.2, 0.45, 2.0, 2), b = cube(20, TEAL, [1.3, 0.8, 1.0], -0.4, 0.45, 2.0, 2);
  tag('a  500', 'idx', -2.2, 0, 3.0); tag('b  502', 'idx', -0.4, 0, 3.0);
  say('main 有 a、b，想用 swap 交換', 'a = 10，b = 20（示意數值）');
  await beat(tok, 2800);
  cd.hl(3);
  tag('swap', 'idx', -4.4, 0.2, -1.6);
  const x = cube(10, BLUE, [1.3, 0.8, 1.0], -2.2, 0.45, -1.6, 3), y = cube(20, TEAL, [1.3, 0.8, 1.0], -0.4, 0.45, -1.6, 3), t = cube('t', GRAY, [1.3, 0.8, 1.0], 1.4, 0.45, -1.6, 3);
  tag('x', 'idx', -2.2, 0, -2.6); tag('y', 'idx', -0.4, 0, -2.6);
  say('call by value：值複製到 x、y', 'swap 有自己的 activation record');
  await beat(tok, 3000);
  cd.hl(1);
  move(x, -0.4, 0.45, -1.6); move(y, -2.2, 0.45, -1.6); relabel(t, 10);
  say('只交換了 x、y', 'swap 碰不到 main 的 a、b');
  await beat(tok, 2600);
  glow(a, RED); glow(b, RED);
  say('a、b 沒變：call by value 失敗', '函式不能存取別人的 activation record');
  await beat(tok, 3000);
  [x, y, t].forEach((m) => fly(m)); glow(a); glow(b);
  cd.kill();
  const cd2 = code(['void swap(int *x, int *y) {', '  int t = *x; *x = *y; *y = t;', '}', 'main: swap(&a, &b);'], 3.4, 5.6, 0.48);
  cd2.hl(3);
  await beat(tok, 800);
  const px = cube(500, ORANGE, [1.3, 0.8, 1.0], -2.2, 0.45, -1.6, 3), py = cube(502, ORANGE, [1.3, 0.8, 1.0], -0.4, 0.45, -1.6, 3);
  cube('t', GRAY, [1.3, 0.8, 1.0], 1.4, 0.45, -1.6, 3);
  arrow(V3(-2.2, 0.9, -1.0), V3(-2.2, 0.9, 1.4)); arrow(V3(-0.4, 0.9, -1.0), V3(-0.4, 0.9, 1.4));
  say('改傳位址：x = &a = 500，y = &b = 502', 'x、y 是指標，指向 main 的變數');
  await beat(tok, 3000);
  cd2.hl(1);
  move(a, -0.4, 0.45, 2.0); move(b, -2.2, 0.45, 2.0);
  await beat(tok, 900);
  glow(a, GREEN); glow(b, GREEN);
  say('透過 *x、*y 間接改到 a、b', '用途二：call by reference');
  await beat(tok, 3400);
}
async function scDevices(tok) {
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const sum = P().focus === 'summary';
  cube('', '#d9e7f2', [3.4, 0.1, 5.2], -4.4, 0.05, 0); tag('Stack（可直接存取）', 'ptr', -4.4, 0.2, -3.1);
  const p = cube('ptr', ORANGE, [1.3, 0.8, 1.0], -4.4, 0.45, 0, 2);
  const devs = [['Heap', '#e8dcef', -3.0], ['檔案（disk）', '#e6dccb', -1.0], ['鍵盤／螢幕', '#cfe3d2', 1.0], ['印表機', '#f0d9c4', 3.0]];
  const ds = [];
  const why = ['malloc 回傳位址給指標', 'FILE *fp 才能讀寫磁碟上的檔案', 'scanf／printf 內部用指標存取裝置', '輸出到印表機也要透過指標'];
  say(sum ? '指標的用途總整理' : 'stack 以外的東西都要間接存取', '指標 = 存位址的變數');
  await beat(tok, 2400);
  for (let i = 0; i < devs.length; i++) {
    const [n, c, z] = devs[i];
    ds.push(cube('', c, [2.0, 0.9, 1.4], 4.2, 0.5, z, 2)); tag(n, 'idx', 4.2, 1.3, z);
    arrow(V3(-3.6, 0.5, 0), V3(3.1, 0.5, z));
    if (!sum && i === 0) { await beat(tok, 900); continue; }
    say(sum ? ['① 存取 heap', '② call by reference', '③ 存取檔案', '④ 存取周邊裝置'][i] : n + '：靠指標', why[i]);
    await beat(tok, sum ? 1800 : 2800);
  }
  ds.forEach((d) => glow(d, GOLD));
  say('只有 stack 能直接存取', '其他地方的資料都靠指標間接存取');
  await beat(tok, 3200);
}

FRAG.push(['bariarr-addr1d', '一維陣列位址公式 L0 + i×w', scAddr1D]);
FRAG.push(['bariarr-lowerbound', '索引從 1／任意下界的位址公式', scLowerBound]);
FRAG.push(['bariarr-rowmajor-layout', 'Row-major：2D 一列一列放進記憶體', scRowLayout]);
FRAG.push(['bariarr-rowmajor-addr', 'Row-major 位址公式（A[2][1] = 518）', scRowAddr]);
FRAG.push(['bariarr-colmajor', 'Column-major 排列與位址公式', scColMajor]);
FRAG.push(['bariarr-compare', 'Row-major 與 Column-major 效率比較', scCompare]);
FRAG.push(['bariarr-ptr1d', '陣列名與指標存取一維陣列', scPtr1D]);
FRAG.push(['bariarr-heap2d', '用 double pointer 在 heap 建 2D 陣列', scHeap2D]);
FRAG.push(['bariarr-dptr-syntax', 'double pointer 存取 2D 陣列', scDPtrSyntax]);
FRAG.push(['bariarr-arr2d-syntax', '2D 陣列名的指標語法', scArr2DSyntax]);
FRAG.push(['bariarr-ptr-arith', '指標的算術運算', scPtrArith]);
FRAG.push(['bariarr-ptr-unary', '*++p、++*p、*p++、(*p)++', scPtrUnary]);
FRAG.push(['bariarr-memlayout', 'Code／Stack／Heap 與直接存取', scMemLayout]);
FRAG.push(['bariarr-heap-malloc', '用指標存取 heap（malloc）', scHeapMalloc]);
FRAG.push(['bariarr-swap', 'Call by value vs call by reference', scSwap]);
FRAG.push(['bariarr-devices', '指標存取檔案與周邊裝置', scDevices]);
  }

  // ═══ contlin.js ═══
  {
// ─── contlin：USLvdBuxTno（台大林軒田 DSA：Container 整合課——Array／List 家族、Extendable Array、Iterator） ───
const C_B = '#4b9ee2', C_G = '#2fc092', C_O = '#dd8238', C_P = '#9b7ef4', C_K = '#c08a1f', C_E = '#e9dcc4', C_X = '#b9ad98';
const A_RED = 0xc0392b, A_GOLD = 0xc08a1f, A_GREEN = 0x2e8b57;
// a flat floor slot (array cell)
function cell(x, z, w = 0.95, d = 1.0) { return cube('', C_E, [w, 0.08, d], x, 0.04, z); }
// an array row: cap slots, values vals (null = empty); idx tags show [i] or addresses (opt.base)
function arrRow(vals, cap, z, opt = {}) {
  const dx = opt.dx || 1.1, x0 = opt.x0 !== undefined ? opt.x0 : -(cap - 1) * dx / 2, s = dx * 0.8;
  const xs = [], cs = [], tiles = [];
  for (let i = 0; i < cap; i++) {
    const x = x0 + i * dx; xs.push(x);
    tiles.push(cell(x, z, dx * 0.92, 1.0));
    if (opt.idx !== false) tiles.push(tag(opt.base ? String(opt.base + i * 4) : '[' + i + ']', 'idx', x, 0, z + 0.85));
    const v = vals[i];
    cs.push(v === null || v === undefined ? null : cube(v, opt.color || colorFor(v), [s, 0.7, 0.85], x, 0.4, z, opt.drop ? opt.drop + i * 0.2 : 0));
  }
  return { cs, xs, tiles, dx };
}
// doubly node: prev | data | next  (group; userData.data = data box)
function dn(v, x, z, color, dropH = 0) {
  const g = new THREE.Group();
  const p = lab.box('#d8c29b', [0.4, 0.7, 1.0]); p.position.x = -0.68;
  const d = lab.box(color || colorFor(v), [0.9, 0.7, 1.0]); d.add(lab.label(String(v), 'val'));
  const n = lab.box('#d8c29b', [0.4, 0.7, 1.0]); n.position.x = 0.68;
  g.add(p, d, n); g.userData.data = d;
  g.position.set(x, 0.35 + dropH, z);
  if (dropH > 0) lab.dropTo(lab.addBody(g), V3(x, 0.35, z)); else lab.world.add(g);
  return g;
}
function dlinks(xs, z) {
  const out = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    out.push(arrow(V3(xs[i] + 0.88, 0.55, z), V3(xs[i + 1] - 0.88, 0.55, z)));
    out.push(arrow(V3(xs[i + 1] - 0.88, 0.15, z), V3(xs[i] + 0.88, 0.15, z), A_GOLD));
  }
  return out;
}
// singly node (data | next) that optionally drops in
function sn(v, x, z, color, dropH = 0) {
  const g = lnode(v, x, 0.35 + dropH, z, color);
  if (dropH > 0) lab.dropTo(lab.addBody(g), V3(x, 0.35, z));
  return g;
}
const sl = (x1, z1, x2, z2, color) => arrow(V3(x1 + 0.95, 0.35, z1), V3(x2 - 0.52, 0.35, z2), color);

// ════════ 32:45 Container 是什麼 ════════
FRAG.push(['contlin-container', 'Container：資料結構就是裝資料的容器', async (tok) => {
  fresh([0, 7, 12.5], [0, 1, 0.4]);
  const box = ghostBox(C_P, 4.4, 2.4, 3.0); box.position.set(0, 1.2, -0.9);
  tag('container（容器）', 'ptr', 0, 2.9, -0.9);
  say('所有 data structure 都是某種容器', '拿來「裝 data」的東西');
  await beat(tok, 2200);
  const items = [['int 7', C_B], ['double 3.14', C_G], ['complex 1+2i', C_O], ['polynomial', C_P]];
  const pos = [[-1.1, -1.6], [1.1, -1.6], [-1.1, -0.2], [1.1, -0.2]];
  for (let i = 0; i < 4; i++) {
    cube(items[i][0], items[i][1], [1.9, 0.6, 1.0], pos[i][0], 0.3, pos[i][1], 5);
    say('同一個容器，也能裝 ' + items[i][0].split(' ')[0], 'general：不寫死要裝什麼型別');
    await beat(tok, 1300);
  }
  await beat(tok, 700);
  say('目前學過的，全都可以看成容器', '');
  [['Array', -5.1], ['Linked List', -1.7], ['Stack', 1.7], ['Queue', 5.1]].forEach(([n, x], i) => {
    cube(n, [C_B, C_G, C_O, C_P][i], [2.6, 0.6, 1.1], x, 0.3, 3.0, 4 + i * 0.4);
  });
  await beat(tok, 2400);
  say('需求不同 → 衍生出不一樣的容器', '每種容器有自己特別的性質');
  await beat(tok, 2400);
  say('今天：把共同的功能抽出來', 'abstraction：用不一樣的視角看這些容器');
  await beat(tok, 3000);
}]);

// ════════ 34:35 Dense array：①②③ ════════
FRAG.push(['contlin-array-access', 'Dense array：Θ(n) 儲存、index access、sequential access', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.5, 0.5]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  say('int array：要放 n 個就配 n 格', '① storage Θ(n)，除了資料幾乎沒有 overhead');
  const A = arrRow(V, 10, 0, { drop: 4 });
  tag('A', 'ptr', A.xs[0] - 1.1, 0.9, 0);
  await beat(tok, 2800);
  say('② indexed（random）access：給編號就拿', '想拿 A[6]');
  const cur = tag('i = 6', 'ptr alt', A.xs[6], 1.7, 0);
  glow(A.cs[6], GOLD);
  await beat(tok, 1600);
  say('index 直接算成 address', '位址 = A + 6 × sizeof(int) → O(1)');
  await beat(tok, 2200);
  relabel(A.cs[6], 42);
  say('read、write 都一樣快', 'A[6] = 42');
  await beat(tok, 1800);
  glow(A.cs[6], null); kill(cur);
  say('③ iterative（sequential）access', 'for (i = 0; i < n; i++) …');
  const p = tag('i', 'ptr alt', A.xs[0], 1.7, 0);
  for (let i = 0; i < 10; i++) { p.position.x = A.xs[i]; glow(A.cs[i], GOLD); await beat(tok, 380); glow(A.cs[i], null); }
  say('像把冰箱每一格都打開看一次', '不必知道放哪，但要每個都看到');
  await beat(tok, 2800);
}]);

// ════════ 38:20 Dense array：④⑤ ════════
FRAG.push(['contlin-array-shift', 'Dense array：長度固定、插入刪除要搬人', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  let A = arrRow(V, 10, 0, { drop: 4 });
  say('④ max length 固定：訂幾個櫃子就幾個', 'int A[10]');
  await beat(tok, 2000);
  const extra = cube(11, C_O, [0.88, 0.7, 0.85], 6.05, 0.4, 0, 4);
  await beat(tok, 900);
  tint(extra, '#c0392b');
  say('第 11 個放不進去', '沒有 A[10] 這一格（要變大得另想辦法）');
  await beat(tok, 1800);
  fly(extra, V3(2, 8, 3));
  await beat(tok, 600);
  // ⑤ insert at 0 with 10 elements (capacity 11)
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  A = arrRow(V, 11, 0, { dx: 1.05 });
  const cnt = tag('搬了 0 次', 'ptr alt', 0, 2.3, 0);
  say('⑤ 已有 10 個，要插到第 0 格', '維持 dense：前面要排得滿滿的');
  await beat(tok, 1800);
  for (let i = 9; i >= 0; i--) { move(A.cs[i], A.xs[i + 1], 0.4, 0); txt(cnt, '搬了 ' + (10 - i) + ' 次'); await beat(tok, 260); }
  cube(99, C_O, [0.84, 0.7, 0.85], A.xs[0], 0.4, 0, 4);
  say('10 個人往後推 → 花 10 份力氣', 'insert at 0：O(n)');
  await beat(tok, 2200);
  // remove first of 10
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  A = arrRow(V, 11, 0, { dx: 1.05 });
  const cnt2 = tag('搬了 0 次', 'ptr alt', 0, 2.3, 0);
  say('拿掉第 1 個', '後面的人要往前補位');
  await beat(tok, 1200);
  fly(A.cs[0], V3(0, 8, 4));
  await beat(tok, 500);
  for (let i = 1; i < 10; i++) { move(A.cs[i], A.xs[i - 1], 0.4, 0); txt(cnt2, '搬了 ' + i + ' 次'); await beat(tok, 260); }
  say('後面 9 個往前 → 又慢又容易寫錯', 'removal：O(n)；array 的著眼點只在 fast random access');
  await beat(tok, 3000);
}]);

// ════════ 40:50 Doubly linked list ════════
FRAG.push(['contlin-dll', 'Doubly linked list：O(1) 插入刪除、長度可變', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.6]);
  const xs = [-3.9, -1.3, 1.3, 3.9], vals = [3, 7, 1, 9], z = -0.9;
  say('新需求：更快的 insertion／removal', '知道位置時，constant time 放進去、拿出來');
  const ns = vals.map((v, i) => dn(v, xs[i], z, null, 4 + i * 0.3));
  await beat(tok, 1800);
  const ls = dlinks(xs, z);
  tag('head', 'ptr', xs[0], 1.4, z);
  say('還要 dynamic max length', '要用時才配一個 node，記憶體夠就一直裝');
  await beat(tok, 2200);
  ns.forEach((g) => { glow(g.children[0], GOLD); glow(g.children[2], GOLD); });
  say('每個 node 多兩張小紙條：prev、next', 'storage Θ(n)，加上每個 node 2 個指標的 overhead');
  await beat(tok, 2600);
  ns.forEach((g) => { glow(g.children[0], null); glow(g.children[2], null); });
  say('把 5 插到 7 和 1 之間', '新 node 放在別處，其他 node 通通不動');
  const nn = dn(5, 0, 1.9, C_O, 4);
  await beat(tok, 1500);
  kill(ls[2]); kill(ls[3]);
  arrow(V3(xs[1] + 0.88, 0.55, z), V3(-0.88, 0.55, 1.9));
  arrow(V3(0.88, 0.55, 1.9), V3(xs[2] - 0.88, 0.55, z));
  arrow(V3(xs[2] - 0.88, 0.15, z), V3(0.88, 0.15, 1.9), A_GOLD);
  arrow(V3(-0.88, 0.15, 1.9), V3(xs[1] + 0.88, 0.15, z), A_GOLD);
  say('只改 4 張紙條', 'insertion／removal：O(1)（已知位置）');
  await beat(tok, 2600);
  say('要第 3 個？只能從 head 一步一步走', 'index access 硬要可以，但很慢 → 很少這樣用');
  const path = [[xs[0], z, ns[0]], [xs[1], z, ns[1]], [0, 1.9, nn], [xs[2], z, ns[2]]];
  const p = tag('p', 'ptr alt', xs[0], 1.9, z);
  for (const [x, zz, g] of path) { p.position.set(x, 1.9, zz); glow(g.userData.data, GOLD); await beat(tok, 750); glow(g.userData.data, null); }
  say('iterative access by pointer：p = p->next', '在意的優點換成 ④⑤，放棄 array 的 ②');
  await beat(tok, 3000);
}]);

// ════════ 46:22 Singly linked list ════════
FRAG.push(['contlin-sll', 'Singly linked list：少一張紙條，removal 變麻煩', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.4]);
  say('只在乎 insertion、不在乎 removal', '→ singly linked list');
  dn('data', -3.2, -3.0, '#9a9080', 3);
  tag('doubly：prev + data + next', 'idx', -3.2, 0, -2.1);
  sn('data', 2.4, -3.0, '#9a9080', 3);
  tag('singly：data + next', 'idx', 2.7, 0, -2.1);
  await beat(tok, 2400);
  say('每個 node 少一張紙條', 'with less overhead（storage 仍是 Θ(n)）');
  await beat(tok, 2200);
  const xs = [-4.5, -1.5, 1.5, 4.5], vals = [3, 7, 1, 9], z = 0.4;
  const ns = vals.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  const ls = [0, 1, 2].map((i) => sl(xs[i], z, xs[i + 1], z));
  tag('NULL', 'idx', xs[3] + 1.6, 0.35, z); tag('head', 'ptr', xs[0], 1.4, z);
  await beat(tok, 1200);
  const pt = tag('p', 'ptr alt', xs[1], 1.5, z);
  say('insert after p：一樣 O(1)', 'new->next = p->next;  p->next = new;');
  sn(5, 0, 2.8, C_O, 4);
  await beat(tok, 1200);
  kill(ls[1]);
  sl(xs[1], z, 0, 2.8); const a51 = sl(0, 2.8, xs[2], z);
  await beat(tok, 2200);
  say('removal：刪掉 1，要改「前一個」的 next', '手上的指標只指著 1，不知道前一個是誰');
  pt.position.x = xs[2]; glow(ns[2].userData.data, RED);
  await beat(tok, 2400);
  say('只好從 head 再走一次找前一個', 'singly 的 removal 比較麻煩');
  const q = tag('q', 'ptr', xs[0], 2.1, z);
  for (const [x, zz] of [[xs[0], z], [xs[1], z], [0, 2.8]]) { q.position.set(x, 2.1, zz); await beat(tok, 700); }
  kill(a51); kill(ls[2]); kill(pt);
  sl(0, 2.8, xs[3], z);
  fly(ns[2], V3(0, 8, -3));
  say('省一個指標，只剩 O(1) insertion', '其他特性和 doubly 差不多');
  await beat(tok, 3000);
}]);

// ════════ 49:30／82:44 Template：type abstraction ════════
FRAG.push(['contlin-template', 'Template：同一份 code 裝任何型別', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.2, 0]);
  const c = code(['template <class T>', 'class Array {', '  T data[N];', '  T& at(int i);', '};'], -3.6, 3.8);
  say('container 不一定只裝 integer', 'any type → 型別先不寫死');
  await beat(tok, 2400);
  c.hl(0);
  say('compiler 幫你「複製、換型別」', '寫一次（想一次），用在很多地方');
  await beat(tok, 1500);
  const ts = [['Array<int>', C_B, '4 bytes'], ['Array<double>', C_G, '8 bytes'], ['Array<Complex>', C_O, '16 bytes']];
  for (let i = 0; i < 3; i++) {
    const m = cube(ts[i][0], ts[i][1], [2.8, 0.6, 1.0], -3.6, 0.3, 0.6);
    move(m, 2.6, 0.3, -2.2 + i * 2.2);
    tag(ts[i][2], 'idx', 5.1, 0, -2.2 + i * 2.2);
    await beat(tok, 1300);
  }
  c.hl(3);
  say('essence 都一樣：index → address', '裡面 4、8 還是 16 bytes 不重要');
  await beat(tok, 2800);
  c.hl(-1);
  say('type abstraction：把型別放寬', '節省 implementation efforts');
  await beat(tok, 3000);
}]);

// ════════ 50:29 Array + restricted access → Stack ════════
FRAG.push(['contlin-array-stack', 'Array 加上 restricted access → Stack', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const vals = [4, 8, 2];
  const A = arrRow([4, 8, 2], 8, 0, { drop: 4 });
  const items = A.cs.slice(0, 3);
  say('array 本來可以用任何 index 存取', 'A[0]、A[1]、A[2]… 都能拿');
  items.forEach((m) => glow(m, GOLD));
  await beat(tok, 2000);
  items.forEach((m) => glow(m, null));
  const top = tag('top', 'ptr alt', A.xs[2], 1.7, 0);
  const refresh = () => { items.forEach((m, i) => tint(m, i === items.length - 1 ? colorFor(vals[i]) : C_X)); top.position.x = A.xs[items.length - 1]; };
  refresh();
  say('限制：只能碰最尾巴那一格', 'restricted access');
  await beat(tok, 2400);
  for (const v of [6, 5]) {
    const i = items.length;
    items.push(cube(v, colorFor(v), [0.88, 0.7, 0.85], A.xs[i], 0.4, 0, 4)); vals.push(v);
    refresh();
    say('push ' + v + '：只能放在最尾巴', 'top = ' + i);
    await beat(tok, 1500);
  }
  const m = items.pop(); const v = vals.pop();
  fly(m, V3(0, 8, 4)); refresh();
  say('pop：拿走的是最後放的 ' + v, 'top = ' + (items.length - 1));
  await beat(tok, 1800);
  say('array 被限制成 stack', 'first in, last out（LIFO）');
  await beat(tok, 3000);
}]);

// ════════ 52:17 Circular list → Queue ════════
FRAG.push(['contlin-circ-queue', 'Circular list 加上 restricted access → Queue', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.4]);
  const R = 3.2, ms = [], vals = [];
  let ars = [];
  const pos = (i, n) => { const a = Math.PI / 2 - (i / n) * Math.PI * 2; return [Math.cos(a) * R, -Math.sin(a) * R]; };
  const rear = tag('rear', 'ptr alt', 0, 1.4, 0), front = tag('front', 'ptr', 0, 1.4, 0);
  showL(rear, false); showL(front, false);
  function layout(ptrs) {
    const n = ms.length;
    ars.forEach(kill); ars = [];
    ms.forEach((m, i) => { const [x, z] = pos(i, n); move(m, x, 0.4, z); });
    for (let i = 0; i < n; i++) {
      const [x1, z1] = pos(i, n), [x2, z2] = pos((i + 1) % n, n);
      const a = V3(x1, 0.4, z1), b = V3(x2, 0.4, z2), d = b.clone().sub(a).normalize().multiplyScalar(0.62);
      ars.push(arrow(a.clone().add(d), b.clone().sub(d)));
    }
    if (ptrs) {
      const [rx, rz] = pos(n - 1, n), [fx, fz] = pos(0, n);
      rear.position.set(rx * 1.45, 0.4, rz * 1.45); front.position.set(fx * 1.45, 0.4, fz * 1.45);
    }
  }
  say('circular list：最後一個接回第一個', 'linked list 的變形');
  for (const v of [1, 2, 3, 4, 5]) {
    const [x, z] = pos(ms.length, 5);
    ms.push(cube(v, colorFor(v), [1.0, 0.8, 1.0], x, 0.4, z, 4)); vals.push(v);
    await beat(tok, 350);
  }
  layout(false);
  await beat(tok, 1400);
  say('iterative access 變成 circular access', '像音樂的循環播放：一直繞');
  const cur = tag('●', 'ptr alt', 0, 1.3, 0);
  for (let k = 0; k < 10; k++) { const [x, z] = pos(k % 5, 5); cur.position.set(x, 1.3, z); glow(ms[k % 5], GOLD); await beat(tok, 300); glow(ms[k % 5], null); }
  kill(cur);
  layout(true); showL(rear, true); showL(front, true);
  say('再加 restricted access：只在游標處放、拿', 'front = rear->next');
  await beat(tok, 2400);
  for (const v of [6, 7]) {
    const n = ms.length + 1, [x, z] = pos(n - 1, n);
    ms.push(cube(v, colorFor(v), [1.0, 0.8, 1.0], x, 0.4, z, 4)); vals.push(v);
    layout(true);
    say('enqueue ' + v + '：接在 rear 後面，rear 移過去', 'O(1)');
    await beat(tok, 1600);
  }
  for (let k = 0; k < 2; k++) {
    const m = ms.shift(), v = vals.shift();
    fly(m, V3(0, 8, -4)); layout(true);
    say('dequeue：拿走 front（rear 的下一個）= ' + v, 'first in, first out');
    await beat(tok, 1600);
  }
  say('circular access 不限 linked list', 'array 也行 → circular array 實作 queue');
  await beat(tok, 3000);
}]);

// ════════ 54:21 Sparse array on ordered array ════════
FRAG.push(['contlin-sparse-array', 'Sparse array：用 ordered array 只存 non-zero', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.6]);
  const D = [1, 0, 0, 5, 0, 0, 0, 2, 0, 0];
  say('dense array：每一格都存，連 0 也存', '例：1 + 5x³ + 2x⁷，index = 次方');
  const A = arrRow(D, 10, -2.2, { drop: 4 });
  await beat(tok, 2600);
  say('sparse array：只存 non-zero', 'storage：Θ(n) → Θ(nnz)');
  A.cs.forEach((m, i) => { if (!D[i]) fly(m, V3(0, 8, -4)); });
  await beat(tok, 1600);
  const P = [[0, 1], [3, 5], [7, 2]], xs = [-4.4, -2.2, 0, 2.2, 4.4];
  xs.forEach((x, i) => { cell(x, 1.4, 2.0, 1.0); tag('[' + i + ']', 'idx', x, 0, 2.25); });
  const nz = [0, 3, 7].map((d, k) => { const m = A.cs[d]; move(m, xs[k], 0.4, 1.4); relabel(m, '(' + P[k][0] + ', ' + P[k][1] + ')'); return m; });
  nz.forEach((m) => m.scale.set(2.0, 1, 1));
  tag('ordered array：(次方, 係數) 依 index 排好', 'ptr', 0, 1.6, 3.2);
  await beat(tok, 2600);
  say('有沒有 x³ 這一項？係數多少？', 'index access：binary search');
  const lo = tag('lo', 'ptr', xs[0], 1.3, 1.4), hi = tag('hi', 'ptr', xs[2], 1.3, 1.4);
  await beat(tok, 1300);
  const mid = tag('mid', 'ptr alt', xs[1], 1.9, 1.4); glow(nz[1], GOLD);
  say('mid 就是 (3, 5)：找到了', 'O(log nnz)');
  await beat(tok, 2400);
  glow(nz[1], null); kill(lo); kill(hi); kill(mid);
  say('iterative access：走過所有 non-zero', '');
  for (const m of nz) { glow(m, GOLD); await beat(tok, 450); glow(m, null); }
  say('加入 4x⁵：要插在 (3,5) 和 (7,2) 之間', '後面的項要往後搬');
  move(nz[2], xs[3], 0.4, 1.4);
  await beat(tok, 900);
  const nm = cube('(5, 4)', C_O, [1.6, 0.7, 0.85], xs[2], 0.4, 1.4, 4);
  await beat(tok, 900);
  glow(nm, GOLD);
  say('insertion／removal：O(nnz)', 'ordered array 能 binary search，但插入要搬');
  await beat(tok, 3000);
}]);

// ════════ 58:55 Sparse array on ordered linked list ════════
FRAG.push(['contlin-sparse-list', 'Sparse array：改用 ordered linked list', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.5]);
  const xs = [-4.2, -0.6, 3.0], P = ['(0,1)', '(3,5)', '(7,2)'], z = -0.6;
  say('同一個 sparse array，改用 ordered linked list', '一樣只存 non-zero：Θ(nnz)');
  const ns = P.map((t, i) => sn(t, xs[i], z, [C_B, C_G, C_P][i], 3 + i * 0.3));
  const ls = [sl(xs[0], z, xs[1], z), sl(xs[1], z, xs[2], z)];
  tag('NULL', 'idx', xs[2] + 1.7, 0.35, z); tag('head', 'ptr', xs[0], 1.4, z);
  await beat(tok, 2400);
  say('找 x³：沒辦法直接跳到中間', '不能 binary search');
  const p = tag('p', 'ptr alt', xs[0], 1.9, z);
  for (let i = 0; i < 2; i++) { p.position.x = xs[i]; glow(ns[i].userData.data, GOLD); await beat(tok, 900); glow(ns[i].userData.data, null); }
  glow(ns[1].userData.data, GOLD);
  say('只能 sequential search', 'O(nnz)，而不是 O(log nnz)');
  await beat(tok, 2400);
  glow(ns[1].userData.data, null);
  say('加入 4x⁵：p 已經停在 (3,5)', '不用搬其他資料');
  sn('(5,4)', 1.2, 2.4, C_O, 4);
  await beat(tok, 1300);
  kill(ls[1]);
  sl(xs[1], z, 1.2, 2.4); sl(1.2, 2.4, xs[2], z);
  say('只改兩個指標', 'insertion／removal：O(1)（已知位置）');
  await beat(tok, 2400);
  tag('ordered array：search O(log nnz)、insert O(nnz)', 'idx', 0, 0, -3.0);
  tag('ordered list：search O(nnz)、insert O(1)', 'idx', 0, 0, -2.3);
  say('做的事一樣，實作不同', 'implementation trade-off');
  await beat(tok, 3200);
}]);

// ════════ 60:59 Deque ════════
FRAG.push(['contlin-deque', 'Deque：兩頭都能放、都能拿', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.4, 0.3]);
  const ms = [], vals = [];
  let ars = [];
  const X = (i, n) => (i - (n - 1) / 2) * 2.0;
  const head = tag('head', 'ptr', 0, 1.5, 0), tail = tag('tail', 'ptr alt', 0, 1.5, 0);
  function layout() {
    const n = ms.length;
    ars.forEach(kill); ars = [];
    ms.forEach((m, i) => move(m, X(i, n), 0.4, 0));
    for (let i = 0; i + 1 < n; i++) {
      ars.push(arrow(V3(X(i, n) + 0.5, 0.55, 0), V3(X(i + 1, n) - 0.5, 0.55, 0)));
      ars.push(arrow(V3(X(i + 1, n) - 0.5, 0.2, 0), V3(X(i, n) + 0.5, 0.2, 0), A_GOLD));
    }
    head.position.x = X(0, n); tail.position.x = X(n - 1, n);
  }
  async function push(v, atHead, cap, f) {
    const n = ms.length + 1, x = atHead ? X(0, n) : X(n - 1, n);
    const m = cube(v, colorFor(v), [1.0, 0.8, 1.0], x, 0.4, 0, 4);
    if (atHead) { ms.unshift(m); vals.unshift(v); } else { ms.push(m); vals.push(v); }
    layout(); say(cap, f); await beat(tok, 1600);
  }
  async function pop(atHead, cap, f) {
    const m = atHead ? ms.shift() : ms.pop(); atHead ? vals.shift() : vals.pop();
    fly(m, V3(atHead ? -4 : 4, 8, 2)); layout(); say(cap, f); await beat(tok, 1600);
  }
  for (const v of [3, 7, 1]) { ms.push(cube(v, colorFor(v), [1.0, 0.8, 1.0], 0, 0.4, 0, 4)); vals.push(v); }
  layout();
  say('stack 和 queue 合起來？', '底下是 doubly linked list');
  await beat(tok, 2000);
  await push(9, false, '從 tail 放進去', 'push at tail');
  await pop(true, '從 head 拿出來：這就是 queue', 'tail 進、head 出 = FIFO');
  await push(5, true, '從 head 放進去', 'push at head');
  await pop(true, '再從 head 拿出來：這就是 stack', 'head 進、head 出 = LIFO');
  await pop(false, 'tail 也能拿：頭尾完全對稱', 'pop at tail');
  say('deque = double-ended queue', 'doubly linked list 的一種 restricted access');
  await beat(tok, 3000);
}]);

// ════════ 78:43 Abstraction：數字到代數 ════════
FRAG.push(['contlin-abstraction', '抽象化：3+5=8 → 300+500=800 → 3x+5x=8x', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.5, 0]);
  const rows = [[['3', '+', '5', '=', '8'], -2.4, '小時候數數：3 + 5 = 8'],
    [['300', '+', '500', '=', '800'], 0, '數百元鈔票：單位換成 100，加法照用'],
    [['3x', '+', '5x', '=', '8x'], 2.4, '再抽象一點：3x + 5x = 8x']];
  say('abstraction：抓住共同的精神', '');
  await beat(tok, 1600);
  for (const [r, z, cap] of rows) {
    say(cap, '');
    for (let i = 0; i < 5; i++) {
      const isOp = r[i] === '+' || r[i] === '=';
      cube(r[i], isOp ? C_X : [C_B, C_G, C_O][rows.findIndex((q) => q[1] === z)], [isOp ? 0.8 : 1.4, 0.6, 1.0], -3.6 + i * 1.8, 0.3, z, 4 + i * 0.2);
      await beat(tok, 300);
    }
    await beat(tok, 1600);
  }
  say('思考越來越抽象，就能用在更多地方', '具體的數字 → 代數');
  await beat(tok, 2400);
  say('資料結構也一樣', '重點不是存什麼型態，而是它怎麼運作（essence）');
  await beat(tok, 3000);
}]);

// ════════ 84:10 Easy change of data structure ════════
FRAG.push(['contlin-swap-ds', '抽象化：功能一樣，實作可以抽換', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const c = code(['insert(id)', 'search(id)', 'for each id …'], -4.3, 3.0, 0.56, -3.0);
  tag('需要的功能', 'ptr', -4.3, 3.7, -3.0);
  const cost = tag('', 'ptr alt', 3.2, 2.6, -3.0);
  say('作業 2：把 user id 排好存起來', '用 array 還是 linked list？');
  await beat(tok, 2200);
  const ids = [12, 25, 31, 47];
  txt(cost, 'Array：insert O(n)、search O(log n)');
  const A = arrRow(ids, 5, 0.8, { dx: 1.4, drop: 4 });
  await beat(tok, 1400);
  c.hl(0);
  say('array 插入 30：後面要往後搬', '');
  move(A.cs[3], A.xs[4], 0.4, 0.8);
  await beat(tok, 700);
  const n30 = cube(30, C_O, [1.1, 0.7, 0.85], A.xs[3], 0.4, 0.8, 4);
  await beat(tok, 1400);
  c.hl(1);
  say('search：可以 binary search', '');
  glow(A.cs[2], GOLD); await beat(tok, 1300); glow(A.cs[2], null);
  c.hl(-1);
  say('換一個實作試試看', '外面要的功能完全一樣');
  [...A.cs.slice(0, 4), n30].forEach((m) => fly(m, V3(0, 8, 5))); A.tiles.forEach(kill);
  await beat(tok, 900);
  txt(cost, 'Linked list：insert O(1)、search O(n)');
  const xs = [-5, -2.4, 0.2, 2.8];
  const ns = ids.map((v, i) => sn(v, xs[i], 0.8, null, 3 + i * 0.3));
  const ls = [0, 1, 2].map((i) => sl(xs[i], 0.8, xs[i + 1], 0.8));
  await beat(tok, 1200);
  c.hl(0);
  say('linked list 插入 30：改指標就好', '');
  sn(30, 1.5, 3.0, C_O, 4); kill(ls[2]); sl(xs[2], 0.8, 1.5, 3.0); sl(1.5, 3.0, xs[3], 0.8);
  await beat(tok, 1600);
  c.hl(1);
  say('search：只能從頭走', '');
  for (let i = 0; i < 3; i++) { glow(ns[i].userData.data, GOLD); await beat(tok, 450); glow(ns[i].userData.data, null); }
  c.hl(-1);
  say('只看「能做什麼」，不看「怎麼做」', 'functionality abstraction → 容易抽換、交叉測試');
  await beat(tok, 3000);
}]);

// ════════ 87:56 Vector：index access 的功能 ════════
FRAG.push(['contlin-vector-adt', 'Vector：支援 index access 的就是 vector', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0.2]);
  const c = code(['at(i)         // get at index', 'set(i, v)     // put to index', 'insert(i, v)', 'erase(i)'], -2.2, 3.4, 0.56, -3.0);
  tag('Vector（課本的抽象家族，不是 STL vector）', 'ptr', 2.2, 3.4, -3.0);
  let vals = [4, 8, 2, 6, 1, 5];
  const A = arrRow(vals, 7, 0.8, { dx: 1.3, drop: 4 });
  const cs = A.cs.slice(0, 6);
  say('dense、sparse 儲存方式不同', '但都支援 indexed（random）access');
  await beat(tok, 2400);
  c.hl(0); glow(cs[2], GOLD);
  say('at(2)：拿出第 2 格', '= 2');
  await beat(tok, 1800);
  c.hl(1); relabel(cs[2], 9);
  say('set(2, 9)：放進第 2 格', 'A[2] = 9');
  await beat(tok, 1800);
  glow(cs[2], null);
  c.hl(2);
  for (let i = 5; i >= 1; i--) move(cs[i], A.xs[i + 1], 0.4, 0.8);
  await beat(tok, 700);
  const n7 = cube(7, colorFor(7), [1.04, 0.7, 0.85], A.xs[1], 0.4, 0.8, 4);
  cs.splice(1, 0, n7);
  say('insert(1, 7)：用 index 指定位置插入', '');
  await beat(tok, 1800);
  c.hl(3);
  const gone = cs.splice(3, 1)[0]; fly(gone, V3(0, 8, 4));
  for (let i = 3; i < cs.length; i++) move(cs[i], A.xs[i], 0.4, 0.8);
  say('erase(3)：用 index 刪除', '');
  await beat(tok, 1800);
  c.hl(-1);
  say('支援這些功能的，都叫 vector', '快慢、空間多少都不拘');
  await beat(tok, 3000);
}]);

// ════════ 90:27／128:05 Vector 家族 ════════
FRAG.push(['contlin-vector-family', 'Vector 家族：dense、sparse、extendable', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, 0]);
  const top = cube('Vector：index access', C_K, [5.2, 0.6, 1.2], 0, 2.6, -2.4, 3);
  say('vector：只問「能不能用 index 存取」', 'at、set、insert、erase');
  await beat(tok, 2200);
  const mem = [['Dense Array', -4.4, C_B, '快速版：O(1) index access'], ['Sparse Array', 0, C_G, 'storage saving 版：Θ(nnz)'], ['Extendable Array', 4.4, C_O, 'dynamic 版：滿了會長大']];
  const ms = [];
  for (const [n, x, col, d] of mem) {
    ms.push(cube(n, col, [3.6, 0.6, 1.1], x, 0.3, 1.2, 4));
    arrow(V3(x * 0.35, 2.25, -1.8), V3(x, 0.7, 0.7), A_GOLD);
    tag(d, 'idx', x, 0, 2.2);
    say(n + '：' + d.split('：')[0], d.split('：')[1]);
    await beat(tok, 2000);
  }
  glow(ms[2], GOLD);
  say('C++ STL vector 其實是 extendable array', '一樣支援 at、set、insert、erase，再加上 extendable');
  await beat(tok, 2800);
  glow(ms[2], null);
  const ll = cube('Linked List（硬做）', C_X, [3.6, 0.6, 1.1], 0, 0.3, 4.2, 4);
  say('linked list 硬要做 index access 也行', '只是一個很慢的 vector');
  await beat(tok, 2400);
  say('介面一致，就能換著試', '不同取向的 vector，一家人');
  await beat(tok, 3000);
}]);

// ════════ 95:14 Extendable array：overflow → grow ════════
FRAG.push(['contlin-grow', 'Extendable array：滿了就 allocate、copy、換掉', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.2, 0.2]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  const A = arrRow(V, 10, -1.6, { drop: 4, idx: false });
  const la = tag('A', 'ptr', -6.2, 0.6, -1.6);
  say('array 只畫了 10 個位置', '');
  await beat(tok, 1800);
  const x11 = cube(11, C_O, [0.88, 0.7, 0.85], 0, 0.4, -4.0, 3);
  tint(x11, '#c0392b');
  say('第 11 個塞不進去：overflow', '和 stack overflow 一樣，塞爆了');
  await beat(tok, 2200);
  say('① allocate 新的 array B', '找一塊連續記憶體：≈ O(1)');
  const B = arrRow([], 15, 1.6, { dx: 0.85, idx: false });
  const lb = tag('B', 'ptr', -6.6, 0.6, 1.6);
  await beat(tok, 2000);
  const cnt = tag('copy 0 個', 'ptr alt', 3.2, 1.8, 0);
  say('② copy contents：A 搬到 B', '有 n 個就搬 n 次 → O(n)，最花力氣');
  const copies = [];
  for (let i = 0; i < 10; i++) {
    const m = cube(V[i], colorFor(V[i]), [0.7, 0.7, 0.8], A.xs[i], 0.4, -1.6);
    move(m, B.xs[i], 0.4, 1.6); copies.push(m);
    txt(cnt, 'copy ' + (i + 1) + ' 個');
    await beat(tok, 280);
  }
  await beat(tok, 900);
  say('③ remove A，assign B to A', '舊櫃子丟掉，新櫃子繼續用');
  A.cs.forEach((m) => fly(m, V3(0, 7, -4))); A.tiles.forEach(kill); kill(la);
  txt(lb, 'A');
  await beat(tok, 1600);
  tint(x11, C_O); move(x11, B.xs[10], 0.4, 1.6);
  say('第 11 個終於放得進去', 'grow = allocate → copy → remove／assign');
  await beat(tok, 3000);
}]);

// ════════ 100:22 兩種 grow 策略 ════════
FRAG.push(['contlin-grow-choices', 'Grow 的兩種選擇：+1 還是 ×2', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.2, 0.4]);
  arrRow([1, 2, 3, 4], 4, -2.6, { dx: 1.1, drop: 4, idx: false, x0: -5.2 });
  tag('滿了（size 4）', 'ptr', 1.4, 0.6, -2.6);
  say('把 array 當 stack：push m 個進去', '看看兩種 grow 方法的效率');
  await beat(tok, 2600);
  say('選擇 A：每次只多要一格', '勤儉持家：要多少拿多少');
  arrRow([1, 2, 3, 4, 5], 5, 0.2, { dx: 1.1, drop: 3, idx: false, x0: -5.2 });
  tag('A：size 4 → 5', 'ptr', 1.9, 0.6, 0.2);
  await beat(tok, 2600);
  say('選擇 B：一次豪氣漲兩倍', '');
  arrRow([1, 2, 3, 4, 5], 8, 2.8, { dx: 1.1, drop: 3, idx: false, x0: -5.2 });
  tag('B：size 4 → 8', 'ptr alt', 4.2, 1.4, 2.8);
  await beat(tok, 2600);
  say('分析：一開始 size 1，一個一個 push', 'n = 1, 2, 3, …, m');
  await beat(tok, 3000);
}]);

// ════════ 103:15／106:41 實際跑：+1 與 ×2 ════════
async function growDemo(tok, dbl) {
  fresh([0, 8, 11], [0, 0.3, 0.6]);
  const m = dbl ? 9 : 6, capMax = dbl ? 16 : 6, dx = dbl ? 0.8 : 1.3;
  const x0 = -(capMax - 1) * dx / 2, xOf = (i) => x0 + i * dx;
  let cap = 1, tiles = [], copies = 0, allocs = 0;
  const items = [], parts = [];
  const drawTiles = () => { tiles.forEach(kill); tiles = []; for (let i = 0; i < cap; i++) tiles.push(cell(xOf(i), 0, dx * 0.9, 1.0)); };
  drawTiles();
  const info = tag('', 'ptr', 0, 2.6, 0), sumT = tag('', 'ptr alt', 0, 2.0, 1.6);
  say(dbl ? '每次漲兩倍：從 size 1 開始' : '每次多一格：從 size 1 開始', '一個一個 push 進去');
  await beat(tok, 1600);
  for (let n = 1; n <= m; n++) {
    if (n > cap) {
      const old = cap, nc = dbl ? cap * 2 : cap + 1;
      items.forEach((c) => glow(c, RED));
      say('放第 ' + n + ' 個：滿了！', 'allocate size ' + nc + '，copy ' + old + ' 個');
      await beat(tok, 900);
      cap = nc; allocs++; drawTiles();
      copies += old; parts.push(old);
      items.forEach((c) => glow(c, GOLD));
      await beat(tok, dbl ? 900 : 800);
      items.forEach((c) => glow(c, null));
    } else if (n > 1) say('放第 ' + n + ' 個：還有空位', 'size ' + cap + '，不用 copy');
    items.push(cube(n, colorFor(n), [dx * 0.75, 0.6, 0.8], xOf(n - 1), 0.38, 0, 3));
    txt(info, 'n = ' + n + '，size = ' + cap + '，allocate ' + allocs + ' 次');
    txt(sumT, 'copy：' + (parts.length ? parts.join(' + ') + ' = ' + copies : '0'));
    await beat(tok, dbl ? 800 : 1000);
  }
  if (dbl) {
    say('到 2^k 之前只 allocate k 次', 'copy：1 + 2 + 4 + … + 2^(k−1) = 2^k − 1 ≈ m');
  } else {
    say('每一輪都滿：最後要 copy m − 1 個', 'allocate m − 1 次；copy 1 + 2 + … + (m − 1)');
    await beat(tok, 2600);
    say('總共的力氣', 'm(m − 1) / 2 = Θ(m²)');
  }
  await beat(tok, 3200);
}
FRAG.push(['contlin-grow-plus1', '每次 +1：copy 1+2+…+(m−1) = Θ(m²)', async (tok) => { await growDemo(tok, false); }]);
FRAG.push(['contlin-grow-double', '每次 ×2：copy 1+2+4+… ≈ m', async (tok) => { await growDemo(tok, true); }]);

// ════════ 110:30 比較：平均每次 O(1) ════════
FRAG.push(['contlin-amortized', '攤平來看：×2 平均每次 O(1)', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const M = 16, dx = 0.72, x0 = -5.0, s = 0.2;
  tag('每次 +1', 'ptr', -6.3, 0.4, -1.8); tag('每次 ×2', 'ptr alt', -6.3, 0.4, 1.8);
  const isP2 = (k) => k > 0 && (k & (k - 1)) === 0;
  let t1 = 0, t2 = 0;
  const tot1 = tag('', 'idx', 4.0, 4.4, -1.8), tot2 = tag('', 'idx', 4.0, 4.4, 1.8);
  const spikes = [];
  say('第 i 次 push 花多少力氣？', '高度 = copy 數 + 寫入 1');
  for (let i = 1; i <= M; i++) {
    const c1 = i, c2 = 1 + (i > 1 && isP2(i - 1) ? i - 1 : 0);
    t1 += c1; t2 += c2;
    const x = x0 + (i - 1) * dx;
    cube('', C_B, [0.5, c1 * s, 0.8], x, c1 * s / 2, -1.8);
    const b = cube('', C_O, [0.5, c2 * s, 0.8], x, c2 * s / 2, 1.8);
    if (c2 > 1) spikes.push(b);
    txt(tot1, '總共 ' + t1); txt(tot2, '總共 ' + t2);
    await beat(tok, 260);
  }
  await beat(tok, 800);
  say('+1：越來越貴', 'm 個總共 ≈ m²/2 → 平均每次 O(m)');
  await beat(tok, 2600);
  say('×2：偶爾一根高，其他都是 1', 'copy 總數 ≈ m → 平均每次 O(1)');
  await beat(tok, 2600);
  spikes.forEach((b) => glow(b, RED));
  say('缺點：漲的那一下要等很久', '力氣全集中在那個時間點');
  await beat(tok, 2600);
  spikes.forEach((b) => glow(b, null));
  say('+1 用多少拿多少，比較省記憶體', 'C++ STL vector：用倍數成長的版本');
  await beat(tok, 2600);
  say('把偶爾的大花費攤平到每次操作', 'amortized 分析：每次 push 攤銷 O(1)');
  await beat(tok, 3000);
}]);

// ════════ 116:02 小 array 用 linked list 串起來 ════════
FRAG.push(['contlin-deque-blocks', '把小 array 用 linked list 串起來', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.4]);
  say('copy 好浪費：能不能切成小 array？', '再用 linked list 連在一起');
  const bx = [-4.4, 0, 4.4], dx = 0.85, blocks = [];
  for (let b = 0; b < 3; b++) {
    const xs = [0, 1, 2, 3].map((k) => bx[b] - 1.5 * dx + k * dx);
    const vs = [0, 1, 2, 3].map((k) => b * 4 + k);
    blocks.push(xs.map((x, k) => { cell(x, 0, dx * 0.92, 1.0); tag('[' + vs[k] + ']', 'idx', x, 0, 0.85); return cube(vs[k], colorFor(vs[k]), [0.68, 0.7, 0.8], x, 0.4, 0, 3 + b * 0.5 + k * 0.15); }));
    await beat(tok, 600);
  }
  for (let b = 0; b < 2; b++) {
    arrow(V3(bx[b] + 1.85, 0.55, 0), V3(bx[b + 1] - 1.85, 0.55, 0));
    arrow(V3(bx[b + 1] - 1.85, 0.2, 0), V3(bx[b] + 1.85, 0.2, 0), A_GOLD);
  }
  say('STL 的 deque 就是這種想法', '每塊記憶體集中 → cache 效率好；又有 linked list 的彈性');
  await beat(tok, 2800);
  say('要第 9 個：先一塊一塊走過去', '跨 block 時 random access 沒那麼快');
  const cur = tag('block', 'ptr alt', bx[0], 1.8, 0);
  for (let b = 0; b < 3; b++) { cur.position.x = bx[b]; await beat(tok, 800); }
  glow(blocks[2][1], GOLD);
  say('block 裡面再直接用 offset 跳到', '9 = 第 2 塊的第 1 格');
  await beat(tok, 2400);
  say('介於 array 和 linked list 之間', 'trade-off（實際 STL 用指標陣列管 block，仍 O(1)）');
  await beat(tok, 3000);
}]);

// ════════ 117:28 需求一路往上加 ════════
FRAG.push(['contlin-need-ladder', '需求一層一層加：index access → fast → extendable', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.4, 0]);
  const steps = [[-4.2, 1, C_B, 'random access', '功能需求：用編號放、用編號拿', '先要吃飽'],
    [0, 2, C_G, '＋ fast', '集中的記憶體：addr = base + i × size → dense array', '還要好吃'],
    [4.2, 3, C_O, '＋ extendable', '滿了就長大：每次漲一倍，copy 攤平', '需求再往上加']];
  for (const [x, h, col, name, f, cap] of steps) {
    for (let k = 0; k < h; k++) cube(k === h - 1 ? name : '', col, [3.6, 0.8, 2.0], x, 0.4 + k * 0.8, 0, 3 + k * 0.4);
    say(cap + '：' + name, f);
    await beat(tok, 3200);
  }
  say('從 motivation 到設計出來的資料結構', '需求越多，越要考慮 trade-off');
  await beat(tok, 3200);
}]);

// ════════ 129:24 List 家族 ════════
FRAG.push(['contlin-list-adt', 'List：靠 position 一個一個走', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0.4]);
  const c = code(['begin()            → head', 'end()              → NULL', 'next(p)            → p->next', 'element(p)         → p->data', 'insertAfter(p, e)', 'remove(p)'], -2.2, 3.9, 0.52, -3.0);
  tag('List', 'ptr', 3.6, 3.9, -3.0);
  const xs = [-4.5, -1.5, 1.5, 4.5], vals = [3, 7, 1, 9], z = 1.0;
  const ns = vals.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  const ls = [0, 1, 2].map((i) => sl(xs[i], z, xs[i + 1], z));
  const nul = tag('NULL', 'idx', xs[3] + 1.6, 0.35, z);
  say('doubly、singly 的共同功能：list', 'sequential／positional access');
  await beat(tok, 2600);
  c.hl(0);
  const p = tag('p', 'ptr alt', xs[0], 1.6, z);
  say('從哪裡開始走：begin', 'p = head');
  await beat(tok, 1600);
  c.hl(2);
  say('下一個：順著 next 的紙條', 'p = p->next');
  for (let i = 1; i < 4; i++) { p.position.x = xs[i]; await beat(tok, 700); }
  c.hl(3); glow(ns[3].userData.data, GOLD);
  say('用 position 拿 element', '像「排在第幾個位置的人」');
  await beat(tok, 1800);
  glow(ns[3].userData.data, null);
  c.hl(1); p.position.x = xs[3] + 1.6;
  say('走完了沒：p == end', 'singly linked list：p == NULL');
  await beat(tok, 1800);
  c.hl(4); p.position.x = xs[1];
  say('insert 到某個 position', 'insertAfter(p, 5)');
  sn(5, 0, 3.0, C_O, 4); kill(ls[1]); sl(xs[1], z, 0, 3.0); sl(0, 3.0, xs[2], z);
  await beat(tok, 2200);
  c.hl(5);
  say('remove：singly 要找前一個，doubly 容易', '這裡兩者難度差最多');
  await beat(tok, 2600);
  c.hl(-1); showL(nul, true);
  say('vector 靠 index，list 靠 position', '');
  await beat(tok, 2800);
}]);

// ════════ 133:59 Dense array 也是 list ════════
FRAG.push(['contlin-array-as-list', 'Dense array 也能當 list：position = address', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const A = arrRow([4, 8, 2, 6, 1], 5, -1.6, { dx: 1.4, base: 1000, drop: 4 });
  tag('dense array：address 連續', 'ptr', -5.4, 1.0, -3.2);
  say('dense array 也支援 list 的所有功能', '只是 insert／remove 慢一點');
  await beat(tok, 2400);
  const p = tag('p = 1000（begin）', 'ptr alt', A.xs[0], 1.7, -1.6);
  say('position 就是 address', 'begin = array 開頭的 address');
  await beat(tok, 2000);
  for (let i = 1; i < 5; i++) { p.position.x = A.xs[i]; txt(p, 'p = ' + (1000 + i * 4)); say('next：address ++', 'int 往前 4 bytes'); glow(A.cs[i], GOLD); await beat(tok, 700); glow(A.cs[i], null); }
  const ghost = ghostBox(C_X, 1.2, 0.7, 0.85); ghost.position.set(A.xs[4] + 1.4, 0.4, -1.6);
  tag('1020', 'idx', A.xs[4] + 1.4, 0, -0.75);
  p.position.x = A.xs[4] + 1.4; txt(p, 'p = 1020 = end');
  say('end = array + length', '走出最後一格就是結尾');
  await beat(tok, 2400);
  tag('linked list：address 不連續，靠 next 紙條', 'ptr', -4.2, 1.0, 1.4);
  const xs = [-4.5, -1.5, 1.5, 4.5], ad = ['0x3A0', '0x120', '0x7F8', '0x210'];
  xs.forEach((x, i) => { sn([4, 8, 2, 6][i], x, 2.6, null, 3 + i * 0.3); tag(ad[i], 'idx', x, 0, 3.4); if (i < 3) sl(x, 2.6, xs[i + 1], 2.6); });
  say('差別只在 address 連不連續', '功能上都是 list');
  await beat(tok, 2600);
  say('vector：幾號櫃子；list：排第幾個的人', 'concrete implementation 各自支援不同功能');
  await beat(tok, 3000);
}]);

// ════════ 137:02 Iterator：同一份 for 迴圈 ════════
FRAG.push(['contlin-iterator', 'Iterator：同一個迴圈跑 array 與 linked list', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.6, 0.4]);
  const c = code(['sum = 0;', 'for (p = c.begin(); p != c.end(); p = next(p))', '    sum += element(p);'], 0, 3.7, 0.56, -3.4);
  const V = [3, 1, 4, 2];
  const A = arrRow(V, 4, -0.8, { dx: 1.1, x0: -3.6, base: 1000, drop: 4 });
  tag('dense array', 'ptr', -5.6, 0.6, -0.8);
  const xs = [-3.6, -0.9, 1.8, 4.5], z = 2.2;
  const ns = V.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  [0, 1, 2].forEach((i) => sl(xs[i], z, xs[i + 1], z));
  tag('linked list', 'ptr', -5.6, 0.6, z); tag('NULL', 'idx', xs[3] + 1.6, 0.35, z);
  say('想只寫一個程式，把 container 裡的東西加起來', '不管底下是哪種 container');
  await beat(tok, 2600);
  c.hl(1);
  const pa = tag('p', 'ptr alt', A.xs[0], 1.7, -0.8), pl = tag('p', 'ptr alt', xs[0], 1.6, z);
  const sa = tag('sum = 0', 'idx', 5.6, 0.6, -0.8), sm = tag('sum = 0', 'idx', 5.6, 1.3, z);
  say('begin：arr[0] 的位置 vs head', '');
  await beat(tok, 1800);
  let s = 0;
  for (let i = 0; i < 4; i++) {
    c.hl(2); s += V[i]; txt(sa, 'sum = ' + s); txt(sm, 'sum = ' + s);
    glow(A.cs[i], GOLD); glow(ns[i].userData.data, GOLD);
    say('element(p)：取出內容加起來', 'sum = ' + s);
    await beat(tok, 900);
    glow(A.cs[i], null); glow(ns[i].userData.data, null);
    c.hl(1);
    pa.position.x = A.xs[i] + 1.1; pl.position.x = i < 3 ? xs[i + 1] : xs[3] + 1.6;
    say('next：p++（address + 4） vs p->next', '');
    await beat(tok, 900);
  }
  say('end：arr[n]（已經過頭） vs NULL', '迴圈結束，兩邊 sum 都是 ' + s);
  await beat(tok, 2400);
  c.hl(-1);
  say('這裡 p 的角色就叫 iterator', '把「位置」抽象化');
  await beat(tok, 3000);
}]);

// ════════ 142:13 C++ STL iterator ════════
FRAG.push(['contlin-stl-iterator', 'C++ STL：list<int>::iterator 換成 vector', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.6, 0.4]);
  const L = ['list<int> c;', 'list<int>::iterator p;', 'for (p = c.begin(); p != c.end(); p++)', '    sum += *p;'];
  const c = code(L, 0, 3.8, 0.56, -3.2);
  const W = Math.max(...L.map((x) => x.length));
  const xs = [-3.9, -1.3, 1.3, 3.9], V = [3, 1, 4, 2], z = 1.0;
  const ns = V.map((v, i) => dn(v, xs[i], z, null, 3 + i * 0.3));
  dlinks(xs, z);
  c.hl(0);
  say('STL 的 list 是 doubly linked list', 'list<int>：裝 int 的 doubly linked list');
  await beat(tok, 2400);
  c.hl(2);
  const p = tag('p', 'ptr alt', xs[0], 1.7, z);
  say('p++：operator overloading', '其實是呼叫 next，順著 next 走');
  for (let i = 0; i < 4; i++) {
    c.hl(3); glow(ns[i].userData.data, GOLD);
    say('*p：只拿那個位置的 content', '不是整個 node');
    await beat(tok, 900); glow(ns[i].userData.data, null);
    c.hl(2); if (i < 3) p.position.x = xs[i + 1];
    await beat(tok, 500);
  }
  kill(p);
  say('想換成 vector？只改型別', '');
  txt(c.ls[0], 'vector<int> c;'.padEnd(W, ' ')); txt(c.ls[1], 'vector<int>::iterator p;'.padEnd(W, ' '));
  c.hl(0);
  ns.forEach((g) => fly(g, V3(0, 8, 4)));
  await beat(tok, 700);
  lab.world.children.filter((o) => o.type === 'ArrowHelper').forEach((o) => lab.world.remove(o));
  const A = arrRow(V, 4, z, { dx: 1.3, base: 1000, drop: 4 });
  await beat(tok, 1600);
  c.hl(2);
  const q = tag('p', 'ptr alt', A.xs[0], 1.7, z);
  say('同一行 p++，這次是 address + 4', '其他程式碼不用變');
  for (let i = 1; i < 4; i++) { q.position.x = A.xs[i]; await beat(tok, 700); }
  c.hl(-1);
  say('iterator：更安全、更複雜一點的 pointer', '支援 list 功能的 container 都有 iterator');
  await beat(tok, 3000);
}]);

// ════════ 149:43 Q&A：iterator 細節 ════════
FRAG.push(['contlin-iter-end', 'Iterator 細節：end 不用配置、*p 只取內容', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.3]);
  const A = arrRow([4, 8, 2, 6, 1], 5, -1.4, { dx: 1.4, x0: -4.6, base: 5546, drop: 4 });
  say('iterator 不一定要用 address 實作', '用 index 也行：存取時再算 index → address');
  await beat(tok, 2600);
  const ex = A.xs[4] + 1.4;
  const g = ghostBox(C_X, 1.2, 0.7, 0.85); g.position.set(ex, 0.4, -1.4);
  tag('5566', 'idx', ex, 0, -0.55);
  const p = tag('end', 'ptr alt', ex, 1.6, -1.4);
  say('end 那一格要多配置嗎？不用', '走到 5566 就是「出了家門口」');
  await beat(tok, 2600);
  say('沒 allocate，但可以拿位置來比較', 'p != c.end()');
  await beat(tok, 2200);
  txt(p, 'c.end()?');
  say('每輪都呼叫 end() 會多一點時間', 'flexibility vs running-time overhead');
  await beat(tok, 2400);
  say('compiler 會把簡單的 function inline', '把呼叫直接換成程式碼，減少 overhead');
  await beat(tok, 2400);
  const nd = sn(9, -1.0, 2.0, C_B, 3);
  tag('p', 'ptr alt', -1.0, 1.4, 2.0);
  await beat(tok, 900);
  glow(nd.userData.data, GOLD);
  say('*p 是被 overload 的 dereference', '在 linked list：只取 node 裡的 content（9）');
  await beat(tok, 2400);
  say('不是拿到整個 node', '和直接用 address 取值的意思不完全一樣');
  await beat(tok, 3000);
}]);
  }

  // ═══ engmisc.js ═══
  {
// ─── engmisc：akErwS16DUg（Linked List 入門）、PdvGEI-P3-M（Stack vs Heap）、ygK0YON10sQ（Recursion 與 Stack） ───
const C_STACK = '#4b9ee2', C_HEAP = '#2fc092', C_CODE = '#c08a1f', C_LINK = '#d8c29b';
// arrow from node g1's link box to node g2's data box (lnode groups)
function llink(g1, g2) {
  return arrow(V3(g1.position.x + 0.96, g1.position.y, g1.position.z), V3(g2.position.x - 0.52, g2.position.y, g2.position.z));
}
function nullAfter(g) { return tag('NULL', 'idx', g.position.x + 1.5, g.position.y, g.position.z); }
function ring(r = 0.8) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; lab.world.add(m); return m;
}
// a translucent memory region with a title
function region(name, color, x, w, h = 5.4, d = 2.6, z = 0) {
  const g = ghostBox(color, w, h, d); g.position.set(x, h / 2, z);
  tag(name, 'ptr', x, h + 0.4, z);
  return g;
}

// ════════ akErwS16DUg：陣列的問題 → Linked List ════════
FRAG.push(['engmisc-array-fixed', '陣列大小固定的問題', async (tok) => {
  fresh([0, 6, 13], [0, 1, 0]);
  const decl = tag('int A[10];', 'ptr alt', 0, 3.2, 0);
  const slots = [];
  for (let i = 0; i < 10; i++) {
    const g = ghostBox('#c9b48e', 0.9, 0.8, 0.9); g.position.set(-4.5 + i, 0.4, 0); slots.push(g);
    tag('[' + i + ']', 'idx', -4.5 + i, 0, 0.9);
  }
  say('宣告陣列時就要給大小', 'int A[10]：之後不能變大、也不能變小');
  await beat(tok, 2400);
  const cs = [];
  for (let i = 0; i < 10; i++) { cs.push(cube('e' + (i + 1), C_STACK, [0.8, 0.7, 0.8], -4.5 + i, 0.35, 0, 4)); await beat(tok, 220); }
  const extra = cube('e11', '#c0563a', [0.8, 0.7, 0.8], 5.8, 0.35, 0, 4);
  await beat(tok, 600);
  glow(extra, RED);
  say('執行時來了第 11 個：放不下', '使用者輸入幾個，寫程式時根本不知道');
  await beat(tok, 2200);
  fly(extra, V3(3, 8, 4));
  for (let i = 3; i < 10; i++) fly(cs[i], V3(0, 8, 4));
  await beat(tok, 900);
  for (let i = 3; i < 10; i++) tint(slots[i], '#c0563a');
  say('只有 2、3 個元素：大部分空間浪費', '7 格空著');
  await beat(tok, 2400);
  txt(decl, 'int A[100];');
  say('改成 100 格？一樣有上限', '超過 100 個放不下，太少又浪費');
  await beat(tok, 2400);
  say('大小在 compile time 決定，元素數在 runtime 才知道', '這就是陣列的問題：fixed size');
  await beat(tok, 3000);
}]);

FRAG.push(['engmisc-array-stack-heap', '陣列在 Stack 與 Heap', async (tok) => {
  fresh([0, 7, 13], [0, 1.4, 0]);
  region('Stack（main 的 activation record）', C_STACK, -3.5, 5.2, 2.2, 4.2);
  region('Heap', C_HEAP, 3.5, 5.2, 2.2, 4.2);
  const cd = code(['int A[5];', 'int *p = new int[5];'], -0.2, 5.2);
  cd.hl(0);
  say('int A[5]：陣列直接建在 Stack', 'main 的 activation record 裡');
  const A = [];
  for (let i = 0; i < 5; i++) { A.push(cube('', C_STACK, [0.85, 0.6, 0.85], -5.4 + i * 0.95, 0.3, -0.8, 3)); tag('A[' + i + ']', 'idx', -5.4 + i * 0.95, 0, 0.1); await beat(tok, 200); }
  await beat(tok, 1400);
  cd.hl(1);
  const p = cube('p', '#f2c46d', [0.9, 0.6, 0.9], -3.5, 0.3, 1.3, 3);
  say('用 pointer p 在 Heap 配置 5 格', 'p = new int[5]');
  await beat(tok, 900);
  const H = [];
  for (let i = 0; i < 5; i++) { H.push(cube('', C_HEAP, [0.85, 0.6, 0.85], 1.6 + i * 0.95, 0.3, 0, 3)); tag('[' + i + ']', 'idx', 1.6 + i * 0.95, 0, 0.9); }
  await beat(tok, 600);
  arrow(V3(-3.05, 0.3, 1.3), V3(1.15, 0.3, 0.1));
  await beat(tok, 1600);
  cd.hl(-1);
  say('優點：所有格子連續、一格挨一格', '所以能用 index 直接存取');
  for (let i = 0; i < 5; i++) { glow(A[i], GOLD); glow(H[i], GOLD); await beat(tok, 300); glow(A[i]); glow(H[i]); }
  glow(A[3], GREEN);
  say('random access：直接跳到 A[3]', '位址 = 起點 + 3 × 元素大小');
  await beat(tok, 2200);
  glow(A[3]);
  say('就像 5 人座長椅：做好就固定容量', '人多坐不下，人少浪費位子');
  await beat(tok, 3000);
}]);

FRAG.push(['engmisc-ll-build', 'Linked List 的想法：每個元素自帶空間', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0]);
  region('Heap（runtime 動態配置）', C_HEAP, 0.6, 11.2, 1.6, 6);
  const first = cube('first', '#f2c46d', [1.1, 0.6, 0.9], -6, 0.3, 2.2);
  say('想要能變大、變小的資料結構', '在 Heap 配置記憶體 + 用 link 串起來');
  await beat(tok, 2600);
  say('先準備一個 pointer：first', '還沒有任何元素');
  await beat(tok, 1800);
  const n8 = lnode(8, -3.8, 0.4, -1.2, colorFor(8));
  let a0 = arrow(V3(-5.45, 0.3, 2.2), V3(-4.3, 0.4, -0.9));
  let nl = nullAfter(n8);
  say('存 8：配置空間給元素 + 指向下一個的 pointer', '後面還沒有東西 → NULL');
  await beat(tok, 2600);
  say('元素 + pointer 合起來叫一個 node', 'node = data + next');
  glow(n8.userData.data, GOLD); await beat(tok, 1600); glow(n8.userData.data);
  kill(nl);
  const n3 = lnode(3, -0.4, 0.4, 1.4, colorFor(3));
  const a1 = llink(n8, n3); nl = nullAfter(n3);
  say('再存 3：再建一個 node，前一個指向它', '8 → 3 → NULL');
  await beat(tok, 2400);
  kill(nl);
  const n12 = lnode(12, 3.2, 0.4, -1.0, colorFor(12));
  const a2 = llink(n3, n12); nl = nullAfter(n12);
  say('再存 12：要存一個元素就建一個 node', '8 → 3 → 12 → NULL');
  await beat(tok, 2400);
  say('像自己帶椅子來的人：一個接一個牽起來', 'node 散在 Heap 各處，靠 link 連起來');
  await beat(tok, 3000);
  void a0; void a1; void a2;
}]);

FRAG.push(['engmisc-ll-relink', '改 link 就能刪除與插入', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.5]);
  const first = tag('first', 'ptr', -6, 1.4, 0);
  const n8 = lnode(8, -4.5, 0.4, 0, colorFor(8)), n3 = lnode(3, -1.5, 0.4, 0, colorFor(3)), n12 = lnode(12, 3.5, 0.4, 0, colorFor(12));
  let a83 = llink(n8, n3), a312 = llink(n3, n12); const nl = nullAfter(n12);
  void first; void nl;
  say('8 → 3 → 12', '');
  await beat(tok, 1600);
  kill(a83); kill(a312);
  const a812 = llink(n8, n12);
  glow(n8.userData.data, GOLD);
  say('刪除 3：讓 8 改指向 12', '8.next = 3.next');
  await beat(tok, 2000);
  glow(n8.userData.data);
  move(n3, -1.5, 0.4, -2.6);
  await beat(tok, 900);
  say('3 被跳過，記憶體可以釋放', '只改了一個 link');
  await beat(tok, 1800);
  kill(a812);
  move(n3, -1.5, 0.4, 0);
  await beat(tok, 700);
  a83 = llink(n8, n3); a312 = llink(n3, n12);
  say('把 3 放回去', '8 → 3 → 12');
  await beat(tok, 1500);
  const n7 = lnode(7, 1.0, 0.4, 2.4, colorFor(7));
  say('在 3 和 12 之間插入 7：先建 node 7', '');
  await beat(tok, 1600);
  const a712 = llink(n7, n12);
  say('7 指向 12', '7.next = 3.next');
  await beat(tok, 1600);
  kill(a312);
  const a37 = llink(n3, n7);
  say('3 改指向 7', '3.next = 7');
  await beat(tok, 1800);
  void a712; void a37;
  const cur = ring();
  for (const g of [n8, n3, n7, n12]) {
    cur.position.set(g.position.x, 0.05, g.position.z);
    say('從 first 走：8 → 3 → 7 → 12', '走訪只能順著 link');
    await beat(tok, 800);
  }
  say('大小可增可減，插入／刪除只要改 link', 'Linked List 一律建在 Heap');
  await beat(tok, 3000);
}]);

FRAG.push(['engmisc-ll-address', 'Linked List 的位址與 head', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.3]);
  function anode(data, link, addr, x, z) {
    const d = cube(data, C_STACK, [1.0, 0.7, 1.0], x, 0.35, z, 3);
    const k = cube(link, C_LINK, [1.1, 0.7, 1.0], x + 1.05, 0.35, z, 3);
    tag('@' + addr, 'idx', x + 0.5, 1.15, z);
    return { d, k, x, z };
  }
  const f = cube('200', '#f2c46d', [1.0, 0.6, 0.9], -5.5, 0.3, 2.6);
  tag('first（head）@100', 'ptr', -5.5, 1.2, 2.6);
  say('Linked List：node 的集合', '每個 node = data + 指向下一個的 pointer');
  await beat(tok, 1600);
  const N = [anode(8, '210', 200, -4.8, -1.4), anode(3, '270', 210, -1.6, 0.9), anode('…', '300', 270, 1.4, -1.6), anode('…', 'NULL', 300, 4.4, 0.6)];
  arrow(V3(-5.5, 0.3, 2.1), V3(-4.9, 0.35, -0.85));
  await beat(tok, 700);
  for (let i = 0; i < 3; i++) arrow(V3(N[i].x + 1.6, 0.35, N[i].z), V3(N[i + 1].x - 0.5, 0.35, N[i + 1].z));
  say('first 存 200：指向第一個 node（head node）', 'first 自己的位址是 100');
  glow(f, GOLD); glow(N[0].d, GOLD);
  await beat(tok, 2400);
  glow(f); glow(N[0].d);
  say('node@200：data 8，link 存 210', '下一個 node 的位址 = 210');
  glow(N[0].k, GOLD); glow(N[1].d, GOLD);
  await beat(tok, 2400);
  glow(N[0].k); glow(N[1].d);
  say('node@210：data 3，link 存 270', '最後一個 node 的 link = NULL');
  glow(N[1].k, GOLD); await beat(tok, 2000); glow(N[1].k);
  say('位址不連續：200、210、270、300', '連續性靠 link（位址）維持');
  for (const n of N) { glow(n.d, GREEN); await beat(tok, 400); }
  await beat(tok, 800);
  for (let i = 0; i < 4; i++) { cube('', GRAY, [0.9, 0.4, 0.6], -1.5 + i * 0.95, 0.2, -4.2); tag(String(200 + 2 * i), 'idx', -1.5 + i * 0.95, 0.7, -4.2); }
  tag('陣列', 'ptr alt', -3, 0.6, -4.2);
  say('對照陣列：200、202、204… 一格挨一格', '陣列連續；Linked List 散在 Heap');
  await beat(tok, 3000);
}]);

FRAG.push(['engmisc-node-struct', '定義 node：self-referential structure', async (tok) => {
  fresh([0, 5, 12], [0, 2, 0]);
  const cd = code(['struct Node {', '    int data;', '    struct Node *next;', '};'], -3.6, 5.2);
  const d = cube('data', C_STACK, [2.0, 0.9, 1.2], 1.6, 0.45, 0);
  const n = cube('next', C_LINK, [2.0, 0.9, 1.2], 3.6, 0.45, 0);
  say('node 有兩個成員：data 和 next', 'data 可以是 int、float、double……');
  cd.hl(1); glow(d, GOLD);
  await beat(tok, 2400);
  glow(d); cd.hl(2); glow(n, GOLD);
  say('next 指向下一個 node：型別是 struct Node *', 'pointer 指向自己這種型別');
  await beat(tok, 2400);
  const g2 = lnode('', 5.6, 0.45, -2.2, '#9fb7cc');
  arrow(V3(4.6, 0.45, -0.3), V3(5.1, 0.45, -1.9));
  tag('self-referential structure', 'ptr alt', 0.5, 3.4, 0);
  say('自己參照自己的 structure', 'Linked List 就是靠它');
  await beat(tok, 2600);
  glow(n);
  say('C++ 也可以用 struct 或 class', 'class 預設 private；struct 預設 public');
  await beat(tok, 2600);
  cd.hl(-1);
  const bytes = [];
  for (let i = 0; i < 4; i++) { bytes.push(cube('', i < 2 ? C_STACK : C_LINK, [0.9, 0.3, 0.9], 1.1 + i * 1.0, 0.15, 2.2, 2)); tag(String(200 + i), 'idx', 1.1 + i * 1.0, 0.6, 3.0); await beat(tok, 300); }
  say('影片假設 int 2 bytes、pointer 2 bytes', 'sizeof(struct Node) = 2 + 2 = 4 bytes');
  await beat(tok, 2600);
  glow(bytes[0], GOLD);
  say('pointer 只記第一個 byte 的位址', 'node 的位址 = 200');
  await beat(tok, 2800);
  void g2;
}]);

FRAG.push(['engmisc-node-malloc', '建立 node 與存取成員', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  region('Stack', C_STACK, -4.6, 3.2, 1.4, 3);
  region('Heap', C_HEAP, 2.8, 6.4, 1.4, 3);
  const cd = code(['struct Node *p;', 'p = (struct Node *)malloc(sizeof(struct Node));', 'p = new Node;          // C++', 'p->data = 10;', 'p->next = 0;            // NULL'], -2.2, 6.0);
  cd.hl(0);
  const p = cube('p', '#f2c46d', [1.2, 0.7, 1.0], -4.6, 0.35, 0, 3);
  say('node 一定要建在 Heap：先準備 pointer p', 'struct Node *p;');
  await beat(tok, 2600);
  cd.hl(1);
  say('malloc 要 4 bytes：寫 sizeof(struct Node)', 'malloc 回傳 void *，要強制轉型');
  await beat(tok, 1400);
  const d = cube('', C_STACK, [1.2, 0.8, 1.2], 2.2, 0.4, 0, 4);
  const k = cube('', C_LINK, [1.2, 0.8, 1.2], 3.4, 0.4, 0, 4);
  tag('@500', 'idx', 2.8, 1.3, 0);
  tag('data', 'idx', 2.2, 0, 1.0); tag('next', 'idx', 3.4, 0, 1.0);
  await beat(tok, 900);
  relabel(p, '500');
  const a = arrow(V3(-3.95, 0.35, 0), V3(1.55, 0.4, 0));
  say('新 node 在 500，p 存 500 → p 指向它', '');
  await beat(tok, 2400);
  cd.hl(2);
  say('C++ 簡單多了', 'p = new Node;');
  await beat(tok, 2200);
  cd.hl(3);
  glow(d, GOLD);
  await beat(tok, 500);
  relabel(d, 10);
  say('p 是指向 structure 的 pointer：成員用 ->', 'p->data = 10');
  await beat(tok, 2400);
  glow(d); cd.hl(4); glow(k, GOLD);
  relabel(k, 'NULL');
  say('next 設 0（NULL）：不指向任何 node', 'p->next = 0');
  await beat(tok, 2600);
  glow(k); cd.hl(-1);
  void a;
  say('建立 node + 存取成員', 'malloc／new 配置，-> 存取');
  await beat(tok, 2600);
}]);

FRAG.push(['engmisc-ptr-move', 'q = p、q = p->next、p = p->next', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.6]);
  const xs = [-3.6, -0.6, 2.4, 5.4], addrs = [200, 210, 270, 300];
  const G = xs.map((x, i) => { const g = lnode('', x, 0.4, 0, '#9fb7cc'); tag('@' + addrs[i], 'idx', x + 0.3, 1.2, 0); return g; });
  for (let i = 0; i < 3; i++) llink(G[i], G[i + 1]);
  const pb = cube('200', '#f2c46d', [1.0, 0.6, 0.8], -6, 0.3, 2.8), qb = cube('', '#f2c46d', [1.0, 0.6, 0.8], -6, 0.3, 4.4);
  tag('p', 'ptr', -6.6, 1.0, 2.8); tag('q', 'ptr alt', -6.6, 1.0, 4.4);
  const pl = tag('p', 'ptr', xs[0], 0.4, 1.4), ql = tag('q', 'ptr alt', xs[0], 0.4, 2.2);
  showL(ql, false);
  const cd = code(['q = p;', 'q = p->next;', 'p = p->next;'], 0.8, 4.4);
  say('p 指向 node@200；另外有一個 pointer q', '');
  await beat(tok, 2200);
  cd.hl(0); relabel(qb, '200'); showL(ql, true);
  say('q = p：把 p 裡的 200 存進 q', '兩個 pointer 指向同一個 node');
  await beat(tok, 2800);
  cd.hl(1); glow(G[0].children[1], GOLD);
  await beat(tok, 900);
  relabel(qb, '210'); ql.position.set(xs[1], 0.4, 2.2);
  say('q = p->next：p 的 next 欄位是 210', 'q 指向 p 的下一個 node');
  await beat(tok, 2800);
  glow(G[0].children[1]);
  cd.hl(2);
  say('p = p->next：把 210 存回 p 自己', '');
  await beat(tok, 1500);
  relabel(pb, '210'); pl.position.set(xs[1], 0.4, 1.4);
  say('p 往下一個 node 移動', '走訪 Linked List 最常用的一行');
  await beat(tok, 2400);
  for (let i = 2; i < 4; i++) {
    relabel(pb, String(addrs[i])); pl.position.set(xs[i], 0.4, 1.4);
    say('一直 p = p->next，就能走過整串', 'p = ' + addrs[i]);
    await beat(tok, 1100);
  }
  cd.hl(-1);
  await beat(tok, 2000);
}]);

FRAG.push(['engmisc-null-check', '判斷 pointer 是不是 NULL', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.5, 0]);
  const p1 = cube('0', '#f2c46d', [1.2, 0.7, 1.0], -4.5, 0.35, 1.2); tag('情況一：p 不指向任何 node', 'ptr', -4.5, 1.3, 1.2);
  const p2 = cube('200', '#f2c46d', [1.2, 0.7, 1.0], 1.0, 0.35, 1.2); tag('情況二：p 指向某個 node', 'ptr', 1.0, 1.3, 1.2);
  const g = lnode('', 4.4, 0.4, 1.2, '#9fb7cc'); arrow(V3(1.65, 0.35, 1.2), V3(3.88, 0.4, 1.2));
  void g;
  say('p = 0 或 p = NULL：兩種寫法一樣', 'NULL = 位址 0');
  await beat(tok, 2600);
  say('C/C++：0 是 false，非 0 是 true', '情況一 p = 0 → false；情況二 p = 200 → true');
  glow(p2, GREEN); glow(p1, RED);
  await beat(tok, 2800);
  glow(p1); glow(p2);
  const cd = code(['if (p == NULL)', 'if (p == 0)', 'if (!p)', 'if (p != NULL)', 'if (p != 0)', 'if (p)'], 0, 5.4);
  const conds = [[0, p1, 'p 是 NULL 才成立'], [1, p1, 'p 是 0 才成立'], [2, p1, '!0 = true'], [3, p2, '反過來：p 有指向 node'], [4, p2, '非 0'], [5, p2, '200 非 0 → true']];
  for (const [i, box, why] of conds) {
    cd.hl(i); glow(box, GOLD);
    say(i < 3 ? '檢查 p 是不是 NULL（三種寫法）' : '檢查 p 有沒有指向 node（三種寫法）', cd.ls[i].element.textContent.trim() + ' → 情況' + (box === p1 ? '一' : '二') + '成立：' + why);
    await beat(tok, 1900);
    glow(box);
  }
  cd.hl(-1);
  say('三種寫法等價，看到都要認得', 'p == NULL ⇔ p == 0 ⇔ !p');
  await beat(tok, 2600);
}]);

FRAG.push(['engmisc-last-node', 'p->next == NULL：最後一個 node', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const xs = [-4.5, -1.2, 2.1];
  const G = xs.map((x) => lnode('', x, 0.4, 0, '#9fb7cc'));
  llink(G[0], G[1]); llink(G[1], G[2]); nullAfter(G[2]);
  const pl = tag('p', 'ptr', xs[1], 0.4, 1.3);
  const cd = code(['if (p->next == NULL)   // p 是最後一個', 'if (p->next != NULL)   // p 後面還有'], -0.6, 4.4);
  say('想知道 p 後面還有沒有 node', '看 p->next');
  await beat(tok, 2200);
  for (const [i, at] of [[0, 2], [1, 1]]) {
    pl.position.set(xs[at], 0.4, 1.3);
    cd.hl(i);
    glow(G[at].children[1], at === 2 ? GOLD : GREEN);
    say(at === 2 ? 'p 的 next 是 NULL → p 是最後一個 node' : 'p 的 next 有位址 → 後面還有 node',
      (at === 2 ? 'p->next == NULL' : 'p->next != NULL') + ' → true');
    await beat(tok, 3200);
    glow(G[at].children[1]);
  }
  pl.position.set(xs[0], 0.4, 1.3); cd.hl(1);
  say('走訪時常用：p->next != NULL 就繼續', '');
  await beat(tok, 2400);
  cd.hl(-1);
  say('分清楚兩種檢查', 'p == NULL：p 沒指向 node；p->next == NULL：p 是最後一個');
  await beat(tok, 3000);
}]);

// ════════ PdvGEI-P3-M：Stack vs Heap ════════
function memLayout() {
  region('Code', C_CODE, -4.3, 3.0, 5.2, 2.6);
  region('Stack', C_STACK, 0, 3.0, 5.2, 2.6);
  region('Heap', C_HEAP, 4.3, 3.0, 5.2, 2.6);
}
FRAG.push(['engmisc-mem-code', 'Main memory 與 code section', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  say('Main memory 分三區：Code、Stack、Heap', '');
  await beat(tok, 2400);
  const src = cube('C 程式', '#9fb7cc', [1.6, 0.8, 1.2], -6.2, 4.6, 3.2);
  say('寫好程式，裡面宣告了一些變數', 'int a, b, c; …');
  await beat(tok, 2000);
  relabel(src, '機器碼'); tint(src, '#7a6a52');
  say('compile：C 程式 → machine code', '');
  await beat(tok, 2000);
  move(src, -4.3, 0.4, 0);
  say('要執行：先把 machine code 載入 Code 區', '這個動作叫 loading（像把 DVD 放進播放器）');
  await beat(tok, 2600);
  kill(src);
  const ins = [];
  for (let i = 0; i < 4; i++) ins.push(cube('指令 ' + (i + 1), C_CODE, [2.4, 0.5, 1.6], -4.3, 0.25 + i * 0.55, 0));
  await beat(tok, 600);
  for (let i = 3; i >= 0; i--) {
    glow(ins[i], GOLD);
    say('CPU 一次拿一個指令來執行', '指令 ' + (4 - i));
    await beat(tok, 900);
    glow(ins[i]);
  }
  say('Code 區：放要執行的程式', '變數放哪？下一段：Stack');
  await beat(tok, 2600);
}]);

FRAG.push(['engmisc-mem-stack', 'Stack：靜態大小、直接存取', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  const prog = cube('main', C_CODE, [2.4, 1.2, 1.6], -4.3, 0.6, 0);
  void prog;
  const cd = code(['int a, b, c;'], -4.3, 6.4);
  say('程式宣告了三個變數 a、b、c', '記憶體從 Stack 配置');
  await beat(tok, 2200);
  const fr = ghostBox(C_STACK, 2.6, 2.0, 2.0); fr.position.set(0, 1.0, 0);
  const V = [];
  for (const [i, nm] of [[0, 'a'], [1, 'b'], [2, 'c']]) {
    V.push(cube(nm, C_STACK, [1.6, 0.55, 1.2], 0, 0.3 + i * 0.6, 0, 3));
    tag(String(1000 + 2 * i), 'idx', -1.7, 0.3 + i * 0.6, 0);
    await beat(tok, 450);
  }
  say('程式開始執行時才配置：allocation 是 runtime', '但要多少空間 compile time 就決定了');
  await beat(tok, 2800);
  say('size static，allocation dynamic', '大小由宣告的變數決定');
  await beat(tok, 2400);
  const ar = tag('main 的 activation record（stack frame）', 'ptr alt', 0, 2.5, 1.4);
  void ar;
  say('main 這一塊叫 activation record', '也叫 stack frame');
  await beat(tok, 2400);
  for (const v of V) {
    glow(v, GOLD);
    const a = arrow(V3(-3.0, 0.6, 0), V3(-0.85, v.position.y, 0));
    say('程式直接用位址存取 Stack', '例如 a 在 1000');
    await beat(tok, 900);
    kill(a); glow(v);
  }
  cd.hl(-1);
  say('Stack：直接存取、大小是靜態的', '');
  await beat(tok, 2800);
}]);

FRAG.push(['engmisc-mem-heap', 'Heap：透過 pointer 間接存取', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  cube('main', C_CODE, [2.4, 1.2, 1.6], -4.3, 0.6, 0);
  const cd = code(['int a, b, c;', 'int *p;', 'p = malloc(10);'], -4.3, 6.9);
  const block = cube('', '#c0563a', [0.5, 0.5, 0.5], 4.3, 1.5, 0);
  const x = tag('✗ 不能直接存取 Heap', 'ptr', 1.9, 3.6, 0);
  say('程式只能直接存取 Stack，不能直接碰 Heap', '');
  await beat(tok, 2400);
  kill(block); kill(x);
  say('為什麼要 Heap？執行時可能需要更多記憶體', '要多少由使用者在 runtime 決定');
  await beat(tok, 2600);
  cd.hl(0);
  for (let i = 0; i < 3; i++) cube('abc'[i], C_STACK, [1.6, 0.5, 1.2], 0, 0.3 + i * 0.55, 0, 3);
  await beat(tok, 600);
  cd.hl(1);
  const p = cube('p', '#f2c46d', [1.6, 0.5, 1.2], 0, 1.95, 0, 3);
  say('先宣告一個 pointer p（它也在 Stack）', 'int *p;');
  await beat(tok, 2400);
  cd.hl(2);
  const h = cube('10 bytes', C_HEAP, [2.4, 0.9, 1.6], 4.3, 0.45, 0, 4);
  tag('@5000', 'idx', 4.3, 1.3, 1.0);
  say('malloc(10)：在 Heap 配置 10 bytes', '起始位址 5000');
  await beat(tok, 2200);
  relabel(p, '5000');
  arrow(V3(0.85, 1.95, 0), V3(3.05, 0.6, 0));
  say('位址 5000 存進 p：p 指向這塊記憶體', 'p = 5000');
  await beat(tok, 2600);
  cd.hl(-1);
  glow(p, GOLD); say('程式先讀 p……', '');
  await beat(tok, 1200);
  glow(p); glow(h, GOLD); say('……再照 p 的位址去 Heap', '間接存取（indirect）');
  await beat(tok, 2000);
  glow(h);
  say('Heap：間接存取，大小在 runtime 決定', 'pointer 是存取 Heap 的必要工具');
  await beat(tok, 2800);
}]);

FRAG.push(['engmisc-mem-compare', 'Stack 與 Heap 的兩大差異', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  const s = cube('a b c p', C_STACK, [2.2, 0.9, 1.6], 0, 0.45, 0);
  const h = cube('malloc', C_HEAP, [2.2, 0.9, 1.6], 4.3, 0.45, 0);
  arrow(V3(1.15, 0.45, 0), V3(3.15, 0.45, 0));
  const rows = [
    ['差異一：存取方式', 'Stack 直接存取', 'Heap 透過 pointer 間接存取', s, h],
    ['差異二：大小何時決定', 'Stack 靜態（compile time，看宣告的變數）', 'Heap 動態（runtime，用 malloc）', s, h],
  ];
  for (const [cap, a, b, m1, m2] of rows) {
    glow(m1, GOLD); say(cap, a);
    await beat(tok, 2600);
    glow(m1); glow(m2, GOLD); say(cap, b);
    await beat(tok, 2600);
    glow(m2);
  }
  say('Heap 不是給變數用，而是 malloc + pointer', '要用 Heap 一定要有 pointer');
  await beat(tok, 3000);
}]);

// ════════ ygK0YON10sQ：Recursion 與 Stack ════════
function memLayout4() {
  region('OS', '#9b8b72', -5.25, 2.6, 5.2, 2.4);
  region('Code', C_CODE, -1.75, 2.6, 5.2, 2.4);
  region('Stack', C_STACK, 1.75, 2.6, 5.2, 2.4);
  region('Heap', C_HEAP, 5.25, 2.6, 5.2, 2.4);
}
FRAG.push(['engmisc-rec-memory', 'Main memory 與 activation record', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  const cd = code(['void main() {', '    int x = 10;    // data', '    x++;           // instruction', '}'], -2.2, 7.6, 0.5);
  say('程式分兩部分：變數 = data，其他敘述 = instructions', '');
  cd.hl(1); await beat(tok, 1600); cd.hl(2); await beat(tok, 1600); cd.hl(-1);
  memLayout4();
  say('Main memory：一部分給 OS，剩下分三區', 'Code／Stack／Heap');
  await beat(tok, 2600);
  const st = cube('global/static', '#e0a64a', [2.2, 0.5, 1.6], -1.75, 4.6, 0);
  void st;
  say('Code 區還有一小塊給 global／static 變數', 'Heap：動態配置記憶體用');
  await beat(tok, 2600);
  cube('main 機器碼', C_CODE, [2.2, 1.0, 1.6], -1.75, 0.5, 0, 4);
  say('執行：machine code 載入 Code 區', '');
  await beat(tok, 1800);
  const ar = cube('main：x = 10', C_STACK, [2.2, 0.8, 1.6], 1.75, 0.4, 0, 4);
  say('main 的變數放 Stack：這塊叫 activation record', '函式被呼叫時建立');
  await beat(tok, 2600);
  glow(ar, GOLD);
  arrow(V3(-0.6, 0.5, 0), V3(0.6, 0.4, 0));
  say('main 的指令執行時，到 Stack 取 x', '每個函式都有自己的 activation record');
  await beat(tok, 3000);
}]);

// shared stack-trace helpers for the recursion scenes
function traceStage(lines, yTop = 6.4) {
  const cd = code(lines, -3.8, yTop, 0.5);
  region('Stack', C_STACK, 2.3, 3.2, 5.0, 2.2);
  const out = tag('輸出：', 'ptr alt', 5.6, 5.8, 0);
  const frames = [];
  const push = (text) => { const f = cube(text, C_STACK, [2.8, 0.75, 1.6], 2.3, 0.4 + frames.length * 0.85, 0, 4); frames.forEach((g) => glow(g)); glow(f, GOLD); frames.push(f); return f; };
  const pop = () => { const f = frames.pop(); fly(f, V3(4, 8, 3)); if (frames.length) glow(frames[frames.length - 1], GOLD); };
  return { cd, out, frames, push, pop };
}

FRAG.push(['engmisc-rec-call', '函式呼叫：activation record 疊上去', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  const T = traceStage(['void A(int a) {', '    printf("%d", a);', '}', 'void main() {', '    int x = 10;', '    x++;', '    A(x);', '}']);
  T.cd.hl(4);
  const m = T.push('main：x = 10');
  say('main 開始：建立 main 的 activation record', '');
  await beat(tok, 2200);
  T.cd.hl(5); relabel(m, 'main：x = 11');
  say('x++', 'x = 11');
  await beat(tok, 1800);
  T.cd.hl(6);
  T.push('A：a = 11');
  say('呼叫 A(11)：A 的 activation record 疊在上面', 'main 還沒結束');
  await beat(tok, 2600);
  T.cd.hl(1);
  say('正在執行的函式只用最上面的 record', '');
  await beat(tok, 1600);
  txt(T.out, '輸出：11');
  say('A 印出 11', 'output = 11');
  await beat(tok, 2000);
  T.cd.hl(2); T.pop();
  say('A 結束：它的 record 刪掉', '');
  await beat(tok, 2000);
  T.cd.hl(7); T.pop();
  say('main 結束：Stack 清空', '');
  await beat(tok, 2000);
  T.cd.hl(-1);
  say('呼叫就建立、結束就刪除，一層疊一層', '執行中的函式用最上面那層');
  await beat(tok, 2800);
}]);

FRAG.push(['engmisc-rec-nested', '巢狀呼叫：main → A → B', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  const T = traceStage(['main 呼叫 A(11)', 'A 呼叫 B(22)', 'B 印出 k = 22']);
  T.push('main');
  say('main 的 record 先建立', '');
  await beat(tok, 1800);
  T.cd.hl(0); T.push('A：a = 11');
  say('main 呼叫 A(11)', 'A 的 record 疊上去');
  await beat(tok, 2000);
  T.cd.hl(1); T.push('B：k = 22');
  say('A 呼叫 B(22)', 'B 的 record 再疊上去');
  await beat(tok, 2000);
  T.cd.hl(2); txt(T.out, '輸出：22');
  say('B 印出 22', 'Stack：main、A、B');
  await beat(tok, 2000);
  T.cd.hl(-1);
  for (const nm of ['B', 'A', 'main']) {
    T.pop();
    say(nm + ' 結束：record 移除', '後呼叫的先結束（LIFO）');
    await beat(tok, 1500);
  }
  say('Stack 清空', '');
  await beat(tok, 2400);
}]);

async function recTrace(tok, printFirst) {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  const body = printFirst ? ['        printf("%d ", n);', '        A(n - 1);'] : ['        A(n - 1);', '        printf("%d ", n);'];
  const T = traceStage(['void A(int n) {', '    if (n > 0) {', ...body, '    }', '}', 'main() { A(3); }']);
  const L_IF = 1, L_PRINT = printFirst ? 2 : 3, L_CALL = printFirst ? 3 : 2;
  let out = '';
  T.push('main');
  T.cd.hl(6);
  say(printFirst ? '先印、再呼叫自己：tail recursion' : '先呼叫自己、再印', 'main 呼叫 A(3)');
  await beat(tok, 2200);
  for (let n = 3; n >= 0; n--) {
    T.push('A：n = ' + n);
    T.cd.hl(L_IF);
    say('新的 record：n = ' + n, n > 0 ? 'n > 0 成立' : '<span class="no">n > 0 不成立</span> → 結束');
    await beat(tok, 1400);
    if (n === 0) break;
    if (printFirst) {
      T.cd.hl(L_PRINT); out += n + ' '; txt(T.out, '輸出：' + out);
      say('印出 ' + n, '輸出：' + out);
      await beat(tok, 1200);
    }
    T.cd.hl(L_CALL);
    say('呼叫 A(' + (n - 1) + ')：舊 record 留著，還沒結束', '');
    await beat(tok, 1200);
  }
  T.pop();
  say('A(0) 結束，回到上一層呼叫', '');
  await beat(tok, 1500);
  for (let n = 1; n <= 3; n++) {
    if (!printFirst) {
      T.cd.hl(L_PRINT); out += n + ' '; txt(T.out, '輸出：' + out);
      say('回到 n = ' + n + ' 這層：接著印出 ' + n, '輸出：' + out);
      await beat(tok, 1600);
    } else {
      T.cd.hl(4);
      say('回到 n = ' + n + '：呼叫是最後一行，直接結束', '');
      await beat(tok, 1000);
    }
    T.pop();
    await beat(tok, 600);
  }
  T.cd.hl(-1); T.pop();
  say(printFirst ? '呼叫時就印：3 2 1' : '返回時才印：1 2 3', '最多同時 5 層 record：main + A(3)…A(0)');
  await beat(tok, 3000);
}
FRAG.push(['engmisc-rec-tail', '遞迴：先印再呼叫（印 3 2 1）', (tok) => recTrace(tok, true)]);
FRAG.push(['engmisc-rec-head', '遞迴：先呼叫再印（印 1 2 3）', (tok) => recTrace(tok, false)]);
  }

  // ═══ lllin.js ═══
  {
// ─── lllin：pAs8Swu1Y3Y（台大林軒田 DSA：Linked List 應用：Sparse Vector、Running Cursors、面試題） ───
const LB = '#4b9ee2', LR = '#e06a5a', LG = '#9a9080', LK = '#c08a1f';
const A_RED = 0xc0392b, A_GREEN = 0x2e8b57, A_GOLD = 0xc08a1f;
// a list node (data + link) that optionally drops in from dropH
function nd(lbl, x, y, z, color, dropH = 0) {
  const g = lnode(lbl, x, y + dropH, z, color);
  if (dropH > 0) lab.dropTo(lab.addBody(g), V3(x, y, z));
  return g;
}
// pointer arrow from the link box of a node at x1 to the data box of a node at x2 (same row)
function lk(x1, x2, z, y = 0.35, color) { return arrow(V3(x1 + 0.95, y, z), V3(x2 - 0.52, y, z), color); }
// sparse-vector rows: node x position by dimension (1..5)
const dx = (d) => -5.6 + (d - 1) * 2.6;
const V1 = [[3, 6], [5, 4]], V2 = [[1, 2], [4, 9], [5, -4]];
const pl = (p) => '(' + p[0] + ', ' + p[1] + ')';
// draw a whole sparse vector row; returns { ns, ars }
function sRow(vec, z, color, name, dropH = 0) {
  const ns = vec.map((p) => nd(pl(p), dx(p[0]), 0.35, z, color, dropH));
  const ars = [];
  for (let i = 0; i + 1 < vec.length; i++) ars.push(lk(dx(vec[i][0]), dx(vec[i + 1][0]), z));
  ars.push(tag('NULL', 'idx', dx(vec[vec.length - 1][0]) + 1.6, 0.35, z));
  tag(name, 'ptr', dx(vec[0][0]), 1.35, z);
  return { ns, ars };
}

// ════════ 15:15 回顧：singly / doubly ════════
FRAG.push(['lllin-recap', '回顧：Singly 與 Doubly Linked List', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 0.4, 0.3]);
  const vals = [3, 7, 1, 9], xs = [-4.5, -1.5, 1.5, 4.5];
  say('指標：指向記憶體位置的小紙條', 'node = data + link');
  const ns = [];
  for (let i = 0; i < 4; i++) { ns.push(nd(vals[i], xs[i], 0.35, -1.8, null, 4)); await beat(tok, 450); }
  for (let i = 0; i < 3; i++) { lk(xs[i], xs[i + 1], -1.8); await beat(tok, 350); }
  tag('NULL', 'idx', xs[3] + 1.6, 0.35, -1.8);
  tag('head', 'ptr', xs[0], 1.4, -1.8);
  say('Singly：從 head 一路走到結尾', 'head → 3 → 7 → 1 → 9 → NULL');
  const p = tag('p', 'ptr alt', xs[0], 2.0, -1.8);
  for (let i = 0; i < 4; i++) {
    p.position.set(xs[i], 2.0, -1.8); glow(ns[i].userData.data, GOLD);
    await beat(tok, 700); glow(ns[i].userData.data, null);
  }
  kill(p);
  say('Doubly：正著串、也反著串', 'node = prev + data + next');
  await beat(tok, 900);
  for (let i = 0; i < 4; i++) {
    nd(vals[i], xs[i], 0.35, 2.0, null, 4);
    cube('', '#d8c29b', [0.45, 0.7, 1.0], xs[i] - 0.73, 0.35, 2.0, 4);
    await beat(tok, 400);
  }
  for (let i = 0; i < 3; i++) {
    arrow(V3(xs[i] + 0.95, 0.55, 2.0), V3(xs[i + 1] - 0.95, 0.55, 2.0));
    arrow(V3(xs[i + 1] - 0.95, 0.15, 2.0), V3(xs[i] + 0.95, 0.15, 2.0), A_GOLD);
    await beat(tok, 450);
  }
  tag('head', 'ptr', xs[0], 1.4, 2.0); tag('tail', 'ptr alt', xs[3], 1.4, 2.0);
  say('從頭串一串、從尾串一串', 'doubly linked list：head 與 tail 都能出發');
  await beat(tok, 2600);
  say('講完一個 DS，就看它在哪裡有用', '依情境在多種資料結構中做選擇');
  await beat(tok, 2600);
}]);

// ════════ 17:24 Sparse Vector ════════
FRAG.push(['lllin-sparse', 'Sparse Vector：只存非零項', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const V = [0, 0, 6, 0, 4, 0, 0], xs = (i) => -4.5 + i * 1.5;
  const cs = V.map((v, i) => { tag(String(i + 1), 'idx', xs(i), 0, -0.6); return cube(v, v ? LB : '#c9bfae', [1.1, 0.8, 1.1], xs(i), 0.4, -1.6, 3 + i * 0.4); });
  tag('第幾維（從 1 數）', 'idx', 0, 0, 0.2);
  say('7 維向量：一串數字', 'v = (0, 0, 6, 0, 4, 0, 0)');
  await beat(tok, 2000);
  glow(cs[2], GOLD); glow(cs[4], GOLD);
  say('只有 6 和 4 不是 0', '7 格裡有 5 個 0');
  await beat(tok, 2200);
  cs.forEach((m, i) => { if (!V[i]) glow(m, RED); });
  say('0 乘什麼都是 0、加 0 不變', '0 × a = 0，a + 0 = a → 算了也白算');
  await beat(tok, 2600);
  cs.forEach((m, i) => { if (!V[i]) fly(m, V3(0, 8, -4)); });
  say('那就只存不是 0 的項', '');
  await beat(tok, 1200);
  glow(cs[2], null); glow(cs[4], null);
  move(cs[2], -1.6, 0.4, 2.2); move(cs[4], 1.6, 0.4, 2.2);
  await beat(tok, 700);
  relabel(cs[2], '(3, 6)'); relabel(cs[4], '(5, 4)');
  say('每筆記成（維度, 值）', '(3, 6)、(5, 4)');
  await beat(tok, 2400);
  say('這例子不明顯：少 5 個 0、多 2 個 index', '7 個數 → 2 組 pair = 4 個數');
  await beat(tok, 2800);
  tag('1000 維、只有 10 個非零', 'ptr alt', 0, 2.4, 2.2);
  say('1000 維只有 10 個非零', '1000 個數 → 10 組 pair = 20 個數');
  await beat(tok, 3000);
}]);

// ════════ 21:30 多項式 = sparse vector；ordered linked list ════════
FRAG.push(['lllin-poly-list', '多項式與 Ordered Linked List', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  tag('6x³ + 4x⁵', 'ptr alt', 0, 2.6, -2.4);
  say('多項式就是一種 sparse vector', '6x³ ↔ 第 3 維是 6');
  await beat(tok, 2200);
  const V = [0, 0, 6, 0, 4, 0, 0], xs = (i) => -4.5 + i * 1.5;
  const cs = V.map((v, i) => { tag(String(i + 1), 'idx', xs(i), 0, -1.4); return cube(v, v ? LB : '#c9bfae', [1.1, 0.8, 1.1], xs(i), 0.4, -2.4, 3); });
  say('Dense array：0 也全部存', '[0, 0, 6, 0, 4, 0, 0]');
  await beat(tok, 2400);
  glow(cs[2], GOLD); glow(cs[4], GOLD);
  tag('head', 'ptr', -1.6, 1.4, 2.0);
  const n1 = nd('(3, 6)', -1.6, 0.35, 2.0, LB, 4);
  await beat(tok, 600);
  const n2 = nd('(5, 4)', 1.6, 0.35, 2.0, LB, 4);
  await beat(tok, 600);
  lk(-1.6, 1.6, 2.0); tag('NULL', 'idx', 3.2, 0.35, 2.0);
  say('Linked list：只串非零項', 'head → (3, 6) → (5, 4) → NULL');
  await beat(tok, 2600);
  say('維度從 1 開始數（一般向量慣例）', '第 1、2、3… 維，不說第 0 維');
  await beat(tok, 2400);
  glow(cs[2], null); glow(cs[4], null);
  glow(n1.userData.data, GOLD); await beat(tok, 700);
  glow(n1.userData.data, null); glow(n2.userData.data, GOLD);
  say('Ordered linked list：依維度排好', '3 < 5：由小到大串');
  await beat(tok, 2200);
  glow(n2.userData.data, null);
  say('串起來後，插入刪除都有彈性', '改 link 就好，不用搬資料');
  await beat(tok, 2800);
}]);

// ════════ 25:13 兩個 sparse vector 相加：目標 ════════
FRAG.push(['lllin-merge-goal', '兩個 Sparse Vector 相加：要得到什麼', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  say('V1：第 3 維 6、第 5 維 4', 'V1 = 6x³ + 4x⁵');
  sRow(V1, -2.4, LB, 'H1', 4);
  await beat(tok, 2200);
  say('V2：第 1 維 2、第 4 維 9、第 5 維 −4', 'V2 = 2x + 9x⁴ − 4x⁵');
  sRow(V2, 0, LR, 'H2', 4);
  await beat(tok, 2400);
  say('兩條 singly list，各有一個 head', '想要：V1 + V2，結果也要排好');
  await beat(tok, 2400);
  const R = [[1, 2, LR], [3, 6, LB], [4, 9, LR]];
  tag('result', 'ptr alt', dx(1), 1.35, 2.6);
  for (let i = 0; i < R.length; i++) {
    nd(pl(R[i]), dx(R[i][0]), 0.35, 2.6, R[i][2], 4);
    if (i) lk(dx(R[i - 1][0]), dx(R[i][0]), 2.6);
    say('依維度由小到大串上 ' + pl(R[i]), i === 0 ? '第 1 維只有 V2 有' : i === 1 ? '第 3 維只有 V1 有' : '第 4 維只有 V2 有');
    await beat(tok, 1500);
  }
  const z = cube('(5, 0)', LG, [1.0, 0.7, 1.0], dx(5), 0.35, 2.6, 4);
  say('第 5 維：4 + (−4) = 0', '相加後消掉');
  await beat(tok, 1600);
  fly(z, V3(2, 8, 4));
  tag('NULL', 'idx', dx(4) + 1.6, 0.35, 2.6);
  say('結果：(1,2) → (3,6) → (4,9)', '2x + 6x³ + 9x⁴');
  await beat(tok, 3000);
}]);

// ════════ 29:05 Merge 的程式：三種情形 ════════
const MERGE_CODE = [
  'c1 = H1;  c2 = H2;',
  'while (c1 未到尾 && c2 未到尾) {',
  '  if (c1.order < c2.order)',
  '    { result.insert(c1);  c1++; }',
  '  else if (c1.order > c2.order)',
  '    { result.insert(c2);  c2++; }',
  '  else',
  '    { result.insert(c1 + c2);  c1++;  c2++; }',
  '}',
  '把還沒走完的那條接到 result 後面',
];
FRAG.push(['lllin-merge-cases', 'Merge 程式：三種情形與前進', async (tok) => {
  fresh([0, 6.5, 13], [0, 2.6, 0]);
  const cd = code(MERGE_CODE, 0, 6.4, 0.48, -2.6);
  const r1 = sRow(V1, 0.4, LB, 'H1'), r2 = sRow(V2, 2.4, LR, 'H2');
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, 0.4), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 2.4);
  cd.hl(0);
  say('c1 從 H1、c2 從 H2 出發', 'singly：兩條都只能從頭走');
  await beat(tok, 2600);
  cd.hl(2); glow(r1.ns[0].userData.data, GOLD);
  say('情形一：c1 的 order 比較小', '小的先串到 result 最後面，維持順序');
  await beat(tok, 2600);
  glow(r1.ns[0].userData.data, null); cd.hl(4); glow(r2.ns[0].userData.data, GOLD);
  say('情形二：c2 的 order 比較小', 'insert(c2)');
  await beat(tok, 2400);
  glow(r2.ns[0].userData.data, null); cd.hl(6);
  glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  say('情形三：order 一樣大', 'insert(c1 + c2)：值相加');
  await beat(tok, 2600);
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  cd.hl(3);
  say('串完的那邊要前進：c1++', '概念上的 ++，其實是 c1 = c1->next');
  await beat(tok, 1200);
  c1.position.set(dx(5), 1.0, 0.4);
  await beat(tok, 1600);
  say('像 STL iterator：overload ++', '一樣大時 c1、c2 都前進');
  await beat(tok, 2200);
  c1.position.set(dx(3), 1.0, 0.4);
  cd.hl(1);
  say('兩條都還沒到尾，才能比大小', 'while (c1 != NULL && c2 != NULL)');
  await beat(tok, 2600);
  cd.hl(9);
  say('有一條先走完：剩下的整段接上', '');
  await beat(tok, 2600);
  cd.hl(-1);
  await beat(tok, 1000);
}]);

// ════════ 33:44 Running cursors：完整走一次 ════════
FRAG.push(['lllin-merge-trace', 'Running Cursors：V1 + V2 走一遍', async (tok) => {
  fresh([0, 8.5, 12], [0, 1.6, 0.6]);
  const cd = code(MERGE_CODE, 0, 6.6, 0.42, -3.4);
  const r1 = sRow(V1, -0.8, LB, 'H1'), r2 = sRow(V2, 1.2, LR, 'H2');
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, -0.8), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 1.2);
  tag('result', 'ptr', dx(1), 1.35, 3.3);
  say('兩個游標交互前進', 'c1 走 V1、c2 走 V2');
  cd.hl(1);
  await beat(tok, 2200);
  const res = [];
  async function put(p, color, line, cap, f) {
    cd.hl(line);
    say(cap, f);
    await beat(tok, 1200);
    nd(pl(p), dx(p[0]), 0.35, 3.3, color, 4);
    if (res.length) lk(dx(res[res.length - 1][0]), dx(p[0]), 3.3);
    res.push(p);
    await beat(tok, 1000);
  }
  await put([1, 2], LR, 5, '3 > 1：c2 比較小，串 c2', 'insert (1, 2)，c2++');
  c2.position.set(dx(4), 1.0, 1.2);
  await beat(tok, 700);
  await put([3, 6], LB, 3, '3 < 4：c1 比較小，串 c1', 'insert (3, 6)，c1++');
  c1.position.set(dx(5), 1.0, -0.8);
  await beat(tok, 700);
  await put([4, 9], LR, 5, '5 > 4：c2 比較小，串 c2', 'insert (4, 9)，c2++');
  c2.position.set(dx(5), 1.0, 1.2);
  await beat(tok, 700);
  cd.hl(7);
  glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  say('5 == 5：一樣大，值相加', '4 + (−4) = 0');
  await beat(tok, 1600);
  const z = cube('(5, 0)', LG, [1.0, 0.7, 1.0], dx(5), 0.35, 3.3, 4);
  await beat(tok, 900);
  fly(z, V3(2, 8, 4));
  say('和是 0：不該串進 result', '補充：要檢查 c1 + c2 != 0');
  await beat(tok, 2200);
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  c1.position.set(dx(5) + 1.6, 1.0, -0.8); c2.position.set(dx(5) + 1.6, 1.0, 1.2);
  cd.hl(9);
  say('兩條都走完，沒有剩下要接的', 'c1 == NULL、c2 == NULL');
  await beat(tok, 1800);
  tag('NULL', 'idx', dx(4) + 1.6, 0.35, 3.3);
  cd.hl(-1);
  say('結果：2x + 6x³ + 9x⁴', '每個節點只看一次：O(m + n)');
  await beat(tok, 3000);
}]);

// ════════ 37:01 內積：同一個架構 ════════
FRAG.push(['lllin-dot', '內積：同樣的 Running Cursors', async (tok) => {
  fresh([0, 8, 12], [0, 1.6, 0.4]);
  const cd = code([
    'while (c1 && c2) {',
    '  if (c1.index < c2.index)       c1++;',
    '  else if (c1.index > c2.index)  c2++;',
    '  else { sum += c1.value * c2.value;  c1++;  c2++; }',
    '}',
  ], 0, 6.2, 0.5, -3.2);
  const r1 = sRow(V1, -0.6, LB, 'H1'), r2 = sRow(V2, 1.6, LR, 'H2');
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, -0.6), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 1.6);
  const sm = tag('sum = 0', 'ptr', 0, 0.3, 3.6);
  say('內積：對應維度相乘再加總', '架構不變，只改 if 裡做的事');
  await beat(tok, 2600);
  cd.hl(2); say('3 > 1：c2 前進，乘不出東西', '只有一邊有值 → 乘積是 0');
  await beat(tok, 1300); c2.position.set(dx(4), 1.0, 1.6); await beat(tok, 1100);
  cd.hl(1); say('3 < 4：c1 前進', '一樣不產生乘積');
  await beat(tok, 1300); c1.position.set(dx(5), 1.0, -0.6); await beat(tok, 1100);
  cd.hl(2); say('5 > 4：c2 前進', '');
  await beat(tok, 1300); c2.position.set(dx(5), 1.0, 1.6); await beat(tok, 1100);
  cd.hl(3); glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  say('index 一樣：值相乘、加進 sum', 'sum += 4 × (−4)');
  await beat(tok, 1600);
  txt(sm, 'sum = −16');
  await beat(tok, 1600);
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  c1.position.set(dx(5) + 1.6, 1.0, -0.6); c2.position.set(dx(5) + 1.6, 1.0, 1.6);
  cd.hl(-1);
  say('V1 · V2 = −16', '合併時「一樣大」的串接，改成「相乘累加」');
  await beat(tok, 2600);
  say('LibSVM 的內積也是這樣寫', '它用 (index, value) 陣列，不是真的 linked list');
  await beat(tok, 3000);
}]);

// ════════ 42:26 高維又稀疏：影像與 one-hot ════════
FRAG.push(['lllin-onehot', '高維稀疏向量：影像與 One-hot', async (tok) => {
  fresh([0, 7, 12.5], [0, 1, 0.4]);
  const img = cube('1024 × 768', '#9b7ef4', [4, 0.3, 3], 0, 0.15, -1.2);
  say('一張影像 1024 × 768', '平常看成矩陣');
  await beat(tok, 2200);
  await anim(tok, 1200, (t) => { img.scale.set(1 + 2.2 * t, 1, 1 - 0.85 * t); });
  relabel(img, '786,432 維');
  say('拉長成一個向量', '1024 × 768 = 786,432 維');
  await beat(tok, 2400);
  fly(img, V3(0, 8, -4));
  await beat(tok, 700);
  say('廣告資料：在哪個網站被點', '原始資料是離散選項');
  const sites = ['www.google.com', 'www.yahoo.com', '… 上萬個網站'];
  const sl = sites.map((s, i) => tag(s, 'idx', -4.6, 0.3, -2.4 + i * 0.9));
  await beat(tok, 2200);
  const xs = (i) => -1.6 + i * 1.05;
  const cs = [];
  for (let i = 0; i < 8; i++) { cs.push(cube(i === 0 ? 1 : 0, i === 0 ? LK : '#c9bfae', [0.85, 0.7, 0.85], xs(i), 0.35, -2.4, 3)); }
  tag('…', 'idx', xs(8) - 0.2, 0.35, -2.4);
  sl[0].element.className = 'lab-label ptr alt';
  say('One-hot：是哪個選項，那一維填 1', '其他維全部填 0');
  await beat(tok, 2600);
  sl[0].element.className = 'lab-label idx'; sl[1].element.className = 'lab-label ptr alt';
  relabel(cs[0], 0); tint(cs[0], '#c9bfae'); relabel(cs[1], 1); tint(cs[1], LK);
  say('換一筆：yahoo 那一維才是 1', '1 萬個網站 → 1 萬維，只有 1 個非零');
  await beat(tok, 2600);
  cs.forEach((m, i) => { if (i !== 1) fly(m, V3(0, 8, -4)); });
  await beat(tok, 900);
  move(cs[1], 0, 0.35, 2.0);
  relabel(cs[1], '(yahoo, 1)');
  say('Sparse 表示：只存一組（維度, 值）', '超高維又超稀疏，在機器學習很常見');
  await beat(tok, 3000);
}]);

// ════════ 45:20 new / malloc 時記憶體發生什麼事 ════════
FRAG.push(['lllin-malloc', 'malloc、free 與 C++ new', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.4]);
  const T = [];
  const used = new Set([1, 4, 8, 9, 15, 20]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const k = r * 6 + c;
    T.push(cube('', used.has(k) ? '#b9a582' : '#e9dcc4', [1.2, 0.1, 1.2], -3.25 + c * 1.3, 0.05, -1.6 + r * 1.3));
  }
  tag('記憶體（灰：別人在用）', 'idx', 0, 0.2, -2.9);
  const p = tag('p', 'ptr', -5.8, 0.6, 0.35);
  say('程式要一塊記憶體', '例：要放一個新的 node');
  await beat(tok, 2200);
  const blk = [13, 14];
  blk.forEach((k) => tint(T[k], LK));
  const bx = -3.25 + 1 * 1.3 + 0.65, bz = -1.6 + 2 * 1.3;
  let a = arrow(V3(-5.4, 0.4, 0.35), V3(bx - 1.3, 0.2, bz));
  say('malloc：OS 把這塊登記給你的程式', 'p = malloc(sizeof(Node))');
  await beat(tok, 2800);
  say('像地政單位：這塊地有人用了', '別的程式不會再拿到這塊');
  await beat(tok, 2400);
  blk.forEach((k) => tint(T[k], '#e9dcc4')); kill(a);
  say('free：還給系統，之後可再配置', 'free(p)');
  await beat(tok, 2600);
  blk.forEach((k) => tint(T[k], LK));
  a = arrow(V3(-5.4, 0.4, 0.35), V3(bx - 1.3, 0.2, bz));
  say('C++ new：一樣先配置一塊', 'p = new Node();');
  await beat(tok, 1800);
  cube('data=0', LB, [1.1, 0.6, 1.1], bx - 0.65, 0.4, bz, 3);
  cube('NULL', '#d8c29b', [1.1, 0.6, 1.1], bx + 0.65, 0.4, bz, 3);
  say('再執行初始化程式（constructor）', '像整地：把初值填好');
  await beat(tok, 3000);
}]);

// ════════ 50:41 真正的 merge：搬節點，不 copy ════════
FRAG.push(['lllin-inplace-merge', '真正的 Merge：搬節點而不 copy', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const r1 = sRow(V1, -2.4, LB, 'H1'), r2 = sRow(V2, 0, LR, 'H2');
  tag('result', 'ptr alt', dx(1), 1.35, 2.6);
  say('剛才的版本：insert 時複製新節點', '多配置 3 個 node');
  await beat(tok, 1400);
  const cp = [];
  for (const [d, v, c] of [[1, 2, LR], [3, 6, LB], [4, 9, LR]]) { cp.push(nd(pl([d, v]), dx(d), 0.35, 2.6, c, 4)); await beat(tok, 500); }
  say('回傳新 list：原本兩條還在', '記憶體用了兩份');
  await beat(tok, 2400);
  cp.forEach((g) => fly(g, V3(0, 8, 4)));
  await beat(tok, 900);
  r1.ars.concat(r2.ars).forEach(kill);
  say('真正的 merge：把節點本身移過去', '只改 link，不 copy');
  await beat(tok, 1600);
  move(r2.ns[0], dx(1), 0.35, 2.6); await beat(tok, 700);
  move(r1.ns[0], dx(3), 0.35, 2.6); await beat(tok, 700);
  move(r2.ns[1], dx(4), 0.35, 2.6); await beat(tok, 700);
  say('第 5 維相加為 0：兩個節點 free 掉', '4 + (−4) = 0');
  await beat(tok, 1200);
  fly(r1.ns[1], V3(3, 8, -4)); fly(r2.ns[2], V3(3, 8, -2));
  await beat(tok, 1000);
  lk(dx(1), dx(3), 2.6); lk(dx(3), dx(4), 2.6); tag('NULL', 'idx', dx(4) + 1.6, 0.35, 2.6);
  say('result：同樣的節點，重新串好', '不用多配置記憶體');
  await beat(tok, 3000);
}]);

// ════════ 58:25 Linked list 的缺點與「基本功」 ════════
FRAG.push(['lllin-scatter', 'Linked List 的缺點：記憶體四散', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.6]);
  tag('Array：連續', 'ptr', -4.6, 0.4, -3.2);
  const ac = [];
  for (let i = 0; i < 5; i++) ac.push(cube(i + 1, LB, [1.0, 0.6, 1.0], -1.6 + i * 1.05, 0.3, -3.2, 3));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) cube('', '#e9dcc4', [1.2, 0.08, 1.2], -4.9 + c * 1.4, 0.04, -0.6 + r * 1.5);
  tag('Linked list：哪裡有空就挖一塊', 'ptr alt', 0, 0.4, 4.0);
  const spots = [[0, 2], [6, 0], [2, 1], [7, 2], [3, 0]];
  const P = spots.map(([c, r]) => V3(-4.9 + c * 1.4, 0.35, -0.6 + r * 1.5));
  say('Array：記憶體連在一起', '一路讀過去');
  const cur = tag('▼', 'ptr', 0, 1.3, -3.2);
  for (let i = 0; i < 5; i++) { cur.position.set(-1.6 + i * 1.05, 1.1, -3.2); glow(ac[i], GOLD); await beat(tok, 300); glow(ac[i], null); }
  await beat(tok, 800);
  const ln = [];
  for (let i = 0; i < 5; i++) { ln.push(cube(i + 1, LR, [0.9, 0.7, 0.9], P[i].x, 0.35, P[i].z, 3)); await beat(tok, 350); }
  for (let i = 0; i < 4; i++) {
    const d = P[i + 1].clone().sub(P[i]).normalize();
    arrow(P[i].clone().addScaledVector(d, 0.55).setY(0.75), P[i + 1].clone().addScaledVector(d, -0.55).setY(0.75));
  }
  say('Linked list：節點四散各地', '東占一塊、西占一塊');
  await beat(tok, 2200);
  for (let i = 0; i < 5; i++) { cur.position.set(P[i].x, 1.3, P[i].z); glow(ln[i], GOLD); await beat(tok, 700); glow(ln[i], null); }
  say('有 cache 時效率差：東奔西跑', '東市買駿馬，西市買鞍韉');
  await beat(tok, 2800);
  say('概念簡單，但要寫到沒 bug 不容易', '實務：自刻求極致效能，或直接用 STL');
  await beat(tok, 2800);
  say('但很適合考基本功', '像考主廚煎荷包蛋');
  await beat(tok, 3000);
}]);

// ════════ 63:15 Linked List Reversal ════════
FRAG.push(['lllin-reverse', 'Linked List Reversal：先存再改', async (tok) => {
  fresh([0, 7.5, 12], [0, 2.2, 0.4]);
  const cd = code([
    'prev = NULL;  cur = head;',
    'while (cur != NULL) {',
    '  next = cur->next;   // 先存紅箭頭',
    '  cur->next = prev;   // 改成綠箭頭',
    '  prev = cur;  cur = next;',
    '}',
    'head = prev;',
  ], 0, 6.4, 0.5, -2.6);
  const Z = 1.4, xs = (i) => -5.2 + i * 2.6;
  const ns = [];
  for (let i = 0; i < 5; i++) ns.push(nd(i + 1, xs(i), 0.35, Z, null, 3));
  const red = [];
  for (let i = 0; i < 4; i++) red.push(lk(xs(i), xs(i + 1), Z, 0.35, A_RED));
  const endNull = tag('NULL', 'idx', xs(4) + 1.6, 0.35, Z);
  const head = tag('head', 'ptr', xs(0), 2.9, Z);
  say('把 singly linked list 反過來', 'doubly 只要交換 head/tail 與每個 prev/next');
  await beat(tok, 3000);
  cd.hl(0);
  const tp = tag('prev', 'ptr', xs(0) - 1.6, 1.6, Z), tc = tag('cur', 'ptr alt', xs(0), 2.2, Z), tn = tag('next', 'ptr', xs(1), 1.6, Z);
  showL(tn, false);
  const startNull = tag('NULL', 'idx', xs(0) - 1.6, 0.9, Z);
  say('prev = NULL，cur = head', '');
  await beat(tok, 1800);
  for (let i = 0; i < 5; i++) {
    cd.hl(2); showL(tn, true);
    if (i < 4) { tn.position.set(xs(i + 1), 1.6, Z); red[i].setColor(new THREE.Color('#ff3b2f')); } else tn.position.set(xs(4) + 1.6, 1.6, Z);
    say(i === 0 ? '先把紅箭頭存起來' : '存下 next', 'next = ' + (i < 4 ? String(i + 2) : 'NULL'));
    await beat(tok, i === 0 ? 1600 : 900);
    cd.hl(3);
    if (i < 4) kill(red[i]); else kill(endNull);
    if (i > 0) arrow(V3(xs(i) + 0.73, 0.95, Z), V3(xs(i - 1) + 0.2, 0.95, Z), A_GREEN);
    else glow(ns[0].userData.data, GREEN);
    say(i === 0 ? '再改成綠箭頭：指回 prev' : 'cur->next = prev', i === 0 ? '1->next = NULL' : (i + 1) + '->next = ' + i);
    await beat(tok, i === 0 ? 1600 : 900);
    if (i === 0) glow(ns[0].userData.data, null);
    cd.hl(4);
    tp.position.set(xs(i), 1.6, Z); tc.position.set(i < 4 ? xs(i + 1) : xs(4) + 1.6, 2.2, Z);
    say(i === 0 ? '最後沿著存下的紅箭頭前進' : 'prev = cur，cur = next', '');
    await beat(tok, i === 0 ? 1600 : 800);
  }
  kill(startNull);
  tag('NULL', 'idx', xs(0) - 1.5, 0.95, Z);
  cd.hl(6); showL(tn, false);
  head.position.set(xs(4), 2.9, Z);
  say('head = prev：反轉完成', '5 → 4 → 3 → 2 → 1 → NULL');
  await beat(tok, 2600);
  cd.hl(-1);
  say('約十行，但順序一錯後半段就斷了', '先在紙上想清楚再上機');
  await beat(tok, 2800);
}]);

// ════════ 70:41 Cycle detection：龜兔賽跑 ════════
FRAG.push(['lllin-cycle', 'Cycle Detection：龜兔賽跑', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.3]);
  const P = { 1: V3(-5.6, 0.35, 0), 2: V3(-3.2, 0.35, 0), 3: V3(-0.8, 0.35, 0), 4: V3(1.6, 0.35, -2.2), 5: V3(4.0, 0.35, 0), 6: V3(1.6, 0.35, 2.2) };
  const NX = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 3 };
  const cs = {};
  for (let k = 1; k <= 6; k++) { cs[k] = cube(k, colorFor(k), [0.9, 0.7, 0.9], P[k].x, 0.35, P[k].z, 3); }
  function link(a, b, color) {
    const d = P[b].clone().sub(P[a]).normalize();
    return arrow(P[a].clone().addScaledVector(d, 0.6), P[b].clone().addScaledVector(d, -0.6), color);
  }
  for (let k = 1; k <= 5; k++) link(k, k + 1);
  tag('head', 'ptr', P[1].x, 1.4, 0);
  const nul = tag('NULL', 'idx', P[6].x - 1.6, 0.35, P[6].z);
  say('正常的 linked list 沒有 cycle', '從 head 走到尾巴 NULL');
  await beat(tok, 2600);
  kill(nul);
  link(6, 3, A_RED);
  say('某次更新 link 沒寫對：繞回去', '6->next = 3 → cycle');
  await beat(tok, 2600);
  say('硬算：每個 node 出發，看能否繞回', '會 work，但不巧妙');
  await beat(tok, 2400);
  const tT = tag('烏龜', 'ptr', P[1].x, 1.4, P[1].z), tH = tag('兔子', 'ptr alt', P[1].x, 2.0, P[1].z);
  let T = 1, H = 1;
  say('兩個指標從 head 出發', '兔子一次兩步，烏龜一次一步');
  await beat(tok, 2200);
  for (let r = 1; r <= 4; r++) {
    T = NX[T]; tT.position.set(P[T].x, 1.4, P[T].z);
    H = NX[H]; tH.position.set(P[H].x, 2.0, P[H].z);
    await beat(tok, 450);
    H = NX[H]; tH.position.set(P[H].x, 2.0, P[H].z);
    say('第 ' + r + ' 輪', '烏龜在 ' + T + '，兔子在 ' + H);
    await beat(tok, 1100);
  }
  glow(cs[5], GOLD);
  say('兔子追到烏龜 → 有 cycle', '兩者都在 5');
  await beat(tok, 2600);
  say('沒有 cycle：兔子會先走到 NULL', '兔子走的是「兩步算一步」的虛擬 list');
  await beat(tok, 3000);
}]);

// ════════ 74:42 找中間那一項 ════════
FRAG.push(['lllin-middle', '找 Linked List 的中間項', async (tok) => {
  const idx0 = !!(ctx.params || {}).idx0;
  fresh([0, 7.5, 11.5], [0, 0.6, 0.4]);
  const Z = 0.2, xs = (i) => -5.2 + i * 2.6;
  const ns = [];
  for (let i = 0; i < 5; i++) { ns.push(nd(i + 1, xs(i), 0.35, Z, null, 3)); tag('[' + i + ']', 'idx', xs(i), 0, Z + 1.1); }
  for (let i = 0; i < 4; i++) lk(xs(i), xs(i + 1), Z);
  tag('NULL', 'idx', xs(4) + 1.6, 0.35, Z);
  say('5 項的 list：中間是第 3 項', '怎麼找最巧妙？');
  await beat(tok, 2400);
  const p = tag('p', 'ptr alt', xs(0), 1.4, Z), cnt = tag('n = 0', 'ptr', 0, 2.8, Z);
  say('Two-pass：先數有幾項', '');
  for (let i = 0; i < 5; i++) { p.position.set(xs(i), 1.4, Z); txt(cnt, 'n = ' + (i + 1)); await beat(tok, 500); }
  await beat(tok, 600);
  say('再從頭走到第 3 項', '總共約 n + n/2 步');
  for (let i = 0; i < 3; i++) { p.position.set(xs(i), 1.4, Z); await beat(tok, 600); }
  glow(ns[2].userData.data, GOLD);
  await beat(tok, 1400);
  glow(ns[2].userData.data, null); kill(p); kill(cnt);
  const tT = tag('烏龜', 'ptr', xs(0), 1.4, Z), tH = tag('兔子', 'ptr alt', xs(0), 2.0, Z);
  say('One-pass：龜兔賽跑', '兔子兩步、烏龜一步');
  await beat(tok, 2000);
  for (let r = 1; r <= 2; r++) {
    tT.position.set(xs(r), 1.4, Z); tH.position.set(xs(2 * r), 2.0, Z);
    say('兔子到 ' + (2 * r + 1) + '，烏龜到 ' + (r + 1), '兔子：1 → 3 → 5；烏龜：1 → 2 → 3');
    await beat(tok, 1400);
  }
  glow(ns[2].userData.data, GOLD);
  say('兔子走到尾，烏龜就在中間', '移動總數其實一樣，差在少一次 loop');
  await beat(tok, 2600);
  if (idx0) { say('從 0 數：中間是第 2 項', '[0] [1] [2] [3] [4] → [2]'); await beat(tok, 2600); }
  say('變化題：找 1/3、3/4 處', '改兩個游標的速度比');
  await beat(tok, 2600);
  if (!idx0) { say('從 0 數的話，中間是 index 2', '定義要先跟主考官講清楚'); await beat(tok, 2400); }
}]);
  }

  // ═══ llpeng12.js ═══
  {
// ─── lhXHk8IuFeQ（彭文志 Lec08 Lists 1/4）與 U_tNDdEooJU（Lec09 Lists 2/4） ───
const BLUE = '#4b9ee2', ORANGE = '#dd8238', TEAL = '#2fc092', PURP = '#9b7ef4', DIM = '#cfc6b6', SAND = '#e9dcc4';
function slide(tok, o, x, y, z = 0, ms = 450) {
  const s = o.position.clone();
  return anim(tok, ms, (t) => o.position.set(s.x + (x - s.x) * t, s.y + (y - s.y) * t, s.z + (z - s.z) * t));
}
async function dropIn(tok, o, ms = 420) { const p = o.position.clone(); o.position.y += 4; await slide(tok, o, p.x, p.y, p.z, ms); }
function node(v, x, y = 0.5, z = 0, color = BLUE) { return lnode(v, x, y, z, color); }
// link arrow out of node g's link field into node h (null → a NULL tag)
function lk(g, h, opt = {}) {
  const p = g.position;
  if (!h) return opt.below ? tag(opt.text || 'NULL', 'idx', p.x + 0.73, p.y - 0.78, p.z) : tag(opt.text || 'NULL', 'idx', p.x + 1.45, p.y, p.z);
  const q = h.isVector3 ? h : h.position;
  const dy = q.y - p.y;
  if (Math.abs(dy) > 0.5) { const s = Math.sign(dy); return arrow(V3(p.x + 0.73, p.y + s * 0.36, p.z), V3(q.x, q.y - s * 0.36, q.z)); }
  if (q.x > p.x + 0.5) return arrow(V3(p.x + 0.96, p.y, p.z), V3(q.x - 0.52, q.y, q.z));
  return arrow(V3(p.x + 0.73, p.y, p.z + 0.62), V3(q.x + 0.3, q.y, q.z + 0.62));
}
function ptrAt(name, g, dy = 1.0, cls = 'ptr') { return tag(name, cls, g.position.x, g.position.y + dy, g.position.z); }
function mv(tok, l, g, dy = 1.0, ms = 400) { return slide(tok, l, g.position.x, g.position.y + dy, g.position.z, ms); }
function chainOf(vals, x0, gap = 2.1, y = 0.5, z = 0, color = BLUE) {
  const ns = vals.map((v, i) => node(v, x0 + i * gap, y, z, color));
  return { ns, ls: ns.map((g, i) => lk(g, ns[i + 1] || null)) };
}
function relinkAll(c) { c.ls.forEach(kill); c.ls = c.ns.map((g, i) => lk(g, c.ns[i + 1] || null)); }
function ring(color = '#c08a1f') {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = Math.PI / 2; m.visible = false; lab.world.add(m); return m;
}
function ringAt(m, g) { m.visible = true; m.position.set(g.position.x, g.position.y - 0.38, g.position.z); }
const D = (g) => g.userData.data;
// a polynomial term node: coef | exp | link
function pnode(c, e, x, y = 0.5, z = 0, color = TEAL) {
  const g = new THREE.Group();
  const a = lab.box(color, [0.8, 0.7, 1.0]); a.position.x = -0.42; a.add(lab.label(String(c), 'val'));
  const b = lab.box('#9fd8c4', [0.8, 0.7, 1.0]); b.position.x = 0.42; b.add(lab.label(String(e), 'val'));
  const k = lab.box('#d8c29b', [0.4, 0.7, 1.0]); k.position.x = 1.05;
  g.add(a, b, k); g.userData.data = a; g.userData.exp = b; g.position.set(x, y, z); lab.world.add(g); return g;
}
function plk(g, h, opt = {}) {
  const p = g.position;
  if (!h) return tag(opt.text || '0', 'idx', p.x + 1.6, p.y, p.z);
  const q = h.isVector3 ? h : h.position;
  if (Math.abs(q.y - p.y) > 0.5) { const s = Math.sign(q.y - p.y); return arrow(V3(p.x + 1.05, p.y + s * 0.36, p.z), V3(q.x - 0.42, q.y - s * 0.36, q.z)); }
  if (q.x > p.x + 0.5) return arrow(V3(p.x + 1.26, p.y, p.z), V3(q.x - 0.84, q.y, q.z));
  return arrow(V3(p.x + 1.05, p.y, p.z + 0.62), V3(q.x - 0.42, q.y, q.z + 0.62));
}
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
const termStr = (c, e) => (e === 0 ? String(c) : (c === 1 ? '' : String(c)) + 'x' + sup(e));

// ───────── lhXHk8IuFeQ 01:11：Array 的兩個缺點 ─────────
FRAG.push(['llpeng12-array-cons', 'Array 的缺點：大小固定、要搬資料', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.6, 0]);
  const N = 9, X = (i) => -5.6 + i * 1.4;
  const slots = [];
  for (let i = 0; i < N; i++) { slots.push(cube('', SAND, [1.25, 0.08, 1.25], X(i), 0.04, 0)); tag('[' + i + ']', 'idx', X(i), 0, 1.1); }
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'HAT'];
  say('Array：一塊連續的記憶體空間', 'list[0] … list[MAX_SIZE − 1]');
  const cs = [];
  for (let i = 0; i < 5; i++) { cs.push(cube(W[i], BLUE, [1.1, 0.75, 1.1], X(i), 0.45, 0)); await dropIn(tok, cs[i], 300); }
  await beat(tok, 900);
  say('缺點一：array 到底要開多大？', '資料可能 10 筆、100 筆，也可能 10000 筆');
  for (let i = 5; i < N; i++) tint(slots[i], '#f0b4a8');
  await beat(tok, 2600);
  say('開太大，沒用到的格子都浪費', 'MAX_SIZE = 9，只用了 5 格');
  await beat(tok, 2200);
  for (let i = 5; i < N; i++) tint(slots[i], SAND);
  say('缺點二：在 FAT 後插入 GAT', 'GAT 要夾在 FAT 和 HAT 之間');
  const g = cube('GAT', ORANGE, [1.1, 0.75, 1.1], X(4), 2.6, 0);
  await beat(tok, 1500);
  glow(cs[4], GOLD);
  say('HAT 先往後搬一格', 'data movement');
  await slide(tok, cs[4], X(5), 0.45, 0, 600); glow(cs[4], null);
  await beat(tok, 600);
  await slide(tok, g, X(4), 0.45, 0, 500);
  say('GAT 才放得進去', '插入：後面的元素全部後移，最壞 O(n)');
  await beat(tok, 2000);
  say('刪除 GAT：後面的又要往前搬', '');
  fly(g); await beat(tok, 600);
  glow(cs[4], GOLD); await slide(tok, cs[4], X(4), 0.45, 0, 600); glow(cs[4], null);
  say('array 做 insert／delete，搬資料跑不掉', '→ 另一種 data structure：linked list');
  await beat(tok, 3000);
}]);

// ───────── lhXHk8IuFeQ 03:44：Linked list 的樣子 ─────────
FRAG.push(['llpeng12-ll-intro', 'Linked List：data、link 與 first', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 0.8, 0]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'HAT'];
  say('課本例子：依字母順序排好的單字', 'BAT → CAT → EAT → FAT → HAT');
  const ns = [];
  for (let i = 0; i < 5; i++) { ns.push(node(W[i], -5.6 + i * 2.4)); await dropIn(tok, ns[i], 330); }
  await beat(tok, 700);
  tag('data', 'idx', -5.6, -0.1, 1.0); tag('link', 'idx', -4.87, -0.1, 1.0);
  say('每個 node 兩個欄位：data 與 link', 'data = 三個字元；link = 指向下一個 node');
  glow(D(ns[0]), GOLD); await beat(tok, 2400); glow(D(ns[0]), null);
  for (let i = 0; i < 5; i++) {
    lk(ns[i], ns[i + 1] || null);
    say(i < 4 ? W[i] + ' 的 link 指向 ' + W[i + 1] : 'HAT 是最後一個：link = NULL', i < 4 ? '' : '尾巴的 link 是 0（NULL）');
    await beat(tok, 750);
  }
  await beat(tok, 900);
  const f = tag('first', 'ptr', -5.6, 2.0, 0); arrow(V3(-5.6, 1.75, 0), V3(-5.6, 0.9, 0));
  say('還要一個指標 first 指向頭端', 'first → BAT（第一個 element）');
  await beat(tok, 2400);
  const r = ring();
  for (let i = 0; i < 5; i++) { ringAt(r, ns[i]); say('從 first 沿著 link 一個一個走', '第 ' + (i + 1) + ' 個：' + W[i]); await beat(tok, 600); }
  r.visible = false; glow(D(ns[0]), null); showL(f, true);
  say('Linked list：node 排排站，靠 link 串起來', 'data + link + first');
  await beat(tok, 2800);
}]);

// ───────── lhXHk8IuFeQ 05:01：把 GAT 插在 FAT 後面 ─────────
FRAG.push(['llpeng12-insert-gat', '插入 GAT：兩個 pointer assignment', async (tok) => {
  fresh([0, 6, 13], [0, 1.2, 0]);
  const c = chainOf(['BAT', 'CAT', 'EAT', 'FAT', 'HAT'], -6);
  tag('first', 'ptr', -6, 1.6, 0);
  const cd = code(['① GAT.link = FAT.link;', '② FAT.link = &GAT;'], -2.4, 4.4);
  say('要把 GAT 插在 FAT 後面', '結果應該是 FAT → GAT → HAT');
  await beat(tok, 2200);
  const g = node('GAT', 1.35, 2.5, 0, ORANGE);
  await dropIn(tok, g, 450);
  say('先 create 一個新 node 存 GAT', 'GAT 的 link 還沒設定');
  await beat(tok, 2000);
  glow(D(c.ns[3]), GOLD);
  say('「指向 HAT」這個資訊在誰手上？', 'FAT 的 link（實線）');
  await beat(tok, 2200);
  cd.hl(0);
  const a1 = lk(g, c.ns[4]);
  say('① 把 FAT 的 link 抄給 GAT 的 link', 'GAT.link = FAT.link → GAT 指向 HAT');
  await beat(tok, 2600);
  cd.hl(1);
  kill(c.ls[3]); c.ls[3] = lk(c.ns[3], g);
  say('② FAT 的 link 改成 GAT 的位址', 'FAT.link = GAT → 原本 FAT→HAT 的實線不見了');
  await beat(tok, 2600);
  glow(D(c.ns[3]), null); cd.hl(-1);
  kill(a1);
  await Promise.all([slide(tok, g, 2.4, 0.5, 0, 600), slide(tok, c.ns[4], 4.5, 0.5, 0, 600)]);
  c.ns.splice(4, 0, g); relinkAll(c);
  say('看圖說故事：先畫結果，再讓 pointer 符合它', 'BAT → CAT → EAT → FAT → GAT → HAT');
  await beat(tok, 3000);
}]);

// ───────── lhXHk8IuFeQ 08:36：刪除 GAT ─────────
FRAG.push(['llpeng12-delete-gat', '刪除 GAT：FAT.link = GAT.link', async (tok) => {
  fresh([0, 6, 13], [0, 1.0, 0]);
  const c = chainOf(['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'], -6.2);
  tag('first', 'ptr', -6.2, 1.6, 0);
  say('剛插進來的 GAT，現在要把它刪掉', '刪掉後 FAT 要直接連到 HAT');
  await beat(tok, 2400);
  const g = c.ns[4];
  glow(D(g), RED);
  say('「指向 HAT」的資訊在 GAT 的 link 裡', '');
  await beat(tok, 1800);
  kill(c.ls[3]); kill(c.ls[4]);
  await slide(tok, g, g.position.x, 2.4, 0, 500);
  const ga = lk(g, c.ns[5]);
  c.ls[3] = lk(c.ns[3], c.ns[5]);
  glow(D(c.ns[3]), GOLD);
  say('一行就結束', 'FAT.link = GAT.link');
  await beat(tok, 2800);
  glow(D(c.ns[3]), null);
  kill(ga); fly(g);
  say('GAT 從 list 上拿掉了', '');
  await beat(tok, 900);
  c.ns.splice(4, 1); c.ls.splice(4, 1);
  await slide(tok, c.ns[4], -6.2 + 4 * 2.1, 0.5, 0, 500);
  relinkAll(c);
  say('Linked list：data、link，還有最重要的 first', 'BAT → CAT → EAT → FAT → HAT');
  await beat(tok, 2800);
}]);

// ───────── lhXHk8IuFeQ 10:25：要刪 GAT，得先找到 GAT ─────────
FRAG.push(['llpeng12-search-gat', '刪除前先搜尋：linked list vs array', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.4, 0.6]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'];
  const c = chainOf(W, -6.2, 2.1, 0.5, -1.2);
  tag('first', 'ptr', -6.2, 1.6, -1.2);
  say('程式要刪 GAT，第一步：GAT 在哪？', '人眼一看就知道，程式只有 first');
  await beat(tok, 2600);
  const r = ring();
  for (let i = 0; i < 5; i++) {
    ringAt(r, c.ns[i]); glow(D(c.ns[i]), i === 4 ? GREEN : GOLD);
    say(i === 4 ? '找到了！' : '從 first 開始：' + W[i] + ' == GAT？', i === 4 ? 'GAT == GAT' : '不是 → 沿 link 往下走');
    await beat(tok, 1000);
    if (i < 4) glow(D(c.ns[i]), null);
  }
  say('找到後才做刪除的 pointer assignment', 'delete 前要先 search，一個一個檢查');
  await beat(tok, 2400);
  r.visible = false; glow(D(c.ns[4]), null);
  const X = (i) => -5.0 + i * 1.6;
  const cs = W.map((w, i) => { tag('[' + i + ']', 'idx', X(i), 0, 3.0); return cube(w, '#7fb6e8', [1.2, 0.7, 1.0], X(i), 0.35, 2.1); });
  say('如果用 array 存：連續的記憶體空間', '不用看 link，用 for 迴圈依索引檢查');
  await beat(tok, 2200);
  for (let i = 0; i < 5; i++) { glow(cs[i], i === 4 ? GREEN : GOLD); say('for (i = 0; i < n; i++) 比對 list[i]', 'list[' + i + '] = ' + W[i]); await beat(tok, 450); if (i < 4) glow(cs[i], null); }
  say('array 不必一個個追 pointer', '補充：兩者循序搜尋都是 O(n)，array 常數較小');
  await beat(tok, 3000);
}]);

// ───────── lhXHk8IuFeQ 14:00：pointer 亂指／斷掉、doubly linked list ─────────
FRAG.push(['llpeng12-ll-risk', 'Pointer 出錯的風險與 Doubly Linked List', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.6, 0]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'];
  const c = chainOf(W, -6.2);
  tag('first', 'ptr', -6.2, 1.6, 0);
  say('如果 assignment 時不小心把 pointer 指錯…', '');
  await beat(tok, 2000);
  kill(c.ls[2]);
  const bad = arrow(V3(-2.0 + 0.73, 1.0, 0), V3(4.0, 1.0, 0), 0xb03030);
  tint(D(c.ns[3]), DIM); tint(D(c.ns[4]), DIM);
  say('EAT 直接指到 HAT：FAT、GAT 都檢查不到', 'search 會漏掉中間的 node');
  await beat(tok, 3000);
  kill(bad); c.ls[2] = lk(c.ns[2], c.ns[3]); tint(D(c.ns[3]), BLUE); tint(D(c.ns[4]), BLUE);
  await beat(tok, 700);
  kill(c.ls[2]);
  const brk = tag('✕ 斷掉', 'ptr alt', -0.95, 1.1, 0);
  for (let i = 3; i < 6; i++) tint(D(c.ns[i]), DIM);
  say('若某個 link 斷了，後面的 node 全部 missing', '從 first 再也走不到 FAT、GAT、HAT');
  await beat(tok, 3000);
  kill(brk); c.ls[2] = lk(c.ns[2], c.ns[3]); for (let i = 3; i < 6; i++) tint(D(c.ns[i]), BLUE);
  say('Doubly linked list：再多一個往回的指標', '每個 node：prev + data + next');
  const back = [];
  for (let i = 5; i > 0; i--) { back.push(arrow(V3(c.ns[i].position.x - 0.3, 0.5, 0.62), V3(c.ns[i - 1].position.x + 0.73, 0.5, 0.62), 0x2f7a5a)); await beat(tok, 350); }
  tag('last', 'ptr alt', c.ns[5].position.x, 1.6, 0);
  await beat(tok, 1400);
  say('東西在最後面？可以從前、後兩端同時找', 'first →    ← last');
  await beat(tok, 2400);
  kill(c.ls[2]);
  say('一個方向斷了，另一個方向的 link 還在', '每種 data structure 都有優點也有缺點');
  await beat(tok, 3200);
}]);

// ───────── lhXHk8IuFeQ 15:53：兩種 class 宣告方式 ─────────
FRAG.push(['llpeng12-class-design', 'ThreeLetterNode：外部 class vs nested class', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 5.5, 13], [0, 2.2, 0]);
  if (P.focus !== 'nested') {
    const cd = code(['class ThreeLetterList;  // forward', 'class ThreeLetterNode {', '  friend class ThreeLetterList;', 'private:', '  char data[3];', '  ThreeLetterNode *link;', '};', 'class ThreeLetterList {', 'public:  // List operations', 'private:', '  ThreeLetterNode *first;', '};'], -3.3, 6.2, 0.5);
    say('做法一：node 和 list 是兩個 class', 'composite：ThreeLetterNode 宣告在外面');
    await beat(tok, 2400);
    cd.hl(4);
    const g = node('BAT', 2.6, 0.5, 0, BLUE);
    await dropIn(tok, g);
    tag('char data[3]', 'idx', 2.2, -0.15, 1.0);
    say('node：三個字元的 data', 'char data[3]');
    await beat(tok, 1800);
    cd.hl(5);
    const g2 = node('CAT', 5.0, 0.5, 0, BLUE); lk(g, g2);
    say('加上指向下一個 node 的 link', 'ThreeLetterNode *link');
    await beat(tok, 1800);
    cd.hl(10);
    tag('first', 'ptr', 2.6, 2.0, 0); arrow(V3(2.6, 1.75, 0), V3(2.6, 0.9, 0));
    say('list 的 private 只要一個變數：first', 'ThreeLetterNode *first → 頭端');
    await beat(tok, 2200);
    cd.hl(2);
    say('外面的 node class 別的 class 也能共用', '記得多寫一行 friend class');
    await beat(tok, 2600);
    cd.kill(); fresh([0, 5.5, 13], [0, 2.2, 0]);
  }
  const cd2 = code(['class ThreeLetterList {', 'public:  // List operations', 'private:', '  class ThreeLetterNode {  // nested', '  public:', '    char data[3];', '    ThreeLetterNode *link;', '  };', '  ThreeLetterNode *first;', '};'], -3.3, 6.0, 0.5);
  say('做法二：nested class', '在 ThreeLetterList 裡面再定義 ThreeLetterNode');
  await beat(tok, 2400);
  const box1 = ghostBox('#4b9ee2', 5.4, 2.6, 2.6); box1.position.set(3.6, 1.1, 0);
  tag('ThreeLetterList', 'ptr', 3.6, 2.9, 0);
  cd2.hl(3);
  const g = node('BAT', 3.0, 0.5, 0, BLUE); lk(g, null);
  await dropIn(tok, g);
  say('node 的定義包在 list 的 private 裡', '外界看不到 ThreeLetterNode');
  await beat(tok, 2600);
  cd2.hl(-1);
  const box2 = ghostBox('#dd8238', 3.2, 2.0, 2.0); box2.position.set(3.6, 1.0, -3.4);
  tag('另一種 list', 'ptr alt', 3.6, 2.5, -3.4);
  say('另一條 list 也要同樣的 node？', '得把 node 的定義再 copy 一份 embed 進去');
  const g2 = node('BAT', 3.2, 0.5, -3.4, ORANGE);
  await dropIn(tok, g2);
  await beat(tok, 2600);
  say('兩種寫法各有優缺點', '外部 class：可共用；nested：封裝在 list 裡');
  await beat(tok, 3000);
}]);

// ───────── lhXHk8IuFeQ 20:07：x = y 與 *x = *y ─────────
FRAG.push(['llpeng12-ptr-assign', 'Pointer assignment：x = y vs *x = *y', async (tok) => {
  fresh([0, 7, 12], [0, 0.5, 0]);
  function setup() {
    const xv = cube('x', PURP, [0.8, 0.6, 0.8], -5.5, 0.4, -1.6), yv = cube('y', PURP, [0.8, 0.6, 0.8], -5.5, 0.4, 1.6);
    const a = node('a', -1.5, 0.5, -1.6, BLUE), b = node('b', -1.5, 0.5, 1.6, ORANGE);
    const na = node('…', 2.8, 0.5, -1.6, GRAY), nb = node('…', 2.8, 0.5, 1.6, GRAY);
    const xa = arrow(V3(-5.1, 0.4, -1.6), V3(-2.02, 0.4, -1.6)), yb = arrow(V3(-5.1, 0.4, 1.6), V3(-2.02, 0.4, 1.6));
    const la = lk(a, na), lb = lk(b, nb);
    return { xv, yv, a, b, na, nb, xa, yb, la, lb };
  }
  let s = setup();
  say('x 指向資料 a 的 node，y 指向資料 b 的 node', 'x、y 都是 pointer 變數');
  await beat(tok, 2600);
  const cd = code(['x = y;'], 4.6, 3.2);
  say('x = y：把 y 存的位址給 x', '複製的是「位址」');
  glow(s.yv, GOLD); await beat(tok, 1400);
  kill(s.xa); s.xa = arrow(V3(-5.1, 0.45, -1.6), V3(-2.02, 0.5, 1.4), 0xb07a10);
  tint(D(s.a), DIM);
  say('x 和 y 指向同一個 node（b）', 'x == y；原本的 a 沒人指了');
  await beat(tok, 3200);
  cd.kill(); fresh([0, 7, 12], [0, 0.5, 0]);
  s = setup();
  const cd2 = code(['*x = *y;'], 4.6, 3.2);
  say('重來：這次做 *x = *y', '複製的是 node 的「內容」');
  await beat(tok, 2200);
  glow(D(s.b), GOLD);
  say('y 所指 node 的所有欄位都 assign 給 x 所指的 node', '');
  await beat(tok, 1800);
  relabel(D(s.a), 'b'); tint(D(s.a), ORANGE);
  say('data 欄位：a 變成 b', '');
  await beat(tok, 1600);
  kill(s.la); s.la = arrow(V3(-0.54, 0.5, -1.6), V3(2.28, 0.5, 1.35), 0xb07a10);
  say('link 欄位也被複製：指向跟 b 的 link 同一個 node', '常被忽略：連 link 都動到了');
  await beat(tok, 3000);
  glow(D(s.b), null);
  glow(s.xv, GOLD); glow(s.yv, GOLD);
  say('但 x、y 還是指向不同的記憶體位址', 'x != y，只是兩個 node 內容一樣');
  await beat(tok, 3000);
  cd2.hl(-1);
}]);

// ───────── lhXHk8IuFeQ 33:36：Create2 ─────────
FRAG.push(['llpeng12-create2', 'Create2：建立含 10、20 的兩個 node', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.6, 0]);
  const cd = code(['void List::Create2() {', '  first = new ListNode(10);', '  first->link = new ListNode(20);', '}', 'ListNode(int element = 0)', '  { data = element; link = 0; }'], -3.2, 5.6, 0.5);
  say('Create2：在 linked list 裡產生兩個 node', '目標：first → 10 → 20 → NULL');
  await beat(tok, 2600);
  cd.hl(1);
  const a = node(10, 0.8, 0.5, 0, BLUE);
  await dropIn(tok, a);
  cd.hl(5);
  let n1 = lk(a, null);
  say('constructor：data = 10，link = 0', 'link = 0 就當作 NULL');
  await beat(tok, 2400);
  cd.hl(1);
  tag('first', 'ptr', 0.8, 2.1, 0); arrow(V3(0.8, 1.85, 0), V3(0.8, 0.9, 0));
  say('new 回傳的位址存進 first', 'first = new ListNode(10)');
  await beat(tok, 2200);
  cd.hl(2);
  const b = node(20, 3.7, 0.5, 0, ORANGE);
  await dropIn(tok, b);
  lk(b, null);
  say('第二行：再 new 一個 20 的 node', 'new ListNode(20)：link 也是 0');
  await beat(tok, 2000);
  kill(n1); lk(a, b);
  say('它的位址 assign 給 first->link', 'first->link = new ListNode(20)');
  await beat(tok, 2600);
  cd.hl(-1);
  say('兩個指令就建好兩個 node 的 list', 'first → 10 → 20 → NULL');
  await beat(tok, 2800);
}]);

// ───────── lhXHk8IuFeQ 37:23：Insert50(x) ─────────
FRAG.push(['llpeng12-insert50', 'Insert50：把 50 插在 x 後面', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.8, 0]);
  const cd = code(['void List::Insert50(ListNode *x) {', '  ListNode *t = new ListNode(50);', '  if (!first) { first = t; return; }', '  t->link = x->link;', '  x->link = t;', '}'], -2.8, 6.2, 0.5);
  const c = chainOf([10, 20], -3.0, 4.6);
  tag('first', 'ptr', -3.0, 1.7, 0);
  const xl = tag('x', 'ptr alt', -3.0, 2.3, 0);
  say('Insert50(x)：50 插在指定的 node x 後面', 'x 指向第一個 node 10 → 結果 10 → 50 → 20');
  await beat(tok, 2800);
  cd.hl(1);
  const t = node(50, -0.6, 2.6, 0, ORANGE);
  await dropIn(tok, t);
  const tl = tag('t', 'ptr', -0.6, 3.5, 0);
  say('先 new 一個 50 的 node，pointer t 指向它', 't = new ListNode(50)');
  await beat(tok, 2200);
  cd.hl(2);
  say('如果 list 是空的：50 就是第一個 node', '這個例子不是空的（已有 10、20）');
  await beat(tok, 2400);
  cd.hl(3); glow(D(c.ns[0]), GOLD);
  const a1 = lk(t, c.ns[1]);
  say('① 50 先接手 x 原本的 link', 't->link = x->link → 50 指向 20');
  await beat(tok, 2800);
  cd.hl(4);
  kill(c.ls[0]); c.ls[0] = lk(c.ns[0], t);
  say('② 再讓 x 指向 50', 'x->link = t');
  await beat(tok, 2600);
  glow(D(c.ns[0]), null); cd.hl(-1);
  kill(a1); kill(xl); kill(tl);
  await Promise.all([slide(tok, t, -0.9, 0.5, 0, 600), slide(tok, c.ns[1], 1.2, 0.5, 0, 600)]);
  c.ns.splice(1, 0, t); relinkAll(c);
  say('完成：10 → 50 → 20', '');
  await beat(tok, 1800);
  say('順序可以顛倒嗎？先做 x->link = t…', '那 20 的位址就沒人記得了 → lost');
  tint(D(c.ns[2]), DIM);
  await beat(tok, 3000);
  tint(D(c.ns[2]), ORANGE);
  say('一定要先 t->link = x->link，再 x->link = t', '把圖畫出來就不會寫反');
  await beat(tok, 2600);
}]);

// ───────── lhXHk8IuFeQ 42:41：刪除第一個 node ─────────
FRAG.push(['llpeng12-delete-first', '刪除第一個 node：ptr = ptr->link', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const c = chainOf([10, 50, 20], -2.6, 2.6);
  const pv = cube('ptr', PURP, [1.0, 0.6, 0.8], -6.0, 0.4, 0);
  let pa = arrow(V3(-5.5, 0.4, 0), V3(-3.12, 0.45, 0));
  const cd = code(['ptr = ptr->link;'], 1.0, 3.6);
  say('list：10、50、20，ptr（或叫 first）指向頭端', '要刪掉第一個元素 10');
  await beat(tok, 2600);
  glow(D(c.ns[0]), RED);
  say('刪掉後，ptr 要指向第二個 node', '第二個 node 的位址在哪？');
  await beat(tok, 2200);
  cd.hl(0);
  const lkf = tag('ptr->link', 'ptr alt', -1.9, 1.3, 0);
  say('就在第一個 node 的 link 欄位裡', 'ptr->link → 50');
  await beat(tok, 2400);
  kill(pa); pa = arrow(V3(-5.5, 0.4, 0), V3(-0.52, 0.45, 0.25), 0xb07a10);
  say('把它 assign 給 ptr', 'ptr = ptr->link');
  await beat(tok, 2200);
  kill(lkf); kill(c.ls[0]); fly(c.ns[0]); c.ns.shift(); c.ls.shift();
  await beat(tok, 800);
  say('怎麼可以把自己的欄位給自己？', 'ptr 是 pointer 變數，不是那個 node');
  glow(pv, GOLD);
  await beat(tok, 2800);
  say('ptr->link 也是 pointer：只是指標賦值', '結果：ptr → 50 → 20');
  await beat(tok, 3000);
}]);

// ───────── lhXHk8IuFeQ 45:48：刪除中間的 node ─────────
FRAG.push(['llpeng12-delete-mid', '刪除中間的 node：trail->link = x->link', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const c = chainOf([10, 50, 20], -3.4, 2.8);
  tag('first', 'ptr', -3.4, 1.6, 0);
  const cd = code(['trail->link = x->link;', 'delete x;   // 要不要做？'], 0.5, 4.2);
  say('要刪的 node 不是第一個：刪中間的 50', '結果：10 直接指向 20');
  await beat(tok, 2600);
  const tl = tag('trail', 'ptr alt', -3.4, 2.2, 0), xl = tag('x', 'ptr alt', -0.6, 1.6, 0);
  glow(D(c.ns[1]), RED);
  say('x 指向 50，trail 指向它前一個 node', '要改的是「前一個」的 link');
  await beat(tok, 2600);
  cd.hl(0);
  kill(c.ls[0]); kill(c.ls[1]);
  await slide(tok, c.ns[1], -0.6, 2.4, -0.6, 500); xl.position.set(-0.6, 3.3, -0.6);
  const a = lk(c.ns[1], c.ns[2]);
  c.ls[0] = arrow(V3(-2.44, 0.5, 0), V3(1.68, 0.5, 0));
  glow(D(c.ns[0]), GOLD);
  say('把 50 的 link（→20）抄給 10 的 link', 'trail->link = x->link');
  await beat(tok, 3000);
  glow(D(c.ns[0]), null); cd.hl(1);
  say('50 已經不在 list 上了', '接著可以 delete 它，把記憶體還回去');
  await beat(tok, 2000);
  kill(a); kill(xl); fly(c.ns[1]);
  await beat(tok, 900);
  cd.hl(-1);
  say('看圖說故事：畫出前後兩張圖', '10 → 20');
  await beat(tok, 2600);
}]);

// ───────── lhXHk8IuFeQ 46:46／U_tNDdEooJU 44:04、49:07：delete 還是放進 free pool ─────────
FRAG.push(['llpeng12-free-pool', '刪掉的 node：delete 還是放進 free pool', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  const poly = !!P.poly;
  const VALS = poly ? ['3,14', '2,8', '1,0', '8,14', '-3,10', '10,6'] : ['50'];
  const sys = ghostBox('#7a6a55', 3.2, 2.2, 2.2); sys.position.set(-4.8, 1.1, -1.5);
  tag('系統記憶體', 'ptr', -4.8, 2.6, -1.5);
  const X = (i) => (poly ? -2.5 + i * 1.5 : 0);
  const mk = () => VALS.map((v, i) => cube(v, poly ? (i < 3 ? TEAL : ORANGE) : ORANGE, [1.2, 0.7, 1.0], X(i), 0.35, 1.2));
  let ns = mk();
  say(poly ? 'a + b 算完，a、b 的 6 個 node 不用了' : '50 的 node 已經從 list 上拿掉', poly ? '這些空間可以 release 出來' : '要不要 delete 它？沒有標準答案');
  await beat(tok, 2800);
  say('做法一：delete 掉，記憶體還給系統', poly ? 'list destructor：6 個 node 一個個 delete' : 'delete x;');
  for (const m of ns) { fly(m, V3(-4, 6, -3)); await beat(tok, 300); }
  await beat(tok, 1600);
  say('以後要 new 時，又得跟系統要記憶體', 'new 會呼叫 system call → overhead');
  await beat(tok, 2600);
  const pool = ghostBox('#2fc092', 6.0, 1.6, 2.0); pool.position.set(3.0, 0.7, -1.8);
  tag(poly ? 'free pool（資源回收場）' : 'free list', 'ptr alt', 3.0, 2.1, -1.8);
  ns = mk();
  say('做法二：先不還給系統，放進另一條 free list', poly ? '用完的 6 個 node 丟進 free pool' : '刪掉的 node 串到 free list 上');
  await beat(tok, 1400);
  for (let i = 0; i < ns.length; i++) { await slide(tok, ns[i], 0.8 + i * (poly ? 0.9 : 1) + (poly ? 0 : 2), 0.35, -1.8, 300); tint(ns[i], '#8fcfb8'); }
  await beat(tok, 1400);
  say(poly ? '新的 user 要建立多項式' : '之後要 new 一個 node', '先去 free list 拿一個');
  await beat(tok, 1600);
  const take = ns.slice(0, poly ? 3 : 1);
  for (let i = 0; i < take.length; i++) { await slide(tok, take[i], -1.5 + i * 1.5, 0.35, 2.2, 350); tint(take[i], PURP); relabel(take[i], poly ? ['5,9', '4,3', '7,0'][i] : '70'); }
  say('只要改掉 data（係數、指數）就能重用', '不用再跟系統要記憶體');
  await beat(tok, 2600);
  say('好處：少了 create 新 node 的 overhead', '資源再利用');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 02:32：為什麼要 ListIterator ─────────
FRAG.push(['llpeng12-iter-why', 'ListIterator：把共用的 list 操作抽出來', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const names = ['List<A>', 'List<B>', 'List<C>'], xs = [-4.4, 0, 4.4];
  const OPS = ['NotNull', 'NextNotNull', 'First', 'Next'];
  const boxes = [], ops = [];
  for (let k = 0; k < 3; k++) {
    const b = ghostBox(['#4b9ee2', '#dd8238', '#2fc092'][k], 3.4, 2.6, 2.2); b.position.set(xs[k], 1.3, 0); boxes.push(b);
    tag(names[k], 'ptr', xs[k], 2.95, 0);
    const row = [];
    for (let i = 0; i < 4; i++) row.push(cube(OPS[i], '#e3d6bd', [1.5, 0.45, 0.8], xs[k] + (i % 2 ? 0.8 : -0.8), 0.3 + Math.floor(i / 2) * 0.6, 0));
    ops.push(row);
    say('每一種 list 都需要 scan、判斷 NULL、取 first/next', names[k] + '：又寫一次同樣的 operation');
    for (const m of row) await dropIn(tok, m, 180);
    await beat(tok, 900);
  }
  say('同樣的 operation 重複寫了三次', '這些不應該綁死在 list class 裡');
  ops.flat().forEach((m) => glow(m, RED));
  await beat(tok, 2600);
  ops.flat().forEach((m) => fly(m, V3(0, 7, 3)));
  await beat(tok, 900);
  const it = cube('ListIterator', PURP, [3.2, 0.8, 1.2], 0, 0.4, 3.6);
  await dropIn(tok, it, 450);
  for (const x of xs) arrow(V3(x * 0.3, 0.8, 3.0), V3(x, 0.9, 1.15), 0x6a4ec0);
  say('抽出來成為一個 class：ListIterator', '更 high-level：任何 type 的 list 都能用');
  await beat(tok, 3000);
  OPS.forEach((o, i) => tag(o + '()', 'idx', -2.4 + i * 1.6, 0, 4.6));
  say('只要寫一次', 'NotNull / NextNotNull / First / Next');
  await beat(tok, 3000);
}]);

// ───────── U_tNDdEooJU 05:01：ListIterator 的宣告與運作 ─────────
FRAG.push(['llpeng12-iter-scan', 'ListIterator：list 參考與 current 指標', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.9, 0]);
  const cd = code(['template <class Type> class ListIterator {', 'public:', '  ListIterator(const List<Type>& l)', '    : list(l), current(l.first) {}', '  Boolean NotNull();', '  Boolean NextNotNull();', '  Type* First();', '  Type* Next();', 'private:', '  const List<Type>& list;', '  ListNode<Type>* current;', '};'], -3.0, 6.4, 0.46);
  const c = chainOf([10, 50, 20], 0.6, 2.2, 0.5, 0);
  tag('l.first', 'ptr', 0.6, 1.6, 0);
  say('三個 class：ListNode、List、ListIterator', 'List 只剩 private 的 first，要宣告 friend');
  await beat(tok, 2800);
  cd.hl(9);
  const lb = ghostBox('#4b9ee2', 6.8, 1.4, 1.6); lb.position.set(2.8, 0.5, 0);
  say('private：list 參考到要處理的那條 list', '不管哪種 type 的 list 都可以丟進來');
  await beat(tok, 2400);
  cd.hl(3);
  const cur = tag('current', 'ptr alt', 0.6, -0.3, 1.0);
  const r = ring(); ringAt(r, c.ns[0]);
  say('建構時 current = l.first', '目前處理到第一個 node');
  await beat(tok, 2400);
  cd.hl(6); glow(D(c.ns[0]), GOLD);
  say('First()：回傳 list 的第一個元素', '→ 10');
  await beat(tok, 2000); glow(D(c.ns[0]), null);
  for (let i = 1; i < 3; i++) {
    cd.hl(5); say('NextNotNull()：下一個不是 NULL？', 'current->link != 0 → true'); await beat(tok, 1400);
    cd.hl(7); ringAt(r, c.ns[i]); cur.position.set(c.ns[i].position.x, -0.3, 1.0); glow(D(c.ns[i]), GOLD);
    say('Next()：current 往下走，回傳下一個元素', '→ ' + [10, 50, 20][i]);
    await beat(tok, 1600); glow(D(c.ns[i]), null);
  }
  cd.hl(5);
  say('NextNotNull()：20 的下一個是 NULL', 'false → scan 結束');
  await beat(tok, 2200);
  cd.hl(-1);
  say('list 的操作都在 ListIterator，寫一次就好', 'ListNode + List + ListIterator');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 08:46：Attach 到尾端 ─────────
FRAG.push(['llpeng12-attach', 'Attach：把 node 接到 list 尾巴', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const cd = code(['newnode = new ListNode(k);', 'if (first == 0) first = newnode;', 'else { 走到 link == 0 的 node;', '       接上 newnode; }'], -3.2, 4.8, 0.5);
  say('Attach：在 list 的尾巴加一個 node', '只知道 first，尾巴在哪？');
  await beat(tok, 2400);
  cd.hl(1);
  const f0 = tag('first = 0', 'ptr', 2.5, 1.6, 0);
  say('情況一：一開始 list 是空的', 'first == 0');
  await beat(tok, 1800);
  const e = node('k', 2.5, 0.5, 0, ORANGE); await dropIn(tok, e); const en = lk(e, null);
  txt(f0, 'first');
  say('新 node 直接就是第一個', 'first = newnode（課本同時 last = newnode）');
  await beat(tok, 2600);
  kill(f0); kill(en); kill(e); cd.hl(-1);
  const c = chainOf([10, 50, 20], -4.6, 2.3);
  tag('first', 'ptr', -4.6, 1.6, 0);
  say('情況二：list 裡已經有 node', '從頭端開始 scan');
  await beat(tok, 1800);
  cd.hl(2);
  const r = ring();
  for (let i = 0; i < 3; i++) {
    ringAt(r, c.ns[i]); glow(D(c.ns[i]), GOLD);
    say('檢查 link 是不是 0（NULL）', i < 2 ? '不是 0 → 還有元素，往下走' : '是 0 → 到尾端了');
    await beat(tok, 1300); glow(D(c.ns[i]), null);
  }
  cd.hl(3);
  const k = node('k', -4.6 + 3 * 2.3, 0.5, 0, ORANGE); await dropIn(tok, k);
  kill(c.ls[2]); c.ls[2] = lk(c.ns[2], k); lk(k, null);
  say('把新 node 接在最後一個 node 後面', 'traverse 整條 list：O(n)');
  await beat(tok, 2800);
  r.visible = false; cd.hl(-1);
  tag('last', 'ptr alt', -4.6 + 3 * 2.3, 1.6, 0);
  say('補充：多記一個 last 指標就不用走', 'last->link = newnode; last = newnode → O(1)');
  await beat(tok, 3200);
}]);

// ───────── U_tNDdEooJU 11:59：Invert（p、q、r 三個指標） ─────────
FRAG.push(['llpeng12-invert', 'Invert：用 p、q、r 反轉 linked list', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const cd = code(['p = first; q = 0;', 'while (p) {', '  r = q;  q = p;', '  p = p->link;', '  q->link = r;', '}', 'first = q;'], -4.3, 6.2, 0.5);
  const V = ['a', 'b', 'c', 'd'];
  const ns = V.map((v, i) => node(v, -1.5 + i * 2.2, 0.5, 0, BLUE));
  let nxt = [1, 2, 3, -1];
  let ls = ns.map((g, i) => lk(g, nxt[i] < 0 ? null : ns[nxt[i]]));
  const fl = tag('first', 'ptr', -1.5, 2.3, 0);
  say('Invert：頭變尾、尾變頭', '每個 link 都要轉 180 度');
  await beat(tok, 2600);
  const pos = (i) => (i < 0 ? V3(-3.4, 0.5, 0) : ns[i].position);
  const pl = tag('p', 'ptr alt', 0, 0, 0), ql = tag('q', 'ptr', 0, 0, 0), rl = tag('r', 'ptr', 0, 0, 0);
  const put = (l, i, dz) => { const v = pos(i); l.position.set(v.x, -0.25, v.z + dz); showL(l, i !== -9); };
  let p = 0, q = -1, r = -9;
  const q0 = tag('0', 'idx', -3.4, 0.5, 0);
  cd.hl(0); put(pl, p, 1.0); put(ql, q, 1.6); showL(rl, false);
  say('p 是先鋒，q 跟著 p，r 跟著 q', 'p = first；q = 0');
  await beat(tok, 2600);
  let round = 0;
  while (p >= 0) {
    round++;
    cd.hl(2); r = q; q = p; put(rl, r, 2.2); showL(rl, true); put(ql, q, 1.6);
    say('第 ' + round + ' 輪：r = q；q = p', 'r 退到 q 的位置，q 追上 p');
    await beat(tok, 1500);
    cd.hl(3); p = nxt[p]; if (p >= 0) put(pl, p, 1.0); else { pl.position.set(ns[3].position.x + 1.6, -0.25, 1.0); txt(pl, 'p = 0'); }
    say('p = p->link：p 往前一格', p >= 0 ? 'p → ' + V[p] : 'p 走到 0');
    await beat(tok, 1500);
    cd.hl(4); nxt[q] = r < 0 ? -2 : r;
    ls.forEach(kill); ls = ns.map((g, i) => (nxt[i] === -1 ? lk(g, null) : nxt[i] === -2 ? lk(g, null, { below: true, text: '0' }) : lk(g, ns[nxt[i]])));
    glow(D(ns[q]), GOLD);
    say('q->link = r：q 的 node 改指向前一個', r < 0 ? V[q] + ' 的 link = 0（變成尾巴）' : V[q] + ' → ' + V[r]);
    await beat(tok, 1900); glow(D(ns[q]), null);
  }
  cd.hl(5);
  say('p == 0 跳出迴圈：q 指著原本的最後一個 node', '它就是反轉後的頭');
  await beat(tok, 2400);
  cd.hl(6); await slide(tok, fl, ns[3].position.x, 2.3, 0, 600);
  say('最後一行不能忘：first = q', 'd → c → b → a → 0');
  await beat(tok, 3000);
}]);

// ───────── U_tNDdEooJU 23:25：反轉的其他做法 ─────────
FRAG.push(['llpeng12-invert-alt', '反轉的笨方法：new 一條新 list', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.4]);
  const V = ['a', 'b', 'c', 'd'];
  const c = chainOf(V, -5.6, 2.3, 0.5, -1.8);
  tag('原本的 list', 'ptr', -5.6, 1.6, -1.8);
  say('反轉不是唯一做法：最笨的做法？', 'new 一條新的 list');
  await beat(tok, 2600);
  const nf = tag('新 list：first = 0', 'ptr alt', 0, 1.7, 2.0);
  const nn = []; let ls = [];
  const r = ring();
  for (let i = 0; i < 4; i++) {
    ringAt(r, c.ns[i]); glow(D(c.ns[i]), GOLD);
    say('依序讀原 list 的第 ' + (i + 1) + ' 個：' + V[i], '複製一個 node，插到新 list 的「最前面」');
    await beat(tok, 900);
    nn.forEach((g, k) => { g.position.x += 2.3; });
    const g = node(V[i], -5.6, 0.5, 2.0, ORANGE); nn.unshift(g);
    await dropIn(tok, g, 350);
    ls.forEach(kill); ls = nn.map((h, k) => lk(h, nn[k + 1] || null));
    txt(nf, '新 list：first → ' + V[i]);
    glow(D(c.ns[i]), null);
    await beat(tok, 900);
  }
  r.visible = false;
  say('讀完：新 list 剛好是反轉的順序', 'd → c → b → a');
  await beat(tok, 2400);
  say('用 stack 也行：全部 push 再 pop 出來', '代價：要多用記憶體產生新的 node');
  await beat(tok, 3200);
  say('前面 p、q、r 的做法不產生新 node', '看不懂程式？把每一輪的圖畫出來');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 26:30：Concatenate ─────────
FRAG.push(['llpeng12-concat', 'Concatenate：A 的尾巴接到 b.first', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const cd = code(['if (!first) { first = b.first; return; }', 'if (b.first) {', '  for (p = first; p->link; p = p->link);', '  p->link = b.first;', '}'], -1.6, 6.0, 0.5);
  const A = chainOf(['a₁', 'a₂', 'a₃'], -6.0, 2.1, 0.5, 0, BLUE);
  const B = chainOf(['b₁', 'b₂'], 1.8, 2.1, 0.5, 0, ORANGE);
  tag('first', 'ptr', -6.0, 1.6, 0); tag('b.first', 'ptr alt', 1.8, 1.6, 0);
  say('把兩條 linked list A、B 串成一條', 'A 尾巴原本指向 0，改成指向 b.first');
  await beat(tok, 2800);
  cd.hl(2);
  say('先找到 A 的尾巴', 'for 迴圈本體是空的，只負責移動 p');
  const pl = tag('p', 'ptr alt', -6.0, -0.3, 1.0);
  const r = ring();
  for (let i = 0; i < 3; i++) {
    ringAt(r, A.ns[i]); pl.position.set(A.ns[i].position.x, -0.3, 1.0);
    say(i < 2 ? 'p->link 不是 0 → p = p->link' : 'p->link == 0 → 跳出迴圈', i < 2 ? '' : 'p 停在最後一個 node');
    await beat(tok, 1300);
  }
  cd.hl(3);
  kill(A.ls[2]); A.ls[2] = lk(A.ns[2], B.ns[0]);
  glow(D(A.ns[2]), GOLD);
  say('p->link = b.first：把線連上', 'a₁ → a₂ → a₃ → b₁ → b₂');
  await beat(tok, 3000);
  glow(D(A.ns[2]), null); r.visible = false; kill(pl);
  cd.hl(0);
  A.ns.forEach((g) => tint(D(g), DIM));
  say('第一行是防呆：A 是空的怎麼辦？', 'first == 0 → 直接 first = b.first');
  await beat(tok, 3000);
  cd.hl(-1);
  say('A 空的就不用跑 for 迴圈', '找尾巴：O(A 的長度)');
  await beat(tok, 2600);
}]);

// ───────── U_tNDdEooJU 30:57：List destructor ─────────
FRAG.push(['llpeng12-destructor', 'List destructor：一個一個 delete', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  const cd = code(['List::~List() {', '  ListNode *next;', '  for (; first; first = next) {', '    next = first->link;', '    delete first;', '  }', '}'], -3.6, 5.4, 0.5);
  const c = chainOf([10, 50, 20], -0.4, 2.3);
  const fl = tag('first', 'ptr', -0.4, 1.6, 0);
  const nl = tag('next', 'ptr alt', -0.4, -0.3, 1.0); showL(nl, false);
  say('list 不要了：destructor 把所有 node free 掉', '');
  await beat(tok, 2400);
  for (let i = 0; i < 3; i++) {
    cd.hl(2); say('first 不是空的 → 進迴圈', ''); await beat(tok, 1000);
    cd.hl(3); showL(nl, true);
    if (i < 2) nl.position.set(c.ns[i + 1].position.x, -0.3, 1.0); else { nl.position.set(c.ns[i].position.x + 1.5, -0.3, 1.0); txt(nl, 'next = 0'); }
    say('先記下一個：next = first->link', i < 2 ? 'next → ' + [10, 50, 20][i + 1] : 'next = 0');
    await beat(tok, 1300);
    cd.hl(4); kill(c.ls[i]); fly(c.ns[i]);
    say('delete first：把自己刪掉', '刪掉 ' + [10, 50, 20][i]);
    await beat(tok, 1100);
    cd.hl(2);
    if (i < 2) fl.position.set(c.ns[i + 1].position.x, 1.6, 0); else txt(fl, 'first = 0');
    say('first = next：往下走一格', '');
    await beat(tok, 1100);
  }
  cd.hl(-1);
  say('每次拿一個 node 出來刪掉', 'first == 0 → 結束，list 清空');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 32:32：Circular linked list ─────────
FRAG.push(['llpeng12-circular', 'Circular linked list：沒有 NULL，要靠 last', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0.3]);
  const c = chainOf(['a', 'b', 'c', 'd'], -4.0, 2.4);
  tag('first', 'ptr', -4.0, 1.6, 0);
  say('一般 linked list：尾巴指向 NULL', '判斷尾巴：link == 0');
  await beat(tok, 2400);
  kill(c.ls[3]);
  c.ls[3] = lk(c.ns[3], c.ns[0]);
  say('環狀：最後一個 node 指回頭端', '整條變成一個圓圈');
  await beat(tok, 2600);
  const r = ring();
  for (let k = 0; k < 6; k++) { ringAt(r, c.ns[k % 4]); await beat(tok, 380); }
  say('一直繞，永遠遇不到 NULL', '不能再用「是不是 NULL」找尾巴');
  await beat(tok, 2200);
  r.visible = false;
  tag('last', 'ptr alt', c.ns[3].position.x, 1.6, 0);
  glow(D(c.ns[3]), GOLD);
  say('所以多一個指標 last 指向最後一個 node', 'last->link 就是 first');
  await beat(tok, 3000);
  say('走訪的停止條件改成：回到頭端', 'p->link == first');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 33:43：用 linked list 實作 stack 與 queue ─────────
FRAG.push(['llpeng12-linked-sq', '用 linked list 實作 Stack 與 Queue', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.2]);
  tag('Linked Stack', 'ptr', -6.0, 1.3, -2.0); tag('Linked Queue', 'ptr', -6.0, 1.3, 2.2);
  const S = chainOf([3, 2, 1], -2.0, 2.2, 0.5, -2.0, BLUE);
  const tl = tag('top', 'ptr alt', -2.0, 1.5, -2.0);
  say('Stack 不一定要用 array', 'linked stack：top 就是 first');
  await beat(tok, 2600);
  const n4 = node(4, -4.2, 0.5, -2.0, ORANGE); await dropIn(tok, n4);
  S.ns.unshift(n4); relinkAll(S); tl.position.set(-4.2, 1.5, -2.0);
  say('push：新 node 接在最前面，top 指向它', 'O(1)，沒有 isFull');
  await beat(tok, 2400);
  S.ls.forEach(kill); S.ls = []; fly(S.ns.shift()); relinkAll(S); tl.position.set(-2.0, 1.5, -2.0);
  say('pop：拿掉 top 指的那個 node', 'top = top->link');
  await beat(tok, 2400);
  const Q = chainOf([1, 2, 3], -2.0, 2.2, 0.5, 2.2, TEAL);
  const fq = tag('front', 'ptr', -2.0, 1.5, 2.2), rq = tag('rear', 'ptr alt', 2.4, 1.5, 2.2);
  say('Queue 也一樣：一端是頭（front）、一端是尾（rear）', '');
  await beat(tok, 2400);
  const q4 = node(4, 4.6, 0.5, 2.2, ORANGE); await dropIn(tok, q4);
  Q.ns.push(q4); relinkAll(Q); rq.position.set(4.6, 1.5, 2.2);
  say('enqueue：接在 rear 後面', 'rear->link = 新 node；rear = 新 node');
  await beat(tok, 2400);
  Q.ls.forEach(kill); Q.ls = []; fly(Q.ns.shift()); relinkAll(Q); fq.position.set(0.2, 1.5, 2.2);
  say('dequeue：從 front 拿掉', 'front = front->link');
  await beat(tok, 2400);
  say('Stack、Queue 是 data structure', '可以用 array，也可以用 linked list 實作');
  await beat(tok, 3000);
}]);

// ───────── U_tNDdEooJU 35:09：用 linked list 表示多項式 ─────────
FRAG.push(['llpeng12-poly-nodes', '多項式的 linked list：coef | exp | link', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.3]);
  tag('a = 3x¹⁴ + 2x⁸ + 1', 'ptr', -1.0, 2.0, -1.8);
  const T = [[3, 14], [2, 8], [1, 0]];
  const ns = [];
  for (let i = 0; i < 3; i++) { ns.push(pnode(T[i][0], T[i][1], -4.0 + i * 3.2, 0.5, -1.8)); await dropIn(tok, ns[i], 350); }
  say('每一項一個 node', 'a = 3x¹⁴ + 2x⁸ + 1：三個 node');
  await beat(tok, 2000);
  tag('coef', 'idx', -4.42, -0.15, -0.8); tag('exp', 'idx', -3.58, -0.15, -0.8); tag('link', 'idx', -2.95, -0.15, -0.8);
  glow(ns[0].userData.data, GOLD);
  say('三個欄位：係數、指數、link', '3 是係數，14 是指數');
  await beat(tok, 2600);
  glow(ns[0].userData.data, null);
  for (let i = 0; i < 3; i++) { plk(ns[i], ns[i + 1] || null); await beat(tok, 500); }
  say('1 = 1·x⁰ 是最後一項：link = 0', '指數由大排到小');
  await beat(tok, 2400);
  tag('2x¹⁰⁰⁰ + 1', 'ptr alt', -1.0, 2.0, 2.2);
  const s1 = pnode(2, 1000, -2.6, 0.5, 2.2, ORANGE), s2 = pnode(1, 0, 1.0, 0.5, 2.2, ORANGE);
  await dropIn(tok, s1, 350); await dropIn(tok, s2, 350);
  plk(s1, s2); plk(s2, null);
  say('上次的 sparse 例子：2x¹⁰⁰⁰ + 1', '只要 2 個 node，不用開 1001 格的 array');
  await beat(tok, 3000);
  say('linked list 可以解決 sparse 的問題', '缺點呢？回去想想');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 37:22：Term、Polynomial 與 operator+ ─────────
FRAG.push(['llpeng12-poly-class', 'Polynomial class 與 operator+ overloading', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.0, 0]);
  const cd = code(['struct Term {', '  int coef;  int exp;', '};', 'class Polynomial {', '  friend Polynomial operator+(', '    const Polynomial&, const Polynomial&);', 'private:', '  List<Term> poly;', '};'], -3.0, 6.0, 0.5);
  cd.hl(1);
  const t = pnode(3, 14, 2.6, 0.5, 0);
  await dropIn(tok, t);
  say('List node 的 element 是一個 Term', 'Term = 係數 coef + 指數 exp');
  await beat(tok, 2600);
  cd.hl(7);
  const b = ghostBox('#2fc092', 7.0, 1.5, 1.6); b.position.set(4.9, 0.5, 0);
  const t2 = pnode(2, 8, 5.6, 0.5, 0); plk(t, t2); plk(t2, null);
  tag('List<Term> poly', 'ptr', 4.4, 1.6, 0);
  say('Polynomial 的 private：一條 List<Term>', 'data type 就是 Term');
  await beat(tok, 2600);
  cd.hl(4);
  say('friend Polynomial operator+ 是在做什麼？', 'C++：operator overloading');
  await beat(tok, 2600);
  const e = tag('c = a + b;', 'ptr alt', 3.0, 3.6, 1.5);
  say('宣告 Polynomial a, b 之後寫 a + b', '這個 + 已經被 redefine');
  await beat(tok, 2400);
  arrow(V3(3.0, 3.3, 1.5), V3(-0.5, 3.8, 0.2), 0xb07a10);
  say('看到兩個 Polynomial 相加，就跳到自己定義的加法', '改成「多項式的加」');
  await beat(tok, 3000);
  cd.hl(-1);
}]);

// ───────── U_tNDdEooJU 40:10：多項式加法 ─────────
FRAG.push(['llpeng12-poly-add', '多項式加法：p、q 一路比指數', async (tok) => {
  fresh([0, 8, 12.5], [0, 0.4, 0.4]);
  const A = [[3, 14], [2, 8], [1, 0]], B = [[8, 14], [-3, 10], [10, 6]];
  tag('a', 'ptr', -6.6, 0.5, -3.0); tag('b', 'ptr', -6.6, 0.5, -0.6); tag('c', 'ptr alt', -6.6, 0.5, 2.6);
  const an = A.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.4, 0.5, -3.0));
  const bn = B.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.4, 0.5, -0.6, ORANGE));
  an.forEach((g, i) => plk(g, an[i + 1] || null)); bn.forEach((g, i) => plk(g, bn[i + 1] || null));
  say('p、q 指向 a、b 的第一個 node', 'a = 3x¹⁴ + 2x⁸ + 1，b = 8x¹⁴ − 3x¹⁰ + 10x⁶');
  const pl = tag('p', 'ptr alt', 0, 0, 0), ql = tag('q', 'ptr alt', 0, 0, 0);
  const put = (l, arr, i, z) => { if (i < arr.length) l.position.set(arr[i].position.x - 0.4, 1.3, z); else { l.position.set(5.6, 1.3, z); txt(l, l === pl ? 'p = 0' : 'q = 0'); } };
  let i = 0, j = 0; put(pl, an, 0, -3.0); put(ql, bn, 0, -0.6);
  await beat(tok, 3000);
  const cn = [];
  const emit = async (c, e, why, f) => {
    const g = pnode(c, e, -4.6 + cn.length * 2.45, 0.5, 2.6, PURP);
    await dropIn(tok, g, 380);
    if (cn.length) plk(cn[cn.length - 1], g);
    cn.push(g);
    say(why, f);
    await beat(tok, 2100);
  };
  while (i < 3 || j < 3) {
    const ea = i < 3 ? A[i][1] : -1, eb = j < 3 ? B[j][1] : -1;
    if (i < 3) glow(an[i].userData.exp, GOLD); if (j < 3) glow(bn[j].userData.exp, GOLD);
    say('比較指數：' + (i < 3 ? ea : '—') + ' vs ' + (j < 3 ? eb : '—'), ea === eb ? '相同 → 係數相加' : '不同 → copy 指數大的那項');
    await beat(tok, 1500);
    if (i < 3) glow(an[i].userData.exp, null); if (j < 3) glow(bn[j].userData.exp, null);
    if (ea === eb) { await emit(A[i][0] + B[j][0], ea, '係數 ' + A[i][0] + ' + ' + B[j][0] + ' = ' + (A[i][0] + B[j][0]) + '，new 一個 node 放進 c', 'p、q 都往下走'); i++; j++; }
    else if (ea > eb) { await emit(A[i][0], ea, 'copy p 那項：' + termStr(A[i][0], ea), 'p 往下走'); i++; }
    else { await emit(B[j][0], eb, 'copy q 那項：' + termStr(B[j][0], eb), 'q 往下走'); j++; }
    put(pl, an, i, -3.0); put(ql, bn, j, -0.6);
  }
  plk(cn[cn.length - 1], null);
  say('p、q 都到 0：結束', 'c = 11x¹⁴ − 3x¹⁰ + 2x⁸ + 10x⁶ + 1');
  await beat(tok, 3200);
}]);

// ───────── U_tNDdEooJU 51:22、53:26：GetNode／RetNode ─────────
FRAG.push(['llpeng12-av-getret', 'GetNode／RetNode：從 av 拿、還回 av', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const av = chainOf(['', '', ''], -1.2, 2.3, 0.5, 0, '#8fcfb8');
  const avl = tag('av', 'ptr alt', -1.2, 1.6, 0);
  tag('free pool（available list）', 'idx', 1.1, -0.3, 1.2);
  if (P.op !== 'ret') {
    const cd = code(['ListNode* GetNode() {', '  ListNode *x;', '  if (!av) x = new ListNode;', '  else { x = av; av = av->link; }', '  return x;', '}'], -3.6, 6.2, 0.5);
    say('要一個新 node：先去 free pool 看看', 'av 指向 free pool 的第一個 node');
    await beat(tok, 2600);
    cd.hl(2);
    say('av 是空的 → 回收場沒東西', '只好跟系統 new 一個');
    await beat(tok, 2200);
    cd.hl(3);
    const xl = tag('x', 'ptr', -1.2, 2.2, 0);
    say('有的話：x = av', 'x 拿到 free pool 的第一個 node');
    await beat(tok, 2000);
    kill(av.ls[0]); avl.position.set(1.1, 1.6, 0);
    say('av = av->link：av 往下移一格', '');
    await beat(tok, 1600);
    cd.hl(4);
    const x = av.ns.shift(); av.ls.shift();
    await slide(tok, x, -4.5, 0.5, 2.2, 500); xl.position.set(-4.5, 1.4, 2.2);
    relabel(D(x), '3,14'); tint(D(x), TEAL);
    say('return x：拿到後再填係數、指數', '不用跟系統要記憶體');
    await beat(tok, 2800);
    cd.kill(); kill(xl); fly(x);
    await beat(tok, 600);
  }
  const cd2 = code(['void RetNode(ListNode *x) {', '  x->link = av;', '  av = x;', '}'], -3.6, 6.0, 0.5);
  const x = node('x', -4.5, 2.4, 0, ORANGE); await dropIn(tok, x);
  const xl2 = tag('x', 'ptr', -4.5, 3.3, 0);
  say('RetNode：這個 node 不要了', '是 return 到 free pool，不是 delete');
  await beat(tok, 2600);
  cd2.hl(1);
  const a = lk(x, av.ns[0]);
  say('把 x 插到 av list 的最前面：先接上', 'x->link = av');
  await beat(tok, 2400);
  cd2.hl(2);
  await slide(tok, avl, -4.5, 3.9, 0, 400);
  say('再讓 av 指向 x', 'av = x');
  await beat(tok, 2200);
  kill(a); kill(xl2);
  await slide(tok, x, av.ns[0].position.x - 2.3, 0.5, 0, 500);
  av.ns.unshift(x); relinkAll(av); avl.position.set(x.position.x, 1.6, 0);
  cd2.hl(-1);
  say('看圖說故事：x 成了 free pool 的頭', 'O(1)');
  await beat(tok, 2800);
}]);

// ───────── U_tNDdEooJU 55:13、59:08：一次歸還整個多項式 ─────────
FRAG.push(['llpeng12-cerase', '一次把整個多項式還給 av', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 7.5, 12.5], [0, 0.8, 0.4]);
  const T = [[3, 14], [2, 8], [1, 0]];
  const an = T.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.0, 0.5, -1.8));
  const avn = [0, 1].map((i) => node('', -2.6 + i * 2.4, 0.5, 2.2, '#8fcfb8'));
  const avls = [lk(avn[0], avn[1]), lk(avn[1], null)];
  const avl = tag('av', 'ptr alt', -2.6, 1.6, 2.2);
  const fl = tag(P.mode === 'chain' ? 'a.first' : 'first', 'ptr', -4.6, 1.6, -1.8);
  if (P.mode !== 'chain') {
    const ls = [plk(an[0], an[1]), plk(an[1], an[2]), plk(an[2], an[0])];
    const cd = code(['if (first) {', '  second = first->link;', '  first->link = av;', '  av = second;', '  first = 0;', '}'], 3.6, 6.0, 0.5);
    say('能不能一次把整個多項式 a 還回 free pool？', 'a 表示成環狀 list：尾巴指回頭');
    await beat(tok, 3000);
    cd.hl(1);
    const sl = tag('second', 'ptr alt', an[1].position.x, 1.6, -1.8);
    say('① second = first->link', 'second 指向 2x⁸');
    await beat(tok, 2200);
    cd.hl(2);
    kill(ls[0]); ls[0] = arrow(V3(an[0].position.x + 1.05, 0.5, -1.2), V3(-3.1, 0.5, 1.6), 0xb07a10);
    say('② first->link = av', '3x¹⁴ 改指向原本的 av list');
    await beat(tok, 2400);
    cd.hl(3);
    await slide(tok, avl, an[1].position.x, 2.2, -1.8, 500);
    say('③ av = second', 'av 從 2x⁸ 開始：2x⁸ → 1 → 3x¹⁴ → 原本的 av');
    an.forEach((g) => tint(D(g), '#8fcfb8'));
    await beat(tok, 2800);
    cd.hl(4); txt(fl, 'first = 0');
    say('④ first = 0', 'a 清空了');
    await beat(tok, 2000);
    kill(sl); cd.hl(-1);
    say('其他 node 之間的 link 都不用改', '四個指令，O(1) 整條還回去');
    await beat(tok, 3000);
  } else {
    const ls = [plk(an[0], an[1]), plk(an[1], an[2]), plk(an[2], null)];
    const cd = code(['走到 a 的最後一個 node p;', 'p->link = av;', 'av = a.first;'], 3.4, 6.0, 0.5);
    say('不是環狀 list 怎麼辦？', '尾巴原本指向 0');
    await beat(tok, 2600);
    cd.hl(0);
    const r = ring(); for (let i = 0; i < 3; i++) { r.visible = true; r.position.set(an[i].position.x, 0.12, -1.8); await beat(tok, 600); }
    say('先找到尾巴', '');
    await beat(tok, 1200);
    cd.hl(1);
    kill(ls[2]); ls[2] = arrow(V3(an[2].position.x + 1.05, 0.5, -1.2), V3(-3.1, 0.5, 1.6), 0xb07a10);
    say('尾巴改指向 av', 'p->link = av');
    await beat(tok, 2400);
    cd.hl(2);
    await slide(tok, avl, -4.6, 2.2, -1.8, 500);
    an.forEach((g) => tint(D(g), '#8fcfb8'));
    say('av = a.first', '只做兩件事，原本的 list 沒被破壞');
    await beat(tok, 2800);
    r.visible = false; cd.hl(-1);
    say('最笨的做法：一個 node 一個 node 歸還', '也可以，只是比較繁瑣');
    await beat(tok, 2800);
  }
}]);

// ───────── U_tNDdEooJU 62:36：Header node ─────────
FRAG.push(['llpeng12-header-node', '環狀多項式加上 header node（exp = −1）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.8, 0.3]);
  const T = [['-', -1], [3, 14], [2, 8], [1, 0]];
  const ns = T.map(([c, e], i) => pnode(c, e, -4.8 + i * 3.1, 0.5, 0, i ? TEAL : GRAY));
  say('環狀多項式可以多加一個 header node', '');
  await beat(tok, 2200);
  glow(ns[0].userData.exp, GOLD);
  tag('header', 'ptr alt', -4.8, 1.6, 0);
  say('header 的指數欄位放 −1', '看到 exp = −1 就知道是頭端');
  await beat(tok, 2800);
  glow(ns[0].userData.exp, null);
  for (let i = 0; i < 3; i++) { plk(ns[i], ns[i + 1]); await beat(tok, 450); }
  plk(ns[3], ns[0]);
  say('3x¹⁴ + 2x⁸ + 1：最後一項指回 header', '');
  await beat(tok, 2800);
  const z = pnode('-', -1, -4.8, 0.5, 2.8, GRAY);
  arrow(V3(-3.75, 0.5, 3.42), V3(-5.22, 0.5, 3.42), 0x6e5f49);
  tag('零多項式', 'ptr', -4.8, 1.6, 2.8);
  say('補充：零多項式只剩 header，指向自己', '不用特別處理空 list');
  await beat(tok, 3200);
}]);

// ───────── U_tNDdEooJU 64:27 起：Equivalence relation ─────────
const EQP = [[0, 4], [3, 1], [6, 10], [8, 9], [7, 4], [6, 8], [3, 5], [2, 11], [11, 0]];
const EQC = [[0, 2, 4, 7, 11], [1, 3, 5], [6, 8, 9, 10]];
function seg(a, b, color = '#b07a10') { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
FRAG.push(['llpeng12-equiv-def', 'Equivalence relation：9 個 pair 分成 3 群', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const pos = (i) => { const a = Math.PI / 2 - (i / 12) * Math.PI * 2; return V3(Math.cos(a) * 4.2, 0.4, -Math.sin(a) * 4.2); };
  const cs = [];
  for (let i = 0; i < 12; i++) { const p = pos(i); cs.push(cube(i, '#e3d6bd', [0.8, 0.7, 0.8], p.x, p.y, p.z)); }
  say('Equivalence relation 三個性質', 'reflexive x≡x；symmetric x≡y⇒y≡x；transitive x≡y, y≡z⇒x≡z');
  await beat(tok, 3600);
  const segs = [];
  for (const [a, b] of EQP) {
    glow(cs[a], GOLD); glow(cs[b], GOLD);
    segs.push(seg(pos(a), pos(b)));
    say('input：' + a + ' ≡ ' + b, '「≡」是一種 relation，不是數值相等');
    await beat(tok, 900);
    glow(cs[a], null); glow(cs[b], null);
  }
  say('9 個 pair 讀完', '數字可以分成幾群？');
  await beat(tok, 1600);
  segs.forEach(kill);
  const cols = [BLUE, ORANGE, TEAL], cx = [-4.2, 0.2, 4.2];
  for (let k = 0; k < 3; k++) {
    EQC[k].forEach((v, i) => { tint(cs[v], cols[k]); });
    await Promise.all(EQC[k].map((v, i) => slide(tok, cs[v], cx[k] + (i % 2 ? 0.55 : -0.55), 0.4, -1.4 + Math.floor(i / 2) * 1.0, 600)));
    say('第 ' + (k + 1) + ' 群：{' + EQC[k].join(', ') + '}', k === 1 ? '1≡3、3≡5 ⇒ 1≡5（transitive）' : k === 2 ? '6≡8、8≡9 ⇒ 6≡9' : '0≡4、7≡4、11≡0、2≡11');
    await beat(tok, 2400);
  }
  say('output：三個 equivalence class', '同一群內任兩個數都有關係');
  await beat(tok, 3000);
}]);

FRAG.push(['llpeng12-equiv-naive', '直覺做法：邊讀邊分群，還得合併', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.5]);
  const groups = [];
  const cubes = {};
  const slotX = (g) => -5.4 + g * 2.7;
  function layout() {
    groups.forEach((gr, gi) => gr.forEach((v, k) => { const m = cubes[v]; m.position.set(slotX(gi) + (k % 2 ? 0.5 : -0.5), 0.4, -2.2 + Math.floor(k / 2) * 0.95); }));
  }
  for (const [a, b] of EQP) {
    const ga = groups.findIndex((g) => g.includes(a)), gb = groups.findIndex((g) => g.includes(b));
    for (const v of [a, b]) if (!cubes[v]) { cubes[v] = cube(v, '#e3d6bd', [0.8, 0.7, 0.8], 0, 4, 3); }
    glow(cubes[a], GOLD); glow(cubes[b], GOLD);
    let msg, f;
    if (ga < 0 && gb < 0) { groups.push([a, b]); msg = '讀到 ' + a + '≡' + b + '：跟現有的群都無關'; f = '→ 新的一群'; }
    else if (ga >= 0 && gb < 0) { groups[ga].push(b); msg = '讀到 ' + a + '≡' + b + '：' + a + ' 已在某一群'; f = '→ 把 ' + b + ' 加進去'; }
    else if (ga < 0 && gb >= 0) { groups[gb].push(a); msg = '讀到 ' + a + '≡' + b + '：' + b + ' 已在某一群'; f = '→ 把 ' + a + ' 加進去'; }
    else if (ga !== gb) { const lo = Math.min(ga, gb), hi = Math.max(ga, gb); groups[lo].push(...groups[hi]); groups.splice(hi, 1); msg = '讀到 ' + a + '≡' + b + '：兩群要合併！'; f = '一下新增、一下合併'; }
    else { msg = a + '≡' + b; f = '已在同一群'; }
    layout();
    say(msg, f + '（目前 ' + groups.length + ' 群）');
    await beat(tok, ga >= 0 && gb >= 0 ? 2600 : 1600);
    glow(cubes[a], null); glow(cubes[b], null);
  }
  say('人腦做得出來，但一下新增一下合併很複雜', '讀完一個 pair 就輸出是錯的：後面可能合併');
  await beat(tok, 3200);
}]);

// seq[] 的 linked lists：橫向 0..11，每條 list 往 +z 方向長
const SX = (i) => -6.5 + i * 1.0;
function seqBase(withOut) {
  const tiles = [];
  for (let i = 0; i < 12; i++) { tiles.push(cube(i, '#e3d6bd', [0.85, 0.5, 0.85], SX(i), 0.25, -2.6)); }
  tag('seq', 'ptr', -6.5, 1.0, -3.6);
  let outs = null;
  if (withOut) { outs = []; for (let i = 0; i < 12; i++) outs.push(cube('F', '#e0b4b4', [0.7, 0.3, 0.6], SX(i), 0.15, -3.8)); tag('out', 'ptr alt', -6.5, 0.9, -4.6); }
  return { tiles, outs, lists: Array.from({ length: 12 }, () => []), arrs: Array.from({ length: 12 }, () => []) };
}
function seqDraw(S, i) {
  S.arrs[i].forEach(kill); S.arrs[i] = [];
  S.lists[i].forEach((m, k) => m.position.set(SX(i), 0.3, -1.4 + k * 1.1));
  const pts = [V3(SX(i), 0.3, -2.15), ...S.lists[i].map((m) => V3(SX(i), 0.3, m.position.z))];
  for (let k = 0; k + 1 < pts.length; k++) S.arrs[i].push(arrow(V3(pts[k].x, 0.3, pts[k].z + (k ? 0.3 : 0.05)), V3(pts[k + 1].x, 0.3, pts[k + 1].z - 0.3), 0x6e5f49));
}
async function seqAdd(tok, S, i, v, ms = 350) {
  const m = cube(v, colorFor(v), [0.6, 0.5, 0.6], SX(i), 0.3, -1.4);
  S.lists[i].unshift(m); seqDraw(S, i);
  m.position.y = 3.5; await slide(tok, m, SX(i), 0.3, -1.4, ms);
  return m;
}
function seqBuildAll(S) {
  for (const [a, b] of EQP) for (const [i, v] of [[a, b], [b, a]]) {
    const m = cube(v, colorFor(v), [0.6, 0.5, 0.6], SX(i), 0.3, -1.4); S.lists[i].unshift(m);
  }
  for (let i = 0; i < 12; i++) seqDraw(S, i);
}
FRAG.push(['llpeng12-equiv-phase1', 'Phase 1：讀 pair，建 seq[] 的 linked lists', async (tok) => {
  fresh([0, 10, 7.5], [0, 0, 0.6]);
  const S = seqBase(false);
  const cd = code(['while (讀得到 pair (i, j)) {', '  x = new node; x->data = j;', '  x->link = seq[i]; seq[i] = x;', '  x = new node; x->data = i;', '  x->link = seq[j]; seq[j] = x;', '}', '// phase 2：根據 seq 輸出'], 2.6, 4.6, 0.5, -3.4);
  say('兩個 phase：先讀完所有 pair，再輸出', 'seq 是 array，每一格是一條 linked list');
  await beat(tok, 3200);
  for (let k = 0; k < EQP.length; k++) {
    const [a, b] = EQP[k];
    glow(S.tiles[a], GOLD); glow(S.tiles[b], GOLD);
    cd.hl(1); say('讀到 ' + a + ' ≡ ' + b + '：seq[' + a + '] 前面插入 ' + b, k < 3 ? 'x->link = seq[i]; seq[i] = x;' : '');
    await seqAdd(tok, S, a, b, k < 3 ? 400 : 220);
    await beat(tok, k < 3 ? 1100 : 350);
    cd.hl(3); say('同時 seq[' + b + '] 插入 ' + a, k < 3 ? 'symmetric：' + b + ' ≡ ' + a : '');
    await seqAdd(tok, S, b, a, k < 3 ? 400 : 220);
    await beat(tok, k < 3 ? 1300 : 450);
    glow(S.tiles[a], null); glow(S.tiles[b], null);
  }
  cd.hl(-1);
  glow(S.tiles[0], GOLD);
  say('讀完：seq[0] 是 11 → 4', 'seq[i] = 跟 i「直接」有關係的數字');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng12-equiv-phase2', 'Phase 2：out[] 與 stack 找出整個 class', async (tok) => {
  fresh([0, 10.5, 7.5], [0, 0, 0.6]);
  const S = seqBase(true);
  seqBuildAll(S);
  tag('stack', 'ptr', 6.3, 4.0, 0.5);
  const outL = tag('output：', 'ptr alt', 0, 0.2, 3.6);
  const out = new Array(12).fill(false);
  const stk = [];
  let printed = [];
  const mark = (v) => { out[v] = true; relabel(S.outs[v], 'T'); tint(S.outs[v], '#9fd8c4'); printed.push(v); txt(outL, 'output：' + printed.join(' ')); };
  const push = async (v) => { const m = cube(v, PURP, [0.8, 0.5, 0.8], 6.3, 0.3 + stk.length * 0.55, 0.5); stk.push([v, m]); m.position.y += 3; await slide(tok, m, 6.3, 0.3 + (stk.length - 1) * 0.55, 0.5, 260); };
  say('out[] 是 boolean array：這個數字輸出過了沒', '一開始全部 false');
  await beat(tok, 3000);
  const FULL = (ctx.params || {}).classes || 3;
  let cls = 0;
  for (let i = 0; i < 12 && cls < FULL; i++) {
    if (out[i]) continue;
    cls++; const quick = cls > 1;
    printed = []; mark(i); glow(S.tiles[i], GOLD);
    say('for i：out[' + i + '] 是 false → 新的 class 從 ' + i + ' 開始', '輸出 ' + i + '，out[' + i + '] = true');
    await beat(tok, quick ? 900 : 1600);
    let cur = i;
    for (;;) {
      for (const m of S.lists[cur]) {
        const v = Number(m.userData.lbl.element.textContent);
        glow(m, GOLD);
        if (!out[v]) { mark(v); await push(v); say('seq[' + cur + '] 上的 ' + v + '：沒輸出過 → 輸出並 push', cur === i ? '直接有關（direct）' : '透過 ' + cur + ' 找到：間接有關（indirect）'); }
        else say('seq[' + cur + '] 上的 ' + v + '：out[' + v + '] 已是 true', '跳過，不印兩次');
        await beat(tok, quick ? 450 : 1200);
        glow(m, null);
      }
      if (!stk.length) break;
      const [v, m] = stk.pop(); fly(m);
      glow(S.tiles[cur], null); cur = v; glow(S.tiles[cur], GOLD);
      say('pop 出 ' + v + '：再去掃 seq[' + v + ']', '找間接有關的數字');
      await beat(tok, quick ? 450 : 1200);
    }
    glow(S.tiles[cur], null);
    say('stack 空了：這個 class 輸出完畢', '{ ' + printed.join(', ') + ' }');
    await beat(tok, quick ? 1600 : 2600);
  }
  say('push／pop 的目的：找出 indirect 的數字', '三個 class：{0,11,4,7,2}、{1,3,5}、{6,8,10,9}');
  await beat(tok, 3000);
}]);
  }

  // ═══ llpeng34.js ═══
  {
// ─── zLuuRC56uvI（彭文志 Lists 3/4）、yn0ZAifhyNM（Lists 4/4）：Equivalence class、Sparse matrix、Doubly linked list ───
// 共用：任意折線＋最後一段箭頭
function seg(a, b, color) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
  lab.world.add(l); return l;
}
function poly(pts, color) {
  const out = [];
  for (let i = 0; i < pts.length - 2; i++) out.push(seg(pts[i], pts[i + 1], color));
  out.push(arrow(pts[pts.length - 2], pts[pts.length - 1], color));
  return out;
}
const killAll = (arr) => { arr.forEach(kill); arr.length = 0; };
function ringAt(r = 0.5) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; m.visible = false; lab.world.add(m); return m;
}

// ═════════════ Equivalence class（Horowitz 課本範例：n = 12，9 個 pair） ═════════════
const EQP = [[0, 4], [3, 1], [6, 10], [8, 9], [7, 4], [6, 8], [3, 5], [2, 11], [11, 0]];
const EQN = 12;
const EQX = (i) => (i - 5.5) * 0.95;
const EQ_SLOT_Z = -2.6, EQ_OUT_Z = 1.7, EQ_STK_X = 6.4;
const eqZ = (k) => EQ_SLOT_Z + 1.3 * (k + 1);
const pairStr = (p) => p.map(([a, b]) => a + '≡' + b).join('  ');
function eqSeq(pairs) { const s = Array.from({ length: EQN }, () => []); for (const [i, j] of pairs) { s[i].unshift(j); s[j].unshift(i); } return s; }
// 課本 phase 2：印出 i，沿 seq[i] 走；沒印過的印出並 push；list 走完就 pop 一個，改走它的 list
function eqRun(seq) {
  const ev = [], out = new Array(EQN).fill(false), classes = [];
  for (let i = 0; i < EQN; i++) {
    if (out[i]) { ev.push({ t: 'skipi', i }); continue; }
    const cls = [i]; out[i] = true; ev.push({ t: 'new', i });
    let list = i, k = 0; const st = [];
    for (;;) {
      while (k < seq[list].length) {
        const j = seq[list][k];
        if (!out[j]) { out[j] = true; cls.push(j); st.push(j); ev.push({ t: 'print', list, k, j }); }
        else ev.push({ t: 'seen', list, k, j });
        k++;
      }
      if (!st.length) break;
      list = st.pop(); k = 0; ev.push({ t: 'pop', j: list });
    }
    ev.push({ t: 'end', cls: [...cls] });
    classes.push(cls);
  }
  return { ev, classes };
}
function eqStage(o = {}) {
  const S = { slots: [], lists: Array.from({ length: EQN }, () => []), arr: Array.from({ length: EQN }, () => []), outs: [], stack: [], lines: [] };
  for (let i = 0; i < EQN; i++) {
    tag('[' + i + ']', 'idx', EQX(i), 0, EQ_SLOT_Z - 0.75);
    S.slots.push(cube('0', '#e9dcc4', [0.8, 0.4, 0.8], EQX(i), 0.2, EQ_SLOT_Z));
  }
  tag('seq', 'ptr', -6.5, 0.3, EQ_SLOT_Z);
  if (o.out) {
    for (let i = 0; i < EQN; i++) S.outs.push(cube('F', GRAY, [0.7, 0.35, 0.7], EQX(i), 0.18, EQ_OUT_Z));
    tag('out', 'ptr', -6.5, 0.3, EQ_OUT_Z);
  }
  if (o.stack) tag('stack', 'ptr alt', EQ_STK_X, 0, EQ_OUT_Z + 0.9);
  return S;
}
function eqArrows(S, i) {
  killAll(S.arr[i]);
  const L = S.lists[i], x = EQX(i);
  relabel(S.slots[i], L.length ? '•' : '0');
  L.forEach((n, k) => {
    const from = k === 0 ? V3(x, 0.3, EQ_SLOT_Z + 0.4) : V3(x, 0.3, eqZ(k - 1) + 0.35);
    S.arr[i].push(arrow(from, V3(x, 0.3, eqZ(k) - 0.35)));
  });
}
const eqNode = (v, x, y, z) => cube(v, colorFor(v), [0.7, 0.5, 0.7], x, y, z);
function eqInsert(S, i, m) {
  S.lists[i].unshift(m);
  S.lists[i].forEach((n, k) => move(n, EQX(i), 0.25, eqZ(k)));
  eqArrows(S, i);
}
function eqBuild(S, pairs) {
  const seq = eqSeq(pairs);
  seq.forEach((L, i) => { L.forEach((v, k) => S.lists[i].push(eqNode(v, EQX(i), 0.25, eqZ(k)))); eqArrows(S, i); });
  return seq;
}
function eqClear(S) { for (let i = 0; i < EQN; i++) { S.lists[i].forEach((m) => fly(m)); S.lists[i] = []; eqArrows(S, i); } }
function eqSetOut(S, i, on = true) { const m = S.outs[i]; if (!m) return; relabel(m, on ? 'T' : 'F'); tint(m, on ? '#2fc092' : GRAY); }
// 播放 phase 2 的事件；o = { ms, cd（程式面板，可省略）, stop（只播到第一個 class 結束） }
async function eqPlay(tok, S, ev, o) {
  const ring = ringAt(0.48);
  let cls = [], line = null;
  const stackStr = () => (S.stack.length ? S.stack.map((m) => m.userData.v).join(', ') : '空');
  const hl = (k) => { if (o.cd) o.cd.hl(k); };
  for (const e of ev) {
    if (e.t === 'skipi') {
      ring.visible = false; glow(S.outs[e.i], GOLD); hl(0);
      say('i = ' + e.i + '：out[' + e.i + '] 已是 true → 跳過', '每個數字只屬於一個 class');
      await beat(tok, o.ms * 0.45); glow(S.outs[e.i]); continue;
    }
    if (e.t === 'new') {
      ring.visible = false; cls = [e.i]; eqSetOut(S, e.i); glow(S.slots[e.i], GOLD); hl(1);
      line = tag('New class: ' + e.i, 'ptr alt', 0, 0.2, 3.0 + 0.62 * S.lines.length); S.lines.push(line);
      say('i = ' + e.i + '：out[' + e.i + '] == false → 印出 ' + e.i, 'out[' + e.i + '] = true，從 seq[' + e.i + '] 開始走');
      await beat(tok, o.ms); glow(S.slots[e.i]); continue;
    }
    if (e.t === 'print' || e.t === 'seen') {
      const n = S.lists[e.list][e.k];
      ring.visible = true; ring.position.set(EQX(e.list), 0.03, eqZ(e.k)); hl(e.t === 'print' ? 5 : 4);
      if (e.t === 'print') {
        glow(n, GOLD); eqSetOut(S, e.j); cls.push(e.j); txt(line, 'New class: ' + cls.join(', '));
        const s = cube(e.j, colorFor(e.j), [0.75, 0.45, 0.75], EQ_STK_X, 0.25 + 0.5 * S.stack.length, EQ_OUT_Z, 3);
        s.userData.v = e.j; S.stack.push(s);
        say('seq[' + e.list + '] 裡的 ' + e.j + '：沒印過 → 印出、push', 'out[' + e.j + '] = true；stack：' + stackStr());
      } else {
        glow(n, RED); glow(S.outs[e.j], RED);
        say('seq[' + e.list + '] 裡的 ' + e.j + '：已印過 → 跳過', 'out[' + e.j + '] == true');
      }
      await beat(tok, o.ms); glow(n); glow(S.outs[e.j]); continue;
    }
    if (e.t === 'pop') {
      ring.visible = false; hl(8);
      const s = S.stack.pop(); if (s) fly(s, V3(2, 7, 3));
      glow(S.slots[e.j], GOLD);
      say('list 走完 → pop ' + e.j + '，改走 seq[' + e.j + ']', 'transitive：跟 ' + e.j + ' 有關的也跟 class 有關');
      await beat(tok, o.ms); glow(S.slots[e.j]); continue;
    }
    if (e.t === 'end') {
      ring.visible = false; hl(7);
      say('stack 空了 → 這個 class 結束', 'New class: ' + e.cls.join(', '));
      await beat(tok, o.ms * 1.3);
      if (o.stop) break;
    }
  }
  kill(ring);
}

FRAG.push(['llpeng34-equiv-props', 'Equivalence relation 三性質', async (tok) => {
  fresh([0, 6, 11], [0, 1, 0]);
  const X = { 0: -3.5, 4: 0, 7: 3.5 }, c = {};
  for (const v of [0, 4, 7]) c[v] = cube(v, colorFor(v), [1.2, 0.8, 1.2], X[v], 0.4, 0, 3);
  say('Equivalence relation ≡ 要滿足三個性質', 'reflexive、symmetric、transitive');
  await beat(tok, 2400);
  glow(c[0], GOLD); const self = tag('0 ≡ 0', 'ptr alt', -3.5, 1.6);
  say('Reflexive：自己跟自己有關，pair 不必寫出', 'x ≡ x');
  await beat(tok, 2800);
  glow(c[0]); kill(self);
  arrow(V3(-2.8, 0.6, -0.3), V3(-0.7, 0.6, -0.3), 0x0f5a3a);
  tag('0 ≡ 4', 'idx', -1.75, 1.2, -0.3);
  say('輸入 pair：0 ≡ 4', '');
  await beat(tok, 1800);
  arrow(V3(-0.7, 0.3, 0.4), V3(-2.8, 0.3, 0.4), 0x0f5a3a);
  say('Symmetric：0 ≡ 4 隱含 4 ≡ 0', 'x ≡ y ⇒ y ≡ x');
  await beat(tok, 2800);
  arrow(V3(2.8, 0.6, -0.3), V3(0.7, 0.6, -0.3), 0x0f5a3a);
  arrow(V3(0.7, 0.3, 0.4), V3(2.8, 0.3, 0.4), 0x0f5a3a);
  tag('7 ≡ 4', 'idx', 1.75, 1.2, -0.3);
  say('再讀到 7 ≡ 4，所以也有 4 ≡ 7', '7 ≡ 4 ⇒ 4 ≡ 7');
  await beat(tok, 2600);
  glow(c[0], GOLD); glow(c[7], GOLD);
  line(-3.5, 1.0, -3.5, 2.3, 0, '#6a4a00'); line(-3.5, 2.3, 3.5, 2.3, 0, '#6a4a00');
  arrow(V3(3.5, 2.3, 0), V3(3.5, 0.9, 0), 0x6a4a00);
  tag('0 ≡ 7', 'ptr alt', 0, 2.75);
  say('Transitive：0 ≡ 4、4 ≡ 7 ⇒ 0 ≡ 7', 'x ≡ y 且 y ≡ z ⇒ x ≡ z');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-equiv-problem', 'Equivalence class 問題', async (tok) => {
  fresh([0, 8, 11], [0, 0.5, 0.4]);
  tag('輸入：' + pairStr(EQP), 'ptr', 0, 0.2, -3.6);
  const cs = [];
  for (let i = 0; i < EQN; i++) cs.push(cube(i, colorFor(i), [0.75, 0.6, 0.75], EQX(i), 0.3, -1.6, 2));
  say('輸入 pair，輸出 equivalence class', 'n = 12：數字 0 … 11，共 9 個 pair');
  await beat(tok, 2600);
  for (const [a, b] of EQP) {
    glow(cs[a], GOLD); glow(cs[b], GOLD);
    say('讀到 ' + a + ' ≡ ' + b, a + ' 和 ' + b + ' 有關係');
    await beat(tok, 600);
    glow(cs[a]); glow(cs[b]);
  }
  glow(cs[3], GOLD); glow(cs[1], GOLD);
  say('看 1、3、5：先有 3 ≡ 1', '');
  await beat(tok, 1600);
  glow(cs[5], GOLD);
  say('再讀到 3 ≡ 5 ⇒ 1 ≡ 5', 'transitive：{1, 3, 5} 是同一個 class');
  await beat(tok, 2600);
  [1, 3, 5].forEach((i) => glow(cs[i]));
  const G = [[0, 2, 4, 7, 11], [1, 3, 5], [6, 8, 9, 10]], GX = [-4.3, 0, 4.0];
  G.forEach((g, gi) => {
    g.forEach((v, k) => move(cs[v], GX[gi] + (k - (g.length - 1) / 2) * 0.85, 0.3, 1.4));
    tag('{' + g.join(', ') + '}', 'ptr alt', GX[gi], 0.2, 2.6);
  });
  say('輸出三個 set：set 內彼此都有關係', '{0,2,4,7,11}　{1,3,5}　{6,8,9,10}');
  await beat(tok, 3200);
  say('考題可能把 symmetric 改成 asymmetric', 'asymmetric：x ≡ y 不代表 y ≡ x');
  await beat(tok, 2600);
}]);

FRAG.push(['llpeng34-seq-out', '兩個 phase、兩個 array', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const S = eqStage({ out: true });
  say('Phase 1 讀 pair 建關係；Phase 2 找 class', '資料結構：array ＋ linked list');
  await beat(tok, 2800);
  S.slots.forEach((m) => glow(m, GOLD));
  say('seq：大小 n 的 array，每格是 pointer', 'seq[i] → 跟 i 有關的數字串成的 linked list');
  await beat(tok, 2800);
  S.slots.forEach((m) => glow(m));
  eqInsert(S, 0, cube(4, colorFor(4), [0.7, 0.5, 0.7], EQX(0), 0.25, eqZ(0), 3));
  await beat(tok, 800);
  eqInsert(S, 0, cube(11, colorFor(11), [0.7, 0.5, 0.7], EQX(0), 0.25, eqZ(0), 3));
  say('例：seq[0] 串著 11、4，都跟 0 有關', 'seq[0] → 11 → 4 → 0（null）');
  await beat(tok, 3000);
  S.outs.forEach((m) => glow(m, GOLD));
  say('out：boolean array，記錄印過沒', '一開始 out[0 … 11] 全是 false');
  await beat(tok, 2600);
  S.outs.forEach((m) => glow(m));
  eqSetOut(S, 0);
  say('0 印出後 out[0] = true', '之後再碰到 0 就不會再印');
  await beat(tok, 3000);
}]);

FRAG.push(['llpeng34-phase1-build', 'Phase 1：建出 seq 的 list', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0, -0.6]);
  const S = eqStage();
  const pl = tag('', 'ptr', 0, 0.2, 2.2);
  say('Phase 1：每讀一個 pair (i, j)', 'j 放進 seq[i]，i 放進 seq[j]');
  await beat(tok, 2400);
  for (const [i, j] of EQP) {
    txt(pl, '讀到 ' + i + ' ≡ ' + j);
    eqInsert(S, i, cube(j, colorFor(j), [0.7, 0.5, 0.7], EQX(i), 0.25, eqZ(0), 3));
    eqInsert(S, j, cube(i, colorFor(i), [0.7, 0.5, 0.7], EQX(j), 0.25, eqZ(0), 3));
    glow(S.slots[i], GOLD); glow(S.slots[j], GOLD);
    say('讀到 ' + i + ' ≡ ' + j + '：雙向都要放', j + ' → seq[' + i + ']，' + i + ' → seq[' + j + ']（插在最前面）');
    await beat(tok, 1500);
    glow(S.slots[i]); glow(S.slots[j]);
  }
  txt(pl, '9 個 pair 讀完');
  say('Phase 1 結束：每個數字都有自己的 list', 'seq[0] → 11 → 4；seq[11] → 0 → 2');
  await beat(tok, 3000);
}]);

FRAG.push(['llpeng34-phase2-idea', 'Phase 2 的想法：直接相關＋transitive', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const S = eqStage({ out: true });
  eqBuild(S, EQP);
  const ring = ringAt(0.48);
  const outL = tag('輸出：', 'ptr alt', 0, 0.2, 3.0);
  const at = (i, k) => { ring.visible = true; ring.position.set(EQX(i), 0.03, eqZ(k)); };
  say('Phase 2：for i = 0 … n−1，檢查 out[i]', 'out 一開始全是 false');
  await beat(tok, 2400);
  eqSetOut(S, 0); txt(outL, '輸出：0');
  say('i = 0：out[0] 是 false → 印出 0', 'out[0] = true');
  await beat(tok, 2400);
  at(0, 0); eqSetOut(S, 11); txt(outL, '輸出：0 11');
  say('直接相關：seq[0] 的 list 裡有 11', '印出 11，out[11] = true');
  await beat(tok, 2000);
  at(0, 1); eqSetOut(S, 4); txt(outL, '輸出：0 11 4');
  say('接著是 4：一樣印出', '直接跟 0 有關：11、4');
  await beat(tok, 2400);
  at(11, 0); glow(S.outs[0], RED);
  say('Transitive：去看 seq[11]，先看到 0', 'out[0] == true → 不再印');
  await beat(tok, 2400);
  glow(S.outs[0]); at(11, 1); eqSetOut(S, 2); txt(outL, '輸出：0 11 4 2');
  say('再看到 2：0 ≡ 11、11 ≡ 2 ⇒ 0 ≡ 2', '印出 2');
  await beat(tok, 2600);
  at(2, 0); glow(S.outs[11], RED);
  say('seq[2] 裡只有 11：已印過，停', 'out[11] == true');
  await beat(tok, 2400);
  glow(S.outs[11]); ring.visible = false;
  say('for 迴圈繼續 i = 1, 2, …', 'out[i] 已是 true 的就跳過；4 的 list 也要看（下一段用 stack）');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-phase1-code', 'Phase 1 的程式', async (tok) => {
  fresh([0, 9, 10.5], [0, 2.4, -0.5]);
  const cd = code([
    'class ListNode { int data; ListNode *link; };',
    'ListNode **seq = new ListNode*[n];  bool *out = new bool[n];',
    'for (i = 0; i < n; i++) { seq[i] = 0; out[i] = false; }',
    'while (inFile >> i >> j) {            // Phase 1',
    '  ListNode *x = new ListNode(j);',
    '  x->link = seq[i];  seq[i] = x;      // j 放進 seq[i]',
    '  ListNode *y = new ListNode(i);',
    '  y->link = seq[j];  seq[j] = y;      // i 放進 seq[j]',
    '}',
  ], 0, 7.6, 0.56, -2.6);
  const S = eqStage({ out: true });
  cd.hl(0);
  say('node：data 放數字，link 指下一個', 'class ListNode { data, link }');
  await beat(tok, 2400);
  cd.hl(1);
  say('宣告 seq 和 out 兩個 array', 'seq：pointer array；out：boolean array；大小 n = 12');
  await beat(tok, 2200);
  cd.hl(2);
  S.slots.forEach((m) => glow(m, GOLD)); S.outs.forEach((m) => glow(m, GOLD));
  say('初始化：seq[i] = 0（null）、out[i] = false', '還沒有 list，也還沒印過');
  await beat(tok, 2400);
  S.slots.forEach((m) => glow(m)); S.outs.forEach((m) => glow(m));
  for (const [i, j] of EQP.slice(0, 2)) {
    cd.hl(3);
    say('從檔案讀到 pair (' + i + ', ' + j + ')', 'inFile >> i >> j');
    await beat(tok, 1400);
    cd.hl(4);
    const x = eqNode(j, EQX(i) + 1.2, 1.8, eqZ(0));
    const xl = tag('x', 'ptr', EQX(i) + 1.2, 2.6, eqZ(0));
    say('new 一個 node x，裡面放 ' + j, 'x->data = ' + j);
    await beat(tok, 1500);
    cd.hl(5); kill(xl); eqInsert(S, i, x);
    say('x 接到 seq[' + i + '] 的最前面', 'x->link = seq[' + i + ']；seq[' + i + '] = x');
    await beat(tok, 1600);
    cd.hl(6);
    const y = eqNode(i, EQX(j) + 1.2, 1.8, eqZ(0));
    const yl = tag('y', 'ptr', EQX(j) + 1.2, 2.6, eqZ(0));
    say('另一個方向：new node y 放 ' + i, 'y->data = ' + i);
    await beat(tok, 1400);
    cd.hl(7); kill(yl); eqInsert(S, j, y);
    say('y 接到 seq[' + j + '] 的最前面', 'y->link = seq[' + j + ']；seq[' + j + '] = y');
    await beat(tok, 1600);
  }
  cd.hl(3);
  for (const [i, j] of EQP.slice(2)) {
    eqInsert(S, i, cube(j, colorFor(j), [0.7, 0.5, 0.7], EQX(i), 0.25, eqZ(0), 3));
    eqInsert(S, j, cube(i, colorFor(i), [0.7, 0.5, 0.7], EQX(j), 0.25, eqZ(0), 3));
    say('其餘 pair 一樣處理：' + i + ' ≡ ' + j, 'while 迴圈 = Phase 1');
    await beat(tok, 500);
  }
  cd.hl(-1);
  say('while 跑完，Phase 1 的結構就建好了', '每個新 node 都插在 list 最前面 → O(1)');
  await beat(tok, 2800);
}]);

const EQ_CODE2 = [
  'for (i = 0; i < n; i++) if (!out[i]) {',
  '  cout << i;  out[i] = true;',
  '  x = seq[i];  top = 0;                  // stack 清空',
  '  while (1) {',
  '    while (x) { j = x->data;',
  '      if (!out[j]) { cout << j; out[j] = true; push x; }',
  '      x = x->link; }',
  '    if (!top) break;                     // stack 空 → class 結束',
  '    x = seq[top->data];  pop;            // 換走 stack 頂端那個數字的 list',
  '  } }',
];
FRAG.push(['llpeng34-phase2-stack', 'Phase 2：用 stack 走訪', async (tok) => {
  fresh([0, 9.5, 10.5], [0, 2.4, -0.5]);
  const cd = code(EQ_CODE2, 0, 8.2, 0.52, -2.6);
  const S = eqStage({ out: true, stack: true });
  eqBuild(S, EQP);
  say('Phase 2 的程式：用 stack 記住「待會要看的 list」', 'Phase 1 的結構已建好');
  await beat(tok, 2600);
  const { ev } = eqRun(eqSeq(EQP));
  await eqPlay(tok, S, ev, { ms: 1600, cd, stop: true });
  cd.hl(-1);
  say('第一個 class 的輸出順序', '0, 11, 4, 7, 2（不是 0 2 4 7 11）');
  await beat(tok, 3000);
}]);

FRAG.push(['llpeng34-classes-out', '三個 class 的輸出順序', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.5]);
  const S = eqStage({ out: true, stack: true });
  eqBuild(S, EQP);
  say('整個 for 迴圈跑完，輸出三個 set', '順序由 list 結構和 stack 決定');
  await beat(tok, 2200);
  const { ev, classes } = eqRun(eqSeq(EQP));
  await eqPlay(tok, S, ev, { ms: 420 });
  say('三個 set，順序要自己 trace code', classes.map((c) => c.join(' ')).join('｜'));
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-order-matters', '輸入順序改變，輸出順序就變', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.3]);
  const S = eqStage();
  eqBuild(S, EQP);
  const a = eqRun(eqSeq(EQP)).classes.map((c) => c.join(' ')).join('｜');
  tag('原順序：' + a, 'ptr', 0, 0.2, 2.2);
  const pl = tag('', 'ptr alt', 0, 0.2, 3.0);
  say('原本的輸入順序：0≡4、3≡1、…、11≡0', a);
  await beat(tok, 3000);
  eqClear(S);
  say('把輸入倒過來：先 11≡0、2≡11、3≡5 …', 'list 結構會不一樣');
  await beat(tok, 1600);
  const R = EQP.slice().reverse();
  for (const [i, j] of R) {
    eqInsert(S, i, cube(j, colorFor(j), [0.7, 0.5, 0.7], EQX(i), 0.25, eqZ(0), 3));
    eqInsert(S, j, cube(i, colorFor(i), [0.7, 0.5, 0.7], EQX(j), 0.25, eqZ(0), 3));
    txt(pl, '讀到 ' + i + ' ≡ ' + j);
    await beat(tok, 650);
  }
  [0, 11].forEach((i) => S.lists[i].forEach((m) => glow(m, GOLD)));
  say('seq[0] 變成 4 → 11，seq[11] 變成 2 → 0', '原本是 11 → 4、0 → 2');
  await beat(tok, 3000);
  [0, 11].forEach((i) => S.lists[i].forEach((m) => glow(m)));
  const b = eqRun(eqSeq(R)).classes.map((c) => c.join(' ')).join('｜');
  txt(pl, '倒過來：' + b);
  say('還是三個 set，但 set 裡的順序不同', b);
  await beat(tok, 3400);
}]);

// ═════════════ Sparse matrix 的 linked list 表示法（課本 4×4 範例） ═════════════
const SPT = [[0, 2, 11], [1, 0, 12], [2, 1, -4], [3, 3, -15]];
const SCX = (c) => -2.4 + c * 2.4, SRY = (r) => 5.0 - r * 1.45, SHX = -5.0, SHY = 6.6;
const ROWC = 0x3a3a3a, COLC = 0xc0392b, NEXTC = 0x0f8a5a;
function spHeads(G, drop) {
  G.H = cube('H 4×4', '#4b9ee2', [1.3, 0.8, 0.5], SHX, SHY, 0, drop ? 3 : 0);
  G.top = []; G.left = [];
  for (let c = 0; c < 4; c++) G.top.push(cube('H' + c, '#f2c46d', [1.1, 0.75, 0.5], SCX(c), SHY, 0, drop ? 3 : 0));
  for (let r = 0; r < 4; r++) G.left.push(cube('H' + r, '#f2c46d', [1.1, 0.75, 0.5], SHX, SRY(r), 0, drop ? 3 : 0));
}
function spEntry(G, t, drop) {
  const [r, c, v] = t;
  const m = cube(r + ' ' + c + ' │ ' + v, '#6b5d50', [1.7, 0.75, 0.5], SCX(c), SRY(r), 0, drop ? 3 : 0);
  const e = { m, r, c, v }; G.ent.push(e); return e;
}
function spRowArrows(G, r) {
  const y = SRY(r), L = G.ent.filter((e) => e.r === r).sort((a, b) => a.c - b.c), out = [];
  if (!L.length) { out.push(tag('↺', 'idx', SHX + 0.9, y)); return out; }
  out.push(arrow(V3(SHX + 0.55, y + 0.12, 0), V3(SCX(L[0].c) - 0.85, y + 0.12, 0), ROWC));
  for (let k = 1; k < L.length; k++) out.push(arrow(V3(SCX(L[k - 1].c) + 0.85, y + 0.12, 0), V3(SCX(L[k].c) - 0.85, y + 0.12, 0), ROWC));
  const x = SCX(L[L.length - 1].c);
  out.push(...poly([V3(x + 0.85, y - 0.1, 0), V3(x + 1.1, y - 0.1, 0), V3(x + 1.1, y - 0.1, 0.65), V3(SHX + 0.2, y - 0.1, 0.65), V3(SHX + 0.2, y - 0.1, 0.27)], ROWC));
  return out;
}
function spColArrows(G, c) {
  const x = SCX(c), L = G.ent.filter((e) => e.c === c).sort((a, b) => a.r - b.r), out = [];
  if (!L.length) { out.push(tag('↺', 'idx', x, SHY - 0.8)); return out; }
  out.push(arrow(V3(x + 0.3, SHY - 0.38, 0), V3(x + 0.3, SRY(L[0].r) + 0.38, 0), COLC));
  for (let k = 1; k < L.length; k++) out.push(arrow(V3(x + 0.3, SRY(L[k - 1].r) - 0.38, 0), V3(x + 0.3, SRY(L[k].r) + 0.38, 0), COLC));
  const y = SRY(L[L.length - 1].r);
  out.push(...poly([V3(x - 0.3, y - 0.38, 0), V3(x - 0.3, y - 0.6, 0), V3(x - 0.3, y - 0.6, -0.6), V3(x - 0.3, SHY, -0.6), V3(x - 0.3, SHY, -0.27)], COLC));
  return out;
}
function spNext() {
  const out = [arrow(V3(SHX + 0.65, SHY, 0), V3(SCX(0) - 0.55, SHY, 0), NEXTC)];
  for (let c = 1; c < 4; c++) out.push(arrow(V3(SCX(c - 1) + 0.55, SHY, 0), V3(SCX(c) - 0.55, SHY, 0), NEXTC));
  out.push(...poly([V3(SCX(3) + 0.55, SHY, 0), V3(SCX(3) + 0.9, SHY, 0), V3(SCX(3) + 0.9, SHY + 0.8, 0), V3(SHX, SHY + 0.8, 0), V3(SHX, SHY + 0.4, 0)], NEXTC));
  return out;
}
function spAll(G) { const a = []; for (let r = 0; r < 4; r++) a.push(...spRowArrows(G, r)); for (let c = 0; c < 4; c++) a.push(...spColArrows(G, c)); return a; }
const spFrame = () => fresh([0, 3.9, 13.5], [0, 3.7, 0]);

FRAG.push(['llpeng34-sparse-array', 'Sparse matrix：從 array 到 linked list', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const M = [[0, 0, 11, 0], [12, 0, 0, 0], [0, -4, 0, 0], [0, 0, 0, -15]];
  const mx = (c) => -5.2 + c * 1.15, my = (r) => 5.6 - r * 1.15;
  const cells = [];
  M.forEach((row, r) => row.forEach((v, c) => {
    const m = cube(v, v ? colorFor(Math.abs(v)) : GRAY, v ? [1.0, 0.9, 0.5] : [0.8, 0.7, 0.3], mx(c), my(r), 0, 2);
    cells.push({ m, r, c, v });
  }));
  for (let c = 0; c < 4; c++) tag('c' + c, 'idx', mx(c), 6.5);
  for (let r = 0; r < 4; r++) tag('r' + r, 'idx', -6.3, my(r));
  say('Sparse matrix：大部分元素是 0', '4×4，只有 4 個非 0');
  await beat(tok, 2600);
  say('第 2 章：用 1D array 存 (row, col, value)', '不用 2D array，只存非 0 項');
  const hdr = tag('row col value', 'idx', 3.6, 6.3);
  const t0 = cube('4  4  4', '#4b9ee2', [2.6, 0.6, 0.5], 3.6, 5.6, 0, 2);
  await beat(tok, 1600);
  let k = 1;
  for (const e of cells.filter((e) => e.v)) {
    glow(e.m, GOLD);
    const t = cube(e.r + '  ' + e.c + '  ' + e.v, colorFor(Math.abs(e.v)), [2.6, 0.6, 0.5], mx(e.c), my(e.r), 0.6);
    move(t, 3.6, 5.6 - k * 0.8, 0);
    say('a[' + e.r + '][' + e.c + '] = ' + e.v + ' → 一筆 triple', '(' + e.r + ', ' + e.c + ', ' + e.v + ')');
    await beat(tok, 1300);
    glow(e.m); k++;
  }
  await beat(tok, 800);
  say('也可以用 linked list 來存', '每個 row、每個 column 各一條環狀 linked list');
  cells.filter((e) => e.r === 1).forEach((e) => glow(e.m, GOLD));
  await beat(tok, 1600);
  cells.forEach((e) => glow(e.m));
  cells.filter((e) => e.c === 0).forEach((e) => glow(e.m, RED));
  say('例：row 1 一條 list、column 0 一條 list', '非 0 的 12 同時在兩條 list 上');
  await beat(tok, 3000);
  void hdr; void t0;
}]);

FRAG.push(['llpeng34-sparse-lists', 'Sparse matrix 的 head node 與環狀 list', async (tok) => {
  spFrame();
  const G = { ent: [] };
  spHeads(G, true);
  say('藍色 H：整個 matrix 的 head node', '4×4 matrix');
  glow(G.H, GOLD);
  await beat(tok, 2400);
  glow(G.H);
  G.top.forEach((m) => glow(m, GOLD)); G.left.forEach((m) => glow(m, GOLD));
  say('黃色 H0 … H3：每個 row／column 的 head node', '上面一排、左邊一排畫兩次，其實是同一組 node');
  await beat(tok, 3000);
  G.top.forEach((m) => glow(m)); G.left.forEach((m) => glow(m));
  const e12 = spEntry(G, SPT[1], true);
  say('entry 1 0 │ 12：row 1、column 0、值 12', 'a[1][0] = 12');
  await beat(tok, 2600);
  glow(G.left[1], GOLD);
  const ra = spRowArrows(G, 1);
  say('H1 的 right：row 1 往右看，第一個非 0 就是 12', 'row 1 只有 12，最後指回 H1 → 環狀');
  await beat(tok, 3000);
  glow(G.left[1]); glow(G.top[0], GOLD);
  const ca = spColArrows(G, 0);
  say('紅線：H0 的 down 往下指 column 0 的 list', 'column 0 也只有 12，再指回 H0');
  await beat(tok, 3000);
  glow(G.top[0]); killAll(ra); killAll(ca);
  for (const t of [SPT[0], SPT[2], SPT[3]]) { spEntry(G, t, true); await beat(tok, 500); }
  const all = spAll(G);
  say('其他非 0 項：11、−4、−15 一樣串進去', '每個 row、每個 column 各一條環狀 list');
  await beat(tok, 2800);
  const nx = spNext();
  say('head node 之間用 next 串成 header list', 'H → H0 → H1 → H2 → H3 → H');
  await beat(tok, 3000);
  void all; void nx; void e12;
}]);

FRAG.push(['llpeng34-node-fields', 'Header node 與 entry node 的欄位', async (tok) => {
  fresh([0, 4, 12.5], [0, 2.8, 0]);
  function node(x, top, bottom, color, title) {
    const cs = top.map((t, k) => cube(t, color, [1.15, 0.7, 0.5], x + (k - 1) * 1.2, 4.2, 0, 2));
    const b = cube(bottom, color, [3.55, 0.7, 0.5], x, 3.45, 0, 2);
    tag(title, 'ptr', x, 5.1);
    return { cs, b };
  }
  const h = node(-3.3, ['down', 'head=T', 'right'], 'next', '#f2c46d', 'header node');
  say('Header node：down、right 兩個 pointer', 'down → 同一 column 的 entry；right → 同一 row 的 entry');
  await beat(tok, 3000);
  glow(h.b, GOLD);
  say('第三個 pointer：next', 'next → 下一個 header node（header 的 linked list）');
  await beat(tok, 2600);
  glow(h.b);
  const e = node(3.3, ['down', 'head=F', 'right'], 'row  col  value', '#b8a894', 'entry node');
  say('Entry node：down、right 指向同行／同列', '中間 row、col 記位置，value 記值');
  await beat(tok, 3000);
  glow(e.b, GOLD);
  say('例：1 0 12 → 位置 (1, 0)、值 12', 'a_ij：第 i 個 row、第 j 個 column');
  await beat(tok, 2400);
  glow(e.b);
  say('r 個非 0 項要用幾個 node？', 'n×m matrix');
  await beat(tok, 1600);
  const cnt = [];
  cnt.push(cube('H', '#4b9ee2', [0.7, 0.6, 0.7], -3.6, 0.3, 1.5, 3));
  tag('+1', 'idx', -3.6, 0, 2.5);
  await beat(tok, 700);
  for (let k = 0; k < 4; k++) { cnt.push(cube('H' + k, '#f2c46d', [0.7, 0.6, 0.7], -2.0 + k * 0.85, 0.3, 1.5, 3)); await beat(tok, 300); }
  tag('max{n, m} = 4', 'idx', -0.7, 0, 2.5);
  for (let k = 0; k < 4; k++) { cnt.push(cube(SPT[k][2], '#6b5d50', [0.7, 0.6, 0.7], 2.2 + k * 0.85, 0.3, 1.5, 3)); await beat(tok, 300); }
  tag('r = 4', 'idx', 3.5, 0, 2.5);
  say('node 數 = max{n, m} + r + 1', 'max{4, 4} + 4 + 1 = 9');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-sparse-transpose', '同一組 head node、transpose 只改 pointer', async (tok) => {
  spFrame();
  const G = { ent: [] };
  spHeads(G, false);
  SPT.forEach((t) => spEntry(G, t, false));
  let ar = spAll(G);
  say('問：上面和左邊的 H0 … H3 是什麼關係？', '');
  await beat(tok, 2000);
  for (let k = 0; k < 4; k++) {
    glow(G.top[k], GOLD); glow(G.left[k], GOLD);
    say('上面的 H' + k + ' 和左邊的 H' + k + ' 是同一個 node', 'H' + k + ' 同時是 row ' + k + ' 和 column ' + k + ' 的頭');
    await beat(tok, 1000);
    glow(G.top[k]); glow(G.left[k]);
  }
  say('實際只有 1 個藍色＋4 個黃色 head node', '畫兩份只是為了看起來像 matrix');
  await beat(tok, 2600);
  say('Transpose：row 變 column、column 變 row', 'a[i][j] → aᵀ[j][i]');
  await beat(tok, 2000);
  killAll(ar);
  for (const e of G.ent) {
    [e.r, e.c] = [e.c, e.r];
    move(e.m, SCX(e.c), SRY(e.r), 0); relabel(e.m, e.r + ' ' + e.c + ' │ ' + e.v);
    glow(e.m, GOLD);
  }
  await beat(tok, 1200);
  G.ent.forEach((e) => glow(e.m));
  ar = spAll(G);
  say('head node 不用動，只要改 pointer', 'overhead：把 right／down 指到對的位置');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-matrixnode-union', 'MatrixNode：一個 class 表示兩種 node', async (tok) => {
  fresh([0, 4.2, 12.5], [0, 3.4, 0]);
  const cd = code([
    'struct Triple { int row, col, value; };',
    'class MatrixNode {',
    'private:',
    '  MatrixNode *down, *right;',
    '  bool head;',
    '  union {',
    '    MatrixNode *next;',
    '    Triple triple;',
    '  };',
    '};',
    'class Matrix { MatrixNode *headnode; };',
  ], -3.4, 6.6, 0.55);
  const X = 3.6;
  const cs = ['down', 'head', 'right'].map((t, k) => cube(t, '#b8a894', [1.1, 0.7, 0.5], X + (k - 1) * 1.15, 4.4, 0, 2));
  const u = cube('union', '#c9b48e', [3.4, 0.7, 0.5], X, 3.65, 0, 2);
  tag('MatrixNode', 'ptr', X, 5.3);
  cd.hl(0);
  say('Triple：記 row、col、value', 'struct Triple');
  await beat(tok, 2400);
  cd.hl(3); [cs[0], cs[2]].forEach((m) => glow(m, GOLD));
  say('共同部分：down、right 兩個 pointer', 'head node 和 entry node 都有');
  await beat(tok, 2600);
  [cs[0], cs[2]].forEach((m) => glow(m));
  cd.hl(4); glow(cs[1], GOLD);
  say('bool head：分辨是 head node 還是 entry node', '只用一個 class MatrixNode');
  await beat(tok, 2600);
  glow(cs[1]);
  cd.hl(5); tint(u, '#e07a6a');
  say('不同的部分放進 union：兩個欄位只選一個', 'next 或 triple，共用同一塊空間');
  await beat(tok, 2800);
  cd.hl(6); relabel(cs[1], 'head=T'); relabel(u, 'next'); tint(u, '#f2c46d');
  say('head == true → 用 next', 'header node 只要串到下一個 header');
  await beat(tok, 2600);
  cd.hl(7); relabel(cs[1], 'head=F'); relabel(u, '1  0  12'); tint(u, '#6b5d50');
  say('head == false → 用 triple', 'entry node 只要 row、col、value');
  await beat(tok, 2600);
  cd.hl(10);
  const hb = cube('headnode 4×4', '#4b9ee2', [2.2, 0.7, 0.5], X, 1.8, 0, 2);
  say('Matrix 只記藍色 headnode', '比宣告兩個 class 更精簡');
  await beat(tok, 3000);
  void hb;
}]);

FRAG.push(['llpeng34-sparse-input', '讀檔建出 sparse matrix', async (tok) => {
  spFrame();
  const lines = ['4 4 4', '0 2 11', '1 0 12', '2 1 -4', '3 3 -15'];
  tag('輸入：' + lines.join('  ｜  '), 'idx', 0.4, 8.6);
  const cur = tag('', 'ptr alt', 0.4, 8.0);
  const G = { ent: [] };
  say('課本的輸入格式：第一行 rows cols terms', '之後每行一個 (row, col, value)');
  await beat(tok, 2600);
  txt(cur, '讀入：4 4 4');
  spHeads(G, true);
  say('4 4 4：4×4 matrix、4 個非 0', 'head node 數 = max{4, 4} = 4，加 1 個藍色 H');
  await beat(tok, 3000);
  const nx = spNext();
  for (const t of SPT) {
    txt(cur, '讀入：' + t.join(' '));
    const e = spEntry(G, t, true);
    const a = [...spRowArrows(G, t[0]), ...spColArrows(G, t[1])];
    glow(e.m, GOLD);
    say('(' + t.join(', ') + ')：串進 row ' + t[0] + ' 和 column ' + t[1], 'a[' + t[0] + '][' + t[1] + '] = ' + t[2]);
    await beat(tok, 2000);
    glow(e.m); void a;
  }
  txt(cur, '讀完');
  say('operator>> 讀檔就建出整個結構', '課本 4.8.2、4.8.3：輸入、transpose 等操作');
  await beat(tok, 3000);
  void nx;
}]);

// ═════════════ Doubly linked list ═════════════
const RLC = 0xc0392b, LLC = 0x2e6fd0;
function dn(text, x, y, z, color, s = 1) {
  const g = new THREE.Group();
  const L = lab.box('#9fc3e8', [0.45 * s, 0.7 * s, 0.9 * s]); L.position.x = -0.75 * s;
  const D = lab.box(color, [1.0 * s, 0.7 * s, 0.9 * s]); D.add(lab.label(String(text), 'val'));
  const R = lab.box('#e8a9a0', [0.45 * s, 0.7 * s, 0.9 * s]); R.position.x = 0.75 * s;
  g.add(L, D, R); g.position.set(x, y, z); g.userData = { x, y, z, s, D, L, R }; lab.world.add(g); return g;
}
function dmove(g, x, y = g.userData.y, z = g.userData.z) { Object.assign(g.userData, { x, y, z }); move(g, x, y, z); }
const rOut = (g) => V3(g.userData.x + 0.95 * g.userData.s, g.userData.y + 0.12, g.userData.z);
const lIn = (g) => V3(g.userData.x - 1.0 * g.userData.s, g.userData.y + 0.12, g.userData.z);
const lOut = (g) => V3(g.userData.x - 0.95 * g.userData.s, g.userData.y - 0.15, g.userData.z);
const rIn = (g) => V3(g.userData.x + 1.0 * g.userData.s, g.userData.y - 0.15, g.userData.z);
const rlinkA = (a, b) => [arrow(rOut(a), lIn(b), RLC)];
const llinkA = (b, a) => [arrow(lOut(b), rIn(a), LLC)];
// 環狀：最後一個的 rlink 繞回 header，header 的 llink 繞到最後一個
function wrapR(a, b, dz = 1.3) {
  const s = a.userData.s, y = a.userData.y + 0.12, z = a.userData.z, ax = a.userData.x, bx = b.userData.x;
  return poly([rOut(a), V3(ax + 1.3 * s, y, z), V3(ax + 1.3 * s, y, z + dz), V3(bx - 1.3 * s, y, z + dz), V3(bx - 1.3 * s, y, z), lIn(b)], RLC);
}
function wrapL(b, a, dz = 1.9) {
  const s = a.userData.s, y = a.userData.y - 0.15, z = a.userData.z, ax = a.userData.x, bx = b.userData.x;
  return poly([lOut(b), V3(bx - 1.55 * s, y, z), V3(bx - 1.55 * s, y, z + dz), V3(ax + 1.55 * s, y, z + dz), V3(ax + 1.55 * s, y, z), rIn(a)], LLC);
}
function dllDraw(D, circ = true) {
  killAll(D.arr);
  const n = D.nodes.length;
  for (let k = 0; k < n; k++) {
    const a = D.nodes[k];
    if (k + 1 < n) { D.arr.push(...rlinkA(a, D.nodes[k + 1]), ...llinkA(D.nodes[k + 1], a)); }
    else if (circ) { D.arr.push(...wrapR(a, D.nodes[0], D.dz || 1.3), ...wrapL(D.nodes[0], a, (D.dz || 1.3) + 0.6)); }
  }
}

FRAG.push(['llpeng34-dll-node', 'Doubly linked list 的 node', async (tok) => {
  fresh([0, 5, 11], [0, 1.6, 0]);
  const cd = code(['class DblListNode {', '  int data;', '  DblListNode *llink, *rlink;', '};', 'class DblList { DblListNode *first; };'], -3.6, 5.6, 0.55);
  const n = dn('data', 2.6, 3.4, 0, '#c9b48e', 1.6);
  const l1 = tag('llink', 'idx', 2.6 - 1.2, 2.5), l2 = tag('rlink', 'idx', 2.6 + 1.2, 2.5);
  cd.hl(2);
  say('Doubly：每個 node 有兩個 link 欄位', 'llink（左）｜data｜rlink（右）');
  await beat(tok, 3000);
  glow(n.userData.L, GOLD);
  say('llink：指向左邊的 node', 'left link field');
  await beat(tok, 2000);
  glow(n.userData.L); glow(n.userData.R, GOLD);
  say('rlink：指向右邊的 node', 'right link field');
  await beat(tok, 2000);
  glow(n.userData.R); kill(n); kill(l1); kill(l2);
  const D = { nodes: [], arr: [] };
  for (const [t, x] of [['A', -3], ['B', 0], ['C', 3]]) { D.nodes.push(dn(t, x, 0.5, 0, colorFor(x + 3))); await beat(tok, 400); }
  dllDraw(D, false);
  cd.hl(4);
  const f = tag('first', 'ptr', -3, 1.6);
  say('紅線往右串、藍線往左串', '比 singly linked list 多一組 link');
  await beat(tok, 3000);
  say('first 指向第一個 node', 'class DblList { first }');
  glow(D.nodes[0].userData.D, GOLD);
  await beat(tok, 2600);
  void f;
}]);

FRAG.push(['llpeng34-dll-header', 'Header node 與環狀 doubly linked list', async (tok) => {
  fresh([0, 6, 12], [0, 0.6, 0.8]);
  const D = { nodes: [], arr: [] };
  const H = dn('H', -4.5, 0.5, 0, '#8a8a8a');
  D.nodes.push(H);
  [['A', -1.5], ['B', 1.5], ['C', 4.5]].forEach(([t, x], k) => D.nodes.push(dn(t, x, 0.5, 0, colorFor(k + 1))));
  tag('header', 'ptr', -4.5, 1.6);
  dllDraw(D);
  say('有 header node 的環狀 doubly linked list', '紅 = rlink（往右），藍 = llink（往左）');
  await beat(tok, 3000);
  glow(H.userData.R, GOLD); glow(D.nodes[1].userData.D, GOLD);
  say('header 的 rlink → 第一個 node', '往右那條 list 的第一個');
  await beat(tok, 2600);
  glow(H.userData.R); glow(D.nodes[1].userData.D);
  glow(H.userData.L, GOLD); glow(D.nodes[3].userData.D, GOLD);
  say('header 的 llink → 最後一個（最右邊）node', '往左那條 list 的第一個');
  await beat(tok, 2800);
  glow(H.userData.L); glow(D.nodes[3].userData.D);
  glow(D.nodes[2].userData.D, GOLD);
  say('中間的 node：左右指標指向前、後一個', 'B.llink = A，B.rlink = C');
  await beat(tok, 2400);
  glow(D.nodes[2].userData.D);
  for (const g of D.nodes.splice(1)) fly(g, V3(0, 8, 3));
  dllDraw(D);
  say('Empty list：只剩 header，指向自己', 'H.llink = H.rlink = H');
  await beat(tok, 3000);
  const A = dn('A', 0.5, 0.5, 0, colorFor(4)); D.nodes.push(A);
  dllDraw(D);
  say('只有一個 node：兩邊都指向它', 'H ⇄ A，A 的左右都指回 header');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-dll-insert', 'Doubly linked list：把 p 插在 x 後面', async (tok) => {
  fresh([0, 5.5, 11], [0, 2, 0]);
  const cd = code(['1  p->llink = x;', '2  p->rlink = x->rlink;', '3  (x->rlink)->llink = p;', '4  x->rlink = p;'], -4.0, 6.4, 0.6);
  const X = dn('x', -3, 0.5, 0, '#c9a227'), R = dn('x→r', 3, 0.5, 0, '#4b9ee2'), P = dn('p', 0, 3, 0, '#d64545');
  let xr = rlinkA(X, R), rl = llinkA(R, X);
  say('把 node p 插在 node x 的後面', '藍色 = x->rlink 指的那個 node');
  await beat(tok, 2800);
  say('四個 link 要改：先想好最後的樣子', 'x ⇄ p ⇄ x->rlink');
  await beat(tok, 2400);
  cd.hl(0); const a1 = arrow(lOut(P), V3(-2.4, 0.95, 0), LLC);
  say('① p 的 llink 指向 x', 'p->llink = x');
  await beat(tok, 2400);
  cd.hl(1); const a2 = arrow(rOut(P), V3(2.4, 0.95, 0), RLC);
  say('② p 的 rlink 指向 x 原本的右邊', 'p->rlink = x->rlink');
  await beat(tok, 2400);
  cd.hl(2); killAll(rl); const a3 = arrow(V3(2.1, 0.7, 0), V3(0.9, 2.6, 0), LLC);
  say('③ 藍色 node 的 llink 改指 p', 'x->rlink->llink = p（指標可以串著寫）');
  await beat(tok, 2600);
  cd.hl(3); killAll(xr); const a4 = arrow(V3(-2.1, 0.9, 0), V3(-0.9, 2.9, 0), RLC);
  say('④ x 的 rlink 改指 p，完成', 'x->rlink = p');
  await beat(tok, 2400);
  [a1, a2, a3, a4].forEach(kill); cd.hl(-1);
  dmove(P, 0, 0.5); dmove(X, -3.2); dmove(R, 3.2);
  const D = { nodes: [X, P, R], arr: [] }; dllDraw(D, false);
  say('結果：x ⇄ p ⇄ 原本 x 的右邊', '');
  await beat(tok, 2400);
  say('問：順序可以顛倒嗎？若 ④ 先做……', 'x->rlink 已經是 p');
  cd.hl(3);
  await beat(tok, 2400);
  cd.hl(1); killAll(D.arr);
  dmove(P, 0, 3); dmove(X, -3); dmove(R, 3);
  const bad = poly([rOut(P), V3(1.4, 3.1, 0), V3(1.4, 3.1, 1.0), V3(-1.4, 3.1, 1.0), V3(-1.4, 3.1, 0), V3(-1.0, 3.1, 0)], RLC);
  glow(P.userData.D, RED);
  say('② 變成 p->rlink = p：右邊那段斷掉了', '<span class="no">③ 必須在 ④ 之前</span>；① ② 對調則沒關係');
  await beat(tok, 3400);
  void bad;
}]);

FRAG.push(['llpeng34-dll-insert-k', '練習：插在 x 後面第 k 個位置', async (tok) => {
  fresh([0, 6, 11.5], [0, 1, 0]);
  const xs = [-5.2, -2.6, 0, 2.6];
  const D = { nodes: [['x', '#c9a227'], ['a', colorFor(1)], ['b', colorFor(2)], ['c', colorFor(3)]].map(([t, c], k) => dn(t, xs[k], 0.5, 0, c)), arr: [] };
  dllDraw(D, false);
  say('練習：把 p 插在 x 後面的第 k 個位置', 'k = 2：x 和 p 中間隔一個 node');
  await beat(tok, 3000);
  const ring = ringAt(0.9); ring.visible = true; ring.position.set(xs[0], 0.05, 0);
  say('從 x 出發', 'q = x');
  await beat(tok, 1600);
  ring.position.set(xs[1], 0.05, 0);
  say('沿 rlink 走 k − 1 = 1 步', 'q = q->rlink');
  await beat(tok, 2000);
  dmove(D.nodes[2], 2.6); dmove(D.nodes[3], 5.2);
  const P = dn('p', 0, 0.5, 0, '#d64545');
  D.nodes.splice(2, 0, P);
  dllDraw(D, false);
  say('再用同樣的 4 行，把 p 插在 q 後面', 'x → a → p：p 是 x 後面第 2 個');
  await beat(tok, 3200);
  ring.visible = false;
}]);

FRAG.push(['llpeng34-dll-delete', 'Doubly linked list：刪除 x', async (tok) => {
  fresh([0, 5.5, 11], [0, 1.8, 0]);
  const cd = code(['1  (x->llink)->rlink = x->rlink;', '2  (x->rlink)->llink = x->llink;', '   delete x;'], -3.4, 6.0, 0.6);
  const L = dn('左', -3.5, 0.5, 0, '#d64545'), X = dn('x', 0, 0.5, 0, '#c9a227'), R = dn('右', 3.5, 0.5, 0, '#2fc092');
  let D = { nodes: [L, X, R], arr: [] }; dllDraw(D, false);
  say('刪除 node x：左（紅）、右（綠）要互相指到對方', '');
  await beat(tok, 2800);
  cd.hl(0);
  const a1 = poly([rOut(L), V3(-2.4, 1.6, 0), V3(2.4, 1.6, 0), lIn(R)], RLC);
  glow(L.userData.R, GOLD);
  say('① x 左邊那個的 rlink 改指 x 的右邊', 'x->llink->rlink = x->rlink');
  await beat(tok, 2800);
  glow(L.userData.R); cd.hl(1);
  const a2 = poly([lOut(R), V3(2.4, 0.35, 1.2), V3(-2.4, 0.35, 1.2), rIn(L)], LLC);
  glow(R.userData.L, GOLD);
  say('② x 右邊那個的 llink 改指 x 的左邊', 'x->rlink->llink = x->llink');
  await beat(tok, 2800);
  glow(R.userData.L); cd.hl(2);
  killAll(D.arr); fly(X, V3(0, 8, 4));
  say('x 沒人指了，delete x', '只改兩個 pointer');
  await beat(tok, 2000);
  killAll(a1); killAll(a2);
  dmove(L, -1.8); dmove(R, 1.8);
  D = { nodes: [L, R], arr: [] }; dllDraw(D, false);
  say('兩行的右邊：x 的 rlink、llink 交給鄰居', '不必另外找前一個 node');
  await beat(tok, 3000);
}]);

FRAG.push(['llpeng34-dll-search', 'Doubly linked list 的好處與搜尋', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.4, 0.8]);
  const V = [15, 12, 10, 7, 5, 3], s = 0.7, xs = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
  const D = { nodes: [dn('H', xs[0], 0.5, 0, '#8a8a8a', s)], arr: [], dz: 1.1 };
  V.forEach((v, k) => D.nodes.push(dn(v, xs[k + 1], 0.5, 0, colorFor(v), s)));
  dllDraw(D);
  say('好處一：一條 link 斷掉，還能從另一個方向接回來', '例子數字為示意');
  await beat(tok, 2600);
  const cut = D.arr[2 * 2]; if (cut) cut.visible = false;
  const xm = tag('✕', 'ptr alt', (xs[2] + xs[3]) / 2, 1.3);
  say('12 → 10 的 rlink 斷了', '往右走不到 10、7 …');
  await beat(tok, 2400);
  const ring = ringAt(0.6); ring.visible = true;
  for (const k of [0, 6, 5, 4, 3]) { ring.position.set(xs[k], 0.05, 0); await beat(tok, 500); }
  say('從 header 的 llink 往左走，一樣到得了', 'H → 3 → 5 → 7 → 10');
  await beat(tok, 2400);
  if (cut) cut.visible = true; kill(xm);
  say('好處二：排序過（大到小），找 7', '沒排序：只能一個一個檢查 O(n)');
  await beat(tok, 2600);
  for (const k of [1, 2, 3, 4]) { ring.position.set(xs[k], 0.05, 0); glow(D.nodes[k].userData.D, GOLD); await beat(tok, 550); glow(D.nodes[k].userData.D); }
  say('從左邊找：15、12、10、7 → 4 次', '');
  await beat(tok, 2000);
  for (const k of [6, 5, 4]) { ring.position.set(xs[k], 0.05, 0); glow(D.nodes[k].userData.D, GOLD); await beat(tok, 550); glow(D.nodes[k].userData.D); }
  glow(D.nodes[4].userData.D, GREEN);
  say('7 比較接近最小的 3 → 從右邊找：3 次', '看數字大小決定往左或往右');
  await beat(tok, 3200);
}]);

FRAG.push(['llpeng34-dll-disk', '檔案的 disk block 用 doubly linked list', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const f = cube('101.txt', '#c9b48e', [3.6, 0.8, 0.9], 0, 3.5, 0, 2);
  say('檔案存在磁碟上：最小單位是 disk block', '101.txt 切成前、中、後三段');
  await beat(tok, 2600);
  fly(f, V3(0, 6, 2));
  // 上排：singly
  const sx = [-3, 0, 3], bl = ['前段', '中段', '後段'];
  tag('singly', 'ptr', -5.6, 0.6, -2.4);
  const sb = sx.map((x, k) => cube(bl[k], colorFor(k + 7), [1.6, 0.7, 0.9], x, 0.35, -2.4, 3));
  const sa = [arrow(V3(-2.2, 0.4, -2.4), V3(-0.8, 0.4, -2.4), RLC), arrow(V3(0.8, 0.4, -2.4), V3(2.2, 0.4, -2.4), RLC)];
  // 下排：doubly（環狀，有 header）
  tag('doubly', 'ptr', -5.6, 0.6, 1.0);
  const D = { nodes: [dn('H', -4.5, 0.5, 0.6, '#8a8a8a', 0.8)], arr: [], dz: 1.0 };
  bl.forEach((t, k) => D.nodes.push(dn(t, -1.5 + 3 * k, 0.5, 0.6, colorFor(k + 7), 0.8)));
  dllDraw(D);
  say('每個 item 其實是一個 disk block', '一個檔案 = 串起來的 disk block');
  await beat(tok, 3000);
  say('停電、磁頭壞掉：前段 → 中段的 pointer 壞了', '');
  sa[0].visible = false; const c1 = tag('✕', 'ptr alt', -1.5, 1.2, -2.4);
  const cut = D.arr[0 + 2]; if (cut) cut.visible = false; const c2 = tag('✕', 'ptr alt', -0.0, 1.3, 0.6);
  await beat(tok, 2400);
  tint(sb[1], GRAY); tint(sb[2], GRAY);
  say('Singly：後面的 block 全部找不到', 'missing node');
  await beat(tok, 2600);
  const ring = ringAt(0.8); ring.visible = true;
  for (const k of [0, 3, 2]) { ring.position.set(D.nodes[k].userData.x, 0.05, 0.6); await beat(tok, 700); }
  say('Doubly：從 header 的 llink 往回走，還找得到', '多一組 link，比較不會遺失');
  await beat(tok, 3200);
  void c1; void c2;
}]);
  }

  // ═══ sqlin.js ═══
  {
// ─── R0MpXbuqfZM：林軒田 DSA Stack / Queue（postfix、迷宮、DFS/BFS） ───
const OPN = '#4b9ee2', OPR = '#dd8238', PAR = '#9b7ef4', OKC = '#2fc092', TODO = '#f2c46d';
const isOp = (t) => !!PREC[t] || t === 'neg' || t === '?:';
const tcol = (t) => (t === '(' || t === ')') ? PAR : isOp(t) ? OPR : OPN;
const disp = (t) => (t === '-' ? '−' : t === 'neg' ? '負' : String(t));
const sx = (n, sp, i) => (i - (n - 1) / 2) * sp;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function tcube(t, x, y, z, sz = 0.6, dropH = 0) { const m = cube(disp(t), tcol(t), [sz, sz * 0.8, sz], x, y, z, dropH); m.userData.t = t; return m; }
function ring(r = 0.5) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; lab.world.add(m); return m;
}
function seg(a, b, color = '#b9a582') { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
// a vertical stack column of value cubes at (x, z)
function col(x, z, opt = {}) {
  const dy = opt.dy || 0.56, size = opt.size || [1.2, 0.5, 1.0], y0 = opt.y0 || 0.3;
  const c = {
    items: [],
    push(t, color) { const m = cube(disp(t), color || tcol(t), size, x, y0 + c.items.length * dy, z, 4); m.userData.t = String(t); c.items.push(m); return m; },
    pop() { const m = c.items.pop(); if (m) fly(m, V3(2, 7, 3)); return m; },
    top() { return c.items[c.items.length - 1]; },
  };
  return c;
}
// infix → postfix trace (same rules as infixSteps, but one event per action, with token index)
function i2pTrace(toks) {
  const st = [], out = [], ev = [];
  const e = (o) => ev.push(Object.assign(o, { st: [...st], out: [...out] }));
  toks.forEach((t, i) => {
    if (!PREC[t] && t !== '(' && t !== ')') { out.push(t); e({ i, t, kind: 'out' }); return; }
    if (t === '(') { st.push(t); e({ i, t, kind: 'push' }); return; }
    if (t === ')') {
      while (st.length && st[st.length - 1] !== '(') { const o = st.pop(); out.push(o); e({ i, t, kind: 'pop', op: o }); }
      st.pop(); e({ i, t, kind: 'lparen' }); return;
    }
    const ra = t === '^';
    while (st.length && st[st.length - 1] !== '(' && (ra ? PREC[st[st.length - 1]] > PREC[t] : PREC[st[st.length - 1]] >= PREC[t])) {
      const o = st.pop(); out.push(o); e({ i, t, kind: 'pop', op: o });
    }
    st.push(t); e({ i, t, kind: 'push' });
  });
  while (st.length) { const o = st.pop(); out.push(o); e({ i: toks.length, t: 'end', kind: 'pop', op: o }); }
  return ev;
}
function capI2P(ev, n) {
  const f = 'output：' + (ev.out.map(disp).join(' ') || '—') + '　｜　stack：' + (ev.st.map(disp).join(' ') || '空');
  if (ev.kind === 'out') return [disp(ev.t) + '：運算元直接輸出', f];
  if (ev.kind === 'lparen') return ['右括號救出左括號，一起丟掉', f];
  if (ev.kind === 'pop') return [ev.i >= n ? '掃完：pop 出 ' + disp(ev.op) : ev.t === ')' ? '遇到 )：pop 出 ' + disp(ev.op) : 'top ' + disp(ev.op) + ' 優先序 ≥ ' + disp(ev.t) + ' → pop', f];
  if (ev.t === '(') return ['左括號：直接 push', f];
  return ['push ' + disp(ev.t) + (ev.st.length > 1 && ev.st[ev.st.length - 2] === '(' ? '（壓在 ( 上）' : ''), f];
}
// animate the stack conversion: input row → (operator stack) → output row
async function animI2P(tok, toks, c) {
  const ms = c.ms || 700, sz = c.sz || 0.6, n = toks.length;
  const inC = toks.map((t, i) => tcube(t, c.inX(i), 0.3, c.inZ, sz));
  const rg = ring(sz * 0.8);
  const st = [], stT = [], out = [];
  const stY = (k) => 0.3 + k * sz * 0.92;
  let prev = -1;
  for (const ev of i2pTrace(toks)) {
    if (ev.i < n) rg.position.set(c.inX(ev.i), 0.03, c.inZ); else rg.visible = false;
    if (ev.i !== prev && ev.i < n && c.onTok) await c.onTok(ev, stT.slice());
    prev = ev.i;
    let hl = -1;
    if (ev.kind === 'out') { const m = inC[ev.i]; out.push(m); move(m, c.outX(out.length - 1), 0.3, c.outZ); hl = 1; }
    else if (ev.kind === 'push') { const m = inC[ev.i]; st.push(m); stT.push(ev.t); move(m, c.stX, stY(st.length - 1), c.stZ); hl = 5; }
    else if (ev.kind === 'pop') { const m = st.pop(); stT.pop(); out.push(m); glow(m, GOLD); move(m, c.outX(out.length - 1), 0.3, c.outZ); hl = ev.i < n ? 4 : 6; }
    else if (ev.kind === 'lparen') { fly(st.pop()); stT.pop(); fly(inC[ev.i]); }
    if (c.code) c.code.hl(hl);
    const cf = (c.cap && c.cap(ev)) || capI2P(ev, n);
    say(cf[0], cf[1]);
    await beat(tok, ms);
    out.forEach((m) => glow(m, null));
  }
  kill(rg);
  return { outC: out, post: out.map((m) => m.userData.t) };
}
// match each postfix token to its (unused) position in the infix row
function slideOrder(toks, post) { const used = new Set(); return post.map((p) => { const i = toks.findIndex((t, k) => t === p && !used.has(k)); used.add(i); return i; }); }

// ── 13:33 Q&A：running time 與時間複雜度 ──
FRAG.push(['sqlin-trend', '時間複雜度是趨勢，running time 是一點', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  line(-6, 0.05, 6, 0.05); line(-6, 0.05, -6, 6.6);
  tag('資料量 n →', 'idx', 5, -0.3); tag('執行時間', 'idx', -6, 7);
  say('時間複雜度：時間隨資料量成長的趨勢', 'asymptotic notation 看的是曲線的形狀');
  const P = []; for (let k = 0; k <= 20; k++) { const u = k / 20; P.push(V3(-6 + 12 * u, 0.05 + 6 * u * u, 0)); }
  for (let k = 1; k <= 20; k++) { seg(P[k - 1], P[k], '#dd8238'); if (k % 4 === 0) await beat(tok, 260); }
  tag('O(n²)', 'ptr alt', 4.6, 6.2);
  await beat(tok, 1200);
  const u0 = 0.55, px = -6 + 12 * u0, py = 0.05 + 6 * u0 * u0;
  cube('', '#c08a1f', [0.35, 0.35, 0.35], px, py, 0, 3);
  tag('這次實際跑的時間', 'ptr', px, py + 0.8);
  say('實際 running time 是曲線上的一個點', '知道趨勢，就能從小資料往大資料估計');
  await beat(tok, 3000);
  fresh([0, 5, 14], [0, 2.8, 0]);
  say('若分析出平方關係：從小資料開始測', 'n × 10 → 時間約 × 100');
  const rows = [['10 筆', 't', 1, '10 筆：先確認程式正確'], ['100 筆', '≈ 100 t', 3, '100 筆：時間約 ×100'], ['1,000 筆', '≈ 10,000 t', 5, '1,000 筆：再 ×100']];
  for (let k = 0; k < rows.length; k++) {
    const [nm, tl, h, cap] = rows[k], x = -4.5 + k * 3;
    const b = lab.box('#4b9ee2', [1.3, 1, 1.3]); b.scale.y = 0.01; b.position.set(x, 0, 0); lab.world.add(b);
    tag(nm, 'idx', x, 0, 1.3);
    say(cap, '高度為對數尺度：每兩格 ×100');
    await anim(tok, 700, (t) => { b.scale.y = h * t; b.position.y = h * t / 2; });
    tag(tl, 'idx', x, h + 0.4);
    await beat(tok, 1300);
  }
  const g = ghostBox('#dd8238', 1.3, 6.4, 1.3); g.position.set(4.5, 3.2, 0);
  tag('最大資料？', 'idx', 4.5, 0, 1.3); tag('估計：1 小時內跑得完嗎', 'ptr alt', 4.5, 6.9);
  say('逐步放大資料，估計大資料要跑多久', '別一開始就把最大的資料丟進去');
  await beat(tok, 3200);
}]);

// ── 19:32 Q&A：O(log n) 與 binary search ──
FRAG.push(['sqlin-binsearch', 'Binary search：每次丟掉一半', async (tok) => {
  fresh([0, 7, 11], [0, 0.5, 0]);
  const A = [3, 8, 12, 17, 21, 25, 30, 34, 41, 47, 52, 58, 63, 70, 77, 85], T = 63;
  const X = (i) => sx(16, 0.82, i);
  const cs = A.map((v, i) => { tag(String(i), 'idx', X(i), 0, 0.8); return cube(v, '#4b9ee2', [0.7, 0.6, 0.7], X(i), 0.3, 0); });
  const tl = tag('lo', 'ptr', X(0), 1.2, -0.4), th = tag('hi', 'ptr', X(15), 1.2, -0.4), tm = tag('mid', 'ptr alt', 0, 1.9, -0.4);
  showL(tm, false);
  say('Ordered array 裡找 ' + T, '利用「有序」：看中間點就知道往哪邊');
  await beat(tok, 2000);
  let lo = 0, hi = 15, k = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; k++;
    showL(tm, true); tm.position.set(X(mid), 1.9, -0.4); glow(cs[mid], GOLD);
    say('第 ' + k + ' 個中間點：A[' + mid + '] = ' + A[mid], A[mid] === T ? A[mid] + ' == ' + T : A[mid] + (A[mid] < T ? ' < ' : ' > ') + T);
    await beat(tok, 1500);
    if (A[mid] === T) { tint(cs[mid], OKC); break; }
    const [a, b] = A[mid] < T ? [lo, mid] : [mid, hi];
    for (let i = a; i <= b; i++) { tint(cs[i], GRAY); move(cs[i], X(i), 0.3, 1.6); }
    glow(cs[mid], null);
    if (A[mid] < T) lo = mid + 1; else hi = mid - 1;
    tl.position.set(X(lo), 1.2, -0.4); th.position.set(X(hi), 1.2, -0.4);
    say(A[mid] < T ? '答案不可能在左半：整半丟掉' : '答案不可能在右半：整半丟掉', '剩下 A[' + lo + '..' + hi + ']，共 ' + (hi - lo + 1) + ' 個');
    await beat(tok, 1600);
  }
  say('找到了：只看了 ' + k + ' 個中間點', '16 個數 → log₂16 = 4 → O(log n)');
  await beat(tok, 2400);
  say('Divide & Conquer：切成小問題，丟掉不可能的那半', '大問題 → 兩個小問題 → 只留一個');
  await beat(tok, 2800);
}]);

// ── 32:07 括號配對 ──
FRAG.push(['sqlin-paren', '括號配對：左括號 push、右括號 pop', async (tok) => {
  fresh([0, 6, 11], [-0.6, 1.2, 0]);
  tag('stack', 'ptr', 4, 0, 1.2);
  async function run(s) {
    const X = (i) => -6 + i * 0.6;
    const cs = [...s].map((ch, i) => cube(ch, ch === '(' || ch === ')' ? PAR : GRAY, [0.48, 0.45, 0.48], X(i), 0.25, 0));
    const stk = col(4, 0, { size: [1.1, 0.5, 1.0] });
    const rg = ring(0.35);
    let ok = true;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; rg.position.set(X(i), 0.03, 0);
      if (ch === '(') {
        const m = stk.push('(', PAR); m.userData.src = cs[i];
        say('左括號：push', 'stack 裡有 ' + stk.items.length + ' 個左括號');
        await beat(tok, 900);
      } else if (ch === ')') {
        if (!stk.items.length) { tint(cs[i], '#d64545'); say('右括號找不到左括號', '<span class="no">stack 已空 → 不平衡</span>'); await beat(tok, 2200); ok = false; break; }
        const m = stk.top(); glow(m, GOLD); glow(cs[i], GOLD); glow(m.userData.src, GOLD);
        say('右括號：和 stack top 的左括號配對', '最近一個還沒配對的左括號');
        await beat(tok, 1000);
        tint(cs[i], OKC); tint(m.userData.src, OKC); glow(cs[i], null); glow(m.userData.src, null);
        stk.pop();
        await beat(tok, 500);
      } else { await beat(tok, 260); }
    }
    kill(rg);
    if (ok) say(stk.items.length ? '掃完還有左括號 → 不平衡' : '掃完 stack 是空的 → 括號平衡', stk.items.length ? '<span class="no">unbalanced</span>' : '<span class="ok">balanced</span>');
    await beat(tok, 2200);
    cs.forEach(kill); stk.items.forEach(kill);
  }
  say('只看括號：用 stack 檢查有沒有平衡', '');
  await beat(tok, 1400);
  await run('((a+b)*(c-d))');
  await run('(a+b))');
  say('Stack 可用 array 或 linked list 實作', '關鍵：top 放哪一端，push/pop 才是 O(1)');
  await beat(tok, 2600);
}]);

// ── 35:00 A/B−C+D*E−A*C：先乘除後加減 ──
FRAG.push(['sqlin-infix-order', 'Infix：先乘除後加減的計算順序', async (tok) => {
  fresh([0, 6, 11], [0, 0.6, 0]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.85, i);
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, 0, 0.66));
  say('程式裡寫 A/B−C+D*E−A*C', '人知道：先乘除、後加減');
  await beat(tok, 2200);
  const NUM = ['①', '②', '③', '④', '⑤', '⑥'];
  const plan = [[1, 0, 2, '先做 A / B', 't₁ = A / B'], [3, 0, 4, '再減 C', 't₂ = t₁ − C'], [5, -1, -1, '看到 + 先別加：D 要先乘', '不能先算 t₂ + D'],
    [7, 6, 8, 'D * E 先做', 't₃ = D * E'], [5, 0, 8, '才做加法', 't₄ = t₂ + t₃'], [11, 10, 12, 'A * C', 't₅ = A * C'], [9, 0, 12, '最後相減', 't₆ = t₄ − t₅']];
  let k = 0;
  for (const [op, a, b, cap, f] of plan) {
    if (a < 0) {
      glow(cs[op], '#7a1010'); glow(cs[6], GOLD); glow(cs[7], GOLD);
      say(cap, f); await beat(tok, 2400);
      glow(cs[op], null); glow(cs[6], null); glow(cs[7], null); continue;
    }
    for (let i = a; i <= b; i++) glow(cs[i], GOLD);
    tag(NUM[k++], 'ptr alt', X(op), 1.2);
    say(cap, f);
    await beat(tok, 1700);
    for (let i = a; i <= b; i++) glow(cs[i], null);
  }
  say('電腦需要的是這樣一步一步的計算過程', '① ÷ ② − ③ × ④ + ⑤ × ⑥ −');
  await beat(tok, 3000);
}]);

// ── 37:42 Postfix：運算元不動，動作放後面 ──
FRAG.push(['sqlin-postfix-idea', 'Postfix：把運算子移到運算元後面', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.2, 0.4]);
  const toks = tokenize('A/B-C+D*E-A*C'), post = 'A B / C - D E * + A C * -'.split(' '), X = (i) => sx(13, 0.85, i);
  tag('infix（中序）', 'idx', 0, 0, -2.6); tag('postfix（後序）', 'idx', 0, 0, 3);
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.66));
  say('Postfix notation：A B C D E 不動', '只把動作（operator）放到數字後面');
  await beat(tok, 2200);
  const ord = slideOrder(toks, post);
  for (let k = 0; k < post.length; k++) {
    const m = cs[ord[k]];
    move(m, X(k), 0.3, 1.8);
    if (k === 2) say('A / B → A B /：讀 A、讀 B、做除法', 'postfix：' + post.slice(0, 3).map(disp).join(' '));
    else say(isOp(post[k]) ? '運算元都備好了 → 下指令 ' + disp(post[k]) : '運算元 ' + post[k] + '：照原來順序', 'postfix：' + post.slice(0, k + 1).map(disp).join(' '));
    await beat(tok, k === 2 ? 2200 : 1050);
  }
  cs.forEach((m, i) => { if (!isOp(toks[i])) glow(m, GOLD); });
  say('A B C D E 出現順序和 infix 一樣', '只移動 operator：A B / C − D E * + A C * −');
  await beat(tok, 3200);
}]);

// ── 42:05 人工法：加括號再換位置（3/4−5+6*7−8*9） ──
FRAG.push(['sqlin-human-paren', '人工轉換：加括號、括號內換成 postfix', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.2, 0.4]);
  const toks = tokenize('3/4-5+6*7-8*9'), post = '3 4 / 5 - 6 7 * + 8 9 * -'.split(' '), X = (i) => sx(13, 0.85, i), Z = -1.2;
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, Z, 0.62));
  say('3 / 4 − 5 + 6 * 7 − 8 * 9', '人工演算法：先用括號標出運算順序');
  await beat(tok, 2000);
  const boxes = [];
  function wrap(a, b, color, pad, h) { const g = ghostBox(color, X(b) - X(a) + 0.7 + pad, h, h); g.position.set((X(a) + X(b)) / 2, h / 2, Z); boxes.push(g); }
  for (const [a, b] of [[0, 2], [6, 8], [10, 12]]) wrap(a, b, '#4b9ee2', 0.15, 0.9);
  say('藍括號：先乘除的先括起來', '(3/4)　(6*7)　(8*9)');
  await beat(tok, 2200);
  [[0, 4, 0.4, 1.15], [0, 8, 0.65, 1.4], [0, 12, 0.9, 1.65]].forEach(([a, b, p, h]) => wrap(a, b, '#d64545', p, h));
  say('紅括號：其餘由左到右一層層括', '每個括號裡：左運算元、右運算元、運算子');
  await beat(tok, 2600);
  const ord = slideOrder(toks, post);
  const caps = { 2: '(3 4 /)', 4: '((3 4 /) 5 −)', 7: '(6 7 *)', 8: '+ 接在兩半之後', 11: '(8 9 *)', 12: '最外層 −' };
  for (let k = 0; k < post.length; k++) {
    move(cs[ord[k]], X(k), 0.3, 2.2);
    say(caps[k] ? '括號內換成 postfix：' + caps[k] : '運算元：順序不變', 'postfix：' + post.slice(0, k + 1).map(disp).join(' '));
    await beat(tok, caps[k] ? 1300 : 650);
  }
  boxes.forEach(kill);
  say('括號只是輔助：轉完就拿掉', '3 4 / 5 − 6 7 * + 8 9 * −');
  await beat(tok, 3000);
}]);

// ── 47:23 / 50:31 用 stack 求值：用 postfix-eval（現成）。52:35 一般化：需要幾個就 pop 幾個 ──
FRAG.push(['sqlin-postfix-arity', 'Postfix 求值：運算子要幾個運算元就 pop 幾個', async (tok) => {
  fresh([0, 6, 12], [0, 1.8, 0]);
  tag('operand stack', 'ptr', 3, 0, 1.3);
  async function run(toks, intro, f) {
    const X = (i) => -5.2 + i * 1.25;
    const cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.8));
    const stk = col(3, 0, { size: [1.3, 0.5, 1.0] });
    const rg = ring(0.6);
    say(intro, f); await beat(tok, 2000);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]; rg.position.set(X(i), 0.03, -1.6); glow(cs[i], GOLD);
      if (!isOp(t)) { stk.push(t); say('數字：push', 'stack：' + stk.items.map((m) => m.userData.t).join('，')); await beat(tok, 1000); glow(cs[i], null); continue; }
      const k = t === 'neg' ? 1 : t === '?:' ? 3 : 2;
      const args = stk.items.slice(-k).map((m) => Number(m.userData.t));
      stk.items.slice(-k).forEach((m) => glow(m, GOLD));
      say(k === 1 ? 'unary 負號：只 pop 1 個' : k === 3 ? 'ternary ?: ：pop 3 個' : 'binary ×：pop 2 個', 'pop 出 ' + args.join('、'));
      await beat(tok, 1500);
      for (let j = 0; j < k; j++) stk.pop();
      const r = k === 1 ? -args[0] : k === 3 ? (args[0] ? args[1] : args[2]) : args[0] * args[1];
      stk.push(r, OKC);
      say('算完把結果 push 回去', k === 3 ? args[0] + ' ? ' + args[1] + ' : ' + args[2] + ' = ' + r : k === 1 ? '−(' + args[0] + ') = ' + r : args[0] + ' × ' + args[1] + ' = ' + r);
      await beat(tok, 1300); glow(cs[i], null);
    }
    kill(rg);
    say('跑完：stack 只剩一個 element', '它就是運算式的值 = <span class="ok">' + stk.items[0].userData.t + '</span>');
    await beat(tok, 2200);
    cs.forEach(kill); stk.items.forEach(kill);
  }
  await run(['5', '3', 'neg', '*'], '5 × (−3)：負號只接一個數字', 'postfix：5 3 負 ×');
  await run(['1', '7', '9', '?:'], 'C 的 1 ? 7 : 9：接三個東西', 'postfix：1 7 9 ?:');
}]);

// ── 59:20 Q&A：十進位轉二進位需要 stack 嗎 ──
FRAG.push(['sqlin-binary', '十進位轉二進位：何時需要 stack', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  say('13 轉二進位：從最大的 2 的次方往下', 'for 迴圈直接輸出，不需要額外儲存');
  await beat(tok, 1800);
  let n = 13; const outs = [];
  [8, 4, 2, 1].forEach((p, i) => tag(String(p), 'idx', -4.5 + i * 1.3, 0, -1.4));
  for (let i = 0; i < 4; i++) {
    const p = [8, 4, 2, 1][i], b = n >= p ? 1 : 0; if (b) n -= p;
    outs.push(cube(b, b ? OKC : GRAY, [0.9, 0.7, 0.9], -4.5 + i * 1.3, 0.35, 0, 3));
    say(p + (b ? ' ≤ 剩下的數 → 輸出 1' : ' > 剩下的數 → 輸出 0'), '剩下 ' + n);
    await beat(tok, 1100);
  }
  say('高位先算出、高位先輸出：直接印', '13 = 8 + 4 + 1 → 1101');
  await beat(tok, 2200);
  outs.forEach((m) => fly(m)); await beat(tok, 600);
  fresh([0, 6, 12], [0, 1.6, 0]);
  tag('stack', 'ptr', 3, 0, 1.3);
  say('換一種做法：一直除以 2', '先得到的是最低位');
  await beat(tok, 1600);
  const stk = col(3, 0, { size: [1.1, 0.5, 1.0] });
  n = 13;
  while (n > 0) {
    const r = n % 2, q = n >> 1;
    stk.push(r, r ? OKC : GRAY);
    say('餘數 push 進 stack', n + ' ÷ 2 = ' + q + ' 餘 ' + r);
    n = q; await beat(tok, 1200);
  }
  say('算出：低位 → 高位；輸出要：高位 → 低位', '用 stack 反轉順序');
  await beat(tok, 1800);
  const res = [];
  for (let i = 0; stk.items.length; i++) {
    const m = stk.items.pop(); res.push(m.userData.t); move(m, -4.5 + i * 1.3, 0.3, 1.2);
    say('pop：最後算的最高位先出', '輸出：' + res.join(''));
    await beat(tok, 900);
  }
  say('需不需要 stack，看計算順序和輸出順序', '13 → 1101');
  await beat(tok, 2600);
}]);

// ── 79:51 / 105:29 人工法多次掃描 vs stack 的 one-pass ──
FRAG.push(['sqlin-onepass', '人工法掃很多次 vs Stack 只掃一次', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.75, i);
  let cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.58));
  const rg = ring(0.45);
  const passes = ['加上先乘除的括號', '由左到右加其餘括號', '括號內換成 postfix', '把括號拿掉'];
  say('人工法（human algorithm）', '要把整個式子掃很多次');
  await beat(tok, 1500);
  for (let k = 0; k < passes.length; k++) {
    say('第 ' + (k + 1) + ' 次掃描：' + passes[k], 'human algorithm：multiple pass');
    await anim(tok, 1300, (t) => rg.position.set(X(0) + (X(12) - X(0)) * t, 0.03, -1.6));
    await beat(tok, 300);
  }
  kill(rg); cs.forEach(kill); cs = [];
  say('Stack 演算法：從左到右只掃一次', 'one-pass algorithm：讀完就完成');
  await beat(tok, 1800);
  await animI2P(tok, toks, { inX: X, inZ: -1.6, outX: X, outZ: 2, stX: 6, stZ: 0, sz: 0.58, ms: 420 });
  say('只掃一次就得到 postfix', 'A B / C − D E * + A C * −');
  await beat(tok, 2800);
}]);

// ── 86:13 為什麼存在 stack：最近存入的先處理 ──
FRAG.push(['sqlin-i2p-why', '運算子先存起來：最近存的最先處理', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0.4]);
  const OX = (k) => -5.2 + k * 0.72;
  const done = ['A', 'B', '/', 'C', '-', 'D', 'E'];
  const outC = done.map((t, k) => tcube(t, OX(k), 0.3, 2.6, 0.58));
  tag('output', 'idx', -5.6, 0, 3.5); tag('stack', 'ptr', 2.5, 0, 1.2);
  tag('A/B−C+D*E −A*C', 'idx', -2.5, 0, -2.8);
  const stk = [];
  for (const t of ['+', '*']) { const m = tcube(t, 2.5, 0.3 + stk.length * 0.56, 0, 0.62, 4); stk.push(m); }
  say('讀到 + 和 *：都還不能輸出，先存起來', 'stack（底→頂）：+ *　｜ output：A B / C − D E');
  await beat(tok, 3000);
  const inc = tcube('-', -2.5, 0.35, -1.4, 0.66, 3);
  tag('剛讀到', 'ptr alt', -2.5, 1.2, -1.4);
  say('讀到後面的 −', '* 和 + 誰先處理？');
  await beat(tok, 2200);
  let k = done.length;
  for (const [cap, f] of [['最近存入的 * 先處理（優先序較高）', 'pop * → output'], ['回頭處理 +：同優先序、較早出現', 'pop + → output']]) {
    const m = stk.pop(); glow(m, GOLD);
    say(cap, f); await beat(tok, 1500);
    move(m, OX(k++), 0.3, 2.6); glow(m, null);
    await beat(tok, 1300);
  }
  move(inc, 2.5, 0.3, 0);
  say('最後把 − 壓進 stack', 'output：A B / C − D E * +　｜ stack：−');
  await beat(tok, 2200);
  say('從後往前追：最後存的最先處理 → Stack', 'LIFO 正好符合「最接近的先完成」');
  await beat(tok, 3000);
  outC.length = 0;
}]);

// ── 88:03 演算法：pseudo code + stack ──
FRAG.push(['sqlin-i2p-rule', 'Infix → Postfix 的 stack 演算法（逐行）', async (tok) => {
  fresh([0, 6.5, 13], [0, 2.4, 0]);
  const cd = code(['for x in infix（左→右）:', '  運算元: 輸出 x', '  運算子:', '    while top 優先序 ≥ x:', '      輸出 pop()', '    push(x)', '掃完: pop 剩下的全部輸出'], -3.4, 6.2);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.72, i);
  tag('stack', 'ptr', 5, 0, 1.2); tag('output', 'idx', -5.6, 0, 3.6);
  cd.hl(0);
  say('A/B−C+D*E−A*C：從左到右掃一次', '');
  await beat(tok, 1800);
  await animI2P(tok, toks, {
    inX: X, inZ: -2.6, outX: X, outZ: 2.8, stX: 5, stZ: 0, sz: 0.56, ms: 780, code: cd,
    onTok: async (ev, stT) => {
      if (!PREC[ev.t]) return;
      cd.hl(3);
      say('讀到 ' + disp(ev.t) + '：和 stack top 比優先序', 'top = ' + (stT.length ? disp(stT[stT.length - 1]) : '空 → 直接 push'));
      await beat(tok, 900);
    },
  });
  cd.hl(-1);
  say('while 可能連 pop 好幾次（* 和 + 一起出）', 'A B / C − D E * + A C * −');
  await beat(tok, 3000);
}]);

// ── 92:39 / 101:57 兩個 stack 合起來＝計算機 ──
FRAG.push(['sqlin-calc', '計算機：operator stack 轉換 + operand stack 求值', async (tok) => {
  const expr = (ctx.params || {}).expr || '3*(5+7)';
  fresh([0, 7.5, 13], [0, 1.4, 0.4]);
  const toks = tokenize(expr), n = toks.length, np = toks.filter((t) => t !== '(' && t !== ')').length;
  const IX = (i) => sx(n, 0.75, i), OX = (k) => sx(np, 0.68, k);
  tag('operator stack', 'ptr', -6, 0, 1.4); tag('operand stack', 'ptr alt', 6, 0, 1.4); tag('postfix', 'idx', 0, 0, 3.4);
  say('① 轉換：用 operator stack', expr.replace(/-/g, '−'));
  await beat(tok, 1800);
  const { outC, post } = await animI2P(tok, toks, { inX: IX, inZ: -3, outX: OX, outZ: 2.6, stX: -6, stZ: 0.4, sz: 0.58, ms: 520 });
  say('得到 postfix', post.map(disp).join(' '));
  await beat(tok, 1600);
  say('② 求值：用 operand stack', '數字 push；運算子 pop 兩個、算完 push');
  await beat(tok, 1600);
  const steps = evalSteps(post), stk = col(6, 0.4, { size: [1.3, 0.5, 1.0] }), rg = ring(0.4);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]; rg.position.set(OX(i), 0.03, 2.6); glow(outC[i], GOLD);
    if (!PREC[s.tok]) { stk.push(s.tok); say('數字：push', 'stack：' + s.stack.join('，')); }
    else { stk.pop(); stk.pop(); stk.push(s.stack[s.stack.length - 1], OKC); say('pop 兩個、計算、push 回去', s.why); }
    await beat(tok, PREC[s.tok] ? 1100 : 650);
    glow(outC[i], null);
  }
  kill(rg);
  say('stack 只剩一個：就是答案', expr.replace(/-/g, '−') + ' = <span class="ok">' + steps[steps.length - 1].stack[0] + '</span>');
  await beat(tok, 3000);
}]);

// ── 96:07 left / right associative、unary 減號 ──
FRAG.push(['sqlin-assoc', '同優先序：左結合要 pop，右結合壓上去', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.2, 0.2]);
  tag('left associative', 'ptr', -3.5, 2.6, -3.2); tag('right associative', 'ptr alt', 3.5, 2.6, -3.2);
  say('基本款：binary operator、left associative', '同優先序時左邊先算');
  await beat(tok, 2000);
  for (const [px, expr, sX] of [[-3.5, 'A-B-C', -0.7], [3.3, 'A^B^C', 6.2]]) {
    const toks = tokenize(expr), X = (i) => px + sx(5, 0.72, i);
    await animI2P(tok, toks, {
      inX: X, inZ: -2.2, outX: X, outZ: 2.2, stX: sX, stZ: 0, sz: 0.56, ms: 900,
      cap: (ev) => {
        const f = 'output：' + (ev.out.map(disp).join(' ') || '—') + '　｜　stack：' + (ev.st.map(disp).join(' ') || '空');
        if (ev.kind === 'pop' && ev.i < 5) return ['同優先序、左結合 → stack 內的先 pop', f];
        if (ev.kind === 'push' && ev.t === '^' && ev.st.length === 2) return ['右結合：同優先序不 pop，直接壓上去', f];
        return null;
      },
    });
    say(expr === 'A-B-C' ? 'A−B−C = (A−B)−C' : 'A^B^C = A^(B^C)', expr === 'A-B-C' ? 'A B − C −' : 'A B C ^ ^');
    await beat(tok, 2000);
  }
  say('難處：「−」是減號還是負號？', '例：5 * −3，這個架構要特殊處理');
  await beat(tok, 3000);
}]);

// ── 114:30 迷宮問題：有沒有解 ──
FRAG.push(['sqlin-maze-problem', '迷宮問題：從入口走得到出口嗎', async (tok) => {
  fresh([0, 13, 9], [0, 0, 0.5]);
  mz.kind = 'stack'; enterMaze(); controls('');
  say('二維迷宮：每一格只知道上下左右能不能走', '');
  await beat(tok, 2200);
  const s = cellPos(1, 1).setY(0.6), arws = [];
  for (const [dr, dc] of DIRS) {
    const r = 1 + dr, c = 1 + dc, open = MAZE[r][c] !== '#';
    if (open) arws.push(arrow(s, cellPos(r, c).setY(0.6), 0x2fc092));
    else { const t = tag('✕', 'ptr', ...cellPos(r, c).setY(1.2).toArray()); arws.push(t); }
  }
  say('起點：右、下可以走；上、左是牆', '可走 → 箭頭；牆 → ✕');
  await beat(tok, 2600);
  arws.forEach(kill);
  say('問題：從起點走得到終點嗎？', '先不管路線，只問「迷宮有沒有解」');
  await beat(tok, 2600);
  for (const k of ['6,7', '5,7', '4,7', '3,7', '2,7', '1,7']) paint(k, '#cfe8dc');
  say('這個迷宮：終點只能從上面這條通道進去', '');
  await beat(tok, 2000);
  const p = cellPos(6, 7);
  cube('', '#b9a582', [1.05, 0.9, 1.05], p.x, 0.45, p.z, 5);
  paint('6,7', '#e9c9c0');
  say('如果這裡被封起來……', '<span class="no">迷宮無解</span>：電腦要怎麼確定？');
  await beat(tok, 3200);
}]);

// ── 116:30 / 174:42 遞迴走迷宮：system stack ──
FRAG.push(['sqlin-maze-rec', '遞迴走迷宮：system stack 上是一條路', async (tok) => {
  fresh([1, 13, 9], [1, 0, 0.5]);
  mz.kind = 'stack'; enterMaze(); controls('');
  tag('system stack', 'ptr', 6, 0.4, 5.2);
  const seen = new Set(), frames = [];
  const fz = (k) => 4.4 - k * 0.42;
  say('maze(i, j)：標記走過，再試每個沒走過的鄰居', '鄰居是出口 → 成功；否則遞迴呼叫');
  await beat(tok, 2200);
  async function visit(r, c) {
    const key = r + ',' + c; seen.add(key); paint(key, OKC);
    frames.push(cube('(' + r + ',' + c + ')', '#9b7ef4', [1.3, 0.3, 0.36], 6, 0.15, fz(frames.length), 2));
    say('呼叫 maze(' + r + ',' + c + ')：標記走過', 'system stack 深度 = ' + frames.length);
    await beat(tok, 260);
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
      if (MAZE[nr][nc] === '#' || seen.has(k)) continue;
      if (MAZE[nr][nc] === 'G') { paint(k, '#c08a1f'); return true; }
      if (await visit(nr, nc)) return true;
    }
    paint(key, '#e9c9c0'); fly(frames.pop(), V3(2, 6, 2));
    say('四個方向都不通：return，退回上一層', 'system stack 深度 = ' + frames.length);
    await beat(tok, 200);
    return false;
  }
  await visit(1, 1);
  frames.forEach((f) => { tint(f, '#c08a1f'); const m = /\((\d+),(\d+)\)/.exec(f.userData.lbl.element.textContent); paint(m[1] + ',' + m[2], '#c08a1f'); });
  say('鄰居是出口：成功！', 'system stack 上剛好是一條從起點出發的路（' + frames.length + ' 層）');
  await beat(tok, 3400);
  say('遞迴 = 偷偷用 system stack，一路深入、走不通退回', '這就是 DFS 的行為');
  await beat(tok, 2600);
}]);

// ── 138:20 為什麼要標 to-do：重複 entry ──
FRAG.push(['sqlin-todo', '放進 stack 時標 to-do：避免重複 entry', async (tok) => {
  fresh([0, 8, 11], [-0.8, 1.2, 0.3]);
  const R = 3, C = 3, X = (c) => -5.4 + c * 1.35, Z = (r) => -1.4 + r * 1.35;
  const tiles = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { tiles[r + ',' + c] = cube('', '#f3ead9', [1.2, 0.1, 1.2], X(c), 0.05, Z(r)); tag('(' + r + ',' + c + ')', 'idx', X(c), 0.3, Z(r)); }
  tag('stack（記事本）', 'ptr', 2.6, 0, 1.3);
  const info = tag('', 'ptr alt', 5.6, 0, -1.6);
  async function run(useTodo) {
    Object.values(tiles).forEach((t) => tint(t, '#f3ead9'));
    const stk = col(2.6, 0, { size: [1.3, 0.42, 1.0], dy: 0.46 });
    const vis = new Set(), todo = new Set(), inStk = [];
    let pushes = 0, dups = 0, wasted = 0;
    const push = (k) => { const dup = inStk.includes(k); const m = stk.push('(' + k + ')', dup ? '#d64545' : TODO); m.userData.k = k; inStk.push(k); pushes++; if (dup) dups++; if (useTodo) todo.add(k); tint(tiles[k], TODO); return dup; };
    say(useTodo ? '有標 to-do：放進記事本就標記' : '沒有標 to-do：只記 visited', '從 (2,0) 出發，依 右、下、左、上 看鄰居');
    push('2,0'); await beat(tok, 1600);
    while (stk.items.length) {
      const m = stk.items[stk.items.length - 1], k = m.userData.k; glow(m, GOLD);
      await beat(tok, 300);
      stk.pop(); inStk.pop();
      if (vis.has(k)) { wasted++; say('pop 出 (' + k + ')：已經 visited → 白拿一次', '重複的 entry'); await beat(tok, 900); continue; }
      vis.add(k); tint(tiles[k], OKC);
      const [r, c] = k.split(',').map(Number); let anyDup = false;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc, k2 = nr + ',' + nc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C || vis.has(k2) || (useTodo && todo.has(k2))) continue;
        if (push(k2)) anyDup = true;
      }
      say(anyDup ? '同一格又被寫進記事本一次！' : 'visit (' + k + ')：鄰居寫進記事本', 'push ' + pushes + ' 次，重複 entry ' + dups + ' 個');
      txt(info, (useTodo ? '有 to-do' : '無 to-do') + '：push ' + pushes + '、重複 ' + dups);
      await beat(tok, anyDup ? 1500 : 800);
      tint(tiles[k], '#cfe8dc');
    }
    return { pushes, dups, wasted };
  }
  const a = await run(false);
  say('沒標 to-do：' + a.dups + ' 個重複 entry', 'pop 出來還得檢查 visited，否則重複展開');
  await beat(tok, 2600);
  const b = await run(true);
  say('標 to-do：同一格只進記事本一次', 'push 次數 ' + a.pushes + ' → ' + b.pushes + '，重複 ' + a.dups + ' → ' + b.dups);
  await beat(tok, 3000);
}]);

// ── 156:54 Container：隨手抽一個的袋子 → random walk ──
FRAG.push(['sqlin-container', 'Container 換成隨機袋子：random walk', async (tok) => {
  fresh([1, 13, 9], [1, 0, 0.5]);
  mz.kind = 'stack'; enterMaze(); controls('');
  const bag = ghostBox('#9b7ef4', 1.8, 1.6, 1.8); bag.position.set(6, 0.8, 0);
  tag('袋子（container）', 'ptr', 6, 2.2, 0); const cnt = tag('裡面 1 格', 'idx', 6, 0, 1.4);
  say('記事本只要能「放進一個、拿出一個」', '這種東西叫 container');
  await beat(tok, 2200);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const s = findCell('S'), cont = [s], par = { [s]: null }, mark = new Set([s]);
  let pops = 0, goal = null;
  say('這個袋子：每次隨便抽一個出來', '像喝醉酒亂走：random walk');
  await beat(tok, 1600);
  let cur = null;
  while (cont.length) {
    if (cur) paint(cur, '#cfe8dc');
    const key = cont.splice(Math.floor(rnd() * cont.length), 1)[0]; cur = key; pops++;
    paint(key, OKC);
    const [r, c] = key.split(',').map(Number);
    if (MAZE[r][c] === 'G') { goal = key; break; }
    for (const [dr, dc] of DIRS) {
      const k2 = (r + dr) + ',' + (c + dc);
      if (MAZE[r + dr][c + dc] !== '#' && !mark.has(k2)) { mark.add(k2); par[k2] = key; cont.push(k2); paint(k2, TODO); }
    }
    txt(cnt, '裡面 ' + cont.length + ' 格');
    say('隨機抽出一格，鄰居放進袋子', '已抽 ' + pops + ' 次');
    await beat(tok, 230);
  }
  let len = 0; for (let k = goal; k; k = par[k]) { paint(k, '#c08a1f'); len++; }
  say('亂走也找到出口了', '抽了 ' + pops + ' 次，這條路長 ' + (len - 1) + ' 步');
  await beat(tok, 2800);
  say('任何 container：有解一定找到、沒解一定回報', '但放進/拿出的規則不同 → 行為與找到的路不同');
  await beat(tok, 3200);
}]);

// ── 164:54 Circular array：0~9 首尾相接 ──
FRAG.push(['sqlin-circ10', 'Circular array：10 格首尾相接', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.4]);
  const N = 10, P = (i, r = 3.8) => { const a = Math.PI / 2 - (i / N) * Math.PI * 2; return V3(Math.cos(a) * r, 0, -Math.sin(a) * r); };
  for (let i = 0; i < N; i++) { const p = P(i); cube('', '#e9dcc4', [1.3, 0.08, 1.3], p.x, 0.02, p.z); const q = P(i, 5.1); tag('[' + i + ']', 'idx', q.x, 0.1, q.z); }
  say('array：0 號到 9 號，10 個位置', '把它想成頭尾接起來');
  await beat(tok, 1800);
  const rg = ring(0.75);
  for (let k = 0; k <= 13; k++) {
    const p = P(k % N); rg.position.set(p.x, 0.05, p.z);
    say(k < N ? '往後走：' + k : '9 之後繞回 0，繼續走', k >= N ? '(' + (k - 1) % N + ' + 1) % 10 = ' + (k % N) : 'index = ' + k);
    await beat(tok, k === N ? 1300 : 380);
  }
  kill(rg);
  const pf = P(2, 2.3), pe = P(1, 2.3);
  tag('抽象開頭', 'ptr', pf.x, 1.4, pf.z); tag('抽象結尾', 'ptr alt', pe.x, 1.4, pe.z);
  say('抽象的開頭在 2 號，結尾在它的前一格 1 號', '');
  await beat(tok, 2200);
  for (let k = 0; k < N; k++) {
    const i = (2 + k) % N, p = P(i);
    cube(k + 1, colorFor(k + 1), [1.0, 0.7, 1.0], p.x, 0.4, p.z, 4);
    say(i === 0 ? '過了 9 號，繞回 0 號繼續放' : '從 2 號往後連續使用', '放在 [' + i + ']');
    await beat(tok, i === 0 ? 1200 : 450);
  }
  say('10 格空間連續又循環地使用', 'front / rear 怎麼定、怎麼判滿：課本 reading assignment');
  await beat(tok, 3200);
}]);

// ── 167:53 / 171:12 Stack → DFS、Queue → BFS（入口、A、AA…） ──
FRAG.push(['sqlin-tree-search', '記事本是 Stack 還是 Queue：DFS vs BFS', async (tok) => {
  const kind = (ctx.params || {}).kind === 'queue' ? 'queue' : 'stack';
  fresh([0.5, 10, 10], [0.5, 0.3, 0.3]);
  const P = { E: [-6, 0], A: [-3.4, -3], B: [-3.4, 0], C: [-3.4, 3], AA: [-0.8, -4], AB: [-0.8, -2], X2: [-0.8, 0], CA: [-0.8, 3], AAA: [1.8, -4], X1: [4.4, -4] };
  const NAME = { E: '入口', X1: '出口₁', X2: '出口₂' };
  const KIDS = { E: ['A', 'B', 'C'], A: ['AA', 'AB'], AA: ['AAA'], AAA: ['X1'], B: ['X2'], C: ['CA'], AB: [], CA: [], X1: [], X2: [] };
  const nm = (k) => NAME[k] || k, node = {}, par = { E: null }, dep = { E: 0 };
  for (const k in KIDS) for (const ch of KIDS[k]) seg(V3(P[k][0] + 0.65, 0.3, P[k][1]), V3(P[ch][0] - 0.65, 0.3, P[ch][1]));
  for (const k in P) node[k] = cube(nm(k), k[0] === 'X' ? '#c08a1f' : k === 'E' ? '#5c7a4a' : '#b9a582', [1.25, 0.6, 0.9], P[k][0], 0.3, P[k][1]);
  const CX = 6.1, cont = [];
  tag(kind === 'stack' ? 'stack（top 在上）' : 'queue（front 在前）', 'ptr', CX, kind === 'stack' ? 0 : 1.2, kind === 'stack' ? 3.8 : -0.8);
  const pos = (i) => kind === 'stack' ? [CX, 0.3 + i * 0.6, 2.6] : [CX, 0.3, 0.4 + i * 1.0];
  const place = () => cont.forEach((m, i) => move(m, ...pos(i)));
  const push = (k) => { const m = cube(nm(k), TODO, [1.1, 0.5, 0.8], ...pos(cont.length), 3); m.userData.k = k; cont.push(m); if (k !== 'E') tint(node[k], TODO); };
  const list = () => (kind === 'stack' ? 'stack（底→頂）：' : 'queue（front→rear）：') + (cont.map((m) => nm(m.userData.k)).join(' ') || '空');
  push('E');
  say(kind === 'stack' ? '記事本是 Stack：最後放的最先拿' : '記事本換成 Queue：最早放的最先拿', list());
  await beat(tok, 2200);
  let goal = null;
  while (cont.length) {
    const m = kind === 'stack' ? cont.pop() : cont.shift(), k = m.userData.k;
    fly(m, V3(0, 6, 2)); place();
    tint(node[k], OKC); glow(node[k], GOLD);
    if (kind === 'queue') tag('距離 ' + dep[k], 'idx', P[k][0], 1.0, P[k][1] - 0.7);
    if (k[0] === 'X') { goal = k; break; }
    const kids = kind === 'stack' ? [...KIDS[k]].reverse() : KIDS[k];
    kids.forEach((ch) => { par[ch] = k; dep[ch] = dep[k] + 1; push(ch); });
    const cap = kind === 'stack'
      ? (k === 'E' ? '入口的鄰居放進 stack（A 在最上面）' : '拿出 ' + nm(k) + '，它的鄰居疊上去' + (kids.length ? '' : '（死路）'))
      : (k === 'E' ? '入口的鄰居 A、B、C 排進 queue' : '拿出 ' + nm(k) + '（距離 ' + dep[k] + '），鄰居排到後面');
    say(cap, list());
    await beat(tok, 2000);
    glow(node[k], null);
  }
  const path = []; for (let k = goal; k; k = par[k]) { path.unshift(nm(k)); glow(node[k], GOLD); tint(node[k], '#c08a1f'); }
  say(kind === 'stack' ? 'DFS：一路深入，先找到深處的出口₁' : 'BFS：一層一層往外，先找到最近的出口₂',
    path.join(' → ') + '（' + (path.length - 1) + ' 步）' + (kind === 'stack' ? '，不保證最短' : '，最短'));
  await beat(tok, 3600);
}]);
  }

  // ═══ sqpeng.js ═══
  {
// ─── xqM9NVKUWmg：交大彭文志 Lec07 Stacks & Queues (2/2) ───
// 線性 queue（4 格，A B C D）
const LQX = (i) => (i - 1.5) * 2.1;
function lqSetup(n = 4) {
  for (let i = 0; i < n; i++) { ctx.tile(V3(LQX(i), 0.02, 0)); tag('[' + i + ']', 'idx', LQX(i), 0.1, 1.3); }
  const fl = tag('front = -1', 'ptr', LQX(-1) + 0.6, 0.2, -1.6), rl = tag('rear = -1', 'ptr alt', LQX(-1) + 0.6, 1.9, 0);
  return { fl, rl, put(lbl, name, i, high) { txt(lbl, name + ' = ' + i); lbl.position.set(i < 0 ? LQX(-1) + 0.6 : LQX(i), high ? 1.9 : 0.2, high ? 0 : -1.6); } };
}
FRAG.push(['sqpeng-queue-abcd', 'Queue 回顧：A B C D 與 delete', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const q = lqSetup(4), bs = [];
  say('Queue：從 rear 加入、從 front 刪除', 'FIFO：First In First Out');
  await beat(tok, 2000);
  for (const [i, v] of ['A', 'B', 'C', 'D'].entries()) {
    bs.push(cube(v, '#4b9ee2', [1.3, 0.8, 1.3], LQX(i), 0.45, 0, 6)); q.put(q.rl, 'rear', i, true);
    say('add ' + v + '：放到 rear 指的位置', 'rear = ' + i);
    await beat(tok, 1100);
  }
  say('假設只能放 4 個：已經滿了', 'array[0..3] = A B C D');
  await beat(tok, 2200);
  q.put(q.fl, 'front', 0, false); fly(bs[0], V3(0, 8, 4));
  say('delete：動的是 front，取出 A', 'front = 0（指向第一個元素的前一格）');
  await beat(tok, 2000);
  for (const b of bs.slice(1)) glow(b, GOLD);
  say('B、C、D 不會「掉下來」往前補', '它們仍佔用 array[1]、[2]、[3]，array[0] 空著');
  await beat(tok, 3200);
  say('投影片上往下掉只是示意圖', 'add 動 rear，delete 動 front');
  await beat(tok, 2600);
}]);
FRAG.push(['sqpeng-false-full', '線性 Queue 假滿與 data movement', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const q = lqSetup(4), bs = {};
  ['A', 'B', 'C', 'D'].forEach((v, i) => { bs[v] = cube(v, '#4b9ee2', [1.3, 0.8, 1.3], LQX(i), 0.45, 0); });
  q.put(q.rl, 'rear', 3, true);
  say('MaxSize = 4，A B C D 放滿', 'IsFull：rear == MaxSize − 1 → 3 == 3 → full');
  await beat(tok, 2600);
  q.put(q.fl, 'front', 0, false); fly(bs.A, V3(0, 8, 4));
  say('delete A：front 往後移，array[0] 空出來', 'front = 0，rear 還是 3');
  await beat(tok, 2200);
  const e = cube('E', '#dd8238', [1.3, 0.8, 1.3], LQX(0), 3.2, 0);
  say('想 add E：IsFull 只看 rear', '<span class="no">rear == MaxSize − 1 → 回報 full</span>');
  await beat(tok, 2200);
  glow(e, RED);
  say('明明 array[0] 有空位，卻被判成 full', '這就是「誤判」（假滿）');
  await beat(tok, 2600);
  say('解法一：data movement，B C D 各往前搬一格', 'IsFull 不用改，但要多寫一個搬資料的 procedure');
  ['B', 'C', 'D'].forEach((v, i) => move(bs[v], LQX(i), 0.45, 0));
  q.put(q.fl, 'front', -1, false); q.put(q.rl, 'rear', 2, true);
  await beat(tok, 2200);
  glow(e, null); move(e, LQX(3), 0.45, 0); q.put(q.rl, 'rear', 3, true);
  say('搬完後 E 放得進去', 'front = −1，rear = 3');
  await beat(tok, 2200);
  say('解法二：不搬資料，改寫 IsFull？（老師留的思考題）', '書上的做法：circular queue');
  await beat(tok, 3000);
}]);

// 環狀 queue（6 格，J1…J9）
function cqPos(i, R = 3.4, cx = 0) { const a = Math.PI / 2 - (i / 6) * Math.PI * 2; return V3(cx + Math.cos(a) * R, 0.45, -Math.sin(a) * R); }
function cqSetup(R = 3.4, cx = 0) {
  for (let i = 0; i < 6; i++) { const p = cqPos(i, R, cx); ctx.tile(V3(p.x, 0.02, p.z), 1.4, 1.4); const ip = cqPos(i, R * 1.38, cx); tag('[' + i + ']', 'idx', ip.x, 0.1, ip.z); }
  const fl = tag('front', 'ptr', 0, 0.2, 0), rl = tag('rear', 'ptr alt', 0, 0.2, 0);
  const st = { f: 0, r: 0, slots: [] };
  st.show = () => {
    const pf = cqPos(st.f, R * 0.55, cx), pr = cqPos(st.r, R * 0.55, cx);
    txt(fl, 'front = ' + st.f); txt(rl, 'rear = ' + st.r);
    fl.position.set(pf.x, 0.3, pf.z + (st.f === st.r ? -0.35 : 0)); rl.position.set(pr.x, 1.6, pr.z + (st.f === st.r ? 0.35 : 0));
  };
  st.add = (v) => { st.r = (st.r + 1) % 6; const p = cqPos(st.r, R, cx); st.slots[st.r] = cube(v, '#9b7ef4', [1.1, 0.7, 1.1], p.x, 0.4, p.z, 5); st.show(); };
  st.del = () => { st.f = (st.f + 1) % 6; const b = st.slots[st.f]; st.slots[st.f] = null; if (b) fly(b, V3(0, 8, 4)); st.show(); };
  st.show();
  return st;
}
FRAG.push(['sqpeng-cq-j', 'Circular Queue：J1–J9 與留一格', async (tok) => {
  fresh([0, 12, 9.5], [0, 0, 0.3]);
  const q = cqSetup();
  say('環狀只是示意：其實是 6 格連續 array', 'empty：front == rear（一開始 front = rear = 0）');
  await beat(tok, 2600);
  for (const v of ['J1', 'J2', 'J3']) { q.add(v); say('add ' + v, 'rear = ' + q.r); await beat(tok, 900); }
  say('front 指向第一個元素的「前一格」', 'front = 0，rear = 3');
  await beat(tok, 2200);
  for (const v of ['J4', 'J5']) { q.add(v); say('add ' + v, 'rear = ' + q.r); await beat(tok, 900); }
  say('front = 0、rear = 5：已經 full', '還有一格空著，為什麼不塞？');
  await beat(tok, 2400);
  const p0 = cqPos(0), g = cube('J6', '#d64545', [1.1, 0.7, 1.1], p0.x, 2.4, p0.z);
  say('硬塞 J6：rear 繞回 0 == front', '<span class="no">front == rear：分不出是空還是滿</span>');
  await beat(tok, 2600);
  fly(g, V3(0, 8, -3));
  say('所以 6 格只放 5 個：故意保留一格', 'full：(rear + 1) % MaxSize == front');
  await beat(tok, 2400);
  for (let k = 0; k < 4; k++) { q.del(); say('delete J' + (k + 1), 'front = ' + q.f); await beat(tok, 750); }
  for (const v of ['J6', 'J7', 'J8', 'J9']) { q.add(v); say('add ' + v + '：rear 繞圈', 'rear = ' + q.r); await beat(tok, 850); }
  say('front = 4、rear = 3：同樣留一格的 full', '(3 + 1) % 6 = 4 == front → <span class="ok">full</span>');
  await beat(tok, 3200);
}]);
FRAG.push(['sqpeng-cq-code', 'Circular Queue 的 Add / Delete', async (tok) => {
  fresh([0, 10, 11], [0, 1.2, 0.3]);
  const cd = code(['void Queue::Add(const KeyType& x) {', '  int newRear = (rear + 1) % MaxSize;', '  if (front == newRear) QueueFull();', '  else queue[rear = newRear] = x;', '}',
    'KeyType* Queue::Delete(KeyType& x) {', '  if (front == rear) { QueueEmpty(); return 0; }', '  front = (front + 1) % MaxSize;', '  x = queue[front]; return &x;', '}'], -3.4, 5.6, 0.55);
  const q = cqSetup(2.2, 3.3);
  q.add('J1'); q.add('J2');
  say('投影片的 Add 漏了參數：自己補上 x', 'Add(const KeyType& x)');
  await beat(tok, 2600);
  async function add(v) {
    const nr = (q.r + 1) % 6;
    cd.hl(1); say('Add(' + v + ')：先算 newRear', 'newRear = (' + q.r + ' + 1) % 6 = ' + nr); await beat(tok, 1500);
    cd.hl(2);
    if (nr === q.f) { say('front == newRear → QueueFull', '<span class="no">' + q.f + ' == ' + nr + '：滿了，不放</span>'); await beat(tok, 2200); return; }
    say('front ≠ newRear：還沒滿', q.f + ' ≠ ' + nr); await beat(tok, 1100);
    cd.hl(3); q.add(v); say('rear = newRear，queue[rear] = x', 'queue[' + q.r + '] = ' + v); await beat(tok, 1400);
  }
  async function del() {
    cd.hl(6); say('Delete：先檢查 front == rear', q.f + ' ≠ ' + q.r + '：不是 empty'); await beat(tok, 1400);
    const nf = (q.f + 1) % 6;
    cd.hl(7); say('front 指的是空格：先往前移一格', 'front = (' + q.f + ' + 1) % 6 = ' + nf); await beat(tok, 1400);
    cd.hl(8); const v = q.slots[nf] && q.slots[nf].userData.lbl.element.textContent; q.del(); say('再取 queue[front]', 'x = queue[' + nf + '] = ' + v); await beat(tok, 1500);
  }
  await add('J3');
  await del();
  q.add('J4'); q.add('J5'); cd.hl(-1);
  say('再加入 J4、J5', 'front = ' + q.f + '，rear = ' + q.r); await beat(tok, 1500);
  await add('J6');
  say('% MaxSize 讓 rear 從 5 繞回 0', '空間可以重複利用，不會誤判 full'); await beat(tok, 1800);
  await add('J7');
  cd.hl(-1);
  say('一直在環上轉：充分利用 queue 空間', 'full：(rear+1)%MaxSize == front；empty：front == rear');
  await beat(tok, 3000);
}]);

// 迷宮（示意用的 5×5 迷宮；外圍包一圈 1 變成 7×7）
const MZ5 = ['01101', '00100', '10011', '00101', '00110'];
const MZB = [Array(7).fill(1), ...MZ5.map((r) => [1, ...r.split('').map(Number), 1]), Array(7).fill(1)];
const DIRN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const MOVE = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
function mzEvents(start) {
  const mark = MZB.map((r) => r.map(() => 0)); mark[1][1] = 1;
  const st = [[1, 1, start]], ev = [{ t: 'init' }];
  while (st.length) {
    let [i, j, d] = st.pop(); ev.push({ t: 'pop', i, j, d: d % 8 });
    while (d < start + 8) {
      const [a, b] = MOVE[d % 8], g = i + a, h = j + b;
      if (g === 5 && h === 5) { ev.push({ t: 'exit', i, j, g, h, d: d % 8, path: [...st.map((s) => [s[0], s[1]]), [i, j], [g, h]] }); return ev; }
      const ok = !MZB[g][h] && !mark[g][h];
      ev.push({ t: 'try', i, j, g, h, d: d % 8, ok, wall: !!MZB[g][h] });
      if (ok) { mark[g][h] = 1; st.push([i, j, d + 1]); ev.push({ t: 'push', i, j, d: (d + 1) % 8, g, h }); i = g; j = h; d = start; } else d++;
    }
  }
  return ev;
}
function mzBoard(cx, cz, S, withBorder) {
  const pos = (r, c) => V3(cx + (c - 3) * S, 0, cz + (r - 3) * S);
  const tiles = {};
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const border = r === 0 || c === 0 || r === 6 || c === 6;
    if (border && !withBorder) continue;
    const p = pos(r, c);
    if (MZB[r][c]) { const w = lab.box(border ? '#c46a5a' : '#8a7a62', [S * 0.94, 0.55, S * 0.94]); w.position.set(p.x, 0.27, p.z); lab.world.add(w); tiles[r + ',' + c] = w; }
    else { const t = new THREE.Mesh(new THREE.BoxGeometry(S * 0.94, 0.08, S * 0.94), new THREE.MeshStandardMaterial({ color: '#f3ead9' })); t.position.set(p.x, 0.04, p.z); lab.world.add(t); tiles[r + ',' + c] = t; }
  }
  return { pos, tiles, paint(r, c, col) { const t = tiles[r + ',' + c]; if (t) t.material.color.set(col); } };
}
async function mzRun(tok, opt) {
  const S = opt.S || 0.95, B = mzBoard(opt.cx, 0, S, true);
  const ent = B.pos(1, 1), ex = B.pos(5, 5);
  tag('入口 (1,1)', 'ptr', ent.x, 0.9, ent.z - 0.5); tag('出口 (m,p)', 'ptr alt', ex.x, 0.9, ex.z + 0.5);
  const mouse = cube('', '#e55a9b', [S * 0.5, S * 0.5, S * 0.5], ent.x, 0.45, ent.z);
  const stk = [], sx = opt.sx;
  if (sx !== undefined) tag('stack (i, j, dir)', 'idx', sx, 0, 1.4);
  const cnt = tag('', 'idx', opt.cx, 0, 4.2);
  let tries = 0, first = true;
  const cd = opt.code;
  B.paint(1, 1, '#f2c46d');
  for (const e of mzEvents(opt.start || 0)) {
    if (e.t === 'init') { if (cd) cd.hl(0); if (sx !== undefined) stk.push(cube('(1,1,' + DIRN[opt.start || 0] + ')', '#4b9ee2', [2.0, 0.5, 1.0], sx, 0.3, 0, 3)); say(opt.cap || '初始化：入口 (1,1) 和起始方向 push 進 stack', 'mark[1][1] = 1'); await beat(tok, opt.slow ? 2000 : 900); continue; }
    if (e.t === 'pop') { if (cd) cd.hl(2); const p = B.pos(e.i, e.j); move(mouse, p.x, 0.45, p.z); if (stk.length) fly(stk.pop(), V3(3, 7, 2)); say(!first ? '走不下去：pop，退回上一步 (' + e.i + ',' + e.j + ')' : 'stack 不空：pop 出 (i, j, dir)', '從 dir = ' + DIRN[e.d] + ' 繼續試'); first = false; await beat(tok, opt.slow ? 1800 : 1000); continue; }
    if (e.t === 'try') {
      tries++; txt(cnt, '試了 ' + tries + ' 個方向');
      if (cd) cd.hl(6);
      const t = B.tiles[e.g + ',' + e.h]; if (t) glow(t, e.ok ? GREEN : RED);
      if (opt.slow || e.ok) say('在 (' + e.i + ',' + e.j + ') 試 ' + DIRN[e.d] + ' → (' + e.g + ',' + e.h + ')', e.wall ? 'maze[g][h] = 1：牆' : e.ok ? 'maze = 0 且 mark = 0：可以走' : 'mark[g][h] = 1：走過了');
      await beat(tok, opt.fast || 260); if (t) glow(t, null); continue;
    }
    if (e.t === 'push') {
      if (cd) cd.hl(7);
      if (sx !== undefined) stk.push(cube('(' + e.i + ',' + e.j + ',' + DIRN[e.d] + ')', '#4b9ee2', [2.0, 0.5, 1.0], sx, 0.3 + stk.length * 0.55, 0, 3));
      const p = B.pos(e.g, e.h); move(mouse, p.x, 0.45, p.z); B.paint(e.g, e.h, '#cfe8dc');
      say('前進到 (' + e.g + ',' + e.h + ')，舊位置 push', 'mark[' + e.g + '][' + e.h + '] = 1；push (' + e.i + ',' + e.j + ',' + DIRN[e.d] + ')；d 歸零');
      await beat(tok, opt.slow ? 1600 : 800); continue;
    }
    if (e.t === 'exit') {
      if (cd) cd.hl(5);
      move(mouse, ex.x, 0.45, ex.z);
      for (const [r, c] of e.path) B.paint(r, c, '#c08a1f');
      say('(g, h) == (m, p)：走到出口', '路徑 = stack 內容 + (i, j) + (m, p)；共試 ' + tries + ' 個方向');
      await beat(tok, 3000);
      return tries;
    }
  }
  return tries;
}
FRAG.push(['sqpeng-maze-intro', '迷宮：八個方向與退回', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.6]);
  say('迷宮用 2D array：0 可以走，1 是牆', '從入口找一條通到出口的 path');
  await beat(tok, 2200);
  await mzRun(tok, { cx: -2.2, sx: 3.6, fast: 220, cap: '每一步記在 stack：走不通就往回退一步' });
  say('走不下去就 backtrack：回到上一步', '記錄走過的路、往回走 → 用 stack（LIFO）');
  await beat(tok, 2600);
  say('找到的 path 不一定最短，也可能不只一條', '看程式怎麼設計');
  await beat(tok, 2600);
}]);
FRAG.push(['sqpeng-move-offset', 'move[8] offset 與 (i, j, dir)', async (tok) => {
  fresh([0, 10, 10], [0, 0.5, 0.5]);
  const S = 1.6, cx = -3.2;
  const cells = {};
  for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
    const m = lab.box(r || c ? '#f3ead9' : '#e55a9b', [S * 0.92, r || c ? 0.1 : 0.5, S * 0.92]); m.position.set(cx + c * S, r || c ? 0.05 : 0.25, r * S); lab.world.add(m); cells[r + ',' + c] = m;
  }
  tag('X (row, col)', 'ptr', cx, 0.9, 0);
  const rows = MOVE.map(([a, b], d) => tag('move[' + d + ']  ' + DIRN[d].padEnd(2, ' ') + '  (' + (a < 0 ? '' : '+') + a + ', ' + (b < 0 ? '' : '+') + b + ')', 'idx', 3.4, 0, -2.6 + d * 0.62));
  rows.forEach((l) => Object.assign(l.element.style, MONO));
  say('目前在 (row, col)：八個方向都可以試', 'N、NE、E、SE、S、SW、W、NW');
  await beat(tok, 2400);
  for (let d = 0; d < 8; d++) {
    const [a, b] = MOVE[d];
    rows.forEach((l, k) => { l.element.className = 'lab-label ' + (k === d ? 'ptr alt' : 'idx'); });
    glow(cells[a + ',' + b], GOLD);
    tag(DIRN[d], 'idx', cx + b * S, 0.3, a * S);
    say(DIRN[d] + '：(row ' + (a < 0 ? '−1' : a > 0 ? '+1' : '') + ', col ' + (b < 0 ? '−1' : b > 0 ? '+1' : '') + ')', 'move[' + d + '] = (vert ' + a + ', horiz ' + b + ')，順時針編號');
    await beat(tok, d < 2 ? 1700 : 900);
    glow(cells[a + ',' + b], null);
  }
  say('下一步：只要加上 offset', 'g = i + move[dir].vert，h = j + move[dir].horiz');
  await beat(tok, 2600);
  rows.forEach((l) => { l.element.className = 'lab-label idx'; });
  glow(cells['-1,0'], RED); glow(cells['-1,1'], RED);
  say('stack 每格存 (row, col, dir)', '例：N、NE 都試過走不通……');
  await beat(tok, 2200);
  glow(cells['0,1'], GREEN);
  const s = cube('(row, col, dir = 2)', '#4b9ee2', [3.2, 0.5, 1.0], cx, 0.3, 2.8, 3);
  say('退回這格時從 E（dir = 2）接著試', '記 dir：不要重試已經失敗的方向');
  await beat(tok, 3200);
  kill(s);
}]);
FRAG.push(['sqpeng-maze-code', '迷宮演算法：maze、mark、stack', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.5, 0.4]);
  const cd = code(['mark[1][1]=1; stack.push(1,1,N);', 'while (!stack.IsEmpty()) {', '  (i,j,d) = stack.pop();', '  while (d < 8) {', '    g = i+move[d].a; h = j+move[d].b;', '    if (g==m && h==p) success;',
    '    if (!maze[g][h] && !mark[g][h]) {', '      mark[g][h]=1; push(i,j,d+1);', '      i=g; j=h; d=0; }', '    else d++; } }'], 4.3, 6.2, 0.5);
  await mzRun(tok, { cx: -3.6, sx: 0.6, code: cd, fast: 320, slow: false });
  cd.hl(-1);
  say('三個結構：maze（地圖）、mark（走過沒）、stack（路徑）', 'mark 和 maze 一樣大；move 用來算下一步');
  await beat(tok, 3200);
}]);
FRAG.push(['sqpeng-maze-order', '試方向的順序：先北 vs 先東', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.6]);
  say('出口在右下：每次先試北邊很浪費', '試的方向順序可以自己定');
  await beat(tok, 2200);
  const a = await mzRun(tok, { cx: -2.2, sx: 3.6, start: 0, fast: 140, cap: '規則一：從 N 開始順時針' });
  lab.clear();
  const b = await mzRun(tok, { cx: -2.2, sx: 3.6, start: 2, fast: 300, cap: '規則二：從 E 開始順時針' });
  say('先 N：試 ' + a + ' 次；先 E：試 ' + b + ' 次', '改 move 的編號或 offset 就能換順序');
  await beat(tok, 3000);
  say('逆時針也可以，但可能多走冤枉路', '延伸考題：多個出口、不在右下時怎麼找最近的？');
  await beat(tok, 3000);
}]);
FRAG.push(['sqpeng-maze-border', '外圍包一圈 1：(m+2)×(p+2)', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.4]);
  const S = 1.0, B = mzBoard(0, 0, S, false);
  const t0 = [];
  for (let k = 0; k < 5; k++) { t0.push(tag(String(k), 'idx', B.pos(k + 1, 0).x + 0.35, 0.1, B.pos(k + 1, 0).z)); t0.push(tag(String(k), 'idx', B.pos(0, k + 1).x, 0.1, B.pos(0, k + 1).z + 0.35)); }
  const en = tag('入口 (0,0)', 'ptr', B.pos(1, 1).x, 0.8, B.pos(1, 1).z);
  say('原本的迷宮 m × p：入口 (0,0)', '在邊界上要判斷「哪一邊是邊界」，程式又臭又長');
  await beat(tok, 3000);
  say('外面再包一圈 1（牆）', 'array 變成 (m+2) × (p+2)');
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    if (!(r === 0 || c === 0 || r === 6 || c === 6)) continue;
    const p = B.pos(r, c); cube('1', '#c46a5a', [S * 0.94, 0.55, S * 0.94], p.x, 0.27, p.z, 3);
    await beat(tok, 70);
  }
  t0.forEach((l, k) => txt(l, String(Math.floor(k / 2) + 1)));
  txt(en, '入口 (1,1)'); en.position.set(B.pos(1, 1).x, 0.8, B.pos(1, 1).z);
  tag('出口 (m,p)', 'ptr alt', B.pos(5, 5).x, 0.8, B.pos(5, 5).z);
  say('入口變 (1,1)，出口是 (m, p)', '索引整體 +1');
  await beat(tok, 2600);
  const p11 = B.pos(1, 1);
  const mouse = cube('', '#e55a9b', [0.5, 0.5, 0.5], p11.x, 0.45, p11.z);
  for (let d = 0; d < 3; d++) {
    const [a, b] = MOVE[d], q = B.pos(1 + a, 1 + b);
    const m = cube('', d < 2 ? '#d64545' : '#2fc092', [0.3, 0.3, 0.3], q.x, 0.9, q.z);
    say('在邊界也照樣試 ' + DIRN[d], d < 2 ? 'maze = 1：外圍的牆，走不通' : 'maze = 0：可以走');
    await beat(tok, 1500); kill(m);
  }
  kill(mouse);
  say('不用為邊界另外寫判斷：八個方向同一段程式', '代價：多兩列兩行的空間');
  await beat(tok, 3000);
}]);

// Postfix
FRAG.push(['sqpeng-infix-ambig', 'Infix 的歧義與 Postfix', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const ex = tag('X = A / B − C + D * E − A * C', 'ptr', 0, 6.2); Object.assign(ex.element.style, { fontSize: '15px' });
  tag('A = 4，B = C = 2，D = E = 3', 'idx', 0, 5.4);
  say('X 是多少？要看括號怎麼加', 'A/B−C+D*E−A*C');
  await beat(tok, 2600);
  const l1 = tag('((4/2) − 2) + (3*3) − (4*2) = 1', '', -3.2, 3.6); Object.assign(l1.element.style, MONO);
  cube('1', '#2fc092', [1.4, 1.4, 1.4], -3.2, 0.7, 0, 4);
  say('先乘除後加減的括號：X = 1', '((4/2) − 2) + (3*3) − (4*2)');
  await beat(tok, 2600);
  const l2 = tag('((4/(2−2+3)) * (3−4)) * 2 = −2.666…', '', 3.2, 3.6); Object.assign(l2.element.style, MONO);
  cube('−2.67', '#d64545', [1.4, 1.4, 1.4], 3.2, 0.7, 0, 4);
  say('換一種括號：X = −2.666…', '同一串符號，不同結果 → 要規定 priority');
  await beat(tok, 3000);
  kill(l1); kill(l2);
  for (const o of [...lab.bodies]) fly(o.obj, V3(0, 8, 3));
  await beat(tok, 700);
  say('Postfix：operator 寫在運算元後面、沒有括號', '2 + 3 * 4  →  2 3 4 * +');
  ['2', '3', '4', '*', '+'].forEach((t, k) => cube(t, /\d/.test(t) ? '#4b9ee2' : '#c08a1f', [1.1, 0.9, 1.1], -3 + k * 1.5, 0.45, 0, 3 + k));
  await beat(tok, 2800);
  say('infix 先轉成 postfix，電腦再很快算出值', 'infix → postfix → evaluate');
  await beat(tok, 2800);
}]);
FRAG.push(['sqpeng-eval-code', 'Eval(e)：三格的 operand stack', async (tok) => {
  fresh([0, 6, 13], [0, 2.6, 0]);
  const cd = code(['void Eval(Expression e) {', '  Stack<Token> stack;', '  for (x = NextToken(e); x != \'#\'; x = NextToken(e))', '    if (x is an operand) stack.Add(x);', '    else { pop 兩個運算元; 算 x; 結果 Add 回 stack; }', '  // 讀到 #：stack 剩下的就是答案', '}'], 2.6, 6.2, 0.55);
  for (let k = 0; k < 3; k++) { const g = ghostBox('#c9b48e', 1.8, 0.8, 1.4); g.position.set(-4, 0.45 + k * 0.9, 0); tag('[' + k + ']', 'idx', -5.4, 0.45 + k * 0.9); }
  const topL = tag('top = −1', 'ptr', -2.2, 0.3);
  const toks = ['6', '2', '/', '3', '-', '4', '2', '*', '+', '#'];
  const tl = toks.map((t, k) => tag(t, 'idx', -5.2 + k * 0.85, 4.6)); tl.forEach((l) => Object.assign(l.element.style, { fontSize: '15px' }));
  const st = [];
  const setTop = () => { txt(topL, 'top = ' + (st.length - 1)); topL.position.set(-2.2, st.length ? 0.45 + (st.length - 1) * 0.9 : 0.3, 0); };
  say('輸入 postfix 字串，# 代表結尾', 'e = 6 2 / 3 − 4 2 * + #');
  await beat(tok, 2600);
  for (const [k, t] of toks.entries()) {
    tl.forEach((l, i) => { l.element.className = 'lab-label ' + (i === k ? 'ptr alt' : 'idx'); });
    if (t === '#') { cd.hl(5); say('讀到 #：結束', '答案 = stack 裡剩下的 <span class="ok">' + st[0].v + '</span>'); glow(st[0].m, GOLD); await beat(tok, 3000); break; }
    if (/\d/.test(t)) { cd.hl(3); const m = cube(t, '#4b9ee2', [1.6, 0.75, 1.3], -4, 0.45 + st.length * 0.9, 0, 4); st.push({ m, v: Number(t) }); setTop(); say('運算元 ' + t + '：push', 'top = ' + (st.length - 1)); await beat(tok, 1300); continue; }
    cd.hl(4);
    const b = st.pop(), a = st.pop(); fly(b.m, V3(3, 7, 2)); fly(a.m, V3(-3, 7, 2));
    const r = t === '+' ? a.v + b.v : t === '-' ? a.v - b.v : t === '*' ? a.v * b.v : a.v / b.v;
    const sym = t === '-' ? '−' : t;
    say('operator ' + sym + '：pop 兩次，算完 push 回去', a.v + ' ' + sym + ' ' + b.v + ' = ' + r + '（先 pop 的 ' + b.v + ' 是右運算元）');
    await beat(tok, 900);
    const m = cube(String(r), '#2fc092', [1.6, 0.75, 1.3], -4, 0.45 + st.length * 0.9, 0, 4); st.push({ m, v: r }); setTop();
    await beat(tok, 1300);
  }
  cd.hl(-1);
  say('這個例子 stack 最多只用到 3 格', 'input：postfix 字串；output：式子的值');
  await beat(tok, 2600);
}]);
FRAG.push(['sqpeng-paren-2pass', '手動法：加括號、operator 取代右括號', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const T = { op: '-', L: { op: '+', L: { op: '-', L: { op: '/', L: 'A', R: 'B' }, R: 'C' }, R: { op: '*', L: 'D', R: 'E' } }, R: { op: '*', L: 'A', R: 'C' } };
  const ops = []; (function walk(n) { if (typeof n === 'string') return; walk(n.L); ops.push(n); walk(n.R); })(T);
  const moved = new Set();
  const show = (n) => typeof n === 'string' ? n : '(' + show(n.L) + (moved.has(n) ? '' : n.op) + show(n.R) + (moved.has(n) ? n.op : ')');
  const big = tag('A/B-C+D*E-A*C', '', 0, 4.8); Object.assign(big.element.style, MONO, { fontSize: '17px' });
  say('Infix：A/B − C + D*E − A*C', '手動轉 postfix：兩個 pass');
  await beat(tok, 2400);
  txt(big, show(T));
  say('Pass 1：依先乘除後加減，全部加上括號', show(T));
  await beat(tok, 3000);
  for (const n of ops) {
    moved.add(n); txt(big, show(T));
    say('Pass 2：' + n.op + ' 移去取代它對應的右括號', '左括號先不用理');
    await beat(tok, 1500);
  }
  txt(big, show(T).replace(/\(/g, ''));
  say('最後刪掉所有括號', '<span class="ok">AB/C−DE*+AC*−</span>');
  await beat(tok, 2800);
  say('缺點：要 scan 兩次（2 pass）', '下一步：用 stack 只 scan 一次');
  await beat(tok, 2600);
}]);
// 老師的 priority table：數字越小 priority 越高；左括號 ISP = 8、ICP = 0
const ISP = { '*': 2, '/': 2, '%': 2, '+': 3, '-': 3, '(': 8 }, ICP = { '*': 2, '/': 2, '%': 2, '+': 3, '-': 3, '(': 0 };
FRAG.push(['sqpeng-ispicp', 'ISP / ICP：stack 一次 scan 轉 postfix', async (tok) => {
  fresh([0, 6, 13], [0, 2.8, 0]);
  const expr = (ctx.params || {}).expr || 'A+B*C';
  const raw = expr.split('');
  const seen = {}, cntOp = {}; raw.forEach((t) => { if ('*/+-'.includes(t)) cntOp[t] = (cntOp[t] || 0) + 1; });
  const toks = raw.map((t) => { if ('*/+-'.includes(t) && cntOp[t] > 1) { seen[t] = (seen[t] || 0) + 1; return { t, n: t + '₁₂₃'[seen[t] - 1] }; } return { t, n: t }; });
  toks.push({ t: '#', n: '#' });
  const tl = toks.map((o, k) => tag(o.n, 'idx', -2.4 + (k - (toks.length - 1) / 2) * 0.9, 5.6)); tl.forEach((l) => Object.assign(l.element.style, { fontSize: '16px' }));
  const outL = tag('output：', 'ptr alt', 2.8, 4.2); Object.assign(outL.element.style, { fontSize: '14px' });
  tag('operator stack', 'idx', -4.2, 0, 1.3);
  const tbl = tag('ISP：* / = 2，+ − = 3，( = 8　ICP：( = 0', 'idx', 2.8, 0.2, 1.6);
  const st = [], out = [];
  const pos = (k) => V3(-4.2, 0.45 + k * 0.9, 0);
  say('Infix：' + expr + '　由左往右只 scan 一次', '數字越小 priority 越高；ISP(y) ≤ ICP(x) 就 pop y');
  await beat(tok, 2800);
  for (const [k, o] of toks.entries()) {
    tl.forEach((l, i) => { l.element.className = 'lab-label ' + (i === k ? 'ptr alt' : 'idx'); });
    if (/[A-Z]/.test(o.t)) { out.push(o.n); txt(outL, 'output：' + out.join(' ')); say('讀到 ' + o.n + '：運算元直接 output', ''); await beat(tok, 1300); continue; }
    if (o.t === ')') {
      while (st.length && st[st.length - 1].t !== '(') { const y = st.pop(); fly(y.m, V3(4, 6, 1)); out.push(y.n); txt(outL, 'output：' + out.join(' ')); say('讀到 )：pop 到左括號為止', 'pop ' + y.n + ' → output'); await beat(tok, 1400); }
      const lp = st.pop(); if (lp) fly(lp.m, V3(-3, 6, 1)); say('左括號 pop 掉、不 output', '括號不會出現在 postfix'); await beat(tok, 1400); continue;
    }
    if (o.t === '#') {
      while (st.length) { const y = st.pop(); fly(y.m, V3(4, 6, 1)); out.push(y.n); txt(outL, 'output：' + out.join(' ')); say('讀到 #（結尾）：stack 剩下的全部 pop', 'pop ' + y.n); await beat(tok, 1200); }
      say('Postfix = ' + out.join(''), '<span class="ok">' + out.join(' ') + '</span>'); await beat(tok, 3000); break;
    }
    while (st.length && ISP[st[st.length - 1].t] <= ICP[o.t]) {
      const y = st[st.length - 1]; glow(y.m, GOLD);
      say('ISP(' + y.n + ') = ' + ISP[y.t] + ' ≤ ICP(' + o.n + ') = ' + ICP[o.t], '成立 → pop ' + y.n + ' 並 output'); await beat(tok, 1800);
      st.pop(); fly(y.m, V3(4, 6, 1)); out.push(y.n); txt(outL, 'output：' + out.join(' ')); await beat(tok, 600);
    }
    if (st.length) { const y = st[st.length - 1]; say('ISP(' + y.n + ') = ' + ISP[y.t] + ' ≤ ICP(' + o.n + ') = ' + ICP[o.t] + '？不成立', 'push ' + o.n); }
    else say(o.t === '(' ? '左括號：ICP = 0，一定 push' : 'stack 是空的：push ' + o.n, '');
    const m = cube(o.n, o.t === '(' ? '#9b7ef4' : '#c08a1f', [1.8, 0.8, 1.3], pos(st.length).x, pos(st.length).y, 0, 5); st.push({ t: o.t, n: o.n, m });
    await beat(tok, 1700);
  }
}]);
FRAG.push(['sqpeng-prio-table', 'Priority table：數字越小越優先', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.6, 0]);
  const rows = [['1', '單元 −、!'], ['2', '*  /  %'], ['3', '+  −'], ['4', '<  <=  >=  >'], ['5', '==  !='], ['6', '&&'], ['7', '||'], ['8', '( 在 stack 內（ISP）、#']];
  const bars = rows.map(([p, ops], k) => {
    const h = 0.4 + (8 - k) * 0.55;
    const m = cube(p, k === 7 ? '#9b7ef4' : '#4b9ee2', [1.0, h, 1.0], -5.6 + k * 1.6, h / 2, 0);
    const l = tag(ops, 'idx', -5.6 + k * 1.6, 0, 1.2); return m;
  });
  say('Priority table：priority 1 最高', '柱子越高 = 越優先，但數字越小');
  await beat(tok, 3000);
  glow(bars[1], GOLD); glow(bars[2], GOLD);
  say('* / % 是 2、+ − 是 3：先乘除後加減', 'higher priority ＝ 數字比較小，不是比較 large');
  await beat(tok, 3000);
  glow(bars[1], null); glow(bars[2], null); glow(bars[7], GOLD);
  say('左括號在 stack 內 ISP = 8（最低）', '進了 stack 不會擋住別的 operator');
  await beat(tok, 2800);
  const icp = cube('ICP( = 0', '#d64545', [1.6, 4.8, 1.0], 6.2, 2.4, 0, 3);
  say('左括號剛讀到時 ICP = 0（最高）', '所以讀到 ( 一定 push');
  await beat(tok, 2800);
  glow(bars[7], null);
  say('規則：stack 頂端 y、讀到 x', 'ISP(y) ≤ ICP(x) → pop y；否則 push x');
  await beat(tok, 3200);
  kill(icp);
}]);
FRAG.push(['sqpeng-multistack', 'Multiple stacks 與 Stack ≠ Array', async (tok) => {
  fresh([0, 7, 13], [0, 0.8, 0]);
  const N = 10, X = (i) => (i - 4.5) * 1.25;
  for (let i = 0; i < N; i++) { ctx.tile(V3(X(i), 0.02, 0), 1.15, 1.3); tag('[' + i + ']', 'idx', X(i), 0.1, 1.1); }
  const t1 = tag('top1 = −1', 'ptr', X(0), 1.8), t2 = tag('top2 = 10', 'ptr alt', X(9), 1.8);
  say('一個 array 放兩個 stack', 'stack 1 從頭往後長，stack 2 從尾往前長');
  await beat(tok, 2400);
  const all = [];
  for (let k = 0; k < 5; k++) {
    all.push(cube('a' + (k + 1), '#4b9ee2', [1.0, 0.7, 1.0], X(k), 0.4, 0, 5)); txt(t1, 'top1 = ' + k); t1.position.set(X(k), 1.8, 0);
    await beat(tok, 500);
    if (k < 4) { all.push(cube('b' + (k + 1), '#dd8238', [1.0, 0.7, 1.0], X(9 - k), 0.4, 0, 5)); txt(t2, 'top2 = ' + (9 - k)); t2.position.set(X(9 - k), 1.8, 0); }
    await beat(tok, 500);
  }
  all.push(cube('b5', '#dd8238', [1.0, 0.7, 1.0], X(5), 0.4, 0, 5)); txt(t2, 'top2 = 5'); t2.position.set(X(5), 1.8, 0);
  say('兩個 top 碰在一起才算滿', 'top1 + 1 == top2 → full，空間共用');
  await beat(tok, 2600);
  all.forEach((m) => fly(m, V3(0, 8, 3))); kill(t1); kill(t2);
  await beat(tok, 800);
  say('n 個 stack：先決定大小，切成 n 等份', '例：n = 3，每個 stack 各管一段');
  [[0, 3, '#4b9ee2'], [3, 6, '#dd8238'], [6, 10, '#9b7ef4']].forEach(([a, b, c], s) => {
    const g = ghostBox(c, X(b - 1) - X(a) + 1.15, 0.6, 1.3); g.position.set((X(a) + X(b - 1)) / 2, 0.35, 0);
    tag('stack ' + (s + 1), 'ptr', (X(a) + X(b - 1)) / 2, 1.5);
  });
  await beat(tok, 3000);
  say('Stack ≠ Array', 'array：(index, value) pair 的集合；stack：有限集合 + LIFO 規則（ADT）');
  await beat(tok, 3400);
  say('array 只是實作 stack 的一種方式', '一個 array 可以放多個 stack');
  await beat(tok, 2600);
}]);
  }

  // ═══ stklin.js ═══
  {
  // ─── -1FYYVpgyUo：林軒田 DSA（Analysis Tools 的 asymptotic notation ＋ Stack 入門） ───
  const B_ = '#4b9ee2', O_ = '#dd8238', R_ = '#d64545', G_ = '#2fc092', Y_ = '#c08a1f';
  function bar(color, w, d, x, z = 0) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
  function growBar(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = Math.max(0.001, h0 + (h - h0) * t); m.scale.y = v; m.position.y = v / 2; }); }
  function axes(ox, oy, w, h, xl, yl) {
    line(ox, oy, ox + w, oy, 0, '#6e5f49'); line(ox, oy, ox, oy + h, 0, '#6e5f49');
    if (xl) tag(xl, 'idx', ox + w + 0.4, oy); if (yl) tag(yl, 'idx', ox, oy + h + 0.35);
  }
  // a curve y = fn(n) for n in [a, b], drawn through map(n, v) → Vector3; starts hidden, reveal() draws it
  function plot(fn, a, b, map, color, steps = 90) {
    const pts = []; for (let k = 0; k <= steps; k++) { const n = a + (b - a) * k / steps; pts.push(map(n, fn(n))); }
    const g = new THREE.BufferGeometry().setFromPoints(pts); g.setDrawRange(0, 0);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color })); l.userData.count = pts.length; lab.world.add(l); return l;
  }
  const reveal = (tok, l, ms) => anim(tok, ms, (t) => l.geometry.setDrawRange(0, Math.ceil(t * l.userData.count)));
  const tagV = (text, cls, v, dx = 0, dy = 0) => tag(text, cls, v.x + dx, v.y + dy, v.z);
  const dot = (v, color, s = 0.2) => cube('', color, [s, s, s], v.x, v.y, v.z);
  const hl = (ox, w, y, color) => line(ox, y, ox + w, y, 0, color);

  // 23:14 為什麼只要「大概」
  FRAG.push(['stklin-why-approx', '只要「大概」：常數不重要', async (tok) => {
    fresh([0, 5, 14], [0, 2.6, 0]);
    const q = tag('n 個 int：4 bytes 還是 8 bytes？看平台', 'ptr', 0, 6.2);
    say('可以一個 byte、一個指令去算', '但不需要 exact，只要「大概」');
    await beat(tok, 2800);
    txt(q, '2n 個指令：2 秒、20 秒還是 30 秒？看架構');
    say('這些細節跟平台、架構有關', '只在乎：要 n 個指令，還是 n² 個？');
    await beat(tok, 3000);
    kill(q);
    tag('固定成本', 'ptr alt', -4.6, 0, 1.6);
    const fx = bar(Y_, 1.3, 1.3, -4.6);
    await growBar(tok, fx, 1.6, 500);
    tag('1 秒', 'idx', -4.6, 2.1);
    tag('跟資料量一起長的部分（高度為 log 尺度）', 'ptr', 1.6, 0, 2.6);
    const N = [100, 1000, 10000];
    for (let k = 0; k < 3; k++) {
      const x = -1 + k * 2.6, h = 1.2 + k * 1.7;
      tag(N[k] + ' 筆', 'idx', x, 0, 1.4);
      const b = bar(B_, 1.3, 1.3, x);
      say('資料 ' + N[k] + ' 筆：要 ' + N[k] + ' 個指令', '固定的 1 秒攤到每筆只剩 1/' + N[k] + ' 秒');
      await growBar(tok, b, h, 700);
      tag(N[k] + ' 個指令', 'idx', x, h + 0.4);
      glow(fx, GOLD); await beat(tok, 1000); glow(fx, null);
      await beat(tok, 500);
    }
    say('資料一大，跟資料量有關的部分浮出來', '常數（固定 1 秒、每步幾毫秒）不重要');
    await beat(tok, 3200);
  }]);

  // 28:02 n³ vs 1126n
  FRAG.push(['stklin-n3-vs-1126n', 'n³ 與 1126n：n 夠大才看得出來', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.6;
    const map = (n, v) => V3(OX + n / 50 * W, OY + Math.min(v / 125000, 1.03) * H);
    axes(OX, OY, W, H, 'n', '步數');
    const b = plot((n) => 1126 * n, 0, 50, map, B_), r = plot((n) => n ** 3, 0, 50, map, R_);
    say('兩個選擇：n³ 與 1126n', '紅 = n³，藍 = 1126n（斜率很高）');
    await reveal(tok, b, 1200); tagV('1126n', 'ptr', map(50, 56300), 0.3, 0.4);
    await reveal(tok, r, 1600); tagV('n³', 'ptr alt', map(50, 125000), -0.7, 0.3);
    await beat(tok, 1000);
    dot(map(10, 1000), R_); dot(map(10, 11260), B_);
    tagV('n = 10', 'idx', map(10, 11260), 0, 0.5);
    say('資料不大：選紅色 n³ 比較省', 'n = 10：n³ = 1,000 < 1126n = 11,260');
    await beat(tok, 3000);
    const cx = Math.sqrt(1126);
    dot(map(cx, 1126 * cx), Y_, 0.3);
    tagV('交點 n = √1126 ≈ 33.6', 'ptr alt', map(cx, 1126 * cx), -1.8, 0.6);
    say('過了交點，n³ 衝上去', 'n³ = 1126n ⇔ n² = 1126');
    await beat(tok, 3000);
    dot(map(50, 125000), R_); dot(map(50, 56300), B_);
    say('資料夠大：選藍色 1126n', 'n = 50：n³ = 125,000 > 1126n = 56,300');
    await beat(tok, 3000);
    say('只看 n 夠大時的行為', 'asymptotic behavior：斜率再大也輸給 n³');
    await beat(tok, 3000);
  }]);

  // 31:00 Big-O 的意思
  FRAG.push(['stklin-bigo-meaning', 'Big-O：長得比較慢或差不多', async (tok) => {
    fresh([0, 4.5, 14], [0, 3, 0]);
    tag('f(n) = O(g(n))', 'ptr alt', 0, 7.2);
    say('Big-O：電腦科學的行話', 'f(n) = O(g(n))：f 長得比 g 慢，或差不多');
    await beat(tok, 2800);
    const OX = -6.2, OY = 0.3, W = 5.4, H = 5.6;
    const map = (n, v) => V3(OX + n / 10 * W, OY + Math.min(v / 100, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    const c1 = plot((n) => n, 0, 10, map, B_), c2 = plot((n) => n * n, 0, 10, map, R_);
    await reveal(tok, c1, 700); tagV('n', 'ptr', map(10, 10), 0.4, 0.2);
    await reveal(tok, c2, 900); tagV('n²', 'ptr alt', map(10, 100), 0.4, 0);
    say('n 跑得比 n² 慢', 'n = O(n²)');
    await beat(tok, 2400);
    const c3 = plot((n) => 3 * n, 0, 10, map, Y_);
    await reveal(tok, c3, 700); tagV('3n', 'idx', map(10, 30), 0.4, 0);
    say('3n 跟 n 同一級：差不多', '3n = O(n)：O 是「慢或差不多」');
    await beat(tok, 2600);
    tag('直覺：看 f / g 的極限', 'ptr', 3.0, 6.4);
    const fl = tag('', 'idx', 3.0, 5.7);
    for (let k = 1; k <= 3; k++) {
      const x = 1.0 + (k - 1) * 2.0;
      const bf = bar(B_, 0.7, 0.7, x - 0.4), bg = bar(R_, 0.7, 0.7, x + 0.4);
      tag('f=' + k, 'idx', x - 0.4, 0, 0.8); tag('g=' + 10 * k, 'idx', x + 0.4, 0, 0.8);
      await growBar(tok, bf, 0.15 * k, 300); await growBar(tok, bg, 1.5 * k, 500);
      txt(fl, 'f/g = ' + k + '/' + 10 * k + ' = 1/10');
      say('f = ' + k + '、g = ' + 10 * k, 'f / g = 1/10');
      await beat(tok, 1000);
    }
    say('相除一直是 1/10：沒有暴衝出去', 'lim f/g ≤ c → f 被 g 包住 → f = O(g)');
    await beat(tok, 3200);
  }]);

  // 36:32 O(n²) 是集合、也像 ≤
  FRAG.push(['stklin-bigo-set', 'O(n²) 是一個函數的集合', async (tok) => {
    fresh([0, 6.5, 13], [0, 1.5, 0]);
    const S = ghostBox(B_, 7, 2.6, 4.2); S.position.set(-2, 1.3, 0);
    tag('O(n²)：長得比 n² 慢或差不多', 'ptr', -2, 3.1);
    say('O(n²) 像一個集合', '裡面有各式各樣的函數');
    await beat(tok, 2000);
    const F = [['n', '比 n² 慢'], ['n²', '差不多'], ['0.1n²', '差不多'], ['3n²', '差不多'], ['√n', '比 n² 慢']];
    const ms = [];
    for (let k = 0; k < F.length; k++) {
      const x = -4.4 + (k % 3) * 2.4 + (k >= 3 ? 1.2 : 0), z = k < 3 ? -0.9 : 0.9;
      ms.push(cube(F[k][0], k === 1 ? R_ : B_, [1.5, 0.6, 1.0], x, 0.3, z, 5));
      say(F[k][0] + ' 跑得比 n² 慢嗎？', F[k][1] + ' → ' + F[k][0] + ' = O(n²)');
      await beat(tok, 1300);
    }
    const n3 = cube('n³', R_, [1.5, 0.6, 1.0], 4.6, 0.3, 0, 5);
    say('n³ 呢？長得比 n² 快', 'n³ ≠ O(n²)：不在集合裡');
    await beat(tok, 1600);
    fly(n3, V3(4, 8, 3));
    await beat(tok, 900);
    say('所以「=」其實比較像「∈」', 'n = O(n²) 的意思是 n ∈ O(n²)');
    await beat(tok, 2600);
    ms.forEach((m) => glow(m, GOLD));
    say('也像函數之間的「≤」', '比 n 夠大時的大小：慢像 <、差不多像 =');
    await beat(tok, 2800);
    ms.forEach((m) => glow(m, null));
    cube('1126n', Y_, [1.6, 0.6, 1.0], 4.6, 0.3, 0, 5);
    tag('O(n)', 'ptr alt', 4.6, 1.4);
    say('常數不重要：1126n = O(n)', '1126n / n = 1126 ≤ 某個固定的 c');
    await beat(tok, 3000);
    const mainT = cube('主要項', R_, [1.8, 0.8, 1.2], 4.6, 0.4, 2.6, 4);
    const sub = [cube('次要項', B_, [1.1, 0.4, 0.8], 2.4, 0.2, 2.6, 4), cube('常數', GRAY, [0.9, 0.4, 0.8], 6.4, 0.2, 2.6, 4)];
    say('真實步數裡的次要項、常數', '都會被主要項吃掉');
    await beat(tok, 1600);
    sub.forEach((m) => move(m, 4.6, 0.4, 2.6));
    await beat(tok, 700);
    sub.forEach(kill); glow(mainT, GOLD);
    say('只留主要項寫進 O( )', '把常數丟掉，留下跟成長有關的部分');
    await beat(tok, 2600);
  }]);

  // 41:50 formal definition ＋ |sin n|
  FRAG.push(['stklin-formal-def', 'Formal 定義：n ≥ n0 時 f ≤ c·g', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.4;
    const map = (n, v) => V3(OX + n / 14 * W, OY + Math.min(v / 14, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    say('lim f/g ≤ c 只是直覺', '先假設 f、g 都是正函數（示意圖）');
    await beat(tok, 2400);
    const f = (n) => 0.5 * n + 3 + 0.8 * Math.sin(1.3 * n);
    const cg = plot((n) => n, 0, 14, map, R_), fl = plot(f, 0, 14, map, B_, 140);
    await reveal(tok, cg, 900); tagV('c·g(n)', 'ptr alt', map(14, 14), -0.4, 0.3);
    await reveal(tok, fl, 1200); tagV('f(n)', 'ptr', map(14, f(14)), 0.5, 0);
    say('真正定義：找得到 c 和 n0', 'n ≥ n0 時，f(n) ≤ c·g(n)');
    await beat(tok, 2400);
    const x0 = map(8, 0).x;
    line(x0, OY, x0, OY + H, 0, Y_); tag('n0', 'ptr alt', x0, 0, 0.6);
    for (let n = 8; n <= 14; n++) { dot(map(n, f(n)), G_, 0.18); await beat(tok, 200); }
    say('n0 之前怎樣都沒關係', 'n0 之後 f 一直被 c·g 壓在下面');
    await beat(tok, 2600);
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const map2 = (n, v) => V3(OX + n / 40 * W, OY + v / 1.4 * H);
    axes(OX, OY, W, H, 'n', '');
    const one = plot(() => 1, 0, 40, map2, R_, 2), s = plot((n) => Math.abs(Math.sin(n)), 0, 40, map2, B_, 400);
    say('例子：f(n) = |sin n|、g(n) = 1', 'f / g = |sin n|');
    await reveal(tok, one, 500); tagV('g(n) = 1', 'ptr alt', map2(40, 1), 0.2, 0.45);
    await reveal(tok, s, 2400); tagV('|sin n|', 'ptr', map2(40, 0.75), 0.7, 0);
    say('跳上跳下，n 再大也不收斂', 'lim |sin n| 不存在 → 直覺版用不了');
    await beat(tok, 2800);
    for (let n = 1; n <= 40; n++) dot(map2(n, Math.abs(Math.sin(n))), G_, 0.13);
    say('但它一直被 1 壓在下面', 'c = 1：|sin n| ≤ 1·g(n) → |sin n| = O(1)');
    await beat(tok, 3000);
    say('Formal 定義比較廣', '沒有極限的情形也包進來了');
    await beat(tok, 2600);
  }]);

  // 46:40 證明：limit ⇒ Big-O
  FRAG.push(['stklin-lim-proof', '證明：lim f/g ≤ c ⇒ f = O(g)', async (tok) => {
    fresh([0, 4.4, 14.5], [0, 4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 5.6, C = 3, E = 0.5;
    const map = (n, v) => V3(OX + n / 30 * W, OY + Math.min(v / 10, 1.03) * H);
    axes(OX, OY, W, H, 'n', 'f/g');
    const cd = code(['lim f(n)/g(n) = c', '給 ε → 有 n0：n > n0 ⇒ |f/g − c| < ε', 'n > n0 ⇒ f/g < c + ε', '改名：c′ = c + ε，n0′ = n0', 'n ≥ n0′ ⇒ f ≤ c′·g  ∴ f = O(g)'], 1.2, 9.4, 0.5);
    cd.hl(0);
    const r = (n) => C + 6 / n;
    say('已知：f/g 的極限是 c', '舉例：f/g = 3 + 6/n → c = 3');
    const ds = [];
    for (let n = 1; n <= 30; n++) { ds.push(dot(map(n, r(n)), B_, 0.17)); await beat(tok, 60); }
    const yc = map(0, C).y;
    hl(OX, W, yc, R_); tag('c = 3', 'ptr alt', OX - 0.7, yc);
    await beat(tok, 1600);
    cd.hl(1);
    hl(OX, W, map(0, C + E).y, Y_); hl(OX, W, map(0, C - E).y, Y_);
    tag('c ± ε', 'idx', OX + W + 0.5, map(0, C + E).y);
    say('Limit 定義：給一個 ε 就有 n0', 'ε = 0.5 → n0 = 12（6/n < 0.5 ⇔ n > 12）');
    await beat(tok, 2600);
    const x0 = map(12, 0).x;
    line(x0, OY, x0, OY + H, 0, Y_); tag('n0 = 12', 'ptr alt', x0, 0, 0.7);
    ds.forEach((d, i) => { if (i + 1 > 12) tint(d, G_); });
    cd.hl(2);
    say('只要上半邊：f/g < c + ε', 'n > 12 時 f/g < 3.5');
    await beat(tok, 2600);
    cd.hl(3);
    say('重新取名：c′ = c + ε', 'c′ = 3.5、n0′ = 12（< 放寬成 ≤ 也成立）');
    await beat(tok, 2600);
    cd.hl(4);
    say('符合 Big-O 定義：證完', 'Limit（直覺）⇒ Formal（定義）');
    await beat(tok, 3000);
    cd.hl(-1);
    say('直覺和定義兩個都要懂', '直覺幫你想像，定義才是真理的來源');
    await beat(tok, 2600);
  }]);

  // 52:26 Q&A：分塊 array，極限不存在但被常數壓住
  FRAG.push(['stklin-chunk-array', '分塊 array：不收斂也能是 O(1)', async (tok) => {
    fresh([0, 6, 13], [0, 1.6, 0]);
    say('array 化整為零：每 100 筆一小塊', '塊與塊之間像 linked list 串起來');
    const fills = [1, 1, 1, 0.37];
    let last = null;
    for (let k = 0; k < 4; k++) {
      const x = -5.1 + k * 3.4;
      const shell = ghostBox('#c9b48e', 2.4, 0.8, 1.2); shell.position.set(x, 0.4, 0);
      const fl = lab.box(B_, [2.4, 0.6, 1.0]); fl.scale.x = fills[k]; fl.position.set(x - 1.2 + 1.2 * fills[k], 0.3, 0); lab.world.add(fl);
      tag('第 ' + (k + 1) + ' 塊', 'idx', x, 0, 1.1);
      if (k) arrow(V3(x - 3.4 + 1.25, 0.4, 0), V3(x - 1.25, 0.4, 0));
      last = { fl, x };
      await beat(tok, 700);
    }
    const meterS = ghostBox(R_, 6, 0.5, 0.5); meterS.position.set(0, 3.2, 0);
    const meter = lab.box(R_, [6, 0.4, 0.4]); meter.position.set(0, 3.2, 0); lab.world.add(meter);
    tag('塊內成本', 'ptr', -4.2, 3.2); tag('上限 100', 'ptr alt', 3.6, 3.9);
    const mv = tag('', 'idx', 0, 3.9);
    say('塊內操作的成本：看這塊多滿', '在 0 ~ 100 之間跳來跳去');
    for (const v of [37, 80, 5, 99, 52, 100, 12, 64]) {
      const p = Math.max(v, 2) / 100;
      last.fl.scale.x = p; last.fl.position.x = last.x - 1.2 + 1.2 * p;
      meter.scale.x = p; meter.position.x = -3 + 3 * p;
      txt(mv, '這次 = ' + v);
      await beat(tok, 650);
    }
    say('n 再大也不收斂，但永遠 ≤ 100', 'f(n) ≤ 100 → f = O(1)；極限卻不存在');
    await beat(tok, 3000);
    say('Limit 是充分條件，不是必要條件', 'limit ≤ c ⇒ O；O 不保證極限存在');
    await beat(tok, 2800);
    say('證明兩條路', '證 limit 存在且 ≤ c｜或直接找出 c、n0');
    await beat(tok, 2800);
  }]);

  // 73:52 Ω 與 Θ
  FRAG.push(['stklin-omega-theta', 'Big Omega 與 Big Theta', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.4;
    const map = (n, v) => V3(OX + n / 12 * W, OY + Math.min(v / 24, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    const f = (n) => n * (1.2 + 0.35 * Math.sin(n * 1.4));
    const fl = plot(f, 0, 12, map, B_, 160), up = plot((n) => 2 * n, 0, 12, map, R_), lo = plot((n) => 0.5 * n, 0, 12, map, G_);
    await reveal(tok, fl, 1200); tagV('f(n)', 'ptr', map(12, f(12)), 0.6, 0);
    say('Big O：上限，像 ≤', 'f(n) ≤ c₂·g(n) → f = O(g)');
    await reveal(tok, up, 900); tagV('c₂·g', 'ptr alt', map(12, 24), -0.4, 0.3);
    await beat(tok, 1800);
    say('Big Omega：下限，像 ≥', 'f(n) ≥ c₁·g(n) → f = Ω(g)');
    await reveal(tok, lo, 900); tagV('c₁·g', 'ptr', map(12, 6), 0.6, 0);
    await beat(tok, 1800);
    say('又 O 又 Ω → Big Theta', 'f = Θ(g)：差不多（c₁、c₂ 都要 > 0）');
    await beat(tok, 2600);
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const map2 = (n, v) => V3(OX + n / 40 * W, OY + Math.max(0, Math.min(v / 14, 1.03)) * H);
    axes(OX, OY, W, H, 'n', 'f/g');
    const y8 = map2(0, 8).y;
    hl(OX, W, y8, R_); tag('8', 'ptr alt', OX - 0.5, y8);
    hl(OX, W, map2(0, 9).y, Y_); hl(OX, W, map2(0, 7).y, Y_);
    tag('8 + ε', 'idx', OX + W + 0.6, map2(0, 9).y); tag('8 − ε', 'idx', OX + W + 0.6, map2(0, 7).y);
    const r = (n) => 8 + 14 * Math.cos(n) / n;
    const ds = [];
    say('f/g 收斂到 8（例：ε = 1）', 'n 夠大時：8 − ε < f/g < 8 + ε');
    for (let n = 1; n <= 40; n++) { ds.push(dot(map2(n, r(n)), B_, 0.16)); await beat(tok, 70); }
    await beat(tok, 1200);
    ds.forEach((d, i) => { if (i + 1 > 14) tint(d, G_); });
    say('上面那條 → O、下面那條 → Ω', '兩邊都成立 → f = Θ(g)');
    await beat(tok, 2800);
    say('實務上 Big O 最常用', '大約八成；Ω、Θ 合起來一成多');
    await beat(tok, 2600);
  }]);

  // 78:18 七個常用函數
  FRAG.push(['stklin-seven-funcs', '七個常用函數與 log 的底', async (tok) => {
    fresh([0, 4.2, 14.5], [0, 3.2, 0]);
    const SEV = [['1', 1, '常數'], ['log n', 4, 'logarithmic'], ['n', 16, 'linear'], ['n log n', 64, ''], ['n²', 256, 'square'], ['n³', 4096, 'cubic'], ['2ⁿ', 65536, 'exponential']];
    say('課本的七個常用函數', '以 n = 16 為例（高度是 log 尺度）');
    await beat(tok, 2000);
    const bars = [];
    for (let k = 0; k < SEV.length; k++) {
      const [nm, v, d] = SEV[k], x = -6 + 2 * k, h = 0.4 + Math.log2(v) * 0.38;
      tag(nm, 'ptr', x, 0, 1.3);
      const b = bar(colorFor(k), 1.2, 1.2, x); bars.push(b);
      say(nm + (d ? '：' + d : ''), 'n = 16 → ' + v.toLocaleString());
      await growBar(tok, b, h, 500);
      tag(v.toLocaleString(), 'idx', x, h + 0.4);
      await beat(tok, 700);
    }
    glow(bars[1], GOLD); glow(bars[3], GOLD);
    say('log n 夾在 1 和 n 中間', 'n log n 夾在 n 和 n² 中間');
    await beat(tok, 2800);
    glow(bars[3], null);
    say('log 的底不重要', 'log₂ n = log₁₀ n ÷ log₁₀ 2 ≈ 3.32·log₁₀ n');
    await beat(tok, 3000);
    glow(bars[1], null); glow(bars[6], RED);
    tag('5ⁿ / 2ⁿ = 2.5ⁿ → ∞', 'ptr alt', 4.4, 7.4);
    say('但指數的底不能隨便換！', '5ⁿ / 2ⁿ = 2.5ⁿ 沒有上限 → 5ⁿ ≠ O(2ⁿ)');
    await beat(tok, 3400);
  }]);

  // 84:17 sequential search
  FRAG.push(['stklin-seq-search', 'Sequential search：最差 Θ(n)', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const A = [7, 3, 9, 1, 6, 4, 8, 2], X = (i) => -5.25 + i * 1.5;
    const cs = A.map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.1); return cube(v, B_, [1.1, 0.7, 1.1], X(i), 0.35, 0); });
    const cur = tag('▼ i', 'ptr alt', X(0), 1.5);
    const cnt = tag('', 'ptr', 0, 3.2);
    say('Sequential search：從頭找到尾', '找到回傳 index；找不到回傳 −1');
    await beat(tok, 2200);
    glow(cs[0], GREEN); txt(cnt, '找 7：比較 1 次');
    say('最佳：第一輪就找到', '常數時間');
    await beat(tok, 2600);
    glow(cs[0], null);
    for (let i = 0; i < A.length; i++) {
      cur.position.x = X(i); glow(cs[i], GOLD); txt(cnt, '找 5：比較 ' + (i + 1) + ' 次');
      say('最差：要找 5，一個一個比', 'A[' + i + '] = ' + A[i] + ' ≠ 5');
      await beat(tok, 550);
      glow(cs[i], null); tint(cs[i], GRAY);
    }
    say('整個 array 跑完：找不到', 'return −1；比較了 n = 8 次');
    await beat(tok, 2400);
    say('最差要花「約 n」的時間', '例如 5n + 7 步 → Θ(n)：有上限也有下限');
    await beat(tok, 2800);
    say('O(n)：linear complexity', '力氣跟 array 大小 n 成正比');
    await beat(tok, 2600);
  }]);

  // 86:15 binary search
  FRAG.push(['stklin-binsearch', 'Binary search：每次砍一半 → log n', async (tok) => {
    fresh([0, 6, 12.5], [0, 1, 0]);
    const X = (i) => -6 + i * 0.8;
    const cs = []; for (let i = 0; i < 16; i++) cs.push(cube((i + 1) * 3, B_, [0.62, 0.5, 0.62], X(i), 0.25, 0));
    const rd = tag('剩 16 個', 'ptr', 0, 3.4), chain = tag('16', 'ptr alt', 0, 4.4);
    say('Binary search：array 已經排好', '要找 50（比全部都大 → 最壞情況）');
    await beat(tok, 2400);
    let lo = 0, hi = 15, seq = '16';
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      glow(cs[mid], GOLD);
      say('看中間 A[' + mid + '] = ' + (mid + 1) * 3, (mid + 1) * 3 + ' < 50 → 左半邊（含中間）全丟掉');
      await beat(tok, 1100);
      for (let i = lo; i <= mid; i++) { glow(cs[i], null); tint(cs[i], GRAY); }
      lo = mid + 1;
      const left = hi - lo + 1;
      txt(rd, '剩 ' + left + ' 個');
      if (left) { seq += ' → ' + left; txt(chain, seq); }
      await beat(tok, 700);
    }
    say('16 → 8 → 4 → 2 → 1：4 個箭頭', 'log₂ 16 = 4；保守說每輪至少砍一半');
    await beat(tok, 2800);
    say('最差約 log n 輪', '每輪的 if、比較只是常數；底數 2 也不寫');
    await beat(tok, 2600);
    fresh([0, 5, 13], [0, 2.8, 0]);
    tag('n = 1000（log₂ 1000 ≈ 10）', 'ptr', 0, 6.8);
    tag('Sequential', 'ptr', -2.2, 0, 1.4); tag('Binary', 'ptr alt', 2.2, 0, 1.4);
    const bs = bar(B_, 1.6, 1.6, -2.2), bb = bar(O_, 1.6, 1.6, 2.2);
    say('Sequential：1000 輪 × 10 個指令', '= 10,000 個指令');
    await growBar(tok, bs, 5.5, 900); tag('10,000', 'idx', -2.2, 5.9);
    await beat(tok, 1400);
    say('Binary：10 輪 × 50 個指令', '= 500 個指令');
    await growBar(tok, bb, 0.28, 500); tag('500', 'idx', 2.2, 0.7);
    await beat(tok, 1800);
    say('資料夠大，binary search 一定贏', 'worst-case analysis：估計資料變大要跑多久');
    await beat(tok, 3000);
  }]);

  // 92:21 沒排序：直接找 vs 排序再找
  FRAG.push(['stklin-sort-or-not', '直接找，還是先排序再找？', async (tok) => {
    fresh([0, 6, 13], [0, 1.2, 0]);
    const U = [5, 2, 8, 1, 9, 3], X = (i) => -3.75 + i * 1.5;
    let cs = U.map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.1); return cube(v, colorFor(v), [1.1, 0.7, 1.1], X(i), 0.35, 0); });
    const m1 = tag('方法一：sequential search ≈ n', 'ptr', -2.5, 3.6), m2 = tag('', 'ptr alt', 2.5, 3.0);
    say('array 還沒排好，要找東西？', '兩個方法');
    await beat(tok, 2000);
    say('方法一：直接 sequential search', '約 n 的時間');
    for (const c of cs) { glow(c, GOLD); await beat(tok, 250); glow(c, null); }
    await beat(tok, 800);
    txt(m2, '方法二：selection sort + binary search');
    say('方法二：先 selection sort', '每一輪 = 一次 getMinIndex（≈ n）');
    const a = [...U];
    for (let i = 0; i < a.length; i++) {
      let m = i;
      for (let j = i; j < a.length; j++) { glow(cs[j], GOLD); if (a[j] < a[m]) m = j; await beat(tok, 120); glow(cs[j], null); }
      if (m !== i) {
        move(cs[i], X(m), 0.35); move(cs[m], X(i), 0.35);
        [a[i], a[m]] = [a[m], a[i]]; [cs[i], cs[m]] = [cs[m], cs[i]];
      }
      glow(cs[i], GREEN);
      await beat(tok, 400);
    }
    say('n 輪 × 每輪約 n', 'selection sort ≈ n²');
    await beat(tok, 2400);
    say('排好之後再 binary search', 'log n');
    await beat(tok, 2000);
    txt(m2, '方法二 ≈ n² + log n');
    say('哪個快？要把 Big-O 組合起來', 'n  vs  n² + log n');
    await beat(tok, 3000);
  }]);

  // 99:54 Q&A：mid 的 overflow
  FRAG.push(['stklin-mid-overflow', 'Binary search 的 mid 會 overflow？', async (tok) => {
    fresh([0, 5, 13], [0, 2.4, 0]);
    const cd = code(['mid = (left + right) / 2;', 'mid = left + (right - left) / 2;'], 0, 6.6, 0.6);
    const X0 = -5, X1 = 1.5, X = (p) => X0 + (X1 - X0) * p;
    line(X0, 0.05, 6.5, 0.05, 0, '#c9b48e');
    tag('0', 'idx', X0, 0, 0.8); tag('INT_MAX', 'ptr alt', X1, 0, 0.8); tag('½', 'idx', X(0.5), 0, 0.8);
    line(X1, 0, X1, 3, 0, R_);
    tag('left', 'ptr', X(0.6), 1.0); tag('right', 'ptr', X(0.8), 1.6);
    cube('', B_, [0.15, 0.6, 0.6], X(0.6), 0.3, 0); cube('', B_, [0.15, 0.6, 0.6], X(0.8), 0.3, 0);
    cd.hl(0);
    say('left、right 都超過整數範圍一半', '同學提醒：left + right 會 overflow');
    await beat(tok, 3400);
    const sum = lab.box(R_, [1, 0.4, 0.5]); sum.position.set(X0, 2.3, 0); lab.world.add(sum);
    await anim(tok, 1200, (t) => { const w = (X(1.4) - X0) * t; sum.scale.x = Math.max(0.01, w); sum.position.x = X0 + w / 2; });
    tag('left + right 超過 INT_MAX！', 'ptr alt', X(1.4) - 0.4, 2.9);
    say('相加先爆掉，再除以 2 也救不回來', 'overflow → mid 變成錯的（甚至負數）');
    await beat(tok, 3000);
    cd.hl(1); kill(sum);
    const d = lab.box(G_, [1, 0.4, 0.5]); d.position.set(X(0.6), 2.3, 0); lab.world.add(d);
    await anim(tok, 800, (t) => { const w = (X(0.8) - X(0.6)) * (1 - 0.5 * t); d.scale.x = w; d.position.x = X(0.6) + w / 2; });
    tag('left + (right − left)/2：不會超過 right', 'ptr', X(0.7), 3.0);
    say('改寫：left + (right − left) / 2', '中間值都不會超過 right');
    await beat(tok, 2600);
    say('know your program', '資料或 index 不大時兩種都 OK；很大時用改寫版');
    await beat(tok, 3000);
  }]);

  // 111:27 和的規則、遞移律
  FRAG.push(['stklin-sum-rule', '從定義證明：和的規則與遞移律', async (tok) => {
    fresh([0, 5, 14], [0, 3, 0]);
    let cd = code(['f₁ ≤ c₁·g₂   (n ≥ n₁)', 'f₂ ≤ c₂·g₂   (n ≥ n₂)', 'n ≥ max(n₁, n₂)：兩式都成立', 'f₁ + f₂ ≤ (c₁ + c₂)·g₂', '∴ f₁ + f₂ = O(g₂)'], -2.6, 7.4, 0.5);
    const XN = (n) => -6 + n / 8000 * 12;
    line(-6, 0.05, 6, 0.05, 0, '#6e5f49'); tag('n', 'idx', 6.5, 0);
    cd.hl(0);
    const b1 = lab.box(B_, [XN(8000) - XN(1126), 0.2, 0.6]); b1.position.set((XN(1126) + 6) / 2, 0.1, -0.5); lab.world.add(b1);
    tag('n₁ = 1126', 'ptr', XN(1126), 0.6, -0.5);
    say('f₁ = O(g₂)：n ≥ n₁ 後被 c₁·g₂ 壓住', '寫下定義就先賺兩行');
    await beat(tok, 2400);
    cd.hl(1);
    const b2 = lab.box(O_, [XN(8000) - XN(5566), 0.2, 0.6]); b2.position.set((XN(5566) + 6) / 2, 0.1, 0.5); lab.world.add(b2);
    tag('n₂ = 5566', 'ptr alt', XN(5566), 0.6, 0.9);
    say('f₂ = O(g₂)：n ≥ n₂ 後被 c₂·g₂ 壓住', '');
    await beat(tok, 2200);
    cd.hl(2); glow(b2, GREEN);
    say('兩個都要成立：取比較大的', "n₀' = max(1126, 5566) = 5566");
    await beat(tok, 2600);
    cd.hl(3);
    const f1 = cube('f₁', B_, [1.2, 1.2, 1.2], -4.2, 2.4, 0), f2 = cube('f₂', O_, [1.2, 0.9, 1.2], -2.4, 2.25, 0);
    say('兩式加起來', "f₁ + f₂ ≤ (c₁ + c₂)·g₂ → c' = c₁ + c₂");
    await beat(tok, 1000);
    move(f2, -4.2, 3.45, 0);
    await beat(tok, 1600);
    cd.hl(4);
    say("找到 n₀' 和 c' → 符合定義", 'QED：合起來還是被 g₂ 壓住');
    await beat(tok, 2600);
    cd.kill(); kill(f1); kill(f2);
    cd = code(['f ≤ c₁·g₁     (n ≥ n₁)', 'g₁ ≤ c₂·g₂    (n ≥ n₂)', 'f ≤ c₁·c₂·g₂  (n ≥ max(n₁, n₂))', '∴ f = O(g₂)'], -2.6, 7.4, 0.5);
    const fs = [['f', 0.8, B_], ['g₁', 1.6, O_], ['g₂', 2.6, R_]].map(([t, h, c], i) => { const m = cube(t, c, [1.2, h, 1.2], 1.8 + i * 1.8, 1.5 + h / 2, 0, 3); return m; });
    tag('≤', 'val', 2.7, 2.2); tag('≤', 'val', 4.5, 2.6);
    cd.hl(0); say('遞移律：像 ≤ 一樣可以串', 'f = O(g₁)、g₁ = O(g₂)');
    await beat(tok, 2400);
    cd.hl(2); say("c' = c₁·c₂、n₀' = max(n₁, n₂)", '兩行定義一路代下去');
    await beat(tok, 2600);
    cd.hl(3); fs.forEach((m) => glow(m, GOLD));
    say('f = O(g₂)', '從定義出發：湊出需要的 n₀ 和 c');
    await beat(tok, 2600);
  }]);

  // 116:15 組合：selection sort + binary search
  FRAG.push(['stklin-combine', '組合：selection sort + binary search', async (tok) => {
    fresh([0, 5, 13], [0, 2, 0]);
    const f1 = cube('f₁：selection sort', B_, [3.2, 2.4, 2.0], -3, 1.2, 0, 5);
    tag('O(n²)', 'ptr', -3, 3.0);
    say('f₁ = selection sort', 'O(n²)');
    await beat(tok, 2000);
    const f2 = cube('f₂：binary search', O_, [2.4, 0.5, 1.2], 3, 0.25, 0, 5);
    const t2 = tag('O(log n)', 'ptr alt', 3, 1.1);
    say('f₂ = binary search', 'O(log n)');
    await beat(tok, 2000);
    glow(f1, GOLD); glow(f2, GOLD);
    say('log n 漲得比 n² 慢', 'log n = O(n²)');
    await beat(tok, 2200);
    glow(f1, null); glow(f2, null);
    move(f2, -3, 1.2, 0); kill(t2);
    await beat(tok, 900);
    kill(f2);
    say('合起來被大的那個壓住', 'f₁ + f₂ = O(n²)');
    await beat(tok, 2400);
    say('先排序再搜尋：最差 O(n²)', 'bottleneck：selection sort');
    await beat(tok, 2400);
    say('程式切小段 → 各自分析 → 揉起來', '一眼看出最花時間的步驟');
    await beat(tok, 2400);
    fly(f1, V3(-3, 8, 3));
    const big = cube('n³', R_, [2.4, 2.4, 2.0], 0, 1.2, 0, 5);
    const small = [['n²', -4.6], ['n', 4.2], ['1', 5.8]].map(([t, x]) => cube(t, B_, [1.0, 0.6, 1.0], x, 0.3, 0, 5));
    say('多項式：最大項把其他項吞掉', '例：n³ + n² + n + 1');
    await beat(tok, 2000);
    for (const s of small) { move(s, 0, 1.2, 0); await beat(tok, 600); kill(s); }
    glow(big, GOLD);
    say('像秦吞六國，一個一個吞掉', 'n³ + n² + n + 1 = O(n³)');
    await beat(tok, 2800);
  }]);

  // 120:43 最緊的上限
  FRAG.push(['stklin-tight', 'Big O 要說最緊的上限', async (tok) => {
    fresh([0, 5, 13.5], [0, 3, 0]);
    const Y = (v) => 0.6 + Math.log10(v) * 1.3;
    cube('1', B_, [1.2, 0.6, 1.2], -3.8, 0.3, 0, 3);
    say('「≤」可以有很多個上限', '1 ≤ 10、1 ≤ 1126、1 ≤ 5566');
    for (const v of [10, 1126, 5566]) {
      const s = lab.box('#c9b48e', [2.4, 0.1, 1.6]); s.position.set(-3.8, Y(v), 0); lab.world.add(s);
      tag('≤ ' + v, 'idx', -2.0, Y(v));
      await beat(tok, 800);
    }
    await beat(tok, 1400);
    const al = cube('n² 的演算法', O_, [2.0, 2.4, 1.6], 3, 1.2, 0, 3);
    const caps = [['O(n²)', 2.55, G_], ['O(n³)', 4.2, GRAY], ['O(n¹¹²⁶)', 6.4, GRAY]].map(([t, y, c]) => {
      const s = lab.box(c, [2.6, 0.12, 1.8]); s.position.set(3, y, 0); lab.world.add(s); tag(t, 'ptr', 5.2, y); return s;
    });
    say('n² 的演算法：O(n²)、O(n³)、O(n¹¹²⁶) 都對', '數學上都是上限');
    await beat(tok, 3000);
    glow(caps[0], GREEN); glow(al, GOLD);
    say('說 O(…) 時隱含：最緊的上限', '想得到、證得出的最緊那個');
    await beat(tok, 2800);
    tint(caps[2], R_);
    say('O(n¹¹²⁶) 也對，但沒有幫助', '上限不緊，描述不了演算法的性質');
    await beat(tok, 2800);
    say('行規：數學正確，還要最緊', '不是隨便給一個很鬆的上限');
    await beat(tok, 2600);
  }]);

  // 123:10 實際要跑多久
  FRAG.push(['stklin-runtime', '每秒 10⁹ 步：實際要跑多久', async (tok) => {
    fresh([0, 4.2, 15.5], [0, 3.4, 0]);
    const RT = [['n', '10⁶', 1e-3, '1 ms', '10⁶ / 10⁹ = 10⁻³ 秒'], ['n log n', '10⁶', 0.02, '20 ms', '10⁶ × 20 / 10⁹ = 0.02 秒'],
      ['n²', '10³', 1e-3, '1 ms', '10⁶ / 10⁹ = 1 ms'], ['n²', '10⁶', 1000, '16.67 分', '10¹² / 10⁹ = 1000 秒'],
      ['n³', '10³', 1, '1 秒', '10⁹ / 10⁹ = 1 秒'], ['n³', '10⁵', 1e6, '11.57 天', '10¹⁵ / 10⁹ = 10⁶ 秒'],
      ['n³', '10⁶', 1e9, '≈ 32 年', '10¹⁸ / 10⁹ = 10⁹ 秒 ≈ 31.7 年'], ['n⁴', '10⁴', 1e7, '≈ 1/3 年', '10¹⁶ / 10⁹ = 10⁷ 秒 ≈ 115.7 天'],
      ['2ⁿ', '50', 1.13e6, '≈ 13 天', '2⁵⁰ ≈ 1.13×10¹⁵ 步'], ['2ⁿ', '100', 1.3e21, '跑不完', '2¹⁰⁰ / 10⁹ ≈ 4×10¹³ 年']];
    const H = (s) => Math.min(7.6, 0.3 + (Math.log10(s) + 3) * 0.5);
    tag('高度 = 秒數（log 尺度）', 'idx', 0, 8.6);
    for (const [nm, s] of [['1 秒', 1], ['1 天', 86400], ['1 年', 3.15e7]]) { line(-6.6, H(s), 6.6, H(s), -0.8, '#c9b48e'); tag(nm, 'idx', -6.6, H(s) + 0.25, -0.8); }
    say('f 就是實際步數，CPU 每秒 10⁹ 步', 'f = n：n = 10 只要 0.01 μs');
    await beat(tok, 2600);
    for (let k = 0; k < RT.length; k++) {
      const [nm, n, s, lb, fm] = RT[k], x = -5.85 + k * 1.3;
      tag(nm, 'ptr', x, 0, 1.2); tag('n=' + n, 'idx', x, 0, 1.9);
      const b = bar(s >= 86400 ? R_ : s >= 1 ? O_ : G_, 0.9, 0.9, x);
      say(nm + '，n = ' + n + '：' + lb, fm);
      await growBar(tok, b, H(s), 500);
      tag(lb, 'idx', x, H(s) + 0.35);
      await beat(tok, 1100);
    }
    say('n³ 碰到大資料就危險了', '多項式次方、指數一大，資料一多就跑不完');
    await beat(tok, 2600);
    say('空間也一樣要估', '50000 × 50000 個 double × 8 bytes = 20 GB');
    await beat(tok, 3000);
  }]);

  // 134:20 Stack = 堆疊，餐盤
  FRAG.push(['stklin-plates', 'Stack：一疊餐盤，只能放最上面', async (tok) => {
    fresh([0, 5, 12], [0, 1.8, 0]);
    say('Stack 中文叫堆疊', '像辦公桌上一疊紙、一疊作業');
    await beat(tok, 2200);
    const top = tag('top', 'ptr', 2.2, 0.2);
    const ps = [];
    for (let k = 0; k < 5; k++) {
      const y = 0.11 + k * 0.26;
      ps.push(cube('', k % 2 ? '#efe6d6' : '#dcd0bb', [2.6, 0.22, 2.6], 0, y, 0, 5));
      top.position.y = y + 0.1;
      say('餐盤一盤一盤往上疊', '第 ' + (k + 1) + ' 盤放在最上面 = top');
      await beat(tok, 900);
    }
    say('新東西只能放最上面', 'insert 只在 top → 叫 push');
    await beat(tok, 2200);
    const mid = cube('', '#f6c9a8', [2.6, 0.22, 2.6], 4.2, 0.6, 0);
    const x = tag('✕ 不能塞中間', 'ptr alt', 4.2, 1.3);
    glow(mid, RED);
    say('restricted：不准插到中間', '只能在 top 放東西');
    await beat(tok, 2400);
    fly(mid, V3(4, 6, 3)); kill(x);
    glow(ps[4], GOLD);
    say('只看得到、拿得到最上面那盤', 'stack 有「頂端」top 的概念');
    await beat(tok, 2600);
  }]);

  // 138:51 push / pop / peek 與 LIFO（老師的例子：push 3、push 5、pop）
  FRAG.push(['stklin-lifo-35', 'push 3、push 5、pop → 5', async (tok) => {
    fresh([0, 5, 13], [0, 2.4, 0]);
    const col = ghostBox(B_, 1.9, 4.4, 1.9); col.position.set(-3, 2.2, 0);
    const cd = code(['get    → peek：只看 top，不拿走', 'insert → push：放到 top', 'remove → pop ：從 top 拿走'], 2.6, 5.6, 0.6);
    const top = tag('top', 'ptr', -1.4, 0.45);
    say('stack 最基本的兩個操作', 'push 和 pop');
    await beat(tok, 1800);
    cd.hl(1);
    const c3 = cube(3, colorFor(3), [1.6, 0.85, 1.6], -3, 0.45, 0, 6);
    say('push(3)', 'stack（底→頂）：3');
    await beat(tok, 1600);
    const c5 = cube(5, colorFor(5), [1.6, 0.85, 1.6], -3, 1.35, 0, 6);
    top.position.y = 1.35;
    say('push(5)：5 壓在 3 上面', 'stack（底→頂）：3, 5');
    await beat(tok, 2600);
    cd.hl(0); glow(c5, GOLD);
    say('peek：偷看 top = 5', 'get top，top 不變');
    await beat(tok, 2000);
    glow(c5, null); cd.hl(2);
    fly(c5, V3(4, 9, 2)); top.position.y = 0.45;
    say('pop() → 5', '後進去的 5 比 3 先出來');
    await beat(tok, 2200);
    tag('Last In, First Out', 'ptr alt', -3, 4.9);
    say('LIFO：後進先出', 'stack 的特性');
    await beat(tok, 2600);
    say('再 pop() → 3', 'stack 空了：top 回到最底');
    fly(c3, V3(4, 9, 2)); top.position.y = 0.2;
    await beat(tok, 2400);
  }]);

  // 141:43 LIFO 的生活例子：擠電梯、餐盤
  FRAG.push(['stklin-elevator', '擠電梯：最後進去的先出來', async (tok) => {
    fresh([0, 7, 10.5], [0, 0.8, 0.5]);
    const car = ghostBox('#c9b48e', 3.4, 2.6, 4.6); car.position.set(0, 1.3, -0.4);
    tag('電梯（只有一個門）', 'ptr', 0, 2.9, -0.4);
    line(-1.7, 0.02, 1.7, 0.02, 1.9, R_); tag('門', 'idx', 2.3, 0.1, 1.9);
    const P = [['A', -2.0], ['B', -0.8], ['C', 0.4]];
    const ps = [];
    say('大家擠進同一台電梯', '先進去的被擠到最裡面');
    for (const [nm, z] of P) {
      const m = cube(nm, colorFor(nm.charCodeAt(0)), [0.8, 1.4, 0.8], 0, 0.7, 4.5);
      ps.push(m);
      move(m, 0, 0.7, z);
      say(nm + ' 進電梯', '進去順序：' + P.slice(0, ps.length).map((p) => p[0]).join(' → '));
      await beat(tok, 1300);
    }
    await beat(tok, 1000);
    const out = [];
    for (let k = ps.length - 1; k >= 0; k--) {
      move(ps[k], 0, 0.7, 4.5); out.push(P[k][0]);
      say('到了：' + P[k][0] + ' 先出去', '出來順序：' + out.join(' → '));
      await beat(tok, 1100);
      fly(ps[k], V3(3, 6, 2));
      await beat(tok, 400);
    }
    say('最後進去的最先出來', 'LIFO；餐盤也一樣：老闆最後放的先被拿走');
    await beat(tok, 3000);
    say('看似有限制，卻非常有用', '很多複雜問題能轉成簡單的 stack 操作');
    await beat(tok, 2600);
  }]);

  // 143:34 括號配對
  FRAG.push(['stklin-paren', '用 Stack 檢查括號配對', async (tok) => {
    const PAIR = { ')': '(', ']': '[', '}': '{' };
    async function run(s) {
      fresh([0, 6, 13], [0, 1.8, 0]);
      const st = ghostBox(B_, 1.5, 4.2, 1.5); st.position.set(-5.2, 2.1, 0);
      tag('stack', 'ptr', -5.2, 4.6);
      const X = (i) => -2.6 + i * 1.3;
      const ts = [...s].map((ch, i) => cube(ch, '#e9dcc4', [1.0, 0.6, 1.0], X(i), 0.3, 1.8));
      const cur = tag('▲', 'ptr alt', X(0), 0, 2.9);
      const stack = [];
      for (let i = 0; i < s.length; i++) {
        const ch = s[i]; cur.position.x = X(i);
        if (!PAIR[ch]) {
          const m = cube(ch, O_, [1.2, 0.6, 1.2], -5.2, 0.3 + stack.length * 0.65, 0, 5);
          stack.push({ ch, m }); tint(ts[i], GRAY);
          say('左括號 ' + ch + '：push', '先在 stack 裡等人來配');
          await beat(tok, 1100);
        } else {
          const t = stack.pop();
          move(t.m, X(i), 1.2, 1.8);
          await beat(tok, 700);
          if (t && t.ch === PAIR[ch]) {
            tint(t.m, G_); tint(ts[i], G_);
            say('右括號 ' + ch + '：pop 出 ' + t.ch, '同一種 → 配對成功，一起離開');
            await beat(tok, 1000);
            fly(t.m); fly(ts[i]);
          } else {
            tint(t.m, R_); tint(ts[i], R_);
            say('右括號 ' + ch + '：pop 出 ' + t.ch, '小括號配到大括號 → 配錯了！');
            await beat(tok, 3000);
            return;
          }
        }
      }
      say('讀完而且 stack 是空的', '括號平衡 ✓');
      await beat(tok, 2400);
    }
    say('最裡面、最後看到的左括號要先配', '最後的先出來 → Stack');
    await run('{([])}');
    await run('{([]}');
  }]);

  // 150:54 system stack
  FRAG.push(['stklin-system-stack', 'System stack：函數呼叫的草稿紙', async (tok) => {
    fresh([0, 5.5, 13.5], [0, 3.2, 0]);
    const cd = code(['int f(int n) {', '  if (n == 0) return 0;', '  return f(n - 1) + n;', '}'], 3.8, 6.8, 0.55);
    const X = -2.4, FH = 0.7, Y = (k) => 0.36 + k * 0.76;
    const fr = [cube('main()', GRAY, [3.8, FH, 2.0], X, Y(0), 0)];
    tag('每張草稿紙：參數、區域變數、回傳值放哪、previous', 'idx', 1.0, 0, 2.6);
    say('呼叫函數 = 拿一張新的草稿紙', '舊的壓在下面等');
    await beat(tok, 2400);
    for (let n = 3; n >= 0; n--) {
      cd.hl(n ? 2 : 1);
      fr.push(cube('f(' + n + ')：n = ' + n, colorFor(n), [3.8, FH, 2.0], X, Y(fr.length), 0, 5));
      say('呼叫 f(' + n + ')', n === 0 ? 'n == 0：直接 return 0' : (n === 3 ? 'main()' : 'f(' + (n + 1) + ')') + ' 還沒算完，壓在下面等');
      await beat(tok, 1200);
    }
    let ret = 0;
    for (let n = 0; n <= 3; n++) {
      ret += n;
      fly(fr.pop(), V3(4, 7, 2));
      say('f(' + n + ') 做完，回傳 ' + ret, '撕掉最上面那張 → 回到上一張');
      await beat(tok, 1100);
    }
    cd.hl(-1);
    line(X - 2.2, 6.2, X + 2.2, 6.2, 0, R_); tag('system stack 空間上限', 'ptr alt', X, 6.6);
    say('如果呼叫太多層呢？', '例如 f(100000)');
    for (let k = 1; k <= 7; k++) { fr.push(cube('f(' + (100001 - k) + ')', colorFor(k), [3.8, FH, 2.0], X, Y(k), 0, 4)); await beat(tok, 320); }
    fr.slice(1).forEach((m) => glow(m, RED));
    say('草稿紙堆不下了', 'Stack Overflow：系統負荷不來');
    await beat(tok, 2600);
    fr.slice(1).forEach((m) => glow(m, null));
    arrow(V3(X + 2.4, Y(7), 0), V3(X + 2.4, Y(3), 0), 0xd64545);
    tag('偷看別張草稿紙', 'ptr', X + 4.1, Y(5));
    say('草稿紙疊在一起：沒保護好', '惡意程式可能偷看別張 → 安全漏洞');
    await beat(tok, 3000);
  }]);

  // 156:50 用 array 實作 stack（老師的例子：已有 3、5，push 4、pop）
  FRAG.push(['stklin-array-impl', '用 array 實作：top 放尾巴', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const X = (i) => -5 + i * 2, S = [1.5, 0.8, 1.5];
    for (let i = 0; i < 6; i++) { slotTile(V3(X(i), 0.02, 0)); tag('[' + i + ']', 'idx', X(i), 0, 1.3); }
    const c3 = cube(3, colorFor(3), S, X(0), 0.45, 0), c5 = cube(5, colorFor(5), S, X(1), 0.45, 0);
    const top = tag('top = 1', 'ptr', X(1), 1.6);
    say('用連續的 array 實作', '已經有 3、5，top 放在尾巴');
    await beat(tok, 2600);
    const c4 = cube(4, colorFor(4), S, X(2), 0.45, 0, 5);
    top.position.x = X(2); txt(top, 'top = 2');
    say('push(4)：放在 top 的下一格', 'stack[++top] = 4');
    await beat(tok, 2200);
    fly(c4, V3(2, 9, 3)); top.position.x = X(1); txt(top, 'top = 1');
    say('pop() → 4：top 往前一格', 'return stack[top--]');
    await beat(tok, 2600);
    say('push、pop 都只動尾巴', '其他元素完全不用搬');
    await beat(tok, 1800);
    txt(top, 'top 放頭？');  top.position.x = X(0);
    say('如果 top 放在 array 的頭？', 'push 要先把全部往後搬');
    move(c5, X(2), 0.45); await beat(tok, 500); move(c3, X(1), 0.45); await beat(tok, 600);
    const n4 = cube(4, colorFor(4), S, X(0), 0.45, 0, 5);
    tag('每次 push / pop 都搬資料 → O(n)', 'ptr alt', 0, 2.6);
    await beat(tok, 2400);
    fly(n4, V3(-2, 9, 3)); await beat(tok, 400);
    move(c3, X(0), 0.45); move(c5, X(1), 0.45);
    say('pop 也要整排往前搬', 'top 放尾端：push、pop 都 O(1)');
    await beat(tok, 2800);
  }]);

  // 159:05 用 singly linked list 實作 stack
  FRAG.push(['stklin-list-impl', '用 linked list 實作：top 放 head', async (tok) => {
    fresh([0, 6, 12.5], [0, 0.8, 0]);
    const XS = [-3.5, -0.5, 2.5];
    let nodes = [null, lnode(5, XS[1], 0.35), lnode(3, XS[2], 0.35)];
    tag('NULL', 'idx', XS[2] + 1.8, 0.35);
    let arrs = [];
    const head = tag('head = top', 'ptr', XS[1], 1.5);
    function link() { arrs.forEach(kill); arrs = []; for (let i = 0; i < 2; i++) if (nodes[i]) arrs.push(arrow(V3(XS[i] + 0.95, 0.35, 0), V3(XS[i + 1] - 0.52, 0.35, 0))); }
    link();
    say('用 singly linked list 實作', 'head 就當 stack 的 top');
    await beat(tok, 2400);
    const n4 = lnode(4, XS[0], 4.5); move(n4, XS[0], 0.35);
    nodes[0] = n4;
    await beat(tok, 600);
    link(); head.position.x = XS[0];
    say('push(4)：接在 head 前面', 'new.link = head；head = new → O(1)');
    await beat(tok, 2600);
    const p = tag('p', 'ptr alt', XS[0], 1.2, 0.8);
    say('top 放尾巴？pop = 刪尾巴', '要改「尾巴前一個」的 pointer');
    for (let i = 0; i < 2; i++) { p.position.x = XS[i]; glow(nodes[i].userData.data, GOLD); await beat(tok, 700); glow(nodes[i].userData.data, null); }
    glow(nodes[1].userData.data, RED);
    say('得從 head 一路走過去才找到', 'singly：刪尾巴 O(n)');
    await beat(tok, 2600);
    glow(nodes[1].userData.data, null); kill(p);
    fly(n4, V3(-3, 8, 3)); nodes[0] = null; link(); head.position.x = XS[1];
    say('pop()：直接拿掉 head', 'head = head.link → O(1)');
    await beat(tok, 2400);
    say('singly：top 放 head 最自然', 'doubly linked list 頭尾對稱，放哪都行');
    await beat(tok, 2800);
  }]);

  // 161:10 STL stack：container adapter
  FRAG.push(['stklin-adapter', 'STL stack：container adapter', async (tok) => {
    fresh([0, 5.5, 13], [0, 2.2, 0]);
    const cd = code(['#include <stack>', 'stack<int, vector<int>> s1;  // 底層用 array', 'stack<int, list<int>>   s2;  // 底層用 linked list', 's1.push(3); s1.push(5); s1.pop();'], 0, 7.2, 0.55);
    const X = (i) => -4 + i * 2;
    const cs = [3, 5, 4, 8, 1].map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.2); return cube(v, colorFor(v), [1.3, 0.7, 1.3], X(i), 0.35, 0); });
    const gt = tag('底層 container：什麼都能做', 'ptr', 0, 1.6, -1.2);
    say('STL 已經寫好 stack', '可以指定底層用 vector 或 list');
    cd.hl(1);
    await beat(tok, 2600);
    cd.hl(2);
    for (const i of [2, 0, 3]) { glow(cs[i], GOLD); say('array／list：general container', '[' + i + '] 想存取哪裡都行'); await beat(tok, 700); glow(cs[i], null); }
    kill(gt);
    const cover = ghostBox(Y_, 10.8, 1.5, 2.2); cover.position.set(0, 0.75, 0);
    tag('stack adapter（轉接器）', 'ptr alt', 0, 2.2);
    tag('▼ top 開口', 'ptr', 4, 2.2, 1.2);
    say('stack = container adapter', '外面包一層：只留 top 一個開口');
    await beat(tok, 2600);
    tint(cs[2], R_);
    const no = tag('✕ 不准碰中間', 'ptr alt', 0, 1.2, 1.4);
    say('受限制的 data structure', '只能 push、pop、top');
    await beat(tok, 2200);
    tint(cs[2], colorFor(4)); kill(no);
    cd.hl(3);
    const c = cube(7, colorFor(7), [1.3, 0.7, 1.3], 6, 0.35, 0, 5);
    say('push：從 top 開口放進去', 'pop：從 top 開口拿出來');
    await beat(tok, 1600);
    fly(c, V3(2, 9, 2));
    await beat(tok, 1000);
    say('像變壓器：把通用的轉成受限的', 'reuse 基本資料結構，做出新的資料結構');
    await beat(tok, 3000);
  }]);
  }
  // @@FRAGMENTS@@

  const TITLES = {"stack-lifo": "Stack：後進先出", "queue-fifo": "Queue：先進先出", "queue-false-full": "線性 Queue 的假滿", "circular-queue": "環狀 Queue", "list-insert": "Linked List 插入與刪除", "postfix-eval": "Postfix 求值", "infix-to-postfix": "Infix 轉 Postfix", "maze-dfs": "Stack 走迷宮（DFS）", "maze-compare": "DFS 與 BFS"};
  const scenes = {};
  Object.keys(DEMOS).forEach((id) => { scenes[id] = { title: TITLES[id] || id, play: DEMOS[id] }; });
  FRAG.forEach(([id, title, play]) => { scenes[id] = { title, play }; });

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
    sceneOrder: ['stack-lifo', 'queue-fifo', 'queue-false-full', 'circular-queue', 'list-insert', 'postfix-eval', 'infix-to-postfix', 'maze-dfs', 'maze-compare', ...FRAG.map((f) => f[0])],
    stop() { clearInterval(pf.timer); clearInterval(mz.timer); },
  };
}
