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
  const cd = code(['Complex plus(Complex a, Complex b) {', '  c.real = a.real + b.real;', '  c.imag = a.imag + b.imag;', '}'], 0, 7.0, 0.5, -2.6);
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
  await step(tok);                                     // 8:11 rule 3: log n^k, prove it
  tag('Rule 3：log nᵏ = k·log n = O(log n)', 'note', 4.4, 2.6, -1);
  say('Rule 3：log nᵏ，請自己證明', '補充：log nᵏ = k·log n = O(log n)');
  await step(tok);                                     // 8:35 e.g. n^3 + 4
  say('例：n³ + 4，只看最高次', 'n³ + 4 = O(n³)');
  await step(tok);                                     // 8:52 prove: find c and n0
  say('怎麼證明？照定義找出 c 和 n₀', 'log nᵏ ≤ c·log n（c = k，n ≥ 2）');
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
  fresh([0, 7.5, 13], [0, 1.6, 0.6]);
  const cd = code(['C.start = free; a = start; b = B.start;', 'while (a <= finish && b <= B.finish)', '  switch (compare(termArray[a].exp, termArray[b].exp)) {', '   case \'=\': c = 兩 coef 相加; if (c) NewTerm(c, exp); a++; b++;', '   case \'<\': NewTerm(b 的 coef, exp); b++;', '   case \'>\': NewTerm(a 的 coef, exp); a++;', '  }', 'for (; a <= finish; a++) NewTerm(…);', 'for (; b <= B.finish; b++) NewTerm(…);', 'C.finish = free − 1;'], 0, 8.4, 0.44);
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
    cd.hl(8);
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
  tag('Polynomial C', 'ptr alt', X(8), 3.0, -0.4);
  say('宣告 Polynomial C 放結果', '');
  await step(tok);                                     // 1:16:09 C.start = free
  cd.hl(0);
  tag('C.start', 'ptr alt', X(6), 2.3, -0.4);
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
  tag('free ≥ MaxTerms → 放不下', 'note', X(8), 3.6, -0.4);
  say('要檢查：free 超過 MaxTerms 就放不下', '');
  await step(tok);                                     // 1:19:54 then bail out
  cd.hl(9);
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
  const ms = {};
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const x = cx + (c - 2.5) * s, z = cz + (r - 2.5) * s;
    const hit = SM.find((t) => t[0] === r && t[1] === c);
    if (hit) ms[r + ',' + c] = cube(String(hit[2]), colorFor(Math.abs(hit[2])), [s * 0.85, h, s * 0.85], x, h / 2, z, 0);
    else cube('0', '#efe6d6', [s * 0.85, zeroH, s * 0.85], x, zeroH / 2, z);
  }
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
  for (const [r, c] of SM) { if (r === c) continue; const m = ms[r + ',' + c]; glow(m, GOLD); move(m, (r - 2.5) * 1.2, 0.3, 0.4 + (c - 2.5) * 1.2); }
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
  say('R[i][j] 的值怎麼算', 'R[i][j] = Σ_{k=0}^{n−1} a[i][k] · b[k][j]');
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
  tag('n 維：a[i1][i2]…[in] 也有公式（參考即可）', 'note', 0, 0.2, 2.4);
  say('可以推廣到 n 維 array', '起始位置套公式，參考就好');
  await step(tok);                                     // 32:55 column major
  glow(G[1][2], null);
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
  say('一維用單指標，二維要用 double pointer');
  await step(tok);                                   // 4:28 3D triple; as many levels as dimensions
  txt(lv, '1D → *　2D → **　3D → ***');
  say('三維用 triple pointer', '幾維就要幾層指標');
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
  say('Linked List 一律建在 Heap', '建在 Stack 沒有意義');
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
  say('node 一定要建在 Heap', '所以先宣告 struct Node *p;');
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
  say('malloc 回傳 void *', '要強制轉型成 struct Node *');
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
function memLayout4() {
  region('OS', '#9b8b72', -5.25, 2.6, 5.2, 2.4);
  region('Code', C_CODE, -1.75, 2.6, 5.2, 2.4);
  region('Stack', C_STACK, 1.75, 2.6, 5.2, 2.4);
  region('Heap', C_HEAP, 5.25, 2.6, 5.2, 2.4);
}
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
  say('還有一小塊屬於 Code', '放 global、static 變數');
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
  say('例子：依字母順序排好的單字', 'BAT → CAT → EAT → FAT → HAT');
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
  memory();
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
  zone('stack 區・每個函式一塊', 1.6, 0, 0.6, 6.4, 4.4, C_STACK);
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
