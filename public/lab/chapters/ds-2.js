// 資料結構 第2章：陣列、Linked List、Stack、Queue。
// Chapter module for lab-shell.js — see the contract at the top of lab-shell.js.
import kit from './_kit.js';
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
  const opts = [...pool.opts].map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
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
// cued scenes: each `await step(tok)` waits until the lecturer says that sentence; beats are motion only.
const step = (tok) => ctx.step(tok);
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
// ghost boxes have no emissive: brighten them instead
function alHi(m, on) { m.material.opacity = on ? 0.4 : 0.16; }
function alBar(color, w, d, x, z) { const m = lab.box(color, [w, 1, d]); m.scale.y = 0.001; m.position.set(x, 0, z); lab.world.add(m); return m; }
function alGrow(tok, m, h, ms) { const h0 = m.scale.y; return anim(tok, ms, (t) => { const v = h0 + (h - h0) * t; m.scale.y = v; m.position.y = v / 2; }); }
function alSlide(tok, m, x0, x1, ms, z0, z1) { return anim(tok, ms, (t) => { m.position.x = x0 + (x1 - x0) * t; if (z0 !== undefined) m.position.z = z0 + (z1 - z0) * t; }); }

// 12:31 從 C 到 C++
FRAG.push(['arrlin-c-cpp', 'C++ 是 C 的延伸', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 1, 0]);
  await step(tok);                                   // 12:33 從 C 到 C++，不是 C++ 導向的課
  say('今天第一段：從 C 到 C++', '不是 C++ 課：只學對資料結構方便的部分');
  await step(tok);                                   // 13:21 只講五個不一樣
  const five = ['reference', 'class', 'operator overloading', 'template', 'STL'];
  for (let k = 0; k < five.length; k++) { cube(five[k], AO, [3.2, 0.45, 0.7], 3.4, 0.22, -1.8 + k * 0.9, 3); await beat(tok, 350); }
  say('只講五個「好用的不一樣」', five.join('、'));
  await step(tok);                                   // 13:35 課本第一章
  say('想知道更多差異：課本第一章', '講得很仔細，是很好的入門點');
  await step(tok);                                   // 14:07 C++ 是 C 的延伸
  const cz = ghostBox(AB, 6.2, 1.4, 4.2); cz.position.set(-2.7, 0.7, 0);
  tag('C', 'ptr', -5.2, 1.9, -1.6);
  const feats = ['if', 'for', 'while', 'struct', 'pointer', 'function', 'array', 'malloc'];
  const fc = feats.map((f, i) => cube(f, AB, [1.2, 0.5, 1.0], -4.8 + (i % 4) * 1.4, 0.25, -0.9 + Math.floor(i / 4) * 1.8, 3));
  const pz = ghostBox(AO, 11.8, 1.8, 4.8); pz.position.set(0.4, 0.9, 0);
  tag('C++', 'ptr alt', 5.4, 2.2, -1.8);
  say('C++：C 的延伸版本', '大框是 C++，裡面包著 C');
  await step(tok);                                   // 14:28 不是百分之百向後相容
  const ex = cube('少數例外', RED, [1.3, 0.5, 1.0], -6.3, 0.25, 0, 3); glow(ex, RED);
  say('但不是百分之百相容', '全部用 C 寫，在 C++ 不一定會過');
  await step(tok);                                   // 14:44 交集約九成
  glow(ex, null);
  say('兩者交集約占 C 的九成', '其他很多東西是 C++ 另外加上去的');
  await step(tok);                                   // 14:58 if、for 通通都有
  fc.forEach((m) => glow(m, GREEN));
  say('C 熟悉的 if、for… C++ 通通都有', '要講的是「好用的不一樣」');
}]);

// 15:29 C 的 swap：透過指標
FRAG.push(['arrlin-swap-ptr', 'C 的 swap：透過指標交換', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.8, 0]);
  await step(tok);                                   // 15:29 reference ↔ C 的 pointer
  say('第一個好用的不一樣：reference', '它對應到 C 裡面的 pointer');
  await step(tok);                                   // 15:56 交換兩個整數變數
  const cd = code(['void swap(int *pa, int *pb) {', '  int temp = *pa;', '  *pa = *pb;', '  *pb = temp;', '}', 'swap(&x, &y);'], 0, 6.6, 0.52, -2.4);
  tag('x', 'ptr', -4, 1.4, -1); tag('y', 'ptr', 4, 1.4, -1);
  const X = cube(3, AB, SZ, -4, 0.4, -1, 3), Y = cube(7, AP, SZ, 4, 0.4, -1, 3);
  say('C：寫一段程式交換兩個整數變數', 'x = 3、y = 7（數值為示意）');
  await step(tok);                                   // 16:07 傳進兩個位置、一個暫存變數
  cd.hl(0);
  tag('位置 156', 'idx', -4, 0, 0); tag('位置 678', 'idx', 4, 0, 0);
  const pa = cube('156', AS, [1.0, 0.6, 1.0], -2, 0.3, 2.4, 3), pb = cube('678', AS, [1.0, 0.6, 1.0], 2, 0.3, 2.4, 3);
  tag('pa', 'idx', -2, 0, 3.3); tag('pb', 'idx', 2, 0, 3.3);
  arrow(V3(-2.2, 0.7, 1.9), V3(-3.7, 0.7, -0.4)); arrow(V3(2.2, 0.7, 1.9), V3(3.7, 0.7, -0.4));
  say('傳進來的是兩個「位置」', 'pa = 156、pb = 678');
  await step(tok);                                   // 16:24 PA 的內容轉到 TEMP
  cd.hl(1);
  const T = cube(3, AB, [1.0, 0.6, 1.0], 0, 0.3, 0.8, 3); tag('temp', 'idx', 0, 0, 1.7);
  glow(X, GOLD);
  say('temp = *pa：到 156 號拿出內容', 'temp = 3');
  await step(tok);                                   // 16:46 PB 搬到 PA，再把 TEMP 放進 PB
  glow(X, null); cd.hl(2); glow(Y, GOLD); relabel(X, 7); tint(X, AP);
  say('*pa = *pb：678 號的內容搬到 156 號', 'x = 7');
  await beat(tok, 1400);
  glow(Y, null); cd.hl(3); glow(T, GOLD); relabel(Y, 3); tint(Y, AB);
  say('*pb = temp：把 temp 放進 678 號', 'y = 3');
  await step(tok);                                   // 17:43 腦袋要轉好幾轉
  glow(T, null); cd.hl(-1);
  say('換成功了，但腦袋要轉好幾轉', 'pointer 常讓程式設計師害怕');
  await step(tok);                                   // 18:19 把 x、y 的位置送進去
  cd.hl(5); glow(X, GREEN); glow(Y, GREEN); glow(pa, GOLD); glow(pb, GOLD);
  say('呼叫時要把 x、y 的位置送進去', 'swap(&x, &y)：透過位置間接操作');
}]);

// 19:07 C++ reference：變數的暱稱
FRAG.push(['arrlin-swap-ref', 'C++ reference：變數的暱稱', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.8, 0]);
  tag('x', 'ptr', -4, 1.4, -1); tag('y', 'ptr', 4, 1.4, -1);
  const X = cube(3, AB, SZ, -4, 0.4, -1, 3), Y = cube(7, AP, SZ, 4, 0.4, -1, 3);
  const REF = ['void swap(int &a, int &b) {', '  int t = a; a = b; b = t;', '}', 'swap(x, y);'];
  let cd = null;
  await step(tok);                                   // 19:12 參數前加 &
  cd = code(REF, 0, 6.4, 0.52, -2.4); cd.hl(0);
  say('C++：參數前加一個 &', '和 C 的「取位置」是同一個符號');
  await step(tok);                                   // 19:31 不是指標了，是 a、b 本身
  say('拿掉 p：傳進來的不是指標', '可以想成就是 x、y 本身');
  await step(tok);                                   // 19:52 典型的交換，swap(x, y)
  cd.hl(1);
  await beat(tok, 900);
  cd.hl(3);
  say('裡面寫典型的交換程式', '呼叫時直接 swap(x, y)，不用 &x、&y');
  await step(tok);                                   // 20:27 為什麼以前要用指標？
  cd.kill();
  cd = code(['void swap(int a, int b) {', '  int t = a; a = b; b = t;', '}', 'swap(x, y);'], 0, 6.4, 0.52, -2.4);
  cd.hl(0);
  say('回想：以前為什麼一定要用指標？', '如果寫成 void swap(int a, int b)…');
  await step(tok);                                   // 20:45 C 是 call by value
  say('C 是 call by value', '傳進去的是「值」');
  await step(tok);                                   // 20:56 x 的值複製到 a、y 到 b
  cd.hl(3);
  const A = cube(3, AB, [1.0, 0.6, 1.0], -2, 0.3, 2.4, 3), B = cube(7, AP, [1.0, 0.6, 1.0], 2, 0.3, 2.4, 3);
  const la = tag('a（影印本）', 'idx', -2, 0, 3.4), lb = tag('b（影印本）', 'idx', 2, 0, 3.4);
  say('x 的值複製給 a、y 的值複製給 b', '像用影印機各印一份');
  await step(tok);                                   // 21:09 拿影印本來交換
  cd.hl(1); move(A, 2, 0.3, 2.4); move(B, -2, 0.3, 2.4);
  say('函式裡交換的是影印本', 'a = 7、b = 3');
  await step(tok);                                   // 21:18 原稿沒有換到
  glow(X, RED); glow(Y, RED); cd.hl(-1);
  say('原稿沒有換到！', 'x 還是 3、y 還是 7');
  await step(tok);                                   // 21:37 C++ 的 & 讓它不再是影印本
  fly(A); fly(B); kill(la); kill(lb); glow(X, null); glow(Y, null); cd.kill();
  cd = code(REF, 0, 6.4, 0.52, -2.4); cd.hl(0);
  say('C++：加了 &，a 就不再是影印本', '');
  await step(tok);                                   // 21:58 nickname 暱稱
  tag('暱稱 a', 'ptr alt', -4, 2.2, -1); tag('暱稱 b', 'ptr alt', 4, 2.2, -1);
  say('a 只是原稿 x 的暱稱（nickname）', 'b 是 y 的暱稱');
  await step(tok);                                   // 22:07 交換 a、b 就是交換 x、y
  cd.hl(1); move(X, 4, 0.4, -1); move(Y, -4, 0.4, -1);
  await beat(tok, 900);
  glow(X, GREEN); glow(Y, GREEN);
  say('交換 a、b 就是交換 x、y 本身', 'x = 7、y = 3');
  await step(tok);                                   // 22:25 這叫 Reference
  cd.hl(0);
  say('這種帶 & 的東西，C++ 叫做 Reference', '');
  await step(tok);                                   // 22:39 compiler 換成指標
  cd.hl(-1);
  say('背後：compiler 偷偷把暱稱換成指標', '其實還是在對指標做操作');
  await step(tok);                                   // 22:54 156 張紙、678 張紙
  tag('背後：&x = 156', 'idx', -4, 0, 0.3); tag('背後：&y = 678', 'idx', 4, 0, 0.3);
  say('以前要自己記：x 在第 156 張紙、y 在第 678 張紙', '現在這份麻煩交給 compiler');
  await step(tok);                                   // 23:42 比較聰明、比較安全的 pointer
  say('Reference：比較聰明、比較安全的 pointer', '還有型別檢查等機制，比較不容易寫錯');
}]);

// 27:55 struct：資料綁在一起，函式寫在外面
FRAG.push(['arrlin-struct-func', 'struct：資料綁在一起', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2, 0]);
  await step(tok);                                   // 27:55 structure 跟 class
  say('下一個不一樣：structure 與 class', '');
  await step(tok);                                   // 28:48 real、imag 綁在一起
  const cd = code(['struct Complex { double real, imag; };', '', 'Complex multiply(Complex a, Complex b) {', '  Complex result;', '  result.real = a.real*b.real - a.imag*b.imag;', '  result.imag = a.real*b.imag + a.imag*b.real;', '  return result;', '}'], 0, 7.2, 0.5, -2.6);
  cd.hl(0);
  const A = alComplex('a', 1, 2, -4.5, 1.6, AB, true);
  say('struct：把 real、imag 綁成一個新型態', '複數 a = 1 + 2i（數值為示意）');
  await step(tok);                                   // 29:24 綁在一起，操作比較完整
  glow(A.r, GOLD); glow(A.i, GOLD);
  say('綁在一起，對這組變數的操作比較完整', '不會只改了 real 卻忘了 imag');
  await step(tok);                                   // 29:57 C++ 對應的是 class，public
  glow(A.r, null); glow(A.i, null);
  tag('C++ 對應：class（public：大家都能 access）', 'ptr alt', -2.8, 3.0, 1.6);
  say('C++ 對應的叫 class', '變數有權限觀念；public = 所有程式都能 access');
  await step(tok);                                   // 31:14 複數乘法 multiply
  cd.hl(2);
  const B = alComplex('b', 3, 4, -1.2, 1.6, AP, true);
  tag('函式寫在 struct 之外', 'ptr alt', 3.4, 2.6, 1.6);
  say('C：複數乘法是一段寫在「外面」的函式', 'multiply(a, b)');
  await step(tok);                                   // 31:52 先建一個 result
  cd.hl(3);
  const R = alComplex('result', '?', '?', 3.4, 1.6, AO, true);
  say('先建立一個複數變數 result', '');
  await step(tok);                                   // 32:04 result.real = …
  cd.hl(4); [A.r, B.r, A.i, B.i].forEach((m) => glow(m, GOLD)); relabel(R.r, -5);
  say('result.real = 1×3 − 2×4', '= −5');
  await step(tok);                                   // 32:21 imag 的部分
  cd.hl(5); relabel(R.i, 10);
  say('result.imag = 1×4 + 2×3', '= 10');
  await step(tok);                                   // 32:33 把結果放回去，在 structure 之外
  [A.r, B.r, A.i, B.i].forEach((m) => glow(m, null)); glow(R.r, GREEN); glow(R.i, GREEN); cd.hl(6);
  say('把結果回傳：a × b = −5 + 10i', '這段程式在 structure 之外');
  await step(tok);                                   // 32:49 額外的程式操作藍圖
  cd.hl(-1);
  say('資料的藍圖與操作分開寫', '一段額外的程式，拿來操作定義好的資料');
}]);

// 33:07 class：資料 + 動作綁在一起
FRAG.push(['arrlin-class-method', 'class：資料與動作綁在一起', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2.2, 0]);
  const cd = code(['class Complex {', 'public:', '  double real, imag;', '  void multiplyBy(Complex b) {', '    double r = real*b.real - imag*b.imag;', '    imag = real*b.imag + imag*b.real;', '    real = r;', '  }', '};', 'a.multiplyBy(b);'], 0, 7.6, 0.48, -3);
  const g = ghostBox(AB, 4.6, 1.2, 1.6); g.position.set(-2.6, 0.55, 1.6);
  cd.hl(2);
  const r = cube(1, AB, [1.0, 0.7, 1.0], -4.1, 0.35, 1.6, 3), im = cube(2, AB, [1.0, 0.7, 1.0], -2.9, 0.35, 1.6, 3);
  tag('real', 'idx', -4.1, 0, 2.5); tag('imag', 'idx', -2.9, 0, 2.5);
  const an = tag('a', 'ptr', -2.6, 1.6, 1.6);
  await step(tok);                                   // 33:10 class 之內的程式
  cd.hl(3);
  const act = cube('multiplyBy', AO, [1.7, 0.5, 1.0], -1.2, 0.25, 1.6, 3); tag('動作', 'idx', -1.2, 0, 2.5);
  say('class 最大差別：可以把程式寫在 class 之內', '動作和資料住在一起');
  await step(tok);                                   // 33:24 multiplyBy 另一個 complex
  const B = alComplex('b', 3, 4, 3.4, 1.6, AP, true);
  say('例如 multiplyBy(另一個 complex)', 'a = 1 + 2i、b = 3 + 4i（數值為示意）');
  await step(tok);                                   // 33:54 自己這組去乘另一組
  cd.hl(9);
  const msg = cube('b', AP, [0.6, 0.4, 0.6], 3.4, 2.2, 1.6); move(msg, -1.2, 1.1, 1.6);
  say('自己原來那組複數，去乘另一組', 'a.multiplyBy(b)');
  await step(tok);                                   // 34:04 real 要變成…
  kill(msg); glow(act, GOLD);
  cd.hl(4); glow(r, GOLD);
  say('先算新的 real：1×3 − 2×4 = −5', '暫存在 r，免得 real 被先改掉');
  await beat(tok, 1000);
  cd.hl(5); relabel(im, 10); glow(im, GOLD);
  await beat(tok, 900);
  cd.hl(6); relabel(r, -5);
  say('imag = 1×4 + 2×3 = 10，再 real = r', 'a 變成 −5 + 10i');
  await step(tok);                                   // 34:25 這組東西叫物件
  glow(act, null); glow(r, null); glow(im, null); cd.hl(-1);
  txt(an, '物件 a'); alHi(g, true);
  say('這組已經存在的東西，C++ 叫「物件」', '對它送一個指令，用它身上定義好的動作');
  await step(tok);                                   // 34:44 動作改變物件的內部狀態
  alHi(g, false); glow(r, GREEN); glow(im, GREEN);
  say('動作改變了物件的內部狀態', 'real、imag 改變了');
  await step(tok);                                   // 35:13 C 比較鬆散，class 語意明確
  say('C 的寫法比較鬆散', 'class 把資料與動作綁起來：語意明確、比較好讀');
  await step(tok);                                   // 36:04 樂高積木
  for (let k = 0; k < 3; k++) cube('', [AK, AT, AG][k], [1.2, 0.6, 1.2], 6.0, 0.3 + k * 0.62, -0.6, 4);
  say('物件導向：每個物件像一塊樂高積木', '有自己的資料、有自己的動作，再拼成大軟體');
  await step(tok);                                   // 37:17 相關函式可以選擇寫進 class
  say('C++ 還是可以寫一般的函式', '和物件相關的，可以選擇寫進 class 裡');
}]);

// 37:52 operator overloading：c = a + b
FRAG.push(['arrlin-op-overload', 'Operator Overloading', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 2, 0]);
  const st = tag('', 'ptr alt', 0, 4.4, 0);
  await step(tok);                                   // 37:53 c = a + b（數字）
  txt(st, 'int a, b, c;   c = a + b;');
  say('c = a + b：a、b、c 是數字時', '語意大家都很清楚');
  await step(tok);                                   // 38:19 如果是複數
  const A = alComplex('a', 1, 2, -4.5, 1.6, AB, true), B = alComplex('b', 3, 4, -1.2, 1.6, AP, true);
  txt(st, 'Complex a, b, c;');
  say('如果 a、b、c 是剛才定義的複數呢？', '（數值為示意）');
  await step(tok);                                   // 38:38 C 只能寫 c = plus(a, b)
  txt(st, 'C：c = plus(a, b);');
  const cd = code(['Complex plus(Complex a, Complex b) {', '  Complex c;  c.real = a.real + b.real;', '  c.imag = a.imag + b.imag;  return c;', '}'], 0, 7.0, 0.5, -2.6);
  cd.hl(0);
  say('在 C 只能寫 c = plus(a, b)', '要另外寫一個函式');
  await step(tok);                                   // 38:50 實數加實數、虛數加虛數
  const C = alComplex('c', '?', '?', 3.4, 1.6, AO, true);
  cd.hl(1); glow(A.r, GOLD); glow(B.r, GOLD); relabel(C.r, 4);
  await beat(tok, 1100);
  glow(A.r, null); glow(B.r, null);
  cd.hl(2); glow(A.i, GOLD); glow(B.i, GOLD); relabel(C.i, 6);
  say('實部加實部、虛部加虛部', '1 + 3 = 4、2 + 4 = 6 → c = 4 + 6i');
  await step(tok);                                   // 39:10 C++：也可以寫 c = a + b
  glow(A.i, null); glow(B.i, null); cd.hl(-1); glow(C.r, GREEN); glow(C.i, GREEN);
  txt(st, 'C++：Complex a, b, c;   c = a + b;');
  say('C++：複數也可以直接寫 c = a + b', '怎麼做到的？');
  await step(tok);                                   // 39:33 運算符號和函式是同一回事
  say('運算符號和函式其實是同一回事', '只是 int 有內建好的 plus');
  await step(tok);                                   // 40:06 compiler 本來就知道 int 怎麼加
  say('兩個 int 相加：compiler 本來就會', '可能只是一條機器指令');
  await step(tok);                                   // 40:43 compiler 先翻譯成函式呼叫
  txt(st, 'c = a + b;  →  c = plus(a, b);');
  say('C++ compiler 看到 c = a + b', '先把它翻譯成函式呼叫');
  await step(tok);                                   // 41:16 名字叫 operator+
  txt(st, 'c = a + b;  →  c = operator+(a, b);');
  txt(cd.ls[0], 'Complex operator+(Complex a, Complex b) {');
  say('翻譯後的名字不叫 plus，叫 operator+', '');
  await step(tok);                                   // 41:47 你只要把 operator+ 寫好
  cd.hl(0);
  say('你只要把 operator+ 寫好', 'compiler 就知道要呼叫哪段程式');
  await step(tok);                                   // 42:19 也有 a.operator+(b) 的版本
  cd.hl(-1);
  txt(st, '也可以翻成成員函式：c = a.operator+(b);');
  say('也有另一種翻譯：a.operator+(b)', '呼叫 class 裡寫好的動作');
  await step(tok);                                   // 43:32 compiler 依型別判斷
  say('compiler 依你的型別判斷要用哪段程式', '自訂型別也能用 +');
}]);

// 43:45 作業一：GCD 從 int 改成大數
FRAG.push(['arrlin-gcd-bigint', '只換型別：int → 大數', async (tok) => {
  fresh([0, 6.5, 12], [0, 2.6, 0]);
  const L = ['int gcd(int a, int b) {', '  while (b != 0) {', '    int r = a % b;', '    a = b;  b = r;', '  }', '  return a;', '}'];
  let cd = null;
  await step(tok);                                   // 43:50 作業一：兩個版本的最大公因數
  cd = code(L, -2.2, 6.2, 0.56, -1);
  tag('（以輾轉相除示意）', 'idx', -2.2, 6.9, -1);
  say('作業一：最大公因數要寫兩個版本', '');
  await step(tok);                                   // 44:11 正整數版、大數版
  tag('大數：位數比 int 能存的大很多', 'ptr', 3.6, 5.6, -1);
  say('一個對正整數、一個對大數', '大數：比一般整數能存的大很多');
  await step(tok);                                   // 44:27 選擇一：砍掉重練
  say('選擇一：砍掉重練', '每個加減乘除都改成大數運算重寫');
  await step(tok);                                   // 44:45 大數加法要跑迴圈
  say('大數做一次加法', '可能就要跑迴圈，把好幾個位數加起來');
  await step(tok);                                   // 44:52 選擇二：定義 operator
  const ops = [['operator!=', 1], ['operator%', 2], ['operator=', 3]];
  for (let k = 0; k < ops.length; k++) {
    cd.hl(ops[k][1]);
    cube(ops[k][0], AO, [2.6, 0.5, 1.0], 3.8, 0.25, 0.6 + k * 1.2, 3);
    await beat(tok, 600);
  }
  cd.hl(-1);
  say('選擇二：把大數需要的運算子定義好', 'operator!=、operator%、operator=');
  await step(tok);                                   // 45:09 GCD 主程式完全不用改
  say('原來的 GCD 主程式完全不用改', '');
  await step(tok);                                   // 45:18 只把型別換成大數
  const L2 = L.map((s) => s.replace(/\bint\b/g, 'BigInt'));
  const w = Math.max(...L2.map((s) => s.length));
  for (let i = 0; i < L.length; i++) {
    if (L2[i] !== L[i]) { cd.hl(i); cd.ls.forEach((l, k) => txt(l, (k <= i ? L2[k] : L[k]).padEnd(w, ' '))); await beat(tok, 900); }
  }
  cd.ls.forEach((l, k) => txt(l, L2[k].padEnd(w, ' '))); cd.hl(-1);
  say('只要把型別 int 換成大數', 'int → BigInt');
  await step(tok);                                   // 45:28 compiler 幫你決定呼叫哪個
  say('到底要呼叫哪個函式', 'compiler 都幫你處理掉');
  await step(tok);                                   // 45:42 Operator Overloading
  say('這就是 Operator Overloading', '同一個運算子，在不同型別上重新定義');
}]);

// 51:24 跨型態：copy、paste、replace
FRAG.push(['arrlin-copy-paste', 'copy、paste、replace', async (tok) => {
  fresh([0, 7.5, 13], [0, 2.2, 0]);
  const rows = [['int arr[10]', 10, AB], ['double arr[10]', 10, AP], ['Complex arr[4]', 4, AO]];
  const showRow = (r) => {
    const [nm, n, c] = rows[r];
    tag(nm, 'ptr', -5.4, 0.9, 1.0 + r * 1.3);
    for (let k = 0; k < n; k++) cube('', c, [0.6, 0.4, 0.6], -3.6 + k * 0.75, 0.2, 1.0 + r * 1.3, 2);
  };
  await step(tok);                                   // 51:24 資料結構常常跨型態
  say('資料結構：把一堆資料放在一起', '很多結構是「跨型態」存在的');
  await step(tok);                                   // 51:48 int array 10 個
  showRow(0); say('一個 int array：10 個 element', '');
  await step(tok);                                   // 51:53 double array 10 個
  showRow(1); say('一個 double array：10 個 element', '');
  await step(tok);                                   // 52:01 複數 array 4 個
  showRow(2); say('一個複數 array：4 個 element', '');
  await step(tok);                                   // 52:10 三行意義差不多
  say('三行意義都差不多', '只是元素的型態不同');
  await step(tok);                                   // 52:39 sort 一個 int array
  const A = code(['void intSort(int arr[], int n) {', '  for (int i = 0; i < n; i++) …', '}'], 0, 7.4, 0.5, -2.6);
  say('C：要 sort 一個 int array', '寫一段 intSort');
  await step(tok);                                   // 53:03 double 再寫一段 doubleSort
  say('要 sort double array？', '再寫一段 doubleSort……每種型態各一段');
  await step(tok);                                   // 54:01 copy paste replace
  const B = code(['void intSort(int arr[], int n) {', '  for (int i = 0; i < n; i++) …', '}'], 0, 5.3, 0.5, -2.6);
  say('偷懶的大絕招：copy、paste……', '先把寫好、測好的 intSort 複製一份');
  await step(tok);                                   // 54:19 int 都換成 double
  const B2 = ['void doubleSort(double arr[], double n) {', '  for (double i = 0; i < n; i++) …', '}'];
  const w = Math.max(...B2.map((s) => s.length));
  B.ls.forEach((l, k) => txt(l, B2[k].padEnd(w, ' ')));
  say('……replace：看到 int 就換成 double', '');
  await step(tok);                                   // 54:40 迴圈 index 也被換掉
  B.hl(1); B.ls[1].element.className = 'lab-label ptr';
  say('小心！連迴圈 index 的 int 也被換掉了', 'for (double i …) 不是我們要的');
  await step(tok);                                   // 55:08 reuse 的第一個做法
  B.hl(-1); A.hl(-1);
  say('copy-paste-replace', '傳統上 reuse 的第一個做法');
}]);

// 55:23 template 與 STL
FRAG.push(['arrlin-template', 'template：程式碼的範本', async (tok) => {
  fresh([0, 7.5, 13], [0, 2.2, 0]);
  let cd = null;
  await step(tok);                                   // 55:23 template：型別暫時未定
  cd = code(['template <class T>', 'void sort(T arr[], int n) {', '  … if (arr[j] < arr[i]) swap …', '}'], 0, 7.4, 0.5, -2.6);
  cd.hl(0);
  say('C++ 的 template：型別暫時還沒定的程式碼', '');
  await step(tok);                                   // 55:52 型別通常叫 T
  cd.hl(1);
  say('未定的型別通常叫 T', '未來可以是 int、double、Complex……');
  await step(tok);                                   // 56:44 範本 = 空白表格
  cd.hl(-1);
  tag('範本 = 空白表格', 'ptr alt', 0, 5.0, -2.6);
  say('template 就是範本', '像去辦事情拿到的空白表格');
  await step(tok);                                   // 56:52 程式裡出現 int array 的 sort
  tag('sort(intArr, 10)', 'ptr', -3.8, 2.8, 0.6);
  say('程式要 sort 一個 int array', 'compiler 找不到 int 版本，最接近的是範本');
  await step(tok);                                   // 57:15 印一份，T 換成 int
  cube('sort（T = int）', AB, [3.2, 0.5, 1.2], -3.8, 0.25, 1.6, 4);
  say('把範本印一份，T 全部換成 int', 'compiler 幫你做 copy、paste、replace');
  await step(tok);                                   // 57:33 Complex array 也一樣
  tag('sort(cArr, 4)', 'ptr', 3.8, 2.8, 0.6);
  const s2 = cube('sort（T = Complex）', AO, [3.2, 0.5, 1.2], 3.8, 0.25, 1.6, 4);
  say('Complex array 也一樣：T → Complex', '');
  await step(tok);                                   // 58:04 比較大小的程式在哪裡
  glow(s2, GOLD); cd.hl(2);
  say('sort 要比較兩個東西的大小', '要找得到 Complex 的比較 operator');
  await step(tok);                                   // 59:01 STL
  cd.hl(-1); glow(s2, null);
  tag('STL = Standard Template Library', 'ptr alt', 0, 1.4, 4.0);
  say('集大成的 template：STL', 'Standard Template Library');
  await step(tok);                                   // 59:18 STL 寫好、任何型別都能用
  const lib = ['vector', 'list', 'stack', 'queue', 'sort'];
  for (let k = 0; k < lib.length; k++) { cube(lib[k], AT, [1.6, 0.45, 0.9], -4 + k * 2, 0.22, 4.0, 3); await beat(tok, 250); }
  say('很多資料結構 STL 已經寫好', '而且可以用在任何型別上');
  await step(tok);                                   // 60:25 寫一段 code 用在很多地方
  say('寫一段 template 的 code', '就能用在很多地方');
}]);

// 85:49 Array = 有編號的置物櫃
FRAG.push(['arrlin-locker', 'Array：有編號的置物櫃', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const X = (i) => -4.95 + i * 1.1;
  const lk = [];
  await step(tok);                                   // 85:50 為什麼還要學 array
  say('為什麼要學 array？C 不是學過了？', '');
  await step(tok);                                   // 86:12 用 data structure 的角度看
  say('重點不是語法', '而是用 data structure 的角度看 array');
  await step(tok);                                   // 87:14 一群 element 集合起來
  for (let i = 0; i < 10; i++) { lk.push(cube('', AS, [1.0, 1.6, 0.9], X(i), 0.8, 0, 3)); await beat(tok, 150); }
  say('Wikipedia：array 是一群 element 集合起來', '');
  await step(tok);                                   // 87:41 each identified by one array index
  for (let i = 0; i < 10; i++) tag(String(i), 'idx', X(i), 1.25, 0.5);
  say('關鍵是後半句', 'each identified by one array index');
  await step(tok);                                   // 88:20 系館地下室的置物櫃
  say('Array 就像系館地下室的置物櫃', '');
  await step(tok);                                   // 88:44 理想世界：每人一個，號碼連續
  say('理想世界：每人一個櫃子', '號碼連續：0 號、1 號、2 號……');
  await step(tok);                                   // 89:27 放東西進去
  const it = cube('書', AO, [0.6, 0.5, 0.6], X(3), 4, 1.6);
  glow(lk[3], GOLD);
  move(it, X(3), 0.5, 0.2);
  say('靠編號找到 3 號櫃子，放東西進去', 'arr[3] = 書');
  await step(tok);                                   // 89:34 拿出來；辨別靠編號
  move(it, X(3), 0.5, 2.2);
  say('也可以把東西拿出來', 'x = arr[3]');
  await step(tok);                                   // 89:50 有編號的櫃子 = array
  glow(lk[3], null);
  say('有編號的櫃子 = array', '放進去、拿出來，都靠編號');
}]);

// 90:13 記憶體是最大的 array；pointer 只是編號
FRAG.push(['arrlin-memory-pointer', '記憶體是最大的 array', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.25 + i * 1.5;
  const cs = [];
  await step(tok);                                   // 90:15 最大的 array：記憶體
  for (let i = 0; i < 8; i++) { cs.push(cube('–', AS, [1.3, 0.6, 1.3], X(i), 0.3, 0, 2)); tag('0' + i, 'idx', X(i), 0, 1.1); }
  tag('…', 'idx', 6.6, 0.3, 0);
  say('電腦裡最大、最重要的 array：記憶體', '');
  await step(tok);                                   // 90:34 宣告變數 = 劃出一塊位置，取名字
  tag('b', 'ptr', X(4), 1.4, 0); glow(cs[4], GOLD);
  say('宣告變數：劃出一塊記憶體位置，取個名字', '例如變數 b 在 04 號');
  await step(tok);                                   // 91:44 編號叫 address
  glow(cs[4], null);
  say('記憶體的編號叫 address', 'address 就是 array 的 index');
  await step(tok);                                   // 92:27 4 bytes → 2^32 個編號
  say('例如 address 有 4 bytes = 32 bits', '編號有 2³² 個：一個超大的 array');
  await step(tok);                                   // 93:18 某處放一個 pointer，寫著 01
  relabel(cs[1], '寶'); tint(cs[1], AO);
  relabel(cs[4], '01'); tint(cs[4], AB);
  say('某處放一個 pointer：上面寫著 01', '');
  await step(tok);                                   // 93:45 pointer 只是把 index 存下來
  say('pointer 只是把 index 存下來', '像一張小紙條：「請到 01 號找」');
  await step(tok);                                   // 94:02 大地遊戲：下一關去 01 號
  const rg = alRing(X(4), 0.05, 0, 0.8);
  const ar = arrow(V3(X(4), 1.0, 0), V3(X(1), 1.0, 0), 0xc08a1f);
  await anim(tok, 900, (t) => { rg.position.x = X(4) + (X(1) - X(4)) * t; });
  glow(cs[1], GOLD);
  say('像大地遊戲：照紙條去 01 號', '打開，拿出內容');
  await step(tok);                                   // 94:27 尋寶遊戲
  kill(ar); glow(cs[1], null);
  relabel(cs[3], '06'); tint(cs[3], AB); relabel(cs[6], '01'); tint(cs[6], AB);
  rg.position.x = X(3); glow(cs[3], GOLD);
  say('尋寶遊戲：櫃子裡放下一個櫃子的編號', '從 03 號出發');
  await step(tok);                                   // 94:34 去下一個櫃子找
  await anim(tok, 700, (t) => { rg.position.x = X(3) + (X(6) - X(3)) * t; });
  glow(cs[3], null); glow(cs[6], GOLD);
  say('03 號寫著 06：去 06 號', '');
  await step(tok);                                   // 94:48 下一個還是 pointer，就再去下一個
  await anim(tok, 900, (t) => { rg.position.x = X(6) + (X(1) - X(6)) * t; });
  glow(cs[6], null); glow(cs[1], GREEN);
  say('06 號又是 pointer：寫著 01', '再去 01 號 → 找到寶物！');
  await step(tok);                                   // 96:51 pointer = 位置 = array 編號
  say('pointer 本質：記憶體位置', '記憶體位置就是 array 的編號，沒什麼好怕');
  await step(tok);                                   // 97:11 不要開成別人的櫃子
  glow(cs[7], RED);
  say('只要編號是對的就好', '小心別開到別人的櫃子、寫入不該寫的地方');
}]);

// 97:47 array = 一塊連續記憶體：Fast Random Access
FRAG.push(['arrlin-block-address', 'Array 的位置怎麼算', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.85 + i * 0.9;
  const cs = [];
  let gb = null, rg = null;
  await step(tok);                                   // 97:47 array 是大記憶體裡的一小段
  for (let i = 0; i < 14; i++) { cs.push(cube('–', GRAY, [0.8, 0.5, 0.8], X(i), 0.25, 0, 2)); tag(String(5563 + i), 'idx', X(i), 0, i % 2 ? 1.5 : 0.9); }
  say('記憶體：一大片編好號的田', 'array 只是其中的一小段');
  await step(tok);                                   // 97:53 劃起來 10 個小段
  gb = ghostBox(AB, 9, 0.9, 1.1); gb.position.set(X(7.5), 0.45, 0);
  for (let k = 0; k < 10; k++) { tint(cs[3 + k], AB); tag('[' + k + ']', 'idx', X(3 + k), 1.0, -0.6); }
  say('只需要 10 個空間：劃出連續的 10 格', 'memory block');
  await step(tok);                                   // 98:18 要到 3 號櫃子拿東西
  rg = alRing(X(3), 0.05, 0, 0.5); glow(cs[3], GOLD);
  say('要到 3 號櫃子拿東西', '從 0 號櫃子出發');
  await step(tok);                                   // 98:34 3 號在 0 號旁邊第三個
  glow(cs[3], null);
  await alSlide(tok, rg, X(3), X(6), 800);
  glow(cs[6], GOLD);
  say('3 號就在 0 號旁邊第 3 格', '一步算出來');
  await step(tok);                                   // 99:11 30 號在 0 號旁邊 30 格
  glow(cs[6], null);
  say('要 30 號？就在 0 號旁邊 30 格', '只要知道 0 號在哪裡');
  await step(tok);                                   // 99:40 一格多大看型別
  say('一格多大看型別', 'int 可能 4 bytes、double 更大、char 更小');
  await step(tok);                                   // 100:13 arr 隱含第 0 格的位置
  rg.position.x = X(3);
  tag('arr = 5566', 'ptr', X(3), 1.8, 0);
  say('arr 隱含的是第 0 格的位置', '第 0 格在第 5566 號田');
  await step(tok);                                   // 100:37 5566、5567、5568 連續下來；拿東西變容易
  await alSlide(tok, rg, X(3), X(6), 800);
  glow(cs[6], GOLD);
  say('後面 5567、5568…一路連續', 'arr[3] → 5566 + 3 = 5569');
  await step(tok);                                   // 100:46 放進去 = 開櫃子更新內容
  relabel(cs[6], '★'); tint(cs[6], AO);
  say('放進去：開櫃子、更新裡面的內容', 'arr[3] = ★');
  await step(tok);                                   // 101:00 get 與 update
  glow(cs[6], null);
  say('看 data structure 的兩部分', '取用：get；維護：update——都很簡單');
  await step(tok);                                   // 101:54 construct：malloc
  alHi(gb, true);
  say('construct：劃一塊連續記憶體', 'C 用 malloc（memory allocation）');
  await step(tok);                                   // 103:01 Fast Random Access
  alHi(gb, false);
  await alSlide(tok, rg, X(6), X(12), 700);
  glow(cs[12], GOLD);
  say('Fast Random Access：random = 任意', 'arr[9] → 5566 + 9 = 5575，一樣快');
  await step(tok);                                   // 103:18 RAM
  say('RAM = Random Access Memory', '只要算出位置，就能很快放進、拿出');
}]);

// 103:58 Array ADT：get / update / construct，insert / remove 很吃力
FRAG.push(['arrlin-insert-remove', 'Array 的 insert 與 remove', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.6, 0]);
  const X = (i) => -5.5 + i * 1.1;
  for (let i = 0; i < 10; i++) { cube('', GRAY, [1.0, 0.08, 1.0], X(i), 0.04, 0); tag('[' + i + ']', 'idx', X(i), 0, 0.9); }
  const arr = 'abcdefghij'.split('').map((c, i) => cube(c, AB, [0.85, 0.6, 0.85], X(i), 0.38, 0, 2));
  await step(tok);                                   // 103:58 get / update by index
  glow(arr[2], GOLD);
  say('get by index、update by index', '快速的數學算出記憶體位置');
  await step(tok);                                   // 104:13 construct
  glow(arr[2], null);
  say('construct：allocate 一塊記憶體', '說好「其他人不能用」');
  await step(tok);                                   // 104:35 insert / remove by index
  say('比較有趣的兩個', 'insert by index、remove by index');
  await step(tok);                                   // 104:50 插進去要推開別人；移掉要排緊
  say('insert：把其他人推開，插進去', 'remove：移掉以後，隊伍要排緊');
  await step(tok);                                   // 105:18 記憶體要大一格
  cube('', GRAY, [1.0, 0.08, 1.0], X(10), 0.04, 0, 2); tag('[10]', 'idx', X(10), 0, 0.9);
  say('insert：記憶體先要大一格', '');
  await step(tok);                                   // 105:33 塞到第 3 個位置，後面往後推
  for (let i = 9; i >= 3; i--) { move(arr[i], X(i + 1), 0.38, 0); await beat(tok, 230); }
  const nx = cube('X', AO, [0.85, 0.6, 0.85], X(3), 0.38, 0, 4);
  arr.splice(3, 0, nx);
  say('insert X 到 [3]：後面全部往後推', '搬了 7 個');
  await step(tok);                                   // 105:40 移掉之後往前補位
  fly(arr[5]); arr.splice(5, 1);
  await beat(tok, 500);
  for (let i = 5; i < arr.length; i++) { move(arr[i], X(i), 0.38, 0); await beat(tok, 250); }
  say('remove [5]：後面全部往前補位', '搬了 5 個');
  await step(tok);                                   // 105:49 都是比較吃力的運算
  say('這些都是比較吃力的運算', '要搬動一大串元素');
  await step(tok);                                   // 106:26 update = 放進去；insert = 塞進去
  say('update = 放進去；insert = 塞進去', '塞進去像胖子擠進去：把別人擠開');
  await step(tok);                                   // 106:49 原生 array：get、update、construct
  say('原生 array 最需要支援的', 'get、update（頂多再加 construct）');
}]);

// 107:05 STL vector：會自動長大的 array
FRAG.push(['arrlin-vector-grow', 'STL vector：會長大的 array', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0.4]);
  const XO = (i) => -4.95 + i * 1.1, XN = (i) => -5.7 + i * 0.6;
  const old = [];
  let vs = [], k = null;
  await step(tok);                                   // 107:05 STL 也有對應的 array
  for (let i = 0; i < 10; i++) { old.push(cube('', GRAY, [0.9, 0.08, 0.9], XO(i), 0.04, -1.6)); tag('[' + i + ']', 'idx', XO(i), 0, -0.8); }
  vs = 'abcdefghij'.split('').map((c, i) => cube(c, AB, [0.5, 0.45, 0.5], XO(i), 0.3, -1.6, 2));
  tag('vector（capacity 10）', 'ptr', 0, 1.4, -2.6);
  say('STL 裡也有對應的 array：vector', '');
  await step(tok);                                   // 107:21 get、update 一樣很快
  glow(vs[4], GOLD);
  say('get、update：概念和原生 array 相同', '一樣很快算出位置');
  await step(tok);                                   // 107:40 array 可以 grow
  glow(vs[4], null);
  say('多了一個概念：array 可以 grow', '會自己長大');
  await step(tok);                                   // 108:05 塞在最後面，已經滿了
  k = cube('k', AO, [0.5, 0.45, 0.5], 5.6, 2.6, -1.6);
  glow(k, RED);
  say('要塞到最後面，但已經滿了', '原本只 allocate 10 個');
  await step(tok);                                   // 108:14 自動延伸成 15 或 20
  glow(k, null);
  for (let i = 0; i < 20; i++) cube('', '#e9dcc4', [0.52, 0.08, 0.52], XN(i), 0.04, 1.8);
  tag('capacity 20', 'ptr alt', 0, 1.4, 2.8);
  for (let i = 0; i < 10; i++) { move(vs[i], XN(i), 0.3, 1.8); await beat(tok, 150); }
  old.forEach((t) => kill(t));
  say('自動配置更大的空間：10 → 20（或 15）', '舊的元素全部搬過去');
  await step(tok);                                   // 108:23 Automatic growing
  move(k, XN(10), 0.3, 1.8);
  say('再把新元素放進來', 'Automatic growing：size 11 / capacity 20');
  await step(tok);                                   // 108:57 vector：insert、remove 都有
  say('STL vector：完整的 array data structure', 'insert、remove 也都實作好了');
  await step(tok);                                   // 109:23 推薦去看 vector
  say('推薦去看 vector 提供哪些操作', '豐富你對 array as a data structure 的想像');
}]);

// 112:01 2D array：one block（row-major）
FRAG.push(['arrlin-2d-oneblock', '2D array：one block', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const GX = (j) => -2.4 + j * 1.2, GZ = (i) => -3.0 + i * 1.2, SX = (k) => -5.4 + k * 1.2;
  const L = [['A', 'B', 'C', 'D', 'E'], ['V', 'W', 'X', 'Y', 'Z']];
  const g = [], s = [];
  let rg = null;
  await step(tok);                                   // 112:01 剛才是 1D array
  say('剛才講的是 one-dimensional array', '從 index 很快算出 address');
  await step(tok);                                   // 112:48 two-dimensional array
  say('更 general 的例子', 'two-dimensional array');
  await step(tok);                                   // 112:55 圖片 1024 × 768
  say('最熟悉的 2D array：圖片', '例如 1024 × 768 個點');
  await step(tok);                                   // 113:22 2 × 5
  for (let i = 0; i < 2; i++) { tag('row ' + i, 'idx', -3.8, 0.2, GZ(i)); g.push(L[i].map((c, j) => cube(c, i ? AP : AB, [1.0, 0.6, 1.0], GX(j), 0.3, GZ(i), 3))); }
  for (let j = 0; j < 5; j++) tag('col ' + j, 'idx', GX(j), 0.9, -3.9);
  say('簡單一點：2 × 5', '2 個 row、5 個 column，共 10 格');
  await step(tok);                                   // 114:17 index 是一組座標
  glow(g[1][3], GOLD);
  say('index 變成一組 (row, column)', '像座標：[1][3]');
  await step(tok);                                   // 114:32 電腦裡只有 1D 的 memory
  glow(g[1][3], null);
  for (let k = 0; k < 10; k++) { cube('', '#e9dcc4', [1.0, 0.08, 1.0], SX(k), 0.04, 2.2); tag(String(k), 'idx', SX(k), 0, 3.1); }
  say('可是電腦裡只有 1D 的大記憶體', '怎麼實作？');
  await step(tok);                                   // 114:45 拉成一塊長長的記憶體
  for (let k = 0; k < 5; k++) { const m = cube(L[0][k], AB, [1.0, 0.6, 1.0], GX(k), 0.3, GZ(0)); move(m, SX(k), 0.3, 2.2); s.push(m); await beat(tok, 300); }
  say('實作一：拉成一塊長長的記憶體', '先放 row 0：A B C D E');
  await step(tok);                                   // 115:13 接著 X Y Z 一路下去
  for (let k = 0; k < 5; k++) { const m = cube(L[1][k], AP, [1.0, 0.6, 1.0], GX(k), 0.3, GZ(1)); move(m, SX(5 + k), 0.3, 2.2); s.push(m); await beat(tok, 300); }
  say('接著放 row 1：V W X Y Z', 'row 一個接一個（row-major）');
  await step(tok);                                   // 115:44 第 1 個 row 第 3 個 column
  rg = alRing(SX(0), 0.05, 2.2, 0.65);
  tag('arr', 'ptr', SX(0), 1.3, 2.2);
  glow(g[1][3], GOLD);
  say('要拿 [1][3]：從記憶體開頭 arr 出發', '');
  await step(tok);                                   // 116:10 row 1 的起始點
  await alSlide(tok, rg, SX(0), SX(5), 700);
  glow(s[5], GOLD);
  say('先算出 row 1 的起始點', 'arr + 1 × 5 = 第 5 格');
  await step(tok);                                   // 116:20 再走幾步
  glow(s[5], null);
  await alSlide(tok, rg, SX(5), SX(8), 700);
  glow(s[8], GREEN);
  say('再往後走 3 步', 'arr[1][3] → arr + (1 × 5 + 3) = 第 8 格');
  await step(tok);                                   // 116:34 construct 留一大塊；get 套式子
  say('construct：留一整塊 1D 記憶體', 'get：用式子算出位置');
  await step(tok);                                   // 116:58 update 也一樣
  say('update 也一樣', '快速的數學運算，算出放哪裡、從哪裡拿');
}]);

// 117:30 2D array：array of arrays
FRAG.push(['arrlin-2d-aoa', '2D array：array of arrays', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const RX = (j) => -1.4 + j * 1.2, RZ = [-1.8, 1.8], base = [1126, 5566];
  const L = [['A', 'B', 'C', 'D', 'E'], ['V', 'W', 'X', 'Y', 'Z']];
  const rows = [];
  let P = null, rg = null;
  const showRow = (i) => { tag('row ' + i, 'ptr', RX(2), 1.3, RZ[i]); rows[i] = L[i].map((c, j) => cube(c, i ? AP : AB, [1.0, 0.6, 1.0], RX(j), 0.3, RZ[i], 3)); };
  await step(tok);                                   // 117:32 不是唯一的實作
  say('剛才的方法是唯一的實作嗎？', '可能不是');
  await step(tok);                                   // 117:55 第一個 row 是一段連續記憶體
  showRow(0);
  say('一樣做 2 × 5', 'row 0 本身是一段連續的記憶體');
  await step(tok);                                   // 118:07 第二個 row 也是
  showRow(1);
  say('row 1 也是一段連續的記憶體', '');
  await step(tok);                                   // 118:33 分開放：化整為零
  say('實作二：每個 row 分開放', '化整為零，一小塊一小塊 allocate');
  await step(tok);                                   // 119:11 row 1 在 5566
  L[1].forEach((c, j) => tag(String(base[1] + j), 'idx', RX(j), 0, RZ[1] + 0.9));
  say('allocate 之後：row 1 放在 5566', '');
  await step(tok);                                   // 119:20 row 0 在 1126
  L[0].forEach((c, j) => tag(String(base[0] + j), 'idx', RX(j), 0, RZ[0] + 0.9));
  say('row 0 放在 1126', '兩段可以離得很遠');
  await step(tok);                                   // 119:44 要把 1126、5566 存下來
  P = [cube('1126', AS, [1.3, 0.6, 1.0], -5.0, 0.3, -0.55, 3), cube('5566', AS, [1.3, 0.6, 1.0], -5.0, 0.3, 0.55, 3)];
  tag('arr[0]', 'idx', -6.3, 0.3, -0.55); tag('arr[1]', 'idx', -6.3, 0.3, 0.55);
  say('要把 1126、5566 存下來', '告訴你各個 row 在哪裡');
  await step(tok);                                   // 120:13 指標陣列
  arrow(V3(-4.3, 0.4, -0.55), V3(RX(0) - 0.6, 0.4, RZ[0])); arrow(V3(-4.3, 0.4, 0.55), V3(RX(0) - 0.6, 0.4, RZ[1]));
  say('這就是傳說中的指標陣列', '入口放兩張小紙條');
  await step(tok);                                   // 120:43 arr[row]：先找紙條
  rg = alRing(-5.0, 0.05, 0.55, 0.75);
  glow(P[1], GOLD);
  say('arr[1][3]：先去 arr[1] 拿小紙條', '紙條寫著 5566');
  await step(tok);                                   // 121:05 從起始點走 col 步
  glow(P[1], null);
  await alSlide(tok, rg, -5.0, RX(0), 800, 0.55, RZ[1]);
  await alSlide(tok, rg, RX(0), RX(3), 700);
  glow(rows[1][3], GREEN);
  say('再從 5566 走 3 步', '5566 + 3 = 5569');
  await step(tok);                                   // 121:19 construct 分三段
  say('construct 要分段', '放紙條的 1 段 ＋ 每個 row 各 1 段 = 3 段');
  await step(tok);                                   // 121:43 東西可以四散
  say('好處：有彈性', '各段可以四散在記憶體不同的位置');
}]);

// 122:36 兩種實作的 trade-off
FRAG.push(['arrlin-2d-compare', 'one block vs array of arrays', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0.5]);
  const lt = [], rt = [];
  let P = null, ok = null;
  await step(tok);                                   // 122:36 one block、array of arrays
  tag('one block', 'ptr', -3.6, 1.5, -2.0); tag('array of arrays', 'ptr alt', 3.4, 1.5, -2.0);
  for (let k = 0; k < 10; k++) cube('', k < 5 ? AB : AP, [0.5, 0.45, 0.5], -6.0 + k * 0.55, 0.22, -0.8, 2);
  P = [cube('', AS, [0.5, 0.45, 0.5], 1.2, 0.22, -1.2, 2), cube('', AS, [0.5, 0.45, 0.5], 1.2, 0.22, -0.6, 2)];
  for (let k = 0; k < 5; k++) { cube('', AB, [0.5, 0.45, 0.5], 2.6 + k * 0.6, 0.22, -1.5, 2); cube('', AP, [0.5, 0.45, 0.5], 2.6 + k * 0.6, 0.22, 0.0, 2); }
  for (let q = 0; q < 3; q++) { lt.push(tag('', 'idx', -3.6, 0, 1.0 + q * 0.8)); rt.push(tag('', 'idx', 3.4, 0, 1.0 + q * 0.8)); }
  say('同一個 2 × 5，兩種實作', 'one block、array of arrays');
  await step(tok);                                   // 122:57 比較花空間
  P.forEach((m) => glow(m, RED));
  txt(lt[0], '空間：10 格'); txt(rt[0], '空間：10 格 ＋ 2 張紙條');
  say('array of arrays 比較花空間', '要多一塊放小紙條');
  await step(tok);                                   // 123:11 construct 多花時間
  P.forEach((m) => glow(m, null));
  txt(lt[1], 'construct：allocate 1 次'); txt(rt[1], 'construct：allocate 3 次');
  say('construct 可能多花一點時間', '每個 row 都要分開配置');
  await step(tok);                                   // 123:23 get：兩層
  txt(lt[2], 'get：算 1 次位置'); txt(rt[2], 'get：兩層（紙條 → 位置）');
  say('get：先找紙條、再算位置', '像大地遊戲跑兩關 → 前者比較快');
  await step(tok);                                   // 123:58 後者常常比較好寫
  ok = tag('比較好寫：兩個維度分開處理', 'ptr alt', 3.4, 2.4, -2.0);
  say('但 array of arrays 常常比較好寫', '不用把位置的數學想得很清楚');
  await step(tok);                                   // 124:29 差距不大，重點是 trade-off
  say('差距通常不大：重點是 trade-off', '每種選擇都有好處和壞處');
}]);

// 125:34 下三角矩陣：只存一半
FRAG.push(['arrlin-lower-tri', '下三角矩陣：只存一半', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, -0.6]);
  const n = 6, GX = (j) => -2.0 + j * 0.8, GZ = (i) => -4.6 + i * 0.7, SX = (k) => -6.0 + k * 0.6;
  const low = [], zeros = [], s = [];
  let rg = null;
  await step(tok);                                   // 125:36 三角矩陣
  for (let i = 0; i < n; i++) {
    low.push([]);
    for (let j = 0; j < n; j++) {
      if (j <= i) low[i].push(cube('', AB, [0.7, 0.35, 0.6], GX(j), 0.18, GZ(i), 2));
      else zeros.push(cube('', AB, [0.7, 0.35, 0.6], GX(j), 0.18, GZ(i), 2));
    }
    tag('row ' + (i + 1), 'idx', -3.2, 0.1, GZ(i));
  }
  say('要存一個矩陣：一個 array of numbers', '有一種特別的：三角矩陣');
  await step(tok);                                   // 126:15 方形矩陣，對角線以上都是 0
  zeros.forEach((m) => { relabel(m, '0'); tint(m, GRAY); });
  say('方形矩陣，只有對角線以下有非零值', '以上都是 0（這裡 n = 6）');
  await step(tok);                                   // 126:21 0 不需要存
  zeros.forEach((m) => fly(m, V3((Math.random() - 0.5) * 4, 7, -3)));
  say('0 不需要存下來', '只存下三角');
  await step(tok);                                   // 126:56 單一 block：第 k 個 row 有 k 個
  for (let k = 0; k < 21; k++) cube('', '#e9dcc4', [0.5, 0.06, 0.5], SX(k), 0.03, 2.2);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) { move(low[i][j], SX(s.length), 0.18, 2.2); s.push(low[i][j]); }
    await beat(tok, 350);
  }
  say('用單一 block：一個 row 接一個 row', 'row 1 有 1 個、row 2 有 2 個…row n 有 n 個');
  await step(tok);                                   // 127:14 n(n+1)/2
  say('只要 n(n+1)/2 個記憶體位置', '6 × 7 / 2 = 21');
  await step(tok);                                   // 127:25 算某一格的位置
  glow(s[19], GOLD);
  say('要找某一格的位置', '例：第 6 row 第 5 個');
  await step(tok);                                   // 127:49 前面經過多少個 element
  glow(s[19], null);
  for (let q = 0; q < 15; q++) glow(s[q], GOLD);
  say('前面已經經過多少個 element？', '1 + 2 + 3 + 4 + 5 = 15');
  await step(tok);                                   // 127:58 走走走才走到
  for (let q = 0; q < 15; q++) glow(s[q], null);
  rg = alRing(SX(15), 0.03, 2.2, 0.36);
  await alSlide(tok, rg, SX(15), SX(19), 900);
  glow(s[19], GREEN);
  say('再走到第 5 個 → 第 20 格', '算得出來，但要多花數學力氣（1-indexed）');
  await step(tok);                                   // 128:12 或用 array of arrays：trade-off
  say('嫌麻煩？改用 array of arrays', '一樣有 trade-off');
  await step(tok);                                   // 129:00 對稱矩陣存一半
  say('對稱矩陣：左下和右上對稱', 'A[i][j] = A[j][i]：也只要存一半');
  await step(tok);                                   // 129:33 每個選擇都有好處和壞處
  say('沒有哪個選擇一定最好', '懂得取捨，才叫程式「設計」');
}]);

// 131:12 row sum vs column sum：走訪順序
FRAG.push(['arrlin-rowcol-sum', 'row sum vs column sum', async (tok) => {
  fresh([0, 8, 11], [0, 0, -0.4]);
  const R = 4, C = 6, GX = (j) => -2.5 + j * 1.0, GZ = (i) => -3.8 + i * 0.9, SX = (k) => -5.75 + k * 0.5;
  const g = [], s = [];
  const st = tag('', 'ptr alt', 0, 2.6, -4.4);
  let rg = null;
  const run = async (rowFirst) => {
    for (let a = 0; a < (rowFirst ? R : C); a++) for (let b = 0; b < (rowFirst ? C : R); b++) {
      const i = rowFirst ? a : b, j = rowFirst ? b : a, k = i * C + j;
      rg.position.set(GX(j), 0.02, GZ(i)); glow(g[i][j], GOLD); glow(s[k], GOLD);
      await beat(tok, 95);
    }
  };
  const clear = () => { g.flat().forEach((m) => glow(m, null)); s.forEach((m) => glow(m, null)); };
  await step(tok);                                   // 131:13 2D array，arr[i][j]
  for (let i = 0; i < R; i++) { g.push([]); for (let j = 0; j < C; j++) g[i].push(cube('', AB, [0.8, 0.35, 0.7], GX(j), 0.18, GZ(i), 2)); }
  txt(st, 'result += arr[i][j];');
  say('用 C 的 native 2D array', '寫成 arr[i][j] 來 access');
  await step(tok);                                   // 131:35 實際是 one block
  for (let k = 0; k < R * C; k++) s.push(cube('', Math.floor(k / C) % 2 ? AP : AB, [0.42, 0.3, 0.42], SX(k), 0.15, 1.8, 2));
  tag('實際的記憶體：one block、row-major', 'idx', 0, 0, 2.7);
  say('實際上在電腦裡是一大塊固定的記憶體', '就是剛才的 one block');
  await step(tok);                                   // 132:00 兩段程式：每個加進 result
  say('兩段程式：都把每個 element 加進 result', '兩層迴圈，大家都會寫');
  await step(tok);                                   // 132:13 哪個比較快？
  say('問題：哪一個比較快？為什麼？', '還是一樣快？');
  await step(tok);                                   // 132:31 row：由左到右，再由上到下
  rg = alRing(GX(0), 0.02, GZ(0), 0.45);
  txt(st, 'row sum：for (i…) for (j…) result += arr[i][j];');
  await run(true);
  say('row sum：由左到右，再由上到下', '記憶體位置 0, 1, 2, 3…：連續');
  await step(tok);                                   // 132:40 column：由上到下再往右
  clear();
  txt(st, 'column sum：for (j…) for (i…) result += arr[i][j];');
  await run(false);
  say('column sum：由上到下，再回到上面往右', '記憶體位置 0, 6, 12, 18, 1, 7…：跳著走');
  await step(tok);                                   // 132:59 每個都加過，可能一樣快？
  say('兩段都把每個 element 加過一次', '結果一樣——時間呢？');
  await step(tok);                                   // 133:14 休息、Slido 投票
  clear();
  say('休息 5 分鐘，在 Slido 投票', '等一下實際跑跑看');
}]);

// 139:40 實測：column sum 慢約一倍
FRAG.push(['arrlin-rowcol-timing', '實測：row sum vs column sum', async (tok) => {
  fresh([0, 5, 13], [0, 2.4, 0]);
  const poll = [['row 較快', 2.8, AG, '七成以上'], ['差不多', 0.8, GRAY, '一些'], ['column 較快', 0.4, AK, '較少']];
  let br = null, bc = null;
  await step(tok);                                   // 139:40 投票結果
  say('Slido 投票結果', '七成以上同學覺得 row sum 比較快');
  for (let k = 0; k < 3; k++) {
    const x = -5.0 + k * 1.3, b = alBar(poll[k][2], 0.9, 0.9, x, 0);
    tag(poll[k][0], 'idx', x, 0, 1.0 + (k % 2) * 0.6);
    await alGrow(tok, b, poll[k][1], 500);
    tag(poll[k][3], 'idx', x, poll[k][1] + 0.4, 0);
  }
  await step(tok);                                   // 141:07 initialize 都用 row major
  say('實測程式：sum 的部分不同', 'initialize 都用 row major，求公平');
  await step(tok);                                   // 141:20 只差兩行
  say('兩支程式只差兩行', '迴圈的順序');
  await step(tok);                                   // 141:55 跑 10 次
  br = alBar(AB, 1.2, 1.2, 1.6, 0); bc = alBar(AO, 1.2, 1.2, 4.2, 0);
  tag('row sum', 'idx', 1.6, 0, 1.2); tag('column sum', 'idx', 4.2, 0, 1.2);
  say('各跑 10 次', '得到比較穩定的估計');
  await step(tok);                                   // 142:07 row sum 約 10 秒
  await alGrow(tok, br, 2.5, 900);
  tag('≈ 10 秒', 'ptr', 1.6, 2.9, 0);
  say('row sum：10 次約 10 秒', '一次大約 1 秒');
  await step(tok);                                   // 142:37 column sum 約 2 倍
  await alGrow(tok, bc, 5.0, 1400);
  tag('≈ 20 秒', 'ptr alt', 4.2, 5.4, 0);
  say('column sum：約 2 倍', '20 秒左右');
  await step(tok);                                   // 142:52 為什麼？
  say('看似人畜無害的程式，時間差一倍', '為什麼？');
}]);

// 143:01 原因：cache（水槽）與連續存取
FRAG.push(['arrlin-cache', 'cache：一次打一桶水', async (tok) => {
  fresh([0, 8.5, 10.5], [0, 0, 0]);
  const cpu = cube('CPU', AT, [1.2, 1.0, 1.2], -5.8, 0.5, 0); tag('CPU', 'ptr', -5.8, 1.5, 0);
  const SXc = (q) => -4.3 + q * 0.6, LZ = [-0.45, 0.45];
  const MZ = [-2.7, -0.9, 0.9, 2.7], MX = (c) => 2.0 + c * 0.9;
  const mem = [];
  for (let r = 0; r < 4; r++) {
    tag('row ' + r, 'idx', 0.9, 0.2, MZ[r]); tag('…', 'idx', 5.8, 0.2, MZ[r]);
    mem.push([0, 1, 2, 3].map((c) => { tag(String(r * 1000 + c + 1), 'idx', MX(c), 0, MZ[r] + 0.65); return cube('', r % 2 ? AP : AB, [0.6, 0.4, 0.6], MX(c), 0.2, MZ[r]); }));
  }
  let lines = [], miss = 0, hit = 0, cnt = null, rg = null;
  function reset() { lines.forEach((l) => l.cubes.forEach((m) => kill(m))); lines = []; miss = 0; hit = 0; txt(cnt, 'miss 0 / hit 0'); }
  async function access(r, c, ms) {
    rg.position.set(MX(c), 0.02, MZ[r]);
    const L = lines.find((l) => l.r === r);
    if (L) {
      hit++; lines = lines.filter((l) => l !== L).concat([L]);
      glow(L.cubes[c], GREEN); await beat(tok, ms); glow(L.cubes[c], null);
    } else {
      miss++;
      let slot = 0;
      if (lines.length >= 2) { const old = lines.shift(); slot = old.slot; old.cubes.forEach((m) => fly(m, V3(0, 6, 2))); }
      else slot = lines.length;
      glow(mem[r][c], RED);
      const cubes = [0, 1, 2, 3].map((q) => { const m = cube('', r % 2 ? AP : AB, [0.45, 0.35, 0.45], MX(q), 0.2, MZ[r]); move(m, SXc(q), 0.2, LZ[slot]); return m; });
      lines.push({ r, slot, cubes });
      await beat(tok, ms); glow(mem[r][c], null);
    }
    txt(cnt, 'miss ' + miss + ' / hit ' + hit);
  }
  const path = async (cells) => { for (const [r, c] of cells) { glow(mem[r][c], GOLD); await beat(tok, 300); } };
  const unglow = () => mem.flat().forEach((m) => glow(m, null));
  await step(tok);                                   // 143:03 為什麼差這麼多？
  say('看似人畜無害的簡單程式', '為什麼時間差這麼多？');
  await step(tok);                                   // 143:42 程式變成機器碼在平台上跑
  say('程式最後變成機器碼，在特定的機器上執行', '要懂機器怎麼運作，才寫得出有效率的程式');
  await step(tok);                                   // 144:35 記憶體離 CPU 很遙遠
  tag('記憶體（遠方的井）', 'ptr', 3.4, 1.4, -3.8);
  arrow(V3(-5.0, 0.5, 0), V3(0.6, 0.5, 0), 0x7a1010);
  say('記憶體離 CPU 很「遙遠」', '每次都去拿，花的時間太長');
  await step(tok);                                   // 145:09 走很遠去井裡打水
  glow(cpu, GOLD);
  say('像以前沒有自來水', '每次用水都要走很遠去井裡打');
  await step(tok);                                   // 145:40 中間層：一次拿多一點回來
  glow(cpu, null);
  const cg = ghostBox(AB, 2.8, 0.7, 2.0); cg.position.set(-3.4, 0.35, 0);
  for (const z of LZ) for (let q = 0; q < 4; q++) cube('', '#e9dcc4', [0.5, 0.06, 0.5], SXc(q), 0.03, z);
  say('一次用大桶子打多一點，放家裡水槽', '在 CPU 和記憶體之間加一個中間層');
  await step(tok);                                   // 146:34 水槽叫 cache
  tag('cache（家裡的水槽）', 'ptr alt', -3.4, 1.2, -1.4);
  cnt = tag('', 'ptr', -3.4, 0, 2.6);
  say('那個水槽叫 cache（快取記憶體）', '資料在水槽裡就快；不在就要去遠方挑水');
  await step(tok);                                   // 147:02 row sum：連續存取
  await path([[0, 0], [0, 1], [0, 2], [0, 3]]);
  say('row sum：存取的記憶體是連續的', '1 → 2 → 3 → 4');
  await step(tok);                                   // 147:18 column sum：跳來跳去
  unglow();
  await path([[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]]);
  say('column sum：跳來跳去', '1 → 1001 → 2001 → 3001 → 再回到 2');
  await step(tok);                                   // 147:44 抓附近連續的一小段
  unglow();
  rg = alRing(MX(0), 0.02, MZ[0], 0.42);
  reset();
  await access(0, 0, 900);
  say('cache 去記憶體時，會把附近一小段一起抓回來', '要位置 1 → 連 1～4 一起進水槽（cache miss）');
  await step(tok);                                   // 148:15 row sum 吃香
  for (let c = 1; c < 4; c++) await access(0, c, 450);
  say('row sum 吃香：要的資料已經在水槽裡', 'cache hit：miss 1 / hit 3');
  await step(tok);                                   // 148:38 column sum：一直 cache miss
  reset();
  for (const [r, c] of [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1]]) await access(r, c, 340);
  say('column sum：下一個總是不在附近', '一直 cache miss，多花很多時間');
  await step(tok);                                   // 149:04 計算機結構、OS 這些必修課
  say('所以要修計算機結構、作業系統', '懂機器怎麼運作，才寫得出好程式（示意：一次抓 4 格、水槽放 2 段）');
}]);

// 153:53 ordered array：insert 的位置被 order 決定
FRAG.push(['arrlin-ordered-insert', 'Ordered array 的 insert', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.8, 0]);
  const X = (i) => -5.4 + i * 1.2;
  for (let i = 0; i < 10; i++) { cube('', GRAY, [1.0, 0.08, 1.0], X(i), 0.04, 0); tag('[' + i + ']', 'idx', X(i), 0, 0.9); }
  const vals = [3, 7, 9, 10, 25, 27];
  const cs = [];
  let v = null;
  await step(tok);                                   // 153:53 ordered array
  say('下一段：ordered array', '有額外特性要滿足的 array');
  await step(tok);                                   // 154:18 有放東西的櫃子是連續的
  for (let i = 0; i < vals.length; i++) { cs.push(cube(vals[i], AB, [0.95, 0.6, 0.95], X(i), 0.35, 0, 3)); await beat(tok, 250); }
  say('差別一：有放東西的櫃子是連續的一段', '從 0 號開始放滿，後面是空的');
  await step(tok);                                   // 154:57 放的東西有可比較的值
  say('差別二：放的東西有可以比較的值', '例如成績單上的成績');
  await step(tok);                                   // 155:18 排序好的
  for (let i = 0; i + 1 < cs.length; i++) { glow(cs[i], GOLD); glow(cs[i + 1], GOLD); await beat(tok, 380); glow(cs[i], null); glow(cs[i + 1], null); }
  say('而且排序好：ordered', '例如由小到大');
  await step(tok);                                   // 155:33 arr[0] ≤ arr[1] ≤ … ≤ arr[end]
  say('arr[0] ≤ arr[1] ≤ … ≤ arr[end]', 'end 後面想成是空的');
  await step(tok);                                   // 156:09 定義好的小於等於
  say('需要定義好的「小於等於」', 'struct / class：可以比較某個欄位');
  await step(tok);                                   // 156:57 加上 order，會改變 insert
  say('加上 order 這個條件', '會改變我們怎麼看這個 data structure：例如 insert');
  await step(tok);                                   // 157:33 不能想放哪就放哪
  say('以前：號碼拿來，就塞進去', '現在要維持 order，不能想放哪就放哪');
  await step(tok);                                   // 157:50 例：3 7 9 10 25 27
  cs.forEach((m) => glow(m, GOLD));
  say('例如這個由小到大的 array', '3 7 9 10 25 27');
  await step(tok);                                   // 158:02 insert 13：一定在 10 和 25 中間
  cs.forEach((m) => glow(m, null));
  v = cube(13, AO, [0.95, 0.6, 0.95], (X(3) + X(4)) / 2, 2.4, 0);
  glow(cs[3], GOLD); glow(cs[4], GOLD);
  say('insert 13：位置已經固定', '一定在 10 和 25 中間：10 ≤ 13 ≤ 25');
  await step(tok);                                   // 158:18 不能 insert by index 到第 0 個
  glow(cs[3], null); glow(cs[4], null);
  move(v, X(0), 2.4, 0); glow(v, RED);
  say('不能 insert by index 把 13 插到 [0]', '13 在 3 前面 → 破壞 order ✗');
  await step(tok);                                   // 158:35 自己的 insert 演算法
  glow(v, null);
  move(cs[5], X(6), 0.35, 0); await beat(tok, 400);
  move(cs[4], X(5), 0.35, 0); await beat(tok, 400);
  move(v, X(4), 0.35, 0);
  say('ordered array 要有自己的 insert 演算法', '後面往後推，13 放進 [4]：order 維持住了');
  await step(tok);                                   // 158:55 演算法下次講
  say('這個演算法長什麼樣子？', '下一堂課再講');
}]);
  }

  // ═══ arrlllin.js ═══
  {
  // ─── B0ywTK-Lklw：林軒田 DSA — Ordered array、Binary search、Linked list、Sparse vector ───
  // cued scenes: every `await step(tok)` waits for the sentence the lecturer is saying; beats are motion only
  const step = ctx.step;
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
  function dlinks(xs, z, old, backOnly) {
    (old || []).forEach(kill);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      if (!backOnly) out.push(arrow(V3(xs[i] + 0.94, 0.55, z - 0.25), V3(xs[i + 1] - 0.5, 0.55, z - 0.25)));
      out.push(arrow(V3(xs[i + 1] - 0.94, 0.15, z + 0.25), V3(xs[i] + 0.5, 0.15, z + 0.25), 0xc08a1f));
    }
    return out;
  }
  const relabelG = (g, t) => { const l = g.userData.data.children[0]; if (l && l.element) l.element.textContent = String(t); };
  function book(id, x, z = 0) { const m = cube(id, C.pr, [0.95, 1.7, 0.75], x, 0.85, z); m.userData.v = id; return m; }

  // 17:30 consecutive → ordered
  FRAG.push(['arrlllin-consecutive', 'Consecutive 與 Ordered array', async (tok) => {
    fresh([0, 6.5, 11], [0, 0.4, 0]);
    const xs = spread(7, 1.5); cells(xs, 0);
    await step(tok);                                   // 17:30 繼續把 array 當成 data structure
    say('繼續看 array：把它當成 data structure', '今天：讓 array 裡的東西有順序');
    await step(tok);                                   // 18:45 array 像一排櫃子，用編號開關
    say('Array 像一排置物櫃：用編號任意開關', '7 個櫃子 [0] … [6]');
    await step(tok);                                   // 19:02 可以任意放來放去
    const loose = [[1, 4], [4, 9], [6, 2]].map(([i, v]) => vc(v, xs[i], 0, 3));
    say('可以任意放：這格放 4、那格放 9', '中間留著空位');
    await step(tok);                                   // 19:34 留空位看起來有點浪費
    loose.forEach((m) => glow(m, GOLD));
    say('中間留空位，看起來有點浪費', '');
    await step(tok);                                   // 19:51 中間不留空：填 5、7、4、6
    loose.forEach((m) => fly(m));
    await beat(tok, 500);
    const vals = [5, 7, 4, 6], cs = [];
    for (let i = 0; i < 4; i++) { cs.push(vc(vals[i], xs[i], 0, 3)); await beat(tok, 300); }
    say('中間不留空：從最前面連續放', '填入 5, 7, 4, 6');
    await step(tok);                                   // 20:11 consecutive array
    const g = ghostBox(C.ok, 4 * 1.5 - 0.2, 0.9, 1.6); g.position.set((xs[0] + xs[3]) / 2, 0.45, 0);
    tag('tail = 3', 'ptr alt', xs[3], 1.4, 0);
    say('Consecutive array：用掉前面連續一段', '[0 … tail] 有資料，後面是連續空位');
    await step(tok);                                   // 20:38 範圍內的資料再由小到大排好
    [2, 0, 3, 1].forEach((k, i) => move(cs[k], xs[i], 0.35, 0));
    say('再要求：資料由小到大排好', '4 ≤ 5 ≤ 6 ≤ 7');
    await step(tok);                                   // 21:06 這叫 ordered array
    say('這樣的 array 叫 Ordered array', 'ordered 一定是 consecutive');
    await step(tok);                                   // 21:19 也可以由大到小（排行榜）
    say('也可以由大到小，例如成績排行榜', '課堂上簡化成由小到大');
  }]);

  // 22:01 insert into ordered array
  FRAG.push(['arrlllin-ordered-insert', 'Ordered array 的插入', async (tok) => {
    fresh([0, 6.5, 12.5], [0, 1.6, 0]);
    const xs = spread(7, 1.5); cells(xs, 0);
    let A = [];
    const tl = tag('tail = 3', 'ptr', xs[3], 0.05, -1.3); showL(tl, false);
    await step(tok);                                   // 22:01 例子：2, 6, 7, 13
    A = [2, 6, 7, 13].map((v, i) => vc(v, xs[i], 0, 3)); while (A.length < 7) A.push(null);
    say('Ordered array：2, 6, 7, 13', '有新東西要放進去，沒那麼容易了');
    await step(tok);                                   // 22:49 10 只能放在 13 現在的位置
    const d10 = vc(10, xs[3], 0, 0, C.hot); d10.position.y = 2.3;
    glow(A[3], GOLD);
    say('插入 10：只能放在 13 現在的位置', '要維持連續、又要維持順序');
    await step(tok);                                   // 23:07 13 往後擠一格，10 放進去
    glow(A[3], null);
    move(A[3], xs[4], 0.35, 0); A[4] = A[3];
    await beat(tok, 600);
    move(d10, xs[3], 0.35, 0); A[3] = d10;
    say('13 往後擠一格，10 放進原來的位置', '2, 6, 7, 10, 13');
    await step(tok);                                   // 23:34 像插隊：要找到插在哪
    say('像「插隊」：先找到要插在哪裡', '');
    await step(tok);                                   // 24:26 維護 consecutive array 要記 tail
    showL(tl, true); txt(tl, 'tail = 4'); at(tl, xs[4], 0.05, -1.3);
    say('除了開頭，還要一個變數記 tail', 'tail = 最後一筆資料的位置');
    await step(tok);                                   // 24:46 tail：資料到哪、空位從哪開始
    glow(A[4], GOLD);
    say('tail 告訴我們：資料到哪為止', '也告訴我們：空位從 tail + 1 開始');
    await step(tok);                                   // 25:50 換成插入 4
    glow(A[4], null);
    A.forEach((m) => m && fly(m)); A = [];
    await beat(tok, 500);
    A = [2, 6, 7, 13].map((v, i) => vc(v, xs[i], 0, 2)); while (A.length < 7) A.push(null);
    txt(tl, 'tail = 3'); at(tl, xs[3], 0.05, -1.3);
    const d4 = vc(4, xs[4], 0, 0, C.hot); d4.position.y = 2.3;
    say('如果插入的是 4 呢？', '從 tail 開始一個一個搬家');
    await step(tok);                                   // 26:11 搬 13、搬 7、搬 6，才空出位置
    for (let i = 3; i >= 1; i--) { move(d4, xs[i], 2.3, 0); move(A[i], xs[i + 1], 0.35, 0); A[i + 1] = A[i]; A[i] = null; await beat(tok, 550); }
    move(d4, xs[1], 0.35, 0); A[1] = d4;
    txt(tl, 'tail = 4'); at(tl, xs[4], 0.05, -1.3);
    say('搬 13、搬 7、搬 6，才空出一格放 4', '插得越前面，要搬的越多');
    await step(tok);                                   // 26:37 寫成程式：index 從 tail 開始往前
    const cd = code(['for (i = tail; i >= 0; i--)', '  if (arr[i] > data) arr[i+1] = arr[i];  // 往後搬', '  else 停下來', 'arr[i+1] = data;'], 0, 5.6, 0.5, -1.8);
    cd.hl(0);
    say('寫成程式：index 從 tail 開始往前看', '不能超出 array 的範圍');
    await step(tok);                                   // 28:14 比 data 大就往後搬
    cd.hl(1);
    say('arr[i] 比 data 大：往後搬一格', 'arr[i+1] = arr[i]');
    await step(tok);                                   // 28:34 不比 data 大就停，放進去
    cd.hl(3);
    say('找到不比 data 大的位置：停下來放 data', '最壞要搬 tail + 1 個 → O(n)');
  }]);

  // 29:10 the buggy insert code
  FRAG.push(['arrlllin-insert-bugs', '抓 insert 程式的 bug', async (tok) => {
    fresh([0, 5.5, 12.5], [0, 2.4, 0]);
    const xs = spread(6, 1.5), real = xs.slice(0, 5), z = 1.2;
    cells(real, z);
    const cd = code(['for (i = tail; i >= 0; i--) {', '  if (arr[i] > data)', '    arr[i+1] = arr[i];', '  else {', '    arr[i+1] = data; break;', '  }', '}'], 0, 6.4, 0.5, -1.6);
    const dl = tag('data = 10', 'ptr alt', -5.4, 1.6, z);
    const il = tag('i', 'ptr', real[3], 1.5, z); showL(il, false);
    let S = [];
    const load = (vals) => { S.forEach((m) => m && kill(m)); S = vals.map((v, i) => vc(v, real[i], z)); while (S.length < 5) S.push(null); };
    const put = (i, v, col) => { if (S[i]) { setV(S[i], v); tint(S[i], col || C.v); } else S[i] = vc(v, real[i], z, 2, col || C.v); };
    load([2, 6, 7, 13]);
    await step(tok);                                   // 29:10 這段程式有沒有問題？
    say('這段 insert 程式有沒有問題？', '同學：怪怪的、會超出範圍…');
    await step(tok);                                   // 30:34 帶著懷疑、用嚴格標準檢查
    say('寫程式要帶著懷疑、用嚴格標準檢查', '寫錯也沒關係：就 debug');
    await step(tok);                                   // 32:09 修正：這邊應該有個 else
    cd.hl(3);
    say('修正：arr[i] ≤ data 時進 else', '把 data 放到 arr[i+1]，然後 break');
    await step(tok);                                   // 32:56 追蹤：data = 10，i 從 tail = 3
    cd.hl(0); showL(il, true);
    say('追蹤 data = 10：i 從 tail = 3 開始', 'arr = 2, 6, 7, 13');
    await step(tok);                                   // 33:14 arr[3] 有沒有比 data 大？
    glow(S[3], GOLD); cd.hl(1);
    say('arr[3] = 13 > 10', '條件成立');
    await step(tok);                                   // 33:25 13 往後 copy
    cd.hl(2); put(4, 13, C.hot); glow(S[3], null); tint(S[3], C.dim);
    say('arr[4] = arr[3]：只是 copy', '13 暫時有兩份，舊的等著被蓋掉');
    await step(tok);                                   // 33:52 i = 2：7 < 10，跳到 else
    at(il, real[2], 1.5, z); glow(S[2], GOLD); cd.hl(3);
    say('i = 2：arr[2] = 7 不比 10 大', '進 else');
    await step(tok);                                   // 34:02 10 放到 arr[3]，break
    cd.hl(4); glow(S[2], null); put(3, 10, C.ok); tint(S[4], C.v);
    say('arr[3] = 10，break', '2, 6, 7, 10, 13');
    await step(tok);                                   // 34:53 同學：data 是 1 會放不進去
    load([2, 6, 7, 13]); txt(dl, 'data = 1'); cd.hl(2);
    for (let i = 3; i >= 0; i--) {
      at(il, real[i], 1.5, z); put(i + 1, S[i].userData.v); tint(S[i], C.dim);
      await beat(tok, 450);
    }
    say('data = 1（比全部都小）：每格都往後 copy', '');
    await step(tok);                                   // 36:15 迴圈跑完：沒進 else，1 沒放進去
    cd.hl(6); txt(il, 'i = -1'); at(il, real[0] - 1.2, 1.5, z); glow(S[0], RED); tint(S[0], C.bad);
    say('迴圈就結束了：1 根本沒放進去！', 'Bug 1：arr[0] 讓出來了，卻沒填 data');
    await step(tok);                                   // 36:47 arr[tail+1] 不一定有空間
    glow(S[0], null); tint(S[0], C.v); txt(il, 'tail = 4'); at(il, real[4], 1.5, z);
    const gb = ghostBox(C.bad, 1.1, 0.7, 1.1); gb.position.set(xs[5], 0.35, z);
    tag('[5]？', 'idx', xs[5], 0.05, z + 1.1);
    say('陣列滿了時，arr[tail+1] 會寫出界', 'Bug 2：沒檢查後面還有沒有空間');
    await step(tok);                                   // 38:18 要用完整邏輯寫下來，不容易
    cd.hl(-1);
    say('演算法看似簡單，寫成完整邏輯不容易', '還要自己想怎麼測試、debug');
    await step(tok);                                   // 39:20 A 跟 ARR 混用的 typo
    say('還有 A 與 ARR 混用的 typo', '這些洞留給大家自己補');
  }]);

  // 40:03 selection sort / insertion sort on 1 3 7 4 6 5 2
  FRAG.push(['arrlllin-construct', '把亂的 array 排成 ordered', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0]);
    const V0 = [1, 3, 7, 4, 6, 5, 2], xs = spread(7, 1.4); cells(xs, 0);
    let S = [];
    const pass = (p) => {
      let m = p; for (let k = p + 1; k < 7; k++) if (S[k].userData.v < S[m].userData.v) m = k;
      if (m !== p) { move(S[m], xs[p], 0.35, 0); move(S[p], xs[m], 0.35, 0); [S[p], S[m]] = [S[m], S[p]]; }
      tint(S[p], C.ok);
    };
    await step(tok);                                   // 40:03 一開始怎麼排好？空 array 本來就排好
    say('insert 寫好了，一開始怎麼讓 array 排好？', '空的 array：本來就是排好的');
    await step(tok);                                   // 40:10 已經有一串 1 3 7 4 6 5 2
    S = V0.map((v, i) => vc(v, xs[i], 0, 3));
    say('已經有一串沒排好的：1 3 7 4 6 5 2', '像整理房間：要變成 ordered array');
    await step(tok);                                   // 40:44 用 getMinIndex 找最小的，換到開頭
    glow(S[0], GOLD);
    say('用 getMinIndex：把最小的叫出來', '跟開頭那格交換（1 已經在開頭）');
    await beat(tok, 700);
    glow(S[0], null); pass(0);
    await step(tok);                                   // 40:58 在剩下的裡面再叫出最小的…
    for (let p = 1; p < 6; p++) { pass(p); await beat(tok, 450); }
    tint(S[6], C.ok);
    say('在剩下的裡面再叫出最小的，一直重複', '第 2 小、第 3 小…依序放好');
    await step(tok);                                   // 41:39 這叫 selection sort
    say('這就是 Selection sort', '1 2 3 4 5 6 7');
    await step(tok);                                   // 41:59 另一種：像玩撲克牌
    S.forEach((m) => kill(m));
    S = V0.map((v, i) => vc(v, xs[i]));
    tint(S[0], C.ok);
    say('另一種：像玩撲克牌', '抽一張牌，插到手上排好的牌裡');
    await step(tok);                                   // 42:24 左邊維持排好，右邊抽一張插進去
    for (let k = 1; k < 7; k++) {
      const c = S[k], v = c.userData.v;
      let j = k - 1;
      while (j >= 0 && S[j].userData.v > v) { move(S[j], xs[j + 1], 0.35, 0); S[j + 1] = S[j]; j--; }
      S[j + 1] = c; move(c, xs[j + 1], 0.35, 0); tint(c, C.ok);
      await beat(tok, 380);
    }
    say('左邊一直維持排好；右邊抽一個插到左邊', '= 把 ordered array 的 insertion 跑很多次');
    await step(tok);                                   // 42:39 這叫 insertion sort
    say('這叫 Insertion sort', '兩種都能把散亂的 array 排好');
  }]);

  // 43:05 maintenance cost: update must roll, remove must fill in
  FRAG.push(['arrlllin-maintain', 'Ordered 的維護代價', async (tok) => {
    fresh([0, 6, 11.5], [0, 0.6, 0]);
    const xs = spread(6, 1.5); cells(xs, 0);
    const S = [2, 6, 7, 13].map((v, i) => vc(v, xs[i])); S.push(null, null);
    const tl = tag('tail = 3', 'ptr', xs[3], 0.05, -1.3);
    await step(tok);                                   // 43:05 多了要求：連續、按順序
    say('Ordered array 多了要求', '位置要連續、資料要按順序');
    await step(tok);                                   // 43:26 access 與 maintenance 都要多花力氣
    say('有要求，就要多花力氣', 'access 和 maintenance 都是');
    await step(tok);                                   // 43:39 不能任意 update
    setV(S[1], 11); glow(S[1], RED);
    say('不能隨便 update：把 6 改成 11', '前後的順序可能就亂了');
    await step(tok);                                   // 43:59 要檢查：比前一格大、比後一格小
    say('改完要檢查：比前一格大？比後一格小？', '11 > 後一格的 7 → 不對');
    await step(tok);                                   // 44:06 比後面大就往後滾
    move(S[1], xs[2], 0.35, 0); move(S[2], xs[1], 0.35, 0); [S[1], S[2]] = [S[2], S[1]];
    await beat(tok, 700);
    glow(S[2], null);
    say('比後面大 → 往後滾，直到順序對', '2, 7, 11, 13');
    await step(tok);                                   // 44:25 移除：後面要往前補位
    glow(S[1], RED);
    await beat(tok, 500);
    fly(S[1]); S[1] = null;
    await beat(tok, 400);
    for (let k = 2; k <= 3; k++) { move(S[k], xs[k - 1], 0.35, 0); S[k - 1] = S[k]; S[k] = null; await beat(tok, 400); }
    txt(tl, 'tail = 2'); at(tl, xs[2], 0.05, -1.3);
    say('移除 7：後面的要往前補位（fill in）', 'tail 從 3 變 2');
    await step(tok);                                   // 44:50 很多 DS 都是在儲存方式上加限制
    say('很多 data structure 都在儲存方式上加限制', 'ordered、consecutive 都是限制');
    await step(tok);                                   // 45:03 像房間的衣服要照順序擺
    say('像衣服要照某種方式排，就要花力氣整理', '這些代價都要算進評估');
    await step(tok);                                   // 45:26 insert 的 code 故意留洞
    say('insert 的程式故意留了洞', '讓大家自己想辦法補起來');
  }]);

  // 49:18 sequential search on a shelf
  FRAG.push(['arrlllin-seq-search', 'Sequential search：找書', async (tok) => {
    fresh([0, 5.6, 12.5], [0, 2.4, 0]);
    const IDS = [12, 27, 35, 48, 56, 63, 79, 85], xs = spread(8, 1.3), z = 1.2;
    let B = [], cd, il, fl;
    await step(tok);                                   // 49:18 到圖書館找書
    B = IDS.map((v, i) => book(v, xs[i], z));
    say('Ordered array 的應用：到圖書館找書', '');
    await step(tok);                                   // 49:35 每本書有一個編號 ID
    xs.forEach((x, i) => tag('[' + i + ']', 'idx', x, 0.05, z + 0.9));
    say('每本書都有一個編號（ID、索書號）', 'ID 可以比大小');
    await step(tok);                                   // 50:22 同一架上依 ID 大小排列
    for (let i = 0; i < 8; i++) { glow(B[i], GOLD); await beat(tok, 150); glow(B[i], null); }
    say('同一個架子上：書依 ID 由小到大排', '最左最小、最右最大');
    await step(tok);                                   // 50:50 就像 ordered array
    say('就像排好的 ordered array', '');
    await step(tok);                                   // 51:21 已經找到架子，要找那一本
    fl = tag('toFind = 56', 'ptr alt', -5.6, 2.2, z);
    say('已經照編號找到架子了', '現在要找出 ID = 56 那一本');
    await step(tok);                                   // 51:37 從左邊找到右邊
    il = tag('i', 'ptr', xs[0], 2.2, z);
    for (let i = 0; i <= 4; i++) { at(il, xs[i], 2.2, z); glow(B[i], GOLD); await beat(tok, 350); if (i < 4) glow(B[i], null); }
    tint(B[4], C.ok);
    say('從左邊找到右邊', '12、27、35、48、56 → 找到了');
    await step(tok);                                   // 52:10 寫成 search algorithm，像 getMinIndex
    glow(B[4], null); tint(B[4], C.pr);
    cd = code(['for (i = 0; i <= tail; i++)', '  if (arr[i].id == toFind)', '    return i;      // 找到了', 'return NOT_FOUND;'], 0, 6.2, 0.52, -1.6);
    cd.hl(0); at(il, xs[0], 2.2, z);
    say('寫成 search algorithm', '跟 getMinIndex 很像：i 從 0 跑到 tail');
    await step(tok);                                   // 52:40 ID 一樣就說找到了
    cd.hl(2);
    say('arr[i] 的 ID 跟要找的一樣：找到了', '整個找完都沒有：NOT_FOUND');
    await step(tok);                                   // 53:35 sequential search
    cd.hl(1);
    say('這叫 Sequential search', '按順序，一個一個看過去');
    await step(tok);                                   // 53:51 最壞：整個找完都找不到
    txt(fl, 'toFind = 50');
    for (let i = 0; i < 8; i++) { at(il, xs[i], 2.2, z); glow(B[i], GOLD); await beat(tok, 230); glow(B[i], null); tint(B[i], C.dim); }
    cd.hl(3);
    say('最壞情況：整排看完都找不到', '找 50 → 看了 tail + 1 本，return NOT_FOUND');
  }]);

  // 54:09 sequential search with cut (5566 vs 6000)
  FRAG.push(['arrlllin-seq-cut', 'Sequential search with cut', async (tok) => {
    fresh([0, 5.6, 12.5], [0, 2.4, 0]);
    const IDS = [1, 3, 1234, 2046, 4096, 5000, 6000, 6001, 7000], xs = spread(9, 1.25), z = 1.2;
    const B = IDS.map((v, i) => book(v, xs[i], z));
    const il = tag('i', 'ptr', xs[0], 2.2, z); showL(il, false);
    let cd;
    await step(tok);                                   // 54:09 剛才根本沒用到 ordered
    say('剛才的演算法根本沒用到「排好了」', '書被小孩弄亂，也照樣一本本翻');
    await step(tok);                                   // 54:24 如果書真的照編號排好呢？
    say('如果書真的照編號排好了呢？', '');
    await step(tok);                                   // 54:40 要找 5566
    tag('toFind = 5566', 'ptr alt', -5.6, 2.6, z);
    say('例：要找 ID = 5566', '從小找到大');
    await step(tok);                                   // 54:59 1、3、1234 … 一路找上去
    showL(il, true);
    for (let i = 0; i <= 5; i++) { at(il, xs[i], 2.2, z); glow(B[i], GOLD); await beat(tok, 300); glow(B[i], null); }
    say('1、3、1234 … 一路往上找', '都比 5566 小：繼續');
    await step(tok);                                   // 55:09 拿到的已經是 6000
    at(il, xs[6], 2.2, z); glow(B[6], RED);
    say('拿下一本：ID 已經是 6000', '6000 > 5566！');
    await step(tok);                                   // 55:19 後面的都不可能是要的書
    for (let k = 7; k < 9; k++) tint(B[k], C.dim);
    say('6001、7000 … 只會更大', '都不可能是 5566');
    await step(tok);                                   // 55:41 偷吃步：比要找的大就說沒找到
    cd = code(['for (i = 0; i <= tail; i++)', '  if (arr[i].id == toFind) return i;', '  else if (arr[i].id > toFind)', '    return NOT_FOUND;  // 偷吃步 cut', 'return NOT_FOUND;'], 0, 6.2, 0.52, -1.6);
    cd.hl(3);
    say('偷吃步：看到的 ID 比要找的大，直接回報沒找到', 'break 或 return 都可以');
    await step(tok);                                   // 56:02 偷偷用了 ordered array 的性質
    cd.hl(2);
    say('偷偷用了 ordered array 的性質', '後面只會更大，不用再找');
    await step(tok);                                   // 56:31 要找的編號越小，省得越多
    say('要找的編號越小，省得越多', '找 4 號：看到 5 就停');
    await step(tok);                                   // 56:48 英文叫 shortcut
    cd.hl(-1);
    say('偷吃步：英文叫 shortcut', 'Sequential search with cut');
    await step(tok);                                   // 57:08 但還是一本一本找
    glow(B[6], null);
    say('但還是一本一本找，到中間才能 cut', '能不能更早砍掉一大堆？');
  }]);

  // 57:41 binary search: compare with the middle, cut half
  const BSA = [1, 4, 6, 7, 9, 15, 25, 27, 30];
  FRAG.push(['arrlllin-binsearch-cut', 'Binary search：跟中間比', async (tok) => {
    fresh([0, 6, 12], [0, 0.6, 0]);
    const xs = spread(9, 1.3);
    let S = [], fl, ml;
    const reset = () => S.forEach((m) => { tint(m, C.v); glow(m, null); m.position.y = 0.35; });
    await step(tok);                                   // 57:41 比一次就砍掉一堆不可能的
    say('更多偷吃步：比一次就砍掉一大堆', '前提：array 是 ordered');
    await step(tok);                                   // 57:49 binary search
    say('這個演算法叫 Binary search', '');
    await step(tok);                                   // 57:59 畫 9 格、放數字
    cells(xs, 0, { w: 1.15 });
    S = BSA.map((v, i) => vc(v, xs[i], 0, 3, C.v, [0.95, 0.7, 0.95]));
    say('9 格排好的數字', '1, 4, 6, 7, 9, …');
    await step(tok);                                   // 58:35 要找 8：先跟中間比
    fl = tag('toFind = 8', 'ptr alt', 0, 2.4, 0); ml = tag('mid', 'ptr', xs[4], 1.4, 0);
    glow(S[4], GOLD);
    say('要找 8：先跟最中間的比', 'mid = 4，arr[4] = 9');
    await step(tok);                                   // 59:36 三種情形：小於、等於、大於
    say('比完有三種情形', 'arr[mid] 小於、等於、大於 toFind');
    await step(tok);                                   // 59:50 9 > 8：arr[mid] > toFind
    say('9 > 8：arr[mid] > toFind', '');
    await step(tok);                                   // 60:08 cut mid … tail
    for (let k = 4; k < 9; k++) { tint(S[k], C.dim); S[k].position.y = 0.12; }
    say('mid 和後面全都比 8 大：cut mid … tail', '一次比較砍掉 5 個');
    await step(tok);                                   // 60:30 換成找 11：9 < 11
    reset(); txt(fl, 'toFind = 11'); glow(S[4], GOLD);
    say('換成找 11：9 < 11', 'arr[mid] < toFind');
    await step(tok);                                   // 60:58 另一個方向的 cut：0 … mid
    for (let k = 0; k <= 4; k++) { tint(S[k], C.dim); S[k].position.y = 0.12; }
    say('9、7、6、4、1 都不可能：cut 0 … mid', '另一個方向的 cut');
    await step(tok);                                   // 61:29 相等就找到
    reset(); txt(fl, 'toFind = 9'); glow(S[4], GOLD); tint(S[4], C.ok);
    say('相等：找到了', 'arr[mid] == toFind');
    await step(tok);                                   // 61:43 每次：要嘛找到，要嘛砍掉超過一半
    showL(ml, false);
    say('每比一次：要嘛找到，要嘛砍掉超過一半', 'Binary search');
  }]);

  // 62:20 the binary search algorithm, traced
  FRAG.push(['arrlllin-binsearch-run', 'Binary search 演算法', async (tok) => {
    fresh([0, 5.6, 13], [0, 2.6, 0]);
    const xs = spread(9, 1.3), z = 1.4; cells(xs, z, { w: 1.15 });
    const S = BSA.map((v, i) => vc(v, xs[i], z, 0, C.v, [0.95, 0.7, 0.95]));
    const cd = code(['begin = 0; end = tail;', 'while (begin <= end) {  // 還有書可找', '  mid = (begin + end) / 2;', '  if (arr[mid] > toFind) end = mid - 1;', '  else if (arr[mid] < toFind) begin = mid + 1;', '  else return mid;', '}', 'return NOT_FOUND;'], 0, 6.7, 0.48, -1.8);
    const rb = ghostBox(C.ok, 1, 0.9, 1.3); rb.visible = false;
    const bL = tag('begin', 'ptr', xs[0], 0.05, z + 1.6), eL = tag('end', 'ptr', xs[8], 0.05, z + 2.2), mL = tag('mid', 'ptr alt', xs[4], 1.5, z);
    showL(bL, false); showL(eL, false); showL(mL, false);
    tag('toFind = 8', 'ptr alt', -5.9, 1.6, z);
    const cl = (i) => xs[Math.max(0, Math.min(8, i))];
    function range(b, e) {
      at(bL, cl(b), 0.05, z + 1.6); at(eL, cl(e), 0.05, z + 2.2);
      rb.visible = b <= e;
      if (b <= e) { rb.scale.x = (e - b) * 1.3 + 1.2; rb.position.set((xs[b] + xs[e]) / 2, 0.45, z); }
      S.forEach((m, k) => tint(m, k >= b && k <= e ? C.v : C.dim));
    }
    let b = 0, e = 8;
    const mid = (m) => { showL(mL, true); at(mL, xs[m], 1.5, z); S.forEach((s) => glow(s, null)); glow(S[m], GOLD); };
    await step(tok);                                   // 62:20 每一步算一個 mid
    cd.hl(2); mid(4);
    say('每一步：算出中間 mid', 'mid = (begin + end) / 2');
    await step(tok);                                   // 62:37 begin 從 0、end 從 tail
    cd.hl(0); showL(bL, true); showL(eL, true); range(0, 8);
    say('begin = 0，end = tail：這是搜尋範圍', '找 8：範圍 [0, 8]，mid = 4');
    await step(tok);                                   // 63:00 arr[mid] > toFind：end = mid − 1
    cd.hl(3); e = 3; range(b, e);
    say('arr[4] = 9 > 8：cut mid … tail', 'end = mid − 1 = 3');
    await step(tok);                                   // 63:23 arr[mid] < toFind：begin = mid + 1
    cd.hl(2); mid(1);
    await beat(tok, 700);
    cd.hl(4); b = 2; range(b, e);
    say('mid = 1：arr[1] = 4 < 8 → cut 0 … mid', 'begin = mid + 1 = 2');
    await step(tok);                                   // 63:35 每一輪縮小搜尋範圍
    cd.hl(2); mid(2); await beat(tok, 500); cd.hl(4); b = 3; range(b, e);
    await beat(tok, 600);
    cd.hl(2); mid(3); await beat(tok, 500); cd.hl(4); b = 4; range(b, e);
    say('每一輪把範圍縮小一點', '6 < 8 → begin = 3；7 < 8 → begin = 4');
    await step(tok);                                   // 63:57 縮到沒書可找：NOT_FOUND
    showL(mL, false); S.forEach((s) => glow(s, null));
    cd.hl(7);
    say('begin = 4 > end = 3：沒書可找了', 'return NOT_FOUND（8 不在裡面）');
    await step(tok);                                   // 64:22 「沒書可找」怎麼寫：留作 exercise
    cd.hl(1);
    say('「還有書可找」怎麼寫？留作 exercise', '');
    await step(tok);                                   // 64:48 要能很快算出 arr[mid]
    cd.hl(-1);
    say('Binary search 要成功：要能很快拿到 arr[mid]', '');
    await step(tok);                                   // 65:08 array：fast random access
    glow(S[4], GOLD);
    say('Array 給 index 就一步到位', 'fast random access：其他 DS 做不到');
    await step(tok);                                   // 65:41 每次砍一半：9 → 4 → 2 → 1
    glow(S[4], null);
    say('每次砍一半：9 個 → 4 個 → 2 或 1 個', '很快就找到，或確定不在');
    await step(tok);                                   // 66:08 好處找得快、壞處要維護
    say('Ordered 的好處：找得快', '壞處：maintenance 要花力氣');
  }]);

  // 83:15 correctness: loop invariant + finiteness
  FRAG.push(['arrlllin-bs-invariant', 'Binary search 的正確性', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const xs = spread(9, 1.3); cells(xs, 0, { w: 1.15 });
    const S = BSA.map((v, i) => vc(v, xs[i], 0, 0, C.v, [0.95, 0.7, 0.95]));
    const rb = ghostBox(C.ok, 1, 0.9, 1.3); rb.visible = false;
    const cnt = tag('', 'ptr alt', 0, 2.4, 0);
    tag('toFind = 8', 'ptr', -5.6, 1.4, 0);
    function range(b, e) {
      rb.visible = b <= e;
      if (b <= e) { rb.scale.x = (e - b) * 1.3 + 1.2; rb.position.set((xs[b] + xs[e]) / 2, 0.45, 0); }
      S.forEach((m, k) => tint(m, k >= b && k <= e ? C.v : C.dim));
      txt(cnt, 'candidate：[' + b + ', ' + e + ']，共 ' + Math.max(0, e - b + 1) + ' 個');
    }
    await step(tok);                                   // 83:15 怎麼證明 binary search 是對的？
    say('同學問：怎麼證明 binary search 是對的？', '');
    await step(tok);                                   // 83:48 有迴圈：找每輪都維持的性質
    say('有迴圈的演算法：找每一輪都維持的性質', '');
    await step(tok);                                   // 84:34 binary search 在維持範圍
    range(0, 8);
    say('Binary search 在維持一個範圍', '要找的東西若存在，一定還在範圍裡');
    await step(tok);                                   // 84:50 0..tail → 0..mid−1 或 mid+1..tail
    say('一開始是 [0, tail]', '下一步變 [0, mid − 1] 或 [mid + 1, tail]');
    await step(tok);                                   // 85:17 arr[mid] > toFind 時
    glow(S[4], GOLD);
    say('arr[mid] > toFind 時：為什麼後面能排除？', 'arr[4] = 9 > 8');
    await step(tok);                                   // 85:55 排好的順序：遞移律
    glow(S[4], null); range(0, 3);
    say('9 ≤ 15 ≤ 25 ≤ 27 ≤ 30：遞移律', '後面全都 > 8 → 排除；[0, 8] → [0, 3]');
    await step(tok);                                   // 86:29 loop invariant 說明正確
    say('Loop invariant：要找的一定還在範圍內', '用它說明演算法正確');
    await step(tok);                                   // 86:41 正確性還包含：會停
    say('正確性還包含：一定會停（finiteness）', '');
    await step(tok);                                   // 87:07 candidate 數量每輪少一半
    for (const [b, e] of [[2, 3], [3, 3], [4, 3]]) { range(b, e); await beat(tok, 600); }
    say('剩下的 candidate 數量每輪至少少一半', '4 個 → 2 個 → 1 個 → 0 個');
    await step(tok);                                   // 87:46 不能無限少下去 → 會停
    say('數量有下限，不能無限少下去', '→ 迴圈一定會停');
    await step(tok);                                   // 88:33 跟作業的 Euclid（GCD）證明類似
    say('作業的 GCD（Euclid）演算法也是同一套想法', '什麼東西每輪變小？有沒有下限？');
  }]);

  // 89:11 ternary vs binary with the same number of comparisons
  FRAG.push(['arrlllin-ternary', '分三區會更快嗎？', async (tok) => {
    fresh([0, 7.5, 9.5], [0, 0, 0.2]);
    const xs = spread(36, 0.32);
    const rowB = xs.map((x) => cube('', C.v, [0.27, 0.3, 0.6], x, 0.15, -1.4));
    const rowT = xs.map((x) => cube('', C.pr, [0.27, 0.3, 0.6], x, 0.15, 1.6));
    const lb = tag('Binary：剩 36', 'ptr', 0, 0.9, -2.5), lt = tag('Ternary（分三區）：剩 36', 'ptr alt', 0, 0.9, 2.7);
    const cut = (row, a, b) => { for (let k = a; k < b; k++) { tint(row[k], C.dim); row[k].position.y = 0.05; } };
    await step(tok);                                   // 89:11 分三區會比較快嗎？
    say('同學問：array 分三區搜尋會更快嗎？', '可以分三區，沒人限制');
    await step(tok);                                   // 89:28 分三區 = 要做兩個比較才能 cut
    glow(rowT[12], GOLD); glow(rowT[24], GOLD);
    say('分三區：要比兩次，才知道落在哪一區', '跟 1/3、2/3 兩個點比');
    await step(tok);                                   // 89:47 binary：兩次比較 → 剩 1/4
    glow(rowB[18], GOLD); await beat(tok, 500);
    cut(rowB, 18, 36); glow(rowB[18], null); txt(lb, 'Binary：1 次比較，剩 18');
    await beat(tok, 600);
    glow(rowB[9], GOLD); await beat(tok, 500);
    cut(rowB, 9, 18); glow(rowB[9], null); txt(lb, 'Binary：2 次比較，剩 9（1/4）');
    say('Binary：每次比較就砍一半', '兩次比較 → 範圍剩 1/4');
    await step(tok);                                   // 90:07 分三區：兩次比較只剩 1/3
    cut(rowT, 12, 36); glow(rowT[12], null); glow(rowT[24], null); txt(lt, 'Ternary：2 次比較，剩 12（1/3）');
    say('分三區：兩次比較只剩 1/3', '1/3 > 1/4：砍得比較少');
    await step(tok);                                   // 90:25 binary 比較有效率
    say('同樣兩次比較：binary search 比較有效率', 'discrete 搜尋時看不到三分更好');
    await step(tok);                                   // 90:44 數值方法求極值時，三分有好處
    say('三分搜尋在數值方法求極值時有用', '同樣概念可以用在別的地方');
    await step(tok);                                   // 91:13 除非硬體能很快三方比較
    say('除非硬體能很快做三方比較', '用兩兩比較來做，就沒那麼大好處');
  }]);

  // 91:53 array recap
  FRAG.push(['arrlllin-array-recap', 'Array 小結', async (tok) => {
    fresh([0, 6, 11.5], [0, 0.8, 0]);
    const xs = spread(7, 1.45); cells(xs, 0);
    const S = [2, 6, 7, 10, 13].map((v, i) => vc(v, xs[i]));
    let p;
    await step(tok);                                   // 91:53 Array 部分先講到這裡
    say('Array 的部分先講到這裡', '還有很多更有趣的 data structure 要講');
    await step(tok);                                   // 92:21 array 不只是宣告：和整塊記憶體的關係
    xs.forEach((x, i) => tag(String(1000 + 4 * i), 'idx', x, 0.05, -1.25));
    say('Array 不只是 C 裡的 malloc 或宣告', '要了解它跟整塊記憶體的關係（位址 = 1000 + 4i）');
    await step(tok);                                   // 92:40 fast random access
    p = tag('arr[3]', 'ptr', xs[3], 1.4, 0); glow(S[3], GOLD);
    say('關鍵性質：Fast random access', 'arr[3] → 1000 + 4 × 3 = 1012，一步到位');
    await step(tok);                                   // 92:47 加上 consecutive、ordered 條件
    glow(S[3], null); kill(p);
    const g = ghostBox(C.ok, 5 * 1.45 - 0.2, 0.9, 1.6); g.position.set((xs[0] + xs[4]) / 2, 0.45, 0);
    tag('tail', 'ptr alt', xs[4], 1.4, 0);
    say('再加上條件：consecutive、ordered', '2 ≤ 6 ≤ 7 ≤ 10 ≤ 13');
    await step(tok);                                   // 92:53 設計出更好的演算法：圖書館找書
    glow(S[2], GOLD);
    say('可以設計出更好的演算法', '例：圖書館找書 → binary search');
    await step(tok);                                   // 93:11 上次的支線：2D array 等
    glow(S[2], null);
    say('上次的支線：2D array 的記憶體用法', '特殊 array 省空間、architecture 上的考量');
  }]);

  // 94:01 polynomial as ordered array of (exp, coef)
  const FP = [[0, 5], [1, 1], [2, -4], [5, 10], [16, 1]];
  const pl = (e, c) => '(' + e + ', ' + c + ')';
  FRAG.push(['arrlllin-poly-array', '多項式存成 pair 的 ordered array', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0.4]);
    const xs = spread(5, 1.9);
    const fs = [];
    let ft;
    await step(tok);                                   // 94:01 進入 linked list：指標的痛苦回憶
    say('下一個課題：Linked list', '很多人學 C 的指標時有點痛苦的回憶');
    await step(tok);                                   // 95:18 從和 array 的不同、應用場景切入
    say('這裡從「和 array 哪裡不同」切入', '再看它用在什麼場景');
    await step(tok);                                   // 96:07 例：f(x) 多項式
    ft = tag('f(x) = 5 + x + 4x² + 10x⁵ + x¹⁶', 'ptr alt', 0, 2.6, -2.6);
    say('例：一個多項式 f(x)', '寫科學計算軟體：多項式怎麼存？');
    await step(tok);                                   // 96:55 要存係數和它是幾次方
    say('要存的：每一項的係數，以及它是幾次方', '5 在 x⁰、1 在 x¹、4 在 x² …');
    await step(tok);                                   // 97:31 把 4 改成 −4
    txt(ft, 'f(x) = 5 + x − 4x² + 10x⁵ + x¹⁶');
    say('把 4 改成 −4，比較不枯燥', '');
    await step(tok);                                   // 97:48 存成一個一個的 pair
    cells(xs, -0.8, { w: 1.75 });
    for (let k = 0; k < 5; k++) { const [e, c] = FP[k]; fs.push(vc(pl(e, c), xs[k], -0.8, 3, C.v, PS)); await beat(tok, 300); }
    tag('f', 'ptr', xs[0] - 1.5, 0.9, -0.8);
    say('存成一個一個的 pair', '(0,5) (1,1) (2,−4) (5,10) (16,1)');
    await step(tok);                                   // 98:06 前面是指數、後面是係數
    say('pair 前面是指數，後面是係數', '5 個 pair 就表示了 f');
    await step(tok);                                   // 98:38 另一個多項式 g
    cells([xs[0], xs[1]], 1.6, { w: 1.75, idx: false });
    tag('g', 'ptr alt', xs[0] - 1.5, 0.9, 1.6);
    vc(pl(0, 3), xs[0], 1.6, 3, C.pr, PS); vc(pl(5, 6), xs[1], 1.6, 3, C.pr, PS);
    say('另一個多項式 g(x) = 3 + 6x⁵', '(0, 3)、(5, 6)');
    await step(tok);                                   // 99:46 按指數順序寫，加法容易對齊
    say('習慣按指數順序寫', '兩式相加時，容易看出哪些項要合併');
    await step(tok);                                   // 100:38 → ordered array（by exponent）
    for (const m of fs) { glow(m, GOLD); await beat(tok, 250); glow(m, null); }
    say('按指數排好存 → ordered array', 'ordered by exponent：0 < 1 < 2 < 5 < 16');
  }]);

  // 101:23 insert / remove / resize hurt on the ordered array
  FRAG.push(['arrlllin-poly-array-ops', 'Ordered array 存多項式的麻煩', async (tok) => {
    fresh([0, 6.5, 12], [0, 0.6, 0]);
    const xs = spread(7, 1.75); cells(xs, 0, { w: 1.6 });
    const S = FP.map(([e, c], i) => vc(pl(e, c), xs[i], 0, 0, C.v, PS)); S.push(null, null);
    async function shiftFrom(pos, nc) {
      let t = S.indexOf(null) - 1;
      for (; t >= pos; t--) { move(S[t], xs[t + 1], 0.35, 0); S[t + 1] = S[t]; S[t] = null; await beat(tok, 300); }
      S[pos] = nc; move(nc, xs[pos], 0.35, 0);
    }
    let n36, nm2;
    await step(tok);                                   // 101:23 這個 solution 的好處和壞處？
    say('用 ordered array 存 f：好處和壞處？', 'f = (0,5) (1,1) (2,−4) (5,10) (16,1)');
    await step(tok);                                   // 102:11 f(x) + 6x³
    n36 = vc(pl(3, 6), xs[3], 0, 0, C.hot, PS); n36.position.y = 2.3;
    say('f(x) + 6x³：要加入 pair (3, 6)', '它該排在 (2,−4) 後面');
    await step(tok);                                   // 103:11 cut in：後面往後擠
    await shiftFrom(3, n36);
    say('就是 ordered array 的 insertion', 'cut in（插隊）：後面的往後擠、資料要搬');
    await step(tok);                                   // 103:38 靠近尾巴還好；靠前面要搬很多
    say('插在靠近尾巴的地方還好', '靠前面的話，要搬好多東西');
    await step(tok);                                   // 103:54 f(x) − 4x⁻²：插到最前面
    nm2 = vc(pl(-2, -4), xs[0], 0, 0, C.hot, PS); nm2.position.y = 2.3;
    await beat(tok, 400);
    await shiftFrom(0, nm2);
    say('f(x) − 4x⁻²：(−2, −4) 要插到最前面', '全部往後搬：不太 flexible');
    await step(tok);                                   // 104:30 f(x) − 10x⁵：這一項變 0
    glow(S[5], RED);
    say('f(x) − 10x⁵：這一項變成 0', '要把它拿掉');
    await step(tok);                                   // 104:59 拿掉後，後面往前搬
    fly(S[5]); S[5] = null;
    await beat(tok, 400);
    move(S[6], xs[5], 0.35, 0); S[5] = S[6]; S[6] = null;
    say('拿掉後，後面的要往前搬', '(16, 1) 往前一格');
    await step(tok);                                   // 105:13 resizing：f(x)·(x + 1)
    say('f(x)·(x + 1)：結果變大，要 resize', '');
    await step(tok);                                   // 105:46 拿不到一塊連續的記憶體
    const gb = ghostBox(C.bad, 13.6, 0.9, 1.7); gb.position.set(0, 0.45, 0);
    say('需要一整塊連續記憶體', '連續的區塊有限，不一定拿得到');
    await step(tok);                                   // 106:19 不用 binary search 時不見得值得
    say('如果用不到 binary search 這類好處', '維持 ordered array 不見得值得');
    await step(tok);                                   // 106:36 linked list：能不能不要這麼麻煩
    say('Linked list 的出發點', '能不能不要這麼麻煩？');
  }]);

  // 107:33 memory addresses + next notes → linked list
  FRAG.push(['arrlllin-poly-ll', '小紙條 next 與 head', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.3, -0.8]);
    const AD = [1001, 1002, 1003, 1004, 1005], xs = spread(5, 2.1), z = 0.6;
    cells(xs, z, { w: 1.85 });
    const S = FP.map(([e, c], i) => vc(pl(e, c), xs[i], z, 0, C.v, PS));
    const adL = xs.map((x, i) => { const l = tag(String(AD[i]), 'idx', x, 1.05, z); showL(l, false); return l; });
    const nx = xs.map((x) => tag('', 'ptr alt', x, 0.05, z - 1.2));
    const nX = 1.05, nZ = -2.7;
    let p, N, nN;
    const walk = async (path, ms) => { for (const [x, zz] of path) { at(p, x, 1.7, zz); await beat(tok, ms); } };
    await step(tok);                                   // 107:33 array index 也是 memory index
    adL.forEach((l) => showL(l, true));
    say('Array 的 index 其實就是記憶體位址', 'index 0 … 4 ↔ 1001 … 1005');
    await step(tok);                                   // 107:54 要把 6x³ 放進來
    say('現在要把 6x³，也就是 (3, 6) 放進來', '');
    await step(tok);                                   // 108:17 記下一項在哪：1002、1003
    txt(nx[0], 'next 1002'); await beat(tok, 300); txt(nx[1], 'next 1003');
    say('每一項記下「下一項在哪」', '第一項的下一項在 1002，再下一項在 1003');
    await step(tok);                                   // 108:41 1004、1005、沒有
    txt(nx[2], 'next 1004'); await beat(tok, 300); txt(nx[3], 'next 1005'); await beat(tok, 300); txt(nx[4], 'next 無');
    say('下一項在 1004、1005', '最後一項：沒有下一項');
    await step(tok);                                   // 109:03 從 1001 進來，一項一項找
    p = tag('p', 'ptr', xs[0], 1.7, z);
    await walk(xs.map((x) => [x, z]), 300);
    say('從 1001 進來，順著找下一項', '1001 → 1002 → 1003 → 1004 → 1005');
    await step(tok);                                   // 109:29 (3, 6) 放在別處 1126
    showL(p, false);
    slotTile(V3(nX, 0.02, nZ), 1.85, 1.4);
    tag('1126', 'idx', nX, 1.05, nZ);
    N = vc(pl(3, 6), nX, nZ, 3, C.hot, PS);
    nN = tag('next ?', 'ptr alt', nX, 0.05, nZ - 1.15);
    say('(3, 6) 要放在 (2,−4) 和 (5,10) 中間', '但它其實放在別的地方：1126');
    await step(tok);                                   // 109:43 (2,−4) 的下一項是 1126
    glow(S[2], GOLD); txt(nx[2], 'next 1126');
    say('(2, −4) 的下一項改成 1126', '');
    await step(tok);                                   // 109:56 (3, 6) 的下一項是 1004
    glow(S[2], null); glow(N, GOLD); txt(nN, 'next 1004');
    say('(3, 6) 的下一項是 1004', '只改了兩張小紙條');
    await step(tok);                                   // 110:05 用箭頭畫
    glow(N, null);
    arrow(V3(xs[2] + 0.2, 0.8, z - 0.4), V3(nX - 0.2, 0.8, nZ + 0.55), 0xc08a1f);
    arrow(V3(nX + 0.3, 0.8, nZ + 0.55), V3(xs[3] - 0.2, 0.8, z - 0.4), 0xc08a1f);
    say('常用箭頭來畫：看完 (2,−4) 去 1126', '在 1126 再拿到下一張小紙條');
    await step(tok);                                   // 110:56 坐別處也行，別失聯 → linked list
    say('坐在別的地方也沒關係', '只要留下聯絡方式、不失聯 → Linked list');
    await step(tok);                                   // 111:24 抽屜多放一張小紙條
    say('每個抽屜要大一點', '兩個數字 + 一張小紙條');
    await step(tok);                                   // 112:10 1001 1002 1003 1126 1004 1005
    showL(p, true);
    await walk([[xs[0], z], [xs[1], z], [xs[2], z], [nX, nZ], [xs[3], z], [xs[4], z]], 350);
    say('從前面找到後面', '1001 → 1002 → 1003 → 1126 → 1004 → 1005');
    await step(tok);                                   // 112:24 小紙條叫 next，開頭那張叫 head
    showL(p, false);
    tag('head = 1001', 'ptr', xs[0] - 0.4, 1.7, z);
    say('記下一項的小紙條叫 next', '一開始那張叫 head');
    await step(tok);                                   // 112:41 linked list = 維持小紙條的正確性
    say('Linked list：維持這些小紙條的正確性', '');
  }]);

  // 112:58 insert after with the standard drawing
  FRAG.push(['arrlllin-insert-after', 'insert after：改兩張小紙條', async (tok) => {
    fresh([0, 6, 12], [0, 1.2, 0]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(5,10)', '(16,1)'], AD = [1001, 1002, 1003, 1004, 1005];
    const xs = spread(5, 2.3);
    let G = [], adL = [], ar = [], nul, hd, cd, nl, N, nAd, a1, a2;
    const mx = (xs[2] + xs[3]) / 2;
    await step(tok);                                   // 112:58 一般的 linked list 畫法
    G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    adL = AD.map((a, i) => tag(String(a), 'idx', xs[i], 0.05, 1.0));
    ar = slinks(xs, 0);
    nul = tag('NULL', 'idx', xs[4] + 1.5, 0.35, 0);
    say('一般畫法：內容 + 一張小紙條', '(0,5) 的小紙條寫 1002，依序串下去');
    await step(tok);                                   // 113:32 head 這張小紙條
    hd = tag('head', 'ptr', xs[0], 1.3, 0);
    say('head：一開始請去 1001', '');
    await step(tok);                                   // 113:53 代價：多付出小紙條的空間
    say('代價：有幾項，就多幾張小紙條的空間', '');
    await step(tok);                                   // 114:02 換到：insert after 不必放特定位置
    say('換到：insert after 時不必放在特定位置', '放別處，設定好小紙條就行');
    await step(tok);                                   // 114:30 資料 + 小紙條 = node
    G.forEach((g) => glow(g.userData.data, GOLD));
    say('資料 + 小紙條 = node（節點）', '');
    await step(tok);                                   // 115:00 insert after 1003 這個 node
    G.forEach((g) => glow(g.userData.data, null));
    cd = code(['newNode = Node(data);      // 放在 1126', 'newNode.next = node.next;  // = 1004', 'node.next = newNode;       // = 1126'], 0, 5.2, 0.52, -1.5);
    glow(G[2].userData.data, GOLD); nl = tag('node', 'ptr alt', xs[2], 1.3, 0);
    say('insertAfter(node = 1003, (3, 6))', '插在 (2,−4) 後面');
    await step(tok);                                   // 115:24 用 data 做出新的 node（1126）
    cd.hl(0); N = lnode('(3,6)', mx, 2.4, 0, C.hot); nAd = tag('1126', 'idx', mx, 3.1, 0);
    say('用 data 做出一個新的 node', 'newNode，放在 1126');
    await step(tok);                                   // 116:01 newNode.next = node.next
    cd.hl(1); a1 = arrow(V3(mx + 0.96, 2.4, 0), V3(xs[3] - 0.3, 0.8, 0), 0xc08a1f);
    say('newNode.next = node.next', '新 node 的小紙條抄原本的 1004');
    await step(tok);                                   // 116:13 node.next = newNode
    cd.hl(2); kill(ar[2]); a2 = arrow(V3(xs[2] + 0.96, 0.6, 0), V3(mx - 0.52, 2.2, 0), 0xc08a1f);
    say('node.next = newNode', '1003 的小紙條改成 1126');
    await step(tok);                                   // 116:23 幾行程式 = 圖上兩個箭頭
    say('兩行程式 = 圖上兩個箭頭', '資料完全不用搬');
    await step(tok);                                   // 117:05 從頭串到尾、單一方向 → singly
    cd.hl(-1); glow(G[2].userData.data, null);
    const nx = spread(6, 2.1), order = [G[0], G[1], G[2], N, G[3], G[4]], ads = [...adL.slice(0, 3), nAd, ...adL.slice(3)];
    order.forEach((g, i) => move(g, nx[i], 0.35, 0));
    ads.forEach((l, i) => at(l, nx[i], 0.05, 1.0));
    kill(a1); kill(a2); ar.forEach(kill); ar = slinks(nx, 0);
    at(nul, nx[5] + 1.4, 0.35, 0); at(hd, nx[0], 1.3, 0); at(nl, nx[2], 1.3, 0);
    say('從頭串到尾、單一方向：Singly linked list', '… → (2,−4) → (3,6) → (5,10) → …');
    await step(tok);                                   // 117:29 大地遊戲：一關一關跑
    const p = tag('p', 'ptr', nx[0], 1.9, 0);
    for (let k = 1; k < 6; k++) { at(p, nx[k], 1.9, 0); await beat(tok, 300); }
    say('像大地遊戲：一關一關跑下去', '小紙條沒寫錯，就會從起點跑到終點');
  }]);

  // 122:35 routines: get by walking, insert at head (head is special)
  FRAG.push(['arrlllin-insert-head', 'get 與插在最前面', async (tok) => {
    fresh([0, 6.5, 11.5], [0, 1.0, -0.6]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)'], xs = [-2.4, -0.1, 2.2, 4.5];
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    const ar = slinks(xs, 0); tag('NULL', 'idx', xs[3] + 1.4, 0.35, 0);
    let H, ha, cd, p, N;
    await step(tok);                                   // 122:35 node 不必連續 → 不用搬資料
    say('Node 不必在一起 → 不用搬其他資料', '每個 node 資料很肥大時，差很多');
    await step(tok);                                   // 122:43 另一選擇：ordered array 只存小紙條
    say('另一個選擇：ordered array 只存小紙條', '要搬時只搬紙條，不搬資料');
    await step(tok);                                   // 123:45 routine：head
    H = cube('head', C.note, [1.0, 0.7, 1.0], -5.3, 0.35, 0);
    ha = arrow(V3(-4.8, 0.35, 0), V3(xs[0] - 0.52, 0.35, 0), 0xc08a1f);
    say('Linked list 的 routine：head', '第一張小紙條在哪');
    await step(tok);                                   // 123:53 每個 node 的 next
    ar.forEach((a) => a.setColor(new THREE.Color(0xc08a1f)));
    say('還有：每個 node 的 next', '下一個 node 在哪');
    await step(tok);                                   // 124:40 get：走三步到這個 node
    cd = code(['get(node):          return node.data', 'insertAfter(node,d): new.next = node.next; node.next = new', 'insertHead(d):       new.next = head;      head = new'], 0, 5.4, 0.55, -2.2);
    p = tag('p', 'ptr', -5.3, 1.3, 0);
    for (let k = 0; k < 3; k++) { at(p, xs[k], 1.3, 0); await beat(tok, 450); }
    say('get：先照小紙條走到那個 node', 'p = head → p.next → p.next（走三步）');
    await step(tok);                                   // 124:47 走到了才能拿內容
    cd.hl(0); glow(G[2].userData.data, GOLD);
    say('走到 node 之後，才能拿裡面的內容', 'get = (2,−4)');
    await step(tok);                                   // 125:21 insert after：重設兩個 pointer
    glow(G[2].userData.data, null); showL(p, false);
    cd.hl(1);
    say('insertAfter：重新設定兩個 pointer', '');
    await step(tok);                                   // 126:29 要插在最前面
    cd.hl(2);
    N = lnode('(-2,-4)', -4.2, 2.6, -2.4, C.hot);
    move(N, -4.2, 0.35, -2.4);
    tag('1126', 'idx', -4.2, 1.2, -2.4);
    say('如果要插在最前面呢？', '低次項 (−2,−4) 放在 1126');
    await step(tok);                                   // 126:41 head 要改指新的 node
    arrow(V3(-3.3, 0.35, -2.4), V3(xs[0] - 0.5, 0.35, -0.3), 0xc08a1f);
    await beat(tok, 500);
    kill(ha); ha = arrow(V3(-5.3, 0.35, -0.5), V3(-4.75, 0.35, -2.0), 0xc08a1f); glow(H, GOLD);
    say('new.next = head；head = new', 'head 改指 1126');
    await step(tok);                                   // 126:57 head 是特別的小紙條：不在 node 裡
    say('一樣換兩張小紙條，但其中一張是 head', 'head 很特別：它不在任何 node 裡');
    await step(tok);                                   // 127:33 只寫一個 routine 就插不到最前面
    glow(H, null);
    say('只寫 insertAfter、沒寫 insertHead', '就沒辦法插到最前面');
    await step(tok);                                   // 127:52 邊緣情形讓 code 難寫
    say('這類邊緣情形', '讓 linked list 的程式比較難寫');
  }]);

  // 128:12 random access vs sequential access
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
    await step(tok);                                   // 128:12 array：random access
    at(pa, ax[3], 1.4, az); txt(pa, 'index 3'); glow(A[3], GOLD);
    say('一句話比較：Array 是 random access', '給 index，幾乎馬上拿到');
    await step(tok);                                   // 128:26 linked list：sequential access
    for (let k = 1; k <= 3; k++) { at(pl_, lx[k], 1.3, lz); txt(pl_, 'p = p.next'); await beat(tok, 450); }
    glow(G[3].userData.data, GOLD);
    say('Linked list 是 sequential access', '像大地遊戲：跑到那一關才拿得到');
    await step(tok);                                   // 128:48 ordered linked list 的維護和 ordered array 類似
    glow(A[3], null); glow(G[3].userData.data, null);
    say('Ordered linked list：維護也麻煩', '跟 ordered array 類似：麻煩都來自「要排好」');
    await step(tok);                                   // 129:05 一般 linked list：建立很 trivial
    say('一般的 linked list：不管順序', '要 5 個：做 5 個 node 串起來就好');
    await step(tok);                                   // 129:26 已知 node 時 update 也 trivial
    glow(G[1].userData.data, GOLD);
    say('已經找到某個 node，要 update 內容', '跟 array 有 index 時一樣簡單');
    await step(tok);                                   // 129:36 node 就是一個特別長的 index
    say('Node 就是一個 memory address', '像一個特別長的 index');
  }]);

  // 129:49 remove after with a temp
  FRAG.push(['arrlllin-remove-after', 'remove after', async (tok) => {
    fresh([0, 6, 12], [0, 1.4, 0]);
    const L = ['(1,1)', '(2,-4)', '(3,6)', '(5,10)'], AD = ['1002', '1003', '1126', '1234'], xs = spread(4, 2.7);
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    const adL = AD.map((a, i) => tag(a, 'idx', xs[i], 0.05, 1.0));
    let ar = slinks(xs, 0), cd, tl, jump;
    await step(tok);                                   // 129:49 remove 也很 flexible
    say('比較有趣的是 remove', '它一樣很 flexible');
    await step(tok);                                   // 129:57 把 node 的下一個移掉
    const nl = tag('node', 'ptr', xs[1], 1.3, 0);
    glow(G[1].userData.data, GOLD);
    say('removeAfter(node)：移掉 node 的下一個', '');
    await step(tok);                                   // 130:09 原本指 1126，1126 指 1234
    glow(G[2].userData.data, RED);
    say('node.next 原本是 1126', '1126 的 next 是 1234');
    await step(tok);                                   // 130:17 只要把小紙條換成 1234
    say('只要把 node 的小紙條換成 1234', '再把中間那塊處理掉');
    await step(tok);                                   // 130:30 node.next = node.next.next
    cd = code(['tmp = node.next;       // 1126，先存起來', 'node.next = tmp.next;  // 1234', 'free(tmp);'], 0, 5.2, 0.55, -1.6);
    cd.hl(1);
    say('步驟：node.next = node.next.next', '1126 換成 1234');
    await step(tok);                                   // 130:58 直接換掉就找不回中間 → 先存 tmp
    cd.hl(0); tl = tag('tmp', 'ptr alt', xs[2], 1.3, 0);
    say('直接換掉，就找不回中間那個了', '所以先用暫存變數記下來：tmp = 1126');
    await beat(tok, 900);
    cd.hl(1); kill(ar[1]); kill(ar[2]);
    jump = arrow(V3(xs[1] + 0.9, 0.95, 0), V3(xs[3] - 0.45, 0.95, 0), 0xc08a1f);
    await step(tok);                                   // 131:19 最後把它 free 掉
    cd.hl(2); fly(G[2]); kill(tl); kill(adL[2]);
    await beat(tok, 500);
    kill(jump); move(G[3], xs[2], 0.35, 0); at(adL[3], xs[2], 0.05, 1.0);
    ar = slinks([xs[0], xs[1], xs[2]], 0, [ar[0]]);
    say('free(tmp)：把中間那塊還回去', '改小紙條 + free = remove after');
    await step(tok);                                   // 131:34 head 和非 head 可能要分開做
    cd.hl(-1); glow(G[1].userData.data, null); kill(nl);
    say('跟 insert 一樣', 'head 和非 head 可能要分開處理');
  }]);

  // 131:44 dummy head
  FRAG.push(['arrlllin-dummy-head', 'Dummy head', async (tok) => {
    fresh([0, 6, 12], [0, 1.2, 0]);
    let xs = spread(4, 2.5);
    let G = ['(0,5)', '(1,1)', '(2,-4)'].map((v, i) => lnode(v, xs[i + 1], 0.35, 0, C.v));
    let ar = slinks(xs.slice(1), 0), D, hd, N;
    await step(tok);                                   // 131:44 不想分開處理 head
    say('不想把 head 和非 head 分開寫？', 'coding 技巧：dummy head');
    await step(tok);                                   // 131:53 最前面放一個空的 node
    D = lnode('—', xs[0], 0.35, 0, '#b9a582');
    ar = slinks(xs, 0, ar);
    say('最前面放一個空的 node', '裡面沒有真正有價值的 data');
    await step(tok);                                   // 132:13 用它的 next 放 head
    hd = tag('head（dummy）', 'ptr', xs[0], 1.3, 0);
    glow(D.userData.data, GOLD);
    say('用它的 next 偷偷當作 head', 'head 也在一個 node 裡了');
    await step(tok);                                   // 132:27 都能用 insert after
    glow(D.userData.data, null);
    const nx = spread(5, 2.3);
    N = lnode('(-2,-4)', nx[1], 2.4, 0, C.hot);
    move(D, nx[0], 0.35, 0); move(N, nx[1], 0.35, 0); G.forEach((g, i) => move(g, nx[i + 2], 0.35, 0));
    ar = slinks(nx, 0, ar); at(hd, nx[0], 1.3, 0);
    G = [N, ...G];
    say('插到最前面 = insertAfter(dummy, …)', '跟插在中間是同一份 code');
    await step(tok);                                   // 132:46 不用寫、維護兩份 code
    glow(G[0].userData.data, RED);
    await beat(tok, 500);
    fly(G[0]); G.shift();
    move(D, xs[0], 0.35, 0); G.forEach((g, i) => move(g, xs[i + 1], 0.35, 0));
    ar = slinks(xs, 0, ar); at(hd, xs[0], 1.3, 0);
    say('刪掉第一個 = removeAfter(dummy)', '不用寫兩份、維護兩份 code');
    await step(tok);                                   // 132:53 缺點：多用一個 node
    glow(D.userData.data, GOLD);
    say('缺點：多用一個 node 的記憶體', 'node 很大時更明顯');
    await step(tok);                                   // 133:10 用空間換 coding 方便性
    say('用空間換 coding 的方便性', '有人這樣做、有人不會：值不值得自己判斷');
    await step(tok);                                   // 133:24 就像 singly 用 next 換 flexibility
    glow(D.userData.data, null);
    say('就像 singly linked list', '用多放的 next，換記憶體操作的 flexibility');
  }]);

  // 134:52 why a prev pointer
  FRAG.push(['arrlllin-why-prev', '為什麼要 prev', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const L = ['(0,5)', '(1,1)', '(2,-4)', '(3,6)'], xs = spread(4, 2.6);
    const G = L.map((v, i) => lnode(v, xs[i], 0.35, 0, C.v));
    slinks(xs, 0); tag('NULL', 'idx', xs[3] + 1.4, 0.35, 0);
    tag('head', 'ptr', xs[0], 1.3, 0);
    tag('node', 'idx', xs[1], 0.05, 1.0); tag('node2', 'idx', xs[2], 0.05, 1.0);
    let p;
    await step(tok);                                   // 134:52 doubly：從需求出發
    say('下一個：Doubly linked list', '一樣從需求出發');
    await step(tok);                                   // 135:16 singly 只能 remove after
    glow(G[1].userData.data, GOLD);
    say('Singly：只能 removeAfter(node)', '要更新的是 node 自己的小紙條');
    await step(tok);                                   // 135:50 如果想 remove here(node2)？
    glow(G[1].userData.data, null); tint(G[2].userData.data, C.bad);
    say('如果想直接 removeHere(node2) 呢？', '看到它就想刪掉');
    await step(tok);                                   // 136:18 要更新的是前一關的小紙條
    glow(G[1].userData.data, GOLD);
    say('node2 自己可以 free 掉', '但要更新的是「前一關」的小紙條');
    await step(tok);                                   // 136:41 大地遊戲：沒通知前一關
    say('像大地遊戲：中間一關撤了，沒通知前一關', '前一關還叫人去那裡 → 找不到');
    await step(tok);                                   // 137:05 前一關不容易取得：只能從 head 找
    glow(G[1].userData.data, null);
    p = tag('p', 'ptr alt', xs[0], 1.9, 0);
    for (let k = 0; k < 2; k++) { at(p, xs[k], 1.9, 0); await beat(tok, 600); }
    say('Singly 裡前一關不好拿', '只能從 head 一路 next、next 找');
    await step(tok);                                   // 137:27 串很長時更麻煩
    say('串很長時，每次刪都要從頭找', '');
    await step(tok);                                   // 137:53 乾脆放兩張小紙條
    showL(p, false);
    say('乾脆每個 node 放兩張小紙條', '');
    await step(tok);                                   // 138:06 第二張：previous（前一關）
    for (let i = 3; i >= 1; i--) { arrow(V3(xs[i] - 0.55, 0.15, 0.45), V3(xs[i - 1] + 0.55, 0.15, 0.45), 0xc08a1f); await beat(tok, 350); }
    say('第一張 next：下一關；第二張 previous：前一關', 'prev');
    await step(tok);                                   // 138:42 從 tail 順著 prev 也能走
    tag('tail', 'ptr', xs[3], 1.3, 0);
    say('也可以從 tail 出發', '順著 prev、prev 走完每一個');
    await step(tok);                                   // 138:56 等於兩條 linked list
    say('等於兩條方向相反的 linked list', '→ Doubly linked list');
  }]);

  // 139:16 doubly linked list remove here (1111, 2345, 5566)
  FRAG.push(['arrlllin-dll-remove', 'Doubly linked list：remove here', async (tok) => {
    fresh([0, 6, 11], [0, 1.4, 0]);
    const xs = [-4, 0, 4], AD = ['1111', '2345', '5566'];
    let G = [], ar = [], n0, p1, n1, p2, cd;
    await step(tok);                                   // 139:16 每個 node 兩部分的連結
    G = AD.map((a, i) => dnode('', xs[i], 0, C.v, 3));
    ar = dlinks(xs, 0);
    say('Doubly linked list：每個 node 有兩種連結', '從 head 走 next；從 tail 走 prev');
    await step(tok);                                   // 139:41 兩個方向完全相反
    say('兩個方向完全相反', '一條順著走、一條反著走');
    await step(tok);                                   // 140:04 搞不清楚就把位址寫出來
    G.forEach((g, i) => relabelG(g, AD[i]));
    say('搞不清楚時：把小紙條上的位址寫出來', '1111、2345、5566');
    await step(tok);                                   // 140:32 小紙條上的數字
    n0 = tag('next 2345', 'ptr alt', xs[0] + 0.72, 1.0, 0);
    p1 = tag('prev 1111', 'idx', xs[1] - 0.72, 1.0, 0); n1 = tag('next 5566', 'idx', xs[1] + 0.72, 1.45, 0);
    p2 = tag('prev 2345', 'ptr alt', xs[2] - 0.72, 1.0, 0);
    say('每張小紙條上都有一個位址', '1111 → 2345 → 5566，反過來也是');
    await step(tok);                                   // 140:54 移掉 2345：5566 要接到 1111
    cd = code(['node.next.prev = node.prev;  // 5566.prev = 1111', 'node.prev.next = node.next;  // 1111.next = 5566', 'free(node);'], 0, 5.2, 0.55, -1.6);
    glow(G[1].userData.data, RED);
    cd.hl(0); txt(p2, 'prev 1111'); glow(G[2].userData.data, GOLD);
    say('移掉 2345：5566 的 prev 要接到 1111', '前一個 = node.prev，不用從 head 找');
    await step(tok);                                   // 141:06 1111 要接到 5566
    glow(G[2].userData.data, null); cd.hl(1); txt(n0, 'next 5566'); glow(G[0].userData.data, GOLD);
    say('1111 的 next 要接到 5566', '這兩張才是最重要要更新的');
    await step(tok);                                   // 141:52 中間砍掉 → remove here
    glow(G[0].userData.data, null); cd.hl(2);
    fly(G[1]); kill(p1); kill(n1);
    ar = dlinks([xs[0], xs[2]], 0, ar);
    say('再把中間砍掉：free', 'remove here 完成');
    await step(tok);                                   // 141:59 代價：多一張紙條、多幾行 code
    cd.hl(-1);
    say('代價：每個 node 多一張紙條', '多幾行 code、比 singly 稍慢');
    await step(tok);                                   // 142:18 換到：看到 node 就能刪
    say('換到：看到 node 就能把它刪掉', '不用先回頭找前一個');
    await step(tok);                                   // 142:40 insertion 也一樣
    say('Insertion 也一樣', 'doubly 也能很方便地 insert here');
  }]);

  // 143:10 traversal pattern → iterator
  function travScene(qa) {
    return async (tok) => {
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
      const pa = tag('', 'ptr alt', ax[0], 1.4, az), pl2 = tag('', 'ptr alt', lx[0], 1.3, lz);
      showL(pa, false); showL(pl2, false);
      const walkA = async (ms) => { showL(pa, true); for (let k = 0; k < 4; k++) { at(pa, ax[k], 1.4, az); txt(pa, 'index ' + k); glow(A[k], GOLD); await beat(tok, ms); glow(A[k], null); } };
      const walkL = async (ms) => { showL(pl2, true); for (let k = 0; k < 4; k++) { at(pl2, lx[k], 1.3, lz); txt(pl2, k ? 'next' : 'head'); glow(G[k].userData.data, GOLD); await beat(tok, ms); glow(G[k].userData.data, null); } };
      let cd;
      if (!qa) {
        await step(tok);                               // 143:10 從 head 開始
        showL(pl2, true); txt(pl2, 'it = head'); glow(G[0].userData.data, GOLD);
        say('Linked list 典型用法：從 head 開始', '');
        await step(tok);                               // 143:23 還沒到停下來的地方
        say('還沒走到「停下來的地方」就繼續', '');
        await step(tok);                               // 143:41 常用 NULL 標示結尾
        tag('NULL', 'idx', lx[3] + 1.4, 0.35, lz);
        say('結尾常用 NULL 標示', '但不是唯一的方式');
        await step(tok);                               // 143:53 每一步往 next 找
        glow(G[0].userData.data, null);
        await walkL(400);
        say('每拜訪一個，就往它的 next 找', 'singly linked list 就能這樣做');
        await step(tok);                               // 144:13 doubly：從 tail 順著 prev 反著走
        for (let k = 3; k >= 0; k--) { at(pl2, lx[k], 1.3, lz); txt(pl2, k === 3 ? 'tail' : 'prev'); await beat(tok, 350); }
        say('Doubly：也能從 tail 順著 prev 反著走', '');
        await step(tok);                               // 144:30 array：index 從 0 到 tail，index++
        showL(pl2, false);
        await walkA(400);
        say('Array 也類似：index 從 0 到 tail', 'index++');
        await step(tok);                               // 145:01 像 sequential search 要看過全部
        say('有些演算法要看過 DS 裡所有東西', '例如 sequential search');
        await step(tok);                               // 145:16 不同 DS 要不同 code
        say('但不同的 data structure 要寫不同的 code', 'array 用 index；list 用 head、next');
        await step(tok);                               // 145:22 抽象化：iterator
        cd = code(['for (it = begin(); it != end(); ++it)', '    visit(*it);'], 0, 4.4, 0.55, -3.6);
        say('再抽象化一層：Iterator', '');
        await step(tok);                               // 145:41 開頭、結尾、下一個
        cd.hl(0);
        say('Iterator 定義三件事', '開頭 begin、結尾 end、下一個 ++');
        await step(tok);                               // 146:15 sequential search 也能套到 linked list
        await walkA(250); await walkL(250);
        say('同一個演算法，array 和 list 都能套', 'sequential search（with cut）也能用在 linked list');
        await step(tok);                               // 147:11 C++ STL 的抽象化
        cd.hl(-1);
        say('C++ STL 裡會看到這個概念', '對「走訪整個 data structure」的抽象化');
      } else {
        await step(tok);                               // 151:44 iterator 是什麼？
        say('同學問：Iterator 是什麼？', '');
        await step(tok);                               // 152:03 array：index 0123… 跑過去
        await walkA(400);
        say('Array 用一套：index 0、1、2、3… 跑過去', '');
        await step(tok);                               // 152:09 linked list：head、next、next
        await walkL(400);
        say('Linked list 用另一套：head、next、next…', '');
        await step(tok);                               // 152:23 兩套背後都是指標
        say('這兩套背後其實都是指標', '只是操作方式不一樣');
        await step(tok);                               // 152:30 array 位址往上加；list 照紙條走
        showL(pa, true); for (let k = 0; k < 4; k++) { at(pa, ax[k], 1.4, az); txt(pa, String(1001 + k)); await beat(tok, 300); }
        showL(pl2, true); for (let k = 0; k < 4; k++) { at(pl2, lx[k], 1.3, lz); txt(pl2, String(LA[k])); await beat(tok, 300); }
        say('Array：位址往上加 1001 → 1002 → 1003', 'List：照著小紙條跳，1003 → 1126');
        await step(tok);                               // 152:45 iterator 把兩個合起來
        cd = code(['for (it = begin(); it != end(); ++it)', '    visit(*it);'], 0, 4.4, 0.55, -3.6);
        say('Iterator 把兩個概念合起來', '反正裡面都是指標操作');
        await step(tok);                               // 153:02 開頭、結尾、下一個
        cd.hl(0);
        say('對每種 DS 寫清楚三件事', '什麼叫開頭、什麼叫結尾、什麼叫下一個');
        await step(tok);                               // 153:10 同一段 code 能用在兩邊
        cd.hl(1);
        say('同一段 code 就能用在 array 和 linked list', '');
        await step(tok);                               // 153:26 想成「高階指標」
        say('可以把 iterator 想成「高階指標」', '');
        await step(tok);                               // 153:44 ++ 在不同 DS 意思不同；doubly 還能 --
        cd.hl(0);
        say('往前走用 ++：在 array、list 意思不同', 'doubly linked list 還能 -- 往回走');
        await step(tok);                               // 154:18 用 * 取資料
        cd.hl(1);
        say('用 * 取出它指到的資料', '跟指標的寫法一樣');
        await step(tok);                               // 154:38 容器：輕鬆切換
        cd.hl(-1);
        say('STL 把 list、array 這類叫「容器」', 'iterator 讓你輕鬆切換容器');
      }
    };
  }
  FRAG.push(['arrlllin-iterator', '走訪與 iterator', travScene(false)]);
  FRAG.push(['arrlllin-iterator-qa', 'Q&A：iterator 是什麼', travScene(true)]);

  // 147:52 STL list
  FRAG.push(['arrlllin-stl-list', 'STL list 的 iterator 操作', async (tok) => {
    fresh([0, 6, 11.5], [0, 1.5, 0]);
    const xs = spread(4, 2.6);
    const G = [10, 20, 30, 40].map((v, i) => dnode(v, xs[i], 0, C.v));
    let ar = dlinks(xs, 0);
    const cd = code(['list<int> l = {10, 20, 30, 40};', 'auto it = l.begin();', '++it;', 'cout << *it;       // 20', 'l.insert(it, 15);  // 插在 it 前面', 'l.erase(it);       // 刪掉 20'], 0, 6.0, 0.5, -1.8);
    const it = tag('it', 'ptr alt', xs[0], 1.3, 0); showL(it, false);
    const nx = spread(5, 2.35);
    let N;
    await step(tok);                                   // 147:52 STL list = doubly linked list
    cd.hl(0); say('C++ STL 的 list', '就是課堂上講的 doubly linked list');
    await step(tok);                                   // 148:06 get head → begin()，給一個 iterator
    cd.hl(1); showL(it, true); say('get head → begin()', '給你一個 iterator');
    await step(tok);                                   // 148:21 iterator 對應 node 的位址
    glow(G[0].userData.data, GOLD);
    say('在 linked list 裡，iterator 對應 node 的位址', '');
    await step(tok);                                   // 148:39 ++ 被 overload：往後走一格
    glow(G[0].userData.data, null);
    cd.hl(2); at(it, xs[1], 1.3, 0); say('get next → ++', 'operator overloading：++ 代表往後走一格');
    await step(tok);                                   // 149:03 vector 裡 ++ 是 index 往前
    say('在 vector（array）裡也有 ++', '代表 index 往前、位址往上加');
    await step(tok);                                   // 149:13 get → *：取出 node 的內容
    cd.hl(3); glow(G[1].userData.data, GOLD); say('get → *it', '取出 node 裡的資料 = 20');
    await step(tok);                                   // 149:53 insert here
    glow(G[1].userData.data, null);
    cd.hl(4);
    N = dnode(15, nx[1], 0, C.hot, 3);
    G.forEach((g, i) => move(g, nx[i === 0 ? 0 : i + 1], 0.35, 0));
    ar = dlinks(nx, 0, ar); at(it, nx[2], 1.3, 0);
    say('insert(it, 15)：insert here', 'doubly 做 insert here 很容易');
    await step(tok);                                   // 150:04 remove here = erase
    cd.hl(5); glow(G[1].userData.data, RED);
    await beat(tok, 500);
    fly(G[1]);
    [G[0], N, G[2], G[3]].forEach((g, i) => move(g, xs[i], 0.35, 0));
    ar = dlinks(xs, 0, ar); showL(it, false);
    say('erase(it)：remove here', '');
    await step(tok);                                   // 150:29 除了考試，很少自己寫 linked list
    cd.hl(-1);
    say('除了考試（研究所、入職考試）', '很少需要自己寫 linked list');
    await step(tok);                                   // 150:56 但要會用、了解每個操作
    say('但要會用、要懂每個操作背後發生什麼', '這是基本功');
  }]);

  // 155:00 list vs vector, push_front / pop_front
  FRAG.push(['arrlllin-list-vs-vector', 'list 與 vector', async (tok) => {
    fresh([0, 7.5, 10.5], [0, 0.5, 0]);
    const vx = spread(5, 1.5), vz = -2.0; cells(vx, vz, { d: 1.2 });
    const V = [10, 20, 30, 40].map((v, i) => vc(v, vx[i], vz)); V.push(null);
    tag('vector（array）', 'ptr', vx[0] - 0.2, 1.3, vz - 0.8);
    const lx = spread(4, 2.6), lz = 2.0;
    let G = [10, 20, 30, 40].map((v, i) => dnode(v, lx[i], lz, C.pr));
    let ar = dlinks(lx, lz);
    tag('list（doubly linked list）', 'ptr', lx[0] + 0.6, 1.3, lz - 0.9);
    await step(tok);                                   // 155:00 linked list 當成更有彈性的 array？
    say('Q：能把 linked list 當成更有彈性的 array 嗎？', '');
    await step(tok);                                   // 155:22 只需要 array 的功能就用 array
    say('只需要 array 的功能，就用 array', 'array 的概念比較簡單');
    await step(tok);                                   // 155:40 linked list 是更有彈性的容器
    say('Linked list 可以想成更有彈性的容器', '');
    await step(tok);                                   // 155:46 list = doubly；vector = array
    say('STL：list 是 doubly linked list', 'vector 是 array：連續記憶體、沒有小紙條');
    await step(tok);                                   // 156:59 singly 還是 doubly：看代價
    say('實務上選 singly 還是 doubly？', '看付出的代價和 coding 的方便');
    await step(tok);                                   // 157:15 application dependent：小型系統
    say('非常 application dependent', '空間限制很強的小型系統，可能選 singly');
    await step(tok);                                   // 157:31 即時性要求高
    say('即時性要求高的系統也可能選 singly', '不想花兩倍時間更新小紙條');
    await step(tok);                                   // 158:54 list 不能 random access
    glow(V[2], GOLD);
    say('list 不能 random access', 'vector 的 v[2] 一步到位；list 要一個一個走');
    await step(tok);                                   // 159:23 pop_front = remove from head
    glow(V[2], null);
    fly(V[0]); fly(G[0]);
    for (let k = 1; k < 4; k++) { move(V[k], vx[k - 1], 0.35, vz); V[k - 1] = V[k]; } V[3] = null;
    G.shift(); G.forEach((g, i) => move(g, lx[i], 0.35, lz));
    ar = dlinks(lx.slice(0, 3), lz, ar);
    say('pop_front = remove from head', 'list 只改指標；vector 後面要往前補位');
    await step(tok);                                   // 159:30 push_front = insert to head
    for (let k = 2; k >= 0; k--) { move(V[k], vx[k + 1], 0.35, vz); V[k + 1] = V[k]; }
    V[0] = vc(5, vx[0], vz, 3, C.hot);
    G.forEach((g, i) => move(g, lx[i + 1], 0.35, lz));
    G = [dnode(5, lx[0], lz, C.hot, 3), ...G];
    ar = dlinks(lx, lz, ar);
    say('push_front = insert to head', 'list 很快；vector 要全部往後搬');
  }]);

  // 160:22 sparse vector (0, 3.5, 0, 0, 7, 4.2, 9)
  FRAG.push(['arrlllin-sparse', 'Sparse vector', async (tok) => {
    fresh([0, 6.5, 11.5], [0, 0.4, 0.4]);
    const V = [0, 3.5, 0, 0, 7, 4.2, 9], xs = spread(7, 1.45), z = -1.2;
    let S = [];
    await step(tok);                                   // 160:22 sparse vector；向量是多維數字
    say('應用：Sparse vector', '向量 = 一串多維度的數字');
    await step(tok);                                   // 160:38 7 維向量
    cells(xs, z, { lab: (i) => '第 ' + (i + 1) + ' 維' });
    S = V.map((v, i) => vc(v, xs[i], z, 3, v ? C.v : C.dim));
    say('一個 7 維向量：(0, 3.5, 0, 0, 7, 4.2, 9)', '7 個浮點數');
    await step(tok);                                   // 161:19 最自然：長度 7 的 array（vector）
    say('最自然的存法：長度 7 的 array', '跟 C++ 的 vector 同名，不是巧合');
    await step(tok);                                   // 162:05 只有 3.5、7、4.2、9 不是 0
    S.forEach((m, i) => V[i] && glow(m, GOLD));
    say('只有 4 個地方不是 0', '3.5、7、4.2、9');
    await step(tok);                                   // 162:41 0 乘任何數是 0、加 0 不變
    S.forEach((m) => glow(m, null));
    S.forEach((m, i) => { if (!V[i]) glow(m, RED); });
    say('0 乘任何數是 0、加 0 不變', '很多運算裡 0 是不必要的');
    await step(tok);                                   // 163:22 乾脆不存 0
    S.forEach((m, i) => { if (!V[i]) fly(m); });
    say('乾脆儲存時就不存 0', '');
    await step(tok);                                   // 163:30 第 2 維 3.5、第 5 維 7 …
    const px = spread(4, 2.0); let k = 0;
    S.forEach((m, i) => { if (V[i]) { move(m, px[k], 0.35, 1.8); setV(m, '(' + (i + 1) + ', ' + V[i] + ')'); k++; } });
    say('只存（維度, 值）', '(2, 3.5) (5, 7) (6, 4.2) (7, 9)');
    await step(tok);                                   // 164:15 跟多項式的寫法一樣
    say('跟多項式的 (指數, 係數) 一模一樣', '');
    await step(tok);                                   // 164:28 這叫 sparse vector
    say('0 很多的向量叫 Sparse vector', '只存不是 0 的部分');
    await step(tok);                                   // 165:03 sparse 的成本：number of non-zero
    tag('sparse：number of non-zero × pair 大小', 'ptr alt', 0, 1.5, 1.8);
    say('Sparse 要花的空間：非零個數 × pair 大小', '這裡 4 個 pair');
    await step(tok);                                   // 165:23 dense 的成本：number of dimensions
    tag('dense：number of dimensions = 7 個數', 'idx', 0, 1.6, z);
    say('Dense 要花的空間：維度數', '這裡 7 個數');
    await step(tok);                                   // 165:33 非常稀疏時 sparse 划算
    say('哪個省不一定', '非常稀疏（0 超多）時，sparse 比較划算');
  }]);

  // 166:09 sparse vector applications; dynamic → linked list
  FRAG.push(['arrlllin-sparse-apps', 'Sparse vector 的應用', async (tok) => {
    fresh([0, 7, 11], [0, 0.4, 0]);
    let bar, bl, P = [], songs = [], G = [], ar = [], xs, N;
    await step(tok);                                   // 166:09 最高 1000 次的多項式
    say('例：最高 1000 次的多項式', '只有 3 項');
    await step(tok);                                   // 166:19 dense：1001 維的 array
    bar = cube('', C.dim, [11.5, 0.4, 0.8], 0, 0.2, -2.4);
    bl = tag('1001 維 array：幾乎全是 0', 'idx', 0, 0.9, -2.4);
    say('Dense：1001 維的 array', '塞了一堆 0');
    await step(tok);                                   // 166:36 sparse：只有 3 項
    P = [-1.6, 0, 1.6].map((x, i) => vc(['(0, a)', '(…, b)', '(1000, c)'][i], x, -0.6, 3, C.v, [1.45, 0.6, 0.8]));
    say('Sparse：只要 3 個 pair', '');
    await step(tok);                                   // 166:42 拿 0 來算只是浪費
    say('拿 0 來算只是浪費', '浪費計算資源、儲存資源');
    await step(tok);                                   // 167:01 推薦系統
    P.forEach((m) => fly(m));
    txt(bl, '十萬首歌（100,000 維）');
    say('真實應用：推薦系統', '存每個使用者給每首歌的分數');
    await step(tok);                                   // 167:24 十萬首只評了十首
    songs = spread(10, 0.5).map((x) => cube('', C.hot, [0.35, 0.35, 0.35], x, 0.2, -0.6, 2));
    say('十萬首歌，只聽了十首、打了分數', '其他 99,990 個 0 不用存');
    await step(tok);                                   // 167:50 可以存成 pair array
    songs.forEach((m) => fly(m));
    const L = ['(17,5)', '(204,3)', '(9031,4)'];
    xs = spread(3, 2.6);
    G = L.map((v, i) => lnode(v, xs[i], 0.35, 1.8, C.pr));
    ar = slinks(xs, 1.8);
    tag('(歌 ID, 分數)', 'ptr', -5.2, 1.3, 1.8);
    say('Sparse vector 可以存成 pair array', '像一開始的多項式那樣');
    await step(tok);                                   // 168:06 多聽一首 → 多存一筆
    const nx = spread(4, 2.4);
    N = lnode('(560,5)', nx[2], 2.6, 1.8, C.hot);
    G.forEach((g, i) => move(g, nx[i < 2 ? i : i + 1], 0.35, 1.8));
    move(N, nx[2], 0.35, 1.8);
    G = [G[0], G[1], N, G[2]]; ar = slinks(nx, 1.8, ar);
    say('多聽一首歌 → 多存一筆', '');
    await step(tok);                                   // 168:11 移除某一首
    glow(G[1].userData.data, RED);
    await beat(tok, 500);
    fly(G[1]); G.splice(1, 1);
    G.forEach((g, i) => move(g, xs[i], 0.35, 1.8)); ar = slinks(xs, 1.8, ar);
    say('不喜歡了 → 從清單移除', '');
    await step(tok);                                   // 168:19 動態操作多 → linked list
    say('這種動態操作多時', '可能選 linked list 來存 sparse vector');
    await step(tok);                                   // 168:39 一般化：一長串裡很多同一個值
    say('一般化：一長串資料裡，很多是同一個值', '例如 0；不想存它 → sparse 表示');
    await step(tok);                                   // 169:21 下週：array vs linked list 實作比較
    say('下週：sparse vector 用 array 和 linked list', '實作的好壞比較');
  }]);
  }

  // ═══ arrpeng12.js ═══
  {
// ─── 交大彭文志 Lec03 Arrays 1/4 (hPIBv0kO-Zc) + Lec04 Arrays 2/4 (x72xBomc-XE) ───
// Cued scenes: every `await step(tok)` waits for the sentence it shows; motion between steps is short.
const P = () => (ctx.params || {});
const step = (tok) => ctx.step(tok);
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
const term = (c, e) => (e === 0 ? String(c) : (c === 1 ? '' : c) + 'x' + (e === 1 ? '' : sup(e)));
const BLUE = '#4b9ee2', ORANGE = '#dd8238', PURPLE = '#9b7ef4', TEAL = '#31aab0', PINK = '#e55a9b', TILE = '#e9dcc4';
function tiles(n, x0, dx, y, z, w, d, color) { const ts = []; for (let i = 0; i < n; i++) ts.push(cube('', color || TILE, [w, 0.1, d], x0 + i * dx, y, z)); return ts; }
// run fn(0..n-1) with a short pause between (a build-up that stays short)
async function build(tok, n, ms, fn) { for (let i = 0; i < n; i++) { fn(i); await beat(tok, ms); } }

// ── Big-O / Omega / Theta：f(n) 的長條跟 c·g(n) 的板子逐一比 ──
async function scAsym(tok) {
  const kind = P().kind || 'O';
  fresh([0, 5.5, 15], [0, 3.2, 0]);
  const S = 0.2, N = 8, X = (n) => -5.6 + (n - 1) * 1.6;
  const F = kind === 'Omega' ? (n) => 3 * n + 3 : (n) => 3 * n + 2;
  const fName = kind === 'Omega' ? 'f(n) = 3n + 3' : 'f(n) = 3n + 2';
  const bars = [];
  const grow = () => build(tok, N, 130, (k) => { const n = k + 1, h = F(n) * S; bars.push(cube('', BLUE, [0.9, h, 0.9], X(n), h / 2, 0, 2.5)); tag('n=' + n, 'idx', X(n), -0.1, 1.1); });
  const values = () => { for (let n = 1; n <= N; n++) tag(String(F(n)), 'idx', X(n), F(n) * S + 0.35, 0); };
  const plates = (g, color, upto = N) => { const ms = []; for (let n = 1; n <= upto; n++) ms.push(cube('', color, [1.2, 0.08, 1.2], X(n), g(n) * S, 0)); return ms; };
  const check = (ok) => build(tok, N, 110, (k) => glow(bars[k], ok(k + 1) ? GREEN : RED));
  if (kind === 'O') {
    await step(tok);                                   // 0:39 textbook definition, not a library function
    tag('Big-O：找 f(n) 的 upper bound（上界）', 'ptr', 0, 7.6, 0);
    say('Big-O 照課本（complexity 理論）的定義', '不是某些 library 的 upper_bound 函式');
    await step(tok);                                   // 1:00 step count from a program
    await grow();
    say('看程式算出 step count：要執行幾個指令', '這個數就是定義裡的 f(n)');
    await step(tok);                                   // 1:16 example 3n + 2
    values(); tag(fName, 'ptr', -3.5, 6.8, 0);
    say('例：預估要跑 3n + 2 個指令', fName);
    await step(tok);                                   // 1:39 exists c, n0: f(n) <= c g(n)
    plates((n) => 4 * n, '#c08a1f');
    tag('c·g(n) = 4n（c = 4，g(n) = n）', 'ptr alt', 3, 6.8, 0);
    say('定義：存在常數 c 和 n₀', 'f(n) ≤ c·g(n)，對所有 n ≥ n₀');
    await step(tok);                                   // 1:57 3n + 2 <= 4n for n >= 2
    await check((n) => F(n) <= 4 * n);
    tag('n₀ = 2', 'ptr', X(2), -0.1, 2.0);
    say('n = 1 時 5 > 4 不成立；n ≥ 2 都成立', '3n + 2 ≤ 4n（n ≥ 2）→ 3n + 2 = O(n)');
    await step(tok);                                   // 2:03 also <= n^2
    const sq = plates((n) => n * n, PURPLE, 6);
    tag('n²', 'idx', X(6) + 0.9, 36 * S, 0);
    say('3n + 2 ≤ n² 也成立（n ≥ 4 起）', 'n²、n³ 也都是 upper bound');
    await step(tok);                                   // 2:19 g(n) must be the least upper bound
    sq.forEach((m) => tint(m, '#d8cfc0'));
    say('但 g(n) 要取「最小」的 upper bound', 'least upper bound');
    await step(tok);                                   // 2:42 so 3n + 2 = O(n)
    tag('3n + 2 = O(n)', 'ptr', 0, 7.6, 1.2);
    say('最緊的上界是 n', '3n + 2 = <span class="ok">O(n)</span>');
  } else if (kind === 'Omega') {
    await step(tok);                                   // 2:51 omega: same definition, other direction
    tag('Omega：找 f(n) 的 lower bound（下界）', 'ptr', 0, 7.6, 0);
    say('Omega 的定義跟 Big-O 幾乎一樣', '只是不等式反過來：≥');
    await step(tok);                                   // 3:01 exists c, n0, f(n) >= c g(n)
    await grow(); values(); tag(fName, 'ptr', -3.5, 6.8, 0);
    say('存在 c、n₀，使 f(n) ≥ c·g(n)', '例：' + fName);
    await step(tok);                                   // 3:08 compare with 3n
    plates((n) => 3 * n, '#2fc092');
    tag('c·g(n) = 3n（c = 3，g(n) = n）', 'ptr alt', 3, 6.8, 0);
    say('拿 3n 來比', '3n + 3 ≥ 3n ?');
    await step(tok);                                   // 3:19 holds for all n >= 1
    await check((n) => F(n) >= 3 * n);
    say('n ≥ 1 全部成立', '3n + 3 ≥ 3n → 3n + 3 = Ω(n)');
    await step(tok);                                   // 3:27 g(n) must be the largest lower bound
    say('g(n) 要是 lower bound，而且是最大的那個', 'most lower bound');
    await step(tok);                                   // 3:46 e.g. n^3 + 2: n^2, n are all lower bounds
    tag('例：f(n) = n³ + 2 → n²、n、1 都是 lower bound', 'note', 0, 7.6, 1.4);
    say('例：f(n) = n³ + 2', 'n²、n、1 都 ≤ f(n)，下界很多');
    await step(tok);                                   // 4:00 we want the largest
    say('要找最大的 lower bound', 'n³ + 2 = Ω(n³)；本例 3n + 3 = <span class="ok">Ω(n)</span>');
  } else {
    await step(tok);                                   // 4:08 theta: squeeze f(n)
    tag('Theta：用同一個 g(n) 上下夾住 f(n)', 'ptr', 0, 7.6, 0);
    say('Theta：從上下兩邊把 f(n) 夾住', '');
    await step(tok);                                   // 4:12 function g(n) on both sides
    await grow(); values(); tag(fName, 'ptr', -3.5, 6.8, 0);
    say('夾住的對象：' + fName, '');
    await step(tok);                                   // 4:21 two constants c1, c2
    plates((n) => 3 * n, '#2fc092'); plates((n) => 4 * n, '#c08a1f');
    tag('c₁·g(n) = 3n　c₂·g(n) = 4n', 'ptr alt', 3, 6.8, 0);
    say('兩個常數：c₁ = 3、c₂ = 4', 'g(n) = n');
    await step(tok);                                   // 4:31 c1 g(n) <= f(n) <= c2 g(n)
    await check((n) => 3 * n <= F(n) && F(n) <= 4 * n);
    tag('n₀ = 2', 'ptr', X(2), -0.1, 2.0);
    say('c₁g(n) ≤ f(n) ≤ c₂g(n)', '3n ≤ 3n + 2 ≤ 4n，n ≥ 2');
    await step(tok);                                   // 4:59 both lower and upper bound
    say('g(n) 既是 lower bound 也是 upper bound', '3n + 2 = <span class="ok">Θ(n)</span>');
    await step(tok);                                   // 5:22 Big-O, Omega, Theta analyse time complexity
    tag('O：≤（上界）　Ω：≥（下界）　Θ：夾住', 'note', 0, 7.6, 1.4);
    say('三個符號都用來分析 time complexity', '研究所、設計演算法一定會被問');
  }
}
FRAG.push(['arrpeng12-asym', 'Big-O、Ω、Θ 的定義（3n + 2）', scAsym]);

// ── 組合規則：循序取 max、巢狀相乘；多項式取最高次；log nᵏ ──
async function scRules(tok) {
  fresh([0, 7, 13], [0, 1.2, 0]);
  const n = 4;
  await step(tok);                                     // 5:51 program made of procedures A and B
  const lA = tag('procedure A', 'ptr', -4.6, 2.6, -1), lB = tag('procedure B', 'ptr alt', 1.2, 4.2, -1);
  say('程式由 procedure A、B 組成', '整個程式的 complexity 是多少？');
  await step(tok);                                     // 6:24 T1(n) = O(f(n))
  const a = [], b = [];
  await build(tok, n, 150, (i) => a.push(cube('', BLUE, [0.7, 0.7, 0.7], -5.7 + i * 0.75, 0.35, -1, 2)));
  txt(lA, 'A：T₁(n) = O(f(n))');
  say('A 的複雜度：T₁(n) = O(f(n))', '例：f(n) = n');
  await step(tok);                                     // 6:32 T2(n) = O(g(n))
  await build(tok, n * n, 60, (i) => b.push(cube('', ORANGE, [0.7, 0.7, 0.7], -0.4 + (i % n) * 0.8, 0.35 + Math.floor(i / n) * 0.75, -1, 2)));
  txt(lB, 'B：T₂(n) = O(g(n))');
  say('B 的複雜度：T₂(n) = O(g(n))', '例：g(n) = n²');
  await step(tok);                                     // 6:42 A then B: T1 + T2
  const ar = arrow(V3(-3.4, 1.4, -1), V3(-0.8, 1.4, -1), 0xc08a1f);
  say('A 做完再做 B（循序）', 'T₁(n) + T₂(n)');
  await step(tok);                                     // 6:58 take the max
  b.forEach((m) => glow(m, GOLD));
  say('整體取 max：看誰比較大', 'O(max(f(n), g(n))) = <span class="ok">O(n²)</span>');
  await step(tok);                                     // 7:19 A calls B inside its loop
  [...a, ...b].forEach((m) => fly(m)); kill(lA); kill(lB); kill(ar);
  tag('A 的外圈每一圈都呼叫一次 B', 'ptr', -0.8, 4.4, -1);
  await build(tok, n, 300, (i) => { for (let j = 0; j < n; j++) cube('', colorFor(i), [0.75, 0.75, 0.75], -2.1 + j * 0.9, 0.4 + i * 0.85, -1, 1.5); });
  say('A 的迴圈裡呼叫 B（巢狀）', '外圈 n 圈，每圈做一次 B');
  await step(tok);                                     // 7:44 multiply
  say('巢狀：兩個 complexity 相乘', 'T₁(n) · T₂(n) = O(f(n) · g(n))');
  await step(tok);                                     // 7:50 rule 2: polynomial of degree k
  tag('Rule 2：k 次多項式 → O(nᵏ)', 'note', 4.4, 3.6, -1);
  say('Rule 2：T(n) 是 k 次多項式', 'T(n) = O(nᵏ)');
  await step(tok);                                     // 8:11 rule 3: (log n)^k = O(n), prove it
  tag('Rule 3：logᵏ n = O(n)', 'note', 4.4, 2.6, -1);
  say('Rule 3：logᵏ n（log n 的 k 次方）', 'logᵏ n = O(n)：n 夠大後一定被 n 追過');
  await step(tok);                                     // 8:35 e.g. n^3 + 4
  say('例：n³ + 4，只看最高次', 'n³ + 4 = O(n³)');
  await step(tok);                                     // 8:52 prove: find c and n0
  say('怎麼證明？照定義找出 c 和 n₀', 'logᵏ n ≤ c·n，對所有 n ≥ n₀ 成立');
}
FRAG.push(['arrpeng12-rules', '複雜度組合規則', scRules]);

// ── 迴圈的 step count：for 3n、雙層 n²、兩個 block、if-else ──
async function scLoops(tok) {
  const ex = P().ex || 'nested';
  fresh([0, 7, 13.5], [0, 1.6, 0]);
  const n = 5;
  const blk = (x, y, z, c, d = 1.6) => cube('', c, [0.6, 0.6, 0.6], x, y, z, d);
  if (ex === 'for' || ex === 'nested') {
    await step(tok);                                   // 9:27 for loop doing three additions
    const cd = code(['for (i = 0; i < n; i++) {', '  x++; y++; z++;', '}'], -3.6, 6.4);
    cd.hl(1);
    say('for 迴圈：每圈做 x++、y++、z++', '3 個加法指令');
    await step(tok);                                   // 9:41 runs n rounds
    await build(tok, n, 260, (i) => { for (let k = 0; k < 3; k++) blk(-5.6 + i * 0.75, 0.3 + k * 0.65, 1.5, colorFor(k), 1); tag('i=' + i, 'idx', -5.6 + i * 0.75, -0.1, 2.4); });
    say('迴圈繞 n 圈（這裡 n = 5）', '每圈 3 個指令');
    await step(tok);                                   // 9:48 step count 3n
    say('step count = 3 × n', '3n');
    await step(tok);                                   // 9:56 O(n); next a nested loop
    const c2 = code(['for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    x++;'], 3.2, 6.4);
    say('3n → O(n)；接著看兩層迴圈', '<span class="ok">O(n)</span>');
    await step(tok);                                   // 10:06 runs n^2 times
    c2.hl(2);
    const g = [];
    await build(tok, n, 300, (i) => { for (let j = 0; j < n; j++) g.push([i, j, blk(1.2 + j * 0.8, 0.3, -1.6 + i * 0.8, ORANGE, 1.2)]); });
    say('兩層 nested loop：總共 n × n 次', '每次只做 1 個指令');
    await step(tok);                                   // 10:23 O(n^2)
    say('step count = n²', '<span class="ok">O(n²)</span>');
    await step(tok);                                   // 10:33 the midterm is harder than this
    say('這種題目只是基本分', '期中考會再複雜一點');
    await step(tok);                                   // 10:43 e.g. j < i/2
    txt(c2.ls[1], '  for (j = 0; j < i/2; j++)');
    g.forEach(([i, j, m]) => { if (j >= i / 2) fly(m); });
    say('例：內圈改成 j < i/2', '要自己算總次數（仍是 n² 等級）');
  } else if (ex === 'blocks') {
    const cd = code(['for (i = 0; i < n; i++)', '  a[i] = 0;', 'for (i = 0; i < n; i++)', '  for (j = 0; j < n; j++)', '    a[i] += a[j] + i + j;'], 0, 6.8);
    await step(tok);                                   // 11:03 block 1: a[i] = 0
    cd.hl(1);
    say('第一個 block：把 a[i] 設成 0（初始化）', 'for 跑 n 次');
    await step(tok);                                   // 11:08 block 2: two for loops
    cd.hl(4);
    say('第二個 block：兩層 for 迴圈做加法', '');
    await step(tok);                                   // 11:23 n vs n^2
    const b2 = [];
    await build(tok, n, 120, (i) => blk(-5.4 + i * 0.75, 0.3, 0.5, BLUE, 1));
    tag('block 1：n', 'ptr', -3.9, 1.3, 0.5);
    await build(tok, n, 220, (i) => { for (let j = 0; j < n; j++) b2.push(blk(0.8 + j * 0.8, 0.3, -1.6 + i * 0.8, ORANGE, 1.2)); });
    tag('block 2：n²', 'ptr alt', 2.4, 1.3, 2.8);
    say('block 1 做 n 次；block 2 做 n² 次', 'O(n)、O(n²)');
    await step(tok);                                   // 11:33 whole program: who is slowest
    say('整個程式要看誰最慢', '');
    await step(tok);                                   // 11:42 bottleneck
    b2.forEach((m) => glow(m, GOLD));
    say('最慢的 block 2 就是 bottleneck', 'n² 比 n 大');
    await step(tok);                                   // 11:59 O(n^2)
    say('整個程式是 O(n²)', 'O(n) + O(n²) = <span class="ok">O(n²)</span>');
  } else {
    const cd = code(['if (x > 0) {', '  x++; y++;', '} else {', '  for (i = 0; i < n; i++) x++;', '}'], 0, 6.8);
    await step(tok);                                   // 12:06 if branch
    cd.hl(1);
    say('if 判斷：x > 0 就做 x++、y++', '');
    await step(tok);                                   // 12:11 else: a for loop
    cd.hl(3);
    say('否則（else）做一個 for 迴圈', '');
    await step(tok);                                   // 12:18 2 instructions vs n
    tag('if：2 個指令', 'ptr', -3.6, 1.8, 0);
    await build(tok, 2, 200, (k) => blk(-4 + k * 0.8, 0.3, 0, BLUE, 1));
    tag('else：for 跑 n 次', 'ptr alt', 2.6, 1.8, 0);
    const e = [];
    await build(tok, n, 200, (i) => e.push(blk(0.8 + i * 0.75, 0.3, 0, ORANGE, 1)));
    say('if：2 個指令；else：step count = n', 'O(1)　vs　O(n)');
    await step(tok);                                   // 12:32 take the larger branch
    e.forEach((m) => glow(m, GOLD));
    say('if-else 看最大的那條路', 'max(O(1), O(n)) = <span class="ok">O(n)</span>');
  }
}
FRAG.push(['arrpeng12-loops', '算迴圈的 step count', scLoops]);

// ── 遞迴：n! 的 T(n) = T(n−1) + c；Fibonacci 的 T(n) = T(n−1) + T(n−2) + c ──
async function scRecur(tok) {
  const fib = P().fib;
  if (!fib) {
    fresh([0, 6.5, 13], [0, 3, 0]);
    await step(tok);                                   // 12:44 recursive n factorial
    const cd = code(['int f(int n) {', '  if (n <= 1) return 1;', '  return n * f(n - 1);', '}'], -3.6, 7.4);
    say('recursive function：算 n 階乘', 'n! = n × (n−1) × … × 1');
    await step(tok);                                   // 12:52 boundary condition
    cd.hl(1);
    say('n ≤ 1：boundary condition，直接回傳', '');
    await step(tok);                                   // 12:58 return n * f(n-1)
    cd.hl(2);
    say('否則 return n × f(n − 1)', '自己呼叫自己');
    await step(tok);                                   // 13:08 T(n) = T(n-1) + c
    tag('T(n) = T(n − 1) + c', 'ptr alt', 3.0, 7.4, 0);
    say('complexity 寫成 T(n) = T(n − 1) + c', '');
    await step(tok);                                   // 13:18 T(n): step count of f(n); calls f(n-1)
    const ms = [];
    await build(tok, 5, 280, (q) => { const k = 5 - q; ms.push(cube('f(' + k + ')', colorFor(k), [2.0, 0.8, 1.0], 2.6, 0.4 + q * 1.1, 0, 1.5)); });
    say('T(n)：執行 f(n) 要花的 step count', 'f(n) 呼叫 f(n−1)，那部分花 T(n−1)');
    await step(tok);                                   // 13:35 c: a constant cost per call
    for (let q = 0; q < 5; q++) tag('+c', 'idx', 4.2, 0.4 + q * 1.1, 0);
    say('c：每一層固定多花的 cost', '共 n 層，每層 + c');
    await step(tok);                                   // 14:05 solve: T(n) = O(n)
    say('解遞迴式（離散、演算法會教）', 'T(n) = n·c = <span class="ok">O(n)</span>');
    return;
  }
  fresh([0, 6, 14], [0, 3.2, 0]);
  await step(tok);                                     // 14:38 FB is not Facebook: a sequence
  const seq = [1, 1, 2, 3, 5, 8, 13];
  await build(tok, seq.length, 120, (k) => cube(String(seq[k]), colorFor(k), [0.8, 0.6, 0.8], -5.4 + k * 0.95, 0.3, 2.6, 1.5));
  say('FB 不是 Facebook，是 Fibonacci 數列', '1, 1, 2, 3, 5, 8, 13, …');
  await step(tok);                                     // 14:57 FB(n) = FB(n-1) + FB(n-2)
  const nodes = []; let ord = 0;
  (function mk(v, d) { const me = { v, d }; if (v > 1) me.l = mk(v - 1, d + 1); me.x = ord++; if (v > 1) me.r = mk(v - 2, d + 1); nodes.push(me); return me; })(5, 0);
  const W = 0.82, off = (ord - 1) / 2;
  const pos = (nd) => [(nd.x - off) * W, 7 - nd.d * 1.45];
  const mesh = new Map();
  for (let d = 0; d <= 4; d++) {
    for (const nd of nodes.filter((q) => q.d === d)) {
      const [x, y] = pos(nd);
      mesh.set(nd, cube(String(nd.v), colorFor(nd.v), [0.7, 0.55, 0.7], x, y, 0, 1));
      for (const ch of [nd.l, nd.r]) if (ch) { const [cx, cy] = pos(ch); line(x, y - 0.3, cx, cy + 0.3); }
    }
    await beat(tok, 300);
  }
  say('FB(n) = FB(n − 1) + FB(n − 2)', 'FB(5) 的呼叫樹');
  await step(tok);                                     // 15:05 T(n) = T(n-1) + T(n-2) + c
  tag('T(n) = T(n − 1) + T(n − 2) + c', 'ptr', 0, 8.2, 0);
  say('T(n) = T(n − 1) + T(n − 2) + c', 'c 一樣是固定的 cost');
  await step(tok);                                     // 15:17 more complex than factorial
  for (const nd of nodes) if (nd.v === 3 || nd.v === 2) glow(mesh.get(nd), GOLD);
  say('比階乘的遞迴更複雜', '同一個值被重算很多次：F(3) 2 次、F(2) 3 次');
  await step(tok);                                     // 15:21 see discrete math / algorithms
  say('怎麼解：看離散數學或演算法', '補充：T(n) = Θ(φⁿ)，φ ≈ 1.618');
}
FRAG.push(['arrpeng12-recur', '遞迴函式的 T(n)', scRecur]);

// ── 常見複雜度的大小：1 < log n < log²n < n < n log n < n² < n³ < 2ⁿ ──
async function scGrowth(tok) {
  const quick = P().focus === 'n2logn';
  fresh([0, 5, 15.5], [0, 3.4, 0]);
  const n = 32, L = Math.log2;
  const fs = [['1', 1], ['log n', L(n)], ['log²n', L(n) ** 2], ['n', n], ['n log n', n * L(n)], ['n²', n * n], ['n³', n ** 3], ['2ⁿ', 2 ** n]];
  const X = (i) => -6 + i * 1.6, H = (v) => 0.15 + L(v) * 0.2;
  const bars = [], nms = [];
  const bar = (i) => { const [nm, v] = fs[i], h = H(v); bars[i] = cube('', i === 7 ? RED : i === 0 ? GREEN : BLUE, [0.95, h, 0.95], X(i), h / 2, 0, quick ? 0 : 2); nms[i] = tag(nm, 'idx', X(i), -0.15, 1.2); };
  if (!quick) {
    await step(tok);                                   // 15:36 the usual g(n)
    tag('n = 32，高度用 log 尺度', 'note', 0, 7.2, 0);
    say('常見的 g(n) 不外乎這幾種', '1、log n、log²n、n、n log n、n²、n³、2ⁿ');
    await step(tok);                                   // 15:43 c: constant time
    bar(0);
    say('第一個：常數 c', '不管 n 多大，都在 constant time 算完');
    await step(tok);                                   // 16:04 1 million or 10 million: same
    tag('n = 100 萬或 1000 萬：一樣快', 'ptr', X(0) + 1.4, 1.4, 0);
    say('資料 100 萬筆或 1000 萬筆，速度都一樣', 'O(1) 最強');
    await step(tok);                                   // 16:20 the rest depend on n
    bar(1);
    say('其他的都跟 n 有關', '資料越多，跑越久');
    await step(tok);                                   // 16:32 we hope for log n
    glow(bars[1], GOLD);
    say('希望演算法能做到 log n', '');
    await step(tok);                                   // 16:40 log^2 n, n log n, n^2, n^3
    glow(bars[1], null);
    await build(tok, 5, 300, (k) => bar(2 + k));
    say('再來：log²n、n、n log n、n²、n³', '一個比一個大');
    await step(tok);                                   // 16:47 worst: exponential
    bar(7);
    say('最差的是指數成長', '2ⁿ');
    await step(tok);                                   // 16:54 better on top, worse at the bottom
    arrow(V3(-6.6, 7.0, 0), V3(5.6, 7.0, 0), 0x7a1010);
    say('表上越上面越好，越下面越慢', '1 < log n < log²n < n < n log n < n² < n³ < 2ⁿ');
    await step(tok);                                   // 17:13 2^n shoots up at n = 5, 6
    glow(bars[7], RED);
    say('n 才 5、6，2ⁿ 就開始往上飄', '2³² ≈ 4.3 × 10⁹');
    await step(tok);                                   // 17:27 log n stays lowest
    glow(bars[1], GREEN);
    say('log n 一直長大時，還是最低的', '');
    return;
  }
  await step(tok);                                     // 18:00 exam: complexity not on the list
  for (let i = 0; i < fs.length; i++) bar(i);
  say('考試會問：推出的 complexity 不在表上怎麼辦？', '');
  await step(tok);                                     // 18:14 e.g. n^2 log n
  const q = tag('n² log n ?', 'ptr alt', 5.6, 6.6, 0);
  say('例：算出 n² log n，表上只有 n log n', '');
  await step(tok);                                     // 18:25 it falls between n^2 and n^3
  bars.slice(6).forEach((m, k) => { move(m, X(7 + k), m.position.y, 0); nms[6 + k].position.x = X(7 + k); });
  await beat(tok, 700);
  const v = n * n * L(n), h = H(v);
  const nb = cube('', ORANGE, [0.95, h, 0.95], X(6), h / 2, 0, 2);
  kill(q); tag('n² log n', 'ptr alt', X(6), h + 0.5, 0);
  say('n² log n 落在 n² 到 n³ 之間', 'n² < n² log n < n³');
  await step(tok);                                     // 19:03 think of n^2 as n^2 x 1
  glow(bars[5], GOLD); glow(nb, GOLD);
  say('把 n² 想成 n² × 1', 'n² × 1　vs　n² × log n');
  await step(tok);                                     // 19:10 compare 1 and log n
  say('那 1 和 log n 誰比較大？', '');
  await step(tok);                                     // 19:40 log n is bigger
  glow(bars[5], null);
  say('log n 比較大，所以 n² log n > n²', 'n² × 1 < <span class="ok">n² × log n</span>');
  await step(tok);                                     // 20:04 the list is only typical: derive
  glow(nb, null);
  say('表只是 typical 的大概區間', '不在表上就自己推導，看落在哪個區間');
}
FRAG.push(['arrpeng12-growth', '常見複雜度的大小順序', scGrowth]);

// ── 量執行時間：time.h ──
async function scTiming(tok) {
  fresh([0, 6, 13], [0, 2, 0]);
  await step(tok);                                     // 20:22 complexity does not depend on the machine
  tag('time / storage complexity：只推 step count', 'note', 0, 4.4, -2);
  say('complexity 跟 machine 沒有關係', '只推 step count');
  await step(tok);                                     // 20:29 running time does
  tag('執行時間：跟機器有關', 'ptr alt', 0, 3.6, -2);
  say('跟機器有關的是：程式實際的執行時間', '');
  await step(tok);                                     // 20:34 time.h
  const cd = code(['#include <time.h>', 'start = clock();', '/* 要量的程式 */', 'stop = clock();', 'duration = ((double)(stop - start))', '           / CLOCKS_PER_SEC;'], 0, 7.2);
  cd.hl(0);
  say('C 有一個 library：time.h', '可以抓到系統時間');
  await step(tok);                                     // 20:42 grab start and end
  line(-5.5, 0.3, 5.5, 0.3);
  cd.hl(1);
  const s = cube('start', GREEN, [1.3, 0.6, 0.8], -4.5, 0.6, 0, 1.5);
  const run = cube('', BLUE, [0.2, 0.5, 0.6], -3.6, 0.55, 0);
  await anim(tok, 1400, (t) => { run.scale.x = 1 + t * 34; run.position.x = -3.7 + t * 3.4; });
  cd.hl(3);
  cube('stop', RED, [1.3, 0.6, 0.8], 3.6, 0.6, 0, 1.5);
  say('程式開始抓一次時間、結束再抓一次', 'start = clock()　…　stop = clock()');
  await step(tok);                                     // 20:51 subtract
  cd.hl(4);
  tag('duration = stop − start', 'ptr alt', 0, 1.8, 0);
  glow(s, GOLD);
  say('兩個相減，就是程式花的時間', '');
  await step(tok);                                     // 20:59 other platforms differ
  cd.hl(-1);
  say('不同平台抓 system time 的方式不同', '需要時上網 search');
}
FRAG.push(['arrpeng12-timing', '用 time.h 量執行時間', scTiming]);

// ── Array = <index, value> 的集合；int list[5]；key-value ──
async function scArrayDef(tok) {
  const kv = P().kv;
  fresh([0, 6, 12], [0, 1, 0]);
  const X = (i) => -4.4 + i * 2.2;
  if (kv) {
    tiles(5, -4.4, 2.2, 0.05, 0, 1.9, 1.6);
    const ids = [], vs = [];
    for (let i = 0; i < 5; i++) { ids.push(tag(String(i), 'idx', X(i), 0, 1.3)); vs.push(cube('list[' + i + ']', colorFor(i), [1.6, 0.8, 1.3], X(i), 0.5, 0)); }
    await step(tok);                                   // 24:58 key-value data store
    tag('key-value data store', 'ptr', 0, 4.4, 0);
    say('最近很熱門的詞：key-value data store', '有沒有聽過？');
    await step(tok);                                   // 25:06 hot because of cloud computing
    tag('雲端運算存資料的方式', 'note', 0, 3.6, 0);
    say('它跟雲端運算有關', 'cloud computing 存放資料的方式');
    await step(tok);                                   // 25:34 MapReduce
    tag('→ MapReduce', 'note', 3.6, 3.0, 0);
    say('以 key-value 為基礎，衍生出 MapReduce', '');
    await step(tok);                                   // 25:44 key-value is just like an array
    say('key-value 其實很像 array', '');
    await step(tok);                                   // 25:57 key = index, value = value at that key
    ids.forEach((l, i) => txt(l, 'key ' + i));
    say('key 就是 index，value 就是那個 key 上的值', '');
    await step(tok);                                   // 26:09 conceptually an array
    vs.forEach((m) => glow(m, GOLD));
    say('概念上就等同一個 array', 'index 0、1、2… 當作 key');
    return;
  }
  await step(tok);                                     // 22:59 quick review of arrays
  say('進入 array：快速複習', '');
  await step(tok);                                     // 23:09 a set of <index, value>
  tag('Array：a set of <index, value>', 'ptr', 0, 4.4, 0);
  say('array 是一個 set，由 index 和 value 組成', 'index = 位置，value = 位置裡放的值');
  await step(tok);                                     // 23:38 contiguous memory
  tiles(5, -4.4, 2.2, 0.05, 0, 1.9, 1.6);
  say('電腦用一塊連續的空間存 array', '');
  await step(tok);                                     // 23:47 int list[5]
  tag('int list[5];', 'ptr alt', 0, 3.6, 0);
  say('例：int list[5]，有 5 個位置', '');
  await step(tok);                                     // 24:01 0 1 2 3 4 are the indices
  const ids = [];
  await build(tok, 5, 180, (i) => ids.push(tag(String(i), 'idx', X(i), 0, 1.3)));
  say('0、1、2、3、4 就是 index', '');
  await step(tok);                                     // 24:15 like house numbers from 0 to 4
  ids.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('index 就像門牌號碼：從 0 開始到 4', '');
  await step(tok);                                     // 24:22 each cell stores a value
  await build(tok, 5, 220, (i) => cube('list[' + i + ']', colorFor(i), [1.6, 0.8, 1.3], X(i), 0.5, 0, 2));
  say('每個格子裡存的是 value', '這就是 array');
}
FRAG.push(['arrpeng12-array-def', 'Array 是 <index, value> 的集合', scArrayDef]);

// ── Array ADT：Retrieve(A, i)、Store(A, i, x) ──
async function scArrayAdt(tok) {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const X = (i) => -4 + i * 2;
  await step(tok);                                     // 26:30 the array ADT
  const cd = code(['ADT Array', '  objects: a set of <index, value> pairs', '  Array Create(j, list)', '  Item  Retrieve(A, i)', '  Array Store(A, i, x)'], 0, 7.2);
  say('Array 的 ADT（abstract data type）', '');
  await step(tok);                                     // 26:38 objects: a set of pairs
  cd.hl(1);
  say('objects：a set of <index, value> pairs', '');
  await step(tok);                                     // 27:04 one-dimensional
  tiles(5, -4, 2, 0.05, 0, 1.7, 1.5);
  const vs = ['a', 'b', 'c', 'd', 'e'].map((v, i) => { tag(String(i), 'idx', X(i), 0, 1.2); return cube(v, colorFor(i), [1.4, 0.8, 1.2], X(i), 0.5, 0, 2); });
  say('可以是一維 array', '');
  await step(tok);                                     // 27:07 or two / more dimensions
  for (let i = 0; i < 5; i++) { const g = ghostBox(TEAL, 1.4, 0.8, 1.2); g.position.set(X(i), 0.5, -1.8); }
  tag('二維、多維也行', 'note', 5.6, 0.6, -1.8);
  say('也可以是二維或多維 array', '');
  await step(tok);                                     // 27:27 Retrieve(A, i)
  cd.hl(3);
  const cur = tag('i = 2', 'ptr', X(2), 2.2, 0);
  say('Retrieve(A, i)：給一個 index i', '');
  await step(tok);                                     // 27:39 returns the value there
  glow(vs[2], GOLD); move(vs[2], X(2), 1.6, 0);
  say('回傳 i 那個位置存的 value', 'Retrieve(A, 2) = c');
  await step(tok);                                     // 27:52 Store(A, i, x): which index
  move(vs[2], X(2), 0.5, 0); glow(vs[2], null);
  cd.hl(4);
  cur.position.set(X(3), 2.2, 0); txt(cur, 'i = 3');
  say('Store(A, i, x)：要存在哪個位置 i', '');
  await step(tok);                                     // 28:08 value x is stored
  fly(vs[3]);
  await beat(tok, 500);
  vs[3] = cube('x', PINK, [1.4, 0.8, 1.2], X(3), 0.5, 0, 3);
  say('值是 x，把它存進去', 'Store(A, 3, x)');
  await step(tok);                                     // 28:24 like a C++ class, but more general
  cd.hl(-1);
  say('ADT 很像 C++ class 宣告，但更 general', '只說能做什麼，不說怎麼做');
}
FRAG.push(['arrpeng12-adt', 'Array ADT：Retrieve 與 Store', scArrayAdt]);

// ── int list[5] vs int *plist[5] ──
async function scPtrArray(tok) {
  fresh([0, 7, 12.5], [0, 1, 0.5]);
  const X = (i) => -4 + i * 2;
  await step(tok);                                     // 30:47 both are arrays
  tag('int list[5];', 'ptr', -5.8, 0.4, -2.2);
  tag('int *plist[5];', 'ptr alt', -5.8, 0.4, 0.8);
  say('int list[5] 和 int *plist[5] 都是 array', '但差很多');
  await step(tok);                                     // 31:13 list stores integers
  tiles(5, -4, 2, 0.05, -2.2, 1.6, 1.3);
  await build(tok, 5, 150, (i) => cube('int', BLUE, [1.3, 0.7, 1.0], X(i), 0.45, -2.2, 2));
  say('list：每格存一個 integer', '');
  await step(tok);                                     // 31:22 plist: 5 spaces
  tiles(5, -4, 2, 0.05, 0.8, 1.6, 1.3);
  say('看到 * 就知道 plist 存的是 pointer', 'plist 也有 5 個空間');
  await step(tok);                                     // 31:33 each value is a pointer
  await build(tok, 5, 150, (i) => cube('ptr', '#c08a1f', [1.3, 0.7, 1.0], X(i), 0.45, 0.8, 2));
  say('每個空間的 value 是一個 pointer', '');
  await step(tok);                                     // 31:38 pointing to an integer (address)
  await build(tok, 5, 220, (i) => { const t = cube('int', TEAL, [0.9, 0.6, 0.8], X(i) + (i % 2 ? 0.5 : -0.4), 0.3, 3.6, 2); arrow(V3(X(i), 0.8, 1.3), V3(t.position.x, 0.6, 3.1)); });
  say('pointer 指向一個 integer', '存的是那個 integer 的 memory address');
  await step(tok);                                     // 31:47 different declaration, different meaning
  say('兩個宣告不一樣，意義也不一樣', 'list[i] 是 int；plist[i] 是 int *');
}
FRAG.push(['arrpeng12-ptr-array', 'int list[5] 與 int *plist[5]', scPtrArray]);

// ── 一維陣列的 address：list[i] 在 α + i·sizeof(int) ──
async function scAddress(tok) {
  fresh([0, 6, 12.5], [0, 1, 0]);
  const X = (i) => -4.4 + i * 2.2;
  const cs = [];
  const addr = ['α', 'α + sizeof(int)', 'α + 2·sizeof(int)', 'α + 3·sizeof(int)', 'α + 4·sizeof(int)'];
  await step(tok);                                     // 31:58 a contiguous block of memory
  await build(tok, 5, 160, (i) => cs.push(cube('list[' + i + ']', colorFor(i), [2.0, 0.8, 1.3], X(i), 0.45, 0, 2)));
  say('一維 array：一塊連續的記憶體', 'int list[5]');
  await step(tok);                                     // 32:04 list[0] at alpha
  const cur = tag('list[0]', 'ptr', X(0), 1.6, 0);
  glow(cs[0], GOLD); tag(addr[0], 'idx', X(0), -0.1, 1.2);
  say('假設 list[0] 放在 α', '');
  await step(tok);                                     // 32:14 where is list[1]?
  glow(cs[0], null); glow(cs[1], GOLD);
  cur.position.set(X(1), 1.6, 0); txt(cur, 'list[1]');
  say('門牌 1 號的 list[1] 在哪裡？', '');
  await step(tok);                                     // 32:23 alpha + sizeof(int)
  tag(addr[1], 'idx', X(1), -0.1, 1.9);
  say('list[1] 在 α + sizeof(int)', '跳過 list[0] 佔的一個 integer');
  await step(tok);                                     // 32:36 sizeof: bytes of an integer
  tag('sizeof(int)：一個 integer 佔幾個 byte', 'note', 0, 2.8, 0);
  say('sizeof(int)：一個 integer 佔幾個 byte', '');
  await step(tok);                                     // 33:17 list[2] at alpha + 2 sizeof(int)
  glow(cs[1], null); glow(cs[2], GOLD);
  cur.position.set(X(2), 1.6, 0); txt(cur, 'list[2]');
  tag(addr[2], 'idx', X(2), -0.1, 1.2);
  say('list[2] 在 α + 2·sizeof(int)', '');
  await step(tok);                                     // 33:23 shift by an offset
  say('前面兩格的大小當 offset，往後 shift', '');
  await step(tok);                                     // 33:32 work out the rest yourself
  glow(cs[2], null);
  tag(addr[3], 'idx', X(3), -0.1, 1.9); tag(addr[4], 'idx', X(4), -0.1, 1.2);
  say('其他的自己推推看', '補充：list[i] 在 <span class="ok">α + i·sizeof(int)</span>');
}
FRAG.push(['arrpeng12-address', '一維陣列的記憶體位址', scAddress]);

// ── int *list1 vs int list2[5]；list2+i、*(list2+i) ──
async function scPtrNotation(tok) {
  fresh([0, 7, 12.5], [0, 1, 0.3]);
  const X = (i) => -2.6 + i * 1.8;
  await step(tok);                                     // 33:51 list1, list2 are both pointers
  cube('list1', '#c08a1f', [1.4, 0.7, 1.0], -5.6, 0.4, -2.2, 1.5);
  cube('list2', '#c08a1f', [1.4, 0.7, 1.0], -5.6, 0.4, 1.2, 1.5);
  say('int *list1; 和 int list2[5];', 'list1、list2 其實都是 pointer');
  await step(tok);                                     // 34:11 list1 points to one integer
  const one = cube('int', TEAL, [1.4, 0.7, 1.0], -2.6, 0.4, -2.2, 2);
  arrow(V3(-4.8, 0.4, -2.2), V3(-3.4, 0.4, -2.2));
  glow(one, GOLD);
  say('list1 只指到一個 integer 的空間', '');
  await step(tok);                                     // 34:20 list2 points to 5 integers
  glow(one, null);
  const cs = [];
  await build(tok, 5, 150, (i) => cs.push(cube('[' + i + ']', colorFor(i), [1.6, 0.7, 1.1], X(i), 0.4, 1.2, 2)));
  let ar = arrow(V3(-4.8, 0.4, 1.2), V3(-3.5, 0.4, 1.2));
  say('list2 指到一塊連續、5 個 integer 的空間', '');
  await step(tok);                                     // 34:54 no index: list2 = &list2[0]
  const f = tag('list2 = &list2[0]', 'ptr', X(0), 1.8, 1.2);
  glow(cs[0], GOLD);
  say('不寫 index：list2 就是 list2[0] 的位址', 'list2 = &list2[0]');
  await step(tok);                                     // 35:03 list2 + i = &list2[i]
  glow(cs[0], null);
  for (const i of [1, 3]) {
    cs.forEach((m, k) => glow(m, k === i ? GOLD : null));
    kill(ar); ar = arrow(V3(-4.8, 1.0, 1.2), V3(X(i), 0.9, 1.2), 0xc08a1f);
    f.position.set(X(i), 1.8, 1.2); txt(f, 'list2 + ' + i + ' = &list2[' + i + ']');
    await beat(tok, 900);
  }
  say('list2 + i 指向 list2[i]', 'list2 + i = &list2[i]');
  await step(tok);                                     // 35:26 *(list2 + i) gives the value
  move(cs[3], X(3), 1.3, 1.2);
  txt(f, '*(list2 + 3) = list2[3]'); f.position.set(X(3), 2.3, 1.2);
  say('前面加 *：取出那格的 value', '*(list2 + i) = list2[i]');
  await step(tok);                                     // 35:47 pointer + integer moves the pointer
  say('pointer 加一個整數 = 往後調整位置', '每 +1 跳一個 int 的大小');
  await step(tok);                                     // 36:58 list1: one memory block of one int
  glow(one, GOLD);
  say('list1 指到的空間：剛好一個 integer', '');
  await step(tok);                                     // 37:20 both pointers; the size differs
  cs.forEach((m) => glow(m, GOLD));
  say('兩個都是 pointer', '不同的是指到的空間大小：1 個 vs 5 個 int');
}
FRAG.push(['arrpeng12-ptr-notation', 'list2 + i 與 *(list2 + i)', scPtrNotation]);

// ── Program 2.1 print1：one[] = {0,1,2,3,4}，印出 address 與 contents ──
async function scPrint1(tok) {
  fresh([0, 6.5, 13], [0, 2.4, 0]);
  const X = (i) => -4.8 + i * 1.6;
  await step(tok);                                     // 38:22 array one printed by print1
  const cd = code(['int one[] = {0, 1, 2, 3, 4};', 'print1(&one[0], 5);', '', 'void print1(int *ptr, int rows) {', '  int i;', '  printf("Address Contents\\n");', '  for (i = 0; i < rows; i++)', '    printf("%8u%5d\\n", ptr + i, *(ptr + i));', '}'], -2.4, 7.6, 0.5);
  cd.hl(1);
  const cs = [];
  await build(tok, 5, 150, (i) => cs.push(cube(String(i), colorFor(i), [1.4, 0.7, 1.1], X(i), 0.4, 1.6, 2)));
  say('例子：array one，用 procedure print1 印出來', 'one[] = {0, 1, 2, 3, 4}');
  await step(tok);                                     // 38:34 inputs: ptr and rows
  cd.hl(3);
  const pt = tag('ptr', 'ptr', X(0), 1.5, 1.6);
  say('print1 的輸入：pointer ptr 和個數 rows', 'ptr 指到 one[0]，rows = 5');
  await step(tok);                                     // 38:46 printf with a format
  cd.hl(5);
  tag('Address  Contents', 'ptr alt', 4.6, 3.4, 1.6);
  say('C 用 printf 輸出，要寫出格式控制', '對應 C++ 的 cout');
  await step(tok);                                     // 39:26 %8u
  cd.hl(7);
  tag('%8u：佔 8 格印 address', 'note', 4.6, 4.6, 1.6);
  say('%8u：佔 8 個單位，印 address', '');
  await step(tok);                                     // 39:36 %5d
  tag('%5d：佔 5 格印數值', 'note', 4.6, 4.1, 1.6);
  say('%5d：佔 5 格，印 integer 數值', '');
  await step(tok);                                     // 40:06 loop: address and value of every element
  await build(tok, 5, 350, (i) => {
    pt.position.set(X(i), 1.5, 1.6); txt(pt, 'ptr + ' + i);
    cs.forEach((m, k) => glow(m, k === i ? GOLD : null));
    const l = tag(String(1228 + 2 * i).padStart(8, ' ') + String(i).padStart(5, ' '), '', 4.6, 2.8 - i * 0.5, 1.6);
    Object.assign(l.element.style, MONO);
  });
  say('for 迴圈：每個元素印出 address 和存的值', 'ptr + i 是位址，*(ptr + i) 是值');
  await step(tok);                                     // 40:50 the book's output starts at 1228
  cs.forEach((m) => glow(m, null));
  say('書上的實際輸出：address 從 1228 開始', '每次 +2：書上的 int 佔 2 bytes');
}
FRAG.push(['arrpeng12-print1', 'print1：印出位址與內容', scPrint1]);

// ── struct：person 的三個欄位；typedef struct humanBeing ──
async function scStruct(tok) {
  const td = P().typedef;
  fresh([0, 6.5, 12.5], [0, 2, 0]);
  const mk = (z, nm) => {
    tag(nm, 'ptr', 3, 3.5, z);
    return [['name', BLUE], ['age', ORANGE], ['salary', PURPLE]].map(([f, c], k) => { tag(f, 'idx', 1.0, 2.6 - k * 0.95, z); return cube('', c, [2.4, 0.8, 1.0], 3.3, 2.6 - k * 0.95, z, 2); });
  };
  if (!td) {
    const lines = ['struct {', '  char name[10];', '  int age;', '  float salary;', '} person;', 'strcpy(person.name, "james");', 'person.age = 10;', 'person.salary = 35000;'];
    await step(tok);                                   // 41:52 structure: your own data type with three fields
    const cd = code(lines, -3.4, 7.4, 0.52);
    cd.hl(1);
    const fs = mk(0, '');
    say('structure：自己宣告一個 data type', '三個欄位：name、age、salary');
    await step(tok);                                   // 42:02 the variable is person
    cd.hl(4); tag('person', 'ptr', 3.3, 3.5, 0);
    say('宣告出來的變數叫 person', '');
    await step(tok);                                   // 42:09 strcpy into person.name
    cd.hl(5);
    fs[0].add(fs[0].userData.lbl = lab.label('"james"', 'val'));
    glow(fs[0], GOLD);
    say('strcpy：把字串 "james" copy 到 name', 'string copy');
    await step(tok);                                   // 42:39 person.age, person.salary
    glow(fs[0], null);
    cd.hl(6);
    fs[1].add(lab.label('10', 'val')); glow(fs[1], GOLD);
    await beat(tok, 700);
    cd.hl(7);
    fs[2].add(lab.label('35000', 'val')); glow(fs[2], GOLD);
    say('用「.」存取欄位', 'person.age、person.salary');
    return;
  }
  await step(tok);                                     // 45:36 typedef struct
  const cd = code(['typedef struct {', '  char name[10];', '  int age;', '  float salary;', '} humanBeing;', 'humanBeing person1, person2;'], -3.4, 7.4, 0.52);
  cd.hl(0);
  say('structure 也可以這樣宣告：typedef struct', '');
  await step(tok);                                     // 45:53 three fields, named humanBeing
  cd.hl(4);
  say('typedef struct {三個欄位} humanBeing;', 'humanBeing 變成一個新的 data type 名字');
  await step(tok);                                     // 46:13 declare person1, person2
  cd.hl(5);
  mk(-1.4, 'person1');
  await beat(tok, 500);
  mk(1.4, 'person2');
  say('用 humanBeing 宣告變數', 'humanBeing person1, person2;');
  await step(tok);                                     // 46:21 union: skipped
  cd.hl(-1);
  say('union 先跳過', '');
  await step(tok);                                     // 46:37 self-referential structure
  const g = cube('', TEAL, [1.6, 0.7, 1.0], 3.2, 0.4, -2.6, 1.5);
  tag('link → 指到自己這種 type', 'note', 3.2, 1.3, -2.6);
  arrow(V3(4.1, 0.4, -2.6), V3(5.2, 0.4, -2.6), 0xc08a1f);
  say('structure 的欄位可以指到自己這種 type', '留到 linked list 再講');
}
FRAG.push(['arrpeng12-struct', 'struct 與 typedef', scStruct]);

// ── Ordered list：一週 7 天；length、scan、取第 i 個 ──
async function scOrderedList(tok) {
  fresh([0, 6, 13], [0, 1, 0]);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const X = (i) => -5.4 + i * 1.8;
  const cs = [];
  await step(tok);                                     // 47:27 ordered list: e.g. the 7 days of a week
  await build(tok, 7, 150, (i) => cs.push(cube(days[i], colorFor(i), [1.5, 0.7, 1.1], X(i), 0.4, 0, 2)));
  say('有了 array 就能做 ordered list', '例：一週有 7 天，一個接一個');
  await step(tok);                                     // 47:35 store it in an array
  for (let i = 0; i < 7; i++) tag(String(i), 'idx', X(i), 0, 1.1);
  say('可以用一個 array 存', '第 i 天放在 index i');
  await step(tok);                                     // 47:44 how long is the list
  tag('length = 7', 'ptr', 0, 2.2, 0);
  say('可以問：這個 list 有多長？', 'length = 7');
  await step(tok);                                     // 47:56 scan from left to right
  const cur = tag('▼', 'ptr alt', X(0), 1.4, 0);
  await build(tok, 7, 250, (i) => { cur.position.set(X(i), 1.4, 0); cs.forEach((m, k) => glow(m, k === i ? GOLD : null)); });
  say('scan：由左到右把所有值印出來', 'Sun → Mon → … → Sat');
  await step(tok);                                     // 48:06 read the value at a position
  cs.forEach((m) => glow(m, null));
  cur.position.set(X(3), 1.4, 0); glow(cs[3], GREEN);
  say('取出某個位置的值', '第 3 個位置 → Wed');
  await step(tok);                                     // 48:21 an array is also a kind of list
  say('所以 array 也可以看成是一種 list', 'list 到底是什麼，後面的章節再講');
}
FRAG.push(['arrpeng12-ordered-list', 'Ordered list 與它的操作', scOrderedList]);

// ── 多項式：A(x) = 3x²⁰ + 2x⁵ + 4，B(x) = x⁴ + 10x³ + 3x² + 1，A + B ──
async function scPolyIntro(tok) {
  fresh([0, 7, 13], [0, 1, 0]);
  const cols = [20, 5, 4, 3, 2, 0], X = (e) => -5 + cols.indexOf(e) * 2;
  const A = [[3, 20], [2, 5], [4, 0]], B = [[1, 4], [10, 3], [3, 2], [1, 0]];
  await step(tok);                                     // 49:03 A(x) = 3x^20 + 2x^5 + 4
  tag('A', 'ptr', -6.6, 0.4, -2.4);
  const am = A.map(([c, e]) => cube(term(c, e), BLUE, [1.7, 0.7, 1.1], X(e), 0.4, -2.4, 2));
  say('用 array 表示多項式', 'A(x) = 3x²⁰ + 2x⁵ + 4');
  await step(tok);                                     // 49:26 another polynomial B(x)
  tag('B', 'ptr alt', -6.6, 0.4, 0);
  const bm = B.map(([c, e]) => cube(term(c, e), ORANGE, [1.7, 0.7, 1.1], X(e), 0.4, 0, 2));
  say('再一個多項式 B(x)', 'B(x) = x⁴ + 10x³ + 3x² + 1');
  await step(tok);                                     // 49:40 A(x) + B(x): same exponents add
  cols.forEach((e) => tag('x' + sup(e), 'idx', X(e), 0, 3.6));
  for (const e of cols) {
    const a = A.find((t) => t[1] === e), b = B.find((t) => t[1] === e);
    if (a) move(am[A.indexOf(a)], X(e), 0.4, 2.4);
    if (b) move(bm[B.indexOf(b)], X(e), a ? 1.15 : 0.4, 2.4);
  }
  await beat(tok, 900);
  say('A(x) + B(x)：同一個指數的放在一起', '');
  await step(tok);                                     // 50:17 constants: 4 + 1 = 5
  fly(am[2]); fly(bm[3]);
  cube('5', GREEN, [1.7, 0.7, 1.1], X(0), 0.4, 2.4, 2);
  say('指數相同，係數相加：常數項 4 + 1 = 5', '= 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5');
  await step(tok);                                     // 50:48 goal: a program for add/subtract
  say('目標：寫程式做多項式的加法和減法', '');
  await step(tok);                                     // 51:12 Eval: plug in x = 5
  tag('Eval：x = 5 代進去 → A(5) = ?', 'note', 0, 4.4, 0);
  say('ADT 裡還有 Eval：代入 x 算出值', '例如 x = 5');
  await step(tok);                                     // 51:49 how to represent a polynomial?
  say('第一個問題：多項式在電腦裡怎麼表示？', '');
}
FRAG.push(['arrpeng12-poly-intro', '多項式與加法', scPolyIntro]);

// ── 表示法 1：coef[MaxDegree + 1]，index = 指數，value = 係數 ──
async function scPolyRep1(tok) {
  const sparse = P().poly === 'sparse';
  fresh([0, 6.5, 13], [0, 1.2, 0]);
  if (!sparse) {
    const coef = [1, 0, 3, 10, 1], X = (i) => -4.4 + i * 2.2;
    await step(tok);                                   // 52:12 int degree + coefficient array
    const cd = code(['int degree;', 'float coef[MAX_DEGREE + 1];'], 0, 5.6);
    say('宣告 int degree 和一個係數 array', '');
    await step(tok);                                   // 52:18 degree = the exponent part
    cd.hl(0);
    say('degree 是指數的部分', '前面乘的是係數');
    await step(tok);                                   // 52:34 x^4 + 10x^3 + 3x^2 + 1 as an array
    tag('x⁴ + 10x³ + 3x² + 1', 'ptr', 0, 3.8, 0);
    tiles(5, -4.4, 2.2, 0.05, 0, 1.9, 1.5);
    const il = [];
    for (let i = 0; i < 5; i++) il.push(tag('[' + i + ']  x' + sup(i), 'idx', X(i), 0, 1.3));
    say('例：x⁴ + 10x³ + 3x² + 1 存成 array', '');
    await step(tok);                                   // 52:45 position 4 = x^4, coefficient 1
    const cs = [];
    cs[4] = cube('1', colorFor(1), [1.6, 0.75, 1.2], X(4), 0.45, 0, 2);
    say('位置 4 代表 x⁴，它的係數是 1', 'coef[4] = 1');
    await step(tok);                                   // 53:03 index = exponent
    il.forEach((l) => { l.element.className = 'lab-label ptr'; });
    say('array 的 index 就是指數', '');
    await step(tok);                                   // 53:13 value = coefficient
    await build(tok, 4, 220, (q) => { const i = 3 - q; cs[i] = cube(String(coef[i]), coef[i] ? colorFor(coef[i]) : GRAY, [1.6, 0.75, 1.2], X(i), 0.45, 0, 2); });
    say('array 裡的 value 就是係數', '沒有 x¹ 項 → 係數 0');
    await step(tok);                                   // 53:22 10x^3 sits at position 3
    glow(cs[3], GOLD);
    say('10x³ 放在位置 3', 'coef[3] = 10');
    await step(tok);                                   // 53:42 declared MAX_DEGREE + 1
    glow(cs[3], null);
    cd.hl(1);
    say('宣告大小是 MAX_DEGREE + 1', '');
    await step(tok);                                   // 54:02 MAX_DEGREE = 100: x^101 does not fit
    tag('MAX_DEGREE = 100 → 最多存到 x¹⁰⁰；x¹⁰¹ 放不下', 'note', 0, 4.6, 0);
    say('限制最高次方：最多只到 x^MAX_DEGREE', '');
    await step(tok);                                   // 54:23 +1 for the constant (index 0)
    glow(cs[0], GOLD);
    say('+1 是給常數項：index 0', '0 … MAX_DEGREE 共 MAX_DEGREE + 1 格');
    return;
  }
  await step(tok);                                     // 0:00 review: array = a set of pairs
  tag('Array：a set of <index, value> pairs', 'ptr', 0, 5.0, 0);
  say('複習：array 是 a set of pairs', '<index, value>');
  await step(tok);                                     // 0:59 last time: polynomials with arrays
  say('上次用 array 來表示多項式', '');
  await step(tok);                                     // 1:19 representation 1: one array per polynomial
  const cd = code(['int degree;', 'float coef[MAX_DEGREE + 1];'], 0, 4.2);
  say('表示法 1：每個多項式都有一個 array', '');
  await step(tok);                                     // 1:27 named coef for a reason
  cd.hl(1);
  say('array 名字叫 coef：存的都是係數', 'coefficient');
  await step(tok);                                     // 1:44 the exponent is the index
  say('指數在哪？就是 index', '');
  await step(tok);                                     // 2:06 sparse: 2x^1000 + 1
  tag('2x¹⁰⁰⁰ + 1', 'ptr alt', 0, 3.0, 0);
  const idx = [0, 1, 2, 3, '…', 998, 999, 1000], X = (i) => -5.6 + i * 1.6;
  const cs = [];
  await build(tok, idx.length, 150, (k) => {
    if (idx[k] === '…') { tag('… 0 …', 'idx', X(k), 0.5, 0); return; }
    tag(String(idx[k]), 'idx', X(k), 0, 1.2);
    cs[k] = cube('', GRAY, [1.3, 0.7, 1.0], X(k), 0.4, 0, 1.5);
  });
  say('很 sparse 的多項式：2x¹⁰⁰⁰ + 1', '要開一個很大的 coef array');
  await step(tok);                                     // 2:23 only x^1000 holds 2
  relabel(cs[7], 2); cs[7].add(lab.label('2', 'val')); tint(cs[7], GREEN);
  say('只有 x¹⁰⁰⁰ 的位置存 2', 'coef[1000] = 2');
  await step(tok);                                     // 2:32 index 0 holds 1, the rest empty
  cs[0].add(lab.label('1', 'val')); tint(cs[0], GREEN);
  [1, 2, 3, 5, 6].forEach((k) => glow(cs[k], RED));
  say('index 0 存 1，其他全是空的', '<span class="no">很浪費空間</span>');
  await step(tok);                                     // 2:43 representation 2: read the book
  say('表示法 2 課堂不講，回去看書', '期中可能會考');
}
FRAG.push(['arrpeng12-poly-rep1', '多項式表示法 1：係數陣列', scPolyRep1]);

// ── padd 虛擬碼：比 LeadExp，三個 case，Attach + Remove ──
async function scPadd(tok) {
  fresh([0, 7.5, 13.5], [0, 1.8, 0]);
  const cd = code(['D = Zero();', 'while (!IsZero(A) && !IsZero(B))', '  switch COMPARE(LeadExp(A), LeadExp(B)) {', '   case -1: Attach(D, B 的最高項); Remove B 的最高項', '   case  0: sum = 兩係數相加; if (sum) Attach(D, sum)', '            Remove A、B 的最高項', '   case  1: Attach(D, A 的最高項); Remove A 的最高項', '  }'], 0, 7.6, 0.48);
  const A = [[3, 20], [2, 5], [4, 0]], B = [[1, 4], [10, 3], [3, 2], [1, 0]];
  const X = (i) => -4.2 + i * 1.9;
  let nd = 0;
  const shift = (ms, k) => ms.slice(k).forEach((m, j) => move(m, X(j), 0.4, m.position.z));
  const toD = (m) => { move(m, X(nd), 0.4, 2.4); glow(m, null); nd++; };
  await step(tok);                                     // 55:20 d = a + b, all polynomials
  tag('A', 'ptr', -6, 0.4, -2.2); tag('B', 'ptr alt', -6, 0.4, 0); tag('D', 'ptr', -6, 0.4, 2.4);
  const am = A.map(([c, e], i) => cube(term(c, e), BLUE, [1.6, 0.7, 1.0], X(i), 0.4, -2.2, 2));
  const bm = B.map(([c, e], i) => cube(term(c, e), ORANGE, [1.6, 0.7, 1.0], X(i), 0.4, 0, 2));
  say('pseudocode：d = a + b', 'a、b、d 都是多項式');
  await step(tok);                                     // 55:40 D = 0: initialise
  cd.hl(0);
  tiles(6, X(0), 1.9, 0.05, 2.4, 1.6, 1.0, '#f6efe2');
  say('D = 0：初始化，係數全部清成 0', '');
  await step(tok);                                     // 56:03 enter the while loop
  cd.hl(1);
  say('初始化完，進入 while 迴圈', '');
  await step(tok);                                     // 56:13 check whether A, B are zero
  say('先判斷 A、B 是不是 0（空了）', 'IsZero(A)、IsZero(B)：空了就不用加');
  await step(tok);                                     // 56:51 switch: compare the largest exponents
  cd.hl(2);
  say('不是空的 → switch：比 A、B 的最高指數', 'COMPARE(LeadExp(A), LeadExp(B))');
  await step(tok);                                     // 57:23 LeadExp(A) = 20
  glow(am[0], GOLD);
  say('LeadExp(A) 回傳 20', '3x²⁰ + 2x⁵ + 4 最大是 x²⁰');
  await step(tok);                                     // 57:33 LeadExp(B) = 4
  glow(bm[0], GOLD);
  say('LeadExp(B) 回傳 4', 'x⁴ + 10x³ + 3x² + 1 最大是 x⁴');
  await step(tok);                                     // 58:19 three cases: -1, 0, 1
  tag('1：A 大　−1：B 大　0：一樣', 'note', -0.2, 3.6, 0);
  say('COMPARE 有三個 case', '1（A 大）、−1（B 大）、0（相同）');
  await step(tok);                                     // 59:09 case 1: two instructions
  cd.hl(6);
  say('20 > 4 → case 1：做這兩行', 'Attach、Remove');
  await step(tok);                                     // 1:00:02 3x^20 copied into D
  toD(am[0]); glow(bm[0], null);
  say('Attach：把 3x²⁰ copy 一份到 D', 'D 的位置 20 從 0 變 3');
  await step(tok);                                     // 1:00:23 remove it from A
  await beat(tok, 300); shift(am, 1);
  say('Remove：從 A 刪掉 3x²⁰', 'A 剩 2x⁵ + 4');
  await step(tok);                                     // 1:00:43 next loop: 5 vs 4
  cd.hl(2);
  glow(am[1], GOLD); glow(bm[0], GOLD);
  say('下一圈：LeadExp(A) = 5，LeadExp(B) = 4', '5 > 4，還是 A 大');
  await step(tok);                                     // 1:01:04 2x^5 into D, A only has 4 left
  cd.hl(6);
  toD(am[1]); glow(bm[0], null);
  await beat(tok, 300); shift(am, 2);
  say('2x⁵ copy 到 D，A 只剩 4', '');
  await step(tok);                                     // 1:01:29 third loop: B larger
  cd.hl(3);
  toD(bm[0]); await beat(tok, 300); shift(bm, 1);
  say('第三圈：4 對 x⁴ → B 大，x⁴ 進 D', '其餘請自己 trace');
  await step(tok);                                     // 1:01:43 same exponent: add coefficients
  for (const k of [1, 2]) { toD(bm[k]); await beat(tok, 450); }
  shift(bm, 3);
  cd.hl(4);
  await beat(tok, 400);
  fly(am[2]); fly(bm[3]);
  cube('5', GREEN, [1.6, 0.7, 1.0], X(nd), 0.4, 2.4, 2);
  say('指數相同 → 係數相加', '常數項：4 + 1 = 5');
  await step(tok);                                     // 1:02:22 that is the pseudocode
  cd.hl(-1);
  say('這就是多項式加法的 pseudocode', 'D = 3x²⁰ + 2x⁵ + x⁴ + 10x³ + 3x² + 5');
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
  X.ids = [];
  for (let i = 0; i < n; i++) X.ids.push(tag(String(i), 'idx', X(i), 0, 2.0));
  return X;
}
async function scTermArray(tok) {
  const recap = P().recap;
  fresh([0, 7, 12.5], [0, 1.2, 0.5]);
  const all = [...TA_A.map((t) => [t, BLUE]), ...TA_B.map((t) => [t, ORANGE])];
  if (recap) {
    await step(tok);                                   // 3:07 representation 3: one global array
    tag('A(x) = 2x¹⁰⁰⁰ + 1', 'ptr', -3.4, 4.6, 0); tag('B(x) = x⁴ + 10x³ + 3x² + 1', 'ptr alt', 2.6, 4.6, 0);
    const X = taFrame(7, -4.8, 1.6, 1.35);
    const cells = all.map(([t, c], i) => taCell(i, t[0], t[1], X, c, 1.5));
    say('表示法 3：所有多項式放進一個 global array', '這個很重要');
    await step(tok);                                   // 3:20 bottom row: the index
    X.ids.forEach((l) => { l.element.className = 'lab-label ptr'; });
    say('最下面 0…6 是 array 的 index', '');
    await step(tok);                                   // 3:37 which polynomial uses which cells
    say('index 告訴你：哪個多項式佔哪些空間', '');
    await step(tok);                                   // 3:45 A.start .. A.finish
    tag('A.start', 'ptr', X(0), 2.2, -0.4); tag('A.finish', 'ptr', X(1), 1.6, -0.4);
    cells.slice(0, 2).forEach((p) => p.forEach((m) => glow(m, GOLD)));
    say('A.start 到 A.finish 存 A', 'index 0 … 1');
    await step(tok);                                   // 4:03 B.start .. B.finish
    cells.slice(0, 2).forEach((p) => p.forEach((m) => glow(m, null)));
    tag('B.start', 'ptr alt', X(2), 2.2, -0.4); tag('B.finish', 'ptr alt', X(5), 2.2, -0.4);
    cells.slice(2).forEach((p) => p.forEach((m) => glow(m, GOLD)));
    say('B.start 到 B.finish 存 B', 'index 2 … 5');
    await step(tok);                                   // 4:21 index records each start and end
    cells.slice(2).forEach((p) => p.forEach((m) => glow(m, null)));
    say('用 index 記錄每個多項式的 start 和 end', '');
    await step(tok);                                   // 4:37 A.start holds two things: coefficient 2
    glow(cells[0][0], GOLD);
    say('A.start 那格存兩個資訊：係數 2', '');
    await step(tok);                                   // 4:47 and exponent 1000
    glow(cells[0][1], GOLD);
    say('指數部分存 1000', 'A 的第一項：2x¹⁰⁰⁰');
    await step(tok);                                   // 5:05 A.finish: 1 and 0
    cells[0].forEach((m) => glow(m, null)); cells[1].forEach((m) => glow(m, GOLD));
    say('A.finish 那格：係數 1、指數 0', '就是 1·x⁰ = 1');
    return;
  }
  await step(tok);                                     // 1:03:02 skip representation 2, look at 3
  say('表示法 2 跳過，直接看表示法 3', '');
  await step(tok);                                     // 1:03:20 2x^1000 + 1 wastes representation 1
  tag('A(x) = 2x¹⁰⁰⁰ + 1', 'ptr', -3.4, 4.6, 0);
  say('A(x) = 2x¹⁰⁰⁰ + 1 用表示法 1', '<span class="no">1001 格幾乎都是 0：浪費</span>');
  await step(tok);                                     // 1:03:55 one big array for all polynomials
  const X = taFrame(7, -4.8, 1.6, 1.35);
  tiles(7, X(0), 1.6, 0.05, 0.5, 1.35, 2.1, '#f6efe2');
  say('乾脆用一個很大的 array 存所有多項式', '');
  await step(tok);                                     // 1:04:12 each cell: coefficient and exponent
  tag('B(x) = x⁴ + 10x³ + 3x² + 1', 'ptr alt', 2.6, 4.6, 0);
  const cells = [];
  await build(tok, all.length, 220, (i) => cells.push(taCell(i, all[i][0][0], all[i][0][1], X, all[i][1])));
  say('每格存兩部分：係數和指數', '只存非 0 的項');
  await step(tok);                                     // 1:04:29 A.start
  tag('A.start', 'ptr', X(0), 2.2, -0.4);
  say('A.start：A 在 array 裡的第一個位置', '');
  await step(tok);                                     // 1:04:52 A.finish
  tag('A.finish', 'ptr', X(1), 1.6, -0.4);
  say('A.finish：A 的最後一個 element', '');
  await step(tok);                                     // 1:05:02 0..6: index of the global array
  X.ids.forEach((l) => { l.element.className = 'lab-label ptr'; });
  say('下面 0…6 是整個 global array 的 index', '');
  await step(tok);                                     // 1:05:36 the labels on top are not stored
  say('上面的 A.start 那些字，電腦不存', '只是方便說明');
  await step(tok);                                     // 1:06:22 B.start = 2: 1x^4
  tag('B.start', 'ptr alt', X(2), 2.2, -0.4);
  cells[2].forEach((m) => glow(m, GOLD));
  say('B.start = 2：係數 1、指數 4', '就是 x⁴');
  await step(tok);                                     // 1:06:54 B.finish and free
  cells[2].forEach((m) => glow(m, null));
  tag('B.finish', 'ptr alt', X(5), 2.2, -0.4);
  tag('free', 'ptr', X(6), 1.6, -0.4);
  say('B.finish 是 B 的結尾；free 是剩餘空間的開頭', '');
  await step(tok);                                     // 1:07:05 a new C starts at free
  tag('C.start = free', 'note', X(6), 3.0, -0.4);
  say('有新的多項式 C，就從 free 開始放', '');
  await step(tok);                                     // 1:07:51 need each polynomial's start and end
  say('一個 array 放全部 → 要記每個多項式的起頭和結尾', '');
  await step(tok);                                     // 1:08:11 A at 0..1, B at 2..5
  cells.slice(0, 2).forEach((p) => p.forEach((m) => glow(m, GOLD)));
  say('A：起始 0、結束 1；B：起始 2、結束 5', '');
}
FRAG.push(['arrpeng12-term-array', '表示法 3：共用的 termArray', scTermArray]);

// ── class Term / class Polynomial：static termArray、static free ──
async function scPolyClass(tok) {
  const recap = P().recap;
  fresh([0, 7, 13], [0, 2, 0]);
  const lines = ['class Term {', '  friend Polynomial;', '  float coef; int exp;', '};', 'class Polynomial {', ' private:', '  static Term termArray[MaxTerms];', '  static int free;', '  int start, finish;', '};'];
  const arr = [];
  const showArr = () => { for (let i = 0; i < 6; i++) arr.push(cube('', i < 2 ? BLUE : ORANGE, [0.75, 0.6, 0.9], 0.6 + i * 0.85, 0.35, 0, 1.5)); tag('termArray（只有一份）', 'ptr alt', 2.7, 1.3, 0); };
  let cd, pa, pb, ar = [];
  const objs = () => {
    pa = cube('A', BLUE, [1.2, 0.7, 1.0], 1.3, 0.4, 3.4, 2); pb = cube('B', ORANGE, [1.2, 0.7, 1.0], 4.3, 0.4, 3.4, 2);
    tag('start 0 / finish 1', 'idx', 1.3, 0, 4.3); tag('start 2 / finish 5', 'idx', 4.3, 0, 4.3);
    ar = [arrow(V3(1.3, 0.8, 2.9), V3(1.0, 0.7, 0.5)), arrow(V3(4.3, 0.8, 2.9), V3(3.3, 0.7, 0.5))];
  };
  if (recap) {
    await step(tok);                                   // 5:41 the class declarations matter
    cd = code(lines, -3.4, 7.8, 0.5);
    say('實作時，class 的宣告要特別注意', '');
    await step(tok);                                   // 5:49 each cell is a class Term
    cd.hl(0); showArr();
    say('表上的每一格，用一個 class Term 表示', '');
    await step(tok);                                   // 6:01 friend class Polynomial
    cd.hl(1);
    say('Term 的 friend class 是 Polynomial', 'Polynomial 可以直接用 Term 的 private 資料');
    await step(tok);                                   // 6:10 data 1: coefficient
    cd.hl(2);
    say('Term 有兩個重要的 data：第一個是 coef', '');
    await step(tok);                                   // 6:20 data 2: exponent
    say('第二個是 exp（指數）', '一格 = 一個 Term');
    await step(tok);                                   // 6:28 class Polynomial, private part
    cd.hl(5);
    say('再看 class Polynomial 的 private 部分', '有三個變數宣告');
    await step(tok);                                   // 6:42 start and end per polynomial
    cd.hl(8); objs();
    say('每個多項式用 start、finish 記自己的位置', '在 global array 裡');
    await step(tok);                                   // 7:24 static Term termArray
    cd.hl(6);
    say('static Term termArray[MaxTerms]', 'Term 組成的 array');
    await step(tok);                                   // 7:38 different polynomials share it
    arr.forEach((m) => glow(m, GOLD));
    say('宣告成 static：不同多項式佔用同一個 termArray', '');
    await step(tok);                                   // 7:52 do not drop static
    arr.forEach((m) => glow(m, null));
    say('static 有它的意義，不要拿掉', '');
    await step(tok);                                   // 8:00 a pointer for the unused cells: free
    cd.hl(7);
    const fr = tag('free = 6', 'ptr', 5.9, 0.35, 1.0);
    say('還要一個指標記錄哪些空間沒用到', 'static int free');
    await step(tok);                                   // 8:28 free points at the first unused index
    glow(arr[5], GOLD); fr.position.set(5.9 + 0.85, 0.35, 0);
    say('free 指到第一個還沒用的 index', '');
    return;
  }
  await step(tok);                                     // 1:09:08 class Term
  cd = code(lines, -3.4, 7.8, 0.5);
  cd.hl(0);
  say('先宣告一個 class Term', '還不是馬上開一個 array');
  await step(tok);                                     // 1:09:22 private: coefficient and exponent
  cd.hl(2);
  say('Term 的 private 有兩個欄位', 'float coef（係數）、int exp（指數）');
  await step(tok);                                     // 1:09:31 class Polynomial
  cd.hl(4);
  say('再宣告 class Polynomial（多項式）', '');
  await step(tok);                                     // 1:09:52 static Term termArray
  cd.hl(6); showArr();
  say('private 裡有 static Term termArray', 'Term 組成的 array');
  await step(tok);                                     // 1:10:13 MaxTerms
  tag('MaxTerms = 最多能放幾個 term', 'note', 2.7, 2.0, 0);
  say('termArray 最多放 MaxTerms 個 term', '');
  await step(tok);                                     // 1:10:35 static int free
  cd.hl(7);
  tag('free = 6', 'idx', 5.9, 0.35, 1.0);
  say('static int free：可用的空間從哪裡開始', '');
  await step(tok);                                     // 1:10:44 start, finish
  cd.hl(8);
  say('start、finish：這個多項式的起頭和結束', '');
  await step(tok);                                     // 1:12:08 Polynomial A, B
  objs();
  say('要存 A、B：宣告 Polynomial A、Polynomial B', '各自記自己的 start、finish');
  await step(tok);                                     // 1:12:24 why static?
  say('為什麼要 static？', '');
  await step(tok);                                     // 1:12:57 without static: each has its own termArray
  ar.forEach(kill);
  const g1 = ghostBox(RED, 4.6, 0.6, 0.9); g1.position.set(1.8, 1.2, 2.2);
  const g2 = ghostBox(RED, 4.6, 0.6, 0.9); g2.position.set(4.0, 1.9, 1.4);
  say('不寫 static：每個多項式都有自己的 termArray', '<span class="no">就做不到「一個 array 存全部」</span>');
  await step(tok);                                     // 1:13:16 with static: share termArray and free
  kill(g1); kill(g2);
  arrow(V3(1.3, 0.8, 2.9), V3(1.0, 0.7, 0.5)); arrow(V3(4.3, 0.8, 2.9), V3(3.3, 0.7, 0.5));
  arr.forEach((m) => glow(m, GOLD));
  say('寫 static：A、B 共用 termArray 和 free', '<span class="ok">只有一份</span>');
}
FRAG.push(['arrpeng12-poly-class', 'Term 與 Polynomial 類別（static）', scPolyClass]);

// ── 用 termArray 做加法：C.start = free，NewTerm 寫在 free 再 free++ ──
async function scPaddGlobal(tok) {
  const recap = P().recap;
  fresh([0, 7.0, 15.5], [0, 3.2, 0.6]);
  const cd = code(['C.start = free; a = start; b = B.start;', 'while (a <= finish && b <= B.finish)', '  switch (compare(termArray[a].exp, termArray[b].exp)) {', '   case \'=\': c = 兩 coef 相加; if (c) NewTerm(c, exp); a++; b++;', '   case \'<\': NewTerm(b 的 coef, exp); b++;', '   case \'>\': NewTerm(a 的 coef, exp); a++;  }', 'for (; a <= finish; a++) NewTerm(…);', 'for (; b <= B.finish; b++) NewTerm(…);', 'C.finish = free − 1;'], 0, 8.7, 0.4, -3.2);
  const X = taFrame(11, -5.5, 1.1, 0.95);
  const all = [...TA_A, ...TA_B];
  const cells = all.map(([c, e], i) => taCell(i, c, e, X, i < 2 ? BLUE : ORANGE, 0));
  const fr = tag('free = 6', 'ptr', X(6), 1.6, -0.4);
  let a = 0, b = 2, free = 6;
  const pa = tag('a', 'ptr', X(0), 2.3, -0.4), pb = tag('b', 'ptr alt', X(2), 2.3, -0.4);
  const newTerm = (c, e) => { taCell(free, c, e, X, GREEN, 2); free++; fr.position.set(X(Math.min(free, 10)), 1.6, -0.4); txt(fr, 'free = ' + free); };
  const ptrs = () => { pa.position.set(X(Math.min(a, 10)), 2.3, -0.4); pb.position.set(X(Math.min(b, 10)), 2.3, -0.4); };
  const hi = (on) => { cells[a].forEach((m) => glow(m, on ? GOLD : null)); cells[b].forEach((m) => glow(m, on ? GOLD : null)); };
  // one comparison round of the while loop
  const round = async () => {
    const ea = all[a][1], eb = all[b][1];
    cd.hl(ea === eb ? 3 : ea < eb ? 4 : 5);
    if (ea > eb) { newTerm(all[a][0], ea); a++; }
    else if (ea < eb) { newTerm(all[b][0], eb); b++; }
    else { newTerm(all[a][0] + all[b][0], ea); a++; b++; }
    ptrs();
  };
  if (recap) {
    await step(tok);                                   // 11:58 same idea as last time
    say('多項式加法的概念跟上次一樣', '這裡不細講');
    await step(tok);                                   // 12:04 compare exponents from the largest
    cd.hl(2); hi(true);
    say('從最大的項開始比指數大小', 'termArray[a].exp vs termArray[b].exp');
    await step(tok);                                   // 12:13 equal: add coefficients
    cd.hl(3);
    say('指數相同：係數相加', '');
    await step(tok);                                   // 12:19 A larger: copy A's term
    hi(false); cd.hl(5);
    newTerm(all[a][0], all[a][1]);
    say('A 比較大：把 A 那項 copy 到新的多項式', 'NewTerm(2, 1000)');
    await step(tok);                                   // 12:29 shift the pointer
    a++; ptrs();
    say('做完一項，指標往後 shift', 'a++');
    await step(tok);                                   // 12:48 while: neither reached finish
    cd.hl(1);
    for (let k = 0; k < 4; k++) { await round(); await beat(tok, 450); }
    say('while：a、b 都還沒到 finish 才比', 'a <= A.finish && b <= B.finish');
    await step(tok);                                   // 13:22 a reached finish: A is done
    cd.hl(-1);
    say('a 超過 finish → A 都檢查完了', '');
    await step(tok);                                   // 13:36 copy what is left of B
    cd.hl(7);
    say('B 還有剩：用 for 迴圈把剩下的項 copy 過去', '這個例子 A、B 剛好同時走完');
    return;
  }
  await step(tok);                                     // 1:14:54 A.Add(B)
  say('改寫後的加法：A.Add(B)', '把 B 加到 A');
  await step(tok);                                     // 1:15:15 result goes into termArray from free
  glow(cells[0][0], null);
  tiles(5, X(6), 1.1, 0.05, 0.5, 0.95, 2.1, '#f6efe2');
  say('結果放在 termArray，從 free 開始', '');
  await step(tok);                                     // 1:15:41 Polynomial C
  const polyC = tag('Polynomial C', 'ptr alt', X(6), 3.0, -0.4);
  say('宣告 Polynomial C 放結果', '');
  await step(tok);                                     // 1:16:09 C.start = free
  cd.hl(0);
  txt(polyC, 'C.start（Polynomial C）');
  say('C.start = free = 6', 'a = A.start = 0，b = B.start = 2');
  await step(tok);                                     // 1:16:37 while: compare the leading exponents
  cd.hl(2); hi(true);
  say('while：比 A、B 開頭（指數最大）的那項', '1000 vs 4');
  await step(tok);                                     // 1:17:02 equal: add coefficients
  cd.hl(3);
  say('指數相同：兩個 coef 相加', '');
  await step(tok);                                     // 1:17:33 A larger: copy A's term into C
  hi(false); cd.hl(5);
  newTerm(all[a][0], all[a][1]); a++; ptrs();
  say('A 比較大：把 A 那項 copy 到 C', 'NewTerm(2, 1000)，a++');
  await step(tok);                                     // 1:17:57 B larger: create B's term
  for (let k = 0; k < 3; k++) { await round(); await beat(tok, 450); }
  say('B 比較大：create B 那項放進去', 'x⁴、10x³、3x² 依序進 C');
  await step(tok);                                     // 1:18:13 NewTerm
  hi(true); await beat(tok, 500); hi(false);
  await round();
  say('都會呼叫 NewTerm：常數項 1 + 1 = 2', 'NewTerm(2, 0)');
  await step(tok);                                     // 1:18:35 NewTerm writes coef, exp at termArray[free]

  say('NewTerm：把新項的 coef、exp 寫到 termArray[free]', '');
  await step(tok);                                     // 1:18:59 then free++
  say('寫完 free++：移到下一個沒用的空間', 'free = ' + free);
  await step(tok);                                     // 1:19:28 free beyond MaxTerms
  tag('free ≥ MaxTerms → 放不下', 'note', X(10.2), 3.0, -0.4);
  say('要檢查：free 超過 MaxTerms 就放不下', '');
  await step(tok);                                     // 1:19:54 then bail out
  cd.hl(8);
  tag('C：6 … ' + (free - 1), 'ptr', X(8), 2.3, -0.4);
  say('放不下就跳出；這裡放得下', 'C(x) = 2x¹⁰⁰⁰ + x⁴ + 10x³ + 3x² + 2');
}
FRAG.push(['arrpeng12-padd-global', '在 termArray 上做多項式加法', scPaddGlobal]);

// ── NewTerm：C(x) = x¹⁰⁰ + 1 放到 free = 6 之後 ──
async function scNewTerm(tok) {
  fresh([0, 7, 12.5], [0, 1.4, 0.6]);
  const X = taFrame(9, -5.2, 1.3, 1.1);
  [...TA_A, ...TA_B].forEach(([c, e], i) => taCell(i, c, e, X, i < 2 ? BLUE : ORANGE, 0));
  let free = 6;
  const fr = tag('free = 6', 'ptr', X(6), 1.7, -0.4);
  let cd;
  await step(tok);                                     // 8:44 declare a new polynomial C
  tag('C(x) = x¹⁰⁰ + 1', 'ptr alt', 0, 5.0, -2);
  say('free 有什麼用？新的多項式 C(x) = x¹⁰⁰ + 1', '要放哪裡？');
  await step(tok);                                     // 8:49 from free = 6 on

  tiles(3, X(6), 1.3, 0.05, 0.5, 1.1, 2.1, '#f6efe2');
  say('從 free = 6 之後的空間開始放', '');
  await step(tok);                                     // 8:59 C.start = 6
  tag('C.start = 6', 'ptr alt', X(6), 2.4, -0.4);
  say('C.start = 6', '');
  await step(tok);                                     // 9:07 two terms: C.finish = 7
  tag('C.finish = 7', 'ptr alt', X(7), 3.0, -0.4);
  say('x¹⁰⁰ + 1 有兩項，C.finish = 7', '');
  await step(tok);                                     // 9:39 new a term
  cd = code(['void Polynomial::NewTerm(float c, int e) {', '  if (free >= MaxTerms) { cerr << "Too many terms"; return; }', '  termArray[free].coef = c;', '  termArray[free].exp = e;', '  free++;', '}'], 0, 7.4, 0.5);
  cd.hl(0);
  say('每一項都要 new 一個 term', 'NewTerm(c, e)');
  await step(tok);                                     // 9:51 first check free vs MaxTerms
  cd.hl(1);
  say('先檢查 free 有沒有超過 MaxTerms', 'termArray 最多放 MaxTerms 個（例：100）');
  await step(tok);                                     // 10:07 too many: error message
  say('超過就印錯誤訊息：放不下', '"Too many terms"');
  await step(tok);                                     // 10:19 otherwise termArray[free].coef = c
  cd.hl(2);
  say('沒超過：termArray[free].coef = c', '');
  await step(tok);                                     // 10:45 index 6: coef 1, exp 100
  cd.hl(3);
  taCell(free, 1, 100, X, GREEN, 2);
  say('第一項：位置 6 放 coef 1、exp 100', 'NewTerm(1, 100)');
  await step(tok);                                     // 10:52 free++
  cd.hl(4);
  free++; fr.position.set(X(free), 1.7, -0.4); txt(fr, 'free = ' + free);
  say('free++：把 free 往後移一格', 'free = 7');
  await step(tok);                                     // 10:59 another term
  cd.hl(1);
  say('還有另一項，再 new 一個 term', 'NewTerm(1, 0)');
  await step(tok);                                     // 11:06 coef 1, exp 0: C is in
  cd.hl(3);
  taCell(free, 1, 0, X, GREEN, 2);
  await beat(tok, 600);
  cd.hl(4);
  free++; fr.position.set(X(free), 1.7, -0.4); txt(fr, 'free = ' + free);
  say('第二項 coef 1、exp 0：C 塞進 termArray 了', 'free = 8');
}
FRAG.push(['arrpeng12-newterm', 'NewTerm：把新項寫到 free', scNewTerm]);

// ── 加法的時間 O(n + m) 與 storage 分析 ──
async function scPolyCost(tok) {
  const focus = P().focus;
  fresh([0, 7, 13], [0, 1.4, 0]);
  if (focus === 'space') {
    const H = (v) => 0.2 + Math.log10(v + 1) * 1.3;
    await step(tok);                                   // 1:22:46 each polynomial: start and finish
    tag('start', 'ptr', -4.5, 4.6, 0); tag('finish', 'ptr', -2.5, 4.6, 0);
    say('storage：每個多項式要存 start、finish', '');
    await step(tok);                                   // 1:22:54 finish - start + 1 terms
    tag('finish − start + 1 個項', 'ptr alt', 1.4, 4.6, 0);
    say('還要存 finish − start + 1 個項', '');
    await step(tok);                                   // 1:23:03 times 2
    tag('× 2', 'ptr alt', 4.4, 4.6, 0);
    say('前面乘 2：每項要存 exp 和 coef', 'storage = 2 × (finish − start + 1)');
    await step(tok);                                   // 1:23:24 non-sparse
    const k = 1, x = 0, r1 = 1001, r3 = 2 * 1001 + 2;
    tag('non-sparse：x¹⁰⁰⁰ … x⁰ 全非 0', 'idx', x, 0, 2);
    const b1 = cube('', BLUE, [1.6, H(r1), 1.4], x - 1.2, H(r1) / 2, 0, 1.5);
    tag('表示法 1：' + r1, 'idx', x - 1.2, H(r1) + 0.4, 0);
    say('如果多項式不 sparse（non-sparse）', '');
    await step(tok);                                   // 1:23:40 about twice representation 1
    const b3 = cube('', ORANGE, [1.6, H(r3), 1.4], x + 1.2, H(r3) / 2, 0, 1.5);
    tag('表示法 3：' + r3, 'idx', x + 1.2, H(r3) + 0.4, 0);
    glow(b1, GREEN);
    say('表示法 3 的空間約是表示法 1 的兩倍', '');
    await step(tok);                                   // 1:23:49 representation 1 does not store exp
    say('表示法 1 的 index 就是指數，不必存 exp', '表示法 3 要同時存係數和指數');
    await step(tok);                                   // 1:24:16 e.g. x^1000 with every term
    say('例：x¹⁰⁰⁰、x⁹⁹⁹ … 每一項都有係數', '這時表示法 3 花兩倍以上');
    await step(tok);                                   // 1:24:35 still good: most are sparse
    glow(b1, null); glow(b3, GREEN);
    say('但多數多項式是 sparse，這方法還是很好用', '高度是 log 尺度');
    return;
  }
  const n = 3, m = 4, X = (i) => -4.5 + i * 1.6;
  const am = [], bm = [];
  const rows = () => {
    tag('A：n = ' + n + ' 個非 0 項', 'ptr', -1, 0.4, -2.6); tag('B：m = ' + m + ' 個非 0 項', 'ptr alt', -1, 0.4, -0.6);
    for (let i = 0; i < n; i++) am.push(cube('', BLUE, [1.3, 0.6, 0.9], X(i) + 3.6, 0.35, -2.6, 2));
    for (let i = 0; i < m; i++) bm.push(cube('', ORANGE, [1.3, 0.6, 0.9], X(i) + 3.6, 0.35, -0.6, 2));
  };
  // A = 3x²⁰ + 2x⁵ + 4, B = x⁴ + 10x³ + 3x² + 1：every round at least one pointer moves
  const scan = async () => {
    const cnt = tag('', 'ptr', 0, 2.4, 1.6);
    let ia = 0, ib = 0, k = 0;
    for (const o of ['a', 'a', 'b', 'b', 'b', 'ab']) {
      k++;
      if (o.includes('a')) { glow(am[ia], GOLD); move(am[ia], am[ia].position.x, 0.35, 1.6); ia++; }
      if (o.includes('b')) { glow(bm[ib], GOLD); move(bm[ib], bm[ib].position.x, 0.35 + (o === 'ab' ? 0.65 : 0), 1.6); ib++; }
      txt(cnt, '第 ' + k + ' 圈：a ' + ia + '/' + n + '，b ' + ib + '/' + m);
      await beat(tok, 380);
    }
  };
  if (focus === 'time2') {
    await step(tok);                                   // 16:56 A has n elements, B has m
    rows();
    say('A 有 n 個 element，B 有 m 個', '');
    await step(tok);                                   // 17:06 scan both once
    say('整個程式要把 n 和 m 都 scan 過一次', '');
    await step(tok);                                   // 17:14 two pointers
    tag('a', 'ptr', X(0) + 3.6, 1.1, -2.6); tag('b', 'ptr alt', X(0) + 3.6, 1.1, -0.6);
    say('A、B 各一個 pointer', '');
    await step(tok);                                   // 17:24 every term gets compared
    await scan();
    say('每一項都要拿來比較', '每圈至少一個 pointer 前進');
    await step(tok);                                   // 17:39 O(n + m)
    say('complexity = O(n + m)', '<span class="ok">O(n + m)</span>');
    await step(tok);                                   // 17:46 n, m: non-zero terms
    say('n、m 是「非 0」的項數', 'non-zero terms');
    await step(tok);                                   // 18:01 zero terms are not in termArray
    say('係數 0 的項根本不在 termArray 裡', '例：2x¹⁰⁰⁰ + 1 的 x⁹⁹⁹ 不會出現');
    await step(tok);                                   // 18:28 like representation 1, different details
    say('跟表示法 1 的加法概念很像', '但表示法不同，程式細節就不同');
    return;
  }
  await step(tok);                                     // 1:20:18 different representations, different details
  tag('表示法 1：coef[e]', 'ptr', -3.4, 4.6, 0); tag('表示法 3：termArray + free', 'ptr alt', 2.6, 4.6, 0);
  say('不同的表示法，實作細節不一樣', '例：結果要放在 termArray 裡');
  await step(tok);                                     // 1:20:44 the method is the same
  tag('while → 比大小 → 三個 case（>、=、<）', 'note', 0, 3.8, 0);
  say('但加法的方法都一樣', 'while、比大小、三個 case');
  await step(tok);                                     // 1:21:09 the algorithm is identical
  say('方法就是演算法：一模一樣', '表示法只改變指令的寫法');
  await step(tok);                                     // 1:21:29 complexity
  rows();
  say('再看 complexity', 'A 有 n 個、B 有 m 個非 0 項');
  await step(tok);                                     // 1:21:40 O(n + m)
  await scan();
  say('時間是 O(n + m)', '<span class="ok">O(n + m)</span>');
  await step(tok);                                     // 1:21:58 n, m are the non-zero counts
  say('n、m 是 A、B 的非 0 項數', '');
  await step(tok);                                     // 1:22:11 both must be scanned
  say('n 個和 m 個都要 scan 過一次', '');
}
FRAG.push(['arrpeng12-poly-cost', '多項式加法的時間與空間', scPolyCost]);

// ── free 走到 MaxTerms：回收不用的多項式空間（像記憶體管理、磁碟重組） ──
async function scReuse(tok) {
  fresh([0, 7, 12.5], [0, 1.2, 0.5]);
  const N = 10, X = (i) => -5.4 + i * 1.2;
  const owner = ['A', 'A', 'C', 'C', 'B', 'B', 'B', 'B', 'D', 'D'], col = { A: BLUE, B: ORANGE, C: GREEN, D: PURPLE };
  let cs, fr, e;
  await step(tok);                                     // 19:04 free has gone past MaxTerms
  for (let i = 0; i < N; i++) tag(String(i), 'idx', X(i), 0, 1.0);
  tag('MaxTerms = ' + N, 'ptr', 5.6, 1.8, 0);
  cs = owner.map((o, i) => cube(o, col[o], [1.0, 0.7, 1.0], X(i), 0.4, 0, 1.5));
  fr = tag('free = 10', 'ptr alt', 5.4, 1.2, -1.2);
  say('問題：free 已經超過 MaxTerms 怎麼辦？', 'global array 滿了');
  await step(tok);                                     // 19:26 yet another polynomial
  e = cube('E', PINK, [1.0, 0.7, 1.0], 6.2, 3.2, 0);
  say('又來一個多項式 E', '<span class="no">free ≥ MaxTerms：放不下</span>');
  await step(tok);                                     // 19:38 laziest: just say it is full
  say('最笨：送一個「滿了」的訊息', '使用者會覺得很不滿');
  await step(tok);                                     // 20:09 better: reuse old positions
  say('比較好：用過的多項式位置可以回收', '');
  await step(tok);                                     // 20:28 A and B are done after the add
  for (let i = 0; i < N; i++) if (owner[i] === 'A' || owner[i] === 'B') fly(cs[i]);
  await beat(tok, 600);
  tiles(2, X(0), 1.2, 0.05, 0, 1.0, 1.0, '#f6efe2'); tiles(4, X(4), 1.2, 0.05, 0, 1.0, 1.0, '#f6efe2');
  say('A、B 加完就不用了 → 回收它們的位置', '');
  await step(tok);                                     // 21:21 can a single free pointer do it?
  say('期中可能考：光靠一個 free 指標能回收嗎？', 'free 還停在最後面');
  await step(tok);                                     // 21:47 holes may be in the middle
  const h = ghostBox(GOLD, 4.8, 0.8, 1.2); h.position.set(X(4) + 1.8, 0.4, 0);
  say('空出來的不一定在前面，也可能在中間', '');
  await step(tok);                                     // 22:00 where to write it? destructor
  kill(h);
  tag('~Polynomial()', 'ptr', -1.2, 2.6, 0);
  say('回收寫在哪？destructor', '');
  await step(tok);                                     // 22:26 give the space back to termArray
  say('destructor：告訴系統這個多項式不用了', '把空間交還給 termArray');
  await step(tok);                                     // 23:18 how should NewTerm change?
  say('有些格空、有些被佔用：NewTerm 要怎麼改寫？', '不一定每次都放在 free');
  await step(tok);                                     // 24:12 like OS memory management
  say('作業系統的 memory management 就是這種問題', '程式結束就把 memory release 出來');
  await step(tok);                                     // 24:51 like disk defragmentation
  move(cs[2], X(0), 0.4); move(cs[3], X(1), 0.4); move(cs[8], X(2), 0.4); move(cs[9], X(3), 0.4);
  await beat(tok, 900);
  fr.position.set(X(4), 1.2, -1.2); txt(fr, 'free = 4');
  say('像磁碟重組：把有用的資料 shift、集中', '補充：C、D 的 start、finish 也要跟著改');
  await step(tok);                                     // 25:25 a hint: then NewTerm is easy
  move(e, X(4), 0.4);
  say('提示：destructor 裡做點事，NewTerm 就好做了', '補充：也可以用 free list 記住每個空洞');
}
FRAG.push(['arrpeng12-reuse', '回收 termArray 的空間', scReuse]);

// ── Sparse matrix：6 × 6、36 格只有 8 個非 0 ──
const SM = [[0, 0, 15], [0, 3, 22], [0, 5, -15], [1, 1, 11], [1, 2, 3], [2, 3, -6], [4, 0, 91], [5, 2, 28]];
function smGrid(cx, cz, s, h, zeroH = 0.12) {
  const ms = {}, zeros = {};
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const x = cx + (c - 2.5) * s, z = cz + (r - 2.5) * s;
    const hit = SM.find((t) => t[0] === r && t[1] === c);
    if (hit) ms[r + ',' + c] = cube(String(hit[2]), colorFor(Math.abs(hit[2])), [s * 0.85, h, s * 0.85], x, h / 2, z, 0);
    else zeros[r + ',' + c] = cube('0', '#efe6d6', [s * 0.85, zeroH, s * 0.85], x, zeroH / 2, z);
  }
  // the zero tiles, kept out of Object.values(ms): a transpose swaps them too
  Object.defineProperty(ms, 'zeros', { value: zeros });
  return ms;
}
async function scSparse2d(tok) {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.3]);
  let ms;
  await step(tok);                                     // 33:55 matrix operations
  tag('矩陣運算：加、減、乘、轉換', 'ptr', 0, 0.3, -5.0);
  say('第二個問題：matrix（矩陣）', '運算有加、減、乘，也有轉換');
  await step(tok);                                     // 34:49 first: how to represent it?
  say('要寫程式做矩陣運算，先想：矩陣怎麼表示？', '');
  await step(tok);                                     // 35:18 an n x m two-dimensional array
  for (let i = 0; i < 6; i++) { tag('row ' + i, 'idx', -4.8, 0, (i - 2.5) * 1.3); tag('col ' + i, 'idx', (i - 2.5) * 1.3, 0, -4.4); }
  ms = smGrid(0, 0, 1.3, 0.7);
  say('最直接：n × m 的矩陣，宣告二維陣列', 'a[n][m]');
  await step(tok);                                     // 35:36 sparse: many zeros
  say('Sparse matrix：很多 element 是 0', '');
  await step(tok);                                     // 35:46 6 x 6 = 36 elements
  say('例：6 × 6 的矩陣', '共 36 個 element');
  await step(tok);                                     // 36:00 mostly zero: wasteful
  Object.values(ms).forEach((m) => glow(m, GOLD));
  say('大部分是 0，只有 8 個不是', '<span class="no">二維陣列存很浪費空間</span>');
  await step(tok);                                     // 36:16 can we store it more compactly?
  say('能不能想出更省空間的方式存 sparse matrix？', '');
}
FRAG.push(['arrpeng12-sparse-2d', 'Sparse matrix：大部分是 0', scSparse2d]);

// ── SparseMatrix ADT：Transpose、Add、Multiply ──
async function scSparseAdt(tok) {
  fresh([0, 8.5, 9.5], [0, 0.4, 0.3]);
  const cd = code(['class SparseMatrix {', '  SparseMatrix(int r, int c);', '  SparseMatrix Transpose();', '  SparseMatrix Add(SparseMatrix b);', '  SparseMatrix Multiply(SparseMatrix b);', '};'], 0, 5.6, 0.5, -4.2);
  let ms;
  await step(tok);                                     // 36:57 class SparseMatrix as an ADT
  cd.hl(0);
  say('class SparseMatrix：可以想成一個 ADT', '包含 row、column 和 value');
  await step(tok);                                     // 37:06 constructor: rows and columns
  cd.hl(1);
  ms = smGrid(0, 0.4, 1.2, 0.6);
  say('constructor：告訴它有幾個 row、幾個 column', '');
  await step(tok);                                     // 37:19 which elements are non-zero
  Object.values(ms).forEach((m) => glow(m, GOLD));
  say('還要知道哪些 element 不是 0', '');
  await step(tok);                                     // 37:27 Transpose
  Object.values(ms).forEach((m) => glow(m, null));
  cd.hl(2);
  say('Transpose：矩陣的轉置', 'Aᵀ');
  await step(tok);                                     // 37:32 rows become columns
  for (const [r, c] of SM) { if (r === c) continue; const m = ms[r + ',' + c]; glow(m, GOLD); move(m, (r - 2.5) * 1.2, 0.3, 0.4 + (c - 2.5) * 1.2); const zt = ms.zeros[c + ',' + r]; if (zt) move(zt, (c - 2.5) * 1.2, 0.06, 0.4 + (r - 2.5) * 1.2); }
  await beat(tok, 900);
  say('row 變 column、column 變 row', '(i, j, v) → (j, i, v)');
  await step(tok);                                     // 37:40 Add
  cd.hl(3);
  say('還可以做 Add：矩陣相加', '');
  await step(tok);                                     // 37:48 Multiply
  cd.hl(4);
  say('還有 Multiply：矩陣相乘', '');
  await step(tok);                                     // 37:56 focus: representation and transpose
  cd.hl(-1);
  say('等一下的重點：怎麼表示、怎麼做 transpose', '');
}
FRAG.push(['arrpeng12-sparse-adt', 'SparseMatrix ADT 與 transpose', scSparseAdt]);

// ── triples：<row, col, value>，依 row 再依 col 排序；class MatrixTerm ──
function tripleRow(k, t, z, color, x0 = 1.2, dropH = 0) {
  return t.map((v, j) => cube(String(v), j === 2 ? color : '#d8c29b', [1.0, 0.55, 0.75], x0 + j * 1.15, 0.3, z, dropH));
}
async function scTriples(tok) {
  const cls = P().cls;
  fresh([0.5, 9, 9], [0.5, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  if (cls) {
    let cd;
    await step(tok);                                   // 44:12 the naive way: look at declarations
    cd = code(['class MatrixTerm {', '  friend SparseMatrix;', '  int row, col, value;', '};', 'class SparseMatrix {', '  int rows, cols, terms, capacity;', '  MatrixTerm *smArray;', '};'], -3.6, 5.6, 0.5, -1);
    say('先講最 naive 的方法：先看宣告', '');
    await step(tok);                                   // 44:20 MatrixTerm: a term of the matrix
    cd.hl(0);
    say('class MatrixTerm：matrix 裡的一個 term', '名字都不是亂取的');
    await step(tok);                                   // 44:26 friend class SparseMatrix
    cd.hl(1);
    say('它的 friend class 是 SparseMatrix', '');
    await step(tok);                                   // 44:40 row, col, value
    cd.hl(2);
    say('MatrixTerm 有三個 data：row、col、value', '');
    await step(tok);                                   // 44:46 smArray of MatrixTerm
    cd.hl(6);
    await build(tok, 8, 200, (k) => { tag('smArray[' + k + ']', 'idx', 0, 0.3, Z(k)); tripleRow(k, SM[k], Z(k), colorFor(Math.abs(SM[k][2])), 1.6, 1.5); });
    say('SparseMatrix 裡有 smArray', 'sparse matrix 的 array，元素是 MatrixTerm');
    await step(tok);                                   // 44:56 array capacity: max number of terms
    cd.hl(5);
    say('array 有上限：最多能容許多少 term', 'capacity');
    return;
  }
  let g;
  await step(tok);                                     // 38:12 record the non-zero elements' positions
  g = smGrid(-4, 0, 0.62, 0.35);
  say('答案：不用二維陣列', '只記非 0 element 在哪裡');
  await step(tok);                                     // 38:30 15 at (0, 0)
  glow(g['0,0'], GOLD);
  say('位置怎麼表示？看 row 和 column', '15 在第 0 row、第 0 column');
  await step(tok);                                     // 38:53 22 at row 0, column 3
  glow(g['0,0'], null); glow(g['0,3'], GOLD);
  say('22 在第 0 row、第 3 column', '');
  await step(tok);                                     // 39:14 only position and value: <row, col, value>
  glow(g['0,3'], null);
  tag('row', 'idx', 1.2, 0.3, -4.3); tag('col', 'idx', 2.35, 0.3, -4.3); tag('value', 'idx', 3.5, 0.3, -4.3);
  say('只記非 0 element 的位置和值', '<row, col, value>');
  await step(tok);                                     // 39:47 eight non-zero values
  Object.values(g).forEach((m) => glow(m, GOLD));
  say('這個例子總共 8 個非 0 的值', '');
  await step(tok);                                     // 40:05 sort by row, then by column
  Object.values(g).forEach((m) => glow(m, null));
  say('依 row 排序；row 相同再依 column 由左到右', '');
  await step(tok);                                     // 40:55 a[0] = (0, 0, 15)
  tag('a[0]', 'idx', 0, 0.3, Z(0)); tripleRow(0, SM[0], Z(0), colorFor(15), 1.2, 1.5);
  glow(g['0,0'], GOLD);
  say('存成 a[0] … a[7]', 'a[0] = (0, 0, 15)');
  await step(tok);                                     // 41:08 a[1] = (0, 3, 22)
  glow(g['0,0'], null); glow(g['0,3'], GOLD);
  tag('a[1]', 'idx', 0, 0.3, Z(1)); tripleRow(1, SM[1], Z(1), colorFor(22), 1.2, 1.5);
  say('a[1] = (0, 3, 22)', '');
  await step(tok);                                     // 41:20 a[2] = (0, 5, -15), then row 1
  glow(g['0,3'], null);
  await build(tok, 6, 300, (q) => { const k = q + 2; tag('a[' + k + ']', 'idx', 0, 0.3, Z(k)); tripleRow(k, SM[k], Z(k), colorFor(Math.abs(SM[k][2])), 1.2, 1.5); });
  say('a[2] = (0, 5, −15)：row 0 放完才放 row 1', '依 row、再依 column');
}
FRAG.push(['arrpeng12-triples', '用 <row, col, value> 存 sparse matrix', scTriples]);

// ── transpose 的目標：(0,3,22) → (3,0,22)，結果仍要 row-major 排好 ──
async function scTransposeGoal(tok) {
  fresh([0, 9, 9.5], [0, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  const B = SM.map(([r, c, v]) => [c, r, v]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let ra, one, rb = [];
  await step(tok);                                     // 42:15 one 1-D array of (row, col, value)
  tag('A', 'ptr', -4.6, 0.3, -4.3);
  ra = SM.map((t, k) => { tag(String(k), 'idx', -6.4, 0.3, Z(k)); return tripleRow(k, t, Z(k), colorFor(Math.abs(t[2])), -5.6); });
  say('只用一個一維 array，每格存 row、col、value', '先依 row，再依 column');
  await step(tok);                                     // 42:49 e.g. (0, 3, 22)
  ra[1].forEach((m) => glow(m, GOLD));
  say('transpose 的目的：例 (0, 3, 22)', '第 0 row、第 3 column，值 22');
  await step(tok);                                     // 42:59 becomes (3, 0, 22)
  one = tripleRow(0, [3, 0, 22], -1.0, colorFor(22), 1.2, 2);
  say('transpose 後：第 3 row、第 0 column', '(3, 0, 22)');
  await step(tok);                                     // 43:22 A transposed into B
  one.forEach((m) => fly(m)); ra[1].forEach((m) => glow(m, null));
  tag('B = Aᵀ', 'ptr alt', 2.4, 0.3, -4.3);
  say('從 A 轉成 B', '');
  await step(tok);                                     // 43:31 B must follow the same rule
  await build(tok, 8, 220, (k) => { tag(String(k), 'idx', 0.4, 0.3, Z(k)); rb.push(tripleRow(k, B[k], Z(k), colorFor(Math.abs(B[k][2])), 1.2, 1.5)); });
  say('B 還是要符合同一個規則', 'row 0 完了才是 row 1、row 2…');
  await step(tok);                                     // 43:47 same row: by column
  [0, 1].forEach((k) => rb[k].forEach((m) => glow(m, GOLD)));
  say('同一個 row，再依 column 排', 'B[0] = (0, 0, 15)、B[1] = (0, 4, 91)');
}
FRAG.push(['arrpeng12-transpose-goal', 'Transpose 後仍要排好序', scTransposeGoal]);

// ── 最笨的 transpose：照 A 的順序換 row/col 再放，放錯位置就要往上搬 ──
async function scNaiveTranspose(tok) {
  fresh([0, 9, 9.5], [0, 0.2, 0.3]);
  const Z = (k) => -3.3 + k * 0.95;
  tag('A', 'ptr', -4.6, 0.3, -4.3); tag('B（一筆一筆放）', 'ptr alt', 2.4, 0.3, -4.3);
  const ra = SM.map((t, k) => tripleRow(k, t, Z(k), colorFor(Math.abs(t[2])), -5.6));
  const b = []; // [triple, meshes]
  let moves = 0;
  const cnt = tag('搬了 0 次', 'ptr alt', 2.4, 0.3, 4.6);
  // transpose A[k]: put it at the end, then (if needed) shift it up to its place
  const put = (k) => {
    const t = [SM[k][1], SM[k][0], SM[k][2]];
    ra.forEach((r, q) => r.forEach((m) => glow(m, q === k ? GOLD : null)));
    let pos = b.length;
    while (pos > 0 && (b[pos - 1][0][0] > t[0] || (b[pos - 1][0][0] === t[0] && b[pos - 1][0][1] > t[1]))) pos--;
    const ms = tripleRow(b.length, t, Z(b.length), colorFor(Math.abs(t[2])), 1.2, 1.5);
    return { t, pos, ms };
  };
  const fix = (p) => {
    for (let j = b.length - 1; j >= p.pos; j--) { b[j][1].forEach((m, q) => move(m, 1.2 + q * 1.15, 0.3, Z(j + 1))); moves++; }
    p.ms.forEach((m, q) => { move(m, 1.2 + q * 1.15, 0.3, Z(p.pos)); glow(m, null); });
    b.splice(p.pos, 0, [p.t, p.ms]); txt(cnt, '搬了 ' + moves + ' 次');
  };
  await step(tok);                                     // 45:20 one line at a time: (0,0,15)
  fix(put(0));
  say('最笨：一行一行來，row 變 column', '(0, 0, 15) → (0, 0, 15)');
  await step(tok);                                     // 45:30 (0,3,22) -> (3,0,22)
  fix(put(1));
  say('(0, 3, 22) → (3, 0, 22)', '第 3 row、第 0 column');
  await step(tok);                                     // 45:40 (0,5,-15) -> (5,0,-15)
  fix(put(2));
  say('(0, 5, −15) → (5, 0, −15)', '');
  await step(tok);                                     // 46:14 the fourth: (1,1,11)
  const p4 = put(3);
  say('第四個 (1, 1, 11) 轉過去還是 (1, 1, 11)', '先放在最後面？');
  await step(tok);                                     // 46:40 it belongs between row 0 and row 3
  p4.ms.forEach((m) => glow(m, RED));
  say('不符合規則：row 1 應該在 (0,0,15) 和 (3,0,22) 之間', '<span class="no">放在最後不對</span>');
  await step(tok);                                     // 47:08 move it up
  fix(p4);
  say('只好把它往上移，後面的往下搬', '');
  await step(tok);                                     // 47:34 (1,2,3) -> (2,1,3) goes before row 3
  const p5 = put(4);
  await beat(tok, 700);
  fix(p5);
  say('(1, 2, 3) → (2, 1, 3)', '要移到 row 3 的前面一格');
  await step(tok);                                     // 48:03 the computer must be told the right place
  for (let k = 5; k < 8; k++) { const p = put(k); await beat(tok, 500); fix(p); await beat(tok, 300); }
  say('transpose 很簡單，但電腦很笨', '每一項都要放到它該放的位置');
  await step(tok);                                     // 48:19 adjusting very often
  ra.forEach((r) => r.forEach((m) => glow(m, null)));
  say('每轉一個就要調整位置', '共搬了 ' + moves + ' 次：<span class="no">調整非常頻繁</span>');
  await step(tok);                                     // 48:46 a smarter way next time
  say('有沒有更聰明的調整方式？下次講', '補充：依 column 掃 A → O(cols·terms)；FastTranspose → O(cols + terms)');
}
FRAG.push(['arrpeng12-naive-transpose', '最笨的 transpose：放錯就要搬', scNaiveTranspose]);
  }

  // ═══ arrpeng34.js ═══
  {
// ─── cgaPEsMJkSc（彭文志 Lec05 Arrays 3/4）＋ 5HBMYNYYGZU（Lec06 Arrays 4/4）───
// Sparse matrix（三元組、transpose、fast transpose）、row/column major、字串、暴力比對、KMP；
// 以及 C++ template、Stack / Queue 的 ADT 與陣列實作。
// Cued scenes: every `await step(tok)` waits for the sentence it shows; motion between steps is short.
const step = (tok) => ctx.step(tok);
const prm = () => (ctx.params || {});
const SA = [[0, 0, 15], [0, 3, 22], [0, 5, -15], [1, 1, 11], [1, 2, 3], [2, 3, -6], [4, 0, 91], [5, 2, 28]];
const SB = [[0, 0, 15], [0, 4, 91], [1, 1, 11], [2, 1, 3], [2, 5, 28], [3, 0, 22], [3, 2, -6], [5, 0, -15]];
const TRC = ['#4b9ee2', '#9b7ef4', '#2fc092'];
const RZ = (i) => -3.3 + i * 0.95;
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
async function build(tok, n, ms, fn) { for (let i = 0; i < n; i++) { fn(i); await beat(tok, ms); } }
const KP = 'ababaca', KF = [0, 0, 0, 1, 2, 3, 0, 1]; // 1-based：KF[q] = f(q)
const KT = 'bacbabababacaab';
const RED_T = '#e55a9b', HEAD_T = '#c08a1f', P_C = '#dd8238';

// ── 1. 三元組表示 ──
FRAG.push(['arrpeng34-triple', 'Sparse matrix 的三元組表示', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  const M = {}; SA.forEach(([r, c, v]) => { M[r + ',' + c] = v; });
  const gx = (c) => -6 + c * 0.75, gz = (r) => -2.2 + r * 0.75;
  const nz = {}, zs = [];
  await step(tok);                                     // 0:20 2-D array spends space on zeros
  for (let r = 0; r < 6; r++) {
    tag('r' + r, 'idx', -6.75, 0.1, gz(r));
    for (let c = 0; c < 6; c++) {
      if (r === 0) tag('c' + c, 'idx', gx(c), 0.1, gz(-1));
      const v = M[r + ',' + c];
      if (v !== undefined) nz[r + ',' + c] = cube(v, '#2fc092', [0.6, 0.35, 0.6], gx(c), 0.18, gz(r));
      else zs.push(cube('0', GRAY, [0.6, 0.08, 0.6], gx(c), 0.04, gz(r)));
    }
  }
  say('二維陣列存 sparse matrix', '36 格裡有 28 格是 0：花很多空間存 0');
  await step(tok);                                     // 0:38 store only the non-zero ones
  Object.values(nz).forEach((m) => glow(m, GOLD));
  say('改成只存非零（nonzero）的項', '');
  await step(tok);                                     // 0:53 one-dimensional array, two pieces of info
  Object.values(nz).forEach((m) => glow(m, null));
  head(3.2, 'a', 8);
  say('用一個 one dimension array', '每一格要存兩種資訊');
  await step(tok);                                     // 1:00 the position
  tag('位置', 'ptr', 2.75, 0.2, RZ(-2));
  say('第一種資訊：位置', '用 (row, col) 表示');
  await step(tok);                                     // 1:08 the value
  tag('值', 'ptr alt', 4.15, 0.2, RZ(-2));
  say('第二種資訊：它的值 value', '');
  await step(tok);                                     // 1:21 8 non-zeros, 8 cells
  await build(tok, 8, 260, (i) => { const [r, c] = SA[i]; Object.values(nz).forEach((m) => glow(m, null)); glow(nz[r + ',' + c], GOLD); trip(SA[i], 3.2, RZ(i), 3); });
  Object.values(nz).forEach((m) => glow(m, null));
  say('6×6 只有 8 個非零項 → 只要 8 格', 'a[0] = (0, 0, 15)、a[1] = (0, 3, 22)…');
  await step(tok);                                     // 1:35 rule: by row first
  say('存放規則：先依 row 由小到大排', '');
  await step(tok);                                     // 1:52 same row: by column
  [0, 3, 5].forEach((c) => glow(nz['0,' + c], GOLD));
  say('row 相同，再依 column 排', 'row 0 的三項：col 0 → 3 → 5');
}]);

// ── 2. 轉置後位置會變：A[1] → B[5] ──
FRAG.push(['arrpeng34-transpose-result', 'Transpose 之後 index 會變', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  let A, B, ar;
  await step(tok);                                     // 2:17 transpose: row <-> column
  head(-3.6, 'A', 8);
  A = SA.map((t, i) => trip(t, -3.6, RZ(i)));
  say('Transpose：row 變 column、column 變 row', '(row, col, value) → (col, row, value)');
  await step(tok);                                     // 2:33 table B is the transposed matrix
  head(3.6, 'B', 8);
  B = [];
  await build(tok, 8, 180, (i) => B.push(trip(SB[i], 3.6, RZ(i), 3)));
  say('B 是 transpose 過去以後的表', '一樣是 8 格');
  await step(tok);                                     // 2:41 A[1] = (0, 3, 22)
  glowT(A[1], GOLD);
  say('看 A[1]：第 0 row、第 3 column，值 22', 'A[1] = (0, 3, 22)');
  await step(tok);                                     // 3:00 goes to row 3, col 0: B[5]
  glowT(B[5], GOLD);
  ar = arrow(V3(-2.1, 0.45, RZ(1)), V3(2.0, 0.45, RZ(5)), 0xc08a1f);
  say('轉過去在第 3 row、第 0 column', '它的位置是 B[5]，不是 B[1]');
  await step(tok);                                     // 3:37 B must stay sorted by row
  say('為什麼？B 也要符合「先依 row 排序」', '');
  await step(tok);                                     // 3:47 rows 0, 1, 2 come before it
  [0, 1, 2, 3, 4].forEach((k) => glowT(B[k], GREEN));
  say('row 0、1、2 的項都要排在它前面', 'B[0] … B[4] 的 row 都 < 3');
  await step(tok);                                     // 4:03 the index changes: A1 -> B5
  [0, 1, 2, 3, 4].forEach((k) => glowT(B[k], null));
  say('所以 transpose 會牽涉到 index 改變', 'A1 → B5');
}]);

// ── 3. 最笨的方法：一項一項轉，插到該在的位置（要搬資料）──
FRAG.push(['arrpeng34-naive-move', '最笨的轉置：一項一項插入', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.2]);
  head(-3.6, 'A', 8); head(3.6, 'B', 8);
  const A = SA.map((t, i) => trip(t, -3.6, RZ(i)));
  const cnt = tag('搬移 0 次', 'ptr alt', 3.6, 0.2, 4.4);
  const list = []; let moves = 0;
  const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
  const put = (i) => { const [r, c, v] = SA[i]; const t = [c, r, v]; A.forEach((g, k) => glowT(g, k === i ? GOLD : null)); const g = trip(t, 3.6, RZ(list.length), 3); g.userData.t = t; return g; };
  const settle = (g) => {
    let pos = list.findIndex((h) => cmp(h.userData.t, g.userData.t) > 0); if (pos < 0) pos = list.length;
    for (let k = list.length - 1; k >= pos; k--) { move(list[k], 3.6, 0.2, RZ(k + 1)); moves++; }
    move(g, 3.6, 0.2, RZ(pos)); glowT(g, null); list.splice(pos, 0, g); txt(cnt, '搬移 ' + moves + ' 次');
  };
  await step(tok);                                     // 4:21 one by one: (0,0,15)
  settle(put(0));
  say('最笨：照原本順序一個一個轉', '(0, 0, 15) → (0, 0, 15)');
  await step(tok);                                     // 4:27 (0,3,22) -> (3,0,22)
  settle(put(1));
  say('(0, 3, 22) → (3, 0, 22)', '');
  await step(tok);                                     // 4:36 (0,5,-15) -> (5,0,-15)
  settle(put(2));
  say('(0, 5, −15) → (5, 0, −15)', '');
  await step(tok);                                     // 4:45 they sit in B0, B1, B2
  list.forEach((g) => glowT(g, GREEN));
  say('前三項分別放在 B0、B1、B2', '');
  await step(tok);                                     // 4:54 (1,1,11)
  list.forEach((g) => glowT(g, null));
  const g4 = put(3);
  say('第四個 (1, 1, 11)，轉過去還是 (1, 1, 11)', '');
  await step(tok);                                     // 5:12 it belongs between 0 and 3
  glowT(g4, RED);
  say('它是 row 1：應該在 (0,0,15) 和 (3,0,22) 之間', '<span class="no">放在最後不對</span>');
  await step(tok);                                     // 5:22 move it up
  settle(g4);
  say('把它往上移，後面的往下搬', '擺到該擺的位置');
  await step(tok);                                     // 5:34 lots of data movement
  for (let i = 4; i < 8; i++) { const g = put(i); await beat(tok, 350); settle(g); await beat(tok, 250); }
  A.forEach((g) => glowT(g, null));
  say('牽涉到大量資料移動 → 最笨的方法', '共搬移 ' + moves + ' 次');
}]);

// ── 4. 課本的簡單 transpose：for c × for i ──
FRAG.push(['arrpeng34-slow-transpose', '簡單 transpose：兩層迴圈', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.6, 0]);
  head(-4.6, 'a', 8); head(4.6, 'b', 8);
  const A = SA.map((t, i) => trip(t, -4.6, RZ(i)));
  const cd = code(['if (terms > 0) { currentb = 0;', 'for (c = 0; c < cols; c++)', '  for (i = 0; i < terms; i++)', '    if (a[i].col == c) {', '      b[currentb].row = c;', '      b[currentb].col = a[i].row;', '      b[currentb].value = a[i].value;', '      currentb++; }'], 0, 5.6, 0.5, -3.8);
  const cur = ghostBox('#c08a1f', 3.0, 0.7, 0.9); cur.visible = false;
  let cl, cb = 0, cbl;
  const scan = async (c, ms) => { cur.visible = true; for (let i = 0; i < 8; i++) { cur.position.set(-4.6, 0.25, RZ(i)); if (SA[i][1] === c) glowT(A[i], GOLD); await beat(tok, ms); } cur.visible = false; };
  const copy = (c) => { for (let i = 0; i < 8; i++) if (SA[i][1] === c) { trip([c, SA[i][0], SA[i][2]], 4.6, RZ(cb), 3); cb++; } };
  await step(tok);                                     // 5:53 rows, cols, terms
  tag('rows = 6、cols = 6、terms = 8', 'ptr', 0, 0.2, 3.6);
  say('rows、cols 是矩陣大小', 'terms：非零項的個數');
  await step(tok);                                     // 6:08 if (terms > 0)
  cd.hl(0);
  say('if (terms > 0)：有非零項才做', '');
  await step(tok);                                     // 6:25 outer loop over columns
  cd.hl(1);
  cl = tag('c = 0', 'ptr', 0, 0.2, 2.6);
  say('外圈以 column 當主要 index', '轉過去以後 column 就變成 row');
  await step(tok);                                     // 6:58 c = 0 becomes row 0
  say('c = 0：要找的是轉過去的第 0 row', '');
  await step(tok);                                     // 7:08 inner loop
  cd.hl(2);
  say('裡面又一個 for：i 從 0 到 terms − 1', '');
  await step(tok);                                     // 7:24 check every non-zero element
  await scan(0, 200);
  say('把所有非零 element 都檢查一次', '把 column 是 0 的抓出來');
  await step(tok);                                     // 7:48 if a[i].col == c
  cd.hl(3);
  say('if (a[i].col == c)：有符合的才處理', 'a[0]、a[6] 的 col 是 0');
  await step(tok);                                     // 7:58 three assignments
  cd.hl(4);
  copy(0);
  say('三個 assignment：row、col 對調，value 照抄', 'b[0] = (0, 0, 15)、b[1] = (0, 4, 91)');
  await step(tok);                                     // 8:26 currentb: where b gets the next one
  A.forEach((g) => glowT(g, null));
  cbl = tag('currentb', 'ptr alt', 6.9, 0.2, RZ(0));
  say('currentb：b 下一個要放的位置', '一開始是 0');
  await step(tok);                                     // 8:43 add one per element
  cd.hl(7);
  cbl.position.set(6.9, 0.2, RZ(cb)); txt(cbl, 'currentb = ' + cb);
  say('每放一個 element，currentb + 1', 'currentb = ' + cb);
  await step(tok);                                     // 9:02 two for loops do the transpose
  cd.hl(1);
  for (let c = 1; c < 6; c++) { txt(cl, 'c = ' + c); copy(c); await beat(tok, 380); }
  cbl.position.set(6.9, 0.2, RZ(7)); txt(cbl, 'currentb = 8');
  say('外圈對 column、內圈對每個 term 檢查', '就做完 transpose，b 已照 row 排好');
}]);

// ── 5. 簡單 transpose 的代價 ──
FRAG.push(['arrpeng34-slow-cost', '簡單 transpose 的複雜度', async (tok) => {
  fresh([0, 10, 10], [0, 0.8, 0]);
  const plate = [];
  await step(tok);                                     // 9:43 O(terms * cols)
  tag('sparse：cols × terms', 'ptr', -4.8, 0.2, 2.4);
  await build(tok, 6, 220, (c) => { for (let i = 0; i < 8; i++) plate.push(cube('', c % 2 ? '#4b9ee2' : '#31aab0', [0.36, 0.2, 0.36], -6.2 + i * 0.45, 0.1, -1.4 + c * 0.45, 1.5)); });
  say('外圈 cols 次 × 內圈 terms 次', 'O(terms · cols)：6 × 8 = 48 次檢查');
  await step(tok);                                     // 9:51 drawback: efficiency
  say('缺點：效率比較差', '');
  await step(tok);                                     // 10:10 converted ones are checked again
  for (let i = 0; i < 8; i++) glow(plate[8 + i], GOLD);
  say('已經轉好的 element，下一輪還要再被檢查', '內圈每次都完整跑 terms 次 → 浪費');
  await step(tok);                                     // 11:08 2-D array transpose: cols x rows
  for (let i = 0; i < 8; i++) glow(plate[8 + i], null);
  tag('二維陣列直接轉：rows × cols', 'ptr', -0.4, 0.2, 2.4);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', '#9b7ef4', [0.32, 0.2, 0.32], -1.5 + c * 0.4, 0.1, -1.4 + r * 0.4, 1.5);
  say('用二維陣列做 transpose：O(cols · rows)', '6 × 6 = 36');
  await step(tok);                                     // 11:18 if the matrix is not sparse
  tag('不 sparse', 'ptr alt', 3.6, 0.2, 2.4);
  say('如果矩陣不是 sparse 呢？', '');
  await step(tok);                                     // 11:26 terms = cols x rows
  say('非零項的個數 terms = cols × rows', '');
  await step(tok);                                     // 11:29 O(cols^2 * rows)
  await build(tok, 6, 300, (h) => { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) cube('', h % 2 ? '#dd8238' : '#e55a9b', [0.3, 0.3, 0.3], 2.6 + c * 0.38, 0.17 + h * 0.36, -1.4 + r * 0.38); });
  say('O(cols · terms) 變成 O(cols² · rows)', '6 × 6 × 6 = 216，比二維陣列的 36 還慢');
}]);

// ── 6. Fast transpose：rowSize / rowStart（想法 & 程式）──
FRAG.push(['arrpeng34-rowsize', 'Fast transpose：算 rowSize 與 rowStart', async (tok) => {
  const isCode = prm().code;
  fresh([0, 11, 9.5], [0.4, 0.6, 0]);
  const X = (k) => 0.9 + k * 1.0;
  const RS = [3, 2, 1, 0, 1, 1], ST = [0, 3, 5, 6, 6, 7];
  let B = [], sz = [], sc = [];
  const showB = () => { head(-4.6, 'b', 8); B = SB.map((t, i) => trip(t, -4.6, RZ(i))); };
  const frames = () => {
    tag('rowSize', 'ptr', -0.6, 0.2, -1.0); tag('rowStart', 'ptr alt', -0.6, 0.2, 1.8);
    for (let k = 0; k < 6; k++) { tag('[' + k + ']', 'idx', X(k), 0.2, -1.9); cube('', GRAY, [0.75, 0.06, 0.75], X(k), 0.03, -1.0); cube('', GRAY, [0.75, 0.06, 0.75], X(k), 0.03, 1.8); }
  };
  const setSize = (k, v) => { if (sz[k]) kill(sz[k]); sz[k] = cube(v, '#4b9ee2', [0.75, 0.4, 0.75], X(k), 0.2, -1.0, 1.5); return sz[k]; };
  const setStart = (k) => { sc[k] = cube(ST[k], '#dd8238', [0.75, 0.4, 0.75], X(k), 0.2, 1.8, 2); return sc[k]; };
  const colGlow = (c, on) => SB.forEach((t, i) => { if (t[1] === c) glowT(B[i], on ? GOLD : null); });
  if (!isCode) {
    await step(tok);                                   // 11:46 the problem: rescanning every time
    showB();
    say('問題：內外圈每次都要重新 scan 整個 array', '');
    await step(tok);                                   // 12:13 first collect statistics
    say('解法：先做統計', '轉過去以後，第 0、1、2… 個 row 各有幾個 element？');
    await step(tok);                                   // 12:43 reserve the positions
    say('先預留位置', '每個 row 轉過去會佔多少格');
    await step(tok);                                   // 13:08 the textbook transposes B back into A
    tag('B → A', 'ptr alt', -4.6, 0.2, RZ(-2));
    say('課本的例子：把剛剛的 B 再轉回 A', '');
    await step(tok);                                   // 13:35 two more arrays, indices 0..5
    frames();
    say('另外開兩個 array：index 0 … 5', 'rowSize：有幾個；rowStart：從哪裡開始');
    await step(tok);                                   // 14:06 index 0: start 0
    glow(setStart(0), GOLD);
    say('index 0：轉過去的第 0 row 從 0 開始放', 'rowStart[0] = 0');
    await step(tok);                                   // 14:31 row 0 has 3 elements
    glow(sc[0], null); glow(setSize(0, 3), GOLD);
    say('第 0 row 有 3 個 element', 'rowSize[0] = 3');
    await step(tok);                                   // 14:52 index 1 starts at 3
    glow(sz[0], null); glow(setStart(1), GOLD);
    say('index 1：第 1 row 從位置 3 開始', 'rowStart[1] = 3');
    await step(tok);                                   // 15:07 with 2 elements
    glow(sc[1], null); glow(setSize(1, 2), GOLD);
    say('第 1 row 有 2 個 element', 'rowSize[1] = 2');
    await step(tok);                                   // 15:43 where does 3 come from? col == 0
    glow(sz[1], null); colGlow(0, true);
    say('怎麼數？B 裡 column 是 0 的：B0、B5、B7', '3 個 → 轉過去都在第 0 row');
    await step(tok);                                   // 16:47 col == 1: B2, B3
    colGlow(0, false); colGlow(1, true);
    say('column 是 1 的：B2、B3', '2 個 → rowSize[1] = 2');
    await step(tok);                                   // 17:07 start: 0 + 3 = 3
    colGlow(1, false);
    glow(sc[0], GOLD); glow(sz[0], GOLD); glow(sc[1], GREEN);
    say('起始位置：0 + 3 = 3', '第 0 row 佔了 0、1、2');
    await step(tok);                                   // 18:00 3 + 2 = 5, 5 + 1 = 6
    glow(sc[0], null); glow(sz[0], null); glow(sc[1], null);
    setSize(2, 1); setSize(3, 0);
    setStart(2); await beat(tok, 500); setStart(3);
    say('3 + 2 = 5，5 + 1 = 6', 'rowStart[2] = 5、rowStart[3] = 6');
    await step(tok);                                   // 18:14 6 + 0 = 6, 6 + 1 = 7
    setSize(4, 1); setSize(5, 1);
    setStart(4); await beat(tok, 500); setStart(5);
    say('6 + 0 = 6，6 + 1 = 7', 'rowStart[4] = 6、rowStart[5] = 7');
    await step(tok);                                   // 18:17 rule: previous start + previous size
    glow(sc[2], GOLD); glow(sz[2], GOLD); glow(sc[3], GREEN);
    say('規則：前一列的起點 + 前一列的 rowSize', 'rowStart[i] = rowStart[i−1] + rowSize[i−1]');
    await step(tok);                                   // 18:37 one scan gives this table
    glow(sc[2], null); glow(sz[2], null); glow(sc[3], null);
    say('只要先 scan 一次，就得到這張表', '每個 row 從哪裡開始、佔幾格');
    return;
  }
  showB(); frames();
  const cd = code(['if (terms > 0) {', '  for (i = 0; i < cols; i++) rowSize[i] = 0;', '  for (i = 0; i < terms; i++) rowSize[b[i].col]++;', '  rowStart[0] = 0;', '  for (i = 1; i < cols; i++)', '    rowStart[i] = rowStart[i-1] + rowSize[i-1];'], 2.6, 5.4, 0.5, -4.2);
  const rs = [0, 0, 0, 0, 0, 0];
  const cur = ghostBox('#c08a1f', 3.0, 0.7, 0.9); cur.visible = false;
  const count = (i) => { const col = SB[i][1]; cur.visible = true; cur.position.set(-4.6, 0.25, RZ(i)); B.forEach((g, k) => glow(g.userData.cells[1], k === i ? GOLD : null)); rs[col]++; sz.forEach((m) => glow(m, null)); glow(setSize(col, rs[col]), GOLD); };
  await step(tok);                                     // 19:27 if (terms > 0): init the two arrays
  cd.hl(0);
  say('一樣先檢查 if (terms > 0)', '要準備 rowSize、rowStart 兩個 array');
  await step(tok);                                     // 19:53 rowSize[i] = 0
  cd.hl(1);
  for (let k = 0; k < 6; k++) setSize(k, 0);
  say('for：rowSize[i] = 0，先初始化', '');
  await step(tok);                                     // 20:03 for i < terms
  cd.hl(2);
  say('for (i = 0; i < terms; i++)', '把每個非零項掃一次');
  await step(tok);                                     // 20:19 rowSize[b[i].col]++
  say('rowSize[b[i].col]++', '用 column 的值當 index 去累加');
  await step(tok);                                     // 21:07 i = 0: col 0 -> rowSize[0] = 1
  count(0);
  say('第一項 (0, 0, 15)：col 是 0', 'rowSize[0] 變 1');
  await step(tok);                                     // 21:16 i = 1: col 4 -> rowSize[4] = 1
  count(1);
  say('第二項 (0, 4, 91)：col 是 4', 'rowSize[4] 加 1');
  await step(tok);                                     // 21:28 scan everything
  for (let i = 2; i < 8; i++) { count(i); await beat(tok, 300); }
  cur.visible = false; B.forEach((g) => glow(g.userData.cells[1], null)); sz.forEach((m) => glow(m, null));
  say('掃完整個 b，rowSize 就決定了', 'rowSize = [' + rs.join(', ') + ']');
  await step(tok);                                     // 22:15 O(terms)
  say('只掃過 terms 個一次', 'O(terms)');
  await step(tok);                                     // 22:24 rowStart
  cd.hl(3);
  glow(setStart(0), GOLD);
  say('接著算 rowStart：每一列第一個 element 的位置', 'rowStart[0] = 0');
  await step(tok);                                     // 22:45 rowStart[i] = rowStart[i-1] + rowSize[i-1]
  cd.hl(5); glow(sc[0], null);
  say('公式：往前看一個', 'rowStart[i] = rowStart[i−1] + rowSize[i−1]');
  await step(tok);                                     // 23:21 i = 1: 0 + 3 = 3
  glow(sc[0], GOLD); glow(sz[0], GOLD); setStart(1);
  say('i = 1：0 + 3 = 3', '前一列的起點 + 前一列的項數');
  await step(tok);                                     // 23:36 3 + 2 = 5, 5 + 1 = 6 ...
  glow(sc[0], null); glow(sz[0], null);
  for (let k = 2; k < 6; k++) { setStart(k); await beat(tok, 380); }
  say('3 + 2 = 5，5 + 1 = 6，…', 'rowStart = [' + ST.join(', ') + ']');
  await step(tok);                                     // 24:08 this page computes the two arrays
  cd.hl(-1);
  say('這一頁只做一件事', '把 rowSize、rowStart 兩個 array 算出來');
}]);

// ── 7. Fast transpose 第二步：一個迴圈直接放到位 ──
FRAG.push(['arrpeng34-fast-place', 'Fast transpose：照 rowStart 直接放', async (tok) => {
  const only = prm().only;
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
  const pick = (i) => { cur.visible = true; cur.position.set(-4.6, 0.25, RZ(i)); B.forEach((g, k) => glowT(g, k === i ? GOLD : null)); rc.forEach((m, k) => glow(m, k === SB[i][1] ? GOLD : null)); };
  const place = (i) => { const [r, c, v] = SB[i]; const j = rs[c]; const g = trip([c, r, v], 4.6, RZ(j), 3); glowT(g, GREEN); rs[c]++; relabel(rc[c], rs[c]); return g; };
  if (focus) {
    let g;
    await step(tok);                                   // 44:46 why rowStart[...]++ ?
    cd.hl(1);
    say('同學問：最後那行 rowStart[b[i].col]++ 為什麼要 + 1？', '');
    await step(tok);                                   // 45:11 rowStart: first element of each row
    rc.forEach((m) => glow(m, GOLD));
    say('rowStart 記的是：轉過去每個 row 第一個 element 的位置', '');
    await step(tok);                                   // 45:31 B's col == 0: three of them
    rc.forEach((m) => glow(m, null));
    [0, 5, 7].forEach((i) => glowT(B[i], GOLD));
    say('B 裡 column 是 0 的有三個', 'B0、B5、B7');
    await step(tok);                                   // 45:57 all three land in row 0
    say('轉過去以後都會佔用第 0 個 row 的空間', 'a[0]、a[1]、a[2]');
    await step(tok);                                   // 46:26 rowStart[0] = 0
    [5, 7].forEach((i) => glowT(B[i], null));
    glow(rc[0], GOLD);
    say('第一個是 B0，rowStart[0] = 0', '');
    await step(tok);                                   // 46:34 B0 -> A0
    g = place(0);
    say('所以 B0 轉過去就是 A0', 'a[0] = (0, 0, 15)');
    await step(tok);                                   // 46:46 rowStart[0] becomes 1
    glowT(B[0], null); glowT(g, null);
    say('放完後 rowStart[0] 變成 1', '第 0 格已經被佔了');
    await step(tok);                                   // 46:59 scanning B5: col 0 again
    glowT(B[5], GOLD);
    say('掃到 B5，column 也是 0', '這時 rowStart[0] 已經是 1');
    await step(tok);                                   // 47:20 so it goes to A1
    g = place(5);
    say('所以 B5 轉過去放在 A1', 'rowStart[0] → 2');
    await step(tok);                                   // 47:42 rowSize stays, rowStart changes
    glowT(B[5], null); glowT(g, null); glow(rc[0], null);
    say('rowSize 不會改變；rowStart 在迴圈中會改變', '不 ++ 的話，三項都會塞進同一格');
    return;
  }
  await step(tok);                                     // 24:47 now the real transpose
  say('下一頁才真正做 transpose', 'rowStart = [0, 3, 5, 6, 6, 7]');
  await step(tok);                                     // 24:58 a single for loop over terms
  cd.hl(0);
  say('只要一個 for：把非零項掃過一次', 'for (i = 0; i < terms; i++)');
  await step(tok);                                     // 25:21 j = rowStart[b[i].col]
  cd.hl(1);
  say('j = rowStart[b[i].col]', '去查這一項該放哪');
  await step(tok);                                     // 25:44 B0: column 0
  pick(0);
  say('i = 0：B0 = (0, 0, 15)，column 是 0', '');
  await step(tok);                                     // 25:57 rowStart[0] -> j = 0
  say('去 rowStart[0] 拿起始位置', 'j = 0');
  await step(tok);                                     // 26:36 column -> row, row -> column, value
  cd.hl(2);
  let g = place(0);
  say('column 變 row、row 變 column、value 照抄', 'a[0] = (0, 0, 15)');
  await step(tok);                                     // 26:48 rowStart ++
  glowT(g, null);
  say('rowStart[0] 要 ++：0 那格已經被佔了', 'rowStart[0] = 1');
  await step(tok);                                     // 27:08 and so on for every term
  cd.hl(1);
  for (let i = 1; i < 8; i++) { pick(i); await beat(tok, 150); place(i); await beat(tok, 200); }
  cur.visible = false; B.forEach((h) => glowT(h, null)); rc.forEach((m) => glow(m, null));
  say('每一項都查 rowStart、放進去、再 ++', '一次就全部放到位');
  await step(tok);                                     // 27:42 without ++, everything piles into the first cell
  say('沒有 + 1 的話', '<span class="no">同一 row 的 element 會一直塞進第一格</span>');
  await step(tok);                                     // 27:49 O(terms)
  cd.hl(-1);
  say('這個迴圈是 O(terms)', '');
  await step(tok);                                     // 27:59 total O(cols + terms)
  say('加上算 rowSize、rowStart', '總共 O(cols + terms)');
  await step(tok);                                     // 28:11 worst (not sparse): O(rows * cols)
  say('最糟：矩陣不 sparse 時', 'O(rows · cols)');
}]);

// ── 8. 矩陣相乘 ──
FRAG.push(['arrpeng34-matmul', '矩陣相乘 R = A × B', async (tok) => {
  fresh([0, 9, 7.5], [0, 0, 0.2]);
  const a = [], b = [], r = [];
  const calc = async (i, j, ms) => { for (let k = 0; k < 3; k++) { glow(a[i][k], GOLD); glow(b[k][j], GOLD); await beat(tok, ms); glow(a[i][k], null); glow(b[k][j], null); } kill(r[i][j]); r[i][j] = cube('R' + i + j, '#2fc092', [0.75, 0.35, 0.75], 3.2 + j * 0.9, 0.18, -0.45 + i * 0.9, 1.5); };
  await step(tok);                                     // 29:17 A is m x n, B is n x p, result R
  for (let i = 0; i < 2; i++) { a.push([]); for (let k = 0; k < 3; k++) a[i].push(cube('a' + i + k, '#4b9ee2', [0.75, 0.35, 0.75], -5.2 + k * 0.9, 0.18, -0.45 + i * 0.9)); }
  for (let k = 0; k < 3; k++) { b.push([]); for (let j = 0; j < 2; j++) b[k].push(cube('b' + k + j, '#9b7ef4', [0.75, 0.35, 0.75], -0.9 + j * 0.9, 0.18, -0.9 + k * 0.9)); }
  for (let i = 0; i < 2; i++) { r.push([]); for (let j = 0; j < 2; j++) r[i].push(cube('', GRAY, [0.75, 0.1, 0.75], 3.2 + j * 0.9, 0.05, -0.45 + i * 0.9)); }
  tag('A：m × n', 'ptr', -4.3, 0.2, -1.6); tag('B：n × p', 'ptr', -0.45, 0.2, -2.1); tag('R：m × p', 'ptr alt', 3.65, 0.2, -1.6);
  say('A 是 m×n、B 是 n×p，結果叫 R（Result）', '這裡 m = 2、n = 3、p = 2');
  await step(tok);                                     // 29:26 R[i][j] formula
  tag('R[i][j] = Σ a[i][k] · b[k][j]，k = 0 … n−1', 'note', 0, 0.2, 2.4);
  say('R[i][j] 的值怎麼算', 'R[i][j] = Σₖ₌₀ⁿ⁻¹ a[i][k] · b[k][j]');
  await step(tok);                                     // 29:36 one element = one for k loop
  await calc(0, 0, 450);
  say('算一個 element 就是一個 for k 迴圈', 'R[0][0] = a00·b00 + a01·b10 + a02·b20');
  await step(tok);                                     // 29:56 every element of R
  for (const [i, j] of [[0, 1], [1, 0], [1, 1]]) await calc(i, j, 160);
  say('R 裡每一格都要這樣算', '補充：共 m·p 格，每格 n 次 → O(m·n·p)');
  await step(tok);                                     // 30:05 read it in the book
  say('矩陣相乘課本有章節，請回去自己讀', '');
}]);

// ── 9. Row major / Column major ──
FRAG.push(['arrpeng34-rowmajor', 'Row major 與 Column major', async (tok) => {
  fresh([0, 10, 9], [0, 0, 0.3]);
  const LX = (k) => -5.5 + k;
  const one = [], G = [], U1 = 3, U2 = 4;
  await step(tok);                                     // 30:24 a 1-D array
  await build(tok, 12, 90, (k) => one.push(cube('a[' + k + ']', '#31aab0', [0.85, 0.4, 0.85], LX(k), 0.2, -3.3, 1.5)));
  say('Array 是一塊連續的記憶體', '一維 array：開 12 格');
  await step(tok);                                     // 30:31 start address alpha
  for (let k = 0; k < 12; k++) tag('α+' + k, 'idx', LX(k), 0.2, -4.1);
  say('起始位置是 α', '每一格的 address 標在上面');
  await step(tok);                                     // 30:45 a[1] at alpha + 1
  glow(one[1], GOLD);
  say('a[1] 在 α + 1，其他依此類推', 'a[i] 在 α + i');
  await step(tok);                                     // 30:53 how to store a 2-D array?
  one.forEach((m) => fly(m));
  for (let i = 0; i < U1; i++) { G.push([]); for (let j = 0; j < U2; j++) G[i].push(cube(i + ',' + j, colorFor(i * U2 + j), [0.85, 0.4, 0.85], -1.5 + j * 1.0, 0.2, 0.6 + i * 1.0, 2)); }
  tag('a[u1][u2]，u1 = 3、u2 = 4', 'ptr', 0, 0.2, 3.8);
  say('Two dimensional array 要怎麼存？', '記憶體只有一排，要攤平');
  await step(tok);                                     // 30:57 row major: a whole row, then the next
  for (let i = 0; i < U1; i++) { for (let j = 0; j < U2; j++) move(G[i][j], LX(i * U2 + j), 0.2, -3.3); await beat(tok, 600); }
  say('第一種：先存一整個 row，再接下一個 row', '叫 row major');
  await step(tok);                                     // 31:36 each row holds u2 elements
  for (let j = 0; j < U2; j++) glow(G[0][j], GOLD);
  say('每個 row 佔 u2 個 element', 'u2 = 4');
  await step(tok);                                     // 32:11 row i starts after i * u2 elements
  for (let j = 0; j < U2; j++) glow(G[0][j], null);
  glow(G[1][2], GOLD);
  say('第 i 個 row 前面已經有 i · u2 個', '補充：a[1][2] 在 α + 1·4 + 2 = α + 6');
  await step(tok);                                     // 32:36 n-dimensional: a formula (for reference)
  tag('n 維：a[i1][i2]…[in] 也有公式（參考即可）', 'note', 0, 0.2, 4.7);
  say('可以推廣到 n 維 array', '起始位置套公式，參考就好');
  await step(tok);                                     // 32:55 column major
  glow(G[1][2], null);
  // back to the 2-D grid first, so the blocks never slide through each other in the row
  for (let i = 0; i < U1; i++) for (let j = 0; j < U2; j++) move(G[i][j], -1.5 + j * 1.0, 0.2, 0.6 + i * 1.0);
  await beat(tok, 700);
  for (let j = 0; j < U2; j++) { for (let i = 0; i < U1; i++) move(G[i][j], LX(j * U1 + i), 0.2, -3.3); await beat(tok, 500); }
  glow(G[1][2], GOLD);
  say('Column major：先存 column 0，再 column 1、2…', '補充：a[1][2] 變成 α + 2·3 + 1 = α + 7');
  await step(tok);                                     // 33:09 it changes every element's address
  say('row major 和 column major', '會影響每個 element 的 memory address');
}]);

// ── 10. 字串 = char 陣列；中文斷詞 ──
FRAG.push(['arrpeng34-string', '字串：char 陣列', async (tok) => {
  fresh([0, 9, 9], [0, 0, 0.3]);
  const s = [...'hello world', '\\0'];
  const cs = [];
  let zh;
  await step(tok);                                     // 33:29 hello world as a char array
  await build(tok, s.length, 90, (k) => { tag('[' + k + ']', 'idx', -5.5 + k, 0.2, -2.5); cs.push(cube(s[k] === ' ' ? '␠' : s[k], s[k] === '\\0' ? '#dd8238' : '#4b9ee2', [0.8, 0.4, 0.8], -5.5 + k, 0.2, -1.7, 2)); });
  say('String 就是字串，例如 hello world', '在 C 裡是一個 char array');
  await step(tok);                                     // 33:37 s[0] = h, s[1] = e
  glow(cs[0], GOLD); glow(cs[1], GOLD);
  say('第 0 格放 h、第 1 格放 e……', '');
  await step(tok);                                     // 33:46 a terminator at the end
  glow(cs[0], null); glow(cs[1], null); glow(cs[11], GOLD);
  say('最後有一個結束符號', '\'\\0\'：字串到這裡結束');
  await step(tok);                                     // 34:05 what about Chinese?
  glow(cs[11], null);
  say('那中文要怎麼存？', '');
  await step(tok);                                     // 34:50 English: words separated by spaces
  glow(cs[5], GOLD);
  say('英文以單字為單位，中間有空白', 'hello ␠ world → 兩個 word');
  await step(tok);                                     // 35:02 Chinese has no spaces
  glow(cs[5], null);
  zh = [...'我是彭文志老師'].map((ch, k) => cube(ch, '#9b7ef4', [0.8, 0.4, 0.8], -3 + k, 0.2, 1.5, 2));
  say('「我是彭文志老師」：沒有空白', '看不出哪幾個字是一個詞');
  await step(tok);                                     // 35:38 word segmentation
  const grp = [[0], [1], [2, 3, 4], [5, 6]]; let x = -4.2;
  grp.forEach((g) => { g.forEach((k) => { move(zh[k], x, 0.2, 1.5); x += 1; }); x += 0.9; });
  say('要靠斷字斷詞：彭文志是一個詞', '我 / 是 / 彭文志 / 老師');
  await step(tok);                                     // 35:58 take Information Retrieval
  tag('資訊檢索（Information Retrieval, IR）', 'note', 0, 0.2, 3.2);
  say('想學斷詞：修「資訊檢索」', 'Information Retrieval（IR）');
}]);

// ── 11. 字串比對問題 ──
FRAG.push(['arrpeng34-match-def', '字串比對問題', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const T = 'ABABABCCA', X = (k) => -3.4 + k * 0.85;
  let tc, pc, pl;
  await step(tok);                                     // 36:17 compare, concatenate, copy
  tag('比較、串接、copy（strcpy）', 'idx', 0, 0.2, -3.9);
  say('字串常做的運算：比較、串接、copy', 'C 裡有 strcpy');
  await step(tok);                                     // 36:31 insert, string matching, print
  tag('insert、string matching、print', 'idx', 0, 0.2, -3.3);
  say('也會 insert、做 string matching、印出來', '等一下要講的是 string matching');
  await step(tok);                                     // 36:51 T: the original text
  T.split('').forEach((ch, k) => tag(String(k), 'idx', X(k), 0.2, -2.0));
  tc = strRow(T, X(0), -1.2, '#4b9ee2', 0.85, 3);
  tag('T', 'ptr', -4.6, 0.2, -1.2);
  say('給兩個字串：T 是原本的文字', 'T = ABABABCCA');
  await step(tok);                                     // 37:09 P: the pattern / query
  pc = strRow('ABABC', X(0), 1.6, '#dd8238', 0.85, 3);
  pl = tag('P', 'ptr alt', -4.6, 0.2, 1.6);
  say('P 是 pattern：像搜尋引擎裡輸入的 query', 'P = ABABC');
  await step(tok);                                     // 37:48 does P occur in T?
  say('問：P 有沒有出現在 T 裡？', '');
  await step(tok);                                     // 38:15 if so, report the start position
  pc.forEach((m, k) => move(m, X(2 + k), 0.23, 0.0)); pl.position.set(-4.6, 0.2, 0.0);
  await beat(tok, 700);
  pc.forEach((m, k) => { glow(m, GREEN); glow(tc[2 + k], GREEN); });
  say('有出現：回報它在 T 裡的起始位置', '這個例子是 index 2');
  await step(tok);                                     // 38:46 otherwise -1
  say('沒找到就回報 −1', '');
}]);

// ── 12. 暴力比對：shift 其實是改 T 的起點 ──
FRAG.push(['arrpeng34-naive-match', '暴力字串比對', async (tok) => {
  const recap = prm().recap;
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const T = 'ABABABCCA', P = 'ABABC', X = (k) => -3.4 + k * 0.85;
  T.split('').forEach((ch, k) => tag(String(k), 'idx', X(k), 0.2, -2.0));
  const tc = strRow(T, X(0), -1.2, '#4b9ee2', 0.85);
  const pc = strRow(P, X(0), 0.2, '#dd8238', 0.85);
  tag('T', 'ptr', -4.6, 0.2, -1.2); tag('P', 'ptr alt', -4.6, 0.2, 0.2);
  const sl = tag('s = 0', 'ptr', X(0), 0.2, -2.8);
  const clear = () => { pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null)); };
  const at = (s) => { clear(); pc.forEach((m, k) => move(m, X(s + k), 0.23, 0.2)); sl.position.set(X(s), 0.2, -2.8); txt(sl, 's = ' + s); };
  // compare P[from..to) against T at shift s; stop at the first mismatch
  const cmp = async (s, from, to, ms) => { for (let k = from; k < to; k++) { const eq = P[k] === T[s + k]; glow(pc[k], eq ? GREEN : RED); glow(tc[s + k], eq ? GREEN : RED); await beat(tok, ms); if (!eq) return false; } return true; };
  if (recap) {
    await step(tok);                                   // 52:00 the dumbest way: compare one by one
    await cmp(0, 0, 5, 250);
    say('最笨的方法：一個一個比對', '比到 C ≠ A：錯了');
    await step(tok);                                   // 52:15 shift the pattern one letter
    at(1);
    say('錯了就把 pattern shift 一個字母', '再從頭比');
    await step(tok);                                   // 52:30 again: shift and compare
    await cmp(1, 0, 5, 250);
    await beat(tok, 300);
    at(2);
    await cmp(2, 0, 5, 200);
    say('又錯就再往後 shift 一個，再比', 's = 2 時全部相同');
    await step(tok);                                   // 52:42 it is the start position in T that changes
    say('說是 shift，其實是改變比對在 T 裡的起始位置', '變數 s 記住從 T 的哪裡開始比');
    return;
  }
  await step(tok);                                     // 39:04 first letters: A = A, then B = B
  await cmp(0, 0, 2, 350);
  say('P 的第一個字母跟 T 的第一個比：一樣', '再比第二個 B：也一樣');
  await step(tok);                                     // 39:13 keep comparing
  await cmp(0, 2, 4, 350);
  say('一樣就繼續往下比', '');
  await step(tok);                                     // 39:25 the last one: C vs A
  await cmp(0, 4, 5, 350);
  say('前面都一樣，最後 C 跟 A 不一樣', '<span class="no">沒有 match</span>');
  await step(tok);                                     // 39:45 shift by one
  at(1);
  say('把字串 shift 一格', 'P 的第一個字母改跟 T 的第二個字母（B）比');
  await step(tok);                                     // 40:22 A vs B: different right away
  await cmp(1, 0, 5, 350);
  say('A 跟 B 第一個就不同', '後面就不用比了');
  await step(tok);                                     // 40:29 shift again
  at(2);
  say('再 shift 一格', '');
  await step(tok);                                     // 40:37 all match
  await cmp(2, 0, 5, 250);
  say('這次全部都對', '');
  await step(tok);                                     // 40:46 it occurs at index 2
  say('ABABC 出現在 T 裡，位置是 index 2', '回報 2');
  await step(tok);                                     // 41:34 who is actually moving?
  say('Shift 到底是誰在移？', '');
  await step(tok);                                     // 41:44 a variable records where in T we start
  clear();
  say('P 根本沒動：用一個變數記「從 T 的哪個位置開始比」', '');
  await step(tok);                                     // 42:25 start at 0, then 1, then 2
  for (const s of [0, 1, 2]) tag('第 ' + (s + 1) + ' 次：s = ' + s, 'note', X(s), 0.2, -3.5 + s * 0.0 - (s % 2) * 0.5);
  say('三次比對的起始位置：T[0]、T[1]、T[2]', 'shift = 改變 T 比對的起始位置');
}]);

// ── 13. KMP：兩個 phase（三段複習用 params.v = a | b | c）──
FRAG.push(['arrpeng34-kmp-phases', 'KMP 的兩個 phase', async (tok) => {
  const v = prm().v || 'a';
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const X = (k) => -5.6 + k * 0.8;
  let pc, fc = [], tc;
  const showP = () => { pc = strRow(KP, X(0), -3.0, P_C, 0.8, 2); tag('P', 'ptr alt', -6.5, 0.2, -3.0); };
  const showF = async (ms) => { tag('fail', 'idx', -6.5, 0.2, -2.1); for (let q = 1; q <= 7; q++) { fc.push(cube(KF[q], '#9b7ef4', [0.64, 0.3, 0.64], X(q - 1), 0.15, -2.1, 1.5)); if (ms) await beat(tok, ms); } };
  const showT = () => { tc = strRow(KT, X(0), 0.6, '#4b9ee2', 0.8, 2); tag('T', 'ptr', -6.5, 0.2, 0.6); };
  const bars = async () => {
    const b1 = cube('', '#e55a9b', [1.2, 1, 1.2], -2.5, 0, 3.0); b1.scale.y = 0.001;
    const b2 = cube('', '#2fc092', [1.2, 1, 1.2], 2.5, 0, 3.0); b2.scale.y = 0.001;
    tag('暴力法 m·n = 7·15 = 105', 'idx', -2.5, 0.2, 4.1); tag('KMP m+n = 7+15 = 22', 'idx', 2.5, 0.2, 4.1);
    await anim(tok, 1000, (t) => { b1.scale.y = 0.001 + 4.2 * t; b1.position.y = b1.scale.y / 2; b2.scale.y = 0.001 + 0.9 * t; b2.position.y = b2.scale.y / 2; });
  };
  // a mismatch picture: P placed at T offset 4, five matched, the sixth fails
  const mismatch = () => {
    pc.forEach((m, k) => move(m, X(4 + k), 0.23, -0.4));
    for (let k = 0; k < 5; k++) { glow(pc[k], GREEN); glow(tc[4 + k], GREEN); }
    glow(pc[5], RED); glow(tc[9], RED);
  };
  if (v === 'a') {
    await step(tok);                                   // 43:09 brute force: O(mn)
    showP(); showT();
    const b1 = cube('', '#e55a9b', [1.2, 1, 1.2], -2.5, 0, 3.0); b1.scale.y = 0.001;
    tag('暴力法 m·n', 'idx', -2.5, 0.2, 4.1);
    await anim(tok, 900, (t) => { b1.scale.y = 0.001 + 4.2 * t; b1.position.y = b1.scale.y / 2; });
    say('暴力比對：P 長 m、T 長 n', '最差 O(m · n)，complexity 蠻高');
    await step(tok);                                   // 43:36 a famous algorithm: KMP
    say('有沒有更快的？很有名的演算法：KMP', '');
    await step(tok);                                   // 43:44 phase 1: build an array
    tag('Phase 1：P 自己跟自己比', 'ptr', -1.8, 0.2, -3.9);
    pc.forEach((m) => glow(m, GOLD));
    say('Phase 1：先建一個 array', '告訴你比對失敗時能怎麼快速移動');
    await step(tok);                                   // 44:04 called the fail array
    pc.forEach((m) => glow(m, null));
    await showF(150);
    say('這個 array 叫 fail array', 'P = ababaca → 0 0 1 2 3 0 1');
    await step(tok);                                   // 44:12 phase 2: matching with it
    tag('Phase 2：用 fail 在 T 上比對', 'ptr alt', -2.6, 0.2, -0.2);
    tc.forEach((m) => glow(m, GOLD));
    say('Phase 2：根據 fail array 去做字串比對', '');
    await step(tok);                                   // 44:28 O(m + n)
    tc.forEach((m) => glow(m, null));
    const b2 = cube('', '#2fc092', [1.2, 1, 1.2], 2.5, 0, 3.0); b2.scale.y = 0.001;
    tag('KMP m+n', 'idx', 2.5, 0.2, 4.1);
    await anim(tok, 900, (t) => { b2.scale.y = 0.001 + 0.9 * t; b2.position.y = b2.scale.y / 2; });
    say('KMP 的 complexity：O(m + n)', '暴力法最差 O(m · n)');
    return;
  }
  if (v === 'b') {
    showP(); await showF(0); showT();
    await step(tok);                                   // 1:20:34 phase 2 moves quickly with the fail function
    mismatch();
    say('Phase 2：透過 fail function 決定怎麼快速移動', '');
    await step(tok);                                   // 1:20:43 P[f(j-1)+1]
    glow(fc[4], GOLD);
    say('不 match 時看前一個的 fail：f(j−1) = 3', '下一個比 P[f(j−1)+1] = P[4]');
    await step(tok);                                   // 1:20:53 two phases
    tag('Phase 1：P 自己跟自己比 → fail', 'ptr', -1.8, 0.2, -3.9); tag('Phase 2：用 fail 比對 T', 'ptr alt', -2.6, 0.2, 1.4);
    say('KMP 分兩個 phase', 'Phase 1 針對 pattern 自己');
    await step(tok);                                   // 1:21:01 O(m + n)
    await bars();
    say('總共 O(m + n)', 'm = pattern 長度，n = T 的長度');
    await step(tok);                                   // 1:21:25 m: fail function; n: matching
    say('m 花在算 pattern 的 fail function', 'n 花在跟 T 做 match');
    await step(tok);                                   // 1:21:37 why does the pattern compare with itself?
    pc.forEach((m) => { glow(m, null); }); tc.forEach((m) => glow(m, null));
    say('為什麼 pattern 要自己跟自己比？', '');
    await step(tok);                                   // 1:22:18 how far back equals the start
    for (let i = 2; i < 5; i++) tint(pc[i], RED_T); for (let i = 0; i < 3; i++) glow(pc[i], GOLD);
    say('要知道每個字元往前看多長，會跟開頭一樣', '例：第 5 個 a 往前看 aba = 開頭 aba');
    await step(tok);                                   // 1:22:47 jump to after the red block
    say('不 match 時就能直接跳到紅色區塊的下一個位置比', '比過的不用再比');
    await step(tok);                                   // 1:23:15 the two key slides
    say('兩張最重要的投影片', 'fail function 怎麼算；失敗時從 P[f(j−1)+1] 比');
    return;
  }
  await step(tok);                                     // 0:00 KMP in a few sentences: P and T
  showP(); showT();
  say('KMP 的精神兩三句話就講完', 'P 是 pattern，T 是要比對的 text');
  await step(tok);                                     // 0:45 a letter does not match
  mismatch();
  say('P 和 T 比對時，某個字不 match', '');
  await step(tok);                                     // 0:51 shift P further
  say('希望 P 能 shift 多一點', '不要每次只移一格');
  await step(tok);                                     // 1:01 two steps
  pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null));
  pc.forEach((m, k) => move(m, X(k), 0.23, -3.0));
  say('怎麼做到？兩個步驟', '');
  await step(tok);                                     // 1:09 phase 1: the pattern against itself
  tag('Phase 1：P 自己跟自己比', 'ptr', -1.8, 0.2, -3.9);
  pc.forEach((m) => glow(m, GOLD));
  say('Phase 1：針對 pattern 自己跟自己比', '不是跟 T 比');
  await step(tok);                                     // 1:23 producing the fail function
  pc.forEach((m) => glow(m, null));
  await showF(120);
  say('產生 fail function', 'f = 0 0 1 2 3 0 1');
  await step(tok);                                     // 1:49 repeated substrings
  for (let i = 0; i < 3; i++) tint(pc[i], HEAD_T); for (let i = 2; i < 5; i++) tint(pc[i], RED_T);
  say('目的：知道 pattern 裡有哪些重複（相同）的 substring', '例：開頭 aba 又出現在 3…5');
  await step(tok);                                     // 2:03 phase 2 uses the fail function
  pc.forEach((m) => tint(m, P_C));
  tag('Phase 2：用 fail 移動', 'ptr alt', -2.6, 0.2, -0.2);
  say('Phase 2：透過 fail function 讓比對快速移動', '');
  await step(tok);                                     // 2:42 mismatch: look at j-1, compare P[f(j-1)+1]
  mismatch(); glow(fc[4], GOLD);
  say('不 match：看 j−1 的 fail', 'f(5) = 3 → 從 P[4] 比');
  await step(tok);                                     // 3:42 summary
  say('Phase 1 造 fail function；Phase 2 用它決定怎麼移', '這就是 KMP');
}]);

// ── 14. KMP 的直覺：比過的資訊拿來跳（示意字串）──
FRAG.push(['arrpeng34-kmp-idea', 'KMP 直覺：對齊比過的區塊', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const P = 'AGCTTAGC', X = (k) => -4.6 + k * 0.75;
  let tc, pc;
  // [T, mismatch position (0-based), length of the repeated block]
  const setup = (T, mis) => {
    lab.clear(); arrows.length = 0;
    T.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.9));
    tc = strRow(T, X(0), -1.1, '#4b9ee2', 0.75);
    pc = strRow(P, X(0), 0.4, P_C, 0.75);
    tag('T', 'ptr', -5.5, 0.2, -1.1); tag('P', 'ptr alt', -5.5, 0.2, 0.4);
    for (let i = 0; i < mis; i++) { glow(tc[i], GREEN); glow(pc[i], GREEN); }
    glow(tc[mis], RED); glow(pc[mis], RED);
  };
  const block = (mis, k) => { for (let i = mis - k; i < mis; i++) { tint(tc[i], RED_T); tint(pc[i], RED_T); } for (let i = 0; i < k; i++) tint(pc[i], HEAD_T); };
  const slide = (s) => { pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null)); pc.forEach((m, i) => move(m, X(s + i), 0.23, 0.4)); };
  await step(tok);                                     // 53:06 KMP builds an array for smarter shifts
  tag('KMP：先做一個 array，幫忙更聰明地 shift', 'note', 0, 0.2, -3.2);
  say('KMP 會先做一個 array', '協助我們更聰明地 shift');
  await step(tok);                                     // 53:17 why one letter at a time?
  say('為什麼比對失敗只能 shift 一格？', '可不可以一次 shift 多格？');
  await step(tok);                                     // 53:57 example 1: the fourth letter fails
  setup('AGCATAGCTTAGC', 3);
  say('例一：前三個一樣，第四個不 match', 'T[4] = A ≠ P[4] = T');
  await step(tok);                                     // 54:16 KMP shifts P several places
  slide(3);
  say('KMP 直接把 P shift 好幾格', '中間那些位置不可能 match');
  await step(tok);                                     // 54:44 compare T[4] with P[1]
  glow(tc[3], GOLD); glow(pc[0], GOLD);
  say('直接拿 T 的第四個跟 P 的第一個比', '一次 shift 3 格，不是 1 格');
  await step(tok);                                     // 55:10 example 2: the seventh letter fails
  setup('AGCTTATAGCTT', 6);
  say('例二：前六個一樣，第七個不同', '');
  await step(tok);                                     // 55:34 the A before it is also P's first letter
  block(6, 1);
  say('失敗點前面那個 A（紅色）', '也出現在 P 的第一個位置');
  await step(tok);                                     // 56:25 align the red blocks
  slide(5);
  say('把 P 的紅色區塊跟 T 的紅色區塊對齊', '已經比過，一定相同');
  await step(tok);                                     // 57:06 next compare: T[7] with P[2]
  glow(pc[0], GREEN); glow(pc[1], GOLD); glow(tc[6], GOLD);
  say('紅色不用比了：下一個直接比 T 的第七個和 P 的第二個', '');
  await step(tok);                                     // 57:36 example 3: the eighth letter fails
  setup('AGCTTAGGCTTA', 7);
  say('例三：T 的第八個是 G，P 的第八個是 C，不同', '');
  await step(tok);                                     // 57:56 AG before it is also P's start
  block(7, 2);
  say('不一樣之前的兩個字母 AG', '跟 P 開頭的 AG 一樣');
  await step(tok);                                     // 58:17 align them
  slide(5);
  for (let i = 0; i < 2; i++) glow(pc[i], GREEN);
  say('把兩段 AG 對齊（shift）', '這段不用再比');
  await step(tok);                                     // 58:40 make full use of what was compared
  glow(pc[2], GOLD); glow(tc[7], GOLD);
  say('直接從它的下一個開始比', '充分利用之前比對過的資訊');
  await step(tok);                                     // 59:41 the spirit of KMP
  say('KMP 精神：比過而且相同的區塊不用再比', '直接從那塊的下一個開始比');
}]);

// ── 15. fail function 定義 ──
FRAG.push(['arrpeng34-fail-def', 'Fail function 的定義', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.6]);
  const X = (k) => -5.6 + k * 0.8;
  const s = 4;
  let tc, pc, fc = [], jl, cp = null;
  await step(tok);                                     // 1:00:06 T and P differ at j: x != y
  KT.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -2.9));
  tc = strRow(KT, X(0), -2.1, '#4b9ee2', 0.8);
  pc = strRow(KP, X(s), -0.8, P_C, 0.8);
  tag('T', 'ptr', -6.5, 0.2, -2.1); tag('P', 'ptr alt', -6.5, 0.2, -0.8);
  for (let k = 0; k < 5; k++) { glow(pc[k], GREEN); glow(tc[s + k], GREEN); }
  glow(pc[5], RED); glow(tc[s + 5], RED);
  jl = tag('j', 'ptr alt', X(s + 5), 0.2, 0.0);
  say('示意圖：T 和 P 在 j 這個位置不一樣', 'x ≠ y');
  await step(tok);                                     // 1:00:22 look at the position j - 1
  glow(pc[4], GOLD);
  tag('j − 1', 'ptr', X(s + 4), 0.2, 0.0);
  say('去看 j 的前一個位置：j − 1', '');
  await step(tok);                                     // 1:00:32 the fail array
  tag('fail', 'idx', -6.5, 0.2, 0.6);
  await build(tok, 7, 100, (q) => fc.push(cube(KF[q + 1], '#9b7ef4', [0.64, 0.3, 0.64], X(s + q), 0.15, 0.6, 1.5)));
  say('下面這個 array 叫 fail array', '');
  await step(tok);                                     // 1:00:50 it stores the red block's length
  for (let i = 2; i < 5; i++) { tint(pc[i], RED_T); tint(tc[s + i], RED_T); }
  glow(fc[4], GOLD);
  say('它記載 j − 1 這裡「紅色相同區塊」有多長', 'f(j − 1) = 3：aba');
  await step(tok);                                     // 1:01:36 same length as the pattern
  glow(fc[4], null);
  say('fail array 的長度跟 pattern 一樣', 'P 有 7 個字 → fail 也 7 格');
  await step(tok);                                     // 1:02:09 the definition of f(j)
  pc.forEach((m) => { glow(m, null); tint(m, P_C); }); tc.forEach((m) => { glow(m, null); tint(m, '#4b9ee2'); });
  tag('f(j) = 最大的 k（k < j），使 P 開頭 k 個 = P 到 j 為止的最後 k 個', 'note', 0, 0.2, 3.4);
  say('fail function f 的定義', 'pattern 是 p₀ p₁ … pₙ₋₁');
  await step(tok);                                     // 1:02:35 compare the start with the part ending at j
  const j = 5;
  glow(pc[j - 1], GOLD); jl.position.set(X(s + j - 1), 0.2, 0.0); txt(jl, 'j = 5');
  say('以 j = 5 為例：從 P 的 j 往前看', '跟 P 開頭的同樣長度比');
  await step(tok);                                     // 1:03:05 look back k items: k = 4
  cp = strRow(KP.slice(0, 4), X(s + 1), 1.8, '#9b7ef4', 0.8, 2);
  await beat(tok, 500);
  for (let i = 0; i < 4; i++) glow(cp[i], KP[i] === KP[1 + i] ? GREEN : RED);
  say('往前看 k 個：k = 4 時 abab ≠ baba', '不成立');
  await step(tok);                                     // 1:03:43 take the largest k that works: 3
  cp.forEach(kill);
  cp = strRow(KP.slice(0, 3), X(s + 2), 1.8, '#9b7ef4', 0.8, 2);
  await beat(tok, 500);
  cp.forEach((m) => glow(m, GREEN));
  for (let i = 2; i < 5; i++) tint(pc[i], RED_T);
  say('k = 3：aba = aba，成立', '要取最大的 k');
  await step(tok);                                     // 1:03:56 k must be smaller than j
  say('而且 k 要小於 j', '不能拿整段自己跟自己比');
  await step(tok);                                     // 1:04:05 the two parts may overlap
  glow(pc[2], GOLD);
  say('兩段可以 overlap：中間的 a 被共用', '只要 k 沒超過 j 就可以');
  await step(tok);                                     // 1:04:50 f(j) = the longest k
  glow(fc[4], GOLD);
  say('所以 f(5) = 3', 'f(j) 設成最長的 k');
}]);

// ── 16. 算 ababaca 的 fail function ──
FRAG.push(['arrpeng34-fail-calc', '算出 fail = 0012301', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const X = (k) => -3.6 + k * 1.0;
  let pc, fv = [];
  const show = (q) => {
    const k = KF[q];
    pc.forEach((m, i) => { tint(m, P_C); glow(m, i === q - 1 ? GOLD : null); });
    for (let i = 0; i < k; i++) tint(pc[i], HEAD_T);
    for (let i = q - k; i < q; i++) tint(pc[i], RED_T);
    fv[q] = cube(k, k ? '#9b7ef4' : '#b9a582', [0.7, 0.4, 0.7], X(q - 1), 0.2, 0.4, 2);
  };
  await step(tok);                                     // 1:05:22 example P = ababaca
  pc = strRow(KP, X(0), -1.4, P_C, 1.0, 2);
  tag('P', 'ptr', -4.7, 0.2, -1.4); tag('f', 'ptr alt', -4.7, 0.2, 0.4);
  for (let q = 1; q <= 7; q++) cube('', GRAY, [0.7, 0.06, 0.7], X(q - 1), 0.03, 0.4);
  say('例子：P = ABABACA', '來算它的 fail function');
  await step(tok);                                     // 1:05:40 q: the position, from 1
  for (let q = 1; q <= 7; q++) tag('q=' + q, 'idx', X(q - 1), 0.2, -2.2);
  say('上面的 q 是每個字母的位置', 'a 在 1、b 在 2、a 在 3…');
  await step(tok);                                     // 1:06:10 first a: nothing before -> 0
  show(1);
  say('第一個 a：前面沒東西可比', 'f(1) = 0');
  await step(tok);                                     // 1:06:18 b: cannot grow -> 0
  show(2);
  say('b：往前長也長不出跟開頭一樣的', 'f(2) = 0');
  await step(tok);                                     // 1:06:25 the third letter a = P's first a -> 1
  show(3);
  say('第三個 a：跟 P 開頭的 a 一樣', '長度 1 → f(3) = 1');
  await step(tok);                                     // 1:07:01 b: AB, also at P's start -> 2
  show(4);
  say('b 往前看是 ab，剛好也在 P 的開頭', 'f(4) = 2');
  await step(tok);                                     // 1:07:24 fifth a: ABA -> 3
  show(5);
  say('第五個 a 往前看 aba，也是 P 的前三個', 'f(5) = 3');
  await step(tok);                                     // 1:07:48 overlap is fine
  glow(pc[2], GOLD);
  say('中間的 a 兩段都用到：這是 overlap', '沒關係，長度一樣算 3');
  await step(tok);                                     // 1:08:00 c: nothing matches -> 0
  show(6);
  say('c 往前看都找不到一樣的', 'f(6) = 0');
  await step(tok);                                     // 1:08:24 seventh a = first a -> 1
  show(7);
  say('第七個 a 跟開頭的 a 一樣', 'f(7) = 1');
  await step(tok);                                     // 1:08:59 result 0012301
  pc.forEach((m) => { tint(m, P_C); glow(m, null); });
  tag('fail = 0 0 1 2 3 0 1', 'ptr alt', 0, 0.2, 1.6);
  say('結果：fail function = 0 0 1 2 3 0 1', '');
  await step(tok);                                     // 1:09:17 what the 3 means: ABA = ABA
  for (let i = 0; i < 3; i++) tint(pc[i], HEAD_T); for (let i = 2; i < 5; i++) tint(pc[i], RED_T);
  glow(fv[5], GOLD);
  say('那個 3：第五個 a 往前看三個是 aba', '跟 P 最開頭往後看三個完全一樣');
  await step(tok);                                     // 1:09:41 produced from the pattern itself
  glow(fv[5], null);
  say('fail function 是 pattern 自己產生的 array', '跟 T 完全無關');
}]);

// ── 17. 失敗時怎麼移：比 P[f(j−1)+1] ──
FRAG.push(['arrpeng34-kmp-shift-rule', '失敗時從 P[f(j−1)+1] 接著比', async (tok) => {
  fresh([0, 9, 8.5], [0, 0, 0.3]);
  const X = (k) => -5.6 + k * 0.8; // T 的 1-based 位置 i → X(i-1)
  let tc, pc, s = 4, jl;
  await step(tok);                                     // 1:10:32 with the fail function, matching moves fast
  KT.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.9));
  tc = strRow(KT, X(0), -1.1, '#4b9ee2', 0.8);
  pc = strRow(KP, X(s), 0.4, P_C, 0.8);
  tag('T', 'ptr', -6.5, 0.2, -1.1); tag('P', 'ptr alt', -6.5, 0.2, 0.4);
  tag('fail = 0 0 1 2 3 0 1', 'note', 0, 0.2, 2.6);
  say('有了 fail function，就能更快地做字串比對', '');
  await step(tok);                                     // 1:11:01 the yellow part all matched
  for (let i = 0; i < 5; i++) { glow(pc[i], GOLD); glow(tc[s + i], GOLD); }
  say('前面黃色這段都一樣：match', '');
  await step(tok);                                     // 1:11:08 at T's i and P's j: different
  glow(pc[5], RED); glow(tc[9], RED);
  tag('i = 10', 'ptr', X(9), 0.2, -2.7); jl = tag('j = 6', 'ptr alt', X(s + 5), 0.2, 1.3);
  say('在 T 的 i 和 P 的 j 發現不一樣', 'T[10] = b ≠ P[6] = c');
  await step(tok);                                     // 1:11:24 look at the fail function of j - 1
  say('去看不一樣那個字的前一個：j − 1 的 fail', 'f(j − 1) = f(5) = 3');
  await step(tok);                                     // 1:11:48 j-1 back k = P's first k (red)
  for (let i = 2; i < 5; i++) { tint(pc[i], RED_T); tint(tc[s + i], RED_T); }
  say('它記載：j − 1 往前 k 個 = P 開頭 k 個', '紅色區塊：aba');
  await step(tok);                                     // 1:12:01 the red block needs no comparison
  pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null));
  s = 6;
  pc.forEach((m, i) => { move(m, X(s + i), 0.23, 0.4); tint(m, i < 3 ? RED_T : P_C); });
  say('紅色區塊不用再比了', 'P 直接對齊');
  await step(tok);                                     // 1:12:22 compare P[f(j-1)+1]
  glow(pc[3], GOLD); glow(tc[9], GOLD);
  jl.position.set(X(s + 3), 0.2, 1.3); txt(jl, 'P[4]');
  say('下一次跟 i 比的是 P[f(j−1)+1]', 'T 的 i 不用往回走');
  await step(tok);                                     // 1:12:44 that block has length f(j-1)
  say('紅色區塊的長度就是 f(j−1)', 'f(5) + 1 = 4 → 從 P[4] 比');
  await step(tok);                                     // 1:13:36 that is the fast move
  say('這樣就做到快速移動', 'j ← f(j−1) + 1，i 只往前走');
}]);

// ── 18. KMP 完整 trace（T = bacbabababacaab, P = ababaca）──
FRAG.push(['arrpeng34-kmp-trace', 'KMP 完整走一遍', async (tok) => {
  fresh([0, 9.5, 8.5], [0, 0, 0.2]);
  const X = (k) => -5.6 + k * 0.8;
  let tc, pc, fc = [], il;
  const clearG = () => { pc.forEach((m) => glow(m, null)); tc.forEach((m) => glow(m, null)); };
  const place = (s) => { clearG(); pc.forEach((m, k) => move(m, X(s + k), 0.23, 0.4)); };
  // compare P[k] (0-based) with T at shift s
  const cmp = (s, k) => { const eq = KP[k] === KT[s + k]; glow(pc[k], eq ? GREEN : RED); glow(tc[s + k], eq ? GREEN : RED); il.position.set(X(s + k), 0.2, -2.5); txt(il, 'i = ' + (s + k + 1)); return eq; };
  await step(tok);                                     // 1:14:21 KMP's two phases on an example
  KT.split('').forEach((ch, i) => tag(String(i + 1), 'idx', X(i), 0.2, -1.8));
  tc = strRow(KT, X(0), -1.0, '#4b9ee2', 0.8);
  pc = strRow(KP, X(0), 0.4, P_C, 0.8);
  tag('T', 'ptr', -6.5, 0.2, -1.0); tag('P', 'ptr alt', -6.5, 0.2, 0.4);
  il = tag('i = 1', 'ptr', X(0), 0.2, -2.5);
  say('例子：T = bacbabababacaab，P = ABABACA', 'KMP 分兩個 phase');
  await step(tok);                                     // 1:14:42 phase 1: the fail function
  tag('fail', 'idx', -6.5, 0.2, 1.3);
  for (let q = 1; q <= 7; q++) fc.push(cube(KF[q], '#9b7ef4', [0.6, 0.3, 0.6], X(q - 1), 0.15, 1.3, 1.5));
  say('Phase 1：先求出 fail function', '0 0 1 2 3 0 1');
  await step(tok);                                     // 1:15:06 what a 3 means
  for (let i = 0; i < 3; i++) tint(pc[i], HEAD_T); for (let i = 2; i < 5; i++) tint(pc[i], RED_T);
  glow(fc[4], GOLD);
  say('例：那個 3 表示 a 往前看三個', '跟 pattern 開頭三個（ABA）一樣');
  await step(tok);                                     // 1:15:51 first char: b vs a
  pc.forEach((m) => tint(m, P_C)); glow(fc[4], null);
  cmp(0, 0);
  say('Phase 2 開始：T 的第一個 b 對 P 的 a', '<span class="no">不一樣</span>');
  await step(tok);                                     // 1:16:10 fail of a: 0 + 1 -> still P[1]: shift one
  place(1);
  say('第一個字就不同：0 + 1 = 1，還是從 P 的第 1 個比', '只能 shift 一格');
  await step(tok);                                     // 1:16:47 a = a, then c vs b
  cmp(1, 0); await beat(tok, 450); cmp(1, 1);
  say('a = a 一樣；接著 c 對 b 不一樣', '');
  await step(tok);                                     // 1:17:05 fail of the a before b: 0 -> P[1] vs c
  glow(fc[0], GOLD);
  place(2); await beat(tok, 500); cmp(2, 0);
  say('看 b 前一個 a 的 fail = 0', '下一次還是從 P 的第 1 個比：a 對 c，不 match');
  await step(tok);                                     // 1:18:17 b = b and so on: five match
  glow(fc[0], null);
  place(3); await beat(tok, 350); cmp(3, 0); await beat(tok, 350);
  place(4); await beat(tok, 350);
  for (let k = 0; k < 5; k++) { cmp(4, k); await beat(tok, 260); }
  say('一樣就繼續比：a、b、a、b、a', '前面 5 個完全一樣');
  await step(tok);                                     // 1:18:32 the sixth: c vs b
  cmp(4, 5);
  say('第 6 個不一樣：P 是 c，T 是 b', '');
  await step(tok);                                     // 1:19:01 fail of the a before: 3
  glow(fc[4], GOLD);
  for (let i = 2; i < 5; i++) { tint(pc[i], RED_T); tint(tc[4 + i], RED_T); }
  say('看前一個 a 的 fail function', 'ABA → 3');
  await step(tok);                                     // 1:19:21 3 + 1 = 4: compare P[4] next
  place(6); pc.forEach((m, k) => tint(m, k < 3 ? RED_T : P_C));
  await beat(tok, 600);
  cmp(6, 3);
  say('3 + 1 = 4：下一次直接拿 P 的第 4 個 B 去比', '前三個已經比過，不用再比');
  await step(tok);                                     // 1:20:00 the rest all match
  glow(fc[4], null);
  for (let k = 4; k < 7; k++) { cmp(6, k); await beat(tok, 300); }
  say('後面都一樣：match', '');
  await step(tok);                                     // 1:20:12 report position 7
  pc.forEach((m) => tint(m, P_C)); for (let k = 0; k < 7; k++) { glow(pc[k], GREEN); glow(tc[6 + k], GREEN); }
  say('回報位置：pattern 出現在第 7 個位置', 'ABABACA = T[7…13]');
}]);

// ═════════ 5HBMYNYYGZU：template、Stack、Queue ═════════

// ── 19. C++ template ──
FRAG.push(['arrpeng34-template', 'C++ template：同一份 sort', async (tok) => {
  fresh([0, 8, 10], [0, 1.6, 0]);
  const cd = code(['template <class KeyType>', 'void sort(KeyType *a, int n)', '{ … 比較 a[i]、交換 … }', '', 'float farray[100];', 'int intarray[200];', 'sort(farray, 100);', 'sort(intarray, 200);'], -3.2, 5.4, 0.52, -1.5);
  const fv = [3.5, 1.2, 2.7, 0.4], iv = [7, 2, 9, 4];
  let fc, ic;
  await step(tok);                                     // 4:17 template: a type left open
  const box = ghostBox('#c08a1f', 2.2, 1.2, 1.4); box.position.set(2.5, 0.6, 0);
  tag('sort<KeyType>', 'ptr alt', 2.5, 1.6, 0);
  say('template：把某些 data type 寫成待定的型態', '換成 int 或 float，方法本身都適用');
  await step(tok);                                     // 4:39 template <class KeyType>
  cd.hl(0);
  say('C++ 寫法：template <class KeyType>', 'KeyType 是什麼，宣告時才決定');
  await step(tok);                                     // 5:02 void sort(KeyType *a, int n)
  cd.hl(1);
  say('例子：void sort(KeyType *a, int n)', '一個簡單的 sort');
  await step(tok);                                     // 5:19 says neither int nor float
  cd.hl(2);
  say('裡面完全沒寫是 integer 還是 float', '');
  await step(tok);                                     // 5:27 float farray
  cd.hl(4);
  fc = fv.map((v, k) => cube(v, '#4b9ee2', [0.75, 0.4, 0.75], 0.6 + k * 0.85, 0.2, -2.4, 2));
  tag('float', 'idx', -0.5, 0.2, -2.4);
  await beat(tok, 600);
  cd.hl(6);
  [...fv].sort((a, b) => a - b).forEach((v, k) => move(fc[fv.indexOf(v)], 0.6 + k * 0.85, 0.2, -2.4));
  say('真正執行時才決定：farray 是 float 陣列', 'KeyType = float');
  await step(tok);                                     // 5:41 int intarray[200]
  cd.hl(5);
  ic = iv.map((v, k) => cube(v, '#9b7ef4', [0.75, 0.4, 0.75], 0.6 + k * 0.85, 0.2, 2.4, 2));
  tag('int', 'idx', -0.5, 0.2, 2.4);
  await beat(tok, 600);
  cd.hl(7);
  [...iv].sort((a, b) => a - b).forEach((v, k) => move(ic[iv.indexOf(v)], 0.6 + k * 0.85, 0.2, 2.4));
  say('intarray：開 200 格，型態是 integer', 'KeyType = int');
  await step(tok);                                     // 5:52 both fit the same template
  cd.hl(-1);
  say('不管 float 還是 int，都套得進同一份 sort', '不受 data type 影響');
  await step(tok);                                     // 6:11 the textbook calls it KeyType
  say('課本後面幾個章節的資料型態都叫 KeyType', '就是用 template 來代表');
}]);

// ── 20. Stack：A~E 進、E 先出 ──
FRAG.push(['arrpeng34-stack-abcde', 'Stack：A B C D E 進，E 先出', async (tok) => {
  fresh([6, 6.5, 12], [0, 2.6, 0]);
  const Y = (i) => 0.45 + i * 0.95;
  const st = [];
  let top;
  const push = (ch) => { st.push(cube(ch, colorFor(st.length), [1.6, 0.85, 1.6], 0, Y(st.length), 0, 4)); top.position.set(2.2, Y(st.length - 1), 0); txt(top, 'top'); };
  await step(tok);                                     // 6:26 stack: Last In First Out
  for (let i = 0; i < 5; i++) { const g = ghostBox('#c9b48e', 1.7, 0.9, 1.7); g.position.set(0, Y(i), 0); }
  say('Stack：一種 data structure', '符合 LIFO：Last In First Out');
  await step(tok);                                     // 6:47 a pointer called top
  top = tag('top（空的）', 'ptr', 2.2, 0.2, 0);
  say('Stack 有一個指標叫 top', '');
  await step(tok);                                     // 6:52 A comes in
  push('A');
  say('第一個 input：A 進來', '');
  await step(tok);                                     // 7:00 then B
  push('B');
  say('接著 B 進來', '');
  await step(tok);                                     // 7:08 top always points at the topmost
  glow(st[1], GOLD);
  say('top 永遠指到 stack 最上面的 element', '');
  await step(tok);                                     // 7:16 C, D, E: top moves up
  glow(st[1], null);
  for (const ch of 'CDE') { push(ch); await beat(tok, 400); }
  say('C、D、E 進來，top 一路往上', '');
  await step(tok);                                     // 7:24 taking out = pop
  glow(st[4], GOLD);
  say('從 stack 取東西出來叫 pop', '拿 top 所指的元素');
  await step(tok);                                     // 7:38 E comes out
  fly(st.pop(), V3(5, 9, 2));
  say('pop：E 被撈出來', '');
  await step(tok);                                     // 7:48 top decreases
  top.position.set(2.2, Y(st.length - 1), 0);
  say('撈出來後 top 要減 1', '指到下一個 element D');
  await step(tok);                                     // 7:58 E: last in, first out
  say('E 最後一個被丟進去，卻第一個被取出來', '這就是 LIFO');
}]);

// ── 21. Stack 的應用：迷宮與 function call ──
FRAG.push(['arrpeng34-callstack', 'Stack 的應用：迷宮與 function call', async (tok) => {
  fresh([2, 7, 12], [0, 1.6, 0]);
  const Y = (i) => 0.55 + i * 1.15;
  const walls = ['#####', '#..##', '##.#.', '#...#', '###.#'];
  const MX = (c) => -6 + c * 0.8, MZ = (r) => -2 + r * 0.8;
  let bot, top, f0, f1;
  await step(tok);                                     // 8:34 maze programs use a stack
  walls.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cube('', '#8a7a62', [0.75, 0.6, 0.75], MX(c), 0.3, MZ(r)); else cube('', '#f6efe2', [0.75, 0.06, 0.75], MX(c), 0.03, MZ(r)); }));
  bot = cube('🤖', '#4b9ee2', [0.5, 0.5, 0.5], MX(1), 0.3, MZ(1));
  say('Stack 用處很多：例如迷宮老鼠', '機器人要從入口走到出口');
  await step(tok);                                     // 8:46 try and error
  const path = [[1, 2], [2, 2], [3, 2], [3, 1], [3, 2], [3, 3], [4, 3]];
  for (const [r, c] of path) { move(bot, MX(c), 0.3, MZ(r)); await beat(tok, 300); }
  say('try and error：走不通就退回上一步', '記住走過的路 → 用 stack');
  await step(tok);                                     // 9:03 function call: A calls B
  top = tag('top', 'ptr', 6.0, 0.2, 0);
  f0 = cube('main', '#4b9ee2', [3.6, 1.0, 1.8], 3.4, Y(0), 0, 3);
  top.position.set(6.0, Y(0), 0);
  say('另一個應用：function call', 'procedure A 呼叫 procedure B 時');
  await step(tok);                                     // 9:15 save what A is using
  tag('local 變數、pointer…', 'note', 3.4, Y(0) + 0.8, 1.2);
  say('要把 A 用到的東西先存下來', 'pointer、local variable');
  await step(tok);                                     // 9:36 main calls A1
  f1 = cube('A1', '#dd8238', [3.6, 1.0, 1.8], 3.4, Y(1), 0, 3);
  top.position.set(6.0, Y(1), 0);
  say('例：main 呼叫一個 function A1', '');
  await step(tok);                                     // 9:43 local vars, return address, pointers
  glow(f1, GOLD);
  tag('A1 的 local 變數、return address、pointer', 'note', 3.4, Y(1) + 0.8, 1.2);
  say('把 A1 這層用到的東西存起來', '放在 stack 上');
  await step(tok);                                     // 9:59 that is why stacks matter
  glow(f1, null);
  say('這只是說明：stack 很重要', '最後呼叫的會最先結束 → LIFO');
}]);

// ── 22. Stack ADT ──
FRAG.push(['arrpeng34-stack-adt', 'Stack 的 ADT', async (tok) => {
  fresh([2, 7, 12], [0, 2.4, 0]);
  const cd = code(['Stack ADT：a finite ordered list', 'Stack(MaxStackSize = DefaultSize)', 'Boolean IsFull()', 'void Add(const KeyType& item)  // push', 'Boolean IsEmpty()', 'KeyType* Delete(KeyType&)       // pop'], -3.4, 5.4, 0.55, -1);
  const Y = (i) => 0.45 + i * 0.95;
  const st = [];
  await step(tok);                                     // 10:12 a finite ordered list
  cd.hl(0);
  for (let i = 0; i < 4; i++) { const g = ghostBox('#c9b48e', 1.6, 0.9, 1.6); g.position.set(3.6, Y(i), 0); tag('[' + i + ']', 'idx', 2.3, Y(i), 0); }
  say('Stack ADT：a finite ordered list', 'with zero or more elements');
  await step(tok);                                     // 10:26 finite: the size is limited
  tag('最多 4 格', 'ptr', 3.6, 4.3, 0);
  say('finite（有限）不是亂寫的', 'stack 的大小有限制');
  await step(tok);                                     // 10:56 the constructor
  cd.hl(1);
  say('反映在 constructor', 'MaxStackSize = DefaultSize：最多能容納多少');
  await step(tok);                                     // 11:16 IsFull
  cd.hl(2);
  for (const ch of 'ABCD') { st.push(cube(ch, colorFor(st.length), [1.5, 0.85, 1.5], 3.6, Y(st.length), 0, 3)); await beat(tok, 300); }
  say('既然有限，總會滿', '要有 Boolean IsFull()');
  await step(tok);                                     // 11:34 Add = push
  cd.hl(3);
  say('Add：把一個元素丟進來，就是 push', '要給放進來的 item');
  await step(tok);                                     // 11:42 the item's type is KeyType
  say('item 的型態是 KeyType', '用 template：float、integer 都能用');
  await step(tok);                                     // 11:55 IsEmpty
  cd.hl(4);
  say('Boolean IsEmpty()：判斷 stack 是不是空的', '');
  await step(tok);                                     // 12:10 popping until empty
  while (st.length) { fly(st.pop(), V3(5, 8, 2)); await beat(tok, 300); }
  say('一直 pop，空了再怎麼抓也抓不到東西', '所以 pop 前要先檢查 empty');
  await step(tok);                                     // 12:35 Delete = pop
  cd.hl(5);
  say('把東西抓出來叫 Delete，也就是 pop', 'Add = push、Delete = pop：不同說法');
}]);

// ── 23. 用陣列實作 Stack ──
FRAG.push(['arrpeng34-stack-array', '用陣列實作 Stack', async (tok) => {
  fresh([2, 7, 12.5], [0, 2.4, 0]);
  const Y = (i) => 0.45 + i * 0.95;
  let cd, top, a;
  await step(tok);                                     // 13:20 implement it with an array
  for (let i = 0; i < 4; i++) { const g = ghostBox('#c9b48e', 1.6, 0.9, 1.6); g.position.set(4.2, Y(i), 0); tag('stack[' + i + ']', 'idx', 2.6, Y(i), 0); }
  say('邏輯上 stack 像一個容器', '實際上可以用 array 實作：stack[0] … stack[n−1]');
  await step(tok);                                     // 13:40 not the only way
  tag('array 不是唯一的實作方式', 'note', 4.2, 4.4, 0);
  say('array 只是其中一種', '不代表 stack 只能用 array 做');
  await step(tok);                                     // 14:16 Stack::Stack is a member function
  cd = code(['Stack::Stack(int MaxSize) : MaxStackSize(MaxSize)', '{ stack = new KeyType[MaxStackSize]; top = -1; }', 'void Stack::Add(const KeyType& x)', '{ if (IsFull()) StackFull(); else stack[++top] = x; }', 'KeyType* Stack::Delete(KeyType& x)', '{ if (IsEmpty()) { StackEmpty(); return 0; }', '  x = stack[top--]; return &x; }'], -2.6, 5.6, 0.55, -1.2);
  cd.hl(0);
  say('兩個冒號 Stack::Stack', '表示這是 class Stack 的 member function');
  await step(tok);                                     // 14:54 one colon: initialise MaxStackSize
  say('一個冒號：在初始化', 'MaxStackSize = MaxSize');
  await step(tok);                                     // 15:04 new a KeyType array
  cd.hl(1);
  say('new 一個 KeyType 的 array', '大小就是 MaxStackSize');
  await step(tok);                                     // 15:18 top = -1
  top = tag('top = −1', 'ptr', 4.2, 0.2, 1.6);
  say('top 一開始等於 −1', '因為還沒有任何資料');
  await step(tok);                                     // 15:28 IsEmpty: top == -1
  say('IsEmpty 就是看 top == −1', '是的話 return true');
  await step(tok);                                     // 15:58 Add(x)
  cd.hl(2);
  say('加一個資料 x 進來：Add(x)', '');
  await step(tok);                                     // 16:14 first: IsFull? top == MaxStackSize - 1
  cd.hl(3);
  say('先判斷是不是滿了', 'IsFull：top == MaxStackSize − 1');
  await step(tok);                                     // 16:31 stack[++top] = x
  a = cube('A', colorFor(0), [1.5, 0.85, 1.5], 4.2, Y(0), 0, 3);
  txt(top, 'top = 0'); top.position.set(4.2, Y(0) + 0.8, 1.6);
  say('沒滿：stack[++top] = x', 'top 從 −1 加到 0，stack[0] 放 A');
  await step(tok);                                     // 17:03 Delete: check empty first
  cd.hl(5);
  say('Delete：先判斷是不是 empty', '空的就輸出 empty 訊息');
  await step(tok);                                     // 17:09 return the top element, then top--
  cd.hl(6);
  glow(a, GOLD);
  await beat(tok, 500);
  fly(a, V3(5, 8, 2)); txt(top, 'top = −1'); top.position.set(4.2, 0.2, 1.6);
  say('不空：先回報 top 所指的 element，再 top 減 1', 'x = stack[top--]');
}]);

// ── 24. Queue：front / rear ──
FRAG.push(['arrpeng34-queue-abcd', 'Queue：A 先進先出', async (tok) => {
  fresh([0, 8, 11], [0, 0.5, 0]);
  const X = (i) => -3.6 + i * 1.8;
  const q = [];
  let fl, rl;
  await step(tok);                                     // 17:46 first in, first out
  for (let i = 0; i < 5; i++) cube('', GRAY, [1.6, 0.06, 1.6], X(i), 0.03, 0);
  say('Queue：First In First Out', '第一個來的，第一個出去');
  await step(tok);                                     // 18:00 two variables
  say('為了做到 FIFO，queue 有兩個變數', '');
  await step(tok);                                     // 18:08 front and rear
  fl = tag('front', 'ptr', X(0), 0.2, 1.6); rl = tag('rear', 'ptr alt', X(0), 1.6, 0);
  say('front 指向第一個人，rear 指向尾巴', '');
  await step(tok);                                     // 18:22 add A, B, C, D
  for (const ch of 'ABCD') { q.push(cube(ch, colorFor(q.length), [1.5, 0.85, 1.5], X(q.length), 0.45, 0, 3)); rl.position.set(X(q.length - 1), 1.6, 0); await beat(tok, 350); }
  say('加入 A、B、C、D', 'front → A，rear → D');
  await step(tok);                                     // 18:36 take one out: front's element
  glow(q[0], GOLD);
  say('從 queue 抓一個出來', '就是 front 所指的 A');
  await step(tok);                                     // 18:48 A goes, front -> B
  fly(q.shift(), V3(-5, 8, 3));
  fl.position.set(X(1), 0.2, 1.6);
  say('A 出去了，front 改指向 B', '');
  await step(tok);                                     // 18:55 fewer people
  say('人數就變少了', 'front → B，rear → D');
}]);

// ── 25. Queue 的應用：job scheduling → priority queue ──
FRAG.push(['arrpeng34-jobq', 'Job scheduling 與 priority queue', async (tok) => {
  fresh([0, 8, 11], [0, 0.6, 0]);
  const X = (i) => 2.6 - i * 1.7;
  let cpu, js, shop, ppl;
  await step(tok);                                     // 19:06 queues in real life
  shop = cube('可麗餅', '#c08a1f', [1.8, 1.2, 1.8], 5, 0.6, 0);
  ppl = ['甲', '乙', '丙'].map((t, i) => cube(t, colorFor(i + 4), [1.3, 0.8, 1.3], X(i), 0.4, 0, 3));
  say('Queue 很符合現實：郵局、買可麗餅排隊', '先來的先服務');
  await step(tok);                                     // 19:23 job scheduling
  ppl.forEach((m) => fly(m)); kill(shop);
  cpu = cube('CPU', '#5c7a4a', [1.8, 1.2, 1.8], 5, 0.6, 0);
  say('Queue 也常用在 job scheduling', '');
  await step(tok);                                     // 19:46 many jobs: J1, J2, J3
  js = ['J1', 'J2', 'J3'].map((j, i) => cube(j, colorFor(i + 1), [1.3, 0.8, 1.3], X(i), 0.4, 0, 3));
  say('電腦同時有很多 job：J1、J2、J3', '');
  await step(tok);                                     // 19:55 dumbest: first come first served
  let m = js.shift(); glow(m, GOLD); move(m, 5, 1.6, 0); js.forEach((o, i) => move(o, X(i), 0.4, 0));
  say('最笨的方法：誰先進來，誰先被執行', 'J1 先做');
  await step(tok);                                     // 20:27 Word, PowerPoint, PDF order
  fly(m, V3(3, 8, 2));
  for (let k = 0; k < 2; k++) { await beat(tok, 450); m = js.shift(); glow(m, GOLD); move(m, 5, 1.6, 0); js.forEach((o, i) => move(o, X(i), 0.4, 0)); await beat(tok, 450); fly(m, V3(3, 8, 2)); }
  say('例：先開 Word、再開 PowerPoint、PDF', '進 queue 的時間決定順序');
  await step(tok);                                     // 21:01 is FIFO good?
  say('FIFO 好嗎？不見得', '');
  await step(tok);                                     // 21:09 someone buys 50 crepes
  kill(cpu);
  shop = cube('可麗餅', '#c08a1f', [1.8, 1.2, 1.8], 5, 0.6, 0);
  ppl = ['甲：買 50 個', '乙', '丙'].map((t, i) => cube(t, colorFor(i + 4), [1.5, 0.8, 1.3], X(i), 0.4, 0, 3));
  say('排第一的人買了 50 個可麗餅', '後面的人可能等一小時');
  await step(tok);                                     // 21:26 set a priority
  tag('priority', 'ptr', 0, 2.4, 0);
  say('解法：設定 priority（優先順序）', '');
  await step(tok);                                     // 22:03 the ones with class soon go first
  move(ppl[0], X(2), 0.4, -1.8); move(ppl[1], X(0), 0.4, 0); move(ppl[2], X(1), 0.4, 0);
  glow(ppl[1], GOLD); glow(ppl[2], GOLD);
  say('乙、丙 10 分鐘後要上課 → priority 高，先服務', '甲沒課，可以等');
  await step(tok);                                     // 22:27 that is a priority queue
  say('這就是後面會看到的 priority queue', '依 priority 決定誰先出來');
}]);

// ── 26. Queue ADT 跟 Stack ADT 很像 ──
FRAG.push(['arrpeng34-queue-adt', 'Queue ADT 與 Stack ADT', async (tok) => {
  fresh([0, 6, 12], [0, 2.6, 0]);
  let s, q;
  await step(tok);                                     // 22:48 the ADT looks like the stack's
  s = code(['Stack', 'IsFull()', 'Add(item)    // push', 'IsEmpty()', 'Delete()     // pop', 'top'], -3.6, 5.2, 0.6, 0);
  q = code(['Queue', 'IsFull()', 'Add(item)    // 從 rear 進', 'IsEmpty()', 'Delete()     // 從 front 出', 'front、rear'], 2.8, 5.2, 0.6, 0);
  say('Queue 的 ADT 跟 stack 很像', '看起來都像一個容器');
  await step(tok);                                     // 22:59 the difference: front and rear
  s.hl(5); q.hl(5);
  say('差別：queue 有兩個變數 front、rear', 'stack 只要一個 top');
  await step(tok);                                     // 23:13 the member functions are alike
  for (let i = 1; i <= 4; i++) { s.hl(i); q.hl(i); await beat(tok, 450); }
  say('member function 都很像', 'IsFull、IsEmpty、加一個、刪一個');
  await step(tok);                                     // 23:29 read them yourself
  s.hl(-1); q.hl(-1);
  say('這些簡單的 function 請回去自己看', '頂多參數上有些調整');
}]);
  }

  // ═══ bariarr.js ═══
  {
// ═══ Abdul Bari：陣列位址、指標（MJZd6uPi88E、868qXWoGS9E、uMGwjNuidZU）— cued: each step(tok) waits for the sentence it shows ═══
const P = () => (ctx.params || {});
const step = (tok) => ctx.step(tok);
const BLUE = '#4b9ee2', TEAL = '#2fc092', ORANGE = '#dd8238', SKIP = '#cfc6b6';
const ROWC = [BLUE, TEAL, ORANGE];
const cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };

// 一排記憶體格（地上）：回傳每格的 x、底座、位址標籤、索引標籤
function memRow(n, x0, dx, z, addr0, opts = {}) {
  const st = opts.step || 2, idx0 = opts.idx0 || 0, w = opts.w || Math.min(1.7, dx * 0.9);
  const xs = [], tiles = [], at = [], it = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx; xs.push(x);
    tiles.push(cube('', GRAY, [w, 0.2, 1.2], x, 0.1, z));
    if (addr0 !== null && addr0 !== undefined) { const a = tag(String(addr0 + i * st), 'idx', x, 0, z + 1.0); if (opts.hideAddr) showL(a, false); at.push(a); }
    if (opts.noIdx !== true) it.push(tag('[' + (idx0 + i) + ']', 'idx', x, 0, z - 1.0));
  }
  return { xs, tiles, at, it, z };
}
// 指標標記：標籤＋箭頭指到第 i 格；front=true 時從前方指過去
function ptrMark(name, c, xs, z, i, front) {
  const o = { i, l: tag(name, c, 0, 0, 0), a: null };
  o.at = (x) => {
    if (o.a) kill(o.a);
    if (!front) { o.l.position.set(x, 2.5, z); o.a = arrow(V3(x, 2.2, z), V3(x, 0.95, z)); }
    else { o.l.position.set(x, 0.3, z + 2.6); o.a = arrow(V3(x, 0.3, z + 2.3), V3(x, 0.3, z + 0.75)); }
  };
  o.place = (j) => { o.i = j; o.at(xs[j]); };
  o.slide = async (tok, j, ms = 800) => { const a = xs[o.i], b = xs[j]; await anim(tok, ms, (t) => o.at(a + (b - a) * t)); o.i = j; };
  o.kill = () => { kill(o.l); if (o.a) kill(o.a); };
  o.place(i); return o;
}

// ─── MJZd6uPi88E：一維陣列的位址公式 ───
async function scAddr1D(tok) {
  fresh([0, 6, 12.5], [0, 1.4, 0]);
  say('一維陣列：編譯器怎麼找到每一格？');
  await step(tok);                                   // 0:27 declared an array of size 5
  const cd = code(['int A[5];', 'A[2] = 15;'], -4.6, 5.2);
  cd.hl(0);
  tag('A', 'ptr', -6.2, 0.2, 0);
  const m = memRow(5, -4, 2, 0, 100, { noIdx: true, hideAddr: true });
  say('宣告 int A[5]：執行時拿到 5 格連續空間');
  await step(tok);                                   // 0:43 indices 0 to 4
  m.xs.forEach((x, i) => tag('[' + i + ']', 'idx', x, 0, -1.0));
  say('C 語言的索引：0 … 4');
  await step(tok);                                   // 0:51 base address L0 = 100
  showL(m.at[0], true);
  const l0 = tag('L0 = 100（base address）', 'ptr alt', -4, 2.4, 0);
  glow(m.tiles[0], GOLD);
  say('第一格的位址叫 base address，記作 L0', '這裡假設 L0 = 100');
  await step(tok);                                   // 1:21 compiler will convert this statement
  cd.hl(1);
  say('程式寫 A[2] = 15', '編譯器要把這行翻成機器碼');
  await step(tok);                                   // 1:25 it needs the address: 104
  m.at.forEach((a) => showL(a, true));
  glow(m.tiles[0]); glow(m.tiles[2], GOLD);
  say('要存 15，得先知道 A[2] 的位址', '每格 2 bytes：A[2] 在 104');
  await step(tok);                                   // 1:36 replaced with 104
  txt(cd.ls[1], '[104] = 15;');
  say('A[2] 要換成位址 104');
  await step(tok);                                   // 1:45 converted into a formula at runtime
  txt(cd.ls[1], 'A[2] = 15; ');
  const f = tag('104 不能寫死：L0 執行時才知道', 'bad', 2.4, 2.4, 0);
  say('但 100 要到執行時才知道', '所以編譯器寫「公式」，不寫固定數字');
  await step(tok);                                   // 2:16 relative address: L0 + index × size
  cls(f, 'ptr alt'); txt(f, 'Addr(A[2]) = L0 + 2 × w');
  say('相對位址：L0 + 索引 × 型態大小');
  await step(tok);                                   // 2:32 integer is two bytes
  txt(f, 'Addr(A[2]) = L0 + 2 × 2');
  say('int 佔 2 bytes（影片的假設）', '所以 w = 2');
  await step(tok);                                   // 2:53 base 100: 100 + 2 × 2 = 104
  const cur = tag('▼', 'ptr', m.xs[0], 1.3, 0);
  await anim(tok, 1200, (t) => cur.position.set(m.xs[0] + 4 * t, 1.3, 0));
  tint(m.tiles[0], SKIP); tint(m.tiles[1], SKIP);
  const v = cube(15, BLUE, [1.2, 0.7, 1.0], m.xs[2], 0.55, 0, 3);
  txt(f, '100 + 2 × 2 = 104');
  say('執行時 L0 = 100：100 + 2 × 2 = 104', '跳過前面 2 格，15 放進 104');
  await step(tok);                                   // 3:16 any location: L0 + i × w
  kill(cur); txt(l0, 'Addr(A[i]) = L0 + i × w'); kill(f);
  say('任何一格：Addr(A[i]) = L0 + i × w', 'i 是索引，w 是 word size（型態大小）');
  await step(tok);                                   // 3:40 float 4 bytes, char 1 byte
  tag('w：int 2・float 4・char 1', 'note', 3.2, 2.4, 0);
  say('w 隨資料型態改變', 'float 4 bytes、char 1 byte');
  await step(tok);                                   // 3:55 we write A[i], it is replaced by the formula
  glow(v, GREEN); cd.hl(1);
  say('我們只寫 A[i]', '編譯器自動換成這條公式');
}

// ─── MJZd6uPi88E：索引從 1 開始、任意下界 ───
async function scLowerBound(tok) {
  fresh([0, 6, 12.5], [0, 1.4, 0]);
  say('如果索引不是從 0 開始呢？');
  await step(tok);                                   // 4:07 languages before C: from 1
  const l0 = tag('A[1 … 5]（C 以前的語言）', 'ptr alt', 0, 4.4, 0);
  let m = memRow(5, -4, 2, 0, 100, { idx0: 1 });
  say('C 以前的語言：索引可以從 1 開始', '宣告 A[1 … 5]，第一格還是 L0 = 100');
  await step(tok);                                   // 4:35 formula L0 + (i − 1) × w
  txt(l0, 'Addr(A[i]) = L0 + (i − 1) × w');
  say('公式要先減 1', '因為 A[1] 才是第一格');
  await step(tok);                                   // 4:47 A[2] = 100 + (2 − 1) × 2 = 102
  tint(m.tiles[0], SKIP); glow(m.tiles[1], GOLD);
  say('A[2] = 100 + (2 − 1) × 2 = 102', '前面只要跳 1 格');
  await step(tok);                                   // 5:18 after C: indices start from 0
  const c0 = tag('從 0：L0 + i × w', 'ptr', -3.4, 3.3, 0), c1 = tag('從 1：L0 + (i − 1) × w', 'ptr', 3.4, 3.3, 0);
  showL(c0, false); showL(c1, false);
  say('C 之後的語言：索引一律從 0 開始', '為什麼？比一比兩條公式');
  await step(tok);                                   // 5:33 formula for 0: L0 + i × w
  showL(c0, true); showL(c1, true);
  say('從 0 開始的公式 vs 從 1 開始的公式');
  await step(tok);                                   // 5:43 one operation extra: minus
  cls(c1, 'bad');
  say('從 1 開始多了一個減法', '每次存取陣列都要多算一次');
  await step(tok);                                   // 5:49 C removed it, forces index 0
  cls(c0, 'good');
  say('C 拿掉這個多餘的運算', '規定陣列從索引 0 開始');
  await step(tok);                                   // 6:10 any start, e.g. A[−3 … 5]
  [...m.tiles, ...m.at, ...m.it, c0, c1].forEach(kill);
  m = memRow(9, -5.6, 1.4, 0, 100, { idx0: -3, w: 1.2 });
  txt(l0, 'A[−3 … 5]');
  say('更早的編譯器：起點、終點都能自訂', '例如 A[−3 … 5]，共 9 格');
  await step(tok);                                   // 6:43 L0 + (i − lb) × w
  txt(l0, 'Addr(A[i]) = L0 + (i − lb) × w');
  glow(m.tiles[0], GOLD);
  tag('lb = −3（下界）', 'ptr', m.xs[0], 1.6, 0);
  say('一般式：先減掉下界 lb，再乘 w', '從 0 開始時 lb = 0，就回到 L0 + i × w');
}

// ─── MJZd6uPi88E：二維陣列 → 一維記憶體 ───
const GX = (c) => -2.4 + c * 1.6, GY = (r) => 4.5 - r * 1.0, GZ = -1.6;
const LX = (k) => -6 + k * 1.09, LY = 0.4, LZ = 1.4;
// 一維記憶體 12 格（位址 500 …）
function mem12(hideAddr) {
  const tiles = [], at = [];
  for (let k = 0; k < 12; k++) { tiles.push(cube('', GRAY, [0.95, 0.15, 0.9], LX(k), 0.08, LZ)); const a = tag(String(500 + 2 * k), 'idx', LX(k), 0, LZ + 0.9); if (hideAddr) showL(a, false); at.push(a); }
  return { tiles, at };
}
// order: 'row' | 'col'；instant：直接擺在一維記憶體
function build2D(order, instant) {
  const cubes = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const k = order === 'row' ? r * 4 + c : c * 3 + r;
    const nm = 'a' + r + c;
    const m = instant ? cube(nm, ROWC[r], [0.92, 0.5, 0.8], LX(k), LY, LZ) : cube(nm, ROWC[r], [1.3, 0.75, 0.6], GX(c), GY(r), GZ);
    m.userData.k = k; m.userData.r = r; m.userData.c = c; cubes.push(m);
  }
  const heads = [];
  if (!instant) {
    for (let r = 0; r < 3; r++) heads.push(tag('row ' + r, 'idx', -3.9, GY(r), GZ));
    for (let c = 0; c < 4; c++) heads.push(tag('col ' + c, 'idx', GX(c), 5.3, GZ));
  }
  return { cubes, heads, byK: (k) => cubes.find((m) => m.userData.k === k) };
}
// 把一整列（或一整行）搬進一維記憶體
async function layGroup(tok, g, order, gi, ms = 160) {
  const ms_ = g.cubes.filter((m) => (order === 'row' ? m.userData.r : m.userData.c) === gi);
  ms_.forEach((m) => glow(m, GOLD));
  for (const m of ms_) { m.scale.set(0.72, 0.67, 1.33); move(m, LX(m.userData.k), LY, LZ); await beat(tok, ms); }
  ms_.forEach((m) => glow(m));
}
const groupTag = (order, gi) => {
  const ks = order === 'row' ? [gi * 4, gi * 4 + 3] : [gi * 3, gi * 3 + 2];
  return tag((order === 'row' ? 'row ' : 'col ') + gi, 'ptr', (LX(ks[0]) + LX(ks[1])) / 2, 1.3, LZ);
};
async function scRowLayout(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  say('接下來：二維陣列');
  await step(tok);                                   // 7:01 two options: row-major or column-major
  const opt = tag('2D 陣列：row-major 或 column-major', 'ptr alt', 0, 6.0, GZ);
  say('編譯器有兩種做法', 'row-major 或 column-major');
  await step(tok);                                   // 7:14 a 3 × 4 array drawn on paper
  kill(opt);
  tag('int A[3][4]', 'ptr alt', -5.2, 5.3, GZ);
  const g = build2D('row', false);
  say('A[3][4]：紙上畫成 3 列 4 行的表格');
  await step(tok);                                   // 7:25 in real: a single dimension
  const mm = mem12(true);
  say('但實際上是一維的：12 格連成一排', '記憶體是線性的，位址只有一個數字');
  await step(tok);                                   // 7:52 addresses 500, 502, 504 …
  mm.at.forEach((a) => showL(a, true));
  say('假設位址從 500 開始', '500、502、504、506 …（int 2 bytes）');
  await step(tok);                                   // 8:02 row-major mapping first
  say('先看 row-major mapping');
  await step(tok);                                   // 8:13 a00 a01 a02 a03: first row
  await layGroup(tok, g, 'row', 0);
  say('a00、a01、a02、a03：row 0 先放');
  await step(tok);                                   // 8:29 next row: a10 … a13
  await layGroup(tok, g, 'row', 1);
  say('接著 a10 … a13：row 1');
  await step(tok);                                   // 8:47 filled row by row
  await layGroup(tok, g, 'row', 2);
  say('最後 row 2：一列一列填進去', '這就是 row-major');
  await step(tok);                                   // 8:55 compiler maps 2D onto single dimension
  g.heads.forEach(kill);
  say('編譯器把 2D 對應到一維陣列', '但我們照樣用 A[i][j] 兩個下標存取');
  await step(tok);                                   // 9:16 this is row 0, 1, row 2
  [0, 1, 2].forEach((r) => groupTag('row', r));
  say('記憶體裡：row 0 → row 1 → row 2');
}
async function scRowAddr(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  mem12(false);
  const g = build2D('row', true);
  for (let r = 0; r < 3; r++) groupTag('row', r);
  const f = tag('Addr(A[2][1]) = ?', 'ptr alt', 0, 4.6, 0);
  showL(f, false);
  say('編譯器怎麼寫 row-major 的位址公式？');
  await step(tok);                                   // 9:44 A[2][1] is at 518
  showL(f, true); glow(g.byK(9), GOLD);
  say('例子：A[2][1]，答案是 518');
  await step(tok);                                   // 10:00 L0 + …, go to the second row
  glow(g.byK(9)); glow(g.byK(0), GOLD);
  txt(f, 'Addr(A[2][1]) = 500 + …');
  say('從 L0 = 500 出發', '要先走到 row 2');
  await step(tok);                                   // 10:15 skip two rows
  glow(g.byK(0));
  for (let k = 0; k < 8; k++) { tint(g.byK(k), SKIP); await beat(tok, 140); }
  txt(f, '500 + (2 × …');
  say('先跳過 row 0、row 1：2 整列');
  await step(tok);                                   // 10:24 each row has four elements
  txt(f, '500 + (2 × 4 …');
  say('每列有 n = 4 個元素', '2 列 = 2 × 4 = 8 個');
  await step(tok);                                   // 10:41 beginning of row 2, one element ahead
  tint(g.byK(8), SKIP);
  txt(f, '500 + (2 × 4 + 1) …');
  say('到 row 2 開頭，再往後 1 格');
  await step(tok);                                   // 10:48 multiplied by the size of int
  txt(f, '500 + (2 × 4 + 1) × 2');
  say('整個乘上 int 的大小 2');
  await step(tok);                                   // 10:56 500 + 9 × 2 = 518
  glow(g.byK(9), GOLD);
  txt(f, '500 + 9 × 2 = 518');
  say('500 + 9 × 2 = 518', '和圖上一樣');
  await step(tok);                                   // 11:23 m × n: L0 + (i × n + j) × w
  txt(f, 'Addr(A[i][j]) = L0 + (i × n + j) × w');
  say('m × n 陣列，row-major 公式（索引從 0）', 'i 列前面有 i × n 個，再加 j');
  await step(tok);                                   // 11:50 indices starting from one
  glow(g.byK(9));
  g.cubes.forEach((m) => { relabel(m, 'a' + (m.userData.r + 1) + (m.userData.c + 1)); tint(m, ROWC[m.userData.r]); });
  say('如果索引從 1 開始？', '同一批格子，名字都 +1');
  await step(tok);                                   // 11:58 L0 + [(i − 1) × n + (j − 1)] × w
  txt(f, 'L0 + [(i − 1) × n + (j − 1)] × w');
  say('i、j 都先減 1');
  await step(tok);                                   // 12:18 address of A[3][2]
  glow(g.byK(9), GOLD);
  say('例子：A[3][2]', '就是剛剛那一格 518');
  await step(tok);                                   // 12:26 500 + [(3 − 1) × 4 + (2 − 1)] × 2
  txt(f, '500 + [(3 − 1) × 4 + (2 − 1)] × 2');
  say('代進公式');
  await step(tok);                                   // 12:57 = 500 + 9 × 2 = 518
  txt(f, '500 + 9 × 2 = 518');
  say('= 500 + 9 × 2 = 518 ✓');
}
async function scColMajor(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  say('另一種：column-major');
  await step(tok);                                   // 13:18 column-major mapping
  tag('Column-major：一行一行放', 'ptr alt', 3.6, 6.1, GZ);
  await step(tok);                                   // 13:30 same 2D array, memory from 500
  tag('int A[3][4]（m = 3, n = 4）', 'ptr alt', -4.4, 6.1, GZ);
  mem12(false);
  const g = build2D('col', false);
  say('同一個 3 × 4 陣列', '記憶體一樣是一維，從 500 開始');
  await step(tok);                                   // 13:49 a00, a10, a20: column 0
  await layGroup(tok, g, 'col', 0);
  say('a00、a10、a20：column 0 先放');
  await step(tok);                                   // 13:56 then column 1
  await layGroup(tok, g, 'col', 1);
  say('再放 column 1');
  await step(tok);                                   // 14:02 column 2 and so on
  await layGroup(tok, g, 'col', 2, 120);
  await layGroup(tok, g, 'col', 3, 120);
  say('column 2、column 3 …', '一行一行填進去');
  await step(tok);                                   // 14:28 A[1][2] is at 514
  g.heads.forEach(kill);
  for (let c = 0; c < 4; c++) groupTag('col', c);
  const f = tag('Addr(A[1][2]) = ?', 'ptr alt', 0, 4.6, 0);
  glow(g.byK(7), GOLD);
  say('例子：A[1][2]，它在 514');
  await step(tok);                                   // 14:36 L0 + …, go into the second column
  glow(g.byK(7)); glow(g.byK(0), GOLD);
  txt(f, 'Addr(A[1][2]) = 500 + …');
  say('從 L0 = 500 出發', '要先走到 column 2');
  await step(tok);                                   // 14:56 skip two columns
  glow(g.byK(0));
  for (let k = 0; k < 6; k++) { tint(g.byK(k), SKIP); await beat(tok, 160); }
  txt(f, '500 + (2 × …');
  say('先跳過 2 整行');
  await step(tok);                                   // 15:05 each column has m = 3 elements
  txt(f, '500 + (2 × 3 …');
  say('每行有 m = 3 個元素', '2 行 = 2 × 3 = 6 個');
  await step(tok);                                   // 15:16 beginning of third column, one more
  tint(g.byK(6), SKIP);
  txt(f, '500 + (2 × 3 + 1) × 2');
  say('到 column 2 開頭，再往後 1 格', '整個乘上 2 bytes');
  await step(tok);                                   // 15:33 500 + 7 × 2 = 514
  glow(g.byK(7), GOLD);
  txt(f, '500 + 7 × 2 = 514');
  say('500 + 7 × 2 = 514');
  await step(tok);                                   // 15:50 L0 + (j × m + i) × w
  glow(g.byK(7));
  txt(f, 'Addr(A[i][j]) = L0 + (j × m + i) × w');
  say('column-major 公式（索引從 0）', '前面有 j 整行，每行 m 個，再加 i');
  await step(tok);                                   // 16:24 indices from one: L0 + [(j − 1) × m + (i − 1)] × w
  g.cubes.forEach((m) => { relabel(m, 'a' + (m.userData.r + 1) + (m.userData.c + 1)); tint(m, ROWC[m.userData.r]); });
  txt(f, 'L0 + [(j − 1) × m + (i − 1)] × w');
  say('索引從 1 開始：i、j 都先減 1');
  await step(tok);                                   // 16:48 A[1][4] is 518
  glow(g.byK(9), GOLD);
  say('例子：A[1][4]，在 518');
  await step(tok);                                   // 17:14 500 + [(4 − 1) × 3 + (1 − 1)] × 2
  for (let k = 0; k < 9; k++) tint(g.byK(k), SKIP);
  txt(f, '500 + [(4 − 1) × 3 + (1 − 1)] × 2');
  say('跳過 3 整行，再加 0 格');
  await step(tok);                                   // 17:42 = 500 + 9 × 2 = 518
  txt(f, '500 + 9 × 2 = 518');
  say('= 500 + 9 × 2 = 518 ✓');
}
async function scCompare(tok) {
  fresh([0, 5, 13], [0, 2.4, 0]);
  say('最後：比較兩條公式');
  await step(tok);                                   // 18:00 row-major and column-major formulas
  tag('Row-major', 'ptr', -3.5, 4.8, 0); tag('Column-major', 'ptr', 3.5, 4.8, 0);
  const fr = tag('L0 + (i × n + j) × w', 'ptr alt', -3.5, 4.0, 0), fc = tag('L0 + (j × m + i) × w', 'ptr alt', 3.5, 4.0, 0);
  say('兩條公式（索引從 0）');
  await step(tok);                                   // 18:14 i × n + j vs j × m + i
  tag('i、j 和 n、m 的位置對調', 'note', 0, 3.2, 0);
  say('只差在 i、j 和 n、m 的位置');
  await step(tok);                                   // 18:22 two addition operations
  const cs = [];
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) cs.push(cube('+', TEAL, [1.0, 0.8, 1.0], side * 3.5 - 1.8 + k * 1.2, 0.45, 0, 3));
  say('各有 2 次加法');
  await step(tok);                                   // 18:28 two multiplications
  for (const side of [-1, 1]) for (let k = 2; k < 4; k++) cs.push(cube('×', ORANGE, [1.0, 0.8, 1.0], side * 3.5 - 1.8 + k * 1.2, 0.45, 0, 3));
  say('也各有 2 次乘法');
  await step(tok);                                   // 18:37 equally efficient
  cs.forEach((m) => glow(m, GREEN));
  say('運算量一樣：兩者一樣有效率', '編譯器用哪一條都可以');
  await step(tok);                                   // 18:44 designing our own compiler / language
  say('自己設計編譯器或語言時', '任選一種就行');
  await step(tok);                                   // 18:51 C family uses row-major
  cls(fr, 'good'); void fc;
  tag('C 家族：row-major', 'ptr alt', 0, 2.2, 2);
  say('C 以及 C 家族的語言：row-major', '補充：Fortran、MATLAB 用 column-major');
}

// ─── 868qXWoGS9E：指向一維陣列的指標 ───
async function scPtr1D(tok) {
  fresh([0, 6, 12.5], [0, 1.6, 0]);
  say('指向陣列的指標：先看一維');
  await step(tok);                                   // 0:22 single-dimension array of size 5
  const m = memRow(5, -4, 2, 0, 100, { hideAddr: true });
  cube(9, BLUE, [1.2, 0.7, 1.0], m.xs[2], 0.55, 0, 3);
  tag('int A[5]', 'ptr alt', -6, 0.2, 0);
  say('一個大小 5 的陣列，放了一些值', 'A[2] = 9');
  await step(tok);                                   // 0:29 addresses; each int two bytes
  m.at.forEach((a) => showL(a, true));
  say('位址：100、102、104 …', '每個 int 佔 2 bytes');
  await step(tok);                                   // 0:37 name of the array = base address
  const an = tag('A = 100', 'ptr', m.xs[0], 2.5, 0); const aa = arrow(V3(m.xs[0], 2.2, 0), V3(m.xs[0], 0.95, 0));
  glow(m.tiles[0], GOLD);
  say('陣列名 A 就是 base address', 'A 本身就是 100');
  await step(tok);                                   // 0:55 a pointer stores an address; this IS an address
  say('指標是「存位址的變數」', 'A 不是變數，它本身就是位址');
  await step(tok);                                   // 1:13 one pointer p pointing to A
  const pc = cube(100, TEAL, [1.3, 0.8, 1.0], -4, 0.5, 3.4, 3);
  tag('p', 'ptr', -5.4, 0.5, 3.4);
  arrow(V3(-4, 0.5, 2.8), V3(-4, 0.5, 0.75));
  say('另外宣告指標 p，指向 A', 'p 裡存 100');
  await step(tok);                                   // 1:36 printf A → 100
  glow(m.tiles[0]);
  const ex = tag('printf(A) → 100', 'ptr alt', 0, 4.6, 0);
  glow(m.tiles[0], GOLD);
  say('印 A → 100', 'A 就是起始位址');
  await step(tok);                                   // 1:46 &A → 100
  txt(ex, '&A → 100');
  say('印 &A → 也是 100');
  await step(tok);                                   // 1:55 &A[0] → 100
  txt(ex, '&A[0] → 100');
  say('印 &A[0] → 還是 100', 'A、&A、&A[0] 都是起始位址');
  await step(tok);                                   // 2:02 A[2] → 9
  glow(m.tiles[0]); glow(m.tiles[2], GOLD);
  txt(ex, 'A[2] → 9');
  say('A[2]：索引 2 的值 = 9');
  await step(tok);                                   // 2:08 also 2[A] → 9
  txt(ex, 'A[2] → 9　　2[A] → 9');
  say('也可以寫成 2[A]，一樣是 9', 'A[i] 就是 *(A + i)，加法可交換');
  await step(tok);                                   // 2:30 A + 2: two integers
  glow(m.tiles[2]); kill(an); kill(aa);
  const cur = tag('A + 2', 'ptr', m.xs[0], 1.6, 0);
  txt(ex, 'A + 2 → ?');
  await anim(tok, 1000, (t) => cur.position.set(m.xs[0] + 4 * t, 1.6, 0));
  say('A + 2：往後 2 個 int', '不是 2 個 byte');
  await step(tok);                                   // 2:47 100 + 4 = 104
  txt(ex, 'A + 2 → 104');
  say('100 + 2 × 2 = 104');
  await step(tok);                                   // 2:56 *(A + 2) → 9
  glow(m.tiles[2], GOLD);
  txt(ex, '*(A + 2) → 9');
  say('*(A + 2)：104 那格的值 = 9');
  await step(tok);                                   // 3:10 same syntax with pointers
  kill(cur); glow(m.tiles[2]);
  glow(pc, GOLD);
  txt(ex, '同一套語法用在 p 上');
  say('同一套語法也能用在指標 p 上');
  await step(tok);                                   // 3:21 p → 100, &p → 500
  tag('&p = 500', 'idx', -4, 0, 4.5);
  txt(ex, 'p → 100　　&p → 500');
  say('p → 100', '&p 是 p 自己的位址，假設 500');
  await step(tok);                                   // 3:29 p[2] → 9, 2[p] → 9
  glow(pc); glow(m.tiles[2], GOLD);
  txt(ex, 'p[2] → 9　　2[p] → 9');
  say('p[2]、2[p] → 9');
  await step(tok);                                   // 3:37 p + 2 → 104, *(p + 2) → 9
  txt(ex, 'p + 2 → 104　　*(p + 2) → 9');
  say('p + 2 → 104，*(p + 2) → 9', '和陣列名的寫法完全一樣');
}

// ─── 868qXWoGS9E：用 double pointer 在 heap 建 2D 陣列 ───
const HY = (r) => 3.8 - r * 1.25;
const HX = (c) => -1.0 + c * 1.6;
function buildHeap2D() {
  const o = {};
  o.p = cube(' ', TEAL, [1.2, 0.8, 0.8], -5.6, 2.6, 0); tag('p', 'ptr', -5.6, 3.5, 0); o.pa = tag('&p = 700', 'idx', -5.6, 1.9, 0);
  o.ptr = []; o.rows = []; o.pt = [];
  return o;
}
function addPtrArr(o, hidden) {
  for (let r = 0; r < 3; r++) { o.ptr.push(cube('', GRAY, [1.2, 0.8, 0.8], -3.3, HY(r), 0)); const t = tag('[' + r + '] ' + (500 + 2 * r), 'idx', -3.3, HY(r) - 0.6, 0); if (hidden) showL(t, false); o.pt.push(t); }
}
function linkP(o) { relabel(o.p, 500); o.pt.forEach((t) => showL(t, true)); o.pArrow = arrow(V3(-5.0, 2.8, 0), V3(-3.95, HY(0), 0)); }
function addRow(o, r, base) {
  const row = [];
  for (let c = 0; c < 4; c++) { row.push(cube('', GRAY, [1.3, 0.8, 0.8], HX(c), HY(r), 0)); tag(base === null ? '' : String(base + 2 * c), 'idx', HX(c), HY(r) - 0.6, 0); }
  o.rows[r] = row;
  if (o.ptr[r].userData.lbl === undefined) { o.ptr[r].userData.lbl = lab.label(base === null ? '…' : String(base), 'val'); o.ptr[r].add(o.ptr[r].userData.lbl); }
  arrow(V3(-2.65, HY(r), 0), V3(-1.7, HY(r), 0));
}
async function scHeap2D(tok) {
  fresh([0, 4, 14], [0, 3.0, 0]);
  say('接著：指向二維陣列的指標');
  await step(tok);                                   // 3:51 one pointer for a 2D array
  const lv = tag('2D 陣列要用哪種指標？', 'ptr alt', -3, 6.4, 0);
  await step(tok);                                   // 4:02 1D single pointer, 2D double pointer
  txt(lv, '1D → *p　　2D → **p');
  say('老師：一維用單指標，二維用 double pointer（**p）', '小心：宣告的 int a[3][4]，a 是 int (*)[4]，不是 int **');
  await step(tok);                                   // 4:28 3D triple; as many levels as dimensions
  txt(lv, '1D → *　2D → **　3D → ***（僅限動態建法）');
  say('三維用 triple pointer', '「幾維就幾層指標」只對下面這種動態建法成立');
  await step(tok);                                   // 4:42 create the 2D array in heap
  kill(lv);
  const cd = code(['int **p;', 'p = new int*[3];', 'p[0] = new int[4];', 'p[1] = new int[4];', 'p[2] = new int[4];'], 4.6, 6.6, 0.5);
  cd.hl(0);
  const o = buildHeap2D();
  say('不直接宣告 2D 陣列', '改用指標在 heap 動態建立');
  await step(tok);                                   // 4:53 p = new int*[3]: array of pointers
  cd.hl(1); addPtrArr(o, true);
  say('p = new int*[3]：3 格「指標陣列」', '每格都是 int *');
  await step(tok);                                   // 5:14 base address stored in p (double pointer)
  linkP(o);
  say('指標陣列的 base 500 存進 p', 'p 是 double pointer：指向「指標」');
  await step(tok);                                   // 5:33 p[0] = new int[4], base 550
  cd.hl(2); addRow(o, 0, 550);
  say('p[0] = new int[4]', '一列 4 格，起點 550 存進 p[0]');
  await step(tok);                                   // 5:46 p[1], p[2] also
  cd.hl(3); addRow(o, 1, 600);
  await beat(tok, 500);
  cd.hl(4); addRow(o, 2, null);
  say('p[1]、p[2] 也各建一列', 'p[1] 存 600（第三列位址影片沒給）');
  await step(tok);                                   // 5:53 double pointer, array of pointers, arrays
  cd.hl(-1);
  tag('double pointer', 'ptr', -5.6, 0.6, 0); tag('array of pointers', 'ptr', -3.3, 0.6, 0); tag('arrays', 'ptr', 1.4, 0.6, 0);
  say('double pointer → 指標陣列 → 一列列陣列');
  await step(tok);                                   // 6:19 array of arrays = 2D array
  tag('array of arrays = 2D 陣列', 'ptr alt', 1.4, 5.7, 0);
  say('三者合起來就是一個 2D 陣列', 'array of arrays');
}

// ─── 868qXWoGS9E：double pointer 的語法 ───
async function scDPtrSyntax(tok) {
  fresh([0, 4, 14], [0, 3.0, 0]);
  const o = buildHeap2D(); addPtrArr(o); linkP(o);
  [550, 600, null].forEach((b, r) => addRow(o, r, b));
  const ex = tag('', 'ptr alt', 0, 6.3, 0);
  say('完整的 2D 陣列建好了', '用 p 寫出各種語法');
  let v10 = null;
  const steps = [
    ['p', '500', () => glow(o.p, GOLD), 'p 存指標陣列的起點'],
    ['&p', '700', () => glow(o.p, GOLD), 'p 自己的位址，假設 700'],
    ['*p', '550', () => glow(o.ptr[0], GOLD), '到 500 取內容：row 0 的起點'],
    ['p + 1', '502', () => glow(o.ptr[1], '#3a3a00'), '下一個指標（+2 bytes）'],
    ['*(p + 1)', '600', () => glow(o.ptr[1], GOLD), '取 502 的內容：row 1 的起點'],
    ['*(p + 1) + 2', '604', () => glow(o.rows[1][2], '#3a3a00'), '600 + 2 × 2 = 604'],
    ['*(*(p + 1) + 2)', '25', () => { glow(o.rows[1][2], GOLD); cube(25, ORANGE, [1.0, 0.6, 0.6], HX(2), HY(1) + 0.5, 0, 2); }, '再加一個 *：取 604 的值'],
    ['*(*(p + i) + j)', '任一格', () => o.rows.flat().forEach((m) => glow(m, '#3a3a00')), '換 i、j 就能存取任何位置'],
    ['*(*(p + 1) + 3)', '[1][3]', () => glow(o.rows[1][3], GOLD), 'row 1、第 3 格（606）'],
    ['*(*(p + i) + j) = p[i][j]', '', () => glow(o.rows[1][3], GOLD), '兩種寫法意思一樣'],
    ['p 500・&p 700・*p 550・p+1 502', '…', () => {}, '*(p+1) 600・*(p+1)+2 604・*(*(p+1)+2) 25'],
    ['**p = *(*(p + 0) + 0)', '?', () => glow(o.rows[0][0], '#3a3a00'), '+0 沒有作用'],
    ['**p', '10', () => { glow(o.rows[0][0], GOLD); v10 = cube(10, BLUE, [1.0, 0.6, 0.6], HX(0), HY(0) + 0.5, 0, 2); }, '去掉 0：就是 p[0][0]'],
  ];
  for (const [e, r, fn, w] of steps) {
    await step(tok);                                 // 6:52 p … 10:43 **p (one per expression)
    [o.p, ...o.ptr, ...o.rows.flat()].forEach((m) => glow(m));
    fn(); txt(ex, r ? e + '  →  ' + r : e);
    say(r ? e + ' → ' + r : e, w);
  }
  void v10;
}

// ─── 868qXWoGS9E：靜態 2D 陣列名用指標語法 ───
async function scArr2DSyntax(tok) {
  fresh([0, 5.2, 13], [0, 2.3, 0]);
  say('改成直接宣告 2D 陣列');
  await step(tok);                                   // 10:53 declare a 2D array directly
  const grid = [], gat = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const k = r * 4 + c;
    grid[k] = cube('a' + r + c, ROWC[r], [1.3, 0.75, 0.6], GX(c), GY(r), GZ);
    const a = tag(String(500 + 2 * k), 'idx', GX(c) + 0.45, GY(r) - 0.48, GZ + 0.4); showL(a, false); gat.push(a);
  }
  for (let r = 0; r < 3; r++) tag('row ' + r, 'idx', -3.9, GY(r), GZ);
  const A = tag('int A[3][4]', 'ptr alt', -5.0, 5.3, GZ);
  say('int A[3][4]：索引 0..2、0..3');
  await step(tok);                                   // 11:06 starting address 500
  gat.forEach((a) => showL(a, true));
  say('假設起始位址 500', '500、502、504、506，再接下一列');
  await step(tok);                                   // 11:20 really a single dimension: 12 ints
  mem12(false);
  const g = build2D('row', true);
  say('畫成 2D，實際是 12 個連續的 int', '用兩個下標存取，所以畫成表格');
  const ex = tag('', 'ptr alt', 3.6, 6.2, GZ);
  const all = () => { g.cubes.forEach((m) => glow(m)); grid.forEach((m) => glow(m)); };
  const glowK = (k, c) => { glow(g.byK(k), c); glow(grid[k], c); };
  const show = (e, r, fn, w) => { all(); fn(); txt(ex, e + '  →  ' + r); say(e + ' → ' + r, w); };
  await step(tok);                                   // 12:05 A → 500
  show('A', '500', () => glowK(0, GOLD), '陣列名 = base address');
  await step(tok);                                   // 12:14 &A → 500
  show('&A', '500', () => glowK(0, GOLD), '數值一樣是 500');
  await step(tok);                                   // 12:23 *A → 500 (still an address)
  show('*A', '500', () => glowK(0, GOLD), '*A 還是位址，不是資料');
  await step(tok);                                   // 12:31 A + 1 → 508 (next row)
  show('A + 1', '508', () => [4, 5, 6, 7].forEach((k) => glowK(k, GOLD)), '跳到下一列');
  await step(tok);                                   // 12:37 same rule as double pointer, not 502
  say('A + 1 不是 502，是 508', '一次跳一整列（4 個 int），規則和 double pointer 一樣');
  await step(tok);                                   // 12:52 array of arrays with an array of pointers in front
  const ph = [];
  for (let r = 0; r < 3; r++) { const b = ghostBox('#9b8b72', 0.9, 0.7, 0.6); b.position.set(-5.6, GY(r), GZ); ph.push(b); arrow(V3(-5.1, GY(r), GZ), V3(-3.25, GY(r), GZ), 0x9b8b72); }
  tag('想像的指標陣列', 'note', -5.6, GY(2) - 0.8, GZ);
  say('把 A 想成 array of arrays', '前面假裝有一個指標陣列');
  await step(tok);                                   // 12:58 *(A + 1) → 508
  show('*(A + 1)', '508', () => glowK(4, GOLD), '其實沒有真的指標，所以還是 508');
  await step(tok);                                   // 13:04 *(A + 1) + 2 → 512
  show('*(A + 1) + 2', '512', () => glowK(6, '#3a3a00'), '508 + 2 × 2 = 512');
  await step(tok);                                   // 13:15 *(*(A + 1) + 2) → 25
  relabel(grid[6], 25); relabel(g.byK(6), 25);
  show('*(*(A + 1) + 2)', '25', () => glowK(6, GOLD), '再取一次值');
  await step(tok);                                   // 13:24 = A[i][j]
  show('*(*(A + i) + j) = A[i][j]', '任一格', () => {}, '和 double pointer 一樣');
  await step(tok);                                   // 13:32 **A → 10
  relabel(grid[0], 10); relabel(g.byK(0), 10);
  show('**A', '10', () => glowK(0, GOLD), '= A[0][0]');
  await step(tok);                                   // 13:43 A[1] = *(A + 1) → 508
  show('A[1] = *(A + 1)', '508', () => glowK(4, GOLD), 'row 1 的起點');
  await step(tok);                                   // 14:02 A[1] + 2 → 512
  show('A[1] + 2', '512', () => glowK(6, '#3a3a00'), '508 + 2 × 2');
  await step(tok);                                   // 14:11 *(A[1] + 2) → 25
  show('*(A[1] + 2)', '25', () => glowK(6, GOLD), '取值 = A[1][2]');
  void A; void ph;
}

// ─── uMGwjNuidZU：指標的算術運算 ───
function arithBase(hideAddr) {
  fresh([0, 6, 13], [0, 1.6, 0.6]);
  const m = memRow(5, -4, 2, 0, 100, { hideAddr });
  const vals = [5, 8, '', '', ''];
  const vs = vals.map((v, i) => (v === '' ? null : cube(v, BLUE, [1.2, 0.7, 1.0], m.xs[i], 0.55, 0)));
  tag('int A[5]', 'ptr alt', -6, 0.2, 0);
  return { m, vs };
}
async function scPtrArith(tok) {
  const op = P().op || 'incdec';
  if (op === 'setup') {
    fresh([0, 6, 13], [0, 1.6, 0.6]);
    say('指標的算術運算', '先準備一個陣列當例子');
    await step(tok);                                 // 0:16 an array with elements, indices, addresses
    const { m } = arithBase(true);
    const ex = tag('', 'ptr alt', 0, 4.6, 0);
    say('一個 int 陣列：有值、有索引');
    await step(tok);                                 // 0:31 integer is two bytes: 100, 102 …
    m.at.forEach((a) => showL(a, true));
    say('int 佔 2 bytes', '位址 100、102、104、106、108');
    await step(tok);                                 // 1:00 two pointers P and Q
    say('拿兩個指標：p 和 q');
    await step(tok);                                 // 1:10 p = &A[0] → 100
    txt(ex, 'int *p = &A[0];');
    ptrMark('p = 100', 'ptr', m.xs, 0, 0);
    say('p = &A[0]：p 存 100');
    await step(tok);                                 // 1:20 q = &A[3] → 106
    txt(ex, 'int *q = &A[3];');
    ptrMark('q = 106', 'ptr alt', m.xs, 0, 3, true);
    say('q = &A[3]：q 存 106', '100 + 3 × 2 = 106');
    await step(tok);                                 // 1:29 can also be written p = A
    txt(ex, 'p = &A[0]　或　p = A');
    say('p = &A[0] 也能寫成 p = A', '陣列名就是起始位址');
    await step(tok);                                 // 1:38 even p = &A: all three same
    txt(ex, 'p = &A[0]　p = A　p = &A');
    say('甚至 p = &A：三種都得到 100', '補充：&A 型別是 int (*)[5]，嚴格要轉型');
    return;
  }
  const { m } = arithBase(false);
  const ex = tag('', 'ptr alt', 0, 4.6, 0);
  const p = ptrMark('p = 100', 'ptr', m.xs, 0, 0);
  const q = ptrMark('q = 106', 'ptr alt', m.xs, 0, 3, true);
  say('p 指 A[0]（100），q 指 A[3]（106）', 'int 每格 2 bytes');
  if (op === 'incdec') {
    await step(tok);                                 // 1:49 pointer increment: p++
    txt(ex, 'p++;');
    say('第一種：遞增 p++');
    await step(tok);                                 // 1:59 move to next element: +2
    await p.slide(tok, 1); txt(p.l, 'p = 102');
    say('p++：移到下一個元素', '不是 +1 byte，是 + sizeof(int) = 2');
    await step(tok);                                 // 2:39 float pointer: +4 bytes
    say('如果 p 是 float *，p++ 會 +4', '移動量 = 指向的型態大小');
    await step(tok);                                 // 2:54 pointer decrement: q--
    txt(ex, 'q--;');
    say('第二種：遞減 q--');
    await step(tok);                                 // 3:02 q from 106 to 104
    await q.slide(tok, 2); txt(q.l, 'q = 104');
    say('q 從 106 移到 104', '減 2 bytes');
    await step(tok);                                 // 3:19 move to the previous element
    say('q--：移到前一個元素');
  } else if (op === 'const') {
    await step(tok);                                 // 3:26 constant addition
    txt(ex, 'p = p + 2;');
    say('加一個常數：p + 2');
    await step(tok);                                 // 3:32 move by two elements forward
    say('往前移 2 個元素', '不是 2 個 byte');
    await step(tok);                                 // 3:38 p at 100 → 104
    await p.slide(tok, 2, 1000); txt(p.l, 'p = 104');
    say('100 + 2 × 2 = 104');
    await step(tok);                                 // 3:56 constant subtraction
    txt(ex, 'q = q − 2;');
    say('減一個常數：q − 2');
    await step(tok);                                 // 4:01 move backward by two elements
    say('往回移 2 個元素');
    await step(tok);                                 // 4:09 q points on 102
    await q.slide(tok, 1, 1000); txt(q.l, 'q = 102');
    say('106 − 2 × 2 = 102');
  } else if (op === 'sub') {
    await step(tok);                                 // 4:20 subtracting two pointers
    txt(ex, 'q − p');
    say('兩個指標相減');
    await step(tok);                                 // 4:31 p, q at 100 and 106
    glow(m.tiles[0], GOLD); glow(m.tiles[3], GOLD);
    say('p 在 100，q 在 106');
    await step(tok);                                 // 4:37 106 − 100 = 6
    txt(ex, 'q − p = 106 − 100 = 6 ?');
    say('106 − 100 = 6', '這個數字本身沒有意義');
    await step(tok);                                 // 4:50 six bytes away
    say('它們相隔 6 個 bytes');
    await step(tok);                                 // 4:56 divide by 2 → 3
    txt(ex, 'q − p = (106 − 100) / 2 = 3');
    say('除以 int 的大小 2', '得到 3');
    await step(tok);                                 // 5:04 first, second, third element
    glow(m.tiles[3]);
    for (let i = 0; i < 3; i++) { glow(m.tiles[i], GREEN); await beat(tok, 400); }
    say('中間的元素：第 1、2、3 個');
    await step(tok);                                 // 5:11 q is three elements away from p
    say('q − p = 3：相隔 3 個元素', '相減得到的是「元素個數」');
  } else {
    await step(tok);                                 // 5:37 only these are allowed
    const ok = code(['p++', 'p--', 'p + k', 'p − k', 'q − p'], -6.2, 4.4, 0.5, 2.4);
    say('允許的只有這 5 種', '遞增、遞減、加常數、減常數、兩指標相減');
    const bad = [];
    const mk = (s, i) => { bad.push(cube(s, '#c0504d', [1.6, 0.7, 1.0], -1 + i * 2.2, 2.6, 2.2, 2)); };
    await step(tok);                                 // 5:53 cannot add two pointers
    mk('p + q', 0);
    say('不能兩個指標相加');
    await step(tok);                                 // 5:57 cannot multiply two pointers
    mk('p × q', 1);
    say('不能兩個指標相乘');
    await step(tok);                                 // 6:00 cannot multiply a constant with a pointer
    mk('p × 2', 2);
    say('也不能拿常數乘指標');
    await step(tok);                                 // 6:03 they don't have any meaning
    for (const b of bad) { fly(b); await beat(tok, 300); }
    say('這些運算沒有意義', '所以不允許');
    await step(tok);                                 // 6:07 p++ makes sense: next element
    ok.hl(0);
    await p.slide(tok, 1); txt(p.l, 'p = 102');
    say('p++ 有意義：移到下一個元素', 'p-- 就是移到前一個');
    await step(tok);                                 // 6:23 only these arithmetic operations
    ok.hl(-1);
    say('記住：指標只有這幾種算術運算');
  }
}
async function scPtrUnary(tok) {
  const { m, vs } = arithBase(false);
  const ex = tag('', 'ptr alt', 0, 4.6, 0);
  const rd = tag('', 'ptr', 4.4, 2.4, 2.4);
  let p = null;
  const reset = () => { p.place(0); relabel(vs[0], 5); glow(vs[0]); glow(vs[1]); txt(rd, ''); };
  say('特別的寫法：* 和 ++ 放在一起');
  await step(tok);                                   // 6:35 p on the first integer (5)
  p = ptrMark('p', 'ptr', m.xs, 0, 0);
  say('p 指向第一個整數：100，值 5');
  await step(tok);                                   // 6:42 *++p
  txt(ex, '*++p');
  say('*++p 是什麼意思？');
  await step(tok);                                   // 6:50 unary: read right to left
  txt(rd, '① ++p　② *');
  say('兩個都是一元運算子：從右往左讀', '先 ++，再 *');
  await step(tok);                                   // 6:56 p first moves to 102
  await p.slide(tok, 1);
  say('p 先移到 102');
  await step(tok);                                   // 7:03 then take the value 8
  glow(vs[1], GOLD); txt(rd, '結果 8');
  say('再取值：得到 8', 'p 停在 102');
  await step(tok);                                   // 7:10 ++*p
  reset(); txt(ex, '++*p');
  say('下一個：++*p');
  await step(tok);                                   // 7:23 first take the data: 5
  glow(vs[0], GOLD); txt(rd, '① *p = 5');
  say('先取資料：5');
  await step(tok);                                   // 7:27 ++ → 6
  relabel(vs[0], 6); txt(rd, '結果 6');
  say('資料 +1：5 變成 6', 'p 不動');
  await step(tok);                                   // 7:30 *p++ (very interesting)
  reset(); txt(ex, '*p++');
  say('很有趣的一個：*p++');
  await step(tok);                                   // 7:53 ++ is post increment: after the expression
  txt(rd, '++ 等式子結束才做');
  say('先看到 ++，但它是「後置」', '要等整個式子結束才做');
  await step(tok);                                   // 8:03 * is performed first: reads 5
  glow(vs[0], GOLD); txt(rd, '結果 5');
  say('所以先做 *p：讀到 5');
  await step(tok);                                   // 8:18 then p moves to the next integer
  await p.slide(tok, 1);
  say('之後 p 才移到下一個整數', '結果是 5，p 在 102');
  await step(tok);                                   // 8:44 ++*p: take data, increment data
  reset();
  kill(ex);
  const sm = code(['++*p   ：讀資料 → 資料 +1', '*++p   ：移指標 → 讀資料', '*p++   ：讀資料 → 移指標', '(*p)++ ：資料 +1（同 ++*p）'], -1.2, 5.0, 0.5, 0);
  sm.ls.forEach((l, i) => { if (i) showL(l, false); });
  sm.hl(0);
  say('整理：++*p', '讀資料，再把資料加 1');
  await step(tok);                                   // 9:00 *++p: move pointer, read data
  showL(sm.ls[1], true); sm.hl(1);
  say('*++p', '先移指標，再讀資料');
  await step(tok);                                   // 9:25 *p++: read data, then move p
  showL(sm.ls[2], true); sm.hl(2);
  say('*p++', '先讀資料，再移指標');
  await step(tok);                                   // 9:45 (*p)++ increments the data
  showL(sm.ls[3], true); sm.hl(3);
  glow(vs[0], GOLD);
  await beat(tok, 600);
  relabel(vs[0], 6); txt(rd, '資料 5 → 6');
  say('(*p)++：括號讓 ++ 作用在資料上', '和 ++*p 一樣是改資料');
  await step(tok);                                   // 10:12 *p++ moves pointer, (*p)++ increments data
  sm.hl(-1);
  cls(sm.ls[2], 'ptr'); cls(sm.ls[3], 'ptr alt');
  say('*p++ 移指標；(*p)++ 改資料', '只差一個括號，意思完全不同');
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
  }

  // ═══ contlin.js ═══
  {
// ─── contlin：USLvdBuxTno（台大林軒田 DSA：Container 整合課——Array／List 家族、Extendable Array、Iterator） ───
// cued scenes: each `await step(tok)` waits until the lecturer says that sentence; beats are motion only.
const step = (tok) => ctx.step(tok);
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
  await step(tok);                                   // 32:51 所有 data structure 都是某種 container
  const box = ghostBox(C_P, 4.4, 2.4, 3.0); box.position.set(0, 1.2, -0.9);
  tag('container（容器）', 'ptr', 0, 2.9, -0.9);
  say('所有 data structure 都是某種容器', '拿來「裝 data」的東西');
  const pos = [[-1.1, -1.6], [1.1, -1.6], [-1.1, -0.2], [1.1, -0.2]];
  await step(tok);                                   // 33:14 可以裝 integer、double
  cube('int 7', C_B, [1.9, 0.6, 1.0], pos[0][0], 0.3, pos[0][1], 5);
  cube('double 3.14', C_G, [1.9, 0.6, 1.0], pos[1][0], 0.3, pos[1][1], 5);
  say('同一個容器：可以裝 integer，也可以裝 double', 'general：不寫死要裝什麼型別');
  await step(tok);                                   // 33:21 自己定義的 structure：複數
  cube('complex 1+2i', C_O, [1.9, 0.6, 1.0], pos[2][0], 0.3, pos[2][1], 5);
  say('也能裝自己定義的 structure', '例如複數');
  await step(tok);                                   // 33:28 polynomial
  cube('polynomial', C_P, [1.9, 0.6, 1.0], pos[3][0], 0.3, pos[3][1], 5);
  say('或是 polynomial……', '什麼都能裝');
  await step(tok);                                   // 33:34 每個容器有特別的性質
  [['Array', -5.1], ['Linked List', -1.7], ['Stack', 1.7], ['Queue', 5.1]].forEach(([n, x], i) => {
    cube(n, [C_B, C_G, C_O, C_P][i], [2.6, 0.6, 1.1], x, 0.3, 3.0, 4 + i * 0.4);
  });
  say('學過的這些，全都可以看成容器', '每種容器有自己特別的性質');
  await step(tok);                                   // 33:48 不同需求 → 不一樣的容器
  say('需求不同 → 衍生出不一樣的容器', '');
  await step(tok);                                   // 34:07 再抽象化一點
  say('今天：把共同的功能抽出來', 'abstraction：用不一樣的視角看這些容器');
}]);

// ════════ 34:35 Dense array：①②③ ════════
FRAG.push(['contlin-array-access', 'Dense array：Θ(n) 儲存、index access、sequential access', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.5, 0.5]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  await step(tok);                                   // 34:39 C/C++ 的 integer array
  const A = arrRow(V, 10, 0, { drop: 4 });
  tag('A', 'ptr', A.xs[0] - 1.1, 0.9, 0);
  say('出發點：C／C++ 的 integer array', '');
  await step(tok);                                   // 34:55 dense（相對於 sparse）
  tag('dense array：每一格都排滿', 'ptr alt', 0, 2.2, 0);
  say('叫它 dense array', '相對於之後的 sparse array');
  await step(tok);                                   // 35:28 ① storage
  say('① storage：要放 n 個就配 n 格', 'Θ(n)');
  await step(tok);                                   // 35:41 幾乎沒有 overhead
  say('除了要存的東西，幾乎沒有 overhead', '要放多少就 allocate 多少');
  await step(tok);                                   // 35:57 ② indexed access
  const cur = tag('i = 6', 'ptr alt', A.xs[6], 1.7, 0);
  glow(A.cs[6], GOLD);
  say('② indexed（random）access：給編號就拿', 'A[6]');
  await step(tok);                                   // 36:24 取用包括 read、write
  relabel(A.cs[6], 42);
  say('取用包括 read，也包括 write', 'A[6] = 42');
  await step(tok);                                   // 36:43 index 轉成 address，很快
  say('fast：index 直接算成 address', '位址 = A + 6 × sizeof(int) → O(1)');
  await step(tok);                                   // 37:05 用 for 迴圈跑過它
  glow(A.cs[6], null); kill(cur);
  const p = tag('i', 'ptr alt', A.xs[0], 1.7, 0);
  say('也常用 for 迴圈一個一個跑過', 'for (i = 0; i < n; i++) …');
  for (let i = 0; i < 10; i++) { p.position.x = A.xs[i]; glow(A.cs[i], GOLD); await beat(tok, 200); glow(A.cs[i], null); }
  await step(tok);                                   // 37:12 iterative／sequential access
  say('③ iterative（sequential）access', '用 pointer 或 index 一路走過去');
  await step(tok);                                   // 37:48 像冰箱
  say('像把冰箱每一格都打開看一次', '');
  await step(tok);                                   // 37:59 不知道放哪，但每格都看
  A.cs.forEach((m) => glow(m, GOLD));
  say('不必知道放哪一格，但每個都要看到', '很多 container 都需要 sequential access');
}]);

// ════════ 38:20 Dense array：④⑤ ════════
FRAG.push(['contlin-array-shift', 'Dense array：長度固定、插入刪除要搬人', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  await step(tok);                                   // 38:26 ④ max length 固定
  let A = arrRow(V, 10, 0, { drop: 4 });
  say('④ max length 固定：訂幾個櫃子就幾個', 'int A[10]');
  await step(tok);                                   // 38:34 不夠用要另想辦法
  const extra = cube(11, C_O, [0.88, 0.7, 0.85], 6.05, 0.4, 0, 4);
  await beat(tok, 700);
  tint(extra, '#c0392b');
  say('第 11 個放不進去', '要變大得另想辦法（等一下會講）');
  await step(tok);                                   // 39:04 維持 dense、每格放滿
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  A = arrRow(V, 11, 0, { dx: 1.05 });
  say('⑤ 維持 dense：前面要排得滿滿的', '這時候要插入或拿出來……');
  await step(tok);                                   // 39:43 10 個人往後推
  const cnt = tag('搬了 0 次', 'ptr alt', 0, 2.3, 0);
  for (let i = 9; i >= 0; i--) { move(A.cs[i], A.xs[i + 1], 0.4, 0); txt(cnt, '搬了 ' + (10 - i) + ' 次'); await beat(tok, 180); }
  cube(99, C_O, [0.84, 0.7, 0.85], A.xs[0], 0.4, 0, 4);
  say('插到第 0 格：10 個人往後推', '花 10 份力氣 → O(n)');
  await step(tok);                                   // 39:51 拿掉第 1 個，9 個往前
  fresh([0, 8, 12], [0, 0.4, 0.5]);
  A = arrRow(V, 11, 0, { dx: 1.05 });
  const cnt2 = tag('搬了 0 次', 'ptr alt', 0, 2.3, 0);
  fly(A.cs[0], V3(0, 8, 4));
  await beat(tok, 300);
  for (let i = 1; i < 10; i++) { move(A.cs[i], A.xs[i - 1], 0.4, 0); txt(cnt2, '搬了 ' + i + ' 次'); await beat(tok, 180); }
  say('拿掉第 1 個：後面 9 個往前補', 'removal 也是 O(n)');
  await step(tok);                                   // 40:05 著眼點：fast random access
  say('array 的著眼點：fast random access', '②才是它的強項');
  await step(tok);                                   // 40:29 推擠：又慢又容易寫錯
  say('每次插入、刪除都要推擠', '又花力氣、又容易寫錯');
  await step(tok);                                   // 41:04 想要快一點的 insertion／removal
  say('能不能更快一點？', '目標：faster insertion／removal');
}]);

// ════════ 41:30 Doubly linked list ════════
FRAG.push(['contlin-dll', 'Doubly linked list：O(1) 插入刪除、長度可變', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.6]);
  const xs = [-3.9, -1.3, 1.3, 3.9], vals = [3, 7, 1, 9], z = -0.9;
  await step(tok);                                   // 41:30 新需求：知道位置就 constant time 插入刪除
  tag('需求 ⑤：知道位置 → O(1) 放進去、拿出來', 'idx', 0, 0, 2.6);
  say('新需求：更快的 insertion／removal', '知道放哪裡，其他東西通通不動');
  await step(tok);                                   // 42:07 dynamic max length
  tag('需求 ④：dynamic max length', 'idx', 0, 0, 3.3);
  say('還要 dynamic max length', '像聚寶盆：記憶體夠就一直裝');
  await step(tok);                                   // 42:47 答案：doubly linked list
  const ns = vals.map((v, i) => dn(v, xs[i], z, null, 4 + i * 0.3));
  await beat(tok, 900);
  const ls = dlinks(xs, z);
  tag('head', 'ptr', xs[0], 1.4, z);
  say('答案：doubly linked list', '');
  await step(tok);                                   // 43:00 previous、next 兩張小紙條
  ns.forEach((g) => { glow(g.children[0], GOLD); glow(g.children[2], GOLD); });
  say('每個 node 有兩張小紙條：prev、next', '');
  await step(tok);                                   // 43:06 把新東西連進去
  ns.forEach((g) => { glow(g.children[0], null); glow(g.children[2], null); });
  const nn = dn(5, 0, 1.9, C_O, 4);
  await beat(tok, 900);
  kill(ls[2]); kill(ls[3]);
  arrow(V3(xs[1] + 0.88, 0.55, z), V3(-0.88, 0.55, 1.9));
  arrow(V3(0.88, 0.55, 1.9), V3(xs[2] - 0.88, 0.55, z));
  arrow(V3(xs[2] - 0.88, 0.15, z), V3(0.88, 0.15, 1.9), A_GOLD);
  arrow(V3(-0.88, 0.15, 1.9), V3(xs[1] + 0.88, 0.15, z), A_GOLD);
  say('5 插在 7 和 1 之間：只改 4 張紙條', '要知道前面是誰、後面是誰 → O(1)');
  await step(tok);                                   // 43:22 要用時才放一個 → dynamic
  glow(nn.userData.data, GOLD);
  say('要用時才配一個 node', '所以得到 dynamic max length');
  await step(tok);                                   // 43:36 Θ(n) storage，但有 overhead
  glow(nn.userData.data, null);
  [...ns, nn].forEach((g) => { glow(g.children[0], GOLD); glow(g.children[2], GOLD); });
  say('① storage 還是 Θ(n)', '但每個 node 多付兩張紙條的 overhead');
  await step(tok);                                   // 43:59 indexed access 可不可以做？
  [...ns, nn].forEach((g) => { glow(g.children[0], null); glow(g.children[2], null); });
  say('② indexed access 可不可以做？', '硬要也行，但很少這樣用');
  await step(tok);                                   // 44:38 給 index 就從頭走
  const path = [[xs[0], z, ns[0]], [xs[1], z, ns[1]], [0, 1.9, nn], [xs[2], z, ns[2]]];
  const p = tag('p', 'ptr alt', xs[0], 1.9, z);
  for (const [x, zz, g] of path) { p.position.set(x, 1.9, zz); glow(g.userData.data, GOLD); await beat(tok, 500); glow(g.userData.data, null); }
  say('要第 k 個：只能從頭 1、2、3…走 k 步', 'index 100 就走 100 步');
  await step(tok);                                   // 44:53 iterative access by pointer
  say('③ iterative access by pointer', 'p = p->next，一步一步走');
  await step(tok);                                   // 45:18 dynamic + constant insertion／removal
  say('④ dynamic max length', '⑤ O(1) insertion／removal');
  await step(tok);                                   // 45:59 在意的優點不一樣
  say('和 array 的差別：在意的優點不一樣', '要 ④⑤，放棄 array 的 ②');
}]);

// ════════ 46:22 Singly linked list ════════
FRAG.push(['contlin-sll', 'Singly linked list：少一張紙條，removal 變麻煩', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.4]);
  await step(tok);                                   // 46:22 只在乎 insertion
  dn('data', -3.2, -3.0, '#9a9080', 3);
  tag('doubly：prev + data + next', 'idx', -3.2, 0, -2.1);
  say('不在乎 removal，只在乎 insertion', '');
  await step(tok);                                   // 46:34 → singly linked list
  const cmp = sn('data', 2.4, -3.0, '#9a9080', 3);
  tag('singly：data + next', 'idx', 2.7, 0, -2.1);
  const xs = [-4.5, -1.5, 1.5, 4.5], vals = [3, 7, 1, 9], z = 0.4;
  const ns = vals.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  const ls = [0, 1, 2].map((i) => sl(xs[i], z, xs[i + 1], z));
  tag('NULL', 'idx', xs[3] + 1.6, 0.35, z); tag('head', 'ptr', xs[0], 1.4, z);
  say('→ singly linked list', '每個 node 只有一張 next 紙條');
  await step(tok);                                   // 46:56 insertion 還 ok
  const pt = tag('p', 'ptr alt', xs[1], 1.5, z);
  sn(5, 0, 2.8, C_O, 4);
  await beat(tok, 900);
  kill(ls[1]);
  sl(xs[1], z, 0, 2.8); const a51 = sl(0, 2.8, xs[2], z);
  say('insert after p：一樣 O(1)', 'new->next = p->next;  p->next = new;');
  await step(tok);                                   // 46:59 removal 比較麻煩
  pt.position.x = xs[2]; glow(ns[2].userData.data, RED);
  say('removal 比較麻煩：想刪掉 1', '手上的指標只指著 1');
  await step(tok);                                   // 47:02 要更新前一個
  const q = tag('q', 'ptr', xs[0], 2.1, z);
  for (const [x, zz] of [[xs[0], z], [xs[1], z], [0, 2.8]]) { q.position.set(x, 2.1, zz); await beat(tok, 500); }
  kill(a51); kill(ls[2]); kill(pt);
  sl(0, 2.8, xs[3], z);
  fly(ns[2], V3(0, 8, -3));
  say('要改「前一個」的 next：只好從 head 再找一次', '');
  await step(tok);                                   // 47:11 with less overheads
  glow(cmp.userData.data, GOLD);
  say('好處：with less overhead', '每個 node 少一張紙條（storage 仍是 Θ(n)）');
  await step(tok);                                   // 47:38 只剩 constant insertion
  glow(cmp.userData.data, null);
  say('trade-off：只剩 constant insertion', '其他特性差不多');
  await step(tok);                                   // 47:56 換一個方向織布
  say('講的順序跟當初不一樣', '像織布換個方向織，理解會更完整');
}]);

// ════════ 49:33 Template：any type ════════
FRAG.push(['contlin-template', 'Template：同一份 code 裝任何型別', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.2, 0]);
  const c = code(['template <class T>', 'class Array {', '  T data[N];', '  T& at(int i);', '};'], -3.6, 3.8);
  await step(tok);                                   // 49:33 不一定要 integer：any type
  say('不一定要裝 integer', '可以是 any type');
  await step(tok);                                   // 49:39 C++ template
  c.hl(0);
  say('C++ 用 template 做到', 'data structure 先不寫定要裝什麼');
  await step(tok);                                   // 50:01 integer、double、whatever
  const ts = [['Array<int>', C_B], ['Array<double>', C_G], ['Array<Complex>', C_O]];
  for (let i = 0; i < 3; i++) {
    const m = cube(ts[i][0], ts[i][1], [2.8, 0.6, 1.0], -3.6, 0.3, 0.6);
    move(m, 2.6, 0.3, -2.2 + i * 2.2);
    await beat(tok, 400);
  }
  say('同一份 code：裝 integer、double、自訂的 structure', '');
  await step(tok);                                   // 50:15 compiler 複製、換型別
  c.hl(-1);
  say('機制：compiler 把你的 code 複製一份、換上型別', '');
}]);

// ════════ 82:51 為什麼要抽象化 1：節省實作力氣 ════════
FRAG.push(['contlin-template2', '抽象化理由一：節省 implementation efforts', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.2, 0]);
  const c = code(['template <class T>', 'class Array {', '  T data[N];', '  T& at(int i);', '};'], -3.6, 3.8);
  await step(tok);                                   // 82:51 節省 implementation efforts
  say('理由一：節省 implementation efforts', '');
  await step(tok);                                   // 83:01 int、double、complex array
  const ts = [['Array<int>', C_B, '4 bytes'], ['Array<double>', C_G, '8 bytes'], ['Array<Complex>', C_O, '16 bytes']];
  const ms = [];
  for (let i = 0; i < 3; i++) {
    const m = cube(ts[i][0], ts[i][1], [2.8, 0.6, 1.0], -3.6, 0.3, 0.6); ms.push(m);
    move(m, 2.6, 0.3, -2.2 + i * 2.2);
    await beat(tok, 400);
  }
  say('integer、double、complex array', '寫三次？其實是一樣的事情');
  await step(tok);                                   // 83:07 essence：index → address
  c.hl(3);
  say('essence 都一樣：根據 index 很快算出 address', '');
  await step(tok);                                   // 83:15 4、8 還是 2 bytes 不重要
  ts.forEach((t, i) => tag(t[2], 'idx', 5.1, 0, -2.2 + i * 2.2));
  say('裡面一格 4、8 還是 16 bytes', '對你來說不太重要');
  await step(tok);                                   // 83:20 type abstraction
  c.hl(0);
  say('template 做的是 type abstraction', '把能裝的型別放寬');
  await step(tok);                                   // 83:46 寫一次，用在很多地方
  c.hl(-1); ms.forEach((m) => glow(m, GOLD));
  say('寫一次（想一次）', '就能用在很多不同的地方');
}]);

// ════════ 50:35 Array + restricted access → Stack ════════
FRAG.push(['contlin-array-stack', 'Array 加上 restricted access → Stack', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const vals = [4, 8, 2];
  let A, items, top;
  const refresh = () => { items.forEach((m, i) => tint(m, i === items.length - 1 ? colorFor(vals[i]) : C_X)); top.position.x = A.xs[items.length - 1]; };
  await step(tok);                                   // 50:35 array 可以輕鬆 random access
  A = arrRow([4, 8, 2], 8, 0, { drop: 4 });
  items = A.cs.slice(0, 3);
  items.forEach((m) => glow(m, GOLD));
  say('array 本來可以用任何 index 存取', 'A[0]、A[1]、A[2]… 都能拿');
  await step(tok);                                   // 50:51 只 access 固定的地方：最尾巴
  items.forEach((m) => glow(m, null));
  top = tag('top', 'ptr alt', A.xs[2], 1.7, 0);
  refresh();
  say('限制：只能碰最尾巴那一格', 'restricted access');
  await step(tok);                                   // 51:02 只在最尾巴放東西
  for (const v of [6, 5]) {
    const i = items.length;
    items.push(cube(v, colorFor(v), [0.88, 0.7, 0.85], A.xs[i], 0.4, 0, 4)); vals.push(v);
    refresh();
    await beat(tok, 600);
  }
  say('只在最尾巴放：push 6、push 5', 'top = 4');
  await step(tok);                                   // 51:13 只在最尾巴拿
  const m = items.pop(); const v = vals.pop();
  fly(m, V3(0, 8, 4)); refresh();
  say('只在最尾巴拿：pop 拿走最後放的 ' + v, 'top = 3');
  await step(tok);                                   // 51:18 得到 stack：first in last out
  say('這就得到 stack', 'first in, last out（= LIFO）');
  await step(tok);                                   // 51:38 stack 常見的實作
  say('這是 stack 很常見的實作', 'array 有 index，但只讓你用最後一個號碼');
  await step(tok);                                   // 51:55 array 被限制成 stack
  glow(items[items.length - 1], GOLD);
  say('array 被限制（退化）成一個 stack', '');
}]);

// ════════ 52:28 Circular list → Queue ════════
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
  await step(tok);                                   // 52:28 circular list
  for (const v of [1, 2, 3, 4, 5]) {
    const [x, z] = pos(ms.length, 5);
    ms.push(cube(v, colorFor(v), [1.0, 0.8, 1.0], x, 0.4, z, 4)); vals.push(v);
    await beat(tok, 250);
  }
  layout(false);
  say('circular list：最後一個接回第一個', 'linked list 的變形');
  await step(tok);                                   // 52:49 circular access：循環播放
  const cur = tag('●', 'ptr alt', 0, 1.3, 0);
  say('iterative access 變成 circular access', '像播放器的循環播放：一直繞');
  for (let k = 0; k < 10; k++) { const [x, z] = pos(k % 5, 5); cur.position.set(x, 1.3, z); glow(ms[k % 5], GOLD); await beat(tok, 200); glow(ms[k % 5], null); }
  kill(cur);
  await step(tok);                                   // 53:15 加上 restricted access
  layout(true); showL(rear, true); showL(front, true);
  say('再加 restricted access：只在游標處放、拿', 'front = rear->next');
  await step(tok);                                   // 53:31 從游標前面拿走
  { const m = ms.shift(), v = vals.shift(); fly(m, V3(0, 8, -4)); layout(true); say('從游標的前面拿走一個：' + v, 'dequeue'); }
  await step(tok);                                   // 53:35 從游標後面放進去
  { const n = ms.length + 1, [x, z] = pos(n - 1, n); ms.push(cube(6, colorFor(6), [1.0, 0.8, 1.0], x, 0.4, z, 4)); vals.push(6); layout(true); say('從游標的後面放進去一個：6', 'enqueue，rear 移過去'); }
  await step(tok);                                   // 53:39 得到 queue：first in first out
  say('就得到 queue', 'first in, first out（FIFO）');
  await step(tok);                                   // 53:47 不是只有 linked list 可以用
  say('circular access 不是只有 linked list 能用', '它是從 iterative access 變化來的');
  await step(tok);                                   // 54:08 array 也行
  say('array 也有 iterative access', '→ circular array 一樣能實作 queue');
}]);

// ════════ 54:43 Sparse array on ordered array ════════
FRAG.push(['contlin-sparse-array', 'Sparse array：用 ordered array 只存 non-zero', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.6]);
  const D = [1, 0, 0, 5, 0, 0, 0, 2, 0, 0];
  let A, nz, lo, hi, mid;
  const P = [[0, 1], [3, 5], [7, 2]], xs = [-4.4, -2.2, 0, 2.2, 4.4];
  await step(tok);                                   // 54:43 從 dense array 出發
  A = arrRow(D, 10, -2.2, { drop: 4 });
  say('從 dense array 出發：每一格都存，連 0 也存', '例：1 + 5x³ + 2x⁷，index = 次方');
  await step(tok);                                   // 54:48 不想全部存 → sparse array
  say('有時候不想把所有東西都存下來', '→ sparse array');
  await step(tok);                                   // 55:04 storage 變成 nnz
  A.cs.forEach((m, i) => { if (!D[i]) fly(m, V3(0, 8, -4)); });
  say('只存 non-zero', 'storage：Θ(n) → Θ(nnz)');
  await step(tok);                                   // 56:00 按 index 排序儲存
  xs.forEach((x, i) => { cell(x, 1.4, 2.0, 1.0); tag('[' + i + ']', 'idx', x, 0, 2.25); });
  nz = [0, 3, 7].map((d, k) => { const m = A.cs[d]; move(m, xs[k], 0.4, 1.4); relabel(m, '(' + P[k][0] + ', ' + P[k][1] + ')'); return m; });
  nz.forEach((m) => m.scale.set(2.0, 1, 1));
  say('照 index（次方）排好存起來', '像以前的 polynomial：(次方, 係數)');
  await step(tok);                                   // 56:29 放在 ordered array
  tag('ordered array', 'ptr', 0, 1.6, 3.2);
  say('放在一個 ordered array 裡', '');
  await step(tok);                                   // 56:41 一樣可以 index access
  say('一樣可以做 index access', '');
  await step(tok);                                   // 56:57 有沒有 x³？係數多少？
  lo = tag('lo', 'ptr', xs[0], 1.3, 1.4); hi = tag('hi', 'ptr', xs[2], 1.3, 1.4);
  say('有沒有 x³ 這一項？係數多少？', '');
  await step(tok);                                   // 57:10 log nnz：binary search
  mid = tag('mid', 'ptr alt', xs[1], 1.9, 1.4); glow(nz[1], GOLD);
  say('binary search：mid 就是 (3, 5)', '最多 O(log nnz)');
  await step(tok);                                   // 57:30 iterative access
  glow(nz[1], null); kill(lo); kill(hi); kill(mid);
  for (const m of nz) { glow(m, GOLD); await beat(tok, 350); glow(m, null); }
  say('iterative access：走過所有 non-zero', '');
  await step(tok);                                   // 58:24 ④ 某種程度的 fixed max length
  say('④ 底下是 array：某種程度的 fixed max length', '');
  await step(tok);                                   // 58:30 ⑤ insertion／removal 要 nnz
  move(nz[2], xs[3], 0.4, 1.4);
  await beat(tok, 600);
  const nm = cube('(5, 4)', C_O, [1.6, 0.7, 0.85], xs[2], 0.4, 1.4, 4);
  glow(nm, GOLD);
  say('⑤ 加入 4x⁵：後面的項要往後搬', 'insertion／removal：O(nnz)');
}]);

// ════════ 58:55 Sparse array on ordered linked list ════════
FRAG.push(['contlin-sparse-list', 'Sparse array：改用 ordered linked list', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.5]);
  const xs = [-4.2, -0.6, 3.0], P = ['(0,1)', '(3,5)', '(7,2)'], z = -0.6;
  let ns, ls, p;
  await step(tok);                                   // 58:57 ordered linked list 版本
  ns = P.map((t, i) => sn(t, xs[i], z, [C_B, C_G, C_P][i], 3 + i * 0.3));
  ls = [sl(xs[0], z, xs[1], z), sl(xs[1], z, xs[2], z)];
  tag('NULL', 'idx', xs[2] + 1.7, 0.35, z); tag('head', 'ptr', xs[0], 1.4, z);
  say('課堂上用的版本：ordered linked list', '');
  await step(tok);                                   // 59:12 一樣享有 nnz storage
  say('一樣只存 non-zero', 'storage：Θ(nnz)');
  await step(tok);                                   // 59:20 沒辦法 binary search
  p = tag('p', 'ptr alt', xs[0], 1.9, z);
  say('找 x³：沒辦法直接跳到中間', '不能 binary search');
  await step(tok);                                   // 59:30 sequential search
  for (let i = 0; i < 2; i++) { p.position.x = xs[i]; glow(ns[i].userData.data, GOLD); await beat(tok, 600); glow(ns[i].userData.data, null); }
  glow(ns[1].userData.data, GOLD);
  say('只能 sequential search', '一個一個往後走');
  await step(tok);                                   // 59:46 nnz，而不是 log nnz
  say('要花 O(nnz)', '而不是 O(log nnz)');
  await step(tok);                                   // 59:53 insertion／removal 可以 constant
  glow(ns[1].userData.data, null);
  sn('(5,4)', 1.2, 2.4, C_O, 4);
  await beat(tok, 900);
  kill(ls[1]);
  sl(xs[1], z, 1.2, 2.4); sl(1.2, 2.4, xs[2], z);
  say('加入 4x⁵：不用搬其他資料', '已知位置 → insertion／removal：O(1)');
  await step(tok);                                   // 60:00 implementation trade-off
  tag('ordered array：search O(log nnz)、insert O(nnz)', 'idx', 0, 0, -3.0);
  tag('ordered list：search O(nnz)、insert O(1)', 'idx', 0, 0, -2.3);
  say('做的事一樣，實作不同', 'implementation trade-off');
  await step(tok);                                   // 60:30 自己整合：好處和壞處
  say('要能自己整合：換一種實作', '會有哪些好處、哪些壞處？');
}]);

// ════════ 60:54 Deque ════════
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
  function push(v, atHead) {
    const n = ms.length + 1, x = atHead ? X(0, n) : X(n - 1, n);
    const m = cube(v, colorFor(v), [1.0, 0.8, 1.0], x, 0.4, 0, 4);
    if (atHead) { ms.unshift(m); vals.unshift(v); } else { ms.push(m); vals.push(v); }
    layout();
  }
  function pop(atHead) { const m = atHead ? ms.shift() : ms.pop(); atHead ? vals.shift() : vals.pop(); fly(m, V3(atHead ? -4 : 4, 8, 2)); layout(); }
  await step(tok);                                   // 60:54 上次沒講完的 restricted access
  for (const v of [3, 7, 1]) { ms.push(cube(v, colorFor(v), [1.0, 0.8, 1.0], 0, 0.4, 0, 4)); vals.push(v); }
  layout();
  say('補上次沒講完的 restricted access', '底下是 doubly linked list');
  await step(tok);                                   // 61:10 stack：頂端放、拿
  say('stack：在某個頂端放進去、拿出來', 'push、pop');
  await step(tok);                                   // 61:19 queue：一頭一尾
  say('queue：有一個頭、一個尾', '');
  await step(tok);                                   // 61:40 尾巴放、頭拿 = queue
  push(9, false); await beat(tok, 900); pop(true);
  say('尾巴放進去、頭拿出來：queue', 'push at tail，pop at head');
  await step(tok);                                   // 61:46 頭放、頭拿 = stack
  push(5, true); await beat(tok, 900); pop(true);
  say('頭放進去、頭拿出來：stack', 'push at head，pop at head');
  await step(tok);                                   // 62:00 尾巴也能拿
  pop(false);
  say('既然能 push at tail，pop at tail 也做得到', '頭尾完全對稱');
  await step(tok);                                   // 62:08 deque = double-ended queue
  say('全部都有的叫 deque', 'double-ended queue');
  await step(tok);                                   // 62:41 doubly linked list 的 restricted access
  ars.forEach((a) => a.setColor(new THREE.Color(A_GREEN)));
  say('deque 也是一種 restricted access', '最常用 doubly linked list 實作');
  await step(tok);                                   // 63:03 目前沒那麼重要
  say('老師覺得目前沒那麼重要', '多認識一個名詞就好');
  await step(tok);                                   // 63:36 上半學期的基本功
  say('這頁整合了上半學期的基本功', 'array、list、stack、queue 的關係');
}]);

// ════════ 78:48 Abstraction：數字到代數 ════════
FRAG.push(['contlin-abstraction', '抽象化：3+5=8 → 300+500=800 → 3x+5x=8x', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.5, 0]);
  const rows = [[['3', '+', '5', '=', '8'], -2.4, C_B], [['300', '+', '500', '=', '800'], 0, C_G], [['3x', '+', '5x', '=', '8x'], 2.4, C_O]];
  const deck = [];
  async function row(k) {
    const [r, z, col] = rows[k];
    for (let i = 0; i < 5; i++) {
      const isOp = r[i] === '+' || r[i] === '=';
      cube(r[i], isOp ? C_X : col, [isOp ? 0.8 : 1.4, 0.6, 1.0], -3.6 + i * 1.8, 0.3, z, 4 + i * 0.2);
      await beat(tok, 200);
    }
  }
  await step(tok);                                   // 78:48 從 array 到 stack、queue 的完整 picture
  [['Array', -4.8], ['List', -2.4], ['Sparse', 0], ['Stack', 2.4], ['Queue', 4.8]].forEach(([n, x], i) => deck.push(cube(n, [C_B, C_G, C_P, C_O, C_K][i], [2.0, 0.5, 0.9], x, 0.25, -4.4, 3 + i * 0.3)));
  say('從 array、linked list 到 stack、queue', '已經有比較完整的 picture');
  await step(tok);                                   // 79:16 功能上的抽象化
  say('新觀念：對功能做 abstraction（抽象化）', '');
  await step(tok);                                   // 79:51 重點是怎麼運作
  say('重點不是裝什麼資料型態', '而是資料結構怎麼運作');
  await step(tok);                                   // 80:34 生活例子：從數字到代數
  deck.forEach((m) => fly(m, V3(0, 8, -4)));
  say('生活裡的例子：從具體的數字到代數', '');
  await step(tok);                                   // 80:54 數鈔票：單位變 100
  say('小孩先學數 1、2、3…', '數百元鈔票其實一樣，只是單位變成 100');
  await step(tok);                                   // 81:27 3 + 5 = 8
  await row(0);
  say('問他 3 + 5？', '8');
  await step(tok);                                   // 81:31 300 + 500 = 800
  await row(1);
  say('300 + 500？', '同樣的加法，換個單位：800');
  await step(tok);                                   // 81:58 3x + 5x = 8x
  await row(2);
  say('再抽象一點：3x + 5x', '= 8x');
  await step(tok);                                   // 82:06 數字上的抽象化
  say('這就是思考在數字上的抽象化', '越抽象，能用的地方越多');
  await step(tok);                                   // 82:24 表達出它的精神
  say('資料結構也一樣', '要能說出它的 essence（精神）是什麼');
}]);

// ════════ 84:10 Easy change of data structure ════════
FRAG.push(['contlin-swap-ds', '抽象化理由二：功能一樣，實作可以抽換', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const c = code(['insert(id)', 'search(id)', 'for each id …'], -4.3, 3.0, 0.56, -3.0);
  tag('需要的功能', 'ptr', -4.3, 3.7, -3.0);
  const cost = tag('', 'ptr alt', 3.2, 2.6, -3.0);
  const ids = [12, 25, 31, 47];
  let A, n30;
  await step(tok);                                   // 84:10 easy change of data structure
  say('理由二：easy change of data structure', '容易抽換資料結構');
  await step(tok);                                   // 84:27 作業 2：user id 排好存起來
  say('例：作業 2 把 user id 排一排、存起來', '可以用很多種 container');
  await step(tok);                                   // 84:44 array 或 linked list
  A = arrRow(ids, 5, 0.8, { dx: 1.4, drop: 4 });
  txt(cost, 'Array：insert O(n)、search O(log n)');
  say('可以用 array，也可以用 linked list', '');
  await step(tok);                                   // 84:53 沒有通通都好：trade-off
  say('沒有通通都好的資料結構', '一定有 trade-off');
  await step(tok);                                   // 85:14 insertion 多 vs index access 多
  say('insertion 多 → linked list 有好處', 'index access 多 → array 有好處');
  await step(tok);                                   // 85:38 先寫一個版本
  c.hl(0);
  move(A.cs[3], A.xs[4], 0.4, 0.8);
  await beat(tok, 600);
  n30 = cube(30, C_O, [1.1, 0.7, 0.85], A.xs[3], 0.4, 0.8, 4);
  await beat(tok, 700);
  c.hl(1); glow(A.cs[2], GOLD);
  say('常常事先不知道：先寫一個 array 版本', 'insert 30 要往後搬；search 可以 binary search');
  await step(tok);                                   // 85:45 再換另一個版本、交叉測試
  glow(A.cs[2], null); c.hl(-1);
  [...A.cs.slice(0, 4), n30].forEach((m) => fly(m, V3(0, 8, 5))); A.tiles.forEach(kill);
  await beat(tok, 500);
  txt(cost, 'Linked list：insert O(1)、search O(n)');
  const xs = [-5, -2.4, 0.2, 2.8];
  const ns = ids.map((v, i) => sn(v, xs[i], 0.8, null, 3 + i * 0.3));
  const ls = [0, 1, 2].map((i) => sl(xs[i], 0.8, xs[i + 1], 0.8));
  await beat(tok, 700);
  c.hl(0);
  sn(30, 1.5, 3.0, C_O, 4); kill(ls[2]); sl(xs[2], 0.8, 1.5, 3.0); sl(1.5, 3.0, xs[3], 0.8);
  say('再換成 linked list 版本、交叉測試', 'insert 30：改指標就好');
  await step(tok);                                   // 86:27 一個 binary search、一個 sequential search
  c.hl(1);
  for (let i = 0; i < 3; i++) { glow(ns[i].userData.data, GOLD); await beat(tok, 400); glow(ns[i].userData.data, null); }
  say('都能 search，只是做法、花費不同', 'array：binary search；list：sequential search');
  await step(tok);                                   // 86:33 能做什麼，而不是怎麼做
  c.hl(-1);
  say('把重點放在「能做什麼」', '而不是「怎麼做到」');
  await step(tok);                                   // 87:47 functionality abstraction
  say('這叫 functionality abstraction', '外面的程式不用改，就能換著試');
}]);

// ════════ 88:01 Vector：index access 的功能 ════════
FRAG.push(['contlin-vector-adt', 'Vector：支援 index access 的就是 vector', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0.2]);
  const c = code(['at(i)         // get at index', 'set(i, v)     // put to index', 'insert(i, v)', 'erase(i)'], -2.2, 3.4, 0.56, -3.0);
  const vals = [4, 8, 2, 6, 1, 5];
  let A, cs;
  await step(tok);                                   // 88:01 dense array、sparse array
  A = arrRow(vals, 7, 0.8, { dx: 1.3, drop: 4 });
  cs = A.cs.slice(0, 6);
  say('dense array、sparse array', 'storage 上存的資訊不一樣');
  await step(tok);                                   // 88:15 都支援 indexed access
  say('但都支援 indexed（random）access', 'sparse 要先 binary search，比較迂迴');
  await step(tok);                                   // 88:49 把它叫做 vector
  tag('Vector', 'ptr', 2.2, 3.4, -3.0);
  say('支援 index access 的資料結構', '課本叫它 vector');
  await step(tok);                                   // 89:00 不是 STL 的 vector
  say('不是 C++ STL 的那個 vector', '只表示它支援的功能');
  await step(tok);                                   // 89:08 dense 快速版、sparse 省空間版
  say('dense array：快速 index access 版', 'sparse array：storage saving 版');
  await step(tok);                                   // 89:33 at(i) = get at index
  c.hl(0); glow(cs[2], GOLD);
  say('at(2)：拿出第 2 格', '= 2（get at index）');
  await step(tok);                                   // 89:46 set = put to index
  c.hl(1); relabel(cs[2], 9);
  say('set(2, 9)：放進第 2 格', 'put to index');
  await step(tok);                                   // 89:58 用 index 做 insert
  glow(cs[2], null);
  c.hl(2);
  for (let i = 5; i >= 1; i--) move(cs[i], A.xs[i + 1], 0.4, 0.8);
  await beat(tok, 600);
  const n7 = cube(7, colorFor(7), [1.04, 0.7, 0.85], A.xs[1], 0.4, 0.8, 4);
  cs.splice(1, 0, n7);
  say('insert(1, 7)：用 index 指定位置插入', '');
  await step(tok);                                   // 90:06 用 index 做 erase
  c.hl(3);
  const gone = cs.splice(3, 1)[0]; fly(gone, V3(0, 8, 4));
  for (let i = 3; i < cs.length; i++) move(cs[i], A.xs[i], 0.4, 0.8);
  say('erase(3)：用 index 刪除', '以前叫 remove');
  await step(tok);                                   // 90:13 支援這些就叫 vector
  c.hl(-1);
  say('支援這些功能的，都叫 vector', '跑得快慢、storage 多少都可以');
}]);

// ════════ Vector 家族（兩段共用的擺法） ════════
function vfMembers() {
  return [['Dense Array', -4.4, C_B, '快速版'], ['Sparse Array', 0, C_G, 'storage saving 版'], ['Extendable Array', 4.4, C_O, 'dynamic 版']];
}
function vfMember(k) {
  const [n, x, col] = vfMembers()[k];
  const m = cube(n, col, [3.6, 0.6, 1.1], x, 0.3, 1.2, 4);
  arrow(V3(x * 0.35, 2.25, -1.8), V3(x, 0.7, 0.7), A_GOLD);
  return m;
}
// ════════ 90:31 C++ vector = extendable array ════════
FRAG.push(['contlin-vector-family', 'C++ vector 是 extendable array', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, 0]);
  const ms = [];
  await step(tok);                                   // 90:37 C++ 的 vector 怎麼做？
  cube('Vector：index access', C_K, [5.2, 0.6, 1.2], 0, 2.6, -2.4, 3);
  say('來看 C++ 的 vector 是怎麼做的', '');
  await step(tok);                                   // 90:52 C++ vector = extendable array
  ms[2] = vfMember(2);
  say('C++ STL vector 其實是 extendable array', '');
  await step(tok);                                   // 91:00 支援 at、set、insert、erase，多一個 extendable
  glow(ms[2], GOLD);
  say('vector 要的 at、set、insert、erase 都支援', '再多一個特性：extendable');
  await step(tok);                                   // 91:06 dense array 沒有 extendable
  glow(ms[2], null);
  ms[0] = vfMember(0);
  say('C 原來的 dense array', '沒有可以 extend 的特性');
  await step(tok);                                   // 91:12 sparse 著重 storage
  ms[1] = vfMember(1);
  say('sparse array 著重的不是 extendable', '而是 storage');
  await step(tok);                                   // 91:25 介面一致就能換著試
  say('很多不同的 vector 實作，各有特性', '介面一致，就能這個試試、那個試試');
  await step(tok);                                   // 92:16 linked list 硬做：慢的 vector
  cube('Linked List（硬做）', C_X, [3.6, 0.6, 1.1], 0, 0.3, 4.2, 4);
  say('拿 linked list 硬做 index access 也行', '只是一個很慢的 vector');
  await step(tok);                                   // 92:54 一步一步整合
  ms.forEach((m) => glow(m, GOLD));
  say('一步一步抽象化、整合起來', '都是能提供 index access 的 vector');
}]);
// ════════ 128:05 Vector 家族回顧 ════════
FRAG.push(['contlin-vector-family2', 'Vector 家族：dense、sparse、extendable', async (tok) => {
  fresh([0, 7.5, 12], [0, 1.2, 0]);
  const ms = [];
  await step(tok);                                   // 128:05 統合成一個 family
  cube('Vector', C_K, [5.2, 0.6, 1.2], 0, 2.6, -2.4, 3);
  say('把講過和 array 有關的東西', '統合成一個 family');
  await step(tok);                                   // 128:26 dense、sparse、extendable
  for (let k = 0; k < 3; k++) { ms.push(vfMember(k)); await beat(tok, 400); }
  say('dense、sparse、extendable array', '都是 vector 大家族的例子');
  await step(tok);                                   // 128:56 快速版、space saving 版、dynamic 版
  vfMembers().forEach(([, x, , d]) => tag(d, 'idx', x, 0, 2.2));
  say('各自最著重的功能不同', '快速版、space saving 版、dynamic 版');
  await step(tok);                                   // 129:18 不同取向的 vector
  ms.forEach((m) => glow(m, GOLD));
  say('不同取向的 vector', '一家人');
}]);

// ════════ 95:17 Extendable array：overflow → grow ════════
FRAG.push(['contlin-grow', 'Extendable array：滿了就 allocate、copy、換掉', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.2, 0.2]);
  const V = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0];
  let A, la, x11, B, lb, cnt;
  const copies = [];
  await step(tok);                                   // 95:22 array 可以隨需求變大
  say('extendable array', '想讓 array 隨著需求變大');
  await step(tok);                                   // 96:01 只畫 10 個位置
  A = arrRow(V, 10, -1.6, { drop: 4, idx: false });
  la = tag('A', 'ptr', -6.2, 0.6, -1.6);
  say('array 最大的麻煩：只畫了 10 個位置', '');
  await step(tok);                                   // 96:09 塞滿就不能再塞
  x11 = cube(11, C_O, [0.88, 0.7, 0.85], 0, 0.4, -4.0, 3);
  await beat(tok, 600);
  tint(x11, '#c0392b');
  say('塞滿了，第 11 個就塞不進去', '');
  await step(tok);                                   // 96:23 overflow
  say('塞滿叫 overflow', '和 stack overflow 一樣：塞爆了');
  await step(tok);                                   // 96:40 爆掉就 grow
  say('爆掉的時候就 grow：把它變大', '問題只剩：怎麼變大？');
  await step(tok);                                   // 97:12 ① allocate 新的 array B
  B = arrRow([], 15, 1.6, { dx: 0.85, idx: false });
  lb = tag('B', 'ptr', -6.6, 0.6, 1.6);
  say('① allocate 一個新的 array B', '像買一批更多的新櫃子');
  await step(tok);                                   // 97:31 ② copy contents A → B
  cnt = tag('copy 0 個', 'ptr alt', 3.2, 1.8, 0);
  for (let i = 0; i < 10; i++) {
    const m = cube(V[i], colorFor(V[i]), [0.7, 0.7, 0.8], A.xs[i], 0.4, -1.6);
    move(m, B.xs[i], 0.4, 1.6); copies.push(m);
    txt(cnt, 'copy ' + (i + 1) + ' 個');
    await beat(tok, 200);
  }
  say('② copy contents：舊櫃子的東西搬到 B', '');
  await step(tok);                                   // 98:01 ③ remove A、assign B to A
  A.cs.forEach((m) => fly(m, V3(0, 7, -4))); A.tiles.forEach(kill); kill(la);
  txt(lb, 'A');
  await beat(tok, 700);
  tint(x11, C_O); move(x11, B.xs[10], 0.4, 1.6);
  say('③ remove A，assign B to A', '舊櫃子丟掉，新櫃子繼續用；第 11 個放進去了');
  await step(tok);                                   // 98:19 只寫 grow the array 不夠清楚
  say('pseudocode 只寫「grow the array」不夠明確', '寫成 allocate → copy → remove／assign');
  await step(tok);                                   // 99:07 allocate：constant
  say('① allocate：OS 找一塊連續記憶體給你', '大致 constant');
  await step(tok);                                   // 99:22 copy：有幾個 copy 幾個
  copies.forEach((m) => glow(m, GOLD));
  say('② copy：有 n 個就要 copy n 個', '10 個就花 10 倍力氣 → O(n)');
  await step(tok);                                   // 99:57 assign constant；最花力氣是 copy
  copies.forEach((m) => glow(m, null));
  say('③ assign：constant', '最花力氣的是第 ② 步 copy');
}]);

// ════════ 100:49 兩種 grow 策略 ════════
FRAG.push(['contlin-grow-choices', 'Grow 的兩種選擇：+1 還是 ×2', async (tok) => {
  fresh([0, 8.5, 11.5], [0, 0.2, 0.4]);
  await step(tok);                                   // 100:49 當成 stack，push m 個
  arrRow([1, 2, 3, 4], 4, -2.6, { dx: 1.1, drop: 4, idx: false, x0: -5.2 });
  tag('滿了（size 4）', 'ptr', 1.4, 0.6, -2.6);
  say('把 array 當 stack：一個一個 push m 個', '看 extendable array 發生什麼事');
  await step(tok);                                   // 101:20 分析之前先講兩個選擇
  say('分析之前，先看兩種變大的選擇', '');
  await step(tok);                                   // 101:29 選擇 A：多一格
  arrRow([1, 2, 3, 4, 5], 5, 0.2, { dx: 1.1, drop: 3, idx: false, x0: -5.2 });
  tag('A：size 4 → 5', 'ptr', 1.9, 0.6, 0.2);
  say('選擇 A：每次只比舊的多一格', '要多少拿多少');
  await step(tok);                                   // 102:06 選擇 B：一次漲兩倍
  arrRow([1, 2, 3, 4, 5], 8, 2.8, { dx: 1.1, drop: 3, idx: false, x0: -5.2 });
  tag('B：size 4 → 8', 'ptr alt', 4.2, 1.4, 2.8);
  say('選擇 B：一次豪氣漲兩倍', '');
  await step(tok);                                   // 102:15 比較放 m 個的效率
  say('比較兩種方法放 m 個東西的總效率', '');
  await step(tok);                                   // 102:43 n = 1, 2, 3, …, m
  say('n = 目前 array 裡有幾個', 'n = 1, 2, 3, …, m');
  await step(tok);                                   // 103:04 一開始 size 1
  say('假設 array 一開始 size 1', '');
}]);

// ════════ 103:18／106:41 實際跑：+1 與 ×2 ════════
// one step per sentence: each entry in `plan` is a list of pushes to do (and a caption)
async function growDemo(tok, dbl) {
  fresh([0, 8, 11], [0, 0.3, 0.6]);
  const capMax = dbl ? 16 : 6, dx = dbl ? 0.8 : 1.3;
  const x0 = -(capMax - 1) * dx / 2, xOf = (i) => x0 + i * dx;
  let cap = 1, tiles = [], copies = 0, allocs = 0, n = 0;
  const items = [], parts = [];
  const drawTiles = () => { tiles.forEach(kill); tiles = []; for (let i = 0; i < cap; i++) tiles.push(cell(xOf(i), 0, dx * 0.9, 1.0)); };
  drawTiles();
  const info = tag('size = 1', 'ptr', 0, 2.6, 0), sumT = tag('', 'ptr alt', 0, 2.0, 1.6);
  const show = () => { txt(info, 'n = ' + n + '，size = ' + cap + '，allocate ' + allocs + ' 次'); txt(sumT, 'copy：' + (parts.length ? parts.join(' + ') + ' = ' + copies : '0')); };
  async function pushOne() {
    n++;
    if (n > cap) {
      const old = cap; cap = dbl ? cap * 2 : cap + 1; allocs++;
      items.forEach((c) => glow(c, RED));
      await beat(tok, 400);
      drawTiles(); copies += old; parts.push(old);
      items.forEach((c) => glow(c, null));
    }
    items.push(cube(n, colorFor(n), [dx * 0.75, 0.6, 0.8], xOf(n - 1), 0.38, 0, 3));
    show();
    await beat(tok, 300);
  }
  if (dbl) {
    await step(tok);                                 // 106:54 一開始只有一個
    await pushOne(); say('一樣從 size 1 開始，放第 1 個', '');
    await step(tok);                                 // 107:02 放第 2 個：滿了
    await pushOne(); say('放第 2 個：滿了！allocate、copy 1 個', 'size 1 → 2');
    await step(tok);                                 // 107:23 和第一種一模一樣
    say('到這一步，和 +1 的做法一模一樣', '');
    await step(tok);                                 // 107:32 放第 3 個：滿了，copy 2，size 4
    await pushOne(); say('放第 3 個：又滿了，copy 2 個', '一次漲兩倍：size 2 → 4');
    await step(tok);                                 // 107:58 放第 4 個：沒有滿
    await pushOne(); say('放第 4 個：沒有滿！', '開開心心，不用 copy');
    await step(tok);                                 // 108:06 放第 5 個：copy 4，size 8
    await pushOne(); say('放第 5 個：又滿了，copy 4 個', 'size 4 → 8');
    await step(tok);                                 // 108:36 5、6、7、8 都不會滿
    for (let k = 0; k < 3; k++) await pushOne();
    say('放 6、7、8：通通不會滿', 'size 是 8');
    await step(tok);                                 // 108:49 放第 9 個：copy 8，size 16
    await pushOne(); say('放第 9 個才 copy 8 個', 'size 8 → 16');
    await step(tok);                                 // 109:17 一路到 2^k
    say('一路走到某個 2^k', '');
    await step(tok);                                 // 109:45 2^k 之前只 allocate k 次
    say('到 2^k 之前只 allocate k 次', '進到 4 前 2 次、8 前 3 次、16 前 4 次');
    await step(tok);                                 // 110:10 copy 1 + 2 + 4 + 8 + …
    say('copy：1 + 2 + 4 + 8 + …', '= 2^k − 1');
  } else {
    await pushOne();                                 // 先放好第 1 個（size 1）
    await step(tok);                                 // 103:18 放第 2 個之前：滿了
    await pushOne(); say('放第 2 個：size 1 已經滿了', 'allocate、copy 1 個');
    await step(tok);                                 // 104:23 又滿了：copy 2 個
    await pushOne(); say('再放：又滿了，copy 2 個', 'size 2 → 3');
    await step(tok);                                 // 104:50 又滿了：copy 3
    await pushOne(); say('又滿了：copy 3 個', 'size 3 → 4');
    await step(tok);                                 // 105:14 一個一個丟，每一輪都滿
    for (let k = 0; k < 2; k++) await pushOne();
    say('一個一個丟進來：每一輪都會滿', '每一輪都要 copy');
    await step(tok);                                 // 105:29 最後一輪 copy m − 1 個
    say('最後一輪：copy m − 1 個', '才能把第 m 個塞進去');
    await step(tok);                                 // 105:38 m − 1 次 allocate
    say('總共 m − 1 次 allocate', '');
    await step(tok);                                 // 105:53 copy 1 + 2 + … + (m − 1)
    say('copy：1 + 2 + 3 + … + (m − 1)', '= m(m − 1) / 2');
    await step(tok);                                 // 106:16 大約 m²
    say('總共大約 m² 的力氣', 'O(m²)');
  }
}
FRAG.push(['contlin-grow-plus1', '每次 +1：copy 1+2+…+(m−1) = Θ(m²)', async (tok) => { await growDemo(tok, false); }]);
FRAG.push(['contlin-grow-double', '每次 ×2：copy 1+2+4+… ≈ m', async (tok) => { await growDemo(tok, true); }]);

// ════════ 110:37 比較：平均每次 O(1) ════════
FRAG.push(['contlin-amortized', '攤平來看：×2 平均每次 O(1)', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const M = 16, dx = 0.72, x0 = -5.0, s = 0.2;
  const isP2 = (k) => k > 0 && (k & (k - 1)) === 0;
  const spikes = [], b1 = [];
  await step(tok);                                   // 110:37 allocate 數量：×2 少很多
  tag('每次 +1', 'ptr', -6.3, 0.4, -1.8); tag('每次 ×2', 'ptr alt', -6.3, 0.4, 1.8);
  const tot1 = tag('', 'idx', 4.0, 4.4, -1.8), tot2 = tag('', 'idx', 4.0, 4.4, 1.8);
  let t1 = 0, t2 = 0;
  for (let i = 1; i <= M; i++) {
    const c1 = i, c2 = 1 + (i > 1 && isP2(i - 1) ? i - 1 : 0);
    t1 += c1; t2 += c2;
    const x = x0 + (i - 1) * dx;
    b1.push(cube('', C_B, [0.5, c1 * s, 0.8], x, c1 * s / 2, -1.8));
    const b = cube('', C_O, [0.5, c2 * s, 0.8], x, c2 * s / 2, 1.8);
    if (c2 > 1) spikes.push(b);
    txt(tot1, '總共 ' + t1); txt(tot2, '總共 ' + t2);
    await beat(tok, 100);
  }
  say('第 i 次 push 花多少力氣（高度 = copy + 1）', '×2 比較貪心：一次多要一點，allocate 少很多');
  await step(tok);                                   // 110:53 +1：勤儉持家
  say('+1 比較勤儉持家', '用多一點就再拿一點');
  await step(tok);                                   // 111:08 copy 的數量呢？
  say('有趣的是 copy 的總數', '×2 有時 copy 1 個、有時 2 個、4 個……');
  await step(tok);                                   // 111:22 等比級數
  spikes.forEach((b) => glow(b, GOLD));
  say('1 + 2 + 4 + … + 2^(k−1)', '練習等比級數的好機會：= 2^k − 1');
  await step(tok);                                   // 112:02 m 個：copy ≈ m，allocate ≈ log m
  spikes.forEach((b) => glow(b, null));
  say('塞 m 個：copy 大約 m 次', 'allocate 大約 log m 次');
  await step(tok);                                   // 112:23 平均每次 constant
  say('×2：平均每放一個，只花 constant 的力氣', 'm 個花 m 份力氣 → O(1)');
  await step(tok);                                   // 112:54 +1：平均每次 m
  b1.forEach((b) => glow(b, GOLD));
  say('+1：平均每放一個要花 m 的力氣', 'm 個總共 ≈ m²/2');
  await step(tok);                                   // 113:19 缺點：有時要等很久
  b1.forEach((b) => glow(b, null));
  spikes.forEach((b) => glow(b, RED));
  say('×2 的缺點：漲的那一下要等很久', '力氣全集中在那個時間點');
  await step(tok);                                   // 113:39 +1 比較省記憶體
  spikes.forEach((b) => glow(b, null));
  say('想省記憶體：+1 用多少拿多少', '');
  await step(tok);                                   // 113:47 C++ STL vector 用倍數成長
  say('C++ STL vector：倍數成長（混合版）', '不夠用時乘上某個倍數往上長');
  await step(tok);                                   // 114:20 平均的分析方式
  say('把偶爾的大花費攤平到每次操作', '這種平均分析（amortized）很常用');
}]);

// ════════ 116:02 小 array 用 linked list 串起來 ════════
FRAG.push(['contlin-deque-blocks', '把小 array 用 linked list 串起來', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.3, 0.4]);
  const bx = [-4.4, 0, 4.4], dx = 0.85, blocks = [];
  let cur;
  await step(tok);                                   // 116:02 copy 浪費：切成小 array？
  for (let b = 0; b < 3; b++) {
    const xs = [0, 1, 2, 3].map((k) => bx[b] - 1.5 * dx + k * dx);
    const vs = [0, 1, 2, 3].map((k) => b * 4 + k);
    blocks.push(xs.map((x, k) => { cell(x, 0, dx * 0.92, 1.0); tag('[' + vs[k] + ']', 'idx', x, 0, 0.85); return cube(vs[k], colorFor(vs[k]), [0.68, 0.7, 0.8], x, 0.4, 0, 3 + b * 0.5 + k * 0.15); }));
    await beat(tok, 400);
  }
  say('同學問：copy 好浪費，能不能切成小 array？', '再用 linked list 連在一起');
  await step(tok);                                   // 116:08 記得 deque 嗎？
  say('非常好的問題：記得 deque 嗎？', '');
  await step(tok);                                   // 116:27 STL deque 就是這樣
  for (let b = 0; b < 2; b++) {
    arrow(V3(bx[b] + 1.85, 0.55, 0), V3(bx[b + 1] - 1.85, 0.55, 0));
    arrow(V3(bx[b + 1] - 1.85, 0.2, 0), V3(bx[b] + 1.85, 0.2, 0), A_GOLD);
  }
  say('C++ STL 的 deque 就是一堆小 array', '老師說用 linked list 串；實際 STL 用指標陣列（map）記每塊');
  await step(tok);                                   // 116:33 memory 集中：cache 效率好
  blocks.forEach((bl) => bl.forEach((m) => glow(m, GOLD)));
  say('每塊小 array 的記憶體是集中的', 'cache efficiency 比較好');
  await step(tok);                                   // 116:42 又有 linked list 的彈性
  blocks.forEach((bl) => bl.forEach((m) => glow(m, null)));
  say('又有 linked list 的彈性', '');
  await step(tok);                                   // 116:50 index access 沒那麼快
  cur = tag('block', 'ptr alt', bx[0], 1.8, 0);
  for (let b = 0; b < 3; b++) { cur.position.x = bx[b]; await beat(tok, 500); }
  say('用 linked list 串的話，要第 9 個得一塊一塊走', 'STL 用指標陣列，第幾塊可直接算 → 仍 O(1)');
  await step(tok);                                   // 116:59 自己範圍內 random access 快
  glow(blocks[2][1], GOLD);
  say('在一塊之內，random access 是快的', '9 = 第 2 塊的第 1 格');
  await step(tok);                                   // 117:10 trade-off：介在中間
  say('介在 array 和 linked list 中間', 'trade-off（實際 STL 用指標陣列管 block）');
}]);

// ════════ 117:37 需求一路往上加 ════════
FRAG.push(['contlin-need-ladder', '需求一層一層加：index access → fast → extendable', async (tok) => {
  fresh([0, 7, 12.5], [0, 1.4, 0]);
  const steps = [[-4.2, 1, C_B, 'random access'], [0, 2, C_G, '＋ fast'], [4.2, 3, C_O, '＋ extendable']];
  async function stair(k) {
    const [x, h, col, name] = steps[k];
    for (let j = 0; j < h; j++) { cube(j === h - 1 ? name : '', col, [3.6, 0.8, 2.0], x, 0.4 + j * 0.8, 0, 3 + j * 0.4); await beat(tok, 250); }
  }
  await step(tok);                                   // 117:37 random access 是功能需求
  await stair(0);
  say('random access：功能需求', '放、拿東西時需要一個編號');
  await step(tok);                                   // 117:49 怎麼實作我不管
  say('需求到這裡就結束', '怎麼實作，我不管');
  await step(tok);                                   // 118:08 快速 implement 版本
  await stair(1);
  say('fast 版：一塊集中的記憶體', 'index 和位置有固定對應 → 很快算出位置');
  await step(tok);                                   // 118:32 就是 dense array
  say('這就是 dense array 的做法', 'addr = base + i × size');
  await step(tok);                                   // 119:09 需求一點一點開
  say('需求是一點一點往上開的', '先要 index access，再要「而且要快」');
  await step(tok);                                   // 119:25 先吃飽，再好吃
  say('像先要吃飽，再要吃得好吃', '需求越多，資料結構越複雜，或要考慮 trade-off');
  await step(tok);                                   // 120:01 extendable 也是需求
  await stair(2);
  say('extendable 又是一個加上去的需求', '');
  await step(tok);                                   // 120:26 漲一個或漲一倍
  say('兩種做法：每次漲一個、每次漲一倍', '分析後漲一倍比較合用');
  await step(tok);                                   // 120:42 copy 攤平
  say('漲一倍：把 copy 攤平到所有操作', '平均起來不花力氣');
}]);

// ════════ 129:24 List 家族 ════════
FRAG.push(['contlin-list-adt', 'List：靠 position 一個一個走', async (tok) => {
  fresh([0, 8, 12], [0, 0.6, 0.4]);
  const c = code(['begin()            → head', 'end()              → NULL', 'next(p)            → p->next', 'element(p)         → p->data', 'insertAfter(p, e)', 'remove(p)'], -2.2, 3.9, 0.52, -3.0);
  const xs = [-4.5, -1.5, 1.5, 4.5], vals = [3, 7, 1, 9], z = 1.0;
  let ns, ls, p;
  await step(tok);                                   // 129:28 doubly、singly 做一樣的事
  ns = vals.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  ls = [0, 1, 2].map((i) => sl(xs[i], z, xs[i + 1], z));
  tag('NULL', 'idx', xs[3] + 1.6, 0.35, z);
  say('對 doubly、singly linked list 做一樣的事', '描述它的 functionality');
  await step(tok);                                   // 129:59 共同功能叫 list
  tag('List', 'ptr', 3.6, 3.9, -3.0);
  say('兩者共同的功能，課本叫 list', '');
  await step(tok);                                   // 130:08 iterative／sequential／positional
  say('在意的是 iterative、sequential access', '也有人叫 positional access');
  await step(tok);                                   // 130:28 像排隊的位置
  say('像排隊：你排在隊伍的哪個位置', '用位置來放東西、拿東西');
  await step(tok);                                   // 130:45 vector 是 indexed access
  say('對比：vector 的重點是 indexed（random）access', '');
  await step(tok);                                   // 131:09 insert 到某個 position
  c.hl(4);
  p = tag('p', 'ptr alt', xs[1], 1.6, z);
  sn(5, 0, 3.0, C_O, 4); kill(ls[1]); sl(xs[1], z, 0, 3.0); sl(0, 3.0, xs[2], z);
  say('insert 到某個 position', '以前叫 insert after：insertAfter(p, 5)');
  await step(tok);                                   // 131:29 透過 p 拿 element
  c.hl(3); glow(ns[1].userData.data, GOLD);
  say('透過 position p 拿到 element', '在 linked list 裡，p 就是 node 的 pointer');
  await step(tok);                                   // 131:47 從哪裡開始：head
  glow(ns[1].userData.data, null);
  c.hl(0); p.position.x = xs[0];
  say('從哪裡開始走：begin', 'linked list 的 head');
  await step(tok);                                   // 131:57 走完了沒：end
  c.hl(1);
  say('怎麼知道走完了：end', 'singly linked list：是不是等於 NULL');
  await step(tok);                                   // 132:41 下一個：順著 next 紙條
  c.hl(2);
  for (const x of [xs[1], 0, xs[2], xs[3], xs[3] + 1.6]) { p.position.x = x; await beat(tok, 400); }
  say('下一個：順著 next 的小紙條走', 'p = p->next，走到 NULL 就結束');
  await step(tok);                                   // 132:48 remove：singly、doubly 難度差很多
  c.hl(5);
  say('有 insert 就有 remove', 'singly 要找前一個，doubly 容易：難度差最多');
}]);

// ════════ 133:59 Dense array 也是 list ════════
FRAG.push(['contlin-array-as-list', 'Dense array 也能當 list：position = address', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  let A, p;
  await step(tok);                                   // 134:01 dense array 也能加入 list
  A = arrRow([4, 8, 2, 6, 1], 5, -1.6, { dx: 1.4, base: 1000, drop: 4 });
  tag('dense array：address 連續', 'ptr', -5.4, 1.0, -3.2);
  say('family 擴大一點：dense array 也能加入 list', '');
  await step(tok);                                   // 134:13 insert／remove 比較慢
  say('只是 insert、remove 時要推擠', '比較慢');
  await step(tok);                                   // 134:38 position 不是紙條，是 address
  p = tag('p = 1000', 'ptr alt', A.xs[0], 1.7, -1.6);
  say('它的 position 不是小紙條', '可以對應到 address');
  await step(tok);                                   // 134:54 address 連續 vs 不連續
  tag('linked list：address 不連續，靠 next 紙條', 'ptr', -4.2, 1.0, 1.4);
  const xs = [-4.5, -1.5, 1.5, 4.5], ad = ['0x3A0', '0x120', '0x7F8', '0x210'];
  xs.forEach((x, i) => { sn([4, 8, 2, 6][i], x, 2.6, null, 3 + i * 0.3); tag(ad[i], 'idx', x, 0, 3.4); if (i < 3) sl(x, 2.6, xs[i + 1], 2.6); });
  say('差別：array address 連續', 'linked list address 不連續，靠小紙條傳');
  await step(tok);                                   // 135:14 begin = array 開頭的 address
  glow(A.cs[0], GOLD); txt(p, 'p = 1000（begin）');
  say('begin：array 開頭的 address', '');
  await step(tok);                                   // 135:20 end = array + length
  glow(A.cs[0], null);
  const ex = A.xs[4] + 1.4;
  const ghost = ghostBox(C_X, 1.2, 0.7, 0.85); ghost.position.set(ex, 0.4, -1.6);
  tag('1020 = end', 'idx', ex, 0, -0.75);
  say('end：array + length 的那個 address', '表示結尾的地方');
  await step(tok);                                   // 135:35 next = address ++
  for (let i = 1; i < 5; i++) { p.position.x = A.xs[i]; txt(p, 'p = ' + (1000 + i * 4)); glow(A.cs[i], GOLD); await beat(tok, 450); glow(A.cs[i], null); }
  say('next：address ++', 'int 佔 4 bytes，往前移一格');
  await step(tok);                                   // 135:59 concrete implementation
  say('這些是 concrete implementation', '真正的記憶體怎麼擺、怎麼做事');
  await step(tok);                                   // 136:11 上半 vector、下半 list
  say('把功能切出來：上半屬於 vector', '下半屬於 list');
  await step(tok);                                   // 136:34 幾號櫃子 vs 排第幾個
  say('vector：一號櫃子、二號櫃子……', 'list：排第一個位置的人、第二個……');
}]);

// ════════ 137:07 Iterator：同一份 for 迴圈 ════════
FRAG.push(['contlin-iterator', 'Iterator：同一個迴圈跑 array 與 linked list', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.6, 0.4]);
  const V = [3, 1, 4, 2];
  const xs = [-3.6, -0.9, 1.8, 4.5], z = 2.2;
  let A, ns, c, pa, pl, sa, sm;
  await step(tok);                                   // 137:07 把 p 抽象化
  A = arrRow(V, 4, -0.8, { dx: 1.1, x0: -3.6, base: 1000, drop: 4 });
  tag('dense array', 'ptr', -5.6, 0.6, -0.8);
  ns = V.map((v, i) => sn(v, xs[i], z, null, 3 + i * 0.3));
  [0, 1, 2].forEach((i) => sl(xs[i], z, xs[i + 1], z));
  tag('linked list', 'ptr', -5.6, 0.6, z); tag('NULL', 'idx', xs[3] + 1.6, 0.35, z);
  say('iterator：把 list 裡 p 這個觀念抽象化', '');
  await step(tok);                                   // 137:19 linked list：head、next、next…
  pl = tag('p', 'ptr alt', xs[0], 1.6, z);
  for (let i = 1; i < 4; i++) { pl.position.x = xs[i]; await beat(tok, 350); }
  pl.position.x = xs[3] + 1.6;
  say('linked list：p 從 head 開始', 'next、next、next 到 end');
  await step(tok);                                   // 137:26 array：開頭 address，加加加
  pa = tag('p', 'ptr alt', A.xs[0], 1.7, -0.8);
  for (let i = 1; i < 4; i++) { pa.position.x = A.xs[i]; await beat(tok, 350); }
  pa.position.x = A.xs[3] + 1.1;
  say('array：p 從開頭的 address 開始', '加加加加到 end');
  await step(tok);                                   // 138:03 需要 begin、end、next、element
  c = code(['sum = 0;', 'for (p = c.begin(); p != c.end(); p = next(p))', '    sum += element(p);'], 0, 3.7, 0.56, -3.4);
  say('走過整個 list 需要：begin、end、next、element', '');
  await step(tok);                                   // 138:35 begin：arr[0] 的位置 vs head
  pa.position.x = A.xs[0]; pl.position.x = xs[0];
  glow(A.cs[0], GOLD); glow(ns[0].userData.data, GOLD);
  say('begin：arr[0] 的位置', 'linked list：head');
  await step(tok);                                   // 139:03 end：arr[n] vs NULL
  glow(A.cs[0], null); glow(ns[0].userData.data, null);
  const g = ghostBox(C_X, 1.0, 0.7, 0.85); g.position.set(A.xs[3] + 1.1, 0.4, -0.8);
  tag('arr[n]', 'idx', A.xs[3] + 1.1, 0, 0.05);
  say('end：arr[n]（已經過頭了）', 'linked list：走到 NULL');
  await step(tok);                                   // 139:48 next：p++ vs p->next
  say('next：p++，int 往前 4 bytes', 'linked list：順著 next 走');
  await step(tok);                                   // 140:31 只寫一個程式
  c.hl(1);
  sa = tag('sum = 0', 'idx', 5.6, 0.6, -0.8); sm = tag('sum = 0', 'idx', 5.6, 1.3, z);
  let s = 0;
  for (let i = 0; i < 4; i++) {
    s += V[i]; txt(sa, 'sum = ' + s); txt(sm, 'sum = ' + s);
    pa.position.x = A.xs[i]; pl.position.x = xs[i];
    glow(A.cs[i], GOLD); glow(ns[i].userData.data, GOLD);
    await beat(tok, 450);
    glow(A.cs[i], null); glow(ns[i].userData.data, null);
  }
  say('只寫一個程式，把 container 裡的東西加起來', '兩邊 sum 都是 ' + s);
  await step(tok);                                   // 141:09 不是 p++，是 p = p 的 next
  c.hl(2);
  say('老師更正：這裡不應該寫 p++', '應該寫 p = next(p)');
  await step(tok);                                   // 141:28 不在乎底下是哪種 container
  c.hl(-1);
  say('不在乎底下是 singly、doubly 還是 dense array', '甚至是 deque');
  await step(tok);                                   // 141:48 p 的角色就叫 iterator
  say('這裡 p 的角色，就叫 iterator', '把「位置」抽象化');
}]);

// ════════ 142:34 C++ STL iterator ════════
FRAG.push(['contlin-stl-iterator', 'C++ STL：list<int>::iterator 換成 vector', async (tok) => {
  fresh([0, 8.5, 12], [0, 0.6, 0.4]);
  const L = ['list<int> c;', 'list<int>::iterator p;', 'for (p = c.begin(); p != c.end(); p++)', '    sum += *p;'];
  const c = code(L, 0, 3.8, 0.56, -3.2);
  const W = Math.max(...L.map((x) => x.length));
  const xs = [-3.9, -1.3, 1.3, 3.9], V = [3, 1, 4, 2], z = 1.0;
  let ns, p, A, q;
  await step(tok);                                   // 142:37 doubly linked list of integer + iterator
  ns = V.map((v, i) => dn(v, xs[i], z, null, 3 + i * 0.3));
  dlinks(xs, z);
  c.hl(0);
  say('STL 的 list 是 doubly linked list', 'list<int> + 它的 iterator');
  await step(tok);                                   // 142:43 拜訪所有 elements 加起來
  c.hl(2);
  p = tag('p', 'ptr alt', xs[0], 1.7, z);
  for (let i = 0; i < 4; i++) { p.position.x = xs[i]; glow(ns[i].userData.data, GOLD); await beat(tok, 450); glow(ns[i].userData.data, null); }
  say('iterator 幫你拜訪所有 element', '把它們都加起來');
  await step(tok);                                   // 142:55 我要用 vector
  kill(p);
  txt(c.ls[0], 'vector<int> c;'.padEnd(W, ' ')); txt(c.ls[1], 'vector<int>::iterator p;'.padEnd(W, ' '));
  c.hl(0);
  ns.forEach((g) => fly(g, V3(0, 8, 4)));
  await beat(tok, 500);
  lab.world.children.filter((o) => o.type === 'ArrowHelper').forEach((o) => lab.world.remove(o));
  A = arrRow(V, 4, z, { dx: 1.3, base: 1000, drop: 4 });
  say('想改用 vector？只把型別改成 vector', '其他什麼都不用變');
  await step(tok);                                   // 143:06 一份 code 抽換資料結構
  c.hl(-1);
  say('寫一份 code', '就能抽換不同的 data structure');
  await step(tok);                                   // 143:23 operator overloading：p++
  c.hl(2);
  q = tag('p', 'ptr alt', A.xs[0], 1.7, z);
  for (let i = 1; i < 4; i++) { q.position.x = A.xs[i]; await beat(tok, 400); }
  say('C++ 用 operator overloading', '比較帥氣的寫法：p++');
  await step(tok);                                   // 143:51 ++ 換成呼叫 next
  say('這個 ++ 不是單純 address 加一', '而是去呼叫對應的 next');
  await step(tok);                                   // 144:05 *p：拿到 element
  c.hl(3); glow(A.cs[3], GOLD);
  say('*p：拿到 p 這個位置上的 element', '');
  await step(tok);                                   // 144:18 更安全的 pointer
  glow(A.cs[3], null); c.hl(-1);
  say('iterator 可以想成更安全的 pointer', '比較複雜一點的 pointer');
  await step(tok);                                   // 145:09 支援 list 功能就有 iterator
  say('只要 container 支援 list 的功能', '就會有對應的 iterator');
  await step(tok);                                   // 146:05 linked list、dense array 都有
  say('linked list、dense array 都支援 list', 'iteration code 可以跑在不同資料結構上');
}]);

// ════════ 149:44 Q&A：iterator 細節 ════════
FRAG.push(['contlin-iter-end', 'Iterator 細節：end 不用配置、*p 只取內容', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.3]);
  let A, p;
  await step(tok);                                   // 149:44 不一定要用 address 實作
  A = arrRow([4, 8, 2, 6, 1], 5, -1.4, { dx: 1.4, x0: -4.6, base: 5546, drop: 4 });
  say('iterator 不一定要用 address 實作', '沒有那麼強的規定');
  await step(tok);                                   // 150:06 array 用 index 實作也可以
  say('array 用 index 來實作 iterator', 'technically 可以');
  await step(tok);                                   // 150:20 index 算 address 再 dereference
  glow(A.cs[2], GOLD);
  say('存取時：先從 index 算到 address', '再 dereference');
  await step(tok);                                   // 150:49 要多配一格給 end 嗎？
  glow(A.cs[2], null);
  say('同學問：dense array 要多 allocate 一格給 end 嗎？', '');
  await step(tok);                                   // 151:00 不見得要 allocate
  const ex = A.xs[4] + 1.4;
  const g = ghostBox(C_X, 1.2, 0.7, 0.85); g.position.set(ex, 0.4, -1.4);
  tag('5566', 'idx', ex, 0, -0.55);
  say('不見得要把那格 allocate 下來', '但還是可以拿位置來判斷');
  await step(tok);                                   // 151:07 5566：出了家門口
  p = tag('end', 'ptr alt', ex, 1.6, -1.4);
  say('走到 5566 就是「跨出家門口」', 'p != c.end() 只是比較位置');
  await step(tok);                                   // 151:45 每輪呼叫 end() 要花時間
  txt(p, 'c.end()?');
  say('每一輪都呼叫 end() 會花一些時間', '');
  await step(tok);                                   // 152:44 flexibility vs overhead
  say('programming flexibility', 'vs running time 上的 constant overhead');
  await step(tok);                                   // 153:16 inline
  say('compiler 會把簡單的 function inline', '直接換成程式碼，減少 overhead');
  await step(tok);                                   // 153:47 *p 是被 overload 的 dereference
  const nd = sn(9, -1.0, 2.0, C_B, 3);
  tag('p', 'ptr alt', -1.0, 1.4, 2.0);
  say('*p：被 overload 的 dereference function', '');
  await step(tok);                                   // 154:32 只取 content，不是整個 node
  glow(nd.userData.data, GOLD);
  say('在 linked list：只取 node 裡的 content（9）', '不是整個 node');
}]);
  }

  // ═══ engmisc.js ═══
  {
// ─── engmisc：akErwS16DUg（Linked List 入門）、PdvGEI-P3-M（Stack vs Heap）、ygK0YON10sQ（Recursion 與 Stack）— cued: each step(tok) waits for the sentence it shows ───
const K = kit(ctx);
const step = (tok) => ctx.step(tok);
const C_STACK = '#4b9ee2', C_HEAP = '#2fc092', C_CODE = '#c08a1f', C_LINK = '#d8c29b', C_PTR = '#f2c46d';
const cls = (l, c) => { l.element.className = 'lab-label' + (c ? ' ' + c : ''); };
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
  g.userData.title = tag(name, 'ptr', x, h + 0.4, z);
  return g;
}

// ════════ akErwS16DUg：陣列的問題 → Linked List ════════
FRAG.push(['engmisc-array-fixed', '陣列大小固定的問題', async (tok) => {
  fresh([0, 6, 13], [0, 1, 0]);
  say('為什麼需要 Linked List？');
  await step(tok);                                   // 0:08 problems with arrays, array vs linked list
  const t1 = tag('① 陣列的問題', 'ptr', -3, 3.6, 0), t2 = tag('② array 和 linked list 的差別', 'ptr', 3, 3.6, 0);
  say('這段講兩件事', '陣列有什麼問題、array 和 linked list 差在哪');
  await step(tok);                                   // 0:17 array is of a fixed size
  kill(t1); kill(t2);
  const decl = tag('int A[ 大小 ];', 'ptr alt', 0, 3.2, 0);
  const lock = tag('建好之後：不能變大、不能變小', 'bad', 0, 2.4, 0);
  say('陣列是 fixed size', '建立時就要給大小，之後改不了');
  await step(tok);                                   // 0:40 know the count → that size; otherwise can't decide
  say('知道要存幾個，就開剛好的大小', '不知道的話，大小根本決定不了');
  await step(tok);                                   // 0:51 a random size: insufficient or excess
  say('隨便取一個大小？', '可能不夠用，也可能太多');
  await step(tok);                                   // 1:04 declare an array of size 10
  kill(lock);
  txt(decl, 'int A[10];');
  const slots = [];
  for (let i = 0; i < 10; i++) {
    const g = ghostBox('#c9b48e', 0.9, 0.8, 0.9); g.position.set(-4.5 + i, 0.4, 0); slots.push(g);
    tag('[' + i + ']', 'idx', -4.5 + i, 0, 0.9);
  }
  say('例如宣告 A[10]：10 格');
  await step(tok);                                   // 1:11 more than 10 elements → cannot store
  const cs = [];
  for (let i = 0; i < 10; i++) { cs.push(cube('e' + (i + 1), C_STACK, [0.8, 0.7, 0.8], -4.5 + i, 0.35, 0, 4)); await beat(tok, 80); }
  const extra = cube('e11', '#c0563a', [0.8, 0.7, 0.8], 5.8, 0.35, 0, 4);
  glow(extra, RED);
  say('執行時來了第 11 個：放不下');
  await step(tok);                                   // 1:18 only 2–3 elements → lots of space wasted
  fly(extra, V3(3, 8, 4));
  for (let i = 3; i < 10; i++) fly(cs[i], V3(0, 8, 4));
  for (let i = 3; i < 10; i++) tint(slots[i], '#c0563a');
  say('只有 2、3 個元素時', '其他 7 格空著，浪費');
  await step(tok);                                   // 1:25 take a larger size 100 → still a limit
  txt(decl, 'int A[100];');
  say('改成 100 格？', '超過 100 個一樣放不下');
  await step(tok);                                   // 1:41 users decide how many elements
  tag('要輸入幾個？使用者決定', 'note', 0, 2.4, 0);
  say('程式是寫給使用者用的', '要存幾個，是使用者執行時才決定');
  await step(tok);                                   // 2:05 runtime vs compile time: the problem
  say('數量在 runtime 才知道', '大小卻要在寫程式（compile time）時決定 → 問題');
}]);

FRAG.push(['engmisc-array-stack-heap', '陣列在 Stack 與 Heap', async (tok) => {
  fresh([0, 7, 13], [0, 1.4, 0]);
  say('先複習陣列');
  await step(tok);                                   // 2:24 array either in stack or in heap
  region('Stack（main 的 activation record）', C_STACK, -3.5, 5.2, 2.2, 4.2);
  region('Heap', C_HEAP, 3.5, 5.2, 2.2, 4.2);
  const cd = code(['int A[5];', 'int *p = new int[5];'], -0.2, 5.2);
  say('陣列可以建在 Stack，也可以建在 Heap');
  await step(tok);                                   // 2:34 int A[5]: inside main's activation record
  cd.hl(0);
  const A = [];
  for (let i = 0; i < 5; i++) { A.push(cube('', C_STACK, [0.85, 0.6, 0.85], -5.4 + i * 0.95, 0.3, -0.8, 3)); tag('A[' + i + ']', 'idx', -5.4 + i * 0.95, 0, 0.1); }
  say('int A[5]：建在 main 的 activation record 裡');
  await step(tok);                                   // 2:45 pointer p here; array of 5 in heap
  cd.hl(1);
  cube('p', C_PTR, [0.9, 0.6, 0.9], -3.5, 0.3, 1.3, 3);
  const H = [];
  for (let i = 0; i < 5; i++) { H.push(cube('', C_HEAP, [0.85, 0.6, 0.85], 1.6 + i * 0.95, 0.3, 0, 3)); tag('[' + i + ']', 'idx', 1.6 + i * 0.95, 0, 0.9); }
  say('指標 p 在 Stack', '5 格的陣列建在 Heap');
  await step(tok);                                   // 3:13 p is pointing on that one
  arrow(V3(-3.05, 0.3, 1.3), V3(1.15, 0.3, 0.1));
  say('p 指向 Heap 上的那塊');
  await step(tok);                                   // 3:24 benefit: contiguous, side by side
  cd.hl(-1);
  for (let i = 0; i < 5; i++) { glow(A[i], GOLD); glow(H[i], GOLD); await beat(tok, 250); }
  say('陣列的優點：格子一格挨一格', 'contiguous（連續）');
  await step(tok);                                   // 3:28 access them with index
  A.forEach((m) => glow(m)); H.forEach((m) => glow(m));
  say('所以可以用 index 0 … 4 存取');
  await step(tok);                                   // 3:32 reach any element randomly
  glow(A[3], GREEN);
  say('想去哪一格就直接跳過去', 'random access：例如直接到 A[3]');
  await step(tok);                                   // 3:37 like a bench of capacity 5
  glow(A[3]);
  cube('5 人座長椅', '#b8844b', [4.8, 0.2, 0.5], -3.5, 0.1, -1.7);
  say('陣列就像一張 5 人座長椅', '做好時容量就固定了');
  await step(tok);                                   // 3:52 more people no space, fewer wasted
  say('人多：坐不下', '人少：位子浪費');
}]);

FRAG.push(['engmisc-ll-build', 'Linked List 的想法：每個元素自帶空間', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0]);
  say('Linked List 的想法');
  await step(tok);                                   // 4:07 we don't want a fixed-size bench
  const want = tag('不要固定大小的長椅', 'bad', 0, 3.6, 0);
  say('不知道使用者要存幾個', '所以不要固定大小');
  await step(tok);                                   // 4:33 grow and reduce in size
  cls(want, 'good'); txt(want, '要：能變大、能變小（variable size）');
  say('使用者可以加、也可以刪', '資料結構要能跟著變大變小');
  await step(tok);                                   // 4:46 create memory in heap during runtime
  region('Heap（runtime 動態配置）', C_HEAP, 0.6, 11.2, 1.6, 6);
  kill(want);
  say('做法：執行時在 Heap 配置記憶體');
  await step(tok);                                   // 4:52 use linking
  say('再用 link 把它們串起來');
  await step(tok);                                   // 5:16 one pointer: first
  cube('first', C_PTR, [1.1, 0.6, 0.9], -6, 0.3, 2.2);
  say('先準備一個指標：first', '還沒有任何元素');
  await step(tok);                                   // 5:35 store 8: allocate, first points on it
  const n8 = lnode(8, -3.8, 0.4, -1.2, colorFor(8));
  n8.children[1].visible = false;
  arrow(V3(-5.45, 0.3, 2.2), V3(-4.3, 0.4, -0.9));
  say('要存 8：配一格空間', 'first 指向它');
  await step(tok);                                   // 5:46 also allocate a pointer to the next one → NULL
  n8.children[1].visible = true;
  let nl = nullAfter(n8);
  say('同時多配一個「指向下一個」的指標', '後面還沒有東西 → NULL');
  await step(tok);                                   // 6:03 that's it, we made a node
  glow(n8.userData.data, GOLD);
  const nt = tag('node = data + next', 'ptr alt', -3.8, 1.6, -1.2);
  say('元素 + 指標，合起來叫一個 node');
  await step(tok);                                   // 6:19 one more element: allocate, point to it
  glow(n8.userData.data); kill(nt);
  kill(nl);
  const n3 = lnode(3, -0.4, 0.4, 1.4, colorFor(3));
  llink(n8, n3); nl = nullAfter(n3);
  say('再存 3：再建一個 node', '前一個 node 指向它：8 → 3');
  await step(tok);                                   // 6:41 element 12: a new node
  kill(nl);
  const n12 = lnode(12, 3.2, 0.4, -1.0, colorFor(12));
  llink(n3, n12);
  say('再存 12：再建一個 node', '3 指向 12');
  await step(tok);                                   // 6:50 nothing beyond → NULL; a node per element
  nl = nullAfter(n12);
  say('12 後面沒有了 → NULL', '要存一個元素，就建一個 node');
  await step(tok);                                   // 7:02 not a bench: everyone brings a chair
  const ppl = [n8, n3, n12].map((g) => { const b = K.buddy('', '', '#f4a56a', g.position.x, 0, g.position.z - 1.1, 0.5); b.mood('happy'); return b; });
  say('不是長椅：每個人自己帶椅子來', '來一個，就牽上前一個');
  await step(tok);                                   // 7:14 a chain of chairs; leaving takes the chair
  ppl[1].mood('wow');
  say('一個牽一個，連成一串', '有人離開，就把自己的椅子帶走');
  await step(tok);                                   // 7:26 every element brings its own memory
  ppl.forEach((b) => b.mood('happy'));
  say('每個元素自帶記憶體，並指向下一個', 'node 散在 Heap 各處，靠 link 連起來');
}]);

FRAG.push(['engmisc-ll-relink', '改 link 就能刪除與插入', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.5]);
  tag('first', 'ptr', -6, 1.4, 0);
  const n8 = lnode(8, -4.5, 0.4, 0, colorFor(8)), n3 = lnode(3, -1.5, 0.4, 0, colorFor(3)), n12 = lnode(12, 3.5, 0.4, 0, colorFor(12));
  let a83 = llink(n8, n3), a312 = llink(n3, n12); nullAfter(n12);
  say('8 → 3 → 12');
  await step(tok);                                   // 7:44 remove 3
  glow(n3.userData.data, RED);
  say('想刪掉 3');
  await step(tok);                                   // 7:48 8 points on 12 instead of 3
  kill(a83); kill(a312);
  const a812 = llink(n8, n12);
  glow(n8.userData.data, GOLD);
  say('讓 8 改指向 12 就好', '只改一個 link');
  await step(tok);                                   // 7:54 easy, remove it
  glow(n8.userData.data);
  move(n3, -1.5, 0.4, -2.6);
  say('3 被跳過了：等於刪掉');
  await step(tok);                                   // 7:56 bring it back as it is
  kill(a812);
  move(n3, -1.5, 0.4, 0); glow(n3.userData.data);
  a83 = llink(n8, n3); a312 = llink(n3, n12);
  say('先把 3 放回去', '8 → 3 → 12');
  await step(tok);                                   // 7:59 new element between 3 and 12
  say('想在 3 和 12 中間插入新元素');
  await step(tok);                                   // 8:04 create node 7
  const n7 = lnode(7, 1.0, 0.4, 2.4, colorFor(7));
  say('先建一個 node：7');
  await step(tok);                                   // 8:06 7 points on 12
  llink(n7, n12);
  say('7 指向 12');
  await step(tok);                                   // 8:08 3 points on 7
  kill(a312);
  llink(n3, n7);
  say('3 改指向 7');
  await step(tok);                                   // 8:10 start from first: 8 → 3 → 7 → 12
  const cur = ring();
  for (const g of [n8, n3, n7, n12]) { cur.position.set(g.position.x, 0.05, g.position.z); await beat(tok, 550); }
  say('從 first 走：8 → 3 → 7 → 12');
  await step(tok);                                   // 8:22 just by changing links
  say('插入也只是改 link');
  await step(tok);                                   // 8:24 more flexible than an array
  say('比陣列有彈性', '大小可增可減，插入、刪除都容易');
  await step(tok);                                   // 8:45 remember: arrays in stack or heap
  kill(cur);
  say('整理：陣列可以建在 Stack 或 Heap');
  await step(tok);                                   // 8:52 linked list: always in heap
  region('Heap', C_HEAP, -0.5, 11.4, 1.4, 5.4, 0.8);
  say('Linked List 通常建在 Heap', '老師說「一律」太絕對：node 也可以是區域變數，只是個數就固定了');
  await step(tok);                                   // 9:01 each element allocated separately; size variable
  say('每個元素各自配置記憶體', '移除就釋放：大小是可變的');
}]);

FRAG.push(['engmisc-ll-address', 'Linked List 的位址與 head', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.3]);
  function anode(data, link, addr, x, z) {
    const d = cube(data, C_STACK, [1.0, 0.7, 1.0], x, 0.35, z);
    const k = cube(link, C_LINK, [1.1, 0.7, 1.0], x + 1.05, 0.35, z);
    tag('@' + addr, 'idx', x + 0.5, 1.15, z);
    return { d, k, x, z };
  }
  say('下一部分：Linked List 的細節');
  await step(tok);                                   // 9:17 what is a linked list, node, define, create, access
  const plan = tag('定義 → node 結構 → 建立 node → 存取成員', 'ptr alt', 0, 3.4, 0);
  say('接下來依序看', '定義、node 怎麼寫、怎麼建立、怎麼存取');
  await step(tok);                                   // 9:45 a collection of nodes: data + pointer to next
  kill(plan);
  const N = [anode(8, '210', 200, -4.8, -1.4), anode(3, '270', 210, -1.6, 0.9), anode('…', '300', 270, 1.4, -1.6), anode('…', 'NULL', 300, 4.4, 0.6)];
  for (let i = 0; i < 3; i++) arrow(V3(N[i].x + 1.6, 0.35, N[i].z), V3(N[i + 1].x - 0.5, 0.35, N[i + 1].z));
  say('Linked List：node 的集合', '每個 node = data + 指向下一個 node 的指標');
  await step(tok);                                   // 10:03 node@200: data 8, link 210
  glow(N[0].d, GOLD); glow(N[0].k, GOLD);
  say('第一個 node 在 200', 'data 8，link 存 210');
  await step(tok);                                   // 10:10 210 is this node; data 3, link 270
  glow(N[0].d); glow(N[0].k); glow(N[1].d, GOLD); glow(N[1].k, GOLD);
  say('210 就是下一個 node 的位址', '它存 data 3、link 270');
  await step(tok);                                   // 10:23 first (head) points on the first node
  glow(N[1].d); glow(N[1].k);
  const f = cube('200', C_PTR, [1.0, 0.6, 0.9], -5.5, 0.3, 2.6);
  tag('first（head）', 'ptr', -5.5, 1.2, 2.6);
  arrow(V3(-5.5, 0.3, 2.1), V3(-4.9, 0.35, -0.85));
  glow(f, GOLD); glow(N[0].d, GOLD);
  say('first 指向第一個 node', '也叫 head；第一個 node 叫 head node');
  await step(tok);                                   // 10:37 first holds 200; its own address is 100
  tag('@100', 'idx', -5.5, 0, 3.4);
  say('first 裡存 200', 'first 自己的位址是 100');
  await step(tok);                                   // 10:52 the list is created inside the heap
  glow(f); glow(N[0].d);
  region('Heap', C_HEAP, 0, 11.6, 1.6, 4.2, -0.4);
  say('這些 node 都建在 Heap');
  await step(tok);                                   // 11:04 addresses are random; real ones are in thousands
  tag('位址是隨便取的（真的通常是幾千）', 'note', 0, 2.6, -0.4);
  say('這些位址只是舉例', '真實位址通常是幾千');
  await step(tok);                                   // 11:16 in an array addresses are contiguous
  for (let i = 0; i < 4; i++) { cube('', GRAY, [0.9, 0.4, 0.6], -1.5 + i * 0.95, 0.2, -4.2); tag(String(200 + 2 * i), 'idx', -1.5 + i * 0.95, 0.7, -4.2); }
  tag('陣列', 'ptr alt', -3, 0.6, -4.2);
  say('對照陣列：200、202、204…', '一格挨一格');
  await step(tok);                                   // 11:30 here 200, 210, 270, 300: not side by side
  N.forEach((n) => glow(n.d, GOLD));
  say('Linked List：200、210、270、300', '不是一格挨一格');
  await step(tok);                                   // 11:36 continuity through links (addresses)
  N.forEach((n) => { glow(n.d); glow(n.k, GREEN); });
  say('那順序靠什麼？靠 link（位址）', '每個 node 記住下一個在哪');
}]);

FRAG.push(['engmisc-node-struct', '定義 node：self-referential structure', async (tok) => {
  fresh([0, 5, 12], [0, 2, 0]);
  say('怎麼定義一個 node？');
  await step(tok);                                   // 11:56 two things: data and pointer
  const d = cube('data', C_STACK, [2.0, 0.9, 1.2], 1.6, 0.45, 0);
  const n = cube('pointer', C_LINK, [2.0, 0.9, 1.2], 3.6, 0.45, 0);
  say('node 要兩樣東西：data 和 pointer', 'data 可以是 int、float、double…');
  await step(tok);                                   // 12:10 the pointer points to the next node
  lnode('', 5.6, 0.45, -2.2, '#9fb7cc');
  arrow(V3(4.6, 0.45, -0.3), V3(5.1, 0.45, -1.9));
  say('pointer 指向下一個 node');
  await step(tok);                                   // 12:16 a pointer of its own type
  glow(n, GOLD);
  say('下一個也是 node', '所以 pointer 的型別就是 node 自己的型別');
  await step(tok);                                   // 12:29 two members: data and next
  glow(n); relabel(n, 'next');
  say('兩個成員：data 和 next');
  await step(tok);                                   // 12:55 C structure: struct Node
  const cd = code(['struct Node {', '    int data;', '    struct Node *next;', '};'], -3.6, 5.2);
  cd.hl(0);
  say('用 C 的 structure 來寫', 'struct Node { … };');
  await step(tok);                                   // 13:09 int data
  cd.hl(1); glow(d, GOLD);
  say('int data;', '學習時通常用 int');
  await step(tok);                                   // 13:24 pointer to a node: struct Node *next
  glow(d); cd.hl(2); glow(n, GOLD);
  say('struct Node *next;', '指向「同一種 node」的指標');
  await step(tok);                                   // 14:03 self-referential structure
  glow(n); cd.hl(-1);
  tag('self-referential structure', 'ptr alt', 0.5, 3.4, 0);
  say('structure 裡有指向自己型別的指標', '叫 self-referential structure，Linked List 就靠它');
  await step(tok);                                   // 14:19 C++ also supports structure
  say('C++ 也可以用 struct', '也可以用 class');
  await step(tok);                                   // 14:35 class private, struct public
  say('差別：class 預設 private', 'struct 預設 public');
  await step(tok);                                   // 14:52 int takes 2 bytes
  const bytes = [];
  for (let i = 0; i < 2; i++) bytes.push(cube('', C_STACK, [0.9, 0.3, 0.9], 1.1 + i * 1.0, 0.15, 2.2, 2));
  say('node 多大？int 佔 2 bytes（影片假設）');
  await step(tok);                                   // 15:05 pointer also 2 bytes
  for (let i = 2; i < 4; i++) bytes.push(cube('', C_LINK, [0.9, 0.3, 0.9], 1.1 + i * 1.0, 0.15, 2.2, 2));
  say('pointer 也是 2 bytes', '影片說：int 2 bytes 的編譯器，pointer 也 2 bytes');
  await step(tok);                                   // 15:24 bytes 200, 201, 202, 203
  for (let i = 0; i < 4; i++) tag(String(200 + i), 'idx', 1.1 + i * 1.0, 0.6, 3.0);
  say('位址 200、201、202、203');
  await step(tok);                                   // 15:40 each node is 4 bytes
  bytes.forEach((b) => glow(b, '#3a3a00'));
  say('一個 node = 2 + 2 = 4 bytes');
  await step(tok);                                   // 15:42 a pointer needs only the first byte address
  bytes.forEach((b) => glow(b)); glow(bytes[0], GOLD);
  say('指標只要記第一個 byte 的位址', '所以 node 的位址 = 200');
}]);

FRAG.push(['engmisc-node-malloc', '建立 node 與存取成員', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  say('怎麼建立一個 node？');
  await step(tok);                                   // 16:00 first of all we need a pointer
  region('Stack', C_STACK, -4.6, 3.2, 1.4, 3);
  region('Heap', C_HEAP, 2.8, 6.4, 1.4, 3);
  const p = cube('p', C_PTR, [1.2, 0.7, 1.0], -4.6, 0.35, 0, 3);
  say('首先要一個指標');
  await step(tok);                                   // 16:07 nodes must be in heap: struct Node *p
  const cd = code(['struct Node *p;', 'p = malloc( ? );', 'p = new Node;          // C++', 'p->data = 10;', 'p->next = 0;            // NULL'], -2.6, 6.0);
  cd.hl(0);
  say('node 要動態建在 Heap', '所以先宣告 struct Node *p;');
  await step(tok);                                   // 16:36 C function: malloc
  cd.hl(1);
  say('C 用 malloc 在 Heap 配置');
  await step(tok);                                   // 16:47 how many bytes? 2 + 2 = 4
  txt(cd.ls[1], 'p = malloc(4);');
  say('要幾個 bytes？2 + 2 = 4');
  await step(tok);                                   // 16:53 or sizeof(struct Node)
  txt(cd.ls[1], 'p = malloc(sizeof(struct Node));');
  say('也可以寫 sizeof(struct Node)', '讓編譯器幫你算大小');
  await step(tok);                                   // 17:01 malloc returns void *: typecast
  txt(cd.ls[1], 'p = (struct Node *)malloc(sizeof(struct Node));');
  say('malloc 回傳 void *，影片強制轉型成 struct Node *', 'C 可省略（void * 會自動轉）；C++ 必須轉');
  await step(tok);                                   // 17:31 C++: p = new Node
  cd.hl(2);
  say('C++ 簡單多了：p = new Node;');
  await step(tok);                                   // 17:55 a new node is created
  const d = cube('', C_STACK, [1.2, 0.8, 1.2], 2.2, 0.4, 0, 4);
  const k = cube('', C_LINK, [1.2, 0.8, 1.2], 3.4, 0.4, 0, 4);
  tag('data', 'idx', 2.2, 0, 1.0); tag('next', 'idx', 3.4, 0, 1.0);
  say('Heap 裡建出一個新 node', '有 data 和 next 兩格');
  await step(tok);                                   // 18:06 address 500 stored in p
  tag('@500', 'idx', 2.8, 1.3, 0);
  relabel(p, '500');
  arrow(V3(-3.95, 0.35, 0), V3(1.55, 0.4, 0));
  say('新 node 在 500', 'p 存 500 → p 指向它');
  await step(tok);                                   // 18:29 members accessed with the arrow operator
  cd.hl(3); glow(d, GOLD);
  say('p 是指向 structure 的指標', '成員用箭頭 -> 存取：p->data');
  await step(tok);                                   // 18:43 assign 10
  relabel(d, 10);
  say('p->data = 10：10 存進 data');
  await step(tok);                                   // 18:56 p->next = 0: NULL
  glow(d); cd.hl(4); glow(k, GOLD);
  relabel(k, 'NULL');
  say('p->next = 0：0 就是 NULL', '不指向任何 node');
  await step(tok);                                   // 19:05 creating a node and accessing its members
  glow(k); cd.hl(-1);
  say('建立 node：malloc／new', '存取成員：->');
}]);

FRAG.push(['engmisc-ptr-move', 'q = p、q = p->next、p = p->next', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.6]);
  const xs = [-3.6, -0.6, 2.4, 5.4], addrs = [200, 210, 270, 300];
  const G = xs.map((x, i) => { const g = lnode('', x, 0.4, 0, '#9fb7cc'); tag('@' + addrs[i], 'idx', x + 0.3, 1.2, 0); return g; });
  const cd = code(['q = p;', 'q = p->next;', 'p = p->next;'], 0.8, 4.4);
  say('幾個常用的指標敘述');
  await step(tok);                                   // 19:24 a list; p points on some node
  for (let i = 0; i < 3; i++) llink(G[i], G[i + 1]);
  const pb = cube('200', C_PTR, [1.0, 0.6, 0.8], -6, 0.3, 2.8);
  tag('p', 'ptr', -6.6, 1.0, 2.8);
  const pl = tag('p', 'ptr', xs[0], 0.4, 1.4);
  say('p 指向位址 200 的 node');
  await step(tok);                                   // 19:35 also one pointer q
  const qb = cube(' ', C_PTR, [1.0, 0.6, 0.8], -6, 0.3, 4.4);
  tag('q', 'ptr alt', -6.6, 1.0, 4.4);
  const ql = tag('q', 'ptr alt', xs[0], 0.4, 2.2); showL(ql, false);
  say('另外有一個指標 q');
  await step(tok);                                   // 19:41 q = p
  cd.hl(0);
  say('q = p 是什麼意思？');
  await step(tok);                                   // 19:49 what is in p is stored in q: 200
  relabel(qb, '200'); showL(ql, true);
  say('p 裡的 200 複製到 q', 'q 也指向 200');
  await step(tok);                                   // 20:10 two pointers on the same node
  glow(G[0].userData.data, GOLD);
  say('兩個指標指向同一個 node');
  await step(tok);                                   // 20:18 q = p->next
  glow(G[0].userData.data);
  cd.hl(1);
  say('q = p->next 呢？');
  await step(tok);                                   // 20:29 p is 200, its next is 210
  glow(G[0].children[1], GOLD);
  say('p 是 200，它的 next 欄位存 210');
  await step(tok);                                   // 20:38 q gets 210: q on the next node
  glow(G[0].children[1]);
  relabel(qb, '210');
  await anim(tok, 700, (t) => ql.position.set(xs[0] + (xs[1] - xs[0]) * t, 0.4, 2.2));
  say('q 拿到 210', 'q 指向 p 的下一個 node');
  await step(tok);                                   // 21:04 p = p->next
  cd.hl(2);
  say('p = p->next 呢？', '讓 p 指向自己的下一個 node');
  await step(tok);                                   // 21:30 210 is stored in p
  glow(G[0].children[1], GOLD);
  relabel(pb, '210');
  say('p->next 是 210', '把 210 存回 p 自己');
  await step(tok);                                   // 21:37 p is now pointing on the next node
  glow(G[0].children[1]);
  await anim(tok, 700, (t) => pl.position.set(xs[0] + (xs[1] - xs[0]) * t, 0.4, 1.4));
  say('p 不再指 200 的 node', '移到 210 的 node 了');
  await step(tok);                                   // 21:47 p moved to the next node: very useful
  cd.hl(-1); cls(cd.ls[2], 'ptr alt');
  say('p = p->next：讓 p 往下走一格', '走訪 Linked List 最常用的一行');
}]);

FRAG.push(['engmisc-null-check', '判斷 pointer 是不是 NULL', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.5, 0]);
  say('換一個例子：檢查指標');
  await step(tok);                                   // 22:21 two examples
  const p1 = cube(' ', C_PTR, [1.2, 0.7, 1.0], -4.5, 0.35, 1.2); tag('情況一：p 不指向任何 node', 'ptr', -4.5, 1.3, 1.2);
  const p2 = cube('200', C_PTR, [1.2, 0.7, 1.0], 1.0, 0.35, 1.2); tag('情況二：p 指向某個 node', 'ptr', 1.0, 1.3, 1.2);
  lnode('', 4.4, 0.4, 1.2, '#9fb7cc'); arrow(V3(1.65, 0.35, 1.2), V3(3.88, 0.4, 1.2));
  say('兩種情況', 'p 沒指向 node；p 指向某個 node');
  await step(tok);                                   // 22:36 p = 0 or p = NULL
  relabel(p1, '0');
  const ex = tag('p = 0;　或　p = NULL;', 'ptr alt', 0, 4.2, 0);
  say('讓 p 變 NULL：寫 0 或 NULL 都可以', '兩者一樣');
  await step(tok);                                   // 23:05 not pointing → 0; pointing → non-zero
  say('沒指向 node：值是 0', '有指向：是一個不為 0 的有效位址');
  await step(tok);                                   // 23:15 0 is false, non-zero is true
  glow(p1, RED); glow(p2, GREEN);
  txt(ex, 'C／C++：0 = false，非 0 = true');
  say('C／C++：0 是 false，非 0 是 true', '情況一 false，情況二 true');
  await step(tok);                                   // 23:45 if (p == NULL)
  glow(p1); glow(p2); kill(ex);
  const cd = code(['if (p == NULL)', 'if (p == 0)', 'if (!p)', 'if (p != NULL)', 'if (p != 0)', 'if (p)'], 0, 5.0);
  cd.ls.forEach((l, i) => { if (i) showL(l, false); });
  cd.hl(0); glow(p1, GOLD);
  say('if (p == NULL)', '情況一成立：p 沒指向任何 node');
  await step(tok);                                   // 24:09 if (p == 0)
  showL(cd.ls[1], true); cd.hl(1);
  say('if (p == 0)', '一樣是情況一成立');
  await step(tok);                                   // 24:21 if (!p)
  showL(cd.ls[2], true); cd.hl(2);
  say('if (!p)', 'p 是 0 → false，!false → true');
  await step(tok);                                   // 24:43 three methods to check NULL
  cd.hl(-1);
  say('三種寫法：檢查 p 是不是 NULL');
  await step(tok);                                   // 25:05 inverse: if (p != NULL)
  glow(p1); glow(p2, GOLD);
  showL(cd.ls[3], true); cd.hl(3);
  say('反過來：if (p != NULL)', '情況二成立：p 有指向 node');
  await step(tok);                                   // 25:26 if (p != 0)
  showL(cd.ls[4], true); cd.hl(4);
  say('if (p != 0)');
  await step(tok);                                   // 25:33 if (p): 200 is true
  showL(cd.ls[5], true); cd.hl(5);
  say('if (p)', 'p = 200 → 非 0 → true');
  await step(tok);                                   // 25:52 important conditions
  cd.hl(-1); glow(p2);
  say('三種 vs 三種，寫法等價', '看到都要認得');
}]);

FRAG.push(['engmisc-last-node', 'p->next == NULL：最後一個 node', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const xs = [-4.5, -1.2, 2.1];
  const G = xs.map((x) => lnode('', x, 0.4, 0, '#9fb7cc'));
  llink(G[0], G[1]); llink(G[1], G[2]); nullAfter(G[2]);
  const pl = tag('p', 'ptr', xs[1], 0.4, 1.3);
  const cd = code(['if (p->next == NULL)   // p 是最後一個', 'if (p->next != NULL)   // p 後面還有'], -0.6, 4.4);
  say('再一個條件');
  await step(tok);                                   // 26:03 after node p: more nodes, or last?
  say('node p 後面還有沒有 node？', '還是 p 就是最後一個？');
  await step(tok);                                   // 26:08 if (p->next == NULL)
  cd.hl(0);
  await anim(tok, 600, (t) => pl.position.set(xs[1] + (xs[2] - xs[1]) * t, 0.4, 1.3));
  say('看 p->next', 'if (p->next == NULL)');
  await step(tok);                                   // 26:24 it is 0: p is the last node
  glow(G[2].children[1], GOLD);
  say('next 是 0：後面沒有 node', '成立 → p 是最後一個 node');
  await step(tok);                                   // 26:40 if (p->next != NULL): an address is there
  glow(G[2].children[1]);
  cd.hl(1);
  await anim(tok, 600, (t) => pl.position.set(xs[2] + (xs[1] - xs[2]) * t, 0.4, 1.3));
  glow(G[1].children[1], GREEN);
  say('if (p->next != NULL)', 'next 裡有位址 → p 後面還有 node');
  await step(tok);                                   // 26:56 we usually need these checks
  glow(G[1].children[1]); cd.hl(-1);
  say('p == NULL：p 沒指向 node', 'p->next == NULL：p 是最後一個');
}]);

// ════════ PdvGEI-P3-M：Stack vs Heap ════════
function memLayout() {
  return [region('Code', C_CODE, -4.3, 3.0, 5.2, 2.6), region('Stack', C_STACK, 0, 3.0, 5.2, 2.6), region('Heap', C_HEAP, 4.3, 3.0, 5.2, 2.6)];
}
FRAG.push(['engmisc-mem-code', 'Main memory 與 code section', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  say('Stack 和 Heap 差在哪？', '先認識電腦的記憶體');
  await step(tok);                                   // 0:23 memory divided into three major sections
  const mm = region('Main memory', '#9b8b72', 0, 11.6, 5.2, 2.6);
  say('記憶體分成三大區');
  await step(tok);                                   // 0:42 code section, stack, heap
  kill(mm.userData.title); kill(mm);
  memLayout();
  say('Code、Stack、Heap');
  await step(tok);                                   // 0:56 if I write a program
  const src = cube('C 程式', '#9fb7cc', [1.6, 0.8, 1.2], -6.2, 4.6, 3.2);
  say('寫一個程式，看三區怎麼被使用');
  await step(tok);                                   // 1:04 declaring some variables
  const cd = code(['int a, b, c;', '…'], -6.2, 6.4, 0.5, 3.2);
  say('程式裡宣告了一些變數', 'int a, b, c; …');
  await step(tok);                                   // 1:14 compile → machine code
  relabel(src, '機器碼'); tint(src, '#7a6a52'); cd.kill();
  say('compile：C 程式 → machine code');
  await step(tok);                                   // 1:37 machine code brought into code section: loading
  move(src, -4.3, 0.4, 0);
  say('要執行：機器碼搬進 Code 區', '這叫 loading');
  await step(tok);                                   // 1:56 like loading a DVD into the player
  say('就像看 DVD 要先放進播放器');
  await step(tok);                                   // 2:16 CPU executes one instruction at a time
  kill(src);
  const ins = [];
  for (let i = 0; i < 4; i++) ins.push(cube('指令 ' + (4 - i), C_CODE, [2.4, 0.5, 1.6], -4.3, 0.25 + i * 0.55, 0));
  for (let i = 3; i >= 0; i--) { glow(ins[i], GOLD); await beat(tok, 450); glow(ins[i]); }
  say('CPU 一次拿一個指令來執行');
  await step(tok);                                   // 2:25 code section holds the program
  say('Code 區：放程式本身');
}]);

FRAG.push(['engmisc-mem-stack', 'Stack：靜態大小、直接存取', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  cube('main', C_CODE, [2.4, 1.2, 1.6], -4.3, 0.6, 0);
  const cd = code(['int a, b, c;'], -4.3, 6.4);
  say('接著看 Stack');
  await step(tok);                                   // 2:36 the program has three variables
  cd.hl(0);
  say('程式宣告了三個變數', '它們需要記憶體');
  await step(tok);                                   // 2:45 allocated from stack once the program starts
  const fr = ghostBox(C_STACK, 2.6, 2.0, 2.0); fr.position.set(0, 1.0, 0);
  const V = [];
  for (const [i, nm] of [[0, 'a'], [1, 'b'], [2, 'c']]) { V.push(cube(nm, C_STACK, [1.6, 0.55, 1.2], 0, 0.3 + i * 0.6, 0, 3)); await beat(tok, 300); }
  say('程式一開始執行，就從 Stack 配置 a、b、c');
  await step(tok);                                   // 3:07 allocation is done at run time
  say('配置發生在 runtime（執行時）');
  await step(tok);                                   // 3:11 how much: decided at compile time
  say('但要多少空間，compile time 就決定了', '看宣告了哪些變數');
  await step(tok);                                   // 3:26 size static, allocation dynamic
  tag('size：static　allocation：dynamic', 'ptr alt', 0, 6.0, 0);
  say('大小是靜態的，配置是動態的');
  await step(tok);                                   // 3:48 program directly accesses stack by address
  cd.hl(-1);
  say('程式可以直接用位址存取 Stack');
  await step(tok);                                   // 4:04 addresses 1000, 1002, 1004
  V.forEach((v, i) => tag(String(1000 + 2 * i), 'idx', -1.7, 0.3 + i * 0.6, 0));
  say('假設 a 在 1000、b 在 1002、c 在 1004');
  await step(tok);                                   // 4:12 accesses them directly using addresses
  for (const v of V) { glow(v, GOLD); const a = arrow(V3(-3.0, 0.6, 0), V3(-0.85, v.position.y, 0)); await beat(tok, 500); kill(a); glow(v); }
  arrow(V3(-3.0, 0.6, 0), V3(-0.85, 0.9, 0), 0x0f5a3a);
  say('直接照位址去拿');
  await step(tok);                                   // 4:21 this block is the activation record
  tag('main 的 activation record', 'ptr alt', 0, 2.5, 1.4);
  say('main 在 Stack 上的這一塊', '叫 activation record');
  await step(tok);                                   // 4:25 also called stack frame
  tag('（stack frame）', 'idx', 0, 2.1, 1.4);
  say('也叫 stack frame');
  await step(tok);                                   // 4:48 stack memory accessed directly
  say('重點一：Stack 可以直接存取');
  await step(tok);                                   // 5:00 the size is static, pre-decided by the compiler
  tag('大小：編譯時就決定', 'note', 0, 3.1, 1.4);
  say('重點二：Stack 的大小是靜態的', '編譯器事先決定好');
  await step(tok);                                   // 5:23 two important things about the stack
  V.forEach((v) => glow(v, GREEN));
  say('Stack：直接存取、大小靜態');
}]);

FRAG.push(['engmisc-mem-heap', 'Heap：透過 pointer 間接存取', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  cube('main', C_CODE, [2.4, 1.2, 1.6], -4.3, 0.6, 0);
  const cd = code(['int a, b, c;', 'int *p;', 'p = malloc(10);'], -4.3, 6.9);
  showL(cd.ls[1], false); showL(cd.ls[2], false);
  say('接著看 Heap');
  await step(tok);                                   // 6:08 the program can directly access only the stack
  arrow(V3(-3.0, 1.0, 0), V3(-0.8, 1.0, 0), 0x0f5a3a);
  tag('直接 ✓', 'good', -1.9, 1.7, 0);
  say('程式只能直接存取 Stack');
  await step(tok);                                   // 6:17 it cannot access heap directly
  const x = tag('直接進 Heap ✗', 'bad', 3.0, 3.6, 0);
  say('不能直接存取 Heap', '那要怎麼用 Heap？');
  await step(tok);                                   // 6:28 why is heap required?
  kill(x);
  say('先想：為什麼需要 Heap？');
  await step(tok);                                   // 6:50 more memory than the declared variables
  say('執行時可能需要更多記憶體', '比宣告的變數還多');
  await step(tok);                                   // 7:00 get it from heap during runtime
  say('就要在 runtime 向 Heap 要');
  await step(tok);                                   // 7:14 the user decides how much
  say('要多少？使用者用程式時才決定');
  await step(tok);                                   // 7:21 pre-plan: declare an integer pointer
  showL(cd.ls[1], true); cd.hl(1);
  say('寫程式時先準備一個指標', 'int *p;');
  await step(tok);                                   // 7:32 this pointer helps access heap
  say('靠這個指標去存取 Heap');
  await step(tok);                                   // 7:45 variables allocated from stack
  cd.hl(0);
  for (let i = 0; i < 3; i++) { cube('abc'[i], C_STACK, [1.6, 0.5, 1.2], 0, 0.3 + i * 0.55, 0, 3); await beat(tok, 200); }
  say('程式載入後，變數在 Stack 配置');
  await step(tok);                                   // 8:33 memory for p is also allocated (stack)
  cd.hl(1);
  const p = cube('p', C_PTR, [1.6, 0.5, 1.2], 0, 1.95, 0, 3);
  say('p 也一樣配置在 Stack');
  await step(tok);                                   // 8:56 p = malloc(10)
  showL(cd.ls[2], true); cd.hl(2);
  say('程式某處寫 p = malloc(10)');
  await step(tok);                                   // 9:12 10 bytes allocated from heap
  const h = cube('10 bytes', C_HEAP, [2.4, 0.9, 1.6], 4.3, 0.45, 0, 4);
  say('從 Heap 配置 10 bytes');
  await step(tok);                                   // 9:28 beginning address 5000
  tag('@5000', 'idx', 4.3, 1.3, 1.0);
  say('這塊的起始位址：假設 5000');
  await step(tok);                                   // 9:35 5000 stored in p, p points to it
  relabel(p, '5000');
  arrow(V3(0.85, 1.95, 0), V3(3.05, 0.6, 0), 0xa8730f);
  say('5000 存進 p', 'p 指向這塊記憶體');
  await step(tok);                                   // 9:44 not directly, but with the pointer
  cd.hl(-1);
  glow(p, GOLD);
  say('程式先直接讀 p……');
  await step(tok);                                   // 9:50 the pointer gives the address
  glow(p); glow(h, GOLD);
  say('……p 給出位址，再去 Heap', '間接存取');
  await step(tok);                                   // 9:55 indirect; size decided at runtime
  glow(h);
  say('Heap：間接存取', '大小在 runtime 決定（dynamic）');
}]);

FRAG.push(['engmisc-mem-compare', 'Stack 與 Heap 的兩大差異', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  memLayout();
  const s = cube('a b c p', C_STACK, [2.2, 0.9, 1.6], 0, 0.45, 0);
  const h = cube('malloc', C_HEAP, [2.2, 0.9, 1.6], 4.3, 0.45, 0);
  arrow(V3(1.15, 0.45, 0), V3(3.15, 0.45, 0));
  say('總結');
  await step(tok);                                   // 10:22 two major differences
  say('Stack 和 Heap 的兩大差異');
  await step(tok);                                   // 10:27 stack is directly accessible
  glow(s, GOLD);
  tag('① 直接存取', 'good', 0, 5.9, 1.4);
  say('差異一：Stack 直接存取');
  await step(tok);                                   // 10:30 heap is indirectly accessible
  glow(s); glow(h, GOLD);
  tag('① 間接（靠 pointer）', 'bad', 4.3, 5.9, 1.4);
  say('Heap 間接存取', '要透過 pointer');
  await step(tok);                                   // 10:33 stack size pre-decided
  glow(h); glow(s, GOLD);
  tag('② 大小事先決定', 'good', 0, 5.3, 1.4);
  say('差異二：Stack 的大小事先決定', '看宣告了幾個變數');
  await step(tok);                                   // 10:44 heap: not variables but malloc + pointer
  glow(s); glow(h, GOLD);
  tag('② runtime 用 malloc 要', 'bad', 4.3, 5.3, 1.4);
  say('Heap 不靠變數', '靠 malloc 加上 pointer');
  await step(tok);                                   // 10:54 pointer compulsory for heap
  glow(h);
  say('要存取 Heap，一定需要 pointer');
}]);

// ════════ ygK0YON10sQ：Recursion 與 Stack ════════
FRAG.push(['engmisc-rec-memory', 'Main memory 與 activation record', async (tok) => {
  fresh([0, 6.5, 14], [0, 2.6, 0]);
  say('先看程式和記憶體');
  await step(tok);                                   // 0:38 statements in two categories
  const cd = code(['void main() {', '    int x = 10;    // data', '    x++;           // instruction', '}'], -2.2, 7.6, 0.5);
  say('程式裡的敘述分成兩類');
  await step(tok);                                   // 0:50 variables as data
  cd.hl(1);
  say('變數：data（資料）');
  await step(tok);                                   // 0:57 other statements as instructions
  cd.hl(2);
  say('其他敘述：instructions（指令）');
  await step(tok);                                   // 1:09 main memory (RAM)
  cd.hl(-1);
  const mm = region('Main memory（RAM）', '#9b8b72', 0, 13.0, 5.2, 2.4);
  say('主記憶體，也叫 RAM');
  await step(tok);                                   // 1:18 one portion occupied by the OS
  kill(mm.userData.title); kill(mm);
  region('OS', '#9b8b72', -5.25, 2.6, 5.2, 2.4);
  say('一部分給作業系統（OS）');
  await step(tok);                                   // 1:25 remaining divided into three sections
  region('Code', C_CODE, -1.75, 2.6, 5.2, 2.4);
  region('Stack', C_STACK, 1.75, 2.6, 5.2, 2.4);
  region('Heap', C_HEAP, 5.25, 2.6, 5.2, 2.4);
  say('剩下的分成三區，給我們的程式用');
  await step(tok);                                   // 1:33 code: instructions
  const ins = cube('指令', C_CODE, [2.2, 1.0, 1.6], -1.75, 0.5, 0);
  glow(ins, GOLD);
  say('Code 區：放程式的指令');
  await step(tok);                                   // 1:41 stack: variables of a function
  glow(ins);
  say('Stack：放函式的變數（data）');
  await step(tok);                                   // 1:52 heap: dynamic allocation
  say('Heap：動態配置記憶體用');
  await step(tok);                                   // 2:03 a small portion for global / static
  cube('global/static', '#e0a64a', [2.2, 0.5, 1.6], -1.75, 4.6, 0);
  say('另一小塊放 global、static 變數', '老師說屬於 Code；教科書叫 data segment');
  await step(tok);                                   // 2:33 machine code loaded into code
  relabel(ins, 'main 機器碼');
  say('執行時：機器碼載入 Code 區');
  await step(tok);                                   // 2:41 variables allocated inside the stack
  const ar = cube('main：x = 10', C_STACK, [2.2, 0.8, 1.6], 1.75, 0.4, 0, 4);
  say('main 的變數在 Stack 配置');
  await step(tok);                                   // 3:06 this portion: activation record of main
  glow(ar, GOLD);
  say('屬於 main 的這一塊', '叫 activation record');
  await step(tok);                                   // 3:11 instructions access data from the stack
  arrow(V3(-0.6, 0.5, 0), V3(0.6, 0.4, 0));
  say('main 的指令要用 x 時', '就到 Stack 上自己的 record 去拿');
  await step(tok);                                   // 3:35 created when the function is called
  glow(ar);
  say('activation record 在函式被呼叫時建立');
  await step(tok);                                   // 3:48 for every function
  say('每個函式都有自己的 activation record');
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
  say('函式呼叫時，Stack 怎麼變？');
  await step(tok);                                   // 4:00 an example
  const T = traceStage(['void A(int a) {', '    printf("%d", a);', '}', 'void main() {', '    int x = 10;', '    x++;', '    A(x);', '}']);
  say('來看一個例子');
  await step(tok);                                   // 4:08 main increments x, passes 11 to A, A prints 11
  T.cd.hl(6);
  say('main 把 x 加 1，把 11 傳給 A', 'A 印出 11');
  await step(tok);                                   // 4:24 program loaded in the code section
  T.cd.hl(-1);
  say('程式先載入 Code 區');
  await step(tok);                                   // 4:31 activation record for main
  T.cd.hl(4);
  const m = T.push('main：x = 10');
  say('建立 main 的 activation record');
  await step(tok);                                   // 4:39 x++
  T.cd.hl(5); relabel(m, 'main：x = 11');
  say('x++：x 變 11');
  await step(tok);                                   // 4:47 A is called: its record is created
  T.cd.hl(6);
  T.push('A：a = 11');
  say('呼叫 A：A 的 activation record', '疊在 main 上面');
  await step(tok);                                   // 5:02 main has not yet terminated
  glow(m, '#3a3a00');
  say('main 還沒結束', '它只是在等 A');
  await step(tok);                                   // 5:17 running function accesses the topmost record
  glow(m);
  T.cd.hl(1);
  say('正在執行的 A', '只用 Stack 最上面那一層');
  await step(tok);                                   // 5:41 when a function terminates, its record is deleted
  say('函式結束時', '它的 activation record 就刪掉');
  await step(tok);                                   // 5:52 A prints 11
  txt(T.out, '輸出：11');
  say('A 印出 11');
  await step(tok);                                   // 5:55 A ended: record gone
  T.cd.hl(2); T.pop();
  say('A 結束：record 刪掉');
  await step(tok);                                   // 5:58 main ended: record gone
  T.cd.hl(7); T.pop();
  say('main 結束：record 也刪掉');
  await step(tok);                                   // 6:04 the stack is clear
  T.cd.hl(-1);
  say('Stack 清空了');
  await step(tok);                                   // 6:11 one above another; topmost is running
  say('呼叫一次就疊一層', '執行中的函式用最上面那層');
}]);

FRAG.push(['engmisc-rec-nested', '巢狀呼叫：main → A → B', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  say('巢狀呼叫的例子');
  await step(tok);                                   // 6:30 main calls A, A calls B
  const T = traceStage(['main 呼叫 A(11)', 'A 呼叫 B(22)', 'B 印出 k = 22']);
  say('main 呼叫 A，A 再呼叫 B');
  await step(tok);                                   // 6:36 main calls A passing 11
  T.cd.hl(0);
  say('main 呼叫 A，傳 11');
  await step(tok);                                   // 6:42 then calls B passing 22
  T.cd.hl(1);
  say('A 呼叫 B，傳 22');
  await step(tok);                                   // 6:46 B prints 22
  T.cd.hl(2);
  say('B 印出 22');
  await step(tok);                                   // 6:53 record for main created
  T.cd.hl(-1);
  T.push('main');
  say('執行：先建立 main 的 record');
  await step(tok);                                   // 7:03 main calls A: A's record
  T.cd.hl(0); T.push('A：a = 11');
  say('main 呼叫 A', 'A 的 record 疊上去');
  await step(tok);                                   // 7:11 A calls B: B's record
  T.cd.hl(1); T.push('B：k = 22');
  say('A 呼叫 B', 'B 的 record 再疊上去');
  await step(tok);                                   // 7:15 B prints 22
  T.cd.hl(2); txt(T.out, '輸出：22');
  say('B 印出 22', 'Stack：main、A、B 三層');
  await step(tok);                                   // 7:21 B ends: record gone
  T.cd.hl(-1); T.pop();
  say('B 結束：record 移除');
  await step(tok);                                   // 7:25 A ends: record gone
  T.pop();
  say('A 結束：record 移除');
  await step(tok);                                   // 7:29 main ends: stack clear
  T.pop();
  say('main 結束：Stack 清空', '後呼叫的先結束（LIFO）');
}]);

FRAG.push(['engmisc-rec-tail', '遞迴：先印再呼叫（印 3 2 1）', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  say('遞迴（recursion）');
  await step(tok);                                   // 7:36 recursive functions call themselves
  const def = tag('遞迴：函式呼叫自己', 'ptr alt', -2.8, 5.8, 0);
  say('自己呼叫自己的函式', '叫 recursive function');
  await step(tok);                                   // 7:45 must have a termination condition
  txt(def, '遞迴：函式呼叫自己 + 終止條件');
  say('一定要有終止條件', '否則會一直呼叫下去');
  await step(tok);                                   // 8:03 an example of recursion
  kill(def);
  const T = traceStage(['void A(int n) {', '    if (n > 0) {', '        printf("%d ", n);', '        A(n - 1);', '    }', '}', 'main() { A(3); }']);
  say('例子：A(n) 先印 n，再呼叫 A(n − 1)');
  await step(tok);                                   // 8:16 main calls A(3): prints 3, calls A(2)
  const tr = tag('A(3)：印 3 → A(2)', 'note', -3.8, 2.4, 0);
  T.cd.hl(6);
  say('main 呼叫 A(3)', 'A(3) 印 3，再呼叫 A(2)');
  await step(tok);                                   // 8:29 print 2, call 1, print 1, call 0
  txt(tr, 'A(3) 印 3 → A(2) 印 2 → A(1) 印 1 → A(0) 停');
  say('A(2) 印 2 → A(1) 印 1 → A(0)', '直到 n 變 0 為止');
  await step(tok);                                   // 8:48 last statement is the recursive call: tail recursion
  T.cd.hl(3);
  say('遞迴呼叫是最後一個敘述', '這種叫 tail recursion');
  await step(tok);                                   // 9:05 loaded; record for main
  T.cd.hl(6); T.push('main');
  say('執行：建立 main 的 record');
  await step(tok);                                   // 9:11 A is called: record created
  T.push('A：n = 3');
  say('呼叫 A(3)：建立它的 record');
  await step(tok);                                   // 9:15 condition checked, 3 printed
  T.cd.hl(1); await beat(tok, 500);
  T.cd.hl(2); txt(T.out, '輸出：3');
  say('3 > 0 成立 → 印出 3');
  await step(tok);                                   // 9:25 calling again: a new record
  T.cd.hl(3); T.push('A：n = 2');
  say('再呼叫自己：A(2)', '又建一個新的 record');
  await step(tok);                                   // 9:31 same function starts again from the beginning
  T.cd.hl(0);
  say('同一個函式從頭開始跑', '這次用的是新的 record（n = 2）');
  await step(tok);                                   // 9:37 the old record remains: not terminated
  glow(T.frames[1], '#3a3a00');
  say('舊的 record（n = 3）還留著', '因為它還沒結束');
  await step(tok);                                   // 9:44 second call: check, print
  glow(T.frames[1]);
  T.cd.hl(2); txt(T.out, '輸出：3 2');
  say('檢查 2 > 0 → 印出 2');
  await step(tok);                                   // 9:56 new record again
  T.cd.hl(3); T.push('A：n = 1');
  say('再呼叫自己：A(1)');
  await step(tok);                                   // 10:03 value printed
  T.cd.hl(2); txt(T.out, '輸出：3 2 1');
  say('印出 1');
  await step(tok);                                   // 10:07 calls itself again
  T.cd.hl(3); T.push('A：n = 0');
  say('再呼叫：A(0)');
  await step(tok);                                   // 10:11 condition failed: terminated
  T.cd.hl(1);
  say('0 > 0 不成立', '這次呼叫結束');
  await step(tok);                                   // 10:19 its record is gone
  T.pop();
  say('A(0) 的 record 移除');
  await step(tok);                                   // 10:25 back to the previous call: n = 1
  T.cd.hl(4);
  say('回到上一層：n = 1', '呼叫已是最後一行，沒事要做');
  await step(tok);                                   // 10:31 goes back and terminates
  T.pop();
  say('n = 1 那層結束');
  await step(tok);                                   // 10:37 next record gone, previous gone
  T.pop(); await beat(tok, 600); T.pop();
  say('n = 2、n = 3 依序結束');
  await step(tok);                                   // 10:44 main ended
  T.cd.hl(-1); T.pop();
  say('main 結束：輸出 3 2 1', '呼叫的時候就印了');
}]);

FRAG.push(['engmisc-rec-head', '遞迴：先呼叫再印（印 1 2 3）', async (tok) => {
  fresh([0, 6, 13.5], [0, 2.6, 0]);
  say('第二個例子');
  await step(tok);                                   // 10:52 recursive call first, then printf
  const T = traceStage(['void A(int n) {', '    if (n > 0) {', '        A(n - 1);', '        printf("%d ", n);', '    }', '}', 'main() { A(3); }']);
  T.cd.hl(2);
  say('只改順序：先遞迴呼叫，再 printf');
  await step(tok);                                   // 11:01 A(3) → A(2) → A(1) → A(0)
  const tr = tag('A(3) → A(2) → A(1) → A(0)', 'note', -3.8, 2.4, 0);
  say('main 呼叫 A(3)，接著 A(2)、A(1)、A(0)');
  await step(tok);                                   // 11:13 goes back and prints 1, 2, 3
  txt(tr, 'A(3) → A(2) → A(1) → A(0)，返回時印 1、2、3');
  say('然後一層層回去', '回去時才印 1、2、3');
  await step(tok);                                   // 11:21 difference from the previous example
  say('例一：印完再呼叫', '例二：呼叫完再印');
  await step(tok);                                   // 11:38 record for main
  T.cd.hl(6); T.push('main');
  say('執行：建立 main 的 record');
  await step(tok);                                   // 11:42 A(3) is called: record created
  T.push('A：n = 3');
  say('呼叫 A(3)：建立 record');
  await step(tok);                                   // 11:46 condition checked, call itself with 2
  T.cd.hl(2); T.push('A：n = 2');
  say('3 > 0 → 呼叫 A(2)', '還沒印！');
  await step(tok);                                   // 11:55 checked again, call with 1
  T.push('A：n = 1');
  say('2 > 0 → 呼叫 A(1)');
  await step(tok);                                   // 12:04 call with 0
  T.push('A：n = 0');
  say('1 > 0 → 呼叫 A(0)');
  await step(tok);                                   // 12:07 condition fails
  T.cd.hl(1);
  say('0 > 0 不成立');
  await step(tok);                                   // 12:13 function terminates: record gone
  T.pop();
  say('A(0) 結束，record 移除');
  await step(tok);                                   // 12:21 back to the previous call: now it prints
  T.cd.hl(3);
  say('回到 n = 1 那層', '呼叫做完了，接著執行 printf');
  await step(tok);                                   // 12:28 print 1
  txt(T.out, '輸出：1');
  say('印出 1');
  await step(tok);                                   // 12:31 this call terminated
  T.pop();
  say('n = 1 結束');
  await step(tok);                                   // 12:36 back: n was 2, print 2
  txt(T.out, '輸出：1 2');
  say('回到 n = 2：印出 2');
  await step(tok);                                   // 12:40 terminated
  T.pop();
  say('n = 2 結束');
  await step(tok);                                   // 12:45 n was 3: print 3
  txt(T.out, '輸出：1 2 3');
  say('回到 n = 3：印出 3');
  await step(tok);                                   // 12:48 while returning it prints
  T.pop();
  say('返回的時候才印');
  await step(tok);                                   // 12:51 main has gone
  T.cd.hl(-1); T.pop();
  say('main 結束：輸出 1 2 3', '最多同時 5 層：main + A(3)…A(0)');
}]);
  }

  // ═══ lllin.js ═══
  {
// ─── lllin：pAs8Swu1Y3Y（台大林軒田 DSA：Linked List 應用：Sparse Vector、Running Cursors、面試題） ───
// cued scenes: every `await step(tok)` waits for the sentence the lecturer is saying; beats are motion only
const step = ctx.step;
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
  const h = tag(name, 'ptr', dx(vec[0][0]), 1.35, z);
  return { ns, ars, h };
}

// ════════ 15:15 回顧：singly / doubly ════════
FRAG.push(['lllin-recap', '回顧：Singly 與 Doubly Linked List', async (tok) => {
  fresh([0, 7.5, 12.5], [0, 0.4, 0.3]);
  const vals = [3, 7, 1, 9], xs = [-4.5, -1.5, 1.5, 4.5];
  await step(tok);                                   // 15:29 一開始有 singly linked list
  say('Singly linked list：一塊一塊的記憶體', 'node = data + link');
  const ns = [];
  for (let i = 0; i < 4; i++) { ns.push(nd(vals[i], xs[i], 0.35, -1.8, null, 4)); await beat(tok, 300); }
  await step(tok);                                   // 15:43 指標＝小紙條，把記憶體串起來
  say('指標：指向記憶體位置的小紙條', '一塊接一塊串起來，像大地遊戲的關卡');
  for (let i = 0; i < 3; i++) { lk(xs[i], xs[i + 1], -1.8); await beat(tok, 300); }
  tag('NULL', 'idx', xs[3] + 1.6, 0.35, -1.8);
  await step(tok);                                   // 15:57 進去的地方叫 head，一路走到結尾
  tag('head', 'ptr', xs[0], 1.4, -1.8);
  say('進去的地方叫 head，一路走到結尾', 'head → 3 → 7 → 1 → 9 → NULL');
  const p = tag('p', 'ptr alt', xs[0], 2.0, -1.8);
  for (let i = 0; i < 4; i++) {
    p.position.set(xs[i], 2.0, -1.8); glow(ns[i].userData.data, GOLD);
    await beat(tok, 450); glow(ns[i].userData.data, null);
  }
  kill(p);
  await step(tok);                                   // 16:04 也可以反著串
  say('Doubly：正著串、也反著串', 'node = prev + data + next');
  for (let i = 0; i < 4; i++) {
    nd(vals[i], xs[i], 0.35, 2.0, null, 4);
    cube('', '#d8c29b', [0.45, 0.7, 1.0], xs[i] - 0.73, 0.35, 2.0, 4);
    await beat(tok, 250);
  }
  for (let i = 0; i < 3; i++) {
    arrow(V3(xs[i] + 0.95, 0.55, 2.0), V3(xs[i + 1] - 0.95, 0.55, 2.0));
    arrow(V3(xs[i + 1] - 0.95, 0.15, 2.0), V3(xs[i] + 0.95, 0.15, 2.0), A_GOLD);
    await beat(tok, 250);
  }
  await step(tok);                                   // 16:14 從頭一串、從尾一串 = doubly linked list
  tag('head', 'ptr', xs[0], 1.4, 2.0); tag('tail', 'ptr alt', xs[3], 1.4, 2.0);
  say('從頭串一串、從尾串一串', 'doubly linked list：head 與 tail 都能出發');
  await step(tok);                                   // 16:27 講完一個 DS，就講它在哪有用
  say('講完一個 DS，就看它在哪裡有用', '這門課的習慣');
  await step(tok);                                   // 16:53 手上三五種 DS，依情境選
  say('手上有好幾種 DS：依情境比較好壞來選', '不是「只能用這個」');
}]);

// ════════ 17:24 Sparse Vector ════════
FRAG.push(['lllin-sparse', 'Sparse Vector：只存非零項', async (tok) => {
  fresh([0, 7, 12], [0, 0.8, 0.5]);
  const V = [0, 0, 6, 0, 4, 0, 0], xs = (i) => -4.5 + i * 1.5;
  await step(tok);                                   // 17:23 情境：Sparse Vector；向量是一串數字
  say('情境：Sparse Vector', '向量 = 一串數字（這裡是 7 維）');
  const cs = V.map((v, i) => { tag(String(i + 1), 'idx', xs(i), 0, -0.6); return cube(v, v ? LB : '#c9bfae', [1.1, 0.8, 1.1], xs(i), 0.4, -1.6, 3 + i * 0.3); });
  tag('第幾維（從 1 數）', 'idx', 0, 0, 0.2);
  await step(tok);                                   // 18:32 一堆 0，只有 6 和 4 不是 0
  glow(cs[2], GOLD); glow(cs[4], GOLD);
  say('只有 6 和 4 不是 0', 'v = (0, 0, 6, 0, 4, 0, 0)');
  await step(tok);                                   // 18:41 科學、工程計算常有很多 0
  say('科學、工程計算的向量和矩陣：很多 0', '');
  await step(tok);                                   // 19:17 0 乘什麼都是 0、加 0 不變
  cs.forEach((m, i) => { if (!V[i]) glow(m, RED); });
  say('0 乘什麼都是 0、加 0 不變', '0 × a = 0，a + 0 = a → 算了也白算');
  await step(tok);                                   // 19:55 只把不是 0 的兩項存下來
  cs.forEach((m, i) => { if (!V[i]) fly(m, V3(0, 8, -4)); });
  say('那就只存不是 0 的項', '是 0 的就不管了');
  await step(tok);                                   // 20:23 註記維度：(第 3 維, 6)、(第 5 維, 4)
  glow(cs[2], null); glow(cs[4], null);
  move(cs[2], -1.6, 0.4, 2.2); move(cs[4], 1.6, 0.4, 2.2);
  await beat(tok, 600);
  relabel(cs[2], '(3, 6)'); relabel(cs[4], '(5, 4)');
  say('每筆記成（維度, 值）', '(3, 6)、(5, 4)');
  await step(tok);                                   // 20:55 少存 5 個 0、多存 2 個 index
  say('這例子不明顯：少 5 個 0、多 2 個 index', '7 個數 → 2 組 pair = 4 個數');
  await step(tok);                                   // 21:04 1000 維只有 10 個非零
  tag('1000 維、只有 10 個非零', 'ptr alt', 0, 2.4, 2.2);
  say('1000 維只有 10 個非零', '1000 個數 → 10 組 pair = 20 個數');
}]);

// ════════ 21:30 多項式 = sparse vector；ordered linked list ════════
FRAG.push(['lllin-poly-list', '多項式與 Ordered Linked List', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.6, 0.4]);
  await step(tok);                                   // 21:34 用 linked list 表示 polynomial
  say('切入點：用 linked list 表示多項式', 'polynomial');
  await step(tok);                                   // 21:55 6x³ ↔ 第 3 項是 6
  tag('6x³ + 4x⁵', 'ptr alt', 0, 2.6, -2.4);
  say('6x³ 就是「第 3 項是 6」', '4x⁵ 就是「第 5 項是 4」');
  await step(tok);                                   // 22:21 多項式做的事就是 sparse vector
  say('多項式就是一種 sparse vector', 'sparse vector：很多 0 的向量');
  await step(tok);                                   // 22:40 插入、刪除很有彈性
  say('用 list 表示：插入、刪除都很有彈性', 'sparse vector 也能照樣用');
  await step(tok);                                   // 23:20 dense array：0 0 6 0 4 0 0
  const V = [0, 0, 6, 0, 4, 0, 0], xs = (i) => -4.5 + i * 1.5;
  const cs = V.map((v, i) => { tag(String(i + 1), 'idx', xs(i), 0, -1.4); return cube(v, v ? LB : '#c9bfae', [1.1, 0.8, 1.1], xs(i), 0.4, -2.4, 3); });
  say('Dense array：0 也全部存', '[0, 0, 6, 0, 4, 0, 0]');
  await step(tok);                                   // 23:32 linked list：(3, 6) → (5, 4)
  glow(cs[2], GOLD); glow(cs[4], GOLD);
  tag('head', 'ptr', -1.6, 1.4, 2.0);
  const n1 = nd('(3, 6)', -1.6, 0.35, 2.0, LB, 4);
  await beat(tok, 400);
  const n2 = nd('(5, 4)', 1.6, 0.35, 2.0, LB, 4);
  await beat(tok, 400);
  lk(-1.6, 1.6, 2.0); tag('NULL', 'idx', 3.2, 0.35, 2.0);
  say('Linked list：只串非零項', 'head → (3, 6) → (5, 4) → NULL');
  await step(tok);                                   // 23:52 維度從 1 開始數
  glow(cs[2], null); glow(cs[4], null);
  say('維度從 1 開始數（一般向量慣例）', '第 1、2、3… 維，不說第 0 維');
  await step(tok);                                   // 24:40 嚴格說是 ordered linked list
  glow(n1.userData.data, GOLD); await beat(tok, 600);
  glow(n1.userData.data, null); glow(n2.userData.data, GOLD);
  say('Ordered linked list：依維度事先排好', '3 < 5：由小到大串');
}]);

// ════════ 25:13 兩個 sparse vector 相加：目標 ════════
FRAG.push(['lllin-merge-goal', '兩個 Sparse Vector 相加：要得到什麼', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  await step(tok);                                   // 25:31 兩個 polynomial 的加法
  say('像兩個多項式相加', '把兩個 sparse vector 合起來');
  await step(tok);                                   // 25:47 V1：第 3 維 6、第 5 維 4
  const r1 = sRow(V1, -2.4, LB, 'V1', 4);
  say('V1：第 3 維 6、第 5 維 4', 'V1 = (3, 6) → (5, 4)');
  await step(tok);                                   // 26:11 V2：第 1 維 2、第 4 維 9、第 5 維 −4
  const r2 = sRow(V2, 0, LR, 'V2', 4);
  say('V2：第 1 維 2、第 4 維 9、第 5 維 −4', 'V2 = (1, 2) → (4, 9) → (5, −4)');
  await step(tok);                                   // 26:37 當成多項式相加
  say('當成多項式：兩式相加', '(6x³ + 4x⁵) + (2x + 9x⁴ − 4x⁵)');
  await step(tok);                                   // 27:40 兩個開頭：H1、H2
  txt(r1.h, 'H1'); txt(r2.h, 'H2');
  say('兩條 list 各有一個開頭：H1、H2', 'H = head');
  const R = [[1, 2, LR], [3, 6, LB], [4, 9, LR]];
  await step(tok);                                   // 28:07 先從 (1, 2) 串一個過來
  tag('result', 'ptr alt', dx(1), 1.35, 2.6);
  nd(pl(R[0]), dx(1), 0.35, 2.6, LR, 4);
  say('結果先串上 (1, 2)', '第 1 維只有 V2 有');
  await step(tok);                                   // 28:16 再串 (3, 6)、(4, 9)
  nd(pl(R[1]), dx(3), 0.35, 2.6, LB, 4); lk(dx(1), dx(3), 2.6);
  await beat(tok, 600);
  nd(pl(R[2]), dx(4), 0.35, 2.6, LR, 4); lk(dx(3), dx(4), 2.6);
  say('再串上 (3, 6)、(4, 9)', '依維度由小到大');
  await step(tok);                                   // 28:35 第 5 維加起來消掉 → 這裡就是尾巴
  const z = cube('(5, 0)', LG, [1.0, 0.7, 1.0], dx(5), 0.35, 2.6, 4);
  await beat(tok, 700);
  fly(z, V3(2, 8, 4));
  tag('NULL', 'idx', dx(4) + 1.6, 0.35, 2.6);
  say('第 5 維：4 + (−4) = 0，消掉', '所以 (4, 9) 就是尾巴');
  await step(tok);                                   // 28:43 希望產生的結果
  say('想要的結果：(1,2) → (3,6) → (4,9)', '2x + 6x³ + 9x⁴；要怎麼寫成演算法？');
}]);

// ════════ 29:05 Merge 的程式：三種情形與前進 ════════
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
  await step(tok);                                   // 29:08 故意畫成 singly：只能從頭出發
  const r1 = sRow(V1, 0.4, LB, 'H1', 3), r2 = sRow(V2, 2.4, LR, 'H2', 3);
  say('故意畫成 singly linked list', '兩條都只能從頭出發');
  await step(tok);                                   // 29:42 c1 從 H1、c2 從 H2 出發
  const cd = code(MERGE_CODE, 0, 6.4, 0.48, -2.6);
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, 0.4), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 2.4);
  cd.hl(0);
  say('c1 從 H1、c2 從 H2 出發', 'c = cursor（游標）');
  await step(tok);                                   // 29:56 三種情形：小、大、一樣大
  cd.hl(2);
  say('三種情形：c1 的 order 比較小／比較大／一樣大', 'order = 第幾維');
  await step(tok);                                   // 30:27 比較小的先串到 result 最後面
  cd.hl(3); glow(r2.ns[0].userData.data, GOLD);
  say('比較小的先串到 result 最後面', '這樣 result 才會維持由小到大');
  await step(tok);                                   // 30:55 另一種：c2 塞過去
  cd.hl(5);
  say('c1 比較大：就換 c2 串上去', 'insert(c2)');
  await step(tok);                                   // 31:52 一樣大：insert(c1 + c2)
  glow(r2.ns[0].userData.data, null); cd.hl(7);
  glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  say('一樣大：insert(c1 + c2)', '值相加（細節等一下再談）');
  await step(tok);                                   // 32:17 串完的那邊要前進
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  cd.hl(3);
  c1.position.set(dx(5), 1.0, 0.4);
  say('串完 c1，c1 就要前進', 'c1++');
  await beat(tok, 900);
  c1.position.set(dx(3), 1.0, 0.4);
  await step(tok);                                   // 32:32 一樣大：兩個都前進
  cd.hl(7);
  say('一樣大時兩個都處理完：c1、c2 都前進', 'c1++;  c2++;');
  await step(tok);                                   // 32:38 ++ 是概念寫法：c1 = c1->next
  say('++ 是概念寫法', 'linked list 真正寫：c1 = c1->next');
  await step(tok);                                   // 33:07 像 STL iterator 把 ++ overload
  cd.hl(-1);
  say('像 C++ STL 的 iterator：overload ++', 'iterator 的 ++ 就是「走到 next」');
}]);

// ════════ 33:44 Running cursors：完整走一次 ════════
FRAG.push(['lllin-merge-trace', 'Running Cursors：V1 + V2 走一遍', async (tok) => {
  fresh([0, 8.5, 12], [0, 1.6, 0.6]);
  const cd = code(MERGE_CODE, 0, 6.6, 0.42, -3.4);
  const r1 = sRow(V1, -0.8, LB, 'H1'), r2 = sRow(V2, 1.2, LR, 'H2');
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, -0.8), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 1.2);
  tag('result', 'ptr', dx(1), 1.35, 3.3);
  await step(tok);                                   // 33:48 核心步驟想清楚，難的是包起來
  say('核心步驟想清楚了，難的是把它包起來', '');
  await step(tok);                                   // 34:18 兩條都還沒到尾巴才能比
  cd.hl(1);
  say('c1、c2 都還沒到尾巴，才能比大小', 'while (c1 != NULL && c2 != NULL)');
  const res = [];
  async function put(p, color, line, cap, f) {
    cd.hl(line);
    say(cap, f);
    nd(pl(p), dx(p[0]), 0.35, 3.3, color, 4);
    if (res.length) lk(dx(res[res.length - 1][0]), dx(p[0]), 3.3);
    res.push(p);
    await beat(tok, 700);
  }
  await step(tok);                                   // 34:56 c1、c2 從這裡出發
  glow(r1.ns[0].userData.data, GOLD); glow(r2.ns[0].userData.data, GOLD);
  say('c1、c2 從頭出發，先比大小', '3 vs 1');
  await step(tok);                                   // 35:03 c2 比較小，塞 c2，c2 前進
  glow(r1.ns[0].userData.data, null); glow(r2.ns[0].userData.data, null);
  await put([1, 2], LR, 5, '3 > 1：c2 比較小，串 c2', 'insert (1, 2)，c2++');
  c2.position.set(dx(4), 1.0, 1.2);
  await step(tok);                                   // 35:13 下一步 c1 比較小，換 c1
  await put([3, 6], LB, 3, '3 < 4：c1 比較小，串 c1', 'insert (3, 6)，c1++');
  c1.position.set(dx(5), 1.0, -0.8);
  await step(tok);                                   // 35:22 c2 比較小，c2 前進
  await put([4, 9], LR, 5, '5 > 4：c2 比較小，串 c2', 'insert (4, 9)，c2++');
  c2.position.set(dx(5), 1.0, 1.2);
  await step(tok);                                   // 35:32 交互前進；後面一段 code 接上沒走完的
  cd.hl(9);
  say('兩個游標交互前進', '最後：把還沒走完的那條接上去');
  await step(tok);                                   // 36:18 cursor：指示位置的游標
  cd.hl(-1);
  say('cursor（游標）：標示現在走到哪', '寫演算法的人決定：這步哪個游標前進');
  await step(tok);                                   // 36:39 叫 running cursors
  cd.hl(7);
  glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  const z = cube('(5, 0)', LG, [1.0, 0.7, 1.0], dx(5), 0.35, 3.3, 4);
  await beat(tok, 700);
  fly(z, V3(2, 8, 4));
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  c1.position.set(dx(5) + 1.6, 1.0, -0.8); c2.position.set(dx(5) + 1.6, 1.0, 1.2);
  tag('NULL', 'idx', dx(4) + 1.6, 0.35, 3.3);
  cd.hl(-1);
  say('Running Cursors：兩個游標一路走完', '結果 2x + 6x³ + 9x⁴；每個節點只看一次 O(m + n)');
}]);

// ════════ 37:01 內積：同一個架構 ════════
FRAG.push(['lllin-dot', '內積：同樣的 Running Cursors', async (tok) => {
  fresh([0, 8, 12], [0, 1.6, 0.4]);
  const r1 = sRow(V1, -0.6, LB, 'H1'), r2 = sRow(V2, 1.6, LR, 'H2');
  const c1 = tag('c1', 'ptr alt', dx(3), 1.0, -0.6), c2 = tag('c2', 'ptr alt', dx(1), 1.0, 1.6);
  await step(tok);                                   // 37:00 求內積：對應項相乘，同樣演算法
  const cd = code([
    'while (c1 && c2) {',
    '  if (c1.index < c2.index)       c1++;',
    '  else if (c1.index > c2.index)  c2++;',
    '  else { sum += c1.value * c2.value;  c1++;  c2++; }',
    '}',
  ], 0, 6.2, 0.5, -3.2);
  const sm = tag('sum = 0', 'ptr', 0, 0.3, 3.6);
  say('內積：對應維度相乘再加總', '同樣用兩個游標走過去');
  await step(tok);                                   // 37:12 只改 if 裡做的事
  cd.hl(3);
  say('架構不變，只改 if 裡做的事', '');
  await step(tok);                                   // 37:19 order 不同：只前進，乘不出東西
  cd.hl(2);
  say('3 > 1：c2 前進，乘不出東西', '只有一邊有值 → 乘積是 0');
  c2.position.set(dx(4), 1.0, 1.6);
  await step(tok);                                   // 37:25 另一邊前進，怎麼乘還是 0
  cd.hl(1); c1.position.set(dx(5), 1.0, -0.6);
  say('3 < 4：c1 前進；5 > 4：c2 前進', '一樣乘不出東西');
  await beat(tok, 900);
  cd.hl(2); c2.position.set(dx(5), 1.0, 1.6);
  await step(tok);                                   // 37:30 合起來的部分改成相乘
  cd.hl(3); glow(r1.ns[1].userData.data, GOLD); glow(r2.ns[2].userData.data, GOLD);
  say('一樣大：改成相乘、加進 sum', 'sum += 4 × (−4)');
  await beat(tok, 900);
  txt(sm, 'sum = −16');
  await step(tok);                                   // 37:52 LibSVM
  glow(r1.ns[1].userData.data, null); glow(r2.ns[2].userData.data, null);
  c1.position.set(dx(5) + 1.6, 1.0, -0.6); c2.position.set(dx(5) + 1.6, 1.0, 1.6);
  cd.hl(-1);
  tag('LibSVM', 'ptr alt', 4.6, 2.6, -1.8);
  say('LibSVM：台大林智仁老師實驗室的機器學習軟體', '全世界大量使用；V1 · V2 = −16');
  await step(tok);                                   // 38:48 它先處理第三種情形：index 一樣就相乘相加
  cd.hl(3);
  say('LibSVM 的內積：index 一樣，value 相乘加起來', 'index 就像剛才的 order');
  await step(tok);                                   // 39:11 index 小的往前走
  cd.hl(1);
  say('index 不一樣：小的那個往前走', '和我們的演算法本質一樣');
  await step(tok);                                   // 39:21 不是 exactly linked list
  cd.hl(-1);
  say('LibSVM 用 (index, value) 陣列', '不完全是 linked list：linked list 記憶體不連續');
  await step(tok);                                   // 40:42 這段計算是效率核心
  say('這段計算是 LibSVM 效率的核心', '學會的演算法，真的會用上');
}]);

// ════════ 42:26 高維又稀疏：影像與 one-hot ════════
FRAG.push(['lllin-onehot', '高維稀疏向量：影像與 One-hot', async (tok) => {
  fresh([0, 7, 12.5], [0, 1, 0.4]);
  await step(tok);                                   // 42:30 機器學習裡隨便都上千維
  say('哪裡用得到 1000 維的向量？', '機器學習裡到處都是');
  await step(tok);                                   // 42:40 一張 1024 × 768 的影像
  const img = cube('1024 × 768', '#9b7ef4', [4, 0.3, 3], 0, 0.15, -1.2, 3);
  say('一張影像 1024 × 768', '平常看成矩陣');
  await step(tok);                                   // 42:45 拉長成一個向量：七十幾萬維
  await anim(tok, 1200, (t) => { img.scale.set(1 + 2.2 * t, 1, 1 - 0.85 * t); });
  relabel(img, '786,432 維');
  say('拉長成一個向量', '1024 × 768 = 786,432 維');
  await step(tok);                                   // 43:16 這麼大又 sparse 也很常見
  fly(img, V3(0, 8, -4));
  say('這麼大、又是 sparse 的向量也很常見', '');
  await step(tok);                                   // 43:25 作業二：線上廣告平台的資料
  say('作業二：線上廣告平台的資料', '原始資料是離散（discrete）選項');
  await step(tok);                                   // 43:40 廣告在哪個網站被點，網站上千上萬
  const sites = ['www.google.com', 'www.yahoo.com', '… 上萬個網站'];
  const sl = sites.map((s, i) => tag(s, 'idx', -4.6, 0.3, -2.4 + i * 0.9));
  say('例：這個廣告在哪個網站被點', '網站有上千上萬個');
  await step(tok);                                   // 43:49 一筆：在 google 被點
  sl[0].element.className = 'lab-label ptr alt';
  say('這一筆：在 google 被點', '');
  await step(tok);                                   // 43:55 另一筆：在 yahoo 被點
  sl[0].element.className = 'lab-label idx'; sl[1].element.className = 'lab-label ptr alt';
  say('另一筆：在 yahoo 被點', '');
  await step(tok);                                   // 44:03 模型沒辦法直接處理 → 轉成數值
  sl[1].element.className = 'lab-label idx';
  say('模型沒辦法直接吃文字', '要先轉成數字');
  await step(tok);                                   // 44:22 one-hot：是哪個選項，那一維填 1
  const xs = (i) => -1.6 + i * 1.05;
  const cs = [];
  for (let i = 0; i < 8; i++) cs.push(cube(i === 0 ? 1 : 0, i === 0 ? LK : '#c9bfae', [0.85, 0.7, 0.85], xs(i), 0.35, -2.4, 3));
  tag('…', 'idx', xs(8) - 0.2, 0.35, -2.4);
  sl[0].element.className = 'lab-label ptr alt';
  say('One-hot：列出所有選項，是哪個就在那一維填 1', 'google 那筆 → 第 1 維是 1');
  await step(tok);                                   // 44:28 其他維填 0；一萬個網站 → 一萬維
  sl[0].element.className = 'lab-label idx'; sl[1].element.className = 'lab-label ptr alt';
  relabel(cs[0], 0); tint(cs[0], '#c9bfae'); relabel(cs[1], 1); tint(cs[1], LK);
  say('其他維全部填 0', 'yahoo 那筆 → 第 2 維是 1；一萬個網站 → 一萬維');
  await step(tok);                                   // 44:33 一萬維只有一個是 1
  cs.forEach((m, i) => { if (i !== 1) fly(m, V3(0, 8, -4)); });
  await beat(tok, 700);
  move(cs[1], 0, 0.35, 2.0);
  relabel(cs[1], '(yahoo, 1)');
  say('一萬維只有一個是 1 → 超 sparse', 'sparse 表示只要存一組（維度, 值）');
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
  tag('p', 'ptr', -5.8, 0.6, 0.35);
  await step(tok);                                   // 45:20 用指標 new 一個物件，記憶體發生什麼事？
  say('問題：new 一個新物件時，記憶體裡發生什麼事？', '');
  const blk = [13, 14];
  const bx = -3.25 + 1 * 1.3 + 0.65, bz = -1.6 + 2 * 1.3;
  await step(tok);                                   // 45:28 C：malloc 要一塊記憶體
  blk.forEach((k) => tint(T[k], LK));
  let a = arrow(V3(-5.4, 0.4, 0.35), V3(bx - 1.3, 0.2, bz));
  say('C 用 malloc 要一塊記憶體', 'p = malloc(sizeof(Node))；malloc = memory allocation');
  await step(tok);                                   // 45:38 OS 把這塊登記給你的程式
  say('作業系統把這塊登記給你的程式', '別的程式不會再拿到這塊');
  await step(tok);                                   // 45:51 像地政單位管土地
  say('像地政單位：這塊地有人用了', '');
  await step(tok);                                   // 45:59 free：還給系統
  blk.forEach((k) => tint(T[k], '#e9dcc4')); kill(a);
  say('free：還給系統，之後可再配置', 'free(p)');
  await step(tok);                                   // 46:12 C++ new：除了配置以外
  blk.forEach((k) => tint(T[k], LK));
  a = arrow(V3(-5.4, 0.4, 0.35), V3(bx - 1.3, 0.2, bz));
  say('C++ new：一樣先配置一塊', 'p = new Node();');
  await step(tok);                                   // 46:17 還會執行一段初始化程式
  cube('data=0', LB, [1.1, 0.6, 1.1], bx - 0.65, 0.4, bz, 3);
  cube('NULL', '#d8c29b', [1.1, 0.6, 1.1], bx + 0.65, 0.4, bz, 3);
  say('還會執行一段初始化程式', 'C++ 正式名稱：constructor（建構子）');
  await step(tok);                                   // 46:33 像整地：把初值放好
  say('像整地：不只給你地，還把初值放好', 'new = 配置記憶體 + 初始化');
}]);

// ════════ 50:38 真正的 merge：搬節點，不 copy ════════
FRAG.push(['lllin-inplace-merge', '真正的 Merge：搬節點而不 copy', async (tok) => {
  fresh([0, 8, 12], [0, 0.4, 0.4]);
  const r1 = sRow(V1, -2.4, LB, 'H1'), r2 = sRow(V2, 0, LR, 'H2');
  tag('result', 'ptr alt', dx(1), 1.35, 2.6);
  await step(tok);                                   // 50:38 回傳新 list 不會很浪費記憶體嗎？
  const cp = [];
  for (const [d, v, c] of [[1, 2, LR], [3, 6, LB], [4, 9, LR]]) { cp.push(nd(pl([d, v]), dx(d), 0.35, 2.6, c, 4)); await beat(tok, 300); }
  say('剛才的版本：複製新節點、回傳新 list', '原本兩條還在 → 不會很浪費記憶體嗎？');
  await step(tok);                                   // 50:47 剛才講的是 conceptual 的演算法
  say('剛才講的是很 conceptual 的演算法', '重點在想法，不在省記憶體');
  await step(tok);                                   // 50:55 真正的 merge：把 node 移來移去
  cp.forEach((g) => fly(g, V3(0, 8, 4)));
  r1.ars.concat(r2.ars).forEach(kill);
  await beat(tok, 600);
  move(r2.ns[0], dx(1), 0.35, 2.6); await beat(tok, 400);
  move(r1.ns[0], dx(3), 0.35, 2.6); await beat(tok, 400);
  move(r2.ns[1], dx(4), 0.35, 2.6);
  say('真正的 merge：把節點本身移到 result', '');
  await step(tok);                                   // 51:03 而不是重新 copy 一份
  fly(r1.ns[1], V3(3, 8, -4)); fly(r2.ns[2], V3(3, 8, -2));
  lk(dx(1), dx(3), 2.6); lk(dx(3), dx(4), 2.6); tag('NULL', 'idx', dx(4) + 1.6, 0.35, 2.6);
  say('只改 link，不重新 copy 一份', '和為 0 的第 5 維兩個節點 free 掉');
}]);

// ════════ 58:25 Linked list 的缺點與「基本功」 ════════
FRAG.push(['lllin-scatter', 'Linked List 的缺點：記憶體四散', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.6]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) cube('', '#e9dcc4', [1.2, 0.08, 1.2], -4.9 + c * 1.4, 0.04, -0.6 + r * 1.5);
  const spots = [[0, 2], [6, 0], [2, 1], [7, 2], [3, 0]];
  const P = spots.map(([c, r]) => V3(-4.9 + c * 1.4, 0.35, -0.6 + r * 1.5));
  await step(tok);                                   // 58:33 Linked list in job interviews
  say('最後一段：Linked list in job interviews', '其實它不是特別好用的資料結構');
  await step(tok);                                   // 59:00 顯著缺點：哪裡有空就挖一塊
  tag('Linked list：哪裡有空就挖一塊', 'ptr alt', 0, 0.4, 4.0);
  const ln = [];
  for (let i = 0; i < 5; i++) { ln.push(cube(i + 1, LR, [0.9, 0.7, 0.9], P[i].x, 0.35, P[i].z, 3)); await beat(tok, 250); }
  say('記憶體哪裡有一塊空的，就挖一塊', '優點：不用找一整段連續空間');
  await step(tok);                                   // 59:08 東占一塊、西占一塊，四散各地
  for (let i = 0; i < 4; i++) {
    const d = P[i + 1].clone().sub(P[i]).normalize();
    arrow(P[i].clone().addScaledVector(d, 0.55).setY(0.75), P[i + 1].clone().addScaledVector(d, -0.55).setY(0.75));
  }
  say('缺點：節點四散各地', '東占一塊、西占一塊');
  await step(tok);                                   // 59:17 在 Array 那邊講過
  tag('Array：連續', 'ptr', -4.6, 0.4, -3.2);
  const ac = [];
  for (let i = 0; i < 5; i++) ac.push(cube(i + 1, LB, [1.0, 0.6, 1.0], -1.6 + i * 1.05, 0.3, -3.2, 3));
  const cur = tag('▼', 'ptr', -1.6, 1.1, -3.2);
  await beat(tok, 500);
  for (let i = 0; i < 5; i++) { cur.position.set(-1.6 + i * 1.05, 1.1, -3.2); await beat(tok, 200); }
  say('Array 那邊講過：記憶體連在一起最好讀', '存取的位置隔很遠會影響效率');
  await step(tok);                                   // 59:33 cache 架構下：要用的東西四散各地
  for (let i = 0; i < 5; i++) { cur.position.set(P[i].x, 1.3, P[i].z); glow(ln[i], GOLD); await beat(tok, 400); glow(ln[i], null); }
  say('有 cache 時：東西四散，效率不好', '東邊搬一個、西邊再搬一個');
  await step(tok);                                   // 59:48 東市買駿馬，西市買鞍韉
  say('像《木蘭詩》：東市買駿馬，西市買鞍韉', '跑來跑去');
  await step(tok);                                   // 60:08 概念簡單，但寫到沒 bug 不容易
  say('概念很簡單，畫圖也簡單', '但要寫成沒有錯的程式，其實蠻困難');
  await step(tok);                                   // 60:45 自刻求極致效能／用 STL／不用
  say('實務：為極致效能自己刻，或用 STL', '或乾脆選別的做法、不用 linked list');
  await step(tok);                                   // 61:25 但它很適合考基本功
  say('但它一直很適合考程式設計師的基本功', '');
  await step(tok);                                   // 61:47 像考主廚煎荷包蛋
  say('像考五星級主廚煎荷包蛋', '考煎牛排太貴，荷包蛋剛好');
  await step(tok);                                   // 62:21 三分鐘就看出很多東西
  say('三分鐘煎一個，就看得出很多東西', '熟練 linked list 考題 = 會煎荷包蛋');
}]);

// ════════ 63:25 Linked List Reversal ════════
FRAG.push(['lllin-reverse', 'Linked List Reversal：先存再改', async (tok) => {
  fresh([0, 7.5, 12], [0, 2.2, 0.4]);
  const Z = 1.4, xs = (i) => -5.2 + i * 2.6;
  const ns = [], red = [];
  let cd, endNull, head, tp, tc, tn, startNull;
  await step(tok);                                   // 63:34 經典考題：把 linked list 倒過來
  for (let i = 0; i < 5; i++) ns.push(nd(i + 1, xs(i), 0.35, Z, null, 3));
  for (let i = 0; i < 4; i++) red.push(lk(xs(i), xs(i + 1), Z, 0.35, A_RED));
  endNull = tag('NULL', 'idx', xs(4) + 1.6, 0.35, Z);
  head = tag('head', 'ptr', xs(0), 2.9, Z);
  say('經典考題：Linked List Reversal', '把 linked list 倒過來');
  await step(tok);                                   // 63:56 通常考 singly
  say('通常考 singly linked list', '每個節點只有一個 next');
  await step(tok);                                   // 64:02 doubly 太簡單：交換 head/tail、prev/next
  say('Doubly 太簡單', '交換 head、tail，再把每個 prev 和 next 交換');
  await step(tok);                                   // 64:15 singly 比較 tricky
  say('Singly 比較 tricky', '常常太快或太慢 update 某個 link');
  await step(tok);                                   // 64:52 把所有箭頭打斷、反過來
  red.forEach((a) => a.setColor(new THREE.Color('#ff3b2f')));
  say('Reversal：所有箭頭打斷、反過來', '1 → 2 → 3 → 4 → 5 變成 5 → 4 → 3 → 2 → 1');
  await step(tok);                                   // 65:11 實務中想不到一定要 reversal 的理由
  red.forEach((a) => a.setColor(new THREE.Color(A_RED)));
  say('實務中幾乎找不到一定要 reversal 的理由', 'convolution 也有更好的做法');
  await step(tok);                                   // 66:20 難在：更新時還要拿得到下一串
  cd = code([
    'prev = NULL;  cur = head;',
    'while (cur != NULL) {',
    '  next = cur->next;   // 先存紅箭頭',
    '  cur->next = prev;   // 改成綠箭頭',
    '  prev = cur;  cur = next;',
    '}',
    'head = prev;',
  ], 0, 6.4, 0.5, -2.6);
  cd.hl(0);
  tp = tag('prev', 'ptr', xs(0) - 1.6, 1.6, Z); tc = tag('cur', 'ptr alt', xs(0), 2.2, Z); tn = tag('next', 'ptr', xs(1), 1.6, Z);
  showL(tn, false);
  startNull = tag('NULL', 'idx', xs(0) - 1.6, 0.9, Z);
  say('難在：更新時，還要拿得到還沒更新的下一串', 'prev = NULL，cur = head');
  await step(tok);                                   // 66:38 原本有紅箭頭往右指
  cd.hl(2); showL(tn, true);
  red[0].setColor(new THREE.Color('#ff3b2f'));
  say('原本有個紅箭頭往右指：先存起來', 'next = cur->next（next = 2）');
  await step(tok);                                   // 66:46 要更新成綠色
  cd.hl(3); kill(red[0]); glow(ns[0].userData.data, GREEN);
  say('再改成綠箭頭：指回 prev', '1->next = NULL');
  await step(tok);                                   // 66:55 蓋掉就沒有紅箭頭可以走
  glow(ns[0].userData.data, null);
  say('如果沒先存，紅箭頭一蓋掉', '就再也找不到 2 了');
  await step(tok);                                   // 67:01 先存紅、改綠、再沿紅走
  cd.hl(4);
  tp.position.set(xs(0), 1.6, Z); tc.position.set(xs(1), 2.2, Z);
  say('沿著存下來的紅箭頭前進', 'prev = cur，cur = next；之後每個節點都一樣');
  await beat(tok, 500);
  for (let i = 1; i < 5; i++) {
    if (i < 4) tn.position.set(xs(i + 1), 1.6, Z); else tn.position.set(xs(4) + 1.6, 1.6, Z);
    if (i < 4) kill(red[i]); else kill(endNull);
    arrow(V3(xs(i) + 0.73, 0.95, Z), V3(xs(i - 1) + 0.2, 0.95, Z), A_GREEN);
    tp.position.set(xs(i), 1.6, Z); tc.position.set(i < 4 ? xs(i + 1) : xs(4) + 1.6, 2.2, Z);
    await beat(tok, 450);
  }
  await step(tok);                                   // 67:11 程式碼順序要邏輯上想清楚
  kill(startNull);
  tag('NULL', 'idx', xs(0) - 1.5, 0.95, Z);
  cd.hl(6); showL(tn, false);
  head.position.set(xs(4), 2.9, Z);
  say('head = prev：反轉完成', '順序要想清楚：先存、再改、再走');
}]);

// ════════ 67:18 在白板上寫程式的能力 ════════
FRAG.push(['lllin-whiteboard', '在白板上寫程式的能力', async (tok) => {
  fresh([0, 8, 11.5], [0, 0.8, 0.2]);
  const loop = ['寫 code', 'compile', '丟測資', 'debugger 改'];
  const LP = [V3(-4.6, 0.4, -2.2), V3(-1.8, 0.4, -2.2), V3(-1.8, 0.4, 0.4), V3(-4.6, 0.4, 0.4)];
  let ls = [], ars = [];
  await step(tok);                                   // 67:18 太仰賴 debugger 和電腦
  for (let i = 0; i < 4; i++) { ls.push(cube(loop[i], '#c9d7ea', [2.2, 0.5, 1.0], LP[i].x, 0.25, LP[i].z, 3)); await beat(tok, 250); }
  for (let i = 0; i < 4; i++) {
    const a = LP[i], b = LP[(i + 1) % 4], d = b.clone().sub(a).normalize();
    ars.push(arrow(a.clone().addScaledVector(d, i % 2 ? 0.7 : 1.25).setY(0.7), b.clone().addScaledVector(d, i % 2 ? -0.7 : -1.25).setY(0.7)));
  }
  say('很多人寫程式太仰賴 debugger 和電腦', '寫完 → compile → 丟測資 → 再改');
  await step(tok);                                   // 67:45 面試時沒有 compiler 幫你 debug
  ls.forEach((m) => tint(m, '#d8cfc0'));
  const no = tag('面試：沒有 compiler ✗', 'bad', -3.2, 2.0, -0.9);
  say('面試時沒有 compiler 幫你 debug', '');
  await step(tok);                                   // 68:03 要知道白板上每一行在電腦裡發生什麼
  const wb = cube('', '#f6f2e8', [5.2, 3.2, 0.15], 3.0, 1.7, -1.6);
  const cd = code(['prev = NULL;  cur = head;', 'while (cur) {', '  next = cur->next;', '  cur->next = prev;', '  prev = cur;  cur = next;', '}'], 3.0, 2.9, 0.42, -1.4);
  say('白板上每一行，要清楚電腦裡發生什麼', '靠腦袋裡清楚的邏輯');
  await step(tok);                                   // 68:24 從現在就練：紙上寫 code / pseudo code
  cd.hl(2);
  say('從現在開始練：先在紙上寫出來', 'code 或 pseudo code，再上機');
  await step(tok);                                   // 69:32 reversal 只是十行左右的 code
  cd.hl(-1);
  tag('約 10 行', 'ptr alt', 3.0, 0.1, 0.4);
  say('Reversal 只是十行左右的 code', '考的是你有沒有磨練過這種邏輯');
  await step(tok);                                   // 69:45 想清楚再寫，還是先打 20 行再碰運氣
  say('想清楚再寫？還是打 20 行再碰運氣改？', '不在電腦上寫程式的能力很重要');
  await step(tok);                                   // 70:31 像煎荷包蛋：看得出基本功
  kill(no);
  say('Reversal 就像煎荷包蛋', '很看得出一個程式設計師的基本功');
}]);

// ════════ 70:39 Cycle detection：龜兔賽跑 ════════
FRAG.push(['lllin-cycle', 'Cycle Detection：龜兔賽跑', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.3]);
  const P = { 1: V3(-5.6, 0.35, 0), 2: V3(-3.2, 0.35, 0), 3: V3(-0.8, 0.35, 0), 4: V3(1.6, 0.35, -2.2), 5: V3(4.0, 0.35, 0), 6: V3(1.6, 0.35, 2.2) };
  const NX = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 3 };
  const cs = {};
  function link(a, b, color) {
    const d = P[b].clone().sub(P[a]).normalize();
    return arrow(P[a].clone().addScaledVector(d, 0.6), P[b].clone().addScaledVector(d, -0.6), color);
  }
  await step(tok);                                   // 70:39 linked list 裡到底有沒有 cycle？
  for (let k = 1; k <= 6; k++) { cs[k] = cube(k, colorFor(k), [0.9, 0.7, 0.9], P[k].x, 0.35, P[k].z, 3); }
  for (let k = 1; k <= 5; k++) link(k, k + 1);
  tag('head', 'ptr', P[1].x, 1.4, 0);
  say('面試題：linked list 裡有沒有 cycle？', '');
  await step(tok);                                   // 70:50 正常的從 head 走到尾巴
  const nul = tag('NULL', 'idx', P[6].x - 1.6, 0.35, P[6].z);
  say('正常的 linked list 沒有 cycle', '從 head 走走走，走到尾巴 NULL');
  await step(tok);                                   // 71:07 某次更新 link 沒寫對：繞回來
  kill(nul);
  link(6, 3, A_RED);
  say('某次更新 link 沒寫對：繞回前面', '6->next = 3 → cycle（錯誤的 list）');
  await step(tok);                                   // 71:28 怎麼 detect？
  say('怎麼把 cycle 偵測（detect）出來？', '有名的面試題');
  await step(tok);                                   // 71:46 硬算：從每個 node 出發看能否繞回
  for (const k of [1, 2, 3]) { glow(cs[k], GOLD); await beat(tok, 450); glow(cs[k], null); }
  say('硬算：從每個 node 出發，看能不能繞回', '會 work，但不巧妙');
  await step(tok);                                   // 72:19 龜兔賽跑演算法
  const tT = tag('烏龜', 'ptr', P[1].x, 1.4, P[1].z), tH = tag('兔子', 'ptr alt', P[1].x, 2.0, P[1].z);
  let T = 1, H = 1;
  say('龜兔賽跑演算法', 'tortoise and hare：兩個指標從 head 出發');
  async function round(r) {
    T = NX[T]; tT.position.set(P[T].x, 1.4, P[T].z);
    H = NX[H]; tH.position.set(P[H].x, 2.0, P[H].z);
    await beat(tok, 350);
    H = NX[H]; tH.position.set(P[H].x, 2.0, P[H].z);
    await beat(tok, 350);
  }
  await step(tok);                                   // 72:43 兔子一次兩步、烏龜一次一步
  await round(1);
  say('每一輪：兔子走兩步、烏龜走一步', '第 1 輪：烏龜在 2，兔子在 3');
  await step(tok);                                   // 73:04 有 cycle：兔子繞一圈回來
  await round(2); await beat(tok, 300); await round(3);
  say('有 cycle：兔子先進圈，繞一圈回來', '第 3 輪：烏龜在 4，兔子繞回 3');
  await step(tok);                                   // 73:19 兔子追到烏龜 → 有 cycle
  await round(4);
  glow(cs[5], GOLD);
  say('兔子追到烏龜 → 有 cycle', '第 4 輪：兩者都在 5');
  await step(tok);                                   // 73:27 沒追到就走到 tail → 沒有 cycle
  say('沒有 cycle：兔子會先走到尾巴', '走到 NULL → 沒有 cycle');
  await step(tok);                                   // 74:03 兔子走的是「兩步算一個」的虛擬 list
  glow(cs[5], null);
  say('跟 merge 一樣是兩個 cursor', '兔子走的是「兩步算一個」的虛擬 linked list');
}]);

// ════════ 74:47 找中間那一項 ════════
FRAG.push(['lllin-middle', '找 Linked List 的中間項', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.6, 0.4]);
  const Z = 0.2, xs = (i) => -5.2 + i * 2.6;
  const ns = [];
  await step(tok);                                   // 74:47 能不能很巧妙地找出中間那一項？
  say('變化題：能不能巧妙地找出最中間那一項？', '');
  await step(tok);                                   // 74:57 5 項的 list，中間是第 3 項
  for (let i = 0; i < 5; i++) ns.push(nd(i + 1, xs(i), 0.35, Z, null, 3));
  for (let i = 0; i < 4; i++) lk(xs(i), xs(i + 1), Z);
  tag('NULL', 'idx', xs(4) + 1.6, 0.35, Z);
  say('5 項的 list：中間是第 3 項', '');
  await step(tok);                                   // 75:16 先掃一次：5 項
  const p = tag('p', 'ptr alt', xs(0), 1.4, Z), cnt = tag('n = 0', 'ptr', 0, 2.8, Z);
  for (let i = 0; i < 5; i++) { p.position.set(xs(i), 1.4, Z); txt(cnt, 'n = ' + (i + 1)); await beat(tok, 350); }
  say('Two-pass：先掃一次，知道有 5 項', '');
  await step(tok);                                   // 75:25 再從頭數到第 3 項：n + n/2
  for (let i = 0; i < 3; i++) { p.position.set(xs(i), 1.4, Z); await beat(tok, 400); }
  glow(ns[2].userData.data, GOLD);
  say('再從頭數到第 3 項', '總共約 n + n/2 步');
  await step(tok);                                   // 75:42 用龜兔賽跑
  glow(ns[2].userData.data, null); kill(p); kill(cnt);
  const tT = tag('烏龜', 'ptr', xs(0), 1.4, Z), tH = tag('兔子', 'ptr alt', xs(0), 2.0, Z);
  say('One-pass：用龜兔賽跑', '兔子跑到結尾時，烏龜停在中間');
  await step(tok);                                   // 76:00 兔子 1、3、5；烏龜 1、2、3
  for (let r = 1; r <= 2; r++) {
    tT.position.set(xs(r), 1.4, Z); tH.position.set(xs(2 * r), 2.0, Z);
    await beat(tok, 700);
  }
  say('兔子兩步兩步：1 → 3 → 5', '烏龜一步一步：1 → 2 → 3');
  await step(tok);                                   // 76:14 烏龜在中間那一項
  glow(ns[2].userData.data, GOLD);
  say('兔子到尾，烏龜就在中間', '');
  await step(tok);                                   // 76:22 變化：1/3、3/4 處
  say('再變化：找 1/3、3/4 的地方', 'two cursor 演算法的變形：改速度比');
  await step(tok);                                   // 76:36 面試看兩件事
  glow(ns[2].userData.data, null);
  say('面試題看兩件事', '基本功（reversal）＋活用巧思（middle）');
  await step(tok);                                   // 78:34 one-pass 和 two-pass 移動數一樣
  say('Q：one-pass 和 two-pass 移動數一樣？', '對：差在美感、少一次 loop');
}]);

// ════════ 83:34 中間項從 0 數；先寫 pseudo code ════════
FRAG.push(['lllin-middle0', '中間項從 0 數、先寫 pseudo code', async (tok) => {
  fresh([0, 7.5, 11.5], [0, 0.6, 0.4]);
  const Z = 0.2, xs = (i) => -5.2 + i * 2.6;
  const ns = [];
  for (let i = 0; i < 5; i++) ns.push(nd(i + 1, xs(i), 0.35, Z));
  for (let i = 0; i < 4; i++) lk(xs(i), xs(i + 1), Z);
  await step(tok);                                   // 83:34 從 0 數：0 1 2 3 4，中間是第 2 項
  for (let i = 0; i < 5; i++) tag('[' + i + ']', 'idx', xs(i), 0, Z + 1.1);
  glow(ns[2].userData.data, GOLD);
  say('從 0 數：0 1 2 3 4', '中間是 index 2（同一個節點）');
  await step(tok);                                   // 83:46 面試時要先把問題講清楚
  say('這裡沒嚴格定義 middle', '面試時要先跟主考官把問題講清楚');
  await step(tok);                                   // 83:58 coding 前先寫 pseudo code
  glow(ns[2].userData.data, null);
  say('Coding 前，先想好、寫好 pseudo code', '');
  await step(tok);                                   // 84:20 sparse vector 的 0 沒有存
  nd('(3, 6)', -1.6, 0.35, 3.2, LB, 3); nd('(5, 4)', 1.6, 0.35, 3.2, LB, 3);
  lk(-1.6, 1.6, 3.2); tag('sparse vector', 'ptr', -4.2, 0.35, 3.2);
  say('Q：sparse vector 裡的 0 有存嗎？', '沒有：只存 (維度, 值)');
}]);
  }

  // ═══ llpeng12.js ═══
  {
// ─── lhXHk8IuFeQ（彭文志 Lec08 Lists 1/4）與 U_tNDdEooJU（Lec09 Lists 2/4） ───
// cued scenes: every `await step(tok)` waits for the sentence it shows (see the notes' cues)
const step = ctx.step;
const BLUE = '#4b9ee2', ORANGE = '#dd8238', TEAL = '#2fc092', PURP = '#9b7ef4', DIM = '#cfc6b6', SAND = '#e9dcc4', GHOST = 0xb3aa9a;
function slide(tok, o, x, y, z = 0, ms = 450) {
  const s = o.position.clone();
  return anim(tok, ms, (t) => o.position.set(s.x + (x - s.x) * t, s.y + (y - s.y) * t, s.z + (z - s.z) * t));
}
async function dropIn(tok, o, ms = 420) { const p = o.position.clone(); o.position.y += 4; await slide(tok, o, p.x, p.y, p.z, ms); }
function node(v, x, y = 0.5, z = 0, color = BLUE) { return lnode(v, x, y, z, color); }
// link arrow out of node g's link field into node h (null → a NULL tag); opt.color for a "dashed" preview
function lk(g, h, opt = {}) {
  const p = g.position;
  if (!h) return opt.below ? tag(opt.text || 'NULL', 'idx', p.x + 0.73, p.y - 0.78, p.z) : tag(opt.text || 'NULL', 'idx', p.x + 1.45, p.y, p.z);
  const q = h.isVector3 ? h : h.position;
  const dy = q.y - p.y;
  if (Math.abs(dy) > 0.5) { const s = Math.sign(dy); return arrow(V3(p.x + 0.73, p.y + s * 0.36, p.z), V3(q.x, q.y - s * 0.36, q.z), opt.color); }
  if (q.x > p.x + 0.5) return arrow(V3(p.x + 0.96, p.y, p.z), V3(q.x - 0.52, q.y, q.z), opt.color);
  return arrow(V3(p.x + 0.73, p.y, p.z + 0.62), V3(q.x + 0.3, q.y, q.z + 0.62), opt.color);
}
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
// change the text shown on a list node's data box
const setData = (g, t) => { const l = D(g).children.find((c) => c.element); if (l) l.element.textContent = String(t); };
// a polynomial term node: coef | exp | link
function pnode(c, e, x, y = 0.5, z = 0, color = TEAL) {
  const g = new THREE.Group();
  const a = lab.box(color, [0.8, 0.7, 1.0]); a.position.x = -0.42; a.userData.lbl = lab.label(String(c), 'val'); a.add(a.userData.lbl);
  const b = lab.box('#9fd8c4', [0.8, 0.7, 1.0]); b.position.x = 0.42; b.userData.lbl = lab.label(String(e), 'val'); b.add(b.userData.lbl);
  const k = lab.box('#d8c29b', [0.4, 0.7, 1.0]); k.position.x = 1.05;
  g.add(a, b, k); g.userData.data = a; g.userData.exp = b; g.position.set(x, y, z); lab.world.add(g); return g;
}
function plk(g, h, opt = {}) {
  const p = g.position;
  if (!h) return tag(opt.text || '0', 'idx', p.x + 1.6, p.y, p.z);
  const q = h.isVector3 ? h : h.position;
  if (Math.abs(q.y - p.y) > 0.5) { const s = Math.sign(q.y - p.y); return arrow(V3(p.x + 1.05, p.y + s * 0.36, p.z), V3(q.x - 0.42, q.y - s * 0.36, q.z), opt.color); }
  if (q.x > p.x + 0.5) return arrow(V3(p.x + 1.26, p.y, p.z), V3(q.x - 0.84, q.y, q.z), opt.color);
  return arrow(V3(p.x + 1.05, p.y, p.z + 0.62), V3(q.x - 0.42, q.y, q.z + 0.62), opt.color);
}
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

// ───────── lhXHk8IuFeQ 01:20：Array 的兩個缺點 ─────────
FRAG.push(['llpeng12-array-cons', 'Array 的缺點：大小固定、要搬資料', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.6, 0]);
  const N = 9, X = (i) => -5.6 + i * 1.4;
  const slots = [];
  for (let i = 0; i < N; i++) { slots.push(cube('', SAND, [1.25, 0.08, 1.25], X(i), 0.04, 0)); tag('[' + i + ']', 'idx', X(i), 0, 1.1); }
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'HAT'];
  await step(tok);                                   // 1:20 stack、queue 都用 array 實作
  say('第二、三章的 stack、queue 都用 array 實作', '先回頭看 array 長什麼樣子');
  await step(tok);                                   // 1:34 連續的記憶體空間
  say('Array：一塊連續的記憶體空間', 'data item 依序放進去');
  const cs = [];
  for (let i = 0; i < 5; i++) { cs.push(cube(W[i], BLUE, [1.1, 0.75, 1.1], X(i), 0.45, 0)); await dropIn(tok, cs[i], 260); }
  await step(tok);                                   // 1:49 缺點：array 到底要開多大
  const mx = tag('MAX_SIZE = 9', 'ptr', 0, 1.6, -1.2);
  say('缺點一：array 到底要開多大？', '宣告時就得決定 MAX_SIZE');
  await step(tok);                                   // 2:09 有時 10、有時 100 或 10000
  for (let i = 5; i < N; i++) glow(slots[i], GOLD);
  say('資料量會變：有時 10 筆，有時 100、10000 筆', '大小卻一開始就固定');
  await step(tok);                                   // 2:24 浪費很多空間
  for (let i = 5; i < N; i++) { glow(slots[i], null); tint(slots[i], '#f0b4a8'); }
  say('開太大：沒用到的格子都浪費', '9 格只用了 5 格');
  await step(tok);                                   // 2:44 insert／delete → data movement
  for (let i = 5; i < N; i++) tint(slots[i], SAND);
  kill(mx);
  say('缺點二：insert／delete 常要搬資料', '例：GAT 要插在 FAT 後面 → HAT 先往後搬');
  const g = cube('GAT', ORANGE, [1.1, 0.75, 1.1], X(4), 2.6, 0);
  glow(cs[4], GOLD);
  await slide(tok, cs[4], X(5), 0.45, 0, 600); glow(cs[4], null);
  await slide(tok, g, X(4), 0.45, 0, 500);
  cs.splice(4, 0, g);
  await step(tok);                                   // 3:05 不搬資料會誤判「滿了」
  fly(cs[0]); fly(cs[1]); cs.splice(0, 2);
  for (let i = 6; i < N; i++) { const m = cube('新', TEAL, [1.1, 0.75, 1.1], X(i), 0.45, 0); cs.push(m); await dropIn(tok, m, 220); }
  glow(slots[0], GREEN); glow(slots[1], GREEN);
  const full = tag('尾巴到底 → 以為滿了？', 'ptr alt', X(7), 1.7, 0);
  say('前面拿走、後面加入：尾巴碰到底', '前面明明有空位，不搬就會誤判「滿了」');
  await step(tok);                                   // 3:21 資料搬移跑不掉
  kill(full); glow(slots[0], null); glow(slots[1], null);
  await Promise.all(cs.map((m, k) => slide(tok, m, X(k), 0.45, 0, 700)));
  say('把資料往前搬，空位才回到後面', 'array 做 insert／delete：data movement 跑不掉');
  await step(tok);                                   // 3:35 另一種 data structure：linked list
  say('所以有另一種 data structure', '→ linked list');
}]);

// ───────── lhXHk8IuFeQ 03:44：Linked list 的樣子 ─────────
FRAG.push(['llpeng12-ll-intro', 'Linked List：data、link 與 first', async (tok) => {
  fresh([0, 5.5, 12.5], [0, 0.8, 0]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'HAT'];
  const ns = [];
  await step(tok);                                   // 3:44 linked list 長這樣：課本例子
  say('Linked list 長這樣：課本的例子', 'node 一個一個排排站');
  for (let i = 0; i < 5; i++) { ns.push(node(W[i], -5.6 + i * 2.4)); await dropIn(tok, ns[i], 260); }
  await step(tok);                                   // 3:48 依英文字母排序
  ns.forEach((g) => glow(D(g), GOLD));
  say('依照英文字母順序排好', 'BAT、CAT、EAT、FAT、HAT');
  await step(tok);                                   // 4:05 每個 element 兩個欄位
  ns.forEach((g) => glow(D(g), null));
  tag('data', 'idx', -5.6, -0.1, 1.0); tag('link', 'idx', -4.87, -0.1, 1.0);
  say('每一個 element（node）有兩個欄位', '左：data　右：link');
  await step(tok);                                   // 4:11 第一個欄位：三個字元
  glow(D(ns[0]), GOLD);
  say('第一個欄位 data：放三個字元', 'char data[3]');
  await step(tok);                                   // 4:20 link 指向下一個 element
  glow(D(ns[0]), null);
  for (let i = 0; i < 5; i++) lk(ns[i], ns[i + 1] || null);
  say('第二個欄位 link：是 pointer，指向下一個 element', '最後一個 HAT 的 link 是 NULL');
  await step(tok);                                   // 4:29 下一個 element 是 CAT
  glow(D(ns[1]), GOLD);
  say('BAT 的下一個 element 是 CAT', '照著 link 一個接一個');
  await step(tok);                                   // 4:40 指標指向 linked list 的頭
  glow(D(ns[1]), null);
  tag('first', 'ptr', -5.6, 2.0, 0); arrow(V3(-5.6, 1.75, 0), V3(-5.6, 0.9, 0));
  say('還有一個指標，指向 linked list 的頭', '叫做 first');
  await step(tok);                                   // 4:50 first element
  glow(D(ns[0]), GOLD);
  say('first → BAT：第一個 element', 'data ＋ link ＋ first：linked list 的表示法');
}]);

// ───────── lhXHk8IuFeQ 04:59：把 GAT 插在 FAT 後面 ─────────
FRAG.push(['llpeng12-insert-gat', '插入 GAT：兩個 pointer assignment', async (tok) => {
  fresh([0, 6, 13], [0, 1.2, 0]);
  const c = chainOf(['BAT', 'CAT', 'EAT', 'FAT', 'HAT'], -6);
  tag('first', 'ptr', -6, 1.6, 0);
  const cd = code(['① GAT.link = FAT.link;', '② FAT.link = &GAT;'], -2.4, 4.4);
  await step(tok);                                   // 4:59 新增 GAT
  say('要把 GAT 加進這條 linked list', '要怎麼做？');
  await step(tok);                                   // 5:11 create 一個新的 node
  const g = node('GAT', 1.35, 2.5, 0, ORANGE);
  await dropIn(tok, g, 450);
  say('先 create 一個新的 node 存放 GAT', 'GAT 的 link 還沒設定');
  await step(tok);                                   // 5:25 插在 FAT 後面
  glow(D(c.ns[3]), GOLD); glow(D(c.ns[4]), GOLD);
  say('GAT 要插在 FAT 後面、HAT 前面', '目標：FAT → GAT → HAT');
  await step(tok);                                   // 5:38 虛線：插入後產生的新 pointer
  glow(D(c.ns[3]), null); glow(D(c.ns[4]), null);
  const d1 = lk(c.ns[3], g, { color: GHOST }), d2 = lk(g, c.ns[4], { color: GHOST });
  say('灰線（投影片上的虛線）：插入後會產生的新 link', 'FAT → GAT、GAT → HAT');
  await step(tok);                                   // 5:59 原本的實線會不見
  const gone = tag('✕ 這條會消失', 'ptr alt', 1.35, 0.95, 0.5);
  say('原本 FAT → HAT 的實線，assignment 後就不見了', '');
  await step(tok);                                   // 6:43 誰擁有「指向 HAT」的資訊？
  glow(D(c.ns[3]), GOLD);
  say('「GAT 要指到 HAT」這個資訊在誰手上？', '在 FAT 原本的 link（實線）裡');
  await step(tok);                                   // 6:55 第一行
  cd.hl(0); kill(d2);
  const a1 = lk(g, c.ns[4]);
  say('① 把 FAT 的 link 抄給 GAT 的 link', 'GAT.link = FAT.link → GAT 指向 HAT');
  await step(tok);                                   // 7:13 第二行
  cd.hl(1); kill(d1); kill(gone);
  kill(c.ls[3]); c.ls[3] = lk(c.ns[3], g);
  say('② FAT 的 link 改成 GAT 這個 node 的位址', 'FAT.link = &GAT');
  await step(tok);                                   // 7:57 兩個 assignment 就完成
  glow(D(c.ns[3]), null); cd.hl(-1); kill(a1);
  await Promise.all([slide(tok, g, 2.4, 0.5, 0, 600), slide(tok, c.ns[4], 4.5, 0.5, 0, 600)]);
  c.ns.splice(4, 0, g); relinkAll(c);
  say('兩個簡單的 assignment，FAT → HAT 自然就不見了', 'BAT → CAT → EAT → FAT → GAT → HAT');
  await step(tok);                                   // 8:04 看圖說故事
  say('考試、寫程式都一樣：先把圖畫出來，看圖說故事', '先畫結果，再寫讓 pointer 符合結果的 assignment');
}]);

// ───────── lhXHk8IuFeQ 08:39：刪除 GAT ─────────
FRAG.push(['llpeng12-delete-gat', '刪除 GAT：FAT.link = GAT.link', async (tok) => {
  fresh([0, 6, 13], [0, 1.0, 0]);
  const c = chainOf(['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'], -6.2);
  const f = tag('first', 'ptr', -6.2, 1.6, 0);
  const g = c.ns[4];
  await step(tok);                                   // 8:39 要把 GAT 刪除
  glow(D(g), RED);
  say('例子：把剛加進來的 GAT 刪掉', '');
  await step(tok);                                   // 9:16 FAT 直接連到 HAT（虛線）
  const fx = c.ns[3].position.x, hx = c.ns[5].position.x;
  const dsh = arrow(V3(fx + 0.73, 1.05, 0.3), V3(hx - 0.3, 1.05, 0.3), GHOST);
  say('刪掉 GAT 後：FAT 直接連到 HAT', '灰線就是要產生的新 link');
  await step(tok);                                   // 9:25 這條 link 要指到 HAT
  say('這條 link 要怎麼 assign？', '它要指到 HAT');
  await step(tok);                                   // 9:33 誰指到 HAT？GAT 的 link
  glow(D(g), GOLD);
  say('誰指到 HAT？GAT 的 link', '「指向 HAT」的資訊在 GAT.link 裡');
  await step(tok);                                   // 9:41 一個指令就結束
  kill(dsh); kill(c.ls[3]); kill(c.ls[4]);
  await slide(tok, g, g.position.x, 2.4, 0, 500);
  const ga = lk(g, c.ns[5]);
  c.ls[3] = lk(c.ns[3], c.ns[5]);
  glow(D(c.ns[3]), GOLD);
  say('FAT.link = GAT.link', '一個指令就結束');
  await step(tok);                                   // 9:59 排排站：GAT 拿掉
  glow(D(c.ns[3]), null); glow(D(g), null);
  kill(ga); fly(g);
  c.ns.splice(4, 1); c.ls.splice(4, 1);
  await slide(tok, c.ns[4], -6.2 + 4 * 2.1, 0.5, 0, 500);
  relinkAll(c);
  say('GAT 從 list 上拿掉了', 'BAT → CAT → EAT → FAT → HAT');
  await step(tok);                                   // 10:07 data、link 和特別重要的 first
  glow(D(c.ns[0]), GOLD); txt(f, 'first（特別重要）'); arrow(V3(-6.2, 1.35, 0), V3(-6.2, 0.9, 0));
  say('Linked list：data、link，還有特別重要的指標 first', '');
}]);

// ───────── lhXHk8IuFeQ 10:15：要刪 GAT，得先找到 GAT ─────────
FRAG.push(['llpeng12-search-gat', '刪除前先搜尋：linked list vs array', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.4, 0.6]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'];
  const c = chainOf(W, -6.2, 2.1, 0.5, -1.2);
  tag('first', 'ptr', -6.2, 1.6, -1.2);
  const r = ring();
  const visit = async (i, ms = 550) => { ringAt(r, c.ns[i]); glow(D(c.ns[i]), i === 4 ? GREEN : GOLD); await beat(tok, ms); if (i < 4) glow(D(c.ns[i]), null); };
  await step(tok);                                   // 10:15 刪除 GAT：先找到 GAT 在哪
  say('要刪除 GAT：首先得找到 GAT 在哪裡', '');
  await step(tok);                                   // 10:41 示意圖用人的智慧
  glow(D(c.ns[4]), GREEN);
  const eye = tag('人眼一看就知道', 'ptr alt', c.ns[4].position.x, 1.6, -1.2);
  say('示意圖上，人一眼就看到 GAT', '用的是「人的智慧」');
  await step(tok);                                   // 10:49 程式要怎麼做？
  glow(D(c.ns[4]), null); kill(eye);
  say('但程式手上只有 first', '要怎麼找到 GAT？');
  await step(tok);                                   // 11:48 從 first 開始走
  ringAt(r, c.ns[0]);
  say('從 first 指標開始走', '');
  await step(tok);                                   // 11:54 檢查是不是 GAT
  glow(D(c.ns[0]), GOLD);
  say('檢查這個 node 的資料：BAT == GAT？', '不是');
  await step(tok);                                   // 12:03 不等就繼續走
  glow(D(c.ns[0]), null);
  await visit(1); await visit(2);
  say('不相等就沿著 link 繼續走、繼續檢查', 'CAT？EAT？都不是');
  await step(tok);                                   // 12:11 終於找到
  await visit(3); await visit(4);
  say('終於找到 GAT', '');
  await step(tok);                                   // 12:18 找到才刪除；缺點
  say('找到後才做刪除的 pointer assignment', '缺點：delete 前要從 first 一個一個檢查');
  await step(tok);                                   // 12:45 如果用 array 存
  r.visible = false; glow(D(c.ns[4]), null);
  const X = (i) => -5.0 + i * 1.6;
  const cs = W.map((w, i) => { tag('[' + i + ']', 'idx', X(i), 0, 3.0); return cube(w, '#7fb6e8', [1.2, 0.7, 1.0], X(i), 0.35, 2.1); });
  say('如果用 array 存：每一格放三個字元', '');
  await step(tok);                                   // 13:06 理論上比較快
  say('理論上會比較快：不用一個一個追 pointer', 'array 是連續的記憶體空間');
  await step(tok);                                   // 13:23 for 迴圈直接檢查
  for (let i = 0; i < 5; i++) { glow(cs[i], i === 4 ? GREEN : GOLD); await beat(tok, 300); if (i < 4) glow(cs[i], null); }
  say('一個 for 迴圈，依位置檢查每個 element', 'list[i] == GAT？');
  await step(tok);                                   // 13:39 linked list 的缺點
  glow(cs[4], null);
  say('linked list 也許能省空間，但刪除前要先 search', '補充：兩者循序找都是 O(n)，array 常數較小');
}]);

// ───────── lhXHk8IuFeQ 14:04：pointer 亂指／斷掉、doubly linked list ─────────
FRAG.push(['llpeng12-ll-risk', 'Pointer 出錯的風險與 Doubly Linked List', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.6, 0]);
  const W = ['BAT', 'CAT', 'EAT', 'FAT', 'GAT', 'HAT'];
  const c = chainOf(W, -6.2);
  tag('first', 'ptr', -6.2, 1.6, 0);
  await step(tok);                                   // 14:09 如果 pointer 亂指
  say('6 個 node：BAT … HAT', '如果做 assignment 時 pointer 亂指？');
  await step(tok);                                   // 14:25 EAT 指到 HAT
  kill(c.ls[2]);
  const bad = arrow(V3(-2.0 + 0.73, 1.0, 0), V3(4.0, 1.0, 0), 0xb03030);
  say('EAT 不是指向 FAT，而是亂指到 HAT', '');
  await step(tok);                                   // 14:34 有些東西沒檢查到
  tint(D(c.ns[3]), DIM); tint(D(c.ns[4]), DIM);
  say('FAT、GAT 就檢查不到了', 'search 會漏掉中間的 node');
  await step(tok);                                   // 14:43 某個 link 斷掉
  kill(bad); c.ls[2] = lk(c.ns[2], c.ns[3]); tint(D(c.ns[4]), BLUE);
  kill(c.ls[2]);
  const brk = tag('✕ 斷掉', 'ptr alt', -0.95, 1.1, 0);
  for (let i = 3; i < 6; i++) tint(D(c.ns[i]), DIM);
  say('若某個 link 斷了，link 的資訊不見', '後面的 node 全部 missing');
  await step(tok);                                   // 14:56 Doubly linked list
  kill(brk); c.ls[2] = lk(c.ns[2], c.ns[3]); for (let i = 3; i < 6; i++) tint(D(c.ns[i]), BLUE);
  const back = [];
  for (let i = 5; i > 0; i--) back.push(arrow(V3(c.ns[i].position.x - 0.3, 0.5, 0.62), V3(c.ns[i - 1].position.x + 0.73, 0.5, 0.62), 0x2f7a5a));
  say('Doubly linked list：雙向指標', '每個 node 多一個往回指的 link');
  await step(tok);                                   // 15:04 要找的東西在最後面
  tag('last', 'ptr alt', c.ns[5].position.x, 1.6, 0);
  glow(D(c.ns[5]), GOLD);
  say('要找的東西在 linked list 最後面？', '');
  await step(tok);                                   // 15:12 前後同時找
  glow(D(c.ns[0]), GOLD);
  say('可以從前面和後面同時找', 'first →　　← last');
  await step(tok);                                   // 15:20 斷一條還有另一條
  glow(D(c.ns[0]), null); glow(D(c.ns[5]), null);
  kill(c.ls[2]); tag('✕', 'ptr alt', -0.95, 1.1, 0);
  say('一個方向的 pointer 斷了', '另一個方向的 link 還在，可以 maintain');
  await step(tok);                                   // 15:43 有優點也有缺點
  say('看起來很直覺，但每個 data structure', '都有它的優點，也有它的缺點');
}]);

// ───────── lhXHk8IuFeQ 16:00／17:17：兩種 class 宣告方式（params.focus = 'nested' 播第二種） ─────────
FRAG.push(['llpeng12-class-design', 'ThreeLetterNode：外部 class vs nested class', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 5.5, 13], [0, 2.2, 0]);
  if (P.focus !== 'nested') {
    let cd = null;
    await step(tok);                                 // 16:00 宣告一個 class
    cd = code(['class ThreeLetterList;  // forward', 'class ThreeLetterNode {', '  friend class ThreeLetterList;', 'private:', '  char data[3];', '  ThreeLetterNode *link;', '};', 'class ThreeLetterList {', 'public:  // List operations', 'private:', '  ThreeLetterNode *first;', '};'], -3.3, 6.2, 0.5);
    say('做法一：為 node 宣告一個 class', '');
    await step(tok);                                 // 16:07 3-letter 的 node
    cd.hl(1);
    const g = node('BAT', 1.6, 0.5, 0, BLUE);
    await dropIn(tok, g);
    say('class ThreeLetterNode：包含 3 個字元的 node', '');
    await step(tok);                                 // 16:16 char data[3] 與 link
    cd.hl(4);
    tag('char data[3]', 'idx', 1.2, -0.15, 1.0);
    const g2 = node('CAT', 3.7, 0.5, 0, BLUE); lk(g, g2);
    say('private：char data[3] 和 link', 'ThreeLetterNode *link');
    await step(tok);                                 // 16:37 class ThreeLetterList
    cd.hl(7);
    say('整條 linked list 定義成 class ThreeLetterList', '');
    await step(tok);                                 // 16:44 public：list operation
    cd.hl(8);
    say('public：做 list 的 operation', '');
    await step(tok);                                 // 16:51 private 只要一個變數 first
    cd.hl(10);
    tag('first', 'ptr', 1.6, 2.0, 0); arrow(V3(1.6, 1.75, 0), V3(1.6, 0.9, 0));
    say('private 只要一個變數：指向頭端的 first', 'ThreeLetterNode *first');
    await step(tok);                                 // 17:08 其餘靠 link 串起來
    cd.hl(5);
    const g3 = node('EAT', 5.8, 0.5, 0, BLUE); lk(g2, g3);
    say('其餘的 node 透過 link 串結起來', 'first → BAT → CAT → EAT …');
    return;
  }
  let cd2 = null;
  await step(tok);                                   // 17:17 nested class
  cd2 = code(['class ThreeLetterList {', 'public:  // List operations', 'private:', '  class ThreeLetterNode {  // nested', '  public:', '    char data[3];', '    ThreeLetterNode *link;', '  };', '  ThreeLetterNode *first;', '};'], -3.3, 6.0, 0.5);
  say('做法二：nested class', 'class 裡面有 class');
  await step(tok);                                   // 17:34 list 裡有 private 的部分
  cd2.hl(2);
  const box1 = ghostBox('#4b9ee2', 5.4, 2.6, 2.6); box1.position.set(3.6, 1.1, 0);
  tag('ThreeLetterList', 'ptr', 3.6, 2.9, 0);
  say('ThreeLetterList 裡面有 private 的部分', '');
  await step(tok);                                   // 17:43 private 裡再定義 class
  cd2.hl(3);
  const g = node('BAT', 3.0, 0.5, 0, BLUE); lk(g, null);
  await dropIn(tok, g);
  say('在 private 裡再定義 class ThreeLetterNode', '外界看不到它');
  await step(tok);                                   // 17:55 外面 vs 裡面
  cd2.hl(-1);
  say('第一種：node class 宣告在外面', '第二種：宣告在 list class 裡面');
  await step(tok);                                   // 18:21 哪個比較好？
  say('哪一個比較好？', '至少講得出 nested 的一個缺點');
  await step(tok);                                   // 18:38 第二條 list
  const box2 = ghostBox('#dd8238', 3.2, 2.0, 2.0); box2.position.set(3.6, 1.0, -3.4);
  tag('第二條 3-letter list', 'ptr alt', 3.6, 2.5, -3.4);
  say('假設要第二條 3-letter 的 linked list', '');
  await step(tok);                                   // 18:52 private 部分 copy 一份
  const g2 = node('BAT', 3.2, 0.5, -3.4, ORANGE);
  await dropIn(tok, g2);
  say('private 的部分得 copy 一份 embed 進去', 'node 的定義寫兩次');
  await step(tok);                                   // 19:02 外面的好處
  say('外部 class 的好處：其他 class 都能共用', 'ThreeLetterNode 隨時可以再拿來用');
  await step(tok);                                   // 19:31 friend class
  tag('別忘了：friend class ThreeLetterList;', 'ptr', -3.3, 0.4, 0.5);
  say('只是要多寫一行 friend class', '記得要寫');
  await step(tok);                                   // 19:46 各有優缺點
  say('兩種寫法各有優缺點', '回去想想看');
}]);

// ───────── lhXHk8IuFeQ 20:25：x = y 與 *x = *y ─────────
FRAG.push(['llpeng12-ptr-assign', 'Pointer assignment：x = y vs *x = *y', async (tok) => {
  fresh([0, 7, 12], [0, 0.5, 0]);
  const pv = (name, z) => cube(name, PURP, [0.8, 0.6, 0.8], -5.5, 0.4, z);
  const nodeA = () => ({ a: node('a', -1.5, 0.5, -1.6, BLUE), na: node('…', 2.8, 0.5, -1.6, GRAY) });
  const nodeB = () => ({ b: node('b', -1.5, 0.5, 1.6, ORANGE), nb: node('…', 2.8, 0.5, 1.6, GRAY) });
  await step(tok);                                   // 20:25 兩個 pointer x、y
  let xv = pv('x', -1.6), yv = pv('y', 1.6);
  say('兩個 pointer 變數：x 和 y', '');
  await step(tok);                                   // 20:31 x 指到資料 a 的 node
  let A = nodeA();
  let xa = arrow(V3(-5.1, 0.4, -1.6), V3(-2.02, 0.4, -1.6));
  let la = lk(A.a, A.na);
  say('x 指到一個 node，資料放 a', '');
  await step(tok);                                   // 20:40 y 指到資料 b 的 node
  let B = nodeB();
  arrow(V3(-5.1, 0.4, 1.6), V3(-2.02, 0.4, 1.6));
  lk(B.b, B.nb);
  say('y 也指到一個 node，資料放 b', '');
  await step(tok);                                   // 20:51 x = y
  const cd = code(['x = y;'], 4.6, 3.2);
  kill(xa); xa = arrow(V3(-5.1, 0.45, -1.6), V3(-2.02, 0.5, 1.4), 0xb07a10);
  tint(D(A.a), DIM);
  say('做 x = y：x、y 指到同一個 node（b）', 'x == y；原本的 a 沒人指了');
  await step(tok);                                   // 21:13 把 y 的位址給 x
  glow(yv, GOLD);
  say('意思是：把 y 所指 node 的 memory address 給 x', '複製的是「位址」');
  await step(tok);                                   // 21:34 *x = *y
  cd.kill(); fresh([0, 7, 12], [0, 0.5, 0]);
  xv = pv('x', -1.6); yv = pv('y', 1.6); A = nodeA(); B = nodeB();
  arrow(V3(-5.1, 0.4, -1.6), V3(-2.02, 0.4, -1.6)); arrow(V3(-5.1, 0.4, 1.6), V3(-2.02, 0.4, 1.6));
  la = lk(A.a, A.na); lk(B.b, B.nb);
  code(['*x = *y;'], 4.6, 3.2);
  say('重來：這次做 *x = *y', '');
  await step(tok);                                   // 21:55 所有欄位都 assign
  glow(D(B.b), GOLD);
  say('y 所指 node 的所有欄位，都 assign 給 x 所指的 node', '');
  await step(tok);                                   // 22:08 data 欄位：b 給過去
  setData(A.a, 'b'); tint(D(A.a), ORANGE);
  say('第一個欄位 data：b 給過去', 'a 變成 b');
  await step(tok);                                   // 22:18 pointer 欄位也給過去
  kill(la); la = arrow(V3(-0.54, 0.5, -1.6), V3(2.28, 0.5, 1.35), 0xb07a10);
  say('第二個欄位 pointer 也給過去', '兩個 link 指向同一個 node');
  await step(tok);                                   // 22:36 常被忽略的 link
  say('所有欄位都做 assignment', '常被忽略：連 link 都動到了');
  await step(tok);                                   // 23:10 x、y 仍指向不同位址
  glow(D(B.b), null); glow(xv, GOLD); glow(yv, GOLD);
  say('但 x、y 還是指向不同的 memory address', 'x != y，只是兩個 node 的內容一樣');
}]);

// ───────── lhXHk8IuFeQ 33:42：Create2 ─────────
FRAG.push(['llpeng12-create2', 'Create2：建立含 10、20 的兩個 node', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.6, 0]);
  let cd = null;
  await step(tok);                                   // 33:42 member function Create2
  cd = code(['void List::Create2() {', '  first = new ListNode(10);', '  first->link = new ListNode(20);', '}', 'ListNode(int element = 0)', '  { data = element; link = 0; }'], -3.2, 5.6, 0.5);
  say('member function：Create2', '在 linked list 裡產生兩個 node');
  await step(tok);                                   // 34:32 兩個 node 長這樣
  const goal = tag('目標：first → 10 → 20 → NULL', 'ptr alt', 2.4, 3.0, 0);
  say('一個放 10、一個放 20', '20 是尾巴，link 是 NULL；first 指向 10');
  await step(tok);                                   // 34:58 看圖說故事
  say('又回到看圖說故事：先知道結果長什麼樣', '');
  await step(tok);                                   // 35:08 第一行
  cd.hl(1);
  const a = node(10, 0.8, 0.5, 0, BLUE);
  await dropIn(tok, a);
  say('第一行：new ListNode(10)', '');
  await step(tok);                                   // 35:20 constructor
  cd.hl(4);
  say('ListNode 的 constructor：引數 element', '沒給值的話 element = 0');
  await step(tok);                                   // 35:35 data、link 兩個欄位
  cd.hl(5);
  tag('data', 'idx', 0.8, -0.15, 1.0); tag('link', 'idx', 1.53, -0.15, 1.0);
  say('資料分兩個欄位：data 和 link', '');
  await step(tok);                                   // 35:48 data = 10、link = 0
  const n1 = lk(a, null, { text: '0' });
  say('做完：data = 10、link = 0', '');
  await step(tok);                                   // 35:56 link 想成 NULL
  txt(n1, '0（NULL）');
  say('link = 0：把它想成 NULL', '');
  await step(tok);                                   // 36:10 first 指到 10
  cd.hl(1);
  tag('first', 'ptr', 0.8, 2.1, 0); arrow(V3(0.8, 1.85, 0), V3(0.8, 0.9, 0));
  say('first 指到這個 10 的空間', 'first = new ListNode(10)');
  await step(tok);                                   // 36:28 第二行 new ListNode(20)
  cd.hl(2);
  const b = node(20, 3.7, 0.5, 0, ORANGE);
  await dropIn(tok, b);
  lk(b, null);
  say('第二行：new ListNode(20)', '產生 20 的 node，link 也是 0');
  await step(tok);                                   // 36:37 位址給 first->link
  kill(n1); lk(a, b);
  say('new 出來的 memory address 直接給 first->link', 'first->link = new ListNode(20)');
  await step(tok);                                   // 37:01 兩個指令就完成
  cd.hl(-1); kill(goal);
  say('兩個指令就產生含 10、20 的 linked list', 'first → 10 → 20 → NULL');
}]);

// ───────── lhXHk8IuFeQ 37:27：Insert50(x) ─────────
FRAG.push(['llpeng12-insert50', 'Insert50：把 50 插在 x 後面', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.8, 0]);
  let cd = null, c = null, xl = null, t = null, tl = null, a1 = null;
  await step(tok);                                   // 37:27 insert 在指定 node 後面
  cd = code(['void List::Insert50(ListNode *x) {', '  ListNode *t = new ListNode(50);', '  if (!first) { first = t; return; }', '  t->link = x->link;', '  x->link = t;', '}'], -2.8, 6.2, 0.5);
  say('insert 一個 node：插在我指定的 node 後面', '');
  await step(tok);                                   // 37:41 Insert50(x)
  cd.hl(0);
  say('Insert50(x)：data 是 50 的 node，插在 x 後面', '');
  await step(tok);                                   // 38:11 x 是第一個 node
  c = chainOf([10, 20], -3.0, 4.6);
  tag('first', 'ptr', -3.0, 1.7, 0);
  xl = tag('x', 'ptr alt', -3.0, 2.3, 0);
  say('示意圖：x 給定的是第一個 node（10）', '原本 10、20 兩個 node');
  await step(tok);                                   // 38:34 結果 10、50、20
  say('50 插在 10 的後面', '結果：10 → 50 → 20');
  await step(tok);                                   // 39:05 create 50，t 指向它
  cd.hl(1);
  t = node(50, -0.6, 2.6, 0, ORANGE);
  await dropIn(tok, t);
  tl = tag('t', 'ptr', -0.6, 3.5, 0);
  say('先 create 50 的 node，pointer t 指向它', 't = new ListNode(50)');
  await step(tok);                                   // 39:34 判斷 list 是不是空的
  cd.hl(2);
  say('判斷 linked list 是不是空的', '空的話：50 就是第一個 node（first = t）');
  await step(tok);                                   // 40:00 不是空的
  say('很不幸，它不是空的', '已經有 10、20 兩個 node');
  await step(tok);                                   // 40:23 t->link = x->link
  cd.hl(3); glow(D(c.ns[0]), GOLD);
  a1 = lk(t, c.ns[1]);
  say('① t->link = x->link', 'x 的 link（指向 20）給 t 的 link → 50 指向 20');
  await step(tok);                                   // 41:07 x->link = t
  cd.hl(4);
  kill(c.ls[0]); c.ls[0] = lk(c.ns[0], t);
  say('② x->link = t', 'x 改指向 50');
  await step(tok);                                   // 41:37 順序可以顛倒嗎？
  glow(D(c.ns[0]), null); cd.hl(-1);
  kill(a1); kill(xl); kill(tl);
  await Promise.all([slide(tok, t, -0.9, 0.5, 0, 600), slide(tok, c.ns[1], 1.2, 0.5, 0, 600)]);
  c.ns.splice(1, 0, t); relinkAll(c);
  say('完成：10 → 50 → 20', '這兩行的順序可以顛倒嗎？');
  await step(tok);                                   // 41:59 顛倒會 lost
  tint(D(c.ns[2]), DIM);
  say('一旦顛倒，就會 lost link 的資料', '先做 x->link = t，20 的位址就沒人記得了');
  await step(tok);                                   // 42:31 把圖畫出來
  tint(D(c.ns[2]), ORANGE);
  say('做 linked list，千萬要把圖畫出來', '先 t->link = x->link，再 x->link = t');
}]);

// ───────── lhXHk8IuFeQ 43:00：刪除第一個 node ─────────
FRAG.push(['llpeng12-delete-first', '刪除第一個 node：ptr = ptr->link', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const c = chainOf([10, 50, 20], -2.6, 2.6);
  const pv = cube('ptr', PURP, [1.0, 0.6, 0.8], -6.0, 0.4, 0);
  let pa = arrow(V3(-5.5, 0.4, 0), V3(-3.12, 0.45, 0));
  const cd = code(['ptr = ptr->link;'], 1.0, 3.6);
  let lkf = null;
  await step(tok);                                   // 43:00 10、50、20，PTR 指向頭
  say('10、50、20：PTR 指向頭端', '也可以叫 first、head');
  await step(tok);                                   // 43:15 刪第一個元素
  glow(D(c.ns[0]), RED);
  say('把第一個元素刪掉', '');
  await step(tok);                                   // 43:25 指標要指向第二個 node
  say('刪完以後，記得讓指標指向第二個 node', '第二個 node 的位址在哪？');
  await step(tok);                                   // 43:32 PTR 所指 node 的 link
  lkf = tag('ptr->link', 'ptr alt', -1.9, 1.3, 0);
  say('就在 PTR 所指 node 的 link 裡', 'ptr->link → 50');
  await step(tok);                                   // 43:38 assign 給 PTR 就結束
  cd.hl(0);
  kill(pa); pa = arrow(V3(-5.5, 0.4, 0), V3(-0.52, 0.45, 0.25), 0xb07a10);
  say('把它 assign 給 PTR 就結束', 'ptr = ptr->link');
  await step(tok);                                   // 43:44 結果長這樣
  kill(lkf); kill(c.ls[0]); fly(c.ns[0]); c.ns.shift(); c.ls.shift();
  say('結果長這樣', 'ptr → 50 → 20');
  await step(tok);                                   // 43:56 自己的欄位給自己？
  say('自己的欄位怎麼可以給自己？', '老師大一時也覺得好奇怪');
  await step(tok);                                   // 44:51 PTR 是 pointer 變數
  glow(pv, GOLD);
  say('PTR 是一個 pointer 變數，不是那個 node', '它只是「指向」那個 node');
  await step(tok);                                   // 45:27 ptr->link 也是 pointer
  say('ptr->link 也是 pointer', '所以 ptr = ptr->link 只是 pointer assignment');
}]);

// ───────── lhXHk8IuFeQ 45:43：刪除中間的 node ─────────
FRAG.push(['llpeng12-delete-mid', '刪除中間的 node：trail->link = x->link', async (tok) => {
  fresh([0, 6, 12], [0, 1.2, 0]);
  const c = chainOf([10, 50, 20], -3.4, 2.8);
  tag('first', 'ptr', -3.4, 1.6, 0);
  const cd = code(['trail->link = x->link;'], 0.5, 4.2);
  let pre = null, xl = null, a = null;
  await step(tok);                                   // 45:43 要刪的不是第一個
  say('要刪除的 node 不是第一個呢？', '例子：10、50、20');
  await step(tok);                                   // 46:02 刪中間的 node
  tag('trail', 'ptr alt', -3.4, 2.2, 0); xl = tag('x', 'ptr alt', -0.6, 1.6, 0);
  glow(D(c.ns[1]), RED);
  say('刪中間的 50', 'x 指向 50，trail 指向它前一個 node');
  await step(tok);                                   // 46:14 結果：10 直接指向 20
  pre = arrow(V3(-2.67, 1.05, 0.3), V3(1.9, 1.05, 0.3), GHOST);
  say('結果：10 的 pointer 直接指向 20', '');
  await step(tok);                                   // 46:22 50 的 link 給前一個
  cd.hl(0); kill(pre);
  kill(c.ls[0]); kill(c.ls[1]);
  await slide(tok, c.ns[1], -0.6, 2.4, -0.6, 500); xl.position.set(-0.6, 3.3, -0.6);
  a = lk(c.ns[1], c.ns[2]);
  c.ls[0] = arrow(V3(-2.44, 0.5, 0), V3(1.68, 0.5, 0));
  glow(D(c.ns[0]), GOLD);
  say('50 的 link（20 的位址）給前一個 node', 'trail->link = x->link');
  await step(tok);                                   // 46:42 結果長這樣
  glow(D(c.ns[0]), null); cd.hl(-1);
  say('結果：10 → 20', '50 已經不在 list 上了');
}]);

// ───────── lhXHk8IuFeQ 46:54：delete 還是放進 free list ─────────
FRAG.push(['llpeng12-free-pool', '刪掉的 node：delete 還是放進 free list', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  let m = cube('50', ORANGE, [1.2, 0.7, 1.0], 0, 0.35, 1.2);
  let sys = null, pool = null, pl = null;
  await step(tok);                                   // 46:54 要不要 release memory
  say('50 已經從 list 拿掉了', '要不要把它的 memory release？');
  await step(tok);                                   // 47:10 要不要 delete？
  say('要不要再做 delete 這個 node？', '覺得要做的舉手');
  await step(tok);                                   // 47:42 沒有標準答案
  say('沒有標準答案：可做可不做', '');
  await step(tok);                                   // 47:55 做法一：delete
  sys = ghostBox('#7a6a55', 3.2, 2.2, 2.2); sys.position.set(-4.8, 1.1, -1.5);
  tag('系統記憶體', 'ptr', -4.8, 2.6, -1.5);
  fly(m, V3(-4, 6, -3));
  say('做法一：delete 掉，記憶體還給系統', '對 memory 斤斤計較');
  await step(tok);                                   // 48:08 做法二：另一條 linked list
  pool = ghostBox('#2fc092', 6.0, 1.6, 2.0); pool.position.set(3.0, 0.7, -1.8);
  m = cube('50', ORANGE, [1.2, 0.7, 1.0], 0, 0.35, 1.2);
  await slide(tok, m, 2.8, 0.35, -1.8, 600); tint(m, '#8fcfb8');
  say('做法二：先不還，用另一條 linked list 存放它', '');
  await step(tok);                                   // 48:24 叫 free list
  pl = tag('free list', 'ptr alt', 3.0, 2.1, -1.8);
  say('這條 linked list 叫 free 的 linked list', '');
  await step(tok);                                   // 48:31 要 new 時從 free list 拿
  await slide(tok, m, -1.0, 0.35, 2.2, 600);
  say('以後要 new node：直接從 free list 拿一個', '');
  await step(tok);                                   // 48:39 再做 data assignment
  relabel(m, '70'); tint(m, PURP);
  say('再做 data assignment', '改成新的資料（例如 70）');
  await step(tok);                                   // 48:48 少跟 memory 要空間
  say('好處：不用重新跟 memory 要空間', 'new 會呼叫 system call → overhead');
  await step(tok);                                   // 49:28 效率可能好一點
  say('兩種做法都可以', '用 free list，效率可能好一點');
}]);

// ───────── U_tNDdEooJU 00:00：複習上一堂 ─────────
FRAG.push(['llpeng12-review', '複習：linked list 的基本操作', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.0, 0]);
  let c = null, f = null;
  await step(tok);                                   // 0:00 每個 node 有 data、link
  c = chainOf(['BAT', 'CAT', 'EAT'], -4.4, 2.4);
  say('linked list：每個 node 有資料和 link', '');
  await step(tok);                                   // 0:37 first 指向頭端
  f = tag('first', 'ptr', -4.4, 1.6, 0);
  say('很重要的指標 first：指向第一個元素', '');
  await step(tok);                                   // 0:48 不同的 implement 方式
  const k = tag('不同 class／class 裡再包 class', 'ptr alt', 2.4, 2.4, 0);
  say('不同的 implement：不同 class，或 class 包 class', '');
  await step(tok);                                   // 1:17 產生兩個 node
  kill(k); c.ls.forEach(kill); c.ns.forEach(kill);
  c = chainOf([10, 20], -4.4, 4.8); txt(f, 'first');
  say('Create2：在 linked list 裡產生兩個 node', 'first → 10 → 20');
  await step(tok);                                   // 1:29 insert 50 在 10 後面
  const t = node(50, -2.0, 2.4, 0, ORANGE);
  await dropIn(tok, t, 380);
  kill(c.ls[0]);
  await Promise.all([slide(tok, t, -2.0, 0.5, 0, 450), slide(tok, c.ns[1], 0.4, 0.5, 0, 450)]);
  c.ns.splice(1, 0, t); relinkAll(c);
  say('insert：把 50 這個 node 插在 10 後面', '10 → 50 → 20');
  await step(tok);                                   // 1:43 delete 要看位置
  say('delete 要看位置', '刪第一個：要調整 first');
  await step(tok);                                   // 1:52 不是 first：從 first 找
  const r = ring();
  ringAt(r, c.ns[0]); await beat(tok, 450); ringAt(r, c.ns[1]); glow(D(c.ns[1]), RED);
  say('不是 first：從 first 開始找到它的位置', '找到 50');
  await step(tok);                                   // 1:59 50 的 link 給 10
  r.visible = false;
  kill(c.ls[0]); kill(c.ls[1]);
  await slide(tok, c.ns[1], -2.0, 2.4, -0.6, 450);
  lk(c.ns[1], c.ns[2]);
  c.ls[0] = arrow(V3(-3.44, 0.5, 0), V3(-0.12, 0.5, 0));
  say('50 指向 20 的 pointer assign 給 10', '10 就直接指到 20');
  await step(tok);                                   // 2:13 畫圖、看圖說故事
  say('畫出原本的圖、後來的圖', '看圖說故事就寫得出程式');
}]);

// ───────── U_tNDdEooJU 02:29：為什麼要 ListIterator ─────────
FRAG.push(['llpeng12-iter-why', 'ListIterator：把共用的 list 操作抽出來', async (tok) => {
  fresh([0, 6.5, 13], [0, 1.4, 0]);
  const names = ['List<A>', 'List<B>', 'List<C>'], xs = [-4.4, 0, 4.4];
  const OPS = ['NotNull', 'NextNotNull', 'First', 'Next'];
  let c = null, r = null;
  const ops = [];
  await step(tok);                                   // 2:29 list 還可以宣告 iterator
  const q = tag('class ListIterator ?', 'ptr alt', 0, 3.4, 0);
  say('List 還可以宣告一個 class：iterator', '');
  await step(tok);                                   // 2:39 專門做 list 的運作
  say('專門做 list 裡面的各種運作', '');
  await step(tok);                                   // 2:46 scan、有幾個 node
  c = chainOf([10, 50, 20], -2.6, 2.4, 0.5, 2.8);
  r = ring();
  for (let i = 0; i < 3; i++) { ringAt(r, c.ns[i]); await beat(tok, 380); }
  say('例如：scan 整條 list，看有哪些元素、有幾個 node', '');
  await step(tok);                                   // 2:57 判斷是不是 NULL
  say('判斷目前是不是 NULL、下一個是不是 NULL', 'NotNull／NextNotNull');
  await step(tok);                                   // 3:05 回報 first、next
  ringAt(r, c.ns[0]); glow(D(c.ns[0]), GOLD);
  say('回報 list 的第一個元素、下一個元素', 'First／Next');
  await step(tok);                                   // 3:13 不管哪種 list 都常用
  glow(D(c.ns[0]), null);
  say('不管哪一種 list，這些 operation 都常常用到', '');
  await step(tok);                                   // 3:21 不該綁死在 list class
  say('課本認為：它們不應該綁死在 list 的 class 裡', '應該單獨列出來');
  await step(tok);                                   // 3:31 List A、B、C
  r.visible = false; c.ls.forEach(kill); c.ns.forEach(kill); kill(q);
  for (let k = 0; k < 3; k++) {
    const b = ghostBox(['#4b9ee2', '#dd8238', '#2fc092'][k], 3.4, 2.6, 2.2); b.position.set(xs[k], 1.3, 0);
    tag(names[k], 'ptr', xs[k], 2.95, 0);
    const row = [];
    for (let i = 0; i < 4; i++) row.push(cube(OPS[i], '#e3d6bd', [1.5, 0.45, 0.8], xs[k] + (i % 2 ? 0.8 : -0.8), 0.3 + Math.floor(i / 2) * 0.6, 0, 2));
    ops.push(row);
  }
  say('不同型態的 list：List<A>、List<B>、List<C>', '每一種都需要這些 function');
  await step(tok);                                   // 4:02 class A 寫一次
  ops[0].forEach((m) => glow(m, GOLD));
  say('不用 iterator：幫 class A 的 list 寫一次', 'NotNull、Next、First…');
  await step(tok);                                   // 4:24 class B 又要再寫一次
  ops[0].forEach((m) => glow(m, null)); ops[1].forEach((m) => glow(m, RED));
  say('產生 class B 的 list，又要再做一次', '同樣的 operation 一直重寫');
  await step(tok);                                   // 4:37 抽出來變成 ListIterator
  ops.flat().forEach((m) => fly(m, V3(0, 7, 3)));
  const it = cube('ListIterator', PURP, [3.2, 0.8, 1.2], 0, 0.4, 3.6);
  await dropIn(tok, it, 450);
  for (const x of xs) arrow(V3(x * 0.3, 0.8, 3.0), V3(x, 0.9, 1.15), 0x6a4ec0);
  OPS.forEach((o, i) => tag(o + '()', 'idx', -2.4 + i * 1.6, 0, 4.6));
  say('general 的 operation 抽出來：ListIterator', '只寫一次，任何 type 的 list 都能用');
}]);

// ───────── U_tNDdEooJU 05:01：ListIterator 的宣告與運作 ─────────
FRAG.push(['llpeng12-iter-scan', 'ListIterator：list 參考與 current 指標', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.2, 0]);
  const cd = code(['template <class Type> class List {', '  friend class ListIterator<Type>;', 'private:  ListNode<Type>* first;', '};', 'template <class Type> class ListIterator {', 'public:', '  ListIterator(const List<Type>& l)', '    : list(l), current(l.first) {}', '  Boolean NotNull();  Boolean NextNotNull();', '  Type* First();  Type* Next();', 'private:', '  const List<Type>& list;', '  ListNode<Type>* current;', '};'], -3.0, 6.6, 0.46);
  const c = chainOf([10, 50, 20], 1.4, 2.2, 0.5, 0);
  tag('l.first', 'ptr', 1.4, 1.6, 0);
  const r = ring();
  let cur = null;
  await step(tok);                                   // 5:01 宣告 List 與 ListIterator
  cd.hl(4);
  say('宣告：template 的 List 與 ListIterator', '');
  await step(tok);                                   // 5:18 ListNode 宣告 friend
  say('ListIterator 要對 ListNode 做 scan、判斷', '所以 ListNode 要宣告 friend class ListIterator');
  await step(tok);                                   // 5:43 List class 非常簡單
  cd.hl(0);
  say('List 的 class 變得非常簡單', 'public member function 都抽到 ListIterator');
  await step(tok);                                   // 6:05 private 只有 first、也要 friend
  cd.hl(1);
  say('private 一樣只有指向第一個 node 的 first', '紅字：要把 ListIterator 宣告成 friend class');
  await step(tok);                                   // 6:30 ListIterator 的 private
  cd.hl(11);
  const lb = ghostBox('#4b9ee2', 7.0, 1.4, 1.6); lb.position.set(3.8, 0.5, 0);
  say('ListIterator 的 private：list', '不管哪種型態的 list，丟進來就好');
  await step(tok);                                   // 6:56 current 指向目前的 node
  cd.hl(12);
  cur = tag('current', 'ptr alt', 1.4, -0.3, 1.0); ringAt(r, c.ns[0]);
  say('list 指向要處理的 list；current 指向目前處理到的 node', '');
  await step(tok);                                   // 7:11 NotNull／NextNotNull
  cd.hl(8);
  say('NotNull／NextNotNull：目前、下一個是不是 NULL', '');
  await step(tok);                                   // 7:16 First
  cd.hl(9); glow(D(c.ns[0]), GOLD);
  say('First()：回傳 list 的第一個元素', '→ 10');
  await step(tok);                                   // 7:22 Next
  glow(D(c.ns[0]), null);
  ringAt(r, c.ns[1]); cur.position.set(c.ns[1].position.x, -0.3, 1.0); glow(D(c.ns[1]), GOLD);
  say('Next()：回傳現在所指的下一個元素', '→ 50');
  await step(tok);                                   // 7:28 初始值 current = l.first
  glow(D(c.ns[1]), null); cd.hl(7);
  ringAt(r, c.ns[0]); cur.position.set(c.ns[0].position.x, -0.3, 1.0);
  say('建構時：current = l.first', '一開始處理到第一個 element');
  await step(tok);                                   // 7:55 三個 class
  cd.hl(-1);
  say('現在有三個 class', 'ListNode、List、ListIterator');
  await step(tok);                                   // 8:29 寫一次就好
  say('以後不管什麼 type 的 list 都能用 ListIterator', '只要寫一次');
}]);

// ───────── U_tNDdEooJU 08:49：Attach 到尾端 ─────────
FRAG.push(['llpeng12-attach', 'Attach：把 node 接到 list 尾巴', async (tok) => {
  fresh([0, 6, 12.5], [0, 1.2, 0]);
  const cd = code(['newnode = new ListNode(k);', 'if (first == 0) first = last = newnode;', 'else { traverse 到 link == 0 的 node;', '       接上 newnode; }'], -3.2, 4.8, 0.5);
  let c = null, r = ring(), k = null;
  await step(tok);                                   // 8:49 Program 4.11 attach
  say('Program 4.11：attach 一個 node 到 list 的尾巴', '');
  await step(tok);                                   // 9:08 只知道 first
  c = chainOf([10, 50, 20], -4.6, 2.3);
  tag('first', 'ptr', -4.6, 1.6, 0);
  say('list 只知道指向第一個 node 的 first', '尾巴在哪？');
  await step(tok);                                   // 9:32 從頭端開始 scan
  ringAt(r, c.ns[0]);
  say('從頭端第一個 element 開始 scan', '');
  await step(tok);                                   // 9:45 link 不是 0 就往下
  for (let i = 1; i < 3; i++) { ringAt(r, c.ns[i]); await beat(tok, 600); }
  say('看 link 是不是 0（NULL）', '不是 0 → 還有元素，往下走');
  await step(tok);                                   // 9:59 遇到 0 就到尾端
  glow(D(c.ns[2]), GOLD);
  say('遇到 0（NULL）：到尾端了', '新 node 就加在這裡');
  await step(tok);                                   // 10:07 先 create 新 node
  cd.hl(0);
  k = node('k', -4.6 + 3 * 2.3, 2.6, 0, ORANGE);
  await dropIn(tok, k, 400);
  say('先 create 一個新的 node，存資料 k', 'newnode = new ListNode(k)');
  await step(tok);                                   // 10:37 一開始沒東西的情況
  cd.hl(1); glow(D(c.ns[2]), null);
  const e0 = tag('另一種情況：first == 0', 'ptr', 3.0, 3.6, 0);
  say('如果 list 一開始沒有東西', 'first == 0');
  await step(tok);                                   // 11:02 newnode 就是第一名
  txt(e0, '空 list：first = last = newnode');
  say('那就不叫 attach 了：丟進來就是第一個', 'first = last = newnode');
  await step(tok);                                   // 11:19 有 node：traverse
  kill(e0); cd.hl(2);
  r.visible = false;
  for (let i = 0; i < 3; i++) { ringAt(r, c.ns[i]); await beat(tok, 450); }
  say('first 不是 0：裡面有 node', 'traverse 整條 linked list 找最後一個');
  await step(tok);                                   // 11:39 接上
  cd.hl(3);
  await slide(tok, k, -4.6 + 3 * 2.3, 0.5, 0, 450);
  kill(c.ls[2]); c.ls[2] = lk(c.ns[2], k); lk(k, null);
  say('traverse 到底端，再把 newnode 接上', 'traverse 整條 list：O(n)');
}]);

// ───────── U_tNDdEooJU 12:04：Invert（p、q、r 三個指標） ─────────
FRAG.push(['llpeng12-invert', 'Invert：用 p、q、r 反轉 linked list', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const cd = code(['p = first; q = 0;', 'while (p) {', '  r = q;  q = p;', '  p = p->link;', '  q->link = r;', '}', 'first = q;'], -4.3, 6.2, 0.5);
  const V = ['a', 'b', 'c', 'd'];
  const ns = V.map((v, i) => node(v, -1.5 + i * 2.2, 0.5, 0, BLUE));
  const nxt = [1, 2, 3, -1];
  let ls = ns.map((g, i) => lk(g, ns[nxt[i]] || null));
  const fl = tag('first', 'ptr', -1.5, 2.3, 0);
  const redraw = () => { ls.forEach(kill); ls = ns.map((g, i) => (nxt[i] === -1 ? lk(g, null) : nxt[i] === -2 ? lk(g, null, { below: true, text: '0' }) : lk(g, ns[nxt[i]]))); };
  const pos = (i) => (i < 0 ? V3(-3.4, 0.5, 0) : ns[i].position);
  const pl = tag('p', 'ptr alt', 0, 0, 0), ql = tag('q', 'ptr', 0, 0, 0), rl = tag('r', 'ptr', 0, 0, 0);
  [pl, ql, rl].forEach((l) => showL(l, false));
  const put = (l, i, dz) => { const v = pos(i); l.position.set(v.x, -0.25, v.z + dz); showL(l, true); };
  let p = 0, q = -1, r = -1, q0 = null, flips = [];
  // one loop round: r = q; q = p; p = p->link; q->link = r
  async function round(ms) {
    cd.hl(2); r = q; q = p; put(rl, r, 2.2); put(ql, q, 1.6); await beat(tok, ms);
    cd.hl(3); p = nxt[p]; if (p >= 0) put(pl, p, 1.0); else { pl.position.set(ns[3].position.x + 1.6, -0.25, 1.0); txt(pl, 'p = 0'); } await beat(tok, ms);
    cd.hl(4); nxt[q] = r < 0 ? -2 : r; redraw(); glow(D(ns[q]), GOLD); await beat(tok, ms); glow(D(ns[q]), null);
  }
  await step(tok);                                   // 12:04 從左到右的 list
  say('一條 linked list：從左邊串到右邊', 'first → a → b → c → d');
  await step(tok);                                   // 12:10 頭變尾、尾變頭
  say('轉置：頭端變尾巴、尾巴變頭端', '');
  await step(tok);                                   // 12:30 每個 link 轉 180 度
  flips = [0, 1, 2].map((i) => tag('↺', 'idx', ns[i].position.x + 1.15, 1.0, 0));
  say('每個 link 都要轉向：轉 180 度', '');
  await step(tok);                                   // 12:38 這叫 Invert
  say('這個動作叫 Invert', '');
  await step(tok);                                   // 12:59 先畫圖
  flips.forEach(kill);
  const goal = tag('invert 後：d → c → b → a → 0', 'ptr alt', 2.0, 2.3, -1.2);
  say('先畫圖：invert 完，原來的頭變成尾巴', '');
  await step(tok);                                   // 13:15 三個 pointer
  say('要用三個 pointer：p、q、r', '');
  await step(tok);                                   // 13:37 p 指向第一個 node
  put(pl, 0, 1.0);
  say('p 先指向 linked list 的第一個 node', 'p 是先鋒');
  await step(tok);                                   // 13:51 q 跟著 p
  say('q 跟著 p 走', 'p 走過的 node，q 接著走');
  await step(tok);                                   // 14:02 r 跟著 q
  say('r 跟著 q 走', 'q 走過的 node，r 接著走');
  await step(tok);                                   // 14:18 p = first，q = 0
  cd.hl(0); q0 = tag('0', 'idx', -3.4, 0.5, 0); put(ql, -1, 1.6);
  say('一開始：p = first，q = 0', '');
  await step(tok);                                   // 14:28 q = 0 的原因
  say('q = 0：原本的頭會變成尾巴', '尾巴要指向 0');
  await step(tok);                                   // 14:53 while (p)
  cd.hl(1);
  say('while (p)：p 有值（list 不是空的）就進迴圈', '');
  await step(tok);                                   // 15:12 r = q
  cd.hl(2); r = q; put(rl, r, 2.2);
  say('r = q：q 是 0，所以 r 也是 0', '');
  await step(tok);                                   // 15:24 q = p
  q = p; put(ql, q, 1.6);
  say('q = p：q 追上 p，指到同一個 element', '');
  await step(tok);                                   // 15:53 p = p->link
  cd.hl(3); p = nxt[p]; put(pl, p, 1.0);
  say('p = p->link：p 往前移一格', 'p 在 b、q 在 a、r 是 0');
  await step(tok);                                   // 16:17 q->link = r
  cd.hl(4); nxt[q] = -2; redraw(); glow(D(ns[q]), GOLD);
  say('q->link = r：q 的 node 改指向 r（現在是 0）', 'a 變成尾巴');
  await step(tok);                                   // 16:43 迴圈還沒結束
  glow(D(ns[q]), null);
  await round(380);
  say('p 不是空的，繼續下一輪：三個各往前一格', 'b 改指向 a');
  await step(tok);                                   // 17:13 再一個 run
  await round(380);
  say('再一個 run：q 的 link 指向 r', 'c 改指向 b');
  await step(tok);                                   // 17:38 一個接一個直到 p == 0
  await round(380);
  say('p、q 一個接一個前進，直到 p == 0', 'd 改指向 c');
  await step(tok);                                   // 17:48 跳出迴圈
  cd.hl(5);
  say('p == 0：到底端，跳出迴圈', '');
  await step(tok);                                   // 18:11 q 指向最後一個 node
  glow(D(ns[3]), GOLD);
  say('這時 q 指向原本的最後一個 node', '它就是反轉後的頭');
  await step(tok);                                   // 18:30 first = q
  cd.hl(6); kill(goal);
  await slide(tok, fl, ns[3].position.x, 2.3, 0, 600);
  say('最後一行不要忘：first = q', 'd → c → b → a → 0');
  await step(tok);                                   // 19:43 考試挖空寫 code
  glow(D(ns[3]), null); cd.hl(-1);
  say('考試可能把 code 蓋起來叫你寫', '');
  await step(tok);                                   // 19:56 順序可以亂寫嗎
  cd.hl(2);
  say('這三個指令的順序可以亂寫嗎？', '回去想一想');
  void q0;
}]);

// ───────── U_tNDdEooJU 23:29：反轉的其他做法 ─────────
FRAG.push(['llpeng12-invert-alt', '反轉的笨方法：new 一條新 list', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.4]);
  const V = ['a', 'b', 'c', 'd'];
  const c = chainOf(V, -5.6, 2.3, 0.5, -1.8);
  tag('原本的 list', 'ptr', -5.6, 1.6, -1.8);
  const nn = []; let ls = [], nf = null;
  const r = ring();
  async function copyFront(i, ms) {
    ringAt(r, c.ns[i]); glow(D(c.ns[i]), GOLD);
    nn.forEach((g) => { g.position.x += 2.3; });
    const g = node(V[i], -5.6, 0.5, 2.0, ORANGE); nn.unshift(g);
    await dropIn(tok, g, ms);
    ls.forEach(kill); ls = nn.map((h, k) => lk(h, nn[k + 1] || null));
    txt(nf, '新 list：first → ' + V[i]);
    glow(D(c.ns[i]), null);
  }
  await step(tok);                                   // 23:29 唯一的做法嗎？
  say('反轉 linked list：p、q、r 是唯一的做法嗎？', '');
  await step(tok);                                   // 23:39 最笨的做法
  say('最笨的做法是什麼？', '');
  await step(tok);                                   // 24:25 new 一條新的 list
  nf = tag('新 list：first = 0', 'ptr alt', 0, 1.7, 2.0);
  say('最笨：new 一條新的 list', '');
  await step(tok);                                   // 24:32 讀 first，插進新 list
  await copyFront(0, 380);
  say('先讀第一個 a，insert 到新 list', '每次都插在新 list 的最前面');
  await step(tok);                                   // 24:40 再讀第二個
  await copyFront(1, 380);
  say('再讀第二個 b，一樣丟進新 list', 'b → a');
  await step(tok);                                   // 24:45 一個一個丟
  await copyFront(2, 300); await copyFront(3, 300);
  r.visible = false;
  say('一個一個讀完', '新 list：d → c → b → a，剛好反轉');
  await step(tok);                                   // 24:56 同學的 stack 做法也可以
  say('這樣可以；同學說的 stack 做法也可以', '全部 push 再 pop 出來');
  await step(tok);                                   // 25:09 代價：多用 memory
  nn.forEach((g) => glow(D(g), GOLD));
  say('代價：要多用一些 memory 產生新的 node', '');
  await step(tok);                                   // 26:05 示意圖：第一個 run…
  nn.forEach((g) => glow(D(g), null));
  say('示意圖：第一個 run（r = 0）、第二個 run……', 'p、q、r 做法不產生新的 node');
  await step(tok);                                   // 26:20 把圖畫出來
  say('看不懂程式？最好的方法就是把圖畫出來', '');
}]);

// ───────── U_tNDdEooJU 26:28：Concatenate ─────────
FRAG.push(['llpeng12-concat', 'Concatenate：A 的尾巴接到 b.first', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  const cd = code(['if (!first) { first = b.first; return; }', 'if (b.first) {', '  for (p = first; p->link; p = p->link);', '  p->link = b.first;', '}'], -1.6, 6.0, 0.5);
  const A = chainOf(['a₁', 'a₂', 'a₃'], -6.0, 2.1, 0.5, 0, BLUE);
  const B = chainOf(['b₁', 'b₂'], 1.8, 2.1, 0.5, 0, ORANGE);
  tag('first（A）', 'ptr', -6.0, 1.6, 0); tag('b.first', 'ptr alt', 1.8, 1.6, 0);
  let pre = null, pl = null;
  const r = ring();
  const at = (i) => { ringAt(r, A.ns[i]); pl.position.set(A.ns[i].position.x, -0.3, 1.0); };
  await step(tok);                                   // 26:28 串接兩條 list
  say('能不能把兩條 linked list 串接起來？', '');
  await step(tok);                                   // 26:37 A 和 B
  say('一條叫 A、一條叫 B', '串成一條更大的 linked list');
  await step(tok);                                   // 26:55 A 的尾巴改指 b.first
  pre = arrow(V3(-1.07, 1.05, 0.3), V3(1.5, 1.05, 0.3), GHOST);
  say('結果：A 尾巴原本指向 0，現在指向 b.first', '');
  await step(tok);                                   // 27:28 要知道 A 的尾巴在哪
  say('要做到這件事，得先知道 A 的尾巴在哪裡', '');
  await step(tok);                                   // 27:44 一個 for 迴圈，本體空的
  kill(pre); cd.hl(2);
  say('用一個 for 迴圈', '迴圈本體是空的，什麼都不做');
  await step(tok);                                   // 28:03 p 從 first 開始
  pl = tag('p', 'ptr alt', -6.0, -0.3, 1.0); at(0);
  say('p 從 first 開始', 'p = first');
  await step(tok);                                   // 28:11 判斷 p->link 是不是 0
  glow(D(A.ns[0]), GOLD);
  say('判斷 p->link 是不是 0', '');
  await step(tok);                                   // 28:18 不是 0 → p 移過去
  glow(D(A.ns[0]), null); at(1);
  say('不是 0 → p = p->link', 'p 移到下一個 node');
  await step(tok);                                   // 28:37 再判斷、再走
  at(2);
  say('再判斷：還不是 0，繼續走', '');
  await step(tok);                                   // 29:09 p->link 是 0 → 跳出
  glow(D(A.ns[2]), GOLD);
  say('終於 p->link 是 0：p 是最後一個元素', '跳出 for 迴圈');
  await step(tok);                                   // 29:33 p->link = b.first
  cd.hl(3);
  kill(A.ls[2]); A.ls[2] = lk(A.ns[2], B.ns[0]);
  say('p->link = b.first：把這條線連上', '結束');
  await step(tok);                                   // 29:41 前面的 if：防呆
  glow(D(A.ns[2]), null); r.visible = false; kill(pl);
  cd.hl(0);
  say('前面這個 if 在做什麼？', '防呆機制');
  await step(tok);                                   // 30:05 A 是空的
  A.ns.forEach((g) => tint(D(g), DIM));
  say('A 是空的：first == 0', '直接 first = b.first，不用跑 for 迴圈');
  await step(tok);                                   // 30:39 示意圖：連起來
  A.ns.forEach((g) => tint(D(g), BLUE)); cd.hl(-1);
  say('示意圖：把兩條連起來', 'a₁ → a₂ → a₃ → b₁ → b₂');
}]);

// ───────── U_tNDdEooJU 31:03：List destructor ─────────
FRAG.push(['llpeng12-destructor', 'List destructor：一個一個 delete', async (tok) => {
  fresh([0, 6, 12], [0, 1.4, 0]);
  const cd = code(['List::~List() {', '  ListNode *next;', '  for (; first; first = next) {', '    next = first->link;', '    delete first;', '  }', '}'], -3.6, 5.4, 0.5);
  const c = chainOf([10, 50, 20], -0.4, 2.3);
  const fl = tag('first', 'ptr', -0.4, 1.6, 0);
  const nl = tag('next', 'ptr alt', -0.4, -0.3, 1.0); showL(nl, false);
  const V = [10, 50, 20];
  async function one(i, ms) {
    cd.hl(3); showL(nl, true);
    if (i < 2) nl.position.set(c.ns[i + 1].position.x, -0.3, 1.0); else { nl.position.set(c.ns[i].position.x + 1.5, -0.3, 1.0); txt(nl, 'next = 0'); }
    await beat(tok, ms);
    cd.hl(4); kill(c.ls[i]); fly(c.ns[i]); await beat(tok, ms);
    cd.hl(2); if (i < 2) fl.position.set(c.ns[i + 1].position.x, 1.6, 0); else txt(fl, 'first = 0');
  }
  await step(tok);                                   // 31:03 list 不要了：destructor
  say('這條 linked list 不要了：destroy 掉', 'destructor');
  await step(tok);                                   // 31:11 清空：全部 free
  say('把 list 清空：裡面所有 node 都 free 掉', 'delete，把 memory address 還回去');
  await step(tok);                                   // 31:27 for 檢查 first
  cd.hl(2); glow(D(c.ns[0]), GOLD);
  say('for 迴圈：檢查 first 是不是空的', '');
  await step(tok);                                   // 31:44 next = first->link
  glow(D(c.ns[0]), null);
  cd.hl(3); showL(nl, true); nl.position.set(c.ns[1].position.x, -0.3, 1.0);
  say('first 不是空的：先 next = first->link', 'next 指向下一個繼位者');
  await step(tok);                                   // 32:00 delete first，first = next
  cd.hl(4); kill(c.ls[0]); fly(c.ns[0]); await beat(tok, 500);
  cd.hl(2); fl.position.set(c.ns[1].position.x, 1.6, 0);
  say('delete first：把自己刪掉', '再 first = next，往下走一格');
  await step(tok);                                   // 32:12 每次拿一個出來刪
  await one(1, 380); await one(2, 380);
  say('每一次從 linked list 拿一個 node 出來刪掉', '');
  await step(tok);                                   // 32:22 List destructor
  cd.hl(-1);
  say('first == 0：list 清空了', '這就叫 List destructor');
  void V;
}]);

// ───────── U_tNDdEooJU 32:32：Circular linked list ─────────
FRAG.push(['llpeng12-circular', 'Circular linked list：沒有 NULL，要靠 last', async (tok) => {
  fresh([0, 6, 12], [0, 0.8, 0.3]);
  const c = chainOf(['a', 'b', 'c', 'd'], -4.0, 2.4);
  const r = ring();
  await step(tok);                                   // 32:32 環狀的 linked list
  kill(c.ls[3]); c.ls[3] = lk(c.ns[3], c.ns[0]);
  say('Linked list 也有環狀的', '最後一個 node 指回頭端');
  await step(tok);                                   // 32:42 告訴你誰是頭
  tag('first', 'ptr', -4.0, 1.6, 0);
  say('一樣要告訴你誰是頭', 'first');
  await step(tok);                                   // 32:55 最後一個 node：last
  tag('last', 'ptr alt', c.ns[3].position.x, 1.6, 0); glow(D(c.ns[3]), GOLD);
  say('最後一個 node 也有一個指標代表它', '叫 last');
  await step(tok);                                   // 33:04 沒有 last 就是圓圈圈
  glow(D(c.ns[3]), null);
  for (let k = 0; k < 6; k++) { ringAt(r, c.ns[k % 4]); await beat(tok, 300); }
  say('為什麼需要 last？不然它就是一個圓圈圈', '一直繞');
  await step(tok);                                   // 33:11 以前判斷是不是 NULL
  r.visible = false;
  say('以前找尾巴：判斷 link 是不是 NULL', '');
  await step(tok);                                   // 33:19 永遠不是 NULL
  glow(D(c.ns[3]), RED);
  say('環狀時尾巴指的是 first，永遠不是 NULL', '沒辦法用 NULL 判斷尾巴');
  await step(tok);                                   // 33:26 last 在 first 之前
  glow(D(c.ns[3]), GOLD);
  say('last：first 之前、指到 first 的 node', 'last->link == first');
}]);

// ───────── U_tNDdEooJU 33:50：用 linked list 實作 stack 與 queue ─────────
FRAG.push(['llpeng12-linked-sq', '用 linked list 實作 Stack 與 Queue', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.2]);
  await step(tok);                                   // 33:50 只能用 array 嗎？
  say('Stack 和 Queue 只能用 array 來 implement 嗎？', '');
  await step(tok);                                   // 34:04 用 linked list implement stack
  tag('Linked Stack', 'ptr', -6.0, 1.3, -2.0);
  const S = chainOf([3, 2, 1], -2.0, 2.2, 0.5, -2.0, BLUE);
  say('這裡用 linked list 來 implement stack', '');
  await step(tok);                                   // 34:12 top 就是 first
  tag('top', 'ptr alt', -2.0, 1.5, -2.0); glow(D(S.ns[0]), GOLD);
  say('stack 的 top 就等同於 first', '指向第一個 element');
  await step(tok);                                   // 34:27 queue 也一樣
  glow(D(S.ns[0]), null);
  tag('Linked Queue', 'ptr', -6.0, 1.3, 2.2);
  const Q = chainOf([1, 2, 3], -2.0, 2.2, 0.5, 2.2, TEAL);
  say('queue 也一樣，就是一條 linked list', '');
  await step(tok);                                   // 34:34 頭端、尾巴
  tag('front（頭端）', 'ptr', -2.0, 1.5, 2.2); tag('rear（尾巴）', 'ptr alt', 2.4, 1.5, 2.2);
  say('一端是頭端、一端是尾巴', 'front、rear');
  await step(tok);                                   // 34:57 data structure
  say('Stack、Queue 是 data structure', '可以用 array，也可以用 linked list implement');
  void Q;
}]);

// ───────── U_tNDdEooJU 35:09：用 linked list 表示多項式 ─────────
FRAG.push(['llpeng12-poly-nodes', '多項式的 linked list：coef | exp | link', async (tok) => {
  fresh([0, 7, 12.5], [0, 0.6, 0.3]);
  const T = [[3, 14], [2, 8], [1, 0]];
  const ns = [];
  await step(tok);                                   // 35:09 第二章：多項式
  say('第二章講過多項式', '用 array 表示，課本至少講了三種方法');
  await step(tok);                                   // 35:33 linked list 很單純
  tag('a = 3x¹⁴ + 2x⁸ + 1', 'ptr', -1.0, 2.0, -1.8);
  say('用 linked list 表示，可以很單純', '');
  await step(tok);                                   // 35:40 三個 node
  for (let i = 0; i < 3; i++) { ns.push(pnode(T[i][0], T[i][1], -4.0 + i * 3.2, 0.5, -1.8)); await dropIn(tok, ns[i], 300); }
  say('a = 3x¹⁴ + 2x⁸ + 1：三個 node', '一項一個 node');
  await step(tok);                                   // 35:51 係數、指數、link
  tag('coef', 'idx', -4.42, -0.15, -0.8); tag('exp', 'idx', -3.58, -0.15, -0.8); tag('link', 'idx', -2.95, -0.15, -0.8);
  glow(ns[0].userData.data, GOLD); glow(ns[0].userData.exp, GOLD);
  say('三個欄位：係數、指數、link', '3 是係數，14 是指數');
  await step(tok);                                   // 36:03 link 指向下一項，1 是尾巴
  glow(ns[0].userData.data, null); glow(ns[0].userData.exp, null);
  for (let i = 0; i < 3; i++) plk(ns[i], ns[i + 1] || null);
  say('link 指向下一項；1 = 1·x⁰ 是尾巴', 'link = 0');
  await step(tok);                                   // 36:29 2x¹⁰⁰⁰ + 1
  tag('2x¹⁰⁰⁰ + 1', 'ptr alt', -1.0, 2.0, 2.2);
  const s1 = pnode(2, 1000, -2.6, 0.5, 2.2, ORANGE), s2 = pnode(1, 0, 1.0, 0.5, 2.2, ORANGE);
  plk(s1, s2); plk(s2, null);
  say('上次的 2x¹⁰⁰⁰ + 1：只要兩個 node', '');
  await step(tok);                                   // 36:46 不用開很大的 array
  say('不用開 1001 格的 array', 'linked list 可以解決 sparse 的問題');
  await step(tok);                                   // 36:54 缺點在哪
  say('那用 linked list 表示多項式，缺點在哪？', '自己想想看');
}]);

// ───────── U_tNDdEooJU 37:33：Term、Polynomial 與 operator+ ─────────
FRAG.push(['llpeng12-poly-class', 'Polynomial class 與 operator+ overloading', async (tok) => {
  fresh([0, 6, 12.5], [0, 2.0, 0]);
  const cd = code(['struct Term {', '  int coef;  int exp;', '};', 'class Polynomial {', '  friend Polynomial operator+(', '    const Polynomial&, const Polynomial&);', 'private:', '  List<Term> poly;', '};'], -3.0, 6.0, 0.5);
  let t = null, e = null;
  await step(tok);                                   // 37:33 有一個 Term
  cd.hl(0);
  say('要 implement：先有一個 Term', '');
  await step(tok);                                   // 37:47 element 是 Term：係數、指數
  cd.hl(1);
  t = pnode(3, 14, 2.6, 0.5, 0);
  await dropIn(tok, t);
  say('list node 的 element 是一個 Term', '包含係數 coef 和指數 exp');
  await step(tok);                                   // 38:01 Polynomial 也宣告成 class
  cd.hl(3);
  say('Polynomial 也宣告成一個 class', '');
  await step(tok);                                   // 38:09 private 叫 poly
  cd.hl(7);
  const b = ghostBox('#2fc092', 7.0, 1.5, 1.6); b.position.set(4.9, 0.5, 0);
  const t2 = pnode(2, 8, 5.6, 0.5, 0); plk(t, t2); plk(t2, null);
  tag('List<Term> poly', 'ptr', 4.4, 1.6, 0);
  say('private 叫 poly：一條 linked list', 'data type 就是 Term');
  await step(tok);                                   // 38:22 friend operator+ 在幹嘛
  cd.hl(4);
  say('friend Polynomial operator+ 是在做什麼？', '');
  await step(tok);                                   // 39:04 operator overloading
  say('C++ 的 operator overloading', '把 + 改成我要的「多項式的加」');
  await step(tok);                                   // 39:22 a + b
  e = tag('Polynomial a, b;  c = a + b;', 'ptr alt', 3.0, 3.6, 1.5);
  say('宣告兩個多項式 a、b，就可以寫 a + b', '這個 + 已經被 redefine');
  await step(tok);                                   // 39:40 跳到自己定義的加法
  arrow(V3(3.0, 3.3, 1.5), V3(-0.5, 3.8, 0.2), 0xb07a10);
  cd.hl(-1);
  say('看到 Polynomial 的 +，就跳到自己定義的加法 procedure', '');
  void e;
}]);

// ───────── U_tNDdEooJU 40:08：多項式加法 ─────────
FRAG.push(['llpeng12-poly-add', '多項式加法：p、q 一路比指數', async (tok) => {
  fresh([0, 8, 12.5], [0, 0.4, 0.4]);
  const A = [[3, 14], [2, 8], [1, 0]], B = [[8, 14], [-3, 10], [10, 6]];
  tag('a', 'ptr', -6.6, 0.5, -3.0); tag('b', 'ptr', -6.6, 0.5, -0.6); tag('c', 'ptr alt', -6.6, 0.5, 2.6);
  const an = A.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.4, 0.5, -3.0));
  const bn = B.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.4, 0.5, -0.6, ORANGE));
  an.forEach((g, i) => plk(g, an[i + 1] || null)); bn.forEach((g, i) => plk(g, bn[i + 1] || null));
  const pl = tag('p', 'ptr alt', 0, 0, 0), ql = tag('q', 'ptr alt', 0, 0, 0);
  showL(pl, false); showL(ql, false);
  const put = (l, arr, i, z) => { showL(l, true); if (i < arr.length) l.position.set(arr[i].position.x - 0.4, 1.3, z); else { l.position.set(5.6, 1.3, z); txt(l, l === pl ? 'p = 0' : 'q = 0'); } };
  const cn = [];
  let i = 0, j = 0;
  const emit = async (c, e) => {
    const g = pnode(c, e, -4.6 + cn.length * 2.45, 0.5, 2.6, PURP);
    await dropIn(tok, g, 380);
    if (cn.length) plk(cn[cn.length - 1], g);
    cn.push(g);
  };
  const hiExp = (on) => { if (i < 3) glow(an[i].userData.exp, on ? GOLD : null); if (j < 3) glow(bn[j].userData.exp, on ? GOLD : null); };
  await step(tok);                                   // 40:08 跟 array 很像
  say('多項式的加法：跟 array 版很像', 'a = 3x¹⁴ + 2x⁸ + 1，b = 8x¹⁴ − 3x¹⁰ + 10x⁶');
  await step(tok);                                   // 40:24 指數一樣：係數相加
  say('指數一樣：係數相加', '');
  await step(tok);                                   // 40:32 指數不一樣：copy
  say('指數不一樣：copy', '');
  await step(tok);                                   // 40:51 用 linked list 更簡單
  say('用 linked list 做多項式加法，比 array 還簡單', '');
  await step(tok);                                   // 41:01 p、q
  put(pl, an, 0, -3.0); put(ql, bn, 0, -0.6);
  say('兩個 pointer p、q', '一開始分別指向兩個多項式的第一個 element');
  await step(tok);                                   // 41:15 比較指數 14、14
  hiExp(true);
  say('比較 p、q 的指數：14 和 14 → 相同', '');
  await step(tok);                                   // 41:23 3 + 8 = 11，new node 放進 c
  hiExp(false);
  await emit(11, 14);
  say('係數相加 3 + 8 = 11', 'new 一個 node 放進 c：11x¹⁴');
  await step(tok);                                   // 41:40 p、q 往下走
  i++; j++; put(pl, an, i, -3.0); put(ql, bn, j, -0.6);
  say('這一項看完了：p、q 都往下走', '');
  await step(tok);                                   // 41:59 一個 8、一個 10
  hiExp(true);
  say('比較指數：p 是 8、q 是 10', '不一樣，不能相加');
  await step(tok);                                   // 42:14 10 比較大 → copy q
  hiExp(false);
  await emit(-3, 10); j++; put(ql, bn, j, -0.6);
  say('指數從大排到小：10 比較大 → 先 copy q 那項', '−3x¹⁰ 放進 c，q 往下走');
  await step(tok);                                   // 42:46 8 比 6 大 → copy p
  await emit(2, 8); i++; put(pl, an, i, -3.0);
  say('接著 8 和 6：8 比較大 → copy p 的 2x⁸', 'p 往下走');
  await step(tok);                                   // 43:12 準則
  await emit(10, 6); j++; put(ql, bn, j, -0.6);
  await emit(1, 0); i++; put(pl, an, i, -3.0);
  say('準則：指數相同就相加；不同就先 copy 指數大的', '被 copy 的那個往下走');
  await step(tok);                                   // 43:33 p、q 都到 0
  plk(cn[cn.length - 1], null);
  say('直到 p、q 都到 0 就結束', 'c = 11x¹⁴ − 3x¹⁰ + 2x⁸ + 10x⁶ + 1');
}]);

// ───────── U_tNDdEooJU 44:04：加完後 a、b 的 node 怎麼辦 ─────────
FRAG.push(['llpeng12-poly-release', '加完後：a、b 的 6 個 node', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  const A = ['3,14', '2,8', '1,0'], B = ['8,14', '-3,10', '10,6'];
  const an = A.map((v, i) => cube(v, TEAL, [1.2, 0.7, 1.0], -4.0 + i * 1.6, 0.35, -1.6));
  const bn = B.map((v, i) => cube(v, ORANGE, [1.2, 0.7, 1.0], 1.2 + i * 1.6, 0.35, -1.6));
  tag('a', 'ptr', -5.4, 0.4, -1.6); tag('b', 'ptr', 0.0, 0.4, -1.6);
  const cl = tag('c', 'ptr alt', -5.4, 0.4, 1.6);
  const cn = [];
  await step(tok);                                   // 44:04 過程中要隨時產生 c 的 node
  for (let k = 0; k < 5; k++) { const m = cube(['11,14', '-3,10', '2,8', '10,6', '1,0'][k], PURP, [1.2, 0.7, 1.0], -4.0 + k * 1.6, 0.35, 1.6); cn.push(m); await dropIn(tok, m, 220); }
  say('a + b = c 的過程中', '要隨時 new 出 c 的 node');
  await step(tok);                                   // 44:43 a、b 都不用了
  [...an, ...bn].forEach((m) => tint(m, DIM));
  say('加完以後，a、b 都不用了', '');
  await step(tok);                                   // 44:48 空間可以 release
  say('a、b 的空間可以 release 出來', '');
  await step(tok);                                   // 44:54 list 的 destructor
  say('一種做法：用 list 的 destructor', '');
  await step(tok);                                   // 45:09 6 個 node 真的 delete
  for (const m of [...an, ...bn]) { fly(m, V3(-4, 6, -3)); await beat(tok, 200); }
  say('把 a、b 佔用的 6 個 node 真的 delete 掉', '空間還給系統');
  await step(tok);                                   // 45:15 另一種：service
  say('另一種想法：這程式是專門做多項式加減的服務', 'service');
  await step(tok);                                   // 45:42 不用急著清掉
  say('那也許不用急著把這些 node 清掉', '');
  void cl;
}]);

// ───────── U_tNDdEooJU 49:00：Free pool（資源回收場） ─────────
FRAG.push(['llpeng12-poly-pool', 'Free pool：用完的 node 回收再利用', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.0, 0]);
  const VALS = ['3,14', '2,8', '1,0', '8,14', '-3,10', '10,6'];
  let ns = [], pool = null;
  await step(tok);                                   // 49:00 多項式加減乘除的服務
  tag('多項式服務', 'ptr', -5.0, 2.6, -1.6);
  say('寫一個多項式加減乘除的服務', '');
  await step(tok);                                   // 49:07 很多人進來
  const u1 = tag('user 1：a + b', 'ptr alt', -5.0, 1.9, -1.6);
  ns = VALS.map((v, i) => cube(v, i < 3 ? TEAL : ORANGE, [1.2, 0.7, 1.0], -2.5 + i * 1.5, 0.35, 1.2));
  say('有人進來 create a、b，做加法', '');
  await step(tok);                                   // 49:20 有人 create d、e
  tag('user 2：d、e 加減乘除', 'ptr alt', -5.0, 1.3, -1.6);
  say('有人 create d、e，做加減乘除', '');
  await step(tok);                                   // 49:35 不急著丟回系統
  ns.forEach((m) => tint(m, DIM));
  say('多項式不用了：不要急著把 node 丟回系統', '');
  await step(tok);                                   // 49:45 放進 free pool
  pool = ghostBox('#2fc092', 6.0, 1.6, 2.0); pool.position.set(3.0, 0.7, -1.8);
  tag('free pool（資源回收場）', 'ptr alt', 3.0, 2.1, -1.8);
  say('把 node 放在一個 pool 裡：free pool', '資源再利用');
  await step(tok);                                   // 49:59 6 個 node 丟進回收場
  await Promise.all(ns.map((m, i) => slide(tok, m, 0.8 + i * 0.9, 0.35, -1.8, 600)));
  ns.forEach((m) => tint(m, '#8fcfb8'));
  say('a + b 用完了：6 個 node 丟到資源回收場', '');
  await step(tok);                                   // 50:15 新 user 叫出 node
  const take = ns.slice(0, 3);
  await Promise.all(take.map((m, i) => slide(tok, m, -1.5 + i * 1.5, 0.35, 2.2, 600)));
  say('新的 user 要多項式：從回收場把 node 叫出來', '');
  await step(tok);                                   // 50:25 改掉指數和係數
  take.forEach((m, i) => { tint(m, PURP); relabel(m, ['5,9', '4,3', '7,0'][i]); });
  say('只要改掉係數和指數就可以用', '');
  await step(tok);                                   // 50:33 node 不會馬上被 delete
  say('這就是 free pool：node 不會馬上被 delete', '要用時先去回收場看看');
  await step(tok);                                   // 50:56 不浪費資源
  say('好處：不會浪費資源，就跟資源回收場一樣', '');
  await step(tok);                                   // 51:06 不用花 overhead create
  say('不用花很多 overhead 再去 create 新的 node', 'create 新 node 要跟電腦要 resource');
  void u1;
}]);

// ───────── U_tNDdEooJU 51:22／53:35：GetNode／RetNode（params.op = 'ret' 播 RetNode） ─────────
FRAG.push(['llpeng12-av-getret', 'GetNode／RetNode：從 av 拿、還回 av', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 6.5, 12.5], [0, 1.6, 0]);
  let av = null, avl = null;
  const showAv = () => { av = chainOf(['', '', ''], -1.2, 2.3, 0.5, 0, '#8fcfb8'); avl = tag('av', 'ptr alt', -1.2, 1.6, 0); tag('free pool（available list）', 'idx', 1.1, -0.3, 1.2); };
  if (P.op !== 'ret') {
    const cd = code(['ListNode* GetNode() {', '  ListNode *x;', '  if (!av) x = new ListNode;', '  else { x = av; av = av->link; }', '  return x;', '}'], -3.6, 6.2, 0.5);
    let xl = null, x = null;
    await step(tok);                                 // 51:22 要取得一個 node 怎麼辦
    say('依照 free pool 的概念：要取得一個 node 怎麼辦？', '例如要宣告一個新的多項式');
    await step(tok);                                 // 51:39 先去回收場看看
    say('先去資源回收場看看：有沒有 node 給我用', '');
    await step(tok);                                 // 52:00 指標 av
    showAv();
    say('指標 av（available list）', '指向 free pool 的第一個 element');
    await step(tok);                                 // 52:14 free pool 也是 linked list
    say('free pool 也是一條 linked list', '');
    await step(tok);                                 // 52:22 av 是空的
    cd.hl(2);
    say('如果 av 是空的：回收場沒有資源', '只好跟系統要（new）');
    await step(tok);                                 // 52:32 有的話：x = av
    cd.hl(3);
    xl = tag('x', 'ptr', -1.2, 2.2, 0); glow(D(av.ns[0]), GOLD);
    say('有的話：x = av', '拿到 free pool 的第一個 node');
    await step(tok);                                 // 52:57 av 往下移一格
    kill(av.ls[0]);
    await slide(tok, avl, 1.1, 1.6, 0, 450);
    say('這個 node 已經被拿走：av 往下移一格', 'av = av->link');
    await step(tok);                                 // 53:03 return x
    cd.hl(4); glow(D(av.ns[0]), null);
    x = av.ns.shift(); av.ls.shift();
    await slide(tok, x, -4.5, 0.5, 2.2, 500); xl.position.set(-4.5, 1.4, 2.2);
    say('return x：得到一個空間', '');
    await step(tok);                                 // 53:13 設定係數和指數
    setData(x, '3,14'); tint(D(x), TEAL);
    say('拿到空間後，再設定它的係數和指數', '不用跟系統要記憶體');
    return;
  }
  const cd2 = code(['void RetNode(ListNode *x) {', '  x->link = av;', '  av = x;', '}'], -3.6, 6.0, 0.5);
  let x = null, xl2 = null, a = null;
  await step(tok);                                   // 53:35 不要了：丟回回收場
  x = node('x', -4.5, 2.4, 0, ORANGE); await dropIn(tok, x);
  xl2 = tag('x', 'ptr', -4.5, 3.3, 0);
  say('這個多項式不要了：node 丟回資源回收場', '');
  await step(tok);                                   // 53:42 叫 RetNode
  cd2.hl(0);
  say('這個動作叫 RetNode（return node）', '');
  await step(tok);                                   // 53:47 下面是回收場的 list
  showAv();
  say('下面就是資源回收場的 linked list', '指標 av 指向它');
  await step(tok);                                   // 53:55 return，不是 delete
  say('注意：是 return，不是 delete', '');
  await step(tok);                                   // 54:13 insert 進 av 這條 list
  say('就是把 x 這個 node insert 進 av 這條 linked list', '');
  await step(tok);                                   // 54:21 x->link = av
  cd2.hl(1);
  a = lk(x, av.ns[0]);
  say('把 x 的 link 串接到 av 所指的地方', 'x->link = av');
  await step(tok);                                   // 54:40 av = x
  cd2.hl(2);
  await slide(tok, avl, -4.5, 3.9, 0, 400);
  say('再修改 available 變數：av 指向 x', 'av = x');
  await step(tok);                                   // 54:54 看圖說故事
  kill(a); kill(xl2);
  await slide(tok, x, av.ns[0].position.x - 2.3, 0.5, 0, 500);
  av.ns.unshift(x); relinkAll(av); avl.position.set(x.position.x, 1.6, 0);
  cd2.hl(-1);
  say('看圖說故事：x 還回來了，成了 free pool 的頭', 'O(1)');
}]);

// ───────── U_tNDdEooJU 55:17／59:12：一次歸還整個多項式（params.mode = 'chain' 播非環狀版） ─────────
FRAG.push(['llpeng12-cerase', '一次把整個多項式還給 av', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 7.5, 12.5], [0, 0.8, 0.4]);
  const T = [[3, 14], [2, 8], [1, 0]];
  const an = T.map(([c, e], i) => pnode(c, e, -4.6 + i * 3.0, 0.5, -1.8));
  const avn = [0, 1].map((i) => node('', -2.6 + i * 2.4, 0.5, 2.2, '#8fcfb8'));
  lk(avn[0], avn[1]); lk(avn[1], null);
  const avl = tag('av', 'ptr alt', -2.6, 1.6, 2.2);
  const fl = tag(P.mode === 'chain' ? 'a.first' : 'first', 'ptr', -4.6, 1.6, -1.8);
  if (P.mode !== 'chain') {
    const ls = [plk(an[0], an[1]), plk(an[1], an[2]), plk(an[2], null)];
    let cd = null, sl = null;
    await step(tok);                                 // 55:17 一次歸還整個 polynomial？
    say('不要一次只還一個 node', '能不能一次歸還一整個 polynomial？');
    await step(tok);                                 // 55:24 a + b 之後把 a 全部丟掉
    an.forEach((g) => glow(g.userData.data, GOLD));
    say('例如 a + b = c 之後', '把 a 整個丟到資源回收場');
    await step(tok);                                 // 55:39 寫一個 destructor
    an.forEach((g) => glow(g.userData.data, null));
    cd = code(['if (first) {', '  second = first->link;', '  first->link = av;', '  av = second;', '  first = 0;', '}'], 3.6, 6.0, 0.5);
    say('有可能：寫一個 circular list 的 destructor', '');
    await step(tok);                                 // 55:46 多項式表示成環狀
    kill(ls[2]); ls[2] = plk(an[2], an[0]);
    say('多項式表示成環狀', '尾巴指回頭端');
    await step(tok);                                 // 56:06 好處：不用一個一個還
    say('環狀的好處：簡單的指定就好', '不用一個一個 node 去 return');
    await step(tok);                                 // 56:14 3x¹⁴ → 2x⁸ → 1 → 頭
    say('a：3x¹⁴ → 2x⁸ → 1，尾巴指回頭端', '');
    await step(tok);                                 // 56:32 link 等於 a.first 就到尾
    glow(an[2].userData.data, GOLD);
    say('只要檢查 link 是不是等於 a.first', '就知道到尾巴了');
    await step(tok);                                 // 56:52 ① second = first->link
    glow(an[2].userData.data, null); cd.hl(1);
    sl = tag('second', 'ptr alt', an[1].position.x, 1.6, -1.8);
    say('① second = first->link', 'second 指向 first 的下一個（2x⁸）');
    await step(tok);                                 // 57:28 ② first->link = av
    cd.hl(2);
    kill(ls[0]); ls[0] = arrow(V3(an[0].position.x + 1.05, 0.5, -1.2), V3(-3.1, 0.5, 1.6), 0xb07a10);
    say('② first->link = av', '3x¹⁴ 改指向原本的 av list');
    await step(tok);                                 // 57:49 ③ av = second
    cd.hl(3);
    await slide(tok, avl, an[1].position.x, 2.2, -1.8, 500);
    an.forEach((g) => tint(g.userData.data, '#8fcfb8'));
    say('③ av = second', 'available list 從 2x⁸ 開始：2x⁸ → 1 → 3x¹⁴ → 原本的 av');
    await step(tok);                                 // 57:59 ④ first = 0
    cd.hl(4); txt(fl, 'first = 0');
    say('④ first = 0', 'a 清空了');
    await step(tok);                                 // 58:19 其他 link 不用改
    kill(sl); cd.hl(-1);
    say('其他 node 之間的 link 都不用改', '充分利用環狀的關係');
    await step(tok);                                 // 58:47 很快就做完
    say('因為是環狀，四個 assignment 就整條還回去', 'O(1)');
    return;
  }
  const ls = [plk(an[0], an[1]), plk(an[1], an[2]), plk(an[2], null)];
  const cd = code(['走到 a 的最後一個 node p;', 'p->link = av;', 'av = a.first;'], 3.4, 6.0, 0.5);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  r.rotation.x = Math.PI / 2; r.visible = false; lab.world.add(r);
  await step(tok);                                   // 59:12 不是環狀怎麼辦
  say('如果不是環狀的 linked list 呢？', '尾巴原本指向 0');
  await step(tok);                                   // 60:10 最快的做法
  glow(an[2].userData.data, GOLD);
  say('最快的做法：尾巴這裡本來是 0', '把它連到 av 就結束');
  await step(tok);                                   // 60:29 一路到最後一個
  glow(an[2].userData.data, null); cd.hl(0);
  for (let i = 0; i < 3; i++) { r.visible = true; r.position.set(an[i].position.x, 0.12, -1.8); await beat(tok, 500); }
  say('A 指到 B、B 指到 C……一路走到最後一個 node', '');
  await step(tok);                                   // 60:44 尾巴改指 av
  cd.hl(1);
  kill(ls[2]); ls[2] = arrow(V3(an[2].position.x + 1.05, 0.5, -1.2), V3(-3.1, 0.5, 1.6), 0xb07a10);
  say('把本來指向 0 的尾巴改指向 av', 'p->link = av');
  await step(tok);                                   // 60:51 av = a.first
  cd.hl(2);
  await slide(tok, avl, -4.6, 2.2, -1.8, 500);
  an.forEach((g) => tint(g.userData.data, '#8fcfb8'));
  say('av = a.first', '只做兩件事，原本的 list 沒被破壞');
  await step(tok);                                   // 61:01 最笨：一個一個還
  r.visible = false; cd.hl(-1);
  say('最笨的做法：一個 node 一個 node 歸還', '比較繁瑣，但也能解決');
}]);

// ───────── U_tNDdEooJU 62:36：Header node ─────────
FRAG.push(['llpeng12-header-node', '環狀多項式加上 header node（exp = −1）', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 0.8, 0.3]);
  const T = [[3, 14], [2, 8], [1, 0]];
  const ns = T.map(([c, e], i) => pnode(c, e, -1.7 + i * 3.1, 0.5, 0, TEAL));
  plk(ns[0], ns[1]); plk(ns[1], ns[2]);
  let h = null;
  await step(tok);                                   // 62:36 多項式是環狀的話
  plk(ns[2], ns[0]);
  say('多項式如果是環狀的', '3x¹⁴ + 2x⁸ + 1');
  await step(tok);                                   // 62:47 多一個 header node
  h = pnode('-', -1, -4.8, 0.5, 0, GRAY);
  await dropIn(tok, h, 450);
  tag('header', 'ptr alt', -4.8, 1.6, 0);
  say('可以多用一個 node 來表示：header node', '');
  await step(tok);                                   // 62:53 指數放 −1
  glow(h.userData.exp, GOLD);
  say('header 的指數部分放 −1', '看到 −1 就知道是 header');
  await step(tok);                                   // 63:08 最後一項指回 header
  glow(h.userData.exp, null);
  fresh([0, 6.5, 12.5], [0, 0.8, 0.3]);
  const all = [[-1, '-'], [14, 3], [8, 2], [0, 1]].map(([e, c], i) => pnode(c, e, -4.8 + i * 3.1, 0.5, 0, i ? TEAL : GRAY));
  tag('header', 'ptr alt', -4.8, 1.6, 0);
  for (let i = 0; i < 3; i++) plk(all[i], all[i + 1]);
  plk(all[3], all[0]);
  say('3x¹⁴ + 2x⁸ + 1：header 在最前面', '最後一項指回 header node');
  await step(tok);                                   // 63:33 回去看程式
  say('用 linked list 實作多項式加減法', '程式請回去看課本');
}]);

// ───────── U_tNDdEooJU 64:22 起：Equivalence relation ─────────
const EQP = [[0, 4], [3, 1], [6, 10], [8, 9], [7, 4], [6, 8], [3, 5], [2, 11], [11, 0]];
const EQC = [[0, 2, 4, 7, 11], [1, 3, 5], [6, 8, 9, 10]];
function seg(a, b, color = '#b07a10') { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
FRAG.push(['llpeng12-equiv-def', 'Equivalence relation：9 個 pair 分成 3 群', async (tok) => {
  fresh([0, 9.5, 9], [0, 0, 0.3]);
  const pos = (i) => { const a = Math.PI / 2 - (i / 12) * Math.PI * 2; return V3(Math.cos(a) * 4.2, 0.4, -Math.sin(a) * 4.2); };
  const cs = [];
  for (let i = 0; i < 12; i++) { const p = pos(i); cs.push(cube(i, '#e3d6bd', [0.8, 0.7, 0.8], p.x, p.y, p.z)); }
  const segs = [];
  const hl = (vs, c) => vs.forEach((v) => glow(cs[v], c));
  await step(tok);                                   // 64:22 Equivalence relationship
  say('下一個重點：Equivalence relationship', '離散數學學過');
  await step(tok);                                   // 64:46 三個特性
  say('它要符合三個特性', '');
  await step(tok);                                   // 65:06 reflexive
  hl([0], GOLD);
  say('Reflexive：自己跟自己有關係', 'x ≡ x');
  await step(tok);                                   // 65:13 symmetric
  hl([0], null);
  say('Symmetric：x 跟 y 有關係，y 也跟 x 有關係', 'x ≡ y ⇒ y ≡ x');
  await step(tok);                                   // 65:21 transitive
  say('Transitive：x ≡ y、y ≡ z，則 x ≡ z', '');
  await step(tok);                                   // 65:39 例子：0 ≡ 4
  hl([0, 4], GOLD); segs.push(seg(pos(0), pos(4)));
  say('例子：0 ≡ 4', '');
  await step(tok);                                   // 65:49 0 怎麼會等於 4？
  say('0 怎麼會等於 4？', '「≡」是一種 relation，不是數值相等');
  await step(tok);                                   // 66:14 3≡1、6≡10、8≡9、7≡4…
  hl([0, 4], null);
  for (const [a, b] of EQP.slice(1)) { segs.push(seg(pos(a), pos(b))); await beat(tok, 150); }
  say('3 ≡ 1、6 ≡ 10、8 ≡ 9、7 ≡ 4……', '把它想成某一種 relation');
  await step(tok);                                   // 66:29 9 個 pair
  say('一共 9 個 pair', '');
  await step(tok);                                   // 66:40 分成三群
  segs.forEach(kill);
  const cols = [BLUE, ORANGE, TEAL], cx = [-4.2, 0.2, 4.2];
  for (let k = 0; k < 3; k++) EQC[k].forEach((v) => tint(cs[v], cols[k]));
  await Promise.all(EQC.flatMap((g, k) => g.map((v, i) => slide(tok, cs[v], cx[k] + (i % 2 ? 0.55 : -0.55), 0.4, -1.4 + Math.floor(i / 2) * 1.0, 800))));
  say('這些數字可以分成三群', '同一群裡的數字都有關係');
  await step(tok);                                   // 67:03 1 和 5 為什麼有關係
  hl([1, 3, 5], GOLD);
  say('1 和 5 為什麼有關係？', '1 ≡ 3、3 ≡ 5 ⇒ 1 ≡ 5（transitive）');
  await step(tok);                                   // 67:33 6 和 9
  hl([1, 3, 5], null); hl([6, 8, 9], GOLD);
  say('6 和 9：6 ≡ 8、8 ≡ 9', '⇒ 6 ≡ 9');
  await step(tok);                                   // 68:10 output：三個 set
  hl([6, 8, 9], null);
  say('input 是這些 pair，output 是三個 set', '{0,2,4,7,11}　{1,3,5}　{6,8,9,10}');
}]);

FRAG.push(['llpeng12-equiv-naive', '直覺做法：邊讀邊分群，還得合併', async (tok) => {
  fresh([0, 9, 10], [0, 0, 0.5]);
  const groups = [], cubes = {};
  const slotX = (g) => -5.4 + g * 2.7;
  const layout = () => groups.forEach((gr, gi) => gr.forEach((v, k) => cubes[v].position.set(slotX(gi) + (k % 2 ? 0.5 : -0.5), 0.4, -2.2 + Math.floor(k / 2) * 0.95)));
  const cnt = tag('', 'ptr alt', 0, 0.2, 3.2);
  function read(a, b) {
    const ga = groups.findIndex((g) => g.includes(a)), gb = groups.findIndex((g) => g.includes(b));
    for (const v of [a, b]) if (!cubes[v]) cubes[v] = cube(v, '#e3d6bd', [0.8, 0.7, 0.8], 0, 4, 3);
    Object.values(cubes).forEach((m) => glow(m, null));
    glow(cubes[a], GOLD); glow(cubes[b], GOLD);
    if (ga < 0 && gb < 0) groups.push([a, b]);
    else if (ga >= 0 && gb < 0) groups[ga].push(b);
    else if (ga < 0 && gb >= 0) groups[gb].push(a);
    else if (ga !== gb) { const lo = Math.min(ga, gb), hi = Math.max(ga, gb); groups[lo].push(...groups[hi]); groups.splice(hi, 1); }
    layout(); txt(cnt, '讀到 ' + a + ' ≡ ' + b + '：目前 ' + groups.length + ' 群');
  }
  await step(tok);                                   // 68:39 寫程式你會怎麼做
  say('寫一個程式產生這樣的 output', '你會怎麼做？');
  await step(tok);                                   // 68:50 0 和 4 放一起
  read(0, 4);
  say('讀到 0 ≡ 4：0 和 4 放在一起', '');
  await step(tok);                                   // 69:13 3 和 1 自己一群
  read(3, 1);
  say('3 ≡ 1：跟 0、4 沒關係', '3 和 1 自己一群');
  await step(tok);                                   // 69:22 6 和 10
  read(6, 10);
  say('6 ≡ 10：6、10 沒出現在前面的群', '獨立一群');
  await step(tok);                                   // 69:36 8 和 9
  read(8, 9);
  say('8 ≡ 9：跟前面也沒關係', '現在有四群');
  await step(tok);                                   // 69:46 7 和 4
  read(7, 4);
  say('7 ≡ 4：4 已經在 0 那一群', '把 7 加進去');
  await step(tok);                                   // 69:54 後來會合併
  read(6, 8);
  say('讀到 6 ≡ 8：兩群要合併！', '{6,10} 和 {8,9} 合成一群');
  await step(tok);                                   // 70:12 人腦做得出來
  read(3, 5); await beat(tok, 300); read(2, 11); await beat(tok, 300); read(11, 0);
  say('用人腦想其實做得出來', '數字在已有的群裡就加進去，沒有就新開一群');
  await step(tok);                                   // 70:45 一下新增、一下合併
  Object.values(cubes).forEach((m) => glow(m, null));
  say('一下子新增、一下子又要合併', '很複雜，不是好的寫法');
}]);

FRAG.push(['llpeng12-equiv-phases', '演算法分兩個 phase', async (tok) => {
  fresh([0, 6, 11], [0, 1.0, 0]);
  const b1 = cube('Phase 1：讀完所有 pair', BLUE, [4.6, 1.0, 1.4], -3.0, 0.6, 0);
  const b2 = cube('Phase 2：輸出 class', TEAL, [4.6, 1.0, 1.4], 3.0, 0.6, 0);
  arrow(V3(-0.6, 0.6, 0), V3(0.6, 0.6, 0));
  [b1, b2].forEach((m) => tint(m, DIM));
  await step(tok);                                   // 71:05 分兩個步驟
  say('這個演算法分兩個步驟', '');
  await step(tok);                                   // 71:17 Phase 1
  tint(b1, BLUE); glow(b1, GOLD);
  say('Phase 1：把還沒處理的 pair 讀進來處理', '');
  await step(tok);                                   // 71:35 太 pseudo code
  say('只寫「process the pair」太 pseudo code', '看了不知道怎麼做');
  await step(tok);                                   // 71:43 Phase 2：根據第一階段輸出
  glow(b1, null); tint(b2, TEAL); glow(b2, GOLD);
  tag('output array', 'ptr alt', 3.0, 1.6, 0);
  say('Phase 2：根據第一階段的結果做輸出', '會有一個 output 的 array');
  await step(tok);                                   // 72:19 Phase 1 讀過所有 pair
  glow(b2, null); glow(b1, GOLD);
  say('Phase 1：先讀過所有 pair', '了解數字之間的關係');
  await step(tok);                                   // 72:33 剛才邊讀邊輸出是錯的
  const no = tag('✕ 讀一個就輸出：後面可能合併', 'ptr alt', -3.0, 1.9, 0);
  say('剛才「讀完就輸出」是不對的', '後面可能要合併');
  await step(tok);                                   // 72:47 Phase 2 輸出
  kill(no); glow(b1, null); glow(b2, GOLD);
  say('讀完全部以後，Phase 2 才根據這些 pair 輸出', '');
}]);

// seq[] 的 linked lists：橫向 0..11，每條 list 往 +z 方向長
const SX = (i) => -6.5 + i * 1.0;
function seqBase(withOut) {
  const tiles = [];
  for (let i = 0; i < 12; i++) tiles.push(cube(i, '#e3d6bd', [0.85, 0.5, 0.85], SX(i), 0.25, -2.6));
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
// Phase 1：U_tNDdEooJU 73:23（seq 的 list）；params.code 播 84:23 的程式版
FRAG.push(['llpeng12-equiv-phase1', 'Phase 1：讀 pair，建 seq[] 的 linked lists', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 10, 7.5], [0, 0, 0.6]);
  const S = seqBase(!!P.code);
  const pair = async (a, b, ms) => { glow(S.tiles[a], GOLD); glow(S.tiles[b], GOLD); await seqAdd(tok, S, a, b, ms); await seqAdd(tok, S, b, a, ms); glow(S.tiles[a], null); glow(S.tiles[b], null); };
  if (P.code) {
    const cd = code(['class ListNode { int data; ListNode *link; };', 'seq[i] = 0;  out[i] = false;   // 初始化', 'while (讀進 pair (i, j)) {', '  x = new ListNode(j);', '  x->link = seq[i];  seq[i] = x;', '  y = new ListNode(i);', '  y->link = seq[j];  seq[j] = y;', '}'], 1.2, 4.8, 0.5, -3.4);
    let xm = null;
    await step(tok);                                 // 84:23 要有 linked list
    say('看程式之前：需要 linked list', 'seq 的每一格都是一條 linked list');
    await step(tok);                                 // 84:35 node：data 和 link
    cd.hl(0);
    say('node 很簡單：data 和 link', '');
    await step(tok);                                 // 84:50 初始化不是重點
    cd.hl(1);
    say('前面在做初始化', '這段不是重點');
    await step(tok);                                 // 85:02 seq、out 兩個 array 初始化
    S.tiles.forEach((m) => glow(m, GOLD)); S.outs.forEach((m) => glow(m, GOLD));
    say('對 seq array 和 out array 做初始化', 'seq[i] = 0、out[i] = false');
    await step(tok);                                 // 85:09 Phase 1：讀進 i、j
    S.tiles.forEach((m) => glow(m, null)); S.outs.forEach((m) => glow(m, null));
    cd.hl(2);
    say('Phase 1：讀進 i 和 j', '例：0 ≡ 4');
    await step(tok);                                 // 85:32 create node x，data = j
    cd.hl(3); glow(S.tiles[0], GOLD);
    xm = cube(4, colorFor(4), [0.6, 0.5, 0.6], SX(0) + 1.4, 1.6, -1.4);
    say('在 seq[i] 這裡 create 一個 node x', '把 j（4）放進 data');
    await step(tok);                                 // 85:54 x->link = seq[i]；seq[i] = x
    cd.hl(4); kill(xm);
    await seqAdd(tok, S, 0, 4, 400);
    say('x->link = seq[i]；seq[i] = x', 'x 插到 seq[i] 這條 list 的最前面');
    await step(tok);                                 // 86:18 j 那邊也一樣
    cd.hl(6); glow(S.tiles[0], null);
    glow(S.tiles[4], GOLD); await seqAdd(tok, S, 4, 0, 400); glow(S.tiles[4], null);
    say('j 那邊也一樣：i 放進 seq[j]', 'y->link = seq[j]；seq[j] = y');
    await step(tok);                                 // 86:29 Phase 1 就是建 list
    cd.hl(2);
    for (const [a, b] of EQP.slice(1)) await pair(a, b, 70);
    cd.hl(-1);
    say('Phase 1 做的事：把對應的 linked list 建立出來', '');
    return;
  }
  await step(tok);                                   // 73:23 n 個數字、seq 是 array
  say('有 n 個數字；seq 是一個 array', '這裡 n = 12：0 … 11');
  await step(tok);                                   // 73:47 每一格是一條 linked list
  say('seq 的每一格都是一條 linked list', '');
  await step(tok);                                   // 73:56 seq[0]：跟 0 有關係的數字
  glow(S.tiles[0], GOLD);
  say('seq[0] 記錄：讀完所有 pair 後', '0 這個數字跟哪些數字有關係');
  await step(tok);                                   // 74:12 直接看答案：4 和 11
  say('先看答案：0 跟 4 和 11 有關係', '為什麼？');
  await step(tok);                                   // 74:32 讀到 0 ≡ 4：4 放進 0 的 list
  await seqAdd(tok, S, 0, 4, 450);
  say('讀到 0 ≡ 4：把 4 放進 0 的 linked list', '一開始還沒有 11');
  await step(tok);                                   // 74:52 4 ≡ 0：seq[4] 加 0
  glow(S.tiles[0], null); glow(S.tiles[4], GOLD);
  await seqAdd(tok, S, 4, 0, 450);
  say('0 ≡ 4 也代表 4 ≡ 0', 'seq[4] 也要加一個 0');
  await step(tok);                                   // 75:24 3 ≡ 1
  glow(S.tiles[4], null);
  await pair(3, 1, 300);
  say('3 ≡ 1：seq[3] 插入 1，seq[1] 插入 3', '');
  await step(tok);                                   // 75:44 6 ≡ 10
  await pair(6, 10, 300);
  say('6 ≡ 10：seq[6] 插入 10，seq[10] 插入 6', '');
  await step(tok);                                   // 75:53 所有 pair 做完
  for (const [a, b] of EQP.slice(3)) await pair(a, b, 70);
  say('所有 pair 做完，最後的答案就是這樣', '新的 node 都插在 list 最前面');
  await step(tok);                                   // 76:09 seq[0]：11、4
  glow(S.tiles[0], GOLD); S.lists[0].forEach((m) => glow(m, GOLD));
  say('seq[0]：11 → 4', '0 和 4、0 和 11 有關係');
  await step(tok);                                   // 76:32 read pair：兩邊都擺
  glow(S.tiles[0], null); S.lists[0].forEach((m) => glow(m, null));
  say('Read pair (i, j)：i 的 list 擺上 j', 'j 的 list 擺上 i');
}]);

// Phase 2：U_tNDdEooJU 77:08（out 與直接／間接）；params.mode = 'stack' 播 86:46 的 stack 版
FRAG.push(['llpeng12-equiv-phase2', 'Phase 2：out[] 與 stack 找出整個 class', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 10.5, 7.5], [0, 0, 0.6]);
  const S = seqBase(true);
  seqBuildAll(S);
  const outL = tag('output：', 'ptr alt', 0, 0.2, 3.6);
  const printed = [];
  const mark = (v) => { relabel(S.outs[v], 'T'); tint(S.outs[v], '#9fd8c4'); printed.push(v); txt(outL, 'output：' + printed.join(' ')); };
  const item = (i, k) => S.lists[i][k];
  const clear = () => { S.tiles.forEach((m) => glow(m, null)); S.lists.flat().forEach((m) => glow(m, null)); S.outs.forEach((m) => glow(m, null)); };
  if (P.mode === 'stack') {
    tag('stack', 'ptr', 6.3, 3.8, 0.5);
    const stk = [];
    const push = async (v) => { const m = cube(v, PURP, [0.8, 0.5, 0.8], 6.3, 0.3 + stk.length * 0.55, 0.5); stk.push(m); m.position.y += 3; await slide(tok, m, 6.3, 0.3 + (stk.length - 1) * 0.55, 0.5, 300); };
    const pop = () => fly(stk.pop());
    await step(tok);                                 // 86:46 Phase 2 有一個 stack
    say('Phase 2 比較麻煩：裡面有一個 stack', '');
    await step(tok);                                 // 87:05 自己寫 push、pop
    say('自己寫 push、pop', '');
    await step(tok);                                 // 87:18 Phase 1 已經建好
    say('假設 Phase 1 已經把 linked list 建出來', '');
    await step(tok);                                 // 87:33 for：0 印出來
    glow(S.tiles[0], GOLD); mark(0);
    say('for 迴圈：0 印出來', 'out[0] = true');
    await step(tok);                                 // 87:42 scan 0 的 list：先遇到 11
    glow(item(0, 0), GOLD);
    say('開始 scan 0 的 list：先遇到 11', '');
    await step(tok);                                 // 87:51 11 印出來
    mark(11);
    say('11 被 output 出來', 'out[11] 設成 true');
    await step(tok);                                 // 88:27 先不要看 11 的 list
    glow(S.tiles[11], RED);
    say('這時候馬上去看 11 的 list 嗎？', '先不要');
    await step(tok);                                 // 88:43 11 push 進 stack
    glow(S.tiles[11], null);
    await push(11);
    say('先把 11 push 到 stack 裡', '等一下再來檢查 11');
    await step(tok);                                 // 89:07 4 印出並 push
    glow(item(0, 0), null); glow(item(0, 1), GOLD);
    mark(4); await push(4);
    say('接著看到 4：印出來，也 push 進 stack', 'output：0 11 4');
    await step(tok);                                 // 89:42 stack：11、4
    glow(item(0, 1), null);
    say('stack 長這樣：11、4', '7 和 0 這時還沒興趣看');
    await step(tok);                                 // 90:16 pop 出 4
    clear(); pop();
    glow(S.tiles[4], GOLD);
    say('從 stack 把 4 抓出來（pop）', '去 scan 4 的 list');
    await step(tok);                                 // 90:34 看到 7：還沒印過
    glow(item(4, 0), GOLD); glow(S.outs[7], GOLD);
    say('看到 7：out[7] 還是 false', '還沒印過');
    await step(tok);                                 // 90:54 印出 7、push
    glow(S.outs[7], null); mark(7); await push(7);
    say('印出 7，也 push 進 stack', 'stack：11、7');
    await step(tok);                                 // 91:31 0 要 push 嗎？不用
    glow(item(4, 0), null); glow(item(4, 1), RED);
    say('4 的 list 還有 0：要 push 嗎？', '不用，0 已經印過了');
    await step(tok);                                 // 92:11 pop 出 7
    clear(); pop();
    glow(S.tiles[7], GOLD); glow(item(7, 0), RED);
    say('pop 出 7：7 的 list 只有 4', '4 已經印過：不印、也不 push');
    await step(tok);                                 // 92:48 回到 11
    clear(); pop();
    glow(S.tiles[11], GOLD); glow(item(11, 0), RED);
    await beat(tok, 500);
    glow(item(11, 1), GOLD); mark(2); await push(2);
    await beat(tok, 400);
    pop(); glow(S.tiles[2], GOLD); glow(item(2, 0), RED);
    say('pop 出 11：0 檢查過了，接著看 2 → 印出', '2 的 list 只有 11，也印過了');
    await step(tok);                                 // 93:26 push／pop 的目的
    clear();
    say('push／pop 的目的：找出 indirect 的數字', 'output：0 11 4 7 2');
    await step(tok);                                 // 94:12 寫得更簡單？
    say('能不能寫得比這段 code 更簡單？', '回去想一想');
    return;
  }
  await step(tok);                                   // 76:58 第二個 phase
  say('第二個 phase 在做什麼？', '');
  await step(tok);                                   // 77:06 for i = 0 … n−1
  say('for i = 0 … n−1：如果 out[i] 是 false', '就從 i 開始輸出');
  await step(tok);                                   // 77:14 這裡在做 output
  say('這裡在做 output', '');
  await step(tok);                                   // 77:24 out 是 boolean array
  S.outs.forEach((m) => glow(m, GOLD));
  say('out 是 boolean array：這個數字 output 過沒', '一開始全部 false');
  await step(tok);                                   // 77:54 i = 0 開始
  S.outs.forEach((m) => glow(m, null)); glow(S.tiles[0], GOLD);
  say('seq 有 0 到 11：for 從 i = 0 開始', '');
  await step(tok);                                   // 78:02 0 被 output
  mark(0);
  say('0 被 output 出來', 'out[0] = true');
  await step(tok);                                   // 78:12 0 跟 11 有關 → output 11
  glow(item(0, 0), GOLD); mark(11);
  say('0 跟 11 有關係 → output 11', '');
  await step(tok);                                   // 78:18 out[11] = true
  say('out[11] 設成 true', '之後就不會再印 11');
  await step(tok);                                   // 78:39 output 4
  glow(item(0, 0), null); glow(item(0, 1), GOLD); mark(4);
  say('接著 output 4', 'output：0 11 4');
  await step(tok);                                   // 78:54 11 跟 0 有關
  clear(); glow(S.tiles[11], GOLD); glow(item(11, 0), RED);
  say('11 跟誰有關？跟 0 有關', '0 要再 output 嗎？');
  await step(tok);                                   // 79:11 不會：已經 true
  glow(S.outs[0], RED);
  say('不會：out[0] 已經是 true', '印過了');
  await step(tok);                                   // 79:26 output 2
  glow(S.outs[0], null); glow(item(11, 0), null); glow(item(11, 1), GOLD); mark(2);
  say('再看 2：out[2] 是 false → output 2', '');
  await step(tok);                                   // 81:13 4 跟 7、0 有關
  clear(); glow(S.tiles[4], GOLD); glow(item(4, 0), GOLD); mark(7);
  say('4 跟 7、0 有關係 → 7 也 output', '0、11、4、7、2 是同一群');
  await step(tok);                                   // 82:02 直接有關
  clear(); glow(S.tiles[0], GOLD); S.lists[0].forEach((m) => glow(m, GOLD));
  say('seq[0] 上的 11、4：直接有關', 'direct equivalence');
  await step(tok);                                   // 82:24 間接有關
  clear(); glow(S.tiles[11], GOLD); glow(item(11, 1), GOLD);
  say('0 和 2：0 ≡ 11、11 ≡ 2 → 間接有關', 'indirect：要再去查別人的 list');
  await step(tok);                                   // 84:03 out 防止印兩次
  clear(); S.outs.forEach((m) => glow(m, GOLD));
  say('out array：防止同一個數字印兩次', '');
}]);
  }

  // ═══ llpeng34.js ═══
  {
// ─── zLuuRC56uvI（彭文志 Lists 3/4）、yn0ZAifhyNM（Lists 4/4）：Equivalence class、Sparse matrix、Doubly linked list ───
// cued scenes: every `await step(tok)` waits for the sentence it shows (see the notes' cues)
const step = ctx.step;
const GHOST = 0xb3aa9a;
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

// ═════════════ Equivalence class（Horowitz 範例：n = 12，9 個 pair） ═════════════
const EQP = [[0, 4], [3, 1], [6, 10], [8, 9], [7, 4], [6, 8], [3, 5], [2, 11], [11, 0]];
const EQN = 12;
const EQX = (i) => (i - 5.5) * 0.95;
const EQ_SLOT_Z = -2.6, EQ_OUT_Z = 1.7, EQ_STK_X = 6.4;
const eqZ = (k) => EQ_SLOT_Z + 1.3 * (k + 1);
const pairStr = (p) => p.map(([a, b]) => a + '≡' + b).join('  ');
function eqSeq(pairs) { const s = Array.from({ length: EQN }, () => []); for (const [i, j] of pairs) { s[i].unshift(j); s[j].unshift(i); } return s; }
// 課本 phase 2：印出 i，沿 seq[i] 走；沒印過的印出並 push；list 走完就 pop 一個，改走它的 list
function eqRun(seq) {
  const out = new Array(EQN).fill(false), classes = [];
  for (let i = 0; i < EQN; i++) {
    if (out[i]) continue;
    const cls = [i]; out[i] = true;
    let list = i, k = 0; const st = [];
    for (;;) {
      while (k < seq[list].length) { const j = seq[list][k]; if (!out[j]) { out[j] = true; cls.push(j); st.push(j); } k++; }
      if (!st.length) break;
      list = st.pop(); k = 0;
    }
    classes.push(cls);
  }
  return { classes };
}
function eqStage(o = {}) {
  const S = { slots: [], lists: Array.from({ length: EQN }, () => []), arr: Array.from({ length: EQN }, () => []), outs: [], stack: [], lines: [] };
  for (let i = 0; i < EQN; i++) {
    const il = tag('[' + i + ']', 'idx', EQX(i), 0, EQ_SLOT_Z - (o.idxDz || 0.75));
    if (il && il.element) il.element.style.padding = '0 1px'; // 12 index labels 0.95 apart: without the chip padding they don't touch
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
const eqIns = (S, i, v) => eqInsert(S, i, cube(v, colorFor(v), [0.7, 0.5, 0.7], EQX(i), 0.25, eqZ(0), 3));
function eqBuild(S, pairs) {
  const seq = eqSeq(pairs);
  seq.forEach((L, i) => { L.forEach((v, k) => S.lists[i].push(eqNode(v, EQX(i), 0.25, eqZ(k)))); eqArrows(S, i); });
  return seq;
}
function eqClear(S) { for (let i = 0; i < EQN; i++) { S.lists[i].forEach((m) => fly(m)); S.lists[i] = []; eqArrows(S, i); } }
function eqSetOut(S, i, on = true) { const m = S.outs[i]; if (!m) return; relabel(m, on ? 'T' : 'F'); tint(m, on ? '#2fc092' : GRAY); }

// zLuuRC56uvI 00:00：三性質
FRAG.push(['llpeng34-equiv-props', 'Equivalence relation 三性質', async (tok) => {
  fresh([0, 6, 11], [0, 1, 0]);
  const X = { 0: -3.5, 4: 0, 7: 3.5 }, c = {};
  for (const v of [0, 4, 7]) c[v] = cube(v, colorFor(v), [1.2, 0.8, 1.2], X[v], 0.4, 0, 3);
  let self = null;
  await step(tok);                                   // 0:00 一堆數字 pair，三個特質
  say('複習：給你一堆數字的 pair', '若是 equivalence relation，要符合三個特質');
  await step(tok);                                   // 0:39 reflexive
  say('Reflexive：x ≡ x', '自己跟自己有關係');
  await step(tok);                                   // 0:48 symmetric
  say('Symmetric：x ≡ y ⇒ y ≡ x', '');
  await step(tok);                                   // 0:59 transitive
  say('Transitive：x ≡ y 且 y ≡ z ⇒ x ≡ z', '');
  await step(tok);                                   // 1:17 0 ≡ 0 不用寫
  glow(c[0], GOLD); self = tag('0 ≡ 0', 'ptr alt', -3.5, 1.6);
  say('0 ≡ 0 這種自己跟自己的 pair', '太直覺了，輸入裡不用寫出來');
  await step(tok);                                   // 1:27 0 和 4 有關係
  glow(c[0]); kill(self);
  arrow(V3(-2.8, 0.6, -0.3), V3(-0.7, 0.6, -0.3), 0x0f5a3a);
  tag('0 ≡ 4', 'idx', -1.75, 1.2, -0.3);
  say('0 和 4 有關係：0 ≡ 4', '');
  await step(tok);                                   // 1:47 imply 4 ≡ 0
  arrow(V3(-0.7, 0.3, 0.4), V3(-2.8, 0.3, 0.4), 0x0f5a3a);
  say('其實還 imply 一個 pair：4 ≡ 0', 'symmetric');
  await step(tok);                                   // 1:55 7 和 4 有關係
  arrow(V3(2.8, 0.6, -0.3), V3(0.7, 0.6, -0.3), 0x0f5a3a);
  tag('7 ≡ 4', 'idx', 1.75, 1.2, -0.3);
  say('再看 7 ≡ 4', '');
  await step(tok);                                   // 2:06 4 ≡ 7
  arrow(V3(0.7, 0.3, 0.4), V3(2.8, 0.3, 0.4), 0x0f5a3a);
  say('7 ≡ 4 也 imply 4 ≡ 7', '');
  await step(tok);                                   // 2:16 transitive：0 ≡ 7
  glow(c[0], GOLD); glow(c[7], GOLD);
  line(-3.5, 1.0, -3.5, 2.3, 0, '#6a4a00'); line(-3.5, 2.3, 3.5, 2.3, 0, '#6a4a00');
  arrow(V3(3.5, 2.3, 0), V3(3.5, 0.9, 0), 0x6a4a00);
  tag('0 ≡ 7', 'ptr alt', 0, 2.75);
  say('0 ≡ 4、4 ≡ 7 ⇒ 0 ≡ 7', 'transitivity');
}]);

// zLuuRC56uvI 02:33：問題
FRAG.push(['llpeng34-equiv-problem', 'Equivalence class 問題', async (tok) => {
  fresh([0, 8, 11], [0, 0.5, 0.4]);
  const cs = [];
  for (let i = 0; i < EQN; i++) cs.push(cube(i, colorFor(i), [0.75, 0.6, 0.75], EQX(i), 0.3, -1.6, 2));
  const G = [[0, 2, 4, 7, 11], [1, 3, 5], [6, 8, 9, 10]], GX = [-4.3, 0, 4.0];
  await step(tok);                                   // 2:33 input：數字 pair
  tag('輸入：' + pairStr(EQP), 'ptr', 0, 0.2, -3.6);
  say('Input：這些數字的 pair', 'n = 12：0 … 11，共 9 個 pair');
  await step(tok);                                   // 2:38 output：集合
  say('Output：set of number', '一些數字的集合');
  await step(tok);                                   // 2:49 同一集合裡都有關係
  say('同一個集合裡的數字都有關係', '自己跟自己、自己跟別人，還有 transitive');
  await step(tok);                                   // 3:07 三個 set
  G.forEach((g, gi) => {
    g.forEach((v, k) => move(cs[v], GX[gi] + (k - (g.length - 1) / 2) * 0.85, 0.3, 1.4));
    tag('{' + g.join(', ') + '}', 'ptr alt', GX[gi], 0.2, 2.6);
  });
  say('這個 input 出來的是三個 set', '{0,2,4,7,11}　{1,3,5}　{6,8,9,10}');
  await step(tok);                                   // 3:16 看 1、3、5：3 ≡ 1
  glow(cs[3], GOLD); glow(cs[1], GOLD);
  say('看 1、3、5：第二個 pair 是 3 ≡ 1', '');
  await step(tok);                                   // 3:29 3 ≡ 5 ⇒ 1 ≡ 5
  glow(cs[5], GOLD);
  say('後來讀到 3 ≡ 5', '就 imply 1 ≡ 5');
  await step(tok);                                   // 3:47 equivalence class
  say('1、3、5 是一個 equivalence class', '透過 reflexive、symmetric、transitive 都找得到關係');
  await step(tok);                                   // 4:09 symmetric
  [1, 3, 5].forEach((i) => glow(cs[i]));
  say('注意 symmetric：x ≡ y ⇒ y ≡ x', '');
  await step(tok);                                   // 4:19 考試可能改 asymmetric
  say('考試可能改成不對稱（not symmetric）', 'x ≡ y 不一定有 y ≡ x（離散的 asymmetric 更強）');
}]);

// zLuuRC56uvI 05:03：兩個 phase、兩個 array
FRAG.push(['llpeng34-seq-out', '兩個 phase、兩個 array', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const S = eqStage({ out: true });
  await step(tok);                                   // 5:03 很 rough 的演算法
  say('很 rough 的演算法：分兩個 phase', '');
  await step(tok);                                   // 5:08 phase 1
  say('Phase 1：根據 pair，算出兩兩之間的關係', '');
  await step(tok);                                   // 5:17 phase 2
  say('Phase 2：根據 Phase 1 的 structure', '把所有 equivalence class 找出來');
  await step(tok);                                   // 6:02 更進階但還不是程式
  say('更進階一點的版本', '更詳細，但還不是程式');
  await step(tok);                                   // 6:33 兩個 data structure
  say('它提出兩個 data structure', 'array，和掛在 array 上的 linked list');
  await step(tok);                                   // 7:11 第一個 array：seq
  S.slots.forEach((m) => glow(m, GOLD));
  say('第一個 array：seq（sequence）', '');
  await step(tok);                                   // 7:31 index 代表數字，大小 n
  S.slots.forEach((m) => glow(m));
  say('index 就代表那個數字', 'n 個數字 → array 大小就是 n');
  await step(tok);                                   // 7:51 seq[i] 是 pointer → linked list
  glow(S.slots[1], GOLD);
  eqIns(S, 1, 3);
  say('seq[i] 存一個 pointer：指向跟 i 有關的 linked list', '例：seq[1] 指向跟 1 有關的數字');
  await step(tok);                                   // 8:11 第二個 array：out
  glow(S.slots[1]); S.outs.forEach((m) => glow(m, GOLD));
  say('第二個 array：out', '');
  await step(tok);                                   // 8:29 out 記錄印過沒
  S.outs.forEach((m) => glow(m)); eqSetOut(S, 0);
  say('Phase 2 要把 set 印出來：out 記錄這個數字印過沒', '印過（true）就不會再輸出');
}]);

// zLuuRC56uvI 08:51：Phase 1 的 while
FRAG.push(['llpeng34-phase1-build', 'Phase 1：建出 seq 的 list', async (tok) => {
  fresh([0, 8.5, 9.5], [0, 0, -0.6]);
  const S = eqStage();
  const pl = tag('', 'ptr', 0, 0.2, 2.2);
  await step(tok);                                   // 8:51 while 專門處理 seq
  say('Phase 1：while 迴圈專門處理 seq 這個 array', '');
  await step(tok);                                   // 9:01 j 放進 seq[i]
  txt(pl, '讀到 0 ≡ 4'); glow(S.slots[0], GOLD);
  eqIns(S, 0, 4);
  say('讀到 pair (i, j)：j 放進 seq[i] 的 list', '0 ≡ 4：4 放進 seq[0]');
  await step(tok);                                   // 9:13 i 放進 seq[j]
  glow(S.slots[0]); glow(S.slots[4], GOLD);
  eqIns(S, 4, 0);
  say('同樣也把 i 放進 seq[j]', '0 放進 seq[4]');
  await step(tok);                                   // 9:24 兩邊都要記
  glow(S.slots[4]);
  say('i ≡ j 代表兩個互相有關係', '兩邊的 list 都要記');
  await step(tok);                                   // 9:58 while 做完
  for (const [i, j] of EQP.slice(1)) { txt(pl, '讀到 ' + i + ' ≡ ' + j); eqIns(S, i, j); eqIns(S, j, i); await beat(tok, 140); }
  txt(pl, '9 個 pair 讀完');
  say('while 做完：每個數字都有一條 linked list', '新 node 都插在 list 最前面');
  await step(tok);                                   // 10:14 長出這樣的 structure
  S.lists[0].forEach((m) => glow(m, GOLD));
  say('Phase 1 做完，就長出這樣的 structure', 'seq[0] → 11 → 4；seq[11] → 0 → 2');
}]);

// zLuuRC56uvI 10:26：Phase 2 的想法
FRAG.push(['llpeng34-phase2-idea', 'Phase 2 的想法：直接相關＋transitive', async (tok) => {
  fresh([0, 8.5, 10], [0, 0, 0]);
  const S = eqStage({ out: true });
  eqBuild(S, EQP);
  const ring = ringAt(0.48);
  const outL = tag('輸出：', 'ptr alt', 0, 0.2, 3.0);
  const pr = [];
  const print = (v) => { pr.push(v); txt(outL, '輸出：' + pr.join(' ')); };
  const at = (i, k) => { ring.visible = true; ring.position.set(EQX(i), 0.03, eqZ(k)); };
  await step(tok);                                   // 10:26 phase 2：for 迴圈
  say('Phase 2：就是下面那個 for 迴圈', '');
  await step(tok);                                   // 10:39 i = 0 … n−1
  say('for (i = 0; i < n; i++)', '');
  await step(tok);                                   // 10:52 i = 0：out[0] 是 false？
  glow(S.slots[0], GOLD);
  say('i = 0：out[0] 是不是 false？', '');
  await step(tok);                                   // 11:12 out 一開始全 false
  S.outs.forEach((m) => glow(m, GOLD));
  say('out 是 boolean array', '一開始 out[0] … out[11] 都是 false（都沒印過）');
  await step(tok);                                   // 11:33 印出 0
  S.outs.forEach((m) => glow(m)); print(0);
  say('out[0] 是 false：還沒印過 → 把 0 印出來', '');
  await step(tok);                                   // 11:56 out[0] = true
  eqSetOut(S, 0);
  say('印過了：out[0] 設成 true', '');
  await step(tok);                                   // 12:04 output equivalence class
  say('接著 output 這個 equivalence class', '包含兩件事');
  await step(tok);                                   // 12:12 第一件：seq[0] 的 list
  S.lists[0].forEach((m) => glow(m, GOLD));
  say('第一件：seq[0] 的 list 都跟 0 有關', '直接相關');
  await step(tok);                                   // 12:34 0、11、4 依序印出
  at(0, 0); print(11); eqSetOut(S, 11); await beat(tok, 500);
  at(0, 1); print(4); eqSetOut(S, 4);
  say('0、11、4 依序被 output', '');
  await step(tok);                                   // 12:52 每個數字只屬於一個 class
  S.lists[0].forEach((m) => glow(m)); ring.visible = false;
  say('11、4 的 out 也設成 true', '每個數字只屬於一個 class，不會重複出現');
  await step(tok);                                   // 13:26 第二件：transitive
  glow(S.slots[0]); glow(S.slots[11], GOLD);
  say('第二件：透過 transitive', '0 ≡ 11，跟 11 有關的也跟 0 有關');
  await step(tok);                                   // 13:59 看 11：先看到 0
  at(11, 0); glow(S.outs[0], RED);
  say('看 11 的 list：先看到 0', 'out[0] 已經是 true → 不再印');
  await step(tok);                                   // 14:17 再看到 2
  glow(S.outs[0]); at(11, 1); print(2); eqSetOut(S, 2);
  say('再看到 2：0 ≡ 11、11 ≡ 2 ⇒ 0 ≡ 2', '把 2 印出來');
  await step(tok);                                   // 14:46 2 的 list 只有 11
  glow(S.slots[11]); at(2, 0); glow(S.outs[11], RED);
  say('2 下面只有 11：已經印過', '就停住');
  await step(tok);                                   // 15:44 for 迴圈繼續
  glow(S.outs[11]); ring.visible = false;
  say('for 迴圈繼續：i = 1, 2, …', '先找直接相關，再透過 transitive 找間接相關');
  await step(tok);                                   // 16:09 run 完答案就出來
  say('整個 for 迴圈 run 完', '答案就出來了');
}]);

// zLuuRC56uvI 16:19：程式：宣告、初始化與 Phase 1
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
  let x = null, xl = null;
  await step(tok);                                   // 16:19 分 phase 1、phase 2
  say('這個程式要注意兩件事', '第一：分 Phase 1、Phase 2');
  await step(tok);                                   // 16:30 兩個 data structure
  say('第二：兩個 data structure', 'array（seq）和它下面的 linked list');
  await step(tok);                                   // 16:52 ListNode
  cd.hl(0);
  say('ListNode：data 就是那個數字', 'link 是一個 pointer');
  await step(tok);                                   // 17:29 前兩行初始化
  cd.hl(2);
  say('前面兩行做初始化', '從檔案讀資料前，先把 array 準備好');
  await step(tok);                                   // 17:45 宣告 seq、out
  cd.hl(1);
  say('宣告 seq：ListNode pointer 的 array', 'out：boolean array，大小都是 n');
  await step(tok);                                   // 18:07 for 初始化
  cd.hl(2);
  S.slots.forEach((m) => glow(m, GOLD)); S.outs.forEach((m) => glow(m, GOLD));
  say('for 迴圈初始化：seq[i] = 0（沒指出去）', 'out[i] = false（還沒印過）');
  await step(tok);                                   // 18:28 Phase 1：讀檔
  S.slots.forEach((m) => glow(m)); S.outs.forEach((m) => glow(m));
  cd.hl(3);
  say('Phase 1：從檔案讀出 pair (i, j)', '例：0 ≡ 4');
  await step(tok);                                   // 18:36 new node x 放 j
  cd.hl(4);
  x = eqNode(4, EQX(0) + 1.2, 1.8, eqZ(0));
  xl = tag('x', 'ptr', EQX(0) + 1.2, 2.6, eqZ(0));
  say('new 一個 node x，裡面放 j', 'x->data = 4');
  await step(tok);                                   // 18:54 放在 seq[i]
  cd.hl(5); kill(xl); eqInsert(S, 0, x);
  say('把 x 放到 seq[i] 那條 linked list', 'x->link = seq[0]；seq[0] = x');
  await step(tok);                                   // 19:18 i 放進 seq[j]
  cd.hl(7);
  eqInsert(S, 4, eqNode(0, EQX(4) + 1.2, 1.8, eqZ(0)));
  say('y 那邊：把 i 放進 seq[j]', 'y->link = seq[4]；seq[4] = y');
}]);

// zLuuRC56uvI 19:30：Phase 2 的 stack
const EQ_CODE2 = [
  'for (i = 0; i < n; i++) if (!out[i]) {',
  '  cout << i;  out[i] = true;  x = seq[i];  top = 0;',
  '  while (1) {',
  '    while (x) { j = x->data;',
  '      if (!out[j]) { cout << j; out[j] = true; push x; }',
  '      x = x->link; }',
  '    if (!top) break;  x = seq[top->data];  pop;  } }',
];
FRAG.push(['llpeng34-phase2-stack', 'Phase 2：用 stack 走訪', async (tok) => {
  fresh([0, 9.0, 9.0], [0, 2.9, -0.7]);
  const cd = code(EQ_CODE2, 0, 7.6, 0.46, -3.4);
  const S = eqStage({ out: true, stack: true, idxDz: 1.15 });
  eqBuild(S, EQP);
  // every seq[i] here has a list, and its arrow already shows the pointer: a '•' on each slot would sit on the index row
  S.slots.forEach((m) => relabel(m, ''));
  const ring = ringAt(0.48);
  const outL = tag('New class:', 'ptr alt', 0, 0.2, 3.0);
  const pr = [];
  const at = (i, k) => { ring.visible = true; ring.position.set(EQX(i), 0.03, eqZ(k)); };
  const print = (v) => { pr.push(v); eqSetOut(S, v); txt(outL, 'New class: ' + pr.join(', ')); };
  const push = (v) => { const s = cube(v, colorFor(v), [0.75, 0.75, 0.75], EQ_STK_X, 0.4 + 0.8 * S.stack.length, EQ_OUT_Z, 3); s.userData.v = v; S.stack.push(s); };
  const pop = () => { const s = S.stack.pop(); if (s) fly(s, V3(2, 7, 3)); };
  await step(tok);                                   // 19:30 想法簡單、實作難
  say('Phase 2：想法很簡單，實作出來還蠻難的', '');
  await step(tok);                                   // 19:38 linked list 和 stack
  say('它同時用到 linked list 和 stack', '');
  await step(tok);                                   // 19:56 先印直接相關，不看它們的 list
  say('先把跟 0 直接相關的數字都印出來', '暫時不去看它們自己的 list');
  await step(tok);                                   // 20:06 0 看到 11，印 11
  cd.hl(1); print(0); glow(S.slots[0], GOLD);
  cd.hl(4); at(0, 0); print(11);
  say('印出 0；看 0 的 list：看到 11 → 印出 11', '');
  await step(tok);                                   // 20:13 看到 4，印 4
  at(0, 1); print(4);
  say('再看到 4 → 印出 4', '');
  await step(tok);                                   // 20:22 再一個一個 traverse
  ring.visible = false;
  say('讀完 0 的 list 以後', '再對這些數字的 list 一個一個 traverse');
  await step(tok);                                   // 20:38 做法：stack，push 11
  push(11);
  say('做法是 stack：11 印出來，等一下再看它的 list', '所以把 11 放進 stack');
  await step(tok);                                   // 20:45 push 4
  push(4);
  say('4 印出來，也丟進 stack', 'stack：11、4');
  await step(tok);                                   // 21:03 0 的 list 到 null
  cd.hl(6);
  say('看完 4：0 的 list 走到 null 了', '');
  await step(tok);                                   // 21:33 pop 出 4
  cd.hl(6); pop(); glow(S.slots[0]); glow(S.slots[4], GOLD);
  say('從 stack pop 出 4', '去看 4 對應的 link list');
  await step(tok);                                   // 21:48 7：印出、push
  cd.hl(4); at(4, 0); print(7); push(7);
  say('4 跟 7 有關：印出 7，push 進 stack', 'stack：11、7');
  await step(tok);                                   // 21:56 0 已經 true
  at(4, 1); glow(S.outs[0], RED);
  say('再看到 0：out[0] 已經是 true', '印過了，不用管它');
  await step(tok);                                   // 22:06 4 的 list 到 null → pop
  glow(S.outs[0]); ring.visible = false; cd.hl(6);
  say('4 的 list 到 null', '從 stack pop 出下一個數字，再拜訪它的 list');
  await step(tok);                                   // 22:28 pop 7：只有 4，已印過
  pop(); glow(S.slots[4]); glow(S.slots[7], GOLD);
  at(7, 0); glow(S.outs[4], RED);
  say('pop 出 7：7 的 list 只有 4', '4 已經印過 → 不用管');
  await step(tok);                                   // 22:54 最後只剩 11
  glow(S.outs[4]); glow(S.slots[7]); pop(); glow(S.slots[11], GOLD);
  at(11, 0); await beat(tok, 450);
  at(11, 1); print(2); push(2); await beat(tok, 450);
  pop(); glow(S.slots[11]); at(2, 0);
  cd.hl(6);
  say('stack 只剩 11：pop 出來，看到 2 → 印出', '第一個 class：0, 11, 4, 7, 2');
}]);

// zLuuRC56uvI 23:01：輸出順序
FRAG.push(['llpeng34-classes-out', '三個 class 的輸出順序', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.5]);
  const S = eqStage({ out: true });
  eqBuild(S, EQP);
  const { classes } = eqRun(eqSeq(EQP));
  const line = (k) => tag('第 ' + (k + 1) + ' 個 set：' + classes[k].join(', '), 'ptr alt', 0, 0.2, 2.9 + 0.62 * k);
  await step(tok);                                   // 23:01 三個 set
  say('程式的執行結果：三個 set', '');
  await step(tok);                                   // 23:15 第一個 set 的順序
  line(0); classes[0].forEach((v) => eqSetOut(S, v));
  say('第一個 set：0、11、4，然後 7，再來 2', '');
  await step(tok);                                   // 23:35 不要寫成 2 4 7 11
  say('不要寫成 0 2 4 7 11', '順序錯了，就表示你沒有 trace code');
  await step(tok);                                   // 23:47 第二個 set 從 1 開始
  line(1); classes[1].forEach((v) => eqSetOut(S, v));
  say('第二個 set 從 1 開始', '接下來的順序，自己 trace');
  await step(tok);                                   // 23:55 第三個 set 從 6 開始
  line(2); classes[2].forEach((v) => eqSetOut(S, v));
  say('第三個 set 從 6 開始', '後面三個數字的順序也有關係');
  await step(tok);                                   // 24:06 順序有意義
  say('這個程式的輸出順序是有意義的', '');
}]);

// zLuuRC56uvI 24:23：輸入順序改變
FRAG.push(['llpeng34-order-matters', '輸入順序改變，輸出順序就變', async (tok) => {
  fresh([0, 9, 10.5], [0, 0, 0.3]);
  const S = eqStage();
  eqBuild(S, EQP);
  const a = eqRun(eqSeq(EQP)).classes.map((c) => c.join(' ')).join('｜');
  const R = EQP.slice().reverse();
  const b = eqRun(eqSeq(R)).classes.map((c) => c.join(' ')).join('｜');
  const pl = tag('', 'ptr alt', 0, 0.2, 3.0);
  await step(tok);                                   // 24:23 input 順序調換
  tag('原順序：' + a, 'ptr', 0, 0.2, 2.2);
  say('把 input pair 的順序調換一下', '');
  await step(tok);                                   // 24:32 set 一樣嗎
  say('出來的 set 會一樣嗎？', 'set 當然還是只有三個');
  await step(tok);                                   // 24:42 裡面的順序不一定
  say('可是 set 裡數字的順序不一定一樣', '');
  await step(tok);                                   // 24:54 輸入順序決定 list 結構
  say('因為輸入順序決定了 linked list 的 structure', '');
  await step(tok);                                   // 25:00 倒過來輸入
  eqClear(S);
  for (const [i, j] of R) { eqIns(S, i, j); eqIns(S, j, i); txt(pl, '讀到 ' + i + ' ≡ ' + j); await beat(tok, 140); }
  say('倒過來：先輸入 11 ≡ 0、2 ≡ 11、3 ≡ 5 …', '');
  await step(tok);                                   // 25:13 list 不一樣
  [0, 11].forEach((i) => S.lists[i].forEach((m) => glow(m, GOLD)));
  say('出來的 list 就不一樣', 'seq[0] 變成 4 → 11，seq[11] 變成 2 → 0');
  await step(tok);                                   // 25:23 順序不同
  [0, 11].forEach((i) => S.lists[i].forEach((m) => glow(m)));
  txt(pl, '倒過來：' + b);
  say('Phase 2 一樣三個 set，但裡面的順序不同', b);
  await step(tok);                                   // 25:46 唯一解嗎？
  say('這是唯一解嗎？', '期中考的加分題：想想別的寫法');
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
function spFull() { const G = { ent: [] }; spHeads(G, false); SPT.forEach((t) => spEntry(G, t, false)); G.arr = spAll(G); G.nx = spNext(); return G; }

// zLuuRC56uvI 28:36：從 array 到 linked list
FRAG.push(['llpeng34-sparse-array', 'Sparse matrix：從 array 到 linked list', async (tok) => {
  fresh([0, 4, 13], [0, 3.4, 0]);
  const M = [[0, 0, 11, 0], [12, 0, 0, 0], [0, -4, 0, 0], [0, 0, 0, -15]];
  const mx = (c) => -5.2 + c * 1.15, my = (r) => 5.6 - r * 1.15;
  const cells = [];
  M.forEach((row, r) => row.forEach((v, c) => {
    const m = cube(v, v ? colorFor(Math.abs(v)) : '#e9dcc4', v ? [1.0, 0.9, 0.5] : [0.8, 0.7, 0.3], mx(c), my(r), 0);
    cells.push({ m, r, c, v });
  }));
  for (let c = 0; c < 4; c++) tag('c' + c, 'idx', mx(c), 6.5);
  for (let r = 0; r < 4; r++) tag('r' + r, 'idx', -6.3, my(r));
  await step(tok);                                   // 28:36 sparse matrix
  say('Sparse matrix：第二章講過', '');
  await step(tok);                                   // 28:44 很多元素是 0
  cells.filter((e) => !e.v).forEach((e) => tint(e.m, GRAY));
  say('Sparse：裡面很多元素是 0', '4×4，只有 4 個非 0');
  await step(tok);                                   // 29:02 用 array 存
  say('那時候用一個 array 存它', '');
  await step(tok);                                   // 29:10 1D array
  tag('row col value', 'idx', 3.6, 6.3);
  cube('4  4  4', '#4b9ee2', [2.6, 0.6, 0.5], 3.6, 5.6, 0, 2);
  say('不是 2D array，而是 one dimension 的 array', '');
  await step(tok);                                   // 29:15 只存非 0：row、col、值
  let k = 1;
  for (const e of cells.filter((x) => x.v)) {
    const t = cube(e.r + '  ' + e.c + '  ' + e.v, colorFor(Math.abs(e.v)), [2.6, 0.6, 0.5], mx(e.c), my(e.r), 0.6);
    move(t, 3.6, 5.6 - k * 0.8, 0); k++;
  }
  say('只存非 0 的 element：row、column 和它的值', '一筆一個 triple');
  await step(tok);                                   // 29:34 也可以用 linked list
  say('也可以用 linked list 來代表 sparse matrix', '');
  await step(tok);                                   // 29:53 環狀 linked list
  say('用環狀（circular）的 linked list 表示', '');
  await step(tok);                                   // 30:02 每個 row、column 各一條
  cells.filter((e) => e.r === 1).forEach((e) => glow(e.m, GOLD));
  cells.filter((e) => e.c === 0).forEach((e) => glow(e.m, RED));
  say('每一個 row、每一個 column 都對應一條環狀 linked list', '例：row 1 一條、column 0 一條，12 同時在兩條上');
}]);

// zLuuRC56uvI 30:23：head node 與環狀 list
FRAG.push(['llpeng34-sparse-lists', 'Sparse matrix 的 head node 與環狀 list', async (tok) => {
  spFrame();
  const G = { ent: [] };
  let ra = [], ca = [];
  await step(tok);                                   // 30:23 表示出來變成這樣
  spHeads(G, true);
  say('剛才那個 matrix，用 linked list 表示出來', '');
  await step(tok);                                   // 30:33 藍色 head node
  glow(G.H, GOLD);
  say('藍色：整個 matrix 的 head node', '');
  await step(tok);                                   // 30:40 4×4
  say('例子是 4×4 的 matrix', '');
  await step(tok);                                   // 30:49 黃色：每個 row／column 的 head node
  glow(G.H); G.top.forEach((m) => glow(m, GOLD)); G.left.forEach((m) => glow(m, GOLD));
  say('黃色：每一個 row／column 對應的 head node', 'H0、H1、H2、H3');
  await step(tok);                                   // 31:00 畫兩次，其實一樣
  say('上面一排、左邊一排的 H0…H3 代表同樣的 node', '為了表示方便畫兩次');
  await step(tok);                                   // 31:11 1 藍 + 4 黃
  G.top.forEach((m) => glow(m));
  say('實際上只有：1 個藍色 node、4 個黃色 node', '');
  await step(tok);                                   // 31:33 H0：第 0 row、第 0 column
  G.left.forEach((m) => glow(m)); glow(G.top[0], GOLD); glow(G.left[0], GOLD);
  say('H0 代表第 0 個 row，也代表第 0 個 column', 'H1 代表第 1 個 row、第 1 個 column');
  await step(tok);                                   // 31:51 entry：1 0 12
  glow(G.top[0]); glow(G.left[0]);
  const e12 = spEntry(G, SPT[1], true);
  say('看這個 node：1 0 12', '');
  await step(tok);                                   // 32:08 第 1 row、第 0 column、值 12
  glow(e12.m, GOLD);
  say('第 1 個 row、第 0 個 column，值是 12', 'a[1][0] = 12');
  await step(tok);                                   // 32:42 H1：第一個 row 的 list
  glow(e12.m); glow(G.left[1], GOLD);
  say('H1 這個欄位：記載第一個 row 的 element 構成的 list', '');
  await step(tok);                                   // 33:28 往右看到 12，0 不記
  ra = spRowArrows(G, 1);
  say('row 1 往右看：第一個非 0 就是 12', '其他都是 0，不用記載');
  await step(tok);                                   // 33:49 回到頭端 → 環狀
  say('12 後面沒有了 → link 回到頭端 H1', '所以是環狀 linked list');
  await step(tok);                                   // 34:06 紅線：column 的 list
  glow(G.left[1]); glow(G.top[0], GOLD);
  ca = spColArrows(G, 0);
  say('紅色線：column 構成的 linked list', '從 H0 往下指');
  await step(tok);                                   // 34:49 column 0 只有 12，指回 H0
  say('column 0 也只有 12', '它再指回 H0：一樣是環狀');
  await step(tok);                                   // 35:22 header node 三個欄位
  glow(G.top[0]);
  say('黃色 header node 有三個欄位', '');
  await step(tok);                                   // 35:36 兩個 pointer 欄位
  glow(G.left[0], GOLD);
  say('為了指向第 0 個 row、第 0 個 column', '要有兩個 pointer 欄位');
  void ra; void ca;
}]);

// zLuuRC56uvI 36:10（欄位與 node 數）；params.v = 'review' 播 yn0ZAifhyNM 00:00 的複習
FRAG.push(['llpeng34-node-fields', 'Header node 與 entry node 的欄位', async (tok) => {
  const P = ctx.params || {};
  fresh([0, 4, 12.5], [0, 2.8, 0]);
  function diag(x, top, bottom, color, title) {
    const cs = top.map((t, k) => cube(t, color, [1.15, 0.7, 0.5], x + (k - 1) * 1.2, 4.2, 0));
    const bw = 3.55 / bottom.length;
    const bs = bottom.map((t, k) => cube(t, color, [bw - 0.05, 0.7, 0.5], x - 1.775 + bw * (k + 0.5), 3.45, 0));
    tag(title, 'ptr', x, 5.1);
    return { cs, bs };
  }
  const H = () => diag(-3.3, ['down', 'head=T', 'right'], ['next'], '#f2c46d', 'header node');
  const E = () => diag(3.3, ['down', 'head=F', 'right'], ['row', 'col', 'value'], '#b8a894', 'entry node');
  const G = (arr, on) => arr.forEach((m) => glow(m, on ? GOLD : null));
  if (P.v === 'review') {
    let h = null, e = null;
    await step(tok);                                 // 0:00 上週：sparse matrix
    say('上週：sparse matrix 用 linked list 來存', '');
    await step(tok);                                 // 0:34 重點：表示方法、class 宣告
    say('重點：它的表示方法，和 class 的宣告', '');
    await step(tok);                                 // 0:51 兩種 node
    h = H(); e = E();
    say('node 分成兩種型別', 'head node 和 entry node');
    await step(tok);                                 // 1:01 head node：row／column 的頭端
    G(h.cs, true); G(h.bs, true);
    say('head node：每一個 row 或 column 的頭端', '');
    await step(tok);                                 // 1:22 head 欄位
    G(h.cs, false); G(h.bs, false); glow(h.cs[1], GOLD);
    say('head 欄位：boolean', '告訴你它是不是 head node');
    await step(tok);                                 // 1:38 right：同一個 row
    glow(h.cs[1]); glow(h.cs[2], GOLD);
    say('right：pointer，指向同一個 row', '');
    await step(tok);                                 // 1:44 down：同一個 column
    glow(h.cs[2]); glow(h.cs[0], GOLD);
    say('down：指向同一個 column', '指向那個 row／column 的 entry node');
    await step(tok);                                 // 1:54 next：head node 的 list
    glow(h.cs[0]); glow(h.bs[0], GOLD);
    say('next：串起 head node 的 linked list', '指向下一個 head node');
    await step(tok);                                 // 2:05 三個 pointer
    [h.cs[0], h.cs[2], h.bs[0]].forEach((m) => glow(m, GOLD));
    say('嚴格來說，head node 有三個 pointer', 'right、down、next');
    await step(tok);                                 // 2:21 max{m, n}
    G(h.cs, false); G(h.bs, false);
    say('m×n matrix：head node 的個數是 max{m, n}', 'row 和 column 哪個多就選哪個');
    void e;
    return;
  }
  let h = null, e = null, cnt = [];
  await step(tok);                                   // 36:10 header node 最下面的欄位
  h = H(); glow(h.bs[0], GOLD);
  say('header node 最下面的欄位', '指向 header node 的 linked list');
  await step(tok);                                   // 36:18 H0 → H1 → H2 …
  const hs = [0, 1, 2, 3].map((k) => cube('H' + k, '#f2c46d', [0.8, 0.6, 0.6], -5.4 + k * 1.4, 1.4, 1.2));
  for (let k = 0; k < 3; k++) arrow(V3(-5.0 + k * 1.4, 1.4, 1.2), V3(-4.4 + k * 1.4, 1.4, 1.2), 0x0f8a5a);
  say('H0 → H1 → H2 → H3', 'header node 本身也形成一條 linked list');
  await step(tok);                                   // 36:45 三個 pointer
  [h.cs[0], h.cs[2], h.bs[0]].forEach((m) => glow(m, GOLD));
  say('每個 header node 有三個 pointer', 'header list 的 next，和指向 row、column list 的兩個');
  await step(tok);                                   // 37:01 黑色框框：本身的數字
  G(h.cs, false); G(h.bs, false);
  e = E();
  say('黑色框框：entry node，放它本身的數字', '');
  await step(tok);                                   // 37:12 五個欄位
  say('它有五個欄位', '');
  await step(tok);                                   // 37:20 兩個 pointer
  glow(e.cs[0], GOLD); glow(e.cs[2], GOLD);
  say('左上、右上：兩個 pointer', '指向它所在的 row 和 column 的 list');
  await step(tok);                                   // 37:29 位置
  glow(e.cs[0]); glow(e.cs[2]); glow(e.bs[0], GOLD); glow(e.bs[1], GOLD);
  say('中間：它的位置', '第幾個 row、第幾個 column');
  await step(tok);                                   // 37:40 值
  glow(e.bs[0]); glow(e.bs[1]); glow(e.bs[2], GOLD);
  say('下面：它的數值', '');
  await step(tok);                                   // 38:03 要多少 node？
  glow(e.bs[2]); hs.forEach(kill);
  say('如果有 r 個非 0 項，要用多少個 node？', 'n×m matrix');
  await step(tok);                                   // 38:13 max{n, m} + r + 1
  cnt.push(cube('H', '#4b9ee2', [0.7, 0.6, 0.7], -3.6, 0.3, 1.5, 3));
  for (let k = 0; k < 4; k++) cnt.push(cube('H' + k, '#f2c46d', [0.7, 0.6, 0.7], -2.0 + k * 0.85, 0.3, 1.5, 3));
  for (let k = 0; k < 4; k++) cnt.push(cube(SPT[k][2], '#6b5d50', [0.7, 0.6, 0.7], 2.2 + k * 0.85, 0.3, 1.5, 3));
  say('node 數 = max{n, m} + r + 1', '');
  await step(tok);                                   // 38:21 看 n、m 哪個大
  tag('max{n, m} = 4', 'idx', -0.7, 0, 2.5);
  say('n×m：看 n 和 m 哪個最大', '這裡黃色 head node 要 4 個');
  await step(tok);                                   // 38:29 r 個黑色
  tag('r = 4', 'idx', 3.5, 0, 2.5);
  say('r：黑色的 entry node，這裡 4 個', '');
  await step(tok);                                   // 38:38 +1：藍色
  tag('+1', 'idx', -3.6, 0, 2.5); glow(cnt[0], GOLD);
  say('最後 +1：藍色的 node', '4 + 4 + 1 = 9');
  await step(tok);                                   // 38:52 header node 的欄位
  glow(cnt[0]); G(h.cs, true); G(h.bs, true);
  say('header node：head、right（同一列）、down（同一行）', '還有 next 指向 head node 的 list');
  await step(tok);                                   // 39:07 entry node 的欄位
  G(h.cs, false); G(h.bs, false); G(e.cs, true); G(e.bs, true);
  say('entry node：down、row、col、value、right', '代表 matrix 裡的 a_ij');
}]);

// zLuuRC56uvI 40:16：H0 是同一個 node；transpose 只改 pointer
FRAG.push(['llpeng34-sparse-transpose', '同一組 head node、transpose 只改 pointer', async (tok) => {
  spFrame();
  const G = { ent: [] };
  spHeads(G, false);
  SPT.forEach((t) => spEntry(G, t, false));
  let ar = spAll(G);
  await step(tok);                                   // 40:16 上面和左邊的 H0 一樣
  glow(G.top[0], GOLD); glow(G.left[0], GOLD);
  say('上面的 H0 和左邊的 H0', '代表的是同一個 head node');
  await step(tok);                                   // 40:41 2D 只是示意
  say('畫成 two dimension 的 matrix', '只是看起來方便');
  await step(tok);                                   // 40:51 看起來 8 個，其實 4 個
  G.top.forEach((m) => glow(m, GOLD)); G.left.forEach((m) => glow(m, GOLD));
  say('黃色看起來有 8 個', '實際上只有 4 個');
  await step(tok);                                   // 41:14 head node 三個欄位
  G.top.forEach((m) => glow(m)); G.left.forEach((m) => glow(m));
  say('head node 只有三個欄位', 'column 的 list、row 的 list、head node 的 list');
  await step(tok);                                   // 41:46 有什麼好處？
  say('問題：這種表示方法有什麼好處？', '回去想想看');
  await step(tok);                                   // 42:16 transpose 好簡單
  say('用它做 transpose 很簡單', 'row 變 column、column 變 row');
  await step(tok);                                   // 42:28 head node 不用變
  killAll(ar);
  for (const e of G.ent) { [e.r, e.c] = [e.c, e.r]; move(e.m, SCX(e.c), SRY(e.r), 0); relabel(e.m, e.r + ' ' + e.c + ' │ ' + e.v); glow(e.m, GOLD); }
  say('head node 要不要改？不用', '還是同一組黃色 head node');
  await step(tok);                                   // 42:36 要改的是 pointer
  G.ent.forEach((e) => glow(e.m));
  ar = spAll(G);
  say('要改的是 pointer', 'right、down 全部重新指');
  await step(tok);                                   // 42:52 overhead
  say('overhead 只在把 pointer 指到對的位置', '');
}]);

// zLuuRC56uvI 43:14（MatrixNode）；params.v = 'review' 播 yn0ZAifhyNM 02:56 的複習
FRAG.push(['llpeng34-matrixnode-union', 'MatrixNode：一個 class 表示兩種 node', async (tok) => {
  const P = ctx.params || {};
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
  const cs = ['down', 'head', 'right'].map((t, k) => cube(t, '#b8a894', [1.1, 0.7, 0.5], X + (k - 1) * 1.15, 4.4, 0));
  const u = cube('union', '#c9b48e', [3.4, 0.7, 0.5], X, 3.65, 0);
  tag('MatrixNode', 'ptr', X, 5.3);
  const asHead = () => { relabel(cs[1], 'head=T'); relabel(u, 'next'); tint(u, '#f2c46d'); };
  const asEntry = () => { relabel(cs[1], 'head=F'); relabel(u, 'row col value'); tint(u, '#6b5d50'); };
  if (P.v === 'review') {
    await step(tok);                                 // 2:56 entry node 記位置與值
    asEntry(); glow(u, GOLD);
    say('entry node：記載它在哪個 row、哪個 column', '以及它的值');
    await step(tok);                                 // 3:09 跟 array 表示法很像
    say('跟 array 表示法很像', 'row、col、value');
    await step(tok);                                 // 3:27 right、down
    glow(u); glow(cs[0], GOLD); glow(cs[2], GOLD);
    say('right：同一個 row 的下一個非 0', 'down：同一個 column 的下一個非 0');
    await step(tok);                                 // 3:51 中間還有 head
    glow(cs[0]); glow(cs[2]); glow(cs[1], GOLD); cd.hl(4);
    say('中間還有一個欄位：head', '');
    await step(tok);                                 // 4:07 宣告成同一個 class
    cd.hl(1);
    say('head node 和 entry node 宣告成同一個 class', '所以要有 head 來分辨');
    await step(tok);                                 // 4:27 共同欄位
    cs.forEach((m) => glow(m, GOLD)); cd.hl(3);
    say('某些欄位一樣：down、head、right', '');
    await step(tok);                                 // 4:42 不一樣的地方
    cs.forEach((m) => glow(m)); glow(u, RED);
    say('不一樣：entry 有 row、col、value', 'head node 有 next');
    await step(tok);                                 // 4:55 用 union
    glow(u); cd.hl(5); relabel(u, 'union'); tint(u, '#e07a6a'); relabel(cs[1], 'head');
    say('要宣告成同一個 class：用 union', '紅色這個字要注意');
    await step(tok);                                 // 5:50 head = true → next
    cd.hl(6); asHead();
    say('head 是 true：union 選 next', '它就是 head node');
    await step(tok);                                 // 6:18 head = false → triple
    cd.hl(7); asEntry();
    say('head 是 false：選 triple', 'row、col、value');
    await step(tok);                                 // 6:39 不必每種 node 各一個 class
    cd.hl(-1);
    say('不必為每一種 node 定義一個 class', '程式更精簡');
    return;
  }
  await step(tok);                                   // 43:14 感覺應該是兩個 data type
  say('head node 和 entry node', '感覺好像應該是兩個 data type');
  await step(tok);                                   // 43:30 只用一個 class
  say('課本只用一個 class', '代表兩種不同型態的 node');
  await step(tok);                                   // 43:58 struct Triple
  cd.hl(0);
  say('紅字的部分：先定義 struct Triple', '');
  await step(tok);                                   // 44:08 Triple 的內容
  say('Triple：記 matrix 裡的值', '還有它的 row 和 col');
  await step(tok);                                   // 44:16 class MatrixNode
  cd.hl(1);
  say('matrix 裡的 node 也是一個 class：MatrixNode', '');
  await step(tok);                                   // 44:40 down、right 兩個 pointer
  cd.hl(3); glow(cs[0], GOLD); glow(cs[2], GOLD);
  say('private：兩個 pointer', 'down 和 right');
  await step(tok);                                   // 44:48 bool head
  glow(cs[0]); glow(cs[2]); cd.hl(4); glow(cs[1], GOLD);
  say('bool head：判斷它是不是 head node', '');
  await step(tok);                                   // 44:58 為什麼要判斷
  say('因為要用同一個 class MatrixNode', '去代表 head node 和 entry node');
  await step(tok);                                   // 45:13 union
  glow(cs[1]); cd.hl(5); tint(u, '#e07a6a');
  say('接下來有一個 union', '');
  await step(tok);                                   // 45:20 union 裡兩個宣告
  say('union 裡有兩個資料宣告', 'MatrixNode *next，和 Triple triple');
  await step(tok);                                   // 45:38 只能選一個
  say('union：兩個資料只能選一個', '共用同一塊空間');
  await step(tok);                                   // 45:52 header → next
  cd.hl(6); asHead();
  say('如果是 header node：不用 triple', '只要 next，串到下一個 header');
  await step(tok);                                   // 46:24 不是 header → triple
  cd.hl(7); asEntry();
  say('不是 header（entry node）：選 triple', '只要記 row、col、value');
  await step(tok);                                   // 47:09 自己寫會宣告兩個 class
  cd.hl(-1);
  say('自己 implement 的話，可能會宣告兩個 class', 'header node 一個、entry node 一個');
  await step(tok);                                   // 47:25 一個 class 就解決
  cs.forEach((m) => glow(m, GOLD));
  say('其實一個 class 就能解決', '共同部分 ＋ bool head ＋ union');
}]);

// yn0ZAifhyNM 07:10：圖上的 H0–H3 與 head 欄位
FRAG.push(['llpeng34-sparse-review', '圖上的 H0–H3 與 head 欄位', async (tok) => {
  spFrame();
  const G = spFull();
  await step(tok);                                   // 7:10 黃色 H0–H3
  G.top.forEach((m) => glow(m, GOLD));
  say('這張圖：上面黃色的 H0、H1、H2、H3', '');
  await step(tok);                                   // 7:17 和左邊是同樣的 node
  G.left.forEach((m) => glow(m, GOLD));
  say('和左邊看到的黃色，其實是同樣的 node', '');
  await step(tok);                                   // 7:28 copy 一份畫
  say('只是為了表示方便，copy 一份畫出來', '看起來像一個 matrix');
  await step(tok);                                   // 7:36 entry node：row、col、value
  G.top.forEach((m) => glow(m)); G.left.forEach((m) => glow(m));
  G.ent.forEach((e) => glow(e.m, GOLD));
  say('裡面的 entry node', '記載 row、col 和 value');
  await step(tok);                                   // 7:53 head 欄位沒畫
  G.ent.forEach((e) => glow(e.m));
  say('head 欄位呢？', '為了節省空間沒畫出來');
  await step(tok);                                   // 8:01 用顏色代表
  G.top.forEach((m) => glow(m, GOLD)); G.left.forEach((m) => glow(m, GOLD));
  say('用顏色代表：黃色是 head node', '黑色是 entry node');
}]);

// yn0ZAifhyNM 08:20：輸入格式與 operator
FRAG.push(['llpeng34-sparse-input', '讀檔建出 sparse matrix', async (tok) => {
  spFrame();
  const lines = ['4 4 4', '0 2 11', '1 0 12', '2 1 -4', '3 3 -15'];
  const G = { ent: [] };
  let cur = null;
  await step(tok);                                   // 8:20 matrix 的程式：operator
  say('Matrix 的程式：看一下它的 operator', '');
  await step(tok);                                   // 8:31 operator >> overloading
  say('operator >> 有做 overloading', '為 matrix 量身訂做');
  await step(tok);                                   // 8:56 輸入：4 4 4 …
  tag('輸入：' + lines.join('  ｜  '), 'idx', 0.4, 8.6);
  cur = tag('讀入：4 4 4', 'ptr alt', 0.4, 8.0);
  spHeads(G, true); spNext();
  say('輸入格式：第一行 4 4 4', '4×4 matrix、4 個非 0');
  await step(tok);                                   // 9:05 每行一個 (row, col, value)
  for (const t of SPT) {
    txt(cur, '讀入：' + t.join(' '));
    spEntry(G, t, true); spRowArrows(G, t[0]); spColArrows(G, t[1]);
    await beat(tok, 450);
  }
  txt(cur, '讀完');
  say('之後每行一個 (row, col, value)', '從檔案讀 matrix，就用這個 input 格式');
  await step(tok);                                   // 9:20 4.8.2、4.8.3
  say('詳細請看課本 4.8.2、4.8.3', '回去複習');
  await step(tok);                                   // 9:45 transpose 等操作
  say('4.8.3：在 matrix node 上做 transpose 等操作', '');
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
const rlinkA = (a, b, c = RLC) => [arrow(rOut(a), lIn(b), c)];
const llinkA = (b, a, c = LLC) => [arrow(lOut(b), rIn(a), c)];
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

// yn0ZAifhyNM 10:01：node 的兩個 link
FRAG.push(['llpeng34-dll-node', 'Doubly linked list 的 node', async (tok) => {
  fresh([0, 5, 11], [0, 1.6, 0]);
  const cd = code(['class DblListNode {', '  int data;', '  DblListNode *llink, *rlink;', '};', 'class DblList { DblListNode *first; };'], -3.6, 5.6, 0.55);
  let n = null, l1 = null, l2 = null;
  const D = { nodes: [], arr: [] };
  await step(tok);                                   // 10:01 今天的重點
  say('今天的重點：doubly linked list', '講完，linked list 這章就結束');
  await step(tok);                                   // 10:21 為什麼叫 double
  say('為什麼叫 double？', '它比 linked list 還強');
  await step(tok);                                   // 10:31 link 的數目
  say('強在 link 的數目', '比 singly linked list 多');
  await step(tok);                                   // 10:54 兩個 link 欄位
  n = dn('data', 2.6, 3.4, 0, '#c9b48e', 1.6);
  l1 = tag('llink', 'idx', 2.6 - 1.2, 2.5); l2 = tag('rlink', 'idx', 2.6 + 1.2, 2.5);
  say('node 通常有兩個 link 的欄位', 'llink ｜ data ｜ rlink');
  await step(tok);                                   // 11:00 llink
  glow(n.userData.L, GOLD);
  say('llink：left link field', '指向這個 node 的左邊');
  await step(tok);                                   // 11:09 data
  glow(n.userData.L); glow(n.userData.D, GOLD);
  say('data field：存放資料', '');
  await step(tok);                                   // 11:15 rlink
  glow(n.userData.D); glow(n.userData.R, GOLD);
  say('rlink：right link field', '指向它的右邊');
  await step(tok);                                   // 11:31 宣告很像
  glow(n.userData.R); kill(n); kill(l1); kill(l2);
  cd.hl(2);
  for (const [t, x] of [['A', -3], ['B', 0], ['C', 3]]) D.nodes.push(dn(t, x, 0.5, 0, colorFor(x + 3)));
  dllDraw(D, false);
  say('宣告跟 singly 很像', '只是 node 有 llink、rlink 兩個 pointer');
  await step(tok);                                   // 11:52 first
  cd.hl(4);
  tag('first', 'ptr', -3, 1.6);
  glow(D.nodes[0].userData.D, GOLD);
  say('一樣有頭端 first', '指向第一個 node');
}]);

// yn0ZAifhyNM 12:00：header node、empty、單一 node
FRAG.push(['llpeng34-dll-header', 'Header node 與環狀 doubly linked list', async (tok) => {
  fresh([0, 6, 12], [0, 0.6, 0.8]);
  const D = { nodes: [], arr: [] };
  const H = dn('H', -4.5, 0.5, 0, '#8a8a8a');
  D.nodes.push(H);
  [['A', -1.5], ['B', 1.5], ['C', 4.5]].forEach(([t, x], k) => D.nodes.push(dn(t, x, 0.5, 0, colorFor(k + 1))));
  tag('header', 'ptr', -4.5, 1.6);
  await step(tok);                                   // 12:00 也可以有 header node
  dllDraw(D);
  say('doubly linked list 也可以有 header node', '紅 = rlink（往右），藍 = llink（往左）');
  await step(tok);                                   // 12:14 header 的 rlink → 第一個 node
  glow(H.userData.R, GOLD); glow(D.nodes[1].userData.D, GOLD);
  say('header 的 rlink 指向 list 的第一個 node', '');
  await step(tok);                                   // 12:33 紅色：往右串
  say('紅色：rlink 往右串起來的 linked list', '');
  await step(tok);                                   // 13:11 header 的 llink → 最後一個
  glow(H.userData.R); glow(D.nodes[1].userData.D);
  glow(H.userData.L, GOLD); glow(D.nodes[3].userData.D, GOLD);
  say('header 的 llink 指向最後（最右邊）那個 node', '');
  await step(tok);                                   // 13:31 藍色往左
  say('藍色：llink 往左指的 linked list', 'header 的 llink 就是它的第一個 element');
  await step(tok);                                   // 14:24 中間的 node
  glow(H.userData.L); glow(D.nodes[3].userData.D);
  glow(D.nodes[2].userData.D, GOLD);
  say('中間的 node：雙向指標', '分別指向前一個和後一個');
  await step(tok);                                   // 14:48 empty
  glow(D.nodes[2].userData.D);
  for (const g of D.nodes.splice(1)) fly(g, V3(0, 8, 3));
  dllDraw(D);
  say('Empty：只有一個 header node', '自己指向自己');
  await step(tok);                                   // 15:18 只有一個 node
  const A = dn('A', 0.5, 0.5, 0, colorFor(4)); D.nodes.push(A);
  dllDraw(D);
  say('只有一個 node：header 左右都指向它', '它的左右也都指回 header（環狀）');
}]);

// yn0ZAifhyNM 15:57：把 p 插在 x 後面
FRAG.push(['llpeng34-dll-insert', 'Doubly linked list：把 p 插在 x 後面', async (tok) => {
  fresh([0, 5.5, 11], [0, 2, 0]);
  const cd = code(['1  p->llink = x;', '2  p->rlink = x->rlink;', '3  (x->rlink)->llink = p;', '4  x->rlink = p;'], -4.0, 6.4, 0.6);
  let X = null, R = null, P = null, xr = [], rl = [], pre = [], xrl = null;
  const a = [];
  await step(tok);                                   // 15:57 先把圖畫出來
  say('Insert：一樣先把圖畫出來', '');
  await step(tok);                                   // 16:08 node x 與藍色 node
  X = dn('x', -3, 0.5, 0, '#c9a227'); R = dn('x→r', 3, 0.5, 0, '#4b9ee2');
  xr = rlinkA(X, R); rl = llinkA(R, X);
  say('這是 node x', '藍色是 x 右邊的 node');
  await step(tok);                                   // 16:18 要 insert 的 node p
  P = dn('p', 0, 3, 0, '#d64545');
  say('要 insert 的是 node p', '');
  await step(tok);                                   // 16:44 藍色 = x->rlink
  glow(R.userData.D, GOLD);
  xrl = tag('x->rlink', 'ptr alt', 3, 1.5);
  say('藍色 node 就是 x->rlink', 'x 的 right link 指的那個 node');
  await step(tok);                                   // 17:28 插在 x 後面
  glow(R.userData.D); kill(xrl);
  say('要把 node p 插在 node x 的後面', '');
  await step(tok);                                   // 17:55 最後的結果
  pre.push(arrow(lOut(P), V3(-2.4, 0.95, 0), GHOST), arrow(rOut(P), V3(2.4, 0.95, 0), GHOST), arrow(V3(2.1, 0.7, 0), V3(0.9, 2.6, 0), GHOST), arrow(V3(-2.1, 0.9, 0), V3(-0.9, 2.9, 0), GHOST));
  say('先想像結果：x ⇄ p ⇄ 藍色 node', '原本 x 和藍色之間的黑線會不見');
  await step(tok);                                   // 18:26 四個 link
  killAll(pre);
  say('牽涉到四個 link', '要做四個 pointer assignment');
  await step(tok);                                   // 18:44 ①
  cd.hl(0); a.push(arrow(lOut(P), V3(-2.4, 0.95, 0), LLC));
  say('① p 的 llink 指向 x', 'p->llink = x');
  await step(tok);                                   // 18:60 ②
  cd.hl(1); a.push(arrow(rOut(P), V3(2.4, 0.95, 0), RLC));
  say('② p 的 rlink 指向 x 的 rlink', 'p->rlink = x->rlink（藍色 node 的位置）');
  await step(tok);                                   // 19:22 ③
  cd.hl(2); killAll(rl); a.push(arrow(V3(2.1, 0.7, 0), V3(0.9, 2.6, 0), LLC));
  say('③ 藍色 node 的 llink 指向 p', '藍色在哪？就是 x->rlink → (x->rlink)->llink = p');
  await step(tok);                                   // 19:48 ④
  cd.hl(3); killAll(xr); a.push(arrow(V3(-2.1, 0.9, 0), V3(-0.9, 2.9, 0), RLC));
  say('④ x 自己的 rlink 指向 p', 'x->rlink = p，完成');
  await step(tok);                                   // 20:10 順序可以顛倒嗎
  a.forEach(kill); cd.hl(-1);
  dmove(P, 0, 0.5); dmove(X, -3.2); dmove(R, 3.2);
  const D = { nodes: [X, P, R], arr: [] }; dllDraw(D, false);
  say('結果：x ⇄ p ⇄ 原本 x 的右邊', '問題：順序可以顛倒嗎？');
  await step(tok);                                   // 20:31 自己對調看看
  killAll(D.arr); cd.hl(3);
  dmove(P, 0, 3); dmove(X, -3); dmove(R, 3);
  poly([rOut(P), V3(1.4, 3.1, 0), V3(1.4, 3.1, 1.0), V3(-1.4, 3.1, 1.0), V3(-1.4, 3.1, 0), V3(-1.0, 3.1, 0)], RLC);
  glow(P.userData.D, RED);
  say('自己對調看看結果會不會一樣', '例：④ 先做，② 就變成 p->rlink = p，右邊斷了');
  await step(tok);                                   // 20:52 指標可以串著寫
  glow(P.userData.D); cd.hl(2);
  say('有趣的是：link 的指標可以串著寫', 'x->rlink->llink');
}]);

// yn0ZAifhyNM 21:14：插在 x 後面第 k 個
FRAG.push(['llpeng34-dll-insert-k', '練習：插在 x 後面第 k 個位置', async (tok) => {
  fresh([0, 6, 11.5], [0, 1, 0]);
  const xs = [-5.2, -2.6, 0, 2.6];
  const D = { nodes: [['x', '#c9a227'], ['a', colorFor(1)], ['b', colorFor(2)], ['c', colorFor(3)]].map(([t, c], k) => dn(t, xs[k], 0.5, 0, c)), arr: [] };
  dllDraw(D, false);
  let P = null;
  await step(tok);                                   // 21:14 insert 在第 k 個？
  say('第二個問題：能不能 insert 在 x 後面的第 k 個？', '');
  await step(tok);                                   // 21:34 下下一個
  say('現在的 insert 是插在 x 的下一個', '如果要插在 x 的下下一個呢？');
  await step(tok);                                   // 21:44 紅色 p
  P = dn('p', 1.3, 3, 0, '#d64545');
  say('紅色的 p 不是插在 x 緊接的後面', '');
  await step(tok);                                   // 21:56 中間卡一個
  dmove(D.nodes[2], 2.6); dmove(D.nodes[3], 5.2);
  dmove(P, 0, 0.5);
  D.nodes.splice(2, 0, P);
  dllDraw(D, false);
  glow(D.nodes[1].userData.D, GOLD);
  say('x 和 p 中間卡一個 node', 'p 在 x 後面的第 2 個位置');
  await step(tok);                                   // 22:08 insertK 怎麼寫
  glow(D.nodes[1].userData.D);
  say('想想看：insertK 要怎麼寫？', '把 node p 插在 node x 後面的第 k 個');
  await step(tok);                                   // 22:30 考題之一
  say('這也可能是考題之一', '');
}]);

// yn0ZAifhyNM 22:36：刪除 x
FRAG.push(['llpeng34-dll-delete', 'Doubly linked list：刪除 x', async (tok) => {
  fresh([0, 5.5, 11], [0, 1.8, 0]);
  const cd = code(['1  (x->llink)->rlink = x->rlink;', '2  (x->rlink)->llink = x->llink;', '   delete x;'], -3.4, 6.0, 0.6);
  let L = null, X = null, R = null, D = null, pre = [], a1 = [], a2 = [];
  await step(tok);                                   // 22:36 接著看 delete
  say('接著看 delete', '');
  await step(tok);                                   // 22:46 原本長這樣
  L = dn('左', -3.5, 0.5, 0, '#d64545'); X = dn('x', 0, 0.5, 0, '#c9a227'); R = dn('右', 3.5, 0.5, 0, '#2fc092');
  D = { nodes: [L, X, R], arr: [] }; dllDraw(D, false);
  glow(X.userData.D, RED);
  say('要把 x delete 掉', '原本長這樣');
  await step(tok);                                   // 23:06 紅色、綠色互指
  pre = [...poly([rOut(L), V3(-2.4, 1.6, 0), V3(2.4, 1.6, 0), lIn(R)], GHOST), ...poly([lOut(R), V3(2.4, 0.35, 1.2), V3(-2.4, 0.35, 1.2), rIn(L)], GHOST)];
  say('結果：紅色和綠色 node', 'pointer 要互相指到對方');
  await step(tok);                                   // 23:48 ①
  killAll(pre); cd.hl(0);
  a1 = poly([rOut(L), V3(-2.4, 1.6, 0), V3(2.4, 1.6, 0), lIn(R)], RLC);
  glow(L.userData.R, GOLD);
  say('① x 的 llink 是紅色 node', '紅色的 rlink 改指 x 的右邊');
  await step(tok);                                   // 24:12 綠色在 x->rlink
  say('綠色 node 的位置在哪？', '就在 x->rlink：(x->llink)->rlink = x->rlink');
  await step(tok);                                   // 24:28 ②
  glow(L.userData.R); cd.hl(1);
  a2 = poly([lOut(R), V3(2.4, 0.35, 1.2), V3(-2.4, 0.35, 1.2), rIn(L)], LLC);
  glow(R.userData.L, GOLD);
  say('② 綠色的 llink 要指向紅色', '');
  await step(tok);                                   // 24:43 紅色的資訊在 x->llink
  say('紅色的位置在哪？在 x->llink', '(x->rlink)->llink = x->llink');
  await step(tok);                                   // 25:01 兩行最右邊
  glow(R.userData.L); cd.hl(2);
  killAll(D.arr); fly(X, V3(0, 8, 4));
  say('兩行的最右邊：x 的 rlink、llink 所指的位置', '交給鄰居去指，x 就可以 delete');
  await step(tok);                                   // 25:37 delete 完成
  killAll(a1); killAll(a2); cd.hl(-1);
  dmove(L, -1.8); dmove(R, 1.8);
  D = { nodes: [L, R], arr: [] }; dllDraw(D, false);
  say('delete 就這樣完成', '只改兩個 pointer');
}]);

// yn0ZAifhyNM 25:49：好處與搜尋
FRAG.push(['llpeng34-dll-search', 'Doubly linked list 的好處與搜尋', async (tok) => {
  fresh([0, 6.5, 12], [0, 0.4, 0.8]);
  const V = [15, 12, 10, 7, 5, 3], s = 0.7, xs = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
  const D = { nodes: [dn('H', xs[0], 0.5, 0, '#8a8a8a', s)], arr: [], dz: 1.1 };
  V.forEach((v, k) => D.nodes.push(dn(v, xs[k + 1], 0.5, 0, colorFor(v), s)));
  const ring = ringAt(0.6);
  let cut = null, xm = null;
  await step(tok);                                   // 25:49 pointer 串起來，有 first
  tag('first', 'ptr', xs[1], 1.4);
  say('linked list：透過 pointer 串起來', '有頭端 first');
  await step(tok);                                   // 26:17 doubly 多一組 link
  dllDraw(D);
  say('doubly linked list：多了一組 link', '例子的數字為示意');
  await step(tok);                                   // 26:31 好處：斷掉
  cut = D.arr[2 * 2]; if (cut) cut.visible = false;
  xm = tag('✕', 'ptr alt', (xs[2] + xs[3]) / 2, 1.3);
  say('好處：如果某條 link 斷掉', '12 → 10 的 rlink 斷了');
  await step(tok);                                   // 26:40 另一個方向還原
  ring.visible = true;
  for (const k of [0, 6, 5, 4, 3]) { ring.position.set(xs[k], 0.05, 0); await beat(tok, 350); }
  say('還可以透過另一個方向找回來', 'H → 3 → 5 → 7 → 10');
  await step(tok);                                   // 26:48 找一個 element？
  ring.visible = false; if (cut) cut.visible = true; kill(xm);
  say('在 doubly linked list 上找一個 element', '要怎麼做？');
  await step(tok);                                   // 27:16 例：找 7
  say('例如：數字 7 有沒有在裡面？', '');
  await step(tok);                                   // 27:27 沒條件：一個一個檢查
  ring.visible = true;
  for (const k of [1, 2, 3, 4]) { ring.position.set(xs[k], 0.05, 0); glow(D.nodes[k].userData.D, GOLD); await beat(tok, 400); glow(D.nodes[k].userData.D); }
  say('沒有其他條件：跟 singly 一樣', '從左或從右一個一個檢查：15、12、10、7');
  await step(tok);                                   // 27:46 排序過（大到小）
  ring.visible = false;
  tag('大 → 小', 'idx', 0, 1.4);
  say('可不可以更好？insert 時就讓 list 排序', '從大到小');
  await step(tok);                                   // 28:04 依大小決定方向
  ring.visible = true;
  for (const k of [6, 5, 4]) { ring.position.set(xs[k], 0.05, 0); glow(D.nodes[k].userData.D, GOLD); await beat(tok, 400); glow(D.nodes[k].userData.D); }
  glow(D.nodes[4].userData.D, GREEN);
  say('看數字大小，判斷從左邊或右邊找比較快', '7 比較接近最小的 3 → 從右邊：3 次');
}]);

// yn0ZAifhyNM 28:17：檔案的 disk block
FRAG.push(['llpeng34-dll-disk', '檔案的 disk block 用 doubly linked list', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const bl = ['前段', '中段', '後段'];
  let f = null, D = null, sb = [], sa = [], ring = ringAt(0.8);
  await step(tok);                                   // 28:17 DB 課會講 file
  say('Doubly linked list 在 Database 課也會看到', '講到 file（檔案）');
  await step(tok);                                   // 28:38 檔案存在 disk
  f = cube('101.txt', '#c9b48e', [3.6, 0.8, 0.9], 0, 3.5, 0, 2);
  say('檔案是怎麼構成的？', '檔案存在 disk（磁碟）上');
  await step(tok);                                   // 28:48 最小單位 block
  say('disk 最小的組成單位：block', '');
  await step(tok);                                   // 29:10 item 是一個 disk block
  say('真的實作在檔案上時', '每個 item 存的其實是一個 disk block');
  await step(tok);                                   // 29:26 前段、中段、後段
  fly(f, V3(0, 6, 2));
  D = { nodes: [dn('H', -4.5, 0.5, 0.6, '#8a8a8a', 0.8)], arr: [], dz: 1.0 };
  bl.forEach((t, k) => D.nodes.push(dn(t, -1.5 + 3 * k, 0.5, 0.6, colorFor(k + 7), 0.8)));
  say('101.txt：前段、中段、後段', '分別放在不同的 disk block');
  await step(tok);                                   // 29:55 開檔、搜尋：doubly
  tag('doubly', 'ptr', -5.6, 0.6, 1.0);
  dllDraw(D);
  say('開檔、搜尋文字，都會用到 doubly linked list', '');
  await step(tok);                                   // 30:17 singly 也可以
  tag('singly', 'ptr', -5.6, 0.6, -2.4);
  sb = [-3, 0, 3].map((x, k) => cube(bl[k], colorFor(k + 7), [1.6, 0.7, 0.9], x, 0.35, -2.4));
  sa = [arrow(V3(-2.2, 0.4, -2.4), V3(-0.8, 0.4, -2.4), RLC), arrow(V3(0.8, 0.4, -2.4), V3(2.2, 0.4, -2.4), RLC)];
  say('用 singly linked list 可不可以？', '也可以');
  await step(tok);                                   // 30:35 停電、磁頭壞掉
  sa[0].visible = false; tag('✕', 'ptr alt', -1.5, 1.2, -2.4);
  const cut = D.arr[2]; if (cut) cut.visible = false; tag('✕', 'ptr alt', 0, 1.3, 0.6);
  say('可是停電、磁頭壞掉', '把一個 pointer 弄壞了');
  await step(tok);                                   // 30:40 singly 找不到
  tint(sb[1], GRAY); tint(sb[2], GRAY);
  say('singly：找不到下一個 disk block', '後面的 block 全部 missing');
  await step(tok);                                   // 30:47 doubly 比較不會 missing
  ring.visible = true;
  for (const k of [0, 3, 2]) { ring.position.set(D.nodes[k].userData.x, 0.05, 0.6); await beat(tok, 500); }
  say('doubly 多一些 link', '從 header 的 llink 往回走，比較不會 missing node');
  await step(tok);                                   // 31:10 DS 是 DB 的基礎
  ring.visible = false;
  say('DS 是 DB 的基礎', 'item 實際上可以是字串，也可以是 disk block');
}]);
  }

  // ═══ sqlin.js ═══
  {
// ─── R0MpXbuqfZM：林軒田 DSA Stack / Queue（postfix、迷宮、DFS/BFS） ───
// cued scenes: each `await step(tok)` waits until the lecturer says that sentence; beats are motion only.
const step = (tok) => ctx.step(tok);
const OPN = '#4b9ee2', OPR = '#dd8238', PAR = '#9b7ef4', OKC = '#2fc092', TODO = '#f2c46d', REDC = '#d64545';
const isOp = (t) => !!PREC[t] || t === 'neg' || t === '?:';
const tcol = (t) => (t === '(' || t === ')') ? PAR : isOp(t) ? OPR : OPN;
const disp = (t) => (t === '-' ? '−' : t === 'neg' ? '負' : t === '*' ? '×' : t === '/' ? '÷' : String(t));
const sx = (n, sp, i) => (i - (n - 1) / 2) * sp;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function tcube(t, x, y, z, sz = 0.6, dropH = 0) { const m = cube(disp(t), tcol(t), [sz * (String(t).length > 2 ? 1.5 : 1), sz * 0.8, sz], x, y, z, dropH); m.userData.t = t; return m; }
function ring(r = 0.5) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: '#c08a1f' }));
  m.rotation.x = Math.PI / 2; lab.world.add(m); return m;
}
function seg(a, b, color = '#b9a582') { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color })); lab.world.add(l); return l; }
// play evs[from..to) with apply(ev), spreading at most ~2.6 s of motion over them
async function chunk(tok, evs, from, to, apply, maxMs = 350) {
  const n = Math.max(1, to - from), ms = Math.min(maxMs, 2600 / n);
  for (let i = from; i < to && i < evs.length; i++) { await apply(evs[i], i); await beat(tok, ms); }
}
// a vertical stack column of value cubes at (x, z)
function col(x, z, opt = {}) {
  const dy = opt.dy || 0.56, size = opt.size || [1.2, 0.5, 1.0], y0 = opt.y0 || 0.3;
  const c = {
    items: [],
    push(t, color) { const m = cube(disp(t), color || tcol(t), size, x, y0 + c.items.length * dy, z, 4); m.userData.t = String(t); c.items.push(m); return m; },
    pop() { const m = c.items.pop(); if (m) fly(m, V3(2, 7, 3)); return m; },
    top() { return c.items[c.items.length - 1]; },
    clear() { c.items.forEach(kill); c.items = []; },
  };
  return c;
}
// infix → postfix trace: one event per action, with the token index it belongs to
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
// the stack conversion as a player: input row → operator stack → output row; play token by token
function i2p(toks, c) {
  const sz = c.sz || 0.6, n = toks.length;
  const inC = toks.map((t, i) => tcube(t, c.inX(i), 0.3, c.inZ, sz));
  const rg = ring(sz * 0.8); rg.position.set(c.inX(0), 0.03, c.inZ);
  const st = [], out = [], evs = i2pTrace(toks);
  const stY = (k) => 0.3 + k * sz * 0.92;
  let k = 0;
  function apply(ev) {
    if (ev.i < n) rg.position.set(c.inX(ev.i), 0.03, c.inZ); else rg.visible = false;
    out.forEach((m) => glow(m, null));
    if (ev.kind === 'out') { const m = inC[ev.i]; out.push(m); move(m, c.outX(out.length - 1), 0.3, c.outZ); }
    else if (ev.kind === 'push') { const m = inC[ev.i]; st.push(m); move(m, c.stX, stY(st.length - 1), c.stZ); }
    else if (ev.kind === 'pop') { const m = st.pop(); out.push(m); glow(m, GOLD); move(m, c.outX(out.length - 1), 0.3, c.outZ); }
    else if (ev.kind === 'lparen') { fly(st.pop()); fly(inC[ev.i]); }
  }
  return {
    inC, out, st, evs, rg,
    look(i) { rg.position.set(c.inX(i), 0.03, c.inZ); glow(inC[i], GOLD); },
    // play every event of tokens [a, b) (b = n + 1 includes the final pops)
    async toks(tok, a, b, maxMs = 450) {
      const from = evs.findIndex((e) => e.i >= a), to0 = evs.findIndex((e) => e.i >= b), to = to0 < 0 ? evs.length : to0;
      if (from < 0) return;
      for (let i = a; i < Math.min(b, n); i++) glow(inC[i], null);
      await chunk(tok, evs, Math.max(from, k), to, (e) => apply(e), maxMs); k = Math.max(k, to);
    },
    async toks1(tok, idx) { if (idx < k) return; apply(evs[idx]); k = idx + 1; await beat(tok, 450); },
    post() { return out.map((m) => m.userData.t); },
  };
}
// postfix evaluation as a player over an operand stack
function evalP(post, c) {
  const sz = c.sz || 0.6;
  const inC = post.map((t, i) => tcube(t, c.inX(i), 0.3, c.inZ, sz));
  const stk = col(c.stX, c.stZ, { size: [1.3, 0.5, 1.0] });
  const rg = ring(sz * 0.8); rg.position.set(c.inX(0), 0.03, c.inZ);
  const vals = [];
  const fmt = (v) => String(+(+v).toFixed(2));
  return {
    inC, stk, vals,
    async run(tok, a, b, maxMs = 450) {
      const ms = Math.min(maxMs, 2600 / Math.max(1, b - a));
      for (let i = a; i < b; i++) {
        const t = post[i]; rg.position.set(c.inX(i), 0.03, c.inZ); glow(inC[i], GOLD);
        if (!PREC[t]) { vals.push(Number(t)); stk.push(t); }
        else {
          const y = vals.pop(), x = vals.pop(); stk.pop(); stk.pop();
          const r = t === '+' ? x + y : t === '-' ? x - y : t === '*' ? x * y : t === '/' ? x / y : Math.pow(x, y);
          vals.push(r); stk.push(fmt(r), OKC);
        }
        await beat(tok, ms); glow(inC[i], null); tint(inC[i], GRAY);
      }
    },
  };
}
// match each postfix token to its (unused) position in the infix row
function slideOrder(toks, post) { const used = new Set(); return post.map((p) => { const i = toks.findIndex((t, k) => t === p && !used.has(k)); used.add(i); return i; }); }
// maze search with a container: events {key, adds[], goal}
function mazeEvents(kind, rnd) {
  const s = findCell('S'), cont = [s], par = { [s]: null }, mark = new Set([s]), evs = [];
  while (cont.length) {
    const key = kind === 'stack' ? cont.pop() : kind === 'queue' ? cont.shift() : cont.splice(Math.floor(rnd() * cont.length), 1)[0];
    const [r, c] = key.split(',').map(Number);
    if (MAZE[r][c] === 'G') { evs.push({ key, adds: [], goal: true, cont: [...cont] }); break; }
    const adds = [];
    for (const [dr, dc] of DIRS) { const k2 = (r + dr) + ',' + (c + dc); if (MAZE[r + dr][c + dc] !== '#' && !mark.has(k2)) { mark.add(k2); par[k2] = key; cont.push(k2); adds.push(k2); } }
    evs.push({ key, adds, cont: [...cont] });
  }
  return { evs, par };
}
// recursive maze visit order: events visit / back / goal
function mazeRecEvents() {
  const seen = new Set(), evs = []; let depth = 0;
  function visit(r, c) {
    const key = r + ',' + c; seen.add(key); evs.push({ type: 'visit', key, depth: depth++ });
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
      if (MAZE[nr][nc] === '#' || seen.has(k)) continue;
      if (MAZE[nr][nc] === 'G') { evs.push({ type: 'goal', key: k }); return true; }
      if (visit(nr, nc)) return true;
    }
    depth--; evs.push({ type: 'back', key }); return false;
  }
  const [r0, c0] = findCell('S').split(',').map(Number); visit(r0, c0);
  return evs;
}
// a maze stage with a notebook (container) shown as a column / row of labels
function mazeStage(cam) {
  fresh(cam || [1, 13, 9], [1, 0, 0.5]);
  mz.kind = 'stack'; enterMaze(); controls('');
  lab.frameCamera(cam || [1, 13, 9], [1, 0, 0.5]);
  let boxes = [], cur = null;
  const lbl = (k) => '(' + k + ')';
  return {
    show(list, kind) {
      boxes.forEach(kill); boxes = [];
      list.slice(-9).forEach((k, i) => boxes.push(kind === 'queue'
        ? cube(lbl(k), TODO, [1.25, 0.4, 0.5], 6.3, 0.2, -3.6 + i * 0.6)
        : cube(lbl(k), TODO, [1.25, 0.3, 0.55], 7.0, 0.15, 2.9 - i * 0.7)));   // grows away from the camera: seen from above, a tower in y would squash
    },
    visit(key) { if (cur) paint(cur, '#cfe8dc'); cur = key; paint(key, OKC); },
    path(par, goal) { let len = 0; for (let k = goal; k; k = par[k]) { paint(k, '#c08a1f'); len++; } return len - 1; },
  };
}

// ── 13:42 Q&A：running time 與時間複雜度 ──
FRAG.push(['sqlin-trend', '時間複雜度是趨勢，running time 是一點', async (tok) => {
  fresh([0, 5, 14], [0, 2.8, 0]);
  line(-6, 0.05, 6, 0.05); line(-6, 0.05, -6, 6.6);
  tag('資料量 n →', 'idx', 5, -0.3); tag('執行時間', 'idx', -6, 7);
  await step(tok);                                   // 13:46 時間怎麼變化
  say('時間複雜度：資料量增加時', '程式的執行時間怎麼變化？');
  await step(tok);                                   // 14:00 asymptotic notation：曲線的趨勢
  const P = []; for (let k = 0; k <= 20; k++) { const u = k / 20; P.push(V3(-6 + 12 * u, 0.05 + 6 * u * u, 0)); }
  for (let k = 1; k <= 20; k++) { seg(P[k - 1], P[k], '#dd8238'); if (k % 4 === 0) await beat(tok, 200); }
  tag('O(n²)', 'ptr alt', 4.6, 6.2);
  say('Asymptotic notation 看的是', '資料成長時這條曲線的趨勢');
  await step(tok);                                   // 14:13 running time 是曲線上一點
  const u0 = 0.55, px = -6 + 12 * u0, py = 0.05 + 6 * u0 * u0;
  cube('', '#c08a1f', [0.35, 0.35, 0.35], px, py, 0, 3);
  tag('這次實際跑的時間', 'ptr', px, py + 0.8);
  say('實際跑出來的 running time', '就是曲線上的某一個點');
  await step(tok);                                   // 14:37 從小一點的資料開始測
  fresh([0, 5, 14], [0, 2.8, 0]);
  say('知道趨勢，就能從小資料開始測', '');
  const rows = [['10 筆', 't', 1], ['100 筆', '≈ 100 t', 3], ['1,000 筆', '≈ 10,000 t', 5]], bars = [];
  const grow = async (k) => {
    const [nm, tl, h] = rows[k], x = -4.5 + k * 3;
    const b = lab.box('#4b9ee2', [1.3, 1, 1.3]); b.scale.y = 0.01; b.position.set(x, 0, 0); lab.world.add(b); bars.push(b);
    tag(nm, 'idx', x, 0, 1.3);
    await anim(tok, 700, (t) => { b.scale.y = h * t; b.position.y = h * t / 2; });
    tag(tl, 'idx', x, h + 0.4);
  };
  await step(tok);                                   // 14:53 平方關係：從 10 筆開始
  await grow(0);
  say('分析出平方關係：先測 10 筆', '');
  await step(tok);                                   // 15:02 10 倍資料 → 約 100 倍時間
  await grow(1);
  say('10 倍的資料量', '約 100 倍的執行時間（高度是對數尺度）');
  await step(tok);                                   // 15:10 1000 筆再 ×100
  await grow(2);
  say('1000 筆：再乘約 100', '');
  await step(tok);                                   // 15:18 一邊測正確、一邊估時間
  const g = ghostBox('#dd8238', 1.3, 6.4, 1.3); g.position.set(4.5, 3.2, 0);
  tag('最大資料？', 'idx', 4.5, 0, 1.3);
  say('一邊測程式是否正確', '一邊估計時限內跑不跑得完');
  await step(tok);                                   // 15:30 千萬別一開始就丟最大的
  const no = tag('✕ 一開始就丟最大的資料', 'ptr alt', 4.5, 6.9);
  say('千萬不要一開始就把最大的資料丟進去', '');
  await step(tok);                                   // 15:44 逐步放大
  txt(no, '估計：1 小時內跑得完嗎？');
  say('資料一點一點放大', '才有好的估計');
  await step(tok);                                   // 16:06 running time 是趨勢上的一點
  say('複雜度：趨勢的分析', 'running time：趨勢上的一點，可從小資料逼近');
}]);

// ── 19:32 Q&A：O(log n) 與 Divide and Conquer ──
FRAG.push(['sqlin-binsearch', 'Binary search：每次丟掉一半', async (tok) => {
  fresh([0, 7, 11], [0, 0.5, 0]);
  const A = [3, 8, 12, 17, 21, 25, 30, 34, 41, 47, 52, 58, 63, 70, 77, 85], T = 63;
  const X = (i) => sx(16, 0.82, i);
  const cs = A.map((v, i) => { tag(String(i), 'idx', X(i), 0, 0.8); return cube(v, '#4b9ee2', [0.7, 0.6, 0.7], X(i), 0.3, 0); });
  await step(tok);                                   // 19:45 ordered array 的特性
  say('Binary search：在 ordered array 裡找', '例：找 ' + T);
  await step(tok);                                   // 19:52 最多 log n 個中間點
  let lo = 0, hi = 15, k = 0;
  const tm = tag('mid', 'ptr alt', 0, 1.9, -0.4);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; k++;
    tm.position.set(X(mid), 1.9, -0.4); glow(cs[mid], GOLD);
    await beat(tok, 350);
    if (A[mid] === T) { tint(cs[mid], OKC); break; }
    const [a, b] = A[mid] < T ? [lo, mid] : [mid, hi];
    for (let i = a; i <= b; i++) { tint(cs[i], GRAY); move(cs[i], X(i), 0.3, 1.6); }
    glow(cs[mid], null);
    if (A[mid] < T) lo = mid + 1; else hi = mid - 1;
    await beat(tok, 300);
  }
  say('只看了 ' + k + ' 個中間點就找到', '16 個數 → log₂16 = 4');
  await step(tok);                                   // 20:09 Divide and Conquer 家族
  tag('Divide and Conquer', 'ptr', 0, 3.2);
  say('Binary search 屬於更大的家族', 'Divide and Conquer');
  await step(tok);                                   // 20:14 大問題切成小問題
  const L = ghostBox('#4b9ee2', 6.4, 0.9, 1.4), R = ghostBox('#dd8238', 6.4, 0.9, 1.4);
  L.position.set(-3.3, 0.45, 0); R.position.set(3.3, 0.45, 0);
  say('把大問題切成小問題', '再分頭解決');
  await step(tok);                                   // 20:30 有一半可以丟掉
  R.visible = false; L.material.opacity = 0.05;
  tag('不在這半 → 整個丟掉', 'ptr alt', -3.3, 2.4);
  say('Binary search：切成兩半', '發現一半根本不含答案，丟掉');
  await step(tok);                                   // 20:44 只留下少數小問題
  say('切完沒有分散成很多個', '只留下少數小問題');
  await step(tok);                                   // 21:02 O(log n)
  tag('→ 常有 O(log n) 的特性', 'ptr', 0, 4.0);
  say('這類演算法分析起來', '常會有 O(log n) 的特性');
}]);

// ── 30:13 Stack 複習：LIFO 與頂端操作（stack-lifo 的 cued 版） ──
FRAG.push(['sqlin-lifo', 'Stack 複習：只在頂端操作', async (tok) => {
  fresh([0, 5, 12], [0, 1.6, 0]);
  const stk = col(-2.5, 0, { size: [2.2, 0.3, 2.2], dy: 0.34, y0: 0.15 });
  let top = null;
  await step(tok);                                   // 30:13 獨特的資料結構
  tag('Stack', 'ptr alt', -2.5, 4.4);
  say('Stack：在 computer science 裡', '有自己重要價值的資料結構');
  await step(tok);                                   // 30:32 先進後出，像電梯
  tag('先進後出（LIFO）', 'ptr', -2.5, 3.8);
  say('最重要的特性：先進後出', '像坐電梯：先進去的比較後出來');
  await step(tok);                                   // 30:54 一疊盤子
  for (let i = 0; i < 4; i++) { stk.push('', i % 2 ? '#efe6d6' : '#dcd0bb'); await beat(tok, 300); }
  top = tag('top', 'ptr', -0.8, 0.15 + 3 * 0.34);
  say('想成一疊盤子', '');
  await step(tok);                                   // 31:03 頂端放上去、拿下來
  stk.push('', '#f6e3c8'); top.position.y = 0.15 + 4 * 0.34;
  await beat(tok, 800);
  stk.pop(); top.position.y = 0.15 + 3 * 0.34;
  say('從頂端放上去（push）', '從頂端拿出來（pop）');
  await step(tok);                                   // 31:20 偷看頂端
  glow(stk.top(), GOLD);
  say('有的實作會讓你偷看頂端', '甚至偷看頂端好幾個（peek / top）');
  await step(tok);                                   // 31:28 所有運算都在頂端
  glow(stk.top(), null);
  tag('所有運算都在 top', 'ptr', 1.6, 2.4);
  say('所有容許的運算都在頂端發生', '壓在下面的不太管');
  await step(tok);                                   // 31:46 待辦事項
  ['報告', '洗衣服', '作業 2', '回信'].forEach((t, i) => tag(t, 'idx', -0.3, 0.15 + i * 0.34, 1.2));
  stk.items[0].material.transparent = true; stk.items[0].material.opacity = 0.35;
  say('像待辦事項：一件件壓上來', '壓在最下面的，可能早就忘了');
}]);

// ── 32:07 括號配對 ──
FRAG.push(['sqlin-paren', '括號配對：左括號 push、右括號 pop', async (tok) => {
  fresh([0, 6, 11], [-0.6, 1.2, 0]);
  tag('stack', 'ptr', 4, 0, 1.2);
  const s = '((a+b)*(c-d))', X = (i) => -6 + i * 0.6;
  const cs = [...s].map((ch, i) => cube(ch, ch === '(' || ch === ')' ? PAR : GRAY, [0.48, 0.45, 0.48], X(i), 0.25, 0));
  const stk = col(4, 0, { size: [1.1, 0.5, 1.0] });
  const rg = ring(0.35); rg.position.set(X(0), 0.03, 0);
  const doCh = (i) => {
    const ch = s[i]; rg.position.set(X(i), 0.03, 0);
    if (ch === '(') { const m = stk.push('(', PAR); m.userData.src = cs[i]; }
    else if (ch === ')') { const m = stk.top(); tint(cs[i], OKC); tint(m.userData.src, OKC); stk.pop(); }
  };
  await step(tok);                                   // 32:09 括號配對
  say('上次的入門演算法', '檢查 C 語言裡的括號配對');
  await step(tok);                                   // 32:19 最近看到的左括號找右括號
  say('幫「最近看到、還沒配對的左括號」', '找一個配對的右括號');
  await step(tok);                                   // 32:37 左括號 push；右括號和 top 配對
  for (let i = 0; i <= 6; i++) { doCh(i); await beat(tok, 300); }
  say('看到左括號：push', '看到右括號：和 stack top 的左括號配對、pop');
  await step(tok);                                   // 32:46 一路配下去
  for (let i = 7; i < s.length; i++) { doCh(i); await beat(tok, 300); }
  kill(rg);
  say('這樣一路配下去', '');
  await step(tok);                                   // 32:57 只看括號：平衡嗎
  say('只看括號：掃完 stack 是空的', '<span class="ok">balanced</span>');
  await step(tok);                                   // 33:27 array 或 linked list 實作
  cs.forEach(kill);
  tag('array', 'ptr', -4, 2.6); tag('linked list', 'ptr', 0, 2.6);
  say('Stack 可以用 array 或 linked list 實作', '');
  await step(tok);                                   // 33:35 top 放哪一端
  tag('top 放開頭還是尾巴？', 'ptr alt', -4, 1.9); tag('top 放 head 還是 tail？', 'ptr alt', 0, 1.9);
  say('細節：top 放在哪一端', 'push / pop 才會是 O(1)');
  await step(tok);                                   // 33:50 課本有寫
  say('這部分課本上有寫', '回去讀一讀');
  await step(tok);                                   // 34:09 compiler 的一小部分
  say('括號配對只是編譯器裡的一小部分', '今天看另一個重要應用');
}]);

// ── 35:14 A/B−C+D*E−A*C：先乘除後加減 ──
FRAG.push(['sqlin-infix-order', 'Infix：先乘除後加減的計算順序', async (tok) => {
  fresh([0, 6, 11], [0, 0.6, 0]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.85, i);
  let cs = [];
  const NUM = ['①', '②', '③', '④', '⑤', '⑥'];
  let k = 0;
  const mark = (op, a, b) => { for (let i = a; i <= b; i++) glow(cs[i], GOLD); tag(NUM[k++], 'ptr alt', X(op), 1.2); };
  const unmark = () => cs.forEach((m) => glow(m, null));
  await step(tok);                                   // 35:14 A/B−C+D*E−A*C
  cs = toks.map((t, i) => tcube(t, X(i), 0.3, 0, 0.66, 3));
  say('程式裡寫：A / B − C + D * E − A * C', '');
  await step(tok);                                   // 35:33 先乘除後加減
  say('小學老師教：先乘除、後加減', '');
  await step(tok);                                   // 35:44 先 A/B，再減 C
  mark(1, 0, 2); await beat(tok, 600); unmark(); mark(3, 0, 4);
  say('先做 A / B，再減 C', 't₁ = A / B、t₂ = t₁ − C');
  await step(tok);                                   // 36:08 看到 + 時
  unmark(); glow(cs[5], '#7a1010');
  say('看到 + 的時候', '能直接把前面的結果加 D 嗎？');
  await step(tok);                                   // 36:23 D 要先跟後面的乘
  glow(cs[5], null); mark(7, 6, 8);
  say('不行：D 要先跟後面的 * 算', 't₃ = D * E');
  await step(tok);                                   // 36:54 先乘才加，A*C 才減
  unmark(); mark(5, 0, 8); await beat(tok, 500); unmark(); mark(11, 10, 12); await beat(tok, 500); unmark(); mark(9, 0, 12);
  say('先 D * E 才做加法；先 A * C 才做減法', 't₄ = t₂ + t₃、t₅ = A * C、t₆ = t₄ − t₅');
  await step(tok);                                   // 37:03 一路的計算過程
  unmark();
  say('電腦需要一路的計算過程', '暫存中間的值');
  await step(tok);                                   // 37:24 翻譯成電腦看得懂的
  say('要把人看得懂的「先乘除後加減」', '翻譯成電腦看得懂的步驟');
}]);

// ── 37:42 Postfix：運算元不動，動作放後面 ──
FRAG.push(['sqlin-postfix-idea', 'Postfix：把運算子移到運算元後面', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.2, 0.4]);
  const toks = tokenize('A/B-C+D*E-A*C'), post = 'A B / C - D E * + A C * -'.split(' '), X = (i) => sx(13, 0.85, i);
  tag('infix（中序）', 'idx', 0, 0, -2.6); tag('postfix（後序）', 'idx', 0, 0, 3);
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.66));
  const ord = slideOrder(toks, post);
  let k = 0;
  const slide = async (upto) => { for (; k < upto; k++) { move(cs[ord[k]], X(k), 0.3, 1.8); await beat(tok, 260); } };
  await step(tok);                                   // 37:42 Postfix notation
  tag('Postfix notation', 'ptr alt', 0, 2.2, -2.6);
  say('新觀念：Postfix notation', '');
  await step(tok);                                   // 37:50 A B C D E 不動
  cs.forEach((m, i) => { if (!isOp(toks[i])) glow(m, GOLD); });
  say('A B C D E 不動', '');
  await step(tok);                                   // 38:06 動作放在數字後面
  cs.forEach((m) => glow(m, null));
  say('把動作（加減乘除）', '放在數字之後');
  await step(tok);                                   // 38:18 A / B → A B /
  await slide(3);
  say('A / B 寫成 A B /', '讀 A、讀 B、做除法');
  await step(tok);                                   // 39:34 再跟 C 相減
  await slide(5);
  say('結果跟 C 相減', 'A B / C −');
  await step(tok);                                   // 39:44 先做加的另一側
  await slide(8);
  say('先做出加號的另一側', 'D E *');
  await step(tok);                                   // 39:57 兩邊備好，做加法
  await slide(9);
  say('兩邊都準備好了：做加法', '');
  await step(tok);                                   // 40:09 A C *，最後相減
  await slide(13);
  say('再算 A C *，最後相減', 'A B / C − D E * + A C * −');
  await step(tok);                                   // 40:41 post = 後面
  say('Post 是「後面」', '動作放在後面');
  await step(tok);                                   // 40:56 先備好再下指令
  say('先準備好要算的東西', '再下指令');
  await step(tok);                                   // 41:03 A B C D E 順序一樣
  cs.forEach((m, i) => { if (!isOp(toks[i])) glow(m, GOLD); });
  say('A B C D E 出現的順序', '跟原來一模一樣');
  await step(tok);                                   // 41:20 只移動 operator
  cs.forEach((m, i) => glow(m, isOp(toks[i]) ? GOLD : null));
  say('只是把 operator 移到適當位置', '電腦到那個時間點就做事');
  await step(tok);                                   // 41:59 平常叫 infix
  cs.forEach((m) => glow(m, null));
  say('平常的寫法叫 infix（中序）', '');
}]);

// ── 42:08 人工法：加括號再換位置（3/4−5+6*7−8*9） ──
FRAG.push(['sqlin-human-paren', '人工轉換：加括號、括號內換成 postfix', async (tok) => {
  fresh([0, 7.5, 11], [0, 0.2, 0.4]);
  const toks = tokenize('3/4-5+6*7-8*9'), post = '3 4 / 5 - 6 7 * + 8 9 * -'.split(' '), X = (i) => sx(13, 0.85, i), Z = -1.2;
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, Z, 0.62));
  const boxes = [], blue = [];
  function wrap(a, b, color, pad, h) { const g = ghostBox(color, X(b) - X(a) + 0.7 + pad, h, h); g.position.set((X(a) + X(b)) / 2, h / 2, Z); boxes.push(g); return g; }
  const ord = slideOrder(toks, post);
  let k = 0;
  const slide = async (upto) => { for (; k < upto; k++) { move(cs[ord[k]], X(k), 0.3, 2.2); await beat(tok, 300); } };
  await step(tok);                                   // 42:08 infix 中間、postfix 後面
  say('Infix：運算子在中間', 'Postfix：運算子在後面');
  await step(tok);                                   // 42:25 給人用的演算法
  say('先來一個「給人用」的演算法', '例：3 / 4 − 5 + 6 * 7 − 8 * 9');
  await step(tok);                                   // 42:32 先乘除的括起來
  for (const [a, b] of [[0, 2], [6, 8], [10, 12]]) wrap(a, b, '#4b9ee2', 0.15, 0.9);
  say('藍括號：先做的先括起來', '(3/4)　(6*7)　(8*9)');
  await step(tok);                                   // 42:52 其他從左到右一層層
  [[0, 4, 0.4, 1.15], [0, 8, 0.65, 1.4], [0, 12, 0.9, 1.65]].forEach(([a, b, p, h]) => wrap(a, b, '#d64545', p, h));
  say('紅括號：其餘從左到右一層層括', '');
  await step(tok);                                   // 43:00 每個括號三樣東西
  say('每個括號裡恰好三樣東西', '左運算元、右運算元、動作');
  await step(tok);                                   // 43:47 括號內換成 postfix
  [['3 4 /', 1], ['6 7 *', 7], ['8 9 *', 11]].forEach(([t, i]) => blue.push(tag(t, 'ptr', X(i), 1.3, Z)));
  say('在每個括號裡換成 postfix', '3 4 /　6 7 *　8 9 *');
  await step(tok);                                   // 44:11 紅括號：3 4 / 5 −
  blue.forEach(kill);
  await slide(5);
  say('紅括號也一樣', '(3 4 /) 5 −');
  await step(tok);                                   // 44:29 6 7 * 再加
  await slide(9);
  say('6 7 * 做完再加', '… 6 7 * +');
  await step(tok);                                   // 44:38 8 9 * 再減
  await slide(13);
  say('8 9 * 做完再減', '… 8 9 * −');
  await step(tok);                                   // 44:51 考試解題
  say('考試手算短式子時', '這個方法很好用');
  await step(tok);                                   // 45:55 括號不需要，只是輔助
  boxes.forEach(kill);
  say('括號只是輔助圈出範圍', '轉完就拿掉：3 4 / 5 − 6 7 * + 8 9 * −');
  await step(tok);                                   // 46:10 人做不難
  say('式子不長的話', '人可以跳躍式地做，不難');
  await step(tok);                                   // 46:48 電腦做不容易
  say('但要寫成電腦的演算法', '把括號插對地方，不太容易');
  await step(tok);                                   // 47:08 用 stack 好好做
  say('怎麼用 Stack 來好好做？', '');
}]);

// ── 47:30 Postfix 求值：最近的兩個數字（postfix-eval 的 cued 版之一） ──
FRAG.push(['sqlin-pfeval-near', 'Postfix 求值：抓最近的兩個數字', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0.6]);
  const post = '3 4 / 5 - 6 7 * + 8 9 * -'.split(' '), X = (i) => sx(13, 0.85, i);
  let cs = [];
  const res = (t, i, z = 1.6) => cube(t, OKC, [1.2, 0.5, 0.8], X(i), 0.25, z, 3);
  const wait = tag('等候區', 'idx', -5.4, 0, 3.6);
  const done = [];
  const hlr = (a, b) => { for (let i = a; i <= b; i++) glow(cs[i], GOLD); };
  const unh = () => cs.forEach((m) => glow(m, null));
  await step(tok);                                   // 47:30 已經拿到 postfix
  cs = post.map((t, i) => tcube(t, X(i), 0.3, -1.2, 0.62, 3));
  say('先想：已經拿到 postfix', '電腦怎麼有效率地求值？');
  await step(tok);                                   // 47:54 由左到右
  const rg = ring(0.5); rg.position.set(X(0), 0.03, -1.2);
  say('由左到右', '讀資料、下動作、讀資料、下動作');
  await step(tok);                                   // 48:09 3 4 / → 0.75
  rg.position.x = X(2); hlr(0, 2);
  done.push(res('0.75', 2));
  say('3 4 ÷：讀出 3 和 4', '得到 0.75');
  await step(tok);                                   // 48:17 0.75 5 − → −4.25
  unh(); rg.position.x = X(4); hlr(3, 4);
  kill(done.pop()); done.push(res('−4.25', 4));
  say('0.75 5 −', '得到 −4.25');
  await step(tok);                                   // 48:25 6 7 * → 42
  unh(); rg.position.x = X(7); hlr(5, 7);
  const r42 = res('42', 7);
  say('6 7 ×', '得到 42');
  await step(tok);                                   // 48:33 −4.25 還不知道要怎麼辦
  move(done[0], -5.4, 0.25, 2.8);
  say('−4.25 還不知道要跟 42 做什麼', '先存在某個地方');
  await step(tok);                                   // 48:49 加起來 37.75
  unh(); rg.position.x = X(8); glow(cs[8], GOLD);
  kill(done.pop()); kill(r42); done.push(res('37.75', 8));
  say('看到 +：加起來', '37.75');
  await step(tok);                                   // 48:58 37.75 等 8 9 *
  unh(); rg.position.x = X(11); hlr(9, 11);
  move(done[0], -5.4, 0.25, 2.8);
  const r72 = res('72', 11);
  say('37.75 在等候區等著', '8 9 × = 72');
  await step(tok);                                   // 49:06 最後做減法
  unh(); rg.position.x = X(12); glow(cs[12], GOLD);
  kill(done.pop()); kill(r72); res('−34.25', 12);
  say('最後做減法', '= −34.25');
  await step(tok);                                   // 49:25 存的地方要有順序
  unh(); kill(rg);
  say('存起來的東西不能亂存', '要保持一定的順序');
  await step(tok);                                   // 49:42 抓最近算好的兩個數字
  say('看到運算符號時', '抓的是「最近」算好的兩個數字');
  await step(tok);                                   // 50:00 像括號配對的「最近」
  say('「最近」：括號配對也是找最近的左括號', '');
  await step(tok);                                   // 50:16 → Stack
  tag('最近的先處理 → Stack', 'ptr alt', 0, 2.6);
  say('遠一點的先存起來', '用 Stack');
}]);

// ── 50:32 用 operand stack 走一遍（postfix-eval 的 cued 版之二） ──
FRAG.push(['sqlin-pfeval-walk', '用 operand stack 走一遍', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.6, 0]);
  const post = '3 4 / 5 - 6 7 * + 8 9 * -'.split(' '), X = (i) => sx(13, 0.85, i);
  tag('operand stack', 'ptr', 4.6, 0, 1.4);
  const ev = evalP(post, { inX: X, inZ: -2.2, stX: 4.6, stZ: 0, sz: 0.6 });
  const pending = async (i, popOnly) => { // the operator at i: glow the two operands first
    glow(ev.inC[i], GOLD); ev.stk.items.slice(-2).forEach((m) => glow(m, GOLD)); await beat(tok, 500);
  };
  await step(tok);                                   // 50:33 stack 空；放 3、放 4
  await ev.run(tok, 0, 2);
  say('一開始 stack 是空的', '先放 3，再放 4');
  await step(tok);                                   // 50:42 看到 ÷：3、4 出來
  await pending(2);
  say('看到 ÷：3 出來、4 出來', 'pop 兩個');
  await step(tok);                                   // 50:51 0.75 放回去
  await ev.run(tok, 2, 3);
  say('除完得到 0.75', '放回 stack');
  await step(tok);                                   // 51:03 再看到 5
  await ev.run(tok, 3, 4);
  say('再看到 5：push', '');
  await step(tok);                                   // 51:12 減：0.75 − 5
  await ev.run(tok, 4, 5);
  say('看到 −：0.75 和 5 叫出來相減', '放回 −4.25');
  await step(tok);                                   // 51:30 6、7 推進去
  await ev.run(tok, 5, 7);
  say('又來了 6、又來了 7', '數字一路推進去');
  await step(tok);                                   // 51:48 乘：塞回 42
  await ev.run(tok, 7, 8);
  say('看到 ×：6 和 7 叫出來', '乘完塞回 42');
  await step(tok);                                   // 51:59 −4.25 和 42；看到 +
  glow(ev.inC[8], GOLD); ev.stk.items.forEach((m) => glow(m, GOLD));
  say('stack 裡有 −4.25 和 42', '看到 +');
  await step(tok);                                   // 52:09 加起來 37.75
  await ev.run(tok, 8, 9);
  say('42 出來、−4.25 出來', '加起來塞回 37.75');
  await step(tok);                                   // 52:20 唯一 element
  glow(ev.stk.items[0], GOLD);
  say('37.75 是唯一的 element', '既是最底端，也是最頂端');
}]);

// ── 52:35 一般化：需要幾個就 pop 幾個 ──
FRAG.push(['sqlin-postfix-arity', 'Postfix 求值：運算子要幾個運算元就 pop 幾個', async (tok) => {
  fresh([0, 6, 12], [0, 1.8, 0]);
  const cd = code(['for x in postfix（左→右）:', '  number:   push(x)', '  operator: pop 它需要的個數，算完 push'], -2.4, 6.0, 0.55);
  tag('operand stack', 'ptr', 3, 0, 1.3);
  let cs = [], stk = null, rg = null;
  const X = (i) => -5.2 + i * 1.25;
  function setup(toks) { cs.forEach(kill); if (stk) stk.clear(); cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.8)); stk = col(3, 0, { size: [1.3, 0.5, 1.0] }); if (!rg) rg = ring(0.6); }
  async function num(i) { rg.position.set(X(i), 0.03, -1.6); stk.push(cs[i].userData.t); await beat(tok, 400); }
  async function op(i, k, f) {
    rg.position.set(X(i), 0.03, -1.6); glow(cs[i], GOLD);
    const args = stk.items.slice(-k).map((m) => Number(m.userData.t));
    stk.items.slice(-k).forEach((m) => glow(m, GOLD)); await beat(tok, 600);
    for (let j = 0; j < k; j++) stk.pop();
    stk.push(f(args), OKC); await beat(tok, 500); glow(cs[i], null);
  }
  await step(tok);                                   // 52:44 數字丟進去、動作抓出來
  say('Postfix evaluation 非常單調而簡單', '看到數字丟進 stack；看到動作，抓數字出來算');
  await step(tok);                                   // 53:16 從左掃到右，不回頭
  cd.hl(0);
  say('從左掃到右', '完全不用回頭');
  await step(tok);                                   // 53:24 number：丟進 stack
  cd.hl(1);
  say('是 number：丟到 stack', '');
  await step(tok);                                   // 53:31 operator：拿需要的個數
  cd.hl(2);
  say('是 operator：從 stack 拿它需要的數量', '算完塞回去');
  await step(tok);                                   // 53:44 5 乘以 −3：負號
  setup(['5', '3', 'neg', '*']);
  await num(0); await num(1);
  say('例：5 × (−3)', 'postfix：5 3 負 ×');
  await step(tok);                                   // 53:52 負號只要一個
  await op(2, 1, (a) => -a[0]);
  await op(3, 2, (a) => a[0] * a[1]);
  say('負號只接一個數字：只 pop 1 個', '× 再 pop 2 個：5 × (−3) = −15');
  await step(tok);                                   // 54:07 ?: 接三個
  setup(['1', '7', '9', '?:']);
  await num(0); await num(1); await num(2);
  say('C 的 ?: 接三個東西', '條件、true 的結果、false 的結果');
  await step(tok);                                   // 54:25 pop 三個
  await op(3, 3, (a) => (a[0] ? a[1] : a[2]));
  say('pop 三個出來，算完塞回', '1 ? 7 : 9 = 7');
  await step(tok);                                   // 54:41 只剩一個 element
  glow(stk.items[0], GOLD);
  say('順利跑完：stack 只剩一個 element', '它就是整個運算式的結果');
  await step(tok);                                   // 55:08 還沒講怎麼轉
  cd.hl(-1);
  say('還沒講：怎麼從 infix', '好好翻譯成 postfix');
  await step(tok);                                   // 55:19 精神
  say('數字推進 stack；看到動作就拿出來', '揉一揉、捏一捏、塞回去');
}]);

// ── 59:43 Q&A：十進位轉二進位需要 stack 嗎 ──
FRAG.push(['sqlin-binary', '十進位轉二進位：何時需要 stack', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0]);
  let n = 13;
  await step(tok);                                   // 59:43 十進位 → 二進位
  tag('13 → 二進位？', 'ptr alt', 0, 3.6);
  say('同學問：十進位翻成二進位', '會用到 stack 嗎？');
  await step(tok);                                   // 60:03 從最大的 2 的次方開始
  [8, 4, 2, 1].forEach((p, i) => tag(String(p), 'idx', -4.5 + i * 1.3, 0, -1.4));
  say('先找數字範圍', '從最大的 2 的次方開始：8、4、2、1');
  await step(tok);                                   // 60:12 for 迴圈一路輸出
  const outs = [];
  for (let i = 0; i < 4; i++) {
    const p = [8, 4, 2, 1][i], b = n >= p ? 1 : 0; if (b) n -= p;
    outs.push(cube(b, b ? OKC : GRAY, [0.9, 0.7, 0.9], -4.5 + i * 1.3, 0.35, 0, 3)); await beat(tok, 450);
  }
  say('跑個 for 迴圈一路輸出', '13 = 8 + 4 + 1 → 1101');
  await step(tok);                                   // 60:20 不需要額外儲存
  say('高位先算、高位先輸出', '不需要額外儲存 → 不用 stack');
  await step(tok);                                   // 60:43 先暫存再處理？
  say('但如果算出來要先暫存', '再做一些處理……');
  await step(tok);                                   // 61:01 低位先算出
  outs.forEach((m) => fly(m));
  tag('stack', 'ptr', 3, 0, 1.3);
  const stk = col(3, 0, { size: [1.1, 0.5, 1.0] });
  n = 13;
  while (n > 0) { stk.push(n % 2, n % 2 ? OKC : GRAY); n >>= 1; await beat(tok, 450); }
  say('如果一直除以 2：先算出最低位', '13 ÷ 2 … 餘數 1、0、1、1');
  await step(tok);                                   // 61:07 輸出要高位先 → stack
  const res = [];
  for (let i = 0; stk.items.length; i++) { const m = stk.items.pop(); res.push(m.userData.t); move(m, -4.5 + i * 1.3, 0.3, 1.2); await beat(tok, 400); }
  say('輸出卻要從高位到低位', '用 stack 反轉順序：' + res.join(''));
  await step(tok);                                   // 61:13 for 迴圈不一定需要
  say('能用 for 迴圈直接跑出來', '就不一定需要 stack');
}]);

// ── 79:57 人工法多次掃描 vs one-pass ──
FRAG.push(['sqlin-onepass', 'Infix → Postfix：想要只掃一次', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.75, i);
  const cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.58));
  const rg = ring(0.45); rg.position.set(X(0), 0.03, -1.6);
  const sweep = (ms) => anim(tok, ms, (t) => rg.position.set(X(0) + (X(12) - X(0)) * t, 0.03, -1.6));
  await step(tok);                                   // 78:58 expression parsing
  say('Stack 的最後一小段', 'expression parsing');
  await step(tok);                                   // 79:07 infix → postfix
  say('要做的：infix 轉成 postfix', '');
  await step(tok);                                   // 79:21 不想用 human algorithm
  say('不想用 human algorithm', '加括號、轉換、再拆括號');
  await step(tok);                                   // 79:36 掃很多次
  const lab4 = tag('', 'idx', 0, 0, -2.6);
  for (const p of ['加括號', '轉換', '拆括號']) { txt(lab4, '掃描：' + p); await sweep(750); }
  say('那樣要把式子掃很多次', 'multiple pass');
  await step(tok);                                   // 79:49 能不能掃一次
  kill(lab4);
  say('能不能只掃一次？', '');
  await step(tok);                                   // 79:56 one-pass algorithm
  rg.material.color.set(OKC);
  await sweep(1600);
  tag('one-pass algorithm', 'ptr alt', 0, 1.4, -1.6);
  say('從左到右掃一次就完成', 'one-pass algorithm');
  await step(tok);                                   // 80:07 省時間
  say('掃一次就讀完', '比掃很多次省時間');
  await step(tok);                                   // 80:18 從式子觀察
  say('先從剛才的式子來觀察', '');
}]);

// ── 80:30 觀察：運算子什麼時候可以輸出（infix-to-postfix 的 cued 版之一） ──
FRAG.push(['sqlin-i2p-observe', '觀察：運算子什麼時候可以輸出', async (tok) => {
  fresh([0, 6.5, 12.5], [0, 1.2, 0.3]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.72, i);
  tag('先存起來（stack）', 'ptr', 5, 0, 1.2); tag('output', 'idx', -5.6, 0, 3.6);
  const P = i2p(toks, { inX: X, inZ: -2.6, outX: X, outZ: 2.8, stX: 5, stZ: 0, sz: 0.56 });
  await step(tok);                                   // 80:30 有時要先看後面
  say('只掃一次的話', '有時要先看看後面，才能決定前面');
  await step(tok);                                   // 80:46 數字順序沒變
  P.inC.forEach((m, i) => { if (!isOp(toks[i])) glow(m, GOLD); });
  say('數字的順序沒變', '只要決定符號移到哪');
  await step(tok);                                   // 81:09 先讀 A
  P.inC.forEach((m) => glow(m, null));
  await P.toks(tok, 0, 1);
  say('先讀 A：直接輸出', '');
  await step(tok);                                   // 81:18 讀到 ÷：還不知道
  P.look(1);
  say('讀到 ÷：還不知道要做什麼', '後面可能有更優先的事');
  await step(tok);                                   // 81:47 看到 ÷ 先存起來
  await P.toks(tok, 1, 2);
  say('看到 ÷ 時，無論如何先存起來', '要等看到 B 才能輸出');
  await step(tok);                                   // 82:10 讀到 B
  await P.toks(tok, 2, 3);
  say('A ÷ B：三個都讀了', '直到看到 − 才知道');
  await step(tok);                                   // 82:35 看到 −：優先序比 ÷ 低
  P.look(3);
  say('看到 −：優先序比 ÷ 低', '');
  await step(tok);                                   // 83:02 A ÷ B 意念完整 → 輸出
  await P.toks(tok, 3, 4);
  say('A ÷ B 的意念已經完整', '輸出 A B ÷；− 先存起來');
  await step(tok);                                   // 83:22 又看到 C
  await P.toks(tok, 4, 5);
  say('又看到 C：輸出', '');
  await step(tok);                                   // 83:30 看到 +：同優先序
  P.look(5);
  say('看到 +：和 − 同優先序', '規定從左做到右');
  await step(tok);                                   // 83:55 C − 可以出來
  await P.toks(tok, 5, 6);
  say('所以 − 可以出來', '+ 先存著');
  await step(tok);                                   // 84:24 看到 ×
  await P.toks(tok, 6, 7); P.look(7);
  say('D 輸出；看到 ×', '還不知道 × 後面是什麼');
  await step(tok);                                   // 84:48 + 不能出來
  say('+ 能出來嗎？不行', '× 的優先序比較大');
  await step(tok);                                   // 85:14 + 和 × 都先放著
  await P.toks(tok, 7, 9);
  say('+ 和 × 都暫時放著', 'E 輸出');
  await step(tok);                                   // 85:24 看到後面的 −
  P.look(9);
  say('看到後面的 −', '');
  await step(tok);                                   // 85:32 × 可以出來
  await ev0(P, tok, 9, 1);
  say('確定 × 可以做了', '× 先出來');
  await step(tok);                                   // 85:41 + 也可以出來
  await ev0(P, tok, 9, 2);
  say('回頭看 +：同優先序，也可以出來', '− 再壓進去');
  await step(tok);                                   // 85:49 結果
  say('到這裡的輸出', 'A B ÷ C − D E × +');
}]);
// play the first `upto` events (count) of token i, continuing where the player stopped
async function ev0(P, tok, i, upto) {
  const evs = P.evs.filter((e) => e.i === i);
  if (!P._done) P._done = {};
  const d = P._done[i] || 0;
  for (let j = d; j < Math.min(upto, evs.length); j++) {
    const all = P.evs.indexOf(evs[j]);
    await P.toks1(tok, all);
  }
  P._done[i] = Math.max(d, upto);
}

// ── 86:13 為什麼存在 stack：最近存入的先處理 ──
FRAG.push(['sqlin-i2p-why', '運算子先存起來：最近存的最先處理', async (tok) => {
  fresh([0, 6, 12], [0, 1.6, 0.4]);
  const OX = (k) => -5.2 + k * 0.72;
  const done = ['A', 'B', '/', 'C', '-', 'D', 'E'];
  done.forEach((t, k) => tcube(t, OX(k), 0.3, 2.6, 0.58));
  tag('output', 'idx', -5.6, 0, 3.5); tag('A/B−C+D*E −A*C', 'idx', -2.5, 0, -2.8);
  const stk = [];
  let k = done.length, inc = null;
  await step(tok);                                   // 86:14 + 和 × 存在哪
  for (const t of ['+', '*']) { const m = tcube(t, 2.5, 0.3 + stk.length * 0.56, 0, 0.62, 4); stk.push(m); await beat(tok, 300); }
  say('+ 和 × 都要先存起來', '存在哪裡？');
  await step(tok);                                   // 86:22 存在 stack 上
  tag('stack', 'ptr', 2.5, 0, 1.2);
  say('存的地方就是 stack', '');
  await step(tok);                                   // 86:28 最近塞進去的最接近
  glow(stk[1], GOLD);
  say('後面要處理的', '和最近塞進去的東西最接近');
  await step(tok);                                   // 86:45 看到 −：先處理 ×
  inc = tcube('-', -2.5, 0.35, -1.4, 0.66, 3);
  const m1 = stk.pop(); move(m1, OX(k++), 0.3, 2.6); glow(m1, null);
  say('看到後面的 −', '先處理最近的 ×');
  await step(tok);                                   // 86:59 回頭處理 +
  const m2 = stk.pop(); glow(m2, GOLD); move(m2, OX(k++), 0.3, 2.6);
  say('最接近的完成後', '才回頭處理 +');
  await step(tok);                                   // 87:15 從後往回追
  glow(m2, null);
  say('從後面一路往回追', '像疫調追感染來源');
  await step(tok);                                   // 87:35 只看一次，不確定的先存
  move(inc, 2.5, 0.3, 0);
  say('只看一次；不確定的先存下來', '− 壓進 stack');
  await step(tok);                                   // 87:45 從後往回追 → stack
  tag('最後存的最先處理 → Stack', 'ptr alt', 0, 2.2, -1.4);
  say('輸出時從後往回追', '就用 Stack 來做');
}]);

// ── 88:04 演算法：pseudo code + stack ──
FRAG.push(['sqlin-i2p-rule', 'Infix → Postfix 的 stack 演算法（逐行）', async (tok) => {
  fresh([0, 6.5, 13], [0, 2.4, 0]);
  const cd = code(['for x in infix（左→右）:', '  運算元: 輸出 x', '  運算子:', '    while top 優先序 ≥ x:', '      輸出 pop()', '    push(x)', '掃完: pop 剩下的全部輸出'], -3.4, 6.2);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.72, i);
  tag('operator stack', 'ptr', 5, 0, 1.2); tag('output', 'idx', -5.6, 0, 3.6);
  const P = i2p(toks, { inX: X, inZ: -2.6, outX: X, outZ: 2.8, stX: 5, stZ: 0, sz: 0.56 });
  await step(tok);                                   // 88:04 stack 演算法
  say('有了這個觀念：一個 stack 演算法', '把 infix 轉成 postfix');
  await step(tok);                                   // 88:14 從左掃到右
  cd.hl(0);
  say('一個 for 迴圈：從左邊掃到右邊', '');
  await step(tok);                                   // 88:42 數字直接輸出
  cd.hl(1); await P.toks(tok, 0, 1);
  say('數字的順序兩邊一模一樣', '看到數字直接輸出');
  await step(tok);                                   // 89:20 operator：用 stack
  cd.hl(2); await P.toks(tok, 1, 2);
  say('看到 operator：用 stack', '÷：stack 空，直接 push');
  await step(tok);                                   // 89:27 看 stack 頂端的優先序
  cd.hl(3); await P.toks(tok, 2, 3); P.look(3);
  say('B 輸出；看到 −', '看 stack 頂端（最近還沒處理的）優先序');
  await step(tok);                                   // 89:37 頂端優先或一樣 → pop
  cd.hl(4); await P.toks(tok, 3, 4);
  say('頂端比較優先或一樣優先', '可以處理了：pop 出去輸出');
  await step(tok);                                   // 90:03 頂端 −、後面 +：也沒問題
  cd.hl(4); await P.toks(tok, 4, 6);
  say('C 輸出；看到 +', '頂端 − 一樣優先：pop');
  await step(tok);                                   // 90:23 頂端 +、後面 ×：壓上去
  cd.hl(5); await P.toks(tok, 6, 9);
  say('頂端是 +、後面看到 ×', '× 要先做：壓在上面');
  await step(tok);                                   // 91:05 while 可能做很多次
  cd.hl(3); P.look(9);
  say('這個 while 可能做很多次', '');
  await step(tok);                                   // 91:18 × 是快車，先出來
  await ev0(P, tok, 9, 1); cd.hl(4);
  say('看到 −：× 先 pop 出來', '');
  await step(tok);                                   // 91:26 + 也出來，再壓 −
  await ev0(P, tok, 9, 3); cd.hl(5);
  say('+ 比 − 早一步：也 pop', '跑到不能再跑，再把 − 壓上去');
  await step(tok);                                   // 91:42 大概十行
  cd.hl(-1);
  say('Pseudo code 大概十行', '');
  await step(tok);                                   // 91:50 剩下的
  await P.toks(tok, 10, 14);
  cd.hl(6);
  say('A、C 輸出，× 壓上去', '掃完：剩下的全部 pop');
  await step(tok);                                   // 92:15 很優先：壓在上面
  say('新來的很優先', '就壓在所有人上面');
  await step(tok);                                   // 92:20 不優先：先還債
  cd.hl(-1);
  say('不太優先：先把前面比較急的債還了', 'A B ÷ C − D E × + A C × −');
}]);

// ── 92:44 兩個 stack 合起來＝計算機 ──
FRAG.push(['sqlin-calc', '計算機：operator stack 轉換 + operand stack 求值', async (tok) => {
  fresh([0, 7.5, 13], [0, 1.4, 0.4]);
  const toks = tokenize('3*5+5566-126'), n = toks.length;
  const IX = (i) => sx(n, 0.9, i), OX = (k) => sx(n, 0.9, k);
  let P = null, E = null;
  await step(tok);                                   // 92:44 operator stack
  tag('operator stack：放動作', 'ptr', -5.6, 0, 1.4);
  say('轉換時用 operator stack', '放還沒處理的動作');
  await step(tok);                                   // 92:51 頂端最接近
  say('stack 頂端', '是最快需要處理的 operator');
  await step(tok);                                   // 93:04 operand stack
  tag('operand stack：放數字', 'ptr alt', 5.6, 0, 1.4);
  say('上一段求值用的是 operand stack', '要計算的數字放在上面');
  await step(tok);                                   // 93:23 計算暫存區
  say('operand stack 是計算暫存區', '像計算機的 memory，只是疊起來的');
  await step(tok);                                   // 93:39 operator stack：等著處理
  say('operator stack 放將要處理、還沒處理的動作', '等該處理時再拿出來');
  await step(tok);                                   // 93:58 合起來 = 計算機
  tag('兩個 stack ＝ 計算機', 'ptr', 0, 3.2, -3.6);
  say('兩個 stack 結合起來', '基本上就是一個計算機');
  await step(tok);                                   // 94:13 Google 搜尋框打算式
  P = i2p(toks, { inX: IX, inZ: -2.4, outX: OX, outZ: 1.4, stX: -5.6, stZ: -0.2, sz: 0.58 });
  say('例：在 Google 搜尋框打', '3 × 5 + 5566 − 126');
  await step(tok);                                   // 94:30 ① infix → postfix
  await P.toks(tok, 0, n + 1, 260);
  say('① 搞懂式子：infix 翻成 postfix', P.post().map(disp).join(' '));
  await step(tok);                                   // 94:43 ② postfix evaluator
  const post = P.post(); P.out.forEach(kill);
  E = evalP(post, { inX: OX, inZ: 1.4, stX: 5.6, stZ: -0.2, sz: 0.58 });
  await E.run(tok, 0, post.length, 350);
  say('② postfix evaluator 算出來', '= <span class="ok">' + E.vals[0] + '</span>');
  await step(tok);                                   // 94:58 compiler 也用
  say('Compiler 從程式碼建立語意', '也用到這類 stack solution');
  await step(tok);                                   // 95:17 作業三
  say('照慣例：作業三很可能要寫計算機', '');
}]);

// ── 96:07 left / right associative、unary 減號 ──
FRAG.push(['sqlin-assoc', '同優先序：左結合要 pop，右結合壓上去', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.2, 0.2]);
  tag('left associative', 'ptr', -3.5, 2.6, -3.2); tag('right associative', 'ptr alt', 3.5, 2.6, -3.2);
  let L = null, R = null;
  await step(tok);                                   // 96:07 binary operator
  say('剛才的基本款：binary operator', '兩個運算元，運算子在中間');
  await step(tok);                                   // 96:23 left associative
  L = i2p(tokenize('A-B-C'), { inX: (i) => -3.5 + sx(5, 0.72, i), inZ: -2.2, outX: (i) => -3.5 + sx(5, 0.72, i), outZ: 2.2, stX: -0.7, stZ: 0, sz: 0.56 });
  await L.toks(tok, 0, 6, 300);
  say('left associative：一樣重要時左邊先算', '相等 → stack 裡的先出來：A B − C −');
  await step(tok);                                   // 96:35 right associative
  R = i2p(tokenize('A^B^C'), { inX: (i) => 3.3 + sx(5, 0.72, i), inZ: -2.2, outX: (i) => 3.3 + sx(5, 0.72, i), outZ: 2.2, stX: 6.2, stZ: 0, sz: 0.56 });
  say('有些 operator 是 right associative', '一樣優先時右邊先算');
  await step(tok);                                   // 97:02 一樣大：壓上去
  await R.toks(tok, 0, 6, 300);
  say('一樣大時不能出來：壓上去', 'A^B^C = A^(B^C) → A B C ^ ^');
  await step(tok);                                   // 97:20 unary、ternary
  say('Unary：接一個數字', 'Ternary：接三個');
  await step(tok);                                   // 97:35 概念類似
  say('概念類似：數字先出', 'operator 等意念完整、比過優先序再出');
  await step(tok);                                   // 97:59 減還是負
  tag('5 * −3：減號？負號？', 'ptr alt', 0, 3.4, -1);
  say('困難處：打一個「−」', '到底是減還是負？');
  await step(tok);                                   // 98:14 特殊處理
  say('這個架構沒辦法乾淨處理', '需要一些特殊處理');
}]);

// ── 98:32 括號：左括號的兩種優先序（infix-to-postfix 的 cued 版之二） ──
FRAG.push(['sqlin-i2p-paren', '括號：左括號的兩種優先序', async (tok) => {
  fresh([0, 6.5, 12], [0, 1.4, 0.3]);
  const toks = tokenize('3*(5+7)'), X = (i) => sx(7, 0.9, i);
  tag('operator stack', 'ptr', 4.6, 0, 1.2); tag('output', 'idx', -4.6, 0, 3.4);
  let P = null;
  await step(tok);                                   // 98:32 括號怎麼做
  say('寫簡單計算機，只剩括號還沒講', '');
  await step(tok);                                   // 98:57 括號是最高優先序
  say('括號是最高優先序', '左括號右邊的東西要先通通算完');
  await step(tok);                                   // 99:26 例：3 × (5 + 7)
  P = i2p(toks, { inX: X, inZ: -2.4, outX: X, outZ: 2.6, stX: 4.6, stZ: 0, sz: 0.62 });
  say('例：3 × (5 + 7)', '');
  await step(tok);                                   // 99:40 × 放進去，( 也放進去
  await P.toks(tok, 0, 3);
  say('× 放進去；左括號一樣放進去', '');
  await step(tok);                                   // 99:49 壓在上面
  glow(P.st[1], GOLD);
  say('左括號壓在上面', '不讓之前的東西出來');
  await step(tok);                                   // 100:07 看到 +：壓在 ( 上
  glow(P.st[1], null);
  await P.toks(tok, 3, 5);
  say('看到 +：在括號裡要先算', '可以壓在左括號上面');
  await step(tok);                                   // 100:37 一夫當關
  glow(P.st[1], GOLD);
  say('左括號一夫當關', '下面的通通不要跑出來');
  await step(tok);                                   // 100:46 外面的都比它優先
  glow(P.st[1], null);
  say('還沒進 stack 的', '都比左括號優先');
  await step(tok);                                   // 100:56 右括號把左括號救出來
  await P.toks(tok, 5, 7);
  say('7 輸出；右括號出現', '+ 出來，把左括號「救出來」');
  await step(tok);                                   // 101:13 兩種優先序
  tag('「(」在 stack 外：最大（一定 push）', 'ptr', 0, 4.4, -2.4);
  tag('「(」在 stack 內：最小（誰都能壓上去）', 'ptr alt', 0, 3.8, -2.4);
  say('左括號：比 stack 裡的都大', '但比 stack 外的都小');
  await step(tok);                                   // 101:44 只有右括號能救它
  await P.toks(tok, 7, 8);
  say('只有右括號能救它出來', '這就是 parentheses matching：3 5 7 + ×');
}]);

// ── 102:15 整合三件事：一個簡單計算機 ──
FRAG.push(['sqlin-calc3', '整合三件事：一個簡單計算機', async (tok) => {
  fresh([0, 7.5, 13], [0, 1.4, 0.4]);
  const toks = tokenize('3*(5+7)'), n = toks.length;
  const IX = (i) => sx(n, 0.85, i), OX = (k) => sx(5, 0.85, k);
  tag('operator stack', 'ptr', -6, 0, 1.4); tag('operand stack', 'ptr alt', 6, 0, 1.4);
  let P = null;
  await step(tok);                                   // 102:18 ① parentheses matching
  tag('① 括號配對：右括號救出左括號', 'ptr', -3.5, 4.4, -3.4);
  say('一：parentheses matching', '右括號救出左括號');
  await step(tok);                                   // 102:28 ② 運算優先權
  tag('② 優先權：比較優先的先出來', 'ptr', -3.5, 3.8, -3.4);
  say('二：運算優先權', 'operator 丟進 stack，比較優先的先出來');
  await step(tok);                                   // 102:48 左括號的特殊優先權
  say('左括號有特殊的優先權', '比 stack 裡的都優先、比外面的都不優先');
  await step(tok);                                   // 103:00 ③ stack 算值
  tag('③ 求值：operand stack 暫存數字', 'ptr', -3.5, 3.2, -3.4);
  say('三：用 stack 算運算值', '暫存讀到、算完但還沒用到的數字');
  await step(tok);                                   // 103:15 整合起來
  P = i2p(toks, { inX: IX, inZ: -2.4, outX: OX, outZ: 2.4, stX: -6, stZ: 0.4, sz: 0.6 });
  await P.toks(tok, 0, n + 1, 300);
  say('整合起來：3 × (5 + 7)', '先轉成 ' + P.post().map(disp).join(' '));
  await step(tok);                                   // 103:22 四則運算計算機
  const post = P.post(); P.out.forEach(kill);
  const E = evalP(post, { inX: OX, inZ: 2.4, stX: 6, stZ: 0.4, sz: 0.6 });
  await E.run(tok, 0, post.length, 400);
  say('再求值：一個具體而微的計算機', '= <span class="ok">' + E.vals[0] + '</span>');
  await step(tok);                                   // 103:36 compiler 不只為 expression
  say('真正的 compiler 不會只為 expression 寫這個', '');
  await step(tok);                                   // 103:47 擴充成更複雜的 routine
  say('但這些概念可以擴充成', 'compiler 裡更複雜的 routine');
}]);

// ── 105:29 Q&A：為什麼要學 stack 版的轉換 ──
FRAG.push(['sqlin-onepass-qa', 'Q&A：為什麼要學 Stack 版的轉換', async (tok) => {
  fresh([0, 7.5, 12], [0, 0.4, 0.3]);
  const toks = tokenize('A/B-C+D*E-A*C'), X = (i) => sx(13, 0.75, i);
  let cs = toks.map((t, i) => tcube(t, X(i), 0.3, -1.6, 0.58));
  const rg = ring(0.45); rg.position.set(X(0), 0.03, -1.6);
  const sweep = (ms) => anim(tok, ms, (t) => rg.position.set(X(0) + (X(12) - X(0)) * t, 0.03, -1.6));
  await step(tok);                                   // 105:29 有比較好嗎
  say('同學問：infix to postfix 的 stack 方法', '有比較好嗎？跟什麼比？');
  await step(tok);                                   // 105:50 human algorithm
  tag('human algorithm：加括號 → 轉 → 拔括號', 'idx', 0, 0, -2.7);
  say('跟 human algorithm 比', '人看得懂');
  await step(tok);                                   // 106:13 插對括號、multiple pass
  for (let k = 0; k < 3; k++) await sweep(750);
  say('但電腦要把括號插對地方', '還可能要 multiple pass');
  await step(tok);                                   // 106:23 stack 版的原因
  say('教 stack 版的原因', '');
  await step(tok);                                   // 106:39 one-pass
  rg.visible = false; cs.forEach(kill);
  const P = i2p(toks, { inX: X, inZ: -1.6, outX: X, outZ: 2, stX: 6, stZ: 0, sz: 0.58 });
  await P.toks(tok, 0, 14, 130);
  say('stack 讓我們設計出有巧思的演算法', 'one-pass：輸入只讀一次');
  await step(tok);                                   // 106:59 處理最接近的那筆
  say('one-pass 裡常要暫存', '並優先處理「最接近」的那筆 → stack 很有用');
  await step(tok);                                   // 107:45 compiler 自己弄 stack
  tag('compiler：自己弄一個 stack', 'ptr', -3.5, 2.4, -2.6);
  say('Compiler 有時自己弄一個 stack', '');
  await step(tok);                                   // 107:54 recursive → system stack
  tag('或用 recursive call → system stack', 'ptr alt', 3.5, 2.4, -2.6);
  say('有時用 recursive call', '等於用了 system stack');
  await step(tok);                                   // 108:20 教育性質
  say('現在 infix to postfix 比較是教育性質', '幫助了解 stack 能做什麼');
}]);

// ── 109:46 Queue 預告：排隊（queue-fifo 的 cued 版之一） ──
FRAG.push(['sqlin-queue-intro', 'Queue 預告：排隊', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.2, 0]);
  await step(tok);                                   // 109:46 Queue
  tag('Queue', 'ptr alt', 0, 4.2);
  say('下一個資料結構：Queue', '');
  await step(tok);                                   // 110:02 難度更低
  say('對大家來說', '難度可能比 stack 更低');
  await step(tok);                                   // 110:22 排隊買口罩
  tag('窗口', 'ptr', -5.6, 1.9);
  cube('', '#c9b48e', [0.6, 1.6, 2.0], -6.2, 0.8, 0);
  for (let i = 0; i < 5; i++) { cube('', colorFor(i + 1), [0.7, 1.3, 0.7], -4.8 + i * 1.2, 0.65, 0, 4); await beat(tok, 300); }
  say('Queue 就是排隊', '像排隊買口罩');
  await step(tok);                                   // 111:07 搶票、選課系統
  tag('搶票系統', 'idx', 2.6, 2.6); tag('選課系統', 'idx', 4.8, 2.6);
  say('搶票、選課系統', '都需要排隊的概念');
  await step(tok);                                   // 111:30 再看一個 stack 演算法
  say('從 stack 切到 queue 的好方法', '先再看一個 stack 演算法');
  await step(tok);                                   // 111:53 不同 behavior
  tag('stack vs queue：放進演算法，行為不同', 'ptr', 0, 3.4, -1.2);
  say('Stack 和 Queue 放進演算法裡', '會有什麼不同的 behavior？');
  await step(tok);                                   // 112:16 資料結構搭配演算法
  say('資料結構和演算法', '一直是搭配著講');
}]);

// ── 114:29 迷宮問題：有沒有解 ──
FRAG.push(['sqlin-maze-problem', '迷宮問題：從入口走得到出口嗎', async (tok) => {
  mazeStage([0, 13, 9]);
  let arws = [];
  await step(tok);                                   // 114:29 走迷宮
  say('來走迷宮', '');
  await step(tok);                                   // 114:41 二維迷宮的格子點
  say('典型的二維迷宮', '每個點都是格子點');
  await step(tok);                                   // 115:06 上下左右能不能走
  const s = cellPos(1, 1).setY(0.6);
  for (const [dr, dc] of DIRS) {
    const r = 1 + dr, c = 1 + dc;
    if (MAZE[r][c] !== '#') arws.push(arrow(s, cellPos(r, c).setY(0.6), 0x2fc092));
    else arws.push(tag('✕', 'ptr', ...cellPos(r, c).setY(1.2).toArray()));
  }
  say('資訊簡化成：每個點的上下左右', '能不能走（箭頭 = 可走、✕ = 牆）');
  await step(tok);                                   // 115:21 從頭走到尾
  arws.forEach(kill);
  paint(findCell('S'), TODO); paint(findCell('G'), TODO);
  say('能不能找個演算法', '從迷宮的頭走到尾？');
  await step(tok);                                   // 115:49 有沒有解
  say('先簡化：到底有沒有路可以出來？', '迷宮有沒有解');
  await step(tok);                                   // 115:56 封起來就沒解
  const p = cellPos(6, 7);
  cube('', '#b9a582', [1.05, 0.9, 1.05], p.x, 0.45, p.z, 5);
  paint('6,7', '#e9c9c0');
  say('如果這裡封起來', '<span class="no">就沒有解</span>');
  await step(tok);                                   // 116:02 電腦怎麼判斷
  say('電腦怎麼判斷', '一個迷宮有沒有解？');
  await step(tok);                                   // 116:25 用 recursion
  say('其中一個做法', '用 recursion');
}]);

// ── 116:30 遞迴走迷宮 ──
// seen more from above, so the 16 frames of the system stack (a row in depth) stay apart
const REC_CAM = [1, 14, 5.5];
const recPlayer = () => {
  const evs = mazeRecEvents(), frames = [];
  const fz = (k) => 4.7 - k * 0.58;
  tag('system stack', 'ptr', 6, 0.4, 5.4);
  const apply = (e) => {
    if (e.type === 'visit') { paint(e.key, OKC); frames.push(cube('(' + e.key + ')', '#9b7ef4', [1.3, 0.3, 0.36], 6, 0.15, fz(frames.length))); }
    else if (e.type === 'back') { paint(e.key, '#e9c9c0'); kill(frames.pop()); }
    else { paint(e.key, '#c08a1f'); frames.forEach((f) => { tint(f, '#c08a1f'); paint(f.userData.lbl.element.textContent.slice(1, -1), '#c08a1f'); }); }
  };
  return { evs, frames, apply };
};
FRAG.push(['sqlin-maze-rec', '遞迴走迷宮：system stack 上是一條路', async (tok) => {
  mazeStage(REC_CAM);
  const R = recPlayer();
  const half = R.evs.findIndex((e, i) => e.type === 'back' && i > 4);
  await step(tok);                                   // 116:47 現在在 (i,j)
  glow(mz.tiles[findCell('S')], GOLD);
  say('想像現在站在 (i, j)', '');
  await step(tok);                                   // 117:07 有些走過、有些沒走過
  say('迷宮裡有些位置走過', '有些還沒走過');
  await step(tok);                                   // 117:17 走過的不要再走
  say('走過的不要再走', '不然會一直繞圈圈');
  await step(tok);                                   // 117:22 沒走過的試走一步
  say('還沒走過的', '試著往那邊走一步看看');
  await step(tok);                                   // 117:43 先標成走過
  glow(mz.tiles[findCell('S')], null);
  await chunk(tok, R.evs, 0, 1, R.apply);
  say('maze(i, j) 一呼叫', '先把這個位置標成「走過」');
  await step(tok);                                   // 118:04 試走一步：是出口就有解
  say('對每個沒走過、走得到的 (k, l)', '如果它就是出口 → 有解');
  await step(tok);                                   // 118:21 假裝從那裡出發：遞迴
  await chunk(tok, R.evs, 1, half + 1, R.apply, 250);
  say('不然就假裝從那裡出發', '遞迴呼叫 maze(k, l)；走不通就退回');
  await step(tok);                                   // 118:42 每一條都試過
  await chunk(tok, R.evs, half + 1, R.evs.length, R.apply, 200);
  say('迴圈把每一條路都試過', '這裡找到出口了');
  await step(tok);                                   // 118:51 都是死路就沒解
  say('如果每一條都是死路', '這個迷宮一定沒有解');
  await step(tok);                                   // 119:14 從起點出發，一路長下去
  R.frames.forEach((f) => glow(f, GOLD));
  say('從起點出發，recursion 一路長下去', 'system stack 上剛好是一條路（' + R.frames.length + ' 層）');
  await step(tok);                                   // 119:37 自然回到原來的地方
  R.frames.forEach((f) => glow(f, null));
  say('一條走不通，recursion 自然回到原來的地方', '再試第二條、第三條路');
  await step(tok);                                   // 119:55 recursion 與 system stack
  say('想想上次講的', 'recursion 跟 system stack 的關係');
}]);

// ── 120:05 自己的 stack 當記事本（maze-dfs 的 cued 版） ──
FRAG.push(['sqlin-maze-dfs', '迷宮：自己的 Stack 當記事本', async (tok) => {
  const M = mazeStage();
  const { evs, par } = mazeEvents('stack');
  let i = 0;
  const apply = (e) => { M.visit(e.key); e.adds.forEach((k) => paint(k, TODO)); M.show(e.cont, 'stack'); };
  await step(tok);                                   // 120:05 recursion 偷偷花空間
  say('Recursion 其實偷偷多花了空間', '系統給你的 system stack');
  await step(tok);                                   // 120:14 多拿一張計算紙
  say('每次 function 呼叫', '就多拿一張計算紙壓在上面');
  await step(tok);                                   // 120:50 自己的 stack
  tag('自己的 stack（記事本）', 'ptr', 6.3, 0.2, 3.6);
  say('不如自己存', '用自己的 stack');
  await step(tok);                                   // 121:00 存還沒探索過的點
  M.show([findCell('S')], 'stack'); paint(findCell('S'), TODO);
  say('自己的 stack 裡', '存「還沒探索過的點」');
  await step(tok);                                   // 121:41 標成 to-do
  await chunk(tok, evs, 0, 1, apply); i = 1;
  say('拿出起點，鄰居放進去', '標成 to-do：等一下會看，別人別再放');
  await step(tok);                                   // 122:26 像計畫本
  say('像一本計畫本：在 (i, j) 看到', '一堆可能可以走的 (k, l)，先記下來');
  await step(tok);                                   // 122:47 下一輪拿一個出來
  await chunk(tok, evs, 1, 4, apply, 500); i = 4;
  say('下一輪：從記事本拿一個出來', '走過去拜訪它');
  await step(tok);                                   // 123:03 還不是 to-do 的寫上去
  await chunk(tok, evs, 4, 8, apply, 450); i = 8;
  say('它的鄰居如果還不是 to-do', '就寫到記事本上');
  await step(tok);                                   // 123:31 recursive：一條路
  say('Recursive 版：system stack', '無時無刻維持一條正在探索的路');
  await step(tok);                                   // 123:52 自己的 stack：一堆計畫
  say('自己的 stack：放一堆', '計畫要看的 position');
  await step(tok);                                   // 124:08 拿最新寫上去的那筆
  await chunk(tok, evs, 8, evs.length, apply, 300);
  say('每次拿最新寫上去的那一筆', '一路往深處探索');
  await step(tok);                                   // 124:49 也可以寫自己的 stack
  const len = M.path(par, evs[evs.length - 1].key);
  say('recursion 偷偷用 stack；也可以自己寫 stack', '找到出口：這條路 ' + len + ' 步');
  await step(tok);                                   // 125:13 迷宮有沒有出口
  say('一樣能回答：', '這個迷宮到底有沒有出口');
}]);

// ── 138:20 為什麼要標 to-do：重複 entry ──
FRAG.push(['sqlin-todo', '放進 stack 時標 to-do：避免重複 entry', async (tok) => {
  fresh([0, 8, 11], [-0.8, 1.2, 0.3]);
  const R = 3, C = 3, X = (c) => -5.4 + c * 1.35, Z = (r) => -1.4 + r * 1.35;
  const tiles = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { tiles[r + ',' + c] = cube('', '#f3ead9', [1.2, 0.1, 1.2], X(c), 0.05, Z(r)); tag('(' + r + ',' + c + ')', 'idx', X(c), 0.3, Z(r)); }
  tag('stack（記事本）', 'ptr', 2.6, 0, 1.3);
  const info = tag('', 'ptr alt', 5.6, 0, -1.6);
  // build the event list of one run
  function events(useTodo) {
    const st = [], vis = new Set(), todo = new Set(), ev = [];
    let pushes = 0, dups = 0;
    const push = (k) => { const dup = st.includes(k); st.push(k); pushes++; if (dup) dups++; if (useTodo) todo.add(k); ev.push({ kind: 'push', k, dup, pushes, dups }); };
    push('2,0');
    while (st.length) {
      const k = st.pop();
      if (vis.has(k)) { ev.push({ kind: 'waste', k }); continue; }
      vis.add(k); ev.push({ kind: 'visit', k });
      const [r, c] = k.split(',').map(Number);
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc, k2 = nr + ',' + nc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C || vis.has(k2) || (useTodo && todo.has(k2))) continue;
        push(k2);
      }
    }
    return { ev, pushes, dups };
  }
  let stk = null, label = '';
  function reset(useTodo) { Object.values(tiles).forEach((t) => tint(t, '#f3ead9')); if (stk) stk.clear(); stk = col(2.6, 0, { size: [1.3, 0.42, 1.0], dy: 0.46 }); label = useTodo ? '有 to-do' : '無 to-do'; }
  const apply = (e) => {
    if (e.kind === 'push') { const m = stk.push('(' + e.k + ')', e.dup ? REDC : TODO); m.userData.k = e.k; tint(tiles[e.k], e.dup ? REDC : TODO); txt(info, label + '：push ' + e.pushes + '、重複 ' + e.dups); }
    else { const m = stk.items[stk.items.length - 1]; stk.pop(); tint(tiles[e.k], e.kind === 'waste' ? REDC : OKC); if (e.kind === 'waste') glow(m, RED); }
  };
  const A = events(false), B = events(true);
  let firstDup = A.ev.findIndex((e) => e.kind === 'push' && e.dup), firstWaste = A.ev.findIndex((e) => e.kind === 'waste');
  if (firstDup < 0) firstDup = Math.floor(A.ev.length / 3);
  if (firstWaste <= firstDup) firstWaste = Math.min(A.ev.length - 2, firstDup + Math.floor(A.ev.length / 3));
  const mid = Math.max(1, Math.floor(firstDup / 2));
  await step(tok);                                   // 138:21 為什麼標 to-do
  say('為什麼要把 (k, l) 標成 to-do？', '');
  await step(tok);                                   // 138:41 同一點兩種走法
  glow(tiles['1,1'], GOLD);
  say('同一個點', '可能有兩種方式走到');
  await step(tok);                                   // 139:14 從下面、從右邊
  const a1 = arrow(V3(X(1), 0.4, Z(2)), V3(X(1), 0.4, Z(1) + 0.4), 0x2fc092), a2 = arrow(V3(X(2), 0.4, Z(1)), V3(X(1) + 0.4, 0.4, Z(1)), 0x2fc092);
  say('例：可以從下面走上來', '也可以從右邊走過來');
  await step(tok);                                   // 139:33 沒標 to-do
  kill(a1); kill(a2); glow(tiles['1,1'], null);
  reset(false);
  await chunk(tok, A.ev, 0, mid, apply);
  say('沒標 to-do：只記 visited', '從 (2,0) 出發，依右、下、左、上');
  await step(tok);                                   // 139:51 又放進記事本一次
  await chunk(tok, A.ev, mid, firstDup + 1, apply);
  say('等一下從另一條路過來', '又把它放進記事本一次！');
  await step(tok);                                   // 140:06 重複的位置
  say('記事本裡出現重複的位置', '已經寫進記事本，但還沒 visit');
  await step(tok);                                   // 140:14 visit 是真正走到
  say('visit：真正走到那上面', '開始派出它的鄰居');
  await step(tok);                                   // 140:37 pop 出來要檢查 visited
  await chunk(tok, A.ev, firstDup + 1, firstWaste + 1, apply);
  say('重複的 pop 出來時', '得檢查是否 visited 過，是的話跳過');
  await step(tok);                                   // 141:06 redundancy
  await chunk(tok, A.ev, firstWaste + 1, A.ev.length, apply);
  say('多了 redundancy', '還要多寫 code 確保同一格不走兩次');
  await step(tok);                                   // 141:25 標 to-do
  reset(true);
  await chunk(tok, B.ev, 0, B.ev.length, apply);
  say('有標 to-do：同一格只進記事本一次', 'push ' + A.pushes + ' → ' + B.pushes + '，重複 ' + A.dups + ' → ' + B.dups);
  await step(tok);                                   // 141:49 無謂的計算
  say('否則同一格走第二次、鄰居又堆上去', '無謂的計算；有環的迷宮甚至一直繞');
}]);

// ── 156:57 Container：隨手抽一個的袋子 → random walk ──
FRAG.push(['sqlin-container', 'Container 換成隨機袋子：random walk', async (tok) => {
  const M = mazeStage();
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const { evs, par } = mazeEvents('random', rnd);
  const t1 = Math.floor(evs.length / 3), t2 = Math.floor(evs.length * 2 / 3);
  let bag = null, cnt = null;
  const apply = (e) => { M.visit(e.key); e.adds.forEach((k) => paint(k, TODO)); txt(cnt, '裡面 ' + e.cont.length + ' 格'); };
  await step(tok);                                   // 156:58 記事本
  say('更 general 來看', '走迷宮只是需要一本記事本');
  await step(tok);                                   // 157:04 最後寫的最先探索
  say('Stack 當記事本：', '最後寫進去的，最先探索');
  await step(tok);                                   // 157:14 一定要 stack 嗎
  say('記事本一定要用 stack 嗎？', '沒有');
  await step(tok);                                   // 157:30 container
  tag('container（容器）', 'ptr alt', 6, 2.4, -2.2);
  say('能當記事本、能裝東西的', '叫做 container');
  await step(tok);                                   // 157:45 array、list 不同容器
  say('array、linked list 都是不同的容器', '放進去、拿出來的方法不一樣');
  await step(tok);                                   // 158:04 隨便抽一個的袋子
  bag = ghostBox('#9b7ef4', 1.8, 1.6, 1.8); bag.position.set(6, 0.8, 0);
  tag('袋子', 'ptr', 6, 2.2, 0); cnt = tag('裡面 1 格', 'idx', 6, 0, 1.4);
  say('例：一個袋子', '東西丟進去，每次隨便抽一個出來');
  await step(tok);                                   // 158:31 每次抽一個
  await chunk(tok, evs, 0, t1, apply);
  say('每次從袋子抽一格出來', '看看從那裡能不能走');
  await step(tok);                                   // 159:15 喝醉酒
  await chunk(tok, evs, t1, t2, apply);
  say('像喝醉酒跌跌撞撞', '');
  await step(tok);                                   // 159:26 random walk
  await chunk(tok, evs, t2, evs.length, apply);
  const len = M.path(par, evs[evs.length - 1].key);
  say('random walk：好死不死找到出口', '這條路 ' + len + ' 步');
  await step(tok);                                   // 159:51 任何 container 都能動
  say('任何 container：能拿一個、塞一個', '有解一定找到，沒解一定回報');
  await step(tok);                                   // 160:15 behavior 不同
  say('但放不同 container', 'behavior 不一樣');
  await step(tok);                                   // 160:27 找出的路不同
  say('有很多條路時', '找出的那條路也可能不同');
  await step(tok);                                   // 160:51 換一個很不一樣的
  say('換一個跟 stack 特性', '非常不一樣的 container');
}]);

// ── 161:06 Queue：FIFO、enqueue 與 dequeue（queue-fifo 的 cued 版之二） ──
FRAG.push(['sqlin-queue-fifo', 'Queue：FIFO、enqueue 與 dequeue', async (tok) => {
  fresh([0, 5.5, 12], [0, 1.2, 0]);
  const QX = (i) => -4.6 + i * 1.3, line_ = [];
  let nv = 1;
  const add = (x0) => { const m = cube(nv, colorFor(nv), [0.9, 1.1, 0.9], QX(line_.length), 0.55, 0, 4); nv++; line_.push(m); return m; };
  await step(tok);                                   // 161:06 stack：LIFO
  const s1 = tag('Stack：Last In, First Out', 'idx', 4, 4.4);
  say('Stack 是 last in first out', '最後進去的最先出來');
  await step(tok);                                   // 161:16 queue：FIFO
  tag('Queue：First In, First Out', 'ptr alt', -2, 4.4);
  for (let i = 0; i < 4; i++) { add(); await beat(tok, 300); }
  say('Queue 就是排隊', 'first in first out');
  await step(tok);                                   // 161:28 印表機
  say('排前面的先買到票', '印表機：先送的先印');
  await step(tok);                                   // 161:47 後來的排後面
  add();
  say('後面來的', '請排在隊伍後面');
  await step(tok);                                   // 162:22 rear、front
  const fr = tag('front', 'ptr', QX(0), 1.6), rr = tag('rear', 'ptr alt', QX(4), 1.6);
  say('所以有 rear（後面）', '和 front（前面）');
  await step(tok);                                   // 162:39 售票口
  cube('', '#c9b48e', [0.6, 1.6, 2.0], -6.0, 0.8, 0); tag('售票口', 'idx', -6.0, 0, 1.4);
  say('這邊是售票口：front', '另一頭是 rear');
  await step(tok);                                   // 162:58 enqueue：insert at rear
  add(); rr.position.x = QX(5);
  say('Enqueue：放進去', 'insert at rear');
  await step(tok);                                   // 163:10 dequeue：remove from front
  const m = line_.shift(); fly(m, V3(-6, 6, 2));
  await beat(tok, 500);
  line_.forEach((x, i) => move(x, QX(i), 0.55, 0)); rr.position.x = QX(4);
  say('Dequeue：拿出來', 'remove from front');
  await step(tok);                                   // 163:35 只看前面是誰
  glow(line_[0], GOLD);
  say('也可以另外提供', '只看前面是誰的操作');
  await step(tok);                                   // 163:53 公平
  glow(line_[0], null);
  say('Queue 是一種相對公平的方式', '');
  await step(tok);                                   // 164:26 電腦按時間先後
  say('電腦裡要依時間先後處理事情時', '也會用 queue');
}]);

// ── 164:49 Circular array：0~9 首尾相接 ──
FRAG.push(['sqlin-circ10', 'Circular array：10 格首尾相接', async (tok) => {
  fresh([0, 11, 9], [0, 0, 0.4]);
  const N = 10, P = (i, r = 3.8) => { const a = Math.PI / 2 - (i / N) * Math.PI * 2; return V3(Math.cos(a) * r, 0, -Math.sin(a) * r); };
  await step(tok);                                   // 164:49 queue 怎麼實作
  say('課本講到 Queue 要怎麼 implement', '');
  await step(tok);                                   // 164:54 circular array
  for (let i = 0; i < N; i++) { const p = P(i); cube('', '#e9dcc4', [1.3, 0.08, 1.3], p.x, 0.02, p.z); }
  say('其中一種：circular array', '');
  await step(tok);                                   // 165:05 0 號到 9 號
  for (let i = 0; i < N; i++) { const q = P(i, 5.1); tag('[' + i + ']', 'idx', q.x, 0.1, q.z); }
  say('array：0 號到 9 號', '10 個位置');
  await step(tok);                                   // 165:15 繞完繼續繞
  const rg = ring(0.75);
  for (let k = 0; k <= 13; k++) { const p = P(k % N); rg.position.set(p.x, 0.05, p.z); await beat(tok, 180); }
  say('0 到 9 繞完', '再從 0 繼續繞下去');
  await step(tok);                                   // 165:31 抽象開頭 2 號、結尾 1 號
  kill(rg);
  const pf = P(2, 2.3), pe = P(1, 2.3);
  tag('抽象開頭', 'ptr', pf.x, 1.4, pf.z); tag('抽象結尾', 'ptr alt', pe.x, 1.4, pe.z);
  say('抽象的開頭在 2 號', '抽象的結尾在它前一格：1 號');
  await step(tok);                                   // 165:39 連續又循環地使用
  for (let k = 0; k < N; k++) { const i = (2 + k) % N, p = P(i); cube(k + 1, colorFor(k + 1), [1.0, 0.7, 1.0], p.x, 0.4, p.z, 4); await beat(tok, 220); }
  say('10 格空間連續又循環地使用', '9 號之後繞回 0 號');
  await step(tok);                                   // 166:00 front、rear 留給大家讀
  say('front、rear 怎麼決定', '不太難，留給大家回去讀課本');
  await step(tok);                                   // 166:14 linked list 也行
  say('也可以用 linked list', '或 circular list 實作');
}]);

// ── 166:45 把迷宮的 container 換成 Queue（maze-compare 的 cued 版之一） ──
FRAG.push(['sqlin-maze-swap', '把迷宮的 container 換成 Queue', async (tok) => {
  mazeStage();
  const cd = code(['          Stack   Queue', '拿出來：  pop     dequeue', '塞進去：  push    enqueue'], 5.0, 4.2, 0.55, -2.6);
  await step(tok);                                   // 166:45 queue 也是 container
  say('Queue 也是一個 container', '也可以拿來解迷宮');
  await step(tok);                                   // 166:51 換成 queue
  cd.hl(0);
  say('基本上就是', '把剛才的 container 換成 Queue');
  await step(tok);                                   // 166:58 pop → dequeue
  cd.hl(1);
  say('拿東西出來：', 'stack 是 pop，queue 是 dequeue');
  await step(tok);                                   // 167:04 push → enqueue
  cd.hl(2);
  say('塞東西進去：', 'stack 是 push，queue 是 enqueue');
  await step(tok);                                   // 167:19 演算法範本
  cd.hl(-1);
  say('一個演算法範本', '換成不同的 restricted data structure → 不同的 behavior');
  await step(tok);                                   // 167:40 記事本存還沒探索的
  say('不管用哪個', '都是自己的記事本，存還沒探索過的地方');
}]);

// ── 167:53 / 171:12 Stack → DFS、Queue → BFS（入口、A、AA…） ──
function treeStage(kind) {
  fresh([0.5, 10, 10], [0.5, 0.3, 0.3]);
  const P = { E: [-6, 0], A: [-3.4, -3], B: [-3.4, 0], C: [-3.4, 3], AA: [-0.8, -4], AB: [-0.8, -2], X2: [-0.8, 0], CA: [-0.8, 3], AAA: [1.8, -4], X1: [4.4, -4] };
  const NAME = { E: '入口', X1: '出口₁', X2: '出口₂' };
  const KIDS = { E: ['A', 'B', 'C'], A: ['AA', 'AB'], AA: ['AAA'], AAA: ['X1'], B: ['X2'], C: ['CA'], AB: [], CA: [], X1: [], X2: [] };
  const nm = (k) => NAME[k] || k, node = {}, par = { E: null }, dep = { E: 0 };
  for (const k in KIDS) for (const ch of KIDS[k]) seg(V3(P[k][0] + 0.65, 0.3, P[k][1]), V3(P[ch][0] - 0.65, 0.3, P[ch][1]));
  for (const k in P) node[k] = cube(nm(k), k[0] === 'X' ? '#c08a1f' : k === 'E' ? '#5c7a4a' : '#b9a582', [1.25, 0.6, 0.9], P[k][0], 0.3, P[k][1]);
  const CX = 6.1, cont = [];
  tag(kind === 'stack' ? 'stack（top 在上）' : 'queue（front 在前）', 'ptr', CX, kind === 'stack' ? 0 : 1.2, kind === 'stack' ? 3.8 : -0.8);
  const pos = (i) => kind === 'stack' ? [CX, 0.3 + i * 0.6, 2.6] : [CX, 0.3, 0.4 + i * 0.9];
  const place = () => cont.forEach((m, i) => move(m, ...pos(i)));
  const push = (k) => { const m = cube(nm(k), TODO, [1.1, 0.5, 0.8], ...pos(cont.length), 3); m.userData.k = k; cont.push(m); if (k !== 'E') tint(node[k], TODO); };
  let last = null;
  return {
    P, node, par, dep, nm,
    start() { push('E'); },
    // take one out, expand it; returns its key
    take() {
      if (last) glow(node[last], null);
      const m = kind === 'stack' ? cont.pop() : cont.shift(), k = m.userData.k;
      fly(m, V3(0, 6, 2)); place();
      tint(node[k], OKC); glow(node[k], GOLD); last = k;
      if (k[0] !== 'X') { const kids = kind === 'stack' ? [...KIDS[k]].reverse() : KIDS[k]; kids.forEach((ch) => { par[ch] = k; dep[ch] = dep[k] + 1; push(ch); }); }
      return k;
    },
    path(goal) { const p = []; for (let k = goal; k; k = par[k]) { p.unshift(nm(k)); tint(node[k], '#c08a1f'); glow(node[k], GOLD); } return p; },
  };
}
FRAG.push(['sqlin-tree-search', 'Stack 版：Depth First Search', async (tok) => {
  const T = treeStage('stack');
  let goal = null;
  await step(tok);                                   // 167:55 記事本一直疊上去
  T.start();
  say('記事本是 stack', '會一直疊上去');
  await step(tok);                                   // 168:08 拿出來，鄰居堆進去
  T.take();
  say('拿出入口', '它所有的鄰居堆進去（A 在最上面）');
  await step(tok);                                   // 168:19 鄰居下一步先拿出來
  say('這些鄰居', '會是下一步先拿出來的');
  await step(tok);                                   // 168:51 抓出 A，疊上 A 的鄰居
  T.take();
  say('抓出入口的鄰居 A', '再疊上 A 的 neighbor');
  await step(tok);                                   // 169:01 AA 抓出來，疊上 AA 的鄰居
  T.take();
  say('再抓出 AA', '疊上 AA 的 neighbor');
  await step(tok);                                   // 169:23 入口鄰居還沒看完，已經一路深入
  T.take();
  say('入口的鄰居 B、C 還沒看', '已經一路深入到鄰居的鄰居的鄰居');
  await step(tok);                                   // 169:49 DFS
  goal = T.take();
  tag('DFS', 'ptr alt', 0, 2.2, -5);
  say('先走到不能再走才退回來', 'Depth First Search（DFS）');
  await step(tok);                                   // 170:20 先看深處再退回淺的
  say('更深入的鄰居一直堆在 stack 上面', '先看最深的，再退回淺的地方');
  await step(tok);                                   // 170:38 很多條路時
  say('有很多條路可以出去時', '找到哪條，跟某種順序有關');
  await step(tok);                                   // 170:54 第一條可以出去的路
  const p = T.path(goal);
  say('找到「第一條」可以出去的路', p.join(' → ') + '（' + (p.length - 1) + ' 步，不保證最短）');
}]);
FRAG.push(['sqlin-tree-bfs', 'Queue 版：Breadth First Search', async (tok) => {
  const T = treeStage('queue');
  T.start();
  const dist = (k) => tag('距離 ' + T.dep[k], 'idx', T.P[k][0], 1.0, T.P[k][1] - 0.7);
  const seen = [];
  const take = () => { const k = T.take(); seen.push(k); return k; };
  let goal = null;
  await step(tok);                                   // 171:18 入口；first neighbors
  take();
  say('Queue 版：入口拿出來', '排進入口的 first neighbors：A、B、C');
  await step(tok);                                   // 171:35 A 的鄰居
  take();
  say('A 的 neighbor', '串在後面');
  await step(tok);                                   // 171:43 B、C 的鄰居
  take(); await beat(tok, 700); take();
  say('B 的 neighbor、C 的 neighbor', '也一路串在後面');
  await step(tok);                                   // 171:53 慢慢找
  take(); await beat(tok, 700); take();
  say('再慢慢找 AA、AB……', '');
  await step(tok);                                   // 171:58 找到 → 最短
  goal = take();
  const p = T.path(goal);
  say('找到一條路出去時', p.join(' → ') + '：最短（' + (p.length - 1) + ' 步）');
  await step(tok);                                   // 172:08 距離 0、1
  seen.filter((k) => T.dep[k] <= 1).forEach(dist);
  say('先把跟入口距離 0 的處理完', '再處理距離 1 的');
  await step(tok);                                   // 172:15 2、3、4
  seen.filter((k) => T.dep[k] >= 2).forEach(dist);
  say('才處理距離 2、3、4……', '');
  await step(tok);                                   // 172:27 BFS
  tag('BFS', 'ptr alt', 0, 2.2, -5);
  say('這種搜尋方式叫', 'Breadth First Search（BFS，廣度優先）');
  await step(tok);                                   // 172:37 BFS vs DFS
  say('Stack 那個叫 DFS', 'Queue 這個叫 BFS');
  await step(tok);                                   // 172:48 同心圓
  for (const r of [2.6, 5.2]) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 60), new THREE.MeshBasicMaterial({ color: '#2fc092' })); m.rotation.x = Math.PI / 2; m.position.set(-6, 0.05, 0); lab.world.add(m); await beat(tok, 500); }
  say('BFS 像同心圓', '一層一層展出去');
  await step(tok);                                   // 173:04 疫調
  say('像疫調：第一層接觸者查完', '才查第二層、第三層');
  await step(tok);                                   // 173:53 behavior 不一樣
  say('學了 Stack、Queue', '看到兩種方法的 behavior 不一樣');
}]);

// ── 174:40 Q&A：recursive 版也是 DFS ──
FRAG.push(['sqlin-maze-rec-qa', 'Q&A：Recursive 版也是 DFS', async (tok) => {
  mazeStage(REC_CAM);
  const R = recPlayer();
  await step(tok);                                   // 174:41 recursive 也是 DFS？
  await chunk(tok, R.evs, 0, R.evs.length, R.apply, 120);
  say('留言：剛才 recursive', '感覺也是 DFS');
  await step(tok);                                   // 174:52 是的
  say('是的：recursive 也有', 'DFS 的 behavior');
  await step(tok);                                   // 174:59 記的東西不一樣
  tag('system stack：一條路', 'ptr', -3.9, 1.6, -5.3); tag('自己的 stack：待探索的點', 'ptr alt', 3.9, 1.6, -5.3);
  say('但記在 system stack 上的', '和記在自己 stack 上的不太一樣');
  await step(tok);                                   // 175:10 寫得出一樣的
  say('不過可以寫出某個 stack 版本', '做出 exactly 一樣的 DFS behavior');
}]);

// ── 175:27 Q&A：DFS 與 BFS 哪個快 ──
FRAG.push(['sqlin-maze-race', 'Q&A：DFS 與 BFS 哪個快', async (tok) => {
  fresh([0, 6, 13], [0, 1.4, 0]);
  const LX = (d, max) => -5.5 + d * (11 / max);
  // a row: levels 0..max, exit at level `ex`; stack checks `sc` cells, queue checks `qc`
  function race(z, max, ex, title) {
    tag(title, 'ptr', 0, 0, z - 1.0);
    for (let d = 0; d <= max; d++) cube('', d === ex ? '#c08a1f' : '#e9dcc4', [0.4, 0.1, 0.4], LX(d, max), 0.05, z);
    tag('出口', 'idx', LX(ex, max), 0.4, z + 0.5);
    const s = cube('S', '#9b7ef4', [0.5, 0.5, 0.5], LX(0, max), 0.3, z - 0.4), q = cube('Q', '#4b9ee2', [0.5, 0.5, 0.5], LX(0, max), 0.3, z + 0.4);
    const sc = tag('stack：', 'idx', 6.2, 0.3, z - 0.4), qc = tag('queue：', 'idx', 6.2, 0.3, z + 0.4);
    return { s, q, sc, qc, max, z };
  }
  await step(tok);                                   // 175:34 要先 define 目標
  say('怎麼走最快？', '要先 define 目標');
  await step(tok);                                   // 175:44 最短：queue
  tag('目標：最短的路 → Queue（BFS）', 'ptr alt', 0, 3.6);
  say('如果目標是找最短的路出去', 'Queue 會給你最短的路');
  await step(tok);                                   // 175:55 誰先找到：看問題
  say('至於誰比較快找到一條路', '跟問題的特性很有關係');
  let A = null, B = null;
  await step(tok);                                   // 176:01 stack 第一條路就出去，但很深
  A = race(-1.6, 20, 20, '情況一：出口在 stack 第一條路上，但很深（20 層）');
  say('如果 stack 試的第一條路就走得出去', '但那條路有 20 層');
  await step(tok);                                   // 176:12 queue 要一層一層轉
  await anim(tok, 1500, (t) => { A.s.position.x = LX(20 * t, 20); });
  txt(A.sc, 'stack：21 格就到');
  await anim(tok, 1000, (t) => { A.q.position.x = LX(20 * t, 20); });
  txt(A.qc, 'queue：每一層都要轉完');
  say('Stack 直衝到底：比較快', 'Queue 要從第 0 層轉到第 20 層');
  await step(tok);                                   // 176:27 三步就到，但在最尾巴
  B = race(1.6, 8, 3, '情況二：出口只要 3 步，但在 stack 嘗試順序的最尾巴');
  say('如果出口只要 3 步', '卻在 stack 嘗試的最尾巴');
  await step(tok);                                   // 176:45 queue 三層就出去
  await anim(tok, 900, (t) => { B.q.position.x = LX(3 * t, 8); });
  txt(B.qc, 'queue：轉 3 層就出去');
  await anim(tok, 1400, (t) => { B.s.position.x = LX(8 * Math.abs(Math.sin(t * Math.PI * 2)), 8); });
  txt(B.sc, 'stack：四處碰壁');
  say('Queue 轉三層就出去了', 'Stack 深入、碰壁、退回……');
  await step(tok);                                   // 177:09 看問題性質
  say('哪一個比較快', '跟問題的性質比較有關');
  await step(tok);                                   // 177:16 最壞差不多
  say('兩個演算法的最壞情形', '搞不好差不多');
  await step(tok);                                   // 177:34 路有長度：換 container
  say('如果每條路有長度、要找真正最短的', '再換別的 container，有很有效率的演算法');
}]);
  }

  // ═══ sqpeng.js ═══
  {
// ─── xqM9NVKUWmg：交大彭文志 Lec07 Stacks & Queues (2/2) ───
// cued scenes: each `await step(tok)` waits until the lecturer says that sentence; beats are motion only.
const step = (tok) => ctx.step(tok);
// 線性 queue（4 格，A B C D）
const LQX = (i) => (i - 1.5) * 2.1;
function lqSetup(n = 4) {
  for (let i = 0; i < n; i++) { ctx.tile(V3(LQX(i), 0.02, 0)); tag('[' + i + ']', 'idx', LQX(i), 0.1, 1.3); }
  const fl = tag('front = -1', 'ptr', LQX(-1) + 0.6, 0.2, -1.6), rl = tag('rear = -1', 'ptr alt', LQX(-1) + 0.6, 1.9, 0);
  return { fl, rl, put(lbl, name, i, high) { txt(lbl, name + ' = ' + i); lbl.position.set(i < 0 ? LQX(-1) + 0.6 : LQX(i), high ? 1.9 : 0.2, high ? 0 : -1.6); } };
}
FRAG.push(['sqpeng-queue-abcd', 'Stack 與 Queue 回顧：A B C D 與 delete', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const sk = [];
  await step(tok);                                   // 0:00 stack：last in first out
  for (let k = 0; k < 3; k++) sk.push(cube(k + 1, '#4b9ee2', [1.6, 0.8, 1.4], 0, 0.45 + k * 0.9, 0, 4 + k * 0.5));
  tag('stack', 'ptr', -1.6, 0.4, 0);
  say('Stack：last in, first out（LIFO）', '最後 push 進去的，最先 pop 出來');
  await step(tok);                                   // 0:39 add = push
  sk.push(cube(4, '#dd8238', [1.6, 0.8, 1.4], 0, 0.45 + 3 * 0.9, 0, 4));
  say('add 也叫 push：把資料丟進 stack', '');
  await step(tok);                                   // 0:46 pop = delete
  fly(sk.pop(), V3(3, 8, 2));
  say('pop 也叫 delete：從 stack 拿出來', '拿走的是最後放進去的 4');
  await step(tok);                                   // 1:19 queue 也像容器
  fresh([0, 7, 12], [0, 0.6, 0]);
  const q = lqSetup(4), bs = [];
  showL(q.fl, false); showL(q.rl, false);
  say('Queue：跟 stack 很像，也是一個容器', '');
  await step(tok);                                   // 1:31 兩個 pointer：front、rear
  showL(q.fl, true); showL(q.rl, true);
  say('差別：多一個 pointer', 'front 指前端，rear 指尾端');
  await step(tok);                                   // 1:45 加元素放到 rear 指的地方
  bs.push(cube('A', '#4b9ee2', [1.3, 0.8, 1.3], LQX(0), 0.45, 0, 6)); q.put(q.rl, 'rear', 0, true);
  say('add A：放到 rear 指的位置', 'rear = 0');
  await step(tok);                                   // 1:52 A B C D
  for (const [i, v] of ['B', 'C', 'D'].entries()) { bs.push(cube(v, '#4b9ee2', [1.3, 0.8, 1.3], LQX(i + 1), 0.45, 0, 6)); q.put(q.rl, 'rear', i + 1, true); await beat(tok, 350); }
  say('繼續加：A B C D', 'rear = 3');
  await step(tok);                                   // 2:02 只能放 4 個：滿了
  say('假設只能放 4 個：已經滿了', '不能再加任何東西');
  await step(tok);                                   // 2:10 delete 從 front
  q.put(q.fl, 'front', 0, false); fly(bs[0], V3(0, 8, 4));
  say('delete：從 front 這頭刪，取出 A', 'front = 0（指向第一個元素的前一格）');
  await step(tok);                                   // 2:22 B C D 掉下來？
  say('投影片上 B C D 像積木一樣掉下來？', '那只是示意圖');
  await step(tok);                                   // 2:29 其實仍佔用 array 的空間
  for (const b of bs.slice(1)) glow(b, GOLD);
  say('B、C、D 仍佔用 array[1]、[2]、[3]', 'array[0] 空出來，元素不會自動往前移');
  await step(tok);                                   // 2:55 預告 priority queue
  for (const b of bs.slice(1)) glow(b, null);
  say('預告：priority queue', '取出時要依某種 priority，後面章節再講');
  await step(tok);                                   // 3:29 add 動 rear，delete 動 front
  say('add 動 rear 的 pointer', 'delete 動 front 的 pointer');
}]);
FRAG.push(['sqpeng-false-full', '線性 Queue 假滿與 data movement', async (tok) => {
  fresh([0, 7, 12], [0, 0.6, 0]);
  const q = lqSetup(4), bs = {};
  let e;
  await step(tok);                                   // 3:52 capacity 固定：add 前檢查 full
  say('stack、queue 的 capacity 都是固定的', 'add 前要先檢查是不是 full');
  await step(tok);                                   // 4:16 delete 前檢查 empty
  say('delete 前也要檢查是不是 empty', '');
  await step(tok);                                   // 4:39 IsFull：rear == MaxSize − 1
  const cond = tag('IsFull：rear == MaxSize − 1 → true', 'idx', 0, 3.2, -1.6); Object.assign(cond.element.style, MONO);
  say('線性 queue 的 IsFull', 'rear == MaxSize − 1 就回傳 true（滿了）');
  await step(tok);                                   // 5:17 MaxSize = 4，A B C D 放滿
  ['A', 'B', 'C', 'D'].forEach((v, i) => { bs[v] = cube(v, '#4b9ee2', [1.3, 0.8, 1.3], LQX(i), 0.45, 0, 5 + i * 0.3); });
  q.put(q.rl, 'rear', 3, true);
  say('MaxSize = 4：A B C D 放滿', 'rear = 3 = MaxSize − 1 → full');
  await step(tok);                                   // 5:32 A 移除
  q.put(q.fl, 'front', 0, false); fly(bs.A, V3(0, 8, 4));
  say('把 A 移除：array[0] 空出來了', 'front = 0，rear 還是 3');
  await step(tok);                                   // 5:52 再加一個：還是判斷 full
  e = cube('E', '#dd8238', [1.3, 0.8, 1.3], LQX(0), 3.2, 0);
  glow(e, RED);
  say('想 add E：IsFull 只看 rear', '<span class="no">rear == MaxSize − 1 → 回報 full</span>');
  await step(tok);                                   // 6:12 缺點：誤判
  say('明明有空位，卻被判成 full', '這就是「誤判」（假滿）');
  await step(tok);                                   // 6:34 資料搬移：B C D 往前
  ['B', 'C', 'D'].forEach((v, i) => move(bs[v], LQX(i), 0.45, 0));
  q.put(q.fl, 'front', -1, false); q.put(q.rl, 'rear', 2, true);
  say('資料搬移：B、C、D 各往前移一格', 'front = −1，rear = 2');
  await step(tok);                                   // 6:53 就不會誤判
  glow(e, null); move(e, LQX(3), 0.45, 0); q.put(q.rl, 'rear', 3, true);
  say('搬完之後 E 放得進去', '不會再誤判');
  await step(tok);                                   // 7:22 解法一：data movement
  say('解法一：data movement', '');
  await step(tok);                                   // 7:32 解法二？
  say('解法二：能不能改 IsFull 這個 procedure？', '老師留的思考題，答案不只一種');
  await step(tok);                                   // 8:14 搬資料：IsFull 不用改
  say('搬資料：要多寫一個搬移的 procedure', 'IsFull 不用改；另一條路是直接改 IsFull');
  await step(tok);                                   // 8:32 另一種實作：circular
  say('書上的另一種實作', 'circular queue（環狀佇列）');
}]);

// 環狀 queue（6 格，J1…J9）
function cqPos(i, R = 3.4, cx = 0) { const a = Math.PI / 2 - (i / 6) * Math.PI * 2; return V3(cx + Math.cos(a) * R, 0.45, -Math.sin(a) * R); }
function cqSetup(R = 3.4, cx = 0) {
  const tiles = [];
  for (let i = 0; i < 6; i++) { const p = cqPos(i, R, cx); tiles.push(ctx.tile(V3(p.x, 0.02, p.z), 1.4, 1.4)); const ip = cqPos(i, R * 1.38, cx); tag('[' + i + ']', 'idx', ip.x, 0.1, ip.z); }
  const fl = tag('front', 'ptr', 0, 0.2, 0), rl = tag('rear', 'ptr alt', 0, 0.2, 0);
  const st = { f: 0, r: 0, slots: [], tiles, fl, rl };
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
  showL(q.fl, false); showL(q.rl, false);
  let g;
  await step(tok);                                   // 8:53 看起來是環狀，其實是連續 array
  say('環狀只是示意圖', '其實還是一個連續的 array：0～5');
  await step(tok);                                   // 9:09 6 格、兩個指標
  showL(q.fl, true); showL(q.rl, true);
  say('6 個 element 的空間，兩個指標', 'front 和 rear');
  await step(tok);                                   // 9:22 empty：front == rear
  say('怎麼判斷空？front == rear', '一開始 front = rear = 0：empty');
  await step(tok);                                   // 9:34 input J1 J2 J3
  for (const v of ['J1', 'J2', 'J3']) { q.add(v); await beat(tok, 350); }
  say('放進 J1、J2、J3', '');
  await step(tok);                                   // 9:51 front 指向前一個位置
  glow(q.tiles[0], GOLD);
  say('front 指向第一個元素的「前一格」', 'front = 0，那格是空的');
  await step(tok);                                   // 10:21 rear 指向 3
  glow(q.tiles[0], null);
  say('rear 指向最後一個元素', 'rear = 3');
  await step(tok);                                   // 10:36 add J4：放在 4
  q.add('J4');
  say('add J4：rear 加 1，放在 4 這個位置', 'rear = 4');
  await step(tok);                                   // 10:52 J5
  q.add('J5');
  say('再加 J5', 'front = 0，rear = 5');
  await step(tok);                                   // 11:07 這時已經是 full
  say('這時候就說 queue 已經 full 了', '');
  await step(tok);                                   // 11:17 明明還有一個空間
  glow(q.tiles[0], GOLD);
  say('真的滿了嗎？明明還有一格空著', '為什麼不塞？');
  await step(tok);                                   // 11:29 硬塞 J6 會怎樣
  const p0 = cqPos(0); g = cube('J6', '#d64545', [1.1, 0.7, 1.1], p0.x, 2.4, p0.z);
  say('如果硬把 J6 塞進去', 'rear 繞回 0，等於 front');
  await step(tok);                                   // 11:49 front = rear = 0：空還是滿？
  say('front = 0、rear = 0', '<span class="no">分不出是空還是滿</span>');
  await step(tok);                                   // 12:32 保留一格不要佔滿
  fly(g, V3(0, 8, -3)); glow(q.tiles[0], null);
  say('6 個 slot 只用 5 個：故意保留一格', '為了辨別 empty 還是 full');
  await step(tok);                                   // 13:07 delete J1–J4
  for (let k = 0; k < 4; k++) { q.del(); await beat(tok, 300); }
  say('delete J1、J2、J3、J4', 'front = 4（指向空格）');
  await step(tok);                                   // 13:16 add J6–J9
  for (const v of ['J6', 'J7', 'J8', 'J9']) { q.add(v); await beat(tok, 350); }
  say('再 add J6、J7、J8、J9：rear 繞圈', 'rear = 3');
  await step(tok);                                   // 14:10 front = 4、rear = 3：留一個空格
  say('front = 4、rear = 3：留一個空格', '這也是 full 的狀態');
  await step(tok);                                   // 14:27 full 的條件
  say('full 的條件', '(rear + 1) % MaxSize == front');
  await step(tok);                                   // 14:47 empty 的條件
  say('empty 的條件', 'front == rear');
}]);
FRAG.push(['sqpeng-cq-code', 'Circular Queue 的 Add / Delete', async (tok) => {
  fresh([0, 10, 11], [0, 1.2, 0.3]);
  const cd = code(['void Queue::Add(const KeyType& x) {', '  int newRear = (rear + 1) % MaxSize;', '  if (front == newRear) QueueFull();', '  else queue[rear = newRear] = x;', '}',
    'KeyType* Queue::Delete(KeyType& x) {', '  if (front == rear) { QueueEmpty(); return 0; }', '  front = (front + 1) % MaxSize;', '  x = queue[front]; return &x;', '}'], -3.4, 5.6, 0.55);
  const q = cqSetup(2.2, 3.3);
  q.add('J1'); q.add('J2');
  await step(tok);                                   // 15:03 投影片漏了參數 x
  cd.hl(0);
  say('Add：投影片漏了參數，自己補上 x', 'Add(const KeyType& x)');
  await step(tok);                                   // 15:24 rear 順時針移一格
  cd.hl(1);
  say('Add(J3)：rear 順時針移一格', 'newRear = (2 + 1) % 6 = 3');
  await step(tok);                                   // 15:46 front == newRear → full
  cd.hl(2);
  say('front == newRear 就是 full', '0 ≠ 3：還沒滿');
  await step(tok);                                   // 16:03 不是 full：放進去
  cd.hl(3); q.add('J3');
  say('不是 full：rear = newRear，x 放進 queue[rear]', 'queue[3] = J3');
  await step(tok);                                   // 16:17 兩個 assignment
  say('這一行做了兩個 assignment', '先 rear = newRear，再 queue[rear] = x');
  await step(tok);                                   // 16:48 Delete：front 指的是空的
  cd.hl(5);
  say('Delete：注意 front 指的是空格', '');
  await step(tok);                                   // 17:04 先判斷 empty
  cd.hl(6);
  say('先判斷 front == rear', '0 ≠ 3：不是 empty（是的話直接 return）');
  await step(tok);                                   // 17:34 front = (front + 1) % MaxSize
  cd.hl(7);
  const nf = (q.f + 1) % 6, pn = cqPos(nf, 2.2 * 0.55, 3.3);
  q.fl.position.set(pn.x, 0.3, pn.z); txt(q.fl, 'front = ' + nf);
  say('不是空的：front 先往前移一格', 'front = (0 + 1) % 6 = 1');
  await step(tok);                                   // 17:40 取 queue[front] 回傳
  cd.hl(8); q.del();
  say('再把 queue[front] 取出來回傳', 'x = queue[1] = J1');
  await step(tok);                                   // 17:48 環狀：一直轉
  cd.hl(3);
  for (const v of ['J4', 'J5', 'J6']) { q.add(v); await beat(tok, 450); }
  say('% MaxSize 讓 rear 在環上一直轉', 'rear：3 → 4 → 5 → 0');
  await step(tok);                                   // 17:59 充分利用 queue 空間
  cd.hl(2);
  say('再 add J7：newRear = 1 == front → full', '充分利用空間，又不會誤判');
  await step(tok);                                   // 18:33 解法不只一種
  cd.hl(-1);
  say('線性 queue 靠資料搬移也行', '解決方法不是只有一種，多想幾種');
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
const mzPath = (start) => { const ev = mzEvents(start); return ev[ev.length - 1].path; };
const mzTries = (start) => mzEvents(start).filter((e) => e.t === 'try').length + 1;
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
// glow a neighbour of (i, j) in direction d (green = can go, red = wall)
function mzTry(B, i, j, d) {
  const [a, b] = MOVE[d], t = B.tiles[(i + a) + ',' + (j + b)];
  if (t) glow(t, MZB[i + a][j + b] ? RED : GREEN);
  return t;
}
// a stack column of (i, j, dir) records at x = sx
function mzStack(sx) {
  tag('stack (i, j, dir)', 'idx', sx, 0, 1.4);
  const st = [];
  return {
    push(t) { st.push(cube(t, '#4b9ee2', [2.0, 0.5, 1.0], sx, 0.3 + st.length * 0.55, 0, 3)); },
    pop() { const m = st.pop(); if (m) fly(m, V3(3, 7, 2)); },
    get n() { return st.length; },
  };
}
FRAG.push(['sqpeng-maze-intro', '迷宮：八個方向與退回', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.6]);
  const S = 0.95, cx = -2.2;
  let B, mouse, stk;
  await step(tok);                                   // 19:08 入口在這裡、出口在那裡
  B = mzBoard(cx, 0, S, true);
  const ent = B.pos(1, 1), ex = B.pos(5, 5);
  tag('入口', 'ptr', ent.x, 0.9, ent.z - 0.5); tag('出口', 'ptr alt', ex.x, 0.9, ex.z + 0.5);
  say('迷宮程式：入口在左上，出口在右下', '');
  await step(tok);                                   // 19:17 老鼠進來了
  mouse = cube('', '#e55a9b', [S * 0.5, S * 0.5, S * 0.5], ent.x, 0.45, ent.z);
  say('一隻老鼠從入口進來', '它可以往哪些方向走？');
  await step(tok);                                   // 19:27 1 代表撞牆
  for (let r = 1; r < 6; r++) for (let c = 1; c < 6; c++) if (MZB[r][c]) glow(B.tiles[r + ',' + c], RED);
  say('0 可以走；1 是牆（障礙物）', '迷宮用 2D array 表示');
  await step(tok);                                   // 19:45 還可以斜著走
  for (let r = 1; r < 6; r++) for (let c = 1; c < 6; c++) if (MZB[r][c]) glow(B.tiles[r + ',' + c], null);
  const t1 = mzTry(B, 1, 1, 3);
  say('除了上下左右，還可以斜著走', '目標：找一條通到出口的 path');
  await step(tok);                                   // 20:43 八個方向
  if (t1) glow(t1, null);
  const p22 = B.pos(2, 2); move(mouse, p22.x, 0.45, p22.z);
  await beat(tok, 500);
  const lit = [];
  for (let d = 0; d < 8; d++) { lit.push(mzTry(B, 2, 2, d)); await beat(tok, 150); }
  say('在一個位置上，總共有八個方向可以試', 'N、NE、E、SE、S、SW、W、NW');
  await step(tok);                                   // 21:22 index 加 1 或減 1
  lit.forEach((t) => t && glow(t, null));
  say('走到下一步：把 row、col 的 index 加 1 或減 1', '');
  await step(tok);                                   // 21:45 沿著紅色走會有一條 path
  for (const [r, c] of mzPath(0)) B.paint(r, c, '#c08a1f');
  say('沿著這條路走，就能走出去', '程式要模擬、找出這樣一條 path');
  await step(tok);                                   // 22:03 是不是最短？不一定
  say('找到的會是最短路徑嗎？', '不一定，也可能不只一條，看程式怎麼設計');
  await step(tok);                                   // 22:32 被困住了
  for (const [r, c] of mzPath(0)) B.paint(r, c, '#f3ead9');
  B.paint(1, 1, '#f3ead9');
  say('也可能走進死路，被困住', '');
  await step(tok);                                   // 22:51 走不下去怎麼辦
  say('走不下去怎麼辦？', '就往回走一步（backtrack）');
  await step(tok);                                   // 23:30 用 stack 記錄
  stk = mzStack(3.6);
  stk.push('(1,1)'); stk.push('(2,2)');
  say('要記得走過哪些路、還要能往回走', '這種 data structure：stack');
  await step(tok);                                   // 23:55 stack 的特性：LIFO
  stk.pop();
  move(mouse, ent.x, 0.45, ent.z);
  say('往回走：pop 出最後記的那一步', 'stack 的特性：last in, first out');
  await step(tok);                                   // 24:13 協助 backtrack
  const path = mzPath(0);
  for (const [r, c] of path) { const p = B.pos(r, c); move(mouse, p.x, 0.45, p.z); B.paint(r, c, '#cfe8dc'); await beat(tok, 2000 / path.length); }
  say('記下老鼠走過的路徑', '就能回到上一步、上上一步：backtrack');
}]);
FRAG.push(['sqpeng-move-offset', 'move[8] offset 與 (i, j, dir)', async (tok) => {
  fresh([0, 10, 10], [0, 0.5, 0.5]);
  const S = 1.6, cx = -3.2;
  const cells = {};
  let rows;
  const hl = (d) => rows.forEach((l, k) => { l.element.className = 'lab-label ' + (k === d ? 'ptr alt' : 'idx'); });
  const off = (d) => { const [a, b] = MOVE[d]; return cells[a + ',' + b]; };
  await step(tok);                                   // 24:57 位置 (row, col)
  for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
    const m = lab.box(r || c ? '#f3ead9' : '#e55a9b', [S * 0.92, r || c ? 0.1 : 0.5, S * 0.92]); m.position.set(cx + c * S, r || c ? 0.05 : 0.25, r * S); lab.world.add(m); cells[r + ',' + c] = m;
  }
  tag('X (row, col)', 'ptr', cx, 0.9, 0);
  say('人在打叉的地方：位置是 (row, col)', '它有八個方向可以走');
  await step(tok);                                   // 25:12 往 N：(row − 1, col)
  glow(off(0), GOLD); tag('N', 'idx', cx, 0.3, -S);
  say('往北 N：下一個位置是 (row − 1, col)', 'column 不變，row 減 1');
  await step(tok);                                   // 25:37 往東北
  glow(off(0), null); glow(off(1), GOLD); tag('NE', 'idx', cx + S, 0.3, -S);
  say('往東北 NE：上一列、右邊一行', '(row − 1, col + 1)');
  await step(tok);                                   // 26:06 改變 2D array 的 index
  glow(off(1), null);
  say('下一步怎麼表示？', '改變 two-dimensional array 的 index');
  await step(tok);                                   // 26:28 offset
  say('這種位移叫 offset', '橫座標或縱座標加減 1');
  await step(tok);                                   // 26:51 offset 這個 datatype
  say('定一個 datatype：offset', '記錄垂直（vert）、水平（horiz）各移動多少');
  await step(tok);                                   // 27:21 八個方向存成 move[8]
  rows = MOVE.map(([a, b], d) => tag('move[' + d + ']  ' + DIRN[d].padEnd(2, ' ') + '  (' + (a < 0 ? '' : '+') + a + ', ' + (b < 0 ? '' : '+') + b + ')', 'idx', 3.4, 0, -2.6 + d * 0.62));
  rows.forEach((l) => Object.assign(l.element.style, MONO));
  say('八個方向存成一個 array：move[8]', '');
  await step(tok);                                   // 27:36 往上：move[0]
  hl(0); glow(off(0), GOLD);
  say('往上 N 存在 move[0]', '');
  await step(tok);                                   // 27:46 順時針下一個：move[1]
  glow(off(0), null); hl(1); glow(off(1), GOLD);
  say('不通的話，順時針轉一個角度：NE 存在 move[1]', '');
  await step(tok);                                   // 28:06 dir = 0～7 是 index
  glow(off(1), null);
  for (let d = 0; d < 8; d++) { hl(d); glow(off(d), GOLD); tag(DIRN[d], 'idx', cx + MOVE[d][1] * S, 0.3, MOVE[d][0] * S); await beat(tok, 220); glow(off(d), null); }
  say('dir = 0、1、2…7：move 這個 array 的 index', '依順時針編號');
  await step(tok);                                   // 29:04 N：(−1, 0)
  hl(0); glow(off(0), GOLD);
  say('往上：row − 1、col 不變', 'move[0] = (−1, 0)');
  await step(tok);                                   // 29:24 NE：(−1, 1)
  glow(off(0), null); hl(1); glow(off(1), GOLD);
  say('往東北：offset 是 (−1, 1)', 'move[1] = (−1, +1)');
  await step(tok);                                   // 29:51 下一步座標
  glow(off(1), null); hl(-1);
  say('下一步的位置', 'g = i + move[dir].vert，h = j + move[dir].horiz');
  await step(tok);                                   // 30:42 stack 要存 row、col
  say('stack 要存走過的位置', '它的 row、column');
  await step(tok);                                   // 30:57 還要記方向：為什麼？
  say('還要記上一次試的方向', '為什麼？');
  await step(tok);                                   // 31:07 北邊試過、走不動
  glow(off(0), RED);
  say('假設試過北邊：走不動', '');
  await step(tok);                                   // 31:16 接著試東北
  glow(off(1), RED);
  say('接著順時針試東北', '走下去以後發現也不通，退回來');
  await step(tok);                                   // 32:22 不要再試北、東北
  say('退回這一格時', '不要再試北邊和東北邊了：已經試過、走不通');
  await step(tok);                                   // 32:28 接著試東
  glow(off(2), GREEN);
  const s = cube('(row, col, dir = 2)', '#4b9ee2', [3.2, 0.5, 1.0], cx, 0.3, 2.8, 3);
  say('從東邊（dir = 2）接著試', 'stack 每格存 (row, col, dir)');
}]);
// 迷宮 pseudocode（三段各自一份 code 面板）
const MZCODE = ['mark[1][1]=1; stack.push(1,1,N);', 'while (!stack.IsEmpty()) {', '  (i,j,d) = stack.pop();', '  while (d < 8) {', '    g = i+move[d].a; h = j+move[d].b;', '    if (g==m && h==p) success;',
  '    if (!maze[g][h] && !mark[g][h]) {', '      mark[g][h]=1; push(i,j,d+1);', '      i=g; j=h; d=0; }', '    else d++; } }'];
FRAG.push(['sqpeng-maze-pseudo', '迷宮 pseudocode：初始化與 while 迴圈', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.5, 0.4]);
  let cd, B, stk, mouse;
  await step(tok);                                   // 33:00 pseudocode
  cd = code(MZCODE, 4.3, 6.2, 0.5);
  say('先看 pseudocode（虛擬碼）', '大概的運作邏輯');
  await step(tok);                                   // 33:09 地圖 maze
  B = mzBoard(-3.6, 0, 0.95, true);
  say('會有一張地圖：maze', '');
  await step(tok);                                   // 33:22 入口、出口的座標
  const ent = B.pos(1, 1), ex = B.pos(5, 5);
  tag('入口', 'ptr', ent.x, 0.9, ent.z - 0.5); tag('出口 (m,p)', 'ptr alt', ex.x, 0.9, ex.z + 0.5);
  say('知道入口和出口 (m, p) 的座標', '');
  await step(tok);                                   // 33:31 初始化
  cd.hl(0);
  say('先做初始化', '');
  await step(tok);                                   // 33:40 stack 是不是 empty
  cd.hl(1);
  say('while：先判斷 stack 是不是 empty', '');
  await step(tok);                                   // 33:50 pop 出 (i, j, dir)
  cd.hl(2);
  say('不是 empty：pop 出現在的位置 (i, j, dir)', '');
  await step(tok);                                   // 34:10 還有其他方向可以試
  cd.hl(3);
  say('這一層：北邊試過了，還有別的方向可以試', 'd < 8 就繼續試');
  await step(tok);                                   // 34:24 (g, h) 是下一個位置
  cd.hl(4);
  say('(g, h)：從 (i, j) 往 d 方向走的下一個位置', '');
  await step(tok);                                   // 34:40 (g, h) == (m, p)：success
  cd.hl(5); glow(B.tiles['5,5'], GOLD);
  say('(g, h) 等於出口 (m, p) 就成功', '');
  await step(tok);                                   // 35:03 stack 一開始記入口
  glow(B.tiles['5,5'], null);
  cd.hl(0);
  stk = mzStack(0.6); stk.push('(1,1,N)');
  mouse = cube('', '#e55a9b', [0.47, 0.47, 0.47], ent.x, 0.45, ent.z);
  say('初始化：把入口和起始方向（北）push 進 stack', '');
  await step(tok);                                   // 36:01 push 到 stack 裡
  say('所以清空 stack 之後，先放進入口的資訊', '');
  await step(tok);                                   // 36:33 不是 empty
  cd.hl(1);
  say('進到 while 時 stack 一定有值', '不是 empty');
  await step(tok);                                   // 36:41 拿出來：(i, j, dir)
  cd.hl(2); stk.pop();
  say('把它 pop 出來：(i, j, dir)', '一開始是入口、方向北');
  await step(tok);                                   // 36:50 往北邊走
  cd.hl(4); mzTry(B, 1, 1, 0);
  say('從入口開始，往北邊試', '');
}]);
FRAG.push(['sqpeng-maze-border', '邊界技巧：外圍包一圈 1', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.4]);
  const S = 1.0, B = mzBoard(0, 0, S, false);
  const p11 = B.pos(1, 1);
  const mouse = cube('', '#e55a9b', [0.5, 0.5, 0.5], p11.x, 0.45, p11.z);
  const walls = [];
  await step(tok);                                   // 37:14 往北是圍牆？
  const ghost = cube('?', '#d64545', [0.4, 0.4, 0.4], B.pos(0, 1).x, 0.9, B.pos(0, 1).z);
  say('入口往北走？北邊根本在迷宮外面', '投影片上那是圍牆');
  await step(tok);                                   // 37:25 boundary 也用 array 表示
  kill(ghost);
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    if (!(r === 0 || c === 0 || r === 6 || c === 6)) continue;
    const p = B.pos(r, c); walls.push(cube('1', '#c46a5a', [S * 0.94, 0.55, S * 0.94], p.x, 0.27, p.z, 3));
    await beat(tok, 40);
  }
  say('把 array 設大一點，boundary 也放進 array', '');
  await step(tok);                                   // 37:33 boundary 都是 1
  walls.forEach((w) => glow(w, GOLD));
  say('外圍 boundary 全部是 1（牆）', '');
  await step(tok);                                   // 37:40 邊界也照樣試北、東北
  walls.forEach((w) => glow(w, null));
  for (let d = 0; d < 3; d++) {
    const [a, b] = MOVE[d], q = B.pos(1 + a, 1 + b);
    const m = cube('', d < 2 ? '#d64545' : '#2fc092', [0.3, 0.3, 0.3], q.x, 0.9, q.z);
    await beat(tok, 600); kill(m);
  }
  say('在邊界也照樣試北、東北……', '外圍是 1 → 走不通，換下一個方向');
  await step(tok);                                   // 37:52 不必判斷在哪一邊
  say('不用另外寫程式判斷：在上面、下面、左邊還是右邊？', '');
  await step(tok);                                   // 38:11 包一圈 1：程式共用
  say('外面包一圈 1，八個方向的程式就能共用', '不用考慮是不是在邊界');
  await step(tok);                                   // 38:30 比特別判斷乾淨
  kill(mouse);
  say('老師：這個寫法很強', '以前為邊界特別寫 code，又臭又長');
}]);
FRAG.push(['sqpeng-maze-mark', '迷宮：maze、mark 與 push 的條件', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.5, 0.4]);
  const cd = code(MZCODE, 4.3, 6.2, 0.5);
  const B = mzBoard(-3.6, 0, 0.95, true);
  const ent = B.pos(1, 1);
  tag('出口 (m,p)', 'ptr alt', B.pos(5, 5).x, 0.9, B.pos(5, 5).z + 0.5);
  const mouse = cube('', '#e55a9b', [0.47, 0.47, 0.47], ent.x, 0.45, ent.z);
  B.paint(1, 1, '#f2c46d');
  const stk = mzStack(0.6);
  await step(tok);                                   // 38:56 北不通、東北不通
  cd.hl(4); mzTry(B, 1, 1, 0); mzTry(B, 1, 1, 1);
  say('在入口：北邊不通（1），東北也不通', '');
  await step(tok);                                   // 39:05 下一個位置 (g, h)
  const tE = mzTry(B, 1, 1, 2);
  say('接著試東邊：下一個位置 (g, h) = (1, 2)', '');
  await step(tok);                                   // 39:29 (g, h) 是不是 (m, p)
  cd.hl(5);
  say('先判斷 (g, h) 是不是出口 (m, p)', '是的話就成功');
  await step(tok);                                   // 39:37 不是出口
  say('(1, 2) 不是出口', '那就準備移過去');
  await step(tok);                                   // 39:55 maze[g][h]：地圖資訊
  cd.hl(6);
  say('maze[g][h]：迷宮的地圖資訊', '1 不能走，0 可以走');
  await step(tok);                                   // 40:21 mark：有沒有走過
  B.paint(1, 1, '#f2c46d');
  say('mark[g][h]：記錄這格有沒有走過', '走過就設成 1（黃色）');
  await step(tok);                                   // 40:59 mark 和 maze 一樣大
  say('mark 也是 2D array', '大小跟 maze 一模一樣');
  await step(tok);                                   // 41:27 能進來的唯一條件
  say('能走到 (g, h) 的唯一條件', 'maze[g][h] == 0（可走）且 mark[g][h] == 0（沒走過）');
  await step(tok);                                   // 41:39 mark[g][h] = 1
  cd.hl(7); if (tE) glow(tE, null); B.paint(1, 2, '#f2c46d');
  say('走過去：mark[g][h] = 1', '');
  await step(tok);                                   // 42:03 把 (i, j, 下一個方向) push
  stk.push('(1,1,SE)');
  say('把 (i, j) 和下一個要試的方向 push 進 stack', '(1, 1, d + 1)：下次回來從 SE 試');
  await step(tok);                                   // 42:13 移到 (g, h)，d 歸零
  cd.hl(8);
  const p = B.pos(1, 2); move(mouse, p.x, 0.45, p.z);
  say('移動：i = g，j = h', 'd 歸零，從北邊重新試');
  await step(tok);                                   // 42:22 stack 記錄 path
  cd.hl(-1);
  say('stack 記錄老鼠走過的 path', '');
  await step(tok);                                   // 42:42 maze、mark、move
  say('maze 記錄迷宮，mark 記錄有沒有走過', 'move 用在算下一個位置');
  await step(tok);                                   // 43:15 三個重要的結構
  say('三個重要結構：maze、mark、stack', '要知道每個 array 扮演什麼角色');
}]);
FRAG.push(['sqpeng-maze-order', '試方向的順序：先北 vs 先東', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.6]);
  const S = 0.95, cx = -1.0, B = mzBoard(cx, 0, S, true);
  const ent = B.pos(1, 1), ex = B.pos(5, 5);
  tag('入口', 'ptr', ent.x, 0.9, ent.z - 0.5);
  const exT = tag('出口', 'ptr alt', ex.x, 0.9, ex.z + 0.5);
  const mouse = cube('', '#e55a9b', [S * 0.5, S * 0.5, S * 0.5], ent.x, 0.45, ent.z);
  const arr = (d, col) => { const [a, b] = MOVE[d]; return arrow(V3(ent.x, 0.6, ent.z), V3(ent.x + b * S * 0.9, 0.6, ent.z + a * S * 0.9), col); };
  await step(tok);                                   // 43:40 為什麼每次都先往北？
  glow(B.tiles['5,5'], GOLD);
  say('同學問：為什麼每次都先往北？', '出口在右下角');
  await step(tok);                                   // 43:52 往北很浪費
  arr(0, 0xc0392b);
  say('出口在右下，每次先往北試蠻浪費的', '');
  await step(tok);                                   // 44:16 希望儘量往東
  arr(2, 0x2e8b57);
  say('我們比較希望它往東走', '再往東南、往南');
  await step(tok);                                   // 44:32 方向可以自己定義
  say('試的方向順序可以自己定義', '只要規則固定、記得試過哪些方向');
  await step(tok);                                   // 45:17 先東、東南、南
  arr(3, 0x2e8b57); arr(4, 0x2e8b57);
  tag('先 N：試 ' + mzTries(0) + ' 次；先 E：試 ' + mzTries(2) + ' 次', 'idx', cx, 0, 4.0);
  say('例如規則：先東，再東南，再南（順時針）', '在這個小迷宮，試的次數也少一些');
  await step(tok);                                   // 45:34 逆時針也可以
  say('逆時針可不可以？也可以', '');
  await step(tok);                                   // 45:52 北、西北遠離目的地
  arr(7, 0xc0392b);
  say('但先試北、西北，是遠離目的地', '可能多走很多冤枉路');
  await step(tok);                                   // 46:12 以前考過：單一出口最短
  say('老師以前考過：只有一個出口時', '怎麼讓它儘量走最短路徑？');
  await step(tok);                                   // 47:03 出口不在右下、還有多個
  const ex2 = B.pos(1, 5); tag('出口 2？', 'ptr alt', ex2.x, 0.9, ex2.z - 0.5); glow(B.tiles['1,5'], GOLD);
  say('更難：出口不一定在右下，還不只一個', '怎麼找到最近的出口？');
  await step(tok);                                   // 47:22 近的不一定通
  say('近的不一定走得通', '');
  await step(tok);                                   // 47:43 很好玩，用 stack 實作
  txt(exT, '出口 1'); kill(mouse);
  say('這個題目很好玩，不只這麼簡單', '一樣可以用 stack 來實作');
}]);
FRAG.push(['sqpeng-maze-red', '實作：外圍紅色那一圈與入口 (1,1)', async (tok) => {
  fresh([0, 11, 8.5], [0, 0, 0.4]);
  const S = 1.0, B = mzBoard(0, 0, S, false);
  const t0 = [];
  let en;
  await step(tok);                                   // 48:00 黑色是原本的地圖
  for (let k = 0; k < 5; k++) { t0.push(tag(String(k), 'idx', B.pos(k + 1, 0).x + 0.35, 0.1, B.pos(k + 1, 0).z)); t0.push(tag(String(k), 'idx', B.pos(0, k + 1).x, 0.1, B.pos(0, k + 1).z + 0.35)); }
  en = tag('入口 (0,0)', 'ptr', B.pos(1, 1).x, 0.8, B.pos(1, 1).z);
  say('真正實作時：這是原本迷宮的地圖', '');
  await step(tok);                                   // 48:19 避免判斷邊界
  say('為了避免判斷「這個位置是不是在邊界」', '');
  await step(tok);                                   // 48:26 多一圈紅色
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    if (!(r === 0 || c === 0 || r === 6 || c === 6)) continue;
    const p = B.pos(r, c); cube('1', '#c46a5a', [S * 0.94, 0.55, S * 0.94], p.x, 0.27, p.z, 3);
    await beat(tok, 40);
  }
  say('外面多加一圈紅色的 1', 'array 變成 (m+2) × (p+2)');
  await step(tok);                                   // 48:46 入口變 (1,1)
  t0.forEach((l, k) => txt(l, String(Math.floor(k / 2) + 1)));
  txt(en, '入口 (1,1)');
  say('原本入口是 (0, 0)', '加了外圍之後變成 (1, 1)');
  await step(tok);                                   // 48:53 (m, p) 還是出口
  tag('出口 (m,p)', 'ptr alt', B.pos(5, 5).x, 0.8, B.pos(5, 5).z);
  say('(m, p) 還是出口', '');
  await step(tok);                                   // 48:55 紅色圈就是圍牆
  say('紅色那一圈就像圍牆，把迷宮圍住', '');
  await step(tok);                                   // 49:03 邊界也照規則先往北
  const p11 = B.pos(1, 1);
  const mouse = cube('', '#e55a9b', [0.5, 0.5, 0.5], p11.x, 0.45, p11.z);
  for (let d = 0; d < 3; d++) {
    const [a, b] = MOVE[d], q = B.pos(1 + a, 1 + b);
    const m = cube('', d < 2 ? '#d64545' : '#2fc092', [0.3, 0.3, 0.3], q.x, 0.9, q.z);
    await beat(tok, 600); if (d < 2) kill(m);
  }
  say('在邊界照樣先往北試：不通就換方向', '不會因為在邊界而有不同的程式');
}]);
FRAG.push(['sqpeng-maze-prog', '迷宮程式：從 pseudocode 到程式碼', async (tok) => {
  fresh([0, 11, 9.5], [0, 0.5, 0.4]);
  const cd = code(MZCODE, 4.3, 6.2, 0.5);
  const B = mzBoard(-3.6, 0, 0.95, true);
  const ent = B.pos(1, 1);
  const mouse = cube('', '#e55a9b', [0.47, 0.47, 0.47], ent.x, 0.45, ent.z);
  const stk = mzStack(0.6);
  let rowsT;
  await step(tok);                                   // 49:57 stack，入口 add 進去
  cd.hl(0); stk.push('(1,1,N)');
  say('程式：宣告大約 m × p 的 stack', '把入口位置和方向 add 進去');
  await step(tok);                                   // 50:01 while：stack 空嗎
  cd.hl(1);
  say('while 迴圈：判斷 stack 是不是空的', '');
  await step(tok);                                   // 50:14 做好初始值，一定有入口
  cd.hl(2); stk.pop();
  say('做好初始值，一開始一定有入口的資訊', '不是空的：pop 出 (i, j, d)');
  await step(tok);                                   // 50:22 (g, h) = 下一個 movement 的座標
  cd.hl(4); const tN = mzTry(B, 1, 1, 0);
  say('(g, h)：下一個 movement 的座標', '');
  await step(tok);                                   // 50:41 move[d]、while d < 8
  cd.hl(3); if (tN) glow(tN, null);
  say('while d < 8：0～7 八個方向依序試', '');
  await step(tok);                                   // 51:15 move 存的是 offset
  cd.hl(4);
  say('move 這個 array 存的是 offset', 'g、h 要用 move[d] 算出來');
  await step(tok);                                   // 51:23 (g, h) 是不是出口
  cd.hl(5);
  say('判斷 (g, h) 是不是出口 (m, p)', '是的話就把路徑 output');
  await step(tok);                                   // 51:40 maze、mark：和 pseudocode 好像
  cd.hl(6);
  say('不是出口：檢查 maze[g][h] 和 mark[g][h]', '跟 pseudocode 真的太像了');
  await step(tok);                                   // 52:11 先寫 pseudocode
  cd.hl(-1);
  say('老師的建議：先寫 pseudocode', '把解決問題的方法、大概的演算法寫出來');
  await step(tok);                                   // 52:26 成功 50%
  say('寫出來就成功一半了', '再把它改寫成詳細的程式指令');
  await step(tok);                                   // 53:13 d++：換下一個方向
  cd.hl(9); mzTry(B, 1, 1, 0);
  say('d 是下一次要試的方向', 'd++：換下一個方向');
  await step(tok);                                   // 53:25 0 北 → 1 東北
  mzTry(B, 1, 1, 1);
  say('d = 0 往北；北走過了 d++', 'd = 1 往東北');
  await step(tok);                                   // 53:36 想先往東怎麼做
  cd.hl(-1);
  say('想讓它先往東走，要怎麼做？', '程式可以照用');
  await step(tok);                                   // 54:08 重新編號 move 或改 offset
  rowsT = MOVE.map((_, k) => { const d = (k + 2) % 8, [a, b] = MOVE[d]; return tag('move[' + k + '] ' + DIRN[d].padEnd(2, ' ') + ' (' + a + ',' + b + ')', 'idx', -0.6, 0, -2.6 + k * 0.52); });
  rowsT.forEach((l) => Object.assign(l.element.style, MONO, { fontSize: '10px' }));
  say('把 move array 重新編號：move[0] 改成東', '或直接改它的 offset');
}]);

// Postfix
FRAG.push(['sqpeng-infix-ambig', 'Infix 的歧義與 Postfix', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  let ex, l1, l2;
  await step(tok);                                   // 54:32 寫過計算機嗎
  say('第二個應用：寫一個計算機', '');
  await step(tok);                                   // 54:58 A/B − C + D*E − A*C
  ex = tag('X = A / B − C + D * E − A * C', 'ptr', 0, 6.2); Object.assign(ex.element.style, { fontSize: '15px' });
  say('一個式子：A / B − C + D * E − A * C', '');
  await step(tok);                                   // 55:07 A = 4，B = C = 2，D = E = 3
  tag('A = 4，B = C = 2，D = E = 3', 'idx', 0, 5.4);
  say('初始化：A = 4，B = C = 2，D = E = 3', '');
  await step(tok);                                   // 55:17 X 是多少？說不準
  say('X 是多少？說不準', '');
  await step(tok);                                   // 55:34 看括號怎麼加
  l1 = tag('((4/2) − 2) + (3*3) − (4*2) = 1', '', -3.2, 3.6); Object.assign(l1.element.style, MONO);
  cube('1', '#2fc092', [1.4, 1.4, 1.4], -3.2, 0.7, 0, 4);
  say('要看括號怎麼加：這樣加，X = 1', '((4/2) − 2) + (3*3) − (4*2)');
  await step(tok);                                   // 55:43 也可以這樣括
  l2 = tag('((4/(2−2+3)) * (3−4)) * 2 = −2.666…', '', 3.2, 3.6); Object.assign(l2.element.style, MONO);
  cube('−2.67', '#d64545', [1.4, 1.4, 1.4], 3.2, 0.7, 0, 4);
  say('也可以這樣括：X = −2.666…', '');
  await step(tok);                                   // 55:51 可能是 1，也可能是 2.666
  say('同一串符號：可能 1，也可能 −2.666', 'it depends');
  await step(tok);                                   // 56:11 misleading
  say('只輸入這個式子，會有很多可能', '產生 misleading（誤導）');
  await step(tok);                                   // 56:26 先乘除後加減的規則
  say('要有規則：先乘除後加減', '');
  await step(tok);                                   // 56:33 postfix：2 3 4 * +
  kill(l1); kill(l2);
  for (const o of [...lab.bodies]) fly(o.obj, V3(0, 8, 3));
  await beat(tok, 500);
  ['2', '3', '4', '*', '+'].forEach((t, k) => cube(t, /\d/.test(t) ? '#4b9ee2' : '#c08a1f', [1.1, 0.9, 1.1], -3 + k * 1.5, 0.45, 0, 3 + k));
  say('Postfix：2 + 3 * 4 寫成 2 3 4 * +', 'operator 寫在運算元後面');
  await step(tok);                                   // 57:07 infix 變 postfix
  say('先接受一個事實：程式能把 infix 轉成 postfix', '後面會講怎麼轉');
  await step(tok);                                   // 57:24 電腦很快算出值
  say('有了 postfix，電腦可以很快 evaluate 出值', 'infix → postfix → 算值');
  await step(tok);                                   // 57:49 postfix 沒有括號
  say('注意：postfix 裡面沒有括號', '');
}]);
// 林軒田那支的 postfix-eval 的 cued 版：一個 token 一步
FRAG.push(['sqpeng-postfix-eval', 'Postfix 求值：6 2 / 3 − 4 2 * +', async (tok) => {
  fresh([6, 6, 13], [0, 3.2, 0]);
  await step(tok);                                   // 58:08 postfix：6 2 / 3 − 4 2 * +
  enterPostfix();
  document.getElementById('pfExpr').value = (ctx.params || {}).expr || '6/2-3+4*2';
  startPf('eval');
  say('Postfix：' + pf.post.join(' '), '由左往右一個一個讀');
  await step(tok);                                   // 58:29 對應的 infix
  say('對應的 infix：' + ((ctx.params || {}).expr || '6/2-3+4*2'), '');
  while (pf.i < pf.steps.length - 1) {
    await step(tok);                                 // 每讀一個 token
    pfStep();
    const s = pf.steps[pf.i];
    say(PREC[s.tok] ? '讀到 ' + s.tok + '：pop 兩個、計算、push 回去' : '讀到 ' + s.tok + '：數字直接 push', s.why);
  }
  await step(tok);                                   // 61:04 最後 stack 剩下的就是答案
  say('最後 stack 裡剩下的就是答案', '= <span class="ok">' + pf.steps[pf.steps.length - 1].stack[0] + '</span>');
}]);
FRAG.push(['sqpeng-eval-code', 'Eval(e)：三格的 operand stack', async (tok) => {
  fresh([0, 6, 13], [0, 2.6, 0]);
  let cd, topL, tl;
  const toks = ['6', '2', '/', '3', '-', '4', '2', '*', '+', '#'];
  const st = [];
  let k = 0;
  const setTop = () => { txt(topL, 'top = ' + (st.length - 1)); topL.position.set(-2.2, st.length ? 0.45 + (st.length - 1) * 0.9 : 0.3, 0); };
  async function eat() {
    const t = toks[k];
    tl.forEach((l, i) => { l.element.className = 'lab-label ' + (i === k ? 'ptr alt' : 'idx'); });
    k++;
    if (/\d/.test(t)) { const m = cube(t, '#4b9ee2', [1.6, 0.75, 1.3], -4, 0.45 + st.length * 0.9, 0, 4); st.push({ m, v: Number(t) }); setTop(); await beat(tok, 350); return; }
    const b = st.pop(), a = st.pop(); fly(b.m, V3(3, 7, 2)); fly(a.m, V3(-3, 7, 2));
    const r = t === '+' ? a.v + b.v : t === '-' ? a.v - b.v : t === '*' ? a.v * b.v : a.v / b.v;
    await beat(tok, 300);
    const m = cube(String(r), '#2fc092', [1.6, 0.75, 1.3], -4, 0.45 + st.length * 0.9, 0, 4); st.push({ m, v: r }); setTop();
    await beat(tok, 350);
  }
  await step(tok);                                   // 61:14 top 指標，只要 3 格
  for (let j = 0; j < 3; j++) { const g = ghostBox('#c9b48e', 1.8, 0.8, 1.4); g.position.set(-4, 0.45 + j * 0.9, 0); tag('[' + j + ']', 'idx', -5.4, 0.45 + j * 0.9); }
  topL = tag('top = −1', 'ptr', -2.2, 0.3);
  say('右半邊是 top 指標', '這個例子 stack 只要 3 格');
  await step(tok);                                   // 61:29 input 是 postfix
  say('這個過程的 input：postfix', '');
  await step(tok);                                   // 61:43 output 是值
  say('output：這個數學式子的值', '');
  await step(tok);                                   // 61:59 function Eval
  cd = code(['void Eval(Expression e) {', '  Stack<Token> stack;', '  for (x = NextToken(e); x != \'#\'; x = NextToken(e))', '    if (x is an operand) stack.Add(x);', '    else { pop 兩個運算元; 算 x; 結果 Add 回 stack; }', '  // 讀到 #：stack 剩下的就是答案', '}'], 2.6, 6.2, 0.55);
  cd.hl(0);
  say('函式 Eval(e)：計算 postfix 式子 e 的值', '');
  await step(tok);                                   // 62:07 # 標記結尾
  tl = toks.map((t, j) => tag(t, 'idx', -5.2 + j * 0.85, 4.6)); tl.forEach((l) => Object.assign(l.element.style, { fontSize: '15px' }));
  say('用 # 標記式子的結尾', 'e = 6 2 / 3 − 4 2 * + #');
  await step(tok);                                   // 62:22 宣告一個 stack
  cd.hl(1);
  say('宣告一個 stack', '');
  await step(tok);                                   // 62:31 token
  say('字串裡的每一個元素叫一個 token', '例如 2 就是一個 token');
  await step(tok);                                   // 62:46 for 迴圈：NextToken
  cd.hl(2); tl[0].element.className = 'lab-label ptr alt';
  say('for 迴圈用 NextToken 一個一個抓', '直到讀到 #');
  await step(tok);                                   // 63:08 是數字就放進 stack
  cd.hl(3); await eat(); await eat();
  say('是數字就放進 stack', '6、2 push');
  await step(tok);                                   // 63:16 operator：pop 兩次
  cd.hl(4); await eat();
  say('是 operator：pop 兩次，做運算', '6 / 2 = 3');
  await step(tok);                                   // 63:36 結果存回 stack
  for (let j = 0; j < 5; j++) await eat();
  say('運算結果存回 stack', '3 − 3 = 0，4 * 2 = 8，0 + 8 = 8');
  await step(tok);                                   // 63:43 # 結尾：答案
  cd.hl(5); tl.forEach((l, i) => { l.element.className = 'lab-label ' + (i === 9 ? 'ptr alt' : 'idx'); });
  glow(st[0].m, GOLD);
  say('遇到 #：結尾了', '把 stack 裡的值丟出來就是答案：<span class="ok">8</span>');
  await step(tok);                                   // 64:12 input postfix string、output 值
  cd.hl(-1);
  say('input：postfix 的 string', 'output：值');
  await step(tok);                                   // 64:36 使用者輸入 infix
  say('可是使用者會輸入 2 + 3 * 4（infix）', '');
  await step(tok);                                   // 65:03 infix 怎麼轉 postfix
  say('所以接下來：infix 怎麼轉成 postfix', '');
}]);
FRAG.push(['sqpeng-paren-2pass', '手動法：加括號、operator 取代右括號', async (tok) => {
  fresh([0, 5, 13], [0, 3, 0]);
  const T = { op: '-', L: { op: '+', L: { op: '-', L: { op: '/', L: 'A', R: 'B' }, R: 'C' }, R: { op: '*', L: 'D', R: 'E' } }, R: { op: '*', L: 'A', R: 'C' } };
  const ops = []; (function walk(n) { if (typeof n === 'string') return; walk(n.L); ops.push(n); walk(n.R); })(T);
  const moved = new Set();
  const show = (n) => typeof n === 'string' ? n : '(' + show(n.L) + (moved.has(n) ? '' : n.op) + show(n.R) + (moved.has(n) ? n.op : ')');
  let big;
  const mv = (...ks) => { ks.forEach((k) => moved.add(ops[k])); txt(big, show(T)); };
  await step(tok);                                   // 65:13 infix 轉 prefix 是習題
  big = tag('A/B-C+D*E-A*C', '', 0, 4.8); Object.assign(big.element.style, MONO, { fontSize: '17px' });
  say('Infix 轉 prefix 是課本習題（考過），自己看', '這裡講 infix 轉 postfix');
  await step(tok);                                   // 65:39 先加括號
  txt(big, show(T));
  say('一種方法：先依先乘除後加減，全部加上括號', '');
  await step(tok);                                   // 65:58 左括號不用理
  say('左括號可以不用理它', '只看右括號');
  await step(tok);                                   // 66:06 除 → 取代它的右括號
  mv(0);
  say('/ 去取代它右邊對應的右括號', '變成 AB/');
  await step(tok);                                   // 66:13 −
  mv(1);
  say('− 也往右找到它的右括號，取代它', '');
  await step(tok);                                   // 66:24 乘取代
  mv(3);
  say('D * E 的 * 取代右括號', 'DE*');
  await step(tok);                                   // 66:47 加在最後
  mv(2, 4, 5);
  say('+ 和剩下的 operator 也一樣', '各自取代對應的右括號');
  await step(tok);                                   // 67:00 結果
  txt(big, show(T).replace(/\(/g, ''));
  say('刪掉所有括號：得到 postfix', '<span class="ok">AB/C−DE*+AC*−</span>');
  await step(tok);                                   // 67:10 兩個 pass
  say('壞處：要兩個 pass', '第一次 scan 加括號，第二次取代、再刪括號');
  await step(tok);                                   // 67:33 更快的方法？
  say('有沒有更快的方法？', '');
}]);
// 老師的 priority table：數字越小 priority 越高；左括號 ISP = 8、ICP = 0
const ISP = { '*': 2, '/': 2, '%': 2, '+': 3, '-': 3, '(': 8 }, ICP = { '*': 2, '/': 2, '%': 2, '+': 3, '-': 3, '(': 0 };
// steps: intro, [prio], one per token (an operator meeting an operator on top: compare + act), '#', result, [note]
FRAG.push(['sqpeng-ispicp', 'ISP / ICP：stack 一次 scan 轉 postfix', async (tok) => {
  fresh([0, 6, 13], [0, 2.8, 0]);
  const prm = ctx.params || {};
  const expr = prm.expr || 'A+B*C';
  const raw = expr.split('');
  const seen = {}, cntOp = {}; raw.forEach((t) => { if ('*/+-'.includes(t)) cntOp[t] = (cntOp[t] || 0) + 1; });
  const toks = raw.map((t) => { if ('*/+-'.includes(t) && cntOp[t] > 1) { seen[t] = (seen[t] || 0) + 1; return { t, n: t + '₁₂₃'[seen[t] - 1] }; } return { t, n: t }; });
  toks.push({ t: '#', n: '#' });
  const st = [], out = [];
  const pos = (k) => V3(-4.2, 0.45 + k * 0.9, 0);
  let tl, outL;
  const emit = (n) => { out.push(n); txt(outL, 'output：' + out.join(' ')); };
  const pushOp = (o) => { const m = cube(o.n, o.t === '(' ? '#9b7ef4' : '#c08a1f', [1.8, 0.8, 1.3], pos(st.length).x, pos(st.length).y, 0, 5); st.push({ t: o.t, n: o.n, m }); };
  await step(tok);                                   // intro
  tl = toks.map((o, k) => tag(o.n, 'idx', -2.4 + (k - (toks.length - 1) / 2) * 0.9, 5.6)); tl.forEach((l) => Object.assign(l.element.style, { fontSize: '16px' }));
  outL = tag('output：', 'ptr alt', 2.8, 4.2); Object.assign(outL.element.style, { fontSize: '14px' });
  tag('operator stack', 'idx', -4.2, 0, 1.3);
  say('Infix：' + expr + '　由左往右只 scan 一次', '用一個 stack 放 operator');
  if (prm.prio) {
    await step(tok);                                 // prio
    say('先乘除後加減：* 的 priority 比 + 高', '');
  }
  for (const [k, o] of toks.entries()) {
    const mark = () => tl.forEach((l, i) => { l.element.className = 'lab-label ' + (i === k ? 'ptr alt' : 'idx'); });
    if (o.t === '#') {
      await step(tok);                               // '#'
      mark();
      while (st.length) { const y = st.pop(); fly(y.m, V3(4, 6, 1)); emit(y.n); await beat(tok, 350); }
      say('讀到結尾 #：stack 裡剩下的 operator 全部 pop', '');
      break;
    }
    if (/[A-Z]/.test(o.t)) { await step(tok); mark(); emit(o.n); say('讀到 ' + o.n + '：不是 operator，直接 output', ''); continue; }
    if (o.t === ')') {
      await step(tok); mark();
      while (st.length && st[st.length - 1].t !== '(') { const y = st.pop(); fly(y.m, V3(4, 6, 1)); emit(y.n); await beat(tok, 400); }
      const lp = st.pop(); if (lp) fly(lp.m, V3(-3, 6, 1));
      say('讀到右括號：pop 到左括號為止', '左括號丟掉、不 output');
      continue;
    }
    const top = st[st.length - 1];
    if (o.t !== '(' && top && top.t !== '(') {
      await step(tok); mark();                       // compare
      glow(top.m, GOLD);
      const ok = ISP[top.t] <= ICP[o.t];
      say('比較：ISP(' + top.n + ') = ' + ISP[top.t] + ' ≤ ICP(' + o.n + ') = ' + ICP[o.t] + '？', ok ? '成立 → 先把 ' + top.n + ' pop 出來' : '不成立 → ' + o.n + ' 直接 push');
      await step(tok);                               // act
      glow(top.m, null);
      while (st.length && st[st.length - 1].t !== '(' && ISP[st[st.length - 1].t] <= ICP[o.t]) { const y = st.pop(); fly(y.m, V3(4, 6, 1)); emit(y.n); await beat(tok, 400); }
      pushOp(o);
      say(ok ? 'pop ' + top.n + ' 並 output，再 push ' + o.n : 'push ' + o.n, '');
      continue;
    }
    await step(tok); mark();                         // plain push
    pushOp(o);
    say(o.t === '(' ? '左括號：直接 push' : (top ? '頂端是左括號：' : 'stack 是空的：') + 'push ' + o.n, '');
  }
  await step(tok);                                   // result
  say('Postfix = ' + out.join(''), '<span class="ok">' + out.join(' ') + '</span>');
  if (prm.note) {
    await step(tok);                                 // note
    say(prm.note[0], prm.note[1] || '');
  }
}]);
FRAG.push(['sqpeng-prio-table', 'Priority table：數字越小越優先', async (tok) => {
  fresh([0, 5.5, 13], [0, 2.6, 0]);
  const rows = [['1', '單元 −、!'], ['2', '*  /  %'], ['3', '+  −'], ['4', '<  <=  >=  >'], ['5', '==  !='], ['6', '&&'], ['7', '||'], ['8', '( 在 stack 內（ISP）、#']];
  let bars, icp;
  await step(tok);                                   // 78:58 ISP：in-stack priority
  bars = rows.map(([p, ops], k) => {
    const h = 0.4 + (8 - k) * 0.55;
    const m = cube(p, k === 7 ? '#9b7ef4' : '#4b9ee2', [1.0, h, 1.0], -5.6 + k * 1.6, h / 2, 0);
    tag(ops, 'idx', -5.6 + k * 1.6, 0, 1.2); return m;
  });
  say('stack 裡的 operator：ISP（in-stack priority）', '剛讀到時：ICP（incoming priority）');
  await step(tok);                                   // 79:13 stack 頂端 y、讀到 x
  say('規則：stack 頂端的 operator 叫 y', '新讀到的 operator 叫 x');
  await step(tok);                                   // 79:26 ISP(y) ≤ ICP(x) → pop y
  say('ISP(y) ≤ ICP(x) 成立：把 y pop 出來', '否則 push x');
  await step(tok);                                   // 79:32 左括號在 stack 內：8
  glow(bars[7], GOLD);
  say('特別的是左括號：在 stack 內 ISP = 8', '最低，不會擋住別的 operator');
  await step(tok);                                   // 79:40 剛讀到的左括號：0
  icp = cube('ICP( = 0', '#d64545', [1.6, 4.8, 1.0], 6.2, 2.4, 0, 3);
  say('剛 scan 到左括號時，ICP = 0（最高）', '所以讀到 ( 一定 push');
  await step(tok);                                   // 79:54 priority table：越小越高
  glow(bars[7], null);
  say('Priority table：數字越小，priority 越高', '柱子越高 = 越優先');
  await step(tok);                                   // 80:02 乘除 mod 比加減優先
  glow(bars[1], GOLD); glow(bars[2], GOLD);
  say('* / % 是 2，+ − 是 3', '先乘除後加減');
  await step(tok);                                   // 80:44 程式 3.19
  glow(bars[1], null); glow(bars[2], null);
  say('課本 Program 3.19：讀 infix 直到 #', '遇到 operator 就檢查這條規則');
  await step(tok);                                   // 81:33 isp(y) ≤ icp(x) 就 pop
  say('isp(y) ≤ icp(x) 就把 y pop 出來', '');
  await step(tok);                                   // 82:05 higher priority 的英文
  say('英文說 higher priority', '指的是 priority 比較高');
  await step(tok);                                   // 82:36 數字大是 low priority
  say('不是 larger：數字越大反而是 low priority', '');
  await step(tok);                                   // 82:57 high 和 low 不一樣
  kill(icp);
  say('higher priority ＝ 表上的數字比較小', '不要被搞混');
}]);
FRAG.push(['sqpeng-multistack', 'Multiple stacks 與 Stack ≠ Array', async (tok) => {
  fresh([0, 7, 13], [0, 0.8, 0]);
  const N = 10, X = (i) => (i - 4.5) * 1.25;
  const all = [];
  let t1, t2;
  await step(tok);                                   // 83:21 multiple stacks
  for (let i = 0; i < N; i++) { ctx.tile(V3(X(i), 0.02, 0), 1.15, 1.3); tag('[' + i + ']', 'idx', X(i), 0.1, 1.1); }
  say('一個 array 裡可以有多個 stack 嗎？', '答案是可以（multiple stacks）');
  await step(tok);                                   // 83:36 一個從頭開始長
  t1 = tag('top1 = −1', 'ptr', X(0), 1.8);
  for (let k = 0; k < 4; k++) { all.push(cube('a' + (k + 1), '#4b9ee2', [1.0, 0.7, 1.0], X(k), 0.4, 0, 5)); txt(t1, 'top1 = ' + k); t1.position.set(X(k), 1.8, 0); await beat(tok, 300); }
  say('stack 1 從 array 的頭往後長', '');
  await step(tok);                                   // 83:40 另一個從尾巴開始漲
  t2 = tag('top2 = 10', 'ptr alt', X(9), 1.8);
  for (let k = 0; k < 4; k++) { all.push(cube('b' + (k + 1), '#dd8238', [1.0, 0.7, 1.0], X(9 - k), 0.4, 0, 5)); txt(t2, 'top2 = ' + (9 - k)); t2.position.set(X(9 - k), 1.8, 0); await beat(tok, 300); }
  say('stack 2 從尾巴往前長', '');
  await step(tok);                                   // 83:44 這就是兩個 stack
  all.push(cube('a5', '#4b9ee2', [1.0, 0.7, 1.0], X(4), 0.4, 0, 5)); txt(t1, 'top1 = 4'); t1.position.set(X(4), 1.8, 0);
  await beat(tok, 400);
  all.push(cube('b5', '#dd8238', [1.0, 0.7, 1.0], X(5), 0.4, 0, 5)); txt(t2, 'top2 = 5'); t2.position.set(X(5), 1.8, 0);
  say('這就是兩個 stack：空間共用', '兩個 top 碰在一起才算滿');
  await step(tok);                                   // 83:48 n 個 stack 也可以
  all.forEach((m) => fly(m, V3(0, 8, 3))); kill(t1); kill(t2);
  say('比兩個還多，n 個 stack 也可以', '');
  await step(tok);                                   // 83:54 決定 size，切 n 等份
  [[0, 3, '#4b9ee2'], [3, 6, '#dd8238'], [6, 10, '#9b7ef4']].forEach(([a, b, c], s) => {
    const g = ghostBox(c, X(b - 1) - X(a) + 1.15, 0.6, 1.3); g.position.set((X(a) + X(b - 1)) / 2, 0.35, 0);
    tag('stack ' + (s + 1), 'ptr', (X(a) + X(b - 1)) / 2, 1.5);
  });
  say('先決定每個 stack 的 size，把 array 切成 n 等份', '例：n = 3');
  await step(tok);                                   // 84:11 知道就好
  say('這個知道就好', '');
  await step(tok);                                   // 84:26 一個 array 不是只能一個 stack
  say('一個 array 不是只能放一個 stack', '一個 stack 也不是只能用 array 表示');
  await step(tok);                                   // 84:35 Stack ≠ Array
  say('Stack 並不等於 Array', '');
  await step(tok);                                   // 85:00 Array：(index, value) pair
  say('Array：(index, value) pair 的集合', '');
  await step(tok);                                   // 85:06 Stack：有限集合 + LIFO
  say('Stack：一個有限的集合', '再加上 last in, first out 的規則');
  await step(tok);                                   // 85:14 abstract data type
  say('stack 是一種 abstract data type（ADT）', 'array 只是實作它的一種方式');
}]);
  }

  // ═══ stklin.js ═══
  {
  // ─── -1FYYVpgyUo：林軒田 DSA（Analysis Tools 的 asymptotic notation ＋ Stack 入門） ───
  // cued scenes: each `await step(tok)` waits until the lecturer says that sentence; beats are motion only.
  const step = (tok) => ctx.step(tok);
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

  // 23:23 為什麼只要「大概」
  FRAG.push(['stklin-why-approx', '只要「大概」：常數不重要', async (tok) => {
    fresh([0, 5, 14], [0, 2.6, 0]);
    await step(tok);                                   // 24:26 一個一個 byte、一個一個指令去算
    const q = tag('要多少 byte？要多少個指令？', 'ptr', 0, 6.2);
    say('可以一個 byte、一個指令去算');
    await step(tok);                                   // 24:34 不需要 exact
    say('但很多時候不需要 exact', '只要「大概」就好');
    await step(tok);                                   // 25:00 int 4 bytes 還是 8 bytes
    txt(q, 'n 個 int：4 bytes 還是 8 bytes？看平台');
    say('細節跟平台有關', '');
    await step(tok);                                   // 25:08 2n 個指令要 2 秒還 20 秒
    txt(q, '2n 個指令：2 秒、20 秒還是 30 秒？看架構');
    say('細節跟計算機架構有關', '這些我們不太在意');
    await step(tok);                                   // 25:33 n 個指令還是 n² 個
    txt(q, '在乎的是：n 個指令，還是 n² 個指令？');
    say('只在乎大概：n 還是 n²', '');
    await step(tok);                                   // 25:49 asymptotic notation
    tag('描述「大概」的語言：asymptotic notation', 'ptr alt', 0, 7.0);
    say('描述「大概」的語言', 'asymptotic notation');
    await step(tok);                                   // 26:27 固定要花一秒鐘
    tag('固定成本', 'ptr alt', -4.6, 0, 1.6);
    const fx = bar(Y_, 1.3, 1.3, -4.6);
    await growBar(tok, fx, 1.6, 600);
    tag('1 秒', 'idx', -4.6, 2.1);
    say('假設某件事固定要花 1 秒', '不管資料多少');
    await step(tok);                                   // 26:37 100 筆、1000 筆、1 萬筆都 1 秒
    const N = [100, 1000, 10000], X = (k) => -1 + k * 2.6;
    N.forEach((v, k) => tag(v + ' 筆', 'idx', X(k), 0, 1.4));
    say('100 筆、1000 筆、1 萬筆', '都是那固定的 1 秒');
    await step(tok);                                   // 26:48 攤平到一萬筆：一萬分之一秒
    glow(fx, GOLD);
    say('1 萬筆資料攤平', '每筆只多 1/10000 秒');
    await step(tok);                                   // 26:56 100 筆要 100 個指令
    glow(fx, null);
    tag('跟資料量一起長的部分（高度為 log 尺度）', 'ptr', 1.6, 0, 2.6);
    const bs = N.map((v, k) => bar(B_, 1.3, 1.3, X(k)));
    await growBar(tok, bs[0], 1.2, 600); tag('100 個指令', 'idx', X(0), 1.6);
    say('100 筆要 100 個指令', '');
    await step(tok);                                   // 27:02 1000 筆 1000 個、1 萬筆 1 萬個
    await growBar(tok, bs[1], 2.9, 600); tag('1000 個指令', 'idx', X(1), 3.3);
    await growBar(tok, bs[2], 4.6, 600); tag('10000 個指令', 'idx', X(2), 5.0);
    say('1000 筆 1000 個、1 萬筆 1 萬個', '隨資料量成長');
    await step(tok);                                   // 27:30 資料量一大，浮出來
    bs.forEach((b) => glow(b, GOLD));
    say('資料一大，跟資料量有關的部分浮出來', '');
    await step(tok);                                   // 27:38 常數不那麼重要
    tint(fx, GRAY);
    say('常數（固定 1 秒、每步幾毫秒）', '就沒那麼重要了');
  }]);

  // 28:09 n³ vs 1126n
  FRAG.push(['stklin-n3-vs-1126n', 'n³ 與 1126n：n 夠大才看得出來', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.6;
    const map = (n, v) => V3(OX + n / 50 * W, OY + Math.min(v / 125000, 1.03) * H);
    axes(OX, OY, W, H, 'n', '步數');
    const b = plot((n) => 1126 * n, 0, 50, map, B_), r = plot((n) => n ** 3, 0, 50, map, R_);
    await step(tok);                                   // 28:20 兩個函數 f、g，隨 n 變大
    say('比兩個函數 f、g', '隨資料量 n 變大，誰長得快？');
    await step(tok);                                   // 28:45 f = n³
    await reveal(tok, r, 1600); tagV('n³', 'ptr alt', map(50, 125000), -0.7, 0.3);
    say('紅色：n³', '');
    await step(tok);                                   // 29:04 1126n，斜率很高
    await reveal(tok, b, 1200); tagV('1126n', 'ptr', map(50, 56300), 0.3, 0.4);
    say('藍色：1126n', '斜率很高的直線');
    await step(tok);                                   // 29:19 兩個選擇
    say('兩個演算法：n³ 與 1126n', '要選哪一個？');
    await step(tok);                                   // 29:45 資料不大：選紅色
    dot(map(10, 1000), R_); dot(map(10, 11260), B_);
    tagV('n = 10', 'idx', map(10, 11260), 0, 0.5);
    say('資料不大：選紅色 n³ 比較省', 'n = 10：1,000 < 11,260');
    await step(tok);                                   // 29:56 資料夠大：選藍色
    dot(map(50, 125000), R_); dot(map(50, 56300), B_);
    say('資料夠大：選藍色 1126n', 'n = 50：125,000 > 56,300');
    await step(tok);                                   // 30:14 不同區域情形不一樣
    const cx = Math.sqrt(1126);
    dot(map(cx, 1126 * cx), Y_, 0.3);
    tagV('交點 n = √1126 ≈ 33.6', 'ptr alt', map(cx, 1126 * cx), -1.8, 0.6);
    say('交點兩邊，答案不一樣', 'n³ = 1126n ⇔ n² = 1126');
    await step(tok);                                   // 30:40 n 夠大時的行為
    const sh = ghostBox(G_, W * 0.32, H, 0.2); sh.position.set(map(42, 0).x, OY + H / 2, -0.2);
    say('我們追求 n 夠大時的行為', 'asymptotic behavior');
    await step(tok);                                   // 30:46 所以叫 asymptotic notation
    tag('asymptotic notation：描述 n 夠大時「大概」怎樣', 'ptr', 0, 7.6);
    say('描述它的語言', 'asymptotic notation');
  }]);

  // 31:22 Big-O 的意思
  FRAG.push(['stklin-bigo-meaning', 'Big-O：長得比較慢或差不多', async (tok) => {
    fresh([0, 4.5, 14], [0, 3, 0]);
    await step(tok);                                   // 31:27 CS 的行話
    const jt = tag('行話：這一行描述事情的說法', 'ptr', 0, 7.6);
    say('Asymptotic notation 是一種「行話」', '');
    await step(tok);                                   // 31:51 當兵無線電：么、拐
    txt(jt, '行話：軍中無線電報「么、兩、拐」');
    say('像軍中無線電的說法', '圈內人一聽就懂');
    await step(tok);                                   // 32:11 直升機駕駛的錄音
    txt(jt, '行話：駕駛艙錄音裡的專業用語');
    say('像機師的專業用語', '');
    await step(tok);                                   // 32:24 asymptotic notation = CS 的行話
    txt(jt, 'asymptotic notation：電腦科學的行話');
    say('把它當成一個語言來學', '');
    await step(tok);                                   // 32:53 慢像 <、相等像 =
    const sym = tag('f 比 g 慢 ≈「<」　差不多 ≈「=」　合起來 ≈「≤」', 'idx', 0, 6.9);
    say('要說 f 長得比 g 慢，或差不多', '有點像 ≤');
    await step(tok);                                   // 33:04 f(n) = O(g(n))
    tag('f(n) = O(g(n))　念作 big O of g', 'ptr alt', 0, 6.2);
    say('寫成 f(n) = O(g(n))', 'big O of g');
    const OX = -6.2, OY = 0.3, W = 5.4, H = 5.0;
    const map = (n, v) => V3(OX + n / 10 * W, OY + Math.min(v / 100, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    await step(tok);                                   // 33:33 f 是 n，比 n² 慢
    const c1 = plot((n) => n, 0, 10, map, B_), c2 = plot((n) => n * n, 0, 10, map, R_);
    await reveal(tok, c1, 700); tagV('n', 'ptr', map(10, 10), 0.4, 0.2);
    await reveal(tok, c2, 900); tagV('n²', 'ptr alt', map(10, 100), 0.4, 0);
    say('n 跑得比 n² 慢', '');
    await step(tok);                                   // 33:47 寫成 n = O(n²)
    tagV('n = O(n²)', 'ptr', map(5, 25), 0.4, 1.2);
    say('所以寫成 n = O(n²)', '');
    await step(tok);                                   // 34:11 3n 比 n 慢或差不多
    const c3 = plot((n) => 3 * n, 0, 10, map, Y_);
    await reveal(tok, c3, 700); tagV('3n = O(n)', 'idx', map(10, 30), 0.6, 0);
    say('3n 跟 n 同一級：差不多', '3n = O(n)');
    await step(tok);                                   // 35:06 n → ∞，用除的來比
    tag('直覺：f / g，n 跑到無限大', 'ptr', 3.0, 5.0);
    say('怎麼比？n 很大時，把 f 和 g 相除', '');
    await step(tok);                                   // 35:19 極限 ≤ 某個常數
    tag('lim f/g ≤ c → f 被 g 包住', 'ptr alt', 3.0, 4.3);
    say('相除的極限 ≤ 某個常數 c', '沒有跑出去 → 被包住');
    await step(tok);                                   // 35:51 f=1,2,3；g=10,20,30
    const fl = tag('', 'idx', 3.0, 3.6);
    for (let k = 1; k <= 3; k++) {
      const x = 1.0 + (k - 1) * 2.0;
      const bf = bar(B_, 0.7, 0.7, x - 0.4), bg = bar(R_, 0.7, 0.7, x + 0.4);
      tag('f=' + k, 'idx', x - 0.4, 0, 0.8); tag('g=' + 10 * k, 'idx', x + 0.4, 0, 0.8);
      await Promise.all([growBar(tok, bf, 0.1 * k, 400), growBar(tok, bg, 1.0 * k, 600)]);
    }
    say('f = 1、2、3 時，g = 10、20、30', '');
    await step(tok);                                   // 36:01 一直是 1/10，沒有暴衝
    txt(fl, 'f / g 一直是 1/10');
    say('相除一直是 1/10：沒有暴衝出去', 'f = O(g)');
    await step(tok);                                   // 36:58 big O 最常用
    say('Big O：電腦科學最常被使用的行話', '當之無愧');
  }]);

  // 37:21 O(n²) 是集合、也像 ≤
  FRAG.push(['stklin-bigo-set', 'O(n²) 是一個函數的集合', async (tok) => {
    fresh([0, 6.5, 13], [0, 1.5, 0]);
    await step(tok);                                   // 37:26 O(n²) 比較像一個集合
    const S = ghostBox(B_, 7, 2.6, 4.2); S.position.set(-2, 1.3, 0);
    tag('O(n²)：長得比 n² 慢或差不多', 'ptr', -2, 3.1);
    say('O(n²) 像一個集合', '裡面有各式各樣的函數');
    const F = ['n', 'n²', '0.1n²', '3n²', '√n'], ms = [];
    const put = async (k) => {
      const x = -4.4 + (k % 3) * 2.4 + (k >= 3 ? 1.2 : 0), z = k < 3 ? -0.9 : 0.9;
      ms.push(cube(F[k], k === 1 ? R_ : B_, [1.5, 0.6, 1.0], x, 0.3, z, 5)); await beat(tok, 450);
    };
    await step(tok);                                   // 37:42 n、n²、0.1n²
    for (let k = 0; k < 3; k++) await put(k);
    say('n：比 n² 慢；n²、0.1n²：差不多', '都在 O(n²) 裡');
    await step(tok);                                   // 37:50 3n²
    await put(3);
    say('3n²：差不多', '也在裡面');
    await step(tok);                                   // 37:59 √n
    await put(4);
    say('√n：比 n² 慢', '也在裡面');
    await step(tok);                                   // 38:06 「=」其實像「屬於」
    tag('「=」比較像「∈」：n ∈ O(n²)', 'ptr alt', -2, 4.0);
    say('所以「=」其實有點像「屬於」', 'n = O(n²) 意思是 n ∈ O(n²)');
    await step(tok);                                   // 38:23 同一個函數屬於很多集合
    const S3 = ghostBox(O_, 9.6, 3.2, 5.4); S3.position.set(-1.2, 1.6, 0);
    tag('O(n³)', 'ptr', 3.0, 3.6);
    say('同一個函數可以屬於好多個集合', 'Big O 描述的是一個性質');
    await step(tok);                                   // 38:45 像「≤」的排序
    ms.forEach((m) => glow(m, GOLD));
    say('另一個看法：像函數之間的「≤」', '比的是 n 夠大時的大小');
    await step(tok);                                   // 39:25 之後證遞移律
    ms.forEach((m) => glow(m, null));
    tag('f ≤ g、g ≤ h ⇒ f ≤ h？（等一下證）', 'idx', -2, 4.8);
    say('之後會證明類似不等式的遞移律', '');
    await step(tok);                                   // 40:10 1126n = O(n)？
    cube('1126n', Y_, [1.6, 0.6, 1.0], 4.6, 0.3, 2.6, 5);
    tag('O(n)', 'ptr alt', 4.6, 1.4, 2.6);
    say('常數不重要：1126n = O(n) 嗎？', '');
    await step(tok);                                   // 40:16 相除 1126 ≤ 固定數字
    tag('1126n / n = 1126 ≤ c ✓', 'ptr', 4.6, 2.1, 2.6);
    say('相除 = 1126，≤ 某個固定數字', '所以 1126n = O(n)');
    await step(tok);                                   // 40:37 左邊是真實步數
    const mainT = cube('主要項', R_, [1.8, 0.8, 1.2], 0, 0.4, 3.6, 4);
    const sub = [cube('次要項', B_, [1.1, 0.4, 0.8], -2.4, 0.2, 3.6, 4), cube('常數', GRAY, [0.9, 0.4, 0.8], 2.2, 0.2, 3.6, 4)];
    say('左邊常是「真實」要花的步數', '右邊是「大概」');
    await step(tok);                                   // 40:54 次要項被吃掉
    sub.forEach((m) => move(m, 0, 0.4, 3.6));
    await beat(tok, 700);
    sub.forEach(kill);
    say('長得比較慢的次要項，通通被吃掉', '');
    await step(tok);                                   // 41:16 只留主要項寫進 O
    glow(mainT, GOLD);
    say('刪掉次要項、丟掉常數', '留下主要項寫進 O( )');
  }]);

  // 41:56 formal definition ＋ |sin n|
  FRAG.push(['stklin-formal-def', 'Formal 定義：n ≥ n0 時 f ≤ c·g', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.4;
    const map = (n, v) => V3(OX + n / 14 * W, OY + Math.min(v / 14, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    await step(tok);                                   // 41:59 lim f/g ≤ c 寫得不 rigorous
    tag('直覺：lim f/g ≤ c（不嚴謹）', 'idx', 0, 7.4);
    say('剛才的極限版本只是直覺', '寫得不 rigorous');
    await step(tok);                                   // 42:09 假設 f、g 都是正的
    tag('先假設 f、g 都是正函數', 'idx', 0, 6.9);
    say('避免除以零之類的麻煩', 'f、g 都是正的');
    const f = (n) => 0.5 * n + 3 + 0.8 * Math.sin(1.3 * n);
    const cg = plot((n) => n, 0, 14, map, R_), fl = plot(f, 0, 14, map, B_, 140);
    await step(tok);                                   // 42:47 f 要比 c·g 小
    await reveal(tok, cg, 900); tagV('c·g(n)', 'ptr alt', map(14, 14), -0.4, 0.3);
    await reveal(tok, fl, 1200); tagV('f(n)', 'ptr', map(14, f(14)), 0.5, 0);
    say('真正的定義：f 要 ≤ c 乘上 g', '');
    await step(tok);                                   // 43:02 n 夠大：n0
    const x0 = map(8, 0).x;
    line(x0, OY, x0, OY + H, 0, Y_); tag('n0', 'ptr alt', x0, 0, 0.6);
    for (let n = 8; n <= 14; n++) { dot(map(n, f(n)), G_, 0.18); await beat(tok, 150); }
    say('只要 n ≥ n0 之後成立就好', 'n0 之前怎樣都沒關係');
    await step(tok);                                   // 43:44 極限版要求極限存在，比較嚴格
    say('為什麼不用極限版？', '極限版要求「極限要存在」，比較嚴格');
    await step(tok);                                   // 44:18 f = |sin n|、g = 1
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const map2 = (n, v) => V3(OX + n / 40 * W, OY + v / 1.4 * H);
    axes(OX, OY, W, H, 'n', '');
    const one = plot(() => 1, 0, 40, map2, R_, 2), s = plot((n) => Math.abs(Math.sin(n)), 0, 40, map2, B_, 400);
    await reveal(tok, one, 500); tagV('g(n) = 1', 'ptr alt', map2(40, 1), 0.2, 0.45);
    say('例子：f(n) = |sin n|、g(n) = 1', 'f / g = |sin n|');
    await step(tok);                                   // 44:33 |sin n| 長這樣
    await reveal(tok, s, 2200); tagV('|sin n|', 'ptr', map2(40, 0.75), 0.7, 0);
    say('|sin n| 長這個樣子', '');
    await step(tok);                                   // 44:43 不收斂，跳來跳去
    tag('lim |sin n| 不存在', 'ptr alt', 0, 7.4);
    say('n 再大也不收斂，一直跳上跳下', '極限不存在 → 直覺版用不了');
    await step(tok);                                   // 45:11 一直被 1 壓住
    for (let n = 1; n <= 40; n++) dot(map2(n, Math.abs(Math.sin(n))), G_, 0.13);
    say('但它一直被 1 壓在下面', 'c = 1：|sin n| ≤ 1 → |sin n| = O(1)');
    await step(tok);                                   // 45:59 定義比較廣
    say('Formal 定義比較廣', '沒有極限的情形也包進來了');
    await step(tok);                                   // 46:21 n 夠大時 f 被 c·g 壓住
    say('n 夠大時，f 一直被 c·g 壓住', '這就是 formal definition');
  }]);

  // 46:56 證明：limit ⇒ Big-O
  FRAG.push(['stklin-lim-proof', '證明：lim f/g ≤ c ⇒ f = O(g)', async (tok) => {
    fresh([0, 4.4, 14.5], [0, 4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 5.6, C = 3, E = 0.5;
    const map = (n, v) => V3(OX + n / 30 * W, OY + Math.min(v / 10, 1.03) * H);
    axes(OX, OY, W, H, 'n', 'f/g');
    const cd = code(['lim f(n)/g(n) = c', '給 ε → 有 n0：n > n0 ⇒ |f/g − c| < ε', 'n > n0 ⇒ f/g < c + ε', '改名：c′ = c + ε，n0′ = n0', 'n ≥ n0′ ⇒ f ≤ c′·g  ∴ f = O(g)'], 1.2, 9.4, 0.5);
    const r = (n) => C + 6 / n;
    const ds = [];
    await step(tok);                                   // 46:56 兩個 positive function，滿足 limit
    cd.hl(0);
    for (let n = 1; n <= 30; n++) { ds.push(dot(map(n, r(n)), B_, 0.17)); await beat(tok, 50); }
    const yc = map(0, C).y;
    hl(OX, W, yc, R_); tag('c = 3', 'ptr alt', OX - 0.7, yc);
    say('已知：兩個正函數，f/g 的極限是 c', '舉例：f/g = 3 + 6/n → c = 3');
    await step(tok);                                   // 47:10 目標：Big O 的定義
    const goal = tag('目標：找 c、n0，使 n ≥ n0 時 f ≤ c·g', 'ptr', 0, 6.8);
    say('要證的是 Big O 的定義', '找得到 c 和 n0');
    await step(tok);                                   // 47:30 limit 的定義
    cd.hl(1);
    hl(OX, W, map(0, C + E).y, Y_); hl(OX, W, map(0, C - E).y, Y_);
    tag('c ± ε', 'idx', OX + W + 0.5, map(0, C + E).y);
    say('Limit 的定義：有 ε、有 n0', 'n0 之後 f/g 和 c 差不到 ε');
    await step(tok);                                   // 48:01 給任何 ε 都有 n0
    say('嚴格說：給任何 ε，都找得到 n0', '');
    await step(tok);                                   // 48:14 我們只需要一個
    const x0 = map(12, 0).x;
    line(x0, OY, x0, OY + H, 0, Y_); tag('n0 = 12', 'ptr alt', x0, 0, 0.7);
    ds.forEach((d, i) => { if (i + 1 > 12) tint(d, G_); });
    say('我們只需要一個 ε 和它的 n0', 'ε = 0.5 → n0 = 12');
    await step(tok);                                   // 48:57 n > n0 時 f/g < c + ε
    cd.hl(2);
    say('只要上半邊：f/g < c + ε', 'n > 12 時 f/g < 3.5');
    await step(tok);                                   // 49:13 重新取名
    cd.hl(3);
    say('重新取名：c′ = c + ε、n0′ = n0', 'c′ = 3.5、n0′ = 12');
    await step(tok);                                   // 49:26 < 改成 ≤ 有點 tricky
    say('嚴格說 < 要改成 ≤', '這裡稍微忽略這個細節');
    await step(tok);                                   // 49:39 滿足 Big O 定義
    cd.hl(4); txt(goal, '找到了：c′ = 3.5、n0′ = 12 ✓');
    say('符合 Big O 的定義：證完', 'Limit（直覺）⇒ Formal（定義）');
    await step(tok);                                   // 50:15 formal vs intuitive
    cd.hl(-1);
    say('Formal：n ≥ n0 時 f ≤ c·g', 'Intuitive：相除看誰跑得快');
    await step(tok);                                   // 50:57 intuition 像藝術家的想像
    tag('Intuition：像建築師腦中的藍圖', 'ptr', -3, 7.6);
    say('直覺：幫你想像、跟人描述', '');
    await step(tok);                                   // 51:20 definition 一步一步蓋起來
    tag('Definition：一磚一瓦蓋起來', 'ptr alt', 3, 7.6);
    say('定義：從數學出發，一步一步蓋起來', '');
    await step(tok);                                   // 52:03 兩件事都要知道
    say('直覺和定義兩個都要懂', '才是紮實的 computer scientist');
  }]);

  // 53:09 Q&A：分塊 array，極限不存在但被常數壓住
  FRAG.push(['stklin-chunk-array', '分塊 array：不收斂也能是 O(1)', async (tok) => {
    fresh([0, 6, 13], [0, 1.6, 0]);
    await step(tok);                                   // 53:09 書籍用 formal 定義
    const t1 = tag('書上的定義：n ≥ n0 時 f ≤ c·g', 'ptr', 0, 6.8);
    say('大部分書不用極限定義 Big O', '用的是 formal definition');
    await step(tok);                                   // 53:47 limit 是充分條件
    const t2 = tag('lim f/g ≤ c ⇒ f = O(g)：充分條件', 'ptr alt', 0, 6.1);
    say('Limit 是 Big O 的 sufficient condition', '它對，Big O 就對');
    await step(tok);                                   // 53:56 不是必要條件
    const t3 = tag('f = O(g) ⇏ 極限存在（例：|sin n|）', 'idx', 0, 5.4);
    say('但不是 necessary condition', 'Big O 成立時，極限不一定存在');
    await step(tok);                                   // 55:08 有沒有 sin 的例子？
    say('同學問：一般演算法會出現這種', '跳來跳去的函數嗎？');
    await step(tok);                                   // 55:59 array 每 100 筆一小段
    [t1, t2, t3].forEach(kill);
    const fills = [1, 1, 1, 0.37], blocks = [];
    for (let k = 0; k < 4; k++) {
      const x = -5.1 + k * 3.4;
      const shell = ghostBox('#c9b48e', 2.4, 0.8, 1.2); shell.position.set(x, 0.4, 0);
      const fl = lab.box(B_, [2.4, 0.6, 1.0]); fl.scale.x = fills[k]; fl.position.set(x - 1.2 + 1.2 * fills[k], 0.3, 0); lab.world.add(fl);
      tag('第 ' + (k + 1) + ' 塊（100 筆）', 'idx', x, 0, 1.1);
      blocks.push({ fl, x });
      await beat(tok, 350);
    }
    say('array 化整為零：每 100 筆一小塊', '');
    await step(tok);                                   // 56:30 用類似 linked list 串起來
    for (let k = 1; k < 4; k++) arrow(V3(blocks[k - 1].x + 1.25, 0.4, 0), V3(blocks[k].x - 1.25, 0.4, 0));
    say('塊與塊之間，用類似 linked list 串起來', '');
    await step(tok);                                   // 56:44 像 linked list 一樣跳
    const hop = tag('▼', 'ptr alt', blocks[0].x, 1.4);
    for (let k = 1; k < 4; k++) { await anim(tok, 400, (t) => { hop.position.x = blocks[k - 1].x + (blocks[k].x - blocks[k - 1].x) * t; }); }
    say('一個成分：在區塊之間跳', '像 linked list');
    await step(tok);                                   // 56:50 塊裡像 array，看有多滿
    const last = blocks[3];
    const meterS = ghostBox(R_, 6, 0.5, 0.5); meterS.position.set(0, 3.2, 0);
    const meter = lab.box(R_, [6, 0.4, 0.4]); meter.position.set(0, 3.2, 0); lab.world.add(meter);
    meter.scale.x = 0.37; meter.position.x = -3 + 3 * 0.37;
    tag('塊內成本', 'ptr', -4.2, 3.2); tag('上限 100', 'ptr alt', 3.6, 3.9);
    const mv = tag('這次 = 37', 'idx', 0, 3.9);
    say('另一個成分：在塊裡像 array', '花的力氣跟這塊有多滿有關');
    await step(tok);                                   // 57:07 小小會跳動的常數
    for (const v of [80, 5, 99, 52, 100, 12]) {
      const p = Math.max(v, 2) / 100;
      last.fl.scale.x = p; last.fl.position.x = last.x - 1.2 + 1.2 * p;
      meter.scale.x = p; meter.position.x = -3 + 3 * p;
      txt(mv, '這次 = ' + v);
      await beat(tok, 380);
    }
    say('像 sin、cos 一樣：小小的、會跳動', '');
    await step(tok);                                   // 57:21 當成 constant，O(1)
    tag('O(1)', 'ptr alt', 0, 4.7);
    say('我們直接把它當成 constant', 'O(1)');
    await step(tok);                                   // 57:33 0~100 跳，不收斂但被壓住
    line(-3, 3.65, 3, 3.65, 0, R_);
    say('在 0 到 100 之間跳，一點也不收斂', '但永遠 ≤ 100 → 被常數壓著');
    await step(tok);                                   // 57:56 證了 limit，formal 一定成立嗎
    say('證得出 limit 版本，formal 就一定成立嗎？', '');
    await step(tok);                                   // 58:27 兩條路
    tag('路 ①：證 limit 存在且 ≤ c', 'ptr', -3.2, 5.6); tag('路 ②：直接找出 c 和 n0', 'ptr alt', 3.2, 5.6);
    say('成立！證明有兩條路', '證 limit 存在且 ≤ c｜或直接找出 c、n0');
    await step(tok);                                   // 58:57 正函數拆不拆絕對值都一樣
    say('f、g 都是正函數時', '拆不拆絕對值沒差；麻煩的是負函數');
  }]);

  // 74:10 Ω 與 Θ
  FRAG.push(['stklin-omega-theta', 'Big Omega 與 Big Theta', async (tok) => {
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const OX = -5.5, OY = 0.3, W = 11, H = 6.4;
    const map = (n, v) => V3(OX + n / 12 * W, OY + Math.min(v / 24, 1.03) * H);
    axes(OX, OY, W, H, 'n', '');
    const f = (n) => n * (1.2 + 0.35 * Math.sin(n * 1.4));
    const fl = plot(f, 0, 12, map, B_, 160), up = plot((n) => 2 * n, 0, 12, map, R_), lo = plot((n) => 0.5 * n, 0, 12, map, G_);
    await step(tok);                                   // 74:10 formal 是真理的來源
    tag('Formal 定義：真理的來源　Intuitive：幫助想像', 'idx', 0, 7.5);
    say('Formal 定義是一切真理的來源', '直覺幫我們想像 well-behaved 的函數');
    await step(tok);                                   // 74:48 Big Omega
    say('另一個重要成員', 'Big Omega（Ω）');
    await step(tok);                                   // 74:57 Big O 是上限
    await reveal(tok, fl, 1000); tagV('f(n)', 'ptr', map(12, f(12)), 0.6, 0);
    await reveal(tok, up, 800); tagV('c₂·g：O 上限', 'ptr alt', map(12, 24), -0.6, 0.3);
    say('Big O 是上限，像 ≤', 'f(n) ≤ c·g(n)');
    await step(tok);                                   // 75:22 Omega 是下限
    await reveal(tok, lo, 800); tagV('c₁·g：Ω 下限', 'ptr', map(12, 6), 0.9, 0);
    say('Big Omega 是下限，像 ≥', '定義一模一樣，只差不等號方向');
    await step(tok);                                   // 75:48 又 O 又 Ω → Θ
    tag('又 O 又 Ω → Θ（差不多）', 'ptr alt', 0, 6.9);
    say('又有上限又有下限', 'Big Theta：差不多');
    await step(tok);                                   // 76:15 c 要大於 0
    say('小細節：這些 c 都要 > 0', '');
    await step(tok);                                   // 76:24 f/g 收斂到 8
    fresh([0, 4.2, 14], [0, 3.4, 0]);
    const map2 = (n, v) => V3(OX + n / 40 * W, OY + Math.max(0, Math.min(v / 14, 1.03)) * H);
    axes(OX, OY, W, H, 'n', 'f/g');
    const y8 = map2(0, 8).y;
    hl(OX, W, y8, R_); tag('8', 'ptr alt', OX - 0.5, y8);
    const r = (n) => 8 + 14 * Math.cos(n) / n;
    const ds = [];
    for (let n = 1; n <= 40; n++) { ds.push(dot(map2(n, r(n)), B_, 0.16)); await beat(tok, 40); }
    say('假如 f/g 最後收斂到 8', '');
    await step(tok);                                   // 76:36 夾在 8 ± ε
    hl(OX, W, map2(0, 9).y, Y_); hl(OX, W, map2(0, 7).y, Y_);
    tag('8 + ε', 'idx', OX + W + 0.6, map2(0, 9).y); tag('8 − ε', 'idx', OX + W + 0.6, map2(0, 7).y);
    ds.forEach((d, i) => { if (i + 1 > 14) tint(d, G_); });
    say('n 夠大時，f/g 在 8 − ε 和 8 + ε 之間', '');
    await step(tok);                                   // 76:56 上面 O、下面 Ω
    tag('上面 → O', 'ptr alt', 3.5, map2(0, 9).y + 0.5); tag('下面 → Ω', 'ptr', 3.5, map2(0, 7).y - 0.5);
    say('上面那條符合 O、下面那條符合 Ω', '兩邊都成立 → Θ');
    await step(tok);                                   // 77:10 收斂到常數 → 差不多
    say('相除收斂到一個常數', '常數又不算 → f 和 g 差不多：Θ');
    await step(tok);                                   // 77:40 Big O 八成
    tag('實務上：Big O 約八成，Ω、Θ 合起來一成多', 'ptr', 0, 7.5);
    say('實務上 Big O 最常用', '大一先搞懂 Big O 最重要');
  }]);

  // 78:28 七個常用函數
  FRAG.push(['stklin-seven-funcs', '七個常用函數與 log 的底', async (tok) => {
    fresh([0, 4.2, 14.5], [0, 3.2, 0]);
    const SEV = [['1', 1, '常數'], ['log n', 4, 'logarithmic'], ['n', 16, 'linear'], ['n log n', 64, ''], ['n²', 256, 'square'], ['n³', 4096, 'cubic'], ['2ⁿ', 65536, 'exponential']];
    const bars = [];
    tag('以 n = 16 為例（高度是 log 尺度）', 'idx', 0, 7.6);
    const show = async (k) => {
      const [nm, v] = SEV[k], x = -6 + 2 * k, h = 0.4 + Math.log2(v) * 0.38;
      tag(nm, 'ptr', x, 0, 1.3);
      const b = bar(colorFor(k), 1.2, 1.2, x); bars[k] = b;
      await growBar(tok, b, h, 500);
      tag(v.toLocaleString(), 'idx', x, h + 0.4);
    };
    await step(tok);                                   // 78:28 七個常用函數
    say('課本的七個常用函數', '這學期幾乎都會用到');
    await step(tok);                                   // 78:55 1：常數
    await show(0);
    say('1：被某個常數壓住', '常數函數');
    await step(tok);                                   // 79:22 寫 2、5、1126 也行
    say('寫 2、5、1126 也可以', '大家習慣寫 1');
    await step(tok);                                   // 79:44 增加 1 漲一點：linear
    await show(2);
    say('n：linear（線性）', '資料多 1，就漲一點');
    await step(tok);                                   // 79:52 square、cubic
    await show(4); await show(5);
    say('n²：square　n³：cubic', '');
    await step(tok);                                   // 79:59 polynomial；三次方跑不動
    glow(bars[4], RED); glow(bars[5], RED);
    say('多項式成長', '三次方、甚至二次方，資料一大就不一定跑得動');
    await step(tok);                                   // 80:27 log n
    glow(bars[4], null); glow(bars[5], null);
    await show(1);
    say('log n：還會長，但長得比 n 慢', '');
    await step(tok);                                   // 81:13 log 以 10 還是 2 為底？
    tag('log₁₀？log₂？', 'ptr alt', -4, 5.8);
    say('log 的底是 10 還是 2？', '不太重要');
    await step(tok);                                   // 81:43 換底只差一個常數
    tag('log₂ n = log₁₀ n ÷ log₁₀ 2 ≈ 3.32·log₁₀ n', 'ptr', -1.6, 6.6);
    say('換底只差一個常數倍', '常數吸收進 c → 底不重要');
    await step(tok);                                   // 82:33 log n 介於 1 和 n
    glow(bars[1], GOLD);
    say('log n 夾在 1 和 n 中間', '');
    await step(tok);                                   // 82:47 n log n 介於 n 和 n²
    glow(bars[1], null);
    await show(3); glow(bars[3], GOLD);
    say('n log n 夾在 n 和 n² 中間', '');
    await step(tok);                                   // 83:04 exponential 2ⁿ
    glow(bars[3], null);
    await show(6);
    say('長得很快的：exponential 2ⁿ', '');
    await step(tok);                                   // 83:22 老師：5ⁿ、1126ⁿ 也能換底吸收？
    glow(bars[6], RED);
    tag('更正：5ⁿ / 2ⁿ = 2.5ⁿ → ∞，5ⁿ ≠ O(2ⁿ)', 'ptr alt', 3.6, 7.0);
    say('老師說指數也能換底吸收——這裡要小心！', '指數的底不能隨便換，只有 log 的底可以');
    await step(tok);                                   // 83:50 各自的名字
    say('七個函數各有名字', 'logarithmic、linear、exponential…');
  }]);

  // 84:38 sequential search
  FRAG.push(['stklin-seq-search', 'Sequential search：最差 Θ(n)', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const A = [7, 3, 9, 1, 6, 4, 8, 2], X = (i) => -5.25 + i * 1.5;
    const cs = A.map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.1); return cube(v, B_, [1.1, 0.7, 1.1], X(i), 0.35, 0); });
    const cur = tag('▼ i', 'ptr alt', X(0), 1.5);
    const cnt = tag('', 'ptr', 0, 3.2);
    await step(tok);                                   // 84:38 從頭找到尾
    say('Sequential search：從頭找到尾', '找到就傳回；找不到就說找不到');
    await step(tok);                                   // 84:50 最佳：第一輪就找到
    glow(cs[0], GREEN); txt(cnt, '找 7：比較 1 次');
    say('最佳：第一輪就找到', '只花常數時間');
    await step(tok);                                   // 85:12 最差：整個 array 跑完
    glow(cs[0], null);
    for (let i = 0; i < A.length; i++) {
      cur.position.x = X(i); glow(cs[i], GOLD); txt(cnt, '找 5：比較 ' + (i + 1) + ' 次');
      await beat(tok, 260);
      glow(cs[i], null); tint(cs[i], GRAY);
    }
    say('最差：整個 array 跑完才說找不到', '比較了 n = 8 次');
    await step(tok);                                   // 85:20 大概 n 的時間
    say('最差大概要花 n 的時間', '');
    await step(tok);                                   // 85:27 Θ：有上限有下限，5n + 7
    tag('最差 ≈ 5n + 7 步 → Θ(n)', 'ptr alt', 0, 4.0);
    say('例如 5n + 7 步', '有上限也有下限 → Θ(n)');
    await step(tok);                                   // 85:50 O(n) algorithm
    tag('O(n) algorithm', 'ptr', 0, 4.8);
    say('叫它 O(n) 的 algorithm', '');
    await step(tok);                                   // 86:03 linear complexity
    say('也叫 linear complexity algorithm', '力氣跟 array 大小 n 成正比');
  }]);

  // 86:18 binary search
  FRAG.push(['stklin-binsearch', 'Binary search：每次砍一半 → log n', async (tok) => {
    fresh([0, 6, 12.5], [0, 1, 0]);
    const X = (i) => -6 + i * 0.8;
    const cs = []; for (let i = 0; i < 16; i++) cs.push(cube((i + 1) * 3, B_, [0.62, 0.5, 0.62], X(i), 0.25, 0));
    const rd = tag('剩 16 個', 'ptr', 0, 3.4), chain = tag('16', 'ptr alt', 0, 4.4);
    let lo = 0, hi = 15, seq = '16';
    const round = async () => {
      const mid = (lo + hi) >> 1;
      glow(cs[mid], GOLD); await beat(tok, 300);
      for (let i = lo; i <= mid; i++) { glow(cs[i], null); tint(cs[i], GRAY); }
      lo = mid + 1;
      const left = hi - lo + 1;
      txt(rd, '剩 ' + left + ' 個'); if (left) { seq += ' → ' + left; txt(chain, seq); }
      await beat(tok, 300);
    };
    await step(tok);                                   // 86:26 最佳：第一輪就找到
    glow(cs[7], GREEN);
    say('Binary search 最佳：第一輪就找到', '運氣好而已');
    await step(tok);                                   // 86:38 在乎的是最壞
    glow(cs[7], null);
    say('我們在乎的是最壞情況', '例：要找 50（比全部都大）');
    await step(tok);                                   // 86:51 只看中心，偷吃步
    glow(cs[7], GOLD);
    say('每次只看中間那一個', 'A[7] = 24 < 50');
    await step(tok);                                   // 87:07 這一半先丟掉
    await round();
    say('左半邊都不是要的：先丟掉', '每次至少丟掉一半');
    await step(tok);                                   // 87:21 8 → 4 → 2 → 1
    await round(); await round(); await round();
    say('第 2 輪剩 4、第 3 輪剩 2、第 4 輪剩 1', '');
    await step(tok);                                   // 87:29 其實更 aggressive
    say('其實每輪還多丟掉中間那一個', '保守一點：說它至少砍一半');
    await step(tok);                                   // 87:50 中間有幾個箭頭
    say('16 → 8 → 4 → 2 → 1', '中間有 4 個箭頭');
    await step(tok);                                   // 88:07 取 log₂
    tag('log₂ 16 = 4', 'ptr alt', 0, 5.3);
    say('取 log₂ 就知道砍幾輪', '最差大約 log n 輪');
    await step(tok);                                   // 88:28 if、比較只是常數
    say('每輪裡的 if、比較', '最多常數那麼多個，不重要');
    await step(tok);                                   // 88:40 連 2 也不寫
    tag('O(log n)', 'ptr', 0, 6.1);
    say('連底數 2 也不寫', '差不多 log n 輪');
    await step(tok);                                   // 89:03 第一個 log n 的 algorithm
    fresh([0, 5, 13], [0, 2.8, 0]);
    tag('Sequential', 'ptr', -2.2, 0, 1.4); tag('Binary', 'ptr alt', 2.2, 0, 1.4);
    const bs = bar(B_, 1.6, 1.6, -2.2), bb = bar(O_, 1.6, 1.6, 2.2);
    say('第一個 log n 的 algorithm', 'sequential：100 個要 100 的力氣');
    await step(tok);                                   // 89:18 n = 1000：log ≈ 10
    tag('n = 1000（2¹⁰ = 1024 → log₂ 1000 ≈ 10）', 'ptr', 0, 6.8);
    say('n = 1000：binary 約 10 輪', 'sequential 要 1000 輪');
    await step(tok);                                   // 89:44 sequential：1000 × 10
    await growBar(tok, bs, 5.5, 900); tag('10,000', 'idx', -2.2, 5.9);
    say('Sequential：每輪算 10 個指令', '1000 × 10 = 1 萬');
    await step(tok);                                   // 89:51 binary：10 × 50
    await growBar(tok, bb, 0.28, 500); tag('500', 'idx', 2.2, 0.7);
    say('Binary：每輪算 50 個指令', '10 × 50 = 500');
    await step(tok);                                   // 90:28 資料夠大 binary 一定贏
    glow(bb, GREEN);
    say('資料夠大時，binary search 一定贏', '每輪多花一點力氣也沒關係');
    await step(tok);                                   // 90:39 worst-case analysis
    tag('Worst-case analysis', 'ptr alt', 0, 7.6);
    say('Big O ＝ 最差情況分析', '告訴我們資料量大時大概要跑多久');
    await step(tok);                                   // 91:13 作業 2：小資料 vs 中資料
    say('作業 2：中資料是小資料的 10 倍', '能估出慢幾倍，就知道該怎麼測');
  }]);

  // 92:45 沒排序：直接找 vs 排序再找
  FRAG.push(['stklin-sort-or-not', '直接找，還是先排序再找？', async (tok) => {
    fresh([0, 6, 13], [0, 1.2, 0]);
    const U = [5, 2, 8, 1, 9, 3], X = (i) => -3.75 + i * 1.5;
    const cs = U.map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.1); return cube(v, colorFor(v), [1.1, 0.7, 1.1], X(i), 0.35, 0); });
    const m1 = tag('', 'ptr', -2.5, 3.6), m2 = tag('', 'ptr alt', 2.5, 3.0);
    await step(tok);                                   // 92:45 還沒排好
    say('array 還沒排好，要找東西？', '');
    await step(tok);                                   // 92:52 方法一：直接 sequential search
    txt(m1, '方法一：直接 sequential search');
    for (const c of cs) { glow(c, GOLD); await beat(tok, 180); glow(c, null); }
    say('方法一：排都不排，直接找', '');
    await step(tok);                                   // 92:59 方法二：先排序再 binary search
    txt(m2, '方法二：先排序，再 binary search');
    say('方法二：先排一排，再 binary search', '');
    await step(tok);                                   // 93:22 sequential ≈ n
    txt(m1, '方法一：sequential search ≈ n');
    say('方法一最多約 n 的時間', '');
    await step(tok);                                   // 93:35 binary ≈ log n；排序呢？
    txt(m2, '方法二：排序 ? + binary search log n');
    say('binary search 要 log n', '排序要多少？');
    await step(tok);                                   // 93:48 selection sort：每次選一個（getMinIndex）
    const a = [...U];
    for (let i = 0; i < a.length; i++) {
      let m = i; for (let j = i; j < a.length; j++) if (a[j] < a[m]) m = j;
      glow(cs[m], GOLD);
      if (m !== i) { move(cs[i], X(m), 0.35); move(cs[m], X(i), 0.35); [a[i], a[m]] = [a[m], a[i]]; [cs[i], cs[m]] = [cs[m], cs[i]]; }
      await beat(tok, 350);
      glow(cs[i], null); tint(cs[i], G_);
    }
    say('Selection sort：每次選一個最小的出來', '選的過程就是 getMinIndex');
    await step(tok);                                   // 93:58 跑 n 次，每次 sequential search
    say('跑 n 次，每次做一次 sequential search', '');
    await step(tok);                                   // 94:04 大概 n²
    txt(m2, '方法二 ≈ n² + log n');
    say('n 次 × 每次約 n', '大概 n²');
    await step(tok);                                   // 94:10 n vs n² 與 log n 怎麼比
    say('方法一 n，方法二 n² 與 log n', 'n 夠大時誰快？');
    await step(tok);                                   // 94:37 要把 Big O 組合起來
    say('需要把好幾個 Big O 組合起來', '這是下一段的工具');
  }]);

  // 99:54 Q&A：mid 的 overflow
  FRAG.push(['stklin-mid-overflow', 'Binary search 的 mid 會 overflow？', async (tok) => {
    fresh([0, 5, 13], [0, 2.4, 0]);
    const cd = code(['mid = (left + right) / 2;', 'mid = left + (right - left) / 2;'], 0, 6.6, 0.6);
    const X0 = -5, X1 = 1.5, X = (p) => X0 + (X1 - X0) * p;
    line(X0, 0.05, 6.5, 0.05, 0, '#c9b48e');
    tag('0', 'idx', X0, 0, 0.8); tag('INT_MAX', 'ptr alt', X1, 0, 0.8);
    line(X1, 0, X1, 3, 0, R_);
    await step(tok);                                   // 99:57 兩個加起來會 overflow
    cd.hl(0);
    say('同學提醒：left + right 可能 overflow', '寫程式要小心');
    await step(tok);                                   // 100:18 know your program
    tag('know your program', 'ptr', -3.2, 4.2);
    say('Know your program', '知道程式在什麼環境下執行');
    await step(tok);                                   // 100:26 left、right 都超過一半
    tag('½', 'idx', X(0.5), 0, 0.8);
    tag('left', 'ptr', X(0.6), 1.0); tag('right', 'ptr', X(0.8), 1.6);
    cube('', B_, [0.15, 0.6, 0.6], X(0.6), 0.3, 0); cube('', B_, [0.15, 0.6, 0.6], X(0.8), 0.3, 0);
    say('left、right 都大到超過整數範圍一半', '');
    await step(tok);                                   // 100:33 加起來才 overflow
    const sum = lab.box(R_, [1, 0.4, 0.5]); sum.position.set(X0, 2.3, 0); lab.world.add(sum);
    await anim(tok, 1200, (t) => { const w = (X(1.4) - X0) * t; sum.scale.x = Math.max(0.01, w); sum.position.x = X0 + w / 2; });
    tag('left + right > INT_MAX！', 'ptr alt', X(1.4) - 0.4, 2.9);
    say('這時相加才會爆掉', '再除以 2 也救不回來');
    await step(tok);                                   // 100:55 總要做一些假設
    say('寫程式總要做一些假設', '在假設之下，不見得會 overflow');
    await step(tok);                                   // 101:17 資料、index 很大時的替代寫法
    cd.hl(1); kill(sum);
    const d = lab.box(G_, [1, 0.4, 0.5]); d.position.set(X(0.6), 2.3, 0); lab.world.add(d);
    await anim(tok, 800, (t) => { const w = (X(0.8) - X(0.6)) * (1 - 0.5 * t); d.scale.x = Math.max(0.01, w); d.position.x = X(0.6) + w / 2; });
    tag('left + (right − left)/2：不會超過 right', 'ptr', X(0.7), 3.0);
    say('資料或 index 非常大時', '改寫成 left + (right − left) / 2');
  }]);

  // 111:49 和的規則、遞移律
  FRAG.push(['stklin-sum-rule', '從定義證明：和的規則與遞移律', async (tok) => {
    fresh([0, 5, 14], [0, 3, 0]);
    let cd = code(['f₁ ≤ c₁·g₂   (n ≥ n₁)', 'f₂ ≤ c₂·g₂   (n ≥ n₂)', 'n ≥ max(n₁, n₂)：兩式都成立', 'f₁ + f₂ ≤ (c₁ + c₂)·g₂', '∴ f₁ + f₂ = O(g₂)'], -2.6, 7.4, 0.5);
    const XN = (n) => -6 + n / 8000 * 12;
    line(-6, 0.05, 6, 0.05, 0, '#6e5f49'); tag('n', 'idx', 6.5, 0);
    let b1, b2, l1, l2;
    await step(tok);                                   // 111:49 從定義證明定理
    say('從定義出發，證明幾個定理', '之後操作會比較方便');
    await step(tok);                                   // 111:57 兩段程式各有 Big O，怎麼合
    say('兩段程式各有自己的 Big O', '合起來是什麼？');
    await step(tok);                                   // 112:27 f₁ ≤ g₂、f₂ ≤ g₂
    say('假設 f₁ = O(g₂)、f₂ = O(g₂)', '都被 g₂ 壓著走');
    await step(tok);                                   // 112:50 n₁、c₁
    cd.hl(0);
    b1 = lab.box(B_, [XN(8000) - XN(1126), 0.2, 0.6]); b1.position.set((XN(1126) + 6) / 2, 0.1, -0.5); lab.world.add(b1);
    l1 = tag('n₁', 'ptr', XN(1126), 0.6, -0.5);
    say('定義寫下來：n ≥ n₁ 時 f₁ ≤ c₁·g₂', '');
    await step(tok);                                   // 113:00 n₂、c₂
    cd.hl(1);
    b2 = lab.box(O_, [XN(8000) - XN(5566), 0.2, 0.6]); b2.position.set((XN(5566) + 6) / 2, 0.1, 0.5); lab.world.add(b2);
    l2 = tag('n₂', 'ptr alt', XN(5566), 0.6, 0.9);
    say('n ≥ n₂ 時 f₂ ≤ c₂·g₂', '寫下定義就先賺兩行');
    await step(tok);                                   // 113:20 n₁ = 1126、n₂ = 5566
    txt(l1, 'n₁ = 1126'); txt(l2, 'n₂ = 5566');
    say('要兩個都成立：n 要比兩個都大', '例：n₁ = 1126、n₂ = 5566');
    await step(tok);                                   // 113:28 取比較大的
    cd.hl(2); glow(b2, GREEN);
    say('取比較大的那個', "n₀' = max(1126, 5566) = 5566");
    await step(tok);                                   // 113:37 兩式加起來
    cd.hl(3);
    const f1 = cube('f₁', B_, [1.2, 1.2, 1.2], -4.2, 2.4, 0), f2 = cube('f₂', O_, [1.2, 0.9, 1.2], -2.4, 2.25, 0);
    move(f2, -4.2, 3.45, 0);
    await beat(tok, 900);
    say('兩式加起來', 'f₁ + f₂ ≤ (c₁ + c₂)·g₂');
    await step(tok);                                   // 113:48 新的 n₀'、c'
    say("找到新的 n₀' 和 c'", "c' = c₁ + c₂");
    await step(tok);                                   // 114:05 QED
    cd.hl(4);
    say('符合 Big O 的定義', 'QED：合起來還是被 g₂ 壓住');
    await step(tok);                                   // 114:35 遞移律
    cd.kill(); kill(f1); kill(f2); kill(b1); kill(b2); kill(l1); kill(l2);
    cd = code(['f ≤ c₁·g₁     (n ≥ n₁)', 'g₁ ≤ c₂·g₂    (n ≥ n₂)', 'n ≥ max(n₁, n₂)', 'f ≤ c₁·c₂·g₂  ∴ f = O(g₂)'], -2.6, 7.4, 0.5);
    const fs = [['f', 0.8, B_], ['g₁', 1.6, O_], ['g₂', 2.6, R_]].map(([t, h, c], i) => cube(t, c, [1.2, h, 1.2], 1.8 + i * 1.8, 1.5 + h / 2, 0, 3));
    tag('≤', 'val', 2.7, 2.2); tag('≤', 'val', 4.5, 2.6);
    say('遞移律：f ≤ g₁、g₁ ≤ g₂', '那 f ≤ g₂ 嗎？');
    await step(tok);                                   // 114:53 先寫兩個定義
    cd.hl(0); await beat(tok, 500); cd.hl(1);
    say('一樣先把兩個定義寫下來', '');
    await step(tok);                                   // 115:04 max
    cd.hl(2);
    say("新的下限：n₀' = max(n₁, n₂)", '');
    await step(tok);                                   // 115:25 c₁·c₂ 是新的 c
    cd.hl(3);
    say("兩式串起來：f ≤ c₁·c₂·g₂", "c' = c₁·c₂");
    await step(tok);                                   // 115:36 符合定義
    fs.forEach((m) => glow(m, GOLD));
    say('符合定義：f = O(g₂)', '');
    await step(tok);                                   // 115:55 先寫定義，賺兩行
    say('從定義出發：先寫下定義', '再湊出需要的 n₀ 和 c');
  }]);

  // 116:42 組合：selection sort + binary search
  FRAG.push(['stklin-combine', '組合：selection sort + binary search', async (tok) => {
    fresh([0, 5, 13], [0, 2, 0]);
    let f1, f2, t2;
    await step(tok);                                   // 116:42 selection sort：n²
    f1 = cube('f₁：selection sort', B_, [3.2, 2.4, 2.0], -3, 1.2, 0, 5);
    tag('O(n²)', 'ptr', -3, 3.0);
    say('f₁ = selection sort', 'O(n²)');
    await step(tok);                                   // 116:59 binary search：log n
    f2 = cube('f₂：binary search', O_, [2.4, 0.5, 1.2], 3, 0.25, 0, 5);
    t2 = tag('O(log n)', 'ptr alt', 3, 1.1);
    say('f₂ = binary search', 'O(log n)');
    await step(tok);                                   // 117:22 log n 漲得比 n² 慢
    glow(f1, GOLD); glow(f2, GOLD);
    tag('log n = O(n²)', 'ptr', 0, 4.4);
    say('log n 漲得比 n² 慢', 'log n = O(n²)');
    await step(tok);                                   // 117:48 f₁ + f₂ = O(n²)
    glow(f1, null); glow(f2, null);
    f2.userData.lbl.element.style.visibility = 'hidden'; move(f2, -3, 1.2, 0); kill(t2);   // its name goes first, so it never prints over f₁
    await beat(tok, 800);
    kill(f2);
    say('合起來被大的那個壓住', 'f₁ + f₂ = O(n²)');
    await step(tok);                                   // 118:37 先排序再搜尋：最差 n²
    say('先 selection sort 再 binary search', '最差要 n² 的力氣');
    await step(tok);                                   // 119:05 切小段分析，揉起來
    say('程式切成小段 → 各自分析 → 揉起來', '');
    await step(tok);                                   // 119:19 bottleneck
    glow(f1, RED);
    tag('bottleneck', 'ptr alt', -3, 3.8);
    say('一眼看出最花時間的步驟', 'bottleneck：selection sort');
    await step(tok);                                   // 119:26 多項式只留最大項
    fly(f1, V3(-3, 8, 3));
    const big = cube('n³', R_, [2.4, 2.4, 2.0], 0, 1.2, 0, 5);
    const small = [['n²', -4.6], ['n', 4.2], ['1', 5.8]].map(([t, x]) => cube(t, B_, [1.0, 0.6, 1.0], x, 0.3, 0, 5));
    say('多項式：最後只留最大項', '例：n³ + n² + n + 1');
    await step(tok);                                   // 119:33 其他項被吞掉
    for (const s of small) { s.userData.lbl.element.style.visibility = 'hidden'; move(s, 0, 1.2, 0); await beat(tok, 450); kill(s); }   // its name goes first, so it never prints over n³
    say('其他項都被比較大的項吞掉', '');
    await step(tok);                                   // 119:47 秦吞六國
    glow(big, GOLD);
    say('像秦朝把六國一個一個吞掉', 'n³ + n² + n + 1 = O(n³)');
    await step(tok);                                   // 119:52 Ω、Θ 也有類似證明
    say('Ω、Θ 也有類似的證明', '但最常操作的還是 Big O');
    await step(tok);                                   // 120:09 用行話溝通
    say('之後就能用行話溝通', '「這是 n² 的演算法」');
  }]);

  // 120:56 最緊的上限
  FRAG.push(['stklin-tight', 'Big O 要說最緊的上限', async (tok) => {
    fresh([0, 5, 13.5], [0, 3, 0]);
    const Y = (v) => 0.6 + Math.log10(v) * 1.3;
    await step(tok);                                   // 120:56 big O 像 ≤
    cube('1', B_, [1.2, 0.6, 1.2], -3.8, 0.3, 0, 3);
    say('Big O 像「≤」', '');
    await step(tok);                                   // 121:05 1 ≤ 10、1 ≤ 1126、1 ≤ 5566
    const shelves = [];
    for (const v of [10, 1126, 5566]) {
      const s = lab.box('#c9b48e', [2.4, 0.1, 1.6]); s.position.set(-3.8, Y(v), 0); lab.world.add(s); shelves.push(s);
      tag('≤ ' + v, 'idx', -2.0, Y(v));
      await beat(tok, 450);
    }
    say('1 ≤ 10、1 ≤ 1126、1 ≤ 5566', '都對');
    await step(tok);                                   // 121:19 很多種上限
    shelves.forEach((s) => glow(s, GOLD));
    say('左邊一個東西，右邊可以有很多上限', '');
    await step(tok);                                   // 121:36 最低、最緊的上限
    shelves.forEach((s) => glow(s, null));
    const al = cube('n² 的演算法', O_, [2.0, 2.4, 1.6], 3, 1.2, 0, 3);
    const caps = [['O(n²)', 2.55, G_], ['O(n³)', 4.2, GRAY], ['O(n¹¹²⁶)', 6.4, GRAY]].map(([t, y, c]) => {
      const s = lab.box(c, [2.6, 0.12, 1.8]); s.position.set(3, y, 0); lab.world.add(s); tag(t, 'ptr', 5.2, y); return s;
    });
    say('說 Big O 時，指的是最緊的上限', '');
    await step(tok);                                   // 121:45 O(n²) 心裡想的就是 n²
    glow(caps[0], GREEN); glow(al, GOLD);
    say('說它是 O(n²)', '心裡想的就是：它是個 n² 的演算法');
    await step(tok);                                   // 121:56 不會說是 n¹¹²⁶ 的演算法
    tint(caps[2], R_);
    say('不會說它是 n¹¹²⁶ 的演算法', '數學上沒錯，但……');
    await step(tok);                                   // 122:04 上限不緊，描述不了性質
    say('上限不緊', '就描述不了演算法的性質');
    await step(tok);                                   // 122:41 行話、行規
    tag('講行話，有行規', 'ptr alt', 0, 7.6);
    say('講行話時有行規', '');
    await step(tok);                                   // 122:55 最緊，不是任意寬鬆
    say('除了數學正確，還要最緊', '想得到、證得出的最緊那個');
  }]);

  // 123:31 實際要跑多久
  FRAG.push(['stklin-runtime', '每秒 10⁹ 步：實際要跑多久', async (tok) => {
    fresh([0, 4.2, 15.5], [0, 3.4, 0]);
    const H = (s) => Math.min(7.6, 0.3 + (Math.log10(s) + 3) * 0.5);
    let k = 0;
    const show = async (nm, n, s, lb) => {
      const x = -5.85 + k * 1.3; k++;
      tag(nm, 'ptr', x, 0, 1.2); tag('n=' + n, 'idx', x, 0, 1.9);
      const b = bar(s >= 86400 ? R_ : s >= 1 ? O_ : G_, 0.9, 0.9, x);
      await growBar(tok, b, H(s), 500);
      tag(lb, 'idx', x, H(s) + 0.35);
      return b;
    };
    tag('高度 = 秒數（log 尺度）', 'idx', 0, 8.6);
    for (const [nm, s] of [['1 秒', 1], ['1 天', 86400], ['1 年', 3.15e7]]) { line(-6.6, H(s), 6.6, H(s), -0.8, '#c9b48e'); tag(nm, 'idx', -6.6, H(s) + 0.25, -0.8); }
    await step(tok);                                   // 123:33 f 就是實際步數
    say('不用 Big O 了：f 就是實際步數', 'n、n log n、n²、n³、n⁴');
    await step(tok);                                   // 123:51 每秒 10⁹ 步
    tag('CPU：每秒 10⁹ 步（1 billion）', 'ptr alt', 0, 7.9);
    say('電腦每秒可以跑 1 billion 步', '');
    await step(tok);                                   // 124:23 f = n
    await show('n', '10⁶', 1e-3, '1 ms');
    say('f = n：10 筆 0.01 μs', '10⁶ 筆也才 1 毫秒');
    await step(tok);                                   // 124:40 n log n
    await show('n log n', '10⁶', 0.02, '20 ms');
    say('n log n：10⁶ 筆約 20 毫秒', '可以接受');
    await step(tok);                                   // 124:49 n²：開始吃力
    await show('n²', '10³', 1e-3, '1 ms');
    say('n²：10 筆 0.1 μs、1000 筆 1 毫秒', '開始有點吃力');
    await step(tok);                                   // 125:15 n²，10⁶ 筆 16.67 分
    await show('n²', '10⁶', 1000, '16.67 分');
    say('n²、10⁶ 筆：16.67 分鐘', '作業馬馬虎虎還跑得完');
    await step(tok);                                   // 125:42 n³：100 筆 1 毫秒
    say('n³：100 筆還是 1 毫秒', '');
    await step(tok);                                   // 125:50 1000 筆 1 秒、10⁶ 筆 32 年
    await show('n³', '10³', 1, '1 秒');
    const big = await show('n³', '10⁶', 1e9, '≈ 32 年');
    say('n³：1000 筆 1 秒', '10⁶ 筆要 32 年！');
    await step(tok);                                   // 126:03 10⁵ 筆 11.57 天
    await show('n³', '10⁵', 1e6, '11.57 天');
    say('n³、10⁵ 筆：11.57 天', '');
    await step(tok);                                   // 126:33 寫到 n³ 就危險
    glow(big, RED);
    say('小心：寫到 n³ 就危險了', '');
    await step(tok);                                   // 126:45 n⁴
    await show('n⁴', '10⁴', 1e7, '≈ 1/3 年');
    say('n⁴：1000 筆馬馬虎虎', '1 萬筆要三分之一年');
    await step(tok);                                   // 126:58 n¹⁰
    tag('n¹⁰：40、50 筆都不一定跑得出來', 'ptr', 3.5, 8.0);
    say('n¹⁰：50 筆可能就跑不出來', '');
    await step(tok);                                   // 127:07 2ⁿ
    await show('2ⁿ', '50', 1.13e6, '≈ 13 天');
    await show('2ⁿ', '100', 1.3e21, '跑不完');
    say('2ⁿ：50 筆就不太妙', '100 筆肯定不行');
    await step(tok);                                   // 127:27 可行性
    say('這些函數告訴我們可行性', '要不要更好的資料結構、演算法？');
    await step(tok);                                   // 127:56 空間也會影響
    say('空間也一樣要估', '');
    await step(tok);                                   // 128:22 5 萬 × 5 萬矩陣
    tag('50000 × 50000 個 double', 'ptr alt', 3.0, 7.2);
    say('例：5 萬 × 5 萬的 double 矩陣', '存得下嗎？');
    await step(tok);                                   // 128:40 算算看
    tag('× 8 bytes = 20 GB', 'ptr alt', 3.0, 6.5);
    say('double 8 bytes', '50000 × 50000 × 8 = 20 GB');
    await step(tok);                                   // 129:13 professional
    say('身為 professional computer scientist', '先估時間和空間，再寫程式');
  }]);

  // 135:29 Stack = 堆疊，餐盤
  FRAG.push(['stklin-plates', 'Stack：一疊東西，只能放最上面', async (tok) => {
    fresh([0, 5, 12], [0, 1.8, 0]);
    let top = null;
    await step(tok);                                   // 135:29 堆疊
    tag('Stack ＝ 堆疊', 'ptr alt', 0, 4.6);
    say('Stack 中文叫堆疊', '你最會堆東西的地方在哪裡？');
    await step(tok);                                   // 135:43 一張紙兩張紙疊上去
    const papers = [];
    for (let k = 0; k < 3; k++) { papers.push(cube('', '#fbf6ea', [2.4, 0.08, 1.8], -3.6 + (k % 2) * 0.1, 0.05 + k * 0.1, 0, 3)); await beat(tok, 300); }
    tag('桌上一疊紙', 'idx', -3.6, 0, 1.6);
    say('像辦公桌上一張一張疊上去的紙', '公文、作業也一樣');
    await step(tok);                                   // 136:15 人類最原始的動作
    say('不知道放哪，就往上疊', '人類最原始的動作');
    await step(tok);                                   // 136:31 「疊上去」很重要
    say('重點是「疊上去」', '');
    await step(tok);                                   // 136:57 疊在已出現的資料上面
    say('資料疊在已經出現的資料上面', '這樣的資料結構叫堆疊');
    await step(tok);                                   // 137:15 頂端 top
    top = tag('top', 'ptr', -1.6, 0.4);
    say('所以有一個「頂端」的概念', 'top');
    await step(tok);                                   // 137:24 餐廳的餐盤
    tag('餐廳的餐盤', 'idx', 2.4, 0, 1.8);
    say('像自助餐廳的空餐盤', '');
    await step(tok);                                   // 137:41 一盤一盤往上疊
    const ps = [];
    for (let k = 0; k < 4; k++) {
      ps.push(cube('', k % 2 ? '#efe6d6' : '#dcd0bb', [2.2, 0.22, 2.2], 2.4, 0.11 + k * 0.26, 0, 5));
      top.position.set(4.2, 0.2 + k * 0.26, 0);
      await beat(tok, 350);
    }
    say('一盤一盤往上疊', '');
    await step(tok);                                   // 137:51 Insert Top：只能放最上面
    say('有新的只能疊在最上面', 'insert top');
    await step(tok);                                   // 138:13 老闆把洗好的盤子放進去
    ps.push(cube('', '#f6e3c8', [2.2, 0.22, 2.2], 2.4, 0.11 + 4 * 0.26, 0, 5));
    top.position.y = 0.2 + 4 * 0.26;
    say('老闆把洗好的盤子放進去', '放在最上面');
    await step(tok);                                   // 138:21 restricted
    say('Stack 是 restricted 的', '只准你在這裡放');
    await step(tok);                                   // 138:30 不能塞中間
    const mid = cube('', '#f6c9a8', [2.2, 0.22, 2.2], 5.6, 0.6, 0);
    const x = tag('✕ 不能塞中間', 'ptr alt', 5.6, 1.3);
    glow(mid, RED);
    say('不能把盤子塞到中間', '');
    await step(tok);                                   // 138:53 push
    fly(mid, V3(4, 6, 3)); kill(x);
    glow(ps[4], GOLD);
    tag('放到最上面 ＝ push', 'ptr', 2.4, 2.8);
    say('放到最上面這個動作', '叫 push');
  }]);

  // 139:03 push / pop / peek 與 LIFO（老師的例子：push 3、push 5、pop）
  FRAG.push(['stklin-lifo-35', 'push 3、push 5、pop → 5', async (tok) => {
    fresh([0, 5, 13], [0, 2.4, 0]);
    const col = ghostBox(B_, 1.9, 4.4, 1.9); col.position.set(-3, 2.2, 0);
    const cd = code(['get    → peek：只看 top，不拿走', 'insert → push：放到 top', 'remove → pop ：從 top 拿走'], 2.6, 5.6, 0.6);
    let c3, c5;
    await step(tok);                                   // 139:03 只能從最上面拿
    say('也只能從最上面拿東西', '拿＝移掉');
    await step(tok);                                   // 139:15 get、remove、insert
    say('回想基本操作：get、remove、insert', '');
    await step(tok);                                   // 139:29 remove 只能從頂上：pop
    cd.hl(2);
    say('remove 只能從頂端做', '叫 pop');
    await step(tok);                                   // 139:37 最基本：push、pop
    cd.hl(1); await beat(tok, 500); cd.hl(2); await beat(tok, 500); cd.hl(-1);
    say('stack 最基本的兩個操作', 'push 和 pop');
    await step(tok);                                   // 140:08 只看不拿：peek
    cd.hl(0);
    say('只看不拿：peek', '偷看最上面那筆是什麼');
    await step(tok);                                   // 140:26 last in first out
    cd.hl(-1);
    const lifo = tag('Last In, First Out', 'ptr alt', -3, 4.9);
    say('特性：Last In, First Out', '最後進去的最先被拿出來');
    await step(tok);                                   // 140:46 push 3、push 5
    c3 = cube(3, colorFor(3), [1.6, 0.85, 1.6], -3, 0.45, 0, 6);
    await beat(tok, 700);
    c5 = cube(5, colorFor(5), [1.6, 0.85, 1.6], -3, 1.35, 0, 6);
    say('先 push(3)，再 push(5)', '');
    await step(tok);                                   // 140:56 5 壓在 3 上面
    say('5 壓在 3 的上面', 'stack（底→頂）：3, 5');
    await step(tok);                                   // 141:14 這邊是 top
    tag('top', 'ptr', -1.4, 1.35);
    glow(c5, GOLD);
    say('這邊是 top', '');
    await step(tok);                                   // 141:23 pop 出 5
    glow(c5, null);
    fly(c5, V3(4, 9, 2));
    say('pop() → 5', '');
    await step(tok);                                   // 141:32 後進的先出
    glow(c3, null);
    lifo.element.className = 'lab-label ptr';
    say('5 後進去，卻比 3 先出來', 'LIFO：後進先出');
  }]);

  // 141:46 LIFO 的生活例子：擠電梯、餐盤
  FRAG.push(['stklin-elevator', '擠電梯：最後進去的先出來', async (tok) => {
    fresh([0, 7, 10.5], [0, 0.8, 0.5]);
    const car = ghostBox('#c9b48e', 3.4, 2.6, 4.6); car.position.set(0, 1.3, -0.4);
    tag('電梯（只有一個門）', 'ptr', 0, 2.9, -0.4);
    line(-1.7, 0.02, 1.7, 0.02, 1.9, R_); tag('門', 'idx', 2.3, 0.1, 1.9);
    const P = [['A', -2.0], ['B', -0.8], ['C', 0.4]];
    const ps = [];
    await step(tok);                                   // 141:46 擠電梯
    for (const [nm, z] of P) {
      const m = cube(nm, colorFor(nm.charCodeAt(0)), [0.8, 1.4, 0.8], 0, 0.7, 4.5);
      ps.push(m); move(m, 0, 0.7, z);
      await beat(tok, 600);
    }
    say('擠電梯：A、B、C 依序進去', '先進去的被擠到最裡面');
    await step(tok);                                   // 141:52 最後進的先出來
    const out = [];
    for (let k = ps.length - 1; k >= 0; k--) {
      move(ps[k], 0, 0.7, 4.5); out.push(P[k][0]);
      await beat(tok, 500);
      fly(ps[k], V3(3, 6, 2));
    }
    say('到同一層：最後進去的先出來', '出來順序：C → B → A');
    await step(tok);                                   // 142:08 小孩四五歲就觀察到
    say('老師的小孩四五歲就觀察到了', '');
    await step(tok);                                   // 142:22 餐廳的餐盤
    const ps2 = [];
    for (let k = 0; k < 3; k++) ps2.push(cube('', k % 2 ? '#efe6d6' : '#dcd0bb', [1.8, 0.2, 1.8], 4.2, 0.1 + k * 0.24, 0.5, 4));
    say('餐廳的餐盤也一樣', '老闆最後放的，先被學生拿去用');
    await step(tok);                                   // 142:35 有限制的資料結構
    say('看起來只是個有限制的資料結構', '為什麼要花這麼大力氣介紹？');
    await step(tok);                                   // 142:56 非常有用
    say('它在電腦科學裡非常有用', '概念上、實作上都是');
    await step(tok);                                   // 143:11 複雜問題變簡單操作
    say('把看似複雜的問題', '轉成記憶體裡很簡單的操作');
  }]);

  // 143:49 括號配對
  FRAG.push(['stklin-paren', '用 Stack 檢查括號配對', async (tok) => {
    const PAIR = { ')': '(', ']': '[', '}': '{' };
    fresh([0, 6, 13], [0, 1.8, 0]);
    const st = ghostBox(B_, 1.5, 4.2, 1.5); st.position.set(-5.2, 2.1, 0);
    tag('stack', 'ptr', -5.2, 4.6);
    const X = (i) => -2.6 + i * 1.3;
    let ts = [], cur = null, stack = [];
    function input(s) {
      ts.forEach(kill); stack.forEach((t) => kill(t.m)); stack = [];
      ts = [...s].map((ch, i) => cube(ch, '#e9dcc4', [1.0, 0.6, 1.0], X(i), 0.3, 1.8));
      if (cur) kill(cur); cur = tag('▲', 'ptr alt', X(0), 0, 2.9);
    }
    // process character i of s; returns false on a mismatch
    async function doChar(s, i) {
      const ch = s[i]; cur.position.x = X(i);
      if (!PAIR[ch]) {
        const m = cube(ch, O_, [1.2, 0.6, 1.2], -5.2, 0.3 + stack.length * 0.65, 0, 5);
        stack.push({ ch, m }); tint(ts[i], GRAY);
        await beat(tok, 450); return true;
      }
      const t = stack.pop();
      move(t.m, X(i), 1.2, 1.8);
      await beat(tok, 450);
      if (t.ch === PAIR[ch]) { tint(t.m, G_); tint(ts[i], G_); await beat(tok, 300); fly(t.m); fly(ts[i]); return true; }
      tint(t.m, R_); tint(ts[i], R_); return false;
    }
    await step(tok);                                   // 143:49 左右對稱、成雙成對
    input('{([])}');
    say('C 語言的括號要成雙成對', '小括號、中括號、大括號、引號');
    await step(tok);                                   // 144:12 寫編譯器：檢查平衡
    tag('編譯器的任務：括號有沒有平衡？', 'ptr', 2.0, 4.4);
    say('寫編譯器的人要檢查', '括號有沒有平衡');
    await step(tok);                                   // 144:41 小括號對到大括號
    input('{(}');
    tint(ts[1], R_); tint(ts[2], R_);
    say('左邊小括號，對到右邊大括號？', '');
    await step(tok);                                   // 145:00 小括號落單
    say('這樣小括號就落單了', '配錯！');
    await step(tok);                                   // 145:37 Lisp 括號特別多
    const lisp = tag('(defun f (x) (if (= x 0) 1 (* x (f (- x 1)))))', 'idx', 2.0, 5.2);
    Object.assign(lisp.element.style, MONO);
    say('Lisp 這種語言，括號特別多', '');
    await step(tok);                                   // 146:04 肉眼對括號
    say('以前要用肉眼對括號', '後來有人寫了括號平衡輔助程式');
    await step(tok);                                   // 146:46 簡單一點的問題
    input('{([])}');
    say('先解簡單的問題', '給一段文字：括號平衡嗎？');
    await step(tok);                                   // 147:21 最裡面的左括號先配
    glow(ts[2], GOLD); glow(ts[3], GOLD);
    say('看最裡面的左括號', '能不能配到一個右括號');
    await step(tok);                                   // 148:01 最裡面、最後看到的先平衡
    say('配掉之後，再配外面那一層', '最裡面、最後看到的要先平衡');
    await step(tok);                                   // 148:22 最後的先出來 → Stack
    glow(ts[2], null); glow(ts[3], null);
    tag('最後的先出來 → Stack', 'ptr alt', -5.2, 5.3);
    say('最後的要先出來', '這就是 Stack');
    await step(tok);                                   // 148:29 左括號：push
    for (let i = 0; i < 3; i++) await doChar('{([])}', i);
    say('左括號：push，在 stack 裡等', '');
    await step(tok);                                   // 148:50 右括號：找 stack 頂端那個
    await doChar('{([])}', 3);
    say('右括號：找 stack 最頂端的那個配', 'pop 出 [，配對成功');
    await step(tok);                                   // 149:04 看到右括號就 pop
    await doChar('{([])}', 4); await doChar('{([])}', 5);
    say('看到左括號 push，看到右括號 pop', '讀完 stack 是空的 → 平衡 ✓');
    await step(tok);                                   // 149:17 檢查是不是一對
    input('{(}');
    for (let i = 0; i < 2; i++) await doChar('{(}', i);
    await doChar('{(}', 2);
    say('pop 完要檢查是不是同一種', '小括號配大括號 → 配錯了！');
    await step(tok);                                   // 149:41 引號比較複雜
    say('引號的情況比較複雜', '不在這個簡單版本裡');
    await step(tok);                                   // 150:30 最接近的資訊先處理
    say('Stack 的精神：資訊先留著', '最接近（最裡面）的先處理');
  }]);

  // 151:04 system stack
  FRAG.push(['stklin-system-stack', 'System stack：函數呼叫的草稿紙', async (tok) => {
    fresh([0, 5.5, 13.5], [0, 3.2, 0]);
    const cd = code(['int f(int n) {  // 示意', '  if (n == 0) return 0;', '  return f(n - 1) + n;', '}'], 3.8, 6.8, 0.55);
    const X = -2.4, FH = 0.7, Y = (k) => 0.36 + k * 0.76;
    const fr = [cube('main()', GRAY, [3.8, FH, 2.0], X, Y(0), 0)];
    const call = async (n) => { cd.hl(n ? 2 : 1); fr.push(cube('f(' + n + ')：n = ' + n, colorFor(n), [3.8, FH, 2.0], X, Y(fr.length), 0, 5)); await beat(tok, 450); };
    await step(tok);                                   // 151:04 system stack、recursive call
    say('補充：system stack', '先想想 recursive call');
    await step(tok);                                   // 151:17 還沒算完的函數要等
    await call(3);
    say('函數還沒算完就呼叫下一個', '原來的要在某個地方等');
    await step(tok);                                   // 151:51 新函數拿新的草稿紙
    await call(2); await call(1);
    say('新的函數 = 拿一張新的草稿紙', '');
    await step(tok);                                   // 152:21 舊的壓在下面
    await call(0);
    say('舊的草稿紙壓在下面等', 'Stack 就是一疊紙');
    await step(tok);                                   // 152:33 System Stack
    tag('System Stack', 'ptr alt', X, 4.6);
    say('這疊草稿紙叫 System Stack', '系統用它追蹤函數呼叫');
    await step(tok);                                   // 153:04 區域變數、參數
    const info = tag('草稿紙上：區域變數、參數', 'idx', 1.0, 0, 2.6);
    say('草稿紙上有：區域變數', '傳進來的參數');
    await step(tok);                                   // 153:20 return value 放哪
    txt(info, '草稿紙上：區域變數、參數、return value 放哪');
    say('做完的結果要放哪', 'return value');
    await step(tok);                                   // 153:28 回到哪一張：previous
    txt(info, '草稿紙上：區域變數、參數、return value 放哪、previous');
    say('做完要回到哪一張', 'previous pointer');
    await step(tok);                                   // 153:40 撕掉 = pop
    let ret = 0;
    for (let n = 0; n <= 3; n++) { ret += n; fly(fr.pop(), V3(4, 7, 2)); await beat(tok, 400); }
    cd.hl(-1);
    say('撕掉最上面那張 = pop', '自然回到上一張');
    await step(tok);                                   // 153:52 呼叫太多層
    line(X - 2.2, 6.2, X + 2.2, 6.2, 0, R_); tag('system stack 空間上限', 'ptr alt', X, 6.6);
    for (let k = 1; k <= 7; k++) { fr.push(cube('f(' + (100001 - k) + ')', colorFor(k), [3.8, FH, 2.0], X, Y(k), 0, 4)); await beat(tok, 250); }
    say('如果呼叫太多層', '例如 f(100000)');
    await step(tok);                                   // 154:16 堆不下
    fr.slice(1).forEach((m) => glow(m, RED));
    say('草稿紙用完、堆不下', '系統負荷不了');
    await step(tok);                                   // 154:46 疊在一起
    fr.slice(1).forEach((m) => glow(m, null));
    say('草稿紙在記憶體裡真的疊在一起', '沒保護好的話……');
    await step(tok);                                   // 154:52 惡意程式偷看
    arrow(V3(X + 2.4, Y(7), 0), V3(X + 2.4, Y(3), 0), 0xd64545);
    tag('偷看別張草稿紙', 'ptr', X + 4.1, Y(5));
    say('惡意程式可能偷看別張', '形成安全漏洞');
  }]);

  // 157:02 用 array 實作 stack（老師的例子：已有 3、5，push 4、pop）
  FRAG.push(['stklin-array-impl', '用 array 實作：top 放尾巴', async (tok) => {
    fresh([0, 6, 12], [0, 0.8, 0]);
    const X = (i) => -5 + i * 2, S = [1.5, 0.8, 1.5];
    let c3, c5, c4, top;
    await step(tok);                                   // 157:02 只要 top 能放、能拿
    say('stack 只要求：', '能輕易在 top 放、從 top 拿');
    await step(tok);                                   // 157:25 consecutive array，一開始是空的
    for (let i = 0; i < 6; i++) { slotTile(V3(X(i), 0.02, 0)); tag('[' + i + ']', 'idx', X(i), 0, 1.3); }
    say('用一個 consecutive array', '一開始是空的');
    await step(tok);                                   // 157:32 已經有 3、5
    c3 = cube(3, colorFor(3), S, X(0), 0.45, 0, 4); c5 = cube(5, colorFor(5), S, X(1), 0.45, 0, 4);
    say('假設已經有 3 和 5', '');
    await step(tok);                                   // 157:38 top 放最尾巴
    top = tag('top = 1', 'ptr', X(1), 1.6);
    say('top 放在 array 最尾巴', '');
    await step(tok);                                   // 157:46 push 4
    say('push(4)', '');
    await step(tok);                                   // 157:50 top 後面那一格，top 移過去
    c4 = cube(4, colorFor(4), S, X(2), 0.45, 0, 5);
    top.position.x = X(2); txt(top, 'top = 2');
    say('放在 top 後面那一格，top 往後移', 'stack[++top] = 4');
    await step(tok);                                   // 158:05 pop：拿出 4
    glow(c4, GOLD);
    say('pop：從尾巴拿出 4', '');
    await step(tok);                                   // 158:10 top 往前一格
    fly(c4, V3(2, 9, 3)); top.position.x = X(1); txt(top, 'top = 1');
    say('top 往前一格', 'return stack[top--]');
    await step(tok);                                   // 158:19 push、pop 都在尾巴
    say('push、pop 都在尾巴進行', '其他元素不用動');
    await step(tok);                                   // 158:31 尾端維護最省力
    say('連續 array 的尾端', '維護的 effort 最小');
    await step(tok);                                   // 158:37 top 放頭：push 沒空間
    txt(top, 'top 放頭？'); top.position.x = X(0);
    move(c5, X(2), 0.45); await beat(tok, 400); move(c3, X(1), 0.45); await beat(tok, 400);
    const n4 = cube(4, colorFor(4), S, X(0), 0.45, 0, 5);
    say('如果 top 放在頭', 'push：頭沒空間，要先整排往後搬');
    await step(tok);                                   // 158:45 pop 又要搬
    fly(n4, V3(-2, 9, 3)); await beat(tok, 300);
    move(c3, X(0), 0.45); move(c5, X(1), 0.45);
    tag('每次 push / pop 都搬資料 → O(n)', 'ptr alt', 0, 2.6);
    say('pop：後面又要整排往前搬', '');
    await step(tok);                                   // 158:53 最自然：top 放尾端
    txt(top, 'top = 1'); top.position.x = X(1);
    glow(c5, GREEN);
    say('最自然的實作：top 對應 array 尾端', 'push、pop 都 O(1)');
  }]);

  // 159:06 用 singly linked list 實作 stack
  FRAG.push(['stklin-list-impl', '用 linked list 實作：top 放 head', async (tok) => {
    fresh([0, 6, 12.5], [0, 0.8, 0]);
    const XS = [-3.5, -0.5, 2.5];
    const nodes = [null, lnode(5, XS[1], 0.35), lnode(3, XS[2], 0.35)];
    tag('NULL', 'idx', XS[2] + 1.8, 0.35);
    let arrs = [];
    const head = tag('head', 'ptr', XS[1], 1.5);
    function link() { arrs.forEach(kill); arrs = []; for (let i = 0; i < 2; i++) if (nodes[i]) arrs.push(arrow(V3(XS[i] + 0.95, 0.35, 0), V3(XS[i + 1] - 0.52, 0.35, 0))); }
    link();
    let n4;
    await step(tok);                                   // 159:06 singly linked list
    say('如果用 singly linked list 呢？', '');
    await step(tok);                                   // 159:13 東西放哪
    say('這是 head', 'push 的東西要放哪裡？');
    await step(tok);                                   // 159:22 push 放頭：head = top
    n4 = lnode(4, XS[0], 4.5); move(n4, XS[0], 0.35);
    nodes[0] = n4;
    await beat(tok, 600);
    link(); head.position.x = XS[0]; txt(head, 'head = top');
    say('push 傾向放在頭', '把 head 當成 stack 的 top');
    await step(tok);                                   // 159:38 在頭 insert 比較容易
    say('在 head insert 比較容易', 'new.link = head；head = new');
    await step(tok);                                   // 159:54 pop = removal，head 也容易
    fly(n4, V3(-3, 8, 3)); nodes[0] = null; link(); head.position.x = XS[1];
    say('pop 就是 removal', '在 head 移掉也容易：head = head.link');
    await step(tok);                                   // 160:01 removal 在尾巴？
    const p = tag('p', 'ptr alt', XS[1], 1.2, 0.8);
    glow(nodes[2].userData.data, GOLD);
    say('如果 removal 發生在尾巴呢？', '');
    await step(tok);                                   // 160:05 要改尾巴前一個的 pointer
    for (let i = 1; i < 3; i++) { p.position.x = XS[i]; await beat(tok, 400); }
    p.position.x = XS[1];
    glow(nodes[1].userData.data, RED);
    say('要改「尾巴前一個」的 pointer', 'singly：得從頭走過去才找到 → 比較難');
    await step(tok);                                   // 160:22 push/pop = insert/remove
    glow(nodes[1].userData.data, null); glow(nodes[2].userData.data, null); kill(p);
    say('push、pop 對應 insert、remove', 'insert 頭尾差不多；remove 頭比較簡單');
    await step(tok);                                   // 160:41 top 放頭比較 natural
    glow(nodes[1].userData.data, GREEN);
    say('singly：top 放 head 最自然', '');
    await step(tok);                                   // 160:49 doubly 沒差
    say('doubly linked list 是對稱結構', 'top 放頭放尾都沒差');
  }]);

  // 161:17 STL stack：container adapter
  FRAG.push(['stklin-adapter', 'STL stack：container adapter', async (tok) => {
    fresh([0, 5.5, 13], [0, 2.2, 0]);
    const cd = code(['#include <stack>', 'stack<int, vector<int>> s1;  // 底層用 array', 'stack<int, list<int>>   s2;  // 底層用 linked list', 's1.push(3); s1.push(5); s1.pop();'], 0, 7.2, 0.55);
    const X = (i) => -4 + i * 2;
    const cs = [3, 5, 4, 8, 1].map((v, i) => { tag('[' + i + ']', 'idx', X(i), 0, 1.2); return cube(v, colorFor(v), [1.3, 0.7, 1.3], X(i), 0.35, 0); });
    await step(tok);                                   // 161:17 STL 已經寫好
    cd.hl(0);
    say('STL 已經寫好 stack', '指定要裝什麼型別');
    await step(tok);                                   // 161:32 底層 vector 或 list
    cd.hl(1); await beat(tok, 700); cd.hl(2);
    say('還能指定底層用 vector 或 list', '');
    await step(tok);                                   // 161:44 不指定：有 default
    tag('不指定：default 底層（STL 用 deque）', 'idx', 0, 4.6);
    say('不指定的話也有 default', '');
    await step(tok);                                   // 162:04 container adapter：轉接器
    cd.hl(-1);
    say('STL 的 stack 是 container adapter', 'adapter = 轉接器');
    await step(tok);                                   // 162:11 像變壓器
    say('像變壓器', '把一種插座轉成另一種需要的樣子');
    await step(tok);                                   // 162:21 array、list：什麼都能做
    const gt = tag('底層 container：什麼都能做', 'ptr', 0, 1.6, -1.2);
    for (const i of [2, 0, 3]) { glow(cs[i], GOLD); await beat(tok, 400); glow(cs[i], null); }
    say('array、linked list：general container', '想存取哪裡都行');
    await step(tok);                                   // 162:31 stack：受限制
    kill(gt);
    tag('stack：只在 top 做 push、pop', 'ptr', 0, 1.6, -1.2);
    say('stack 是受限制的資料結構', '只需要、也只能在 top 做事');
    await step(tok);                                   // 162:40 加上轉接器、保護套
    const cover = ghostBox(Y_, 10.8, 1.5, 2.2); cover.position.set(0, 0.75, 0);
    tag('stack adapter（保護套）', 'ptr alt', 0, 2.2);
    tag('▼ top 開口', 'ptr', 4, 2.2, 1.2);
    say('在包山包海的 array 外面', '加一個轉接器、保護套');
    await step(tok);                                   // 162:47 只能用 push、pop
    cd.hl(3);
    const c = cube(7, colorFor(7), [1.3, 0.7, 1.3], 6, 0.35, 0, 5);
    await beat(tok, 900);
    fly(c, V3(2, 9, 2));
    say('只能用 push、pop 操作底層', '');
    await step(tok);                                   // 163:20 其他方式違反 stack 特性
    tint(cs[2], R_);
    tag('✕ 不准碰中間', 'ptr alt', 0, 1.2, 1.4);
    say('用其他方式碰底層', '就違反 stack 的特性');
    await step(tok);                                   // 163:36 reuse 基本資料結構
    say('reuse 基本的資料結構', '加一層限制，做出新的資料結構');
  }]);
  }
  // ═══ ptrwhy.js ═══
  {
// ─── OqLt2GfX6jg：Abdul Bari〈Why Pointers?〉— cued scenes: each step(tok) waits for the sentence it shows ───
// Variables are little characters (buddy) that hold their value and react;
// devices and places are small 3D props with a plain-language name.
const P = kit(ctx);
const { V3, tag, cube, kill, glow, code, anim, arrow, zone, travel, remove, step, buddy, prop, bob } = P;
const C_STACK = '#cfe3d4', C_HEAP = '#f3dcc0', C_CODE = '#dfe0ee', C_MAIN = '#7cb8ee', C_SWAP = '#f4a56a', C_PTR = '#e8cf8a';
// every step replaces both lines, so an old formula never lingers
const say = (a, b = '') => ctx.say(a, b);
const ok = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const no = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
// a named variable: a little character holding its value; address at its feet
function vbox(name, v, x, z, color, addr) {
  const b = buddy(name, v, color, x, 0, z, 0.8);
  if (addr) b.addr = tag(addr, 'note', x, -0.05, z + 0.75);
  return b;
}
const relabelProp = (g, t) => { if (g.userData.label) g.userData.label.element.textContent = t; };
// fade a prop or character group out of focus (on) or back (off)
function fade(g, on) {
  g.traverse((o) => {
    if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = on ? 0.25 : 1; }
    if (o.element) o.element.style.opacity = on ? '0.35' : '';
  });
}
// three memory sections side by side
function memory(withCode = true) {
  const out = {};
  if (withCode) out.code = zone('code 區・放程式指令', -4.2, 0, 0, 3.4, 4.2, C_CODE);
  out.stack = zone('stack 區・放函式的變數', withCode ? -0.4 : -2.2, 0, 0, 3.4, 4.2, C_STACK);
  out.heap = zone('heap 區・要用才去借', withCode ? 3.8 : 2.6, 0, 0, 4.2, 4.2, C_HEAP);
  return out;
}

// 0:05 指標＝位址變數
FRAG.push(['ptrwhy-intro', '指標：存「位址」的變數', async (tok) => {
  P.fresh([0, 6, 11], [0, 0.8, 0]);
  await step(tok);                                   // 0:05 uses of pointers
  const shelf = zone('記憶體 1000 號', 3, 0, 0, 3.2, 2.6, C_HEAP);
  const box = prop('parcel', 3, 0.05, 0, 1.1, '資料本身'); bob(box, 0.05);
  const addr = tag('位址 1000', 'idx', 3, 0.05, 1.0);
  say('指標有什麼用？');
  await step(tok);                                   // 0:08 pointers are called address variables
  const p = vbox('p（指標）', '', -3, 0, C_PTR);
  const n = note('1000', -3, 2.4, 0);
  await travel(tok, n, V3(-3, 2.4, 0), V3(-3, 0.25, 0.4), 700);
  remove(n); p.set('1000'); p.mood('wow');
  say('指標 = 位址變數', 'p 裡面存的不是資料，是「地址」');
  await step(tok);                                   // 0:13 they store the address of data
  arrow(V3(-2.4, 0.5, 0), V3(2.2, 0.5, 0), 0xa8730f);
  p.look(1);
  addr.element.className = 'lab-label note';
  say('存的是資料的位址', 'p → 1000 號');
  await step(tok);                                   // 0:19 indirectly accessing the data
  const hand = tag('照著地址走 →', 'pkt', -3, 1.6, 0);
  await travel(tok, hand, V3(-3, 1.6, 0), V3(2.0, 1.6, 0), 1400);
  hand.element.textContent = '找到了！';
  glow(shelf, '#5a3a00');
  p.mood('happy'); await p.hop(tok);
  say('順著位址找到資料 → 間接存取');
}]);

// 0:27 程式怎麼在記憶體裡跑
FRAG.push(['ptrwhy-memory', '程式在記憶體裡：code、stack、heap', async (tok) => {
  P.fresh([0, 8, 12.5], [0, 0.5, 0.5]);
  await step(tok);                                   // 0:27 how our program works
  const prog = prop('file', -7.0, 0, 0, 1.1, '你寫的程式'); bob(prog, 0.06);
  say('先看：程式是怎麼跑起來的');
  await step(tok);                                   // 0:40 loaded in the main memory
  tag('主記憶體（RAM）：程式執行時的工作桌', 'say', -0.2, 3.0, -2.4);
  say('要執行，先載入主記憶體');
  await step(tok);                                   // 0:45 divided into three: code, stack, heap
  memory();
  say('主記憶體分三區', 'code ｜ stack ｜ heap');
  await step(tok);                                   // 0:56 in the code section
  await travel(tok, prog, V3(-7.0, 0, 0), V3(-4.2, 0.1, -1.6), 900);
  relabelProp(prog, '程式碼放這裡');
  const cd = code(['int a, b;', 'a = 10;', 'b = 20;'], -4.2, 1.2, 0.5, 1.0);
  say('程式碼放在 code 區');
  await step(tok);                                   // 1:02 start executing line by line
  prop('cpu', -7.0, 0, 1.6, 0.9, 'CPU：一行一行執行');
  cd.hl(0);
  say('一行一行執行');
  await step(tok);                                   // 1:12 declaration of variables
  const a = vbox('a', '', -1.0, 0.4, C_MAIN), b = vbox('b', '', 0.2, 0.4, C_MAIN);
  say('第一行宣告變數 → 在 stack 配空間');
  await step(tok);                                   // 1:24 activation record
  const fr = P.ghostBox(C_MAIN, 3.0, 1.6, 2.2); fr.position.set(-0.4, 0.8, 0.4);
  tag('main 的 activation record（它的辦公桌）', 'say', -0.4, 2.0, 1.8);
  say('配給一個函式的那塊 = activation record');
  await step(tok);                                   // 1:33 directly accessible
  arrow(V3(-6.4, 0.5, 1.6), V3(-1.5, 0.5, 0.8), 0x0f5a3a);
  ok('直接存取 ✓', -3.6, 0.2, 2.3);
  a.look(-1); b.look(-1);
  say('stack 裡的變數：程式可以直接存取');
  await step(tok);                                   // 1:37 address 500, 502
  a.addr = tag('住 500 號', 'note', -1.0, -0.05, 1.2); b.addr = tag('住 502 號', 'note', 0.2, -0.05, 1.2);
  say('假設 a 在 500、b 在 502');
  await step(tok);                                   // 1:46 A will be replaced by 500
  cd.hl(1);
  P.txt(cd.ls[1], '[500] = 10;'); P.txt(cd.ls[2], '[502] = 20;');
  a.set(10); b.set(20); a.mood('happy'); b.mood('happy');
  say('變數名直接換成位址：a → 500', '所以 stack 是「直接」存取');
  await step(tok);                                   // 2:04 anything other than stack: indirectly
  const lock = prop('lock', 3.8, 0.1, 0, 1.4); bob(lock, 0.06);
  say('stack 以外的地方：只能間接存取');
  await step(tok);                                   // 2:23 cannot access this heap directly
  arrow(V3(-6.4, 1.0, 1.6), V3(2.0, 1.0, 0.6), 0x7a1010);
  no('直接進 heap ✗', 0.2, 1.9, 1.8);
  a.mood('wow'); b.mood('wow');
  say('heap 不能直接拿 → 那要怎麼辦？');
}]);

// 2:31 用途一：存取 heap
FRAG.push(['ptrwhy-heap', '用途一：透過指標存取 heap', async (tok) => {
  P.fresh([0, 7.5, 12], [0.2, 0.5, 0.5]);
  const M = memory();
  M.code.userData.name.position.z = 2.4;   // the code area's name at its front edge: p's name sits right above its back edge
  const cd = code(['int *p;', 'p = malloc(10);'], -4.2, 1.1, 0.55, 1.0);
  prop('cpu', -7.0, 0, 1.6, 0.9, 'CPU（執行程式）');
  say('用途一：存取 heap');
  await step(tok);                                   // 2:31 first usage of pointer is accessing heap
  tag('用途 ①', 'say', -6.4, 2.4, -1.2);
  await step(tok);                                   // 2:43 malloc
  cd.hl(1);
  say('malloc：向 heap 借 10 bytes');
  await step(tok);                                   // 2:54 activation record is created
  const p = vbox('p（指標）', '', -0.4, 0.4, C_PTR);
  const fr = P.ghostBox(C_MAIN, 2.0, 1.6, 2.0); fr.position.set(-0.4, 0.8, 0.4);
  say('activation record 只有一個變數：p');
  await step(tok);                                   // 3:02 executes malloc → heap block
  const cells = [];
  for (let i = 0; i < 10; i++) cells.push(cube('', '#f5b97a', [0.36, 0.36, 0.6], 2.2 + i * 0.38, 0.18, 0.2, 2 + i * 0.15));
  tag('向 heap 借來的 10 bytes', 'say', 3.9, -0.05, 1.2);
  say('heap 裡配出一塊 10 bytes');
  await step(tok);                                   // 3:10 address of very first byte 1000
  const n = note('1000', 2.2, 1.0, 0.2);
  glow(cells[0], '#5a3a00');
  say('第一個 byte 的位址：1000');
  await step(tok);                                   // 3:14 stored in the pointer
  await travel(tok, n, V3(2.2, 1.0, 0.2), V3(-0.4, 0.95, 0.4), 1000);
  remove(n); p.set(1000); p.mood('happy'); await p.hop(tok);
  say('這個位址存進 p');
  await step(tok);                                   // 3:17 pointing to this heap memory
  arrow(V3(0.2, 0.5, 0.4), V3(2.0, 0.3, 0.2), 0xa8730f);
  p.look(1);
  say('p 指向 heap 的這塊記憶體');
  await step(tok);                                   // 3:28 take the address of heap
  const hand = tag('CPU 出發', 'pkt', -7.0, 1.4, 1.4);
  await travel(tok, hand, V3(-7.0, 1.4, 1.4), V3(-0.9, 1.4, 0.6), 1000);
  hand.element.textContent = '讀到 1000';
  ok('① 直接讀 p', -3.8, 2.2, 1.0);
  await travel(tok, hand, V3(-0.9, 1.4, 0.6), V3(2.4, 1.0, 0.2), 1000);
  say('先直接讀 p，再照 p 裡的位址到 heap');
  await step(tok);                                   // 3:35 not directly, but indirectly accessible
  ok('② 間接存取 heap ✓', 3.9, 1.8, 0.2);
  hand.element.textContent = '到了！';
  say('heap：不能直接，但能間接', '指標就是那張「地址條」');
}]);

// 3:44 用途二：call by value 為什麼換不了
FRAG.push(['ptrwhy-swapval', '用途二（上）：call by value 換不了', async (tok) => {
  P.fresh([0, 7.5, 12], [0, 0.6, 0]);
  say('用途二：call by reference');
  await step(tok);                                   // 3:44 second example
  tag('用途 ②', 'say', -6.4, 2.4, -1.2);
  const cd = code(['void swap(int x, int y) {', '  int t = x; x = y; y = t;', '}', 'swap(a, b);'], -5.2, 3.6, 0.5, -1.5);
  await step(tok);                                   // 3:57 main is having two variables
  const stk = zone('stack 區・每個函式一塊', 1.6, 0, 0.6, 6.4, 4.4, C_STACK);
  stk.userData.name.position.z = 3.1;   // front edge: swap's x, y, t stand on the back edge
  tag('main', 'say', -2.9, 0.5, 2.0);
  const a = vbox('a', 10, -1.2, 2.0, C_MAIN), b = vbox('b', 20, 0.0, 2.0, C_MAIN);
  say('main 有 a、b，想交換它們');
  await step(tok);                                   // 4:04 main function is calling swap
  cd.hl(3);
  say('main 呼叫 swap(a, b)');
  await step(tok);                                   // 4:13 this will not work
  const warn = tag('老師：這樣行不通喔', 'bad', 3.2, 2.6, 2.0);
  say('x、y 只是普通變數 → call by value');
  await step(tok);                                   // 4:24 main function will start
  kill(warn);
  await step(tok);                                   // 4:38 main calls swap → swap's record
  tag('swap', 'say', 6.3, 0.5, -0.8);
  const x = vbox('x', '', 2.4, -0.8, C_SWAP), y = vbox('y', '', 3.6, -0.8, C_SWAP), t = vbox('t', '', 4.8, -0.8, C_SWAP);
  say('呼叫 swap：配出 x、y、t');
  await step(tok);                                   // 4:47 allocated for variables of swap
  await step(tok);                                   // 4:56 values of a and b are copied here
  const ca = tag('影印 10', 'pkt', -1.2, 1.0, 2.0), cb = tag('影印 20', 'pkt', 0.0, 1.0, 2.0);
  await Promise.all([travel(tok, ca, V3(-1.2, 1.0, 2.0), V3(2.4, 0.9, -0.8), 1000), travel(tok, cb, V3(0.0, 1.0, 2.0), V3(3.6, 0.9, -0.8), 1000)]);
  remove(ca); remove(cb); x.set(10); y.set(20); x.mood('wow'); y.mood('wow');
  say('a、b 的值「複製」給 x、y');
  await step(tok);                                   // 4:59 swapping of these two values
  cd.hl(1);
  t.set(10); await anim(tok, 400, () => {});
  x.set(20); await anim(tok, 400, () => {});
  y.set(10); x.mood('happy'); y.mood('happy');
  await Promise.all([x.hop(tok), y.hop(tok)]);
  say('交換只發生在 x、y 身上');
  await step(tok);                                   // 5:06 cannot access the data of main
  cube('', '#b9a88a', [0.25, 1.4, 4.2], 1.6, 0.7, 0.6);
  tag('牆：碰不到對方', 'bad', 1.6, 2.1, 0.6);
  say('swap 碰不到 main 的 activation record');
  await step(tok);                                   // 5:11 this record belongs to main, this to swap
  a.look(1); b.look(1); x.look(-1); y.look(-1);
  say('各自的 record，各管各的');
  await step(tok);                                   // 5:25 not going to work
  no('main 的 a、b 沒變 ✗', -0.6, 2.5, 2.0);
  a.mood('sad'); b.mood('sad'); a.look(0); b.look(0);
  say('結果：a 還是 10、b 還是 20');
}]);

// 5:35 用途二：傳位址
FRAG.push(['ptrwhy-swapref', '用途二（下）：傳位址，間接交換', async (tok) => {
  P.fresh([0, 7.5, 12], [0, 0.6, 0]);
  zone('stack 區・每個函式一塊', 1.6, 0, 0.6, 6.4, 4.4, C_STACK);
  await step(tok);                                   // 5:35 modify our swap
  const cd = code(['void swap(int *x, int *y) {', '  int t = *x; *x = *y; *y = t;', '}', 'swap(&a, &b);'], -5.4, 3.6, 0.5, -1.5);
  say('改寫 swap');
  await step(tok);                                   // 5:40 take pointers as parameters
  cd.hl(0);
  say('參數改成指標：int *x, int *y');
  await step(tok);                                   // 5:52 memory for main
  tag('main', 'say', -2.9, 0.5, 2.0);
  const a = vbox('a', 10, -1.2, 2.0, C_MAIN, '住 500 號'), b = vbox('b', 20, 0.0, 2.0, C_MAIN, '住 502 號');
  await step(tok);                                   // 5:56 memory for x y t
  tag('swap', 'say', 6.3, 0.5, -0.8);
  const x = vbox('x（指標）', '', 2.4, -0.8, C_PTR), y = vbox('y（指標）', '', 3.6, -0.8, C_PTR), t = vbox('t', '', 4.8, -0.8, C_SWAP);
  await step(tok);                                   // 6:02 passing the addresses
  cd.hl(3);
  const na = note('500', -1.2, 1.0, 2.8), nb = note('502', 0.0, 1.0, 2.8);
  say('傳的是位址：&a = 500、&b = 502');
  await step(tok);                                   // 6:11 passed to x and y
  await Promise.all([travel(tok, na, V3(-1.2, 1.0, 2.8), V3(2.4, 0.9, -0.8), 1000), travel(tok, nb, V3(0.0, 1.0, 2.8), V3(3.6, 0.9, -0.8), 1000)]);
  remove(na); remove(nb); x.set(500); y.set(502); x.mood('happy'); y.mood('happy');
  say('x、y 收到地址');
  await step(tok);                                   // 6:16 pointers pointing to these variables
  x.look(-1); y.look(-1);
  arrow(V3(2.2, 0.6, -0.3), V3(-0.9, 0.6, 1.6), 0xa8730f); arrow(V3(3.4, 0.6, -0.3), V3(0.3, 0.6, 1.6), 0xa8730f);
  say('x、y 指向 main 的 a、b');
  await step(tok);                                   // 6:22 using these addresses swap can swap
  cd.hl(1);
  const pa = tag('10', 'pkt', -1.2, 1.0, 2.0), pb = tag('20', 'pkt', 0.0, 1.0, 2.0);
  await Promise.all([travel(tok, pa, V3(-1.2, 1.0, 2.0), V3(0.0, 1.0, 2.0), 900), travel(tok, pb, V3(0.0, 1.0, 2.0), V3(-1.2, 1.0, 2.0), 900)]);
  remove(pa); remove(pb); a.set(20); b.set(10); a.mood('happy'); b.mood('happy');
  await Promise.all([a.hop(tok), b.hop(tok)]);
  ok('a、b 真的交換了 ✓', -0.6, 2.6, 2.0);
  say('照地址改：main 的 a、b 換過來了');
  await step(tok);                                   // 6:32 indirectly accessing variables of main
  say('swap 透過指標「間接」存取 main 的變數', 'call by reference：傳地址');
}]);

// 6:47 用途三、四：檔案與周邊裝置
FRAG.push(['ptrwhy-devices', '用途三、四：檔案與周邊裝置', async (tok) => {
  P.fresh([0, 6.5, 12], [0, 0.6, 0]);
  prop('cpu', 0, 0, 0, 1, '程式（CPU 在跑）');
  const link = (x, z, label) => { const a = arrow(V3(0, 0.4, 0), V3(x * 0.78, 0.4, z * 0.78), 0xa8730f); const l = tag(label, 'ptr', x * 0.45, 1.0, z * 0.45); return [a, l]; };
  await step(tok);                                   // 6:47 accessing files
  tag('用途 ③', 'say', -6.4, 2.6, -1.2);
  prop('disk', -4.8, 0, -1.6, 1, '磁碟（存檔案）'); prop('file', -3.9, 0, -1.0, 0.6);
  say('用途三：存取檔案');
  await step(tok);                                   // 6:52 read or write data from disk
  say('讀、寫磁碟上的資料');
  await step(tok);                                   // 6:57 file pointer is required
  const [fa] = link(-4.8, -1.6, 'FILE *fp');
  say('需要 file pointer');
  await step(tok);                                   // 7:07 open any file
  const pk = tag('檔案資料', 'pkt', -4.4, 0.6, -1.4);
  await travel(tok, pk, V3(-4.4, 0.6, -1.4), V3(-0.4, 0.6, 0), 1100);
  remove(pk);
  say('fopen → 拿到 fp → 讀寫檔案');
  await step(tok);                                   // 7:12 without pointer we cannot
  fa.visible = false; const x1 = no('沒有指標 ✗', -2.4, 1.6, -0.8);
  await anim(tok, 900, () => {});
  fa.visible = true; kill(x1);
  await step(tok);                                   // 7:18 external storage
  say('指標：通往外部儲存的入口');
  await step(tok);                                   // 7:21 accessing peripherals
  tag('用途 ④', 'say', -6.4, 1.6, 0.6);
  say('用途四：周邊裝置');
  await step(tok);                                   // 7:31 from keyboard
  prop('keyboard', -4.4, 0, 2.6, 1, '鍵盤（輸入）');
  say('讀鍵盤輸入');
  await step(tok);                                   // 7:38 on monitor
  prop('monitor', 4.6, 0, -1.6, 0.9, '螢幕（輸出）');
  say('寫到螢幕');
  await step(tok);                                   // 7:42 on the printer
  prop('printer', 4.4, 0, 2.6, 1, '印表機（輸出）');
  say('送到印表機');
  await step(tok);                                   // 7:50 a file on a disk
  say('存取磁碟上的檔案');
  await step(tok);                                   // 7:55 we require a pointer
  const [, kl] = link(-4.4, 2.6, '指標'), [, ml] = link(4.6, -1.6, '指標'); link(4.4, 2.6, '指標');
  say('每一樣都要靠指標');
  await step(tok);                                   // 8:19 printf and scanf use pointers
  P.txt(kl, 'scanf 內部用指標'); P.txt(ml, 'printf 內部用指標');
  say('C 雖然用 printf / scanf', '但它們裡面就是用指標存取裝置');
}]);

// 8:24 總整理
FRAG.push(['ptrwhy-summary', '總整理：stack 以外都靠指標', async (tok) => {
  P.fresh([0, 6.5, 12], [0, 0.6, 0]);
  await step(tok);                                   // 8:24 finally
  prop('cpu', 0, 0, 0, 1, '程式');
  zone('stack', 0, 0, -3.0, 3.0, 1.8, C_STACK);
  const s1 = buddy('', '', C_MAIN, -0.6, 0, -3.0, 0.55), s2 = buddy('', '', C_MAIN, 0.6, 0, -3.0, 0.55);
  say('最後整理');
  await step(tok);                                   // 8:35 any other location apart from the stack
  const far = [prop('warehouse', -5.2, 0, -1.0, 0.9, 'heap'), buddy('別的函式', '', C_SWAP, -5.0, 0, 2.6, 0.7).g, prop('disk', 5.2, 0, -1.0, 0.9, '檔案'), prop('monitor', 5.0, 0, 2.6, 0.7, '周邊裝置')];
  far.forEach((f) => fade(f, true));
  say('stack 以外：heap、別的函式、檔案、裝置');
  await step(tok);                                   // 8:37 only the stack memory is directly accessible
  arrow(V3(0, 0.6, -0.5), V3(0, 0.3, -2.2), 0x0f5a3a);
  ok('直接 ✓', 0.9, 0.9, -1.4);
  s1.mood('happy'); s2.mood('happy');
  say('只有 stack 可以直接存取');
  await step(tok);                                   // 8:44 for indirect accessing pointer is useful
  const ends = [[-5.2, -1.0], [-5.0, 2.6], [5.2, -1.0], [5.0, 2.6]];
  for (let i = 0; i < 4; i++) { fade(far[i], false); arrow(V3(0, 0.6, 0), V3(ends[i][0] * 0.8, 0.6, ends[i][1] * 0.8), 0xa8730f); await anim(tok, 260, () => {}); }
  say('其他地方：都靠指標「間接」存取');
  await step(tok);                                   // 8:55 list of usages: heap
  const chips = ['① 存取 heap', '② call by reference', '③ 存取檔案', '④ 存取周邊裝置'];
  const at = (i) => tag(chips[i], 'say', -6.4 + i * 4.2, 2.8, -3.2);
  at(0);
  say('指標的四種用途');
  await step(tok);                                   // 9:01 call by reference, files
  at(1); await anim(tok, 500, () => {}); at(2);
  await step(tok);                                   // 9:05 any peripheral
  at(3);
}]);
  }
  // ═══ qa-ds2.js（課堂 Q&A 與回顧段落的場景） ═══
  {
const QK = kit(ctx);
const { V3, fresh, tag, cube, kill, glow, tint, txt, arrow, line, ghostBox, code, anim, buddy, GOLD, GREEN, RED } = QK;
const step = (tok) => ctx.step(tok);
const note = (t, x, y, z = 0) => tag(t, 'note', x, y, z);
const bubble = (t, x, y, z = 0) => tag(t, 'say', x, y, z);
const pkt = (t, x, y, z = 0) => tag(t, 'pkt', x, y, z);
const good = (t, x, y, z = 0) => tag(t, 'good', x, y, z);
const bad = (t, x, y, z = 0) => tag(t, 'bad', x, y, z);
const bar = (x, h, color, z = 0) => cube('', color, [0.7, Math.max(0.05, h), 0.7], x, h / 2, z);
const wipe = (arr) => { arr.forEach(kill); arr.length = 0; };

// ── -1FYYVpgyUo：Big O 的 Q&A ──
FRAG.push(['qa-bigo-bound', 'Big O 只要上限；差值可能是負的', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.0, 0]);
  const S = [];
  await step(tok);                                   // 71:48 拆開絕對值：上限和下限
  S.push(note('|f(n) / g(n) − c| < ε', 0, 4.6));
  S.push(line(-5, 1, 5, 1));
  const lo = cube('', '#d8cfc0', [0.15, 0.6, 0.4], -1.6, 1, 0), mid = cube('', '#4b9ee2', [0.15, 0.6, 0.4], 0, 1, 0), hi = cube('', '#2fc092', [0.15, 0.6, 0.4], 1.6, 1, 0);
  S.push(lo, mid, hi);
  S.push(tag('c − ε', 'idx', -1.6, 0.3), tag('c', 'idx', 0, 0.3), tag('c + ε', 'idx', 1.6, 0.3));
  say('極限的定義拆開絕對值', '同時得到一個上限和一個下限');
  await beat(tok, 1600);
  glow(hi, GREEN);
  S.push(good('上限：Big O 只需要這一邊', 2.6, 2.6), tag('下限：之後用別的記號（Ω）', 'idx', -2.6, 1.6));
  await step(tok);                                   // 72:14 時間、空間不會是負的
  wipe(S); kill(lo); kill(mid); kill(hi);
  S.push(line(-5, 0, 5, 0));
  S.push(bar(-2.4, 2.4, '#4b9ee2'), bar(-0.8, 1.6, '#9b7ef4'));
  S.push(tag('時間', 'idx', -2.4, -0.5), tag('空間', 'idx', -0.8, -0.5), good('都 ≥ 0', 2.4, 1.6));
  say('時間、空間本身不會是負的', '');
  await step(tok);                                   // 72:27 兩個東西的差可能是負的
  wipe(S);
  S.push(line(-5, 0, 5, 0));
  S.push(bar(-3.2, 2.0, '#4b9ee2'), bar(-1.6, 3.0, '#9b7ef4'));
  S.push(tag('f₁(n)', 'idx', -3.2, -0.5), tag('f₂(n)', 'idx', -1.6, -0.5));
  const neg = cube('', '#e06666', [0.7, 1.0, 0.7], 1.6, -0.5, 0); S.push(neg);
  S.push(bad('f₁ − f₂ = −1：差可能是負的', 3.0, 1.0));
  say('但兩個量的「差」可能是負的', '例如 f₁(n) − f₂(n)');
  await step(tok);                                   // 72:43 用在負的東西要講清楚
  S.push(pkt('照原值算：f₁ − f₂ ≤ c·g(n)？', 0, 4.7), pkt('還是取絕對值：|f₁ − f₂| ≤ c·g(n)？', 0, 3.9));
  say('把 Big O 用在可能是負的東西上', '要先講清楚：照原值，還是取絕對值');
}]);

FRAG.push(['qa-bigo-omega', 'Big O 的底數、little-o、Ω、Θ', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // 95:36 多個 Big O 之間做運算
  S.push(note('O(f) + O(g) = ?　O(f) · O(g) = ?', 0, 4.4));
  say('多個 Big O 之間可以做運算', '下一段的主題');
  await step(tok);                                   // 96:20 底數有沒有關係
  wipe(S);
  S.push(good('log₂ n = (log₂ 10) · log₁₀ n：只差常數倍', 0, 4.4));
  S.push(tag('→ 底數不同，都是 O(log n)', 'idx', 0, 3.7));
  S.push(bad('3ⁿ / 2ⁿ = (1.5)ⁿ → ∞：不是常數倍', 0, 2.4));
  S.push(tag('→ 指數的底數不同，就是不同等級', 'idx', 0, 1.7));
  say('底數有沒有關係？要用定義證明', 'log 的底數沒關係；指數的底數有關係，比較 tricky');
  await step(tok);                                   // 97:20 little-o、little-omega
  wipe(S);
  S.push(note('f = o(g)：f / g → 0（嚴格比 g 小）', 0, 4.4));
  S.push(note('f = ω(g)：f / g → ∞（嚴格比 g 大）', 0, 3.5));
  S.push(tag('定義比較接近極限，只在特定地方用到', 'idx', 0, 2.6));
  say('little o、little omega 各有定義', '比較接近極限的寫法');
  await step(tok);                                   // 97:54 Big Omega
  wipe(S);
  S.push(note('Ω：下界', 0, 4.6));
  S.push(bad('不是「某個 input 運氣好」的時間', 0, 3.7), good('常用在：一個問題最少要多少時間', 0, 2.9));
  S.push(tag('例：比較式排序最少 Ω(n log n)', 'idx', 0, 2.2));
  say('Ω 常用來說「這個問題最少要多少時間」', '比這更快就註定會錯');
  await step(tok);                                   // 99:16 任何函數都可以講 O、Ω、Θ
  wipe(S);
  const f = cube('f(n)', '#4b9ee2', [2.2, 0.6, 0.6], 0, 2.4, 0); S.push(f);
  const up = cube('O(g)：上界', '#2fc092', [3.4, 0.35, 0.6], 0, 3.6, 0), dn = cube('Ω(g)：下界', '#9b7ef4', [3.4, 0.35, 0.6], 0, 1.2, 0);
  S.push(up, dn);
  S.push(good('上下都夾住 → Θ(g)', 0, 4.4), tag('最常用：worst case 的 Big O', 'idx', 0, 0.4));
  say('任何函數都可以講 O、Ω，知道確切的話講 Θ', '這門課最常用的是 Big O');
}]);

FRAG.push(['qa-two-n', '2ⁿ 的例子：窮舉與天真遞迴', async (tok) => {
  fresh([0, 3.6, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // 130:17 2ⁿ 的程式其實不少
  S.push(line(-6, 0, 2, 0));
  [2, 4, 8, 16, 32, 64].forEach((v, i) => { S.push(bar(-5.4 + i * 1.3, v * 0.075, '#e06666')); S.push(tag('n=' + (i + 1) + '：' + v, 'idx', -5.4 + i * 1.3, -0.45)); });
  S.push(note('2ⁿ：n 每 +1，時間就翻倍', 4.2, 3.6));
  say('2ⁿ 時間的程式其實不少', '只是大家還沒碰到那麼大的問題');
  await step(tok);                                   // 131:52 窮舉 0/1 字串
  wipe(S);
  const strs = ['000', '001', '010', '011', '100', '101', '110', '111'];
  const cs = strs.map((s, i) => cube(s, '#f6deb0', [0.9, 0.55, 0.6], -4.55 + i * 1.3, 1.6, 0)); S.push(...cs);
  S.push(note('長度 n 的 0/1 字串：2ⁿ 個（n = 3 → 8 個）', 0, 3.6));
  say('窮舉：在所有長度 n 的二進位字串裡', '一個一個找，就像 sequential search');
  for (let i = 0; i < 8; i++) { glow(cs[i], GOLD); await beat(tok, 380); glow(cs[i], null); }
  glow(cs[7], GOLD);
  await step(tok);                                   // 132:37 沒寫好的 Fibonacci
  wipe(S);
  const T = [['F(4)', 0, 4.8, -1], ['F(3)', -2.4, 3.6, 0], ['F(2)', 2.4, 3.6, 0], ['F(2)', -3.6, 2.4, 1], ['F(1)', -1.2, 2.4, 1], ['F(1)', 1.2, 2.4, 2], ['F(0)', 3.6, 2.4, 2], ['F(1)', -4.4, 1.2, 3], ['F(0)', -2.8, 1.2, 3]];
  const ns = [];
  for (const [t, x, y, p] of T) {
    const m = cube(t, t === 'F(2)' ? '#f0a8a8' : '#4b9ee2', [0.95, 0.5, 0.5], x, y, 0, 1.5); ns.push(m); S.push(m);
    if (p >= 0) S.push(line(T[p][1], T[p][2] - 0.25, x, y + 0.25));
    await beat(tok, 260);
  }
  S.push(bad('F(2) 被重算了兩次', 3.2, 1.2));
  S.push(note('天真遞迴：呼叫次數是指數級，上界 O(2ⁿ)', 0, 0.2));
  say('分析沒寫好的遞迴（例如 Fibonacci）', '也常常得到 2ⁿ');
}]);

FRAG.push(['qa-stack-browser', '瀏覽器上一頁與 restricted container', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.4, 0]);
  const S = [];
  await step(tok);                                   // 164:04 上一頁也是 stack
  const pg = ['A 首頁', 'B 文章', 'C 留言'].map((t, i) => cube(t, ['#4b9ee2', '#9b7ef4', '#2fc092'][i], [2.0, 0.6, 1.0], -3, 0.35 + i * 0.7, 0, 3));
  S.push(...pg);
  S.push(tag('造訪順序：A → B → C', 'idx', -3, 3.0));
  say('瀏覽器的「上一頁」可以想成 stack', '每開一頁就 push');
  await step(tok);                                   // 164:15 也可以想成 linked list
  const ll = [2, 1].map((i) => arrow(V3(-1.9, 0.35 + i * 0.7, 0), V3(-1.9, 0.35 + (i - 1) * 0.7 + 0.15, 0.4), 0xa8730f));
  S.push(...ll, bubble('也可以是一條隱含的 linked list', 2.4, 2.4));
  say('換個角度：也可以想成 linked list', '實作不一定是 stack');
  await step(tok);                                   // 164:29 按上一頁回到最後造訪的
  QK.fly(pg[2]);
  glow(pg[1], GOLD);
  S.push(good('上一頁 = pop：回到 B', 2.4, 1.4));
  say('按「上一頁」：回到最後造訪的頁面', '最後進來的先出去');
  await step(tok);                                   // 166:06 container
  wipe(S); pg.forEach(kill);
  const g1 = ghostBox('#4b9ee2', 3.2, 2.0, 1.4); g1.position.set(-3.4, 1.2, 0); S.push(g1);
  const g2 = ghostBox('#2fc092', 1.4, 2.6, 1.4); g2.position.set(3.0, 1.5, 0); S.push(g2);
  S.push(tag('array、list：general container', 'ptr', -3.4, 3.0), tag('stack：restricted container', 'ptr', 3.0, 4.9));
  [-4.4, -3.4, -2.4].forEach((x, i) => S.push(cube(String(i + 1), '#9b7ef4', [0.6, 0.6, 0.6], x, 0.5, 0, 2)));
  S.push(tag('哪裡都可以放、可以拿', 'idx', -3.4, -0.4), tag('只有上面一個開口', 'idx', 3.0, -0.4));
  S.push(arrow(V3(3.0, 4.5, 0), V3(3.0, 2.9, 0), 0x0f5a3a));
  say('container 就是可以裝東西的容器', 'array、list 很自由；stack 有規定的進出方式');
  await step(tok);                                   // 166:56 stack = 底層容器 + 限定開口
  S.push(cube('array / linked list', '#d8c29b', [2.6, 0.3, 1.4], 3.0, 0.05, 0));
  S.push(good('stack = 底層容器 + 限定的開口', 0, -1.1));
  say('stack 底下其實是 array 或 linked list', '只是在上面加了一個限定的開口');
}]);

// ── 1yyu70Vy9Zc：C++ 的 Q&A 與 row-major ──
FRAG.push(['qa-cpp-this', 'class、this、operator overloading、回傳 reference', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // 46:43 class ≈ struct + function
  const box = ghostBox('#4b9ee2', 4.4, 1.6, 1.4); box.position.set(-2.4, 1.6, 0); S.push(box);
  S.push(cube('x', '#4b9ee2', [0.8, 0.6, 0.6], -3.6, 1.6, 0), cube('y', '#4b9ee2', [0.8, 0.6, 0.6], -2.6, 1.6, 0));
  const nm = tag('struct Point', 'ptr', -2.4, 2.9); S.push(nm);
  say('入門可以把 class 看成 struct 加上 function', '');
  await beat(tok, 1500);
  S.push(cube('move()', '#c08a1f', [1.1, 0.6, 0.6], -1.2, 1.6, 0, 2));
  txt(nm, 'class Point：資料 + function');
  S.push(tag('另外還有權限控制（private / public）', 'idx', 2.8, 1.6));
  await step(tok);                                   // 47:35 this 指標
  wipe(S);
  const mem = []; for (let i = 0; i < 8; i++) { mem.push(cube('', '#f6deb0', [0.9, 0.4, 0.8], -3.85 + i * 1.1, 0.4, 0)); S.push(tag('0x' + (0x1000 + i * 4).toString(16), 'idx', -3.85 + i * 1.1, -0.2)); }
  S.push(...mem);
  [3, 4].forEach((i) => tint(mem[i], '#4b9ee2'));
  S.push(tag('這個物件（x、y）', 'ptr', -3.85 + 3.5 * 1.1, 1.2));
  const th = pkt('this = 0x100c', -3.85 + 3 * 1.1, 3.4); S.push(th);
  S.push(arrow(V3(-3.85 + 3 * 1.1, 3.0, 0), V3(-3.85 + 3 * 1.1, 0.75, 0), 0xa8730f));
  say('this：系統偷偷藏起來的指標', '記著「目前這個物件」在記憶體的哪裡');
  await step(tok);                                   // 48:15 operator overloading 速度
  wipe(S);
  S.push(note('c = a + b;', -3, 3.6));
  S.push(arrow(V3(-1.4, 3.6, 0), V3(0.6, 3.6, 0)));
  S.push(note('c = operator+(a, b);', 3, 3.6));
  S.push(good('編譯器翻譯成 function 呼叫：執行速度幾乎一樣', 0, 2.2));
  S.push(tag('差別在寫程式的速度：code 更乾淨', 'idx', 0, 1.4));
  say('operator overloading 跟 function 一樣快', '差的是「寫」的速度');
  await step(tok);                                   // 49:16 不回傳 reference：多複製一份
  wipe(S);
  S.push(note('a = b;', 0, 4.6));
  const ret = cube('回傳的物件', '#9b7ef4', [1.8, 0.7, 0.8], -2.6, 2.4, 0), rcv = cube('接收方', '#4b9ee2', [1.8, 0.7, 0.8], 2.6, 2.4, 0);
  S.push(ret, rcv);
  const cp = cube('複製品', '#f0a8a8', [1.8, 0.7, 0.8], -2.6, 2.4, 0); S.push(cp);
  await anim(tok, 900, (u) => cp.position.set(-2.6 + u * 2.6, 2.4 + Math.sin(u * Math.PI) * 0.8, 0));
  S.push(bad('不回傳 reference：多複製一份、多佔記憶體', 0, 0.9));
  say('operator= 如果不回傳 reference', '回傳的東西會再複製一份給接收方');
  await step(tok);                                   // 50:08 回傳 reference：不複製
  QK.fly(cp);
  S.push(good('回傳 reference：直接用原來那一份，不複製', 0, 0.2));
  S.push(pkt('Point& operator=(const Point&)', 0, 3.8));
  say('回傳 reference：沒有複製的動作', '省時間，也不會有多餘的記憶體');
}]);

FRAG.push(['qa-cpp-sort', 'STL sort 需要比較大小的 operator；reference 像安全的 pointer', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // 64:19 自訂型別要能比大小
  const st = ['Amy', 'Bob', 'Cat'].map((t, i) => cube(t, '#9b7ef4', [1.3, 0.7, 0.8], -4.4 + i * 1.6, 2.2, 0, 2)); S.push(...st);
  S.push(note('sort(v.begin(), v.end());', 2.8, 3.6), bubble('Student 誰比較小？', -2.8, 3.4));
  say('用 STL 的 sort 排自訂型別', '至少要能比較大小');
  await step(tok);                                   // 64:53 編譯器找不到就 compile 不過
  const c = code(['template <class T>', 'void sort(T* a, ...) {', '  if (a[j] < a[i]) ...', '}'], 2.6, 2.6, 0.5); S.push(...c.ls);
  c.hl(2);
  S.push(bad('沒有 operator< → compile 不過', -2.8, 0.8));
  say('編譯器把 T 換成 Student 之後', '找不到 < 的定義就 compile 不過');
  await beat(tok, 2600);
  S.push(good('bool operator<(const Student&) 寫好就能 sort', -1.6, 0.0));
  await step(tok);                                   // 65:13 reference 是比較安全的 pointer
  wipe(S); c.kill();
  const x = cube('x = 5', '#4b9ee2', [1.4, 0.7, 0.8], 0, 2.0, 0); S.push(x);
  S.push(pkt('int* p = &x;', -3.6, 3.6), arrow(V3(-3.0, 3.3, 0), V3(-0.8, 2.3, 0), 0xa8730f));
  S.push(tag('pointer：可以改指別處、可以是 NULL', 'idx', -3.6, 0.9));
  S.push(pkt('int& r = x;', 3.6, 3.6), arrow(V3(3.0, 3.3, 0), V3(0.8, 2.3, 0), 0x0f5a3a));
  S.push(tag('reference：x 的別名，一定綁著 x', 'idx', 3.6, 0.1));
  say('reference 很像 C 的 pointer', '可以看成 pointer 一種比較安全的包裝');
}]);

FRAG.push(['qa-cpp-access', 'class 與 struct 的預設權限', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // 78:16 class 預設 private、struct 預設 public
  const gc = ghostBox('#9b7ef4', 3.6, 1.8, 1.4); gc.position.set(-3, 1.6, 0); S.push(gc);
  const gs = ghostBox('#2fc092', 3.6, 1.8, 1.4); gs.position.set(3, 1.6, 0); S.push(gs);
  S.push(tag('class：預設 private', 'ptr', -3, 2.9), tag('struct：預設 public', 'ptr', 3, 2.9));
  S.push(cube('data', '#9b7ef4', [1.2, 0.6, 0.6], -3, 1.4, 0), cube('data', '#2fc092', [1.2, 0.6, 0.6], 3, 1.4, 0));
  say('C++ 的 class 和 struct 幾乎一樣', 'class 預設 private，struct 預設 public');
  await step(tok);                                   // 78:29 C++ 的 struct 也能寫 function
  S.push(cube('f()', '#c08a1f', [0.8, 0.6, 0.6], 4.2, 1.4, 0, 2));
  S.push(good('C++ 的 struct 也能寫 function', 3, 0.3), tag('C 的 struct：只能宣告資料', 'idx', -3, -0.4));
  say('C++ 的 struct 也可以寫 function', 'C 的 struct 只能放資料');
  await step(tok);                                   // 82:58 private / public = 權限控制
  wipe(S);
  const box = ghostBox('#9b7ef4', 4.0, 2.0, 1.4); box.position.set(2.4, 1.6, 0); S.push(box);
  const pv = cube('private: balance', '#9b7ef4', [2.6, 0.55, 0.6], 2.4, 2.1, 0), pb = cube('public: show()', '#2fc092', [2.6, 0.55, 0.6], 2.4, 1.2, 0);
  S.push(pv, pb);
  const out = buddy('外面的程式', '', '#f3d36b', -4.2, 0, 0.6, 0.8); S.push(out.g);
  S.push(arrow(V3(-3.4, 1.4, 0.3), V3(0.9, 2.1, 0.3), 0x7a1010), bad('看不到、改不了', -1.4, 3.0));
  out.mood('sad');
  await beat(tok, 1600);
  S.push(arrow(V3(-3.4, 0.9, 0.3), V3(0.9, 1.2, 0.3), 0x0f5a3a), good('可以呼叫', -1.4, 0.2));
  say('private / public 是權限控制', '某些程式不能看到、不能改某些資料');
}]);

FRAG.push(['qa-arr-rowmajor', 'row-major、cache 與 one block', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // 150:30 大規模資料才看得出差別
  const mem = [];
  for (let i = 0; i < 12; i++) { const r = Math.floor(i / 4), c = i % 4; mem.push(cube(r + '' + c, ['#4b9ee2', '#9b7ef4', '#2fc092'][r], [0.6, 0.5, 0.6], -4.4 + i * 0.8, 1.4, 0)); }
  S.push(...mem, tag('記憶體（one block，row-major）', 'ptr', 0, 2.3));
  say('row sum：照記憶體順序一格一格走', '');
  for (let i = 0; i < 12; i++) { glow(mem[i], GREEN); await beat(tok, 140); }
  await beat(tok, 500); mem.forEach((m) => glow(m, null));
  say('column sum：每次跳 4 格', '資料小看不出差別；資料大時 cache 會讓差距變明顯');
  for (const i of [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11]) { glow(mem[i], GOLD); await beat(tok, 160); }
  S.push(good('row sum：連續存取', -2.6, 0.4), bad('column sum：跳著存取', 2.6, -0.3));
  await step(tok);                                   // 151:20 cache 會被洗掉、不是唯一因素
  mem.forEach((m) => glow(m, null));
  S.push(QK.prop('cpu', -5.6, 3.0, 0, 0.8));
  S.push(note('cache：會被別的程式洗掉', 1.2, 4.2), tag('cache 只是影響時間的因素之一', 'idx', 1.2, 3.4));
  say('cache 裡的東西會被別的工作洗掉', '而且 cache 只是其中一個因素');
  await step(tok);                                   // 152:31 測的是 one block
  wipe(S); mem.length = 0;
  for (let i = 0; i < 12; i++) S.push(cube('', ['#4b9ee2', '#9b7ef4', '#2fc092'][Math.floor(i / 4)], [0.6, 0.5, 0.6], -4.4 + i * 0.8, 3.4, 0));
  S.push(tag('one block：整個 2D array 一整塊連續', 'ptr', 0, 4.3));
  for (let r = 0; r < 3; r++) {
    S.push(cube('', '#d8c29b', [0.6, 0.5, 0.6], -4.4, 1.6 - r * 0.7, 0));
    for (let c = 0; c < 4; c++) S.push(cube('', ['#4b9ee2', '#9b7ef4', '#2fc092'][r], [0.6, 0.5, 0.6], -1.2 + r * 0.6 + c * 0.7 + r * 1.6, 1.6 - r * 0.7, 0));
    S.push(arrow(V3(-4.05, 1.6 - r * 0.7, 0), V3(-1.55 + r * 2.2, 1.6 - r * 0.7, 0), 0x6e5f49));
  }
  S.push(tag('array of arrays：每一列各自一塊', 'ptr', 0, -0.6));
  say('剛才測的是 one block（C 原生的 2D array）', 'array of arrays 每一列可能散在不同地方');
  await step(tok);                                   // 152:53 C 是 row-major
  wipe(S);
  const rm = [], cm = [];
  for (let i = 0; i < 12; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    rm.push(cube(r + '' + c, ['#4b9ee2', '#9b7ef4', '#2fc092'][r], [0.6, 0.5, 0.6], -4.4 + i * 0.8, 3.0, 0));
    const r2 = i % 3, c2 = Math.floor(i / 3);
    cm.push(cube(r2 + '' + c2, ['#4b9ee2', '#9b7ef4', '#2fc092'][r2], [0.6, 0.5, 0.6], -4.4 + i * 0.8, 1.0, 0));
  }
  S.push(...rm, ...cm);
  S.push(tag('row-major（C、C++ 等多數當代語言）：一列一列放', 'ptr', 0, 3.9), tag('column-major（Fortran 等傳統語言）：一行一行放', 'ptr', 0, 1.9));
  say('C 配置 one block 用 row-major', '這是語言特性，要去查；有些傳統語言用 column-major');
}]);

// ── B0ywTK-Lklw：同學挑出的錯 ──
FRAG.push(['qa-search-fix', 'binary search 的迴圈條件與 NOT_FOUND', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  const A = [3, 8, 12, 20, 27, 35, 41, 56];
  await step(tok);                                   // 67:32 迴圈條件寫反
  const cs = A.map((v, i) => cube(v, '#f6deb0', [0.8, 0.6, 0.7], -3.85 + i * 1.1, 1.0, 0)); S.push(...cs);
  S.push(pkt('left', -3.85, 2.0), pkt('right', -3.85 + 7 * 1.1, 2.0));
  S.push(bad('while (left > right)：寫反了', -2.4, 3.8), good('while (left <= right)：還有書可找才繼續', 2.0, 3.0));
  say('同學抓到：binary search 的迴圈條件寫反', '應該是「還有書可找」才繼續找');
  await step(tok);                                   // 68:09 return NOT_FOUND 前不用 else
  wipe(S); cs.length = 0;
  const c = code(['for (i = 0; i < n; i++) {', '  if (a[i] == toFind) return i;', '  if (a[i] > toFind) break; // 後面只會更大', '}', 'return NOT_FOUND; // 在整個 for 外面'], 0, 4.2, 0.55);
  S.push(...c.ls);
  c.hl(2); say('排好序的 sequential search：碰到更大的就停', '中途停下來（也可以寫成 break）');
  await beat(tok, 2500);
  c.hl(4); S.push(good('NOT_FOUND 在 for 外面：不需要 else', 0, 1.0));
  await step(tok);                                   // 71:26 跑完都沒跳出 → toFind 比全部大
  c.kill(); wipe(S);
  const cs2 = A.map((v, i) => cube(v, '#f6deb0', [0.8, 0.6, 0.7], -3.85 + i * 1.1, 1.0, 0)); S.push(...cs2);
  const q = pkt('toFind = 99', -5.0, 2.6); S.push(q);
  for (let i = 0; i < 8; i++) { glow(cs2[i], GOLD); await beat(tok, 260); glow(cs2[i], null); }
  S.push(bad('迴圈跑完都沒跳出', 0, 3.4), good('→ toFind 比全部都大：NOT_FOUND', 0, 2.6));
  say('迴圈整個跑完都沒有跳出來', '代表 toFind 比所有元素都大');
}]);

// ── 回顧段落 ──
FRAG.push(['recap-array-unit', 'Array 單元回顧', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // index 對 value
  for (let i = 0; i < 6; i++) { S.push(cube([7, 2, 9, 4, 1, 6][i], '#4b9ee2', [0.8, 0.6, 0.7], -2.75 + i * 1.1, 1.6, 0, 2)); S.push(tag(String(i), 'idx', -2.75 + i * 1.1, 0.9)); }
  S.push(note('array：index → value，就這麼簡單', 0, 3.4));
  say('array 本身很簡單：index 對 value', '重點在它的應用');
  await step(tok);                                   // 多項式的表示
  wipe(S);
  S.push(tag('表示法 1：一個多項式一個 array（索引 = 次方）', 'ptr', 0, 4.6));
  [1, 2, 3, 0, 0].forEach((v, i) => S.push(cube(v, '#9b7ef4', [0.7, 0.5, 0.6], -2.2 + i * 0.9, 3.8, 0)));
  S.push(tag('表示法 2：很多多項式共用一個 (係數, 次方) array', 'ptr', 0, 2.4));
  [['3,2', '#4b9ee2'], ['2,1', '#4b9ee2'], ['1,0', '#4b9ee2'], ['5,4', '#2fc092'], ['1,0', '#2fc092']].forEach(([t, col], i) => S.push(cube(t, col, [0.8, 0.5, 0.6], -2.2 + i * 0.95, 1.6, 0)));
  S.push(tag('A(x) = 3x² + 2x + 1　B(x) = 5x⁴ + 1', 'idx', 0, 0.8));
  say('多項式可以有不同的 array 表示法', '空間成本、運算的 complexity 都不一樣');
  await step(tok);                                   // sparse matrix 與 transpose
  wipe(S);
  S.push(tag('sparse matrix：只存非 0 的 (row, col, value)', 'ptr', 0, 4.4));
  const tri = [['0,0,15', '0,0,15'], ['0,3,22', '3,0,22'], ['1,1,11', '1,1,11'], ['2,3,-6', '3,2,-6']];
  const L = tri.map((t, i) => cube(t[0], '#f6deb0', [1.3, 0.5, 0.6], -2.4, 3.4 - i * 0.65, 0)); S.push(...L);
  S.push(arrow(V3(-1.4, 2.4, 0), V3(0.9, 2.4, 0)), tag('transpose：row、col 對調', 'idx', -0.25, 0.5));
  tri.forEach((t, i) => S.push(cube(t[1], '#2fc092', [1.3, 0.5, 0.6], 2.4, 3.4 - i * 0.65, 0, 2)));
  say('sparse matrix 有專門的表示法', '只存不是 0 的地方，也教了怎麼做 transpose');
  await step(tok);                                   // string matching
  wipe(S);
  const tx = [...'ababcab'].map((ch, i) => cube(ch, '#f6deb0', [0.7, 0.6, 0.6], -3.3 + i * 1.1, 1.4, 0)); S.push(...tx);
  const pt = [...'abc'].map((ch, i) => cube(ch, '#9b7ef4', [0.7, 0.6, 0.6], -3.3 + i * 1.1, 2.6, 0)); S.push(...pt);
  S.push(tag('pattern 有沒有出現在字串裡？', 'ptr', 0, 3.8));
  say('最後一個應用：string matching', '找 pattern 有沒有出現在字串裡');
  for (let s = 1; s <= 2; s++) { await beat(tok, 700); pt.forEach((m, i) => QK.move(m, -3.3 + (s + i) * 1.1, 2.6)); }
  await beat(tok, 700);
  for (let i = 2; i < 5; i++) glow(tx[i], GREEN);
  S.push(good('在 index 2 找到 "abc"', 0, 0.4));
}]);

FRAG.push(['recap-ch1', '第一章回顧：資料結構、演算法與複雜度', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.2, 0]);
  const S = [];
  await step(tok);                                   // DS 和 algorithm 的關係
  const al = buddy('algorithm', '', '#9b7ef4', -3.2, 0, 0, 1.0), ds = buddy('data structure', '', '#4b9ee2', 3.2, 0, 0, 1.0);
  S.push(al.g, ds.g, line(-2.4, 0.6, 2.4, 0.6));
  say('第一章最重要：data structure 是做什麼的', '它跟 algorithm 的關係是什麼');
  await step(tok);                                   // algorithm 解決問題
  S.push(note('input → output', -3.2, 2.9), tag('還要符合 criteria（明確、會結束、做得到…）', 'idx', -3.2, 2.2));
  al.mood('happy');
  say('algorithm 是用來解決問題的', '有 input、output，還要符合幾個 criteria');
  await step(tok);                                   // DS 用來 implement，影響 performance
  S.push(note('把方法 implement 出來', 3.2, 4.3), tag('選什麼 DS 會影響 performance', 'idx', 3.2, 3.6));
  ds.mood('happy');
  say('data structure 把這些方法 implement 出來', '用哪一種，performance 差很多');
  await step(tok);                                   // complexity
  wipe(S);
  const G = [['1', 0.3], ['log n', 0.7], ['n', 1.2], ['n log n', 1.8], ['n²', 2.6], ['2ⁿ', 3.6]];
  S.push(line(-5, 0, 3, 0));
  G.forEach(([t, h], i) => { S.push(bar(-4.4 + i * 1.4, h, ['#2fc092', '#2fc092', '#4b9ee2', '#4b9ee2', '#c08a1f', '#e06666'][i])); S.push(tag(t, 'idx', -4.4 + i * 1.4, -0.45)); });
  S.push(note('time 與 storage complexity', 4.6, 3.6));
  say('用 complexity 評估方法的好壞', '從 time 和 storage 兩個角度看');
}]);

FRAG.push(['recap-ds-alg', '回顧：資料結構搭配演算法', async (tok) => {
  fresh([0, 3.8, 12.5], [0, 2.6, 0]);
  const row = (name, color, y) => cube(name, color, [2.6, 0.55, 0.7], -3.8, y, 0, 2);
  const alg = (t, y) => tag(t, 'note', 2.0, y);
  await step(tok);                                   // array → sequential search
  row('array', '#4b9ee2', 5.0); const a1 = alg('sequential search', 5.0);
  say('從最簡單的開始：array 上做 sequential search', 'linked list 上也能做');
  await step(tok);                                   // 找最小值 → selection sort
  txt(a1, 'sequential search → 找最小值 → selection sort');
  say('找「最小的那個」幾乎一模一樣', '再配一個 for 迴圈就是 selection sort');
  await step(tok);                                   // linked list → insertion sort；ordered array → binary search
  row('linked list', '#9b7ef4', 4.1); alg('insertion 方便 → insertion sort', 4.1);
  row('ordered array', '#31aab0', 3.2); alg('binary search', 3.2);
  say('linked list 插入方便 → insertion sort', '排好序的 array → binary search');
  await step(tok);                                   // sparse / polynomial；龜兔賽跑
  row('sparse / polynomial', '#2fc092', 2.3); alg('merge、inner product；偵測 cycle（龜兔賽跑）', 2.3);
  say('linked list 表示 sparse vector、polynomial', '還有面試常考的龜兔賽跑找 cycle');
  await step(tok);                                   // stack
  row('stack', '#c08a1f', 1.4); alg('括號配對、postfix 求值、infix → postfix', 1.4);
  say('stack：parentheses matching', 'postfix evaluation、infix to postfix');
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
    quiz: genQueueQ,
    pages: [
      { id: 'cmp', name: '複雜度對照', render: renderCmp },
      { id: 'quiz', name: '小測驗', render: renderQuiz },
    ],
    scenes,
    sceneOrder: ['stack-lifo', 'queue-fifo', 'queue-false-full', 'circular-queue', 'list-insert', 'postfix-eval', 'infix-to-postfix', 'maze-dfs', 'maze-compare', ...FRAG.map((f) => f[0])],
    stop() { clearInterval(pf.timer); clearInterval(mz.timer); },
  };
}
